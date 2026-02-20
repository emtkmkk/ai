/**
 * @packageDocumentation
 *
 * reversi-service 用の WebSocket ストリームクライアント。
 *
 * @remarks
 * 既存の Misskey 用 {@link Stream} は使わず、reversi-service の GET /api/reversi/stream に
 * 専用接続する。matched 用 1 本を常時維持し、matched 受信ごとに最大 5 本まで対局用接続を張る。
 * 切断時は再接続し、サーバーが送る sync で状態を復帰する。
 * 相手の応答が遅い場合の切断を防ぐため、matched 接続と各対局接続で定期的に ping を送る。
 *
 * @internal
 */

import * as WebSocket from 'ws';
import config from '@/config';
import log from '@/utils/log';

/** ping 送信間隔（ミリ秒）。アイドル切断を防ぐ。 */
const PING_INTERVAL_MS = 30 * 1000;

/** 進行中ゲーム 1 件あたりの接続で受信するメッセージの body.type */
export type ReversiGameMessageType = 'started' | 'log' | 'ended' | 'sync';

/**
 * 対局用接続のイベントハンドラ
 *
 * @remarks
 * openGameConnection のあと setGameHandlers で登録する。ストリームの channel メッセージ（started / log / ended / sync）に応じて呼ばれる。
 *
 * @internal
 */
export interface ReversiGameHandlers {
	/** 対局開始。body に game オブジェクトが含まれる */
	onStarted: (body: { game: any }) => void;
	/** 着手（石が置かれた）。body に color, pos 等が含まれる */
	onLog: (body: any) => void;
	/** 対局終了。body に winnerId / surrendered 等が含まれる */
	onEnded: (body: any) => void;
	/** 状態同期（再接続後の復帰用）。body に game, board/boardState, turn 等が含まれる */
	onSync: (body: any) => void;
}

/** matched 受信時のコールバック。ゲームを開始するなら true、忙しい等で無視するなら false。 */
export type OnMatchedCallback = (body: { game: any }) => boolean;

/**
 * reversi-service 用 WebSocket クライアント
 *
 * @remarks
 * - 接続 1: channel 'reversi' で matched 専用を常時維持。
 * - matched 受信時、コールバックが true を返した場合のみ、接続 2〜6: channel 'reversiGame' を 1 本ずつ張る（最大 5 対局）。
 * - 対局用接続では started / log / ended / sync を受信し、putStone / ready を送信する。
 *
 * @internal
 */
export class ReversiStreamClient {
	private wsUrl: string;
	private token: string;
	private matchedWs: WebSocket | null = null;
	private matchedWsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
	/** matched 接続の ping 用タイマー。切断時にクリアする。 */
	private matchedPingTimer: ReturnType<typeof setInterval> | null = null;
	private gameConnections: Map<string, WebSocket> = new Map();
	/** 各対局接続の ping 用タイマー。切断時にクリアする。 */
	private gamePingTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
	private gameHandlers: Map<string, ReversiGameHandlers> = new Map();
	private onMatched: OnMatchedCallback;
	private maxGameConnections = 5;

	/**
	 * @param wsUrl - reversi-service の WebSocket URL（例: wss://example.com/api/reversi/stream）
	 * @param token - セッショントークン（?i= で付与）
	 * @param onMatched - matched 受信時のコールバック。true で対局用接続を開く
	 */
	constructor(wsUrl: string, token: string, onMatched: OnMatchedCallback) {
		this.wsUrl = wsUrl;
		this.token = token;
		this.onMatched = onMatched;
	}

	/**
	 * matched 用の 1 本を接続し、channel 'reversi' に加入する
	 * @internal
	 */
	connect() {
		if (this.matchedWs != null) return;
		const url = `${this.wsUrl}${this.wsUrl.includes('?') ? '&' : '?'}i=${encodeURIComponent(this.token)}`;
		const ws = new WebSocket(url);
		this.matchedWs = ws;

		ws.on('open', () => {
			log('[reversi] matched connection open');
			// reversi-service は connect の body.id を必須としており、未送信だと接続を登録しない
			this.send(ws, { type: 'connect', body: { channel: 'reversi', id: 'reversi-matched' } });
			this.startMatchedPing();
		});

		ws.on('message', (data: Buffer) => {
			try {
				const msg = JSON.parse(data.toString());
				// syuilo/ai 互換: type === 'channel', body.type === 'matched', body.body または body に game
				if (msg.type === 'channel' && msg.body?.type === 'matched') {
					const payload = msg.body.body || msg.body;
					const game = payload?.game;
					log(`[reversi] matched received game.id=${game?.id ?? 'none'}`);
					const ok = this.onMatched(payload);
					if (ok) {
						if (game?.id) {
							log(`[reversi] matched accepted, opening game connection ${game.id}`);
							this.openGameConnection(game.id);
						}
					} else {
						log(`[reversi] matched rejected (busy or not in list)`);
					}
				}
			} catch (e) {
				log(`[reversi] matched message parse error: ${e}`);
			}
		});

		ws.on('close', () => {
			log('[reversi] matched connection closed, reconnecting...');
			this.stopMatchedPing();
			this.matchedWs = null;
			this.scheduleMatchedReconnect();
		});

		ws.on('error', (err) => {
			log(`[reversi] matched connection error: ${err}`);
		});
	}

	/** matched 用接続で定期的に ping を送り、アイドル切断を防ぐ */
	private startMatchedPing() {
		this.stopMatchedPing();
		this.matchedPingTimer = setInterval(() => {
			if (this.matchedWs?.readyState === WebSocket.OPEN) {
				this.matchedWs.ping();
			}
		}, PING_INTERVAL_MS);
	}

	private stopMatchedPing() {
		if (this.matchedPingTimer != null) {
			clearInterval(this.matchedPingTimer);
			this.matchedPingTimer = null;
		}
	}

	/** matched 用接続が切れたとき、5 秒後に再接続を試みる（二重登録防止あり） */
	private scheduleMatchedReconnect() {
		if (this.matchedWsReconnectTimer != null) return;
		this.matchedWsReconnectTimer = setTimeout(() => {
			this.matchedWsReconnectTimer = null;
			this.connect();
		}, 5000);
	}

	/** 対局用接続で定期的に ping を送り、アイドル切断を防ぐ */
	private startGamePing(gameId: string, ws: WebSocket) {
		this.stopGamePing(gameId);
		const timer = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.ping();
			}
		}, PING_INTERVAL_MS);
		this.gamePingTimers.set(gameId, timer);
	}

	private stopGamePing(gameId: string) {
		const timer = this.gamePingTimers.get(gameId);
		if (timer != null) {
			clearInterval(timer);
			this.gamePingTimers.delete(gameId);
		}
	}

	/**
	 * 対局用接続を 1 本開き、channel 'reversiGame' に加入する
	 * @param gameId - ゲーム ID
	 * @internal
	 */
	openGameConnection(gameId: string) {
		if (this.gameConnections.size >= this.maxGameConnections) return;
		if (this.gameConnections.has(gameId)) return;

		const url = `${this.wsUrl}${this.wsUrl.includes('?') ? '&' : '?'}i=${encodeURIComponent(this.token)}`;
		const ws = new WebSocket(url);
		this.gameConnections.set(gameId, ws);

		ws.on('open', () => {
			log(`[reversi] game ${gameId} connection open, sending connect`);
			// reversi-service は connect の body.id を必須としており、未送信だと接続を登録せず sync/started が届かない
			this.send(ws, { type: 'connect', body: { channel: 'reversiGame', id: gameId, params: { gameId } } });
			this.startGamePing(gameId, ws);
		});

		ws.on('message', (data: Buffer) => {
			try {
				const msg = JSON.parse(data.toString());
				const outerType = msg?.type;
				const innerType = msg?.body?.type;
				log(`[reversi] game ${gameId} message: type=${outerType} body.type=${innerType ?? 'n/a'}`);
				if (msg.type !== 'channel' || !msg.body) {
					log(`[reversi] game ${gameId} skip (need type=channel and body)`);
					return;
				}
				const body = msg.body.body ?? msg.body;
				const ev = msg.body.type as ReversiGameMessageType;
				const handlers = this.gameHandlers.get(gameId);
				if (handlers) {
					if (ev === 'started') handlers.onStarted(body);
					else if (ev === 'log') handlers.onLog(body);
					else if (ev === 'ended') handlers.onEnded(body);
					else if (ev === 'sync') handlers.onSync(body);
					else {
						log(`[reversi] game ${gameId} unhandled event: ${ev}`);
					}
				} else {
					log(`[reversi] game ${gameId} no handlers for ${ev}`);
				}
			} catch (e) {
				log(`[reversi] game ${gameId} message error: ${e}`);
			}
		});

		ws.on('close', () => {
			log(`[reversi] game ${gameId} connection closed`);
			this.stopGamePing(gameId);
			this.gameConnections.delete(gameId);
			this.gameHandlers.delete(gameId);
			// 再接続は sync で復帰する前提のため、ended で閉じる場合は呼び出し元が closeGame する
		});

		ws.on('error', (err) => {
			log(`[reversi] game ${gameId} error: ${err}`);
		});
	}

	/**
	 * 対局用接続にハンドラを登録する（openGameConnection の直後などに呼ぶ）
	 * @param gameId - ゲーム ID
	 * @param handlers - イベントハンドラ
	 * @internal
	 */
	setGameHandlers(gameId: string, handlers: ReversiGameHandlers) {
		this.gameHandlers.set(gameId, handlers);
	}

	/**
	 * 対局用接続に putStone を送信する
	 * @param gameId - ゲーム ID
	 * @param pos - 石を置く位置
	 * @param id - 石の ID（reversi-service の形式に合わせる）
	 * @internal
	 */
	sendPutStone(gameId: string, pos: number, id?: string) {
		const ws = this.gameConnections.get(gameId);
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			log(`[reversi] putStone skipped game ${gameId} pos=${pos}: ws not open`);
			return;
		}
		// reversi-service は putStone の body.id を文字列で必須としている
		const bodyId = typeof id === 'string' ? id : `bot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		log(`[reversi] putStone sending game ${gameId} pos=${pos} id=${bodyId}`);
		this.send(ws, { type: 'putStone', body: { pos, id: bodyId } });
	}

	/**
	 * 対局用接続に ready を送信する
	 * @param gameId - ゲーム ID
	 * @param id - ready の ID（true など）
	 * @internal
	 */
	sendReady(gameId: string, id?: boolean) {
		const ws = this.gameConnections.get(gameId);
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			log(`[reversi] ready skipped game ${gameId}: ws not open`);
			return;
		}
		log(`[reversi] ready sending game ${gameId}`);
		this.send(ws, { type: 'ready', body: { id: id !== undefined ? id : true } });
	}

	/**
	 * 対局用接続を閉じる（ended 後など）
	 * @param gameId - ゲーム ID
	 * @internal
	 */
	closeGame(gameId: string) {
		this.stopGamePing(gameId);
		const ws = this.gameConnections.get(gameId);
		if (ws) {
			this.gameConnections.delete(gameId);
			this.gameHandlers.delete(gameId);
			try { ws.close(); } catch (_) {}
		}
	}

	/**
	 * 現在の対局用接続数を返す
	 * @internal
	 */
	getGameConnectionCount(): number {
		return this.gameConnections.size;
	}

	/** 接続が OPEN のときのみ JSON メッセージを送信する */
	private send(ws: WebSocket, msg: any) {
		if (ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify(msg));
	}

	/**
	 * 全接続を閉じる
	 * @internal
	 */
	disconnect() {
		if (this.matchedWsReconnectTimer != null) {
			clearTimeout(this.matchedWsReconnectTimer);
			this.matchedWsReconnectTimer = null;
		}
		this.stopMatchedPing();
		if (this.matchedWs != null) {
			try { this.matchedWs.close(); } catch (_) {}
			this.matchedWs = null;
		}
		for (const gameId of Array.from(this.gamePingTimers.keys())) {
			this.stopGamePing(gameId);
		}
		for (const [gameId, ws] of this.gameConnections) {
			try { ws.close(); } catch (_) {}
		}
		this.gameConnections.clear();
		this.gameHandlers.clear();
	}
}

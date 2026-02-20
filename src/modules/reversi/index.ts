/**
 * @packageDocumentation
 *
 * リバーシ（オセロ）対局モジュール（reversi-service 前提）
 *
 * @remarks
 * 対局は reversi-service にのみ接続する。Misskey のリバーシ機能には依存しない。
 * メンションで招待URLを作成し、招待を依頼した投稿へダイレクトで返信する。
 * 同時対局は最大 5 件。同一プレイヤーは 1 日 5 回まで・同時に 1 対局のみ（管理者は 1 日の対局制限なし）。
 * 終局時に勝敗（wins/losses）を Friend に記録し、相手が勝ち越しているときは単純モードで思考する。
 * 超単純・単純それぞれで、全ユーザー累計の勝数・負数・引き分け・投了・時間切れをモジュール永続データに記録する。
 *
 * @public
 */

import autobind from 'autobind-decorator';
import * as request from 'request-promise-native';
import Module from '@/module';
import serifs from '@/serifs';
import config from '@/config';
import Message from '@/message';
import Friend from '@/friend';
import getDate from '@/utils/get-date';
import log from '@/utils/log';
import { acct } from '@/utils/acct';
import { ReversiStreamClient } from './reversi-stream';
import { ReversiGameSession } from './back';
import type { User } from '@/misskey/user';

/**
 * 進行中ゲーム 1 件の永続データ
 *
 * @remarks
 * getData/setData でモジュール永続データに保存する配列の要素型。
 * 招待登録時に追加し、終局または時間切れで削除する。
 *
 * @internal
 */
interface ReversiGameEntry {
	/** reversi-service のゲーム ID */
	gameId: string;
	/** 招待URLからパースした inviteToken（将来の match 等に利用する場合は保持） */
	inviteToken: string;
	/** 招待を依頼したユーザー（対戦相手）の Misskey ユーザー ID */
	opponentUserId: string;
	/** 招待URLを返信した投稿のノート ID。終局・時間切れ時にここへダイレクト返信する */
	replyNoteId: string;
	/** 登録した時刻（ミリ秒）。デバッグや有効期限の参考用 */
	createdAt: number;
}

/**
 * 難易度ごとの全ユーザー累計成績（勝敗・引き分け・投了・時間切れ）
 *
 * @remarks
 * 超単純／単純それぞれで、全ユーザー累計の件数を保持する。
 *
 * @internal
 */
interface DifficultyStats {
	/** 藍が勝った数 */
	wins: number;
	/** 藍が負けた数 */
	losses: number;
	/** 引き分け数 */
	draws: number;
	/** 相手が投了した数 */
	surrendered: number;
	/** 時間切れで終了した数（対局中の時間切れ。招待期限切れは含まない） */
	timeout: number;
}

/**
 * モジュール永続データの型
 *
 * @remarks
 * {@link Module.getData} / {@link Module.setData} で扱う data の形。
 *
 * @internal
 */
interface ReversiModuleData {
	/** 進行中ゲーム一覧。最大 5 件まで。 */
	games?: ReversiGameEntry[];
	/** 初対局が完了した日時（ミリ秒）。段階的な開放条件の基準時刻として使う。 */
	firstGameCompletedAt?: number;
	/** 超単純モードの全ユーザー累計統計 */
	difficultyStatsSuperSimple?: DifficultyStats;
	/** 単純モードの全ユーザー累計統計 */
	difficultyStatsSimple?: DifficultyStats;
}

/** 難易度別統計のデフォルト値（未初期化時用） */
const DEFAULT_DIFFICULTY_STATS: DifficultyStats = {
	wins: 0,
	losses: 0,
	draws: 0,
	surrendered: 0,
	timeout: 0
};

/** 対局用ストリーム切断後の自動再接続を試みるまでの遅延（ミリ秒）。 */
const GAME_RECONNECT_DELAY_MS = 5000;

/**
 * リバーシモジュールクラス（reversi-service 前提）
 *
 * @remarks
 * 招待・matched 受信・対局セッション・終局・時間切れを管理する。
 * 思考は back の ReversiGameSession（超単純／単純モード）で同一プロセス内で実行する。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'reversi';

	/** reversi-service 用 WebSocket クライアント。有効時のみ非 null。 */
	private client: ReversiStreamClient | null = null;
	/** 対局ごとの ReversiGameSession。gameId → セッション。 */
	private gameSessions: Map<string, ReversiGameSession> = new Map();
	/** 対局用ストリーム切断後、再接続を予約している gameId → setTimeout の戻り値。 */
	private gameReconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

	/**
	 * リバーシ機能が有効かどうか
	 *
	 * @remarks
	 * 4 つすべて設定されているときのみ true（プラン通り）。
	 *
	 * @internal
	 */
	private get enabled(): boolean {
		return !!(config.reversiEnabled && config.reversiServiceWsUrl && config.reversiServiceApiUrl && config.reversiServiceToken);
	}

	/**
	 * 進行中ゲーム一覧を取得する
	 *
	 * @returns 永続データから取得したゲーム配列。未初期化時は空配列
	 * @internal
	 */
	private getGames(): ReversiGameEntry[] {
		const data = this.getData() as ReversiModuleData;
		return Array.isArray(data?.games) ? data.games : [];
	}

	/**
	 * 進行中ゲーム一覧を上書き保存する
	 *
	 * @param games - 新しい一覧（最大 5 件を呼び出し側で保証）
	 * @internal
	 */
	private setGames(games: ReversiGameEntry[]) {
		this.setData({ ...this.getData(), games });
	}

	/** 初対局完了時刻を取得する（未記録なら null）。 */
	private getFirstGameCompletedAt(): number | null {
		const data = this.getData() as ReversiModuleData;
		return typeof data?.firstGameCompletedAt === 'number' ? data.firstGameCompletedAt : null;
	}

	/** 初対局完了時刻を記録する。 */
	private setFirstGameCompletedAt(timestamp: number) {
		this.setData({ ...this.getData(), firstGameCompletedAt: timestamp });
	}

	/**
	 * 指定難易度の統計を取得する（未初期化時はゼロのオブジェクト）
	 *
	 * @param useSimpleMode - 単純モードなら true、超単純なら false
	 * @returns その難易度の全ユーザー累計統計
	 * @internal
	 */
	private getDifficultyStats(useSimpleMode: boolean): DifficultyStats {
		const data = this.getData() as ReversiModuleData;
		const key = useSimpleMode ? 'difficultyStatsSimple' : 'difficultyStatsSuperSimple';
		const raw = data?.[key];
		if (raw && typeof raw.wins === 'number' && typeof raw.losses === 'number') {
			return {
				wins: raw.wins ?? 0,
				losses: raw.losses ?? 0,
				draws: raw.draws ?? 0,
				surrendered: raw.surrendered ?? 0,
				timeout: raw.timeout ?? 0
			};
		}
		return { ...DEFAULT_DIFFICULTY_STATS };
	}

	/**
	 * 指定難易度の統計のいずれか 1 つを 1 加算して永続化する
	 *
	 * @param useSimpleMode - 単純モードなら true、超単純なら false
	 * @param key - 加算する項目（wins / losses / draws / surrendered / timeout）
	 * @internal
	 */
	private incrementDifficultyStat(useSimpleMode: boolean, key: keyof DifficultyStats) {
		const data = this.getData() as ReversiModuleData;
		const statKey = useSimpleMode ? 'difficultyStatsSimple' : 'difficultyStatsSuperSimple';
		const current = this.getDifficultyStats(useSimpleMode);
		current[key] += 1;
		this.setData({ ...data, [statKey]: current });
	}

	/** 機能開放初期の管理者判定。 */
	private isReversiAdmin(msg: Message): boolean {
		if ((msg.user as any)?.isAdmin === true) return true;
		return !msg.user.host && config.master != null && msg.user.username === config.master;
	}

	/** 初対局完了後の現在必要親愛度を計算する。 */
	private calcRequiredLove(firstGameCompletedAt: number, now: number = Date.now()): number {
		const dayMs = 24 * 60 * 60 * 1000;
		const fixedDaysMs = 7 * dayMs;
		const elapsed = now - firstGameCompletedAt;
		if (elapsed < fixedDaysMs) return 200;
		const daysAfterFixedWindow = Math.floor((elapsed - fixedDaysMs) / dayMs) + 1;
		return Math.max(0, 200 - daysAfterFixedWindow * (100 / 7));
	}

	/** 現在の好感度で対局可能になるまでの日数を計算する。 */
	private calcDaysUntilPlayable(firstGameCompletedAt: number, currentLove: number): number {
		const dayMs = 24 * 60 * 60 * 1000;
		const now = Date.now();
		for (let days = 1; days <= 365; days++) {
			const requiredLove = this.calcRequiredLove(firstGameCompletedAt, now + days * dayMs);
			if (currentLove > requiredLove) return days;
		}
		return 365;
	}

	/**
	 * 指定 gameId（UUID）のゲームが一覧に存在するか検索する
	 *
	 * @param gameId - reversi-service のゲーム ID（UUID）。タイマー・招待レスポンスの識別用
	 * @returns 見つかればそのエントリ、なければ undefined
	 * @internal
	 */
	private findGame(gameId: string): ReversiGameEntry | undefined {
		return this.getGames().find(g => g.gameId === gameId);
	}

	/**
	 * 指定 inviteToken のゲームが一覧に存在するか検索する
	 *
	 * @param inviteToken - 招待URLに含まれるトークン。reversi-service の matched では game.id がこれになる
	 * @returns 見つかればそのエントリ、なければ undefined
	 * @internal
	 */
	private findGameByInviteToken(inviteToken: string): ReversiGameEntry | undefined {
		return this.getGames().find(g => g.inviteToken === inviteToken);
	}

	/**
	 * 進行中ゲーム一覧から指定ゲームを削除する
	 *
	 * @param gameIdOrInviteToken - 削除するゲームの gameId（UUID）または inviteToken。reversi-service の ended では game.id が inviteToken のため両方で削除可能にする
	 * @internal
	 */
	private removeGame(gameIdOrInviteToken: string) {
		this.setGames(this.getGames().filter(g => g.gameId !== gameIdOrInviteToken && g.inviteToken !== gameIdOrInviteToken));
	}

	/**
	 * 対局用ストリームが意図せず切断されたときに呼ばれ、遅延後に再接続を試みる
	 *
	 * @param gameId - 切断されたゲームの inviteToken（reversi-service の game.id）
	 *
	 * @remarks
	 * 進行中一覧に残っておりセッションがまだある場合のみ、GAME_RECONNECT_DELAY_MS 後に
	 * openGameConnection と setGameHandlers で再接続する。再接続後はサーバーが sync を送り状態が復帰する。
	 *
	 * @internal
	 */
	@autobind
	private scheduleGameReconnect(gameId: string) {
		this.cancelGameReconnect(gameId);
		const entry = this.findGameByInviteToken(gameId);
		if (!entry || !this.gameSessions.has(gameId) || !this.client) return;
		if (this.client.getGameConnectionCount() >= 5) {
			log(`[reversi] scheduleGameReconnect: skip game ${gameId.slice(0, 8)}... (already 5 connections)`);
			return;
		}
		log(`[reversi] scheduleGameReconnect: will reconnect game ${gameId.slice(0, 8)}... in ${GAME_RECONNECT_DELAY_MS}ms`);
		const timer = setTimeout(() => {
			this.gameReconnectTimers.delete(gameId);
			if (!this.client) return;
			const session = this.gameSessions.get(gameId);
			const stillInList = this.getGames().some(g => g.inviteToken === gameId);
			if (!session || !stillInList) {
				log(`[reversi] scheduleGameReconnect: game ${gameId.slice(0, 8)}... no longer ongoing, skip`);
				return;
			}
			if (this.client.getGameConnectionCount() >= 5) {
				log(`[reversi] scheduleGameReconnect: game ${gameId.slice(0, 8)}... skip (already 5 connections)`);
				return;
			}
			this.client.openGameConnection(gameId);
			this.client.setGameHandlers(gameId, {
				onStarted: (b) => session.onStarted(b),
				onLog: (b) => session.onLog(b),
				onEnded: (b) => session.onEnded(b),
				onSync: (b) => session.onSync(b)
			});
			log(`[reversi] scheduleGameReconnect: reconnected game ${gameId.slice(0, 8)}...`);
		}, GAME_RECONNECT_DELAY_MS);
		this.gameReconnectTimers.set(gameId, timer);
	}

	/**
	 * 指定ゲームの再接続予約をキャンセルする（終局時に呼ぶ）
	 *
	 * @param gameId - ゲームの inviteToken
	 * @internal
	 */
	private cancelGameReconnect(gameId: string) {
		const timer = this.gameReconnectTimers.get(gameId);
		if (timer != null) {
			clearTimeout(timer);
			this.gameReconnectTimers.delete(gameId);
		}
	}

	/**
	 * 永続化されている進行中ゲームに対して reversiGame 接続を開き、sync で状態復帰・手番なら思考する
	 *
	 * @remarks
	 * Bot 再起動時に install() から呼ぶ。接続後サーバーが sync（必要に応じ started）を送り、
	 * back の onSync で盤面・手番を復元し、自分のターンなら自動で思考を開始する。
	 *
	 * @internal
	 */
	private reopenOngoingGames() {
		if (!this.client) return;
		const games = this.getGames();
		log(`[reversi] reopenOngoingGames: ${games.length} game(s) in list`);
		for (const entry of games) {
			if (this.client.getGameConnectionCount() >= 5) {
				log(`[reversi] reopenOngoingGames: skip (already 5 connections)`);
				break;
			}
			const inviteToken = entry.inviteToken;
			if (this.gameSessions.has(inviteToken)) continue;
			log(`[reversi] reopenOngoingGames: opening connection inviteToken=${inviteToken.slice(0, 8)}...`);

			const sendPutStone = (pos: number) => {
				this.client!.sendPutStone(inviteToken, pos);
			};
			const sendReady = () => {
				this.client!.sendReady(inviteToken, true);
			};
		const onEnded = (resultType: string, opponentUser: User | null, winnerId: string | null, useSimpleMode: boolean, stoneDiff?: number) => {
			this.onGameEnded(inviteToken, entry.opponentUserId, entry.replyNoteId, resultType, opponentUser, winnerId, useSimpleMode, stoneDiff);
			this.cancelGameReconnect(inviteToken);
			this.client!.closeGame(inviteToken);
			this.gameSessions.delete(inviteToken);
		};
			const gameUrl = config.reversiServiceApiUrl
				? `${config.reversiServiceApiUrl}/game/${encodeURIComponent(inviteToken)}`
				: '';
			const opponentReversi = this.ai.lookupFriend(entry.opponentUserId)?.getPerModulesData(this)
				?.reversi as { wins?: number; losses?: number } | undefined;
			const useSimpleMode = (opponentReversi?.wins ?? 0) > (opponentReversi?.losses ?? 0);
			const session = new ReversiGameSession(
				inviteToken,
				this.ai.account,
				sendPutStone,
				sendReady,
				onEnded,
				gameUrl,
				useSimpleMode
			);
			this.gameSessions.set(inviteToken, session);
			this.client.setGameHandlers(inviteToken, {
				onStarted: (b) => session.onStarted(b),
				onLog: (b) => session.onLog(b),
				onEnded: (b) => session.onEnded(b),
				onSync: (b) => session.onSync(b)
			});
			this.client.openGameConnection(inviteToken);
		}
	}

	/**
	 * モジュールをインストールし、reversi 専用クライアントを起動する
	 *
	 * @returns 有効時は mentionHook と timeoutCallback を返す。無効時は空オブジェクト
	 *
	 * @remarks
	 * 起動時に永続化されている進行中ゲームへ reversiGame 接続を張り直し、sync で復帰する。
	 *
	 * @internal
	 */
	@autobind
	public install() {
		if (!this.enabled) return {};

		const token = (config.reversiServiceToken ?? '').trim();
		this.client = new ReversiStreamClient(
			config.reversiServiceWsUrl!,
			token,
			(body: { game: any }) => this.onMatched(body),
			{ onGameConnectionClosed: (gameId) => this.scheduleGameReconnect(gameId) }
		);
		log('[reversi] install: connecting and reopening ongoing games');
		this.client.connect();
		this.reopenOngoingGames();

		return {
			mentionHook: this.mentionHook,
			timeoutCallback: this.timeoutCallback
		};
	}

	/**
	 * matched 受信時の処理。対局用接続を開くかどうかを返す
	 *
	 * @param body - ストリームの matched メッセージ body（game を含む）
	 * @returns 対局用接続を開くなら true。5 件以上または一覧に無い game なら false
	 *
	 * @remarks
	 * 5 件以上のとき、該当する招待依頼者がいれば「忙しいから」とダイレクト返信してから false を返す。
	 * 一覧に game が無い（招待していない game の matched）場合は何もせず false。
	 * reversi-service の matched では body.game.id が inviteToken のため、inviteToken で一覧を検索する。
	 * 対戦相手の勝敗（wins > losses）なら単純モードをセッションに渡し、それ以外は超単純モード。
	 *
	 * @internal
	 */
	@autobind
	private onMatched(body: { game: any }): boolean {
		const game = body?.game;
		if (!game?.id) return false;
		const games = this.getGames();
		// 同時対局が上限のときは、この game の招待依頼者に「忙しい」と返信してから拒否
		if (games.length >= 5) {
			const entry = games.find(g => g.inviteToken === game.id);
			if (entry) {
				this.ai.post({
					replyId: entry.replyNoteId,
					text: serifs.reversi.busy,
					visibility: 'specified',
					visibleUserIds: [entry.opponentUserId]
				}).catch(() => {});
			}
			return false;
		}
		// 私たちが招待した game のみ受け付ける（一覧に無い matched は無視）。reversi-service の game.id は inviteToken
		const entry = this.findGameByInviteToken(game.id);
		if (!entry) return false;

		const sendPutStone = (pos: number) => {
			this.client!.sendPutStone(game.id, pos);
		};
		const sendReady = () => {
			this.client!.sendReady(game.id, true);
		};
		// 対戦相手の勝敗記録から難易度を決める（勝ち越しなら単純モード）
		const opponentReversi = this.ai.lookupFriend(entry.opponentUserId)?.getPerModulesData(this)
			?.reversi as { wins?: number; losses?: number } | undefined;
		const useSimpleMode =
			(opponentReversi?.wins ?? 0) > (opponentReversi?.losses ?? 0);

		// 終局時は結果種別・対戦相手・勝者 ID ・難易度・石差を渡し、index 側で本文と wins/losses・連勝・難易度別統計を更新する
		const onEnded = (resultType: string, opponentUser: User | null, winnerId: string | null, useSimpleMode: boolean, stoneDiff?: number) => {
			this.onGameEnded(game.id, entry.opponentUserId, entry.replyNoteId, resultType, opponentUser, winnerId, useSimpleMode, stoneDiff);
			this.cancelGameReconnect(game.id);
			this.client!.closeGame(game.id);
			this.gameSessions.delete(game.id);
		};
		const gameUrl = config.reversiServiceApiUrl ? `${config.reversiServiceApiUrl}/game/${encodeURIComponent(game.id)}` : '';
		const session = new ReversiGameSession(
			game.id,
			this.ai.account,
			sendPutStone,
			sendReady,
			onEnded,
			gameUrl,
			useSimpleMode
		);
		this.gameSessions.set(game.id, session);
		this.client!.setGameHandlers(game.id, {
			onStarted: (b) => session.onStarted(b),
			onLog: (b) => session.onLog(b),
			onEnded: (b) => session.onEnded(b),
			onSync: (b) => session.onSync(b)
		});
		return true;
	}

	/**
	 * メンション受信時のフック。リバーシのキーワードなら招待処理または断りを返す
	 *
	 * @param msg - 受信メッセージ
	 * @returns リバーシ系キーワードにマッチした場合は true（他モジュールに流さない）
	 *
	 * @remarks
	 * チェック順: 無効 → 5 件以上 → 同一プレイヤー進行中 → 同一プレイヤー 5 回/日 → invite/create 呼び出し。
	 *
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.includes(['リバーシ', 'オセロ', 'reversi', 'othello'])) return false;
		if (!this.enabled) {
			msg.reply(serifs.reversi.decline, { visibility: 'specified' });
			return { reaction: ':mk_hotchicken:' };
		}

		const firstGameCompletedAt = this.getFirstGameCompletedAt();
		// ローカルユーザーには好感度制限を適用しない（msg.user.host が無い = ローカル）
		const applyLoveRestriction = msg.user.host && !this.isReversiAdmin(msg);
		if (firstGameCompletedAt == null) {
			if (applyLoveRestriction) {
				if (msg.friend.love >= 200) {
					msg.reply(serifs.reversi.notAvailableWithWait, { visibility: 'specified' });
				} else {
					msg.reply(serifs.reversi.notAvailableAboutOneWeek, { visibility: 'specified' });
				}
				return { reaction: ':mk_hotchicken:' };
			}
		} else if (applyLoveRestriction) {
			const requiredLove = this.calcRequiredLove(firstGameCompletedAt);
			const currentLove = msg.friend.love;
			if (currentLove <= requiredLove) {
				const days = this.calcDaysUntilPlayable(firstGameCompletedAt, currentLove);
				msg.reply(serifs.reversi.notAvailableInDays(days), { visibility: 'specified' });
				return { reaction: ':mk_hotchicken:' };
			}
		}

		const games = this.getGames();
		if (games.length >= 5) {
			msg.reply(serifs.reversi.busy, { visibility: 'specified' });
			return { reaction: ':mk_hotchicken:' };
		}
		// 同じ相手がすでに 1 対局進行中なら新規招待しない。その対局のストリームに再接続する。
		const existingEntry = games.find(g => g.opponentUserId === msg.userId);
		if (existingEntry) {
			const gameUrl = config.reversiServiceApiUrl ? `${config.reversiServiceApiUrl}/game/${encodeURIComponent(existingEntry.inviteToken)}` : '';
			if (this.client) {
				const inviteToken = existingEntry.inviteToken;
				let session = this.gameSessions.get(inviteToken);
				if (session) {
					// セッションがある場合はハンドラを再登録して接続を開き直す（切断されていれば新規接続になる）
					this.client.openGameConnection(inviteToken);
					this.client.setGameHandlers(inviteToken, {
						onStarted: (b) => session!.onStarted(b),
						onLog: (b) => session!.onLog(b),
						onEnded: (b) => session!.onEnded(b),
						onSync: (b) => session!.onSync(b)
					});
					log(`[reversi] mentionHook: reconnected stream for existing game inviteToken=${inviteToken.slice(0, 8)}...`);
				} else if (this.client.getGameConnectionCount() < 5) {
					// セッションがない（例: 再起動後）場合は reopenOngoingGames と同様にセッションを作成して接続
					const sendPutStone = (pos: number) => this.client!.sendPutStone(inviteToken, pos);
					const sendReady = () => this.client!.sendReady(inviteToken, true);
					const onEnded = (resultType: string, opponentUser: User | null, winnerId: string | null, useSimpleMode: boolean, stoneDiff?: number) => {
						this.onGameEnded(inviteToken, existingEntry.opponentUserId, existingEntry.replyNoteId, resultType, opponentUser, winnerId, useSimpleMode, stoneDiff);
						this.cancelGameReconnect(inviteToken);
						this.client!.closeGame(inviteToken);
						this.gameSessions.delete(inviteToken);
					};
					const opponentReversi = this.ai.lookupFriend(existingEntry.opponentUserId)?.getPerModulesData(this)
						?.reversi as { wins?: number; losses?: number } | undefined;
					const useSimpleMode = (opponentReversi?.wins ?? 0) > (opponentReversi?.losses ?? 0);
					const newSession = new ReversiGameSession(
						inviteToken,
						this.ai.account,
						sendPutStone,
						sendReady,
						onEnded,
						gameUrl,
						useSimpleMode
					);
					this.gameSessions.set(inviteToken, newSession);
					this.client.setGameHandlers(inviteToken, {
						onStarted: (b) => newSession.onStarted(b),
						onLog: (b) => newSession.onLog(b),
						onEnded: (b) => newSession.onEnded(b),
						onSync: (b) => newSession.onSync(b)
					});
					this.client.openGameConnection(inviteToken);
					log(`[reversi] mentionHook: created session and opened stream for existing game inviteToken=${inviteToken.slice(0, 8)}...`);
				}
			}
			msg.reply(serifs.reversi.alreadyPlaying(gameUrl), { visibility: 'specified' });
			return { reaction: ':mk_hotchicken:' };
		}

		const friend = this.ai.lookupFriend(msg.userId);
		// 管理者は 1 日の対局制限を適用しない
		if (friend && !this.isReversiAdmin(msg)) {
			const data = friend.getPerModulesData(this);
			if (!data.reversi) data.reversi = {};
			const r = data.reversi as { lastReversiDate?: string; gamesPlayedToday?: number };
			const today = getDate();
			// 日付が変わっていたら今日の対局数をリセット
			if (r.lastReversiDate !== today) {
				r.lastReversiDate = today;
				r.gamesPlayedToday = 0;
			}
			if ((r.gamesPlayedToday ?? 0) >= 5) {
				msg.reply(serifs.reversi.limitPerDay, { visibility: 'specified' });
				return { reaction: ':mk_hotchicken:' };
			}
		}

		try {
			// reversi-service は Cookie の session または Authorization: Bearer で認証。トークンは reversi-service の MiAuth ログイン後にブラウザの session Cookie の値（Misskey の check で得たトークンではない）
			const token = (config.reversiServiceToken ?? '').trim();
			if (!token) {
				this.log('reversiServiceToken が未設定または空です。reversi-service の MiAuth ログイン後、ブラウザの session Cookie の値を設定してください。');
			}
			const res = await request.post({
				url: `${config.reversiServiceApiUrl}/api/reversi/invite/create`,
				headers: { Authorization: `Bearer ${token}` },
				json: true,
				body: { hostMisskeyUserId: this.ai.account.id, inviteeMisskeyUserId: msg.userId }
			});
			const inviteUrl = res?.inviteUrl ?? res?.url;
			const gameId = res?.gameId ?? res?.game?.id;
			if (!inviteUrl || !gameId) {
				msg.reply(serifs.reversi.decline, { visibility: 'specified' });
				return { reaction: ':mk_hotchicken:' };
			}
			// 招待URLから inviteToken を保持。reversi-service はパス形式（/game/:inviteId）を返す。旧形式のクエリ ?invite= / ?inviteToken= も互換で受け付ける
			const pathMatch = String(inviteUrl).match(/\/game\/([^/?#]+)/);
			const queryMatch = String(inviteUrl).match(/[?&](?:inviteToken|invite)=([^&]+)/);
			const inviteToken = (pathMatch?.[1] ?? (queryMatch ? decodeURIComponent(queryMatch[1]) : '')) || '';

			this.setGames([
				...this.getGames(),
				{ gameId, inviteToken, opponentUserId: msg.userId, replyNoteId: msg.id, createdAt: Date.now() }
			]);
			this.setTimeoutWithPersistence(60 * 60 * 1000, { gameId, opponentUserId: msg.userId, replyNoteId: msg.id });

			await msg.reply(serifs.reversi.ok(inviteUrl), { visibility: 'specified' });
			return { reaction: 'love' };
		} catch (e: any) {
			const statusCode = e?.statusCode ?? e?.response?.statusCode;
			const body = e?.error ?? e?.response?.body;
			const is401 = statusCode === 401 || (body && (body as any).error?.code === 'FORBIDDEN_HOST_ONLY');
			if (is401) {
				this.log(
					'reversi-service が Login required を返しました。reversiServiceToken には reversi-service の MiAuth ログイン後にブラウザに設定される「session」Cookie の値を使用してください。Misskey の /api/miauth/xxx/check で得たトークンは使用できません。手順: reversi-service の MiAuth をブラウザで完了 → 開発者ツール → Application → Cookies → session の値をコピー → config の reversiServiceToken に設定'
				);
			}
			this.log(`invite/create error: ${e?.message ?? e}`);
			msg.reply(serifs.reversi.decline, { visibility: 'specified' });
		}
		return { reaction: ':mk_hotchicken:' };
	}

	/**
	 * 永続タイマー発火時のコールバック。招待 1 時間時間切れの処理
	 *
	 * @param data - setTimeoutWithPersistence に渡したデータ（gameId, opponentUserId, replyNoteId）
	 *
	 * @remarks
	 * ゲーム一覧にまだ gameId が残っている場合のみ処理（既に終局で削除済みなら何もしない）。
	 * 対戦相手の今日の対局数 +1、招待依頼投稿へダイレクト返信で時間切れを通知、一覧から削除。
	 *
	 * @internal
	 */
	@autobind
	private async timeoutCallback(data: { gameId?: string; opponentUserId?: string; replyNoteId?: string }) {
		if (!data?.gameId) return;
		const entry = this.findGame(data.gameId);
		if (!entry) return; // 既に終局等で削除済み

		const friend = this.ai.lookupFriend(entry.opponentUserId);
		if (friend) {
			const d = friend.getPerModulesData(this);
			if (!d.reversi) d.reversi = {};
			const r = d.reversi as { lastReversiDate?: string; gamesPlayedToday?: number };
			const today = getDate();
			if (r.lastReversiDate !== today) {
				r.lastReversiDate = today;
				r.gamesPlayedToday = 0;
			}
			r.gamesPlayedToday = (r.gamesPlayedToday ?? 0) + 1;
			friend.setPerModulesData(this, d);
		}

		try {
			await this.ai.post({
				replyId: entry.replyNoteId,
				text: serifs.reversi.inviteExpired,
				visibility: 'specified',
				visibleUserIds: [entry.opponentUserId]
			});
		} catch (_) {}
		this.removeGame(data.gameId);
	}

	/**
	 * 終局時の処理。親愛度（同一相手 1 日 1 回のみ）・今日の対局数・勝敗記録・結果投稿・一覧から削除
	 *
	 * @param gameId - 終了したゲーム ID
	 * @param opponentUserId - 対戦相手（招待依頼者）のユーザー ID
	 * @param replyNoteId - 結果を返信する先のノート ID
	 * @param resultType - 結果種別（'iWon' | 'iLose' | 'drawn' | 'youSurrendered' | 'timeout' | 'decline'）
	 * @param opponentUser - 対戦相手の User（decline 時は null）。表示名・@acct 用
	 * @param winnerId - 勝者のユーザー ID。引き分け・投了・時間切れ時は null
	 * @param useSimpleMode - 単純モードで対局したか。難易度別統計の加算に使用。decline 等の場合は undefined 可
	 * @param stoneDiff - 石差（iWon/iLose のときのみ。引き分け・投了・時間切れでは不要）
	 *
	 * @remarks
	 * 結果本文はニックネーム（または「あなた」）と @acct を使用し、プロフィールリンクは付けない。
	 * 勝敗時は「リバーシでn石差で」を付与。2連勝以上で負けたときは「これであなたがn連勝です！」を「次は負けません！」の前に挿入。
	 * 結果は公開範囲「ホーム」で返信し、reversiServiceApiUrl が設定されている場合は [対局結果ページ](URL) を付与。
	 * incLove(0.2, 'reversi') で実効 +1。lastPlayedAt が今日と一致する場合は加算しない。
	 * 勝敗: 相手が勝ったときのみ reversi.wins +1、それ以外（自分勝ち・引き分け・投了）は reversi.losses +1。
	 * 難易度別統計: useSimpleMode が渡されたとき、超単純/単純の該当項目（勝・負・引き分け・投了・時間切れ）を 1 加算する。
	 *
	 * @internal
	 */
	private async onGameEnded(
		gameId: string,
		opponentUserId: string,
		replyNoteId: string,
		resultType: string,
		opponentUser: User | null,
		winnerId: string | null,
		useSimpleMode?: boolean,
		stoneDiff?: number
	) {
		if (this.getFirstGameCompletedAt() == null) {
			this.setFirstGameCompletedAt(Date.now());
		}

		// 難易度別の全ユーザー累計統計（超単純・単純それぞれで勝敗・引き分け・投了・時間切れを記録）
		if (typeof useSimpleMode === 'boolean') {
			const statKey: keyof DifficultyStats | null =
				resultType === 'iWon' ? 'wins' :
				resultType === 'iLose' ? 'losses' :
				resultType === 'drawn' ? 'draws' :
				resultType === 'youSurrendered' ? 'surrendered' :
				resultType === 'timeout' ? 'timeout' : null;
			if (statKey !== null) {
				this.incrementDifficultyStat(useSimpleMode, statKey);
			}
		}

		const friend = this.ai.lookupFriend(opponentUserId);
		if (friend) {
			const today = getDate();
			const d = friend.getPerModulesData(this);
			if (!d.reversi) d.reversi = {};
			const r = d.reversi as {
				lastReversiDate?: string;
				gamesPlayedToday?: number;
				lastPlayedAt?: string;
				wins?: number;
				losses?: number;
				/** 現在の連勝数。引き分けは増えず切れず、負け・投了・時間切れで0にリセット */
				currentStreak?: number;
				/** 最高連勝数 */
				maxStreak?: number;
			};
			if (r.lastReversiDate !== today) {
				r.lastReversiDate = today;
				r.gamesPlayedToday = 0;
			}
			r.gamesPlayedToday = (r.gamesPlayedToday ?? 0) + 1;
			// 相手が勝ったときのみ wins、それ以外（自分勝ち・引き分け・投了）は losses
			if (winnerId === opponentUserId) {
				r.wins = (r.wins ?? 0) + 1;
				r.currentStreak = (r.currentStreak ?? 0) + 1;
				r.maxStreak = Math.max(r.maxStreak ?? 0, r.currentStreak);
			} else {
				r.losses = (r.losses ?? 0) + 1;
				// 引き分けは連勝を変更しない。負け・投了・時間切れで連勝を切る
				if (resultType !== 'drawn') {
					r.currentStreak = 0;
				}
			}
			const wasPlayedToday = r.lastPlayedAt === today;
			if (!wasPlayedToday) r.lastPlayedAt = today;
			friend.setPerModulesData(this, d);
			if (!wasPlayedToday) friend.incLove(0.2, 'reversi');
		}

		// 返信する場合は返信先（招待依頼者）のユーザが取得できるときのみ。friend が無いなどで取れない場合は返信をスキップする
		let resultText: string | null = null;
		if (resultType === 'decline') {
			resultText = serifs.reversi.decline;
		} else if (opponentUser) {
			const replyTargetUser = friend?.doc?.user;
			if (replyTargetUser?.username != null) {
				const name = friend?.name ?? 'あなた';
				const r = friend?.getPerModulesData(this)?.reversi as { currentStreak?: number } | undefined;
				const streak = r?.currentStreak;
				let body: string;
				if (resultType === 'iWon') {
					body = serifs.reversi.iWon(name, stoneDiff);
				} else if (resultType === 'iLose') {
					body = serifs.reversi.iLose(name, stoneDiff, streak);
				} else {
					const fn = (serifs.reversi as any)[resultType];
					body = typeof fn === 'function' ? fn(name) : serifs.reversi.iWon(name);
				}
				resultText = `${acct(replyTargetUser)} ${body}`;
			}
		} else {
			resultText = serifs.reversi.decline;
		}

		if (resultText !== null) {
			try {
				// 対局結果ページのリンクを付与。gameId は reversi-service では inviteToken と同一
				const inviteUrl = config.reversiServiceApiUrl
					? `${config.reversiServiceApiUrl}/game/${encodeURIComponent(gameId)}`
					: '';
				const textWithUrl = inviteUrl
					? `${resultText}\n\n?[対局結果ページ](${inviteUrl})`
					: resultText;
				await this.ai.post({
					replyId: replyNoteId,
					text: textWithUrl,
					visibility: 'home'
				});
			} catch (_) {}
		}
		this.removeGame(gameId);
	}
}

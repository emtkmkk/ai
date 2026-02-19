/**
 * @packageDocumentation
 *
 * リバーシ（オセロ）対局モジュール（reversi-service 前提）
 *
 * @remarks
 * 対局は reversi-service にのみ接続する。Misskey のリバーシ機能には依存しない。
 * メンションで招待URLを作成し、招待を依頼した投稿へダイレクトで返信する。
 * 同時対局は最大 5 件。同一プレイヤーは 1 日 3 回まで・同時に 1 対局のみ。
 * 終局時に勝敗（wins/losses）を Friend に記録し、相手が勝ち越しているときは単純モードで思考する。
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
import { ReversiStreamClient } from './reversi-stream';
import { ReversiGameSession } from './back';

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
}

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
	 * 指定 gameId のゲームが一覧に存在するか検索する
	 *
	 * @param gameId - reversi-service のゲーム ID
	 * @returns 見つかればそのエントリ、なければ undefined
	 * @internal
	 */
	private findGame(gameId: string): ReversiGameEntry | undefined {
		return this.getGames().find(g => g.gameId === gameId);
	}

	/**
	 * 進行中ゲーム一覧から指定 gameId を削除する
	 *
	 * @param gameId - 削除するゲーム ID
	 * @internal
	 */
	private removeGame(gameId: string) {
		this.setGames(this.getGames().filter(g => g.gameId !== gameId));
	}

	/**
	 * モジュールをインストールし、reversi 専用クライアントを起動する
	 *
	 * @returns 有効時は mentionHook と timeoutCallback を返す。無効時は空オブジェクト
	 * @internal
	 */
	@autobind
	public install() {
		if (!this.enabled) return {};

		this.client = new ReversiStreamClient(
			config.reversiServiceWsUrl!,
			config.reversiServiceToken!,
			(body: { game: any }) => this.onMatched(body)
		);
		this.client.connect();

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
	 * 一覧に gameId が無い（招待していない game の matched）場合は何もせず false。
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
			const entry = games.find(g => g.gameId === game.id);
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
		// 私たちが招待した game のみ受け付ける（一覧に無い matched は無視）
		const entry = this.findGame(game.id);
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

		// 終局時は結果テキストと勝者 ID を渡し、index 側で wins/losses を更新する
		const onEnded = (resultText: string, winnerId: string | null) => {
			this.onGameEnded(game.id, entry.opponentUserId, entry.replyNoteId, resultText, winnerId);
			this.client!.closeGame(game.id);
			this.gameSessions.delete(game.id);
		};
		const gameUrl = config.reversiServiceApiUrl ? `${config.reversiServiceApiUrl}/game/${game.id}` : '';
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
	 * チェック順: 無効 → 5 件以上 → 同一プレイヤー進行中 → 同一プレイヤー 3 回/日 → invite/create 呼び出し。
	 *
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.includes(['リバーシ', 'オセロ', 'reversi', 'othello'])) return false;
		if (!this.enabled) {
			msg.reply(serifs.reversi.decline, { visibility: 'specified' });
			return true;
		}

		const firstGameCompletedAt = this.getFirstGameCompletedAt();
		if (firstGameCompletedAt == null) {
			if (!this.isReversiAdmin(msg)) {
				if (msg.friend.love >= 200) {
					msg.reply(serifs.reversi.notAvailableWithWait, { visibility: 'specified' });
				} else {
					msg.reply(serifs.reversi.notAvailableAboutOneWeek, { visibility: 'specified' });
				}
				return true;
			}
		} else {
			const requiredLove = this.calcRequiredLove(firstGameCompletedAt);
			const currentLove = msg.friend.love;
			if (currentLove <= requiredLove) {
				const days = this.calcDaysUntilPlayable(firstGameCompletedAt, currentLove);
				msg.reply(serifs.reversi.notAvailableInDays(days), { visibility: 'specified' });
				return true;
			}
		}

		const games = this.getGames();
		if (games.length >= 5) {
			msg.reply(serifs.reversi.busy, { visibility: 'specified' });
			return true;
		}
		// 同じ相手がすでに 1 対局進行中なら新規招待しない
		const existingEntry = games.find(g => g.opponentUserId === msg.userId);
		if (existingEntry) {
			const gameUrl = config.reversiServiceApiUrl ? `${config.reversiServiceApiUrl}/game/${existingEntry.gameId}` : '';
			msg.reply(serifs.reversi.alreadyPlaying(gameUrl), { visibility: 'specified' });
			return true;
		}

		const friend = this.ai.lookupFriend(msg.userId);
		if (friend) {
			const data = friend.getPerModulesData(this);
			if (!data.reversi) data.reversi = {};
			const r = data.reversi as { lastReversiDate?: string; gamesPlayedToday?: number };
			const today = getDate();
			// 日付が変わっていたら今日の対局数をリセット
			if (r.lastReversiDate !== today) {
				r.lastReversiDate = today;
				r.gamesPlayedToday = 0;
			}
			if ((r.gamesPlayedToday ?? 0) >= 3) {
				msg.reply(serifs.reversi.limitPerDay, { visibility: 'specified' });
				return true;
			}
		}

		try {
			const res = await request.post({
				url: `${config.reversiServiceApiUrl}/invite/create`,
				headers: { Authorization: `Bearer ${config.reversiServiceToken}` },
				json: true,
				body: { hostMisskeyUserId: this.ai.account.id, inviteeMisskeyUserId: msg.userId }
			});
			const inviteUrl = res?.inviteUrl ?? res?.url;
			const gameId = res?.gameId ?? res?.game?.id;
			if (!inviteUrl || !gameId) {
				msg.reply(serifs.reversi.decline, { visibility: 'specified' });
				return true;
			}
			// 招待URLのクエリから inviteToken を保持（将来の拡張用）
			const m = inviteUrl.match(/[?&]inviteToken=([^&]+)/);
			const inviteToken = m ? m[1] : '';

			this.setGames([
				...this.getGames(),
				{ gameId, inviteToken, opponentUserId: msg.userId, replyNoteId: msg.id, createdAt: Date.now() }
			]);
			this.setTimeoutWithPersistence(60 * 60 * 1000, { gameId, opponentUserId: msg.userId, replyNoteId: msg.id });

			await msg.reply(serifs.reversi.ok(inviteUrl), { visibility: 'specified' });
		} catch (e) {
			this.log(`invite/create error: ${e}`);
			msg.reply(serifs.reversi.decline, { visibility: 'specified' });
		}
		return true;
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
	 * @param resultText - 投稿する結果テキスト（勝敗・投了・引き分けのセリフ）
	 * @param winnerId - 勝者のユーザー ID。引き分け・投了時は null
	 *
	 * @remarks
	 * incLove(0.2, 'reversi') で実効 +1。lastPlayedAt が今日と一致する場合は加算しない。
	 * 勝敗: 相手が勝ったときのみ reversi.wins +1、それ以外（自分勝ち・引き分け・投了）は reversi.losses +1。
	 *
	 * @internal
	 */
	private async onGameEnded(
		gameId: string,
		opponentUserId: string,
		replyNoteId: string,
		resultText: string,
		winnerId: string | null
	) {
		if (this.getFirstGameCompletedAt() == null) {
			this.setFirstGameCompletedAt(Date.now());
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
			};
			if (r.lastReversiDate !== today) {
				r.lastReversiDate = today;
				r.gamesPlayedToday = 0;
			}
			r.gamesPlayedToday = (r.gamesPlayedToday ?? 0) + 1;
			// 相手が勝ったときのみ wins、それ以外（自分勝ち・引き分け・投了）は losses
			if (winnerId === opponentUserId) {
				r.wins = (r.wins ?? 0) + 1;
			} else {
				r.losses = (r.losses ?? 0) + 1;
			}
			const wasPlayedToday = r.lastPlayedAt === today;
			if (!wasPlayedToday) r.lastPlayedAt = today;
			friend.setPerModulesData(this, d);
			if (!wasPlayedToday) friend.incLove(0.2, 'reversi');
		}

		try {
			await this.ai.post({
				replyId: replyNoteId,
				text: resultText,
				visibility: 'specified',
				visibleUserIds: [opponentUserId]
			});
		} catch (_) {}
		this.removeGame(gameId);
	}
}

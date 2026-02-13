/**
 * @packageDocumentation
 *
 * 数取りゲームモジュール
 *
 * ユーザーが数字を1つ選んで投票し、重複しない最大値（or 2番目/中央値）を選んだ
 * ユーザーが勝利するゲーム。レーティングシステムも搭載。
 *
 * @remarks
 * NOTE: 数取りの自動開催は18.5分間隔のポーリングで確率判定される。
 *       12時/17-23時は50%、それ以外は10%。1-7時は開催しない。
 * NOTE: 最大値は前回・前々回の参加者数の平均値をベースに計算される。
 * NOTE: 勝利条件は3種類: 最大値(通常)、2番目に大きい値、中央値。
 * NOTE: 3%の確率で最大値50〜500倍、2%で最大値1、3%で無限モードになる。
 * NOTE: 15%で反転モード（昇順で判定）になり、結果発表時に勝者が入れ替わる可能性がある。
 * NOTE: BAN機能により特定ユーザーを除外可能。
 * NOTE: 公開投稿限定モードでは、リプライ/引用にリアクションがないユーザーは除外される。
 * NOTE: レーティングは rate.ts で管理。初期レート1000、勝者は敗者からレートを吸収する。
 * NOTE: メダルシステム: 勝利数50超かつメダル戦で勝つとメダルを獲得。
 * NOTE: 4/1（エイプリルフール）は反転モードが追加で反転する。
 * NOTE: 1/1（元日）は最大値が年数になる。
 *
 * TODO: セリフ定義を serifs に移動する（一部がインラインで定義されている）
 *
 * @public
 */
import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import type { User } from '@/misskey/user';
import { acct } from '@/utils/acct';
import { genItem } from '@/vocabulary';
import config from '@/config';
import type { FriendDoc } from '@/friend';
import { ensureKazutoriData, findRateRank, hasKazutoriRateHistory } from './rate';
import type { EnsuredKazutoriData } from './rate';
var Decimal = require('break_infinity.js');

/**
 * 投票情報
 *
 * @internal
 */
type Vote = {
        /** 投票者のユーザー情報 */
	user: {
		id: string;
		username: string;
		host: User['host'];
                /** 数取りの累計勝利回数 */
		winCount: number;
	};
        /** 投票した数値（Decimal型: 巨大数対応） */
	number: typeof Decimal;
};

/**
 * ゲーム状態
 *
 * @remarks
 * LokiJS コレクションに保存されるゲーム1回分のデータ。
 *
 * @internal
 */
type Game = {
        /** 全投票情報 */
	votes: Vote[];
        /** ゲーム終了済みか */
	isEnded: boolean;
        /** 開始時刻（ミリ秒タイムスタンプ） */
	startedAt: number;
        /** 終了時刻（ミリ秒タイムスタンプ） */
	finishedAt: number;
        /** 勝利条件: 1=最大値, 2=2番目, -1=中央値 */
	winRank: number;
        /** 開催投稿のノートID */
	postId: string;
        /** 投票可能な最大数値（Decimal型） */
	maxnum: typeof Decimal;
        /** ゲーム開催をトリガーしたユーザーのID */
	triggerUserId: string | undefined;
        /** 公開投稿のみ受付けるモードか */
	publicOnly: boolean;
        /** リプライ購読キーのリスト */
        replyKey: string[];
        /** 投票受付時間（分） */
        limitMinutes: number;
        /** 勝者のユーザーID */
        winnerUserId?: string;
        /** 再集計実施時刻（ミリ秒タイムスタンプ） */
        reaggregatedAt?: number;
};

/**
 * 数取りゲームモジュールクラス
 *
 * @remarks
 * ゲームのライフサイクル:
 * 1. start(): ゲーム開始投稿
 * 2. contextHook(): 投票受付（リプライで数字を受ける）
 * 3. crawleGameEnd(): 制限時間チェック（1秒間隔）
 * 4. finish(): 結果集計・レーティング更新・結果発表
 *
 * @public
 */
export default class extends Module {
        public readonly name = 'kazutori';

        /** ゲーム情報コレクション */
        private games: loki.Collection<Game>;
        /** 定時リノート重複防止用 */
        private lastHourlyRenote: { key: string; postId: string } | null = null;


        /**
         * ユーザーがBAN対象かどうかを判定する
         *
         * @remarks
         * `config.kazutoriBanUsers` に設定されたユーザーID/ユーザー名/acctと比較する。
         * 大文字小文字を区別しない。
         *
         * @param user - 判定対象のユーザー
         * @returns BANされている場合 `true`
         * @internal
         */
        private isBannedUser(user: User): boolean {
                const banUsers = config.kazutoriBanUsers ?? [];
                const identifiers = [
                        user.id,
                        user.username,
                        user.host ? `${user.username}@${user.host}` : user.username,
                        acct(user),
                ]
                        .filter((value): value is string => typeof value === 'string')
                        .map((value) => value.toLowerCase());

                return banUsers.some((banUser) => typeof banUser === 'string' && identifiers.includes(banUser.toLowerCase()));
        }

        /**
         * 公開投稿限定モードで、有効な投票者IDを収集する
         *
         * @remarks
         * 開催投稿へのリプライ・引用を取得し、特定のリアクション
         * (discochicken) を付けているユーザーのIDを集める。
         * リアクションがないユーザーの投票は無効化される。
         *
         * @param postId - 開催投稿のノートID
         * @returns 有効ユーザーIDのセット、またはエラー時 `null`
         * @internal
         */
        private async collectPublicOnlyVoteUserIds(postId: string): Promise<Set<string> | null> {
                const reactionKeys = new Set([':mk_discochicken@.:', ':disco_chicken:']);
                const expectedReactions = Array.from(reactionKeys).join(', ');
                const validUserIds = new Set<string>();

                const collectFromNotes = (
                        notes: Array<{ id?: string; user?: { id: string }; myReaction?: string }>,
                        source: string
                ) => {
                        const rejectedReasons: string[] = [];
                        let acceptedCount = 0;

                        for (const note of notes) {
                                const noteId = note?.id ? `noteId=${note.id}` : 'noteId=unknown';
                                if (!note?.user?.id) {
                                        rejectedReasons.push(`${noteId}: user id missing`);
                                        continue;
                                }
                                if (!note.myReaction) {
                                        rejectedReasons.push(`${noteId}: reaction missing`);
                                        continue;
                                }
                                if (!reactionKeys.has(note.myReaction)) {
                                        rejectedReasons.push(
                                                `${noteId}: reaction mismatch (expected: ${expectedReactions}, actual: ${note.myReaction})`
                                        );
                                        continue;
                                }
                                validUserIds.add(note.user.id);
                                acceptedCount += 1;
                        }

                        this.log(
                                `Public-only ${source} check fetched ${notes.length} posts, accepted ${acceptedCount}, rejected ${rejectedReasons.length}`
                        );
                        rejectedReasons.forEach((reason) => {
                                this.log(`Public-only ${source} rejected: ${reason}`);
                        });
                };

                try {
                        const replies = await this.ai.api('notes/replies', { noteId: postId, limit: 100 });
                        collectFromNotes(Array.isArray(replies) ? replies : [], 'reply');
                } catch (err) {
                        const reason = err instanceof Error ? err.message : String(err);
                        this.log(`Failed to fetch kazutori replies: ${reason}`);
                        return null;
                }

                try {
                        const quotes = await this.ai.api('notes/renotes', { noteId: postId, limit: 100 });
                        collectFromNotes(Array.isArray(quotes) ? quotes : [], 'quote');
                } catch (err) {
                        const reason = err instanceof Error ? err.message : String(err);
                        this.log(`Failed to fetch kazutori renotes: ${reason}`);
                        return null;
                }

                return validUserIds;
        }

        /**
         * モジュールの初期化
         *
         * @remarks
         * - ゲームコレクションの初期化
         * - 1秒間隔でゲーム終了チェック
         * - 1秒間隔で定時リノートチェック
         * - 18.5分間隔で自動開催判定（時間帯により確率変動）
         *
         * @returns mentionHook と contextHook を含むフック登録オブジェクト
         * @public
         */
        @autobind
        public install() {
                this.games = this.ai.getCollection('kazutori');

                this.crawleGameEnd();
                setInterval(this.crawleGameEnd, 1000);
                setInterval(this.renoteOnSpecificHours, 1000);
                setInterval(() => {
                        const hours = new Date().getHours();
                        const rnd = (hours === 12 || (hours > 17 && hours < 24) ? 0.5 : 0.1) * this.ai.activeFactor;
                        if (Math.random() < rnd) {
                                this.start();
                        }
                }, 1000 * 30 * 37);

                return {
                        mentionHook: this.mentionHook,
                        contextHook: this.contextHook,
                };
        }

        /**
         * 定時リノート: 進行中のゲームを偶数時にリノートする
         *
         * @remarks
         * 8,10,12,14,16,18,20,22時の正分にリノートする。
         * 終了10分前以内の場合はリノートしない。
         * 同じゲーム・同じ時間帯での重複リノートを防止する。
         *
         * @internal
         */
        @autobind
        private async renoteOnSpecificHours() {
                const game = this.games.findOne({
                        isEnded: false,
                });

                if (game == null) return;

                const now = new Date();
                const hour = now.getHours();

                if (![8, 10, 12, 14, 16, 18, 20, 22].includes(hour)) return;

                if (now.getMinutes() !== 0) return;

                const finishedAt = game.finishedAt ?? game.startedAt + 1000 * 60 * (game.limitMinutes ?? 10);
                const remaining = finishedAt - Date.now();
                const threshold = (10 * 60 + 10) * 1000;

                if (remaining < threshold) return;

                const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;

                if (this.lastHourlyRenote && this.lastHourlyRenote.key === key && this.lastHourlyRenote.postId === game.postId) {
                        return;
                }

                this.lastHourlyRenote = { key, postId: game.postId };

                try {
                        await this.ai.post({
                                renoteId: game.postId,
                        });
                } catch (err) {
                        const reason = err instanceof Error ? err.message : String(err);
                        this.log(`Failed to renote kazutori post on specific hour: ${reason}`);
                        this.lastHourlyRenote = null;
                }
        }

        /**
         * ゲームを開始する
         *
         * @remarks
         * 最大値・勝利条件・制限時間・公開範囲を決定し、開催投稿を行う。
         *
         * @param triggerUserId - トリガーしたユーザーのID（自動開催時はundefined）
         * @param flg - 管理者フラグ（'inf'=無限, 'med'=中央値, 'lng'=長時間, '2nd'=2番目, 'pub'=公開限定）
         * @internal
         */
	@autobind
	private async start(triggerUserId?, flg?) {
		this.ai.decActiveFactor();

		const games = this.games.find({});

		const recentGame = games.length == 0 ? null : games[games.length - 1];

		const penultimateGame =
			recentGame && games.length > 1 ? games[games.length - 2] : null;

		if (recentGame?.maxnum) {
			const maxnum = recentGame.maxnum as unknown;
			const needsConversion = typeof maxnum === 'string' || typeof maxnum === 'number' || typeof (maxnum as { equals?: unknown }).equals !== 'function';
			if (needsConversion) {
				recentGame.maxnum = maxnum === 'Infinity' ? Decimal.MAX_VALUE : new Decimal(maxnum as string | number);
			}
		}

		let publicOnly = false;

		// ゲーム開始条件判定
		const h = new Date().getHours();

		// 前回がお流れの場合はランダム発生のクールダウンを110分にする
		if (
			recentGame && (
				!recentGame.isEnded ||
				(
					(h > 0 && h < 8) ||
					(
						Date.now() - (recentGame.finishedAt ?? recentGame.startedAt) < 1000 * 60 *
						(
							(recentGame?.votes?.length ?? 2) <= 1 && !triggerUserId ? 110 : 50
						)
					) && !triggerUserId
				)
			)
		) return;

		// 最大値は(前回の参加者＋前々回の参加者/2)に50%で1を足した物
		let maxnum = new Decimal(
			(Math.floor(((recentGame?.votes?.length || 0) + (penultimateGame?.votes?.length || 0)) / 2) + (Math.random() < 0.5 ? 1 : 0)) || 1
		);

		// 3%かつ開催2回目以降かつ前回がMax50以上ではない場合 Maxを50 ~ 500倍にする
		if (Math.random() < 0.03 && recentGame?.maxnum && recentGame.maxnum.lessThanOrEqualTo(50)) {
			maxnum = maxnum.times(new Decimal(50 + (Math.random() * 450)));
			maxnum = maxnum.floor();
		}
		// 2%かつ開催2回目以降かつ前回がMax1ではない場合 Max1
		else if (Math.random() < 0.02 && recentGame?.maxnum && !recentGame.maxnum.equals(1)) {
			maxnum = new Decimal(1);
		}
		// 3%かつ開催2回目以降かつ前回が無限モードではない場合 Maxを Decimal.MAX_VALUE にする
		else if ((Math.random() < 0.03 && recentGame?.maxnum && !recentGame.maxnum.equals(Decimal.MAX_VALUE)) || flg?.includes("inf")) {
			maxnum = Decimal.MAX_VALUE;
		}

                // 前回が2番目勝利モードでないかつ15%で2番目勝利モードになる
                let winRank =
                        (recentGame?.winRank ?? 1) <= 1 &&
                                this.ai.activeFactor >= 0.5 &&
                                Math.random() < (maxnum.equals(Decimal.MAX_VALUE) ? 0.3 : 0.15)
                                ? 2
                                : 1;

                // フラグ指定時は強制的に勝利モードを切り替える
                if (flg?.includes('med')) {
                        winRank = -1;
                } else if (flg?.includes('2nd')) {
                        winRank = 2;
                }

                // 前回が中央値勝利モードでないかつ15%で中央値勝利モードになる
                if (
                        ((recentGame?.winRank ?? 1) > 0 &&
                                !flg?.includes('2nd') &&
                                this.ai.activeFactor >= 0.5 &&
                                Math.random() < (maxnum.equals(Decimal.MAX_VALUE) ? 0.3 : 0.15)) ||
                        flg?.includes('med')
                ) {
                        winRank = -1;
                }

		const now = new Date();

		// 今日が1/1の場合 最大値は新年の年数
		if (now.getMonth() === 0 && now.getDate() === 1) {
			maxnum = new Decimal(now.getFullYear());
		}

		let visibility;

		if (this.ai.activeFactor >= 0.85) {
			// 自然発生かつ3%の確率でフォロワー限定になる
			visibility = Math.random() < 0.03 && !triggerUserId ? 'followers' : undefined;

			if (!visibility) {
				// 投稿がフォロワー限定でない場合は、3%の確率で公開投稿のみ受付けるモードにする
				publicOnly = this.ai.activeFactor >= 0.5 && !recentGame?.publicOnly && (recentGame?.publicOnly == null || Math.random() < 0.005);
			}
		}

		if (flg?.includes('pub')) {
			publicOnly = true;
			visibility = undefined;
		}

		/** 10% → 自然発生かつ50%で1分 そうでない場合2分 */
		/** 90% → 5分 or 10分 */
		let limitMinutes = Math.random() < 0.1 && this.ai.activeFactor >= 0.75 ? Math.random() < 0.5 && !triggerUserId ? 1 : 2 : Math.random() < 0.5 ? 5 : 10;

		/** 日付の同一判定 */
		const isSameDate = (left: Date, right: Date) =>
			left.getFullYear() === right.getFullYear() &&
			left.getMonth() === right.getMonth() &&
			left.getDate() === right.getDate();
		const recentGameDate = recentGame ? new Date(recentGame.startedAt) : null;
		const yesterday = new Date(now);
		yesterday.setDate(now.getDate() - 1);
		/** 前回が昨日の日付なら今日の1回目なので同一判定で十分 */
		const isRecentGameYesterday = recentGameDate
			? isSameDate(recentGameDate, yesterday)
			: false;
		const isYesterdayFirstGameBoostTime = now.getHours() >= 8 && now.getHours() < 10;
		/** 高機嫌かつ稀な長時間モード */
		const hasHighMoodRareLongLimit =
			this.ai.activeFactor >= 1 && Math.random() < 0.001 && now.getHours() < 14;
		/** フラグ指定による長時間モード */
		const hasForcedLongLimit = flg?.includes('lng');
		/** 前回が昨日の初回＆朝時間帯の長時間モード */
		const hasMorningYesterdayLongLimit =
			this.ai.activeFactor > 0.75 &&
			isRecentGameYesterday &&
			isYesterdayFirstGameBoostTime &&
			Math.random() < 0.5;

		const hasLongLimit = hasHighMoodRareLongLimit || hasForcedLongLimit || hasMorningYesterdayLongLimit;
		if (hasLongLimit) {
			limitMinutes *= 48;
		}

		/** 機嫌が低い場合、受付時間を延長 */
		if (this.ai.activeFactor < 0.75 && !hasLongLimit) {
			limitMinutes = Math.floor(1 / (1 - Math.min((1 - this.ai.activeFactor) * 1.2 * (0.7 + Math.random() * 0.3), 0.8)) * limitMinutes / 5) * 5;
		}

		// 1番目勝利モードでないかつ75%で最大数値を2倍
		if (maxnum.greaterThan(0) && winRank !== 1 && Math.random() < 0.75) {
			maxnum = maxnum.times(2);
		}

		// 1時間以上の数取りかつ最大数値が9以下なら75%で最大数値を2倍
		if (limitMinutes >= 60 && maxnum.greaterThan(0) && maxnum.lessThanOrEqualTo(9) && Math.random() < 0.75) {
			maxnum = maxnum.times(2);
		}

		const maxnumText = maxnum.equals(Decimal.MAX_VALUE) || maxnum.toString() == "Infinity" ? "上限なし" : maxnum.toString();

		const post = await this.ai.post({
			text: !publicOnly ? serifs.kazutori.intro(maxnumText, limitMinutes, winRank, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)) : serifs.kazutori.introPublicOnly(maxnumText, limitMinutes, winRank, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)),
			...(visibility ? { visibility } : {})
		});

                this.games.insertOne({
                        votes: [],
                        isEnded: false,
                        startedAt: Date.now(),
                        finishedAt: Date.now() + 1000 * 60 * limitMinutes,
                        limitMinutes,
                        winRank,
                        postId: post.id,
                        maxnum: maxnum,
                        triggerUserId,
			publicOnly,
			replyKey: triggerUserId ? [triggerUserId] : [],
		});

		this.subscribeReply(null, post.id);

		this.log('New kazutori game started');
	}

        /**
         * メンション受信時のフック: ゲーム開催リクエスト・再集計
         *
         * @remarks
         * 「数取り」を含むメンションでゲーム開催をリクエストする。
         * 管理者は「再集計」で最新ゲームの結果を再集計できる。
         * クールタイムは親愛度に応じて短縮される（最大8倍→1.2倍）。
         *
         * @param msg - 受信メッセージ
         * @returns HandlerResult または `false`
         * @internal
         */
        @autobind
	private async mentionHook(msg: Message) {
                if (msg.includes(['レート'])) {
                        return false;
                }
                if (!msg.includes(['数取り'])) return false;

                if (this.isBannedUser(msg.user)) {
                        msg.reply(serifs.kazutori.banned, { visibility: 'specified' });
                        return {
                                reaction: 'confused',
                        };
                }

                if (!msg.user.host && msg.user.username === config.master && msg.includes(['再集計', '集計やり直し', '集計やりなおし'])) {
                        await this.redoLastAggregation(msg);
                        return {
                                reaction: 'love',
                        };
                }

                const games = this.games.find({});

		const recentGame = games.length == 0 ? null : games[games.length - 1];

		let flg = '';

		if (recentGame) {
			// 現在アクティブなゲームがある場合
			if (!recentGame.isEnded) {
				msg.reply(serifs.kazutori.alreadyStarted, {
					renote: recentGame.postId,
				});
				return {
					reaction: 'confused',
				};
			}

			const h = new Date().getHours();

			if (h > 0 && h < 8) {
				msg.reply("現在、数取り開催不可に指定されている時間です。8時から開催を受け付けます！");
				return {
					reaction: 'hmm',
				};
			}

			// 懐き度が高いほどトリガーのクールタイムを短く
			// トリガーの公開範囲がフォロワー以下ならクールタイム２倍
			const cth = Math.max((msg.friend.love >= 200 ? 1.2 : msg.friend.love >= 100 ? 1.5 : msg.friend.love >= 20 ? 2 : msg.friend.love >= 5 ? 4 : 8) * (["public", "home"].includes(msg.visibility) ? 1 : 1.5), 1);
			const cooldownBaseAt = recentGame.finishedAt ?? recentGame.startedAt;

                        // トリガー者が管理人でない かつ クールタイムが開けていない場合
                        if ((msg.user.host || msg.user.username !== config.master) && Date.now() - cooldownBaseAt < 1000 * 60 * 30 * cth) {
                                const cooldownMs = 1000 * 60 * 30 * cth;
                                const elapsedMs = Date.now() - cooldownBaseAt;
                                const remainingMinutes = Math.max(Math.ceil((cooldownMs - elapsedMs) / (1000 * 60)), 0);
                                const retryAt = Math.ceil((cooldownBaseAt + cooldownMs) / 1000);

                                try {
                                        await msg.reply(serifs.kazutori.matakondo(remainingMinutes, retryAt));
                                } catch (err) {
                                        const reason = err instanceof Error ? err.message : String(err);
                                        this.log(`Failed to reply cooldown message: ${reason}`);
                                }

                                return {
                                        reaction: 'hmm'
                                };
                        }

                        if (!msg.user.host && msg.user.username === config.master && msg.includes(['inf'])) flg = "inf";
                        if (!msg.user.host && msg.user.username === config.master && msg.includes(['med'])) flg += " med";
                        if (!msg.user.host && msg.user.username === config.master && msg.includes(['lng'])) flg += " lng";
                        if (!msg.user.host && msg.user.username === config.master && msg.includes(['2nd'])) flg += " 2nd";
                        if (!msg.user.host && msg.user.username === config.master && msg.includes(['pub'])) flg += " pub";
                }

		//TODO : このへんのセリフをserifに移行する
		msg.reply("\n分かりました！数取りを開催します！\nあなたは開催1分後から数取りへの投票を行うことができます！\n（ダイレクトなら今すぐでも大丈夫です！）", { visibility: 'specified' }).then(reply => {
			this.subscribeReply(msg.userId, reply.id);
		});

		this.start(msg.user.id, flg);

		return {
			reaction: 'love',
		};
	}

        /**
         * 最新ゲームの結果を再集計する（管理者コマンド）
         *
         * @remarks
         * 最新の終了済みゲームに対して finish() を再実行する。
         * 既に再集計済みの場合は拒否する。
         *
         * @param msg - メンションメッセージ（返信先）
         * @internal
         */
        @autobind
        private async redoLastAggregation(msg: Message) {
                const games = this.games.find({});
                const recentGame = games.length === 0 ? null : games[games.length - 1];

                if (!recentGame) {
                        await msg.reply('再集計できるゲームが見つかりませんでした。', { visibility: 'specified' });
                        return;
                }

                if (!recentGame.isEnded) {
                        await msg.reply('前回の数取りはまだ終了していないため、再集計できません。', { visibility: 'specified' });
                        return;
                }

                if (recentGame.reaggregatedAt) {
                        await msg.reply('前回の集計はすでに再集計済みです。', { visibility: 'specified' });
                        return;
                }

                if (!recentGame.votes || recentGame.votes.length === 0) {
                        await msg.reply('再集計できる投票情報がありませんでした。', { visibility: 'specified' });
                        return;
                }

                recentGame.isEnded = false;
                recentGame.reaggregatedAt = Date.now();
                this.games.update(recentGame);

                await msg.reply('前回の集計をやり直します。結果の投稿まで少しお待ちください。', { visibility: 'specified' });
                await this.finish(recentGame, { isReaggregate: true });
        }

        /**
         * コンテキストフック: 投票の受付処理
         *
         * @remarks
         * 開催投稿へのリプライを投票として処理する。
         * 各種バリデーション（BAN・重複・範囲・トリガー者の1分制限など）を行い、
         * 有効な投票をゲームに記録する。
         * 21桁以上の数字はDecimal型に変換し、丸め処理を行う。
         *
         * @param key - コンテキストキー
         * @param msg - 受信メッセージ
         * @returns HandlerResult
         * @internal
         */
	@autobind
        private async contextHook(key: any, msg: Message) {
                if (msg.text == null)
                        return {
                                reaction: 'hmm',
                        };

                if (this.isBannedUser(msg.user)) {
                        msg.reply(serifs.kazutori.banned, { visibility: 'specified' });
                        return {
                                reaction: 'confused',
                        };
                }

                const game = this.games.findOne({
                        isEnded: false,
                });

		// 処理の流れ上、実際にnullになることは無さそうだけど一応
		if (game == null) return;

		// 数取りトリガー者で、開始から1分以内の場合
		const time = Date.now() - game.startedAt;
		if (game.triggerUserId === msg.user.id && time < 60 * 1000 && msg.visibility !== 'specified') {
			msg.reply(`\n${60 - Math.floor(time / 1000)}秒後にもう一度送ってください！`, { visibility: 'specified' }).then(reply => {
				game.replyKey.push(msg.userId);
				this.games.update(game);
				this.subscribeReply(msg.userId, reply.id);
			});
			return { reaction: '❌' };
		}

		// 公開投稿限定モードで公開投稿じゃない場合
		if (game.publicOnly && ((msg.visibility != 'public' && msg.visibility != 'home') || msg.localOnly)) {
			const visibility =
				msg.visibility == 'followers' ? "フォロワー限定" :
					msg.visibility == 'specified' ? "ダイレクト" :
						msg.user.host == null ? `ローカル＆フォロワー` : "";

			msg.reply(`\n公開投稿限定です！\n参加するには${visibility ? "「" + visibility + "」ではなく、" : ""}「公開」または「ホーム」の公開範囲にてリプライしてくださいね～`).then(reply => {
				game.replyKey.push(msg.userId);
				this.games.update(game);
				this.subscribeReply(msg.userId, reply.id);
			});
			return {
				reaction: 'confused'
			};
		}

		// 既に数字を取っていたら
		if (game.votes.some((x) => x.user.id == msg.userId)) {
			msg.reply('すでに投票済みの様です！').then((reply) => {
				game.replyKey.push(msg.userId);
				this.games.update(game);
				this.subscribeReply(msg.userId, reply.id);
			});
			return {
				reaction: 'confused',
			};
		}

		let num: typeof Decimal;

                const normalizedText = msg.extractedText.replace(/[０-９]/g, (m) => '０１２３４５６７８９'.indexOf(m).toString());

                // 数字が含まれていない
                const matches = normalizedText.match(/[0-9]+|∞/g);
                if (matches == null) {
                        msg.reply('リプライの中に数字が見つかりませんでした！').then((reply) => {
                                game.replyKey.push(msg.userId);
                                this.games.update(game);
                                this.subscribeReply(msg.userId, reply.id);
                        });
                        return {
                                reaction: 'hmm',
                        };
                }

                if (matches.length >= 2) {
                        msg.reply('数取りでは2個以上の数値に投票する事は出来ません。小数を指定した場合は、整数で指定するようにしてください。').then((reply) => {
                                game.replyKey.push(msg.userId);
                                this.games.update(game);
                                this.subscribeReply(msg.userId, reply.id);
                        });
                        return {
                                reaction: 'confused',
                        };
                }

                const match = matches[0];

                if (match === '∞') {
                        num = new Decimal(Decimal.NUMBER_MAX_VALUE);
                } else {
                        // 先頭のゼロを除去
                        const numStr = match.replace(/^0+/, '') || '0';

			//21桁以上の場合
			if (numStr.length > 20) {
				const mantissaDigits = 3;
				const mantissaStr = numStr.slice(0, mantissaDigits + 1);
				let exponent = numStr.length - 1;
				let mantissaNum = parseInt(mantissaStr.slice(0, mantissaDigits));
				const nextDigit = parseInt(mantissaStr.charAt(mantissaDigits));
				//繰り上げ
				if (nextDigit >= 5) {
					mantissaNum += 1;
				}

				if (mantissaNum >= Math.pow(10, mantissaDigits)) {
					mantissaNum = mantissaNum / 10;
					exponent += 1;
				}

				// 仮数を数値に変換し、正規化
				const mantissa = mantissaNum / Math.pow(10, mantissaDigits - 1);

				num = new Decimal(`${mantissa}e${exponent}`);
			} else {
				num = new Decimal(numStr);
			}
		}

		/*
				// 整数じゃない
				if (!num.equals(num.floor())) {
						msg.reply('リプライの中に整数が見つかりませんでした！').then(reply => {
								game.replyKey.push(msg.userId);
								this.games.update(game);
								this.subscribeReply(msg.userId, reply.id);
						});
						return {
								reaction: 'hmm'
						};
				}
				*/

		if (typeof game.maxnum == "string") {
			game.maxnum = game.maxnum == "Infinity" ? Decimal.MAX_VALUE : new Decimal(game.maxnum);
		}

		// 範囲外
		if (game.maxnum && game.maxnum.greaterThan(0) && (num.lessThan(0) || num.greaterThan(game.maxnum))) {
			let strn = num.equals(new Decimal(Decimal.NUMBER_MAX_VALUE)) ? '∞ (\\(1.8×10^{308}\\))' : num.toString();
			if (strn.includes('e+')) {
				if (strn == 'Infinity') strn = '∞ (\\(1.8×10^{308}\\))';
				strn = strn.replace(/^1e/, '');
				strn = strn.replace('e', '×');
				strn = strn.replace('+', '10^{');
				strn += '}\\)';
				strn = '\\(' + strn;
			}
			let maxStr = game.maxnum.equals(Decimal.MAX_VALUE) || game.maxnum.toString() == "Infinity" ? '∞' : game.maxnum.toString();
			msg.reply(`\n「${strn}」は今回のゲームでは範囲外です！\n0~${maxStr}の範囲で指定してくださいね！`).then(reply => {
				game.replyKey.push(msg.userId);
				this.games.update(game);
				this.subscribeReply(msg.userId, reply.id);
			});
			return {
				reaction: 'confused'
			};
		}

		this.log(`Voted ${num.toString()} by ${msg.user.id}`);

		// 投票
		game.votes.push({
			user: {
				id: msg.user.id,
				username: msg.user.username,
				host: msg.user.host,
				winCount: msg.friend?.doc?.kazutoriData?.winCount ?? 0,
			},
			number: num,
		});

		this.games.update(game);

                if (msg.friend?.doc) {
                        const { data } = ensureKazutoriData(msg.friend.doc);
                        data.playCount += 1;
                        data.lastPlayedAt = Date.now();
                        msg.friend.save();
                }

		return {
			reaction: ':mk_discochicken:',
		};
	}

	/**
	 * 終了すべきゲームがないかチェック
	 */
	@autobind
        private crawleGameEnd() {
                const game = this.games.findOne({
                        isEnded: false,
                });

                if (game == null) return;

                // 制限時間が経過していたら
                if (Date.now() - (game.finishedAt ?? game.startedAt + 1000 * 60 * 10) >= 0) {
                        void this.finish(game);
                }
        }

	/**
	 * ゲームの終了処理: 結果集計・レーティング更新・結果発表
	 *
	 * @remarks
	 * 1. 公開限定モードの場合は有効投票者をフィルタリング
	 * 2. ブロックユーザーの投票を除外
	 * 3. 勝者を決定（最大値/2番目/中央値 × 反転判定）
	 * 4. レーティングを更新（勝者にボーナス、敗者にペナルティ）
	 * 5. 不参加者のレート1000超過分にペナルティ
	 * 6. 勝者にアイテム付与・勝利数カウント・メダル付与
	 * 7. 結果発表を投稿
	 *
	 * @param game - 終了するゲーム
	 * @param options - オプション（再集計フラグ）
	 * @internal
	 */
	@autobind
        private async finish(game: Game, options?: { isReaggregate?: boolean }) {
                game.isEnded = true;
                this.games.update(game);

                if (options?.isReaggregate) {
                        this.log('Kazutori game reaggregation started');
                }

                this.log('Kazutori game finished');

                const filteredVotes: Game['votes'] = [];
                const publicOnlyVoteUserIds = game.publicOnly ? await this.collectPublicOnlyVoteUserIds(game.postId) : null;

                for (const vote of game.votes) {
                        if (publicOnlyVoteUserIds && !publicOnlyVoteUserIds.has(vote.user.id)) {
                                const friend = this.ai.lookupFriend(vote.user.id);
                                if (friend?.doc) {
                                        const { data } = ensureKazutoriData(friend.doc);
                                        data.playCount = Math.max((data.playCount ?? 0) - 1, 0);
                                        friend.save();
                                }
                                continue;
                        }
                        const friend = this.ai.lookupFriend(vote.user.id);
                        const love = friend?.love ?? 0;

                        if (love > 10) {
                                filteredVotes.push(vote);
                                continue;
                        }

                        let isBlocking = friend?.doc?.user?.isBlocking;

                        if (isBlocking == null) {
                                try {
                                        const user = await this.ai.api('users/show', { userId: vote.user.id });
                                        isBlocking = user?.isBlocking;

                                        if (friend && user) {
                                                friend.updateUser(user);
                                        }
                                } catch (err) {
                                        const reason = err instanceof Error ? err.message : String(err);
                                        this.log(`Failed to check blocking for ${vote.user.id}: ${reason}`);
                                }
                        }

                        if (isBlocking) {
                                if (friend?.doc) {
                                        const { data } = ensureKazutoriData(friend.doc);
                                        data.playCount = Math.max((data.playCount ?? 0) - 1, 0);
                                        friend.save();
                                }
                                continue;
                        }

                        filteredVotes.push(vote);
                }

                game.votes = filteredVotes;
                this.games.update(game);

                const item = genItem();

		const medal = game.votes?.length > 1 && game.votes?.filter((x) => x.user.winCount < 50).length < game.votes?.filter((x) => x.user.winCount >= 50).length;

		// お流れ
		if (game.votes?.filter((x) => x.user.winCount < 50).length <= 1 && !medal) {
                        game.votes.forEach((x) => {
                                const friend = this.ai.lookupFriend(x.user.id);
                                if (friend) {
                                        const { data } = ensureKazutoriData(friend.doc);
                                        data.playCount = Math.max((data.playCount ?? 0) - 1, 0);
                                        friend.save();
                                }
                        });
			this.ai.decActiveFactor((game.finishedAt.valueOf() - game.startedAt.valueOf()) / (60 * 1000 * 100) * Math.max(1 - (game.votes.length / 3), 0));

			if (this.ai.activeFactor < 0.5 || game.votes.length < 1) return;

			this.ai.post({
				text: serifs.kazutori.onagare(item),
				renoteId: game.postId,
			});

			return;
		}

		let results: string[] = [];
		let winner: Game['votes'][0]['user'] | null = null;
		let reverseResults: string[] = [];
		let reverseWinner: Game['votes'][0]['user'] | null = null;

		let winRank = game.winRank ?? 1;
		let reverseWinRank = game.winRank ?? 1;

		let reverse = Math.random() < (winRank === 1 ? 0.15 : 0.3);
		const now = new Date();

		game.votes.forEach((x) => {
			if (typeof x.number == "string") {
				x.number = new Decimal(x.number);
			}
		})

		if (typeof game.maxnum == "string") {
			game.maxnum = game.maxnum == "Infinity" ? Decimal.MAX_VALUE : new Decimal(game.maxnum);
		}

		let useNumbers = Array.from(
			new Set(game.votes.map((x) => x.number.toString()))
		).map((s) => new Decimal(s));
		// 降順ソート
		useNumbers.sort((a, b) => {
			if (a.greaterThan(b)) return -1;
			if (a.lessThan(b)) return 1;
			return 0;
		});

		let med;

		if (winRank === -1) {
			function median(arr: (typeof Decimal)[]) {
				// 昇順ソート
				let inOrderArr = arr.slice().sort((a, b) => {
					if (a.lessThan(b)) return -1;
					if (a.greaterThan(b)) return 1;
					return 0;
				});
				console.log(inOrderArr);
				let result: typeof Decimal;
				if (inOrderArr.length === 0) return -1;
				if (inOrderArr.length % 2 === 0) {
					result = inOrderArr[inOrderArr.length / 2 - 1]
						.plus(inOrderArr[inOrderArr.length / 2])
						.dividedBy(2);
				} else {
					result = inOrderArr[(inOrderArr.length + 1) / 2 - 1];
				}
				return result;
			}
			med = median(
				useNumbers.filter((n) => {
					const users = game.votes
						.filter((x) => x.number.equals(n))
						.map((x) => x.user);
					return users.length == 1;
				})
			);
		}

		// 正常
		for (let i = 0; i < useNumbers.length; i++) {
			const n = useNumbers[i];
			let strn = n.equals(new Decimal(Decimal.NUMBER_MAX_VALUE))
				? '∞ (\\(1.8×10^{308}\\))'
				: n.toString();
			if (strn.includes('e+')) {
				if (strn == 'Infinity') strn = '∞ (\\(1.8×10^{308}\\))';
				strn = strn.replace(/^1e/, '');
				strn = strn.replace('e', '×');
				strn = strn.replace('+', '10^{');
				strn += '}\\)';
				strn = '\\(' + strn;
			}
			const users = game.votes
				.filter((x) => x.number.equals(n))
				.map((x) => x.user);

			if (users.length == 1) {
				if (winner == null) {
					if (winRank == -1) {
						if (n.equals(med)) {
							winner = users[0];
							const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
							results.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
						} else {
							results.push(`➖ ${strn}: ${acct(users[0])}`);
						}
					} else if (winRank > 1) {
						winRank -= 1;
						results.push(`➖ ${strn}: ${acct(users[0])}`);
					} else {
						winner = users[0];
						const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
						results.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
					}
				} else {
					results.push(`➖ ${strn}: ${acct(users[0])}`);
				}
			} else if (users.length > 1) {
				results.push(`❌ ${strn}: ${users.map((u) => acct(u)).join(' ')}`);
			}
		}
		if (winRank != -1) {
			// 昇順ソート
			useNumbers.sort((a, b) => {
				if (a.lessThan(b)) return -1;
				if (a.greaterThan(b)) return 1;
				return 0;
			});
			// 反転
			for (let i = 0; i < useNumbers.length; i++) {
				const n = useNumbers[i];
				let strn = n.equals(new Decimal(Decimal.NUMBER_MAX_VALUE))
					? '∞ (\\(1.8×10^{308}\\))'
					: n.toString();
				if (strn.includes('e+')) {
					if (strn == 'Infinity') strn = '∞ (\\(1.8×10^{308}\\))';
					strn = strn.replace(/^1e/, '');
					strn = strn.replace('e', '×');
					strn = strn.replace('+', '10^{');
					strn += '}\\)';
					strn = '\\(' + strn;
				}
				const users = game.votes
					.filter((x) => x.number.equals(n))
					.map((x) => x.user);

				if (users.length == 1) {
					if (reverseWinner == null) {
						if (reverseWinRank > 1) {
							reverseWinRank -= 1;
							reverseResults.push(`➖ ${strn}: ${acct(users[0])}`);
						} else {
							reverseWinner = users[0];
							const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
							reverseResults.push(
								`${icon} **${strn}**: $[jelly ${acct(users[0])}]`
							);
						}
					} else {
						reverseResults.push(`➖ ${strn}: ${acct(users[0])}`);
					}
				} else if (users.length > 1) {
					reverseResults.push(
						`❌ ${strn}: ${users.map((u) => acct(u)).join(' ')}`
					);
				}
			}
		} else {
			reverseResults = results;
			reverseWinner = winner;
		}

                if (!medal && config.kazutoriWinDiffReverseEnabled) {
                        const winDiff = (Math.min(winner?.winCount ?? 0, 50)) - (Math.min(reverseWinner?.winCount ?? 0, 50));
                        if (!reverse && winner && winDiff > 10 && Math.random() < Math.min((winDiff - 10) * 0.02, 0.7)) {
                                reverse = !reverse;
                        } else if (reverse && reverseWinner && winDiff < -10 && Math.random() < Math.min((winDiff + 10) * -0.02, 0.7)) {
                                reverse = !reverse;
			}
		}

		let perfect = false;

		//そのままでも反転しても結果が同じの場合は反転しない
		if (!winner || !reverseWinner || winner?.id === reverseWinner?.id) {
			perfect = winRank != -1;
			reverse = false;
		}

		if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

		if (reverse) {
			results = reverseResults;
			winner = reverseWinner;
		}

		if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;
		game.winnerUserId = winner?.id;
		this.games.update(game);

                const participants = new Set(game.votes.map((vote) => vote.user.id));
                const calculatedLimitMinutes =
                        game.limitMinutes ?? Math.max(Math.round((game.finishedAt - game.startedAt) / (1000 * 60)), 1);
                if (game.limitMinutes == null) {
                        game.limitMinutes = calculatedLimitMinutes;
                        this.games.update(game);
                }

                const winnerFriend = winner?.id ? this.ai.lookupFriend(winner.id) : null;
                const name = winnerFriend ? winnerFriend.name : null;
                let ratingInfo: { beforeRate: number; afterRate: number; beforeRank?: number; afterRank?: number } | null = null;

                const friendDocs = this.ai.friends.find({}) as FriendDoc[];
                const friendDocMap = new Map<string, FriendDoc>();
                const rankingBefore: { userId: string; rate: number }[] = [];
                const rateUpdateGameId = game.postId;
                const touchedUserIds = new Set<string>();
                const rateChangeAggregates = new Map<
                        string,
                        { delta: number; hasNegative: boolean; lossAdjustmentPercent?: number }
                >();
                const recordRateChange = (userId: string, delta: number, lossAdjustmentPercent?: number) => {
                        if (!Number.isFinite(delta) || delta === 0) return;
                        const entry = rateChangeAggregates.get(userId);
                        if (entry) {
                                entry.delta += delta;
                        } else {
                                rateChangeAggregates.set(userId, { delta, hasNegative: false });
                        }
                        if (delta < 0) {
                                if (typeof lossAdjustmentPercent === 'number' && !Number.isNaN(lossAdjustmentPercent)) {
                                        const clamped = Math.min(Math.max(lossAdjustmentPercent, 0), 100);
                                        const current = rateChangeAggregates.get(userId);
                                        if (current) {
                                                current.hasNegative = true;
                                                current.lossAdjustmentPercent = Math.round(clamped);
                                        }
                                } else {
                                        const current = rateChangeAggregates.get(userId);
                                        if (current) {
                                                current.hasNegative = true;
                                                current.lossAdjustmentPercent = 100;
                                        }
                                }
                        }
                        touchedUserIds.add(userId);
                };

                const originalWinRank = game.winRank ?? 1;
                const totalParticipants = game.votes.length;
                const shouldAdjustByRank = totalParticipants >= 3;
                type VoteInfo = {
                        user: Game['votes'][number]['user'];
                        number: typeof Decimal;
                        index: number;
                };
                const voteInfos: VoteInfo[] = game.votes.map((vote, index) => ({
                        user: vote.user,
                        number: vote.number as typeof Decimal,
                        index,
                }));
                const numberToVotes = new Map<string, VoteInfo[]>();
                for (const info of voteInfos) {
                        const key = info.number.toString();
                        const list = numberToVotes.get(key);
                        if (list) {
                                list.push(info);
                        } else {
                                numberToVotes.set(key, [info]);
                        }
                }
                const uniqueVotes: VoteInfo[] = [];
                const duplicateVotes: VoteInfo[] = [];
                for (const [, list] of numberToVotes) {
                        if (list.length === 1) {
                                uniqueVotes.push(list[0]);
                        } else {
                                duplicateVotes.push(...list);
                        }
                }

                const compareDecimalAsc = (a: typeof Decimal, b: typeof Decimal) => {
                        if (a.lessThan(b)) return -1;
                        if (a.greaterThan(b)) return 1;
                        return 0;
                };
                const compareDecimalDesc = (a: typeof Decimal, b: typeof Decimal) => -compareDecimalAsc(a, b);
                const decimalAbs = (value: typeof Decimal) => {
                        if (value.lessThan(Decimal.ZERO)) {
                                return value.times(-1);
                        }
                        return value;
                };
                const buildPlacementOrder = (sorted: VoteInfo[], winnerIndex: number | null) => {
                        if (winnerIndex == null || winnerIndex < 0 || winnerIndex >= sorted.length) {
                                return [...sorted];
                        }
                        const ordered: VoteInfo[] = [];
                        ordered.push(sorted[winnerIndex]);
                        for (let offset = 1; ordered.length < sorted.length; offset++) {
                                const lowerIndex = winnerIndex + offset;
                                const higherIndex = winnerIndex - offset;
                                if (lowerIndex < sorted.length) {
                                        ordered.push(sorted[lowerIndex]);
                                }
                                if (higherIndex >= 0) {
                                        ordered.push(sorted[higherIndex]);
                                }
                        }
                        return ordered;
                };

                let normalPlacements: VoteInfo[] = [];
                let reversePlacements: VoteInfo[] = [];
                let normalWinnerNumber: typeof Decimal | null = null;
                let reverseWinnerNumber: typeof Decimal | null = null;

                if (shouldAdjustByRank && uniqueVotes.length > 0) {
                        if (originalWinRank === -1) {
                                const target = typeof med !== 'undefined' && med !== -1 ? (med as typeof Decimal) : null;
                                if (target) {
                                        normalPlacements = [...uniqueVotes].sort((a, b) => {
                                                const diffA = decimalAbs(a.number.minus(target));
                                                const diffB = decimalAbs(b.number.minus(target));
                                                const diffCompare = compareDecimalAsc(diffA, diffB);
                                                if (diffCompare !== 0) return diffCompare;
                                                return a.index - b.index;
                                        });
                                } else {
                                        normalPlacements = [...uniqueVotes];
                                }
                                normalWinnerNumber = normalPlacements.length > 0 ? normalPlacements[0].number : null;
                                reversePlacements = [];
                                reverseWinnerNumber = null;
                        } else {
                                const sortedDesc = [...uniqueVotes].sort((a, b) => compareDecimalDesc(a.number, b.number));
                                const normalWinnerIndex =
                                        originalWinRank > 0 && originalWinRank <= sortedDesc.length
                                                ? originalWinRank - 1
                                                : null;
                                normalPlacements = buildPlacementOrder(sortedDesc, normalWinnerIndex);
                                normalWinnerNumber =
                                        normalWinnerIndex != null
                                                ? sortedDesc[normalWinnerIndex].number
                                                : normalPlacements.length > 0
                                                ? normalPlacements[0].number
                                                : null;

                                const sortedAsc = [...uniqueVotes].sort((a, b) => compareDecimalAsc(a.number, b.number));
                                const reverseWinnerIndex =
                                        originalWinRank > 0 && originalWinRank <= sortedAsc.length
                                                ? originalWinRank - 1
                                                : null;
                                reversePlacements = buildPlacementOrder(sortedAsc, reverseWinnerIndex);
                                reverseWinnerNumber =
                                        reverseWinnerIndex != null
                                                ? sortedAsc[reverseWinnerIndex].number
                                                : reversePlacements.length > 0
                                                ? reversePlacements[0].number
                                                : null;
                        }
                }

                const actualWinnerId = winner?.id ?? null;
                const addedUsers = new Set<string>();
                const finalRankOrder: VoteInfo[] = [];
                const pushRankCandidate = (info: VoteInfo | undefined) => {
                        if (!info) return;
                        const userId = info.user.id;
                        if (userId === actualWinnerId) return;
                        if (addedUsers.has(userId)) return;
                        finalRankOrder.push(info);
                        addedUsers.add(userId);
                };

                if (shouldAdjustByRank && uniqueVotes.length > 0) {
                        const maxIterations = Math.max(normalPlacements.length, reversePlacements.length) * 2 + 2;
                        for (let step = 0; step < maxIterations; step++) {
                                if (step === 0) {
                                        if (reversePlacements.length > 0) pushRankCandidate(reversePlacements[0]);
                                } else if (step % 2 === 1) {
                                        const normalIndex = (step + 1) / 2;
                                        if (normalIndex < normalPlacements.length) {
                                                pushRankCandidate(normalPlacements[normalIndex]);
                                        }
                                } else {
                                        const reverseIndex = step / 2;
                                        if (reverseIndex < reversePlacements.length) {
                                                pushRankCandidate(reversePlacements[reverseIndex]);
                                        }
                                }
                        }

                        for (const info of normalPlacements) pushRankCandidate(info);
                        for (const info of reversePlacements) pushRankCandidate(info);
                }

                const buildProximityGroups = (target: typeof Decimal | null) => {
                        if (target == null) return [] as VoteInfo[][];
                        const diffMap = new Map<string, { diff: typeof Decimal; votes: VoteInfo[] }>();
                        const groups: { diff: typeof Decimal; votes: VoteInfo[] }[] = [];
                        for (const info of duplicateVotes) {
                                const diff = decimalAbs(info.number.minus(target));
                                const key = diff.toString();
                                let entry = diffMap.get(key);
                                if (!entry) {
                                        entry = { diff, votes: [] };
                                        diffMap.set(key, entry);
                                        groups.push(entry);
                                }
                                entry.votes.push(info);
                        }
                        for (const entry of groups) {
                                entry.votes.sort((a, b) => a.index - b.index);
                        }
                        groups.sort((a, b) => compareDecimalAsc(a.diff, b.diff));
                        return groups.map((entry) => entry.votes);
                };

                const invalidRankOrder: VoteInfo[] = [];
                const pushInvalidCandidate = (info: VoteInfo | undefined) => {
                        if (!info) return;
                        const userId = info.user.id;
                        if (userId === actualWinnerId) return;
                        if (addedUsers.has(userId)) return;
                        invalidRankOrder.push(info);
                        addedUsers.add(userId);
                };

                if (shouldAdjustByRank && duplicateVotes.length > 0) {
                        const normalGroups = buildProximityGroups(normalWinnerNumber);
                        const reverseGroups = buildProximityGroups(reverseWinnerNumber);
                        const groupCount = Math.max(normalGroups.length, reverseGroups.length);
                        for (let i = 0; i < groupCount; i++) {
                                if (i < normalGroups.length) {
                                        for (const info of normalGroups[i]) pushInvalidCandidate(info);
                                }
                                if (i < reverseGroups.length) {
                                        for (const info of reverseGroups[i]) pushInvalidCandidate(info);
                                }
                        }
                }

                const loserRankMap = new Map<string, number>();
                if (shouldAdjustByRank) {
                        let currentRank = 2;
                        for (const info of finalRankOrder) {
                                if (info.user.id === actualWinnerId) continue;
                                if (!loserRankMap.has(info.user.id)) {
                                        loserRankMap.set(info.user.id, currentRank++);
                                }
                        }
                        for (const info of invalidRankOrder) {
                                if (info.user.id === actualWinnerId) continue;
                                if (!loserRankMap.has(info.user.id)) {
                                        loserRankMap.set(info.user.id, currentRank++);
                                }
                        }
                        for (const info of voteInfos) {
                                if (info.user.id === actualWinnerId) continue;
                                if (!loserRankMap.has(info.user.id)) {
                                        loserRankMap.set(info.user.id, currentRank++);
                                }
                        }
                }

                for (const doc of friendDocs) {
                        const { data, updated } = ensureKazutoriData(doc);
                        if (updated) this.ai.friends.update(doc);
                        friendDocMap.set(doc.userId, doc);
                        if (hasKazutoriRateHistory(data)) {
                                rankingBefore.push({ userId: doc.userId, rate: data.rate });
                        }
                }

                const sortedBefore = [...rankingBefore].sort((a, b) =>
                        b.rate === a.rate ? a.userId.localeCompare(b.userId) : b.rate - a.rate
                );

                const cappedLimitMinutes = Math.min(calculatedLimitMinutes, 480);
                const penaltyPoint = Math.max(Math.ceil(cappedLimitMinutes / 5), 1);
                const nonParticipantPenalties: {
                        doc: FriendDoc;
                        data: EnsuredKazutoriData;
                        loss: number;
                }[] = [];
                let totalBonusFromNonParticipants = 0;

                for (const doc of friendDocs) {
                        if (winnerFriend && doc.userId === winnerFriend.userId) continue;
                        if (participants.has(doc.userId)) continue;
                        const data = ensureKazutoriData(doc).data;
                        if (data.rate > 1000) {
                                const rateExcess = data.rate - 1000;
                                const increaseSteps = Math.floor(rateExcess / 500);
                                const multiplier = 1 + increaseSteps * 0.5;
                                const calculatedLoss = penaltyPoint * multiplier;
                                const loss = Math.min(Math.ceil(calculatedLoss), rateExcess);
                                const minimumLoss =
                                        data.rate >= 2000 && cappedLimitMinutes > 4
                                                ? Math.floor((data.rate - 1920) / 80)
                                                : 0;
                                const adjustedLoss = Math.min(Math.max(loss, minimumLoss), rateExcess);
                                if (adjustedLoss > 0) {
                                        data.rate -= adjustedLoss;
                                        data.rateChanged = true;
                                        recordRateChange(doc.userId, -adjustedLoss, 100);
                                        totalBonusFromNonParticipants += adjustedLoss;
                                        nonParticipantPenalties.push({ doc, data, loss: adjustedLoss });
                                }
                        }
                }

                const winnerDoc = winnerFriend ? friendDocMap.get(winnerFriend.userId) : null;

                if (winnerFriend && winnerDoc) {
                        const winnerData = ensureKazutoriData(winnerDoc).data;
                        const beforeRate = winnerData.rate;
                        const beforeRank = findRateRank(sortedBefore, winnerFriend.userId);
                        const baseLossRatio = cappedLimitMinutes * 0.004;
                        const lossRatio = Math.max(
                                baseLossRatio <= 0.04
                                        ? baseLossRatio
                                        : 0.04 + (cappedLimitMinutes - 10) * (1 / 12000),
                                0.02
                        );
                        let totalBonus = 0;

                        for (const vote of game.votes) {
                                if (vote.user.id === winnerFriend.userId) continue;
                                const doc = friendDocMap.get(vote.user.id);
                                if (!doc) continue;
                                const data = ensureKazutoriData(doc).data;
                                const before = data.rate;
                                const loss = Math.max(Math.ceil(before * lossRatio), 1);
                                let adjustedLoss = loss;
                                if (shouldAdjustByRank) {
                                        const rank = loserRankMap.get(vote.user.id);
                                        if (rank != null && rank >= 2) {
                                                const threshold = Math.ceil(totalParticipants / 2);
                                                if (threshold >= 2 && rank <= threshold) {
                                                        let reductionRatio = 0.5;
                                                        if (threshold > 2) {
                                                                const progress = (rank - 2) / (threshold - 2);
                                                                const clamped = Math.min(Math.max(progress, 0), 1);
                                                                reductionRatio = 0.5 * (1 - clamped);
                                                        }
                                                        adjustedLoss = Math.max(
                                                                Math.ceil(loss * (1 - reductionRatio)),
                                                                1
                                                        );
                                                }
                                        }
                                }
                                const after = Math.max(before - adjustedLoss, 0);
                                const appliedLoss = before - after;
                                const adjustmentPercent = loss > 0 ? Math.round((appliedLoss / loss) * 100) : 100;
                                data.rate = after;
                                if (data.rate !== before) {
                                        data.rateChanged = true;
                                        recordRateChange(doc.userId, data.rate - before, adjustmentPercent);
                                }
                                totalBonus += adjustedLoss;
                                this.ai.friends.update(doc);
                        }

                        totalBonus += totalBonusFromNonParticipants;

                        const winnerBeforeRate = winnerData.rate;
                        winnerData.rate += totalBonus;
                        if (winnerData.rate !== winnerBeforeRate) {
                                winnerData.rateChanged = true;
                                recordRateChange(winnerFriend.userId, winnerData.rate - winnerBeforeRate);
                        }
                        this.ai.friends.update(winnerDoc);

                        const rankingAfter = friendDocs
                                .map((doc) => {
                                        const ensured = ensureKazutoriData(doc).data;
                                        return hasKazutoriRateHistory(ensured)
                                                ? { userId: doc.userId, rate: ensured.rate }
                                                : null;
                                })
                                .filter((record): record is { userId: string; rate: number } => record != null);
                        const sortedAfter = [...rankingAfter].sort((a, b) =>
                                b.rate === a.rate ? a.userId.localeCompare(b.userId) : b.rate - a.rate
                        );
                        const afterRank = findRateRank(sortedAfter, winnerFriend.userId);

                        ratingInfo = {
                                beforeRate,
                                afterRate: winnerData.rate,
                                beforeRank,
                                afterRank,
                        };

                        const winnerEnsuredData = ensureKazutoriData(winnerFriend.doc).data;
                        winnerEnsuredData.winCount = (winnerEnsuredData.winCount ?? 0) + 1;
                        winnerEnsuredData.lastWinAt = Date.now();
                        if (medal && winnerEnsuredData.winCount > 50) {
                                winnerEnsuredData.medal = (winnerEnsuredData.medal || 0) + 1;
                        }
                        if (winnerEnsuredData.inventory) {
                                if (winnerEnsuredData.inventory.length >= 50) winnerEnsuredData.inventory.shift();
                                winnerEnsuredData.inventory.push(item);
                        } else {
                                winnerEnsuredData.inventory = [item];
                        }
                        winnerFriend.save();
                } else if (totalBonusFromNonParticipants > 0) {
                        const participantDocs = Array.from(participants)
                                .map((userId) => friendDocMap.get(userId))
                                .filter((doc): doc is FriendDoc => doc != null);

                        if (participantDocs.length > 0) {
                                const baseShare = Math.floor(totalBonusFromNonParticipants / participantDocs.length);
                                let remainder = totalBonusFromNonParticipants - baseShare * participantDocs.length;

                                for (const doc of participantDocs) {
                                        const data = ensureKazutoriData(doc).data;
                                        if (baseShare > 0) {
                                                data.rate += baseShare;
                                                data.rateChanged = true;
                                                recordRateChange(doc.userId, baseShare);
                                        }
                                        this.ai.friends.update(doc);
                                }

                                while (remainder > 0) {
                                        const candidates = nonParticipantPenalties.filter((penalty) => penalty.loss > 0);
                                        if (candidates.length === 0) break;

                                        const maxLoss = Math.max(...candidates.map((penalty) => penalty.loss));
                                        let filtered = candidates.filter((penalty) => penalty.loss === maxLoss);
                                        const minRate = Math.min(...filtered.map((penalty) => penalty.data.rate));
                                        filtered = filtered.filter((penalty) => penalty.data.rate === minRate);
                                        const selected = filtered[Math.floor(Math.random() * filtered.length)];

                                        selected.data.rate += 1;
                                        selected.data.rateChanged = true;
                                        recordRateChange(selected.doc.userId, 1);
                                        selected.loss -= 1;
                                        this.ai.friends.update(selected.doc);
                                        remainder--;
                                }
                        } else {
                                let remainder = totalBonusFromNonParticipants;
                                while (remainder > 0) {
                                        const candidates = nonParticipantPenalties.filter((penalty) => penalty.loss > 0);
                                        if (candidates.length === 0) break;
                                        const maxLoss = Math.max(...candidates.map((penalty) => penalty.loss));
                                        let filtered = candidates.filter((penalty) => penalty.loss === maxLoss);
                                        const minRate = Math.min(...filtered.map((penalty) => penalty.data.rate));
                                        filtered = filtered.filter((penalty) => penalty.data.rate === minRate);
                                        const selected = filtered[Math.floor(Math.random() * filtered.length)];

                                        selected.data.rate += 1;
                                        selected.data.rateChanged = true;
                                        recordRateChange(selected.doc.userId, 1);
                                        selected.loss -= 1;
                                        this.ai.friends.update(selected.doc);
                                        remainder--;
                                }
                        }
                }

                for (const penalty of nonParticipantPenalties) {
                        this.ai.friends.update(penalty.doc);
                }

                const winnerUserId = winnerFriend?.userId ?? null;
                for (const userId of participants) {
                        touchedUserIds.add(userId);
                }

                for (const userId of touchedUserIds) {
                        const doc = friendDocMap.get(userId);
                        if (!doc) continue;
                        const { data, updated } = ensureKazutoriData(doc);
                        let touched = false;
                        const aggregate = rateChangeAggregates.get(userId);
                        if (aggregate) {
                                data.lastRateChange = aggregate.delta;
                                data.lastRateChangeGameId = rateUpdateGameId;
                                if (aggregate.hasNegative) {
                                        data.lastRateLossAdjustmentPercent = aggregate.lossAdjustmentPercent ?? 100;
                                } else {
                                        delete data.lastRateLossAdjustmentPercent;
                                }
                                touched = true;
                        }
                        if (participants.has(doc.userId)) {
                                if (winnerUserId) {
                                        data.lastGameResult = doc.userId === winnerUserId ? 'win' : 'lose';
                                } else {
                                        data.lastGameResult = 'no-winner';
                                }
                                touched = true;
                        } else {
                                data.lastGameResult = 'absent';
                                touched = true;
                        }
                        if (updated || touched) {
                                this.ai.friends.update(doc);
                        }
                }

                let strmed = med === -1 ? "有効数字なし" : med != null ? med.equals(new Decimal(Decimal.NUMBER_MAX_VALUE)) ? '∞ (\\(1.8×10^{308}\\))' : med.toString() : "";
		if (strmed.includes("e+")) {
			if (strmed == "Infinity") strmed = "∞";
			strmed = strmed.replace(/^1e/, "");
			strmed = strmed.replace("e", "×");
			strmed = strmed.replace("+", "10^{");
			strmed += "}\\)";
			strmed = "\\(" + strmed;
		}
                const maxnumText = game.maxnum.equals(Decimal.MAX_VALUE) ? '上限なし' : game.maxnum.toString();
                const winnerWinCount = winnerFriend?.doc?.kazutoriData?.winCount ?? 0;
                const winnerMedalCount = medal && winnerWinCount > 50 ? winnerFriend?.doc?.kazutoriData?.medal ?? 0 : null;
                const text = (game.winRank > 0 ? game.winRank === 1 ? "" : "勝利条件 : " + game.winRank + "番目に大きい値\n\n" : "勝利条件 : 中央値 (" + strmed + ")\n\n") + results.join('\n') + '\n\n' + (winner
                        ? serifs.kazutori.finishWithWinner(
                                        acct(winner),
                                        name,
                                        item,
                                        reverse,
                                        perfect,
                                        winnerWinCount,
                                        winnerMedalCount,
                                        ratingInfo ?? undefined
                                )
                        : serifs.kazutori.finishWithNoWinner(item));

		this.ai.post({
			text: text,
			cw: serifs.kazutori.finish,
			renoteId: game.postId
		});

		this.unsubscribeReply(null);
		game.replyKey.forEach((x) => this.unsubscribeReply(x));
	}
}

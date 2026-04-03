/**
 * @packageDocumentation
 *
 * 数取りゲームモジュール
 *
 * ユーザーが数字を1つ選んで投票し、重複しない最大値（or 2番目/中央値）を選んだ
 * ユーザーが勝利するゲーム。レーティングシステムも搭載。
 *
 * @remarks
 * - NOTE: 数取りの自動開催は18.5分間隔のポーリングで確率判定される。
 *       12時/17-23時は50%、それ以外は10%。1-7時は開催しない。
 * - NOTE: 最大値は前回・前々回の参加者数の平均値をベースに計算される。
 * - NOTE: 勝利条件は3種類: 最大値(通常)、2番目に大きい値、中央値。
 * - NOTE: 3%の確率で最大値50〜500倍、2%で最大値1、3%で無限モードになる。
 * - NOTE: 15%で反転モード（昇順で判定）になり、結果発表時に勝者が入れ替わる可能性がある。
 * - NOTE: BAN機能により特定ユーザーを除外可能。
 * - NOTE: 公開投稿限定モードでは、リプライ/引用にリアクションがないユーザーは除外される。
 * - NOTE: レーティングは rate.ts で管理。初期レート1000、勝者は敗者からレートを吸収する。
 * - NOTE: メダルシステム: 勝利数50超かつメダル戦で勝つとメダルを獲得。
 * - NOTE: 4/1（エイプリルフール）は反転モードが追加で反転する。
 * - NOTE: 1/1（元日）は最大値が年数になる。
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
import type Friend from '@/friend';
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
        /** 2人目の勝者ユーザーID（中央値2人勝利モード用） */
        winnerUserId2?: string;
        /** 再集計実施時刻（ミリ秒タイムスタンプ） */
        reaggregatedAt?: number;
};

/**
 * レート計算に必要な準備データをまとめた型
 *
 * @remarks
 * finish() のセクション4〜6で構築される変数群を一括で受け渡すためのコンテキスト。
 * touchedUserIds / rateChangeAggregates はミュータブルなコレクションとして保持し、
 * recordRateChange から直接書き換えられる前提。
 *
 * @internal
 */
type KazutoriRatingContext = {
	/** 今回のゲームに投票したユーザーIDのセット */
	participants: Set<string>;
	/** 勝者のフレンド情報（表示名・doc 更新用） */
	winnerFriend: Friend | null;
	/** 勝者の表示名（未設定なら undefined） */
	name: string | null | undefined;
	/** 全フレンドのドキュメント */
	friendDocs: FriendDoc[];
	/** userId → FriendDoc のマップ */
	friendDocMap: Map<string, FriendDoc>;
	/** レート更新前のランキング（レート降順・同率は userId ソート） */
	sortedBefore: { userId: string; rate: number }[];
	/** 今回のレート変動が発生したゲームのノートID */
	rateUpdateGameId: string;
	/** レートまたは lastGameResult を更新したユーザーIDのセット（ミュータブル） */
	touchedUserIds: Set<string>;
	/** ユーザーごとのレート変動量の集計（ミュータブル） */
	rateChangeAggregates: Map<string, { delta: number; hasNegative: boolean; lossAdjustmentPercent?: number }>;
	/** レート変動を記録するコールバック（rateChangeAggregates / touchedUserIds を更新する） */
	recordRateChange: (userId: string, delta: number, lossAdjustmentPercent?: number) => void;
	/** 敗者ユーザーID → 順位（2位, 3位, ...）。レート減算の按分に使用 */
	loserRankMap: Map<string, number>;
	/** 有効投票者数 */
	totalParticipants: number;
	/** 3人以上ならランクに応じた減算率調整を行うか */
	shouldAdjustByRank: boolean;
	/** 制限時間（480分で上限カット済み） */
	cappedLimitMinutes: number;
	/** 不参加者ペナルティの基準点 */
	penaltyPoint: number;
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
                /** 有効とみなすリアクション（公開投稿限定モードで投票として認めるもの） */
                const reactionKeys = new Set([':mk_discochicken@.:', ':disco_chicken:']);
                const expectedReactions = Array.from(reactionKeys).join(', ');
                /** リプライまたは引用に有効リアクションを付けていたユーザーID */
                const validUserIds = new Set<string>();

                /** ノート一覧から有効リアクションを付けたユーザーを validUserIds に追加する */
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
	 * ゲーム開始可能かどうかを判定する
	 *
	 * @param recentGame - 直近のゲーム
	 * @param _penultimateGame - 前々回のゲーム（未使用だが将来の拡張用）
	 * @param triggerUserId - トリガーしたユーザーID（手動開催時のみ）
	 * @returns 開始可能なら true
	 * @internal
	 */
	private canStartGame(recentGame: Game | null, _penultimateGame: Game | null, triggerUserId: string | undefined): boolean {
		if (recentGame == null) return true;
		const h = new Date().getHours();
		if (!recentGame.isEnded) return false;
		if (h > 0 && h < 8) return false;
		const cooldownMinutes = (recentGame?.votes?.length ?? 2) <= 1 && !triggerUserId ? 110 : 50;
		if (!triggerUserId && Date.now() - (recentGame.finishedAt ?? recentGame.startedAt) < 1000 * 60 * cooldownMinutes) {
			return false;
		}
		return true;
	}

	/**
	 * 今回のゲームの最大値（1/1・2倍ルール適用前）を計算する
	 *
	 * @param recentGame - 直近のゲーム
	 * @param penultimateGame - 前々回のゲーム
	 * @param flg - 管理者フラグ
	 * @returns 最大値（Decimal）
	 * @internal
	 */
	private computeMaxnum(recentGame: Game | null, penultimateGame: Game | null, flg?: string): typeof Decimal {
		let maxnum = new Decimal(
			(Math.floor(((recentGame?.votes?.length || 0) + (penultimateGame?.votes?.length || 0)) / 2) + (Math.random() < 0.5 ? 1 : 0)) || 1
		);
		if (Math.random() < 0.03 && recentGame?.maxnum && recentGame.maxnum.lessThanOrEqualTo(50)) {
			maxnum = maxnum.times(new Decimal(50 + (Math.random() * 450)));
			maxnum = maxnum.floor();
		} else if (Math.random() < 0.02 && recentGame?.maxnum && !recentGame.maxnum.equals(1)) {
			maxnum = new Decimal(1);
		} else if ((Math.random() < 0.03 && recentGame?.maxnum && !recentGame.maxnum.equals(Decimal.MAX_VALUE)) || flg?.includes('inf')) {
			maxnum = Decimal.MAX_VALUE;
		}
		return maxnum;
	}

	/**
	 * 勝利条件（winRank）を計算する
	 *
	 * @param recentGame - 直近のゲーム
	 * @param maxnum - 今回の最大値
	 * @param flg - 管理者フラグ
	 * @returns 1=最大値, 2=2番目, -1=中央値
	 * @internal
	 */
	private computeWinRank(recentGame: Game | null, maxnum: typeof Decimal, flg?: string): number {
		const isMarch = new Date().getMonth() === 2;
		let winRank =
			(recentGame?.winRank ?? 1) <= 1 &&
			this.ai.activeFactor >= 0.5 &&
			Math.random() < (maxnum.equals(Decimal.MAX_VALUE) ? 0.3 : 0.15)
				? 2
				: 1;
		if (isMarch) {
			winRank = winRank === 1 ? 2 : 1;
		}
		if (flg?.includes('med')) {
			winRank = -1;
		} else if (flg?.includes('2nd')) {
			winRank = 2;
		}
		if (
			((recentGame?.winRank ?? 1) > 0 &&
				!flg?.includes('2nd') &&
				this.ai.activeFactor >= 0.5 &&
				Math.random() < (maxnum.equals(Decimal.MAX_VALUE) ? 0.3 : 0.15)) ||
			flg?.includes('med')
		) {
			winRank = -1;
		}
		return winRank;
	}

	/**
	 * 制限時間（分）を計算する
	 *
	 * @param recentGame - 直近のゲーム
	 * @param flg - 管理者フラグ
	 * @param triggerUserId - トリガーしたユーザーID（短時間モードの抽選に使用）
	 * @returns 制限時間（分）
	 * @internal
	 */
	private computeLimitMinutes(recentGame: Game | null, flg?: string, triggerUserId?: string): number {
		const now = new Date();
		/** 基本の制限時間: 10%で短時間(1 or 2分)、90%で5 or 10分 */
		let limitMinutes = Math.random() < 0.1 && this.ai.activeFactor >= 0.75 ? (Math.random() < 0.5 && !triggerUserId ? 1 : 2) : Math.random() < 0.5 ? 5 : 10;
		const isSameDate = (left: Date, right: Date) =>
			left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
		const recentGameDate = recentGame ? new Date(recentGame.startedAt) : null;
		const yesterday = new Date(now);
		yesterday.setDate(now.getDate() - 1);
		/** 前回ゲームが昨日だったか（今日1回目ボーナス用） */
		const isRecentGameYesterday = recentGameDate ? isSameDate(recentGameDate, yesterday) : false;
		/** 8〜10時か（昨日1回目かつ今朝なら長時間モードの抽選対象） */
		const isYesterdayFirstGameBoostTime = now.getHours() >= 8 && now.getHours() < 10;
		/** 高機嫌かつ0.1%で長時間（14時未満のみ） */
		const hasHighMoodRareLongLimit = this.ai.activeFactor >= 1 && Math.random() < 0.001 && now.getHours() < 14;
		const hasForcedLongLimit = flg?.includes('lng');
		/** 前回が昨日の1回目かつ今朝で50%で長時間 */
		const hasMorningYesterdayLongLimit =
			this.ai.activeFactor > 0.75 && isRecentGameYesterday && isYesterdayFirstGameBoostTime && Math.random() < 0.5;
		const hasLongLimit = hasHighMoodRareLongLimit || hasForcedLongLimit || hasMorningYesterdayLongLimit;
		if (hasLongLimit) {
			limitMinutes *= 48;
		}
		if (this.ai.activeFactor < 0.75 && !hasLongLimit) {
			limitMinutes = Math.floor(1 / (1 - Math.min((1 - this.ai.activeFactor) * 1.2 * (0.7 + Math.random() * 0.3), 0.8)) * limitMinutes / 5) * 5;
		}
		return limitMinutes;
	}

	/**
	 * 公開範囲と公開投稿限定フラグを計算する
	 *
	 * @param recentGame - 直近のゲーム
	 * @param triggerUserId - トリガーしたユーザーID
	 * @returns visibility と publicOnly
	 * @internal
	 */
	private computeVisibilityAndPublicOnly(recentGame: Game | null, triggerUserId: string | undefined): { visibility?: string; publicOnly: boolean } {
		/** 公開投稿のみ受付けるモードか */
		let publicOnly = false;
		/** フォロワー限定で投稿するか（自然発生かつ3%で true） */
		let visibility: string | undefined;
		if (this.ai.activeFactor >= 0.85) {
			visibility = Math.random() < 0.03 && !triggerUserId ? 'followers' : undefined;
			if (!visibility) {
				publicOnly = this.ai.activeFactor >= 0.5 && !recentGame?.publicOnly && (recentGame?.publicOnly == null || Math.random() < 0.005);
			}
		}
		return { visibility, publicOnly };
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
	private async start(triggerUserId?: string, flg?: string) {
		this.ai.decActiveFactor();

		const games = this.games.find({});
		/** 直近のゲーム（開始可否・maxnum 計算の基準） */
		const recentGame = games.length === 0 ? null : games[games.length - 1];
		/** 前々回のゲーム（最大値の参加者数計算用） */
		const penultimateGame = recentGame && games.length > 1 ? games[games.length - 2] : null;

		/** maxnum が DB から string/number で入っている場合の正規化 */
		if (recentGame?.maxnum) {
			const maxnum = recentGame.maxnum as unknown;
			const needsConversion = typeof maxnum === 'string' || typeof maxnum === 'number' || typeof (maxnum as { equals?: unknown }).equals !== 'function';
			if (needsConversion) {
				recentGame.maxnum = maxnum === 'Infinity' ? Decimal.MAX_VALUE : new Decimal(maxnum as string | number);
			}
		}

		if (!this.canStartGame(recentGame, penultimateGame, triggerUserId)) return;

		let maxnum = this.computeMaxnum(recentGame, penultimateGame, flg);
		const now = new Date();
		if (now.getMonth() === 0 && now.getDate() === 1) {
			maxnum = new Decimal(now.getFullYear());
		}

		const winRank = this.computeWinRank(recentGame, maxnum, flg);
		let { visibility, publicOnly } = this.computeVisibilityAndPublicOnly(recentGame, triggerUserId);
		if (flg?.includes('pub')) {
			publicOnly = true;
			visibility = undefined;
		}

		const limitMinutes = this.computeLimitMinutes(recentGame, flg, triggerUserId);

		/** 2番目/中央値モード時は75%で最大値を2倍 */
		if (maxnum.greaterThan(0) && winRank !== 1 && Math.random() < 0.75) {
			maxnum = maxnum.times(2);
		}
		/** 1時間以上かつ最大値9以下なら75%で2倍 */
		if (limitMinutes >= 60 && maxnum.greaterThan(0) && maxnum.lessThanOrEqualTo(9) && Math.random() < 0.75) {
			maxnum = maxnum.times(2);
		}

		/** 開催投稿用の最大値表示文字列 */
		const maxnumText = this.formatMaxnumForDisplay(maxnum, '上限なし');
		const post = await this.ai.post({
			text: !publicOnly ? serifs.kazutori.intro(maxnumText, limitMinutes, winRank, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)) : serifs.kazutori.introPublicOnly(maxnumText, limitMinutes, winRank, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)),
			...(visibility ? { visibility } : {}),
		});

		this.games.insertOne({
			votes: [],
			isEnded: false,
			startedAt: Date.now(),
			finishedAt: Date.now() + 1000 * 60 * limitMinutes,
			limitMinutes,
			winRank,
			postId: post.id,
			maxnum,
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
			/** 親愛度・公開範囲に応じたクールダウン倍率（高親愛度ほど短い / 限定公開なら1.5倍） */
			const cooldownMultiplier = Math.max((msg.friend.love >= 200 ? 1.2 : msg.friend.love >= 100 ? 1.5 : msg.friend.love >= 20 ? 2 : msg.friend.love >= 5 ? 4 : 8) * (["public", "home"].includes(msg.visibility) ? 1 : 1.5), 1);
			const cooldownBaseAt = recentGame.finishedAt ?? recentGame.startedAt;

                        // トリガー者が管理人でない かつ クールタイムが開けていない場合
                        if ((msg.user.host || msg.user.username !== config.master) && Date.now() - cooldownBaseAt < 1000 * 60 * 30 * cooldownMultiplier) {
                                const cooldownMs = 1000 * 60 * 30 * cooldownMultiplier;
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
                if (msg.text == null) {
                        return { reaction: 'hmm' };
                }

                // BAN ユーザーは投票不可
                if (this.isBannedUser(msg.user)) {
                        msg.reply(serifs.kazutori.banned, { visibility: 'specified' });
                        return { reaction: 'confused' };
                }

                const game = this.games.findOne({ isEnded: false });
                if (game == null) return;

                // トリガー1分制限・公開限定・重複のチェック
                const validation = await this.validateVoteSubmission(game, msg);
                if (!validation.valid) {
                        return { reaction: validation.reaction };
                }

                const parsed = this.parseVoteNumber(msg.extractedText);
                if ('error' in parsed) {
                        await new Promise<void>((resolve) => {
                                msg.reply(parsed.error).then((reply) => {
                                        game.replyKey.push(msg.userId);
                                        this.games.update(game);
                                        this.subscribeReply(msg.userId, reply.id);
                                        resolve();
                                });
                        });
                        return { reaction: parsed.reaction };
                }

                // 0〜maxnum の範囲内かチェック
                if (!(await this.ensureVoteInRange(game, parsed.num, msg))) {
                        return { reaction: 'confused' };
                }

                this.log(`Voted ${parsed.num.toString()} by ${msg.user.id}`);
                this.recordVote(game, msg, parsed.num);

                return { reaction: ':mk_discochicken:' };
        }

	/**
	 * 投票前のバリデーション（トリガー1分制限・公開限定・重複）を行い、無効なら reply と reaction を返す
	 *
	 * @param game - 進行中ゲーム
	 * @param msg - 受信メッセージ
	 * @returns 有効なら { valid: true }、無効なら { valid: false, reaction }
	 * @internal
	 */
	private async validateVoteSubmission(
		game: Game,
		msg: Message
	): Promise<{ valid: true } | { valid: false; reaction: string }> {
		const time = Date.now() - game.startedAt;
		if (game.triggerUserId === msg.user.id && time < 60 * 1000 && msg.visibility !== 'specified') {
			await new Promise<void>((resolve) => {
				msg.reply(`\n${60 - Math.floor(time / 1000)}秒後にもう一度送ってください！`, { visibility: 'specified' }).then((reply) => {
					game.replyKey.push(msg.userId);
					this.games.update(game);
					this.subscribeReply(msg.userId, reply.id);
					resolve();
				});
			});
			return { valid: false, reaction: '❌' };
		}
		if (game.publicOnly && ((msg.visibility !== 'public' && msg.visibility !== 'home') || msg.localOnly)) {
			const visibility =
				msg.visibility === 'followers' ? 'フォロワー限定' :
				msg.visibility === 'specified' ? 'ダイレクト' :
				msg.user.host == null ? 'ローカル＆フォロワー' : '';
			await new Promise<void>((resolve) => {
				msg.reply(`\n公開投稿限定です！\n参加するには${visibility ? '「' + visibility + '」ではなく、' : ''}「公開」または「ホーム」の公開範囲にてリプライしてくださいね～`).then((reply) => {
					game.replyKey.push(msg.userId);
					this.games.update(game);
					this.subscribeReply(msg.userId, reply.id);
					resolve();
				});
			});
			return { valid: false, reaction: 'confused' };
		}
		if (game.votes.some((x) => x.user.id === msg.userId)) {
			await new Promise<void>((resolve) => {
				msg.reply('すでに投票済みの様です！').then((reply) => {
					game.replyKey.push(msg.userId);
					this.games.update(game);
					this.subscribeReply(msg.userId, reply.id);
					resolve();
				});
			});
			return { valid: false, reaction: 'confused' };
		}
		return { valid: true };
	}

	/**
	 * テキストから投票数値をパースする（全角→半角、∞、21桁以上は丸め）
	 *
	 * @param text - 抽出済みテキスト
	 * @returns 成功時は { num }、失敗時は { error: ユーザー向けメッセージ, reaction }
	 * @internal
	 */
	private parseVoteNumber(text: string): { num: typeof Decimal } | { error: string; reaction: string } {
		const normalizedText = text.replace(/[０-９]/g, (m) => '０１２３４５６７８９'.indexOf(m).toString());
		const matches = normalizedText.match(/[0-9]+|∞/g);
		if (matches == null) {
			return { error: 'リプライの中に数字が見つかりませんでした！', reaction: 'hmm' };
		}
		if (matches.length >= 2) {
			return { error: '数取りでは2個以上の数値に投票する事は出来ません。小数を指定した場合は、整数で指定するようにしてください。', reaction: 'confused' };
		}
		const match = matches[0];
		if (match === '∞') {
			return { num: new Decimal(Decimal.NUMBER_MAX_VALUE) };
		}
		const numStr = match.replace(/^0+/, '') || '0';
		if (numStr.length > 20) {
			const mantissaDigits = 3;
			const mantissaStr = numStr.slice(0, mantissaDigits + 1);
			let exponent = numStr.length - 1;
			let mantissaNum = parseInt(mantissaStr.slice(0, mantissaDigits), 10);
			const nextDigit = parseInt(mantissaStr.charAt(mantissaDigits), 10);
			if (nextDigit >= 5) mantissaNum += 1;
			if (mantissaNum >= Math.pow(10, mantissaDigits)) {
				mantissaNum = mantissaNum / 10;
				exponent += 1;
			}
			const mantissa = mantissaNum / Math.pow(10, mantissaDigits - 1);
			return { num: new Decimal(`${mantissa}e${exponent}`) };
		}
		return { num: new Decimal(numStr) };
	}

	/**
	 * 投票数値がゲームの範囲内か確認し、範囲外なら reply して false を返す
	 *
	 * @param game - 進行中ゲーム（maxnum の型正規化を行う）
	 * @param num - 投票数値
	 * @param msg - 受信メッセージ
	 * @returns 範囲内なら true、範囲外なら false
	 * @internal
	 */
	private async ensureVoteInRange(game: Game, num: typeof Decimal, msg: Message): Promise<boolean> {
		this.normalizeGameMaxnum(game);
		if (game.maxnum && game.maxnum.greaterThan(0) && (num.lessThan(0) || num.greaterThan(game.maxnum))) {
			const strn = this.formatNumberForResult(num);
			const maxStr = this.formatMaxnumForDisplay(game.maxnum);
			await new Promise<void>((resolve) => {
				msg.reply(`\n「${strn}」は今回のゲームでは範囲外です！\n0~${maxStr}の範囲で指定してくださいね！`).then((reply) => {
					game.replyKey.push(msg.userId);
					this.games.update(game);
					this.subscribeReply(msg.userId, reply.id);
					resolve();
				});
			});
			return false;
		}
		return true;
	}

	/**
	 * 投票をゲームに記録し、プレイ回数を更新する
	 *
	 * @param game - 進行中ゲーム
	 * @param msg - 受信メッセージ
	 * @param num - 投票数値
	 * @internal
	 */
	private recordVote(game: Game, msg: Message, num: typeof Decimal): void {
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
	}

	/**
	 * 中央値の表示用文字列を返す（-1 → '有効数字なし'、undefined → ''、それ以外 → formatNumberForResult）
	 *
	 * @param n - 中央値（Decimal）、-1（有効数字なし）、または undefined（非中央値モード）
	 * @returns 表示用文字列
	 * @internal
	 */
	private formatNumberOrSentinel(n: typeof Decimal | -1 | undefined): string {
		if (n === -1) return '有効数字なし';
		if (n == null) return '';
		return this.formatNumberForResult(n);
	}

	/**
	 * 結果表示用に数値をフォーマットする（∞表記・指数表記の整形）
	 *
	 * @param n - 表示する数値（Decimal）
	 * @returns 結果投稿用の文字列
	 * @internal
	 */
	private formatNumberForResult(n: typeof Decimal): string {
		let strn = n.equals(new Decimal(Decimal.NUMBER_MAX_VALUE))
			? '∞ (\\(1.8×10^{308}\\))'
			: n.toString();
		if (strn.includes('e+')) {
			if (strn === 'Infinity') strn = '∞ (\\(1.8×10^{308}\\))';
			strn = strn.replace(/^1e/, '');
			strn = strn.replace('e', '×');
			strn = strn.replace('+', '10^{');
			strn += '}\\)';
			strn = '\\(' + strn;
		}
		return strn;
	}

	/**
	 * 重複のない数値配列の中央値を計算する
	 *
	 * @param arr - 昇順ソート済みの Decimal 配列
	 * @returns 中央値。要素が0個の場合は -1（sentinel）
	 * @internal
	 */
	private computeMedian(arr: (typeof Decimal)[]): typeof Decimal | -1 {
		if (arr.length === 0) return -1;
		if (arr.length % 2 === 0) {
			return arr[arr.length / 2 - 1].plus(arr[arr.length / 2]).dividedBy(2);
		}
		return arr[(arr.length + 1) / 2 - 1];
	}

	/**
	 * 終了処理用に有効な投票のみにフィルタする（公開限定・ブロック・親愛度）
	 *
	 * @param game - 対象ゲーム（game.votes は参照のみ、呼び出し元で game.votes を上書きする）
	 * @returns 有効な投票の配列
	 * @internal
	 */
	private async filterValidVotesForFinish(game: Game): Promise<Game['votes']> {
		const filteredVotes: Game['votes'] = [];
		/** 公開限定モード時、リプライ/引用に有効リアクションを付けたユーザーID（null なら制限なし） */
		const publicOnlyVoteUserIds = game.publicOnly ? await this.collectPublicOnlyVoteUserIds(game.postId) : null;

		for (const vote of game.votes) {
			/** 公開限定で且つリアクション未付きなら除外し、playCount を1戻す */
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
			/** 親愛度が10超ならブロック未取得でも有効とする */
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

		return filteredVotes;
	}

	/**
	 * maxnum を表示用文字列に変換する（MAX_VALUE / Infinity の場合はラベルに置換）
	 *
	 * @param maxnum - 対象の最大値
	 * @param infinityLabel - 無限大のときに表示するラベル（既定値 '∞'）
	 * @returns 表示用文字列
	 * @internal
	 */
	private formatMaxnumForDisplay(maxnum: typeof Decimal, infinityLabel: string = '∞'): string {
		return maxnum.equals(Decimal.MAX_VALUE) || maxnum.toString() === 'Infinity' ? infinityLabel : maxnum.toString();
	}

	/**
	 * レートランキング用の降順比較関数（同率は userId の辞書順で安定ソート）
	 *
	 * @param a - 比較対象A
	 * @param b - 比較対象B
	 * @returns b.rate が大きければ正、同率なら userId の辞書順で比較
	 * @internal
	 */
	private compareByRateDesc(a: { userId: string; rate: number }, b: { userId: string; rate: number }): number {
		return b.rate === a.rate ? a.userId.localeCompare(b.userId) : b.rate - a.rate;
	}

	/**
	 * Decimal の昇順比較関数（Array.sort 用）
	 *
	 * @param a - 比較元
	 * @param b - 比較先
	 * @returns a < b なら -1、a > b なら 1、等しければ 0
	 * @internal
	 */
	private compareDecimalAsc(a: typeof Decimal, b: typeof Decimal): number {
		if (a.lessThan(b)) return -1;
		if (a.greaterThan(b)) return 1;
		return 0;
	}

	/**
	 * Decimal の降順比較関数（Array.sort 用）
	 *
	 * @param a - 比較元
	 * @param b - 比較先
	 * @returns a > b なら -1、a < b なら 1、等しければ 0
	 * @internal
	 */
	private compareDecimalDesc(a: typeof Decimal, b: typeof Decimal): number {
		return -this.compareDecimalAsc(a, b);
	}

	/**
	 * Decimal の絶対値を返す
	 *
	 * @param value - 対象値
	 * @returns 絶対値
	 * @internal
	 */
	private decimalAbs(value: typeof Decimal): typeof Decimal {
		if (value.lessThan(Decimal.ZERO)) {
			return value.times(-1);
		}
		return value;
	}

	/**
	 * メダル戦かどうかを判定する（参加者の過半数が勝利数50以上）
	 *
	 * @param game - 対象ゲーム
	 * @returns メダル戦なら true
	 * @internal
	 */
	private isMedalMatch(game: Game): boolean {
		return game.votes?.length > 1 && game.votes?.filter((x) => x.user.winCount < 50).length < game.votes?.filter((x) => x.user.winCount >= 50).length;
	}

	/**
	 * game.maxnum が文字列（DB復元時など）の場合に Decimal に正規化する
	 *
	 * @remarks
	 * LokiJS からの復元時に maxnum が文字列として保存されるケースがあるため、
	 * 参照する前に必ず呼び出すことで型安全を確保する。
	 *
	 * @param game - 対象ゲーム（maxnum を in-place で書き換える）
	 * @internal
	 */
	private normalizeGameMaxnum(game: Game): void {
		if (typeof game.maxnum === 'string') {
			game.maxnum = game.maxnum === 'Infinity' ? Decimal.MAX_VALUE : new Decimal(game.maxnum);
		}
	}

	/**
	 * お流れ（無効試合）の場合に playCount 戻し・機嫌減少・投稿を行い true を返す
	 *
	 * @param game - 対象ゲーム（投票はフィルタ済み前提）
	 * @param item - お流れ投稿で使用するアイテム名
	 * @returns お流れだった場合 true、そうでなければ false
	 * @internal
	 */
	private async handleOnagareIfNeeded(game: Game, item: string): Promise<boolean> {
		const medal = this.isMedalMatch(game);
		const hasInsufficientParticipants = game.votes.length < 4;

		/** お流れ条件: 参加者4人未満 または (勝利数50未満が1人以下 かつ メダル戦でない) */
		if (hasInsufficientParticipants || (game.votes?.filter((x) => x.user.winCount < 50).length <= 1 && !medal)) {
			game.votes.forEach((x) => {
				const friend = this.ai.lookupFriend(x.user.id);
				if (friend) {
					const { data } = ensureKazutoriData(friend.doc);
					data.playCount = Math.max((data.playCount ?? 0) - 1, 0);
					friend.save();
				}
			});
			this.ai.decActiveFactor((game.finishedAt.valueOf() - game.startedAt.valueOf()) / (60 * 1000 * 100) * Math.max(1 - (game.votes.length / 3), 0));

			if (this.ai.activeFactor < 0.5 || game.votes.length < 1) return true;

			this.ai.post({
				text: serifs.kazutori.onagare(item),
				renoteId: game.postId,
			});
			return true;
		}
		return false;
	}

	/**
	 * 勝者・結果リスト・反転の計算を行う
	 *
	 * @param game - 対象ゲーム（votes / maxnum は正規化済み前提）
	 * @returns results, winner, reverse, perfect, medianValue
	 * @internal
	 */
	private computeWinnerAndResults(game: Game): {
		results: string[];
		winner: Game['votes'][0]['user'] | null;
		winner2: Game['votes'][0]['user'] | null;
		reverse: boolean;
		perfect: boolean;
		medianValue: typeof Decimal | -1 | undefined;
	} {
		/** 結果投稿用の行リスト（例: "🎉 **42**: $[jelly @user]" / "➖ 10: @user" / "❌ 5: @a @b"） */
		let results: string[] = [];
		/** 確定した勝者のユーザー情報 */
		let winner: Game['votes'][0]['user'] | null = null;
		/** 2人目の勝者ユーザー情報（中央値2人勝利モード） */
		let winner2: Game['votes'][0]['user'] | null = null;
		/** 反転モード適用時の結果行リスト */
		let reverseResults: string[] = [];
		/** 反転モード適用時の勝者 */
		let reverseWinner: Game['votes'][0]['user'] | null = null;

		/** 通常判定用の勝利条件カウンタ（2番目なら 2→1 とデクリメント） */
		let winRank = game.winRank ?? 1;
		/** 反転判定用の勝利条件カウンタ */
		let reverseWinRank = game.winRank ?? 1;

		/** 反転モードにしたか（確率: 最大値なら30%、それ以外15%） */
		let reverse = Math.random() < (winRank === 1 ? 0.15 : 0.3);
		const now = new Date();

		/** 投票されたユニークな数値のリスト（降順で使用） */
		const useNumbers = Array.from(new Set(game.votes.map((x) => x.number.toString()))).map((s) => new Decimal(s));
		useNumbers.sort((a, b) => {
			if (a.greaterThan(b)) return -1;
			if (a.lessThan(b)) return 1;
			return 0;
		});

		/** 中央値モード時の中央値（winRank !== -1 のときは未使用） */
		let medianValue: typeof Decimal | -1 | undefined;
		if (winRank === -1) {
			/** 重複のない数値のみで中央値を計算するため、1人だけの数値を抽出 */
			const uniqueNumbers = useNumbers.filter((n) => {
				const users = game.votes.filter((x) => x.number.equals(n)).map((x) => x.user);
				return users.length === 1;
			});
			const inOrderArr = uniqueNumbers.slice().sort((a, b) => this.compareDecimalAsc(a, b));
			medianValue = this.computeMedian(inOrderArr);
		} else {
			medianValue = undefined;
		}

		if (winRank === -1 && medianValue !== -1 && medianValue !== undefined) {
			const voteInfos = game.votes.map((vote, index) => ({
				index,
				number: vote.number,
				users: game.votes.filter((x) => x.number.equals(vote.number)).map((x) => x.user),
			}));
			const uniqueVoteInfos = voteInfos
				.filter((info) => info.users.length === 1)
				.filter((info, index, arr) => index === arr.findIndex((x) => x.number.equals(info.number)));
			const sortedCandidates = uniqueVoteInfos
				.map((info) => ({
					info,
					diff: this.decimalAbs(info.number.minus(medianValue as typeof Decimal)),
				}))
				.sort((a, b) => {
					const diffCompare = this.compareDecimalAsc(a.diff, b.diff);
					if (diffCompare !== 0) return diffCompare;
					return a.info.index - b.info.index;
				});

			const primary = sortedCandidates[0];
			winner = primary?.info.users[0] ?? null;
			winner2 = null;

			if (primary) {
				const hasExactMatch = this.compareDecimalAsc(primary.diff, new Decimal(0)) === 0;
				if (!hasExactMatch) {
					const sameDistance = sortedCandidates.filter((x) => this.compareDecimalAsc(x.diff, primary.diff) === 0);
					if (sameDistance.length === 2) {
						winner2 = sameDistance[1].info.users[0] ?? null;
					}
				}
			}

			const winnerIds = new Set([winner?.id, winner2?.id].filter((x): x is string => x != null));
			for (let i = 0; i < useNumbers.length; i++) {
				const n = useNumbers[i];
				const strn = this.formatNumberForResult(n);
				const users = game.votes.filter((x) => x.number.equals(n)).map((x) => x.user);

				if (users.length === 1) {
					if (winnerIds.has(users[0].id)) {
						const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
						results.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
					} else {
						results.push(`➖ ${strn}: ${acct(users[0])}`);
					}
				} else if (users.length > 1) {
					results.push(`❌ ${strn}: ${users.map((u) => acct(u)).join(' ')}`);
				}
			}
		} else {
			for (let i = 0; i < useNumbers.length; i++) {
			const n = useNumbers[i];
			const strn = this.formatNumberForResult(n);
			const users = game.votes.filter((x) => x.number.equals(n)).map((x) => x.user);

			if (users.length === 1) {
				if (winner == null) {
					if (winRank === -1) {
						if (medianValue !== -1 && medianValue !== undefined && n.equals(medianValue)) {
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
		}

		if (game.winRank !== -1 && game.winRank != null) {
			useNumbers.sort((a, b) => this.compareDecimalAsc(a, b));
			for (let i = 0; i < useNumbers.length; i++) {
				const n = useNumbers[i];
				const strn = this.formatNumberForResult(n);
				const users = game.votes.filter((x) => x.number.equals(n)).map((x) => x.user);

				if (users.length === 1) {
					if (reverseWinner == null) {
						if (reverseWinRank > 1) {
							reverseWinRank -= 1;
							reverseResults.push(`➖ ${strn}: ${acct(users[0])}`);
						} else {
							reverseWinner = users[0];
							const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
							reverseResults.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
						}
					} else {
						reverseResults.push(`➖ ${strn}: ${acct(users[0])}`);
					}
				} else if (users.length > 1) {
					reverseResults.push(`❌ ${strn}: ${users.map((u) => acct(u)).join(' ')}`);
				}
			}
		} else {
			reverseResults = results;
			reverseWinner = winner;
		}

		/** 勝利数差による反転の追加判定（メダル戦でないときのみ。勝者と反転勝者の勝利数差で確率反転） */
		const medalForReverse = this.isMedalMatch(game);
		if (!medalForReverse && config.kazutoriWinDiffReverseEnabled) {
			const winDiff = (Math.min(winner?.winCount ?? 0, 50)) - (Math.min(reverseWinner?.winCount ?? 0, 50));
			if (!reverse && winner && winDiff > 10 && Math.random() < Math.min((winDiff - 10) * 0.02, 0.7)) {
				reverse = !reverse;
			} else if (reverse && reverseWinner && winDiff < -10 && Math.random() < Math.min((winDiff + 10) * -0.02, 0.7)) {
				reverse = !reverse;
			}
		}

		/** 反転しても同じ勝者だった場合は「完全勝利」として表示（反転は適用しない） */
		let perfect = false;
		if (!winner || !reverseWinner || winner?.id === reverseWinner?.id) {
			perfect = (game.winRank ?? 1) !== -1;
			reverse = false;
		}

		if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

		if (reverse) {
			results = reverseResults;
			winner = reverseWinner;
			winner2 = null;
		}

		// 4/1: 表示用の反転フラグを再度反転（ジョーク）
		if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

		return { results, winner, winner2, reverse, perfect, medianValue };
	}

	/**
	 * 不参加者にレートペナルティを適用する（レート1000超過分から減算）
	 *
	 * @param friendDocs - 全フレンドドキュメント
	 * @param participants - 参加者ユーザーIDのセット
	 * @param winnerUserId - 勝者ユーザーID（ペナルティ対象外）
	 * @param cappedLimitMinutes - 制限時間（分・上限480）
	 * @param penaltyPoint - ペナルティ基準点
	 * @param recordRateChange - レート変動記録コールバック
	 * @returns 不参加者から没収した合計ボーナスとペナルティ適用情報
	 * @internal
	 */
	private applyNonParticipantPenalties(
		friendDocs: FriendDoc[],
		participants: Set<string>,
		winnerUserIds: Set<string>,
		cappedLimitMinutes: number,
		penaltyPoint: number,
		recordRateChange: (userId: string, delta: number, lossAdjustmentPercent?: number) => void
	): { totalBonusFromNonParticipants: number; nonParticipantPenalties: { doc: FriendDoc; data: EnsuredKazutoriData; loss: number }[] } {
		/** 不参加者ごとのペナルティ情報（後で勝者なし時に配分するため loss を保持） */
		const nonParticipantPenalties: { doc: FriendDoc; data: EnsuredKazutoriData; loss: number }[] = [];
		let totalBonusFromNonParticipants = 0;

		for (const doc of friendDocs) {
			if (winnerUserIds.has(doc.userId)) continue;
			if (participants.has(doc.userId)) continue;
			const data = ensureKazutoriData(doc).data;
			if (data.rate > 1000) {
				/** 1000 を超えている分（この範囲内でしか減算しない） */
				const rateExcess = data.rate - 1000;
				/** 500 ごとの段階数（レートが高いほどペナルティ倍率アップ） */
				const increaseSteps = Math.floor(rateExcess / 500);
				const multiplier = 1 + increaseSteps * 0.5;
				const calculatedLoss = penaltyPoint * multiplier;
				const loss = Math.min(Math.ceil(calculatedLoss), rateExcess);
				/** 2000 超かつ長時間ゲーム時の最低減算（高レート維持のため） */
				const minimumLoss =
					data.rate >= 2000 && cappedLimitMinutes > 4
						? Math.floor((data.rate - 1920) / 80)
						: 0;
				/** 実際に引く量（minimumLoss 以上 rateExcess 以下にクランプ） */
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
		return { totalBonusFromNonParticipants, nonParticipantPenalties };
	}

	/**
	 * 勝者にボーナス・敗者にレート減算を適用し、勝者の勝利数・メダル・インベントリを更新する
	 *
	 * @param game - 対象ゲーム（votes を使用）
	 * @param winner - 勝者ユーザー情報
	 * @param winnerFriend - 勝者のフレンド情報（null なら何もしない）
	 * @param friendDocMap - userId → FriendDoc のマップ
	 * @param loserRankMap - 敗者ユーザーID → 順位（2位, 3位, ...）。ランク按分に使用
	 * @param totalParticipants - 参加者数
	 * @param shouldAdjustByRank - ランクに応じた減算率の緩和を行うか
	 * @param sortedBefore - レート更新前のランキング（勝者順位表示用）
	 * @param friendDocs - 全フレンド（更新後ランキング計算用）
	 * @param cappedLimitMinutes - 制限時間（分・上限480）
	 * @param totalBonusFromNonParticipants - 不参加者から没収した合計（勝者に加算）
	 * @param recordRateChange - レート変動記録コールバック
	 * @param item - 勝者に付与するアイテム名
	 * @param medal - メダル戦か（勝利数50超でメダル付与するか）
	 * @returns 勝者情報があればレート・順位の前後。なければ null
	 * @internal
	 */
	private applyWinnerAndLoserRates(
		game: Game,
		winner: Game['votes'][0]['user'] | null,
		winner2: Game['votes'][0]['user'] | null,
		winnerFriend: ReturnType<Module['ai']['lookupFriend']>,
		winnerFriend2: ReturnType<Module['ai']['lookupFriend']>,
		friendDocMap: Map<string, FriendDoc>,
		loserRankMap: Map<string, number>,
		totalParticipants: number,
		shouldAdjustByRank: boolean,
		sortedBefore: { userId: string; rate: number }[],
		friendDocs: FriendDoc[],
		cappedLimitMinutes: number,
		totalBonusFromNonParticipants: number,
		recordRateChange: (userId: string, delta: number, lossAdjustmentPercent?: number) => void,
		item: string,
		medal: boolean
	): {
		beforeRate: number;
		afterRate: number;
		beforeRank?: number;
		afterRank?: number;
		beforeRate2?: number;
		afterRate2?: number;
		beforeRank2?: number;
		afterRank2?: number;
	} | null {
		const winnerDoc = winnerFriend ? friendDocMap.get(winnerFriend.userId) : null;
		if (!winnerFriend || !winnerDoc) return null;
		const winnerDoc2 = winnerFriend2 ? friendDocMap.get(winnerFriend2.userId) : null;
		const hasSecondWinner = game.winRank === -1 && winner2 != null && winnerFriend2 != null && winnerDoc2 != null;

		const winnerData = ensureKazutoriData(winnerDoc).data;
		const beforeRate = winnerData.rate;
		const beforeRank = findRateRank(sortedBefore, winnerFriend.userId);
		/** 敗者のレートから没収する割合の基準（制限時間が長いほど大きい） */
		const baseLossRatio = cappedLimitMinutes * 0.004;
		const lossRatio = Math.max(
			baseLossRatio <= 0.04
				? baseLossRatio
				: 0.04 + (cappedLimitMinutes - 10) * (1 / 12000),
			0.02
		);
		/** 敗者から没収した合計（＝勝者に渡すボーナス） */
		let totalBonus = 0;

		for (const vote of game.votes) {
			if (vote.user.id === winnerFriend.userId) continue;
			if (hasSecondWinner && vote.user.id === winnerFriend2?.userId) continue;
			const doc = friendDocMap.get(vote.user.id);
			if (!doc) continue;
			const data = ensureKazutoriData(doc).data;
			const before = data.rate;
			const loss = Math.max(Math.ceil(before * lossRatio), 1);
			/** ランク按分後の実際の減算量 */
			let adjustedLoss = loss;
			if (shouldAdjustByRank) {
				const rank = loserRankMap.get(vote.user.id);
				if (rank != null && rank >= 2) {
					/** 上位半分まで減算を緩和（2位が一番緩い） */
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
			/** 没収率に対する実際の減算率（%）。表示用 */
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

		let winnerGain = totalBonus;
		let winner2Gain = 0;
		let beforeRate2: number | undefined;
		let beforeRank2: number | undefined;
		if (hasSecondWinner && winnerFriend2 && winnerDoc2) {
			winnerGain = Math.floor(totalBonus / 2);
			winner2Gain = Math.floor(totalBonus / 2);
			const remainder = totalBonus - winnerGain - winner2Gain;
			if (remainder > 0) {
				const winnerRate = winnerData.rate;
				const winner2Data = ensureKazutoriData(winnerDoc2).data;
				const winner2Rate = winner2Data.rate;
				if (winnerRate < winner2Rate) {
					winnerGain += remainder;
				} else if (winnerRate > winner2Rate) {
					winner2Gain += remainder;
				} else {
					const winnerVoteIndex = game.votes.findIndex((x) => x.user.id === winnerFriend.userId);
					const winner2VoteIndex = game.votes.findIndex((x) => x.user.id === winnerFriend2.userId);
					if (winnerVoteIndex >= 0 && winner2VoteIndex >= 0 && winnerVoteIndex !== winner2VoteIndex) {
						if (winnerVoteIndex < winner2VoteIndex) {
							winnerGain += remainder;
						} else {
							winner2Gain += remainder;
						}
					} else if (Math.random() < 0.5) {
						winnerGain += remainder;
					} else {
						winner2Gain += remainder;
					}
				}
			}
			beforeRate2 = ensureKazutoriData(winnerDoc2).data.rate;
			beforeRank2 = findRateRank(sortedBefore, winnerFriend2.userId);
		}

		const winnerBeforeRate = winnerData.rate;
		winnerData.rate += winnerGain;
		if (winnerData.rate !== winnerBeforeRate) {
			winnerData.rateChanged = true;
			recordRateChange(winnerFriend.userId, winnerData.rate - winnerBeforeRate);
		}
		this.ai.friends.update(winnerDoc);

		if (hasSecondWinner && winnerFriend2 && winnerDoc2) {
			const winner2Data = ensureKazutoriData(winnerDoc2).data;
			const winnerBeforeRate2 = winner2Data.rate;
			winner2Data.rate += winner2Gain;
			if (winner2Data.rate !== winnerBeforeRate2) {
				winner2Data.rateChanged = true;
				recordRateChange(winnerFriend2.userId, winner2Data.rate - winnerBeforeRate2);
			}
			this.ai.friends.update(winnerDoc2);
		}

		const rankingAfter = friendDocs
			.map((doc) => {
				const ensured = ensureKazutoriData(doc).data;
				return hasKazutoriRateHistory(ensured)
					? { userId: doc.userId, rate: ensured.rate }
					: null;
			})
			.filter((record): record is { userId: string; rate: number } => record != null);
		const sortedAfter = [...rankingAfter].sort((a, b) => this.compareByRateDesc(a, b));
		const afterRank = findRateRank(sortedAfter, winnerFriend.userId);
		const afterRank2 = hasSecondWinner && winnerFriend2 ? findRateRank(sortedAfter, winnerFriend2.userId) : undefined;

		const winnerEnsuredData = ensureKazutoriData(winnerFriend.doc).data;
		winnerEnsuredData.winCount = (winnerEnsuredData.winCount ?? 0) + 1;
		winnerEnsuredData.lastWinAt = Date.now();
		if (medal && winnerEnsuredData.winCount > 50) {
			winnerEnsuredData.medal = (winnerEnsuredData.medal || 0) + 1;
		}
		if (winnerEnsuredData.inventory) {
			if (winnerEnsuredData.inventory.length >= 50) winnerEnsuredData.inventory.shift();
			winnerEnsuredData.inventory.push(`${item}の片割れ`);
		} else {
			winnerEnsuredData.inventory = [`${item}の片割れ`];
		}
		winnerFriend.save();

		if (hasSecondWinner && winnerFriend2) {
			const winnerEnsuredData2 = ensureKazutoriData(winnerFriend2.doc).data;
			winnerEnsuredData2.winCount = (winnerEnsuredData2.winCount ?? 0) + 1;
			winnerEnsuredData2.lastWinAt = Date.now();
			if (medal && winnerEnsuredData2.winCount > 50) {
				winnerEnsuredData2.medal = (winnerEnsuredData2.medal || 0) + 1;
			}
			if (winnerEnsuredData2.inventory) {
				if (winnerEnsuredData2.inventory.length >= 50) winnerEnsuredData2.inventory.shift();
				winnerEnsuredData2.inventory.push(`${item}の片割れ`);
			} else {
				winnerEnsuredData2.inventory = [`${item}の片割れ`];
			}
			winnerFriend2.save();
		}

		return {
			beforeRate,
			afterRate: winnerData.rate,
			beforeRank,
			afterRank,
			beforeRate2,
			afterRate2: hasSecondWinner && winnerFriend2 && winnerDoc2 ? ensureKazutoriData(winnerDoc2).data.rate : undefined,
			beforeRank2,
			afterRank2,
		};
	}

	/**
	 * 勝者がいない場合、不参加者ペナルティ分のボーナスを参加者に配分する
	 *
	 * @remarks
	 * 参加者がいれば均等に配分し、端数は {@link distributeRemainderToPenalties} で不参加者に返却する。
	 * 参加者がいなければ全額を不参加者に返却する。
	 *
	 * @param participants - 今回のゲームに投票したユーザーIDのセット
	 * @param nonParticipantPenalties - 不参加者ペナルティ配列（端数返却先）
	 * @param friendDocMap - userId → FriendDoc のマップ（参加者の doc 取得用）
	 * @param totalBonusFromNonParticipants - 不参加者ペナルティの合計ポイント
	 * @param recordRateChange - レート変動記録関数
	 * @internal
	 */
	private distributeBonusWhenNoWinner(
		participants: Set<string>,
		nonParticipantPenalties: { doc: FriendDoc; data: EnsuredKazutoriData; loss: number }[],
		friendDocMap: Map<string, FriendDoc>,
		totalBonusFromNonParticipants: number,
		recordRateChange: (userId: string, delta: number, lossAdjustmentPercent?: number) => void
	): void {
		const participantDocs = Array.from(participants)
			.map((userId) => friendDocMap.get(userId))
			.filter((doc): doc is FriendDoc => doc != null);

		if (participantDocs.length > 0) {
			/** 参加者に均等に配る1人あたりのボーナス */
			const baseShare = Math.floor(totalBonusFromNonParticipants / participantDocs.length);
			/** 端数（均等に割り切れなかった分。不参加者に1ポイントずつ戻して消化） */
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

			this.distributeRemainderToPenalties(nonParticipantPenalties, remainder, recordRateChange);
		} else {
			this.distributeRemainderToPenalties(nonParticipantPenalties, totalBonusFromNonParticipants, recordRateChange);
		}
	}

	/**
	 * 端数ポイントを不参加者ペナルティに1ポイントずつ戻して消化する
	 *
	 * @remarks
	 * 損失が大きくレートが低い不参加者から優先的に1ポイントずつ返却する。
	 * distributeBonusWhenNoWinner 内の2箇所で同じロジックを使うため共通化。
	 *
	 * @param penalties - 不参加者ペナルティ配列（loss / data.rate を参照・変更する）
	 * @param remainder - 返却する残りポイント数
	 * @param recordRateChange - レート変動記録関数
	 * @internal
	 */
	private distributeRemainderToPenalties(
		penalties: { doc: FriendDoc; data: EnsuredKazutoriData; loss: number }[],
		remainder: number,
		recordRateChange: (userId: string, delta: number, lossAdjustmentPercent?: number) => void
	): void {
		while (remainder > 0) {
			const candidates = penalties.filter((penalty) => penalty.loss > 0);
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

	/**
	 * レート変動・直近ゲーム結果のメタデータを各ユーザーの数取りデータに反映する
	 *
	 * @remarks
	 * rateChangeAggregates の合計値を lastRateChange / lastRateLossAdjustmentPercent に書き込み、
	 * 参加者には lastGameResult（win / lose / no-winner）、不参加者には penalty を設定する。
	 *
	 * @param touchedUserIds - レートまたは lastGameResult を更新したユーザーIDのセット
	 * @param participants - 今回のゲームに投票したユーザーIDのセット
	 * @param winnerUserId - 勝者のユーザーID（null なら勝者なし）
	 * @param rateChangeAggregates - ユーザーごとのレート変動量の集計
	 * @param friendDocMap - userId → FriendDoc のマップ
	 * @param rateUpdateGameId - レート変動が発生したゲームのノートID
	 * @internal
	 */
	private updateRateChangeMetadata(
		touchedUserIds: Set<string>,
		participants: Set<string>,
		winnerUserIds: Set<string>,
		rateChangeAggregates: Map<string, { delta: number; hasNegative: boolean; lossAdjustmentPercent?: number }>,
		friendDocMap: Map<string, FriendDoc>,
		rateUpdateGameId: string
	): void {
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
				if (winnerUserIds.size > 0) {
					data.lastGameResult = winnerUserIds.has(doc.userId) ? 'win' : 'lose';
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
	}

	/**
	 * finish() のセクション4〜6: レート計算に必要なすべての準備データを構築する
	 *
	 * @remarks
	 * 以下を一括で行い、KazutoriRatingContext として返す。
	 * - 参加者セット・制限時間の確定
	 * - 勝者フレンド・表示名の取得
	 * - 全フレンドの kazutoriData 正規化・friendDocMap・rankingBefore の構築
	 * - 敗者ランク（loserRankMap）の構築
	 * - recordRateChange コールバックの生成
	 *
	 * touchedUserIds / rateChangeAggregates はミュータブルなコレクションで、
	 * apply* メソッドから recordRateChange 経由で更新される。
	 *
	 * @param game - 終了するゲーム（limitMinutes が未設定なら計算して書き戻す副作用あり）
	 * @param winner - 勝者のユーザー情報（null なら勝者なし）
	 * @param medianValue - 中央値（-1 = 有効数字なし、undefined = 非中央値モード）
	 * @returns レート計算に必要なコンテキスト一式
	 * @internal
	 */
	private buildRatingContext(
		game: Game,
		winner: Game['votes'][0]['user'] | null,
		medianValue: typeof Decimal | -1 | undefined
	): KazutoriRatingContext {
		// --- 4. レート計算の準備 ---
		const participants = new Set(game.votes.map((vote) => vote.user.id));
		const calculatedLimitMinutes =
			game.limitMinutes ?? Math.max(Math.round((game.finishedAt - game.startedAt) / (1000 * 60)), 1);
		if (game.limitMinutes == null) {
			game.limitMinutes = calculatedLimitMinutes;
			this.games.update(game);
		}

		const winnerFriend = winner?.id ? this.ai.lookupFriend(winner.id) : null;
		const name = winnerFriend ? winnerFriend.name : null;

		const friendDocs = this.ai.friends.find({}) as FriendDoc[];
		const friendDocMap = new Map<string, FriendDoc>();
		const rankingBefore: { userId: string; rate: number }[] = [];
		const rateUpdateGameId = game.postId;
		const touchedUserIds = new Set<string>();
		const rateChangeAggregates = new Map<
			string,
			{ delta: number; hasNegative: boolean; lossAdjustmentPercent?: number }
		>();
		/** レート変動を rateChangeAggregates と touchedUserIds に記録するコールバック */
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

		// --- 5. 敗者ランクの構築（レート減算の按分に使用） ---
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

		/** ソート済みリストと勝者インデックスから「勝者を先頭に、その前後を交互に並べた」順序を構築 */
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
				const target = typeof medianValue !== 'undefined' && medianValue !== -1 ? (medianValue as typeof Decimal) : null;
				if (target) {
					normalPlacements = [...uniqueVotes].sort((a, b) => {
						const diffA = this.decimalAbs(a.number.minus(target));
						const diffB = this.decimalAbs(b.number.minus(target));
						const diffCompare = this.compareDecimalAsc(diffA, diffB);
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
				const sortedDesc = [...uniqueVotes].sort((a, b) => this.compareDecimalDesc(a.number, b.number));
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

				const sortedAsc = [...uniqueVotes].sort((a, b) => this.compareDecimalAsc(a.number, b.number));
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

		/** 重複投票者を「target（勝者数値）との差」でグループ化し、近い順に並べる */
		const buildProximityGroups = (target: typeof Decimal | null) => {
			if (target == null) return [] as VoteInfo[][];
			const diffMap = new Map<string, { diff: typeof Decimal; votes: VoteInfo[] }>();
			const groups: { diff: typeof Decimal; votes: VoteInfo[] }[] = [];
			for (const info of duplicateVotes) {
				const diff = this.decimalAbs(info.number.minus(target));
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
			groups.sort((a, b) => this.compareDecimalAsc(a.diff, b.diff));
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

		// --- 6. フレンドマップ・ランキングの構築 ---
		for (const doc of friendDocs) {
			const { data, updated } = ensureKazutoriData(doc);
			if (updated) this.ai.friends.update(doc);
			friendDocMap.set(doc.userId, doc);
			if (hasKazutoriRateHistory(data)) {
				rankingBefore.push({ userId: doc.userId, rate: data.rate });
			}
		}

		const sortedBefore = [...rankingBefore].sort((a, b) => this.compareByRateDesc(a, b));

		const cappedLimitMinutes = Math.min(calculatedLimitMinutes, 480);
		const penaltyPoint = Math.max(Math.ceil(cappedLimitMinutes / 5), 1);

		return {
			participants,
			winnerFriend,
			name,
			friendDocs,
			friendDocMap,
			sortedBefore,
			rateUpdateGameId,
			touchedUserIds,
			rateChangeAggregates,
			recordRateChange,
			loserRankMap,
			totalParticipants,
			shouldAdjustByRank,
			cappedLimitMinutes,
			penaltyPoint,
		};
	}

	/**
	 * ゲーム結果を投稿し、リプライ購読を解除する
	 *
	 * @param game - 対象ゲーム（winRank / postId / replyKey を参照）
	 * @param results - 結果表示用の行リスト（例: "🎉 **42**: $[jelly @user]"）
	 * @param winner - 勝者のユーザー情報（null なら勝者なし）
	 * @param name - 勝者の表示名（null なら未設定）
	 * @param item - 勝利アイテム名
	 * @param reverse - 反転モードで勝者が決まったか
	 * @param perfect - 完全勝利か（反転しても同じ勝者だった場合）
	 * @param ratingInfo - 勝者のレート変動情報（null なら勝者なし）
	 * @param medianValue - 中央値（-1 = 有効数字なし、undefined = 非中央値モード）
	 * @param medal - メダル戦かどうか
	 * @internal
	 */
	private publishGameResult(
		game: Game,
		results: string[],
		winner: Game['votes'][0]['user'] | null,
		winner2: Game['votes'][0]['user'] | null,
		name: string | null,
		name2: string | null,
		item: string,
		reverse: boolean,
		perfect: boolean,
		ratingInfo: {
			beforeRate: number;
			afterRate: number;
			beforeRank?: number;
			afterRank?: number;
			beforeRate2?: number;
			afterRate2?: number;
			beforeRank2?: number;
			afterRank2?: number;
		} | null,
		medianValue: typeof Decimal | -1 | undefined,
		medal: boolean
	): void {
		/** 中央値モード時の中央値の表示用文字列 */
		const medianDisplayText = this.formatNumberOrSentinel(medianValue);
		const winnerFriend = winner ? this.ai.lookupFriend(winner.id) : null;
		const winnerFriend2 = winner2 ? this.ai.lookupFriend(winner2.id) : null;
		/** 勝者の累計勝利数（表示用。今回の勝利は既に applyWinnerAndLoserRates で加算済み） */
		const winnerWinCount = winnerFriend?.doc?.kazutoriData?.winCount ?? 0;
		/** メダル戦かつ勝利数50超ならメダル獲得数（表示用） */
		const winnerMedalCount = medal && winnerWinCount > 50 ? (winnerFriend?.doc?.kazutoriData?.medal ?? 0) : null;
		const winnerWinCount2 = winnerFriend2?.doc?.kazutoriData?.winCount ?? 0;
		const winnerMedalCount2 = medal && winnerWinCount2 > 50 ? (winnerFriend2?.doc?.kazutoriData?.medal ?? 0) : null;
		/** 結果投稿の本文（勝利条件＋結果行＋勝者/お流れセリフ） */
		const text = (game.winRank > 0 ? game.winRank === 1 ? '' : '勝利条件 : ' + game.winRank + '番目に大きい値\n\n' : '勝利条件 : 中央値 (' + medianDisplayText + ')\n\n') + results.join('\n') + '\n\n' + (winner
			? serifs.kazutori.finishWithWinner(
				acct(winner),
				name,
				winner2 ? acct(winner2) : null,
				name2,
				item,
				reverse,
				perfect,
				winnerWinCount,
				winnerMedalCount,
				winnerWinCount2,
				winnerMedalCount2,
				ratingInfo ?? undefined
			)
			: serifs.kazutori.finishWithNoWinner(item));

		this.ai.post({
			text,
			cw: serifs.kazutori.finish,
			renoteId: game.postId,
		});

		this.unsubscribeReply(null);
		game.replyKey.forEach((x) => this.unsubscribeReply(x));
	}

	/**
	 * 終了すべきゲームがないかチェックし、制限時間経過ゲームを finish() に渡す
	 *
	 * @remarks
	 * 1秒間隔のポーリングで呼ばれる。未終了ゲームの制限時間を確認し、
	 * 超過していれば {@link finish} を呼び出す。
	 *
	 * @internal
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
	 * 処理ステップ:
	 * 1. filterValidVotesForFinish — 有効投票のフィルタ（公開限定・ブロック・親愛度）
	 * 2. handleOnagareIfNeeded — お流れ判定（無効試合なら早期リターン）
	 * 3. 投票数値・maxnum の型正規化
	 * 4. computeWinnerAndResults — 勝者・結果リスト・反転の計算
	 * 5. buildRatingContext — レート準備（参加者・敗者ランク・フレンドマップ）
	 * 6. applyNonParticipantPenalties — 不参加者ペナルティの適用
	 * 7. applyWinnerAndLoserRates — 勝者ボーナス・敗者減算・勝者ステータス更新
	 * 8. distributeBonusWhenNoWinner — 勝者なし時のボーナス配分
	 * 9. updateRateChangeMetadata — レート変動メタデータの反映
	 * 10. publishGameResult — 結果投稿・リプライ購読解除
	 *
	 * @param game - 終了するゲーム
	 * @param options - オプション（再集計フラグ）
	 * @internal
	 */
	@autobind
        private async finish(game: Game, options?: { isReaggregate?: boolean }) {
                // ======== finish() 処理ステップ一覧 ========
                // 1. filterValidVotesForFinish  — 有効投票のフィルタ（公開限定・ブロック・親愛度）
                // 2. handleOnagareIfNeeded      — お流れ判定（無効試合なら早期リターン）
                // 3. 投票数値・maxnum の型正規化（Decimal への変換）
                // 4. computeWinnerAndResults    — 勝者・結果リスト・反転の計算
                // 5. buildRatingContext         — レート準備（セクション4〜6: 参加者・敗者ランク・フレンドマップ）
                // 6. applyNonParticipantPenalties — 不参加者ペナルティの適用
                // 7. applyWinnerAndLoserRates   — 勝者ボーナス・敗者減算・勝者ステータス更新
                // 8. distributeBonusWhenNoWinner — 勝者なし時のボーナス配分
                // 9. updateRateChangeMetadata   — レート変動メタデータの反映
                // 10. publishGameResult         — 結果投稿・リプライ購読解除
                // ============================================

                game.isEnded = true;
                this.games.update(game);

                if (options?.isReaggregate) {
                        this.log('Kazutori game reaggregation started');
                }

                this.log('Kazutori game finished');

                // --- 1. 有効投票のフィルタ（公開限定・ブロック・親愛度） ---
                game.votes = await this.filterValidVotesForFinish(game);
                this.games.update(game);

                const item = genItem();
                if (await this.handleOnagareIfNeeded(game, item)) {
                        return;
                }

                // --- 2. 投票数値・maxnum の型正規化 ---
                game.votes.forEach((x) => {
                        if (typeof x.number === 'string') {
                                x.number = new Decimal(x.number);
                        }
                });
                this.normalizeGameMaxnum(game);

                // --- 3. 勝者・結果リスト・反転の計算 ---
				const { results, winner, winner2, reverse, perfect, medianValue } = this.computeWinnerAndResults(game);

				game.winnerUserId = winner?.id;
				game.winnerUserId2 = winner2?.id;
				this.games.update(game);

                // --- 4〜6. レート計算の準備・敗者ランク構築・フレンドマップ構築 ---
                const ctx = this.buildRatingContext(game, winner, medianValue);

				const winnerFriend2 = winner2?.id ? this.ai.lookupFriend(winner2.id) : null;
				const winnerUserIds = new Set<string>();
				if (ctx.winnerFriend?.userId) winnerUserIds.add(ctx.winnerFriend.userId);
				if (winnerFriend2?.userId) winnerUserIds.add(winnerFriend2.userId);

				// --- 7. 不参加者ペナルティの適用 ---
				const { totalBonusFromNonParticipants, nonParticipantPenalties } = this.applyNonParticipantPenalties(
						ctx.friendDocs,
						ctx.participants,
						winnerUserIds,
						ctx.cappedLimitMinutes,
						ctx.penaltyPoint,
						ctx.recordRateChange
				);

                const medal = this.isMedalMatch(game);
                // --- 8. 勝者ボーナス・敗者減算・勝者ステータス更新 ---
				const ratingInfo = this.applyWinnerAndLoserRates(
						game,
						winner,
						winner2,
						ctx.winnerFriend,
						winnerFriend2,
						ctx.friendDocMap,
                        ctx.loserRankMap,
                        ctx.totalParticipants,
                        ctx.shouldAdjustByRank,
                        ctx.sortedBefore,
                        ctx.friendDocs,
                        ctx.cappedLimitMinutes,
                        totalBonusFromNonParticipants,
                        ctx.recordRateChange,
                        item,
                        medal
                );

                // --- 9. 勝者なし時は不参加者ペナルティ分を参加者に配分 ---
                if (!ratingInfo && totalBonusFromNonParticipants > 0) {
                        this.distributeBonusWhenNoWinner(
                                ctx.participants,
                                nonParticipantPenalties,
                                ctx.friendDocMap,
                                totalBonusFromNonParticipants,
                                ctx.recordRateChange
                        );
                }

                for (const penalty of nonParticipantPenalties) {
                        this.ai.friends.update(penalty.doc);
                }

                // --- 10. レート変動メタデータの反映と結果投稿 ---
				const winnerUserIdsForMetadata = new Set<string>();
				if (ctx.winnerFriend?.userId) winnerUserIdsForMetadata.add(ctx.winnerFriend.userId);
				if (winnerFriend2?.userId) winnerUserIdsForMetadata.add(winnerFriend2.userId);
				for (const userId of ctx.participants) {
						ctx.touchedUserIds.add(userId);
				}

				this.updateRateChangeMetadata(
						ctx.touchedUserIds,
						ctx.participants,
						winnerUserIdsForMetadata,
						ctx.rateChangeAggregates,
						ctx.friendDocMap,
						ctx.rateUpdateGameId
				);

				this.publishGameResult(game, results, winner, winner2, ctx.name ?? null, winnerFriend2?.name ?? null, item, reverse, perfect, ratingInfo, medianValue, medal);
        }
}

/**
 * @packageDocumentation
 *
 * AI コアモジュール。
 *
 * @remarks
 * 藍のメインクラスを定義する。
 * Misskey インスタンスへの WebSocket 接続、メッセージの受信・処理、
 * モジュールの管理、LokiJS によるデータ永続化、Misskey API の呼び出しなど、
 * ボットの中核となる機能を提供する。
 *
 * 起動ライフサイクル:
 * 1. コンストラクタ — LokiJS の初期化とデータロード
 * 2. {@link 藍.run} — DB コレクション初期化、WebSocket 接続、モジュールインストール
 * 3. イベントループ — メンション・リプライ・通知の受信と処理
 *
 * @see {@link ./module | Module} — フックを提供するモジュール基底クラス
 * @see {@link ./stream | Stream} — WebSocket ストリーム接続
 * @internal
 */

import * as fs from 'fs';
import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import * as request from 'request-promise-native';
import * as chalk from 'chalk';
import { v4 as uuid } from 'uuid';
const delay = require('timeout-as-promise');

import config from '@/config';
import Module from '@/module';
import Message from '@/message';
import Friend, { FriendDoc } from '@/friend';
import { User } from '@/misskey/user';
import Stream from '@/stream';
import log from '@/utils/log';
import { katakanaToHiragana, hankakuToZenkaku } from '@/utils/japanese';
const pkg = require('../package.json');

/**
 * メンション受信時に呼び出されるフック関数の型
 *
 * @remarks
 * `true` または {@link HandlerResult} を返すと、それ以降のフックは実行されない。
 * `false` を返すと次のフックに処理が委譲される。
 *
 * @internal
 */
type MentionHook = (msg: Message) => Promise<boolean | HandlerResult>;

/**
 * コンテキスト（返信の待ち受け）に対応するフック関数の型
 *
 * @remarks
 * `false` を返すとメンションフックにフォールバックする。
 *
 * @internal
 */
type ContextHook = (key: any, msg: Message, data?: any) => Promise<void | boolean | HandlerResult>;

/**
 * モジュールの永続タイマーが発火した際に呼び出されるコールバック関数の型
 * @internal
 */
type TimeoutCallback = (data?: any) => void;

type HangReport = {
	delayMs: number;
	uptimeSec: number;
	pid: number;
	node: string;
	platform: string;
	memoryUsage: NodeJS.MemoryUsage;
	moduleCount: number;
	mentionHookCount: number;
	contextCount: number;
	timerCount: number;
	lastSleepedAt: number | null;
	lastWakingAt: number | null;
	activeFactor: number | null;
	reportedAt: string;
};

/**
 * メッセージハンドラーの処理結果
 *
 * @remarks
 * リアクションの種類や即時応答かどうかを制御する。
 * モジュールのフックから返すことで藍の応答動作をカスタマイズできる。
 *
 * @public
 */
export type HandlerResult = {
	/**
	 * 投稿に付けるリアクション（カスタム絵文字名）
	 *
	 * @remarks
	 * `null` の場合はリアクションしない。
	 */
	reaction?: string | null;
	/** `true` の場合、応答前の待機時間をスキップする */
	immediate?: boolean;
};

/**
 * モジュールの `install()` メソッドが返す結果
 *
 * @remarks
 * 各モジュールがどのフック関数を提供するかを定義する。
 * 全てのフックは省略可能。
 *
 * @public
 */
export type InstallerResult = {
	/** メンション受信時のフック */
	mentionHook?: MentionHook;
	/** コンテキスト（返信の待ち受け）のフック */
	contextHook?: ContextHook;
	/** 永続タイマー発火時のコールバック */
	timeoutCallback?: TimeoutCallback;
};

/**
 * 藍のメタ情報
 *
 * @remarks
 * DB に永続化され、プロセス再起動時のスリープ時間検出や活動係数の保持に使用される。
 *
 * @public
 */
export type Meta = {
	/** 最後に起動していた時刻（ミリ秒タイムスタンプ） */
	lastWakingAt: number;
	/**
	 * 活動係数
	 *
	 * @remarks
	 * 1.0 が基準値。反応なしの投稿が続くと減少し、反応があると増加する。
	 * 最小 0.1、最大 2.0。
	 */
	activeFactor: number | null;
};

/**
 * 藍 — Misskey 用 AI ボットのコアクラス
 *
 * @remarks
 * WebSocket ストリームを通じて Misskey インスタンスに接続し、
 * メンション・リプライを受信して各モジュールに処理を委譲する。
 *
 * 主な責務:
 * - LokiJS による永続データ管理（友達、コンテキスト、タイマー、モジュールデータ、メタ）
 * - Misskey API のリトライ付き呼び出し
 * - モジュールのライフサイクル管理（init → install → フック呼び出し）
 * - 活動係数の管理（投稿頻度を動的に調整）
 * - ハング検出と自動再起動
 *
 * @internal
 */
export default class 藍 {
	/**
	 * バージョン番号（`package.json` の `_v` フィールドから取得）
	 * @internal
	 */
	public readonly version = pkg._v;
	/**
	 * 藍として動作する Misskey アカウント情報
	 * @internal
	 */
	public account: User;
	/**
	 * Misskey への WebSocket ストリーム接続
	 * @internal
	 */
	public connection: Stream;
	/**
	 * インストールされたモジュールの一覧（先頭ほど高優先度）
	 * @internal
	 */
        public modules: Module[] = [];
	/**
	 * 各モジュールが登録したメンションフックの一覧
	 * @internal
	 */
        private mentionHooks: MentionHook[] = [];
	/**
	 * モジュール名をキーとしたコンテキストフックのマップ
	 * @internal
	 */
        private contextHooks: { [moduleName: string]: ContextHook; } = {};
	/**
	 * モジュール名をキーとしたタイムアウトコールバックのマップ
	 * @internal
	 */
        private timeoutCallbacks: { [moduleName: string]: TimeoutCallback; } = {};
	/**
	 * LokiJS データベースインスタンス
	 * @internal
	 */
        public db: loki;
	/**
	 * 最後にスリープした時刻（ミリ秒タイムスタンプ）
	 * @internal
	 */
        public lastSleepedAt: number;
	/**
	 * 活動係数（反応率に影響する。1.0 が基準値）
	 * @internal
	 */
        public activeFactor: number;
	/**
	 * ハング検出が既にトリガーされたかどうか
	 *
	 * @remarks
	 * 二重トリガーを防止するためのフラグ。
	 *
	 * @internal
	 */
        private hangDetectionTriggered = false;

	/**
	 * メタ情報コレクション
	 * @internal
	 */
	private meta: loki.Collection<Meta>;

	/**
	 * 返信待ち受けコンテキストのコレクション
	 *
	 * @remarks
	 * `noteId` でリプライ先、`module` + `key` でモジュールを特定する。
	 *
	 * @internal
	 */
	private contexts: loki.Collection<{
		/** 待ち受け対象の投稿ID */
		noteId?: string;
		/** 待ち受け対象のユーザーID（トーク用） */
		userId?: string;
		/** コンテキストを管理するモジュール名 */
		module: string;
		/** コンテキスト識別キー */
		key: string | null;
		/** コンテキストに紐づく任意のデータ */
		data?: any;
	}>;

	/**
	 * 永続タイマーのコレクション
	 *
	 * @remarks
	 * 1秒間隔で {@link crawleTimer} が巡回し、期限切れを検出する。
	 *
	 * @internal
	 */
	private timers: loki.Collection<{
		/** タイマーの一意識別子（UUID） */
		id: string;
		/** タイマーを設定したモジュール名 */
		module: string;
		/** タイマー登録時刻（ミリ秒タイムスタンプ） */
		insertedAt: number;
		/** タイマーの遅延時間（ミリ秒） */
		delay: number;
		/** コールバックに渡す任意のデータ */
		data?: any;
	}>;

	/**
	 * ユーザー（友達）情報のコレクション
	 * @internal
	 */
	public friends: loki.Collection<FriendDoc>;
	/**
	 * モジュールごとの永続データのコレクション
	 * @internal
	 */
	public moduleData: loki.Collection<any>;

	/**
	 * 学習済みキーワードのコレクション
	 *
	 * @remarks
	 * MeCab でトピック抽出した単語を保存する。
	 * {@link makeBananasu} で「バナナス」（しりとり風造語）の生成に使用される。
	 *
	 * @internal
	 */
	private learnedKeywords: loki.Collection<{
		/** キーワード文字列 */
		keyword: string;
		/** 学習した時刻（ミリ秒タイムスタンプ） */
		learnedAt: number;
	}>;

	/**
	 * 藍インスタンスを生成する
	 *
	 * @remarks
	 * LokiJS データベースを初期化し、ロード完了後に {@link run} を呼び出す。
	 * DB ファイルパスは `config.memoryDir` で変更可能。
	 *
	 * @param account - 藍として使うアカウント
	 * @param modules - モジュールの配列（先頭ほど高優先度）
	 * @internal
	 */
	constructor(account: User, modules: Module[]) {
		this.account = account;
		this.modules = modules;

		let memoryDir = '.';
		if (config.memoryDir) {
			memoryDir = config.memoryDir;
		}
		// NOTE: テスト環境では本番DBを汚さないよう別ファイルを使用する
		const file = process.env.NODE_ENV === 'test' ? `${memoryDir}/test.memory.json` : `${memoryDir}/memory.json`;

		this.log(`Lodaing the memory from ${file}...`);

		this.db = new loki(file, {
			autoload: true,
			autosave: true,
			autosaveInterval: 1000,
			autoloadCallback: err => {
				if (err) {
					this.log(chalk.red(`Failed to load the memory: ${err}`));
				} else {
					this.log(chalk.green('The memory loaded successfully'));
					this.run();
				}
			}
		});
	}

	/**
	 * AiOS プレフィックス付きでログを出力する
	 *
	 * @param msg - ログメッセージ
	 * @returns なし
	 * @internal
	 */
	@autobind
	public log(msg: string) {
		log(chalk`[{magenta AiOS}]: ${msg}`);
	}

	/**
	 * 藍の初期化と起動を行う
	 *
	 * @remarks
	 * DB コレクションの初期化、WebSocket ストリームの接続、
	 * イベントリスナーの設定、モジュールのインストールを実行する。
	 * コンストラクタからデータベースロード完了後に呼び出される。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	private run() {
		//#region Init DB
		this.meta = this.getCollection('meta', {});

		this.contexts = this.getCollection('contexts', {
			indices: ['key']
		});

		this.timers = this.getCollection('timers', {
			indices: ['module']
		});

		this.friends = this.getCollection('friends', {
			indices: ['userId']
		});

		this.moduleData = this.getCollection('moduleData', {
			indices: ['module']
		});

		this.learnedKeywords = this.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});
		//#endregion

		const meta = this.getMeta();
		this.lastSleepedAt = meta.lastWakingAt;
                this.activeFactor = meta.activeFactor || 1;

                // Init stream
                this.connection = new Stream();
                this.connection.on('inactivityReconnect', ({ lastActivityAt }) => {
                        this.recoverMissedMentions(lastActivityAt);
                });

		//#region Main stream
		const mainStream = this.connection.useSharedConnection('main');

		const host = new URL(config.host).host;

		// メンションされたとき
		mainStream.on('mention', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text && data.text.toLowerCase().includes(data.user.host ? `@${this.account.username}@${host}` : '@' + this.account.username)) {
				// Misskeyのバグで投稿が非公開扱いになる
				if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
				this.onReceiveMessage(new Message(this, data));
			}
		});

		// 返信されたとき
		mainStream.on('reply', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text && data.text.toLowerCase().includes(data.user.host ? `@${this.account.username}@${host}` : '@' + this.account.username)) return;
			// Misskeyのバグで投稿が非公開扱いになる
			if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
			this.onReceiveMessage(new Message(this, data));
		});

		// Renoteされたとき
		mainStream.on('renote', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text == null && (data.files || []).length == 0) return;

			if (!data.replyId && data.renoteId) data.replyId = data.renoteId;

			// リプライ扱い
			this.onReceiveMessage(new Message(this, data), ':mk_chuchuchicken:');
		});

		// メッセージ
		mainStream.on('messagingMessage', data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			this.onReceiveMessage(new Message(this, data));
		});

		// 通知
		mainStream.on('notification', data => {
			this.onNotification(data);
		});
		//#endregion

		// モジュールを優先度順にインストールする（配列の先頭ほど高優先度）
		this.modules.forEach(m => {
			this.log(`Installing ${chalk.cyan.italic(m.name)}\tmodule...`);
			m.init(this);
			const res = m.install();
			if (res != null) {
				// 各モジュールが提供するフックを登録する
				if (res.mentionHook) this.mentionHooks.push(res.mentionHook);
				if (res.contextHook) this.contextHooks[m.name] = res.contextHook;
				if (res.timeoutCallback) this.timeoutCallbacks[m.name] = res.timeoutCallback;
			}
		});

		// タイマー監視
		this.crawleTimer();
                setInterval(this.crawleTimer, 1000);

                setInterval(this.logWaking, 10000);

                this.startHangDetection();

                this.log(chalk.green.bold('Ai am now running!'));
        }

	/**
	 * イベントループのハング（長時間停止）を検出する監視を開始する
	 *
	 * @remarks
	 * 10秒間隔でタイマー精度をチェックし、60秒以上の遅延が発生した場合に
	 * ハング発生と判断して {@link onHangDetected} を呼び出す。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        private startHangDetection() {
                const interval = 10000;
                const hangThreshold = 60000;
                let lastTick = Date.now();

                const tick = async () => {
                        const now = Date.now();
                        const drift = now - lastTick;
                        lastTick = now;

                        if (drift - interval >= hangThreshold) {
                                await this.onHangDetected(drift - interval);
                                return;
                        }

                        setTimeout(tick, interval);
                };

                setTimeout(tick, interval);
        }

	/**
	 * ハング検出時の処理
	 *
	 * @remarks
	 * 管理者にDMで通知後、3秒後にプロセスを `exit(1)` で再起動する。
	 * 二重トリガーを防止するため、一度だけ実行される。
	 *
	 * @param delay - イベントループの遅延時間（ミリ秒）
	 * @returns なし
	 * @internal
	 */
        @autobind
        private async onHangDetected(delay: number) {
                if (this.hangDetectionTriggered) return;
                this.hangDetectionTriggered = true;

                this.log(`Hang detected: event loop delayed by ${Math.round(delay)}ms. Restarting...`);
		const report = this.buildHangReport(delay);

                try {
                        await this.post({
                                text: this.formatHangReport(report),
                                visibility: "specified",
							// NOTE: 管理者のユーザーIDにDMで通知する
                                visibleUserIds: ["9d5ts6in38"],
                        });
                } catch (error) {
                        this.log(`Failed to notify hang detection: ${error}`);
                }

                setTimeout(() => process.exit(1), 3000);
        }

	@autobind
	private buildHangReport(delay: number): HangReport {
		const memoryUsage = process.memoryUsage();
		const meta = this.meta?.findOne({}) ?? null;

		return {
			delayMs: Math.round(delay),
			uptimeSec: Math.floor(process.uptime()),
			pid: process.pid,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			memoryUsage,
			moduleCount: this.modules.length,
			mentionHookCount: this.mentionHooks.length,
			contextCount: this.contexts?.count() ?? 0,
			timerCount: this.timers?.count() ?? 0,
			lastSleepedAt: this.lastSleepedAt ?? null,
			lastWakingAt: meta?.lastWakingAt ?? null,
			activeFactor: this.activeFactor ?? null,
			reportedAt: new Date().toISOString(),
		};
	}

	@autobind
	private formatHangReport(report: HangReport): string {
		const mb = 1024 * 1024;
		const rssMb = Math.round(report.memoryUsage.rss / mb);
		const heapUsedMb = Math.round(report.memoryUsage.heapUsed / mb);
		const heapTotalMb = Math.round(report.memoryUsage.heapTotal / mb);
		const externalMb = Math.round(report.memoryUsage.external / mb);
		const arrayBuffersMb = Math.round(report.memoryUsage.arrayBuffers / mb);

		const lastSleepedText = report.lastSleepedAt
			? `${new Date(report.lastSleepedAt).toISOString()} (${Math.round((Date.now() - report.lastSleepedAt) / 1000)}秒前)`
			: '不明';
		const lastWakingText = report.lastWakingAt
			? `${new Date(report.lastWakingAt).toISOString()} (${Math.round((Date.now() - report.lastWakingAt) / 1000)}秒前)`
			: '不明';

		return [
			`⚠️ Botのイベントループが${Math.round(report.delayMs / 1000)}秒（${report.delayMs}ms）停止していました。`,
			'3秒後に自動で再起動します。',
			'',
			'【診断情報】',
			`- reportAt: ${report.reportedAt}`,
			`- pid: ${report.pid}`,
			`- uptime: ${report.uptimeSec}秒`,
			`- node: ${report.node}`,
			`- platform: ${report.platform}`,
			`- modules: ${report.moduleCount}`,
			`- mentionHooks: ${report.mentionHookCount}`,
			`- contexts: ${report.contextCount}`,
			`- timers: ${report.timerCount}`,
			`- activeFactor: ${report.activeFactor ?? '不明'}`,
			`- lastSleepedAt: ${lastSleepedText}`,
			`- lastWakingAt: ${lastWakingText}`,
			`- memory: rss=${rssMb}MB heapUsed=${heapUsedMb}MB heapTotal=${heapTotalMb}MB external=${externalMb}MB arrayBuffers=${arrayBuffersMb}MB`,
		].join('\n');
	}

	/**
	 * ハンドラーの実行にタイムアウト制限（3分）を設ける
	 *
	 * @remarks
	 * タイムアウトした場合は管理者にDMで通知し、`false` を返す。
	 * ハンドラー内で例外が発生した場合はそのまま reject する。
	 *
	 * @typeParam T - ハンドラーの戻り値の型
	 * @param handler - 実行するハンドラー関数
	 * @param obj - タイムアウト時のログ用コンテキストオブジェクト
	 * @param description - タイムアウト時のログ用説明文
	 * @returns ハンドラーの戻り値。タイムアウト時は `false`
	 * @internal
	 */
	@autobind
        private async handlerTimeout<T>(handler: () => Promise<T> | T, obj?: any, description = 'ハンドラー'): Promise<boolean | T> {
                const HANDLER_TIMEOUT_MS = 3 * 60 * 1000;
                return new Promise<boolean | T>((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                                console.log(`${description} Timeout!`);
                                if (obj) console.dir(obj);
                                // 管理者にDM
                                this.post({
                                        text: `${description}の処理が3分以内に完了しませんでした。\nログをご確認ください。`,
                                        visibility: "specified",
									// NOTE: 管理者のユーザーIDにDMで通知する
                                        visibleUserIds: ["9d5ts6in38"],
                                });
                                resolve(false); // resolveでfalseを返す
                        }, HANDLER_TIMEOUT_MS);

                        Promise.resolve()
                                .then(handler)
                                .then(result => {
                                        clearTimeout(timeoutId);
                                        resolve(result);
                                }).catch(error => {
                                        clearTimeout(timeoutId);
                                        reject(error);
                                });
                });
	}

	/**
	 * ユーザーからメッセージを受信した際の処理
	 *
	 * @remarks
	 * メンション、リプライ、トークのメッセージを処理する。
	 * Bot ユーザーからのメッセージは無限ループ防止のため無視する。
	 *
	 * 処理フロー:
	 * 1. コンテキスト（返信待ち受け）があればコンテキストフックを呼ぶ
	 * 2. コンテキストフックが `false` を返したらメンションフックにフォールバック
	 * 3. コンテキストがなければメンションフックを順次呼び出し
	 * 4. リアクションの付与と親愛度の更新
	 *
	 * @param msg - 受信した {@link Message}
	 * @param defaultReaction - デフォルトのリアクション絵文字
	 * @returns なし
	 * @internal
	 */
	@autobind
	private async onReceiveMessage(msg: Message, defaultReaction?: string): Promise<void> {
		this.log(chalk.gray(`<<< メッセージ受信: ${chalk.underline(msg.id)}`));

		// Bot からのメッセージは無視する（無限応答ループ防止）
		if (msg.user.isBot) {
			return;
		}

		const isNoContext = msg.replyId == null;

		// 返信先の投稿IDから待ち受けコンテキストを検索
		const context = isNoContext ? null : this.contexts.findOne({
			noteId: msg.replyId
		});

		let reaction: string | null = defaultReaction || ':mk_widechicken:';
		let immediate: boolean = false;

		//#region
		const invokeMentionHooks = async () => {
			let res: boolean | HandlerResult | null = null;

			for (const handler of this.mentionHooks) {
                                res = await this.handlerTimeout(() => handler(msg), msg, 'メンションハンドラー');
                                if (res === true || typeof res === 'object') break;
                        }

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction;
				if (res.immediate != null) immediate = res.immediate;
			}
		};

		// コンテキストがあればコンテキストフック呼び出し
		// なければそれぞれのモジュールについてフックが引っかかるまで呼び出し
		if (context != null) {
                        const handler = this.contextHooks[context.module];
                        const res = await this.handlerTimeout(() => handler(context.key, msg, context.data), { key: context.key, msg, data: context.data }, 'コンテキストハンドラー');

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction;
				if (res.immediate != null) immediate = res.immediate;
			}

			if (res === false && !defaultReaction) {
				await invokeMentionHooks();
			}
		} else if (!defaultReaction) {
			await invokeMentionHooks();
		}
		//#endregion

		if (!immediate) {
			await delay(1000);
		}

		// NOTE: モジュールから返される論理的なリアクション名を、
		//       インスタンス固有のカスタム絵文字に変換する
                if (reaction === "love") reaction = ":mk_hi:";
                if (reaction === "like") reaction = ":mk_yurayurachicken:";
                if (reaction === "hmm") reaction = ":mk_fly_sliver:";
                if (reaction === "confused") reaction = ":mk_ultrawidechicken:";

		// リアクション文字列から `:emoji_name:` 形式の部分だけを抽出する
		// （前後に余計な文字が付いている場合に対応）
                if (reaction != null) {
                        const firstColonIndex = reaction.indexOf(":");

                        if (firstColonIndex !== -1) {
                                const secondColonIndex = reaction.indexOf(":", firstColonIndex + 1);

                                if (secondColonIndex !== -1) {
                                        reaction = reaction.slice(firstColonIndex, secondColonIndex + 1);
                                }
                        }
                }

		const friend = new Friend(this, { user: msg.user });

		// NOTE: 以下のリアクションは「モジュールがマッチしなかった」場合のデフォルト絵文字。
		//       デフォルトリアクションでない＝正しくモジュールが応答した場合は親愛度を上げる。
		const defaultReactions = [":mk_widechicken:", ":mk_fly_sliver:", ":mk_ultrawidechicken:", ":mk_moyochicken:"];
		if (!defaultReactions.includes(reaction) && !(defaultReaction === reaction)) {
		// モジュールが正しく応答した → 親愛度を少量増加
			friend.incLove(0.1, reaction);
		} else if (reaction === ":mk_widechicken:") {
			// どのモジュールも反応しなかった → 活動係数を微減
			this.decActiveFactor(0.0005);
		}

		// リアクションする
		if (reaction) {
			this.api('notes/reactions/create', {
				noteId: msg.id,
				reaction: reaction ?? ""
			});
		}
	}

	/**
	 * 通知を受信した際の処理
	 *
	 * @remarks
	 * 引用・投票・リアクションに対して親愛度を少し上昇させる。
	 *
	 * TODO: リアクション取り消しのハンドリングが未実装
	 *
	 * @param notification - Misskey 通知オブジェクト
	 * @returns なし
	 * @internal
	 */
	@autobind
        private onNotification(notification: any) {
                switch (notification.type) {
					// リアクション・引用・投票されたら親愛度を少し上げる
                        // TODO: リアクション取り消しをよしなにハンドリングする
                        case 'quote':
			case 'pollVote':
			case 'reaction': {
				const friend = new Friend(this, { user: notification.user });
				friend.incLove(0.1, notification.type);
				break;
			}

                        default:
                                break;
                }
        }

	/**
	 * WebSocket 切断中に取りこぼしたメンションを復元処理する
	 *
	 * @remarks
	 * 再接続時に最後のアクティビティ以降の通知を取得し、
	 * 未処理のメンション（自身のリアクションが付いていないもの）に対して返信処理を行う。
	 *
	 * @param lastActivityAt - 最後にアクティビティがあった時刻（ミリ秒タイムスタンプ）
	 * @returns なし
	 * @internal
	 */
        @autobind
        private async recoverMissedMentions(lastActivityAt: number) {
                try {
                        const notifications = await this.api('i/notifications', {
                                limit: 100,
                                includeTypes: ['mention'],
                                sinceDate: lastActivityAt,
                        });

                        if (!Array.isArray(notifications)) return;

                        const missedMentions = notifications.filter(notification => {
                                if (notification?.type !== 'mention' || notification.note == null) return false;
                                if (notification.createdAt == null) return true;
                                return new Date(notification.createdAt).getTime() >= lastActivityAt;
                        });

                        for (const notification of missedMentions) {
                                const note = notification.note;
                                if (!note || note.userId === this.account.id) continue;

                                if (note.myReaction != null) continue;

                                let resolvedNote = note;
                                if (resolvedNote.text == null) {
                                        resolvedNote = await this.api('notes/show', { noteId: note.id });
                                }

                                await this.onReceiveMessage(new Message(this, resolvedNote));
                        }
                } catch (error) {
                        this.log(`Failed to recover missed mentions: ${error}`);
                }
        }

	/**
	 * 永続タイマーを巡回し、期限切れのタイマーがあればコールバックを実行する
	 *
	 * @remarks
	 * 1秒間隔で定期実行される。
	 * コールバック実行にも {@link handlerTimeout} によるタイムアウト制限（3分）が適用される。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        private async crawleTimer() {
                const timers = this.timers.find();
                for (const timer of timers) {
                        // タイマーが時間切れかどうか
                        if (Date.now() - (timer.insertedAt + timer.delay) >= 0) {
                                this.log(`Timer expired: ${timer.module} ${timer.id}`);
                                this.timers.remove(timer);
                                try {
                                        await this.handlerTimeout(() => this.timeoutCallbacks[timer.module](timer.data), { timer }, 'タイムアウトコールバック');
                                } catch (error) {
                                        this.log(`Timer callback error: ${error}`);
                                }
                        }
                }
        }

	/**
	 * 起動中であることをメタ情報に記録する
	 *
	 * @remarks
	 * 10秒間隔で定期実行される。
	 * プロセス再起動時のスリープ時間検出に使用される。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	private logWaking() {
		this.setMeta({
			lastWakingAt: Date.now(),
		});
	}

	/**
	 * DB コレクションを取得する
	 *
	 * @remarks
	 * 指定された名前のコレクションが存在しない場合は新規作成する。
	 *
	 * @param name - コレクション名
	 * @param opts - LokiJS コレクションのオプション
	 * @returns コレクション
	 * @internal
	 */
	@autobind
	public getCollection(name: string, opts?: any): loki.Collection {
		let collection: loki.Collection;

		collection = this.db.getCollection(name);

		if (collection == null) {
			collection = this.db.addCollection(name, opts);
		}

		return collection;
	}

	/**
	 * ユーザーIDから友達情報を検索する
	 *
	 * @param userId - 検索するユーザーのID
	 * @returns 友達情報。見つからない場合は `null`
	 * @internal
	 */
	@autobind
	public lookupFriend(userId: User['id']): Friend | null {
		const doc = this.friends.findOne({
			userId: userId
		});

		if (doc == null) return null;

		const friend = new Friend(this, { doc: doc });

		return friend;
	}

	/**
	 * ファイルをドライブにアップロードする
	 *
	 * @param file - アップロードするファイル（Buffer または ReadStream）
	 * @param meta - ファイルのメタデータ（ファイル名、MIME タイプ等）
	 * @returns API レスポンス（作成されたドライブファイル情報）
	 * @internal
	 */
	@autobind
	public async upload(file: Buffer | fs.ReadStream, meta: any) {
		const res = await request.post({
			url: `${config.apiUrl}/drive/files/create`,
			formData: {
				i: config.i,
				file: {
					value: file,
					options: meta
				}
			},
			json: true
		});
		return res;
	}

	/**
	 * ノートを投稿する
	 *
	 * @remarks
	 * `config.postNotPublic` が `true` の場合、公開範囲が `public` だと自動的に `home` に変更される。
	 *
	 * @param param - 投稿パラメータ（`notes/create` API のパラメータ）
	 * @returns 作成されたノート
	 * @internal
	 */
	@autobind
	public async post(param: any) {
		if (config.postNotPublic && (!param.visibility || param.visibility == "public")) param.visibility = "home";
		if (!param.visibility && config.defaultVisibility) param.visibility = config.defaultVisibility
		const res = await this.api('notes/create', param);
		return res.createdNote;
	}

	/**
	 * 指定ユーザーにダイレクトメッセージを送信する
	 *
	 * @remarks
	 * 内部的には `visibility: 'specified'` のノートとして投稿される。
	 *
	 * @param userId - 送信先ユーザーのID
	 * @param param - 投稿パラメータ
	 * @returns 作成されたノート
	 * @internal
	 */
	@autobind
	public sendMessage(userId: any, param: any) {
		return this.post(Object.assign({
			visibility: 'specified',
			visibleUserIds: [userId],
		}, param));
	}

	/**
	 * Misskey API を呼び出す
	 *
	 * @remarks
	 * 最大33回のリトライを行う。リトライ間隔は 1秒 → 5秒 → 15秒 → 39秒 → 60秒 → 120秒。
	 * 4xx エラーは3回以上リトライした場合に resolve する。
	 *
	 * @param endpoint - API エンドポイント（例: `notes/create`）
	 * @param param - API パラメータ
	 * @returns API レスポンス
	 * @internal
	 */
	@autobind
	public api(endpoint: string, param?: any): Promise<any> {
		const maxRetries = 33;
		// NOTE: リトライ間隔は段階的に延ばし、最大120秒で頭打ちになる
		const retryIntervals = [1000, 5000, 15000, 39000, 60000, 120000];

		// HACK: リアクション作成時に reaction が空の場合は空文字列でフォールバック
		if (endpoint === 'notes/reactions/create' && param && !param?.reaction) param.reaction = "";

		return new Promise((resolve, reject) => {
			const attemptRequest = (attempt: number) => {
				if (attempt !== 0) this.log(`Retry ${attempt} / ${maxRetries} : ${endpoint} : ${JSON.stringify(param)}`);
				request.post(`${config.apiUrl}/${endpoint}`, {
					json: Object.assign({
						i: config.i
					}, param)
				})
					.then(response => {
						resolve(response);
					})
					.catch(error => {
						this.log(`API Error ${attempt + 1} / ${maxRetries} : ${endpoint} : ${JSON.stringify(param)} : ${JSON.stringify(error.response)}`);
						// NOTE: 4xxエラーはクライアント側の問題なので、3回以上リトライしても無駄な場合は resolve する
						if (error.response?.statusCode >= 400 && error.response?.statusCode < 500 && attempt >= 3) resolve(error);
						else if (attempt >= maxRetries - 1) {
							// 最大リトライ回数に達した→エラーでも resolve する（reject しない）
							resolve(error);
						} else {
							// 次のリトライまでの待機（最大間隔で頭打ち）
							setTimeout(() => {
								attemptRequest(attempt + 1);
							}, retryIntervals[Math.min(attempt, retryIntervals.length - 1)]);
						}
					});
			};

			attemptRequest(0);
		});
	}

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受ける
	 *
	 * @param module - 待ち受け登録するモジュール
	 * @param key - コンテキストを識別するキー（同一モジュール内で一意）
	 * @param id - 待ち受ける投稿のID
	 * @param data - コンテキストに保存するデータ
	 * @returns なし
	 *
	 * @see {@link unsubscribeReply} — 待ち受け解除
	 * @internal
	 */
	@autobind
	public subscribeReply(module: Module, key: string | null, id: string, data?: any) {
		this.log(`+++ subscribe Reply: ${module.name} - ${key ? key : "null"} : ${id}${data ? " : " + JSON.stringify(data) : ""}`);
		this.contexts.insertOne({
			noteId: id,
			module: module.name,
			key: key,
			data: data
		});
	}

	/**
	 * 返信の待ち受けを解除する
	 *
	 * @param module - 解除するモジュール
	 * @param key - 解除するコンテキストのキー
	 * @returns なし
	 *
	 * @see {@link subscribeReply} — 待ち受け登録
	 * @internal
	 */
	@autobind
	public unsubscribeReply(module: Module, key: string | null) {
		this.log(`--- unsubscribe Reply: ${module.name} - ${key ? key : "null"}`);
		this.contexts.findAndRemove({
			key: key,
			module: module.name
		});
	}

	/**
	 * 指定したミリ秒後にモジュールのタイムアウトコールバックを呼び出す
	 *
	 * @remarks
	 * このタイマーは DB に永続化されるため、途中でプロセスを再起動しても有効。
	 *
	 * @param module - タイマーを設定するモジュール
	 * @param delay - 遅延ミリ秒
	 * @param data - コールバックに渡すデータ
	 * @returns なし
	 * @internal
	 */
	@autobind
	public setTimeoutWithPersistence(module: Module, delay: number, data?: any) {
		const id = uuid();
		this.timers.insertOne({
			id: id,
			module: module.name,
			insertedAt: Date.now(),
			delay: delay,
			data: data
		});

		this.log(`Timer persisted: ${module.name} ${id} ${delay}ms`);
	}

	/**
	 * メタ情報を取得する
	 *
	 * @remarks
	 * 存在しない場合は初期値（`lastWakingAt: now`, `activeFactor: 1`）を作成して返す。
	 *
	 * @returns メタ情報レコード
	 * @internal
	 */
	@autobind
	public getMeta() {
		const rec = this.meta.findOne();

		if (rec) {
			return rec;
		} else {
			const initial: Meta = {
				lastWakingAt: Date.now(),
				activeFactor: 1,
			};

			this.meta.insertOne(initial);
			return initial;
		}
	}

	/**
	 * メタ情報を更新する
	 *
	 * @param meta - 更新するフィールド（部分更新可能）
	 * @returns なし
	 * @internal
	 */
	@autobind
	public setMeta(meta: Partial<Meta>) {
		const rec = this.getMeta();

		for (const [k, v] of Object.entries(meta)) {
			rec[k] = v;
		}

		this.meta.update(rec);
	}

	/**
	 * 活動係数を増加させる
	 *
	 * @remarks
	 * 正しいリアクションが付いた投稿があると呼ばれる。
	 * 増加量は現在の係数に反比例する。最大値は 2.0。
	 *
	 * @param amount - 増加の基準量
	 * @defaultValue amount は `0.003`
	 * @returns なし
	 * @internal
	 */
	@autobind
	public incActiveFactor(amount = 0.003) {
		// 現在の係数が高いほど増加量が小さくなる（反比例）
		const incNum = ((amount / Math.max(this.activeFactor, 1)));
		// 小数点3桁で丸め、最大2.0で制限
		this.activeFactor = Math.floor(Math.min(this.activeFactor + incNum, 2) * 1000) / 1000;
		this.log(`ActiveFactor: ${(this.activeFactor * 100).toFixed(1)}% (+${(incNum * 100).toFixed(1)}%)`);
		this.setMeta({
			activeFactor: this.activeFactor,
		});
	}

	/**
	 * 活動係数を減少させる
	 *
	 * @remarks
	 * 反応がない（デフォルトリアクションの）投稿があると呼ばれる。
	 * 1.0 未満の場合と 1.0 以上の場合で減少計算が異なる。最小値は 0.1。
	 *
	 * @param amount - 減少の基準量
	 * @defaultValue amount は `0.05`
	 * @returns なし
	 * @internal
	 */
	@autobind
	public decActiveFactor(amount = 0.05) {
		// 減少量の基本スケーリング（0.36倍）
		amount = amount * 0.36;
		const _activeFactor = this.activeFactor;
		let decNum = amount;
		if (this.activeFactor < 1) {
			// 1.0未満: 現在値に比例した緩やかな減少（最小0.1）
			decNum = (amount * this.activeFactor);
			this.activeFactor = Math.floor(Math.max(this.activeFactor - decNum, 0.1) * 1000) / 1000;
		} else {
			// 1.0以上: より大きく減少するが、一気に1.0以下にはならない
			decNum = (amount * this.activeFactor * 1.67);
			this.activeFactor = Math.floor(Math.max(this.activeFactor - decNum, 1 - (amount * this.activeFactor)) * 1000) / 1000;
		}
		this.log(`ActiveFactor: ${(this.activeFactor * 100).toFixed(1)}% (${((this.activeFactor - _activeFactor) * 100).toFixed(1)}%)`);
		this.setMeta({
			activeFactor: this.activeFactor,
		});
	}

	/**
	 * 学習済みキーワードを組み合わせて「バナナス」（しりとり風の造語）を生成する
	 *
	 * @remarks
	 * 2つの単語の末尾と先頭が一致する部分を結合して新しい語を作る。
	 * 最大100回試行し、適切な組み合わせが見つかれば結合結果を返す。
	 *
	 * @param inputWord - 起点となるキーワード（省略時はランダム選択）
	 * @param argWords - キーワード候補の配列（省略時はDBから取得）
	 * @param argExWords - 記号除去済みキーワード候補
	 * @param argWords2 - 4文字以上のキーワード候補
	 * @param argJpWords - 日本語で終わるキーワード候補
	 * @param argHirakanaWords - ひらがな/カタカナで終わるキーワード候補
	 * @param word1error - 前方の単語が見つからなかった場合 `true`
	 * @param word2error - 後方の単語が見つからなかった場合 `true`
	 * @returns 生成されたバナナス文字列。生成できなかった場合は空文字列
	 * @internal
	 */
	@autobind
	public makeBananasu(inputWord, argWords?, argExWords?, argWords2?, argJpWords?, argHirakanaWords?, word1error = false, word2error = false): string {

		// 候補となるキーワードを準備する（引数で渡されなければDBから取得）
		// words:    3文字以上で数字が先頭・末尾にないキーワード
		// exWords:  記号を先頭・末尾から除去したもの
		// words2:   4文字以上のキーワード（2文字マッチ用）
		// jpWords:  末尾が英数字でないキーワード
		// hirakanaWords: 末尾がひらがな/カタカナのキーワード
		const words = argWords || this.learnedKeywords.find()?.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
		const exWords = argExWords || words?.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
		const words2 = argWords2 || exWords?.filter((x) => x.keyword.length >= 4);
		const jpWords = argJpWords || exWords?.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
		const hirakanaWords = argHirakanaWords || jpWords?.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));

		// いずれかの候補リストが空なら生成不可能
		if (!(exWords.length && words2.length && jpWords.length && hirakanaWords.length)) return "";

		// 最大100回試行して適切な組み合わせを探す
		let i = 0;
		while (words && (i < 100 && (!word1error || !word2error))) {
			let word1 = "";
			let word2 = "";
			let word2s;
			let longword2s;
			let pc = 0;
			let matchStringNum = 1;
			if (inputWord) {
				if (word2error || (!word1error && Math.random() < 0.5)) {
					word1 = inputWord;
					word2s = words.filter((x) => katakanaToHiragana(hankakuToZenkaku(x.keyword)).toLowerCase().startsWith(katakanaToHiragana(hankakuToZenkaku(word1)).toLowerCase().slice(-1)));
					longword2s = words2.filter((x) => katakanaToHiragana(hankakuToZenkaku(x.keyword)).toLowerCase().startsWith(katakanaToHiragana(hankakuToZenkaku(word1)).toLowerCase().slice(-2)));
					pc = word2s.length + longword2s.length;
					if (pc === 0) {
						word1error = true;
						i += 1;
						continue;
					}
					if (word2s.length === 0 || longword2s.length && Math.random() < 0.4) {
						word2 = longword2s[Math.floor(Math.random() * longword2s.length)].keyword;
						matchStringNum = 1;
					} else {
						word2 = word2s[Math.floor(Math.random() * word2s.length)].keyword;
						matchStringNum = 1;
					}
				} else {
					word2 = inputWord;
					word2s = words.filter((x) => katakanaToHiragana(hankakuToZenkaku(x.keyword)).toLowerCase().endsWith(katakanaToHiragana(hankakuToZenkaku(word2)).toLowerCase().slice(0, 1)));
					longword2s = words2.filter((x) => katakanaToHiragana(hankakuToZenkaku(x.keyword)).toLowerCase().endsWith(katakanaToHiragana(hankakuToZenkaku(word2)).toLowerCase().slice(0, 2)));
					pc = word2s.length + longword2s.length;
					if (pc === 0) {
						word2error = true;
						i += 1;
						continue;
					}
					if (word2s.length === 0 || longword2s.length && Math.random() < 0.4) {
						word1 = longword2s[Math.floor(Math.random() * longword2s.length)].keyword;
						matchStringNum = 1;
					} else {
						word1 = word2s[Math.floor(Math.random() * word2s.length)].keyword;
						matchStringNum = 1;
					}
				}
			} else {

				if (Math.random() < 0.5) {
					word1 = words[Math.floor(Math.random() * words.length)].keyword;
				} else {
					if (Math.random() < 0.5) {
						word1 = jpWords[Math.floor(Math.random() * jpWords.length)].keyword;
					} else {
						word1 = hirakanaWords[Math.floor(Math.random() * hirakanaWords.length)].keyword;
					}
				}

				word2s = words.filter((x) => katakanaToHiragana(hankakuToZenkaku(x.keyword)).toLowerCase().startsWith(katakanaToHiragana(hankakuToZenkaku(word1)).toLowerCase().slice(-1)));
				longword2s = words2.filter((x) => katakanaToHiragana(hankakuToZenkaku(x.keyword)).toLowerCase().startsWith(katakanaToHiragana(hankakuToZenkaku(word1)).toLowerCase().slice(-2)));
				pc = word2s.length + longword2s.length;

				if (pc === 0 || (pc <= 3 && Math.random() < (0.75 / pc) + (pc === 1 && word2s.length === 1 ? 0.2 : 0))) {
					i += 1;
					continue;
				}

				if (word2s.length === 0 || longword2s.length && Math.random() < 0.4) {
					word2 = longword2s[Math.floor(Math.random() * longword2s.length)].keyword;
					matchStringNum = 1;
				} else {
					word2 = word2s[Math.floor(Math.random() * word2s.length)].keyword;
					matchStringNum = 1;
				}
			}

			// word1 の末尾と word2 の先頭がどこまで一致するか拡張する
			while (matchStringNum < Math.min(word1.length, word2.length) && katakanaToHiragana(hankakuToZenkaku(word2)).toLowerCase().startsWith(katakanaToHiragana(hankakuToZenkaku(word1)).toLowerCase().slice((matchStringNum + 1) * -1))) {
				matchStringNum += 1;
			}

			// 大文字小文字が完全一致しない場合のフラグ
			const notMatchCase = !word2.startsWith(word1.slice((matchStringNum) * -1));

			const info = `\n[${word1.slice(-1)} : ${word2s.length}${longword2s.length ? ` , ${word1.slice(-2)} : ${longword2s.length}` : ""}]`;

			// 結果: 「word1 の word2、{word1の前半}{word2}」という形式
			return `${word1} の ${word2}、${word1.slice(0, matchStringNum * -1)}${notMatchCase ? word2.slice(0, matchStringNum).toUpperCase() + word2.slice(matchStringNum) : word2}`;
		}
		return "";
	}
}

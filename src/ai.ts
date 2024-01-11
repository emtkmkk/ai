// AI CORE

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
const pkg = require('../package.json');

type MentionHook = (msg: Message) => Promise<boolean | HandlerResult>;
type ContextHook = (key: any, msg: Message, data?: any) => Promise<void | boolean | HandlerResult>;
type TimeoutCallback = (data?: any) => void;

export type HandlerResult = {
	reaction?: string | null;
	immediate?: boolean;
};

export type InstallerResult = {
	mentionHook?: MentionHook;
	contextHook?: ContextHook;
	timeoutCallback?: TimeoutCallback;
};

export type Meta = {
	lastWakingAt: number;
	activeFactor: number | null;
};

/**
 * 藍
 */
export default class 藍 {
	public readonly version = pkg._v;
	public account: User;
	public connection: Stream;
	public modules: Module[] = [];
	private mentionHooks: MentionHook[] = [];
	private contextHooks: { [moduleName: string]: ContextHook } = {};
	private timeoutCallbacks: { [moduleName: string]: TimeoutCallback } = {};
	public db: loki;
	public lastSleepedAt: number;
	public activeFactor: number;

	private meta: loki.Collection<Meta>;

	private contexts: loki.Collection<{
		noteId?: string;
		userId?: string;
		module: string;
		key: string | null;
		data?: any;
	}>;

	private timers: loki.Collection<{
		id: string;
		module: string;
		insertedAt: number;
		delay: number;
		data?: any;
	}>;

	public friends: loki.Collection<FriendDoc>;
	public moduleData: loki.Collection<any>;

	/**
	 * 藍インスタンスを生成します
	 * @param account 藍として使うアカウント
	 * @param modules モジュール。先頭のモジュールほど高優先度
	 */
	constructor(account: User, modules: Module[]) {
		this.account = account;
		this.modules = modules;

		let memoryDir = '.';
		if (config.memoryDir) {
			memoryDir = config.memoryDir;
		}
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

	@autobind
	public log(msg: string) {
		log(chalk`[{magenta AiOS}]: ${msg}`);
	}

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
		//#endregion

		const meta = this.getMeta();
		this.lastSleepedAt = meta.lastWakingAt;
		this.activeFactor = meta.activeFactor || 1;

		// Init stream
		this.connection = new Stream();

		//#region Main stream
		const mainStream = this.connection.useSharedConnection('main');

		// メンションされたとき
		mainStream.on('mention', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) {
				// Misskeyのバグで投稿が非公開扱いになる
				if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
				this.onReceiveMessage(new Message(this, data));
			}
		});

		// 返信されたとき
		mainStream.on('reply', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) return;
			// Misskeyのバグで投稿が非公開扱いになる
			if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
			this.onReceiveMessage(new Message(this, data));
		});

		// Renoteされたとき
		mainStream.on('renote', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text == null && (data.files || []).length == 0) return;

			// リアクションする
			this.api('notes/reactions/create', {
				noteId: data.id,
				reaction: ':mk_chuchuchicken:'
			});
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

		// Install modules
		this.modules.forEach(m => {
			this.log(`Installing ${chalk.cyan.italic(m.name)}\tmodule...`);
			m.init(this);
			const res = m.install();
			if (res != null) {
				if (res.mentionHook) this.mentionHooks.push(res.mentionHook);
				if (res.contextHook) this.contextHooks[m.name] = res.contextHook;
				if (res.timeoutCallback) this.timeoutCallbacks[m.name] = res.timeoutCallback;
			}
		});

		// タイマー監視
		this.crawleTimer();
		setInterval(this.crawleTimer, 1000);

		setInterval(this.logWaking, 10000);

		this.log(chalk.green.bold('Ai am now running!'));
	}

	/**
	 * ユーザーから話しかけられたとき
	 * (メンション、リプライ、トークのメッセージ)
	 */
	@autobind
	private async onReceiveMessage(msg: Message): Promise<void> {
		this.log(chalk.gray(`<<< An message received: ${chalk.underline(msg.id)}`));

		// Ignore message if the user is a bot
		// To avoid infinity reply loop.
		if (msg.user.isBot) {
			return;
		}

		const isNoContext = msg.replyId == null;

		// Look up the context
		const context = isNoContext ? null : this.contexts.findOne({
			noteId: msg.replyId
		});

		let reaction: string | null = ':mk_widechicken:';
		let immediate: boolean = false;

		//#region
		const invokeMentionHooks = async () => {
			let res: boolean | HandlerResult | null = null;

			for (const handler of this.mentionHooks) {
				res = await handler(msg);
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
			const res = await handler(context.key, msg, context.data);

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction;
				if (res.immediate != null) immediate = res.immediate;
			}

			if (res === false) {
				await invokeMentionHooks();
			}
		} else {
			await invokeMentionHooks();
		}
		//#endregion

		if (!immediate) {
			await delay(1000);
		}

		if (reaction === "love") reaction = ":mk_hi:";
		if (reaction === "like") reaction = ":mk_yurayurachicken:";
		if (reaction === "hmm") reaction = ":mk_fly_sliver:";
		if (reaction === "confused") reaction = ":mk_ultrawidechicken:";

		const friend = new Friend(this, { user: msg.user });
		if (![":mk_widechicken:", ":mk_fly_sliver:", ":mk_ultrawidechicken:"].includes(reaction)) {
			// 正しい反応の場合
			friend.incLove(0.1, reaction);
		} else if (reaction === ":mk_widechicken:") {
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

	@autobind
	private onNotification(notification: any) {
		switch (notification.type) {
			// リアクションされたら親愛度を少し上げる
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

	@autobind
	private crawleTimer() {
		const timers = this.timers.find();
		for (const timer of timers) {
			// タイマーが時間切れかどうか
			if (Date.now() - (timer.insertedAt + timer.delay) >= 0) {
				this.log(`Timer expired: ${timer.module} ${timer.id}`);
				this.timers.remove(timer);
				this.timeoutCallbacks[timer.module](timer.data);
			}
		}
	}

	@autobind
	private logWaking() {
		this.setMeta({
			lastWakingAt: Date.now(),
		});
	}

	/**
	 * データベースのコレクションを取得します
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
	 * ファイルをドライブにアップロードします
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
	 * 投稿します
	 */
	@autobind
	public async post(param: any) {
		const res = await this.api('notes/create', param);
		return res.createdNote;
	}

	/**
	 * 指定ユーザーにトークメッセージを送信します
	 */
	@autobind
	public sendMessage(userId: any, param: any) {
		return this.post(Object.assign({
			visibility: 'specified',
			visibleUserIds: [userId],
		}, param));
	}

	/**
	 * APIを呼び出します
	 */
	@autobind
	public api(endpoint: string, param?: any): Promise<any> {
		const maxRetries = 33;
		const retryIntervals = [1000, 5000, 15000, 39000, 60000, 120000];

		if (endpoint === 'notes/reactions/create' && param && !param?.reaction) param.reaction = "";

		return new Promise((resolve, reject) => {
			const attemptRequest = (attempt: number) => {
				if (attempt !== 0) this.log(`Retry ${attempt} / ${maxRetries} : ${endpoint} : ${JSON.stringify(param)}`)
				request.post(`${config.apiUrl}/${endpoint}`, {
					json: Object.assign({
						i: config.i
					}, param)
				})
					.then(response => {
						resolve(response);
					})
					.catch(error => {
						this.log(`API Error ${attempt + 1} / ${maxRetries} : ${endpoint} : ${JSON.stringify(param)} : ${JSON.stringify(error.response)}`)
						if (error.response?.statusCode >= 400 && error.response?.statusCode < 500) resolve(error);
						else if (attempt >= maxRetries - 1) {
							resolve(error);
						} else {
							setTimeout(() => {
								attemptRequest(attempt + 1);
							}, retryIntervals[Math.min(attempt, retryIntervals.length - 1)]);
						}
					});
			}

			attemptRequest(0);
		});
	}

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受けます
	 * @param module 待ち受けるモジュール名
	 * @param key コンテキストを識別するためのキー
	 * @param id トークメッセージ上のコンテキストならばトーク相手のID、そうでないなら待ち受ける投稿のID
	 * @param data コンテキストに保存するオプションのデータ
	 */
	@autobind
	public subscribeReply(module: Module, key: string | null, id: string, data?: any) {
		this.contexts.insertOne({
			noteId: id,
			module: module.name,
			key: key,
			data: data
		});
	}

	/**
	 * 返信の待ち受けを解除します
	 * @param module 解除するモジュール名
	 * @param key コンテキストを識別するためのキー
	 */
	@autobind
	public unsubscribeReply(module: Module, key: string | null) {
		this.contexts.findAndRemove({
			key: key,
			module: module.name
		});
	}

	/**
	 * 指定したミリ秒経過後に、そのモジュールのタイムアウトコールバックを呼び出します。
	 * このタイマーは記憶に永続化されるので、途中でプロセスを再起動しても有効です。
	 * @param module モジュール名
	 * @param delay ミリ秒
	 * @param data オプションのデータ
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

	@autobind
	public setMeta(meta: Partial<Meta>) {
		const rec = this.getMeta();

		for (const [k, v] of Object.entries(meta)) {
			rec[k] = v;
		}

		this.meta.update(rec);
	}

	@autobind
	public incActiveFactor(amount = 0.01) {
		const incNum = ((amount / Math.max(this.activeFactor,1)));
		this.activeFactor = Math.floor(Math.min(this.activeFactor + incNum, 2) * 1000) / 1000;
		this.log(`ActiveFactor: ${(this.activeFactor * 100).toFixed(1)}% (+${(incNum * 100).toFixed(1)}%)`);
		this.setMeta({
			activeFactor: this.activeFactor,
		});
	}

	@autobind
	public decActiveFactor(amount = 0.05) {
		const _activeFactor = this.activeFactor
		let decNum = amount;
		if (this.activeFactor < 1) {
			decNum = (amount * this.activeFactor);
			this.activeFactor = Math.floor(Math.max(this.activeFactor - decNum, 0.1) * 1000) / 1000;
		} else {
			decNum = (amount * this.activeFactor * 2);
			this.activeFactor = Math.floor(Math.max(this.activeFactor - decNum, 1 - (amount * this.activeFactor)) * 1000) / 1000;
		}
		this.log(`ActiveFactor: ${(this.activeFactor * 100).toFixed(1)}% (${((this.activeFactor - _activeFactor) * 100).toFixed(1)}%)`);
		this.setMeta({
			activeFactor: this.activeFactor,
		});
	}
}

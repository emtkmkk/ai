/**
 * @packageDocumentation
 *
 * リマインダーモジュール
 *
 * ユーザーがメンションで `remind` / `リマインド` / `todo` と送ると、
 * リマインダーを登録し、12時間おきに催促通知を送信する。
 * ユーザーが「やった」「完了」等と返信すると完了としてリマインダーを削除する。
 *
 * @remarks
 * - NOTE: 催促通知は深夜（0〜7時）を避け、8時以降まで遅延する。
 * - NOTE: 催促は最大10回まで。10回目で最終通知を送り、それ以上は催促しない。
 * - NOTE: 引用リマインドにも対応。引用元ノートを記録し、催促時に引用リノートする。
 * - NOTE: フォロワー限定メンションからのリマインド登録は拒否する。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs, { getSerif } from '@/serifs';
import { acct } from '@/utils/acct';
import config from '@/config';

/** 催促通知の間隔: 12時間（ミリ秒） */
const NOTIFY_INTERVAL = 1000 * 60 * 60 * 12;

/**
 * リマインダーモジュールクラス
 *
 * @remarks
 * mentionHook でリマインダー登録、contextHook で完了/キャンセル確認、
 * timeoutCallback で定期催促を行う。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'reminder';

	/**
	 * リマインダーコレクション
	 *
	 * @remarks
	 * LokiJS コレクション。userId と id でインデックスを持つ。
	 *
	 * @internal
	 */
	private reminds: loki.Collection<{
		/** リマインドを登録したユーザーのID */
		userId: string;
		/** リマインド元メッセージのID */
		id: string;
		/** リマインドの内容テキスト（引用リマインドの場合は null） */
		thing: string | null;
		/** 引用元ノートのID（テキストリマインドの場合は null） */
		quoteId: string | null;
		/** 催促した回数（10回で最終通知） */
		times: number;
		/** リマインド作成日時（ミリ秒タイムスタンプ） */
		createdAt: number;
	}>;

	/**
	 * モジュールの初期化
	 *
	 * @returns mentionHook / contextHook / timeoutCallback を含むフック登録オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		this.reminds = this.ai.getCollection('reminds', {
			indices: ['userId', 'id']
		});

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	/**
	 * メンション受信時のフック: リマインダー登録
	 *
	 * @remarks
	 * `remind` / `リマインド` / `todo` で始まるメンションを処理。
	 * - `reminds` / `todos` / `リマインド一覧`: 登録済みリマインダーの一覧表示
	 * - それ以外: 新規リマインダー登録
	 *
	 * NOTE: フォロワー限定からのリマインド登録は拒否する。
	 * NOTE: 内容なし＋引用なしの場合も拒否する。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		let text = msg.extractedText.toLowerCase();
		if (!text.startsWith('remind') && !text.startsWith('リマインド') && !text.startsWith('todo')) return false;

		// 一覧表示
		if (text.startsWith('reminds') || text.startsWith('todos') || text.startsWith('リマインド一覧')) {
			const reminds = this.reminds.find({
				userId: msg.userId,
			});

			const getQuoteLink = id => `[${id}](${config.host}/notes/${id})`;

			msg.reply(serifs.reminder.reminds + '\n' + reminds.map(remind => `・${remind.thing ? remind.thing : getQuoteLink(remind.quoteId)}`).join('\n'));
			return true;
		}

		// キーワード部分を除去して内容を抽出
		if (text.match(/^(.+?)\s(.+)/)) {
			text = text.replace(/^(.+?)\s/, '');
		} else {
			text = '';
		}

		const separatorIndex = text.indexOf(' ') > -1 ? text.indexOf(' ') : text.indexOf('\n');
		const thing = text.substr(separatorIndex + 1).trim();

		// 内容なし＋引用なし、またはフォロワー限定の場合は拒否
		if (thing === '' && msg.quoteId == null || msg.visibility === 'followers') {
			msg.reply(serifs.reminder.invalid);
			return {
				reaction: ':mk_ultrawidechicken:',
				immediate: true,
			};
		}

		// リマインダー登録
		const remind = this.reminds.insertOne({
			id: msg.id,
			userId: msg.userId,
			thing: thing === '' ? null : thing,
			quoteId: msg.quoteId,
			times: 0,
			createdAt: Date.now(),
		});

		// メンション元をsubscribe（完了/キャンセルを検知するため）
		this.subscribeReply(remind!.id, msg.id, {
			id: remind!.id
		});

		if (msg.quoteId) {
			// 引用元もsubscribe
			this.subscribeReply(remind!.id, msg.quoteId, {
				id: remind!.id
			});
		}

		// 12時間後に最初の催促タイマーをセット
		this.setTimeoutWithPersistence(NOTIFY_INTERVAL, {
			id: remind!.id,
		});

		return {
			reaction: ':mk_muscleok:',
			immediate: true,
		};
	}

	/**
	 * コンテキストフック: 完了/キャンセルの確認
	 *
	 * @remarks
	 * ユーザーが「done」「やった」「完了」等と返信した場合、リマインダーを完了として削除。
	 * 「やめる」「キャンセル」でキャンセル。
	 * 登録者以外が返信した場合は拒否メッセージを返す。
	 *
	 * @param key - コンテキストキー
	 * @param msg - 受信メッセージ
	 * @param data - コンテキストデータ（リマインドID）
	 * @returns 処理結果、または `false`
	 * @internal
	 */
	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (msg.text == null) return;

		const remind = this.reminds.findOne({
			id: data.id,
		});

		if (remind == null) {
			this.unsubscribeReply(key);
			return;
		}

		const done = msg.includes(['done', 'やった', 'やりました', 'はい', 'おわった', '終わった', '完了']);
		const cancel = msg.includes(['やめる', 'やめた', 'キャンセル']);
		const isOneself = msg.userId === remind.userId;

		if ((done || cancel) && isOneself) {
			this.unsubscribeReply(key);
			this.reminds.remove(remind);
			msg.reply(done ? getSerif(serifs.reminder.done(msg.friend.name)) : serifs.reminder.cancel);
			return {
				reaction: 'love'
			};
		} else if (isOneself === false) {
			// 登録者以外は完了操作できない
			msg.reply(serifs.reminder.doneFromInvalidUser);
			return {
				reaction: 'confused'
			};
		} else {
			return false;
		}
	}

	/**
	 * タイムアウトコールバック: 定期催促の送信
	 *
	 * @remarks
	 * 12時間おきに催促通知を送信する。深夜（0〜7時）は8時間遅延させる。
	 * 催促は最大10回まで。10回目で最終通知（これ以上催促しない旨）を送る。
	 *
	 * NOTE: 催促先のノートが削除されていた場合（APIエラー400）はリマインダー自体を解除する。
	 *
	 * @param data - タイムアウトデータ（リマインドID）
	 * @internal
	 */
	@autobind
	private async timeoutCallback(data) {
		const remind = this.reminds.findOne({
			id: data.id
		});
		if (remind == null) return;

		// 深夜は催促を避け、8時間後に再スケジュール
		if (new Date().getHours() < 8) {
			this.setTimeoutWithPersistence(1000 * 60 * 60 * 8, {
				id: remind.id,
			});
			return;
		}

		remind.times++;
		this.reminds.update(remind);

		const friend = this.ai.lookupFriend(remind.userId);
		if (friend == null) return;

		let reply;
		const lastNotify = remind.times >= 10;
		try {
			// 催促ノートを投稿（引用リノート形式）
			reply = await this.ai.post({
				replyId: remind.thing == null && remind.quoteId ? remind.quoteId : remind.id,
				renoteId: remind.thing == null && remind.quoteId ? remind.quoteId : remind.id,
				text: acct(friend.doc.user) + ' ' + (lastNotify ? serifs.reminder.lastNotify(friend.name) : serifs.reminder.notify(friend.name)),
				visibility: 'home'
			});
		} catch (err) {
			// リノート対象が削除されていたらリマインダーを解除
			if (err.statusCode === 400) {
				this.unsubscribeReply(remind.thing == null && remind.quoteId ? remind.quoteId : remind.id);
				this.reminds.remove(remind);
				return;
			}
			return;
		}

		if (!reply?.id) return;

		// 催促ノートへの返信もsubscribe
		this.subscribeReply(remind.id, reply.id, {
			id: remind.id
		});

		// 最終通知でなければ次回の催促をスケジュール（間隔にランダム幅を持たせる）
		if (!lastNotify) {
			this.setTimeoutWithPersistence(Math.round(NOTIFY_INTERVAL * (Math.random() + 0.5)), {
				id: remind.id,
			});
		}
	}
}

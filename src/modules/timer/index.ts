/**
 * @packageDocumentation
 *
 * timer モジュール
 *
 * メンションで「〇秒/〇分/〇時間/〇日」を指定すると、指定時間後に通知する。
 * タイマーは {@link Module.setTimeoutWithPersistence} を使い、プロセス再起動後も有効。
 *
 * @remarks
 * - 最大30日（2,592,000,000ミリ秒）まで設定可能
 * - mentionHook と timeoutCallback を登録
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { acct } from '@/utils/acct';

export default class extends Module {
	public readonly name = 'timer';

	/**
	 * モジュールをインストールし、mentionHook と timeoutCallback を登録する
	 *
	 * @returns mentionHook と timeoutCallback を含むインストール結果
	 * @internal
	 */
	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	/**
	 * メンションから時間指定を解析し、タイマーをセットする
	 *
	 * @remarks
	 * 「〇秒」「〇分」「〇時間」「〇日」を正規表現で抽出し、合算してタイマーを設定。
	 * 合計0秒やキーワードなしの場合は無視、30日超は拒否する。
	 *
	 * @param msg - 受信したメッセージ
	 * @returns マッチした場合はリアクション結果、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		const secondsQuery = (msg.text || '').match(/([0-9]+)秒/);
		const minutesQuery = (msg.text || '').match(/([0-9]+)分/);
		const hoursQuery = (msg.text || '').match(/([0-9]+)時間/);
		const daysQuery = (msg.text || '').match(/([0-9]+)日/);

		const seconds = secondsQuery ? parseInt(secondsQuery[1], 10) : 0;
		const minutes = minutesQuery ? parseInt(minutesQuery[1], 10) : 0;
		const hours = hoursQuery ? parseInt(hoursQuery[1], 10) : 0;
		const days = daysQuery ? parseInt(daysQuery[1], 10) : 0;

		// 時間指定キーワードが1つもなければ無視
		if (!(secondsQuery || minutesQuery || hoursQuery || daysQuery)) return false;

		if ((seconds + minutes + hours + days) == 0) {
			msg.reply(serifs.timer.invalid);
			return true;
		}

		const time =
			(1000 * seconds) +
			(1000 * 60 * minutes) +
			(1000 * 60 * 60 * hours) +
			(1000 * 60 * 60 * 24 * days);

		// 30日（2,592,000,000ms）を超えるタイマーは拒否
		if (time > 2592000000) {
			msg.reply(serifs.timer.tooLong);
			return true;
		}

		msg.reply(serifs.timer.set(Math.ceil((Date.now() + time) / 1000)));

		// 表示用の時間文字列を組み立てる
		const str = `${days ? daysQuery![0] : ''}${hours ? hoursQuery![0] : ''}${minutes ? minutesQuery![0] : ''}${seconds ? secondsQuery![0] : ''}`;

		// 永続化タイマーをセット（プロセス再起動後も有効）
		this.setTimeoutWithPersistence(time, {
			msgId: msg.id,
			userId: msg.friend.userId,
			time: str
		});

		return {
			reaction: 'love'
		};
	}

	/**
	 * タイマー完了時のコールバック。設定者にメンション付きで通知する
	 *
	 * @remarks
	 * 元の投稿への返信を試み、失敗した場合はホームに直接投稿する。
	 *
	 * @param data - 永続化されたタイマーデータ（msgId, userId, time）
	 * @internal
	 */
	@autobind
	private async timeoutCallback(data) {
		const friend = this.ai.lookupFriend(data.userId);
		if (friend == null) return; // 処理の流れ上、実際にnullになることは無さそうだけど一応
		const text = serifs.timer.notify(data.time, friend.name);
		try {
			await this.ai.post({
				replyId: data.msgId,
				text: acct(friend.doc.user) + ' ' + text,
				visibility: 'home'
			});
		} catch (e) {
			// 元の投稿が削除されている場合などのフォールバック
			this.ai.post({
				text: acct(friend.doc.user) + ' ' + text,
				visibility: 'home'
			});
		}
	}
}

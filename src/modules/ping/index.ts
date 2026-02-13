/**
 * @packageDocumentation
 *
 * ping モジュール
 *
 * メンションに「ping」が含まれていたら「PONG!」と即座に返信する。
 * ボットの死活確認用途を想定したシンプルなモジュール。
 *
 * @remarks
 * フックは mentionHook のみ。コンテキストやタイムアウトは使用しない。
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';

export default class extends Module {
	public readonly name = 'ping';

	/**
	 * モジュールをインストールし、mentionHook を登録する
	 *
	 * @returns mentionHook を含むインストール結果
	 * @internal
	 */
	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * 「ping」を含むメンションに「PONG!」と即座に返信する
	 *
	 * @param msg - 受信したメッセージ
	 * @returns マッチした場合はリアクション結果、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text && msg.text.includes('ping')) {
			msg.reply('PONG!', {
				immediate: true
			});
			return {
				reaction: 'love',
				immediate: true
			};
		} else {
			return false;
		}
	}
}

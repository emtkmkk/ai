/**
 * @packageDocumentation
 *
 * valentine モジュール
 *
 * 2月14日（バレンタインデー）に、親愛度5以上の友達全員にチョコレートメッセージを送る。
 * 3分間隔のポーリングで日付チェックを行い、同日中に2回送らないよう制御する。
 *
 * @remarks
 * フックは一切登録しない。`install()` でタイマーを設定するのみ。
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import Friend from '@/friend';
import serifs from '@/serifs';

export default class extends Module {
	public readonly name = 'valentine';

	/**
	 * モジュールをインストールし、バレンタインチェック用タイマーを設定する
	 *
	 * @returns 空のインストール結果（フックなし）
	 * @internal
	 */
	@autobind
	public install() {
		this.crawleValentine();
		setInterval(this.crawleValentine, 1000 * 60 * 3);

		return {};
	}

	/**
	 * バレンタインデーかどうかをチェックし、該当日であれば友達にチョコを配る
	 *
	 * @remarks
	 * - `getMonth()` は0始まりなので、2月 = 1
	 * - 親愛度5未満のユーザーにはチョコを送らない
	 * - モジュール固有データの `lastChocolated` で同日中の重複送信を防止
	 *
	 * @internal
	 */
	@autobind
	private crawleValentine() {
		const now = new Date();

		// NOTE: getMonth() は 0 始まり。1 = 2月
		const isValentine = now.getMonth() == 1 && now.getDate() == 14;
		if (!isValentine) return;

		const date = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

		const friends = this.ai.friends.find({} as any);

		friends.forEach(f => {
			const friend = new Friend(this.ai, { doc: f });

			// 親愛度が5以上必要
			if (friend.love < 5) return;

			const data = friend.getPerModulesData(this);

			if (data.lastChocolated == date) return;

			data.lastChocolated = date;
			friend.setPerModulesData(this, data);

			const text = serifs.valentine.chocolateForYou(friend.name);

			this.ai.sendMessage(friend.userId, {
				text: text
			});
		});
	}
}

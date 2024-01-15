import autobind from 'autobind-decorator';
import Module from '@/module';
import Friend from '@/friend';
import serifs from '@/serifs';
import { acct } from '@/utils/acct';

function zeroPadding(num: number, length: number): string {
	return ('0000000000' + num).slice(-length);
}

export default class extends Module {
	public readonly name = 'birthday';

	@autobind
	public install() {
		this.crawleBirthday();
		setInterval(this.crawleBirthday, 1000 * 60 * 3);

		return {};
	}

	/**
	 * 誕生日のユーザーがいないかチェック(いたら祝う)
	 */
	@autobind
	private crawleBirthday() {
		const now = new Date();
		const m = now.getMonth();
		const d = now.getDate();
		//8時より前に通知を飛ばさない
		if (now.getHours() < 8) return;
		// Misskeyの誕生日は 2018-06-16 のような形式
		const today = `${zeroPadding(m + 1, 2)}-${zeroPadding(d, 2)}`;

		const birthFriends = this.ai.friends.find({
			'user.birthday': { '$regex': new RegExp('-' + today + '$') }
		} as any);

		birthFriends.forEach(f => {
			const friend = new Friend(this.ai, { doc: f });

			if (friend.doc?.user?.username === "eroflash") return;

			// 親愛度が1以上必要
			if (friend.love < 1) return;

			// リモートユーザなら、親愛度が5以上（☆4）必要
			if (!friend.doc?.user?.host && friend.love < 5) return;

			// 好感度★6以下で最後の好感度増加から31日以上経過している場合は対象外
			if (friend.love < 100 && friend.doc?.lastLoveIncrementedAt && Date.now() > new Date(friend.doc.lastLoveIncrementedAt)?.valueOf() + (1000 * 60 * 60 * 24 * 31)) return;
			// 好感度★7以上で最後の好感度増加から364日以上経過している場合は対象外
			if (friend.love >= 100 && friend.doc?.lastLoveIncrementedAt && Date.now() > new Date(friend.doc.lastLoveIncrementedAt)?.valueOf() + (1000 * 60 * 60 * 24 * 364)) return;

			const data = friend.getPerModulesData(this);

			if (data.lastBirthdayChecked == today) return;

			data.lastBirthdayChecked = today;
			friend.setPerModulesData(this, data);

			const text = serifs.birthday.happyBirthday(friend.name);

			if (!friend.doc?.user?.host) {
				this.ai.post({
					text: serifs.birthday.happyBirthdayLocal(friend.name, acct(friend.doc.user)),
					localOnly: true,
				});
			} else {
				this.ai.sendMessage(friend.userId, {
					text: acct(friend.doc.user) + ' ' + text
				});
			}
		});
	}
}

import autobind from 'autobind-decorator';
import Module from '@/module';
import Friend, { FriendDoc } from '@/friend';
import { acct } from '@/utils/acct';

export default class extends Module {
	public readonly name = 'welcome';

	@autobind
	public install() {
		const tl = this.ai.connection.useSharedConnection('localTimeline');

		tl.on('note', this.onLocalNote);

		return {};
	}

	@autobind
	private onLocalNote(note: any) {
		if (!note.user.isBot && note.isFirstNote) {
			const friend = new Friend(this.ai, { user: note.user });
			if (!friend.doc.isWelcomeMessageSent){
				friend.doc.isWelcomeMessageSent = true;
				friend.save();
				setTimeout(() => {
					this.ai.api('notes/create', {
						renoteId: note.id,
						localOnly: true
					});
				}, 3000);
				
				setTimeout(() => {
					this.ai.api('notes/reactions/create', {
						noteId: note.id,
						reaction: ':mk_hi:'
					});
				}, 4500);

				setTimeout(() => {
					this.ai.api('notes/reactions/create', {
						noteId: note.id,
						reaction: ':youkoso:'
					});
				}, 5500);
				
				setTimeout(() => {
					this.ai.api('notes/reactions/create', {
						noteId: note.id,
						reaction: ':supertada:'
					});
				}, 6500);
				
				setTimeout(() => {
					this.ai.api('notes/create', {
						text: `${acct(note.user)}さん\n**もこきーへようこそ！**\nわたしはもこもこチキン、このサーバーのマスコットみたいな存在です！\nお暇な時に挨拶していただいたり、呼び名を教えていただいたり、占いや迷路などで遊んでくださったりしてくれれば嬉しいです！\nこれからよろしくお願いします！\n\nこのサーバーには独自機能が沢山あるので、気になったらお知らせの中にあるもこきーTipsを読んでみるといいかもです！\nなにか分からないことや嫌なこと、不便なことがあれば、気軽にもこきーあどみんに声をかけてください！\nそれでは楽しいもこきーライフを～ :mk_hi:`,
						replyId: note.id,
						visibility: 'specified',
						visibleUserIds: [note.user.id],
					});
				}, 8000);
			}
		}
	}
}

import autobind from 'autobind-decorator';
import Module from '@/module';
import Friend, { FriendDoc } from '@/friend';
import { acct } from '@/utils/acct';
import serifs from '@/serifs';

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
		if (!note.user?.isBot && !note.user.host) {
			const friend = new Friend(this.ai, { user: note.user });
			if (!friend?.doc?.isWelcomeMessageSent && friend.doc.user.notesCount != null && friend.doc.user.notesCount < 50 ){
				friend.doc.isWelcomeMessageSent = true;
				friend.save();
				if (note.isFirstNote) {
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

				}

				setTimeout(() => {
					this.ai.api('notes/create', {
						text: serifs.welcome.welcome(acct(note.user)),
						replyId: note.id,
						visibility: 'specified',
						visibleUserIds: [note.user.id],
					});
				}, 8000);
			}
		}
	}
}

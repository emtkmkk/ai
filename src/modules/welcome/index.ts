import autobind from 'autobind-decorator';
import Module from '@/module';

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
			}, 5000);

			setTimeout(() => {
				this.ai.api('notes/reactions/create', {
					noteId: note.id,
					reaction: ':youkoso:'
				});
			}, 7000);
		}
	}
}

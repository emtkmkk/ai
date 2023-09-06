import autobind from 'autobind-decorator';
import { parse } from 'twemoji-parser';
const delay = require('timeout-as-promise');

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
import includes from '@/utils/includes';

export default class extends Module {
	public readonly name = 'emoji-react';

	private htl: ReturnType<Stream['useSharedConnection']>;

	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection('homeTimeline');
		this.htl.on('note', this.onNote);

		return {};
	}

	@autobind
	private async onNote(note: Note) {
		if (note.user.isBot) return;
		if (note.reply != null) return;
		if (note.text == null) return;
		if (note.text.includes('@')) return; // (自分または他人問わず)メンションっぽかったらreject

		const react = async (reaction: string, immediate = false) => {
			if (!immediate) {
				await delay(4000);
			}
			this.ai.api('notes/reactions/create', {
				noteId: note.id,
				reaction: reaction
			});
		};

		let customEmojis = note.text.match(/:([^\n:]+?):/g)?.filter((x) => x.includes("mk"));
		if (customEmojis && customEmojis.length > 0) {
			// カスタム絵文字が複数種類ある場合はキャンセル
			if (!customEmojis.every((val, i, arr) => val === arr[0])) return;

			this.log(`Custom emoji detected - ${customEmojis[0]}`);

			return react(customEmojis[0]);
		}

		/*const emojis = parse(note.text).map(x => x.text);
		if (emojis.length > 0) {
			// 絵文字が複数種類ある場合はキャンセル
			if (!emojis.every((val, i, arr) => val === arr[0])) return;

			this.log(`Emoji detected - ${emojis[0]}`);

			let reaction = emojis[0];

			switch (reaction) {
				case '✊': return react('🖐', true);
				case '✌': return react('✊', true);
				case '🖐': case '✋': return react('✌', true);
			}

			return react(reaction);
		}

		if (includes(note.text, ['ぴざ'])) return react('🍕');
		if (includes(note.text, ['ぷりん'])) return react('🍮');
		if (includes(note.text, ['寿司', 'sushi']) || note.text === 'すし') return react('🍣');*/
		if (includes(note.text, ['ぴざ'])) return react(':itspizzatime:');
		if (includes(note.text, ['かんぴろばくたー','campylobacter'])) return react(':campylobacter_mottenaidesu:');
		if (includes(note.text, ['もこもこ'])) return react(':mokomoko:');
		if (includes(note.text, ['もこ'])) return react(':mk_chicken_t:');
		if (includes(note.text, ['むいみ','無意味','muimi'])) return react(':osiina:');
		if (includes(note.text, ['うそ','嘘','uso'])) return react(':sonnano_uso:');
		if (includes(note.text, ['めつ','滅','metu'])) return react(':metu:');
		if (includes(note.text, ['おはよ', 'ohayo'])) return react(':mk_oha:');
		if (includes(note.text, ['おやす', 'oyasu'])) return react(':oyasumi2:');
		if (includes(note.text, ['taikin', '退勤', 'たいきん'])) return react(':otukaresama:');
		if (includes(note.text, ['つら','辛','しんど','帰りたい','かえりたい'])) return react(':petthex:');
	}
}

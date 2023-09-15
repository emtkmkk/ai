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
		if (note.reply != null && note.reply.user?.id !== note.user?.id) return;
		if (note.text == null) return;
		if (note.cw != null) return;
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

		let customEmojis = note.text.match(/:([^\n:]+?):/g)?.filter((x) => (x.includes("mk") || x.includes("pizza_")) && !x.includes("rank") && !x.includes("kill"));
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
		if (note.text?.length > 80) return
		if (includes(note.text, ['ぴざ', 'pizza'])) return react(':itspizzatime:');
		if (includes(note.text, ['かんぴろばくたー', 'campylobacter'])) return react(':campylobacter_mottenaidesu:');
		if (includes(note.text, ['taikin', '退勤', 'たいきん', 'しごおわ'])) return react(':otukaresama:');
		if (includes(note.text, ['おはよ', 'ohayo', 'pokita', 'おきた', '起きた', 'おっは', 'ぽきた']) && note.text?.length <= 30 && !includes(note.text, ['が起きた', 'がおきた'])) return react(':mk_oha:');
		if (includes(note.text, ['おやす', 'oyasu', 'poyasimi', '寝る', '日次再起動', 'ぽやしみ']) && note.text?.length <= 30 && !includes(note.text, ['ちゃんねる'])) return react(':oyasumi2:');
		if (includes(note.text, ['嘘']) && note.text?.length <= 30) return react(':sonnano_uso:');
		if (includes(note.text, ['めつ', '滅', 'metu']) && !includes(note.text, ['滅茶', '滅多'])) return react(':metu:');
		if (includes(note.text, ['つら', '辛', 'しんど', '帰りたい', 'かえりたい', 'sad'])) return react(':petthex:');
		if (includes(note.text, ['むいみ', '無意味', 'muimi']) && includes(note.text, ['もの', 'mono', '物'])) return react(':osiina:');
		if (includes(note.text, ['もこもこ'])) return react(':mokomoko:');
		if (includes(note.text, ['もこ', 'niwatori_kun']) && !includes(note.text, ['もこみち', 'おもころ', 'もこう'])) return react(':mk_chicken_t:');
	}
}

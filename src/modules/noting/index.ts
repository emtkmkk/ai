import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genItem } from '@/vocabulary';
import config from '@/config';

export default class extends Module {
	public readonly name = 'noting';

	@autobind
	public install() {
		if (config.notingEnabled === false) return {};

		setInterval(() => {
			const hours = new Date().getHours()
			const rnd = hours > 17 && hours < 24 ? 0.09 : 0.03;
			if (Math.random() < rnd) {
				this.post();
			}
		}, 1000 * 60 * 5);

		return {};
	}

	@autobind
	private post() {
		const notes = [
			...serifs.noting.notes,
			() => {
				const item = genItem();
				return serifs.noting.want(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.see(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.expire(item);
			},
		];

		const note = notes[Math.floor(Math.random() * notes.length)];

		// TODO: 季節に応じたセリフ

		this.ai.post({
			text: typeof note === 'function' ? note() : note
		});
	}
}

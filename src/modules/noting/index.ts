import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genItem } from '@/vocabulary';
import * as loki from 'lokijs';
import config from '@/config';

export default class extends Module {
	public readonly name = 'noting';

	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	@autobind
	public install() {
		if (config.notingEnabled === false) return {};

		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});

		setInterval(() => {
			const hours = new Date().getHours();
			const rnd = ((hours === 12 || (hours > 17 && hours < 24)) ? 0.10 : 0.02) * this.ai.activeFactor;
			if (Math.random() < rnd) {
				this.post();
			}
		}, 1000 * 60 * 5);

		return {};
	}

	@autobind
	private post() {
		let localOnly = false;
		const notes = [
			...serifs.noting.notes,
		];
		const itemNotes = [
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
		const themeNotes = [
			() => {
				const words = this.learnedKeywords.find().filter((x) => x.keyword.length >= 3);
				const word = words ? words[Math.floor(Math.random() * words.length)].keyword : undefined;
				return serifs.noting.talkTheme(word);
			},
		];

		let note;
		let channel;

		if (Math.random() < 0.333) {
			if (config.randomPostLocalOnly) localOnly = true;
			if (config.randomPostChannel) channel = config.randomPostChannel;
			this.ai.decActiveFactor(0.005);
			note = notes[Math.floor(Math.random() * notes.length)];
		} else {
			if (Math.random() < 0.5) {
				this.ai.decActiveFactor(0.01);
				note = itemNotes[Math.floor(Math.random() * itemNotes.length)];
			} else {
				this.ai.decActiveFactor(0.02);
				note = themeNotes[0];
			}
		}

		// TODO: 季節に応じたセリフ

		this.ai.post({
			text: typeof note === 'function' ? note() : note,
			localOnly,
			...(channel ? { channelId: channel } : {}),
		});
	}
}

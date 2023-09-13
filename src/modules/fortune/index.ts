import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import { acct } from '@/utils/acct';

export const blessing = [
	'スーパーもこ吉',
	'もこもこ吉',
	'もこ吉',
	'ヨタ吉 (\(10^{24}\))',
	'ゼタ吉 (\(10^{21}\))',
	'エクサ吉 (\(10^{18}\))',
	'ペタ吉 (\(10^{15}\))',
	'テラ吉 (\(10^{12}\))',
	'ギガ吉 (\(10^9\))',
	'メガ吉 (\(10^6\))',
	'キロ吉 (\(10^3\))',
	'ヘクト吉 (\(10^2\))',
	'デカ吉 (\(10^1\))',
	'デシ吉 (\(10^{-1}\))',
	'センチ吉 (\(10^{-2}\))',
	'ミリ吉 (\(10^{-3}\))',
	'マイクロ吉 (\(10^{-6}\))',
	'ナノ吉 (\(10^{-9}\))',
	'ピコ吉 (\(10^{-12}\))',
	'フェムト吉 (\(10^{-15}\))',
	'アト吉 (\(10^{-18}\))',
	'ゼプト吉 (\(10^{-21}\))',
	'ヨクト吉 (\(10^{-24}\))',
	'超吉',
	'大大吉',
	'大吉',
	'吉',
	'中吉',
	'小吉',
	'凶',
	'大凶',
];

export default class extends Module {
	public readonly name = 'fortune';

	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	@autobind
	public install() {
		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.includes(['占', 'うらな', '運勢', 'おみくじ'])) {
			const date = new Date();
			const seed = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}@${msg.userId}`;
			const rng = seedrandom(seed);
			const rngword = seedrandom(seed + ":word");
			const omikuji = blessing[Math.floor(rng() * blessing.length)];
			const item = genItem(rng);
			const words = this.learnedKeywords.find();
			const word = words ? words[Math.floor(rngword() * words.length)].keyword : undefined;
			msg.reply(`**${omikuji}${omikuji.endsWith("凶") ? ':catsad:' : '🎉'}**\nラッキーアイテム: ${item}${word ? `\nラッキーワード: ${word}` : ''}`, {
				cw: acct(msg.friend.doc.user) + ' ' + serifs.fortune.cw(msg.friend.name),
				visibility: 'public'
			});
			return {
				reaction:'love'
			};
		} else {
			return false;
		}
	}
}

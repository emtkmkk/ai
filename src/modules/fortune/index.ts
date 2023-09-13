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
	'ヨタ吉',
	'ゼタ吉',
	'エクサ吉',
	'ペタ吉',
	'テラ吉',
	'ギガ吉',
	'メガ吉',
	'キロ吉',
	'ヘクト吉',
	'デカ吉',
	'デシ吉',
	'センチ吉',
	'ミリ吉',
	'マイクロ吉',
	'ナノ吉',
	'ピコ吉',
	'フェムト吉',
	'アト吉',
	'ゼプト吉',
	'ヨクト吉',
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
			msg.reply(`**${omikuji}🎉**\nラッキーアイテム: ${item}${word ? `\nラッキーワード: ${word}` : ''}`, {
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

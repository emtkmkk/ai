import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import { acct } from '@/utils/acct';

export const blessing = [
	'$[tada スーパーもこもこ吉🎉]',
	'$[tada スーパーもこ吉🎉]',
	'**もこもこ吉🎉**',
	'**もこ吉🎉**',
	'**不可説不可説転吉🎉** (\\(10^{37218383881977644441306597687849648128}\\))',
	'**googol吉🎉** (\\(10^{100}\\))',
	'**無量大数吉🎉** (\\(10^{68}\\))',
	'**不可思議吉🎉** (\\(10^{64}\\))',
	'**那由他吉🎉** (\\(10^{60}\\))',
	'**阿僧祇吉🎉** (\\(10^{56}\\))',
	'**恒河沙吉🎉** (\\(10^{52}\\))',
	'**極吉🎉** (\\(10^{48}\\))',
	'**載吉🎉** (\\(10^{44}\\))',
	'**正吉🎉** (\\(10^{40}\\))',
	'**澗吉🎉** (\\(10^{36}\\))',
	'**溝吉🎉** (\\(10^{32}\\))',
	'**クエタ吉🎉** (\\(10^{30}\\))',
	'**穣吉🎉** (\\(10^{28}\\))',
	'**ロナ吉🎉** (\\(10^{27}\\))',
	'**𥝱吉🎉** (\\(10^{24}\\))',
	'**ヨタ吉🎉** (\\(10^{24}\\))',
	'**ゼタ吉🎉** (\\(10^{21}\\))',
	'**垓吉🎉** (\\(10^{20}\\))',
	'**エクサ吉🎉** (\\(10^{18}\\))',
	'**京吉🎉** (\\(10^{16}\\))',
	'**ペタ吉🎉** (\\(10^{15}\\))',
	'**兆吉🎉** (\\(10^{12}\\))',
	'**テラ吉🎉** (\\(10^{12}\\))',
	'**ギガ吉🎉** (\\(10^9\\))',
	'**億吉🎉** (\\(10^8\\))',
	'**メガ吉🎉** (\\(10^6\\))',
	'**万吉🎉** (\\(10^4\\))',
	'**キロ吉🎉** (\\(10^3\\))',
	'**ヘクト吉🎉** (\\(10^2\\))',
	'**デカ吉🎉** (\\(10^1\\))',
	'**吉🎉** (\\(10^0\\))',
	'**デシ吉🎉** (\\(10^{-1}\\))',
	'**分吉🎉** (\\(10^{-1}\\))',
	'**センチ吉🎉** (\\(10^{-2}\\))',
	'**厘吉🎉** (\\(10^{-2}\\))',
	'**ミリ吉🎉** (\\(10^{-3}\\))',
	'**マイクロ吉🎉** (\\(10^{-6}\\))',
	'**ナノ吉🎉** (\\(10^{-9}\\))',
	'**ピコ吉🎉** (\\(10^{-12}\\))',
	'**模糊吉🎉** (\\(10^{-13}\\))',
	'**フェムト吉🎉** (\\(10^{-15}\\))',
	'**刹那吉🎉** (\\(10^{-18}\\))',
	'**アト吉🎉** (\\(10^{-18}\\))',
	'**虚空吉** (\\(10^{-20}\\))',
	'**空虚吉** (\\(10^{-20}\\))',
	'**ゼプト吉🎉** (\\(10^{-21}\\))',
	'**ヨクト吉🎉** (\\(10^{-24}\\))',
	'**ロント吉🎉** (\\(10^{-27}\\))',
	'**クエクト吉🎉** (\\(10^{-30}\\))',
	'**超吉🎉**',
	'**大大吉🎉**',
	'**大吉🎉**',
	'**まあまあ吉🎉**',
	'**中吉🎉**',
	'**小吉🎉**',
	'**ふつう**',
	'**凶**:catsad:',
	'**大凶**:catsad:',
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
			msg.reply(`${serifs.fortune.cw(msg.friend.name)}\n${omikuji}\nラッキーアイテム: ${item}${word ? `\nラッキーワード: ${word}` : ''}`, {
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

import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import config from '@/config';
import serifs from '@/serifs';
import { mecab } from './mecab';
import { checkNgWord } from '@/utils/check-ng-word';

function kanaToHira(str: string) {
	return str.replace(/[\u30a1-\u30f6]/g, match => {
		const chr = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(chr);
	});
}

export default class extends Module {
	public readonly name = 'keyword';

	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	@autobind
	public install() {
		if (!config.keywordEnabled) return {};

		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});
		
		const hours = new Date().getHours()

		setInterval(this.learn, 1000 * 60 * 20);

		return {
			mentionHook: this.mentionHook,
		};
	}

		@autobind
	private async mentionHook(msg: Message) {
		if (!msg.or(['/check']) || msg.user.username !== config.master) {
				return false;
		} else {
			this.log('checkLearnedKeywords...');

			const keywords = this.learnedKeywords.find();

			keywords.foreach(async (x) => {
					const tokens = await mecab(x.keyword, config.mecab, config.mecabDic);
				  if (tokens?.length === 1){
						const token = tokens[0];
					if (
						token[2] !== '固有名詞' ||
						token[3] === '人名' ||
						token[8] === null ||
						kanaToHira(token[0]) === kanaToHira(token[8]) ||
						!checkNgWord(token[0]) ||
						!checkNgWord(token[8])
					) {
						this.log(`delete ${token[0]}(${token[8]})...`);
						learnedKeywords.remove(x);
					}
					}
			});

			this.log('finish!');

			return { reaction: 'love' };
		}
	}

	@autobind
	private async learn() {
		const tl = await this.ai.api('notes/hybrid-timeline', {
			limit: 50
		});

		const interestedNotes = tl.filter(note =>
			!note.user.isBot &&
			!note.localOnly &&
			note.visibility === 'public' &&
			note.userId !== this.ai.account.id &&
			note.text != null &&
			note.text.length <= 500 &&
			note.cw == null);

		let keywords: string[][] = [];

		for (const note of interestedNotes) {
			const tokens = await mecab(note.text, config.mecab, config.mecabDic);
			const keywordsInThisNote = tokens.filter(token => token[2] == '固有名詞' && token[3] !== '人名' && token[8] != null && kanaToHira(token[0]) !== kanaToHira(token[8]));
			keywords = keywords.concat(keywordsInThisNote);
		}

		if (keywords.length === 0) return;

		const rnd = Math.floor((1 - Math.sqrt(Math.random())) * keywords.length);
		const keyword = keywords.sort((a, b) => a[0].length < b[0].length ? 1 : -1)[rnd];

		const exist = this.learnedKeywords.findOne({
			keyword: keyword[0]
		});

		let text: string;

		if (exist) {
			return;
		} else {
			// NGワードに引っかかる場合、覚えない
			if (!checkNgWord(keyword[0]) || !checkNgWord(keyword[8])) return;
			this.learnedKeywords.insertOne({
				keyword: keyword[0],
				learnedAt: Date.now()
			});

			text = serifs.keyword.learned(keyword[0], kanaToHira(keyword[8]));
		}

		this.ai.post({
			text: text
		});
	}
}

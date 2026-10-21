import * as seedrandom from 'seedrandom';
import { hankakuToZenkaku, zenkakuToHankaku, katakanaToHiragana, hiraganaToKatagana } from '@/utils/japanese';
import includes from '@/utils/includes';
import or from '@/utils/or';

// 最適化前の実装をそのまま写したもの。現行実装と出力が一致することを確認する基準
const kanaMap: string[][] = [
	['ガ', 'ｶﾞ'], ['ギ', 'ｷﾞ'], ['グ', 'ｸﾞ'], ['ゲ', 'ｹﾞ'], ['ゴ', 'ｺﾞ'],
	['ザ', 'ｻﾞ'], ['ジ', 'ｼﾞ'], ['ズ', 'ｽﾞ'], ['ゼ', 'ｾﾞ'], ['ゾ', 'ｿﾞ'],
	['ダ', 'ﾀﾞ'], ['ヂ', 'ﾁﾞ'], ['ヅ', 'ﾂﾞ'], ['デ', 'ﾃﾞ'], ['ド', 'ﾄﾞ'],
	['バ', 'ﾊﾞ'], ['ビ', 'ﾋﾞ'], ['ブ', 'ﾌﾞ'], ['ベ', 'ﾍﾞ'], ['ボ', 'ﾎﾞ'],
	['パ', 'ﾊﾟ'], ['ピ', 'ﾋﾟ'], ['プ', 'ﾌﾟ'], ['ペ', 'ﾍﾟ'], ['ポ', 'ﾎﾟ'],
	['ヴ', 'ｳﾞ'], ['ヷ', 'ﾜﾞ'], ['ヺ', 'ｦﾞ'],
	['ア', 'ｱ'], ['イ', 'ｲ'], ['ウ', 'ｳ'], ['エ', 'ｴ'], ['オ', 'ｵ'],
	['カ', 'ｶ'], ['キ', 'ｷ'], ['ク', 'ｸ'], ['ケ', 'ｹ'], ['コ', 'ｺ'],
	['サ', 'ｻ'], ['シ', 'ｼ'], ['ス', 'ｽ'], ['セ', 'ｾ'], ['ソ', 'ｿ'],
	['タ', 'ﾀ'], ['チ', 'ﾁ'], ['ツ', 'ﾂ'], ['テ', 'ﾃ'], ['ト', 'ﾄ'],
	['ナ', 'ﾅ'], ['ニ', 'ﾆ'], ['ヌ', 'ﾇ'], ['ネ', 'ﾈ'], ['ノ', 'ﾉ'],
	['ハ', 'ﾊ'], ['ヒ', 'ﾋ'], ['フ', 'ﾌ'], ['ヘ', 'ﾍ'], ['ホ', 'ﾎ'],
	['マ', 'ﾏ'], ['ミ', 'ﾐ'], ['ム', 'ﾑ'], ['メ', 'ﾒ'], ['モ', 'ﾓ'],
	['ヤ', 'ﾔ'], ['ユ', 'ﾕ'], ['ヨ', 'ﾖ'],
	['ラ', 'ﾗ'], ['リ', 'ﾘ'], ['ル', 'ﾙ'], ['レ', 'ﾚ'], ['ロ', 'ﾛ'],
	['ワ', 'ﾜ'], ['ヲ', 'ｦ'], ['ン', 'ﾝ'],
	['ァ', 'ｧ'], ['ィ', 'ｨ'], ['ゥ', 'ｩ'], ['ェ', 'ｪ'], ['ォ', 'ｫ'],
	['ッ', 'ｯ'], ['ャ', 'ｬ'], ['ュ', 'ｭ'], ['ョ', 'ｮ'],
	['ー', 'ｰ']
];

function referenceZenkakuToHankaku(str: string): string {
	const reg = new RegExp('(' + kanaMap.map(x => x[0]).join('|') + ')', 'g');
	return str
		.replace(reg, match => kanaMap.find(x => x[0] == match)![1])
		.replace(/゛/g, 'ﾞ')
		.replace(/゜/g, 'ﾟ');
}

function referenceHankakuToZenkaku(str: string): string {
	const reg = new RegExp('(' + kanaMap.map(x => x[1]).join('|') + ')', 'g');
	return str
		.replace(reg, match => kanaMap.find(x => x[1] == match)![0])
		.replace(/ﾞ/g, '゛')
		.replace(/ﾟ/g, '゜');
}

// 変換表の文字と、表に無い紛らわしい文字（単独の濁点、ひらがな、記号、英数字、絵文字）を混ぜる
const alphabet = [
	...kanaMap.flat(),
	'ﾞ', 'ﾟ', '゛', '゜', 'ｶ', 'ﾊ',
	'あ', 'が', 'ぱ', 'ゔ', 'ゎ', 'ヵ', 'ヶ', 'ヮ', 'ヰ', 'ヱ',
	'a', 'Z', '1', '！', '!', ' ', '\n', '。', '、', '藍', '🍌', '$&', '|', '(',
];

function randomStrings(seed: string, count: number): string[] {
	const rng = seedrandom(seed);
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		const len = Math.floor(rng() * 24);
		let s = '';
		for (let j = 0; j < len; j++) s += alphabet[Math.floor(rng() * alphabet.length)];
		out.push(s);
	}
	return out;
}

describe('hankakuToZenkaku / zenkakuToHankaku', () => {
	test.each(kanaMap)('%s ⇔ %s を相互に変換する', (zen, han) => {
		expect(hankakuToZenkaku(han)).toBe(zen);
		expect(zenkakuToHankaku(zen)).toBe(han);
	});

	test('濁点・半濁点が単独で現れたときも変換する', () => {
		expect(hankakuToZenkaku('ﾞﾟ')).toBe('゛゜');
		expect(zenkakuToHankaku('゛゜')).toBe('ﾞﾟ');
	});

	test('濁点付きの組み合わせを1文字より優先する', () => {
		expect(hankakuToZenkaku('ｶﾞｷﾞﾊﾟﾊﾞｶ')).toBe('ガギパバカ');
		expect(hankakuToZenkaku('ｱﾞ')).toBe('ア゛');
	});

	test('変換対象外の文字はそのまま残す', () => {
		expect(hankakuToZenkaku('あいう abc 123 藍 🍌')).toBe('あいう abc 123 藍 🍌');
		expect(zenkakuToHankaku('あいう abc 123 藍 🍌')).toBe('あいう abc 123 藍 🍌');
	});

	test('空文字を受け付ける', () => {
		expect(hankakuToZenkaku('')).toBe('');
		expect(zenkakuToHankaku('')).toBe('');
	});

	test('ランダムな文字列で最適化前の実装と出力が一致する', () => {
		for (const s of randomStrings('japanese', 3000)) {
			expect(hankakuToZenkaku(s)).toBe(referenceHankakuToZenkaku(s));
			expect(zenkakuToHankaku(s)).toBe(referenceZenkakuToHankaku(s));
		}
	});

	test('連続で呼んでも結果が変わらない（正規表現の lastIndex を持ち越さない）', () => {
		const inputs = ['ｶﾞｶﾞｶﾞ', 'ｱｲｳｴｵ', 'ﾊﾟﾋﾟﾌﾟ'];
		const first = inputs.map(hankakuToZenkaku);
		const second = inputs.map(hankakuToZenkaku);
		expect(second).toEqual(first);
	});
});

describe('katakanaToHiragana / hiraganaToKatagana', () => {
	test('カタカナとひらがなを相互に変換する', () => {
		expect(katakanaToHiragana('アイウエオヴヵヶ')).toBe('あいうえおゔゕゖ');
		expect(hiraganaToKatagana('あいうえおゔゕゖ')).toBe('アイウエオヴヵヶ');
	});

	test('長音や記号はそのまま残す', () => {
		expect(katakanaToHiragana('セーラー！')).toBe('せーらー！');
	});
});

describe('includes / or（正規化を経由する判定）', () => {
	test('半角カナ・カタカナ・大文字を正規化して部分一致を判定する', () => {
		expect(includes('ｵﾊﾖｳ ございます', ['おはよう'])).toBe(true);
		expect(includes('BANANA', ['banana'])).toBe(true);
		expect(includes('こんにちは', ['こんばんは'])).toBe(false);
		expect(includes(null as any, ['x'])).toBe(false);
	});

	test('半角カナを正規化し、末尾の装飾を除いて完全一致を判定する', () => {
		expect(or('ｵﾊﾖｰ！！', ['おはよ'])).toBe(true);
		expect(or('セーラー', ['セーラー'])).toBe(true);
		expect(or('おはようございます', ['おはよう'])).toBe(false);
		expect(or('ﾊﾞﾅﾅ', [/^ばなな$/])).toBe(true);
	});
});

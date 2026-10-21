import * as seedrandom from 'seedrandom';
import { makeBananasu, BananasuKeyword } from '@/utils/bananasu';

// 半角カナ・大文字小文字・記号・数字・英字終わりなど、正規化と分類の分岐を通る語を混ぜる
const keywordList = [
	'バナナ', 'なすび', 'ナスカの地上絵', 'すいか', 'カラス', 'スイカ割り', 'りんご', 'ゴリラ', 'ラッパ', 'パンダ',
	'だんご', 'ごはん', 'ﾊﾞﾅﾅｽ', 'ﾅﾅｲﾛ', 'いろはす', 'すずめ', 'めだか', 'かもめ', 'メロンパン', 'パンケーキ',
	'キーボード', 'ドーナツ', 'つみき', 'きつね', 'ネコ', 'ことり', 'りす', 'スズラン', 'らっこ', 'コアラ',
	'Misskey', 'misskeyio', 'KEYBOARD', 'Docker', 'Rust', 'TypeScript', 'tsconfig', 'GitHub', 'Hub空港', 'ub',
	'「かぎかっこ」', '！びっくり！', '？はてな', '#ハッシュタグ', '@メンション', '(かっこ)', '藍ちゃん', 'ちゃんこ鍋', '鍋焼き', '焼きそば',
	'そば湯', '湯豆腐', '豆腐屋', '屋台', '台風', '風車', '車輪', '輪ゴム', 'ゴムまり', 'まりも',
	'1000円', '令和7年', '3DS', 'あいう123', '12345', 'ab', 'あい', 'ーー', 'ラーメン', 'メンマ',
	'まんじゅう', 'うさぎ', 'ぎんなん', 'なんきん', 'キンカン', 'カンガルー', 'ルーレット', 'トマト', 'トナカイ', 'いか',
	'ヴァイオリン', 'リンゴ飴', '飴玉', 'たまご', 'ごま', 'まめ', 'めがね', 'ねずみ', 'みかん', 'カンパン',
	'ｶﾞｷﾞｸﾞ', 'グミ', 'ミミズク', 'くじら', 'ラクダ', 'だるま', 'まくら', 'ラスク', 'くるみ', 'ミルク',
];

const keywordDocs = (): BananasuKeyword[] => keywordList.map(keyword => ({ keyword }));

// core モジュールと同じ手順で候補リストを作る
function buildArgs(docs: BananasuKeyword[]) {
	const words = docs.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
	const exWords = words.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
	const words2 = exWords.filter((x) => x.keyword.length >= 4);
	const jpWords = exWords.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
	const hirakanaWords = jpWords.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));
	return { words, exWords, words2, jpWords, hirakanaWords };
}

/** Math.random をシード付き乱数に差し替えて呼び出し、結果と乱数の消費回数を返す */
function runSeeded<T>(seed: string, fn: () => T): { result: T; randomCalls: number } {
	const rng = seedrandom(seed);
	let randomCalls = 0;
	const spy = jest.spyOn(Math, 'random').mockImplementation(() => {
		randomCalls++;
		return rng();
	});
	try {
		return { result: fn(), randomCalls };
	} finally {
		spy.mockRestore();
	}
}

const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

describe('makeBananasu', () => {
	test('起点の語なし（キーワードを関数から取得）', () => {
		const results = seeds.map(seed => runSeeded(seed, () => makeBananasu(keywordDocs, '')));
		expect(results).toMatchSnapshot();
	});

	test.each([
		'バナナ', 'ﾊﾞﾅﾅ', 'Misskey', 'すいか', 'カンガルー', 'ラーメン', '藍', 'ヴ', 'zzz', 'ん',
	])('起点の語あり: %s', (inputWord) => {
		const results = seeds.map(seed => runSeeded(seed, () => makeBananasu(keywordDocs, inputWord)));
		expect(results).toMatchSnapshot();
	});

	test.each([
		[true, false],
		[false, true],
	])('前後どちらかが見つからない扱い（word1error=%s, word2error=%s）', (word1error, word2error) => {
		const results = seeds.map(seed => runSeeded(seed, () => makeBananasu(keywordDocs, 'りんご', undefined, undefined, undefined, undefined, undefined, word1error, word2error)));
		expect(results).toMatchSnapshot();
	});

	test('core モジュールと同じく候補リストを渡し、同じリストで続けて呼ぶ', () => {
		const args = buildArgs(keywordDocs());
		const results = seeds.map(seed => runSeeded(seed, () =>
			Array.from({ length: 10 }, () => makeBananasu(keywordDocs, 'パンダ', args.words, args.exWords, args.words2, args.jpWords, args.hirakanaWords))
		));
		expect(results).toMatchSnapshot();
	});

	test('候補リストを渡したときはキーワード取得関数を呼ばない', () => {
		const args = buildArgs(keywordDocs());
		const load = jest.fn(keywordDocs);
		runSeeded('x', () => makeBananasu(load, '', args.words, args.exWords, args.words2, args.jpWords, args.hirakanaWords));
		expect(load).not.toHaveBeenCalled();
	});

	test('候補が足りないときは乱数を使わずに空文字を返す', () => {
		expect(runSeeded('x', () => makeBananasu(() => [], ''))).toEqual({ result: '', randomCalls: 0 });
		expect(runSeeded('x', () => makeBananasu(() => [{ keyword: 'abc' }], 'abc'))).toEqual({ result: '', randomCalls: 0 });
	});

	test('呼び出しで渡したキーワードのドキュメントを書き換えない', () => {
		const docs = keywordDocs();
		const before = JSON.stringify(docs);
		seeds.forEach(seed => runSeeded(seed, () => makeBananasu(() => docs, 'バナナ')));
		expect(JSON.stringify(docs)).toBe(before);
	});
});

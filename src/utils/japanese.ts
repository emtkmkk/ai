/**
 * @packageDocumentation
 *
 * 日本語テキスト変換ユーティリティ。
 *
 * @remarks
 * カタカナ⇔ひらがな、半角カタカナ⇔全角カタカナの変換を行う。
 * テキストマッチ判定（{@link ./includes | includes}、{@link ./or | or}）の
 * 正規化処理で使用される。
 *
 * @internal
 */

/**
 * 半角カタカナ→全角カタカナの変換マッピング
 *
 * @remarks
 * 濁音・半濁音の結合文字列（例: `ｶﾞ` → `ガ`）も含む。
 * {@link hankakuToZenkaku} と {@link zenkakuToHankaku} の両方で使用される。
 *
 * @internal
 */
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

/**
 * カタカナをひらがなに変換する
 *
 * @remarks
 * Unicode のカタカナ範囲（U+30A1〜U+30F6）を 0x60 引いてひらがなに変換する。
 *
 * @param str - 変換対象の文字列
 * @returns ひらがなに変換された文字列
 * @public
 */
export function katakanaToHiragana(str: string): string {
	return str.replace(/[\u30a1-\u30f6]/g, match => {
		const char = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(char);
	});
}

/**
 * ひらがなをカタカナに変換する
 *
 * @remarks
 * Unicode のひらがな範囲（U+3041〜U+3096）を 0x60 足してカタカナに変換する。
 *
 * @param str - 変換対象の文字列
 * @returns カタカナに変換された文字列
 * @public
 */
export function hiraganaToKatagana(str: string): string {
	return str.replace(/[\u3041-\u3096]/g, match => {
		const char = match.charCodeAt(0) + 0x60;
		return String.fromCharCode(char);
	});
}

/**
 * 全角カタカナを半角カタカナに変換する
 *
 * @remarks
 * {@link kanaMap} の変換テーブルを使用する。
 * 濁点（゛）・半濁点（゜）も半角形に変換する。
 *
 * @param str - 変換対象の文字列
 * @returns 半角カタカナに変換された文字列
 * @public
 */
export function zenkakuToHankaku(str: string): string {
	const reg = new RegExp('(' + kanaMap.map(x => x[0]).join('|') + ')', 'g');

	return str
		.replace(reg, match =>
			kanaMap.find(x => x[0] == match)![1]
		)
		.replace(/゛/g, 'ﾞ')
		.replace(/゜/g, 'ﾟ');
};

/**
 * 半角カタカナを全角カタカナに変換する
 *
 * @remarks
 * {@link kanaMap} の変換テーブルを使用する。
 * 半角の濁点（ﾞ）・半濁点（ﾟ）も全角形に変換する。
 *
 * @param str - 変換対象の文字列
 * @returns 全角カタカナに変換された文字列
 * @public
 */
export function hankakuToZenkaku(str: string): string {
	const reg = new RegExp('(' + kanaMap.map(x => x[1]).join('|') + ')', 'g');

	return str
		.replace(reg, match =>
			kanaMap.find(x => x[1] == match)![0]
		)
		.replace(/ﾞ/g, '゛')
		.replace(/ﾟ/g, '゜');
};

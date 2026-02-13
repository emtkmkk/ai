/**
 * @packageDocumentation
 *
 * NGワード判定ユーティリティ。
 *
 * @remarks
 * ユーザー入力に含まれる不適切な文字列を検出し、
 * 名前設定などで使用を拒否するために利用する。
 * カタカナ→ひらがな変換、空白・記号除去を行ったうえでマッチする。
 *
 * NOTE: 「ぱちんこ」が誤検出されるのを防ぐため、
 * 事前に「ぱチんこ」に置換してからチェックしている。
 *
 * @internal
 */

/**
 * NGワードの一覧
 *
 * @remarks
 * 不適切な表現を含む文字列の配列。
 * {@link checkNgWord} で使用される。
 *
 * @internal
 */
export const ngword = ["ちんちん", "ちんぽ", "ちんこ", "うんこ", "うんち", "おしっこ", "ぱいぱい", "きんたま", "おなほ", "おっぱい", "ぱいおつ", "ぱいずり", "乳首", "ちくび", "射精", "しゃせい", "おなに", "精液", "せいえき", "まんこ", "ふたなり", "れいぷ", "せっくす", "せくーす", "ヴぁぎな", "しこっ", "性器", "処女", "受精", "自慰", "勃起", "しっくすないん", "くんに"];

/**
 * テキストがNGワードを含まないかどうかを判定する
 *
 * @remarks
 * 判定前に以下の正規化を行う:
 * 1. 空白の除去
 * 2. ASCII記号の除去
 * 3. カタカナ→ひらがな変換
 * 4. 「ぱちんこ」の誤検出防止置換
 *
 * NB: 戻り値が `true` = 安全（NGワードなし）、`false` = 危険（NGワードあり）
 *
 * @param text - 判定対象のテキスト
 * @returns NGワードを含んでいなければ `true`（安全）
 *
 * @see {@link ngword} — チェックに使用するNGワード一覧
 * @internal
 */
export function checkNgWord(text: string): boolean {
	const checkText = text.replaceAll(/\s/g, "")
		.replaceAll(/[!-\/:-@[-`{-~]+/g, "")
		.replace(/[ァ-ン]/g, function (match) {
			var chr = match.charCodeAt(0) - 0x60;
			return String.fromCharCode(chr);
		})
		.replaceAll("ぱちんこ", "ぱチんこ");
	return !ngword.some((x) => checkText.includes(x));
}

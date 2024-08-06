export const ngword = ["ちんちん", "ちんぽ", "ちんこ", "うんこ", "うんち", "おしっこ", "ぱいぱい", "きんたま", "おなほ", "おっぱい", "ぱいおつ", "ぱいずり", "乳首", "ちくび", "射精", "しゃせい", "おなに", "精液", "せいえき", "まんこ", "ふたなり", "れいぷ", "せっくす", "せくーす", "ヴぁぎな", "しこっ", "性器", "処女", "受精", "自慰", "勃起", "しっくすないん", "くんに"];

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

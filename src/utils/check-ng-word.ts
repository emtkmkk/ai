const ngword = ["ちんちん", "ちんぽ", "ちんこ", "うんこ", "うんち", "おしっこ", "ぱいぱい","おなほ", "おっぱい", "ぱいおつ", "ぱいずり", "乳首", "ちくび", "射精", "しゃせい", "おなに", "精液", "せいえき", "まんこ", "ふたなり", "れいぷ", "せっくす", "せくーす", "ヴぁぎな", "しこっ", "性器", "処女", "受精", "自慰", "勃起"];

export function checkNgWord(text: string): boolean {
	const chackText = text.replaceAll(/\s/g, "")
		.replaceAll(/[!-\/:-@[-`{-~]+/g, "")
		.replace(/[ァ-ン]/g, function (match) {
			var chr = match.charCodeAt(0) - 0x60;
			return String.fromCharCode(chr);
		})
		.replaceAll("ぱちんこ", "ぱチんこ")
	return !ngword.some((x) => {chackText.includes(x);});
}
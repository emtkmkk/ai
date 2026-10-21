/**
 * @packageDocumentation
 *
 * 「バナナス」（しりとり風の造語）の生成。
 *
 * @internal
 */
import { katakanaToHiragana, hankakuToZenkaku } from '@/utils/japanese';

/** 生成に使うキーワード（学習済みキーワードのドキュメント） */
export type BananasuKeyword = { keyword: string };

/** 正規化結果のキャッシュの上限。超えたら作り直す */
const NORMALIZED_CACHE_LIMIT = 50000;

/**
 * キーワードの正規化結果のキャッシュ
 *
 * @remarks
 * 1回の生成で全キーワードを最大200回比較するため、正規化をキーワードごとに1回で済ませる。
 *
 * @internal
 */
const normalizedCache = new Map<string, string>();

/**
 * 比較用に正規化する（半角カナ→全角、カタカナ→ひらがな、小文字化）
 *
 * @internal
 */
function normalize(text: string): string {
	let normalized = normalizedCache.get(text);
	if (normalized === undefined) {
		normalized = katakanaToHiragana(hankakuToZenkaku(text)).toLowerCase();
		if (normalizedCache.size >= NORMALIZED_CACHE_LIMIT) normalizedCache.clear();
		normalizedCache.set(text, normalized);
	}
	return normalized;
}

/**
 * 学習済みキーワードを組み合わせて「バナナス」（しりとり風の造語）を生成する
 *
 * @remarks
 * 2つの単語の末尾と先頭が一致する部分を結合して新しい語を作る。
 * 最大100回試行し、適切な組み合わせが見つかれば結合結果を返す。
 *
 * @param loadKeywords - 候補の配列が渡されなかったときにキーワードを取得する関数
 * @param inputWord - 起点となるキーワード（省略時はランダム選択）
 * @param argWords - キーワード候補の配列（省略時は loadKeywords から取得）
 * @param argExWords - 記号除去済みキーワード候補
 * @param argWords2 - 4文字以上のキーワード候補
 * @param argJpWords - 日本語で終わるキーワード候補
 * @param argHirakanaWords - ひらがな/カタカナで終わるキーワード候補
 * @param word1error - 前方の単語が見つからなかった場合 `true`
 * @param word2error - 後方の単語が見つからなかった場合 `true`
 * @returns 生成されたバナナス文字列。生成できなかった場合は空文字列
 * @internal
 */
export function makeBananasu(loadKeywords: () => BananasuKeyword[], inputWord, argWords?, argExWords?, argWords2?, argJpWords?, argHirakanaWords?, word1error = false, word2error = false): string {

	// 候補となるキーワードを準備する（引数で渡されなければDBから取得）
	// words:    3文字以上で数字が先頭・末尾にないキーワード
	// exWords:  記号を先頭・末尾から除去したもの
	// words2:   4文字以上のキーワード（2文字マッチ用）
	// jpWords:  末尾が英数字でないキーワード
	// hirakanaWords: 末尾がひらがな/カタカナのキーワード
	const words = argWords || loadKeywords()?.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
	const exWords = argExWords || words?.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
	const words2 = argWords2 || exWords?.filter((x) => x.keyword.length >= 4);
	const jpWords = argJpWords || exWords?.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
	const hirakanaWords = argHirakanaWords || jpWords?.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));

	// いずれかの候補リストが空なら生成不可能
	if (!(exWords.length && words2.length && jpWords.length && hirakanaWords.length)) return "";

	// 最大100回試行して適切な組み合わせを探す
	let i = 0;
	while (words && (i < 100 && (!word1error || !word2error))) {
		let word1 = "";
		let word2 = "";
		let word2s;
		let longword2s;
		let pc = 0;
		let matchStringNum = 1;
		if (inputWord) {
			if (word2error || (!word1error && Math.random() < 0.5)) {
				word1 = inputWord;
				const word1Normalized = normalize(word1);
				word2s = words.filter((x) => normalize(x.keyword).startsWith(word1Normalized.slice(-1)));
				longword2s = words2.filter((x) => normalize(x.keyword).startsWith(word1Normalized.slice(-2)));
				pc = word2s.length + longword2s.length;
				if (pc === 0) {
					word1error = true;
					i += 1;
					continue;
				}
				if (word2s.length === 0 || longword2s.length && Math.random() < 0.4) {
					word2 = longword2s[Math.floor(Math.random() * longword2s.length)].keyword;
					matchStringNum = 1;
				} else {
					word2 = word2s[Math.floor(Math.random() * word2s.length)].keyword;
					matchStringNum = 1;
				}
			} else {
				word2 = inputWord;
				const word2Normalized = normalize(word2);
				word2s = words.filter((x) => normalize(x.keyword).endsWith(word2Normalized.slice(0, 1)));
				longword2s = words2.filter((x) => normalize(x.keyword).endsWith(word2Normalized.slice(0, 2)));
				pc = word2s.length + longword2s.length;
				if (pc === 0) {
					word2error = true;
					i += 1;
					continue;
				}
				if (word2s.length === 0 || longword2s.length && Math.random() < 0.4) {
					word1 = longword2s[Math.floor(Math.random() * longword2s.length)].keyword;
					matchStringNum = 1;
				} else {
					word1 = word2s[Math.floor(Math.random() * word2s.length)].keyword;
					matchStringNum = 1;
				}
			}
		} else {

			if (Math.random() < 0.5) {
				word1 = words[Math.floor(Math.random() * words.length)].keyword;
			} else {
				if (Math.random() < 0.5) {
					word1 = jpWords[Math.floor(Math.random() * jpWords.length)].keyword;
				} else {
					word1 = hirakanaWords[Math.floor(Math.random() * hirakanaWords.length)].keyword;
				}
			}

			const word1Normalized = normalize(word1);
			word2s = words.filter((x) => normalize(x.keyword).startsWith(word1Normalized.slice(-1)));
			longword2s = words2.filter((x) => normalize(x.keyword).startsWith(word1Normalized.slice(-2)));
			pc = word2s.length + longword2s.length;

			if (pc === 0 || (pc <= 3 && Math.random() < (0.75 / pc) + (pc === 1 && word2s.length === 1 ? 0.2 : 0))) {
				i += 1;
				continue;
			}

			if (word2s.length === 0 || longword2s.length && Math.random() < 0.4) {
				word2 = longword2s[Math.floor(Math.random() * longword2s.length)].keyword;
				matchStringNum = 1;
			} else {
				word2 = word2s[Math.floor(Math.random() * word2s.length)].keyword;
				matchStringNum = 1;
			}
		}

		// word1 の末尾と word2 の先頭がどこまで一致するか拡張する
		while (matchStringNum < Math.min(word1.length, word2.length) && normalize(word2).startsWith(normalize(word1).slice((matchStringNum + 1) * -1))) {
			matchStringNum += 1;
		}

		// 大文字小文字が完全一致しない場合のフラグ
		const notMatchCase = !word2.startsWith(word1.slice((matchStringNum) * -1));

		const info = `\n[${word1.slice(-1)} : ${word2s.length}${longword2s.length ? ` , ${word1.slice(-2)} : ${longword2s.length}` : ""}]`;

		// 結果: 「word1 の word2、{word1の前半}{word2}」という形式
		return `${word1} の ${word2}、${word1.slice(0, matchStringNum * -1)}${notMatchCase ? word2.slice(0, matchStringNum).toUpperCase() + word2.slice(matchStringNum) : word2}`;
	}
	return "";
}

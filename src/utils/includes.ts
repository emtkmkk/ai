/**
 * @packageDocumentation
 *
 * テキスト包含判定ユーティリティ。
 *
 * @remarks
 * ユーザー入力テキストにキーワードが含まれているかを判定する。
 * カタカナ・ひらがな、半角・全角、大文字・小文字の区別なく比較する。
 * {@link ../ai | 藍.onReceiveMessage} でのキーワード検出に使用される。
 *
 * @see {@link katakanaToHiragana} — カタカナ→ひらがな変換
 * @see {@link hankakuToZenkaku} — 半角→全角変換
 * @internal
 */
import { katakanaToHiragana, hankakuToZenkaku } from './japanese';

/**
 * テキストにいずれかのワードが含まれているかを判定する
 *
 * @remarks
 * 判定前にテキストとワードの両方に対して以下の正規化を行う:
 * 1. 半角カタカナ→全角カタカナ変換
 * 2. カタカナ→ひらがな変換
 * 3. 小文字化
 *
 * テキストが `null` の場合は `false` を返す。
 *
 * @param text - 検索対象のテキスト
 * @param words - 検索するワードの配列
 * @returns いずれかのワードが含まれていれば `true`
 * @internal
 */
export default function (text: string, words: string[]): boolean {
	if (text == null) return false;

	text = katakanaToHiragana(hankakuToZenkaku(text)).toLowerCase();
	words = words.map(word => katakanaToHiragana(word).toLowerCase());

	return words.some(word => text.includes(word));
}

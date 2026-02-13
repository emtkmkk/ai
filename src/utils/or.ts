/**
 * @packageDocumentation
 *
 * テキスト完全マッチ判定ユーティリティ。
 *
 * @remarks
 * ユーザー入力メッセージが指定キーワードと一致するかを判定する。
 * {@link ../ai | 藍.onReceiveMessage} のメンションフック判定で使用される。
 *
 * テキストに対して以下のノイズ除去を行ったうえで完全一致を確認する:
 * - メンション部分の除去（先頭の `@username`）
 * - 末尾の感嘆符・促音・長音符・句読点・記号の除去
 * - 「藍」「ちゃん」「です」などの呼びかけ部分の除去
 *
 * カタカナ・ひらがな、半角・全角の区別なく比較する。
 * 正規表現をワードとして渡すこともできる。
 *
 * @see {@link katakanaToHiragana} — カタカナ→ひらがな変換
 * @see {@link hankakuToZenkaku} — 半角→全角変換
 * @internal
 */
import { hankakuToZenkaku, katakanaToHiragana } from './japanese';

/**
 * テキストがいずれかのワードに完全マッチするかを判定する
 *
 * @remarks
 * ワードが文字列の場合は、テキストの完全一致とノイズ除去後の完全一致の両方を試す。
 * ワードが正規表現の場合は、テキストとノイズ除去後テキストの両方に対して `test` を実行する。
 *
 * テキストが `null` の場合は `false` を返す。
 *
 * @param text - 検索対象のテキスト
 * @param words - 文字列または正規表現の配列
 * @returns いずれかにマッチすれば `true`
 * @internal
 */
export default function (text: string, words: (string | RegExp)[]): boolean {
	if (text == null) return false;

	text = katakanaToHiragana(hankakuToZenkaku(text));
	words = words.map(word => typeof word == 'string' ? katakanaToHiragana(word) : word);

	return words.some(word => {
		/**
		 * テキストの余分な部分を取り除く
		 *
		 * @remarks
		 * 例えば「藍ちゃん好き！」のようなテキストを「好き」に正規化する。
		 * 除去処理は変化がなくなるまで繰り返す。
		 *
		 * NOTE: 末尾の「ー」除去時、ワード自体が「ー」で終わる場合は
		 * 除去後に「ー」を補う（例: 「セーラー」→「セーラ」を防ぐ）。
		 *
		 * @param text - ノイズ除去対象のテキスト
		 * @returns ノイズ除去後のテキスト
		 * @internal
		 */
		function denoise(text: string): string {
			text = text.trim();

			if (text.startsWith('@')) {
				text = text.replace(/^@[a-zA-Z0-1\-_]+/, '');
				text = text.trim();
			}

			function fn() {
				text = text.replace(/[！!]+$/, '');
				text = text.replace(/っ+$/, '');

				// 末尾の ー を除去
				// 例えば「おはよー」を「おはよ」にする
				// ただそのままだと「セーラー」などの本来「ー」が含まれているワードも「ー」が除去され
				// 「セーラ」になり、「セーラー」を期待している場合はマッチしなくなり期待する動作にならなくなるので、
				// 期待するワードの末尾にもともと「ー」が含まれている場合は(対象のテキストの「ー」をすべて除去した後に)「ー」を付けてあげる
				text = text.replace(/ー+$/, '') + ((typeof word == 'string' && word[word.length - 1] == 'ー') ? 'ー' : '');

				text = text.replace(/。$/, '');
				text = text.replace(/です$/, '');
				text = text.replace(/(\.| …)+$/, '');
				text = text.replace(/[♪♥]+$/, '');
				text = text.replace(/^藍/, '');
				text = text.replace(/^ちゃん/, '');
				text = text.replace(/、+$/, '');
			}

			let textBefore = text;
			let textAfter: string | null = null;

			while (textBefore != textAfter) {
				textBefore = text;
				fn();
				textAfter = text;
			}

			return text;
		}

		if (typeof word == 'string') {
			return (text == word) || (denoise(text) == word);
		} else {
			return (word.test(text)) || (word.test(denoise(text)));
		}
	});
}

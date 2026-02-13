/**
 * @packageDocumentation
 *
 * MFM 補間安全性チェックユーティリティ。
 *
 * @remarks
 * Misskey Flavored Markdown（MFM）のテンプレート内に
 * ユーザー入力の文字列を安全に埋め込めるかどうかを判定する。
 * MFM の構文に干渉する特殊文字が含まれていると安全ではない。
 *
 * @see {@link ../message | Message} — メッセージ返信時に使用
 * @internal
 */

/**
 * MFM の構文に干渉する文字の一覧
 *
 * @remarks
 * メンション (`@`)、ハッシュタグ (`#`)、強調 (`*`)、絵文字 (`:`)、
 * リンク (`()[]`)、スペース（半角・全角）が含まれる。
 *
 * @internal
 */
export const invalidChars = [
	'@',
	'#',
	'*',
	':',
	'(',
	')',
	'[',
	']',
	' ',
	'　',
];

/**
 * 文字列が MFM 内で安全に補間可能かどうかを判定する
 *
 * @remarks
 * {@link invalidChars} に含まれる文字が1つでもあれば安全でないと判定する。
 * 主にユーザー名をMFMテンプレートに埋め込む際に使用される。
 *
 * @param text - 判定対象の文字列
 * @returns 安全に補間可能であれば `true`
 *
 * @see {@link invalidChars}
 * @internal
 */
export function safeForInterpolate(text: string): boolean {
	return !invalidChars.some(c => text.includes(c));
}

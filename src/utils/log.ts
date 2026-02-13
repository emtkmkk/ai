/**
 * @packageDocumentation
 *
 * タイムスタンプ付きログ出力ユーティリティ。
 *
 * @remarks
 * コンソールにタイムスタンプ（HH:MM:SS）を付けてメッセージを出力する。
 * chalk ライブラリを使用してタイムスタンプ部分をグレーで表示する。
 *
 * @internal
 */
import * as chalk from 'chalk';

/**
 * タイムスタンプ付きでコンソールにログを出力する
 *
 * @param msg - 出力するメッセージ文字列
 * @returns なし
 * @internal
 */
export default function (msg: string) {
	const now = new Date();
	const date = `${zeroPad(now.getHours())}:${zeroPad(now.getMinutes())}:${zeroPad(now.getSeconds())}`;
	console.log(`${chalk.gray(date)} ${msg}`);
}

/**
 * 数値をゼロ埋めした文字列にする
 *
 * @param num - ゼロ埋めする数値
 * @param length - 出力する桁数
 * @defaultValue length は `2`
 * @returns ゼロ埋めされた文字列
 * @internal
 */
function zeroPad(num: number, length: number = 2): string {
	return ('0000000000' + num).slice(-length);
}

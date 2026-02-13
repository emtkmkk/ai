/**
 * @packageDocumentation
 *
 * 日付文字列取得ユーティリティ。
 *
 * @remarks
 * 現在の日付をフォーマットして返す。
 * 主にランダムシード生成（{@link ../vocabulary | vocabulary}）で日替わりの基準として使用される。
 *
 * @internal
 */

/**
 * 現在の日付を `YYYY/M/D` 形式の文字列で取得する
 *
 * @remarks
 * 月・日はゼロ埋めしない（例: `2024/1/5`）。
 * `diff` に負値を渡すと過去の日付を取得できる。
 *
 * @param diff - 今日からの日数オフセット（正で未来、負で過去）
 * @defaultValue diff は `0`（今日）
 * @returns `YYYY/M/D` 形式の日付文字列
 * @internal
 */
export default function (diff = 0): string {
	const now = new Date();
	now.setDate(now.getDate() + diff);
	const y = now.getFullYear();
	const m = now.getMonth();
	const d = now.getDate();
	const today = `${y}/${m + 1}/${d}`;
	return today;
}

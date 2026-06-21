/**
 * @packageDocumentation
 *
 * 6時間境界（0 / 6 / 12 / 18 時）の算出ユーティリティ。
 *
 * @remarks
 * 起動時メンション遡及の下限時刻を決めるために使用する。
 * タイムゾーンはサーバー現地時刻（`Date` のローカルタイム）に従う。
 *
 * @internal
 */

/**
 * その日の、現在時刻より1つ前の6の倍数時刻（0 / 6 / 12 / 18 時）のミリ秒タイムスタンプを返す
 *
 * @remarks
 * - 14:30 → 当日 12:00
 * - 6:00 ちょうど → 当日 0:00
 * - 0:30 → 当日 0:00
 * - 0:00 ちょうど → 当日 0:00（遡及窓ゼロ）
 * - 前日 18:00 には遡らない（「その日」内に留める）
 *
 * @param now - 基準時刻。省略時は現在時刻
 * @returns 遡及開始時刻（ミリ秒）
 * @public
 */
export function getPreviousSixHourBoundaryMs(now: Date = new Date()): number {
	const d = new Date(now);
	d.setSeconds(0, 0);
	const h = d.getHours();
	const onBoundary = d.getMinutes() === 0 && h % 6 === 0;
	const boundaryHour = onBoundary ? Math.max(0, h - 6) : Math.floor(h / 6) * 6;
	d.setHours(boundaryHour, 0, 0, 0);
	return d.getTime();
}

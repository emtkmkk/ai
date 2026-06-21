import { getPreviousSixHourBoundaryMs } from "@/utils/six-hour-boundary";

/** 指定日時のミリ秒タイムスタンプを生成する（ローカル時刻） */
function localDate(y: number, m: number, d: number, h: number, min = 0): number {
	return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

describe("getPreviousSixHourBoundaryMs", () => {
	it("14:30 の場合、当日 12:00 になる", () => {
		const now = new Date(2026, 5, 21, 14, 30, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 12));
	});

	it("0:30 の場合、当日 0:00 になる", () => {
		const now = new Date(2026, 5, 21, 0, 30, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 0));
	});

	it("6:00 ちょうどの場合、当日 0:00 になる", () => {
		const now = new Date(2026, 5, 21, 6, 0, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 0));
	});

	it("0:00 ちょうどの場合、当日 0:00 になる", () => {
		const now = new Date(2026, 5, 21, 0, 0, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 0));
	});

	it("12:00 ちょうどの場合、当日 6:00 になる", () => {
		const now = new Date(2026, 5, 21, 12, 0, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 6));
	});

	it("18:00 ちょうどの場合、当日 12:00 になる", () => {
		const now = new Date(2026, 5, 21, 18, 0, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 12));
	});

	it("23:59 の場合、当日 18:00 になる", () => {
		const now = new Date(2026, 5, 21, 23, 59, 0, 0);
		expect(getPreviousSixHourBoundaryMs(now)).toBe(localDate(2026, 6, 21, 18));
	});

	it("前日 18:00 には遡らず、その日 0:00 に留まる", () => {
		const now = new Date(2026, 5, 21, 3, 0, 0, 0);
		const boundary = getPreviousSixHourBoundaryMs(now);
		expect(boundary).toBe(localDate(2026, 6, 21, 0));
		expect(boundary).toBeGreaterThan(localDate(2026, 6, 20, 18));
	});
});

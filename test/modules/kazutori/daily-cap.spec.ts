import { adjustLimitMinutesForMood, dateKey, isMorningLongEligible, naturalStartProbability, rollMorningLongLimitMinutes, simulateNaturalGameCount } from '@/modules/kazutori/daily-cap';

/** 再現性のある疑似乱数 */
function seeded(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
}

describe('simulateNaturalGameCount', () => {
	it('抽選が全て外れれば0回', () => {
		expect(simulateNaturalGameCount(1, () => 0.999)).toBe(0);
	});

	it('抽選が全て当たっても開催中・クールダウン中と1〜7時は開催しない', () => {
		// random=0, 機嫌0.5: 抽選は0時0分から18.5分刻み、制限時間5分+クールダウン50分
		// 0時台: 0:00 と 0:55.5 の2回 / 1〜7時: なし / 8:01 以降: 55.5分ごとに18回
		expect(simulateNaturalGameCount(0.5, () => 0)).toBe(20);
	});

	it('機嫌が低いほど平均回数が少ない', () => {
		const random = seeded(1);
		const mean = (af: number) => {
			let total = 0;
			for (let i = 0; i < 2000; i++) total += simulateNaturalGameCount(af, random);
			return total / 2000;
		};
		const high = mean(1);
		const low = mean(0.5);
		expect(high).toBeGreaterThan(low);
		expect(low).toBeGreaterThan(0);
	});
});

describe('adjustLimitMinutesForMood', () => {
	it('機嫌0.75以上では変わらない', () => {
		expect(adjustLimitMinutesForMood(5, 0.75, () => 0.5)).toBe(5);
	});

	it('機嫌が低いと延びる', () => {
		expect(adjustLimitMinutesForMood(10, 0.3, () => 1)).toBeGreaterThan(10);
	});
});

it('dateKey はローカル日付', () => {
	expect(dateKey(new Date(2026, 8, 29, 0, 5))).toBe('2026-9-29');
});

describe('naturalStartProbability（旧ルール・上限計算用）', () => {
	it('12時・18〜23時は50%、それ以外は10%に機嫌を掛ける', () => {
		expect(naturalStartProbability(9, 1)).toBeCloseTo(0.1);
		expect(naturalStartProbability(12, 1)).toBeCloseTo(0.5);
		expect(naturalStartProbability(20, 0.5)).toBeCloseTo(0.25);
	});
});

describe('isMorningLongEligible', () => {
	const at = (d: number, h: number) => new Date(2026, 8, d, h, 30);
	it('前回が昨日以前なら対象（一昨日以前・履歴なしも含む）', () => {
		expect(isMorningLongEligible(at(29, 9), at(28, 22).getTime())).toBe(true);
		expect(isMorningLongEligible(at(29, 9), at(20, 22).getTime())).toBe(true);
		expect(isMorningLongEligible(at(29, 9), null)).toBe(true);
	});
	it('今日すでに開催があれば対象外（0時台の開催も今日扱い）', () => {
		expect(isMorningLongEligible(at(29, 9), at(29, 0).getTime())).toBe(false);
	});
	it('8:00〜9:59以外は対象外', () => {
		expect(isMorningLongEligible(at(29, 7), at(28, 22).getTime())).toBe(false);
		expect(isMorningLongEligible(at(29, 10), at(28, 22).getTime())).toBe(false);
	});
});

it('午前中長時間は4時間か8時間', () => {
	expect(rollMorningLongLimitMinutes(() => 0.1)).toBe(240);
	expect(rollMorningLongLimitMinutes(() => 0.9)).toBe(480);
});

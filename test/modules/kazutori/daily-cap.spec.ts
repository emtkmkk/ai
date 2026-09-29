import { adjustLimitMinutesForMood, dateKey, simulateNaturalGameCount } from '@/modules/kazutori/daily-cap';

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

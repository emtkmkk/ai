import { guaranteeProbability, naturalStartProbabilityByUsers, pickGuaranteeTime } from '@/modules/kazutori/natural-start';

const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);

describe('naturalStartProbabilityByUsers', () => {
	it('0.03 × 機嫌 × (人数 - 3) で、0〜1に収める', () => {
		expect(naturalStartProbabilityByUsers(3, 1)).toBe(0);
		expect(naturalStartProbabilityByUsers(1, 1)).toBe(0);
		expect(naturalStartProbabilityByUsers(13, 0.5)).toBeCloseTo(0.15);
		expect(naturalStartProbabilityByUsers(100, 2)).toBe(1);
	});
});

it('保証判定の確率はその日の上限/8（最大1）', () => {
	expect(guaranteeProbability(0)).toBe(0);
	expect(guaranteeProbability(4)).toBe(0.5);
	expect(guaranteeProbability(8)).toBe(1);
	expect(guaranteeProbability(12)).toBe(1);
});

it('保証判定の時刻は 8:00〜9:59', () => {
	expect(pickGuaranteeTime(at(0), () => 0)).toBe(at(8).getTime());
	expect(pickGuaranteeTime(at(0), () => 0.9999)).toBe(at(9, 59).getTime());
});

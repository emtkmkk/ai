import { computeEffectiveProbability, rollWithPity } from '@/modules/kazutori/pity';

describe('computeEffectiveProbability', () => {
	it('streak 0 の場合、基準確率と等しい', () => {
		expect(computeEffectiveProbability(0.03, 0)).toBeCloseTo(0.03);
	});

	it('streak 5 の場合、(1-p)^6 を差し引いた値になる', () => {
		expect(computeEffectiveProbability(0.03, 5)).toBeCloseTo(1 - Math.pow(0.97, 6));
	});

	it('streak 10 の場合、(1-p)^11 を差し引いた値になる', () => {
		expect(computeEffectiveProbability(0.03, 10)).toBeCloseTo(1 - Math.pow(0.97, 11));
	});
});

describe('rollWithPity', () => {
	it('当選した場合、streak がリセットされる', () => {
		const { hit, nextState } = rollWithPity({ huge: 3 }, 'huge', 0.5, () => 0.1);

		expect(hit).toBe(true);
		expect(nextState.huge).toBeUndefined();
	});

	it('外れた場合、streak が 1 増える', () => {
		const { hit, nextState } = rollWithPity({ huge: 3 }, 'huge', 0.03, () => 0.99);

		expect(hit).toBe(false);
		expect(nextState.huge).toBe(4);
	});

	it('初回外れの場合、streak が 1 になる', () => {
		const { hit, nextState } = rollWithPity({}, 'max1', 0.02, () => 0.99);

		expect(hit).toBe(false);
		expect(nextState.max1).toBe(1);
	});

	it('他キーの streak は変更されない', () => {
		const { nextState } = rollWithPity({ infinite: 2, huge: 1 }, 'huge', 0.03, () => 0.99);

		expect(nextState.infinite).toBe(2);
		expect(nextState.huge).toBe(2);
	});
});

/**
 * @packageDocumentation
 *
 * スキル所持数の集計（skillCalculate）のキャッシュのテスト
 */
// shop → skills の循環 import で初期化順が崩れないよう、先に shop を読み込む
import "@/modules/rpg/shop";
import { skillCalculate } from "@/modules/rpg/skills";

describe("skillCalculate のキャッシュ", () => {
	const buildAi = () => {
		const friends = [
			{ perModulesData: { rpg: { lv: 100, skills: [{ name: "炎属性剣攻撃" }] } } },
			{ perModulesData: { rpg: { lv: 100, skills: [{ name: "炎属性剣攻撃" }, { name: "パワーアップ" }] } } },
		];
		const find = jest.fn(() => friends);
		return { ai: { friends: { find } } as any, friends, find };
	};

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 9, 1, 12));
	});
	afterEach(() => jest.useRealTimers());

	test("5分以内の呼び出しは集計し直さず、前回の結果を返す", () => {
		const { ai, find } = buildAi();
		const first = skillCalculate(ai);
		const second = skillCalculate(ai);

		expect(find).toHaveBeenCalledTimes(1);
		expect(second.skillNameCountMap.get("炎属性剣攻撃")).toBe(2);
		expect(second.totalSkillCount).toBe(first.totalSkillCount);
	});

	test("5分経つと集計し直す", () => {
		const { ai, find, friends } = buildAi();
		skillCalculate(ai);
		friends.push({ perModulesData: { rpg: { lv: 100, skills: [{ name: "炎属性剣攻撃" }] } } });
		jest.advanceTimersByTime(5 * 60 * 1000);

		expect(skillCalculate(ai).skillNameCountMap.get("炎属性剣攻撃")).toBe(3);
		expect(find).toHaveBeenCalledTimes(2);
	});

	test("force を指定するとすぐ集計し直す", () => {
		const { ai, find, friends } = buildAi();
		skillCalculate(ai);
		friends.push({ perModulesData: { rpg: { lv: 100, skills: [{ name: "パワーアップ" }] } } });

		expect(skillCalculate(ai, true).skillNameCountMap.get("パワーアップ")).toBe(2);
		expect(find).toHaveBeenCalledTimes(2);
	});

	test("別の藍オブジェクトが渡されたら集計し直す", () => {
		const a = buildAi();
		const b = buildAi();
		skillCalculate(a.ai);
		skillCalculate(b.ai);

		expect(a.find).toHaveBeenCalledTimes(1);
		expect(b.find).toHaveBeenCalledTimes(1);
	});
});

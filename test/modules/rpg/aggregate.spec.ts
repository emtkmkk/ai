/**
 * @packageDocumentation
 *
 * スキル効果の集計（aggregateSkillsEffects）のテスト
 *
 * @remarks
 * 曜日によって属性の効果量が変わるため、属性の強化が無い月曜日（闇のみ強化）に固定して確認する。
 */
// shop → skills の循環 import で初期化順が崩れないよう、先に shop を読み込む
import "@/modules/rpg/shop";
import { aggregateSkillsEffects, skills } from "@/modules/rpg/skills";

const data = (names: string[]) => ({ lv: 100, skills: names.map((name) => ({ ...skills.find((s) => s.name === name) })), items: [] });

describe("aggregateSkillsEffects", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 8, 7, 12)); // 2026/9/7 = 月曜日
		jest.spyOn(console, "log").mockImplementation(() => {});
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("倍率なしでは、スキルの効果をそのまま合算する", () => {
		const e = aggregateSkillsEffects(data(["パワーアップ", "粘り強い"]));
		expect(e.atkUp).toBeCloseTo(1.11 * 1.04 - 1);
		expect(e.tenacious).toBeCloseTo(0.25);
	});

	test("倍率なしでは、水属性が雷属性を強化する", () => {
		const e = aggregateSkillsEffects(data(["雷属性剣攻撃", "水属性剣攻撃"]));
		expect(e.thunder).toBeCloseTo(0.18 * (1 + 0.18 * 1.4));
	});

	test("倍率ありでも、X倍になった水属性がX倍になった雷属性を強化する", () => {
		const e = aggregateSkillsEffects(data(["雷属性剣攻撃", "水属性剣攻撃"]), 3);
		expect(e.water).toBeCloseTo(0.54);
		expect(e.thunder).toBeCloseTo(0.54 * (1 + 0.54 * 1.4));
	});

	test("倍率ありでは、重複しないスキルは効果を倍にせず、パワー・防御を 1 + 0.06×(X-1) 倍にする", () => {
		const e = aggregateSkillsEffects(data(["伝説"]), 3);
		expect(e.atkUp).toBeCloseTo(1.08 * 1.12 - 1);
		expect(e.defUp).toBeCloseTo(1.08 * 1.12 - 1);
	});

	test("倍率の計算で元のスキル定義を書き換えない", () => {
		aggregateSkillsEffects(data(["パワーアップ"]), 3);
		expect(skills.find((s) => s.name === "パワーアップ")!.effect.atkUp).toBe(0.11);
	});
});

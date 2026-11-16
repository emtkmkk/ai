import { applyHyperModeEffects, applySuperColorModeEffects, getSuperColorMode } from "@/modules/rpg/super-mode";
import type { SkillEffect } from "@/modules/rpg/skill-data";

describe("getSuperColorMode", () => {
	test("覚醒変更の札がなければ null", () => {
		expect(getSuperColorMode({})).toBeNull();
	});

	test("複数持っている場合は 朱 → 蒼 → 橙 → 翠 の順で優先する", () => {
		expect(getSuperColorMode({ greenMode: true, yellowMode: true, blueMode: true, redMode: true })).toBe("red");
		expect(getSuperColorMode({ greenMode: true, yellowMode: true, blueMode: true })).toBe("blue");
		expect(getSuperColorMode({ greenMode: true, yellowMode: true })).toBe("yellow");
		expect(getSuperColorMode({ greenMode: true })).toBe("green");
	});
});

describe("applySuperColorModeEffects", () => {
	test("朱: クリティカル率（固定）+8%、クリティカルダメージを下限 35% まで引き上げる", () => {
		const e: SkillEffect = { critUpFixed: 0.1, critDmgUp: 0.2 };
		applySuperColorModeEffects(e, "red");
		expect(e.critUpFixed).toBeCloseTo(0.18);
		expect(e.critDmgUp).toBe(0.35);
	});

	test("朱: クリティカルダメージがすでに下限より高ければそのまま", () => {
		const e: SkillEffect = { critDmgUp: 0.5 };
		applySuperColorModeEffects(e, "red");
		expect(e.critDmgUp).toBe(0.5);
	});

	test("蒼・橙: 被ダメージを 40% / 20% 減らす", () => {
		const blue: SkillEffect = { defDmgUp: -0.1 };
		applySuperColorModeEffects(blue, "blue");
		expect(blue.defDmgUp).toBeCloseTo(-0.5);

		const yellow: SkillEffect = {};
		applySuperColorModeEffects(yellow, "yellow");
		expect(yellow.defDmgUp).toBeCloseTo(-0.2);
	});

	test("翠: アイテムの 4 つの効果を ×1.4 する", () => {
		const e: SkillEffect = { itemEquip: 0.5 };
		applySuperColorModeEffects(e, "green");
		expect(e.itemEquip).toBeCloseTo(1.1);
		expect(e.itemBoost).toBeCloseTo(0.4);
		expect(e.mindMinusAvoid).toBeCloseTo(0.4);
		expect(e.poisonAvoid).toBeCloseTo(0.4);
	});

	test("null なら何も変えない", () => {
		const e: SkillEffect = { critUpFixed: 0.1 };
		applySuperColorModeEffects(e, null);
		expect(e).toEqual({ critUpFixed: 0.1 });
	});
});

describe("applyHyperModeEffects", () => {
	test("超覚醒の札があれば、投稿数による能力上昇量 +0.015", () => {
		const e: SkillEffect = { postXUp: 0.01 };
		applyHyperModeEffects(e, { hyperMode: true });
		expect(e.postXUp).toBeCloseTo(0.025);
	});

	test("超覚醒の札がなければ何も変えない", () => {
		const e: SkillEffect = {};
		applyHyperModeEffects(e, {});
		expect(e.postXUp).toBeUndefined();
	});
});

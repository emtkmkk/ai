import { applyStatModifiers, statModifierDisplayStats, STAT_MODIFIERS } from "@/modules/rpg/stat-modifiers";
import type { StatModifierTarget } from "@/modules/rpg/stat-modifiers";
import { BattleLog } from "@/modules/rpg/battle-log";
import type { SkillEffect } from "@/modules/rpg/skill-data";

/** 戦闘する物理の敵（疲れなし・中断能力なし・最大ダメージ制限なし）を相手にした状況 */
const target = (skillEffects: SkillEffect, over: Partial<StatModifierTarget> = {}): StatModifierTarget => ({
	atk: 1000, def: 1000, isBattle: true, isPhysical: true, isTired: false, enemy: {},
	skillEffects, log: new BattleLog(true), ...over,
});

describe("applyStatModifiers", () => {
	test("条件を満たす効果だけ、指定した時点で掛ける", () => {
		const s = target({ abortDown: 0.3, plusActionX: 1 });
		applyStatModifiers("preBattle", s);
		expect(s.atk).toBeCloseTo(1100); // 遂: ×(1 + 0.3 / 3)。高速RPG は preBattleLate なのでまだ
		applyStatModifiers("preBattleLate", s);
		expect(s.atk).toBeCloseTo(1210); // 高速RPG: ×(1 + 1 / 10)
	});

	test("条件を満たさなければ掛けない（中断能力のある敵では遂の代わりの効果は出ない）", () => {
		const s = target({ abortDown: 0.3 }, { enemy: { abort: 1 } });
		applyStatModifiers("preBattle", s);
		expect(s.atk).toBe(1000);
		expect(s.log.text).toBe("");
	});

	test("効果量が 0 なら掛けず、詳細ログも出さない", () => {
		const s = target({ notBattleBonusAtk: 0 }, { isBattle: false });
		applyStatModifiers("preBattle", s);
		expect(s.atk).toBe(1000);
		expect(s.log.text).toBe("");
	});

	test("詳細ログは「見出し: A/D/AD + 増減 (値)」の形", () => {
		const s = target({ enemyBuff: 1, enemyCritDmgDown: 0.4 });
		applyStatModifiers("preBattleLate", s);
		expect(s.log.text).toBe("守スキル効果: D+10% (1100)\nお守り効果: AD+5% (1050 / 1155)\n");
	});

	test("詳細ログでなければ行を出さない", () => {
		const s = target({ enemyBuff: 1 }, { log: new BattleLog(false) });
		applyStatModifiers("preBattleLate", s);
		expect(s.atk).toBeCloseTo(1050);
		expect(s.log.text).toBe("");
	});
});

describe("statModifierDisplayStats", () => {
	test("常に効く効果はパワー・防御、非戦闘時の効果は非戦闘時パワー・防御の行に出す", () => {
		expect(Object.keys(statModifierDisplayStats("enemyBuff"))).toEqual(["atk", "def"]);
		expect(Object.keys(statModifierDisplayStats("notBattleBonusAtk"))).toEqual(["nbAtk"]);
		expect(Object.keys(statModifierDisplayStats("notBattleBonusDef"))).toEqual(["nbDef"]);
	});

	test("確認表示の倍率は戦闘と同じ式", () => {
		for (const m of STAT_MODIFIERS) {
			const stats = statModifierDisplayStats(m.effect);
			for (const f of Object.values(stats)) expect(f!(0.5)).toBe((m.atk ?? m.def)!(0.5));
		}
	});
});

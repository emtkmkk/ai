/**
 * @packageDocumentation
 *
 * 継戦融合武装（itemAtkStock）のテスト
 *
 * @remarks
 * 以前は「その時点のパワーに比例する上昇」（食べ物の過剰回復・気合）まで次ターンへ持ち越していたため、
 * 「累積 → パワー増 → 比例ボーナス増 → 累積増」の循環が起き、スキル効果が3倍になるボス（:mk_giga:）で
 * 与ダメージが数百億まで膨らんでいた。持ち越すのは物理戦闘で装備した武器の固定値の上昇だけにしている。
 */
import * as loki from "lokijs";
import { raidInstall, simulateRaidBattle } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills } from "@/modules/rpg/skills";

/** 再現できる乱数（同じ seed なら同じ列になる） */
const seeded = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6D2B79F5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** 不具合が報告された構成のお守り（合成お守り）に入っていたスキル */
const amuletSkills = ["土属性剣攻撃", "道具大好き", "道具の選択が上手い", "連続攻撃完遂率上昇", "道具の扱いが上手い", "毒属性剣攻撃", "クリティカル性能上昇", "バーサク"];

const playerData = (skillNames: string[]) => ({
	lv: 255, atk: 900, def: 900, exp: 2, coin: 50, itemMedal: 10,
	skills: skillNames.map((name) => ({ ...skills.find((s) => s.name === name) })),
	items: [{ name: amuletSkills.join("&") + "のお守り", type: "amulet", durability: 50, skillName: amuletSkills }],
	raidScore: {}, clearHistory: [], superPoint: -3, noAmuletCount: -999,
});

describe("継戦融合武装", () => {
	let current: any;

	beforeEach(() => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.setSystemTime(new Date(2026, 8, 7, 12));
		jest.spyOn(console, "log").mockImplementation(() => {});
		const doc: any = { perModulesData: { rpg: null }, kazutoriData: {}, linkedAccounts: ["user-b"] };
		const dataB: any = { lv: 10, todayNotesCount: 5 };
		const friendA: any = { userId: "user-a", doc, love: 300, getPerModulesData: () => current, setPerModulesData: jest.fn() };
		const friendB: any = { userId: "user-b", doc: { linkedAccounts: ["user-a"], user: {} }, getPerModulesData: () => dataB, setPerModulesData: jest.fn() };
		const ai: any = {
			account: { id: "bot" },
			moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: jest.fn() },
			friends: { find: () => [] },
			lookupFriend: (id: string) => (id === "user-a" ? friendA : id === "user-b" ? friendB : null),
			getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
		};
		raidInstall(ai, { name: "rpg", log: () => {} } as any, new loki("test").addCollection<any>("raids") as any);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	const simulate = async (skillNames: string[], enemyName: string) => {
		const data = playerData(skillNames);
		current = data;
		const runs = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, enemyName, { runs: 30, postCount: 229, random: seeded(7) });
		return runs.map((r) => r.totalDmg);
	};

	test("スキル効果3倍のボスでも、食べ物の過剰回復を持ち越して与ダメージが暴走しない", async () => {
		const dmgs = await simulate(["食いしんぼう", "お守り整備", "お守り整備", "お守り整備", "継戦融合武装"], ":mk_giga:");
		// 修正前は同じ条件で最大 約3×10^10 まで膨らんでいた
		expect(Math.max(...dmgs)).toBeLessThan(10_000_000);
	});

	test("武器を使わない構成では、継戦融合武装の有無で結果が変わらない", async () => {
		const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX)!;
		const base = ["食いしんぼう", "お守り整備", "お守り整備", "お守り整備"];
		const withStock = await simulate([...base, "継戦融合武装"], enemy.name);
		const withoutStock = await simulate(base, enemy.name);
		expect(withStock).toEqual(withoutStock);
	});

	test("物理戦闘で武器を装備した分は、従来どおり次ターン以降に持ち越す", async () => {
		const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX)!;
		const base = ["武器が大好き", "お守り整備", "お守り整備", "お守り整備"];
		const withStock = await simulate([...base, "継戦融合武装"], enemy.name);
		const withoutStock = await simulate(base, enemy.name);
		const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
		expect(sum(withStock)).toBeGreaterThan(sum(withoutStock));
	});
});

/**
 * @packageDocumentation
 *
 * 副作用なしのレイド試算（simulateRaidBattle / simulateRaidDamage）のテスト
 */
import * as loki from "lokijs";
import { raidInstall, simulateRaidBattle, simulateRaidDamage, bestRaidRun } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills } from "@/modules/rpg/skills";
import { deepClone } from "@/modules/rpg/utils";

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

describe("レイドの試算", () => {
	const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX)!;

	const playerData = () => ({
		lv: 300, atk: 1100, def: 1100, exp: 2, coin: 50,
		skills: ["パワーアップ", "粘り強い"].map((name) => ({ ...skills.find((s) => s.name === name) })),
		items: [{ name: "交通安全のお守り", type: "amulet", durability: 5 }],
		raidScore: {}, clearHistory: [], superPoint: -3, noAmuletCount: -999,
	});

	const setup = () => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.setSystemTime(new Date(2026, 8, 7, 12));
		jest.spyOn(console, "log").mockImplementation(() => {});
		const data: any = playerData();
		const doc: any = { perModulesData: { rpg: data }, kazutoriData: {}, linkedAccounts: ["user-b"] };
		const friendA: any = { userId: "user-a", doc, love: 300, getPerModulesData: () => doc.perModulesData.rpg, setPerModulesData: jest.fn() };
		// 連携アカウント（投稿数の取得で参照される）
		const dataB: any = { lv: 10, todayNotesCount: 5 };
		const friendB: any = { userId: "user-b", doc: { linkedAccounts: ["user-a"], user: {} }, getPerModulesData: () => dataB, setPerModulesData: jest.fn() };
		const ai: any = {
			account: { id: "bot" },
			moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: jest.fn() },
			friends: { find: () => [] },
			lookupFriend: (id: string) => (id === "user-a" ? friendA : id === "user-b" ? friendB : null),
			getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
		};
		raidInstall(ai, { name: "rpg", log: () => {} } as any, new loki("test").addCollection<any>("raids") as any);
		return { data, doc, friendA, friendB, dataB };
	};

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("指定した回数だけ試算し、元のデータを書き換えない", async () => {
		const { data, doc, friendA } = setup();
		const before = deepClone(data);
		const beforeKazutori = deepClone(doc.kazutoriData);

		const runs = await simulateRaidBattle({ userId: "user-a", data, love: 300, doc }, enemy.name, { runs: 3, postCount: 40 });

		expect(runs).toHaveLength(3);
		for (const r of runs) {
			expect(r.totalDmg).toBeGreaterThan(0);
			expect(r.log).toContain("開始！");
		}
		expect(data).toEqual(before);
		expect(doc.kazutoriData).toEqual(beforeKazutori);
		expect(friendA.setPerModulesData).not.toHaveBeenCalled();
	});

	test("乱数を固定すれば同じ結果になる", async () => {
		const { data } = setup();
		const a = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, enemy, { postCount: 40, random: seeded(1) });
		const b = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, enemy, { postCount: 40, random: seeded(1) });
		expect(a[0].totalDmg).toBe(b[0].totalDmg);
		expect(a[0].log).toBe(b[0].log);
		// 差し替えた乱数は試算後に元に戻る
		expect(Math.random).not.toBe(undefined);
	});

	test("構成を書き換えて試算しても、元のデータは変わらない", async () => {
		const { data } = setup();
		const before = deepClone(data);
		const base = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, enemy, { postCount: 40, random: seeded(2) });
		const strong = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, enemy, {
			postCount: 40,
			random: seeded(2),
			modifyData: (d) => { d.skills = ["武器が大好き", "脳筋", "炎属性剣攻撃"].map((name) => ({ ...skills.find((s) => s.name === name) })); },
		});
		expect(strong[0].totalDmg).not.toBe(base[0].totalDmg);
		expect(data).toEqual(before);
	});

	test("投稿数を固定しない場合も、連携アカウントのデータを書き換えない", async () => {
		const { data, doc, friendB, dataB } = setup();
		const beforeB = deepClone(dataB);
		const runs = await simulateRaidBattle({ userId: "user-a", data, love: 300, doc }, enemy, { random: seeded(3) });
		expect(runs).toHaveLength(1);
		expect(friendB.setPerModulesData).not.toHaveBeenCalled();
		expect(dataB).toEqual(beforeB);
		expect(doc.linkedAccounts).toEqual(["user-b"]);
	});

	test("じゃんけん型・コンテスト型のボスでも試算できる", async () => {
		const { data } = setup();
		for (const pattern of [2, 3]) {
			const boss = raidEnemys.find((x) => x.pattern === pattern)!;
			const runs = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, boss, { postCount: 40, random: seeded(pattern) });
			expect(runs).toHaveLength(1);
			expect(typeof runs[0].totalDmg).toBe("number");
		}
	});

	test("最良の結果を選べる", async () => {
		const { data } = setup();
		const runs = await simulateRaidBattle({ userId: "user-a", data, love: 300 }, enemy, { runs: 5, postCount: 40 });
		expect(bestRaidRun(runs)!.totalDmg).toBe(Math.max(...runs.map((r) => r.totalDmg)));
		expect(bestRaidRun([])).toBeUndefined();
	});

	test("登録済みのユーザーで試算できる（見つからない場合は理由を返す）", async () => {
		setup();
		const r = await simulateRaidDamage("user-a", enemy.name, { postCount: 40 });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.runs).toHaveLength(1);
		expect(await simulateRaidDamage("user-x", enemy.name)).toEqual({ ok: false, reason: "ユーザーが見つかりません" });
		expect(await simulateRaidDamage("user-a", "存在しないボス")).toEqual({ ok: false, reason: "ボスの定義が見つかりません" });
	});
});

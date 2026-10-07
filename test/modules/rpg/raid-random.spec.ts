/**
 * @packageDocumentation
 *
 * レイドの乱数（シードによる戦闘の再現）のテスト
 */
import * as loki from "lokijs";
import { createRaidRandom, raidSeedSecret } from "@/modules/rpg/raid-random";
import { raidInstall, simulateRaidBattle, runParallelDimensionRaid } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills } from "@/modules/rpg/skills";

describe("createRaidRandom", () => {
	const seed = { postId: "post-1", userId: "user-a" };
	const draw = (rng: ReturnType<typeof createRaidRandom>, label: string, n: number) => Array.from({ length: n }, () => rng(label));

	test("同じシード・同じ用途なら同じ値になる", () => {
		const a = createRaidRandom(seed, "secret");
		const b = createRaidRandom(seed, "secret");
		expect(draw(a, "crit", 5)).toEqual(draw(b, "crit", 5));
	});

	test("値は 0 以上 1 未満で、同じ用途でも引くたびに変わる", () => {
		const values = draw(createRaidRandom(seed, "secret"), "crit", 200);
		for (const v of values) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
		expect(new Set(values).size).toBe(200);
	});

	test("投稿ID・ユーザーID・平行次元・秘密の値・用途・キーが違えば別の値になる", () => {
		const base = createRaidRandom(seed, "secret")("crit", 1);
		expect(createRaidRandom({ ...seed, postId: "post-2" }, "secret")("crit", 1)).not.toBe(base);
		expect(createRaidRandom({ ...seed, userId: "user-b" }, "secret")("crit", 1)).not.toBe(base);
		expect(createRaidRandom({ ...seed, dimension: 1 }, "secret")("crit", 1)).not.toBe(base);
		expect(createRaidRandom(seed, "other")("crit", 1)).not.toBe(base);
		expect(createRaidRandom(seed, "secret")("ice", 1)).not.toBe(base);
		expect(createRaidRandom(seed, "secret")("crit", 2)).not.toBe(base);
	});

	test("ほかの用途の乱数を引いても、ある用途の乱数はずれない", () => {
		const a = createRaidRandom(seed, "secret");
		const b = createRaidRandom(seed, "secret");
		const fromA = [a("crit", 1), a("crit", 1)];
		b("ice", 1);
		b("item.type", 1);
		const fromB = [b("crit", 1), b("ice", 1), b("crit", 1)];
		expect([fromB[0], fromB[2]]).toEqual(fromA);
	});

	test("シードがなければ Math.random を使う", () => {
		const spy = jest.spyOn(Math, "random").mockReturnValue(0.25);
		expect(createRaidRandom()("crit")).toBe(0.25);
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	test("秘密の値は設定がなければアクセストークンから作る（トークンそのものは含まない）", () => {
		const secret = raidSeedSecret();
		expect(secret).toMatch(/^[0-9a-f]{32}$/);
		expect(secret).not.toContain("test-token");
	});
});

describe("シードつきのレイド試算", () => {
	const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX)!;
	const data = () => ({
		lv: 300, atk: 1100, def: 1100, exp: 2, coin: 50,
		skills: ["パワーアップ", "粘り強い", "道具大好き"].map((name) => ({ ...skills.find((s) => s.name === name) })),
		items: [], raidScore: {}, clearHistory: [], superPoint: -3, noAmuletCount: -999,
	});

	beforeEach(() => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.setSystemTime(new Date(2026, 8, 7, 12));
		jest.spyOn(console, "log").mockImplementation(() => {});
		const ai: any = {
			account: { id: "bot" },
			moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: () => {} },
			friends: { find: () => [] },
			lookupFriend: () => null,
			getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
		};
		raidInstall(ai, { name: "rpg", log: () => {} } as any, new loki("test").addCollection<any>("raids") as any);
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	const player = { userId: "user-a", username: "a", data: data(), love: 300 };

	test("同じレイド・同じユーザーなら、何度試算しても同じ戦闘になる", async () => {
		for (const boss of [enemy, raidEnemys.find((x) => x.pattern === 2)!, raidEnemys.find((x) => x.pattern === 3)!]) {
			const a = await simulateRaidBattle(player, boss, { postCount: 40, seedPostId: "post-1", runs: 3 });
			const b = await simulateRaidBattle(player, boss, { postCount: 40, seedPostId: "post-1", runs: 3 });
			expect(b.map((r) => r.log)).toEqual(a.map((r) => r.log));
		}
	});

	test("シードを指定すると Math.random は使わない", async () => {
		const spy = jest.spyOn(Math, "random");
		await simulateRaidBattle(player, enemy, { postCount: 40, seedPostId: "post-1" });
		expect(spy).not.toHaveBeenCalled();
	});

	test("平行次元ごとに別の乱数になる", async () => {
		const runs = await simulateRaidBattle(player, enemy, { postCount: 40, seedPostId: "post-1", runs: 4 });
		expect(new Set(runs.map((r) => r.log)).size).toBeGreaterThan(1);
	});

	test("別のレイドなら別の戦闘になる", async () => {
		const logs = new Set<string>();
		for (const postId of ["post-1", "post-2", "post-3", "post-4"]) {
			logs.add((await simulateRaidBattle(player, enemy, { postCount: 40, seedPostId: postId }))[0].log);
		}
		expect(logs.size).toBeGreaterThan(1);
	});
});

describe("平行次元の番号", () => {
	test("各次元の計算に、正史 = 0 から順に番号を渡す", async () => {
		const doc: any = { perModulesData: { rpg: { lv: 1 } } };
		const msg: any = { reply: async () => ({ id: "r" }), friend: { doc, setPerModulesData: () => {} } };
		const dims: number[] = [];
		await runParallelDimensionRaid(msg, raidEnemys[0], { name: "rpg" }, async (_e, dimension) => {
			dims.push(dimension);
			return { totalDmg: dimension };
		}, 3, () => {});
		expect(dims).toEqual([0, 1, 2, 3]);
	});
});

/**
 * @packageDocumentation
 *
 * レイド結果の再計算（recalculateRaidResult）のテスト
 *
 * @remarks
 * - 実際のダメージ計算（getTotalDmg）を動かし、投稿数の取得だけを固定値に差し替える
 * - 乱数は再現しないため、新しいダメージの値そのものではなく「差し替わったこと」と副作用が無いことを確認する
 */
import * as loki from "lokijs";
import { raidInstall, recalculateRaidResult, parseRaidRecalcArgs, recalculateItemAtkStockBests, isItemAtkStockBugTarget } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills, skillCalculate } from "@/modules/rpg/skills";

jest.mock("@/modules/rpg/utils", () => ({ ...jest.requireActual("@/modules/rpg/utils"), getPostCount: async () => 40 }));

describe("recalculateRaidResult", () => {
	/** 修正前の計算式で出てしまった、ありえない大きさのダメージ */
	const BUGGY_DMG = 99_999_999;
	const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX)!;

	const setup = () => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.spyOn(console, "log").mockImplementation(() => {});
		const db = new loki("test");
		const raids = db.addCollection<any>("raids");
		const moduleData: any = { type: "rpg", maxLv: 255, raidScore: {}, raidScoreDate: {} };

		const rpgData: any = {
			lv: 300, atk: 1100, def: 1100, exp: 2, coin: 50,
			skills: ["パワーアップ", "粘り強い"].map((name) => ({ ...skills.find((s) => s.name === name) })),
			items: [{ name: "交通安全のお守り", type: "amulet", durability: 5 }],
			raidScore: {}, clearHistory: [], superPoint: -3, noAmuletCount: -999,
		};
		const doc: any = { perModulesData: { rpg: rpgData }, kazutoriData: {} };
		const friend: any = {
			doc,
			love: 300,
			getPerModulesData: () => doc.perModulesData.rpg,
			setPerModulesData: jest.fn((_m: any, d: any) => { doc.perModulesData.rpg = d; }),
		};
		const ai: any = {
			account: { id: "bot" },
			moduleData: { findOne: () => moduleData, update: jest.fn() },
			friends: { find: () => [] },
			lookupFriend: (id: string) => (id === "user-a" ? friend : null),
			getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
		};
		raidInstall(ai, { name: "rpg", log: () => {} } as any, raids as any);

		const attacker = (id: string, dmg: number) => ({ user: { id, username: id, host: null }, dmg, me: ":mk_hero:", lv: 300, count: 7, mark: ":blank:" });
		return { raids, moduleData, rpgData, friend, attacker };
	};

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("終了済みレイド: 結果だけ差し替わり、経験値・Lv・コイン・お守りの耐久は変わらない", async () => {
		const { raids, rpgData, attacker } = setup();
		raids.insert({ postId: "raid-1", enemy, isEnded: true, startedAt: Date.now(), finishedAt: Date.now(), attackers: [attacker("user-a", BUGGY_DMG), attacker("user-b", 1000)], replyKey: [] });

		const r = await recalculateRaidResult("raid-1", "user-a");

		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.oldDmg).toBe(BUGGY_DMG);
		expect(r.newDmg).toBeLessThan(BUGGY_DMG);
		const a = raids.findOne({ postId: "raid-1" }).attackers[0];
		expect(a.dmg).toBe(r.newDmg);
		expect(a.originalDmg).toBe(BUGGY_DMG);
		expect(a.recalculatedAt).toEqual(expect.any(Number));
		// 他の参加者の結果はそのまま
		expect(raids.findOne({ postId: "raid-1" }).attackers[1].dmg).toBe(1000);
		// 副作用は反映しない
		expect(rpgData.lv).toBe(300);
		expect(rpgData.exp).toBe(2);
		expect(rpgData.coin).toBe(50);
		expect(rpgData.items[0].durability).toBe(5);
	});

	test("自己ベストと全体記録がこの回のものだった場合、他のレイドの記録と新しい結果から付け直す", async () => {
		const { raids, rpgData, moduleData, attacker } = setup();
		raids.insert({ postId: "raid-old", enemy, isEnded: true, startedAt: new Date(2026, 0, 2).getTime(), finishedAt: 0, attackers: [attacker("user-a", 500), attacker("user-b", 700)], replyKey: [] });
		raids.insert({ postId: "raid-1", enemy, isEnded: true, startedAt: new Date(2026, 5, 10).getTime(), finishedAt: 0, attackers: [attacker("user-a", BUGGY_DMG), attacker("user-b", 1000)], replyKey: [] });
		rpgData.raidScore[enemy.name] = BUGGY_DMG;
		moduleData.raidScore[enemy.name] = BUGGY_DMG + 1000;
		moduleData.raidScoreDate[enemy.name] = "2026/6/10";

		const r = await recalculateRaidResult("raid-1", "user-a");

		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.personalBest).toEqual({ before: BUGGY_DMG, after: Math.max(r.newDmg, 500) });
		expect(rpgData.raidScore[enemy.name]).toBe(Math.max(r.newDmg, 500));
		const newTotal = r.newDmg + 1000;
		expect(moduleData.raidScore[enemy.name]).toBe(Math.max(newTotal, 1200));
		expect(moduleData.raidScoreDate[enemy.name]).toBe(newTotal >= 1200 ? "2026/6/10" : "2026/1/2");
	});

	test("自己ベストが別のレイドのものなら、新しい結果が上回った時だけ更新する", async () => {
		const { raids, rpgData, attacker } = setup();
		raids.insert({ postId: "raid-1", enemy, isEnded: true, startedAt: Date.now(), finishedAt: 0, attackers: [attacker("user-a", 10)], replyKey: [] });
		rpgData.raidScore[enemy.name] = BUGGY_DMG + 1;

		const r = await recalculateRaidResult("raid-1", "user-a");

		expect(r.ok).toBe(true);
		expect(rpgData.raidScore[enemy.name]).toBe(BUGGY_DMG + 1);
	});

	test("開催中のレイドでは全体記録に触れない", async () => {
		const { raids, moduleData, attacker } = setup();
		raids.insert({ postId: "raid-1", enemy, isEnded: false, startedAt: Date.now(), finishedAt: Date.now() + 1, attackers: [attacker("user-a", BUGGY_DMG)], replyKey: [] });
		moduleData.raidScore[enemy.name] = 12345;

		const r = await recalculateRaidResult("raid-1", "user-a");

		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.globalRecord).toBeUndefined();
		expect(moduleData.raidScore[enemy.name]).toBe(12345);
	});

	test("参加していないユーザーやレイドは再計算しない", async () => {
		const { raids, attacker } = setup();
		raids.insert({ postId: "raid-1", enemy, isEnded: true, startedAt: Date.now(), finishedAt: 0, attackers: [attacker("user-a", 100)], replyKey: [] });

		expect(await recalculateRaidResult("raid-1", "user-b")).toEqual({ ok: false, reason: "このレイドに参加していません" });
		expect(await recalculateRaidResult("raid-x", "user-a")).toEqual({ ok: false, reason: "レイドが見つかりません" });
	});
});

describe("recalculateItemAtkStockBests（継戦融合武装の不具合で膨らんだ自己ベストの再計算）", () => {
	const BUGGY_DMG = 99_999_999;
	const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX)!;
	/** 継と食を同時に持っていた参加時のスキル表示 */
	const TARGET = { skills: "[食整継整整]", amulet: "[土道選遂扱毒急バ]" };

	const setup = () => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.spyOn(console, "log").mockImplementation(() => {});
		const raids = new loki("test").addCollection<any>("raids");
		const moduleData: any = { type: "rpg", maxLv: 255, raidScore: {}, raidScoreDate: {} };
		const rpgData: any = {
			lv: 300, atk: 1100, def: 1100, exp: 2, coin: 50,
			skills: ["粘り強い"].map((name) => ({ ...skills.find((s) => s.name === name) })),
			items: [], raidScore: {}, clearHistory: [], superPoint: -3, noAmuletCount: -999,
		};
		const doc: any = { perModulesData: { rpg: rpgData }, kazutoriData: {} };
		const friend: any = {
			doc, love: 300,
			getPerModulesData: () => doc.perModulesData.rpg,
			setPerModulesData: jest.fn((_m: any, d: any) => { doc.perModulesData.rpg = d; }),
		};
		const ai: any = {
			account: { id: "bot" },
			moduleData: { findOne: () => moduleData, update: jest.fn() },
			friends: { find: () => [] },
			lookupFriend: (id: string) => (id === "user-a" ? friend : null),
			getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
		};
		raidInstall(ai, { name: "rpg", log: () => {} } as any, raids as any);
		// 合成お守りの価格計算（スキルの人気度）で参照される ai を設定しておく
		skillCalculate(ai, true);
		const attacker = (id: string, dmg: number, skillsStr: any = TARGET) => ({ user: { id, username: id, host: null }, dmg, me: ":mk_hero:", lv: 300, count: 7, mark: ":blank:", skillsStr });
		const insert = (postId: string, attackers: any[], startedAt = Date.now()) => raids.insert({ postId, enemy, isEnded: true, startedAt, finishedAt: 0, attackers, replyKey: [] });
		const dmgOf = (postId: string, i = 0) => raids.findOne({ postId }).attackers[i];
		return { raids, moduleData, rpgData, friend, attacker, insert, dmgOf };
	};

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("継と食を同時に持っていた場合だけを対象にする", () => {
		const a = (skills: string, amulet?: string) => ({ skillsStr: { skills, amulet } } as any);
		expect(isItemAtkStockBugTarget(a("[食整継整整]"))).toBe(true);
		expect(isItemAtkStockBugTarget(a("[整継]", "[食道]"))).toBe(true);
		expect(isItemAtkStockBugTarget(a("[武整継]"))).toBe(false);
		expect(isItemAtkStockBugTarget(a("[食整整]"))).toBe(false);
		expect(isItemAtkStockBugTarget({} as any)).toBe(false);
	});

	test("ドライランでは変更の一覧を返すだけで、何も書き込まない", async () => {
		const { rpgData, attacker, insert, dmgOf, friend } = setup();
		insert("raid-1", [attacker("user-a", BUGGY_DMG)]);
		rpgData.raidScore[enemy.name] = BUGGY_DMG;

		const changes = await recalculateItemAtkStockBests(false);

		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ userId: "user-a", enemyName: enemy.name, pbBefore: BUGGY_DMG });
		expect(changes[0].pbAfter).toBeLessThan(BUGGY_DMG);
		expect(dmgOf("raid-1").dmg).toBe(BUGGY_DMG);
		expect(dmgOf("raid-1").itemAtkStockFixedAt).toBeUndefined();
		expect(rpgData.raidScore[enemy.name]).toBe(BUGGY_DMG);
		expect(friend.setPerModulesData).not.toHaveBeenCalled();
	});

	test("apply で参加記録・自己ベスト・全体記録を下げ、2回目は何もしない", async () => {
		const { rpgData, moduleData, attacker, insert, dmgOf } = setup();
		insert("raid-1", [attacker("user-a", BUGGY_DMG), attacker("user-b", 1000)], new Date(2026, 5, 10).getTime());
		rpgData.raidScore[enemy.name] = BUGGY_DMG;
		moduleData.raidScore[enemy.name] = BUGGY_DMG + 1000;

		const changes = await recalculateItemAtkStockBests(true);

		expect(changes).toHaveLength(1);
		const newDmg = changes[0].raids[0].newDmg;
		expect(dmgOf("raid-1").dmg).toBe(newDmg);
		expect(dmgOf("raid-1").originalDmg).toBe(BUGGY_DMG);
		expect(dmgOf("raid-1").itemAtkStockFixedAt).toEqual(expect.any(Number));
		expect(rpgData.raidScore[enemy.name]).toBe(newDmg);
		expect(moduleData.raidScore[enemy.name]).toBe(newDmg + 1000);

		expect(await recalculateItemAtkStockBests(true)).toEqual([]);
	});

	test("2番目の記録も膨らんでいれば、それも再計算してから自己ベストを決める", async () => {
		const { rpgData, attacker, insert, dmgOf } = setup();
		insert("raid-1", [attacker("user-a", BUGGY_DMG)]);
		insert("raid-2", [attacker("user-a", BUGGY_DMG - 1)]);
		insert("raid-3", [attacker("user-a", 500, { skills: "[武継]" })]);
		rpgData.raidScore[enemy.name] = BUGGY_DMG;

		const changes = await recalculateItemAtkStockBests(true);

		expect(changes[0].raids.map((r) => r.postId).sort()).toEqual(["raid-1", "raid-2"]);
		const expected = Math.max(dmgOf("raid-1").dmg, dmgOf("raid-2").dmg, 500);
		expect(rpgData.raidScore[enemy.name]).toBe(expected);
		// 対象外の構成の記録は再計算しない
		expect(dmgOf("raid-3").dmg).toBe(500);
		expect(dmgOf("raid-3").recalculatedAt).toBeUndefined();
	});

	test("再計算で元の記録より上がる場合は採用しない", async () => {
		const { rpgData, attacker, insert, dmgOf } = setup();
		insert("raid-1", [attacker("user-a", 1)]);
		rpgData.raidScore[enemy.name] = 1;

		expect(await recalculateItemAtkStockBests(true)).toEqual([]);
		expect(dmgOf("raid-1").dmg).toBe(1);
		expect(dmgOf("raid-1").recalculatedAt).toBeUndefined();
		expect(rpgData.raidScore[enemy.name]).toBe(1);
	});

	describe("お守りの返金", () => {
		const AMULET_SKILLS = ["土属性剣攻撃", "バーサク"];
		/** 参加時と同じお守り（表示は "[土バ]"） */
		const amulet = (extra: any = {}) => ({ name: AMULET_SKILLS.join("&") + "のお守り", type: "amulet", durability: 50, skillName: AMULET_SKILLS, price: 300, ...extra });
		const withAmulet = { skills: "[食整継整整]", amulet: "[土バ]" };

		test("下がった記録の参加時と同じお守りを持っていれば、お守りは持たせたまま購入額を返金し、累計の買い物額も減らす", async () => {
			const { rpgData, attacker, insert } = setup();
			insert("raid-1", [attacker("user-a", BUGGY_DMG, withAmulet)]);
			rpgData.raidScore[enemy.name] = BUGGY_DMG;
			rpgData.items = [amulet()];
			rpgData.shopExp = 1000;

			const changes = await recalculateItemAtkStockBests(true);

			expect(changes[0].refund).toEqual({ amuletName: amulet().name, amount: 300, currency: "coin" });
			expect(rpgData.coin).toBe(50 + 300);
			expect(rpgData.shopExp).toBe(700);
			expect(rpgData.items).toHaveLength(1);
			expect(rpgData.itemAtkStockRefundedAt).toEqual(expect.any(Number));
		});

		test("ドライランでは返金の予定を返すだけで、コインは増えない", async () => {
			const { rpgData, attacker, insert } = setup();
			insert("raid-1", [attacker("user-a", BUGGY_DMG, withAmulet)]);
			rpgData.raidScore[enemy.name] = BUGGY_DMG;
			rpgData.items = [amulet()];

			const changes = await recalculateItemAtkStockBests(false);

			expect(changes[0].refund).toMatchObject({ amount: 300 });
			expect(rpgData.coin).toBe(50);
			expect(rpgData.itemAtkStockRefundedAt).toBeUndefined();
		});

		test("複数のボスで記録が下がっても、返金は1ユーザーにつき1回", async () => {
			const { rpgData, attacker, insert, raids } = setup();
			const enemy2 = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX && x.name !== enemy.name)!;
			insert("raid-1", [attacker("user-a", BUGGY_DMG, withAmulet)]);
			raids.insert({ postId: "raid-2", enemy: enemy2, isEnded: true, startedAt: Date.now(), finishedAt: 0, attackers: [attacker("user-a", BUGGY_DMG, withAmulet)], replyKey: [] });
			rpgData.raidScore[enemy.name] = BUGGY_DMG;
			rpgData.raidScore[enemy2.name] = BUGGY_DMG;
			rpgData.items = [amulet()];

			const changes = await recalculateItemAtkStockBests(true);

			expect(changes).toHaveLength(2);
			expect(changes.filter((c) => c.refund)).toHaveLength(1);
			expect(rpgData.coin).toBe(50 + 300);
		});

		test("今のお守りが参加時のものと違えば返金しない", async () => {
			const { rpgData, attacker, insert } = setup();
			insert("raid-1", [attacker("user-a", BUGGY_DMG, { ...withAmulet, amulet: "[土道]" })]);
			rpgData.raidScore[enemy.name] = BUGGY_DMG;
			rpgData.items = [amulet()];

			const changes = await recalculateItemAtkStockBests(true);

			expect(changes[0].refund).toBeUndefined();
			expect(rpgData.coin).toBe(50);
		});

		test("オーブで買ったお守りはオーブで返し、累計の買い物額は減らさない", async () => {
			const { rpgData, attacker, insert } = setup();
			insert("raid-1", [attacker("user-a", BUGGY_DMG, withAmulet)]);
			rpgData.raidScore[enemy.name] = BUGGY_DMG;
			rpgData.items = [amulet({ orb: true, price: 5 })];
			rpgData.rerollOrb = 1;
			rpgData.shopExp = 1000;

			await recalculateItemAtkStockBests(true);

			expect(rpgData.rerollOrb).toBe(6);
			expect(rpgData.coin).toBe(50);
			expect(rpgData.shopExp).toBe(1000);
		});
	});

	test("自己ベストが対象外の構成の記録から来ていれば触れない", async () => {
		const { rpgData, attacker, insert, dmgOf } = setup();
		insert("raid-1", [attacker("user-a", BUGGY_DMG, { skills: "[武継]" })]);
		insert("raid-2", [attacker("user-a", 1000)]);
		rpgData.raidScore[enemy.name] = BUGGY_DMG;

		expect(await recalculateItemAtkStockBests(true)).toEqual([]);
		expect(dmgOf("raid-2").dmg).toBe(1000);
		expect(rpgData.raidScore[enemy.name]).toBe(BUGGY_DMG);
	});
});

describe("parseRaidRecalcArgs", () => {
	test("コマンド名（10文字）をIDとして拾わない", () => {
		expect(parseRaidRecalcArgs("RPG admin raidRecalc artpvd9zt5 ahshzt8src")).toEqual({ raidPostId: "artpvd9zt5", userIds: ["ahshzt8src"] });
	});

	test("ユーザーIDを複数指定できる", () => {
		expect(parseRaidRecalcArgs("RPG admin raidRecalc artpvd9zt5 ahshzt8src 9d5ts6in38")).toEqual({ raidPostId: "artpvd9zt5", userIds: ["ahshzt8src", "9d5ts6in38"] });
	});

	test("IDが足りない場合はユーザーIDが空になる", () => {
		expect(parseRaidRecalcArgs("RPG admin raidRecalc artpvd9zt5")).toEqual({ raidPostId: "artpvd9zt5", userIds: [] });
	});
});

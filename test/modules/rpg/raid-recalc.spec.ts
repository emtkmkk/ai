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
import { raidInstall, recalculateRaidResult } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills } from "@/modules/rpg/skills";

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

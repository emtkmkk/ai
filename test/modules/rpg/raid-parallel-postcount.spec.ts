/**
 * @packageDocumentation
 *
 * 平行次元のお札でレイドに参加したときの投稿数の扱いに関するテスト
 *
 * @remarks
 * 投稿数の取得は、連携アカウント側のデータに「このレイドで使用済み」の印を付ける。
 * 次元ごとに取得し直すと、2次元目以降は連携アカウントの投稿数が 0 になってしまうため、
 * 投稿数は参加1回につき1度だけ取得し、全次元で同じ値を使う。
 */
import * as loki from "lokijs";

const getPostCountCalls: { result: number }[] = [];
jest.mock("@/modules/rpg/utils", () => {
	const actual = jest.requireActual("@/modules/rpg/utils");
	return {
		...actual,
		getPostCount: async (...args: any[]) => {
			const result = await actual.getPostCount(...args);
			getPostCountCalls.push({ result });
			return result;
		},
	};
});

import { raidInstall, raidContextHook } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills } from "@/modules/rpg/skills";

describe("平行次元レイドの投稿数", () => {
	const enemy = raidEnemys.find((x) => (x.pattern ?? 1) === 1 && !x.skillX && !x.forcePostCount)!;

	const setup = (parallelDimension: number) => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.setSystemTime(new Date(2026, 8, 7, 12));
		jest.spyOn(console, "log").mockImplementation(() => {});
		getPostCountCalls.length = 0;

		const rpgData: any = {
			lv: 255, atk: 1100, def: 1100, exp: 2, coin: 50, lastPlayedAt: "2026/9/7/12",
			skills: ["パワーアップ", "粘り強い"].map((name) => ({ ...skills.find((s) => s.name === name) })),
			items: [], raidScore: {}, clearHistory: [], superPoint: -3, noAmuletCount: -999,
			parallelDimension,
			// 投稿数の推定に使う値（今日 30 投稿）
			noChart: true, todayNotesCount: 1000, yesterdayNotesCount: 990,
		};
		const doc: any = {
			userId: "user-a",
			user: { id: "user-a", username: "a", host: null, notesCount: 1030 },
			perModulesData: { rpg: rpgData },
			kazutoriData: {},
			linkedAccounts: ["user-b"],
		};
		const friend: any = {
			userId: "user-a",
			doc,
			love: 300,
			getPerModulesData: () => doc.perModulesData.rpg,
			setPerModulesData: jest.fn((_m: any, d: any) => { doc.perModulesData.rpg = d; }),
			save: () => {},
		};

		// 連携アカウント（今日 50 投稿）
		const linkedData: any = { lv: 10, noChart: true, todayNotesCount: 500, yesterdayNotesCount: 495 };
		const linkedDoc: any = {
			userId: "user-b",
			user: { id: "user-b", username: "b", host: null, notesCount: 550 },
			perModulesData: { rpg: linkedData },
			linkedAccounts: ["user-a"],
		};
		const linkedFriend: any = {
			userId: "user-b",
			doc: linkedDoc,
			getPerModulesData: () => linkedDoc.perModulesData.rpg,
			setPerModulesData: (_m: any, d: any) => { linkedDoc.perModulesData.rpg = d; },
			save: () => {},
		};

		const ai: any = {
			account: { id: "bot" },
			moduleData: { findOne: () => ({ type: "rpg", maxLv: 255, raidScore: {}, raidScoreDate: {} }), update: () => {} },
			friends: { find: () => [] },
			lookupFriend: (id: string) => (id === "user-a" ? friend : id === "user-b" ? linkedFriend : null),
			getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
			api: jest.fn(async () => ({})),
		};
		const raids = new loki("test").addCollection<any>("raids");
		raids.insert({ postId: "raid-1", enemy, isEnded: false, startedAt: Date.now(), attackers: [], replyKey: [] });
		raidInstall(ai, { name: "rpg", log: () => {}, subscribeReply: () => {} } as any, raids as any);

		let replyCount = 0;
		const msg: any = {
			id: "reply-1",
			userId: "user-a",
			user: { id: "user-a", username: "a", host: null },
			text: "参加",
			extractedText: "参加",
			friend,
			includes: () => false,
			reply: jest.fn(async () => ({ id: `r-${++replyCount}` })),
		};

		return { msg, rpgData, linkedData, doc };
	};

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("お札なし: 連携アカウントの投稿数を合算して1度だけ取得する", async () => {
		const { msg } = setup(0);

		await raidContextHook("raid-1:x", msg, {});

		expect(getPostCountCalls.map((c) => c.result)).toEqual([30 + 50]);
	});

	test("お札あり: 次元がいくつあっても投稿数は1度だけ取得し、連携アカウントの投稿数を含む", async () => {
		const { msg } = setup(3);

		await raidContextHook("raid-1:x", msg, {});

		expect(getPostCountCalls.map((c) => c.result)).toEqual([30 + 50]);
	});

	test("お札あり: 本人と連携アカウントの両方に、このレイドで使用済みの印が残る", async () => {
		const { msg, linkedData, doc } = setup(3);

		await raidContextHook("raid-1:x", msg, {});

		expect(doc.perModulesData.rpg.lastRaidPostCountUsageKey).toBe("raid-1");
		expect(linkedData.lastRaidPostCountUsageKey).toBe("raid-1");
	});
});

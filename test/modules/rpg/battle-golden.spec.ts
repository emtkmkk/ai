/**
 * @packageDocumentation
 *
 * 通常戦闘（「RPG」）と木人（「RPG 木人」）の結果を固定するテスト（ゴールデンテスト）
 *
 * @remarks
 * 乱数・日時・投稿数を固定して、代表的な構成で何回か続けてプレイし、返信とプレイヤーデータの変化を記録する。
 * 戦闘の処理を整理しても結果が変わっていないことを確かめるためのもの。
 * 計算式を意図して変えた場合は、スナップショットを更新する（jest -u）。
 *
 * 返信は全文だと大きすぎるので、ハッシュ値と、数値の変化（Lv・パワー・防御・コインなど）を記録する。
 */
import Rpg from "@/modules/rpg/index";
import { skills, skillCalculate } from "@/modules/rpg/skills";
import { builds, buildData, hash, seeded } from "#/modules/rpg/golden-helpers";
import type { Build } from "#/modules/rpg/golden-helpers";

/** プレイヤーの 1 日の投稿数（投稿数の取得で返す値） */
const NOTES_PER_DAY = 40;

const createAi = () => {
	const rpgModuleData: any = { type: "rpg", maxLv: 255, lastUpdated: 0 };
	const ai: any = {
		account: { id: "bot", username: "ai" },
		moduleData: { findOne: (q: any) => (q?.type === "rpg" ? rpgModuleData : null), update: () => {}, insert: (x: any) => x },
		friends: { find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })) },
		lookupFriend: () => null,
		getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
		api: async (endpoint: string) => {
			if (endpoint === "charts/user/notes") return { inc: Array(30).fill(NOTES_PER_DAY), dec: Array(30).fill(0), total: Array(30).fill(1000) };
			return {};
		},
		post: async () => ({ id: "posted" }),
		log: () => {},
		subscribeReply: () => {},
		unsubscribeReply: () => {},
		setTimeoutWithPersistence: () => {},
	};
	return ai;
};

/** 1 人分のプレイヤー（メッセージを作るたびに同じデータを使う） */
const createPlayer = (ai: any, build: Build) => {
	const data: any = buildData(build, ai);
	const doc: any = { perModulesData: { rpg: data }, kazutoriData: {}, user: { notesCount: 1000 }, save: () => {} };
	const replies: string[] = [];
	const message = (text: string): any => ({
		userId: "user-a",
		user: { id: "user-a", username: "a", host: null },
		text,
		extractedText: text,
		includes: (words: string[]) => words.some((w) => text.toLowerCase().includes(String(w).toLowerCase())),
		reply: async (body: string, opts?: { cw?: string }) => {
			replies.push((opts?.cw ? `[cw] ${opts.cw}\n` : "") + body);
			return { id: `reply-${replies.length}` };
		},
		friend: {
			doc,
			love: build.love ?? 300,
			userId: "user-a",
			getPerModulesData: () => doc.perModulesData.rpg,
			setPerModulesData: (_m: any, d: any) => { doc.perModulesData.rpg = d; },
			incLove: () => {},
			decLove: () => {},
			save: () => {},
		},
	});
	return { data: () => doc.perModulesData.rpg, replies, message };
};

/** プレイ後のデータのうち、記録しておく値 */
const summarize = (d: any) => ({
	lv: d.lv, atk: Math.round(d.atk), def: Math.round(d.def), exp: d.exp, coin: d.coin,
	enemy: d.enemy?.name ?? null, count: d.count ?? null, hp: d.php ?? null, ehp: d.ehp ?? null,
	winCount: d.winCount ?? 0, clearHistory: (d.clearHistory ?? []).length,
	superCount: d.superCount ?? 0, charge: d.charge ?? null, bestScore: d.bestScore ?? null,
});

const setup = (start: Date, seed: number) => {
	jest.setSystemTime(start);
	const original = Math.random;
	Math.random = seeded(seed);
	return () => { Math.random = original; };
};

beforeAll(() => {
	jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
	jest.spyOn(console, "log").mockImplementation(() => {});
	skillCalculate(createAi(), true);
});
afterAll(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

/** 通常戦闘を、時間帯を 6 時間ずつ進めながら続けてプレイする（戦闘が複数回にまたがる場合も通る） */
const playNormal = async (build: Build, seed: number, plays = 4) => {
	const ai = createAi();
	const rpg: any = new Rpg();
	rpg.ai = ai;
	const player = createPlayer(ai, build);
	const restore = setup(new Date(2026, 8, 9, 8), seed); // 2026/9/9 8時（水曜日）
	const results: string[] = [];
	try {
		for (let i = 0; i < plays; i++) {
			jest.setSystemTime(new Date(2026, 8, 9, 8 + i * 6));
			const before = player.replies.length;
			const res = await rpg.handleNormalCommands(player.message("RPG"));
			const text = player.replies.slice(before).join("\n---\n");
			if (process.env.PEEK) process.stdout.write(`\n=====\n${text}\n`);
			results.push(`${i + 1}回目: ${hash(text)} ${JSON.stringify(summarize(player.data()))} reaction=${res?.reaction ?? null}`);
		}
	} finally {
		restore();
	}
	return results;
};

/** 木人を、Lv を 1 ずつ上げながら続けてプレイする（同じ Lv では 1 回しかできないため） */
const playTrial = async (build: Build, seed: number, plays = 2, command = "RPG 木人") => {
	const ai = createAi();
	const rpg: any = new Rpg();
	rpg.ai = ai;
	const player = createPlayer(ai, build);
	const restore = setup(new Date(2026, 8, 9, 12), seed);
	const results: string[] = [];
	try {
		for (let i = 0; i < plays; i++) {
			player.data().lv += i === 0 ? 0 : 1;
			const before = player.replies.length;
			const res = await rpg.handleTrialCommands(player.message(command));
			const text = player.replies.slice(before).join("\n---\n");
			results.push(`${i + 1}回目: ${hash(text)} best=${player.data().bestScore ?? null} reaction=${res?.reaction ?? null}`);
		}
	} finally {
		restore();
	}
	return results;
};

describe("通常戦闘の結果（ゴールデン）", () => {
	test.each(builds)("%s", async (_name, build) => {
		const results: Record<string, string[]> = {};
		for (const seed of [1, 2, 3]) results[`seed ${seed}`] = await playNormal(build, seed);
		expect(results).toMatchSnapshot();
	});

	// Lv600 だと敵を 1 ターンで倒してしまうので、Lv150 でも遊ぶ（複数ターンの戦闘・敗北・逃走も通る）
	test.each(builds)("Lv150: %s", async (_name, build) => {
		const results: Record<string, string[]> = {};
		const lv150: Build = { ...build, extra: { ...(build.extra ?? {}), lv: 150, atk: 570, def: 570 } };
		for (const seed of [1, 2, 3]) results[`seed ${seed}`] = await playNormal(lv150, seed, 6);
		expect(results).toMatchSnapshot();
	});

	test("Lv が低いプレイヤー（序盤の敵）", async () => {
		const results: Record<string, string[]> = {};
		const build: Build = { skills: [], love: 50, extra: { lv: 5, atk: 20, def: 20 } };
		for (const seed of [1, 2, 3]) results[`seed ${seed}`] = await playNormal(build, seed, 6);
		expect(results).toMatchSnapshot();
	});
});

describe("木人の結果（ゴールデン）", () => {
	test.each(builds)("%s", async (_name, build) => {
		const results: Record<string, string[]> = {};
		for (const seed of [1, 2, 3]) results[`seed ${seed}`] = await playTrial(build, seed);
		expect(results).toMatchSnapshot();
	});

	// 詳細ログ（-v）でしか通らない分岐があるので、ログのハッシュで固定する
	test.each(builds)("詳細ログ: %s", async (_name, build) => {
		const results: Record<string, string[]> = {};
		for (const seed of [1, 2, 3]) results[`seed ${seed}`] = await playTrial(build, seed, 1, "RPG 木人 -v");
		expect(results).toMatchSnapshot();
	});
});

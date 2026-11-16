/**
 * @packageDocumentation
 *
 * 通常戦闘（「RPG」）と木人（「RPG 木人」）の結果を固定するテスト（ゴールデンテスト）
 *
 * @remarks
 * 乱数・日時・投稿数を固定して、代表的な構成で何回か続けてプレイし、1 回ごとに次を記録する。
 * - 返信全体のハッシュ（1 文字でも変われば検出できる）
 * - 与ダメージ・被ダメージ（1 発ずつ。変わったときに、どの数値がどう変わったか差分で読める）
 * - レベルアップの伸び（Lv・パワー・防御）
 * - プレイ後のデータ（敵・体力・勝利数など）
 *
 * 戦闘の処理を整理しても結果が変わっていないことを確かめるためのもの。
 * 計算式を意図して変えた場合は、スナップショットを更新する（jest -u）。
 *
 * あわせて、７フィーバー！と旅モードに関わる分岐（修行の成果ボーナスとの比較・レベルアップで 7 を崩さない補正）を、
 * 条件ごとに明示的に確かめる。
 */
import Rpg from "@/modules/rpg/index";
import { skills, skillCalculate } from "@/modules/rpg/skills";
import { endressEnemy, enemys } from "@/modules/rpg/enemys";
import serifs from "@/serifs";
import { builds, buildData, enemyDamageTemplates, hash, makeDamageExtractor, seeded } from "#/modules/rpg/golden-helpers";
import type { Build } from "#/modules/rpg/golden-helpers";

/** プレイヤーの 1 日の投稿数（投稿数の取得で返す値） */
const NOTES_PER_DAY = 40;

/** 通常戦闘のログからダメージを取り出す */
const extractNormalDamages = makeDamageExtractor([
	...enemyDamageTemplates([...enemys, endressEnemy({})]),
	{ kind: "warrior", make: serifs.rpg.warrior.atk },
]);

/** 木人のログからダメージを取り出す */
const extractTrialDamages = makeDamageExtractor([{ kind: "dealt", make: serifs.rpg.trial.atk }]);

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
	winCount: d.winCount ?? 0, clearHistory: (d.clearHistory ?? []).length, endress: d.endress ?? null,
	superCount: d.superCount ?? 0, charge: d.charge ?? null, bestScore: d.bestScore ?? null,
});

/** 1 回のプレイの記録 */
type PlayRecord = {
	/** 返信全体のハッシュ */
	reply: string;
	/** 与ダメージ（1 発ずつ） */
	dealt: number[];
	/** 被ダメージ（1 発ずつ） */
	taken: number[];
	/** 戦士の攻撃（1 発ずつ。ない場合は省略） */
	warrior?: number[];
	/** レベルアップの伸び（プレイ前との差） */
	growth: { lv: number; atk: number; def: number };
	/** プレイ後のデータ */
	after: ReturnType<typeof summarize>;
	reaction: string | null;
};

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

/** {@link playNormal} のオプション */
type PlayNormalOptions = {
	/** 送るコマンド（既定 "RPG"） */
	command?: string;
	/** 毎回のプレイの直前にデータを書き換える（ステータスを固定したい場合など） */
	beforePlay?: (data: any, index: number) => void;
};

/** 1 回分の返信とその記録 */
type Played = { text: string; record: PlayRecord };

/** 通常戦闘を、時間帯を 6 時間ずつ進めながら続けてプレイする（戦闘が複数回にまたがる場合も通る） */
const playNormal = async (build: Build, seed: number, plays = 4, options: PlayNormalOptions = {}): Promise<Played[]> => {
	const ai = createAi();
	const rpg: any = new Rpg();
	rpg.ai = ai;
	const player = createPlayer(ai, build);
	const restore = setup(new Date(2026, 8, 9, 8), seed); // 2026/9/9 8時（水曜日）
	const played: Played[] = [];
	try {
		for (let i = 0; i < plays; i++) {
			jest.setSystemTime(new Date(2026, 8, 9, 8 + i * 6));
			options.beforePlay?.(player.data(), i);
			const before = { lv: player.data().lv, atk: player.data().atk, def: player.data().def };
			const replyCount = player.replies.length;
			const res = await rpg.handleNormalCommands(player.message(options.command ?? "RPG"));
			const text = player.replies.slice(replyCount).join("\n---\n");
			if (process.env.PEEK) process.stdout.write(`\n=====\n${text}\n`);
			const after = player.data();
			const { dealt, taken, warrior } = extractNormalDamages(text);
			played.push({
				text,
				record: {
					reply: hash(text), dealt, taken, ...(warrior.length ? { warrior } : {}),
					growth: { lv: after.lv - before.lv, atk: Math.round(after.atk - before.atk), def: Math.round(after.def - before.def) },
					after: summarize(after),
					reaction: res?.reaction ?? null,
				},
			});
		}
	} finally {
		restore();
	}
	return played;
};

/** 乱数 1〜3 でプレイし、記録をまとめる（スナップショット用） */
const recordNormal = async (build: Build, plays = 4, options: PlayNormalOptions = {}) => {
	const results: Record<string, PlayRecord[]> = {};
	for (const seed of [1, 2, 3]) results[`seed ${seed}`] = (await playNormal(build, seed, plays, options)).map((p) => p.record);
	return results;
};

/** 木人を、Lv を 1 ずつ上げながら続けてプレイする（同じ Lv では 1 回しかできないため） */
const playTrial = async (build: Build, seed: number, plays = 2) => {
	const ai = createAi();
	const rpg: any = new Rpg();
	rpg.ai = ai;
	const player = createPlayer(ai, build);
	const restore = setup(new Date(2026, 8, 9, 12), seed);
	const results: { reply: string; dealt: number[]; best: number | null; reaction: string | null }[] = [];
	try {
		for (let i = 0; i < plays; i++) {
			player.data().lv += i === 0 ? 0 : 1;
			const before = player.replies.length;
			const res = await rpg.handleTrialCommands(player.message("RPG 木人"));
			const text = player.replies.slice(before).join("\n---\n");
			results.push({ reply: hash(text), dealt: extractTrialDamages(text).dealt, best: player.data().bestScore ?? null, reaction: res?.reaction ?? null });
		}
	} finally {
		restore();
	}
	return results;
};

describe("ダメージの取り出し", () => {
	// 取り出しがずれると、ダメージの変化を見落とすので、形を確かめておく
	test("通常の攻撃・クリティカル・被ダメージ・戦士の攻撃を、出た順に取り出す", () => {
		const journey = endressEnemy({});
		const log = [journey.atkmsg(12), `**${journey.atkmsg(345)}**`, journey.defmsg(67), serifs.rpg.warrior.atk(890)].join("\n");
		expect(extractNormalDamages(log)).toEqual({ dealt: [12, 345], taken: [67], final: [], warrior: [890] });
	});
});

describe("通常戦闘の結果（ゴールデン）", () => {
	test.each(builds)("%s", async (_name, build) => {
		expect(await recordNormal(build)).toMatchSnapshot();
	});

	// Lv600 だと敵を 1 ターンで倒してしまうので、Lv150 でも遊ぶ（複数ターンの戦闘・敗北・逃走も通る）
	test.each(builds)("Lv150: %s", async (_name, build) => {
		const lv150: Build = { ...build, extra: { ...(build.extra ?? {}), lv: 150, atk: 570, def: 570 } };
		expect(await recordNormal(lv150, 6)).toMatchSnapshot();
	});

	test("Lv が低いプレイヤー（序盤の敵）", async () => {
		const build: Build = { skills: [], love: 50, extra: { lv: 5, atk: 20, def: 20 } };
		expect(await recordNormal(build, 6)).toMatchSnapshot();
	});
});

/** 旅モードのテストで使うステージ（内部の endress の値。表示上のステージは +1） */
const STAGE = 159;

/** スキル [７７７貫強]・お守り [気７貫] の構成。ステータスは extra で上書きする */
const sevenBuild = (extra: Record<string, any>): Build => ({
	skills: ["７フィーバー！", "７フィーバー！", "７フィーバー！", "防御貫通+10%", "強敵と戦うのが好き"],
	amulet: ["気合で頑張る", "７フィーバー！", "防御貫通+10%"],
	love: 300,
	extra,
});

/** ７フィーバー！の数（スキル 3 + お守り 1） */
const SEVEN_FEVER_COUNT = 4;

/** 毎回のプレイ前に Lv・パワー・防御を戻す（７フィーバー！の効果量や、比べる条件を毎回同じにする） */
const fixStatus = (lv: number, atk: number, def: number) => (data: any) => {
	data.lv = lv;
	data.atk = atk;
	data.def = def;
};

const sevenFeverMessage = (percent: number) => `スキル「７フィーバー！」発動！\nステータス+${percent}%！`;
const lvBonusMessage = (percent: number) => `修行の成果ボーナス！\nステータス+${percent}%！`;

describe("旅モード ステージ160: [７７７貫強] お守り [気７貫]", () => {
	// ステージ160 = 内部の endress が 159（表示は「ステージ⭐60」）。
	// ステージ200（endress 199）では乱数 12 通り中 2 通りで負けたので、確実に勝てるところまで下げている。
	// maxEndress が 99 以上なので、負けてもステージは下がらない。
	const build = sevenBuild({ lv: 600, atk: 7777, def: 5000, endress: STAGE, maxEndress: 199 });
	// パワー 7777 の「7777」で、７フィーバー！が 1 つあたり +7777%（Lv 600・防御 5000 には 7 を含めない）
	const beforePlay = fixStatus(600, 7777, 5000);

	test.each([1, 2, 3])("乱数 %i: 旅の敵と戦い、７フィーバー！が毎回 +7777% × 4 で発動し、負けずにステージを進める", async (seed) => {
		const played = await playNormal(build, seed, 4, { command: "RPG 旅", beforePlay });
		for (const { text, record } of played) {
			// 旅の敵（ステージ⭐ 以降）と戦っている
			expect(text).toMatch(/旅の途中 \(ステージ⭐\d+\)/);
			// 修行の成果ではなく、７フィーバー！が 1 つあたり +7777% で発動している
			expect(text).toContain(sevenFeverMessage(7777 * SEVEN_FEVER_COUNT));
			expect(text).not.toContain("修行の成果ボーナス！");
			// 大きな倍率でも数値が壊れていない
			expect(text).not.toMatch(/NaN|Infinity|undefined/);
			expect([...record.dealt, ...record.taken].every(Number.isFinite)).toBe(true);
			// 毎回攻撃していて、負けていない
			expect(record.dealt.length).toBeGreaterThan(0);
			expect(text).not.toContain("疲れてしまった");
		}
		// 4 回のプレイのうちに少なくとも 1 回勝って、ステージが進んでいる
		expect(Math.max(...played.map((p) => p.record.after.endress ?? 0))).toBeGreaterThan(STAGE);
	});

	test("結果（ゴールデン）", async () => {
		expect(await recordNormal(build, 4, { command: "RPG 旅", beforePlay })).toMatchSnapshot();
	});
});

describe("７フィーバー！と修行の成果ボーナス（Lv384 超・旅の敵では、効果量の大きいほうだけが掛かる）", () => {
	// 修行の成果ボーナスは Lv600 で +70.29%（表示は切り上げて +71%）。
	// パワー 7000（「7」1 つ）なら ７フィーバー！は 7% × 4 = +28% で、修行の成果のほうが大きい。

	test("Lv600・旅の敵・７フィーバー！のほうが大きい（+31108%）: ７フィーバー！だけが掛かる", async () => {
		const [{ text }] = await playNormal(sevenBuild({ lv: 600, atk: 7777, def: 5000, endress: STAGE, maxEndress: 199 }), 1, 1, { command: "RPG 旅", beforePlay: fixStatus(600, 7777, 5000) });
		expect(text).toContain(sevenFeverMessage(7777 * SEVEN_FEVER_COUNT));
		expect(text).not.toContain("修行の成果ボーナス！");
	});

	test("Lv600・旅の敵・修行の成果のほうが大きい（+28% < +71%）: 修行の成果ボーナスだけが掛かる", async () => {
		const [{ text }] = await playNormal(sevenBuild({ lv: 600, atk: 7000, def: 5000, endress: STAGE, maxEndress: 199 }), 1, 1, { command: "RPG 旅", beforePlay: fixStatus(600, 7000, 5000) });
		expect(text).toContain(lvBonusMessage(71));
		expect(text).not.toContain("スキル「７フィーバー！」発動！");
	});

	test("Lv384 以下・旅の敵: 修行の成果ボーナスはなく、７フィーバー！が掛かる", async () => {
		const [{ text }] = await playNormal(sevenBuild({ lv: 300, atk: 7000, def: 500, endress: 20, maxEndress: 199 }), 1, 1, { command: "RPG 旅", beforePlay: fixStatus(300, 7000, 500) });
		expect(text).toMatch(/旅の途中/);
		expect(text).toContain(sevenFeverMessage(7 * SEVEN_FEVER_COUNT));
		expect(text).not.toContain("修行の成果ボーナス！");
	});

	test("Lv600・旅ではない敵: 修行の成果ボーナスはなく、７フィーバー！が掛かる", async () => {
		const [{ text }] = await playNormal(sevenBuild({ lv: 600, atk: 7000, def: 5000, maxEndress: 199 }), 1, 1, { command: "RPG", beforePlay: fixStatus(600, 7000, 5000) });
		expect(text).not.toMatch(/旅の途中|旅に出たい/);
		expect(text).toContain(sevenFeverMessage(7 * SEVEN_FEVER_COUNT));
		expect(text).not.toContain("修行の成果ボーナス！");
	});
});

describe("レベルアップで 7 を崩さない補正（旅の最高ステージ 100 以上で、パワー・防御に 7 があるとき）", () => {
	// 条件を満たすと、7 の多いほうは伸ばさず、少ないほうに全部振る（rpg/index.ts のレベルアップ処理）。
	// 条件: maxEndress >= 99、パワーか防御に 7 がある、敵がいない（決着した）か旅の敵

	/** 乱数 1〜3 で 4 回ずつ旅をして、毎回のレベルアップの伸びを返す */
	const journeyGrowth = async (atk: number, def: number, maxEndress: number) => {
		const growth: PlayRecord["growth"][] = [];
		for (const seed of [1, 2, 3]) {
			const played = await playNormal(sevenBuild({ lv: 600, atk, def, endress: STAGE, maxEndress }), seed, 4, { command: "RPG 旅", beforePlay: fixStatus(600, atk, def) });
			growth.push(...played.map((p) => p.record.growth));
		}
		return growth;
	};

	test("パワーのほうが 7 が多い: パワーは伸びず、防御に全部振る", async () => {
		const growth = await journeyGrowth(7777, 5000, 199);
		for (const g of growth) {
			expect(g.lv).toBe(1);
			expect(g.atk).toBe(0);
			expect(g.def).toBeGreaterThanOrEqual(7);
		}
	});

	test("防御のほうが 7 が多い: 防御は伸びず、パワーに全部振る", async () => {
		const growth = await journeyGrowth(5000, 7777, 199);
		for (const g of growth) {
			expect(g.lv).toBe(1);
			expect(g.def).toBe(0);
			expect(g.atk).toBeGreaterThanOrEqual(7);
		}
	});

	test("7 の数が同じ: 補正はなく、両方が伸びることがある", async () => {
		const growth = await journeyGrowth(7000, 7000, 199);
		expect(growth.some((g) => g.atk > 0 && g.def > 0)).toBe(true);
	});

	test("最高ステージが 100 未満: 補正はなく、7 の多いパワーも伸びる", async () => {
		const growth = await journeyGrowth(7777, 5000, 98);
		expect(growth.some((g) => g.atk > 0)).toBe(true);
	});

	test("旅ではない敵に勝ったプレイでも、敵が消えたあとなので補正が掛かる（今の動き）", async () => {
		// 勝つと敵が消されてからレベルアップするので、「敵がいない」として補正が掛かる
		const played = await playNormal(sevenBuild({ lv: 600, atk: 7777, def: 5000, maxEndress: 199 }), 1, 4, { command: "RPG", beforePlay: fixStatus(600, 7777, 5000) });
		const wins = played.filter((p) => p.record.after.enemy === null && !/旅の途中|旅に出たい/.test(p.text));
		expect(wins.length).toBeGreaterThan(0);
		for (const p of wins) expect(p.record.growth.atk).toBe(0);
	});

	test("結果（ゴールデン）", async () => {
		const results: Record<string, PlayRecord[]> = {};
		for (const [name, atk, def, maxEndress] of [["パワーに 7", 7777, 5000, 199], ["防御に 7", 5000, 7777, 199], ["同じ数", 7000, 7000, 199], ["最高ステージ 100 未満", 7777, 5000, 98]] as const) {
			const build = sevenBuild({ lv: 600, atk, def, endress: STAGE, maxEndress });
			results[name] = (await playNormal(build, 1, 4, { command: "RPG 旅", beforePlay: fixStatus(600, atk, def) })).map((p) => p.record);
		}
		expect(results).toMatchSnapshot();
	});
});

describe("木人の結果（ゴールデン）", () => {
	test.each(builds)("%s", async (_name, build) => {
		const results: Record<string, unknown> = {};
		for (const seed of [1, 2, 3]) results[`seed ${seed}`] = await playTrial(build, seed);
		expect(results).toMatchSnapshot();
	});
});

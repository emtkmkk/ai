/**
 * @packageDocumentation
 *
 * レイドの戦闘結果を固定するテスト（ゴールデンテスト）
 *
 * @remarks
 * 乱数と投稿数を固定して、代表的な構成 × 全ボスのレイドを試算し、結果を記録しておく。
 * レイドの処理を整理しても結果が変わっていないことを確かめるためのもの。
 * 計算式を意図して変えた場合は、スナップショットを更新する（jest -u）。
 *
 * 戦闘ログは全文だと大きすぎるので、ハッシュ値を記録する（1文字でも変われば検出できる）。
 * 基本のケース（水曜日・詳細ログなし）では、与ダメージ・被ダメージ・全力の一撃・戦士の攻撃も 1 発ずつ記録し、
 * 変わったときにどの数値がどう変わったか差分で読めるようにする。
 *
 * あわせて、７フィーバー！の「7 の固定処理」（与ダメージを 7 の倍数に、全力の一撃を …777 に、バリアを 7 の倍数に）を明示的に確かめる。
 */
import * as loki from "lokijs";
import { raidInstall, simulateRaidBattle } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills, skillCalculate } from "@/modules/rpg/skills";
import serifs from "@/serifs";
import { builds, buildData as buildPlayerData, enemyDamageTemplates, hash, makeDamageExtractor, seeded } from "#/modules/rpg/golden-helpers";
import type { Build, Damages } from "#/modules/rpg/golden-helpers";

/** レイドのログからダメージを取り出す */
const extractRaidDamages = makeDamageExtractor([
	...enemyDamageTemplates(raidEnemys),
	{ kind: "final", make: serifs.rpg.finalAttack },
	{ kind: "warrior", make: serifs.rpg.warrior.atk },
]);

const ai: any = {
	account: { id: "bot" },
	moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: () => {} },
	friends: { find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })) },
	lookupFriend: () => null,
	getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
};

const buildData = (b: Build) => buildPlayerData(b, ai);

/** 1 回のレイドを試算する */
const simulate = async (build: Build, enemy: (typeof raidEnemys)[number], seed: number, verbose?: boolean) => {
	const runs = await simulateRaidBattle({ userId: "user-a", username: "a", data: buildData(build), love: build.love ?? 300 }, enemy, { postCount: 40, random: seeded(seed), verbose });
	return runs[0];
};

/** 結果の要約（合計ダメージ / ターン数 / ログのハッシュ） */
const summary = (r: Awaited<ReturnType<typeof simulate>>) => (r ? `${r.totalDmg} / ${r.count}ターン / ${hash(r.log)}` : "失敗");

/** 空の種類を省いたダメージの一覧 */
const nonEmpty = (d: Damages) => Object.fromEntries(Object.entries(d).filter(([, v]) => v.length));

/** 1構成について、全ボス × seed 1〜3 の結果をまとめる（withDamages ならダメージの一覧も付ける） */
const runBuild = async (build: Build, options: { verbose?: boolean; withDamages?: boolean } = {}) => {
	const results: Record<string, unknown> = {};
	for (const enemy of raidEnemys) {
		for (const seed of [1, 2, 3]) {
			const r = await simulate(build, enemy, seed, options.verbose);
			results[`${enemy.name} #${seed}`] = options.withDamages && r ? { summary: summary(r), ...nonEmpty(extractRaidDamages(r.log)) } : summary(r);
		}
	}
	return results;
};

const WEDNESDAY = new Date(2026, 8, 9, 12); // 2026/9/9 = 水曜日（調子補正が曜日と週で決まる日）
const SATURDAY = new Date(2026, 8, 12, 12); // 2026/9/12 = 土曜日（調子補正が 1 に固定される日）

beforeAll(() => {
	jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
	jest.setSystemTime(WEDNESDAY);
	jest.spyOn(console, "log").mockImplementation(() => {});
	skillCalculate(ai, true);
	raidInstall(ai, { name: "rpg", log: () => {} } as any, new loki("test").addCollection<any>("raids") as any);
});
afterAll(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe("レイドの戦闘結果（ゴールデン）", () => {
	beforeEach(() => jest.setSystemTime(WEDNESDAY));

	test.each(builds)("%s", async (_name, build) => {
		expect(await runBuild(build, { withDamages: true })).toMatchSnapshot();
	});
});

describe("７フィーバー！の 7 の固定処理（レイド）", () => {
	beforeEach(() => jest.setSystemTime(WEDNESDAY));

	// 上の構成はどれもステータスに 7 を含まず、７フィーバー！が発動しないので、パワー 7777 の構成で確かめる。
	// スキル [７７７貫強]・お守り [気７貫]。７フィーバー！は 4 つで、効果量は 7777% × 4。
	const build: Build = {
		skills: ["７フィーバー！", "７フィーバー！", "７フィーバー！", "防御貫通+10%", "強敵と戦うのが好き"],
		amulet: ["気合で頑張る", "７フィーバー！", "防御貫通+10%"],
		love: 300,
		extra: { lv: 600, atk: 7777, def: 5000 },
	};
	/** 通常型のボス（じゃんけん型・コンテスト型は 7 の固定処理がない） */
	const battleEnemies = raidEnemys.filter((e) => !e.pattern || e.pattern === 1);

	test.each(battleEnemies.map((e) => [e.name, e] as const))("%s: 与ダメージは 7 の倍数、全力の一撃は …777、バリアは 7 の倍数", async (_name, enemy) => {
		for (const seed of [1, 2, 3]) {
			const r = await simulate(build, enemy, seed);
			expect(r).toBeDefined();
			const log = r!.log;
			const { dealt, final } = extractRaidDamages(log);

			// ７フィーバー！が発動し、得たバリアは 7 の倍数
			const barrier = log.match(/スキル「７フィーバー！」発動！\n防御がアップ！\n(\d+)ポイントのバリアを獲得！/);
			expect(barrier).not.toBeNull();
			expect(Number(barrier![1]) % 7).toBe(0);

			// 与ダメージは 1 発ずつ 7 の倍数
			expect(dealt.length).toBeGreaterThan(0);
			for (const d of dealt) expect(d % 7).toBe(0);

			// 全力の一撃は 777 以上なら …777 で終わる
			for (const f of final) {
				if (f >= 777) expect(String(f)).toMatch(/777$/);
			}
		}
	});

	test("結果（ゴールデン）", async () => {
		const results: Record<string, unknown> = {};
		for (const enemy of battleEnemies) {
			for (const seed of [1, 2, 3]) {
				const r = await simulate(build, enemy, seed);
				results[`${enemy.name} #${seed}`] = r ? { summary: summary(r), ...nonEmpty(extractRaidDamages(r.log)) } : "失敗";
			}
		}
		expect(results).toMatchSnapshot();
	});
});

describe("レイドの戦闘結果（ゴールデン・詳細ログ）", () => {
	beforeEach(() => jest.setSystemTime(WEDNESDAY));

	// 詳細ログ（-v）でしか通らない分岐が多いので、ログのハッシュで固定する
	test.each(builds)("%s", async (_name, build) => {
		expect(await runBuild(build, { verbose: true })).toMatchSnapshot();
	});
});

describe("レイドの戦闘結果（ゴールデン・土曜日）", () => {
	beforeEach(() => jest.setSystemTime(SATURDAY));

	test.each(builds)("%s", async (_name, build) => {
		expect(await runBuild(build, { verbose: true })).toMatchSnapshot();
	});
});

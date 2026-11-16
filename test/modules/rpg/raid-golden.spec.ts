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
 * 戦闘ログは全文だと大きすぎるので、ハッシュ値だけを記録する（1文字でも変われば検出できる）。
 */
import * as loki from "lokijs";
import { raidInstall, simulateRaidBattle } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills, skillCalculate } from "@/modules/rpg/skills";
import { builds, buildData as buildPlayerData, hash, seeded } from "#/modules/rpg/golden-helpers";
import type { Build } from "#/modules/rpg/golden-helpers";

const ai: any = {
	account: { id: "bot" },
	moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: () => {} },
	friends: { find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })) },
	lookupFriend: () => null,
	getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
};

const buildData = (b: Build) => buildPlayerData(b, ai);

/** 1構成について、全ボス × seed 1〜3 の結果をまとめる */
const runBuild = async (build: Build, options: { verbose?: boolean } = {}) => {
	const results: Record<string, string> = {};
	for (const enemy of raidEnemys) {
		for (const seed of [1, 2, 3]) {
			const runs = await simulateRaidBattle({ userId: "user-a", username: "a", data: buildData(build), love: build.love ?? 300 }, enemy, { postCount: 40, random: seeded(seed), verbose: options.verbose });
			const r = runs[0];
			results[`${enemy.name} #${seed}`] = r ? `${r.totalDmg} / ${r.count}ターン / ${hash(r.log)}` : "失敗";
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
		expect(await runBuild(build)).toMatchSnapshot();
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

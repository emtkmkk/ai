/**
 * @packageDocumentation
 *
 * 鳩車（コンテスト型のレイド）の器用さ・仕上げのテスト
 *
 * @remarks
 * 器用さ・仕上げは、レイドの戦闘（`getTotalDmg3`）と確認表示（「RPG スキル バフ 鳩車」の `getHatogurumaEffectString`）の
 * 両方で計算する。どちらも出力をスナップショットで固定し、計算をまとめても結果が変わらないことを確かめる。
 *
 * 構成は、器用さ・仕上げに関わる効果を 1 つずつ通るように選んでいる。
 */
import * as loki from "lokijs";
import { raidInstall, simulateRaidBattle } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { getHatogurumaEffectString, skills, skillCalculate } from "@/modules/rpg/skills";
import { builds, buildData, hash, seeded } from "#/modules/rpg/golden-helpers";
import type { Build } from "#/modules/rpg/golden-helpers";

const ai: any = {
	account: { id: "bot" },
	moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: () => {} },
	friends: { find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })) },
	lookupFriend: () => null,
	getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
};

/** 器用さ・仕上げに関わる効果を 1 つずつ通る構成 */
const contestCases: [string, Build][] = [
	["気性穏やか（非戦闘時パワー +70%）", { skills: ["気性穏やか"] }],
	["テキパキこなす（非戦闘時パワー +22%）", { skills: ["テキパキこなす"] }],
	["気性が荒い（非戦闘時パワー -40%）", { skills: ["気性が荒い"] }],
	["疲れにくい・かるわざ（お守りなし）・高速RPG・安定感・準備", { skills: ["疲れにくい", "かるわざ", "高速RPG", "与ダメージ安定感5", "準備を怠らない"] }],
	["道具・仕上げ系", { skills: ["道具の扱いが上手い", "道具の選択が上手い", "連続攻撃完遂率上昇", "粘り強い", "気合で頑張る"], amulet: "交通安全のお守り" }],
	["鳩車の経験あり", { skills: ["パワーアップ"], extra: { hatogurumaExp: 20 } }],
	["パワーが高すぎる（有り余るパワー）", { skills: ["パワーアップ"], extra: { atk: 3600, def: 960 } }],
	["ステータス逆転の色でパワーが低い", { skills: ["パワーアップ"], extra: { atk: 960, def: 3600, color: 8, clearHistory: [":mk_hero_8p:"] } }],
	["Lv170 未満（「なし」の行を出さない）", { skills: ["パワーアップ"], extra: { lv: 120, atk: 456, def: 456 } }],
	["スキルなし", { skills: [] }],
];

const allCases = [...contestCases, ...builds];

const hatoguruma = raidEnemys.find((e) => e.pattern === 3)!;

beforeAll(() => {
	jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
	jest.setSystemTime(new Date(2026, 8, 9, 12));
	jest.spyOn(console, "log").mockImplementation(() => {});
	skillCalculate(ai, true);
	raidInstall(ai, { name: "rpg", log: () => {} } as any, new loki("test").addCollection<any>("raids") as any);
});
afterAll(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe("確認表示（RPG スキル バフ 鳩車）", () => {
	test.each(allCases)("%s", (_name, build) => {
		expect(getHatogurumaEffectString(buildData(build, ai))).toMatchSnapshot();
	});

	test.each(allCases)("スキル効果3倍: %s", (_name, build) => {
		expect(getHatogurumaEffectString(buildData(build, ai), 3)).toMatchSnapshot();
	});
});

describe("鳩車レイドの結果（ゴールデン）", () => {
	// 詳細ログ（-v）では基本の器用さと最終的な器用さ・仕上げも出るので、両方で固定する
	test.each(contestCases)("%s", async (_name, build) => {
		const results: Record<string, string> = {};
		for (const verbose of [false, true]) {
			for (const seed of [1, 2, 3]) {
				const [r] = await simulateRaidBattle({ userId: "user-a", username: "a", data: buildData(build, ai), love: build.love ?? 300 }, hatoguruma, { postCount: 40, random: seeded(seed), verbose });
				results[`${verbose ? "詳細ログ " : ""}#${seed}`] = r ? `${r.totalDmg} / ${hash(r.log)}` : "失敗";
			}
		}
		expect(results).toMatchSnapshot();
	});
});

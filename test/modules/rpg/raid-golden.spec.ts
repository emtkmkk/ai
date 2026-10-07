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
import * as crypto from "crypto";
import { raidInstall, simulateRaidBattle } from "@/modules/rpg/raid";
import { raidEnemys } from "@/modules/rpg/enemys";
import { skills, skillCalculate } from "@/modules/rpg/skills";
import { mergeSkillAmulet } from "@/modules/rpg/shop";

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

const ai: any = {
	account: { id: "bot" },
	moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: () => {} },
	friends: { find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })) },
	lookupFriend: () => null,
	getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
};

const skill = (name: string) => {
	const s = skills.find((x) => x.name === name);
	if (!s) throw new Error(`スキルが見つかりません: ${name}`);
	return { ...s };
};

type Build = { skills: string[]; amulet?: string | string[]; tokens?: string[]; super?: boolean; love?: number; extra?: Record<string, any> };

const builds: [string, Build][] = [
	["ベテラン5スキル + 究極", { skills: ["分散型", "高速RPG", "継戦融合武装", "慎重", "準備を怠らない"], amulet: "究極のお守り", super: true, love: 600 }],
	["武器型 + 超越（覚醒変更 朱）", { skills: ["武器が大好き", "雷属性剣攻撃", "クリティカル性能上昇", "継戦融合武装", "準備を怠らない"], amulet: "超越のお守り", tokens: ["覚醒変更の札（朱）"], super: true, love: 600 }],
	["お守り整備×5 + 雷水入りカスタム", { skills: ["お守り整備", "お守り整備", "お守り整備", "お守り整備", "お守り整備"], amulet: ["連続攻撃完遂率上昇", "雷属性剣攻撃", "水属性剣攻撃", "クリティカル性能上昇", "防御貫通+10%", "風属性剣攻撃"], super: true, love: 1000 }],
	["罪スキル + 食べ物型", { skills: ["食いしんぼう", "お腹が空いてから食べる", "道具大好き", "道具の扱いが上手い", "粘り強い"], amulet: ["暴食の力", "傲慢の力", "怠惰の力", "強欲の力"], love: 300 }],
	["７フィーバー×5 + バーサク等", { skills: ["７フィーバー！", "７フィーバー！", "７フィーバー！", "７フィーバー！", "７フィーバー！"], amulet: ["バーサク", "スロースタート", "超全力の一撃", "嫉妬の力", "憤怒の力"], love: 200 }],
	["天国か地獄か・不運チャージ + しあわせのお守り", { skills: ["天国か地獄か", "不運チャージ", "負けそうなら逃げる", "攻めの守勢", "毒属性剣攻撃"], amulet: "しあわせのお守り", tokens: ["全身全霊のお札"], love: 100 }],
	["謎のお守り（発動しやすい状態）", { skills: ["光属性剣攻撃", "闇属性剣攻撃", "氷属性剣攻撃", "土属性剣攻撃"], amulet: "謎のお守り", love: 400, extra: { stockRandomCount: 30 } }],
	["わかば・スキル少なめ", { skills: ["パワーアップ"], amulet: "わかばのお守り", love: 0 }],
];

const buildData = (b: Build) => {
	const items: any[] = (b.tokens ?? []).map((name) => ({ name, type: "token" }));
	if (typeof b.amulet === "string") items.push({ name: b.amulet, type: "amulet", durability: 10 });
	if (Array.isArray(b.amulet)) {
		const m: any = mergeSkillAmulet(ai, () => 0.5, b.amulet.map(skill));
		items.push({ name: m.name, type: "amulet", skillName: m.skillName, durability: 30 });
	}
	return {
		lv: 600, atk: 2280, def: 2280, exp: 0, coin: 0,
		skills: b.skills.map(skill), items,
		clearHistory: [], raidScore: {}, superPoint: -3, noAmuletCount: -999, charge: 0, stockRandomCount: 0,
		color: b.super ? 9 : 1, superCount: b.super ? 200 : 0, atkMedal: 10, defMedal: 10, itemMedal: 10,
		...(b.extra ?? {}),
	};
};

const hash = (text: string) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);

describe("レイドの戦闘結果（ゴールデン）", () => {
	beforeAll(() => {
		jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
		jest.setSystemTime(new Date(2026, 8, 9, 12)); // 2026/9/9 = 水曜日
		jest.spyOn(console, "log").mockImplementation(() => {});
		skillCalculate(ai, true);
		raidInstall(ai, { name: "rpg", log: () => {} } as any, new loki("test").addCollection<any>("raids") as any);
	});
	afterAll(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test.each(builds)("%s", async (_name, build) => {
		const results: Record<string, string> = {};
		for (const enemy of raidEnemys) {
			for (const seed of [1, 2, 3]) {
				const runs = await simulateRaidBattle({ userId: "user-a", username: "a", data: buildData(build), love: build.love ?? 300 }, enemy, { postCount: 40, random: seeded(seed) });
				const r = runs[0];
				results[`${enemy.name} #${seed}`] = r ? `${r.totalDmg} / ${r.count}ターン / ${hash(r.log)}` : "失敗";
			}
		}
		expect(results).toMatchSnapshot();
	});
});

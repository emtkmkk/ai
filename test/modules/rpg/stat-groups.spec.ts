/**
 * @packageDocumentation
 *
 * ステータス上昇のグループ（同じグループは足し算、違うグループは掛け算）のテスト
 *
 * @remarks
 * aggregateSkillsEffects が最後に作るパワー・防御・与ダメージ・被ダメージの倍率と、確認表示（RPG スキル バフ）を、
 * グループに関わる構成ごとに固定する。数値は小数の最後の桁まで記録する（足す順・掛ける順が変わっても検出できる）。
 * スキル効果 3 倍（ユニークスキルは 1 倍のまま補填が入る）も確かめる。
 */
import { aggregateSkillsEffects, getTotalEffectString, skills, skillCalculate } from "@/modules/rpg/skills";
import { buildData } from "#/modules/rpg/golden-helpers";
import type { Build } from "#/modules/rpg/golden-helpers";

const ai: any = {
	account: { id: "bot" },
	moduleData: { findOne: () => ({ type: "rpg", maxLv: 255 }), update: () => {} },
	friends: { find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })) },
	lookupFriend: () => null,
	getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }),
};

const cases: [string, Build][] = [
	["伝説（ユニーク）", { skills: ["伝説"] }],
	["伝説 + 連続・毎日ボーナス強化（同じグループ）", { skills: ["伝説", "連続・毎日ボーナス強化"] }],
	["気合で頑張る ×2（同じスキル）", { skills: ["気合で頑張る", "気合で頑張る"] }],
	["違うグループ（不運チャージ・かるわざ・気性が荒い・すぐ決死の覚悟をする）", { skills: ["不運チャージ", "かるわざ", "気性が荒い", "すぐ決死の覚悟をする"] }],
	["気性穏やか（マイナスのグループ）", { skills: ["気性穏やか", "パワーアップ"] }],
	["共通のグループ（パワーアップ・防御アップ・脳筋・慎重）", { skills: ["パワーアップ", "防御アップ", "脳筋", "慎重"] }],
	["パワーアップ + 呪いの人形（共通のグループ）", { skills: ["パワーアップ"], amulet: "呪いの人形" }],
	["究極のお守り + 伝説・気合で頑張る・不運チャージ", { skills: ["伝説", "気合で頑張る", "不運チャージ"], amulet: "究極のお守り" }],
	["合成お守り [気合で頑張る・不運チャージ] + 気合で頑張る", { skills: ["気合で頑張る"], amulet: ["気合で頑張る", "不運チャージ"] }],
	["お守り整備 ×2 + 合成お守り [気合で頑張る・すぐ決死の覚悟をする]", { skills: ["お守り整備", "お守り整備"], amulet: ["気合で頑張る", "すぐ決死の覚悟をする"] }],
	["かるわざ（お守りなし）+ 分散型", { skills: ["かるわざ", "分散型"] }],
];

beforeAll(() => {
	skillCalculate(ai, true);
});
beforeEach(() => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date(2026, 8, 7, 12)); // 2026/9/7 = 月曜日
	jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe("集計したステータスの倍率", () => {
	test.each(cases)("%s", (_name, build) => {
		const result: Record<string, unknown> = {};
		for (const skillX of [1, 3]) {
			const data = { ...buildData(build, ai), raid: true };
			const e = aggregateSkillsEffects(data, skillX);
			result[`${skillX}倍`] = { atkUp: e.atkUp, defUp: e.defUp, atkDmgUp: e.atkDmgUp, defDmgUp: e.defDmgUp };
		}
		expect(result).toMatchSnapshot();
	});
});

describe("グループの仕組み", () => {
	const aggregate = (skillList: any[]) => aggregateSkillsEffects({ lv: 100, skills: skillList, items: [] });

	test("古い保存データの番号付きのキー（atkUp2 など）は、グループ名入りのキーと同じに扱う", () => {
		// 今のスキル一覧にないスキルは、保存されている効果がそのまま使われる
		const legacy = aggregate([{ name: "削除済みのスキル", effect: { atkUp2: 0.08, defUp2: 0.08 } }]);
		const current = aggregate([{ name: "削除済みのスキル", effect: { "atkUp:legend": 0.08, "defUp:legend": 0.08 } }]);
		expect(legacy.atkUp).toBe(current.atkUp);
		expect(legacy.defUp).toBe(current.defUp);
		// 伝説と同じグループなので足し算になる
		const withLegend = aggregate([{ name: "削除済みのスキル", effect: { atkUp2: 0.05 } }, { ...skills.find((s) => s.name === "伝説") }]);
		expect(withLegend.atkUp).toBeCloseTo(1 + 0.08 + 0.05 - 1);
	});

	test("新しいグループ名のキーを書くだけで、ほかのグループと掛け算になる", () => {
		const e = aggregate([{ name: "新しいスキル", effect: { "atkUp:newGroup": 0.1 } }, { ...skills.find((s) => s.name === "パワーアップ") }]);
		expect(e.atkUp).toBeCloseTo(1.11 * 1.1 - 1);
	});

	test("同じグループ名なら、別のスキルでも足し算になる", () => {
		const e = aggregate([{ name: "スキルA", effect: { "atkUp:newGroup": 0.1 } }, { name: "スキルB", effect: { "atkUp:newGroup": 0.2 } }]);
		expect(e.atkUp).toBeCloseTo(0.3);
	});
});

describe("確認表示（RPG スキル バフ）", () => {
	test.each(cases)("%s", (_name, build) => {
		expect({ "1倍": getTotalEffectString(buildData(build, ai)), "3倍": getTotalEffectString(buildData(build, ai), 3) }).toMatchSnapshot();
	});
});

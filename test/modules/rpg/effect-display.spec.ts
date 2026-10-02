/**
 * @packageDocumentation
 *
 * スキル効果の確認表示（getTotalEffectString）のスナップショットテスト
 *
 * @remarks
 * 表示処理を作り替えても出力が変わらないことを確認するため、代表的な構成の表示を記録しておく。
 * 表示を意図して変えた場合は、スナップショットを更新する（jest -u）。
 *
 * - 全スキルを1つずつ持たせた構成（各スキルの行を網羅する）
 * - 乱数系・お守り・曜日のお守り・カスタムお守りなどの組み合わせ
 * - 覚醒変更の札・超覚醒・行動加速などのお札、勲章、ステータス逆転の色、スキル効果3倍
 *
 * 属性の効果量は曜日で変わるため、日付を月曜日に固定する。
 */
import { getTotalEffectString, skills, skillCalculate } from "@/modules/rpg/skills";
import { mergeSkillAmulet } from "@/modules/rpg/shop";

/** パーツの値段（スキルの所持人数から決まる）に使う、テスト用の所持者 */
const ai: any = {
	friends: {
		find: () => skills.filter((s) => !s.moveTo).map((s) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name: s.name }] } } })),
	},
};

const skill = (name: string) => {
	const s = skills.find((x) => x.name === name);
	if (!s) throw new Error(`スキルが見つかりません: ${name}`);
	return { ...s };
};

type Build = {
	skills?: string[];
	amulet?: string | string[];
	tokens?: string[];
	color?: number;
	superCount?: number;
	medal?: number;
	lv?: number;
};

const buildData = (b: Build) => {
	const items: any[] = (b.tokens ?? []).map((name) => ({ name, type: "token" }));
	if (typeof b.amulet === "string") items.push({ name: b.amulet, type: "amulet", durability: 10 });
	if (Array.isArray(b.amulet)) {
		const m: any = mergeSkillAmulet(ai, () => 0.5, b.amulet.map(skill));
		items.push({ name: m.name, type: "amulet", skillName: m.skillName, durability: 30 });
	}
	return {
		lv: b.lv ?? 300,
		atk: 1000,
		def: 1000,
		skills: (b.skills ?? []).map(skill),
		items,
		color: b.color ?? 1,
		superCount: b.superCount ?? 0,
		clearHistory: b.color === 8 ? [":mk_hero_8p:"] : [],
		atkMedal: b.medal ?? 0,
		defMedal: b.medal ?? 0,
		itemMedal: b.medal ?? 0,
	};
};

const SUPER = { color: 9, superCount: 200 };

const singleSkillCases: [string, Build][] = skills
	.filter((s) => !s.moveTo)
	.map((s) => [`スキル単体: ${s.name}`, { skills: [s.name] }]);

const comboCases: [string, Build][] = [
	["スキルなし", {}],
	["乱数系: 与ダメージ安定感5", { skills: ["与ダメージ安定感5", "パワーアップ"] }],
	["乱数系: 被ダメージ不安定 + 運命不変のお札", { skills: ["被ダメージ不安定"], tokens: ["運命不変のお札"] }],
	["お守り整備×4 + 究極のお守り", { skills: ["油断しない", "お守り整備", "お守り整備", "お守り整備", "お守り整備"], amulet: "究極のお守り" }],
	["カスタムお守り（5パーツ）", { skills: ["分散型", "高速RPG", "継戦融合武装", "慎重", "準備を怠らない"], amulet: ["炎属性剣攻撃", "雷属性剣攻撃", "脳筋", "クリティカル性能上昇", "パワーアップ"] }],
	["曜日のお守り（罪スキル入り）", { skills: ["分散型"], amulet: ["憤怒の力", "クリティカル性能上昇", "天国か地獄か", "投稿数ボーナス量アップ"] }],
	["上位構成: 武器型 + 究極", { skills: ["準備を怠らない", "道具大好き", "継戦融合武装", "武器が大好き", "分散型"], amulet: "究極のお守り" }],
	["上位構成: 速散数粘急 + 究極", { skills: ["高速RPG", "分散型", "数取りの達人", "粘り強い", "クリティカル性能上昇"], amulet: "究極のお守り" }],
	["食べ物型 + 暴食", { skills: ["食いしんぼう", "お腹が空いてから食べる", "道具大好き", "道具の扱いが上手い", "粘り強い"], amulet: ["暴食の力"] }],
	["属性全部 + 水", { skills: ["炎属性剣攻撃", "氷属性剣攻撃", "雷属性剣攻撃", "風属性剣攻撃", "水属性剣攻撃"], amulet: ["土属性剣攻撃", "光属性剣攻撃", "闇属性剣攻撃", "毒属性剣攻撃"] }],
	["虹色のお守り", { skills: ["炎属性剣攻撃", "氷属性剣攻撃", "雷属性剣攻撃"], amulet: "虹色のお守り" }],
	["超越のお守り", { skills: ["分散型"], amulet: "超越のお守り" }],
	["わかばのお守り", { skills: ["パワーアップ"], amulet: "わかばのお守り" }],
	["謎のお守り", { skills: ["パワーアップ", "粘り強い"], amulet: "謎のお守り" }],
	["バーサク / スロースタート / しあわせのお守り", { skills: ["パワーアップ"], amulet: ["バーサク", "スロースタート", "超全力の一撃"] }],
	["常時覚醒", { skills: ["パワーアップ", "道具の扱いが上手い"], ...SUPER }],
	["常時覚醒 + 覚醒変更の札（朱）", { skills: ["クリティカル性能上昇"], tokens: ["覚醒変更の札（朱）"], ...SUPER }],
	["常時覚醒 + 覚醒変更の札（橙）", { skills: ["慎重"], tokens: ["覚醒変更の札（橙）"], ...SUPER }],
	["常時覚醒 + 覚醒変更の札（蒼）", { skills: ["慎重"], tokens: ["覚醒変更の札（蒼）"], ...SUPER }],
	["常時覚醒 + 覚醒変更の札（翠）", { skills: ["道具大好き", "道具の扱いが上手い"], tokens: ["覚醒変更の札（翠）"], ...SUPER }],
	["常時覚醒 + 超覚醒の札", { skills: ["投稿数ボーナス量アップ"], tokens: ["超覚醒の札"], ...SUPER }],
	["行動加速のお札 / 全身全霊のお札 / しあわせのお札", { skills: ["パワーアップ"], tokens: ["行動加速のお札", "全身全霊のお札", "しあわせのお札"] }],
	["勲章各10", { skills: ["パワーアップ"], medal: 10 }],
	["ステータス逆転の色", { skills: ["パワーアップ"], color: 8 }],
	["Lv255超（炎の上限）", { skills: ["炎属性剣攻撃"], lv: 2000 }],
	["重複: 慎重×3（被ダメージ軽減の下限）", { skills: ["慎重", "慎重", "慎重"] }],
	["重複: 油断しない×3（ターン1無効）", { skills: ["油断しない", "油断しない", "油断しない"] }],
	["重複: 粘り強い×5（ピンチ軽減の上限）", { skills: ["粘り強い", "粘り強い", "粘り強い", "粘り強い", "粘り強い"] }],
];

describe("getTotalEffectString", () => {
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

	test.each([...singleSkillCases, ...comboCases])("%s", (_name, build) => {
		expect(getTotalEffectString(buildData(build))).toMatchSnapshot();
	});

	test.each(comboCases.slice(0, 8))("スキル効果3倍: %s", (_name, build) => {
		expect(getTotalEffectString(buildData(build), 3)).toMatchSnapshot();
	});

	describe("数取りの達人（現在の効果量をパワー・防御に合算）", () => {
		const kazutoriAi: any = { getCollection: () => ({ chain() { return this; }, find() { return this; }, where() { return { data: () => [] }; } }) };
		const msgWith = (kazutoriData: any) => ({ userId: "u", friend: { doc: { kazutoriData }, save: () => {} } }) as any;

		test("直近24時間に参加・勝利していれば、パワー+12%・防御+8%を合算する", () => {
			const now = Date.now();
			const text = getTotalEffectString(buildData({ skills: ["数取りの達人"] }), 1, kazutoriAi, msgWith({ lastPlayedAt: now, lastWinAt: now }));
			expect(text).toContain("パワー: +12%");
			expect(text).toContain("防御: +8%");
			expect(text).not.toContain("数取りの達人");
		});

		test("ほかのパワーアップと足し算で合算する（戦闘時と同じ）", () => {
			const now = Date.now();
			const text = getTotalEffectString(buildData({ skills: ["数取りの達人", "パワーアップ"] }), 1, kazutoriAi, msgWith({ lastPlayedAt: now, lastWinAt: 0 }));
			// パワーアップ 11% に 数取りの参加分 5% を足す
			expect(text).toContain("パワー: +16%");
		});

		test("効果がない場合はパワー・防御に何も足さない", () => {
			const text = getTotalEffectString(buildData({ skills: ["数取りの達人"] }), 1, kazutoriAi, msgWith({ lastPlayedAt: 0, lastWinAt: 0 }));
			expect(text).not.toContain("パワー:");
			expect(text).not.toContain("防御:");
		});

		test("数取りの達人を持っていなければ合算しない", () => {
			const now = Date.now();
			const text = getTotalEffectString(buildData({ skills: ["パワーアップ"] }), 1, kazutoriAi, msgWith({ lastPlayedAt: now, lastWinAt: now }));
			expect(text).toContain("パワー: +11%");
		});
	});
});

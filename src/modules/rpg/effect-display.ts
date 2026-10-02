/**
 * @packageDocumentation
 *
 * スキル効果の確認表示（「RPG スキル 確認」）の定義表
 *
 * @remarks
 * 効果ごとに「どう表示するか」を {@link effectDisplay} に1件ずつ書く。
 * `Record<keyof SkillEffect, ...>` なので、SkillEffect に効果を足して定義を書き忘れると型エラーになる。
 *
 * 効果の表示方法は次のどれか（組み合わせ可）:
 * - `lines`  : その効果だけで作る行（order は表示順）
 * - `stats`  : 「パワー」「防御」などの共通の行への寄与（掛け算で集める）
 * - `partOf` : 複数の効果を組み合わせて作る行の一部（行は {@link groupDisplay} で作る）
 * - `merged` : 集計時にほかの効果にまとめられるので、単独では表示しない
 * - `notShown` : 意図して表示していない（理由を書く。「表示不要」は確認画面に出す必要がないと判断したもの）
 *
 * 表示順は order の小さい順。スキル以外から来る行（勲章・色・お札など）は {@link groupDisplay} にある。
 *
 * @internal
 */
import type { SkillEffect } from "./skill-data";

/** 表示処理に渡す情報 */
export type EffectDisplayContext = {
	/** 集計済みのスキル効果（覚醒変更の札などの補正も反映済み） */
	e: SkillEffect;
	/** RPG のプレイヤーデータ */
	data: any;
	/** 所持しているお札の効果 */
	tokens: Record<string, any>;
	/** 常時覚醒か */
	isSuper: boolean;
	/** 色によるステータス逆転があるか */
	reverseStatus: boolean;
	/** 数取りの達人の現在の効果量（確認コマンドから呼ばれた場合のみ） */
	kazutoriBonus?: { atk: number; def: number };
	/** 共通の行の値（stats を掛け算で集めた結果。1 が「補正なし」） */
	stats: Record<StatKey, number>;
};

/** 共通の行の種類 */
export type StatKey = "atk" | "atkLow" | "def" | "defLow" | "spd" | "bAtk" | "bDef" | "bSpd" | "nbAtk" | "nbDef" | "eAtk" | "eDef";

/** 複数の効果やスキル以外の情報から作る行の種類 */
type GroupName =
	| "パワー" | "戦闘時パワー" | "非戦闘時パワー" | "防御" | "戦闘時防御" | "非戦闘時防御" | "ステータス逆転"
	| "行動回数" | "戦闘時行動回数" | "行動回数圧縮" | "最大体力" | "敵パワー減少" | "敵防御減少"
	| "与ダメージ" | "与ダメージ乱数" | "被ダメージ" | "被ダメージ乱数" | "道具効果量" | "アイテム気合低下率"
	| "覚醒投稿数ボーナス" | "最低行動回数保障" | "ランダムステータス" | "お守り耐久減少率" | "合計効果";

type EffectLine = { order: number; text: (v: number, ctx: EffectDisplayContext) => string[] };

type EffectDisplay = {
	lines?: EffectLine[];
	stats?: Partial<Record<StatKey, (v: number, ctx: EffectDisplayContext) => number>>;
	partOf?: GroupName;
	merged?: keyof SkillEffect;
	notShown?: string;
};

/** 小数第1位で四捨五入 */
const showNum = (num: number) => Math.round(num * 10) / 10;
/** v を % 表記にした数値（小数第1位まで） */
const pct = (v: number) => showNum(v * 100);
/** 1つの行 */
const line = (order: number, text: (v: number, ctx: EffectDisplayContext) => string | string[]): EffectLine[] => [
	{ order, text: (v, ctx) => [text(v, ctx)].flat() },
];
/** パワーアップの合計（パワーアップ + お守りなしのかるわざ + 数取りの達人の現在の効果。戦闘時の calculateStats と同じ足し方） */
const atkUpTotal = (v: number, { e, data, kazutoriBonus }: EffectDisplayContext) =>
	v + (data.items?.some((y) => y.type === "amulet") ? 0 : (e.noAmuletAtkUp ?? 0)) + (kazutoriBonus?.atk ?? 0);
/** 重ね掛けの回数表示（1 のときは付けない） */
const times = (v: number) => (v !== 1 ? ` ×${showNum(v)}` : "");

/**
 * 効果ごとの表示定義
 *
 * @remarks
 * stats は掛け算なので、効果の値が 0 のときに 1 を返すように書く（効果を持っていない場合も呼ばれる）。
 */
export const effectDisplay: Record<keyof SkillEffect, EffectDisplay> = {
	atkUp: {
		// お守りを持っていない場合のかるわざの効果と、数取りの達人の現在の効果は、戦闘時と同じくパワーアップに足し算する
		stats: {
			atk: (v, ctx) => 1 + atkUpTotal(v, ctx),
			atkLow: (v, ctx) => 1 + atkUpTotal(v, ctx),
		},
	},
	atkUp2: { merged: "atkUp" },
	atkUp3: { merged: "atkUp" },
	atkUp4: { merged: "atkUp" },
	atkUp5: { merged: "atkUp" },
	atkUp6: { merged: "atkUp" },
	atkUpBonus: { merged: "atkUp" },
	defUp: {
		// 数取りの達人の現在の効果は、戦闘時と同じく防御アップに足し算する
		stats: {
			def: (v, { kazutoriBonus }) => 1 + v + (kazutoriBonus?.def ?? 0),
			defLow: (v, { kazutoriBonus }) => 1 + v + (kazutoriBonus?.def ?? 0),
		},
	},
	defUp2: { merged: "defUp" },
	defUp3: { merged: "defUp" },
	defUp4: { merged: "defUp" },
	defUp5: { merged: "defUp" },
	fire: {
		lines: [
			...line(35, (v, { data }) => "非戦闘時パワー: +" + showNum(data.lv * 3.75 * v)),
			...line(230, (v, { data }) => "戦闘時ダメージ追加: +" + Math.ceil(Math.min(data.lv, 255) * v)),
		],
	},
	ice: {
		lines: line(550, (v) => "戦闘時凍結率: " + pct(v) + "%"),
		stats: { nbDef: (v) => 1 + v },
	},
	thunder: { partOf: "与ダメージ" },
	spdUp: { stats: { bSpd: (v) => 1 + v, nbAtk: (v) => 1 + v } },
	dart: {
		lines: line(530, (v) => "ターン内最大ダメージ: +" + pct(v) + "%"),
		stats: { atk: (v) => 1 + v * 0.5 },
	},
	light: {
		lines: line(560, (v) => "戦闘時被ダメージ半減率: " + pct(v) + "%"),
		stats: { nbDef: (v) => 1 + v * 0.5 },
	},
	dark: {
		lines: line(570, (v) => ["戦闘時敵行動回数低下率: " + pct(v * 2) + "%", "戦闘時固定ダメージ付与率: " + pct(v) + "%"]),
		stats: { nbDef: (v) => 1 + v * 0.7 },
	},
	weak: {
		// 敵パワーは 0 まで、敵防御は元の 40% までしか下がらない
		stats: {
			eAtk: (v) => Math.max(1 - (1 - 1 / (1 + v * 1.125)), 0),
			eDef: (v) => Math.max(1 - (1 - 1 / (1 + v * 1.125)), 0.4),
		},
	},
	water: { notShown: "表示不要（炎属性の敵への与ダメージアップ・炎ダメージのカット）" },
	notBattleBonusAtk: { stats: { nbAtk: (v) => 1 + v } },
	notBattleBonusDef: { stats: { nbDef: (v) => 1 + v } },
	firstTurnResist: {
		lines: line(250, (v) => (v > 1 ? ["ターン1ダメージ無効", "ターン2ダメージ軽減: " + pct(v - 1) + "%"] : ["ターン1ダメージ軽減: " + pct(v) + "%"])),
	},
	tenacious: {
		lines: line(260, (v) => (v > 0.9
			? ["ピンチダメージ軽減: 最大90%", "（体力" + showNum((1 - (0.9 / v)) * 100) + "%で効果最大）"]
			: ["ピンチダメージ軽減: 最大" + pct(v) + "%"])),
	},
	plusActionX: {
		lines: line(660, (v) => "通常時RPG進行数: ×" + (showNum(v) + 1)),
		stats: { atk: (v) => 1 + v / 10 },
	},
	atkDmgUp: { partOf: "与ダメージ" },
	atkDmgUp2: { merged: "atkDmgUp" },
	defDmgUp: { partOf: "被ダメージ" },
	defDmgUp2: { merged: "defDmgUp" },
	continuousBonusUp: { notShown: "表示不要（連続・毎日ボーナスの増加量）" },
	escape: { lines: line(610, (v) => `負けそうな時逃げる${times(v)}`) },
	endureUp: { lines: line(120, (v) => `気合: +${pct(v)}%`) },
	haisuiUp: {
		lines: line(340, (v) => ["決死の覚悟効果量: +" + pct(v) + "%", "決死の覚悟発動体力: " + showNum((1 / 7) * (1 + v) * 100) + "%以下"]),
	},
	postXUp: { stats: { atk: (v) => 1 + v * 10, def: (v) => 1 + v * 10 } },
	enemyStatusBonus: {
		stats: {
			atk: (v) => 1 + Math.floor(10 * v) / 100,
			def: (v) => 1 + Math.floor(10 * v) / 100,
		},
	},
	arpen: {
		// 敵防御は元の 40% までしか下がらない
		stats: { eDef: (v) => Math.max(1 - (1 - 1 / (1 + v)), 0.4) },
	},
	atkRndMin: { partOf: "与ダメージ乱数" },
	atkRndMax: { partOf: "与ダメージ乱数" },
	defRndMin: { partOf: "被ダメージ乱数" },
	defRndMax: { partOf: "被ダメージ乱数" },
	firstTurnItem: { lines: line(370, () => "ターン1アイテム装備") },
	firstTurnMindMinusAvoid: { notShown: "表示不要（ターン1の悪アイテム回避）" },
	firstTurnItemChoice: { notShown: "表示不要（ターン1の道具の最低効果量）" },
	firstTurnDoubleItem: { notShown: "表示不要（ターン1の二刀流）" },
	itemEquip: { lines: line(380, (v) => "アイテム装備率: +" + pct(v) + "%") },
	itemBoost: {
		partOf: "道具効果量",
		lines: line(470, (v) => "アイテム気合上昇率: +" + pct(v) + "%"),
	},
	amuletPower: { notShown: "お守りの数から自動で付く値（鳩車コンテスト用）" },
	itemAtkStock: { lines: line(390, (v) => "継戦融合武装: アイテム攻撃上昇の" + pct(v) + "%を次ターンへ") },
	weaponSelect: { lines: line(400, () => "武器のみを使用") },
	weaponBoost: { partOf: "道具効果量" },
	armorSelect: { lines: line(410, () => "防具のみを使用") },
	armorBoost: { partOf: "道具効果量" },
	shieldBash: { lines: line(420, () => "シールドバッシュ: 防具防御上昇量に応じてパワー上昇") },
	foodSelect: { lines: line(430, () => "食べ物のみを使用") },
	foodBoost: { partOf: "道具効果量" },
	poisonResist: { partOf: "道具効果量" },
	poisonAvoid: { lines: line(440, (v) => "毒食べ物回避率: " + pct(v) + "%") },
	mindMinusAvoid: { lines: line(450, (v) => "悪アイテム回避率: +" + pct(v) + "%") },
	lowHpFood: { lines: line(490, () => "残体力依存食べ物選択") },
	statusBonus: { notShown: "付与元のスキル・お守りがない" },
	abortDown: {
		lines: line(540, (v) => "連続攻撃中断回避率: +" + pct(v) + "%"),
		stats: { atk: (v) => 1 + v * (1 / 3) },
	},
	critUp: { lines: line(280, (v) => "クリティカル率（割合）: +" + pct(v) + "%") },
	critUpFixed: { lines: line(300, (v) => "クリティカル率（固定）: +" + pct(v) + "%") },
	critDmgUp: { lines: line(310, (v, { e }) => "クリティカルダメージ: +" + showNum((v + (e.wrath ? 0.4 : 0)) * 100) + "%") },
	enemyCritDown: { lines: line(320, (v) => "敵クリティカル率: -" + pct(v) + "%") },
	enemyCritDmgDown: {
		lines: line(330, (v) => "敵クリティカルダメージ: -" + pct(v) + "%"),
		stats: { def: (v) => 1 + v / 4 },
	},
	loseBonus: { notShown: "付与元のスキル・お守りがない（廃止スキルの名残）" },
	sevenFever: {
		lines: line(600, (v) => ["与ダメージ７の倍数化", `７ステータスダメージ軽減${times(v)}`]),
		stats: { atk: (v) => 1 + (7 * v) / 100, def: (v) => 1 + (7 * v) / 100 },
	},
	charge: { lines: line(620, (v) => `不運チャージ${times(v)}`) },
	transcendence: { notShown: "表示不要（超越のお守り）" },
	enemyBuff: { stats: { atk: (v) => 1 + v / 20, def: (v) => 1 + v / 20 } },
	allForOne: {
		partOf: "行動回数圧縮",
		stats: { atk: (v) => 1 + v * 0.1, atkLow: (v) => 1 + v * 0.1 },
	},
	amuletBoost: { partOf: "お守り耐久減少率" },
	priceOff: { lines: line(680, (v) => "ショップ割引率: " + pct(v) + "%") },
	heavenOrHell: {
		stats: {
			atk: (v) => 1 + v,
			def: (v) => 1 + v,
			atkLow: (v) => 1 / (1 + v),
			defLow: (v) => 1 / (1 + v),
		},
	},
	notRandom: { partOf: "与ダメージ乱数" },
	fortuneEffect: { partOf: "ランダムステータス" },
	finalAttackUp: { lines: line(350, (v) => "全力の一撃ダメージ: +" + pct(v) + "%") },
	berserk: {
		lines: line(520, (v) => "毎ターン体力減少: " + pct(v) + "%"),
		stats: { atk: (v) => 1 + v * 1.6 },
	},
	slowStart: { lines: line(650, (v) => `スロースタート${times(v)}`) },
	stockRandomEffect: { notShown: "表示不要（謎のお守り）" },
	// 数取りの直近の参加・勝利で決まる現在の効果量を、パワー・防御の行に合算する（atkUp / defUp を参照）
	kazutoriMaster: { merged: "atkUp" },
	noAmuletAtkUp: { merged: "atkUp" },
	haisuiAtkUp: { lines: line(210, (v) => "覚悟与ダメージ増加: +" + pct(v) + "%") },
	haisuiCritUp: { lines: line(290, (v) => "覚悟クリティカル率（割合）: +" + pct(v) + "%") },
	rainbow: { notShown: "表示不要（全ての属性が曜日に関係なく強化される）" },
	guardAtkUp: { lines: line(360, (v) => `がまんパワーアップ${v > 1 ? ` ×${showNum(v)}` : ""}`) },
	distributed: { merged: "atkUp" },
	beginner: { merged: "atkUp" },
	pride: { notShown: "表示不要（傲慢の力）" },
	greed: { notShown: "表示不要（強欲の力）" },
	envy: { notShown: "表示不要（嫉妬の力）" },
	wrath: { lines: line(510, () => "開始時体力半減") },
	lust: { notShown: "付与元のスキル・お守りがない" },
	gluttony: { notShown: "表示不要（暴食の力）" },
	sloth: { notShown: "表示不要（怠惰の力）" },
	noCrit: { notShown: "表示不要（クリティカルの代わりにダメージアップ）" },
};

/** 共通の行の値から行を作る（符号の付け方は元の表示に合わせる） */
const signed = (label: string, v: number) => (v >= 0 ? `${label}: +${pct(v)}%` : `${label}: ${pct(v)}%`);
/** 「+10% ～ +20%」のように下限が違う場合の前置き */
const lowText = (low: number, v: number) => (low !== v ? (low >= 0 ? "+" + pct(low) + "% ～ " : pct(low) + "% ～ ") : "");

/** 乱数幅（与ダメージ・被ダメージ） */
const rnd = (e: SkillEffect) => ({
	atkMin: Math.max(0.2 + (e.atkRndMin ?? 0), 0),
	atkMax: Math.max(1.6 + (e.atkRndMax ?? 0), 0),
	defMin: Math.max(0.2 + (e.defRndMin ?? 0), 0),
	defMax: Math.max(1.6 + (e.defRndMax ?? 0), 0),
});
/** 与ダメージ倍率（負の場合は下限あり）と雷 */
const dmgBonusOf = (e: SkillEffect) => {
	const atkMinusMin = e.atkDmgUp && e.atkDmgUp < 0 ? (1 / (-1 + (e.atkDmgUp ?? 0)) * -1) : 1;
	return ((Math.max(1 + (e.atkDmgUp ?? 0), atkMinusMin)) * 1) * (1 + ((e.thunder ?? 0) / 2)) - 1;
};
/** 被ダメージ倍率（負の場合は下限あり） */
const defDmgXOf = (e: SkillEffect) => {
	const defMinusMin = e.defDmgUp && e.defDmgUp < 0 ? (1 / (-1 + (e.defDmgUp ?? 0)) * -1) : 1;
	return (Math.max(1 + (e.defDmgUp ?? 0), defMinusMin)) - 1;
};
/** 道具の効果量 */
const itemOf = ({ e, isSuper, tokens }: EffectDisplayContext) => {
	let resist = 1 / (1 + (e.itemBoost ?? 0));
	resist = resist / (1 + (e.poisonResist ?? 0));
	if (isSuper && !tokens.redMode) resist = resist / 2;
	return {
		atk: (1 + (e.itemBoost ?? 0)) * (1 + (e.weaponBoost ?? 0)) - 1,
		def: (1 + (e.itemBoost ?? 0)) * (1 + (e.armorBoost ?? 0)) - 1,
		food: (1 + (e.itemBoost ?? 0)) * (1 + (e.foodBoost ?? 0)) - 1,
		resist: resist - 1,
	};
};

/**
 * 複数の効果を組み合わせた行と、スキル以外から来る行
 */
const groupDisplay: Record<GroupName, { order: number; text: (ctx: EffectDisplayContext) => string[] }> = {
	"パワー": { order: 10, text: ({ stats }) => (stats.atk - 1 ? [`パワー: ${lowText(stats.atkLow - 1, stats.atk - 1)}${stats.atk - 1 >= 0 ? "+" : ""}${pct(stats.atk - 1)}%`] : []) },
	"戦闘時パワー": { order: 20, text: ({ stats }) => (stats.bAtk - 1 ? [signed("戦闘時パワー", stats.bAtk - 1)] : []) },
	"非戦闘時パワー": { order: 30, text: ({ stats }) => (stats.nbAtk - 1 ? [signed("非戦闘時パワー", stats.nbAtk - 1)] : []) },
	"防御": { order: 40, text: ({ stats }) => (stats.def - 1 ? [`防御: ${lowText(stats.defLow - 1, stats.def - 1)}+${pct(stats.def - 1)}%`] : []) },
	"戦闘時防御": { order: 50, text: ({ stats }) => (stats.bDef - 1 ? [`戦闘時防御: +${pct(stats.bDef - 1)}%`] : []) },
	"非戦闘時防御": { order: 60, text: ({ stats }) => (stats.nbDef - 1 ? [`非戦闘時防御: +${pct(stats.nbDef - 1)}%`] : []) },
	"ステータス逆転": { order: 70, text: ({ reverseStatus }) => (reverseStatus ? ["パワー・防御 ステータス逆転"] : []) },
	"行動回数": { order: 80, text: ({ stats }) => (stats.spd - 1 ? [`行動回数: +${pct(stats.spd - 1)}%`] : []) },
	"戦闘時行動回数": { order: 90, text: ({ stats }) => (stats.bSpd - 1 ? [`戦闘時行動回数: +${pct(stats.bSpd - 1)}%`] : []) },
	"行動回数圧縮": { order: 100, text: ({ e, tokens }) => (e.allForOne || tokens.allForOne ? ["行動回数圧縮状態"] : []) },
	"最大体力": { order: 110, text: ({ data }) => (data.defMedal ? ["最大体力: +" + showNum((data.defMedal ?? 0) * 13.4)] : []) },
	"敵パワー減少": { order: 130, text: ({ stats }) => (stats.eAtk - 1 ? ["敵パワー減少: " + pct(stats.eAtk - 1) + "%"] : []) },
	"敵防御減少": { order: 140, text: ({ stats }) => (stats.eDef - 1 ? ["敵防御減少: " + pct(stats.eDef - 1) + "%"] : []) },
	"与ダメージ": {
		order: 200,
		text: ({ e }) => {
			const v = dmgBonusOf(e);
			if (!v) return [];
			return [v > 0 ? "与ダメージ増加: " + pct(v) + "%" : "与ダメージ減少: " + pct(-v) + "%"];
		},
	},
	"与ダメージ乱数": {
		order: 220,
		text: ({ e, tokens }) => {
			const r = rnd(e);
			if (e.notRandom || tokens.notRandom) return ["与ダメージ乱数固定: " + showNum((r.atkMin + r.atkMin + r.atkMax) * 100) * (0.5 + (e.notRandom ?? 0) * 0.05) + "%"];
			if (r.atkMin !== 0.2 || r.atkMax !== 1.6) return ["与ダメージ乱数幅: " + pct(r.atkMin) + "% ～ " + pct(r.atkMin + r.atkMax) + "%"];
			return [];
		},
	},
	"被ダメージ": {
		order: 240,
		text: ({ e }) => {
			const v = defDmgXOf(e);
			if (!v) return [];
			return [v > 0 ? "被ダメージ増加: " + pct(v) + "%" : "被ダメージ軽減: " + pct(-v) + "%"];
		},
	},
	"被ダメージ乱数": {
		order: 270,
		text: ({ e }) => {
			const r = rnd(e);
			return r.defMin !== 0.2 || r.defMax !== 1.6 ? ["被ダメージ乱数幅: " + pct(r.defMin) + "% ～ " + pct(r.defMin + r.defMax) + "%"] : [];
		},
	},
	"道具効果量": {
		order: 460,
		text: (ctx) => {
			const it = itemOf(ctx);
			return [
				it.atk ? "武器効果量: +" + pct(it.atk) + "%" : "",
				it.def ? "防具効果量: +" + pct(it.def) + "%" : "",
				it.food ? "食べ物効果量: +" + pct(it.food) + "%" : "",
				it.resist ? "毒効果量軽減: " + pct(-it.resist) + "%" : "",
			].filter(Boolean);
		},
	},
	"アイテム気合低下率": {
		order: 480,
		text: ({ e, isSuper }) => (e.itemBoost || isSuper ? ["アイテム気合低下率: -" + showNum((1 - (1 / (1 + (e.itemBoost ?? 0))) * (isSuper ? 0.5 : 1)) * 100) + "%"] : []),
	},
	"覚醒投稿数ボーナス": { order: 500, text: ({ isSuper, tokens }) => (isSuper && tokens.hyperMode ? ["覚醒投稿数ボーナス: 無効"] : []) },
	"最低行動回数保障": { order: 630, text: ({ tokens }) => (tokens.fivespd ? ["最低行動回数保障: 5"] : []) },
	"ランダムステータス": {
		order: 640,
		text: ({ e, tokens }) => {
			if (!e.fortuneEffect && !tokens.fortuneEffect) return [];
			const v = e.fortuneEffect ?? 0;
			return [`ランダムステータス${v !== 1 ? v > 1 ? ` ×${showNum(v)}` : `: ${showNum(v)}` : ""}`];
		},
	},
	"お守り耐久減少率": {
		order: 670,
		text: ({ data }) => {
			const boost = data.skills ? data.skills?.filter((x) => x.effect?.amuletBoost).reduce((acc, cur) => acc + (cur.effect?.amuletBoost ?? 0), 0) ?? 0 : 0;
			return boost ? ["お守り耐久減少率: " + showNum((1 / Math.pow(1.5, boost * 2)) * 100) + "%"] : [];
		},
	},
	"合計効果": {
		order: 900,
		text: (ctx) => {
			const { e, data, stats } = ctx;
			const atk = stats.atk - 1, bAtk = stats.bAtk - 1, nbAtk = stats.nbAtk - 1, spd = stats.spd - 1, bSpd = stats.bSpd - 1, eDef = stats.eDef - 1;
			const def = stats.def - 1, bDef = stats.bDef - 1, nbDef = stats.nbDef - 1, eAtk = stats.eAtk - 1;
			const dmgBonus = dmgBonusOf(e);
			const defDmgX = defDmgXOf(e);
			const r = rnd(e);
			const it = itemOf(ctx);
			const out: string[] = [];
			const totalAtk = (1 + atk) * Math.max((1 + bAtk), (1 + nbAtk)) * (1 + (e.haisuiAtkUp ?? 0)) *
				(1 + spd) * (1 + bSpd) * (1 / (1 + eDef)) * (1 + dmgBonus) *
				(((r.atkMin + r.atkMin + r.atkMax)) * (0.5 + (e.notRandom ?? 0) * 0.05)) *
				(1 + ((e.critUpFixed ?? 0) * (1 + (e.critDmgUp ?? 0) * 2))) *
				(
					1 +
					(0.25 * (1 + (e.critUp ?? 0)) * (1 + (e.haisuiCritUp ?? 0)) * (1 + ((e.critDmgUp ?? 0) + (e.wrath ? 0.4 : 0)) * 2)) -
					(0.25 * (1 + ((e.critDmgUp ?? 0) + (e.wrath ? 0.4 : 0)) * 2))
				) *
				(1 + ((e.finalAttackUp ?? 0) / 7)) *
				(1 + (Math.min(0.4 * (e.itemEquip ?? 0) + (e.firstTurnItem ? (1 / 6) : 0), 1) * ((1 + (e.weaponSelect ?? 0)) / (4 + (e.weaponSelect ?? 0) - (e.poisonAvoid ?? 0))) * (0.25 * (1 + it.atk))));
			if (totalAtk > 1) {
				out.push("");
				out.push("合計攻撃効果（最大）: +" + showNum((totalAtk - 1) * 100) + "%");
			}
			const totalDef = (1 / (1 + def)) * (1 / Math.max((1 + bDef), (1 + nbDef))) *
				(1 + eAtk) * (1 + defDmgX) *
				((r.defMin + r.defMin + r.defMax) / 2) *
				(1 / (1 + (data.defMedal ?? 0) * 13.4 / 865)) *
				Math.max(1 - ((e.firstTurnResist ?? 0) / 7), (5 / 7)) *
				Math.max(1 - ((e.tenacious ?? 0) / 2), 0.1) *
				(1 - (e.ice ?? 0)) *
				(1 - ((e.light ?? 0) / 2)) *
				(1 / (1 + (Math.min(0.4 * (e.itemEquip ?? 0) + (e.firstTurnItem ? (1 / 6) : 0), 1) * ((1 + (e.armorSelect ?? 0) + (e.foodSelect ?? 0)) / (4 + (e.armorSelect ?? 0) + (e.foodSelect ?? 0) - (e.poisonAvoid ?? 0))) * ((0.25 * (1 + it.def)) + 0.25 * (1 + it.food)))));
			if (totalDef < 1) {
				if (totalAtk <= 1) out.push("");
				out.push("合計防御効果（平均）: " + showNum((1 - totalDef) * 100) + "%");
			}
			return out;
		},
	},
};

/**
 * 共通の行の値を集める
 *
 * @param ctx stats 以外の表示情報
 * @param extra スキル以外からの寄与（勲章・覚醒など）
 * @returns 共通の行の値（1 が補正なし）
 */
function collectStats(ctx: Omit<EffectDisplayContext, "stats">, extra: Partial<Record<StatKey, number>>): Record<StatKey, number> {
	const stats: Record<StatKey, number> = { atk: 1, atkLow: 1, def: 1, defLow: 1, spd: 1, bAtk: 1, bDef: 1, bSpd: 1, nbAtk: 1, nbDef: 1, eAtk: 1, eDef: 1 };
	for (const [key, value] of Object.entries(extra) as [StatKey, number][]) stats[key] *= value;
	for (const [key, def] of Object.entries(effectDisplay) as [keyof SkillEffect, EffectDisplay][]) {
		if (!def.stats) continue;
		const v = ctx.e[key] ?? 0;
		for (const [stat, f] of Object.entries(def.stats) as [StatKey, (v: number, ctx: EffectDisplayContext) => number][]) {
			stats[stat] *= f(v, ctx as EffectDisplayContext);
		}
	}
	return stats;
}

/**
 * スキル効果の確認表示を作る
 *
 * @param base 表示に使う情報（集計済みの効果・データ・お札・覚醒・色）
 * @returns 表示する文字列（改行区切り）
 * @internal
 */
export function renderEffectDisplay(base: Omit<EffectDisplayContext, "stats">): string {
	const { data, tokens, isSuper } = base;
	// スキル以外からの寄与: 赤の勲章はパワー、覚醒は行動回数
	const extra: Partial<Record<StatKey, number>> = {
		atk: 1 + (data.atkMedal ?? 0) * 0.01,
		atkLow: 1 + (data.atkMedal ?? 0) * 0.01,
		spd: (isSuper && !tokens.notSuperSpeedUp ? 1.2 : 1) * (isSuper && !tokens.redMode && !tokens.blueMode && tokens.yellowMode ? 1.1 : 1),
	};
	const ctx: EffectDisplayContext = { ...base, stats: collectStats(base, extra) };

	const entries: { order: number; lines: string[] }[] = [];
	for (const [key, def] of Object.entries(effectDisplay) as [keyof SkillEffect, EffectDisplay][]) {
		const v = ctx.e[key];
		if (!def.lines || !v) continue;
		for (const l of def.lines) entries.push({ order: l.order, lines: l.text(v, ctx) });
	}
	for (const g of Object.values(groupDisplay)) entries.push({ order: g.order, lines: g.text(ctx) });

	return entries
		.sort((a, b) => a.order - b.order)
		.flatMap((x) => x.lines)
		.join("\n");
}

/**
 * @packageDocumentation
 *
 * RPG のゴールデンテスト（戦闘結果を固定するテスト）で共通に使う道具
 *
 * @remarks
 * - {@link seeded}: 同じ seed なら同じ列になる乱数（`Math.random` の差し替えに使う）
 * - {@link builds}: 代表的な構成（スキル・お守り・お札の組み合わせ）
 * - {@link buildData}: 構成からプレイヤーデータを作る
 * - {@link hash}: 戦闘ログを短いハッシュにする（全文だと大きすぎるため。1 文字でも変われば検出できる）
 */
import * as crypto from "crypto";
import { skills } from "@/modules/rpg/skills";
import { mergeSkillAmulet } from "@/modules/rpg/shop";

/** 再現できる乱数（同じ seed なら同じ列になる） */
export const seeded = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6D2B79F5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** スキル名からスキル定義のコピーを返す（見つからなければ例外） */
export const skill = (name: string) => {
	const s = skills.find((x) => x.name === name);
	if (!s) throw new Error(`スキルが見つかりません: ${name}`);
	return { ...s };
};

/** 構成（スキル・お守り・お札・覚醒・好感度・その他のデータ） */
export type Build = { skills: string[]; amulet?: string | string[]; tokens?: string[]; super?: boolean; love?: number; extra?: Record<string, any> };

/** 代表的な構成 */
export const builds: [string, Build][] = [
	["ベテラン5スキル + 究極", { skills: ["分散型", "高速RPG", "継戦融合武装", "慎重", "準備を怠らない"], amulet: "究極のお守り", super: true, love: 600 }],
	["武器型 + 超越（覚醒変更 朱）", { skills: ["武器が大好き", "雷属性剣攻撃", "クリティカル性能上昇", "継戦融合武装", "準備を怠らない"], amulet: "超越のお守り", tokens: ["覚醒変更の札（朱）"], super: true, love: 600 }],
	["お守り整備×5 + 雷水入りカスタム", { skills: ["お守り整備", "お守り整備", "お守り整備", "お守り整備", "お守り整備"], amulet: ["連続攻撃完遂率上昇", "雷属性剣攻撃", "水属性剣攻撃", "クリティカル性能上昇", "防御貫通+10%", "風属性剣攻撃"], super: true, love: 1000 }],
	["罪スキル + 食べ物型", { skills: ["食いしんぼう", "お腹が空いてから食べる", "道具大好き", "道具の扱いが上手い", "粘り強い"], amulet: ["暴食の力", "傲慢の力", "怠惰の力", "強欲の力"], love: 300 }],
	["７フィーバー×5 + バーサク等", { skills: ["７フィーバー！", "７フィーバー！", "７フィーバー！", "７フィーバー！", "７フィーバー！"], amulet: ["バーサク", "スロースタート", "超全力の一撃", "嫉妬の力", "憤怒の力"], love: 200 }],
	["天国か地獄か・不運チャージ + しあわせのお守り", { skills: ["天国か地獄か", "不運チャージ", "負けそうなら逃げる", "攻めの守勢", "毒属性剣攻撃"], amulet: "しあわせのお守り", tokens: ["全身全霊のお札"], love: 100 }],
	["謎のお守り（発動しやすい状態）", { skills: ["光属性剣攻撃", "闇属性剣攻撃", "氷属性剣攻撃", "土属性剣攻撃"], amulet: "謎のお守り", love: 400, extra: { stockRandomCount: 30 } }],
	["わかば・スキル少なめ", { skills: ["パワーアップ"], amulet: "わかばのお守り", love: 0 }],
];

/**
 * 構成からプレイヤーデータを作る
 *
 * @param b 構成
 * @param ai 合成お守りを作るときに使う藍（モック）
 */
export const buildData = (b: Build, ai: any) => {
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

/** 文字列を短いハッシュにする */
export const hash = (text: string) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);

/** 戦闘ログから取り出すダメージの種類 */
export type DamageKind = "dealt" | "taken" | "final" | "warrior";

/** 戦闘ログから取り出したダメージ（ログに出た順） */
export type Damages = Record<DamageKind, number[]>;

/** メッセージを作る関数（数値を 1 つ受け取る） */
type MessageTemplate = (value: number) => string;

const SENTINEL = 918273645;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 戦闘ログからダメージを取り出す関数を作る
 *
 * @remarks
 * メッセージを作る関数（敵の `atkmsg`・`defmsg`、全力の一撃など）に目印の数値を渡して正規表現を作り、
 * ログの中からその形の行を探して数値を取り出す。クリティカルの `**` で囲まれていても拾える。
 *
 * @param templates 種類ごとのメッセージを作る関数
 */
export const makeDamageExtractor = (templates: { kind: DamageKind; make: MessageTemplate }[]) => {
	const patterns = new Map<string, { kind: DamageKind; re: RegExp }>();
	for (const { kind, make } of templates) {
		let text: string;
		try {
			text = make(SENTINEL);
		} catch {
			continue;
		}
		if (typeof text !== "string" || !text.includes(String(SENTINEL))) continue;
		const source = escapeRegExp(text).replace(String(SENTINEL), "(-?\\d+(?:\\.\\d+)?)");
		if (!patterns.has(source)) patterns.set(source, { kind, re: new RegExp(source, "g") });
	}
	return (log: string): Damages => {
		// 同じ位置に複数の形が当たった場合は、長く一致したほうを採る
		const found = new Map<number, { kind: DamageKind; value: number; length: number }>();
		for (const { kind, re } of patterns.values()) {
			re.lastIndex = 0;
			for (const m of log.matchAll(re)) {
				const end = (m.index ?? 0) + m[0].length;
				const prev = found.get(end);
				if (!prev || prev.length < m[0].length) found.set(end, { kind, value: Number(m[1]), length: m[0].length });
			}
		}
		const result: Damages = { dealt: [], taken: [], final: [], warrior: [] };
		for (const [, d] of [...found.entries()].sort((a, b) => a[0] - b[0])) result[d.kind].push(d.value);
		return result;
	};
};

/** 敵のメッセージから、与ダメージ・被ダメージの形を作る */
export const enemyDamageTemplates = (enemies: { atkmsg: MessageTemplate; defmsg: MessageTemplate }[]) =>
	enemies.flatMap((e) => [
		{ kind: "dealt" as const, make: e.atkmsg },
		{ kind: "taken" as const, make: e.defmsg },
	]);

/**
 * @packageDocumentation
 *
 * 鳩車（コンテスト型のレイド）の器用さ・仕上げの計算
 *
 * @remarks
 * 器用さ（dex）と仕上げ（fix）は、レイドの戦闘（raid.ts の `getTotalDmg3`）と
 * 確認表示（「RPG スキル バフ 鳩車」、skills.ts の `getHatogurumaEffectString`）の両方で使う。
 * 計算はここで 1 回だけ行い、それぞれは結果の行を並べるだけにする。
 *
 * 効果を足すときは {@link CONTEST_STEPS} に 1 件足す（表の順番に掛けていく）。
 *
 * @internal
 */
import type { SkillEffect } from './skill-data';

/** 計算に使う情報 */
type ContestContext = {
	/** 集計済みのスキル効果 */
	e: SkillEffect;
	/** RPG のプレイヤーデータ */
	data: any;
	/** 色によるステータス逆転があるか */
	reverseStatus: boolean;
};

/** 器用さ・仕上げの補正 1 つ分の定義 */
type ContestStepDefinition = {
	id: string;
	/** 補正する値（器用さ / 仕上げ） */
	target: 'dex' | 'fix';
	/** 効果量 */
	value: (ctx: ContestContext) => number | undefined;
	/** 発動するか（既定: 効果量が 0 より大きい） */
	isActive?: (v: number | undefined) => boolean;
	/** 補正を掛ける（発動したときだけ呼ぶ） */
	apply: (current: number, v: number) => number;
	/** 戦闘ログの行 */
	battleLine: (v: number) => string;
	/** 確認表示の行 */
	summaryLine: (v: number) => string;
	/** 発動しなかったときに、戦闘ログ（Lv170 以上）に出す行。出さないなら undefined */
	inactiveBattleLine?: (v: number | undefined) => string | undefined;
};

/** 発動しなかったときに「〇〇 なし」と出す */
const none = (label: string) => () => `${label} なし`;

/**
 * パワーが防御より高いほど器用さが下がる倍率（1 未満なら「有り余るパワー」）
 *
 * @remarks
 * パワー寄りのスキル効果（与ダメージ・パワーの上昇が被ダメージ・防御の上昇より大きい分）と、
 * パワーと防御の比率（色によるステータス逆転があれば逆）で決まる。
 */
const overPowerRate = ({ e, data, reverseStatus }: ContestContext) => {
	const atkDmgUp = (e.atkDmgUp ?? 0) - (e.defDmgUp ?? 0);
	const atkUp = (e.atkUp ?? 0) - (e.defUp ?? 0);
	return (atkDmgUp && atkDmgUp > 0 ? (1 / (1 + (atkDmgUp ?? 0))) : 1) *
		(atkUp && atkUp > 0 ? (1 / (1 + (atkUp ?? 0))) : 1) *
		(reverseStatus ? (0.75 + (data.atk / ((data.atk + data.def) || 1)) * 0.5) : (0.75 + (data.def / ((data.atk + data.def) || 1)) * 0.5));
};

/**
 * 器用さ・仕上げの補正（この順番で掛ける）
 *
 * @remarks
 * 戦闘ログと確認表示で見出しの言葉が違う（例: 戦闘ログは「気性穏やか」、確認表示は「非戦闘時パワー」）ので、両方を持つ。
 * スキルによる仕上げは `Math.floor` で切り捨てているため、今は常に 0（docs/raid-refactor-notes.md を参照）。
 */
export const CONTEST_STEPS: readonly ContestStepDefinition[] = [
	{
		id: 'exp', target: 'dex',
		value: ({ data }) => ((data.hatogurumaExp ?? 0) > 1 ? Math.min(0.3, data.hatogurumaExp / 100) : 0),
		apply: (dex, v) => dex * (1 + v),
		battleLine: (v) => `経験 器用さ+${Math.round(v * 100)}%`,
		summaryLine: (v) => `経験: 器用さ+${Math.round(v * 100)}%`,
	},
	{
		id: 'overPower', target: 'dex',
		value: overPowerRate,
		isActive: (v) => (v ?? 1) < 1,
		apply: (dex, v) => dex * v,
		battleLine: (v) => `有り余るパワー 器用さ-${Math.floor((1 - v) * 100)}%`,
		summaryLine: (v) => `有り余るパワー: 器用さ-${Math.floor((1 - v) * 100)}%`,
		inactiveBattleLine: () => 'パワー 適切',
	},
	{
		id: 'notBattleAtk', target: 'dex',
		value: ({ e }) => e.notBattleBonusAtk,
		apply: (dex, v) => dex * (1 + v),
		battleLine: (v) => `${v >= 0.7 ? '気性穏やか' : 'テキパキこなす'} 器用さ+${Math.round(v * 100)}%`,
		summaryLine: (v) => `非戦闘時パワー: 器用さ+${Math.round(v * 100)}%`,
		inactiveBattleLine: (v) => (!v ? 'テキパキこなすまたは気性穏やか なし' : undefined),
	},
	{
		id: 'notBattleAtkDown', target: 'dex',
		value: ({ e }) => e.notBattleBonusAtk,
		isActive: (v) => (v ?? 0) < 0,
		apply: (dex, v) => dex * Math.max(0.75, 1 + v),
		battleLine: (v) => `気性が荒い 器用さ-${Math.min(25, Math.floor((v * -1) * 100))}%`,
		summaryLine: (v) => `非戦闘時パワー低下: 器用さ-${Math.min(25, Math.floor(v * -100))}%`,
	},
	{
		id: 'notBattleDef', target: 'dex',
		value: ({ e }) => e.notBattleBonusDef,
		apply: (dex, v) => dex * (1 + (v / 4)),
		battleLine: (v) => `疲れにくい 器用さ+${Math.ceil(v * 25)}%`,
		summaryLine: (v) => `非戦闘時防御: 器用さ+${Math.ceil(v * 25)}%`,
		inactiveBattleLine: none('疲れにくい'),
	},
	{
		id: 'noAmulet', target: 'dex',
		value: ({ e }) => e.noAmuletAtkUp,
		apply: (dex, v) => dex * (1 + (v * 2)),
		battleLine: (v) => `かるわざ 器用さ+${Math.ceil(v * 200)}%`,
		summaryLine: (v) => `かるわざ: 器用さ+${Math.ceil(v * 200)}%`,
		inactiveBattleLine: none('かるわざ'),
	},
	{
		id: 'plusAction', target: 'dex',
		value: ({ e }) => e.plusActionX,
		apply: (dex, v) => dex * (1 + (v * 0.08)),
		battleLine: (v) => `高速RPG 器用さ+${Math.ceil(v * 8)}%`,
		summaryLine: (v) => `高速RPG: 器用さ+${Math.ceil(v * 8)}%`,
		inactiveBattleLine: none('高速RPG'),
	},
	{
		id: 'stable', target: 'dex',
		value: ({ e }) => e.atkRndMin,
		apply: (dex, v) => dex * (1 + (v / 5)),
		battleLine: (v) => `安定感 器用さ+${Math.ceil(v * 20)}%`,
		summaryLine: (v) => `安定感: 器用さ+${Math.ceil(v * 20)}%`,
		inactiveBattleLine: none('安定感'),
	},
	{
		id: 'prepared', target: 'dex',
		value: ({ e }) => e.firstTurnItem,
		apply: (dex) => dex * 1.1,
		battleLine: () => '準備を怠らない 器用さ+10%',
		summaryLine: () => '準備を怠らない: 器用さ+10%',
		inactiveBattleLine: none('準備を怠らない'),
	},
	{
		id: 'itemBoost', target: 'dex',
		value: ({ e }) => e.itemBoost,
		apply: (dex, v) => dex * (1 + (v / 5)),
		battleLine: (v) => `道具効果量 器用さ+${Math.ceil(v * 20)}%`,
		summaryLine: (v) => `道具効果量: 器用さ+${Math.ceil(v * 20)}%`,
		inactiveBattleLine: none('道具効果量'),
	},
	{
		id: 'itemChoice', target: 'dex',
		value: ({ e }) => e.mindMinusAvoid,
		apply: (dex, v) => dex * (1 + (v / 3)),
		battleLine: (v) => `道具の選択が上手い 器用さ+${Math.ceil(v * (100 / 3))}%`,
		summaryLine: (v) => `道具の選択が上手い: 器用さ+${Math.ceil(v * (100 / 3))}%`,
		inactiveBattleLine: none('道具の選択が上手い'),
	},
	{
		id: 'amuletPower', target: 'dex',
		value: ({ e }) => e.amuletPower,
		isActive: (v) => (v ?? 1) > 1,
		apply: (dex, v) => dex * (1 + ((v - 1) * 0.03)),
		battleLine: (v) => `お守りパワー 器用さ+${Math.ceil((v - 1) * 3)}%`,
		summaryLine: (v) => `お守りパワー: 器用さ+${Math.ceil((v - 1) * 3)}%`,
	},
	{
		id: 'abortDown', target: 'fix',
		value: ({ e }) => e.abortDown,
		apply: (fix, v) => fix + Math.floor(v / 4),
		battleLine: (v) => `連続攻撃完遂率上昇 仕上げ+${Math.ceil(v * 25)}%`,
		summaryLine: (v) => `連続攻撃完遂率上昇: 仕上げ+${Math.ceil(v * 25)}%`,
		inactiveBattleLine: none('連続攻撃完遂率上昇'),
	},
	{
		id: 'tenacious', target: 'fix',
		value: ({ e }) => e.tenacious,
		apply: (fix, v) => fix + Math.floor(v / 4),
		battleLine: (v) => `粘り強さ 仕上げ+${Math.ceil(v * 25)}%`,
		summaryLine: (v) => `粘り強さ: 仕上げ+${Math.ceil(v * 25)}%`,
		inactiveBattleLine: none('粘り強さ'),
	},
	{
		id: 'endureUp', target: 'fix',
		value: ({ e }) => e.endureUp,
		apply: (fix, v) => fix + Math.floor(v * 0.15),
		battleLine: (v) => `気合で頑張る 仕上げ+${Math.ceil(v * 15)}%`,
		summaryLine: (v) => `気合で頑張る: 仕上げ+${Math.ceil(v * 15)}%`,
		inactiveBattleLine: none('気合で頑張る'),
	},
];

/** 補正 1 つ分の結果 */
export type ContestStep = {
	id: string;
	target: 'dex' | 'fix';
	/** 発動したか */
	active: boolean;
	/** 戦闘ログの行（発動したときは効果の行、しなかったときは「なし」などの行。出さないなら undefined） */
	battleLine?: string;
	/** 確認表示の行（発動したときだけ） */
	summaryLine?: string;
};

/** 器用さ・仕上げの計算結果 */
export type ContestStats = {
	/** 基本の器用さ（85 + スキルの数 × 3） */
	baseDex: number;
	/** 補正をすべて掛けた器用さ（下限・ランダムな補正は呼び出し側） */
	dex: number;
	/** 補正をすべて足した仕上げ（上限・ランダムな補正は呼び出し側） */
	fix: number;
	/** 補正ごとの結果（{@link CONTEST_STEPS} の順） */
	steps: ContestStep[];
};

/**
 * 器用さ・仕上げを計算する
 *
 * @param e 集計済みのスキル効果
 * @param data RPG のプレイヤーデータ
 * @param reverseStatus 色によるステータス逆転があるか
 * @returns 器用さ・仕上げと、補正ごとの結果
 * @internal
 */
export function computeContestStats(e: SkillEffect, data: any, reverseStatus: boolean): ContestStats {
	const ctx: ContestContext = { e, data, reverseStatus };
	const baseDex = 85 + (data.skills?.length ?? 0) * 3;
	const totals = { dex: baseDex, fix: 0 };
	const steps: ContestStep[] = [];
	for (const def of CONTEST_STEPS) {
		const v = def.value(ctx);
		const active = def.isActive ? def.isActive(v) : (v ?? 0) > 0;
		if (active) {
			totals[def.target] = def.apply(totals[def.target], v as number);
			steps.push({ id: def.id, target: def.target, active, battleLine: def.battleLine(v as number), summaryLine: def.summaryLine(v as number) });
		} else {
			steps.push({ id: def.id, target: def.target, active, battleLine: def.inactiveBattleLine?.(v) });
		}
	}
	return { baseDex, dex: totals.dex, fix: totals.fix, steps };
}

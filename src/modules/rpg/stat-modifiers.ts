/**
 * @packageDocumentation
 *
 * 条件を満たしたらパワー・防御に倍率を掛けるスキル効果の定義
 *
 * @remarks
 * 「条件を満たしたらパワー・防御に倍率を掛け、詳細ログに 1 行出す」だけの効果は、ここに 1 件ずつ書く。
 * 1 件の定義から、次の 3 つを作る（式を 1 か所に書けば、ずれない）。
 * - 戦闘の計算（{@link applyStatModifiers}）
 * - 詳細ログ（-v）の行（`見出し: A+9% (1234)` の形）
 * - 確認表示（「RPG スキル バフ」）の倍率（{@link statModifierDisplayStats}、effect-display.ts から使う）
 *
 * 乱数・メッセージ・状態を持つ効果（天国か地獄か・７フィーバー・風・継戦融合武装など）は、
 * ここには入れず、戦闘の処理に直接書く。
 *
 * 今はレイド（通常型）の戦闘前の補正だけで使う。通常戦闘でも使うのは計画書の段階3。
 *
 * @internal
 */
import type { SkillEffect } from './skill-data';
import type { StatKey } from './effect-display';
import { BattleLog, displayDifference, formatNumber } from './battle-log';

/** 倍率を掛ける戦闘の状況（レイドの RaidBattle などがこの形を満たす） */
export type StatModifierTarget = {
	atk: number;
	def: number;
	isBattle: boolean;
	isPhysical: boolean;
	isTired: boolean;
	enemy: { abort?: number; maxdmg?: number };
	skillEffects: SkillEffect;
	log: BattleLog;
};

/**
 * 発動条件
 *
 * @remarks
 * 自由な関数ではなく名前で選ぶ。確認表示が、どの行（パワー・非戦闘時パワーなど）に出すかを判断できるようにするため。
 */
type StatCondition = {
	/** 戦闘の状況で発動するか */
	test: (s: StatModifierTarget) => boolean;
	/** 確認表示ではどの行に出すか（always: パワー・防御、nonBattle: 非戦闘時パワー・防御） */
	displayAs: 'always' | 'nonBattle';
};

export const STAT_CONDITIONS = {
	/** 常に */
	always: { test: () => true, displayAs: 'always' },
	/** 敵が連続攻撃を中断する能力を持たない（確認表示では常に効くものとして出す。レイドボスで中断能力を持つのは :sinkansen: だけ） */
	enemyCannotAbort: { test: (s) => !s.enemy.abort, displayAs: 'always' },
	/** 最大ダメージ制限のある物理戦闘ではない（確認表示では常に効くものとして出す。レイドボスは最大ダメージ制限を持たない） */
	notCappedPhysicalBattle: { test: (s) => !(s.isBattle && s.isPhysical && s.enemy.maxdmg), displayAs: 'always' },
	/** 戦闘しない敵（攻撃メッセージに「ダメージ」がない） */
	nonBattle: { test: (s) => !s.isBattle, displayAs: 'nonBattle' },
	/** 疲れでダメージを受ける敵（被ダメージメッセージに「疲」がある） */
	tiredEnemy: { test: (s) => s.isTired, displayAs: 'nonBattle' },
} satisfies Record<string, StatCondition>;

/**
 * 倍率を掛ける時点
 *
 * - preBattle: 戦闘前の補正の途中（風のあと、強敵と戦うのが好きの前）
 * - preBattleLate: 戦闘前の補正の最後（防御貫通と、それまでのバフの空行のあと）
 *
 * NOTE: 2 つに分かれているのは、詳細ログの空行の位置を今と同じにするため（段階2で、詳細ログの改行と合わせて整理する）。
 */
export type StatModifierTiming = 'preBattle' | 'preBattleLate';

/** 倍率を掛けるスキル効果 1 件分の定義 */
export type StatModifier = {
	/** スキル効果の名前（SkillEffect のキー） */
	effect: keyof SkillEffect;
	/** 詳細ログの見出し */
	label: string;
	/** 掛ける時点 */
	timing: StatModifierTiming;
	/** 発動条件 */
	when: keyof typeof STAT_CONDITIONS;
	/** パワーの倍率（v は効果量） */
	atk?: (v: number) => number;
	/** 防御の倍率（v は効果量） */
	def?: (v: number) => number;
};

/**
 * 倍率を掛けるスキル効果（同じ時点の中では、この順番に掛ける）
 *
 * @remarks
 * 式は、戦闘の計算・詳細ログ・確認表示で共通。変えると 3 つとも変わる。
 */
export const STAT_MODIFIERS: readonly StatModifier[] = [
	// 本来の効果が出ない敵では、パワーに還元される
	{ effect: 'abortDown', label: '遂スキル効果', timing: 'preBattle', when: 'enemyCannotAbort', atk: (v) => 1 + v * (1 / 3) },
	{ effect: 'dart', label: '土スキル効果', timing: 'preBattle', when: 'notCappedPhysicalBattle', atk: (v) => 1 + v * 0.5 },
	// 非戦闘時・疲れの敵で効く
	{ effect: 'notBattleBonusAtk', label: '非戦闘', timing: 'preBattle', when: 'nonBattle', atk: (v) => 1 + v },
	{ effect: 'notBattleBonusDef', label: '疲スキル効果', timing: 'preBattle', when: 'tiredEnemy', def: (v) => 1 + v },
	// 常に効く
	{ effect: 'plusActionX', label: '速スキル効果', timing: 'preBattleLate', when: 'always', atk: (v) => 1 + v / 10 },
	{ effect: 'enemyCritDmgDown', label: '守スキル効果', timing: 'preBattleLate', when: 'always', def: (v) => 1 + v / 4 },
	{ effect: 'enemyBuff', label: 'お守り効果', timing: 'preBattleLate', when: 'always', atk: (v) => 1 + v / 20, def: (v) => 1 + v / 20 },
];

/**
 * 指定した時点の倍率を、戦闘の状況に掛ける
 *
 * @remarks
 * 効果量が 0（または持っていない）なら何もしない。掛けたら、詳細ログに `見出し: A+9% (1234)` の行を出す
 * （パワーと防御の両方に掛ける場合は `AD`）。
 *
 * @param timing 掛ける時点
 * @param s 戦闘の状況（パワー・防御を書き換える）
 */
export function applyStatModifiers(timing: StatModifierTiming, s: StatModifierTarget): void {
	for (const m of STAT_MODIFIERS) {
		if (m.timing !== timing) continue;
		const v = s.skillEffects[m.effect] as number | undefined;
		if (!v || !STAT_CONDITIONS[m.when].test(s)) continue;
		if (m.atk) s.atk = s.atk * m.atk(v);
		if (m.def) s.def = s.def * m.def(v);
		s.log.verbose(() => {
			const rate = (m.atk ?? m.def)!(v);
			const stats = `${m.atk ? 'A' : ''}${m.def ? 'D' : ''}`;
			const values = [m.atk ? formatNumber(s.atk) : undefined, m.def ? formatNumber(s.def) : undefined].filter(Boolean).join(' / ');
			return `${m.label}: ${stats}${displayDifference(rate)} (${values})\n`;
		});
	}
}

/**
 * 確認表示（effect-display.ts の stats）用に、効果の倍率を行の種類ごとに返す
 *
 * @param effect スキル効果の名前
 * @returns 行の種類（パワー・非戦闘時防御など）ごとの倍率の関数
 */
export function statModifierDisplayStats(effect: keyof SkillEffect): Partial<Record<StatKey, (v: number) => number>> {
	const m = STAT_MODIFIERS.find((x) => x.effect === effect);
	if (!m) throw new Error(`STAT_MODIFIERS に ${effect} がありません`);
	const nonBattle = STAT_CONDITIONS[m.when].displayAs === 'nonBattle';
	const stats: Partial<Record<StatKey, (v: number) => number>> = {};
	if (m.atk) stats[nonBattle ? 'nbAtk' : 'atk'] = m.atk;
	if (m.def) stats[nonBattle ? 'nbDef' : 'def'] = m.def;
	return stats;
}

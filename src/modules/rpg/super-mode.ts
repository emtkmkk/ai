/**
 * @packageDocumentation
 *
 * 覚醒時に、お札（覚醒変更の札・超覚醒の札）がスキル効果に与える補正
 *
 * @remarks
 * レイド・通常戦闘・木人・確認表示（「RPG スキル バフ」）で同じ補正を使うため、ここにまとめる。
 * スキル効果の書き換えだけを行い、メッセージ・行動回数・覚醒回数などは呼び出し側で扱う。
 *
 * どれも「覚醒しているとき」に呼ぶこと（覚醒の判定は呼び出し側）。
 *
 * @internal
 */
import type { SkillEffect } from './skill-data';

/** 覚醒変更の札による覚醒の種類（朱・蒼・橙・翠） */
export type SuperColorMode = 'red' | 'blue' | 'yellow' | 'green';

/** 朱覚醒で、クリティカルダメージの下限にする値 */
export const RED_MODE_CRIT_DMG_FLOOR = 0.35;

/**
 * 所持しているお札から、覚醒変更の種類を返す
 *
 * @remarks
 * 複数持っている場合は 朱 → 蒼 → 橙 → 翠 の順で優先する。
 *
 * @param tokens お札の効果（`aggregateTokensEffects` の結果）
 * @returns 覚醒変更の種類。覚醒変更の札を持っていなければ null
 * @internal
 */
export function getSuperColorMode(tokens: Record<string, any>): SuperColorMode | null {
	if (tokens.redMode) return 'red';
	if (tokens.blueMode) return 'blue';
	if (tokens.yellowMode) return 'yellow';
	if (tokens.greenMode) return 'green';
	return null;
}

/**
 * 覚醒変更の札による補正をスキル効果に反映する（直接書き換える）
 *
 * @remarks
 * - 朱: クリティカル率（固定）+8%、クリティカルダメージを下限まで引き上げ
 * - 蒼: 被ダメージ -40%
 * - 橙: 被ダメージ -20%（行動回数の増加は呼び出し側）
 * - 翠: アイテムの装備率・効果量・気合低下回避・毒回避 ×1.4
 *
 * @param e 書き換えるスキル効果
 * @param mode 覚醒変更の種類（{@link getSuperColorMode}）。null なら何もしない
 * @param options.redCritDmgFloor 朱覚醒のクリティカルダメージの下限（既定 {@link RED_MODE_CRIT_DMG_FLOOR}）
 * @internal
 */
export function applySuperColorModeEffects(e: SkillEffect, mode: SuperColorMode | null, options: { redCritDmgFloor?: number } = {}): void {
	switch (mode) {
		case 'red':
			e.critUpFixed = (e.critUpFixed ?? 0) + 0.08;
			e.critDmgUp = Math.max((e.critDmgUp ?? 0), options.redCritDmgFloor ?? RED_MODE_CRIT_DMG_FLOOR);
			break;
		case 'blue':
			e.defDmgUp = (e.defDmgUp ?? 0) - 0.4;
			break;
		case 'yellow':
			e.defDmgUp = (e.defDmgUp ?? 0) - 0.2;
			break;
		case 'green':
			e.itemEquip = ((1 + (e.itemEquip ?? 0)) * 1.4) - 1;
			e.itemBoost = ((1 + (e.itemBoost ?? 0)) * 1.4) - 1;
			e.mindMinusAvoid = ((1 + (e.mindMinusAvoid ?? 0)) * 1.4) - 1;
			e.poisonAvoid = ((1 + (e.poisonAvoid ?? 0)) * 1.4) - 1;
			break;
	}
}

/**
 * 超覚醒の札による補正をスキル効果に反映する（直接書き換える）
 *
 * @remarks
 * 超覚醒の札を持っていると、覚醒時の投稿数 +200 の代わりに、投稿数による能力上昇量（postXUp）が +0.015 される。
 * 投稿数の +200 をやめる処理は呼び出し側。
 *
 * @param e 書き換えるスキル効果
 * @param tokens お札の効果（`aggregateTokensEffects` の結果）
 * @internal
 */
export function applyHyperModeEffects(e: SkillEffect, tokens: Record<string, any>): void {
	if (tokens.hyperMode) {
		e.postXUp = (e.postXUp ?? 0) + 0.015;
	}
}

/**
 * @packageDocumentation
 *
 * 数取りの自然発生（自動開催）の判定ユーティリティ
 *
 * @remarks
 * - 人数・開催条件・時間帯は `@/utils/timeline-activity` の共通ルールに従う。
 * - 確率: 18.5分ごとに min(1, 0.03 × 機嫌 × (直近60分に3回以上投稿した人数 - 3))。
 * - 保証判定: 毎日 8:00〜9:59 のランダムな時刻に、今日まだ開催がなければ「その日の上限/8」（最大1）の確率で開催を試みる。
 *
 * @public
 */
import { activityProbability, naturalDayStart } from '@/utils/timeline-activity';

/** 確率の係数（機嫌を掛ける前、1人あたり） */
const PROBABILITY_PER_USER = 0.03;

/**
 * 自然発生の抽選確率
 *
 * @param activeUsers - 直近60分に3回以上投稿した人数（bot除く）
 * @param activeFactor - 機嫌
 * @public
 */
export function naturalStartProbabilityByUsers(activeUsers: number, activeFactor: number): number {
	return activityProbability(activeUsers, activeFactor, PROBABILITY_PER_USER);
}

/**
 * 保証判定が発生する確率（その日の上限 / 8、最大1）
 *
 * @param dailyCap - その日の自動開催の上限回数
 * @public
 */
export function guaranteeProbability(dailyCap: number): number {
	return Math.min(1, Math.max(0, dailyCap / 8));
}

/**
 * 保証判定の時刻（8:00〜9:59 のランダムな時刻）を決める
 *
 * @public
 */
export function pickGuaranteeTime(now: Date, random: () => number = Math.random): number {
	return naturalDayStart(now) + Math.floor(random() * 120) * 60 * 1000;
}

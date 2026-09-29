/**
 * @packageDocumentation
 *
 * 数取りの自然発生（自動開催）の1日あたり上限回数ユーティリティ
 *
 * @remarks
 * 1日の初めの機嫌（activeFactor）で、現在の自動開催ルールに沿った1日を1回シミュレーションし、
 * その開催回数をその日の上限とする。上限の分布が現在の1日の開催回数の分布と同じになる。
 * ただし午前中の抽選確率の補正と午前中長時間（8〜10時の48倍）は上限の計算に含めない。
 *
 * @public
 */

/** 自動開催の抽選間隔（ミリ秒） */
export const NATURAL_START_INTERVAL_MS = 1000 * 30 * 37;
/** 自動開催後のクールダウン（分）。前回がお流れの場合は考慮しない */
const NATURAL_COOLDOWN_MINUTES = 50;

/** 午前中（8〜11時）の抽選確率の倍率 */
const MORNING_BOOST = 2;

/**
 * 自動開催の抽選確率
 *
 * @param hours - 現在の時（0〜23）
 * @param activeFactor - 機嫌
 * @param morningBoost - 午前中（8〜11時）の補正を掛けるか
 * @public
 */
export function naturalStartProbability(hours: number, activeFactor: number, morningBoost = true): number {
	const base = hours === 12 || (hours > 17 && hours < 24) ? 0.5 : 0.1;
	const boost = morningBoost && hours >= 8 && hours < 12 ? MORNING_BOOST : 1;
	return base * boost * activeFactor;
}

/**
 * 開催可能な時間帯か（1〜7時は開催しない）
 *
 * @public
 */
export function isStartableHour(hours: number): boolean {
	return !(hours > 0 && hours < 8);
}

/**
 * 基本の制限時間（分）を抽選する: 10%で短時間(1 or 2分)、90%で5 or 10分
 *
 * @public
 */
export function rollBaseLimitMinutes(activeFactor: number, triggered: boolean, random: () => number = Math.random): number {
	return random() < 0.1 && activeFactor >= 0.75 ? (random() < 0.5 && !triggered ? 1 : 2) : random() < 0.5 ? 5 : 10;
}

/**
 * 高機嫌かつ0.1%で長時間になるか（14時未満のみ）
 *
 * @public
 */
export function rollHighMoodRareLongLimit(activeFactor: number, hours: number, random: () => number = Math.random): boolean {
	return activeFactor >= 1 && random() < 0.001 && hours < 14;
}

/**
 * 午前中長時間の抽選対象か
 *
 * @remarks
 * 8〜10時・機嫌0.75超・今日まだ開催がない（前回の開始が昨日以前、または開催履歴なし）のすべてを満たすとき対象。
 * 前回の開催にはメンションで開始したゲームも含む。
 *
 * @param now - 現在時刻
 * @param recentGameStartedAt - 直近のゲームの開始時刻（なければ null）
 * @param activeFactor - 機嫌
 * @public
 */
export function isMorningLongEligible(now: Date, recentGameStartedAt: number | null, activeFactor: number): boolean {
	const hours = now.getHours();
	if (hours < 8 || hours >= 10 || activeFactor <= 0.75) return false;
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	return recentGameStartedAt == null || recentGameStartedAt < startOfToday;
}

/**
 * 低機嫌時は制限時間を延ばす
 *
 * @public
 */
export function adjustLimitMinutesForMood(limitMinutes: number, activeFactor: number, random: () => number = Math.random): number {
	if (activeFactor >= 0.75) return limitMinutes;
	return Math.floor(1 / (1 - Math.min((1 - activeFactor) * 1.2 * (0.7 + random() * 0.3), 0.8)) * limitMinutes / 5) * 5;
}

/**
 * 1日分の自動開催をシミュレーションし、開催回数を返す
 *
 * @param activeFactor - 1日の初めの機嫌（1日を通して固定）
 * @param random - 乱数関数
 * @returns その日の自動開催回数
 * @public
 */
export function simulateNaturalGameCount(activeFactor: number, random: () => number = Math.random): number {
	const minuteMs = 60 * 1000;
	const dayMs = 24 * 60 * minuteMs;
	let count = 0;
	/** 次に開催できる時刻（開催中・クールダウン中は開催しない） */
	let availableAt = 0;
	for (let t = random() * NATURAL_START_INTERVAL_MS; t < dayMs; t += NATURAL_START_INTERVAL_MS) {
		const hours = Math.floor(t / (60 * minuteMs));
		if (random() >= naturalStartProbability(hours, activeFactor, false)) continue;
		if (!isStartableHour(hours) || t < availableAt) continue;
		count++;
		let limitMinutes = rollBaseLimitMinutes(activeFactor, false, random);
		const isLong = rollHighMoodRareLongLimit(activeFactor, hours, random);
		if (isLong) limitMinutes *= 48;
		else limitMinutes = adjustLimitMinutesForMood(limitMinutes, activeFactor, random);
		availableAt = t + (limitMinutes + NATURAL_COOLDOWN_MINUTES) * minuteMs;
	}
	return count;
}

/** 1日の上限回数の保存形式 */
export type KazutoriDailyCap = {
	/** 対象日（`YYYY-M-D`、ローカル時刻） */
	date: string;
	/** 自動開催の上限回数 */
	cap: number;
	/** 上限を決めたときの機嫌 */
	activeFactor: number;
};

/**
 * 日付キーを作る
 *
 * @public
 */
export function dateKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

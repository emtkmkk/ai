/**
 * @packageDocumentation
 *
 * 数取りの自然発生（自動開催）の判定ユーティリティ
 *
 * @remarks
 * - 開催条件: 前回の開催以降に HTL/LTL へ投稿した人（bot除く）が5人以上、かつ
 *   「100投稿」または「終了から60分（前回がお流れなら110分）」の早いほう。
 *   今日8時以降にまだ開催がなければ条件を満たしている扱い（前日分は持ち越さない）。
 * - 確率: 18.5分ごとに min(1, 0.029 × 機嫌 × (直近30分に投稿した人数(bot除く) - 6))。
 * - 保証判定: 毎日 8:00〜9:59 のランダムな時刻に、今日まだ開催がなければ「その日の上限/8」（最大1）の確率で開催を試みる。
 * - 0〜7時は自然発生しない。
 *
 * @public
 */

/** 開催条件: 前回の開催以降に投稿した人数 */
export const GATE_USERS = 5;
/** 開催条件: 前回の開催以降の投稿数 */
export const GATE_POSTS = 100;
/** 開催条件: 前回の終了からの経過時間（分） */
export const GATE_MINUTES = 60;
/** 開催条件: 前回がお流れだった場合の経過時間（分） */
export const GATE_MINUTES_AFTER_ONAGARE = 110;
/** 直近の人数を数える窓（分） */
export const ACTIVE_WINDOW_MINUTES = 30;
/** 確率の係数（機嫌を掛ける前、1人あたり） */
const PROBABILITY_PER_USER = 0.029;
/** 確率が0になる人数 */
const PROBABILITY_BASE_USERS = 6;
/** 自然発生を始める時 */
export const NATURAL_START_HOUR = 8;

/** 前回の開催以降のタイムラインの状況 */
export type SinceLastGame = {
	/** 投稿数（{@link GATE_POSTS} で頭打ち） */
	posts: number;
	/** 投稿した人のID（{@link GATE_USERS} 人で頭打ち） */
	userIds: string[];
};

/** 開催条件の判定に使う直近のゲーム情報 */
export type LastGameInfo = {
	startedAt: number;
	finishedAt?: number;
	votes?: unknown[];
};

/**
 * 自然発生できる時間帯か（0〜7時は不可）
 *
 * @public
 */
export function isNaturalStartHour(hours: number): boolean {
	return hours >= NATURAL_START_HOUR;
}

/**
 * 今日の自然発生の起点（8:00）の時刻
 *
 * @public
 */
export function naturalDayStart(now: Date): number {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), NATURAL_START_HOUR).getTime();
}

/**
 * 前回の開催からの間隔が開催条件を満たしているか
 *
 * @param now - 現在時刻
 * @param lastGame - 直近のゲーム（なければ null）
 * @param since - 前回の開催以降のタイムラインの状況
 * @public
 */
export function isGateOpen(now: Date, lastGame: LastGameInfo | null, since: SinceLastGame): boolean {
	if (lastGame == null || lastGame.startedAt < naturalDayStart(now)) return true;
	if (since.userIds.length < GATE_USERS) return false;
	if (since.posts >= GATE_POSTS) return true;
	const onagare = (lastGame.votes?.length ?? 2) <= 1;
	const waitMinutes = onagare ? GATE_MINUTES_AFTER_ONAGARE : GATE_MINUTES;
	return now.getTime() - (lastGame.finishedAt ?? lastGame.startedAt) >= waitMinutes * 60 * 1000;
}

/**
 * タイムラインの投稿を前回の開催以降の状況に加える（頭打ちの値を超えては保持しない）
 *
 * @returns 変化があれば新しい状態、なければ null
 * @public
 */
export function addToSinceLastGame(since: SinceLastGame, userId: string): SinceLastGame | null {
	const addPost = since.posts < GATE_POSTS;
	const addUser = since.userIds.length < GATE_USERS && !since.userIds.includes(userId);
	if (!addPost && !addUser) return null;
	return {
		posts: addPost ? since.posts + 1 : since.posts,
		userIds: addUser ? [...since.userIds, userId] : since.userIds,
	};
}

/**
 * 自然発生の抽選確率
 *
 * @param activeUsers - 直近30分に投稿した人数（bot除く）
 * @param activeFactor - 機嫌
 * @public
 */
export function naturalStartProbabilityByUsers(activeUsers: number, activeFactor: number): number {
	return Math.min(1, Math.max(0, PROBABILITY_PER_USER * activeFactor * (activeUsers - PROBABILITY_BASE_USERS)));
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

/**
 * 直近の投稿者を記録し、一定時間内の人数を数える
 *
 * @public
 */
export class ActiveUserWindow {
	private lastSeen = new Map<string, number>();

	constructor(private readonly windowMs = ACTIVE_WINDOW_MINUTES * 60 * 1000) {}

	public record(userId: string, at: number) {
		this.lastSeen.delete(userId);
		this.lastSeen.set(userId, at);
	}

	public count(now: number): number {
		// Map は挿入順なので、古いものから削除できる
		for (const [userId, at] of this.lastSeen) {
			if (at > now - this.windowMs) break;
			this.lastSeen.delete(userId);
		}
		return this.lastSeen.size;
	}
}

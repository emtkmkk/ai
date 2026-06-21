/**
 * @packageDocumentation
 *
 * 数取りゲーム開始時オプションの連続外れ補正（pity）ユーティリティ
 *
 * @remarks
 * (連続外れ回数 + 1) 回の独立ロールのいずれかが当選すれば通過、という仕様は
 * `effectiveP = 1 - (1 - p) ^ (streak + 1)` の 1 回ロールと数学的に等価。
 * 前提条件を満たさない判定では streak を更新しない（呼び出し側の責務）。
 *
 * @public
 */

/** ゲーム開始時 pity 対象の判定キー */
export type KazutoriPityKey =
	| 'huge'
	| 'max1'
	| 'infinite'
	| 'winRank2nd'
	| 'winRankMedian'
	| 'morningLong'
	| 'followers'
	| 'publicOnly';

/** キーごとの連続外れ回数 */
export type KazutoriPityState = Partial<Record<KazutoriPityKey, number>>;

/**
 * 連続外れ回数を考慮した実効当選確率を計算する
 *
 * @param probability - 1 回あたりの基準当選確率（0〜1）
 * @param streak - 連続外れ回数
 * @returns 今回のロールで少なくとも 1 回当選する確率
 * @public
 */
export function computeEffectiveProbability(probability: number, streak: number): number {
	const rolls = Math.max(0, streak) + 1;
	return 1 - Math.pow(1 - probability, rolls);
}

/**
 * pity 付きランダム判定を 1 回行う
 *
 * @param state - 現在の pity 状態
 * @param key - 判定キー
 * @param probability - 基準当選確率（0〜1）
 * @param rng - 乱数生成関数（0〜1）。省略時は Math.random
 * @returns 当選したかどうかと更新後の pity 状態
 * @public
 */
export function rollWithPity(
	state: KazutoriPityState,
	key: KazutoriPityKey,
	probability: number,
	rng: () => number = Math.random,
): { hit: boolean; nextState: KazutoriPityState } {
	const streak = state[key] ?? 0;
	const effectiveP = computeEffectiveProbability(probability, streak);
	const hit = rng() < effectiveP;
	const nextState: KazutoriPityState = { ...state };

	if (hit) {
		delete nextState[key];
	} else {
		nextState[key] = streak + 1;
	}

	return { hit, nextState };
}

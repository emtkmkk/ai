/**
 * @packageDocumentation
 *
 * 一度出た候補は、他の候補がすべて出るまで出さない選び方（シャッフルバッグ）
 *
 * @remarks
 * 出た候補のキーを `used` に記録し、未使用の候補からランダムに選ぶ。
 * 未使用の候補がなくなったら `used` を空に戻して次の一巡を始める。
 * 候補が追加・削除されても、現在の候補にないキーは無視されるので問題ない。
 *
 * @public
 */

/**
 * 未使用の候補から1つ選ぶ
 *
 * @param items - 候補（空でないこと）
 * @param keyOf - 候補を識別するキー
 * @param used - これまでに出た候補のキー
 * @param random - 乱数関数
 * @returns 選んだ候補と、更新後の `used`
 * @public
 */
export function pickFromBag<T>(
	items: readonly T[],
	keyOf: (item: T) => string,
	used: readonly string[],
	random: () => number = Math.random,
): { item: T; used: string[] } {
	const usedSet = new Set(used);
	let candidates = items.filter(item => !usedSet.has(keyOf(item)));
	let nextUsed = items.map(keyOf).filter(key => usedSet.has(key));
	if (candidates.length === 0) {
		candidates = [...items];
		nextUsed = [];
	}
	const item = candidates[Math.floor(random() * candidates.length)];
	return { item, used: [...nextUsed, keyOf(item)] };
}

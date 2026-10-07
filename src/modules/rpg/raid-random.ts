/**
 * @packageDocumentation
 *
 * レイドの乱数（シードを指定すると戦闘を再現できる）
 *
 * @remarks
 * レイドの戦闘で使う乱数を、用途ごとの名前（ラベル）をつけて引く。
 * シードを指定した場合、各値は「秘密の値 + レイドの投稿ID + ユーザーID + 平行次元の番号 + ラベル + キー + そのラベルで引いた回数」
 * から決まるので、同じレイド・同じユーザーなら同じ乱数になり、戦闘を再現できる。
 *
 * ラベルごとに回数を数えるため、ある用途の乱数を引く回数が変わっても、別の用途の乱数はずれない。
 * ターン数などをキーに含めると、別のターンの乱数もずれなくなる（計算式を直して再計算するときに、なるべく同じ展開になる）。
 *
 * 秘密の値を混ぜるのは、投稿IDとユーザーIDだけから結果を事前に計算されないようにするため。
 * 設定の `rpgSeedSalt` があればそれを使い、なければアクセストークンのハッシュを使う。
 *
 * シードを指定しない場合は、これまでどおり Math.random() を呼んだ順に使う。
 *
 * @internal
 */
import { createHash } from "crypto";
import config from "@/config";

/**
 * 用途の名前をつけて 0 以上 1 未満の乱数を引く
 *
 * @param label 用途の名前（例: "crit"、"item.type"）
 * @param keys ターン数など、同じ用途の中で区別するためのキー
 */
export type RaidRandom = (label: string, ...keys: (string | number)[]) => number;

/** レイドの乱数のシード */
export type RaidSeed = {
	/** レイドの投稿ID */
	postId: string;
	/** 参加したユーザーのID */
	userId: string;
	/** 平行次元の番号（正史 = 0） */
	dimension?: number;
};

let cachedSecret: string | undefined;

/**
 * シードに混ぜる秘密の値を返す
 *
 * @returns 設定の rpgSeedSalt、なければアクセストークンから作ったハッシュ
 * @internal
 */
export function raidSeedSecret(): string {
	if (cachedSecret === undefined) {
		cachedSecret = config.rpgSeedSalt || createHash("sha256").update(`rpg-raid-seed:${config.i}`).digest("hex").slice(0, 32);
	}
	return cachedSecret;
}

/**
 * レイドの乱数を作る
 *
 * @param seed シード（省略時は Math.random() を使う）
 * @param secret 秘密の値（省略時は {@link raidSeedSecret}）
 * @returns 用途の名前をつけて乱数を引く関数
 * @internal
 */
export function createRaidRandom(seed?: RaidSeed, secret: string = raidSeedSecret()): RaidRandom {
	if (!seed) return () => Math.random();
	const base = `${secret}|${seed.postId}|${seed.userId}|${seed.dimension ?? 0}`;
	const counters = new Map<string, number>();
	return (label, ...keys) => {
		const key = [label, ...keys].join(":");
		const n = counters.get(key) ?? 0;
		counters.set(key, n + 1);
		const digest = createHash("sha256").update(`${base}|${key}|${n}`).digest();
		// 先頭 48 ビットを 0 以上 1 未満の値にする
		return digest.readUIntBE(0, 6) / 2 ** 48;
	};
}

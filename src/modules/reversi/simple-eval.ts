/**
 * @packageDocumentation
 *
 * 強モードの着手評価（重み付き合計方式）
 *
 * @remarks
 * - 縛り: 変則盤対応（固定座標を使わず盤面形状から計算）・未来読みなし（自分の着手直後の盤面までを put/undo で評価し、相手の応手は読まない）・必ず 1 手。
 * - 各合法手について着手後の盤面から特徴量を取り、`score = Σ 重み × 特徴量` で最大の手を選ぶ。
 * - 単純モード（back.ts の chooseMoveSimple、優先順位の連鎖方式）と異なり、すべての特徴が常に効く。重みは自己対戦ハーネス（test/modules/reversi/selfplay.spec.ts）で調整する。
 *
 * @internal
 */

import Reversi, { Color } from 'misskey-reversi';

/**
 * 評価の重み。正の値はその特徴が大きいほど良い、負の値は小さいほど良い。
 *
 * @remarks
 * `*Early` / `*Late` の対は空きマス比率 t（開始時 1 → 終局 0）で線形に混ぜる。
 *
 * @internal
 */
export type SimpleWeights = {
	/** 角に打つ */
	corner: number;
	/** 空き角の斜め隣（X）に打つ */
	xSquare: number;
	/** 空き角の縦横隣（C）に打つ */
	cSquare: number;
	/** 着手で相手が打てる空き角の数が増えた分（1 角ごと） */
	givesCorner: number;
	/** 着手で相手が打てる空き角の数が減った分（1 角ごと） */
	removesCorner: number;
	/** 着手後の相手合法手数（序盤） */
	oppMobilityEarly: number;
	/** 着手後の相手合法手数（終盤） */
	oppMobilityLate: number;
	/** 着手後に相手がパスになる（終局を除く） */
	oppPass: number;
	/** 着手後の自石フロンティア数（空きに隣接する自石） */
	myFrontier: number;
	/** 着手後の相手石フロンティア数 */
	oppFrontier: number;
	/** 反転数（序盤） */
	flipsEarly: number;
	/** 反転数（終盤） */
	flipsLate: number;
	/** 着手後の安定石差の変化（自分の増加 − 相手の増加） */
	stableDelta: number;
	/** 着手後の石差（自分 − 相手）。終盤のみ効く */
	discDiffLate: number;
	/** 着手マスが属する空き領域の空き数が奇数（空き ≤ parityEmptyMax のとき） */
	oddRegion: number;
	/** 反転する石の周囲の空きマス数の合計 */
	emptyAroundFlipped: number;
	/** 着手マスの 8 近傍の空き数 */
	emptyNeighbors: number;
	/** 辺からの距離（序盤） */
	edgeDistEarly: number;
	/** 辺から 1 マス内側の帯に打つ（序盤） */
	secondRingEarly: number;
	/** 空き角から辺沿いに 2 マス離れた辺マス（A） */
	aSquare: number;
	/** 着手後に空き角の X マスに乗っている自石数の変化（反転で乗る場合も含む） */
	myXDiscsDelta: number;
	/** 着手後に空き角の C マスに乗っている自石数の変化（反転で乗る場合も含む） */
	myCDiscsDelta: number;
	/** 終局させる手の石差 1 につき */
	finalDisc: number;
	/** パリティ評価を適用する空きマス数の上限 */
	parityEmptyMax: number;
};

/**
 * 既定の重み。標準 8x8 盤での自己対戦（座標降下 2 巡）で調整した値。
 *
 * @remarks
 * 単純モードに対して約 75%（600 局×2 シード）、調整前の初期重みに対して約 57% の勝率。
 *
 * @internal
 */
export const DEFAULT_SIMPLE_WEIGHTS: SimpleWeights = {
	corner: 30,
	xSquare: -25,
	cSquare: 0,
	givesCorner: -45,
	removesCorner: 6,
	oppMobilityEarly: -3,
	oppMobilityLate: 1,
	oppPass: 15,
	myFrontier: -0.45,
	oppFrontier: 0.3,
	flipsEarly: -0.75,
	flipsLate: -1,
	stableDelta: 1,
	discDiffLate: 0.75,
	oddRegion: 2,
	emptyAroundFlipped: -1,
	emptyNeighbors: -0.45,
	edgeDistEarly: 0.75,
	secondRingEarly: -0.5,
	aSquare: 2,
	myXDiscsDelta: -1,
	myCDiscsDelta: 0,
	finalDisc: 100,
	parityEmptyMax: 16,
};

/** 4 軸（右・下・右下・右上）。安定石判定に使用 */
const AXES: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
/** 4 近傍 */
const D4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
/** 8 近傍 */
const D8: [number, number][] = [
	[0, -1], [0, 1], [-1, 0], [1, 0],
	[-1, -1], [-1, 1], [1, -1], [1, 1],
];

/**
 * 盤面形状から導出した幾何情報。盤面（map）ごとにキャッシュする。
 *
 * @internal
 */
type Geometry = {
	size: number;
	valid: boolean[];
	totalValid: number;
	neighbors4: number[][];
	neighbors8: number[][];
	isEdge: boolean[];
	edgeDist: number[];
	cornerSet: Set<number>;
	/** 空き角ごとの X / C / A マス（角が空のときだけ意味を持つ） */
	cornerNear: { corner: number; x: number[]; c: number[]; a: number[] }[];
	/** [p][axis] = [+方向の隣, −方向の隣]。盤外・欠けマスは -1 */
	axisNeighbors: [number, number][][];
	/** [axis][lineId] = そのラインに属するマス */
	lines: number[][][];
	/** [p][axis] = lineId */
	lineIdOf: number[][];
};

const geometryCache = new Map<string, Geometry>();

/**
 * Reversi インスタンスの盤面形状から幾何情報を得る（キャッシュあり）
 *
 * @param o - エンジン
 * @returns 幾何情報
 * @internal
 */
export function getGeometry(o: Reversi): Geometry {
	const key = `${o.mapWidth}x${o.mapHeight}:${o.map.join('')}`;
	const cached = geometryCache.get(key);
	if (cached) return cached;

	const w = o.mapWidth;
	const h = o.mapHeight;
	const size = o.map.length;
	const valid = o.map.map(m => m !== 'null');
	const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
	const at = (x: number, y: number): number => {
		if (!inBounds(x, y)) return -1;
		const p = x + y * w;
		return valid[p] ? p : -1;
	};
	const xy = (p: number): [number, number] => [p % w, Math.floor(p / w)];

	const neighbors4: number[][] = [];
	const neighbors8: number[][] = [];
	const isEdge: boolean[] = [];
	for (let p = 0; p < size; p++) {
		if (!valid[p]) {
			neighbors4.push([]);
			neighbors8.push([]);
			isEdge.push(false);
			continue;
		}
		const [x, y] = xy(p);
		const n4 = D4.map(([dx, dy]) => at(x + dx, y + dy)).filter(q => q >= 0);
		const n8 = D8.map(([dx, dy]) => at(x + dx, y + dy)).filter(q => q >= 0);
		neighbors4.push(n4);
		neighbors8.push(n8);
		isEdge.push(n4.length < 4);
	}

	// 辺からの距離（4 近傍 BFS）
	const edgeDist: number[] = new Array(size).fill(-1);
	const queue: number[] = [];
	for (let p = 0; p < size; p++) {
		if (valid[p] && isEdge[p]) {
			edgeDist[p] = 0;
			queue.push(p);
		}
	}
	while (queue.length > 0) {
		const p = queue.shift()!;
		for (const q of neighbors4[p]) {
			if (edgeDist[q] < 0) {
				edgeDist[q] = edgeDist[p] + 1;
				queue.push(q);
			}
		}
	}

	// 角: 辺マスで 4 近傍が直交する 2 つだけ
	const cornerSet = new Set<number>();
	const cornerNear: Geometry['cornerNear'] = [];
	for (let p = 0; p < size; p++) {
		if (!valid[p] || !isEdge[p] || neighbors4[p].length !== 2) continue;
		const [x, y] = xy(p);
		const dirs = neighbors4[p].map(q => {
			const [qx, qy] = xy(q);
			return [qx - x, qy - y] as [number, number];
		});
		if (dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1] !== 0) continue;
		cornerSet.add(p);
		const [d1, d2] = dirs;
		const c = [at(x + d1[0], y + d1[1]), at(x + d2[0], y + d2[1])].filter(q => q >= 0);
		const xPos = at(x + d1[0] + d2[0], y + d1[1] + d2[1]);
		const a = [at(x + d1[0] * 2, y + d1[1] * 2), at(x + d2[0] * 2, y + d2[1] * 2)]
			.filter(q => q >= 0 && isEdge[q]);
		cornerNear.push({ corner: p, x: xPos >= 0 ? [xPos] : [], c, a });
	}

	// 軸ごとの隣とライン
	const axisNeighbors: [number, number][][] = [];
	const lineIdOf: number[][] = [];
	const lines: number[][][] = AXES.map(() => []);
	for (let p = 0; p < size; p++) {
		axisNeighbors.push([]);
		lineIdOf.push([]);
		if (!valid[p]) continue;
		const [x, y] = xy(p);
		for (let a = 0; a < AXES.length; a++) {
			const [dx, dy] = AXES[a];
			axisNeighbors[p].push([at(x + dx, y + dy), at(x - dx, y - dy)]);
			lineIdOf[p].push(-1);
		}
	}
	for (let a = 0; a < AXES.length; a++) {
		const [dx, dy] = AXES[a];
		for (let p = 0; p < size; p++) {
			if (!valid[p] || lineIdOf[p][a] >= 0) continue;
			// ラインの始端まで戻る
			let [x, y] = xy(p);
			while (at(x - dx, y - dy) >= 0) {
				x -= dx;
				y -= dy;
			}
			const line: number[] = [];
			const id = lines[a].length;
			let q = at(x, y);
			while (q >= 0) {
				line.push(q);
				lineIdOf[q][a] = id;
				x += dx;
				y += dy;
				q = at(x, y);
			}
			lines[a].push(line);
		}
	}

	const geo: Geometry = {
		size,
		valid,
		totalValid: valid.filter(Boolean).length,
		neighbors4,
		neighbors8,
		isEdge,
		edgeDist,
		cornerSet,
		cornerNear,
		axisNeighbors,
		lines,
		lineIdOf,
	};
	geometryCache.set(key, geo);
	return geo;
}

/**
 * 安定石（今後どの手順でも返されない石）の保守的近似を求める
 *
 * @remarks
 * 石 p は、4 軸それぞれについて「軸上の隣が盤外・欠けマス」「隣が同色の安定石」「そのラインに空きがない」のいずれかが成り立つとき安定とみなす。
 * 変化がなくなるまで反復する。
 *
 * @param o - エンジン
 * @param geo - 幾何情報
 * @returns 各マスが安定石か
 * @internal
 */
export function computeStableDiscs(o: Reversi, geo: Geometry): boolean[] {
	const board = o.board;
	const stable: boolean[] = new Array(geo.size).fill(false);
	const lineFull: boolean[][] = geo.lines.map(ls => ls.map(line => line.every(q => board[q] != null)));

	let changed = true;
	while (changed) {
		changed = false;
		for (let p = 0; p < geo.size; p++) {
			if (stable[p] || !geo.valid[p]) continue;
			const c = board[p];
			if (c == null) continue;
			let ok = true;
			for (let a = 0; a < AXES.length; a++) {
				const [plus, minus] = geo.axisNeighbors[p][a];
				if (plus < 0 || minus < 0) continue;
				if ((stable[plus] && board[plus] === c) || (stable[minus] && board[minus] === c)) continue;
				if (lineFull[a][geo.lineIdOf[p][a]]) continue;
				ok = false;
				break;
			}
			if (ok) {
				stable[p] = true;
				changed = true;
			}
		}
	}
	return stable;
}

/**
 * 色ごとの安定石数
 *
 * @internal
 */
function countStable(o: Reversi, geo: Geometry): { black: number; white: number } {
	const stable = computeStableDiscs(o, geo);
	let black = 0;
	let white = 0;
	for (let p = 0; p < geo.size; p++) {
		if (!stable[p]) continue;
		if (o.board[p] === true) black++;
		else if (o.board[p] === false) white++;
	}
	return { black, white };
}

/**
 * 色ごとのフロンティア数（空きに隣接する石の数）
 *
 * @internal
 */
function countFrontier(o: Reversi, geo: Geometry, color: Color): number {
	let n = 0;
	for (let p = 0; p < geo.size; p++) {
		if (o.board[p] !== color) continue;
		if (geo.neighbors8[p].some(q => o.board[q] == null)) n++;
	}
	return n;
}

/**
 * 相手が打てる空き角の数
 *
 * @internal
 */
function countPlayableCorners(o: Reversi, geo: Geometry, color: Color): number {
	let n = 0;
	for (const c of geo.cornerSet) {
		if (o.board[c] == null && o.canPut(color, c)) n++;
	}
	return n;
}

/**
 * 空き角に隣接する X / C マスに乗っている指定色の石数
 *
 * @internal
 */
function countNearDiscs(o: Reversi, geo: Geometry, color: Color): { x: number; c: number } {
	let x = 0;
	let c = 0;
	for (const near of geo.cornerNear) {
		if (o.board[near.corner] != null) continue;
		for (const p of near.x) if (o.board[p] === color) x++;
		for (const p of near.c) if (o.board[p] === color) c++;
	}
	return { x, c };
}

/**
 * 空きマスの連結領域（4 近傍）を求め、各マスの属する領域の空き数を返す
 *
 * @internal
 */
function emptyRegionSizes(o: Reversi, geo: Geometry): Map<number, number> {
	const regionOf = new Map<number, number>();
	const sizes: number[] = [];
	for (let p = 0; p < geo.size; p++) {
		if (!geo.valid[p] || o.board[p] != null || regionOf.has(p)) continue;
		const id = sizes.length;
		let count = 0;
		const stack = [p];
		regionOf.set(p, id);
		while (stack.length > 0) {
			const q = stack.pop()!;
			count++;
			for (const r of geo.neighbors4[q]) {
				if (o.board[r] == null && !regionOf.has(r)) {
					regionOf.set(r, id);
					stack.push(r);
				}
			}
		}
		sizes.push(count);
	}
	const out = new Map<number, number>();
	for (const [p, id] of regionOf) out.set(p, sizes[id]);
	return out;
}

/**
 * 1 手分の特徴量
 *
 * @internal
 */
export type MoveFeatures = {
	corner: number;
	xSquare: number;
	cSquare: number;
	givesCorner: number;
	removesCorner: number;
	oppMobility: number;
	oppPass: number;
	myFrontier: number;
	oppFrontier: number;
	flips: number;
	stableDelta: number;
	discDiff: number;
	oddRegion: number;
	emptyAroundFlipped: number;
	emptyNeighbors: number;
	edgeDist: number;
	secondRing: number;
	aSquare: number;
	myXDiscsDelta: number;
	myCDiscsDelta: number;
	/** 終局させる手なら最終石差、そうでなければ 0 */
	finalDisc: number;
	ended: boolean;
};

/**
 * 候補手のスコア
 *
 * @internal
 */
export type ScoredMove = {
	pos: number;
	score: number;
	features: MoveFeatures;
};

/**
 * 全合法手の特徴量とスコアを計算する
 *
 * @param o - エンジン（評価後は元の状態に戻る）
 * @param botColor - Bot の色
 * @param weights - 重み
 * @returns 合法手ごとのスコア
 * @internal
 */
export function scoreSimpleMoves(o: Reversi, botColor: Color, weights: SimpleWeights = DEFAULT_SIMPLE_WEIGHTS): ScoredMove[] {
	const geo = getGeometry(o);
	const opp = !botColor;
	const cans = o.canPutSomewhere(botColor);
	if (cans.length === 0) return [];

	// 着手前の情報
	let emptyBefore = 0;
	for (let p = 0; p < geo.size; p++) if (geo.valid[p] && o.board[p] == null) emptyBefore++;
	const t = geo.totalValid > 0 ? emptyBefore / geo.totalValid : 0;
	const oppCornersBefore = countPlayableCorners(o, geo, opp);
	const stableBefore = countStable(o, geo);
	const nearBefore = countNearDiscs(o, geo, botColor);
	const regionSizes = emptyBefore <= weights.parityEmptyMax ? emptyRegionSizes(o, geo) : null;

	const xSet = new Set<number>();
	const cSet = new Set<number>();
	const aSet = new Set<number>();
	for (const near of geo.cornerNear) {
		if (o.board[near.corner] != null) continue;
		near.x.forEach(p => xSet.add(p));
		near.c.forEach(p => cSet.add(p));
		near.a.forEach(p => aSet.add(p));
	}

	const blend = (early: number, late: number) => early * t + late * (1 - t);
	const wOppMobility = blend(weights.oppMobilityEarly, weights.oppMobilityLate);
	const wFlips = blend(weights.flipsEarly, weights.flipsLate);
	const wDiscDiff = weights.discDiffLate * (1 - t);
	const wEdgeDist = weights.edgeDistEarly * t;
	const wSecondRing = weights.secondRingEarly * t;

	const results: ScoredMove[] = [];
	for (const pos of cans) {
		const effects = o.effects(botColor, pos);
		let emptyAroundFlipped = 0;
		for (const f of effects) {
			emptyAroundFlipped += geo.neighbors8[f].filter(q => o.board[q] == null).length;
		}
		const emptyNeighbors = geo.neighbors8[pos].filter(q => o.board[q] == null).length;

		o.put(botColor, pos);
		const ended = o.turn === null;
		const oppMobility = o.canPutSomewhere(opp).length;
		const oppPass = !ended && oppMobility === 0 ? 1 : 0;
		const oppCornersAfter = countPlayableCorners(o, geo, opp);
		const stableAfter = countStable(o, geo);
		const myFrontier = countFrontier(o, geo, botColor);
		const oppFrontier = countFrontier(o, geo, opp);
		const nearAfter = countNearDiscs(o, geo, botColor);
		const myCount = botColor ? o.blackCount : o.whiteCount;
		const oppCount = botColor ? o.whiteCount : o.blackCount;
		o.undo();

		const myStableGain = (botColor ? stableAfter.black : stableAfter.white) - (botColor ? stableBefore.black : stableBefore.white);
		const oppStableGain = (botColor ? stableAfter.white : stableAfter.black) - (botColor ? stableBefore.white : stableBefore.black);
		const discDiff = myCount - oppCount;
		const regionSize = regionSizes?.get(pos) ?? 0;

		const features: MoveFeatures = {
			corner: geo.cornerSet.has(pos) ? 1 : 0,
			xSquare: xSet.has(pos) ? 1 : 0,
			cSquare: cSet.has(pos) ? 1 : 0,
			givesCorner: Math.max(0, oppCornersAfter - oppCornersBefore),
			removesCorner: Math.max(0, oppCornersBefore - oppCornersAfter),
			oppMobility,
			oppPass,
			myFrontier,
			oppFrontier,
			flips: effects.length,
			stableDelta: myStableGain - oppStableGain,
			discDiff,
			oddRegion: regionSizes && regionSize % 2 === 1 ? 1 : 0,
			emptyAroundFlipped,
			emptyNeighbors,
			edgeDist: geo.edgeDist[pos],
			secondRing: geo.edgeDist[pos] === 1 ? 1 : 0,
			aSquare: aSet.has(pos) ? 1 : 0,
			myXDiscsDelta: nearAfter.x - nearBefore.x,
			myCDiscsDelta: nearAfter.c - nearBefore.c,
			finalDisc: ended ? discDiff : 0,
			ended,
		};

		let score = 0;
		if (ended) {
			// 終局させる手は最終石差で評価する（勝ち確定を最優先）
			score = features.finalDisc * weights.finalDisc;
		} else {
			score =
				features.corner * weights.corner +
				features.xSquare * weights.xSquare +
				features.cSquare * weights.cSquare +
				features.givesCorner * weights.givesCorner +
				features.removesCorner * weights.removesCorner +
				features.oppMobility * wOppMobility +
				features.oppPass * weights.oppPass +
				features.myFrontier * weights.myFrontier +
				features.oppFrontier * weights.oppFrontier +
				features.flips * wFlips +
				features.stableDelta * weights.stableDelta +
				features.discDiff * wDiscDiff +
				features.oddRegion * weights.oddRegion +
				features.emptyAroundFlipped * weights.emptyAroundFlipped +
				features.emptyNeighbors * weights.emptyNeighbors +
				features.edgeDist * wEdgeDist +
				features.secondRing * wSecondRing +
				features.aSquare * weights.aSquare +
				features.myXDiscsDelta * weights.myXDiscsDelta +
				features.myCDiscsDelta * weights.myCDiscsDelta;
		}
		results.push({ pos, score, features });
	}
	return results;
}

/**
 * 単純モードの着手を決める
 *
 * @param o - エンジン（評価後は元の状態に戻る）
 * @param botColor - Bot の色
 * @param weights - 重み（省略時は既定値）
 * @param rng - 同点時の乱択に使う乱数生成器（0 以上 1 未満）。省略時は Math.random
 * @returns 着手位置。合法手がなければ -1
 * @internal
 */
export function chooseSimpleMove(
	o: Reversi,
	botColor: Color,
	weights: SimpleWeights = DEFAULT_SIMPLE_WEIGHTS,
	rng: () => number = Math.random
): number {
	const scored = scoreSimpleMoves(o, botColor, weights);
	if (scored.length === 0) return -1;
	if (scored.length === 1) return scored[0].pos;
	let best = -Infinity;
	for (const s of scored) if (s.score > best) best = s.score;
	const EPS = 1e-9;
	const top = scored.filter(s => s.score >= best - EPS);
	return top[Math.floor(rng() * top.length)].pos;
}

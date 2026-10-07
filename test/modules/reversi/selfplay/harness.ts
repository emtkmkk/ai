/**
 * リバーシ思考モードの自己対戦ハーネス
 *
 * @remarks
 * 標準 8x8 盤でプレイヤー同士を対戦させ、勝率と石差を集計する。
 * 序盤の数手をランダムにして局面を散らし、先手後手を入れ替えて公平にする。
 */
import Reversi, { Color } from 'misskey-reversi';
import seedrandom = require('seedrandom');
import { ReversiGameSession } from '@/modules/reversi/back';
import { chooseSimpleMove, DEFAULT_SIMPLE_WEIGHTS, SimpleWeights } from '@/modules/reversi/simple-eval';

export const STANDARD_MAP = [
	'--------',
	'--------',
	'--------',
	'---bw---',
	'---wb---',
	'--------',
	'--------',
	'--------',
];

export const REVERSI_OPTS = { isLlotheo: false, canPutEverywhere: false, loopedBoard: false };

/** 1 手を選ぶプレイヤー。盤面は呼び出し後に元の状態であること */
export type Player = {
	name: string;
	choose: (o: Reversi, color: Color, rng: () => number) => number;
};

/**
 * 単純モード（ReversiGameSession.chooseMoveSimple）プレイヤー
 */
export function simplePlayer(): Player {
	const session: any = new ReversiGameSession('selfplay', { id: 'bot' } as any, () => {}, () => {}, () => {}, '', 'simple', 0);
	return {
		name: 'simple',
		choose: (o, color, rng) => {
			session.o = o;
			session.botColor = color;
			return session.chooseMoveSimple(rng);
		},
	};
}

/**
 * 強モード（重み付き評価）プレイヤー
 */
export function evalPlayer(weights: Partial<SimpleWeights> = {}, name = 'eval'): Player {
	const w: SimpleWeights = { ...DEFAULT_SIMPLE_WEIGHTS, ...weights };
	return { name, choose: (o, color, rng) => chooseSimpleMove(o, color, w, rng) };
}

/** 合法手からランダム */
export function randomPlayer(): Player {
	return {
		name: 'random',
		choose: (o, color, rng) => {
			const cans = o.canPutSomewhere(color);
			return cans[Math.floor(rng() * cans.length)];
		},
	};
}

/** 反転数最大（同点は乱択） */
export function greedyPlayer(): Player {
	return {
		name: 'greedy',
		choose: (o, color, rng) => {
			const cans = o.canPutSomewhere(color);
			let best: number[] = [];
			let bestN = -1;
			for (const p of cans) {
				const n = o.effects(color, p).length;
				if (n > bestN) {
					bestN = n;
					best = [p];
				} else if (n === bestN) {
					best.push(p);
				}
			}
			return best[Math.floor(rng() * best.length)];
		},
	};
}

export type GameResult = {
	/** 黒から見た石差 */
	blackDiff: number;
	winner: Color | null;
};

/**
 * 1 局対戦する
 *
 * @param black - 黒番
 * @param white - 白番
 * @param rng - 乱数生成器
 * @param randomPlies - 序盤にランダム着手する手数
 */
export function playGame(black: Player, white: Player, rng: () => number, randomPlies: number, map: string[] = STANDARD_MAP): GameResult {
	const o = new Reversi(map, { ...REVERSI_OPTS });
	let ply = 0;
	while (!o.isEnded) {
		const color = o.turn as Color;
		let pos: number;
		if (ply < randomPlies) {
			const cans = o.canPutSomewhere(color);
			pos = cans[Math.floor(rng() * cans.length)];
		} else {
			const player = color ? black : white;
			pos = player.choose(o, color, rng);
		}
		if (pos < 0 || !o.canPut(color, pos)) {
			throw new Error(`illegal move ${pos} by ${(color ? black : white).name}`);
		}
		o.put(color, pos);
		ply++;
	}
	return { blackDiff: o.blackCount - o.whiteCount, winner: o.winner };
}

export type MatchResult = {
	games: number;
	wins: number;
	draws: number;
	losses: number;
	/** A から見た平均石差 */
	avgDiff: number;
	/** A の勝率（引き分けは 0.5） */
	winRate: number;
	ms: number;
};

/**
 * A と B を games 局対戦させる。半数ずつ色を入れ替える。
 *
 * @param a - プレイヤー A
 * @param b - プレイヤー B
 * @param games - 対局数
 * @param seed - 乱数シード
 * @param randomPlies - 序盤ランダム手数
 * @returns A から見た成績
 */
export function playMatch(a: Player, b: Player, games: number, seed: string, randomPlies: number, map: string[] = STANDARD_MAP): MatchResult {
	const rng = seedrandom(seed);
	const start = Date.now();
	let wins = 0;
	let draws = 0;
	let losses = 0;
	let diffSum = 0;
	for (let i = 0; i < games; i++) {
		const aIsBlack = i % 2 === 0;
		const r = aIsBlack ? playGame(a, b, rng, randomPlies, map) : playGame(b, a, rng, randomPlies, map);
		const aDiff = aIsBlack ? r.blackDiff : -r.blackDiff;
		diffSum += aDiff;
		if (aDiff > 0) wins++;
		else if (aDiff < 0) losses++;
		else draws++;
	}
	return {
		games,
		wins,
		draws,
		losses,
		avgDiff: diffSum / games,
		winRate: (wins + draws * 0.5) / games,
		ms: Date.now() - start,
	};
}

/**
 * 成績を 1 行にまとめる
 */
export function formatMatch(a: Player, b: Player, r: MatchResult): string {
	return `${a.name} vs ${b.name}: ${r.wins}W ${r.draws}D ${r.losses}L  winRate=${(r.winRate * 100).toFixed(1)}%  avgDiff=${r.avgDiff.toFixed(2)}  (${r.games} games, ${r.ms}ms)`;
}

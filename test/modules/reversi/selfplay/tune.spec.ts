/**
 * 強モード評価の重み調整（座標降下）
 *
 * @remarks
 * 通常のテスト実行ではスキップされる。REVERSI_TUNE=1 を付けて実行する。
 * 各重みを 1 つずつ ×0.5 / ×1.5 / 0 に変え、単純モードと現在の最良重みの両方に対する勝率の合計が
 * 改善したら採用する。全候補で同じ乱数シードを使い（共通乱数法）、比較のぶれを抑える。
 *
 * - REVERSI_TUNE_GAMES: 1 マッチの対局数（既定 300）
 * - REVERSI_TUNE_PASSES: 全重みを一巡する回数（既定 1）
 * - REVERSI_TUNE_SEED: 乱数シード（既定 "tune"）
 * - REVERSI_TUNE_LOG: 進捗を追記するファイル
 * - REVERSI_TUNE_START: 開始重みの JSON（省略時は既定値）
 */
import * as fs from 'fs';
import { DEFAULT_SIMPLE_WEIGHTS, SimpleWeights } from '@/modules/reversi/simple-eval';
import { evalPlayer, playMatch, simplePlayer } from './harness';

const enabled = process.env.REVERSI_TUNE === '1';
const describeIf = enabled ? describe : describe.skip;

/** 調整対象から外す重み */
const FIXED_KEYS: (keyof SimpleWeights)[] = ['finalDisc'];
/** 乗算ではなく候補値を直接試す重み */
const DISCRETE: Partial<Record<keyof SimpleWeights, number[]>> = {
	parityEmptyMax: [8, 12, 20, 28],
};
/** 採用に必要な勝率合計の改善幅 */
const MARGIN = 0.01;

describeIf('リバーシ強モード重み調整', () => {
	it('座標降下で重みを調整する', () => {
		const games = Number(process.env.REVERSI_TUNE_GAMES || 300);
		const passes = Number(process.env.REVERSI_TUNE_PASSES || 1);
		const seed = process.env.REVERSI_TUNE_SEED || 'tune';
		const logPath = process.env.REVERSI_TUNE_LOG;
		const start: SimpleWeights = {
			...DEFAULT_SIMPLE_WEIGHTS,
			...(process.env.REVERSI_TUNE_START ? JSON.parse(process.env.REVERSI_TUNE_START) : {}),
		};
		const out = (line: string) => {
			// eslint-disable-next-line no-console
			console.log(line);
			if (logPath) fs.appendFileSync(logPath, line + '\n');
		};

		const legacy = simplePlayer();
		const randomPlies = 4;
		let best = { ...start };
		let bestPlayer = evalPlayer(best, 'best');
		let bestVsLegacy = playMatch(bestPlayer, legacy, games, seed, randomPlies).winRate;
		out(`start: vsLegacy=${(bestVsLegacy * 100).toFixed(1)}% weights=${JSON.stringify(best)}`);

		const keys = (Object.keys(best) as (keyof SimpleWeights)[]).filter(k => !FIXED_KEYS.includes(k));
		for (let pass = 0; pass < passes; pass++) {
			for (const key of keys) {
				const cur = best[key];
				const candidates = DISCRETE[key]
					? DISCRETE[key]!.filter(v => v !== cur)
					: cur === 0
						? [1, -1]
						: [cur * 0.5, cur * 1.5, 0];
				for (const value of candidates) {
					const cand = { ...best, [key]: value };
					const candPlayer = evalPlayer(cand, 'cand');
					const vsLegacy = playMatch(candPlayer, legacy, games, seed, randomPlies).winRate;
					const vsBest = playMatch(candPlayer, bestPlayer, games, seed, randomPlies).winRate;
					const score = vsLegacy + vsBest;
					const baseline = bestVsLegacy + 0.5;
					const accepted = score > baseline + MARGIN;
					out(`pass${pass} ${key}=${value} (was ${cur}): vsLegacy=${(vsLegacy * 100).toFixed(1)}% vsBest=${(vsBest * 100).toFixed(1)}% ${accepted ? 'ACCEPT' : 'reject'}`);
					if (accepted) {
						best = cand;
						bestPlayer = evalPlayer(best, 'best');
						bestVsLegacy = vsLegacy;
					}
				}
			}
			out(`pass${pass} done: vsLegacy=${(bestVsLegacy * 100).toFixed(1)}% weights=${JSON.stringify(best)}`);
		}
		out(`final weights=${JSON.stringify(best)}`);
		expect(best).toBeDefined();
	}, 2 * 60 * 60 * 1000);
});

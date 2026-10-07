/**
 * 思考モード自己対戦ハーネスの実行入口
 *
 * @remarks
 * 通常のテスト実行ではスキップされる。環境変数 REVERSI_SELFPLAY=1 を付けて実行する。
 *
 * - REVERSI_A / REVERSI_B: プレイヤー名（simple / eval / random / greedy）。eval は強モードの評価。既定は eval vs simple
 * - REVERSI_GAMES: 対局数（既定 200）
 * - REVERSI_SEED: 乱数シード（既定 "1"）
 * - REVERSI_RANDOM_PLIES: 序盤ランダム手数（既定 4）
 * - REVERSI_WEIGHTS / REVERSI_WEIGHTS_B: A / B が eval のとき重みを上書きする JSON（既定値との差分）
 *
 * 例: `REVERSI_SELFPLAY=1 REVERSI_GAMES=400 npx jest test/modules/reversi/selfplay.spec.ts`
 */
import { evalPlayer, formatMatch, greedyPlayer, playMatch, Player, randomPlayer, simplePlayer } from './selfplay/harness';

const enabled = process.env.REVERSI_SELFPLAY === '1';
const describeIf = enabled ? describe : describe.skip;

function makePlayer(name: string, weightsEnv: string): Player {
	switch (name) {
		case 'simple': return simplePlayer();
		case 'random': return randomPlayer();
		case 'greedy': return greedyPlayer();
		case 'eval': {
			const raw = process.env[weightsEnv];
			const weights = raw ? JSON.parse(raw) : {};
			return evalPlayer(weights, raw ? `eval(${weightsEnv})` : 'eval');
		}
		default: throw new Error(`unknown player: ${name}`);
	}
}

describeIf('リバーシ思考モード自己対戦', () => {
	it('対戦結果を出力する', () => {
		const a = makePlayer(process.env.REVERSI_A || 'eval', 'REVERSI_WEIGHTS');
		const b = makePlayer(process.env.REVERSI_B || 'simple', 'REVERSI_WEIGHTS_B');
		const games = Number(process.env.REVERSI_GAMES || 200);
		const seed = process.env.REVERSI_SEED || '1';
		const randomPlies = Number(process.env.REVERSI_RANDOM_PLIES || 4);
		const r = playMatch(a, b, games, seed, randomPlies);
		// eslint-disable-next-line no-console
		console.log(formatMatch(a, b, r));
		expect(r.games).toBe(games);
	}, 10 * 60 * 1000);
});

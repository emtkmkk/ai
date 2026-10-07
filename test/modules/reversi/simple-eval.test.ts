/**
 * 強モード評価（simple-eval）のユニットテスト
 */
import Reversi from 'misskey-reversi';
import { chooseSimpleMove, computeStableDiscs, DEFAULT_SIMPLE_WEIGHTS, getGeometry, scoreSimpleMoves } from '@/modules/reversi/simple-eval';

const OPTS = { isLlotheo: false, canPutEverywhere: false, loopedBoard: false };

function board(rows: string[]): Reversi {
	return new Reversi(rows, { ...OPTS });
}

const STANDARD = [
	'--------',
	'--------',
	'--------',
	'---bw---',
	'---wb---',
	'--------',
	'--------',
	'--------',
];

describe('getGeometry', () => {
	it('8x8 標準盤で 4 隅と X/C/A を形状から求める', () => {
		const geo = getGeometry(board(STANDARD));
		expect([...geo.cornerSet].sort((a, b) => a - b)).toEqual([0, 7, 56, 63]);
		const near0 = geo.cornerNear.find(c => c.corner === 0)!;
		expect(near0.x).toEqual([9]);
		expect(near0.c.sort((a, b) => a - b)).toEqual([1, 8]);
		expect(near0.a.sort((a, b) => a - b)).toEqual([2, 16]);
		expect(geo.edgeDist[0]).toBe(0);
		expect(geo.edgeDist[9]).toBe(1);
		expect(geo.edgeDist[27]).toBe(3);
		expect(geo.totalValid).toBe(64);
	});

	it('欠けマスのある盤では欠けの角も隅として検出する', () => {
		const geo = getGeometry(board([
			' ------ ',
			'--------',
			'--------',
			'---wb---',
			'---bw---',
			'--------',
			'--------',
			' ------ ',
		]));
		// 角丸盤: (1,0) と (0,1) が隅になる
		expect(geo.cornerSet.has(1)).toBe(true);
		expect(geo.cornerSet.has(8)).toBe(true);
		expect(geo.cornerSet.has(0)).toBe(false);
	});
});

describe('computeStableDiscs', () => {
	it('初期局面に安定石はない', () => {
		const o = board(STANDARD);
		const stable = computeStableDiscs(o, getGeometry(o));
		expect(stable.some(Boolean)).toBe(false);
	});

	it('角と、角から辺沿いに続く同色の石は安定', () => {
		const o = board([
			'bbb-----',
			'b-------',
			'--------',
			'---bw---',
			'---wb---',
			'--------',
			'--------',
			'--------',
		]);
		const stable = computeStableDiscs(o, getGeometry(o));
		expect(stable[0]).toBe(true);
		expect(stable[1]).toBe(true);
		expect(stable[2]).toBe(true);
		expect(stable[8]).toBe(true);
		expect(stable[27]).toBe(false);
	});

	it('角に接していない辺の石は安定ではない', () => {
		const o = board([
			'---b----',
			'--------',
			'--------',
			'---bw---',
			'---wb---',
			'--------',
			'--------',
			'--------',
		]);
		const stable = computeStableDiscs(o, getGeometry(o));
		expect(stable[3]).toBe(false);
	});

	it('盤が埋まっていれば全部安定', () => {
		const o = board([
			'bbbb',
			'bwwb',
			'bwwb',
			'bbbb',
		]);
		const stable = computeStableDiscs(o, getGeometry(o));
		expect(stable.every(Boolean)).toBe(true);
	});
});

describe('scoreSimpleMoves / chooseSimpleMove', () => {
	it('評価後に盤面が元に戻る', () => {
		const o = board(STANDARD);
		const before = [...o.board];
		const turn = o.turn;
		scoreSimpleMoves(o, true);
		expect(o.board).toEqual(before);
		expect(o.turn).toBe(turn);
	});

	it('合法手がなければ -1、1 手だけならその手を返す', () => {
		const o = board(STANDARD);
		expect(chooseSimpleMove(o, true, DEFAULT_SIMPLE_WEIGHTS, () => 0)).toBeGreaterThanOrEqual(0);
		expect(scoreSimpleMoves(o, true).length).toBe(4);
		const full = board(['bbbb', 'bwwb', 'bwwb', 'bbbb']);
		expect(chooseSimpleMove(full, true)).toBe(-1);
	});

	it('角が取れるなら角を選ぶ', () => {
		// 黒が (0,0) に打てる: 斜め右下に w, w と並び (3,3) の b で止まる
		const o = board([
			'--------',
			'-w------',
			'--w-----',
			'---bw---',
			'---wb---',
			'--------',
			'--------',
			'--------',
		]);
		o.turn = true;
		expect(o.canPut(true, 0)).toBe(true);
		const pos = chooseSimpleMove(o, true, DEFAULT_SIMPLE_WEIGHTS, () => 0);
		expect(pos).toBe(0);
		const scored = scoreSimpleMoves(o, true);
		expect(scored.find(s => s.pos === 0)!.features.corner).toBe(1);
	});

	it('X に打つ手は他の手より低く評価される', () => {
		// 黒は (1,1)=9 に打てる（斜め右下 (2,2) の w を (3,3) の b で挟む）
		const o = board([
			'--------',
			'--------',
			'--w-----',
			'---bw---',
			'---wb---',
			'--------',
			'--------',
			'--------',
		]);
		o.turn = true;
		const scored = scoreSimpleMoves(o, true);
		const x = scored.find(s => s.pos === 9);
		expect(x).toBeDefined();
		expect(x!.features.xSquare).toBe(1);
		const others = scored.filter(s => s.pos !== 9);
		expect(others.length).toBeGreaterThan(0);
		expect(Math.max(...others.map(s => s.score))).toBeGreaterThan(x!.score);
	});

	it('終局させる手は最終石差で評価される', () => {
		const o = board([
			'bbb-',
			'bbbw',
			'bbbb',
			'bbbb',
		]);
		o.turn = true;
		const scored = scoreSimpleMoves(o, true);
		expect(scored.length).toBe(1);
		expect(scored[0].features.ended).toBe(true);
		expect(scored[0].features.finalDisc).toBe(16);
		expect(scored[0].score).toBe(16 * DEFAULT_SIMPLE_WEIGHTS.finalDisc);
	});

	it('相手をパスにする手は oppPass が立ち、終局ではない', () => {
		// 黒の合法手は (3,0)=3 と (3,2)=11 のみ。どちらを打っても白は打てず、黒は残りの一方を打てるので終局ではない
		const o = board([
			'wbw-',
			'----',
			'wbw-',
			'----',
		]);
		o.turn = true;
		const scored = scoreSimpleMoves(o, true);
		expect(scored.map(s => s.pos).sort((a, b) => a - b)).toEqual([3, 11]);
		for (const s of scored) {
			expect(s.features.ended).toBe(false);
			expect(s.features.oppMobility).toBe(0);
			expect(s.features.oppPass).toBe(1);
		}
	});
});

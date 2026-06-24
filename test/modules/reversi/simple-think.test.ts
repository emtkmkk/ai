/**
 * 単純モード思考ヘルパーと幾何計算のユニットテスト
 */
import Reversi from 'misskey-reversi';
import { ReversiGameSession } from '@/modules/reversi/back';

const STANDARD_MAP = [
	'--------',
	'--------',
	'--------',
	'---bw---',
	'---wb---',
	'--------',
	'--------',
	'--------',
];

/** テスト用に ReversiGameSession の private メンバへアクセスする型 */
type TestSession = any;

const REVERSI_OPTS = { isLlotheo: false, canPutEverywhere: false, loopedBoard: false };

/**
 * テスト用セッションを生成し、標準 8x8 盤面をセットする
 *
 * @param botIsBlack - Bot が黒なら true
 * @returns 初期化済みセッション
 */
function createTestSession(botIsBlack = true): TestSession {
	const session: TestSession = new ReversiGameSession(
		'test-game-id',
		{ id: 'bot-user' } as any,
		() => {},
		() => {},
		() => {},
		'',
		true,
		0
	);
	session.o = new Reversi(STANDARD_MAP, REVERSI_OPTS);
	session.botColor = botIsBlack;
	session.o.turn = botIsBlack;
	return session;
}

describe('ReversiGameSession 幾何ヘルパー', () => {
	it('8x8 標準盤で simpleCorners が隅を返す', () => {
		const session = createTestSession();
		const corners = session.simpleCorners();
		expect(corners.length).toBeGreaterThanOrEqual(2);
		const poses = corners.map((c: { pos: number }) => c.pos);
		expect(poses).toContain(0);
		expect(poses).toContain(63);
	});

	it('simpleBuildSets が空き角に対して C/X 集合を構築する', () => {
		const session = createTestSession();
		const cornersWithDirs = session.simpleCorners();
		const emptyCornerPoses = cornersWithDirs.map(c => c.pos);
		const edgeDist = new Map<number, number>();
		const { Cset, Xset } = session.simpleBuildSets(emptyCornerPoses, cornersWithDirs, edgeDist);
		expect(Cset.has(1)).toBe(true);
		expect(Cset.has(8)).toBe(true);
		expect(Xset.has(9)).toBe(true);
	});

	it('isEmptySingleRegion が単一連結空き領域を true と判定する', () => {
		const session = createTestSession();
		expect(session.isEmptySingleRegion()).toBe(true);
	});
});

describe('ReversiGameSession 相手読みヘルパー', () => {
	it('getOpponentMobilityAfter が put/undo 後の相手合法手数を返す', () => {
		const session = createTestSession(true);
		const o = session.o as any;
		const legal = o.canPutSomewhere(true) as number[];
		expect(legal.length).toBeGreaterThan(0);
		const mobility = session.getOpponentMobilityAfter(legal[0]);
		expect(typeof mobility).toBe('number');
		expect(mobility).toBeGreaterThanOrEqual(0);
	});

	it('countMyFrontierAfter が 0 以上の整数を返す', () => {
		const session = createTestSession(true);
		const o = session.o as any;
		const legal = o.canPutSomewhere(true) as number[];
		const frontier = session.countMyFrontierAfter(legal[0]);
		expect(frontier).toBeGreaterThanOrEqual(0);
	});

	it('givesCornerToOpponent が boolean を返す', () => {
		const session = createTestSession(true);
		const cornersWithDirs = session.simpleCorners();
		const emptyCornerPoses = cornersWithDirs.map(c => c.pos).filter(k => session.simpleIsEmpty(k));
		const o = session.o as any;
		const legal = o.canPutSomewhere(true) as number[];
		const result = session.givesCornerToOpponent(legal[0], emptyCornerPoses);
		expect(typeof result).toBe('boolean');
	});
});

describe('ReversiGameSession 取得済み角隣辺', () => {
	it('Bot が角を持たない初期局面では取得済み角隣辺が空', () => {
		const session = createTestSession(true);
		const cornersWithDirs = session.simpleCorners();
		const owned = session.simpleBuildOwnedCornerEdgeSet(cornersWithDirs);
		expect(owned.size).toBe(0);
	});

	it('Bot が角を取った局面では取得済み角隣辺に辺マスが含まれる', () => {
		const session = createTestSession(true);
		const o = session.o as any;
		o.board[0] = true;
		const cornersWithDirs = session.simpleCorners();
		const owned = session.simpleBuildOwnedCornerEdgeSet(cornersWithDirs);
		expect(owned.size).toBeGreaterThan(0);
		expect(owned.has(8)).toBe(true);
	});
});

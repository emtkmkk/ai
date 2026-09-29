import {
	ActiveUserWindow,
	activityProbability,
	addToSinceLastGame,
	emptySinceLastGame,
	isGateOpen,
	isNaturalStartHour,
	TimelineActivityTracker,
} from '@/utils/timeline-activity';
import type { SinceLastGame } from '@/utils/timeline-activity';

const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);
/** n人がそれぞれ posts 回投稿した状態 */
const userPosts = (n: number, posts = 3) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`u${i}`, posts]));

describe('isGateOpen', () => {
	it('今日8時以降にまだ開催がなければ開いている（前日分は持ち越さない）', () => {
		expect(isGateOpen(at(8, 5), null, emptySinceLastGame())).toBe(true);
		expect(isGateOpen(at(8, 5), { startedAt: at(0, 30).getTime() }, emptySinceLastGame())).toBe(true);
	});

	it('3回以上投稿した人が5人未満なら閉じている', () => {
		const lastGame = { startedAt: at(12).getTime(), finishedAt: at(12, 10).getTime(), votes: [1, 2, 3] };
		expect(isGateOpen(at(15), lastGame, { posts: 100, userPosts: userPosts(4) })).toBe(false);
		expect(isGateOpen(at(15), lastGame, { posts: 100, userPosts: { ...userPosts(4), x: 2 } })).toBe(false);
	});

	it('5人以上かつ100投稿なら時間に関係なく開いている（お流れでも）', () => {
		const lastGame = { startedAt: at(12).getTime(), finishedAt: at(12, 10).getTime(), votes: [] };
		expect(isGateOpen(at(12, 20), lastGame, { posts: 100, userPosts: userPosts(5) })).toBe(true);
	});

	it('投稿が足りなければ終了から60分（お流れなら110分）で開く', () => {
		const since = { posts: 30, userPosts: userPosts(5) };
		const normal = { startedAt: at(12).getTime(), finishedAt: at(12, 10).getTime(), votes: [1, 2] };
		expect(isGateOpen(at(13, 9), normal, since)).toBe(false);
		expect(isGateOpen(at(13, 10), normal, since)).toBe(true);
		const onagare = { ...normal, votes: [1] };
		expect(isGateOpen(at(13, 10), onagare, since)).toBe(false);
		expect(isGateOpen(at(14, 0), onagare, since)).toBe(true);
		// 参加者情報がなければお流れ扱いしない（アンケート）
		expect(isGateOpen(at(13, 10), { startedAt: normal.startedAt, finishedAt: normal.finishedAt }, since)).toBe(true);
	});
});

describe('addToSinceLastGame', () => {
	it('人ごとの投稿数を3回まで数える', () => {
		let since = emptySinceLastGame();
		for (let i = 0; i < 4; i++) since = addToSinceLastGame(since, 'a') ?? since;
		expect(since).toEqual({ posts: 4, userPosts: { a: 3 } });
	});

	it('100投稿かつ5人に達したら変化しない', () => {
		expect(addToSinceLastGame({ posts: 100, userPosts: userPosts(5) }, 'z')).toBeNull();
		expect(addToSinceLastGame({ posts: 100, userPosts: userPosts(4) }, 'z')).toEqual({ posts: 100, userPosts: { ...userPosts(4), z: 1 } });
	});
});

it('activityProbability は 係数 × 機嫌 × (人数 - 3) を0〜1に収める', () => {
	expect(activityProbability(3, 1, 0.02)).toBe(0);
	expect(activityProbability(13, 0.5, 0.02)).toBeCloseTo(0.1);
	expect(activityProbability(1000, 1, 0.02)).toBe(1);
});

it('0〜7時は自動開催しない', () => {
	expect(isNaturalStartHour(0)).toBe(false);
	expect(isNaturalStartHour(7)).toBe(false);
	expect(isNaturalStartHour(8)).toBe(true);
	expect(isNaturalStartHour(23)).toBe(true);
});

it('ActiveUserWindow は直近60分に3回以上投稿した人数を数える', () => {
	const window = new ActiveUserWindow();
	const t = at(12).getTime();
	const min = 60 * 1000;
	for (const m of [0, 10, 20]) window.record('a', t + m * min);
	for (const m of [5, 50]) window.record('b', t + m * min);
	expect(window.count(t + 30 * min)).toBe(1);
	// b が3回目を投稿すると2人
	window.record('b', t + 55 * min);
	expect(window.count(t + 56 * min)).toBe(2);
	// 60分経過で a の最初の投稿が外れ、a は2回になる
	expect(window.count(t + 60 * min)).toBe(1);
	expect(window.count(t + 200 * min)).toBe(0);
});

describe('TimelineActivityTracker', () => {
	const create = (saved?: Partial<SinceLastGame>) => {
		const saves: SinceLastGame[] = [];
		const tracker = new TimelineActivityTracker(() => 'me', () => saved, since => saves.push(since));
		return { tracker, saves };
	};

	it('自分・bot・重複ノートは数えない', () => {
		const { tracker, saves } = create();
		tracker.onNote({ id: '1', userId: 'me' });
		tracker.onNote({ id: '2', userId: 'bot', user: { isBot: true } });
		tracker.onNote({ id: '3', userId: 'a' });
		tracker.onNote({ id: '3', userId: 'a' });
		expect(tracker.since).toEqual({ posts: 1, userPosts: { a: 1 } });
		expect(saves).toHaveLength(1);
	});

	it('保存値を読み込み、旧形式は捨てる。reset で空にして保存する', () => {
		expect(create({ posts: 7, userPosts: { a: 2 } }).tracker.since).toEqual({ posts: 7, userPosts: { a: 2 } });
		expect(create({ posts: 7 }).tracker.since).toEqual(emptySinceLastGame());
		const { tracker, saves } = create({ posts: 7, userPosts: { a: 2 } });
		tracker.reset();
		expect(tracker.since).toEqual(emptySinceLastGame());
		expect(saves).toEqual([emptySinceLastGame()]);
	});
});

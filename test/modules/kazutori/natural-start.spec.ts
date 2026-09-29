import {
	ActiveUserWindow,
	addToSinceLastGame,
	emptySinceLastGame,
	guaranteeProbability,
	isGateOpen,
	isNaturalStartHour,
	naturalStartProbabilityByUsers,
	pickGuaranteeTime,
} from '@/modules/kazutori/natural-start';

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

describe('naturalStartProbabilityByUsers', () => {
	it('0.03 × 機嫌 × (人数 - 3) で、0〜1に収める', () => {
		expect(naturalStartProbabilityByUsers(3, 1)).toBe(0);
		expect(naturalStartProbabilityByUsers(1, 1)).toBe(0);
		expect(naturalStartProbabilityByUsers(13, 0.5)).toBeCloseTo(0.15);
		expect(naturalStartProbabilityByUsers(100, 2)).toBe(1);
	});
});

it('0〜7時は自然発生しない', () => {
	expect(isNaturalStartHour(0)).toBe(false);
	expect(isNaturalStartHour(7)).toBe(false);
	expect(isNaturalStartHour(8)).toBe(true);
	expect(isNaturalStartHour(23)).toBe(true);
});

it('保証判定の確率はその日の上限/8（最大1）', () => {
	expect(guaranteeProbability(0)).toBe(0);
	expect(guaranteeProbability(4)).toBe(0.5);
	expect(guaranteeProbability(8)).toBe(1);
	expect(guaranteeProbability(12)).toBe(1);
});

it('保証判定の時刻は 8:00〜9:59', () => {
	expect(pickGuaranteeTime(at(0), () => 0)).toBe(at(8).getTime());
	expect(pickGuaranteeTime(at(0), () => 0.9999)).toBe(at(9, 59).getTime());
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

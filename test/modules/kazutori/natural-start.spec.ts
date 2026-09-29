import {
	ActiveUserWindow,
	addToSinceLastGame,
	guaranteeProbability,
	isGateOpen,
	isNaturalStartHour,
	naturalStartProbabilityByUsers,
	pickGuaranteeTime,
} from '@/modules/kazutori/natural-start';

const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);
const users = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

describe('isGateOpen', () => {
	it('今日8時以降にまだ開催がなければ開いている（前日分は持ち越さない）', () => {
		expect(isGateOpen(at(8, 5), null, { posts: 0, userIds: [] })).toBe(true);
		expect(isGateOpen(at(8, 5), { startedAt: at(0, 30).getTime() }, { posts: 0, userIds: [] })).toBe(true);
	});

	it('前回の開催以降に5人未満なら閉じている', () => {
		const lastGame = { startedAt: at(12).getTime(), finishedAt: at(12, 10).getTime(), votes: [1, 2, 3] };
		expect(isGateOpen(at(15), lastGame, { posts: 100, userIds: users(4) })).toBe(false);
	});

	it('5人以上かつ100投稿なら時間に関係なく開いている（お流れでも）', () => {
		const lastGame = { startedAt: at(12).getTime(), finishedAt: at(12, 10).getTime(), votes: [] };
		expect(isGateOpen(at(12, 20), lastGame, { posts: 100, userIds: users(5) })).toBe(true);
	});

	it('投稿が足りなければ終了から60分（お流れなら110分）で開く', () => {
		const since = { posts: 30, userIds: users(5) };
		const normal = { startedAt: at(12).getTime(), finishedAt: at(12, 10).getTime(), votes: [1, 2] };
		expect(isGateOpen(at(13, 9), normal, since)).toBe(false);
		expect(isGateOpen(at(13, 10), normal, since)).toBe(true);
		const onagare = { ...normal, votes: [1] };
		expect(isGateOpen(at(13, 10), onagare, since)).toBe(false);
		expect(isGateOpen(at(14, 0), onagare, since)).toBe(true);
	});
});

describe('addToSinceLastGame', () => {
	it('投稿数と人数を頭打ちまで数え、変化がなければ null', () => {
		let since = { posts: 0, userIds: [] as string[] };
		since = addToSinceLastGame(since, 'a')!;
		since = addToSinceLastGame(since, 'a')!;
		expect(since).toEqual({ posts: 2, userIds: ['a'] });
		expect(addToSinceLastGame({ posts: 100, userIds: users(5) }, 'z')).toBeNull();
		expect(addToSinceLastGame({ posts: 100, userIds: users(4) }, 'z')).toEqual({ posts: 100, userIds: [...users(4), 'z'] });
	});
});

describe('naturalStartProbabilityByUsers', () => {
	it('0.029 × 機嫌 × (人数 - 6) で、0〜1に収める', () => {
		expect(naturalStartProbabilityByUsers(6, 1)).toBe(0);
		expect(naturalStartProbabilityByUsers(3, 1)).toBe(0);
		expect(naturalStartProbabilityByUsers(16, 0.5)).toBeCloseTo(0.145);
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

it('ActiveUserWindow は直近30分の人数を数える', () => {
	const window = new ActiveUserWindow();
	const t = at(12).getTime();
	window.record('a', t);
	window.record('b', t + 10 * 60 * 1000);
	window.record('a', t + 20 * 60 * 1000);
	expect(window.count(t + 25 * 60 * 1000)).toBe(2);
	// b は40分経過で外れ、a は20分後に再投稿しているので残る
	expect(window.count(t + 40 * 60 * 1000)).toBe(1);
	expect(window.count(t + 60 * 60 * 1000)).toBe(0);
});

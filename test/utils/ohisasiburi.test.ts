import {
	isOhisasiburi,
	isPostedWhileTracked,
	needsOhisasiburiCheck,
	OHISASIBURI_DAYS,
	shouldReactOhisasiburi,
} from '@/utils/ohisasiburi';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-18T12:00:00.000Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY).toISOString();

describe('isOhisasiburi', () => {
	it('14日以上空いていれば久しぶり', () => {
		expect(isOhisasiburi(daysAgo(14), now)).toBe(true);
		expect(isOhisasiburi(daysAgo(30), now.toISOString())).toBe(true);
	});

	it('14日未満なら久しぶりではない', () => {
		expect(isOhisasiburi(daysAgo(13.9), now)).toBe(false);
		expect(isOhisasiburi(daysAgo(0), now)).toBe(false);
	});

	it('前回投稿が不明・不正なら久しぶり扱いしない', () => {
		expect(isOhisasiburi(null, now)).toBe(false);
		expect(isOhisasiburi(undefined, now)).toBe(false);
		expect(isOhisasiburi('not a date', now)).toBe(false);
	});

	it('日数の閾値を変えられる', () => {
		expect(isOhisasiburi(daysAgo(7), now, 7)).toBe(true);
		expect(isOhisasiburi(daysAgo(7), now, OHISASIBURI_DAYS)).toBe(false);
	});
});

describe('needsOhisasiburiCheck', () => {
	it('記録がなければ確認が必要', () => {
		expect(needsOhisasiburiCheck(undefined, now)).toBe(true);
		expect(needsOhisasiburiCheck(null, now)).toBe(true);
	});

	it('記録が最近なら確認不要', () => {
		expect(needsOhisasiburiCheck(daysAgo(1), now)).toBe(false);
	});

	it('記録が14日以上前なら確認が必要', () => {
		expect(needsOhisasiburiCheck(daysAgo(20), now)).toBe(true);
	});
});

describe('isPostedWhileTracked', () => {
	const tracked = { isTracked: true, trackedSince: daysAgo(30) };

	it('追跡開始以降の投稿なら true', () => {
		expect(isPostedWhileTracked(daysAgo(20), tracked)).toBe(true);
		expect(isPostedWhileTracked(daysAgo(30), tracked)).toBe(true);
	});

	it('追跡開始より前の投稿なら false', () => {
		expect(isPostedWhileTracked(daysAgo(31), tracked)).toBe(false);
	});

	it('追跡中でない・開始日時が不明なら false', () => {
		expect(isPostedWhileTracked(daysAgo(20), { isTracked: false, trackedSince: daysAgo(30) })).toBe(false);
		expect(isPostedWhileTracked(daysAgo(20), { isTracked: true, trackedSince: null })).toBe(false);
		expect(isPostedWhileTracked(daysAgo(20), { isTracked: true })).toBe(false);
		expect(isPostedWhileTracked(daysAgo(20), null)).toBe(false);
		expect(isPostedWhileTracked(daysAgo(20), undefined)).toBe(false);
	});

	it('投稿日時が不明・不正なら false', () => {
		expect(isPostedWhileTracked(null, tracked)).toBe(false);
		expect(isPostedWhileTracked('bad', tracked)).toBe(false);
	});
});

describe('shouldReactOhisasiburi', () => {
	const tracked = { isTracked: true, trackedSince: daysAgo(60) };

	it('追跡中に投稿された直前の投稿から14日以上空いていれば反応する', () => {
		expect(shouldReactOhisasiburi({ createdAt: daysAgo(15) }, tracked, now)).toBe(true);
	});

	it('14日未満なら反応しない', () => {
		expect(shouldReactOhisasiburi({ createdAt: daysAgo(10) }, tracked, now)).toBe(false);
	});

	it('直前の投稿が追跡開始より前（フォロー前に取り込まれたもの）なら反応しない', () => {
		expect(shouldReactOhisasiburi({ createdAt: daysAgo(40) }, { isTracked: true, trackedSince: daysAgo(20) }, now)).toBe(false);
	});

	it('追跡中でなければ反応しない', () => {
		expect(shouldReactOhisasiburi({ createdAt: daysAgo(15) }, { isTracked: false, trackedSince: daysAgo(60) }, now)).toBe(false);
		expect(shouldReactOhisasiburi({ createdAt: daysAgo(15) }, undefined, now)).toBe(false);
	});

	it('直前の投稿がなければ反応しない', () => {
		expect(shouldReactOhisasiburi(undefined, tracked, now)).toBe(false);
		expect(shouldReactOhisasiburi(null, tracked, now)).toBe(false);
		expect(shouldReactOhisasiburi({ createdAt: null }, tracked, now)).toBe(false);
	});
});

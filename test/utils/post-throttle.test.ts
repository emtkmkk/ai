import { PostThrottle } from '@/utils/post-throttle';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const flush = () => jest.advanceTimersByTimeAsync(0);
// random=0.5 で自動解放は 45〜75秒の中央の60秒になる
const createThrottle = () => new PostThrottle(undefined, undefined, undefined, undefined, () => 0.5);

test('first post is immediate, next waits for the auto release time', async () => {
	const throttle = createThrottle();
	const posted: string[] = [];
	const post = (name: string) => throttle.enqueue(async () => { posted.push(name); return name; });

	await expect(post('a')).resolves.toBe('a');
	const b = post('b');
	await jest.advanceTimersByTimeAsync(59999);
	expect(posted).toEqual(['a']);
	await jest.advanceTimersByTimeAsync(1);
	await expect(b).resolves.toBe('b');
	expect(posted).toEqual(['a', 'b']);
});

test('other user note releases one queued post after 3 seconds', async () => {
	const throttle = createThrottle();
	const posted: string[] = [];
	const post = (name: string) => throttle.enqueue(async () => { posted.push(name); });

	await post('a');
	void post('b');
	void post('c');
	await jest.advanceTimersByTimeAsync(10000);
	throttle.notifyOtherNote();
	throttle.notifyOtherNote(); // 2件目以降は同じ待機に影響しない
	await jest.advanceTimersByTimeAsync(2999);
	expect(posted).toEqual(['a']);
	await jest.advanceTimersByTimeAsync(1);
	expect(posted).toEqual(['a', 'b']);

	// b の投稿で再び待機状態に戻る
	await jest.advanceTimersByTimeAsync(10000);
	expect(posted).toEqual(['a', 'b']);
	throttle.notifyOtherNote();
	await jest.advanceTimersByTimeAsync(3000);
	expect(posted).toEqual(['a', 'b', 'c']);
});

test('post is immediate once the wait has already elapsed', async () => {
	const throttle = createThrottle();
	const posted: string[] = [];
	const post = (name: string) => throttle.enqueue(async () => { posted.push(name); });

	await post('a');
	throttle.notifyOtherNote();
	await jest.advanceTimersByTimeAsync(5000);
	void post('b');
	await flush();
	expect(posted).toEqual(['a', 'b']);
});

test('failed post rejects and still starts the wait', async () => {
	const throttle = createThrottle();
	await expect(throttle.enqueue(async () => { throw new Error('x'); })).rejects.toThrow('x');
	let done = false;
	void throttle.enqueue(async () => { done = true; });
	await jest.advanceTimersByTimeAsync(59999);
	expect(done).toBe(false);
	await jest.advanceTimersByTimeAsync(1);
	expect(done).toBe(true);
});

test.each([[0, 45000], [0.999999, 75000]])('auto release wait is between 45 and 75 seconds (random=%p)', async (random, waitMs) => {
	const throttle = new PostThrottle(undefined, undefined, undefined, undefined, () => random);
	await throttle.enqueue(async () => {});
	let done = false;
	void throttle.enqueue(async () => { done = true; });
	await jest.advanceTimersByTimeAsync(waitMs - 1);
	expect(done).toBe(false);
	await jest.advanceTimersByTimeAsync(1);
	expect(done).toBe(true);
});

test('markPosted restarts the wait for queued posts', async () => {
	const throttle = createThrottle();
	await throttle.enqueue(async () => {});
	let done = false;
	void throttle.enqueue(async () => { done = true; });
	await jest.advanceTimersByTimeAsync(50000);
	throttle.markPosted();
	await jest.advanceTimersByTimeAsync(59999);
	expect(done).toBe(false);
	await jest.advanceTimersByTimeAsync(1);
	expect(done).toBe(true);
});

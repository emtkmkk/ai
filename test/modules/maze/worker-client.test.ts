import { createMazeRunner, MazeBusyError } from '@/modules/maze/worker-client';

const workerPath = require.resolve('./worker-fixture.cjs');

test('receives binary output and releases its process exit listener', async () => {
	const listeners = process.listenerCount('exit');
	const run = createMazeRunner(workerPath, 3000);
	expect(await run('image')).toEqual(Buffer.from('image'));
	expect(await run('next')).toEqual(Buffer.from('next'));
	expect(process.listenerCount('exit')).toBe(listeners);
});

test('parent stays responsive, rejects concurrent work, kills a hung child and recovers', async () => {
	const listeners = process.listenerCount('exit');
	const run = createMazeRunner(workerPath, 1000);
	const hung = expect(run('hang')).rejects.toThrow('timed out');
	await expect(run('concurrent')).rejects.toBeInstanceOf(MazeBusyError);
	let ticks = 0;
	const timer = setInterval(() => ticks++, 20);
	try {
		await hung;
	} finally {
		clearInterval(timer);
	}
	expect(ticks).toBeGreaterThan(5);
	expect(await run('recovered')).toEqual(Buffer.from('recovered'));
	expect(process.listenerCount('exit')).toBe(listeners);
});

test.each(['crash', 'empty', 'invalid'])('rejects %s responses and allows the next job', async seed => {
	const run = createMazeRunner(workerPath, 3000);
	await expect(run(seed)).rejects.toThrow();
	expect(await run('recovered')).toEqual(Buffer.from('recovered'));
});

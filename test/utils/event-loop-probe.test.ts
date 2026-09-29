jest.mock('perf_hooks', () => ({ performance: { now: jest.fn() } }));
import { performance } from 'perf_hooks';
import { EventLoopProbe } from '@/utils/event-loop-probe';

afterEach(() => jest.restoreAllMocks());

test('a wall-clock jump does not trigger a hang', () => {
	(performance.now as jest.Mock).mockReturnValueOnce(0).mockReturnValueOnce(10000);
	jest.spyOn(Date, 'now').mockReturnValueOnce(100000).mockReturnValueOnce(340000);
	jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 0, system: 0 });
	expect(new EventLoopProbe().sample(10000)).toEqual({
		elapsedMs: 10000, delayMs: 0, cpuUserMs: 0, cpuSystemMs: 0, wallClockDeltaMs: 230000,
	});
});

test('measures elapsed time and CPU deltas per interval, including after a stall', () => {
	(performance.now as jest.Mock).mockReturnValueOnce(0).mockReturnValueOnce(242510).mockReturnValueOnce(252510);
	jest.spyOn(Date, 'now').mockReturnValueOnce(100000).mockReturnValueOnce(342510).mockReturnValueOnce(352510);
	jest.spyOn(process, 'cpuUsage')
		.mockReturnValueOnce({ user: 100000, system: 200000 })
		.mockReturnValueOnce({ user: 200100000, system: 5200000 })
		.mockReturnValueOnce({ user: 200120000, system: 5201000 });
	const probe = new EventLoopProbe();
	expect(probe.sample(10000)).toEqual({
		elapsedMs: 242510, delayMs: 232510, cpuUserMs: 200000, cpuSystemMs: 5000, wallClockDeltaMs: 0,
	});
	expect(probe.sample(10000)).toEqual({
		elapsedMs: 10000, delayMs: 0, cpuUserMs: 20, cpuSystemMs: 1, wallClockDeltaMs: 0,
	});
});

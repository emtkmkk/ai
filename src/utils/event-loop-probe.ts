import { performance } from 'perf_hooks';

export type EventLoopSample = {
	elapsedMs: number;
	delayMs: number;
	cpuUserMs: number;
	cpuSystemMs: number;
	wallClockDeltaMs: number;
};

/** Wall-clock adjustments must not be mistaken for an event-loop stall. */
export class EventLoopProbe {
	private monotonic = performance.now();
	private wallClock = Date.now();
	private cpu = process.cpuUsage();

	sample(intervalMs: number): EventLoopSample {
		const monotonic = performance.now();
		const wallClock = Date.now();
		const cpu = process.cpuUsage();
		const elapsedMs = monotonic - this.monotonic;
		const sample = {
			elapsedMs: Math.round(elapsedMs),
			delayMs: Math.round(Math.max(0, elapsedMs - intervalMs)),
			cpuUserMs: Math.round((cpu.user - this.cpu.user) / 1000),
			cpuSystemMs: Math.round((cpu.system - this.cpu.system) / 1000),
			wallClockDeltaMs: Math.round(wallClock - this.wallClock - elapsedMs),
		};
		this.monotonic = monotonic;
		this.wallClock = wallClock;
		this.cpu = cpu;
		return sample;
	}
}

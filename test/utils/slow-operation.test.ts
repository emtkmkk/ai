jest.mock('perf_hooks', () => ({ performance: { now: jest.fn() } }));
import { performance } from 'perf_hooks';
import { getRecentSlowOperations, measureSync, traceSync } from '@/utils/slow-operation';

test('preserves return values/errors and records only slow sync operations without arguments', () => {
	let now = 0;
	(performance.now as jest.Mock).mockImplementation(() => now);
	expect(measureSync('fast', () => 42)).toBe(42);
	const failure = new Error('private payload');
	expect(() => measureSync('slow', () => { now += 1200; throw failure; })).toThrow(failure);
	const entries = getRecentSlowOperations();
	expect(entries).toHaveLength(1);
	expect(entries[0]).toEqual({ name: 'slow', durationMs: 1200, endedAt: expect.any(String) });
	expect(JSON.stringify(entries)).not.toContain('private');
	for (let i = 0; i < 10; i++) measureSync(`slow-${i}`, () => { now += 1500; });
	expect(getRecentSlowOperations()).toHaveLength(8);
	now += 600001;
	expect(getRecentSlowOperations()).toEqual([]);
});

test('decorated methods preserve this and parameters', () => {
	class Example {
		value = 10;
		@traceSync('example')
		add(value: number) { return this.value + value; }
	}
	expect(new Example().add(5)).toBe(15);
});

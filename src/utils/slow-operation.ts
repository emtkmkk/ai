import { performance } from 'perf_hooks';

type SlowOperation = { name: string; durationMs: number; endedAt: string; endedMonotonic: number };
const recent: SlowOperation[] = [];

/** Synchronous work only. Never retain arguments, results, user IDs or message text. */
export function measureSync<T>(name: string, operation: () => T): T {
	const start = performance.now();
	try {
		return operation();
	} finally {
		const end = performance.now();
		if (end - start >= 1000) {
			recent.push({ name, durationMs: Math.round(end - start), endedAt: new Date().toISOString(), endedMonotonic: end });
			if (recent.length > 8) recent.shift();
		}
	}
}

export function getRecentSlowOperations() {
	const now = performance.now();
	return recent.filter(entry => now - entry.endedMonotonic <= 10 * 60 * 1000)
		.map(({ name, durationMs, endedAt }) => ({ name, durationMs, endedAt }));
}

/** Decorator for synchronous methods, preserving this, return values and exceptions. */
export function traceSync(name: string): MethodDecorator {
	return (_target, _key, descriptor: PropertyDescriptor) => {
		const original = descriptor.value;
		descriptor.value = function (...args: any[]) {
			return measureSync(name, () => original.apply(this, args));
		};
	};
}

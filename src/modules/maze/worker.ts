// This entry point deliberately imports no bot configuration, DB or streaming code.
import { performance } from 'perf_hooks';
import { genMaze } from './gen-maze';
import { renderMaze } from './render-maze';

process.on('disconnect', () => process.exit(1));
process.once('message', ({ seed, size }: { seed: string | number; size?: string | number }) => {
	try {
		const started = performance.now();
		const maze = genMaze(seed, size);
		const generated = performance.now();
		const data = renderMaze(seed, maze);
		console.log(`[maze-worker] generation=${Math.round(generated - started)}ms render=${Math.round(performance.now() - generated)}ms size=${maze.length}`);
		process.send!({ type: 'result', data }, error => process.exit(error ? 1 : 0));
	} catch (error) {
		console.error('[maze-worker] failed:', error);
		process.exit(1);
	}
});

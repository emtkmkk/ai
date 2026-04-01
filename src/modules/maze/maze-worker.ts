import { genMaze } from './gen-maze';
import { renderMaze } from './render-maze';

type WorkerInput = {
	seed: string;
	size: number;
};

process.once('message', (input: WorkerInput) => {
	try {
		const totalStart = Date.now();
		const genStart = Date.now();
		const maze = genMaze(input.seed, input.size);
		const genMs = Date.now() - genStart;

		const renderStart = Date.now();
		const data = renderMaze(input.seed, maze);
		const renderMs = Date.now() - renderStart;

		process.send?.({
			ok: true,
			data: Array.from(data),
			genMs,
			renderMs,
			totalMs: Date.now() - totalStart
		});
		process.exit(0);
	} catch (err) {
		process.send?.({
			ok: false,
			error: String(err)
		});
		process.exit(1);
	}
});

import { parentPort, workerData } from 'worker_threads';
import { genMaze } from './gen-maze';
import { renderMaze } from './render-maze';

type WorkerInput = {
	seed: string;
	size: number;
};

const input = workerData as WorkerInput;
try {
	const totalStart = Date.now();
	const genStart = Date.now();
	const maze = genMaze(input.seed, input.size);
	const genMs = Date.now() - genStart;

	const renderStart = Date.now();
	const data = renderMaze(input.seed, maze);
	const renderMs = Date.now() - renderStart;

	parentPort?.postMessage({
		ok: true,
		data: Uint8Array.from(data),
		genMs,
		renderMs,
		totalMs: Date.now() - totalStart
	});
} catch (err) {
	parentPort?.postMessage({
		ok: false,
		error: String(err)
	});
}

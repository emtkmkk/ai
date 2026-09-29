import { fork, ForkOptions } from 'child_process';

export class MazeBusyError extends Error {
	constructor() {
		super('Another maze is being generated');
	}
}

/** One child at a time: a burst of mentions must not exhaust server CPU/memory. */
export function createMazeRunner(workerPath: string, timeoutMs = 5 * 60 * 1000) {
	let busy = false;
	return async (seed: string | number, size?: string | number | null): Promise<Buffer> => {
		if (busy) throw new MazeBusyError();
		busy = true;
		try {
			return await new Promise<Buffer>((resolve, reject) => {
				// fork forwards windowsHide to spawn; older @types/node omits it here.
				const options: ForkOptions & { windowsHide: boolean } = {
					// Do not inherit the parent's inspector/test-runner arguments.
					execArgv: workerPath.endsWith('.ts') ? ['-r', require.resolve('ts-node/register')] : [],
					serialization: 'advanced',
					stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
					windowsHide: true,
				};
				const child = fork(workerPath, [], options);
				let result: Buffer | undefined;
				let failure: Error | undefined;
				const kill = () => { child.kill('SIGKILL'); };
				const fail = (error: Error) => {
					failure ??= error;
					kill();
				};
				const timer = setTimeout(() => fail(new Error(`Maze processing timed out after ${timeoutMs}ms`)), timeoutMs);
				process.once('exit', kill);
				child.on('error', fail);
				child.on('message', (message: any) => {
					if (message?.type === 'result' && Buffer.isBuffer(message.data)) {
						result = message.data;
					} else {
						fail(new Error('Invalid maze worker response'));
					}
				});
				// Release the slot only after the child has actually stopped.
				child.once('close', (code, signal) => {
					clearTimeout(timer);
					process.removeListener('exit', kill);
					if (failure) reject(failure);
					else if (code !== 0 || !result) reject(new Error(`Maze worker exited without an image (code=${code}, signal=${signal})`));
					else resolve(result);
				});
				child.send({ seed, size: size ?? undefined }, error => {
					if (error) fail(error);
				});
			});
		} finally {
			busy = false;
		}
	};
}

export const generateMazeImage = createMazeRunner(require.resolve('./worker'));

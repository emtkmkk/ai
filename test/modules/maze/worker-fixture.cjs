process.once('message', ({ seed }) => {
	if (seed === 'hang') {
		// Deliberately block the child. Parent timers must still run and kill it.
		for (;;) {}
	}
	if (seed === 'crash') process.exit(2);
	if (seed === 'empty') process.exit(0);
	const message = seed === 'invalid' ? { type: 'result', data: 'not a buffer' }
		: { type: 'result', data: Buffer.from(seed) };
	process.send(message, () => process.exit(0));
});

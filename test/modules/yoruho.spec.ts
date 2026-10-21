/**
 * @packageDocumentation
 *
 * よるほー投稿の予約に関するテスト
 *
 * @remarks
 * 起動した時刻によらず、次の 0:00 に1回だけ投稿されることを確認する。
 */
import Yoruho from '@/modules/yoruho';

describe('yoruho の予約', () => {
	const setup = (start: Date) => {
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
		jest.setSystemTime(start);

		const posts: { at: Date; text: string }[] = [];
		const ai: any = {
			log: () => {},
			moduleData: {
				findOne: () => null,
				insertOne: (doc: any) => doc,
				insert: () => {},
				update: () => {},
			},
			post: jest.fn(async (note: { text: string }) => {
				const at = new Date();
				posts.push({ at, text: note.text });
				return { createdAt: at.toISOString() };
			}),
			decActiveFactor: () => {},
		};

		const module = new Yoruho();
		module.init(ai);
		return { module, posts };
	};

	afterEach(() => {
		jest.useRealTimers();
	});

	test.each([
		['昼', new Date(2026, 9, 21, 12, 0, 0)],
		['23:55:30', new Date(2026, 9, 21, 23, 55, 30)],
		['23:56:00', new Date(2026, 9, 21, 23, 56, 0)],
		['23:56:30', new Date(2026, 9, 21, 23, 56, 30)],
		['23:56:59', new Date(2026, 9, 21, 23, 56, 59)],
		['23:57:30', new Date(2026, 9, 21, 23, 57, 30)],
	])('%s に起動しても落ちず、その日の 0:00 に1回だけ投稿する', async (_label, start) => {
		const { module, posts } = setup(start);

		expect(() => module.install()).not.toThrow();

		// 翌日 0:00 の少し後まで進める
		await jest.advanceTimersByTimeAsync(new Date(2026, 9, 22, 0, 0, 5).getTime() - start.getTime());

		expect(posts).toHaveLength(1);
		const at = posts[0].at;
		expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([2026, 9, 21, 23]);
		expect(at.getMinutes()).toBe(59);
		expect(at.getSeconds()).toBe(59);
	});

	test('投稿した後は、翌日の 0:00 にも投稿する', async () => {
		const start = new Date(2026, 9, 21, 12, 0, 0);
		const { module, posts } = setup(start);

		module.install();
		await jest.advanceTimersByTimeAsync(new Date(2026, 9, 23, 0, 0, 5).getTime() - start.getTime());

		expect(posts).toHaveLength(2);
		expect(posts[1].at.getDate()).toBe(22);
	});
});

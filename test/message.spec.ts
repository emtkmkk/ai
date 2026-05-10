import Message from '@/message';

const createMessage = (note: Record<string, any>) => {
	const friends = new Map<string, any>();
	const ai = {
		account: { username: 'ai' },
		api: jest.fn().mockResolvedValue(note.user),
		friends: {
			findOne: ({ userId }: { userId: string }) => friends.get(userId) ?? null,
			insertOne: (doc: any) => {
				friends.set(doc.userId, doc);
				return doc;
			},
			update: jest.fn(),
		},
	};

	return new Message(ai as any, {
		id: 'note-id',
		text: '@ai RPG',
		userId: 'user-id',
		user: { id: 'user-id', username: 'user', host: null },
		visibility: 'home',
		localOnly: false,
		...note,
	});
};

describe('Message#isBotMention', () => {
	test('isBotMention が true の投稿だけ true を返す', () => {
		expect(createMessage({ isBotMention: true }).isBotMention).toBe(true);
		expect(createMessage({ isBotMention: false }).isBotMention).toBe(false);
		expect(createMessage({}).isBotMention).toBe(false);
	});
});

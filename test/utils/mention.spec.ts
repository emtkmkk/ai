import { hasMentionToMe, isAccountLinkMentionCommand, mentionsOnlyMe } from '@/utils/mention';

const account = {
	id: 'ai-id',
	username: 'ai',
	host: null,
};

const localHost = 'example.com';

test('自分だけがメンションされている場合は反応対象にする', () => {
	const note = {
		text: '@ai ping',
		mentions: ['ai-id'],
	};

	expect(hasMentionToMe(note, account, localHost)).toBe(true);
	expect(mentionsOnlyMe(note, account, localHost)).toBe(true);
});

test('自分以外のメンションも含まれる場合は反応対象外にする', () => {
	const note = {
		text: '@ai @someone ping',
		mentions: ['ai-id', 'someone-id'],
	};

	expect(hasMentionToMe(note, account, localHost)).toBe(true);
	expect(mentionsOnlyMe(note, account, localHost)).toBe(false);
	expect(isAccountLinkMentionCommand(note, account, localHost)).toBe(false);
});

test('mentions がない場合も本文から自分以外のメンションを検出する', () => {
	const note = {
		text: '@ai@example.com @someone@example.com ping',
	};

	expect(hasMentionToMe(note, account, localHost)).toBe(true);
	expect(mentionsOnlyMe(note, account, localHost)).toBe(false);
});

test('アカウントリンク用の他者メンションは例外対象にする', () => {
	const note = {
		text: '@ai リンク @someone@example.com',
		mentions: ['ai-id', 'someone-id'],
	};

	expect(hasMentionToMe(note, account, localHost)).toBe(true);
	expect(mentionsOnlyMe(note, account, localHost)).toBe(false);
	expect(isAccountLinkMentionCommand(note, account, localHost)).toBe(true);
});


test('アカウントリンク解除用の他者メンションも例外対象にする', () => {
	const note = {
		text: '@ai unlink @someone@example.com',
		mentions: ['ai-id', 'someone-id'],
	};

	expect(hasMentionToMe(note, account, localHost)).toBe(true);
	expect(mentionsOnlyMe(note, account, localHost)).toBe(false);
	expect(isAccountLinkMentionCommand(note, account, localHost)).toBe(true);
});

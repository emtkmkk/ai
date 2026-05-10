import type { User } from '@/misskey/user';

type NoteLike = {
	text?: string | null;
	mentions?: string[] | null;
};

const mentionRegexp = /(^|[\s\u3000([\{<「『（［｛＜])@([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_.-]+))?/g;
const accountLinkCommandRegexp = /リンク|link|unlink/i;

function normalizeHost(host: string): string {
	return host.toLowerCase();
}

function isOwnMention(username: string, host: string | undefined, account: Pick<User, 'username' | 'host'>, localHost: string): boolean {
	if (username.toLowerCase() !== account.username.toLowerCase()) return false;
	if (host == null) return true;

	const normalizedHost = normalizeHost(host);
	const accountHost = account.host ? normalizeHost(account.host) : normalizeHost(localHost);
	return normalizedHost === accountHost;
}

function findMentionTexts(text: string | null | undefined): { username: string; host?: string; }[] {
	if (text == null) return [];

	return [...text.matchAll(mentionRegexp)].map(match => ({
		username: match[2],
		host: match[3],
	}));
}

export function hasMentionToMe(note: NoteLike, account: Pick<User, 'id' | 'username' | 'host'>, localHost: string): boolean {
	if (note.mentions && note.mentions.length > 0) {
		return note.mentions.includes(account.id);
	}

	return findMentionTexts(note.text).some(mention => isOwnMention(mention.username, mention.host, account, localHost));
}

export function mentionsOnlyMe(note: NoteLike, account: Pick<User, 'id' | 'username' | 'host'>, localHost: string): boolean {
	if (note.mentions && note.mentions.length > 0) {
		return note.mentions.every(userId => userId === account.id);
	}

	return findMentionTexts(note.text).every(mention => isOwnMention(mention.username, mention.host, account, localHost));
}

export function isAccountLinkMentionCommand(note: NoteLike, account: Pick<User, 'username' | 'host'>, localHost: string): boolean {
	if (note.text == null || !accountLinkCommandRegexp.test(note.text)) return false;

	return findMentionTexts(note.text).some(mention => !isOwnMention(mention.username, mention.host, account, localHost));
}

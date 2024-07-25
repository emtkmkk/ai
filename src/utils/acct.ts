import config from '@/config';
export function acct(user: { username: string; host?: string | null; }, includeMyHost = false): string {
	const myHost = new URL(config.host).host.replace(/\./g, '\\.');
	return user.host
		? `@${user.username}@${user.host}`
		: includeMyHost ? `@${user.username}@${myHost}` : `@${user.username}`;
}

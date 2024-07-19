export function acct(user: { username: string; host?: string | null; }, includeMyHost = false): string {
	const myHost = "mkkey.net"
	return user.host
		? `@${user.username}@${user.host}`
		: includeMyHost ? `@${user.username}@${myHost}` : `@${user.username}`;
}

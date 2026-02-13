/**
 * @packageDocumentation
 *
 * アカウント名のフォーマットを行うユーティリティ。
 *
 * @remarks
 * Misskey のユーザー情報から `@username@host` 形式の文字列を生成する。
 * ローカルユーザーの場合はホスト部分を省略できる。
 * {@link config} の `host` を基準にローカル判定を行う。
 *
 * @internal
 */
import config from '@/config';

/**
 * ユーザーのアカウント名を `@username@host` 形式にフォーマットする
 *
 * @remarks
 * リモートユーザーは常に `@username@host` になる。
 * ローカルユーザーは `includeMyHost` が true の場合のみホスト部分を付与する。
 *
 * @param user - フォーマット対象のユーザー情報
 * @param includeMyHost - ローカルユーザーの場合に自ホストを含めるかどうか
 * @defaultValue includeMyHost は `false`
 * @returns `@username` または `@username@host` 形式の文字列
 *
 * @see {@link config.host} — ローカルホスト判定に使用
 * @internal
 */
export function acct(user: { username: string; host?: string | null; }, includeMyHost = false): string {
	const myHost = new URL(config.host).host;
	return user.host
		? `@${user.username}@${user.host}`
		: includeMyHost ? `@${user.username}@${myHost}` : `@${user.username}`;
}

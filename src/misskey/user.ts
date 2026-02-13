/**
 * @packageDocumentation
 *
 * Misskey ユーザーの型定義。
 *
 * @remarks
 * Misskey API から取得されるユーザー情報の構造を定義する。
 * {@link ../friend | Friend} クラスや {@link ../message | Message} クラスで使用される。
 *
 * @internal
 */

/**
 * Misskey ユーザーを表す型
 *
 * @remarks
 * API の `users/show` や WebSocket イベントで得られるユーザーデータ構造。
 * リモートユーザーの場合は `host` にホスト名が入り、ローカルユーザーの場合は `null` になる。
 *
 * @internal
 */
export type User = {
        /** ユーザーの一意なID */
	id: string;
        /** ユーザーの表示名 */
	name: string;
        /** ユーザー名（`@` なしの ID 文字列） */
	username: string;
        /** リモートユーザーのホスト名（ローカルユーザーの場合は `null`） */
	host?: string | null;
        /** 自分がこのユーザーをフォローしているかどうか */
        isFollowing?: boolean;
        /** このユーザーが自分をフォローしているかどうか */
        isFollowed?: boolean;
        /** このユーザーのリノートをミュートしているかどうか */
        isRenoteMuted?: boolean;
        /** このユーザーをブロックしているかどうか */
        isBlocking?: boolean;
        /** このユーザーが Bot かどうか */
        isBot: boolean;
        /** このユーザーのノート数 */
        notesCount?: number;
        /** このユーザーの別名アカウント情報（引っ越し機能用） */
	alsoKnownAs?: any;
};

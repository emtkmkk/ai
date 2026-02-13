/**
 * @packageDocumentation
 *
 * Misskey ノート（投稿）の型定義。
 *
 * @remarks
 * Misskey API から取得されるノート情報の構造を定義する。
 * {@link ../message | Message} クラスの内部データとして使用される。
 *
 * @see {@link User} — ノートの投稿者の型
 * @internal
 */
import { User } from './user';

/**
 * Misskey のノート（投稿）を表す型
 *
 * @remarks
 * Misskey API の `notes/show` や WebSocket の `note` イベントで得られるデータ構造。
 * 最低限必要なフィールドのみ定義している。
 *
 * @internal
 */
export type Note = {
	/** ノートの一意なID */
	id: string;
	/** ノート本文（CWのみの場合は null） */
	text: string | null;
	/** Content Warning テキスト（未設定の場合は null） */
	cw: string | null;
	/** リプライ先のノート（リプライでない場合は null） */
	reply: any | null;
	/** 公開範囲（`public`, `home`, `followers`, `specified`） */
	visibility: string;
	/** 投稿者のユーザー情報 */
	user: any | null;
	/**
	 * アンケート情報
	 *
	 * @remarks
	 * アンケート付きノートの場合のみ存在する。
	 */
	poll?: {
		/** 選択肢の配列 */
		choices: {
			/** この選択肢への投票数 */
			votes: number;
			/** 選択肢のテキスト */
			text: string;
		}[];
		/** アンケートの有効期限（ミリ秒） */
		expiredAfter: number;
		/** 複数選択が可能かどうか */
		multiple: boolean;
	} | null;
};

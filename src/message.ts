/**
 * @packageDocumentation
 *
 * メッセージ処理モジュール。
 *
 * @remarks
 * 受信したメンション・リプライをラップし、テキストの解析や返信機能を提供する。
 * 全角英数字の半角変換、メンション部分の除去を自動で行う。
 *
 * {@link ./module | Module} のフックから渡され、各モジュールがこのクラスを通じて
 * メッセージの内容を参照したり、返信を送信したりする。
 *
 * @see {@link ./ai | 藍} — メッセージの受信・ルーティング
 * @see {@link ./friend | Friend} — メッセージ送信者の友達情報
 * @internal
 */
import autobind from 'autobind-decorator';
import * as chalk from 'chalk';
const delay = require('timeout-as-promise');

import 藍 from '@/ai';
import Friend from '@/friend';
import { User } from '@/misskey/user';
import includes from '@/utils/includes';
import or from '@/utils/or';
import config from '@/config';
import { acct } from '@/utils/acct';

/**
 * 受信メッセージを表現するクラス
 *
 * @remarks
 * メンション、リプライのいずれにも対応する。
 * テキストの正規化（全角→半角変換）、メンション部分の除去、
 * 返信機能、キーワードマッチングなどを提供する。
 *
 * コンストラクタ内で `users/show` API を非同期呼び出しし、
 * ユーザー情報の完全取得を行う。
 *
 * @internal
 */
export default class Message {
	/**
	 * 藍のインスタンスへの参照
	 * @internal
	 */
	private ai: 藍;

	/**
	 * Misskey のノートオブジェクト（生データ）
	 * @internal
	 */
	private note: any;

	/**
	 * ノートIDを取得する
	 * @returns ノートの一意なID
	 * @internal
	 */
	public get id(): string {
		return this.note.id;
	}

	/**
	 * 投稿したユーザー情報を取得する
	 * @returns ノートの投稿者の {@link User} オブジェクト
	 * @internal
	 */
	public get user(): User {
		return this.note.user;
	}

	/**
	 * 投稿したユーザーのIDを取得する
	 * @returns ユーザーの一意なID
	 * @internal
	 */
	public get userId(): string {
		return this.note.userId;
	}

	/**
	 * テキスト本文を取得する
	 *
	 * @remarks
	 * 全角英数字は半角に自動変換される。
	 *
	 * @returns 正規化されたテキスト本文
	 * @internal
	 */
	public get text(): string {
		return typeof this.note.text !== "string" ? this.note.text : this.note.text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
	}

	/**
	 * 引用RenoteのIDを取得する
	 * @returns 引用RenoteのID。引用でない場合は `null`
	 * @internal
	 */
	public get quoteId(): string | null {
		return this.note.renoteId;
	}

	/**
	 * 投稿の公開範囲を取得する
	 * @returns `public`, `home`, `followers`, `specified` のいずれか
	 * @internal
	 */
	public get visibility(): string {
		return this.note.visibility;
	}

	/**
	 * ローカルのみの投稿かどうかを取得する
	 * @returns ローカルのみの場合は `true`
	 * @internal
	 */
	public get localOnly(): boolean {
		return this.note.localOnly ?? false;
	}

	/**
	 * メンション部分を除いたテキスト本文を取得する
	 *
	 * @remarks
	 * 先頭の `@username@host` または `@username` を除去し、前後の空白をトリムする。
	 *
	 * @returns クリーニングされたテキスト
	 * @internal
	 */
	public get extractedText(): string {
		const host = new URL(config.host).host.replace(/\./g, '\\.');
		return this.text
			.replace(new RegExp(`^@${this.ai.account.username}@${host}\\s`, 'i'), '')
			.replace(new RegExp(`^@${this.ai.account.username}\\s`, 'i'), '')
			.trim();
	}

	/**
	 * リプライ先のノートオブジェクトを取得する
	 * @returns リプライ先のノート。リプライでない場合は `null`
	 * @internal
	 */
	public get replyNote(): any {
		return this.note.reply;
	}

	/**
	 * リプライ先のノートIDを取得する
	 * @returns リプライ先のノートID
	 * @internal
	 */
	public get replyId(): string {
		return this.note.replyId;
	}

	/**
	 * メッセージ送信者の友達情報
	 *
	 * @see {@link Friend}
	 * @internal
	 */
	public friend: Friend;

	/**
	 * Message インスタンスを生成する
	 *
	 * @remarks
	 * コンストラクタ内で `users/show` API を非同期呼び出しし、
	 * ノートに付随する省略されたユーザー情報を完全なものに更新する。
	 *
	 * @param ai - 藍のインスタンス
	 * @param note - Misskey のノートオブジェクト
	 * @internal
	 */
	constructor(ai: 藍, note: any) {
		this.ai = ai;
		this.note = note;

		this.friend = new Friend(ai, { user: this.user });

		// メッセージなどに付いているユーザー情報は省略されている場合があるので完全なユーザー情報を持ってくる
		this.ai.api('users/show', {
			userId: this.userId
		}).then(user => {
			this.friend.updateUser(user);
		});
	}

	/**
	 * メッセージに返信する
	 *
	 * @remarks
	 * `immediate` が `true` でない場合、2秒の遅延後に返信する。
	 * CW に `@` が含まれる場合はメンションを付けない。
	 * `visibility` が `specified` の場合は送信者のみに見える。
	 *
	 * @param text - 返信テキスト。`null` の場合は何もしない
	 * @param opts - 返信オプション
	 * @returns 作成されたノート。`text` が `null` の場合は `undefined`
	 * @internal
	 */
	@autobind
	public async reply(text: string | null, opts?: {
		file?: any;
		cw?: string;
		renote?: string;
		immediate?: boolean;
		visibility?: string;
		visibilityForce?: boolean;
		localOnly?: boolean;
		references?: string[];
	}) {
		if (text == null) return;

		this.ai.log(`>>> Sending reply to ${chalk.underline(this.id)}`);

		if (!opts?.immediate) {
			await delay(2000);
		}

		return await this.ai.post({
			replyId: this.note.id,
			text: (opts?.cw?.includes('@') ? '' : acct(this.user) + ' ') + text,
			fileIds: opts?.file ? [opts?.file.id] : undefined,
			cw: opts?.cw,
			renoteId: opts?.renote,
			visibility: opts?.visibility ?? 'home',
			visibilityForce: opts?.visibilityForce,
			localOnly: opts?.localOnly || false,
			...(opts?.visibility === 'specified' ? { visibleUserIds: [this.userId], } : {}),
			referenceIds: opts?.references,
		});
	}

	/**
	 * 抽出テキストに指定のキーワードが含まれるかを判定する
	 *
	 * @remarks
	 * 内部で {@link includes} ユーティリティを使用。
	 * カタカナ→ひらがな変換、半角→全角変換を行った上で比較する。
	 *
	 * @param words - 検索するキーワードの配列
	 * @returns いずれかのキーワードが含まれていれば `true`
	 *
	 * @see {@link ./utils/includes | includes}
	 * @internal
	 */
	@autobind
	public includes(words: string[]): boolean {
		return includes(this.extractedText, words);
	}

	/**
	 * 抽出テキストが指定のキーワードと一致するかを判定する
	 *
	 * @remarks
	 * 内部で {@link or} ユーティリティを使用。
	 * ノイズ除去（末尾の「！」「っ」など）も行った上で完全一致を確認する。
	 *
	 * @param words - 検索するキーワードまたは正規表現の配列
	 * @returns いずれかのキーワードと一致すれば `true`
	 *
	 * @see {@link ./utils/or | or}
	 * @internal
	 */
	@autobind
	public or(words: (string | RegExp)[]): boolean {
		return or(this.extractedText, words);
	}
}

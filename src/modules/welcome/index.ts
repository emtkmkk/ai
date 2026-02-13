/**
 * @packageDocumentation
 *
 * welcome モジュール
 *
 * ローカルTLを監視し、新規ユーザーの初投稿やキリ番投稿を祝うモジュール。
 *
 * @remarks
 * - ローカルTLの `note` イベントを購読
 * - 初投稿（`isFirstNote` または投稿数50以下）: リノート＋リアクション＋ウェルカムメッセージ
 * - キリ番（50, 100, 500, 1000, 5000, 以降5000刻み）: 親愛度20以上のユーザーに通知
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import Friend, { FriendDoc } from '@/friend';
import { acct } from '@/utils/acct';
import serifs from '@/serifs';
import config from '@/config';

export default class extends Module {
	public readonly name = 'welcome';

	/**
	 * モジュールをインストールし、ローカルTLの監視を開始する
	 *
	 * @returns 空のインストール結果（フックなし）
	 * @internal
	 */
	@autobind
	public install() {
		const tl = this.ai.connection.useSharedConnection('localTimeline');

		tl.on('note', this.onLocalNote);

		return {};
	}

	/**
	 * ローカルTLのノートを受信し、初投稿祝い・キリ番通知を行う
	 *
	 * @remarks
	 * 処理フロー:
	 * 1. Bot でないローカルユーザーが対象
	 * 2. キリ番チェック: 親愛度20以上で公開投稿の場合、指定ノート数に達したら祝う
	 * 3. 初投稿チェック: 未送信なら、リノート→リアクション→ウェルカムメッセージの順で実行
	 *    （各 API 呼び出しに `setTimeout` で遅延を入れ、スパムを回避）
	 *
	 * @param note - ローカルTLから受信したノート
	 * @internal
	 */
	@autobind
	private onLocalNote(note: any) {
		if (!note.user?.isBot && !note.user.host) {
			const friend = new Friend(this.ai, { user: note.user });
			const data = friend.getPerModulesData(this);
			if (!data.nextNotificationNotesCount) {
				// 初回: 次のキリ番ターゲットを設定
				data.nextNotificationNotesCount = this.getNextNotification(note.user.notesCount + 1);
				friend.setPerModulesData(this, data);
			}
			// ノート数キリ番
			else if ((friend.love || 0) >= 20 && ["public", "home"].includes(note.visibility) && !note.cw && note.user.notesCount >= data.nextNotificationNotesCount - 1) {
				const nc = data.nextNotificationNotesCount;
				data.nextNotificationNotesCount = this.getNextNotification(note.user.notesCount + 1);
				friend.setPerModulesData(this, data);
				setTimeout(() => {
					this.ai.api('notes/create', {
						text: serifs.welcome.kiriban(nc, acct(note.user)),
						replyId: note.id,
						visibility: 'specified',
						visibleUserIds: [note.user.id],
					});
				}, 3000);
			}
			// 最初の投稿
			if (!friend?.doc?.isWelcomeMessageSent && (note.isFirstNote || (note.user.notesCount && note.user.notesCount <= 50))) {
				friend.doc.isWelcomeMessageSent = true;
				friend.save();
				if (note.isFirstNote) {
					// 初投稿をリノート（3秒後）
					setTimeout(() => {
						this.ai.api('notes/create', {
							renoteId: note.id,
							localOnly: true,
							...(config.birthdayPostChannel ? {channelId: config.birthdayPostChannel} : {}),
						});
					}, 3000);

					// リアクション :mk_hi:（4.5秒後）
					setTimeout(() => {
						this.ai.api('notes/reactions/create', {
							noteId: note.id,
							reaction: ':mk_hi:'
						});
					}, 4500);

					// リアクション :youkoso:（5.5秒後）
					setTimeout(() => {
						this.ai.api('notes/reactions/create', {
							noteId: note.id,
							reaction: ':youkoso:'
						});
					}, 5500);

					// リアクション :supertada:（6.5秒後）
					setTimeout(() => {
						this.ai.api('notes/reactions/create', {
							noteId: note.id,
							reaction: ':supertada:'
						});
					}, 6500);

				}

				// ウェルカムメッセージ（8秒後）
				setTimeout(() => {
					this.ai.api('notes/create', {
						text: serifs.welcome.welcome(acct(note.user)),
						replyId: note.id,
						visibility: 'specified',
						visibleUserIds: [note.user.id],
					});
				}, 8000);
			}
		}
	}

	/**
	 * 次のキリ番ターゲットのノート数を計算する
	 *
	 * @remarks
	 * ターゲット: 50 → 100 → 500 → 1000 → 5000 → 10000 → 15000 → ...（5000刻み）
	 *
	 * @param notesCount - 現在のノート数
	 * @returns 次のキリ番ターゲットのノート数
	 * @internal
	 */
	@autobind
	private getNextNotification(notesCount: number) {
		const target = [50, 100, 500, 1000, 5000];
		const clearTarget = target.filter((x) => x <= notesCount);
		if (target.length === clearTarget.length) {
			// 全ターゲット達成済み → 5000刻み
			return (Math.floor(notesCount / 5000) + 1) * 5000;
		} else {
			return target[clearTarget.length];
		}
	}
}

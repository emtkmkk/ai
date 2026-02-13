/**
 * @packageDocumentation
 *
 * follow モジュール
 *
 * フォローバックの管理を行うモジュール。
 * - メンションで「フォロー」「フォロバ」と言われたらフォローバックを実行
 * - ホームタイムラインを監視し、条件を満たさないリモートユーザーのフォローを解除
 *
 * @remarks
 * リモートユーザーへのフォローバックには親愛度10以上が必要。
 * フォロー解除は段階的に行い、20回の `removeCount` の蓄積で解除される。
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import parseDate from '@/utils/parse-date';

export default class extends Module {
	public readonly name = 'follow';

	/**
	 * モジュールをインストールし、ホームTL監視と mentionHook を登録する
	 *
	 * @returns mentionHook を含むインストール結果
	 * @internal
	 */
	@autobind
	public install() {
		const tl = this.ai.connection.useSharedConnection('homeTimeline');

		tl.on('note', this.onNote);
		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * 「フォロー」「フォロバ」を含むメンションに対してフォローバックを実行する
	 *
	 * @remarks
	 * 以下の条件でフォローバックを拒否する:
	 * - リノートミュート中のユーザー
	 * - リモートユーザーで親愛度が10未満
	 * - リモートユーザーで相手がフォローバックしていない（親愛度0以上）
	 *
	 * @param msg - 受信したメッセージ
	 * @returns マッチした場合はリアクション結果、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text && msg.includes(['フォロー', 'フォロバ', 'follow me'])) {
			// リノートミュート中のユーザーにはフォロバしない
			if (msg.user.isRenoteMuted) return {
				reaction: msg.friend.love >= 0 ? ':mk_hotchicken:' : null
			};
			// リモートユーザーは親愛度10以上が必要
			if (msg.user.host && msg.friend.love < 10) {
				msg.reply(serifs.core.followLoveErr);
				return {
					reaction: ':mk_hotchicken:'
				};
			}
			// リモートユーザーで相手がフォロバしてない場合は拒否
			if (msg.user.host && !msg.user.isFollowed && msg.friend.love >= 0) {
				msg.reply(serifs.core.followBackErr);
				return {
					reaction: ':mk_hotchicken:'
				};
			}
			if (!msg.user.isFollowing) {
				this.ai.api('following/create', {
					userId: msg.userId,
				});
				msg.reply(serifs.core.followBack(msg.friend.name));
				return {
					reaction: msg.friend.love >= 0 ? ':mk_yurayurachicken:' : null
				};
			} else {
				// 既にフォロー済み
				msg.reply(serifs.core.alreadyFollowBack(msg.friend.name));
				return {
					reaction: msg.friend.love >= 0 ? ':mk_hotchicken:' : null
				};
			}
		} else {
			return false;
		}
	}

	/**
	 * ホームTLのノートを監視し、条件を満たさないリモートフォローを解除する
	 *
	 * @remarks
	 * 解除条件:
	 * 1. Bot でないリモートユーザーでフォロー中の場合:
	 *    - 相手がフォロバしていない → 即解除
	 *    - 親愛度10未満 → 即解除
	 *    - 親愛度100未満で、最後の親愛度増加から一定期間経過
	 *      → `removeCount` を蓄積し、20回で解除
	 *      （親愛度50以上は猶予期間が2倍）
	 *
	 * @param note - ホームTLから受信したノート
	 * @internal
	 */
	@autobind
	private onNote(note: any) {
		if (!note.user?.isBot && note.user.host && note.user.isFollowing) {
			// 相手がフォロバしていない → 解除
			if (!note.user.isFollowed) {
				this.log("following/delete: " + note.userId);
				this.ai.api('following/delete', {
					userId: note.userId,
				});
			}
			const friend = this.ai.lookupFriend(note.user.id)
			if (!friend?.love || friend?.love < 10) {
				// 親愛度10未満 → 解除
				this.log("following/delete: " + note.userId);
				this.ai.api('following/delete', {
					userId: note.userId,
				});
			} else {
				const time = parseDate(friend.doc.lastLoveIncrementedAt)?.getTime();
				// 親愛度100未満 かつ 一定期間アクティビティがない場合
				// （親愛度 × 0.3日 = 猶予期間。親愛度50以上は猶予が2倍）
				if (friend?.love < 100 && time && (Date.now() - time > (friend?.love * 0.3 * 24 * 60 * 60 * 1000) * (friend?.love >= 50 ? 2 : 1))) {
					const data = friend.getPerModulesData(this);
					data.removeCount = (data.removeCount ?? 0) + 1;
					this.log(note.userId + " removeCount: " + data.removeCount);
					// 20回蓄積で解除実行
					if (data.removeCount >= 20) {
						data.removeCount = 0;
						this.log("following/delete: " + note.userId);
						this.ai.api('following/delete', {
							userId: note.userId,
						});
					}
					friend.setPerModulesData(this, data);
				}
			}
		}
	}
}

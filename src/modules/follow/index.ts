import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import parseDate from '@/utils/parse-date';

export default class extends Module {
	public readonly name = 'follow';

	@autobind
	public install() {
		const tl = this.ai.connection.useSharedConnection('homeTimeline');

		tl.on('note', this.onNote);
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text && msg.includes(['フォロー', 'フォロバ', 'follow me'])) {
			if (msg.user.isRenoteMuted) return {
				reaction: msg.friend.love >= 0 ? ':mk_hotchicken:' : null
			};
			if (msg.user.host && msg.friend.love < 10) {
				msg.reply(serifs.core.followLoveErr);
				return {
					reaction: ':mk_hotchicken:'
				};
			}
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
				msg.reply(serifs.core.alreadyFollowBack(msg.friend.name));
				return {
					reaction: msg.friend.love >= 0 ? ':mk_hotchicken:' : null
				};
			}
		} else {
			return false;
		}
	}

	@autobind
	private onNote(note: any) {
		if (!note.user?.isBot && note.user.host && note.user.isFollowing) {
			if (!note.user.isFollowed) {
				this.log("following/delete: " + note.userId);
				this.ai.api('following/delete', {
					userId: note.userId,
				});
			}
			const friend = this.ai.lookupFriend(note.user.id)
			if (!friend?.love || friend?.love < 10) {
				this.log("following/delete: " + note.userId);
				this.ai.api('following/delete', {
					userId: note.userId,
				});
			} else {
				const time = parseDate(friend.doc.lastLoveIncrementedAt)?.getTime();
				if (friend?.love < 100 && time && (Date.now() - time > (friend?.love * 0.3 * 24 * 60 * 60 * 1000) * (friend?.love >= 50 ? 2 : 1))) {
					const data = friend.getPerModulesData(this);
					data.removeCount = (data.removeCount ?? 0) + 1;
					this.log(note.userId + " removeCount: " + data.removeCount);
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

import 藍 from '@/ai';
import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import includes from '@/utils/includes';

export default class extends Module {
	public readonly name = 'dice';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.extractedText == null) return false;

		if (msg.extractedText.endsWith("ですか？") || msg.extractedText.endsWith("ますか？") || msg.extractedText.endsWith("ですよね？")) {
			const rng = seedrandom(msg.extractedText.trim() + ":q");
			const v = rng();
			if (v < 0.5) {
				if (v < 0.25) {
					msg.reply("多分はい、部分的にはい", { visibility: 'public' });
				} else {
					msg.reply("はい", { visibility: 'public' });
				}

			} else {
				if (v > 0.75) {
					msg.reply("多分いいえ、部分的にいいえ", { visibility: 'public' });
				} else {
					msg.reply("いいえ", { visibility: 'public' });
				}
			}
			return {
				reaction: 'love'
			};
		}
		
		if (msg.replyId && msg.replyNote.userId != this.ai.account.id && includes(msg.extractedText, ['ファクト']) && includes(msg.extractedText, ['チェック'])) {
			if (msg.replyNote.uri) {
						const replyUser = await this.ai.api('users/show', {
							userId: msg.replyNote.userId
						});
						if (!replyUser.isFollowed && !replyUser.isFollowing) {
							msg.reply("私をフォローしていないリモートユーザにはファクトチェックできません！", { visibility: 'specified' });
							return {
								reaction: ':mk_hotchicken:'
							};
						}
			}

			const opt = msg.replyNote.visibility == 'followers' || msg.replyNote.visibility == 'specified' ? { visibility: 'public', references: [msg.replyId] } : { visibility: 'public', renote: msg.replyId };
			
			if (msg.replyNote.userId == this.ai.account.id) {
				msg.reply("\nこの投稿はもちろん、正しいです！どうして疑うんですか？", opt);
				return {
					reaction: 'love'
				};
			}
			
			const rng = seedrandom(msg.replyId + ":f");
			const v = rng();
			if (v < 0.5) {
				if (v < 0.25) {
					msg.reply("\nこの投稿は多分正しい、部分的に正しい", opt);
				} else {
					msg.reply("\nこの投稿は正しいかも", opt);
				}

			} else {
				if (v > 0.75) {
					msg.reply("\nこの投稿は多分嘘、部分的に嘘", opt);
				} else {
					msg.reply("\nこの投稿は嘘かも", opt);
				}
			}
			return {
				reaction: 'love'
			};
		}

		const query = msg.extractedText.match(/([0-9]+)[dD]([0-9]+)/);

		if (query == null) return false;

		const times = parseInt(query[1], 10);
		const dice = parseInt(query[2], 10);

		if (times < 1) return false;
		if (dice < 2 || dice > Number.MAX_SAFE_INTEGER) return false;

		if ((dice.toString().length + 1) * times > 7000) return false;

		const results: number[] = [];

		for (let i = 0; i < times; i++) {
			results.push(Math.floor(Math.random() * dice) + 1);
		}

		msg.reply(serifs.dice.done(results.join(' '), results.length > 1 ? results.reduce((a, c) => a + c).toLocaleString() : null), { visibility: 'public' });

		return {
			reaction: 'love'
		};
	}
}

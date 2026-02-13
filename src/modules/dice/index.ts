/**
 * @packageDocumentation
 *
 * dice モジュール
 *
 * サイコロ、YES/NO質問、ファクトチェックの3つの機能を提供するモジュール。
 *
 * @remarks
 * 機能一覧:
 * 1. **YES/NO 質問**: 「ですか？」「ますか？」「ですよね？」で終わる質問に回答
 *    （テキストのハッシュで決定的な答えを返す）
 * 2. **ファクトチェック**: 返信先の投稿に対して正しい/嘘を判定
 *    （リモートユーザーの投稿は非フォロー関係では不可）
 * 3. **サイコロ**: `NdM` 形式（例: `2d6`）でサイコロを振る
 *
 * @internal
 */
import 藍 from '@/ai';
import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import includes from '@/utils/includes';

export default class extends Module {
	public readonly name = 'dice';

	/**
	 * モジュールをインストールし、mentionHook を登録する
	 *
	 * @returns mentionHook を含むインストール結果
	 * @internal
	 */
	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * メンション内容に応じて YES/NO 回答、ファクトチェック、またはサイコロを実行する
	 *
	 * @remarks
	 * 判定順:
	 * 1. 「ですか？」「ますか？」「ですよね？」 → YES/NO 回答
	 * 2. 返信先あり＋「ファクトチェック」 → ファクトチェック
	 * 3. `NdM` 形式 → サイコロ
	 *
	 * seedrandom を使用して同じ質問・同じ投稿には同じ回答を返す。
	 *
	 * @param msg - 受信したメッセージ
	 * @returns マッチした場合はリアクション結果、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.extractedText == null) return false;

		// --- YES/NO 質問 ---
		if (msg.extractedText.endsWith("ですか？") || msg.extractedText.endsWith("ますか？") || msg.extractedText.endsWith("ですよね？")) {
			// テキストをシードにして決定的な回答を生成
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

		// --- ファクトチェック ---
		if (msg.replyId && includes(msg.extractedText, ['ファクト']) && includes(msg.extractedText, ['チェック'])) {
			// リモートユーザーの投稿でフォロー関係がない場合は拒否
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

			// 公開範囲に応じて投稿方法を変更
			const opt = msg.replyNote.visibility == 'followers' || msg.replyNote.visibility == 'specified' ? { visibility: 'public', references: [msg.replyId] } : { visibility: 'public', renote: msg.replyId };

			// 藍自身の投稿の場合は特別な応答
			if (msg.replyNote.userId == this.ai.account.id) {
				msg.reply("\nこの投稿はもちろん、正しいです！どうして疑うんですか？", opt);
				return {
					reaction: 'love'
				};
			}

			// 投稿IDをシードにして決定的な判定を生成
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

		// --- サイコロ ---
		const query = msg.extractedText.match(/([0-9]+)[dD]([0-9]+)/);

		if (query == null) return false;

		const times = parseInt(query[1], 10);
		const dice = parseInt(query[2], 10);

		if (times < 1) return false;
		if (dice < 2 || dice > Number.MAX_SAFE_INTEGER) return false;

		// 結果文字列が長くなりすぎないよう制限
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

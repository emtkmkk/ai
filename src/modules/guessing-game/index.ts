/**
 * @packageDocumentation
 *
 * 数当てゲームモジュール
 *
 * ユーザーがメンションで「数当て」と送ると、0〜99のランダムな数を当てるゲームを開始する。
 * ユーザーは6回以内に正解を当てる必要がある。
 *
 * @remarks
 * - NOTE: ゲーム中の会話はDM（specified）で行われるが、結果は公開投稿される。
 * - NOTE: 25, 50, 75 が最初に選ばれた場合は再抽選する（中央値付近を避けるため）。
 * - NOTE: 残り1回で候補が2個まで絞られている場合、ユーザーの予想に合わせて正解を変更する
 *       （必ず正解させる）。
 * - NOTE: 入力値が既知の範囲外の場合、自動的に範囲内に補正される。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { acct } from '@/utils/acct';

/**
 * 数当てゲームモジュールクラス
 *
 * @remarks
 * mentionHook でゲーム開始、contextHook で推測の処理を行う。
 * ゲーム進行中のデータはLokiJSコレクションで永続化される。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'guessingGame';

	/**
	 * ゲームデータコレクション
	 *
	 * @remarks
	 * userId でインデックスを持ち、進行中のゲームを管理する。
	 *
	 * @internal
	 */
	private guesses: loki.Collection<{
		/** ゲーム参加者のユーザーID */
		userId: string;
		/** 正解の数（0〜99） */
		secret: number;
		/** これまでの推測値の履歴 */
		tries: number[];
		/** ゲーム終了フラグ */
		isEnded: boolean;
		/** ゲーム開始時刻（ミリ秒タイムスタンプ） */
		startedAt: number;
		/** ゲーム終了時刻（ミリ秒タイムスタンプ、進行中は null） */
		endedAt: number | null;
		/** ゲームを開始したメンションのノートID（結果投稿時の返信先） */
		triggerId: string;
	}>;

	/** 最大推測回数 */
	private MAX_TRY = 6;

	/**
	 * モジュールの初期化
	 *
	 * @returns mentionHook / contextHook を含むフック登録オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		this.guesses = this.ai.getCollection('guessingGame', {
			indices: ['userId']
		});

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook
		};
	}

	/**
	 * メンション受信時のフック: ゲーム開始
	 *
	 * @remarks
	 * 「数当て」「数あて」を含むメンションでゲームを開始する。
	 * ダイレクトメッセージからの開始は拒否する。
	 *
	 * NOTE: 25, 50, 75 が選ばれた場合は再抽選する。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.includes(['数当て', '数あて'])) return false;
		if (msg.visibility === 'specified') {
			msg.reply("数当てはダイレクトでは始められなくなりました。\nフォロワー以上の公開範囲でお願いします！")
			return true
		}

		const exist = this.guesses.findOne({
			userId: msg.userId,
			isEnded: false
		});

		// 正解をランダム生成（25, 50, 75は避ける）
		let secret = Math.floor(Math.random() * 100);
		if ([25, 50, 75].includes(secret)) secret = Math.floor(Math.random() * 100);

		this.guesses.insertOne({
			userId: msg.userId,
			secret: secret,
			tries: [],
			isEnded: false,
			startedAt: Date.now(),
			endedAt: null,
			triggerId: msg.id,
		});

		// ゲーム開始メッセージはDMで送信
		msg.reply(serifs.guessingGame.started(this.MAX_TRY), { visibility: "specified" }).then(reply => {
			this.subscribeReply(msg.userId, reply.id);
		});

		return {
			reaction: 'love'
		};
	}

	/**
	 * コンテキストフック: 推測の処理
	 *
	 * @remarks
	 * ユーザーの入力（数値 or 「やめ」）を処理する。
	 *
	 * - 「やめ」: ゲームキャンセル
	 * - 数値入力: 正解判定 → 大きい/小さい/正解のいずれかを返答
	 * - 回数超過: 不正解として終了
	 *
	 * NOTE: 入力値が既知の上限/下限を超えている場合は自動補正する。
	 * NOTE: 残り1回で候補が2個の場合、ユーザーの入力に正解を合わせる（必ず当たる）。
	 *
	 * HACK: 最後の1回で候補2個の場合に正解を変更するのは、
	 *       ゲーム体験を向上させるための意図的な仕様。
	 *
	 * @param key - コンテキストキー
	 * @param msg - 受信メッセージ
	 * @returns 処理結果
	 * @internal
	 */
	@autobind
	private async contextHook(key: any, msg: Message) {
		if (msg.text == null) return;

		const exist = this.guesses.findOne({
			userId: msg.userId,
			isEnded: false
		});

		if (exist == null) {
			this.unsubscribeReply(key);
			return;
		}

		// ゲームキャンセル
		if (msg.text.includes('やめ')) {
			try {
				this.ai.post({
					text: acct(msg.user) + ' ' + serifs.guessingGame.cancel,
					replyId: exist.triggerId,
				});
			} catch (err) {
				msg.reply(serifs.guessingGame.cancel);
			}
			exist.isEnded = true;
			exist.endedAt = Date.now();
			this.guesses.update(exist);
			this.unsubscribeReply(key);
			return {
				reaction: 'love'
			};
		}

		// 数値の抽出
		const guess = msg.extractedText.match(/[0-9]+/);

		if (guess == null) {
			msg.reply(serifs.guessingGame.nan).then(reply => {
				this.subscribeReply(msg.userId, reply.id);
			});
			return {
				reaction: 'hmm'
			};
		}

		if (guess.length > 3) return {
			reaction: 'confused'
		};

                let g = parseInt(guess[0], 10);

		// 既知の範囲に補正
                const min = Math.max(...exist.tries.filter((x) => x < exist.secret), -1);
                const max = Math.min(...exist.tries.filter((x) => x > exist.secret), 101);

                if (g < min) g = min;
                if (g > max) g = max;

                const remainingTries = this.MAX_TRY - exist.tries.length;
                const candidateCount = max - min - 1;

		// 残り1回で候補2個の場合、ユーザーの予想に合わせて正解を変更（必ず当たる）
                if (remainingTries === 1 && candidateCount === 2) {
                        const candidates = [min + 1, max - 1];
                        if (candidates.includes(g)) {
                                exist.secret = g;
                        }
                }

                const firsttime = exist.tries.indexOf(g) === -1 && g !== 101 && g !== -1;

                if (firsttime) exist.tries.push(g);

		let text: string;
		let end = false;

		if (exist.secret !== g && exist.tries.length >= this.MAX_TRY) {
			// 回数超過: 不正解終了
			end = true;
			text = serifs.guessingGame.fail(exist.secret, exist.tries.length.toString(), exist.tries.join("→"));
		} else if (exist.secret < g) {
			// 正解より大きい
			text = firsttime
				? serifs.guessingGame.less(g.toString(), this.MAX_TRY - exist.tries.length)
				: serifs.guessingGame.lessAgain(g.toString());
		} else if (exist.secret > g) {
			// 正解より小さい
			text = firsttime
				? serifs.guessingGame.grater(g.toString(), this.MAX_TRY - exist.tries.length)
				: serifs.guessingGame.graterAgain(g.toString());
		} else {
			// 正解！
			end = true;
			let comment = "";
			if (exist.tries.length <= 1) comment = "エスパーですか……！？";
			else if (exist.tries.length <= 3) comment = "すごいです……！";
			else if (exist.tries.length <= 4) comment = "早いです！";
			text = serifs.guessingGame.congrats(exist.secret, exist.tries.length.toString(), exist.tries.join("→"), comment);
		}

		if (end) {
			exist.isEnded = true;
			exist.endedAt = Date.now();
			this.unsubscribeReply(key);
			try {
				// 結果はゲーム開始ノートへの公開返信として投稿
				this.ai.post({
					text: acct(msg.user) + ' ' + text,
					visibility: "public",
					replyId: exist.triggerId,
				});
			} catch (err) {
				msg.reply(text);
			}
		} else {
			msg.reply(text).then(reply => {
				if (!end) {
					this.subscribeReply(msg.userId, reply.id);
				}
			});
		}

		this.guesses.update(exist);
		return {
			reaction: 'love'
		};
	}
}

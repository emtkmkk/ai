import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { acct } from '@/utils/acct';

export default class extends Module {
	public readonly name = 'guessingGame';

	private guesses: loki.Collection<{
		userId: string;
		secret: number;
		tries: number[];
		isEnded: boolean;
		startedAt: number;
		endedAt: number | null;
		triggerId: string;
	}>;

	private MAX_TRY = 6;

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

		msg.reply(serifs.guessingGame.started(this.MAX_TRY), { visibility: "specified" }).then(reply => {
			this.subscribeReply(msg.userId, reply.id);
		});

		return {
			reaction: 'love'
		};
	}

	@autobind
	private async contextHook(key: any, msg: Message) {
		if (msg.text == null) return;

		const exist = this.guesses.findOne({
			userId: msg.userId,
			isEnded: false
		});

		// 処理の流れ上、実際にnullになることは無さそうだけど一応
		if (exist == null) {
			this.unsubscribeReply(key);
			return;
		}

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

                const min = Math.max(...exist.tries.filter((x) => x < exist.secret), -1);
                const max = Math.min(...exist.tries.filter((x) => x > exist.secret), 101);

                if (g < min) g = min;
                if (g > max) g = max;

                const remainingTries = this.MAX_TRY - exist.tries.length;
                const candidateCount = max - min - 1;

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
			end = true;
			text = serifs.guessingGame.fail(exist.secret, exist.tries.length.toString(), exist.tries.join("→"));
		} else if (exist.secret < g) {
			text = firsttime
				? serifs.guessingGame.less(g.toString(), this.MAX_TRY - exist.tries.length)
				: serifs.guessingGame.lessAgain(g.toString());
		} else if (exist.secret > g) {
			text = firsttime
				? serifs.guessingGame.grater(g.toString(), this.MAX_TRY - exist.tries.length)
				: serifs.guessingGame.graterAgain(g.toString());
		} else {
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

import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { User } from '@/misskey/user';
import { acct } from '@/utils/acct';
import { genItem } from '@/vocabulary';

type Game = {
	votes: {
		user: {
			id: string;
			username: string;
			host: User['host'];
		};
		number: number;
	}[];
	isEnded: boolean;
	startedAt: number;
	finishedAt: number;
	winRank: number;
	postId: string;
	maxnum: number;
	triggerUserId: string | undefined;
};

export default class extends Module {
	public readonly name = 'kazutori';

	private games: loki.Collection<Game>;

	@autobind
	public install() {
		this.games = this.ai.getCollection('kazutori');

		this.crawleGameEnd();
		setInterval(this.crawleGameEnd, 1000);
		setInterval(() => {
			const hours = new Date().getHours()
			const rnd = (hours === 12 || (hours > 17 && hours < 24)) ? 0.5 : 0.1;
			if (Math.random() < rnd) {
				this.start();
			}
		}, 1000 * 60 * 37);

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook
		};
	}

	@autobind
	private async start(triggerUserId?) {

		const games = this.games.find({});

		const recentGame = games.length == 0 ? null : games[games.length - 1];

		// ゲーム開始条件判定
		const h = new Date().getHours()
					
		// 前回がお流れの場合はランダム発生のクールダウンを120分にする
		if (recentGame && (!recentGame.isEnded || (h > 0 && h < 8) || Date.now() - recentGame.startedAt < 1000 * 60 * ((recentGame?.votes?.length ?? 2) <= 1 && !triggerUserId ? 120 : 60))) return

		// 最大値は前回の参加者に50%で1を足した物
		let maxnum = ((recentGame?.votes?.length || 0) + (Math.random() < 0.5 ? 1 : 0)) || 1;

		// 2%かつ開催2回目以降かつ前回がMax50以上ではない場合 Maxを50 ~ 100倍にする
		if (Math.random() < 0.02 && recentGame?.maxnum && recentGame.maxnum <= 50) maxnum = Math.floor(maxnum * (50 + (Math.random() * 50)));
		// 2%かつ開催2回目以降かつ前回がMax1ではない場合 Max1
		else if (Math.random() < 0.02 && recentGame?.maxnum && recentGame.maxnum !== 1) maxnum = 1;

		// 1000回以上ループ処理したらおかしくなるかもなので
		if (maxnum > 1000) maxnum = 1000;

		// 自然発生かつ5%の確率でフォロワー限定になる
		// 狙い：リプライがすべてフォロ限になる為、フォロワーでない人の投票が不可視になる
		let visibility = Math.random() < 0.05 && !triggerUserId ? 'followers' : undefined;

		// 10% → 自然発生かつ50%で1分 そうでない場合2分
		// 90% → 5分 or 10分
		// 狙い：時間がないと他の人の数字を確認しづらいのでランダム性が高まる
		const limitMinutes = Math.random() < 0.1 ? Math.random() < 0.5 && !triggerUserId ? 1 : 2 : Math.random() < 0.5 ? 5 : 10;

		// 前回が2番目勝利モードでないかつ25%で2番目勝利モードになる
		// 狙い：新しいゲーム性の探求
		const winRank = (recentGame?.winRank ?? 1) === 1 && Math.random() < 0.25 ? 2 : 1;

		const post = await this.ai.post({
			text: serifs.kazutori.intro(maxnum, limitMinutes, winRank),
			...(visibility ? { visibility } : {})
		});

		this.games.insertOne({
			votes: [],
			isEnded: false,
			startedAt: Date.now(),
			finishedAt: Date.now() + 1000 * 60 * limitMinutes,
			winRank,
			postId: post.id,
			maxnum: maxnum,
			triggerUserId,
		});

		this.subscribeReply(null, post.id);

		this.log('New kazutori game started');
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.includes(['数取り'])) return false;

		const games = this.games.find({});

		const recentGame = games.length == 0 ? null : games[games.length - 1];

		if (recentGame) {
			// 現在アクティブなゲームがある場合
			if (!recentGame.isEnded) {
				msg.reply(serifs.kazutori.alreadyStarted, {
					renote: recentGame.postId
				});
				return {
					reaction: 'confused'
				};
			}

			const h = new Date().getHours()

			if (h > 0 && h < 8) {
				msg.reply("現在、数取り開催不可に指定されている時間です。8時から開催を受け付けます！")
				return {
					reaction: 'hmm'
				}
			}

			// 直近のゲームから1時間経ってない場合
			if (Date.now() - recentGame.startedAt < 1000 * 60 * 60) {
				const ct = Math.ceil(60 - ((Date.now() - recentGame.startedAt) / (1000 * 60)));
				msg.reply(serifs.kazutori.matakondo(ct));
				return {
					reaction: 'hmm'
				};
			}
		}

		msg.reply("\n分かりました！数取りを開催します！\nあなたは開催1分後から数取りへの投票を行うことができます！\n（ダイレクトなら今すぐでも大丈夫です！）", { visibility: 'specified' });

		this.start(msg.user.id);

		return {
			reaction: 'love'
		};
	}

	@autobind
	private async contextHook(key: any, msg: Message) {
		if (msg.text == null) return {
			reaction: 'hmm'
		};

		const game = this.games.findOne({
			isEnded: false
		});

		// 処理の流れ上、実際にnullになることは無さそうだけど一応
		if (game == null) return;

		// 数取りトリガー者で、開始から1分以内の場合
		const time = Date.now() - game.startedAt
		if (game.triggerUserId === msg.user.id && time < 60 * 1000 && msg.visibility !== 'specified') {
			msg.reply(`\n${60 - Math.floor(time / 1000)}秒後にもう一度送ってください！`, { visibility: 'specified' });
			return { reaction: '❌' };
		}

		// 既に数字を取っていたら
		if (game.votes.some(x => x.user.id == msg.userId)) return {
			reaction: 'confused'
		};

		// 数字が含まれていない
		const match = msg.extractedText.match(/[0-9]+/);
		if (match == null) return {
			reaction: 'hmm'
		};

		const num = parseInt(match[0], 10);

		// 整数じゃない
		if (!Number.isInteger(num)) return {
			reaction: 'hmm'
		};

		// 範囲外
		if (num < 0 || num > game.maxnum) return {
			reaction: 'confused'
		};

		this.log(`Voted ${num} by ${msg.user.id}`);

		// 投票
		game.votes.push({
			user: {
				id: msg.user.id,
				username: msg.user.username,
				host: msg.user.host
			},
			number: num
		});

		this.games.update(game);

		if (msg.friend?.doc) {
			if (msg.friend.doc.kazutoriData) {
				msg.friend.doc.kazutoriData.playCount += 1;
			} else {
				msg.friend.doc.kazutoriData = { winCount: 0, playCount: 1, inventory: [] };
			}
			msg.friend.save()
		}

		return {
			reaction: ':mk_discochicken:'
		};
	}

	/**
	 * 終了すべきゲームがないかチェック
	 */
	@autobind
	private crawleGameEnd() {
		const game = this.games.findOne({
			isEnded: false
		});

		if (game == null) return;

		// 制限時間が経過していたら
		if (Date.now() - (game.finishedAt ?? game.startedAt + 1000 * 60 * 10) >= 0) {
			this.finish(game);
		}
	}

	/**
	 * ゲームを終わらせる
	 */
	@autobind
	private finish(game: Game) {
		game.isEnded = true;
		this.games.update(game);

		this.log('Kazutori game finished');

		const item = genItem();

		// お流れ
		if (game.votes.length <= 1) {
			if (game.votes.length) {
				const friend = this.ai.lookupFriend(game.votes[0].user.id)
				if (friend) {
					friend.doc.kazutoriData.playCount -= 1;
					friend.save()
				}
			}
			this.ai.post({
				text: serifs.kazutori.onagare(item),
				renoteId: game.postId
			});

			return;
		}

		let results: string[] = [];
		let winner: Game['votes'][0]['user'] | null = null;
		let reverseResults: string[] = [];
		let reverseWinner: Game['votes'][0]['user'] | null = null;

		let winRank = game.winRank ?? 1;
		let reverseWinRank = game.winRank ?? 1;

		let reverse = Math.random() < (winRank === 1 ? 0.15 : 0.3);
		const now = new Date();

		// 正常
		for (let i = game.maxnum; i >= 0; i--) {
			const users = game.votes
				.filter(x => x.number == i)
				.map(x => x.user);

			if (users.length == 1) {
				if (winner == null) {
					if (winRank > 1) {
						winRank -= 1;
						results.push(`➖ ${i}: ${acct(users[0])}`);
					} else {
						winner = users[0];
						const icon = i == 100 ? '💯' : i == 0 ? '0️⃣' : '🎉';
						results.push(`${icon} **${i}**: $[jelly ${acct(users[0])}]`);
					}
				} else {
					results.push(`➖ ${i}: ${acct(users[0])}`);
				}
			} else if (users.length > 1) {
				results.push(`❌ ${i}: ${users.map(u => acct(u)).join(' ')}`);
			}
		}

		// 反転
		for (let i = 0; i <= game.maxnum; i++) {
			const users = game.votes
				.filter(x => x.number == i)
				.map(x => x.user);

			if (users.length == 1) {
				if (reverseWinner == null) {
					if (reverseWinRank > 1) {
						reverseWinRank -= 1;
						reverseResults.push(`➖ ${i}: ${acct(users[0])}`);
					} else {
						reverseWinner = users[0];
						const icon = i == 100 ? '💯' : i == 0 ? '0️⃣' : '🎉';
						reverseResults.push(`${icon} **${i}**: $[jelly ${acct(users[0])}]`);
					}
				} else {
					reverseResults.push(`➖ ${i}: ${acct(users[0])}`);
				}
			} else if (users.length > 1) {
				reverseResults.push(`❌ ${i}: ${users.map(u => acct(u)).join(' ')}`);
			}
		}

		//そのままでも反転しても結果が同じの場合は反転しない
		if ((!winner || !reverseWinner) || winner?.id === reverseWinner?.id) reverse = false;

		if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

		if (reverse) {
			results = reverseResults;
			winner = reverseWinner;
		}

		if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

		const winnerFriend = winner ? this.ai.lookupFriend(winner.id) : null;
		const name = winnerFriend ? winnerFriend.name : null;

		if (winnerFriend) {
			if (winnerFriend.doc.kazutoriData.winCount) {
				winnerFriend.doc.kazutoriData.winCount += 1;
			} else {
				winnerFriend.doc.kazutoriData = { winCount: 1, playCount: 1, inventory: [] };
			}
			if (winnerFriend.doc.kazutoriData.inventory) {
				if (winnerFriend.doc.kazutoriData.inventory.length >= 50) winnerFriend.doc.kazutoriData.inventory.shift();
				winnerFriend.doc.kazutoriData.inventory.push(item);
			} else {
				winnerFriend.doc.kazutoriData.inventory = [item];
			}
			winnerFriend.save()
		}


		const text = results.join('\n') + '\n\n' + (winner
			? reverse ? serifs.kazutori.finishWithWinnerReverse(acct(winner), name, item) : serifs.kazutori.finishWithWinner(acct(winner), name, item)
			: serifs.kazutori.finishWithNoWinner(item));

		this.ai.post({
			text: text,
			cw: serifs.kazutori.finish,
			renoteId: game.postId
		});

		this.unsubscribeReply(null);
	}
}

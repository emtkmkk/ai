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
	postId: string;
	maxnum: number;
};

const limitMinutes = 10;

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
	private async start() {

		const games = this.games.find({});

		const recentGame = games.length == 0 ? null : games[games.length - 1];
		
		if (recentGame && (!recentGame.isEnded || Date.now() - recentGame.startedAt < 1000 * 60 * 60)) return
		
		const maxnum = recentGame?.votes?.length || 1;

		const post = await this.ai.post({
			text: serifs.kazutori.intro(maxnum, limitMinutes)
		});

		this.games.insertOne({
			votes: [],
			isEnded: false,
			startedAt: Date.now(),
			postId: post.id,
			maxnum: maxnum
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
					reaction:'confused'
				};
			}

			// 直近のゲームから1時間経ってない場合
			if (Date.now() - recentGame.startedAt < 1000 * 60 * 60) {
				const ct = Math.ceil(60 - ((Date.now() - recentGame.startedAt) / (1000 * 60)));
				msg.reply(serifs.kazutori.matakondo(ct));
				return {
					reaction:'hmm'
				};
			}
		}

		let maxnum = recentGame?.votes?.length || 1;
		if (Math.random() < 0.02 && recentGame?.maxnum && recentGame.maxnum <= 50) maxnum = Math.floor(maxnum * (50 + (Math.random() * 50)));
		else if (Math.random() < 0.02 && recentGame?.maxnum && recentGame.maxnum !== 1) maxnum = 1;
		
		if (maxnum > 1000) maxnum = 1000;

		const post = await this.ai.post({
			text: serifs.kazutori.intro(maxnum, limitMinutes)
		});

		this.games.insertOne({
			votes: [],
			isEnded: false,
			startedAt: Date.now(),
			postId: post.id,
			maxnum: maxnum
		});

		this.subscribeReply(null, post.id);

		this.log('New kazutori game started');

		return {
			reaction:'love'
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

		// 既に数字を取っていたら
		if (game.votes.some(x => x.user.id == msg.userId)) return {
			reaction: 'confused'
		};

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
		
		if (msg.friend?.doc){
			if (msg.friend.doc.kazutoriData){
					msg.friend.doc.kazutoriData.playCount += 1;			
			} else {
				msg.friend.doc.kazutoriData = {winCount: 0,playCount:1,inventory:[]};	
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
		if (Date.now() - game.startedAt >= 1000 * 60 * limitMinutes) {
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
		
		let reverse = Math.random() < 0.15;
		const now = new Date();
		
		// 正常
		for (let i = game.maxnum; i >= 0 ; i--) {
			const users = game.votes
				.filter(x => x.number == i)
				.map(x => x.user);

			if (users.length == 1) {
				if (winner == null) {
					winner = users[0];
					const icon = i == 100 ? '💯' : '🎉';
					results.push(`${icon} **${i}**: $[jelly ${acct(users[0])}]`);
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
					reverseWinner = users[0];
					const icon = i == 100 ? '💯' : '🎉';
					reverseResults.push(`${icon} **${i}**: $[jelly ${acct(users[0])}]`);
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

		const winnerFriend = winner ? this.ai.lookupFriend(winner.id) : null;
		const name = winnerFriend ? winnerFriend.name : null;
		
		if (winnerFriend) {
			if (winnerFriend.doc.kazutoriData.winCount){
				winnerFriend.doc.kazutoriData.winCount += 1;
			} else {
				winnerFriend.doc.kazutoriData = {winCount: 1,playCount:1,inventory:[]};	
			}
			if (winnerFriend.doc.kazutoriData.inventory) {
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

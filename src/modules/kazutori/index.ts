import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { User } from '@/misskey/user';
import { acct } from '@/utils/acct';

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

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook
		};
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
					reaction:'love'
				};
			}

			// 直近のゲームから1時間経ってない場合
			if (Date.now() - recentGame.startedAt < 1000 * 60 * 60) {
				msg.reply(serifs.kazutori.matakondo);
				return {
					reaction:'hmm'
				};
			}
		}

		const maxnum = recentGame?.votes?.length ?? 1;

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

		// お流れ
		if (game.votes.length <= 1) {
			this.ai.post({
				text: serifs.kazutori.onagare,
				renoteId: game.postId
			});

			return;
		}

		let results: string[] = [];
		let winner: Game['votes'][0]['user'] | null = null;
		
		const reverse = Math.random() < 0.15;

		for (let i = reverse ? 0 : game.maxnum; reverse ? i <= game.maxnum : i >= 0 ; reverse ? i++ : i--) {
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

		const winnerFriend = winner ? this.ai.lookupFriend(winner.id) : null;
		const name = winnerFriend ? winnerFriend.name : null;

		const text = results.join('\n') + '\n\n' + (winner
			? reverse ? serifs.kazutori.finishWithWinnerReverse(acct(winner), name) : serifs.kazutori.finishWithWinner(acct(winner), name)
			: serifs.kazutori.finishWithNoWinner);

		this.ai.post({
			text: text,
			cw: serifs.kazutori.finish,
			renoteId: game.postId
		});

		this.unsubscribeReply(null);
	}
}

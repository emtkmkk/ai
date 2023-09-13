import autobind from 'autobind-decorator';
import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import * as loki from 'lokijs';
import { genItem } from '@/vocabulary';
import config from '@/config';
import { Note } from '@/misskey/note';

export default class extends Module {
	public readonly name = 'poll';
	
	private pollresult: loki.Collection<{
		key: string;
		keyword: string;
	}>;

	@autobind
	public install() {
		this.pollresult = this.ai.getCollection('_poll_pollresult', {
			indices: ['userId']
		});
		setInterval(() => {
			const hours = new Date().getHours()
			const rnd = hours > 17 && hours < 24 ? 0.375 : 0.075;
			if (Math.random() < rnd) {
				this.post();
			}
		}, 1000 * 60 * 30);

		return {
			mentionHook: this.mentionHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	@autobind
	private async post() {
		const duration = 1000 * 60 * 10;

		const polls = [ // TODO: Extract serif
			['珍しそうなもの', 'みなさんは、どれがいちばん珍しいと思いますか？'],
			['美味しそうなもの', 'みなさんは、どれがいちばん美味しいと思いますか？'],
			['重そうなもの', 'みなさんは、どれがいちばん重いと思いますか？'],
			['欲しいもの', 'みなさんは、どれがいちばん欲しいですか？'],
			['無人島に持っていきたいもの', 'みなさんは、無人島にひとつ持っていけるとしたらどれにしますか？'],
			['家に飾りたいもの', 'みなさんは、家に飾るとしたらどれにしますか？'],
			['売れそうなもの', 'みなさんは、どれがいちばん売れそうだと思いますか？'],
			['降ってきてほしいもの', 'みなさんは、どれが空から降ってきてほしいですか？'],
			['携帯したいもの', 'みなさんは、どれを携帯したいですか？'],
			['商品化したいもの', 'みなさんは、商品化するとしたらどれにしますか？'],
			['発掘されそうなもの', 'みなさんは、遺跡から発掘されそうなものはどれだと思いますか？'],
			['良い香りがしそうなもの', 'みなさんは、どれがいちばんいい香りがすると思いますか？'],
			['高値で取引されそうなもの', 'みなさんは、どれがいちばん高値で取引されると思いますか？'],
			['地球周回軌道上にありそうなもの', 'みなさんは、どれが地球周回軌道上を漂っていそうだと思いますか？'],
			['プレゼントしたいもの', 'みなさんは、私にプレゼントしてくれるとしたらどれにしますか？'],
			['プレゼントされたいもの', 'みなさんは、プレゼントでもらうとしたらどれにしますか？'],
			['私が持ってそうなもの', 'みなさんは、私が持ってそうなものはどれだと思いますか？'],
			['流行りそうなもの', 'みなさんは、どれが流行りそうだと思いますか？'],
			['朝ごはん', 'みなさんは、朝ごはんにどれが食べたいですか？'],
			['お昼ごはん', 'みなさんは、お昼ごはんにどれが食べたいですか？'],
			['お夕飯', 'みなさんは、お夕飯にどれが食べたいですか？'],
			['体に良さそうなもの', 'みなさんは、どれが体に良さそうだと思いますか？'],
			['後世に遺したいもの', 'みなさんは、どれを後世に遺したいですか？'],
			['楽器になりそうなもの', 'みなさんは、どれが楽器になりそうだと思いますか？'],
			['お味噌汁の具にしたいもの', 'みなさんは、お味噌汁の具にするとしたらどれがいいですか？'],
			['ふりかけにしたいもの', 'みなさんは、どれをごはんにふりかけたいですか？'],
			['よく見かけるもの', 'みなさんは、どれをよく見かけますか？'],
			['道に落ちてそうなもの', 'みなさんは、道端に落ちてそうなものはどれだと思いますか？'],
			['美術館に置いてそうなもの', 'みなさんは、この中で美術館に置いてありそうなものはどれだと思いますか？'],
			['教室にありそうなもの', 'みなさんは、教室にありそうなものってどれだと思いますか？'],
			['絵文字になってほしいもの', '絵文字になってほしいものはどれですか？'],
			['もこチキの部屋にありそうなもの', 'みなさんは、もこチキの部屋にありそうなものはどれだと思いますか？'],
			['燃えるゴミ', 'みなさんは、どれが燃えるゴミだと思いますか？'],
			['好きなおにぎりの具', 'みなさんの好きなおにぎりの具はなんですか？'],
			['嫌なおにぎりの具', 'みなさんの一番食べたくないおにぎりの具はなんですか？'],
			['最強物決定', 'みなさんは、この中でどれが最強だと思いますか？'],
			['最弱物決定', 'みなさんは、この中でどれが最弱だと思いますか？'],
			['強すぎず弱すぎないもの', 'みなさんは、この中で一番強すぎず弱すぎない物はどれだと思いますか？'],
			['音ゲーで使えるもの', 'みなさんは、この中でいちばん音ゲーに使えそうなのはどれだと思いますか？'],
			['コンビニで売って欲しいもの', 'みなさんが、いちばんコンビニで売って欲しいものはどれですか？'],
			['破壊力があるもの', 'みなさんは、どれが一番破壊力があると感じますか？'],
			['人に押し付けたいもの', 'みなさんは、どれが一番人に押し付けたいですか？'],
			['欲しい物を選べって言われたら', 'この中から一つ欲しいものを選べって言われました…… みなさんならどれにしますか？'],
			['アメリカに持っていきたいもの', 'みなさんがアメリカに持っていくならどれにしますか？'],
			['村長になったら設置したいもの', 'みなさんが村長になったら村に真っ先に設置したいものはどれですか？'],
			['もこきーの新機能', 'もこきーの新機能で、なにかを生成する機能が付きました。それはどれですか？'],
			['栄養バランス最強決定', 'みなさんは、どれがいちばん栄養バランスがいいと思いますか？'],
			['安値で取引されるもの', 'みなさんは、どれがいちばん安値で取引されると思いますか？'],
			['いらないもの', 'みなさんは、どれがいちばんいらないと思いますか？'],
			['プレゼントされたくないもの', 'みなさんは、どれがいちばんプレゼントされたくないと思いますか？'],
			['流行らないもの', 'みなさんは、どれが絶対流行らなさそうだと思いますか？'],
			['食べたくないもの', 'みなさんは、どれがいちばん「ギリギリ食べてもいいかも」と思いますか？'],
			['後世に遺したくないもの', 'みなさんは、どれが一番後世に遺したくないですか？'],
			['美術館に置いてなさそうなもの', 'みなさんは、この中でいちばん美術館に置いてなさそうなものはどれだと思いますか？'],
			['教室になさそうなもの', 'みなさんは、いちばん教室になさそうなものってどれだと思いますか？'],
			['燃えないゴミ', 'みなさんは、どれが燃えないゴミだと思いますか？'],
			['野菜食べてますか', 'みなさ～ん！野菜食べてますか？'],
			['テーマなし', '特にテーマなしです！適当に答えてください！'],
		];

		const poll = polls[Math.floor(Math.random() * polls.length)];
		
		const exist = this.pollresult.findOne({
			key: poll[0]
		});

		let choices = [
			genItem(),
			genItem(),
			...(exist?.keyword ? [exist.keyword] : []),
			genItem(),
			genItem(),
		];
		
		if (Math.random() < 0.3) choices.push(genItem());
		if (Math.random() < 0.3) choices.push(genItem());
		if (Math.random() < 0.3) choices.push(genItem());

		const note = await this.ai.post({
			text: poll[1],
			poll: {
				choices,
				expiredAfter: duration,
				multiple: false,
			}
		});

		// タイマーセット
		this.setTimeoutWithPersistence(duration + 3000, {
			title: poll[0],
			noteId: note.id,
		});
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.includes(['覚えた答'])) {
			const pollresult = this.pollresult.find().filter((x) => !['欲しい物を選べ'].includes(x.key));
			const pollresultstr = pollresult.map((x) => x.key + "\n" + x.keyword).join('\n\n');
			msg.reply('私が覚えた答えです！\n```\n' + pollresultstr + '\n```');
			return true;
		} else {
			if (!msg.or(['/poll']) || msg.user.username !== config.master) {
				return false;
			} else {
				this.log('Manualy poll requested');
			}

			this.post();

			return true;
		}
	}

	@autobind
	private async timeoutCallback({ title, noteId }) {
		const note: Note = await this.ai.api('notes/show', { noteId });

		const choices = note.poll!.choices;

		let mostVotedChoice;
		let totalVoted = 0;

		for (const choice of choices) {
			
			totalVoted += choice.votes
			
			if (mostVotedChoice == null) {
				mostVotedChoice = choice;
				continue;
			}

			if (choice.votes > mostVotedChoice.votes) {
				mostVotedChoice = choice;
			}
		}

		const mostVotedChoices = choices.filter(choice => choice.votes === mostVotedChoice.votes);

		if (mostVotedChoice.votes === 0) {
			this.ai.post({ // TODO: Extract serif
				text: '投票はありませんでした',
				renoteId: noteId,
			});
		} else if (mostVotedChoices.length === 1) {
			if (mostVotedChoice.votes >= 3 || totalVoted > choices.length) {
				const exist = this.pollresult.findOne({
					key: title
				});
				if (exist){
					exist.keyword = mostVotedChoice.text;
					this.pollresult.update(exist);
				} else {
					this.pollresult.insertOne({
						key: title, 
						keyword: mostVotedChoice.text
					});
				}
			}
			this.ai.post({ // TODO: Extract serif
				cw: `${title}アンケートの結果発表です！`,
				text: `結果は${mostVotedChoice.votes}票の「${mostVotedChoice.text}」でした！${mostVotedChoice.votes >= 3 || totalVoted > choices.length ? 'なるほど～！覚えておきます！' : 'なるほど～！'}`,
				renoteId: noteId,
			});
		} else {
			const choices = mostVotedChoices.map(choice => `「${choice.text}」`).join('と');
			this.ai.post({ // TODO: Extract serif
				cw: `${title}アンケートの結果発表です！`,
				text: `結果は${mostVotedChoice.votes}票の${choices}でした！なるほど～！`,
				renoteId: noteId,
			});
		}
	}
}

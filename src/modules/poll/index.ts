/**
 * @packageDocumentation
 *
 * アンケート（投票）モジュール
 *
 * ランダムなテーマでアンケートを自動投稿し、結果を集計・記憶するモジュール。
 * 50種以上のテーマから選ばれたお題に対し、vocabulary から生成されたアイテムを選択肢にする。
 *
 * @remarks
 * - NOTE: アンケートの投稿タイミングは時間帯と activeFactor に依存する。
 *       （朝・昼・夜のアクティブな時間帯に投稿されやすい）
 * - NOTE: 結果は pollresult コレクションに記録され、同じアイテムが連勝している場合は
 *       殿堂入りとして出現率が下がる。
 * - NOTE: 12/31（大晦日）は20:00-20:30に確定で投稿し、選択肢が10個になる。
 * - NOTE: 「好きな絵文字」テーマではインスタンスの絵文字を使用。
 * - NOTE: 「面白いバナナス」テーマでは makeBananasu で選択肢を生成。
 *
 * TODO: セリフ定義を serifs に移動する（現在はインラインで定義されている箇所がある）
 *
 * @public
 */
import autobind from 'autobind-decorator';
import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import * as loki from 'lokijs';
import { genItem } from '@/vocabulary';
import config from '@/config';
import { Note } from '@/misskey/note';

/**
 * アンケートモジュールクラス
 *
 * @remarks
 * 30分間隔で投稿チェックし、確率的にアンケートを投稿する。
 * 結果はタイムアウトコールバックで集計し、最多得票のアイテムを記憶する。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'poll';

	/**
	 * アンケート結果の記憶コレクション（現在の最多得票アイテム）
	 *
	 * @remarks
	 * テーマごとに最新の勝者アイテムと連勝数を記録する。
	 * 同じアイテムが連続で1位になると winCount が増加し、
	 * 次回のアンケートに前回の勝者を選択肢に混ぜる仕組みに使われる。
	 *
	 * @internal
	 */
	private pollresult: loki.Collection<{
		/** アンケートテーマ名 */
		key: string;
		/** 最多得票アイテムのテキスト */
		keyword: string;
		/** 連勝数（同じアイテムが連続で1位になった回数） */
		winCount?: number;
	}>;

	/**
	 * アンケート結果のレジェンドコレクション（過去最高連勝記録）
	 *
	 * @remarks
	 * テーマごとに過去最高の連勝記録を保持する。
	 * 現在の連勝数が legend の記録を超えた場合に更新される。
	 *
	 * @internal
	 */
	private pollresultlegend: loki.Collection<{
		key: string;
		keyword: string;
		winCount?: number;
	}>;

	/**
	 * 進行中のアンケートコレクション
	 *
	 * @remarks
	 * 結果表示時に進行中のアンケートを「覚えた答え」リストから除外するために使用。
	 * install 時に期限切れのエントリは自動削除される。
	 *
	 * @internal
	 */
	private ongoingPolls: loki.Collection<{
		/** アンケートのテーマ名 */
		title: string;
		/** 投稿されたノートのID */
		noteId: string;
		/** 有効期限（ミリ秒タイムスタンプ） */
		expiration: number;
	}>;

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * 3つのLokiJSコレクションを初期化し、期限切れのongoingPollsを削除。
	 * 30分間隔でアンケート投稿判定を行う。投稿確率は時間帯に依存:
	 * - 12時 / 17-23時: 25% × activeFactor
	 * - 7-12時 / 13-16時: 5% × activeFactor
	 * - 0-6時: 投稿しない
	 * - 12/31 20:00-20:30: 確定投稿
	 *
	 * @returns mentionHook と timeoutCallback を含むフック登録オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		this.pollresult = this.ai.getCollection('_poll_pollresult', {
			indices: ['userId']
		});
		this.pollresultlegend = this.ai.getCollection('_poll_pollresultlegend', {
			indices: ['userId']
		});
		this.ongoingPolls = this.ai.getCollection('_poll_ongoingPolls', {
			indices: ['noteId']
		});
		this.ongoingPolls.findAndRemove({'expiration':{ $lt: Date.now() }});

		setInterval(() => {
			const hours = new Date().getHours();
			let rnd = ((hours === 12 || (hours > 17 && hours < 24)) ? 0.25 : 0.05) * this.ai.activeFactor;
			if ((hours > 0 && hours < 7) || (hours > 13 && hours < 17)) return;
			if (new Date().getMonth() === 11 && new Date().getDate() === 31) {
				if (hours != 20 || new Date().getMinutes() > 30) {
					return;
				} else {
					rnd = 1;
				}
			}
			if (Math.random() < rnd) {
				this.post();
			}
		}, 1000 * 60 * 30);

		return {
			mentionHook: this.mentionHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	/**
	 * アンケートの投稿
	 *
	 * @remarks
	 * 50種以上のテーマからランダムに1つ選び、vocabulary から生成したアイテムを選択肢として
	 * Misskey の投票機能付きノートを投稿する。
	 *
	 * 投票受付時間:
	 * - 通常: 10分（activeFactor が低い場合は延長される）
	 * - 大晦日: 120分
	 *
	 * 選択肢数:
	 * - 通常: 4個（28%の確率で各+1、最大9個。連勝数が多いほど追加されやすい）
	 * - 大晦日: 10個
	 * - 連勝中のアイテムがある場合: 選択肢にランダム挿入
	 *
	 * @param key - テーマのフィルタキー（指定時はキーを含むテーマから選択）
	 * @internal
	 */
	@autobind
	private async post(key?: string) {
		this.ai.decActiveFactor(0.05);

		const nenmatu = new Date().getMonth() === 11 && new Date().getDate() === 31;

		let duration = nenmatu ? 1000 * 60 * 120 : 1000 * 60 * 10;

		// 機嫌が低い場合、受付時間を延長
		if (!nenmatu && this.ai.activeFactor < 0.75) {
			duration = Math.floor(1 / (1 - Math.min((0.91 - this.ai.activeFactor) * 1 * (0.5 + Math.random() * 0.5), 0.6)) * duration / 120000) * 120000;
		}

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
			['道端に落ちてそうなもの', 'みなさんは、道端に落ちてそうなものはどれだと思いますか？'],
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
			['ギリギリ食べてもいいもの', 'みなさんは、どれがいちばん「ギリギリ食べてもいいかも」と思いますか？'],
			['キレイなもの', 'みなさんは、どれがいちばんキレイだと思いますか？'],
			['致死性があるもの', 'みなさんは、どれがいちばん致死性があると思いますか？'],
			['口に出したい日本語', 'みなさんは、どれがいちばん口に出したい日本語だと思いますか？'],
			['子供に大人気なもの', 'みなさんは、どれがいちばん子供に大人気だと思いますか？'],
			['渋いもの', 'みなさんは、どれがいちばん渋いと思いますか？'],
			['辛いもの', 'みなさんは、どれがいちばん辛いと思いますか？'],
			['すっぱいもの', 'みなさんは、どれがいちばんすっぱいと思いますか？'],
			['苦いもの', 'みなさんは、どれがいちばん苦いと思いますか？'],
			['「概念」なもの', 'みなさんは、この中でいちばん「概念」であるものはどれだと思いますか？'],
			['オモコロで紹介されそうなもの', 'みなさんは、この中でいちばんオモコロで紹介されそうなものはどれだと思いますか？'],
			['もこチキに使いたいもの', 'みなさんは、この中でいちばん私に使用したいものはどれだと思いますか？'],
			['生きているもの', 'みなさんは、この中でいちばん生きているものはどれだと思いますか？'],
			['生きてないもの', 'みなさんは、この中でいちばん生きてないものはどれだと思いますか？'],
			['新鮮なもの', 'みなさんは、この中でいちばん新鮮なものはどれだと思いますか？'],
			['叩くと気持ちいいもの', 'みなさんは、この中でいちばん叩くと気持ちいいものはどれだと思いますか？'],
			['手触りがいいもの', 'みなさんは、この中でいちばん手触りがいいものはどれだと思いますか？'],
			['ソフトウェアの新名称になりそうなもの', 'みなさんは、この中でいちばんソフトウェアの新名称になりそうなものはどれだと思いますか？'],
			['後世に遺したくないもの', 'みなさんは、どれが一番後世に遺したくないですか？'],
			['美術館に置いてなさそうなもの', 'みなさんは、この中でいちばん美術館に置いてなさそうなものはどれだと思いますか？'],
			['教室になさそうなもの', 'みなさんは、いちばん教室になさそうなものってどれだと思いますか？'],
			['燃えないゴミ', 'みなさんは、どれが燃えないゴミだと思いますか？'],
			['滅茶苦茶なもの', 'みなさんは、この中で一番滅茶苦茶なものってどれだと思いますか？'],
			['面白いもの', 'みなさんは、この中で一番面白いものってどれだと思いますか？'],
			['野菜食べてますか', 'みなさ～ん！野菜食べてますか？'],
			['テーマなし', '特にテーマなしです！適当に答えてください！'],
			['好きな絵文字', 'みなさんは、この中でどの絵文字が一番好きですか？'],
			['面白いバナナス', 'みなさんは、この中でどのバナナスが一番面白いと思いますか？'],
			['最も高価なもの', 'みなさんは、どれがいちばん高価だと思いますか？'],
		];

		const selectedPolls = key ? polls.filter((x) => x[0].includes(key)) : [];

		const poll = nenmatu ? [`${new Date().getFullYear()}年っぽい響きのもの`, `みなさん、${new Date().getFullYear()}年ももうすぐ終わりですね～ みなさんはこの中でいちばん${new Date().getFullYear()}年っぽい響きのものはどれだと思いますか？`] : selectedPolls.length ? selectedPolls[Math.floor(Math.random() * selectedPolls.length)] : polls[Math.floor(Math.random() * polls.length)];

		const exist = this.pollresult.findOne({
			key: poll[0]
		});

		const genItemOptions = {allowSimpleItem: false};

		let choices = nenmatu ? [
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
		] : [
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
			genItem(genItemOptions),
		];

		if (!nenmatu) {
			if (Math.random() < 0.28 || (exist?.winCount && exist.winCount >= 2)) choices.push(genItem(genItemOptions));
			if (Math.random() < 0.28 || (exist?.winCount && exist.winCount >= 4)) choices.push(genItem(genItemOptions));
			if (Math.random() < 0.28 || (exist?.winCount && exist.winCount >= 6)) choices.push(genItem(genItemOptions));
			if (Math.random() < 0.28 || (exist?.winCount && exist.winCount >= 8)) choices.push(genItem(genItemOptions));
			if (Math.random() < 0.28 || (exist?.winCount && exist.winCount >= 10)) choices.push(genItem(genItemOptions));
			if (poll[0] === '好きな絵文字') {
				const data = (await this.ai.api('emojis', {})).emojis?.filter((x) => !x.category?.includes("!")).sort(() => Math.random() - 0.5);
				choices = data.slice(0, choices.length).map((x) => `:${x.name}:`);
			}
			if (poll[0] === '面白いバナナス') {
				const count = choices.length;
				choices = [];
				for (let i = 0; i < count; i++) {
					choices.push(this.ai.makeBananasu(""));
				}
			}
			if (exist?.keyword && exist?.keyword.length > 3) {
				const randomIndex = Math.floor(Math.random() * (choices.length + 1));
				choices.splice(randomIndex, 0, exist.keyword);
			}
		}


		const note = await this.ai.post({
			text: poll[1],
			poll: {
				choices,
				expiredAfter: duration,
				multiple: false,
			}
		});

		// `ongoingPolls`に登録
		this.ongoingPolls.insertOne({
			title: poll[0],
			noteId: note.id,
			expiration: Date.now() + duration,
		});

		// タイマーセット
		this.setTimeoutWithPersistence(duration + 3000, {
			title: poll[0],
			noteId: note.id,
			duration: duration,
		});
	}

	/**
	 * メンション受信時のフック
	 *
	 * @remarks
	 * 2つのコマンドに対応:
	 *
	 * 1. 「覚えた答え」確認:
	 *    「覚えた」+「答」を含むメンションで、記憶しているアンケート結果一覧を返信する。
	 *    進行中のアンケートのテーマは除外される。連勝数が多い順にソート。
	 *
	 * 2. 管理者コマンド `/poll [テーマキー]`:
	 *    管理者のみ実行可能。指定テーマ（部分一致）でアンケートを手動投稿する。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.includes(['覚えた', 'おぼえた']) && msg.includes(['答', 'こたえ'])) {
			const convertpoll = [
				['欲しい物を選べ', '欲しい物を選べって言われたら'],
				['食べたくないもの', 'ギリギリ食べてもいいもの'],
				['道に落ちてそうなもの', '道端に落ちてそうなもの']
			];
			convertpoll.forEach((x) => {
				const exist = this.pollresult.findOne({
					key: x[0]
				});
				const exist2 = this.pollresult.findOne({
					key: x[1]
				});
				if (exist && !exist2) {
					this.pollresult.insertOne({
						key: x[1],
						keyword: exist.keyword,
						winCount: exist.winCount ?? 1,
					});
					this.pollresult.remove(exist);
				} else if (exist && exist2) {
					this.pollresult.remove(exist);
				}
			});

			// 現在受付中のpollのタイトルを取得
			const ongoingTitles = this.ongoingPolls.find().map(poll => poll.title);

			// pollresultからongoingTitlesに含まれないものをフィルタリング
			const pollresult = this.pollresult.find().filter(x => !ongoingTitles.includes(x.key)).sort((a, b) => {
				// 連勝数が多い順、同じなら文字列コード順
				if ((a.winCount ?? 1) === (b.winCount ?? 1)) {
					const isYearA = /^\d{4}/.test(a.key);
					const isYearB = /^\d{4}/.test(b.key);
					if (isYearA && !isYearB) {
						return 1;
					}
					if (isYearB && !isYearA) {
						return -1;
					}
					if (a.key < b.key) {
						return -1;
					}
					if (b.key > a.key) {
						return 1;
					}
					return 0;
				} else {
					return (b.winCount ?? 1) - (a.winCount ?? 1);
				}
			});

			const pollresultstr = pollresult.map((x) => x.key + "\n" + x.keyword + (x.winCount && x.winCount > 1 ? "(" + x.winCount + "連勝)" : "")).join('\n\n');
			msg.reply('私が覚えた答えです！\n```\n' + pollresultstr + '\n```');
			return { reaction: 'love' };
		} else {
			if (!msg.includes(['/poll']) || msg.user.host || msg.user.username !== config.master) {
				return false;
			} else {
				const key = /\/poll\s(\S+)$/.exec(msg.text)?.[1];
				this.log('Manualy poll requested key: ' + (key ?? 'null'));
				this.post(key);

				return { reaction: 'love' };
			}
		}
	}

	/**
	 * アンケート終了時のタイムアウトコールバック
	 *
	 * @remarks
	 * アンケートの結果を集計し、最多得票のアイテムを記憶する。
	 *
	 * 結果パターン:
	 * - 投票0: activeFactor を減少させるのみ（投稿しない）
	 * - 単独1位: 結果を発表し、pollresult/pollresultlegend に記録。
	 *   3票以上 or 総投票数が選択肢数超の場合に記憶する。
	 *   同じアイテムの連勝時は winCount を増加。
	 * - 同率1位: 以前の勝者以外からランダムに1つ選んで記憶。
	 *
	 * @param params - タイムアウトパラメータ
	 * @param params.title - アンケートのテーマ名
	 * @param params.noteId - 投稿ノートのID
	 * @param params.duration - 投票受付時間（ミリ秒）
	 * @internal
	 */
	@autobind
	private async timeoutCallback({ title, noteId, duration, }) {
		const note: Note = await this.ai.api('notes/show', { noteId });

		const choices = note.poll!.choices;

		let mostVotedChoice;
		let totalVoted = 0;

		for (const choice of choices) {
			totalVoted += choice.votes;

			if (mostVotedChoice == null) {
				mostVotedChoice = choice;
				continue;
			}

			if (choice.votes > mostVotedChoice.votes) {
				mostVotedChoice = choice;
			}
		}

		const mostVotedChoices = choices.filter(choice => choice.votes === mostVotedChoice.votes);
		const nenmatu = new Date().getMonth() === 11 && new Date().getDate() === 31;

		if (mostVotedChoice.votes === 0) {
			//this.ai.post({ // TODO: Extract serif
			//	text: '投票はありませんでした',
			//	renoteId: noteId,
			//});
			this.ai.decActiveFactor(0.01 * (duration ?? 600000) / 60000);
		} else if (mostVotedChoices.length === 1) {
			let isStreak = false;
			if (mostVotedChoice.votes >= 3 || totalVoted > choices.length) {
				const exist = this.pollresult.findOne({
					key: title
				});
				if (exist) {
					isStreak = exist.keyword === mostVotedChoice.text;
					exist.winCount = isStreak ? (exist.winCount ?? 1) + 1 : 1;
					exist.keyword = mostVotedChoice.text;
					this.pollresult.update(exist);
					const legend = this.pollresultlegend.findOne({
						key: title
					});
					if (!legend) {
						this.pollresultlegend.insertOne({
							key: exist.key,
							keyword: exist.keyword,
							winCount: exist.winCount,
						});
					} else if (exist.winCount > (legend.winCount ?? 1)) {
						legend.winCount = exist.winCount;
						legend.keyword = exist.keyword;
						this.pollresultlegend.update(legend);
					}
				} else {
					this.pollresult.insertOne({
						key: title,
						keyword: mostVotedChoice.text,
						winCount: 1,
					});
					this.pollresultlegend.insertOne({
						key: title,
						keyword: mostVotedChoice.text,
						winCount: 1,
					});
				}
			}
			// `ongoingPolls`から削除
			this.ongoingPolls.findAndRemove({'noteId':noteId});
			this.ai.post({ // TODO: Extract serif
				cw: `${title}アンケートの結果発表です！`,
				text: `結果は${mostVotedChoice.votes}票の「${mostVotedChoice.text}」でした！なるほど～！${isStreak ? '' : mostVotedChoice.votes >= 3 || totalVoted > choices.length ? '覚えておきます！' : ''}${nenmatu ? '来年もいい年になりますように！' : ''}`,
				renoteId: noteId,
			});
		} else {
			const choicesStr = mostVotedChoices.map(choice => `「${choice.text}」`).join('と');
			if (mostVotedChoice.votes >= 3 || totalVoted > choices.length) {
				const exist = this.pollresult.findOne({
					key: title
				});
				if (exist) {
					const newKeywords = mostVotedChoices.filter((x) => exist.keyword !== x.text);
					const learnKeyword = newKeywords[Math.floor(Math.random() * newKeywords.length)];
					exist.keyword = learnKeyword.text;
					exist.winCount = 1;
					this.pollresult.update(exist);
					const legend = this.pollresultlegend.findOne({
						key: title
					});
					if (!legend) {
						this.pollresultlegend.insertOne({
							key: exist.key,
							keyword: exist.keyword,
							winCount: exist.winCount,
						});
					} else if (exist.winCount > (legend.winCount ?? 1)) {
						legend.winCount = exist.winCount;
						legend.keyword = exist.keyword;
						this.pollresultlegend.update(legend);
					}
				} else {
					const learnKeyword = mostVotedChoices[Math.floor(Math.random() * mostVotedChoices.length)];
					this.pollresult.insertOne({
						key: title,
						keyword: learnKeyword.text,
						winCount: 1,
					});
					this.pollresultlegend.insertOne({
						key: title,
						keyword: learnKeyword.text,
						winCount: 1,
					});
				}
			}
			// `ongoingPolls`から削除
			this.ongoingPolls.findAndRemove({'noteId':noteId});
			this.ai.post({ // TODO: Extract serif
				cw: `${title}アンケートの結果発表です！`,
				text: `結果は${mostVotedChoice.votes}票の${choicesStr}でした！なるほど～！${mostVotedChoice.votes >= 3 || totalVoted > choices.length ? '覚えておきます！' : ''}${nenmatu ? '来年もいい年になりますように！' : ''}`,
				renoteId: noteId,
			});
		}
	}
}

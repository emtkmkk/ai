/**
 * @packageDocumentation
 *
 * 迷路生成モジュール
 *
 * 毎日20時に迷路画像を自動投稿し、メンションで個別リクエストにも対応する。
 * 迷路はシード値から決定論的に生成され、難易度に応じてサイズが変わる。
 *
 * @remarks
 * - NOTE: 12/31 は年号に基づくサイズ（`年 - 2000`）。4/1 はサイズ500の巨大迷路。
 * - NOTE: 自動投稿のサイズは 2〜50 で、25%の確率で×2、さらに25%で×2される。
 * - NOTE: メンションでの難易度は日本語キーワードで指定する。
 * - NOTE: 9種類のカラーテーマからランダムに選ばれる。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genMaze } from './gen-maze';
import { renderMaze } from './render-maze';
import Message from '@/message';

/**
 * 迷路モジュールクラス
 *
 * @remarks
 * 3分間隔でポーリングし、20時台に日次迷路を投稿する。
 * メンションで「迷路」と送ると、難易度指定付きの個別迷路を生成・返信する。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'maze';

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * 起動時に即座に投稿チェックし、以降3分間隔でポーリングする。
	 *
	 * @returns mentionHook を含むフック登録オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		this.post();
		setInterval(this.post, 1000 * 60 * 3);

		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * 日次迷路の自動投稿
	 *
	 * @remarks
	 * 20時台に1日1回だけ迷路画像を投稿する。
	 * サイズは2〜50（最大200まで拡大する可能性あり）。
	 * 特別な日はサイズが固定される:
	 * - 12/31: `年 - 2000`
	 * - 4/1: 500
	 *
	 * @internal
	 */
	@autobind
	private async post() {
		const now = new Date();
		if (now.getHours() !== 20) return;
		const date = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
		const data = this.getData();
		if (data.lastPosted == date) return;
		data.lastPosted = date;
		this.setData(data);

		let mazeSize;
		mazeSize = 2 + Math.floor(Math.random() * 48);
		// 25%の確率でサイズ倍増（最大2回まで）
		if (Math.random() < 0.25) mazeSize *= 2;
		if (Math.random() < 0.25) mazeSize *= 2;

		// 特別な日のサイズ固定
		if (now.getMonth() === 11 && now.getDate() === 31) mazeSize = now.getFullYear() - 2000;
		if (now.getMonth() === 3 && now.getDate() === 1) mazeSize = 500;

		this.log('Time to maze');
		const file = await this.genMazeFile(date + "/mkck", mazeSize);

		this.log('Posting...');
		this.ai.post({
			text: serifs.maze.post + " 難易度 : " + mazeSize + "%",
			fileIds: [file.id]
		});
	}

	/**
	 * 迷路画像の生成・アップロード
	 *
	 * @remarks
	 * シード値から迷路を生成し、PNG画像に描画してMisskeyにアップロードする。
	 *
	 * @param seed - 迷路生成のシード値（日付文字列等）
	 * @param size - 迷路のサイズ（省略時はデフォルト値）
	 * @returns アップロードされたファイルオブジェクト
	 * @internal
	 */
	@autobind
	private async genMazeFile(seed, size?): Promise<any> {
		this.log('Maze generating...');
		const maze = genMaze(seed, size);

		this.log('Maze rendering...');
		const data = renderMaze(seed, maze);

		this.log('Image uploading...');
		const file = await this.ai.upload(data, {
			filename: 'maze.png',
			contentType: 'image/png'
		});

		return file;
	}

	/**
	 * メンション受信時のフック: 迷路リクエスト
	 *
	 * @remarks
	 * 「迷路」を含むメンションに対して、指定された難易度の迷路を生成・返信する。
	 * 難易度は日本語キーワードで指定可能。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.includes(['迷路'])) {
			let size: string | null = null;
			// 難易度キーワードで判定
			if (msg.includes(['簡単', 'かんたん', '易しい', 'やさしい', '小さい', 'ちいさい'])) size = 'easy';
			if (msg.includes(['接待', '超かんたん'])) size = 'veryEasy';
			if (msg.includes(['ふつう', '普通'])) size = 'normal';
			if ((msg.includes(['よっぱらい', '酔っぱらい']) && msg.includes(['接待', '超かんたん'])) || msg.includes(['超接待', '超超かんたん'])) size = 'veryVeryEasy';
			if (msg.includes(['難しい', 'むずかしい', '複雑な', '大きい', 'おおきい'])) size = 'hard';
			if (msg.includes(['死', '鬼', '地獄', '超むずかしい', 'おに'])) size = 'veryHard';
			if (msg.includes(['もこ']) && msg.includes(['本気']) || msg.includes(['裏']) && msg.includes(['おに'])) size = 'ai';
			this.log('Maze requested');
			// 3秒の遅延後に迷路生成（生成処理の負荷分散のため）
			setTimeout(async () => {
				const file = await this.genMazeFile(Date.now(), size);
				this.log('Replying...');
				msg.reply(serifs.maze.foryou, { file, visibility: 'public' });
			}, 3000);
			return {
				reaction: 'like'
			};
		} else {
			return false;
		}
	}
}

import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genMaze } from './gen-maze';
import { renderMaze } from './render-maze';
import Message from '@/message';

export default class extends Module {
	public readonly name = 'maze';

	@autobind
	public install() {
		this.post();
		setInterval(this.post, 1000 * 60 * 3);

		return {
			mentionHook: this.mentionHook
		};
	}

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
		if (Math.random() < 0.25) mazeSize *= 2;
		if (Math.random() < 0.25) mazeSize *= 2;

		if (now.getMonth() === 11 && now.getDay() === 31) mazeSize = now.getFullYear() - 2000;
		if (now.getMonth() === 3 && now.getDay() === 1) mazeSize = 500;

		this.log('Time to maze');
		const file = await this.genMazeFile(date,mazeSize);

		this.log('Posting...');
		this.ai.post({
			text: serifs.maze.post + " 難易度 : " + mazeSize + "%",
			fileIds: [file.id]
		});
	}

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

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.includes(['迷路'])) {
			let size: string | null = null;
			if (msg.includes(['簡単', 'かんたん', '易しい', 'やさしい', '小さい', 'ちいさい'])) size = 'easy';
			if (msg.includes(['接待','超かんたん'])) size = 'veryEasy';
			if (msg.includes(['ふつう','普通'])) size = 'normal';
			if ((msg.includes(['よっぱらい','酔っぱらい']) && msg.includes(['接待','超かんたん'])) || msg.includes(['超接待','超超かんたん'])) size = 'veryVeryEasy';
			if (msg.includes(['難しい', 'むずかしい', '複雑な', '大きい', 'おおきい'])) size = 'hard';
			if (msg.includes(['死', '鬼', '地獄', '超むずかしい', 'おに'])) size = 'veryHard';
			if (msg.includes(['もこ']) && msg.includes(['本気']) || msg.includes(['裏']) && msg.includes(['おに'])) size = 'ai';
			this.log('Maze requested');
			setTimeout(async () => {
				const file = await this.genMazeFile(Date.now(), size);
				this.log('Replying...');
				msg.reply(serifs.maze.foryou, { file,visibility: 'public' });
			}, 3000);
			return {
				reaction: 'like'
			};
		} else {
			return false;
		}
	}
}

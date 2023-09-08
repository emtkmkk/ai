import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import Message from '@/message';
import { renderChart } from './render-chart';
import { items } from '@/vocabulary';
import config from '@/config';

export default class extends Module {
	public readonly name = 'chart';

	@autobind
	public install() {
		if (config.chartEnabled === false) return {};

		this.post();
		setInterval(this.post, 1000 * 60 * 3);

		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async post() {
		const now = new Date();
		if (now.getHours() !== 23 && now.getMinutes() < 50) return;
		const date = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
		const data = this.getData();
		if (data.lastPosted == date) return;
		data.lastPosted = date;
		this.setData(data);

		this.log('Time to chart');
		const fileNotes = await this.genChart('notes');
		const fileUsers = await this.genChart('users');

		this.log('Posting...');
		this.ai.post({
			text: serifs.chart.post,
			fileIds: [fileNotes.id, fileUsers.id]
		});
	}

	@autobind
	private async genChart(type, params?): Promise<any> {
		this.log('Chart data fetching...');

		let chart;

		if (type === 'userNotes') {
			const data = await this.ai.api('charts/user/notes', {
				span: 'day',
				limit: 30,
				userId: params.user.id
			});

			chart = {
				title: `@${params.user.username}さんの投稿数`,
				datasets: [{
					data: data.diffs.normal
				}, {
					data: data.diffs.reply
				}, {
					data: data.diffs.renote
				}, {
					data: data.diffs.withFile
				}]
			};
		} else if (type === 'followers') {
			const data = await this.ai.api('charts/user/following', {
				span: 'day',
				limit: 30,
				userId: params.user.id
			});

			chart = {
				title: `@${params.user.username}さんのフォロワー数`,
				datasets: [{
					data: data.local.followers.total
				}, {
					data: data.remote.followers.total
				}]
			};
		} else if (type === 'notes') {
			const data = await this.ai.api('charts/notes', {
				span: 'day',
				limit: 30,
			});

			chart = {
				title: `もこきーの投稿数`,
				datasets: [{
					data: data.local.diffs.normal
				}, {
					data: data.local.diffs.reply
				}, {
					data: data.local.diffs.renote
				}, {
					data: data.local.diffs.withFile
				}]
			};
		} else if (type === 'users') {
			const dataA = await this.ai.api('charts/active-users', {
				span: 'day',
				limit: 30,
			});
			const dataU = await this.ai.api('charts/users', {
				span: 'day',
				limit: 30,
			});
			
			const data = dataA.map((x, i) => ({...x,...dataU[i]}))

			chart = {
				title: `もこきーのユーザ数`,
				datasets: [{
					data: data.readWrite
				}, {
					data: data.read.map((x, i) => x - data.readWrite[i])
				}, {
					data: data.local.total.map((x, i) => x - data.local.inc[i] - data.read[i])
				}, {
					data: data.local.inc
				}]
			};
		} else {
			const suffixes = ['の売り上げ', 'の消費', 'の生産'];

			const limit = 30;
			const diffRange = 150;
			const datasetCount = 1 + Math.floor(Math.random() * 3);

			let datasets: any[] = [];

			for (let d = 0; d < datasetCount; d++) {
				let values = [Math.random() * 1000];

				for (let i = 1; i < limit; i++) {
					const prev = values[i - 1];
					values.push(prev + ((Math.random() * (diffRange * 2)) - diffRange));
				}

				datasets.push({
					data: values
				});
			}

			chart = {
				title: params.title ?? items[Math.floor(Math.random() * items.length)] + suffixes[Math.floor(Math.random() * suffixes.length)],
				datasets: datasets
			};
		}

		this.log('Chart rendering...');
		const img = renderChart(chart);

		this.log('Image uploading...');
		const file = await this.ai.upload(img, {
			filename: 'chart.png',
			contentType: 'image/png'
		});

		return file;
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.includes(['チャート'])) {
			return false;
		} else {
			this.log('Chart requested');
		}

		let type = 'random';
		if (msg.includes(['フォロワー'])) type = 'followers';
		if (msg.includes(['投稿'])) type = 'userNotes';
		
		const title = type === 'random' ? /チャート\s?(\S{1,15})/.exec(msg.extractedText)?.[1] : undefined;

		const file = await this.genChart(type, {
			user: msg.user,
			title: title
		});

		this.log('Replying...');
		msg.reply(serifs.chart.foryou, { file, localOnly: !!title });

		return {
			reaction: 'like'
		};
	}
}

/**
 * @packageDocumentation
 *
 * チャート生成モジュール
 *
 * Misskey の統計APIからデータを取得し、棒グラフ画像を生成して投稿する。
 * 毎日23:50頃に自動投稿し、メンションによるリクエストにも対応する。
 *
 *
 * @remarks
 * - NOTE: `config.chartEnabled` が `false` の場合は無効化される。
 * - NOTE: 自動投稿はインスタンス全体の投稿数チャートとユーザー数チャートの2枚。
 * - NOTE: メンションでは個人の投稿数・フォロワー数のほか、ランダムなデタラメチャートも生成可能。
 * - NOTE: デタラメチャートのタイトルに vocabulary の items を使用。
 * - NOTE: 大晦日（12/31）には年末特別メッセージ付き。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import Message from '@/message';
import { renderChart } from './render-chart';
import { items } from '@/vocabulary';
import { checkNgWord } from '@/utils/check-ng-word';
import config from '@/config';

/**
 * チャートモジュールクラス
 *
 * @remarks
 * 3分間隔でポーリングし、23時50分以降に日次チャートを投稿する。
 * メンションで「チャート」と送ると、ユーザー向けのチャートを生成・返信する。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'chart';

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * `config.chartEnabled` が `false` の場合は空オブジェクトを返し、モジュールを無効化する。
	 * 有効な場合は3分間隔で日次投稿チェックを行う。
	 *
	 * @returns mentionHook を含むフック登録オブジェクト、または空オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		if (config.chartEnabled === false) return {};

		this.post();
		// 3分間隔でポーリング
		setInterval(this.post, 1000 * 60 * 3);

		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * 日次チャートの自動投稿
	 *
	 * @remarks
	 * 23時50分以降、1日1回だけ投稿数チャートとユーザー数チャートの2枚を投稿する。
	 * 12/31は年末特別メッセージ付き。
	 *
	 * @internal
	 */
	@autobind
	private async post() {
		const now = new Date();
		// 23時50分以降のみ実行
		if (now.getHours() !== 23 || now.getMinutes() < 50) return;
		const date = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
		const data = this.getData();
		if (data.lastPosted == date) return;
		data.lastPosted = date;
		this.setData(data);

		this.log('Time to chart');
		const fileNotes = await this.genChart('notes');
		const fileUsers = await this.genChart('users');

		this.log('Posting...');
		const nenmatu = new Date().getMonth() === 11 && new Date().getDate() === 31;
		this.ai.post({
			text: nenmatu ? serifs.chart.nenmatuPost : serifs.chart.post,
			visibility: "public",
			fileIds: [fileNotes.id, fileUsers.id]
		});
		this.ai.decActiveFactor(0.015);
	}

	/**
	 * チャート画像の生成
	 *
	 * @remarks
	 * チャートタイプに応じてMisskey APIからデータを取得し、画像を生成してアップロードする。
	 *
	 * 対応チャートタイプ:
	 * - `userNotes`: 特定ユーザーの投稿数（通常/リプライ/リノート/ファイル付き）
	 * - `followers`: 特定ユーザーのフォロワー数（ローカル/リモート）
	 * - `notes`: インスタンス全体の投稿数
	 * - `users`: インスタンスのユーザー数（読み書き/閲覧のみ/非アクティブ/新規）
	 * - その他: ランダムデータのデタラメチャート
	 *
	 * @param type - チャートタイプ
	 * @param params - ユーザー情報やタイトル等の追加パラメータ
	 * @returns アップロードされたファイルオブジェクト
	 * @internal
	 */
	@autobind
	private async genChart(type, params?): Promise<any> {
		this.log('Chart data fetching...');

		let chart;

		if (type === 'userNotes') {
			// 特定ユーザーの投稿数チャート（30日分）
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
			// 特定ユーザーのフォロワー数チャート（30日分）
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
			// インスタンス全体の投稿数チャート（30日分）
			const data = await this.ai.api('charts/notes', {
				span: 'day',
				limit: 30,
			});

			chart = {
				title: `${config.instanceName}の投稿数`,
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
			// インスタンスのユーザー数チャート（30日分）
			const dataA = await this.ai.api('charts/active-users', {
				span: 'day',
				limit: 30,
			});
			const dataU = await this.ai.api('charts/users', {
				span: 'day',
				limit: 30,
			});

			const data = { ...dataA, ...dataU };

			chart = {
				title: `${config.instanceName}のユーザ数`,
				datasets: [{
					data: data.readWrite       // 読み書きユーザー
				}, {
					data: data.read.map((x, i) => x - data.readWrite[i])  // 閲覧のみ
				}, {
					data: data.local.total.map((x, i) => x - data.local.inc[i] - data.read[i])  // 非アクティブ
				}, {
					data: data.local.inc  // 新規ユーザー
				}]
			};
		} else {
			// デタラメチャート（ランダムデータ）
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

	/**
	 * メンション受信時のフック: チャートリクエスト
	 *
	 * @remarks
	 * 「チャート」を含むメンションに対してチャートを生成・返信する。
	 * - 「フォロワー」を含む: フォロワー数チャート
	 * - 「投稿」を含む: 投稿数チャート
	 * - それ以外: デタラメチャート（「チャート ○○」でタイトル指定可能）
	 *
	 * NOTE: リモートユーザーがタイトル指定した場合は localOnly で投稿する（スパム対策）。
	 * NOTE: タイトルがNGワードに該当する場合は無視する。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
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

		// 「チャート ○○」でタイトル指定（最大25文字）
		let title = type === 'random' ? /チャート\s?(\S{1,25})/.exec(msg.extractedText)?.[1] : undefined;

		// NGワードチェック
		if (title && !checkNgWord(title)) title = undefined;

		const file = await this.genChart(type, {
			user: msg.user,
			title: title
		});

		this.log('Replying...');
		// リモートユーザーがタイトル指定した場合は localOnly にする
		msg.reply(serifs.chart.foryou, { file, visibility: 'public', localOnly: !!msg.user.host && !!title });

		return {
			reaction: 'like'
		};
	}
}

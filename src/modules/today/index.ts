import autobind from 'autobind-decorator';
import Module from '@/module';
import Friend from '@/friend';
import serifs from '@/serifs';

export default class TodayModule extends Module {
	public readonly name = 'today';

	@autobind
	public install() {
		this.post();
		setInterval(this.post, 1000 * 60 * 12);
		return {};
	}

	/**
	 * 毎日投稿
	 */
	@autobind
	private async post() {
		const now = new Date();
		if (now.getHours() < 8) return;

		const yyyy = now.getFullYear();
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const dd = String(now.getDate()).padStart(2, '0');
		const dateKey = `${yyyy}-${mm}-${dd}`;

		const data = this.getData();
		if (data.lastPosted === dateKey) return;
		data.lastPosted = dateKey;
		this.setData(data);

		let info: {
			week: string;
			gengo: string;
			wareki: number;
			holiday: string;
			sekki: string;
			rokuyou: string;
			hitotubuflg: boolean;
			tensyabiflg: boolean;
			daimyoubiflg: boolean;
		};
		let annivJson: Record<string, string>;

		try {
			// こよみ API
			const koyomiRes = await fetch(
				`https://koyomi.zingsystem.com/api/?mode=d&cnt=1&targetyyyy=${yyyy}&targetmm=${mm}&targetdd=${dd}`
			);
			if (!koyomiRes.ok) {
				console.error('こよみ API レスポンスエラー', koyomiRes.status);
				return; // 失敗したら中断
			}
			const koyomiData = await koyomiRes.json();
			info = koyomiData.datelist[dateKey];
			if (!info) {
				console.error('こよみ API のデータがありません');
				return;
			}

			// 記念日 API
			const mmdd = `${mm}${dd}`;
			const annivRes = await fetch(`https://api.whatistoday.cyou/v3/anniv/${mmdd}`);
			if (!annivRes.ok) {
				console.error('記念日 API レスポンスエラー', annivRes.status);
				return; // 失敗したら中断
			}
			annivJson = await annivRes.json();
		} catch (error) {
			console.error('API 通信中に例外が発生しました', error);
			return; // fetch 自体で例外が起きたら中断
		}

		// --- 取得成功後にイベントを組み立てる ---
		const youbi = info.week + '曜日';
		const dateStr = `${info.gengo}${info.wareki}年${now.getMonth() + 1}月${now.getDate()}日`;

		// Set を使って重複を防止
		const eventsSet = new Set<string>();

		if (info.holiday) eventsSet.add(info.holiday);

		for (let i = 1; i <= 5; i++) {
			const anniv = annivJson[`anniv${i}`];
			if (anniv) eventsSet.add(anniv);
		}
		if (info.sekki) eventsSet.add(`${info.sekki}の日`);
		if (info.hitotubuflg) eventsSet.add('一粒万倍日');
		if (info.tensyabiflg) eventsSet.add('天赦日');
		if (info.daimyoubiflg) eventsSet.add('大明日');
		if (info.rokuyou) eventsSet.add(`六曜: ${info.rokuyou}`);
		if (now.getMonth() + 1 * now.getDate()) eventsSet.add(`月×日: ${((now.getMonth() + 1) * now.getDate()).toLocaleString()}`);

		// Set → Array に戻してメッセージ化
		const events = Array.from(eventsSet);
		const body = events.length
			? events.map(e => `- ${e}`).join('\n')
			: '特になし';

		const aisatu = now.getHours() < 12 ? "おはようございます！" : now.getHours() < 18 ? "こんにちは！" : "こんばんは！";

		this.ai.post({
			text: serifs.today.msg({ aisatu, date: dateStr, youbi, info: body }),
		});
	}
}

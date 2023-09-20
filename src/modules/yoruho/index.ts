import autobind from 'autobind-decorator';
import Module from '@/module';
import * as loki from 'lokijs';

export default class extends Module {
	public readonly name = 'yoruho';

	@autobind
	public install() {
		this.schedulePost();
		return {};
	}

	@autobind
	private schedulePost() {
		// 以前の誤差を取得
		const previousErrorData = this.ai.moduleData.findOne({ type: 'yoruhoTime' });
		let previousError = previousErrorData ? previousErrorData.error : -50;  // データがない場合のデフォルト値
		if (previousError > 0) {
			this.log("Time Error (previousError > 0)");
			previousError = -50;
		}

		// 現在の日時を取得
		const now = new Date();

		// 現在の日時を基に、次の0:00:00の時刻を計算
		const targetTime = new Date(now);
		targetTime.setDate(targetTime.getDate() + (now.getHours() === 23 && now.getHours() === 59 ? 2 : 1));
		targetTime.setHours(0);
		targetTime.setMinutes(0);
		targetTime.setSeconds(0);
		targetTime.setMilliseconds(previousError); // 誤差を考慮

		this.log("targetTime : " + targetTime.toLocaleString('ja-JP') + "." + targetTime.getMilliseconds());

		// 次の0:00:00までの残り時間をミリ秒で計算
		const timeUntilPost = targetTime.getTime() - now.getTime();
		this.log("wait : " + timeUntilPost + " ms");
		if (timeUntilPost > 60000) {
			this.log("wait OK");
			// 残り時間が来たらpost()を呼び出す
			setTimeout(() => {
				this.post();
			}, timeUntilPost);
		} else {
			this.log("wait NG (<= 60000)");
			this.schedulePost();
		}
	}

	@autobind
	private post() {
		const res = this.ai.post({
			text: 'よるほー',
			localOnly: true,
		});
		this.log("yoruho");
		res.then((res) => {
			let newErrorInMilliseconds;
			if (res.createdAt) {
				this.log("yoruho result : " + new Date(res.createdAt).toLocaleString('ja-JP') + "." + new Date(res.createdAt).getMilliseconds());
				const postTime = new Date(res.createdAt).getTime();
				const targetTime = new Date();
				if (targetTime.getHours() > 12) {
					targetTime.setDate(targetTime.getDate() + 1);
				}
				targetTime.setHours(0);
				targetTime.setMinutes(0);
				targetTime.setSeconds(0);
				targetTime.setMilliseconds(0);
				newErrorInMilliseconds = targetTime.getTime() - postTime;

				this.log("error ms : " + (newErrorInMilliseconds * -1));

				const previousErrorData = this.ai.moduleData.findOne({ type: 'yoruhoTime' });
				const totalError = (previousErrorData?.error != null ? previousErrorData.error : -50) + Math.ceil(newErrorInMilliseconds / 2);

				this.log("next : " + totalError + " ms");

				if (previousErrorData) {
					previousErrorData.error = totalError;
					this.ai.moduleData.update(previousErrorData);
				} else {
					this.ai.moduleData.insert({ type: 'yoruhoTime', error: totalError });
				}

				this.schedulePost();
			}
		});
	}
}
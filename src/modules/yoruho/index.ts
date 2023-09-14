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
		const previousErrorData = this.ai.moduleData.findOne({ type: 'postTimeError' });
		const previousError = previousErrorData ? previousErrorData.error : -50;  // データがない場合のデフォルト値

		// 現在の日時を取得
		const now = new Date();

		// 現在の日時を基に、次の0:00:00の時刻を計算
		const targetTime = new Date(now);
		targetTime.setDate(targetTime.getDate() + 1);
		targetTime.setHours(0);
		targetTime.setMinutes(0);
		targetTime.setSeconds(0);
		targetTime.setMilliseconds(previousError); // 誤差を考慮

		// 次の0:00:00までの残り時間をミリ秒で計算
		const timeUntilPost = targetTime.getTime() - now.getTime();

		// 残り時間が来たらpost()を呼び出す
		setTimeout(() => {
			this.post();
			this.schedulePost(); // 再帰的にこの関数を再度呼び出すことで、次回の投稿をスケジュール
		}, timeUntilPost);
	}
	
	@autobind
	private post() {
		const res = this.ai.post({
			text: 'よるほー',
			localOnly: true,
		});
		let newErrorInMilliseconds;
		if (res.createdAt) {
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
	
			const previousErrorData = this.ai.moduleData.findOne({ type: 'postTimeError' });
			const totalError = (previousErrorData?.error != null ? previousErrorData.error : -50) + Math.ceil(newErrorInMilliseconds / 2);
			
			if (previousErrorData) {
				previousErrorData.error = totalError;
				this.ai.moduleData.update(previousErrorData);
			} else {
       			this.ai.moduleData.insert({ type: 'postTimeError', error: totalError });
			}
		}
	}
}
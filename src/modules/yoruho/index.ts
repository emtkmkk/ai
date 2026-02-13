/**
 * @packageDocumentation
 *
 * yoruho モジュール
 *
 * 毎日0時ちょうどに「夜報」を投稿するモジュール。
 * 実際の投稿時刻と0時00分00秒のずれを計測し、次回の待機時間を自動補正する。
 *
 * @remarks
 * タイミング制御は2段階:
 * 1. `preSchedulePost`: 23:57:00 まで待機（大まかな待機で setTimeout の誤差を軽減）
 * 2. `schedulePost`: 23:57:00 から 0:00:00 までの精密な待機（前回の誤差を反映）
 *
 * 特殊日の処理:
 * - 1月1日: 新年の挨拶
 * - 4月1日: エイプリルフールの投稿
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import * as loki from 'lokijs';
import serifs from '@/serifs';

export default class extends Module {
	public readonly name = 'yoruho';

	/**
	 * モジュールをインストールし、初回の投稿スケジュールを設定する
	 *
	 * @remarks
	 * 23:57以降なら直接 `schedulePost` を呼び、それ以前なら `preSchedulePost` で待機する。
	 *
	 * @returns 空のインストール結果（フックなし）
	 * @internal
	 */
	@autobind
	public install() {
		const now = new Date();
		if (now.getHours() === 23 && now.getMinutes() >= 57) {
			this.schedulePost();
		} else {
			this.preSchedulePost();
		}
		return {};
	}

	/**
	 * 23:57:00 まで待機してから `schedulePost` を呼び出す（粗い待機）
	 *
	 * @remarks
	 * setTimeout の精度限界を考慮し、0時の直前ではなく23:57に一度起き、
	 * そこから精密な `schedulePost` に引き継ぐ。
	 * 待機時間が1分以下の場合は再帰的に自身を呼び出す。
	 *
	 * @internal
	 */
	@autobind
	private preSchedulePost() {

		//waitの誤差を減らすために23:57:00にwaitを再設定する

		// 現在の日時を取得
		const now = new Date();

		// 現在の日時を基に、次の23:57:00の時刻を計算
		const targetTime = new Date(now);
		targetTime.setDate(targetTime.getDate() + (now.getHours() === 23 && now.getMinutes() >= 57 ? 1 : 0));
		targetTime.setHours(23);
		targetTime.setMinutes(57);
		targetTime.setSeconds(0);

		// 次の23:57:00までの残り時間をミリ秒で計算
		const timeUntilPost = targetTime.getTime() - now.getTime();
		this.log("prewait : " + timeUntilPost + " ms");
		if (timeUntilPost > 60000) {
			this.log("prewait OK");
			// 残り時間が来たらschedulePost()を呼び出す
			setTimeout(() => {
				this.schedulePost();
			}, timeUntilPost);
		} else {
			this.log("wait NG (<= 60000)");
			this.preSchedulePost();
		}
	}

	/**
	 * 0時00分00秒ちょうどに投稿するためのスケジューリング（精密な待機）
	 *
	 * @remarks
	 * DB に保存された前回の投稿誤差（ミリ秒）を考慮して待機時間を補正する。
	 * 前回の誤差が正（＝投稿が早すぎた）の場合はリセットして -50ms をデフォルトにする。
	 *
	 * @internal
	 */
	@autobind
	private schedulePost() {

		this.log("yoruho wait");

		// 以前の誤差を取得（データがない場合はデフォルト -50ms）
		const previousErrorData = this.ai.moduleData.findOne({ type: 'yoruhoTime' });
		let previousError = previousErrorData ? previousErrorData.error : -50;
		if (previousError > 0) {
			this.log("Time Error (previousError > 0)");
			previousError = -50;
		}

		// 現在の日時を取得
		const now = new Date();

		// 次の0:00:00の時刻を計算（誤差を考慮）
		const targetTime = new Date(now);
		targetTime.setDate(targetTime.getDate() + (now.getHours() === 23 && now.getMinutes() === 59 ? 2 : 1));
		targetTime.setHours(0);
		targetTime.setMinutes(0);
		targetTime.setSeconds(0);
		targetTime.setMilliseconds(previousError); // 誤差を考慮

		this.log("targetTime : " + targetTime.toLocaleString('ja-JP') + "." + targetTime.getMilliseconds());

		// 次の0:00:00までの残り時間をミリ秒で計算
		const timeUntilPost = targetTime.getTime() - now.getTime();
		this.log("wait : " + timeUntilPost + " ms");
		// 残り時間が来たらpost()を呼び出す
		setTimeout(() => {
			this.post();
		}, timeUntilPost);
	}

	/**
	 * 夜報を投稿し、投稿時刻の誤差を計測して次回に反映する
	 *
	 * @remarks
	 * 投稿後、Misskey サーバーが返す `createdAt` と実際の0:00:00の差分を計算し、
	 * 前回の誤差と平均して DB に保存する。誤差が ±1秒を超える場合はリセットする。
	 *
	 * 特殊日:
	 * - 1月1日: `serifs.yoruho.newYear` を使用
	 * - 4月1日: `serifs.yoruho.aprilFool` を使用
	 *
	 * @internal
	 */
	@autobind
	private post() {
		const dt = new Date();
		dt.setMinutes(dt.getMinutes() + 60);
		let text = serifs.yoruho.yoruho(dt);
		// 特殊日の投稿内容
		if (dt.getMonth() === 0 && dt.getDate() === 1) {
			text = serifs.yoruho.newYear(dt.getFullYear());
		}
		if (dt.getMonth() === 3 && dt.getDate() === 1) {
			text = serifs.yoruho.aprilFool(dt);
		}
		const res = this.ai.post({
			text,
			localOnly: true,
		});
		this.log("yoruho : " + new Date().toLocaleString('ja-JP') + "." + new Date().getMilliseconds());
		res.then((res) => {
			let newErrorInMilliseconds;
			if (res.createdAt) {
				this.log("yoruho result : " + new Date(res.createdAt).toLocaleString('ja-JP') + "." + new Date(res.createdAt).getMilliseconds());
				const postTime = new Date(res.createdAt).getTime();
				// 0:00:00 の基準時刻を計算
				const targetTime = new Date();
				if (targetTime.getHours() > 12) {
					targetTime.setDate(targetTime.getDate() + 1);
				}
				targetTime.setHours(0);
				targetTime.setMinutes(0);
				targetTime.setSeconds(0);
				targetTime.setMilliseconds(0);
				// 誤差 = 基準時刻 - 実際の投稿時刻
				newErrorInMilliseconds = targetTime.getTime() - postTime;

				this.log("error ms : " + (newErrorInMilliseconds * -1));

				// 誤差が ±1秒を超える場合はリセット
				if (newErrorInMilliseconds > 1000) newErrorInMilliseconds = 0;
				if (newErrorInMilliseconds < -1000) newErrorInMilliseconds = 0;

				// 前回の誤差と今回の誤差を平均して次回に反映
				const previousErrorData = this.ai.moduleData.findOne({ type: 'yoruhoTime' });
				const totalError = (previousErrorData?.error != null ? previousErrorData.error : -50) + Math.ceil(newErrorInMilliseconds / 2);

				this.log("next : " + totalError + " ms");

				if (previousErrorData) {
					previousErrorData.error = totalError;
					this.ai.moduleData.update(previousErrorData);
				} else {
					this.ai.moduleData.insert({ type: 'yoruhoTime', error: totalError });
				}

			}
			this.ai.decActiveFactor(0.015);
			// 次の日のスケジュールを設定
			this.preSchedulePost();
		});
	}
}

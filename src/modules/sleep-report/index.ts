/**
 * @packageDocumentation
 *
 * sleep-report モジュール
 *
 * ボット起動時に、前回のシャットダウンからの経過時間を「睡眠時間」として投稿する。
 * 1時間以上なら時間単位、6分以上1時間未満なら分単位（うたた寝）で報告。
 * 6分未満の場合は投稿しない。
 *
 * @remarks
 * フックは一切登録しない。`install()` 内で1回だけ `report()` を呼ぶ。
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';

export default class extends Module {
	public readonly name = 'sleepReport';

	/**
	 * モジュールをインストールし、起動時の睡眠報告を実行する
	 *
	 * @returns 空のインストール結果（フックなし）
	 * @internal
	 */
	@autobind
	public install() {
		this.report();

		return {};
	}

	/**
	 * 前回シャットダウンからの経過時間を睡眠時間として投稿する
	 *
	 * @remarks
	 * `this.ai.lastSleepedAt` を基準に経過時間を計算する。
	 * 0.1時間（6分）未満の場合は短すぎるため投稿しない。
	 *
	 * @internal
	 */
	@autobind
	private report() {
		const now = Date.now();

		const sleepTime = now - this.ai.lastSleepedAt;

		const sleepHours = sleepTime / 1000 / 60 / 60;

		// 6分未満の停止は報告しない
		if (sleepHours < 0.1) return;

		const sleepMinutes = sleepHours * 60;

		if (sleepHours >= 1) {
			this.ai.post({
				text: serifs.sleepReport.report(Math.round(sleepHours))
			});
		} else {
			this.ai.post({
				text: serifs.sleepReport.reportUtatane(Math.round(sleepMinutes))
			});
		}
	}
}

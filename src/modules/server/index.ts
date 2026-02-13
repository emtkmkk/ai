/**
 * @packageDocumentation
 *
 * server モジュール
 *
 * Misskey の `serverStats` ストリームを購読し、CPU・メモリ使用率を監視する。
 * 平均使用率が閾値を超えた場合、管理者にDMで警告を送信する。
 *
 * @remarks
 * - `config.serverMonitoring` が有効な場合のみ動作
 * - 1秒ごとにログを蓄積し（最大30件 = 0.5分間）、3秒ごとに平均をチェック
 * - 連続警告を防ぐため、一度負荷が下がるまで再警告しない
 * - 前回警告から1時間以内は再警告しない
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import config from '@/config';

export default class extends Module {
	public readonly name = 'server';

	/** WebSocket 接続（serverStats チャンネル） */
	private connection?: any;

	/** 最新のサーバー統計情報 */
	private recentStat: any;

	/** 警告済みフラグ（負荷が下がるまで再警告しない） */
	private warned = false;

	/** 前回警告した時刻（ミリ秒） */
	private lastWarnedAt: number;

	/**
	 * 1秒毎のログ0.5分間分
	 */
	private statsLogs: any[] = [];

	/**
	 * モジュールをインストールし、サーバー監視を開始する
	 *
	 * @remarks
	 * `config.serverMonitoring` が未設定の場合は何も行わない。
	 *
	 * @returns 空のインストール結果（フックなし）
	 * @internal
	 */
	@autobind
	public install() {
		if (!config.serverMonitoring) return {};

		this.connection = this.ai.connection.useSharedConnection('serverStats');
		this.connection.on('stats', this.onStats);

		// 1秒ごとに最新の統計をログに追加（最大30件保持）
		setInterval(() => {
			this.statsLogs.unshift(this.recentStat);
			if (this.statsLogs.length > 30) this.statsLogs.pop();
		}, 1000);

		// 3秒ごとに負荷を確認
		setInterval(() => {
			this.check();
		}, 3000);

		return {};
	}

	/**
	 * CPU・メモリの平均使用率をチェックし、閾値超えで警告を発火する
	 *
	 * @remarks
	 * - CPU 90%以上 or メモリ 92%以上 → 警告
	 * - CPU 30%以下 かつ メモリ 60%以下 → 警告状態を解除
	 *
	 * @internal
	 */
	@autobind
	private check() {
		const average = (arr) => arr.reduce((a, b) => a + b) / arr.length;

		const cpuPercentages = this.statsLogs.map(s => s && (s.cpu_usage || s.cpu) * 100 || 0);
		const memoryPercentages = this.statsLogs.map(s => s && (s.mem.active / s.mem.total) * 100 || 0);
		const cpuPercentage = average(cpuPercentages);
		const memoryPercentage = average(memoryPercentages);
		if (cpuPercentage >= 90) {
			this.warn();
		} else if (memoryPercentage >= 92) {
			this.warn();
		} else if (cpuPercentage <= 30 && memoryPercentage <= 60) {
			// 負荷が十分に下がったら警告状態を解除
			this.warned = false;
		}
	}

	/**
	 * サーバー統計情報を受信し、最新値として保持する
	 *
	 * @param stats - serverStats ストリームから受信した統計データ
	 * @internal
	 */
	@autobind
	private async onStats(stats: any) {
		this.recentStat = stats;
	}

	/**
	 * 管理者にサーバー高負荷警告をDMで送信する
	 *
	 * @remarks
	 * 以下の条件で警告をスキップする:
	 * - 前回警告から負荷が下がっていない（`warned` が true）
	 * - 前回警告から1時間経過していない
	 *
	 * @internal
	 */
	@autobind
	private warn() {
		//#region 前に警告したときから一旦落ち着いた状態を経験していなければ警告しない
		// 常に負荷が高いようなサーバーで無限に警告し続けるのを防ぐため
		if (this.warned) return;
		//#endregion

		//#region 前の警告から1時間経っていない場合は警告しない
		const now = Date.now();

		if (this.lastWarnedAt != null) {
			if (now - this.lastWarnedAt < (1000 * 60 * 60)) return;
		}

		this.lastWarnedAt = now;
		//#endregion

		this.warned = true;

		this.ai.post({
			text: serifs.server.cpu,
			visibility: "specified",
			// NOTE: 管理者のユーザーIDにDMで通知する
			visibleUserIds: ["9d5ts6in38"],
		});
	}
}

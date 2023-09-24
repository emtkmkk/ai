import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import config from '@/config';

export default class extends Module {
	public readonly name = 'server';

	private connection?: any;
	private recentStat: any;
	private warned = false;
	private lastWarnedAt: number;

	/**
	 * 1秒毎のログ0.5分間分
	 */
	private statsLogs: any[] = [];

	@autobind
	public install() {
		if (!config.serverMonitoring) return {};

		this.connection = this.ai.connection.useSharedConnection('serverStats');
		this.connection.on('stats', this.onStats);

		setInterval(() => {
			this.statsLogs.unshift(this.recentStat);
			if (this.statsLogs.length > 30) this.statsLogs.pop();
		}, 1000);

		setInterval(() => {
			this.check();
		}, 3000);

		return {};
	}

	@autobind
	private check() {
		const average = (arr) => arr.reduce((a, b) => a + b) / arr.length;

		const cpuPercentages = this.statsLogs.map(s => s && (s.cpu_usage || s.cpu) * 100 || 0);
		const memoryPercentages = this.statsLogs.map(s => s && (s.mem.active / s.mem.total) * 100 || 0);
		const cpuPercentage = average(cpuPercentages);
		const memoryPercentage = average(memoryPercentages);
		if (cpuPercentage >= 85) {
			this.warn();
		} else if (memoryPercentage >= 87) {
			this.warn();
		} else if (cpuPercentage <= 30 && memoryPercentage <= 70) {
			this.warned = false;
		}
	}

	@autobind
	private async onStats(stats: any) {
		this.recentStat = stats;
	}

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

		this.ai.post({
			text: serifs.server.cpu,
			localOnly: true,
		});

		this.warned = true;
	}
}

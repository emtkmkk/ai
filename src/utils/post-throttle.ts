/**
 * タイムライン投稿の連投を抑制するキュー
 *
 * @remarks
 * 一度投稿した後は、次のいずれかを満たすまで後続の投稿をキューで保留する。
 * - 前回の投稿から `maxWaitMs`（既定 1分）が経過した
 * - 前回の投稿後に他ユーザーの投稿を観測してから `afterOtherNoteMs`（既定 3秒）が経過した
 *
 * 投稿は FIFO で 1 件ずつ処理され、投稿するたびに再び待機状態に戻る。
 *
 * @internal
 */
export class PostThrottle {
	private queue: { run: () => Promise<unknown>; resolve: (value: any) => void; reject: (error: unknown) => void }[] = [];
	/** 直近の投稿時刻（未投稿なら null） */
	private lastPostAt: number | null = null;
	/** 直近の投稿後に最初に観測した他ユーザー投稿の時刻 */
	private otherNoteAt: number | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private processing = false;

	constructor(
		private readonly maxWaitMs = 60 * 1000,
		private readonly afterOtherNoteMs = 3 * 1000,
		private readonly now: () => number = () => Date.now(),
	) {}

	/** 投稿処理をキューに積み、実行結果を返す */
	public enqueue<T>(run: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push({ run, resolve, reject });
			this.schedule();
		});
	}

	/** HTL/LTL で他ユーザーの投稿を観測したときに呼ぶ */
	public notifyOtherNote() {
		if (this.lastPostAt == null || this.otherNoteAt != null) return;
		this.otherNoteAt = this.now();
		this.schedule();
	}

	public get pendingCount() {
		return this.queue.length;
	}

	/** 次に投稿してよい時刻 */
	private releaseAt(): number {
		if (this.lastPostAt == null) return -Infinity;
		const byTimeout = this.lastPostAt + this.maxWaitMs;
		const byOther = this.otherNoteAt != null ? this.otherNoteAt + this.afterOtherNoteMs : Infinity;
		return Math.min(byTimeout, byOther);
	}

	private schedule() {
		if (this.processing || this.queue.length === 0) return;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		const wait = this.releaseAt() - this.now();
		if (wait <= 0) {
			void this.flush();
			return;
		}
		this.timer = setTimeout(() => {
			this.timer = null;
			this.schedule();
		}, wait);
	}

	private async flush() {
		const item = this.queue.shift();
		if (!item) return;
		this.processing = true;
		this.lastPostAt = this.now();
		this.otherNoteAt = null;
		try {
			item.resolve(await item.run());
		} catch (error) {
			item.reject(error);
		} finally {
			// 投稿完了時点から待機を開始する（その間に流れた他ユーザー投稿は無視する）
			this.lastPostAt = this.now();
			this.otherNoteAt = null;
			this.processing = false;
			this.schedule();
		}
	}
}

/**
 * @packageDocumentation
 *
 * 戦闘ログ（返信の本文）を組み立てる
 *
 * @remarks
 * 戦闘ログでは、スキルなどの効果（バフ）の行が 1 行でも出たら、まとまりの最後に空行を入れる。
 * そのために「バフの行を何行出したか」を数えておく必要があり、以前は各所で `buff += 1` と
 * `if (buff > 0) message += "\n"` を手で書いていた。このクラスはその数え方をまとめる。
 *
 * - {@link BattleLog.add}: そのまま足す（バフの行として数えない）
 * - {@link BattleLog.buff}: バフの行として足す
 * - {@link BattleLog.verbose}: 詳細ログ（-v）のときだけ、バフの行として足す（文字列は関数で渡し、詳細ログのときだけ作る）
 * - {@link BattleLog.endBuffs}: バフの行が 1 行でもあれば空行を入れる
 * - {@link BattleLog.scope}: 同じ本文に書くが、バフの行を別に数えるログ（ターンごとなど）
 *
 * 渡す文字列は、改行も含めてそのまま足す（行末の `\n` は呼び出し側で付ける）。
 *
 * @internal
 */
export class BattleLog {
	/** 本文（scope で作ったログと共有する） */
	private readonly body: { text: string };
	/** このログで出したバフの行の数 */
	private buffCount = 0;

	/**
	 * @param verboseEnabled 詳細ログ（-v）を出すか
	 * @param body 本文（scope 用。通常は省略）
	 */
	constructor(public readonly verboseEnabled: boolean, body?: { text: string }) {
		this.body = body ?? { text: "" };
	}

	/** これまでに組み立てた本文 */
	get text(): string {
		return this.body.text;
	}

	/** そのまま足す（バフの行として数えない） */
	add(text: string): void {
		this.body.text += text;
	}

	/** バフの行として足す */
	buff(text: string): void {
		this.buffCount += 1;
		this.body.text += text;
	}

	/**
	 * 詳細ログ（-v）のときだけ、バフの行として足す
	 *
	 * @param text 足す文字列を作る関数（詳細ログのときだけ呼ぶので、計算の手間や副作用は詳細ログのときだけ起きる）
	 */
	verbose(text: () => string): void {
		if (this.verboseEnabled) this.buff(text());
	}

	/** 本文は足さずに、バフの行を出したことにする（あとで足す行をまとめて数えたい場合） */
	markBuff(): void {
		this.buffCount += 1;
	}

	/** バフの行が 1 行でもあれば、空行を入れる（数はそのまま） */
	endBuffs(): void {
		if (this.buffCount > 0) this.body.text += "\n";
	}

	/** バフの行の数を 0 に戻す */
	resetBuffs(): void {
		this.buffCount = 0;
	}

	/** 同じ本文に書くが、バフの行を別に数えるログを作る */
	scope(): BattleLog {
		return new BattleLog(this.verboseEnabled, this.body);
	}
}

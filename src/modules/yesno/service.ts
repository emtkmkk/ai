/**
 * @packageDocumentation
 *
 * はい/いいえ回答サービス。
 *
 * @remarks
 * 「〜ですか？」といった質問に対して、次の優先順で回答を決める。
 *
 * 1. メモリー（過去に Claude が出した判定）
 * 2. Claude API（{@link YesNoClient}）
 * 3. 質問テキストをシードにした乱数（Claude が使えないときの従来どおりの動き）
 *
 * Claude の応答は {@link parseJudgement} で規格どおりか検証し、
 * 固定の5択に変換してからしか使わない。生のテキストが返信に流れることはない。
 * 規格外の応答や通信失敗は1回だけ再問い合わせし、それでも駄目なら乱数に落とす。
 * Claude が「答えは不定」と明確に判定した場合は返信せず、リアクションだけにする。
 *
 * dice モジュール（語尾一致）と yesno モジュール（他モジュール非反応時のフォールバック）の
 * 両方からこのサービスを使う。
 *
 * @internal
 */
import * as seedrandom from 'seedrandom';

/** 返信に使う4択の回答 */
export type YesNoAnswer = 'yes' | 'maybe_yes' | 'maybe_no' | 'no';

/**
 * Claude が返す回答。4択に「不定」を加えたもの
 *
 * @remarks
 * `undetermined` は「分からない」ではなく、答えが一つに定まらないことを明確に示す特別な返答。
 * 返信はせず、専用のリアクションで応える。
 */
export type ClaudeAnswer = YesNoAnswer | 'undetermined';

/** 返信可能な回答の一覧 */
export const YESNO_ANSWERS: readonly YesNoAnswer[] = ['yes', 'maybe_yes', 'maybe_no', 'no'];

/** Claude の回答として受け付ける値の一覧 */
export const CLAUDE_ANSWERS: readonly ClaudeAnswer[] = [...YESNO_ANSWERS, 'undetermined'];

/** 回答から返信文言への変換表（従来の文言をそのまま使う） */
export const ANSWER_TEXT: Readonly<Record<YesNoAnswer, string>> = {
	yes: 'はい',
	maybe_yes: '多分はい、部分的にはい',
	maybe_no: '多分いいえ、部分的にいいえ',
	no: 'いいえ',
};

/** Claude の判定結果（検証済み） */
export type YesNoJudgement = {
	/** はい/いいえで意味のある返答ができる質問か */
	isYesNoQuestion: boolean;
	/** 回答。質問でない場合は `undetermined` */
	answer: ClaudeAnswer;
};

/** メモリーに保存する判定 */
export type StoredJudgement = YesNoJudgement & {
	/** 保存日時（epoch ms） */
	createdAt: number;
};

/** 回答の出どころ */
export type YesNoSource = 'memory' | 'claude' | 'random';

/** 答えが不定と明確に判定されたときに付けるリアクション */
export const UNDETERMINED_REACTION = ':thinking_mkchicken:';

/**
 * サービスの回答結果
 *
 * @remarks
 * - `answer`: 4択のいずれかで返信する
 * - `undetermined`: Claude が「はい/いいえで答えられる質問だが答えは不定」と明確に判定した。
 *   返信はせず {@link UNDETERMINED_REACTION} をリアクションする
 */
export type YesNoResult =
	| {
		kind: 'answer';
		answer: YesNoAnswer;
		/** 返信にそのまま使える文言 */
		text: string;
		source: YesNoSource;
	}
	| {
		kind: 'undetermined';
		source: 'memory' | 'claude';
	};

/**
 * Claude への問い合わせ口
 *
 * @remarks
 * 戻り値は未検証の値（パース済み JSON 等）。検証はサービス側で行う。
 * 通信失敗などは例外を投げてよい。
 */
export interface YesNoClient {
	judge(question: string): Promise<unknown>;
}

/** 判定の保存先 */
export interface YesNoMemory {
	get(key: string): StoredJudgement | null;
	set(key: string, value: StoredJudgement): void;
}

/** Claude 呼び出し回数の制限 */
export interface YesNoUsage {
	/**
	 * 1回分の呼び出し枚数を消費する
	 * @param date - 今日の日付（`YYYY-MM-DD` など日単位で変わる文字列）
	 * @returns 消費できたら `true`、上限に達していれば `false`
	 */
	tryConsume(date: string): boolean;
}

/**
 * 質問テキストをメモリーのキーに正規化する
 *
 * @remarks
 * 前後の空白を落とし、連続する空白を1つにまとめるだけに留める。
 * 表記揺れまで吸収しようとすると別の質問を同一視する恐れがあるため。
 */
export function normalizeQuestion(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * 疑問文らしいかを判定する（Claude を呼ぶ前の安価なフィルタ）
 *
 * @remarks
 * 疑問符を含むか、いずれかの行が「か」「かな」「かしら」「よね」「だろう」「でしょう」などで終わる場合に `true`。
 */
export function looksLikeQuestion(text: string): boolean {
	const trimmed = text.trim();
	// NOTE: 数取りゲームへの参加表明「さんか」「参加」は「か」で終わるが質問ではない。
	//       本番の bot 宛て投稿の1割以上がこれで、除外しないと無駄な問い合わせになる
	if (/^(さんか|参加)[!！。．.]*$/.test(trimmed)) return false;
	if (/[?？]/.test(trimmed)) return true;
	return /(か|かな|かしら|かい|よね|だろう|でしょう|でしょ|のかな)[。．.!！…〜~]*[ \t]*$/m.test(trimmed);
}

/**
 * 質問テキストをシードにした乱数で回答を決める（従来の動き）
 *
 * @remarks
 * シードと閾値は従来の dice モジュールと同じにしてあり、
 * 同じ質問には以前と同じ回答が返る。
 */
export function seededAnswer(question: string): YesNoAnswer {
	const rng = seedrandom(question.trim() + ':q');
	const v = rng();
	if (v < 0.5) {
		return v < 0.25 ? 'maybe_yes' : 'yes';
	}
	return v > 0.75 ? 'maybe_no' : 'no';
}

/**
 * Claude の応答を検証して {@link YesNoJudgement} に変換する
 *
 * @returns 規格どおりなら判定、そうでなければ `null`
 */
export function parseJudgement(raw: unknown): YesNoJudgement | null {
	let value: unknown = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return null;
		}
	}
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
	const obj = value as Record<string, unknown>;
	const isYesNoQuestion = obj.isYesNoQuestion;
	const answer = obj.answer;
	if (typeof isYesNoQuestion !== 'boolean') return null;
	if (typeof answer !== 'string' || !(CLAUDE_ANSWERS as readonly string[]).includes(answer)) return null;
	return {
		isYesNoQuestion,
		// NOTE: 質問でないのに回答が付いていても、回答は使わない
		answer: isYesNoQuestion ? (answer as ClaudeAnswer) : 'undetermined',
	};
}

/**
 * 規格外の応答をログ用の文字列にする（デバッグ用）
 *
 * @remarks
 * 型と中身を出す。長すぎる場合は先頭 500 文字で切る。
 */
export function describeRaw(raw: unknown, maxLength = 500): string {
	let body: string;
	if (raw === undefined) body = 'undefined';
	else if (typeof raw === 'string') body = raw;
	else {
		try {
			body = JSON.stringify(raw) ?? String(raw);
		} catch {
			body = String(raw);
		}
	}
	const type = raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw;
	const trimmed = body.length > maxLength ? `${body.slice(0, maxLength)}…(${body.length}文字)` : body;
	return `[${type}] ${trimmed}`;
}

/** 今日の日付を `YYYY-MM-DD`（ローカル時刻）で返す */
export function todayKey(now: Date = new Date()): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** サービスの依存 */
export type YesNoServiceDeps = {
	/** Claude への問い合わせ口。`null` なら Claude を使わない */
	client: YesNoClient | null;
	memory: YesNoMemory;
	usage: YesNoUsage;
	log?: (message: string) => void;
	now?: () => Date;
};

/**
 * はい/いいえ回答サービス本体
 */
export class YesNoService {
	constructor(private readonly deps: YesNoServiceDeps) {}

	/**
	 * 語尾条件を満たした質問に回答する（必ず回答を返す）
	 *
	 * @remarks
	 * Claude が使えない・応答が得られない場合は乱数で決める。
	 * Claude が答えは不定と明確に判定した場合は `undetermined` を返す。
	 */
	public async answer(question: string): Promise<YesNoResult> {
		const result = await this.resolve(question, true);
		// NOTE: matchedPattern=true のときは resolve が必ず結果を返す
		return result ?? this.random(question);
	}

	/**
	 * 語尾条件を満たさないメンションについて、はい/いいえで答えられる質問なら回答する
	 *
	 * @returns 質問でない、または判定できない場合は `null`（返信しない）
	 */
	public async answerIfQuestion(text: string): Promise<YesNoResult | null> {
		return this.resolve(text, false);
	}

	/**
	 * 回答の決定処理
	 *
	 * @param question - 質問テキスト
	 * @param matchedPattern - 語尾条件に一致したか。`true` なら必ず回答を返す
	 */
	private async resolve(question: string, matchedPattern: boolean): Promise<YesNoResult | null> {
		const fallback = () => matchedPattern ? this.random(question) : null;

		if (!matchedPattern && !looksLikeQuestion(question)) return null;

		const key = normalizeQuestion(question);
		if (key === '') return fallback();

		const stored = this.deps.memory.get(key);
		if (stored != null) {
			return this.fromJudgement(stored, matchedPattern, 'memory');
		}

		if (this.deps.client == null) return fallback();

		if (!this.deps.usage.tryConsume(todayKey(this.deps.now?.()))) {
			this.log('Claude の1日あたりの呼び出し上限に達したため乱数で回答します');
			return fallback();
		}

		const judgement = await this.judgeWithRetry(question);
		if (judgement == null) return fallback();

		this.deps.memory.set(key, { ...judgement, createdAt: (this.deps.now?.() ?? new Date()).getTime() });
		return this.fromJudgement(judgement, matchedPattern, 'claude');
	}

	/**
	 * 判定から結果を組み立てる
	 *
	 * @remarks
	 * 語尾条件に一致した質問は、Claude が「質問でない」と判定しても不定として扱う。
	 */
	private fromJudgement(judgement: YesNoJudgement, matchedPattern: boolean, source: 'memory' | 'claude'): YesNoResult | null {
		if (!matchedPattern && !judgement.isYesNoQuestion) return null;
		if (judgement.answer === 'undetermined') return { kind: 'undetermined', source };
		return {
			kind: 'answer',
			answer: judgement.answer,
			text: ANSWER_TEXT[judgement.answer],
			source,
		};
	}

	/**
	 * Claude に問い合わせ、規格外・失敗なら1回だけ再試行する
	 *
	 * @returns 2回とも駄目なら `null`
	 */
	private async judgeWithRetry(question: string): Promise<YesNoJudgement | null> {
		const client = this.deps.client;
		if (client == null) return null;
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				const raw = await client.judge(question);
				const judgement = parseJudgement(raw);
				if (judgement != null) return judgement;
				this.log(`Claude の応答が規格外でした (${attempt}回目): ${describeRaw(raw)}`);
			} catch (e) {
				this.log(`Claude への問い合わせに失敗しました (${attempt}回目): ${e instanceof Error ? e.message : String(e)}`);
			}
		}
		return null;
	}

	private random(question: string): YesNoResult {
		const answer = seededAnswer(question);
		return { kind: 'answer', answer, text: ANSWER_TEXT[answer], source: 'random' };
	}

	private log(message: string) {
		this.deps.log?.(message);
	}
}

/**
 * LokiJS コレクションを使った {@link YesNoMemory}
 *
 * @param collection - `key` にユニークインデックスを持つコレクション
 * @param maxEntries - 保存件数の上限。超えた分は古いものから消す
 */
export function createLokiMemory(collection: {
	findOne(query: any): any;
	insert(doc: any): any;
	update(doc: any): any;
	remove(doc: any): any;
	chain(): { simplesort(prop: string): { limit(n: number): { data(): any[] } } };
	count(): number;
}, maxEntries = 10000): YesNoMemory {
	return {
		get(key) {
			const doc = collection.findOne({ key });
			if (doc == null) return null;
			const judgement = parseJudgement({ isYesNoQuestion: doc.isYesNoQuestion, answer: doc.answer });
			if (judgement == null) return null;
			return { ...judgement, createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : 0 };
		},
		set(key, value) {
			const existing = collection.findOne({ key });
			if (existing != null) {
				existing.isYesNoQuestion = value.isYesNoQuestion;
				existing.answer = value.answer;
				existing.createdAt = value.createdAt;
				collection.update(existing);
				return;
			}
			collection.insert({ key, isYesNoQuestion: value.isYesNoQuestion, answer: value.answer, createdAt: value.createdAt });
			const over = collection.count() - maxEntries;
			if (over > 0) {
				for (const old of collection.chain().simplesort('createdAt').limit(over).data()) {
					collection.remove(old);
				}
			}
		},
	};
}

/**
 * LokiJS コレクションを使った {@link YesNoUsage}
 *
 * @param collection - 利用状況を1ドキュメントで保持するコレクション
 * @param dailyLimit - 1日あたりの上限。0 以下なら無制限
 */
export function createLokiUsage(collection: {
	findOne(query: any): any;
	insert(doc: any): any;
	update(doc: any): any;
}, dailyLimit: number): YesNoUsage {
	return {
		tryConsume(date) {
			if (dailyLimit <= 0) return true;
			let doc = collection.findOne({ type: 'usage' });
			if (doc == null) {
				doc = collection.insert({ type: 'usage', date, count: 0 });
			}
			if (doc.date !== date) {
				doc.date = date;
				doc.count = 0;
			}
			if (doc.count >= dailyLimit) {
				collection.update(doc);
				return false;
			}
			doc.count += 1;
			collection.update(doc);
			return true;
		},
	};
}

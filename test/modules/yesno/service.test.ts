import * as loki from 'lokijs';
import {
	YesNoService,
	YesNoClient,
	YesNoMemory,
	YesNoUsage,
	StoredJudgement,
	ANSWER_TEXT,
	seededAnswer,
	parseJudgement,
	looksLikeQuestion,
	normalizeQuestion,
	createLokiMemory,
	createLokiUsage,
} from '@/modules/yesno/service';
import { replyVisibilityFor } from '@/modules/yesno';
import { buildSystemPrompt } from '@/modules/yesno/claude-client';

class FakeClient implements YesNoClient {
	public calls: string[] = [];
	constructor(private responses: Array<unknown | Error>) {}
	async judge(question: string): Promise<unknown> {
		this.calls.push(question);
		const next = this.responses.shift();
		if (next instanceof Error) throw next;
		return next;
	}
}

class MapMemory implements YesNoMemory {
	public map = new Map<string, StoredJudgement>();
	get(key: string) { return this.map.get(key) ?? null; }
	set(key: string, value: StoredJudgement) { this.map.set(key, value); }
}

const unlimited: YesNoUsage = { tryConsume: () => true };
const exhausted: YesNoUsage = { tryConsume: () => false };

const build = (client: YesNoClient | null, memory = new MapMemory(), usage = unlimited) =>
	new YesNoService({ client, memory, usage, now: () => new Date('2026-10-17T12:00:00') });

describe('seededAnswer', () => {
	test('同じ質問には同じ回答を返し、4択のいずれかになる', () => {
		const a = seededAnswer('これはテストですか？');
		expect(a).toBe(seededAnswer('これはテストですか？'));
		expect(Object.keys(ANSWER_TEXT)).toContain(a);
	});

	test('前後の空白は無視される（従来の dice と同じ）', () => {
		expect(seededAnswer('  りんごは赤いですか？ ')).toBe(seededAnswer('りんごは赤いですか？'));
	});
});

describe('parseJudgement', () => {
	test('規格どおりの応答を受け付ける', () => {
		expect(parseJudgement({ isYesNoQuestion: true, answer: 'yes' })).toEqual({ isYesNoQuestion: true, answer: 'yes' });
		expect(parseJudgement('{"isYesNoQuestion":true,"answer":"maybe_no"}')).toEqual({ isYesNoQuestion: true, answer: 'maybe_no' });
	});

	test('質問でない場合は回答を undetermined に丸める', () => {
		expect(parseJudgement({ isYesNoQuestion: false, answer: 'yes' })).toEqual({ isYesNoQuestion: false, answer: 'undetermined' });
	});

	test('規格外の応答は null', () => {
		expect(parseJudgement(null)).toBeNull();
		expect(parseJudgement('はい')).toBeNull();
		expect(parseJudgement({ isYesNoQuestion: 'true', answer: 'yes' })).toBeNull();
		expect(parseJudgement({ isYesNoQuestion: true, answer: 'YES' })).toBeNull();
		expect(parseJudgement({ isYesNoQuestion: true })).toBeNull();
		expect(parseJudgement([{ isYesNoQuestion: true, answer: 'yes' }])).toBeNull();
	});
});

describe('looksLikeQuestion', () => {
	test.each([
		'もこチキは鳥？',
		'もこチキは鳥?',
		'今日は晴れるか',
		'これって美味しいかな',
		'それでいいよね',
		'明日は休みでしょう',
		'一行目\n二行目は質問ですか',
	])('疑問文らしい: %s', text => {
		expect(looksLikeQuestion(text)).toBe(true);
	});

	test.each([
		'おはよう',
		'占い',
		'今日もいい天気ですね',
		'ありがとう！',
		'さんか',
		'参加！',
		' さんか。 ',
	])('疑問文らしくない: %s', text => {
		expect(looksLikeQuestion(text)).toBe(false);
	});
});

describe('normalizeQuestion', () => {
	test('前後の空白と連続空白だけを揃える', () => {
		expect(normalizeQuestion('  りんごは　 赤い\n ですか？ ')).toBe('りんごは 赤い ですか？');
	});
});

describe('YesNoService#answer（語尾一致）', () => {
	test('Claude の判定を固定文言に変換して返し、メモリーに保存する', async () => {
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'maybe_yes' }]);
		const memory = new MapMemory();
		const service = build(client, memory);

		const result = await service.answer('りんごは赤いですか？');
		expect(result).toEqual({ kind: 'answer', answer: 'maybe_yes', text: '多分はい、部分的にはい', source: 'claude' });
		expect(memory.map.get('りんごは赤いですか？')).toMatchObject({ isYesNoQuestion: true, answer: 'maybe_yes' });
	});

	test('2回目はメモリーから返し、Claude を呼ばない', async () => {
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'no' }]);
		const service = build(client);

		await service.answer('空は緑ですか？');
		const second = await service.answer(' 空は緑ですか？ ');
		expect(second).toEqual({ kind: 'answer', answer: 'no', text: 'いいえ', source: 'memory' });
		expect(client.calls).toHaveLength(1);
	});

	test('規格外の応答は1回だけ再試行する', async () => {
		const client = new FakeClient(['はい！', { isYesNoQuestion: true, answer: 'yes' }]);
		const result = await build(client).answer('水は液体ですか？');
		expect(result).toEqual({ kind: 'answer', answer: 'yes', text: 'はい', source: 'claude' });
		expect(client.calls).toHaveLength(2);
	});

	test('通信失敗も1回だけ再試行する', async () => {
		const client = new FakeClient([new Error('timeout'), { isYesNoQuestion: true, answer: 'maybe_no' }]);
		const result = await build(client).answer('火は冷たいですか？');
		expect(result).toMatchObject({ kind: 'answer', answer: 'maybe_no' });
		expect(client.calls).toHaveLength(2);
	});

	test('2回とも駄目なら乱数に落とし、メモリーには保存しない', async () => {
		const q = '猫は犬ですか？';
		const client = new FakeClient(['???', new Error('500')]);
		const memory = new MapMemory();
		const result = await build(client, memory).answer(q);
		expect(result).toEqual({ kind: 'answer', answer: seededAnswer(q), text: ANSWER_TEXT[seededAnswer(q)], source: 'random' });
		expect(client.calls).toHaveLength(2);
		expect(memory.map.size).toBe(0);
	});

	test('undetermined は不定として返し（返信しない）、判定はメモリーに保存して次回は Claude を呼ばない', async () => {
		const q = '明日は雨ですか？';
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'undetermined' }]);
		const service = build(client);
		const first = await service.answer(q);
		const second = await service.answer(q);
		expect(first).toEqual({ kind: 'undetermined', source: 'claude' });
		expect(second).toEqual({ kind: 'undetermined', source: 'memory' });
		expect(client.calls).toHaveLength(1);
	});

	test('Claude が質問でないと判定した語尾一致の質問は不定として扱う', async () => {
		const q = 'おはようございますか？';
		const client = new FakeClient([{ isYesNoQuestion: false, answer: 'undetermined' }]);
		const result = await build(client).answer(q);
		expect(result).toEqual({ kind: 'undetermined', source: 'claude' });
	});

	test('Claude が無ければ乱数で答える', async () => {
		const q = '塩は甘いですか？';
		const result = await build(null).answer(q);
		expect(result).toEqual({ kind: 'answer', answer: seededAnswer(q), text: ANSWER_TEXT[seededAnswer(q)], source: 'random' });
	});

	test('1日の上限に達していれば Claude を呼ばず乱数で答える', async () => {
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'yes' }]);
		const result = await build(client, new MapMemory(), exhausted).answer('海は広いですか？');
		expect(result.source).toBe('random');
		expect(client.calls).toHaveLength(0);
	});
});

describe('YesNoService#answerIfQuestion（語尾不一致のフォールバック）', () => {
	test('疑問文らしくなければ Claude を呼ばず null', async () => {
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'yes' }]);
		expect(await build(client).answerIfQuestion('おはよう')).toBeNull();
		expect(client.calls).toHaveLength(0);
	});

	test('質問でないと判定されたら null を返し、判定を保存して次回も Claude を呼ばない', async () => {
		const client = new FakeClient([{ isYesNoQuestion: false, answer: 'undetermined' }]);
		const service = build(client);
		expect(await service.answerIfQuestion('今日何食べた？')).toBeNull();
		expect(await service.answerIfQuestion('今日何食べた？')).toBeNull();
		expect(client.calls).toHaveLength(1);
	});

	test('はい/いいえ質問と判定されたら回答する', async () => {
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'yes' }]);
		expect(await build(client).answerIfQuestion('もこチキって鳥？')).toEqual({ kind: 'answer', answer: 'yes', text: 'はい', source: 'claude' });
	});

	test('質問だが undetermined なら不定として返す（返信せずリアクションのみ）', async () => {
		const q = '明日は晴れる？';
		const client = new FakeClient([{ isYesNoQuestion: true, answer: 'undetermined' }]);
		expect(await build(client).answerIfQuestion(q)).toEqual({ kind: 'undetermined', source: 'claude' });
	});

	test('Claude が無い・上限超過・2回失敗なら null（返信しない）', async () => {
		expect(await build(null).answerIfQuestion('これって本当？')).toBeNull();
		const client1 = new FakeClient([{ isYesNoQuestion: true, answer: 'yes' }]);
		expect(await build(client1, new MapMemory(), exhausted).answerIfQuestion('これって本当？')).toBeNull();
		expect(client1.calls).toHaveLength(0);
		const client2 = new FakeClient(['x', 'y']);
		expect(await build(client2).answerIfQuestion('これって本当？')).toBeNull();
		expect(client2.calls).toHaveLength(2);
	});
});

describe('createLokiMemory', () => {
	test('保存と取得ができ、上限を超えると古いものから消える', () => {
		const db = new loki('test');
		const collection = db.addCollection('answers', { indices: ['key'] });
		const memory = createLokiMemory(collection as any, 2);

		memory.set('a', { isYesNoQuestion: true, answer: 'yes', createdAt: 1 });
		memory.set('b', { isYesNoQuestion: true, answer: 'no', createdAt: 2 });
		expect(memory.get('a')).toEqual({ isYesNoQuestion: true, answer: 'yes', createdAt: 1 });

		memory.set('c', { isYesNoQuestion: false, answer: 'undetermined', createdAt: 3 });
		expect(memory.get('a')).toBeNull();
		expect(memory.get('b')).not.toBeNull();
		expect(memory.get('c')).toEqual({ isYesNoQuestion: false, answer: 'undetermined', createdAt: 3 });
		expect(collection.count()).toBe(2);
	});

	test('同じキーは上書きされる', () => {
		const db = new loki('test');
		const collection = db.addCollection('answers', { indices: ['key'] });
		const memory = createLokiMemory(collection as any, 10);
		memory.set('a', { isYesNoQuestion: true, answer: 'yes', createdAt: 1 });
		memory.set('a', { isYesNoQuestion: true, answer: 'no', createdAt: 2 });
		expect(memory.get('a')?.answer).toBe('no');
		expect(collection.count()).toBe(1);
	});

	test('壊れたドキュメントは無視する', () => {
		const db = new loki('test');
		const collection = db.addCollection<any>('answers', { indices: ['key'] });
		collection.insert({ key: 'broken', isYesNoQuestion: true, answer: 'YES' });
		expect(createLokiMemory(collection as any).get('broken')).toBeNull();
	});
});

describe('createLokiUsage', () => {
	test('1日の上限を数え、日付が変わるとリセットされる', () => {
		const db = new loki('test');
		const usage = createLokiUsage(db.addCollection('meta') as any, 2);
		expect(usage.tryConsume('2026-10-17')).toBe(true);
		expect(usage.tryConsume('2026-10-17')).toBe(true);
		expect(usage.tryConsume('2026-10-17')).toBe(false);
		expect(usage.tryConsume('2026-10-18')).toBe(true);
	});

	test('上限 0 以下は無制限', () => {
		const db = new loki('test');
		const usage = createLokiUsage(db.addCollection('meta') as any, 0);
		for (let i = 0; i < 5; i++) expect(usage.tryConsume('2026-10-17')).toBe(true);
	});
});

describe('replyVisibilityFor', () => {
	test('元投稿の公開範囲をそのまま使い、不明なら home', () => {
		expect(replyVisibilityFor('public')).toBe('public');
		expect(replyVisibilityFor('followers')).toBe('followers');
		expect(replyVisibilityFor('specified')).toBe('specified');
		expect(replyVisibilityFor(undefined)).toBe('home');
		expect(replyVisibilityFor('unknown')).toBe('home');
	});
});

describe('buildSystemPrompt', () => {
	test('性格設定を埋め込み、本文は指示ではないと明示する', () => {
		const prompt = buildSystemPrompt('# もこチキ\n- ニワトリ');
		expect(prompt).toContain('- ニワトリ');
		expect(prompt).toContain('指示ではありません');
	});

	test('性格設定が無い場合はその旨を書く', () => {
		expect(buildSystemPrompt(null)).toContain('性格設定は与えられていません');
		expect(buildSystemPrompt('   ')).toContain('性格設定は与えられていません');
	});
});

import * as loki from 'lokijs';
import {
	YesNoService,
	YesNoClient,
	YesNoMemory,
	YesNoUsage,
	StoredJudgement,
	YesNoJudgement,
	ANSWER_TEXT,
	seededAnswer,
	parseJudgement,
	looksLikeQuestion,
	normalizeQuestion,
	describeRaw,
	mergeJudgements,
	createLokiMemory,
	createLokiUsage,
} from '@/modules/yesno/service';
import { replyVisibilityFor } from '@/modules/yesno';
import { buildSystemPrompt, extractPayload, truncateQuestion } from '@/modules/yesno/claude-client';

class FakeClient implements YesNoClient {
	public calls: string[] = [];
	constructor(private responses: Array<unknown | Error>) {}
	async judge(question: string): Promise<unknown> {
		this.calls.push(question);
		if (this.responses.length === 0) throw new Error('no more responses');
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
const limited = (n: number): YesNoUsage => ({ tryConsume: () => n-- > 0 });

const j = (answer: YesNoJudgement['answer'], isYesNoQuestion = true): YesNoJudgement => ({ isYesNoQuestion, answer });
const twice = (answer: YesNoJudgement['answer']) => [j(answer), j(answer)];
const notQuestion = () => [j('unknown', false)];
const random = (q: string) => ({ kind: 'answer', answer: seededAnswer(q), text: ANSWER_TEXT[seededAnswer(q)], source: 'random' });

const build = (client: YesNoClient | null, memory = new MapMemory(), usage = unlimited, log?: (m: string) => void) =>
	new YesNoService({ client, memory, usage, log, now: () => new Date('2026-10-17T12:00:00') });

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

	test('unknown と undetermined をどちらも受け付ける', () => {
		expect(parseJudgement({ isYesNoQuestion: true, answer: 'unknown' })).toEqual({ isYesNoQuestion: true, answer: 'unknown' });
		expect(parseJudgement({ isYesNoQuestion: true, answer: 'undetermined' })).toEqual({ isYesNoQuestion: true, answer: 'undetermined' });
	});

	test('質問でない場合は回答を unknown に丸める', () => {
		expect(parseJudgement({ isYesNoQuestion: false, answer: 'yes' })).toEqual({ isYesNoQuestion: false, answer: 'unknown' });
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

describe('mergeJudgements', () => {
	test('回答が一致すれば1回目の判定', () => {
		expect(mergeJudgements(j('yes'), j('yes'))).toEqual(j('yes'));
		expect(mergeJudgements(j('undetermined'), j('undetermined'))).toEqual(j('undetermined'));
	});

	test('方向が同じなら maybe 側に寄せる', () => {
		expect(mergeJudgements(j('yes'), j('maybe_yes'))).toEqual(j('maybe_yes'));
		expect(mergeJudgements(j('maybe_yes'), j('yes'))).toEqual(j('maybe_yes'));
		expect(mergeJudgements(j('no'), j('maybe_no'))).toEqual(j('maybe_no'));
		expect(mergeJudgements(j('maybe_no'), j('no'))).toEqual(j('maybe_no'));
	});

	test('どちらかが不定なら不定', () => {
		expect(mergeJudgements(j('undetermined'), j('no'))).toEqual(j('undetermined'));
		expect(mergeJudgements(j('yes'), j('undetermined'))).toEqual(j('undetermined'));
		expect(mergeJudgements(j('unknown'), j('undetermined'))).toEqual(j('undetermined'));
	});

	test('それ以外の不一致は分からない（unknown）', () => {
		expect(mergeJudgements(j('yes'), j('no'))).toEqual(j('unknown'));
		expect(mergeJudgements(j('yes'), j('maybe_no'))).toEqual(j('unknown'));
		expect(mergeJudgements(j('maybe_yes'), j('maybe_no'))).toEqual(j('unknown'));
		expect(mergeJudgements(j('yes'), j('unknown'))).toEqual(j('unknown'));
		expect(mergeJudgements(j('yes'), j('unknown', false))).toEqual(j('unknown'));
	});

	test('質問かどうかは1回目を採用する', () => {
		expect(mergeJudgements(j('unknown', false), j('yes'))).toEqual(j('unknown', false));
	});
});

describe('describeRaw', () => {
	test('型と中身を出し、長いものは切る', () => {
		expect(describeRaw('はい！')).toBe('[string] はい！');
		expect(describeRaw({ answer: 'YES' })).toBe('[object] {"answer":"YES"}');
		expect(describeRaw(null)).toBe('[null] null');
		expect(describeRaw(undefined)).toBe('[undefined] undefined');
		expect(describeRaw([1, 2])).toBe('[array] [1,2]');
		const long = describeRaw('あ'.repeat(600));
		expect(long.length).toBeLessThan(600);
		expect(long).toContain('…(600文字)');
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
	test('回答が2回一致したらその回答を固定文言で返し、メモリーに保存する', async () => {
		const client = new FakeClient(twice('maybe_yes'));
		const memory = new MapMemory();
		const result = await build(client, memory).answer('りんごは赤いですか？');
		expect(result).toEqual({ kind: 'answer', answer: 'maybe_yes', text: '多分はい、部分的にはい', source: 'claude' });
		expect(client.calls).toHaveLength(2);
		expect(memory.map.get('りんごは赤いですか？')).toMatchObject({ isYesNoQuestion: true, answer: 'maybe_yes' });
	});

	test('回答が異なれば分からない扱いで乱数、メモリーには unknown を保存', async () => {
		const q = '猫は犬より賢いですか？';
		const logs: string[] = [];
		const client = new FakeClient([j('yes'), j('maybe_no')]);
		const memory = new MapMemory();
		const result = await build(client, memory, unlimited, m => logs.push(m)).answer(q);
		expect(result).toEqual(random(q));
		expect(memory.map.get(q)).toMatchObject({ isYesNoQuestion: true, answer: 'unknown' });
		expect(logs.some(l => l.includes('一致しません') && l.includes('yes / maybe_no → unknown'))).toBe(true);
	});

	test('yes と maybe_yes に割れたら maybe_yes で答える', async () => {
		const client = new FakeClient([j('yes'), j('maybe_yes')]);
		const memory = new MapMemory();
		const result = await build(client, memory).answer('りんごは甘いですか？');
		expect(result).toEqual({ kind: 'answer', answer: 'maybe_yes', text: '多分はい、部分的にはい', source: 'claude' });
		expect(memory.map.get('りんごは甘いですか？')).toMatchObject({ answer: 'maybe_yes' });
	});

	test('片方が不定なら不定として扱う', async () => {
		const client = new FakeClient([j('no'), j('undetermined')]);
		expect(await build(client).answer('本来のもこチキは喋りますか？')).toEqual({ kind: 'undetermined', source: 'claude' });
	});

	test('2回目はメモリーから返し、Claude を呼ばない', async () => {
		const client = new FakeClient(twice('no'));
		const service = build(client);
		await service.answer('空は緑ですか？');
		const second = await service.answer(' 空は緑ですか？ ');
		expect(second).toEqual({ kind: 'answer', answer: 'no', text: 'いいえ', source: 'memory' });
		expect(client.calls).toHaveLength(2);
	});

	test('規格外の応答は再試行して有効な判定を集める', async () => {
		const client = new FakeClient(['はい！', j('yes'), j('yes')]);
		const result = await build(client).answer('水は液体ですか？');
		expect(result).toEqual({ kind: 'answer', answer: 'yes', text: 'はい', source: 'claude' });
		expect(client.calls).toHaveLength(3);
	});

	test('通信失敗も再試行する', async () => {
		const client = new FakeClient([new Error('timeout'), j('maybe_no'), j('maybe_no')]);
		const result = await build(client).answer('火は冷たいですか？');
		expect(result).toMatchObject({ kind: 'answer', answer: 'maybe_no' });
		expect(client.calls).toHaveLength(3);
	});

	test('2回失敗したら乱数に落とし、メモリーには保存しない', async () => {
		const q = '猫は犬ですか？';
		const client = new FakeClient(['???', new Error('500')]);
		const memory = new MapMemory();
		expect(await build(client, memory).answer(q)).toEqual(random(q));
		expect(client.calls).toHaveLength(2);
		expect(memory.map.size).toBe(0);
	});

	test('2回目の判定が取れなければ1回目を使う', async () => {
		const client = new FakeClient([j('yes'), 'x', new Error('500')]);
		const result = await build(client).answer('水は液体ですか？');
		expect(result).toMatchObject({ kind: 'answer', answer: 'yes', source: 'claude' });
		expect(client.calls).toHaveLength(3);
	});

	test('unknown（分からない）は乱数で答え、判定はメモリーに保存して次回は Claude を呼ばない', async () => {
		const q = '今日は晴れですか？';
		const client = new FakeClient(twice('unknown'));
		const service = build(client);
		const first = await service.answer(q);
		const second = await service.answer(q);
		expect(first).toEqual(random(q));
		expect(second).toEqual(first);
		expect(client.calls).toHaveLength(2);
	});

	test('undetermined は不定として返し（返信しない）、判定はメモリーに保存して次回は Claude を呼ばない', async () => {
		const q = '本来のもこチキは喋りますか？';
		const client = new FakeClient(twice('undetermined'));
		const service = build(client);
		expect(await service.answer(q)).toEqual({ kind: 'undetermined', source: 'claude' });
		expect(await service.answer(q)).toEqual({ kind: 'undetermined', source: 'memory' });
		expect(client.calls).toHaveLength(2);
	});

	test('質問でないと判定した語尾一致の質問は1回で確定し乱数で答える', async () => {
		const q = 'おはようございますか？';
		const client = new FakeClient(notQuestion());
		expect(await build(client).answer(q)).toEqual(random(q));
		expect(client.calls).toHaveLength(1);
	});

	test('Claude が無ければ乱数で答える', async () => {
		const q = '塩は甘いですか？';
		expect(await build(null).answer(q)).toEqual(random(q));
	});

	test('1日の上限に達していれば Claude を呼ばず乱数で答える', async () => {
		const client = new FakeClient(twice('yes'));
		expect(await build(client, new MapMemory(), exhausted).answer('海は広いですか？')).toEqual(random('海は広いですか？'));
		expect(client.calls).toHaveLength(0);
	});

	test('上限が1回目の後で尽きたら、1回目の判定を使う', async () => {
		const client = new FakeClient(twice('no'));
		const result = await build(client, new MapMemory(), limited(1)).answer('海は狭いですか？');
		expect(result).toMatchObject({ kind: 'answer', answer: 'no', source: 'claude' });
		expect(client.calls).toHaveLength(1);
	});
});

describe('YesNoService#answerIfQuestion（語尾不一致のフォールバック）', () => {
	test('疑問文らしくなければ Claude を呼ばず null', async () => {
		const client = new FakeClient(twice('yes'));
		expect(await build(client).answerIfQuestion('おはよう')).toBeNull();
		expect(client.calls).toHaveLength(0);
	});

	test('質問でないと判定されたら1回で確定して null、判定を保存して次回も Claude を呼ばない', async () => {
		const client = new FakeClient(notQuestion());
		const service = build(client);
		expect(await service.answerIfQuestion('今日何食べた？')).toBeNull();
		expect(await service.answerIfQuestion('今日何食べた？')).toBeNull();
		expect(client.calls).toHaveLength(1);
	});

	test('1回目が質問・2回目が質問でないなら、回答不一致として分からない扱いで乱数', async () => {
		const q = 'もこチキって鳥？';
		const client = new FakeClient([j('yes'), j('unknown', false)]);
		expect(await build(client).answerIfQuestion(q)).toEqual(random(q));
		expect(client.calls).toHaveLength(2);
	});

	test('はい/いいえ質問と判定されたら回答する', async () => {
		const client = new FakeClient(twice('yes'));
		expect(await build(client).answerIfQuestion('もこチキって鳥？')).toEqual({ kind: 'answer', answer: 'yes', text: 'はい', source: 'claude' });
	});

	test('質問だが unknown なら乱数で答える', async () => {
		const q = '明日は晴れる？';
		expect(await build(new FakeClient(twice('unknown'))).answerIfQuestion(q)).toEqual(random(q));
	});

	test('質問だが回答が食い違ったら分からない扱いで乱数', async () => {
		const q = 'ねぎまって美味しい？';
		expect(await build(new FakeClient([j('yes'), j('no')])).answerIfQuestion(q)).toEqual(random(q));
	});

	test('no と maybe_no に割れたら maybe_no で答える', async () => {
		expect(await build(new FakeClient([j('no'), j('maybe_no')])).answerIfQuestion('ねぎまって美味しい？'))
			.toEqual({ kind: 'answer', answer: 'maybe_no', text: '多分いいえ、部分的にいいえ', source: 'claude' });
	});

	test('質問だが undetermined なら不定として返す（返信せずリアクションのみ）', async () => {
		const q = 'もこチキって卵産む？';
		expect(await build(new FakeClient(twice('undetermined'))).answerIfQuestion(q)).toEqual({ kind: 'undetermined', source: 'claude' });
	});

	test('Claude が無い・上限超過・2回失敗なら null（返信しない）', async () => {
		expect(await build(null).answerIfQuestion('これって本当？')).toBeNull();
		const client1 = new FakeClient(twice('yes'));
		expect(await build(client1, new MapMemory(), exhausted).answerIfQuestion('これって本当？')).toBeNull();
		expect(client1.calls).toHaveLength(0);
		const client2 = new FakeClient(['x', 'y']);
		expect(await build(client2).answerIfQuestion('これって本当？')).toBeNull();
		expect(client2.calls).toHaveLength(2);
	});
});

describe('規格外応答のログ', () => {
	test('規格外の応答の中身がログに出る', async () => {
		const logs: string[] = [];
		const client = new FakeClient(['はい！', j('yes'), j('yes')]);
		await build(client, new MapMemory(), unlimited, m => logs.push(m)).answer('水は液体ですか？');
		expect(logs.some(l => l.includes('規格外') && l.includes('[string] はい！'))).toBe(true);
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

		memory.set('c', { isYesNoQuestion: false, answer: 'unknown', createdAt: 3 });
		expect(memory.get('a')).toBeNull();
		expect(memory.get('b')).not.toBeNull();
		expect(memory.get('c')).toEqual({ isYesNoQuestion: false, answer: 'unknown', createdAt: 3 });
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

describe('extractPayload', () => {
	test('parsed_output があればそれを返す', () => {
		expect(extractPayload({ stop_reason: 'end_turn', parsed_output: { isYesNoQuestion: true, answer: 'yes' }, content: [] }))
			.toEqual({ isYesNoQuestion: true, answer: 'yes' });
	});

	test('parsed_output が無ければテキストブロックを返す', () => {
		expect(extractPayload({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"a":1}' }] })).toBe('{"a":1}');
		expect(extractPayload({ stop_reason: 'end_turn', content: [] })).toBeNull();
	});

	test('途中で切れた・拒否された応答は理由付きの例外になる', () => {
		expect(() => extractPayload({ stop_reason: 'max_tokens', content: [] })).toThrow('stop_reason=max_tokens');
		expect(() => extractPayload({ stop_reason: 'refusal', stop_details: { category: 'cyber', explanation: 'x' }, content: [] }))
			.toThrow('stop_reason=refusal (cyber: x)');
	});
});

describe('truncateQuestion', () => {
	test('長すぎる質問は先頭だけ残す', () => {
		expect(truncateQuestion('短い')).toBe('短い');
		expect(truncateQuestion('あ'.repeat(3000)).length).toBe(2000);
	});
});

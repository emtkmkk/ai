/**
 * @packageDocumentation
 *
 * yesno モジュール
 *
 * 他のどのモジュールも反応しなかったメンションについて、
 * Claude に「はい/いいえで答えられる質問か」を判定させ、
 * 質問であれば回答する。
 *
 * @remarks
 * - モジュール配列の最後に登録すること（他モジュールのフォールバック）。
 * - 「ですか？」などの語尾条件に一致する質問は dice モジュールが先に拾い、
 *   同じ {@link YesNoService} で回答する。
 * - 返信の公開範囲は元投稿に合わせる。
 * - Claude が「答えは不定」と明確に判定した場合は返信せず、`:thinking_mkchicken:` をリアクションする。
 *
 * @see {@link ./service | YesNoService}
 * @internal
 */
import * as fs from 'fs';
import autobind from 'autobind-decorator';
import 藍 from '@/ai';
import Module from '@/module';
import Message from '@/message';
import config from '@/config';
import { YesNoService, createLokiMemory, createLokiUsage, YesNoClient, UNDETERMINED_REACTION } from './service';
import { ClaudeYesNoClient } from './claude-client';

let service: YesNoService | null = null;

/**
 * 性格設定ファイルを読む
 *
 * @returns 読めなければ `null`
 */
function loadCharacterPrompt(path: string, log: (msg: string) => void): string | null {
	try {
		const text = fs.readFileSync(path, 'utf8');
		log(`性格設定を読み込みました: ${path}`);
		return text;
	} catch {
		log(`性格設定ファイルが無いため、性格設定なしで判定します: ${path}`);
		return null;
	}
}

/**
 * Claude クライアントを作る
 *
 * @returns 無効・キー無し・テスト環境なら `null`
 */
function createClient(log: (msg: string) => void): YesNoClient | null {
	if (process.env.NODE_ENV === 'test') return null;
	if (!config.yesNoClaudeEnabled) {
		log('yesNoClaudeEnabled が false のため Claude を使いません');
		return null;
	}
	const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		log('Claude API キーが無いため、はい/いいえ判定は乱数のみで動きます');
		return null;
	}
	return new ClaudeYesNoClient({
		apiKey,
		model: config.yesNoModel,
		characterPrompt: loadCharacterPrompt(config.yesNoCharacterFile, log),
	});
}

/**
 * はい/いいえ回答サービスを取得する（初回に生成）
 *
 * @remarks
 * dice モジュールと yesno モジュールで同じインスタンスを共有する。
 */
export function getYesNoService(ai: 藍): YesNoService {
	if (service != null) return service;
	const log = (msg: string) => ai.log(`[yesno] ${msg}`);
	service = new YesNoService({
		client: createClient(log),
		memory: createLokiMemory(ai.getCollection('_yesno_answers', { indices: ['key'] })),
		usage: createLokiUsage(ai.getCollection('_yesno_meta', {}), config.yesNoDailyLimit),
		log,
	});
	return service;
}

/**
 * 返信の公開範囲を元投稿に合わせる
 */
export function replyVisibilityFor(visibility: string | undefined): string {
	switch (visibility) {
		case 'public':
		case 'home':
		case 'followers':
		case 'specified':
			return visibility;
		default:
			return 'home';
	}
}

export default class extends Module {
	public readonly name = 'yesno';

	/**
	 * モジュールをインストールし、mentionHook を登録する
	 *
	 * @returns mentionHook を含むインストール結果
	 * @internal
	 */
	@autobind
	public install() {
		// NOTE: サービスを先に作っておき、設定の問題を起動時のログで分かるようにする
		getYesNoService(this.ai);
		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * 他モジュールが反応しなかったメンションを、はい/いいえ質問なら回答する
	 *
	 * @param msg - 受信したメッセージ
	 * @returns 回答した場合はリアクション結果、質問でなければ `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.extractedText == null || msg.extractedText.trim() === '') return false;

		const result = await getYesNoService(this.ai).answerIfQuestion(msg.extractedText);
		if (result == null) return false;

		if (result.kind === 'undetermined') {
			// 答えが不定と明確に判定された → 返信せずリアクションだけ
			this.log(`回答: 不定 (${result.source})`);
			return {
				reaction: UNDETERMINED_REACTION
			};
		}

		this.log(`回答: ${result.answer} (${result.source})`);
		msg.reply(result.text, { visibility: replyVisibilityFor(msg.visibility) });
		return {
			reaction: 'love'
		};
	}
}

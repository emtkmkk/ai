/**
 * @packageDocumentation
 *
 * キーワード学習モジュール
 *
 * タイムラインのノートから固有名詞をMeCabで抽出し、学習した単語を投稿する。
 * 管理者コマンド `/check` で学習済みキーワードの整理（不正なものの削除）も行う。
 *
 * @remarks
 * NOTE: `config.keywordEnabled` が false の場合は無効化される（install で空オブジェクトを返す）。
 * NOTE: 学習確率は `activeFactor` に依存する（活動度が高いほど学習しやすい）。
 * NOTE: NGワードに該当するキーワードは学習しない。
 * NOTE: 2桁以上の数字のみで構成されるキーワードは学習しない。
 * NOTE: 投稿確率も `activeFactor` に依存する（0.25未満だと投稿が間引かれる）。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import config from '@/config';
import serifs from '@/serifs';
import { mecab } from './mecab';
import { checkNgWord } from '@/utils/check-ng-word';

/**
 * カタカナをひらがなに変換するヘルパー関数
 *
 * @remarks
 * MeCab の読み（カタカナ）と表層形を比較するために使用する。
 *
 * @param str - 変換対象の文字列
 * @returns ひらがなに変換された文字列
 * @internal
 */
function kanaToHira(str: string) {
	return str.replace(/[\u30a1-\u30f6]/g, match => {
		const chr = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(chr);
	});
}

/**
 * キーワード学習モジュールクラス
 *
 * @remarks
 * 10分間隔でTLからキーワードを学習し、新しいキーワードを覚えた旨を投稿する。
 * 学習データは LokiJS の `_keyword_learnedKeywords` コレクションに永続化される。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'keyword';

	/**
	 * 学習済みキーワードコレクション
	 *
	 * @internal
	 */
	private learnedKeywords: loki.Collection<{
		/** 学習した単語の表層形 */
		keyword: string;
		/** 学習日時（ミリ秒タイムスタンプ） */
		learnedAt: number;
	}>;

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * `config.keywordEnabled` が false の場合は空オブジェクトを返し、
	 * モジュールを無効化する。有効な場合は10分間隔で学習を実行する。
	 *
	 * @returns mentionHook を含むフック登録オブジェクト、または空オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		if (!config.keywordEnabled) return {};

		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});

		const hours = new Date().getHours();

		// 10分間隔で学習を実行
		setInterval(this.learn, 1000 * 60 * 10);

		return {
			mentionHook: this.mentionHook,
		};
	}

	/**
	 * メンション受信時のフック: 管理者コマンド `/check`
	 *
	 * @remarks
	 * 管理者が `/check` を送信すると、学習済みキーワードの整理を実行する。
	 * 以下の条件に該当するキーワードを削除:
	 * - 読み（token[8]）が null のもの
	 * - NGワードに該当するもの
	 * - 2桁以上の数字のみで構成されるもの
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		// 管理者のみが `/check` コマンドを実行可能
		if (!msg.or(['/check']) || msg.user.host || msg.user.username !== config.master) {
			return false;
		} else {
			this.log('checkLearnedKeywords...');

			const keywords = this.learnedKeywords.find();

			keywords.forEach(async (x) => {
				const tokens = await mecab(x.keyword, config.mecab, config.mecabDic, config.mecabCustom);
				if (tokens?.length === 1) {
					const token = tokens[0];
					if (
						token[8] == null ||
						!checkNgWord(token[0]) ||
						!checkNgWord(token[8]) ||
						/^\d\d+|\d\d+$/.test(token[0])
					) {
						this.log(`delete ${token[0]}[${token[2]}:${token[3]}](${token[8]})...`);
						this.learnedKeywords.remove(x);
					}
				}
			});

			this.log('finish!');

			return { reaction: 'love' };
		}
	}

	/**
	 * キーワード学習処理
	 *
	 * @remarks
	 * ハイブリッドTLから最新50件のノートを取得し、MeCab で固有名詞を抽出する。
	 * 抽出されたキーワードの中からランダムに1つ選び、未学習であれば覚えて投稿する。
	 *
	 * 学習確率は `activeFactor` に比例する（最低25%、÷2）。
	 * 投稿確率は `activeFactor` が0.25未満の場合にさらに間引かれる。
	 *
	 * NOTE: Bot投稿、ローカル限定、CW付き、500文字超のノートは除外される。
	 * NOTE: 長いキーワードが優先的に選ばれるソートが適用される。
	 *
	 * @internal
	 */
	@autobind
	private async learn() {

		// 学習確率: activeFactor が高いほど学習しやすい（最低12.5%）
		const learnRnd = (Math.max(this.ai.activeFactor, 0.25) / 2);
		if (Math.random() >= learnRnd) {
			return;
		}

		// ハイブリッドTLから最新50件を取得
		const tl = await this.ai.api('notes/hybrid-timeline', {
			limit: 50
		});

		// Bot・ローカル限定・CW付き・500文字超を除外
		const interestedNotes = tl.filter(note =>
			!note.user.isBot &&
			!note.localOnly &&
			note.visibility === 'public' &&
			note.userId !== this.ai.account.id &&
			note.text != null &&
			note.text.length <= 500 &&
			note.cw == null);

		let keywords: string[][] = [];

		// 各ノートからMeCabで固有名詞（人名以外）を抽出
		for (const note of interestedNotes) {
			const tokens = await mecab(note.text, config.mecab, config.mecabDic, config.mecabCustom);
			const keywordsInThisNote = tokens.filter(token => token[2] == '固有名詞' && token[3] !== '人名' && token[8] != null);
			keywords = keywords.concat(keywordsInThisNote);
		}

		if (keywords.length === 0) return;

		// 長いキーワード優先でソートし、上位からランダム選択（平方根分布）
		const rnd = Math.floor((1 - Math.sqrt(Math.random())) * keywords.length);
		const keyword = keywords.sort((a, b) => a[0].length < b[0].length ? 1 : -1)[rnd];

		// 既に学習済みなら何もしない
		const exist = this.learnedKeywords.findOne({
			keyword: keyword[0]
		});

		let text: string;

		if (exist) {
			return;
		} else {
			// NGワード・数字のみのキーワードは覚えない
			if (!checkNgWord(keyword[0]) || !checkNgWord(keyword[8])) return;
			if (/^\d\d+|\d\d+$/.test(keyword[0])) return;
			this.learnedKeywords.insertOne({
				keyword: keyword[0],
				learnedAt: Date.now()
			});

			// 表層形と読みが異なる場合は読みも表示
			text = serifs.keyword.learned(keyword[0]?.replaceAll(/\s/g, ""), kanaToHira(keyword[0]) !== kanaToHira(keyword[8]) ? kanaToHira(keyword[8]) : null);
		}

		// activeFactor が低い場合は投稿を間引く
		if (this.ai.activeFactor < 0.25) {
			const postRnd = (this.ai.activeFactor / 0.25);
			if (Math.random() >= postRnd) {
				return;
			}
		}
		this.ai.decActiveFactor(0.015);
		this.ai.post({
			text: text
		});
	}
}

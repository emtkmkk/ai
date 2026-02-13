/**
 * @packageDocumentation
 *
 * 会話応答モジュール
 *
 * メンションに対して挨拶・褒め・おめでとう等の会話応答を行うモジュール。
 * 各ハンドラは mentionHook 内で優先順に評価され、最初にマッチしたものが応答する。
 *
 * @remarks
 * - NOTE: 現在、greet / erait / omedeto の3つのみ有効。
 *       （他のハンドラはコメントアウトされている）
 *       （話す機能はコアモジュールや他のモジュールに分散されているため）
 *
 * - NOTE: greet は incLove(0.6, "greet") を呼び出し、1日1回だけ親愛度を上昇させる。
 *       ponkotu / rmrf は decLove() を呼び出し親愛度を下げるが、現在は無効。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import { HandlerResult } from '@/ai';
import Module from '@/module';
import Message from '@/message';
import serifs, { getSerif } from '@/serifs';
import getDate from '@/utils/get-date';

/**
 * 会話応答モジュールクラス
 *
 * @remarks
 * メンションに含まれるキーワードに応じて、挨拶やリアクションを返す。
 * 各ハンドラメソッドは `boolean | HandlerResult` を返し、
 * `true` または `HandlerResult` を返した場合に処理済みとなる。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'talk';

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * mentionHook のみを登録する。定期実行やコンテキストフックは不要。
	 *
	 * @returns mentionHook を含むフック登録オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook,
		};
	}

	/**
	 * メンション受信時のフック
	 *
	 * @remarks
	 * 各ハンドラを優先順に評価し、最初にマッチしたハンドラの結果を返す。
	 * 現在有効なハンドラ: greet, erait, omedeto
	 * コメントアウト中: nadenade, kawaii, suki, hug, humu, batou, itai, ote, ponkotu, rmrf, shutdown
	 *
	 * @param msg - 受信メッセージ
	 * @returns 処理結果。いずれのハンドラにもマッチしなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.text) return false;

		return (
			this.greet(msg) ||
			this.erait(msg) ||
			this.omedeto(msg) ||
			//this.nadenade(msg) ||
			//this.kawaii(msg) ||
			//this.suki(msg) ||
			//this.hug(msg) ||
			//this.humu(msg) ||
			//this.batou(msg) ||
			//this.itai(msg) ||
			//this.ote(msg) ||
			//this.ponkotu(msg) ||
			//this.rmrf(msg) ||
			//this.shutdown(msg) ||
			false
		);
	}

	/**
	 * 挨拶ハンドラ
	 *
	 * @remarks
	 * 「おはよう」「こんにちは」「おやすみ」「行ってきます」「ただいま」「ありがとう」を検出し、
	 * 対応するセリフで返信する。1日1回のみ親愛度を +0.6（実効 +3）上昇させる。
	 *
	 * NOTE: テンション（末尾の `！` の数）は「おはよう」の返信にのみ影響する。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private greet(msg: Message) {
		if (msg.text == null) return false;

		const incLove = () => {
			//#region 1日に1回だけ親愛度を上げる
			const today = getDate();

			const data = msg.friend.getPerModulesData(this);

			if (data.lastGreetedAt == today) return { reaction: 'like' };

			data.lastGreetedAt = today;
			msg.friend.setPerModulesData(this, data);

			// 0.6 × 5 = 実効 3 の親愛度上昇
			msg.friend.incLove(0.6, "greet");

			return { reaction: 'love' };
			//#endregion
		};

		// 末尾のエクスクラメーションマークの連続数を取得（テンション判定用）
		const tension = (msg.text.match(/[！!]{2,}/g) || [''])
			.sort((a, b) => a.length < b.length ? 1 : -1)[0]
			.substr(1);

		if (msg.includes(['こんにちは', 'こんにちわ'])) {
			msg.reply(serifs.core.hello(msg.friend.name));
			return incLove();
		}

		if (msg.includes(['こんばんは', 'こんばんわ'])) {
			msg.reply(serifs.core.helloNight(msg.friend.name));
			return incLove();
		}

		if (msg.includes(['おは', 'おっは', 'お早う'])) {
			msg.reply(serifs.core.goodMorning(tension, msg.friend.name));
			return incLove();
		}

		if (msg.includes(['おやすみ', 'お休み'])) {
			msg.reply(serifs.core.goodNight(msg.friend.name));
			return incLove();
		}

		if (msg.includes(['行ってくる', '行ってきます', 'いってくる', 'いってきます'])) {
			msg.reply(
				serifs.core.itterassyai.normal(msg.friend.name));
			return incLove();
		}

		if (msg.includes(['ただいま'])) {
			msg.reply(
				serifs.core.okaeri.normal(msg.friend.name));
			return incLove();
		}

		if (msg.includes(['ありがと'])) {
			msg.reply(
				getSerif(serifs.core.arigatou.normal));
			return incLove();
		}

		return false;
	}

	/**
	 * 「褒めて」ハンドラ
	 *
	 * @remarks
	 * 「〇〇たから褒めて」「〇〇るから褒めて」「〇〇だから褒めて」のパターンで
	 * 理由を抽出し、理由付きの褒めセリフを返す。パターンにマッチしない場合は
	 * 汎用の褒めセリフを返す。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private erait(msg: Message) {
		// 「〇〇た（から|ので）褒めて」パターン
		const match = msg.extractedText.match(/(.+?)た(から|ので)(褒|ほ)めて/);
		if (match) {
			msg.reply(getSerif(serifs.core.erait.specify(match[1], msg.friend.name)));
			return { reaction: 'love' };
		}

		// 「〇〇る（から|ので）褒めて」パターン
		const match2 = msg.extractedText.match(/(.+?)る(から|ので)(褒|ほ)めて/);
		if (match2) {
			msg.reply(getSerif(serifs.core.erait.specify(match2[1], msg.friend.name)));
			return { reaction: 'love' };
		}

		// 「〇〇だから褒めて」パターン
		const match3 = msg.extractedText.match(/(.+?)だから(褒|ほ)めて/);
		if (match3) {
			msg.reply(getSerif(serifs.core.erait.specify(match3[1], msg.friend.name)));
			return { reaction: 'love' };
		}

		if (!msg.includes(['褒めて', 'ほめて'])) return false;

		// 理由なしの汎用褒めセリフ
		msg.reply(getSerif(serifs.core.erait.general(msg.friend.name)));

		return { reaction: 'love' };
	}

	/**
	 * 「おめでとう」ハンドラ
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private omedeto(msg: Message) {
		if (!msg.includes(['おめでと'])) return false;

		msg.reply(serifs.core.omedeto(msg.friend.name));

		return { reaction: ':mk_discochicken:' };
	}

	/**
	 * 「なでなで」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * 親愛度に応じて返答が変化する。親愛度0以上なら1日1回 incLove() で +1（実効 +5）。
	 * 親愛度が低い場合は嫌がるセリフになる。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private nadenade(msg: Message): boolean {
		if (!msg.includes(['なでなで'])) return false;

		//#region 1日に1回だけ親愛度を上げる(嫌われてない場合のみ)
		if (msg.friend.love >= 0) {
			const today = getDate();

			const data = msg.friend.getPerModulesData(this);

			if (data.lastNadenadeAt != today) {
				data.lastNadenadeAt = today;
				msg.friend.setPerModulesData(this, data);

				msg.friend.incLove();
			}
		}
		//#endregion

		// 親愛度レベルに応じた返答を選択
		msg.reply(getSerif(
			msg.friend.love >= 10 ? serifs.core.nadenade.love3 :
				msg.friend.love >= 5 ? serifs.core.nadenade.love2 :
					msg.friend.love <= -15 ? serifs.core.nadenade.hate4 :
						msg.friend.love <= -10 ? serifs.core.nadenade.hate3 :
							msg.friend.love <= -5 ? serifs.core.nadenade.hate2 :
								msg.friend.love <= -1 ? serifs.core.nadenade.hate1 :
									serifs.core.nadenade.normal
		));

		return true;
	}

	/**
	 * 「かわいい」ハンドラ（現在コメントアウトで無効）
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private kawaii(msg: Message): boolean {
		if (!msg.includes(['かわいい', '可愛い'])) return false;

		msg.reply(getSerif(
			msg.friend.love >= 5 ? serifs.core.kawaii.love :
				msg.friend.love <= -3 ? serifs.core.kawaii.hate :
					serifs.core.kawaii.normal));

		return true;
	}

	/**
	 * 「好き」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * `msg.or()` を使用して「好き」「すき」のいずれかに完全一致で判定。
	 * 親愛度5以上かつ名前を設定済みなら、名前入りの特別返答を返す。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private suki(msg: Message): boolean {
		if (!msg.or(['好き', 'すき'])) return false;

		msg.reply(
			msg.friend.love >= 5 ? (msg.friend.name ? serifs.core.suki.love(msg.friend.name) : serifs.core.suki.normal) :
				msg.friend.love <= -3 ? serifs.core.suki.hate :
					serifs.core.suki.normal);

		return true;
	}

	/**
	 * 「ハグ」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * 前のハグから1分以内は返信しない（連続応答による不自然さ防止）。
	 * 「ぎゅ」「むぎゅ」「はぐ」等にマッチする。
	 *
	 * HACK: ハグ→ぎゅー→ぎゅーの連鎖を防ぐため、1分のクールダウンを設けている。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private hug(msg: Message): boolean {
		if (!msg.or(['ぎゅ', 'むぎゅ', /^はぐ(し(て|よ|よう)?)?$/])) return false;

		//#region 前のハグから1分経ってない場合は返信しない
		// これは、「ハグ」と言って「ぎゅー」と返信したとき、相手が
		// それに対してさらに「ぎゅー」と返信するケースがあったため。
		// そうするとその「ぎゅー」に対してもマッチするため、また
		// 藍がそれに返信してしまうことになり、少し不自然になる。
		// これを防ぐために前にハグしてから少し時間が経っていないと
		// 返信しないようにする
		const now = Date.now();

		const data = msg.friend.getPerModulesData(this);

		if (data.lastHuggedAt != null) {
			if (now - data.lastHuggedAt < (1000 * 60)) return true;
		}

		data.lastHuggedAt = now;
		msg.friend.setPerModulesData(this, data);
		//#endregion

		msg.reply(
			msg.friend.love >= 5 ? serifs.core.hug.love :
				msg.friend.love <= -3 ? serifs.core.hug.hate :
					serifs.core.hug.normal);

		return true;
	}

	/**
	 * 「踏んで」ハンドラ（現在コメントアウトで無効）
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private humu(msg: Message): boolean {
		if (!msg.includes(['踏んで'])) return false;

		msg.reply(
			msg.friend.love >= 5 ? serifs.core.humu.love :
				msg.friend.love <= -3 ? serifs.core.humu.hate :
					serifs.core.humu.normal);

		return true;
	}

	/**
	 * 「罵倒して」ハンドラ（現在コメントアウトで無効）
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private batou(msg: Message): boolean {
		if (!msg.includes(['罵倒して', '罵って'])) return false;

		msg.reply(
			msg.friend.love >= 5 ? serifs.core.batou.love :
				msg.friend.love <= -5 ? serifs.core.batou.hate :
					serifs.core.batou.normal);

		return true;
	}

	/**
	 * 「痛い」ハンドラ（現在コメントアウトで無効）
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private itai(msg: Message): boolean {
		if (!msg.or(['痛い', 'いたい']) && !msg.extractedText.endsWith('痛い')) return false;

		msg.reply(serifs.core.itai(msg.friend.name));

		return true;
	}

	/**
	 * 「お手」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * 親愛度10以上 / 5以上 / それ以下で3段階の返答が変わる。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private ote(msg: Message): boolean {
		if (!msg.or(['お手'])) return false;

		msg.reply(
			msg.friend.love >= 10 ? serifs.core.ote.love2 :
				msg.friend.love >= 5 ? serifs.core.ote.love1 :
					serifs.core.ote.normal);

		return true;
	}

	/**
	 * 「ぽんこつ」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * decLove() を呼び出し、親愛度を -1（実効 -5）低下させる。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult（angry リアクション）、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private ponkotu(msg: Message): boolean | HandlerResult {
		if (!msg.includes(['ぽんこつ'])) return false;

		msg.friend.decLove();

		return {
			reaction: 'angry'
		};
	}

	/**
	 * 「rm -rf」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * decLove() を呼び出し、親愛度を -1（実効 -5）低下させる。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult（angry リアクション）、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private rmrf(msg: Message): boolean | HandlerResult {
		if (!msg.includes(['rm -rf'])) return false;

		msg.friend.decLove();

		return {
			reaction: 'angry'
		};
	}

	/**
	 * 「shutdown」ハンドラ（現在コメントアウトで無効）
	 *
	 * @remarks
	 * 親愛度への影響はなく、セリフのみ返す。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は HandlerResult（confused リアクション）、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private shutdown(msg: Message): boolean | HandlerResult {
		if (!msg.includes(['shutdown'])) return false;

		msg.reply(serifs.core.shutdown);

		return {
			reaction: 'confused'
		};
	}
}

/**
 * @packageDocumentation
 *
 * 自動絵文字リアクションモジュール
 *
 * ホームタイムラインのノートを監視し、キーワードや絵文字に応じて
 * 自動的にリアクション（カスタム絵文字）を付与する。
 *
 * @remarks
 * - NOTE: Bot のノート・メンション付きノート・自己リプライ以外のリプライはスルーする。
 * - NOTE: フォロワー限定+CW付きは開かない（深刻な内容が多い為）。
 *       それ以外のCW付きは50%で開く。
 * - NOTE: フォロワー限定ノートは50%の確率でリアクションをスキップする。
 * - NOTE: リアクションまでの待機時間は、テキスト長・CW有無・親愛度によって変動する。
 * - NOTE: 1日に同じユーザーへのリアクション数が3を超えると、確率的にスキップされる。
 * - NOTE: `activeFactor` が低い場合はキーワード判定前にスキップされることがある。
 * - NOTE: 長い文章ほどスキップ率が上がる（30文字超で5%〜、51文字以降は+2%/文字）。
 * - NOTE: 前回の投稿から14日以上空いたユーザーの投稿には、キーワード判定とは別に
 *       `:ohisasiburidesu:` をリアクションする（friend に最終投稿日時を記録し、
 *       必要なときだけ `users/notes` で直前の投稿を確認する）。
 *       直前の投稿がサーバの追跡期間中のものかは `users/show` の
 *       `isTracked` / `trackedSince`（もこきー拡張）で確認する。
 *
 * @public
 */
import autobind from 'autobind-decorator';
import { parse } from 'twemoji-parser';
const delay = require('timeout-as-promise');

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
import includes from '@/utils/includes';
import config from '@/config';
import { mecab } from '@/modules/keyword/mecab';
import { hankakuToZenkaku, katakanaToHiragana } from '@/utils/japanese';
import getDate from '@/utils/get-date';
import { needsOhisasiburiCheck, shouldReactOhisasiburi, TrackingInfo } from '@/utils/ohisasiburi';

/**
 * 自動絵文字リアクションモジュールクラス
 *
 * @remarks
 * ホームTLのストリームを監視し、条件にマッチするノートにリアクションする。
 * mentionHook は使用せず、全てストリームイベントで動作する。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'emoji-react';

	/** ホームタイムラインのストリーム接続 */
	private htl: ReturnType<Stream['useSharedConnection']>;

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * ホームTLのストリームに接続し、ノート受信イベントを監視する。
	 * 空オブジェクトを返すため、mentionHook 等は登録しない。
	 *
	 * @returns 空のフック登録オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection('homeTimeline');
		this.htl.on('note', this.onNote);

		return {};
	}

	/**
	 * MeCab を使った単語マッチ確認
	 *
	 * @remarks
	 * テキストを形態素解析し、指定された単語が表層形の前方・後方一致するかを確認する。
	 * 人名は除外される。半角→全角変換、カタカナ→ひらがな変換を行って比較する。
	 *
	 * @param text - 確認対象のテキスト
	 * @param word - マッチさせたい単語（文字列または文字列配列）
	 * @returns マッチした場合 `true`
	 * @public
	 */
	public async checkMecab(text: string, word: string | string[]): Promise<boolean> {
		const tokens = await mecab(text, config.mecab, config.mecabDic, config.mecabCustom);
		if (typeof word === "string") word = [word];
		word = word.map(word => katakanaToHiragana(word).toLowerCase());
		const keywordsInThisNote = tokens.filter(token => token[0] && token[3] !== '人名' && (word as string[]).some(w => {
				const token0 = katakanaToHiragana(hankakuToZenkaku(token[0])).toLowerCase()
				return token0.startsWith(w) || token0.endsWith(w);
			}
		));
		return keywordsInThisNote.length > 0
	}

	/**
	 * 久しぶりの投稿かどうかを判定し、該当すれば `:ohisasiburidesu:` をリアクションする
	 *
	 * @remarks
	 * - friend の `lastNoteAt`（ホームTLで最後に観測した投稿日時）を更新する。
	 * - 記録が14日未満なら API を呼ばずに終了する。
	 * - 記録がない、または14日以上前なら `users/notes` で今回より前の投稿を1件取得し、
	 *   その投稿日時が14日以上前なら久しぶりと判定する（ホームTLに流れなかった投稿も考慮できる）。
	 * - 直前の投稿が「サーバがこのユーザーの投稿を取り込んでいた期間」のものである保証は、
	 *   `users/show` が返す追跡情報（`isTracked` / `trackedSince`）で行う
	 *   （{@link shouldReactOhisasiburi}）。追跡開始より前の投稿（フォロー前に
	 *   誰かのリノートなどで取り込まれたもの）は除外される。
	 *   サーバ側の情報なので friend に記録がないユーザーでも初回から判定できる。
	 *
	 * @param note - 受信ノート
	 * @internal
	 */
	@autobind
	private async checkOhisasiburi(note: Note) {
		if (!note.createdAt || !note.user?.id) return;
		const friend = this.ai.lookupFriend(note.user.id);
		if (!friend) return;

		const recorded = friend.doc.lastNoteAt;
		// 今回の投稿日時を記録（古い投稿が後から流れてきた場合は上書きしない）
		if (!recorded || new Date(recorded).getTime() < new Date(note.createdAt).getTime()) {
			friend.doc.lastNoteAt = note.createdAt;
			friend.save();
		}

		if (!needsOhisasiburiCheck(recorded, note.createdAt)) return;

		const previous = await this.ai.api('users/notes', {
			userId: note.user.id,
			untilId: note.id,
			limit: 1,
			includeReplies: true,
			includeMyRenotes: true,
		}) as { id?: string; createdAt?: string }[] | null;
		if (!previous?.[0]?.createdAt) return;

		const tracking = await this.ai.api('users/show', { userId: note.user.id }) as TrackingInfo | null;
		if (!shouldReactOhisasiburi(previous[0], tracking, note.createdAt)) return;

		this.log(`Ohisasiburi - @${note.user.username} (last: ${previous[0].createdAt}, trackedSince: ${tracking?.trackedSince})`);
		await delay(3000 + Math.round(Math.random() * 2000));
		this.ai.api('notes/reactions/create', {
			noteId: note.id,
			reaction: ':ohisasiburidesu:',
		});
	}

	/**
	 * ノート受信時のハンドラ
	 *
	 * @remarks
	 * ホームTLの各ノートに対し、以下の順序で判定を行う:
	 *
	 * 1. **前段フィルタ**: Bot・メンション付き・他者への返信・CW・公開範囲のチェック
	 *    （久しぶり判定は本文なし・CW付きでも行い、公開範囲フィルタより前に実行する）
	 * 2. **即座判定のキーワード**: 退勤、おはよう、おやすみ、こんにちは、こんばんは
	 * 3. **短文特殊判定** (9文字以内): 暇、眠い（時刻表示付きリアクション）
	 * 4. **activeFactor チェック**: 低活動度の場合はここでスキップ
	 * 5. **カスタム絵文字検出**: `mk` or `pizza_` を含む絵文字をそのままリアクション
	 * 6. **新年リアクション**: 1/1 限定
	 * 7. **長文スキップ判定**: 30文字超で確率的スキップ
	 * 8. **キーワード判定**: ピザ、カンピロバクター、つらい、もこ 等
	 *
	 * @param note - 受信ノート
	 * @internal
	 */
	@autobind
	private async onNote(note: Note) {
		// Botはスルー これで自分自身もスルーする
		if (note.user.isBot) return;
		// リプライ先が自分じゃない場合はスルー
		if (note.reply != null && note.reply.user?.id !== note.user?.id) return;
		// (自分または他人問わず)メンションっぽかったらスルー
		if (note.text?.includes('@')) return;

		// 久しぶりの投稿なら :ohisasiburidesu: を付ける（通常のキーワード判定は続行）
		this.checkOhisasiburi(note).catch((e) => this.log(`ohisasiburi check failed: ${e}`));

		// 中身がなければスルー
		if (note.text == null) return;

		// 公開範囲フォロワーでcw付きは深刻な物が多い為開かない
		if (note.visibility === 'followers' && note.cw != null) return;

		// そうじゃない場合、もこチキくんは50%の確率でCWを開いてくれる
		// ただし空白CWは開かない
		if (note.cw != null && (!note.cw.trim() || note.cw.trim().toLowerCase() == "cw" || Math.random() < 0.5)) return;

		// 公開範囲フォロワーの場合、50%でリアクションしない
		if (note.visibility === 'followers' && Math.random() < 0.5) return;

		/**
		 * リアクション実行関数
		 *
		 * @remarks
		 * 待機時間を計算してからリアクションAPIを呼び出す。
		 * 待機時間は以下の要素で決まる:
		 * - 基本: 3.5秒
		 * - CW付き: +2秒
		 * - 30文字超: +0.1秒/文字（最大+6.8秒）
		 * - 親愛度: 好感度1あたり0.2%短縮（最大20%短縮）
		 * - activeFactor: 低いほど遅延増加
		 * - 1日のリアクション数: 3回超で確率的にスキップ
		 *
		 * @param reaction - リアクション絵文字
		 * @param immediate - trueの場合は待機なしで即座にリアクション
		 */
		const react = async (reaction: string, immediate = false) => {
			if (!immediate) {
				// 絵文字をつけるまでの時間は3.5 ~ 6.5秒でゆらぎをつける
				let waitTime = 3500;

				// CWがあるなら、開く時間を考慮して +2 ~ +4秒
				if (note.cw) {
					waitTime += 2000;
				}

				// 30文字を超えている場合は、長ければ長いほど遅らせる
				// 1文字につき、+0.1~0.2秒
				// 最大増加時間は 98文字の +6.8 ~ +13.6秒
				if ((note.text?.length || 0) > 30) {
					waitTime += Math.min((note.text?.replaceAll(/:\w+:/g, "☆").length || 0) - 30, 68) * 100;
				}

				// 対象ユーザの好感度1につき、0.2%短縮
				// 最大 100 (★7) で 20%
				const friend = this.ai.lookupFriend(note.user.id);
				if (friend) {
					// 一日に反応した数が多ければ、反応率を下げる
		const today = getDate();

		if (friend.doc.lastReactAt != today) {
			friend.doc.todayReactCount = 0;
			friend.doc.lastReactAt = today;
		}
		if (friend.doc.todayReactCount && friend.doc.todayReactCount > 3) {
			if (Math.random() > 0.7 ** Math.floor((friend.doc.todayReactCount - 2) / 2)) {
				return;
			}
		}
					friend.doc.todayReactCount = (friend.doc.todayReactCount ?? 0) + 1;

					waitTime = Math.round(waitTime * (1 - (0.002 * Math.min(friend.love, 100))));
				}

				// activeFactor が低いほど待機時間が伸びる
				waitTime = waitTime * Math.max(0.6 / this.ai.activeFactor, 1);

				await delay(waitTime + Math.round(Math.random() * Math.max(1 / this.ai.activeFactor, 1) * (waitTime + 500)));
			}
			this.ai.api('notes/reactions/create', {
				noteId: note.id,
				reaction: reaction
			});
		};

		// --- 即座判定のキーワード（activeFactor に依存しない） ---
		if (includes(note.text, ['taikin', '退勤', 'たいきん', 'しごおわ'])) return react(':otukaresama:');
		if (includes(note.text, ['おはよ', 'ohayo', 'pokita', 'おきた', '起きた', 'おっは', 'ぽきた']) && note.text?.length <= 30 && !includes(note.text, ['が起きた', 'がおきた'])) return react(':mk_oha:');
		if (includes(note.text, ['おやす', 'oyasu', 'poyasimi', 'ぽやしみ']) && note.text?.length <= 30 && !includes(note.text, ['ちゃんねる'])) return react(':oyasumi2:');
		if (note.text.length <= 9) {
			const textWithoutDash = note.text.replaceAll('ー', '');
			if (includes(textWithoutDash, ['ひま'])) return react(':mkchicken_myonmyon:');
			// 「眠い」系は現在時刻に応じた絵文字で反応
			if (includes(textWithoutDash, ['すや', 'ねみ', 'ねむ'])) {
				const hour = new Date().getHours();
				if (hour === 0) return react(':mou_zerozi_dasi_iikagen_ni_nero:');
				if (hour === 12) return react(':mou_jyuunizi_dasi_iikagen_ni_nero:');
				const hourlyReactions: Record<number, string> = {
					1: ':mou_ichizi_dasi_iikagen_ni_nero:',
					2: ':mou_nizi_dasi_iikagen_ni_nero:',
					3: ':mou_sanzi_dasi_iikagen_ni_nero:',
					4: ':mou_yozi_dasi_iikagen_ni_nero:',
					5: ':mou_gozi_dasi_iikagen_ni_nero:',
					6: ':mou_rokuzi_dasi_iikagen_ni_nero:',
					7: ':mou_sitizi_dasi_iikagen_ni_nero:',
					8: ':mou_hatizi_dasi_iikagen_ni_nero:',
					9: ':mou_kuzi_dasi_iikagen_ni_nero:',
					10: ':mou_jyuzi_dasi_iikagen_ni_nero:',
					11: ':mou_jyuuichizi_dasi_iikagen_ni_nero:'
				};
				const normalizedHour = hour % 12;
				const reaction = hourlyReactions[normalizedHour];
				if (reaction) return react(reaction);
			}
		}

		if (includes(note.text, ['こんにちは', 'konnichiha']) && note.text?.length <= 30) {
			return react(Math.random() < (2 / 3) ? ':konnichiha_irasutoya:' : ':konnichiha2_irasutoya:');
		}
		if (includes(note.text, ['こんばんは', 'konbanha']) && note.text?.length <= 30) {
			return react(Math.random() < (2 / 3) ? ':konbanha_irasutoya:' : ':konbanha2_irasutoya:');
		}

		// --- activeFactor によるスキップ判定 ---
		if (Math.random() > this.ai.activeFactor * 1.2) return;

		// --- カスタム絵文字検出（mk_*、pizza_*）---
		let customEmojis = note.text.match(/:([^\n:]+?):/g)?.filter((x) => (x.includes("mk") || x.includes("pizza_")) && !x.includes("rank") && !x.includes("kill"));
		if (customEmojis && customEmojis.length > 0) {
			// カスタム絵文字が複数種類ある場合はランダム
			customEmojis = customEmojis.sort(() => Math.random() - 0.5);

			let emoji = customEmojis[0];

			this.log(`Custom emoji detected - ${emoji}`);

			return react(emoji);
		}

		/* Unicode絵文字のオウム返しリアクション（現在無効）
		const emojis = parse(note.text).map(x => x.text);
		if (emojis.length > 0) {
			if (!emojis.every((val, i, arr) => val === arr[0])) return;
			this.log(`Emoji detected - ${emojis[0]}`);
			let reaction = emojis[0];
			switch (reaction) {
				case '✊': return react('🖐', true);
				case '✌': return react('✊', true);
				case '🖐': case '✋': return react('✌', true);
			}
			return react(reaction);
		}*/

		// --- キーワード反応 ---

		// 新年（1/1限定）
		const now = new Date();
		if (now.getMonth() === 0 && now.getDate() === 1) {
			if (includes(note.text, ['あけ', 'おめ', 'あけまして', 'おめでとう', 'happynewyear'])) return react(':supertada:');
		}

		// 長い文章には反応しないことがあるようにする
		// 30-50文字 : スルー率5% / 51文字以降は1文字度にスルー率+2%
		if (Math.random() < (note.text?.replaceAll(/:\w+:/g, "☆").length < 30 ? 0 : note.text?.replaceAll(/:\w+:/g, "☆").length < 50 ? 0.05 : 0.05 + (note.text?.length - 50) / 50)) return;

		if (includes(note.text, ['ぴざ', 'pizza'])) return react(':itspizzatime:');
		if (includes(note.text, ['かんぴろばくたー', 'campylobacter'])) return react(':campylobacter_mottenaidesu:');
		if ((includes(note.text, ['帰りたい', 'かえりたい'])) || (includes(note.text, ['つら', 'しんど', 'sad', '泣い']) && (await this.checkMecab(note.text, ['つら', 'しんど', 'sad', 'sadrain', '泣い'])))) return react(':mkchicken_petthex:');
		if (includes(note.text, ['むいみ', '無意味', 'muimi']) && includes(note.text, ['もの', 'mono', '物'])) return react(':osiina:');
		if (includes(note.text, ['たからくじ', '宝くじ', 'takarakuji']) && includes(note.text, ['あた', 'ata', '当'])) return react(':201000000000:');
		if (includes(note.text, ['もこもこ', 'mokomoko'])) return react(':mokomoko:');
		if (includes(note.text, ['めつ', '滅', 'metu']) && !includes(note.text, ['滅茶', '滅多', '滅レ'])) return react(':metu:');
		if ((note.text?.includes('伸び') || note.text?.includes('のび') || note.text?.includes('ノビ')) && note.text?.length > 3 && (await this.checkMecab(note.text, ['のび','伸び']))) return react(':mk_ultrawidechicken:');
		if (includes(note.text, ['嘘']) && Math.random() < 0.5 && note.text?.length <= 30 && !includes(note.text, ['つく', 'つき', '吐き', '吐く'])) return react(':sonnano_uso:');
		if (includes(note.text, ['もこ', 'niwatori_kun']) && note.text?.length > 3 && (includes(note.text, ['niwatori_kun']) || await this.checkMecab(note.text, 'もこ'))) {
			// もこチキ関連リアクションをランダムに選択
			let reactionList = [] as string[];
			if (!includes(note.text, ["顔", "かお"])) {
				reactionList.push(':mk_chicken_t:');
			}
			if (!includes(note.text, ["ゆっくり"])) {
				reactionList.push(':mk_yukkuriface:');
			}
			if (!includes(note.text, ["ロー"]) && !includes(note.text, ["ポリ"])) {
				reactionList.push(':mk_lowpoly:');
			}
			if (reactionList.length > 0) return react(reactionList[Math.floor(reactionList.length * Math.random())]);
		}
		if (includes(note.text, ['hato', 'hohohoo'])) return react(':real_hato_kokekokko:');
	}
}

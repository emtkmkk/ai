/**
 * @packageDocumentation
 *
 * noting モジュール
 *
 * 一定間隔でランダムな投稿（つぶやき）を行うモジュール。
 * セリフ・アイテム・学習キーワードから話題を選んで投稿する。
 *
 * @remarks
 * - `config.notingEnabled` が `false` の場合は無効
 * - 5分間隔でランダム判定を行い、投稿するかを決定
 * - 昼（12時）や夜（17〜24時）は投稿確率が高くなる
 * - {@link 藍.activeFactor} に連動して確率が変動する
 * - 投稿のたびに activeFactor を微減させる
 *
 * @internal
 */
import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import { genItem } from '@/vocabulary';
import * as loki from 'lokijs';
import config from '@/config';

export default class extends Module {
	public readonly name = 'noting';

	/** keyword モジュールが学習したキーワードのコレクション（共有） */
	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	/**
	 * モジュールをインストールし、ランダム投稿タイマーを設定する
	 *
	 * @remarks
	 * `config.notingEnabled === false` の場合は何もしない。
	 * 5分間隔で乱数判定を行い、投稿するかを決定する。
	 * 投稿確率は時間帯と activeFactor によって変わる:
	 * - 昼（12時）・夜（17〜24時）: 10% × activeFactor
	 * - その他: 2% × activeFactor
	 *
	 * @returns 空のインストール結果（フックなし）
	 * @internal
	 */
	@autobind
	public install() {
		if (config.notingEnabled === false) return {};

		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});

		setInterval(() => {
			const hours = new Date().getHours();
			// 昼・夜は投稿確率が高い
			const rnd = ((hours === 12 || (hours > 17 && hours < 24)) ? 0.10 : 0.02) * this.ai.activeFactor;
			if (Math.random() < rnd) {
				this.post();
			}
		}, 1000 * 60 * 5);

		return {};
	}

	/**
	 * ランダムに投稿内容を選び、投稿する
	 *
	 * @remarks
	 * 投稿内容は3カテゴリからランダムに選択:
	 * - 定型セリフ（33%）: activeFactor 微減（0.005）
	 * - アイテム系（33%）: activeFactor 微減（0.01）
	 * - 話題キーワード（33%）: activeFactor 微減（0.02）
	 *
	 * @internal
	 */
	@autobind
	private post() {
		let localOnly = false;
		const notes = [
			...serifs.noting.notes,
		];
		const itemNotes = [
			() => {
				const item = genItem();
				return serifs.noting.want(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.see(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.expire(item);
			},
		];
		const themeNotes = [
			() => {
				const words = this.learnedKeywords.find().filter((x) => x.keyword.length >= 3);
				const word = words ? words[Math.floor(Math.random() * words.length)].keyword : undefined;
				return serifs.noting.talkTheme(word);
			},
		];

		let note;
		let channel;

		if (Math.random() < 0.333) {
			// 定型セリフ
			if (config.randomPostLocalOnly) localOnly = true;
			if (config.randomPostChannel) channel = config.randomPostChannel;
			this.ai.decActiveFactor(0.005);
			note = notes[Math.floor(Math.random() * notes.length)];
		} else {
			if (Math.random() < 0.5) {
				// アイテム系セリフ
				this.ai.decActiveFactor(0.01);
				note = itemNotes[Math.floor(Math.random() * itemNotes.length)];
			} else {
				// 話題キーワード
				this.ai.decActiveFactor(0.02);
				note = themeNotes[0];
			}
		}

		// TODO: 季節に応じたセリフ

		this.ai.post({
			text: typeof note === 'function' ? note() : note,
			localOnly,
			...(channel ? { channelId: channel } : {}),
		});
	}
}

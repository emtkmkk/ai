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
import { pickFromBag } from '@/utils/shuffle-bag';

/** 定期投稿の永続データ */
type NotingData = {
	/** 一巡中にすでに出た定型セリフ */
	notesUsed?: string[];
};

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

		// NOTE: 導入時はリバーシの案内以外を出た扱いにし、次の定型セリフで必ずリバーシの案内を出す
		const data: NotingData = this.getData() ?? {};
		if (data.notesUsed == null) {
			const notesUsed = this.fixedNotes().map(note => note.text).filter(text => !text.includes('リバーシ'));
			this.setData({ ...data, notesUsed });
		}

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
	/**
	 * 定型セリフ（サーバー機能の解説はチャンネル、bot 自身の案内は通常の定期投稿として扱う）
	 *
	 * @internal
	 */
	private fixedNotes() {
		return [
			...serifs.noting.notes.map(text => ({ text, server: true })),
			...serifs.noting.botNotes.map(text => ({ text, server: false })),
		];
	}

	@autobind
	private post() {
		let localOnly = false;
		const data: NotingData = this.getData() ?? {};
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
			// 定型セリフ（一度出たものは、他のすべてが出るまで出さない）
			const { item: selected, used } = pickFromBag(this.fixedNotes(), note => note.text, data.notesUsed ?? []);
			this.setData({ ...data, notesUsed: used });
			if (selected.server) {
				if (config.randomPostLocalOnly) localOnly = true;
				if (config.randomPostChannel) channel = config.randomPostChannel;
			}
			this.ai.decActiveFactor(0.005);
			note = selected.text;
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

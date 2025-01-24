import autobind from 'autobind-decorator';
import { parse } from 'twemoji-parser';
const delay = require('timeout-as-promise');

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
import includes from '@/utils/includes';

export default class extends Module {
	public readonly name = 'emoji-react';

	private htl: ReturnType<Stream['useSharedConnection']>;

	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection('homeTimeline');
		this.htl.on('note', this.onNote);

		return {};
	}

	@autobind
	private async onNote(note: Note) {
		// Botはスルー これで自分自身もスルーする
		if (note.user.isBot) return;
		// リプライ先が自分じゃない場合はスルー
		if (note.reply != null && note.reply.user?.id !== note.user?.id) return;
		// 中身がなければスルー
		if (note.text == null) return;
		// (自分または他人問わず)メンションっぽかったらスルー
		if (note.text.includes('@')) return;

		// 公開範囲フォロワーでcw付きは深刻な物が多い為開かない
		if (note.visibility === 'followers' && note.cw != null) return;

		// そうじゃない場合、もこチキくんは50%の確率でCWを開いてくれる
		// ただし空白CWは開かない
		if (note.cw != null && (!note.cw.trim() || note.cw.trim().toLowerCase() == "cw" || Math.random() < 0.5)) return;

		// 公開範囲フォロワーの場合、50%でリアクションしない
		if (note.visibility === 'followers' && Math.random() < 0.5) return;

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
					waitTime = Math.round(waitTime * (1 - (0.002 * Math.min(friend.love, 100))));
				}

				waitTime = waitTime * Math.max(0.6 / this.ai.activeFactor, 1);

				await delay(waitTime + Math.round(Math.random() * Math.max(1 / this.ai.activeFactor, 1) * (waitTime + 500)));
			}
			this.ai.api('notes/reactions/create', {
				noteId: note.id,
				reaction: reaction
			});
		};

		if (includes(note.text, ['taikin', '退勤', 'たいきん', 'しごおわ'])) return react(':otukaresama:');
		if (includes(note.text, ['おはよ', 'ohayo', 'pokita', 'おきた', '起きた', 'おっは', 'ぽきた']) && note.text?.length <= 30 && !includes(note.text, ['が起きた', 'がおきた'])) return react(':mk_oha:');
		if (includes(note.text, ['おやす', 'oyasu', 'poyasimi', '寝る', 'ぽやしみ']) && note.text?.length <= 30 && !includes(note.text, ['ちゃんねる'])) return react(':oyasumi2:');

		if (Math.random() > this.ai.activeFactor * 1.2) return;

		let customEmojis = note.text.match(/:([^\n:]+?):/g)?.filter((x) => (x.includes("mk") || x.includes("pizza_")) && !x.includes("rank") && !x.includes("kill"));
		if (customEmojis && customEmojis.length > 0) {
			// カスタム絵文字が複数種類ある場合はランダム
			customEmojis = customEmojis.sort(() => Math.random() - 0.5);

			let emoji = customEmojis[0];

			this.log(`Custom emoji detected - ${emoji}`);

			return react(emoji);
		}

		/*const emojis = parse(note.text).map(x => x.text);
		if (emojis.length > 0) {
			// 絵文字が複数種類ある場合はキャンセル
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

		// キーワード反応
		// 新年
		const now = new Date();
		if (now.getMonth() === 0 && now.getDate() === 1) {
			if (includes(note.text, ['あけ', 'おめ', 'あけまして', 'おめでとう', 'happynewyear'])) return react(':supertada:');
		}

		// 長い文章には反応しないことがあるようにする
		// 30-50文字 : スルー率5% / 51文字以降は1文字度にスルー率+2%
		if (Math.random() < (note.text?.replaceAll(/:\w+:/g, "☆").length < 30 ? 0 : note.text?.replaceAll(/:\w+:/g, "☆").length < 50 ? 0.05 : 0.05 + (note.text?.length - 50) / 50)) return;

		if (includes(note.text, ['ぴざ', 'pizza'])) return react(':itspizzatime:');
		if (includes(note.text, ['かんぴろばくたー', 'campylobacter'])) return react(':campylobacter_mottenaidesu:');
		if (includes(note.text, ['つら', 'しんど', '帰りたい', 'かえりたい', 'sad'])) return react(':mkchicken_petthex:');
		if (includes(note.text, ['むいみ', '無意味', 'muimi']) && includes(note.text, ['もの', 'mono', '物'])) return react(':osiina:');
		if (includes(note.text, ['たからくじ', '宝くじ', 'takarakuji']) && includes(note.text, ['あた', 'ata', '当'])) return react(':201000000000:');
		if (includes(note.text, ['もこもこ'])) return react(':mokomoko:');
		if (includes(note.text, ['めつ', '滅', 'metu']) && !includes(note.text, ['滅茶', '滅多'])) return react(':metu:');
		if ((note.text?.includes('伸び') || note.text?.includes('のび') || note.text?.includes('ノビ')) && note.text?.length > 3) return react(':mk_ultrawidechicken:');
		if (includes(note.text, ['嘘']) && Math.random() < 0.5 && note.text?.length <= 30) return react(':sonnano_uso:');
		// もこだけ条件がゆるく反応しやすいので反応率を2/3に
		if (includes(note.text, ['もこ', 'niwatori_kun']) && !includes(note.text, ['もこみち', 'おもころ', 'もこう', 'もこれ', 'でもこ']) && (Math.random() < 0.667 || includes(note.text, ['無視'])) && note.text?.length > 3) {
			//ランダムに選択される
			let reactionList = [] as string[];
			if (!includes(note.text, ["顔", "かお"])) {
				reactionList.push(':mk_chicken_t:');
			} else if (!includes(note.text, ["ゆっくり"])) {
				reactionList.push(':mk_yukkuriface:');
			} else if (!includes(note.text, ["ロー"]) || !includes(note.text, ["ポリ"])) {
				reactionList.push(':mk_lowpoly:');
			}
			if (reactionList.length > 0) return react(reactionList[Math.floor(reactionList.length * Math.random())]);
		}
	}
}

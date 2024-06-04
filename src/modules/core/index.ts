import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { safeForInterpolate } from '@/utils/safe-for-interpolate';
import { checkNgWord } from '@/utils/check-ng-word';
import { acct } from '@/utils/acct';
import { genItem, itemPrefixes } from '@/vocabulary';
import Friend, { FriendDoc } from '@/friend';
import config from '@/config';

const titles = ['さん', 'くん', '君', 'ちゃん', '様', '先生'];

export default class extends Module {
	public readonly name = 'core';

	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	@autobind
	public install() {
		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});
		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.text) return false;

		const ret = (
			this.findData(msg) ||
			this.mergeData(msg) ||
			this.transferBegin(msg) ||
			this.transferEnd(msg) ||
			this.setName(msg) ||
			this.getLove(msg) ||
			this.getStatus(msg) ||
			(await this.getEmojiData(msg)) ||
			this.getInventory(msg) ||
			this.convertUnixtime(msg) ||
			this.getAdana(msg) ||
			this.getBananasu(msg) ||
			this.getActiveFactor(msg) ||
			this.mkckAbout(msg) ||
			this.modules(msg) ||
			this.version(msg)
		);

		return ret === true ? { reaction: "love" } : ret;
	}

	@autobind
	private findData(msg: Message) {
		if (msg.user.username !== config.master) return false
		if (!msg.text) return false;
		if (!msg.includes(['データ照会'])) return false;

		const doc = this.ai.friends.find({
			'user.username': { '$regex': new RegExp(msg.extractedText.replace("データ照会 ","")) }
		} as any) as any;

		if (doc == null) return { reaction: ":mk_hotchicken:" };

		const json = { ...doc }

		for (let key in json.user as any) {
            if (typeof json.user[key] === 'object' && json.user[key] !== null) {
                json.user[key] = "[Object]";
            }
        }

		const text = JSON.stringify(json, null, 2);

		if (text.length >= 7999) {
			console.log(text);
			return { reaction: ":mk_moyochicken:" };
		}

		msg.reply(`\`\`\`\n${text.length}\n\`\`\``, {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private mergeAndSum(obj1, obj2) {
		// 結果を格納する新しいオブジェクト
		const result = { ...obj1 };
	
		// obj2のキーと値を結果に追加、同じキーがあれば値を足し合わせる
		for (const key in obj2) {
		  if (result[key] != undefined) {
			if (Array.isArray(result[key]) && Array.isArray(obj2[key])) {
			  // 配列の場合は結合する
			  result[key] = result[key].concat(obj2[key]);
			} else if (typeof result[key] === 'number' && typeof obj2[key] === 'number') {
			  // 数値の場合は足し合わせる
			  result[key] += obj2[key];
			} else if (result[key] instanceof Date && obj2[key] instanceof Date) {
			  // 日付の場合は未来の日付を採用する
			  result[key] = result[key] > obj2[key] ? result[key] : obj2[key];
			} else if (typeof result[key] === 'object' && typeof obj2[key] === 'object' && !Array.isArray(result[key])) {
			  // オブジェクトの場合は再帰的にマージする
			  result[key] = this.mergeAndSum(result[key], obj2[key]);
			} else {
			  // 他の型の場合は後の方を採用する（ここでは単純に上書きするようにしています）
			  result[key] = obj2[key];
			}
		  } else {
			result[key] = obj2[key];
		  }
		}
	
		return result;
	}

	@autobind
	private mergeData(msg: Message) {
		if (msg.user.username !== config.master) return false
		if (!msg.text) return false;
		if (!msg.includes(['データ合体'])) return false;

		const ids = /データ合体 (\w{10}) (\w{10})/.exec(msg.extractedText)

		if (!ids?.[1]) return { reaction: ":mk_hotchicken:" };
		if (!ids?.[2]) return { reaction: ":mk_hotchicken:" };

		const doc1 = this.ai.lookupFriend(ids?.[1])

		if (doc1 == null) return { reaction: ":mk_hotchicken:" };

		const doc2 = this.ai.lookupFriend(ids?.[2])

		if (doc2 == null) return { reaction: ":mk_hotchicken:" };

		doc2.doc.name = doc2.name || doc1.name;
		for (let i = 0; i < ((doc1.love ?? 0) / 0.5); i++) {
			doc2.incLove(0.1, "merge")
		}
		doc2.doc.married = doc1.married || doc2.married;
		doc2.doc.perModulesData = this.mergeAndSum(doc1.doc.perModulesData, doc2.doc.perModulesData);
		doc2.doc.kazutoriData = this.mergeAndSum(doc1.doc.kazutoriData, doc2.doc.kazutoriData)
		doc2.save();

		const text = JSON.stringify(doc2, null, 2);

		if (text.length >= 7999) {
			console.log(text);
			return { reaction: ":mk_moyochicken:" };
		}

		msg.reply(`合体完了\n\`\`\`\n${text.length}\n\`\`\``, {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private transferBegin(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.includes(['引継', '引き継ぎ', '引越', '引っ越し'])) return false;

		const code = msg.friend.generateTransferCode();

		console.log("move account code generated : " + msg.user.id + " : " + code)

		msg.reply(serifs.core.transferCode(code), {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private transferEnd(msg: Message): boolean {
		if (!msg.extractedText) return false;
		if (!msg.extractedText.startsWith('「') || !msg.extractedText.endsWith('」')) return false;


		const code = msg.extractedText.substring(1, msg.text.length - 1);

		console.log("move account code : " + msg.user.id + " : " + code);

		const succ = msg.friend.transferMemory(code);

		if (succ) {
			console.log("move Success : " + msg.user.id);
			msg.reply(serifs.core.transferDone(msg.friend.name));
		} else {
			console.log("move Failed : " + msg.user.id);
			msg.reply(serifs.core.transferFailed);
		}

		return true;
	}

	@autobind
	private setName(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('って呼んで') && !(msg.includes(['あだ名', '名前', '呼び名']) && msg.includes(['忘れて', '忘れろ']))) return false;
		if (msg.text.startsWith('って呼んで')) return false;

		if ((msg.includes(['あだ名', '名前', '呼び名']) && msg.includes(['忘れて', '忘れろ']))) {
			msg.friend.updateName(null);
			msg.reply(serifs.core.setNameNull);
			return true;
		}

		const name = msg.extractedText.match(/^(.+?)って呼んで/)![1].trim();

		// 好感度が100（★7）を超えている場合、20文字までOK

		if ((msg.friend.love < 100 && name.length > 10) || (msg.friend.love >= 100 && name.length > 20)) {
			msg.reply(serifs.core.tooLong(name.length, msg.friend.love >= 100 ? 20 : 10));
			return true;
		}

		if (!safeForInterpolate(name)) {
			msg.reply(serifs.core.invalidName);
			return true;
		}

		if (!checkNgWord(name)) {
			msg.reply(serifs.core.ngName);
			return true;
		}

		const withSan = titles.some(t => name.endsWith(t));

		if (withSan) {
			msg.friend.updateName(name);
			msg.reply(serifs.core.setNameOk(name));
		} else {
			msg.reply(serifs.core.san).then(reply => {
				this.subscribeReply(msg.userId, reply.id, {
					name: name
				});
			});
		}

		return true;
	}

	@autobind
	private convertUnixtime(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('のunixtimeは')) return false;

		const timeStr = msg.extractedText.match(/^(.+?)のunixtimeは/)![1].trim();

		if (!isNaN(Date.parse(timeStr))) {
			const time = new Date(timeStr);
			msg.reply(serifs.core.unixtime(`${time.toString()}`, `${time.toISOString()}`, time.valueOf() / 1000));
		} else {
			msg.reply(serifs.core.invalidDate);
		}

		return true;
	}

	@autobind
	private getLove(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('好感度') && !msg.text.includes('懐き度')) return false;

		const lovep = msg.friend.love || 0;
		let love = "";
		let over = Math.floor(lovep / (100 / 7)) - 7;
		let point = (lovep / (100 / 7)).toFixed(2);
		love += lovep >= -29 ? "★" : "☆"
		love += lovep >= -10 ? "★" : "☆"
		love += lovep >= 0 ? "★" : "☆"
		love += lovep >= 5 ? "★" : "☆"
		love += lovep >= 20 ? "★" : "☆"
		love += lovep >= 50 ? "★" : "☆"
		love += lovep >= 100 ? "★" : "☆"
		love += over >= 1 ? "★".repeat(over) + "\n(★\\(" + point + "\\))" : ""

		msg.reply(serifs.core.getLove(msg.friend.name || 'あなた', love))

		return true;
	}

	@autobind
	private getStatus(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('ステータス')) return false;

		const lovep = msg.friend.love || 0;
		let love = "";
		let over = Math.floor(lovep / (100 / 7)) - 7;
		love += lovep >= -29 ? "★" : "☆"
		love += lovep >= -10 ? "★" : "☆"
		love += lovep >= 0 ? "★" : "☆"
		love += lovep >= 5 ? "★" : "☆"
		love += lovep >= 20 ? "★" : "☆"
		love += lovep >= 50 ? "★" : "☆"
		love += lovep >= 100 ? "★" : "☆"
		love += over >= 1 ? "+" + (over >= 2 ? over : "") : ""

		const kazutori = msg.friend.doc.kazutoriData?.playCount ? msg.friend.doc.kazutoriData?.winCount + ' / ' + msg.friend.doc.kazutoriData?.playCount + (msg.friend.doc.kazutoriData?.rate ? ` (${msg.friend.doc.kazutoriData?.rate})` : "") + (msg.friend.doc.kazutoriData?.medal ? "\nトロフィー : " + msg.friend.doc.kazutoriData?.medal : "") : undefined;

		msg.reply(serifs.core.getStatus(msg.friend.name, love, kazutori))

		return true;
	}

	@autobind
	private getInventory(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.friend.doc.kazutoriData?.inventory?.length) return false;
		if (!(msg.includes(['貰った', 'もらった', 'くれた']) && msg.includes(['もの', '物']))) return false;

		const inventory = [...msg.friend.doc.kazutoriData?.inventory].reverse();

		msg.reply(serifs.core.getInventory(msg.friend.name || 'あなた', inventory.join('\n')) + (
			msg.friend.doc.kazutoriData?.inventory?.length === 50
				? `\n\n沢山プレゼントがありますね！\n次に物を入手すると最も古い物が消えてしまうので注意してください！（次は「**${msg.friend.doc.kazutoriData?.inventory[0]}**」が消滅します。）`
				: msg.friend.doc.kazutoriData?.inventory?.length >= 35
					? `\n\n沢山プレゼントがありますね！\n**50**個を超えると古い物から消えてしまうので注意してください！（現在**${msg.friend.doc.kazutoriData?.inventory?.length}**個）`
					: ""
		))

		return true;
	}

	@autobind
	private getAdana(msg: Message): boolean {
		if (!msg.text) return false;
		if (!(msg.includes(['あだ名', 'あだな']))) return false;

		const genAdana = (): string => {
			let adana = "";
			if (Math.random() < 0.5) {
				adana = genItem();
			} else {
				if (Math.random() > 0.1) adana = itemPrefixes[Math.floor(Math.random() * itemPrefixes.length)];
				const words = this.learnedKeywords.find();
				const word = words ? words[Math.floor(Math.random() * words.length)].keyword : undefined;
				adana += word
			}
			if (Math.random() < 0.4) {
				adana += titles[Math.floor(Math.random() * titles.length)]
			}
			return adana;
		}

		const adanas = msg.includes(['たくさん', '沢山', 'いっぱい', '大量']) ? [genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana()] : [genAdana(), genAdana(), genAdana()]

		msg.reply(serifs.core.getAdana(adanas))

		return true;
	}

	@autobind
	private getBananasu(msg: Message): boolean {
		if (!msg.text) return false;
		if (!(msg.includes(['バナナス', 'バニャニャス']))) return false;
		let debug = false
		if (msg.includes(['-d'])) debug = true;

		let inputWord;
		if (/^[^\s]{1,10}(の|で)(たくさん)?(バナナス|バニャニャス|ばななす|ばにゃにゃす)/.test(msg.extractedText)) {
			inputWord = /^([^\s]+)(の|で)(たくさん)?(バナナス|バニャニャス|ばななす|ばにゃにゃす)/.exec(msg.extractedText)?.[1];
		}

		const words = this.learnedKeywords.find()?.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
		const exWords = words?.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
		const words2 = exWords?.filter((x) => x.keyword.length >= 4);
		const jpWords = exWords?.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
		const hirakanaWords = jpWords?.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));
		let word1error = false;
		let word2error = false;

		const bananasu = msg.includes(['たくさん', '沢山', 'いっぱい', '大量']) ? Array.from(new Set([this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error)])).filter((x) => x).join("\n") : this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error);

		msg.reply("\n" + (bananasu ? bananasu : "上手く思いつきませんでした。また今度試してみてください！"), { visibility: bananasu ? "public" : "home" });
		return true;
	}

	@autobind
	private async getEmojiData(msg: Message) {
		if (!msg.text) return false;
		if (!msg.text.includes('絵文字情報')) return false;

		const data = await this.ai.api('users/emoji-stats', {
			userId: msg.userId,
			limit: 20,
			localOnly: false,
		});

		if (!data) {
			return false;
		}

		if (!msg.user.host) {			//ローカル
			msg.reply(`
送った事がある絵文字の種類 : **${data.sentReactionsCount}** 種類
受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}** 種類

よく送る絵文字（累計） : 
${data.sentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

よく貰う絵文字（累計） : 
${data.receivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく送る絵文字 : 
${data.recentlySentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく貰う絵文字 : 
${data.recentlyReceivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}
`, { cw: `${acct(msg.user)} ${msg.friend.name || 'さん'}の絵文字情報（リアクション）` })
		} else {
			//リモート
			msg.reply(`
※リモートユーザの為、絵文字がうまく表示されない可能性、正しい情報が表示されない可能性があります。
絵文字がうまく表示されない場合はリモートで表示などのボタンを使用し、もこきーにて確認してください。

受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}** 種類

よく送る絵文字（累計） : 
${data.sentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

よく貰う絵文字（累計） : 
${data.receivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく送る絵文字 : 
${data.recentlySentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく貰う絵文字 : 
${data.recentlyReceivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}
`, { cw: `${acct(msg.user)} ${msg.friend.name || 'さん'}の絵文字情報（リアクション）` })
		}

		return true;
	}


	@autobind
	private modules(msg: Message) {
		if (!msg.text) return false;
		if (!msg.or(['modules'])) return false;

		let text = '\n```\n';

		for (const m of this.ai.modules) {
			text += `${m.name}\n`;
		}

		text += '```';

		msg.reply(text, {
			immediate: true
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private version(msg: Message) {
		if (!msg.text) return false;
		if (!msg.or(['v', 'version', 'バージョン'])) return false;

		msg.reply(`\n\`\`\`\nv${this.ai.version}\n\`\`\``, {
			immediate: true
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private mkckAbout(msg: Message) {
		if (!msg.text) return false;
		if (!msg.includes(['もこチキについて', 'もこもこチキンについて'])) return false;

		const friends = this.ai.friends.find() ?? [];
		const words = this.learnedKeywords.find();
		const baWords = words?.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
		const specialWords = words?.filter((x) => /^[!-\/:-@[-`{-~！？]/.test(x.keyword) || /[!-\/:-@[-`{-~！？]$/.test(x.keyword));
		const exWords = baWords?.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
		const words2 = exWords?.filter((x) => x.keyword.length >= 4);
		const jpWords = exWords?.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
		const hirakanaWords = jpWords?.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));
		msg.reply(`\n\`\`\`\n友達の人数 : ${friends.filter((x) => x.love && x.love >= 20).length}\n親友の人数 : ${friends.filter((x) => x.love && x.love >= 100).length}\n合計好感度 : ☆${Math.floor(friends.filter((x) => x.love).reduce((acc, cur) => acc + (cur.love ?? 0), 0) / (10 / 7)) / 10}\n\n数取り回数 : ${friends.filter((x) => x.kazutoriData?.winCount).reduce((acc, cur) => acc + (cur.kazutoriData?.winCount ?? 0), 0)}\nトロフィー発行数 : ${friends.filter((x) => x.kazutoriData?.medal).reduce((acc, cur) => acc + (cur.kazutoriData?.medal ?? 0), 0)}\n\n現在の機嫌 : ${Math.floor(this.ai.activeFactor * 100)}%\n\n覚えた言葉数 : ${words.length}\nバナナスに使う言葉数 : ${baWords.length - specialWords.length} + ${specialWords.length}\n英語以外で終わる言葉数 : ${jpWords.length}\n英語・漢字以外で終わる言葉数 : ${hirakanaWords.length}\n\`\`\``, {
			immediate: false
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private getActiveFactor(msg: Message) {
		if (!msg.text) return false;
		if (!msg.includes(['きげん', 'きもち', '機嫌', '気持ち'])) return false;

		msg.reply(`\n\`\`\`\n現在の機嫌 : ${Math.floor(this.ai.activeFactor * 1000) / 10}%\n\`\`\``, {
			immediate: false
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (msg.text == null) return;

		if (key !== msg.userId) {
			msg.reply(serifs.reminder.doneFromInvalidUser);
			return {
				reaction: 'confused'
			};
		}

		const done = () => {
			msg.reply(serifs.core.setNameOk(msg.friend.name));
			this.unsubscribeReply(key);
		};

		if (msg.text.includes('はい')) {
			msg.friend.updateName(data.name + 'さん');
			done();
			return { reaction: 'love' }
		} else if (msg.text.includes('いいえ')) {
			msg.friend.updateName(data.name);
			done();
			return { reaction: 'love' }
		} else {
			msg.reply(serifs.core.yesOrNo).then(reply => {
				this.subscribeReply(msg.userId, reply.id, data);
			});
			return { reaction: 'hmm' }
		}
	}
}

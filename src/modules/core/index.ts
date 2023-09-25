import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { safeForInterpolate } from '@/utils/safe-for-interpolate';
import { checkNgWord } from '@/utils/check-ng-word';
import { acct } from '@/utils/acct';

const titles = ['さん', 'くん', '君', 'ちゃん', '様', '先生'];

export default class extends Module {
	public readonly name = 'core';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.text) return false;

		return (
			this.transferBegin(msg) ||
			this.transferEnd(msg) ||
			this.setName(msg) ||
			this.getLove(msg) ||
			this.getStatus(msg) ||
			(await this.getEmojiData(msg)) ||
			this.getInventory(msg) ||
			this.modules(msg) ||
			this.version(msg)
		) ? { reaction: "love" } : false;
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
		if (!msg.text) return false;
		if (!msg.text.startsWith('「') || !msg.text.endsWith('」')) return false;
		

		const code = msg.text.substring(1, msg.text.length - 1);
		
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
		if (!msg.text.includes('って呼んで')) return false;
		if (msg.text.startsWith('って呼んで')) return false;

		const name = msg.extractedText.match(/^(.+?)って呼んで/)![1].trim();

		// 好感度が100（★7）を超えている場合、20文字までOK

		if ((msg.friend.love < 100 && name.length > 10) || (msg.friend.love >= 100 && name.length > 20)) {
			msg.reply(serifs.core.tooLong);
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
	private getLove(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('好感度')) return false;

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

		const kazutori = msg.friend.doc.kazutoriData?.playCount ? msg.friend.doc.kazutoriData?.winCount + ' / ' + msg.friend.doc.kazutoriData?.playCount : undefined;

		msg.reply(serifs.core.getStatus(msg.friend.name || 'あなた', love, kazutori))

		return true;
	}

	@autobind
	private getInventory(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.friend.doc.kazutoriData?.inventory?.length) return false;
		if (!(msg.includes(['貰った物', 'もらった', 'くれた']) && msg.includes(['もの', '物']))) return false;

		msg.reply(serifs.core.getInventory(msg.friend.name || 'あなた', msg.friend.doc.kazutoriData?.inventory.join('\n')))

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

		if (!msg.user.host) {
			//ローカル
			msg.reply(`
送った事がある絵文字の種類 : **${data.sentReactionsCount}** 種類
受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}** 種類

よく送る絵文字（累計） : 
${data.sentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}

よく貰う絵文字（累計） : 
${data.receivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}

最近よく送る絵文字 : 
${data.recentlySentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}

最近よく貰う絵文字 : 
${data.recentlyReceivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}
`, { cw: `${acct(msg.user)} ${msg.friend.name || 'さん'}の絵文字情報（リアクション）` })
		} else {
			//リモート
			msg.reply(`
※リモートユーザの為、絵文字がうまく表示されない可能性、正しい情報が表示されない可能性があります。
絵文字がうまく表示されない場合はリモートで表示などのボタンを使用し、もこきーにて確認してください。

受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}** 種類

よく送る絵文字（累計） : 
${data.sentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}

よく貰う絵文字（累計） : 
${data.receivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}

最近よく送る絵文字 : 
${data.recentlySentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}

最近よく貰う絵文字 : 
${data.recentlyReceivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/,"").replace(":","")})` : ''}`).join('\n')}
`, { cw: `${acct(msg.user)} ${msg.friend.name || 'さん'}の絵文字情報（リアクション）` })
		}

		return true;
	}


	@autobind
	private modules(msg: Message): boolean {
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

		return true;
	}

	@autobind
	private version(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.or(['v', 'version', 'バージョン'])) return false;

		msg.reply(`\`\`\`\nv${this.ai.version}\n\`\`\``, {
			immediate: true
		});

		return true;
	}

	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (msg.text == null) return;

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

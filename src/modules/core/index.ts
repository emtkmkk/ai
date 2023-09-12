import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { safeForInterpolate } from '@/utils/safe-for-interpolate';

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
			this.getEmojiData(msg) ||
			this.getInventory(msg) ||
			this.modules(msg) ||
			this.version(msg)
		) ? {reaction:"love"} : false;
	}

	@autobind
	private transferBegin(msg: Message): boolean  {
		if (!msg.text) return false;
		if (!msg.includes(['引継', '引き継ぎ', '引越', '引っ越し'])) return false;

		const code = msg.friend.generateTransferCode();

		msg.reply(serifs.core.transferCode(code));

		return true;
	}

	@autobind
	private transferEnd(msg: Message): boolean  {
		if (!msg.text) return false;
		if (!msg.text.startsWith('「') || !msg.text.endsWith('」')) return false;

		const code = msg.text.substring(1, msg.text.length - 1);

		const succ = msg.friend.transferMemory(code);

		if (succ) {
			msg.reply(serifs.core.transferDone(msg.friend.name));
		} else {
			msg.reply(serifs.core.transferFailed);
		}

		return true;
	}

	@autobind
	private setName(msg: Message): boolean  {
		if (!msg.text) return false;
		if (!msg.text.includes('って呼んで')) return false;
		if (msg.text.startsWith('って呼んで')) return false;

		const name = msg.text.match(/^(?:@\S+\s)?(.+?)って呼んで/)![1].trim();

		if (name.length > 10) {
			msg.reply(serifs.core.tooLong);
			return true;
		}

		if (/[@#\*:\(\)\[\]\s　]/.test(name)) {
			msg.reply(serifs.core.invalidName);
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
	private getLove(msg: Message): boolean  {
		if (!msg.text) return false;
		if (!msg.text.includes('好感度')) return false;
		
		const lovep = msg.friend.love || 0;
		let love = "";
		love += lovep >= 0 ? "★" : "☆"
		love += lovep >= 5 ? "★" : "☆"
		love += lovep >= 20 ? "★" : "☆"
		love += lovep >= 50 ? "★" : "☆"
		love += lovep >= 100 ? "★" : "☆"
		love += lovep >= 120 ? "+" + (lovep >= 140 ? (lovep/20) - 5 : "") : ""
		
		msg.reply(serifs.core.getLove(msg.friend.name || 'あなた',love))

		return true;
	}
	
	@autobind
	private getStatus(msg: Message): boolean  {
		if (!msg.text) return false;
		if (!msg.text.includes('ステータス')) return false;
		
		const lovep = msg.friend.love || 0;
		let love = "";
		love += lovep >= 0 ? "★" : "☆"
		love += lovep >= 5 ? "★" : "☆"
		love += lovep >= 20 ? "★" : "☆"
		love += lovep >= 50 ? "★" : "☆"
		love += lovep >= 100 ? "★" : "☆"
		love += lovep >= 120 ? "+" + (lovep >= 140 ? (lovep/20) - 5 : "") : ""
		
		const kazutori = msg.friend.doc.kazutoriData?.playCount ? msg.friend.doc.kazutoriData?.winCount + ' / ' + msg.friend.doc.kazutoriData?.playCount : undefined;
		
		msg.reply(serifs.core.getStatus(msg.friend.name || 'あなた',love, kazutori))

		return true;
	}
	
	@autobind
	private getInventory(msg: Message): boolean  {
		if (!msg.text) return false;
		if (!msg.friend.doc.kazutoriData?.inventory?.length) return false;
		if (!msg.text.includes('貰った物')) return false;

		msg.reply(serifs.core.getInventory(msg.friend.name || 'あなた', msg.friend.doc.kazutoriData?.inventory.join('\n')))

		return true;
	}
	
	@autobind
	private async getEmojiData(msg: Message)  {
		if (!msg.text) return false;
		if (!msg.text.includes('絵文字情報')) return false;
		
		const data = await this.ai.api('users/emoji-stats', {
			userId: msg.userId,
			limit: 12,
			localOnly: false,
		});
		const dataL = await this.ai.api('users/emoji-stats', {
			userId: msg.userId,
			limit: 12,
			localOnly: true,
		});
		
		if (!data || !dataL){
			return false;
		}
		
		if (!msg.user.host){
			//ローカル
			msg.reply(`\n
			${msg.friend.name || 'あなた'}の絵文字情報（リアクション）\n
			\n
			送った事がある絵文字の種類 : **${dataL.sentReactionsCount}** (**${data.sentReactionsCount}**)\n
			受け取った事がある絵文字の種類 : **${dataL.receivedReactionsCount}** (**${data.receivedReactionsCount}**)\n
			\n
			よく送る絵文字（累計） : \n
			${data.sentReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			\n
			よく貰う絵文字（累計） : \n
			${data.receivedReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			\n
			最近よく送る絵文字 : \n
			${data.recentlySentReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			\n
			最近よく貰う絵文字 : \n
			${data.recentlyReceivedReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			`)
		} else {
			//リモート
			msg.reply(`\n
			${msg.friend.name || 'あなた'}の絵文字情報（リアクション）\n
			※リモートユーザの為、絵文字がうまく表示されない可能性、正しい情報が表示されない可能性があります。\n
			絵文字がうまく表示されない場合はリモートで表示などのボタンを使用し、もこきーにて確認してください。\n
			\n
			送った事がある絵文字の種類 : **${data.sentReactionsCount}**\n
			受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}**\n
			\n
			よく送る絵文字（累計） : \n
			${data.sentReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			\n
			よく貰う絵文字（累計） : \n
			${data.receivedReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			\n
			最近よく送る絵文字 : \n
			${data.recentlySentReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			\n
			最近よく貰う絵文字 : \n
			${data.recentlyReceivedReactions.map((x, i) => `第${i+1}位 (${x.count}回) ${x.name}`).join('\n')}
			`)
		}

		return true;
	}


	@autobind
	private modules(msg: Message): boolean  {
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
	private version(msg: Message): boolean  {
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
			return {reaction:'love'}
		} else if (msg.text.includes('いいえ')) {
			msg.friend.updateName(data.name);
			done();
			return {reaction:'love'}
		} else {
			msg.reply(serifs.core.yesOrNo).then(reply => {
				this.subscribeReply(msg.userId, reply.id, data);
			});
			return {reaction:'hmm'}
		}
	}
}

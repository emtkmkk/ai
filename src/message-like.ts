import 藍 from './ai';
import Friend from './friend';
const delay = require('timeout-as-promise');

export default class MessageLike {
	private ai: 藍;
	private messageOrNote: any;
	public isMessage: boolean;

	public get id() {
		return this.messageOrNote.id;
	}

	public get user() {
		return this.messageOrNote.user;
	}

	public get userId() {
		return this.messageOrNote.userId;
	}

	public get text() {
		return this.messageOrNote.text;
	}

	public get replyId() {
		return this.messageOrNote.replyId;
	}

	public friend: Friend;

	constructor(ai: 藍, messageOrNote: any, isMessage: boolean) {
		this.ai = ai;
		this.messageOrNote = messageOrNote;
		this.isMessage = isMessage;

		this.friend = new Friend(ai, { user: this.user });

		// メッセージなどに付いているユーザー情報は省略されている場合があるので完全なユーザー情報を持ってくる
		this.ai.api('users/show', {
			userId: this.userId
		}).then(user => {
			this.friend.updateUser(user);
		});
	}

	public reply = async (text: string, cw?: string) => {
		console.log(`sending reply of ${this.id} ...`);

		await delay(2000);

		if (this.isMessage) {
			return await this.ai.sendMessage(this.messageOrNote.userId, {
				text: text
			});
		} else {
			return await this.ai.post({
				replyId: this.messageOrNote.id,
				text: text,
				cw: cw
			});
		}
	}
}

import autobind from "autobind-decorator";
import 藍 from "@/ai";
import IModule from "@/module";
import getDate from "@/utils/get-date";
import { User } from "@/misskey/user";
import { genItem } from "@/vocabulary";
import { acct } from "@/utils/acct";
import { checkNgWord } from "@/utils/check-ng-word";

export type FriendDoc = {
	userId: string;
	user: User;
	name?: string | null;
	love?: number;
	kazutoriData?: any;
	lastLoveIncrementedAt?: string;
	todayLoveIncrements?: number;
	lastLoveIncrementedTime?: string;
	cooldownLoveIncrementKey?: string[];
	perModulesData?: any;
	married?: boolean;
	transferCode?: string;
	isWelcomeMessageSent?: boolean;
	linkedAccounts?: string[];
};

export default class Friend {
	private ai: 藍;

	public get userId() {
		return this.doc.userId;
	}

	public get name() {
		return this.doc.name;
	}

	public get love() {
		return this.doc.love || 0;
	}

	public get married() {
		return this.doc.married;
	}

	public doc: FriendDoc;

	constructor(ai: 藍, opts: { user?: User; doc?: FriendDoc }) {
		this.ai = ai;

		if (opts.user) {
			const exist = this.ai.friends.findOne({
				userId: opts.user.id,
			});

			if (exist == null) {
				const inserted = this.ai.friends.insertOne({
					userId: opts.user.id,
					user: opts.user,
				});

				if (inserted == null) {
					throw new Error("Failed to insert friend doc");
				}

				this.doc = inserted;
			} else {
				this.doc = exist;
				this.doc.user = { ...this.doc.user, ...opts.user };
				if (this.doc.name && !checkNgWord(this.doc.name)) this.doc.name = null;
				this.save();
			}
		} else if (opts.doc) {
			this.doc = opts.doc;
		} else {
			throw new Error("No friend info specified");
		}
	}

	@autobind
	public updateUser(user: Partial<User>) {
		this.doc.user = {
			...this.doc.user,
			...user,
		};
		this.save();
	}

	@autobind
	public getPerModulesData(module: IModule) {
		if (this.doc.perModulesData == null) {
			this.doc.perModulesData = {};
			this.doc.perModulesData[module.name] = {};
			this.save();
		} else if (this.doc.perModulesData[module.name] == null) {
			this.doc.perModulesData[module.name] = {};
			this.save();
		}

		return this.doc.perModulesData[module.name];
	}

	@autobind
	public setPerModulesData(module: IModule, data: any) {
		if (this.doc.perModulesData == null) {
			this.doc.perModulesData = {};
		}

		this.doc.perModulesData[module.name] = data;

		this.save();
	}

	@autobind
	public incLove(amount = 1, key?) {
		amount = amount * 5;

		// 親愛度100以上の場合、量に応じて上がる量が軽減
		if ((this.doc.love || 0) > 100)
			amount =
				Math.ceil((amount / (((this.doc.love || 0) * 2) / 100 - 1)) * 100) /
				100;

		const today = getDate();

		if (this.doc.lastLoveIncrementedAt != today) {
			this.doc.todayLoveIncrements = 0;
		}

		const now = new Date();

		// 100を超えている場合、同じ種類の好感度増加は10分間に1回
		if (key && key != "merge" && (this.doc.love || 0) >= 100) {
			if (
				!this.doc.cooldownLoveIncrementKey ||
				this.doc.lastLoveIncrementedTime !==
					("" + now.getHours() + now.getMinutes()).slice(0, 3)
			) {
				this.doc.cooldownLoveIncrementKey = [];
				this.doc.lastLoveIncrementedTime = (
					"" +
					now.getHours() +
					now.getMinutes()
				).slice(0, 3);
			}

			if (this.doc.cooldownLoveIncrementKey.includes(key)) {
				this.ai.log(
					`💗 ${this.userId} +0 (${this.doc.love || 0}) <${
						this.doc.lastLoveIncrementedTime
					} : ${key}>`
				);
				return;
			} else {
				this.doc.cooldownLoveIncrementKey.push(key);
			}
		}

		// 100を超えるまでは1日に上げられる親愛度は最大15
		if (
			key != "merge" &&
			this.doc.lastLoveIncrementedAt == today &&
			(this.doc.love || 0) < 100 &&
			(this.doc.todayLoveIncrements || 0) >= 15
		)
			return;

		// 100を超えた後は1日に上げられる親愛度は最大50
		if (
			key != "merge" &&
			this.doc.lastLoveIncrementedAt == today &&
			(this.doc.love || 0) >= 100 &&
			(this.doc.todayLoveIncrements || 0) >= 50
		)
			return;

		if (this.doc.love == null) this.doc.love = 0;

		amount = parseFloat(amount.toFixed(2));

		// x00を超えた時に感謝のメッセージを送信する
		if (
			key != "merge" &&
			(this.doc.love || 0) > 0 &&
			((this.doc.love || 0) % 100) + amount >= 100
		) {
			this.ai.sendMessage(this.doc.userId, {
				text: `${acct(this.doc.user)}\n${
					this.doc.name ? this.doc.name + "、" : ""
				}わらわと${"とっても".repeat(
					Math.floor((this.doc.love || 0) / 100)
				)}たくさん遊んでくれてうれしいのじゃ！\nこれからも仲良くしてほしいのじゃ…！${
					this.doc.perModulesData?.rpg
						? `\n（RPGモードでの行動回数が ${
								Math.floor((this.doc.love || 0) / 100) + 2
						  } 回になりました！）`
						: ""
				}`,
			});
		}
		this.doc.love += amount;
		this.doc.love = parseFloat((this.doc.love || 0).toFixed(2));

		/*// 最大 100
		if (this.doc.love > 100) this.doc.love = 100;*/

		if (key != "merge") {
			this.doc.lastLoveIncrementedAt = today;
			this.doc.todayLoveIncrements =
				(this.doc.todayLoveIncrements || 0) + amount;
			this.doc.todayLoveIncrements = parseFloat(
				(this.doc.todayLoveIncrements || 0).toFixed(2)
			);
		}
		this.save();

		// 好感度が上昇した場合、ActiveFactorを増加させる
		if (!key || (key !== "greet" && key != "merge")) this.ai.incActiveFactor();

		if (key != "merge")
			this.ai.log(
				`💗 ${this.userId} +${amount} (${this.doc.love || 0}) <${
					this.doc.todayLoveIncrements || 0
				} / ${(this.doc.love || 0) < 100 ? 15 : 50}>`
			);
	}

	@autobind
	public decLove(amount = 1) {
		amount = amount * 5;

		// 親愛度100以上の場合、量に応じて下がる量が軽減
		if ((this.doc.love || 0) >= 100)
			amount =
				Math.ceil((amount / (((this.doc.love || 0) * 2) / 100 - 1)) * 100) /
				100;

		// 好感度x00以下になる場合、x00で止まる
		if (
			(this.doc.love || 0) >= 100 &&
			((this.doc.love || 0) % 100) - amount < 0
		)
			this.doc.love = Math.floor((this.doc.love || 0) / 100) * 100 + amount;

		if (this.doc.love == null) this.doc.love = 0;
		this.doc.love -= amount;

		// 最低 -30
		if (this.doc.love < -30) this.doc.love = -30;

		// 親愛度マイナスなら名前を忘れる
		if (this.doc.love < 0) {
			this.doc.name = null;
		}

		this.save();

		this.ai.log(`💢 ${this.userId} -${amount} (${this.doc.love || 0})`);
	}

	@autobind
	public updateName(name: string | null) {
		this.doc.name = name;
		this.save();
	}

	@autobind
	public save() {
		this.ai.friends.update(this.doc);
	}

	@autobind
	public generateTransferCode(): string {
		const code = genItem() + genItem();

		this.doc.transferCode = code;
		this.save();

		return code;
	}

	@autobind
	public transferMemory(code: string): boolean {
		const src = this.ai.friends.findOne({
			transferCode: code,
		});

		if (src == null) return false;

		this.doc.name = src.name;
		this.doc.love = src.love;
		this.doc.married = src.married;
		this.doc.perModulesData = src.perModulesData;
		this.doc.kazutoriData = src.kazutoriData;
		this.save();

		// TODO: 合言葉を忘れる

		return true;
	}
}

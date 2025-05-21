import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import { acct } from '@/utils/acct';
import getDate from '@/utils/get-date';
import autobind from 'autobind-decorator';
import { colorReply, colors } from './colors';
import { endressEnemy, enemys, Enemy, raidEnemys } from './enemys';
import { rpgItems } from './items';
import { aggregateTokensEffects, shopContextHook, shopReply } from './shop';
import { shop2Reply } from './shop2';
import { skills, Skill, SkillEffect, getSkill, skillReply, skillCalculate, aggregateSkillsEffects, calcSevenFever, amuletMinusDurability, countDuplicateSkillNames, skillBorders } from './skills';
import { start, Raid, raidInstall, raidContextHook, raidTimeoutCallback } from './raid';
import { initializeData, getColor, getAtkDmg, getEnemyDmg, showStatus, getPostCount, getPostX, getVal, random, preLevelUpProcess } from './utils';
import { calculateStats } from './battle';
import Friend from '@/friend';
import config from '@/config';
import * as loki from 'lokijs';

type List = {
	id: string;
	createdAt: any;
	name: string;
	userIds: string[];
};

export default class extends Module {
	public readonly name = 'rpg';

	private rpgPlayerList: List | undefined;

	private raids: loki.Collection<Raid>;

	@autobind
	public install() {
		this.raids = this.ai.getCollection('rpgRaid');
		raidInstall(this.ai, this, this.raids);
		setInterval(this.scheduleLevelUpdateAndRemind, 1000 * 60 * 5);
		setInterval(this.scheduleDailyNoteCountsUpdate, 1000 * 60 * 5);
		this.calculateMaxLv();
		this.rpgAccountListAdd();
		skillCalculate(this.ai);

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (config.rpgReplyRequired && !msg.user.host && msg.visibility !== "specified" && (!msg.replyId || msg.replyNote?.userId !== this.ai.account.id)) {
			if (msg.includes([serifs.rpg.command.rpg])) {
				msg.reply("RPG関連のコマンドを使用する際は私の何らかの投稿への返信で送ってください！", { visibility: "specified" })
				return {
					reaction: 'hmm'
				};
			} else {
				return false;
			}
		}
		if (!msg.user.host && msg.user.username === config.master && msg.includes([serifs.rpg.command.rpg]) && msg.includes(["admin"])) {
			// 管理者モード
			return this.handleAdminCommands(msg);
		}
		if (msg.includes([serifs.rpg.command.rpg]) && msg.includes(Array.isArray(serifs.rpg.command.Record) ? serifs.rpg.command.Record : [serifs.rpg.command.Record])) {
			// 殿堂モード
			return this.handleRecordCommands(msg);
		}
		if (msg.includes([serifs.rpg.command.rpg]) && msg.includes(Array.isArray(serifs.rpg.command.color) ? serifs.rpg.command.color : [serifs.rpg.command.color])) {
			// 色モード
			return colorReply(this, msg);
		}
		if (msg.includes(Array.isArray(serifs.rpg.command.shop) ? serifs.rpg.command.shop : [serifs.rpg.command.shop]) && msg.includes(Array.isArray(serifs.rpg.command.shop2) ? serifs.rpg.command.shop2 : [serifs.rpg.command.shop2])) {
			// データを読み込み
			const data = initializeData(this, msg);
			if ((!msg.user.host && msg.user.username === config.master) || data.items.filter((x) => x.name === "裏ショップ入場の札").length) {
				// 裏ショップモード
				return shop2Reply(this, this.ai, msg);
			}
		}
		if (msg.includes(Array.isArray(serifs.rpg.command.shop) ? serifs.rpg.command.shop : [serifs.rpg.command.shop])) {
			// ショップモード
			return shopReply(this, this.ai, msg);
		}
		if (msg.includes(Array.isArray(serifs.rpg.command.skill) ? serifs.rpg.command.skill : [serifs.rpg.command.skill])) {
			// スキルモード
			return skillReply(this, this.ai, msg);
		}
		if (msg.includes([serifs.rpg.command.rpg]) && msg.includes(Array.isArray(serifs.rpg.command.trial) ? serifs.rpg.command.trial : [serifs.rpg.command.trial])) {
			// 木人モード
			return this.handleTrialCommands(msg);
		}
		if (msg.includes([serifs.rpg.command.rpg]) && msg.includes(Array.isArray(serifs.rpg.command.items) ? serifs.rpg.command.items : [serifs.rpg.command.items])) {
			// アイテムモード
			return this.handleItemsCommands(msg);
		}
		if (msg.includes([serifs.rpg.command.rpg]) && msg.includes(Array.isArray(serifs.rpg.command.help) ? serifs.rpg.command.help : [serifs.rpg.command.help])) {
			// ヘルプモード
			return this.handleHelpCommands(msg);
		}
		if (msg.includes([serifs.rpg.command.rpg])) {
			// 通常モード
			return this.handleNormalCommands(msg);
		} else {
			return false;
		}
	}

	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (typeof key === "string" && key.startsWith("replayOkawari:")) {
			return this.replayOkawariHook(key, msg, data);
		}
		if (typeof key === "string" && key.startsWith("shopBuy:")) {
			return shopContextHook(this, key, msg, data);
		}
		return raidContextHook(key, msg, data);
	}

	@autobind
	private timeoutCallback(data) {

		return raidTimeoutCallback(data);

	}

	@autobind
	private calculateMaxLv() {
		const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
		const maxLv = this.getMaxLevel();
		if (!rpgData) {
			this.ai.moduleData.insert({ type: 'rpg', maxLv });
		} else {
			rpgData.maxLv = Math.max(rpgData.maxLv, maxLv);
			this.ai.moduleData.update(rpgData);
		}
	}

	@autobind
	private getMaxLevel() {
		const maxLv = this.ai.friends.find().filter(x => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1).reduce((acc, cur) => acc > cur.perModulesData.rpg.lv ? acc : cur.perModulesData.rpg.lv, 0);
		return maxLv > 255 ? 255 : maxLv;
	}

	@autobind
	private scheduleLevelUpdateAndRemind() {

		const hours = new Date().getHours();
		if ((hours === 0 || hours === 12 || hours === 18) && new Date().getMinutes() >= 1 && new Date().getMinutes() < 6) {
			this.rpgAccountListAdd();
			const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
			if (rpgData) {
				if (rpgData.maxLv < 255) rpgData.maxLv += 1;
				this.ai.moduleData.update(rpgData);
			} else {
				const maxLv = this.getMaxLevel();
				this.ai.moduleData.insert({ type: 'rpg', maxLv });
			}
			this.remindLevelUpdate();
		}
	}

	@autobind
	private remindLevelUpdate() {
		const filteredColors = colors.filter(x => x.id > 1 && !x.reverseStatus && !x.alwaysSuper && !x.hidden).map(x => x.name);
		const me = Math.random() < 0.8 ? colors.find(x => x.default)?.name ?? colors[0].name : filteredColors[Math.floor(Math.random() * filteredColors.length)];
		this.ai.post({
			text: serifs.rpg.remind(me, new Date().getHours()),
		});
	}

	@autobind
	private async scheduleDailyNoteCountsUpdate() {
		const hours = new Date().getHours();
		if (hours === 23 && new Date().getMinutes() >= 55 && new Date().getMinutes() < 60) {
			const friends = this.ai.friends.find().filter(x => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1 && x.perModulesData.rpg.noChart);
			for (const friendData of friends) {
				const friend = new Friend(this.ai, { doc: friendData });
				const data = friend.getPerModulesData(this);
				const user = await this.ai.api('users/show', { userId: friend.userId });
				friend.updateUser(user);
				if (data.todayNotesCount) data.yesterdayNotesCount = data.todayNotesCount;
				data.todayNotesCount = friend.doc.user.notesCount;
				friend.save();
			}
		}
	}

	@autobind
	private handleHelpCommands(msg: Message) {
		// データを読み込み
		const data = initializeData(this, msg);
		const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
		let helpMessage = [serifs.rpg.help.title];
		if ((data.lv ?? 0) < 7) {
			helpMessage.push(serifs.rpg.help.normal1);
			if (rpgData.maxLv >= 255) {
				helpMessage.push(serifs.rpg.help.okawari3(rpgData.maxLv - data.lv));
			} else {
				if (data.coin > 0) {
					helpMessage.push(serifs.rpg.help.okawari2(rpgData.maxLv - data.lv));
				} else {
					helpMessage.push(serifs.rpg.help.okawari1(rpgData.maxLv - data.lv));
				}
			}
		} else {
			helpMessage.push(serifs.rpg.help.normal2);
			if (data.lv < rpgData.maxLv) {
				if (rpgData.maxLv >= 255) {
					helpMessage.push(serifs.rpg.help.okawari3(rpgData.maxLv - data.lv));
				} else {
					if (data.coin > 0) {
						helpMessage.push(serifs.rpg.help.okawari2(rpgData.maxLv - data.lv));
					} else {
						helpMessage.push(serifs.rpg.help.okawari1(rpgData.maxLv - data.lv));
					}
				}
			}
			helpMessage.push(serifs.rpg.help.trial(data.bestScore));
			if (data.winCount >= 5) {
				helpMessage.push(serifs.rpg.help.journey);
			}
			helpMessage.push(serifs.rpg.help.color);
			if (data.lv >= 20) {
				if (data.lv >= 60) {
					helpMessage.push(serifs.rpg.help.skills2);
				} else {
					helpMessage.push(serifs.rpg.help.skills1);
				}

			}
		}
		if (data.coin > 0) {
			helpMessage.push(serifs.rpg.help.shop(data.coin));
		}
		if (data.items) {
			if (data.items.filter((x) => x.name === "裏ショップ入場の札").length) {
				helpMessage.push(serifs.rpg.help.shop2);
			}
			helpMessage.push(serifs.rpg.help.item);
		}
		if ((data.lv ?? 0) > 2) {
			helpMessage.push(serifs.rpg.help.status);
		}
		if ((data.lv ?? 0) > 7) {
			helpMessage.push(serifs.rpg.help.record);
			helpMessage.push(serifs.rpg.help.link);
		}
		helpMessage.push(serifs.rpg.help.help);

		msg.reply("\n" + helpMessage.join("\n\n"));
		return { reaction: "love" };
	}

	@autobind
	private handleItemsCommands(msg: Message) {
		const data = initializeData(this, msg);
		if (!data.lv || !data.items) return { reaction: 'confused' };

		let message = ["アイテム一覧\n"];
		const itemType = ["amulet", "token"]
		message.push(data.items.sort((a, b) => itemType.indexOf(a.type) - itemType.indexOf(b.type)).map((x) => x.name + (x.durability ? " 残耐久" + x.durability : "")).join("\n"))
		const jarList = ["壺", "きれいな壺", "すごい壺", "巨大な壺", "うねうねした壺", "ナノサイズ壺"]
		message.push(jarList.slice(0, data.jar).join("\n"))
		if (data.jar > jarList.length) {
			message.push(`謎の壺${data.jar - jarList.length >= 2 ? " ×" + (data.jar - jarList.length) : ""}`)
		}
		if (data.nextSkill) {
			message.push(data.nextSkill + "の教本")
		}
		if (data.atkMedal) {
			message.push(`赤の勲章${data.atkMedal >= 2 ? " ×" + data.atkMedal : "" }`)
		}
		if (data.defMedal) {
			message.push(`青の勲章${data.defMedal >= 2 ? " ×" + data.defMedal : "" }`)
		}
		if (data.itemMedal) {
			message.push(`緑の勲章${data.itemMedal >= 2 ? " ×" + data.itemMedal : "" }`)
		}
		if (data.rerollOrb) {
			message.push(`スキル変更珠${data.rerollOrb >= 2 ? " ×" + data.rerollOrb : "" }`)
		}
		if (data.duplicationOrb) {
			message.push(`スキル複製珠${data.duplicationOrb >= 2 ? " ×" + data.duplicationOrb : "" }`)
		}
		if (message.length !== 1 && data.coin) {
			message.push(`${config.rpgCoinName}${data.coin >= 2 ? " ×" + data.coin : "" }`)
		}
		msg.reply("\n" + message.join("\n") + (message.length === 1 ? "\n\n何も持っていないようです。\n「RPG ショップ」で購入できます。" : ""));
		return { reaction: "love" };
	}

	@autobind
	private handleRecordCommands(msg: Message) {
		const data = initializeData(this, msg);
		if (!data.lv) return { reaction: 'confused' };

		let message: string[] = [];
		const allData = this.ai.friends.find();

		const createRankMessage = (
			score: number | null,
			label: string,
			dataKey: string,
			options?: { prefix?: string, suffix?: string, addValue?: number; }
		) => {
			const values = allData
				.map(friend => {
					if (dataKey.includes(".")) {
						// 動的にプロパティにアクセスするための処理
						const keys = dataKey.replace(/\[(\w+)\]/g, '.$1').split('.');
						return keys.reduce((acc, key) => acc?.[key], friend.perModulesData?.rpg);
					} else {
						// 既存の単純なキーでのプロパティアクセス
						return friend.perModulesData?.rpg?.[dataKey];
					}
				})
				.filter(value => value !== undefined);

			values.sort((a, b) => b - a); // 降順でソート

			if (score != null) {
				// 同順位の人数を計算
				const sameRankCount = values.filter(v => v === score).length;

				// ランキングの計算には元のスコアを使用
				const rank = values.indexOf(score) + 1;
				let rankmsg = "";

				if (rank === 0) {
					rankmsg = "？"; // 順位が見つからなかった場合
				} else {
					// 10位以内の場合の順位表示
					if (rank <= 10) {
						rankmsg = `${rank === 1 ? "👑" : "🎖️"}${rank}位`;
					} else {
						const total = values.length;
						const percentage = (rank / total) * 100;

						if (percentage < 50) {
							rankmsg = `${percentage < 10 ? "🥈" : percentage < 35 ? "🥉" : ""}上位${percentage.toFixed(1)}%`;
						} else {
							const surpassedCount = total - rank - (sameRankCount - 1); // 同順位の人数を考慮
							if (surpassedCount > 0 || sameRankCount > 1) {
								rankmsg = `${surpassedCount}人超え`;
							} else {
								rankmsg = ``;
							}
						}
					}

					// 同順位の表記を追加
					if (sameRankCount > 1) {
						rankmsg += `（同順位：${sameRankCount - 1}人）`;
					} else if (rank <= 10 && rank >= 2) {
						rankmsg += `（1位：${(values?.[0] + (options?.addValue || 0)).toLocaleString()}）`;
					} else if (rank == 1 && values?.[1]) {
						rankmsg += `（2位：${(values?.[1] + (options?.addValue || 0)).toLocaleString()}）`;
					}
				}

				// 表示するスコアにだけaddValueを適用
				const finalScoreDisplay = `${options?.prefix || ''}${(score + (options?.addValue || 0)).toLocaleString()}${options?.suffix || ''}`;

				return `${label}\n${finalScoreDisplay} ${rankmsg}`;
			} else {
				// 同順位の人数を計算
				const sameRankCount = values.filter(v => v === values?.[0]).length;
				const sameRankCount2 = values.filter(v => v === values?.[9]).length;

				let rankmsg = "";
				if (sameRankCount > 1) {
					rankmsg += `（同順位：${sameRankCount - 1}人）`;
				}

				let rankmsg2 = "";
				if (sameRankCount2 > 1) {
					rankmsg2 += `（同順位：${sameRankCount2 - 1}人）`;
				}

				return `${label}\n1位：${(values?.[0] + (options?.addValue || 0)).toLocaleString()} ${rankmsg}${sameRankCount < 9 ? `\n10位：${(values?.[9] + (options?.addValue || 0)).toLocaleString()} ${rankmsg2}` : ""}`;
			}
		};

		if (msg.includes(["ランク"])){

			message.push(createRankMessage(null, "Lv", "lv"));
			message.push(createRankMessage(null, "最大木人ダメージ", "bestScore", { suffix: "ダメージ" }));
			message.push(createRankMessage(null, "旅モード最高クリア記録", "maxEndress", { prefix: "ステージ", addValue: 1 }));
			message.push(createRankMessage(null, "運の良さ", "maxStatusUp", { suffix: "pts" }));
			message.push(createRankMessage(null, "壺購入数", "jar", { suffix: "個" }));
			if (data.raidScore) {
				for (const [key, value] of Object.entries(data.raidScore)) {
					if (value && typeof value === "number") {
						const enemy = raidEnemys.find((x) => x.name === key);
						message.push(`${createRankMessage(null, key + ` 最大${enemy?.scoreMsg ?? "ダメージ"}`, `raidScore.${key}`, { suffix: data.clearRaid?.includes(key) ? `${enemy?.scoreMsg2 ?? "ダメージ"} ⭐️` : `${enemy?.scoreMsg2 ?? "ダメージ"}` })}`);
					}
				}
			}
			message.push(createRankMessage(null, "7ターン戦ったレイドボス (⭐️)", "clearRaidNum", { suffix: "種類" }));

		} else {

			if (data.lv) {
				message.push(createRankMessage(data.lv, "Lv", "lv"));
			}
	
			if (data.bestScore) {
				message.push(createRankMessage(data.bestScore, "最大木人ダメージ", "bestScore", { suffix: "ダメージ" }));
			}
	
			if (data.maxEndress) {
				message.push(createRankMessage(data.maxEndress, "旅モード最高クリア記録", "maxEndress", { prefix: "ステージ", addValue: 1 }));
			}
	
			if (data.maxStatusUp) {
				message.push(createRankMessage(data.maxStatusUp, "運の良さ", "maxStatusUp", { suffix: "pts" }));
			}
	
			if (data.jar) {
				message.push(createRankMessage(data.jar, "壺購入数", "jar", { suffix: "個" }));
			}
	
			let totalScore = 0;
	
			if (data.raidScore) {
				for (const [key, value] of Object.entries(data.raidScore)) {
					if (value && typeof value === "number") {
						const enemy = raidEnemys.find((x) => x.name === key);
						const score = enemy?.power ? Math.max(Math.log2((value * 20) / (1024 / ((enemy.power ?? 30) / 30))) + 1, 1) : undefined;
						if (score) totalScore += score
						message.push(`${createRankMessage(value, key + ` 最大${enemy?.scoreMsg ?? "ダメージ"}`, `raidScore.${key}`, { suffix: data.clearRaid?.includes(key) ? `${enemy?.scoreMsg2 ?? "ダメージ"} ⭐️` : `${enemy?.scoreMsg2 ?? "ダメージ"}` })}${score ? `\n★${Math.floor(score)} ${Math.floor((score % 1) * 8) !== 0 ? `$[bg.color=ffff90 ${":blank:".repeat(Math.floor((score % 1) * 8))}]` : ""}$[bg.color=ff9090 ${":blank:".repeat(8 - Math.floor((score % 1) * 8))}] ★${Math.floor(score) + 1}` : ""}`);
					}
				}
				if (totalScore > 0 && Object.entries(data.raidScore).length >= 2) message.push(`合計レイドボス評価値\n★${totalScore.toFixed(2)}`);
			}
	
			if (data.clearRaidNum) {
				message.push(createRankMessage(data.clearRaidNum, "7ターン戦ったレイドボス (⭐️)", "clearRaidNum", { suffix: "種類" }));
			}
		}


		if (message.length === 0) return { reaction: 'confused' };
		msg.reply("\n" + message.join("\n\n"));
		return { reaction: "love" };
	}

	@autobind
	private handleAdminCommands(msg: Message) {
		if (msg.includes(["revert"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			if (id) {
				const friend = this.ai.lookupFriend(id);
				if (friend == null) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.lastPlayedAt = "";
				friend.doc.perModulesData.rpg.lv = friend.doc.perModulesData.rpg.lv - 1;
				friend.doc.perModulesData.rpg.atk = friend.doc.perModulesData.rpg.atk - 5;
				friend.doc.perModulesData.rpg.def = friend.doc.perModulesData.rpg.def - 2;
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["sReset"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			if (id) {
				const friend = this.ai.lookupFriend(id);
				if (friend == null) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.lastShopVisited = "";
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["tReset"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			if (id) {
				const friend = this.ai.lookupFriend(id);
				if (friend == null) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.lastPlayedLv = 0;
				friend.doc.perModulesData.rpg.bestScore = 0;
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["skilledit"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			const skill = /"(\S+)"/.exec(msg.extractedText)?.[1];
			const num = /\s(\d)\s/.exec(msg.extractedText)?.[1];
			if (id && skill && num) {
				const friend = this.ai.lookupFriend(id);
				if (friend == null) return { reaction: ":mk_hotchicken:" };
				if (!skills.find((x) => x.name.startsWith(skill))) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.skills[num] = skills.find((x) => x.name.startsWith(skill));
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["giveCoin"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			const num = /\s(\d+)\s/.exec(msg.extractedText)?.[1];
			if (id && num) {
				const friend = this.ai.lookupFriend(id);
				if (friend == null) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.coin = (friend.doc.perModulesData.rpg.coin ?? 0) + parseInt(num);
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["setCoin"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			const num = /\s(\d+)\s/.exec(msg.extractedText)?.[1];
			if (id && num) {
				const friend = this.ai.lookupFriend(id);
				if (friend == null) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.coin = parseInt(num);
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["startRaid"])) {
			start(undefined, msg.includes(["recent"]) ? "r" : msg.includes(["hato"]) ? "h" : "");
			return { reaction: "love" };
		}
		if (msg.includes(["dataFix"])) {

			const ai = this.ai;
			const games = this.raids.find({});
			const allData = this.ai.friends.find();

			games[games.length - 1].attackers.forEach(x => {
				const doc = this.ai.lookupFriend(x.user.id)?.doc;
				const enemyName = ":mk_hero:"
				if (doc?.perModulesData?.rpg?.raidScore?.[enemyName] != 8443) return;
				doc.perModulesData.rpg.raidScore[enemyName] = 4159;
			});
			return { reaction: "love" };
		}
		return { reaction: "hmm" };
	}

	@autobind
	private async handleTrialCommands(msg: Message) {

		// データを読み込み
		const data = initializeData(this, msg);
		if (!data.lv) return { reaction: 'confused' };
		const colorData = colors.map((x) => x.unlock(data));
		// プレイ済でないかのチェック
		if (data.lastPlayedLv >= data.lv) {
			msg.reply(serifs.rpg.trial.tired);
			return {
				reaction: 'confused'
			};
		}

		data.lastPlayedLv = data.lv;

		// 所持しているスキル効果を読み込み
		const skillEffects = aggregateSkillsEffects(data);

		let color = getColor(data);

		// 覚醒状態か？
		const isSuper = color.alwaysSuper;

		let superBonusPost = (isSuper && !aggregateTokensEffects(data).hyperMode ? 200 : 0)

		// 投稿数（今日と明日の多い方）
		let postCount = await getPostCount(this.ai, this, data, msg, superBonusPost);

		if (isSuper && aggregateTokensEffects(data).hyperMode) {
			skillEffects.postXUp = (skillEffects.postXUp ?? 0) + 0.005
		}

		// 投稿数に応じてステータス倍率を得る
		// 連続プレイの場合は倍率アップ
		let tp = getPostX(postCount) * (1 + ((skillEffects.postXUp ?? 0) * Math.min((postCount - superBonusPost) / 20, 10)));

		// 自分のカラー
		let me = color.name;

		// 画面に出力するメッセージ
		let cw = acct(msg.user) + " ";
		let message = "";

		// ここで残りのステータスを計算しなおす
		let { atk, def, spd } = calculateStats(data, msg, skillEffects, color);

		if (isSuper) {
			if (!aggregateTokensEffects(data).notSuperSpeedUp) spd += 2;
			if (aggregateTokensEffects(data).redMode) {
				skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + 0.08
				skillEffects.critDmgUp = Math.max((skillEffects.critDmgUp ?? 0), 0.4)
			} else if (aggregateTokensEffects(data).blueMode) {
				skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.2
			} else if (aggregateTokensEffects(data).yellowMode) {
				spd += 1
				skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.1
			} else if (aggregateTokensEffects(data).greenMode) {
				skillEffects.itemEquip = ((1 + (skillEffects.itemEquip ?? 0)) * 1.15) - 1;
				skillEffects.itemBoost = ((1 + (skillEffects.itemBoost ?? 0)) * 1.15) - 1;
				skillEffects.mindMinusAvoid = ((1 + (skillEffects.mindMinusAvoid ?? 0)) * 1.15) - 1;
				skillEffects.poisonAvoid = ((1 + (skillEffects.poisonAvoid ?? 0)) * 1.15) - 1;
			}
		}
		

		message += [
			`${serifs.rpg.nowStatus}`,
			`${serifs.rpg.status.atk} : ${Math.round(atk)}`,
			`${serifs.rpg.status.post} : ${Math.round(postCount - (isSuper ? 200 : 0))}`,
			"★".repeat(Math.floor(tp)) + "☆".repeat(Math.max(5 - Math.floor(tp), 0)) + "\n\n"
		].filter(Boolean).join("\n");

		cw += serifs.rpg.trial.cw(data.lv);
		message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;


		// 敵のステータスを計算
		let edef = data.lv * 3.5;
		const enemyMinDef = edef * 0.4
		const arpenX = 1 - (1 / (1 + (skillEffects.arpen ?? 0)));
		edef -= Math.max(atk * arpenX, edef * arpenX);
		if (edef < enemyMinDef) edef = enemyMinDef;

		atk = atk * (1 + ((skillEffects.critUpFixed ?? 0) * (1 + (skillEffects.critDmgUp ?? 0))));
		atk = atk * (1 + (skillEffects.dart ?? 0) * 0.5);
		atk = atk * (1 + (skillEffects.abortDown ?? 0) * (1 / 3));

		let trueDmg = 0;

		// 炎属性剣攻撃
		if (skillEffects.fire) {
			trueDmg = Math.ceil(data.lv * skillEffects.fire);
		}

		// ７フィーバー
		let sevenFever = skillEffects.sevenFever ? calcSevenFever([data.lv, data.atk, data.def]) * skillEffects.sevenFever : 0;
		if (sevenFever) {
			atk = atk * (1 + (sevenFever / 100));
			def = def * (1 + (sevenFever / 100));
		}

		let minTotalDmg = 0;
		let totalDmg = 0;
		let maxTotalDmg = 0;

		const minRnd = Math.max(0.2 + (isSuper ? 0.3 : 0) + (skillEffects.atkRndMin ?? 0), 0);
		const maxRnd = Math.max(1.6 + (skillEffects.atkRndMax ?? 0), 0);

		if (skillEffects.allForOne || aggregateTokensEffects(data).allForOne) {
			atk = atk * spd * (1 + (skillEffects.allForOne ?? 0) * 0.1);
			trueDmg = trueDmg * spd * (1 + (skillEffects.allForOne ?? 0) * 0.1);
			spd = 1;
		}

		for (let i = 0; i < spd; i++) {
			const buff = (1 + (skillEffects.atkDmgUp ?? 0)) * (skillEffects.thunder ? 1 + (skillEffects.thunder * ((i + 1) / spd) / (spd === 1 ? 2 : spd === 2 ? 1.5 : 1)) : 1);
			const rng = (minRnd + (maxRnd / 2));
			let minDmg = getAtkDmg(data, atk, tp, 1, false, edef, 0, minRnd * buff, 3) + trueDmg;
			minTotalDmg += minDmg;
			let dmg = getAtkDmg(data, atk, tp, 1, false, edef, 0, rng * buff, 3) + trueDmg;
			totalDmg += dmg;
			let maxDmg = getAtkDmg(data, atk, tp, 1, false, edef, 0, (minRnd + maxRnd) * buff, 3) + trueDmg;
			maxTotalDmg += maxDmg;
			// メッセージの出力
			message += serifs.rpg.trial.atk(dmg) + "\n";
		}

		message += `\n${serifs.rpg.end}\n\n${serifs.rpg.trial.result(totalDmg)}\n${serifs.rpg.trial.random(minTotalDmg, maxTotalDmg)}\n${data.bestScore ? serifs.rpg.trial.best(data.bestScore) : ""}`;

		data.bestScore = Math.max(data.bestScore ?? 0, totalDmg);

		msg.friend.setPerModulesData(this, data);

		// 色解禁確認
		const newColorData = colors.map((x) => x.unlock(data));
		let unlockColors = "";
		for (let i = 0; i < newColorData.length; i++) {
			if (!colorData[i] && newColorData[i]) {
				unlockColors += colors[i].name;
			}
		}
		if (unlockColors) {
			message += serifs.rpg.newColor(unlockColors);
		}

		msg.reply(`<center>${message}</center>`, {
			cw,
			visibility: 'public'
		});

		return {
			reaction: me
		};
	}

	@autobind
	private async handleNormalCommands(msg: Message) {
		// データを読み込み
		const data = initializeData(this, msg);
		const colorData = colors.map((x) => x.unlock(data));
		// 所持しているスキル効果を読み込み
		const skillEffects = aggregateSkillsEffects(data);

		/** 1回～3回前の時間の文字列 */
		let TimeStrBefore1 = (new Date().getHours() < 12 ? getDate(-1) + "/18" : new Date().getHours() < 18 ? getDate() : getDate() + "/12");
		let TimeStrBefore2 = (new Date().getHours() < 12 ? getDate(-1) + "/12" : new Date().getHours() < 18 ? getDate(-1) + "/18" : getDate());
		let TimeStrBefore3 = (new Date().getHours() < 12 ? getDate(-1) : new Date().getHours() < 18 ? getDate(-1) + "/12" : getDate(-1) + "/18");

		/** 現在の時間の文字列 */
		let nowTimeStr = getDate() + (new Date().getHours() < 12 ? "" : new Date().getHours() < 18 ? "/12" : "/18");

		let nextTimeStr = new Date().getHours() < 12 ? getDate() + "/12" : new Date().getHours() < 18 ? getDate() + "/18" : getDate(1);

		let autoReplayFlg = false;

		const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });

		const isMaxLevel = data.lv >= rpgData.maxLv;

		let needCoin = 10;
		if ((rpgData.maxLv - data.lv) >= 200) needCoin -= 2;
		if ((rpgData.maxLv - data.lv) >= 150) needCoin -= 2;
		if ((rpgData.maxLv - data.lv) >= 100) needCoin -= 4;
		//if ((rpgData.maxLv - data.lv) >= 50) needCoin -= 2;

		// プレイ済でないかのチェック
		if (data.lastPlayedAt === nowTimeStr || data.lastPlayedAt === nextTimeStr) {
			if (msg.includes(Array.isArray(serifs.rpg.command.onemore) ? serifs.rpg.command.onemore : [serifs.rpg.command.onemore])) {
				if (data.lastOnemorePlayedAt === getDate()) {
					if (needCoin <= (data.coin ?? 0)) {
						if (isMaxLevel) {
							if (rpgData.maxLv >= 255) {
								msg.reply(serifs.rpg.oneMore.maxLv2);
							} else {
								msg.reply(serifs.rpg.oneMore.maxLv);
							}
							return {
								reaction: 'confused'
							};
						}
						if (!data.replayOkawari && !aggregateTokensEffects(data).autoReplayOkawari) {
							const reply = await msg.reply(serifs.rpg.oneMore.buyQuestion(needCoin, data.coin), { visibility: "specified" });
							this.log("replayOkawari SubscribeReply: " + reply.id);
							this.subscribeReply("replayOkawari:" + msg.userId, reply.id);
							return { reaction: 'love' };
						} else {
							data.coin -= needCoin;
							data.replayOkawari = false;
							if (aggregateTokensEffects(data).autoReplayOkawari) {
								autoReplayFlg = true;
							}
						}
					} else {
						msg.reply(serifs.rpg.oneMore.tired(!isMaxLevel));
						return {
							reaction: 'confused'
						};
					}
				}
				if (isMaxLevel) {
					if (rpgData.maxLv >= 255) {
						msg.reply(serifs.rpg.oneMore.maxLv2);
					} else {
						msg.reply(serifs.rpg.oneMore.maxLv);
					}
					return {
						reaction: 'confused'
					};
				}
				data.lastOnemorePlayedAt = getDate();
			} else {
				if (
					(skillEffects.rpgTime ?? 0) < 0 &&
					new Date().getHours() >= 24 + (skillEffects.rpgTime ?? 0) && data.lastPlayedAt !== getDate(1) ||
					data.lastPlayedAt !== getDate() + (new Date().getHours() < 12 + (skillEffects.rpgTime ?? 0) ? "" : new Date().getHours() < 18 + (skillEffects.rpgTime ?? 0) ? "/12" : "/18")
				) {

					TimeStrBefore3 = TimeStrBefore2;
					TimeStrBefore2 = TimeStrBefore1;
					TimeStrBefore1 = nowTimeStr;

					nowTimeStr = new Date().getHours() < 12 ? getDate() + "/12" : new Date().getHours() < 18 ? getDate() + "/18" : getDate(1);
				} else {
					msg.reply(serifs.rpg.tired(new Date(), data.lv < rpgData.maxLv && data.lastOnemorePlayedAt !== getDate(), data.lv >= 7));
					return {
						reaction: 'confused'
					};
				}
			}
		} else {
			if (msg.includes(Array.isArray(serifs.rpg.command.onemore) ? serifs.rpg.command.onemore : [serifs.rpg.command.onemore])) {
				if (data.lastOnemorePlayedAt === getDate()) {
					const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
					msg.reply(serifs.rpg.oneMore.tired(!isMaxLevel));
					return {
						reaction: 'confused'
					};
				}
				msg.reply(serifs.rpg.oneMore.err);
				return {
					reaction: 'confused'
				};
			}
		}
		/** 連続プレイかどうかをチェック */
		let continuousBonus = 0;
		let continuousFlg = false;
		if (data.lastPlayedAt === nowTimeStr || data.lastPlayedAt === TimeStrBefore1) {
			continuousBonus = 1;
		} else {
			if (
				[TimeStrBefore2, TimeStrBefore3].includes(data.lastPlayedAt) ||
				data.lastPlayedAt?.startsWith(getDate(-1))
			) {
				if (data.lastPlayedAt === getDate()) continuousFlg = true;
				continuousBonus = 0.5;
			}
		}
		continuousBonus = continuousBonus * (1 + (skillEffects.continuousBonusUp ?? 0));

		/** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
		let count = data.count ?? 1;

		// 旅モード（エンドレスモード）のフラグ
		if (msg.includes(Array.isArray(serifs.rpg.command.journey) ? serifs.rpg.command.journey : [serifs.rpg.command.journey]) && !aggregateTokensEffects(data).autoJournal) {
			// 現在戦っている敵がいない場合で旅モード指定がある場合はON
			if (!data.enemy || count === 1 || data.endressFlg) {
				data.endressFlg = true;
			} else {
				msg.reply(serifs.rpg.journey.err);
				return {
					reaction: 'confused'
				};
			}
		} else {
			// 現在戦っている敵がいない場合で旅モード指定がない場合はOFF
			if (!data.enemy || count === 1) {
				data.endressFlg = false;
			}
		}

		if (aggregateTokensEffects(data).autoJournal) {
			if ((!data.enemy || count === 1 || data.endressFlg) && !(aggregateTokensEffects(data).appearStrongBoss && !data.clearHistory.includes(":mk_chickenda_gtgt:"))) {
				data.endressFlg = true;
			}
		}

		// 最終プレイの状態を記録
		data.lastPlayedAt = nowTimeStr;

		/** 使用中の色情報 */
		let color = getColor(data);

		if (!color.unlock(data)) {
			data.color === (colors.find((x) => x.default) ?? colors[0]).id;
			color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
		}

		if (colors.find((x) => x.alwaysSuper)?.unlock(data)) {
			data.superUnlockCount = (data.superUnlockCount ?? 0) + 1;
		}

		/** 覚醒状態か？*/
		const isSuper = Math.random() < (0.02 + Math.max(data.superPoint / 200, 0)) || (data.lv ?? 1) % 100 === 0 || color.alwaysSuper;

		let superBonusPost = (isSuper && !aggregateTokensEffects(data).hyperMode ? 200 : 0)

		/** 投稿数（今日と明日の多い方）*/
		let postCount = await getPostCount(this.ai, this, data, msg, superBonusPost);

		let continuousBonusNum = 0;

		if (continuousBonus > 0) {
			continuousBonusNum = (Math.min(Math.max(10, postCount / 2), 25) * continuousBonus);
			postCount = postCount + continuousBonusNum;
		}

		if (isSuper && aggregateTokensEffects(data).hyperMode) {
			skillEffects.postXUp = (skillEffects.postXUp ?? 0) + 0.005
		}

		// 投稿数に応じてステータス倍率を得る
		// 連続プレイの場合は倍率アップ
		/** ステータス倍率（投稿数） */
		let tp = getPostX(postCount) * (1 + ((skillEffects.postXUp ?? 0) * Math.min((postCount - superBonusPost) / 20, 10)));

		// これが2ターン目以降の場合、戦闘中に計算された最大倍率の50%の倍率が保証される
		data.maxTp = Math.max(tp, data.maxTp ?? 0);
		tp = Math.max(tp, data.maxTp / 2);

		if (!isSuper) {
			data.superPoint = Math.max(data.superPoint ?? 0 - (tp - 2), -3);
		} else {
			data.superPoint = 0;
		}


		/** 画面に出力するメッセージ:CW */
		let cw = acct(msg.user) + " ";
		/** 画面に出力するメッセージ:Text */
		let message = "";

		if (autoReplayFlg) {
			message += serifs.rpg.oneMore.autoBuy(data.coin) + `\n\n`;
		}

		/** プレイヤーの見た目 */
		let me = color.name;

		// ステータスを計算
		/** プレイヤーのLv */
		const lv = data.lv ?? 1;
		/** プレイヤーのHP */
		let playerHp = data.php ?? 100;
		/** 開始時のチャージ */
		const startCharge = data.charge;
		/** プレイヤーの最大HP */
		let playerMaxHp = 100 + Math.min(lv * 3, 765) + Math.floor((data.defMedal ?? 0) * 13.4);

		if (!data.totalResistDmg) data.totalResistDmg = 0;

		// 敵情報
		if (!data.enemy || count === 1) {
			// 新しい敵
			count = 1;
			data.count = 1;
			playerHp = playerMaxHp;
			/** すでにこの回で倒している敵、出現条件を満たしていない敵を除外 */
			const filteredEnemys = enemys.filter((x) => (skillEffects.enemyBuff || !(data.clearEnemy ?? []).includes(x.name)) && (!x.limit || x.limit(data, msg.friend)));
			if (filteredEnemys.length && !data.endressFlg) {
				/** 1度も倒した事のない敵 */
				const notClearedEnemys = filteredEnemys.filter((x) => !(data.clearHistory ?? []).includes(x.name));
				if (notClearedEnemys.length) {
					// 出現条件を満たしている敵の中で、1度も倒した事のない敵がいる場合、優先的に選ばれる
					data.enemy = notClearedEnemys[Math.floor(notClearedEnemys.length * Math.random())];
				} else {
					// 1度も倒した事のない敵が誰もいない場合
					data.enemy = filteredEnemys[Math.floor(filteredEnemys.length * Math.random())];
				}
			} else {
				// 旅モード（エンドレスモード）
				// 倒す敵がいなくてこのモードに入った場合、旅モード任意入場フラグをOFFにする
				if (!filteredEnemys.length) {
					if (!data.allClear) {
						data.allClear = lv - 1;
						data.allClearDate = Date.now();
					}
					data.endressFlg = false;
				}
				// エンドレス用の敵を設定
				data.enemy = endressEnemy(data);
			}
			// 敵の開始メッセージなどを設定
			cw += `${data.enemy.msg}`;
			message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;
			data.ehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
		} else {
			// 一度敵の情報を取得しなおす（関数のデータなどが吹き飛ぶ為）
			data.enemy = [...enemys, endressEnemy(data)].find((x) => data.enemy.name === x.name);
			// 敵が消された？？
			if (!data.enemy) data.enemy = endressEnemy(data);
			// 敵の開始メッセージなどを設定
			cw += `${data.enemy.short} ${count}${serifs.rpg.turn}`;
			// 前ターン時点のステータスを表示
			let mehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
			let ehp = Math.min(data.ehp ?? mehp, mehp);
			if (!data.php) data.php = playerMaxHp;
			data.count -= 1;
			message += showStatus(data, playerHp, ehp, mehp, me) + "\n\n";
			data.count += 1;
		}

		if (data.enemy.event) {
			msg.friend.setPerModulesData(this, data);
			return data.enemy.event(this, msg, data);
		}

		/** バフを得た数。行数のコントロールに使用 */
		let buff = 0;

		if ((data.info ?? 0) < 1 && ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
			data.info = 1;
			buff += 1;
			message += serifs.rpg.info + `\n`;
		}

		if (aggregateTokensEffects(data).showPostBonus) {
			buff += 1;
			if (continuousBonus >= 1) {
				message += serifs.rpg.postBonusInfo.continuous.a(Math.floor(continuousBonusNum)) + `\n`;
			} else if (continuousFlg && continuousBonus > 0) {
				message += serifs.rpg.postBonusInfo.continuous.b(Math.floor(continuousBonusNum)) + `\n`;
			} else if (continuousBonus > 0) {
				message += serifs.rpg.postBonusInfo.continuous.c(Math.floor(continuousBonusNum)) + `\n`;
			}
			if (isSuper && !aggregateTokensEffects(data).hyperMode) {
				message += serifs.rpg.postBonusInfo.super + `\n`;
			}
			message += serifs.rpg.postBonusInfo.post(Math.floor(postCount), tp >= 1 ? "+" + Math.floor((tp - 1) * 100) : "-" + Math.floor((tp - 1) * 100)) + `\n`;
		} else {
			// 連続ボーナスの場合、メッセージを追加
			// バフはすでに上で付与済み
			if (continuousBonus >= 1) {
				buff += 1;
				message += serifs.rpg.bonus.a + `\n`;
			} else if (continuousFlg && continuousBonus > 0) {
				buff += 1;
				message += serifs.rpg.bonus.b + `\n`;
			} else if (continuousBonus > 0) {
				buff += 1;
				message += serifs.rpg.bonus.c + `\n`;
			}
		}

		// ここで残りのステータスを計算しなおす
		let { atk, def, spd } = calculateStats(data, msg, skillEffects, color);
		/** 敵の最大HP */
		let enemyMaxHp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
		/** 敵のHP */
		let enemyHp = Math.min(data.ehp ?? 100, enemyMaxHp);
		/** 敗北時のステータスボーナス */
		let bonus = 0;
		/** プレイヤーのHP割合 */
		let playerHpPercent = playerHp / playerMaxHp;
		/** 敵のHP割合 */
		let enemyHpPercent = enemyHp / enemyMaxHp;
		/** 使用したアイテム */
		let item;
		/** アイテムによって増加したステータス */
		let itemBonus = { atk: 0, def: 0 };

		/** これって戦闘？ */
		let isBattle = data.enemy.atkmsg(0).includes("ダメージ");

		/** これって物理戦闘？ */
		let isPhysical = !data.enemy.atkmsg(0).includes("精神");

		/** ダメージ発生源は疲れ？ */
		let isTired = data.enemy.defmsg(0).includes("疲");

		if (isSuper) {
			if (!color.alwaysSuper) {
				// バフが1つでも付与された場合、改行を追加する
				if (buff > 0) message += "\n";
				const superColor = colors.find((x) => x.alwaysSuper)?.name ?? colors.find((x) => x.default)?.name ?? colors[0]?.name;
				buff += 1;
				me = superColor;
				if (!aggregateTokensEffects(data).notSuperSpeedUp) message += serifs.rpg.super(me) + `\n`;
				data.superCount = (data.superCount ?? 0) + 1;
			}
			let customStr = ""
			if (!aggregateTokensEffects(data).hyperMode) {
				customStr += "パワー・防御が**超**アップ！"
			} else {
				customStr += "投稿数による能力上昇量がアップ！"
			}
			if (!aggregateTokensEffects(data).notSuperSpeedUp) spd += 2;
			if (aggregateTokensEffects(data).redMode) {
				skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + 0.08
				skillEffects.critDmgUp = Math.max((skillEffects.critDmgUp ?? 0), 0.35)
				if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`クリティカル性能アップ！\n${customStr}`) + `\n`;
			} else if (aggregateTokensEffects(data).blueMode) {
				skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.2
				if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`ダメージカット+20%！\n${customStr}`) + `\n`;
			} else if (aggregateTokensEffects(data).yellowMode) {
				spd += 1
				skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.1
				if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`行動回数+1！\nダメージカット+10%！\n${customStr}`) + `\n`;
			} else if (aggregateTokensEffects(data).greenMode) {
				skillEffects.itemEquip = ((1 + (skillEffects.itemEquip ?? 0)) * 1.15) - 1;
				skillEffects.itemBoost = ((1 + (skillEffects.itemBoost ?? 0)) * 1.15) - 1;
				skillEffects.mindMinusAvoid = ((1 + (skillEffects.mindMinusAvoid ?? 0)) * 1.15) - 1;
				skillEffects.poisonAvoid = ((1 + (skillEffects.poisonAvoid ?? 0)) * 1.15) - 1;
				if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`全アイテム効果+15%！\n${customStr}`) + `\n`;
			}

		}

		if (skillEffects.heavenOrHell) {
			if (Math.random() < 0.6) {
				message += serifs.rpg.skill.heaven + "\n";
				atk = atk * (1 + skillEffects.heavenOrHell);
				def = def * (1 + (skillEffects.heavenOrHell * 1.5));
			} else {
				message += serifs.rpg.skill.hell + "\n";
				atk = atk / (1 + skillEffects.heavenOrHell);
				def = def / (1 + (skillEffects.heavenOrHell * 0.75)) ;
			}
		}


		// ７フィーバー
		let sevenFever = skillEffects.sevenFever ? calcSevenFever([data.lv, data.atk, data.def]) * skillEffects.sevenFever : 0;
		
		// 修行の成果
		const upStats = data.lv > 594 ? 70 + ((data.lv - 594) / 21) : (data.lv - 384) / 3;
		if (data.lv > 384 && data.enemy.name === endressEnemy(data).name && sevenFever < upStats) {
			buff += 1;
			message += serifs.rpg.lvBonus(Math.ceil(upStats)) + "\n";
			atk = atk * (1 + (upStats / 100));
			def = def * (1 + (upStats / 100));
		} else {
			if (sevenFever) {
				buff += 1;
				message += serifs.rpg.skill.sevenFever(sevenFever) + "\n";
				atk = atk * (1 + (sevenFever / 100));
				def = def * (1 + (sevenFever / 100));
			}
		}

		// spdが低い場合、確率でspdが+1。
		if (spd === 2 && Math.random() < 0.2) {
			buff += 1;
			message += serifs.rpg.spdUp + "\n";
			spd = 3;
		}
		if (spd === 1 && Math.random() < 0.6) {
			buff += 1;
			message += serifs.rpg.spdUp + "\n";
			spd = 2;
		}

		// 風魔法発動時
		let spdUp = spd * (skillEffects.spdUp ?? 0);
		if (Math.random() < spdUp % 1) {
			spdUp = Math.floor(spdUp) + 1;
		} else {
			spdUp = Math.floor(spdUp);
		}
		if ((isBattle && isPhysical) && spdUp) {
			buff += 1;
			message += serifs.rpg.skill.wind(spdUp) + "\n";
			spd = spd + spdUp;
		} else if (!(isBattle && isPhysical)) {
			// 非戦闘時は速度は上がらないが、パワーに還元される
			atk = atk * (1 + (skillEffects.spdUp ?? 0));
		}

		// 非戦闘なら非戦闘時スキルが発動
		if (!isBattle) {
			atk = atk * (1 + (skillEffects.notBattleBonusAtk ?? 0));
		}
		if (isTired) {
			def = def * (1 + (skillEffects.notBattleBonusDef ?? 0));
		}

		let dmgUp = 1;
		let critUp = 0;

		// HPが1/7以下で相手とのHP差がかなりある場合、決死の覚悟のバフを得る
		if (!aggregateTokensEffects(data).notLastPower) {
			if (playerHpPercent <= (1 / 7) * (1 + (skillEffects.haisuiUp ?? 0)) && ((enemyHpPercent * (1 + (skillEffects.haisuiUp ?? 0))) - playerHpPercent) >= 0.5) {
				buff += 1;
				message += serifs.rpg.haisui + "\n";
				dmgUp *= (1 + (skillEffects.haisuiAtkUp ?? 0));
				critUp += (skillEffects.haisuiCritUp ?? 0)
				const effect = Math.min((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.haisuiUp ?? 0)), 0.99);
				atk = atk + Math.round(def * effect);
				def = Math.round(def * (1 - effect));
			}
		}

		const itemEquip = 0.4 + ((1 - playerHpPercent) * 0.6);
		if (rpgItems.length && ((count === 1 && skillEffects.firstTurnItem) || Math.random() < itemEquip * (1 + (skillEffects.itemEquip ?? 0)))) {
			//アイテム
			buff += 1;
			if ((count === 1 && skillEffects.firstTurnItem)) message += serifs.rpg.skill.firstItem;
			if (data.enemy.pLToR) {
				let isPlus = Math.random() < 0.5;
				const items = rpgItems.filter((x) => isPlus ? x.mind > 0 : x.mind < 0);
				item = { ...items[Math.floor(Math.random() * items.length)] };
			} else {
				let types = ["weapon", "armor"];
				for (let i = 0; i < (skillEffects.weaponSelect ?? 0); i++) {
					types.push("weapon");
				}
				for (let i = 0; i < (skillEffects.armorSelect ?? 0); i++) {
					types.push("armor");
				}
				if ((count !== 1 || data.enemy.pLToR) && !skillEffects.lowHpFood) {
					types.push("medicine");
					types.push("poison");
					for (let i = 0; i < (skillEffects.foodSelect ?? 0); i++) {
						types.push("medicine");
						types.push("poison");
					}
				}
				
				if ((skillEffects.weaponSelect ?? 0) >= 1) {
					types = ["weapon"]
				}
				if ((skillEffects.armorSelect ?? 0) >= 1) {
					types = ["armor"]
				}
				if ((skillEffects.foodSelect ?? 0) >= 1) {
					types = ["medicine", "poison"];
				}
				if ((count !== 1 || data.enemy.pLToR) && skillEffects.lowHpFood && Math.random() < skillEffects.lowHpFood * playerHpPercent) {
					if (playerHpPercent < 0.5) message += serifs.rpg.skill.lowHpFood;
					types = ["medicine", "poison"];
					if (Math.random() < skillEffects.lowHpFood * playerHpPercent) types = ["medicine"];
				}
				if (types.includes("poison") && Math.random() < (skillEffects.poisonAvoid ?? 0)) {
					types = types.filter((x) => x !== "poison");
				}
				const type = types[Math.floor(Math.random() * types.length)];
				if ((type === "weapon" && !(isBattle && isPhysical)) || (type === "armor" && isTired) || data.enemy.pLToR) {
					let isPlus = Math.random() < (0.5 + (skillEffects.mindMinusAvoid ?? 0) + (count === 1 ? skillEffects.firstTurnMindMinusAvoid ?? 0 : 0));
					const items = rpgItems.filter((x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0));
					item = { ...items[Math.floor(Math.random() * items.length)] };
				} else {
					const items = rpgItems.filter((x) => x.type === type && x.effect > 0);
					item = { ...items[Math.floor(Math.random() * items.length)] };
				}
			}
			const mindMsg = (mind) => {
				if (mind >= 100) {
					message += `${config.rpgHeroName}の気合が特大アップ！\n`;
				} else if (mind >= 70) {
					message += `${config.rpgHeroName}の気合が大アップ！\n`;
				} else if (mind > 30) {
					message += `${config.rpgHeroName}の気合がアップ！\n`;
				} else if (mind > 0) {
					message += `${config.rpgHeroName}の気合が小アップ！\n`;
				} else if (mind > -50) {
					message += `あまり良い気分ではないようだ…\n`;
				} else {
					message += `${config.rpgHeroName}の気合が下がった…\n`;
				}
			};
			if (item.type !== "poison") {
				item.effect = Math.round(item.effect * (1 + (skillEffects.itemBoost ?? 0)));
				if (item.type === "weapon") item.effect = Math.round(item.effect * (1 + (skillEffects.weaponBoost ?? 0)));
				if (item.type === "armor") item.effect = Math.round(item.effect * (1 + (skillEffects.armorBoost ?? 0)));
				if (item.type === "medicine") item.effect = Math.round(item.effect * (1 + (skillEffects.foodBoost ?? 0)));
			} else {
				item.effect = Math.round(item.effect / (1 + (skillEffects.itemBoost ?? 0)));
				item.effect = Math.round(item.effect / (1 + (skillEffects.poisonResist ?? 0)));
			}
			if (item.mind < 0) {
				item.mind = Math.round(item.mind / (1 + (skillEffects.itemBoost ?? 0)));
			} else {
				item.mind = Math.round(item.mind * (1 + (skillEffects.itemBoost ?? 0)));
			}
			switch (item.type) {
				case "weapon":
					message += `${item.name}を取り出し、装備した！\n`;
					if (!(isBattle && isPhysical)) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						itemBonus.atk = (lv * 4) * (item.effect * 0.005);
						atk = atk + itemBonus.atk;
						if (item.effect >= 100) {
							message += `${config.rpgHeroName}のパワーが特大アップ！\n`;
						} else if (item.effect >= 70) {
							message += `${config.rpgHeroName}のパワーが大アップ！\n`;
						} else if (item.effect > 30) {
							message += `${config.rpgHeroName}のパワーがアップ！\n`;
						} else {
							message += `${config.rpgHeroName}のパワーが小アップ！\n`;
						}
					}
					break;
				case "armor":
					message += `${item.name}を取り出し、装備した！\n`;
					if (isTired) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						itemBonus.def = (lv * 4) * (item.effect * 0.005);
						def = def + itemBonus.def;
						if (item.effect >= 100) {
							message += `${config.rpgHeroName}の防御が特大アップ！\n`;
						} else if (item.effect >= 70) {
							message += `${config.rpgHeroName}の防御が大アップ！\n`;
						} else if (item.effect > 30) {
							message += `${config.rpgHeroName}の防御がアップ！\n`;
						} else {
							message += `${config.rpgHeroName}の防御が小アップ！\n`;
						}
					}
					break;
				case "medicine":
					message += `${item.name}を取り出し、食べた！\n`;
					if (data.enemy.pLToR) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper && !aggregateTokensEffects(data).redMode) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						if (item.effect > 200) {
							const overHeal = item.effect - 200;
							mindMsg(overHeal);
							itemBonus.atk = atk * (overHeal * 0.0025);
							itemBonus.def = def * (overHeal * 0.0025);
							atk = atk + itemBonus.atk;
							def = def + itemBonus.def;
							item.effect = 200;
						}
						const heal = Math.round((playerMaxHp - playerHp) * (item.effect * 0.005));
						playerHp += heal;
						if (heal > 0) {
							if (item.effect >= 100 && heal >= 50) {
								message += `${config.rpgHeroName}の体力が特大回復！\n${heal}ポイント回復した！\n`;
							} else if (item.effect >= 70 && heal >= 35) {
								message += `${config.rpgHeroName}の体力が大回復！\n${heal}ポイント回復した！\n`;
							} else if (item.effect > 30 && heal >= 15) {
								message += `${config.rpgHeroName}の体力が回復！\n${heal}ポイント回復した！\n`;
							} else {
								message += `${config.rpgHeroName}の体力が小回復！\n${heal}ポイント回復した！\n`;
							}
						}
					}
					break;
				case "poison":
					message += `${item.name}を取り出し、食べた！\n`;
					if (data.enemy.pLToR) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper && !aggregateTokensEffects(data).redMode) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						const dmg = Math.round(playerHp * (item.effect * 0.003) * (isSuper ? 0.5 : 1));
						playerHp -= dmg;
						if (item.effect >= 70 && dmg > 0) {
							message += `${config.rpgHeroName}はかなり調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`;
						} else if (item.effect > 30 && dmg > 0) {
							message += `${config.rpgHeroName}は調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`;
						} else {
							message += `あまり美味しくなかったようだ…${dmg > 0 ? `\n${dmg}ポイントのダメージを受けた！` : ""}\n`;
						}
					}
					break;
				default:
					break;
			}
			if (aggregateTokensEffects(data).showItemBonus) {
				const itemMessage = [`${itemBonus.atk > 0 ? `${serifs.rpg.status.atk}+${itemBonus.atk.toFixed(0)}` : ""}`, `${itemBonus.def > 0 ? `${serifs.rpg.status.def}+${itemBonus.def.toFixed(0)}` : ""}`].filter(Boolean).join(" / ");
				if (itemMessage) {
					message += `(${itemMessage})\n`;
				}
			}
		}

		// 敵のステータスを計算
		/** 敵の攻撃力 */
		let enemyAtk = (typeof data.enemy.atk === "function") ? data.enemy.atk(atk, def, spd) : lv * 3.5 * data.enemy.atk;
		/** 敵の防御力 */
		let enemyDef = (typeof data.enemy.def === "function") ? data.enemy.def(atk, def, spd) : lv * 3.5 * data.enemy.def;

		let hardEnemyFlg = false;

		if (skillEffects.enemyBuff && data.enemy.name !== endressEnemy(data).name && data.clearHistory.includes(data.enemy.name)) {
			hardEnemyFlg = true;
			if (!data.enemy.spd && enemyAtk + enemyDef <= (lv * 10.5)) data.enemy.spd = 3;
			if (!data.enemy.spd && enemyAtk + enemyDef <= (lv * 15.75)) data.enemy.spd = 2;
			const statusX = Math.floor(data.streak / 10) + 1;
			enemyAtk = (typeof data.enemy.atk === "function") ? data.enemy.atk(atk, def, spd) * (1.15 + (0.1 * statusX)) : lv * 3.5 * (data.enemy.atk + 1 + statusX / 2.5);
			enemyDef = (typeof data.enemy.def === "function") ? data.enemy.def(atk, def, spd) * (1 + (0.25 * statusX)) : lv * 3.5 * (data.enemy.def + statusX);
			if (typeof data.enemy.atkx === "number") data.enemy.atkx += 1 + (0.2 * statusX);
			if (typeof data.enemy.defx === "number") data.enemy.defx += 1 + (0.5 * statusX);
		}

		if (!skillEffects.enemyBuff && data.superUnlockCount > 5 && data.enemy.name !== endressEnemy(data).name && data.clearHistory.includes(data.enemy.name)) {
			if (typeof data.enemy.atk === "number") enemyAtk = lv * 3.5 * Math.max(data.enemy.atk, 3);
			if (typeof data.enemy.def === "number") enemyDef = lv * 3.5 * Math.max(data.enemy.def, 3);
			if (typeof data.enemy.atkx === "number") data.enemy.atkx += 1;
			if (typeof data.enemy.defx === "number") data.enemy.defx += 1;
		}

		if (skillEffects.enemyStatusBonus) {
			const enemyStrongs = (enemyAtk / (lv * 3.5)) * (getVal(data.enemy.atkx, [tp]) ?? 3) + (enemyDef / (lv * 3.5)) * (getVal(data.enemy.defx, [tp]) ?? 3);
			const bonus = Math.floor((enemyStrongs / 4) * skillEffects.enemyStatusBonus);
			atk = atk * (1 + (bonus / 100));
			def = def * (1 + (bonus / 100));
			if (bonus / skillEffects.enemyStatusBonus >= 5) {
				buff += 1;
				message += serifs.rpg.skill.enemyStatusBonus + "\n";
			}
		}

		const arpenX = 1 - (1 / (1 + (skillEffects.arpen ?? 0)));
		enemyDef -= Math.max(atk * arpenX, enemyDef * arpenX);

		if (skillEffects.firstTurnResist && count === 1 && isBattle && isPhysical) {
			buff += 1;
			message += serifs.rpg.skill.firstTurnResist + "\n";
		}

		if (skillEffects.tenacious && playerHpPercent < 0.5 && isBattle && isPhysical) {
			buff += 1;
			message += serifs.rpg.skill.tenacious + "\n";
		}

		// バフが1つでも付与された場合、改行を追加する
		if (buff > 0) message += "\n";

		const plusActionX = Math.ceil(skillEffects.plusActionX ?? 0);

		for (let actionX = 0; actionX < plusActionX + 1; actionX++) {

			/** バフを得た数。行数のコントロールに使用 */
			let buff = 0;

			/** プレイヤーのHP割合 */
			let playerHpPercent = playerHp / playerMaxHp;
			/** 敵のHP割合 */
			let enemyHpPercent = enemyHp / enemyMaxHp;

			/** 連続攻撃中断の場合の攻撃可能回数 0は最後まで攻撃 */
			let abort = 0;

			// 敵に最大ダメージ制限がある場合、ここで計算
			/** 1ターンに与えられる最大ダメージ量 */
			let maxdmg = data.enemy.maxdmg ? enemyMaxHp * data.enemy.maxdmg : undefined;

			// 土属性剣攻撃
			if (skillEffects.dart && isBattle && isPhysical && maxdmg) {
				buff += 1;
				message += serifs.rpg.skill.dart + "\n";
				maxdmg = maxdmg * (1 + skillEffects.dart);
			} else if (skillEffects.dart && !(isBattle && isPhysical && maxdmg)) {
				// 効果がない場合非戦闘時は、パワーに還元される
				atk = atk * (1 + skillEffects.dart * 0.5);
			}

			let trueDmg = 0;

			// 炎属性剣攻撃
			if (skillEffects.fire && (isBattle && isPhysical)) {
				buff += 1;
				message += serifs.rpg.skill.fire + "\n";
				trueDmg = Math.ceil(lv * skillEffects.fire);
			} else if (skillEffects.fire && !(isBattle && isPhysical)) {
				// 非戦闘時は、パワーに還元される
				atk = atk + Math.min(lv, 255) * 3.75 * skillEffects.fire;
			}

			if (skillEffects.guardAtkUp && data.totalResistDmg >= 300) {
				buff += 1;
				const totalResistDmg = Math.min(data.totalResistDmg, 1200)
				const guardAtkUpX = [0, 1, 2.4, 4.8, 8, 8];
				message += serifs.rpg.skill.guardAtkUp(Math.floor(totalResistDmg / 300)) + "\n";
				atk += (def * (skillEffects.guardAtkUp * guardAtkUpX[Math.floor(totalResistDmg / 300)]));
			}

			// 毒属性剣攻撃
			if (skillEffects.weak && count > 1) {
				if (isBattle && isPhysical) {
					buff += 1;
					message += serifs.rpg.skill.weak(data.enemy.dname ?? data.enemy.name) + "\n";
				}
				const enemyMinDef = enemyDef * 0.4
				const weakX = 1 - (1 / (1 + ((skillEffects.weak * (count - 1)))))
				enemyAtk -= Math.max(enemyAtk * weakX, atk * weakX);
				enemyDef -= Math.max(enemyDef * weakX, atk * weakX);
				if (enemyAtk < 0) enemyAtk = 0;
				if (enemyDef < enemyMinDef) enemyDef = enemyMinDef;
			}

			// バフが1つでも付与された場合、改行を追加する
			if (buff > 0) message += "\n";

			// 敵が中断能力持ちの場合、ここで何回攻撃可能か判定
			for (let i = 1; i < spd; i++) {
				if (data.enemy.abort && Math.random() < data.enemy.abort * (1 - (skillEffects.abortDown ?? 0))) {
					abort = i;
					break;
				}
			}

			if (!data.enemy.abort && skillEffects.abortDown) {
				// 効果がない場合は、パワーに還元される
				atk = atk * (1 + skillEffects.abortDown * (1 / 3));
			}

			const defMinusMin = skillEffects.defDmgUp && skillEffects.defDmgUp < 0 ? (1 / (-1 + (skillEffects.defDmgUp ?? 0)) * -1) : 1;

			const defDmgX = Math.max(1 *
				(Math.max(1 + (skillEffects.defDmgUp ?? 0), defMinusMin)) *
				(count === 1 && skillEffects.firstTurnResist ? (1 - (skillEffects.firstTurnResist ?? 0)) : 1) *
				(count === 2 && skillEffects.firstTurnResist && skillEffects.firstTurnResist > 1 ? (1 - ((skillEffects.firstTurnResist ?? 0) - 1)) : 1) *
				(1 - Math.min((skillEffects.tenacious ?? 0) * (1 - playerHpPercent), 0.9)), 0);

			const atkMinRnd = Math.max(0.2 + (isSuper ? 0.3 : 0) + (skillEffects.atkRndMin ?? 0), 0);
			const atkMaxRnd = Math.max(1.6 + (isSuper ? -0.3 : 0) + (skillEffects.atkRndMax ?? 0), 0);
			const defMinRnd = Math.max(0.2 + (skillEffects.defRndMin ?? 0), 0);
			const defMaxRnd = Math.max(1.6 + (isSuper ? -0.3 : 0) + (skillEffects.defRndMax ?? 0), 0);

			/** 予測最大ダメージ */
			let predictedDmg = Math.round((atk * tp * (atkMinRnd + atkMaxRnd)) * (1 / (((enemyDef * (getVal(data.enemy.defx, [tp]) ?? 3)) + 100) / 100))) * (abort || spd);

			// 予測最大ダメージは最大ダメージ制限を超えない
			if (maxdmg && predictedDmg > maxdmg) predictedDmg = maxdmg;

			/** 敵のターンが既に完了したかのフラグ */
			let enemyTurnFinished = false;

			// 敵先制攻撃の処理
			// spdが1ではない、または戦闘ではない場合は先制攻撃しない
			if (!data.enemy.spd && !data.enemy.hpmsg && !isTired) {
				/** クリティカルかどうか */
				const crit = Math.random() < (playerHpPercent - enemyHpPercent) * (1 - (skillEffects.enemyCritDown ?? 0));
				// 予測最大ダメージが相手のHPの何割かで先制攻撃の確率が判定される
				if (Math.random() < predictedDmg / enemyHp || (count === 3 && data.enemy.fire && (data.thirdFire ?? 0) <= 2)) {
					const rng = (defMinRnd + random(data, startCharge, skillEffects, true) * defMaxRnd);
					if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`;
					const critDmg = 1 + ((skillEffects.enemyCritDmgDown ?? 0) * -1);
					/** ダメージ */
					const dmg = getEnemyDmg(data, def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX);
					const noItemDmg = getEnemyDmg(data, def - itemBonus.def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX);
					const normalDmg = getEnemyDmg(data, lv * 3.75, tp, count, crit ? critDmg : false, enemyAtk, rng);
					
					// ダメージが負けるほど多くなる場合は、先制攻撃しない
					if (playerHp > dmg || (count === 3 && data.enemy.fire && (data.thirdFire ?? 0) <= 2)) {
						if (normalDmg > dmg) {
							data.totalResistDmg += (normalDmg - dmg);
						}
						playerHp -= dmg;
						message += (crit ? `**${data.enemy.defmsg(dmg)}**` : data.enemy.defmsg(dmg)) + "\n";
						if (noItemDmg - dmg > 1) {
							message += `(道具効果: -${noItemDmg - dmg})\n`;
						}
						if (playerHp <= 0 && !data.enemy.notEndure) {
							message += serifs.rpg.endure + "\n";
							playerHp = 1;
							data.endure = Math.max(data.endure - 1, 0);
						}
						message += "\n";
						enemyTurnFinished = true;
						if (data.enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
						if (dmg > (data.superMuscle ?? 0)) data.superMuscle = dmg;
					}
				}
			}

			if (skillEffects.allForOne || aggregateTokensEffects(data).allForOne) {
				atk = atk * spd * (1 + (skillEffects.allForOne ?? 0) * 0.1);
				if (itemBonus?.atk) itemBonus.atk = itemBonus.atk * spd * (1 + (skillEffects.allForOne ?? 0) * 0.1);
				spd = 1;
			}

			// 自身攻撃の処理
			// spdの回数分、以下の処理を繰り返す
			for (let i = 0; i < spd; i++) {
				const rng = (atkMinRnd + random(data, startCharge, skillEffects, false) * atkMaxRnd);
				if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`;
				let dmgBonus = (1 + (skillEffects.atkDmgUp ?? 0)) * dmgUp * (skillEffects.thunder ? 1 + (skillEffects.thunder * ((i + 1) / spd) / (spd === 1 ? 2 : spd === 2 ? 1.5 : 1)) : 1);
				/** クリティカルかどうか */
				let crit = Math.random() < Math.max((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0) + critUp), 0) + (skillEffects.critUpFixed ?? 0);
				const critDmg = 1 + ((skillEffects.critDmgUp ?? 0));
				if (skillEffects.noCrit) {
					crit = false;
					dmgBonus *= 1 + (Math.min(Math.max((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0) + critUp), 0) + (skillEffects.critUpFixed ?? 0), 1) * ((2 * critDmg) - 1))
				}
				/** ダメージ */
				let dmg = getAtkDmg(data, atk, tp, count, crit ? critDmg : false, enemyDef, enemyMaxHp, rng * dmgBonus) + trueDmg;
				const noItemDmg = getAtkDmg(data, atk - itemBonus.atk, tp, count, crit, enemyDef, enemyMaxHp, rng * dmgBonus) + trueDmg;
				// 最大ダメージ制限処理
				if (maxdmg && maxdmg > 0 && dmg > Math.round(maxdmg * (1 / ((abort || spd) - i)))) {
					// 最大ダメージ制限を超えるダメージの場合は、ダメージが制限される。
					dmg = Math.round(maxdmg * (1 / ((abort || spd) - i)));
					maxdmg -= dmg;
					crit = false;
				} else if (maxdmg && maxdmg > 0) {
					maxdmg -= dmg;
				}
				// メッセージの出力
				message += (crit ? `**${data.enemy.atkmsg(dmg)}**` : data.enemy.atkmsg(dmg)) + "\n";
				enemyHp -= dmg;
				if (dmg - noItemDmg > 1) {
					message += `(道具効果: +${dmg - noItemDmg})\n`;
				}
				// 敵のHPが0以下になった場合は、以降の攻撃をキャンセル
				if (enemyHp <= 0) break;
				// 攻撃が中断される場合
				if ((i + 1) === abort) {
					if (data.enemy.abortmsg) message += data.enemy.abortmsg + "\n";
					break;
				}
			}

			// 覚醒状態でこれが戦闘なら炎で追加攻撃
			if (isSuper && enemyHp > 0 && (isBattle && isPhysical)) {
				message += serifs.rpg.fireAtk(data.enemy.dname ?? data.enemy.name) + `\n`;
				data.fireAtk = (data.fireAtk ?? 0) + 10;
			}

			// 勝利処理
			if (enemyHp <= 0) {
				// エンドレスモードかどうかでメッセージ変更
				if (data.enemy.name !== endressEnemy(data).name) {
					message += "\n" + data.enemy.winmsg + "\n\n" + serifs.rpg.win;
				} else {
					if ((data.endress ?? 0) === 99 && (data.maxEndress ?? -1) < 99) {
						message += "\n" + serifs.rpg.allStageClear;
						if (!data.items) data.items = [];
						data.items.push({ name: "長き旅の思い出", limit: (data) => true, desc: "長い旅をした証です", price: 1, type: "token", effect: { journeyAllClear: true }},)
						data.journeyClearStats = {lv: data.lv, skill: data.skill, atk: data.atk, def: data.def}
						data.coin += 1000;
					} else {
						message += "\n" + data.enemy.winmsg + (data.endressFlg ? "\n" + serifs.rpg.journey.win : "");
					}
					if ((data.endress ?? 0) > (data.maxEndress ?? -1)) data.maxEndress = data.endress;
					data.endress = (data.endress ?? 0) + 1;
				}
				if (hardEnemyFlg) data.hardWinCount = (data.hardWinCount ?? 0) + 1;
				// 連続勝利数
				data.streak = (data.streak ?? 0) + 1;
				// 1ターンで勝利した場合はさらに+1
				if (data.count == 1) data.streak = (data.streak ?? 0) + 1;
				data.winCount = (data.winCount ?? 0) + 1;
				// クリアした敵のリストを追加
				if (!(data.clearEnemy ?? []).includes(data.enemy.name)) data.clearEnemy.push(data.enemy.name);
				if (!(data.clearHistory ?? []).includes(data.enemy.name)) data.clearHistory.push(data.enemy.name);
				// ～を倒す系の記録
				if (data.enemy.name === ":mk_hero_8p:" && !data.aHeroLv) {
					data.aHeroLv = data.lv;
					data.aHeroClearDate = Date.now();
				}
				if (data.enemy.name === data.revenge) {
					data.revenge = null;
				}
				// 次の試合に向けてのパラメータセット
				data.enemy = null;
				data.count = 1;
				data.php = playerMaxHp + 3;
				data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5;
				data.maxTp = 0;
				data.fireAtk = 0;
				data.totalResistDmg = 0;
				break;
			} else {
				let enemyAtkX = 1;
				// 攻撃後発動スキル効果
				// 氷属性剣攻撃
				if ((isBattle && isPhysical && !isTired) && Math.random() < (skillEffects.ice ?? 0)) {
					message += serifs.rpg.skill.ice(data.enemy.dname ?? data.enemy.name) + `\n`;
					enemyTurnFinished = true;
				} else if (!(isBattle && isPhysical && !isTired)) {
					// 非戦闘時は氷の効果はないが、防御に還元される
					def = def * (1 + (skillEffects.ice ?? 0));
				}
				// 光属性剣攻撃
				if ((isBattle && isPhysical && !isTired) && Math.random() < (skillEffects.light ?? 0)) {
					message += serifs.rpg.skill.light(data.enemy.dname ?? data.enemy.name) + `\n`;
					enemyAtkX = enemyAtkX * 0.5;
				} else if (!(isBattle && isPhysical && !isTired)) {
					// 非戦闘時は光の効果はないが、防御に還元される
					def = def * (1 + (skillEffects.light ?? 0) * 0.5);
				}
				// 闇属性剣攻撃
				if (data.enemy.spd && data.enemy.spd >= 2 && Math.random() < (skillEffects.dark ?? 0) * 2) {
					message += serifs.rpg.skill.spdDown(data.enemy.dname ?? data.enemy.name) + `\n`;
					data.enemy.spd = 1;
				} else if ((isBattle && isPhysical) && data.ehp > 150 && Math.random() < (skillEffects.dark ?? 0)) {
					const dmg = Math.floor(enemyHp / 2);
					message += serifs.rpg.skill.dark(data.enemy.dname ?? data.enemy.name, dmg) + `\n`;
					enemyHp -= dmg;
				} else if (!(isBattle && isPhysical)) {
					// 非戦闘時は闇の効果はないが、防御に還元される
					def = def * (1 + (skillEffects.dark ?? 0) * 0.3);
				}
				// 敵のターンが既に終了していない場合
				/** 受けた最大ダメージ */
				let maxDmg = 0;
				if (!enemyTurnFinished) {
					message += "\n";
					for (let i = 0; i < (data.enemy.spd ?? 1); i++) {
						const rng = (defMinRnd + random(data, startCharge, skillEffects, true) * defMaxRnd);
						if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`;
						/** クリティカルかどうか */
						const crit = Math.random() < (playerHpPercent - enemyHpPercent) * (1 - (skillEffects.enemyCritDown ?? 0));
						const critDmg = 1 + ((skillEffects.enemyCritDmgDown ?? 0) * -1);
						/** ダメージ */
						const dmg = getEnemyDmg(data, def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX * enemyAtkX);
						const noItemDmg = getEnemyDmg(data, def - itemBonus.def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX * enemyAtkX);
						const normalDmg = getEnemyDmg(data, lv * 3.75, tp, count, crit ? critDmg : false, enemyAtk, rng);
						if (normalDmg > dmg) {
							data.totalResistDmg += (normalDmg - dmg);
						}
						playerHp -= dmg;
						message += (crit ? `**${data.enemy.defmsg(dmg)}**` : data.enemy.defmsg(dmg)) + "\n";
						if (noItemDmg - dmg > 1) {
							message += `(道具効果: -${noItemDmg - dmg})\n`;
						}
						if (dmg > maxDmg) maxDmg = dmg;
						if (data.enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
					}
					// HPが0で食いしばりが可能な場合、食いしばる
					const endure = 0.1 + (0.1 * (data.endure ?? 0)) - (count * 0.05);
					if (playerHp <= 0 && !data.enemy.notEndure && Math.random() < endure * (1 + (skillEffects.endureUp ?? 0))) {
						message += serifs.rpg.endure + "\n";
						playerHp = 1;
						data.endure = Math.max(data.endure - 1, 0);
					}
					if (playerHp <= (30 + lv) && serifs.rpg.nurse && Math.random() < 0.01 && !data.enemy.notEndure) {
						message += "\n" + serifs.rpg.nurse + "\n" + (playerMaxHp - playerHp) + "ポイント回復した！\n";
						playerHp = playerMaxHp;
					}
					if (maxDmg > (data.superMuscle ?? 0) && playerHp > 0) data.superMuscle = maxDmg;
				}
				// 敗北処理
				if (playerHp <= 0) {
					// 逃走？
					// スキル数までは100%、それ以上は成功の度に半減
					if (skillEffects.escape && ((data.escape ?? 0) < skillEffects.escape || Math.random() < 1 / (2 ** ((data.escape ?? 0) + 1 - skillEffects.escape)))) {
						// 逃走成功の場合
						message += "\n" + (data.enemy.escapemsg ?? (isBattle ? serifs.rpg.escape : serifs.rpg.escapeNotBattle));
						data.escape = (data.escape ?? 0) + 1;
					} else {
						// エンドレスモードかどうかでメッセージ変更
						if (data.enemy.name !== endressEnemy(data).name) {
							message += "\n" + data.enemy.losemsg + "\n\n" + serifs.rpg.lose;
							data.revenge = data.enemy.name;
						} else {
							if ((data.maxEndress ?? -1) < 99) {
								const minusStage = Math.min(Math.ceil((data.endress ?? 0) / 2), 3 - ((data.endress ?? 0) > (data.maxEndress ?? -1) ? 0 : (data.endress ?? 0) >= ((data.maxEndress ?? -1) / 2) ? 1 : 2));
								message += "\n" + data.enemy.losemsg + (minusStage ? `\n` + serifs.rpg.journey.lose(minusStage) : "");
								if ((data.endress ?? 0) - 1 > (data.maxEndress ?? -1)) data.maxEndress = data.endress - 1;
								data.endress = (data.endress ?? 0) - minusStage;
							} else {
								message += "\n" + data.enemy.losemsg;
							}
						}
						// これが任意に入った旅モードだった場合は、各種フラグをリセットしない
						if (!data.endressFlg) {
							data.streak = 0;
							data.clearEnemy = [];
						}
						data.escape = 0;
						// 敗北で能力上昇ボーナス
						bonus += Math.floor(2 * (1 + (skillEffects.loseBonus ?? 0)));
						//data.atk = (data.atk ?? 0) + bonus;
						//data.def = (data.def ?? 0) + bonus;
					}
					// 食いしばり成功率を上げる
					data.endure = (data.endure ?? 0) + 1;
					// 次の試合に向けてのパラメータセット
					data.enemy = null;
					data.count = 1;
					data.php = playerMaxHp + 13;
					data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5;
					data.maxTp = 0;
					data.fireAtk = 0;
					data.totalResistDmg = 0;
					break;
				} else {
					// 決着がつかない場合
					if (actionX === plusActionX) {
						message += showStatus(data, playerHp, enemyHp, enemyMaxHp, me) + "\n\n" + serifs.rpg.next;
					} else {
						message += showStatus(data, playerHp, enemyHp, enemyMaxHp, me) + "\n\n";
					}
					data.count = (data.count ?? 1) + 1;
					count = data.count;
					data.php = playerHp;
					data.ehp = enemyHp;
				}
			}
		}

		if (skillEffects.charge && data.charge > 0) {
			message += "\n\n" + serifs.rpg.skill.charge;
		} else if (data.charge < 0) {
			data.charge = 0;
		}

		// レベルアップ処理
		data.lv = (data.lv ?? 1) + 1;
		let atkUp = (2 + Math.floor(Math.random() * 4));
		let totalUp = 7;
		while (Math.random() < 0.335) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
		}

		if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

		if (bonus) {
			atkUp += Math.round(bonus);
			totalUp += Math.round(bonus * 2);
      bonus = 0;
		}

		if (skillEffects.statusBonus && skillEffects.statusBonus > 0 && data.lv % Math.max(2 / skillEffects.statusBonus, 1) === 0) {
			const upBonus = Math.ceil(skillEffects.statusBonus / 2);
			for (let i = 0; i < upBonus; i++) {
				if (Math.random() < 0.5) atkUp += 1;
			}
		}

		while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
		}

		if (data.atk > 0 && data.def > 0) {
			/** 攻撃力と防御力の差 */
			const diff = data.atk - data.def;
			const totalrate = 0.2 + Math.min(Math.abs(diff) * 0.005, 0.3);
			const rate = (Math.pow(0.5, Math.abs(diff / 100)) * (totalrate / 2));
			if (Math.random() < (diff > 0 ? totalrate - rate : rate)) atkUp = totalUp;
			else if (Math.random() < (diff < 0 ? totalrate - rate : rate)) atkUp = 0;
		}

		if ((data.maxEndress ?? -1) >= 99 && calcSevenFever([data.atk, data.def]) > 0 && (!data?.enemy?.name || data.enemy.name === endressEnemy(data).name)) {
			if (calcSevenFever([data.atk]) > calcSevenFever([data.def])) atkUp = 0;
			if (calcSevenFever([data.atk]) < calcSevenFever([data.def])) atkUp = totalUp;
		}
		data.atk = (data.atk ?? 0) + atkUp;
		data.def = (data.def ?? 0) + totalUp - atkUp;
		data.exp = 0;


		/** 追加表示メッセージ */
		let addMessage = preLevelUpProcess(data);

		if (!msg.includes(Array.isArray(serifs.rpg.command.onemore) ? serifs.rpg.command.onemore : [serifs.rpg.command.onemore])) data.coinGetCount += 1 + (Math.random() < 0.5 ? 1 : 0);
		if (data.coinGetCount >= 5) {
			data.coin += 5;
			data.coinGetCount -= 5;
			addMessage += `\n${serifs.rpg.getCoin(5)}`;
		}

		const nowPlay = /\d{4}\/\d{1,2}\/\d{1,2}(\/\d{2})?/.exec(nowTimeStr);
		const nextPlay = !nowPlay?.[1] ? 12 + (skillEffects.rpgTime ?? 0) : nowPlay[1] == "/12" ? 18 + (skillEffects.rpgTime ?? 0) : nowPlay[1] == "/18" ? 24 + (skillEffects.rpgTime ?? 0) : 12 + (skillEffects.rpgTime ?? 0);
		const minusDurability = amuletMinusDurability(data);

		message += [
			`\n\n${serifs.rpg.lvUp}`,
			`  ${serifs.rpg.status.lv} : ${data.lv ?? 1} (+1)`,
			`  ${serifs.rpg.status.atk} : ${data.atk ?? 0} (+${atkUp + bonus})`,
			`  ${serifs.rpg.status.def} : ${data.def ?? 0} (+${totalUp - atkUp + bonus})`,
			addMessage,
			minusDurability ? "\n" + minusDurability : "",
			`\n${serifs.rpg.nextPlay(nextPlay == 24 ? "明日" : nextPlay + "時")}`,
			data.lv >= rpgData.maxLv ? "" : data.lastOnemorePlayedAt !== getDate() ? "(無料でおかわり可能)" : data.coin >= needCoin ? `(${config.rpgCoinShortName}でおかわり可能 ${data.coin > 99 ? "99+" : data.coin} / ${needCoin})` : "",
		].filter(Boolean).join("\n");

		const calcRerollOrbCount = Math.max(Math.min(Math.floor((data.lv - skillBorders[1]) / ((skillBorders[2] - skillBorders[1]) / 5)), 5), 0) +
			Math.max(Math.min(Math.floor((data.lv - skillBorders[2]) / ((skillBorders[3] - skillBorders[2]) / 10)), 10), 0) +
			Math.max(Math.min(Math.floor((data.lv - skillBorders[3]) / ((skillBorders[4] - skillBorders[3]) / 17)), 17), 0) +
			Math.max(Math.floor((data.lv + 1 - skillBorders[4]) / (skillBorders[4] / 127.5)), 0) +
			(Math.max(Math.floor((data.lv - (skillBorders[4] + 1)) / ((skillBorders[4] + 1) / 4)), 0) * 16);

		if ((data.totalRerollOrb ?? 0) < calcRerollOrbCount) {
			const getNum = calcRerollOrbCount - (data.totalRerollOrb ?? 0);
			data.rerollOrb = (data.rerollOrb ?? 0) + getNum;
			data.totalRerollOrb = (data.totalRerollOrb ?? 0) + getNum;
			message += serifs.rpg.getRerollOrb(getNum);
		}

		msg.friend.setPerModulesData(this, data);

		if (data.lv === 255) {
			message += serifs.rpg.reachMaxLv;
		}

		if (data.skills?.length >= 5 && !data.items.filter((x) => x.name === "裏ショップ入場の札").length && data.coin >= 99 && data.clearHistory.includes(":mk_chickenda_gtgt:")) {
			message += serifs.rpg.shop2remind
		}

		// 色解禁確認
		const newColorData = colors.map((x) => x.unlock(data));
		/** 解禁した色 */
		let unlockColors = "";
		for (let i = 0; i < newColorData.length; i++) {
			if (!colorData[i] && newColorData[i]) {
				unlockColors += colors[i].name;
			}
		}
		if (unlockColors) {
			message += serifs.rpg.newColor(unlockColors);
		}

		msg.reply(`<center>${message}</center>`, {
			cw,
			...(config.rpgReplyVisibility ? { visibility: config.rpgReplyVisibility } : {})
		});

		return {
			reaction: me
		};
	}

	@autobind
	private replayOkawariHook(key: any, msg: Message, data: any) {
		this.log("replayOkawari");
		if (key.replace("replayOkawari:", "") !== msg.userId) {
			this.log(msg.userId + " : " + key.replace("replayOkawari:", ""));
			return {
				reaction: 'hmm'
			};
		}
		if (msg.text.includes('はい')) {
			this.log("replayOkawari: Yes");
			this.unsubscribeReply(key);
			if (msg.friend.doc?.perModulesData?.rpg) msg.friend.doc.perModulesData.rpg.replayOkawari = true;
			msg.friend.save();
			msg.reply(serifs.rpg.oneMore.buyComp, { visibility: "specified" });
			return { reaction: ':mk_muscleok:' };
		} else if (msg.text.includes('いいえ')) {
			this.log("replayOkawari: No");
			this.unsubscribeReply(key);
			return { reaction: ':mk_muscleok:' };
		} else {
			this.log("replayOkawari: ?");
			msg.reply(serifs.core.yesOrNo, { visibility: "specified" }).then(reply => {
				this.subscribeReply("replayOkawari:" + msg.userId, reply.id);
			});
			return { reaction: 'hmm' };
		}
	}

	@autobind
	private async rpgAccountListAdd() {
		const lists = await this.ai.api("users/lists/list", {}) as List[];
		this.rpgPlayerList = lists.find((x) => x.name === "rpgPlayers");
		if (!this.rpgPlayerList) {
			this.rpgPlayerList = await this.ai.api("users/lists/create", { name: "rpgPlayers" }) as List;
			if (!this.rpgPlayerList) return;
			console.log("rpgPlayers List Create: " + this.rpgPlayerList.id);
		}
		if (this.rpgPlayerList) {
			console.log("rpgPlayers List: " + this.rpgPlayerList.id);
			const friends = this.ai.friends.find() ?? [];
			const rpgPlayers = friends.filter((x) => x.perModulesData?.rpg?.lv && x.perModulesData?.rpg?.lv >= 20 && !x.perModulesData?.rpg?.isBlocked);
			const listUserIds = new Set(this.rpgPlayerList.userIds);
			let newRpgPlayersUserIds = new Set();

			for (const rpgPlayer of rpgPlayers) {
				if (!listUserIds.has(rpgPlayer.userId)) {
					newRpgPlayersUserIds.add(rpgPlayer.userId);
				}
			}

			newRpgPlayersUserIds.forEach(async (x) => {
				if (this.rpgPlayerList?.id) await this.ai.api("users/lists/push", { listId: this.rpgPlayerList.id, userId: x }).then(async (res) => {
						if (typeof x === "string" && res?.response?.body?.error?.code === "YOU_HAVE_BEEN_BLOCKED") {
								const doc = this.ai.lookupFriend(x)
								if (doc) {
									const data = doc.getPerModulesData(this)
									data.isBlocked = true;
									doc.setPerModulesData(this, data);
									console.log("blocked: " + x);
								}
						}
				});
				console.log("rpgPlayers Account List Push: " + x);
			});
		}
	}
}

/**
 * @packageDocumentation
 *
 * RPGモジュール本体
 *
 * @remarks
 * メンションにより起動し、ターン制の戦闘・レベルアップ・アイテム収集・レイド討伐等を提供する。
 * mentionHook でコマンド分岐し、各ハンドラが通常RPG・木人モード・ショップ・殿堂等を処理する。
 *
 * @public
 */
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
import { shopCustomReply, shopCustomContextHook } from './shop-custom';
import { shop2Reply } from './shop2';
import { skills, Skill, SkillEffect, getSkill, skillReply, skillCalculate, aggregateSkillsEffects, calcSevenFever, amuletMinusDurability, countDuplicateSkillNames, skillBorders, canLearnSkillNow } from './skills';
import { start, raidInstall, raidContextHook, raidTimeoutCallback } from './raid';
import type { Raid } from './raid';
import { initializeData, getColor, getAtkDmg, getEnemyDmg, showStatus, getPostCount, getPostX, getVal, random, preLevelUpProcess, deepClone } from './utils';
import { applyKazutoriMasterHiddenBonus, calculateArpen, calculateStats, applySoftCapPow2, ensureKazutoriMasterHistory, getKazutoriMasterMessage } from './battle';
import Friend from '@/friend';
import type { FriendDoc } from '@/friend';
import config from '@/config';
import * as loki from 'lokijs';

type List = {
        id: string;
        createdAt: any;
        name: string;
        userIds: string[];
};

type LokiDoc<T> = T & { $loki: number; meta?: unknown };
type FriendDocWithMeta = LokiDoc<FriendDoc>;

export default class extends Module {
	public readonly name = 'rpg';

	private rpgPlayerList: List | undefined;

	private raids: loki.Collection<Raid>;

	// -------- モジュールセットアップ・フック --------

	/**
	 * モジュールのインストール処理
	 *
	 * @returns mentionHook / contextHook / timeoutCallback を返し、藍に登録する
	 * @public
	 */
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

	/**
	 * メンションフック
	 *
	 * RPGコマンドの受信を処理し、ヘルプ・アイテム・殿堂・ショップ・木人・通常RPG等に振り分ける。
	 *
	 * @param msg メッセージ
	 * @returns リアクションオブジェクト、または false（他モジュールへ）
	 * @internal
	 */
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
    if (msg.includes(Array.isArray(serifs.rpg.command.shop) ? serifs.rpg.command.shop : [serifs.rpg.command.shop]) && msg.includes(Array.isArray(serifs.rpg.command.shopCustom) ? serifs.rpg.command.shopCustom : [serifs.rpg.command.shopCustom])) {
            const data = initializeData(this, msg);
            if ((!msg.user.host && msg.user.username === config.master) || data.items.filter((x) => x.name === "カスタムショップ入場の札").length) {
                    // カスタムショップモード
                    return shopCustomReply(this, this.ai, msg);
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

	/**
	 * コンテキストフック
	 *
	 * おかわり返信・ショップ購入・スキル選択・レイド参加等の返信を処理する。
	 *
	 * @param key コンテキストキー（例: replayOkawari:userId, shopBuy:xxx, selectSkill:userId）
	 * @param msg メッセージ
	 * @param data コンテキストデータ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
	@autobind
	private async contextHook(key: string, msg: Message, data: unknown) {
          if (typeof key === "string" && key.startsWith("replayOkawari:")) {
            return this.replayOkawariHook(key, msg, data);
          }
          if (typeof key === "string" && key.startsWith("shopBuy:")) {
                  return shopContextHook(this, key, msg, data);
          }
          if (typeof key === "string" && key.startsWith("shopCustom:")) {
                  return shopCustomContextHook(this, this.ai, key, msg, data);
          }
          if (typeof key === "string" && key.startsWith("selectSkill:")) {
                  return this.selectSkillHook(key, msg, data);
          }
          return raidContextHook(key, msg, data);
	}

	/**
	 * タイムアウトコールバック
	 *
	 * レイド投稿のタイムアウト時に呼ばれ、レイドへの再ノートを行う。
	 *
	 * @param data タイムアウトデータ（postId 等）
	 * @returns raidTimeoutCallback の戻り値
	 * @internal
	 */
	@autobind
	private timeoutCallback(data) {

		return raidTimeoutCallback(data);

	}

	// -------- レベル・スケジュール管理 --------

	/**
	 * 最大レベルを moduleData に保存する。
	 * install 時に呼ばれ、全ユーザーの最高Lvを記録する。
	 *
	 * @internal
	 */
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

	/**
	 * 全ユーザー中の最高RPGレベルを取得する
	 *
	 * @returns 最大255までのレベル
	 * @internal
	 */
	@autobind
	private getMaxLevel() {
		const maxLv = this.ai.friends.find().filter(x => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1).reduce((acc, cur) => acc > cur.perModulesData.rpg.lv ? acc : cur.perModulesData.rpg.lv, 0);
		return maxLv > 255 ? 255 : maxLv;
	}

	/**
	 * 定期的に最大Lvを更新し、レベルアップのリマインド投稿を行う
	 *
	 * 0/12/18時の1〜5分に実行される。
	 *
	 * @internal
	 */
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

	/**
	 * レベルアップのリマインド投稿を行う
	 *
	 * @internal
	 */
	@autobind
	private remindLevelUpdate() {
		const filteredColors = colors.filter(x => x.id > 1 && !x.reverseStatus && !x.alwaysSuper && !x.hidden).map(x => x.name);
		const me = Math.random() < 0.8 ? colors.find(x => x.default)?.name ?? colors[0].name : filteredColors[Math.floor(Math.random() * filteredColors.length)];
		this.ai.post({
			text: serifs.rpg.remind(me, new Date().getHours()),
		});
	}

	/**
	 * 日付切り替え時に投稿数を記録する
	 *
	 * 23時55〜59分に実行される。todayNotesCount / yesterdayNotesCount を更新する。
	 *
	 * @internal
	 */
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

	// -------- ヘルプ / アイテム / 殿堂 ハンドラ --------

	/**
	 * RPG ヘルプコマンドを処理する
	 *
	 * @param msg メンションメッセージ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
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
			if (data.items.filter((x) => x.name === "カスタムショップ入場の札").length) {
				helpMessage.push(serifs.rpg.help.shopCustom);
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

	/**
	 * RPG アイテムコマンドを処理し、所持アイテム一覧を表示する
	 *
	 * @param msg メンションメッセージ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
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

	/**
	 * RPG 殿堂コマンドを処理し、ランキングを表示する
	 *
	 * @param msg メンションメッセージ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
	@autobind
	private handleRecordCommands(msg: Message) {
		const data = initializeData(this, msg);
		if (!data.lv) return { reaction: 'confused' };

		let message: string[] = [];
                const allData = this.ai.friends.find() as FriendDocWithMeta[];

                const createRankMessage = (
                        score: number | null,
                        label: string,
                        dataKey: string,
                        options?: { prefix?: string; suffix?: string; addValue?: number; firstPlaceAppend?: (friend: FriendDocWithMeta | undefined, score?: number) => string | undefined; }
                ) => {
                        const entries = allData
                                .map(friend => {
                                        let value;
                                        if (dataKey.includes(".")) {
                                                // 動的にプロパティにアクセスするための処理
                                                const keys = dataKey.replace(/\[(\w+)\]/g, '.$1').split('.');
                                                value = keys.reduce((acc, key) => acc?.[key], friend.perModulesData?.rpg);
                                        } else {
                                                // 既存の単純なキーでのプロパティアクセス
                                                value = friend.perModulesData?.rpg?.[dataKey];
                                        }
                                        return { friend, value };
                                })
                                .filter(entry => entry.value !== undefined);

                        const sortedEntries = entries.sort((a, b) => (b.value as number) - (a.value as number)); // 降順でソート
                        const values = sortedEntries.map(entry => entry.value as number);
                        const firstPlaceAppend = options?.firstPlaceAppend?.(sortedEntries[0]?.friend, sortedEntries[0]?.value as number | undefined);

			if (score !== null && score !== undefined) {
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
					} else if (rank === 1 && values?.[1]) {
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

                                return `${label}\n1位：${(values?.[0] + (options?.addValue || 0)).toLocaleString()} ${rankmsg}${firstPlaceAppend ? `\n${firstPlaceAppend}` : ""}${sameRankCount < 9 && values.length >= 10 ? `\n10位：${(values?.[9] + (options?.addValue || 0)).toLocaleString()} ${rankmsg2}` : ""}`;
                        }
                };

                const createFirstPlaceRaidSkillMessage = (enemyName: string) => (friend: FriendDocWithMeta | undefined, score: number | undefined) => {
                        if (!friend || score === null || score === undefined) return undefined;

                        type RaidWithMeta = LokiDoc<Raid>;
                        type AttackerWithSkills = Raid['attackers'][number] & {
                                skillsStr: NonNullable<Raid['attackers'][number]['skillsStr']>;
                        };

                        const raidHistory = (this.raids
                                ?.find({
                                        isEnded: true,
                                }) as RaidWithMeta[] | undefined)
                                ?.filter((raid) => raid.enemy?.name === enemyName);

                        const latestMatched = raidHistory
                                ?.map((raid) => ({
                                        raid,
                                        attacker: raid.attackers?.find((attacker) => attacker.user?.id === friend.userId && attacker.dmg === score),
                                }))
                                .filter((entry): entry is { raid: RaidWithMeta; attacker: Raid['attackers'][number] } => Boolean(entry.attacker))
                                .filter((entry): entry is { raid: RaidWithMeta; attacker: AttackerWithSkills } => {
                                        const skillsStr = entry.attacker.skillsStr;
                                        return Boolean(skillsStr && (skillsStr.skills || skillsStr.amulet));
                                })
                                .reduce<{ raid: RaidWithMeta; attacker: AttackerWithSkills } | undefined>((latest, current) => {
                                        if (!latest) return current;
                                        const latestFinishedAt = latest.raid.finishedAt ?? latest.raid.startedAt;
                                        const currentFinishedAt = current.raid.finishedAt ?? current.raid.startedAt;
                                        return (currentFinishedAt ?? 0) > (latestFinishedAt ?? 0) ? current : latest;
                                }, undefined);

                        if (!latestMatched) return undefined;

                        const skillsStr = latestMatched.attacker.skillsStr;
                        const skills = skillsStr?.skills;
                        const amulet = skillsStr?.amulet ? `お守り ${skillsStr.amulet}` : undefined;
                        const parts = [skills, amulet].filter(Boolean);

                        if (!parts.length) return undefined;

                        return `<small>${parts.join(" ")}</small>`;
                };

		const canShowHatogurumaScore = (data.raidScore?.[":hatoguruma:"] ?? 0) >= 100;

		if (msg.includes(["ランク"])){

			message.push(createRankMessage(null, "Lv", "lv"));
			message.push(createRankMessage(null, "最大木人ダメージ", "bestScore", { suffix: "ダメージ" }));
			message.push(createRankMessage(null, "旅モード最高クリア記録", "maxEndress", { prefix: "ステージ", addValue: 1 }));
			message.push(createRankMessage(null, "耐えたダメージ", "superMuscle", { suffix: "ダメージ" }));
			message.push(createRankMessage(null, "運の良さ", "maxStatusUp", { suffix: "pts" }));
			message.push(createRankMessage(null, "壺購入数", "jar", { suffix: "個" }));
                        if (data.raidScore) {
                                for (const [key, value] of Object.entries(data.raidScore)) {
                                        if (value && typeof value === "number") {
                                                const enemy = raidEnemys.find((x) => x.name === key);
                                                message.push(`${createRankMessage(null, key + ` 最大${enemy?.scoreMsg ?? "ダメージ"}`, `raidScore.${key}`, { suffix: data.clearRaid?.includes(key) ? `${enemy?.scoreMsg2 ?? "ダメージ"} ⭐️` : `${enemy?.scoreMsg2 ?? "ダメージ"}`, firstPlaceAppend: createFirstPlaceRaidSkillMessage(key) })}`);
                                        }
                                }
                        }
			if (canShowHatogurumaScore) {
				message.push(createRankMessage(null, ":hatoguruma: マスタースコア", "hatogurumaMaxScore", { suffix: "pts" }));
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

			if (data.superMuscle) {
				message.push(createRankMessage(data.superMuscle, "耐えたダメージ", "superMuscle", { suffix: "ダメージ" }));
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

			if (canShowHatogurumaScore && (data.hatogurumaMaxScore ?? 0) > 0) {
				message.push(createRankMessage(data.hatogurumaMaxScore, ":hatoguruma: マスタースコア", "hatogurumaMaxScore", { suffix: "pts" }));
			}

			if (data.clearRaidNum) {
				message.push(createRankMessage(data.clearRaidNum, "7ターン戦ったレイドボス (⭐️)", "clearRaidNum", { suffix: "種類" }));
			}
		}


		if (message.length === 0) return { reaction: 'confused' };
		msg.reply("\n" + message.join("\n\n"));
		return { reaction: "love" };
	}

	// -------- 管理者コマンド --------

	/**
	 * RPG admin コマンドを処理する（管理者専用）
	 *
	 * @param msg メンションメッセージ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
	@autobind
	private handleAdminCommands(msg: Message) {
		if (msg.includes(["revert"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			if (id) {
				const friend = this.ai.lookupFriend(id);
				if (friend === null || friend === undefined) return { reaction: ":mk_hotchicken:" };
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
				if (friend === null || friend === undefined) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.lastShopVisited = "";
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["tReset"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			if (id) {
				const friend = this.ai.lookupFriend(id);
				if (friend === null || friend === undefined) return { reaction: ":mk_hotchicken:" };
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
				if (friend === null || friend === undefined) return { reaction: ":mk_hotchicken:" };
				let skillData = skills.find((x) => x.name.startsWith(skill))
				if (!skillData) {
					skillData = skills.find((x) => x.name.includes(skill))
					if (!skillData) return { reaction: ":mk_hotchicken:" };
				}
				friend.doc.perModulesData.rpg.skills[num] = skillData;
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["giveCoin"])) {
			const id = /\w{10,}/.exec(msg.extractedText)?.[0];
			const num = /\s(\d+)\s/.exec(msg.extractedText)?.[1];
			if (id && num) {
				const friend = this.ai.lookupFriend(id);
				if (friend === null || friend === undefined) return { reaction: ":mk_hotchicken:" };
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
				if (friend === null || friend === undefined) return { reaction: ":mk_hotchicken:" };
				friend.doc.perModulesData.rpg.coin = parseInt(num);
				friend.save();
				return { reaction: "love" };
			}
		}
		if (msg.includes(["startRaid"])) {
			start(undefined, msg.includes(["recent"]) ? "r" : msg.includes(["hato"]) ? "h" : "");
			return { reaction: "love" };
		}
		if (msg.includes(["skillPopularity"])) {
			const { skillNameCountMap } = skillCalculate(this.ai);
			const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly);
			const totalSkillCount = filteredSkills.reduce((acc, skill) => acc + (skillNameCountMap.get(skill.name) || 0), 0);
			const averageBase = filteredSkills.length ? totalSkillCount / filteredSkills.filter((x) => !x.notLearn).length : 0;
			const entries = filteredSkills
				.filter((skill) => !skill.notLearn)
				.map((skill) => ({ short: skill.short ?? skill.name, count: skillNameCountMap.get(skill.name) ?? 0 }))
				.sort((a, b) => b.count - a.count);
			const filteredSkillNames = new Set(filteredSkills.map((skill) => skill.name));
			const lines: string[] = [`平均: ${averageBase.toFixed(2)}`, ""];
			for (let i = 0; i < entries.length; i += 3) {
				const chunk = entries.slice(i, i + 3).map((entry) => `${entry.short}: ${entry.count}`);
				lines.push(chunk.join('  '));
			}
			const excludedEntries = Array.from(skillNameCountMap.entries())
				.map(([name, count]) => {
					const skill = skills.find((x) => x.name === name);
					return { skill, count: count ?? 0 };
				})
				.filter(({ skill, count }) => skill && !skill.notLearn && !filteredSkillNames.has(skill.name) && count > 0)
				.map(({ skill, count }) => ({ short: skill!.short ?? skill!.name, count }))
				.sort((a, b) => b.count - a.count);
			if (excludedEntries.length) {
				lines.push("", "--------------------", "");
				for (let i = 0; i < excludedEntries.length; i += 3) {
					const chunk = excludedEntries.slice(i, i + 3).map((entry) => `${entry.short}: ${entry.count}`);
					lines.push(chunk.join('  '));
				}
			}
			msg.reply(lines.join('\n'));
			return { reaction: 'love' };
		}
		if (msg.includes(["dataFix"])) {

			// データ修正用の関数。データを修正する際はコードをここに記載。現在はなにもしません。

			/*
			const ai = this.ai;
			const games = this.raids.find({});
			const allData = this.ai.friends.find();

			games[games.length - 1].attackers.forEach(x => {
				const doc = this.ai.lookupFriend(x.user.id)?.doc;
				const enemyName = ":mk_hero:"
				if (doc?.perModulesData?.rpg?.raidScore?.[enemyName] != 8443) return;
				doc.perModulesData.rpg.raidScore[enemyName] = 4159;
			});
			*/

			return { reaction: "love" };
		}
		return { reaction: "hmm" };
	}

	// -------- 木人モード --------

	/**
	 * 木人モード（ダメージ計測）を処理する
	 *
	 * @param msg メンションメッセージ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
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
                ensureKazutoriMasterHistory(this.ai, msg, skillEffects);
                applyKazutoriMasterHiddenBonus(msg, skillEffects);
                const verboseLog = msg.includes(['-v']);
                const formatDebug = (value: number): string => Number.isFinite(value) ? value.toFixed(3) : String(value);

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
			`${serifs.rpg.status.atk}/Lv : ${Math.round(atk / data.lv * 100) / 100}`,
			`${serifs.rpg.status.post} : ${Math.round(postCount - (isSuper ? 200 : 0))}`,
			"★".repeat(Math.floor(tp)) + "☆".repeat(Math.max(5 - Math.floor(tp), 0)) + "\n\n"
		].filter(Boolean).join("\n");

		cw += serifs.rpg.trial.cw(data.lv);
		message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;
		const kazutoriMasterMessage = getKazutoriMasterMessage(msg, skillEffects);
		if (kazutoriMasterMessage) {
			message += `${kazutoriMasterMessage}\n\n`;
		}


		// 敵のステータスを計算
		let edef = data.lv * 3.5;

		atk = atk * calculateArpen(data, (skillEffects.arpen ?? 0), edef);

		// 天国と地獄は20%の効果で計算
		atk = atk * (1 + ((skillEffects.heavenOrHell ?? 0) * 0.2));
		// 風魔法
		atk = atk * (1 + ((skillEffects.spdUp ?? 0)));
		//アイテムボーナス
		atk = atk + ((data.lv * 4) * Math.min(((skillEffects.firstTurnItem ? 0.9 : 0.4) * (1 + (skillEffects.itemEquip ?? 0))), 1) * (1 + (skillEffects.itemBoost ?? 0)) * (1 + (skillEffects.weaponBoost ?? 0)));

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

	// -------- 通常RPG（通常・旅・おかわり） --------

	/**
	 * 通常RPG、おかわり、旅モードを処理する
	 *
	 * プレイ可否判定、敵選択、バフ処理、戦闘ループ、勝利/敗北処理、レベルアップまで一連の流れを実行する。
	 *
	 * @param msg メンションメッセージ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
	@autobind
	private async handleNormalCommands(msg: Message) {
		// ---- データ初期化・スキル読み込み ----
		// データを読み込み
                const data = initializeData(this, msg);
                const colorData = colors.map((x) => x.unlock(data));
                // 所持しているスキル効果を読み込み
                const skillEffects = aggregateSkillsEffects(data);
                ensureKazutoriMasterHistory(this.ai, msg, skillEffects);
                applyKazutoriMasterHiddenBonus(msg, skillEffects);
                const onemoreKeywords = Array.isArray(serifs.rpg.command.onemore)
                        ? serifs.rpg.command.onemore
                        : [serifs.rpg.command.onemore];
                let isOkawariPlay = false;

		// ---- プレイ可否判定・おかわり ----

		/** 1回～3回前の時間の文字列（プレイ枠: 0-11時/12-17時/18-23時の3分割） */
		let TimeStrBefore1 = (new Date().getHours() < 12 ? getDate(-1) + "/18" : new Date().getHours() < 18 ? getDate() : getDate() + "/12");
		let TimeStrBefore2 = (new Date().getHours() < 12 ? getDate(-1) + "/12" : new Date().getHours() < 18 ? getDate(-1) + "/18" : getDate());
		let TimeStrBefore3 = (new Date().getHours() < 12 ? getDate(-1) : new Date().getHours() < 18 ? getDate(-1) + "/12" : getDate(-1) + "/18");

		/** 現在の時間の文字列（プレイ枠を一意に識別するキー） */
		let nowTimeStr = getDate() + (new Date().getHours() < 12 ? "" : new Date().getHours() < 18 ? "/12" : "/18");

		/** 次のプレイ枠の時間文字列 */
		let nextTimeStr = new Date().getHours() < 12 ? getDate() + "/12" : new Date().getHours() < 18 ? getDate() + "/18" : getDate(1);

		let autoReplayFlg = false;

		const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });

		const isMaxLevel = data.lv >= rpgData.maxLv;

		/** おかわりに必要なコイン数（Lv差200以上で-2、150以上で-2、100以上で-4と割引） */
		let needCoin = 10;
		if ((rpgData.maxLv - data.lv) >= 200) needCoin -= 2;
		if ((rpgData.maxLv - data.lv) >= 150) needCoin -= 2;
		if ((rpgData.maxLv - data.lv) >= 100) needCoin -= 4;
		//if ((rpgData.maxLv - data.lv) >= 50) needCoin -= 2;

		// プレイ済でないかのチェック（lastPlayedAt が現在枠 or 次枠なら既プレイ）
                if (data.lastPlayedAt === nowTimeStr || data.lastPlayedAt === nextTimeStr) {
                        // おかわりキーワードあり → 追加プレイを試行
                        if (msg.includes(onemoreKeywords)) {
				// 今日すでにおかわり済みなら、コインで追加購入を試みる
				if (data.lastOnemorePlayedAt === getDate()) {
					if (needCoin <= (data.coin ?? 0)) {
						// 最大Lvに達しているとおかわり不可（毎回Lv+1するため）
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
						// 確認不要（札所持）でなければ、はい/いいえの返信を待つ
						if (!data.replayOkawari && !aggregateTokensEffects(data).autoReplayOkawari) {
							const reply = await msg.reply(serifs.rpg.oneMore.buyQuestion(needCoin, data.coin), { visibility: "specified" });
							this.log("replayOkawari SubscribeReply: " + reply.id);
							this.subscribeReply("replayOkawari:" + msg.userId, reply.id);
							return { reaction: 'love' };
						} else {
							data.coin -= needCoin;
							data.replayOkawari = false;
							// 自動おかわり札所持時はメッセージに自動購入の旨を表示する
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
                                // おかわり初回（今日未使用）：最大Lvなら拒否、そうでなければ無料で許可
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
                                isOkawariPlay = true;
                                data.lastOnemorePlayedAt = getDate();
			} else {
				// おかわりキーワードなし → 疲れたメッセージで終了
				msg.reply(serifs.rpg.tired(new Date(), data.lv < rpgData.maxLv && data.lastOnemorePlayedAt !== getDate(), data.lv >= 7));
				return {
					reaction: 'confused'
				};
			}
		} else {
			// 未プレイの状態でおかわりキーワードのみ指定 → エラー（本来は不要な入力）
                        if (msg.includes(onemoreKeywords)) {
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
		// ---- 連続ボーナス・旅モード分岐 ----

		/** 連続プレイかどうかをチェック（直前枠 or 1枠前で 1.0、2〜3枠前 or 昨日で 0.5） */
		let continuousBonus = 0;
		let continuousFlg = false;
		if (data.lastPlayedAt === nowTimeStr || data.lastPlayedAt === TimeStrBefore1) {
			continuousBonus = 1;
		} else {
			if (
				[TimeStrBefore2, TimeStrBefore3].includes(data.lastPlayedAt) ||
				data.lastPlayedAt?.startsWith(getDate(-1))
			) {
				// continuousFlg: 昨日プレイしたかどうか（連続ボーナス表示に使用）
				if (data.lastPlayedAt === getDate()) continuousFlg = true;
				continuousBonus = 0.5;
			}
		}
		continuousBonus = continuousBonus * (1 + (skillEffects.continuousBonusUp ?? 0));

		/** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
		let count = data.count ?? 1;
		if (!data.enemy || count === 1) {
			data.itemAtkStock = 0;
			data.itemAtkStockNext = 0;
		}

		// 旅モード（エンドレスモード）のフラグ
		if (msg.includes(Array.isArray(serifs.rpg.command.journey) ? serifs.rpg.command.journey : [serifs.rpg.command.journey]) && !aggregateTokensEffects(data).autoJournal) {
			// 敵がいない / 1ターン目 / 既に旅モード中なら ON。戦闘中に指定するとエラー
			if (!data.enemy || count === 1 || data.endressFlg) {
				data.endressFlg = true;
			} else {
				msg.reply(serifs.rpg.journey.err);
				return {
					reaction: 'confused'
				};
			}
		} else {
			// 旅モード指定がなく、敵がいない or 1ターン目なら OFF
			if (!data.enemy || count === 1) {
				data.endressFlg = false;
			}
		}

		// 自動旅モード札所持時：敵がいない / 1ターン目 / 旅モード中 かつ †出現中でなければ自動で旅モード ON
		if (aggregateTokensEffects(data).autoJournal) {
			if ((!data.enemy || count === 1 || data.endressFlg) && !(aggregateTokensEffects(data).appearStrongBoss && !data.clearHistory.includes(":mk_chickenda_gtgt:"))) {
				data.endressFlg = true;
			}
		}

		// ---- 投稿数・倍率・基本変数初期化 ----

		// 最終プレイの状態を記録
		data.lastPlayedAt = nowTimeStr;

		/** 使用中の色情報 */
		let color = getColor(data);

		// 色の解放条件を満たしていなければデフォルト色に戻す
		if (!color.unlock(data)) {
			data.color = (colors.find(x => x.default) ?? colors[0]).id;
			color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
		}

		// 常時覚醒色を解放済みなら superUnlockCount を加算（覚醒確率などの内部処理用）
		if (colors.find((x) => x.alwaysSuper)?.unlock(data)) {
			data.superUnlockCount = (data.superUnlockCount ?? 0) + 1;
		}

		/** 覚醒状態か？（2% + superPoint/200、または Lv100の倍数、または常時覚醒色） */
		const isSuper = Math.random() < (0.02 + Math.max(data.superPoint / 200, 0)) || (data.lv ?? 1) % 100 === 0 || color.alwaysSuper;

		/** 覚醒時のみ投稿数に加算（hyperMode 札所持時は代わりに postXUp で上昇） */
		let superBonusPost = (isSuper && !aggregateTokensEffects(data).hyperMode ? 200 : 0)

                /** 投稿数（今日と明日の多い方）*/
                let postCount = await getPostCount(this.ai, this, data, msg, superBonusPost, { type: 'normal', key: nowTimeStr });
                const basePostCount = Math.max(postCount - superBonusPost, 0);

                // おかわり時は通常プレイ時の投稿数を再利用（同じ枠なので二重取得を防ぐ）
                if (isOkawariPlay) {
                        if (data.lastNormalPostCountKey === nowTimeStr && typeof data.lastNormalPostCount === 'number') {
                                postCount = data.lastNormalPostCount + superBonusPost;
                        }
                } else {
                        data.lastNormalPostCount = basePostCount;
                        data.lastNormalPostCountKey = nowTimeStr;
                }

		/** 連続プレイボーナスで加算する投稿数（10〜25の範囲で continuousBonus 倍） */
		let continuousBonusNum = 0;

		if (continuousBonus > 0) {
			continuousBonusNum = (Math.min(Math.max(10, postCount / 2), 25) * continuousBonus);
			postCount = postCount + continuousBonusNum;
		}

		// 覚醒 + hyperMode 札の場合は postXUp を上昇（投稿数加算の代わり）
		if (isSuper && aggregateTokensEffects(data).hyperMode) {
			skillEffects.postXUp = (skillEffects.postXUp ?? 0) + 0.005
		}

		/** ステータス倍率（投稿数に応じた倍率。postXUp でさらに上乗せ） */
		let tp = getPostX(postCount) * (1 + ((skillEffects.postXUp ?? 0) * Math.min((postCount - superBonusPost) / 20, 10)));

		// 2ターン目以降は「その戦闘での最大倍率の50%」が保証（連続戦闘で急に弱くならないように）
		data.maxTp = Math.max(tp, data.maxTp ?? 0);
		tp = Math.max(tp, data.maxTp / 2);

		// 覚醒しなかった場合は superPoint を減少（tp-2 分。次回の覚醒確率を蓄積）、覚醒時はリセット
		if (!isSuper) {
			data.superPoint = Math.max((data.superPoint ?? 0) - (tp - 2), -3);
		} else {
			data.superPoint = 0;
		}

		const verboseLog = msg.includes(['-v']);
    const formatDebug = (value: number): string => {
			if (!Number.isFinite(value)) return String(value);
			const absValue = Math.abs(value);
			if (absValue >= 10000000) return Math.trunc(value / 10000) + "万";
			if (absValue >= 1000000) return (value / 10000).toFixed(1) + "万";
			if (absValue >= 1000) return String(Math.trunc(value));
			const intLength = String(Math.floor(absValue)).length;
			return value.toFixed(Math.max(0, 4 - intLength));
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

		// ---- 敵選択（新規/継続/旅/全クリア） ----

		// 敵情報（敵がいない or 1ターン目なら新規選択、そうでなければ継続）
		if (!data.enemy || count === 1) {
			// 新規戦闘
			count = 1;
			data.count = 1;
			playerHp = playerMaxHp;
			/** 除外条件：enemyBuff でなければ今回撃破済みを除外、limit で出現条件を満たすもののみ */
			const filteredEnemys = enemys.filter((x) => (skillEffects.enemyBuff || !(data.clearEnemy ?? []).includes(x.name)) && (!x.limit || x.limit(data, msg.friend)));
			// 通常モードで出現可能な敵がいれば通常敵から選択、いなければ旅モード用敵へ
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
				// 全敵撃破で旅モードに入った場合：allClear を記録し、endressFlg を OFF に
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
			// 継続戦闘：敵データを再取得（関数参照などが永続化で失われるため）
			data.enemy = [...enemys, endressEnemy(data)].find((x) => data.enemy.name === x.name);
			// 敵が消された？？
			if (!data.enemy) data.enemy = endressEnemy(data);
			data.enemy = deepClone(data.enemy);
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

		// 独自イベントを持つ敵（例：川柳勝負）はここで委譲して終了
		if (data.enemy.event) {
			msg.friend.setPerModulesData(this, data);
			return data.enemy.event(this, msg, data);
		}

		// ---- バフ処理（覚醒・7フィーバー・風・決死等） ----

		const kazutoriMasterMessage = getKazutoriMasterMessage(msg, skillEffects);
		if (kazutoriMasterMessage) {
			message += `${kazutoriMasterMessage}\n\n`;
		}

		/** バフを得た数。行数のコントロールに使用 */
		let buff = 0;

		// 情報表示解禁：最大HP 300 以上に達した初回のみ、詳細表示を ON にする
		if ((data.info ?? 0) < 1 && ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
			data.info = 1;
			buff += 1;
			message += serifs.rpg.info + `\n`;
		}

		// 投稿数ボーナス詳細表示の札所持時は詳細メッセージ、なければ簡易メッセージ
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

		// 天国か地獄か：60% でステータス上昇、40% で低下
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


		// ７フィーバー：Lv/atk/def の 7 の並び度合いでバフ
		let sevenFever = skillEffects.sevenFever ? calcSevenFever([data.lv, data.atk, data.def]) * skillEffects.sevenFever : 0;

		// 修行の成果：旅モードかつ Lv384 超で、修行の成果が 7 フィーバーより高ければこちらを適用
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

		// 速度アップ：spd 1 は 60%、spd 2 は 20% の確率で +1
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

		// 風魔法：spd * spdUp を小数部で四捨五入的に追加行動回数に変換
		let spdUp = spd * (skillEffects.spdUp ?? 0);
		if (Math.random() < spdUp % 1) {
			spdUp = Math.floor(spdUp) + 1;
		} else {
			spdUp = Math.floor(spdUp);
		}
		// 戦闘かつ物理のときのみ追加行動、それ以外はパワーに還元
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

		// 決死の覚悟：HP 1/7 以下かつ敵との差が 0.5 以上で発動（平常心札で無効化）
		if (!aggregateTokensEffects(data).notLastPower) {
			if (playerHpPercent <= (1 / 7) * (1 + (skillEffects.haisuiUp ?? 0)) && ((enemyHpPercent * (1 + (skillEffects.haisuiUp ?? 0))) - playerHpPercent) >= 0.5) {
				buff += 1;
				message += serifs.rpg.haisui + "\n";
				dmgUp *= (1 + (skillEffects.haisuiAtkUp ?? 0));
				critUp += (skillEffects.haisuiCritUp ?? 0)
				const effect = Math.min((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.haisuiUp ?? 0)), 0.95);
				atk = atk + Math.round(def * effect);
				def = Math.round(def * (1 - effect));
			}
		}

		// 水属性：炎攻撃を持つ敵に対してダメージアップ
		if (data.enemy.fire && skillEffects.water) {
			dmgUp *= (1 + (skillEffects.water ?? 0));
		}

		if (skillEffects.itemAtkStock && (data.itemAtkStockNext ?? 0) > 0) {
			const itemAtkStockGain = Math.floor(data.itemAtkStockNext);
			if (itemAtkStockGain > 0) {
				data.itemAtkStock = (data.itemAtkStock ?? 0) + itemAtkStockGain;
				buff += 1;
				const itemAtkStockRate = Math.max((data.itemAtkStock ?? 0) / (lv * 3.5), 0);
				if (verboseLog) {
					message += `継スキル: 累積+${itemAtkStockGain} (${Math.floor(itemAtkStockRate * 100)}%)\n`;
				} else {
					message += serifs.rpg.skill.itemAtkStock(itemAtkStockRate) + "\n";
				}
			}
			data.itemAtkStockNext = 0;
		}

		if (skillEffects.itemAtkStock && (data.itemAtkStock ?? 0) > 0) {
			atk += data.itemAtkStock;
		}

		// ---- アイテム取得・使用 ----

		/** アイテム取得確率のベース（HP 低いほど高くなる：40%〜100%） */
		const itemEquip = 0.4 + ((1 - playerHpPercent) * 0.6);
		// firstTurnItem なら 1 ターン目は確定、それ以外は確率で取得
		if (rpgItems.length && ((count === 1 && skillEffects.firstTurnItem) || Math.random() < itemEquip * (1 + (skillEffects.itemEquip ?? 0)))) {
			//アイテム
			buff += 1;
			if ((count === 1 && skillEffects.firstTurnItem)) message += serifs.rpg.skill.firstItem;
			// pLToR（進捗表示型）の敵：mind のみで武器/防具/薬/毒を区別（プラス/マイナスでランダム）
			if (data.enemy.pLToR) {
				let isPlus = Math.random() < 0.5;
				const items = rpgItems.filter((x) => isPlus ? x.mind > 0 : x.mind < 0);
				item = { ...items[Math.floor(Math.random() * items.length)] };
			} else {
				// 通常：weapon/armor/medicine/poison をスキルで重み付け。weaponSelect 等で強制指定も可能
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
				// 非戦闘/非物理 or 疲れダメージ or pLToR のときは mind 値で効果（プラス/マイナスでパワー・防御変動）
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
						if (skillEffects.shieldBash && itemBonus.def > 0) {
							const shieldBashX = 1 - Math.pow(0.5, (skillEffects.shieldBash ?? 0));
							const shieldBashAtk = Math.floor(itemBonus.def * shieldBashX);
							if (shieldBashAtk > 0) {
								itemBonus.atk += shieldBashAtk;
								atk += shieldBashAtk;
							}
						}
					} else {
						itemBonus.def = (lv * 4) * (item.effect * 0.005);
						def = def + itemBonus.def;
						if (skillEffects.shieldBash && itemBonus.def > 0) {
							const shieldBashX = 1 - Math.pow(0.5, (skillEffects.shieldBash ?? 0));
							const shieldBashAtk = Math.floor(itemBonus.def * shieldBashX);
							if (shieldBashAtk > 0) {
								itemBonus.atk += shieldBashAtk;
								atk += shieldBashAtk;
							}
						}
						const shieldBashActivated = !!(skillEffects.shieldBash && itemBonus.atk > 0);
						if (item.effect >= 100) {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が特大アップ！\n`;
						} else if (item.effect >= 70) {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が大アップ！\n`;
						} else if (item.effect > 30) {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}がアップ！\n`;
						} else {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が小アップ！\n`;
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

		// ---- 敵ステータス計算・戦闘前準備 ----

		// 敵のステータスを計算
		/** 敵の攻撃力 */
		let enemyAtk = (typeof data.enemy.atk === "function") ? data.enemy.atk(atk, def, spd) : lv * 3.5 * data.enemy.atk;
		/** 敵の防御力 */
		let enemyDef = (typeof data.enemy.def === "function") ? data.enemy.def(atk, def, spd) : lv * 3.5 * data.enemy.def;

		let hardEnemyFlg = false;

		// 強敵と戦うのが好き：撃破済みの通常敵を強化（ステータス・速度上昇）
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

		if (skillEffects.itemAtkStock) {
			const itemAtkGain = Math.max(Math.floor(itemBonus.atk ?? 0), 0);
			if (itemAtkGain > 0) {
				data.itemAtkStockNext = Math.floor(itemAtkGain * (skillEffects.itemAtkStock ?? 0));
				if (verboseLog) {
					message += `継スキル: 次ターン累積予定+${data.itemAtkStockNext}\n`;
				}
			} else {
				data.itemAtkStockNext = 0;
			}
		}

		if (skillEffects.enemyStatusBonus) {
			const enemyStrongs = (enemyAtk / (lv * 3.5)) * (getVal(data.enemy.atkx, [tp]) ?? 3) + (enemyDef / (lv * 3.5)) * (getVal(data.enemy.defx, [tp]) ?? 3);
			const bonus = Math.floor(applySoftCapPow2(enemyStrongs / 4) * skillEffects.enemyStatusBonus);
			atk = atk * (1 + (bonus / 100));
			def = def * (1 + (bonus / 100));
			if (bonus / skillEffects.enemyStatusBonus >= 5) {
				buff += 1;
				message += serifs.rpg.skill.enemyStatusBonus + "\n";
			}
		}

		atk = atk * calculateArpen(data, (skillEffects.arpen ?? 0), enemyDef);

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

		// ---- 戦闘ループ本体（actionX 回繰り返し） ----
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
				const weakX = 1 - (1 / (1 + ((skillEffects.weak * (count - 1)))))
				enemyAtk -= Math.max(enemyAtk * weakX, atk * weakX);
				if (enemyAtk < 0) enemyAtk = 0;
				const arpenX = calculateArpen(data, skillEffects.weak * (count - 1), enemyDef)
				atk = atk * arpenX;
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

			if (count === 1 && data.enemy.fire && skillEffects.water) {
				data.enemy.fire /= (1 + (skillEffects.water ?? 0) * 3);
			}

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

			// ---- プレイヤー攻撃ループ（spd回） ----
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
                                if (verboseLog) {
                                        const debugLines: string[] = [];
                                        debugLines.push(`---ダメージ計算${i + 1}回目---`);
                                        debugLines.push(`攻撃力: ${formatDebug(atk)}`);
                                        debugLines.push(`TP倍率: ${formatDebug(tp)}`);
                                        debugLines.push(`ターン数: ${count}`);
                                        debugLines.push(`行動回数: ${spd}`);
                                        debugLines.push(`敵防御力: ${formatDebug(enemyDef * (getVal(data.enemy.defx, [tp]) ?? 3))}`);
                                        debugLines.push(`乱数: ${formatDebug(rng)}`);
                                        if(dmgBonus !== 1) debugLines.push(`追加ダメージ: ${formatDebug(dmgBonus)}`);
                                        if(trueDmg !== 0) debugLines.push(`確定ダメージ: ${formatDebug(trueDmg)}`);
                                        if(dmgUp !== 1) debugLines.push(`ダメージ倍率: ${formatDebug(dmgUp)}`);
                                        if(critUp !== 0) debugLines.push(`会心率補正: ${formatDebug(critUp)}`);
                                        if(crit) debugLines.push(`クリティカル倍率:${formatDebug(critDmg)}`);
                                        if (itemBonus?.atk) {
                                                debugLines.push(`アイテム攻撃補正: ${formatDebug(itemBonus.atk)}`);
																				}
                                        message += debugLines.join('\n') + '\n';
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

			// ---- 勝利処理 ----
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
				if (data.count === 1) data.streak = (data.streak ?? 0) + 1;
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
				data.itemAtkStock = 0;
				data.itemAtkStockNext = 0;
				break;
			} else {
				// ---- 攻撃後スキル・敵ターン ----
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
					// 食いしばり：HP 0 のときに endure 確率で HP 1 で生存。旅モード高ステージでは確率低下
					const endure = ((0.1 + (0.1 * (data.endure ?? 0))) * (1 + (skillEffects.endureUp ?? 0))) - (count * (data.enemy.name === endressEnemy(data).name && (data.endress ?? 0) >= 199 && count > 1 ? 0.04 * count : 0.05));
					if (playerHp <= 0 && !data.enemy.notEndure && Math.random() < endure) {
						message += serifs.rpg.endure + "\n";
						playerHp = 1;
						data.endure = Math.max(data.endure - 1, 0);
					}
					// ナース：1% の確率で全回復イベント（HP が低いときのみ）
					if (playerHp <= (30 + lv) && serifs.rpg.nurse && Math.random() < 0.01 && !data.enemy.notEndure) {
						message += "\n" + serifs.rpg.nurse + "\n" + (playerMaxHp - playerHp) + "ポイント回復した！\n";
						playerHp = playerMaxHp;
					}
					if (maxDmg > (data.superMuscle ?? 0) && playerHp > 0) data.superMuscle = maxDmg;
				}
				// ---- 敗北処理（逃走含む） ----
				if (playerHp <= 0) {
					// 逃走スキル：習得数までは 100% 成功、それ以上は成功するたびに確率半減
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
					// 決着がつかない（双方生存）：count を進め、次アクション or 次回プレイへ
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

		// ---- レベルアップ・後処理 ----

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
		const nextPlay = !nowPlay?.[1] ? 12 : nowPlay[1] === "/12" ? 18 : nowPlay[1] === "/18" ? 24 : 12;
		const minusDurability = amuletMinusDurability(data);

		message += [
			`\n\n${serifs.rpg.lvUp}`,
			`  ${serifs.rpg.status.lv} : ${data.lv ?? 1} (+1)`,
			`  ${serifs.rpg.status.atk} : ${data.atk ?? 0} (+${atkUp + bonus})`,
			`  ${serifs.rpg.status.def} : ${data.def ?? 0} (+${totalUp - atkUp + bonus})`,
			addMessage,
			minusDurability ? "\n" + minusDurability : "",
			`\n${serifs.rpg.nextPlay(nextPlay === 24 ? "明日" : nextPlay + "時")}`,
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

	// -------- contextHook 用ハンドラ --------

	/**
	 * おかわり購入の確認返信を処理する
	 *
	 * コイン消費による追加おかわり購入の「はい/いいえ」返信を受け取る。
	 *
	 * @param key コンテキストキー（replayOkawari:userId）
	 * @param msg 返信メッセージ
	 * @param data コンテキストデータ
	 * @returns リアクションオブジェクト
	 * @internal
	 */
	@autobind
        private replayOkawariHook(key: string, msg: Message, data: unknown) {
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
			}).catch((err) => {
				this.log(`おかわり確認メッセージ送信エラー: ${err instanceof Error ? err.stack ?? err.message : err}`);
			});
			return { reaction: 'hmm' };
                }
        }

	/**
	 * スキル選択の返信を処理する
	 *
	 * スキル変更時に表示される選択肢への返信（番号）を受け取り、スキルを更新する。
	 *
	 * @param key コンテキストキー（selectSkill:userId）
	 * @param msg 返信メッセージ
	 * @param data コンテキストデータ（options, index, oldSkillName）
	 * @returns リアクションオブジェクト、または false
	 * @internal
	 */
        @autobind
        private selectSkillHook(key: string, msg: Message, data: unknown) {
                if (key.replace("selectSkill:", "") !== msg.userId) {
                        return { reaction: 'hmm' };
                }
				if (msg.extractedText.length >= 3) return false;

                const rpgData = msg.friend.getPerModulesData(this);
                if (!rpgData) return { reaction: 'hmm' };

				const selectData = data as { index: number; options: string[]; oldSkillName: string } | undefined;
				if (!selectData?.options) return { reaction: 'hmm' };

				const match = msg.extractedText.replace(/[０-９]/g, m => '０１２３４５６７８９'.indexOf(m).toString()).match(/[0-9]+/);
				if (match === null || match === undefined) {
					return {
						reaction: 'hmm',
					};
				}
				const num = parseInt(match[0]);
               if (!num || num > selectData.options.length) {
                       return { reaction: 'hmm' };
               }

                this.unsubscribeReply(key);

                if (num === 0) {
                        return { reaction: ':mk_muscleok:' };
                }

               const index = selectData.index;
               const skillName = selectData.options[num - 1];
               const skill = skills.find(x => x.name === skillName);
               if (!skill || !canLearnSkillNow(rpgData, skill)) {
                       msg.reply('そのスキルは習得できません！', { visibility: 'specified' });
                       return { reaction: 'hmm' };
               }

               rpgData.skills[index] = skill;
               if (num === 4) {
                       rpgData.nextSkill = null;
               }
               msg.reply(`\n` + serifs.rpg.moveToSkill(selectData.oldSkillName, skill.name) + `\n効果: ${skill.desc}` + (aggregateTokensEffects(rpgData).showSkillBonus && skill.info ? `\n詳細効果: ${skill.info}` : ''), { visibility: 'specified' });
               msg.friend.setPerModulesData(this, rpgData);
               skillCalculate(this.ai);
               return { reaction: 'love' };
        }

	// -------- アカウント一覧管理 --------

	/**
	 * rpgPlayers リストに Lv20 以上のプレイヤーを追加する
	 *
	 * install 時およびレベルアップ時刻に呼ばれ、rpgPlayers リストを更新する。
	 *
	 * @internal
	 */
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

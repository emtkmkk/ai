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
import { skills, Skill, SkillEffect, getSkill, skillReply, skillCalculate, aggregateSkillsEffects, calcSevenFever, amuletMinusDurability } from './skills';
import { start, Raid, raidInstall, raidContextHook, raidTimeoutCallback } from './raid';
import { initializeData, getColor, getAtkDmg, getEnemyDmg, showStatus, getPostCount, getPostX, getVal, random } from './utils';
import { calculateStats } from './battle';
import Friend from '@/friend';
import config from '@/config';
import * as loki from 'lokijs';

export default class extends Module {
    public readonly name = 'rpg';

    private raids: loki.Collection<Raid>;

    @autobind
    public install() {
        this.raids = this.ai.getCollection('rpgRaid');
        raidInstall(this.ai, this, this.raids);
        setInterval(this.scheduleLevelUpdateAndRemind, 1000 * 60 * 5);
        setInterval(this.scheduleDailyNoteCountsUpdate, 1000 * 60 * 5);
        this.calculateMaxLv();
        skillCalculate(this.ai);

        return {
            mentionHook: this.mentionHook,
            contextHook: this.contextHook,
            timeoutCallback: this.timeoutCallback
        };
    }

    @autobind
    private async mentionHook(msg: Message) {
        if (msg.user.username === config.master && msg.includes([serifs.rpg.command.rpg]) && msg.includes(["admin"])) {
            // 管理者モード
            return this.handleAdminCommands(msg);
        }
        if (msg.includes(Array.isArray(serifs.rpg.command.help) ? serifs.rpg.command.help : [serifs.rpg.command.help])) {
            // ヘルプモード
            return this.handleHelpCommands(msg);
        }
        if (msg.includes([serifs.rpg.command.rpg]) && msg.includes([serifs.rpg.command.color])) {
            // 色モード
            return colorReply(this, msg);
        }
        if (msg.includes([serifs.rpg.command.skill])) {
            // スキルモード
            return skillReply(this, this.ai, msg);
        }
        if (msg.includes([serifs.rpg.command.shop])) {
            // ショップモード
            return shopReply(this, this.ai, msg);
        }
        if (msg.includes([serifs.rpg.command.rpg]) && msg.includes([serifs.rpg.command.trial])) {
            // 木人モード
            return this.handleTrialCommands(msg);
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
            return this.replayOkawariHook(key, msg, data)
        }
        if (typeof key === "string" && key.startsWith("shopBuy:")) {
            return shopContextHook(this, key, msg, data)
        }
        return raidContextHook(key, msg, data)
    }

    @autobind
    private timeoutCallback(data) {

        return raidTimeoutCallback(data)

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
        return this.ai.friends.find().filter(x => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1).reduce((acc, cur) => acc > cur.perModulesData.rpg.lv ? acc : cur.perModulesData.rpg.lv, 0);
    }

    @autobind
    private scheduleLevelUpdateAndRemind() {

        const hours = new Date().getHours();
        if ((hours === 0 || hours === 12 || hours === 18) && new Date().getMinutes() >= 1 && new Date().getMinutes() < 6) {
            const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
            if (rpgData) {
                rpgData.maxLv += 1;
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
        const data = initializeData(this, msg)
        const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
        let helpMessage = [serifs.rpg.help.title];
        if ((data.lv ?? 0) < 7) {
            helpMessage.push(serifs.rpg.help.normal1)
        } else {
            helpMessage.push(serifs.rpg.help.normal2)
            if (data.lv < rpgData.maxLv) {
                if (data.coin > 0) {
                    helpMessage.push(serifs.rpg.help.okawari2(rpgData.maxLv - data.lv))
                } else {
                    helpMessage.push(serifs.rpg.help.okawari1(rpgData.maxLv - data.lv))
                }
            }
            helpMessage.push(serifs.rpg.help.trial(data.bestScore))
            if (data.winCount >= 5) {
                helpMessage.push(serifs.rpg.help.journey)
            }
            helpMessage.push(serifs.rpg.help.color)
            if (data.lv >= 20) {
                if (data.lv >= 60) {
                    helpMessage.push(serifs.rpg.help.skills2)
                } else {
                    helpMessage.push(serifs.rpg.help.skills1)
                }
                
            }
        }
        if (data.coin > 0) {
            helpMessage.push(serifs.rpg.help.shop(data.coin))
        }
        helpMessage.push(serifs.rpg.help.status)
        helpMessage.push(serifs.rpg.help.help)

        msg.reply("\n" + helpMessage.join("\n\n"));
        return { reaction: "love" };
    }

    @autobind
    private handleAdminCommands(msg: Message) {
        if (msg.includes(["revert"])) {
            const id = /\w{10}/.exec(msg.extractedText)?.[0];
            if (id) {
                const friend = this.ai.lookupFriend(id)
                if (friend == null) return { reaction: ":mk_hotchicken:" };
                friend.doc.perModulesData.rpg.lastPlayedAt = "";
                friend.doc.perModulesData.rpg.lv = friend.doc.perModulesData.rpg.lv - 1;
                friend.doc.perModulesData.rpg.atk = friend.doc.perModulesData.rpg.atk - 4;
                friend.doc.perModulesData.rpg.def = friend.doc.perModulesData.rpg.def - 3;
                friend.save();
                return { reaction: "love" };
            }
        }
        if (msg.includes(["skilledit"])) {
            const id = /\w{10}/.exec(msg.extractedText)?.[0];
            const skill = /"(\S+)"/.exec(msg.extractedText)?.[1];
            const num = /\s(\d)\s/.exec(msg.extractedText)?.[1];
            if (id && skill && num) {
                const friend = this.ai.lookupFriend(id)
                if (friend == null) return { reaction: ":mk_hotchicken:" };
                friend.doc.perModulesData.rpg.skills[num] = skills.find((x) => x.name.startsWith(skill));
                friend.save()
                return { reaction: "love" };
            }
        }
        if (msg.includes(["startRaid"])) {
            start();
            return { reaction: "love" };
        }
        if (msg.includes(["dataFix"])) {
            //return { reaction: "love" };
        }
        return { reaction: "hmm" }
    }

    @autobind
    private async handleTrialCommands(msg: Message) {

        // データを読み込み
        const data = initializeData(this, msg)
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

        let color = getColor(data)

        // 覚醒状態か？
        const isSuper = color.alwaysSuper;

        // 投稿数（今日と明日の多い方）
        let postCount = await getPostCount(this.ai, this, data, msg, (isSuper ? 200 : 0))

        // 投稿数に応じてステータス倍率を得る
        // 連続プレイの場合は倍率アップ
        let tp = getPostX(postCount) * (1 + (skillEffects.postXUp ?? 0));

        // 自分のカラー
        let me = color.name;

        // 画面に出力するメッセージ
        let cw = acct(msg.user) + " ";
        let message = ""

        // ここで残りのステータスを計算しなおす
        let { atk, def, spd } = calculateStats(data, msg, skillEffects, color)
        def = def * (1 + (skillEffects.defUp ?? 0));

        if (isSuper) {
            spd += 2;
        }

        message += [
            `${serifs.rpg.nowStatus}`,
            `${serifs.rpg.status.atk} : ${Math.round(atk)}`,
            `${serifs.rpg.status.post} : ${Math.round(postCount - (isSuper ? 200 : 0))}`,
            "★".repeat(Math.floor(tp)) + "☆".repeat(Math.max(5 - Math.floor(tp), 0)) + "\n\n"
        ].filter(Boolean).join("\n")

        cw += serifs.rpg.trial.cw(data.lv)
        message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`
        

        // 敵のステータスを計算
        const edef = data.lv * 3.5 - (atk * (skillEffects.arpen ?? 0));

		atk = atk * (1 + ((skillEffects.critUpFixed ?? 0) * (1 + (skillEffects.critDmgUp ?? 0))));
        atk = atk * (1 + (skillEffects.dart ?? 0) * 0.5);
        atk = atk * (1 + (skillEffects.abortDown ?? 0) * (1 / 3));


        let trueDmg = 0;

        // 炎属性剣攻撃
        if (skillEffects.fire) {
            trueDmg = Math.ceil(data.lv * skillEffects.fire)
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

        const minRnd = Math.max(0.2 + (isSuper ? 0.3 : 0) + (skillEffects.atkRndMin ?? 0), 0)
        const maxRnd = Math.max(1.6 + (skillEffects.atkRndMax ?? 0), 0)

        if (skillEffects.allForOne) {
            atk = atk * spd * 1.1
            spd = 1
        }

        for (let i = 0; i < spd; i++) {
            const buff = (1 + (skillEffects.atkDmgUp ?? 0)) * (skillEffects.thunder ? 1 + (skillEffects.thunder * ((i + 1) / spd) / (spd === 1 ? 2 : spd === 2 ? 1.5 : 1)) : 1);
            const rng = (minRnd + (maxRnd / 2))
            let minDmg = getAtkDmg(data, atk, tp, 1, false, edef, 0, minRnd * buff, 3) + trueDmg;
            minTotalDmg += minDmg
            let dmg = getAtkDmg(data, atk, tp, 1, false, edef, 0, rng * buff, 3) + trueDmg;
            totalDmg += dmg
            let maxDmg = getAtkDmg(data, atk, tp, 1, false, edef, 0, (minRnd + maxRnd) * buff, 3) + trueDmg;
            maxTotalDmg += maxDmg
            // メッセージの出力
            message += serifs.rpg.trial.atk(dmg) + "\n"
        }

        message += `\n${serifs.rpg.end}\n\n${serifs.rpg.trial.result(totalDmg)}\n${serifs.rpg.trial.random(minTotalDmg, maxTotalDmg)}\n${data.bestScore ? serifs.rpg.trial.best(data.bestScore) : ""}`

        data.bestScore = Math.max(data.bestScore ?? 0, totalDmg)

        msg.friend.setPerModulesData(this, data);

        // 色解禁確認
        const newColorData = colors.map((x) => x.unlock(data));
        let unlockColors = "";
        for (let i = 0; i < newColorData.length; i++) {
            if (!colorData[i] && newColorData[i]) {
                unlockColors += colors[i].name
            }
        }
        if (unlockColors) {
            message += serifs.rpg.newColor(unlockColors)
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
        const data = initializeData(this, msg)
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

        // プレイ済でないかのチェック
        if (data.lastPlayedAt === nowTimeStr || data.lastPlayedAt === nextTimeStr) {
            const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
            if (msg.includes([serifs.rpg.command.onemore])) {
                if (data.lastOnemorePlayedAt === getDate()) {
                    const needCoin = 10;
                    if (needCoin <= (data.coin ?? 0)) {
                        if (data.lv >= rpgData.maxLv) {
                            msg.reply(serifs.rpg.oneMore.maxLv);
                            return {
                                reaction: 'confused'
                            };
                        }
                        if (!data.replayOkawari && !aggregateTokensEffects(data).autoReplayOkawari) {
                            const reply = await msg.reply(serifs.rpg.oneMore.buyQuestion(needCoin, data.coin));
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
                        msg.reply(serifs.rpg.oneMore.tired(data.lv < rpgData.maxLv));
                        return {
                            reaction: 'confused'
                        };
                    }
                }
                if (data.lv >= rpgData.maxLv) {
                    msg.reply(serifs.rpg.oneMore.maxLv);
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
            if (msg.includes([serifs.rpg.command.onemore])) {
                if (data.lastOnemorePlayedAt === getDate()) {
                    const rpgData = this.ai.moduleData.findOne({ type: 'rpg' });
                    msg.reply(serifs.rpg.oneMore.tired(data.lv < rpgData.maxLv));
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
        continuousBonus = continuousBonus * (1 + (skillEffects.continuousBonusUp ?? 0))

        /** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
        let count = data.count ?? 1

        // 旅モード（エンドレスモード）のフラグ
        if (msg.includes([serifs.rpg.command.journey]) && !aggregateTokensEffects(data).autoJournal) {
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
            if (!data.enemy || count === 1 || data.endressFlg) {
                data.endressFlg = true;
            }
        }

        // 最終プレイの状態を記録
        data.lastPlayedAt = nowTimeStr;

        /** 使用中の色情報 */
        let color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];

        if (!color.unlock(data)) {
            data.color === (colors.find((x) => x.default) ?? colors[0]).id;
            color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
        }

        if (colors.find((x) => x.alwaysSuper)?.unlock(data)) {
            data.superUnlockCount = (data.superUnlockCount ?? 0) + 1
        }

        /** 覚醒状態か？*/
        const isSuper = Math.random() < (0.02 + Math.max(data.superPoint / 200, 0)) || (data.lv ?? 1) % 100 === 0 || color.alwaysSuper;

        /** 投稿数（今日と明日の多い方）*/
        let postCount = await getPostCount(this.ai, this, data, msg, (isSuper ? 200 : 0))

        let continuousBonusNum = 0;

        if (continuousBonus > 0) {
            continuousBonusNum = (Math.min(Math.max(10, postCount / 2), 25) * continuousBonus)
            postCount = postCount + continuousBonusNum;
        }

        // 投稿数に応じてステータス倍率を得る
        // 連続プレイの場合は倍率アップ
        /** ステータス倍率（投稿数） */
        let tp = getPostX(postCount) * (1 + (skillEffects.postXUp ?? 0));

        // これが2ターン目以降の場合、戦闘中に計算された最大倍率の50%の倍率が保証される
        data.maxTp = Math.max(tp, data.maxTp ?? 0);
        tp = Math.max(tp, data.maxTp / 2);

        if (!isSuper) {
            data.superPoint = Math.max(data.superPoint ?? 0 - (tp - 2), -3)
        } else {
            data.superPoint = 0;
        }


        /** 画面に出力するメッセージ:CW */
        let cw = acct(msg.user) + " ";
        /** 画面に出力するメッセージ:Text */
        let message = ""

        if (autoReplayFlg) {
            message += serifs.rpg.oneMore.autoBuy(data.coin) + `\n\n`
        }

        /** プレイヤーの見た目 */
        let me = color.name

        // ステータスを計算
        /** プレイヤーのLv */
        const lv = data.lv ?? 1
        /** プレイヤーのHP */
        let playerHp = data.php ?? 100;
        /** 開始時のチャージ */
        const startCharge = data.charge;

        // 敵情報
        if (!data.enemy || count === 1) {
            // 新しい敵
            count = 1
            data.count = 1
            playerHp = 100 + lv * 3
            /** すでにこの回で倒している敵、出現条件を満たしていない敵を除外 */
            const filteredEnemys = enemys.filter((x) => !(data.clearEnemy ?? []).includes(x.name) && (!x.limit || x.limit(data, msg.friend)));
            if (filteredEnemys.length && !data.endressFlg) {
                /** 1度も倒した事のない敵 */
                const notClearedEnemys = filteredEnemys.filter((x) => !(data.clearHistory ?? []).includes(x.name));
                if (notClearedEnemys.length) {
                    // 出現条件を満たしている敵の中で、1度も倒した事のない敵がいる場合、優先的に選ばれる
                    data.enemy = notClearedEnemys[Math.floor(notClearedEnemys.length * Math.random())]
                } else {
                    // 1度も倒した事のない敵が誰もいない場合
                    data.enemy = filteredEnemys[Math.floor(filteredEnemys.length * Math.random())]
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
                data.enemy = endressEnemy(data)
            }
            // 敵の開始メッセージなどを設定
            cw += `${data.enemy.msg}`
            message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;
            data.ehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
        } else {
            // 一度敵の情報を取得しなおす（関数のデータなどが吹き飛ぶ為）
            data.enemy = [...enemys, endressEnemy(data)].find((x) => data.enemy.name === x.name);
            // 敵が消された？？
            if (!data.enemy) data.enemy = endressEnemy(data);
            // 敵の開始メッセージなどを設定
            cw += `${data.enemy.short} ${count}${serifs.rpg.turn}`
            // 前ターン時点のステータスを表示
            let mehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
            let ehp = Math.min(data.ehp ?? mehp, mehp);
            if (!data.php) data.php = (100 + lv * 3);
            data.count -= 1;
            message += showStatus(data, playerHp, ehp, mehp, me) + "\n\n"
            data.count += 1;
        }

        if (data.enemy.event) {
            msg.friend.setPerModulesData(this, data);
            return data.enemy.event(msg);
        }

        /** バフを得た数。行数のコントロールに使用 */
        let buff = 0;

        if ((data.info ?? 0) < 1 && ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
            data.info = 1
            buff += 1;
            message += serifs.rpg.info + `\n`
        }

        if (aggregateTokensEffects(data).showPostBonus) {
            buff += 1            
            if (continuousBonus >= 1) {
                message += serifs.rpg.postBonusInfo.continuous.a(Math.floor(continuousBonusNum)) + `\n`
            } else if (continuousFlg && continuousBonus > 0) {
                message += serifs.rpg.postBonusInfo.continuous.b(Math.floor(continuousBonusNum)) + `\n`
            } else if (continuousBonus > 0) {
                message += serifs.rpg.postBonusInfo.continuous.c(Math.floor(continuousBonusNum)) + `\n`
            }
            if (isSuper) {
                message += serifs.rpg.postBonusInfo.super + `\n`
            }
            serifs.rpg.postBonusInfo.post(postCount, tp > 1 ? "+" + Math.floor((tp - 1) * 100) : "-" + Math.floor((tp - 1) * 100)) + `\n\n`
        } else {
            // 連続ボーナスの場合、メッセージを追加
            // バフはすでに上で付与済み
            if (continuousBonus >= 1) {
                buff += 1
                message += serifs.rpg.bonus.a + `\n`
            } else if (continuousFlg && continuousBonus > 0) {
                buff += 1
                message += serifs.rpg.bonus.b + `\n`
            } else if (continuousBonus > 0) {
                buff += 1
                message += serifs.rpg.bonus.c + `\n`
            }
        }

        // ここで残りのステータスを計算しなおす
        let { atk, def, spd } = calculateStats(data, msg, skillEffects, color)
        /** 敵の最大HP */
        let enemyMaxHp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
        /** 敵のHP */
        let enemyHp = Math.min(data.ehp ?? 100, enemyMaxHp);
        /** 敗北時のステータスボーナス */
        let bonus = 0;
        /** 連続攻撃中断の場合の攻撃可能回数 0は最後まで攻撃 */
        let abort = 0;
        /** プレイヤーのHP割合 */
        let playerHpPercent = playerHp / (100 + lv * 3);
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
            const superColor = colors.find((x) => x.alwaysSuper)?.name ?? colors.find((x) => x.default)?.name ?? colors[0]?.name;
            if (me !== superColor) {
                // バフが1つでも付与された場合、改行を追加する
                if (buff > 0) message += "\n"
                buff += 1;
                me = superColor;
                message += serifs.rpg.super(me) + `\n`;
                data.superCount = (data.superCount ?? 0) + 1
            }
            spd += 2;
        }

        // ７フィーバー
        let sevenFever = skillEffects.sevenFever ? calcSevenFever([data.lv, data.atk, data.def]) * skillEffects.sevenFever : 0;
        if (sevenFever) {
            buff += 1;
            message += serifs.rpg.skill.sevenFever(sevenFever) + "\n";
            atk = atk * (1 + (sevenFever / 100));
            def = def * (1 + (sevenFever / 100));
        }

        // spdが低い場合、確率でspdが+1。
        if (spd === 2 && Math.random() < 0.2) {
            buff += 1
            message += serifs.rpg.spdUp + "\n"
            spd = 3;
        }
        if (spd === 1 && Math.random() < 0.6) {
            buff += 1
            message += serifs.rpg.spdUp + "\n"
            spd = 2;
        }

        // 風魔法発動時
        let spdUp = spd * (skillEffects.spdUp ?? 0)
        if (Math.random() < spdUp % 1) {
            spdUp = Math.floor(spdUp) + 1;
        } else {
            spdUp = Math.floor(spdUp)
        }
        if ((isBattle && isPhysical) && spdUp) {
            buff += 1
            message += serifs.rpg.skill.wind(spdUp) + "\n"
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

        // HPが1/7以下で相手とのHP差がかなりある場合、決死の覚悟のバフを得る
        if (playerHpPercent <= (1 / 7) * (1 + (skillEffects.haisuiUp ?? 0)) && (enemyHpPercent - playerHpPercent) >= 0.5 / (1 + (skillEffects.haisuiUp ?? 0))) {
            buff += 1
            message += serifs.rpg.haisui + "\n"
            const effect = Math.min((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.haisuiUp ?? 0)), 1)
            atk = atk + Math.round(def * effect)
            def = Math.round(def * (1 - effect))
        }

        const itemEquip = 0.4 + ((1 - playerHpPercent) * 0.6);
        if (rpgItems.length && ((count === 1 && skillEffects.firstTurnItem) || Math.random() < itemEquip * (1 + (skillEffects.itemEquip ?? 0)))) {
            //アイテム
            buff += 1
            if ((count === 1 && skillEffects.firstTurnItem)) message += serifs.rpg.skill.firstItem
            if (data.enemy.pLToR) {
                let isPlus = Math.random() < 0.5;
                const items = rpgItems.filter((x) => isPlus ? x.mind > 0 : x.mind < 0);
                item = items[Math.floor(Math.random() * items.length)];
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
                if ((count !== 1 || data.enemy.pLToR) && skillEffects.lowHpFood && Math.random() < skillEffects.lowHpFood * playerHpPercent) {
                    if (playerHpPercent < 0.5) message += serifs.rpg.skill.lowHpFood
                    types = ["medicine", "poison"]
                }
                const type = types[Math.floor(Math.random() * types.length)]
                if ((type === "weapon" && !(isBattle && isPhysical)) || (type === "armor" && isTired) || data.enemy.pLToR) {
                    let isPlus = Math.random() < (0.5 + (skillEffects.mindMinusAvoid ?? 0) + (count === 1 ? skillEffects.firstTurnMindMinusAvoid ?? 0 : 0));
                    const items = rpgItems.filter((x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0));
                    item = items[Math.floor(Math.random() * items.length)];
                } else {
                    const items = rpgItems.filter((x) => x.type === type && x.effect > 0);
                    item = items[Math.floor(Math.random() * items.length)];
                }
            }
            const mindMsg = (mind) => {
                if (mind >= 100) {
                    message += `もこチキの気合が特大アップ！\n`
                } else if (mind >= 70) {
                    message += `もこチキの気合が大アップ！\n`
                } else if (mind > 30) {
                    message += `もこチキの気合がアップ！\n`
                } else if (mind > 0) {
                    message += `もこチキの気合が小アップ！\n`
                } else if (mind > -50) {
                    message += `あまり良い気分ではないようだ…\n`
                } else {
                    message += `もこチキの気合が下がった…\n`
                }
            }
            if (item.type !== "poison") {
                item.effect = Math.round(item.effect * (1 + (skillEffects.itemBoost ?? 0)))
                if (item.type === "weapon") item.effect = Math.round(item.effect * (1 + (skillEffects.weaponBoost ?? 0)))
                if (item.type === "armor") item.effect = Math.round(item.effect * (1 + (skillEffects.armorBoost ?? 0)))
                if (item.type === "medicine") item.effect = Math.round(item.effect * (1 + (skillEffects.foodBoost ?? 0)))
            } else {
                item.effect = Math.round(item.effect / (1 + (skillEffects.itemBoost ?? 0)))
                item.effect = Math.round(item.effect / (1 + (skillEffects.poisonResist ?? 0)))
            }
            if (item.mind < 0) {
                item.mind = Math.round(item.mind / (1 + (skillEffects.itemBoost ?? 0)))
            } else {
                item.mind = Math.round(item.mind * (1 + (skillEffects.itemBoost ?? 0)))
            }
            switch (item.type) {
                case "weapon":
                    message += `${item.name}を取り出し、装備した！\n`
                    if (!(isBattle && isPhysical)) {
                        mindMsg(item.mind)
                        if (item.mind < 0 && isSuper) item.mind = item.mind / 2
                        itemBonus.atk = atk * (item.mind * 0.0025);
                        itemBonus.def = def * (item.mind * 0.0025);
                        atk = atk + itemBonus.atk;
                        def = def + itemBonus.def;
                    } else {
                        itemBonus.atk = (lv * 4) * (item.effect * 0.005);
                        atk = atk + itemBonus.atk;
                        if (item.effect >= 100) {
                            message += `もこチキのパワーが特大アップ！\n`
                        } else if (item.effect >= 70) {
                            message += `もこチキのパワーが大アップ！\n`
                        } else if (item.effect > 30) {
                            message += `もこチキのパワーがアップ！\n`
                        } else {
                            message += `もこチキのパワーが小アップ！\n`
                        }
                    }
                    break;
                case "armor":
                    message += `${item.name}を取り出し、装備した！\n`
                    if (isTired) {
                        mindMsg(item.mind)
                        if (item.mind < 0 && isSuper) item.mind = item.mind / 2
                        itemBonus.atk = atk * (item.mind * 0.0025);
                        itemBonus.def = def * (item.mind * 0.0025);
                        atk = atk + itemBonus.atk;
                        def = def + itemBonus.def;
                    } else {
                        itemBonus.def = (lv * 4) * (item.effect * 0.005);
                        def = def + itemBonus.def;
                        if (item.effect >= 100) {
                            message += `もこチキの防御が特大アップ！\n`
                        } else if (item.effect >= 70) {
                            message += `もこチキの防御が大アップ！\n`
                        } else if (item.effect > 30) {
                            message += `もこチキの防御がアップ！\n`
                        } else {
                            message += `もこチキの防御が小アップ！\n`
                        }
                    }
                    break;
                case "medicine":
                    message += `${item.name}を取り出し、食べた！\n`
                    if (data.enemy.pLToR) {
                        mindMsg(item.mind)
                        if (item.mind < 0 && isSuper) item.mind = item.mind / 2
                        itemBonus.atk = atk * (item.mind * 0.0025);
                        itemBonus.def = def * (item.mind * 0.0025);
                        atk = atk + itemBonus.atk;
                        def = def + itemBonus.def;
                    } else {
                        const heal = Math.round(((100 + lv * 3) - playerHp) * (item.effect * 0.005))
                        playerHp += heal
                        if (heal > 0) {
                            if (item.effect >= 100 && heal >= 50) {
                                message += `もこチキの体力が特大回復！\n${heal}ポイント回復した！\n`
                            } else if (item.effect >= 70 && heal >= 35) {
                                message += `もこチキの体力が大回復！\n${heal}ポイント回復した！\n`
                            } else if (item.effect > 30 && heal >= 15) {
                                message += `もこチキの体力が回復！\n${heal}ポイント回復した！\n`
                            } else {
                                message += `もこチキの体力が小回復！\n${heal}ポイント回復した！\n`
                            }
                        }
                    }
                    break;
                case "poison":
                    if (Math.random() < (skillEffects.poisonAvoid ?? 0)) {
                        message += `${item.name}を取り出したが、美味しそうでなかったので捨てた！\n`
                    } else {
                        message += `${item.name}を取り出し、食べた！\n`
                        if (data.enemy.pLToR) {
                            mindMsg(item.mind)
                            if (item.mind < 0 && isSuper) item.mind = item.mind / 2
                            itemBonus.atk = atk * (item.mind * 0.0025);
                            itemBonus.def = def * (item.mind * 0.0025);
                            atk = atk + itemBonus.atk;
                            def = def + itemBonus.def;
                        } else {
                            const dmg = Math.round(playerHp * (item.effect * 0.003) * (isSuper ? 0.5 : 1));
                            playerHp -= dmg;
                            if (item.effect >= 70 && dmg > 0) {
                                message += `もこチキはかなり調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`
                            } else if (item.effect > 30 && dmg > 0) {
                                message += `もこチキは調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`
                            } else {
                                message += `あまり美味しくなかったようだ…${dmg > 0 ? `\n${dmg}ポイントのダメージを受けた！` : ""}\n`
                            }
                        }
                    }
                    break;
                default:
                    break;
            }
        }

        // 敵のステータスを計算
        /** 敵の攻撃力 */
        let enemyAtk = (typeof data.enemy.atk === "function") ? data.enemy.atk(atk, def, spd) : lv * 3.5 * data.enemy.atk;
        /** 敵の防御力 */
        let enemyDef = (typeof data.enemy.def === "function") ? data.enemy.def(atk, def, spd) : lv * 3.5 * data.enemy.def;

        if (skillEffects.enemyBuff && data.enemy.name !== endressEnemy(data).name) {
            enemyAtk = (typeof data.enemy.atk === "function") ? data.enemy.atk(atk, def, spd) * 1.25 : lv * 3.5 * (data.enemy.atk + 1);
            enemyDef = (typeof data.enemy.def === "function") ? data.enemy.def(atk, def, spd) * 1.25 : lv * 3.5 * (data.enemy.def + 1);
            if (typeof data.enemy.atkx === "number") data.enemy.atkx += 1
            if (typeof data.enemy.defx === "number") data.enemy.defx += 1
        }

        if (skillEffects.enemyStatusBonus) {
            const enemyStrongs = (enemyAtk / (lv * 3.5)) * (getVal(data.enemy.atkx, [tp]) ?? 3) + (enemyDef / (lv * 3.5)) * (getVal(data.enemy.defx, [tp]) ?? 3);
            const bonus = Math.floor((enemyStrongs / 4) * skillEffects.enemyStatusBonus);
            atk = atk * (1 + (bonus / 100))
            def = def * (1 + (bonus / 100))
            if (bonus / skillEffects.enemyStatusBonus >= 5) {
                buff += 1
                message += serifs.rpg.skill.enemyStatusBonus + "\n"
            }
        }

			enemyDef -= (atk * (skillEffects.arpen ?? 0))

        if (skillEffects.firstTurnResist && count === 1 && isBattle && isPhysical) {
            buff += 1
            message += serifs.rpg.skill.firstTurnResist + "\n"
        }

        if (skillEffects.tenacious && playerHpPercent < 0.5 && isBattle && isPhysical) {
            buff += 1
            message += serifs.rpg.skill.tenacious + "\n"
        }

        // バフが1つでも付与された場合、改行を追加する
        if (buff > 0) message += "\n"

        const plusActionX = skillEffects.plusActionX ?? 0

        for (let actionX = 0; actionX < plusActionX + 1; actionX++) {

            /** バフを得た数。行数のコントロールに使用 */
            let buff = 0;

            /** プレイヤーのHP割合 */
            let playerHpPercent = playerHp / (100 + lv * 3);
            /** 敵のHP割合 */
            let enemyHpPercent = enemyHp / enemyMaxHp;

            // 敵に最大ダメージ制限がある場合、ここで計算
            /** 1ターンに与えられる最大ダメージ量 */
            let maxdmg = data.enemy.maxdmg ? enemyMaxHp * data.enemy.maxdmg : undefined

            // 土属性剣攻撃
            if (skillEffects.dart && isBattle && isPhysical && maxdmg) {
                buff += 1
                message += serifs.rpg.skill.dart + "\n"
                maxdmg = maxdmg * (1 + skillEffects.dart)
            } else if (skillEffects.dart && !(isBattle && isPhysical && maxdmg)) {
                // 効果がない場合非戦闘時は、パワーに還元される
                atk = atk * (1 + skillEffects.dart * 0.5);
            }

            let trueDmg = 0;

            // 炎属性剣攻撃
            if (skillEffects.fire && (isBattle && isPhysical)) {
                buff += 1
                message += serifs.rpg.skill.fire + "\n"
                trueDmg = Math.ceil(lv * skillEffects.fire)
            } else if (skillEffects.fire && !(isBattle && isPhysical)) {
                // 非戦闘時は、パワーに還元される
                atk = atk + lv * 3.75 * skillEffects.fire;
            }

            // 毒属性剣攻撃
            if (skillEffects.weak && count > 1) {
                if (isBattle && isPhysical) {
                    buff += 1
                    message += serifs.rpg.skill.weak(data.enemy.dname ?? data.enemy.name) + "\n"
                }
                enemyAtk = Math.max(enemyAtk * (1 - (skillEffects.weak * (count - 1))), 0)
                enemyDef = Math.max(enemyDef * (1 - (skillEffects.weak * (count - 1))), 0)
            }

            // バフが1つでも付与された場合、改行を追加する
            if (buff > 0) message += "\n"

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

            const defDmgX = Math.max(1 *
                (1 + Math.max(skillEffects.defDmgUp ?? 0, -0.9)) *
                (count === 1 && skillEffects.firstTurnResist ? (1 - (skillEffects.firstTurnResist ?? 0)) : 1) *
                (count === 2 && skillEffects.firstTurnResist && skillEffects.firstTurnResist > 1 ? (1 - ((skillEffects.firstTurnResist ?? 0) - 1)) : 1) *
                (1 - Math.min((skillEffects.tenacious ?? 0) * (1 - playerHpPercent), 0.9)), 0)

            const atkMinRnd = Math.max(0.2 + (isSuper ? 0.3 : 0) + (skillEffects.atkRndMin ?? 0), 0)
            const atkMaxRnd = Math.max(1.6 + (isSuper ? -0.3 : 0) + (skillEffects.atkRndMax ?? 0), 0)
            const defMinRnd = Math.max(0.2 + (skillEffects.defRndMin ?? 0), 0)
            const defMaxRnd = Math.max(1.6 + (isSuper ? -0.3 : 0) + (skillEffects.defRndMax ?? 0), 0)

            /** 予測最大ダメージ */
            let predictedDmg = Math.round((atk * tp * (atkMinRnd + atkMaxRnd)) * (1 / (((enemyDef * (getVal(data.enemy.defx, [tp]) ?? 3)) + 100) / 100))) * (abort || spd);

            // 予測最大ダメージは最大ダメージ制限を超えない
            if (maxdmg && predictedDmg > maxdmg) predictedDmg = maxdmg;

            /** 敵のターンが既に完了したかのフラグ */
            let enemyTurnFinished = false

            // 敵先制攻撃の処理
            // spdが1ではない、または戦闘ではない場合は先制攻撃しない
            if (!data.enemy.spd && !data.enemy.hpmsg && !isTired) {
                /** クリティカルかどうか */
                const crit = Math.random() < (playerHpPercent - enemyHpPercent) * (1 - (skillEffects.enemyCritDown ?? 0));
                // 予測最大ダメージが相手のHPの何割かで先制攻撃の確率が判定される
                if (Math.random() < predictedDmg / enemyHp || (count === 3 && data.enemy.fire && (data.thirdFire ?? 0) <= 2)) {
                    const rng = (defMinRnd + random(data, startCharge, skillEffects) * defMaxRnd);
                    if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`
                    const critDmg = 1 + ((skillEffects.enemyCritDmgDown ?? 0) * -1);
                    /** ダメージ */
                    const dmg = getEnemyDmg(data, def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX)
                    const noItemDmg = getEnemyDmg(data, def - itemBonus.def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX)
                    // ダメージが負けるほど多くなる場合は、先制攻撃しない
                    if (playerHp > dmg || (count === 3 && data.enemy.fire && (data.thirdFire ?? 0) <= 2)) {
                        playerHp -= dmg
                        message += (crit ? `**${data.enemy.defmsg(dmg)}**` : data.enemy.defmsg(dmg)) + "\n"
                        if (noItemDmg - dmg > 1) {
                            message += `(道具効果: -${noItemDmg - dmg})\n`
                        }
                        if (playerHp <= 0 && !data.enemy.notEndure) {
                            message += serifs.rpg.endure + "\n"
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

            if (skillEffects.allForOne) {
                atk = atk * spd * 1.1
                spd = 1
            }

            // 自身攻撃の処理
            // spdの回数分、以下の処理を繰り返す
            for (let i = 0; i < spd; i++) {
                const rng = (atkMinRnd + random(data, startCharge, skillEffects) * atkMaxRnd);
                if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`
                const dmgBonus = (1 + (skillEffects.atkDmgUp ?? 0)) * (skillEffects.thunder ? 1 + (skillEffects.thunder * ((i + 1) / spd) / (spd === 1 ? 2 : spd === 2 ? 1.5 : 1)) : 1);
                /** クリティカルかどうか */
                let crit = Math.random() < ((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0))) + (skillEffects.critUpFixed ?? 0);
                const critDmg = 1 + ((skillEffects.critDmgUp ?? 0));
                /** ダメージ */
                let dmg = getAtkDmg(data, atk, tp, count, crit ? critDmg : false, enemyDef, enemyMaxHp, rng * dmgBonus) + trueDmg
                const noItemDmg = getAtkDmg(data, atk - itemBonus.atk, tp, count, crit, enemyDef, enemyMaxHp, rng * dmgBonus) + trueDmg
                // 最大ダメージ制限処理
                if (maxdmg && maxdmg > 0 && dmg > Math.round(maxdmg * (1 / ((abort || spd) - i)))) {
                    // 最大ダメージ制限を超えるダメージの場合は、ダメージが制限される。
                    dmg = Math.round(maxdmg * (1 / ((abort || spd) - i)))
                    maxdmg -= dmg
                    crit = false;
                } else if (maxdmg && maxdmg > 0) {
                    maxdmg -= dmg
                }
                // メッセージの出力
                message += (crit ? `**${data.enemy.atkmsg(dmg)}**` : data.enemy.atkmsg(dmg)) + "\n"
                enemyHp -= dmg
                if (dmg - noItemDmg > 1) {
                    message += `(道具効果: +${dmg - noItemDmg})\n`
                }
                // 敵のHPが0以下になった場合は、以降の攻撃をキャンセル
                if (enemyHp <= 0) break;
                // 攻撃が中断される場合
                if ((i + 1) === abort) {
                    if (data.enemy.abortmsg) message += data.enemy.abortmsg + "\n"
                    break;
                }
            }

            // 覚醒状態でこれが戦闘なら炎で追加攻撃
            if (isSuper && enemyHp > 0 && (isBattle && isPhysical)) {
                message += serifs.rpg.fireAtk(data.enemy.dname ?? data.enemy.name) + `\n`
                data.fireAtk = (data.fireAtk ?? 0) + 10;
            }

            // 勝利処理
            if (enemyHp <= 0) {
                // エンドレスモードかどうかでメッセージ変更
                if (data.enemy.name !== endressEnemy(data).name) {
                    message += "\n" + data.enemy.winmsg + "\n\n" + serifs.rpg.win
                } else {
                    message += "\n" + data.enemy.winmsg + (data.endressFlg ? "\n" + serifs.rpg.journey.win : "")
                    if ((data.endress ?? 0) > (data.maxEndress ?? -1)) data.maxEndress = data.endress;
                    data.endress = (data.endress ?? 0) + 1;
                }
                // 連続勝利数
                data.streak = (data.streak ?? 0) + 1;
                // 1ターンで勝利した場合はさらに+1
                if (data.count == 1) data.streak = (data.streak ?? 0) + 1;
                data.winCount = (data.winCount ?? 0) + 1
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
                data.php = 103 + lv * 3
                data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
                data.maxTp = 0;
                data.fireAtk = 0;
                break;
            } else {
                let enemyAtkX = 1;
                // 攻撃後発動スキル効果
                // 氷属性剣攻撃
                if ((isBattle && isPhysical && !isTired) && Math.random() < (skillEffects.ice ?? 0)) {
                    message += serifs.rpg.skill.ice(data.enemy.dname ?? data.enemy.name) + `\n`
                    enemyTurnFinished = true;
                } else if (!(isBattle && isPhysical && !isTired)) {
                    // 非戦闘時は氷の効果はないが、防御に還元される
                    def = def * (1 + (skillEffects.ice ?? 0));
                }
                // 光属性剣攻撃
                if ((isBattle && isPhysical && !isTired) && Math.random() < (skillEffects.light ?? 0)) {
                    message += serifs.rpg.skill.light(data.enemy.dname ?? data.enemy.name) + `\n`
                    enemyAtkX = enemyAtkX * 0.5;
                } else if (!(isBattle && isPhysical && !isTired)) {
                    // 非戦闘時は光の効果はないが、防御に還元される
                    def = def * (1 + (skillEffects.light ?? 0) * 0.5);
                }
                // 闇属性剣攻撃
                if (data.enemy.spd && data.enemy.spd >= 2 && Math.random() < (skillEffects.dark ?? 0) * 2) {
                    message += serifs.rpg.skill.spdDown(data.enemy.dname ?? data.enemy.name) + `\n`
                    data.enemy.spd = 1;
                } else if ((isBattle && isPhysical) && data.ehp > 150 && Math.random() < (skillEffects.dark ?? 0)) {
                    const dmg = Math.floor(enemyHp / 2)
                    message += serifs.rpg.skill.dark(data.enemy.dname ?? data.enemy.name, dmg) + `\n`
                    enemyHp -= dmg
                } else if (!(isBattle && isPhysical)) {
                    // 非戦闘時は闇の効果はないが、防御に還元される
                    def = def * (1 + (skillEffects.dark ?? 0) * 0.3);
                }
                // 敵のターンが既に終了していない場合
                /** 受けた最大ダメージ */
                let maxDmg = 0;
                if (!enemyTurnFinished) {
                    for (let i = 0; i < (data.enemy.spd ?? 1); i++) {
                        const rng = (defMinRnd + random(data, startCharge, skillEffects) * defMaxRnd);
                        if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`
                        /** クリティカルかどうか */
                        const crit = Math.random() < (playerHpPercent - enemyHpPercent) * (1 - (skillEffects.enemyCritDown ?? 0));
                        const critDmg = 1 + ((skillEffects.enemyCritDmgDown ?? 0) * -1);
                        /** ダメージ */
                        const dmg = getEnemyDmg(data, def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX * enemyAtkX);
                        const noItemDmg = getEnemyDmg(data, def - itemBonus.def, tp, count, crit ? critDmg : false, enemyAtk, rng * defDmgX * enemyAtkX);
                        playerHp -= dmg
                        message += (i === 0 ? "\n" : "") + (crit ? `**${data.enemy.defmsg(dmg)}**` : data.enemy.defmsg(dmg)) + "\n"
                        if (noItemDmg - dmg > 1) {
                            message += `(道具効果: -${noItemDmg - dmg})\n`
                        }
                        if (dmg > maxDmg) maxDmg = dmg;
                        if (data.enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
                    }
                    // HPが0で食いしばりが可能な場合、食いしばる
                    const endure = 0.1 + (0.1 * (data.endure ?? 0)) - (count * 0.05)
                    if (playerHp <= 0 && !data.enemy.notEndure && Math.random() < endure * (1 + (skillEffects.endureUp ?? 0))) {
                        message += serifs.rpg.endure + "\n"
                        playerHp = 1;
                        data.endure = Math.max(data.endure - 1, 0);
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
                            message += "\n" + data.enemy.losemsg + "\n\n" + serifs.rpg.lose
                            data.revenge = data.enemy.name;
                        } else {
                            const minusStage = Math.min(Math.ceil((data.endress ?? 0) / 2), 3 - ((data.endress ?? 0) > (data.maxEndress ?? -1) ? 0 : (data.endress ?? 0) >= ((data.maxEndress ?? -1) / 2) ? 1 : 2))
                            message += "\n" + data.enemy.losemsg + (minusStage ? `\n` + serifs.rpg.journey.lose(minusStage) : "")
                            if ((data.endress ?? 0) - 1 > (data.maxEndress ?? -1)) data.maxEndress = data.endress - 1;
                            data.endress = (data.endress ?? 0) - minusStage;
                        }
                        // これが任意に入った旅モードだった場合は、各種フラグをリセットしない
                        if (!data.endressFlg) {
                            data.streak = 0;
                            data.clearEnemy = [];
                        }
                        data.escape = 0;
                        // 敗北で能力上昇ボーナス
                        bonus += Math.floor(2 * (1 + (skillEffects.loseBonus ?? 0)));
                        data.atk = (data.atk ?? 0) + bonus
                        data.def = (data.def ?? 0) + bonus
                    }
                    // 食いしばり成功率を上げる
                    data.endure = (data.endure ?? 0) + 1
                    // 次の試合に向けてのパラメータセット
                    data.enemy = null;
                    data.count = 1;
                    data.php = 113 + lv * 3
                    data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
                    data.maxTp = 0;
                    data.fireAtk = 0;
                    break;
                } else {
                    // 決着がつかない場合
                    if (actionX === plusActionX) {
                        message += showStatus(data, playerHp, enemyHp, enemyMaxHp, me) + "\n\n" + serifs.rpg.next;
                    } else {
                        message += showStatus(data, playerHp, enemyHp, enemyMaxHp, me) + "\n\n"
                    }
                    data.count = (data.count ?? 1) + 1;
                    count = data.count
                    data.php = playerHp;
                    data.ehp = enemyHp;
                }
            }
        }

        if (skillEffects.charge && data.charge > 0) {
            message += "\n\n" + serifs.rpg.skill.charge
        } else if (data.charge < 0) {
            data.charge = 0;
        }

        // レベルアップ処理
        data.lv = (data.lv ?? 1) + 1;
        let atkUp = (2 + Math.floor(Math.random() * 4));
        let totalUp = 7;
        while (Math.random() < 0.335) {
            totalUp += 1;
            if (Math.random() < 0.5) atkUp += 1
        }

        if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

        if (skillEffects.statusBonus && skillEffects.statusBonus > 0 && data.lv % Math.max(2 / skillEffects.statusBonus, 1) === 0) {
            const upBonus = Math.ceil(skillEffects.statusBonus / 2)
            for (let i = 0; i < upBonus; i++) {
                if (Math.random() < 0.5) atkUp += 1
            }
        }

        while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
            totalUp += 1
            if (Math.random() < 0.5) atkUp += 1
        }

        if (data.atk > 0 && data.def > 0) {
            /** 攻撃力と防御力の差 */
            const diff = data.atk - data.def;
            const totalrate = 0.2 + Math.min(Math.abs(diff) * 0.005, 0.3)
            const rate = (Math.pow(0.5, Math.abs(diff / 100)) * (totalrate / 2))
            if (Math.random() < (diff > 0 ? totalrate - rate : rate)) atkUp = totalUp;
            else if (Math.random() < (diff < 0 ? totalrate - rate : rate)) atkUp = 0;
        }
        data.atk = (data.atk ?? 0) + atkUp;
        data.def = (data.def ?? 0) + totalUp - atkUp;

        /** 追加表示メッセージ */
        let addMessage = ""

        if ((data.info ?? 0) < 1 && ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
            data.info = 1
            addMessage += `\n` + serifs.rpg.info
        }

        let oldSkillName = "";

        if (data.skills?.length) {
            const uniques = new Set()
            for (const _skill of data.skills as Skill[]) {
                const skill = skills.find((x) => x.name === _skill.name) ?? _skill;

                if (skill.unique && uniques.has(skill.unique)) {
                    oldSkillName = skill.name
                    data.skills = data.skills.filter((x: Skill) => x.name !== oldSkillName)
                } else {
                    if (skill.unique) uniques.add(skill.unique)
                }
                if (skill.moveTo) {
                    const moveToSkill = skills.find((x) => x.name === skill.moveTo);
                    if (moveToSkill) {
                        oldSkillName = skill.name;
                        data.skills = data.skills.filter((x: Skill) => x.name !== oldSkillName);
                        data.skills.push(moveToSkill);
                        addMessage += `\n` + serifs.rpg.moveToSkill(oldSkillName, moveToSkill.name);
                    }
                }
            }
        }

        const skillCounts = [20, 50, 100, 175, 255].filter((x) => data.lv >= x).length

        if ((data.skills ?? []).length < skillCounts) {
            if (!data.skills) data.skills = []
            const skill = getSkill(data);
            data.skills.push(skill);
            if (oldSkillName) {
                addMessage += `\n` + serifs.rpg.moveToSkill(oldSkillName, skill.name);
            } else {
                addMessage += `\n` + serifs.rpg.newSkill(skill.name);
            }
        }

        const nowPlay = /\d{4}\/\d{1,2}\/\d{1,2}(\/\d{2})?/.exec(nowTimeStr)
        const nextPlay = !nowPlay?.[1] ? 12 + (skillEffects.rpgTime ?? 0) : nowPlay[1] == "/12" ? 18 + (skillEffects.rpgTime ?? 0) : nowPlay[1] == "/18" ? 24 + (skillEffects.rpgTime ?? 0) : 12 + (skillEffects.rpgTime ?? 0)

        message += [
            `\n\n${serifs.rpg.lvUp}`,
            `  ${serifs.rpg.status.lv} : ${data.lv ?? 1} (+1)`,
            `  ${serifs.rpg.status.atk} : ${data.atk ?? 0} (+${atkUp + bonus})`,
            `  ${serifs.rpg.status.def} : ${data.def ?? 0} (+${totalUp - atkUp + bonus})`,
            addMessage,
			"\n" + amuletMinusDurability(data),
            `\n${serifs.rpg.nextPlay(nextPlay == 24 ? "明日" : nextPlay + "時")}`,
        ].filter(Boolean).join("\n")

        const calcRerollOrbCount = data.lv > 255 ? 32 + Math.floor((data.lv - 254) / 2) + Math.floor((data.lv - 256) / 64) * 16 : data.lv > 170 ? 15 + Math.floor((data.lv - 170) / 5) : data.lv > 100 ? 5 + Math.floor((data.lv - 100) / 7) : Math.floor((data.lv - 50) / 10)

        if ((data.totalRerollOrb ?? 0) < calcRerollOrbCount) {
            const getNum = calcRerollOrbCount - (data.totalRerollOrb ?? 0)
            data.rerollOrb = (data.rerollOrb ?? 0) + getNum
            data.totalRerollOrb = (data.totalRerollOrb ?? 0) + getNum
            message += serifs.rpg.getRerollOrb(getNum);
        }

        msg.friend.setPerModulesData(this, data);

        // 色解禁確認
        const newColorData = colors.map((x) => x.unlock(data));
        /** 解禁した色 */
        let unlockColors = "";
        for (let i = 0; i < newColorData.length; i++) {
            if (!colorData[i] && newColorData[i]) {
                unlockColors += colors[i].name
            }
        }
        if (unlockColors) {
            message += serifs.rpg.newColor(unlockColors)
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
    private replayOkawariHook(key: any, msg: Message, data: any) {
        this.log("replayOkawari")
        if (key.replace("replayOkawari:", "") !== msg.userId) {
            this.log(msg.userId + " : " + key.replace("replayOkawari:", ""))
            return {
                reaction: 'hmm'
            };
        }
        if (msg.text.includes('はい')) {
            this.log("replayOkawari: Yes")
            this.unsubscribeReply(key);
            if (msg.friend.doc?.perModulesData?.rpg) msg.friend.doc.perModulesData.rpg.replayOkawari = true;
            msg.friend.save()
            msg.reply(serifs.rpg.oneMore.buyComp);
            return { reaction: ':mk_muscleok:' };
        } else if (msg.text.includes('いいえ')) {
            this.log("replayOkawari: No")
            this.unsubscribeReply(key);
            return { reaction: ':mk_muscleok:' }
        } else {
            this.log("replayOkawari: ?")
            msg.reply(serifs.core.yesOrNo).then(reply => {
                this.subscribeReply("replayOkawari:" + msg.userId, reply.id);
            });
            return { reaction: 'hmm' }
        }
    }
}

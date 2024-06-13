import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import getDate from '@/utils/get-date';
import { acct } from '@/utils/acct';

const enemys = [
    { name: ":mk_catchicken:", msg: "が撫でてほしいようだ。", short: "を撫で中", hpmsg: "満足度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で！\n${dmg}ポイント満足させた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:を満足させた！", losemsg: "もこチキは疲れで倒れてしまった…", atk: 1, def: 1, atkx: 3, defx: 3},
    { name: ":nisemokochiki_mzh:", msg: "が本物と成り替わろうと勝負を仕掛けてきた！", short: "と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽ペチ！\n:nisemokochiki_mzh:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:nisemokochiki_mzh:の謎の攻撃！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: "どっちが本物か分からせてやった！", losemsg: "もこチキはやられてしまった…", atk: 2, def: 0.5, atkx: 3, defx: 3 },
    { name: ":mokochoki:", msg: "がじゃんけんをしたいようだ。", short: "とじゃんけん中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはパーを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", atk: 1, def: 1, atkx: 3, defx: 3 },
    { name: ":mk_senryu_kun:", msg: "が川柳で勝負したいようだ。", short: "と川柳考え中", mark: "☆", mark2: "★", lToR: true, pLToR: true, atkmsg: (dmg) => `もこチキは考えた！\n川柳の完成度が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_senryu_kun:はTLから情報を収集した！\n:mk_senryu_kun:の川柳の完成度が${dmg}ポイントアップ！`, winmsg: "審査員が来た！\n良い川柳と判定されたのはもこチキだった！", losemsg: "審査員が来た！\n良い川柳と判定されたのは:mk_senryu_kun:だった！", atk: 0.7, def: 1.5, atkx: 3, defx: 3, maxdmg: 0.95, notEndure: true },
    { name: "もこチキは猛勉強", limit: (data) => (data.streak ?? 0) >= 1, msg: "を行うようだ。", short: "中", hpmsg: "勉強度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは勉強に取り組んだ！\n勉強度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったので勉強を一旦止めた！", winmsg: "もこチキは試験で高得点を得ることが出来た！", losemsg: "もこチキは疲れて勉強を諦めてしまった…", maxhp: 320, atk: 2, def: 0.8, atkx: 4, defx: 3, maxdmg: 0.95, abort: 0.05 },
    { name: "もこチキはTLの巡回", limit: (data) => (data.streak ?? 0) >= 1, msg: "を行うようだ。", short: "中", hpmsg: "TL巡回完了度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキはTLの投稿にリアクションを押した！\nTL巡回完了度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったのでTL巡回を一旦止めた！", winmsg: "もこチキはTLの投稿にリアクションを付け終わった！", losemsg: "もこチキは疲れて寝てしまった…", atk: 0.6, def: 2, atkx: 3, defx: 3, maxdmg: 0.95, abort: 0.05 },
    { name: ":mk_fly_sliver:", limit: (data) => (data.streak ?? 0) >= 1, msg: "が一緒に空を飛びたいようだ。", short: "と飛行中", hpmsg: "高度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは羽ばたいた！\n${dmg * 5}cm浮いた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "もこチキはかなり高く飛行できた！", losemsg: "もこチキは疲れで墜落してしまった…", atk: 1.5, def: 1.5, atkx: 3.5, defx: 3.5 },
    { name: ":muscle_mkchicken:", limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 2, msg: "が力比べをしたいようだ。", short: "と力比べ中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽バサバサ！:muscle_mkchicken:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:muscle_mkchicken:のマッスルアタック！\nもこチキは${dmg}ポイントのダメージ！`, abortmsg: ":muscle_mkchicken:は気合でもこチキの連続攻撃を止めた！", winmsg: "もこチキは:muscle_mkchicken:を倒した！", losemsg: "もこチキはやられてしまった…", atk: 4, def: 0.4, atkx: 6, defx: 3, abort: 0.3 },
    { name: ":mk_chickenda:", limit: (data) => (data.winCount ?? 0) >= 5 && (data.streak ?? 0) >= 4, msg: "が勝負を仕掛けてきた！", short: "と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda:の†！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_chickenda:は帰っていった！", losemsg: "もこチキはやられてしまった…", maxhp: 130, atk: 5, def: 5, maxdmg: 0.6, atkx: 5, defx: 5 },
    { name: ":mk_chickenda_gtgt:", limit: (data, friend) => (data.winCount ?? 0) >= 15 && (data.streak ?? 0) >= 7 && (friend.love ?? 0) >= 500, msg: "が本気の勝負を仕掛けてきた！", short: "と本気の戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda_gtgt:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda_gtgt:の†！\nもこチキに${dmg}ポイントのダメージ！`, abortmsg: ":mk_chickenda_gtgt:は:muscle_mkchicken:を召還した！もこチキの連続攻撃を止めた！", winmsg: ":mk_chickenda_gtgt:は帰っていった！", losemsg: "もこチキはやられてしまった…", atk: 15, def: 15, maxdmg: 0.6, atkx: 7, defx: 7, abort: 0.04 },
];


export default class extends Module {
    public readonly name = 'rpg';

    @autobind
    public install() {
        return {
            mentionHook: this.mentionHook
        };
    }

    @autobind
    private async mentionHook(msg: Message) {
        if (msg.includes(['rpg'])) {
            const data = msg.friend.getPerModulesData(this);
            if (!data.clearEnemy) data.clearEnemy = [data.preEnemy ?? ""].filter(Boolean);
            if (data.lastPlayedAt === getDate() + (new Date().getHours() < 12 ? "" : new Date().getHours() < 18 ? "/12" : "/18") && data.ehp <= 110 + data.lv * 3 + (data.winCount ?? 0) * 5) {
                msg.reply(`RPGモードは0~11時、12~17時、18~23時の1日3回です。\n${new Date().getHours() < 12 ? "12時以降" : new Date().getHours() < 18 ? "18時以降" : "明日"}になったらもう一度試してください。`);
                return {
                    reaction: 'confused'
                };
            }
            let continuousFlg = false;
            if (data.lastPlayedAt === (new Date().getHours() < 12 ? getDate(-1) + "/18" : new Date().getHours() < 18 ? getDate() : getDate() + "/12")) {
                continuousFlg = true;
            }
            data.lastPlayedAt = getDate() + (new Date().getHours() < 12 ? "" : new Date().getHours() < 18 ? "/12" : "/18");
            const chart = await this.ai.api('charts/user/notes', {
                span: 'day',
                limit: 2,
                userId: msg.userId
            })
            const postCount = Math.max(
                (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.renote?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
                (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.renote?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
            )
            const tp =
                postCount >= 100
                    ? (postCount - 100) / 100 + 4 + (continuousFlg ? 0.25 : 0)
                    : postCount >= 50
                        ? (postCount - 50) / 50 + 3 + (continuousFlg ? 0.5 : 0)
                        : postCount >= 20
                            ? (postCount - 20) / 30 + 2 + (continuousFlg ? 0.5 : 0)
                            : postCount >= 5
                                ? (postCount - 5) / 15 + 1 + (continuousFlg ? 0.5 : 0)
                                : Math.max(postCount / 5, (continuousFlg ? 1 : 0.3))


            const lv = data.lv ?? 1
            let php = data.php ?? 100;
            let count = data.count ?? 1
            let message = ""
            let cw = acct(msg.user) + " ";
            let endressEnemy = {
                name: "もこチキは旅",
                msg: (data.endress ?? 0) ? `の途中 (${data.endress + 1}日目)` : "に出たいようだ。",
                short: (data.endress ?? 0) ? `の途中 (${data.endress + 1}日目)` : "の途中",
                hpmsg: "進行度",
                lToR: true,
                mark: "☆",
                mark2: "★",
                atkmsg: (dmg) => `もこチキは先に進んだ。\n進行度が${dmg}ポイントアップ！`,
                defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`,
                abortmsg: "もこチキは面白いものを見つけたみたいだ。",
                winmsg: "宿が見えてきた。\n今日はここで休むようだ。\n\n次の日へ続く…",
                losemsg: "今回の旅はここで終えて家に帰るようだ。",
                atk: 2 + (0.1 * (data.endress ?? 0)),
                def: 2 + (0.3 * (data.endress ?? 0)),
                atkx: 3 + (0.05 * (data.endress ?? 0)),
                defx: 3 + (0.15 * (data.endress ?? 0)),
                about: 0.01,
            }
            if (!data.enemy || count === 1) {
                count = 1
                data.count = 1
                php = 100 + lv * 3
                const filteredEnemys = enemys.filter((x) => !(data.clearEnemy ?? []).includes(x.name) && (!x.limit || x.limit(data, msg.friend))).filter((x) => !data.preEnemy || x.name != data.preEnemy);
                if (filteredEnemys.length) {
                    data.enemy = filteredEnemys[Math.floor(filteredEnemys.length * Math.random())]
                } else {
                    data.enemy = endressEnemy
                }
                cw += `${data.enemy.name}${data.enemy.msg}`
                message += `開始！\n\n`
            } else {
                data.enemy = [...enemys, endressEnemy].find((x) => data.enemy.name === x.name);
                cw += `${data.enemy.name}${data.enemy.short} ${count}ターン目`
            }

            if (continuousFlg) {
                message += `連続RPGボーナス！\nパワー・防御がアップした！\n`
            }

            const atk = 5 + (data.atk ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.atk ?? 0)) / 100);
            const def = 5 + (data.def ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.def ?? 0)) / 100);
            let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
            let mehp = Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
            let ehp = Math.min(data.ehp ?? 100, mehp);
            let phpp = php / (100 + lv * 3);
            let ehpp = ehp / mehp;
            let bonus = 0;
            let abort = 0;

            if (spd === 2 && Math.random() < 0.1) {
                message += "もこチキは体の調子が良さそうだ！\n行動回数+1！\n"
                spd = 3;
            }
            if (spd === 1 && Math.random() < 0.5) {
                message += "もこチキは体の調子が良さそうだ！\n行動回数+1！\n"
                spd = 2;
            }

            const eatk = lv * 3.5 * data.enemy.atk;
            const edef = lv * 3.5 * data.enemy.def;
            let maxdmg = data.enemy.maxdmg ? mehp * data.enemy.maxdmg : undefined

            for (let i = 1; i < spd; i++) {
                if (data.enemy.abort && Math.random() < data.enemy.abort) {
                    abort = i;
                    break;
                }
            }

            message += "\n"

            for (let i = 0; i < spd; i++) {
                let dmg = Math.round((atk * tp * ((data.count ?? 1) * 0.5 + 0.5) * (0.2 + Math.random() * 1.6) * (Math.random() < ehpp - phpp ? 2 : 1)) * (1 / (((edef * (data.enemy.defx ?? 3)) + 100) / 100)))
                if (maxdmg && maxdmg > 0 && dmg > Math.round(maxdmg * (1 / ((abort || spd) - i)))) {
                    dmg = Math.round(maxdmg * (1 / ((abort || spd) - i)))
                    maxdmg -= dmg
                } else if (maxdmg && maxdmg > 0) {
                    maxdmg -= dmg
                }
                message += data.enemy.atkmsg(dmg) + "\n"
                ehp -= dmg
                if (ehp <= 0) break;
                if ((i + 1) === abort) {
                    if (data.enemy.abortmsg) message += data.enemy.abortmsg + "\n"
                    break;
                }
            }

            if (ehp <= 0) {
                if (data.enemy.name !== "もこチキは旅") {
                    message += "\n" + data.enemy.winmsg + "\n\n勝利！おめでとう！"
                } else {
                    message += "\n" + data.enemy.winmsg
                    data.endress += 1;
                }
                data.streak = (data.streak ?? 0) + 1;
                if (data.count == 1) data.streak = (data.streak ?? 0) + 1;
                data.clearEnemy.push(data.enemy.name);
                data.enemy = null;
                data.count = 1;
                data.winCount = (data.winCount ?? 0) + 1
                data.php = 103 + lv * 3
                data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
            } else {
                const dmg = Math.round((eatk * (data.enemy.atkx ?? 3) * ((data.count ?? 1) * 0.5 + 0.5) * (0.2 + Math.random() * 1.6) * (Math.random() < phpp - ehpp ? 2 : 1)) * (1 / (((def * tp) + 100) / 100)))
                php -= dmg
                message += "\n" + data.enemy.defmsg(dmg) + "\n"
                if (php <= 0 && !data.enemy.notEndure && count === 1 && Math.random() < 0.05 + (0.1 * (data.endure ?? 0))) {
                    message += "もこチキは気合で耐えた！\n"
                    php = 1;
                    data.endure = 0
                }
                if (php <= 0) {
                    if (data.enemy.name !== "もこチキは旅") {
                        message += "\n" + data.enemy.losemsg + "\n\n:oyoo:"
                    } else {
                        message += "\n" + data.enemy.losemsg + `\n(今回の旅の日数 : ${data.endress + 1}日)`
                        if ((data.endress ?? 0) > (data.maxEndress ?? 0)) data.maxEndress = data.endress;
                        data.endress = 0;
                    }
                    data.streak = 0;
                    data.clearEnemy = [];
                    data.enemy = null;
                    data.count = 1;
                    data.atk = (data.atk ?? 0) + 2
                    data.def = (data.def ?? 0) + 2
                    data.php = 113 + lv * 3
                    data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
                    data.endure += 1
                    bonus += 2;
                } else {
                    const ehpGaugeCount = Math.min(Math.ceil(ehp / mehp / (1 / 7)), 7)
                    const ehpGauge = data.enemy.lToR
                        ? data.enemy.mark2.repeat(7 - ehpGaugeCount) + data.enemy.mark.repeat(ehpGaugeCount)
                        : data.enemy.mark2.repeat(ehpGaugeCount) + data.enemy.mark.repeat(7 - ehpGaugeCount)
                    const phpGaugeCount = Math.min(Math.ceil(php / (100 + lv * 3) / (1 / 7)), 7)
                    const phpGauge = data.enemy.pLToR
                        ? "★".repeat(7 - phpGaugeCount) + "☆".repeat(phpGaugeCount)
                        : "★".repeat(phpGaugeCount) + "☆".repeat(7 - phpGaugeCount)
                    if (data.enemy.pLToR) {
                        message += `\n${data.enemy.hpmsg ? "体力" : ":mk_hi:"} : ${ehpGauge}\n${data.enemy.hpmsg ?? data.enemy.name} : ${phpGauge}\n\n次回へ続く……`
                    } else {
                        message += `\n${data.enemy.hpmsg ?? data.enemy.name} : ${ehpGauge}\n${data.enemy.hpmsg ? "体力" : ":mk_hi:"} : ${phpGauge}\n\n次回へ続く……`
                    }
                    data.count = (data.count ?? 1) + 1;
                    data.php = php;
                    data.ehp = ehp;
                }
            }
            data.lv = (data.lv ?? 1) + 1;
            let atkUp = (2 + Math.floor(Math.random() * 4));
            let totalUp = 7;

            while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
                totalUp += 1
                if (Math.random() < 0.5) atkUp += 1
            }

            while (Math.random() < 0.335) {
                totalUp += 1;
                if (Math.random() < 0.5) atkUp += 1
            }

            if (data.atk > 0 && data.def > 0) {
                if (Math.random() < (Math.pow(0.5, data.def / data.atk) * 0.2)) atkUp = totalUp;
                else if (Math.random() < (Math.pow(0.5, data.atk / data.def) * 0.2)) atkUp = 0;
            }
            data.atk = (data.atk ?? 0) + atkUp;
            data.def = (data.def ?? 0) + totalUp - atkUp;

            message += [
				`\n\n今回のレベルアップ :`,
				`  Lv : ${data.lv ?? 1} (+1)`,
				`  パワー : ${data.atk ?? 0} (+${atkUp + bonus})`,
				`  防御 : ${data.def ?? 0} (+${totalUp - atkUp + bonus})`,
                `\n次回は${new Date().getHours() < 12 ? "12時以降に" : new Date().getHours() < 18 ? "18時以降に" : "明日以降に"}遊べます。`,
			].filter(Boolean).join("\n")

            msg.friend.setPerModulesData(this, data);

            msg.reply(`<center>${message}</center>`, {
                cw,
                visibility: 'public'
            });

            return {
                reaction: 'love'
            };
        } else {
            return false;
        }
    }
}

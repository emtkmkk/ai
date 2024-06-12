import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import getDate from '@/utils/get-date';

const enemys = [
    { name: ":mk_catchicken:", msg: "が撫でてほしいようだ。", short: "を撫で中", hpmsg: "満足度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で！\n${dmg}ポイント満足させた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:を満足させた！", losemsg: "もこチキは疲れで倒れてしまった…", hp: 100, atk: 1, def: 1, atkx: 3, defx: 3 },
    { name: ":nisemokochiki_mzh:", msg: "が本物と成り替わろうと勝負を仕掛けてきた！", short: "と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽ペチ！\n:nisemokochiki_mzh:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:nisemokochiki_mzh:の謎の攻撃！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: "どっちが本物か分からせてやった！", losemsg: "もこチキはやられてしまった…", hp: 100, atk: 2, def: 0.5, atkx: 3, defx: 3 },
    { name: ":mokochoki:", msg: "がじゃんけんをしたいようだ。", short: "とじゃんけん中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはパーを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", hp: 100, atk: 1, def: 1, atkx: 3, defx: 3 },
    { name: ":mk_senryu_kun:", msg: "が川柳で勝負したいようだ。", short: "と川柳考え中", mark: "☆", mark2: "★", lToR: true, pLToR: true, atkmsg: (dmg) => `もこチキは考えた！\n川柳の完成度が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_senryu_kun:はTLから情報を収集した！\n:mk_senryu_kun:の川柳の完成度が${dmg}ポイントアップ！`, winmsg: "審査員が来た！\n良い川柳と判定されたのはもこチキだった！", losemsg: "審査員が来た！\n良い川柳と判定されたのは:mk_senryu_kun:だった！", hp: 100, atk: 0.7, def: 1.5, atkx: 3, defx: 3, maxdmg: 0.95 },
    { name: "もこチキは猛勉強", limit: (data) => (data.streak ?? 0) >= 1, msg: "を行うようだ。", short: "中", hpmsg: "勉強度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは勉強に取り組んだ！\n勉強度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったので勉強を一旦止めた！", winmsg: "もこチキは試験で高得点を得ることが出来た！", losemsg: "もこチキは疲れて勉強を諦めてしまった…", hp: 100, atk: 2, def: 0.8, atkx: 4, defx: 3, maxdmg: 0.95, abort: 0.05 },
    { name: "もこチキはTLの巡回", limit: (data) => (data.streak ?? 0) >= 1, msg: "を行うようだ。", short: "中", hpmsg: "TL巡回完了度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキはTLの投稿にリアクションを押した！\nTL巡回完了度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったのでTL巡回を一旦止めた！", winmsg: "もこチキはTLの投稿にリアクションを付け終わった！", losemsg: "もこチキは疲れて寝てしまった…", hp: 100, atk: 0.6, def: 2, atkx: 3, defx: 3, maxdmg: 0.95, abort: 0.05 },
    { name: ":mk_fly_sliver:", limit: (data) => (data.streak ?? 0) >= 1, msg: "が一緒に空を飛びたいようだ。", short: "と飛行中", hpmsg: "高度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは羽ばたいた！\n${dmg * 5}cm浮いた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "もこチキはかなり高く飛行できた！", losemsg: "もこチキは疲れで墜落してしまった…", hp: 100, atk: 1.5, def: 1.5, atkx: 3.5, defx: 3.5 },
    { name: ":muscle_mkchicken:", limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 2, msg: "が力比べをしたいようだ。", short: "と力比べ中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽バサバサ！:muscle_mkchicken:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:muscle_mkchicken:のマッスルアタック！\nもこチキは${dmg}ポイントのダメージ！`, abortmsg: ":muscle_mkchicken:は気合でもこチキの連続攻撃を止めた！", winmsg: "もこチキは:muscle_mkchicken:を倒した！", losemsg: "もこチキはやられてしまった…", hp: 100, atk: 4, def: 0.3, atkx: 6, defx: 2, abort: 0.3 },
    { name: ":mk_chickenda:", limit: (data) => (data.winCount ?? 0) >= 5 && (data.streak ?? 0) >= 4, msg: "が勝負を仕掛けてきた！", short: "と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda:の†！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_chickenda:は帰っていった！", losemsg: "もこチキはやられてしまった…", hp: 100, atk: 5, def: 5, maxdmg: 0.6, atkx: 5, defx: 5 },
    { name: ":mk_chickenda_gtgt:", limit: (data, friend) => (data.winCount ?? 0) >= 15 && (data.streak ?? 0) >= 7 && (friend.love ?? 0) >= 500, msg: "が本気の勝負を仕掛けてきた！", short: "と本気の戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda_gtgt:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda_gtgt:の†！\nもこチキに${dmg}ポイントのダメージ！`, abortmsg: ":mk_chickenda_gtgt:は:muscle_mkchicken:を召還した！もこチキの連続攻撃を止めた！", winmsg: ":mk_chickenda_gtgt:は帰っていった！", losemsg: "もこチキはやられてしまった…", hp: 100, atk: 15, def: 15, maxdmg: 0.6, atkx: 7, defx: 7, abort: 0.05 },
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
            if (data.lastPlayedAt === getDate() + (new Date().getHours() < 12 ? "" : "/12") && data.ehp <= 110 + data.lv * 3 + (data.winCount ?? 0) * 5) {
                msg.reply(`RPGモードは午前と午後で1日2回だけです。\n${new Date().getHours() < 12 ? "12時以降" : "明日"}になったらもう一度試してください。`);
                return {
                    reaction: 'confused'
                };
            }
            data.lastPlayedAt = getDate() + (new Date().getHours() < 12 ? "" : "/12");
            const chart = await this.ai.api('charts/user/notes', {
                span: 'day',
                limit: 2,
                userId: msg.userId
            })
            const postCount = (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.renote?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
            const tp =
                postCount >= 100
                    ? (postCount - 100) / 100 + 4
                    : postCount >= 50
                        ? (postCount - 50) / 50 + 3
                        : postCount >= 20
                            ? (postCount - 20) / 30 + 2
                            : postCount >= 5
                                ? (postCount - 5) / 15 + 1
                                : Math.max(postCount / 5, 0.3)

            const lv = data.lv ?? 1
            const atk = 5 + (data.atk ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.atk ?? 0)) / 100);
            const def = 5 + (data.def ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.def ?? 0)) / 100);
            let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
            let count = data.count ?? 1
            let php = data.php ?? 100;
            let mehp = (100 + lv * 3) + ((data.winCount ?? 0) * 5);
            let ehp = Math.min(data.ehp ?? 100, mehp);
            let phpp = php / (100 + lv * 3);
            let ehpp = ehp / mehp;
            let message = ""

            if (spd === 2 && Math.random() < 0.1) spd = 3;
            if (spd === 1 && Math.random() < 0.5) spd = 2;

            if (!data.enemy || count === 1) {
                count = 1
                data.count = 1
                php = 100 + lv * 3
                ehp = 100 + lv * 3 + (data.winCount ?? 0) * 5
                const filteredEnemys = enemys.filter((x) => !x.limit || x.limit(data, msg.friend)).filter((x) => !data.preEnemy || x.name != data.preEnemy);
                data.enemy = filteredEnemys[Math.floor(filteredEnemys.length * Math.random())]
                message += `${data.enemy.name}${data.enemy.msg}\n\n開始！\n\n`
            } else {
                data.enemy = enemys.find((x) => data.enemy.name === x.name);
                message += `${data.enemy.name}${data.enemy.short} ${count}ターン目\n\n`
            }
            const eatk = lv * 3.5 * data.enemy.atk;
            const edef = lv * 3.5 * data.enemy.def;
            let maxdmg = data.enemy.maxdmg ? mehp * data.enemy.maxdmg : undefined

            for (let i = 0; i < spd; i++) {
                let dmg = Math.round((atk * tp * ((data.count ?? 1) * 0.5 + 0.5) * (0.2 + Math.random() * 1.6) * (Math.random() < ehpp - phpp ? 2 : 1)) * (1 / (((edef * (data.enemy.defx ?? 3)) + 100) / 100)))
                if (maxdmg && maxdmg > 0 && dmg > Math.round(maxdmg * (1 / (spd - i)))) {
                    dmg = Math.round(maxdmg * (1 / (spd - i)))
                    maxdmg -= dmg
                } else if (maxdmg && maxdmg > 0) {
                    maxdmg -= dmg
                }
                message += data.enemy.atkmsg(dmg) + "\n"
                ehp -= dmg
                if (ehp <= 0) break;
                if ((i + 1) < spd && data.enemy.abort && Math.random() < data.enemy.abort) {
                    if (data.enemy.abortmsg) message += data.enemy.abortmsg + "\n"
                    break;
                }
            }

            if (ehp <= 0) {
                message += "\n" + data.enemy.winmsg + "\n\n勝利！おめでとう！"
                data.streak = (data.streak ?? 0) + 1;
                if (data.count == 1) data.streak = (data.streak ?? 0) + 1;
                data.preEnemy = data.enemy.name;
                data.enemy = null;
                data.count = 1;
                data.winCount = (data.winCount ?? 0) + 1
                data.php = 103 + lv * 3
                data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
            } else {
                const dmg = Math.round((eatk * (data.enemy.atkx ?? 3) * ((data.count ?? 1) * 0.5 + 0.5) * (0.2 + Math.random() * 1.6) * (Math.random() < phpp - ehpp ? 2 : 1)) * (1 / (((def * tp) + 100) / 100)))
                php -= dmg
                message += "\n" + data.enemy.defmsg(dmg) + "\n"
                if (php <= 0) {
                    message += "\n" + data.enemy.losemsg + "\n\n:oyoo:"
                    data.streak = 0;
                    data.preEnemy = data.enemy.name;
                    data.enemy = null;
                    data.count = 1;
                    data.atk = (data.atk ?? 0) + 2
                    data.def = (data.def ?? 0) + 2
                    data.php = 113 + lv * 3
                    data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
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
            if (Math.random() < 0.4) {
                totalUp += 1;
                if (Math.random() < 0.5) atkUp += 1
                if (Math.random() < 0.5){
                    totalUp += 1;
                    if (Math.random() < 0.5) atkUp += 1
                    if (Math.random() < 0.2) {
                        totalUp += 1
                        if (Math.random() < 0.5) atkUp += 1
                    }
                }
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
				`  パワー : ${data.atk ?? 0} (+${atkUp})`,
				`  防御 : ${data.def ?? 0} (+${totalUp - atkUp})`,
			].filter(Boolean).join("\n")

            msg.friend.setPerModulesData(this, data);

            msg.reply(`\n<center>${message}</center>`, {
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

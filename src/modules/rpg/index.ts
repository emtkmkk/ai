import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import getDate from '@/utils/get-date';

const enemys = [
    { name: ":mk_catchicken:", msg: "が撫でてほしいようだ。", short: "を撫で中", hpmsg: "満足度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で！\n${dmg}ポイント満足させた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:を満足させた！", losemsg: "もこチキは疲れで倒れてしまった…", hp: 100, atk: 1, def: 1 },
    { name: ":nisemokochiki_mzh:", msg: "が本物と成り替わろうと勝負を仕掛けてきた！", short: "と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽ペチ！\n:nisemokochiki_mzh:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:nisemokochiki_mzh:の謎の攻撃！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: "どっちが本物か分からせてやった！", losemsg: "もこチキはやられてしまった…", hp: 100, atk: 2, def: 0.5 },
    { name: ":mokochoki:", msg: "がじゃんけんをしたいようだ。", short: "とじゃんけん中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはパーを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", hp: 100, atk: 1, def: 1 },
    { name: ":mk_chickenda:", limit: 5, msg: "が勝負を仕掛けてきた！", short: "と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda:の十字攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_chickenda:は帰っていった！", losemsg: "もこチキはやられてしまった…", hp: 100, atk: 5, def: 5 },
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
            if (data.lastPlayedAt === getDate()) {
                msg.reply(`RPGモードは1日1回だけです。明日になったらもう一度試してください。`);
                return {
                    reaction: 'confused'
                };
            }
            data.lastPlayedAt = getDate();
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
            const atk = 5 + (data.atk ?? 0) + (Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0);
            const def = 5 + (data.def ?? 0) + (Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0);
            let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
            let count = data.count ?? 1
            let php = data.php ?? 100;
            let ehp = data.ehp ?? 100;
            let phpp = php / (100 + lv * 3);
            let ehpp = ehp / ((100 + lv * 3) + ((data.winCount ?? 0) * 5));
            let message = ""
							
					if (spd === 2 && Math.random() < 0.1) spd = 3;
					if (spd === 1 && Math.random() < 0.5) spd = 2;

            if (!data.enemy || count === 1) {
							count = 1
							data.count = 1
							php = 100 + lv * 3
							ehp = 100 + lv * 3 + (data.winCount ?? 0) * 5
                const filteredEnemys = enemys.filter((x) => (data.winCount ?? 0) >= (x.limit ?? 0));
                data.enemy = filteredEnemys[Math.floor(filteredEnemys.length * Math.random())]
                message += `${data.enemy.name}${data.enemy.msg}\n\n開始！\n\n`
            } else {
                message += `${data.enemy.name}${data.enemy.short} ${count}ターン目\n\n`
            }
            const eatk = lv * 3.5 * data.enemy.atk;
            const edef = lv * 3.5 * data.enemy.def;

            for (let i = 0; i < spd; i++) {
                let dmg = Math.round((atk * tp * ((data.count ?? 1) * 0.5 + 0.5) * (0.3 + Math.random() * 1.4) * (Math.random() < ehpp - phpp ? 2 : 1)) * (1 / (((edef * 3) + 100) / 100)))
                message += data.enemy.atkmsg(dmg) + "\n"
                ehp -= dmg
                if (ehp <= 0) break;
            }

            if (ehp <= 0) {
                message += "\n" + data.enemy.winmsg + "\n\n勝利！おめでとう！"
                data.enemy = null;
                data.count = 1;
                data.winCount = (data.winCount ?? 0) + 1
                data.php = 103 + lv * 3
                data.ehp = 103 + lv * 3 + data.winCount * 5
            } else {
                const dmg = Math.round((eatk * 2.5 * ((data.count ?? 1) * 0.5 + 0.5) * (0.3 + Math.random() * 1.4) * (Math.random() < phpp - ehpp ? 2 : 1)) * (1 / (((def * tp) + 100) / 100)))
                php -= dmg
                message += data.enemy.defmsg(dmg) + "\n"
                if (php <= 0) {
                    message += "\n" + data.enemy.losemsg
                    data.enemy = null;
                    data.count = 1;
                    data.atk = (data.atk ?? 0) + 2
                    data.def = (data.def ?? 0) + 2
                    data.php = 113 + lv * 3
                    data.ehp = 103 + lv * 3 + data.winCount * 5
                } else {
                    const ehpGaugeCount = Math.min(Math.ceil(ehp / ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) / 0.2), 5)
                    const ehpGauge = data.enemy.lToR 
                        ? data.enemy.mark2.repeat(5-ehpGaugeCount) + data.enemy.mark.repeat(ehpGaugeCount)
                        : data.enemy.mark2.repeat(ehpGaugeCount) + data.enemy.mark.repeat(5-ehpGaugeCount)
                    const phpGaugeCount = Math.min(Math.ceil(php / (100 + lv * 3) / 0.2), 5)
                    const phpGauge = "★".repeat(phpGaugeCount) + "☆".repeat(5-phpGaugeCount)
                    message += `\n${data.enemy.hpmsg ?? data.enemy.name} : ${ehpGauge}\n${data.enemy.hpmsg ? "体力" : ":mk_hi:"} : ${phpGauge}\n\n明日へ続く……`
									data.count = (data.count ?? 1) + 1;
									data.php = php;
									data.ehp = ehp;
                }
            }
            data.lv = (data.lv ?? 1) + 1;
            data.atk = (data.atk ?? 0) + (2 + Math.floor(Math.random() * 4));
            data.def = (data.def ?? 0) + (2 + Math.floor(Math.random() * 4));

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

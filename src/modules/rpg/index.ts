import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import getDate from '@/utils/get-date';

const enemys = [
    { name: ":mk_catchicken:", msg: "が撫でてほしいようだ。", short: "を撫で中", hpmsg: "満足度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で！\n${dmg}ポイント満足させた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "を満足させた！", losemsg: "は疲れで倒れてしまった…", hp: 100, atk: 1, def: 1 }
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
                                : postCount / 5

            const lv = data.lv ?? 1
            const atk = (data.atk ?? 0) + (Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0);
            const def = (data.def ?? 0) + (Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0);
            const spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
            const count = data.count ?? 1
            let php = data.php ?? 100
            let ehp = data.ehp ?? 100
            let message = ""

            if (count === 1) {
                data.enemy = enemys[Math.floor(enemys.length * Math.random())]
                message += `${data.enemy.name}${data.enemy.msg}\n\n開始！\n\n`
            } else {
                message += `${data.enemy.name}${data.enemy.short} ${count}ターン目\n\n`
            }
            const eatk = lv * 3.5 * data.enemy.atk;
            const edef = lv * 3.5 * data.enemy.def;

            for (let i = 0; i < spd; i++) {
                const dmg = Math.round((atk * tp * (0.3 + Math.random() * 1.4)) * (1 / (((edef * 3) + 100) / 100)))
                message += data.enemy.atkmsg(dmg) + "\n"
                ehp -= dmg
            }

            if (ehp <= 0) {
                message += "\n" + data.enemy.winmsg
                data.enemy = null;
                data.count = 1;
                data.winCount = (data.winCount ?? 0) + 1
                data.php = 103 + lv * 3
                data.ehp = 103 + lv * 3 + data.winCount * 5
            } else {
                const dmg = Math.round((eatk * 2 * (0.3 + Math.random() * 1.4)) * (1 / (((def * tp) + 100) / 100)))
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
                    const ehpGaugeCount = Math.min(Math.ceil(ehp / (100 + lv * 3) / 0.2), 5)
                    const ehpGauge = data.enemy.lToR 
                        ? data.enemy.mark2.repeat(5-ehpGaugeCount) + data.enemy.mark.repeat(ehpGaugeCount)
                        : data.enemy.mark2.repeat(ehpGaugeCount) + data.enemy.mark.repeat(5-ehpGaugeCount)
                    const phpGaugeCount = Math.min(Math.ceil(php / (100 + lv * 3) / 0.2), 5)
                    const phpGauge = "★".repeat(phpGaugeCount) + "☆".repeat(5-phpGaugeCount)
                    message += `\n${data.enemy.hpmsg} : ${ehpGauge}\n体力 : ${phpGauge}\n\n明日へ続く……`
                }
            }

            data.count = (data.count ?? 1) + 1;
            data.lv = (data.lv ?? 1) + 1;
            data.atk = (data.atk ?? 0) + (2 + Math.floor(Math.random() * 4));
            data.def = (data.def ?? 0) + (2 + Math.floor(Math.random() * 4));
            data.php = php;
            data.ehp = ehp;

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

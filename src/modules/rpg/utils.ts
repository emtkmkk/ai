
import 藍 from '@/ai';
import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import rpg from './index';
import { colorReply, colors } from './colors';

/**
 * ステータスを作成し、返します。
 * @param data RPGモジュールのData
 * @param playerHp プレイヤーのHP
 * @param enemyHp 敵のHP
 * @param enemyMaxHp 敵の最大HP
 * @param me 自分の姿
 */
export function showStatus(data, playerHp: number, enemyHp: number, enemyMaxHp: number, me = colors.find((x) => x.default)?.name ?? colors[0].name): string {

    // 敵
    const enemyHpMarkCount = Math.min(Math.ceil(enemyHp / enemyMaxHp / (1 / 7)), 7)
    const enemyHpMarkStr = data.enemy.lToR
        ? data.enemy.mark2.repeat(7 - enemyHpMarkCount) + data.enemy.mark.repeat(enemyHpMarkCount)
        : data.enemy.mark2.repeat(enemyHpMarkCount) + data.enemy.mark.repeat(7 - enemyHpMarkCount)
    const enemyHpInfoStr = data.enemy.lToR
        ? (Math.ceil((100 - Math.min(Math.ceil(enemyHp / enemyMaxHp / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
        : (Math.ceil((Math.min(Math.ceil(enemyHp / enemyMaxHp / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent

    // プレイヤー
    const playerHpMarkCount = Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 7)), 7)
    const playerHpMarkStr = data.enemy.pLToR
        ? serifs.rpg.player.mark2.repeat(7 - playerHpMarkCount) + serifs.rpg.player.mark.repeat(playerHpMarkCount)
        : serifs.rpg.player.mark2.repeat(playerHpMarkCount) + serifs.rpg.player.mark.repeat(7 - playerHpMarkCount)
    const PlayerHpInfoStr = data.enemy.pLToR
        ? (Math.ceil((100 - Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
        : (Math.ceil((Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
    const playerHpStr = data.enemy.pLToR
        ? PlayerHpInfoStr
        : `${playerHp} / ${100 + (data.lv ?? 1) * 3}`

    const debuff = [data.enemy.fire ? serifs.rpg.fire + data.count : ""].filter(Boolean).join(" ")

    if (data.enemy.pLToR) {
        return `\n${data.enemy.hpmsg ? serifs.rpg.player.hpmsg : me} : ${data.info && (data.clearHistory ?? []).includes(data.enemy.name) ? enemyHpInfoStr : enemyHpMarkStr}\n${data.enemy.hpmsg ?? data.enemy.dname ?? data.enemy.name} : ${data.info ? PlayerHpInfoStr : playerHpMarkStr}${debuff ? `\n${debuff}` : ""}`
    } else {
        return `\n${data.enemy.hpmsg ?? data.enemy.dname ?? data.enemy.name} : ${data.info && (data.clearHistory ?? []).includes(data.enemy.name) ? enemyHpInfoStr : enemyHpMarkStr}\n${data.enemy.hpmsg ? serifs.rpg.player.hpmsg : me} : ${data.info >= 3 ? playerHpStr : data.info ? PlayerHpInfoStr : playerHpMarkStr}${debuff ? `\n${debuff}` : ""}`
    }
}

/**
 * ステータスを作成し、返します。
 * @param data RPGモジュールのData
 * @param playerHp プレイヤーのHP
 * @param enemyHp 敵のHP
 * @param enemyMaxHp 敵の最大HP
 * @param me 自分の姿
 */
export function showStatusDmg(data, playerHp: number, totalDmg: number, enemyMaxHp: number, me = colors.find((x) => x.default)?.name ?? colors[0].name): string {

    // プレイヤー
    const playerHpMarkCount = Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 7)), 7)
    const playerHpMarkStr = false
        ? serifs.rpg.player.mark2.repeat(7 - playerHpMarkCount) + serifs.rpg.player.mark.repeat(playerHpMarkCount)
        : serifs.rpg.player.mark2.repeat(playerHpMarkCount) + serifs.rpg.player.mark.repeat(7 - playerHpMarkCount)
    const PlayerHpInfoStr = false
        ? (Math.ceil((100 - Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
        : (Math.ceil((Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
    const playerHpStr = false
        ? PlayerHpInfoStr
        : `${playerHp} / ${100 + (data.lv ?? 1) * 3}`

    const debuff = [data.enemy?.fire ? serifs.rpg.fire + data.count : ""].filter(Boolean).join(" ")

    return `\n${"与えたダメージ"} : ${totalDmg}\n${me} : ${data.info >= 3 ? playerHpStr : data.info ? PlayerHpInfoStr : playerHpMarkStr}${debuff ? `\n${debuff}` : ""}`
}

/**
 * ユーザの投稿数を取得します
 * @param data RPGモジュールのData
 * @param msg Message
 * @param bonus 投稿数に上乗せする値
 * @returns 投稿数
 */
export async function getPostCount(ai: 藍, module: rpg, data, msg, bonus = 0): Promise<number> {
    // ユーザの投稿数を取得
    const chart = await ai.api('charts/user/notes', {
        span: 'day',
        limit: 2,
        userId: msg.userId,
        addInfo: true
    })

    // チャートがない場合
    if (!chart?.diffs) {
        let postCount = 25;
        if (data.noChart && data.todayNotesCount) {
            postCount = Math.max(
                (msg.friend.doc.user?.notesCount ?? data.todayNotesCount) - data.todayNotesCount,
                data.todayNotesCount - (data.yesterdayNotesCount ?? data.todayNotesCount)
            );
        } else {
            data.noChart = true;
        }
        if (msg.friend.doc.linkedAccounts?.length) {
            for (const userId of msg.friend.doc.linkedAccounts) {
                const friend = ai.lookupFriend(userId);
                if (!friend || !friend.doc?.linkedAccounts?.includes(msg.friend.userId)) continue;

                /** リンク先のdata */
                const data = friend.getPerModulesData(module);
                if (data.noChart && data.todayNotesCount) {
                    postCount += Math.max(
                        (friend.doc.user?.notesCount ?? data.todayNotesCount) - data.todayNotesCount,
                        data.todayNotesCount - (data.yesterdayNotesCount ?? data.todayNotesCount)
                    );
                } else {
                    data.noChart = true;
                }
                friend.setPerModulesData(module, data);
            }
        }
        return postCount + bonus;
    } else {
        let postCount = Math.max(
            (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
            (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
        );

        if (msg.friend.doc.linkedAccounts?.length) {
            for (const userId of msg.friend.doc.linkedAccounts) {
                const friend = ai.lookupFriend(userId);
                if (!friend || !friend.doc?.linkedAccounts?.includes(msg.friend.userId)) continue;

                // ユーザの投稿数を取得
                const chart = await ai.api('charts/user/notes', {
                    span: 'day',
                    limit: 2,
                    userId: userId
                })

                postCount += Math.max(
                    (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
                    (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
                );
            }
        }
        if (chart.add) {
            const userstats = chart.add.filter((x) => !msg.friend.doc.linkedAccounts?.includes(x.id))
            let total = 0;
            for (const userstat of userstats) {
                total += Math.max(
                    (userstat.diffs.normal?.[0] ?? 0) + (userstat.diffs.reply?.[0] ?? 0) + (userstat.diffs.withFile?.[0] ?? 0),
                    (userstat.diffs.normal?.[1] ?? 0) + (userstat.diffs.reply?.[1] ?? 0) + (userstat.diffs.withFile?.[1] ?? 0)
                );
            }
            postCount += Math.floor(total * 0.3)
        }
        return postCount + bonus;
    }
}

/**
 * 投稿数からステータス倍率を計算します
 * 3 で 1倍
 * 10 で 2倍
 * 25 で 3倍
 * 75 で 4倍
 * 以降 100 毎に +1倍
 * @param postCount 投稿数
 * @returns ステータス倍率
 */
export function getPostX(postCount) {
    return postCount >= 75
        ? (postCount - 75) / 100 + 4
        : postCount >= 25
            ? (postCount - 25) / 50 + 3
            : postCount >= 10
                ? (postCount - 10) / 15 + 2
                : postCount >= 3
                    ? (postCount - 3) / 7 + 1
                    : Math.max(postCount / 3, (1 / 3))
}

/**
 * プレイヤーが与えるダメージを計算します
 * @param data RPGモジュールのData
 * @param atk 攻撃力
 * @param tp ステータス倍率
 * @param count ターン数
 * @param crit クリティカルかどうか
 * @param enemyDef 敵の防御力
 * @param enemyMaxHp 敵の最大HP
 * @param rng 乱数（固定する場合は指定）
 * @param defx 敵の防御ステータス倍率（固定する場合は指定）
 * @returns プレイヤーが与えるダメージ
 */
export function getAtkDmg(data, atk: number, tp: number, count: number, crit: number | boolean, enemyDef: number, enemyMaxHp: number, rng = (0.2 + Math.random() * 1.6), defx?: number) {
    let dmg = Math.round((atk * tp * (Math.max((count ?? 1) - 1, 1) * 0.5 + 0.5) * rng * (crit ? typeof crit === "number" ? (2 * crit) : 2 : 1)) * (1 / (((enemyDef * (defx ?? getVal(data.enemy.defx, [tp]) ?? 3)) + 100) / 100)))
    if (data.fireAtk > 0 && enemyMaxHp < 10000) {
        dmg += Math.round((data.fireAtk) * enemyMaxHp * 0.01)
        data.fireAtk = (data.fireAtk ?? 0) - 1;
    }
    return Math.max(dmg, 1);
}

/**
 * プレイヤーが受けるダメージを計算します
 * @param data RPGモジュールのData
 * @param def 防御力
 * @param tp ステータス倍率
 * @param count ターン数
 * @param crit クリティカルかどうか
 * @param enemyAtk 敵の攻撃力
 * @param rng 乱数（固定する場合は指定）
 * @returns プレイヤーが受けるダメージ
 */
export function getEnemyDmg(data, def: number, tp: number, count: number, crit: number | boolean, enemyAtk: number, rng = (0.2 + Math.random() * 1.6), atkx?) {
    let dmg = Math.round((enemyAtk * (atkx ?? getVal(data.enemy.atkx, [tp]) ?? 3) * (Math.max((count ?? 1) - 1, 1) * 0.5 + 0.5) * rng * (crit ? typeof crit === "number" ? (2 * crit) : 2 : 1)) * (1 / (((def * tp) + 100) / 100)))
    if (data.enemy?.fire) {
        dmg += Math.round(((data.count ?? count) - 1) * (100 + data.lv * 3) * data.enemy.fire)
    }
    return Math.max(dmg, 1);
}

export function random(data, startCharge = 0, skillEffects) {
    let rnd = Math.random();
    if (skillEffects.charge) {
        const charge = Math.min(startCharge, data.charge)
        if (charge > 0) {
            rnd = (charge / 2) + (rnd * (1 - (charge / 2)));
        }
        if (rnd < 0.5) {
            data.charge += 0.5 - rnd;
        }
        if (rnd > 0.5) {
            data.charge -= rnd - 0.5;
        }
    }
    return rnd;
}

/**
 * valで指定された値が関数の場合、計算し値を返します。
 * @param val 関数または値
 * @param props 関数だった場合の引数
 * @returns 値
 */
export function getVal(val, props?) {
    if (typeof val === "function") {
        return val(...props);
    }
    return val
}


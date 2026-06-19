/**
 * @packageDocumentation
 *
 * RPGモジュールのユーティリティ
 *
 * データ初期化、ダメージ計算、ステータス表示、投稿数取得、乱数生成等の補助関数を提供する。
 *
 * @remarks
 * - initializeData は戦闘・木人・レイド・ショップ等の入口で呼ばれ、RPGデータを正規化する
 * - getPostCount / getPostX はステータス倍率計算に使用される
 *
 * @public
 */
import 藍 from '@/ai';
import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import rpg from './index';
import { colorReply, colors } from './colors';
import { aggregateTokensEffects, shopItems } from './shop';
import { countDuplicateSkillNames, getSkill, Skill, skillBorders, skills, ultimateAmulet } from './skills';
import config from '@/config';
import getDate from '@/utils/get-date';

/**
 * 投稿数取得の利用コンテキスト
 *
 * 同一キーで複数回取得されるのを防ぐためのブロック判定に使用する。
 *
 * @public
 */
export type PostCountUsageContext = {
    type: 'normal' | 'raid';
    key: string;
};

/**
 * RPGデータを初期化・正規化する
 *
 * フレンドから perModulesData.rpg を取得し、未定義プロパティの初期化・旧データのマイグレーションを行う。
 *
 * @param module RPGモジュール
 * @param msg メッセージ（msg.friend からデータを取得）
 * @returns 正規化されたRPGデータ（同一参照が返る）
 * @internal
 */
export function initializeData(module: rpg, msg) {
    const data = msg.friend.getPerModulesData(module);
    data.userId = msg.userId;
    data.username = msg.user?.username;
    data.host = msg.user?.host ?? null;
    if (!data.clearEnemy) data.clearEnemy = [data.preEnemy ?? ""].filter(Boolean);
    if (!data.clearHistory) data.clearHistory = data.clearEnemy;
    if (!data.items) data.items = [];
    if (!data.tempAmulet) data.tempAmulet = [];
    if (data.items?.some(x => x.name === '選択カードの札')) {
        data.items = data.items.map(item => item.name === '選択カードの札' ? { ...item, name: '質問カードの札' } : item);
    }
    if (Array.isArray(data.bankItems) && data.bankItems.some(x => x === '選択カードの札')) {
        data.bankItems = data.bankItems.map(name => name === '選択カードの札' ? '質問カードの札' : name);
    }
    if (Array.isArray(data.shopItems) && data.shopItems.some(name => !Array.isArray(name) && name === '選択カードの札')) {
        data.shopItems = data.shopItems.map(name => Array.isArray(name) ? name : name === '選択カードの札' ? '質問カードの札' : name);
    }
    if (Array.isArray(data.shop2Items) && data.shop2Items.some(name => !Array.isArray(name) && name === '選択カードの札')) {
        data.shop2Items = data.shop2Items.map(name => Array.isArray(name) ? name : name === '選択カードの札' ? '質問カードの札' : name);
    }
    if (Array.isArray(data.showShopItems) && data.showShopItems.some(item => item.name === '選択カードの札')) {
        data.showShopItems = data.showShopItems.map(item => ({ ...item, name: item.name === '選択カードの札' ? '質問カードの札' : item.name }));
    }
    if (!data.coin) data.coin = 0;
    if (data.vitality == null) data.vitality = 0;
    if (data.lastVitalitySlot == null) data.lastVitalitySlot = '';
    if (data.raidVitality == null) data.raidVitality = 0;
    if (data.lastRaidParticipatedPostId == null) data.lastRaidParticipatedPostId = '';
    if (data.lastRaidVitalityProcessedAt == null) data.lastRaidVitalityProcessedAt = 0;
		if (data.shopExp < 200 && data.jar === 1) data.shopExp = 200;
		if (data.shopExp < 600 && data.jar === 2) data.shopExp = 600;
		if (data.shopExp < 1200 && data.jar === 3) data.shopExp = 1200;
		if (data.shopExp < 2000 && data.jar === 4) data.shopExp = 2000;
		if (data.shopExp < 3000 && data.jar === 5) data.shopExp = 3000;
		if (data.shopExp < 4200 && data.jar === 6) data.shopExp = 4200;
  		if (data.atkMedal && data.atkMedal > 10) {
			data.rerollOrb += 120 * (data.atkMedal - 10);
			data.atkMedal = 10;
		}
  		if (data.defMedal && data.defMedal > 10) {
			data.rerollOrb += 120 * (data.defMedal - 10);
			data.defMedal = 10;
		}
  		if (data.itemMedal && data.itemMedal > 10) {
			data.rerollOrb += 120 * (data.itemMedal - 10);
			data.itemMedal = 10;
		}
    data.clearRaidNum = (Array.from(new Set(data.clearRaid ?? []))?.length) ?? 0;
    data.items?.forEach((x) => {
        x.type = [...shopItems, ultimateAmulet].find((y) => y.name === x.name)?.type ?? (x.skillName ? "amulet" : "token");
    });
    if (data.items.filter((x) => x.type === "amulet").length > 1) {
        if (!data.shopItems) data.shopItems = [];
        data.items.filter((x) => x.type === "amulet").forEach((x) => {
            data.coin += x.price;
            data.shopItems.push(x.name);
        });
        data.items = data.items.filter((x) => x.type !== "amulet");

    }
    return data;
}

// #region 活力（プレイ枠スキップ時の蓄積・消費）

/**
 * プレイ枠キーを数値順序に変換する
 *
 * @param slotKey プレイ枠キー（`YYYY/M/D` / `YYYY/M/D/12` / `YYYY/M/D/18`）
 * @returns 比較用の序数
 * @internal
 */
function slotKeyToOrdinal(slotKey: string): number {
    const match = /^(\d+)\/(\d+)\/(\d+)(\/(\d+))?$/.exec(slotKey);
    if (!match) return 0;
    const part = match[5] ? parseInt(match[5], 10) : 0;
    return parseInt(match[1], 10) * 100000000 + parseInt(match[2], 10) * 1000000 + parseInt(match[3], 10) * 1000 + part;
}

/**
 * 2つのプレイ枠キーを時系列で比較する
 *
 * @param a 枠キーA
 * @param b 枠キーB
 * @returns a が b より前なら負、後なら正、同じなら 0
 * @internal
 */
function compareSlotKeys(a: string, b: string): number {
    return slotKeyToOrdinal(a) - slotKeyToOrdinal(b);
}

/**
 * 次のプレイ枠キーを返す
 *
 * @param slotKey 現在の枠キー
 * @returns 次の枠キー。解析不能な場合は空文字
 * @internal
 */
function nextSlotKey(slotKey: string): string {
    const match = /^(\d+)\/(\d+)\/(\d+)(\/(\d+))?$/.exec(slotKey);
    if (!match) return '';
    const day = match[1] + '/' + match[2] + '/' + match[3];
    if (!match[4]) return day + '/12';
    if (match[4] === '/12') return day + '/18';
    const parts = match.slice(1, 4).map((x) => parseInt(x, 10));
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 前のプレイ枠キーを返す
 *
 * @param slotKey 現在の枠キー
 * @returns 前の枠キー。解析不能な場合は null
 * @internal
 */
function prevSlotKey(slotKey: string): string | null {
    const match = /^(\d+)\/(\d+)\/(\d+)(\/(\d+))?$/.exec(slotKey);
    if (!match) return null;
    const day = match[1] + '/' + match[2] + '/' + match[3];
    if (!match[4]) {
        const parts = match.slice(1, 4).map((x) => parseInt(x, 10));
        const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}/18`;
    }
    if (match[4] === '/12') return day;
    if (match[4] === '/18') return day + '/12';
    return null;
}

/**
 * 指定日時のプレイ枠キーを生成する
 *
 * @remarks
 * {@link rpg.index} の `nowTimeStr` と同形式（0-11時 / 12-17時 / 18-23時の3分割）。
 *
 * @param date 対象日時。省略時は現在
 * @returns プレイ枠キー
 * @public
 */
export function getPlaySlotKey(date: Date = new Date()): string {
    const now = new Date();
    const target = new Date(date);
    const dayDiff = Math.floor(
        (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
            - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000
    );
    const dayStr = getDate(dayDiff);
    const h = target.getHours();
    if (h < 12) return dayStr;
    if (h < 18) return dayStr + '/12';
    return dayStr + '/18';
}

/**
 * 終了したプレイ枠を走査し、未プレイ分の活力を蓄積する
 *
 * @remarks
 * - 枠終了時点で `lastPlayedAt !== slotKey` なら +1（maxLv との大小は問わない）
 * - `lastVitalitySlot` から現在枠の手前まで遡って差分を加算する（遅延計算）
 * - 初回（`lastVitalitySlot` 未設定）かつ Lv1 未プレイ以外は `lastPlayedAt` を起点に遡及する
 * - 初回かつ Lv1 未プレイのみ、過去分は加算せずチェックポイントのみ初期化する
 * - `vitalityBackfilled` 未設定の既存ユーザーは一度だけ活力をリセットし `lastPlayedAt` から再計算する（TEMP）
 * - RPGプレイ時・ステータス表示時など、必要なタイミングでのみ呼ぶ
 *
 * @param data RPGプレイヤーデータ
 * @param _rpgData サーバーRPGデータ（将来拡張用。現状未使用）
 * @param upToDate 走査の終端（この枠は未終了として除外）。省略時は現在
 * @public
 */
export function accumulateVitality(data, _rpgData?, upToDate: Date = new Date()): void {
    if (data.vitality == null) data.vitality = 0;
    if (data.lastVitalitySlot == null) data.lastVitalitySlot = '';

    // TEMP: 旧初回ロジックで lastVitalitySlot のみ埋まったユーザーを lastPlayedAt 起点で再計算する
    if (!data.vitalityBackfilled) {
        data.vitality = 0;
        data.lastVitalitySlot = '';
        data.vitalityBackfilled = true;
    }

    const currentSlot = getPlaySlotKey(upToDate);

    if (!data.lastVitalitySlot) {
        const isUnplayedLv1 = (data.lv ?? 1) <= 1 && !data.lastPlayedAt;
        if (isUnplayedLv1) {
            const prev = prevSlotKey(currentSlot);
            if (prev) data.lastVitalitySlot = prev;
            return;
        }
        if (data.lastPlayedAt) {
            data.lastVitalitySlot = data.lastPlayedAt;
        } else {
            const prev = prevSlotKey(currentSlot);
            if (prev) data.lastVitalitySlot = prev;
            return;
        }
    }

    let slot = nextSlotKey(data.lastVitalitySlot);
    while (slot && compareSlotKeys(slot, currentSlot) < 0) {
        if (data.lastPlayedAt !== slot) {
            data.vitality += 1;
        }
        data.lastVitalitySlot = slot;
        slot = nextSlotKey(slot);
    }
}

// #endregion

/**
 * 現在の色オブジェクトを取得する
 *
 * data.color に対応する色を colors から取得し、解放条件・覚醒色の適用を行う。
 *
 * @param data RPGモジュールのデータ
 * @returns 適用済みの色オブジェクト（deepClone されたコピー）
 * @internal
 */
export function getColor(data) {
    const sourceColor = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
    let color = deepClone(sourceColor);

    if (!sourceColor.unlock(data)) {
        const fallbackColor = colors.find((x) => x.default) ?? colors[0];
        data.color = fallbackColor.id;
        color = deepClone(fallbackColor);
    }

    const superColor = colors.find((x) => x.alwaysSuper);
    if (superColor?.unlock(data) && !color.alwaysSuper && color.enhance && color.enhance(data)) {
        color.alwaysSuper = true;
        color.name = `$[sparkle ${color.name}]`;
    }

    return color;
}

/**
 * 戦闘中のステータス表示文字列を生成する
 * @param data RPGモジュールのData
 * @param playerHp プレイヤーのHP
 * @param enemyHp 敵のHP
 * @param enemyMaxHp 敵の最大HP
 * @param me 自分の姿
 */
export function showStatus(data, playerHp: number, enemyHp: number, enemyMaxHp: number, me = colors.find((x) => x.default)?.name ?? colors[0].name): string {

    // 敵
    const enemyHpMarkCount = Math.min(Math.ceil(enemyHp / enemyMaxHp / (1 / 7)), 7);
    const enemyHpMarkStr = data.enemy.lToR
        ? data.enemy.mark2.repeat(7 - enemyHpMarkCount) + data.enemy.mark.repeat(enemyHpMarkCount)
        : data.enemy.mark2.repeat(enemyHpMarkCount) + data.enemy.mark.repeat(7 - enemyHpMarkCount);
    const enemyHpInfoStr = data.enemy.lToR
        ? (Math.ceil((100 - Math.min(Math.ceil(enemyHp / enemyMaxHp / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
        : (Math.ceil((Math.min(Math.ceil(enemyHp / enemyMaxHp / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent;

    // プレイヤー
    const playerHpMarkCount = Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 7)), 7);
    const playerHpMarkStr = data.enemy.pLToR
        ? serifs.rpg.player.mark2.repeat(7 - playerHpMarkCount) + serifs.rpg.player.mark.repeat(playerHpMarkCount)
        : serifs.rpg.player.mark2.repeat(playerHpMarkCount) + serifs.rpg.player.mark.repeat(7 - playerHpMarkCount);
    const PlayerHpInfoStr = data.enemy.pLToR
        ? (Math.ceil((100 - Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
        : (Math.ceil((Math.min(Math.ceil(playerHp / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent;
    const playerHpStr = data.enemy.pLToR
        ? PlayerHpInfoStr
        : `${playerHp} / ${100 + Math.min(data.lv * 3, 765) + Math.floor((data.defMedal ?? 0) * 13.4)}`;

    const debuff = [data.enemy.fire ? serifs.rpg.fire + data.count : ""].filter(Boolean).join(" ");

    if (data.enemy.pLToR) {
        return `\n${data.enemy.hpmsg ? serifs.rpg.player.hpmsg : me} : ${data.info && (data.clearHistory ?? []).includes(data.enemy.name) ? enemyHpInfoStr : enemyHpMarkStr}\n${data.enemy.hpmsg ?? data.enemy.dname ?? data.enemy.name} : ${data.info ? PlayerHpInfoStr : playerHpMarkStr}${debuff ? `\n${debuff}` : ""}`;
    } else {
        return `\n${data.enemy.hpmsg ?? data.enemy.dname ?? data.enemy.name} : ${data.info && (data.clearHistory ?? []).includes(data.enemy.name) ? enemyHpInfoStr : enemyHpMarkStr}\n${data.enemy.hpmsg ? serifs.rpg.player.hpmsg : me} : ${data.info >= 3 ? playerHpStr : data.info ? PlayerHpInfoStr : playerHpMarkStr}${debuff ? `\n${debuff}` : ""}`;
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
export function showStatusDmg(data, playerHp: number, totalDmg: number, playerMaxHp: number, me = colors.find((x) => x.default)?.name ?? colors[0].name, additionalStatuses: { icon: string; value: number }[] = []): string {

    // プレイヤー
    const playerHpMarkCount = Math.min(Math.ceil(playerHp / (playerMaxHp) / (1 / 7)), 7);
    const playerHpMarkStr = false
        ? serifs.rpg.player.mark2.repeat(7 - playerHpMarkCount) + serifs.rpg.player.mark.repeat(playerHpMarkCount)
        : serifs.rpg.player.mark2.repeat(playerHpMarkCount) + serifs.rpg.player.mark.repeat(7 - playerHpMarkCount);
    const PlayerHpInfoStr = false
        ? (Math.ceil((100 - Math.min(Math.ceil(playerHp / (playerMaxHp) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent
        : (Math.ceil((Math.min(Math.ceil(playerHp / (playerMaxHp) / (1 / 100)), 100)) / 5) * 5) + " " + serifs.rpg.infoPercent;
    const playerHpStr = false
        ? PlayerHpInfoStr
        : `${playerHp.toFixed(0)} / ${playerMaxHp}`;

    const statusIcons = additionalStatuses
        .map((status) => ({
            icon: status.icon,
            value: status.icon === "🍀"
                ? Math.round(status.value * 100)
                : (status.value > 0 && status.value < 1 ? 1 : Math.floor(status.value))
        }))
        .filter((status) => status.value >= 1)
        .map((status) => `${status.icon}${status.value}`)
        .join(" ");

    const hpView = data.info >= 3 ? playerHpStr : data.info ? PlayerHpInfoStr : playerHpMarkStr;

    return `\n${"与えたダメージ"} : ${totalDmg}\n${me} : ${hpView}${statusIcons ? `\n${statusIcons}` : ""}`;
}

/**
 * ユーザの投稿数を取得します
 * @param data RPGモジュールのData
 * @param msg Message
 * @param bonus 投稿数に上乗せする値
 * @returns 投稿数
 */
export async function getPostCount(
    ai: 藍,
    module: rpg,
    data,
    msg,
    bonus = 0,
    usage?: PostCountUsageContext
): Promise<number> {

    let chart;
    // ユーザの投稿数を取得
    if (config.forceRemoteChartPostCount) {
        // ユーザの投稿数を取得
        chart = await ai.api('charts/user/notes', {
            span: 'day',
            limit: 2,
            userId: msg.userId,
            addInfo: true
        });
    }

    const usageField = usage ? (usage.type === 'raid' ? 'lastRaidPostCountUsageKey' : 'lastPostCountUsageKey') : null;
    const isBlocked = (targetData) => {
        if (!usageField || !usage) return false;
        return targetData?.[usageField] === usage.key;
    };
    const markUsage = (targetData) => {
        if (!usageField || !usage) return;
        targetData[usageField] = usage.key;
    };

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

        const mainBlocked = isBlocked(data);
        if (mainBlocked) {
            postCount = 0;
        } else {
            markUsage(data);
        }

        if (msg.friend.doc.linkedAccounts?.length) {
            for (const userId of msg.friend.doc.linkedAccounts) {
                if (msg.userId === userId) {
                    msg.friend.doc.linkedAccounts = msg.friend.doc.linkedAccounts.filter((x) => x !== userId);
                    msg.friend.doc.save();
                }
                const friend = ai.lookupFriend(userId);
                if (!friend || !friend.doc?.linkedAccounts?.includes(msg.friend.userId)) continue;

                /** リンク先のdata */
                const linkData = friend.getPerModulesData(module);
                let linkedPostCount = 0;
                if (linkData.noChart && linkData.todayNotesCount) {
                    linkedPostCount = Math.max(
                        (friend.doc.user?.notesCount ?? linkData.todayNotesCount) - linkData.todayNotesCount,
                        linkData.todayNotesCount - (linkData.yesterdayNotesCount ?? linkData.todayNotesCount)
                    );
                } else {
                    linkData.noChart = true;
                }

                const linkedBlocked = isBlocked(linkData);
                if (linkedBlocked) {
                    linkedPostCount = 0;
                } else {
                    markUsage(linkData);
                }

                postCount += linkedPostCount;
                friend.setPerModulesData(module, linkData);
            }
        }
        return postCount + bonus;
    } else {
        let postCount = Math.max(
            (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
            (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
        );

        const mainBlocked = isBlocked(data);
        if (mainBlocked) {
            postCount = 0;
        } else {
            markUsage(data);
        }

        if (msg.friend.doc.linkedAccounts?.length) {
            for (const userId of msg.friend.doc.linkedAccounts) {
                if (msg.userId === userId) {
                    msg.friend.doc.linkedAccounts = msg.friend.doc.linkedAccounts.filter((x) => x !== userId);
                    msg.friend.doc.save();
                }
                const friend = ai.lookupFriend(userId);
                if (!friend || !friend.doc?.linkedAccounts?.includes(msg.friend.userId)) continue;

                let friendChart;
                if (!friend.doc?.user.host || config.forceRemoteChartPostCount) {
                    // ユーザの投稿数を取得
                    friendChart = await ai.api('charts/user/notes', {
                        span: 'day',
                        limit: 2,
                        userId: userId
                    });
                }

                const linkData = friend.getPerModulesData(module);
                let linkedPostCount = 0;
                if (friendChart?.diffs) {
                    linkedPostCount = Math.max(
                        (friendChart.diffs.normal?.[0] ?? 0) + (friendChart.diffs.reply?.[0] ?? 0) + (friendChart.diffs.withFile?.[0] ?? 0),
                        (friendChart.diffs.normal?.[1] ?? 0) + (friendChart.diffs.reply?.[1] ?? 0) + (friendChart.diffs.withFile?.[1] ?? 0)
                    );
                }

                const linkedBlocked = isBlocked(linkData);
                if (linkedBlocked) {
                    linkedPostCount = 0;
                } else {
                    markUsage(linkData);
                }

                postCount += linkedPostCount;
                friend.setPerModulesData(module, linkData);
            }
        }
        if (!mainBlocked && chart?.add) {
            const userstats = chart.add.filter((x) => !msg.friend.doc.linkedAccounts?.includes(x.id));
            let total = 0;
            for (const userstat of userstats) {
                total += Math.max(
                    (userstat.diffs.normal?.[0] ?? 0) + (userstat.diffs.reply?.[0] ?? 0) + (userstat.diffs.withFile?.[0] ?? 0),
                    (userstat.diffs.normal?.[1] ?? 0) + (userstat.diffs.reply?.[1] ?? 0) + (userstat.diffs.withFile?.[1] ?? 0)
                );
            }
            postCount += Math.floor(total * 0.3);
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
                    : Math.max(postCount / 3, (1 / 3));
}

/**
 * 投稿数からステータス倍率を計算します（レイド用）
 * 0 で 4倍
 * 100 で 5倍
 * 300 で 6倍
 * 以降 700(+400) x7 1500(+800) x8 3100(+1600) x9 ...
 * @param postCount 投稿数
 * @returns ステータス倍率
 */
export function getRaidPostX(postCount) {
    let baseValue = 4;
    let threshold = 0;
    let incrementValue = 100;

    while (postCount >= threshold + incrementValue) {
        baseValue++;
        threshold += incrementValue;
        incrementValue *= 2;
    }

    return baseValue + (postCount - threshold) / incrementValue;
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
    let dmg = Math.round((Math.max(atk, 1) * tp * (Math.max((count ?? 1) - 1, 1) * 0.5 + 0.5) * rng * (crit ? typeof crit === "number" ? (2 * crit) : 2 : 1)) * (1 / (((Math.max(enemyDef, 1) * (defx ?? getVal(data.enemy.defx, [tp]) ?? 3)) + 100) / 100)));
    if (data.fireAtk > 0 && enemyMaxHp < 10000) {
        dmg += Math.round((data.fireAtk) * enemyMaxHp * 0.01);
        data.fireAtk = (data.fireAtk ?? 0) - 1;
    }
    if (Number.isNaN(dmg)) {
        throw new Error();
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
    let dmg = Math.round((Math.max(enemyAtk, 1) * (atkx ?? getVal(data.enemy.atkx, [tp]) ?? 3) * (Math.max((count ?? 1) - 1, 1) * 0.5 + 0.5) * rng * (crit ? typeof crit === "number" ? (2 * crit) : 2 : 1)) * (1 / (((Math.max(def, 1) * tp) + 100) / 100)));
    if (data.enemy?.fire) {
        const fireBase = data.fireStack ?? ((data.count ?? count) - 1);
        dmg += Math.round(Math.max(fireBase, 0) * Math.min(100 + data.lv * 3, 865) * data.enemy.fire);
    }
    if (Number.isNaN(dmg)) {
        throw new Error();
    }
    return Math.max(dmg, 1);
}

/**
 * スキル効果を考慮した乱数を生成する
 *
 * notRandom スキルで固定値に近づく。charge スキルでチャージ量に応じて乱数が偏る。
 *
 * @param data RPGモジュールのデータ（charge が更新される）
 * @param startCharge 開始時のチャージ量
 * @param skillEffects スキル効果集計
 * @param reverse charge の増減を反転するか（逃走等で使用）
 * @returns 0〜1 の乱数
 * @internal
 */
export function random(data, startCharge = 0, skillEffects, reverse = false) {
    let rnd = (skillEffects.notRandom || aggregateTokensEffects(data).notRandom) && !reverse ? 0.5 + (skillEffects.notRandom ?? 0) * 0.05 : Math.random();
    if (skillEffects.charge) {
        const charge = Math.min(startCharge, data.charge);
        if (charge > 0) {
            rnd = (charge / 2) + (rnd * (1 - (charge / 2)));
        }
        if (reverse) {
            if (rnd < 0.5) {
                data.charge -= (0.5 - rnd) * 2;
            }
            if (rnd > 0.5) {
                data.charge += (rnd - 0.5) * 2;
            }
        } else {
            if (rnd < 0.5) {
                data.charge += (0.5 - rnd) * 2;
            }
            if (rnd > 0.5) {
                data.charge -= (rnd - 0.5) * 2;
            }
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
export function getVal<T>(val: T | ((...args: any[]) => T), props?: any[]): T {
    if (typeof val === "function") {
        return (val as (...args: any[]) => T)(...(props ?? []));
    }
    return val;
}

/**
 * オブジェクトを深いコピーする
 *
 * Date / RegExp / Map / Set / 配列 / 通常オブジェクトに対応する。
 *
 * @param obj コピーするオブジェクト
 * @returns コピーされた新しいオブジェクト
 * @internal
 */
export function deepClone<T>(obj: T): T {
  // 基本型、null、関数の場合はそのまま返す
  if (obj === null || typeof obj !== 'object' || typeof obj === 'function') {
    return obj;
  }

  // Dateオブジェクトの場合のコピー
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  // RegExpオブジェクトの場合のコピー
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T;
  }

  // Mapオブジェクトの場合のコピー
  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([key, value]) => [deepClone(key), deepClone(value)])) as unknown as T;
  }

  // Setオブジェクトの場合のコピー
  if (obj instanceof Set) {
    return new Set(Array.from(obj.values()).map(value => deepClone(value))) as unknown as T;
  }

  // 配列の場合のコピー
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  // 通常のオブジェクトの場合のコピー
  const copy = {} as T;

  // オブジェクトのプロパティを再帰的にコピー
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor.value !== undefined) {
      (copy as any)[key] = deepClone(descriptor.value);
    } else {
      Object.defineProperty(copy, key, descriptor);
    }
  }

  // Symbolプロパティもコピー
  const symbols = Object.getOwnPropertySymbols(obj);
  for (const sym of symbols) {
    (copy as any)[sym] = deepClone((obj as any)[sym]);
  }

  // オブジェクトのプロトタイプを設定する
  const proto = Object.getPrototypeOf(obj);
  if (proto && proto !== Object.prototype) {
    Object.setPrototypeOf(copy, proto);
  }

  return copy;
}

/**
 * 数値を文字に変換する
 *
 * 0〜9 はそのまま、10〜35 は a〜z に変換する。
 *
 * @param input 入力数値
 * @returns 変換後の文字列、範囲外なら null
 * @internal
 */
export function numberCharConvert(input: number): string | null {
    if (typeof input !== "number") {
        return null; // 無効な入力の場合
    }

    if (input >= 0 && input <= 9) {
        return input.toString(); // 0~9の数値を文字列として返す
    } else if (input >= 10 && input <= 35) {
        // 10以上35以下の数値をアルファベットに変換 (10 => 'a', 11 => 'b', ..., 35 => 'z')
        const char = String.fromCharCode('a'.charCodeAt(0) + input - 10);
        return char;
    } else {
        return null; // 無効な入力の場合（負の数や36以上の数値など）
    }
}

/**
 * レベルアップ時の追加処理（情報表示・スキル習得・moveTo 移行等）を行う
 *
 * ステータス配分前に呼ばれ、追加表示メッセージを返す。
 *
 * @param data RPGモジュールのデータ（破壊的に更新される）
 * @returns 追加表示するメッセージ
 * @internal
 */
export function preLevelUpProcess(data): string {
    /** 追加表示メッセージ */
    let addMessage = "";

    if ((data.info ?? 0) < 1 && ((100 + data.lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
        data.info = 1;
        addMessage += `\n` + serifs.rpg.info;
    }

    let oldSkillName = "";

    if (data.skills?.length) {
        const uniques = new Set();
        for (const _skill of data.skills as Skill[]) {
            const skill = skills.find((x) => x.name === _skill.name) ?? _skill;

            if (!data.checkFreeDistributed && data.skills?.length === 5 && (data.totalRerollOrb ?? 0) === (data.rerollOrb ?? 0) && !data.freeDistributed && countDuplicateSkillNames(data.skills) === 0 && data.skills.every((x) => x.name !== "分散型")) {
                const moveToSkill = skills.find((x) => x.name === "分散型");
                if (moveToSkill) {
                    oldSkillName = data.skills[4].name;
                    data.skills[4] = moveToSkill;
                    data.freeDistributed = true;
                    addMessage += `\n` + serifs.rpg.moveToSkill(oldSkillName, moveToSkill.name);
                }
            } else {
                if (!data.checkFreeDistributed) data.checkFreeDistributed = true;
            }

            if ((skill.unique && uniques.has(skill.unique)) || skill.notLearn) {
                oldSkillName = skill.name;
                data.skills = data.skills.filter((x: Skill) => x.name !== oldSkillName);
            } else {
                if (skill.unique) uniques.add(skill.unique);
            }
            if (skill.moveTo) {
                let moveToSkill = skills.find((x) => x.name === skill.moveTo);
                if (moveToSkill) {
                    if (skill.effect?.statusBonus) {
                        data.atk = Math.round(data.atk * (7.2 / 8));
                        data.def = Math.round(data.def * (7.2 / 8));
                        if (countDuplicateSkillNames(data.skills) === 0 && data.skills.every((x) => x.name !== "分散型")) {
                            const dSkill = skills.find((x) => x.name === "分散型")
                            if (dSkill) moveToSkill = dSkill;
                        }
                    }
                    oldSkillName = skill.name;
                    data.skills = data.skills.filter((x: Skill) => x.name !== oldSkillName);
                    data.skills.push(moveToSkill);
                    addMessage += `\n` + serifs.rpg.moveToSkill(oldSkillName, moveToSkill.name);
                }
            }
        }
    }

    const skillCounts = skillBorders.filter((x) => data.lv >= x).length;

    if ((data.skills ?? []).length < skillCounts) {
        if (!data.skills) data.skills = [];
        let skill;
        if ((data.skills ?? []).length === 4 && skillCounts === 5 && countDuplicateSkillNames(data.skills) === 0 && data.skills.every((x) => x.name !== "分散型")) {
            skill = skills.find((x) => x.name === "分散型");
            data.freeDistributed = true;
            data.checkFreeDistributed = true;
        } else {
            skill = getSkill(data)
        }
        data.skills.push(skill);
        if (oldSkillName) {
            addMessage += `\n` + serifs.rpg.moveToSkill(oldSkillName, skill.name);
        } else {
            addMessage += `\n` + serifs.rpg.newSkill(skill.name);
        }
    }
    return addMessage;
}

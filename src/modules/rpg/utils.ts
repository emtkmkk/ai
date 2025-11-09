
import 藍 from '@/ai';
import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import rpg from './index';
import { colorReply, colors } from './colors';
import { aggregateTokensEffects, shopItems } from './shop';
import { countDuplicateSkillNames, getSkill, Skill, skillBorders, skills, ultimateAmulet } from './skills';
import config from '@/config';

export type PostCountUsageContext = {
    type: 'normal' | 'raid';
    key: string;
};

export function initializeData(module: rpg, msg) {
    const data = msg.friend.getPerModulesData(module);
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
    data.items?.filter((x) => x.type = ([...shopItems, ultimateAmulet].find((y) => x.name === y.name)?.type ?? (x.skillName ? "amulet" : "token")));
    if (data.items.filter((x) => x.type === "amulet").length > 1) {
        data.items.filter((x) => x.type === "amulet").forEach((x) => {
            data.coin += x.price;
            data.shopItems.push(x.name);
        });
        data.items = data.items.filter((x) => x.type !== "amulet");

    }
    return data;
}

export function getColor(data) {
    let _color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
	let color = deepClone(_color);
    if (!color.unlock(data)) {
        data.color === (colors.find((x) => x.default) ?? colors[0]).id;
        color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
    }
	if (colors.find((x) => x.alwaysSuper)?.unlock(data) && !color.alwaysSuper && color.enhance && color.enhance(data)) {
		color.alwaysSuper = true;
		color.name = `$[sparkle ${color.name}]`
	}
    return color;
}


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
export function showStatusDmg(data, playerHp: number, totalDmg: number, playerMaxHp: number, me = colors.find((x) => x.default)?.name ?? colors[0].name): string {

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

    const debuff = [data.enemy?.fire ? serifs.rpg.fire + data.count : ""].filter(Boolean).join(" ");

    return `\n${"与えたダメージ"} : ${totalDmg}\n${me} : ${data.info >= 3 ? playerHpStr : data.info ? PlayerHpInfoStr : playerHpMarkStr}${debuff ? `\n${debuff}` : ""}`;
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
        dmg += Math.round(((data.count ?? count) - 1) * Math.min(100 + data.lv * 3, 865) * data.enemy.fire);
    }
    if (Number.isNaN(dmg)) {
        throw new Error();
    }
    return Math.max(dmg, 1);
}

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

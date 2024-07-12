import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import { colors } from './colors';
import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';
import { skillNameCountMap, totalSkillCount, skills, SkillEffect, skillCalculate } from './skills';
import { getVal } from './utils'

export type ItemType = "token" | "item" | "amulet";

export type BaseItem = {
    name: string;
    limit?: (data: any, rnd: () => number) => boolean;
    desc: string;
    price: number | ((data: any, rnd: () => number) => number);
    type: ItemType;
    effect: (data: any) => void;
    always?: boolean;
}

export type TokenItem = Omit<BaseItem, 'type' | 'effect'> & {
    type: "token";
    effect: { [key: string]: boolean };
}

export type Item = Omit<BaseItem, 'type'> & {
    type: "item";
    effect: (data: any) => void;
}

export type AmuletItem = Omit<BaseItem, 'type' | 'effect'> & {
    type: "amulet";
    effect: SkillEffect;
    durability: number;
    skillName?: string;
    isUsed: (data: any) => boolean;
    isMinusDurability?: (data: any) => boolean;
}

export type ShopItem = TokenItem | Item | AmuletItem;

export const shopItems: ShopItem[] = [
    { name: "おかわり2RPG自動支払いの札", limit: (data) => !data.items.filter((x) => x.name === "おかわり2RPG自動支払いの札").length, desc: "所持している間、おかわりおかわりRPGをプレイする際に確認をスキップして自動でコインを消費します", price: 5, type: "token", effect: { autoReplayOkawari: true }, always: true },
    { name: "自動旅モードの札", limit: (data) => !data.items.filter((x) => x.name === "自動旅モードの札").length, desc: "所持している間、旅モードに自動で突入します", price: 5, type: "token", effect: { autoJournal: true }, always: true },
    { name: "おかわり2RPG自動支払いの札を捨てる", limit: (data) => data.items.filter((x) => x.name === "おかわり2RPG自動支払いの札").length, desc: "おかわりおかわりRPGをプレイする際に毎回確認を表示します", price: 0, type: "item", effect: (data) => data.items = data.items.fliter((x) => x.name !== "おかわり2RPG自動支払いの札"), always: true },
    { name: "自動旅モードの札を捨てる", limit: (data) => data.items.filter((x) => x.name === "自動旅モードの札").length, desc: "旅モードに自動で突入しなくなります", price: 0, type: "item", effect: (data) => data.items = data.items.fliter((x) => x.name !== "自動旅モードの札"), always: true },
    { name: "乱数透視の札", limit: (data) => !data.items.filter((x) => x.name === "乱数透視の札").length, desc: "所持している間、ダメージの乱数が表示されるようになります", price: 50, type: "token", effect: { showRandom: true } },
    { name: "投稿数ボーナス表示の札", limit: (data) => !data.items.filter((x) => x.name === "投稿数ボーナス表示の札").length, desc: "所持している間、投稿数ボーナスの詳細情報が表示されるようになります", price: 50, type: "token", effect: { showPostBonus: true } },
    { name: "スキル詳細表示の札", limit: (data) => !data.items.filter((x) => x.name === "スキル詳細表示の札").length, desc: "所持している間、スキルの詳細情報が表示されるようになります", price: 50, type: "token", effect: { showSkillBonus: true } },
    { name: "スキル変更珠", desc: "スキルを変更するのに必要なアイテムです", limit: (data) => data.lv > 60, price: (data) => data.lv > 255 ? 7 : data.lv > 170 ? 25 : data.lv > 100 ? 35 : 50, type: "item", effect: (data) => data.rerollOrb = (data.rerollOrb ?? 0) + 1 },
    { name: "スキル複製珠", desc: "スキルを変更し、既に覚えているスキルのどれかを1つ覚えます", limit: (data, rnd) => data.lv > 100 && rnd() < 0.2, price: (data) => data.lv > 255 ? 30 : data.lv > 170 ? 100 : 140, type: "item", effect: (data) => data.duplicationOrb = (data.duplicationOrb ?? 0) + 1 },
    { name: "力の種", desc: "購入時、パワー+1 防御-1", price: (data) => data.lv > 60 ? 1 : data.lv > 30 ? 2 : 3, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1; data.def = (data.def ?? 0) - 1 } },
    { name: "高級力の種", desc: "購入時、防御2%をパワーに移動", limit: (data) => data.lv > 30, price: 5, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + (data.def ?? 0) / 50; data.def = (data.def ?? 0) - (data.def ?? 0) / 50 } },
    { name: "きらめく力の種", desc: "購入時、パワー+1", limit: (data, rnd) => rnd() < 0.5, price: (data, rnd) => rnd() < 0.5 ? 10 : rnd() < 0.5 ? 5 : 20, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1 } },
    { name: "守りの種", desc: "購入時、防御+1 パワー-1", price: (data) => data.lv > 60 ? 1 : data.lv > 30 ? 2 : 3, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1; data.def = (data.def ?? 0) - 1 } },
    { name: "高級守りの種", desc: "購入時、パワー2%を防御に移動", limit: (data) => data.lv > 30, price: 5, type: "item", effect: (data) => { data.def = (data.def ?? 0) + (data.atk ?? 0) / 50; data.atk = (data.atk ?? 0) - (data.atk ?? 0) / 50 } },
    { name: "きらめく守りの種", desc: "購入時、防御+1", limit: (data, rnd) => rnd() < 0.5, price: (data, rnd) => rnd() < 0.5 ? 10 : rnd() < 0.5 ? 5 : 20, type: "item", effect: (data) => { data.def = (data.def ?? 0) + 1 } },
    { name: "タクシーチケット", desc: "購入時、旅モードのステージがベスト-1になる", limit: (data, rnd) => (data.maxEndress ?? 0) - (data.endress ?? 0) > 2, price: (data, rnd) => ((data.maxEndress ?? 0) - (data.endress ?? 0) - 1) * 8, type: "item", effect: (data) => { data.endress = (data.maxEndress ?? 0) - 1 } },
    { name: "不幸の種", limit: (data, rnd) => data.lv > 50 && rnd() < 0.35, desc: "Lv-1 パワー-4 防御-3", price: 30, type: "item", effect: (data) => { data.lv -= 1; data.atk -= 4; data.def -= 3 } },
    { name: `呪いの人形`, limit: (data) => data.revenge, price: 44, desc: `持っていると前回負けた敵に戦う際に20%ステータスアップ 耐久1 リベンジ成功時耐久減少`, type: "amulet", effect: { atkUp: 0.2, defUp: 0.2 }, durability: 1, isUsed: (data) => data.enemy?.name === data.revenge, isMinusDurability: (data) => !data.revenge },
    { name: `交通安全のお守り`, price: 30, desc: `持っているとターン1で30%ダメージカット 耐久6 使用時耐久減少`, type: "amulet", effect: { firstTurnResist: 0.3 }, durability: 6, isUsed: (data) => data.count === 1 },
    { name: `高級交通安全のお守り`, price: 70, desc: `持っているとターン1で60%ダメージカット 耐久6 使用時耐久減少`, type: "amulet", effect: { firstTurnResist: 0.6 }, durability: 6, isUsed: (data) => data.count === 1 },
    { name: `気合のハチマキ`, price: 55, desc: `購入時、気合アップ`, type: "item", effect: (data) => data.endure = (data.endure ?? 0) + 2 },
    { name: `壺`, price: 200, desc: `なんかいい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `きれいな壺`, limit: (data) => (data.jar ?? 0) === 1, price: 400, desc: `なんかきれいな感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `すごい壺`, limit: (data) => (data.jar ?? 0) === 2, price: 800, desc: `なんかすごい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `巨大な壺`, limit: (data) => (data.jar ?? 0) === 3, price: 1200, desc: `なんかめっちゃでかい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `うねうねした壺`, limit: (data) => (data.jar ?? 0) === 4, price: 1600, desc: `なんかうねうねした感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `ナノサイズ壺`, limit: (data) => (data.jar ?? 0) === 5, price: 2000, desc: `小さくて見えない感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `謎の壺`, limit: (data) => (data.jar ?? 0) >= 6, price: (data) => (data.jar ?? 0) * 400, desc: `なんか謎な感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    ...skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.effect.firstTurnResist).map((x): AmuletItem => ({ name: `${x.name}のお守り`, price: Math.floor(20), desc: `持っているとスキル「${x.name}」を使用できる 耐久6 使用時耐久減少`, type: "amulet", effect: x.effect, durability: 6, skillName: x.name, isUsed: (data) => true }))
]

export const shopReply = async (module: Module, msg: Message) => {

    // データを読み込み
    const data = msg.friend.getPerModulesData(module);
    if (!data) return false;
    if (!data.lv) return false;
    if (!data.items) data.items = [];

    let rnd = seedrandom(getDate() + msg.user)

    const filteredShopItems = shopItems.filter((x) => (!x.limit || x.limit(data, rnd)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet")) && !x.always)

    if (data.lastShopVisited !== getDate() || !data.shopItems?.length) {
        data.shopItems = [
            filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name,
            filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name,
            filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name,
            filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name,
            filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name
        ]
        data.lastShopVisited = getDate()
    }

    const _shopItems = (data.shopItems as string[]).map((x) => shopItems.find((y) => x === y.name) ?? undefined).filter((x) => x != null) as ShopItem[];

    const showShopItems = _shopItems.filter((x) => (!x.limit || x.limit(data, rnd)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet"))).concat(shopItems.filter((x) => (!x.limit || x.limit(data, rnd)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet")) && x.always)).slice(0, 9);

    const reply = await msg.reply([
        "",
        serifs.rpg.shop.welcome(data.coin),
        ...showShopItems.map((x, index) => `[${index + 1}] ${x.name} ${getVal(x.price, [data, rnd])}枚\n${x.desc}`)
    ].join("\n"), { visibility: "specified" });
    
    msg.friend.setPerModulesData(module, data);

    module.subscribeReply("shopBuy:" + msg.userId, reply.id, { showShopItems: showShopItems.map((x) => ({ name: x.name, type: x.type, price: getVal(x.price, [data, rnd]), ...(x.type === "amulet" ? { durability: x.durability ?? undefined, skillName: x.skillName ?? undefined } : {}) })) });

    return {
        reaction: 'love'
    };

}

export function shopContextHook(module: Module, key: any, msg: Message, data: any) {
    if (key.replace("shopBuy:", "") !== msg.userId) {
        return {
            reaction: 'hmm'
        };
    }
    
    // データを読み込み
    const rpgData = msg.friend.getPerModulesData(module);
    if (!rpgData) return {
        reaction: 'hmm'
    };

    if (data.lastShopVisited !== getDate()) {
        return {
            reaction: 'hmm'
        };
    }

    for (let i = 0; i < data.showShopItems.length; i++) {
        if (msg.includes([String(i + 1)])) {
            if (data.showShopItems[i].price <= rpgData.coin) {
                rpgData.coin -= data.showShopItems[i].price

                let message = "";

                if (data.showShopItems[i].type === "item") {
                    const item = shopItems.find((x) => x.name === data.showShopItems[i].name) as Item
                    if (!item) return { reaction: 'hmm' };
                    const [_lv, _atk, _def] = [rpgData.lv, rpgData.atk, rpgData.def];
                    item.effect(rpgData);
                    const [lvDiff, atkDiff, defDiff] = [rpgData.lv-_lv, rpgData.atk-_atk, rpgData.def-_def]
                    if (data.showShopItems[i].price === 0) {
                        message += data.showShopItems[i].name.replace("捨てる","捨てました！");
                    }
                    if (lvDiff || atkDiff || defDiff) {
                        message += [
                            `\n${serifs.rpg.shop.useItem(item.name)}`,
                            `${serifs.rpg.status.lv} : ${rpgData.lv ?? 1}${lvDiff !== 0 ? ` (${lvDiff > 0 ? "+" + lvDiff : lvDiff})` : ""}`,
                            `${serifs.rpg.status.atk} : ${rpgData.atk ?? 0}${atkDiff !== 0 ? ` (${atkDiff > 0 ? "+" + atkDiff : atkDiff})` : ""}`,
                            `${serifs.rpg.status.def} : ${rpgData.def ?? 0}${defDiff !== 0 ? ` (${defDiff > 0 ? "+" + defDiff : defDiff})` : ""}`,
                        ].filter(Boolean).join("\n")
                    }
                } else {
                    rpgData.items.push(data.showShopItems[i])
                }
                
                msg.reply((data.showShopItems[i].price ? serifs.rpg.shop.buyItem(data.showShopItems[i].name, rpgData.coin) : "") + message).then(reply => {
                    if (data.showShopItems[i].type != "amulet") module.subscribeReply("shopBuy:" + msg.userId, reply.id);
                });
                msg.friend.setPerModulesData(module, rpgData);

                return {
                    reaction: 'love'
                };
            
            } else {
                msg.reply(serifs.rpg.shop.notEnoughCoin).then(reply => {
                    module.subscribeReply("shopBuy:" + msg.userId, reply.id);
                });
            }
        }
    }

    return { reaction: 'hmm' }
}

/**
 * data.itemsに格納されている全スキルのeffectを集計する関数。
 * 重複している効果はその値を足す。
 *
 * @param data - items配列を含むデータオブジェクト。
 * @returns 集計されたItemsEffect。
 */
export function aggregateTokensEffects(data: { items: ShopItem[] }): any {
    const aggregatedEffect = {};

    if (!data.items) return aggregatedEffect;
    data.items.forEach(_items => {
        if (_items.type !== "token") return
        const item = shopItems.find((x) => x.name === _items.name && x.type === "token");
        if (!item) return;
        Object.entries(item.effect).forEach(([key, value]) => {
            if (typeof aggregatedEffect[key] === "number" && typeof value === "number" && aggregatedEffect[key] !== undefined) {
                aggregatedEffect[key] += value;
            } else {
                aggregatedEffect[key] = value;
            }
        });
    });

    return aggregatedEffect;
}
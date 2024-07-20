import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import { colors } from './colors';
import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';
import { skillNameCountMap, totalSkillCount, skills, SkillEffect, skillCalculate, Skill, skillPower, aggregateSkillsEffects } from './skills';
import { getVal, initializeData } from './utils'
import 藍 from '@/ai';
import rpg from './index';

export type ItemType = "token" | "item" | "amulet";

export type BaseItem = {
    name: string;
    limit?: (data: any, rnd: () => number) => boolean;
    desc: string;
    price: number | ((data: any, rnd: () => number, ai: 藍) => number);
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
    infinite?: boolean;
}

export type AmuletItem = Omit<BaseItem, 'type' | 'effect'> & {
    type: "amulet";
    effect: SkillEffect;
    durability: number;
    skillName?: string | string[];
    short: string;
    isUsed: (data: any) => boolean;
    isMinusDurability?: (data: any) => boolean;
}

export type ShopItem = TokenItem | Item | AmuletItem;

export const fortuneEffect = (data: any) => {
    const rnd = Math.random;
    if (rnd() < 0.5) {
        if (rnd() < 0.5) {
            data.atk += 1
            data.def += 1
        } else {
            const a = Math.floor(data.atk * 0.3)
            const d = Math.floor(data.def * 0.3)
            data.atk = data.atk - a + Math.floor((a + d) / 2)
            data.def = data.def - d + Math.floor((a + d) / 2)
        }
    } else {
        if (rnd() < 0.5) {
            const a = Math.floor(data.atk * 0.3)
            const d = Math.floor(data.def * 0.3)
            if (rnd() < 0.5) {
                data.atk = data.atk - a
                data.def = data.def + a
            } else {
                data.atk = data.atk + d
                data.def = data.def - d
            }
        } else {
            const a = data.atk;
            data.atk = data.def;
            data.def = a;
        }
    }
}

export const skillPrice = (_ai: 藍, skillName: Skill["name"], rnd: () => number) => {
    const skillP = skillPower(_ai, skillName);
    const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly);

    // totalSkillCountにfilteredSkillsのnameに含まれるskillP.skillNameCountMapに含まれる値の合計を代入
    const totalSkillCount = filteredSkills.reduce((acc, skill) => acc + (skillP.skillNameCountMap.get(skill.name) || 0), 0);

    const price = Math.max(
        Math.floor(
            12 * (Math.max(isNaN(skillP.skillNameCount) ? 0 : skillP.skillNameCount, 0.5) / (totalSkillCount / filteredSkills.length))
        ), 6
    );

    const rand = rnd();
    return rand < 0.1 ? Math.floor(price * 0.5)
        : rand < 0.2 ? Math.floor(price * 0.75)
        : rand < 0.7 ? Math.floor(price * 1)
        : rand < 0.8 ? Math.floor(price * 1.25)
        : rand < 0.9 ? Math.floor(price * 1.5)
        : 12;
}

export const shopItems: ShopItem[] = [
    { name: "おかわり2RPG自動支払いの札", limit: (data) => !data.items.filter((x) => x.name === "おかわり2RPG自動支払いの札").length && data.replayOkawari != null, desc: "所持している間、おかわりおかわりRPGをプレイする際に確認をスキップして自動でコインを消費します", price: 1, type: "token", effect: { autoReplayOkawari: true }, always: true },
    { name: "自動旅モードの札", limit: (data) => (data.maxEndress ?? 0) > 0 && !data.items.filter((x) => x.name === "自動旅モードの札").length, desc: "所持している間、旅モードに自動で突入します", price: (data) => data.allClear ? 1 : Math.max(8 - (data.maxEndress ?? 0), 1), type: "token", effect: { autoJournal: true }, always: true },
    { name: "†の札", limit: (data) => !data.items.filter((x) => x.name === "†の札").length && data.lv >= 99 && !data.clearHistory.includes(":mk_chickenda_gtgt:"), desc: "所持している間、本気の†を味わう事が出来ます", price: 5, type: "token", effect: { appearStrongBoss: true }, always: true },
    { name: "おかわり2RPG自動支払いの札を捨てる", limit: (data) => data.items.filter((x) => x.name === "おかわり2RPG自動支払いの札").length, desc: "おかわりおかわりRPGをプレイする際に毎回確認を表示します", price: 0, type: "item", effect: (data) => data.items = data.items.filter((x) => x.name !== "おかわり2RPG自動支払いの札"), always: true },
    { name: "自動旅モードの札を捨てる", limit: (data) => data.items.filter((x) => x.name === "自動旅モードの札").length, desc: "旅モードに自動で突入しなくなります", price: 0, type: "item", effect: (data) => data.items = data.items.filter((x) => x.name !== "自動旅モードの札"), always: true },
    { name: "†の札を捨てる", limit: (data) => data.items.filter((x) => x.name === "†の札").length && !data.clearHistory.includes(":mk_chickenda_gtgt:"), desc: "本気の†が出現しなくなります", price: 0, type: "item", effect: (data) => data.items = data.items.filter((x) => x.name !== "†の札"), always: true },
    { name: "乱数透視の札", limit: (data) => data.lv >= 7 && !data.items.filter((x) => x.name === "乱数透視の札").length, desc: "所持している間、ダメージの乱数が表示されるようになります", price: 50, type: "token", effect: { showRandom: true } },
    { name: "投稿数ボーナス表示の札", limit: (data) => data.lv >= 20 && !data.items.filter((x) => x.name === "投稿数ボーナス表示の札").length, desc: "所持している間、投稿数ボーナスの詳細情報が表示されるようになります", price: 50, type: "token", effect: { showPostBonus: true } },
    { name: "スキル詳細表示の札", limit: (data) => data.lv >= 20 && !data.items.filter((x) => x.name === "スキル詳細表示の札").length, desc: "所持している間、スキルの詳細情報が表示されるようになります", price: 50, type: "token", effect: { showSkillBonus: true } },
    { name: "装備詳細表示の札", limit: (data) => data.lv >= 7 && !data.items.filter((x) => x.name === "装備詳細表示の札").length, desc: "所持している間、武器・防具の詳細な効果が表示されます", price: 50, type: "token", effect: { showItemBonus: true } },
    { name: "スキル変更珠", desc: "スキルを変更するのに必要なアイテムです", limit: (data) => data.lv > 60, price: (data) => data.lv > 255 ? 7 : data.lv > 170 ? 25 : data.lv > 100 ? 35 : 50, type: "item", effect: (data) => data.rerollOrb = (data.rerollOrb ?? 0) + 1, infinite: true },
    { name: "スキル複製珠", desc: "スキルを変更し、既に覚えているスキルのどれかを1つ覚えます", limit: (data, rnd) => data.lv > 100 && rnd() < 0.2, price: (data) => data.lv > 255 ? 30 : data.lv > 170 ? 100 : 140, type: "item", effect: (data) => data.duplicationOrb = (data.duplicationOrb ?? 0) + 1, infinite: true },
    { name: "力の種", desc: "購入時、パワー+1 防御-1", price: (data) => data.lv > 60 ? 1 : data.lv > 30 ? 2 : 3, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1; data.def = (data.def ?? 0) - 1 }, infinite: true },
    { name: "高級力の種", desc: "購入時、防御2%をパワーに移動", limit: (data) => data.lv > 30, price: 5, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) / 50)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) / 50)) }, infinite: true },
    { name: "きらめく力の種", desc: "購入時、パワー+1", limit: (data, rnd) => rnd() < 0.5, price: (data, rnd) => rnd() < 0.5 ? 10 : rnd() < 0.5 ? 5 : 20, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1 } },
    { name: "守りの種", desc: "購入時、防御+1 パワー-1", price: (data) => data.lv > 60 ? 1 : data.lv > 30 ? 2 : 3, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) - 1; data.def = (data.def ?? 0) + 1 }, infinite: true },
    { name: "高級守りの種", desc: "購入時、パワー2%を防御に移動", limit: (data) => data.lv > 30, price: 5, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) / 50)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) / 50)) }, infinite: true },
	{ name: "きらめく守りの種", desc: "購入時、防御+1", limit: (data, rnd) => rnd() < 0.5, price: (data, rnd) => rnd() < 0.5 ? 10 : rnd() < 0.5 ? 5 : 20, type: "item", effect: (data) => { data.def = (data.def ?? 0) + 1 } },
    { name: "仕切り直しの札", desc: "全ての敵が再出現するようになります", limit: (data, rnd) => data.allClear && data.clearEnemy?.length && (data.maxEndress ?? 0) >= 6, price: 1, type: "item", effect: (data) => data.clearEnemy = [], always: true},
    { name: "しあわせ草", desc: "購入時、？？？", limit: (data, rnd) => rnd() < 0.2, price: (data, rnd) => rnd() < 0.5 ? 20 : rnd() < 0.5 ? 10 : 30, type: "item", effect: fortuneEffect },
    { name: "タクシーチケット", desc: "購入時、旅モードのステージがベスト-1になる", limit: (data, rnd) => (data.maxEndress ?? 0) - (data.endress ?? 0) > 2, price: (data, rnd) => ((data.maxEndress ?? 0) - (data.endress ?? 0) - 1) * 8, type: "item", effect: (data) => { data.endress = (data.maxEndress ?? 0) - 1 }, infinite: true },
    { name: "不幸の種", limit: (data, rnd) => data.lv > 50 && rnd() < 0.35, desc: "Lv-1 パワー-4 防御-3", price: 30, type: "item", effect: (data) => { data.lv -= 1; data.atk -= 4; data.def -= 3 } },
    { name: `呪いの人形`, limit: (data) => data.revenge, price: 44, desc: `持っていると前回負けた敵に戦う際に20%ステータスアップ 耐久1 リベンジ成功時耐久減少`, type: "amulet", effect: { atkUp: 0.2, defUp: 0.2 }, durability: 1, short: "呪", isUsed: (data) => data.enemy?.name === data.revenge, isMinusDurability: (data) => !data.revenge } as AmuletItem,
    { name: `交通安全のお守り`, price: 30, desc: `持っているとターン1で30%ダメージカット 耐久10 使用時耐久減少`, type: "amulet", effect: { firstTurnResist: 0.3 }, durability: 10, short: "安", isUsed: (data) => data.raid || data.count === 1 } as AmuletItem,
    { name: `高級交通安全のお守り`, price: 99, desc: `持っているとターン1で70%ダメージカット 耐久10 使用時耐久減少`, type: "amulet", effect: { firstTurnResist: 0.7 }, durability: 10, short: "S安", isUsed: (data) => data.raid || data.count === 1 } as AmuletItem,
    { name: `気合のハチマキ`, price: 55, desc: `購入時、気合アップ`, type: "item", effect: (data) => data.endure = (data.endure ?? 0) + 4 },
    { name: `壺`, limit: (data) => data.lv >= 20, price: 200, desc: `なんかいい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `きれいな壺`, limit: (data) => (data.jar ?? 0) === 1, price: 400, desc: `なんかきれいな感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `すごい壺`, limit: (data) => (data.jar ?? 0) === 2, price: 800, desc: `なんかすごい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `巨大な壺`, limit: (data) => (data.jar ?? 0) === 3, price: 1200, desc: `なんかめっちゃでかい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `うねうねした壺`, limit: (data) => (data.jar ?? 0) === 4, price: 1600, desc: `なんかうねうねした感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `ナノサイズ壺`, limit: (data) => (data.jar ?? 0) === 5, price: 2000, desc: `小さくて見えない感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `謎の壺`, limit: (data) => (data.jar ?? 0) >= 6, price: (data) => (data.jar ?? 0) * 400, desc: `なんか謎な感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1 },
    { name: `苦労のお守り`, limit: (data) => data.lv >= 90 && data.allClear && data.streak > 0, price: (data) => Math.max(50 - data.winCount, 1), desc: `持っていると通常モードの敵が強くなります 耐久1 敗北時耐久減少`, type: "amulet", effect: { enemyBuff: 1 }, durability: 1, short: "苦", isUsed: (data) => data.enemy && data.clearHistory.includes(data.enemy), isMinusDurability: (data) => data.streak < 1 } as AmuletItem,
    { name: `全身全霊のお守り`, price: 20, desc: `持っていると行動回数が1回になるが、すごく重い一撃を放てる 耐久10 使用時耐久減少`, type: "amulet", effect: { allForOne: 1 }, durability: 10, short: "全", isUsed: (data) => true } as AmuletItem,
    { name: `運命不変のお守り`, price: 40, desc: `持っていると与ダメージがランダム変化しなくなる 耐久20 使用時耐久減少`, type: "amulet", effect: { notRandom: 1 }, durability: 20, short: "不変", isUsed: (data) => true } as AmuletItem,
    { name: `しあわせのお守り`, price: 20, desc: `レイド時、ステータスの割合がランダムに一時的に変化する 耐久10 レイドでの使用時耐久減少`, type: "amulet", effect: { fortuneEffect: 1 }, durability: 10, short: "し", isUsed: (data) => data.raid } as AmuletItem,
    { name: `全力の一撃のお守り`, price: 20, desc: `レイド時、ターン7で発生する全力の一撃を強化します 耐久10 レイドでの使用時耐久減少`, type: "amulet", effect: { finalAttackUp: 0.3 }, durability: 10, short: "撃", isUsed: (data) => data.raid } as AmuletItem,
    ...skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly).map((x): AmuletItem => ({ name: `${x.name}のお守り`, price: (data, rnd, ai) => skillPrice(ai, x.name, rnd), desc: `持っているとスキル「${x.name}」を使用できる 耐久6 使用時耐久減少`, type: "amulet", effect: x.effect, durability: 6, skillName: x.name, short: x.short, isUsed: (data) => true })),
    { name: `お守りを捨てる`, limit: (data) => data.items.filter((x) => x.type === "amulet").length, price: 0, desc: `今所持しているお守りを捨てます`, type:"item", effect: (data) => data.items = data.items?.filter((x) => x.type !== "amulet"), always: true },
]

function getRandomSkills(ai, num) {
    let filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly);
    const { skillNameCountMap, totalSkillCount } = skillCalculate(ai);

    let selectedSkills: Skill[] = [];
    
    // スキルの合計重みを計算
    let totalWeight = filteredSkills.reduce((total, skill) => {
        const skillCount = !skill.cantReroll ? (skillNameCountMap.get(skill.name) || 0) : (totalSkillCount / (skills.filter((x) => !x.moveTo).length));
        return total + 1 / (1 + skillCount); // 出現回数に応じて重みを計算
    }, 0);

    for (let i = 0; i < num; i++) {
        // 0からtotalWeightまでのランダム値を生成
        let randomValue = Math.random() * totalWeight;

        // ランダム値に基づいてスキルを選択
        for (let skill of filteredSkills) {
            const skillCount = !skill.cantReroll ? (skillNameCountMap.get(skill.name) || 0) : (totalSkillCount / (skills.filter((x) => !x.moveTo).length));
            const weight = 1 / (1 + skillCount); // 出現回数に応じて重みを計算

            if (randomValue < weight) {
                selectedSkills.push(skill); // ランダム値が現在のスキルの重み未満であればそのスキルを選択
                totalWeight -= weight
                filteredSkills = filteredSkills.filter((x) => x.name !== skill.name);
                break;
            }

            randomValue -= weight; // ランダム値を減少させる
        }
    }

    return selectedSkills;
}
export function mergeSkillAmulet(ai, rnd = Math.random, skills: Skill[]) {
    // スキル名のセットを作成し、同じ名前のスキルを弾く
    const uniqueSkillsMap = new Map<string, Skill>();
    skills.forEach(skill => {
        if (!uniqueSkillsMap.has(skill.name)) {
            uniqueSkillsMap.set(skill.name, skill);
        }
    });
    const uniqueSkills = Array.from(uniqueSkillsMap.values());

    const name = uniqueSkills.map((x) => x.name).join("&");

    const durability = uniqueSkills.length * 6;

    const prices = uniqueSkills.map((x) => skillPrice(ai, x.name, rnd));

    const priceSum = prices.reduce((pre, cur) => pre + cur, 0);

    const price = Math.floor(priceSum * (Math.pow(1.5, uniqueSkills.length-1) * Math.max(prices.reduce((pre, cur) => pre * (0.5 + cur / 24), 1), 1)));

    // スキルの効果をマージ
    const effect = uniqueSkills.reduce((acc, skill) => {
        return { ...acc, ...skill.effect };
    }, {} as SkillEffect);

    return ({
        name: `${name}のお守り`,
        price,
        desc: `持っているとスキル${uniqueSkills.map((x) => `「${x.name}」`).join("と")}を使用できる 耐久${durability} 使用時耐久減少`,
        type: "amulet",
        effect,
        durability,
        short: uniqueSkills.map((x) => x.short).join(""),
        skillName: uniqueSkills.map((x) => x.name),
        isUsed: (data) => true
    });
}
const determineOutcome = (ai, data, getShopItems) => {
  // コインの必要数を計算する関数
  const calculateRequiredCoins = (skillCount) => {
    return Math.floor((12 * skillCount) * (Math.pow(1.5, skillCount - 1)));
  };

  // 確率を計算する関数
  const calculateProbability = (baseProbability, skillCount, data) => {
    const levelThresholds = [50, 100, 170, 255]; // 定数配列
    const levelCount = levelThresholds.filter(threshold => data.lv >= threshold).length + Math.max(Math.floor(data.lv / 256)-1,0); // 満たしているレベル条件の数
    const delta = levelCount - skillCount;

    let probability = baseProbability;
    if (delta < 0) {
      probability *= Math.pow(0.5, Math.abs(delta)); // 半減処理
    } else if (delta > 0) {
      probability *= Math.pow(1.5, delta); // 1.5倍処理
    }

    return probability;
  };

  // ベース確率
  const baseProbability = 0.2;

  // チェック: 'amulet'タイプのアイテムが無く、レベルが50以上、コインが36以上の場合
  if (!data.items.some((y) => y.type === "amulet")) {
    let skillCount = 1; // 初期スキルカウント

    while (skillCount <= 10) {
      const requiredCoins = calculateRequiredCoins(skillCount + 1);
      const probability = calculateProbability(baseProbability, skillCount, data);

      // コインの条件と確率を満たす場合、スキルカウントを増やす
      if (data.coin >= requiredCoins && Math.random() < probability) {
        skillCount++;
      } else {
        skillCount--; // スキルカウントを一つ戻す
        break;
      }
    }

    // スキルカウントが2以上の場合、スキルを取得
    if (skillCount > 1) {
      return getRandomSkills(ai, skillCount).map((x) => x.name);
    }
  }

  // 条件を満たさない場合は、ショップのアイテムリストを返す
  return getShopItems(filteredShopItems, rnd);
};

export const shopReply = async (module: rpg, ai: 藍, msg: Message) => {

    // データを読み込み
    const data = initializeData(module, msg);
    if (!data) return false;
    if (!data.lv) return false;

    // 所持しているスキル効果を読み込み
    const skillEffects = aggregateSkillsEffects(data);

    let rnd = seedrandom(getDate() + ai.account.id + msg.userId)

    let filteredShopItems = shopItems.filter((x) => (!x.limit || x.limit(data, rnd)) && !(x.type === "amulet" && (data.lv < 20 || data.items?.some((y) => y.type === "amulet"))) && !x.always)

    if (data.lastShopVisited !== getDate() || !data.shopItems?.length) {

        const getShopItems = () => {
            const itemName = filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name;
            filteredShopItems = filteredShopItems.filter((x) => x.name !== itemName);
            return itemName;
        }
        
        data.shopItems = [
            getShopItems(),
            getShopItems(),
            getShopItems(),
            getShopItems(),
            determineOutcome(ai, data, getShopItems),
        ]
        data.lastShopVisited = getDate()
        module.unsubscribeReply("shopBuy:" + msg.userId)
    }

    const _shopItems = (data.shopItems as (string | string[])[]).map((x) => Array.isArray(x) ? mergeSkillAmulet(ai, rnd, x.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) : shopItems.find((y) => x === y.name) ?? undefined).filter((x) => x != null) as ShopItem[];

    const showShopItems = _shopItems.filter((x) => (!x.limit || x.limit(data, () => 0)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet"))).concat(shopItems.filter((x) => (!x.limit || x.limit(data, () => 0)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet")) && x.always)).slice(0, 9)
        .map((x) => {
            let _x = x;
            const price = Math.ceil(getVal(x.price, [data, rnd, ai]) * (1 - (skillEffects.priceOff ?? 0)));
            return {..._x, price};
        });

    const reply = await msg.reply([
        "",
        serifs.rpg.shop.welcome(data.coin),
        ...showShopItems.map((x, index) => `[${index + 1}] ${x.name} ${x.price}枚\n${x.desc}\n`)
    ].join("\n"), { visibility: "specified" });

    msg.friend.setPerModulesData(module, data);

    module.subscribeReply("shopBuy:" + msg.userId, reply.id, { showShopItems: showShopItems.map((x) => ({ name: x.name, type: x.type, price: x.price, ...(x.type === "amulet" ? { durability: x.durability ?? undefined, skillName: x.skillName ?? undefined } : {}) })) });

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

    if (rpgData.lastShopVisited !== getDate()) {
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
                    const [lvDiff, atkDiff, defDiff] = [rpgData.lv - _lv, rpgData.atk - _atk, rpgData.def - _def]
                    if (data.showShopItems[i].price === 0) {
                        message += data.showShopItems[i].name.replace("捨てる", "捨てました！");
                    }
                    if (lvDiff || atkDiff || defDiff) {
                        message += [
                            `\n\n${serifs.rpg.shop.useItem(item.name)}`,
                            `${serifs.rpg.status.lv} : ${rpgData.lv ?? 1}${lvDiff !== 0 ? ` (${lvDiff > 0 ? "+" + lvDiff : lvDiff})` : ""}`,
                            `${serifs.rpg.status.atk} : ${rpgData.atk ?? 0}${atkDiff !== 0 ? ` (${atkDiff > 0 ? "+" + atkDiff : atkDiff})` : ""}`,
                            `${serifs.rpg.status.def} : ${rpgData.def ?? 0}${defDiff !== 0 ? ` (${defDiff > 0 ? "+" + defDiff : defDiff})` : ""}`,
                        ].filter(Boolean).join("\n")
                    }
                    if (!item.infinite) {
                        rpgData.shopItems = rpgData.shopItems?.filter((x) => data.showShopItems[i].name !== x);
                        module.unsubscribeReply(key)
                    }
                } else {
                    rpgData.items.push(data.showShopItems[i])
                    rpgData.shopItems = rpgData.shopItems?.filter((x) => data.showShopItems[i].name !== x);
                    module.unsubscribeReply(key)
                }

                msg.reply((data.showShopItems[i].price ? serifs.rpg.shop.buyItem(data.showShopItems[i].name, rpgData.coin) : "") + message)
                msg.friend.setPerModulesData(module, rpgData);

                return {
                    reaction: 'love'
                };

            } else {
                msg.reply(serifs.rpg.shop.notEnoughCoin);
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

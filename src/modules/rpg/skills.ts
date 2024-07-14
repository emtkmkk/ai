import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import 藍 from '@/ai';
import { aggregateTokensEffects, AmuletItem, ShopItem, shopItems } from './shop'

export let skillNameCountMap = new Map();
export let totalSkillCount = 0;
let ai: 藍;

export function skillCalculate(_ai: 藍 = ai) {
    skillNameCountMap = new Map();
    totalSkillCount = 0;
    if (_ai) ai = _ai
    const friends = ai.friends.find().filter((x) => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1 && x.perModulesData.rpg.skills?.length)
    friends.forEach(friend => {
        const skills = friend.perModulesData.rpg.skills;
        if (skills && Array.isArray(skills)) {
            skills.forEach(skill => {
                const skillName = skill.name;
                if (skillName) {
                    totalSkillCount += 1
                    if (skillNameCountMap.has(skillName)) {
                        skillNameCountMap.set(skillName, skillNameCountMap.get(skillName) + 1);
                    } else {
                        skillNameCountMap.set(skillName, 1);
                    }
                }
            });
        }
    });
    return { skillNameCountMap, totalSkillCount }
}

export type SkillEffect = {
    /** パワーがn%上昇 */
    atkUp?: number;
    /** 防御がn%上昇 */
    defUp?: number;
    /** 炎：戦闘時、Lvのn%をダメージに加算 */
    fire?: number;
    /** 氷：戦闘時、n%で敵のターンをスキップ */
    ice?: number;
    /** 雷：行動回数が増加するほどパワーアップ 最高n% */
    thunder?: number;
    /** 風：行動回数がn%増加 */
    spdUp?: number;
    /** 土：1ターン最大ダメージの上限がn%増加 */
    dart?: number;
    /** 光：n%で敵の攻撃力を半減 */
    light?: number;
    /** 闇：n*2%で敵の速度を1に n%で敵の現在HPを半減 */
    dark?: number;
    /** 毒：1ターンごとに敵のステータスn%低下 */
    weak?: number;
    /** 非戦闘時にパワーn%上昇 */
    notBattleBonusAtk?: number;
    /** 非戦闘時に防御n%上昇 */
    notBattleBonusDef?: number;
    /** 最初のターンの被ダメージをn%軽減 */
    firstTurnResist?: number;
    /** 体力が減るほど被ダメージ軽減 最大n% */
    tenacious?: number;
    /** 1回のRPGコマンドにて動けるターン数 */
    plusActionX?: number;
    /** -n時間分RPGを先取り */
    rpgTime?: number;
    /** 与ダメージをn%上昇 */
    atkDmgUp?: number;
    /** 被ダメージをn%上昇 */
    defDmgUp?: number;
    /** 連続ボーナスの効果をn%上昇 */
    continuousBonusUp?: number;
    /** 敗北時に逃走を行う */
    escape?: number;
    /** 気合耐えの確率n%上昇 */
    endureUp?: number;
    /** 決死の覚悟の条件をn%緩和 効果をn%上昇 */
    haisuiUp?: number;
    /** 投稿数ボーナス量をn%上昇 */
    postXUp?: number;
    /** 敵のステータスに応じてステータス上昇 */
    enemyStatusBonus?: number;
    /** 敵の防御をn%減少 */
    arpen?: number;
    /** 攻撃時最低乱数補正 */
    atkRndMin?: number;
    /** 攻撃時最大乱数補正 */
    atkRndMax?: number;
    /** 防御時最低乱数補正 */
    defRndMin?: number;
    /** 防御時最低乱数補正 */
    defRndMax?: number;
    /** 最初のターンに必ずアイテムを使用する */
    firstTurnItem?: number;
    /** 最初のターンに気合が下がるアイテムをn%で回避 */
    firstTurnMindMinusAvoid?: number;
    /** アイテム使用率がn%上昇 */
    itemEquip?: number;
    /** アイテム効果がn%上昇 デメリットがn%減少 */
    itemBoost?: number;
    /** 武器が選択される確率がn%上昇 */
    weaponSelect?: number;
    /** 武器のアイテム効果がn%上昇 */
    weaponBoost?: number;
    /** 防具が選択される確率がn%上昇 */
    armorSelect?: number;
    /** 防具のアイテム効果がn%上昇 */
    armorBoost?: number;
    /** 食べ物が選択される確率がn%上昇 */
    foodSelect?: number;
    /** 食べ物のアイテム効果がn%上昇 */
    foodBoost?: number;
    /** 毒のデメリットがn%減少 */
    poisonResist?: number;
    /** 毒をn%で回避 */
    poisonAvoid?: number;
    /** 気合が下がるアイテムをn%で回避 */
    mindMinusAvoid?: number;
    /** 効果が高い場面で食べ物を食べる */
    lowHpFood?: number;
    /** ステータスボーナスが増加 */
    statusBonus?: number;
    /** 敵の連続攻撃中断率がn%減少 */
    abortDown?: number;
    /** クリティカル率がn%上昇 */
    critUp?: number;
    /** クリティカル率がn%上昇(固定値) */
    critUpFixed?: number;
    /** クリティカルダメージがn%上昇 */
    critDmgUp?: number;
    /** 被クリティカル率がn%減少 */
    enemyCritDown?: number;
    /** 被クリティカルダメージがn%減少 */
    enemyCritDmgDown?: number;
    /** 敗北ボーナスが増加 */
    loseBonus?: number;
    /** ７フィーバー */
    sevenFever?: number;
    /** チャージ */
    charge?: number;
    /** 敵を全体的に強化（通常モードのみ） */
    enemyBuff?: number;
    /** 攻撃回数を攻撃に変換 */
    allForOne?: number;
    /** お守りの効果・耐久n%上昇 */
    amuletBoost?: number;
    /** ショップの商品、全品n%オフ */
    priceOff?: number;
};

export type Skill = {
    /** スキル名 */
    name: string;
    /** 説明 */
    desc?: string;
    /** 詳細説明 */
    info?: string;
    /** 効果 */
    effect: SkillEffect;
    /** ユニークキー 同じキーを持っているスキルは入手不可 */
    unique?: string;
    /** 移動先 スキル名を変更した際に */
    moveTo?: string;
    /** スキル変更が出来ない場合 */
    cantReroll?: boolean;
    /** お守りとして出ない場合 */
    skillOnly?: boolean;
};

export const skills: Skill[] = [
    { name: `${serifs.rpg.status.atk}+10%`, desc: `常に${serifs.rpg.status.atk}が10%上がります`, info: `条件無しで${serifs.rpg.status.atk}+10%`, effect: { atkUp: 0.1 } },
    { name: `${serifs.rpg.status.def}+10%`, desc: `常に${serifs.rpg.status.def}が10%上がります`, info: `条件無しで${serifs.rpg.status.def}+10%`, effect: { defUp: 0.1 } },
    { name: `炎属性剣攻撃`, desc: `戦闘時、最低ダメージが上昇します`, info: `戦闘時、Lvの10%がダメージに固定加算 非戦闘時、${serifs.rpg.status.atk}+Lvの35%`, effect: { fire: 0.1 } },
    { name: `氷属性剣攻撃`, desc: `戦闘時、たまに敵を凍らせます`, info: `戦闘時、10%で相手のターンをスキップ 非戦闘時、${serifs.rpg.status.def}+10%`, effect: { ice: 0.1 } },
    { name: `雷属性剣攻撃`, desc: `戦闘時、連続攻撃をすればダメージが上がります`, info: `ダメージ+(現在攻撃数/最大攻撃数)×20%`, effect: { thunder: 0.2 } },
    { name: `風属性剣攻撃`, desc: `戦闘時、たまに行動回数が上がります`, info: `戦闘時、10%で行動回数が2倍 非戦闘時、${serifs.rpg.status.atk}+10%`, effect: { spdUp: 0.1 } },
    { name: `土属性剣攻撃`, desc: `戦闘時、最大ダメージが上昇します`, info: `戦闘時かつ最大ダメージ制限がある場合、その制限を20%増加 非戦闘時、${serifs.rpg.status.atk}+10%`, effect: { dart: 0.2 } },
    { name: `光属性剣攻撃`, desc: `戦闘時、たまに敵の攻撃力を下げます`, info: `戦闘時、10%で敵の現在HPの半分のダメージを与える 行動回数が2回以上の敵に20%で行動回数を1にする それ以外の場合、${serifs.rpg.status.def}+7%`, effect: { light: 0.2 } },
    { name: `闇属性剣攻撃`, desc: `戦闘時、たまに敵の周辺に高重力領域が発生させます`, info: `戦闘時、20%でダメージカット50% それ以外の場合、${serifs.rpg.status.def}+10%`, effect: { dark: 0.1 } },
    { name: `毒属性剣攻撃`, desc: `戦闘時、ターン経過ごとに相手が弱体化します`, info: `ターン経過ごとに敵のステータス-5%`, effect: { weak: 0.05 } },
    { name: `テキパキこなす`, desc: `戦闘以外の事の効率が上がります`, info: `非戦闘時、${serifs.rpg.status.atk}+20%`, effect: { notBattleBonusAtk: 0.2 } },
    { name: `疲れにくい`, desc: `疲れでダメージを受ける際にそのダメージを軽減します`, info: `ダメージメッセージに疲が入っている場合、${serifs.rpg.status.def}+18%`, effect: { notBattleBonusDef: 0.18 } },
    { name: `油断しない`, desc: `ターン1に受けるダメージを大きく軽減します`, info: `ターン1にてダメージカット30%を得る 100%以上になる場合、残りはターン2に持ち越す`, effect: { firstTurnResist: 0.3 }, skillOnly: true},
    { name: `粘り強い`, desc: `体力が減るほど受けるダメージを軽減します`, info: `ダメージカット20%×(減少HP割合)を得る 最大90%`, effect: { tenacious: 0.2 } },
    { name: `高速RPG`, desc: `1回のRPGでお互いに2回行動します`, info: `1回のコマンドで2ターン進行する レイド時は、${serifs.rpg.status.atk}+10%`, effect: { plusActionX: 1 } },
    { name: `1時間先取りRPG`, desc: `1時間早くRPGをプレイする事が出来ます`, info: `1時間早くRPGプレイ可能 ステータス+5%`, effect: { atkUp: 0.05, defUp: 0.05, rpgTime: -1 } },
    { name: `伝説`, desc: `パワー・防御が7%上がります`, info: `ステータス+7% 重複しない`, effect: { atkUp: 0.07, defUp: 0.07 }, unique: "legend" },
    { name: `脳筋`, desc: `与えるダメージが上がりますが、受けるダメージも上がります`, info: `${serifs.rpg.dmg.give}+18% ${serifs.rpg.dmg.take}+8%`, effect: { atkDmgUp: 0.18, defDmgUp: 0.08 } },
    { name: `慎重`, desc: `与えるダメージが下がりますが、受けるダメージも下がります`, info: `${serifs.rpg.dmg.give}-8% ${serifs.rpg.dmg.take}-18%`, effect: { atkDmgUp: -0.08, defDmgUp: -0.18 } },
    { name: `連続・毎日ボーナス強化`, desc: `連続・毎日ボーナスの上昇量が上がります`, info: `毎日ボーナスの増加量+50% (5 ~ 12.5投稿↑)`, effect: { continuousBonusUp: 0.5 } },
    { name: `負けそうなら逃げる`, desc: `逃げると負けた事になりません 連続で発動しにくい`, info: `スキルの数まで100%逃走 以降失敗まで発動度に確率半減し続ける レイド時は、${serifs.rpg.status.def}+10%`, effect: { escape: 1 } },
    { name: `気合で頑張る`, desc: `パワー・防御が少し上がり、気合耐えの確率が上がります`, info: `ステータス+3% 気合耐え確率+50%`, effect: { atkUp: 0.03, defUp: 0.03, endureUp: 0.5 } },
    { name: `すぐ決死の覚悟をする`, desc: `決死の覚悟の発動条件が緩くなり、効果量が上がります`, info: `${serifs.rpg.status.atk}+8% 覚悟発動条件効果量+50%`, effect: { atkUp: 0.08, haisuiUp: 0.5 } },
    { name: `投稿数ボーナス量アップ`, desc: `投稿数によるステータスボーナスが上昇します`, info: `投稿数ボーナス+5%`, effect: { postXUp: 0.05 } },
    { name: `強敵と戦うのが好き`, desc: `敵が強ければステータスが上昇します`, info: `ステータス+(敵の攻撃 × 敵の防御 / 4)%`, effect: { enemyStatusBonus: 1 } },
    { name: `${serifs.rpg.status.pen}+10%`, desc: `敵の防御の影響を減少させます`, info: `敵の防御-10%`, effect: { arpen: 0.1 } },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}4`, desc: `乱数幅が20~180 -> 60~160になります`, info: `乱数幅 20~180 -> 60~160 (%) 期待値 110% 乱数系と重複しない`, effect: { atkRndMin: 0.4, atkRndMax: -0.2 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5`, desc: `乱数幅が20~180 -> 90~130になります`, info: `乱数幅 20~180 -> 90~130 (%) 期待値 110% 乱数系と重複しない`, effect: { atkRndMin: 0.7, atkRndMax: -0.5 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndP}`, desc: `乱数幅が20~180 -> 5~230になります クリティカル率も上がります`, info: `乱数幅 20~180 -> 5~230 (%) 期待値 115% クリティカル率+2% 乱数系と重複しない`, effect: { atkRndMin: -0.15, atkRndMax: 0.5, critUpFixed: 0.02 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndM}`, desc: `敵から受ける最大ダメージを減少させます`, info: `敵の乱数幅 20~180 -> 20~160 (%) 乱数系と重複しない`, effect: { defRndMin: 0, defRndMax: -0.2 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndP}`, desc: `敵から受ける最小ダメージを減少させます`, info: `敵の乱数幅 20~180 -> 0~180 (%) 乱数系と重複しない`, effect: { defRndMin: -0.2, defRndMax: 0 }, unique: "rnd" },
    { name: `準備を怠らない`, desc: `ターン1にて、必ず良い効果がある武器か防具を装備します。`, info: `ターン1装備率+100% ターン1悪アイテム率-100% アイテム装備率-15% 重複しない`, effect: { firstTurnItem: 1, firstTurnMindMinusAvoid: 1, itemEquip: -0.15 }, unique: "firstTurnItem" },
    { name: `道具大好き`, desc: `道具の使用率が上がります`, info: `アイテム装備率+40%`, effect: { itemEquip: 0.4 } },
    { name: `道具の扱いが上手い`, desc: `道具の効果量が上がります`, info: `アイテム効果量+40% アイテム悪効果軽減+40%`, effect: { itemBoost: 0.4 } },
    { name: `武器が大好き`, desc: `武器を装備しやすくなり、武器の効果量が上がります`, info: `武器装備率2倍 武器効果量+60% 種類大好き系と重複しない`, effect: { weaponSelect: 1, weaponBoost: 0.6 }, unique: "itemSelect" },
    { name: `防具が大好き`, desc: `防具を装備しやすくなり、防具の効果量が上がります`, info: `防具装備率2倍 防具効果量+60% 種類大好き系と重複しない`, effect: { armorSelect: 1, armorBoost: 0.6 }, unique: "itemSelect" },
    { name: `食いしんぼう`, desc: `食べ物を食べやすくなり、食べ物の効果量が上がります`, info: `食べ物使用率2倍 食べ物効果量+60% 毒食べ物ダメージ-60% 種類大好き系と重複しない`, effect: { foodSelect: 1, foodBoost: 0.6, poisonResist: 0.6 }, unique: "itemSelect" },
    { name: `なんでも口に入れない`, desc: `良くないものを食べなくなることがあります`, info: `毒食べ物を50%で捨てる 100%以上になると悪アイテム率減少に変換`, effect: { poisonAvoid: 0.5 } },
    { name: `道具の選択が上手い`, desc: `道具の効果量がすこし上がり、悪いアイテムを選びにくくなります`, info: `道具効果量+15% 悪アイテム率-15%`, effect: { itemBoost: 0.15, mindMinusAvoid: 0.15 } },
    { name: `お腹が空いてから食べる`, desc: `体力が減ったら食べ物を食べやすくなり、食べ物の効果量が少し上がります`, info: `残HP%で食べ物を食べるようになる 食べ物効果量+20% 毒食べ物ダメージ-20%`, effect: { lowHpFood: 1, foodBoost: 0.2, poisonResist: 0.2 }, unique: "lowHpFood" },
    { name: `たまにたくさん成長`, desc: `たまにステータスが多く増加します ★変更不可`, info: `2Lv毎になにかのステータス+1 ★変更不可（変更してもステータスは残るため）`, effect: { statusBonus: 1 }, unique: "status", cantReroll: true },
    { name: `連続攻撃完遂率上昇`, desc: `連続攻撃を相手に止められにくくなります`, info: `連続攻撃中断率-30% 効果がない場合、${serifs.rpg.status.atk}+10%`, effect: { abortDown: 0.3 } },
    { name: `クリティカル性能上昇`, desc: `クリティカル率とクリティカルダメージが上昇します`, info: `クリティカル率1.2倍&+3% クリティカルダメージ+20%`, effect: { critUp: 0.2, critUpFixed: 0.03, critDmgUp: 0.2 } },
    { name: `敵のクリティカル性能減少`, desc: `相手のクリティカル率とクリティカルダメージが減少します`, info: `敵のクリティカル率-30% 敵のクリティカルダメージ-30% レイド時は、${serifs.rpg.status.def}+10%`, effect: { enemyCritDown: 0.3, enemyCritDmgDown: 0.3 } },
    { name: `クリティカル上昇`, effect: { critUp: 0.3 }, moveTo: "クリティカル性能上昇" },
    { name: `クリティカルダメージ上昇`, effect: { critDmgUp: 0.3 }, moveTo: "クリティカル性能上昇" },
    { name: `敵のクリティカル率減少`, effect: { enemyCritDown: 0.3 }, moveTo: "敵のクリティカル性能減少" },
    { name: `敵のクリティカルダメージ減少`, effect: { enemyCritDmgDown: 0.3 }, moveTo: "敵のクリティカル性能減少" },
    { name: `負けた時、しっかり反省`, desc: `敗北時のボーナスが上昇します ★変更不可`, info: `敗北毎にステータス+2 ★変更不可（変更してもステータスは残るため）`, effect: { loseBonus: 1 }, unique: "loseBonus", cantReroll: true },
    { name: `７フィーバー！`, desc: `Lv・パワー・防御の値に「7」が含まれている程ステータスアップ`, info: `Lv・パワー・防御の値に「7」が含まれている場合ステータス+7% 「77」が含まれている場合ステータス+77% ...`, effect: { sevenFever: 1 } },
    { name: `不運チャージ`, desc: `不運だった場合、次回幸運になりやすくなります`, info: `ステータス+5% 低乱数を引いた時、次回以降に高乱数を引きやすくなる`, effect: { atkUp: 0.05, defUp: 0.05, charge: 1 } },
    { name: `お守り整備`, desc: `お守りの効果が上がり、お守りが壊れにくくなります`, info: `お守り効果+50% お守り耐久+50%`, effect: { amuletBoost: 0.5 }, skillOnly: true},
    { name: `値切り術`, desc: `ショップのアイテムが少し安くなります`, info: `ショップアイテム全品10%OFF`, effect: { priceOff: 0.1 }, skillOnly: true},
]

export const getSkill = (data) => {
    const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x)
    // フィルタリングされたスキルの配列を作成
    const filteredSkills = skills.filter((x) => !x.moveTo && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));

    // スキルの合計重みを計算
    const totalWeight = filteredSkills.reduce((total, skill) => {
        const skillCount = skillNameCountMap.get(skill.name) || 0; // デフォルトを0に設定
        return total + 1 / (1 + skillCount); // 出現回数に応じて重みを計算
    }, 0);

    // 0からtotalWeightまでのランダム値を生成
    let randomValue = Math.random() * totalWeight;

    // ランダム値に基づいてスキルを選択
    for (let skill of filteredSkills) {
        const skillCount = skillNameCountMap.get(skill.name) || 0; // デフォルトを0に設定
        const weight = 1 / (1 + skillCount); // 出現回数に応じて重みを計算

        if (randomValue < weight) {
            return skill; // ランダム値が現在のスキルの重み未満であればそのスキルを選択
        }

        randomValue -= weight; // ランダム値を減少させる
    }

    return filteredSkills[0]; // ここに来るのはおかしいよ
}

export const getRerollSkill = (data, oldSkillName = "") => {
    const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x)
    // フィルタリングされたスキルの配列を作成
    const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && x.name != oldSkillName && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));
    
    // スキルの合計重みを計算
    const totalWeight = filteredSkills.reduce((total, skill) => {
        const skillCount = skillNameCountMap.get(skill.name) || 0; // デフォルトを0に設定
        return total + (1 / (1 + (skillCount / 2))); // 出現回数に応じて重みを計算
    }, 0);

    // 0からtotalWeightまでのランダム値を生成
    let randomValue = Math.random() * totalWeight;

    // ランダム値に基づいてスキルを選択
    for (let skill of filteredSkills) {
        const skillCount = skillNameCountMap.get(skill.name) || 0; // デフォルトを0に設定
        const weight = 1 / (1 + (skillCount / 2)); // 出現回数に応じて重みを計算

        if (randomValue < weight) {
            return skill; // ランダム値が現在のスキルの重み未満であればそのスキルを選択
        }

        randomValue -= weight; // ランダム値を減少させる
    }

    return filteredSkills[0]; // ここに来るのはおかしいよ
}

/** スキルに関しての情報を返す */
export const skillReply = (module: Module, ai: 藍, msg: Message) => {

    // データを読み込み
    const data = msg.friend.getPerModulesData(module);
    if (!data) return false;

    skillCalculate(ai);

    if (!data.skills?.length) return { reaction: 'confused' };

    let playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x)

    if (msg.includes([serifs.rpg.command.change]) && msg.includes([serifs.rpg.command.duplication])) {
        if (!data.duplicationOrb || data.duplicationOrb <= 0) return { reaction: 'confused' };
        for (let i = 0; i < data.skills.length; i++) {
            if (msg.includes([String(i + 1)])) {
                if (!playerSkills[i].cantReroll) {
                    const oldSkillName = playerSkills[i].name
                    const list = data.skills.filter((x) => x.name !== oldSkillName && !x.unique && !x.cantReroll)
                    if (!list.length) {
                        msg.reply(`\n複製可能なスキルがありません！`);
                        return { reaction: 'confused' };
                    }
                    data.skills[i] = list[Math.random() * list.length];
                    msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name) + `\n効果: ${data.skills[i].desc}` + (aggregateTokensEffects(data).showSkillBonus && data.skills[i].info ? `\n詳細効果: ${data.skills[i].info}` : ""))
                    data.duplicationOrb -= 1
                    msg.friend.setPerModulesData(module, data);
                    skillCalculate(ai);
                    return {
                        reaction: 'love'
                    };
                } else {
                    return {
                        reaction: 'confused'
                    };
                }
            }
        }
        return {
            reaction: 'confused'
        };
    }

    if (msg.includes([serifs.rpg.command.change])) {
        if (!data.rerollOrb || data.rerollOrb <= 0) return { reaction: 'confused' };
        for (let i = 0; i < data.skills.length; i++) {
            if (msg.includes([String(i + 1)])) {
                if (!playerSkills[i].cantReroll) {
                    const oldSkillName = playerSkills[i].name
                    data.skills[i] = getRerollSkill(data, oldSkillName)
                    msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name) + `\n効果: ${data.skills[i].desc}` + (aggregateTokensEffects(data).showSkillBonus && data.skills[i].info ? `\n詳細効果: ${data.skills[i].info}` : ""))
                    data.rerollOrb -= 1
                    msg.friend.setPerModulesData(module, data);
                    skillCalculate(ai);
                    return {
                        reaction: 'love'
                    };
                } else {
                    return {
                        reaction: 'confused'
                    };
                }
            }
        }
        return {
            reaction: 'confused'
        };
    }

    let amuletSkill: string[] = []
    if (data.items?.filter((x) => x.type = "amulet").length) {
        const amulet = data.items?.filter((x) => x.type = "amulet")[0]
        const item = shopItems.find((x) => x.name === amulet.name) as AmuletItem
        const skill = amulet.skillName ? skills.find((x) => amulet.skillName === x.name) : undefined;
        if (amulet.durability) amuletSkill.push(`[お守り] ${amulet.skillName ?? amulet.name} 残耐久${amulet.durability}${skill ? aggregateTokensEffects(data).showSkillBonus && skill.info ? `\n${skill.info}` : skill.desc ? `\n${skill.desc}` : "" : `\n${item.desc}`}`)
    }

    msg.reply([
        data.rerollOrb && data.rerollOrb > 0 ? serifs.rpg.skills.info(data.rerollOrb) + "\n" : "",
        data.duplicationOrb && data.duplicationOrb > 0 ? serifs.rpg.skills.duplicationInfo(data.duplicationOrb) + "\n" : "",
        serifs.rpg.skills.list,
        ...playerSkills.map((x, index) => `[${index + 1}] ${x.name}${aggregateTokensEffects(data).showSkillBonus && x.info ? `\n${x.info}` : x.desc ? `\n${x.desc}` : ""}`),
        ...amuletSkill
    ].filter(Boolean).join("\n"));

    return {
        reaction: 'love'
    };

}

export const skillPower = (ai: 藍, skillName: Skill["name"]) => {
    const { skillNameCountMap, totalSkillCount } = skillCalculate(ai);
    return { skillNameCountMap, skillNameCount: skillNameCountMap.get(skillName), totalSkillCount };
}

/**
 * data.skillsに格納されている全スキルのeffectを集計する関数。
 * 重複している効果はその値を足す。
 *
 * @param data - skills配列を含むデータオブジェクト。
 * @returns 集計されたSkillEffect。
 */
export function aggregateSkillsEffects(data: { items?: ShopItem[], skills: Skill[] }): SkillEffect {
    const aggregatedEffect: SkillEffect = {};

    if (!data.skills) return aggregatedEffect;
    let dataSkills = data.skills
	data.items?.filter((x) => x.type = (shopItems.find((y) => x.name === y.name)?.type ?? "token"))
    if (data.items?.filter((x) => x.type === "amulet").length) {
        const amulet = data.items?.filter((x) => x.type === "amulet")[0]
			console.log("amulet: " + amulet.name);
        const item = shopItems.find((x) => x.name === amulet.name) as AmuletItem
        if (item.isUsed(data)) {
            const boost = dataSkills.filter((x) => x.effect?.amuletBoost).reduce((acc, cur) => acc + (cur.effect?.amuletBoost ?? 0), 0) ?? 0;
            const adjustEffect = (effect: any, boost: number): any => {
                const multiplier = 1 + (boost ?? 0);
                const adjustedEffect: any = {};
            
                for (const key in effect) {
                    if (typeof effect[key] === 'number') {
											if (Number.isInteger(effect[key])) {
												adjustedEffect[key] = Math.floor(effect[key] * multiplier);
											} else {
												adjustedEffect[key] = effect[key] * multiplier;
											}
                    } else {
                        adjustedEffect[key] = effect[key];
                    }
                }
            
                return { effect: adjustedEffect };
            }
					console.log("effect: " + JSON.stringify(adjustEffect(item.effect, boost)));
            dataSkills = dataSkills.concat([adjustEffect(item.effect, boost)] as any)
        }
    }
    dataSkills.forEach(_skill => {
        const skill = _skill.name ? skills.find((x) => x.name === _skill.name) ?? _skill : _skill;
        if (skill.effect) {
			Object.entries(skill.effect).forEach(([key, value]) => {
            if (aggregatedEffect[key] !== undefined) {
                aggregatedEffect[key] += value;
            } else {
                aggregatedEffect[key] = value;
            }
        });
				} else {
					console.log(JSON.stringify(_skill));
				}
    });

    if (aggregatedEffect.itemEquip && aggregatedEffect.itemEquip > 1.5) {
        aggregatedEffect.itemBoost = (aggregatedEffect.itemBoost ?? 0) + (aggregatedEffect.itemEquip - 1.5)
        aggregatedEffect.itemEquip = 1.5;
    }

    if (aggregatedEffect.poisonAvoid && aggregatedEffect.poisonAvoid > 1) {
        aggregatedEffect.mindMinusAvoid = (aggregatedEffect.mindMinusAvoid ?? 0) + (aggregatedEffect.poisonAvoid - 1) * 0.6
        aggregatedEffect.poisonAvoid = 1;
    }

    if (aggregatedEffect.abortDown && aggregatedEffect.abortDown > 1) {
        aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) + (aggregatedEffect.abortDown - 1) * (1 / 3)
        aggregatedEffect.abortDown = 1;
    }

    if (aggregatedEffect.enemyCritDown && aggregatedEffect.enemyCritDown > 1) {
        aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) + (aggregatedEffect.enemyCritDown - 1) * (1 / 3)
        aggregatedEffect.enemyCritDown = 1;
    }

    return aggregatedEffect;
}

export function amuletMinusDurability(data: { items?: ShopItem[], skills: Skill[] }): string {
	let ret = "";
	if (data.items?.filter((x) => x.type === "amulet").length) {
        const amulet = data.items?.filter((x) => x.type === "amulet")[0]
        const item = shopItems.find((x) => x.name === amulet.name) as AmuletItem
        if ((item.isMinusDurability ?? item.isUsed)(data)) {
            const boost = data.skills ? data.skills?.filter((x) => x.effect?.amuletBoost).reduce((acc, cur) => acc + (cur.effect?.amuletBoost ?? 0), 0) ?? 0 : 0;
            data.items.forEach((x) => {
                if (x.type === "amulet") {
                    if (boost <= 0 || 1 / Math.random() < (1 / Math.pow(1.5, boost * 2))) {
                        x.durability -= 1;
                        if (x.durability <= 0) {
                            data.items = data.items?.filter((x) => x.type !== "amulet")
                            ret = `${x.name}が壊れました！`
                        } else {
                            ret = `${x.name} 残耐久${x.durability}`
                        }
                    } else {
                        ret = serifs.rpg.skill.amuletBoost;
                    }
                }
            });
        }
	}
	return ret;
}

export function calcSevenFever(arr: number[]) {
    let totalSevens = 0;

    arr.forEach(number => {
        // 数字を文字列に変換
        let str = number.toString();

        // 正規表現で「7」の連続を見つける
        let matches = str.match(/7+/g);
        if (matches) {
            matches.forEach(match => {
                let length = match.length;

                // 連続する「7」の数によって特別なカウント
                if (length >= 1) {
                    totalSevens += parseInt('7'.repeat(length));
                }
            });
        }
    });

    return totalSevens;
}

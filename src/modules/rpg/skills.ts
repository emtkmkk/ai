import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import 藍 from '@/ai';

export let skillNameCountMap = new Map();
let ai: 藍;

export function skillCalculate(_ai: 藍 = ai) {
    skillNameCountMap = new Map();
    if (_ai) ai = _ai
    const friends = ai.friends.find().filter((x) => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1 && x.perModulesData.rpg.skills?.length)
    friends.forEach(friend => {
        const skills = friend.perModulesData.rpg.skills;
        if (skills && Array.isArray(skills)) {
            skills.forEach(skill => {
                const skillName = skill.name;
                if (skillName) {
                    if (skillNameCountMap.has(skillName)) {
                        skillNameCountMap.set(skillName, skillNameCountMap.get(skillName) + 1);
                    } else {
                        skillNameCountMap.set(skillName, 1);
                    }
                }
            });
        }
    });
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
};

export type Skill = {
    /** スキル名 */
    name: string;
    /** 説明 */
    desc?: string;
    /** 効果 */
    effect: SkillEffect;
    /** ユニークキー 同じキーを持っているスキルは入手不可 */
    unique?: string;
    /** 移動先 スキル名を変更した際に */
    moveTo?: string;
    /** スキル変更が出来ない場合 */
    cantReroll?: boolean;
};

export const skills: Skill[] = [
    { name: `${serifs.rpg.status.atk}+10%`, desc: `常に${serifs.rpg.status.atk}が10%上がります` , effect: { atkUp: 0.1 } },
    { name: `${serifs.rpg.status.def}+10%`, desc: `常に${serifs.rpg.status.def}が10%上がります`, effect: { defUp: 0.1 } },
    { name: `炎属性剣攻撃`, desc: `戦闘時、最低ダメージが上昇します`, effect: { fire: 0.1 } },
    { name: `氷属性剣攻撃`, desc: `戦闘時、たまに敵を凍らせます`, effect: { ice: 0.1 } },
    { name: `雷属性剣攻撃`, desc: `戦闘時、連続攻撃をすればダメージが上がります`, effect: { thunder: 0.2 } },
    { name: `風属性剣攻撃`, desc: `戦闘時、たまに行動回数が上がります`, effect: { spdUp: 0.1 } },
    { name: `土属性剣攻撃`, desc: `戦闘時、最大ダメージが上昇します`, effect: { dart: 0.2 } },
    { name: `光属性剣攻撃`, desc: `戦闘時、たまに敵の攻撃力を下げます`, effect: { light: 0.2 } },
    { name: `闇属性剣攻撃`, desc: `戦闘時、たまに敵の周辺に高重力領域が発生させます`, effect: { dark: 0.1 } },
    { name: `毒属性剣攻撃`, desc: `戦闘時、ターン経過ごとに相手が弱体化します`, effect: { weak: 0.05 } },
    { name: `テキパキこなす`, desc: `戦闘以外の事の効率が上がります`, effect: { notBattleBonusAtk: 0.2 } },
    { name: `疲れにくい`, desc: `疲れでダメージを受ける際にそのダメージを軽減します`, effect: { notBattleBonusDef: 0.18 } },
    { name: `油断しない`, desc: `ターン1に受けるダメージを大きく軽減します`, effect: { firstTurnResist: 0.3 } },
    { name: `粘り強い`, desc: `体力が減るほど受けるダメージを軽減します`, effect: { tenacious: 0.2 } },
    { name: `高速RPG`, desc: `1回のRPGでお互いに2回行動します`, effect: { plusActionX: 1 } },
    { name: `1時間先取りRPG`, desc: `1時間早くRPGをプレイする事が出来ます`, effect: { atkUp: 0.05, defUp: 0.05, rpgTime: -1 } },
    { name: `伝説`, desc: `パワー・防御が7%上がります`, effect: { atkUp: 0.07, defUp: 0.07 }, unique: "legend" },
    { name: `脳筋`, desc: `与えるダメージが上がりますが、受けるダメージも上がります`, effect: { atkDmgUp: 0.18, defDmgUp: 0.08 } },
    { name: `慎重`, desc: `与えるダメージが下がりますが、受けるダメージも下がります`, effect: { atkDmgUp: -0.08, defDmgUp: -0.18 } },
    { name: `連続・毎日ボーナス強化`, desc: `連続・毎日ボーナスの上昇量が上がります`, effect: { continuousBonusUp: 0.5 } },
    { name: `負けそうなら逃げる`, desc: `逃げると負けた事になりません 連続で発動しにくい`, effect: { escape: 1 } },
    { name: `気合で頑張る`, desc: `パワー・防御が少し上がり、気合耐えの確率が上がります`, effect: { atkUp: 0.03, defUp: 0.03, endureUp: 0.5 } },
    { name: `すぐ決死の覚悟をする`, desc: `決死の覚悟の発動条件が緩くなり、効果量が上がります`, effect: { atkUp: 0.08, haisuiUp: 0.5 } },
    { name: `投稿数ボーナス量アップ`, desc: `投稿数によるステータスボーナスが上昇します`, effect: { postXUp: 0.05 } },
    { name: `強敵と戦うのが好き`, desc: `敵が強ければステータスが上昇します`, effect: { enemyStatusBonus: 1 } },
    { name: `${serifs.rpg.status.pen}+10%`, desc: `相手の防御の影響を減少させます`, effect: { arpen: 0.1 } },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}4`, desc: `乱数幅が20~180 -> 60~160になります`, effect: { atkRndMin: 0.4, atkRndMax: -0.2 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5`, desc: `乱数幅が20~180 -> 90~130になります`, effect: { atkRndMin: 0.7, atkRndMax: -0.5 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndP}`, desc: `乱数幅が20~180 -> 5~230になります クリティカル率も上がります`, effect: { atkRndMin: -0.15, atkRndMax: 0.5, critUpFixed: 0.02 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndM}`, desc: `敵から受ける最大ダメージを減少させます`, effect: { defRndMin: 0, defRndMax: -0.2 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndP}`, desc: `敵から受ける最小ダメージを減少させます`, effect: { defRndMin: -0.2, defRndMax: 0 }, unique: "rnd" },
    { name: `準備を怠らない`, desc: `ターン1にて、必ず良い効果がある武器か防具を装備し、受けるダメージもすこし軽減します。`, effect: { firstTurnResist: 0.1, firstTurnItem: 1, firstTurnMindMinusAvoid: 1, itemEquip: -0.2 }, unique: "firstTurnItem" },
    { name: `道具大好き`, desc: `道具の使用率が上がります`, effect: { itemEquip: 0.4 } },
    { name: `道具の扱いが上手い`, desc: `道具の効果量が上がります`, effect: { itemBoost: 0.4 } },
    { name: `武器が大好き`, desc: `武器を装備しやすくなり、武器の効果量が上がります`, effect: { weaponSelect: 1, weaponBoost: 0.6 }, unique: "itemSelect" },
    { name: `防具が大好き`, desc: `防具を装備しやすくなり、防具の効果量が上がります`, effect: { armorSelect: 1, armorBoost: 0.6 }, unique: "itemSelect" },
    { name: `食いしんぼう`, desc: `食べ物を食べやすくなり、食べ物の効果量が上がります`, effect: { foodSelect: 1, foodBoost: 0.6, poisonResist: 0.6 }, unique: "itemSelect" },
    { name: `なんでも口に入れない`, desc: `良くないものを食べなくなることがあります`, effect: { poisonAvoid: 0.5 } },
    { name: `道具の選択が上手い`, desc: `道具の効果量がすこし上がり、悪いアイテムを選びにくくなります`, effect: { itemBoost: 0.15, mindMinusAvoid: 0.15 } },
    { name: `お腹が空いてから食べる`, desc: `体力が減ったら食べ物を食べやすくなり、食べ物の効果量が少し上がります`, effect: { lowHpFood: 1, foodBoost: 0.2, poisonResist: 0.2 }, unique: "lowHpFood" },
    { name: `たまにたくさん成長`, desc: `たまにステータスが多く増加します ★変更不可`, effect: { statusBonus: 1 }, unique: "status", cantReroll: true},
    { name: `連続攻撃完遂率上昇`, desc: `連続攻撃を相手に止められにくくなります`, effect: { abortDown: 0.3 } },
    { name: `クリティカル性能上昇`, desc: `クリティカル率とクリティカルダメージが上昇します`, effect: { critUp: 0.2, critUpFixed: 0.03, critDmgUp: 0.2 }},
    { name: `敵のクリティカル性能減少`, desc: `相手のクリティカル率とクリティカルダメージが減少します`, effect: { enemyCritDown: 0.3, enemyCritDmgDown: 0.3 }},
    { name: `クリティカル上昇`, effect: { critUp: 0.3 }, moveTo: "クリティカル性能上昇"},
    { name: `クリティカルダメージ上昇`, effect: { critDmgUp: 0.3 }, moveTo: "クリティカル性能上昇" },
    { name: `敵のクリティカル率減少`, effect: { enemyCritDown: 0.3 }, moveTo: "敵のクリティカル性能減少" },
    { name: `敵のクリティカルダメージ減少`, effect: { enemyCritDmgDown: 0.3 }, moveTo: "敵のクリティカル性能減少" },
    { name: `負けた時、しっかり反省`, desc: `敗北時のボーナスが上昇します ★変更不可`, effect: { loseBonus: 1 }, unique: "loseBonus", cantReroll: true },
    { name: `７フィーバー！`, desc: `Lv・パワー・防御の値に「7」が含まれている程ステータスアップ`, effect: { sevenFever: 1 } },
    { name: `不運チャージ`, desc: `不運だった場合、次回幸運になりやすくなります`, effect: { atkUp: 0.05, defUp: 0.05, charge: 1 } },
]

export const getSkill = (data) => {
    // フィルタリングされたスキルの配列を作成
    const filteredSkills = skills.filter((x) => !x.moveTo && !data.skills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));
    
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
    // フィルタリングされたスキルの配列を作成
    const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && x.name != oldSkillName && !data.skills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));
    
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
	return filteredSkills[0];
}

/** スキルに関しての情報を返す */
export const skillReply = (module: Module, msg: Message) => {

    // データを読み込み
    const data = msg.friend.getPerModulesData(module);
    if (!data) return false;

    if (!data.skills?.length) return { reaction: 'confused' };
    
    const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x)

    if (msg.includes([serifs.rpg.command.change])) {
        if (!data.rerollOrb || data.rerollOrb <= 0) return { reaction: 'confused' };
        for (let i = 0; i < data.skills.length; i++) {
            if (msg.includes([String(i + 1)])) {
                if (!playerSkills[i].cantReroll) {
                    const oldSkillName = playerSkills[i].name
                    data.skills[i] = getRerollSkill(data, oldSkillName)
                    msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name))
                    data.rerollOrb -= 1
                    msg.friend.setPerModulesData(module, data);
                    skillCalculate();
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

    msg.reply([
        data.rerollOrb && data.rerollOrb > 0 ? serifs.rpg.skills.info(data.rerollOrb) + "\n" : "",
        serifs.rpg.skills.list,
        ...playerSkills.map((x, index) => `[${index + 1}] ${x.name}${x.desc ? `\n${x.desc}` : ""}`)
    ].filter(Boolean).join("\n"));

    return {
        reaction: 'love'
    };

}

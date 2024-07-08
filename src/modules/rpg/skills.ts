import serifs from "@/serifs";

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
};

export type Skill = {
    /** スキル名 */
    name: string;
    /** 効果 */
    effect: SkillEffect;
    /** ユニークキー 同じキーを持っているスキルは入手不可 */
    unique?: string;
};

export const skills: Skill[] = [
    { name: `${serifs.rpg.status.atk}+10%`, effect: { atkUp: 0.1 } },
    { name: `${serifs.rpg.status.def}+10%`, effect: { defUp: 0.1 } },
    { name: `炎属性剣攻撃`, effect: { fire: 0.1 } },
    { name: `氷属性剣攻撃`, effect: { ice: 0.1 } },
    { name: `雷属性剣攻撃`, effect: { thunder: 0.2 } },
    { name: `風属性剣攻撃`, effect: { spdUp: 0.1 } },
    { name: `土属性剣攻撃`, effect: { dart: 0.2 } },
    { name: `光属性剣攻撃`, effect: { light: 0.2 } },
    { name: `闇属性剣攻撃`, effect: { dark: 0.1 } },
    { name: `毒属性剣攻撃`, effect: { weak: 0.05 } },
    { name: `テキパキこなす`, effect: { notBattleBonusAtk: 0.2 } },
    { name: `疲れにくい`, effect: { notBattleBonusDef: 0.2 } },
    { name: `油断しない`, effect: { firstTurnResist: 0.3 } },
    { name: `粘り強い`, effect: { tenacious: 0.2 } },
    { name: `高速RPG`, effect: { plusActionX: 1 } },
    { name: `1時間先取りRPG`, effect: { atkUp: 0.05, defUp: 0.05, rpgTime: -1 } },
    { name: `伝説`, effect: { atkUp: 0.06, defUp: 0.06 } },
    { name: `脳筋`, effect: { atkDmgUp: 0.21, defDmgUp: 0.1 } },
    { name: `慎重`, effect: { atkDmgUp: -0.1, defDmgUp: -0.21 } },
    { name: `連続・毎日ボーナス強化`, effect: { continuousBonusUp: 0.5 } },
    { name: `負けそうなら逃げる`, effect: { escape: 1 } },
    { name: `気合で頑張る`, effect: { atkUp: 0.03, defUp: 0.03, endureUp: 0.5 } },
    { name: `すぐ決死の覚悟をする`, effect: { haisuiUp: 0.5 } },
    { name: `投稿数ボーナス量アップ`, effect: { postXUp: 0.075 } },
    { name: `強敵と戦うのが好き`, effect: { enemyStatusBonus: 1 } },
    { name: `${serifs.rpg.status.pen}+10%`, effect: { arpen: 0.1 } },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}4`, effect: { atkRndMin: 0.4, atkRndMax: -0.2 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5`, effect: { atkRndMin: 0.7, atkRndMax: -0.5 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndP}`, effect: { atkRndMin: -0.15, atkRndMax: 0.4 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndM}`, effect: { defRndMin: 0, defRndMax: -0.2 }, unique: "rnd" },
    { name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndP}`, effect: { defRndMin: -0.2, defRndMax: 0 }, unique: "rnd" },
    { name: `準備を怠らない`, effect: { firstTurnItem: 1 }, unique: "firstTurnItem" },
    { name: `道具大好き`, effect: { itemEquip: 0.4 } },
    { name: `道具の扱いが上手い`, effect: { itemBoost: 0.4 } },
    { name: `武器が大好き`, effect: { weaponSelect: 1, weaponBoost: 0.6 } },
    { name: `防具が大好き`, effect: { armorSelect: 1, armorBoost: 0.6 } },
    { name: `食いしんぼう`, effect: { foodSelect: 1, foodBoost: 0.6, poisonResist: 0.6 } },
    { name: `なんでも口に入れない`, effect: { poisonAvoid: 0.5 } },
    { name: `道具の選択が上手い`, effect: { mindMinusAvoid: 0.15 } },
    { name: `お腹が空いてから食べる`, effect: { lowHpFood: 1, foodBoost: 0.2, poisonResist: 0.2 } },
    { name: `たまにたくさん成長`, effect: { statusBonus: 1 }, unique: "status" },
    { name: `連続攻撃完遂率上昇`, effect: { abortDown: 0.3 } },
    { name: `クリティカル率上昇`, effect: { critUp: 0.3 } },
    { name: `クリティカルダメージ上昇`, effect: { critDmgUp: 0.3 } },
    { name: `敵のクリティカル率減少`, effect: { enemyCritDown: 0.3 } },
    { name: `敵のクリティカルダメージ減少`, effect: { enemyCritDmgDown: 0.3 } },
    { name: `負けた時、しっかり反省`, effect: { loseBonus: 1 }, unique: "loseBonus" },
    { name: `７フィーバー！`, effect: { sevenFever: 1 } },
]

export const getSkill = (data) => {
    const filteredSkills = skills.filter((x) => !data.skills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));
    return filteredSkills[Math.floor(Math.random() * filteredSkills.length)];
}

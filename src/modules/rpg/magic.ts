type Magic = {
	name: string;
    desc?: string;
    /** 出現率 */
    weight: number;
    /** 判定フェーズ */
    phase: "Start" | "TurnStart" | "Attack" | "AfterAttack" | "Defense" | "AfterDefense" | "TurnEnd" | "End"
	/** 発動条件 */
	trigger: (triggerData) => Boolean;
	/** 発動した際に発生する内容 */
	effect: {
        trueDmg?: number;    // 防御無視ダメージ
        eAtkX?: number;      // 相手の攻撃力補正
        freeze?: number;     // 凍結効果
        eDmgX?: number;      // 相手から受けるダメージの減衰効果
        dmg?: number;        // 追加ダメージ
        spd?: number;        // 素早さの上昇
        turnPlus?: number;   // ターン加算
        fixedCrit?: number;  // 急所への固定クリティカル率
        cleanse?: number;    // デバフ除去
        itemGet?: number;    // アイテム取得の効果
        minEffect?: number;  // アイテム取得時の最小効果値
        atkUp?: number;      // 攻撃力上昇
        defUp?: number;      // 防御力上昇
        heal?: number;       // 回復効果
        barrier?: number;    // バリア効果
    };
};

const descTemplate = {
    fire: "火球を放ち防御力を無視したダメージを与えます",
    water: "相手を濡らし、攻撃しにくくします",
    wind: "自身の後ろから追い風が吹き、行動回数を増加させます",
    heal: "ピンチの際に自身を回復するようになります",
    barrier: "バリアを貼り、自身の体力を限界を超えて増加させます"
}

export const magics: Magic[] = [
    {name: "火球", desc: descTemplate.fire, weight: 20, phase: "AfterAttack", trigger: (triggerData) => triggerData.atk < triggerData.edef && Math.random() < 0.5, effect: {trueDmg: 30}},
    {name: "大火球", desc: descTemplate.fire, weight: 5, phase: "AfterAttack", trigger: (triggerData) => triggerData.atk < triggerData.edef && Math.random() < 0.4, effect: {trueDmg: 60}},
    {name: "豪火球", desc: descTemplate.fire, weight: 1, phase: "AfterAttack", trigger: (triggerData) => triggerData.atk < triggerData.edef && Math.random() < 0.3, effect: {trueDmg: 100}},
    {name: "水鉄砲", desc: descTemplate.water, weight: 20, phase: "Start", trigger: (triggerData) => Math.random() < 0.5, effect: {eAtkX: 0.9}},
    {name: "水射出", desc: descTemplate.water, weight: 5, phase: "Start", trigger: (triggerData) => Math.random() < 0.4, effect: {eAtkX: 0.8}},
    {name: "高圧水噴射", desc: descTemplate.water, weight: 1, phase: "Start", trigger: (triggerData) => Math.random() < 0.3, effect: {eAtkX: 0.7}},
    {name: "冷気噴射", desc:"冷気を噴射し、相手を凍結させます" ,weight: 20, phase: "AfterAttack", trigger: (triggerData) => Math.random() < 0.2, effect: {freeze: 1}},
    {name: "氷の盾", desc:"大きいダメージを受ける際、氷の盾で威力を減衰させます", weight: 5, phase: "Defense", trigger: (triggerData) => triggerData.predictedDmg > triggerData.hp && Math.random() < 0.8, effect: {eDmgX: 0.5}},
    {name: "氷山潰し", desc:"氷山を召喚し、相手を潰します", weight: 1, phase: "Attack", trigger: (triggerData) => Math.random() < 0.3, effect: {dmg: 1, freeze: 0.1}},
    {name: "追い風", desc: descTemplate.wind, weight: 20, phase: "Start", trigger: (triggerData) => Math.random() < 0.5, effect: {spd: 1}},
    {name: "強追風", desc: descTemplate.wind, weight: 5, phase: "Start", trigger: (triggerData) => Math.random() < 0.4, effect: {spd: 2}},
    {name: "超越風", desc:"すべてを超越する風が吹き、７ターンを超えた領域に入ります", weight: 1, phase: "End", trigger: (triggerData) => Math.random() < 0.3, effect: {turnPlus: 1}},
    {name: "閃光", desc:"強い光を放ち、相手の視界を奪います", weight: 20, phase: "Defense", trigger: (triggerData) => Math.random() < 0.5, effect: {eAtkX: 0.5}},
    {name: "急所の光", desc:"敵の急所を示す光を放ちます", weight: 5, phase: "TurnStart", trigger: (triggerData) => Math.random() < 0.4, effect: {fixedCrit: 0.5}},
    {name: "浄化の光", desc:"自身に付与されている全てのデバフを解除します", weight: 1, phase: "AfterDefense", trigger: (triggerData) => triggerData.debuff && Math.random() < 0.6, effect: {cleanse: 1}},
    {name: "道具召喚", desc:"道具を必ず手に入れます", weight: 20, phase: "TurnStart", trigger: (triggerData) => Math.random() < 0.5, effect: {itemGet: 1}},
    {name: "強道具召喚", desc:"強い道具を必ず手に入れます", weight: 5, phase: "TurnStart", trigger: (triggerData) => Math.random() < 0.4, effect: {itemGet: 1, minEffect: 50}},
    {name: "暴炎神龍召喚", desc:"暴炎神龍セットを必ず手に入れます", weight: 1, phase: "TurnStart", trigger: (triggerData) => Math.random() < 0.3, effect: {itemGet: 1, minEffect: 200}},
    {name: "力の解放", desc: "パワーが上昇します", weight: 8, phase: "Start", trigger: (triggerData) => Math.random() < 0.5, effect: {atkUp: 0.1}},
    {name: "硬化魔法", desc: "防御が上昇します", weight: 10, phase: "Start", trigger: (triggerData) => Math.random() < 0.5, effect: {defUp: 0.1}},
    {name: "回復魔法", desc: descTemplate.heal, weight: 20, phase: "Defense", trigger: (triggerData) => triggerData.predictedDmg > triggerData.hp || triggerData.hpp < 0.5, effect: {heal: 0.3}},
    {name: "強回復魔法", desc: descTemplate.heal, weight: 5, phase: "Defense", trigger: (triggerData) => triggerData.predictedDmg > triggerData.hp || triggerData.hpp < 0.5, effect: {heal: 0.6}},
    {name: "ベネディクション", desc: descTemplate.heal, weight: 1, phase: "Defense", trigger: (triggerData) => triggerData.predictedDmg > triggerData.hp || triggerData.hpp < 0.5, effect: {heal: 1}},
    {name: "バリア", desc: descTemplate.barrier, weight: 20, phase: "Start", trigger: (triggerData) => Math.random() < 0.5, effect: {barrier: 0.2}},
    {name: "スーパーバリア", desc: descTemplate.barrier, weight: 5, phase: "Start", trigger: (triggerData) => Math.random() < 0.4, effect: {barrier: 0.4}},
    {name: "ハイパーバリア", desc: descTemplate.barrier, weight: 1, phase: "Start", trigger: (triggerData) => Math.random() < 0.3, effect: {barrier: 0.6}},
]
import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import 藍 from '@/ai';
import { aggregateTokensEffects, AmuletItem, ShopItem, shopItems, mergeSkillAmulet } from './shop';
import { deepClone, getColor } from './utils';
import { colors, enhanceCount } from './colors';
import config from "@/config";

export let skillNameCountMap = new Map();
export let totalSkillCount = 0;
let ai: 藍;

export function skillCalculate(_ai: 藍 = ai) {
	skillNameCountMap = new Map();
	totalSkillCount = 0;
	if (_ai) ai = _ai;
	const friends = ai.friends.find().filter((x) => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1 && x.perModulesData.rpg.skills?.length);
	friends.forEach(friend => {
		const skills = friend.perModulesData.rpg.skills;
		if (skills && Array.isArray(skills)) {
			skills.forEach(skill => {
				const skillName = skill?.name;
				if (skillName) {
					totalSkillCount += 1;
					if (skillNameCountMap.has(skillName)) {
						skillNameCountMap.set(skillName, skillNameCountMap.get(skillName) + 1);
					} else {
						skillNameCountMap.set(skillName, 1);
					}
				}
			});
		}
	});
	return { skillNameCountMap, totalSkillCount };
}

export type SkillEffect = {
	/** パワーがn%上昇 （グループ１） */
	atkUp?: number;
	/** パワーがn%上昇 （グループ２） */
	atkUp2?: number;
	/** パワーがn%上昇 （グループ３） */
	atkUp3?: number;
	/** パワーがn%上昇 （グループ４） */
	atkUp4?: number;
	/** パワーがn%上昇 （グループ５） */
	atkUp5?: number;
	/** パワーがn%上昇 （グループ６） */
	atkUp6?: number;
	/** 防御がn%上昇 （グループ１） */
	defUp?: number;
	/** 防御がn%上昇 （グループ２） */
	defUp2?: number;
	/** 防御がn%上昇 （グループ３） */
	defUp3?: number;
	/** 防御がn%上昇 （グループ４） */
	defUp4?: number;
	/** 防御がn%上昇 （グループ５） */
	defUp5?: number;
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
	/** 与ダメージをn%上昇 （グループ１） */
	atkDmgUp?: number;
	/** 与ダメージをn%上昇 （グループ２） */
	atkDmgUp2?: number;
	/** 被ダメージをn%上昇（グループ１） */
	defDmgUp?: number;
	/** 被ダメージをn%上昇（グループ２） */
	defDmgUp2?: number;
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
	/** 最初のターンの道具の最低効果量をn*100以上にする */
	firstTurnItemChoice?: number;
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
	/** 60%でステータスn%アップ そうでない場合ダウン */
	heavenOrHell?: number;
	/** 乱数が常に平均値で固定 */
	notRandom?: number;
	/** ランダムステータス変化 */
	fortuneEffect?: number;
	/** 全力の一撃のダメージをn%増加 */
	finalAttackUp?: number;
	berserk?: number;
	slowStart?: number;
	stockRandomEffect?: number;
	noAmuletAtkUp?: number;
	haisuiAtkUp?: number;
	haisuiCritUp?: number;
	rainbow?: number;
	guardAtkUp?: number
	distributed?: number
	beginner?: number
};

export type Skill = {
	/** スキル名 */
	name: string;
	/** 短縮名 */
	short: string;
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
	/** 自然習得しないスキルの場合 */
	notLearn?: boolean;
	/** お守りとして出ない場合 */
	skillOnly?: boolean;
};

export const skills: Skill[] = [
	{ name: `${serifs.rpg.status.atk}+10%`, short: `Ｐ`, desc: `常に${serifs.rpg.status.atk}が10%上がります`, info: `条件無しで${serifs.rpg.status.atk}+10%`, effect: { atkUp: 0.1 }, moveTo: `${serifs.rpg.status.atk}アップ` },
	{ name: `${serifs.rpg.status.def}+10%`, short: `Ｄ`, desc: `常に${serifs.rpg.status.def}が10%上がります`, info: `条件無しで${serifs.rpg.status.def}+10%`, effect: { defUp: 0.1 }, moveTo: `${serifs.rpg.status.def}アップ` },
	{ name: `${serifs.rpg.status.atk}アップ`, short: `Ｐ`, desc: `常に${serifs.rpg.status.atk}が上がります`, info: `${serifs.rpg.status.atk}+11%`, effect: { atkUp: 0.11 } },
	{ name: `${serifs.rpg.status.def}アップ`, short: `Ｄ`, desc: `常に${serifs.rpg.status.def}が上がります`, info: `${serifs.rpg.status.def}+13%`, effect: { defUp: 0.13 } },
	{ name: `炎属性剣攻撃`, short: "炎", desc: `戦闘時、最低ダメージが上昇します`, info: `戦闘時、Lvの9%がダメージに固定加算\n非戦闘時、${serifs.rpg.status.atk}+Lvの35%\n火曜日に全ての効果量が66%アップ`, effect: { fire: 0.09 } },
	{ name: `氷属性剣攻撃`, short: "氷", desc: `戦闘時、たまに敵を凍らせます`, info: `戦闘時、9%で相手のターンをスキップ\n非戦闘時、${serifs.rpg.status.def}+9%\n水曜日に全ての効果量が66%アップ`, effect: { ice: 0.09 } },
	{ name: `雷属性剣攻撃`, short: "雷", desc: `戦闘時、連続攻撃をすればダメージが上がります`, info: `(現在攻撃数/最大攻撃数)×18%のダメージ上昇を得る\n日曜日に全ての効果量が66%アップ`, effect: { thunder: 0.18 } },
	{ name: `風属性剣攻撃`, short: "風", desc: `戦闘時、たまに行動回数が上がります`, info: `戦闘時、9%で行動回数が2倍\n非戦闘時、${serifs.rpg.status.atk}+9%\n木曜日に全ての効果量が66%アップ`, effect: { spdUp: 0.09 } },
	{ name: `土属性剣攻撃`, short: "土", desc: `戦闘時、最大ダメージが上昇します`, info: `戦闘時かつ最大ダメージ制限がある場合、その制限を18%増加\n非戦闘時、${serifs.rpg.status.atk}+9%\n土曜日に全ての効果量が66%アップ`, effect: { dart: 0.18 } },
	{ name: `光属性剣攻撃`, short: "光", desc: `戦闘時、たまに敵の攻撃力を下げます`, info: `戦闘時、18%でダメージカット50%\nそれ以外の場合、${serifs.rpg.status.def}+9%\n金曜日に全ての効果量が66%アップ`, effect: { light: 0.18 } },
	{ name: `闇属性剣攻撃`, short: "闇", desc: `戦闘時、たまに敵の周辺に高重力領域を発生させます`, info: `戦闘時、9%で敵の現在HPの半分のダメージ（レイドでは150ダメージ）を与える\n行動回数が2回以上の敵に18%で行動回数を1にする\nそれ以外の場合、${serifs.rpg.status.def}+6.3%\n月曜日に全ての効果量が66%アップ`, effect: { dark: 0.09 } },
	{ name: `炎属性剣攻撃＋`, short: "**炎**", desc: `戦闘時、最低ダメージが大きく上昇します`, info: `戦闘時、Lvの15%がダメージに固定加算\n非戦闘時、${serifs.rpg.status.atk}+Lvの58%\n火曜日に全ての効果量が66%アップ`, effect: { fire: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `氷属性剣攻撃＋`, short: "**氷**", desc: `戦闘時、たまに敵を凍らせます`, info: `戦闘時、15%で相手のターンをスキップ\n非戦闘時、${serifs.rpg.status.def}+15%\n水曜日に全ての効果量が66%アップ`, effect: { ice: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `雷属性剣攻撃＋`, short: "**雷**", desc: `戦闘時、連続攻撃をすればダメージが上がります`, info: `(現在攻撃数/最大攻撃数)×30%のダメージ上昇を得る\n日曜日に全ての効果量が66%アップ`, effect: { thunder: 0.3 }, notLearn: true, skillOnly: true },
	{ name: `風属性剣攻撃＋`, short: "**風**", desc: `戦闘時、たまに行動回数が上がります`, info: `戦闘時、15%で行動回数が2倍\n非戦闘時、${serifs.rpg.status.atk}+15%\n木曜日に全ての効果量が66%アップ`, effect: { spdUp: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `土属性剣攻撃＋`, short: "**土**", desc: `戦闘時、最大ダメージが上昇します`, info: `戦闘時かつ最大ダメージ制限がある場合、その制限を30%増加\n非戦闘時、${serifs.rpg.status.atk}+15%\n土曜日に全ての効果量が66%アップ`, effect: { dart: 0.3 }, notLearn: true, skillOnly: true },
	{ name: `光属性剣攻撃＋`, short: "**光**", desc: `戦闘時、たまに敵の攻撃力を下げます`, info: `戦闘時、30%でダメージカット50%\nそれ以外の場合、${serifs.rpg.status.def}+15%\n金曜日に全ての効果量が66%アップ`, effect: { light: 0.3 }, notLearn: true, skillOnly: true },
	{ name: `闇属性剣攻撃＋`, short: "**闇**", desc: `戦闘時、たまに敵の周辺に高重力領域を発生させます`, info: `戦闘時、15%で敵の現在HPの半分のダメージ（レイドでは150ダメージ）を与える\n行動回数が2回以上の敵に30%で行動回数を1にする\nそれ以外の場合、${serifs.rpg.status.def}+10.5%\n月曜日に全ての効果量が66%アップ`, effect: { dark: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `毒属性剣攻撃`, short: "毒", desc: `戦闘時、ターン経過ごとに相手が弱体化します`, info: `ターン経過ごとに敵のステータス-5%\nレイドでは特殊な倍率でステータス減少を付与`, effect: { weak: 0.05 } },
	{ name: `テキパキこなす`, short: "効", desc: `戦闘以外の事の効率が上がります`, info: `非戦闘時、${serifs.rpg.status.atk}+22%`, effect: { notBattleBonusAtk: 0.22 } },
	{ name: `疲れにくい`, short: "疲", desc: `疲れでダメージを受ける際にそのダメージを軽減します`, info: `ダメージメッセージに疲が入っている場合、${serifs.rpg.status.def}+27%`, effect: { notBattleBonusDef: 0.27 } },
	{ name: `油断しない`, short: "断", desc: `ターン1に受けるダメージを大きく軽減します`, info: `ターン1にてダメージカット40%を得る\n100%以上になる場合、残りはターン2に持ち越す`, effect: { firstTurnResist: 0.4 }, skillOnly: true },
	{ name: `粘り強い`, short: "粘", desc: `体力が減るほど受けるダメージを軽減します`, info: `ダメージカット25%×(減少HP割合)を得る 最大90%`, effect: { tenacious: 0.25 } },
	{ name: `高速RPG`, short: "速", desc: `1回のRPGでお互いに2回行動します`, info: `1回のコマンドで2ターン進行する レイド時は、${serifs.rpg.status.atk}+10%`, effect: { plusActionX: 1 } },
	{ name: `1時間先取りRPG`, short: "先", desc: `1時間早くRPGをプレイする事が出来ます`, info: `1時間早くRPGプレイ可能 ステータス+5%`, effect: { atkUp: 0.05, defUp: 0.05, rpgTime: -1 }, moveTo: "高速RPG" },
	{ name: `伝説`, short: "★", desc: `パワー・防御が8%上がります`, info: `ステータス+8% 重複しない`, effect: { atkUp2: 0.08, defUp2: 0.08 }, unique: "legend" },
	{ name: `脳筋`, short: "筋", desc: `与えるダメージが上がりますが、受けるダメージも上がります`, info: `${serifs.rpg.dmg.give}+20% ${serifs.rpg.dmg.take}+10%`, effect: { atkDmgUp: 0.2, defDmgUp: 0.1 } },
	{ name: `慎重`, short: "慎", desc: `与えるダメージが下がりますが、受けるダメージも下がります`, info: `${serifs.rpg.dmg.give}-8% ${serifs.rpg.dmg.take}-20%`, effect: { atkDmgUp: -0.08, defDmgUp: -0.2 } },
	{ name: `連続・毎日ボーナス強化`, short: "連", desc: `連続・毎日ボーナスの上昇量が上がります`, info: `ステータス+5% 毎日ボーナスの増加量+100% (10 ~ 25投稿↑)`, effect: { atkUp2: 0.05, defUp2: 0.05, continuousBonusUp: 1 } },
	{ name: `負けそうなら逃げる`, short: "逃", desc: `逃げると負けた事になりません 連続で発動しにくい`, info: `スキルの数まで100%逃走 以降失敗まで発動度に確率半減し続ける\nレイド時は、1ターン距離を取って回復する`, effect: { escape: 1 } },
	{ name: `気合で頑張る`, short: "気", desc: `パワー・防御が少し上がり、気合耐えの確率が上がります`, info: `ステータス+5% 気合耐え確率+50%`, effect: { atkUp3: 0.05, defUp3: 0.05, endureUp: 0.5 } },
	{ name: `すぐ決死の覚悟をする`, short: "決", desc: `決死の覚悟の発動条件が緩くなり、効果量が上がります さらに決死の覚悟発動時、追加で与ダメージとクリティカル率が上がります`, info: `与ダメージ+8% 覚悟発動条件効果量+50%\n覚悟発動時与ダメージ+4% クリティカル率1.2倍`, effect: { atkDmgUp2: 0.08, haisuiUp: 0.5, haisuiAtkUp: 0.04, haisuiCritUp: 0.2 } },
	{ name: `投稿数ボーナス量アップ`, short: "投", desc: `投稿数が高ければ高いほどステータスが上昇します`, info: `20投稿につき、ステータス+1% (最大10%)`, effect: { postXUp: 0.01 } },
	{ name: `強敵と戦うのが好き`, short: "強", desc: `敵が強ければステータスが上昇します`, info: `ステータス+(敵の攻撃 × 敵の防御 / 4)%`, effect: { enemyStatusBonus: 1 } },
	{ name: `${serifs.rpg.status.pen}+10%`, short: "貫", desc: `敵の防御の影響を減少させます`, info: `敵の防御-12%`, effect: { arpen: 0.12 } },
	{ name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}4`, short: "４", desc: `乱数幅が20~180 -> 60~160 (%) になります`, info: `乱数幅 20~180 -> 60~160 (%) 期待値 110% 乱数系と重複しない`, effect: { atkRndMin: 0.4, atkRndMax: -0.2 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5`, short: "５", desc: `乱数幅が20~180 -> 90~130 (%) になります`, info: `乱数幅 20~180 -> 90~130 (%) 期待値 110% 乱数系と重複しない`, effect: { atkRndMin: 0.7, atkRndMax: -0.5 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndP}`, short: "乱", desc: `乱数幅が20~180 -> 5~225になります クリティカル率も上がります`, info: `乱数幅 20~180 -> 5~225 (%) 期待値 115% クリティカル率+2% 乱数系と重複しない`, effect: { atkRndMin: -0.15, atkRndMax: 0.6, critUpFixed: 0.02 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndM}`, short: "安", desc: `敵から受ける最大ダメージを減少させます`, info: `敵の乱数幅 20~180 -> 20~160 (%) 乱数系と重複しない`, effect: { defRndMin: 0, defRndMax: -0.2 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndP}`, short: "不", desc: `敵から受ける最小ダメージを減少させます`, info: `敵の乱数幅 20~180 -> 0~180 (%) 乱数系と重複しない`, effect: { defRndMin: -0.2, defRndMax: 0 }, unique: "rnd" },
	{ name: `準備を怠らない`, short: "備", desc: `ターン1にて、必ず良い効果がある武器か防具を装備します`, info: `ターン1装備率+100% ターン1悪アイテム率-100% レイド限定で、ターン1道具最低効果量上昇 重複しない`, effect: { firstTurnItem: 1, firstTurnMindMinusAvoid: 1, firstTurnItemChoice: 0.5 }, unique: "firstTurnItem" },
	{ name: `道具大好き`, short: "道", desc: `道具の使用率が上がります`, info: `アイテム装備率+50%`, effect: { itemEquip: 0.5 } },
	{ name: `道具大好き＋`, short: "**道**", desc: `道具の使用率が大きく上がります`, info: `アイテム装備率+90%`, effect: { itemEquip: 0.9 }, notLearn: true, skillOnly: true },
	{ name: `道具の扱いが上手い`, short: "扱", desc: `道具の効果量が上がります`, info: `アイテム効果量+40% アイテム悪効果軽減+40%`, effect: { itemBoost: 0.4 } },
	{ name: `武器が大好き`, short: "武", desc: `武器を装備しやすくなり、武器の効果量が上がります`, info: `武器装備率3倍 武器効果量+70% 種類大好き系と重複しない`, effect: { weaponSelect: 2, weaponBoost: 0.7 }, unique: "itemSelect" },
	{ name: `防具が大好き`, short: "防", desc: `防具を装備しやすくなり、防具の効果量が上がります`, info: `防具装備率3倍 防具効果量+70% 種類大好き系と重複しない`, effect: { armorSelect: 2, armorBoost: 0.7 }, unique: "itemSelect" },
	{ name: `食いしんぼう`, short: "食", desc: `食べ物を食べやすくなり、食べ物の効果量が上がります`, info: `食べ物使用率3倍 食べ物効果量+70% 毒食べ物ダメージ-60% 種類大好き系と重複しない`, effect: { foodSelect: 2, foodBoost: 0.7, poisonResist: 0.6 }, unique: "itemSelect" },
	{ name: `なんでも口に入れない`, short: "捨", desc: `良くないものを食べなくなることがあります`, info: `毒食べ物を50%で捨てる 100%以上になると悪アイテム率減少に変換`, effect: { poisonAvoid: 0.5 }, moveTo: "道具の選択が上手い" },
	{ name: `道具の選択が上手い`, short: "選", desc: `道具の効果量がすこし上がり、悪いアイテムを選びにくくなり、良くないものを食べなくなる事があります`, info: `道具効果量+15% 悪アイテム率-15% 毒食べ物を40%で捨てる 100%以上になると悪アイテム率減少に変換`, effect: { itemBoost: 0.15, mindMinusAvoid: 0.15, poisonAvoid: 0.4 } },
	{ name: `お腹が空いてから食べる`, short: "空", desc: `体力が減ったら食べ物を食べやすくなり、食べ物の効果量が少し上がります`, info: `体力が減少すれば食べ物を食べるようになり、毒食べ物の確率が下がる 食べ物効果量+20% 毒食べ物ダメージ-20%`, effect: { lowHpFood: 1, foodBoost: 0.2, poisonResist: 0.2 }, unique: "lowHpFood" },
	{ name: `たまにたくさん成長`, short: "成", desc: `たまにステータスが多く増加します ★変更不可`, info: `Lvアップ毎になにかのステータス+1 ★変更不可（変更してもステータスは残るため）`, effect: { statusBonus: 2 }, unique: "status", cantReroll: true },
	{ name: `連続攻撃完遂率上昇`, short: "遂", desc: `連続攻撃を相手に止められにくくなります`, info: `連続攻撃中断率-32% 効果がない場合、${serifs.rpg.status.atk}+10%`, effect: { abortDown: 0.32 } },
	{ name: `クリティカル性能上昇`, short: "急", desc: `クリティカル率とクリティカルダメージが上昇します`, info: `クリティカル率1.2倍&+3% クリティカルダメージ+20%`, effect: { critUp: 0.2, critUpFixed: 0.03, critDmgUp: 0.2 } },
	{ name: `敵のクリティカル性能減少`, short: "守", desc: `相手のクリティカル率とクリティカルダメージが減少します`, info: `敵のクリティカル率-40% 敵のクリティカルダメージ-40% レイド時は、追加で${serifs.rpg.status.def}+10%`, effect: { enemyCritDown: 0.4, enemyCritDmgDown: 0.4 } },
	{ name: `負けた時、しっかり反省`, short: "省", desc: `敗北時のボーナスが上昇します ★変更不可`, info: `敗北毎にステータス+2 ★変更不可（変更してもステータスは残るため）`, effect: { loseBonus: 1 }, unique: "loseBonus", cantReroll: true, moveTo: `負けそうなら逃げる` },
	{ name: `７フィーバー！`, short: "７", desc: `Lv・パワー・防御の値に「7」が含まれている程ステータスアップ`, info: `Lv・パワー・防御の値に「7」が含まれている場合ステータス+7%\n「77」が含まれている場合ステータス+77% 「777」が含まれている場合...`, effect: { sevenFever: 1 } },
	{ name: `不運チャージ`, short: "Ｃ", desc: `不運だった場合、次回幸運になりやすくなります`, info: `ステータス+6% 低乱数を引いた時、次回以降に高乱数を引きやすくなる`, effect: { atkUp4: 0.06, defUp4: 0.06, charge: 1 } },
	{ name: `お守り整備`, short: "整", desc: `お守りの効果が上がり、お守りが壊れにくくなります`, info: `お守り効果+50% お守り耐久+50%`, effect: { amuletBoost: 0.5 }, skillOnly: true },
	{ name: `値切り術`, short: "値", desc: `ショップのアイテムが少し安くなります`, info: `ショップアイテム全品10%OFF`, effect: { priceOff: 0.1 }, skillOnly: true },
	{ name: `天国か地獄か`, short: "天", desc: `戦闘開始時に強くなるか弱くなるかどちらかが起こります`, info: `60%でステータス+20% 40%でステータス-20%`, effect: { heavenOrHell: 0.2 } },
	{ name: `気性が荒い`, short: "荒", desc: `戦闘が得意になりますが、戦闘以外の効率が大きく下がります`, info: `${serifs.rpg.status.atk}+25% 非戦闘時、${serifs.rpg.status.atk}-40%`, effect: { atkUp5: 0.25, notBattleBonusAtk: -0.4 }, unique: "mind" },
	{ name: `気性穏やか`, short: "穏", desc: `戦闘以外の効率がとても上がりますが、戦闘が苦手になります`, info: `${serifs.rpg.status.atk}-25% 非戦闘時、${serifs.rpg.status.atk}+70%`, effect: { atkUp5: -0.25, notBattleBonusAtk: 0.7 }, unique: "mind" },
	{ name: `かるわざ`, short: "軽", desc: `ステータスが上がり、お守りを持っていない時、追加で${serifs.rpg.status.atk}がさらに上がります`, info: `ステータス+6% お守りを持っていない時、追加で${serifs.rpg.status.atk}+6%`, effect: { atkUp6: 0.06, defUp5: 0.06, noAmuletAtkUp: 0.06 }, skillOnly: true },
	{ name: `攻めの守勢`, short: "勢", desc: `通常よりもダメージを防げば防ぐ程、パワーが上がります（ただし７フィーバー！を除きます）`, info: `ダメージ軽減300毎に防御の12.5~40%分のパワーを得ます（７フィーバー！を除く）\nこの効果は最大4回まで発動し、発動した回数が多いほど効果が上がります\nさらにレイド時は発動した回数分、全力の一撃のダメージが上がります このスキルは重複しません`, effect: { guardAtkUp: 0.125 }, unique: "counter" },
	{ name: `分散型`, short: "散", desc: `同じスキルを持っていない程、ステータスが上がります（お守りは対象外）`, info: `パワー・防御+10% クリティカル率+10% ダメージ軽減+10% 同じスキルを持つ度に全ての効果-4%（お守りは対象外）`, effect: { distributed: 0.1 }, unique: "distributed" },
];

const ultimateEffect: SkillEffect = {
	"atkUp": 0.010,
	"atkUp2": 0.0063,
	"atkUp3": 0.0036,
	"atkUp4": 0.0045,
	"atkUp6": 0.0045,
	"defUp": 0.010,
	"defUp2": 0.0063,
	"defUp3": 0.0036,
	"defUp4": 0.0045,
	"defUp5": 0.0045,
	"fire": 0.008,
	"ice": 0.008,
	"thunder": 0.016,
	"spdUp": 0.008,
	"dart": 0.016,
	"light": 0.016,
	"dark": 0.008,
	"weak": 0.0054,
	"notBattleBonusAtk": 0.02,
	"notBattleBonusDef": 0.02,
	"firstTurnResist": 0.027,
	"tenacious": 0.023,
	"plusActionX": 1,
	"atkDmgUp": 0.011,
	"defDmgUp": -0.009,
	"atkDmgUp2": 0.007,
	"continuousBonusUp": 0.045,
	"escape": 1,
	"endureUp": 0.045,
	"haisuiUp": 0.045,
	"postXUp": 0.0045,
	"enemyStatusBonus": 0.09,
	"arpen": 0.009,
	"defRndMin": -0.02,
	"defRndMax": -0.02,
	"firstTurnItem": 1,
	"firstTurnMindMinusAvoid": 1,
	"itemEquip": 0.045,
	"itemBoost": 0.05,
	"weaponBoost": 0.054,
	"armorBoost": 0.054,
	"foodBoost": 0.072,
	"poisonResist": 0.072,
	"mindMinusAvoid": 0.014,
	"poisonAvoid": 0.036,
	"abortDown": 0.027,
	"critUp": 0.018,
	"critUpFixed": 0.0027,
	"critDmgUp": 0.018,
	"enemyCritDown": 0.036,
	"enemyCritDmgDown": 0.036,
	"sevenFever": 0.1,
	"charge": 0.1,
	"heavenOrHell": 0.018,
	"haisuiAtkUp": 0.0036,
	"haisuiCritUp": 0.018,
}

export const ultimateAmulet = { name: `究極のお守り`, limit: (data) => enhanceCount(data) >= 9, price: 18, desc: `${config.rpgHeroName}RPGを極めたあなたに……`, type: "amulet", effect: ultimateEffect, durability: 6, short: "究極", isUsed: (data) => true, always: true } as AmuletItem;

export const getSkill = (data) => {
	const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x);
	// フィルタリングされたスキルの配列を作成
	const filteredSkills = skills.filter((x) => !x.notLearn && !x.moveTo && (!x.cantReroll || !playerSkills?.some((y) => y.cantReroll)) && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));

	// スキルの合計重みを計算
	const totalWeight = filteredSkills.reduce((total, skill) => {
		const skillCount = !skill.cantReroll ? (skillNameCountMap.get(skill.name) || 0) : (totalSkillCount / (skills.filter((x) => !x.moveTo).length));
		return total + 1 / (1 + skillCount); // 出現回数に応じて重みを計算
	}, 0);

	// 0からtotalWeightまでのランダム値を生成
	let randomValue = Math.random() * totalWeight;

	// ランダム値に基づいてスキルを選択
	for (let skill of filteredSkills) {
		const skillCount = !skill.cantReroll ? (skillNameCountMap.get(skill.name) || 0) : (totalSkillCount / (skills.filter((x) => !x.moveTo).length));
		const weight = 1 / (1 + skillCount); // 出現回数に応じて重みを計算

		if (randomValue < weight) {
			return skill; // ランダム値が現在のスキルの重み未満であればそのスキルを選択
		}

		randomValue -= weight; // ランダム値を減少させる
	}

	return filteredSkills[0]; // ここに来るのはおかしいよ
};

export const getRerollSkill = (data, oldSkillName = "") => {
	const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x);
	// フィルタリングされたスキルの配列を作成
	const filteredSkills = skills.filter((x) => !x.notLearn && !x.moveTo && !x.cantReroll && x.name != oldSkillName && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique));

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
};

const skillInfo = (skills: Skill[] | undefined, desc: string, infoFlg = false) => {
	if (!skills) return `\n${desc}`;
	let ret = "";
	for (const skill of skills) {
		ret += `${infoFlg && skill.info ? `\n${skill.info}` : skill.desc ? `\n${skill.desc}` : ""}`;
	}
	return ret;
};

/** スキルに関しての情報を返す */
export const skillReply = (module: Module, ai: 藍, msg: Message) => {

	// データを読み込み
	const data = msg.friend.getPerModulesData(module);
	if (!data) return false;

	skillCalculate(ai);

	if (!data.skills?.length) return { reaction: 'confused' };

	let playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x);

	if (msg.includes(["ソート"])) {
		data.skills = data.skills.sort((a, b) => (skills.map((x) => x.name).indexOf(a.name) - skills.map((x) => x.name).indexOf(b.name)));
		msg.reply(`\n` + serifs.rpg.skills.sort);
		msg.friend.setPerModulesData(module, data);
		return {
			reaction: 'love'
		};
	}

	if (msg.includes(["効果", "詳細" , "合計", "情報", "バフ"])) {
		if (msg.includes(["3"])) {
			msg.reply(`\n※スキル3倍時効果\n\`\`\`\n` + getTotalEffectString(data, 3) + `\n\`\`\``);
		} else {
			msg.reply(`\n\`\`\`\n` + getTotalEffectString(data) + `\n\`\`\``);
		}
		return {
			reaction: 'love'
		};
	}

	if (msg.includes([serifs.rpg.command.change]) && msg.includes([serifs.rpg.command.duplication])) {
		if (!data.duplicationOrb || data.duplicationOrb <= 0) return { reaction: 'confused' };
		for (let i = 0; i < data.skills.length; i++) {
			if (msg.includes([String(i + 1)])) {
				if (!playerSkills[i].cantReroll) {
					const oldSkillName = playerSkills[i].name;
					const list = playerSkills.filter((x) => x.name !== oldSkillName && !x.unique && !x.cantReroll);
					if (!list.length) {
						msg.reply(`\n複製可能なスキルがありません！`);
						return { reaction: 'confused' };
					}
					data.skills[i] = list[Math.floor(Math.random() * list.length)];
					msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name) + `\n効果: ${data.skills[i].desc}` + (aggregateTokensEffects(data).showSkillBonus && data.skills[i].info ? `\n詳細効果: ${data.skills[i].info}` : ""));
					data.duplicationOrb -= 1;
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
					const oldSkillName = playerSkills[i].name;
					if (data.nextSkill && skills.find((x) => x.name === data.nextSkill)) {
						const skill = skills.find((x) => x.name === data.nextSkill);
						if (skill && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(skill.unique)) {
							data.skills[i] = skill;
							data.nextSkill = null;
						} else {
							data.skills[i] = getRerollSkill(data, oldSkillName);
						}
					} else {
						data.skills[i] = getRerollSkill(data, oldSkillName);
					}
					msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name) + `\n効果: ${data.skills[i].desc}` + (aggregateTokensEffects(data).showSkillBonus && data.skills[i].info ? `\n詳細効果: ${data.skills[i].info}` : ""));
					data.rerollOrb -= 1;
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

	let amuletSkill: string[] = [];
	if (data.items?.filter((x) => x.type === "amulet").length) {
		const amulet = data.items?.filter((x) => x.type === "amulet")[0];
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
		const skill = amulet.skillName && !Array.isArray(amulet.skillName) ? [skills.find((x) => amulet.skillName === x.name)] : amulet.skillName && Array.isArray(amulet.skillName) ? amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) : undefined;
		if (amulet.durability) amuletSkill.push(`[お守り] ${amulet.skillName && !Array.isArray(amulet.skillName) ? amulet.skillName : amulet.name} ${aggregateTokensEffects(data).autoRepair && (item.durability ?? 0) >= 2 && amulet.durability <= 1 ? `コイン消費${Math.round((amulet.price ?? 12) / (item.durability ?? 6)) + 1}` : `残耐久${amulet.durability}`}${skillInfo(skill, item.desc, aggregateTokensEffects(data).showSkillBonus)}`);
	}
	
	const skillBorders = [20, 50, 100, 170, 255];

	msg.reply([
		data.rerollOrb && data.rerollOrb > 0 ? serifs.rpg.skills.info(data.rerollOrb) + "\n" : "",
		data.duplicationOrb && data.duplicationOrb > 0 ? serifs.rpg.skills.duplicationInfo(data.duplicationOrb) + "\n" : "",
		serifs.rpg.skills.list,
		...playerSkills.map((x, index) => `[${index + 1}] ${x.name}${aggregateTokensEffects(data).showSkillBonus && x.info ? `\n${x.info}` : x.desc ? `\n${x.desc}` : ""}`),
		...(playerSkills.length < skillBorders.length ? [`<small>[${playerSkills.length + 1}] このスキル枠はLvをあと${skillBorders[playerSkills.length] - data.lv}上げると使用可能になります</small>`] : []),
		...amuletSkill
	].filter(Boolean).join("\n"));

	return {
		reaction: 'love'
	};

};

export const skillPower = (ai: 藍, skillName: Skill["name"]) => {
	const { skillNameCountMap, totalSkillCount } = skillCalculate(ai);
	return { skillNameCountMap, skillNameCount: skillNameCountMap.get(skillName), totalSkillCount };
};

/**
 * data.skillsに格納されている全スキルのeffectを集計する関数。
 * 重複している効果はその値を足す。
 *
 * @param data - skills配列を含むデータオブジェクト。
 * @returns 集計されたSkillEffect。
 */
export function aggregateSkillsEffects(data: any): SkillEffect {
	const aggregatedEffect: SkillEffect = {};

	if (!data.skills) return aggregatedEffect;
	let dataSkills = data.skills;
	if (data.items?.filter((x) => x.type === "amulet").length) {
		const amulet = data.items?.filter((x) => x.type === "amulet")[0] as AmuletItem;
		console.log("amulet: " + amulet.name);
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
		if (!item) {
			data.items.filter((x) => x.type === "amulet").forEach((x) => {
				data.coin = (data.coin ?? 0) + (x.price || 0);
			});
			data.items = data.items.filter((x) => x.type !== "amulet");
		} else {
			if (item.isUsed(data) && (!aggregateTokensEffects(data).normalModeNotUseAmulet || data.raid)) {
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
			};
				console.log("effect: " + JSON.stringify(adjustEffect(item.effect, boost)));
				dataSkills = dataSkills.concat([adjustEffect(item.effect, boost)] as any);
			}
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

	const day = new Date().getDay();
	
	aggregatedEffect.atkUp = (1 + (aggregatedEffect.atkUp ?? 0)) * (1 + (aggregatedEffect.atkUp2 ?? 0)) * (1 + (aggregatedEffect.atkUp3 ?? 0)) * (1 + (aggregatedEffect.atkUp4 ?? 0)) * (1 + (aggregatedEffect.atkUp5 ?? 0)) * (1 + (aggregatedEffect.atkUp6 ?? 0));
	aggregatedEffect.defUp = (1 + (aggregatedEffect.defUp ?? 0)) * (1 + (aggregatedEffect.defUp2 ?? 0)) * (1 + (aggregatedEffect.defUp3 ?? 0)) * (1 + (aggregatedEffect.defUp4 ?? 0)) * (1 + (aggregatedEffect.defUp5 ?? 0));
	aggregatedEffect.atkDmgUp = ((1 + (aggregatedEffect.atkDmgUp ?? 0)) * (1 + (aggregatedEffect.atkDmgUp2 ?? 0))) - 1;
	aggregatedEffect.defDmgUp = ((1 + (aggregatedEffect.defDmgUp ?? 0)) * (1 + (aggregatedEffect.defDmgUp2 ?? 0))) - 1;

	if (data.itemMedal) {
		aggregatedEffect.itemEquip = (aggregatedEffect.itemEquip ?? 0) + data.itemMedal * 0.01;
		aggregatedEffect.itemBoost = (aggregatedEffect.itemBoost ?? 0) + data.itemMedal * 0.01;
		aggregatedEffect.mindMinusAvoid = (aggregatedEffect.mindMinusAvoid ?? 0) + data.itemMedal * 0.01;
		aggregatedEffect.poisonAvoid = (aggregatedEffect.poisonAvoid ?? 0) + data.itemMedal * 0.01;
	}

	if (aggregatedEffect.beginner) {
		/** 常時覚醒？ */
		let alwaysSuper = getColor(data).alwaysSuper;
		/* スキル数が1少ない度に×1.06 レイドかつ常時覚醒でない場合さらに×1.15 */
		aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * ((Math.pow(1 + aggregatedEffect.beginner, 5 - (data.skills?.length ?? 0)) * (alwaysSuper || !data.raid ? 1 : 1.15)));
		aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * ((Math.pow(1 + aggregatedEffect.beginner, 5 - (data.skills?.length ?? 0)) * (alwaysSuper || !data.raid ? 1 : 1.15)));
	}
	
	if (aggregatedEffect.rainbow && aggregatedEffect.rainbow > 1) {
		aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * (1 + (aggregatedEffect.rainbow - 1) * 0.05);
		aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * (1 + (aggregatedEffect.rainbow - 1) * 0.05);
		aggregatedEffect.rainbow = 1;
	}

	//曜日ボーナス
	if ((day == 0 || aggregatedEffect.rainbow) && aggregatedEffect.thunder) {
		aggregatedEffect.thunder *= 5 / 3;
	}
	if ((day == 1 || aggregatedEffect.rainbow) && aggregatedEffect.dark) {
		aggregatedEffect.dark *= 5 / 3;
	}
	if ((day == 2 || aggregatedEffect.rainbow) && aggregatedEffect.fire) {
		aggregatedEffect.fire *= 5 / 3;
	}
	if ((day == 3 || aggregatedEffect.rainbow) && aggregatedEffect.ice) {
		aggregatedEffect.ice *= 5 / 3;
	}
	if ((day == 4 || aggregatedEffect.rainbow) && aggregatedEffect.spdUp) {
		aggregatedEffect.spdUp *= 5 / 3;
	}
	if ((day == 5 || aggregatedEffect.rainbow) && aggregatedEffect.light) {
		aggregatedEffect.light *= 5 / 3;
	}
	if ((day == 6 || aggregatedEffect.rainbow) && aggregatedEffect.dart) {
		aggregatedEffect.dart *= 5 / 3;
	}

	if (aggregatedEffect.distributed) {
		const count = countDuplicateSkillNames(data.skills)
		if (count < 3) {
			aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * (1 + (aggregatedEffect.distributed) * (1 - (count * 0.4)));
			aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * (1 + (aggregatedEffect.distributed) * (1 - (count * 0.4)));
			aggregatedEffect.critUpFixed = (aggregatedEffect.critUpFixed ?? 0) + (aggregatedEffect.distributed) * (1 - (count * 0.4));
			aggregatedEffect.defDmgUp = (aggregatedEffect.defDmgUp ?? 0) - (aggregatedEffect.distributed) * (1 - (count * 0.4));
		}
	}

	if (aggregatedEffect.itemEquip && aggregatedEffect.itemEquip > 1.5) {
		aggregatedEffect.itemBoost = (aggregatedEffect.itemBoost ?? 0) + (aggregatedEffect.itemEquip - 1.5);
		aggregatedEffect.itemEquip = 1.5;
	}

	if (aggregatedEffect.poisonAvoid && aggregatedEffect.poisonAvoid > 1) {
		aggregatedEffect.mindMinusAvoid = (aggregatedEffect.mindMinusAvoid ?? 0) + (aggregatedEffect.poisonAvoid - 1) * 0.6;
		aggregatedEffect.poisonAvoid = 1;
	}

	if (aggregatedEffect.abortDown && aggregatedEffect.abortDown > 1) {
		aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * (1 + (aggregatedEffect.abortDown - 1) * (1 / 3));
		aggregatedEffect.abortDown = 1;
	}

	if (aggregatedEffect.enemyCritDown && aggregatedEffect.enemyCritDown > 1) {
		aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * (1 + (aggregatedEffect.enemyCritDown - 1) * (1 / 3));
		aggregatedEffect.enemyCritDown = 1;
	}
	
	aggregatedEffect.atkUp = aggregatedEffect.atkUp - 1;
	aggregatedEffect.defUp = aggregatedEffect.defUp - 1;

	return aggregatedEffect;
}

export function aggregateSkillsEffectsSkillX(data: any, skillX: number): SkillEffect {
	const aggregatedEffect: SkillEffect = {};

	if (!data.skills) return aggregatedEffect;
	let dataSkills = data.skills;
	if (data.items?.filter((x) => x.type === "amulet").length) {
		const amulet = data.items?.filter((x) => x.type === "amulet")[0] as AmuletItem;
		console.log("amulet: " + amulet.name);
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
		if (!item) {
			data.items.filter((x) => x.type === "amulet").forEach((x) => {
				data.coin = (data.coin ?? 0) + (x.price || 0);
			});
			data.items = data.items.filter((x) => x.type !== "amulet");
		} else {
			if (item.isUsed(data) && (!aggregateTokensEffects(data).normalModeNotUseAmulet || data.raid)) {
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
			};
				console.log("effect: " + JSON.stringify(adjustEffect(item.effect, boost)));
				dataSkills = dataSkills.concat([adjustEffect(item.effect, boost)] as any);
			}
		}
	}
	let uniqueX = 1;
	dataSkills.forEach(_skill => {
		const skill = _skill.name ? skills.find((x) => x.name === _skill.name) ?? _skill : _skill;
		const __skill = deepClone(skill);
		if (__skill.unique) {
			uniqueX = uniqueX * (1 + (0.06 * (skillX - 1)));
		} else {
			for (const eff in __skill.effect) {
				__skill.effect[eff] = __skill.effect[eff] * skillX;
			}
		}
		if (__skill.effect) {
			Object.entries(__skill.effect).forEach(([key, value]) => {
				let value2 = value;
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

	const day = new Date().getDay();

	
	aggregatedEffect.atkUp = (1 + (aggregatedEffect.atkUp ?? 0)) * (1 + (aggregatedEffect.atkUp2 ?? 0)) * (1 + (aggregatedEffect.atkUp3 ?? 0)) * (1 + (aggregatedEffect.atkUp4 ?? 0)) * (1 + (aggregatedEffect.atkUp5 ?? 0)) * (1 + (aggregatedEffect.atkUp6 ?? 0)) * uniqueX;
	aggregatedEffect.defUp = (1 + (aggregatedEffect.defUp ?? 0)) * (1 + (aggregatedEffect.defUp2 ?? 0)) * (1 + (aggregatedEffect.defUp3 ?? 0)) * (1 + (aggregatedEffect.defUp4 ?? 0)) * (1 + (aggregatedEffect.defUp5 ?? 0)) * uniqueX;
	aggregatedEffect.atkDmgUp = ((1 + (aggregatedEffect.atkDmgUp ?? 0)) * (1 + (aggregatedEffect.atkDmgUp2 ?? 0))) - 1;
	aggregatedEffect.defDmgUp = ((1 + (aggregatedEffect.defDmgUp ?? 0)) * (1 + (aggregatedEffect.defDmgUp2 ?? 0))) - 1;

	if (data.itemMedal) {
		aggregatedEffect.itemEquip = (aggregatedEffect.itemEquip ?? 0) + data.itemMedal * 0.01;
		aggregatedEffect.itemBoost = (aggregatedEffect.itemBoost ?? 0) + data.itemMedal * 0.01;
		aggregatedEffect.mindMinusAvoid = (aggregatedEffect.mindMinusAvoid ?? 0) + data.itemMedal * 0.01;
		aggregatedEffect.poisonAvoid = (aggregatedEffect.poisonAvoid ?? 0) + data.itemMedal * 0.01;
	}

	if (aggregatedEffect.beginner) {
		/** 常時覚醒？ */
		let alwaysSuper = getColor(data).alwaysSuper;
		/* スキル数が1少ない度に×1.06 レイドかつ常時覚醒でない場合さらに×1.15 */
		aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * ((Math.pow(1 + aggregatedEffect.beginner, 5 - (data.skills?.length ?? 0)) * (alwaysSuper || !data.raid ? 1 : 1.15)));
		aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * ((Math.pow(1 + aggregatedEffect.beginner, 5 - (data.skills?.length ?? 0)) * (alwaysSuper || !data.raid ? 1 : 1.15)));
	}

	if (aggregatedEffect.rainbow && aggregatedEffect.rainbow > 1) {
		aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * (1 + (aggregatedEffect.rainbow - 1) * 0.05);
		aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * (1 + (aggregatedEffect.rainbow - 1) * 0.05);
		aggregatedEffect.rainbow = 1;
	}

	//曜日ボーナス
	if ((day == 0 || aggregatedEffect.rainbow) && aggregatedEffect.thunder) {
		aggregatedEffect.thunder *= 5 / 3;
	}
	if ((day == 1 || aggregatedEffect.rainbow) && aggregatedEffect.dark) {
		aggregatedEffect.dark *= 5 / 3;
	}
	if ((day == 2 || aggregatedEffect.rainbow) && aggregatedEffect.fire) {
		aggregatedEffect.fire *= 5 / 3;
	}
	if ((day == 3 || aggregatedEffect.rainbow) && aggregatedEffect.ice) {
		aggregatedEffect.ice *= 5 / 3;
	}
	if ((day == 4 || aggregatedEffect.rainbow) && aggregatedEffect.spdUp) {
		aggregatedEffect.spdUp *= 5 / 3;
	}
	if ((day == 5 || aggregatedEffect.rainbow) && aggregatedEffect.light) {
		aggregatedEffect.light *= 5 / 3;
	}
	if ((day == 6 || aggregatedEffect.rainbow) && aggregatedEffect.dart) {
		aggregatedEffect.dart *= 5 / 3;
	}

	if (aggregatedEffect.distributed) {
		const count = countDuplicateSkillNames(data.skills)
		if (count < 3) {
			aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * (1 + (aggregatedEffect.distributed) * (1 - (count * 0.4)));
			aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * (1 + (aggregatedEffect.distributed) * (1 - (count * 0.4)));
			aggregatedEffect.critUpFixed = (aggregatedEffect.critUpFixed ?? 0) + (aggregatedEffect.distributed) * (1 - (count * 0.4));
			aggregatedEffect.defDmgUp = (aggregatedEffect.defDmgUp ?? 0) - (aggregatedEffect.distributed) * (1 - (count * 0.4));
		}
	}

	if (aggregatedEffect.itemEquip && aggregatedEffect.itemEquip > 1.5) {
		aggregatedEffect.itemBoost = (aggregatedEffect.itemBoost ?? 0) + (aggregatedEffect.itemEquip - 1.5);
		aggregatedEffect.itemEquip = 1.5;
	}

	if (aggregatedEffect.poisonAvoid && aggregatedEffect.poisonAvoid > 1) {
		aggregatedEffect.mindMinusAvoid = (aggregatedEffect.mindMinusAvoid ?? 0) + (aggregatedEffect.poisonAvoid - 1) * 0.6;
		aggregatedEffect.poisonAvoid = 1;
	}

	if (aggregatedEffect.abortDown && aggregatedEffect.abortDown > 1) {
		aggregatedEffect.atkUp = (aggregatedEffect.atkUp ?? 0) * (1 + ((aggregatedEffect.abortDown - 1) * (1 / 3)));
		aggregatedEffect.abortDown = 1;
	}

	if (aggregatedEffect.enemyCritDown && aggregatedEffect.enemyCritDown > 1) {
		aggregatedEffect.defUp = (aggregatedEffect.defUp ?? 0) * (1 + (aggregatedEffect.enemyCritDown - 1) * (1 / 3));
		aggregatedEffect.enemyCritDown = 1;
	}
	
	aggregatedEffect.atkUp = aggregatedEffect.atkUp - 1;
	aggregatedEffect.defUp = aggregatedEffect.defUp - 1;

	return aggregatedEffect;
}

export function getSkillsShortName(data: { items?: ShopItem[], skills: Skill[]; }): { skills?: string | undefined, amulet?: string | undefined; } {
	const dataSkills = data.skills?.length ? "[" + data.skills.map((x) => (skills.find((y) => x.name === y.name) ?? x).short).join("") + "]" : undefined;
	const amulet = data.items?.filter((x) => x.type === "amulet").length ? data.items?.filter((x) => x.type === "amulet")[0] as AmuletItem : undefined;
	const amuletItem = amulet ? [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem : undefined;
	const amuletShort = amuletItem?.short ? "[" + amuletItem.short + "]" : undefined;

	return { skills: dataSkills, amulet: amuletShort };
}

export function countDuplicateSkillNames(skills: { name: string }[]): number {
  // スキル名の出現回数をカウントするためのマップを作成
  const skillCountMap: { [key: string]: number } = {};

  // 各スキル名の出現回数をカウント
  skills.forEach(skill => {
    if (skillCountMap[skill.name]) {
      skillCountMap[skill.name]++;
    } else {
      skillCountMap[skill.name] = 1;
    }
  });

  // 重複しているスキルの数をカウント
  let duplicateCount = 0;
  for (const name in skillCountMap) {
    if (skillCountMap[name] > 1) {
      // 重複している回数全てをカウント
      duplicateCount += skillCountMap[name] - 1;
    }
  }

  return duplicateCount;
}

export function amuletMinusDurability(data: any): string {
	let ret = "";
	if (data.items?.filter((x) => x.type === "amulet").length) {
		const amulet = data.items?.filter((x) => x.type === "amulet")[0] as AmuletItem;
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
		if ((item.isMinusDurability ?? item.isUsed)(data) && (!aggregateTokensEffects(data).normalModeNotUseAmulet || data.raid)) {
			const boost = data.skills ? data.skills?.filter((x) => x.effect?.amuletBoost).reduce((acc, cur) => acc + (cur.effect?.amuletBoost ?? 0), 0) ?? 0 : 0;
			data.items.forEach((x) => {
				if (x.type === "amulet") {
					if (boost <= 0 || Math.random() < (1 / Math.pow(1.5, boost * 2))) {
						const minusCoin = Math.round((x.price ?? 12) / (item.durability ?? 6)) + 1;
						if(aggregateTokensEffects(data).autoRepair && (item.durability ?? 0) >= 2 && x.durability <= 1 && data.coin > minusCoin) {
							data.coin -= minusCoin;
							if (!data.shopExp) data.shopExp = 0;
							data.shopExp += minusCoin;
							ret = `${x.name} もこコイン-${minusCoin}`;
						} else {
							x.durability -= 1;
							if (x.durability <= 0) {
								data.lastBreakItem = amulet.name;
								data.items = data.items?.filter((x) => x.type !== "amulet");
								ret = `${x.name}が壊れました！`;
							} else {
								ret = `${x.name} 残耐久${x.durability}`;
							}
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

export function getTotalEffectString(data: any, skillX = 1): string {

	const showNum = (num: number) => {
		return Math.round(num * 10) / 10;
	}

	data.raid = true

	let skillEffects: SkillEffect;
	if (skillX > 1) {
		skillEffects = aggregateSkillsEffectsSkillX(data, skillX)
	} else {
		skillEffects = aggregateSkillsEffects(data);
	}

	if (!skillEffects) return "";

	/** 使用中の色情報 */
	let color = getColor(data);

	/** 覚醒状態か？*/
	const isSuper = color.alwaysSuper;
	
	let result: string[] = [];
	const resultS: string[] = [];

	let atk = 1;
	let def = 1;
	let spd = 1;
	
	let lAtk = 1;
	let lDef = 1;

	let bAtk = 1;
	let bDef = 1;
	let bSpd = 1;

	let nbAtk = 1;
	let nbDef = 1;

	let eAtk = 1;
	let eDef = 1;

	let itemAtk = 1;
	let itemDef = 1;
	let itemFood = 1;
	let itemResist = 1;


	atk *= 1 + ((skillEffects.atkUp ?? 0) + (data.items?.some((y) => y.type === "amulet") ? 0 : (skillEffects.noAmuletAtkUp ?? 0)))
	atk *= (1 + (data.atkMedal ?? 0) * 0.01)

	def *= 1 + (skillEffects.defUp ?? 0);

	lAtk = atk;
	lDef = def;

	if (isSuper) {
		if (!aggregateTokensEffects(data).notSuperSpeedUp) spd *= 1.2;
		if (aggregateTokensEffects(data).redMode) {
			skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + 0.08
			skillEffects.critDmgUp = Math.max((skillEffects.critDmgUp ?? 0), 0.35)
		} else if (aggregateTokensEffects(data).blueMode) {
			skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.2
		} else if (aggregateTokensEffects(data).yellowMode) {
			spd *= 1.1;
			skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.1
		} else if (aggregateTokensEffects(data).greenMode) {
			skillEffects.itemEquip = (skillEffects.itemEquip ?? 0) + 0.1;
			skillEffects.itemBoost = (skillEffects.itemBoost ?? 0) + 0.1;
			skillEffects.mindMinusAvoid = (skillEffects.mindMinusAvoid ?? 0) + 0.1;
			skillEffects.poisonAvoid = (skillEffects.poisonAvoid ?? 0) + 0.1;
		}
		if (aggregateTokensEffects(data).hyperMode) {
			skillEffects.postXUp = (skillEffects.postXUp ?? 0) + 0.005
			resultS.push("覚醒投稿数ボーナス: 無効");
		}
	}

	if (skillEffects.postXUp) {
		atk *= (1 + (skillEffects.postXUp ?? 0) * 10)
		def *= (1 + (skillEffects.postXUp ?? 0) * 10)
	}

	if (skillEffects.heavenOrHell) {
		atk = atk * (1 + skillEffects.heavenOrHell);
		def = def * (1 + skillEffects.heavenOrHell);
		lAtk *= 1 / (1 + skillEffects.heavenOrHell)
		lDef *= 1 / (1 + skillEffects.heavenOrHell)
	}

	if (skillEffects.sevenFever) {
		const bonus = 7 * (skillEffects.sevenFever ?? 1);
		atk *= (1 + (bonus / 100));
		def *= (1 + (bonus / 100));
	}

	if (skillEffects.spdUp) {
		bSpd *= 1 + (skillEffects.spdUp ?? 0);
		nbAtk *= 1 + (skillEffects.spdUp ?? 0);
	}

	if (skillEffects.notBattleBonusAtk) {
		nbAtk *= (1 + (skillEffects.notBattleBonusAtk ?? 0));
	}

	if (skillEffects.notBattleBonusDef) {
		nbDef *= (1 + (skillEffects.notBattleBonusDef ?? 0));
	}

	if (skillEffects.enemyStatusBonus) {
		const bonus = Math.floor(10 * skillEffects.enemyStatusBonus);
		atk *= (1 + (bonus / 100));
		def *= (1 + (bonus / 100));
	}

	if (skillEffects.arpen) {
		const enemyMinDef = eDef * 0.4
		const arpenX = 1 - (1 / (1 + (skillEffects.arpen ?? 0)));
		eDef -= eDef * arpenX;
		if (eDef < enemyMinDef) eDef = enemyMinDef;
	}

	if (skillEffects.plusActionX) {
		atk *= (1 + (skillEffects.plusActionX ?? 0) / 10);
	}

	if (skillEffects.enemyCritDmgDown) {
		def *= (1 + (skillEffects.enemyCritDmgDown ?? 0) / 30);
	}

	if (skillEffects.enemyBuff) {
		atk *= (1 + (skillEffects.enemyBuff ?? 0) / 20);
		def *= (1 + (skillEffects.enemyBuff ?? 0) / 20);
	}

	if (skillEffects.berserk) {
		resultS.push("毎ターン体力減少: "+ showNum(skillEffects.berserk * 100) + "%");
		atk *= (1 + (skillEffects.berserk ?? 0) * 1.6);
	}

	if (skillEffects.weak) {
		const enemyMinDef = eDef * 0.4
		const weakX = 1 - (1 / (1 + ((skillEffects.weak * 1.125))))
		eAtk -= eAtk * weakX;
		eDef -= eDef * weakX;
		if (eAtk < 0) eAtk = 0;
		if (eDef < enemyMinDef) eDef = enemyMinDef;
	}

	if (skillEffects.dart) {
		resultS.push("ターン内最大ダメージ: +"+ showNum(skillEffects.dart * 100) + "%");
		atk *= (1 + skillEffects.dart * 0.5);
	}

	if (skillEffects.abortDown) {
		resultS.push("連続攻撃中断回避率: +"+ showNum(skillEffects.abortDown * 100) + "%");
		atk *= (1 + skillEffects.abortDown * (1 / 3));
	}

	if (skillEffects.allForOne) {
		atk *= (1 + (skillEffects.allForOne ?? 0) * 0.1);
		lAtk *= (1 + (skillEffects.allForOne ?? 0) * 0.1);
	}
	

	if (skillEffects.ice) {
		resultS.push("戦闘時凍結率: "+ showNum(skillEffects.ice * 100) + "%");
		nbDef *= 1 + (skillEffects.ice ?? 0);
	}

	if (skillEffects.light) {
		resultS.push("戦闘時被ダメージ半減率: "+ showNum(skillEffects.light * 100) + "%");
		nbDef *= 1 + (skillEffects.light ?? 0) * 0.5;
	}

	if (skillEffects.dark) {
		resultS.push("戦闘時行動回数低下率: "+ showNum((skillEffects.dark ?? 0) * 2 * 100) + "%");
		resultS.push("戦闘時固定ダメージ付与率: "+ showNum((skillEffects.dark ?? 0) * 100) + "%");
		nbDef *= 1 + (skillEffects.dark ?? 0) * 0.3;
	}

	let lAtkText = "";
	let lDefText = "";

	atk -= 1
	lAtk -= 1
	if (lAtk !== atk) {
		if (lAtk >= 0) {
			lAtkText = "+" + showNum(lAtk * 100) + "% ～ ";
		} else {
			lAtkText = showNum(lAtk * 100) + "% ～ ";
		}
	}
	if (atk) {
		if (atk >= 0) {
			result.push("パワー: " + lAtkText + "+" + showNum(atk * 100) + "%");
		} else {
			result.push("パワー: " + lAtkText + showNum(atk * 100) + "%");
		}
	}
	bAtk -= 1
	if (bAtk) {
		if (bAtk >= 0) {
			result.push("戦闘時パワー: +" + showNum(bAtk * 100) + "%");
		} else {
			result.push("戦闘時パワー: " + showNum(bAtk * 100) + "%");
		}
	}
	nbAtk -= 1
	if (nbAtk) {
		if (nbAtk >= 0) {
			result.push("非戦闘時パワー: +" + showNum(nbAtk * 100) + "%");
		} else {
			result.push("非戦闘時パワー: " + showNum(nbAtk * 100) + "%");
		}
	}
	if (skillEffects.fire) {
		result.push("非戦闘時パワー: +" + showNum(data.lv * 3.75 * skillEffects.fire));
	}
	def -= 1
	lDef -= 1
	if (lDef !== def) {
		if (lDef >= 0) {
			lDefText = "+" + showNum(lDef * 100) + "% ～ ";
		} else {
			lDefText = showNum(lDef * 100) + "% ～ ";
		}
	}
	if (def) {
		result.push("防御: " + lDefText + "+" + showNum(def * 100) + "%");
	}
	bDef -= 1
	if (bDef) {
		result.push("戦闘時防御: +" + showNum(bDef * 100) + "%");
	}
	nbDef -= 1
	if (nbDef) {
		result.push("非戦闘時防御: +" + showNum(nbDef * 100) + "%");
	}
	if (color.reverseStatus) {
		result.push("パワー・防御 ステータス逆転");
	}
	spd -= 1
	if (spd) {
		result.push("行動回数: +" + (showNum(spd * 100)) + "%");
	}
	bSpd -= 1
	if (bSpd) {
		result.push("戦闘時行動回数: +" + showNum(bSpd * 100) + "%");
	}
	if (skillEffects.allForOne || aggregateTokensEffects(data).allForOne) {
		result.push("行動回数圧縮状態");
	}
	if (data.defMedal) {
		result.push("最大体力: +" + showNum((data.defMedal ?? 0) * 13.4));
	}
	if (skillEffects.endureUp) {
		result.push(`気合: +${showNum(skillEffects.endureUp * 100)}%`);
	}
	eAtk -= 1
	if (eAtk) {
		result.push("敵パワー減少: " + showNum(eAtk * 100) + "%")
	}
	eDef -= 1
	if (eDef) {
		result.push("敵防御減少: " + showNum(eDef * 100) + "%")
	}

	const atkMinusMin = skillEffects.atkDmgUp && skillEffects.atkDmgUp < 0 ? (1 / (-1 + (skillEffects.atkDmgUp ?? 0)) * -1) : 1;
	let dmgBonus = ((Math.max(1 + (skillEffects.atkDmgUp ?? 0), atkMinusMin)) * 1) * (1 + ((skillEffects.thunder ?? 0) * 0.1));

	const defMinusMin = skillEffects.defDmgUp && skillEffects.defDmgUp < 0 ? (1 / (-1 + (skillEffects.defDmgUp ?? 0)) * -1) : 1;
	let defDmgX = (Math.max(1 + (skillEffects.defDmgUp ?? 0), defMinusMin));

	dmgBonus -= 1
	if (dmgBonus) {
		if (dmgBonus > 0) {
			result.push("与ダメージ増加: " + showNum(dmgBonus * 100) + "%")
		} else {
			result.push("与ダメージ減少: " + showNum(dmgBonus * -100) + "%")
		}
	}
	
	if (skillEffects.haisuiAtkUp) {
		result.push("覚悟与ダメージ増加: +" + showNum((skillEffects.haisuiAtkUp ?? 0) * 100) + "%");
	}

	const atkMinRnd = Math.max(0.2 + (skillEffects.atkRndMin ?? 0), 0);
	const atkMaxRnd = Math.max(1.6 + (skillEffects.atkRndMax ?? 0), 0);
	const defMinRnd = Math.max(0.2 + (skillEffects.defRndMin ?? 0), 0);
	const defMaxRnd = Math.max(1.6 + (skillEffects.defRndMax ?? 0), 0);

	if (skillEffects.notRandom || aggregateTokensEffects(data).notRandom) {
		result.push("与ダメージ乱数固定: " + showNum((atkMinRnd + atkMinRnd + atkMaxRnd) * 100) * (0.5 + (skillEffects.notRandom ?? 0) * 0.05) + "%")
	} else {
		if (atkMinRnd !== 0.2 || atkMaxRnd !== 1.6) {
			result.push("与ダメージ乱数幅: " + showNum(atkMinRnd * 100) + "% ～ " + showNum((atkMinRnd + atkMaxRnd) * 100) + "%")
		}
	}

	if (skillEffects.fire) {
		result.push("戦闘時ダメージ追加: +" + Math.ceil(Math.min(data.lv, 255) * skillEffects.fire));
	}

	defDmgX -= 1
	if (defDmgX) {
		if (defDmgX > 0) {
			result.push("被ダメージ増加: " + showNum(defDmgX * 100) + "%")
		} else {
			result.push("被ダメージ軽減: " + showNum(defDmgX * -100) + "%")
		}
	}
	
	if (skillEffects.firstTurnResist) {
		if (skillEffects.firstTurnResist > 1) {
			result.push("ターン1ダメージ無効");
			result.push("ターン2ダメージ軽減: " + showNum((skillEffects.firstTurnResist - 1) * 100) + "%")
		} else {
			result.push("ターン1ダメージ軽減: " + showNum((skillEffects.firstTurnResist) * 100) + "%")
		}
	}
	if (skillEffects.tenacious) {
		if (skillEffects.tenacious > 0.9) {
			result.push("ピンチダメージ軽減: 最大90%")
			result.push("（体力" +  showNum((1 - (0.9 / skillEffects.tenacious)) * 100) + "%で効果最大）")
		} else {
			result.push("ピンチダメージ軽減: 最大" + showNum((skillEffects.tenacious) * 100) + "%")
		}
	}

	if (defMinRnd !== 0.2 || defMaxRnd !== 1.6) {
		result.push("被ダメージ乱数幅: " + showNum(defMinRnd * 100) + "% ～ " + showNum((defMinRnd + defMaxRnd) * 100) + "%")
	}
	
	if (skillEffects.critUp) {
		result.push("クリティカル率（割合）: +" + showNum((skillEffects.critUp ?? 0) * 100) + "%");
	}
	if (skillEffects.haisuiCritUp) {
		result.push("覚悟クリティカル率（割合）: +" + showNum((skillEffects.haisuiCritUp ?? 0) * 100) + "%");
	}
	if (skillEffects.critUpFixed) {
		result.push("クリティカル率（固定）: +" + showNum((skillEffects.critUpFixed ?? 0) * 100) + "%");
	}
	if (skillEffects.critDmgUp) {
		result.push("クリティカルダメージ: +" + showNum((skillEffects.critDmgUp ?? 0) * 100) + "%");
	}
	if (skillEffects.enemyCritDown) {
		result.push("敵クリティカル率: -" + showNum(((skillEffects.enemyCritDown ?? 0)) * 100) + "%");
	}
	if (skillEffects.enemyCritDmgDown) {
		result.push("敵クリティカルダメージ: -" + showNum(((skillEffects.enemyCritDmgDown ?? 0)) * 100) + "%");
	}
	if (skillEffects.haisuiUp) {
		result.push("決死の覚悟効果量: +" + showNum(((skillEffects.haisuiUp ?? 0)) * 100) + "%");
		result.push("決死の覚悟発動体力: " + showNum(((1 / 7) * (1 + (skillEffects.haisuiUp ?? 0)) * 100)) + "%以下");
	}
	if (skillEffects.finalAttackUp) {
		result.push("全力の一撃ダメージ: +" + showNum((skillEffects.finalAttackUp ?? 0) * 100) + "%");
	}
	if (skillEffects.guardAtkUp) {
		result.push(`がまんパワーアップ${(skillEffects.guardAtkUp ?? 0) > 1 ? ` ×${showNum((skillEffects.guardAtkUp ?? 0))}` : ""}`);
	}
	if (skillEffects.firstTurnItem) {
		result.push("ターン1アイテム装備");
	}
	if (skillEffects.itemEquip) {
		result.push("アイテム装備率: +" + showNum((skillEffects.itemEquip ?? 0) * 100) + "%");
	}
	if (skillEffects.weaponSelect) {
		result.push("武器選択率: +" + showNum((skillEffects.weaponSelect ?? 0) * 100) + "%");
	}
	if (skillEffects.armorSelect) {
		result.push("防具選択率: +" + showNum((skillEffects.armorSelect ?? 0) * 100) + "%");
	}
	if (skillEffects.foodSelect) {
		result.push("食べ物選択率: +" + showNum((skillEffects.foodSelect ?? 0) * 100) + "%");
	}
	if (skillEffects.poisonAvoid) {
		result.push("毒食べ物回避率: " + showNum((skillEffects.poisonAvoid ?? 0) * 100) + "%");
	}
	if (skillEffects.poisonAvoid) {
		result.push("悪アイテム回避率: +" + showNum((skillEffects.mindMinusAvoid ?? 0) * 100) + "%");
	}

	itemAtk = (1 + (skillEffects.itemBoost ?? 0)) * (1 + (skillEffects.weaponBoost ?? 0));
	itemDef = (1 + (skillEffects.itemBoost ?? 0)) * (1 + (skillEffects.armorBoost ?? 0));
	itemFood = (1 + (skillEffects.itemBoost ?? 0)) * (1 + (skillEffects.foodBoost ?? 0));
	itemResist = itemResist / (1 + (skillEffects.itemBoost ?? 0));
	itemResist = itemResist / (1 + (skillEffects.poisonResist ?? 0));
	if (isSuper && !aggregateTokensEffects(data).redMode) itemResist = itemResist / 2

	itemAtk -= 1
	if (itemAtk) {
		result.push("武器効果量: +" + showNum(itemAtk * 100) + "%");
	}
	itemDef -= 1
	if (itemDef) {
		result.push("防具効果量: +" + showNum(itemDef * 100) + "%");
	}
	itemFood -= 1
	if (itemFood) {
		result.push("食べ物効果量: +" + showNum(itemFood * 100) + "%");
	}
	itemResist -= 1
	if (itemResist) {
		result.push("毒効果量軽減: " + showNum(itemResist * -100) + "%");
	}
	if (skillEffects.itemBoost) {
		result.push("アイテム気合上昇率: +" + showNum((skillEffects.itemBoost ?? 0) * 100) + "%");
	}
	if (skillEffects.itemBoost || isSuper) {
		result.push("アイテム気合低下率: -" + showNum((1 - (1 / (1 + (skillEffects.itemBoost ?? 0))) * (isSuper ? 0.5 : 1)) * 100) + "%");
	}
	if (skillEffects.lowHpFood) {
		result.push("残体力依存食べ物選択");
	}
	result = [...result, ...resultS];
	if (skillEffects.sevenFever) {
		result.push("与ダメージ７の倍数化");
		result.push(`７ステータスダメージ軽減${skillEffects.sevenFever != 1 ? ` ×${showNum(skillEffects.sevenFever)}` : ""}`);
	}
	if (skillEffects.escape) {
		result.push(`負けそうな時逃げる${skillEffects.escape != 1 ? ` ×${showNum(skillEffects.escape)}` : ""}`);
	}
	if (skillEffects.charge) {
		result.push(`不運チャージ${skillEffects.charge != 1 ? ` ×${showNum(skillEffects.charge)}` : ""}`);
	}
	if (aggregateTokensEffects(data).fivespd) {
		result.push("最低行動回数保障: 5");
	}
	if (skillEffects.fortuneEffect || aggregateTokensEffects(data).fortuneEffect) {
		result.push(`ランダムステータス${(skillEffects.fortuneEffect ?? 0) !== 1 ? (skillEffects.fortuneEffect ?? 0) > 1 ? ` ×${showNum((skillEffects.fortuneEffect ?? 0))}` : `: ${showNum((skillEffects.fortuneEffect ?? 0))}` : ""}`);
	}
	if (skillEffects.slowStart) {
		result.push(`スロースタート${(skillEffects.slowStart ?? 0) != 1 ? ` ×${showNum(skillEffects.slowStart)}` : ""}`);
	}
	if (skillEffects.plusActionX) {
		result.push("通常時RPG進行数: ×" + (showNum(skillEffects.plusActionX ?? 0) + 1));
	}
	const boost = data.skills ? data.skills?.filter((x) => x.effect?.amuletBoost).reduce((acc, cur) => acc + (cur.effect?.amuletBoost ?? 0), 0) ?? 0 : 0;
	if (boost) {
		result.push("お守り耐久減少率: " + showNum((1 / Math.pow(1.5, boost * 2)) * 100) + "%");
	}
	if (skillEffects.priceOff) {
		result.push("ショップ割引率: " + showNum((skillEffects.priceOff ?? 0) * 100) + "%");
	}

	const totalAtk = (1 + atk) * Math.max((1 + bAtk), (1 + nbAtk)) * (1 + (skillEffects.haisuiAtkUp ?? 0)) *
	 (1 + spd) *  (1 + bSpd) * (1 / (1 + eDef)) * (1 + dmgBonus) * 
	 (((atkMinRnd + atkMinRnd + atkMaxRnd)) * (0.5 + (skillEffects.notRandom ?? 0) * 0.05)) *
	 (1 + ((skillEffects.critUpFixed ?? 0) * (1 + (skillEffects.critDmgUp ?? 0) * 2))) *
	 ( 
		1 +
		(0.25 * (1 + (skillEffects.critUp ?? 0)) * (1 + (skillEffects.haisuiCritUp ?? 0)) * (1 + (skillEffects.critDmgUp ?? 0) * 2)) - 
		(0.25 * (1 + (skillEffects.critDmgUp ?? 0) * 2))
	 ) *
	 (1 + ((skillEffects.finalAttackUp ?? 0) / 7)) *
	 (1 + (Math.min(0.4 * (skillEffects.itemEquip ?? 0) + (skillEffects.firstTurnItem ? (1/6) : 0), 1) * ((1 + (skillEffects.weaponSelect ?? 0)) / (4 + (skillEffects.weaponSelect ?? 0) - (skillEffects.poisonAvoid ?? 0))) * (0.25 * (1 + itemAtk))))

	if (totalAtk > 1) {
		result.push("")
		result.push("合計攻撃効果（最大）: +" + showNum((totalAtk - 1) * 100) + "%");
	}

	const totalDef = (1 / (1 + def)) * (1 / Math.max((1 + bDef), (1 + nbDef))) *
	(1 + eAtk) * (1 + defDmgX) *
	((defMinRnd + defMinRnd + defMaxRnd) / 2) *
	(1 / (1 + (data.defMedal ?? 0) * 13.4 / 865)) *
	Math.max(1 - ((skillEffects.firstTurnResist ?? 0) / 7), (5/7)) *
	Math.max(1 - ((skillEffects.tenacious ?? 0) / 2), 0.1) *
	(1 - (skillEffects.ice ?? 0)) *
	(1 - ((skillEffects.light ?? 0) / 2)) *
	(1 / (1 + (Math.min(0.4 * (skillEffects.itemEquip ?? 0) + (skillEffects.firstTurnItem ? (1/6) : 0), 1) * ((1 + (skillEffects.armorSelect ?? 0) + (skillEffects.foodSelect ?? 0)) / (4 + (skillEffects.armorSelect ?? 0) + (skillEffects.foodSelect ?? 0) - (skillEffects.poisonAvoid ?? 0))) * ((0.25 * (1 + itemDef)) + 0.25 * (1 + itemFood)))))

	if (totalDef < 1) {
		if (totalAtk <= 1) result.push("")
		result.push("合計防御効果（平均）: " + showNum((1 - totalDef) * 100) + "%");
	}

	data.raid = false

	return result.join("\n");
}

import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import { colors, enhanceCount } from './colors';
import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';
import { skillNameCountMap, totalSkillCount, skills, SkillEffect, skillCalculate, Skill, skillPower, aggregateSkillsEffects, countDuplicateSkillNames, ultimateAmulet } from './skills';
import { getVal, initializeData, deepClone, numberCharConvert } from './utils';
import 藍 from '@/ai';
import rpg from './index';
import { aggregateTokensEffects, AmuletItem, BaseItem, Item, mergeSkillAmulet, ShopItem, TokenItem } from "./shop";
import config from "@/config";

export const skillPrice = (_ai: 藍, skillName: Skill["name"], rnd: () => number) => {
	const skillP = skillPower(_ai, skillName);
	const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique);
	const skill = skills.find((x) => x.name === skillName);

	// totalSkillCountにfilteredSkillsのnameに含まれるskillP.skillNameCountMapに含まれる値の合計を代入
	const totalSkillCount = filteredSkills.reduce((acc, skill) => acc + (skillP.skillNameCountMap.get(skill.name) || 0), 0);

	const price = Math.max(
		Math.floor(
			((skill?.unique ? 18 : 12) * (skill?.notLearn ? 2.5 : (Math.max(isNaN(skillP.skillNameCount) ? 0 : skillP.skillNameCount, 0.5) / (totalSkillCount / filteredSkills.length)))) ** 2
		), 100
	);

	const rand = rnd();
	return rand < 0.1 ? Math.floor(price * 0.5)
		: rand < 0.2 ? Math.floor(price * 0.75)
			: rand < 0.7 ? Math.floor(price * 1)
				: rand < 0.8 ? Math.floor(price * 1.25)
					: rand < 0.9 ? Math.floor(price * 1.5)
						: 12 * 12;
};

const resetCantRerollSkill = (data) => {
	const totalStatus = data.lv * 7.6;
	const atkPercent = data.atk / (data.atk + data.def);

	data.atk = Math.round(totalStatus * atkPercent);
	data.def = Math.round(totalStatus * (1 - atkPercent));

	for (let i = 0; i < data.skills.length; i++) {
		if (skills[i].cantReroll) {
			data.skills[i] = skills.find((x) => x.name === "伝説");
		}
	}
}
//limit: (data) => !data.items.filter((x) => x.name === "平常心のお札").length && !data.bankItems?.filter((x) => x === "平常心のお札").length,
const canBankItems: ShopItem[] = [
	{ name: `修繕の札`, price: 500, limit: (data) => enhanceCount(data) >= 9, desc: `持っているとお守りが壊れなくなりますが、本来壊れるタイミングでもこコインを消費します 1回につき減少するコイン数はお守りの購入額/耐久+1です ただし、最大耐久が2以上あるお守りにしか効果を発揮しません`, type: "token", effect: { autoRepair: true }, always: true } as TokenItem,
	{ name: `乱数透視の札`, price: 50, desc: `所持している間、ダメージの乱数が表示されるようになります`, type: "token", effect: { showRandom: true }, always: true } as TokenItem,
	{ name: `平常心のお札`, price: 50, desc: `どれだけ体力が低くても決死の覚悟をしなくなる`, type: "token", effect: { notLastPower: true }, always: true } as TokenItem,
	{ name: `温存のお札`, price: 50, desc: `レイドボス以外でお守りを使わないようになる`, type: "token", effect: { normalModeNotUseAmulet: true }, always: true } as TokenItem,
	{ name: `全身全霊のお札`, price: 300, desc: `持っていると常に行動回数が1回になるが、すごく重い一撃を放てる`, type: "token", effect: { allForOne: true }, always: true } as TokenItem,
	{ name: `運命不変のお札`, price: 300, desc: `持っていると常に与ダメージがランダム変化しなくなる`, type: "token", effect: { notRandom: true }, always: true } as TokenItem,
	{ name: `しあわせのお札`, price: 300, desc: `レイド時、常にステータスの割合がランダムに一時的に変化する`, type: "token", effect: { fortuneEffect: true }, always: true } as TokenItem,
	{ name: `超覚醒の札`, price: 50, desc: `持っていると覚醒時の投稿数増加ボーナスを失いますが、投稿数による効果が10%上がります`, type: "token", effect: { hyperMode: true }, always: true } as TokenItem,
	{ name: `覚醒変更の札（朱）`, price: 50, desc: `覚醒時の行動回数増加と毒アイテム効果軽減を失いますが、代わりにクリティカルダメージが+35%以下の場合、+35%になり、クリティカル率（固定）+8%を得るようになります 4色のうちどれか1つしか発動しません`, type: "token", effect: { notSuperSpeedUp: true, redMode: true }, always: true } as TokenItem,
	{ name: `覚醒変更の札（橙）`, price: 50, desc: `覚醒時の行動回数増加が半減しますが、代わりにダメージカット+10%を得るようになります 4色のうちどれか1つしか発動しません`, type: "token", effect: { notSuperSpeedUp: true, yellowMode: true }, always: true } as TokenItem,
	{ name: `覚醒変更の札（蒼）`, price: 50, desc: `覚醒時の行動回数増加を失いますが、代わりにダメージカット+20%を得るようになります 4色のうちどれか1つしか発動しません`, type: "token", effect: { notSuperSpeedUp: true, blueMode: true }, always: true } as TokenItem,
	{ name: `覚醒変更の札（翠）`, price: 50, desc: `覚醒時の行動回数増加を失いますが、代わりに全ての道具効果+15%を得るようになります 4色のうちどれか1つしか発動しません`, type: "token", effect: { notSuperSpeedUp: true, greenMode: true }, always: true } as TokenItem,
]

const bankItemsDesc2 = {
	"乱数透視の札": "ダメージの乱数が表示されなくなる",
	"平常心のお札": "体力が低くなると決死の覚悟をするようになる",
	"温存のお札": "レイドボス以外でもお守りを使うようになる",
	"全身全霊のお札": "複数回行動するようになるが、一撃は軽くなる",
	"運命不変のお札": "与ダメージがランダム変化するようになる",
	"しあわせのお札": "ステータスの割合がランダムに一時的に変化しなくなる",
	"超覚醒の札": "覚醒時の投稿数増加ボーナスを得られますが、投稿数効果上昇を失います",
	"修繕の札": "通常通りお守りが壊れるようになります",
	"覚醒変更の札（朱）": "覚醒時の効果が行動回数増加・毒アイテム効果軽減に戻ります",
	"覚醒変更の札（橙）": "覚醒時の効果が行動回数増加に戻ります",
	"覚醒変更の札（蒼）": "覚醒時の効果が行動回数増加に戻ります",
	"覚醒変更の札（翠）": "覚醒時の効果が行動回数増加に戻ります",
}

export const shop2Items: ShopItem[] = [
	...skills.filter((x) => x.name === "分散型").map((x): Item => ({ name: `${x.name}の教本`, limit: (data) => !data.freeDistributed && !data.nextSkill && countDuplicateSkillNames(data.skills) === 0 && data.skills.every((x) => x.name !== "分散型"), price: (data, rnd, ai) => 1, desc: `購入すると次のスキル変更時に必ず「${x.name}」${x.desc ? `（${x.desc}）` : ""}を習得できる（複製時は対象外）`, type: "item", effect: (data) => { data.freeDistributed = true; data.nextSkill = x.name }, always: true })),
	...skills.filter((x) => x.name === "分散型").map((x): Item => ({ name: `${x.name}の教本`, limit: (data) => data.freeDistributed && !data.nextSkill && countDuplicateSkillNames(data.skills) === 0 && data.skills.every((x) => x.name !== "分散型"), price: (data, rnd, ai) => skillPrice(ai, x.name, rnd), desc: `購入すると次のスキル変更時に必ず「${x.name}」${x.desc ? `（${x.desc}）` : ""}を習得できる（複製時は対象外）`, type: "item", effect: (data) => { data.nextSkill = x.name }, always: true })),
	{ name: `お守りを捨てる`, limit: (data) => data.items.filter((x) => x.type === "amulet").length, price: 0, desc: `今所持しているお守りを捨てます`, type: "item", effect: (data) => data.items = data.items?.filter((x) => x.type !== "amulet"), always: true },
	{ name: `教本を捨てる`, limit: (data) => data.nextSkill, price: 0, desc: `今所持している教本を捨てます`, type: "item", effect: (data) => data.nextSkill = null, always: true },
	{ name: `行動加速のお札`, limit: (data) => (data.maxSpd ?? 0) < 5 && !data.items.filter((x) => x.name === "行動加速のお札").length, price: (data) => 370 - (data.maxSpd ?? 0) * 70, desc: `持っていると${config.rpgHeroName}の懐き度に関係なく最低5回行動できるようになる`, type: "token", effect: { fivespd: true }, always: true } as TokenItem,
	ultimateAmulet,
	{ name: "スキル複製珠", desc: "スキルを変更し、既に覚えているスキルのどれかを1つ覚えます", price: 6, orb: true, type: "item", effect: (data) => data.duplicationOrb = (data.duplicationOrb ?? 0) + 1, infinite: true, always: true },
	{ name: `苦労のお守り`, limit: (data) => data.allClear && data.streak > 0, price: 1, desc: `持っていると通常モードの敵が強くなります 耐久1 敗北時耐久減少`, type: "amulet", effect: { enemyBuff: 1 }, durability: 1, short: "苦", isUsed: (data) => true, isMinusDurability: (data) => data.streak < 1, always: true } as AmuletItem,
	...(canBankItems.map((x) => ({...x, limit: (data) => !data.items.filter((y) => y.name === x.name).length && !data.bankItems?.filter((y) => y === x.name).length && (!x.limit || x.limit(data, () => 0))})) as TokenItem[]),
	...(canBankItems.map((x) => ({...x, price: 1, limit: (data) => !data.items.filter((y) => y.name === x.name).length && data.bankItems?.filter((y) => y === x.name).length && (!x.limit || x.limit(data, () => 0))})) as TokenItem[]),
	...(canBankItems.map((x) => ({...x, name:x.name + "を預ける", price: 0, type: "item", desc: bankItemsDesc2[x.name], effect: (data) => { data.bankItems = Array.from(new Set([...(data.bankItems ?? []), x.name])); data.items = data.items.filter((y) => y.name !== x.name) }, limit: (data) => data.items.filter((y) => y.name === x.name).length && (!x.limit || x.limit(data, () => 0))})) as Item[]),
	{ name: `浄化の水晶`, limit: (data) => data.skills.filter((x) => x.cantReroll).length, price: 5, desc: `${config.rpgHeroName}が持っている変更不可のスキルを変更可能なスキルに置き換えます ただしステータスが変動する可能性があります`, type: "item", effect: resetCantRerollSkill, always: true },
  { name: "力の種", limit: (data) => ((10 - (data.atk % 10) + 7) % 10) === 0 || ((data.def % 10 - 7 + 10) % 10) === 0, desc: "購入時、パワー+1 防御-1", price: 1, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1; data.def = (data.def ?? 0) - 1; }, infinite: true, always: true },
	{ name: "幸運の力の種", limit: (data) => ((10 - (data.atk % 10) + 7) % 10) !== 0, desc: "購入時、パワーの下1桁が7になるように防御から移動", price: (data) => ((10 - (data.atk % 10) + 7) % 10), type: "item", effect: (data) => { data.def = (data.def ?? 0) - ((10 - (data.atk % 10) + 7) % 10); data.atk = (data.atk ?? 0) + ((10 - (data.atk % 10) + 7) % 10); }, infinite: true, always: true },
	{ name: "幸運の力の種A", limit: (data) => ((data.def % 10 - 7 + 10) % 10) !== 0, desc: "購入時、防御の下1桁が7になるように防御から移動", price: (data) => ((data.def % 10 - 7 + 10) % 10), type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + ((data.def % 10 - 7 + 10) % 10); data.def = (data.def ?? 0) - ((data.def % 10 - 7 + 10) % 10); }, infinite: true, always: true },
	{ name: "高級力の種", desc: "購入時、防御2%をパワーに移動", price: 5, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) / 50)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) / 50)); }, infinite: true, always: true },
	{ name: "超・力の種", desc: "購入時、防御10%をパワーに移動", price: 10, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) / 10)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) / 10)); }, infinite: true, always: true },
	{ name: "極・力の種", desc: "購入時、防御30%をパワーに移動", price: 10, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) * 0.3)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) * 0.3)); }, infinite: true, always: true },
  { name: "守りの種", limit: (data) => ((10 - (data.def % 10) + 7) % 10) === 0 || ((data.atk % 10 - 7 + 10) % 10) === 0, desc: "購入時、防御+1 パワー-1", price: 1, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) - 1; data.def = (data.def ?? 0) + 1; }, infinite: true, always: true },
	{ name: "幸運の守りの種", limit: (data) => ((10 - (data.def % 10) + 7) % 10) !== 0, desc: "購入時、防御の下1桁が7になるようにパワーから移動", price: (data) => ((10 - (data.def % 10) + 7) % 10), type: "item", effect: (data) => { data.atk = (data.atk ?? 0) - ((10 - (data.def % 10) + 7) % 10); data.def = (data.def ?? 0) + ((10 - (data.def % 10) + 7) % 10); }, infinite: true, always: true },
	{ name: "幸運の守りの種A", limit: (data) => ((data.atk % 10 - 7 + 10) % 10) !== 0, desc: "購入時、パワーの下1桁が7になるようにパワーから移動", price: (data) => ((data.atk % 10 - 7 + 10) % 10), type: "item", effect: (data) => { data.def = (data.def ?? 0) + ((data.atk % 10 - 7 + 10) % 10); data.atk = (data.atk ?? 0) - ((data.atk % 10 - 7 + 10) % 10); }, infinite: true, always: true },
	{ name: "高級守りの種", desc: "購入時、パワー2%を防御に移動", price: 5, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) / 50)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) / 50)); }, infinite: true, always: true },
	{ name: "超・守りの種", desc: "購入時、パワー10%を防御に移動", price: 10, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) / 10)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) / 10)); }, infinite: true, always: true },
	{ name: "極・守りの種", desc: "購入時、パワー30%を防御に移動", price: 10, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) * 0.3)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) * 0.3)); }, infinite: true, always: true },
	{ name: "赤の勲章", limit: (data) => (data.atkMedal ?? 0) < 10, desc: "1つ購入する度に恒久的にパワーが+1% 1種類につき10個まで購入できます", price: (data) => 20 * (1 + Math.floor((data.atkMedal ?? 0) / 2)), orb: true, type: "item", effect: (data) => data.atkMedal = (data.atkMedal ?? 0) + 1, infinite: true, always: true },
	{ name: "青の勲章", limit: (data) => (data.defMedal ?? 0) < 10, desc: "1つ購入する度に恒久的に最大体力が+1.5% 1種類につき10個まで購入できます", price: (data) => 20 * (1 + Math.floor((data.defMedal ?? 0) / 2)), orb: true, type: "item", effect: (data) => data.defMedal = (data.defMedal ?? 0) + 1, infinite: true, always: true },
	{ name: "緑の勲章", limit: (data) => (data.itemMedal ?? 0) < 10, desc: "1つ購入する度に恒久的に全ての道具効果（装備率、効果量、悪・毒アイテム回避）が+1% 1種類につき10個まで購入できます", price: (data) => 20 * (1 + Math.floor((data.itemMedal ?? 0) / 2)), orb: true, type: "item", effect: (data) => data.itemMedal = (data.itemMedal ?? 0) + 1, infinite: true, always: true },
	{ name: `${config.rpgCoinName}(70枚)`, limit: (data) => (data.atkMedal ?? 0) + (data.defMedal ?? 0) + (data.itemMedal ?? 0) >= 30, desc: "ショップでのアイテム購入などに使用できる通貨です", price: 20, orb: true, type: "item", effect: (data) => data.coin = (data.coin ?? 0) + 70, infinite: true, always: true },
	{ name: `壺`, limit: (data) => data.lv >= 20 && (data.jar ?? 0) === 0, price: 200, desc: `なんかいい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `きれいな壺`, limit: (data) => (data.jar ?? 0) === 1 && data.shopExp > 400, price: 400, desc: `なんかきれいな感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `すごい壺`, limit: (data) => (data.jar ?? 0) === 2 && data.shopExp > 1000, price: 600, desc: `なんかすごい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `巨大な壺`, limit: (data) => (data.jar ?? 0) === 3 && data.shopExp > 1800, price: 800, desc: `なんかめっちゃでかい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `うねうねした壺`, limit: (data) => (data.jar ?? 0) === 4 && data.shopExp > 2800, price: 1000, desc: `なんかうねうねした感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `ナノサイズ壺`, limit: (data) => (data.jar ?? 0) === 5 && data.shopExp > 4000, price: 1200, desc: `小さくて見えない感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `謎の壺`, limit: (data) => (data.jar ?? 0) >= 6 && data.shopExp > 5400, price: (data) => (data.jar ?? 0) * 200, desc: `なんか謎な感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	...skills.filter((x) => !x.notLearn && !x.moveTo && !x.cantReroll).map((x): Item => ({ name: `${x.name}の教本`, limit: (data) => !data.nextSkill && (!x.unique || !data.skills.filter((y) => y.unique).map((y) => y.unique).includes(x.unique)), price: (data, rnd, ai) => skillPrice(ai, x.name, rnd), desc: `購入すると次のスキル変更時に必ず「${x.name}」${x.desc ? `（${x.desc}）` : ""}を習得できる（複製時は対象外）`, type: "item", effect: (data) => { data.nextSkill = x.name } })),
];

export const shop2Reply = async (module: rpg, ai: 藍, msg: Message) => {

	// データを読み込み
	const data = initializeData(module, msg);
	if (!data) return false;
	if (!data.lv) return false;
	if (data.jar == null) data.jar = 0;
	let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
	if (!data.maxSpd || data.maxSpd < spd) data.maxSpd = spd;

	// 所持しているスキル効果を読み込み
	const skillEffects = aggregateSkillsEffects(data);

	let rnd = seedrandom(getDate() + ai.account.id + msg.userId);

	let amuletDelFlg = false;
	if (msg.includes(["お守り"]) && msg.includes(["捨"])) {
		amuletDelFlg = true;
		data.items = data.items?.filter((x) => x.type !== "amulet")
	}

	let filteredShopItems = shop2Items.filter((x) => (!x.limit || x.limit(data, rnd)) && !(x.type === "amulet" && (data.lv < 20 || data.items?.some((y) => y.type === "amulet"))) && !x.always);

	if (data.lastShop2Visited !== getDate() || !data.shop2Items?.length) {

		const getShopItems = () => {
			if (!filteredShopItems?.length) return "";
			const itemName = filteredShopItems[Math.floor(rnd() * filteredShopItems.length)].name;
			filteredShopItems = filteredShopItems.filter((x) => x.name !== itemName);
			return itemName;
		};

		data.shop2Items = [
			getShopItems(),
			getShopItems(),
			getShopItems(),
			getShopItems(),
			getShopItems(),
		].filter(Boolean);
		data.lastShop2Visited = getDate();
		module.unsubscribeReply("shopBuy:" + msg.userId);
	}

	data.shop2Items.forEach((x, index) => {
		if (Array.isArray(x)) data.shop2Items[index] = x.map((x) => x.replace("undefined", ""));
		if (!x.includes("&") || !x.includes("のお守り")) return;
		data.shop2Items[index] = x.replace("のお守り", "").split("&");
	});

	const _shopItems = (data.shop2Items as (string | string[])[]).map((x) => Array.isArray(x) ? mergeSkillAmulet(ai, rnd, x.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y != null) as Skill[]) : shop2Items.find((y) => x === y.name) ?? undefined).filter((x) => x != null) as ShopItem[];

	const showShopItems = _shopItems.filter((x) => (!x.limit || x.limit(data, () => 0)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet"))).concat(shop2Items.filter((x) => (!x.limit || x.limit(data, () => 0)) && !(x.type === "amulet" && data.items?.some((y) => y.type === "amulet")) && x.always)).slice(0, 35)
		.map((x) => {
			let _x = deepClone(x);
			const price = Math.ceil(getVal(x.price, [data, rnd, ai]) * (1 - (skillEffects.priceOff ?? 0)));
			return { ..._x, price };
		});

	const reply = await msg.reply([
		amuletDelFlg ? "\n所持しているお守りを捨てました！" : "",
		serifs.rpg.shop.welcome2(data.coin, data.rerollOrb),
		...showShopItems.map((x, index) => `[${numberCharConvert(index + 1)}] ${x.name} ${x.orb ? "**変更珠** " : ""}${x.price}${x.orb ? "個" : "枚"}${x.type === "amulet" && (x.durability ?? 0) >= 2 && aggregateTokensEffects(data).autoRepair ? ` (コイン/耐久: ${Math.round((x.price ?? 12) / (x.durability ?? 6)) + 1})` : ""}\n${x.desc}\n`)
	].join("\n"), { visibility: "specified" });

	msg.friend.setPerModulesData(module, data);

	module.subscribeReply("shopBuy:" + msg.userId, reply.id, { shopDate: getDate(), showShopItems: showShopItems.map((x) => ({ name: x.name, type: x.type, price: x.price, orb: x.orb || false, ...(x.type === "amulet" ? { durability: x.durability ?? undefined, skillName: x.skillName ?? undefined } : {}) })) });

	return {
		reaction: 'love'
	};

};

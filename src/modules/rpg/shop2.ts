import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import { colors, enhanceCount } from './colors';
import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';
import { skillNameCountMap, totalSkillCount, skills, SkillEffect, skillCalculate, Skill, skillPower, aggregateSkillsEffects } from './skills';
import { getVal, initializeData, deepClone, numberCharConvert } from './utils';
import 藍 from '@/ai';
import rpg from './index';
import { AmuletItem, BaseItem, Item, mergeSkillAmulet, ShopItem, TokenItem } from "./shop";

export const skillPrice = (_ai: 藍, skillName: Skill["name"], rnd: () => number) => {
	const skillP = skillPower(_ai, skillName);
	const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique);

	// totalSkillCountにfilteredSkillsのnameに含まれるskillP.skillNameCountMapに含まれる値の合計を代入
	const totalSkillCount = filteredSkills.reduce((acc, skill) => acc + (skillP.skillNameCountMap.get(skill.name) || 0), 0);

	const price = Math.max(
		Math.floor(
			(12 * (Math.max(isNaN(skillP.skillNameCount) ? 0 : skillP.skillNameCount, 0.5) / (totalSkillCount / filteredSkills.length))) ** 2
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

const ultimateEffect: SkillEffect = {
    "atkUp": 0.035,
    "defUp": 0.027,
    "fire": 0.009,
    "ice": 0.009,
    "thunder": 0.018,
    "spdUp": 0.009,
    "dart": 0.018,
    "light": 0.018,
    "dark": 0.009,
    "weak": 0.006,
    "notBattleBonusAtk": 0.022,
    "notBattleBonusDef": 0.022,
    "firstTurnResist": 0.03,
    "tenacious": 0.025,
    "plusActionX": 1,
    "atkDmgUp": 0.01,
    "defDmgUp": -0.01,
    "continuousBonusUp": 0.05,
    "escape": 1,
    "endureUp": 0.05,
    "haisuiUp": 0.05,
    "postXUp": 0.005,
    "enemyStatusBonus": 0.1,
    "arpen": 0.01,
    "defRndMin": -0.02,
    "defRndMax": -0.02,
    "firstTurnItem": 1,
    "firstTurnMindMinusAvoid": 1,
    "itemEquip": 0.05,
    "itemBoost": 0.055,
    "weaponBoost": 0.06,
    "armorBoost": 0.06,
    "foodBoost": 0.08,
    "poisonResist": 0.08,
    "mindMinusAvoid": 0.015,
    "poisonAvoid": 0.04,
    "abortDown": 0.03,
    "critUp": 0.02,
    "critUpFixed": 0.003,
    "critDmgUp": 0.02,
    "enemyCritDown": 0.04,
    "enemyCritDmgDown": 0.04,
    "sevenFever": 0.1,
    "charge": 0.1,
    "heavenOrHell": 0.02
  }

export const shop2Items: ShopItem[] = [
	{ name: `お守りを捨てる`, limit: (data) => data.items.filter((x) => x.type === "amulet").length, price: 0, desc: `今所持しているお守りを捨てます`, type: "item", effect: (data) => data.items = data.items?.filter((x) => x.type !== "amulet"), always: true },
  { name: `行動加速のお札`, limit: (data) => (data.maxSpd ?? 0) < 5 && !data.items.filter((x) => x.name === "行動加速のお札").length, price: (data) => 370 - (data.maxSpd ?? 0) * 70, desc: `持っているともこチキの懐き度に関係なく最低5回行動できるようになる`, type: "token", effect: { fivespd: true }, always: true } as TokenItem,
	{ name: `究極のお守り`, limit: (data) => enhanceCount(data) >= 9, price: 18, desc: `もこチキRPGを極めたあなたに……`, type: "amulet", effect: ultimateEffect, durability: 6, short: "究極", isUsed: (data) => true, always: true } as AmuletItem,
	{ name: "スキル複製珠", desc: "スキルを変更し、既に覚えているスキルのどれかを1つ覚えます", price: 6, orb: true, type: "item", effect: (data) => data.duplicationOrb = (data.duplicationOrb ?? 0) + 1, infinite: true, always: true },
	{ name: `苦労のお守り`, limit: (data) => data.allClear && data.streak > 0, price: 1, desc: `持っていると通常モードの敵が強くなります 耐久1 敗北時耐久減少`, type: "amulet", effect: { enemyBuff: 1 }, durability: 1, short: "苦", isUsed: (data) => data.enemy && data.clearHistory.includes(data.enemy), isMinusDurability: (data) => data.streak < 1, always: true } as AmuletItem,
	{ name: `全身全霊のお札`, limit: (data) => !data.items.filter((x) => x.name === "全身全霊のお札").length, price: 300, desc: `持っていると常に行動回数が1回になるが、すごく重い一撃を放てる`, type: "token", effect: { allForOne: true }, always: true } as TokenItem,
	{ name: `運命不変のお札`, limit: (data) => !data.items.filter((x) => x.name === "運命不変のお札").length, price: 300, desc: `持っていると常に与ダメージがランダム変化しなくなる`, type: "token", effect: { notRandom: true }, always: true } as TokenItem,
	{ name: `しあわせのお札`, limit: (data) => !data.items.filter((x) => x.name === "しあわせのお札").length, price: 300, desc: `レイド時、常にステータスの割合がランダムに一時的に変化する`, type: "token", effect: { fortuneEffect: true }, always: true } as TokenItem,
	{ name: "全身全霊のお札を捨てる", limit: (data) => data.items.filter((x) => x.name === "全身全霊のお札").length, desc: "複数回行動するようになるが、一撃は軽くなる", price: 0, type: "item", effect: (data) => data.items = data.items.filter((x) => x.name !== "全身全霊のお札"), always: true },
	{ name: "運命不変のお札を捨てる", limit: (data) => data.items.filter((x) => x.name === "運命不変のお札").length, desc: "与ダメージがランダム変化するようになる", price: 0, type: "item", effect: (data) => data.items = data.items.filter((x) => x.name !== "運命不変のお札"), always: true },
	{ name: "しあわせのお札を捨てる", limit: (data) => data.items.filter((x) => x.name === "しあわせのお札").length, desc: "ステータスの割合がランダムに一時的に変化しなくなる", price: 0, type: "item", effect: (data) => data.items = data.items.filter((x) => x.name !== "しあわせのお札"), always: true },
	{ name: "力の種", desc: "購入時、パワー+1 防御-1", price: 1, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) + 1; data.def = (data.def ?? 0) - 1; }, infinite: true, always: true },
	{ name: "幸運の力の種", limit: (data) => ((10 - (data.atk % 10) + 7) % 10) !== 0, desc: "購入時、パワーの下1桁が7になるように防御から移動", price: (data) => ((10 - (data.atk % 10) + 7) % 10), type: "item", effect: (data) => { data.def = (data.def ?? 0) - ((10 - (data.atk % 10) + 7) % 10); data.atk = (data.atk ?? 0) + ((10 - (data.atk % 10) + 7) % 10); }, infinite: true, always: true },
	{ name: "高級力の種", desc: "購入時、防御2%をパワーに移動", price: 5, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) / 50)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) / 50)); }, infinite: true, always: true },
	{ name: "超・力の種",desc: "購入時、防御10%をパワーに移動", price: 25, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) / 10)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) / 10)); }, infinite: true, always: true },
	{ name: "極・力の種",desc: "購入時、防御30%をパワーに移動", price: 75, type: "item", effect: (data) => { data.atk = Math.round((data.atk ?? 0) + Math.round((data.def ?? 0) * 0.3)); data.def = Math.round((data.def ?? 0) - Math.round((data.def ?? 0) * 0.3)); }, infinite: true, always: true },
  { name: "守りの種", desc: "購入時、防御+1 パワー-1", price: 1, type: "item", effect: (data) => { data.atk = (data.atk ?? 0) - 1; data.def = (data.def ?? 0) + 1; }, infinite: true, always: true },
	{ name: "幸運の守りの種", limit: (data) => ((10 - (data.def % 10) + 7) % 10) !== 0, desc: "購入時、防御の下1桁が7になるようにパワーから移動", price: (data) => ((10 - (data.def % 10) + 7) % 10), type: "item", effect: (data) => { data.atk = (data.atk ?? 0) - ((10 - (data.def % 10) + 7) % 10); data.def = (data.def ?? 0) + ((10 - (data.def % 10) + 7) % 10); }, infinite: true, always: true },
	{ name: "高級守りの種", desc: "購入時、パワー2%を防御に移動", price: 5, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) / 50)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) / 50)); }, infinite: true, always: true },
	{ name: "超・守りの種",desc: "購入時、パワー10%を防御に移動", price: 25, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) / 10)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) / 10)); }, infinite: true, always: true },
  { name: "極・守りの種", desc: "購入時、パワー30%を防御に移動", price: 75, type: "item", effect: (data) => { data.def = Math.round((data.def ?? 0) + Math.round((data.atk ?? 0) * 0.3)); data.atk = Math.round((data.atk ?? 0) - Math.round((data.atk ?? 0) * 0.3)); }, infinite: true, always: true },
	{ name: "赤の勲章", limit: (data) => (data.atkMedal ?? 0) < 10, desc: "1つ購入する度に恒久的にパワーが+1% 10個まで購入できます", price: (data) => 20 * (1 + Math.floor((data.atkMedal ?? 0) / 2)), orb: true, type: "item", effect: (data) => data.atkMedal = (data.atkMedal ?? 0) + 1, infinite: true, always: true },
	{ name: "青の勲章", limit: (data) => (data.defMedal ?? 0) < 10, desc: "1つ購入する度に恒久的に最大体力が+1.5% 10個まで購入できます", price: (data) => 20 * (1 + Math.floor((data.defMedal ?? 0) / 2)), orb: true, type: "item", effect: (data) => data.defMedal = (data.defMedal ?? 0) + 1, infinite: true, always: true },
	{ name: "緑の勲章", limit: (data) => (data.itemMedal ?? 0) < 10, desc: "1つ購入する度に恒久的に全ての道具効果（装備率、効果量、悪・毒アイテム回避）が+1% 10個まで購入できます", price: (data) => 20 * (1 + Math.floor((data.itemMedal ?? 0) / 2)), orb: true, type: "item", effect: (data) => data.itemMedal = (data.itemMedal ?? 0) + 1, infinite: true, always: true },
	{ name: "もこコイン(80枚)", limit: (data) => (data.atkMedal ?? 0) + (data.defMedal ?? 0) + (data.itemMedal ?? 0) >= 30, desc: "ショップでのアイテム購入などに使用できる通貨です", price: 20, orb: true, type: "item", effect: (data) => data.coin = (data.coin ?? 0) + 80, infinite: true, always: true },
	{ name: `壺`, limit: (data) => data.lv >= 20 && (data.jar ?? 0) === 0, price: 200, desc: `なんかいい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `きれいな壺`, limit: (data) => (data.jar ?? 0) === 1 && data.shopExp > 400, price: 400, desc: `なんかきれいな感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `すごい壺`, limit: (data) => (data.jar ?? 0) === 2 && data.shopExp > 1000, price: 600, desc: `なんかすごい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `巨大な壺`, limit: (data) => (data.jar ?? 0) === 3 && data.shopExp > 1800, price: 800, desc: `なんかめっちゃでかい感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `うねうねした壺`, limit: (data) => (data.jar ?? 0) === 4 && data.shopExp > 2800, price: 1000, desc: `なんかうねうねした感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `ナノサイズ壺`, limit: (data) => (data.jar ?? 0) === 5 && data.shopExp > 4000, price: 1200, desc: `小さくて見えない感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	{ name: `謎の壺`, limit: (data) => (data.jar ?? 0) >= 6 && data.shopExp > 5400, price: (data) => (data.jar ?? 0) * 200, desc: `なんか謎な感じ`, type: "item", effect: (data) => data.jar = (data.jar ?? 0) + 1, always: true },
	...skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique).map((x): Item => ({ name: `${x.name}の教本`, limit: (data) => !data.nextSkill, price: (data, rnd, ai) => skillPrice(ai, x.name, rnd), desc: `購入すると次のスキル変更時に必ず「${x.name}」を習得できる（複製時は対象外）`, type: "item", effect: (data) => { data.nextSkill = x.name } })),
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
		...showShopItems.map((x, index) => `[${numberCharConvert(index + 1)}] ${x.name} ${x.orb ? "**変更珠** " : ""}${x.price}${x.orb ? "個" : "枚"}\n${x.desc}\n`)
	].join("\n"), { visibility: "specified" });

	msg.friend.setPerModulesData(module, data);

	module.subscribeReply("shopBuy:" + msg.userId, reply.id, { shopDate: getDate(), showShopItems: showShopItems.map((x) => ({ name: x.name, type: x.type, price: x.price, orb: x.orb || false, ...(x.type === "amulet" ? { durability: x.durability ?? undefined, skillName: x.skillName ?? undefined } : {}) })) });

	return {
		reaction: 'love'
	};

};

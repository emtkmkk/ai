import Message from "@/message";
import serifs from "@/serifs";
import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';
import { skills, Skill, skillPower } from './skills';
import { aggregateTokensEffects } from "./shop";
import { initializeData } from './utils';
import rpg from './index';
import 藍 from '@/ai';

export const skillPriceFixed = (_ai: 藍, skillName: Skill["name"]) => {
    const skillP = skillPower(_ai, skillName);
    const filteredSkills = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly);
    const skill = skills.find((x) => x.name === skillName);
    const totalSkillCount = filteredSkills.reduce((acc, skill) => acc + (skillP.skillNameCountMap.get(skill.name) || 0), 0);
    const price = Math.max(
        Math.floor(
            12 * (skill?.notLearn ? 2.5 : (Math.max(isNaN(skillP.skillNameCount) ? 0 : skillP.skillNameCount, 0.5) / (totalSkillCount / filteredSkills.length)))
        ), 6
    );
    return price;
};

export const calcAmuletPrice = (ai: 藍, list: Skill[]) => {
    const prices = list.map((x) => skillPriceFixed(ai, x.name));
    const sum = prices.reduce((p, c) => p + c, 0);
    const price = Math.floor(sum * (Math.pow(1.5, list.length - 1) * Math.max(prices.reduce((pre, cur) => pre * (0.5 + cur / 24), 1), 1)));
    return price;
};

const getAmuletTotalCost = (ai: 藍, skillList: Skill[]) => {
    return Math.ceil(calcAmuletPrice(ai, skillList) * 1.3);
};

const partPrice = (ai: 藍, cur: Skill[], add: Skill, currentCost?: number) => {
    const before = typeof currentCost === 'number' ? currentCost : getAmuletTotalCost(ai, cur);
    const after = getAmuletTotalCost(ai, [...cur, add]);
    return Math.max(after - before, 0);
};

const resolveSkills = (skillNames: string[]): Skill[] => {
    return skillNames
        .map((name) => skills.find((skill) => skill.name === name))
        .filter((skill): skill is Skill => Boolean(skill));
};

export const shopCustomReply = async (module: rpg, ai: 藍, msg: Message) => {
    const data = initializeData(module, msg);
    if (!data) return false;
    if (!data.tempAmulet) data.tempAmulet = [];

    let rnd = seedrandom(getDate() + ai.account.id + msg.userId);

    const currentSkills = resolveSkills(data.tempAmulet);

    if (typeof data.tempAmuletCost !== 'number') {
        data.tempAmuletCost = getAmuletTotalCost(ai, currentSkills);
    }

    const candidateStartIndex = currentSkills.length > 0 ? 2 : 1;
    const showCount = currentSkills.length > 0 ? 8 : 9;

    const candidates = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly && !data.tempAmulet.includes(x.name));
    const show = candidates.sort(() => rnd() - 0.5).slice(0, showCount);

    let list = show.map((sk, i) => {
        const price = partPrice(ai, currentSkills, sk, data.tempAmuletCost);
        return `[${i + candidateStartIndex}] ${sk.name}のパーツ ${price}枚${aggregateTokensEffects(data).showSkillBonus && sk.info ? `\n${sk.info}` : sk.desc ? `\n${sk.desc}` : ""}`;
    });
    if (currentSkills.length > 0) {
        const totalCost = data.tempAmuletCost ?? getAmuletTotalCost(ai, currentSkills);
        const durability = currentSkills.length * 6;
        let completionLine = `[0] 完成させる！`;

        if (aggregateTokensEffects(data).autoRepair && durability >= 2) {
            const repairCost = Math.round(totalCost / durability) + 1;
            completionLine += `\nコイン/耐久: ${repairCost}`;
        }

        const headerOptions = [
            completionLine,
            `\n\n[1] パーツをリセット {${totalCost}}枚返却`,
        ];
        list = headerOptions.concat(list);
    }

    const current = currentSkills.length ? `現在のパーツ: [${currentSkills.map((x) => x.short).join('')}]` : '現在のパーツ: []';

    const reply = await msg.reply([
        serifs.rpg.shop.welcome3(data.coin),
        current,
        ...list
    ].join('\n\n'), { visibility: 'specified' });

    module.subscribeReply('shopCustom:' + msg.userId, reply.id, { skills: show.map(x => x.name), startIndex: candidateStartIndex });
    msg.friend.setPerModulesData(module, data);

    return { reaction: 'love' };
};

export const shopCustomContextHook = (module: rpg, ai: 藍, key: any, msg: Message, data: any) => {
    if (key.replace('shopCustom:', '') !== msg.userId) return { reaction: 'hmm' };
	if (msg.extractedText.length >= 3) return false;
    const match = msg.extractedText.replace(/[０-９]/g, m => '０１２３４５６７８９'.indexOf(m).toString()).match(/[0-9]+/);
	if (match == null) {
        return {
            reaction: 'hmm',
        };
    }
    const index = parseInt(match[0]);
    const rpgData = initializeData(module, msg);
    if (isNaN(index)) return { reaction: 'hmm' };

    if (!rpgData.tempAmulet) rpgData.tempAmulet = [];
    const currentSkills = resolveSkills(rpgData.tempAmulet);

    if (typeof rpgData.tempAmuletCost !== 'number') {
        rpgData.tempAmuletCost = getAmuletTotalCost(ai, currentSkills);
    }

    if (index === 0) {
        if (!currentSkills.length) return { reaction: 'hmm' };
        const price = Math.ceil(calcAmuletPrice(ai, currentSkills) * 1.3);
        const amulet = {
            ...mergeSkills(ai, currentSkills),
            price
        };
        if (rpgData.items.some((x) => x.type === 'amulet')) {
            rpgData.items = rpgData.items.filter((x) => x.type !== 'amulet');
        }
        rpgData.items.push(amulet);
        rpgData.tempAmulet = [];
        rpgData.tempAmuletCost = 0;
        msg.friend.setPerModulesData(module, rpgData);
        msg.reply(`お守りを作成しました！ ${amulet.name}`);
        return { reaction: 'love' };
    }

    if (currentSkills.length > 0 && index === 1) {
        const refund = rpgData.tempAmuletCost ?? getAmuletTotalCost(ai, currentSkills);
        rpgData.coin = (rpgData.coin ?? 0) + refund;
        const previousShopExp = rpgData.shopExp ?? 0;
        rpgData.shopExp = Math.max(0, previousShopExp - refund);
        rpgData.tempAmulet = [];
        rpgData.tempAmuletCost = 0;
        msg.friend.setPerModulesData(module, rpgData);
        return shopCustomReply(module, ai, msg);
    }

    const candidateStartIndex = typeof data.startIndex === 'number' ? data.startIndex : (currentSkills.length > 0 ? 2 : 1);
    const skillIndex = index - candidateStartIndex;
    if (!Array.isArray(data.skills) || skillIndex < 0 || skillIndex >= data.skills.length) {
        return { reaction: 'hmm' };
    }
    const skillName = data.skills[skillIndex];
    const skill = skills.find((x) => x.name === skillName);
    if (!skill) return { reaction: 'hmm' };
    const cost = partPrice(ai, currentSkills, skill, rpgData.tempAmuletCost);
    if ((rpgData.coin ?? 0) < cost) {
        msg.reply(serifs.rpg.shop.notEnoughCoin);
        return { reaction: 'hmm' };
    }
    rpgData.coin -= cost;
    rpgData.shopExp += cost;
    rpgData.tempAmulet.push(skill.name);
    rpgData.tempAmuletCost = getAmuletTotalCost(ai, resolveSkills(rpgData.tempAmulet));
    msg.friend.setPerModulesData(module, rpgData);
    return shopCustomReply(module, ai, msg);
};

function mergeSkills(ai: 藍, skillList: Skill[]) {
    const name = skillList.map((x) => x.name).join('&');
    const durability = skillList.length * 6;
    const effect = skillList.reduce((acc, skill) => ({ ...acc, ...skill.effect }), {});
    return {
        name: `${name}のお守り`,
        price: 0,
        desc: `持っているとスキル${skillList.map((x) => `「${x.name}」`).join('と')}を使用できる 耐久${durability} 使用時耐久減少`,
        type: 'amulet',
        effect,
        durability,
        short: skillList.map((x) => x.short).join(''),
        skillName: skillList.map((x) => x.name),
        isUsed: () => true
    };
}

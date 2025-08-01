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

const partPrice = (ai: 藍, cur: Skill[], add: Skill) => {
    const before = calcAmuletPrice(ai, cur);
    const after = calcAmuletPrice(ai, [...cur, add]);
    return Math.ceil(after * 1.3 - before * 1.3);
};

export const shopCustomReply = async (module: rpg, ai: 藍, msg: Message) => {
    const data = initializeData(module, msg);
    if (!data) return false;
    if (!data.tempAmulet) data.tempAmulet = [];

    let rnd = seedrandom(getDate() + ai.account.id + msg.userId);

    const currentSkills = data.tempAmulet.map((x) => skills.find((y) => y.name === x)).filter(Boolean) as Skill[];

    const candidates = skills.filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly && !data.tempAmulet.includes(x.name));
    const show = candidates.sort(() => rnd() - 0.5).slice(0, 9);

    const list = show.map((sk, i) => {
        const price = partPrice(ai, currentSkills, sk);
        return `[${i + 1}] ${sk.name}のパーツ ${price}枚${aggregateTokensEffects(data).showSkillBonus && sk.info ? `\n${sk.info}` : sk.desc ? `\n${sk.desc}` : ""}`;
    });
    if (currentSkills.length > 0) {
        list.unshift(`[0] 完成させる！`);
    }

    const current = currentSkills.length ? `現在のパーツ: [${currentSkills.map((x) => x.short).join('')}]` : '現在のパーツ: []';

    const reply = await msg.reply([
        serifs.rpg.shop.welcome3(data.coin),
        current,
        ...list
    ].join('\n\n'), { visibility: 'specified' });

    module.subscribeReply('shopCustom:' + msg.userId, reply.id, { skills: show.map(x => x.name) });
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
    const currentSkills = rpgData.tempAmulet.map((x) => skills.find((y) => y.name === x)).filter(Boolean) as Skill[];

    if (index === 0) {
        if (!currentSkills.length) return { reaction: 'hmm' };
        const price = calcAmuletPrice(ai, currentSkills);
        const amulet = {
            ...mergeSkills(ai, currentSkills),
            price
        };
        if (rpgData.items.some((x) => x.type === 'amulet')) {
            rpgData.items = rpgData.items.filter((x) => x.type !== 'amulet');
        }
        rpgData.items.push(amulet);
        rpgData.tempAmulet = [];
        msg.friend.setPerModulesData(module, rpgData);
        msg.reply(`お守りを作成しました！ ${amulet.name}`);
        return { reaction: 'love' };
    }

    const skillName = data.skills[index - 1];
    const skill = skills.find((x) => x.name === skillName);
    if (!skill) return { reaction: 'hmm' };
    const cost = partPrice(ai, currentSkills, skill);
    if ((rpgData.coin ?? 0) < cost) {
        msg.reply(serifs.rpg.shop.notEnoughCoin);
        return { reaction: 'hmm' };
    }
    rpgData.coin -= cost;
    rpgData.shopExp += cost;
    rpgData.tempAmulet.push(skill.name);
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

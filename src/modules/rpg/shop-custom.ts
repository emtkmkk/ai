/**
 * @packageDocumentation
 *
 * RPGモジュールのカスタムショップ
 *
 * お守りパーツを組み合わせて自分好みのお守りを作成する。カスタムショップ入場の札を持っているプレイヤーが利用できる。
 *
 * @remarks
 * - shopCustomReply / shopCustomContextHook で表示・購入処理を行う
 * - スキルを選択して組み合わせ、完成時にコインで購入する
 *
 * @public
 */
import Message from "@/message";
import serifs from "@/serifs";
import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';
import { skills, Skill, skillPower, isKazutoriMasterDisabled } from './skills';
import { aggregateTokensEffects, mergeSkillEffects } from "./shop";
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
            12 * (skill?.notLearn ? 2.5 : (Math.max(isNaN(skillP.skillNameCount) ? 0 : skillP.skillNameCount, 0.5) / (totalSkillCount / filteredSkills.filter((x) => !x.notLearn).length)))
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

/**
 * 現在パーツとして選択可能なスキルかどうか
 *
 * 一覧に並ぶ候補と同じ条件（作成中のお守りに未追加であることを含む）で判定する。
 *
 * @param data RPGモジュールのデータ
 * @param skill 判定するスキル
 * @returns 選択可能なら true
 * @internal
 */
const isAvailablePart = (data: any, skill: Skill) => {
    return !skill.moveTo && !skill.cantReroll && !skill.unique && !skill.skillOnly && !(data.tempAmulet ?? []).includes(skill.name) && !(skill.name === "数取りの達人" && isKazutoriMasterDisabled(data));
};

/**
 * 返信テキストからパーツにするスキルを探す（隠し機能）
 *
 * 返信全体がスキルの短縮名（** の装飾は無視）かスキル名だけで構成されている場合に限り、
 * 一番左に書かれたスキルを返す（通常の文章に短縮名の文字が含まれていても反応しないようにするため）。
 * 数字だけの返信は番号選択として扱うため、ここでは対象にしない。
 * 同じ短縮名のスキルが複数ある場合（炎 と 炎＋ など）は、スキル一覧で先に定義されている方を使う。
 *
 * @param text 返信テキスト
 * @returns 一番左のスキル、なければ undefined
 * @internal
 */
const findSkillByText = (text: string): Skill | undefined => {
    const normalized = text.replace(/\s/g, '');
    if (!normalized || /^[0-9０-９]+$/.test(normalized)) return undefined;
    const tokens = skills
        .filter((x) => !x.moveTo)
        .flatMap((x) => [{ text: x.name, skill: x }, { text: x.short?.replace(/\*/g, '') ?? '', skill: x }])
        .filter((x) => x.text)
        // 長い表記を優先して、スキル名の途中を短縮名として拾わないようにする
        .sort((a, b) => b.text.length - a.text.length);
    const found: Skill[] = [];
    let rest = normalized;
    while (rest.length) {
        const token = tokens.find((x) => rest.startsWith(x.text));
        if (!token) return undefined;
        found.push(token.skill);
        rest = rest.slice(token.text.length);
    }
    return found[0];
};

/**
 * 作成中のお守りにパーツを追加し、コインを支払う
 *
 * @returns 追加できた場合は true（コイン不足の場合は返信して false）
 * @internal
 */
const addPart = (module: rpg, ai: 藍, msg: Message, rpgData: any, skill: Skill) => {
    const currentSkills = resolveSkills(rpgData.tempAmulet);
    const cost = partPrice(ai, currentSkills, skill, rpgData.tempAmuletCost);
    if ((rpgData.coin ?? 0) < cost) {
        msg.reply(serifs.rpg.shop.notEnoughCoin);
        return false;
    }
    rpgData.coin -= cost;
    rpgData.shopExp += cost;
    rpgData.tempAmulet.push(skill.name);
    rpgData.tempAmuletCost += cost;
    msg.friend.setPerModulesData(module, rpgData);
    return true;
};

/**
 * カスタムショップの初期表示を行う
 *
 * 「RPG カスタムショップ」コマンドで呼ばれ、パーツ選択画面を表示する。
 *
 * @param module RPGモジュール
 * @param ai 藍オブジェクト
 * @param msg メッセージ
 * @returns リアクションオブジェクト、または false
 * @internal
 */
export const shopCustomReply = async (module: rpg, ai: 藍, msg: Message) => {
    const data = initializeData(module, msg);
    if (!data) return false;
    if (!data.tempAmulet) data.tempAmulet = [];

    let rnd = seedrandom(`${getDate()}${ai.account.id}${msg.userId}${data.lv ?? 0}`);

    const currentSkills = resolveSkills(data.tempAmulet);

    if (typeof data.tempAmuletCost !== 'number') {
        data.tempAmuletCost = getAmuletTotalCost(ai, currentSkills);
    }

    const candidateStartIndex = currentSkills.length > 0 ? 2 : 1;
    const showCount = currentSkills.length > 0 ? 8 : 9;

    const show = skills.filter((x) => x).sort(() => rnd() - 0.5).filter((x) => !x.moveTo && !x.cantReroll && !x.unique && !x.skillOnly && !data.tempAmulet.includes(x.name) && !(x.name === "数取りの達人" && isKazutoriMasterDisabled(data))).slice(0, showCount);

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
            `[1] パーツをリセット ${totalCost}枚返却`,
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

/**
 * カスタムショップのパーツ選択・購入返信を処理する
 *
 * パーツ番号の返信を受け取り、お守りに追加するか完成させる。
 *
 * @param module RPGモジュール
 * @param ai 藍オブジェクト
 * @param key コンテキストキー（shopCustom:userId）
 * @param msg 返信メッセージ
 * @param data コンテキストデータ
 * @returns リアクションオブジェクト、または shopCustomReply の戻り値
 * @internal
 */
export const shopCustomContextHook = (module: rpg, ai: 藍, key: any, msg: Message, data: any) => {
    if (key.replace('shopCustom:', '') !== msg.userId) return { reaction: 'hmm' };

    // 隠し機能: スキルの短縮名（またはスキル名）で返信すると、そのパーツの購入確認を出す
    // 選択できないパーツの場合は、以降の通常の処理に任せる
    const namedSkill = findSkillByText(msg.extractedText);
    if (namedSkill && isAvailablePart(initializeData(module, msg), namedSkill)) {
        return confirmPart(module, ai, msg, namedSkill);
    }

	if (msg.extractedText.length >= 3) return false;
    const match = msg.extractedText.replace(/[０-９]/g, m => '０１２３４５６７８９'.indexOf(m).toString()).match(/[0-9]+/);
	if (match === null || match === undefined) {
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
    if (!addPart(module, ai, msg, rpgData, skill)) return { reaction: 'hmm' };
    return shopCustomReply(module, ai, msg);
};

/**
 * 短縮名で指定されたパーツの説明と値段を返信し、購入確認を待ち受ける（隠し機能）
 *
 * @param module RPGモジュール
 * @param ai 藍オブジェクト
 * @param msg 返信メッセージ
 * @param skill 指定されたスキル
 * @returns リアクションオブジェクト
 * @internal
 */
const confirmPart = async (module: rpg, ai: 藍, msg: Message, skill: Skill) => {
    const rpgData = initializeData(module, msg);
    if (!rpgData.tempAmulet) rpgData.tempAmulet = [];
    const currentSkills = resolveSkills(rpgData.tempAmulet);
    if (typeof rpgData.tempAmuletCost !== 'number') {
        rpgData.tempAmuletCost = getAmuletTotalCost(ai, currentSkills);
    }
    const price = partPrice(ai, currentSkills, skill, rpgData.tempAmuletCost);
    if ((rpgData.coin ?? 0) < price) {
        msg.reply(serifs.rpg.shop.notEnoughCoin);
        return { reaction: 'hmm' };
    }
    const detail = aggregateTokensEffects(rpgData).showSkillBonus && skill.info ? skill.info : skill.desc ?? "";
    const reply = await msg.reply(`${skill.name}のパーツ ${price}枚\n${detail ? `${detail}\n` : ""}\nこのパーツを購入しますか？はいかいいえで返信してください。`, { visibility: 'specified' });
    module.subscribeReply('shopCustomConfirm:' + msg.userId, reply.id, { skill: skill.name });
    return { reaction: 'love' };
};

/**
 * 短縮名で指定したパーツの購入確認（はい / いいえ）の返信を処理する
 *
 * @param module RPGモジュール
 * @param ai 藍オブジェクト
 * @param key コンテキストキー（shopCustomConfirm:userId）
 * @param msg 返信メッセージ
 * @param data コンテキストデータ（skill）
 * @returns リアクションオブジェクト、または shopCustomReply の戻り値
 * @internal
 */
export const shopCustomConfirmContextHook = async (module: rpg, ai: 藍, key: string, msg: Message, data: any) => {
    if (key.replace('shopCustomConfirm:', '') !== msg.userId) return { reaction: 'hmm' };
    const skill = skills.find((x) => x.name === data?.skill);
    if (msg.text.includes('いいえ')) {
        module.unsubscribeReply(key);
        return { reaction: ':mk_muscleok:' };
    }
    if (!msg.text.includes('はい')) {
        const reply = await msg.reply(serifs.core.yesOrNo, { visibility: 'specified' });
        module.subscribeReply(key, reply.id, data);
        return { reaction: 'hmm' };
    }
    module.unsubscribeReply(key);
    const rpgData = initializeData(module, msg);
    if (!rpgData.tempAmulet) rpgData.tempAmulet = [];
    // 確認中に状況が変わっている可能性があるため、選択可否と値段を確定時にもう一度判定する
    // （選択できなくなっていた場合は、番号選択で範囲外を選んだ時と同じく何もしない）
    if (!skill || !isAvailablePart(rpgData, skill)) {
        return { reaction: 'hmm' };
    }
    if (typeof rpgData.tempAmuletCost !== 'number') {
        rpgData.tempAmuletCost = getAmuletTotalCost(ai, resolveSkills(rpgData.tempAmulet));
    }
    if (!addPart(module, ai, msg, rpgData, skill)) return { reaction: 'hmm' };
    return shopCustomReply(module, ai, msg);
};

function mergeSkills(ai: 藍, skillList: Skill[]) {
    const name = skillList.map((x) => x.name).join('&');
    const durability = skillList.length * 6;
    const effect = mergeSkillEffects(skillList.map((x) => x.effect));
    const raidOnly = skillList.length > 0 && skillList.every((x) => x.raidOnly);
    return {
        name: `${name}のお守り`,
        price: 0,
        desc: `持っているとスキル${skillList.map((x) => `「${x.name}」`).join('と')}を使用できる 耐久${durability} ${raidOnly ? 'レイドでの' : ''}使用時耐久減少`,
        type: 'amulet',
        effect,
        durability,
        short: skillList.map((x) => x.short).join(''),
        skillName: skillList.map((x) => x.name),
        isUsed: raidOnly ? (data) => !!data.raid : () => true
    };
}

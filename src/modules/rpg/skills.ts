/**
 * @packageDocumentation
 *
 * RPGモジュールのスキル定義・効果集計
 *
 * skills にスキル定義を保持し、aggregateSkillsEffects で所持スキルの効果を集計する。
 * skillBorders はスキル解放のLv閾値。getSkill / getRerollSkill でスキル抽選を行う。
 *
 * @remarks
 * - SkillEffect 型は戦闘中の各種判定で参照される
 * - moveTo が設定されたスキルは廃止済み。effect は空で効果なし。moveTo による自動移行で意味のあるスキルに置換される
 *
 * @public
 */
import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import 藍 from '@/ai';
import { aggregateTokensEffects, shopItems, mergeSkillAmulet } from './shop';
import type { AmuletItem, ShopItem } from './shop';
import { SkillEffect, Skill, skills, skillBorders, ultimateAmulet, isKazutoriMasterDisabled } from './skill-data';
import { deepClone, getColor } from './utils';
import { renderEffectDisplay } from './effect-display';
import { ensureKazutoriMasterHistory, getKazutoriMasterBonus } from './battle';

/** スキル名ごとの所持人数マップ（skillCalculate で更新） */
export let skillNameCountMap = new Map();
/** 全スキルの合計所持数（skillCalculate で更新） */
export let totalSkillCount = 0;
let ai: 藍;

/** skillCalculate の集計結果を使い回す時間（ミリ秒） */
const SKILL_COUNT_CACHE_MS = 5 * 60 * 1000;
/** 最後に集計した時刻と、そのときの藍オブジェクト */
let skillCountCalculatedAt = 0;
let skillCountCalculatedAi: 藍 | undefined;

/**
 * 全ユーザーのスキル所持状況を集計する
 *
 * skillNameCountMap / totalSkillCount を更新し、ショップ価格や人気度計算に使用される。
 *
 * @remarks
 * 全プレイヤーを走査するため重い。値段の計算などで1回の操作中に何度も呼ばれるので、
 * 集計結果を {@link SKILL_COUNT_CACHE_MS} の間は使い回す。
 * スキル変更の直後など、すぐ反映したい場合は force を指定する。
 *
 * @param _ai 藍オブジェクト（省略時は前回の ai）
 * @param force キャッシュを使わずに集計し直す
 * @returns { skillNameCountMap, totalSkillCount }
 * @internal
 */
export function skillCalculate(_ai: 藍 = ai, force = false) {
	if (_ai) ai = _ai;
	if (!force && skillCountCalculatedAi === ai && Date.now() - skillCountCalculatedAt < SKILL_COUNT_CACHE_MS) {
		return { skillNameCountMap, totalSkillCount };
	}
	skillCountCalculatedAt = Date.now();
	skillCountCalculatedAi = ai;
	skillNameCountMap = new Map();
	totalSkillCount = 0;
	const friends = ai.friends.find().filter((x) => x.perModulesData?.rpg?.lv && x.perModulesData.rpg.lv > 1 && x.perModulesData.rpg.skills?.length);
	friends.forEach(friend => {
		const playerSkills = friend.perModulesData.rpg.skills;
		if (playerSkills && Array.isArray(playerSkills)) {
			playerSkills.forEach(skill => {
				const skillName = skill?.name;
				if (skillName) {
					const baseSkill = skills.find((x) => x.name === skillName);
					const rareWeight = Math.max(baseSkill?.rare ?? 1, 1);
					totalSkillCount += rareWeight;
					if (skillNameCountMap.has(skillName)) {
						skillNameCountMap.set(skillName, skillNameCountMap.get(skillName) + rareWeight);
					} else {
						skillNameCountMap.set(skillName, rareWeight);
					}
				}
			});
		}
	});
	return { skillNameCountMap, totalSkillCount };
}

export * from './skill-data';

/**
 * スキル変更時に新たに習得するスキルを抽選する
 *
 * 人気度・出現制限（unique, notLearn 等）を考慮してランダムに選択する。
 *
 * @param data RPGモジュールのデータ
 * @returns 抽選されたスキル
 * @internal
 */
export const getSkill = (data) => {
	const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x);
	// フィルタリングされたスキルの配列を作成
	const filteredSkills = skills.filter((x) => !x.notLearn && !x.moveTo && (!x.cantReroll || !playerSkills?.some((y) => y.cantReroll)) && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique) && !(x.name === "数取りの達人" && isKazutoriMasterDisabled(data)));

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
	const filteredSkills = skills.filter((x) => !x.notLearn && !x.moveTo && !x.cantReroll && x.name !== oldSkillName && !playerSkills?.filter((y) => y.unique).map((y) => y.unique).includes(x.unique) && !(x.name === "数取りの達人" && isKazutoriMasterDisabled(data)));

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

export const canLearnSkillNow = (data, skill: Skill) => {
       const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x);
       if (skill.name === "数取りの達人" && isKazutoriMasterDisabled(data)) return false;
       if (skill.notLearn || skill.moveTo || skill.cantReroll) return false;
       if (playerSkills.filter((y) => y.unique).map((y) => y.unique).includes(skill.unique)) return false;
       if (skill.name === "分散型" && (countDuplicateSkillNames(data.skills) !== 0 || data.skills.some((x) => x.name === "分散型"))) return false;
       return true;
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
/**
 * スキル確認・変更の初期表示を行う
 *
 * 「RPG スキル」コマンドで呼ばれ、現在のスキル一覧と変更オプションを表示する。
 *
 * @param module RPGモジュール
 * @param ai 藍オブジェクト
 * @param msg メッセージ
 * @returns リアクションオブジェクト
 * @internal
 */
export const skillReply = async (module: Module, ai: 藍, msg: Message) => {

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
		const isHatogurumaCheck = msg.includes(["鳩", "車"]);
		if (msg.includes(["3"])) {
			msg.reply(`\n※スキル3倍時効果\n\`\`\`\n` + (isHatogurumaCheck ? getHatogurumaEffectString(data, 3) : getTotalEffectString(data, 3, ai, msg)) + `\n\`\`\``);
		} else {
			msg.reply(`\n\`\`\`\n` + (isHatogurumaCheck ? getHatogurumaEffectString(data) : getTotalEffectString(data, 1, ai, msg)) + `\n\`\`\``);
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
					skillCalculate(ai, true);
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
                                       if (aggregateTokensEffects(data).selectSkill) {
												let options = [] as Skill[];
												let loopCount = 0;
												while (options.length < 3 && loopCount < 200) {
													const option = getRerollSkill(data, oldSkillName);
													if (![data.nextSkill, ...options.map((x) => x.name)].includes(option.name)) {
														options.push(option)
													}
													loopCount += 1;
												}
                                               const nextSkill = data.nextSkill ? skills.find(x => x.name === data.nextSkill) : null;
                                               if (nextSkill && canLearnSkillNow(data, nextSkill)) {
                                                       options.push(nextSkill);
                                               }
                                               module.unsubscribeReply(`selectSkill:${msg.userId}`);
                                               data.rerollOrb -= 1;
                                               msg.friend.setPerModulesData(module, data);
                                               const reply = await msg.reply(`\n新しいスキルを**選択**してください！\n\n${options.map((x, idx) => `[${idx + 1}] ${x.name}\n効果: ${x.desc}` + (aggregateTokensEffects(data).showSkillBonus && x.info ? `\n詳細効果: ${x.info}` : "")).join("\n\n")}\n\n[0] 変更しない`, { visibility: 'specified' });
                                               module.subscribeReply(`selectSkill:${msg.userId}`, reply.id, { index: i, options: options.map(x => x.name), oldSkillName });
                                               return { reaction: 'love' };
                                       }
                                       if (data.nextSkill && skills.find((x) => x.name === data.nextSkill) && canLearnSkillNow(data, skills.find((x) => x.name === data.nextSkill)!)) {
                                               const skill = skills.find((x) => x.name === data.nextSkill)!;
                                               data.skills[i] = skill;
                                               data.nextSkill = null;
                                       } else {
                                               data.skills[i] = getRerollSkill(data, oldSkillName);
                                       }
                                       msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name) + `\n効果: ${data.skills[i].desc}` + (aggregateTokensEffects(data).showSkillBonus && data.skills[i].info ? `\n詳細効果: ${data.skills[i].info}` : ""));
                                       data.rerollOrb -= 1;
                                       msg.friend.setPerModulesData(module, data);
                                       skillCalculate(ai, true);
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
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y !== null && y !== undefined) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
		const skill = amulet.skillName && !Array.isArray(amulet.skillName) ? [skills.find((x) => amulet.skillName === x.name)] : amulet.skillName && Array.isArray(amulet.skillName) ? amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y !== null && y !== undefined) : undefined;
		if (amulet.durability) amuletSkill.push(`[お守り] ${amulet.skillName && !Array.isArray(amulet.skillName) ? amulet.skillName : amulet.name} ${aggregateTokensEffects(data).autoRepair && (item.durability ?? 0) >= 2 && amulet.durability <= 1 ? `コイン消費${Math.round((amulet.price ?? 12) / (item.durability ?? 6)) + 1}` : `残耐久${amulet.durability}`}${skillInfo(skill, item.desc, aggregateTokensEffects(data).showSkillBonus)}`);
	}
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
/**
 * 所持スキル・お守りの効果を集計する
 *
 * 戦闘・レイド・木人モード等で参照され、atkUp / defUp / spdUp 等の倍率を返す。
 *
 * @param data RPGモジュールのデータ
 * @param skillX スキル効果の倍率（スキル効果がX倍になるレイドボス用。通常は1）。
 *               重複しないスキル（unique / amuletUnique）は効果をX倍にする代わりに、パワー・防御を1つにつき 1 + 0.06×(X-1) 倍にする
 * @returns SkillEffect 集計結果
 * @internal
 */
export function aggregateSkillsEffects(data: any, skillX = 1): SkillEffect {
	const aggregatedEffect: SkillEffect = {};

	if (!data.skills) return aggregatedEffect;
	let dataSkills = data.skills;
	if (data.items?.filter((x) => x.type === "amulet").length) {
		const amulet = data.items?.filter((x) => x.type === "amulet")[0] as AmuletItem;
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y !== null && y !== undefined) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
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
				adjustedEffect.amuletPower = (adjustedEffect.amuletPower ?? 0) + ((amulet.skillName && Array.isArray(amulet.skillName) ? amulet.skillName.length : 1) * multiplier);
				return { effect: adjustedEffect };
			};
				dataSkills = dataSkills.concat([adjustEffect(item.effect, boost)] as any);
			}
		}
	}
	let uniqueX = 1;
	dataSkills.forEach(_skill => {
		let skill = _skill.name ? skills.find((x) => x.name === _skill.name) ?? _skill : _skill;
		if (skillX !== 1) {
			skill = deepClone(skill);
			if (skill.unique || skill.amuletUnique) {
				uniqueX = uniqueX * (1 + (0.06 * (skillX - 1)));
			} else {
				for (const eff in skill.effect) {
					skill.effect[eff] = skill.effect[eff] * skillX;
				}
			}
		}
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

	aggregatedEffect.atkUp = (1 + (aggregatedEffect.atkUp ?? 0)) * (1 + (aggregatedEffect.atkUp2 ?? 0)) * (1 + (aggregatedEffect.atkUp3 ?? 0)) * (1 + (aggregatedEffect.atkUp4 ?? 0)) * (1 + (aggregatedEffect.atkUp5 ?? 0)) * (1 + (aggregatedEffect.atkUp6 ?? 0)) * (1.04 ** (aggregatedEffect.atkUpBonus ?? 0)) * uniqueX;
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
	if ((day === 0 || aggregatedEffect.rainbow) && aggregatedEffect.thunder) {
		aggregatedEffect.thunder *= 5 / 3;
	}
	if ((day === 1 || aggregatedEffect.rainbow) && aggregatedEffect.dark) {
		aggregatedEffect.dark *= 5 / 3;
	}
	if ((day === 2 || aggregatedEffect.rainbow) && aggregatedEffect.fire) {
		aggregatedEffect.fire *= 5 / 3;
	}
	if ((day === 3 || aggregatedEffect.rainbow) && aggregatedEffect.ice) {
		aggregatedEffect.ice *= 5 / 3;
	}
	if ((day === 4 || aggregatedEffect.rainbow) && aggregatedEffect.spdUp) {
		aggregatedEffect.spdUp *= 5 / 3;
	}
	if ((day === 5 || aggregatedEffect.rainbow) && aggregatedEffect.light) {
		aggregatedEffect.light *= 5 / 3;
	}
	if ((day === 6 || aggregatedEffect.rainbow) && aggregatedEffect.dart) {
		aggregatedEffect.dart *= 5 / 3;
	}
	if (aggregatedEffect.water) {
		aggregatedEffect.ice = (aggregatedEffect.ice ?? 0) * (1 + (aggregatedEffect.water * 1.4));
		aggregatedEffect.thunder = (aggregatedEffect.thunder ?? 0) * (1 + (aggregatedEffect.water * 1.4));
	}
	if ((day === 3 || aggregatedEffect.rainbow) && aggregatedEffect.water) {
		aggregatedEffect.water *= 5 / 3;
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

export function getSkillsShortName(data: { items?: ShopItem[], skills: Skill[]; }): { skills?: string | undefined, amulet?: string | undefined; } {
	const dataSkills = data.skills?.length ? "[" + data.skills.map((x) => (skills.find((y) => x.name === y.name) ?? x).short).join("") + "]" : undefined;
	const amulet = data.items?.filter((x) => x.type === "amulet").length ? data.items?.filter((x) => x.type === "amulet")[0] as AmuletItem : undefined;
	const amuletItem = amulet ? [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y !== null && y !== undefined) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem : undefined;
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
		const item = [...shopItems, ultimateAmulet, ...(Array.isArray(amulet.skillName) ? [mergeSkillAmulet(ai, undefined, amulet.skillName.map((y) => skills.find((z) => y === z.name) ?? undefined).filter((y) => y !== null && y !== undefined) as Skill[]) as AmuletItem] : [])].find((x) => x.name === amulet.name) as AmuletItem;
		if ((item.isMinusDurability ?? item.isUsed)(data) && (!aggregateTokensEffects(data).normalModeNotUseAmulet || data.raid)) {
			const boost = data.skills ? data.skills?.filter((x) => x.effect?.amuletBoost).reduce((acc, cur) => acc + (cur.effect?.amuletBoost ?? 0), 0) ?? 0 : 0;
			data.items.forEach((x) => {
				if (x.type === "amulet") {
					if (boost <= 0 || Math.random() < (1 / Math.pow(1.5, boost * 2))) {
						const minusCoin = Math.round((x.price ?? 12) / (item.durability ?? 6)) + 1;
						if(aggregateTokensEffects(data).autoRepair && (item.durability ?? 0) >= 2 && x.durability <= 1 && data.coin >= minusCoin) {
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

/**
 * スキル効果の確認表示（「RPG スキル 確認」）を作る
 *
 * 表示の中身は effect-display.ts の定義表で決まる。ここでは効果の集計と、
 * 覚醒変更の札などスキル以外による効果の補正だけを行う。
 *
 * @param data RPGモジュールのデータ
 * @param skillX スキル効果の倍率（スキル効果がX倍になるレイドボス用）
 * @param _ai 藍オブジェクト（数取りの達人の効果量を出すときに使う）
 * @param msg 確認コマンドのメッセージ（数取りの達人の効果量を出すときに使う。省略時は表示しない）
 * @returns 表示する文字列
 * @internal
 */
export function getTotalEffectString(data: any, skillX = 1, _ai?: 藍, msg?: Message): string {
	const prevRaid = data.raid;
	data.raid = true;

	const skillEffects: SkillEffect = aggregateSkillsEffects(data, skillX);

	/** 使用中の色情報 */
	const color = getColor(data);

	/** 覚醒状態か？*/
	const isSuper = !!color.alwaysSuper;
	const tokens = aggregateTokensEffects(data);

	// 覚醒変更の札・超覚醒の札による補正（レイドでの効果に合わせる）
	if (isSuper) {
		if (tokens.redMode) {
			skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + 0.08
			skillEffects.critDmgUp = Math.max((skillEffects.critDmgUp ?? 0), 0.35)
		} else if (tokens.blueMode) {
			skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.4
		} else if (tokens.yellowMode) {
			skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.2
		} else if (tokens.greenMode) {
			skillEffects.itemEquip = ((1 + (skillEffects.itemEquip ?? 0)) * 1.4) - 1;
			skillEffects.itemBoost = ((1 + (skillEffects.itemBoost ?? 0)) * 1.4) - 1;
			skillEffects.mindMinusAvoid = ((1 + (skillEffects.mindMinusAvoid ?? 0)) * 1.4) - 1;
			skillEffects.poisonAvoid = ((1 + (skillEffects.poisonAvoid ?? 0)) * 1.4) - 1;
		}
		if (tokens.hyperMode) {
			skillEffects.postXUp = (skillEffects.postXUp ?? 0) + 0.015
		}
	}

	// 数取りの達人: 戦闘時と同じく、数取りの直近の参加・勝利から効果量を出す
	let kazutoriBonus: { atk: number; def: number } | undefined;
	if (msg && skillEffects.kazutoriMaster) {
		ensureKazutoriMasterHistory(_ai ?? ai, msg, skillEffects);
		kazutoriBonus = getKazutoriMasterBonus(msg, skillEffects);
	}

	const result = renderEffectDisplay({ e: skillEffects, data, tokens, isSuper, reverseStatus: !!color.reverseStatus, kazutoriBonus });

	data.raid = prevRaid || false;

	return result;
}

export function getHatogurumaEffectString(data: any, skillX = 1): string {
	const prevRaid = data.raid;
	data.raid = true;

	const skillEffects = aggregateSkillsEffects(data, skillX);

	if (!skillEffects) {
		data.raid = prevRaid || false;
		return "";
	}

	const result: string[] = [];
	let dex = 85 + (data.skills?.length ?? 0) * 3;
	let fix = 0;

	result.push(`基本器用さ: ${Math.round(dex)}`);

	if ((data.hatogurumaExp ?? 0) > 1) {
		const expBonus = Math.min(0.3, data.hatogurumaExp / 100);
		result.push(`経験: 器用さ+${Math.round(expBonus * 100)}%`);
		dex = dex * (1 + expBonus);
	}

	const color = getColor(data);
	const atkDmgUp = (skillEffects.atkDmgUp ?? 0) - (skillEffects.defDmgUp ?? 0);
	const atkUp = (skillEffects.atkUp ?? 0) - (skillEffects.defUp ?? 0);
	const atkX =
		(atkDmgUp && atkDmgUp > 0 ? (1 / (1 + (atkDmgUp ?? 0))) : 1) *
		(atkUp && atkUp > 0 ? (1 / (1 + (atkUp ?? 0))) : 1) *
		(color.reverseStatus ? (0.75 + (data.atk / ((data.atk + data.def) || 1)) * 0.5) : (0.75 + (data.def / ((data.atk + data.def) || 1)) * 0.5));

	if (atkX < 1) {
		result.push(`有り余るパワー: 器用さ-${Math.floor((1 - atkX) * 100)}%`);
		dex = dex * atkX;
	}

	if ((skillEffects.notBattleBonusAtk ?? 0) > 0) {
		result.push(`非戦闘時パワー: 器用さ+${Math.round((skillEffects.notBattleBonusAtk ?? 0) * 100)}%`);
		dex = dex * (1 + (skillEffects.notBattleBonusAtk ?? 0));
	} else if ((skillEffects.notBattleBonusAtk ?? 0) < 0) {
		result.push(`非戦闘時パワー低下: 器用さ-${Math.min(25, Math.floor((skillEffects.notBattleBonusAtk ?? 0) * -100))}%`);
		dex = dex * Math.max(0.75, 1 + (skillEffects.notBattleBonusAtk ?? 0));
	}

	if ((skillEffects.notBattleBonusDef ?? 0) > 0) {
		result.push(`非戦闘時防御: 器用さ+${Math.ceil((skillEffects.notBattleBonusDef ?? 0) * 25)}%`);
		dex = dex * (1 + ((skillEffects.notBattleBonusDef ?? 0) / 4));
	}
	if ((skillEffects.noAmuletAtkUp ?? 0) > 0) {
		result.push(`かるわざ: 器用さ+${Math.ceil((skillEffects.noAmuletAtkUp ?? 0) * 200)}%`);
		dex = dex * (1 + ((skillEffects.noAmuletAtkUp ?? 0) * 2));
	}
	if ((skillEffects.plusActionX ?? 0) > 0) {
		result.push(`高速RPG: 器用さ+${Math.ceil((skillEffects.plusActionX ?? 0) * 8)}%`);
		dex = dex * (1 + ((skillEffects.plusActionX ?? 0) * 0.08));
	}
	if ((skillEffects.atkRndMin ?? 0) > 0) {
		result.push(`安定感: 器用さ+${Math.ceil((skillEffects.atkRndMin ?? 0) * 20)}%`);
		dex = dex * (1 + ((skillEffects.atkRndMin ?? 0) / 5));
	}
	if ((skillEffects.firstTurnItem ?? 0) > 0) {
		result.push("準備を怠らない: 器用さ+10%");
		dex = dex * 1.1;
	}
	if ((skillEffects.itemBoost ?? 0) > 0) {
		result.push(`道具効果量: 器用さ+${Math.ceil((skillEffects.itemBoost ?? 0) * 20)}%`);
		dex = dex * (1 + ((skillEffects.itemBoost ?? 0) / 5));
	}
	if ((skillEffects.mindMinusAvoid ?? 0) > 0) {
		result.push(`道具の選択が上手い: 器用さ+${Math.ceil((skillEffects.mindMinusAvoid ?? 0) * (100 / 3))}%`);
		dex = dex * (1 + ((skillEffects.mindMinusAvoid ?? 0) / 3));
	}
	if ((skillEffects.amuletPower ?? 1) > 1) {
		result.push(`お守りパワー: 器用さ+${Math.ceil(((skillEffects.amuletPower ?? 1) - 1) * 3)}%`);
		dex = dex * (1 + (((skillEffects.amuletPower ?? 1) - 1) * 0.03));
	}

	if ((skillEffects.abortDown ?? 0) > 0) {
		result.push(`連続攻撃完遂率上昇: 仕上げ+${Math.ceil((skillEffects.abortDown ?? 0) * 25)}%`);
		fix += Math.floor((skillEffects.abortDown ?? 0) / 4);
	}
	if ((skillEffects.tenacious ?? 0) > 0) {
		result.push(`粘り強さ: 仕上げ+${Math.ceil((skillEffects.tenacious ?? 0) * 25)}%`);
		fix += Math.floor((skillEffects.tenacious ?? 0) / 4);
	}
	if ((skillEffects.endureUp ?? 0) > 0) {
		result.push(`気合で頑張る: 仕上げ+${Math.ceil((skillEffects.endureUp ?? 0) * 15)}%`);
		fix += Math.floor((skillEffects.endureUp ?? 0) * 0.15);
	}

	if (dex < 3) dex = 3;
	if (fix > 0.75) fix = 0.75;

	result.push("");
	result.push(`器用さ: ${Math.round(dex)}`);
	result.push(`仕上げ: ${Math.round(fix * 100)}%`);

	data.raid = prevRaid || false;

	return result.join("\n");
}


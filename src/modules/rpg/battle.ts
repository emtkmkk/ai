/**
 * @packageDocumentation
 *
 * RPGモジュールの戦闘補助計算
 *
 * 数取りの達人スキルの履歴補完・ボーナス計算、ステータス計算（calculateStats）、貫通計算（calculateArpen）、
 * 天国か地獄か（fortune）、ストックランダム（stockRandom）等を提供する。
 *
 * @remarks
 * - 数取りの達人スキルは数取りモジュールの履歴に依存し、戦闘・レイドのステータス倍率に影響する
 * - calculateArpen は敵防御力に対する貫通率を算出する
 *
 * @public
 */
import serifs from "@/serifs";
import type { SkillEffect } from "./skills";
import { aggregateTokensEffects } from "./shop";

const kazutoriMasterWindows = {
	play: 24 * 60 * 60 * 1000,
	win24: 24 * 60 * 60 * 1000,
	win48: 48 * 60 * 60 * 1000,
	win72: 72 * 60 * 60 * 1000,
};

/**
 * 数取りの達人スキルによるステータスボーナス
 *
 * @public
 */
export type KazutoriMasterBonus = {
	atk: number;
	def: number;
	raidBonusFixed: boolean;
};

type KazutoriHistoryGame = {
	isEnded: boolean;
	finishedAt: number;
	votes: {
		user: {
			id: string;
		};
	}[];
	winnerUserId?: string;
};

/**
 * 数取りの達人スキル用に、数取りの履歴（lastPlayedAt / lastWinAt）を補完する
 *
 * kazutori コレクションから過去のプレイ・勝利履歴を参照し、kazutoriData を更新する。
 *
 * @param ai 藍オブジェクト
 * @param msg メッセージ
 * @param skillEffects スキル効果（kazutoriMaster が無い場合は何もしない）
 * @internal
 */
export function ensureKazutoriMasterHistory(ai, msg, skillEffects: SkillEffect): void {
	if (!skillEffects.kazutoriMaster) {
		return;
	}

	const kazutoriData = msg.friend?.doc?.kazutoriData;
	if (!kazutoriData || (kazutoriData.lastPlayedAt !== null && kazutoriData.lastPlayedAt !== undefined && kazutoriData.lastWinAt !== null && kazutoriData.lastWinAt !== undefined)) {
		return;
	}

	const kazutoriHistory = ai?.getCollection?.('kazutori');
	if (!kazutoriHistory) {
		return;
	}

	const now = Date.now();
	const since = now - kazutoriMasterWindows.win72;
	const games = kazutoriHistory
		.chain()
		.find({ isEnded: true })
		.where((game: KazutoriHistoryGame) => (game.finishedAt ?? 0) >= since)
		.data() as KazutoriHistoryGame[];

	if (!games.length) {
		return;
	}

	let updated = false;
	const userId = msg.userId;

	if (kazutoriData.lastPlayedAt === null || kazutoriData.lastPlayedAt === undefined) {
		const lastPlayedAt = games
			.filter((game) => game.votes?.some((vote) => vote.user?.id === userId))
			.reduce((max, game) => Math.max(max, game.finishedAt ?? 0), 0);
		if (lastPlayedAt > 0) {
			kazutoriData.lastPlayedAt = lastPlayedAt;
			updated = true;
		}
	}

	if (kazutoriData.lastWinAt === null || kazutoriData.lastWinAt === undefined) {
		const lastWinAt = games
			.filter((game) => game.winnerUserId === userId)
			.reduce((max, game) => Math.max(max, game.finishedAt ?? 0), 0);
		if (lastWinAt > 0) {
			kazutoriData.lastWinAt = lastWinAt;
			updated = true;
		}
	}

	if (updated && msg.friend?.doc) {
		msg.friend.doc.kazutoriData = kazutoriData;
		msg.friend.save();
	}
}

/**
 * 数取りの達人スキルによるステータスボーナスを取得する
 *
 * 直近のプレイ・勝利時刻に応じて atk / def の倍率と raidBonusFixed を返す。
 *
 * @param msg メッセージ
 * @param skillEffects スキル効果
 * @returns KazutoriMasterBonus
 * @internal
 */
export function getKazutoriMasterBonus(msg, skillEffects: SkillEffect): KazutoriMasterBonus {
	if (!skillEffects.kazutoriMaster) {
		return { atk: 0, def: 0, raidBonusFixed: false };
	}

	const kazutoriData = msg.friend?.doc?.kazutoriData;
	if (!kazutoriData) {
		return { atk: 0, def: 0, raidBonusFixed: false };
	}

	const now = Date.now();
	let atk = 0;
	let def = 0;
	let raidBonusFixed = false;

	if (typeof kazutoriData.lastPlayedAt === "number" && now - kazutoriData.lastPlayedAt <= kazutoriMasterWindows.play) {
		atk += 0.05;
		def += 0.05;
	}

	if (typeof kazutoriData.lastWinAt === "number") {
		const diff = now - kazutoriData.lastWinAt;
		if (diff <= kazutoriMasterWindows.win24) {
			atk += 0.07;
			def += 0.03;
			raidBonusFixed = true;
		} else if (diff <= kazutoriMasterWindows.win48) {
			atk += 0.04;
			def += 0.02;
		} else if (diff <= kazutoriMasterWindows.win72) {
			atk += 0.02;
			def += 0.01;
		}
	}

	return { atk, def, raidBonusFixed };
}

/**
 * 数取りの達人スキルのバフ表示メッセージを取得する
 *
 * @param msg メッセージ
 * @param skillEffects スキル効果
 * @returns 表示するメッセージ、効果がない場合は null
 * @internal
 */
export function getKazutoriMasterMessage(msg, skillEffects: SkillEffect): string | null {
	if (!skillEffects.kazutoriMaster) {
		return null;
	}

	const bonus = getKazutoriMasterBonus(msg, skillEffects);
	const totalPercent = Math.round((bonus.atk + bonus.def) * 100);
	let resultMessage = "";

	if (totalPercent >= 19) {
		resultMessage = "ステータスがかなりアップ！";
	} else if (totalPercent >= 15) {
		resultMessage = "ステータスがとてもアップ！";
	} else if (totalPercent >= 10) {
		resultMessage = "ステータスがアップ！";
	} else if (totalPercent >= 3) {
		resultMessage = "ステータスが少しアップ！";
	} else {
		resultMessage = "効果がなかった！\n（数取りを遊んでみよう！）";
	}

	return `${serifs.rpg.skill.kazutoriMaster}\n${resultMessage}`;
}

/**
 * 数取りの達人スキルの隠しボーナス（クリティカル上昇）を適用する
 *
 * 直近24時間内に数取りでプレイしており、rate が一定以上の場合に critUpFixed を加算する。
 *
 * @param msg メッセージ
 * @param skillEffects スキル効果（破壊的に更新される）
 * @internal
 */
export function applyKazutoriMasterHiddenBonus(msg, skillEffects: SkillEffect): void {
	if (!skillEffects.kazutoriMaster) {
		return;
	}

	const kazutoriData = msg.friend?.doc?.kazutoriData;
	if (!kazutoriData || typeof kazutoriData.lastPlayedAt !== "number") {
		return;
	}

	const now = Date.now();
	if (now - kazutoriData.lastPlayedAt > kazutoriMasterWindows.play) {
		return;
	}

	const rate = typeof kazutoriData.rate === "number" ? kazutoriData.rate : 1000;
	const bonusStep = Math.floor((rate - 1000) / 600);
	const critBonus = Math.min(Math.max(bonusStep, 0), 2);
	if (critBonus <= 0) {
		return;
	}

	skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + (critBonus * 0.01);
}

/**
 * 戦闘用のステータス（atk / def / spd）を算出する
 *
 * レベル・お守り・スキル・数取りボーナス・色の反転等を考慮する。
 *
 * @param data RPGモジュールのデータ
 * @param msg メッセージ
 * @param skillEffects スキル効果
 * @param color 色オブジェクト（reverseStatus で atk/def を入れ替える）
 * @param maxBonus ステータスボーナスの上限（割合）
 * @param kazutoriMasterBonus 数取りの達人ボーナス（省略時は自動取得）
 * @returns { atk, def, spd }
 * @internal
 */
export function calculateStats(data, msg, skillEffects, color, maxBonus = 100, kazutoriMasterBonus?: KazutoriMasterBonus) {
	const stbonus = (((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) + ((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0))) / 2;
	let dataAtk = (data.atk ?? 0)
	let dataDef = (data.def ?? 0)
	if (maxBonus < 1 && dataAtk + dataDef > data.lv * 8) {
		const statusX = data.lv * 8 / (dataAtk + dataDef);
		dataAtk = Math.ceil(dataAtk * statusX);
		dataDef = Math.ceil(dataDef * statusX);
	}
	let atk = Math.max(5 + dataAtk + Math.floor(Math.min(stbonus * ((100 + dataAtk) / 100), (data.atk ?? 0) * maxBonus)), 10);
	let def = Math.max(5 + dataDef + Math.floor(Math.min(stbonus * ((100 + dataDef) / 100), (data.def ?? 0) * maxBonus)), 10);
	let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;

	if (data.maxSpd < spd) data.maxSpd = spd;

	if (spd < 5 && aggregateTokensEffects(data).fivespd) {
		spd = 5;
	}

	if (color.reverseStatus) {
		const _atk = atk;
		atk = def;
		def = _atk;
	}

	const appliedKazutoriMasterBonus = kazutoriMasterBonus ?? getKazutoriMasterBonus(msg, skillEffects);
	const atkUp = (skillEffects.atkUp ?? 0) + appliedKazutoriMasterBonus.atk;
	const defUp = (skillEffects.defUp ?? 0) + appliedKazutoriMasterBonus.def;

	atk *= (1 + atkUp + (data.items?.some((y) => y.type === "amulet") ? 0 : (skillEffects.noAmuletAtkUp ?? 0)));
	def *= (1 + defUp);

	atk *= (1 + (data.atkMedal ?? 0) * 0.01);

	return { atk, def, spd };
}

/**
 * 天国か地獄かスキルの効果を適用する
 *
 * 乱数で atk / def を再分配し、上昇・下降のメッセージを返す。
 *
 * @param _atk 元の攻撃力
 * @param _def 元の防御力
 * @param effect 効果レベル（0 の場合は 1 として扱う）
 * @returns { atk, def, message }
 * @internal
 */
export function fortune(_atk, _def, effect = 0) {

	let atk = _atk;
	let def = _def;

	const zeroEffect = effect === 0;

	if (zeroEffect) effect = 1;

	const rnd = Math.random;

	if (effect % 1 !== 0) {
		atk = Math.floor(atk * (1 + ((effect % 1) * 0.1)));
		def = Math.floor(def * (1 + ((effect % 1) * 0.1)));
		effect = Math.floor(effect);
	}

	for (let i = 0; i < effect; i++) {

		if (!zeroEffect) {
			atk = Math.floor(atk * 1.05);
			def = Math.floor(def * 1.05);
		}

		let targetAllStatus = rnd() < 0.2;

		if (rnd() < 0.5) {
			if (rnd() < 0.5) {
				if (!zeroEffect) {
					atk = Math.floor(atk * 1.01);
					def = Math.floor(def * 1.01);
				}
			} else {
				if (targetAllStatus) {
					if (!zeroEffect) {
						atk = Math.floor(atk * 1.02);
						def = Math.floor(def * 1.02);
					}
					const a = Math.floor(atk);
					const d = Math.floor(def);
					atk = Math.floor((a + d) / 2);
					def = Math.floor((a + d) / 2);
				} else {
					const a = Math.floor(atk * 0.6);
					const d = Math.floor(def * 0.6);
					atk = atk - a + Math.floor((a + d) / 2);
					def = def - d + Math.floor((a + d) / 2);
				}
			}
		} else {
			if (rnd() < 0.5) {
				if (targetAllStatus) {
					if (!zeroEffect) {
						atk = Math.floor(atk * 1.02);
						def = Math.floor(def * 1.02);
					}
					if (rnd() < 0.5) {
						def = def + atk - 1;
						atk = 1;
					} else {
						atk = atk + def;
						def = 0;
					}
				} else {
					const a = Math.floor(atk * 0.3);
					const d = Math.floor(def * 0.3);
					if (rnd() < 0.5) {
						atk = atk - a;
						def = def + a;
					} else {
						atk = atk + d;
						def = def - d;
					}
				}
			} else {
				const a = atk;
				atk = def;
				def = a;
			}
		}
	}


	const atkDiff = Math.floor(atk - _atk);
	const defDiff = Math.floor(def - _def);

	const message = [
		`${serifs.rpg.status.atk} : ${atk ?? 0}${atkDiff !== 0 ? ` (${atkDiff > 0 ? "+" + atkDiff : atkDiff})` : ""}`,
		`${serifs.rpg.status.def} : ${def ?? 0}${defDiff !== 0 ? ` (${defDiff > 0 ? "+" + defDiff : defDiff})` : ""}`,
	].filter(Boolean).join("\n");

	return { atk, def, message };
}

/**
 * ストックランダムスキルの効果を試行する
 *
 * 蓄積カウントに応じた確率で発動し、ランダムにスキル効果を付与する。
 *
 * @param data RPGモジュールのデータ（stockRandomCount が更新される）
 * @param skillEffects スキル効果（破壊的に更新される）
 * @returns { activate, activateStr, skillEffects }
 * @internal
 */
export function stockRandom(data, skillEffects) {

	let activate = false;
	let activateStr = "";

	if (skillEffects?.stockRandomEffect) {

		const probability = Math.min(data.stockRandomCount * 0.012, 0.12);

		if (Math.random() < probability) {
			activate = true;
			let effectPoint = data.stockRandomCount > 5 ? 20 + (data.stockRandomCount - 5) * 2 : data.stockRandomCount * 4;
			activateStr = effectPoint > 20 ? "！".repeat(Math.floor((effectPoint - 11) / 10)) : "！";
			let attackUpFlg = false;
			if (!data.maxStock || data.maxStock < data.stockRandomCount) data.maxStock = data.stockRandomCount;
			data.stockRandomCount = 0;
			const effects: ({ limit: boolean; effect: () => void })[] = [
				{
					limit: !attackUpFlg,
					effect: () => {
						skillEffects.atkDmgUp = (skillEffects.atkDmgUp ?? 0) + Math.min(effectPoint / 100, 0.35);
						effectPoint -= Math.min(effectPoint, 35);
						attackUpFlg = true;
					},
				},
				{
					limit: true,
					effect: () => {
						skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - Math.min(effectPoint / 100, 0.35)
						effectPoint -= Math.min(effectPoint, 35)
					},
				},
				{
					limit: !attackUpFlg,
					effect: () => {
						skillEffects.fire = (skillEffects.fire ?? 0) + Math.min(effectPoint / 800, 0.1)
						skillEffects.ice = (skillEffects.ice ?? 0) + Math.min(effectPoint / 800, 0.1)
						skillEffects.thunder = (skillEffects.thunder ?? 0) + Math.min(effectPoint / 400, 0.2)
						skillEffects.spdUp = (skillEffects.spdUp ?? 0) + Math.min(effectPoint / 800, 0.1)
						skillEffects.dart = (skillEffects.dart ?? 0) + Math.min(effectPoint / 400, 0.2)
						skillEffects.light = (skillEffects.light ?? 0) + Math.min(effectPoint / 400, 0.2)
						skillEffects.dark = (skillEffects.dark ?? 0) + Math.min(effectPoint / 800, 0.1)
						skillEffects.weak = (skillEffects.weak ?? 0) + Math.min(effectPoint / 1333, 0.06)
						effectPoint -= Math.min(effectPoint, 80)
						attackUpFlg = true;
					},
				},
				{
					limit: !attackUpFlg,
					effect: () => {
						skillEffects.itemEquip = (skillEffects.itemEquip ?? 0) + Math.min(effectPoint / 60, 1)
						skillEffects.itemBoost = (skillEffects.itemBoost ?? 0) + Math.min(effectPoint / 60, 1)
						skillEffects.mindMinusAvoid = (skillEffects.mindMinusAvoid ?? 0) + Math.min((effectPoint / 60) * 0.3, 0.3)
						skillEffects.poisonAvoid = (skillEffects.poisonAvoid ?? 0) + Math.min((effectPoint / 60) * 0.8, 0.8)
						effectPoint -= Math.min(effectPoint, 60)
						attackUpFlg = true;
					},
				},
				{
					limit: !attackUpFlg,
					effect: () => {
						skillEffects.critUp = (skillEffects.critUp ?? 0) + Math.min((effectPoint / 30) * 0.8, 0.8)
						skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + Math.min((effectPoint / 30) * 0.09, 0.12)
						skillEffects.critDmgUp = (skillEffects.critDmgUp ?? 0) + Math.min((effectPoint / 30) * 0.8, 0.8)
						effectPoint -= Math.min(effectPoint, 40)
						attackUpFlg = true;
					},
				},
				{
					limit: skillEffects.tenacious <= 0.15,
					effect: () => {
						skillEffects.tenacious = (skillEffects.tenacious ?? 0) + Math.min(effectPoint / 40, 0.75)
						effectPoint -= Math.min(effectPoint, 30)
					},
				},
				{
					limit: skillEffects.firstTurnResist <= 1.4,
					effect: () => {
						skillEffects.firstTurnResist = (skillEffects.firstTurnResist ?? 0) + Math.min((effectPoint / 20) * 0.6, 0.6)
						effectPoint -= Math.min(effectPoint, 20)
					},
				},
				{
					limit: true,
					effect: () => {
						skillEffects.endureUp = (skillEffects.endureUp ?? 0) + Math.min((effectPoint / 20), 1)
						effectPoint -= Math.min(effectPoint, 20)
					},
				},
				{
					limit: skillEffects.firstTurnItem < 1 && effectPoint >= 10,
					effect: () => {
						skillEffects.firstTurnItem = 1;
						skillEffects.firstTurnMindMinusAvoid = 1;
						effectPoint -= Math.min(effectPoint, 10)
					},
				},
				{
					limit: !skillEffects.atkRndMin && !skillEffects.atkRndMax && effectPoint >= 10,
					effect: () => {
						skillEffects.atkRndMin = 0.5;
						skillEffects.atkRndMax = -0.5;
						effectPoint -= Math.min(effectPoint, 10)
					},
				},
				{
					limit: !attackUpFlg && !skillEffects.atkRndMin && !skillEffects.atkRndMax,
					effect: () => {
						skillEffects.atkRndMax = Math.min((effectPoint / 35) * 0.7, 0.7);
						effectPoint -= Math.min(effectPoint, 35)
						attackUpFlg = true;
					},
				},
				{
					limit: !skillEffects.defRndMin && !skillEffects.defRndMax,
					effect: () => {
						skillEffects.defRndMax = Math.min((effectPoint / 35) * -0.7, -0.7);
						effectPoint -= Math.min(effectPoint, 35)
					},
				},
				{
					limit: !skillEffects.defRndMin && !skillEffects.defRndMax,
					effect: () => {
						skillEffects.defRndMin = Math.min((effectPoint / 8) * -0.16, -0.16);
						effectPoint -= Math.min(effectPoint, 8)
					},
				},
				{
					limit: !skillEffects.notRandom && !aggregateTokensEffects(data).notRandom && effectPoint >= 10,
					effect: () => {
						skillEffects.notRandom = 1;
						effectPoint -= Math.min(effectPoint, 10)
					},
				},
				{
					limit: skillEffects.charge,
					effect: () => {
						data.charge = (data.charge ?? 0) + Math.min((effectPoint / 10), 1);
						effectPoint -= Math.min(effectPoint, 10)
					},
				},
				{
					limit: true,
					effect: () => {
						skillEffects.escape = (skillEffects.escape ?? 0) + Math.min((effectPoint / 20) * 2, 2)
						effectPoint -= Math.min(effectPoint, 20)
					},
				},
			]
			while (effectPoint > 0) {
				const filterEffects = effects.filter((x) => x.limit);
				filterEffects[Math.floor(Math.random() * filterEffects.length)].effect();
			}
		} else {
			data.stockRandomCount = (data.stockRandomCount ?? 0) + 1;
		}

	}

	return {
		activate,
		activateStr,
		skillEffects
	};
}

/**
 * 貫通スキルのダメージ倍率を算出する
 *
 * 敵防御力（edef）と Lv に基づき、貫通による追加ダメージ倍率を返す。
 *
 * @param data RPGモジュールのデータ（lv を使用）
 * @param arpen 貫通値（スキル効果）
 * @param edef 敵の防御力
 * @returns 貫通による倍率（1 以上）
 * @internal
 */
export function calculateArpen(data: { lv: number; }, arpen: number, edef: number): number {

		if (!arpen) return 1;
		const D0   = data.lv * 3.5;
		const BASE = 3.0;
		const STEP = 6.0;

		let perSkillPct = 0;
		if (edef > 0) {
			if (edef < D0) {
				perSkillPct = BASE * (edef / D0);
			} else {
				const ratio = edef / D0;
				const n = Math.floor(Math.log2(ratio));
				const L = D0 * Math.pow(2, n);
				const U = L * 2;
				const tRaw = (edef - L) / (U - L);
      			const t = Math.max(0, Math.min(1, tRaw));
				perSkillPct = BASE + (n + t) * STEP;
			}
		}

		return (1 + (perSkillPct / 100) * ((arpen ?? 0) / 0.12));

}

/**
 * 累乗によるソフトキャップを適用する
 *
 * cap1 を超えると gamma 乗で緩和し、cap2 を超えるとさらに緩和する。
 *
 * @param raw 元の値
 * @param cap1 第一キャップ
 * @param cap2 第二キャップ
 * @param gamma 緩和曲線の指数
 * @returns キャップ適用後の値
 * @internal
 */
export function applySoftCapPow2(raw: number, cap1 = 10, cap2 = 25, gamma = 0.5): number {
  const a1 = raw <= cap1 ? raw : cap1 + Math.pow(raw - cap1, gamma);
  const a2 = a1 <= cap2 ? a1 : cap2 + Math.pow(a1 - cap2, gamma);
  return a2;
}

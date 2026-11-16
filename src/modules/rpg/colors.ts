/**
 * @packageDocumentation
 *
 * RPGモジュールの色（着せ替え）定義
 *
 * colors に色の定義を保持する。unlock で解放条件、enhance で覚醒色の適用を判定する。
 * reverseStatus / alwaysSuper で戦闘時のステータス反転・常時覚醒を有効化する。
 *
 * @remarks
 * - colorReply で色変更の返信を処理する
 * - getColor（utils.ts）で現在の色オブジェクトを取得する
 *
 * @public
 */
import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";

export type Color = {
	/** 色のID ユニークでなければならない */
	id: number;
	/** 見た目 絵文字などを指定 */
	name: string;
	/** 色変更の際にここに指定したキーワードが入っていたら選択される */
	keyword: string;
	/** 解放条件 trueなら変更可能になる */
	unlock: (data?: any) => boolean;
	/** 色一覧に表示するメッセージ 解放条件について記載するのが望ましい */
	message: (data?: any) => string;
	/** この色が初期状態として使用されるかどうか */
	default?: boolean;
	/** 攻撃と防御が入れ替わる効果があるかどうか */
	reverseStatus?: boolean;
	/** 常に覚醒になる効果があるかどうか */
	alwaysSuper?: boolean;
	/** 隠し色かどうか */
	hidden?: boolean;
	/** 強化 */
	enhance?: (data?: any) => boolean;
};

/** 色一覧 */
export const colors: Color[] = [
	{
		id: 1,
		name: ":mk_hero:",
		keyword: "1",
		unlock: () => true,
		message: () => serifs.rpg.color.default,
		default: true,
		enhance: (data) => enhanceCount(data,[1]) >= 8,
	},
	{
		id: 2,
		name: ":mk_hero_2p:",
		keyword: "2",
		unlock: (data) => (data.lv ?? 1) >= 99,
		message: (data) => (data.lv ?? 1) >= 99 ? `${serifs.rpg.color.unlock} (Lv: **${(data.lv ?? 1)}**)` : `Lv99になると解放されます。(**${(data.lv ?? 1)}** / 99)`,
		enhance: (data) => (data.atk ?? 0) + (data.def ?? 0) >= (299 * 7.5),
	},
	{
		id: 3,
		name: ":mk_hero_3p:",
		keyword: "3",
		unlock: (data) => (data.maxEndress ?? 0) >= 6,
		message: (data) => (data.maxEndress ?? 0) >= 6 ? `${serifs.rpg.color.unlock} (旅最高ステージ数: **${(data.maxEndress ?? 1) + 1}**)` : `「旅モード」にて、ステージ7の目的地到達で解放されます。(**${(data.maxEndress ?? -1) + 1}** / 7)`,
		enhance: (data) => (data.maxEndress ?? 0) >= 39,
	},
	{
		id: 4,
		name: ":mk_hero_4p:",
		keyword: "4",
		unlock: (data) => data.allClear,
		message: (data) => data.allClear ? `${serifs.rpg.color.unlock} (クリアLv: **${(data.allClear ?? "?")}**)` : `連勝で全ての敵を倒すと解放されます。${data.clearEnemy?.length ? `(現在 **${data.clearEnemy.length}** 連勝中)` : ""}`,
		enhance: (data) => Math.max((data.winCount ?? 0) - 120, 0) + (data.hardWinCount ?? 0) * 7 >= 210,
	},
	{
		id: 5,
		name: ":mk_hero_5p:",
		keyword: "5",
		unlock: (data) => (data.thirdFire ?? 0) >= 3,
		message: (data) => (data.thirdFire ?? 0) >= 3 ? `${serifs.rpg.color.unlock} (最大🔥: **${(data.thirdFire ?? 0)}**)` : `1戦闘で🔥を3回受けると解放されます。(**${(data.thirdFire ?? 0)}** / 3)`,
		enhance: (data) => (data.thirdFire ?? 0) >= 6,
	},
	{
		id: 6,
		name: ":mk_hero_6p:",
		keyword: "6",
		unlock: (data) => (data.superMuscle ?? 0) >= 300,
		message: (data) => (data.superMuscle ?? 0) >= 300 ? `${serifs.rpg.color.unlock} (最大耐ダメージ: **${(data.superMuscle ?? 0)}**)` : `一撃で300ダメージ以上受け、倒れなかった場合に解放されます。(**${(data.superMuscle ?? 0)}** / 300)`,
		enhance: (data) => (data.clearRaidNum ?? 0) >= 14,
	},
	{
		id: 7,
		name: ":mk_hero_7p:",
		keyword: "7",
		unlock: (data) => (data.winCount ?? 0) >= 100 || data.maxStatusUp >= 12,
		message: (data) => (data.winCount ?? 0) >= 100 || data.maxStatusUp >= 12 ? `${serifs.rpg.color.unlock} (勝利数: **${(data.winCount ?? 0)}**) (運: **${(data.maxStatusUp ?? 7)}**)` : `100回勝利する、または運が良いと解放されます。(**${(data.winCount ?? 0)}** / 100) (**${(data.maxStatusUp ?? 7)}** / 12)`,
		enhance: (data) => (data.winCount ?? 0) + (data.maxStatusUp ?? 0) * 40 >= 710,
	},
	{
		id: 8,
		name: ":mk_hero_8p:",
		keyword: "8",
		unlock: (data) => (data.clearHistory ?? []).includes(":mk_hero_8p:"),
		message: (data) => (data.clearHistory ?? []).includes(":mk_hero_8p:") ? `${serifs.rpg.color.unlock} (クリアLv: **${(data.aHeroLv ?? "?")}**)` : ":mk_hero_8p:を1度でも倒すと解放されます。",
		reverseStatus: true,
		enhance: (data) => data.superCount >= 20 || data.superUnlockCount >= 100,
	},
	{
		id: 9,
		name: ":mk_hero_9p:",
		keyword: "9",
		unlock: (data) => unlockCount(data, [9]) >= 8 || (data.superCount ?? 0) >= Math.ceil(100 * (7 - unlockCount(data, [9], true)) / 7) - unlockCount(data, [9], true),
		message: (data) => unlockCount(data, [9]) >= 8 || (data.superCount ?? 0) >= Math.ceil(100 * (7 - unlockCount(data, [9], true)) / 7) - unlockCount(data, [9], true) ? `${serifs.rpg.color.unlock} (気合耐え発動率: **${10 + (data.endure ?? 0) * 5}** %)` : `色を8種類解放する、または${Math.ceil(100 * (7 - unlockCount(data, [9], true)) / 7) - unlockCount(data, [9], true)}回覚醒すると解放されます。(**${unlockCount(data, [9])}** / 8) (**${(data.superCount ?? 0)}** / ${Math.ceil(100 * (7 - unlockCount(data, [9], true)) / 7) - unlockCount(data, [9], true)})`,
		alwaysSuper: true,
	},
	{
		id: 10,
		name: ":mk_chicken_t:",
		keyword: "0",
		unlock: (data) => (data.maxEndress ?? 0) >= 29,
		message: (data) => `${serifs.rpg.color.unlock}`,
		hidden: true,
		enhance: (data) => data.jar >= 3 || (data.maxEndress ?? 0) >= 59,
	}
];

export const unlockCount = (data, excludeIds: number[] = [], excludeDefault = false) => {
	return (excludeDefault ? colors.filter((x) => !excludeIds.includes(x.id)).filter((x) => !x.default) : colors.filter((x) => !excludeIds.includes(x.id))).reduce((acc, value) => acc + (value.unlock(data) ? 1 : 0), 0);
};

export const enhanceCount = (data, excludeIds: number[] = []) => {
	return (colors.filter((x) => !excludeIds.includes(x.id))).reduce((acc, value) => acc + (value.enhance && value.enhance(data) ? 1 : 0), 0);
};

/** 色に関しての情報を返す */
export const colorReply = (module: Module, msg: Message) => {

	// データを読み込み
	const data = msg.friend.getPerModulesData(module);
	if (!data) return false;

	if (msg.includes([serifs.rpg.command.change])) {
		// 文字数が多い物を先に判定
		const sortedColors = colors.sort((a, b) => b.keyword.length - a.keyword.length);
		for (let i = 0; i < sortedColors.length; i++) {
			if (msg.includes([sortedColors[i].keyword])) {
				if (sortedColors[i].unlock(data)) {
					data.color = sortedColors[i].id;
					msg.friend.setPerModulesData(module, data);
					return {
						reaction: ':mk_muscleok:'
					};
				} else {
					return {
						reaction: 'confused'
					};
				}
			}
		}
	}

	const superUnlock = colors.find((x) => x.alwaysSuper)?.unlock(data);

	msg.reply([
		serifs.rpg.color.info,
		"",
		serifs.rpg.color.list,
		...colors.filter((x) => !x.hidden || x.unlock(data)).map((x) => `${x.keyword}: ${x.name} ${superUnlock && x.enhance && x.enhance(data) ? x.message(data)?.replace(serifs.rpg.color.default, "**強化済み**").replace(serifs.rpg.color.unlock, "**強化済み**") : x.message(data)}`)
	].join("\n"));

	return {
		reaction: 'love'
	};

};

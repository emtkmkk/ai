import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";

type Color = {
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
};

/** 色一覧 */
export const colors: Color[] = [
	{
		id: 1,
		name: ":aichan:",
		keyword: "1",
		unlock: () => true,
		message: () => serifs.rpg.color.default,
		default: true,
	},
	{
		id: 2,
		name: ":aichan2:",
		keyword: "2",
		unlock: (data) => (data.lv ?? 1) >= 99,
		message: (data) =>
			(data.lv ?? 1) >= 99
				? `${serifs.rpg.color.unlock} (Lv: **${data.lv ?? 1}**)`
				: `わらわがLv99のつよーい狐になると解放されちゃうのじゃ！(**${
						data.lv ?? 1
				  }** / 99)`,
	},
	{
		id: 3,
		name: ":aichan3:",
		keyword: "3",
		unlock: (data) => (data.maxEndress ?? 0) >= 6,
		message: (data) =>
			(data.maxEndress ?? 0) >= 6
				? `${serifs.rpg.color.unlock} (修行最高ステージ数: **${
						(data.maxEndress ?? 1) + 1
				  }**)`
				: `高難度コンテンツ「修行モード」でステージ7の目的地到達すると解放できるようじゃ！(**${
						(data.maxEndress ?? -1) + 1
				  }** / 7)`,
	},
	{
		id: 4,
		name: ":aichan4:",
		keyword: "4",
		unlock: (data) => data.allClear,
		message: (data) =>
			data.allClear
				? `${serifs.rpg.color.unlock} (クリアLv: **${data.allClear ?? "?"}**)`
				: `連勝で全ての敵を倒すと解放されちゃうのじゃ！ふっふーん！${
						data.clearEnemy?.length
							? `(現在 **${data.clearEnemy.length}** 連勝中)`
							: ""
				  }`,
	},
	{
		id: 5,
		name: ":aichan5:",
		keyword: "5",
		unlock: (data) => (data.thirdFire ?? 0) >= 3,
		message: (data) =>
			(data.thirdFire ?? 0) >= 3
				? `${serifs.rpg.color.unlock} (最大🔥: **${data.thirdFire ?? 0}**)`
				: `1戦闘で🔥を3回受けると解放されちゃうのじゃー！辛いのはいやじゃー！(**${
						data.thirdFire ?? 0
				  }** / 3)`,
	},
	{
		id: 6,
		name: ":aichan6:",
		keyword: "6",
		unlock: (data) => (data.superMuscle ?? 0) >= 300,
		message: (data) =>
			(data.superMuscle ?? 0) >= 300
				? `${serifs.rpg.color.unlock} (最大耐ダメージ: **${
						data.superMuscle ?? 0
				  }**)`
				: `一撃で300ダメージ以上受け、それでも倒れなかった場合に生命力がつよーいわらわが解放されちゃうのじゃ！(**${
						data.superMuscle ?? 0
				  }** / 300)`,
	},
	{
		id: 7,
		name: ":aichan7:",
		keyword: "7",
		unlock: (data) => (data.winCount ?? 0) >= 100 || data.maxStatusUp >= 12,
		message: (data) =>
			(data.winCount ?? 0) >= 100 || data.maxStatusUp >= 12
				? `${serifs.rpg.color.unlock} (勝利数: **${
						data.winCount ?? 0
				  }**) (運: **${data.maxStatusUp ?? 7}**)`
				: `100回勝利する、または運が良いと解放されるのじゃ(**${
						data.winCount ?? 0
				  }** / 100) (**${data.maxStatusUp ?? 7}** / 12)`,
	},
	{
		id: 8,
		name: ":aichan8:",
		keyword: "8",
		unlock: (data) => (data.clearHistory ?? []).includes(":aichan8:"),
		message: (data) =>
			(data.clearHistory ?? []).includes(":aichan8:")
				? `${serifs.rpg.color.unlock} (クリアLv: **${data.aHeroLv ?? "?"}**)`
				: ":aichan8:を1度でも倒すと解放される…？いったい誰なのじゃ…？",
		reverseStatus: true,
	},
	{
		id: 9,
		name: ":aichan9:",
		keyword: "9",
		unlock: (data) =>
			unlockCount(data, [9]) >= 8 ||
			(data.superCount ?? 0) >=
				Math.ceil((100 * (7 - unlockCount(data, [9], true))) / 7),
		message: (data) =>
			unlockCount(data, [9]) >= 8 ||
			(data.superCount ?? 0) >=
				Math.ceil((100 * (7 - unlockCount(data, [9], true))) / 7)
				? `${serifs.rpg.color.unlock} (踏ん張り発動率: **${
						10 + (data.endure ?? 0) * 5
				  }** %)`
				: `色を8種類解放する、または${Math.ceil(
						(100 * (7 - unlockCount(data, [9], true))) / 7
				  )}回覚醒すると解放されちゃうのじゃ！(**${unlockCount(data, [
						9,
				  ])}** / 8) (**${data.superCount ?? 0}** / ${Math.ceil(
						(100 * (7 - unlockCount(data, [9], true))) / 7
				  )})`,
		alwaysSuper: true,
	},
];

export const unlockCount = (
	data,
	excludeIds: number[] = [],
	excludeDefault = false
) => {
	return (
		excludeDefault
			? colors
					.filter((x) => !excludeIds.includes(x.id))
					.filter((x) => !x.default)
			: colors.filter((x) => !excludeIds.includes(x.id))
	).reduce((acc, value) => acc + (value.unlock(data) ? 1 : 0), 0);
};

/** 色に関しての情報を返す */
export const colorReply = (module: Module, msg: Message) => {
	// データを読み込み
	const data = msg.friend.getPerModulesData(module);
	if (!data) return false;

	if (msg.includes(["変更"])) {
		// 文字数が多い物を先に判定
		const sortedColors = colors.sort(
			(a, b) => b.keyword.length - a.keyword.length
		);
		for (let i = 0; i < sortedColors.length; i++) {
			if (msg.includes([sortedColors[i].keyword])) {
				if (sortedColors[i].unlock(data)) {
					data.color = sortedColors[i].id;
					msg.friend.setPerModulesData(module, data);
					return {
						reaction: ":neofox_thumbsup:",
					};
				} else {
					return {
						reaction: ":neofox_confused:",
					};
				}
			}
		}
	}

	msg.reply(
		[
			serifs.rpg.color.info,
			"",
			serifs.rpg.color.list,
			...colors.map((x) => `${x.keyword}: ${x.name} ${x.message(data)}`),
		].join("\n")
	);

	return {
		reaction: ":neofox_heart:",
	};
};

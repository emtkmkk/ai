export const colors = [
    {
        name: ":mk_hero:",
        keyword: "1",
        unlock: () => true,
        message: () => "初期解放",
    },
    {
        name: ":mk_hero_2p:",
        keyword: "2",
        unlock: (data) => (data.lv ?? 1) >= 99,
        message: (data) => (data.lv ?? 1) >= 99 ? `解放済み (Lv: **${(data.lv ?? 1)}**)` : `Lv99になると解放されます。(**${(data.lv ?? 1)}** / 99)`,
    },
    {
        name: ":mk_hero_3p:",
        keyword: "3",
        unlock: (data) => (data.maxEndress ?? 0) >= 7,
        message: (data) => (data.maxEndress ?? 0) >= 7 ? `解放済み (旅最高日数: **${(data.lv ?? 1)}**)` : `7日以上連続で旅をすると解放されます。(**${(data.maxEndress ?? 0)}** / 7)`,
    },
    {
        name: ":mk_hero_4p:",
        keyword: "4",
        unlock: (data) => data.allClear,
        message: (data) => data.allClear ? `解放済み (クリアLv: **${(data.allClear ?? "?")}**)` : "負けずに全ての敵を1度でも倒すと解放されます。",
    },
    {
        name: ":mk_hero_5p:",
        keyword: "5",
        unlock: (data) => (data.thirdFire ?? 0) >= 3,
        message: (data) => (data.thirdFire ?? 0) >= 3 ? `解放済み (最大🔥: **${(data.thirdFire ?? 0)}**)` : `1戦闘で🔥を3回受けると解放されます。(**${(data.thirdFire ?? 0)}** / 3)`,
    },
    {
        name: ":mk_hero_6p:",
        keyword: "6",
        unlock: (data) => (data.superMuscle ?? 0) >= 300,
        message: (data) => (data.superMuscle ?? 0) >= 300 ? `解放済み (最大耐ダメージ: **${(data.superMuscle ?? 0)}**)` : `一撃で300ダメージ以上受け、倒れなかった場合に解放されます。(**${(data.superMuscle ?? 0)}** / 300)`,
    },
    {
        name: ":mk_hero_7p:",
        keyword: "7",
        unlock: (data) => (data.winCount ?? 0) >= 100 || data.maxStatusUp >= 12,
        message: (data) => (data.winCount ?? 0) >= 100 || data.maxStatusUp >= 12 ? `解放済み (勝利数: **${(data.winCount ?? 0)}**) (運: **${(data.maxStatusUp ?? 7)}**)` : `100回勝利する、または運が良いと解放されます。(**${(data.winCount ?? 0)}** / 100) (**${(data.maxStatusUp ?? 7)}** / 12)`,
    },
    {
        name: ":mk_hero_8p:",
        keyword: "8",
        unlock: (data) => (data.clearHistory ?? []).includes(":mk_hero_8p:"),
        message: (data) => (data.clearHistory ?? []).includes(":mk_hero_8p:") ? `解放済み (クリアLv: **${(data.aHeroLv ?? "?")}**)` : ":mk_hero_8p:を1度でも倒すと解放されます。",
    },
    {
        name: ":mk_hero_9p:",
        keyword: "9",
        unlock: (data) => colors.filter((x) => x.name !== ":mk_hero_9p:").every((x) => x.unlock(data)),
        message: (data) => colors.filter((x) => x.name !== ":mk_hero_9p:").every((x) => x.unlock(data)) ? `解放済み (踏ん張り発動率: **${10 + (data.endure ?? 0) * 5}** %)` : `全ての色を解放する、または100回覚醒すると解放されます。(**${colors.reduce((acc, value) => acc + (value.unlock(data) ? 1 : 0), 0)}** / ${colors.length - 1}) (**${(data.superCount ?? 0)}** / 100)`,
    }
]

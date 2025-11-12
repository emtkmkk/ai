import { getColor } from "@/modules/rpg/utils";
import { colors } from "@/modules/rpg/colors";

describe("getColor", () => {
    test("フォールバック時の色をディープコピーし、他ユーザー表示を汚染しない", () => {
        const fallbackData: any = {
            color: 2,
            lv: 1,
            atk: 2500,
            def: 500,
            maxEndress: 60,
            allClear: true,
            thirdFire: 6,
            superMuscle: 400,
            clearRaidNum: 14,
            winCount: 200,
            hardWinCount: 30,
            maxStatusUp: 15,
            clearHistory: [":mk_hero_8p:"],
            superCount: 999,
            superUnlockCount: 100,
            jar: 3,
        };

        const fallbackColor = getColor(fallbackData);
        const defaultColor = colors.find((x) => x.default) ?? colors[0];

        expect(fallbackColor.id).toBe(defaultColor.id);
        expect(fallbackColor.alwaysSuper).toBe(true);
        expect(fallbackColor.name).toBe(`$[sparkle ${defaultColor.name}]`);
        expect(defaultColor.alwaysSuper).toBeUndefined();
        expect(defaultColor.name).toBe(":mk_hero:");

        const otherUserColor = getColor({});
        expect(otherUserColor.name).toBe(":mk_hero:");
        expect(otherUserColor.alwaysSuper).toBeUndefined();
    });
});

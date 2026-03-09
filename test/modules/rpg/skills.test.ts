import { getHatogurumaEffectString } from "@/modules/rpg/skills";

describe("getHatogurumaEffectString", () => {
	test("鳩車レイド用の器用さ・仕上げを表示する", () => {
		const data: any = {
			lv: 120,
			atk: 120,
			def: 80,
			raid: false,
			skills: [
				{ name: "高速RPG" },
				{ name: "準備を怠らない" },
			],
			hatogurumaExp: 10,
		};

		const text = getHatogurumaEffectString(data);

		expect(text).toContain("器用さ:");
		expect(text).toContain("仕上げ:");
		expect(data.raid).toBe(false);
	});
});

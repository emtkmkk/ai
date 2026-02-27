import serifs from "@/serifs";

describe("serifs.kazutori.finishWithWinner", () => {
	test("中央値2人勝利の文面を生成できる", () => {
		const text = serifs.kazutori.finishWithWinner(
			"@xxx",
			"zzz",
			"@yyy",
			"aaa",
			"チョコ",
			false,
			false,
			12,
			null,
			8,
			null,
			{
				beforeRate: 1100,
				afterRate: 1111,
				beforeRank: 10,
				afterRank: 9,
				beforeRate2: 1000,
				afterRate2: 1012,
				beforeRank2: 30,
				afterRank2: 28,
			}
		);

		expect(text).toContain("今回は@xxxさん(zzz)と@yyyさん(aaa)の勝ちです！おめでとう！");
		expect(text).toContain("@xxxさん :\nレート : 1100 → 1111\n順位 : 10位 → 9位");
		expect(text).toContain("@yyyさん :\nレート : 1000 → 1012\n順位 : 30位 → 28位");
		expect(text).toContain("景品としてチョコをどうぞ！");
	});
});

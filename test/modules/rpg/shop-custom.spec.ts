/**
 * @packageDocumentation
 *
 * カスタムショップの隠し機能（短縮名で返信 → 購入確認 → はい/いいえ）のテスト
 */
// shop-custom → skills → shop の循環 import で初期化順が崩れないよう、先に shop を読み込む
import "@/modules/rpg/shop";
import { shopCustomContextHook, shopCustomConfirmContextHook } from "@/modules/rpg/shop-custom";
import { skillCalculate } from "@/modules/rpg/skills";

describe("カスタムショップ: 短縮名でのパーツ購入", () => {
	// パーツの値段はスキルの所持人数から決まるため、所持者を何人か用意する
	const friends = ["炎属性剣攻撃", "雷属性剣攻撃", "パワーアップ", "粘り強い"].map((name) => ({ perModulesData: { rpg: { lv: 100, skills: [{ name }] } } }));
	const ai: any = { friends: { find: () => friends }, account: { id: "bot" } };
	skillCalculate(ai);

	const buildHarness = (rpg: Record<string, unknown>) => {
		const doc: any = { perModulesData: { rpg: { lv: 300, coin: 1000, shopExp: 0, items: [], tempAmulet: [], ...rpg } } };
		const replies: string[] = [];
		const msg: any = {
			userId: "user-a",
			user: { username: "a", host: null },
			text: "",
			extractedText: "",
			reply: jest.fn(async (text: string) => { replies.push(text); return { id: `reply-${replies.length}` }; }),
			friend: {
				doc,
				getPerModulesData: () => doc.perModulesData.rpg,
				setPerModulesData: (_m: any, d: any) => { doc.perModulesData.rpg = d; },
			},
		};
		const module: any = { name: "rpg", subscribeReply: jest.fn(), unsubscribeReply: jest.fn() };
		return { doc, msg, module, replies };
	};

	test("短縮名で返信すると説明と値段を返し、確認を待ち受ける", async () => {
		const { msg, module, replies, doc } = buildHarness({});
		msg.extractedText = "毒";
		const result = await shopCustomContextHook(module, ai, "shopCustom:user-a", msg, { skills: [] });

		expect(result).toEqual({ reaction: "love" });
		expect(replies[0]).toMatch(/^毒属性剣攻撃のパーツ \d+枚\n戦闘時、ターン経過ごとに相手が弱体化します\n\nこのパーツを購入しますか？はいかいいえで返信してください。$/);
		expect(module.subscribeReply).toHaveBeenCalledWith("shopCustomConfirm:user-a", "reply-1", { skill: "毒属性剣攻撃" });
		// 確認前なのでパーツは付かない
		expect(doc.perModulesData.rpg.tempAmulet).toEqual([]);
	});

	test("「はい」でパーツが付き、コインが減る", async () => {
		const { msg, module, doc } = buildHarness({});
		msg.text = "はい";
		await shopCustomConfirmContextHook(module, ai, "shopCustomConfirm:user-a", msg, { skill: "炎属性剣攻撃" });

		const data = doc.perModulesData.rpg;
		expect(data.tempAmulet).toEqual(["炎属性剣攻撃"]);
		expect(data.coin).toBeLessThan(1000);
		expect(data.coin + data.tempAmuletCost).toBe(1000);
		expect(module.unsubscribeReply).toHaveBeenCalledWith("shopCustomConfirm:user-a");
	});

	test("「いいえ」ではパーツは付かない", async () => {
		const { msg, module, doc } = buildHarness({});
		msg.text = "いいえ";
		await shopCustomConfirmContextHook(module, ai, "shopCustomConfirm:user-a", msg, { skill: "炎属性剣攻撃" });

		expect(doc.perModulesData.rpg.tempAmulet).toEqual([]);
		expect(doc.perModulesData.rpg.coin).toBe(1000);
	});

	test("2つ指定された場合は左のスキルを優先する", async () => {
		const { msg, module } = buildHarness({});
		msg.extractedText = "雷毒";
		await shopCustomContextHook(module, ai, "shopCustom:user-a", msg, { skills: [] });

		expect(module.subscribeReply).toHaveBeenCalledWith("shopCustomConfirm:user-a", "reply-1", { skill: "雷属性剣攻撃" });
	});

	test("短縮名以外の文字が混ざった返信には反応しない", async () => {
		const { msg, module } = buildHarness({});
		msg.extractedText = "毒です";
		const result = await shopCustomContextHook(module, ai, "shopCustom:user-a", msg, { skills: [] });

		expect(result).toBe(false);
		expect(module.subscribeReply).not.toHaveBeenCalled();
	});

	test("パーツにできないスキル（重複しないスキル）は既存の処理と同じになる", async () => {
		const { msg, module, replies } = buildHarness({});
		msg.extractedText = "武";
		const result = await shopCustomContextHook(module, ai, "shopCustom:user-a", msg, { skills: [] });

		expect(result).toEqual({ reaction: "hmm" });
		expect(replies).toEqual([]);
		expect(module.subscribeReply).not.toHaveBeenCalled();
	});

	test("作成中のお守りに既にあるパーツは既存の処理と同じになる", async () => {
		const { msg, module, replies } = buildHarness({ tempAmulet: ["炎属性剣攻撃"], tempAmuletCost: 20 });
		msg.extractedText = "炎";
		const result = await shopCustomContextHook(module, ai, "shopCustom:user-a", msg, { skills: [] });

		expect(result).toEqual({ reaction: "hmm" });
		expect(replies).toEqual([]);
	});

	test("コインが足りない場合は既存の購入処理と同じメッセージを返す", async () => {
		const { msg, module, replies } = buildHarness({ coin: 0 });
		msg.extractedText = "毒";
		const result = await shopCustomContextHook(module, ai, "shopCustom:user-a", msg, { skills: [] });

		expect(result).toEqual({ reaction: "hmm" });
		expect(replies[0]).toContain("コインが足りません");
		expect(module.subscribeReply).not.toHaveBeenCalled();
	});

	test("確認中にコインが足りなくなっていたら購入しない", async () => {
		const { msg, module, doc } = buildHarness({ coin: 0 });
		msg.text = "はい";
		await shopCustomConfirmContextHook(module, ai, "shopCustomConfirm:user-a", msg, { skill: "炎属性剣攻撃" });

		expect(doc.perModulesData.rpg.tempAmulet).toEqual([]);
	});
});

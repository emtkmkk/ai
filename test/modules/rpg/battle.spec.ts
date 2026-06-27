import { applyKazutoriMasterPostCountFloor, applyWeakAtkReduction, ensureKazutoriMasterHistory } from "@/modules/rpg/battle";

describe("ensureKazutoriMasterHistory", () => {
	test("winnerUserId2 でも lastWinAt を補完する", () => {
		const games = [
			{
				isEnded: true,
				finishedAt: Date.now() - 1000,
				votes: [{ user: { id: "user-a" } }],
				winnerUserId: "someone-else",
				winnerUserId2: "user-a",
			},
		];

		const ai = {
			getCollection: () => ({
				chain() {
					return this;
				},
				find() {
					return this;
				},
				where(predicate) {
					return {
						data: () => games.filter(predicate),
					};
				},
			}),
		};

		const save = jest.fn();
		const msg: any = {
			userId: "user-a",
			friend: {
				doc: {
					kazutoriData: {
						lastPlayedAt: null,
						lastWinAt: null,
					},
				},
				save,
			},
		};

		ensureKazutoriMasterHistory(ai, msg, { kazutoriMaster: 1 } as any);

		expect(msg.friend.doc.kazutoriData.lastWinAt).toBe(games[0].finishedAt);
		expect(msg.friend.doc.kazutoriData.lastPlayedAt).toBe(games[0].finishedAt);
		expect(save).toHaveBeenCalled();
	});
});

describe("applyKazutoriMasterPostCountFloor", () => {
	const now = Date.now();
	/** 直近24時間以内勝利（raidBonusFixed 真） */
	const winWithin24hKazutoriData = {
		lastPlayedAt: now - 60 * 60 * 1000,
		lastWinAt: now - 60 * 60 * 1000,
	};

	const baseMsg: any = {
		friend: {
			doc: {
				kazutoriData: winWithin24hKazutoriData,
			},
		},
	};

	test("数取りの達人を持たない場合、元の投稿数を返す", () => {
		expect(applyKazutoriMasterPostCountFloor(30, baseMsg, {})).toBe(30);
	});

	test("直近24時間以内に勝利していない場合、元の投稿数を返す", () => {
		const msg: any = {
			friend: {
				doc: {
					kazutoriData: {
						lastPlayedAt: now - 60 * 60 * 1000,
						lastWinAt: now - 30 * 60 * 60 * 1000,
					},
				},
			},
		};
		expect(applyKazutoriMasterPostCountFloor(30, msg, { kazutoriMaster: 1 })).toBe(30);
	});

	test("24時間以内勝利のみでも（24時間以内参加なし）、下限が適用される", () => {
		const msg: any = {
			friend: {
				doc: {
					kazutoriData: {
						lastPlayedAt: now - 48 * 60 * 60 * 1000,
						lastWinAt: now - 60 * 60 * 1000,
					},
				},
			},
		};
		expect(applyKazutoriMasterPostCountFloor(30, msg, { kazutoriMaster: 1 })).toBe(100);
	});

	test("24時間以内勝利かつ1スタックの場合、100未満は100に引き上げられる", () => {
		expect(applyKazutoriMasterPostCountFloor(30, baseMsg, { kazutoriMaster: 1 })).toBe(100);
		expect(applyKazutoriMasterPostCountFloor(100, baseMsg, { kazutoriMaster: 1 })).toBe(100);
	});

	test("24時間以内勝利かつ1スタックの場合、100超はそのまま", () => {
		expect(applyKazutoriMasterPostCountFloor(120, baseMsg, { kazutoriMaster: 1 })).toBe(120);
	});

	test("24時間以内勝利かつ2スタックの場合、下限は125", () => {
		expect(applyKazutoriMasterPostCountFloor(30, baseMsg, { kazutoriMaster: 2 })).toBe(125);
	});

	test("24時間以内勝利かつ3スタックの場合、下限は150", () => {
		expect(applyKazutoriMasterPostCountFloor(30, baseMsg, { kazutoriMaster: 3 })).toBe(150);
	});
});

describe("applyWeakAtkReduction", () => {
	const ea0 = 1_000_000;

	test("削減量0の場合、敵攻撃力は変わらない", () => {
		expect(applyWeakAtkReduction(ea0, 0)).toBe(ea0);
	});

	test("第1段階(50%)までは100%の効率で削減される", () => {
		expect(applyWeakAtkReduction(ea0, 250_000)).toBe(750_000);
		expect(applyWeakAtkReduction(ea0, 500_000)).toBe(500_000);
	});

	test("50%超の削減は1/2効率になる", () => {
		// raw 0.5*ea0 で 50% 削減後、残り raw 0.5*ea0 → 追加 25% 削減 → 合計 75%
		expect(applyWeakAtkReduction(ea0, 1_000_000)).toBe(250_000);
	});

	test("段階的に 50%→75%→87.5% まで削減できる", () => {
		expect(applyWeakAtkReduction(ea0, 500_000)).toBe(500_000);
		expect(applyWeakAtkReduction(ea0, 1_000_000)).toBe(250_000);
		expect(applyWeakAtkReduction(ea0, 1_500_000)).toBe(125_000);
	});

	test("理論上限(100%)まで削減できるが、非常に大きな raw が必要", () => {
		expect(applyWeakAtkReduction(ea0, 2_000_000)).toBe(62_500);
		expect(applyWeakAtkReduction(ea0, 10_000_000)).toBeLessThan(1);
	});

	test("敵攻撃力0以下の入力は0を返す", () => {
		expect(applyWeakAtkReduction(0, 100)).toBe(0);
	});
});

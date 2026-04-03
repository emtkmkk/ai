import { applyKazutoriMasterPostCountFloor, ensureKazutoriMasterHistory } from "@/modules/rpg/battle";

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

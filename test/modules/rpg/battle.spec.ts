import { ensureKazutoriMasterHistory } from "@/modules/rpg/battle";

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

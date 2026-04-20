/**
 * @packageDocumentation
 *
 * RPG レイドモジュールの並列シミュレーションハーネス（平行次元のお札）に関するテスト
 *
 * @remarks
 * - `runParallelDimensionRaid` は raid.ts の公開関数で、msg.reply / msg.friend.setPerModulesData を
 *   一時的に差し替えて副作用を抑止し、最大スコアの次元だけを正史として採用する。
 * - ここではダメージ計算関数（getTotalDmg*）をモックし、ハーネス自体の振る舞いだけを検証する。
 */
import { runParallelDimensionRaid } from "@/modules/rpg/raid";

describe("runParallelDimensionRaid", () => {
	/**
	 * テスト用の msg / friend / module モックを組み立てる
	 *
	 * @param initialData - 初期 perModulesData[rpg]
	 * @returns msg / module / helpers
	 */
	const buildHarness = (initialData: Record<string, unknown> = {}) => {
		const setPerModulesData = jest.fn((_module: any, data: any) => {
			msg.friend.doc.perModulesData[module.name] = data;
		});
		const reply = jest.fn(async (..._args: unknown[]) => ({ id: `real-${reply.mock.calls.length}` }));

		const msg: any = {
			userId: "user-a",
			reply,
			friend: {
				doc: {
					perModulesData: {
						rpg: { ...initialData },
					},
				},
				setPerModulesData,
			},
		};
		const module = { name: "rpg" } as const;
		const logError = jest.fn();

		return { msg, module, reply, setPerModulesData, logError };
	};

	/** テスト用の敵モック（enemy.fire を含む） */
	const buildEnemy = () =>
		({
			name: "test-enemy",
			fire: 3,
			pattern: 1,
		}) as any;

	test("全次元のうち最大ダメージの結果が採用され、winner の reply が実際に投稿される", async () => {
		const { msg, module, reply, setPerModulesData, logError } = buildHarness({ lv: 300, atk: 50, def: 50 });

		// 3 回走る（parallelCount=2 + 正史 1）設計：呼び出しごとに totalDmg が異なる値を返す
		const dmgs = [100, 500, 250];
		const runRaidDamage = jest.fn(async () => {
			const totalDmg = dmgs.shift() ?? 0;
			// 副作用: 各次元で data.lv を適当に書き換える（winner の選択で反映されることを確認）
			msg.friend.doc.perModulesData.rpg.lv = 300 + totalDmg;
			// シミュレーション時に reply を 1 回呼び出す
			await (msg.reply as any)(`dmg=${totalDmg}`);
			return {
				totalDmg,
				me: "normal",
				lv: msg.friend.doc.perModulesData.rpg.lv,
				count: 1,
				mark: ":blank:",
				skillsStr: { skills: undefined, amulet: undefined },
			};
		});

		const result = await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 2, logError);

		// 呼び出し回数: parallelCount(2) + 1 = 3 回
		expect(runRaidDamage).toHaveBeenCalledTimes(3);

		// 最良 totalDmg = 500 が採用される
		expect(result).toBeDefined();
		expect(result.totalDmg).toBe(500);

		// 正史の data が永続化される（setPerModulesData が winner の mutated で 1 回だけ呼ばれる）
		expect(setPerModulesData).toHaveBeenCalledTimes(1);
		expect(setPerModulesData.mock.calls[0][1].lv).toBe(300 + 500);

		// 実際に投稿される msg.reply は winner 分（= 1 回）のみ
		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith("dmg=500");

		// result.reply に実投稿が設定されている
		expect(result.reply).toEqual({ id: "real-1" });
	});

	test("parallelCount=0 でも 1 回だけ実行され、その結果が採用される", async () => {
		const { msg, module, reply, setPerModulesData, logError } = buildHarness({ lv: 300 });

		const runRaidDamage = jest.fn(async () => {
			await (msg.reply as any)("single");
			return { totalDmg: 1234, me: "normal", count: 1, mark: ":blank:", skillsStr: {} };
		});

		const result = await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 0, logError);

		expect(runRaidDamage).toHaveBeenCalledTimes(1);
		expect(result.totalDmg).toBe(1234);
		expect(setPerModulesData).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledTimes(1);
	});

	test("各試行の開始時に perModulesData[rpg] がスナップショットへ deepClone で復元される", async () => {
		const { msg, module, logError } = buildHarness({ lv: 100, items: [] });
		const observedLvsOnStart: number[] = [];

		const runRaidDamage = jest.fn(async () => {
			observedLvsOnStart.push(msg.friend.doc.perModulesData.rpg.lv);
			// 次元内で data を破壊的に書き換える
			msg.friend.doc.perModulesData.rpg.lv += 1;
			(msg.friend.doc.perModulesData.rpg.items as any[]).push({ name: "garbage" });
			return { totalDmg: 10 };
		});

		await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 2, logError);

		// 3 回とも lv=100 から開始（前の試行の +1 は反映されない）
		expect(observedLvsOnStart).toEqual([100, 100, 100]);
	});

	test("enemy は試行ごとに deepClone されて渡される（元の敵が破壊されない）", async () => {
		const { msg, module, logError } = buildHarness({ lv: 300 });
		const originalEnemy = buildEnemy();
		originalEnemy.fire = 7;

		const runRaidDamage = jest.fn(async (enemyForRun: any) => {
			// 各次元で enemy を破壊的に書き換える
			enemyForRun.fire = 0;
			return { totalDmg: 10 };
		});

		await runParallelDimensionRaid(msg, originalEnemy, module, runRaidDamage, 2, logError);

		// 元の enemy.fire は 7 のまま
		expect(originalEnemy.fire).toBe(7);
	});

	test("一部の次元が例外を投げても残りから最良を選ぶ", async () => {
		const { msg, module, setPerModulesData, logError } = buildHarness({ lv: 300 });

		let call = 0;
		const runRaidDamage = jest.fn(async () => {
			call += 1;
			if (call === 2) throw new Error("boom");
			return { totalDmg: call === 1 ? 10 : 20 };
		});

		const result = await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 2, logError);

		expect(runRaidDamage).toHaveBeenCalledTimes(3);
		expect(result.totalDmg).toBe(20); // 失敗した 2 回目を除いた中の最大
		expect(setPerModulesData).toHaveBeenCalledTimes(1);
		expect(logError).toHaveBeenCalled();
	});

	test("全次元が失敗した場合、data はスナップショットに巻き戻され undefined を返す", async () => {
		const { msg, module, setPerModulesData, reply, logError } = buildHarness({ lv: 300 });

		const runRaidDamage = jest.fn(async () => {
			msg.friend.doc.perModulesData.rpg.lv = 999; // 巻き戻されるべき書き換え
			throw new Error("boom");
		});

		const result = await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 1, logError);

		expect(result).toBeUndefined();
		// data はスナップショットに戻る
		expect(msg.friend.doc.perModulesData.rpg.lv).toBe(300);
		// 正史が決まらないため永続化・実投稿は行われない
		expect(setPerModulesData).not.toHaveBeenCalled();
		expect(reply).not.toHaveBeenCalled();
	});

	test("シミュレーション中に呼ばれた msg.reply は即座には投稿されず、winner の分だけが再生される", async () => {
		const { msg, module, reply, logError } = buildHarness({ lv: 300 });

		const dmgs = [10, 100, 50];
		const runRaidDamage = jest.fn(async () => {
			const totalDmg = dmgs.shift() ?? 0;
			await (msg.reply as any)(`A-${totalDmg}`);
			await (msg.reply as any)(`B-${totalDmg}`);
			return { totalDmg };
		});

		await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 2, logError);

		// reply は winner（totalDmg=100）のバッファだけが再生される
		expect(reply).toHaveBeenCalledTimes(2);
		expect(reply.mock.calls[0][0]).toBe("A-100");
		expect(reply.mock.calls[1][0]).toBe("B-100");
	});

	test("フック復元：ハーネス終了後、msg.reply / msg.friend.setPerModulesData は元に戻っている", async () => {
		const { msg, module, logError } = buildHarness({ lv: 300 });
		const origReply = msg.reply;
		const origSet = msg.friend.setPerModulesData;

		const runRaidDamage = jest.fn(async () => ({ totalDmg: 1 }));

		await runParallelDimensionRaid(msg, buildEnemy(), module, runRaidDamage, 1, logError);

		expect(msg.reply).toBe(origReply);
		expect(msg.friend.setPerModulesData).toBe(origSet);
	});

	/**
	 * 回帰テスト: autobind-decorator のクロージャ汚染により、他ユーザーの msg.reply が
	 * こちらのモックに差し替わってしまうバグ（「お札を持っていると他の人のレイド結果が来てしまう」）。
	 *
	 * autobind v2 のプロトタイプ descriptor が持つ setter は、クラス全体で共有される closure 変数 `fn` を
	 * 書き換えてしまう。通常代入（`msg.reply = mock`）をすると、これ以降に **別インスタンス** が初めて
	 * `reply` にアクセスしたときに `fn.bind(this)` = `mock.bind(this)` がキャッシュされ、他ユーザーの
	 * reply 呼び出しがこちらの replies バッファに吸い込まれてしまう。
	 *
	 * 修正後は `Object.defineProperty` でインスタンスに直接データプロパティを貼るため、プロトタイプ側の
	 * closure は汚染されない。
	 */
	test("autobind 共有 closure を汚染しない（他インスタンスの reply がこちらのバッファへ漏洩しない）", async () => {
		// autobind-decorator v2.x の簡易再現: プロトタイプ側の descriptor にクラス共有の closure `fn` を持つ
		const buildAutobindClass = () => {
			class Base {
				public reply(_text: string): string {
					return "";
				}
			}
			// 本物の reply を closure で保持し、プロトタイプ側に autobind 風 descriptor を張り直す
			let fn: any = Base.prototype.reply;
			Object.defineProperty(Base.prototype, "reply", {
				configurable: true,
				get(this: any) {
					if (this === Base.prototype || Object.prototype.hasOwnProperty.call(this, "reply")) {
						return fn;
					}
					const bound = fn.bind(this);
					Object.defineProperty(this, "reply", {
						configurable: true,
						get: () => bound,
						set: (value: unknown) => {
							fn = value;
							delete (this as any).reply;
						},
					});
					return bound;
				},
				set(value: unknown) {
					fn = value;
				},
			});
			return Base;
		};

		const AutobindMsg = buildAutobindClass();
		const originalImpl = jest.fn((text: string) => `ORIG:${text}`);
		AutobindMsg.prototype.reply = originalImpl as any;

		const msgA = new AutobindMsg();
		const msgB = new AutobindMsg();

		// msgA にのみ friend / perModulesData を持たせ、ハーネスに渡せる形にする
		(msgA as any).userId = "user-a";
		(msgA as any).friend = {
			doc: { perModulesData: { rpg: { lv: 1 } } },
			setPerModulesData: jest.fn((_module: any, data: any) => {
				(msgA as any).friend.doc.perModulesData.rpg = data;
			}),
		};
		const module = { name: "rpg" } as const;

		// ハーネス内で msgA.reply を差し替えている間に、他ユーザー msgB が初めて reply にアクセスしても
		// それはあくまで「本来の reply」を呼ぶべき（こちらのバッファへ吸い込まれてはいけない）
		let leakedToOurBuffer = false;
		const runRaidDamage = jest.fn(async () => {
			// 他ユーザー msgB が初回アクセス（本来の reply が発火するはず）
			const bReply = (msgB as any).reply("hello-from-B");
			// もし漏れていたら、こちらのモックが返すのは Promise<fake> なので文字列にならない
			if (typeof bReply !== "string" || !bReply.startsWith("ORIG:")) {
				leakedToOurBuffer = true;
			}
			await (msgA as any).reply("A's text");
			return { totalDmg: 10 };
		});

		await runParallelDimensionRaid(
			msgA as any,
			{ name: "e", pattern: 1 } as any,
			module,
			runRaidDamage,
			1,
			jest.fn(),
		);

		expect(leakedToOurBuffer).toBe(false);
		// 他ユーザーの reply は本来の実装（originalImpl）を呼ぶ
		expect(originalImpl).toHaveBeenCalledWith("hello-from-B");
	});
});

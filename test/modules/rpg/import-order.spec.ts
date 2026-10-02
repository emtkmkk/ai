/**
 * @packageDocumentation
 *
 * RPG モジュールの読み込み順のテスト
 *
 * @remarks
 * RPG モジュールのファイル同士は互いを読み込み合っているため、読み込み時に相手の値を使うと
 * 「どのファイルから先に読み込まれたか」で初期化に失敗することがある（以前の skills.test.ts が該当）。
 * どのファイルを最初に読み込んでも失敗しないことを確認する。
 */
import * as fs from "fs";
import * as path from "path";

const rpgDir = path.join(__dirname, "../../../src/modules/rpg");
const moduleNames = fs.readdirSync(rpgDir).filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, ""));

describe("RPG モジュールの読み込み順", () => {
	test.each(moduleNames)("%s を最初に読み込んでも初期化に失敗しない", (name) => {
		jest.isolateModules(() => {
			expect(() => require(`@/modules/rpg/${name}`)).not.toThrow();
		});
	});

	test("shop / shop2 の商品リストに、スキルから作る商品が含まれている（読み込み時にスキル一覧が揃っている）", () => {
		jest.isolateModules(() => {
			// あえて skills から先に読み込む（以前はここで失敗していた）
			const { skills } = require("@/modules/rpg/skills");
			const { shopItems } = require("@/modules/rpg/shop");
			const { shop2Items } = require("@/modules/rpg/shop2");
			expect(skills.length).toBeGreaterThan(0);
			expect(shopItems.some((x: any) => x.name === "炎属性剣攻撃のお守り")).toBe(true);
			expect(shop2Items.some((x: any) => x.name === "究極のお守り")).toBe(true);
		});
	});
});

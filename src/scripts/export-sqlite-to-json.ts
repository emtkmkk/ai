/**
 * @packageDocumentation
 *
 * memory.sqlite の内容を memory.json（LokiJS の形式）に書き戻すスクリプト
 *
 * @remarks
 * SQLite 版から従来の memory.json 版に戻すときに使う。
 * 既存のファイルは上書きしない（出力先が存在する場合は `--force` が必要）。
 * 書き出した後に読み直し、件数が一致することを確認する。
 * bot の稼働中に実行しても SQLite は壊れないが、実行後の変更は含まれないので、戻すときは bot を止めてから実行する。
 *
 * 使い方（ビルド後）:
 *   node built/scripts/export-sqlite-to-json.js [memory.sqlite のパス] [出力先（既定: memory.restored.json）] [--force]
 *
 * @internal
 */
import * as fs from 'fs';
import * as path from 'path';
import * as loki from 'lokijs';
import { SqliteStore } from '../utils/sqlite-store';

const args = process.argv.slice(2);
const force = args.includes('--force');
const [sqliteArg, outArg] = args.filter(arg => !arg.startsWith('--'));
const sqliteFile = path.resolve(sqliteArg ?? 'memory.sqlite');
const outFile = path.resolve(outArg ?? 'memory.restored.json');

function counts(db: loki) {
	return Object.fromEntries(db.collections.map(collection => [collection.name, collection.data.length]));
}

async function main() {
	if (!fs.existsSync(sqliteFile)) {
		console.error(`${sqliteFile} が見つかりません`);
		process.exit(1);
	}
	if (fs.existsSync(outFile) && !force) {
		console.error(`${outFile} はすでにあります。上書きする場合は --force を付けてください`);
		process.exit(1);
	}

	const db = new loki(outFile, { autosave: false });
	const store = new SqliteStore(sqliteFile);
	store.loadAll(db);
	store.close();
	const expected = counts(db);

	await new Promise<void>((resolve, reject) => db.saveDatabase(err => (err ? reject(err) : resolve())));
	console.log(`書き出しました: ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)}MB)`);

	// 読み直して件数を確認する
	const check = await new Promise<loki>((resolve, reject) => {
		const reloaded = new loki(outFile, {
			autoload: true,
			autosave: false,
			autoloadCallback: err => (err ? reject(err) : resolve(reloaded)),
		});
	});
	const actual = counts(check);
	let ok = true;
	for (const [name, count] of Object.entries(expected)) {
		const match = actual[name] === count;
		ok &&= match;
		console.log(`  ${match ? 'OK' : 'NG'} ${name}: ${count}件${match ? '' : ` → ${actual[name] ?? 'なし'}`}`);
	}
	console.log(ok ? '結果: 件数はすべて一致しました' : '結果: 件数が一致しません');
	process.exitCode = ok ? 0 : 2;
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});

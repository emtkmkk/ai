/**
 * @packageDocumentation
 *
 * memory.json → SQLite 移行の確認用スクリプト
 *
 * @remarks
 * 本番の memory.json を読み込むだけで書き換えない。SQLite は一時ディレクトリに作り、終了時に削除する。
 * 出力するのは件数・サイズ・時間・不一致の件数とドキュメントIDだけで、ドキュメントの中身は出力しない。
 *
 * 使い方（ビルド後）:
 *   node built/scripts/verify-sqlite-migration.js [memory.json のパス] [--keep]
 *
 * @internal
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as loki from 'lokijs';
import { SqliteStore } from '../utils/sqlite-store';

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const jsonFile = path.resolve(args.find(arg => !arg.startsWith('--')) ?? 'memory.json');

function mb(bytes: number) {
	return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function time<T>(label: string, fn: () => T): T {
	const started = process.hrtime.bigint();
	const result = fn();
	console.log(`${label}: ${Number((process.hrtime.bigint() - started) / 1000000n)}ms`);
	return result;
}

function loadJson(file: string): Promise<loki> {
	return new Promise((resolve, reject) => {
		const started = Date.now();
		const db = new loki(file, {
			autoload: true,
			autosave: false,
			autoloadCallback: err => {
				if (err) return reject(err);
				console.log(`memory.json の読み込み: ${Date.now() - started}ms`);
				resolve(db);
			},
		});
	});
}

/** イベントループが最も長く止まった時間を計りながら非同期処理を実行する */
async function measureMaxGap<T>(fn: () => Promise<T>): Promise<{ result: T; maxGap: number; total: number }> {
	let maxGap = 0;
	let last = Date.now();
	const timer = setInterval(() => {
		const now = Date.now();
		maxGap = Math.max(maxGap, now - last);
		last = now;
	}, 1);
	const started = Date.now();
	const result = await fn();
	clearInterval(timer);
	return { result, maxGap, total: Date.now() - started };
}

async function main() {
	if (!fs.existsSync(jsonFile)) {
		console.error(`${jsonFile} が見つかりません`);
		process.exit(1);
	}
	const jsonSize = fs.statSync(jsonFile).size;
	console.log(`対象: ${jsonFile} (${mb(jsonSize)})`);
	const jsonMtime = fs.statSync(jsonFile).mtimeMs;

	const source = await loadJson(jsonFile);

	// 現在の方式（変更があるたびに DB 全体を同期シリアライズ）のコスト
	for (let i = 1; i <= 3; i++) time(`DB 全体のシリアライズ（現在の自動保存と同じ処理） ${i}回目`, () => source.serialize());

	console.log('\nコレクション別:');
	for (const collection of source.collections) {
		const bytes = collection.data.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0);
		console.log(`  ${collection.name}: ${collection.data.length}件 ${mb(bytes)}`);
	}

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-sqlite-verify-'));
	const sqliteFile = path.join(dir, 'memory.sqlite');
	console.log(`\n一時 SQLite: ${sqliteFile}`);

	try {
		const store = new SqliteStore(sqliteFile);
		time('SQLite への取り込み（初回移行）', () => store.importAll(source));
		store.close();
		console.log(`SQLite のサイズ: ${mb(fs.statSync(sqliteFile).size)}`);

		const loaded = new loki('verify', { autosave: false });
		const loadStore = new SqliteStore(sqliteFile);
		time('SQLite からの読み込み（起動時）', () => loadStore.loadAll(loaded));

		// 突き合わせ
		console.log('\n突き合わせ:');
		let mismatches = 0;
		for (const original of source.collections) {
			const copy = loaded.getCollection(original.name);
			const problems: string[] = [];
			if (copy == null) {
				problems.push('コレクションがない');
			} else {
				if (copy.data.length !== original.data.length) problems.push(`件数 ${original.data.length} → ${copy.data.length}`);
				if (copy.maxId < original.maxId) problems.push(`maxId ${original.maxId} → ${copy.maxId}`);
				const originalIndices = Object.keys(original.binaryIndices ?? {}).sort().join(',');
				const copyIndices = Object.keys(copy.binaryIndices ?? {}).sort().join(',');
				if (originalIndices !== copyIndices) problems.push(`インデックス [${originalIndices}] → [${copyIndices}]`);
				const copyById = new Map(copy.data.map(doc => [doc.$loki, JSON.stringify(doc)]));
				const differentIds: number[] = [];
				for (const doc of original.data) {
					if (copyById.get(doc.$loki) !== JSON.stringify(doc)) differentIds.push(doc.$loki);
				}
				if (differentIds.length) problems.push(`内容が異なるドキュメント ${differentIds.length}件（$loki: ${differentIds.slice(0, 10).join(', ')}${differentIds.length > 10 ? ' ...' : ''}）`);
			}
			mismatches += problems.length;
			console.log(`  ${problems.length ? 'NG' : 'OK'} ${original.name}${problems.length ? `: ${problems.join(' / ')}` : ''}`);
		}

		// 定期的な差分確認（変更なしで全件を確認するコスト）
		for (const collection of loaded.collections) loadStore.attach(collection);
		const { result: changed, maxGap, total } = await measureMaxGap(() => loadStore.reconcile(loaded));
		console.log(`\n差分確認（1分ごとに実行）: 合計 ${total}ms、イベントループが止まった最大時間 ${maxGap}ms、書き込み ${changed}件`);
		loadStore.close();

		console.log(`\nプロセスのメモリ: rss=${mb(process.memoryUsage().rss)} heapUsed=${mb(process.memoryUsage().heapUsed)}`);
		console.log(mismatches === 0 ? '\n結果: すべて一致しました' : `\n結果: 不一致が ${mismatches} 件あります`);
		if (fs.statSync(jsonFile).mtimeMs !== jsonMtime) console.log('（確認中に memory.json が更新されました。bot の稼働中なら問題ありません）');
		process.exitCode = mismatches === 0 ? 0 : 2;
	} finally {
		if (keep) {
			console.log(`一時 SQLite を残しました: ${sqliteFile}`);
		} else {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});

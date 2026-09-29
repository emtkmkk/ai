/**
 * @packageDocumentation
 *
 * LokiJS のデータを SQLite に永続化するストア
 *
 * @remarks
 * 検索は従来どおりメモリ上の LokiJS で行い、保存だけを SQLite に置き換える。
 * - LokiJS の insert / update / delete イベントを受けて、変更されたドキュメントだけを書き込む
 *   （同じティック内の変更はまとめて1トランザクションで書く）。
 * - `update()` を呼ばずにオブジェクトを直接書き換えた変更を拾うため、定期的に全ドキュメントを
 *   少しずつ直列化して、前回保存時から変わったものを書き込む（{@link reconcile}）。
 *   1回の処理時間を区切ってイベントループを長く止めないようにする。
 *
 * 旧来の LokiJS は、変更があるたびに DB 全体を同期的に JSON 化して保存していた。
 *
 * @public
 */
import Database = require('better-sqlite3');
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type * as loki from 'lokijs';

/** コレクションの復元に必要な設定 */
type CollectionOptions = {
	indices: string[];
	unique: string[];
	disableMeta?: boolean;
};

/** 1ティックあたりの差分確認の時間（ミリ秒） */
const RECONCILE_SLICE_MS = 15;

/**
 * SQLite ストア
 *
 * @public
 */
export class SqliteStore {
	private readonly db: Database.Database;
	/** ドキュメントごとの前回保存時の内容のハッシュ（キー: `コレクション名\0$loki`） */
	private readonly savedHashes = new Map<string, string>();
	/** まだ書き込んでいない変更（null は削除） */
	private pending = new Map<string, Map<number, object | null>>();
	/** 変更があったコレクションの最大ID（削除済みIDを再利用しないために保存する） */
	private pendingMaxIds = new Map<string, number>();
	private flushScheduled = false;
	private reconciling = false;
	private readonly attached = new Set<string>();

	constructor(file: string, private readonly log: (msg: string) => void = () => {}) {
		this.db = new Database(file);
		this.db.pragma('journal_mode = WAL');
		this.db.pragma('synchronous = NORMAL');
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS collections (
				name TEXT PRIMARY KEY,
				options TEXT NOT NULL,
				max_id INTEGER NOT NULL DEFAULT 0
			);
			CREATE TABLE IF NOT EXISTS docs (
				collection TEXT NOT NULL,
				id INTEGER NOT NULL,
				doc TEXT NOT NULL,
				PRIMARY KEY (collection, id)
			);
		`);
	}

	/** 保存済みのコレクションがないか（初回移行の判定用） */
	public isEmpty(): boolean {
		return (this.db.prepare('SELECT COUNT(*) AS n FROM collections').get() as { n: number }).n === 0;
	}

	/**
	 * LokiJS の全データを書き込む（memory.json からの初回移行用）
	 *
	 * @public
	 */
	public importAll(lokiDb: loki) {
		const insertDoc = this.db.prepare('INSERT OR REPLACE INTO docs (collection, id, doc) VALUES (?, ?, ?)');
		this.db.transaction(() => {
			for (const collection of lokiDb.collections) {
				this.saveCollection(collection);
				for (const doc of collection.data) {
					const json = JSON.stringify(doc);
					insertDoc.run(collection.name, doc.$loki, json);
					this.savedHashes.set(this.key(collection.name, doc.$loki), hash(json));
				}
			}
		})();
	}

	/**
	 * 保存済みのデータを LokiJS に読み込む
	 *
	 * @public
	 */
	public loadAll(lokiDb: loki) {
		const collections = this.db.prepare('SELECT name, options, max_id FROM collections').all() as { name: string; options: string; max_id: number }[];
		const selectDocs = this.db.prepare('SELECT id, doc FROM docs WHERE collection = ? ORDER BY id');
		for (const row of collections) {
			const options: CollectionOptions = JSON.parse(row.options);
			const collection = lokiDb.addCollection(row.name, { indices: options.indices, unique: options.unique, disableMeta: options.disableMeta });
			let maxId = row.max_id;
			for (const { id, doc } of selectDocs.iterate(row.name) as Iterable<{ id: number; doc: string }>) {
				collection.data.push(JSON.parse(doc));
				this.savedHashes.set(this.key(row.name, id), hash(doc));
				if (id > maxId) maxId = id;
			}
			collection.maxId = maxId;
			collection.ensureId();
			collection.ensureAllIndexes(true);
			for (const field of options.unique) (collection as any).getUniqueIndex(field, true);
		}
	}

	/**
	 * コレクションの変更を SQLite に書き込むようにする
	 *
	 * @public
	 */
	public attach(collection: loki.Collection) {
		if (this.attached.has(collection.name)) return;
		this.attached.add(collection.name);
		this.saveCollection(collection);
		const onChange = (docs: object | object[]) => {
			for (const doc of Array.isArray(docs) ? docs : [docs]) this.enqueue(collection, doc, false);
		};
		collection.on('insert', onChange);
		collection.on('update', onChange);
		collection.on('delete', (doc: object) => this.enqueue(collection, doc, true));
	}

	/**
	 * 未書き込みの変更をすべて書き込む
	 *
	 * @public
	 */
	public flush() {
		this.flushScheduled = false;
		if (this.pending.size === 0) return;
		const pending = this.pending;
		const pendingMaxIds = this.pendingMaxIds;
		this.pending = new Map();
		this.pendingMaxIds = new Map();
		const upsert = this.db.prepare('INSERT OR REPLACE INTO docs (collection, id, doc) VALUES (?, ?, ?)');
		const remove = this.db.prepare('DELETE FROM docs WHERE collection = ? AND id = ?');
		const updateMaxId = this.db.prepare('UPDATE collections SET max_id = MAX(max_id, ?) WHERE name = ?');
		this.db.transaction(() => {
			for (const [name, docs] of pending) {
				for (const [id, doc] of docs) {
					const key = this.key(name, id);
					if (doc == null) {
						remove.run(name, id);
						this.savedHashes.delete(key);
						continue;
					}
					const json = JSON.stringify(doc);
					const digest = hash(json);
					if (this.savedHashes.get(key) === digest) continue;
					upsert.run(name, id, json);
					this.savedHashes.set(key, digest);
				}
			}
			for (const [name, maxId] of pendingMaxIds) updateMaxId.run(maxId, name);
		})();
	}

	/**
	 * 全ドキュメントを少しずつ直列化し、前回保存時から変わったものを書き込む
	 *
	 * @remarks
	 * `update()` を経由しない直接の書き換えを拾うための処理。
	 * {@link RECONCILE_SLICE_MS} ごとに処理を区切り、次のティックで続きを行う。
	 *
	 * @returns 書き込んだドキュメント数
	 * @public
	 */
	public async reconcile(lokiDb: loki): Promise<number> {
		if (this.reconciling) return 0;
		this.reconciling = true;
		let changed = 0;
		try {
			for (const collection of [...lokiDb.collections]) {
				if (!this.attached.has(collection.name)) continue;
				const docs = [...collection.data];
				let sliceStart = Date.now();
				for (const doc of docs) {
					const json = JSON.stringify(doc);
					if (this.savedHashes.get(this.key(collection.name, doc.$loki)) !== hash(json)) {
						this.enqueue(collection, doc, false);
						changed++;
					}
					if (Date.now() - sliceStart >= RECONCILE_SLICE_MS) {
						this.flush();
						await new Promise(resolve => setImmediate(resolve));
						sliceStart = Date.now();
					}
				}
			}
			this.flush();
		} finally {
			this.reconciling = false;
		}
		if (changed > 0) this.log(`SQLite reconcile: saved ${changed} changed docs`);
		return changed;
	}

	/**
	 * DB をバックアップファイルに書き出し、古いバックアップを削除する
	 *
	 * @remarks
	 * SQLite のオンラインバックアップで少しずつコピーするので、稼働中でもイベントループを長く止めない。
	 * ファイル名は `memory-YYYY-MM-DD.sqlite`。同じ日のバックアップがあれば何もしない。
	 *
	 * @param dir - バックアップの保存先ディレクトリ
	 * @param date - バックアップの日付（ファイル名に使う）
	 * @param keep - 残すバックアップの数
	 * @returns 作成したファイルのパス（作成しなかった場合は null）
	 * @public
	 */
	public async backup(dir: string, date: string, keep: number): Promise<string | null> {
		fs.mkdirSync(dir, { recursive: true });
		const file = path.join(dir, `memory-${date}.sqlite`);
		if (fs.existsSync(file)) return null;
		this.flush();
		const temp = `${file}.tmp`;
		fs.rmSync(temp, { force: true });
		await this.db.backup(temp);
		fs.renameSync(temp, file);
		const backups = fs.readdirSync(dir).filter(name => /^memory-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort();
		for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
			fs.rmSync(path.join(dir, old), { force: true });
		}
		return file;
	}

	public close() {
		this.flush();
		this.db.close();
	}

	private enqueue(collection: loki.Collection, doc: any, removed: boolean) {
		if (typeof doc?.$loki !== 'number') return;
		let docs = this.pending.get(collection.name);
		if (!docs) {
			docs = new Map();
			this.pending.set(collection.name, docs);
		}
		docs.set(doc.$loki, removed ? null : doc);
		this.pendingMaxIds.set(collection.name, Math.max(collection.maxId ?? 0, doc.$loki));
		if (!this.flushScheduled) {
			this.flushScheduled = true;
			setImmediate(() => this.flush());
		}
	}

	private saveCollection(collection: loki.Collection) {
		const options: CollectionOptions = {
			indices: Object.keys(collection.binaryIndices ?? {}),
			unique: [...(collection.uniqueNames ?? [])].map(String),
			disableMeta: (collection as any).disableMeta,
		};
		this.db.prepare(`
			INSERT INTO collections (name, options, max_id) VALUES (?, ?, ?)
			ON CONFLICT(name) DO UPDATE SET options = excluded.options, max_id = MAX(max_id, excluded.max_id)
		`).run(collection.name, JSON.stringify(options), collection.maxId ?? 0);
	}

	private key(name: string, id: number) {
		return `${name}\0${id}`;
	}
}

function hash(json: string): string {
	return createHash('md5').update(json).digest('base64');
}

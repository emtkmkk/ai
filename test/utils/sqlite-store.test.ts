import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as loki from 'lokijs';
import { SqliteStore } from '@/utils/sqlite-store';

let dir: string;
let file: string;

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-store-'));
	file = path.join(dir, 'memory.sqlite');
});

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

/** SQLite から読み直した LokiJS を返す */
function reload() {
	const store = new SqliteStore(file);
	const db = new loki('reload', { autosave: false });
	store.loadAll(db);
	store.close();
	return db;
}

test('memory.json 相当のデータを取り込み、読み直すと同じ内容になる', () => {
	const source = new loki('source', { autosave: false });
	const friends = source.addCollection<any>('friends', { indices: ['userId'] });
	friends.insert([{ userId: 'a', love: 10 }, { userId: 'b', love: 20 }]);
	source.addCollection<any>('meta').insert({ activeFactor: 0.5 });

	const store = new SqliteStore(file);
	expect(store.isEmpty()).toBe(true);
	store.importAll(source);
	expect(store.isEmpty()).toBe(false);
	store.close();

	const db = reload();
	const loaded = db.getCollection('friends');
	expect(loaded.find().map(({ userId, love }) => ({ userId, love }))).toEqual([{ userId: 'a', love: 10 }, { userId: 'b', love: 20 }]);
	expect(loaded.findOne({ userId: 'b' })?.love).toBe(20);
	expect(Object.keys(loaded.binaryIndices)).toEqual(['userId']);
	expect(db.getCollection('meta').findOne({})?.activeFactor).toBe(0.5);
});

test('insert / update / delete を変更分だけ保存する', () => {
	const store = new SqliteStore(file);
	const db = new loki('db', { autosave: false });
	const collection = db.addCollection<any>('reminds');
	store.attach(collection);

	const a = collection.insertOne({ text: 'a' })!;
	const b = collection.insertOne({ text: 'b' })!;
	a.text = 'a2';
	collection.update(a);
	collection.remove(b);
	store.flush();
	store.close();

	const loaded = reload().getCollection('reminds');
	expect(loaded.find().map(doc => doc.text)).toEqual(['a2']);
	// 削除したIDを再利用しない
	expect(loaded.insertOne({ text: 'c' })!.$loki).toBe(3);
});

test('update() を通らない直接の書き換えも reconcile で保存する', async () => {
	const store = new SqliteStore(file);
	const db = new loki('db', { autosave: false });
	const collection = db.addCollection<any>('friends');
	store.attach(collection);
	const doc = collection.insertOne({ userId: 'a', love: 1 })!;
	store.flush();

	doc.love = 99;
	expect(await store.reconcile(db)).toBe(1);
	expect(await store.reconcile(db)).toBe(0);
	store.close();

	expect(reload().getCollection('friends').findOne({ userId: 'a' })?.love).toBe(99);
});

test('一括 insert と findAndRemove も保存する', () => {
	const store = new SqliteStore(file);
	const db = new loki('db', { autosave: false });
	const collection = db.addCollection<any>('polls');
	store.attach(collection);
	collection.insert([{ n: 1 }, { n: 2 }, { n: 3 }]);
	collection.findAndRemove({ n: { $lt: 3 } });
	store.flush();
	store.close();

	expect(reload().getCollection('polls').find().map(doc => doc.n)).toEqual([3]);
});

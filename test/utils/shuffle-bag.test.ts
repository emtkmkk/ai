import { pickFromBag } from '@/utils/shuffle-bag';

const items = ['a', 'b', 'c'];
const key = (x: string) => x;

test('一巡するまで同じ候補は出ない', () => {
	let used: string[] = [];
	const seen: string[] = [];
	for (let i = 0; i < 3; i++) {
		const result = pickFromBag(items, key, used);
		seen.push(result.item);
		used = result.used;
	}
	expect([...seen].sort()).toEqual(items);
	expect([...used].sort()).toEqual(items);
});

test('すべて出たら次の一巡を始める', () => {
	const result = pickFromBag(items, key, ['a', 'b', 'c'], () => 0);
	expect(result).toEqual({ item: 'a', used: ['a'] });
});

test('未使用が1つだけならそれが出る', () => {
	expect(pickFromBag(items, key, ['a', 'c'], () => 0.99)).toEqual({ item: 'b', used: ['a', 'c', 'b'] });
});

test('候補から消えたキーは無視する', () => {
	expect(pickFromBag(items, key, ['a', 'removed'], () => 0)).toEqual({ item: 'b', used: ['a', 'b'] });
});

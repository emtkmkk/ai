import { ensureKazutoriData, hasKazutoriRateHistory } from '@/modules/kazutori/rate';

describe('hasKazutoriRateHistory', () => {
        test('明示的にrateChangedがtrueの場合は履歴ありと判定する', () => {
                expect(hasKazutoriRateHistory({ rate: 1000, rateChanged: true })).toBe(true);
        });

        test('明示的にrateChangedがfalseの場合は履歴なしと判定する', () => {
                expect(hasKazutoriRateHistory({ rate: 1200, rateChanged: false })).toBe(false);
        });

        test('rateChangedが未定義でレートが初期値なら履歴なしと判定する', () => {
                expect(hasKazutoriRateHistory({ rate: 1000 })).toBe(false);
        });

        test('rateChangedが未定義でもレートが初期値以外なら履歴ありと判定する', () => {
                expect(hasKazutoriRateHistory({ rate: 1100 })).toBe(true);
        });
});

describe('ensureKazutoriData', () => {
        test('rateChangedが文字列で保存されていても真偽値に補正される', () => {
                const target = {
                        kazutoriData: {
                                rate: 1200,
                                rateChanged: 'false' as unknown as boolean,
                        },
                };

                const { data, updated } = ensureKazutoriData(target);

                expect(updated).toBe(true);
                expect(data.rateChanged).toBe(false);
        });

        test('rateChangedが数値で保存されていても真偽値に補正される', () => {
                const target = {
                        kazutoriData: {
                                rate: 1200,
                                rateChanged: 1 as unknown as boolean,
                        },
                };

                const { data, updated } = ensureKazutoriData(target);

                expect(updated).toBe(true);
                expect(data.rateChanged).toBe(true);
        });

        test('補正後も真偽値に変換できない場合はレートで履歴を推測する', () => {
                const target = {
                        kazutoriData: {
                                rate: 1200,
                                rateChanged: 'unknown' as unknown as boolean,
                        },
                };

                const { data, updated } = ensureKazutoriData(target);

                expect(updated).toBe(true);
                expect(data.rateChanged).toBe(true);
        });

        test('補正後も真偽値に変換できずレートが初期値ならフラグを削除する', () => {
                const target = {
                        kazutoriData: {
                                rate: 1000,
                                rateChanged: 'unknown' as unknown as boolean,
                        },
                };

                const { data, updated } = ensureKazutoriData(target);

                expect(updated).toBe(true);
                expect(data.rateChanged).toBeUndefined();
        });

        test('rateChangedが未定義でレートが初期値なら、何も変えず更新なしを返す', () => {
                const target = {
                        kazutoriData: {
                                winCount: 0,
                                playCount: 3,
                                rate: 1000,
                                inventory: [],
                                ratingVersion: 1,
                        },
                };
                const before = JSON.stringify(target);

                const { updated } = ensureKazutoriData(target);

                expect(updated).toBe(false);
                expect(JSON.stringify(target)).toBe(before);
                expect('rateChanged' in target.kazutoriData).toBe(false);
        });

        test('rateChangedがnullなら削除して更新ありを返す', () => {
                const target = {
                        kazutoriData: {
                                rate: 1000,
                                rateChanged: null as unknown as boolean,
                        },
                };

                const { data, updated } = ensureKazutoriData(target);

                expect(updated).toBe(true);
                expect('rateChanged' in data).toBe(false);
        });

        test('新規作成したデータは2回目の呼び出しで更新なしになる', () => {
                const target: { kazutoriData?: any } = {};

                expect(ensureKazutoriData(target).updated).toBe(true);
                const afterFirst = JSON.stringify(target);

                expect(ensureKazutoriData(target).updated).toBe(false);
                expect(JSON.stringify(target)).toBe(afterFirst);
        });

        test.each([
                ['初期値のまま', { rate: 1000 }],
                ['レート変動あり・フラグなし', { rate: 1234 }],
                ['フラグが文字列', { rate: 1000, rateChanged: 'TRUE' }],
                ['フラグが数値', { rate: 900, rateChanged: 0 }],
                ['フラグが変換できない', { rate: 1000, rateChanged: 'unknown' }],
                ['旧バージョンのレート', { rate: 1500, rateChanged: true, ratingVersion: 0 }],
                ['小数のレート', { rate: 1000.4 }],
                ['壊れた項目が混在', { rate: 'x', winCount: null, inventory: 'a', lastRateChange: 'x', lastRateChangeAt: 1, lastRateLossAdjustmentPercent: 150, lastGameResult: 'draw', lastPlayedAt: NaN }],
        ])('一度正規化したデータは、もう一度呼んでも更新なしになる（%s）', (_label, kazutoriData) => {
                const target = { kazutoriData: { ...kazutoriData } as any };

                ensureKazutoriData(target);
                const afterFirst = JSON.stringify(target);

                expect(ensureKazutoriData(target).updated).toBe(false);
                expect(JSON.stringify(target)).toBe(afterFirst);
        });
});

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
});

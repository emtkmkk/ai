/**
 * @packageDocumentation
 *
 * 数取りゲームのレーティングデータ管理
 *
 * ユーザーごとの数取りレート・勝利数・プレイ数・インベントリなどを管理する。
 * データの初期化・正規化・バージョン管理を担当する。
 *
 * @remarks
 * - NOTE: 初期レートは1000。レーティングバージョンが変わると全ユーザーのレートがリセットされる。
 * - NOTE: `ensureKazutoriData` はデータの型安全性を保証し、不正な値を自動修正する。
 * - NOTE: `rateChanged` は string/number/boolean の混在があり得るため、正規化が必要。
 *
 * @public
 */

/**
 * レーティングバージョン
 *
 * @remarks
 * この値を変更すると、全ユーザーのレートが1000にリセットされる。
 *
 * @public
 */
export const KAZUTORI_RATING_VERSION = 1;

/**
 * 数取りデータコンテナ型
 *
 * @remarks
 * FriendDoc に含まれる kazutoriData フィールドの型定義。
 * 各フィールドはオプショナルで、`ensureKazutoriData` により初期化・正規化される。
 *
 * @public
 */
export type KazutoriDataContainer = {
        kazutoriData?: {
                /** 累計勝利回数 */
                winCount?: number;
                /** 累計プレイ回数 */
                playCount?: number;
                /** 現在のレート（初期値1000） */
                rate?: number;
                /** 獲得アイテムのリスト（最大50個） */
                inventory?: string[];
                /** メダル獲得数 */
                medal?: number;
                /** 最終プレイ日時（ミリ秒タイムスタンプ） */
                lastPlayedAt?: number;
                /** 最終勝利日時（ミリ秒タイムスタンプ） */
                lastWinAt?: number;
                /** レーティングバージョン */
                ratingVersion?: number;
                /** レートが変更されたことがあるか */
                rateChanged?: boolean | string | number;
                /** 直近のレート変動量 */
                lastRateChange?: number;
                /** 直近の敗北時レート減少調整率（%） */
                lastRateLossAdjustmentPercent?: number;
                /** 直近のレート変動があったゲームID */
                lastRateChangeGameId?: string;
                /** 直近のゲーム結果 */
                lastGameResult?: 'win' | 'lose' | 'no-winner' | 'absent';
                [key: string]: any;
        };
};

/**
 * 正規化済み数取りデータ型
 *
 * @remarks
 * `ensureKazutoriData` の戻り値として使用される。
 * 全フィールドが非オプショナルで、安全にアクセスできる。
 *
 * @public
 */
export type EnsuredKazutoriData = {
        /** 累計勝利回数 */
        winCount: number;
        /** 累計プレイ回数 */
        playCount: number;
        /** 現在のレート（初期値1000） */
        rate: number;
        /** 獲得アイテムのリスト（最大50個） */
        inventory: string[];
        /** レーティングバージョン */
        ratingVersion: number;
        /** レートが変更されたことがあるか */
        rateChanged?: boolean;
        /** 直近のレート変動量 */
        lastRateChange?: number;
        /** 直近の敗北時レート減少調整率（%） */
        lastRateLossAdjustmentPercent?: number;
        /** 直近のレート変動があったゲームID */
        lastRateChangeGameId?: string;
        /** 直近のゲーム結果 */
        lastGameResult?: 'win' | 'lose' | 'no-winner' | 'absent';
        /** メダル獲得数 */
        medal?: number;
        /** 最終プレイ日時（ミリ秒タイムスタンプ） */
        lastPlayedAt?: number;
        /** 最終勝利日時（ミリ秒タイムスタンプ） */
        lastWinAt?: number;
        [key: string]: any;
};

/**
 * レートが変更された履歴があるかを判定する
 *
 * @remarks
 * `rateChanged` が true の場合、または rate が初期値(1000)でない場合に true を返す。
 * `rateChanged` は過去データで string/number 型として保存されている場合があるため、
 * boolean 以外の型も考慮する。
 *
 * @param data - 判定対象のデータ
 * @returns 履歴がある場合 `true`
 * @public
 */
export function hasKazutoriRateHistory(data: { rate: number; rateChanged?: boolean }): boolean {
        if (data.rateChanged === true) {
                return true;
        }

        if (data.rateChanged === false) {
                return false;
        }

        return data.rate !== undefined && typeof data.rate === "number" && data.rate !== 1000;
}

export function createDefaultKazutoriData(): EnsuredKazutoriData {
        return {
                winCount: 0,
                playCount: 0,
                rate: 1000,
                inventory: [],
                ratingVersion: KAZUTORI_RATING_VERSION,
        };
}

/**
 * 数取りデータを正規化し、安全にアクセスできる状態にする
 *
 * @remarks
 * データが存在しない場合は初期値で作成する。
 * 既存データに対しては以下の正規化を行う:
 * - レーティングバージョンが異なる場合はレートをリセット
 * - rate/winCount/playCount が数値でない場合はデフォルトに戻す
 * - rate が小数の場合は四捨五入
 * - rateChanged が string/number の場合は boolean に変換
 * - 不正な lastRateChange/lastRateLossAdjustmentPercent を削除
 * - 不正な lastGameResult を削除
 * - inventory が配列でない場合は空配列に
 * - 不正な lastPlayedAt/lastWinAt を削除
 *
 * @param target - 正規化対象のデータコンテナ
 * @returns 正規化済みデータと更新フラグ
 * @public
 */
export function ensureKazutoriData<T extends KazutoriDataContainer>(target: T): {
        data: EnsuredKazutoriData;
        updated: boolean;
} {
        let updated = false;

        if (target.kazutoriData == null) {
                target.kazutoriData = createDefaultKazutoriData();
                updated = true;
        } else {
                const data = target.kazutoriData;

                if (data.ratingVersion == null) {
                        data.ratingVersion = KAZUTORI_RATING_VERSION;
                        updated = true;
                } else if (data.ratingVersion !== KAZUTORI_RATING_VERSION) {
                        data.rate = 1000;
                        data.ratingVersion = KAZUTORI_RATING_VERSION;
                        delete data.rateChanged;
                        updated = true;
                }

                if (typeof data.rate !== 'number' || Number.isNaN(data.rate)) {
                        data.rate = 1000;
                        delete data.rateChanged;
                        updated = true;
                } else if (!Number.isInteger(data.rate)) {
                        data.rate = Math.round(data.rate);
                        updated = true;
                }

                if (typeof data.winCount !== 'number' || Number.isNaN(data.winCount)) {
                        data.winCount = 0;
                        updated = true;
                }

                if (typeof data.playCount !== 'number' || Number.isNaN(data.playCount)) {
                        data.playCount = 0;
                        updated = true;
                }

                if (typeof data.rateChanged !== 'boolean') {
                        if (typeof data.rateChanged === 'string') {
                                const lowered = data.rateChanged.toLowerCase();
                                if (lowered === 'true') {
                                        data.rateChanged = true;
                                } else if (lowered === 'false') {
                                        data.rateChanged = false;
                                }
                        } else if (typeof data.rateChanged === 'number') {
                                if (data.rateChanged === 1) {
                                        data.rateChanged = true;
                                } else if (data.rateChanged === 0) {
                                        data.rateChanged = false;
                                }
                        }

                        if (typeof data.rateChanged !== 'boolean') {
                                if (typeof data.rate === 'number' && data.rate !== 1000) {
                                        data.rateChanged = true;
                                } else {
                                        delete data.rateChanged;
                                }
                        }

                        updated = true;
                }

                if (data.lastRateChange != null && (typeof data.lastRateChange !== 'number' || Number.isNaN(data.lastRateChange))) {
                        delete data.lastRateChange;
                        updated = true;
                }

                if (data.lastRateChangeAt != null) {
                        delete data.lastRateChangeAt;
                        updated = true;
                }

                if (data.lastRateLossAdjustmentPercent != null) {
                        if (typeof data.lastRateLossAdjustmentPercent !== 'number' || Number.isNaN(data.lastRateLossAdjustmentPercent)) {
                                delete data.lastRateLossAdjustmentPercent;
                                updated = true;
                        } else if (data.lastRateLossAdjustmentPercent < 0 || data.lastRateLossAdjustmentPercent > 100) {
                                data.lastRateLossAdjustmentPercent = Math.min(
                                        Math.max(data.lastRateLossAdjustmentPercent, 0),
                                        100
                                );
                                updated = true;
                        }
                }

                if (data.lastRateChangeGameId != null && typeof data.lastRateChangeGameId !== 'string') {
                        delete data.lastRateChangeGameId;
                        updated = true;
                }

                if (
                        data.lastGameResult != null &&
                        data.lastGameResult !== 'win' &&
                        data.lastGameResult !== 'lose' &&
                        data.lastGameResult !== 'no-winner' &&
                        data.lastGameResult !== 'absent'
                ) {
                        delete data.lastGameResult;
                        updated = true;
                }

                if (!Array.isArray(data.inventory)) {
                        data.inventory = [];
                        updated = true;
                }

                if (data.lastPlayedAt != null && (typeof data.lastPlayedAt !== 'number' || Number.isNaN(data.lastPlayedAt))) {
                        delete data.lastPlayedAt;
                        updated = true;
                }

                if (data.lastWinAt != null && (typeof data.lastWinAt !== 'number' || Number.isNaN(data.lastWinAt))) {
                        delete data.lastWinAt;
                        updated = true;
                }
        }

        return { data: target.kazutoriData as EnsuredKazutoriData, updated };
}

/**
 * レーティングランキングからユーザーの順位を取得する
 *
 * @param records - レート降順でソート済みのランキング
 * @param userId - 検索対象のユーザーID
 * @returns 1始まりの順位。見つからない場合は `undefined`
 * @public
 */
export function findRateRank(records: { userId: string; rate: number }[], userId: string): number | undefined {
        const index = records.findIndex((record) => record.userId === userId);
        return index >= 0 ? index + 1 : undefined;
}

/**
 * レートを表示用に整形する
 *
 * @remarks
 * 10000を超えるレートは9999にキャップされる。
 *
 * @param rate - 整形対象のレート値
 * @returns 表示用のレート値
 * @public
 */
export function formatKazutoriRateForDisplay(rate: number): number {
        const roundedRate = Math.round(rate);
        return roundedRate > 10000 ? 9999 : roundedRate;
}

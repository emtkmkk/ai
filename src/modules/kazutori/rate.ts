export const KAZUTORI_RATING_VERSION = 1;

export type KazutoriDataContainer = {
        kazutoriData?: {
                winCount?: number;
                playCount?: number;
                rate?: number;
                inventory?: string[];
                medal?: number;
                lastPlayedAt?: number;
                lastWinAt?: number;
                ratingVersion?: number;
                rateChanged?: boolean | string | number;
                lastRateChange?: number;
                lastRateLossAdjustmentPercent?: number;
                lastRateChangeGameId?: string;
                lastGameResult?: 'win' | 'lose' | 'no-winner' | 'absent';
                [key: string]: any;
        };
};

export type EnsuredKazutoriData = {
        winCount: number;
        playCount: number;
        rate: number;
        inventory: string[];
        ratingVersion: number;
        rateChanged?: boolean;
        lastRateChange?: number;
        lastRateLossAdjustmentPercent?: number;
        lastRateChangeGameId?: string;
        lastGameResult?: 'win' | 'lose' | 'no-winner' | 'absent';
        medal?: number;
        lastPlayedAt?: number;
        lastWinAt?: number;
        [key: string]: any;
};

export function hasKazutoriRateHistory(data: { rate: number; rateChanged?: boolean }): boolean {
        if (data.rateChanged === true) {
                return true;
        }

        if (!data.rateChanged) {
                return false;
        }

        return data.rate === undefined && typeof data.rate === "number" && data.rate !== 1000;
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

                if (data.ratingVersion !== KAZUTORI_RATING_VERSION) {
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

export function findRateRank(records: { userId: string; rate: number }[], userId: string): number | undefined {
        const index = records.findIndex((record) => record.userId === userId);
        return index >= 0 ? index + 1 : undefined;
}

export function formatKazutoriRateForDisplay(rate: number): number {
        const roundedRate = Math.round(rate);
        return roundedRate > 10000 ? 9999 : roundedRate;
}

export const KAZUTORI_RATING_VERSION = 1;

export type KazutoriDataContainer = {
        kazutoriData?: {
                winCount?: number;
                playCount?: number;
                rate?: number;
                inventory?: string[];
                medal?: number;
                ratingVersion?: number;
                rateChanged?: boolean;
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
        medal?: number;
        [key: string]: any;
};

export function hasKazutoriRateHistory(data: { rate: number; rateChanged?: boolean }): boolean {
        return data.rateChanged === true || (data.rateChanged == null && data.rate !== 1000);
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
                        if (typeof data.rate === 'number' && data.rate !== 1000) {
                                data.rateChanged = true;
                        } else {
                                delete data.rateChanged;
                        }
                        updated = true;
                }

                if (!Array.isArray(data.inventory)) {
                        data.inventory = [];
                        updated = true;
                }
        }

        return { data: target.kazutoriData as EnsuredKazutoriData, updated };
}

export function findRateRank(records: { userId: string; rate: number }[], userId: string): number | undefined {
        const index = records.findIndex((record) => record.userId === userId);
        return index >= 0 ? index + 1 : undefined;
}

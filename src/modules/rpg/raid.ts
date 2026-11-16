/**
 * @packageDocumentation
 *
 * RPGモジュールのレイドイベント
 *
 * タイムラインに投稿される討伐イベント。参加者全員で1体のレイドボスに挑み、
 * ダメージを合計して討伐する。自動開始・参加処理・報酬配布・3種のダメージ計算パターンを持つ。
 *
 * @remarks
 * - getTotalDmg: 通常レイド戦闘
 * - getTotalDmg2: じゃんけん型
 * - getTotalDmg3: コンテスト型
 *
 * @public
 */
import 藍 from '@/ai';
import { Collection } from 'lokijs';
import Message from '@/message';
import { User } from '@/misskey/user';
import type rpg from './index';
import { colors } from './colors';
import type { Color } from './colors';
import { endressEnemy, Enemy, RaidEnemy, raidEnemys } from './enemys';
import { rpgItems } from './items';
import { aggregateSkillsEffects, calcSevenFever, amuletMinusDurability, getSkillsShortName, countDuplicateSkillNames } from './skills';
import { aggregateTokensEffects } from './shop';
import { initializeData, getColor, getAtkDmg, getEnemyDmg, showStatusDmg, getPostCount, getPostX, getVal, random, getRaidPostX, preLevelUpProcess, deepClone } from './utils';
import { applyKazutoriMasterHiddenBonus, applyKazutoriMasterPostCountFloor, applyWeakAtkReduction, calculateArpen, calculateStats, ensureKazutoriMasterHistory, fortune, getKazutoriMasterBonus, getKazutoriMasterMessage, stockRandom } from './battle';
import serifs from '@/serifs';
import getDate from '@/utils/get-date';
import { acct } from '@/utils/acct';
import * as seedrandom from 'seedrandom';
import config from '@/config';
import { createRaidRandom, RaidRandom } from './raid-random';
import type { SkillEffect } from './skill-data';
import { applyHyperModeEffects, applySuperColorModeEffects, getSuperColorMode } from './super-mode';
import { computeContestStats } from './contest';
import { BattleLog } from './battle-log';

type RaidAdditionalStatus = {
	icon: string;
	value: number;
};


function reduceByBarrier(dmg: number, barrier: number) {
	if (barrier <= 0 || dmg <= 0) {
		return {
			reducedDmg: dmg,
			consumed: 0,
			restBarrier: barrier,
		};
	}

	const consumed = Math.min(dmg, barrier);
	const reducedDmg = Math.max(dmg - consumed, 0);

	return {
		reducedDmg,
		consumed,
		restBarrier: barrier - consumed,
	};
}

function normalizeSevenFeverBarrierGain(value: number) {
	if (value <= 0) return 0;
	if (value <= 7) return 7;
	return Math.round(value / 7) * 7;
}

/** レイド情報の型 */
export type Raid = {
	/** 攻撃者の配列 */
	attackers: {
		/** 攻撃者のユーザー情報 */
		user: {
			/** ユーザーのID */
			id: string;
			/** ユーザー名 */
			username: string;
			/** ユーザーのホスト */
			host: User['host'];
		};
		/** 攻撃者の自分の情報 */
		me: string;
		/** 攻撃者のダメージ */
		dmg: number;
		/** 攻撃者のレベル */
		lv: number;
		/** 攻撃者の攻撃回数 */
		count: number;
		/** 所持しているスキル情報 */
		skillsStr?: {
			skills?: string | undefined;
			amulet?: string | undefined;
		};
		/** 攻撃者のマーク */
		mark: string;
		replyId?: string;
		/** 管理者による再計算を行った日時（タイムスタンプ） */
		recalculatedAt?: number;
		/** 最初の再計算前のダメージ（再計算の監査用） */
		originalDmg?: number;
	}[];
	/** レイドの敵 */
	enemy: RaidEnemy;
	/** レイドが終了しているかどうかのフラグ */
	isEnded: boolean;
	/** レイドの開始時間（タイムスタンプ） */
	startedAt: number;
	/** レイドの終了予定時間（タイムスタンプ） */
	finishedAt: number;
	/** レイドに関連する投稿のID */
	postId: string;
	/** レイドを開始したユーザーのID（未定義の場合もあり） */
	triggerUserId: string | undefined;
	/** レイドに返信した投稿のキーの配列 */
	replyKey: string[];
};

let ai: 藍;
let module_: rpg;
let raids: Collection<Raid>;

// -------- セットアップ --------

/**
 * レイドインストール関数
 * @param _ai 藍オブジェクト
 * @param _module rpgモジュール
 * @param _raids レイドコレクション
 */
export function raidInstall(_ai: 藍, _module: rpg, _raids: Collection<Raid>) {
	ai = _ai;
	module_ = _module;
	raids = _raids;
	crawleGameEnd();
	setInterval(crawleGameEnd, 1000);
	setInterval(scheduleRaidStart, 1000 * 60 * 1);
}

// #region レイド活力（未参加レイドの蓄積・参加時消費）

/**
 * レイド活力機能の導入時刻（JST 2026-06-20 0:00）
 *
 * @remarks
 * マイグレーション時の watermark として使用。導入前にスキップしたレイドは蓄積しない。
 *
 * @internal
 */
const RAID_VITALITY_DEPLOY_AT = new Date('2026-06-20T00:00:00+09:00').getTime();

/**
 * レイド活力の消費状態（調子・HP の段階的消費を追跡）
 *
 * @internal
 */
type RaidVitalityState = {
	remaining: number;
	moodUsed: number;
	hpUsed: number;
};

/**
 * レイド活力の消費状態を初期化する
 *
 * @param data RPGプレイヤーデータ
 * @returns 消費追跡用オブジェクト
 * @internal
 */
function createRaidVitalityState(data): RaidVitalityState {
	return { remaining: data.raidVitality ?? 0, moodUsed: 0, hpUsed: 0 };
}

/**
 * 調子補正（bonusX）にレイド活力を適用する
 *
 * @param state 消費追跡状態
 * @param baseBonusX ジャックポット前の平日/固定調子（0〜1.0）
 * @returns レイド活力適用後の bonusX
 * @internal
 */
function applyRaidVitalityMood(state: RaidVitalityState, baseBonusX: number): number {
	const moodCap = 1.0;
	const stepsNeeded = baseBonusX < moodCap
		? Math.ceil((moodCap - baseBonusX) / 0.25)
		: 0;
	const moodUsed = Math.min(state.remaining, stepsNeeded);
	state.moodUsed += moodUsed;
	state.remaining -= moodUsed;
	return baseBonusX + moodUsed * 0.25;
}

/**
 * 最大HPにレイド活力を適用する
 *
 * @param state 消費追跡状態
 * @param playerMaxHp ロール後の最大HP
 * @param rawMaxHp 基礎体力
 * @param bonusMaxHp 本来の最大HP（random=1.0 相当）
 * @returns 補正後の最大HP
 * @internal
 */
function applyRaidVitalityHp(state: RaidVitalityState, playerMaxHp: number, rawMaxHp: number, bonusMaxHp: number): number {
	const naturalMaxHp = bonusMaxHp;
	if (bonusMaxHp <= rawMaxHp || state.remaining <= 0) {
		return playerMaxHp;
	}
	let hp = playerMaxHp;
	while (state.remaining > 0 && hp < naturalMaxHp) {
		hp = Math.min(
			hp + Math.round((naturalMaxHp - hp) * 0.25),
			naturalMaxHp,
		);
		state.hpUsed += 1;
		state.remaining -= 1;
	}
	return hp;
}

/**
 * レイド活力のHP消費をデータに反映する
 *
 * @param data RPGプレイヤーデータ
 * @param state 消費追跡状態
 * @internal
 */
function finalizeRaidVitalityHpConsumption(data, state: RaidVitalityState): void {
	if (state.hpUsed > 0) {
		data.raidVitality = Math.max(0, (data.raidVitality ?? 0) - state.hpUsed);
	}
}

/**
 * 既存参加者向けにレイド活力フィールドをマイグレーションする
 *
 * @param data RPGプレイヤーデータ
 * @param userId ユーザーID
 * @internal
 */
function migrateRaidVitalityFields(data, userId: string): void {
	let latestPostId: string | undefined;
	let latestTs = 0;
	for (const raid of raids.find({}) ?? []) {
		const joined = raid.attackers?.some((a) => a.user?.id === userId && (a.dmg ?? 0) > 0);
		if (!joined) continue;
		const ts = raid.finishedAt ?? raid.startedAt ?? 0;
		if (ts >= latestTs) {
			latestTs = ts;
			latestPostId = raid.postId;
		}
	}
	if (!latestPostId) return;
	data.lastRaidParticipatedPostId = latestPostId;
	data.lastRaidVitalityProcessedAt = RAID_VITALITY_DEPLOY_AT;
}

/**
 * 終了した未参加レイドを走査し、レイド活力を蓄積する
 *
 * @remarks
 * - 過去1回以上レイド参加があるユーザーのみ対象
 * - 初回は raids 履歴から postId を埋め、watermark を導入時点にセット（導入前のスキップは数えない）
 * - 遅延計算。全フレンドの定時走査は行わない
 *
 * @param data RPGプレイヤーデータ
 * @param userId ユーザーID
 * @public
 */
export function accumulateRaidVitality(data, userId: string): void {
	if (data.raidVitality == null) data.raidVitality = 0;
	if (!data.lastRaidParticipatedPostId) {
		migrateRaidVitalityFields(data, userId);
		if (!data.lastRaidParticipatedPostId) return;
	}

	const anchor = raids.findOne({ postId: data.lastRaidParticipatedPostId });
	if (!anchor) return;

	const watermark = data.lastRaidVitalityProcessedAt ?? anchor.startedAt;
	const endedRaids = (raids.find({ isEnded: true }) ?? []).slice().sort((a, b) => a.startedAt - b.startedAt);

	for (const raid of endedRaids) {
		if (raid.startedAt <= anchor.startedAt) continue;
		if ((raid.finishedAt ?? 0) <= watermark) continue;
		const joined = raid.attackers?.some((a) => a.user?.id === userId && (a.dmg ?? 0) > 0);
		if (!joined) data.raidVitality += 1;
		data.lastRaidVitalityProcessedAt = raid.finishedAt ?? raid.startedAt;
	}
}

// #endregion

/**
 * 個人評価 scoreRaw が指定した星の値ちょうどになる totalDmg を算出する
 *
 * @remarks
 * レイド戦闘中の個人評価式 `log2((totalDmg * 20) / base) + 1` の逆算。
 * `base = 1024 / (power / 30)`。`* 20` を含めるため、嫉妬・わかば加護などの
 * 「評価が低い間だけ効果」を星の閾値に正しく揃えるために使用する。
 * `enemy.power` が無い敵では評価自体が存在しないため、呼び出し側でスキップすること。
 *
 * @param enemy レイド敵
 * @param star 基準の星（3 や 5）
 * @returns scoreRaw が star になる totalDmg
 * @internal
 */
function getIndividualRaidStarDamageThreshold(enemy: RaidEnemy, star: number): number {
	const base = 1024 / ((enemy?.power ?? 30) / 30);
	return base * (2 ** (star - 1)) / 20;
}

/**
 * レイド戦闘中の個人評価 scoreRaw を算出する
 *
 * @remarks
 * {@link getIndividualRaidStarDamageThreshold} の逆方向。投影判定や verbose 表示に使用する。
 * `enemy.power` が無い敵では評価が存在しないため undefined を返す。
 *
 * @param enemy レイド敵
 * @param totalDmg 総与ダメージ
 * @returns scoreRaw（power 無しは undefined）
 * @internal
 */
function getIndividualRaidScore(enemy: RaidEnemy, totalDmg: number): number | undefined {
	if (!enemy?.power) return undefined;
	const base = 1024 / ((enemy.power ?? 30) / 30);
	return Math.max(Math.log2((totalDmg * 20) / base) + 1, 1);
}

/**
 * 終了すべきレイドがないかチェックする
 *
 * 1秒ごとに呼ばれ、制限時間経過のレイドを finish で終了する。
 *
 * @internal
 */
function crawleGameEnd() {
	/** 現在進行中のレイド */
	const raid = raids.findOne({
		isEnded: false
	});

	if (raid === null || raid === undefined) return;

	// 制限時間経過（finishedAt 未設定なら startedAt + 10分）で finish を呼ぶ
	if (Date.now() - (raid.finishedAt ?? raid.startedAt + 1000 * 60 * 10) >= 0) {
		finish(raid);
	}
}

/**
 * レイド開始時間をスケジュールする
 *
 * 1分ごとに呼ばれ、所定の時刻（8:15 / 12:15 / 18:15 / 21:15 等）に start を実行する。
 *
 * @internal
 */
function scheduleRaidStart() {
	/** 現在の時間（時） */
	const hours = new Date().getHours();
	const minutes = new Date().getMinutes();

	// 固定枠：8/12/18/21 時の 15 分に開始
	if ([8, 12, 18, 21].includes(hours) && minutes === 15) {
		start();
	}
	// 月〜木のランダム枠：日付+アカウントID でシード固定。時・分はランダム候補から1つずつ選択
	const day = new Date().getDay();
	const randomHours = [6, 7, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 22];
	const randomMinutes = [0, 20, 30, 50];
	let rnd = seedrandom(getDate() + ai.account.id);
	if (day >= 1 && day <= 4 && hours === randomHours[Math.floor(rnd() * randomHours.length)] && minutes === randomMinutes[Math.floor(rnd() * randomMinutes.length)]) {
		start();
	}
	// 19:45：土日は通常開始、18日/月/木は "h" フラグで鳩車（:hatoguruma:）を強制
	if (hours === 19 && minutes === 45) {
		if ((day === 6 || day === 0)) {
			start();
		} else if (new Date().getDate() === 18 || day === 1 || day === 4) {
			start(undefined, "h");
		}

	}
	// 金・土の 22:45 に夜間枠
	if (day >= 5 && hours === 22 && minutes === 45) {
		start();
	}
	// 土日の 10:15 / 15:15 に週末枠
	if ((day === 6 || day === 0) && [10, 15].includes(hours) && minutes === 15) {
		start();
	}
}

// -------- レイド開始 --------

/**
 * レイドボスを開始する
 *
 * レイド投稿を作成し、参加を受け付ける。前回レイドから31分未満の場合は開始しない。
 *
 * @param triggerUserId スタートさせたユーザID（手動開始時）
 * @param flg 特殊なフラグ（"h" 等）
 * @internal
 */
export async function start(triggerUserId?: string, flg?: string | string[]) {

	/** すべてのレイドゲームのリスト */
	const games = raids.find({});

	// 前回レイドから 31 分未満なら開始しない（連続開始を防ぐ）
	if (games.length > 0 && Date.now() - games[games.length - 1].startedAt < 31 * 60 * 1000) return;

	ai.decActiveFactor();

	// 直近 N 体のボス名を取得（重複を避けるため除外リストに使用）
	const recentRaidList = games.slice(Math.min((raidEnemys.length - 1) * -1, -6)).map(obj => obj.enemy.name ?? "");

	/** 直近で出現したボスを除外した候補リスト */
	const filteredRaidEnemys =
		raidEnemys.filter((x) => !recentRaidList.includes(x.name));

	const rpgData = ai.moduleData.findOne({ type: 'rpg' });
	if (rpgData) {
		if (!rpgData.raidScore) rpgData.raidScore = {};
	}
	/** 未討伐ボス（誰もスコアを出していないボス） */
	const notPlayedBoss = raidEnemys.filter((x) => !rpgData || !rpgData.raidScore[x.name]);

	// ボス選択：「r」フラグなら前回と同じボス、なければ未討伐優先、どちらもなければ filtered からランダム
	let enemy = games.length >= 2 && flg?.includes("r") && raidEnemys.find((x) => x.name === games[games.length - 1]?.enemy?.name) ? raidEnemys.find((x) => x.name === games[games.length - 1]?.enemy?.name) : notPlayedBoss.length ? notPlayedBoss[Math.floor(Math.random() * notPlayedBoss.length)] : filteredRaidEnemys[Math.floor(Math.random() * filteredRaidEnemys.length)];
	if (!enemy) return

	// 「h」フラグ（18日/月/木の 19:45 等）：鳩車を強制
	if (flg?.includes("h")) enemy = raidEnemys.find((x) => x.name === ":hatoguruma:") ?? enemy;

	// 制限時間（分）。タイムアウト時は limitMinutes/2 経過で再ノート
	let limitMinutes = 30;

	/** レイド開始の投稿 */
	const post = await ai.post({
		text: enemy.introMsg ? enemy.introMsg(enemy.dname ?? enemy.name, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)) : serifs.rpg.intro(enemy.dname ?? enemy.name, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)),
	}, { scheduled: true });

	// 新しいレイドをデータベースに挿入
	raids.insertOne({
		attackers: [],
		enemy,
		isEnded: false,
		startedAt: Date.now(),
		finishedAt: Date.now() + 1000 * 60 * limitMinutes,
		postId: post.id,
		triggerUserId,
		replyKey: [],
	});

	module_.subscribeReply(post.id, post.id);

	// タイマーセット
	module_.setTimeoutWithPersistence(1000 * 60 * limitMinutes / 2, {
		id: post.id,
	});

	module_.log('New raid started');
}

// -------- レイド終了・報酬 --------

/**
 * レイドを終了させ、報酬を配布する
 *
 * isEnded を true にし、参加者にコインを配布、reply を unsubscribe する。
 *
 * @param raid 終了させるレイド
 * @internal
 */
function finish(raid: Raid) {
	raid.isEnded = true;
	raids.update(raid);

	module_.log('raid finished');
	/** RPGモジュールのデータ */
	const rpgData = ai.moduleData.findOne({ type: 'rpg' });

	// 有効な攻撃者（dmg > 1）がいない場合は逃走扱い
	if (!raid.attackers?.filter((x) => x.dmg > 1).length) {
		ai.decActiveFactor((raid.finishedAt.valueOf() - raid.startedAt.valueOf()) / (60 * 1000 * 100));
		if (rpgData) rpgData.raidReputations = [];
		ai.post({
			text: raid.enemy.power ? serifs.rpg.onagare(raid.enemy.name) : serifs.rpg.onagare2(raid.enemy.name),
			renoteId: raid.postId
		});

		return;
	}

	/** 結果の文字列配列 */
	let results: string[] = [];

	/** ユーザーIDのセット */
	const seenIds = new Set();

	// ダメージ 0 未満を除外し、同一ユーザーの重複参加は最初の1件のみ採用。ダメージ降順でソート
	let sortAttackers = raid.attackers.filter((attacker) => {
		if (attacker.dmg < 0) return false;
		if (seenIds.has(attacker.user.id)) {
			return false;
		} else {
			seenIds.add(attacker.user.id);
			return true;
		}
	}).sort((a, b) => b.dmg - a.dmg);

	/** 攻撃者の最大レベルの桁数 */
	let levelSpace = String(raid.attackers.reduce((pre, cur) => pre > cur.lv ? pre : cur.lv, 0)).length;

	/** 総ダメージ */
	const total = sortAttackers.reduce((pre, cur) => pre + cur.dmg, 0);

	// 評価スコア：総ダメージと power から星★数を算出（power が無い敵はスコア算出なし）
	const score = raid.enemy.power ? Math.max(Math.floor(Math.log2(total / (1024 / ((raid.enemy.power ?? 30) / 30))) + 1), 1) : undefined;
	const scoreRaw = score ? Math.max(Math.log2(total / (1024 / ((raid.enemy.power ?? 30) / 30))) + 1, 1) : undefined;

	// 1位に王冠を付与し、コイン +1 枚のボーナス
	if (sortAttackers?.[0]) {
		if (sortAttackers?.[0].mark === ":blank:") {
			sortAttackers[0].mark = "👑";
		}
		const friend = ai.lookupFriend(sortAttackers[0].user.id);
		if (friend) {
			const data = friend.getPerModulesData(module_);
			data.coin = (data.coin ?? 0) + 1;
			friend.setPerModulesData(module_, data);
		}
	}

	let references: string[] = [];

	for (let attacker of sortAttackers) {
		results.push(`${attacker.me} ${acct(attacker.user)}:\n${attacker.mark === ":blank:" && attacker.dmg === 100 ? "💯" : attacker.mark} ${!raid.enemy.scoreMsg2 ? `${attacker.count}ターン ` : ""}${attacker.dmg.toLocaleString()}${raid.enemy.scoreMsg2 ?? "ダメージ"}`);
		if (results.length <= 19 && (attacker.skillsStr?.skills || attacker.skillsStr?.amulet)) results.push(`:blank: <small>${[
			attacker.skillsStr?.skills,
			attacker.skillsStr?.amulet ? `お守り ${attacker.skillsStr.amulet}` : undefined
		].filter(Boolean).join(" ")}</small>`);
		if (references.length < 100) {
			if (attacker.replyId) references.push(attacker.replyId);
		}
	}

	if (sortAttackers.length > 1) {
		results.push(`\n合計: ${sortAttackers.length}人 ${total.toLocaleString()}${raid.enemy.scoreMsg2 ?? "ダメージ"}${score && scoreRaw ? `\n評価: ${"★".repeat(score)}\n★${Math.floor(scoreRaw)} ${Math.floor((scoreRaw % 1) * 8) !== 0 ? `$[bg.color=ffff90 ${":blank:".repeat(Math.floor((scoreRaw % 1) * 8))}]` : ""}$[bg.color=ff9090 ${":blank:".repeat(8 - Math.floor((scoreRaw % 1) * 8))}] ★${Math.floor(scoreRaw) + 1}` : ""}`);
	} else {
		results.push(`${score && scoreRaw ? `\n評価: ${"★".repeat(score)}\n★${Math.floor(scoreRaw)} ${Math.floor((scoreRaw % 1) * 8) !== 0 ? `$[bg.color=ffff90 ${":blank:".repeat(Math.floor((scoreRaw % 1) * 8))}]` : ""}$[bg.color=ff9090 ${":blank:".repeat(8 - Math.floor((scoreRaw % 1) * 8))}] ★${Math.floor(scoreRaw) + 1}` : ""}`);
	}

	// 討伐隊の評判値によるコインボーナス（直近13回の評価スコアの平均から算出）
	let bonusCoin = 1;

	if (rpgData) {
		if (score && raid.enemy.power) {
			if (!rpgData.raidReputations) {
				rpgData.raidReputations = [];
			}
			const sum1 = rpgData.raidReputations.length > 0 ? rpgData.raidReputations.reduce((acc, cur) => acc + cur, 0) : 0;
			const reputation1 = rpgData.raidReputations.length > 0 ? sum1 / rpgData.raidReputations.length : 0;

			rpgData.raidReputations.unshift(scoreRaw);

			if (rpgData.raidReputations.length >= 13) {
				rpgData.raidReputations.pop();
			}

			const sum2 = rpgData.raidReputations.reduce((acc, cur) => acc + cur, 0);
			const reputation2 = sum2 / rpgData.raidReputations.length;

			// 評判値が高いほどコイン倍率アップ（1〜11 の範囲）
			bonusCoin = Math.min(Math.max(1, Math.floor(reputation2 * 16.75 * (1.5 ** reputation2)) / 750), 11);

			if (reputation1 === 0) {
				results.push(`討伐隊の評判値: ${Math.floor(reputation2 * 16.75 * (1.5 ** reputation2)).toLocaleString()} ↑アップ！`);
			} else {
				results.push(`討伐隊の評判値: ${Math.floor(reputation1 * 16.75 * (1.5 ** reputation1)).toLocaleString()} → ${Math.floor(reputation2 * 16.75 * (1.5 ** reputation2)).toLocaleString()} ${reputation1 < reputation2 ? "↑アップ！" : reputation1 > reputation2 ? "↓ダウン…" : ""}`);
			}

			if (score !== Math.floor((score ?? 4) * bonusCoin)) {
				results.push(`評判値ボーナス！ もこコイン+${Math.floor((score ?? 4) * bonusCoin) - score}枚`);
			}
		}
		if (!rpgData.raidScore) rpgData.raidScore = {};
		if (!rpgData.raidScoreDate) rpgData.raidScoreDate = {};
		// 自己ベスト更新時のみ raidScore を更新
		if (!rpgData.raidScore[raid.enemy.name] || rpgData.raidScore[raid.enemy.name] < total) {
			if (rpgData.raidScore[raid.enemy.name] && score) {
				results.push("\n" + serifs.rpg.GlobalHiScore(rpgData.raidScore[raid.enemy.name], rpgData.raidScoreDate[raid.enemy.name] ?? "", total));
			}
			rpgData.raidScore[raid.enemy.name] = total;
			rpgData.raidScoreDate[raid.enemy.name] = getDate();
		}
		ai.moduleData.update(rpgData);
	} else {
		ai.moduleData.insert({ type: 'rpg', maxLv: 1, raidScore: { [raid.enemy.name]: total }, raidScoreDate: { [raid.enemy.name]: getDate() } });
	}

	// 3人以上参加時：ランダム or 1位を「ラッキー/優勝」としてボーナスコイン付与
	if (sortAttackers.length >= 3) {
		const luckyUser = sortAttackers[scoreRaw ? Math.floor(Math.random() * sortAttackers.length) : 0].user;
		const bonus = Math.ceil(sortAttackers.length / 5 * (scoreRaw ?? (sortAttackers[0].dmg / 10)));
		results.push((scoreRaw ? "\nラッキー！: " : "優勝！: ") + acct(luckyUser) + `\n${config.rpgCoinName}+` + bonus + "枚");
		const friend = ai.lookupFriend(luckyUser.id);
		if (friend) {
			const data = friend.getPerModulesData(module_);
			data.coin = Math.max((data.coin ?? 0) + (bonus ?? 1), (data.coin ?? 0));
			if (!data.maxLucky || data.maxLucky < (bonus ?? 1)) data.maxLucky = (bonus ?? 1);
			friend.setPerModulesData(module_, data);
		}
	}

	const text = results.join('\n') + '\n\n' + (score ? serifs.rpg.finish(raid.enemy.name, Math.floor((score ?? 4) * bonusCoin)) : serifs.rpg.finish2(raid.enemy.name, 4));

	// 参加者ごとにコイン配布し、勝敗数から raidAdjust（マッチング調整用の隠し補正）を更新
	sortAttackers.forEach((x) => {
		const friend = ai.lookupFriend(x.user.id);
		if (!friend) return;
		const data = friend.getPerModulesData(module_);
		data.coin = Math.max((data.coin ?? 0) + Math.floor((score ?? 4) * bonusCoin), (data.coin ?? 0));
		const winCount = sortAttackers.filter((y) => x.dmg > y.dmg).length;
		const loseCount = sortAttackers.filter((y) => x.dmg < y.dmg).length;
		// 勝数 - 負数×1/3 を四捨五入して raidAdjust に加算
		data.raidAdjust = (data.raidAdjust ?? 0) + Math.round(winCount - (loseCount * (1/3)));
		friend.setPerModulesData(module_, data);
	});

	try {
		ai.post({
			text: text,
			cw: score ? serifs.rpg.finishCw(raid.enemy.name) : serifs.rpg.finishCw2(raid.enemy.name),
			renoteId: raid.postId,
			referenceIds: references,
		});
	} catch (err) {
		module_.log(`レイド結果投稿エラー: ${err instanceof Error ? err.stack ?? err.message : err}`);
	} finally {
		module_.unsubscribeReply(raid.postId);
		raid.replyKey.forEach((x) => module_.unsubscribeReply(x));
	}
}

// -------- 平行次元ハーネス --------

/** 平行次元のお札用：シミュレーション1回分の結果記録 */
type ParallelDimensionRun = {
	/** ダメージ計算結果（getTotalDmg* の戻り値、または undefined=失敗） */
	result: any;
	/** シミュレーション後の perModulesData[rpg] のスナップショット */
	mutated: any;
	/** 試行中にバッファした msg.reply 呼び出し引数と、戻り値として返したダミーオブジェクト */
	replies: { args: unknown[]; fake: { id: string | undefined } }[];
};

/**
 * autobind-decorator で定義されたメソッドを、共有クロージャを汚染せずに差し替える
 *
 * @remarks
 * WARNING: `obj.method = fn` のような通常の代入は、autobind-decorator v2.x のプロトタイプ descriptor
 *          が持つ setter を経由し、**クラス全体で共有されているクロージャ変数 `fn`** を書き換えてしまう。
 *          その結果、他のインスタンスが初めてメソッドを参照したタイミングで差し替え後の関数を bind して
 *          キャッシュしてしまい、別ユーザーの処理が意図せずこちら側の差し替え関数を実行してしまう（≒副作用が漏れる）。
 *
 *          これを避けるため、`Object.defineProperty` で **データプロパティ** としてインスタンスに直接定義し、
 *          autobind の setter を経由しないようにする。復元時も同様にデータプロパティで上書きする。
 *
 * @param target 対象オブジェクト
 * @param key プロパティ名
 * @param value 差し替え先の関数
 * @internal
 */
function defineDataProperty(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, {
		configurable: true,
		writable: true,
		enumerable: true,
		value,
	});
}

/**
 * 平行次元のお札によるレイド並列シミュレーションハーネス
 *
 * 所持枚数 + 1 回のシミュレーションを行い、最良ダメージの「次元」を正史として採用する。
 *
 * @remarks
 * NOTE: getTotalDmg* は data / enemy を破壊的に書き換えるため、試行ごとに deepClone したスナップショットから復元する。
 * NOTE: msg.reply / msg.friend.setPerModulesData を一時的に no-op / バッファ版に差し替え、副作用を抑止する。
 *       全試行完了後、正史の data だけを永続化し、正史がバッファした reply 引数で実際の投稿を行う。
 * NOTE: msg.friend.doc.kazutoriData の更新など perModulesData 外の副作用は、
 *       kazutori 履歴に基づく冪等な補正であり許容する（お札を持たない場合にも同条件で起きる更新のため）。
 *
 * WARNING: 差し替えは必ず {@link defineDataProperty} を使うこと。通常の代入（`msg.reply = ...`）だと
 *          autobind-decorator の setter を経由してクラス共有のクロージャが書き換わり、
 *          **他ユーザーの msg.reply / friend.setPerModulesData がこちら側の差し替え関数を実行してしまう**
 *          （＝「お札を持っていると他の人のレイド結果がこちらに来る」バグの原因）。
 *
 * @param msg 参加返信メッセージ
 * @param enemy レイド敵（元オブジェクト。各試行には deepClone を渡す）
 * @param module 対象モジュール（perModulesData のキー取得に使用）
 * @param runRaidDamage 実際のダメージ計算を行う関数（pattern によって 3 種のいずれかを内部で振り分ける。2つ目の引数は平行次元の番号で、正史 = 0）
 * @param parallelCount 追加で走らせる平行次元数（お札所持枚数を安全上限でクランプ済みの値。正史の1回はこれに+1される）
 * @param logError エラー時のロガー（module.log 等）
 * @returns 正史として採用されたダメージ計算結果。全試行失敗時は undefined
 * @internal
 */
export async function runParallelDimensionRaid(
	msg: Message,
	enemy: RaidEnemy,
	module: { name: string },
	runRaidDamage: (enemyForRun: RaidEnemy, dimension: number) => Promise<any>,
	parallelCount: number,
	logError: (text: string) => void,
): Promise<any> {
	// perModulesData への参照を準備（無ければ初期化）
	const perModulesData = msg.friend.doc.perModulesData ?? (msg.friend.doc.perModulesData = {});
	const snapshot = deepClone(perModulesData[module.name] ?? {});
	// NOTE: autobind-decorator はプロトタイプに getter/setter descriptor を定義し、
	//       instance 側は最初のアクセスで boundFn をキャッシュする。ここで `msg.reply` を参照しておくと
	//       instance にデータ descriptor（getter 経由のキャッシュ）が張られ、originalな bound 関数が手に入る。
	const origReply = msg.reply;
	const origSet = msg.friend.setPerModulesData;

	const runs: ParallelDimensionRun[] = [];

	try {
		for (let i = 0; i <= parallelCount; i++) {
			// 各次元の開始前に data をスナップショットから deepClone してリセット
			perModulesData[module.name] = deepClone(snapshot);

			const replies: ParallelDimensionRun['replies'] = [];
			// NOTE: 通常代入だと autobind のクロージャを汚染してしまうので必ず defineDataProperty で差し替える。
			defineDataProperty(msg, 'reply', async (...args: unknown[]) => {
				const fake: { id: string | undefined } = { id: undefined };
				replies.push({ args, fake });
				return fake;
			});
			defineDataProperty(msg.friend, 'setPerModulesData', () => { /* no-op during simulation */ });

			let r: any;
			try {
				r = await runRaidDamage(deepClone(enemy) as RaidEnemy, i);
			} catch (err) {
				logError(`平行次元 ${i + 1}/${parallelCount + 1} の処理中にエラーが発生しました: ${err instanceof Error ? err.stack ?? err.message : err}`);
				r = undefined;
			}
			const mutated = deepClone(perModulesData[module.name]);
			runs.push({ result: r, mutated, replies });
		}
	} finally {
		// フックを必ず元に戻す（こちらも autobind クロージャを汚さないよう defineDataProperty で復元する）
		defineDataProperty(msg, 'reply', origReply);
		defineDataProperty(msg.friend, 'setPerModulesData', origSet);
	}

	// 最良次元を選択（result が reaction 応答や不正値の場合は -Infinity 扱い）
	const scoreOf = (r: any) =>
		r && typeof r.totalDmg === 'number' && !Number.isNaN(r.totalDmg) ? r.totalDmg : -Infinity;
	let winnerIdx = -1;
	let winnerScore = -Infinity;
	for (let i = 0; i < runs.length; i++) {
		const s = scoreOf(runs[i].result);
		if (s > winnerScore) {
			winnerScore = s;
			winnerIdx = i;
		}
	}
	const winner = winnerIdx >= 0 ? runs[winnerIdx] : undefined;

	if (!winner || winnerScore === -Infinity) {
		// 全次元失敗時はスナップショットへ巻き戻す
		perModulesData[module.name] = snapshot;
		return undefined;
	}

	// 他次元のスコア（正史＝winner を除く）を内部順（実行順）のまま列挙
	// NOTE: サーバログへの可視化用に winner.result へ添付する。失敗次元（-Infinity）は除外。
	const otherScores = runs
		.map((r, i) => ({ i, score: scoreOf(r.result) }))
		.filter((x) => x.i !== winnerIdx && x.score !== -Infinity)
		.map((x) => x.score);
	(winner.result as { parallelOtherScores?: number[] }).parallelOtherScores = otherScores;

	// 正史を確定: winner の data を永続化、バッファした msg.reply 引数で実際の返信を投稿する
	msg.friend.setPerModulesData(module as any, winner.mutated);
	for (const buffered of winner.replies) {
		try {
			const real = await (msg.reply as any)(...(buffered.args as unknown[]));
			buffered.fake.id = real?.id;
			if (!winner.result.reply && real) winner.result.reply = real;
		} catch (err) {
			logError(`平行次元のリプライ投稿でエラーが発生しました: ${err instanceof Error ? err.stack ?? err.message : err}`);
		}
	}
	return winner.result;
}

// -------- 参加処理 --------

/**
 * レイドの参加返信を処理するコンテキストフック
 *
 * レイド投稿への「参加」返信を受け取り、ダメージを計算して投稿に追加する。
 *
 * @param key レイドのキー（postId 等）
 * @param msg 返信メッセージ
 * @param data コンテキストデータ
 * @returns リアクションオブジェクト
 * @internal
 */
export async function raidContextHook(key: string, msg: Message, data: unknown) {
	if (!msg.extractedText.trim()) return {
		reaction: 'hmm'
	};

	const _data = msg.friend.getPerModulesData(module_);
	const showNormalRpgGuide = () => msg.reply(`レイドボスへの参加表明ありがとうございます！\nレイドボスに参加するには、通常のRPGモードを先に1回プレイする必要があります！（私にRPGと話しかけてください！）\nその後にもう一度先ほどの投稿に対して話しかけていただければ、レイドボスに参加できます！`);
	if (!_data.lv) {
		showNormalRpgGuide();
		return {
			reaction: 'hmm'
		};
	}

	const rpgData = ai.moduleData.findOne({ type: 'rpg' });
	const nowTimeStr = getDate() + (new Date().getHours() < 12 ? '' : new Date().getHours() < 18 ? '/12' : '/18');
	const nextTimeStr = new Date().getHours() < 12 ? getDate() + '/12' : new Date().getHours() < 18 ? getDate() + '/18' : getDate(1);
	const hasNormalRpgPlayRight = _data.lastPlayedAt !== nowTimeStr && _data.lastPlayedAt !== nextTimeStr && _data.lv < (rpgData?.maxLv ?? 1);

	if (_data.lv === 254 && hasNormalRpgPlayRight) {
		showNormalRpgGuide();
		return {
			reaction: 'hmm'
		};
	}

	/** 現在進行中のレイド */
	const raid = raids.findOne({
		isEnded: false,
		postId: key.split(":")[0],
	});

	if (raid === null || raid === undefined) return { reaction: 'confused' };

	let needUpdate = false;
	if (!raid.attackers) {
		raid.attackers = [];
		needUpdate = true;
	}

	if (!raid.replyKey) {
		raid.replyKey = [];
		needUpdate = true;
	}

	if (needUpdate) {
		raids.update(raid);
	}

	// 既に参加済み（dmg > 0 の同一 userId）なら拒否
	if (raid.attackers.some(x => x.dmg > 0 && x.user.id === msg.userId)) {
		msg.reply('すでに参加済みの様です！').then(reply => {
			raid.replyKey.push(raid.postId + ":" + reply.id);
			module_.subscribeReply(raid.postId + ":" + reply.id, reply.id);
			raids.update(raid);
		}).catch((err) => {
			module_.log(`レイド参加済みメッセージ送信エラー: ${err instanceof Error ? err.stack ?? err.message : err}`);
		});
		return {
			reaction: 'confused'
		};
	}

	/** 現在のレイドの敵 */
	const enemy = [...raidEnemys].find((x) => raid.enemy.name === x.name);

	if (!enemy) return { reaction: 'confused' };

	accumulateRaidVitality(_data, msg.userId);

	// 敵の pattern でダメージ計算を分岐：1=通常戦闘、2=じゃんけん型、3=コンテスト型
	// NOTE: 平行次元のお札を所持している場合、副作用を隔離した状態でシミュレーションを複数回実行し、
	//       最良ダメージの結果だけを正史として採用する。購入上限10枚 + 正史 = 最大11次元。
	//       壊れたデータ対策として最終防衛の安全上限 10 を raid 側でも保持する。
	const PARALLEL_DIMENSION_CAP = 10;
	const parallelCount = Math.min(PARALLEL_DIMENSION_CAP, Math.max(0, _data.parallelDimension ?? 0));

	// 平行次元では投稿数を先に1度だけ取得し、全次元で同じ値を使う
	// NOTE: 投稿数の取得は連携アカウント側にも「このレイドで使用済み」の印を付ける。
	//       次元ごとに取得し直すと、2次元目以降は連携アカウントの投稿数が 0 になってしまう。
	//       投稿数を使うのは通常戦闘（pattern 1）で、投稿数が固定されていない敵だけ。
	const usesPostCount = !(enemy.pattern && enemy.pattern > 1) && !enemy.forcePostCount;
	const parallelPostCount = parallelCount > 0 && usesPostCount
		? await getPostCount(ai, module_, _data, msg, 0, { type: 'raid', key: raid.postId })
		: undefined;

	// 敵の pattern に応じたダメージ計算ディスパッチ
	// 乱数はレイドの投稿ID + ユーザーID + 平行次元の番号から決める（同じ条件なら戦闘を再現できる）
	const runRaidDamage = async (enemyForRun: RaidEnemy, dimension = 0) => {
		const rng = createRaidRandom({ postId: raid.postId, userId: msg.userId, dimension });
		if (enemyForRun.pattern && enemyForRun.pattern > 1) {
			switch (enemyForRun.pattern) {
				case 3:
					return await getTotalDmg3(msg, enemyForRun, { rng });
				case 2:
				default:
					return await getTotalDmg2(msg, enemyForRun, { rng });
			}
		}
		return await getTotalDmg(msg, enemyForRun, raid.postId, { rng, postCount: parallelPostCount });
	};

	let result;
	if (parallelCount <= 0) {
		// 通常レイド: 既存挙動
		try {
			result = await runRaidDamage(enemy);
		} catch (err) {
			module_.log(`レイド参加処理中にエラーが発生しました: ${err instanceof Error ? err.stack ?? err.message : err}`);
			return {
				reaction: 'confused'
			};
		}
	} else {
		// 平行次元のお札: 並列ハーネスへ委譲
		result = await runParallelDimensionRaid(
			msg,
			enemy,
			module_,
			runRaidDamage,
			parallelCount,
			(text) => module_.log(text),
		);
		if (!result) {
			return {
				reaction: 'confused'
			};
		}
	}

	// ダメージ計算中の競合：他処理で既に参加済みなら二重参加を防ぐ
	if (raid.attackers.some(x => x.dmg > 0 && x.user.id === msg.userId)) {
		msg.reply('すでに参加済みの様です！').then(reply => {
			raid.replyKey.push(raid.postId + ":" + reply.id);
			module_.subscribeReply(raid.postId + ":" + reply.id, reply.id);
			raids.update(raid);
		}).catch((err) => {
			module_.log(`レイド参加済みメッセージ送信エラー: ${err instanceof Error ? err.stack ?? err.message : err}`);
		});
		return {
			reaction: 'confused'
		};
	}

	if (!result) return {
		reaction: 'confused'
	};
	// NOTE: 平行次元のお札により並列シミュレーションが行われていた場合、
	// ハーネス側で winner.result.parallelOtherScores に他次元のスコアが添付される（降順、失敗次元は除外）。
	// サーバログ末尾に (100, 200, 300) の形で表示する。
	const otherScores = (result as { parallelOtherScores?: number[] }).parallelOtherScores;
	const parallelSuffix = otherScores && otherScores.length > 0 ? ` (${otherScores.join(", ")})` : "";
	module_.log(`damage ${result.totalDmg} by ${msg.user.id}${parallelSuffix}`);

	raid.attackers.push({
		user: {
			id: msg.user.id,
			username: msg.user.username,
			host: msg.user.host,
		},
		dmg: result.totalDmg ?? 0,
		me: result.me ?? "",
		lv: result.lv ?? 1,
		count: result.count ?? 1,
		skillsStr: result.skillsStr ?? { skills: undefined, amulet: undefined },
		mark: result.mark ?? ":blank:",
		replyId: result.reply?.id ?? undefined,
	});

	raids.update(raid);

	const playerData = msg.friend.getPerModulesData(module_);
	playerData.lastRaidParticipatedPostId = raid.postId;
	msg.friend.setPerModulesData(module_, playerData);

	return {
		reaction: result.me
	};
}

// -------- 副作用なしのレイド試算 --------

/** 試算するプレイヤーの情報 */
export type RaidSimulationPlayer = {
	userId: string;
	username?: string;
	host?: string | null;
	/** RPG のプレイヤーデータ（試算では複製して使い、元のデータは書き換えない） */
	data: any;
	/** 好感度（行動回数に影響する） */
	love?: number;
	/** 数取りの記録（数取りの達人に影響する） */
	kazutoriData?: any;
	/** フレンドの doc（投稿数の取得で、登録時の投稿数や連携アカウントを参照する。読み取りのみ） */
	doc?: any;
};

/** {@link getTotalDmg} に渡す試算用のオプション */
export type RaidDamageOptions = {
	/** 投稿数を固定する（省略時は実際の投稿数を取得する） */
	postCount?: number;
	/** 投稿数の取得で、連携アカウントのデータや使用済みの印を書き換えない */
	readonly?: boolean;
	/** 乱数（省略時は Math.random() を使う。シードつきの乱数を渡すと戦闘を再現できる） */
	rng?: RaidRandom;
};

/** {@link simulateRaidBattle} のオプション */
export type RaidSimulationOptions = {
	/** 試行回数（既定 1） */
	runs?: number;
	/** 投稿数を固定する（省略時は実際の投稿数を取得する。テストでは固定すると外部に問い合わせない） */
	postCount?: number;
	/**
	 * 乱数を差し替える（テストで結果を固定する用）
	 *
	 * WARNING: 試行中は Math.random を差し替えるため、本番で他の処理と並行して使わないこと
	 */
	random?: () => number;
	/**
	 * 乱数のシードにするレイドの投稿ID
	 *
	 * @remarks
	 * 指定すると、実際のレイドと同じシード（投稿ID + ユーザーID + 平行次元の番号）で乱数を引く。
	 * 試行 i 回目は平行次元 i 番目（0 = 正史）と同じ乱数になる。指定した場合 random は使われない。
	 */
	seedPostId?: string;
	/** 試算に使うデータを書き換える（構成を変えて試す用。元のデータは書き換わらない） */
	modifyData?: (data: any) => void;
	/** 詳細ログ（参加返信に `-v` を付けたとき）を出す */
	verbose?: boolean;
};

/** 試行1回分の結果 */
export type RaidSimulationRun = {
	totalDmg: number;
	count: number;
	me: string;
	lv: number;
	mark: string;
	skillsStr: { skills?: string; amulet?: string };
	/** 本来なら返信される戦闘ログ */
	log: string;
};

/**
 * フレンドから試算用のプレイヤー情報を作る
 *
 * @param friend 対象のフレンド
 * @param user ユーザー名などの上書き（レイドの参加記録にある情報を使う場合）
 * @returns 試算用のプレイヤー情報
 * @internal
 */
export function playerFromFriend(friend: any, user?: { id?: string; username?: string; host?: string | null }): RaidSimulationPlayer {
	return {
		userId: user?.id ?? friend.userId,
		username: user?.username ?? friend.doc?.user?.username,
		host: user?.host ?? friend.doc?.user?.host ?? null,
		data: friend.getPerModulesData(module_),
		love: friend.love,
		kazutoriData: friend.doc?.kazutoriData,
		doc: friend.doc,
	};
}

/**
 * 試行結果のうち、ダメージが一番大きいものを返す
 *
 * @param runs 試行結果
 * @returns 最良の結果（なければ undefined）
 * @internal
 */
export function bestRaidRun(runs: RaidSimulationRun[]): RaidSimulationRun | undefined {
	return runs.reduce<RaidSimulationRun | undefined>((best, r) => (!best || r.totalDmg > best.totalDmg ? r : best), undefined);
}

/**
 * 副作用なしでレイドを試算する
 *
 * @remarks
 * 実際のレイドと同じ計算（getTotalDmg / getTotalDmg2 / getTotalDmg3）を、複製したデータで動かす。
 * プレイヤーデータ・数取りの記録・連携アカウントのデータは書き換えず、返信もしない（戦闘ログとして返す）。
 * 経験値・Lvアップ・お守りの耐久なども、試算では反映されない。
 *
 * @param player 試算するプレイヤー
 * @param enemyOrName ボス（定義そのもの、または名前）
 * @param options 試行回数・投稿数の固定・乱数の差し替え・データの書き換え
 * @returns 試行ごとの結果（失敗した試行は含まない）
 * @internal
 */
export async function simulateRaidBattle(player: RaidSimulationPlayer, enemyOrName: RaidEnemy | string, options: RaidSimulationOptions = {}): Promise<RaidSimulationRun[]> {
	const enemy = typeof enemyOrName === "string" ? raidEnemys.find((x) => x.name === enemyOrName) : enemyOrName;
	if (!enemy) return [];

	const runs: RaidSimulationRun[] = [];
	for (let i = 0; i < Math.max(1, options.runs ?? 1); i++) {
		const sandboxData = deepClone(player.data);
		options.modifyData?.(sandboxData);
		const sandboxDoc = { ...(player.doc ?? {}), kazutoriData: deepClone(player.kazutoriData ?? player.doc?.kazutoriData ?? {}), save: () => { /* no-op */ } };
		const replies: string[] = [];
		const sandboxMsg: any = {
			userId: player.userId,
			user: { id: player.userId, username: player.username ?? "", host: player.host ?? null },
			extractedText: "",
			text: "",
			includes: (words: string[]) => !!options.verbose && words.includes("-v"),
			reply: async (text: string) => {
				replies.push(text);
				return { id: undefined };
			},
			friend: {
				doc: sandboxDoc,
				love: player.love ?? 0,
				userId: player.userId,
				getPerModulesData: () => sandboxData,
				setPerModulesData: () => { /* no-op */ },
				save: () => { /* no-op */ },
			},
		};
		const enemyForRun = deepClone(enemy) as RaidEnemy;
		const rng = options.seedPostId ? createRaidRandom({ postId: options.seedPostId, userId: player.userId, dimension: i }) : undefined;
		const originalRandom = Math.random;
		if (options.random) Math.random = options.random;
		try {
			let r: any;
			if (enemyForRun.pattern && enemyForRun.pattern > 1) {
				r = enemyForRun.pattern === 3 ? await getTotalDmg3(sandboxMsg, enemyForRun, { rng }) : await getTotalDmg2(sandboxMsg, enemyForRun, { rng });
			} else {
				// raidPostId は渡さない（投稿数の二重使用防止に引っかかって 0 扱いになるのを避ける）
				r = await getTotalDmg(sandboxMsg, enemyForRun, undefined, { postCount: options.postCount, readonly: true, rng });
			}
			if (r && typeof r.totalDmg === "number" && !Number.isNaN(r.totalDmg)) {
				runs.push({ totalDmg: r.totalDmg, count: r.count, me: r.me, lv: r.lv, mark: r.mark, skillsStr: r.skillsStr ?? {}, log: replies.join("\n") });
			}
		} catch (err) {
			module_?.log?.(`レイドの試算中にエラーが発生しました: ${err instanceof Error ? err.stack ?? err.message : err}`);
		} finally {
			Math.random = originalRandom;
		}
	}
	return runs;
}

/**
 * 登録済みのユーザーで、副作用なしにレイドを試算する
 *
 * @param userId 対象ユーザーのID
 * @param enemyName ボスの名前
 * @param options 試行回数などのオプション（{@link RaidSimulationOptions}）
 * @returns 試行ごとの結果、またはユーザー・ボスが見つからない理由
 * @internal
 */
export async function simulateRaidDamage(userId: string, enemyName: string, options: RaidSimulationOptions = {}): Promise<{ ok: true; runs: RaidSimulationRun[] } | { ok: false; reason: string }> {
	const friend = ai.lookupFriend(userId);
	if (!friend) return { ok: false, reason: "ユーザーが見つかりません" };
	if (!friend.getPerModulesData(module_)?.lv) return { ok: false, reason: "RPGのデータがありません" };
	if (!raidEnemys.some((x) => x.name === enemyName)) return { ok: false, reason: "ボスの定義が見つかりません" };
	return { ok: true, runs: await simulateRaidBattle(playerFromFriend(friend), enemyName, options) };
}

// -------- 再計算（計算式の不具合修正後の救済） --------

/** {@link recalculateRaidResult} の結果 */
export type RaidRecalcResult =
	| { ok: false; reason: string }
	| {
		ok: true;
		/** 再計算前のダメージ */
		oldDmg: number;
		/** 再計算後のダメージ */
		newDmg: number;
		/** 対象レイドが終了済みか */
		isEnded: boolean;
		/** 自己ベスト（ボス別）の変化 */
		personalBest: { before: number | undefined; after: number };
		/** 終了済みレイドの場合、ボスごとの全体記録の変化 */
		globalRecord?: { before: number | undefined; after: number };
	};

/**
 * レイドの日付を raidScoreDate と同じ形式（YYYY/M/D）で返す
 *
 * @param raid 対象のレイド
 * @returns 日付文字列
 * @internal
 */
function formatRaidDate(raid: Raid) {
	const d = new Date(raid.startedAt);
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 終了処理（finish）と同じ規則でレイドの合計ダメージを求める
 *
 * ダメージが負のものを除き、同一ユーザーの重複参加は最初の1件だけを数える。
 *
 * @param raid 対象のレイド
 * @returns 合計ダメージ
 * @internal
 */
function raidTotalDmg(raid: Raid) {
	const seen = new Set<string>();
	return (raid.attackers ?? []).reduce((sum, x) => {
		if (x.dmg < 0 || seen.has(x.user.id)) return sum;
		seen.add(x.user.id);
		return sum + x.dmg;
	}, 0);
}

/**
 * 再計算コマンドの本文から、レイド投稿IDとユーザーIDを取り出す
 *
 * コマンド名（raidRecalc）自体も10文字の英数字なので、先に取り除いてから ID を拾う。
 *
 * @param text コマンドの本文（例: "RPG admin raidRecalc <レイド投稿ID> <ユーザーID> ..."）
 * @returns 最初の ID をレイド投稿ID、残りをユーザーIDとして返す
 * @internal
 */
export function parseRaidRecalcArgs(text: string): { raidPostId: string | undefined; userIds: string[] } {
	const ids = text.replace(/raidRecalc/gi, " ").match(/\w{10,}/g) ?? [];
	const [raidPostId, ...userIds] = ids;
	return { raidPostId, userIds };
}

/**
 * 指定ユーザーのレイド結果を、現在の計算式と現在のプレイヤーデータで再計算して差し替える
 *
 * 計算式の不具合を修正した後に、影響を受けたユーザーの結果だけをやり直すための管理者向け機能。
 *
 * @remarks
 * - プレイヤーデータは複製して使い、計算後は破棄する（経験値・Lvアップ・お守りの耐久などは反映しない）
 * - 乱数は再現しないので、結果は元と同じにはならない
 * - 投稿数は「同じレイドで二重に使わない」制御を通さず、再計算時点の投稿数で計算する
 * - 平行次元のお札を持っている場合は、参加時と同じく所持数+1回試算して最良の結果を採用する
 * - 差し替えるのはレイド記録の結果（ダメージ・ターン数・見た目・Lv・スキル表示）と自己ベスト。
 *   終了済みのレイドでは、ボスごとの全体記録も直す。配布済みのコイン・王冠・結果投稿はそのまま
 * - 本人への通知は行わない
 *
 * @param raidPostId 対象レイドの投稿ID
 * @param userId 対象ユーザーのID
 * @returns 再計算の結果
 * @internal
 */
export async function recalculateRaidResult(raidPostId: string, userId: string): Promise<RaidRecalcResult> {
	const raid = raids.findOne({ postId: raidPostId });
	if (!raid) return { ok: false, reason: "レイドが見つかりません" };

	// 終了処理と同じく、同一ユーザーの最初の参加記録を対象にする
	const attacker = (raid.attackers ?? []).find((x) => x.user.id === userId);
	if (!attacker) return { ok: false, reason: "このレイドに参加していません" };

	const friend = ai.lookupFriend(userId);
	if (!friend) return { ok: false, reason: "ユーザーが見つかりません" };

	// 計算式やボス定義の修正を反映するため、現在のボス定義を使う
	const enemy = raidEnemys.find((x) => x.name === raid.enemy.name);
	if (!enemy) return { ok: false, reason: "ボスの定義が見つかりません" };

	const liveData = friend.getPerModulesData(module_);
	if (!liveData?.lv) return { ok: false, reason: "RPGのデータがありません" };

	// 平行次元のお札を持っている場合は、参加時と同じく所持数+1回試算して最良の結果を採用する
	// 参加時と同じシードを使うので、計算式が変わっていなければ同じ展開になる
	const parallelCount = Math.min(10, Math.max(0, liveData.parallelDimension ?? 0));
	const runs = await simulateRaidBattle(playerFromFriend(friend, attacker.user), enemy, { runs: parallelCount + 1, seedPostId: raid.postId });
	const best = bestRaidRun(runs);
	if (!best) return { ok: false, reason: "再計算に失敗しました" };

	const oldDmg = attacker.dmg;
	const newDmg = best.totalDmg;
	const oldTotal = raidTotalDmg(raid);

	attacker.dmg = newDmg;
	attacker.count = best.count ?? attacker.count;
	attacker.me = best.me ?? attacker.me;
	attacker.lv = best.lv ?? attacker.lv;
	attacker.skillsStr = best.skillsStr ?? attacker.skillsStr;
	// 終了済みなら王冠などの確定済みマークを残す。開催中なら新しい結果のマークにする
	if (!raid.isEnded) attacker.mark = best.mark ?? attacker.mark;
	attacker.recalculatedAt = Date.now();
	if (attacker.originalDmg === undefined) attacker.originalDmg = oldDmg;
	raids.update(raid);

	// 自己ベスト: この回が自己ベストだった場合は、他のレイドの記録と新しい結果から付け直す
	const enemyName = raid.enemy.name;
	const otherBest = raids.find({}).reduce((max, r) => {
		if (r.postId === raid.postId || r.enemy?.name !== enemyName) return max;
		const a = (r.attackers ?? []).find((x) => x.user.id === userId);
		return a && a.dmg > max ? a.dmg : max;
	}, 0);
	if (!liveData.raidScore) liveData.raidScore = {};
	const pbBefore = liveData.raidScore[enemyName];
	liveData.raidScore[enemyName] = pbBefore === oldDmg ? Math.max(newDmg, otherBest) : Math.max(pbBefore ?? 0, newDmg);
	friend.setPerModulesData(module_, liveData);

	// 終了済みのレイド: ボスごとの全体記録（合計ダメージ）を直す
	let globalRecord: { before: number | undefined; after: number } | undefined;
	const rpgData = ai.moduleData.findOne({ type: 'rpg' });
	if (raid.isEnded && rpgData) {
		if (!rpgData.raidScore) rpgData.raidScore = {};
		if (!rpgData.raidScoreDate) rpgData.raidScoreDate = {};
		const newTotal = raidTotalDmg(raid);
		const before = rpgData.raidScore[enemyName];
		if (before === oldTotal) {
			// この回が全体記録だった場合は、他の終了済みレイドと比べて付け直す
			let recTotal = newTotal;
			let recDate = formatRaidDate(raid);
			for (const r of raids.find({ isEnded: true })) {
				if (r.postId === raid.postId || r.enemy?.name !== enemyName) continue;
				const t = raidTotalDmg(r);
				if (t > recTotal) {
					recTotal = t;
					recDate = formatRaidDate(r);
				}
			}
			rpgData.raidScore[enemyName] = recTotal;
			rpgData.raidScoreDate[enemyName] = recDate;
		} else if (before === undefined || newTotal > before) {
			rpgData.raidScore[enemyName] = newTotal;
			rpgData.raidScoreDate[enemyName] = formatRaidDate(raid);
		}
		ai.moduleData.update(rpgData);
		globalRecord = { before, after: rpgData.raidScore[enemyName] };
	}

	module_.log(`raid recalculated ${raid.postId} ${userId}: ${oldDmg} -> ${newDmg}`);
	return { ok: true, oldDmg, newDmg, isEnded: raid.isEnded, personalBest: { before: pbBefore, after: liveData.raidScore[enemyName] }, globalRecord };
}

// -------- タイムアウト処理 --------

/**
 * レイド投稿のタイムアウト時に呼ばれるコールバック
 *
 * レイド投稿への再ノートを行う。
 *
 * @param data タイムアウトデータ（postId 等を含む）
 * @internal
 */
export function raidTimeoutCallback(data: { id: string }) {
	/** 現在進行中のレイド */
	const raid = raids.findOne({
		isEnded: false,
		postId: data.id
	});
	if (raid === null || raid === undefined) return;

	try {
		ai.post({
			renoteId: data.id
		});
	} catch (err) {
		module_.log(`レイドタイムアウト処理中にエラーが発生しました: ${err instanceof Error ? err.stack ?? err.message : err}`);
		return;
	}
}

// -------- ダメージ計算（パターン1: 通常レイド戦闘） --------

/**
 * レイド（通常型）1 回分の戦闘の状態
 *
 * @remarks
 * getTotalDmg を段階ごとの関数に分けたときに、複数の段階で読み書きする値をまとめたもの。
 * 1 つの段階でしか使わない値は、その段階の関数の中に置いている。
 *
 * @internal
 */
type RaidBattle = {
	rand: RaidRandom;
	data: any;
	verboseLog: boolean;
	colorData: boolean[];
	skillEffects: SkillEffect;
	skillsStr: { skills?: string | undefined; amulet?: string | undefined; };
	stockRandomResult: { activate: boolean; activateStr: string; skillEffects: any; };
	count: number;
	color: Color;
	isSuper: boolean | undefined;
	tp: any;
	cw: string;
	log: BattleLog;
	me: string;
	lv: any;
	startCharge: any;
	maxLv: any;
	atk: number;
	def: number;
	spd: number;
	enemyAtk: number;
	enemyDef: number;
	checkMagic: (phase: string, argTriggerData?: Record<string, unknown>) => void;
	enemyMaxHp: number;
	enemyHp: number;
	abort: number;
	playerMaxHp: number;
	playerHp: number;
	item: any;
	item2: any;
	itemBonus: { atk: number; def: number; };
	enemyAtkX: number;
	itemBoost: number;
	itemMinEffect: number;
	atkDmgBonus: number;
	sevenFeverBarrier: number;
	fireStack: number;
	additionalStatuses: RaidAdditionalStatus[];
	recoverHpOrBarrier: (healValue: number) => { healed: number; barrier: number; };
	itemAtkStock: number;
	itemAtkStockNext: number;
	isBattle: boolean;
	isPhysical: boolean;
	isTired: boolean;
	totalDmg: number;
	mark: string;
	warriorFlg: boolean;
	warriorTotalDmg: number;
	warriorCritX: number;
	sevenFever: number;
	_atk: number;
	_def: number;
	_spd: number;
	_enemyAtk: number;
	_enemyDef: number;
	enemyTurnFinished: boolean;
	plusActionX: number;
	totalResistDmg: number;
	transcendenceActivated: boolean;
	canAccessBackShop: boolean;
	msg: any;
	enemy: RaidEnemy;
	raidPostId: string | undefined;
	options: RaidDamageOptions;
};

/** 詳細ログ用に数値を短く整える（0.05 未満は小数第 2 位、1000 未満は小数第 1 位、1 万以上は k / m 表記） */
const formatNumber = (num: number): string => {
	if (num > 0 && num < 0.05) {
		const rounded = Math.round(num * 100) / 100;
		return rounded.toString();
	} else if (num < 1000) {
		const rounded = Math.round(num * 10) / 10;
		return rounded.toString();
	} else if (num < 10000) {
		const rounded = Math.round(num);
		return rounded.toString();
	}  if (num < 10_000_000) {
		const result = num / 1000;
		return result < 100 ? (Math.round(result * 100) / 100).toString() + 'k' : result < 1000 ? (Math.round(result * 10) / 10).toString() + 'k' : Math.round(result).toString() + 'k';
	} else {
		const result = num / 1_000_000;
		return result < 100 ? (Math.round(result * 100) / 100).toString() + 'm' : result < 1000 ? (Math.round(result * 10) / 10).toString() + 'm' : Math.round(result).toString() + 'm';
	}
};

/** 詳細ログ用に倍率を増減のパーセントで表す（例: 1.09 → "+9%"、ほぼ 1 なら "0%"） */
const displayDifference = (num: number): string => {
	// 0.999より大きく1.001より小さい場合は0%
	if (num > 0.999 && num < 1.001) {
		return "0%";
	}

	// 1との差をパーセント表示 (四捨五入して小数点第1位まで)
	const diff = (num - 1) * 100;
	const roundedDiff = Math.round(diff * 10) / 10; // 小数第1位までの四捨五入

	// 正の場合は先頭に+記号を付ける
	const sign = roundedDiff > 0 ? '+' : '';
	return `${sign}${Math.round(roundedDiff * 10) / 10}%`;
};

/**
 * レイド（通常型）の段階1: データの読み込み・お守りの付与・覚醒の判定・投稿数とステータス倍率・開始メッセージ
 *
 * @returns 遊べない場合の返り値（遊べる場合は undefined）
 *
 * @internal
 */
async function prepareRaidBattle(b: RaidBattle) {
	/** 乱数（シードが指定されていれば、同じレイド・同じユーザーで同じ値になる） */
	b.rand = b.options.rng ?? createRaidRandom();
	// データを読み込み
	b.data = initializeData(module_, b.msg);
	if (!b.data.lv) return {
		reaction: 'confused'
	};
	b.data.raid = true;
	b.verboseLog = false;
	if (b.msg.includes(['-v'])) b.verboseLog = true;
	b.colorData = colors.map((x) => x.unlock(b.data));
	// 所持しているスキル効果を読み込み
	b.skillEffects = aggregateSkillsEffects(b.data, b.enemy.skillX ?? 1);

	b.skillsStr = getSkillsShortName(b.data);

	let amuletGetFlg = false;

	let wakabaFlg = false;

	// Lv20以上でお守り未所持かつ確率（10% + noAmuletCount*5%、最低-18から始まる）でお守り付与
	if (b.data.lv >= 20) {
		if (b.data.noAmuletCount === null || b.data.noAmuletCount === undefined) b.data.noAmuletCount = 0;
		if (!b.skillEffects.noAmuletAtkUp && !b.skillsStr.amulet && b.rand("noAmulet") < 0.1 + ((b.data.noAmuletCount + 18) * 0.05)) {
			amuletGetFlg = true;
			b.data.noAmuletCount = -18;
			// スキル2個未満 or（3個未満かつ50%）ならわかばのお守り、それ以外は謎のお守り
			if (b.data.skills?.length < 2 || (b.data.skills?.length < 3 && b.rand("noAmulet.skill") < 0.5)) {
				wakabaFlg = true;
				b.data.items.push({ name: `わかばのお守り`, price: 1, desc: `もこチキの持っているスキルが5個より少ない場合（もこチキのレベルが低い場合）、少ないスキル1つにつき約6%分パワー・防御が上がります 特定条件でさらにパワー・防御が+12%されます 耐久20`, type: "amulet", effect: { beginner: 0.06 }, durability: 20, short: "🔰" });
			} else {
				b.data.items.push({ name: `謎のお守り`, price: 1, desc: `貰ったお守り。よくわからないが不思議な力を感じる…… 持っていると何かいい事があるかもしれない。`, type: "amulet", effect: { stockRandomEffect: 1 }, durability: 1, short: "？" });
			}
			// スキル効果を再度読み込み
			b.skillEffects = aggregateSkillsEffects(b.data, b.enemy.skillX ?? 1);
		} else if (!b.skillEffects.noAmuletAtkUp && !b.skillsStr.amulet) {
			b.data.noAmuletCount = (b.data.noAmuletCount ?? 0) + 1;
		}
	}

	b.stockRandomResult = stockRandom(b.data, b.skillEffects, () => b.rand("stockRandom"));

	b.skillEffects = b.stockRandomResult.skillEffects;
	ensureKazutoriMasterHistory(ai, b.msg, b.skillEffects);
	applyKazutoriMasterHiddenBonus(b.msg, b.skillEffects);

	/** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
	b.count = 1;

	/** 使用中の色情報 */
	b.color = getColor(b.data);

	/** 覚醒状態か？*/
	b.isSuper = b.rand("super") < (0.02 + Math.max(b.data.superPoint / 200, 0)) || b.color.alwaysSuper;

	/** 投稿数（今日と明日の多い方）*/
	let postCount = 0;
	let continuousBonusNum = 0;
	let rawTp;
	let continuousBonusX;

	if (b.isSuper) applyHyperModeEffects(b.skillEffects, aggregateTokensEffects(b.data));
	const superBonusPost = (b.isSuper && !aggregateTokensEffects(b.data).hyperMode ? 200 : 0)
	// 敵が forcePostCount を持っている場合、投稿数は固定
	if (b.enemy.forcePostCount) {
		postCount = b.enemy.forcePostCount;
		rawTp = getPostX(postCount);
		// 固定投稿数には覚醒ボーナスが加算されていないため、superBonusPost は差し引かない
		b.tp = rawTp * (1 + ((b.skillEffects.postXUp ?? 0) * Math.min(postCount / 20, 10)));
	} else {
		postCount = b.options.postCount ?? await getPostCount(ai, module_, b.data, b.msg, 0, b.raidPostId ? { type: 'raid', key: b.raidPostId } : undefined, b.options.readonly);
		postCount = applyKazutoriMasterPostCountFloor(postCount, b.msg, b.skillEffects);
		postCount += superBonusPost;

		// 連続ボーナス：postCount/2 を 10〜25 にクランプ
		continuousBonusNum = (Math.min(Math.max(10, postCount / 2), 25));

		continuousBonusX = getRaidPostX(postCount + continuousBonusNum) / getRaidPostX(postCount);

		postCount = postCount + continuousBonusNum;

		rawTp = getRaidPostX(postCount);

		b.tp = rawTp * (1 + ((b.skillEffects.postXUp ?? 0) * Math.min((postCount - superBonusPost) / 20, 10)));
	}

	if (!b.isSuper) {
		b.data.superPoint = Math.max((b.data.superPoint ?? 0) - (b.tp - 2), -3);
	} else {
		b.data.superPoint = 0;
	}


	/** 画面に出力するメッセージ:CW */
	b.cw = acct(b.msg.user) + " ";
	/** 画面に出力するメッセージ:Text */
	b.log = new BattleLog(b.verboseLog);

	/** プレイヤーの見た目 */
	b.me = b.color.name;

	// ステータスを計算
	/** プレイヤーのLv */
	b.lv = b.data.lv ?? 1;
	/** 開始時のチャージ */
	b.startCharge = b.data.charge;

	// 敵情報
	// 敵が消された？？
	if (!b.enemy) b.enemy = endressEnemy(b.data);
	// 敵の開始メッセージなどを設定
	b.cw += [
		b.me,
		b.data.lv >= 255 ? "" : `Lv${b.data.lv}`,
		Math.max(b.data.atk, b.data.def) / (b.data.atk + b.data.def) * 100 <= 53 ? "" : `${b.data.atk > b.data.def ? serifs.rpg.status.atk.slice(0, 1) : serifs.rpg.status.def.slice(0, 1)}${(Math.max(b.data.atk, b.data.def) / (b.data.atk + b.data.def) * 100).toFixed(0)}%`,
		b.skillsStr.skills,
		b.skillsStr.amulet ? `お守り ${b.skillsStr.amulet}` : undefined
	].filter(Boolean).join(" ");
	b.log.add(`$[x2 ${b.me}]\n\n${serifs.rpg.start}\n\n`);
	const kazutoriMasterMessage = getKazutoriMasterMessage(b.msg, b.skillEffects);
	if (kazutoriMasterMessage) {
		b.log.add(`${kazutoriMasterMessage}\n\n`);
	}

	b.maxLv = ai.moduleData.findOne({ type: 'rpg' })?.maxLv ?? 1;

	if (amuletGetFlg) {
		b.log.add(serifs.rpg.giveAmulet + `\n\n`);
		b.skillsStr.amulet = wakabaFlg ? '[🔰]' : `[？]`;
	}

	if (b.enemy.skillX && b.lv >= 20) {
		b.log.add(serifs.rpg.skillX(b.enemy.skillX) + `\n\n`);
	}

	if (b.stockRandomResult.activate) {
		b.log.add(serifs.rpg.skill.stockRandom + `\n\n`);
		b.skillsStr.amulet = `[${b.stockRandomResult.activateStr}]`;
	}

	if (b.enemy.forcePostCount) {
		b.log.buff(serifs.rpg.forcePostCount + `\n`);
		if (aggregateTokensEffects(b.data).showPostBonus) {
			b.log.buff(serifs.rpg.postBonusInfo.post(postCount, b.tp > 1 ? "+" + Math.floor((b.tp - 1) * 100) : Math.floor((b.tp - 1) * 100)) + `\n`);
			if (b.verboseLog && continuousBonusX >= 1.01) b.log.add("連スキル効果: AD+" + Math.ceil(continuousBonusX * 100 - 100) + '%\n');
			if (b.verboseLog && b.tp - rawTp >= 0.01) b.log.add("投スキル効果: AD+" + Math.ceil(b.tp / rawTp * 100 - 100) + '%\n');
		}
	} else {
		if (aggregateTokensEffects(b.data).showPostBonus) {
			b.log.markBuff();
			if (continuousBonusNum) b.log.add(serifs.rpg.postBonusInfo.continuous.a(Math.floor(continuousBonusNum)) + `\n`);
			if (b.isSuper && !aggregateTokensEffects(b.data).hyperMode) {
				b.log.add(serifs.rpg.postBonusInfo.super + `\n`);
			}
			b.log.add(serifs.rpg.postBonusInfo.post(postCount, b.tp > 1 ? "+" + Math.floor((b.tp - 1) * 100) : (b.tp !== 1 ? "-" : "") + Math.floor((b.tp - 1) * 100)) + `\n`);
			if (b.verboseLog && continuousBonusX >= 1.01) b.log.add("連スキル効果: AD+" + Math.ceil(continuousBonusX * 100 - 100) + '%\n');
			if (b.verboseLog && b.tp - rawTp >= 0.01) b.log.add("投スキル効果: AD+" + Math.ceil(b.tp / rawTp * 100 - 100) + '%\n');
		}
	}
	return undefined;
}

/**
 * レイド（通常型）の戦闘前の補正で、複数のまとまりをまたぐ値
 *
 * @remarks
 * applyPreBattleModifiers を、まとまりごとの関数に分けたときに使う。戦闘全体で使う値は RaidBattle にある。
 *
 * @internal
 */
type RaidPreBattle = {
	raidVitalityState: RaidVitalityState;
	playerHpPercent: number;
	addBarrier: (value: number) => number;
};

/**
 * レイド（通常型）の戦闘前 1: ステータスと敵ステータスの計算・運命・調子補正
 *
 * @internal
 */
function computeRaidStatus(b: RaidBattle, pre: RaidPreBattle) {

	// ここで残りのステータスを計算しなおす
	({ atk: b.atk, def: b.def, spd: b.spd } = calculateStats(b.data, b.msg, b.skillEffects, b.color, 0.2));

	b.log.verbose(() => `ステータス: \nA: ${formatNumber(b.atk)} (x${formatNumber(b.atk / (b.lv * 3.5))})\nD: ${formatNumber(b.def)} (x${formatNumber(b.def / (b.lv * 3.5))})\nS: ${formatNumber(b.spd)} (${getSpdX(b.spd) * 100}%)\n`);

	// 敵のステータスを計算
	/** 敵の攻撃力 */
	b.enemyAtk = (typeof b.enemy.atk === "function") ? b.enemy.atk(b.atk, b.def, b.spd) : b.lv * 3.5 * (b.enemy.atk ?? 1);
	/** 敵の防御力 */
	b.enemyDef = (typeof b.enemy.def === "function") ? b.enemy.def(b.atk, b.def, b.spd) : b.lv * 3.5 * (b.enemy.def ?? 1);

	b.log.verbose(() => `敵ステータス: \nA: x${formatNumber(b.enemyAtk / (b.lv * 3.5))} D: x${formatNumber(b.enemyDef / (b.lv * 3.5))} \n`);

	if (b.skillEffects.fortuneEffect || aggregateTokensEffects(b.data).fortuneEffect) {
		const result = fortune(b.atk, b.def, b.skillEffects.fortuneEffect, () => b.rand("fortune"));
		b.atk = result.atk;
		b.def = result.def;
		if (b.skillEffects.fortuneEffect) {
			b.log.add(serifs.rpg.skill.fortune + `\n`);
		} else {
			b.log.add(serifs.rpg.skill.fortuneToken + `\n`);
		}
		b.log.add(result.message + `\n`);
	}
	// 調子補正（天国か地獄か）：土日/在庫ランダム/数取り得意曜日固定なら 1.0、それ以外は曜日+週でシードした乱数（0〜1.0）+ 1%で+0.3×2
	const day = new Date().getDay();
	const kazutoriMasterBonus = getKazutoriMasterBonus(b.msg, b.skillEffects);
	const baseBonusX = (day === 6 || day === 0 || b.stockRandomResult.activate || kazutoriMasterBonus.raidBonusFixed ? 1 : (Math.floor(seedrandom("" + b.msg.user.id + Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) + ai.account.id)() * 5 + day) % 5) * 0.25);
	pre.raidVitalityState = createRaidVitalityState(b.data);
	let bonusX = applyRaidVitalityMood(pre.raidVitalityState, baseBonusX);
	if (pre.raidVitalityState.moodUsed > 0) {
		b.data.raidVitality = Math.max(0, (b.data.raidVitality ?? 0) - pre.raidVitalityState.moodUsed);
	}
	bonusX += (b.rand("mood.jackpot") < 0.01 ? 0.3 : 0) + (b.rand("mood.jackpot") < 0.01 ? 0.3 : 0);
	// 1%でさらに +0.3 を加算（複数回当たる可能性あり）
	while (b.rand("mood.jackpot") < 0.01) {
		bonusX += 0.3;
	}
	b.atk = Math.round(b.atk * (0.75 + bonusX));
	b.def = Math.round(b.def * (0.75 + bonusX));
	if (b.verboseLog) {
		b.log.markBuff();
		const vitalityNote = (pre.raidVitalityState.moodUsed > 0) ? ` (レイド活力-${pre.raidVitalityState.moodUsed})` : '';
		b.log.add(`調子補正: AD${displayDifference((0.75 + bonusX))} (${formatNumber(b.atk)} / ${formatNumber(b.def)})${vitalityNote}\n`);
	}
}

/**
 * レイド（通常型）の戦闘前 2: 魔法の発動処理（b.checkMagic）を用意する
 *
 * @internal
 */
function setupRaidMagic(b: RaidBattle, pre: RaidPreBattle) {

	// 魔法処理の為の関数
	b.checkMagic = (phase: string, argTriggerData: Record<string, unknown> = {}) => {
		if (!b.data?.magic) return;

		const triggerData = {
			atk: b.atk,
			def: b.def,
			spd: b.spd,
			eAtk: b.enemyAtk,
			eDef: b.enemyDef,
			hp: b.playerHp,
			hpp: pre.playerHpPercent,
			debuff: b.enemy?.fire,
			predictedDmg: (argTriggerData?.predictedDmg) ?? 0,
		};

		const useMagics = b.data.magic.filter((m) => m.phase === phase && (m.trigger(triggerData) || b.rand("magic", phase) < 0.08));

		for (const magic of useMagics) {
			b.log.add(`「${magic.name}」の魔法を唱えた！\n`);
			if (b.verboseLog) {
				b.log.add(`　効果詳細:\n`);
			}

			for (const effect in magic.effect) {
				const val = magic.effect[effect];

				switch (effect) {
					case "trueDmg":
						if (b.verboseLog) {
							b.log.add(`　　貫通ダメージ: ${val}\n`);
						}
						b.log.add(b.enemy.atkmsg(val) + "\n");
						b.totalDmg += val;
						break;
					case "eAtkX":
						if (b.verboseLog) {
							b.log.add(`　　敵攻撃補正: ${val}\n`);
						}
						b.enemyAtk *= val;
						break;
					case "freeze":
						if (b.verboseLog) {
							b.log.add(`　　凍結率: ${val}\n`);
						}
						b.enemyTurnFinished = true;
						break;
					case "eDmgX":
						if (b.verboseLog) {
							b.log.add(`　　敵攻撃補正: ${val}\n`);
						}
						b.enemyAtkX *= val;
						break;
					case "dmg":
						const dmg = getAtkDmg(b.data, val, b.tp, 1, false, b.enemyDef, b.enemyMaxHp, 1, getVal(b.enemy.defx, [b.count]));
						b.log.add(b.enemy.atkmsg(dmg) + "\n");
						b.totalDmg += dmg;
						break;
					case "spd":
						if (b.verboseLog) {
							b.log.add(`　　速度増加: ${val}\n`);
						}
						b.spd += val;
						break;
					case "turnPlus":
						if (b.verboseLog) {
							b.log.add(`　　ターン増加: ${val}\n`);
						}
						b.plusActionX += val;
						break;
					case "fixedCrit":
						if (b.verboseLog) {
							b.log.add(`　　クリティカル増加: ${val}\n`);
						}
						b.skillEffects.critUpFixed = (b.skillEffects.critUpFixed ?? 0) + val;
						break;
					case "cleanse":
						if (b.verboseLog) {
							b.log.add(`　　デバフ解除\n`);
						}
						b.enemy.fire = 0;
						break;
					case "itemGet":
						if (b.verboseLog) {
							b.log.add(`　　アイテム確定\n`);
						}
						b.itemBoost = val;
						break;
					case "minEffect":
						if (b.verboseLog) {
							b.log.add(`　　最低効果量: ${val}\n`);
						}
						b.itemMinEffect = val;
						break;
					case "atkUp":
						if (b.verboseLog) {
							b.log.add(`　　パワーアップ: ${val}\n`);
						}
						b.atk *= (1 + val);
						break;
					case "defUp":
						if (b.verboseLog) {
							b.log.add(`　　防御アップ: ${val}\n`);
						}
						b.def *= (1 + val);
						break;
					case "heal":
						if (b.verboseLog) {
							b.log.add(`　　回復: ${val}\n`);
						}
						{
							const recovered = b.recoverHpOrBarrier(Math.min(Math.round(b.playerMaxHp * val), b.playerMaxHp - b.playerHp));
							if (recovered.barrier > 0) b.log.add(`${Math.floor(recovered.barrier)}ポイントのバリアを獲得！\n`);
						}
						break;
					case "barrier":
						if (b.verboseLog) {
							b.log.add(`　　バリア: ${val}\n`);
						}
						{
							const recovered = b.recoverHpOrBarrier(Math.round(b.playerMaxHp * val));
							if (recovered.barrier > 0) b.log.add(`${Math.floor(recovered.barrier)}ポイントのバリアを獲得！\n`);
						}
						break;
					default:
						console.warn(`Unknown effect: ${effect}`);
				}
			}
		}
	};
}

/**
 * レイド（通常型）の戦闘前 3: 体力・バリア・アイテムの初期値と、戦闘の種類（戦闘・物理・疲労）
 *
 * @internal
 */
function setupRaidHp(b: RaidBattle, pre: RaidPreBattle) {

	/** 敵の最大HP */
	b.enemyMaxHp = 100000;
	/** 敵のHP */
	b.enemyHp = 100000;
	/** 連続攻撃中断の場合の攻撃可能回数 0は最後まで攻撃 */
	b.abort = 0;
	/** プレイヤーの基礎体力 */
	let rawMaxHp = 100 + Math.min(b.lv * 3, 765) + Math.floor((b.data.defMedal ?? 0) * 13.4);
	/** プレイヤーのボーナス体力 */
	let bonusMaxHp = 100 + Math.min(b.maxLv * 3, 765);
	/** プレイヤーの最大HP */
	b.playerMaxHp = Math.max(Math.round(bonusMaxHp * b.rand("maxHp")), rawMaxHp);
	b.playerMaxHp = applyRaidVitalityHp(pre.raidVitalityState, b.playerMaxHp, rawMaxHp, bonusMaxHp);
	finalizeRaidVitalityHpConsumption(b.data, pre.raidVitalityState);
	/** プレイヤーのHP */
	b.playerHp = (b.playerMaxHp);
	/** プレイヤーのHP割合 */
	pre.playerHpPercent = b.playerHp / (b.playerMaxHp);
	/** 敵のHP割合 */
	let enemyHpPercent = 1;
	/** アイテムによって増加したステータス */
	b.itemBonus = { atk: 0, def: 0 };
	b.enemyAtkX = 1;
	b.itemBoost = 0;
	b.itemMinEffect = 0;
	b.atkDmgBonus = 1;
	b.sevenFeverBarrier = 0;
	b.fireStack = 0;
	b.additionalStatuses = [];
	pre.addBarrier = (value: number) => {
		if (value <= 0) return 0;
		b.sevenFeverBarrier += value;
		const barrierStatus = b.additionalStatuses.find((status) => status.icon === "🛡️");
		if (barrierStatus) {
			barrierStatus.value = b.sevenFeverBarrier;
		} else {
			b.additionalStatuses.push({ icon: "🛡️", value: b.sevenFeverBarrier });
		}
		return value;
	};
	b.recoverHpOrBarrier = (healValue: number) => {
		if (healValue <= 0) return { healed: 0, barrier: 0 };
		if (!b.skillEffects.transcendence) {
			b.playerHp += healValue;
			return { healed: healValue, barrier: 0 };
		}
		let remain = healValue;
		let healed = 0;
		if (b.playerHp < 1) {
			const toOne = Math.min(remain, 1 - b.playerHp);
			b.playerHp += toOne;
			healed += toOne;
			remain -= toOne;
		}
		const barrier = remain > 0 ? pre.addBarrier(remain) : 0;
		return { healed, barrier };
	};
	b.itemAtkStock = 0;
	b.itemAtkStockNext = 0;

	/** これって戦闘？ */
	b.isBattle = b.enemy.atkmsg(0).includes("ダメージ");

	/** これって物理戦闘？ */
	b.isPhysical = !b.enemy.atkmsg(0).includes("精神");

	/** ダメージ発生源は疲れ？ */
	b.isTired = b.enemy.defmsg(0).includes("疲");

	if (b.verboseLog && (b.isBattle || b.isPhysical || b.isTired)) {
		b.log.buff(`属性: ${[b.isBattle ? "戦闘" : "", b.isPhysical ? "物理" : "", b.isTired ? "疲れ" : ""].filter(Boolean).join(", ")}\n`);
	}
}

/**
 * レイド（通常型）の戦闘前 4: 憤怒・おおみそか・覚醒・戦士マークと、開始時の魔法
 *
 * @internal
 */
function applyRaidSuperAndWarrior(b: RaidBattle, pre: RaidPreBattle) {

	b.totalDmg = 0;

	if (b.skillEffects.wrath) {
		b.playerHp = Math.round(b.playerHp / 2);
		b.skillEffects.critDmgUp = (b.skillEffects.critDmgUp ?? 0) + 0.4;
	}

	if (aggregateTokensEffects(b.data).oomisoka && new Date().getMonth() === 11 && new Date().getDate() === 31) {
		b.log.add(serifs.rpg.oomisoka + "\n");
		b.log.markBuff();
		b.playerHp = 1;
		b.atk = b.atk * 1.119;
		b.skillEffects.atkDmgUp = ((1 + (b.skillEffects.atkDmgUp ?? 0)) * 1.118) - 1;
		b.log.verbose(() => `おおみそか: A+11.9% ADmg+11.8% (${formatNumber(b.atk)} / ${formatNumber(b.skillEffects.atkDmgUp! * 100)}%)\n`);
	}

	if (b.isSuper) {
		const up = Math.max(b.spd + 2, Math.round(getSpd(getSpdX(b.spd) * 1.2))) - b.spd;
		if (!b.color.alwaysSuper) {
			// バフが1つでも付与された場合、改行を追加する
			b.log.endBuffs();
			const superColor = colors.find((x) => x.alwaysSuper)?.name ?? colors.find((x) => x.default)?.name ?? colors[0]?.name;
			b.log.markBuff();
			b.me = superColor;
			if (!aggregateTokensEffects(b.data).notSuperSpeedUp) b.log.add(serifs.rpg.super(b.me, up) + `\n`);
		}
		let customStr = ""
		if (!aggregateTokensEffects(b.data).hyperMode) {
			customStr += "パワー・防御が**超**アップ！"
		} else {
			customStr += "投稿数による能力上昇量がアップ！"
		}
		if (!aggregateTokensEffects(b.data).notSuperSpeedUp) {
			b.spd = b.spd + up;
			b.log.verbose(() => `覚醒: S+${up} (${formatNumber(b.spd)} (${getSpdX(b.spd) * 100}%))\n`);
		}
		// 覚醒変更の札：スキル効果の補正は共通の関数で行い、ここではメッセージと行動回数を扱う
		const superColorMode = getSuperColorMode(aggregateTokensEffects(b.data));
		applySuperColorModeEffects(b.skillEffects, superColorMode);
		if (superColorMode === 'red') {
			if (!b.color.alwaysSuper) b.log.add(serifs.rpg.customSuper(b.me,`クリティカル性能アップ！\n${customStr}`) + `\n`);
			b.data.superCount = (b.data.superCount ?? 0) + 1;
			b.log.verbose(() => `朱覚醒: クリ率固定+8% クリダメ+35%\n(${formatNumber(b.skillEffects.critUpFixed! * 100)}% / ${formatNumber(b.skillEffects.atkDmgUp! * 100)}%)`);
		} else if (superColorMode === 'blue') {
			if (!b.color.alwaysSuper) b.log.add(serifs.rpg.customSuper(b.me,`ダメージカット+40%！\n${customStr}`) + `\n`);
			b.log.verbose(() => `蒼覚醒: 被ダメージ-40% (${formatNumber(b.skillEffects.defDmgUp! * 100)}%)\n`);
		} else if (superColorMode === 'yellow') {
			const up = Math.max(b.spd + 1, Math.round(getSpd(getSpdX(b.spd) * 1.1))) - b.spd;
			b.spd = b.spd + up;
			if (!b.color.alwaysSuper) b.log.add(serifs.rpg.customSuper(b.me,`行動回数+${up}！\nダメージカット+20%！\n${customStr}`) + `\n`);
			b.log.verbose(() => `橙覚醒: S+${up} 被ダメージ-20%\n(${formatNumber(b.spd)} (${getSpdX(b.spd) * 100}%) / ${formatNumber(b.skillEffects.defDmgUp! * 100)}%)\n`);
		} else if (superColorMode === 'green') {
			if (!b.color.alwaysSuper) b.log.add(serifs.rpg.customSuper(b.me,`全アイテム効果+40%！\n${customStr}`) + `\n`);
			b.log.verbose(() => `翠覚醒: アイテム効果+40%\n(${formatNumber(b.skillEffects.itemEquip! * 100)}% / ${formatNumber(b.skillEffects.itemBoost! * 100)}% / ${formatNumber(b.skillEffects.mindMinusAvoid! * 100)}% / ${formatNumber(b.skillEffects.poisonAvoid! * 100)}%)\n`);
		}
	}

	b.mark = ":blank:";
	b.warriorFlg = false;
	b.warriorTotalDmg = 0;
	b.warriorCritX = 2;

	// 戦士マーク：物理戦闘かつ非疲労かつ、確率（2% + レベル差×1%/10Lv）で付与
	if (!b.enemy.skillX && (b.isBattle && b.isPhysical && !b.isTired) && b.rand("warrior") < 0.02 + (Math.max(Math.floor((Math.min(b.maxLv, 170) - b.lv) / 10), 0) * 0.01)) {
		b.warriorFlg = true;
		b.log.endBuffs();
		b.log.resetBuffs();
		b.log.add(serifs.rpg.warrior.get + `\n\n`);
		b.mark = ":mk_warrior:";
	}

	b.checkMagic("Start");
}

/**
 * レイド（通常型）の戦闘前 5: 戦闘前に掛かるスキル効果（天国か地獄か・７フィーバー・風・遂・土・非戦闘時・強敵・断・貫・速・守・お守り）と、ターン開始時に戻すステータスの保存・超越
 *
 * @internal
 */
function applyRaidSkillModifiers(b: RaidBattle, pre: RaidPreBattle) {

	// 天国か地獄か：60%で天国（ADアップ）、40%で地獄（ADダウン）
	if (b.skillEffects.heavenOrHell) {
		if (b.rand("heavenOrHell") < 0.6) {
			b.log.add(serifs.rpg.skill.heaven + "\n");
			b.log.markBuff();
			b.atk = b.atk * (1 + b.skillEffects.heavenOrHell);
			b.def = b.def * (1 + (b.skillEffects.heavenOrHell * 1.5));
			b.log.verbose(() => `天スキル効果: A${displayDifference((1 + b.skillEffects.heavenOrHell!))} D${displayDifference((1 + (b.skillEffects.heavenOrHell! * 1.5)))} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
		} else {
			b.log.add(serifs.rpg.skill.hell + "\n");
			b.log.markBuff();
			b.atk = b.atk / (1 + b.skillEffects.heavenOrHell);
			b.def = b.def / (1 + (b.skillEffects.heavenOrHell * 0.75)) ;
			b.log.verbose(() => `地スキル効果: A${displayDifference(1 / (1 + b.skillEffects.heavenOrHell!))} D${displayDifference((1 + (b.skillEffects.heavenOrHell! * 0.75)))} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
		}
	}

	// ７フィーバー
	b.sevenFever = b.skillEffects.sevenFever ? calcSevenFever([b.data.lv, b.data.atk, b.data.def]) * b.skillEffects.sevenFever : 0;
	if (b.enemy.fire) {
		b.additionalStatuses.push({ icon: serifs.rpg.fire, value: b.fireStack });
	}
	if (b.sevenFever) {
		const defBonus = 7 * (b.skillEffects.sevenFever ?? 1);
		pre.addBarrier(normalizeSevenFeverBarrierGain(b.sevenFever));
		b.log.buff(serifs.rpg.skill.sevenFeverRaid(Math.floor(b.sevenFeverBarrier)) + "\n");
		b.def = Math.ceil(b.def * (1 + (defBonus / 100)) / 7) * 7;
		b.log.verbose(() => `７スキル効果: D${displayDifference((1 + (defBonus / 100)))} / バリア+${Math.floor(b.sevenFeverBarrier)} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
	}
	if (b.skillEffects.charge && b.verboseLog) {
		b.additionalStatuses.push({ icon: "🍀", value: b.data.charge });
	}
	if (b.skillEffects.pride || b.skillEffects.gluttony || b.skillEffects.sloth) {
		b.additionalStatuses.push({ icon: "🔺", value: 0 });
	}

	// 風魔法：戦闘時は速度を上げる、非戦闘時は速度ではなくパワーに還元
	let spdUp = getSpd(getSpdX(b.spd) * (1 + (b.skillEffects.spdUp ?? 0))) - getSpd(getSpdX(b.spd));
	if (b.rand("spdUp") < spdUp % 1) {
		spdUp = Math.floor(spdUp) + 1;
	} else {
		spdUp = Math.floor(spdUp);
	}
	if ((b.isBattle && b.isPhysical) && spdUp) {
		b.log.buff(serifs.rpg.skill.wind(spdUp) + "\n");
		b.spd = b.spd + spdUp;
		b.log.verbose(() => `風戦闘: S+${spdUp} (${formatNumber(b.spd)} (${getSpdX(b.spd) * 100}%))\n`);
	} else if (!(b.isBattle && b.isPhysical)) {
		// 非戦闘時は速度は上がらないが、パワーに還元される
		b.atk = b.atk * (1 + (b.skillEffects.spdUp ?? 0));
		b.log.verbose(() => `風非戦闘: A${displayDifference(1 + (b.skillEffects.spdUp ?? 0))} (${formatNumber(b.atk)})\n`);
	}

	// 遂・土：本来の効果が出ない敵なら、パワーに還元される
	// 発動条件は戦闘中に変わらないので、風と同じくターンのループの前に1回だけ掛ける
	// （ターンごとに掛けると、ターン中に足される継戦融合武装・攻めの守勢の分にも掛かってしまう）
	if (!b.enemy.abort && b.skillEffects.abortDown) {
		b.atk = b.atk * (1 + b.skillEffects.abortDown * (1 / 3));
		b.log.verbose(() => `遂スキル効果: A${displayDifference(1 + b.skillEffects.abortDown! * (1 / 3))} (${formatNumber(b.atk)})\n`);
	}
	if (b.skillEffects.dart && !(b.isBattle && b.isPhysical && b.enemy.maxdmg)) {
		b.atk = b.atk * (1 + b.skillEffects.dart * 0.5);
		b.log.verbose(() => `土スキル効果: A${displayDifference(1 + b.skillEffects.dart! * 0.5)} (${formatNumber(b.atk)})\n`);
	}

	// 非戦闘なら非戦闘時スキルが発動
	if (!b.isBattle) {
		b.atk = b.atk * (1 + (b.skillEffects.notBattleBonusAtk ?? 0));
		if (b.verboseLog && b.skillEffects.notBattleBonusAtk) {
			b.log.buff(`非戦闘: A${displayDifference(1 + (b.skillEffects.notBattleBonusAtk ?? 0))} (${formatNumber(b.atk)})\n`);
		}
	}
	if (b.isTired) {
		b.def = b.def * (1 + (b.skillEffects.notBattleBonusDef ?? 0));
		if (b.verboseLog && b.skillEffects.notBattleBonusDef) {
			b.log.buff(`疲スキル効果: D${displayDifference(1 + (b.skillEffects.notBattleBonusDef ?? 0))} (${formatNumber(b.def)})\n`);
		}
	}

	if (b.skillEffects.enemyStatusBonus) {
		const enemyStrongs = Math.min((b.enemyAtk / (b.lv * 3.5)) * (getVal(b.enemy.atkx, [3]) ?? 3) + (b.enemyDef / (b.lv * 3.5)) * (getVal(b.enemy.defx, [3]) ?? 3), 40);
		const bonus = Math.floor((enemyStrongs / 4) * b.skillEffects.enemyStatusBonus);
		b.atk = b.atk * (1 + (bonus / 100));
		b.def = b.def * (1 + (bonus / 100));
		if (bonus / b.skillEffects.enemyStatusBonus >= 5) {
			b.log.buff(serifs.rpg.skill.enemyStatusBonus + "\n");
		}
		if (b.verboseLog && bonus >= 1) {
			b.log.buff(`強スキル効果: AD${displayDifference(1 + (bonus / 100))} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
		}
	}

	if (b.skillEffects.firstTurnResist && b.count === 1 && b.isBattle && b.isPhysical) {
		b.log.buff(serifs.rpg.skill.firstTurnResist + "\n");
		b.log.verbose(() => `断スキル効果: 被ダメージ${displayDifference(1 - b.skillEffects.firstTurnResist!)}\n`);
	}

	const arpenX = calculateArpen(b.data, (b.skillEffects.arpen ?? 0), b.enemyDef)
	b.atk = b.atk * arpenX;
	if (b.verboseLog && arpenX > 1) {
		b.log.buff(`貫スキル効果: A${displayDifference(arpenX)}\n`);
	}

	// バフが1つでも付与された場合、改行を追加する
	b.log.endBuffs();

	if (b.skillEffects.plusActionX) {
		b.atk = b.atk * (1 + (b.skillEffects.plusActionX ?? 0) / 10);
		b.log.verbose(() => `速スキル効果: A${displayDifference((1 + (b.skillEffects.plusActionX ?? 0) / 10))} (${formatNumber(b.atk)})\n`);
	}

	if (b.skillEffects.enemyCritDmgDown) {
		b.def = b.def * (1 + (b.skillEffects.enemyCritDmgDown ?? 0) / 4);
		b.log.verbose(() => `守スキル効果: D${displayDifference((1 + (b.skillEffects.enemyCritDmgDown ?? 0) / 4))} (${formatNumber(b.def)})\n`);
	}
	if (b.skillEffects.enemyBuff) {
		b.atk = b.atk * (1 + (b.skillEffects.enemyBuff ?? 0) / 20);
		b.def = b.def * (1 + (b.skillEffects.enemyBuff ?? 0) / 20);
		b.log.verbose(() => `お守り効果: AD${displayDifference((1 + (b.skillEffects.enemyBuff ?? 0) / 20))} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
	}

	b._atk = b.atk;
	b._def = b.def;
	b._spd = b.spd;
	b._enemyAtk = b.enemyAtk;
	b._enemyDef = b.enemyDef;

	/** 敵のターンが既に完了したかのフラグ */
	b.enemyTurnFinished = false;

	b.plusActionX = 5;

	b.totalResistDmg = 0;
	b.transcendenceActivated = false;
	b.canAccessBackShop = ((!b.msg.user.host && b.msg.user.username === config.master) || b.data.items.filter((x) => x.name === "裏ショップ入場の札").length > 0);

	if (b.skillEffects.transcendence && b.playerHp > 1) {
		const convertedHp = b.playerHp - 1;
		b.playerHp = 1;
		pre.addBarrier(convertedHp);
		b.transcendenceActivated = true;
		b.log.buff(`超越のお守りが発動した！\n体力${Math.floor(convertedHp)}ポイントがバリアに変換された！\n`);
	}
}

/**
 * レイド（通常型）の段階2: ステータスと敵ステータスの計算・調子補正・魔法・体力・戦闘前に掛かるスキル効果
 *
 * @internal
 */
function applyPreBattleModifiers(b: RaidBattle) {
	const pre = {} as RaidPreBattle;
	computeRaidStatus(b, pre);
	setupRaidMagic(b, pre);
	setupRaidHp(b, pre);
	applyRaidSuperAndWarrior(b, pre);
	applyRaidSkillModifiers(b, pre);
}

/**
 * レイド（通常型）の 1 ターン分の状態
 *
 * @remarks
 * runRaidTurns の 1 ターンを、まとまりごとの関数に分けたときに、複数のまとまりで読み書きする値をまとめたもの。
 * 1 つのまとまりでしか使わない値は、その関数の中に置いている。ターンをまたぐ値は RaidBattle にある。
 *
 * @internal
 */
type RaidTurn = {
	turnLog: BattleLog;
	playerHpPercent: number;
	enemyHpPercent: number;
	slothFlg: boolean;
	maxdmg: number | undefined;
	dmgUp: number;
	critUp: number;
	trueDmg: number;
	defDmgX: number;
	atkMinRnd: number;
	atkMaxRnd: number;
	defMinRnd: number;
	defMaxRnd: number;
	predictedDmg: number;
	endureCount: number;
	_data: any;
	actionX: number;
};

/**
 * レイド（通常型）のターン 1: ステータスを戻し、ターン開始時の効果を掛ける（継戦融合武装・怠惰・魔法・スロースタート・バーサク・攻めの守勢・毒・速度アップ）
 *
 * @internal
 */
function startRaidTurn(b: RaidBattle, t: RaidTurn) {

	/** バフを得た数。行数のコントロールに使用 */
	t.turnLog = b.log.scope();

	/** プレイヤーのHP割合 */
	t.playerHpPercent = b.playerHp / (b.playerMaxHp);
	/** 敵のHP割合 */
	t.enemyHpPercent = 0.5 + 0.5 * ((6 - (b.count - 1)) / 6);

	if (b.skillEffects.tenacious && t.playerHpPercent < 0.5 && b.isBattle && b.isPhysical) {
		t.turnLog.buff(serifs.rpg.skill.tenacious + "\n");

		t.turnLog.verbose(() => `粘スキル効果: 被ダメージ${displayDifference((1 - Math.min((b.skillEffects.tenacious ?? 0) * (1 - t.playerHpPercent), 0.9)))}\n`);
	}

	b.item = undefined;
	b.item2 = undefined;
	b.atk = b._atk;
	b.def = b._def;
	b.spd = b._spd;
	b.enemyAtk = b._enemyAtk;
	b.enemyDef = b._enemyDef;
	b.itemBonus = { atk: 0, def: 0 };
	b.enemyTurnFinished = false;
	b.enemyAtkX = 1;
	b.itemBoost = 0;
	b.itemMinEffect = 0;

	if (b.skillEffects.itemAtkStock && b.itemAtkStockNext > 0) {
		const itemAtkStockGain = Math.floor(b.itemAtkStockNext);
		if (itemAtkStockGain > 0) {
			b.itemAtkStock += itemAtkStockGain;
			t.turnLog.markBuff();
			const itemAtkStockRate = Math.max(b.itemAtkStock / (b.lv * 3.5), 0);
			if (b.verboseLog) {
				t.turnLog.add(`継スキル: 累積+${itemAtkStockGain} (${Math.floor(itemAtkStockRate * 100)}%)\n`);
			} else {
				t.turnLog.add(serifs.rpg.skill.itemAtkStock(itemAtkStockRate) + "\n");
			}
		}
		b.itemAtkStockNext = 0;
	}
	if (b.skillEffects.itemAtkStock && b.itemAtkStock > 0) {
		b.atk += b.itemAtkStock;
	}

	t.turnLog.verbose(() => `ターン開始時ステータス:\nA: ${formatNumber(b.atk)} (x${formatNumber(b.atk / (b.lv * 3.5))})\nD: ${formatNumber(b.def)} (x${formatNumber(b.def / (b.lv * 3.5))})\nS: ${formatNumber(b.spd)} (${getSpdX(b.spd) * 100}%)\nHP%: ${formatNumber(t.playerHpPercent * 100)}%\n${b.atkDmgBonus > 1 ? `Dmg: ${displayDifference(b.atkDmgBonus)}\n` : ""}ターン開始時敵ステータス:\nA: x${formatNumber(b.enemyAtk / (b.lv * 3.5))} D: x${formatNumber(b.enemyDef / (b.lv * 3.5))} \nHP%: ${
formatNumber(t.enemyHpPercent * 100)}%\n\n`);

	t.slothFlg = false;

	if (b.skillEffects.sloth && b.rand("sloth", b.count) < 0.3) {
		b.atkDmgBonus *= 1.5;
		b.atk = Math.ceil(b.atk * 0.001);
		t.turnLog.buff("怠惰が発動した！このターンは力がでない！\n");
		t.slothFlg = true;
		if (b.verboseLog) t.turnLog.add(`怠惰: A-99.9% (${formatNumber(b.atk)})\n`);
	}

	b.checkMagic("TurnStart");

	if (b.skillEffects.slowStart) {
		const n = (b.skillEffects.slowStart ?? 0)
		const increment = (600 + 45 * n - 6 * (57.5 - 7.5 * n)) / 15;
		b.atk = b.atk * (((60 - 10 * n) + (increment * (b.count - 1))) / 100);
		b.def = b.def * (((60 - 10 * n) + (increment * (b.count - 1))) / 100);
		t.turnLog.verbose(() => `お守り効果: AD${displayDifference(((60 - 10 * n) + (increment * (b.count - 1))) / 100)} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
	}

	if (b.skillEffects.berserk) {
		const berserkDmg = Math.min(Math.floor((b.playerMaxHp * Math.min(t.playerHpPercent * 2, 1)) * (b.skillEffects.berserk ?? 0)), b.playerHp - 1);
		b.playerHp -= berserkDmg;
		t.playerHpPercent = b.playerHp / (b.playerMaxHp);
		if (berserkDmg > 0) {
			b.atk = b.atk * (1 + (b.skillEffects.berserk ?? 0) * 1.6);
			t.turnLog.buff(serifs.rpg.skill.berserk(berserkDmg) + "\n");
		}
		t.turnLog.verbose(() => `お守り効果: A${displayDifference((1 + (b.skillEffects.berserk ?? 0) * 1.6))} (${formatNumber(b.atk)})\n`);
	}

	if (b.skillEffects.guardAtkUp && b.totalResistDmg >= 300) {
		t.turnLog.markBuff();
		b.totalResistDmg = Math.min(b.totalResistDmg, 1200)
		const guardAtkUpX = [0, 1, 2.4, 4.8, 8, 8];
		t.turnLog.add(serifs.rpg.skill.guardAtkUp(Math.floor(b.totalResistDmg / 300)) + "\n");
		b.atk += (b.def * (b.skillEffects.guardAtkUp * guardAtkUpX[Math.floor(b.totalResistDmg / 300)]));
		if (b.verboseLog) {
			t.turnLog.buff(`勢スキル状態: ${Math.floor(b.totalResistDmg)} / 1200\n`);
			t.turnLog.add(`勢スキル効果: A+${formatNumber(b.def * (b.skillEffects.guardAtkUp * guardAtkUpX[Math.floor(b.totalResistDmg / 300)]))} (${formatNumber(b.atk)})\n`);
		}
	}

	// 毒属性剣攻撃
	if (b.skillEffects.weak && b.count > 1) {
		if (b.isBattle && b.isPhysical) {
			t.turnLog.buff(serifs.rpg.skill.weak(b.enemy.dname ?? b.enemy.name) + "\n");
		}
		const weakXList = [0, 0.25, 0.5, 1, 1.5, 3.5, 4, 4.5, 5];
		const weakX = 1 - (1 / (1 + ((b.skillEffects.weak * weakXList[b.count - 1]))))
		const weakAtkReduction = Math.max(b.enemyAtk * weakX, b.atk * weakX);
		b.enemyAtk = applyWeakAtkReduction(b.enemyAtk, weakAtkReduction);
		const arpenX = calculateArpen(b.data, b.skillEffects.weak * weakXList[b.count - 1], b.enemyDef)
		b.atk = b.atk * arpenX;
		t.turnLog.verbose(() => `毒スキル効果: ${displayDifference(1 - weakX)} (x${formatNumber(b.enemyAtk / (b.lv * 3.5))} / x${formatNumber(b.enemyDef / (b.lv * 3.5))})\n`);
	}

	// spdが低い場合、確率でspdが+1。
	if (!t.slothFlg) {
		if (b.spd === 2 && b.rand("lowSpdUp", b.count) < 0.2) {
			t.turnLog.buff(serifs.rpg.spdUp + "\n");
			b.spd = 3;
		}
		if (b.spd === 1 && b.rand("lowSpdUp", b.count) < 0.6) {
			t.turnLog.buff(serifs.rpg.spdUp + "\n");
			b.spd = 2;
		}
	}
}

/**
 * レイド（通常型）のターン 2-1: 最大ダメージ制限の計算と、決死の覚悟・水（炎の敵）
 *
 * @internal
 */
function applyRaidDesperation(b: RaidBattle, t: RaidTurn) {

	// 敵に最大ダメージ制限がある場合、ここで計算
	/** 1ターンに与えられる最大ダメージ量 */
	t.maxdmg = b.enemy.maxdmg ? b.enemyMaxHp * b.enemy.maxdmg : undefined;

	t.dmgUp = 1;
	t.critUp = 0;

	// HPが1/7以下で相手とのHP差がかなりある場合、決死の覚悟のバフを得る
	const notLastPowerActive = aggregateTokensEffects(b.data).notLastPower || (b.transcendenceActivated && !b.canAccessBackShop);
	if (!notLastPowerActive && !t.slothFlg) {
		if (t.playerHpPercent <= (1 / 7) * (1 + (b.skillEffects.haisuiUp ?? 0)) && ((t.enemyHpPercent * (1 + (b.skillEffects.haisuiUp ?? 0))) - t.playerHpPercent) >= 0.5) {
			t.turnLog.buff(serifs.rpg.haisui + "\n");
			t.dmgUp *= (1 + (b.skillEffects.haisuiAtkUp ?? 0));
			t.critUp += (b.skillEffects.haisuiCritUp ?? 0)
			const effect = Math.min((t.enemyHpPercent - t.playerHpPercent) * (1 + (b.skillEffects.haisuiUp ?? 0)), 0.95);
			b.atk = b.atk + Math.round(b.def * effect);
			b.def = Math.round(b.def * (1 - effect));
			t.turnLog.verbose(() => `決死の覚悟: ${[`D->A ${Math.round(effect * 100)}% (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`, b.skillEffects.haisuiAtkUp ? `与ダメージ${displayDifference((1 + (b.skillEffects.haisuiAtkUp ?? 0)))}` : "", b.skillEffects.haisuiCritUp ? `クリ率${displayDifference((1 + (b.skillEffects.haisuiCritUp ?? 0)))}` : ""].filter(Boolean).join(" ")}\n`);
		}
	}

	if (b.enemy.fire && b.skillEffects.water) {
		t.dmgUp *= (1 + (b.skillEffects.water ?? 0));
		t.turnLog.verbose(() => `水スキル効果: 与ダメージ${displayDifference((1 + (b.skillEffects.water ?? 0)))}\n`);
	}
}

/**
 * レイド（通常型）のターン 2-2: 装備するアイテムを選ぶ（装備率・アイテムの種類・強欲）
 *
 * @internal
 */
function chooseRaidItem(b: RaidBattle, t: RaidTurn) {

	const itemEquip = (0.4 + ((1 - t.playerHpPercent) * 0.6) + b.itemBoost) * (t.slothFlg ? 0 : 1);
	if (b.verboseLog && !(b.count === 1 && b.skillEffects.firstTurnItem)) {
		t.turnLog.buff(`アイテム装備率: ${Math.round(Math.min(itemEquip * (1 + (b.skillEffects.itemEquip ?? 0)), 1) * 100)}%\n`);
	}
	if (b.verboseLog && b.count === 1 && b.skillEffects.firstTurnDoubleItem) {
		t.turnLog.buff(`アイテム二刀流率: ${Math.round(Math.min(itemEquip * (1 + (b.skillEffects.itemEquip ?? 0)), 1) * 100)}%\n`);
	}
	if (rpgItems.length && ((b.count === 1 && b.skillEffects.firstTurnItem) || b.rand("item.equip", b.count) < itemEquip * (1 + (b.skillEffects.itemEquip ?? 0)))) {
		//アイテム
		t.turnLog.markBuff();
		if ((b.count === 1 && b.skillEffects.firstTurnItem)) t.turnLog.add(serifs.rpg.skill.firstItem);
		if (b.enemy.pLToR) {
			let isPlus = b.rand("item.plus", b.count) < 0.5;
			const items = rpgItems.filter((x) => isPlus ? x.mind > 0 : x.mind < 0);
			b.item = { ...items[Math.floor(b.rand("item.pick", b.count) * items.length)] };
		} else {
			let types = ["weapon", "armor"];
			for (let i = 0; i < (b.skillEffects.weaponSelect ?? 0); i++) {
				types.push("weapon");
			}
			for (let i = 0; i < (b.skillEffects.armorSelect ?? 0); i++) {
				types.push("armor");
			}
			if ((b.count !== 1 || b.enemy.pLToR) && !b.skillEffects.lowHpFood && t.playerHpPercent < 0.95) {
				types.push("medicine");
				types.push("poison");
				for (let i = 0; i < (b.skillEffects.foodSelect ?? 0); i++) {
					types.push("medicine");
					types.push("poison");
				}
			}
			if ((b.skillEffects.weaponSelect ?? 0) >= 1) {
				types = ["weapon"]
			}
			if ((b.skillEffects.armorSelect ?? 0) >= 1) {
				types = ["armor"]
			}
			if ((b.skillEffects.foodSelect ?? 0) >= 1) {
				types = ["medicine", "poison"];
			}
			if ((b.count !== 1 || b.enemy.pLToR) && b.skillEffects.lowHpFood && t.playerHpPercent < 0.95 && b.rand("item.lowHpFood", b.count) < b.skillEffects.lowHpFood * t.playerHpPercent) {
				if (b.skillEffects.lowHpFood && t.playerHpPercent < 0.5) t.turnLog.add(serifs.rpg.skill.lowHpFood);
				types = ["medicine", "poison"];
				if (b.rand("item.lowHpFood", b.count) < b.skillEffects.lowHpFood * t.playerHpPercent) types = ["medicine"];
			}
			if (types.includes("poison") && b.rand("item.poisonAvoid", b.count) < (b.skillEffects.poisonAvoid ?? 0)) {
				types = types.filter((x) => x!== "poison");
			}
			const type = types[Math.floor(b.rand("item.type", b.count) * types.length)];
			const mEffect = Math.max((b.count !== 1 ? 0 : b.skillEffects.firstTurnItemChoice!), b.itemMinEffect);
			if ((type === "weapon" && !(b.isBattle && b.isPhysical)) || (type === "armor" && b.isTired) || b.enemy.pLToR) {
				let isPlus = b.rand("item.plus", b.count) < (0.5 + (b.skillEffects.mindMinusAvoid ?? 0) + (b.count === 1 ? b.skillEffects.firstTurnMindMinusAvoid ?? 0 : 0));
				const items = rpgItems.filter((x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0) && (!mEffect || x.mind >= (mEffect * 100)));
				b.item = { ...items[Math.floor(b.rand("item.pick", b.count) * items.length)] };
			} else {
				const items = rpgItems.filter((x) => x.type === type && x.effect > 0 && (!mEffect || x.effect >= (mEffect * 100)));
				b.item = { ...items[Math.floor(b.rand("item.pick", b.count) * items.length)] };
			}
			if (b.skillEffects.greed) {
				if (!b.data.stockItem) b.data.stockItem = { ...b.item };
				b.data.stockItem.effect = Math.ceil(b.data.stockItem.effect * (2/3));
				b.data.stockItem.mind = Math.ceil(b.data.stockItem.mind * (2/3));
				const match = b.data.stockItem.name.match(/-(\d+)$/);
				if (match && match.index !== undefined) {
					const number = parseInt(match[1], 10);
					const newNumber = number + 1;
					b.data.stockItem.name = b.data.stockItem.name.slice(0, match.index) + '-' + newNumber;
				} else {
					b.data.stockItem.name = b.data.stockItem.name + '-1';
				}
				if ((type === "weapon" && !(b.isBattle && b.isPhysical)) || (type === "armor" && b.isTired) || b.enemy.pLToR) {
					if (b.item.mind <= b.data.stockItem.mind) {
						b.item = { ...b.data.stockItem };
					} else {
						if (type === "weapon" || type === "armor") b.data.stockItem = { ...b.item };
					}
				} else {
					if (b.item.effect <= b.data.stockItem.effect) {
						b.item = { ...b.data.stockItem };
					} else {
						if (type === "weapon" || type === "armor") b.data.stockItem = { ...b.item };
					}
				}
			} else {
				b.data.stockItem = undefined;
			}
			if (b.count === 1 && b.skillEffects.firstTurnDoubleItem && b.rand("item2.equip", b.count) < itemEquip * (1 + (b.skillEffects.itemEquip ?? 0))) {
				if ((type === "weapon" && !(b.isBattle && b.isPhysical)) || (type === "armor" && b.isTired) || b.enemy.pLToR) {
					let isPlus = b.rand("item2.plus", b.count) < (0.5 + (b.skillEffects.mindMinusAvoid ?? 0) + (b.count === 1 ? b.skillEffects.firstTurnMindMinusAvoid ?? 0 : 0));
					const items = rpgItems.filter((x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0));
					b.item2 = { ...items[Math.floor(b.rand("item2.pick", b.count) * items.length)] };
				} else {
					const items = rpgItems.filter((x) => x.type === type && x.effect > 0);
					b.item2 = { ...items[Math.floor(b.rand("item2.pick", b.count) * items.length)] };
				}
				b.item.effect = b.item.effect + b.item2.effect;
				b.item.mind = b.item.mind + b.item2.mind;
				if (b.item.name === b.item2.name) {
					b.item.effect = b.item.effect + b.item2.effect;
					b.item.mind = b.item.mind + b.item2.mind;
				}
			}
		}
	}
	if (b.skillEffects.greed) {
		if (b.data.stockItem && !b.item) {
			b.data.stockItem.effect = Math.ceil(b.data.stockItem.effect * (2/3));
			b.data.stockItem.mind = Math.ceil(b.data.stockItem.mind * (2/3));
			const match = b.data.stockItem.name.match(/-(\d+)$/);
			if (match && match.index !== undefined) {
				const number = parseInt(match[1], 10);
				const newNumber = number + 1;
				b.data.stockItem.name = b.data.stockItem.name.slice(0, match.index) + '-' + newNumber;
			} else {
				b.data.stockItem.name = b.data.stockItem.name + '-1';
			}
			b.item = { ...b.data.stockItem };
		}
	} else {
		b.data.stockItem = undefined;
	}
}

/**
 * レイド（通常型）のターン 2-3: 選んだアイテムの効果（武器・防具・食べ物・毒など）
 *
 * @internal
 */
function useRaidItem(b: RaidBattle, t: RaidTurn) {
	if (b.item) {
		const rawEffect = b.item.effect;
		const rawMind = b.item.mind;
		const mindMsg = (mind) => {
			if (mind >= 100) {
				t.turnLog.add(`${config.rpgHeroName}の気合が特大アップ！\n`);
			} else if (mind >= 70) {
				t.turnLog.add(`${config.rpgHeroName}の気合が大アップ！\n`);
			} else if (mind > 30) {
				t.turnLog.add(`${config.rpgHeroName}の気合がアップ！\n`);
			} else if (mind > 0) {
				t.turnLog.add(`${config.rpgHeroName}の気合が小アップ！\n`);
			} else if (mind > -50) {
				t.turnLog.add(`あまり良い気分ではないようだ…\n`);
			} else {
				t.turnLog.add(`${config.rpgHeroName}の気合が下がった…\n`);
			}
			t.turnLog.verbose(() => `アイテム効果: ${Math.round(b.item.mind)}%${rawMind !== b.item.mind ? ` (${displayDifference(b.item.mind / rawMind)})` : ""} (${formatNumber(b.atk)} / ${formatNumber(b.def)})\n`);
		};
		if (b.item.type !== "poison") {
			b.item.effect = Math.round(b.item.effect * (1 + (b.skillEffects.itemBoost ?? 0)));
			if (b.item.type === "weapon") b.item.effect = Math.round(b.item.effect * (1 + (b.skillEffects.weaponBoost ?? 0)));
			if (b.item.type === "armor") b.item.effect = Math.round(b.item.effect * (1 + (b.skillEffects.armorBoost ?? 0)));
			if (b.item.type === "medicine") b.item.effect = Math.round(b.item.effect * (1 + (b.skillEffects.foodBoost ?? 0)));

		} else {
			b.item.effect = Math.round(b.item.effect / (1 + (b.skillEffects.itemBoost ?? 0)));
			b.item.effect = Math.round(b.item.effect / (1 + (b.skillEffects.poisonResist ?? 0)));
		}
		if (b.item.mind < 0) {
			b.item.mind = Math.round(b.item.mind / (1 + (b.skillEffects.itemBoost ?? 0)));
		} else {
			b.item.mind = Math.round(b.item.mind * (1 + (b.skillEffects.itemBoost ?? 0)));
		}
		switch (b.item.type) {
			case "weapon":
				t.turnLog.add(`${b.item.name}を取り出し、装備した！\n`);
				if (b.item2?.name) {
					t.turnLog.add(`さらに、${b.item2.name}を取り出し、装備した！\n`);
				}
				if (!(b.isBattle && b.isPhysical)) {
					mindMsg(b.item.mind);
					if (b.item.mind < 0 && b.isSuper) b.item.mind = b.item.mind / 2;
					b.itemBonus.atk = b.atk * (b.item.mind * 0.0025);
					b.itemBonus.def = b.def * (b.item.mind * 0.0025);
					b.atk = b.atk + b.itemBonus.atk;
					b.def = b.def + b.itemBonus.def;
				} else {
					b.itemBonus.atk = (b.lv * 4) * (b.item.effect * 0.007);
					b.atk = b.atk + b.itemBonus.atk;
					if (b.item.effect >= 100) {
						t.turnLog.add(`${config.rpgHeroName}のパワーが特大アップ！\n`);
					} else if (b.item.effect >= 70) {
						t.turnLog.add(`${config.rpgHeroName}のパワーが大アップ！\n`);
					} else if (b.item.effect > 30) {
						t.turnLog.add(`${config.rpgHeroName}のパワーがアップ！\n`);
					} else {
						t.turnLog.add(`${config.rpgHeroName}のパワーが小アップ！\n`);
					}
					t.turnLog.verbose(() => `アイテム効果: ${Math.round(b.item.effect)}%${rawEffect !== b.item.effect ? ` (${displayDifference(b.item.effect / rawEffect)})` : ""} (${formatNumber(b.atk)})\n`);
				}
				break;
			case "armor":
				t.turnLog.add(`${b.item.name}を取り出し、装備した！\n`);
				if (b.item2?.name) {
					t.turnLog.add(`さらに、${b.item2.name}を取り出し、装備した！\n`);
				}
				if (b.isTired) {
					mindMsg(b.item.mind);
					if (b.item.mind < 0 && b.isSuper) b.item.mind = b.item.mind / 2;
					b.itemBonus.atk = b.atk * (b.item.mind * 0.0035);
					b.itemBonus.def = b.def * (b.item.mind * 0.0035);
					b.atk = b.atk + b.itemBonus.atk;
					b.def = b.def + b.itemBonus.def;
					if (b.skillEffects.shieldBash && b.itemBonus.def > 0) {
						const shieldBashX = 1 - Math.pow(0.5, (b.skillEffects.shieldBash ?? 0));
						const shieldBashAtk = Math.floor(b.itemBonus.def * shieldBashX);
						if (shieldBashAtk > 0) {
							b.itemBonus.atk += shieldBashAtk;
							b.atk += shieldBashAtk;
						}
					}
				} else {
					b.itemBonus.def = (b.lv * 4) * (b.item.effect * 0.007);
					b.def = b.def + b.itemBonus.def;
					if (b.skillEffects.shieldBash && b.itemBonus.def > 0) {
						const shieldBashX = 1 - Math.pow(0.5, (b.skillEffects.shieldBash ?? 0));
						const shieldBashAtk = Math.floor(b.itemBonus.def * shieldBashX);
						if (shieldBashAtk > 0) {
							b.itemBonus.atk += shieldBashAtk;
							b.atk += shieldBashAtk;
						}
					}
					const shieldBashActivated = !!(b.skillEffects.shieldBash && b.itemBonus.atk > 0);
					if (b.item.effect >= 100) {
						t.turnLog.add(`${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が特大アップ！\n`);
					} else if (b.item.effect >= 70) {
						t.turnLog.add(`${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が大アップ！\n`);
					} else if (b.item.effect > 30) {
						t.turnLog.add(`${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}がアップ！\n`);
					} else {
						t.turnLog.add(`${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が小アップ！\n`);
					}
					t.turnLog.verbose(() => `アイテム効果: ${Math.round(b.item.effect)}%${rawEffect !== b.item.effect ? ` (${displayDifference(b.item.effect / rawEffect)})` : ""} (${formatNumber(b.def)})\n`);
				}
				break;
			case "medicine":
				t.turnLog.add(`${b.item.name}を取り出し、食べた！\n`);
				if (b.enemy.pLToR) {
					mindMsg(b.item.mind);
					if (b.item.mind < 0 && b.isSuper) b.item.mind = b.item.mind / 2;
					b.itemBonus.atk = b.atk * (b.item.mind * 0.0025);
					b.itemBonus.def = b.def * (b.item.mind * 0.0025);
					b.atk = b.atk + b.itemBonus.atk;
					b.def = b.def + b.itemBonus.def;
				} else {
					if (b.item.effect > 200) {
						const overHeal = b.item.effect - 200;
						mindMsg(overHeal);
						b.itemBonus.atk = b.atk * (overHeal * 0.0035);
						b.itemBonus.def = b.def * (overHeal * 0.0035);
						b.atk = b.atk + b.itemBonus.atk;
						b.def = b.def + b.itemBonus.def;
						b.item.effect = 200;
					}
					const heal = Math.round(((b.playerMaxHp) - b.playerHp) * (b.item.effect * 0.005));
					const recovered = b.recoverHpOrBarrier(heal);
					if (heal > 0) {
						if (recovered.barrier > 0) {
							t.turnLog.add(`${Math.floor(recovered.barrier)}ポイントのバリアを獲得！\n`);
						}
						if (recovered.healed >= 1) {
							if (b.item.effect >= 100 && recovered.healed >= 50) {
								t.turnLog.add(`${config.rpgHeroName}の体力が特大回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`);
							} else if (b.item.effect >= 70 && recovered.healed >= 35) {
								t.turnLog.add(`${config.rpgHeroName}の体力が大回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`);
							} else if (b.item.effect > 30 && recovered.healed >= 15) {
								t.turnLog.add(`${config.rpgHeroName}の体力が回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`);
							} else {
								t.turnLog.add(`${config.rpgHeroName}の体力が小回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`);
							}
						}
						t.turnLog.verbose(() => `アイテム効果: ${Math.round(b.item.effect)}%${rawEffect !== b.item.effect ? ` (${displayDifference(b.item.effect / rawEffect)})` : ""}\n`);
					}
				}
				if (b.skillEffects.gluttony) {
					b.atkDmgBonus *= 1.1;
					t.turnLog.markBuff();
					if (b.verboseLog) t.turnLog.add(`暴食: A+10% (${formatNumber(b.atk)})\n`);
				}
				break;
			case "poison":
				t.turnLog.add(`${b.item.name}を取り出し、食べた！\n`);
				if (b.enemy.pLToR) {
					mindMsg(b.item.mind);
					if (b.item.mind < 0 && b.isSuper) b.item.mind = b.item.mind / 2;
					b.itemBonus.atk = b.atk * (b.item.mind * 0.0025);
					b.itemBonus.def = b.def * (b.item.mind * 0.0025);
					b.atk = b.atk + b.itemBonus.atk;
					b.def = b.def + b.itemBonus.def;
				} else {
					const dmg = Math.round(b.playerHp * (b.item.effect * 0.003) * (b.isSuper && !aggregateTokensEffects(b.data).redMode ? 0.5 : 1));
					b.playerHp -= dmg;
					if (b.item.effect >= 70 && dmg > 0) {
						t.turnLog.add(`${config.rpgHeroName}はかなり調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`);
					} else if (b.item.effect > 30 && dmg > 0) {
						t.turnLog.add(`${config.rpgHeroName}は調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`);
					} else {
						t.turnLog.add(`あまり美味しくなかったようだ…${dmg > 0 ? `\n${dmg}ポイントのダメージを受けた！` : ""}\n`);
					}
					t.turnLog.verbose(() => `アイテム効果: ${Math.round(b.item.effect)}%${rawEffect !== b.item.effect ? ` (${displayDifference(b.item.effect / rawEffect)})` : ""}\n`);
				}
				if (b.skillEffects.gluttony) {
					b.atkDmgBonus *= 1.2;
					t.turnLog.markBuff();
					if (b.verboseLog) t.turnLog.add(`暴食: A+20% (${formatNumber(b.atk)})\n`);
				}
				break;
			default:
				break;
		}
		if (aggregateTokensEffects(b.data).showItemBonus) {
			const itemMessage = [`${b.itemBonus.atk > 0 ? `${serifs.rpg.status.atk}+${b.itemBonus.atk.toFixed(0)}` : ""}`, `${b.itemBonus.def > 0 ? `${serifs.rpg.status.def}+${b.itemBonus.def.toFixed(0)}` : ""}`].filter(Boolean).join(" / ");
			if (itemMessage) {
				t.turnLog.add(`(${itemMessage})\n`);
			}
		}
	}
}

/**
 * レイド（通常型）のターン 2-4: 継戦融合武装の持ち越し・土・炎
 *
 * @internal
 */
function applyRaidTurnElements(b: RaidBattle, t: RaidTurn) {
	if (b.skillEffects.itemAtkStock) {
		const itemAtkGain = Math.max(Math.floor(b.itemBonus.atk ?? 0), 0);
		if (itemAtkGain > 0) {
			b.itemAtkStockNext = Math.floor(itemAtkGain * (b.skillEffects.itemAtkStock ?? 0));
			if (b.verboseLog) {
				t.turnLog.add(`継スキル: 次ターン累積予定+${b.itemAtkStockNext}\n`);
			}
		} else {
			b.itemAtkStockNext = 0;
		}
	}
	// 土属性剣攻撃
	if (b.skillEffects.dart && b.isBattle && b.isPhysical && t.maxdmg) {
		t.turnLog.buff(serifs.rpg.skill.dart + "\n");
		t.maxdmg = t.maxdmg * (1 + b.skillEffects.dart);
	}

	t.trueDmg = 0;

	// 炎属性剣攻撃
	if (b.skillEffects.fire && (b.isBattle && b.isPhysical)) {
		t.turnLog.buff(serifs.rpg.skill.fire + "\n");
		t.trueDmg = Math.ceil(Math.min(b.lv, 255) * b.skillEffects.fire);
		t.turnLog.verbose(() => `火戦闘: Dmg+${Math.ceil(Math.min(b.lv, 255) * b.skillEffects.fire!)}\n`);
	} else if (b.skillEffects.fire && !(b.isBattle && b.isPhysical)) {
		// 非戦闘時は、パワーに還元される
		b.atk = b.atk + b.lv * 3.75 * b.skillEffects.fire;
		t.turnLog.verbose(() => `火非戦闘: A+${Math.floor(b.lv * 3.75 * b.skillEffects.fire!)} (${formatNumber(b.atk)})\n`);
	}

	// バフが1つでも付与された場合、改行を追加する
	t.turnLog.endBuffs();
}

/**
 * レイド（通常型）のターン 2: 攻撃前の補正（決死の覚悟・水）とアイテム（装備・強欲・継戦融合武装）と、土・炎の効果
 *
 * @internal
 */
function prepareRaidTurnAttack(b: RaidBattle, t: RaidTurn) {
	applyRaidDesperation(b, t);
	chooseRaidItem(b, t);
	useRaidItem(b, t);
	applyRaidTurnElements(b, t);
}

/**
 * レイド（通常型）のターン 3: 被ダメージ・乱数幅の計算と、敵の先制攻撃
 *
 * @internal
 */
function runRaidEnemyFirstStrike(b: RaidBattle, t: RaidTurn) {

	if (b.verboseLog && b.enemy.abort) {
		t.turnLog.buff(`連続攻撃中断率: ${b.enemy.abort * (1 - (b.skillEffects.abortDown ?? 0)) * 100}%\n`);
	}


	// 敵が中断能力持ちの場合、ここで何回攻撃可能か判定
	for (let i = 1; i < b.spd; i++) {
		if (b.enemy.abort && b.rand("abort", b.count) < b.enemy.abort * (1 - (b.skillEffects.abortDown ?? 0))) {
			b.abort = i;
			break;
		}
	}

	const defMinusMin = b.skillEffects.defDmgUp && b.skillEffects.defDmgUp < 0 ? (1 / (-1 + (b.skillEffects.defDmgUp ?? 0)) * -1) : 1;

	t.defDmgX = Math.max(1 *
		(Math.max(1 + (b.skillEffects.defDmgUp ?? 0), defMinusMin)) *
		(b.count === 1 && b.skillEffects.firstTurnResist ? (1 - (b.skillEffects.firstTurnResist ?? 0)) : 1) *
		(b.count === 2 && b.skillEffects.firstTurnResist && b.skillEffects.firstTurnResist > 1 ? (1 - ((b.skillEffects.firstTurnResist ?? 0) - 1)) : 1) *
		(1 - Math.min((b.skillEffects.tenacious ?? 0) * (1 - t.playerHpPercent), 0.9)), 0);

	t.atkMinRnd = Math.max(0.2 + (b.skillEffects.atkRndMin ?? 0), 0);
	t.atkMaxRnd = Math.max(1.6 + (b.skillEffects.atkRndMax ?? 0), 0);
	t.defMinRnd = Math.max(0.2 + (b.skillEffects.defRndMin ?? 0), 0);
	t.defMaxRnd = Math.max(1.6 + (b.skillEffects.defRndMax ?? 0), 0);

	/** 予測最大ダメージ */
	t.predictedDmg = Math.round((b.atk * b.tp * (t.atkMinRnd + t.atkMaxRnd)) * (1 / (((b.enemyDef * (getVal(b.enemy.defx, [b.count]) ?? 3)) + 100) / 100))) * (b.abort || b.spd);

	// 予測最大ダメージは最大ダメージ制限を超えない
	if (t.maxdmg && t.predictedDmg > t.maxdmg) t.predictedDmg = t.maxdmg;

	t.endureCount = 1 + (b.skillEffects.endureUp ?? 0) * 2;

	t._data = { ...b.data, enemy: b.enemy, count: b.count, fireStack: b.fireStack };


	if (t._data.enemy.fire && b.skillEffects.water) {
		t._data.enemy.fire /= (1 + (b.skillEffects.water ?? 0) * 3);
	}

	// 敵先制攻撃の処理
	// spdが1ではない、または戦闘ではない場合は先制攻撃しない
	if (!b.enemy.spd && !b.enemy.hpmsg && !b.isTired) {
		/** クリティカルかどうか */
		const crit = b.rand("enemyCrit", b.count) < (b.enemy.alwaysCrit ? 1 : 0) * (1 - (b.skillEffects.enemyCritDown ?? 0));
		// 予測最大ダメージが相手のHPの何割かで先制攻撃の確率が判定される
		if (b.rand("enemyFirst", b.count) < t.predictedDmg / b.enemyHp || (b.count === 3 && b.enemy.fire && (b.data.thirdFire ?? 0) <= 2)) {
			const rng = (t.defMinRnd + (b.enemy.fixRnd ?? random(b.data, b.startCharge, b.skillEffects, true, () => b.rand("enemyDmg", b.count))) * t.defMaxRnd);
			const critDmg = 1 + ((b.skillEffects.enemyCritDmgDown ?? 0) * -1);
			if (b.verboseLog && (t.defDmgX < 0.999 || t.defDmgX > 1.001)) {
				t.turnLog.buff(`D: ${formatNumber(b.def)} (x${formatNumber(b.def / (b.lv * 3.5))})\n`);
				t.turnLog.add(`合計被ダメージ: ${displayDifference(t.defDmgX)}\n`);
			}
			// 先制攻撃が取りやめになった場合に戻せるよう、炎上スタックとバリアは攻撃確定後に反映する
			const prevFireStack = b.fireStack;
			if (t._data.enemy.fire) {
				b.fireStack += t._data.enemy.fire / 0.15;
				t._data.fireStack = b.fireStack;
			}
			/** ダメージ */
			let dmg = getEnemyDmg(t._data, b.def, b.tp, 1, crit ? critDmg : false, b.enemyAtk, rng * t.defDmgX, getVal(b.enemy.atkx, [b.count]));
			let noItemDmg = getEnemyDmg(t._data, b.def - b.itemBonus.def, b.tp, 1, b.enemy.alwaysCrit ? 1 : false, b.enemyAtk, rng * t.defDmgX, getVal(b.enemy.atkx, [b.count]));
			let normalDmg = getEnemyDmg(t._data, b.lv * 3.75, b.tp, 1, b.enemy.alwaysCrit ? 1 : false, b.enemyAtk, rng * t.defDmgX, getVal(b.enemy.atkx, [b.count]));
			let addMessage = "";
			const rawDmg = dmg;
			let restBarrier = b.sevenFeverBarrier;
			if (b.sevenFeverBarrier > 0) {
				const reduced = reduceByBarrier(dmg, b.sevenFeverBarrier);
				dmg = reduced.reducedDmg;
				if (reduced.consumed) addMessage += `(バリア: -${Math.round(reduced.consumed * 10) / 10})\n`;
				if (noItemDmg > 0) {
					const noItemReduced = reduceByBarrier(noItemDmg, b.sevenFeverBarrier);
					noItemDmg = noItemReduced.reducedDmg;
				}
				restBarrier = reduced.restBarrier;
			}
			// ダメージが負けるほど多くなる場合は、先制攻撃しない
			if (b.warriorFlg || b.playerHp > dmg || (b.count === 3 && b.enemy.fire && (b.data.thirdFire ?? 0) <= 2)) {
				b.sevenFeverBarrier = restBarrier;
				const barrierStatus = b.additionalStatuses.find((status) => status.icon === "🛡️");
				if (barrierStatus) barrierStatus.value = b.sevenFeverBarrier;
				const fireStatus = b.additionalStatuses.find((status) => status.icon === serifs.rpg.fire);
				if (fireStatus) fireStatus.value = b.fireStack;
				if (normalDmg > rawDmg) {
					b.totalResistDmg += (normalDmg - rawDmg);
				}
				if (aggregateTokensEffects(b.data).showRandom) t.turnLog.add(`⚂ ${Math.floor(rng * 100)}%\n`);
				if (b.skillEffects.pride) {
					if (dmg <= (b.playerMaxHp / 10)) {
						b.atkDmgBonus *= 1.15;
					}
					if (dmg >= ((b.playerMaxHp / 10) * 3)) {
						dmg *= 2;
					}
				}
				b.playerHp -= dmg;
				t.turnLog.add((crit ? `**${b.enemy.defmsg(dmg)}**` : b.enemy.defmsg(dmg)) + "\n");
				if (addMessage) t.turnLog.add(addMessage);
				if (b.itemBonus.def && noItemDmg - dmg > 1) {
					t.turnLog.add(`(道具効果: -${noItemDmg - dmg})\n`);
				}
				if (b.warriorFlg && b.playerHp <= 0) {
					b.playerHp += dmg;
					t.turnLog.add(serifs.rpg.warrior.lose + "\n");
					dmg = 0;
					b.warriorFlg = false;
				}
				if (b.playerHp <= 0 && !b.enemy.notEndure) {
					t.turnLog.add(serifs.rpg.endure + "\n");
					b.playerHp = 1;
				}
				t.turnLog.add("\n");
				b.enemyTurnFinished = true;
				if (b.enemy.fire && b.count > (b.data.thirdFire ?? 0)) b.data.thirdFire = b.count;
				if (dmg > (b.data.superMuscle ?? 0)) b.data.superMuscle = dmg;
			} else {
				b.fireStack = prevFireStack;
				t._data.fireStack = prevFireStack;
			}
		}
	}
}

/**
 * レイド（通常型）のターン 4: 自分の攻撃（全身全霊・活力・戦士・雷と、攻撃回数ぶんのダメージ）
 *
 * @internal
 */
function runRaidPlayerAttack(b: RaidBattle, t: RaidTurn) {

	b.checkMagic("Attack", {predictedDmg: t.predictedDmg});

	if (b.skillEffects.allForOne || aggregateTokensEffects(b.data).allForOne) {
		const spdx = getSpdX(b.abort || b.spd);
		b.atk = b.atk * spdx * (1 + (b.skillEffects.allForOne ?? 0) * 0.1);
		t.trueDmg = t.trueDmg * spdx * (1 + (b.skillEffects.allForOne ?? 0) * 0.1);
		if (b.itemBonus?.atk) b.itemBonus.atk = b.itemBonus.atk * spdx * (1 + (b.skillEffects.allForOne ?? 0) * 0.1);
		b.spd = 1;
		if (b.verboseLog && spdx > 1) {
			t.turnLog.buff(`全身全霊: A${displayDifference(spdx)} S=1 (${formatNumber(b.atk)})\n`);
		}
	}

	if (b.atkDmgBonus > 1) {
		b.atk = Math.round(b.atk * b.atkDmgBonus);
		if (b.itemBonus?.atk) b.itemBonus.atk = b.itemBonus.atk * b.atkDmgBonus;
		if (b.verboseLog && b.atkDmgBonus > 1) {
			t.turnLog.buff(`ボーナス: A${displayDifference(b.atkDmgBonus)} (${formatNumber(b.atk)})\n`);
		}
	}

	// レイド活力ダメージ上乗せ：当ターンの通常攻撃全ヒットに加算する固定値
	let raidVitalityDmgBonus = 0;
	if (b.enemy.power && (b.data.raidVitality ?? 0) >= 1) {
		const meanRng = t.atkMinRnd + t.atkMaxRnd * 0.5;
		let sumTurnDmgX = 0;
		for (let ti = 0; ti < b.spd; ti++) {
			sumTurnDmgX += (ti < 2 ? 1 : ti < 3 ? 0.5 : ti < 4 ? 0.25 : 0.125);
		}
		const sampleHit = getAtkDmg(b.data, b.atk, b.tp, 1, false, b.enemyDef, b.enemyMaxHp, meanRng, getVal(b.enemy.defx, [b.count]));
		const estimatedTurnDmg = sampleHit * sumTurnDmgX;
		const remainingTurns = (b.plusActionX + 1) - t.actionX;
		const projectedTotal = b.totalDmg + estimatedTurnDmg * remainingTurns;
		const projectedScore = getIndividualRaidScore(b.enemy, projectedTotal);
		if (projectedScore !== undefined && projectedScore < 5) {
			const bonus = Math.floor(getIndividualRaidStarDamageThreshold(b.enemy, 3) / b.spd);
			if (bonus > 1) {
				b.data.raidVitality -= 1;
				raidVitalityDmgBonus = bonus;
				t.turnLog.verbose(() => `レイド活力: 全攻撃+${bonus} (残${b.data.raidVitality})\n`);
			}
		}
	}

	if (b.warriorFlg) {
		//** クリティカルかどうか */
		let crit = b.rand("warrior.crit", b.count) < 0.5;
		const dmg = getAtkDmg(b.data, b.lv * 5, b.tp, 1, crit ? b.warriorCritX : false, b.enemyDef, b.enemyMaxHp, 0.5, getVal(b.enemy.defx, [b.count]));
		// メッセージの出力
		t.turnLog.add((crit ? `**${serifs.rpg.warrior.atk(dmg)}**` : serifs.rpg.warrior.atk(dmg)) + "\n");
		b.totalDmg += dmg;
		b.warriorTotalDmg += dmg;
		if (crit) b.warriorCritX += 0.5;
	}

	const atkMinusMin = b.skillEffects.atkDmgUp && b.skillEffects.atkDmgUp < 0 ? (1 / (-1 + (b.skillEffects.atkDmgUp ?? 0)) * -1) : 1;

	if (b.verboseLog) {
		t.turnLog.buff(`A: ${formatNumber(b.atk)} (x${formatNumber(b.atk / (b.lv * 3.5))})\n`);
		t.turnLog.add(`クリティカル率: ${formatNumber((Math.max((t.enemyHpPercent - t.playerHpPercent) * (1 + (b.skillEffects.critUp ?? 0) + t.critUp), 0) + (b.skillEffects.critUpFixed ?? 0)) * 100)}%\n`);
	}

	// 雷（レイド）: そのターンの合計ダメージを、基本は雷の値の半分（雷で+9%）だけ増やす。
	// 好感度による行動回数（最低5回とみなす）より実際の行動倍率（段数の減衰を含めた getSpdX）が増えている場合、
	// 増えた割合の1.5乗だけ効果が上がる（風などで速度を上げる専用構成が、クリティカル重ねの専用構成と並ぶ強さになるよう調整）。
	// 全身全霊などで行動回数が減っていても、基本の効果は保証する。
	// 増える合計量は変えずに、何回目の攻撃かに比例した上乗せとして各攻撃に配り、後の攻撃ほど上乗せが大きくなるようにする（連撃感）。
	const turnDmgXOf = (i: number) => (i < 2 ? 1 : i < 3 ? 0.5 : i < 4 ? 0.25 : 0.125);
	let thunderStep = 0;
	if (b.skillEffects.thunder && b.spd > 0) {
		const baseSpd = Math.max(Math.floor((b.msg.friend.love ?? 0) / 100) + 1, 5);
		const thunderRate = (b.skillEffects.thunder / 2) * Math.pow(Math.max(1, getSpdX(b.spd) / getSpdX(baseSpd)), 1.5);
		let totalTurnDmgX = 0;
		for (let i = 0; i < b.spd; i++) totalTurnDmgX += turnDmgXOf(i);
		// i 回目（0始まり）の上乗せは thunderStep × (i + 1)。合計が totalTurnDmgX × thunderRate になるよう決める
		thunderStep = (totalTurnDmgX * thunderRate) / (b.spd * (b.spd + 1) / 2);
		t.turnLog.verbose(() => `雷戦闘: Dmg+${formatNumber(thunderRate * 100)}%\n`);
	}

	// 自身攻撃の処理
	// spdの回数分、以下の処理を繰り返す
	for (let i = 0; i < b.spd; i++) {
		const rng = (t.atkMinRnd + random(b.data, b.startCharge, b.skillEffects, false, () => b.rand("atkDmg", b.count)) * t.atkMaxRnd);
		if (aggregateTokensEffects(b.data).showRandom) t.turnLog.add(`⚂ ${Math.floor(rng * 100)}%\n`);
		const turnDmgX = turnDmgXOf(i);
		let dmgBonus = (Math.max(1 + (b.skillEffects.atkDmgUp ?? 0), atkMinusMin)) * t.dmgUp * (turnDmgX + thunderStep * (i + 1));
		const rawDmgBonus = dmgBonus / turnDmgX;
		if (b.verboseLog && (rawDmgBonus < 0.999 || rawDmgBonus > 1.001)) {
			t.turnLog.buff(`合計与ダメージ: ${displayDifference(rawDmgBonus)}\n`);
		}
		//** クリティカルかどうか */
		let crit = b.rand("crit", b.count) < Math.max((t.enemyHpPercent - t.playerHpPercent) * (1 + (b.skillEffects.critUp ?? 0) + t.critUp), 0) + (b.skillEffects.critUpFixed ?? 0);
		const critDmg = 1 + ((b.skillEffects.critDmgUp ?? 0));
		if (b.skillEffects.noCrit) {
			crit = false;
			const noCritBonus = 1 + (Math.min((Math.max((t.enemyHpPercent - t.playerHpPercent) * (1 + (b.skillEffects.critUp ?? 0) + t.critUp), 0) + (b.skillEffects.critUpFixed ?? 0)), 1) * ((2 * critDmg) - 1));
			dmgBonus *= noCritBonus
			if (b.verboseLog && (noCritBonus < 0.999 || noCritBonus > 1.001)) {
				t.turnLog.buff(`５スキル効果: ${displayDifference(noCritBonus)}\n`);
			}
		}
		/** ダメージ */
		let dmg = getAtkDmg(b.data, b.atk, b.tp, 1, crit ? critDmg : false, b.enemyDef, b.enemyMaxHp, rng * dmgBonus, getVal(b.enemy.defx, [b.count])) + Math.round(t.trueDmg * turnDmgX);
		let noItemDmg = getAtkDmg(b.data, b.atk - b.itemBonus.atk, b.tp, 1, crit ? critDmg : false, b.enemyDef, b.enemyMaxHp, rng * dmgBonus, getVal(b.enemy.defx, [b.count])) + Math.round(t.trueDmg * turnDmgX);
		if (b.sevenFever) {
			const num = 7 * Math.max(Math.ceil((b.skillEffects.sevenFever || 1) * turnDmgX), 1);
			dmg = Math.ceil(dmg / num) * num;
			noItemDmg = Math.ceil(noItemDmg / num) * num;
		}
		// 最大ダメージ制限処理
		if (t.maxdmg && t.maxdmg > 0 && dmg > Math.round(t.maxdmg * (1 / ((b.abort || b.spd) - i)))) {
			// 最大ダメージ制限を超えるダメージの場合は、ダメージが制限される。
			dmg = Math.round(t.maxdmg * (1 / ((b.abort || b.spd) - i)));
			t.maxdmg -= dmg;
			crit = false;
		} else if (t.maxdmg && t.maxdmg > 0) {
			t.maxdmg -= dmg;
		}
		if (raidVitalityDmgBonus > 0) {
			dmg += raidVitalityDmgBonus;
			noItemDmg += raidVitalityDmgBonus;
		}
		// メッセージの出力
		t.turnLog.add((crit ? `**${b.enemy.atkmsg(dmg)}**` : b.enemy.atkmsg(dmg)) + "\n");
		b.totalDmg += dmg;
		if (b.itemBonus.atk && dmg - noItemDmg > 1) {
			t.turnLog.add(`(道具効果: +${dmg - noItemDmg})\n`);
		}
		// 敵のHPが0以下になった場合は、以降の攻撃をキャンセル
		if (b.enemyHp <= 0) break;
		// 攻撃が中断される場合
		if ((i + 1) === b.abort) {
			if (b.enemy.abortmsg) t.turnLog.add(b.enemy.abortmsg + "\n");
			break;
		}
	}

	b.checkMagic("AfterAttack", {predictedDmg: t.predictedDmg});
}

/**
 * レイド（通常型）のターン 5: 勝敗の判定と敵の攻撃、次のターンへの準備
 *
 * @returns このターンで戦闘が終わったら true（ターンのループを抜ける）
 *
 * @internal
 */
function resolveRaidTurn(b: RaidBattle, t: RaidTurn): boolean {

	// 勝利処理
	if (b.enemyHp <= 0) {
		t.turnLog.add("\n" + b.enemy.winmsg + "\n\n" + serifs.rpg.win);
		return true;
	} else {
		// 攻撃後発動スキル効果
		// 氷属性剣攻撃
		if ((b.isBattle && b.isPhysical && !b.isTired) && b.rand("ice", b.count) < (b.skillEffects.ice ?? 0)) {
			t.turnLog.add(serifs.rpg.skill.ice(b.enemy.dname ?? b.enemy.name) + `\n`);
			b.enemyTurnFinished = true;
		} else if (!(b.isBattle && b.isPhysical && !b.isTired)) {
			// 非戦闘時は氷の効果はないが、防御に還元される
			b.def = b.def * (1 + (b.skillEffects.ice ?? 0));
			if (b.verboseLog && (b.skillEffects.ice ?? 0) > 0) {
				t.turnLog.buff(`氷非戦闘: D${displayDifference((1 + (b.skillEffects.ice ?? 0)))} (${formatNumber(b.def)})\n`);
			}
		}
		// 光属性剣攻撃
		if ((b.isBattle && b.isPhysical && !b.isTired) && b.rand("light", b.count) < (b.skillEffects.light ?? 0)) {
			t.turnLog.add(serifs.rpg.skill.light(b.enemy.dname ?? b.enemy.name) + `\n`);
			b.enemyAtkX = b.enemyAtkX * 0.5;
		} else if (!(b.isBattle && b.isPhysical && !b.isTired)) {
			// 非戦闘時は光の効果はないが、防御に還元される
			b.def = b.def * (1 + (b.skillEffects.light ?? 0) * 0.5);
			if (b.verboseLog && (b.skillEffects.light ?? 0) > 0) {
				t.turnLog.buff(`光非戦闘: D${displayDifference((1 + (b.skillEffects.light ?? 0) * 0.5))} (${formatNumber(b.def)})\n`);
			}
		}
		// 闇属性剣攻撃
		if (b.enemy.spd && b.enemy.spd >= 2 && b.rand("dark.spd", b.count) < (b.skillEffects.dark ?? 0) * 2) {
			t.turnLog.add(serifs.rpg.skill.spdDown(b.enemy.dname ?? b.enemy.name) + `\n`);
			b.enemy.spd = 1;
		} else if ((b.isBattle && b.isPhysical) && b.enemyHp > 150 && b.rand("dark", b.count) < (b.skillEffects.dark ?? 0)) {
			const dmg = Math.floor(300 / 2);
			t.turnLog.add(serifs.rpg.skill.dark(b.enemy.dname ?? b.enemy.name, dmg) + `\n`);
			b.totalDmg += dmg;
		} else if (!(b.isBattle && b.isPhysical)) {
			// 非戦闘時は闇の効果はないが、防御に還元される
			b.def = b.def * (1 + (b.skillEffects.dark ?? 0) * 0.7);
			if (b.verboseLog && (b.skillEffects.dark ?? 0) > 0) {
				t.turnLog.buff(`闇非戦闘: D${displayDifference((1 + (b.skillEffects.dark ?? 0) * 0.7))} (${formatNumber(b.def)})\n`);
			}
		}

		if (b.enemy && b.skillEffects.envy) {
			const targetScore = getIndividualRaidStarDamageThreshold(b.enemy, 5);
			const rate = (1 - (0.7 * Math.max(1 - (b.totalDmg / targetScore), 0)))
			if (rate < 1) {
				b.enemyAtkX = b.enemyAtkX * rate;
				t.turnLog.verbose(() => `嫉妬: 被ダメージ${displayDifference(rate)}\n`);
			} else {
				const score = b.enemy ? Math.max(Math.log2((b.totalDmg * 20) / (1024 / ((b.enemy.power ?? 30) / 30))) + 1, 1) : undefined;
				if (score && score > 5) {
					b.enemyAtkX = b.enemyAtkX * (1 + (score-5) * 0.1);
					t.turnLog.verbose(() => `嫉妬: 被ダメージ${displayDifference((1 + (score-5) * 0.1))}\n`);
				}
			}
		}

		if (b.enemy && b.skillEffects.beginner && b.count <= 4 && b.data.skills?.length && b.data.skills?.length <= 3) {
			const targetScore = getIndividualRaidStarDamageThreshold(b.enemy, 3);
			const rate = (1 - ((b.data.skills?.length >= 4 ? 0 : b.data.skills?.length >= 3 ? 0.3 : b.data.skills?.length >= 2 ? 0.6 : 0.9) * Math.max(1 - (b.totalDmg / targetScore), 0)));
			if (rate < 1) {
				b.enemyAtkX = b.enemyAtkX * rate;
				t.turnLog.verbose(() => `わかばの加護: 被ダメージ${displayDifference(rate)}\n`);
			}
		}

		b.checkMagic("Defense", {predictedDmg: t.predictedDmg});

		// 敵のターンが既に終了していない場合
		/** 受けた最大ダメージ */
		let maxDmg = 0;
		if (!b.enemyTurnFinished) {
			t.turnLog.add("\n");
			for (let i = 0; i < (b.enemy.spd ?? 1); i++) {
				const rng = (t.defMinRnd + (b.enemy.fixRnd ?? random(b.data, b.startCharge, b.skillEffects, true, () => b.rand("enemyDmg", b.count))) * t.defMaxRnd);
				if (aggregateTokensEffects(b.data).showRandom) t.turnLog.add(`⚂ ${Math.floor(rng * 100)}%\n`);
				/** クリティカルかどうか */
				const crit = b.rand("enemyCrit", b.count) < (b.enemy.alwaysCrit ? 1 : 0) * (1 - (b.skillEffects.enemyCritDown ?? 0));
				const critDmg = 1 + ((b.skillEffects.enemyCritDmgDown ?? 0) * -1);
				if (b.verboseLog && (t.defDmgX < 0.999 || t.defDmgX > 1.001)) {
					t.turnLog.buff(`D: ${formatNumber(b.def)} (x${formatNumber(b.def / (b.lv * 3.5))})\n`);
					t.turnLog.add(`合計被ダメージ: ${displayDifference(t.defDmgX)}\n`);
				}
				if (t._data.enemy.fire) {
					b.fireStack += t._data.enemy.fire / 0.15;
					t._data.fireStack = b.fireStack;
					const fireStatus = b.additionalStatuses.find((status) => status.icon === serifs.rpg.fire);
					if (fireStatus) fireStatus.value = b.fireStack;
				}
				/** ダメージ */
				let dmg = getEnemyDmg(t._data, b.def, b.tp, 1, crit ? critDmg : false, b.enemyAtk, rng * t.defDmgX * b.enemyAtkX, getVal(b.enemy.atkx, [b.count]));
				let noItemDmg = getEnemyDmg(t._data, b.def - b.itemBonus.def, b.tp, 1, crit ? critDmg : false, b.enemyAtk, rng * t.defDmgX * b.enemyAtkX, getVal(b.enemy.atkx, [b.count]));
				let normalDmg = getEnemyDmg(t._data, b.lv * 3.75, b.tp, 1, b.enemy.alwaysCrit ? 1 : false, b.enemyAtk, rng, getVal(b.enemy.atkx, [b.count]));
				let addMessage = "";
				if (normalDmg > dmg) {
					b.totalResistDmg += (normalDmg - dmg);
				}
				if (b.sevenFeverBarrier > 0) {
					const reduced = reduceByBarrier(dmg, b.sevenFeverBarrier);
					dmg = reduced.reducedDmg;
					if (reduced.consumed) addMessage += `(バリア: -${Math.round(reduced.consumed * 10) / 10})\n`;
					if (noItemDmg > 0) {
						const noItemReduced = reduceByBarrier(noItemDmg, b.sevenFeverBarrier);
						noItemDmg = noItemReduced.reducedDmg;
					}
					b.sevenFeverBarrier = reduced.restBarrier;
					const barrierStatus = b.additionalStatuses.find((status) => status.icon === "🛡️");
					if (barrierStatus) barrierStatus.value = b.sevenFeverBarrier;
				}
				if (b.skillEffects.pride) {
					if (dmg <= (b.playerMaxHp / 10)) {
						b.atkDmgBonus *= 1.15;
					}
					if (dmg >= ((b.playerMaxHp / 10) * 3)) {
						dmg *= 2;
					}
				}
				b.playerHp -= dmg;
				t.turnLog.add((crit ? `**${b.enemy.defmsg(dmg)}**` : b.enemy.defmsg(dmg)) + "\n");
				if (addMessage) t.turnLog.add(addMessage);
				if (b.itemBonus.def && noItemDmg - dmg > 1) {
					t.turnLog.add(`(道具効果: -${noItemDmg - dmg})\n`);
				}
				if (b.warriorFlg && b.playerHp <= 0) {
					b.playerHp += dmg;
					t.turnLog.add(serifs.rpg.warrior.lose + "\n");
					dmg = 0;
					b.warriorFlg = false;
				}
				if (dmg > maxDmg) maxDmg = dmg;
				if (b.enemy.fire && b.count > (b.data.thirdFire ?? 0)) b.data.thirdFire = b.count;
			}
			b.checkMagic("AfterDefense", {predictedDmg: t.predictedDmg});
			// HPが0で食いしばりが可能な場合、食いしばる
			const endure = (0.1 + (t.endureCount * 0.1)) - (b.count * 0.05);
			if (b.verboseLog && b.playerHp <= 0 && !b.enemy.notEndure && endure > 0) {
				t.turnLog.buff(`食いしばり率: ${formatNumber(endure * 100)}%\n`);
			}
			if (b.playerHp <= 0 && !b.enemy.notEndure && b.rand("endure", b.count) < endure) {
				t.turnLog.add(serifs.rpg.endure + "\n");
				b.playerHp = 1;
				t.endureCount -= 1;
			}
			if (b.verboseLog && b.skillEffects.escape && t.actionX + 1 < b.plusActionX && b.playerHp <= 0 && !b.enemy.notEndure) {
				t.turnLog.buff(`逃スキル: HPが0 ~ ${Math.ceil((b.playerMaxHp) * (b.skillEffects.escape / -16))}で発動\n(現在HP: ${Math.floor(b.playerHp)})\n`);
			}
			if (b.skillEffects.escape && t.actionX + 1 < b.plusActionX && b.playerHp <= 0 && b.playerHp >= (b.playerMaxHp) * (b.skillEffects.escape / -16) && !b.enemy.notEndure) {
				t.turnLog.add("やられそうになったので、\n一旦距離を取り、1ターン分回復に徹した！\n");
				const heal = Math.ceil((b.playerMaxHp) * (b.skillEffects.escape / 10)) + 1;
				const recovered = b.recoverHpOrBarrier(heal);
				if (recovered.healed >= 1) t.turnLog.add(`${Math.floor(recovered.healed)}ポイントの体力を回復！\n`);
				if (recovered.barrier > 0) t.turnLog.add(`${Math.floor(recovered.barrier)}ポイントのバリアを獲得した！\n`);
				t.actionX += 1;
				b.count += 1;
				b.skillEffects.escape -= 1;
			}
			if (maxDmg > (b.data.superMuscle ?? 0) && b.playerHp > 0) b.data.superMuscle = maxDmg;
		}
		b.checkMagic("TurnEnd", {predictedDmg: t.predictedDmg});
		// 敗北処理
		if (b.playerHp <= 0) {
			t.turnLog.add("\n" + b.enemy.losemsg);
			return true;
		} else {
			// 決着がつかない場合
			const chargeStatus = b.additionalStatuses.find((status) => status.icon === "🍀");
			if (chargeStatus) chargeStatus.value = b.data.charge;
			const sinStatus = b.additionalStatuses.find((status) => status.icon === "🔺");
			if (sinStatus) sinStatus.value = (b.atkDmgBonus - 1) * 10;
			if (t.actionX === b.plusActionX) {
				t.turnLog.add(showStatusDmg(t._data, b.playerHp, b.totalDmg, b.playerMaxHp, b.me, b.additionalStatuses));
			} else {
				t.turnLog.add(showStatusDmg(t._data, b.playerHp, b.totalDmg, b.playerMaxHp, b.me, b.additionalStatuses) + "\n\n");
			}
			b.count = b.count + 1;
		}
	}
	return false;
}

/**
 * レイド（通常型）の段階3: ターンのループ（アイテム・敵の攻撃・自分の攻撃・勝敗）
 *
 * @internal
 */
function runRaidTurns(b: RaidBattle) {
	for (let actionX = 0; actionX < b.plusActionX + 1; actionX++) {
		const t = { actionX } as RaidTurn;
		startRaidTurn(b, t);
		prepareRaidTurnAttack(b, t);
		runRaidEnemyFirstStrike(b, t);
		runRaidPlayerAttack(b, t);
		if (resolveRaidTurn(b, t)) break;
		// 逃走などでターンを飛ばした場合（resolveRaidTurn の中で t.actionX を進める）を、ループに戻す
		actionX = t.actionX;
	}
}

/**
 * レイド（通常型）の段階4: 戦士の攻撃と、最後まで戦い抜いた場合の全力の一撃
 *
 * @internal
 */
function finishRaidAttacks(b: RaidBattle) {

	if (b.warriorFlg) {
		//** クリティカルかどうか */
		let crit = b.rand("warrior.crit") < 0.5;
		const dmg = getAtkDmg(b.data, b.lv * 5, b.tp, 1, crit ? b.warriorCritX : false, b.enemyDef, b.enemyMaxHp, 1, getVal(b.enemy.defx, [b.count]));
		// メッセージの出力
		b.log.add("\n\n" + (crit ? `**${serifs.rpg.warrior.atk(dmg)}**` : serifs.rpg.warrior.atk(dmg)));
		b.totalDmg += dmg;
		b.warriorTotalDmg += dmg;
	}
	b.checkMagic("End");
	if (b.playerHp > 0) {
		if (b.skillEffects.guardAtkUp && b.totalResistDmg >= 300) {
			b.totalResistDmg = Math.min(b.totalResistDmg, 1200)
			const guardAtkUpX = [0, 1, 2.4, 4.8, 8, 8];
			const heal = Math.round(((b.playerMaxHp) - b.playerHp) * (b.skillEffects.guardAtkUp * guardAtkUpX[Math.floor(b.totalResistDmg / 300)]));
			b.recoverHpOrBarrier(heal);
			if (b.verboseLog) {
				b.log.buff(`\n\n勢スキル状態: ${Math.floor(b.totalResistDmg)} / 1200\n`);
				b.log.add(`\n勢スキル効果: HP+${formatNumber(heal)}\n`);
			}
		}
		const enemySAtk = Math.max((b._enemyAtk / (b.lv * 3.5)) * (getVal(b.enemy.atkx, [6]) ?? 3), 0.01);
		let enemyFDef = (typeof b.enemy.def === "function") ? b.enemy.def(b.atk, b.def, b.spd) : b.lv * 3.5 * (b.enemy.def ?? 1);
		const enemySDef = Math.max((enemyFDef / (b.lv * 3.5)) * (getVal(b.enemy.defx, [6]) ?? 3), enemySAtk / 3000);
		let lastDmg = (1000 + (enemySAtk >= 24 ? enemySAtk / 0.048 : 0)) * Math.max(enemySAtk / enemySDef, 1);
		let dmg = Math.round(b.playerHp / (b.playerMaxHp) * (b.enemy.maxLastDmg ? Math.min(lastDmg, b.enemy.maxLastDmg) : lastDmg));
		dmg = Math.round(dmg * (1 + (b.skillEffects.finalAttackUp ?? 0)));
		if (b.sevenFever >= 7) {
			if (dmg > 177777) {
				dmg = dmg >= 77777 ? Math.max(Math.floor((dmg - 77777) / 100000) * 100000, 0) + 77777 : dmg;
			} if (dmg > 17777) {
				dmg = dmg >= 7777 ? Math.max(Math.floor((dmg - 7777) / 10000) * 10000, 0) + 7777 : dmg;
			} else {
				dmg = dmg >= 777 ? Math.max(Math.floor((dmg - 777) / 1000) * 1000, 0) + 777 : dmg;
			}
		}
		b.log.verbose(() => `\nラストアタック: HP${Math.floor(b.playerHp / b.playerMaxHp * 100)}% / 最大${Math.round((b.enemy.maxLastDmg ? Math.min(lastDmg, b.enemy.maxLastDmg) : lastDmg))}`);
		b.log.add("\n\n" + serifs.rpg.finalAttack(dmg) + `\n\n` + (b.isTired ? serifs.rpg.timeUp2 : serifs.rpg.timeUp(b.enemy.name, (b.playerMaxHp))) + "\n\n" + b.enemy.losemsg);
		b.totalDmg += dmg;
	}
}

/**
 * レイド（通常型）の段階5: 合計ダメージ・記録・経験値とレベルアップ・返信
 *
 * @returns getTotalDmg の返り値
 *
 * @internal
 */
async function recordRaidResult(b: RaidBattle) {

	if (b.skillEffects.charge && b.data.charge > 0) {
		b.log.add("\n\n" + serifs.rpg.skill.charge);
		b.log.verbose(() => `\n現在のチャージ: ${Math.round(b.data.charge * 100)}`);
	} else if (b.data.charge < 0) {
		b.data.charge = 0;
	}

	b.log.add("\n\n" + serifs.rpg.totalDmg(b.totalDmg));

	if (b.warriorTotalDmg > 0) {
		b.log.add("\n" + serifs.rpg.warrior.totalDmg(b.warriorTotalDmg));
	}

	if (!b.data.raidScore) b.data.raidScore = {};
	if (!b.data.raidScore[b.enemy.name] || b.data.raidScore[b.enemy.name] < b.totalDmg) {
		if (b.data.raidScore[b.enemy.name]) {
			b.log.add("\n" + serifs.rpg.hiScore(b.data.raidScore[b.enemy.name], b.totalDmg));
			if (b.mark === ":blank:") b.mark = "🆙";
		}
		b.data.raidScore[b.enemy.name] = b.totalDmg;
	} else if (b.data.raidScore[b.enemy.name]) {
		b.log.add(`\n（これまでのベスト: ${b.data.raidScore[b.enemy.name].toLocaleString()}）`);
	}
	if (!b.data.clearRaid) b.data.clearRaid = [];
	if (b.count === 7 && !b.data.clearRaid.includes(b.enemy.name)) {
		b.data.clearRaid.push(b.enemy.name);
	}

	if (b.verboseLog) {
		const score = b.enemy ? Math.max(Math.log2((b.totalDmg * 20) / (1024 / ((b.enemy.power ?? 30) / 30))) + 1, 1) : undefined;
		if (score) b.log.add(`\n評価: ★${score.toFixed(2)}`);
	}

	if (aggregateTokensEffects(b.data).oomisoka && new Date().getMonth() === 11 && new Date().getDate() === 31) {
		const score = b.enemy ? Math.max(Math.log2((b.totalDmg * 20) / (1024 / ((b.enemy.power ?? 30) / 30))) + 1, 1) : undefined;
		if (score) {
			b.log.add("\n\n" + serifs.rpg.oomisokaEnd(score.toFixed(2), Math.ceil(score * 8)));
			b.data.coin += Math.ceil(score * 8);
		}
	}

	const amuletmsg = amuletMinusDurability(b.data);

	if (amuletmsg) {
		b.log.add("\n\n" + amuletmsg);
	}

	const rpgData = ai.moduleData.findOne({ type: 'rpg' });
	if (b.data.lv + 1 < rpgData.maxLv) {
		if (b.data.lv < 254) {
			b.data.exp = (b.data.exp ?? 0) + 5;
			b.log.add("\n\n" + serifs.rpg.expPointFast);
		} else {
			b.data.exp = (b.data.exp ?? 0) + 1;
			if (b.data.exp >= 3) {
				b.log.add("\n\n" + serifs.rpg.expPoint(b.data.exp));
			}
		}
	}

	if (b.data.exp >= 5 && b.data.lv !== 254 && (b.data.lv > 255 || b.data.lv + 1 < rpgData.maxLv)) {

		let addMessage = preLevelUpProcess(b.data);

		// レベルアップ処理
		b.data.lv = (b.data.lv ?? 1) + 1;
		let atkUp = (2 + Math.floor(b.rand("levelUp") * 4));
		let totalUp = 7;
		while (b.rand("levelUp") < 0.335) {
			totalUp += 1;
			if (b.rand("levelUp") < 0.5) atkUp += 1;
		}

		if (totalUp > (b.data.maxStatusUp ?? 7)) b.data.maxStatusUp = totalUp;

		if (b.skillEffects.statusBonus && b.skillEffects.statusBonus > 0 && b.data.lv % Math.max(2 / b.skillEffects.statusBonus, 1) === 0) {
			const upBonus = Math.ceil(b.skillEffects.statusBonus / 2);
			for (let i = 0; i < upBonus; i++) {
				totalUp += 1;
				if (b.rand("levelUp") < 0.5) atkUp += 1;
			}
		}

		while (b.data.lv >= 3 && b.data.atk + b.data.def + totalUp < (b.data.lv - 1) * 7) {
			totalUp += 1;
			if (b.rand("levelUp") < 0.5) atkUp += 1;
		}

		b.data.atk = (b.data.atk ?? 0) + atkUp;
		b.data.def = (b.data.def ?? 0) + totalUp - atkUp;
		b.data.exp = 0;

		b.log.add([
			`\n\n${serifs.rpg.lvUp}`,
			`  ${serifs.rpg.status.lv} : ${b.data.lv ?? 1} (+1)`,
			`  ${serifs.rpg.status.atk} : ${b.data.atk ?? 0} (+${atkUp})`,
			`  ${serifs.rpg.status.def} : ${b.data.def ?? 0} (+${totalUp - atkUp})`,
			addMessage,
		].filter(Boolean).join("\n"));

	}

	b.data.raid = false;
	b.msg.friend.setPerModulesData(module_, b.data);

	// 色解禁確認
	const newColorData = colors.map((x) => x.unlock(b.data));
	/** 解禁した色 */
	let unlockColors = "";
	for (let i = 0; i < newColorData.length; i++) {
		if (!b.colorData[i] && newColorData[i]) {
			unlockColors += colors[i].name;
		}
	}
	if (unlockColors) {
		b.log.add(serifs.rpg.newColor(unlockColors));
	}

	let reply;

	if (Number.isNaN(b.totalDmg) || b.totalDmg < 0) {
		reply = await b.msg.reply(`エラーが発生しました。もう一度試してみてください。`, {
			visibility: "specified"
		});
		b.totalDmg = 0;
	} else {
		reply = await b.msg.reply(`<center>${b.log.text.slice(0, 7500)}</center>`, {
			cw: b.cw,
			...(config.rpgReplyVisibility ? {visibility: config.rpgRaidReplyVisibility} : {}),
		});
		let msgCount = 1
		while (b.log.text.length > msgCount * 7500) {
			msgCount += 1;
			await b.msg.reply(`<center>${b.log.text.slice((msgCount - 1) * 7500, msgCount * 7500)}</center>`, {
				cw: b.cw + " " + msgCount,
				...(config.rpgReplyVisibility ? {visibility: config.rpgRaidReplyVisibility} : {}),
			});
		}
	}


	return {
		totalDmg: b.totalDmg,
		me: b.me,
		lv: b.lv,
		count: b.count,
		mark: b.mark,
		skillsStr: b.skillsStr,
		reply,
	};
}

/**
 * 通常レイドの総ダメージを計算する
 *
 * 戦闘型のレイドボス用。ステータス・スキル・乱数に基づきダメージを算出し、投稿して返す。
 *
 * @param msg 参加返信メッセージ
 * @param enemy レイド敵
 * @param raidPostId レイド投稿ID（オプション）
 * @param options 投稿数の固定・乱数の指定など（{@link RaidDamageOptions}）
 * @param options 試算用のオプション（{@link RaidDamageOptions}）
 * @returns { totalDmg, me, lv, count, mark, skillsStr, reply } またはリアクションオブジェクト
 * @internal
 */
export async function getTotalDmg(msg, enemy: RaidEnemy, raidPostId?: string, options: RaidDamageOptions = {}) {
	const b = { msg, enemy, raidPostId, options } as RaidBattle;
	const notReady = await prepareRaidBattle(b);
	if (notReady) return notReady;
	applyPreBattleModifiers(b);
	runRaidTurns(b);
	finishRaidAttacks(b);
	return await recordRaidResult(b);
}
function getSpdX(spd: number) {
	return spd <= 2 ? spd : spd <= 3 ? 2 + (spd - 2) * 0.5 : spd <= 4 ? 2.5 + (spd - 3) * 0.25 : 2.75 + (spd - 4) * 0.125;
}

function getSpd(spdX: number) {
	if (spdX <= 2) return spdX;
	if (spdX <= 2.5) return 2 + (spdX - 2) * 2;
	if (spdX <= 2.75) return 3 + (spdX - 2.5) * 4;
	return 4 + (spdX - 2.75) * 8;
}

// -------- ダメージ計算（パターン2: じゃんけん型） --------

/**
 * じゃんけん型レイドの総ダメージを計算する
 *
 * じゃんけんで勝敗を決めるレイドボス用（pattern: 2）。
 *
 * @param msg 参加返信メッセージ
 * @param enemy レイド敵
 * @param options 乱数の指定など（{@link RaidDamageOptions}）
 * @returns { totalDmg, me, lv, count, mark, skillsStr, reply } またはリアクションオブジェクト
 * @internal
 */
export async function getTotalDmg2(msg, enemy: RaidEnemy, options: RaidDamageOptions = {}) {
	/** 乱数（シードが指定されていれば、同じレイド・同じユーザーで同じ値になる） */
	const rand = options.rng ?? createRaidRandom();
	// データを読み込み
	const data = initializeData(module_, msg);
	if (!data.lv) return {
		reaction: 'confused'
	};
	data.raid = true;
	const colorData = colors.map((x) => x.unlock(data));

	const skillsStr = {skills: "", amulet: ""};

	/** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
	let count = 1;

	/** 使用中の色情報 */
	let color = getColor(data);

	/** 画面に出力するメッセージ:CW */
	let cw = acct(msg.user) + " ";
	/** 画面に出力するメッセージ:Text */
	let message = "";

	/** プレイヤーの見た目 */
	let me = color.name;

	// ステータスを計算
	/** プレイヤーのLv */
	const lv = data.lv ?? 1;

	// 敵の開始メッセージなどを設定
	cw += [
		enemy.msg,
	].filter(Boolean).join(" ");
	message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;

	const maxLv = ai.moduleData.findOne({ type: 'rpg' })?.maxLv ?? 1;

	/** バフを得た数。行数のコントロールに使用 */
	let buff = 0;

	/** プレイヤーの基礎体力 */
	let rawMaxHp = 100 + Math.min(lv * 3, 765) + Math.floor((data.defMedal ?? 0) * 13.4);
	/** プレイヤーのボーナス体力 */
	let bonusMaxHp = 100 + Math.min(maxLv * 3, 765);
	/** プレイヤーの最大HP */
	let playerMaxHp = Math.max(Math.round(bonusMaxHp * rand("maxHp")), rawMaxHp);
	const raidVitalityState = createRaidVitalityState(data);
	playerMaxHp = applyRaidVitalityHp(raidVitalityState, playerMaxHp, rawMaxHp, bonusMaxHp);
	finalizeRaidVitalityHpConsumption(data, raidVitalityState);
	/** プレイヤーのHP */
	let playerHp = (playerMaxHp);

	let totalDmg = 0;

	let dmgup = 0;

	if (aggregateTokensEffects(data).oomisoka && new Date().getMonth() === 11 && new Date().getDate() === 31) {
		message += serifs.rpg.oomisoka + "\n";
		buff += 1;
		playerHp = 1;
		dmgup = 0.25;
	}

	let mark = ":blank:";

	// バフが1つでも付与された場合、改行を追加する
	if (buff > 0) message += "\n";

	const plusActionX = 5;

	let attackCount = 0;
	let drawCount = 0;

	for (let actionX = 0; actionX < plusActionX + 1; actionX++) {

		/** バフを得た数。行数のコントロールに使用 */
		let buff = 0;

		// バフが1つでも付与された場合、改行を追加する
		if (buff > 0) message += "\n";

		let endureCount = 1;

		const _data = { ...data, enemy, count };

		// 自身攻撃の処理

		// じゃんけん型：1/3 で勝ち、勝ち時は attackCount 増加。drawCount で倍率アップ、負け時は被ダメ
		const rnd = rand("janken", count) < (1/3);

		if (count === 1 || rnd) {
			if (rnd) attackCount += 1;
			/** ダメージ：500 × attackCount × (1+dmgup) × 1.5^drawCount、250刻み */
			let dmg = Math.round(Math.round(500 * Math.max(attackCount, 1) * (1 + dmgup) * (1.5 ** drawCount) / 250) * 250);
			drawCount = 0;
			//** クリティカルかどうか */
			let crit = dmg >= 2000;
			// メッセージの出力
			message += (crit ? `**${enemy.atkmsg(dmg)}**` : enemy.atkmsg(dmg)) + "\n";
			totalDmg += dmg;
		} else if (rand("janken.draw", count) < (1/2)) {
			drawCount += 1;
			message += serifs.rpg.draw + "\n";
		} else {
			// 負け：被ダメ（最大HP×95% か 440 の小さい方）
			let dmg = Math.min(Math.floor(playerMaxHp * 0.95), 440);
			playerHp -= dmg;
			message += enemy.defmsg(dmg) + "\n";
		}

		// 食いしばり：HP0 時に endure 確率で HP1 で復活。確率は endureCount で増加、count で減少
		const endure = (0.1 + (endureCount * 0.1)) - (count * 0.05);
		if (playerHp <= 0 && !enemy.notEndure && rand("endure", count) < endure) {
			message += serifs.rpg.endure + "\n";
			playerHp = 1;
			endureCount -= 1;
		}

		// 敗北処理
		if (playerHp <= 0) {
			message += "\n" + enemy.losemsg;
			break;
		} else {
			// 決着がつかない場合
			if (actionX === plusActionX) {
				message += showStatusDmg(_data, playerHp, totalDmg, playerMaxHp, me);
			} else {
				message += showStatusDmg(_data, playerHp, totalDmg, playerMaxHp, me) + "\n\n";
			}
			count = count + 1;
		}
	}

	if (playerHp > 0) {
		attackCount += 1;
		/** ダメージ */
		let dmg = Math.round(Math.round(500 * Math.max(attackCount, 1) * (1 + dmgup) * (1.5 ** drawCount) / 250) * 250);
		if (attackCount >= 7) {
			while (rand("janken.bonus") < (1/3)) {
				dmg += 1000;
			}
		}
		//** クリティカルかどうか */
		let crit = dmg >= 2000;
		// メッセージの出力
		message += "\n\n" + (crit ? `**${enemy.atkmsg(dmg)}**` : enemy.atkmsg(dmg));
		totalDmg += dmg;
		message += "\n\n" + enemy.winmsg;
	}

	message += "\n\n" + serifs.rpg.totalDmg(totalDmg);

	if (!data.raidScore) data.raidScore = {};
	if (!data.raidScore[enemy.name] || data.raidScore[enemy.name] < totalDmg) {
		if (data.raidScore[enemy.name]) {
			message += "\n" + serifs.rpg.hiScore(data.raidScore[enemy.name], totalDmg);
			if (mark === ":blank:") mark = "🆙";
		}
		data.raidScore[enemy.name] = totalDmg;
	} else if (data.raidScore[enemy.name]) {
		message += `\n（これまでのベスト: ${data.raidScore[enemy.name].toLocaleString()}）`;
	}
	if (!data.clearRaid) data.clearRaid = [];
	if (count === 7 && !data.clearRaid.includes(enemy.name)) {
		data.clearRaid.push(enemy.name);
	}

	if (aggregateTokensEffects(data).oomisoka && new Date().getMonth() === 11 && new Date().getDate() === 31) {
		const score = enemy ? Math.max(Math.log2((totalDmg * 20) / (1024 / ((enemy.power ?? 30) / 30))) + 1, 1) : undefined;
		if (score) {
			message += "\n\n" + serifs.rpg.oomisokaEnd(score.toFixed(2), Math.ceil(score * 8));
			data.coin += Math.ceil(score * 8);
		}
	}

	const rpgData = ai.moduleData.findOne({ type: 'rpg' });
	if (data.lv + 1 < rpgData.maxLv) {
		if (data.lv < 254) {
			data.exp = (data.exp ?? 0) + 5;
			message += "\n\n" + serifs.rpg.expPointFast;
		} else {
			data.exp = (data.exp ?? 0) + 1;
			if (data.exp >= 3) {
				message += "\n\n" + serifs.rpg.expPoint(data.exp);
			}
		}
	}

	if (data.exp >= 5 && data.lv !== 254 && (data.lv > 255 || data.lv + 1 < rpgData.maxLv)) {

		let addMessage = preLevelUpProcess(data);

		// レベルアップ処理
		data.lv = (data.lv ?? 1) + 1;
		let atkUp = (2 + Math.floor(rand("levelUp") * 4));
		let totalUp = 7;
		while (rand("levelUp") < 0.335) {
			totalUp += 1;
			if (rand("levelUp") < 0.5) atkUp += 1;
		}

		if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

		while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
			totalUp += 1;
			if (rand("levelUp") < 0.5) atkUp += 1;
		}

		data.atk = (data.atk ?? 0) + atkUp;
		data.def = (data.def ?? 0) + totalUp - atkUp;
		data.exp = 0;

		message += [
			`\n\n${serifs.rpg.lvUp}`,
			`  ${serifs.rpg.status.lv} : ${data.lv ?? 1} (+1)`,
			`  ${serifs.rpg.status.atk} : ${data.atk ?? 0} (+${atkUp})`,
			`  ${serifs.rpg.status.def} : ${data.def ?? 0} (+${totalUp - atkUp})`,
			addMessage,
		].filter(Boolean).join("\n");

	}

	data.raid = false;
	msg.friend.setPerModulesData(module_, data);

	// 色解禁確認
	const newColorData = colors.map((x) => x.unlock(data));
	/** 解禁した色 */
	let unlockColors = "";
	for (let i = 0; i < newColorData.length; i++) {
		if (!colorData[i] && newColorData[i]) {
			unlockColors += colors[i].name;
		}
	}
	if (unlockColors) {
		message += serifs.rpg.newColor(unlockColors);
	}

	let reply;

	if (Number.isNaN(totalDmg) || totalDmg < 0) {
		reply = await msg.reply(`エラーが発生しました。もう一度試してみてください。`, {
			visibility: "specified"
		});
		totalDmg = 0;
	} else {
		reply = await msg.reply(`<center>${message.slice(0, 7500)}</center>`, {
			cw,
			...(config.rpgReplyVisibility ? {visibility: config.rpgRaidReplyVisibility} : {}),
		});
		let msgCount = 1
		while (message.length > msgCount * 7500) {
			msgCount += 1;
			await msg.reply(`<center>${message.slice((msgCount - 1) * 7500, msgCount * 7500)}</center>`, {
				cw: cw + " " + msgCount,
				...(config.rpgReplyVisibility ? {visibility: config.rpgRaidReplyVisibility} : {}),
			});
		}
	}


	return {
		totalDmg,
		me,
		lv,
		count,
		mark,
		skillsStr,
		reply,
	};
}

// -------- ダメージ計算（パターン3: コンテスト型） --------

/**
 * コンテスト型レイドの総ダメージを計算する
 *
 * スコアで競うレイドボス用（pattern: 3）。
 *
 * @param msg 参加返信メッセージ
 * @param enemy レイド敵
 * @param options 乱数の指定など（{@link RaidDamageOptions}）
 * @returns { totalDmg, me, lv, count, mark, skillsStr, reply } またはリアクションオブジェクト
 * @internal
 */
export async function getTotalDmg3(msg, enemy: RaidEnemy, options: RaidDamageOptions = {}) {
	/** 乱数（シードが指定されていれば、同じレイド・同じユーザーで同じ値になる） */
	const rand = options.rng ?? createRaidRandom();
	// データを読み込み
	const data = initializeData(module_, msg);
	if (!data.lv) return {
		reaction: 'confused'
	};
	data.raid = true;
	let verboseLog = false;
	if (msg.includes(['-v'])) verboseLog = true;
	const colorData = colors.map((x) => x.unlock(data));

	// 所持しているスキル効果を読み込み
	let skillEffects: any = aggregateSkillsEffects(data, enemy.skillX ?? 1);

	const stockRandomResult = stockRandom(data, skillEffects, () => rand("stockRandom"));

	skillEffects = stockRandomResult.skillEffects;

	const skillsStr = getSkillsShortName(data);

	/** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
	let count = 1;

	/** 使用中の色情報 */
	let color = getColor(data);

	/** 画面に出力するメッセージ:CW */
	let cw = acct(msg.user) + " ";
	/** 画面に出力するメッセージ:Text */
	let message = "";

	/** プレイヤーの見た目 */
	let me = color.name;

	// ステータスを計算
	/** プレイヤーのLv */
	const lv = data.lv ?? 1;

	// 敵の開始メッセージなどを設定
	cw += [
		me,
		data.lv >= 255 ? "" : `Lv${data.lv}`,
		Math.max(data.atk, data.def) / (data.atk + data.def) * 100 <= 53 ? "" : `${data.atk > data.def ? serifs.rpg.status.atk.slice(0, 1) : serifs.rpg.status.def.slice(0, 1)}${(Math.max(data.atk, data.def) / (data.atk + data.def) * 100).toFixed(0)}%`,
		skillsStr.skills,
		skillsStr.amulet ? `お守り ${skillsStr.amulet}` : undefined
	].filter(Boolean).join(" ");
	message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;

	const maxLv = ai.moduleData.findOne({ type: 'rpg' })?.maxLv ?? 1;

	/** バフを得た数。行数のコントロールに使用 */
	let buff = 0;

	let totalDmg = 0;

	// コンテスト型：器用さ dex でスコアを算出。基本 85 から始まりスキル・経験等で変動
	let dex = 85;
	let fix = 0;

	if (stockRandomResult.activate) {
		message += serifs.rpg.skill.stockRandom + `\n\n`;
	}

	let mark = ":blank:";

	const showInfo = data.lv >= 170;

	// 器用さ・仕上げ（確認表示と同じ計算。contest.ts）
	const contest = computeContestStats(skillEffects, data, !!color.reverseStatus);
	dex = contest.baseDex;

	if (verboseLog) {
		buff += 1;
		message += `基本器用さ: ${dex}\n`;
	}

	// 発動した補正の行と、Lv170 以上なら発動しなかった補正の「なし」などの行を出す
	for (const step of contest.steps) {
		if (!step.active && !showInfo) continue;
		if (step.battleLine === undefined) continue;
		buff += 1;
		message += step.battleLine + `\n`;
	}

	dex = contest.dex;
	fix = contest.fix;

	// バフが1つでも付与された場合、改行を追加する
	if (buff > 0) message += "\n";
	buff = 0;

	if (dex < 150 && rand("contest.dex") < 0.1) {
		buff += 1;
		message += `${config.rpgHeroName}は調子が良さそうだ！\n器用さ+${Math.round((150 - dex) * 0.3)}%！` + `\n`;
		dex += Math.round((150 - dex) * 0.3)
	} else if (fix < 0.75 && rand("contest.fix") < 0.1) {
		buff += 1;
		message += `${config.rpgHeroName}は集中している！\n仕上げ+${Math.round((0.75 - fix) * 0.3 * 100)}%！` + `\n`;
		fix += (0.75 - fix) * 0.3;
	}

	// バフが1つでも付与された場合、改行を追加する
	if (buff > 0) message += "\n";

	if (dex < 3) dex = 3;
	if (fix > 0.75) fix = 0.75;

	if (verboseLog) {
		message += `器用さ: ${Math.round(dex)} 仕上げ: ${Math.round(fix * 100)}\n\n`;
	}

	if (dex > 250) {
		const rndNum = rand("contest.dexCap");
		if (rndNum < 0.1) {
			dex = 250
		} else if (rndNum < 0.9) {
			dex = 250 + (dex - 250) * ((rndNum - 0.1) / 0.8)
		}
	}

	let plus = 0.1;
	let life = dex < 120 ? Math.ceil(15 / (120/dex)) : 15;
	let spFlg = false;

	while (life > 0) {
		if (rand("contest.step") < 0.5) {
			plus += dex < 120 ? 0.2 * (120/dex) : 0.2;
			if (!spFlg && rand("contest.sp") < (0.02 * Math.min(1, 50/dex))) {
				life = 15;
				if (rand("contest.sp") < dex/60) spFlg = true;
			}
		} else {
			life -= 1;
		}
	}

	const score = (dex < 120 ? (40 + dex *(2/3)) / 4 : dex / 4) * plus * (0.97 + (rand("contest.score") * 0.06));
	const roundedScore = Math.round(score * 10) / 10;

	totalDmg = Math.round((100 - 100 * Math.pow(1/2, score/50)) * 10) / 10;

	totalDmg += Math.floor((100 - totalDmg) * fix * 10) / 10;

	let imageMsg = ""

	if (totalDmg < 10) imageMsg = "爆発する"
	else if (totalDmg < 20) imageMsg = "もはやなにかわからない"
	else if (totalDmg < 30) imageMsg = "失敗した"
	else if (totalDmg < 40) imageMsg = "ぐちゃぐちゃの"
	else if (totalDmg < 45) imageMsg = "ぼろぼろの"
	else if (totalDmg < 50) imageMsg = "少しいびつな"
	else if (totalDmg < 55) imageMsg = "頑張って"
	else if (totalDmg < 60) imageMsg = ""
	else if (totalDmg < 65) imageMsg = "まあまあの"
	else if (totalDmg < 70) imageMsg = "すこし整った"
	else if (totalDmg < 75) imageMsg = "バランスが取れた"
	else if (totalDmg < 80) imageMsg = "いい感じの"
	else if (totalDmg < 85) imageMsg = "小綺麗な"
	else if (totalDmg < 90) imageMsg = "しっかりした"
	else if (totalDmg < 95) imageMsg = "細部まで整った"
	else if (totalDmg < 98) imageMsg = "職人顔負けの"
	else if (totalDmg < 99) imageMsg = "非の付け所がない"
	else if (totalDmg < 100) imageMsg = "究極の"
	else imageMsg = "伝説に残るであろう"

	const canShowMasterScore = Math.max(data.raidScore?.[enemy.name] ?? 0, totalDmg) >= 100;
	message += `${imageMsg}鳩車を作って提出した！`;
	if (canShowMasterScore || verboseLog) {
		message += `\n（マスタースコア: ${roundedScore.toFixed(1)}）`;
	}
	message += `\n\n`;

	data.hatogurumaExp = (data.hatogurumaExp ?? 0) + ((100 - totalDmg) / 100)
	data.hatogurumaMaxScore = Math.max(data.hatogurumaMaxScore ?? 0, roundedScore);

	if (!data.raidScore) data.raidScore = {};
	if (!data.raidScore[enemy.name] || data.raidScore[enemy.name] < totalDmg) {
		if (data.raidScore[enemy.name] && Math.floor(data.raidScore[enemy.name]) !== Math.floor(totalDmg)) {
			message += "過去最高の手応えだ！" + `\n\n`;
			if (mark === ":blank:") mark = "🆙";
		}
		data.raidScore[enemy.name] = totalDmg;
	}
	if (!data.clearRaid) data.clearRaid = [];
	if (totalDmg >= 100 && !data.clearRaid.includes(enemy.name)) {
		data.clearRaid.push(enemy.name);
	}

	message += `あとは結果を待つのみ……`;

	const amuletmsg = amuletMinusDurability(data);

	if (amuletmsg) {
		message += "\n\n" + amuletmsg;
	}


	const rpgData = ai.moduleData.findOne({ type: 'rpg' });
	if (data.lv + 1 < rpgData.maxLv) {
		if (data.lv < 254) {
			data.exp = (data.exp ?? 0) + 5;
			message += "\n\n" + serifs.rpg.expPointFast;
		} else {
			data.exp = (data.exp ?? 0) + 1;
			if (data.exp >= 3) {
				message += "\n\n" + serifs.rpg.expPoint(data.exp);
			}
		}
	}

	if (data.exp >= 5 && data.lv !== 254 && (data.lv > 255 || data.lv + 1 < rpgData.maxLv)) {

		let addMessage = preLevelUpProcess(data);

		// レベルアップ処理
		data.lv = (data.lv ?? 1) + 1;
		let atkUp = (2 + Math.floor(rand("levelUp") * 4));
		let totalUp = 7;
		while (rand("levelUp") < 0.335) {
			totalUp += 1;
			if (rand("levelUp") < 0.5) atkUp += 1;
		}

		if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

		while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
			totalUp += 1;
			if (rand("levelUp") < 0.5) atkUp += 1;
		}

		data.atk = (data.atk ?? 0) + atkUp;
		data.def = (data.def ?? 0) + totalUp - atkUp;
		data.exp = 0;

		message += [
			`\n\n${serifs.rpg.lvUp}`,
			`  ${serifs.rpg.status.lv} : ${data.lv ?? 1} (+1)`,
			`  ${serifs.rpg.status.atk} : ${data.atk ?? 0} (+${atkUp})`,
			`  ${serifs.rpg.status.def} : ${data.def ?? 0} (+${totalUp - atkUp})`,
			addMessage,
		].filter(Boolean).join("\n");

	}

	data.raid = false;
	msg.friend.setPerModulesData(module_, data);

	// 色解禁確認
	const newColorData = colors.map((x) => x.unlock(data));
	/** 解禁した色 */
	let unlockColors = "";
	for (let i = 0; i < newColorData.length; i++) {
		if (!colorData[i] && newColorData[i]) {
			unlockColors += colors[i].name;
		}
	}
	if (unlockColors) {
		message += serifs.rpg.newColor(unlockColors);
	}

	let reply;

	if (!Number.isFinite(totalDmg) || Number.isNaN(totalDmg) || totalDmg < 0) {
		console.log(totalDmg);
		reply = await msg.reply(`エラーが発生しました。もう一度試してみてください。`, {
			visibility: "specified"
		});
		totalDmg = 0;
	} else {
		reply = await msg.reply(`<center>${message.slice(0, 7500)}</center>`, {
			cw,
			...(config.rpgReplyVisibility ? {visibility: config.rpgRaidReplyVisibility} : {}),
		});
		let msgCount = 1
		while (message.length > msgCount * 7500) {
			msgCount += 1;
			await msg.reply(`<center>${message.slice((msgCount - 1) * 7500, msgCount * 7500)}</center>`, {
				cw: cw + " " + msgCount,
				...(config.rpgReplyVisibility ? {visibility: config.rpgRaidReplyVisibility} : {}),
			});
		}
	}


	return {
		totalDmg,
		me,
		lv,
		count,
		mark,
		skillsStr,
		reply,
	};
}

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
import rpg from './index';
import { colors } from './colors';
import { endressEnemy, Enemy, RaidEnemy, raidEnemys } from './enemys';
import { rpgItems } from './items';
import { aggregateSkillsEffects, calcSevenFever, amuletMinusDurability, getSkillsShortName, aggregateSkillsEffectsSkillX, countDuplicateSkillNames } from './skills';
import { aggregateTokensEffects } from './shop';
import { initializeData, getColor, getAtkDmg, getEnemyDmg, showStatusDmg, getPostCount, getPostX, getVal, random, getRaidPostX, preLevelUpProcess } from './utils';
import { applyKazutoriMasterHiddenBonus, applyKazutoriMasterPostCountFloor, calculateArpen, calculateStats, ensureKazutoriMasterHistory, fortune, getKazutoriMasterBonus, getKazutoriMasterMessage, stockRandom } from './battle';
import serifs from '@/serifs';
import getDate from '@/utils/get-date';
import { acct } from '@/utils/acct';
import * as seedrandom from 'seedrandom';
import config from '@/config';

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
	});

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

        // 敵の pattern でダメージ計算を分岐：1=通常戦闘、2=じゃんけん型、3=コンテスト型
        let result;
        try {
                if (enemy.pattern && enemy.pattern > 1) {
                        switch (enemy.pattern) {
                                case 2:
                                default:
                                        result = await getTotalDmg2(msg, enemy);
                                        break;
                                case 3:
                                        result = await getTotalDmg3(msg, enemy);
                                        break;
                        }
                } else {
                        result = await getTotalDmg(msg, enemy, raid.postId);
                }
                } catch (err) {
                        module_.log(`レイド参加処理中にエラーが発生しました: ${err instanceof Error ? err.stack ?? err.message : err}`);
                        return {
                                reaction: 'confused'
                        };
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
	module_.log(`damage ${result.totalDmg} by ${msg.user.id}`);

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

	return {
		reaction: result.me
	};
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
 * 通常レイドの総ダメージを計算する
 *
 * 戦闘型のレイドボス用。ステータス・スキル・乱数に基づきダメージを算出し、投稿して返す。
 *
 * @param msg 参加返信メッセージ
 * @param enemy レイド敵
 * @param raidPostId レイド投稿ID（オプション）
 * @returns { totalDmg, me, lv, count, mark, skillsStr, reply } またはリアクションオブジェクト
 * @internal
 */
export async function getTotalDmg(msg, enemy: RaidEnemy, raidPostId?: string) {
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
	let skillEffects;
	if (enemy.skillX) {
		skillEffects = aggregateSkillsEffectsSkillX(data, enemy.skillX);
	} else {
		skillEffects = aggregateSkillsEffects(data);
	}

	const skillsStr = getSkillsShortName(data);

	let amuletGetFlg = false;

	let wakabaFlg = false;

	// Lv20以上でお守り未所持かつ確率（10% + noAmuletCount*5%、最低-18から始まる）でお守り付与
	if (data.lv >= 20) {
		if (data.noAmuletCount === null || data.noAmuletCount === undefined) data.noAmuletCount = 0;
		if (!skillEffects.noAmuletAtkUp && !skillsStr.amulet && Math.random() < 0.1 + ((data.noAmuletCount + 18) * 0.05)) {
			amuletGetFlg = true;
			data.noAmuletCount = -18;
			// スキル2個未満 or（3個未満かつ50%）ならわかばのお守り、それ以外は謎のお守り
			if (data.skills?.length < 2 || (data.skills?.length < 3 && Math.random() < 0.5)) {
				wakabaFlg = true;
				data.items.push({ name: `わかばのお守り`, price: 1, desc: `もこチキの持っているスキルが5個より少ない場合（もこチキのレベルが低い場合）、少ないスキル1つにつき約6%分パワー・防御が上がります 特定条件でさらにパワー・防御が+12%されます 耐久20`, type: "amulet", effect: { beginner: 0.06 }, durability: 20, short: "🔰" });
			} else {
				data.items.push({ name: `謎のお守り`, price: 1, desc: `貰ったお守り。よくわからないが不思議な力を感じる…… 持っていると何かいい事があるかもしれない。`, type: "amulet", effect: { stockRandomEffect: 1 }, durability: 1, short: "？" });
			}
			// スキル効果を再度読み込み
			if (enemy.skillX) {
				skillEffects = aggregateSkillsEffectsSkillX(data, enemy.skillX);
			} else {
				skillEffects = aggregateSkillsEffects(data);
			}
		} else if (!skillEffects.noAmuletAtkUp && !skillsStr.amulet) {
			data.noAmuletCount = (data.noAmuletCount ?? 0) + 1;
		}
	}

	const stockRandomResult = stockRandom(data, skillEffects);

	skillEffects = stockRandomResult.skillEffects;
	ensureKazutoriMasterHistory(ai, msg, skillEffects);
	applyKazutoriMasterHiddenBonus(msg, skillEffects);

	/** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
	let count = 1;

	/** 使用中の色情報 */
	let color = getColor(data);

	/** 覚醒状態か？*/
	const isSuper = Math.random() < (0.02 + Math.max(data.superPoint / 200, 0)) || color.alwaysSuper;

	/** 投稿数（今日と明日の多い方）*/
	let postCount = 0;
	let continuousBonusNum = 0;
	let tp;
	let rawTp;
	let continuousBonusX;

	if (isSuper && aggregateTokensEffects(data).hyperMode) {
		skillEffects.postXUp = (skillEffects.postXUp ?? 0) + 0.005
	}
	const superBonusPost = (isSuper && !aggregateTokensEffects(data).hyperMode ? 200 : 0)
	// 敵が forcePostCount を持っている場合、投稿数は固定
	if (enemy.forcePostCount) {
		postCount = enemy.forcePostCount;
		rawTp = tp;
		tp = getPostX(postCount) * (1 + ((skillEffects.postXUp ?? 0) * Math.min((postCount - superBonusPost) / 20, 10)));
        } else {
                postCount = await getPostCount(ai, module_, data, msg, 0, raidPostId ? { type: 'raid', key: raidPostId } : undefined);
                postCount = applyKazutoriMasterPostCountFloor(postCount, msg, skillEffects);
                postCount += superBonusPost;

		// 連続ボーナス：postCount/2 を 10〜25 にクランプ
		continuousBonusNum = (Math.min(Math.max(10, postCount / 2), 25));

		continuousBonusX = getRaidPostX(postCount + continuousBonusNum) / getRaidPostX(postCount);

		postCount = postCount + continuousBonusNum;

		rawTp = tp;

		tp = getRaidPostX(postCount) * (1 + ((skillEffects.postXUp ?? 0) * Math.min((postCount - superBonusPost) / 20, 10)));
	}

	if (!isSuper) {
		data.superPoint = Math.max((data.superPoint ?? 0) - (tp - 2), -3);
	} else {
		data.superPoint = 0;
	}


	/** 画面に出力するメッセージ:CW */
	let cw = acct(msg.user) + " ";
	/** 画面に出力するメッセージ:Text */
	let message = "";

	/** プレイヤーの見た目 */
	let me = color.name;

	// ステータスを計算
	/** プレイヤーのLv */
	const lv = data.lv ?? 1;
	/** 開始時のチャージ */
	const startCharge = data.charge;

	// 敵情報
	// 敵が消された？？
	if (!enemy) enemy = endressEnemy(data);
	// 敵の開始メッセージなどを設定
	cw += [
		me,
		data.lv >= 255 ? "" : `Lv${data.lv}`,
		Math.max(data.atk, data.def) / (data.atk + data.def) * 100 <= 53 ? "" : `${data.atk > data.def ? serifs.rpg.status.atk.slice(0, 1) : serifs.rpg.status.def.slice(0, 1)}${(Math.max(data.atk, data.def) / (data.atk + data.def) * 100).toFixed(0)}%`,
		skillsStr.skills,
		skillsStr.amulet ? `お守り ${skillsStr.amulet}` : undefined
	].filter(Boolean).join(" ");
	message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;
	const kazutoriMasterMessage = getKazutoriMasterMessage(msg, skillEffects);
	if (kazutoriMasterMessage) {
		message += `${kazutoriMasterMessage}\n\n`;
	}

	const maxLv = ai.moduleData.findOne({ type: 'rpg' })?.maxLv ?? 1;

	/** バフを得た数。行数のコントロールに使用 */
	let buff = 0;

	if (amuletGetFlg) {
		message += serifs.rpg.giveAmulet + `\n\n`;
		skillsStr.amulet = wakabaFlg ? '[🔰]' : `[？]`;
	}

	if (enemy.skillX && lv >= 20) {
		message += serifs.rpg.skillX(enemy.skillX) + `\n\n`;
	}

	if (stockRandomResult.activate) {
		message += serifs.rpg.skill.stockRandom + `\n\n`;
		skillsStr.amulet = `[${stockRandomResult.activateStr}]`;
	}

	if (enemy.forcePostCount) {
		buff += 1;
		message += serifs.rpg.forcePostCount + `\n`;
		if (aggregateTokensEffects(data).showPostBonus) {
			buff += 1;
			message += serifs.rpg.postBonusInfo.post(postCount, tp > 1 ? "+" + Math.floor((tp - 1) * 100) : Math.floor((tp - 1) * 100)) + `\n`;
			if (verboseLog && continuousBonusX >= 1.01) message += "連スキル効果: AD+" + Math.ceil(continuousBonusX * 100 - 100) + '%\n';
			if (verboseLog && tp - rawTp >= 0.01) message += "投スキル効果: AD+" + Math.ceil(tp / rawTp * 100 - 100) + '%\n';
		}
	} else {
		if (aggregateTokensEffects(data).showPostBonus) {
			buff += 1;
			if (continuousBonusNum) message += serifs.rpg.postBonusInfo.continuous.a(Math.floor(continuousBonusNum)) + `\n`;
			if (isSuper && !aggregateTokensEffects(data).hyperMode) {
				message += serifs.rpg.postBonusInfo.super + `\n`;
			}
			message += serifs.rpg.postBonusInfo.post(postCount, tp > 1 ? "+" + Math.floor((tp - 1) * 100) : (tp !== 1 ? "-" : "") + Math.floor((tp - 1) * 100)) + `\n`;
			if (verboseLog && continuousBonusX >= 1.01) message += "連スキル効果: AD+" + Math.ceil(continuousBonusX * 100 - 100) + '%\n';
			if (verboseLog && tp - rawTp >= 0.01) message += "投スキル効果: AD+" + Math.ceil(tp / rawTp * 100 - 100) + '%\n';
		}
	}

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

	// ここで残りのステータスを計算しなおす
	let { atk, def, spd } = calculateStats(data, msg, skillEffects, color, 0.2);

	if (verboseLog) {
		buff += 1;
		message += `ステータス: \nA: ${formatNumber(atk)} (x${formatNumber(atk / (lv * 3.5))})\nD: ${formatNumber(def)} (x${formatNumber(def / (lv * 3.5))})\nS: ${formatNumber(spd)} (${getSpdX(spd) * 100}%)\n`;
	}

	// 敵のステータスを計算
	/** 敵の攻撃力 */
	let enemyAtk = (typeof enemy.atk === "function") ? enemy.atk(atk, def, spd) : lv * 3.5 * (enemy.atk ?? 1);
	/** 敵の防御力 */
	let enemyDef = (typeof enemy.def === "function") ? enemy.def(atk, def, spd) : lv * 3.5 * (enemy.def ?? 1);

	if (verboseLog) {
		buff += 1;
		message += `敵ステータス: \nA: x${formatNumber(enemyAtk / (lv * 3.5))} D: x${formatNumber(enemyDef / (lv * 3.5))} \n`;
	}

	if (skillEffects.fortuneEffect || aggregateTokensEffects(data).fortuneEffect) {
		const result = fortune(atk, def, skillEffects.fortuneEffect);
		atk = result.atk;
		def = result.def;
		if (skillEffects.fortuneEffect) {
			message += serifs.rpg.skill.fortune + `\n`;
		} else {
			message += serifs.rpg.skill.fortuneToken + `\n`;
		}
		message += result.message + `\n`;
	}
	// 調子補正（天国か地獄か）：土日/在庫ランダム/数取り得意曜日固定なら 1.0、それ以外は曜日+週でシードした乱数（0〜1.0）+ 1%で+0.3×2
	const day = new Date().getDay();
	const kazutoriMasterBonus = getKazutoriMasterBonus(msg, skillEffects);
	let bonusX = (day === 6 || day === 0 || stockRandomResult.activate || kazutoriMasterBonus.raidBonusFixed ? 1 : (Math.floor(seedrandom("" + msg.user.id + Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) + ai.account.id)() * 5 + day) % 5) * 0.25) + (Math.random() < 0.01 ? 0.3 : 0) + (Math.random() < 0.01 ? 0.3 : 0);
	// 1%でさらに +0.3 を加算（複数回当たる可能性あり）
	while (Math.random() < 0.01) {
		bonusX += 0.3;
	}
	atk = Math.round(atk * (0.75 + bonusX));
	def = Math.round(def * (0.75 + bonusX));
	if (verboseLog) {
		buff += 1;
		message += `調子補正: AD${displayDifference((0.75 + bonusX))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
	}

	if (false && data.raidAdjust > 0 && bonusX < 1 && skillEffects.pride) {
		if (Math.random() < 0.8) {
			atk = Math.round(atk * (1 / (1 + (data.raidAdjust * 0.0005))));
			def = Math.round(def * (1 / (1 + (data.raidAdjust * 0.0005))));
			if (verboseLog) {
				buff += 1;
				message += `連勝補正: AD${displayDifference((1 / (1 + (data.raidAdjust * 0.0005))))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
			}
		}
	} else {
		if (false && data.raidAdjust > 0 && bonusX < 1 && Math.random() < 0.9) {
			atk = Math.round(atk * (1 / (1 + (data.raidAdjust * 0.001))));
			def = Math.round(def * (1 / (1 + (data.raidAdjust * 0.001))));
			if (verboseLog) {
				buff += 1;
				message += `連勝補正: AD${displayDifference((1 / (1 + (data.raidAdjust * 0.001))))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
			}
		}
	}

	// 魔法処理の為の関数
	const checkMagic = (phase: string, argTriggerData: Record<string, unknown> = {}) => {
		if (!data?.magic) return;

		const triggerData = {
			atk,
			def,
			spd,
			eAtk: enemyAtk,
			eDef: enemyDef,
			hp: playerHp,
			hpp: playerHpPercent,
			debuff: enemy?.fire,
			predictedDmg: (argTriggerData?.predictedDmg) ?? 0,
		};

		const useMagics = data.magic.filter((m) => m.phase === phase && (m.trigger(triggerData) || Math.random() < 0.08));

		for (const magic of useMagics) {
			message += `「${magic.name}」の魔法を唱えた！\n`;
			if (verboseLog) {
				message += `　効果詳細:\n`;
			}

			for (const effect in magic.effect) {
				const val = magic.effect[effect];

				switch (effect) {
					case "trueDmg":
						if (verboseLog) {
							message += `　　貫通ダメージ: ${val}\n`;
						}
						message += enemy.atkmsg(val) + "\n";
						totalDmg += val;
						break;
					case "eAtkX":
						if (verboseLog) {
							message += `　　敵攻撃補正: ${val}\n`;
						}
						enemyAtk *= val;
						break;
					case "freeze":
						if (verboseLog) {
							message += `　　凍結率: ${val}\n`;
						}
						enemyTurnFinished = true;
						break;
					case "eDmgX":
						if (verboseLog) {
							message += `　　敵攻撃補正: ${val}\n`;
						}
						enemyAtkX *= val;
						break;
					case "dmg":
						const dmg = getAtkDmg(data, val, tp, 1, false, enemyDef, enemyMaxHp, 1, getVal(enemy.defx, [count]));
						message += enemy.atkmsg(dmg) + "\n";
						totalDmg += dmg;
						break;
					case "spd":
						if (verboseLog) {
							message += `　　速度増加: ${val}\n`;
						}
						spd += val;
						break;
					case "turnPlus":
						if (verboseLog) {
							message += `　　ターン増加: ${val}\n`;
						}
						plusActionX += val;
						break;
					case "fixedCrit":
						if (verboseLog) {
							message += `　　クリティカル増加: ${val}\n`;
						}
						skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + val;
						break;
					case "cleanse":
						if (verboseLog) {
							message += `　　デバフ解除\n`;
						}
						enemy.fire = 0;
						break;
					case "itemGet":
						if (verboseLog) {
							message += `　　アイテム確定\n`;
						}
						itemBoost = val;
						break;
					case "minEffect":
						if (verboseLog) {
							message += `　　最低効果量: ${val}\n`;
						}
						itemMinEffect = val;
						break;
					case "atkUp":
						if (verboseLog) {
							message += `　　パワーアップ: ${val}\n`;
						}
						atk *= (1 + val);
						break;
					case "defUp":
						if (verboseLog) {
							message += `　　防御アップ: ${val}\n`;
						}
						def *= (1 + val);
						break;
					case "heal":
						if (verboseLog) {
							message += `　　回復: ${val}\n`;
						}
						{
							const recovered = recoverHpOrBarrier(Math.min(Math.round(playerMaxHp * val), playerMaxHp - playerHp));
							if (recovered.barrier > 0) message += `${Math.floor(recovered.barrier)}ポイントのバリアを獲得！\n`;
						}
						break;
					case "barrier":
						if (verboseLog) {
							message += `　　バリア: ${val}\n`;
						}
						{
							const recovered = recoverHpOrBarrier(Math.round(playerMaxHp * val));
							if (recovered.barrier > 0) message += `${Math.floor(recovered.barrier)}ポイントのバリアを獲得！\n`;
						}
						break;
					default:
						console.warn(`Unknown effect: ${effect}`);
				}
			}
		}
	};

	/** 敵の最大HP */
	let enemyMaxHp = 100000;
	/** 敵のHP */
	let enemyHp = 100000;
	/** 連続攻撃中断の場合の攻撃可能回数 0は最後まで攻撃 */
	let abort = 0;
	/** プレイヤーの基礎体力 */
	let rawMaxHp = 100 + Math.min(lv * 3, 765) + Math.floor((data.defMedal ?? 0) * 13.4);
	/** プレイヤーのボーナス体力 */
	let bonusMaxHp = 100 + Math.min(maxLv * 3, 765);
	/** プレイヤーの最大HP */
	let playerMaxHp = Math.max(Math.round(bonusMaxHp * Math.random()), rawMaxHp);
	/** プレイヤーのHP */
	let playerHp = (playerMaxHp);
	/** プレイヤーのHP割合 */
	let playerHpPercent = playerHp / (playerMaxHp);
	/** 敵のHP割合 */
	let enemyHpPercent = 1;
	/** 使用したアイテム */
	let item;
	/** 使用したアイテム2 */
	let item2;
	/** アイテムによって増加したステータス */
	let itemBonus = { atk: 0, def: 0 };
	let enemyAtkX = 1;
	let itemBoost = 0;
	let itemMinEffect = 0;
	let atkDmgBonus = 1;
	let sevenFeverBarrier = 0;
	let fireStack = 0;
	const additionalStatuses: RaidAdditionalStatus[] = [];
	const addBarrier = (value: number) => {
		if (value <= 0) return 0;
		sevenFeverBarrier += value;
		const barrierStatus = additionalStatuses.find((status) => status.icon === "🛡️");
		if (barrierStatus) {
			barrierStatus.value = sevenFeverBarrier;
		} else {
			additionalStatuses.push({ icon: "🛡️", value: sevenFeverBarrier });
		}
		return value;
	};
	const recoverHpOrBarrier = (healValue: number) => {
		if (healValue <= 0) return { healed: 0, barrier: 0 };
		if (!skillEffects.transcendence) {
			playerHp += healValue;
			return { healed: healValue, barrier: 0 };
		}
		let remain = healValue;
		let healed = 0;
		if (playerHp < 1) {
			const toOne = Math.min(remain, 1 - playerHp);
			playerHp += toOne;
			healed += toOne;
			remain -= toOne;
		}
		const barrier = remain > 0 ? addBarrier(remain) : 0;
		return { healed, barrier };
	};
	let itemAtkStock = 0;
	let itemAtkStockNext = 0;

	/** これって戦闘？ */
	let isBattle = enemy.atkmsg(0).includes("ダメージ");

	/** これって物理戦闘？ */
	let isPhysical = !enemy.atkmsg(0).includes("精神");

	/** ダメージ発生源は疲れ？ */
	let isTired = enemy.defmsg(0).includes("疲");

	if (verboseLog && (isBattle || isPhysical || isTired)) {
		buff += 1;
		message += `属性: ${[isBattle ? "戦闘" : "", isPhysical ? "物理" : "", isTired ? "疲れ" : ""].filter(Boolean).join(", ")}\n`;
	}

	let totalDmg = 0;

	if (skillEffects.wrath) {
		playerHp = Math.round(playerHp / 2);
		skillEffects.critDmgUp = (skillEffects.critDmgUp ?? 0) + 0.4;
	}

	if (aggregateTokensEffects(data).oomisoka && new Date().getMonth() === 11 && new Date().getDate() === 31) {
		message += serifs.rpg.oomisoka + "\n";
		buff += 1;
		playerHp = 1;
		atk = atk * 1.119;
		skillEffects.atkDmgUp = ((1 + (skillEffects.atkDmgUp ?? 0)) * 1.118) - 1;
		if (verboseLog) {
			buff += 1;
			message += `おおみそか: A+11.9% ADmg+11.8% (${formatNumber(atk)} / ${formatNumber(skillEffects.atkDmgUp * 100)}%)\n`;
		}
	}

	if (isSuper) {
		const up = Math.max(spd + 2, Math.round(getSpd(getSpdX(spd) * 1.2))) - spd;
		if (!color.alwaysSuper) {
			// バフが1つでも付与された場合、改行を追加する
			if (buff > 0) message += "\n";
			const superColor = colors.find((x) => x.alwaysSuper)?.name ?? colors.find((x) => x.default)?.name ?? colors[0]?.name;
			buff += 1;
			me = superColor;
			if (!aggregateTokensEffects(data).notSuperSpeedUp) message += serifs.rpg.super(me, up) + `\n`;
		}
		let customStr = ""
		if (!aggregateTokensEffects(data).hyperMode) {
			customStr += "パワー・防御が**超**アップ！"
		} else {
			customStr += "投稿数による能力上昇量がアップ！"
		}
		if (!aggregateTokensEffects(data).notSuperSpeedUp) {
			spd = spd + up;
			if (verboseLog) {
				buff += 1;
				message += `覚醒: S+${up} (${formatNumber(spd)} (${getSpdX(spd) * 100}%))\n`;
			}
		}
		if (aggregateTokensEffects(data).redMode) {
			skillEffects.critUpFixed = (skillEffects.critUpFixed ?? 0) + 0.08
			skillEffects.critDmgUp = Math.max((skillEffects.critDmgUp ?? 0), 0.35)
			if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`クリティカル性能アップ！\n${customStr}`) + `\n`;
			data.superCount = (data.superCount ?? 0) + 1;
			if (verboseLog) {
				buff += 1;
				message += `朱覚醒: クリ率固定+8% クリダメ+35%\n(${formatNumber(skillEffects.critUpFixed * 100)}% / ${formatNumber(skillEffects.atkDmgUp * 100)}%)`;
			}
		} else if (aggregateTokensEffects(data).blueMode) {
			skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.2
			if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`ダメージカット+20%！\n${customStr}`) + `\n`;
			if (verboseLog) {
				buff += 1;
				message += `蒼覚醒: 被ダメージ-20% (${formatNumber(skillEffects.defDmgUp * 100)}%)\n`;
			}
		} else if (aggregateTokensEffects(data).yellowMode) {
			const up = Math.max(spd + 1, Math.round(getSpd(getSpdX(spd) * 1.1))) - spd;
			spd = spd + up;
			skillEffects.defDmgUp = (skillEffects.defDmgUp ?? 0) - 0.1
			if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`行動回数+${up}！\nダメージカット+10%！\n${customStr}`) + `\n`;
			if (verboseLog) {
				buff += 1;
				message += `橙覚醒: S+${up} 被ダメージ-10%\n(${formatNumber(spd)} (${getSpdX(spd) * 100}%) / ${formatNumber(skillEffects.defDmgUp * 100)}%)\n`;
			}
		} else if (aggregateTokensEffects(data).greenMode) {
			skillEffects.itemEquip = ((1 + (skillEffects.itemEquip ?? 0)) * 1.15) - 1;
			skillEffects.itemBoost = ((1 + (skillEffects.itemBoost ?? 0)) * 1.15) - 1;
			skillEffects.mindMinusAvoid = ((1 + (skillEffects.mindMinusAvoid ?? 0)) * 1.15) - 1;
			skillEffects.poisonAvoid = ((1 + (skillEffects.poisonAvoid ?? 0)) * 1.15) - 1;
			if (!color.alwaysSuper) message += serifs.rpg.customSuper(me,`全アイテム効果+15%！\n${customStr}`) + `\n`;
			if (verboseLog) {
				buff += 1;
				message += `翠覚醒: アイテム効果+15%\n(${formatNumber(skillEffects.itemEquip * 100)}% / ${formatNumber(skillEffects.itemBoost * 100)}% / ${formatNumber(skillEffects.mindMinusAvoid * 100)}% / ${formatNumber(skillEffects.poisonAvoid * 100)}%)\n`;
			}
		}
	}

	let mark = ":blank:";
	let warriorFlg = false;
	let warriorTotalDmg = 0;
	let warriorCritX = 2;

	// 戦士マーク：物理戦闘かつ非疲労かつ、確率（2% + レベル差×1%/10Lv）で付与
	if (!enemy.skillX && (isBattle && isPhysical && !isTired) && Math.random() < 0.02 + (Math.max(Math.floor((Math.min(maxLv, 170) - lv) / 10), 0) * 0.01)) {
		warriorFlg = true;
		if (buff > 0) message += "\n";
		buff = 0;
		message += serifs.rpg.warrior.get + `\n\n`;
		mark = ":mk_warrior:";
	}

	checkMagic("Start");

	// 天国か地獄か：60%で天国（ADアップ）、40%で地獄（ADダウン）
	if (skillEffects.heavenOrHell) {
		if (Math.random() < 0.6) {
			message += serifs.rpg.skill.heaven + "\n";
			buff += 1;
			atk = atk * (1 + skillEffects.heavenOrHell);
			def = def * (1 + (skillEffects.heavenOrHell * 1.5));
			if (verboseLog) {
				buff += 1;
				message += `天スキル効果: A${displayDifference((1 + skillEffects.heavenOrHell))} D${displayDifference((1 + (skillEffects.heavenOrHell * 1.5)))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
			}
		} else {
			message += serifs.rpg.skill.hell + "\n";
			buff += 1;
			atk = atk / (1 + skillEffects.heavenOrHell);
			def = def / (1 + (skillEffects.heavenOrHell * 0.75)) ;
			if (verboseLog) {
				buff += 1;
				message += `地スキル効果: A${displayDifference(1 / (1 + skillEffects.heavenOrHell))} D${displayDifference((1 + (skillEffects.heavenOrHell * 0.75)))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
			}
		}
	}

	// ７フィーバー
	let sevenFever = skillEffects.sevenFever ? calcSevenFever([data.lv, data.atk, data.def]) * skillEffects.sevenFever : 0;
	if (enemy.fire) {
		additionalStatuses.push({ icon: serifs.rpg.fire, value: fireStack });
	}
	if (sevenFever) {
		const defBonus = 7 * (skillEffects.sevenFever ?? 1);
		addBarrier(normalizeSevenFeverBarrierGain(sevenFever));
		buff += 1;
		message += serifs.rpg.skill.sevenFeverRaid(Math.floor(sevenFeverBarrier)) + "\n";
		def = Math.ceil(def * (1 + (defBonus / 100)) / 7) * 7;
		if (verboseLog) {
			buff += 1;
			message += `７スキル効果: D${displayDifference((1 + (defBonus / 100)))} / バリア+${Math.floor(sevenFeverBarrier)} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
		}
	}
	if (skillEffects.charge && verboseLog) {
		additionalStatuses.push({ icon: "🍀", value: data.charge });
	}
	if (skillEffects.pride || skillEffects.gluttony || skillEffects.sloth) {
		additionalStatuses.push({ icon: "🔺", value: 0 });
	}

	// 風魔法：戦闘時は速度を上げる、非戦闘時は速度ではなくパワーに還元
	let spdUp = getSpd(getSpdX(spd) * (1 + (skillEffects.spdUp ?? 0))) - getSpd(getSpdX(spd));
	if (Math.random() < spdUp % 1) {
		spdUp = Math.floor(spdUp) + 1;
	} else {
		spdUp = Math.floor(spdUp);
	}
	if ((isBattle && isPhysical) && spdUp) {
		buff += 1;
		message += serifs.rpg.skill.wind(spdUp) + "\n";
		spd = spd + spdUp;
		if (verboseLog) {
			buff += 1;
			message += `風戦闘: S+${spdUp} (${formatNumber(spd)} (${getSpdX(spd) * 100}%))\n`;
		}
	} else if (!(isBattle && isPhysical)) {
		// 非戦闘時は速度は上がらないが、パワーに還元される
		atk = atk * (1 + (skillEffects.spdUp ?? 0));
		if (verboseLog) {
			buff += 1;
			message += `風非戦闘: A${displayDifference(1 + (skillEffects.spdUp ?? 0))} (${formatNumber(atk)})\n`;
		}
	}

	// 非戦闘なら非戦闘時スキルが発動
	if (!isBattle) {
		atk = atk * (1 + (skillEffects.notBattleBonusAtk ?? 0));
		if (verboseLog && skillEffects.notBattleBonusAtk) {
			buff += 1;
			message += `非戦闘: A${displayDifference(1 + (skillEffects.notBattleBonusAtk ?? 0))} (${formatNumber(atk)})\n`;
		}
	}
	if (isTired) {
		def = def * (1 + (skillEffects.notBattleBonusDef ?? 0));
		if (verboseLog && skillEffects.notBattleBonusDef) {
			buff += 1;
			message += `疲スキル効果: D${displayDifference(1 + (skillEffects.notBattleBonusDef ?? 0))} (${formatNumber(def)})\n`;
		}
	}

	if (skillEffects.enemyStatusBonus) {
		const enemyStrongs = Math.min((enemyAtk / (lv * 3.5)) * (getVal(enemy.atkx, [3]) ?? 3) + (enemyDef / (lv * 3.5)) * (getVal(enemy.defx, [3]) ?? 3), 40);
		const bonus = Math.floor((enemyStrongs / 4) * skillEffects.enemyStatusBonus);
		atk = atk * (1 + (bonus / 100));
		def = def * (1 + (bonus / 100));
		if (bonus / skillEffects.enemyStatusBonus >= 5) {
			buff += 1;
			message += serifs.rpg.skill.enemyStatusBonus + "\n";
		}
		if (verboseLog && bonus >= 1) {
			buff += 1;
			message += `強スキル効果: AD${displayDifference(1 + (bonus / 100))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
		}
	}

	if (skillEffects.firstTurnResist && count === 1 && isBattle && isPhysical) {
		buff += 1;
		message += serifs.rpg.skill.firstTurnResist + "\n";
		if (verboseLog) {
			buff += 1;
			message += `断スキル効果: 被ダメージ${displayDifference(1 - skillEffects.firstTurnResist)}\n`;
		}
	}

	const arpenX = calculateArpen(data, (skillEffects.arpen ?? 0), enemyDef)
	atk = atk * arpenX;
	if (verboseLog && arpenX > 1) {
		buff += 1;
		message += `貫スキル効果: A${displayDifference(arpenX)}\n`;
	}

	// バフが1つでも付与された場合、改行を追加する
	if (buff > 0) message += "\n";

	if (skillEffects.plusActionX) {
		atk = atk * (1 + (skillEffects.plusActionX ?? 0) / 10);
		if (verboseLog) {
			buff += 1;
			message += `速スキル効果: A${displayDifference((1 + (skillEffects.plusActionX ?? 0) / 10))} (${formatNumber(atk)})\n`;
		}
	}

	if (skillEffects.enemyCritDmgDown) {
		def = def * (1 + (skillEffects.enemyCritDmgDown ?? 0) / 30);
		if (verboseLog) {
			buff += 1;
			message += `守スキル効果: D${displayDifference((1 + (skillEffects.enemyCritDmgDown ?? 0) / 30))} (${formatNumber(def)})\n`;
		}
	}
	if (skillEffects.enemyBuff) {
		atk = atk * (1 + (skillEffects.enemyBuff ?? 0) / 20);
		def = def * (1 + (skillEffects.enemyBuff ?? 0) / 20);
		if (verboseLog) {
			buff += 1;
			message += `お守り効果: AD${displayDifference((1 + (skillEffects.enemyBuff ?? 0) / 20))} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
		}
	}

	let _atk = atk;
	const _def = def;
	const _spd = spd;
	const _enemyAtk = enemyAtk;
	const _enemyDef = enemyDef;

	/** 敵のターンが既に完了したかのフラグ */
	let enemyTurnFinished = false;

	let plusActionX = 5;

	let totalResistDmg = 0;
	let transcendenceActivated = false;
	const canAccessBackShop = ((!msg.user.host && msg.user.username === config.master) || data.items.filter((x) => x.name === "裏ショップ入場の札").length > 0);

	if (skillEffects.transcendence && playerHp > 1) {
		const convertedHp = playerHp - 1;
		playerHp = 1;
		addBarrier(convertedHp);
		transcendenceActivated = true;
		buff += 1;
		message += `超越のお守りが発動した！\n体力${Math.floor(convertedHp)}ポイントがバリアに変換された！\n`;
	}

	for (let actionX = 0; actionX < plusActionX + 1; actionX++) {

		/** バフを得た数。行数のコントロールに使用 */
		let buff = 0;

		/** プレイヤーのHP割合 */
		let playerHpPercent = playerHp / (playerMaxHp);
		/** 敵のHP割合 */
		let enemyHpPercent = 0.5 + 0.5 * ((6 - (count - 1)) / 6);

		if (skillEffects.tenacious && playerHpPercent < 0.5 && isBattle && isPhysical) {
			buff += 1;
			message += serifs.rpg.skill.tenacious + "\n";

			if (verboseLog) {
				buff += 1;
				message += `粘スキル効果: 被ダメージ${displayDifference((1 - Math.min((skillEffects.tenacious ?? 0) * (1 - playerHpPercent), 0.9)))}\n`;
			}
		}

		item = undefined;
		item2 = undefined;
		atk = _atk;
		def = _def;
		spd = _spd;
		enemyAtk = _enemyAtk;
		enemyDef = _enemyDef;
		itemBonus = { atk: 0, def: 0 };
		enemyTurnFinished = false;
		enemyAtkX = 1;
		itemBoost = 0;
		itemMinEffect = 0;

		if (skillEffects.itemAtkStock && itemAtkStockNext > 0) {
			const itemAtkStockGain = Math.floor(itemAtkStockNext);
			if (itemAtkStockGain > 0) {
				itemAtkStock += itemAtkStockGain;
				buff += 1;
				const itemAtkStockRate = Math.max(itemAtkStock / (lv * 3.5), 0);
				if (verboseLog) {
					message += `継スキル: 累積+${itemAtkStockGain} (${Math.floor(itemAtkStockRate * 100)}%)\n`;
				} else {
					message += serifs.rpg.skill.itemAtkStock(itemAtkStockRate) + "\n";
				}
			}
			itemAtkStockNext = 0;
		}
		if (skillEffects.itemAtkStock && itemAtkStock > 0) {
			atk += itemAtkStock;
		}

		if (verboseLog) {
			buff += 1;
			message += `ターン開始時ステータス:\nA: ${formatNumber(atk)} (x${formatNumber(atk / (lv * 3.5))})\nD: ${formatNumber(def)} (x${formatNumber(def / (lv * 3.5))})\nS: ${formatNumber(spd)} (${getSpdX(spd) * 100}%)\nHP%: ${formatNumber(playerHpPercent * 100)}%\n${atkDmgBonus > 1 ? `Dmg: ${displayDifference(atkDmgBonus)}\n` : ""}ターン開始時敵ステータス:\nA: x${formatNumber(enemyAtk / (lv * 3.5))} D: x${formatNumber(enemyDef / (lv * 3.5))} \nHP%: ${
formatNumber(enemyHpPercent * 100)}%\n\n`;
		}

		let slothFlg = false;

		if (skillEffects.sloth && Math.random() < 0.3) {
			atkDmgBonus *= 1.5;
			atk = Math.ceil(atk * 0.001);
			buff += 1;
			message += "怠惰が発動した！このターンは力がでない！\n";
			slothFlg = true;
			if (verboseLog) message += `怠惰: A-99.9% (${formatNumber(atk)})\n`;
		}

		checkMagic("TurnStart");

		if (skillEffects.slowStart) {
			const n = (skillEffects.slowStart ?? 0)
			const increment = (600 + 45 * n - 6 * (57.5 - 7.5 * n)) / 15;
			atk = atk * (((60 - 10 * n) + (increment * (count - 1))) / 100);
			def = def * (((60 - 10 * n) + (increment * (count - 1))) / 100);
			if (verboseLog) {
				buff += 1;
				message += `お守り効果: AD${displayDifference(((60 - 10 * n) + (increment * (count - 1))) / 100)} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
			}
		}

		if (skillEffects.berserk) {
			const berserkDmg = Math.min(Math.floor((playerMaxHp * Math.min(playerHpPercent * 2, 1)) * (skillEffects.berserk ?? 0)), playerHp - 1);
			playerHp -= berserkDmg;
			playerHpPercent = playerHp / (playerMaxHp);
			if (berserkDmg > 0) {
				atk = atk * (1 + (skillEffects.berserk ?? 0) * 1.6);
				buff += 1;
				message += serifs.rpg.skill.berserk(berserkDmg) + "\n";
			}
			if (verboseLog) {
				buff += 1;
				message += `お守り効果: A${displayDifference((1 + (skillEffects.berserk ?? 0) * 1.6))} (${formatNumber(atk)})\n`;
			}
		}

		if (skillEffects.guardAtkUp && totalResistDmg >= 300) {
			buff += 1;
			totalResistDmg = Math.min(totalResistDmg, 1200)
			const guardAtkUpX = [0, 1, 2.4, 4.8, 8, 8];
			message += serifs.rpg.skill.guardAtkUp(Math.floor(totalResistDmg / 300)) + "\n";
			atk += (def * (skillEffects.guardAtkUp * guardAtkUpX[Math.floor(totalResistDmg / 300)]));
			if (verboseLog) {
				buff += 1;
				message += `勢スキル状態: ${Math.floor(totalResistDmg)} / 1200\n`;
				message += `勢スキル効果: A+${formatNumber(def * (skillEffects.guardAtkUp * guardAtkUpX[Math.floor(totalResistDmg / 300)]))} (${formatNumber(atk)})\n`;
			}
		}

		// 毒属性剣攻撃
		if (skillEffects.weak && count > 1) {
			if (isBattle && isPhysical) {
				buff += 1;
				message += serifs.rpg.skill.weak(enemy.dname ?? enemy.name) + "\n";
			}
			const weakXList = [0, 0.25, 0.5, 1, 1.5, 3.5, 4, 4.5, 5];
			const weakX = 1 - (1 / (1 + ((skillEffects.weak * weakXList[count - 1]))))
			enemyAtk -= Math.max(enemyAtk * weakX, atk * weakX);
			const arpenX = calculateArpen(data, skillEffects.weak * weakXList[count - 1], enemyDef)
			atk = atk * arpenX;
			if (enemyAtk < 0) enemyAtk = 0;
			if (verboseLog) {
				buff += 1;
				message += `毒スキル効果: ${displayDifference(1 - weakX)} (x${formatNumber(enemyAtk / (lv * 3.5))} / x${formatNumber(enemyDef / (lv * 3.5))})\n`;
			}
		}

		// spdが低い場合、確率でspdが+1。
		if (!slothFlg) {
			if (spd === 2 && Math.random() < 0.2) {
				buff += 1;
				message += serifs.rpg.spdUp + "\n";
				spd = 3;
			}
			if (spd === 1 && Math.random() < 0.6) {
				buff += 1;
				message += serifs.rpg.spdUp + "\n";
				spd = 2;
			}
		}

		if (!enemy.abort && skillEffects.abortDown) {
			// 効果がない場合は、パワーに還元される
			atk = atk * (1 + skillEffects.abortDown * (1 / 3));
			if (verboseLog) {
				buff += 1;
				message += `遂スキル効果: A${displayDifference(1 + skillEffects.abortDown * (1 / 3))} (${formatNumber(atk)})\n`;
			}
		}

	// 敵に最大ダメージ制限がある場合、ここで計算
	/** 1ターンに与えられる最大ダメージ量 */
	let maxdmg = enemy.maxdmg ? enemyMaxHp * enemy.maxdmg : undefined;

	if (skillEffects.dart && !(isBattle && isPhysical && maxdmg)) {
			// 効果がない場合非戦闘時は、パワーに還元される
			atk = atk * (1 + skillEffects.dart * 0.5);
			if (verboseLog) {
				buff += 1;
				message += `土スキル効果: A${displayDifference(1 + skillEffects.dart * 0.5)} (${formatNumber(atk)})\n`;
			}
		}

		let dmgUp = 1;
		let critUp = 0;

		// HPが1/7以下で相手とのHP差がかなりある場合、決死の覚悟のバフを得る
		const notLastPowerActive = aggregateTokensEffects(data).notLastPower || (transcendenceActivated && !canAccessBackShop);
		if (!notLastPowerActive && !slothFlg) {
			if (playerHpPercent <= (1 / 7) * (1 + (skillEffects.haisuiUp ?? 0)) && ((enemyHpPercent * (1 + (skillEffects.haisuiUp ?? 0))) - playerHpPercent) >= 0.5) {
				buff += 1;
				message += serifs.rpg.haisui + "\n";
				dmgUp *= (1 + (skillEffects.haisuiAtkUp ?? 0));
				critUp += (skillEffects.haisuiCritUp ?? 0)
				const effect = Math.min((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.haisuiUp ?? 0)), 0.95);
				atk = atk + Math.round(def * effect);
				def = Math.round(def * (1 - effect));
				if (verboseLog) {
					buff += 1;
					message += `決死の覚悟: ${[`D->A ${Math.round(effect * 100)}% (${formatNumber(atk)} / ${formatNumber(def)})\n`, skillEffects.haisuiAtkUp ? `与ダメージ${displayDifference((1 + (skillEffects.haisuiAtkUp ?? 0)))}` : "", skillEffects.haisuiCritUp ? `クリ率${displayDifference((1 + (skillEffects.haisuiCritUp ?? 0)))}` : ""].filter(Boolean).join(" ")}\n`;
				}
			}
		}

		if (enemy.fire && skillEffects.water) {
			dmgUp *= (1 + (skillEffects.water ?? 0));
				if (verboseLog) {
					buff += 1;
					message += `水スキル効果: 与ダメージ${displayDifference((1 + (skillEffects.water ?? 0)))}\n`;
				}
		}

		const itemEquip = (0.4 + ((1 - playerHpPercent) * 0.6) + itemBoost) * (slothFlg ? 0 : 1);
		if (verboseLog && !(count === 1 && skillEffects.firstTurnItem)) {
			buff += 1;
			message += `アイテム装備率: ${Math.round(Math.min(itemEquip * (1 + (skillEffects.itemEquip ?? 0)), 1) * 100)}%\n`;
		}
		if (verboseLog && count === 1 && skillEffects.firstTurnDoubleItem) {
			buff += 1;
			message += `アイテム二刀流率: ${Math.round(Math.min(itemEquip * (1 + (skillEffects.itemEquip ?? 0)), 1) * 100)}%\n`;
		}
		if (rpgItems.length && ((count === 1 && skillEffects.firstTurnItem) || Math.random() < itemEquip * (1 + (skillEffects.itemEquip ?? 0)))) {
			//アイテム
			buff += 1;
			if ((count === 1 && skillEffects.firstTurnItem)) message += serifs.rpg.skill.firstItem;
			if (enemy.pLToR) {
				let isPlus = Math.random() < 0.5;
				const items = rpgItems.filter((x) => isPlus ? x.mind > 0 : x.mind < 0);
				item = { ...items[Math.floor(Math.random() * items.length)] };
			} else {
				let types = ["weapon", "armor"];
				for (let i = 0; i < (skillEffects.weaponSelect ?? 0); i++) {
					types.push("weapon");
				}
				for (let i = 0; i < (skillEffects.armorSelect ?? 0); i++) {
					types.push("armor");
				}
				if ((count !== 1 || enemy.pLToR) && !skillEffects.lowHpFood && playerHpPercent < 0.95) {
					types.push("medicine");
					types.push("poison");
					for (let i = 0; i < (skillEffects.foodSelect ?? 0); i++) {
						types.push("medicine");
						types.push("poison");
					}
				}
				if ((skillEffects.weaponSelect ?? 0) >= 1) {
					types = ["weapon"]
				}
				if ((skillEffects.armorSelect ?? 0) >= 1) {
					types = ["armor"]
				}
				if ((skillEffects.foodSelect ?? 0) >= 1) {
					types = ["medicine", "poison"];
				}
				if ((count !== 1 || enemy.pLToR) && skillEffects.lowHpFood && playerHpPercent < 0.95 && Math.random() < skillEffects.lowHpFood * playerHpPercent) {
					if (skillEffects.lowHpFood && playerHpPercent < 0.5) message += serifs.rpg.skill.lowHpFood;
					types = ["medicine", "poison"];
					if (Math.random() < skillEffects.lowHpFood * playerHpPercent) types = ["medicine"];
				}
				if (types.includes("poison") && Math.random() < (skillEffects.poisonAvoid ?? 0)) {
         			types = types.filter((x) => x!== "poison");
				}
				const type = types[Math.floor(Math.random() * types.length)];
				const mEffect = Math.max((count !== 1 ? 0 : skillEffects.firstTurnItemChoice), itemMinEffect);
				if ((type === "weapon" && !(isBattle && isPhysical)) || (type === "armor" && isTired) || enemy.pLToR) {
					let isPlus = Math.random() < (0.5 + (skillEffects.mindMinusAvoid ?? 0) + (count === 1 ? skillEffects.firstTurnMindMinusAvoid ?? 0 : 0));
					const items = rpgItems.filter((x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0) && (!mEffect || x.mind >= (mEffect * 100)));
					item = { ...items[Math.floor(Math.random() * items.length)] };
				} else {
					const items = rpgItems.filter((x) => x.type === type && x.effect > 0 && (!mEffect || x.effect >= (mEffect * 100)));
					item = { ...items[Math.floor(Math.random() * items.length)] };
				}
				if (skillEffects.greed) {
					if (!data.stockItem) data.stockItem = { ...item };
					data.stockItem.effect = Math.ceil(data.stockItem.effect * (2/3));
					data.stockItem.mind = Math.ceil(data.stockItem.mind * (2/3));
					const match = data.stockItem.name.match(/-(\d+)$/);
					if (match && match.index !== undefined) {
					  const number = parseInt(match[1], 10);
					  const newNumber = number + 1;
					  data.stockItem.name = data.stockItem.name.slice(0, match.index) + '-' + newNumber;
					} else {
					  data.stockItem.name = data.stockItem.name + '-1';
					}
					if ((type === "weapon" && !(isBattle && isPhysical)) || (type === "armor" && isTired) || enemy.pLToR) {
						if (item.mind <= data.stockItem.mind) {
							item = { ...data.stockItem };
						} else {
							if (type === "weapon" || type === "armor") data.stockItem = { ...item };
						}
					} else {
						if (item.effect <= data.stockItem.effect) {
							item = { ...data.stockItem };
						} else {
							if (type === "weapon" || type === "armor") data.stockItem = { ...item };
						}
					}
				} else {
					data.stockItem = undefined;
				}
				if (count === 1 && skillEffects.firstTurnDoubleItem && Math.random() < itemEquip * (1 + (skillEffects.itemEquip ?? 0))) {
					if ((type === "weapon" && !(isBattle && isPhysical)) || (type === "armor" && isTired) || enemy.pLToR) {
						let isPlus = Math.random() < (0.5 + (skillEffects.mindMinusAvoid ?? 0) + (count === 1 ? skillEffects.firstTurnMindMinusAvoid ?? 0 : 0));
						const items = rpgItems.filter((x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0));
						item2 = { ...items[Math.floor(Math.random() * items.length)] };
					} else {
						const items = rpgItems.filter((x) => x.type === type && x.effect > 0);
						item2 = { ...items[Math.floor(Math.random() * items.length)] };
					}
					item.effect = item.effect + item2.effect;
					item.mind = item.mind + item2.mind;
					if (item.name === item2.name) {
						item.effect = item.effect + item2.effect;
						item.mind = item.mind + item2.mind;
					}
				}
			}
		}
		if (skillEffects.greed) {
			if (data.stockItem && !item) {
				data.stockItem.effect = Math.ceil(data.stockItem.effect * (2/3));
				data.stockItem.mind = Math.ceil(data.stockItem.mind * (2/3));
				const match = data.stockItem.name.match(/-(\d+)$/);
				if (match && match.index !== undefined) {
				  const number = parseInt(match[1], 10);
				  const newNumber = number + 1;
				  data.stockItem.name = data.stockItem.name.slice(0, match.index) + '-' + newNumber;
				} else {
				  data.stockItem.name = data.stockItem.name + '-1';
				}
				item = { ...data.stockItem };
			}
		} else {
			data.stockItem = undefined;
		}
		if (item) {
			const rawEffect = item.effect;
			const rawMind = item.mind;
			const mindMsg = (mind) => {
				if (mind >= 100) {
					message += `${config.rpgHeroName}の気合が特大アップ！\n`;
				} else if (mind >= 70) {
					message += `${config.rpgHeroName}の気合が大アップ！\n`;
				} else if (mind > 30) {
					message += `${config.rpgHeroName}の気合がアップ！\n`;
				} else if (mind > 0) {
					message += `${config.rpgHeroName}の気合が小アップ！\n`;
				} else if (mind > -50) {
					message += `あまり良い気分ではないようだ…\n`;
				} else {
					message += `${config.rpgHeroName}の気合が下がった…\n`;
				}
				if (verboseLog) {
					buff += 1;
					message += `アイテム効果: ${Math.round(item.mind)}%${rawMind !== item.mind ? ` (${displayDifference(item.mind / rawMind)})` : ""} (${formatNumber(atk)} / ${formatNumber(def)})\n`;
				}
			};
			if (item.type !== "poison") {
				item.effect = Math.round(item.effect * (1 + (skillEffects.itemBoost ?? 0)));
				if (item.type === "weapon") item.effect = Math.round(item.effect * (1 + (skillEffects.weaponBoost ?? 0)));
				if (item.type === "armor") item.effect = Math.round(item.effect * (1 + (skillEffects.armorBoost ?? 0)));
				if (item.type === "medicine") item.effect = Math.round(item.effect * (1 + (skillEffects.foodBoost ?? 0)));

			} else {
				item.effect = Math.round(item.effect / (1 + (skillEffects.itemBoost ?? 0)));
				item.effect = Math.round(item.effect / (1 + (skillEffects.poisonResist ?? 0)));
			}
			if (item.mind < 0) {
				item.mind = Math.round(item.mind / (1 + (skillEffects.itemBoost ?? 0)));
			} else {
				item.mind = Math.round(item.mind * (1 + (skillEffects.itemBoost ?? 0)));
			}
			switch (item.type) {
				case "weapon":
					message += `${item.name}を取り出し、装備した！\n`;
					if (item2?.name) {
						message += `さらに、${item2.name}を取り出し、装備した！\n`;
					}
					if (!(isBattle && isPhysical)) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						itemBonus.atk = (lv * 4) * (item.effect * 0.007);
						atk = atk + itemBonus.atk;
						if (item.effect >= 100) {
							message += `${config.rpgHeroName}のパワーが特大アップ！\n`;
						} else if (item.effect >= 70) {
							message += `${config.rpgHeroName}のパワーが大アップ！\n`;
						} else if (item.effect > 30) {
							message += `${config.rpgHeroName}のパワーがアップ！\n`;
						} else {
							message += `${config.rpgHeroName}のパワーが小アップ！\n`;
						}
						if (verboseLog) {
							buff += 1;
							message += `アイテム効果: ${Math.round(item.effect)}%${rawEffect !== item.effect ? ` (${displayDifference(item.effect / rawEffect)})` : ""} (${formatNumber(atk)})\n`;
						}
					}
					break;
				case "armor":
					message += `${item.name}を取り出し、装備した！\n`;
					if (item2?.name) {
						message += `さらに、${item2.name}を取り出し、装備した！\n`;
					}
					if (isTired) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0035);
						itemBonus.def = def * (item.mind * 0.0035);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
						if (skillEffects.shieldBash && itemBonus.def > 0) {
							const shieldBashX = 1 - Math.pow(0.5, (skillEffects.shieldBash ?? 0));
							const shieldBashAtk = Math.floor(itemBonus.def * shieldBashX);
							if (shieldBashAtk > 0) {
								itemBonus.atk += shieldBashAtk;
								atk += shieldBashAtk;
							}
						}
					} else {
						itemBonus.def = (lv * 4) * (item.effect * 0.007);
						def = def + itemBonus.def;
						if (skillEffects.shieldBash && itemBonus.def > 0) {
							const shieldBashX = 1 - Math.pow(0.5, (skillEffects.shieldBash ?? 0));
							const shieldBashAtk = Math.floor(itemBonus.def * shieldBashX);
							if (shieldBashAtk > 0) {
								itemBonus.atk += shieldBashAtk;
								atk += shieldBashAtk;
							}
						}
						const shieldBashActivated = !!(skillEffects.shieldBash && itemBonus.atk > 0);
						if (item.effect >= 100) {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が特大アップ！\n`;
						} else if (item.effect >= 70) {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が大アップ！\n`;
						} else if (item.effect > 30) {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}がアップ！\n`;
						} else {
							message += `${config.rpgHeroName}の${shieldBashActivated ? "パワーと防御" : "防御"}が小アップ！\n`;
						}
						if (verboseLog) {
							buff += 1;
							message += `アイテム効果: ${Math.round(item.effect)}%${rawEffect !== item.effect ? ` (${displayDifference(item.effect / rawEffect)})` : ""} (${formatNumber(def)})\n`;
						}
					}
					break;
				case "medicine":
					message += `${item.name}を取り出し、食べた！\n`;
					if (enemy.pLToR) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						if (item.effect > 200) {
							const overHeal = item.effect - 200;
							mindMsg(overHeal);
							itemBonus.atk = atk * (overHeal * 0.0035);
							itemBonus.def = def * (overHeal * 0.0035);
							atk = atk + itemBonus.atk;
							def = def + itemBonus.def;
							item.effect = 200;
						}
						const heal = Math.round(((playerMaxHp) - playerHp) * (item.effect * 0.005));
						const recovered = recoverHpOrBarrier(heal);
						if (heal > 0) {
							if (recovered.barrier > 0) {
								message += `${Math.floor(recovered.barrier)}ポイントのバリアを獲得！\n`;
							}
							if (recovered.healed >= 1) {
								if (item.effect >= 100 && recovered.healed >= 50) {
									message += `${config.rpgHeroName}の体力が特大回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`;
								} else if (item.effect >= 70 && recovered.healed >= 35) {
									message += `${config.rpgHeroName}の体力が大回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`;
								} else if (item.effect > 30 && recovered.healed >= 15) {
									message += `${config.rpgHeroName}の体力が回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`;
								} else {
									message += `${config.rpgHeroName}の体力が小回復！\n${Math.floor(recovered.healed)}ポイント回復した！\n`;
								}
							}
							if (verboseLog) {
								buff += 1;
								message += `アイテム効果: ${Math.round(item.effect)}%${rawEffect !== item.effect ? ` (${displayDifference(item.effect / rawEffect)})` : ""}\n`;
							}
						}
					}
					if (skillEffects.gluttony) {
						atkDmgBonus *= 1.1;
						buff += 1;
						if (verboseLog) message += `暴食: A+10% (${formatNumber(atk)})\n`;
					}
					break;
				case "poison":
					message += `${item.name}を取り出し、食べた！\n`;
					if (enemy.pLToR) {
						mindMsg(item.mind);
						if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
						itemBonus.atk = atk * (item.mind * 0.0025);
						itemBonus.def = def * (item.mind * 0.0025);
						atk = atk + itemBonus.atk;
						def = def + itemBonus.def;
					} else {
						const dmg = Math.round(playerHp * (item.effect * 0.003) * (isSuper && !aggregateTokensEffects(data).redMode ? 0.5 : 1));
						playerHp -= dmg;
						if (item.effect >= 70 && dmg > 0) {
							message += `${config.rpgHeroName}はかなり調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`;
						} else if (item.effect > 30 && dmg > 0) {
							message += `${config.rpgHeroName}は調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`;
						} else {
							message += `あまり美味しくなかったようだ…${dmg > 0 ? `\n${dmg}ポイントのダメージを受けた！` : ""}\n`;
						}
						if (verboseLog) {
							buff += 1;
							message += `アイテム効果: ${Math.round(item.effect)}%${rawEffect !== item.effect ? ` (${displayDifference(item.effect / rawEffect)})` : ""}\n`;
						}
					}
					if (skillEffects.gluttony) {
						atkDmgBonus *= 1.2;
						buff += 1;
						if (verboseLog) message += `暴食: A+20% (${formatNumber(atk)})\n`;
					}
					break;
				default:
					break;
			}
			if (aggregateTokensEffects(data).showItemBonus) {
				const itemMessage = [`${itemBonus.atk > 0 ? `${serifs.rpg.status.atk}+${itemBonus.atk.toFixed(0)}` : ""}`, `${itemBonus.def > 0 ? `${serifs.rpg.status.def}+${itemBonus.def.toFixed(0)}` : ""}`].filter(Boolean).join(" / ");
				if (itemMessage) {
					message += `(${itemMessage})\n`;
				}
			}
		}
		if (skillEffects.itemAtkStock) {
			const itemAtkGain = Math.max(Math.floor(itemBonus.atk ?? 0), 0);
			if (itemAtkGain > 0) {
				itemAtkStockNext = Math.floor(itemAtkGain * (skillEffects.itemAtkStock ?? 0));
				if (verboseLog) {
					message += `継スキル: 次ターン累積予定+${itemAtkStockNext}\n`;
				}
			} else {
				itemAtkStockNext = 0;
			}
		}
		// 土属性剣攻撃
		if (skillEffects.dart && isBattle && isPhysical && maxdmg) {
			buff += 1;
			message += serifs.rpg.skill.dart + "\n";
			maxdmg = maxdmg * (1 + skillEffects.dart);
		}

		let trueDmg = 0;

		// 炎属性剣攻撃
		if (skillEffects.fire && (isBattle && isPhysical)) {
			buff += 1;
			message += serifs.rpg.skill.fire + "\n";
			trueDmg = Math.ceil(Math.min(lv, 255) * skillEffects.fire);
			if (verboseLog) {
				buff += 1;
				message += `火戦闘: Dmg+${Math.ceil(Math.min(lv, 255) * skillEffects.fire)}\n`;
			}
		} else if (skillEffects.fire && !(isBattle && isPhysical)) {
			// 非戦闘時は、パワーに還元される
			atk = atk + lv * 3.75 * skillEffects.fire;
			if (verboseLog) {
				buff += 1;
				message += `火非戦闘: A+${Math.floor(lv * 3.75 * skillEffects.fire)} (${formatNumber(atk)})\n`;
			}
		}

		// バフが1つでも付与された場合、改行を追加する
		if (buff > 0) message += "\n";

		if (verboseLog && enemy.abort) {
			buff += 1;
			message += `連続攻撃中断率: ${enemy.abort * (1 - (skillEffects.abortDown ?? 0)) * 100}%\n`;
		}


		// 敵が中断能力持ちの場合、ここで何回攻撃可能か判定
		for (let i = 1; i < spd; i++) {
			if (enemy.abort && Math.random() < enemy.abort * (1 - (skillEffects.abortDown ?? 0))) {
				abort = i;
				break;
			}
		}

		const defMinusMin = skillEffects.defDmgUp && skillEffects.defDmgUp < 0 ? (1 / (-1 + (skillEffects.defDmgUp ?? 0)) * -1) : 1;

		const defDmgX = Math.max(1 *
			(Math.max(1 + (skillEffects.defDmgUp ?? 0), defMinusMin)) *
			(count === 1 && skillEffects.firstTurnResist ? (1 - (skillEffects.firstTurnResist ?? 0)) : 1) *
			(count === 2 && skillEffects.firstTurnResist && skillEffects.firstTurnResist > 1 ? (1 - ((skillEffects.firstTurnResist ?? 0) - 1)) : 1) *
			(1 - Math.min((skillEffects.tenacious ?? 0) * (1 - playerHpPercent), 0.9)), 0);

		const atkMinRnd = Math.max(0.2 + (skillEffects.atkRndMin ?? 0), 0);
		const atkMaxRnd = Math.max(1.6 + (skillEffects.atkRndMax ?? 0), 0);
		const defMinRnd = Math.max(0.2 + (skillEffects.defRndMin ?? 0), 0);
		const defMaxRnd = Math.max(1.6 + (skillEffects.defRndMax ?? 0), 0);

		/** 予測最大ダメージ */
		let predictedDmg = Math.round((atk * tp * (atkMinRnd + atkMaxRnd)) * (1 / (((enemyDef * (getVal(enemy.defx, [count]) ?? 3)) + 100) / 100))) * (abort || spd);

		// 予測最大ダメージは最大ダメージ制限を超えない
		if (maxdmg && predictedDmg > maxdmg) predictedDmg = maxdmg;

		let endureCount = 1 + (skillEffects.endureUp ?? 0) * 2;

		const _data = { ...data, enemy, count, fireStack };


		if (_data.enemy.fire && skillEffects.water) {
			_data.enemy.fire /= (1 + (skillEffects.water ?? 0) * 3);
		}

		// 敵先制攻撃の処理
		// spdが1ではない、または戦闘ではない場合は先制攻撃しない
		if (!enemy.spd && !enemy.hpmsg && !isTired) {
			/** クリティカルかどうか */
			const crit = Math.random() < (enemy.alwaysCrit ? 1 : 0) * (1 - (skillEffects.enemyCritDown ?? 0));
			// 予測最大ダメージが相手のHPの何割かで先制攻撃の確率が判定される
			if (Math.random() < predictedDmg / enemyHp || (count === 3 && enemy.fire && (data.thirdFire ?? 0) <= 2)) {
				const rng = (defMinRnd + (enemy.fixRnd ?? random(data, startCharge, skillEffects, true)) * defMaxRnd);
				const critDmg = 1 + ((skillEffects.enemyCritDmgDown ?? 0) * -1);
				if (verboseLog && (defDmgX < 0.999 || defDmgX > 1.001)) {
					buff += 1;
					message += `D: ${formatNumber(def)} (x${formatNumber(def / (lv * 3.5))})\n`;
					message += `合計被ダメージ: ${displayDifference(defDmgX)}\n`;
				}
				if (_data.enemy.fire) {
					fireStack += _data.enemy.fire / 0.15;
					_data.fireStack = fireStack;
					const fireStatus = additionalStatuses.find((status) => status.icon === serifs.rpg.fire);
					if (fireStatus) fireStatus.value = fireStack;
				}
				/** ダメージ */
				let dmg = getEnemyDmg(_data, def, tp, 1, crit ? critDmg : false, enemyAtk, rng * defDmgX, getVal(enemy.atkx, [count]));
				let noItemDmg = getEnemyDmg(_data, def - itemBonus.def, tp, 1, enemy.alwaysCrit ? 1 : false, enemyAtk, rng * defDmgX, getVal(enemy.atkx, [count]));
				let normalDmg = getEnemyDmg(_data, lv * 3.75, tp, 1, enemy.alwaysCrit ? 1 : false, enemyAtk, rng * defDmgX, getVal(enemy.atkx, [count]));
				let addMessage = "";
				const rawDmg = dmg;
				if (sevenFeverBarrier > 0) {
					const reduced = reduceByBarrier(dmg, sevenFeverBarrier);
					dmg = reduced.reducedDmg;
					if (reduced.consumed) addMessage += `(バリア: -${Math.round(reduced.consumed * 10) / 10})\n`;
					if (noItemDmg > 0) {
						const noItemReduced = reduceByBarrier(noItemDmg, sevenFeverBarrier);
						noItemDmg = noItemReduced.reducedDmg;
					}
					sevenFeverBarrier = reduced.restBarrier;
					const barrierStatus = additionalStatuses.find((status) => status.icon === "🛡️");
					if (barrierStatus) barrierStatus.value = sevenFeverBarrier;
				}
				// ダメージが負けるほど多くなる場合は、先制攻撃しない
				if (warriorFlg || playerHp > dmg || (count === 3 && enemy.fire && (data.thirdFire ?? 0) <= 2)) {
					if (normalDmg > rawDmg) {
						totalResistDmg += (normalDmg - rawDmg);
					}
					if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`;
					playerHp -= dmg;
					message += (crit ? `**${enemy.defmsg(dmg)}**` : enemy.defmsg(dmg)) + "\n";
					if (addMessage) message += addMessage;
					if (itemBonus.def && noItemDmg - dmg > 1) {
						message += `(道具効果: -${noItemDmg - dmg})\n`;
					}
					if (skillEffects.pride) {
						if (dmg <= (playerMaxHp / 10)) {
							atkDmgBonus *= 1.15;
						}
						if (dmg >= ((playerMaxHp / 10) * 3)) {
							dmg *= 2;
						}
					}
					if (warriorFlg && playerHp <= 0) {
						playerHp += dmg;
						message += serifs.rpg.warrior.lose + "\n";
						dmg = 0;
						warriorFlg = false;
					}
					if (playerHp <= 0 && !enemy.notEndure) {
						message += serifs.rpg.endure + "\n";
						playerHp = 1;
					}
					message += "\n";
					enemyTurnFinished = true;
					if (enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
					if (dmg > (data.superMuscle ?? 0)) data.superMuscle = dmg;
				}
			}
		}

		checkMagic("Attack", {predictedDmg});

		if (skillEffects.allForOne || aggregateTokensEffects(data).allForOne) {
			const spdx = getSpdX(abort || spd);
			atk = atk * spdx * (1 + (skillEffects.allForOne ?? 0) * 0.1);
			trueDmg = trueDmg * spdx * (1 + (skillEffects.allForOne ?? 0) * 0.1);
			if (itemBonus?.atk) itemBonus.atk = itemBonus.atk * spdx * (1 + (skillEffects.allForOne ?? 0) * 0.1);
			spd = 1;
			if (verboseLog && spdx > 1) {
				buff += 1;
				message += `全身全霊: A${displayDifference(spdx)} S=1 (${formatNumber(atk)})\n`;
			}
		}

		if (atkDmgBonus > 1) {
			atk = Math.round(atk * atkDmgBonus);
			if (itemBonus?.atk) itemBonus.atk = itemBonus.atk * atkDmgBonus;
			if (verboseLog && atkDmgBonus > 1) {
				buff += 1;
				message += `ボーナス: A${displayDifference(atkDmgBonus)} (${formatNumber(atk)})\n`;
			}
		}

		if (warriorFlg) {
			//** クリティカルかどうか */
			let crit = Math.random() < 0.5;
			const dmg = getAtkDmg(data, lv * 5, tp, 1, crit ? warriorCritX : false, enemyDef, enemyMaxHp, 0.5, getVal(enemy.defx, [count]));
			// メッセージの出力
			message += (crit ? `**${serifs.rpg.warrior.atk(dmg)}**` : serifs.rpg.warrior.atk(dmg)) + "\n";
			totalDmg += dmg;
			warriorTotalDmg += dmg;
			if (crit) warriorCritX += 0.5;
		}

		const atkMinusMin = skillEffects.atkDmgUp && skillEffects.atkDmgUp < 0 ? (1 / (-1 + (skillEffects.atkDmgUp ?? 0)) * -1) : 1;

		if (verboseLog) {
			buff += 1;
			message += `A: ${formatNumber(atk)} (x${formatNumber(atk / (lv * 3.5))})\n`;
			message += `クリティカル率: ${formatNumber((Math.max((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0) + critUp), 0) + (skillEffects.critUpFixed ?? 0)) * 100)}%\n`;
		}

		// 自身攻撃の処理
		// spdの回数分、以下の処理を繰り返す
		for (let i = 0; i < spd; i++) {
			const rng = (atkMinRnd + random(data, startCharge, skillEffects, false) * atkMaxRnd);
			if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`;
			const turnDmgX = (i < 2 ? 1 : i < 3 ? 0.5 : i < 4 ? 0.25 : 0.125);
			let dmgBonus = ((Math.max(1 + (skillEffects.atkDmgUp ?? 0) * dmgUp, atkMinusMin)) * turnDmgX) + (skillEffects.thunder ? (skillEffects.thunder * ((i + 1) / spd) / (spd === 1 ? 2 : spd === 2 ? 1.5 : 1)) : 0);
			const rawDmgBonus = dmgBonus / turnDmgX;
			if (verboseLog && (rawDmgBonus < 0.999 || rawDmgBonus > 1.001)) {
				buff += 1;
				message += `合計与ダメージ: ${displayDifference(rawDmgBonus)}\n`;
			}
			//** クリティカルかどうか */
			let crit = Math.random() < Math.max((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0) + critUp), 0) + (skillEffects.critUpFixed ?? 0);
			const critDmg = 1 + ((skillEffects.critDmgUp ?? 0));
			if (skillEffects.noCrit) {
				crit = false;
				const noCritBonus = 1 + (Math.min((Math.max((enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0) + critUp), 0) + (skillEffects.critUpFixed ?? 0)), 1) * ((2 * critDmg) - 1));
				dmgBonus *= noCritBonus
				if (verboseLog && (noCritBonus < 0.999 || noCritBonus > 1.001)) {
					buff += 1;
					message += `５スキル効果: ${displayDifference(noCritBonus)}\n`;
				}
			}
			/** ダメージ */
			let dmg = getAtkDmg(data, atk, tp, 1, crit ? critDmg : false, enemyDef, enemyMaxHp, rng * dmgBonus, getVal(enemy.defx, [count])) + Math.round(trueDmg * turnDmgX);
			let noItemDmg = getAtkDmg(data, atk - itemBonus.atk, tp, 1, crit ? critDmg : false, enemyDef, enemyMaxHp, rng * dmgBonus, getVal(enemy.defx, [count])) + Math.round(trueDmg * turnDmgX);
			if (sevenFever) {
				const num = 7 * Math.max(Math.ceil((skillEffects.sevenFever || 1) * turnDmgX), 1);
				dmg = Math.ceil(dmg / num) * num;
				noItemDmg = Math.ceil(noItemDmg / num) * num;
			}
			// 最大ダメージ制限処理
			if (maxdmg && maxdmg > 0 && dmg > Math.round(maxdmg * (1 / ((abort || spd) - i)))) {
				// 最大ダメージ制限を超えるダメージの場合は、ダメージが制限される。
				dmg = Math.round(maxdmg * (1 / ((abort || spd) - i)));
				maxdmg -= dmg;
				crit = false;
			} else if (maxdmg && maxdmg > 0) {
				maxdmg -= dmg;
			}
			// メッセージの出力
			message += (crit ? `**${enemy.atkmsg(dmg)}**` : enemy.atkmsg(dmg)) + "\n";
			totalDmg += dmg;
			if (itemBonus.atk && dmg - noItemDmg > 1) {
				message += `(道具効果: +${dmg - noItemDmg})\n`;
			}
			// 敵のHPが0以下になった場合は、以降の攻撃をキャンセル
			if (enemyHp <= 0) break;
			// 攻撃が中断される場合
			if ((i + 1) === abort) {
				if (enemy.abortmsg) message += enemy.abortmsg + "\n";
				break;
			}
		}

		checkMagic("AfterAttack", {predictedDmg});

		// 勝利処理
		if (enemyHp <= 0) {
			message += "\n" + enemy.winmsg + "\n\n" + serifs.rpg.win;
			break;
		} else {
			// 攻撃後発動スキル効果
			// 氷属性剣攻撃
			if ((isBattle && isPhysical && !isTired) && Math.random() < (skillEffects.ice ?? 0)) {
				message += serifs.rpg.skill.ice(enemy.dname ?? enemy.name) + `\n`;
				enemyTurnFinished = true;
			} else if (!(isBattle && isPhysical && !isTired)) {
				// 非戦闘時は氷の効果はないが、防御に還元される
				def = def * (1 + (skillEffects.ice ?? 0));
				if (verboseLog && (skillEffects.ice ?? 0) > 0) {
					buff += 1;
					message += `氷非戦闘: D${displayDifference((1 + (skillEffects.ice ?? 0)))} (${formatNumber(def)})\n`;
				}
			}
			// 光属性剣攻撃
			if ((isBattle && isPhysical && !isTired) && Math.random() < (skillEffects.light ?? 0)) {
				message += serifs.rpg.skill.light(enemy.dname ?? enemy.name) + `\n`;
				enemyAtkX = enemyAtkX * 0.5;
			} else if (!(isBattle && isPhysical && !isTired)) {
				// 非戦闘時は光の効果はないが、防御に還元される
				def = def * (1 + (skillEffects.light ?? 0) * 0.5);
				if (verboseLog && (skillEffects.light ?? 0) > 0) {
					buff += 1;
					message += `光非戦闘: D${displayDifference((1 + (skillEffects.light ?? 0) * 0.5))} (${formatNumber(def)})\n`;
				}
			}
			// 闇属性剣攻撃
			if (enemy.spd && enemy.spd >= 2 && Math.random() < (skillEffects.dark ?? 0) * 2) {
				message += serifs.rpg.skill.spdDown(enemy.dname ?? enemy.name) + `\n`;
				enemy.spd = 1;
			} else if ((isBattle && isPhysical) && enemyHp > 150 && Math.random() < (skillEffects.dark ?? 0)) {
				const dmg = Math.floor(300 / 2);
				message += serifs.rpg.skill.dark(enemy.dname ?? enemy.name, dmg) + `\n`;
				totalDmg += dmg;
			} else if (!(isBattle && isPhysical)) {
				// 非戦闘時は闇の効果はないが、防御に還元される
				def = def * (1 + (skillEffects.dark ?? 0) * 0.3);
				if (verboseLog && (skillEffects.dark ?? 0) > 0) {
					buff += 1;
					message += `闇非戦闘: D${displayDifference((1 + (skillEffects.dark ?? 0) * 0.3))} (${formatNumber(def)})\n`;
				}
			}

			if (enemy && skillEffects.envy) {
				const targetScore = (1024 / ((enemy?.power ?? 30) / 30)) * (2 ** 4);
				const rate = (1 - (0.7 * Math.max(1 - (totalDmg / targetScore), 0)))
				if (rate < 1) {
					enemyAtkX = enemyAtkX * rate;
					if (verboseLog) {
						buff += 1;
						message += `嫉妬: 被ダメージ${displayDifference(rate)}\n`;
					}
				} else {
					const score = enemy ? Math.max(Math.log2((totalDmg * 20) / (1024 / ((enemy.power ?? 30) / 30))) + 1, 1) : undefined;
					if (score && score > 5) {
						enemyAtkX = enemyAtkX * (1 + (score-5) * 0.1);
						if (verboseLog) {
							buff += 1;
							message += `嫉妬: 被ダメージ${displayDifference((1 + (score-5) * 0.1))}\n`;
						}
					}
				}
			}

			if (enemy && skillEffects.beginner && count <= 4 && data.skills?.length && data.skills?.length <= 3) {
				const targetScore = (1024 / ((enemy?.power ?? 30) / 30)) * (2 ** 3);
				const rate = (1 - ((data.skills?.length >= 4 ? 0 : data.skills?.length >= 3 ? 0.3 : data.skills?.length >= 2 ? 0.6 : 0.9) * Math.max(1 - (totalDmg / targetScore), 0)));
				if (rate < 1) {
					enemyAtkX = enemyAtkX * rate;
					if (verboseLog) {
						buff += 1;
						message += `わかばの加護: 被ダメージ${displayDifference(rate)}\n`;
					}
				}
			}

			checkMagic("Defense", {predictedDmg});

			// 敵のターンが既に終了していない場合
			/** 受けた最大ダメージ */
			let maxDmg = 0;
			if (!enemyTurnFinished) {
				message += "\n";
				for (let i = 0; i < (enemy.spd ?? 1); i++) {
					const rng = (defMinRnd + (enemy.fixRnd ?? random(data, startCharge, skillEffects, true)) * defMaxRnd);
					if (aggregateTokensEffects(data).showRandom) message += `⚂ ${Math.floor(rng * 100)}%\n`;
					/** クリティカルかどうか */
					const crit = Math.random() < (enemy.alwaysCrit ? 1 : 0) * (1 - (skillEffects.enemyCritDown ?? 0));
					const critDmg = 1 + ((skillEffects.enemyCritDmgDown ?? 0) * -1);
					if (verboseLog && (defDmgX < 0.999 || defDmgX > 1.001)) {
						buff += 1;
						message += `D: ${formatNumber(def)} (x${formatNumber(def / (lv * 3.5))})\n`;
						message += `合計被ダメージ: ${displayDifference(defDmgX)}\n`;
					}
					if (_data.enemy.fire) {
						fireStack += _data.enemy.fire / 0.15;
						_data.fireStack = fireStack;
						const fireStatus = additionalStatuses.find((status) => status.icon === serifs.rpg.fire);
						if (fireStatus) fireStatus.value = fireStack;
					}
					/** ダメージ */
					let dmg = getEnemyDmg(_data, def, tp, 1, crit ? critDmg : false, enemyAtk, rng * defDmgX * enemyAtkX, getVal(enemy.atkx, [count]));
					let noItemDmg = getEnemyDmg(_data, def - itemBonus.def, tp, 1, crit ? critDmg : false, enemyAtk, rng * defDmgX * enemyAtkX, getVal(enemy.atkx, [count]));
					let normalDmg = getEnemyDmg(_data, lv * 3.75, tp, 1, enemy.alwaysCrit ? 1 : false, enemyAtk, rng, getVal(enemy.atkx, [count]));
					let addMessage = "";
					if (normalDmg > dmg) {
						totalResistDmg += (normalDmg - dmg);
					}
					if (sevenFeverBarrier > 0) {
						const reduced = reduceByBarrier(dmg, sevenFeverBarrier);
						dmg = reduced.reducedDmg;
						if (reduced.consumed) addMessage += `(バリア: -${Math.round(reduced.consumed * 10) / 10})\n`;
						if (noItemDmg > 0) {
							const noItemReduced = reduceByBarrier(noItemDmg, sevenFeverBarrier);
							noItemDmg = noItemReduced.reducedDmg;
						}
						sevenFeverBarrier = reduced.restBarrier;
						const barrierStatus = additionalStatuses.find((status) => status.icon === "🛡️");
						if (barrierStatus) barrierStatus.value = sevenFeverBarrier;
					}
					if (skillEffects.pride) {
						if (dmg <= (playerMaxHp / 10)) {
							atkDmgBonus *= 1.15;
						}
						if (dmg >= ((playerMaxHp / 10) * 3)) {
							dmg *= 2;
						}
					}
					playerHp -= dmg;
					message += (crit ? `**${enemy.defmsg(dmg)}**` : enemy.defmsg(dmg)) + "\n";
					if (addMessage) message += addMessage;
					if (itemBonus.def && noItemDmg - dmg > 1) {
						message += `(道具効果: -${noItemDmg - dmg})\n`;
					}
					if (warriorFlg && playerHp <= 0) {
						playerHp += dmg;
						message += serifs.rpg.warrior.lose + "\n";
						dmg = 0;
						warriorFlg = false;
					}
					if (dmg > maxDmg) maxDmg = dmg;
					if (enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
				}
				checkMagic("AfterDefense", {predictedDmg});
				// HPが0で食いしばりが可能な場合、食いしばる
				const endure = (0.1 + (endureCount * 0.1)) - (count * 0.05);
				if (verboseLog && playerHp <= 0 && !enemy.notEndure && endure > 0) {
					buff += 1;
					message += `食いしばり率: ${formatNumber(endure * 100)}%\n`;
				}
				if (playerHp <= 0 && !enemy.notEndure && Math.random() < endure) {
					message += serifs.rpg.endure + "\n";
					playerHp = 1;
					endureCount -= 1;
				}
				if (verboseLog && skillEffects.escape && actionX + 1 < plusActionX && playerHp <= 0 && !enemy.notEndure) {
					buff += 1;
					message += `逃スキル: HPが0 ~ ${Math.ceil((playerMaxHp) * (skillEffects.escape / -16))}で発動\n(現在HP: ${Math.floor(playerHp)})\n`;
				}
				if (skillEffects.escape && actionX + 1 < plusActionX && playerHp <= 0 && playerHp >= (playerMaxHp) * (skillEffects.escape / -16) && !enemy.notEndure) {
					message += "やられそうになったので、\n一旦距離を取り、1ターン分回復に徹した！\n";
					const heal = Math.ceil((playerMaxHp) * (skillEffects.escape / 10)) + 1;
					const recovered = recoverHpOrBarrier(heal);
					if (recovered.healed >= 1) message += `${Math.floor(recovered.healed)}ポイントの体力を回復！\n`;
					if (recovered.barrier > 0) message += `${Math.floor(recovered.barrier)}ポイントのバリアを獲得した！\n`;
					actionX += 1;
					count += 1;
					skillEffects.escape -= 1;
				}
				if (maxDmg > (data.superMuscle ?? 0) && playerHp > 0) data.superMuscle = maxDmg;
			}
			checkMagic("TurnEnd", {predictedDmg});
			// 敗北処理
			if (playerHp <= 0) {
				message += "\n" + enemy.losemsg;
				break;
			} else {
				// 決着がつかない場合
				const chargeStatus = additionalStatuses.find((status) => status.icon === "🍀");
				if (chargeStatus) chargeStatus.value = data.charge;
				const sinStatus = additionalStatuses.find((status) => status.icon === "🔺");
				if (sinStatus) sinStatus.value = (atkDmgBonus - 1) * 10;
				if (actionX === plusActionX) {
					message += showStatusDmg(_data, playerHp, totalDmg, playerMaxHp, me, additionalStatuses);
				} else {
					message += showStatusDmg(_data, playerHp, totalDmg, playerMaxHp, me, additionalStatuses) + "\n\n";
				}
				count = count + 1;
			}
		}
	}

	if (warriorFlg) {
		//** クリティカルかどうか */
		let crit = Math.random() < 0.5;
		const dmg = getAtkDmg(data, lv * 5, tp, 1, crit ? warriorCritX : false, enemyDef, enemyMaxHp, 1, getVal(enemy.defx, [count]));
		// メッセージの出力
		message += "\n\n" + (crit ? `**${serifs.rpg.warrior.atk(dmg)}**` : serifs.rpg.warrior.atk(dmg));
		totalDmg += dmg;
		warriorTotalDmg += dmg;
	}
	checkMagic("End");
	if (playerHp > 0) {
		if (skillEffects.guardAtkUp && totalResistDmg >= 300) {
			totalResistDmg = Math.min(totalResistDmg, 1200)
			const guardAtkUpX = [0, 1, 2.4, 4.8, 8, 8];
			const heal = Math.round(((playerMaxHp) - playerHp) * (skillEffects.guardAtkUp * guardAtkUpX[Math.floor(totalResistDmg / 300)]));
			recoverHpOrBarrier(heal);
			if (verboseLog) {
				buff += 1;
				message += `\n\n勢スキル状態: ${Math.floor(totalResistDmg)} / 1200\n`;
				message += `\n勢スキル効果: HP+${formatNumber(heal)}\n`;
			}
		}
		const enemySAtk = Math.max((_enemyAtk / (lv * 3.5)) * (getVal(enemy.atkx, [6]) ?? 3), 0.01);
		let enemyFDef = (typeof enemy.def === "function") ? enemy.def(atk, def, spd) : lv * 3.5 * (enemy.def ?? 1);
		const enemySDef = Math.max((enemyFDef / (lv * 3.5)) * (getVal(enemy.defx, [6]) ?? 3), enemySAtk / 3000);
		let lastDmg = (1000 + (enemySAtk >= 24 ? enemySAtk / 0.048 : 0)) * Math.max(enemySAtk / enemySDef, 1);
		let dmg = Math.round(playerHp / (playerMaxHp) * (enemy.maxLastDmg ? Math.min(lastDmg, enemy.maxLastDmg) : lastDmg));
		dmg = Math.round(dmg * (1 + (skillEffects.finalAttackUp ?? 0)));
		if (sevenFever >= 7) {
			if (dmg > 177777) {
				dmg = dmg >= 77777 ? Math.max(Math.floor((dmg - 77777) / 100000) * 100000, 0) + 77777 : dmg;
			} if (dmg > 17777) {
				dmg = dmg >= 7777 ? Math.max(Math.floor((dmg - 7777) / 10000) * 10000, 0) + 7777 : dmg;
			} else {
				dmg = dmg >= 777 ? Math.max(Math.floor((dmg - 777) / 1000) * 1000, 0) + 777 : dmg;
			}
		}
		if (verboseLog) {
			buff += 1;
			message += `\nラストアタック: HP${Math.floor(playerHp / playerMaxHp * 100)}% / 最大${Math.round((enemy.maxLastDmg ? Math.min(lastDmg, enemy.maxLastDmg) : lastDmg))}`;
		}
		message += "\n\n" + serifs.rpg.finalAttack(dmg) + `\n\n` + (isTired ? serifs.rpg.timeUp2 : serifs.rpg.timeUp(enemy.name, (playerMaxHp))) + "\n\n" + enemy.losemsg;
		totalDmg += dmg;
	}

	if (skillEffects.charge && data.charge > 0) {
		message += "\n\n" + serifs.rpg.skill.charge;
		if (verboseLog) {
			buff += 1;
			message += `\n現在のチャージ: ${Math.round(data.charge * 100)}`;
		}
	} else if (data.charge < 0) {
		data.charge = 0;
	}

	message += "\n\n" + serifs.rpg.totalDmg(totalDmg);

	if (warriorTotalDmg > 0) {
		message += "\n" + serifs.rpg.warrior.totalDmg(warriorTotalDmg);
	}

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

	if (verboseLog) {
		const score = enemy ? Math.max(Math.log2((totalDmg * 20) / (1024 / ((enemy.power ?? 30) / 30))) + 1, 1) : undefined;
		if (score) message += `\n評価: ★${score.toFixed(2)}`;
	}

	if (aggregateTokensEffects(data).oomisoka && new Date().getMonth() === 11 && new Date().getDate() === 31) {
		const score = enemy ? Math.max(Math.log2((totalDmg * 20) / (1024 / ((enemy.power ?? 30) / 30))) + 1, 1) : undefined;
		if (score) {
			message += "\n\n" + serifs.rpg.oomisokaEnd(score.toFixed(2), Math.ceil(score * 8));
			data.coin += Math.ceil(score * 8);
		}
	}

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
		let atkUp = (2 + Math.floor(Math.random() * 4));
		let totalUp = 7;
		while (Math.random() < 0.335) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
		}

		if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

		if (skillEffects.statusBonus && skillEffects.statusBonus > 0 && data.lv % Math.max(2 / skillEffects.statusBonus, 1) === 0) {
			const upBonus = Math.ceil(skillEffects.statusBonus / 2);
			for (let i = 0; i < upBonus; i++) {
				totalUp += 1;
				if (Math.random() < 0.5) atkUp += 1;
			}
		}

		while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
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
 * @returns { totalDmg, me, lv, count, mark, skillsStr, reply } またはリアクションオブジェクト
 * @internal
 */
export async function getTotalDmg2(msg, enemy: RaidEnemy) {
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
	let playerMaxHp = Math.max(Math.round(bonusMaxHp * Math.random()), rawMaxHp);
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
		const rnd = Math.random() < (1/3);

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
		} else if (Math.random() < (1/2)) {
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
		if (playerHp <= 0 && !enemy.notEndure && Math.random() < endure) {
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
			while (Math.random() < (1/3)) {
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
		let atkUp = (2 + Math.floor(Math.random() * 4));
		let totalUp = 7;
		while (Math.random() < 0.335) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
		}

		if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

		while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
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
 * @returns { totalDmg, me, lv, count, mark, skillsStr, reply } またはリアクションオブジェクト
 * @internal
 */
export async function getTotalDmg3(msg, enemy: RaidEnemy) {
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
	let skillEffects;
	if (enemy.skillX) {
		skillEffects = aggregateSkillsEffectsSkillX(data, enemy.skillX);
	} else {
		skillEffects = aggregateSkillsEffects(data);
	}

	const stockRandomResult = stockRandom(data, skillEffects);

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

	// 所持しているスキル１つ度に、器用さ＋３
	dex += (data.skills?.length ?? 0) * 3;

	if (verboseLog) {
		buff += 1;
		message += `基本器用さ: ${dex}\n`;
	}

	if ((data.hatogurumaExp ?? 0) > 1) {
		buff += 1;
		const expBonus = Math.min(0.3, data.hatogurumaExp / 100);
		message += `経験 器用さ+${Math.round(expBonus * 100)}%` + `\n`;
		dex = dex * (1 + expBonus);
	}

	const atkDmgUp = (skillEffects.atkDmgUp ?? 0) - (skillEffects.defDmgUp ?? 0);
	const atkUp    = (skillEffects.atkUp    ?? 0) - (skillEffects.defUp    ?? 0);

	const atkX =
		(atkDmgUp && atkDmgUp > 0 ? (1 / (1 + (atkDmgUp ?? 0))) : 1) *
		(atkUp && atkUp > 0 ? (1 / (1 + (atkUp ?? 0))) : 1) *
		(color.reverseStatus ? (0.75 + (data.atk / ((data.atk + data.def) || 1)) * 0.5) : (0.75 + (data.def / ((data.atk + data.def) || 1)) * 0.5))

	if (atkX < 1) {
		buff += 1;
		message += `有り余るパワー 器用さ-${Math.floor((1 - atkX) * 100)}%` + `\n`;
		dex = dex * atkX;
	} else if (showInfo) {
		buff += 1;
		message += `パワー 適切` + `\n`;
	}

	if (skillEffects.notBattleBonusAtk >= 0.7) {
		buff += 1;
		message += `気性穏やか 器用さ+${Math.round(skillEffects.notBattleBonusAtk * 100)}%` + `\n`;
		dex = dex * (1 + (skillEffects.notBattleBonusAtk ?? 0));
	} else if (skillEffects.notBattleBonusAtk > 0) {
		buff += 1;
		message += `テキパキこなす 器用さ+${Math.round(skillEffects.notBattleBonusAtk * 100)}%` + `\n`;
		dex = dex * (1 + (skillEffects.notBattleBonusAtk ?? 0));
	} else if (showInfo && !skillEffects.notBattleBonusAtk) {
		buff += 1;
		message += `テキパキこなすまたは気性穏やか なし` + `\n`;
	}

	if ((skillEffects.notBattleBonusAtk ?? 0) < 0) {
		buff += 1;
		message += `気性が荒い 器用さ-${Math.min(25, Math.floor((skillEffects.notBattleBonusAtk * -1) * 100))}%` + `\n`;
		dex = dex * Math.max(0.75, (1 + skillEffects.notBattleBonusAtk));
	}

	if (skillEffects.notBattleBonusDef > 0) {
		buff += 1;
		message += `疲れにくい 器用さ+${Math.ceil(skillEffects.notBattleBonusDef * 25)}%` + `\n`;
		dex = dex * (1 + ((skillEffects.notBattleBonusDef ?? 0) / 4));
	} else if (showInfo) {
		buff += 1;
		message += `疲れにくい なし` + `\n`;
	}

	if (skillEffects.noAmuletAtkUp > 0) {
		buff += 1;
		message += `かるわざ 器用さ+${Math.ceil(skillEffects.noAmuletAtkUp * 200)}%` + `\n`;
		dex = dex * (1 + ((skillEffects.noAmuletAtkUp ?? 0) * 2));
	} else if (showInfo) {
		buff += 1;
		message += `かるわざ なし` + `\n`;
	}

	if (skillEffects.plusActionX > 0) {
		buff += 1;
		message += `高速RPG 器用さ+${Math.ceil(skillEffects.plusActionX * 8)}%` + `\n`;
		dex = dex * (1 + ((skillEffects.plusActionX ?? 0) * 0.08));
	} else if (showInfo) {
		buff += 1;
		message += `高速RPG なし` + `\n`;
	}

	if (skillEffects.atkRndMin > 0) {
		buff += 1;
		message += `安定感 器用さ+${Math.ceil(skillEffects.atkRndMin * 20)}%` + `\n`;
		dex = dex * (1 + ((skillEffects.atkRndMin ?? 0) / 5));
	} else if (showInfo) {
		buff += 1;
		message += `安定感 なし` + `\n`;
	}

	if (skillEffects.firstTurnItem > 0) {
		buff += 1;
		message += `準備を怠らない 器用さ+10%` + `\n`;
		dex = dex * 1.1;
	} else if (showInfo) {
		buff += 1;
		message += `準備を怠らない なし` + `\n`;
	}

	if (skillEffects.itemBoost > 0) {
		buff += 1;
		message += `道具効果量 器用さ+${Math.ceil(skillEffects.itemBoost * (100/5))}%` + `\n`;
		dex = dex * (1 + ((skillEffects.itemBoost ?? 0) / 5));
	} else if (showInfo) {
		buff += 1;
		message += `道具効果量 なし` + `\n`;
	}

	if (skillEffects.mindMinusAvoid > 0) {
		buff += 1;
		message += `道具の選択が上手い 器用さ+${Math.ceil(skillEffects.mindMinusAvoid * (100/3))}%` + `\n`;
		dex = dex * (1 + ((skillEffects.mindMinusAvoid ?? 0) / 3));
	} else if (showInfo) {
		buff += 1;
		message += `道具の選択が上手い なし` + `\n`;
	}

	if (skillEffects.amuletPower > 1) {
		buff += 1;
		message += `お守りパワー 器用さ+${Math.ceil((skillEffects.amuletPower-1) * 3)}%` + `\n`;
		dex = dex * (1 + ((skillEffects.amuletPower-1) * 0.03));
	}

	if (skillEffects.abortDown > 0) {
		buff += 1;
		message += `連続攻撃完遂率上昇 仕上げ+${Math.ceil(skillEffects.abortDown * 25)}%` + `\n`;
		fix += Math.floor(skillEffects.abortDown / 4)
	} else if (showInfo) {
		buff += 1;
		message += `連続攻撃完遂率上昇 なし` + `\n`;
	}

	if (skillEffects.tenacious > 0) {
		buff += 1;
		message += `粘り強さ 仕上げ+${Math.ceil(skillEffects.tenacious * 25)}%` + `\n`;
		fix += Math.floor(skillEffects.tenacious / 4)
	} else if (showInfo) {
		buff += 1;
		message += `粘り強さ なし` + `\n`;
	}

	if (skillEffects.endureUp > 0) {
		buff += 1;
		message += `気合で頑張る 仕上げ+${Math.ceil(skillEffects.endureUp * 15)}%` + `\n`;
		fix += Math.floor(skillEffects.endureUp * 0.15)
	} else if (showInfo) {
		buff += 1;
		message += `気合で頑張る なし` + `\n`;
	}

	// バフが1つでも付与された場合、改行を追加する
	if (buff > 0) message += "\n";
	buff = 0;

	if (dex < 150 && Math.random() < 0.1) {
		buff += 1;
		message += `${config.rpgHeroName}は調子が良さそうだ！\n器用さ+${Math.round((150 - dex) * 0.3)}%！` + `\n`;
		dex += Math.round((150 - dex) * 0.3)
	} else if (fix < 0.75 && Math.random() < 0.1) {
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
	const rndNum = Math.random();
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
	if (Math.random() < 0.5) {
		plus += dex < 120 ? 0.2 * (120/dex) : 0.2;
        if (!spFlg && Math.random() < (0.02 * Math.min(1, 50/dex))) {
            life = 15;
            if (Math.random() < dex/60) spFlg = true;
        }
	} else {
		life -= 1;
	}
  }

	const score = (dex < 120 ? (40 + dex *(2/3)) / 4 : dex / 4) * plus * (0.97 + (Math.random() * 0.06));
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
		let atkUp = (2 + Math.floor(Math.random() * 4));
		let totalUp = 7;
		while (Math.random() < 0.335) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
		}

		if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

		while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
			totalUp += 1;
			if (Math.random() < 0.5) atkUp += 1;
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

import 藍 from '@/ai';
import { Collection } from 'lokijs';
import Message from '@/message';
import { User } from '@/misskey/user';
import rpg from './index';
import { colors } from './colors';
import { endressEnemy, Enemy, RaidEnemy, raidEnemys } from './enemys';
import { rpgItems } from './items';
import {
  aggregateSkillsEffects,
  calcSevenFever,
  amuletMinusDurability,
  getSkillsShortName,
} from './skills';
import { aggregateTokensEffects } from './shop';
import {
  initializeData,
  getColor,
  getAtkDmg,
  getEnemyDmg,
  showStatusDmg,
  getPostCount,
  getPostX,
  getVal,
  random,
  getRaidPostX,
} from './utils';
import { calculateStats, fortune } from './battle';
import serifs from '@/serifs';
import getDate from '@/utils/get-date';
import { acct } from '@/utils/acct';
import seedrandom from 'seedrandom';

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
      amulets?: string | undefined;
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
 * 終了すべきレイドがないかチェック
 */
function crawleGameEnd() {
  /** 現在進行中のレイド */
  const raid = raids.findOne({
    isEnded: false,
  });

  if (raid == null) return;

  // 制限時間が経過していたらレイドを終了する
  if (Date.now() - (raid.finishedAt ?? raid.startedAt + 1000 * 60 * 10) >= 0) {
    finish(raid);
  }
}

/**
 * レイド開始時間をスケジュール
 */
function scheduleRaidStart() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // 12:15, 12:45, 18:15, 21:15 にレイドを開始する
  if (
    (hours === 12 && (minutes === 15 || minutes === 45)) ||
    ((hours === 18 || hours === 21) && minutes === 15)
  ) {
    start();
  }

  // ランダムな時間にレイドを開始する
  const day = new Date().getDay();
  const randomHours = [7, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 22];
  const randomMinutes = [0, 15, 30, 45];
  let rnd = seedrandom(getDate() + ai.account.id);
  if (
    hours === randomHours[Math.floor(rnd() * randomHours.length)] &&
    minutes === randomMinutes[Math.floor(rnd() * randomMinutes.length)]
  ) {
    start();
  }
}

/**
 * レイドボスを開始します
 * @param triggerUserId スタートさせたユーザID
 * @param flg 特殊なフラグ
 */
export async function start(triggerUserId?: string, flg?: any) {
  /** すべてのレイドゲームのリスト */
  const games = raids.find({});

  if (Date.now() - games[games.length - 1].startedAt < 31 * 60 * 1000) return;

  ai.decActiveFactor();

  const recentRaidList = games
    .slice(Math.min((raidEnemys.length - 1) * -1, -6))
    .map((obj) => obj.enemy.name ?? '');

  /** 過去のレイドボスを除外したリスト */
  const filteredRaidEnemys = raidEnemys.filter(
    (x) => !recentRaidList.includes(x.name),
  );

  /** ランダムに選ばれたレイドボス */
  const enemy =
    filteredRaidEnemys[Math.floor(Math.random() * filteredRaidEnemys.length)];

  // レイドの制限時間（分）
  let limitMinutes = 30;

  /** レイド開始の投稿 */
  const post = await ai.post({
    text: serifs.rpg.intro(
      enemy.dname ?? enemy.name,
      Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000),
    ),
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
  module_.setTimeoutWithPersistence((1000 * 60 * limitMinutes) / 2, {
    id: post.id,
  });

  module_.log('New raid started');
}

/**
 * ゲームを終了させる
 * @param raid 終了させるレイド
 */
function finish(raid: Raid) {
  raid.isEnded = true;
  raids.update(raid);

  module_.log('raid finished');

  // 攻撃者がいない場合
  if (!raid.attackers?.filter((x) => x.dmg > 1).length) {
    ai.decActiveFactor(
      (raid.finishedAt.valueOf() - raid.startedAt.valueOf()) /
        (60 * 1000 * 100),
    );

    ai.post({
      text: serifs.rpg.onagare(raid.enemy.name),
      renoteId: raid.postId,
    });

    return;
  }

  /** 結果の文字列配列 */
  let results: string[] = [];

  /** ユーザーIDのセット */
  const seenIds = new Set();

  /** 攻撃者のリストをフィルタリングしてダメージ順にソート */
  let sortAttackers = raid.attackers
    .filter((attacker) => {
      if (attacker.dmg <= 0) return false;
      if (seenIds.has(attacker.user.id)) {
        return false;
      } else {
        seenIds.add(attacker.user.id);
        return true;
      }
    })
    .sort((a, b) => b.dmg - a.dmg);

  /** 攻撃者の最大レベルの桁数 */
  let levelSpace = String(
    raid.attackers.reduce((pre, cur) => (pre > cur.lv ? pre : cur.lv), 0),
  ).length;

  /** 総ダメージ */
  const total = sortAttackers.reduce((pre, cur) => pre + cur.dmg, 0);

  /** 評価スコア */
  const score = Math.max(
    Math.floor(Math.log2(total / (1024 / ((raid.enemy.power ?? 30) / 30))) + 1),
    1,
  );

  if (sortAttackers?.[0]) {
    if (sortAttackers?.[0].mark === ':blank:') {
      sortAttackers[0].mark = '👑';
    }
    const friend = ai.lookupFriend(sortAttackers?.[0].user.id);
    if (!friend) return;
    const data = friend.getPerModulesData(module_);
    data.coin = Math.max((data.coin ?? 0) + 1, data.coin);
    friend.setPerModulesData(module_, data);
  }

  let references: string[] = [];

  for (let attacker of sortAttackers) {
    results.push(
      `${attacker.me} ${acct(attacker.user)}:\n${attacker.mark === ':blank:' && attacker.dmg === 100 ? '💯' : attacker.mark} Lv${String(attacker.lv).padStart(levelSpace, ' ')} ${attacker.count}ターン ${attacker.dmg.toLocaleString()}ダメージ`,
    );
    if (references.length < 100) {
      if (attacker.replyId) references.push(attacker.replyId);
    }
  }

  if (sortAttackers.length > 1) {
    results.push(
      `\n合計: ${sortAttackers.length}人 ${total.toLocaleString()}ダメージ\n評価: ${'★'.repeat(score)}`,
    );
  } else {
    results.push(`\n評価: ${'★'.repeat(score)}`);
  }

  /** RPGモジュールのデータ */
  const rpgData = ai.moduleData.findOne({ type: 'rpg' });
  if (rpgData) {
    if (!rpgData.raidScore) rpgData.raidScore = {};
    if (!rpgData.raidScoreDate) rpgData.raidScoreDate = {};
    if (
      !rpgData.raidScore[raid.enemy.name] ||
      rpgData.raidScore[raid.enemy.name] < total
    ) {
      if (rpgData.raidScore[raid.enemy.name]) {
        results.push(
          '\n' +
            serifs.rpg.GlobalHiScore(
              rpgData.raidScore[raid.enemy.name],
              rpgData.raidScoreDate[raid.enemy.name] ?? '',
              total,
            ),
        );
      }
      rpgData.raidScore[raid.enemy.name] = total;
      rpgData.raidScoreDate[raid.enemy.name] = getDate();
    }
    ai.moduleData.update(rpgData);
  } else {
    ai.moduleData.insert({
      type: 'rpg',
      maxLv: 1,
      raidScore: { [raid.enemy.name]: total },
      raidScoreDate: { [raid.enemy.name]: getDate() },
    });
  }

  const text =
    results.join('\n') + '\n\n' + serifs.rpg.finish(raid.enemy.name, score);

  sortAttackers.forEach((x) => {
    const friend = ai.lookupFriend(x.user.id);
    if (!friend) return;
    const data = friend.getPerModulesData(module_);
    data.coin = Math.max((data.coin ?? 0) + (score ?? 1), data.coin);
    friend.setPerModulesData(module_, data);
  });

  ai.post({
    text: text,
    cw: serifs.rpg.finishCw(raid.enemy.name),
    renoteId: raid.postId,
    referenceIds: references,
  });

  module_.unsubscribeReply(raid.postId);
  raid.replyKey.forEach((x) => module_.unsubscribeReply(x));
}

/**
 * レイドのコンテキストフック
 * @param key レイドのキー
 * @param msg メッセージオブジェクト
 * @param data データオブジェクト
 * @returns リアクションオブジェクト
 */
export async function raidContextHook(key: any, msg: Message, data: any) {
  if (!msg.extractedText.trim())
    return {
      reaction: 'hmm',
    };

  const _data = msg.friend.getPerModulesData(module_);
  if (!_data.lv) {
    msg.reply('RPGモードを先に1回プレイしてください！');
    return {
      reaction: 'hmm',
    };
  }

  /** 現在進行中のレイド */
  const raid = raids.findOne({
    isEnded: false,
    postId: key.split(':')[0],
  });

  if (raid == null) return;

  if (raid.attackers.some((x) => x.user.id == msg.userId)) {
    msg.reply('すでに参加済みのようじゃ！').then((reply) => {
      raid.replyKey.push(raid.postId + ':' + reply.id);
      module_.subscribeReply(raid.postId + ':' + reply.id, reply.id);
      raids.update(raid);
    });
    return {
      reaction: 'confused',
    };
  }

  /** 現在のレイドの敵 */
  const enemy = [...raidEnemys].find((x) => raid.enemy.name === x.name);

  if (!enemy) return;

  /** 総ダメージの計算結果 */
  const result = await getTotalDmg(msg, enemy);

  if (raid.attackers.some((x) => x.user.id == msg.userId)) {
    msg.reply('すでに参加済みのようじゃ！').then((reply) => {
      raid.replyKey.push(raid.postId + ':' + reply.id);
      module_.subscribeReply(raid.postId + ':' + reply.id, reply.id);
      raids.update(raid);
    });
    return {
      reaction: 'confused',
    };
  }

  module_.log(`damage ${result.totalDmg} by ${msg.user.id}`);

  raid.attackers.push({
    user: {
      id: msg.user.id,
      username: msg.user.username,
      host: msg.user.host,
    },
    dmg: result.totalDmg ?? 0,
    me: result.me ?? '',
    lv: result.lv ?? 1,
    count: result.count ?? 1,
    skillsStr: result.skillsStr ?? { skills: undefined, amulets: undefined },
    mark: result.mark ?? ':blank:',
    replyId: result.reply.id ?? undefined,
  });

  raids.update(raid);

  return {
    reaction: result.me,
  };
}

/**
 * レイドタイムアウトコールバック
 * @param data タイムアウトデータ
 */
export function raidTimeoutCallback(data: any) {
  /** 現在進行中のレイド */
  const raid = raids.findOne({
    isEnded: false,
    postId: data.id,
  });
  if (raid == null) return;

  try {
    ai.post({
      renoteId: data.id,
    });
  } catch (err) {
    return;
  }
}

export async function getTotalDmg(msg, enemy: RaidEnemy) {
  // データを読み込み
  const data = initializeData(module_, msg);
  if (!data.lv)
    return {
      reaction: 'confused',
    };
  data.raid = true;
  const colorData = colors.map((x) => x.unlock(data));
  // 所持しているスキル効果を読み込み
  const skillEffects = aggregateSkillsEffects(data);

  const skillsStr = getSkillsShortName(data);

  /** 現在の敵と戦ってるターン数。 敵がいない場合は1 */
  let count = 1;

  /** 使用中の色情報 */
  let color = getColor(data);

  /** 覚醒状態か？*/
  const isSuper =
    Math.random() < 0.02 + Math.max(data.superPoint / 200, 0) ||
    color.alwaysSuper;

  /** 投稿数（今日と明日の多い方）*/
  let postCount = 0;
  let continuousBonusNum = 0;
  if (enemy.forcePostCount) {
    postCount = enemy.forcePostCount;
  } else {
    postCount = await getPostCount(ai, module_, data, msg, isSuper ? 200 : 0);

    continuousBonusNum = Math.min(Math.max(10, postCount / 2), 25);

    postCount = postCount + continuousBonusNum;
  }

  // 投稿数に応じてステータス倍率を得る
  /** ステータス倍率（投稿数） */
  let tp = getRaidPostX(postCount) * (1 + (skillEffects.postXUp ?? 0));

  if (!isSuper) {
    data.superPoint = Math.max(data.superPoint ?? 0 - (tp - 2), -3);
  } else {
    data.superPoint = 0;
  }

  /** 画面に出力するメッセージ:CW */
  let cw = acct(msg.user) + ' ';
  /** 画面に出力するメッセージ:Text */
  let message = '';

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
    `Lv${data.lv}`,
    `${(Math.max(data.atk, data.def) / (data.atk + data.def)) * 100 <= 53 ? '' : data.atk > data.def ? serifs.rpg.status.atk.slice(0, 1) : serifs.rpg.status.def.slice(0, 1)}${((Math.max(data.atk, data.def) / (data.atk + data.def)) * 100).toFixed(0)}%`,
    skillsStr.skills,
    skillsStr.amulet ? `お守り ${skillsStr.amulet}` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  message += `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;

  /** バフを得た数。行数のコントロールに使用 */
  let buff = 0;

  if (enemy.forcePostCount) {
    buff += 1;
    message += serifs.rpg.forcePostCount + `\n`;
    if (aggregateTokensEffects(data).showPostBonus) {
      buff += 1;
      message +=
        serifs.rpg.postBonusInfo.post(
          postCount,
          tp > 1
            ? '+' + Math.floor((tp - 1) * 100)
            : '-' + Math.floor((tp - 1) * 100),
        ) + `\n`;
    }
  } else {
    if (aggregateTokensEffects(data).showPostBonus) {
      buff += 1;
      if (continuousBonusNum)
        message +=
          serifs.rpg.postBonusInfo.continuous.a(
            Math.floor(continuousBonusNum),
          ) + `\n`;
      if (isSuper) {
        message += serifs.rpg.postBonusInfo.super + `\n`;
      }
      message +=
        serifs.rpg.postBonusInfo.post(
          postCount,
          tp > 1
            ? '+' + Math.floor((tp - 1) * 100)
            : '-' + Math.floor((tp - 1) * 100),
        ) + `\n`;
    }
  }

  // ここで残りのステータスを計算しなおす
  let { atk, def, spd } = calculateStats(data, msg, skillEffects, color);
  if (skillEffects.fortuneEffect) {
    const result = fortune(atk, def, skillEffects.fortuneEffect);
    atk = result.atk;
    def = result.def;
    message += serifs.rpg.skill.fortune + `\n`;
    message += result.message + `\n`;
  }
  /** 敵の最大HP */
  let enemyMaxHp = 100000;
  /** 敵のHP */
  let enemyHp = 100000;
  /** 連続攻撃中断の場合の攻撃可能回数 0は最後まで攻撃 */
  let abort = 0;
  /** プレイヤーのHP */
  let playerHp = 100 + lv * 3;
  /** プレイヤーのHP割合 */
  let playerHpPercent = playerHp / (100 + lv * 3);
  /** 敵のHP割合 */
  let enemyHpPercent = 1;
  /** 使用したアイテム */
  let item;
  /** アイテムによって増加したステータス */
  let itemBonus = { atk: 0, def: 0 };

  /** これって戦闘？ */
  let isBattle = enemy.atkmsg(0).includes('ダメージ');

  /** これって物理戦闘？ */
  let isPhysical = !enemy.atkmsg(0).includes('精神');

  /** ダメージ発生源は疲れ？ */
  let isTired = enemy.defmsg(0).includes('疲');

  let totalDmg = 0;

  if (isSuper) {
    const superColor =
      colors.find((x) => x.alwaysSuper)?.name ??
      colors.find((x) => x.default)?.name ??
      colors[0]?.name;
    const up = Math.max(spd + 2, Math.round(getSpd(getSpdX(spd) * 1.2))) - spd;
    if (me !== superColor) {
      // バフが1つでも付与された場合、改行を追加する
      if (buff > 0) message += '\n';
      buff += 1;
      me = superColor;
      message += serifs.rpg.super(me, up) + `\n`;
      data.superCount = (data.superCount ?? 0) + 1;
    }
    spd = spd + up;
  }

  if (skillEffects.heavenOrHell) {
    if (Math.random() < 0.6) {
      message += serifs.rpg.skill.heaven + '\n';
      atk = atk * (1 + skillEffects.heavenOrHell);
      def = def * (1 + skillEffects.heavenOrHell);
    } else {
      message += serifs.rpg.skill.hell + '\n';
      atk = atk / (1 + skillEffects.heavenOrHell);
      def = def / (1 + skillEffects.heavenOrHell);
    }
  }

  let mark = ':blank:';

  // ７フィーバー
  let sevenFever = skillEffects.sevenFever
    ? calcSevenFever([data.lv, data.atk, data.def]) * skillEffects.sevenFever
    : 0;
  if (sevenFever) {
    if (sevenFever / (skillEffects.sevenFever ?? 1) > 7) mark = '7️⃣';
    buff += 1;
    message += serifs.rpg.skill.sevenFever(sevenFever) + '\n';
    atk = atk * (1 + sevenFever / 100);
    def = def * (1 + sevenFever / 100);
  }

  // 風魔法発動時
  let spdUp =
    getSpd(getSpdX(spd) * (1 + (skillEffects.spdUp ?? 0))) -
    getSpd(getSpdX(spd));
  if (Math.random() < spdUp % 1) {
    spdUp = Math.floor(spdUp) + 1;
  } else {
    spdUp = Math.floor(spdUp);
  }
  if (isBattle && isPhysical && spdUp) {
    buff += 1;
    message += serifs.rpg.skill.wind(spdUp) + '\n';
    spd = spd + spdUp;
  } else if (!(isBattle && isPhysical)) {
    // 非戦闘時は速度は上がらないが、パワーに還元される
    atk = atk * (1 + (skillEffects.spdUp ?? 0));
  }

  // 非戦闘なら非戦闘時スキルが発動
  if (!isBattle) {
    atk = atk * (1 + (skillEffects.notBattleBonusAtk ?? 0));
  }
  if (isTired) {
    def = def * (1 + (skillEffects.notBattleBonusDef ?? 0));
  }

  // 敵のステータスを計算
  /** 敵の攻撃力 */
  let enemyAtk =
    typeof enemy.atk === 'function'
      ? enemy.atk(atk, def, spd)
      : lv * 3.5 * (enemy.atk ?? 1);
  /** 敵の防御力 */
  let enemyDef =
    typeof enemy.def === 'function'
      ? enemy.def(atk, def, spd)
      : lv * 3.5 * (enemy.def ?? 1);

  if (skillEffects.enemyStatusBonus) {
    const enemyStrongs =
      (enemyAtk / (lv * 3.5)) * (getVal(enemy.atkx, [tp]) ?? 3) +
      (enemyDef / (lv * 3.5)) * (getVal(enemy.defx, [tp]) ?? 3);
    const bonus = Math.floor(
      (enemyStrongs / 4) * skillEffects.enemyStatusBonus,
    );
    atk = atk * (1 + bonus / 100);
    def = def * (1 + bonus / 100);
    if (bonus / skillEffects.enemyStatusBonus >= 5) {
      buff += 1;
      message += serifs.rpg.skill.enemyStatusBonus + '\n';
    }
  }

  if (skillEffects.firstTurnResist && count === 1 && isBattle && isPhysical) {
    buff += 1;
    message += serifs.rpg.skill.firstTurnResist + '\n';
  }

  enemyDef -= atk * (skillEffects.arpen ?? 0);

  // バフが1つでも付与された場合、改行を追加する
  if (buff > 0) message += '\n';

  if (skillEffects.plusActionX) {
    atk = atk * (1 + (skillEffects.plusActionX ?? 0) / 10);
  }

  if (skillEffects.escape) {
    def = def * (1 + (skillEffects.escape ?? 0) / 10);
  }

  if (skillEffects.enemyCritDmgDown) {
    def = def * (1 + (skillEffects.enemyCritDmgDown ?? 0) / 30);
  }
  if (skillEffects.enemyBuff) {
    atk = atk * 1.05;
    def = def * 1.05;
  }

  const _atk = atk;
  const _def = def;
  const _spd = spd;

  const plusActionX = 5;

  for (let actionX = 0; actionX < plusActionX + 1; actionX++) {
    /** バフを得た数。行数のコントロールに使用 */
    let buff = 0;

    /** プレイヤーのHP割合 */
    let playerHpPercent = playerHp / (100 + lv * 3);
    /** 敵のHP割合 */
    let enemyHpPercent = 0.5 + 0.5 * ((6 - (count - 1)) / 6);

    if (
      skillEffects.tenacious &&
      playerHpPercent < 0.5 &&
      isBattle &&
      isPhysical
    ) {
      buff += 1;
      message += serifs.rpg.skill.tenacious + '\n';
    }

    item = undefined;
    atk = _atk;
    def = _def;
    spd = _spd;
    itemBonus = { atk: 0, def: 0 };

    // spdが低い場合、確率でspdが+1。
    if (spd === 2 && Math.random() < 0.2) {
      buff += 1;
      message += serifs.rpg.spdUp + '\n';
      spd = 3;
    }
    if (spd === 1 && Math.random() < 0.6) {
      buff += 1;
      message += serifs.rpg.spdUp + '\n';
      spd = 2;
    }

    // HPが1/7以下で相手とのHP差がかなりある場合、決死の覚悟のバフを得る
    if (
      playerHpPercent <= (1 / 7) * (1 + (skillEffects.haisuiUp ?? 0)) &&
      enemyHpPercent - playerHpPercent >=
        0.5 / (1 + (skillEffects.haisuiUp ?? 0))
    ) {
      buff += 1;
      message += serifs.rpg.haisui + '\n';
      const effect = Math.min(
        (enemyHpPercent - playerHpPercent) * (1 + (skillEffects.haisuiUp ?? 0)),
        1,
      );
      atk = atk + Math.round(def * effect);
      def = Math.round(def * (1 - effect));
    }

    const itemEquip = 0.4 + (1 - playerHpPercent) * 0.6;
    if (
      rpgItems.length &&
      ((count === 1 && skillEffects.firstTurnItem) ||
        Math.random() < itemEquip * (1 + (skillEffects.itemEquip ?? 0)))
    ) {
      //アイテム
      buff += 1;
      if (count === 1 && skillEffects.firstTurnItem)
        message += serifs.rpg.skill.firstItem;
      if (enemy.pLToR) {
        let isPlus = Math.random() < 0.5;
        const items = rpgItems.filter((x) =>
          isPlus ? x.mind > 0 : x.mind < 0,
        );
        item = items[Math.floor(Math.random() * items.length)];
      } else {
        let types = ['weapon', 'armor'];
        for (let i = 0; i < (skillEffects.weaponSelect ?? 0); i++) {
          types.push('weapon');
        }
        for (let i = 0; i < (skillEffects.armorSelect ?? 0); i++) {
          types.push('armor');
        }
        if ((count !== 1 || enemy.pLToR) && !skillEffects.lowHpFood) {
          types.push('medicine');
          types.push('poison');
          for (let i = 0; i < (skillEffects.foodSelect ?? 0); i++) {
            types.push('medicine');
            types.push('poison');
          }
        }
        if (
          (count !== 1 || enemy.pLToR) &&
          skillEffects.lowHpFood &&
          Math.random() < skillEffects.lowHpFood * playerHpPercent
        ) {
          if (playerHpPercent < 0.5) message += serifs.rpg.skill.lowHpFood;
          types = ['medicine', 'poison'];
        }
        const type = types[Math.floor(Math.random() * types.length)];
        if (
          (type === 'weapon' && !(isBattle && isPhysical)) ||
          (type === 'armor' && isTired) ||
          enemy.pLToR
        ) {
          let isPlus =
            Math.random() <
            0.5 +
              (skillEffects.mindMinusAvoid ?? 0) +
              (count === 1 ? skillEffects.firstTurnMindMinusAvoid ?? 0 : 0);
          const items = rpgItems.filter(
            (x) => x.type === type && (isPlus ? x.mind > 0 : x.mind < 0),
          );
          item = items[Math.floor(Math.random() * items.length)];
        } else {
          const items = rpgItems.filter((x) => x.type === type && x.effect > 0);
          item = items[Math.floor(Math.random() * items.length)];
        }
      }
      const mindMsg = (mind) => {
        if (mind >= 100) {
          message += `阨ちゃんの気合が特大アップ！\n`;
        } else if (mind >= 70) {
          message += `阨ちゃんの気合が大アップ！\n`;
        } else if (mind > 30) {
          message += `阨ちゃんの気合がアップ！\n`;
        } else if (mind > 0) {
          message += `阨ちゃんの気合が小アップ！\n`;
        } else if (mind > -50) {
          message += `あまり良い気分ではないようだ…\n`;
        } else {
          message += `阨ちゃんの気合が下がった…\n`;
        }
      };
      if (item.type !== 'poison') {
        item.effect = Math.round(
          item.effect * (1 + (skillEffects.itemBoost ?? 0)),
        );
        if (item.type === 'weapon')
          item.effect = Math.round(
            item.effect * (1 + (skillEffects.weaponBoost ?? 0)),
          );
        if (item.type === 'armor')
          item.effect = Math.round(
            item.effect * (1 + (skillEffects.armorBoost ?? 0)),
          );
        if (item.type === 'medicine')
          item.effect = Math.round(
            item.effect * (1 + (skillEffects.foodBoost ?? 0)),
          );
      } else {
        item.effect = Math.round(
          item.effect / (1 + (skillEffects.itemBoost ?? 0)),
        );
        item.effect = Math.round(
          item.effect / (1 + (skillEffects.poisonResist ?? 0)),
        );
      }
      if (item.mind < 0) {
        item.mind = Math.round(item.mind / (1 + (skillEffects.itemBoost ?? 0)));
      } else {
        item.mind = Math.round(item.mind * (1 + (skillEffects.itemBoost ?? 0)));
      }
      switch (item.type) {
        case 'weapon':
          message += `${item.name}を取り出し、装備した！\n`;
          if (!(isBattle && isPhysical)) {
            mindMsg(item.mind);
            if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
            itemBonus.atk = atk * (item.mind * 0.0025);
            itemBonus.def = def * (item.mind * 0.0025);
            atk = atk + itemBonus.atk;
            def = def + itemBonus.def;
          } else {
            itemBonus.atk = lv * 4 * (item.effect * 0.005);
            atk = atk + itemBonus.atk;
            if (item.effect >= 100) {
              message += `阨ちゃんのパワーが特大アップ！\n`;
            } else if (item.effect >= 70) {
              message += `阨ちゃんのパワーが大アップ！\n`;
            } else if (item.effect > 30) {
              message += `阨ちゃんのパワーがアップ！\n`;
            } else {
              message += `阨ちゃんのパワーが小アップ！\n`;
            }
          }
          break;
        case 'armor':
          message += `${item.name}を取り出し、装備した！\n`;
          if (isTired) {
            mindMsg(item.mind);
            if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
            itemBonus.atk = atk * (item.mind * 0.0025);
            itemBonus.def = def * (item.mind * 0.0025);
            atk = atk + itemBonus.atk;
            def = def + itemBonus.def;
          } else {
            itemBonus.def = lv * 4 * (item.effect * 0.005);
            def = def + itemBonus.def;
            if (item.effect >= 100) {
              message += `阨ちゃんの防御が特大アップ！\n`;
            } else if (item.effect >= 70) {
              message += `阨ちゃんの防御が大アップ！\n`;
            } else if (item.effect > 30) {
              message += `阨ちゃんの防御がアップ！\n`;
            } else {
              message += `阨ちゃんの防御が小アップ！\n`;
            }
          }
          break;
        case 'medicine':
          message += `${item.name}を取り出し、食べた！\n`;
          if (enemy.pLToR) {
            mindMsg(item.mind);
            if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
            itemBonus.atk = atk * (item.mind * 0.0025);
            itemBonus.def = def * (item.mind * 0.0025);
            atk = atk + itemBonus.atk;
            def = def + itemBonus.def;
          } else {
            const heal = Math.round(
              (100 + lv * 3 - playerHp) * (item.effect * 0.005),
            );
            playerHp += heal;
            if (heal > 0) {
              if (item.effect >= 100 && heal >= 50) {
                message += `阨ちゃんの体力が特大回復！\n${heal}ポイント回復した！\n`;
              } else if (item.effect >= 70 && heal >= 35) {
                message += `阨ちゃんの体力が大回復！\n${heal}ポイント回復した！\n`;
              } else if (item.effect > 30 && heal >= 15) {
                message += `阨ちゃんの体力が回復！\n${heal}ポイント回復した！\n`;
              } else {
                message += `阨ちゃんの体力が小回復！\n${heal}ポイント回復した！\n`;
              }
            }
          }
          break;
        case 'poison':
          if (Math.random() < (skillEffects.poisonAvoid ?? 0)) {
            message += `${item.name}を取り出したが、美味しそうでなかったので捨てた！\n`;
          } else {
            message += `${item.name}を取り出し、食べた！\n`;
            if (enemy.pLToR) {
              mindMsg(item.mind);
              if (item.mind < 0 && isSuper) item.mind = item.mind / 2;
              itemBonus.atk = atk * (item.mind * 0.0025);
              itemBonus.def = def * (item.mind * 0.0025);
              atk = atk + itemBonus.atk;
              def = def + itemBonus.def;
            } else {
              const dmg = Math.round(
                playerHp * (item.effect * 0.003) * (isSuper ? 0.5 : 1),
              );
              playerHp -= dmg;
              if (item.effect >= 70 && dmg > 0) {
                message += `阨ちゃんはかなり調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`;
              } else if (item.effect > 30 && dmg > 0) {
                message += `阨ちゃんは調子が悪くなった…\n${dmg}ポイントのダメージを受けた！\n`;
              } else {
                message += `あまり美味しくなかったようだ…${dmg > 0 ? `\n${dmg}ポイントのダメージを受けた！` : ''}\n`;
              }
            }
          }
          break;
        default:
          break;
      }
      if (aggregateTokensEffects(data).showItemBonus) {
        const itemMessage = [
          `${itemBonus.atk ? `${serifs.rpg.status.atk}+${itemBonus.atk.toFixed(0)}` : ''}`,
          `${itemBonus.def ? `${serifs.rpg.status.def}+${itemBonus.def.toFixed(0)}` : ''}`,
        ]
          .filter(Boolean)
          .join(' / ');
        if (itemMessage) {
          message += `(${itemMessage})\n`;
        }
      }
    }

    // 敵に最大ダメージ制限がある場合、ここで計算
    /** 1ターンに与えられる最大ダメージ量 */
    let maxdmg = enemy.maxdmg ? enemyMaxHp * enemy.maxdmg : undefined;

    // 土属性剣攻撃
    if (skillEffects.dart && isBattle && isPhysical && maxdmg) {
      buff += 1;
      message += serifs.rpg.skill.dart + '\n';
      maxdmg = maxdmg * (1 + skillEffects.dart);
    } else if (skillEffects.dart && !(isBattle && isPhysical && maxdmg)) {
      // 効果がない場合非戦闘時は、パワーに還元される
      atk = atk * (1 + skillEffects.dart * 0.5);
    }

    let trueDmg = 0;

    // 炎属性剣攻撃
    if (skillEffects.fire && isBattle && isPhysical) {
      buff += 1;
      message += serifs.rpg.skill.fire + '\n';
      trueDmg = Math.ceil(lv * skillEffects.fire);
    } else if (skillEffects.fire && !(isBattle && isPhysical)) {
      // 非戦闘時は、パワーに還元される
      atk = atk + lv * 3.75 * skillEffects.fire;
    }

    // 毒属性剣攻撃
    if (skillEffects.weak && count > 1) {
      if (isBattle && isPhysical) {
        buff += 1;
        message += serifs.rpg.skill.weak(enemy.dname ?? enemy.name) + '\n';
      }
      enemyAtk = Math.max(enemyAtk * (1 - skillEffects.weak * (count - 1)), 0);
      enemyDef = Math.max(enemyDef * (1 - skillEffects.weak * (count - 1)), 0);
    }

    // バフが1つでも付与された場合、改行を追加する
    if (buff > 0) message += '\n';

    // 敵が中断能力持ちの場合、ここで何回攻撃可能か判定
    for (let i = 1; i < spd; i++) {
      if (
        enemy.abort &&
        Math.random() < enemy.abort * (1 - (skillEffects.abortDown ?? 0))
      ) {
        abort = i;
        break;
      }
    }

    if (!enemy.abort && skillEffects.abortDown) {
      // 効果がない場合は、パワーに還元される
      atk = atk * (1 + skillEffects.abortDown * (1 / 3));
    }

    const defDmgX = Math.max(
      1 *
        (1 + Math.max(skillEffects.defDmgUp ?? 0, -0.9)) *
        (count === 1 && skillEffects.firstTurnResist
          ? 1 - (skillEffects.firstTurnResist ?? 0)
          : 1) *
        (count === 2 &&
        skillEffects.firstTurnResist &&
        skillEffects.firstTurnResist > 1
          ? 1 - ((skillEffects.firstTurnResist ?? 0) - 1)
          : 1) *
        (1 -
          Math.min((skillEffects.tenacious ?? 0) * (1 - playerHpPercent), 0.9)),
      0,
    );

    const atkMinRnd = Math.max(
      0.2 + (isSuper ? 0.3 : 0) + (skillEffects.atkRndMin ?? 0),
      0,
    );
    const atkMaxRnd = Math.max(
      1.6 + (isSuper ? -0.3 : 0) + (skillEffects.atkRndMax ?? 0),
      0,
    );
    const defMinRnd = Math.max(0.2 + (skillEffects.defRndMin ?? 0), 0);
    const defMaxRnd = Math.max(
      1.6 + (isSuper ? -0.3 : 0) + (skillEffects.defRndMax ?? 0),
      0,
    );

    /** 予測最大ダメージ */
    let predictedDmg =
      Math.round(
        atk *
          tp *
          (atkMinRnd + atkMaxRnd) *
          (1 / ((enemyDef * (getVal(enemy.defx, [tp]) ?? 3) + 100) / 100)),
      ) * (abort || spd);

    // 予測最大ダメージは最大ダメージ制限を超えない
    if (maxdmg && predictedDmg > maxdmg) predictedDmg = maxdmg;

    /** 敵のターンが既に完了したかのフラグ */
    let enemyTurnFinished = false;

    let endureCount = 1 + (skillEffects.endureUp ?? 0) * 2;

    const _data = { ...data, enemy, count };

    // 敵先制攻撃の処理
    // spdが1ではない、または戦闘ではない場合は先制攻撃しない
    if (!enemy.spd && !enemy.hpmsg && !isTired) {
      /** クリティカルかどうか */
      const crit =
        Math.random() <
        (playerHpPercent - enemyHpPercent) *
          (1 - (skillEffects.enemyCritDown ?? 0));
      // 予測最大ダメージが相手のHPの何割かで先制攻撃の確率が判定される
      if (
        Math.random() < predictedDmg / enemyHp ||
        (count === 3 && enemy.fire && (data.thirdFire ?? 0) <= 2)
      ) {
        const rng =
          defMinRnd + random(data, startCharge, skillEffects, true) * defMaxRnd;
        if (aggregateTokensEffects(data).showRandom)
          message += `⚂ ${Math.floor(rng * 100)}%\n`;
        const critDmg = 1 + (skillEffects.enemyCritDmgDown ?? 0) * -1;
        /** ダメージ */
        const dmg = getEnemyDmg(
          _data,
          def,
          tp,
          1,
          crit ? critDmg : false,
          enemyAtk,
          rng * defDmgX,
          getVal(enemy.atkx, [tp]),
        );
        const noItemDmg = getEnemyDmg(
          _data,
          def - itemBonus.def,
          tp,
          1,
          crit ? critDmg : false,
          enemyAtk,
          rng * defDmgX,
          getVal(enemy.atkx, [tp]),
        );
        // ダメージが負けるほど多くなる場合は、先制攻撃しない
        if (
          playerHp > dmg ||
          (count === 3 && enemy.fire && (data.thirdFire ?? 0) <= 2)
        ) {
          playerHp -= dmg;
          message +=
            (crit ? `**${enemy.defmsg(dmg)}**` : enemy.defmsg(dmg)) + '\n';
          if (noItemDmg - dmg > 1) {
            message += `(道具効果: -${noItemDmg - dmg})\n`;
          }
          if (playerHp <= 0 && !enemy.notEndure) {
            message += serifs.rpg.endure + '\n';
            playerHp = 1;
          }
          message += '\n';
          enemyTurnFinished = true;
          if (enemy.fire && count > (data.thirdFire ?? 0))
            data.thirdFire = count;
          if (dmg > (data.superMuscle ?? 0)) data.superMuscle = dmg;
        }
      }
    }

    if (skillEffects.allForOne) {
      const spdx = getSpdX(spd);
      atk = atk * spdx * 1.1;
      if (itemBonus?.atk) itemBonus.atk = itemBonus.atk * spd * 1.1;
      spd = 1;
    }

    // 自身攻撃の処理
    // spdの回数分、以下の処理を繰り返す
    for (let i = 0; i < spd; i++) {
      const rng =
        atkMinRnd + random(data, startCharge, skillEffects, false) * atkMaxRnd;
      if (aggregateTokensEffects(data).showRandom)
        message += `⚂ ${Math.floor(rng * 100)}%\n`;
      const dmgBonus =
        (1 + (skillEffects.atkDmgUp ?? 0)) *
          (i < 2 ? 1 : i < 3 ? 0.5 : i < 4 ? 0.25 : 0.125) +
        (skillEffects.thunder
          ? (skillEffects.thunder * ((i + 1) / spd)) /
            (spd === 1 ? 2 : spd === 2 ? 1.5 : 1)
          : 0);
      //** クリティカルかどうか */
      let crit =
        Math.random() <
        (enemyHpPercent - playerHpPercent) * (1 + (skillEffects.critUp ?? 0)) +
          (skillEffects.critUpFixed ?? 0);
      const critDmg = 1 + (skillEffects.critDmgUp ?? 0);
      /** ダメージ */
      let dmg =
        getAtkDmg(
          data,
          atk,
          tp,
          1,
          crit ? critDmg : false,
          enemyDef,
          enemyMaxHp,
          rng * dmgBonus,
          getVal(enemy.defx, [tp]),
        ) + trueDmg;
      const noItemDmg =
        getAtkDmg(
          data,
          atk - itemBonus.atk,
          tp,
          1,
          crit,
          enemyDef,
          enemyMaxHp,
          rng * dmgBonus,
          getVal(enemy.defx, [tp]),
        ) + trueDmg;
      // 最大ダメージ制限処理
      if (
        maxdmg &&
        maxdmg > 0 &&
        dmg > Math.round(maxdmg * (1 / ((abort || spd) - i)))
      ) {
        // 最大ダメージ制限を超えるダメージの場合は、ダメージが制限される。
        dmg = Math.round(maxdmg * (1 / ((abort || spd) - i)));
        maxdmg -= dmg;
        crit = false;
      } else if (maxdmg && maxdmg > 0) {
        maxdmg -= dmg;
      }
      // メッセージの出力
      message += (crit ? `**${enemy.atkmsg(dmg)}**` : enemy.atkmsg(dmg)) + '\n';
      totalDmg += dmg;
      if (dmg - noItemDmg > 1) {
        message += `(道具効果: +${dmg - noItemDmg})\n`;
      }
      // 敵のHPが0以下になった場合は、以降の攻撃をキャンセル
      if (enemyHp <= 0) break;
      // 攻撃が中断される場合
      if (i + 1 === abort) {
        if (enemy.abortmsg) message += enemy.abortmsg + '\n';
        break;
      }
    }

    // 勝利処理
    if (enemyHp <= 0) {
      message += '\n' + enemy.winmsg + '\n\n' + serifs.rpg.win;
      break;
    } else {
      let enemyAtkX = 1;
      // 攻撃後発動スキル効果
      // 氷属性剣攻撃
      if (
        isBattle &&
        isPhysical &&
        !isTired &&
        Math.random() < (skillEffects.ice ?? 0)
      ) {
        message += serifs.rpg.skill.ice(enemy.dname ?? enemy.name) + `\n`;
        enemyTurnFinished = true;
      } else if (!(isBattle && isPhysical && !isTired)) {
        // 非戦闘時は氷の効果はないが、防御に還元される
        def = def * (1 + (skillEffects.ice ?? 0));
      }
      // 光属性剣攻撃
      if (
        isBattle &&
        isPhysical &&
        !isTired &&
        Math.random() < (skillEffects.light ?? 0)
      ) {
        message += serifs.rpg.skill.light(enemy.dname ?? enemy.name) + `\n`;
        enemyAtkX = enemyAtkX * 0.5;
      } else if (!(isBattle && isPhysical && !isTired)) {
        // 非戦闘時は光の効果はないが、防御に還元される
        def = def * (1 + (skillEffects.light ?? 0) * 0.5);
      }
      // 闇属性剣攻撃
      if (
        enemy.spd &&
        enemy.spd >= 2 &&
        Math.random() < (skillEffects.dark ?? 0) * 2
      ) {
        message += serifs.rpg.skill.spdDown(enemy.dname ?? enemy.name) + `\n`;
        enemy.spd = 1;
      } else if (
        isBattle &&
        isPhysical &&
        enemyHp > 150 &&
        Math.random() < (skillEffects.dark ?? 0)
      ) {
        const dmg = Math.floor(300 / 2);
        message += serifs.rpg.skill.dark(enemy.dname ?? enemy.name, dmg) + `\n`;
        totalDmg += dmg;
      } else if (!(isBattle && isPhysical)) {
        // 非戦闘時は闇の効果はないが、防御に還元される
        def = def * (1 + (skillEffects.dark ?? 0) * 0.3);
      }
      // 敵のターンが既に終了していない場合
      /** 受けた最大ダメージ */
      let maxDmg = 0;
      if (!enemyTurnFinished) {
        message += '\n';
        for (let i = 0; i < (enemy.spd ?? 1); i++) {
          const rng =
            defMinRnd +
            random(data, startCharge, skillEffects, true) * defMaxRnd;
          if (aggregateTokensEffects(data).showRandom)
            message += `⚂ ${Math.floor(rng * 100)}%\n`;
          /** クリティカルかどうか */
          const crit =
            Math.random() <
            (playerHpPercent - enemyHpPercent) *
              (1 - (skillEffects.enemyCritDown ?? 0));
          const critDmg = 1 + (skillEffects.enemyCritDmgDown ?? 0) * -1;
          /** ダメージ */
          const dmg = getEnemyDmg(
            _data,
            def,
            tp,
            1,
            crit ? critDmg : false,
            enemyAtk,
            rng * defDmgX * enemyAtkX,
            getVal(enemy.atkx, [tp]),
          );
          const noItemDmg = getEnemyDmg(
            _data,
            def - itemBonus.def,
            tp,
            1,
            crit ? critDmg : false,
            enemyAtk,
            rng * defDmgX * enemyAtkX,
            getVal(enemy.atkx, [tp]),
          );
          playerHp -= dmg;
          message +=
            (crit ? `**${enemy.defmsg(dmg)}**` : enemy.defmsg(dmg)) + '\n';
          if (noItemDmg - dmg > 1) {
            message += `(道具効果: -${noItemDmg - dmg})\n`;
          }
          if (dmg > maxDmg) maxDmg = dmg;
          if (enemy.fire && count > (data.thirdFire ?? 0))
            data.thirdFire = count;
        }
        // HPが0で食いしばりが可能な場合、食いしばる
        const endure = 0.1 + endureCount * 0.1 - count * 0.05;
        if (playerHp <= 0 && !enemy.notEndure && Math.random() < endure) {
          message += serifs.rpg.endure + '\n';
          playerHp = 1;
          endureCount -= 1;
        }
        if (maxDmg > (data.superMuscle ?? 0) && playerHp > 0)
          data.superMuscle = maxDmg;
      }
      // 敗北処理
      if (playerHp <= 0) {
        message += '\n' + enemy.losemsg;

        break;
      } else {
        // 決着がつかない場合
        if (actionX === plusActionX) {
          message += showStatusDmg(_data, playerHp, totalDmg, enemyMaxHp, me);
        } else {
          message +=
            showStatusDmg(_data, playerHp, totalDmg, enemyMaxHp, me) + '\n\n';
        }
        count = count + 1;
      }
    }
  }

  if (playerHp > 0) {
    const dmg = Math.round(
      (playerHp / (100 + lv * 3)) *
        1000 *
        (1 + (skillEffects.finalAttackUp ?? 0)),
    );
    message +=
      '\n\n' +
      serifs.rpg.finalAttack(dmg) +
      `\n\n` +
      serifs.rpg.timeUp(enemy.name, 100 + lv * 3) +
      '\n\n' +
      enemy.losemsg;
    totalDmg += dmg;
  }

  if (skillEffects.charge && data.charge > 0) {
    message += '\n\n' + serifs.rpg.skill.charge;
  } else if (data.charge < 0) {
    data.charge = 0;
  }

  message += '\n\n' + serifs.rpg.totalDmg(totalDmg);

  if (!data.raidScore) data.raidScore = {};
  if (!data.raidScore[enemy.name] || data.raidScore[enemy.name] < totalDmg) {
    if (data.raidScore[enemy.name]) {
      message +=
        '\n' + serifs.rpg.hiScore(data.raidScore[enemy.name], totalDmg);
      if (mark === ':blank:') mark = '🆙';
    }
    data.raidScore[enemy.name] = totalDmg;
  } else {
    if (data.raidScore[enemy.name])
      message += `\n（これまでのベスト: ${data.raidScore[enemy.name]}）`;
  }

  const amuletmsg = amuletMinusDurability(data);

  if (amuletmsg) {
    message += '\n\n' + amuletmsg;
  }

  data.raid = false;
  msg.friend.setPerModulesData(module_, data);

  // 色解禁確認
  const newColorData = colors.map((x) => x.unlock(data));
  /** 解禁した色 */
  let unlockColors = '';
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
    reply = await msg.reply(
      `エラーが発生しました。もう一度試してみてください。`,
      {
        visibility: 'specified',
      },
    );
    totalDmg = 0;
  } else {
    reply = await msg.reply(`<center>${message}</center>`, {
      cw,
    });
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
  return spd <= 2
    ? spd
    : spd <= 3
      ? 2 + (spd - 2) * 0.5
      : spd <= 4
        ? 2.5 + (spd - 3) * 0.25
        : 2.75 + (spd - 4) * 0.125;
}

function getSpd(spdX: number) {
  if (spdX <= 2) return spdX;
  if (spdX <= 2.5) return 2 + (spdX - 2) * 2;
  if (spdX <= 2.75) return 3 + (spdX - 2.5) * 4;
  return 4 + (spdX - 2.75) * 8;
}

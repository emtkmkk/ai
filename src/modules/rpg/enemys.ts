// RPGで使用する敵の情報

import Message from '@/message';
import { colors, unlockCount } from './colors';
import rpg from './index';
import serifs from '@/serifs';
import { aggregateTokensEffects } from './shop';
import { acct } from '@/utils/acct';

export type Enemy = {
  /** 内部ID ユニークでなければならない */
  name: string;
  /** 表示名 指定があれば内部IDの代わりに敵の名前として表示 */
  dname?: string;
  /** 出現条件 trueが返された場合、出現する */
  limit?: (data: any, friend?: any) => boolean;
  /** 出現時のメッセージ */
  msg: string;
  /** 短いメッセージ 2ターン目以降や、ステータスなどで表示される。 */
  short: string;
  /** HPが何を示しているか 体力以外の場合に使用 */
  hpmsg?: string;
  /** 空のマーク HP表示に使用 */
  mark?: string;
  /** 満たされたマーク HP表示に使用 */
  mark2?: string;
  /** 体力表示の際に 0% -> 100% で表示するか 進捗表示などに使用 */
  lToR?: boolean;
  /**
   * プレイヤーの体力表示の際に 0% -> 100% で表示するか 進捗表示などに使用
   * trueの場合、体力表示の際に自動的に上がプレイヤー、下が敵になる
   * */
  pLToR?: boolean;
  /** 攻撃時のメッセージ */
  atkmsg: (dmg: number) => string;
  /** 防御時のメッセージ */
  defmsg: (dmg: number) => string;
  /** 連続攻撃中断時のメッセージ */
  abortmsg?: string;
  /** 勝利時のメッセージ */
  winmsg?: string;
  /** 敗北時のメッセージ */
  losemsg?: string;
  /** 逃走スキル発動時の特殊メッセージ */
  escapemsg?: string;
  /** 最大HP 未指定なら300 */
  maxhp?: number | ((hp: number) => number);
  /**
   * 攻撃力倍率 1でプレイヤーのLvの3.5倍の値になる
   * （プレイヤーの最低保証分のパラメータを均等に割り振った値）
   * 関数で指定した場合は倍率ではなく、その値がそのまま使用される
   * */
  atk?: number | ((atk: number, def: number, spd: number) => number);
  /**
   * 防御力倍率 1でプレイヤーのLvの3.5倍の値になる
   * （プレイヤーの最低保証分のパラメータを均等に割り振った値）
   * 関数で指定した場合は倍率ではなく、その値がそのまま使用される
   * */
  def?: number | ((atk: number, def: number, spd: number) => number);
  /**  攻撃回数 未指定で1 */
  spd?: number;
  /**
   * 攻撃ボーナス倍率 基本的な値は3
   * プレイヤーの投稿数ボーナスと同じかかり方をする
   * */
  atkx?: number | ((tp: number) => number);
  /**
   * 防御ボーナス倍率 基本的な値は3
   * プレイヤーの投稿数ボーナスと同じかかり方をする
   * */
  defx?: number | ((tp: number) => number);
  /** 最大ダメージ制限 0 ~ 1で指定する 1ターンに指定した割合以上のダメージを与えられなくなる */
  maxdmg?: number;
  /** 踏ん張れないフラグ 耐えるという概念がない場合にオン （川柳勝負など） */
  notEndure?: boolean;
  /**
   * 炎攻撃1スタックにつきHPに受けるダメージ割合 0 ~ 1
   * 0.1 に設定した場合、2スタックでプレイヤーは通常の攻撃ダメージ + プレイヤーHP20%の固定ダメージを受けるようになる
   * */
  fire?: number;
  /** 連続攻撃を中断する割合 0 ~ 1 連続攻撃毎に判定 */
  abort?: number;
  /** エンディング時のメッセージ */
  endingmsg?: string;
  /** 独自イベントを指定 */
  event?: (module: rpg, msg: Message, _data: any) => any;
};

export type RaidEnemy = Enemy & {
  /** 強さを表す数値 レイドボスの評価に使用 攻撃力 * 攻撃倍率 + 防御力 * 防御倍率 */
  power?: number;
  /** 投稿数を固定する */
  forcePostCount?: number;
};

/** 敵一覧 */
export const enemys: Enemy[] = [
  {
    name: ':aine_heart:',
    msg: ':aine_heart:がお喋りしてほしいようだ。',
    short: ':aine_heart:とお喋り中',
    hpmsg: '満足度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんの巧みな話術！\n${dmg}ポイント満足させた！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    winmsg: ':aine_heart:を満足させた！',
    losemsg: '阨ちゃんは満足させきる前に疲れで倒れてしまった…',
    atk: 1.1,
    def: 1.1,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':mijinko_aww:',
    limit: (data) =>
      (data.streak ?? 0) >= 4 && data.clearEnemy.includes(':aine_heart:'),
    msg: '暇を持て余した:mijinko_aww:がお喋りしてほしいようだ。',
    short: ':mijinko_aww:とお喋り中',
    hpmsg: '満足度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんの愛くるしい話術！\n${dmg}ポイント満足させた！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: ':mijinko_aww:が「それってどういうこと？」と話をさえぎった！',
    winmsg: ':mijinko_aww:を満足させた！',
    losemsg: '阨ちゃんは満足させきる前に疲れで倒れてしまった…',
    endingmsg: ':mijinko_aww:はニコニコしながら帰って行った！',
    atk: 2.2,
    def: 2.2,
    atkx: 4,
    defx: 4,
    abort: 0.2,
  },
  {
    name: ':gentoochan:',
    msg: ':gentoochan:は一緒に輪投げで遊びたいようだ',
    short: ':gentoochan:と輪投げ遊び中',
    hpmsg: '目標到達度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    pLToR: true,
    atkmsg: (dmg) => `阨ちゃんの番だ！\n輪っかを投げて${dmg}ポイント獲得した！`,
    defmsg: (dmg) =>
      `:gentoochan:の番だ！\n輪っかを投げて${dmg}ポイント獲得した！`,
    winmsg: 'さきに目標点到達！勝負の結果、阨ちゃんが勝った！',
    losemsg: '勝負の結果、:gentoochan:が勝った！',
    atk: 1.2,
    def: 1.2,
    atkx: 3,
    defx: 3,
    notEndure: true,
  },
  {
    name: ':gentoochan:2',
    limit: (data) =>
      (data.streak ?? 0) >= 2 && data.clearEnemy.includes(':gentoochan:'),
    msg: ':gentoochan:はまた一緒に輪投げで遊びたいようだ',
    short: ':gentoochan:と輪投げ遊び中（ふたたび）',
    hpmsg: '目標到達度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    pLToR: true,
    atkmsg: (dmg) => `阨ちゃんの番だ！\n輪っかを投げて${dmg}ポイント獲得した！`,
    defmsg: (dmg) =>
      `:gentoochan:の番だ！\n輪っかを投げて${dmg}ポイント獲得した！`,
    winmsg: 'さきに目標点到達！勝負の結果、阨ちゃんが勝った！',
    losemsg: '勝負の結果、:gentoochan:が勝った！',
    endingmsg: ':gentoochan:と一緒にとっても楽しく遊べた！',
    atk: 2,
    def: 2,
    atkx: 3,
    defx: 3,
    notEndure: true,
  },
  {
    name: ':shiromaru_dotto:',
    msg: ':shiromaru_dotto:が現れた。',
    short: ':shiromaru_dotto:とバトル中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) => `:shiromaru_dotto:の攻撃！${dmg}ポイントのダメージ！`,
    winmsg: ':shiromaru_run:はどこかへ逃げて行った！',
    losemsg: '阨ちゃんは疲れて倒れてしまった…',
    atk: 1,
    def: 1,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':kochi_shiromaru_drop:',
    dname: ':kochi_shiromaru_drop:',
    limit: (data) =>
      (data.streak ?? 0) >= 3 && data.clearEnemy.includes(':shiromaru_dotto:'),
    msg: ':shiromaru_dotto:が:kochi_shiromaru_drop:を引き連れて現れた！リベンジをしたいようだ。',
    short: ':kochi_shiromaru_drop:とバトル中（ふたたび）',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}のダメージ！`,
    defmsg: (dmg) => `:shiromaru_dotto:の攻撃！\n${dmg}のダメージ`,
    winmsg: ':shiromaru_run:は:kochi_shiromaru_drop:の中に逃げ去った！',
    losemsg: '阨ちゃんは疲れて倒れてしまった…',
    atk: 1,
    def: 1.5,
    atkx: 4,
    defx: 4,
    maxdmg: 0.6,
  },
  {
    name: ':kochi_san:',
    dname: ':kochi_san:',
    limit: (data) =>
      (data.winCount ?? 0) >= 5 &&
      (data.streak ?? 0) >= 5 &&
      data.clearEnemy.includes(':kochi_shiromaru_drop:'),
    msg: ':kochi_san:がただそこに存在している…',
    short: ':kochi_san:と遭遇中',
    hpmsg: '認識',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんの念力！\n:kochi_san:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:kochi_san:はただそこに存在している！\n${dmg}ポイントのダメージ！`,
    winmsg: ':kochi_san:はいつの間にか消えていた',
    losemsg: '阨ちゃんはやられてしまった…',
    endingmsg: '消えてしまったが、阨ちゃんは:kochi_san:を認識することができた',
    atk: 0.9,
    def: 4,
    spd: 3,
    atkx: 3,
    defx: 4,
  },
  {
    name: '🍰',
    msg: '🍰が現れた！:strawberry_normal:をうまくカットして儀式を完遂しないといけない！',
    short: '🍰の儀式を実行中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんのケーキ入刀！\n:strawberry_normal:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:strawberry_normal:の甘い誘惑！\n阨ちゃんはお腹が減って${dmg}ポイントのダメージ！`,
    winmsg: ':strawberry_half:にできた！儀式を完遂した！',
    losemsg: '阨ちゃんは我慢しきれず🍰を途中で食べてしまった…',
    atk: 2,
    def: 0.5,
    atkx: 3,
    defx: 3,
  },
  {
    name: '🍰2',
    limit: (data) =>
      (data.winCount ?? 0) >= 2 && data.clearEnemy.includes('🍰'),
    msg: '🍰が新しい苺を携えて戻ってきた！:strawberry_normal:をうまくカットして儀式を完遂しないといけない！',
    short: '🍰の儀式を実行中（ふたたび）',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんのケーキ入刀！\n:strawberry_normal:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:strawberry_normal:の甘い誘惑！\n阨ちゃんはお腹が減って${dmg}ポイントのダメージ！`,
    winmsg: 'また:strawberry_half:にできた！儀式を完遂した！',
    losemsg: '阨ちゃんは我慢しきれず🍰を途中で食べてしまった…',
    endingmsg: ':strawberry_half:をきれいに切ることができた！儀式を完遂した！',
    atk: 2.2,
    def: 1,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':kochi_cat:',
    msg: ':kochi_cat:が縄張り争いを仕掛けてきた',
    short: ':kochi_cat:と縄張り争い中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんのじゃれつき！\n:kochi_cat:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:kochi_cat:のひっかき攻撃！\n阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg: ':kochi_cat:に負けを認めさせた！',
    losemsg: '阨ちゃんは負けを認めた…',
    endingmsg: ':kochi_cat:は寝転がって負けを認めた！',
    atk: 1,
    def: 1,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':chocolatchan:',
    msg: ':chocolatchan:がなでなで技術バトルを持ち掛けてきた！',
    short: ':chocolatchan:となでなで技術バトル中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんは:chocolatchan:をなでなでした！\n:chocolatchan:を${dmg}ポイント満足させた`,
    defmsg: (dmg) =>
      `:chocolatchan:は阨ちゃんをなでなでした！\n阨ちゃんを${dmg}ポイント満足させた`,
    winmsg: ':chocolatchan:に「その調子です！」と褒められた！',
    losemsg: '阨ちゃんは自分が満足させられてしまった…',
    atk: 1.3,
    def: 1,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':chocolatchan:2',
    limit: (data) =>
      (data.streak ?? 0) >= 3 && data.clearEnemy.includes(':chocolatchan'),
    msg: ':chocolatchan:が今度は肩もみ技術バトルを持ち掛けてきた！',
    short: ':chocolatchan:と肩もみ技術バトル中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんは:chocolatchan:を肩もみした！\n:chocolatchan:を${dmg}ポイント満足させた`,
    defmsg: (dmg) =>
      `:chocolatchan:は阨ちゃんを肩もみした！\n阨ちゃんを${dmg}ポイント満足させた`,
    winmsg: ':chocolatchan:に「上達してますね！」と褒められた！',
    losemsg: '阨ちゃんは自分が満足させられてしまった…',
    endingmsg: ':chocolatchan:にいっぱい頭をなでなでしてもらった！',
    atk: 3,
    def: 2,
    atkx: 4,
    defx: 3,
  },
  {
    name: ':tera_dotto:',
    msg: ':tera_dotto:はきゅうりを食べたいようだ。',
    short: ':tera_dotto:にきゅうりを与え中',
    hpmsg: '満腹度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんはきゅうりを${
        dmg / 10
      }kg持ってきた！\n:tera_dotto:は全て食べた！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    winmsg: ':tera_dotto:は満足したようだ！',
    losemsg: '阨ちゃんは疲れで倒れてしまった…',
    atk: 1,
    def: 1,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':tera_dotto:2',
    limit: (data) =>
      (data.streak ?? 0) >= 3 && data.clearEnemy.includes(':tera_dotto:'),
    msg: ':tera_dotto:はもっときゅうりを食べたいようだ。',
    short: ':tera_dotto:にきゅうりを与え中（ふたたび）',
    hpmsg: '満腹度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんはきゅうりを${
        dmg / 10
      }kg持ってきた！\n:tera_dotto:は全て食べた！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    winmsg: ':tera_dotto:は大満足したようだ！',
    losemsg: '阨ちゃんは疲れで倒れてしまった…',
    endingmsg:
      ':tera_dotto:は阨ちゃんにだれかの尻子玉をプレゼントして立ち去って行った！',
    atk: 2,
    def: 3,
    atkx: 3,
    defx: 4,
  },
  {
    name: ':jump_kito:',
    msg: ':jump_kito:が着こなし勝負したいようだ。',
    short: ':jump_kito:と着こなしバトル中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    pLToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんはいっぱいいっぱい考えた！\n着こなしのオシャレ度が${dmg}ポイントアップ！`,
    defmsg: (dmg) =>
      `:jump_kito:は雑誌から情報を収集した！\n:jump_kito:の着こなしのオシャレ度が${dmg}ポイントアップ！`,
    winmsg: '審査員が来た！\n良い着こなしと判定されたのは阨ちゃんだった！',
    losemsg: '審査員が来た！\n良い着こなしと判定されたのは:jump_kito:だった！',
    atk: 1.5,
    def: 1.5,
    atkx: 3,
    defx: 3,
    maxdmg: 0.95,
    notEndure: true,
  },
  {
    name: ':jump_kito:2',
    dname: ':jump_kito:',
    limit: (data) =>
      (data.streak ?? 0) >= 4 && data.clearEnemy.includes(':jump_kito:'),
    msg: ':jump_kito:が着こなし勝負のリベンジをしたいようだ。',
    short: ':jump_kito:と着こなしバトル中（ふたたび）',
    mark: '☆',
    mark2: '★',
    lToR: true,
    pLToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんはいっぱいいっぱい考えた！\n着こなしのオシャレ度が${dmg}ポイントアップ！`,
    defmsg: (dmg) =>
      `:jump_kito:は雑誌から情報を収集した！\n:jump_kito:の着こなしのオシャレ度が${dmg}ポイントアップ！`,
    winmsg: '審査員が来た！\n良い着こなしと判定されたのは阨ちゃんだった！',
    losemsg: '審査員が来た！\n良い着こなしと判定されたのは:jump_kito:だった！',
    endingmsg: ':jump_kito:との着こなし勝負に勝つ事が出来た！',
    atk: 2.5,
    def: 2.2,
    atkx: 3,
    defx: 3,
    maxdmg: 0.6,
    notEndure: true,
  },
  {
    name: '阨ちゃんは猛勉強',
    limit: (data) => (data.streak ?? 0) >= 2,
    msg: '阨ちゃんはスマートな九尾になるため猛勉強を行うようだ。',
    short: '猛勉強中',
    hpmsg: '勉強度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは勉強に取り組んだ！\n勉強度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんはサボりたくなったので勉強を一旦止めた！',
    winmsg: '阨ちゃんは試験で高得点を得ることが出来た！',
    losemsg: '阨ちゃんは疲れて勉強を諦めてしまった…',
    endingmsg: '勉強を沢山して高得点を得ることが出来た！',
    maxhp: 320,
    atk: 2,
    def: 0.8,
    atkx: 3,
    defx: 3,
    maxdmg: 0.85,
    abort: 0.05,
  },
  {
    name: ':makihara_ojiichan_dot:',
    limit: (data) => (data.streak ?? 0) >= 2,
    msg: ':makihara_ojiichan_dot:が現れた。なぞなぞで遊んでくれるようだ',
    short: ':makihara_ojiichan_dot:となぞなぞ中',
    hpmsg: '得点数',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは:makihara_ojiichan_dot:のなぞなぞに回答した！\n得点数が${dmg}点増えた！`,
    defmsg: (dmg) => `阨ちゃんは頭を使いすぎて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんは難しくてなぞなぞに答えられなかった！',
    winmsg:
      'なぞなぞを解き終えた！阨ちゃんは:makihara_ojiichan_dot:に褒められた！',
    losemsg: '阨ちゃんは疲れてすべてのなぞなぞに答えるのを諦めてしまった…',
    maxhp: 320,
    atk: 1.4,
    def: 1.2,
    atkx: 3,
    defx: 3,
    maxdmg: 0.85,
    abort: 0.05,
  },
  {
    name: ':makihara_ojiichan_dot:2',
    limit: (data) =>
      (data.streak ?? 0) >= 4 &&
      data.clearEnemy.includes(':makihara_ojiichan_dot:'),
    msg: ':makihara_ojiichan_dot:がふたたび現れた。もっと難しいなぞなぞで遊んでくれるようだ',
    short: ':makihara_ojiichan_dot:となぞなぞ中（ふたたび）',
    hpmsg: '得点数',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは:makihara_ojiichan_dot:のなぞなぞに回答した！\n得点数が${dmg}点増えた！`,
    defmsg: (dmg) => `阨ちゃんは頭を使いすぎて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんは難しくてなぞなぞに答えられなかった！',
    winmsg:
      '難しいなぞなぞを解き終えた！阨ちゃんは:makihara_ojiichan_dot:に褒められた！',
    losemsg: '阨ちゃんは疲れてすべてのなぞなぞに答えるのを諦めてしまった…',
    endingmsg: '阨ちゃんは:makihara_ojiichan_dot:になでなでしてもらえた！',
    maxhp: 320,
    atk: 2,
    def: 1.8,
    atkx: 3,
    defx: 3,
    maxdmg: 0.9,
    abort: 0.2,
  },

  {
    name: '阨ちゃんは村の巡回',
    limit: (data) => (data.streak ?? 0) >= 2,
    msg: '阨ちゃんは村の巡回を行うようだ。',
    short: '村の巡回中',
    hpmsg: '村巡回完了度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは村人に元気よく挨拶した！\n村の巡回完了度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんは飽きちゃったので村の巡回を一旦止めた！',
    winmsg: '阨ちゃんは村の巡回を終わらせた！',
    losemsg: '阨ちゃんは疲れて寝てしまった…',
    endingmsg: '村を巡回して沢山の人に挨拶をする事が出来た！',
    atk: 0.6,
    def: 2,
    atkx: 3,
    defx: 3,
    maxdmg: 0.95,
    abort: 0.05,
  },
  {
    name: ':rokuro_heart:',
    msg: '阨ちゃんは:rokuro_heart:から御馳走に誘われ食事を完食したいようだ。',
    short: '御馳走お食事中',
    hpmsg: '完食度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは:rokuro_heart:の用意してくれたご飯を食べた！\n完食度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんは苦しくなって少し手が止まった！',
    winmsg: '阨ちゃんは:rokuro_heart:の用意したご馳走を完食した！',
    losemsg: '阨ちゃんはお腹いっぱいで動けなくなってしまった…',
    endingmsg:
      '阨ちゃんは:rokuro_heart:から「また来てくださいね」と声をかけてもらった！',
    atk: 0.6,
    def: 1.5,
    atkx: 3,
    defx: 3,
    maxdmg: 0.95,
    abort: 0.05,
  },
  {
    name: ':yamiro_houtyou:',
    limit: (data) =>
      (data.streak ?? 0) >= 5 && data.clearEnemy.includes(':rokuro_heart:'),
    msg: '阨ちゃんは:yamiro_houtyou:に僕とも仲良くして欲しいと絡まれた！',
    short: ':yamiro_houtyou:とお話し中',
    hpmsg: '満足度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは:yamiro_houtyou:とたくさんお喋りした\n満足度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg:
      ':yamiro_houtyou:が答えにくい質問を投げかけてきた！何と答えたらいいか分からなくなった！',
    winmsg: ':yamiro_houtyou:は満足して笑顔で去っていった',
    losemsg: '阨ちゃんは話題が出てこなくなって逃げ出してしまった…',
    endingmsg:
      ':yamiro_houtyou:に「こんなに良くしてくれてうれしいです」と感謝された！',
    atk: 1,
    def: 3,
    atkx: 3,
    defx: 3,
    maxdmg: 0.95,
    abort: 0.2,
  },
  {
    name: ':miko_encounter_dot:',
    limit: (data) => (data.streak ?? 0) >= 2,
    msg: ':miko_encounter_dot:が神社のお掃除を手伝ってほしいようだ',
    short: '神社のお掃除中',
    hpmsg: 'お掃除完了度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは:miko_encounter_dot:をマネしていっぱい掃き掃除をした！\n神社のお掃除完了度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんは疲れてしまって掃除を一旦止めた！',
    winmsg: '阨ちゃんは神社のお掃除を終わらせた！',
    losemsg: '阨ちゃんは疲れて寝てしまった…',
    atk: 1.2,
    def: 1.4,
    atkx: 3,
    defx: 3,
    maxdmg: 0.9,
    abort: 0.05,
  },
  {
    name: ':miko_en}counter_dot: 2',
    limit: (data) =>
      (data.streak ?? 0) >= 4 &&
      data.clearEnemy.includes(':miko_encounter_dot:'),
    msg: ':miko_encounter_dot:が今度は神社の備品の片づけを手伝ってほしいようだ',
    short: '神社のお片付け中',
    hpmsg: 'お片付け完了度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは:miko_encounter_dot:をマネしていっぱいお片付けをした！\n神社のお片付け完了度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: '阨ちゃんは疲れてしまってお片付けを一旦止めた！',
    winmsg: '阨ちゃんは神社のお片付けを終わらせた！',
    losemsg: '阨ちゃんは疲れて寝てしまった…',
    endingmsg:
      '阨ちゃんは神社をピカピカにして:miko_encounter_dot:に感謝された！',
    atk: 1.8,
    def: 2,
    atkx: 3,
    defx: 3,
    maxdmg: 0.9,
    abort: 0.2,
  },
  {
    name: ':syounenz_dotto:',
    limit: (data) => (data.streak ?? 0) >= 1,
    msg: ':syounenz_dotto:が一緒にテレビゲームで遊びたいようだ。',
    short: ':syounenz_dotto:と遊び中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんは頭を使った！\n${dmg}ダメージを与えた！`,
    defmsg: (dmg) => `:syounenz_dotto:の番だ！${dmg}ダメージを与えた！`,
    winmsg: '阨ちゃんはゲームに勝利した！',
    losemsg: ':syounenz_dotto:はゲームに勝利した！',
    atk: 1,
    def: 0.5,
    atkx: 3.5,
    defx: 3.5,
    notEndure: true,
  },
  {
    name: ':syounenz_dotto:2',
    limit: (data) =>
      (data.streak ?? 0) >= 4 && data.clearEnemy.includes(':syounenz_dotto:'),
    msg: ':syounenz_dotto:がもう一度一緒にテレビゲームで遊びたいようだ。',
    short: ':syounenz_dotto:と遊び中（ふたたび）',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは頑張ってコントローラを操作した！\n${dmg}ダメージを与えた！`,
    defmsg: (dmg) =>
      `:syounenz_dotto:の番だ！巧みなゲームさばきで${dmg}ダメージを与えた！`,
    abortmsg: ':syounenz_dotto:のゲームプレイが楽しそうで魅せられてしまった！',
    winmsg: '阨ちゃんはゲームに勝利した！',
    losemsg: ':syounenz_dotto:はゲームに勝利した！',
    endingmsg: ':syounenz_dotto:と楽しくゲームで遊ぶことができた！',
    atk: 2.2,
    def: 2.5,
    atkx: 3,
    defx: 3,
    abort: 0.2,
  },
  {
    name: ':role_capsaishin:',
    limit: (data) => (data.streak ?? 0) >= 2,
    msg: ':role_capsaishin:は激辛料理の試練を受けてほしいようだ',
    short: ':role_capsaishin:の激辛試練中',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) =>
      `阨ちゃんは激辛料理を食べた！\n激辛料理を${dmg}ポイント分食べた！`,
    defmsg: (dmg) =>
      `:role_capsaishin:の追い唐辛子！\n阨ちゃんは${dmg}ポイントのダメージ！\n阨ちゃんが次に受けるダメージが上昇した！`,
    winmsg: '阨ちゃんは完食し、:role_capsaishin:の激辛試練に打ち勝った！',
    losemsg: '阨ちゃんは辛さに耐えられずやられてしまった…',
    atk: 0.5,
    def: 2,
    atkx: 2,
    defx: 4,
    fire: 0.2,
  },
  {
    name: ':role_capsaishin:2',
    dname: ':role_capsaishin:',
    limit: (data) =>
      (data.winCount ?? 0) >= 40 &&
      (data.streak ?? 0) >= 4 &&
      data.clearEnemy.includes(':role_capsaishin:'),
    msg: ':role_capsaishin:が新たな激辛料理の試練を用意してきた！',
    short: ':role_capsaishin:の激辛試練中（ふたたび）',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) =>
      `阨ちゃんは全力で激辛料理を食べた！\n激辛料理を${dmg}ポイント分食べた！`,
    defmsg: (dmg) =>
      `:role_capsaishin:の追い唐辛子！\n阨ちゃんは${dmg}ポイントのダメージ！\n阨ちゃんが次に受けるダメージが上昇した！`,
    abortmsg: '阨ちゃんは全力で食べた為、すぐには連続で食べることが出来ない！',
    winmsg: '阨ちゃんは完食し、:role_capsaishin:の激辛試練に打ち勝った！',
    losemsg: '阨ちゃんは辛さに耐えられずやられてしまった…',
    endingmsg:
      '阨ちゃんは完食し、:role_capsaishin:の激辛試練に完璧に打ち勝った！',
    atk: 0.1,
    def: 1,
    atkx: 1,
    defx: (tp) => 1.3 * tp,
    fire: 0.15,
    abort: 1,
  },

  {
    name: ':ddquino:',
    limit: (data) => (data.winCount ?? 0) >= 2 && (data.streak ?? 0) >= 2,
    msg: ':ddquino:は打ち上げがしたいようだ',
    short: ':ddquino:を打ち上げ中',
    hpmsg: '高度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんはタルに点火した！\n  :ddquino:は${dmg * 10}メートル飛んだ！`,
    defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    winmsg: ':ddquino:は満足したようだ！',
    losemsg: '阨ちゃんは倒れてしまった…',
    atk: 1.5,
    def: 1.5,
    atkx: 3.5,
    defx: 3.5,
  },
  {
    name: ':ddcatdance:',
    dname: ':ddcatdance:',
    limit: (data) =>
      (data.winCount ?? 0) >= 4 &&
      (data.streak ?? 0) >= 4 &&
      data.clearEnemy.includes(':ddquino:'),
    msg: ':ddcatdance:が薬を飲み忘れないように気づかせてあげなくてはいけない！',
    short: ':ddcatdance:にリマインド中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんの声掛け！\n:ddcatdance:に${dmg}回リマインドした！`,
    defmsg: (dmg) =>
      `声をかけ続けても気づいてもらえない阨ちゃんの精神に${dmg}ポイントのダメージ！`,
    winmsg: ':ddcatdance:はようやくリマインドに気づき服薬完了した！',
    losemsg: '阨ちゃんは泣きながら逃げ帰ってしまった…',
    endingmsg:
      ':ddcatdance:はこれからは服薬リマインドなしでもなんとかなる気がすると言い去っていった',
    atk: 2.5,
    def: 2.5,
    atkx: 3,
    defx: 3.5,
  },
  {
    name: ':kamoshika_dot:',
    limit: (data) => (data.winCount ?? 0) >= 2 && (data.streak ?? 0) >= 2,
    msg: '突然:kamoshika_dot:が現れた。',
    short: ':kamoshika_dot:とバトル中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) => `:kamoshika_dot:の頭突き！${dmg}ポイントのダメージ！`,
    winmsg: ':kamoshika_dot:は「世の中クソだな」と言いながら立ち去って行った！',
    losemsg: '阨ちゃんは倒れてしまった…',
    atk: 2,
    def: 2,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':kamoshika_dot:2',
    dname: ':kamoshika_dot:',
    limit: (data) =>
      (data.winCount ?? 0) >= 4 &&
      (data.streak ?? 0) >= 4 &&
      data.clearEnemy.includes(':kamoshika_dot:'),
    msg: 'またまた:kamoshika_dot:が現れた。',
    short: ':kamoshika_dot:とバトル中（ふたたび）',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんの攻撃！\n:kamoshika_dot:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:kamoshika_dot:の頭突き！\n阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg:
      ':kamoshika_dot:は「相も変わらず世の中クソだな」と言いながら立ち去って行った！',
    losemsg: '阨ちゃんは倒れてしまった…',
    endingmsg:
      ':kamoshika_dot:は「立てよ、お前は俺とは違うんだろ」と言い、どこかへ立ち去ってしまった',
    atk: 2.5,
    def: 2.5,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':densi_renzi_dot:',
    limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3,
    msg: ':densi_renzi_dot:があたためバトルを仕掛けてきた！',
    short: ':densi_renzi_dot:とあたためバトル中',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) =>
      `阨ちゃんはミニ狐火であたため！\n${dmg}ポイントお弁当を温めた！`,
    defmsg: (dmg) =>
      `:densi_renzi_dot:の機械的なレンチン！\n${dmg}ポイントお弁当を温めた！`,
    abortmsg:
      ':densi_renzi_dot:は阨ちゃんのミニ狐火からお弁当の位置をずらした！',
    winmsg: '阨ちゃんはあたためバトルを制した！',
    losemsg: '阨ちゃんはあたためバトルに敗北した…',
    atk: 0.9,
    def: 3,
    atkx: 3,
    defx: 3,
    abort: 0.2,
  },
  {
    name: ':densi_renzi_dot:2',
    limit: (data) =>
      (data.winCount ?? 0) >= 5 &&
      (data.streak ?? 0) >= 5 &&
      data.clearEnemy.includes(':densi_renzi_dot:'),
    msg: ':densi_renzi_dot:が沽券をかけて再度あたためバトルを仕掛けてきた！',
    short: ':densi_renzi_dot:とあたためバトル中',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) =>
      `阨ちゃんはミニ狐火であたため！\n${dmg}ポイントお弁当を温めた！`,
    defmsg: (dmg) =>
      `:densi_renzi_dot:の機械的なレンチン！\n${dmg}ポイントお弁当を温めた！`,
    abortmsg:
      ':densi_renzi_dot:は姑息にも阨ちゃんのミニ狐火からお弁当の位置をずらした！',
    winmsg: '阨ちゃんはあたためバトルを制した！',
    losemsg: '阨ちゃんはあたためバトルに敗北した…',
    endingmsg:
      ':densi_renzi_dot:とのあたためバトルに勝利して家電製品の限界を分からせた！',
    atk: 1.8,
    def: 3,
    atkx: 3,
    defx: 3,
    abort: 0.5,
  },
  {
    name: ':syokusyu:',
    msg: ':syokusyu:が地面から生えてきた',
    short: ':syokusyu:とバトル中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) => `:syokusyu:の捲きつき攻撃！${dmg}ポイントのダメージ！`,
    winmsg: ':syokusyu:はびっくりして地中に逃げ帰っていった！',
    losemsg: '阨ちゃんは倒れてしまった…',
    endingmsg: ':syokusyu:を地中に退散させることに成功した！',
    atk: 1.2,
    def: 2,
    spd: 2,
    atkx: 3,
    defx: 3,
  },
  {
    name: ':blobdog_dropear:',
    msg: ':blobdog_dropear:が一緒にお散歩してほしいようだ',
    short: ':blobdog_dropear:とお散歩中',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) => `阨ちゃんはお散歩した！\n${dmg}ポイントの満足した！`,
    defmsg: (dmg) =>
      `:blobdog_dropear:はものすごい速さで走った！阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
    winmsg: ':blobdog_dropear:をお散歩させることに成功した！',
    losemsg: '阨ちゃんは倒れてしまった…',
    endingmsg: ':blobdog_dropear:は嬉しそうに尻尾をフリフリしている！',
    atk: 1,
    def: 1.2,
    spd: 4,
    atkx: 2,
    defx: 3,
  },
  {
    name: ':panjandrum2:',
    limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3,
    msg: '暴走:panjandrum2:が現れた！鎮めなくては！',
    short: ':panjandrum2:を鎮め中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんの妖術！\n:panjandrum2:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:panjandrum2:の高速スピン！\n阨ちゃんは${dmg}ポイントのダメージ！`,
    abortmsg: ':panjandrum2:は回転力で阨ちゃんの連続攻撃を止めた！',
    winmsg: '阨ちゃんは:panjandrum2:を鎮めた！',
    losemsg: '阨ちゃんはやられてしまった…',
    atk: 4,
    def: 0.4,
    atkx: 6,
    defx: 3,
    abort: 0.3,
  },
  {
    name: ':gaming_panjandrum:',
    limit: (data, friend) =>
      (data.winCount ?? 0) >= 10 &&
      (data.streak ?? 0) >= 7 &&
      data.clearEnemy.includes(':panjandrum2:'),
    msg: '1670万色に輝く:gaming_panjandrum:が現れた！鎮めなくては！',
    short: ':gaming_panjandrum:を鎮め中（ふたたび）',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんの妖術！\n:gaming_panjandrum:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:gaming_panjandrum:の高速スピン！\n阨ちゃんは${dmg}ポイントのダメージ！`,
    abortmsg: ':gaming_panjandrum:は回転力で阨ちゃんの連続攻撃を止めた！',
    winmsg: '阨ちゃんは:gaming_panjandrum:を鎮めた！',
    losemsg: '阨ちゃんはやられてしまった…',
    endingmsg: ':panjandrum2:を退けるほどの力を手に入れた！',
    atk: 7,
    def: 0.6,
    atkx: 3,
    defx: 3,
    abort: 0.3,
  },
  {
    name: ':aichan:',
    limit: (data) =>
      ((data.winCount ?? 0) >= 24 ||
        ((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) ||
        new Date().getMonth() - new Date().getDate() === -1) &&
      (data.color ?? 1) === 8 &&
      !data.clearEnemy.includes(':aichan8:'),
    msg: '我は汝 汝は我…、もうひとりの:aichan:が現れ、勝負を仕掛けてきた！',
    short: ':aichan:と戦い中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんの攻撃！\nシャドウ阨ちゃんに${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `シャドウ阨ちゃんの攻撃！\n阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg: 'もうひとりの自分は消えていった！\nどうやら幻だったようだ…',
    losemsg:
      '阨ちゃんはやられてしまった…\nもうひとりの自分はどこかへ消えていった…',
    endingmsg: '自分のシャドウを受け入れることが出来た！',
    maxhp: (hp) => hp - 3,
    atk: (atk, def, spd) => def - 3.5,
    def: (atk, def, spd) => (atk - 3.5) * spd,
    atkx: (tp) => tp,
    defx: (tp) => tp,
  },
  {
    name: ':nene_chan_dot:',
    limit: (data) => (data.winCount ?? 0) >= 6 && (data.streak ?? 0) >= 6,
    msg: ':nene_chan_dot:が突如現れ邪教の布教をしてきた！',
    short: ':nene_chan_dot:が邪教の解説中',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) =>
      `阨ちゃんは頑張ってうんうんと頷いた！\n理解度が${dmg}ポイント上がった！`,
    defmsg: (dmg) =>
      `:nene_chan_dot:の立て続けの解説！\n難しくて理解しきれず混乱した阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg: '阨ちゃんは長文邪教解説を乗り切った！',
    losemsg: '阨ちゃんは長文邪教解説に耐えられず目の前が真っ暗になった…',
    endingmsg: '阨ちゃんは邪教を少しだけ理解することができた！',
    atk: 2.2,
    def: 4,
    spd: 2,
    atkx: 2,
    defx: 4,
  },
  {
    name: ':aichan8:',
    limit: (data) =>
      ((data.winCount ?? 0) >= 24 ||
        ((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) ||
        new Date().getMonth() - new Date().getDate() === -1) &&
      (data.color ?? 1) !== 8 &&
      !data.clearEnemy.includes(':aichan:'),
    msg: 'ムラサキカガミの中から:aichan8:が現れ、勝負を仕掛けてきた！',
    short: ':aichan8:と戦い中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n:aichan8:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) => `:aichan8:の攻撃！\n阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg: ':aichan8:に打ち勝った！',
    losemsg: '阨ちゃんはやられてしまった…',
    endingmsg: ':aichan8:の力に飲まれずに対抗出来た！',
    maxhp: (hp) => hp,
    atk: (atk, def, spd) => def,
    def: (atk, def, spd) => atk * spd,
    atkx: (tp) => tp,
    defx: (tp) => tp,
  },

  {
    name: ':aine_oko:',
    limit: (data) =>
      (data.winCount ?? 0) >= 5 &&
      (data.streak ?? 0) >= 5 &&
      !data.clearEnemy.includes(':aine_youshou:'),
    msg: '村長に話しかけたつもりが様子がおかしい…。怒った:aine_oko:が言い返してきた！',
    short: ':aine_oko:と口論中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんのお話し攻撃！\n:aine_oko:の精神に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:aine_oko:の罵詈雑言！\n阨ちゃんの精神に${dmg}ポイントのダメージ！`,
    winmsg: ':aine_oko:はぶつぶつ言いながら帰っていった！',
    losemsg: '阨ちゃんは悲しくて逃げ出してしまった…',
    endingmsg: ':aine_oko:の恐ろしい暴言に負けずに追い返す事が出来た！',
    maxhp: 130,
    atk: 5,
    def: 5,
    maxdmg: 0.7,
    atkx: 5,
    defx: 5,
  },
  {
    name: ':aine_youshou:',
    limit: (data, friend) =>
      (data.winCount ?? 0) >= 15 &&
      ((friend.love ?? 0) >= 500 ||
        aggregateTokensEffects(data).appearStrongBoss) &&
      !data.clearHistory.includes(':aine_youshou:') &&
      data.clearHistory.includes(':aine_oko:'),
    msg: '村長に話しかけたつもりが様子がおかしい…。いつにもまして怖い:aine_youshou:が酷いことを言ってきた！',
    short: ':aine_youshou:と激しい口論中',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんのお話し攻撃！\n:aine_youshou:の精神に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:aine_youshou:の罵詈雑言の嵐！\n阨ちゃんの精神に${dmg}ポイントのダメージ！`,
    abortmsg:
      ':aine_youshou:は大きな声で「黙れ:aine_oko:」と言った！阨ちゃんはびっくりしてお話を止めてしまった！',
    winmsg: ':aine_kuyashii:は捨て台詞を言いながら帰っていった！',
    losemsg: '阨ちゃんは悲しくて逃げ出してしまった…',
    endingmsg:
      'aine_youshou:の大人げない本気の暴言にも負けずに追い返す事が出来た！',
    atk: 15,
    def: 15,
    maxdmg: 0.6,
    atkx: 7,
    defx: 7,
    abort: 0.04,
  },
  {
    name: 'ending',
    limit: (data, friend) =>
      (data.superUnlockCount ?? 0) >= 5 &&
      !data.clearHistory.includes('ending'),
    msg: `🎉阨ちゃんはあなたにいままでの冒険で行ってきた事を話したいようだ。`,
    short: '冒険のまとめ中',
    event: (module, msg, _data) => ending(module, msg, _data),
    atkmsg: () => '',
    defmsg: () => '',
  },
];

export const raidEnemys: RaidEnemy[] = [
  {
    name: ':kochi_dot:',
    msg: '巨大:kochi_dot:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) => `:kochi_dot:の踏み潰し攻撃！\n${dmg}ポイントのダメージ！`,
    winmsg: ':kochi_dot:はいつの間にか跡形もなく消えてしまった！',
    losemsg: '阨ちゃんはやられてしまった…',
    maxhp: 100000,
    atk: 4,
    def: 2,
    atkx: 6,
    defx: 4,
    power: 32,
  },
  {
    name: ':ddquino:',
    msg: '巨大:ddquino:打ち上げ大会！',
    short: '',
    hpmsg: '高度',
    mark: '☆',
    mark2: '★',
    lToR: true,
    atkmsg: (dmg) =>
      `阨ちゃんは大タルに点火した！\n  :ddquino:は${dmg}km飛び、流石にダメージを受けた！`,
    defmsg: (dmg) => `阨ちゃんは反動で${dmg}ポイントのダメージ！`,
    winmsg: ':ddquino:は遥か彼方まで飛んで行った',
    losemsg: '阨ちゃんはやられてしまった…',
    maxhp: 100000,
    atk: 2,
    def: 4,
    atkx: 4,
    defx: 6,
    power: 32,
  },
  {
    name: ':rolling_panjandrum:',
    msg: '巨大:rolling_panjandrum:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) => `阨ちゃんの妖術！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:rolling_panjandrum:の秒速13kmスピン！\n${dmg}ポイントのダメージ！`,
    winmsg: ':rolling_panjandrum:を鎮めた！',
    losemsg: '阨ちゃんはやられてしまった…',
    maxhp: 100000,
    atk: 7,
    def: 1,
    atkx: 7,
    defx: 2,
    power: 15,
  },
  {
    name: ':role_capsaishin:',
    msg: '巨大:role_capsaishin:の討伐試練！',
    short: '',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) =>
      `阨ちゃんは妖術を使った！\n:role_capsaishin:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:role_capsaishin:の激辛レッドミスト攻撃！\n阨ちゃんは${dmg}ポイントのダメージ！\n阨ちゃんが次に受けるダメージが上昇した！`,
    winmsg: '阨ちゃんは:role_capsaishin:の試練に打ち勝った！',
    losemsg: '阨ちゃんはやられてしまった…',
    atk: 0.5,
    def: 2,
    atkx: 2,
    defx: 4,
    fire: 0.15,
    power: 15,
  },
  {
    name: ':ainekun_dot:',
    msg: 'マイクラ:ainekun_dot:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんのお話し攻撃！\n:ainekun_dot:の精神に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:ainekun_dot:のマインドクラッシュ罵詈雑言！\n阨ちゃんの精神に${dmg}ポイントのダメージ！`,
    winmsg: ':ainekun_dot:は捨て台詞を言いながら帰っていった！',
    losemsg: '阨ちゃんは悲しくて逃げ出してしまった…',
    atk: 5,
    def: 5,
    atkx: 5,
    defx: 5,
    power: 50,
  },
  {
    name: ':syokusyu:',
    msg: '巨大:syokusyu:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:syokusyu:の大暴れ！\n阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg: ':syokusyu:は地中へ去って行った！',
    losemsg: '阨ちゃんはやられてしまった…',
    atk: 2,
    def: 5,
    atkx: 3,
    defx: 4,
    power: 26,
  },

  {
    name: ':mongolian_death_worm_dot:',
    msg: ':mongolian_death_worm_dot:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:mongolian_death_worm_dot:は毒液を吹きかけた！\n阨ちゃんに${dmg}ポイントのダメージ！`,
    winmsg: ':mongolian_death_worm_dot:は東京に帰って行った！',
    losemsg: '阨ちゃんはやられてしまった…',
    maxhp: 100000,
    atk: 4,
    def: 2,
    atkx: 5,
    defx: 5,
    power: 30,
  },
  {
    name: ':katsuo:',
    msg: ':katsuo:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:katsuo:は高速で泳いで阨ちゃんから逃げた！\nなんとか追いついた！\n疲れで${dmg}ポイントのダメージ！`,
    winmsg: '撃退した！',
    losemsg:
      ':katsuo:はさらに加速して阨ちゃんから逃げた！\n:katsuo:に逃げられてしまった…',
    abortmsg: ':katsuo:の泳ぐ速度が速すぎて、連続攻撃出来ない！',
    atk: 3,
    def: 1,
    atkx: 3,
    defx: 1,
    abort: 1,
    power: 20,
  },
  {
    name: ':yosomono_seinen:',
    msg: '巨大:yosomono_seinen:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) =>
      `阨ちゃんの攻撃！\n:yosomono_seinen:に${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:yosomono_seinen:の忘却の呪い！\n阨ちゃんは${dmg}ポイントのダメージ！`,
    winmsg: ':yosomono_seinen:は霧の中に消えていった…',
    losemsg: '阨ちゃんは気を失ってしまった…',
    atk: 2,
    def: 2,
    atkx: 2,
    defx: 2,
    power: 33,
    forcePostCount: 3,
  },
  {
    name: ':dog_chair:',
    msg: ':dog_chair:討伐戦！',
    short: '',
    mark: '☆',
    mark2: '★',
    lToR: false,
    atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
    defmsg: (dmg) =>
      `:dog_chair:はめちゃくちゃ頑丈だ…\n疲れで${dmg}ポイントのダメージ！`,
    winmsg: ':dog_chair:をどうにか撃退した！',
    losemsg: '阨ちゃんは疲れで倒れてしまった…',
    atk: 0.5,
    def: 8,
    atkx: 3,
    defx: 8,
    power: 30,
  },
];

/*
export const summerEnemys: Enemy[] = [
    { name: "ビーチ", msg: "阨ちゃんはビーチで休憩したいようだ！", short: "ビーチで休憩中", hpmsg: "リラックス度", atkmsg: dmg => `阨ちゃんは砂の城を作った！\nリラックス度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは日焼けしすぎて${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはビーチで十分にリラックスした！", losemsg: "阨ちゃんは日焼けで真っ赤になってしまった…", atk: 1, def: 1, atkx: 3, defx: 3, ltoR: true },
    { name: "アイスクリーム", msg: "阨ちゃんはアイスクリームを食べたいようだ！", short: "アイスを食べ中", hpmsg: "満足度", atkmsg: dmg => `阨ちゃんはアイスを食べた！\n満足度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんはアイスをこぼしてしまった！\n冷たい！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはアイスクリームを満喫した！", losemsg: "阨ちゃんはアイスをこぼしすぎて凍ってしまった…", atk: 1, def: 1.5, atkx: 3, defx: 4, ltoR: true },
    { name: "サーフィン", msg: "阨ちゃんはサーフィンをしたいようだ！", short: "サーフィン中", hpmsg: "グルーブ", atkmsg: dmg => `阨ちゃんは波に乗った！\nグルーブが${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは波にのまれて疲れた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはサーフィンを楽しんだ！", losemsg: "思ったよりも波が強く疲れてしまった…", atk: 2, def: 1, atkx: 5, defx: 3, ltoR: true },
    { name: "花火", msg: "阨ちゃんは花火を楽しみたいようだ！", short: "花火鑑賞中", hpmsg: "感動度", atkmsg: dmg => `阨ちゃんは花火を打ち上げた！\n感動度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは花火に火を付けるのに疲れた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは花火を堪能した！", losemsg: "阨ちゃんは花火に飽きてしまった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
    { name: "スイカ1", dname: "スイカ", msg: "阨ちゃんはスイカ割りをしたいようだ！", short: "スイカ割り中", atkmsg: dmg => `阨ちゃんはスイカを叩いた！\nスイカに${dmg}ポイントのダメージ！`, defmsg: dmg => `阨ちゃんは疲れで${dmg}ポイントのダメージ！`, winmsg: "スイカを割ることが出来た！", losemsg: "阨ちゃんはスイカを割れなかった…", atk: 0.8, def: 2, atkx: 3, defx: 4, ltoR: false },
    { name: "スイカ2", dname: "硬スイカ", limit: (data) => data.clearEnemySummer.includes("スイカ1") msg: "阨ちゃんは硬いスイカを持ってきたようだ！", short: "硬スイカ割り中", atkmsg: dmg => `阨ちゃんはスイカを叩いた！\nスイカに${dmg}ポイントのダメージ！`, defmsg: dmg => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`, winmsg: "スイカを割ることが出来た！", losemsg: "阨ちゃんはスイカを割れなかった…", atk: 0.7, def: 4, atkx: 3, defx: 5, ltoR: false },
    { name: "スイカ3", dname: "激硬スイカ", limit: (data) => data.clearEnemySummer.includes("スイカ2") msg: "阨ちゃんは更に硬いスイカを持ってきたようだ！\nどうやら硬すぎて困ってる人がいるらしい…", short: "激硬スイカ割り中", atkmsg: dmg => `阨ちゃんはスイカを叩いた！\nスイカに${dmg}ポイントのダメージ！`, defmsg: dmg => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`, winmsg: "スイカを割ることが出来た！", losemsg: "阨ちゃんはスイカを割れなかった…", atk: 0.6, def: 6, atkx: 2, defx: 7, ltoR: false },
    { name: "キャンプ", msg: "阨ちゃんはキャンプを楽しみたいようだ！", short: "キャンプ中", hpmsg: "楽しさ", atkmsg: dmg => `阨ちゃんは焚火を大きくした！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは焚火の火の粉を受けた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは満足した！", losemsg: "阨ちゃんは焚火で火傷をしてしまった…", atk: 2.5, def: 1.5, atkx: 4, defx: 3, ltoR: true },
    { name: "日光浴", msg: "阨ちゃんは日光浴をしたいようだ！", short: "日光浴中", hpmsg: "満足度", atkmsg: dmg => `阨ちゃんは日光を浴びた！\n満足度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは暑さで${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは日光浴を楽しんだ！", losemsg: "阨ちゃんは暑くて干からびてしまった…", atk: 1.5, def: 1, atkx: 3, defx: 3, ltoR: true },
    { name: "プール", msg: "阨ちゃんはプールで泳ぎたいようだ！", short: "プールで泳ぎ中", hpmsg: "距離", atkmsg: dmg => `阨ちゃんはバシャバシャ泳いだ！\n${dmg}m泳いだ！`, defmsg: dmg => `阨ちゃんは疲れで${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはプールで泳ぎを楽しんだ！", losemsg: "阨ちゃんは疲れて泳げなくなった…", atk: 2, def: 2, atkx: 4, defx: 4, ltoR: true },
    { name: "バーベキュー", msg: "阨ちゃんはバーベキューを楽しみたいようだ！", short: "バーベキュー中", hpmsg: "満腹度", atkmsg: dmg => `阨ちゃんはお肉を焼いて食べた！\n満腹度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは焦げたお肉を食べてしまった！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはバーベキューを楽しんだ！", losemsg: "阨ちゃんは焦げたお肉でお腹を壊してしまった…", atk: 2, def: 1, atkx: 4, defx: 3, ltoR: true },
    { name: "釣り", msg: "阨ちゃんは釣りをしたいようだ！", short: "釣り中", hpmsg: "釣果", atkmsg: dmg => Math.random() < 0.3 ? `阨ちゃんは大物を釣り上げた！\n釣果が${dmg}ポイントアップ！` : `阨ちゃんはまあまあの魚を釣り上げた！\n釣果が${dmg}ポイントアップ！`, defmsg: dmg => `糸が絡まった！\nほどいた疲れで${dmg}ポイントのダメージ！`, winmsg: "大量に魚がつれた！", losemsg: "糸が絡まって釣りを続けられなくなった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
    { name: "ハイキング", msg: "阨ちゃんはハイキングをしたいようだ！", short: "ハイキング中", hpmsg: "体力", atkmsg: dmg => `阨ちゃんは山を登った！\n体力が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは疲れで${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはハイキングを楽しんだ！", losemsg: "阨ちゃんは疲れて倒れてしまった…", atk: 1, def: 4, atkx: 3, defx: 5, ltoR: true },
    { name: "ピクニック", msg: "阨ちゃんはピクニックをしたいようだ！", short: "ピクニック中", hpmsg: "満足度", atkmsg: dmg => `阨ちゃんはサンドイッチを食べた！\n満足度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんはアリに襲われた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはピクニックを楽しんだ！", losemsg: "阨ちゃんはアリに襲われて疲れてしまった…", atk: 0.1, def: 1, atkx: 1, defx: 3, ltoR: true },
    { name: "遊園地", msg: "阨ちゃんは遊園地に行くようだ！", short: "遊園地で遊び中", hpmsg: "楽しさ", atkmsg: dmg => `阨ちゃんはアトラクションに乗った！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは乗り物に酔った！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは遊園地を満喫した！", losemsg: "阨ちゃんは乗り物酔いで倒れてしまった…", atk: 2, def: 1, atkx: 4, defx: 3, ltoR: true },
    { name: "夜の散歩", msg: "阨ちゃんは夜のさんぽをするようだ！", short: "夜のさんぽ中", hpmsg: "楽しさ", atkmsg: dmg => `阨ちゃんは蛍を見た！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは蚊に刺されて疲れた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは夏の夜を満喫した！", losemsg: "阨ちゃんは蚊に刺されてやられてしまった…", atk: 0.4, def: 2, atkx: 3, defx: 3, ltoR: true },
    { name: "シュノーケリング", msg: "阨ちゃんはシュノーケリングをしたいようだ！", short: "シュノーケリング中", hpmsg: "探検度", atkmsg: dmg => Math.random() < 0.5 ? `阨ちゃんは魚を見つけた！\n探検度が${dmg}ポイントアップ！` : `阨ちゃんは洞窟を見つけた！\n探検度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんはクラゲに刺された！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんはシュノーケリングを満喫した！", losemsg: "阨ちゃんはクラゲにやられてしまった…", atk: 0.5, def: 3, atkx: 3, defx: 4, ltoR: true },
    { name: "夏祭り", msg: "夏祭りを見つけた！", short: "夏祭り中", hpmsg: "楽しさ", atkmsg: dmg => Math.random() < 0.5 ? `阨ちゃんは屋台を巡った！\n楽しさが${dmg}ポイントアップ！` : `阨ちゃんは屋台でゲームをした！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは疲れで${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは夏祭りを満喫した！", losemsg: "阨ちゃんは疲れて倒れてしまった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
    { name: "星見", msg: "阨ちゃんは星を見たいようだ！", short: "星を観察中", hpmsg: "感動度", atkmsg: dmg => `阨ちゃんは流れ星を見つけた！\n感動度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは眠くなってきた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは星を満喫した！", losemsg: "阨ちゃんは眠ってしまった…", atk: 0.5, def: 4, atkx: 3, defx: 5, ltoR: true },
    { name: "砂の城", msg: "阨ちゃんは砂の城を作りたいようだ！", short: "砂の城作り中", hpmsg: "創造度", atkmsg: dmg => `阨ちゃんは砂を掘った！\n創造度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは波にのまれた！\n${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは砂の城を完成させた！", losemsg: "砂の城が波で壊れてしまった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
    { name: "夏休みの宿題", msg: "阨ちゃんは夏休みの宿題がまだ残っているようだ…", limit: (data) => data.clearEnemySummer.length >= summerEnemys.length - 1 short: "夏休みの宿題着手中", hpmsg: "完了度", atkmsg: dmg => `阨ちゃんは夏休みの宿題を進めた！\n完了度が${dmg}ポイントアップ！`, defmsg: dmg => `阨ちゃんは疲れで${dmg}ポイントのダメージ！`, winmsg: "阨ちゃんは夏休みの宿題を完了！\nやったー！", losemsg: "阨ちゃんは疲れてしまった…", atk: 0.05, def: 20, atkx: 3, defx: 5, ltoR: true }
];
*/

/** 修行モードの場合の敵 */
export const endressEnemy = (data): Enemy => ({
  name: '修行モード',
  msg:
    data.endress ?? 0
      ? `修行の途中 (ステージ${data.endress + 1})`
      : '阨ちゃんは修行に出たいようだ。',
  short:
    data.endress ?? 0 ? `修行の途中 (ステージ${data.endress + 1})` : '修行中',
  hpmsg: '進行度',
  lToR: true,
  mark: '☆',
  mark2: '★',
  atkmsg: (dmg) => `阨ちゃんは先に進んだ。\n進行度が${dmg}ポイントアップ！`,
  defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
  abortmsg: '阨ちゃんは面白いものを見つけたみたいだ。',
  winmsg:
    '寝泊りするのによい感じのふかふかの草むらが見えてきた。\n今日はここで休むようだ。\n\n次のステージへ続く…',
  losemsg: '阨ちゃんは疲れてしまった…',
  escapemsg:
    '阨ちゃんは疲れてしまったが、\n焦ることもないなと思い、\nその場で休憩を始めた。',
  atk: 1.5 + 0.1 * (data.endress ?? 0),
  def: 2 + 0.3 * (data.endress ?? 0),
  atkx: 3 + 0.05 * (data.endress ?? 0),
  defx: 3 + 0.15 * (data.endress ?? 0),
  abort: 0.01,
});

export const ending = (module: rpg, msg: Message, _data: any): any => {
  const data = _data;
  /** 使用中の色情報 */
  const color =
    colors.find((x) => x.id === (data.color ?? 1)) ??
    colors.find((x) => x.default) ??
    colors[0];
  /** プレイヤーの見た目 */
  let me = color.name;
  let cw = acct(msg.user) + ' ' + `${data.enemy.msg}`;
  let message = `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;

  for (const name of data.clearHistory) {
    const emsg = enemys.find((x) => x.name === name)?.endingmsg;
    if (!emsg) continue;
    message += emsg + '\n\n';
    msg.friend.incLove(0.1);
  }

  message += `${msg.friend.name ?? 'そなた'}が\nそばに付いてくれていたおかげで、\nこれだけ色々な事が出来たのじゃ！\nありがとうなのじゃ！\nそしてこれからもよろしくなのじゃ！\n\n`;

  message += [
    `${serifs.rpg.status.lv} : ${data.lv ?? 1}`,
    `最大体力 : ${100 + data.lv * 3}`,
    `${serifs.rpg.status.atk} : ${data.atk ?? 0}`,
    `${serifs.rpg.status.def} : ${data.def ?? 0}`,
    `${serifs.rpg.status.spd} : ${
      Math.floor((msg.friend.love ?? 0) / 100) + 1
    }`,
    `平均能力上昇量 : ${((data.atk + data.def) / (data.lv - 1)).toFixed(2)}`,
    `これまでの勝利数 : ${data.winCount}`,
    `最高修行ステージ数 : ${(data.maxEndress ?? 0) + 1}`,
    `最大耐ダメージ数 : ${data.superMuscle ?? 0}`,
    `最大能力上昇値 : ${data.maxStatusUp ?? 0} (1 / ${Math.pow(
      3,
      data.maxStatusUp - 7,
    )})`,
    `最大木人ダメージ : ${data.bestScore ?? 0}`,
    `覚醒した回数 : ${data.superCount ?? 0}`,
    `解放した色の数 : ${unlockCount(data, [], false)}`,
  ]
    .filter(Boolean)
    .join('\n');

  message += `\n\n**ここまでRPGモードを遊んでくれてありがとうなのじゃ！**\n阨ちゃんの体力の詳細な数値が表示されるようになったのじゃ！`;

  msg.friend.incLove(0.1);
  data.info = 3;

  // クリアした敵のリストを追加
  if (!(data.clearEnemy ?? []).includes(data.enemy.name))
    data.clearEnemy.push(data.enemy.name);
  if (!(data.clearHistory ?? []).includes(data.enemy.name))
    data.clearHistory.push(data.enemy.name);
  // 次の試合に向けてのパラメータセット
  data.enemy = null;
  data.count = 1;
  data.php = 103 + (data.lv ?? 1) * 3;
  data.ehp = 103 + (data.lv ?? 1) * 3 + (data.winCount ?? 0) * 5;
  data.maxTp = 0;
  data.fireAtk = 0;

  // レベルアップ処理
  data.lv = (data.lv ?? 1) + 1;
  let atkUp = 2 + Math.floor(Math.random() * 4);
  let totalUp = 7;
  while (Math.random() < 0.335) {
    totalUp += 1;
    if (Math.random() < 0.5) atkUp += 1;
  }

  if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

  if (data.atk > 0 && data.def > 0) {
    /** 攻撃力と防御力の差 */
    const diff = data.atk - data.def;
    const totalrate = 0.2 + Math.min(Math.abs(diff) * 0.005, 0.3);
    const rate = Math.pow(0.5, Math.abs(diff / 100)) * (totalrate / 2);
    if (Math.random() < (diff > 0 ? totalrate - rate : rate)) atkUp = totalUp;
    else if (Math.random() < (diff < 0 ? totalrate - rate : rate)) atkUp = 0;
  }
  data.atk = (data.atk ?? 0) + atkUp;
  data.def = (data.def ?? 0) + totalUp - atkUp;

  msg.friend.setPerModulesData(new rpg(), data);

  msg.reply(`<center>${message}</center>`, {
    cw,
    visibility: 'public',
  });

  return {
    reaction: me,
  };
};

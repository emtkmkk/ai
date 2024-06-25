// RPGで使用する敵の情報

type Enemy = {
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
    mark: string;
    /** 満たされたマーク HP表示に使用 */
    mark2: string;
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
    winmsg: string;
    /** 敗北時のメッセージ */
    losemsg: string;
    /** 最大HP 未指定なら300 */
    maxhp?: number | ((hp: number) => number);
    /**
     * 攻撃力倍率 1でプレイヤーのLvの3.5倍の値になる
     * （プレイヤーの最低保証分のパラメータを均等に割り振った値）
     * 関数で指定した場合は倍率ではなく、その値がそのまま使用される
     * */
    atk: number | ((atk: number, def: number, spd: number) => number);
    /**
     * 防御力倍率 1でプレイヤーのLvの3.5倍の値になる
     * （プレイヤーの最低保証分のパラメータを均等に割り振った値）
     * 関数で指定した場合は倍率ではなく、その値がそのまま使用される
     * */
    def: number | ((atk: number, def: number, spd: number) => number);
    /**  攻撃回数 未指定で1 */
    spd?: number;
    /** 
     * 攻撃ボーナス倍率 基本的な値は3
     * プレイヤーの投稿数ボーナスと同じかかり方をする
     * */
    atkx: number | ((tp: number) => number);
    /** 
     * 防御ボーナス倍率 基本的な値は3
     * プレイヤーの投稿数ボーナスと同じかかり方をする
     * */
    defx: number | ((tp: number) => number);
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
};

/** 敵一覧 */
export const enemys: Enemy[] = [
    { name: ":mk_catchicken:", msg: ":mk_catchicken:が撫でてほしいようだ。", short: ":mk_catchicken:を撫で中", hpmsg: "満足度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で！\n${dmg}ポイント満足させた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:を満足させた！", losemsg: "もこチキは疲れで倒れてしまった…", atk: 1, def: 1, atkx: 3, defx: 3 },
    { name: ":nisemokochiki_mzh:", msg: ":nisemokochiki_mzh:が本物と成り替わろうと勝負を仕掛けてきた！", short: ":nisemokochiki_mzh:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽ペチ！\n:nisemokochiki_mzh:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:nisemokochiki_mzh:の謎の攻撃！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: "どっちが本物か分からせてやった！", losemsg: "もこチキはやられてしまった…", atk: 2, def: 0.5, atkx: 3, defx: 3 },
    { name: ":mokochoki:", msg: ":mokochoki:がじゃんけんをしたいようだ。", short: ":mokochoki:とじゃんけん中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはパーを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", atk: 1, def: 1, atkx: 3, defx: 3 },
    { name: ":kirin_mkchicken:", msg: ":kirin_mkchicken:は草を食べたいようだ。", short: ":kirin_mkchicken:に草を与え中", hpmsg: "満腹度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは草を${dmg / 10}kg持ってきた！\n:kirin_mkchicken:は全て食べた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":kirin_mkchicken:は満足したようだ！", losemsg: "もこチキは疲れで倒れてしまった…", atk: 1, def: 1, atkx: 3, defx: 3 },
    { name: ":mk_senryu_kun:", msg: ":mk_senryu_kun:が川柳で勝負したいようだ。", short: ":mk_senryu_kun:と川柳バトル中", mark: "☆", mark2: "★", lToR: true, pLToR: true, atkmsg: (dmg) => `もこチキは考えた！\n川柳の完成度が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_senryu_kun:はTLから情報を収集した！\n:mk_senryu_kun:の川柳の完成度が${dmg}ポイントアップ！`, winmsg: "審査員が来た！\n良い川柳と判定されたのはもこチキだった！", losemsg: "審査員が来た！\n良い川柳と判定されたのは:mk_senryu_kun:だった！", atk: 0.7, def: 1.5, atkx: 3, defx: 3, maxdmg: 0.95, notEndure: true },
    { name: "もこチキは猛勉強", limit: (data) => (data.streak ?? 0) >= 2, msg: "もこチキは猛勉強を行うようだ。", short: "猛勉強中", hpmsg: "勉強度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは勉強に取り組んだ！\n勉強度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったので勉強を一旦止めた！", winmsg: "もこチキは試験で高得点を得ることが出来た！", losemsg: "もこチキは疲れて勉強を諦めてしまった…", maxhp: 320, atk: 2, def: 0.8, atkx: 4, defx: 3, maxdmg: 0.85, abort: 0.05 },
    { name: "もこチキはTLの巡回", limit: (data) => (data.streak ?? 0) >= 2, msg: "もこチキはTLの巡回を行うようだ。", short: "TLの巡回中", hpmsg: "TL巡回完了度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキはTLの投稿にリアクションを押した！\nTL巡回完了度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったのでTL巡回を一旦止めた！", winmsg: "もこチキはTLの投稿にリアクションを付け終わった！", losemsg: "もこチキは疲れて寝てしまった…", atk: 0.6, def: 2, atkx: 3, defx: 3, maxdmg: 0.95, abort: 0.05 },
    { name: ":mk_fly_sliver:", limit: (data) => (data.streak ?? 0) >= 2, msg: ":mk_fly_sliver:が一緒に空を飛びたいようだ。", short: ":mk_fly_sliver:と飛行中", hpmsg: "高度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは羽ばたいた！\n${Math.floor(dmg * 4.57)}cm浮いた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "もこチキはかなり高く飛行できた！", losemsg: "もこチキは疲れで墜落してしまった…", atk: 1.5, def: 1.5, atkx: 3.5, defx: 3.5 },
    { name: ":mk_tatsu:", limit: (data) => (data.streak ?? 0) >= 2, msg: ":mk_tatsu:が暴れている！止めないと！", short: ":mk_tatsu:を食い止め中", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは羽を振って衝撃波を出した！\n:mk_tatsu:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_tatsu:の炎ブレス攻撃！\nもこチキは${dmg}ポイントのダメージ！\nもこチキが次に受けるダメージが上昇した！`, winmsg: "もこチキは:mk_tatsu:を懲らしめた！", losemsg: "もこチキはやられてしまった…", atk: 0.5, def: 2, atkx: 2, defx: 4, fire: 0.2 },
    { name: ":mk_senryu_kun:2", dname: ":mk_senryu_kun:", limit: (data) => (data.streak ?? 0) >= 3 && data.clearEnemy.includes(":mk_senryu_kun:"), msg: ":mk_senryu_kun:が川柳のリベンジをしたいようだ。", short: ":mk_senryu_kun:と川柳バトル中（ふたたび）", mark: "☆", mark2: "★", lToR: true, pLToR: true, atkmsg: (dmg) => `もこチキは考えた！\n川柳の完成度が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_senryu_kun:はTLから情報を収集した！\n:mk_senryu_kun:の川柳の完成度が${dmg}ポイントアップ！`, winmsg: "審査員が来た！\n良い川柳と判定されたのはもこチキだった！", losemsg: "審査員が来た！\n良い川柳と判定されたのは:mk_senryu_kun:だった！", atk: 0.7, def: 1.5, atkx: 5, defx: 5, maxdmg: 0.6, notEndure: true },
    { name: ":mk_ojousamachicken:", limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3, msg: ":mk_ojousamachicken:がお嬢様バトルを仕掛けてきた！", short: ":mk_ojousamachicken:とお嬢様バトル中", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは扇子で攻撃！\n:mk_ojousamachicken:に${dmg}ポイントのお嬢様ダメージ！`, defmsg: (dmg) => `:mk_ojousamachicken:のドリルヘアーアタック！\n${dmg}ポイントのお嬢様ダメージ！`, abortmsg: ":mk_ojousamachicken:はもこチキの連続扇子攻撃を受け流した！", winmsg: "もこチキはお嬢様バトルを制した！", losemsg: "もこチキはお嬢様バトルに敗北した…", atk: 0.9, def: 3, atkx: 3, defx: 6, abort: 0.2 },
    { name: ":muscle_mkchicken:", limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3, msg: ":muscle_mkchicken:が力比べをしたいようだ。", short: ":muscle_mkchicken:と力比べ中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽バサバサ！\n:muscle_mkchicken:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:muscle_mkchicken:のマッスルアタック！\nもこチキは${dmg}ポイントのダメージ！`, abortmsg: ":muscle_mkchicken:は気合でもこチキの連続攻撃を止めた！", winmsg: "もこチキは:muscle_mkchicken:を倒した！", losemsg: "もこチキはやられてしまった…", atk: 4, def: 0.4, atkx: 6, defx: 3, abort: 0.3 },
    { name: ":mk_catchicken:2", dname: ":mk_catchicken:", limit: (data) => (data.winCount ?? 0) >= 4 && (data.streak ?? 0) >= 4 && data.clearEnemy.includes(":mk_catchicken:"), msg: ":mk_catchicken:は不機嫌のようだ…", short: ":mk_catchicken:のご機嫌取り中", hpmsg: "機嫌", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で撫で！\n:mk_catchicken:の機嫌が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_catchicken:のひっかき！\n${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:はご機嫌になった！", losemsg: "もこチキはやられてしまった…", atk: 0.75, def: 1.5, spd: 5, atkx: 3, defx: 4 },
    { name: ":mokochoki:2", dname: ":mokochoki:", limit: (data) => (data.winCount ?? 0) >= 4 && (data.streak ?? 0) >= 4 && data.clearEnemy.includes(":mokochoki:"), msg: ":mokochoki:がじゃんけんでリベンジをしたいようだ。", short: ":mokochoki:とじゃんけん中（ふたたび）", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:はパーのプラカードを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", atk: 2, def: 2, atkx: 3, defx: 3 },
    { name: ":mk_tatsu:2", dname: ":mk_tatsu:", limit: (data) => (data.winCount ?? 0) >= 40 && (data.streak ?? 0) >= 4 && data.clearEnemy.includes(":mk_tatsu:"), msg: ":mk_tatsu:がまた暴れている！止めないと！", short: ":mk_tatsu:を食い止め中（ふたたび）", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは全力で羽を振って衝撃波を出した！\n:mk_tatsu:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_tatsu:の炎ブレス攻撃！\nもこチキは${dmg}ポイントのダメージ！\nもこチキが次に受けるダメージが上昇した！`, abortmsg: "もこチキは全力で攻撃した為、連続攻撃出来ない！", winmsg: "もこチキは:mk_tatsu:を懲らしめた！", losemsg: "もこチキはやられてしまった…", atk: 0.1, def: 1, atkx: 1, defx: (tp) => 1.3 * tp, fire: 0.15, abort: 1 },
    { name: ":mk_hero:", limit: (data) => ((data.winCount ?? 0) >= 24 || ((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) || new Date().getMonth() - new Date().getDate() === -1) && (data.color ?? 1) === 8 && !data.clearEnemy.includes(":mk_hero_8p:"), msg: "かつての自分自身、:mk_hero:が現れ、勝負を仕掛けてきた！", short: ":mk_hero:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの剣攻撃！\n過去の自分に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `過去の自分の剣攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "過去の自分は消えていった！\nどうやら幻だったようだ…", losemsg: "もこチキはやられてしまった…\n過去の自分はどこかへ消えていった…", maxhp: (hp) => hp - 3, atk: (atk, def, spd) => def - 3.5, def: (atk, def, spd) => (atk - 3.5) * spd, atkx: (tp) => tp, defx: (tp) => tp },
    { name: ":mk_hero_8p:", limit: (data) => ((data.winCount ?? 0) >= 24 || ((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) || new Date().getMonth() - new Date().getDate() === -1) && (data.color ?? 1) !== 8 && !data.clearEnemy.includes(":mk_hero:"), msg: "異空間から:mk_hero_8p:が現れ、勝負を仕掛けてきた！", short: ":mk_hero_8p:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの剣攻撃！\n:mk_hero_8p:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_hero_8p:の剣攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_hero_8p:に打ち勝った！", losemsg: "もこチキはやられてしまった…", maxhp: (hp) => hp, atk: (atk, def, spd) => def, def: (atk, def, spd) => atk * spd, atkx: (tp) => tp, defx: (tp) => tp },
    { name: ":mk_chickenda:", limit: (data) => (data.winCount ?? 0) >= 5 && (data.streak ?? 0) >= 5, msg: ":mk_chickenda:が勝負を仕掛けてきた！", short: ":mk_chickenda:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda:の†！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_chickenda:は帰っていった！", losemsg: "もこチキはやられてしまった…", maxhp: 130, atk: 5, def: 5, maxdmg: 0.7, atkx: 5, defx: 5 },
    { name: ":mk_chickenda_gtgt:", limit: (data, friend) => (data.winCount ?? 0) >= 15 && (data.streak ?? 0) >= 7 && (friend.love ?? 0) >= 500 && data.clearEnemy.includes(":mk_chickenda:"), msg: ":mk_chickenda_gtgt:が本気の勝負を仕掛けてきた！", short: ":mk_chickenda_gtgt:と本気の戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda_gtgt:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda_gtgt:の†！\nもこチキに${dmg}ポイントのダメージ！`, abortmsg: ":mk_chickenda_gtgt:は:muscle_mkchicken:を召還した！もこチキの連続攻撃を止めた！", winmsg: ":mk_chickenda_gtgt:は帰っていった！", losemsg: "もこチキはやられてしまった…", atk: 15, def: 15, maxdmg: 0.6, atkx: 7, defx: 7, abort: 0.04 },
];

/** 旅モードの場合の敵 */
export const endressEnemy = (data): Enemy => ({
    name: "もこチキは旅",
    msg: (data.endress ?? 0) ? `旅の途中 (${data.endress + 1}日目)` : "もこチキは旅に出たいようだ。",
    short: (data.endress ?? 0) ? `旅の途中 (${data.endress + 1}日目)` : "旅立ち中",
    hpmsg: "進行度",
    lToR: true,
    mark: "☆",
    mark2: "★",
    atkmsg: (dmg) => `もこチキは先に進んだ。\n進行度が${dmg}ポイントアップ！`,
    defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`,
    abortmsg: "もこチキは面白いものを見つけたみたいだ。",
    winmsg: "宿が見えてきた。\n今日はここで休むようだ。\n\n次の日へ続く…",
    losemsg: "今回の旅はここで終えて家に帰るようだ。",
    atk: 1.5 + (0.1 * (data.endress ?? 0)),
    def: 2 + (0.3 * (data.endress ?? 0)),
    atkx: 3 + (0.05 * (data.endress ?? 0)),
    defx: 3 + (0.15 * (data.endress ?? 0)),
    abort: 0.01,
})
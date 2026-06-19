/**
 * @packageDocumentation
 *
 * RPGモジュールの敵定義
 *
 * enemys に通常敵の定義、raidEnemys にレイド敵の定義を保持する。
 * Enemy 型は戦闘時のステータス・HP・メッセージ等を定義し、RaidEnemy は power / pattern 等を追加する。
 *
 * @remarks
 * - endressEnemy は旅モード用のエンドレス敵を返す
 * - event を持つ敵は独自イベントに委譲される
 *
 * @public
 */
import Message from "@/message";
import { colors, unlockCount } from "./colors";
import rpg from "./index";
import serifs from "@/serifs";
import { aggregateTokensEffects } from './shop';
import { acct } from "@/utils/acct";
import config from "@/config";

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
	event?: ((module: rpg, msg: Message, _data: any) => any);
};

export type RaidEnemy = Enemy & {
	/** 強さを表す数値 レイドボスの評価に使用 攻撃力 * 攻撃倍率 + 防御力 * 防御倍率 */
	power?: number;
	/** 投稿数を固定する */
	forcePostCount?: number;
	/** 乱数を固定する */
	fixRnd?: number;
	/** スキル効果倍率 */
	skillX?: number;
	/** ダメージは常にクリティカル？ */
	alwaysCrit?: boolean;
	/** 処理に使用するパターンを指定 */
	pattern?: number;
	/** 全力の一撃の最大ダメージを指定 */
	maxLastDmg?: number;
	/** 参加者募集時のメッセージを指定 */
	introMsg?: ((enemyName: string, time: number) => string);
	/** ダメージのメッセージを指定 */
	scoreMsg?: string;
	/** ダメージの単位を指定 */
	scoreMsg2?: string;
};

const has = (arr?: string[], name?: string) => Array.isArray(arr) && !!name && arr.includes(name);

/** 敵一覧 */
export const enemys: Enemy[] = [
	{ name: ":mk_catchicken:", msg: ":mk_catchicken:が撫でてほしいようだ。", short: ":mk_catchicken:を撫で中", hpmsg: "満足度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で！\n${dmg}ポイント満足させた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:を満足させた！", losemsg: "もこチキは疲れで倒れてしまった…", atk: 1, def: 1, atkx: 3, defx: 3 },
	{ name: ":nisemokochiki_mzh:", msg: ":nisemokochiki_mzh:が本物と成り替わろうと勝負を仕掛けてきた！", short: ":nisemokochiki_mzh:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽ペチ！\n:nisemokochiki_mzh:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:nisemokochiki_mzh:の謎の攻撃！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: "どっちが本物か分からせてやった！", losemsg: "もこチキはやられてしまった…", endingmsg: ":nisemokochiki_mzh:にどちらが本物か分からせた！", atk: 2, def: 0.5, atkx: 3, defx: 3 },
	{ name: ":mokochoki:", msg: ":mokochoki:がじゃんけんをしたいようだ。", short: ":mokochoki:とじゃんけん中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはパーを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", atk: 1, def: 1, atkx: 3, defx: 3 },
	{ name: ":kirin_mkchicken:", msg: ":kirin_mkchicken:は草を食べたいようだ。", short: ":kirin_mkchicken:に草を与え中", hpmsg: "満腹度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは草を${dmg / 10}kg持ってきた！\n:kirin_mkchicken:は全て食べた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: ":kirin_mkchicken:は満足したようだ！", losemsg: "もこチキは疲れで倒れてしまった…", endingmsg: ":kirin_mkchicken:に草を沢山あげて満足させた！", atk: 1, def: 1, atkx: 3, defx: 3 },
	{ name: ":mk_senryu_kun:", msg: ":mk_senryu_kun:が川柳で勝負したいようだ。", short: ":mk_senryu_kun:と川柳バトル中", mark: "☆", mark2: "★", lToR: true, pLToR: true, atkmsg: (dmg) => `もこチキは考えた！\n川柳の完成度が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_senryu_kun:はTLから情報を収集した！\n:mk_senryu_kun:の川柳の完成度が${dmg}ポイントアップ！`, winmsg: "審査員が来た！\n良い川柳と判定されたのはもこチキだった！", losemsg: "審査員が来た！\n良い川柳と判定されたのは:mk_senryu_kun:だった！", atk: 0.7, def: 1.5, atkx: 3, defx: 3, maxdmg: 0.95, notEndure: true },
	{ name: "もこチキは猛勉強", limit: (data) => (data.streak ?? 0) >= 2, msg: "もこチキは猛勉強を行うようだ。", short: "猛勉強中", hpmsg: "勉強度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは勉強に取り組んだ！\n勉強度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったので勉強を一旦止めた！", winmsg: "もこチキは試験で高得点を得ることが出来た！", losemsg: "もこチキは疲れて勉強を諦めてしまった…", endingmsg: "勉強を沢山して高得点を得ることが出来た！", maxhp: 320, atk: 2, def: 0.8, atkx: 4, defx: 3, maxdmg: 0.85, abort: 0.05 },
	{ name: "もこチキはTLの巡回", limit: (data) => (data.streak ?? 0) >= 2, msg: "もこチキはTLの巡回を行うようだ。", short: "TLの巡回中", hpmsg: "TL巡回完了度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキはTLの投稿にリアクションを押した！\nTL巡回完了度が${dmg}ポイントアップ！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, abortmsg: "もこチキはサボりたくなったのでTL巡回を一旦止めた！", winmsg: "もこチキはTLの投稿にリアクションを付け終わった！", losemsg: "もこチキは疲れて寝てしまった…", endingmsg: "TLを巡回してリアクションを沢山付ける事が出来た！", atk: 0.6, def: 2, atkx: 3, defx: 3, maxdmg: 0.95, abort: 0.05 },
	{ name: ":mk_fly_sliver:", limit: (data) => (data.streak ?? 0) >= 2, msg: ":mk_fly_sliver:が一緒に空を飛びたいようだ。", short: ":mk_fly_sliver:と飛行中", hpmsg: "高度", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキは羽ばたいた！\n${Math.floor(dmg * 4.57)}cm浮いた！`, defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "もこチキはかなり高く飛行できた！", losemsg: "もこチキは疲れで墜落してしまった…", endingmsg: ":mk_fly_sliver:と一緒に空を飛ぶ事が出来た！", atk: 1.5, def: 1.5, atkx: 3.5, defx: 3.5 },
	{ name: ":mk_tatsu:", limit: (data) => (data.streak ?? 0) >= 2, msg: ":mk_tatsu:が暴れている！止めないと！", short: ":mk_tatsu:を食い止め中", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは羽を振って衝撃波を出した！\n:mk_tatsu:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_tatsu:の炎ブレス攻撃！\nもこチキは${dmg}ポイントのダメージ！\nもこチキが次に受けるダメージが上昇した！`, winmsg: "もこチキは:mk_tatsu:を懲らしめた！", losemsg: "もこチキはやられてしまった…", endingmsg: ":mk_tatsu:の炎に負けずに暴れるのを止められた！", atk: 0.5, def: 2, atkx: 2, defx: 4, fire: 0.2 },
	{ name: ":mk_senryu_kun:2", dname: ":mk_senryu_kun:", limit: (data) => (data.streak ?? 0) >= 3 && has(data.clearEnemy, ":mk_senryu_kun:"), msg: ":mk_senryu_kun:が川柳のリベンジをしたいようだ。", short: ":mk_senryu_kun:と川柳バトル中（ふたたび）", mark: "☆", mark2: "★", lToR: true, pLToR: true, atkmsg: (dmg) => `もこチキは考えた！\n川柳の完成度が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_senryu_kun:はTLから情報を収集した！\n:mk_senryu_kun:の川柳の完成度が${dmg}ポイントアップ！`, winmsg: "審査員が来た！\n良い川柳と判定されたのはもこチキだった！", losemsg: "審査員が来た！\n良い川柳と判定されたのは:mk_senryu_kun:だった！", endingmsg: ":mk_senryu_kun:との川柳勝負に勝つ事が出来た！", atk: 0.7, def: 1.5, atkx: 5, defx: 5, maxdmg: 0.6, notEndure: true },
	{ name: ":mk_ojousamachicken:", limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3, msg: ":mk_ojousamachicken:がお嬢様バトルを仕掛けてきた！", short: ":mk_ojousamachicken:とお嬢様バトル中", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは扇子で攻撃！\n:mk_ojousamachicken:に${dmg}ポイントのお嬢様ダメージ！`, defmsg: (dmg) => `:mk_ojousamachicken:のドリルヘアーアタック！\n${dmg}ポイントのお嬢様ダメージ！`, abortmsg: ":mk_ojousamachicken:はもこチキの連続扇子攻撃を受け流した！", winmsg: "もこチキはお嬢様バトルを制した！", losemsg: "もこチキはお嬢様バトルに敗北した…", endingmsg: ":mk_ojousamachicken:にお嬢様としての格が違う事を分からせた！", atk: 0.9, def: 3, atkx: 3, defx: 6, abort: 0.2 },
	{ name: ":muscle_mkchicken:", limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3, msg: ":muscle_mkchicken:が力比べをしたいようだ。", short: ":muscle_mkchicken:と力比べ中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽バサバサ！\n:muscle_mkchicken:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:muscle_mkchicken:のマッスルアタック！\nもこチキは${dmg}ポイントのダメージ！`, abortmsg: ":muscle_mkchicken:は気合でもこチキの連続攻撃を止めた！", winmsg: "もこチキは:muscle_mkchicken:を倒した！", losemsg: "もこチキはやられてしまった…", endingmsg: ":muscle_mkchicken:に負けないほどの力を手に入れた！", atk: 4, def: 0.4, atkx: 6, defx: 3, abort: 0.3 },
	{ name: ":mk_catchicken:2", dname: ":mk_catchicken:", limit: (data) => (data.winCount ?? 0) >= 4 && (data.streak ?? 0) >= 4 && has(data.clearEnemy, ":mk_catchicken:"), msg: ":mk_catchicken:は不機嫌のようだ…", short: ":mk_catchicken:のご機嫌取り中", hpmsg: "機嫌", mark: "☆", mark2: "★", lToR: true, atkmsg: (dmg) => `もこチキの撫で撫で！\n:mk_catchicken:の機嫌が${dmg}ポイントアップ！`, defmsg: (dmg) => `:mk_catchicken:のひっかき！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: ":mk_catchicken:はご機嫌になった！", losemsg: "もこチキはやられてしまった…", endingmsg: ":mk_catchicken:を撫でて満足させた！", atk: 0.75, def: 1.5, spd: 5, atkx: 3, defx: 4 },
	{ name: ":mokochoki:2", dname: ":mokochoki:", limit: (data) => (data.winCount ?? 0) >= 4 && (data.streak ?? 0) >= 4 && has(data.clearEnemy, ":mokochoki:"), msg: ":mokochoki:がじゃんけんでリベンジをしたいようだ。", short: ":mokochoki:とじゃんけん中（ふたたび）", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:の精神に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `もこチキはグーを出した！\n:mokochoki:はパーのプラカードを出した！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: ":mokochoki:に負けを認めさせた！", losemsg: "もこチキは負けを認めた…", endingmsg: ":mokochoki:にどちらがじゃんけんが強いか分からせた！", atk: 2, def: 2, atkx: 3, defx: 3 },
	{ name: ":mk_tatsu:2", dname: ":mk_tatsu:", limit: (data) => (data.winCount ?? 0) >= 40 && (data.streak ?? 0) >= 4 && has(data.clearEnemy, ":mk_tatsu:"), msg: ":mk_tatsu:がまた暴れている！止めないと！", short: ":mk_tatsu:を食い止め中（ふたたび）", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは全力で羽を振って衝撃波を出した！\n:mk_tatsu:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_tatsu:の炎ブレス攻撃！\nもこチキは${dmg}ポイントのダメージ！\nもこチキが次に受けるダメージが上昇した！`, abortmsg: "もこチキは全力で攻撃した為、連続攻撃出来ない！", winmsg: "もこチキは:mk_tatsu:を懲らしめた！", losemsg: "もこチキはやられてしまった…", atk: 0.1, def: 1, atkx: 1, defx: (tp) => 1.3 * tp, fire: 0.15, abort: 1 },
	{ name: ":mk_hero:", limit: (data) => ((data.winCount ?? 0) >= 24 || ((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) || new Date().getMonth() - new Date().getDate() === -1) && (data.color ?? 1) === 8 && !has(data.clearEnemy, ":mk_hero_8p:"), msg: "かつての自分自身、:mk_hero:が現れ、勝負を仕掛けてきた！", short: ":mk_hero:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの剣攻撃！\n過去の自分に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `過去の自分の剣攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "過去の自分は消えていった！\nどうやら幻だったようだ…", losemsg: "もこチキはやられてしまった…\n過去の自分はどこかへ消えていった…", endingmsg: "過去の自分に負けずに打ち勝つ事が出来た！", maxhp: (hp) => hp - 3, atk: (atk, def, spd) => def - 3.5, def: (atk, def, spd) => (atk - 3.5) * spd, atkx: (tp) => tp, defx: (tp) => tp },
	{ name: ":mk_hero_8p:", limit: (data) => ((data.winCount ?? 0) >= 24 || ((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) || new Date().getMonth() - new Date().getDate() === -1) && (data.color ?? 1) !== 8 && !has(data.clearEnemy, ":mk_hero:"), msg: "異空間から:mk_hero_8p:が現れ、勝負を仕掛けてきた！", short: ":mk_hero_8p:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの剣攻撃！\n:mk_hero_8p:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_hero_8p:の剣攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_hero_8p:に打ち勝った！", losemsg: "もこチキはやられてしまった…", endingmsg: ":mk_hero_8p:の力に飲まれずに対抗出来た！", maxhp: (hp) => hp, atk: (atk, def, spd) => def, def: (atk, def, spd) => atk * spd, atkx: (tp) => tp, defx: (tp) => tp },
	{ name: ":mk_chickenda:", limit: (data) => (data.winCount ?? 0) >= 5 && (data.streak ?? 0) >= 5 && !has(data.clearEnemy, ":mk_chickenda_gtgt:"), msg: ":mk_chickenda:が勝負を仕掛けてきた！", short: ":mk_chickenda:と戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda:の†！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_chickenda:は帰っていった！", losemsg: "もこチキはやられてしまった…", endingmsg: ":mk_chickenda:の恐ろしい攻撃力に負けずに追い返す事が出来た！", maxhp: 130, atk: 5, def: 5, maxdmg: 0.7, atkx: 5, defx: 5 },
	{ name: ":mk_chickenda_gtgt:", limit: (data, friend) => (data.winCount ?? 0) >= 15 && ((friend.love ?? 0) >= 500 || (data.lv > 255 && data.info === 3) || aggregateTokensEffects(data).appearStrongBoss) && !has(data.clearHistory, ":mk_chickenda_gtgt:") && has(data.clearHistory, ":mk_chickenda:"), msg: ":mk_chickenda_gtgt:が本気の勝負を仕掛けてきた！", short: ":mk_chickenda_gtgt:と本気の戦い中", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda_gtgt:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda_gtgt:の†！\nもこチキに${dmg}ポイントのダメージ！`, abortmsg: ":mk_chickenda_gtgt:は:muscle_mkchicken:を召還した！もこチキの連続攻撃を止めた！", winmsg: ":mk_chickenda_gtgt:は帰っていった！", losemsg: "もこチキはやられてしまった…", endingmsg: ":mk_chickenda_gtgt:の本気にも負けずに追い返す事が出来た！", atk: 15, def: 15, maxdmg: 0.6, atkx: 7, defx: 7, abort: 0.04 },
	{ name: "ending", limit: (data, friend) => (data.superUnlockCount ?? 0) >= 5 && !has(data.clearHistory, "ending"), msg: `🎉もこチキはあなたにいままでの冒険で行ってきた事を話したいようだ。`, short: "冒険のまとめ中", event: (module, msg, _data) => ending(module, msg, _data), atkmsg: () => "", defmsg: () => "" },
];

export const raidEnemys: RaidEnemy[] = [
	{ name: ":mkck_scandinavia:", msg: "巨大:mkck_scandinavia:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mkck_scandinavia:の押しつぶし攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mkck_scandinavia:を撃退した！", losemsg: "もこチキはやられてしまった…", maxhp: 100000, atk: 4, def: 2, atkx: 6, defx: 4, power: 21 },
	{ name: ":oha_chicken:", msg: "巨大:oha_chicken:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:oha_chicken:の大声挨拶攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":oha_chicken:を撃退した！", losemsg: "もこチキはやられてしまった…", maxhp: 100000, atk: 3, def: 3, atkx: 5, defx: 5, power: 38 },
	{ name: ":mk_ultrawidechicken:", msg: ":mk_ultrawidechicken:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_ultrawidechicken:の回転攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_ultrawidechicken:を撃退した！", losemsg: "もこチキはやられてしまった…", maxhp: 100000, atk: 2, def: 4, atkx: 4, defx: 6, power: 44 },
	{ name: ":muscle_mkchicken:", msg: "巨大:muscle_mkchicken:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:muscle_mkchicken:の巨大マッスルアタック！\n${dmg}ポイントのダメージ！`, winmsg: ":muscle_mkchicken:を撃退した！", losemsg: "もこチキはやられてしまった…", maxhp: 100000, atk: 7, def: 1, atkx: 7, defx: 2, power: 3.5 },
	{ name: ":mk_tatsu:", msg: "巨大:mk_tatsu:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキは羽を振って衝撃波を出した！\n:mk_tatsu:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_tatsu:の炎ブレス攻撃！\nもこチキは${dmg}ポイントのダメージ！\nもこチキが次に受けるダメージが上昇した！`, winmsg: "もこチキは:mk_tatsu:を懲らしめた！", losemsg: "もこチキはやられてしまった…", atk: 0.5, def: 2, atkx: 2, defx: 4, fire: 0.15, power: 11 },
	{ name: ":mk_chickenda:", msg: ":mk_chickenda:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの光魔法！\n:mk_chickenda:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_chickenda:の†！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: ":mk_chickenda:は帰っていった！", losemsg: "もこチキはやられてしまった…", atk: 5, def: 5, atkx: 5, defx: 5, power: 50 },
	{ name: ":nisemokochiki_mzh:", msg: "巨大:nisemokochiki_mzh:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの羽ペチ！\n:nisemokochiki_mzh:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:nisemokochiki_mzh:のうさんくさい攻撃！\nもこチキは${dmg}ポイントのダメージ！`, winmsg: "どっちが本物か分からせてやった！", losemsg: "もこチキはやられてしまった…", atk: 1, def: 2, atkx: 3, defx: 3, power: 18 },
	{ name: ":teriyaki_mk_yukkuriface:", msg: "巨大:teriyaki_mk_yukkuriface:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:teriyaki_mk_yukkuriface:のガン飛ばし攻撃！\nもこチキの精神に${dmg}ポイントのダメージ！`, winmsg: "撃退した！", losemsg: "もこチキはビビってしまった…", atk: 2, def: 5, atkx: 3, defx: 4, power: 45 },
	{ name: ":sinkansen:", msg: ":sinkansen:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:sinkansen:は加速してもこチキから逃げた！\nなんとか追いついた！\n疲れで${dmg}ポイントのダメージ！`, winmsg: "撃退した！", losemsg: ":sinkansen:はさらに加速してもこチキから逃げた！\n:sinkansen:に逃げられてしまった…", abortmsg: ":sinkansen:の移動速度が速すぎて、連続攻撃出来ない！", atk: 3, def: 1, atkx: 3, defx: 1, abort: 1, power: 4.7 },
	{ name: ":mk_crystal:", msg: ":mk_crystal:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_crystal:はめちゃくちゃ頑丈だ…\n疲れで${dmg}ポイントのダメージ！`, winmsg: "撃退した！", losemsg: "もこチキは疲れで倒れてしまった…", atk: 0.5, def: 8, atkx: 3, defx: 8, power: 40 },
	{ name: ":mk_lovechicken:", msg: ":mk_lovechicken:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_lovechicken:の愛の抱擁！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "", losemsg: "もこチキはやられてしまった…", atk: 1, def: 1, atkx: 3, defx: 3, power: 25, forcePostCount: 3 },
	{ name: ":mk_senryu_kun:", msg: ":mk_senryu_kun:討伐戦！", short: "", mark: "☆", mark2: "★", atkmsg: (dmg) => `もこチキの攻撃！\n${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:mk_senryu_kun:の川柳ビーム！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "", losemsg: "もこチキは吹き飛んでいった…", atk: 10, def: 10, atkx: (count) => Math.min(count * 1 + 0.5, 6), defx: (count) => Math.min(count + 1, 6), power: 100, fixRnd: 0.5, alwaysCrit: true },
	{ name: ":mk_hero:", msg: "自身の幻影討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの攻撃！\n自身の幻影に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `自分の幻影の剣攻撃！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "", losemsg: "もこチキはやられてしまった…", atk: (atk, def, spd) => def, def: (atk, def, spd) => atk * (spd <= 2 ? spd : spd === 3 ? 2.5 : 2.75 + (spd * 0.125)), atkx: 4.25, defx: 4.25, power: 50, maxLastDmg: 1000, },
	{ name: ":blobbacteria_campylobacter:", msg: "巨大:blobbacteria_campylobacter:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの攻撃！\n:blobbacteria_campylobacter:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `:blobbacteria_campylobacter:は小さい分身で攻撃してきた！\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "", losemsg: "もこチキはやられてしまった…", atk: 2, def: 0.045, atkx: 3, defx: 1, power: 0.175 },
	{ name: ":mk_giga:", msg: ":mk_giga:討伐戦！", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキの攻撃！\n:mk_giga:に${dmg}ポイントのダメージ！`, defmsg: (dmg) => `$[twitch.speed=0.5s $[x2 :mk_giga:]]\n\nもこチキに${dmg}ポイントのダメージ！`, winmsg: "", losemsg: "もこチキはやられてしまった…", atk: 5, def: 5, atkx: 5, defx: 5, power: 8, skillX: 3 },
	{ name: ":mokochoki:", msg: ":mokochoki:がじゃんけんをしたいようだ。", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキはじゃんけんに勝った！\n:mokochoki:に${dmg}ダメージ！`, defmsg: (dmg) => `もこチキはじゃんけんに負けた！\nもこチキに${dmg}ダメージ！`, winmsg: "じゃんけんバトルに勝利した！", losemsg: "じゃんけんバトルに敗北した……", atk: 1, def: 1, atkx: 1, defx: 1, power: 14.2, pattern: 2 },
	{ name: ":hatoguruma:", introMsg: (enemyName, time) => `<center>$[x3 ${enemyName}]\n\n鳩車コンテスト開催中！\n\n誰が最も綺麗な鳩車を作れるのか！\n\nこの投稿に「参加」と返信して、\nあなたの${config.rpgHeroName}と挑戦しましょう！\n(RPGモードのプレイが1回以上必要です)\n\n$[unixtime.countdown ${time}]</center>`, scoreMsg: "点数", scoreMsg2: "点", msg: ":hatoguruma:作成コンテストに出るようだ。", short: "", mark: "☆", mark2: "★", lToR: false, atkmsg: (dmg) => `もこチキは鳩車を作った！\n完成度: ${dmg}`, defmsg: (dmg) => ``, winmsg: "", losemsg: "", atk: 1, def: 1, atkx: 1, defx: 1, power: 0, pattern: 3 },
];

/*
export const summerEnemys: Enemy[] = [
	{ name: "ビーチ", msg: "もこチキはビーチで休憩したいようだ！", short: "ビーチで休憩中", hpmsg: "リラックス度", atkmsg: dmg => `もこチキは砂の城を作った！\nリラックス度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは日焼けしすぎて${dmg}ポイントのダメージ！`, winmsg: "もこチキはビーチで十分にリラックスした！", losemsg: "もこチキは日焼けで真っ赤になってしまった…", atk: 1, def: 1, atkx: 3, defx: 3, ltoR: true },
	{ name: "アイスクリーム", msg: "もこチキはアイスクリームを食べたいようだ！", short: "アイスを食べ中", hpmsg: "満足度", atkmsg: dmg => `もこチキはアイスを食べた！\n満足度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキはアイスをこぼしてしまった！\n冷たい！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキはアイスクリームを満喫した！", losemsg: "もこチキはアイスをこぼしすぎて凍ってしまった…", atk: 1, def: 1.5, atkx: 3, defx: 4, ltoR: true },
	{ name: "サーフィン", msg: "もこチキはサーフィンをしたいようだ！", short: "サーフィン中", hpmsg: "グルーブ", atkmsg: dmg => `もこチキは波に乗った！\nグルーブが${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは波にのまれて疲れた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキはサーフィンを楽しんだ！", losemsg: "思ったよりも波が強く疲れてしまった…", atk: 2, def: 1, atkx: 5, defx: 3, ltoR: true },
	{ name: "花火", msg: "もこチキは花火を楽しみたいようだ！", short: "花火鑑賞中", hpmsg: "感動度", atkmsg: dmg => `もこチキは花火を打ち上げた！\n感動度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは花火に火を付けるのに疲れた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキは花火を堪能した！", losemsg: "もこチキは花火に飽きてしまった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
	{ name: "スイカ1", dname: "スイカ", msg: "もこチキはスイカ割りをしたいようだ！", short: "スイカ割り中", atkmsg: dmg => `もこチキはスイカを叩いた！\nスイカに${dmg}ポイントのダメージ！`, defmsg: dmg => `もこチキは疲れで${dmg}ポイントのダメージ！`, winmsg: "スイカを割ることが出来た！", losemsg: "もこチキはスイカを割れなかった…", atk: 0.8, def: 2, atkx: 3, defx: 4, ltoR: false },
	{ name: "スイカ2", dname: "硬スイカ", limit: (data) => data.clearEnemySummer.includes("スイカ1") msg: "もこチキは硬いスイカを持ってきたようだ！", short: "硬スイカ割り中", atkmsg: dmg => `もこチキはスイカを叩いた！\nスイカに${dmg}ポイントのダメージ！`, defmsg: dmg => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "スイカを割ることが出来た！", losemsg: "もこチキはスイカを割れなかった…", atk: 0.7, def: 4, atkx: 3, defx: 5, ltoR: false },
	{ name: "スイカ3", dname: "激硬スイカ", limit: (data) => data.clearEnemySummer.includes("スイカ2") msg: "もこチキは更に硬いスイカを持ってきたようだ！\nどうやら硬すぎて困ってる人がいるらしい…", short: "激硬スイカ割り中", atkmsg: dmg => `もこチキはスイカを叩いた！\nスイカに${dmg}ポイントのダメージ！`, defmsg: dmg => `もこチキは疲れて${dmg}ポイントのダメージ！`, winmsg: "スイカを割ることが出来た！", losemsg: "もこチキはスイカを割れなかった…", atk: 0.6, def: 6, atkx: 2, defx: 7, ltoR: false },
	{ name: "キャンプ", msg: "もこチキはキャンプを楽しみたいようだ！", short: "キャンプ中", hpmsg: "楽しさ", atkmsg: dmg => `もこチキは焚火を大きくした！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは焚火の火の粉を受けた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキは満足した！", losemsg: "もこチキは焚火で火傷をしてしまった…", atk: 2.5, def: 1.5, atkx: 4, defx: 3, ltoR: true },
	{ name: "日光浴", msg: "もこチキは日光浴をしたいようだ！", short: "日光浴中", hpmsg: "満足度", atkmsg: dmg => `もこチキは日光を浴びた！\n満足度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは暑さで${dmg}ポイントのダメージ！`, winmsg: "もこチキは日光浴を楽しんだ！", losemsg: "もこチキは暑くて干からびてしまった…", atk: 1.5, def: 1, atkx: 3, defx: 3, ltoR: true },
	{ name: "プール", msg: "もこチキはプールで泳ぎたいようだ！", short: "プールで泳ぎ中", hpmsg: "距離", atkmsg: dmg => `もこチキはバシャバシャ泳いだ！\n${dmg}m泳いだ！`, defmsg: dmg => `もこチキは疲れで${dmg}ポイントのダメージ！`, winmsg: "もこチキはプールで泳ぎを楽しんだ！", losemsg: "もこチキは疲れて泳げなくなった…", atk: 2, def: 2, atkx: 4, defx: 4, ltoR: true },
	{ name: "バーベキュー", msg: "もこチキはバーベキューを楽しみたいようだ！", short: "バーベキュー中", hpmsg: "満腹度", atkmsg: dmg => `もこチキはお肉を焼いて食べた！\n満腹度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは焦げたお肉を食べてしまった！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキはバーベキューを楽しんだ！", losemsg: "もこチキは焦げたお肉でお腹を壊してしまった…", atk: 2, def: 1, atkx: 4, defx: 3, ltoR: true },
	{ name: "釣り", msg: "もこチキは釣りをしたいようだ！", short: "釣り中", hpmsg: "釣果", atkmsg: dmg => Math.random() < 0.3 ? `もこチキは大物を釣り上げた！\n釣果が${dmg}ポイントアップ！` : `もこチキはまあまあの魚を釣り上げた！\n釣果が${dmg}ポイントアップ！`, defmsg: dmg => `糸が絡まった！\nほどいた疲れで${dmg}ポイントのダメージ！`, winmsg: "大量に魚がつれた！", losemsg: "糸が絡まって釣りを続けられなくなった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
	{ name: "ハイキング", msg: "もこチキはハイキングをしたいようだ！", short: "ハイキング中", hpmsg: "体力", atkmsg: dmg => `もこチキは山を登った！\n体力が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは疲れで${dmg}ポイントのダメージ！`, winmsg: "もこチキはハイキングを楽しんだ！", losemsg: "もこチキは疲れて倒れてしまった…", atk: 1, def: 4, atkx: 3, defx: 5, ltoR: true },
	{ name: "ピクニック", msg: "もこチキはピクニックをしたいようだ！", short: "ピクニック中", hpmsg: "満足度", atkmsg: dmg => `もこチキはサンドイッチを食べた！\n満足度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキはアリに襲われた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキはピクニックを楽しんだ！", losemsg: "もこチキはアリに襲われて疲れてしまった…", atk: 0.1, def: 1, atkx: 1, defx: 3, ltoR: true },
	{ name: "遊園地", msg: "もこチキは遊園地に行くようだ！", short: "遊園地で遊び中", hpmsg: "楽しさ", atkmsg: dmg => `もこチキはアトラクションに乗った！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは乗り物に酔った！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキは遊園地を満喫した！", losemsg: "もこチキは乗り物酔いで倒れてしまった…", atk: 2, def: 1, atkx: 4, defx: 3, ltoR: true },
	{ name: "夜の散歩", msg: "もこチキは夜のさんぽをするようだ！", short: "夜のさんぽ中", hpmsg: "楽しさ", atkmsg: dmg => `もこチキは蛍を見た！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは蚊に刺されて疲れた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキは夏の夜を満喫した！", losemsg: "もこチキは蚊に刺されてやられてしまった…", atk: 0.4, def: 2, atkx: 3, defx: 3, ltoR: true },
	{ name: "シュノーケリング", msg: "もこチキはシュノーケリングをしたいようだ！", short: "シュノーケリング中", hpmsg: "探検度", atkmsg: dmg => Math.random() < 0.5 ? `もこチキは魚を見つけた！\n探検度が${dmg}ポイントアップ！` : `もこチキは洞窟を見つけた！\n探検度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキはクラゲに刺された！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキはシュノーケリングを満喫した！", losemsg: "もこチキはクラゲにやられてしまった…", atk: 0.5, def: 3, atkx: 3, defx: 4, ltoR: true },
	{ name: "夏祭り", msg: "夏祭りを見つけた！", short: "夏祭り中", hpmsg: "楽しさ", atkmsg: dmg => Math.random() < 0.5 ? `もこチキは屋台を巡った！\n楽しさが${dmg}ポイントアップ！` : `もこチキは屋台でゲームをした！\n楽しさが${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは疲れで${dmg}ポイントのダメージ！`, winmsg: "もこチキは夏祭りを満喫した！", losemsg: "もこチキは疲れて倒れてしまった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
	{ name: "星見", msg: "もこチキは星を見たいようだ！", short: "星を観察中", hpmsg: "感動度", atkmsg: dmg => `もこチキは流れ星を見つけた！\n感動度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは眠くなってきた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキは星を満喫した！", losemsg: "もこチキは眠ってしまった…", atk: 0.5, def: 4, atkx: 3, defx: 5, ltoR: true },
	{ name: "砂の城", msg: "もこチキは砂の城を作りたいようだ！", short: "砂の城作り中", hpmsg: "創造度", atkmsg: dmg => `もこチキは砂を掘った！\n創造度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは波にのまれた！\n${dmg}ポイントのダメージ！`, winmsg: "もこチキは砂の城を完成させた！", losemsg: "砂の城が波で壊れてしまった…", atk: 1.5, def: 1.5, atkx: 4, defx: 4, ltoR: true },
	{ name: "夏休みの宿題", msg: "もこチキは夏休みの宿題がまだ残っているようだ…", limit: (data) => data.clearEnemySummer.length >= summerEnemys.length - 1 short: "夏休みの宿題着手中", hpmsg: "完了度", atkmsg: dmg => `もこチキは夏休みの宿題を進めた！\n完了度が${dmg}ポイントアップ！`, defmsg: dmg => `もこチキは疲れで${dmg}ポイントのダメージ！`, winmsg: "もこチキは夏休みの宿題を完了！\nやったー！", losemsg: "もこチキは疲れてしまった…", atk: 0.05, def: 20, atkx: 3, defx: 5, ltoR: true }
];
*/

/** 旅モードの場合の敵 */
export const endressEnemy = (data): Enemy => ({
	name: "旅モード",
	msg: (data.endress ?? 0) >= 100 ? (data.endress ?? 0) !== 100 ? `旅の途中 (ステージ⭐${data.endress - 99})` : "もこチキは再び旅に出たいようだ。" : (data.endress ?? 0) ? `旅の途中 (ステージ${data.endress + 1})` : "もこチキは旅に出たいようだ。",
	short: (data.endress ?? 0) >= 100 ? (data.endress ?? 0) !== 100 ? `旅の途中 (ステージ⭐${data.endress - 99})` : "再び旅立ち中" : (data.endress ?? 0) ? `旅の途中 (ステージ${data.endress + 1})` : "旅立ち中",
	hpmsg: "進行度",
	lToR: true,
	mark: "☆",
	mark2: "★",
	atkmsg: (dmg) => `もこチキは先に進んだ。\n進行度が${dmg}ポイントアップ！`,
	defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`,
	abortmsg: "もこチキは面白いものを見つけたみたいだ。",
	winmsg: "宿が見えてきた。\n今回はここで休むようだ。\n\n次のステージへ続く…",
	losemsg: "もこチキは疲れてしまった…",
	escapemsg: "もこチキは疲れてしまったが、\n焦ることもないなと思い、\nその場で休憩を始めた。",
	atk: (data.endress ?? 0) >= 100 ? 12 + (2 * (data.endress - 100)) : 1.5 + (0.1 * (data.endress ?? 0)),
	def: (data.endress ?? 0) >= 100 ? 32 + (6 * (data.endress - 100)) : 2 + (0.3 * (data.endress ?? 0)),
	atkx: (data.endress ?? 0) >= 100 ? 8 + (1 * (data.endress - 100)) : 3 + (0.05 * (data.endress ?? 0)),
	defx: (data.endress ?? 0) >= 100 ? 18 + (3 * (data.endress - 100)) : 3 + (0.15 * (data.endress ?? 0)),
	abort: (data.endress ?? 0) >= 100 ? 0 : 0.01,
});

export const ending = (module: rpg, msg: Message, _data: any): any => {
	const data = _data;
	/** 使用中の色情報 */
	const color = colors.find((x) => x.id === (data.color ?? 1)) ?? colors.find((x) => x.default) ?? colors[0];
	/** プレイヤーの最大HP */
	let playerMaxHp = 100 + Math.min(data.lv * 3, 765) + Math.floor((data.defMedal ?? 0) * 13.4);
	/** プレイヤーの見た目 */
	let me = color.name;

	let cw = acct(msg.user) + " " + `${data.enemy.msg}`;
	let message = `$[x2 ${me}]\n\n${serifs.rpg.start}\n\n`;

	for (const name of data.clearHistory) {
		const emsg = enemys.find((x) => x.name === name)?.endingmsg;
		if (!emsg) continue;
		message += emsg + "\n\n";
		msg.friend.incLove(0.1);
	}

	message += `${msg.friend.name ?? "あなた"}が\nそばに付いてくれていたおかげで、\nこれだけ色々な事が出来ました！\nありがとうございます！\nそしてこれからもよろしくお願いします！\n\n`;

	message += [
		`${serifs.rpg.status.lv} : ${data.lv ?? 1}`,
		`最大体力 : ${playerMaxHp}`,
		`${serifs.rpg.status.atk} : ${data.atk ?? 0}`,
		`${serifs.rpg.status.def} : ${data.def ?? 0}`,
		`${serifs.rpg.status.spd} : ${Math.floor((msg.friend.love ?? 0) / 100) + 1}`,
		(data.vitality ?? 0) >= 1 ? `${serifs.rpg.status.vitality} : ${data.vitality}` : "",
		`平均能力上昇量 : ${((data.atk + data.def) / (data.lv - 1)).toFixed(2)}`,
		`これまでの勝利数 : ${data.winCount}`,
		`最高旅ステージ数 : ${(data.maxEndress ?? 0) + 1}`,
		`最大耐ダメージ数 : ${(data.superMuscle ?? 0)}`,
		`最大能力上昇値 : ${(data.maxStatusUp ?? 0)} (1 / ${Math.pow(3, (data.maxStatusUp - 7))})`,
		`最大木人ダメージ : ${(data.bestScore ?? 0)}`,
		`覚醒した回数 : ${(data.superCount ?? 0)}`,
		`解放した色の数 : ${unlockCount(data, [], false)}`,
	].filter(Boolean).join("\n");

	message += `\n\n**ここまでRPGモードを遊んでくれてありがとう！**\nもこチキの体力の詳細な数値が表示されるようになりました！`;

	msg.friend.incLove(0.1);
	data.info = 3;

	// クリアした敵のリストを追加
	if (!(data.clearEnemy ?? []).includes(data.enemy.name)) data.clearEnemy.push(data.enemy.name);
	if (!(data.clearHistory ?? []).includes(data.enemy.name)) data.clearHistory.push(data.enemy.name);
	// 次の試合に向けてのパラメータセット
	data.enemy = null;
	data.count = 1;
	data.php = 103 + (data.lv ?? 1) * 3;
	data.ehp = 103 + (data.lv ?? 1) * 3 + (data.winCount ?? 0) * 5;
	data.maxTp = 0;
	data.fireAtk = 0;

	// レベルアップ処理
	data.lv = (data.lv ?? 1) + 1;
	let atkUp = (2 + Math.floor(Math.random() * 4));
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
		const rate = (Math.pow(0.5, Math.abs(diff / 100)) * (totalrate / 2));
		if (Math.random() < (diff > 0 ? totalrate - rate : rate)) atkUp = totalUp;
		else if (Math.random() < (diff < 0 ? totalrate - rate : rate)) atkUp = 0;
	}
	data.atk = (data.atk ?? 0) + atkUp;
	data.def = (data.def ?? 0) + totalUp - atkUp;

	msg.friend.setPerModulesData(module, data);

	msg.reply(`<center>${message}</center>`, {
		cw,
		visibility: 'public'
	});

	return {
		reaction: me
	};
};

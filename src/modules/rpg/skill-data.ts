/**
 * @packageDocumentation
 *
 * RPGモジュールのスキル定義データ
 *
 * スキルの型・スキル一覧・スキル解放のLv閾値・究極のお守りを定義する。
 *
 * @remarks
 * shop.ts / shop2.ts は読み込み時（商品リストの作成時）にスキル一覧を使うため、
 * このファイルは shop・utils・index を読み込まない（型のみの読み込みは除く）。
 * これにより、どのファイルから先に読み込まれても初期化順の問題が起きない。
 * 集計などの処理は skills.ts にあり、skills.ts からこのファイルの内容も再エクスポートしている。
 *
 * @public
 */
import serifs from "@/serifs";
import config from "@/config";
import { acct } from '@/utils/acct';
import { enhanceCount } from './colors';
import type { AmuletItem } from './shop';

export type SkillEffect = {
	/** パワーがn%上昇 （グループ１） */
	atkUp?: number;
	/** パワーがn%上昇 （グループ２） */
	atkUp2?: number;
	/** パワーがn%上昇 （グループ３） */
	atkUp3?: number;
	/** パワーがn%上昇 （グループ４） */
	atkUp4?: number;
	/** パワーがn%上昇 （グループ５） */
	atkUp5?: number;
	/** パワーがn%上昇 （グループ６） */
	atkUp6?: number;
	/** パワーが4%^n上昇  */
	atkUpBonus?: number;
	/** 防御がn%上昇 （グループ１） */
	defUp?: number;
	/** 防御がn%上昇 （グループ２） */
	defUp2?: number;
	/** 防御がn%上昇 （グループ３） */
	defUp3?: number;
	/** 防御がn%上昇 （グループ４） */
	defUp4?: number;
	/** 防御がn%上昇 （グループ５） */
	defUp5?: number;
	/** 炎：戦闘時、Lvのn%をダメージに加算 */
	fire?: number;
	/** 氷：戦闘時、n%で敵のターンをスキップ */
	ice?: number;
	/** 雷：行動回数が増加するほどパワーアップ 最高n% */
	thunder?: number;
	/** 風：行動回数がn%増加 */
	spdUp?: number;
	/** 土：1ターン最大ダメージの上限がn%増加 */
	dart?: number;
	/** 光：n%で敵の攻撃力を半減 */
	light?: number;
	/** 闇：n*2%で敵の速度を1に n%で敵の現在HPを半減 */
	dark?: number;
	/** 毒：1ターンごとに敵のステータスn%低下 */
	weak?: number;
	water?: number;
	/** 非戦闘時にパワーn%上昇 */
	notBattleBonusAtk?: number;
	/** 非戦闘時に防御n%上昇 */
	notBattleBonusDef?: number;
	/** 最初のターンの被ダメージをn%軽減 */
	firstTurnResist?: number;
	/** 体力が減るほど被ダメージ軽減 最大n% */
	tenacious?: number;
	/** 1回のRPGコマンドにて動けるターン数 */
	plusActionX?: number;
	/** 与ダメージをn%上昇 （グループ１） */
	atkDmgUp?: number;
	/** 与ダメージをn%上昇 （グループ２） */
	atkDmgUp2?: number;
	/** 被ダメージをn%上昇（グループ１） */
	defDmgUp?: number;
	/** 被ダメージをn%上昇（グループ２） */
	defDmgUp2?: number;
	/** 連続ボーナスの効果をn%上昇 */
	continuousBonusUp?: number;
	/** 敗北時に逃走を行う */
	escape?: number;
	/** 気合耐えの確率n%上昇 */
	endureUp?: number;
	/** 決死の覚悟の条件をn%緩和 効果をn%上昇 */
	haisuiUp?: number;
	/** 投稿数ボーナス量をn%上昇 */
	postXUp?: number;
	/** 敵のステータスに応じてステータス上昇 */
	enemyStatusBonus?: number;
	/** 敵の防御をn%減少 */
	arpen?: number;
	/** 攻撃時最低乱数補正 */
	atkRndMin?: number;
	/** 攻撃時最大乱数補正 */
	atkRndMax?: number;
	/** 防御時最低乱数補正 */
	defRndMin?: number;
	/** 防御時最低乱数補正 */
	defRndMax?: number;
	/** 最初のターンに必ずアイテムを使用する */
	firstTurnItem?: number;
	/** 最初のターンに気合が下がるアイテムをn%で回避 */
	firstTurnMindMinusAvoid?: number;
	/** 最初のターンの道具の最低効果量をn*100以上にする */
	firstTurnItemChoice?: number;
	/** 最初のターンは二刀流が可能になる 発動率は通常のn% */
	firstTurnDoubleItem?: number;
	/** アイテム使用率がn%上昇 */
	itemEquip?: number;
	/** アイテム効果がn%上昇 デメリットがn%減少 */
	itemBoost?: number;
	/** お守りの装備数に応じて器用さが上昇 */
	amuletPower?: number;
	/** アイテムで増加した攻撃力のn%を次ターン以降に永続加算 */
	itemAtkStock?: number;
	/** 武器が選択される確率がn%上昇 */
	weaponSelect?: number;
	/** 武器のアイテム効果がn%上昇 */
	weaponBoost?: number;
	/** 防具が選択される確率がn%上昇 */
	armorSelect?: number;
	/** 防具のアイテム効果がn%上昇 */
	armorBoost?: number;
	/** 防具装備時、防御上昇量に応じて攻撃力も上昇 */
	shieldBash?: number;
	/** 食べ物が選択される確率がn%上昇 */
	foodSelect?: number;
	/** 食べ物のアイテム効果がn%上昇 */
	foodBoost?: number;
	/** 毒のデメリットがn%減少 */
	poisonResist?: number;
	/** 毒をn%で回避 */
	poisonAvoid?: number;
	/** 気合が下がるアイテムをn%で回避 */
	mindMinusAvoid?: number;
	/** 効果が高い場面で食べ物を食べる */
	lowHpFood?: number;
	/** ステータスボーナスが増加 */
	statusBonus?: number;
	/** 敵の連続攻撃中断率がn%減少 */
	abortDown?: number;
	/** クリティカル率がn%上昇 */
	critUp?: number;
	/** クリティカル率がn%上昇(固定値) */
	critUpFixed?: number;
	/** クリティカルダメージがn%上昇 */
	critDmgUp?: number;
	/** 被クリティカル率がn%減少 */
	enemyCritDown?: number;
	/** 被クリティカルダメージがn%減少 */
	enemyCritDmgDown?: number;
	/** 敗北ボーナスが増加 */
	loseBonus?: number;
	/** ７フィーバー */
	sevenFever?: number;
	/** チャージ */
	charge?: number;
	transcendence?: number;
	/** 敵を全体的に強化（通常モードのみ） */
	enemyBuff?: number;
	/** 攻撃回数を攻撃に変換 */
	allForOne?: number;
	/** お守りの効果・耐久n%上昇 */
	amuletBoost?: number;
	/** ショップの商品、全品n%オフ */
	priceOff?: number;
	/** 60%でステータスn%アップ そうでない場合ダウン */
	heavenOrHell?: number;
	/** 乱数が常に平均値で固定 */
	notRandom?: number;
	/** ランダムステータス変化 */
	fortuneEffect?: number;
	/** 全力の一撃のダメージをn%増加 */
	finalAttackUp?: number;
	berserk?: number;
	slowStart?: number;
	stockRandomEffect?: number;
	/** 数取りの達人 */
	kazutoriMaster?: number;
	noAmuletAtkUp?: number;
	haisuiAtkUp?: number;
	haisuiCritUp?: number;
	rainbow?: number;
	guardAtkUp?: number
	distributed?: number
	beginner?: number;
	pride?: number;
	greed?: number;
	envy?: number;
	wrath?: number;
	lust?: number;
	gluttony?: number;
	sloth?: number;
	noCrit?: number;
};

export type Skill = {
	/** スキル名 */
	name: string;
	/** 短縮名 */
	short: string;
	/** 説明 */
	desc?: string;
	/** 詳細説明 */
	info?: string;
	/** 効果 */
	effect: SkillEffect;
	/** ユニークキー 同じキーを持っているスキルは入手不可 */
	unique?: string;
	amuletUnique?: string;
	/** 移動先 スキル名を変更した際に */
	moveTo?: string;
	/** スキル変更が出来ない場合 */
	cantReroll?: boolean;
	/** 自然習得しないスキルの場合 */
	notLearn?: boolean;
	/** お守りとして出ない場合 */
	skillOnly?: boolean;
	/** ショップに並ばない場合 */
	notShop?: boolean;
	/** 希少度係数（未設定時は1） */
	rare?: number;
	/** レイドでのみ効果があるスキルの場合（お守りにした際、通常戦闘では耐久が減らない） */
	raidOnly?: boolean;
};

export const isKazutoriMasterDisabled = (data): boolean => {
	const banUsers = config.kazutoriBanUsers ?? [];
	if (!banUsers.length) return false;

	const username = data?.username;
	const host = data?.host ?? null;
	const identifiers = [
		data?.userId,
		username,
		username && host ? `${username}@${host}` : undefined,
		username ? acct({ username, host }) : undefined,
	]
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.toLowerCase());

	return banUsers.some((banUser) => typeof banUser === 'string' && identifiers.includes(banUser.toLowerCase()));
};

export const skills: Skill[] = [
	{ name: `${serifs.rpg.status.atk}+10%`, short: `Ｐ`, desc: `常に${serifs.rpg.status.atk}が10%上がります（廃止）`, info: `条件無しで${serifs.rpg.status.atk}+10%（廃止）`, effect: {}, moveTo: `${serifs.rpg.status.atk}アップ` },
	{ name: `${serifs.rpg.status.def}+10%`, short: `Ｄ`, desc: `常に${serifs.rpg.status.def}が10%上がります（廃止）`, info: `条件無しで${serifs.rpg.status.def}+10%（廃止）`, effect: {}, moveTo: `${serifs.rpg.status.def}アップ` },
	{ name: `${serifs.rpg.status.atk}アップ`, short: `Ｐ`, desc: `常に${serifs.rpg.status.atk}が上がります`, info: `${serifs.rpg.status.atk}+11%`, effect: { atkUp: 0.11 } },
	{ name: `${serifs.rpg.status.def}アップ`, short: `Ｄ`, desc: `常に${serifs.rpg.status.def}が上がります`, info: `${serifs.rpg.status.atk}+4% ${serifs.rpg.status.def}+13%`, effect: { atkUpBonus: 1, defUp: 0.13 } },
	{ name: `炎属性剣攻撃`, short: "炎", desc: `戦闘時、最低ダメージが上昇します`, info: `戦闘時、Lvの9%がダメージに固定加算\n非戦闘時、${serifs.rpg.status.atk}+Lvの35%\n火曜日に全ての効果量が66%アップ`, effect: { fire: 0.09 } },
	{ name: `氷属性剣攻撃`, short: "氷", desc: `戦闘時、たまに敵を凍らせます`, info: `戦闘時、9%で相手のターンをスキップ\n非戦闘時、${serifs.rpg.status.def}+9%\n水曜日にここまでに記載された効果の効果量が66%アップ\n${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, ice: 0.09 } },
	{ name: `雷属性剣攻撃`, short: "雷", desc: `戦闘時、連続攻撃をすればダメージが上がります`, info: `(現在攻撃数/最大攻撃数)×18%のダメージ上昇を得る\nレイドでは、ダメージ+9% 行動回数が強化されているほど効果アップ\n日曜日に全ての効果量が66%アップ`, effect: { thunder: 0.18 } },
	{ name: `風属性剣攻撃`, short: "風", desc: `戦闘時、たまに行動回数が上がります`, info: `戦闘時、9%で行動回数が2倍\n非戦闘時、${serifs.rpg.status.atk}+9%\n木曜日に全ての効果量が66%アップ`, effect: { spdUp: 0.09 } },
	{ name: `土属性剣攻撃`, short: "土", desc: `戦闘時、最大ダメージが上昇します`, info: `戦闘時かつ最大ダメージ制限がある場合、その制限を18%増加\n非戦闘時、${serifs.rpg.status.atk}+9%\n土曜日に全ての効果量が66%アップ`, effect: { dart: 0.18 } },
	{ name: `光属性剣攻撃`, short: "光", desc: `戦闘時、たまに敵の攻撃力を下げます`, info: `戦闘時、18%でダメージカット50%\nそれ以外の場合、${serifs.rpg.status.def}+9%\n金曜日にここまでに記載された効果の効果量が66%アップ\n${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, light: 0.18 } },
	{ name: `闇属性剣攻撃`, short: "闇", desc: `戦闘時、たまに敵の周辺に高重力領域を発生させます`, info: `戦闘時、9%で敵の現在HPの半分のダメージ（レイドでは150ダメージ）を与える\n行動回数が2回以上の敵に18%で行動回数を1にする\nそれ以外の場合、${serifs.rpg.status.def}+6.3%\n月曜日にここまでに記載された効果の効果量が66%アップ ${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, dark: 0.09 } },
	{ name: `水属性剣攻撃`, short: "水", desc: `炎属性の敵に対して、非常に有効です さらに、氷属性と雷属性の力を高めます`, info: `炎属性の敵に対し与ダメージ+18%かつ火炎ダメージのダメージカット+54%\n水曜日にここまでに記載された効果の効果量が66%アップ\n氷属性剣攻撃と雷属性剣攻撃の効果が+25%`, effect: { water: 0.18 } },
	{ name: `炎属性剣攻撃＋`, short: "**炎**", desc: `戦闘時、最低ダメージが大きく上昇します`, info: `戦闘時、Lvの15%がダメージに固定加算\n非戦闘時、${serifs.rpg.status.atk}+Lvの58%\n火曜日に全ての効果量が66%アップ`, effect: { fire: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `氷属性剣攻撃＋`, short: "**氷**", desc: `戦闘時、たまに敵を凍らせます`, info: `戦闘時、15%で相手のターンをスキップ\n非戦闘時、${serifs.rpg.status.def}+15%\n水曜日ここまでに記載された効果の効果量が66%アップ\n${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, ice: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `雷属性剣攻撃＋`, short: "**雷**", desc: `戦闘時、連続攻撃をすればダメージが上がります`, info: `(現在攻撃数/最大攻撃数)×30%のダメージ上昇を得る\nレイドでは、ダメージ+15% 行動回数が強化されているほど効果アップ\n日曜日に全ての効果量が66%アップ`, effect: { thunder: 0.3 }, notLearn: true, skillOnly: true },
	{ name: `風属性剣攻撃＋`, short: "**風**", desc: `戦闘時、たまに行動回数が上がります`, info: `戦闘時、15%で行動回数が2倍\n非戦闘時、${serifs.rpg.status.atk}+15%\n木曜日に全ての効果量が66%アップ`, effect: { spdUp: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `土属性剣攻撃＋`, short: "**土**", desc: `戦闘時、最大ダメージが上昇します`, info: `戦闘時かつ最大ダメージ制限がある場合、その制限を30%増加\n非戦闘時、${serifs.rpg.status.atk}+15%\n土曜日に全ての効果量が66%アップ`, effect: { dart: 0.3 }, notLearn: true, skillOnly: true },
	{ name: `光属性剣攻撃＋`, short: "**光**", desc: `戦闘時、たまに敵の攻撃力を下げます`, info: `戦闘時、30%でダメージカット50%\nそれ以外の場合、${serifs.rpg.status.def}+15%\n金曜日にここまでに記載された効果の効果量が66%アップ\n${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, light: 0.3 }, notLearn: true, skillOnly: true },
	{ name: `闇属性剣攻撃＋`, short: "**闇**", desc: `戦闘時、たまに敵の周辺に高重力領域を発生させます`, info: `戦闘時、15%で敵の現在HPの半分のダメージ（レイドでは150ダメージ）を与える\n行動回数が2回以上の敵に30%で行動回数を1にする\nそれ以外の場合、${serifs.rpg.status.def}+10.5%\n月曜日に全ての効果量が66%アップ`, effect: { atkUpBonus: 1, dark: 0.15 }, notLearn: true, skillOnly: true },
	{ name: `毒属性剣攻撃`, short: "毒", desc: `戦闘時、ターン経過ごとに相手が弱体化します`, info: `ターン経過ごとに敵のステータス-5%\nレイドでは特殊な倍率でステータス減少を付与`, effect: { weak: 0.05 } },
	{ name: `テキパキこなす`, short: "効", desc: `戦闘以外の事の効率が上がります`, info: `非戦闘時、${serifs.rpg.status.atk}+22%`, effect: { notBattleBonusAtk: 0.22 } },
	{ name: `疲れにくい`, short: "疲", desc: `疲れでダメージを受ける際にそのダメージを軽減します`, info: `ダメージメッセージに疲が入っている場合、${serifs.rpg.status.def}+27% ${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, notBattleBonusDef: 0.27 } },
	{ name: `数取りの達人`, short: "数", desc: `数取りに参加したり勝利したりするとステータスが上がります`, info: `直近24時間以内に数取りに参加: ステータス+5%\n直近24時間以内に勝利: ${serifs.rpg.status.atk}+7% ${serifs.rpg.status.def}+3%\n直近48時間以内に勝利: ${serifs.rpg.status.atk}+4% ${serifs.rpg.status.def}+2%\n直近72時間以内に勝利: ${serifs.rpg.status.atk}+2% ${serifs.rpg.status.def}+1%`, effect: { kazutoriMaster: 1 } },
	{ name: `油断しない`, short: "断", desc: `ターン1に受けるダメージを大きく軽減します`, info: `ターン1にてダメージカット40%を得る\n100%以上になる場合、残りはターン2に持ち越す\n${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, firstTurnResist: 0.4 }, skillOnly: true },
	{ name: `粘り強い`, short: "粘", desc: `体力が減るほど受けるダメージを軽減します`, info: `ダメージカット25%×(減少HP割合)を得る 最大90% ${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, tenacious: 0.25 } },
	{ name: `高速RPG`, short: "速", desc: `1回のRPGでお互いに2回行動します`, info: `1回のコマンドで2ターン進行する ${serifs.rpg.status.atk}+1% レイド時は、さらに${serifs.rpg.status.atk}+10%`, effect: { atkUpBonus: 0.25, plusActionX: 1 } },
	{ name: `1時間先取りRPG`, short: "先", desc: `1時間早くRPGをプレイする事が出来ます（廃止）`, info: `1時間早くRPGプレイ可能 ステータス+5%（廃止）`, effect: {}, moveTo: "高速RPG" },
	{ name: `伝説`, short: "★", desc: `パワー・防御が8%上がります`, info: `ステータス+8% 重複しない`, effect: { atkUp2: 0.08, defUp2: 0.08 }, unique: "legend" },
	{ name: `脳筋`, short: "筋", desc: `与えるダメージが上がりますが、受けるダメージも上がります`, info: `${serifs.rpg.dmg.give}+20% ${serifs.rpg.dmg.take}+10%`, effect: { atkDmgUp: 0.2, defDmgUp: 0.1 } },
	{ name: `慎重`, short: "慎", desc: `与えるダメージが下がりますが、受けるダメージも下がります`, info: `${serifs.rpg.dmg.give}-4% ${serifs.rpg.dmg.take}-20%`, effect: { atkDmgUp: -0.04, defDmgUp: -0.2 } },
	{ name: `連続・毎日ボーナス強化`, short: "連", desc: `連続・毎日ボーナスの上昇量が上がります`, info: `ステータス+5% 毎日ボーナスの増加量+100% (10 ~ 25投稿↑)`, effect: { atkUp2: 0.05, defUp2: 0.05, continuousBonusUp: 1 } },
	{ name: `負けそうなら逃げる`, short: "逃", desc: `逃げると負けた事になりません 連続で発動しにくい`, info: `スキルの数まで100%逃走 以降失敗まで発動度に確率半減し続ける\nレイド時は、1ターン距離を取って回復する\nさらに、${serifs.rpg.status.atk}+4%`, effect: { atkUpBonus: 1, escape: 1 } },
	{ name: `気合で頑張る`, short: "気", desc: `パワー・防御が少し上がり、気合耐えの確率が上がります`, info: `ステータス+6% 気合耐え確率+50%`, effect: { atkUp3: 0.06, defUp3: 0.06, endureUp: 0.5 } },
	{ name: `すぐ決死の覚悟をする`, short: "決", desc: `決死の覚悟の発動条件が緩くなり、効果量が上がります さらに決死の覚悟発動時、追加で与ダメージとクリティカル率が上がります`, info: `与ダメージ+8% 覚悟発動条件効果量+50%\n覚悟発動時与ダメージ+5% クリティカル率1.2倍`, effect: { atkDmgUp2: 0.08, haisuiUp: 0.5, haisuiAtkUp: 0.05, haisuiCritUp: 0.2 } },
	{ name: `投稿数ボーナス量アップ`, short: "投", desc: `投稿数が高ければ高いほどステータスが上昇します`, info: `20投稿につき、ステータス+1% (最大10%)`, effect: { postXUp: 0.01 } },
	{ name: `強敵と戦うのが好き`, short: "強", desc: `敵が強ければステータスが上昇します`, info: `ステータス+(敵の攻撃 × 敵の防御 / 4)% (+10%以上は上昇率鈍化)`, effect: { enemyStatusBonus: 1 } },
	{ name: `${serifs.rpg.status.pen}+10%`, short: "貫", desc: `敵の防御の影響を減少させます`, info: `敵の防御が高いほどダメージが上昇します`, effect: { arpen: 0.12 } },
	{ name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}4`, short: "４", desc: `乱数幅が20~180 -> 60~160 (%) になります（廃止）`, info: `乱数幅 20~180 -> 60~160 (%) 期待値 110% 乱数系と重複しない（廃止）`, effect: {}, unique: "rnd", moveTo: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5` },
	{ name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5`, short: "５", desc: `クリティカルが発生しなくなりますが、高いダメージがとても出やすくなります`, info: `乱数幅 20~180 -> 90~135 (%) 期待値 112% クリティカルの期待値分、ダメージ上昇 乱数系と重複しない`, effect: { atkRndMin: 0.7, atkRndMax: -1.15, noCrit: 1 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndP}`, short: "乱", desc: `乱数幅が20~180 -> 5~225になります クリティカル率も上がります`, info: `乱数幅 20~180 -> 5~225 (%) 期待値 115% クリティカル率+2% 乱数系と重複しない`, effect: { atkRndMin: -0.15, atkRndMax: 0.6, critUpFixed: 0.02 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndM}`, short: "安", desc: `敵から受ける最大ダメージを減少させます`, info: `敵の乱数幅 20~180 -> 20~160 (%) ${serifs.rpg.status.atk}+4% 乱数系と重複しない`, effect: { atkUpBonus: 1, defRndMin: 0, defRndMax: -0.2 }, unique: "rnd" },
	{ name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndP}`, short: "不", desc: `敵から受ける最小ダメージを減少させます`, info: `敵の乱数幅 20~180 -> 0~180 (%) ${serifs.rpg.status.atk}+4% 乱数系と重複しない`, effect: { atkUpBonus: 1, defRndMin: -0.2, defRndMax: 0 }, unique: "rnd" },
	{ name: `準備を怠らない`, short: "備", desc: `ターン1にて、必ず良い効果がある武器か防具を装備します`, info: `ターン1装備率+100% ターン1悪アイテム率-100% レイド限定で、ターン1道具最低効果量上昇 重複しない`, effect: { firstTurnItem: 1, firstTurnMindMinusAvoid: 1, firstTurnItemChoice: 0.5, firstTurnDoubleItem: 1 }, unique: "firstTurnItem" },
	{ name: `道具大好き`, short: "道", desc: `道具の使用率が上がります`, info: `アイテム装備率+50%`, effect: { itemEquip: 0.5 } },
	{ name: `道具大好き＋`, short: "**道**", desc: `道具の使用率が大きく上がります`, info: `アイテム装備率+90%`, effect: { itemEquip: 0.9 }, notLearn: true, skillOnly: true },
	{ name: `道具の扱いが上手い`, short: "扱", desc: `道具の効果量が上がります`, info: `アイテム効果量+40% アイテム悪効果軽減+40%`, effect: { itemBoost: 0.4 } },
	{ name: `継戦融合武装`, short: "継", desc: `武器を装備した時に前の武器を捨てずに次の武器に融合して使用します`, info: `ターン2以降の開始時、前のターンに装備したアイテムのパワー上昇の55%分をその戦闘中は永続的に獲得します`, effect: { itemAtkStock: 0.55 }, unique: "itemAtkStock", rare: 2 },
	{ name: `シールドバッシュ`, short: "シ", desc: `防具を装備した際にパワーも上がるようになります`, info: `防具を装備した際に、その防具による防御増加量の50%分パワーも一緒に増加する さらに防具効果量+50%`, effect: { armorBoost: 0.5, shieldBash: 1 } },
	{ name: `武器が大好き`, short: "武", desc: `武器のみを装備するようになり、武器の効果量が上がります`, info: `防具・食べ物を使用しない 武器効果量+70% 種類大好き系と重複しない`, effect: { weaponSelect: 2, weaponBoost: 0.7 }, unique: "itemSelect" },
	{ name: `防具が大好き`, short: "防", desc: `防具のみを装備するようになり、防具の効果量が上がります`, info: `武器・食べ物を使用しない 防具効果量+70% ${serifs.rpg.status.atk}+4% 種類大好き系と重複しない`, effect: { atkUpBonus: 1, armorSelect: 2, armorBoost: 0.7 }, unique: "itemSelect" },
	{ name: `食いしんぼう`, short: "食", desc: `食べ物のみを装備するようになり、食べ物の効果量が上がります`, info: `武器・防具を使用しない 食べ物効果量+70% 毒食べ物ダメージ-60% ${serifs.rpg.status.atk}+4% 種類大好き系と重複しない`, effect: { atkUpBonus: 1, foodSelect: 2, foodBoost: 0.7, poisonResist: 0.6 }, unique: "itemSelect" },
	{ name: `なんでも口に入れない`, short: "捨", desc: `良くないものを食べなくなることがあります（廃止）`, info: `毒食べ物を50%で捨てる 100%以上になると悪アイテム率減少に変換（廃止）`, effect: {}, moveTo: "道具の選択が上手い" },
	{ name: `道具の選択が上手い`, short: "選", desc: `道具の効果量がすこし上がり、悪いアイテムを選びにくくなり、良くないものを食べなくなる事があります`, info: `道具効果量+15% 悪アイテム率-15% 毒食べ物を40%で捨てる 100%以上になると悪アイテム率減少に変換`, effect: { itemBoost: 0.15, mindMinusAvoid: 0.15, poisonAvoid: 0.4 } },
	{ name: `お腹が空いてから食べる`, short: "空", desc: `体力が減ったら食べ物を食べやすくなり、食べ物の効果量が少し上がります`, info: `体力が減少すれば食べ物を食べるようになり、毒食べ物の確率が下がる 食べ物効果量+20% 毒食べ物ダメージ-20% ${serifs.rpg.status.atk}+4% `, effect: { atkUpBonus: 1, lowHpFood: 1, foodBoost: 0.2, poisonResist: 0.2 }, unique: "lowHpFood" },
	{ name: `たまにたくさん成長`, short: "成", desc: `たまにステータスが多く増加します ★変更不可（廃止）`, info: `Lvアップ毎になにかのステータス+1 ★変更不可（変更してもステータスは残るため）（廃止）`, effect: {}, unique: "status", cantReroll: true, moveTo: `テキパキこなす` },
	{ name: `連続攻撃完遂率上昇`, short: "遂", desc: `連続攻撃を相手に止められにくくなります`, info: `連続攻撃中断率-32% 効果がない場合、${serifs.rpg.status.atk}+10%`, effect: { abortDown: 0.32 } },
	{ name: `クリティカル性能上昇`, short: "急", desc: `クリティカル率とクリティカルダメージが上昇します`, info: `クリティカル率1.2倍&+3% クリティカルダメージ+20%`, effect: { critUp: 0.2, critUpFixed: 0.03, critDmgUp: 0.2 } },
	{ name: `敵のクリティカル性能減少`, short: "守", desc: `相手のクリティカル率とクリティカルダメージが減少します`, info: `敵のクリティカル率-40% 敵のクリティカルダメージ-40% ${serifs.rpg.status.atk}+4% レイド時は、追加で${serifs.rpg.status.def}+10%`, effect: { atkUpBonus: 1, enemyCritDown: 0.4, enemyCritDmgDown: 0.4 } },
	{ name: `負けた時、しっかり反省`, short: "省", desc: `敗北時のボーナスが上昇します ★変更不可（廃止）`, info: `敗北毎にステータス+2 ★変更不可（変更してもステータスは残るため）（廃止）`, effect: {}, unique: "loseBonus", cantReroll: true, moveTo: `負けそうなら逃げる` },
	{ name: `７フィーバー！`, short: "７", desc: `Lv・パワー・防御の値に「7」が含まれている程ステータスアップ`, info: `Lv・パワー・防御の値に「7」が含まれている場合ステータス+7%\n「77」が含まれている場合ステータス+77% 「777」が含まれている場合...`, effect: { sevenFever: 1 } },
	{ name: `不運チャージ`, short: "Ｃ", desc: `不運だった場合、次回幸運になりやすくなります`, info: `ステータス+7% 低乱数を引いた時、次回以降に高乱数を引きやすくなる`, effect: { atkUp4: 0.07, defUp4: 0.07, charge: 1 } },
	{ name: `お守り整備`, short: "整", desc: `お守りの効果が上がり、お守りが壊れにくくなります`, info: `お守り効果+50% お守り耐久+50%`, effect: { amuletBoost: 0.5 }, skillOnly: true },
	{ name: `値切り術`, short: "値", desc: `ショップのアイテムが少し安くなります`, info: `ショップアイテム全品10%OFF`, effect: { priceOff: 0.1 }, skillOnly: true },
	{ name: `天国か地獄か`, short: "天", desc: `戦闘開始時に強くなるか弱くなるかどちらかが起こります`, info: `60%で${serifs.rpg.status.atk}+20%・${serifs.rpg.status.def}+30% 40%で${serifs.rpg.status.atk}-20%・${serifs.rpg.status.def}-15%`, effect: { heavenOrHell: 0.2 } },
	{ name: `気性が荒い`, short: "荒", desc: `戦闘が得意になりますが、戦闘以外の効率が大きく下がります`, info: `${serifs.rpg.status.atk}+25% 非戦闘時、${serifs.rpg.status.atk}-40%`, effect: { atkUp5: 0.25, notBattleBonusAtk: -0.4 }, unique: "mind" },
	{ name: `気性穏やか`, short: "穏", desc: `戦闘以外の効率がとても上がりますが、戦闘が苦手になります`, info: `${serifs.rpg.status.atk}-25% 非戦闘時、${serifs.rpg.status.atk}+70%`, effect: { atkUp5: -0.25, notBattleBonusAtk: 0.7 }, unique: "mind" },
	{ name: `かるわざ`, short: "軽", desc: `ステータスが上がり、お守りを持っていない時、追加で${serifs.rpg.status.atk}がさらに上がります`, info: `ステータス+6% お守りを持っていない時、追加で${serifs.rpg.status.atk}+6%`, effect: { atkUp6: 0.06, defUp5: 0.06, noAmuletAtkUp: 0.06 }, skillOnly: true },
	{ name: `攻めの守勢`, short: "勢", desc: `通常よりもダメージを防げば防ぐ程、パワーが上がります（ただし７フィーバー！を除きます）`, info: `ダメージ軽減の累計が300/600/900/1200に達すると、防御の12.5%/30%/60%/100%分のパワーを得ます（７フィーバー！を除く）\nさらにレイド時は、戦闘終了時に減った体力の同じ割合分を回復し、その分全力の一撃のダメージが上がります\n${serifs.rpg.status.atk}+4% このスキルは重複しません`, effect: { atkUpBonus: 1, guardAtkUp: 0.125 }, unique: "counter" },
	{ name: `分散型`, short: "散", desc: `同じスキルを持っていない程、ステータスが上がります（お守りは対象外）`, info: `パワー・防御+10% クリティカル率+10% ダメージ軽減+10% 同じスキルを持つ度に全ての効果-4%（お守りは対象外）`, effect: { distributed: 0.1 }, unique: "distributed" },
	{ name: `傲慢の力`, short: "**傲**", desc: `レイド時、敵が弱いほど与ダメージが大きく上昇します`, info: "レイド時、最大体力の10%以下のダメージを受ける度に、その戦いの間常に与ダメージ+15%\nただし、最大体力の30%以上のダメージを受けた場合、そのダメージは2倍になる", effect: { pride: 0.15 }, notLearn: true, raidOnly: true, amuletUnique: "sin"},
	{ name: `強欲の力`, short: "**欲**", desc: `レイド時、前に装備した武器・防具を次にその能力を上回るものが手に入るまで装備するようになりますが、使いまわした装備は徐々に力を失います……`, info: "", effect: { greed: 0.5 }, notLearn: true, raidOnly: true, amuletUnique: "sin"},
	{ name: `憤怒の力`, short: "**憤**", desc: `レイド時、体力が半減した状態でスタートしますが、クリティカルダメージが大きく上昇します`, info: "レイド時、体力半減でスタート クリティカルダメージ+40%", effect: { wrath: 0.4 }, notLearn: true, raidOnly: true, amuletUnique: "sin"},
	{ name: `暴食の力`, short: "**暴**", desc: `レイド時、何かを食べる度に与ダメージが上がります さらに食べる程効果が上がります 食べてはいけない物を食べた場合にさらに効果が上がります`, info: "レイド時、何かを食べる度、その戦いの間常に与ダメージ+10% 毒を食べた場合与ダメージ+20%", effect: { gluttony: 0.2 }, notLearn: true, raidOnly: true, amuletUnique: "sin"},
	{ name: `怠惰の力`, short: "**怠**", desc: `レイド時、時々怠けて行動をしなくなりますが、怠けた後は強くなります`, info: "レイド時、30%で怠ける 怠ける度に、その戦いの間常に与ダメージ+50%", effect: { sloth: 0.5 }, notLearn: true, raidOnly: true, amuletUnique: "sin"},
	{ name: `嫉妬の力`, short: "**嫉**", desc: `レイドで与えたダメージが低い間、ダメージを大きくカットします`, info: "レイドでのダメージ評価が低い間、被ダメージを最大70%カットします\n評価が高くなった場合、被ダメージが★1につき+10%", effect: { envy: 1 }, notLearn: true, raidOnly: true, amuletUnique: "sin"},
	{ name: `バーサク`, short: "バ", desc: `レイド時、毎ターンダメージを受けますが、パワーがアップします`, info: "レイド時、毎ターンHP15%減少 パワー+24%", effect: { berserk: 0.15 }, notLearn: true, raidOnly: true, notShop: true},
	{ name: `超全力の一撃`, short: "撃", desc: `レイド時、ターン7で発生する全力の一撃を強化します`, info: "レイド時、全力の一撃のダメージ1.3倍", effect: { finalAttackUp: 0.3 }, notLearn: true, raidOnly: true, notShop: true},
	{ name: `スロースタート`, short: "ス", desc: `レイド時、最初は弱くなりますが、ターンが進む度にどんどん強くなります`, info: "レイド時、最初は弱くなりますが、ターンが進む度にどんどん強くなります", effect: { slowStart: 1 }, notLearn: true, raidOnly: true, notShop: true},
];

/**
 * スキル解放のLv閾値
 *
 * [20, 50, 100, 170, 255] で、Lv20で1つ目、Lv50で2つ目…とスキルスロットが解放される。
 *
 * @internal
 */
export const skillBorders = [20, 50, 100, 170, 255];

const ultimateEffect: SkillEffect = {
	"atkUp": 0.010,
	"atkUp2": 0.0063,
	"atkUp3": 0.0036,
	"atkUp4": 0.0045,
	"atkUp6": 0.0045,
	"atkUpBonus": 1.2,
	"defUp": 0.010,
	"defUp2": 0.0063,
	"defUp3": 0.0036,
	"defUp4": 0.0045,
	"defUp5": 0.0045,
	"fire": 0.008,
	"ice": 0.008,
	"thunder": 0.016,
	"spdUp": 0.008,
	"dart": 0.016,
	"light": 0.016,
	"dark": 0.008,
	"weak": 0.0054,
	"notBattleBonusAtk": 0.02,
	"notBattleBonusDef": 0.02,
	"firstTurnResist": 0.027,
	"tenacious": 0.023,
	"plusActionX": 1,
	"atkDmgUp": 0.015,
	"defDmgUp": -0.009,
	"atkDmgUp2": 0.007,
	"continuousBonusUp": 0.045,
	"escape": 1,
	"endureUp": 0.045,
	"haisuiUp": 0.045,
	"postXUp": 0.0045,
	"enemyStatusBonus": 0.09,
	"arpen": 0.009,
	"defRndMin": -0.02,
	"defRndMax": -0.02,
	"firstTurnItem": 1,
	"firstTurnMindMinusAvoid": 1,
	"itemEquip": 0.045,
	"itemBoost": 0.05,
	"weaponBoost": 0.054,
	"armorBoost": 0.054,
	"foodBoost": 0.072,
	"poisonResist": 0.072,
	"mindMinusAvoid": 0.014,
	"poisonAvoid": 0.036,
	"abortDown": 0.027,
	"critUp": 0.018,
	"critUpFixed": 0.0027,
	"critDmgUp": 0.018,
	"enemyCritDown": 0.036,
	"enemyCritDmgDown": 0.036,
	"sevenFever": 0.1,
	"charge": 0.1,
	"heavenOrHell": 0.018,
	"haisuiAtkUp": 0.0036,
	"haisuiCritUp": 0.018,
}

export const ultimateAmulet = { name: `究極のお守り`, limit: (data) => enhanceCount(data) >= 9, price: 18, desc: `${config.rpgHeroName}RPGを極めたあなたに……`, type: "amulet", effect: ultimateEffect, durability: 6, short: "究極", isUsed: (data) => true, always: true } as AmuletItem;

import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';

export type SkillEffect = {
	/** パワーがn%上昇 */
	atkUp?: number;
	/** 防御がn%上昇 */
	defUp?: number;
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
	/** -n時間分RPGを先取り */
	rpgTime?: number;
	/** 与ダメージをn%上昇 */
	atkDmgUp?: number;
	/** 被ダメージをn%上昇 */
	defDmgUp?: number;
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
	/** アイテム使用率がn%上昇 */
	itemEquip?: number;
	/** アイテム効果がn%上昇 デメリットがn%減少 */
	itemBoost?: number;
	/** 武器が選択される確率がn%上昇 */
	weaponSelect?: number;
	/** 武器のアイテム効果がn%上昇 */
	weaponBoost?: number;
	/** 防具が選択される確率がn%上昇 */
	armorSelect?: number;
	/** 防具のアイテム効果がn%上昇 */
	armorBoost?: number;
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
};

export type Skill = {
	/** スキル名 */
	name: string;
	/** 説明 */
	desc?: string;
	/** 効果 */
	effect: SkillEffect;
	/** ユニークキー 同じキーを持っているスキルは入手不可 */
	unique?: string;
	/** 移動先 スキル名を変更した時に */
	moveTo?: string;
	/** スキル変更が出来ない場合 */
	cantReroll?: boolean;
};

export const skills: Skill[] = [
	{ name: `${serifs.rpg.status.atk}+10%`, desc: `常に${serifs.rpg.status.atk}が10%上がるのじゃ`, effect: { atkUp: 0.1 } },
	{ name: `${serifs.rpg.status.def}+10%`, desc: `常に${serifs.rpg.status.def}が10%上がるのじゃ`, effect: { defUp: 0.1 } },
	{ name: `炎属性妖術`, desc: `戦闘時、最低ダメージが上昇するのじゃ`, effect: { fire: 0.1 } },
	{ name: `氷属性妖術`, desc: `戦闘時、たまに敵を凍らせるのじゃ`, effect: { ice: 0.1 } },
	{ name: `雷属性妖術`, desc: `戦闘時、連続攻撃をすればダメージが上がるのじゃ`, effect: { thunder: 0.2 } },
	{ name: `風属性妖術`, desc: `戦闘時、たまに行動回数が上がるのじゃ`, effect: { spdUp: 0.1 } },
	{ name: `土属性妖術`, desc: `戦闘時、最大ダメージが上昇するのじゃ`, effect: { dart: 0.2 } },
	{ name: `光属性妖術`, desc: `戦闘時、たまに相手の攻撃力を下げるのじゃ`, effect: { light: 0.2 } },
	{ name: `闇属性妖術`, desc: `戦闘時、たまにいろんな効果が発生するのじゃ`, effect: { dark: 0.1 } },
	{ name: `毒属性妖術`, desc: `戦闘時、ターン経過ごとに相手が弱体化するのじゃ`, effect: { weak: 0.05 } },
	{ name: `テキパキこなす`, desc: `戦闘以外の事の効率が上がるのじゃ`, effect: { notBattleBonusAtk: 0.2 } },
	{ name: `疲れにくい`, desc: `疲れでダメージを受ける時にそのダメージを軽減するのじゃ`, effect: { notBattleBonusDef: 0.2 } },
	{ name: `油断しない`, desc: `ターン1に受けるダメージを大きく軽減するのじゃ`, effect: { firstTurnResist: 0.3 } },
	{ name: `粘り強い`, desc: `体力が減るほど受けるダメージを軽減するのじゃ`, effect: { tenacious: 0.2 } },
	{ name: `高速RPG`, desc: `1回のRPGでお互いに2回行動するのじゃ`, effect: { plusActionX: 1 } },
	{
		name: `1時間先取りRPG`,
		desc: `1時間早くRPGをプレイする事が出来るのじゃ`,
		effect: { atkUp: 0.05, defUp: 0.05, rpgTime: -1 },
	},
	{ name: `伝説`, desc: `パワー・防御が7%上がるのじゃ`, effect: { atkUp: 0.07, defUp: 0.07 }, unique: 'legend' },
	{ name: `脳筋`, desc: `与えるダメージが上がるが、受けるダメージも上がるのじゃ`, effect: { atkDmgUp: 0.21, defDmgUp: 0.1 } },
	{ name: `慎重`, desc: `与えるダメージが下がるが、受けるダメージも下がるのじゃ`, effect: { atkDmgUp: -0.1, defDmgUp: -0.21 } },
	{ name: `連続・毎日ボーナス強化`, desc: `連続・毎日ボーナスの上昇量が上がるのじゃ`, effect: { continuousBonusUp: 0.5 } },
	{ name: `負けそうなら逃げる`, desc: `逃げると負けた事にならんのじゃ 連続で発動しにくいのじゃ`, effect: { escape: 1 } },
	{
		name: `気合で頑張る`,
		desc: `パワー・防御が少し上がって、気合耐えの確率が上がるのじゃ`,
		effect: { atkUp: 0.03, defUp: 0.03, endureUp: 0.5 },
	},
	{ name: `すぐ決死の覚悟をする`, desc: `決死の覚悟の発動条件が緩くなり、効果量が上がるのじゃ`, effect: { haisuiUp: 0.5 } },
	{ name: `投稿数ボーナス量アップ`, desc: `投稿数によるステータスボーナスが上昇するのじゃ`, effect: { postXUp: 0.075 } },
	{ name: `強敵と戦うのが好き`, desc: `敵が強ければステータスが上昇するのじゃ`, effect: { enemyStatusBonus: 1 } },
	{ name: `${serifs.rpg.status.pen}+10%`, desc: `相手の防御の影響を減少させるのじゃ`, effect: { arpen: 0.1 } },
	{
		name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}4`,
		desc: `乱数幅が20~180 -> 60~160になるのじゃ`,
		effect: { atkRndMin: 0.4, atkRndMax: -0.2 },
		unique: 'rnd',
	},
	{
		name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndM}5`,
		desc: `乱数幅が20~180 -> 90~130になるのじゃ`,
		effect: { atkRndMin: 0.7, atkRndMax: -0.5 },
		unique: 'rnd',
	},
	{
		name: `${serifs.rpg.dmg.give}${serifs.rpg.status.rndP}`,
		desc: `乱数幅が20~180 -> 5~230になるのじゃ クリティカル率も上がるのじゃ`,
		effect: { atkRndMin: -0.15, atkRndMax: 0.5, critUpFixed: 0.02 },
		unique: 'rnd',
	},
	{
		name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndM}`,
		desc: `敵の最大ダメージを減少させるのじゃ`,
		effect: { defRndMin: 0, defRndMax: -0.2 },
		unique: 'rnd',
	},
	{
		name: `${serifs.rpg.dmg.take}${serifs.rpg.status.rndP}`,
		desc: `敵の最小ダメージを減少させるのじゃ`,
		effect: { defRndMin: -0.2, defRndMax: 0 },
		unique: 'rnd',
	},
	{
		name: `準備を怠らない`,
		desc: `ターン1にて、必ず武器か防具を装備するのじゃ`,
		effect: { firstTurnItem: 1 },
		unique: 'firstTurnItem',
	},
	{ name: `道具大好き`, desc: `道具の装備率が上がるのじゃ`, effect: { itemEquip: 0.4 } },
	{ name: `道具の扱いが上手い`, desc: `道具の効果量が上がるのじゃ`, effect: { itemBoost: 0.4 } },
	{
		name: `武器が大好き`,
		desc: `武器を装備しやすくなるし、武器の効果量が上がるのじゃ`,
		effect: { weaponSelect: 1, weaponBoost: 0.6 },
		unique: 'itemSelect',
	},
	{
		name: `防具が大好き`,
		desc: `防具を装備しやすくなるし、防具の効果量が上がるのじゃ`,
		effect: { armorSelect: 1, armorBoost: 0.6 },
		unique: 'itemSelect',
	},
	{
		name: `食いしんぼう`,
		desc: `食べ物を食べやすくなるし、食べ物の効果量が上がるのじゃ`,
		effect: { foodSelect: 1, foodBoost: 0.6, poisonResist: 0.6 },
		unique: 'itemSelect',
	},
	{ name: `なんでも口に入れない`, desc: `良くないものを食べなくなることがあるのじゃ`, effect: { poisonAvoid: 0.5 } },
	{
		name: `道具の選択が上手い`,
		desc: `道具の効果量がすこし上がって、悪いアイテムを選びにくくなるのじゃ`,
		effect: { itemBoost: 0.15, mindMinusAvoid: 0.15 },
	},
	{
		name: `お腹が空いてから食べる`,
		desc: `体力が減ったら食べ物を食べやすくなるし、食べ物の効果量が少し上がるのじゃ`,
		effect: { lowHpFood: 1, foodBoost: 0.2, poisonResist: 0.2 },
		unique: 'lowHpFood',
	},
	{
		name: `たまにたくさん成長`,
		desc: `たまにステータスが多く増加するのじゃ ★変更不可`,
		effect: { statusBonus: 1 },
		unique: 'status',
		cantReroll: true,
	},
	{ name: `連続攻撃完遂率上昇`, desc: `連続攻撃を相手に止められにくくなるのじゃ`, effect: { abortDown: 0.3 } },
	{
		name: `クリティカル性能上昇`,
		desc: `クリティカル率とクリティカルダメージが上昇するのじゃ`,
		effect: { critUp: 0.2, critUpFixed: 0.03, critDmgUp: 0.2 },
	},
	{
		name: `敵のクリティカル性能減少`,
		desc: `相手のクリティカル率とクリティカルダメージが減少するのじゃ`,
		effect: { enemyCritDown: 0.3, enemyCritDmgDown: 0.3 },
	},
	{ name: `クリティカル上昇`, effect: { critUp: 0.3 }, moveTo: 'クリティカル性能が上昇するのじゃ' },
	{ name: `クリティカルダメージ上昇`, effect: { critDmgUp: 0.3 }, moveTo: 'クリティカル性能が上昇するのじゃ' },
	{ name: `敵のクリティカル率減少`, effect: { enemyCritDown: 0.3 }, moveTo: '敵のクリティカル性能が減少するのじゃ' },
	{ name: `敵のクリティカルダメージ減少`, effect: { enemyCritDmgDown: 0.3 }, moveTo: '敵のクリティカル性能が減少するのじゃ' },
	{
		name: `負けた時、しっかり反省`,
		desc: `敗北時のボーナスが上昇するのじゃ ★変更不可`,
		effect: { loseBonus: 1 },
		unique: 'loseBonus',
		cantReroll: true,
	},
	{
		name: `７フィーバー！`,
		desc: `Lv・パワー・防御の値に「7」が含まれている程ステータスアップするのじゃ`,
		effect: { sevenFever: 1 },
	},
	{
		name: `不運チャージ`,
		desc: `不運だった場合、次回幸運になりやすくなるのじゃ！らっきーなのは良いことじゃ！`,
		effect: { charge: 1 },
	},
];

export const getSkill = (data) => {
	const filteredSkills = skills.filter(
		(x) =>
			!x.moveTo &&
			!data.skills
				?.filter((y) => y.unique)
				.map((y) => y.unique)
				.includes(x.unique)
	);
	return filteredSkills[Math.floor(Math.random() * filteredSkills.length)];
};

export const getRerollSkill = (data, oldSkillName = '') => {
	const filteredSkills = skills.filter(
		(x) =>
			!x.moveTo &&
			!x.cantReroll &&
			x.name != oldSkillName &&
			!data.skills
				?.filter((y) => y.unique)
				.map((y) => y.unique)
				.includes(x.unique)
	);
	return filteredSkills[Math.floor(Math.random() * filteredSkills.length)];
};

/** スキルに関しての情報を返す */
export const skillReply = (module: Module, msg: Message) => {
	// データを読み込み
	const data = msg.friend.getPerModulesData(module);
	if (!data) return false;

	const playerSkills = data.skills.map((x) => skills.find((y) => x.name === y.name) ?? x);

	if (msg.includes([serifs.rpg.command.change])) {
		if (!data.rerollOrb || data.rerollOrb <= 0) return { reaction: 'confused' };
		for (let i = 0; i < data.skills.length; i++) {
			if (msg.includes([String(i + 1)])) {
				if (!playerSkills[i].cantReroll) {
					const oldSkillName = playerSkills[i].name;
					data.skills[i] = getRerollSkill(data, oldSkillName);
					msg.reply(`\n` + serifs.rpg.moveToSkill(oldSkillName, data.skills[i].name));
					data.rerollOrb -= 1;
					msg.friend.setPerModulesData(module, data);
					return {
						reaction: 'love',
					};
				} else {
					return {
						reaction: 'confused',
					};
				}
			}
		}
		return {
			reaction: 'confused',
		};
	}

	msg.reply(
		[
			data.rerollOrb && data.rerollOrb > 0 ? serifs.rpg.skills.info(data.rerollOrb) + '\n' : '',
			serifs.rpg.skills.list,
			...playerSkills.map((x, index) => `[${index + 1}] ${x.name}${x.desc ? `\n${x.desc}` : ''}`),
		]
			.filter(Boolean)
			.join('\n')
	);

	return {
		reaction: 'love',
	};
};

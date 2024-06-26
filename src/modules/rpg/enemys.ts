//RPGで使用する敵の情報
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
	{
		name: ":aine_heart:",
		msg: ":aine_heart:がお喋りしてほしいようだ。",
		short: ":aine_heart:とお喋り中",
		hpmsg: "満足度",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんの巧みな話術！\n${dmg}ポイント満足させた！`,
		defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
		winmsg: ":aine_heart:を満足させた！",
		losemsg: "阨ちゃんは疲れで倒れてしまった…",
		atk: 1.1,
		def: 1.1,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":gentoochan:",
		msg: ":gentoochan:は一緒に輪投げで遊びたいようだ",
		short: ":gentoochan:と輪投げ遊び中",
		hpmsg: "満足度",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんの番だ！\n輪っかを投げて${dmg}ポイント獲得した！`,
		defmsg: (dmg) =>
			`:gentoochan:の番だ！\n輪っかを投げて${dmg}ポイント獲得した！`,
		winmsg: "勝負の結果、阨ちゃんが勝った！",
		losemsg: "勝負の結果、:gentoochan:が勝った！",
		atk: 1.2,
		def: 1.2,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":shiromaru_dotto:",
		msg: ":shiromaru_dotto:が現れた。",
		short: ":shiromaru_dotto:とバトル中",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
		defmsg: (dmg) => `:shiromaru_dotto:の攻撃！${dmg}ポイントのダメージ！`,
		winmsg: ":shiromaru_dotto:はどこかへ逃げて行った！",
		losemsg: "阨ちゃんは疲れて倒れてしまった…",
		atk: 1,
		def: 1,
		atkx: 3,
		defx: 3,
	},
	{
		name: "🍰",
		msg: "🍰が現れた！:strawberry_normal:をうまくカットして儀式を完遂しないといけない！",
		short: "🍰の儀式を実行中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんのケーキ入刀！\n:strawberry_normal:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:strawberry_normal:の甘い誘惑！\n阨ちゃんはお腹が減って${dmg}ポイントのダメージ！`,
		winmsg: ":strawberry_half:にできた！儀式を完遂した！",
		losemsg: "阨ちゃんは我慢しきれず🍰を途中で食べてしまった…",
		atk: 2,
		def: 0.5,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":kochi_cat:",
		msg: ":kochi_cat:が縄張り争いを仕掛けてきた",
		short: ":kochi_cat:と縄張り争い中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんのじゃれつき！\n:kochi_cat:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:kochi_cat:のひっかき攻撃！\n阨ちゃんに${dmg}ポイントのダメージ！`,
		winmsg: ":kochi_cat:に負けを認めさせた！",
		losemsg: "阨ちゃんは負けを認めた…",
		atk: 1,
		def: 1,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":chocolatchan:",
		msg: ":chocolatchan:がなでなでバトルを持ち掛けてきた！",
		short: ":chocolatchan:となでなでバトル中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんは:chocolatchan:をなでなでした！\n:chocolatchan:を${dmg}ポイント満足させた`,
		defmsg: (dmg) =>
			`:chocolatchan:は阨ちゃんをなでなでした！\n阨ちゃんを${dmg}ポイント満足させた`,
		winmsg: ":chocolatchan:を満足させた！",
		losemsg: "阨ちゃんは自分が満足させられてしまった…",
		atk: 1.3,
		def: 1,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":tera_dotto:",
		msg: ":tera_dotto:はきゅうりを食べたいようだ。",
		short: ":tera_dotto:にきゅうりを与え中",
		hpmsg: "満腹度",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) =>
			`阨ちゃんはきゅうりを${
				dmg / 10
			}kg持ってきた！\n:tera_dotto:は全て食べた！`,
		defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
		winmsg: ":tera_dotto:は満足したようだ！",
		losemsg: "阨ちゃんは疲れで倒れてしまった…",
		atk: 1,
		def: 1,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":jump_kito:",
		msg: ":jump_kito:が着こなし勝負したいようだ。",
		short: ":jump_kito:と着こなしバトル中",
		mark: "☆",
		mark2: "★",
		lToR: true,
		pLToR: true,
		atkmsg: (dmg) =>
			`阨ちゃんはいっぱいいっぱい考えた！\n着こなしのオシャレ度が${dmg}ポイントアップ！`,
		defmsg: (dmg) =>
			`:jump_kito:は雑誌から情報を収集した！\n:jump_kito:の着こなしのオシャレ度が${dmg}ポイントアップ！`,
		winmsg: "審査員が来た！\n良い着こなしと判定されたのは阨ちゃんだった！",
		losemsg: "審査員が来た！\n良い着こなしと判定されたのは:jump_kito:だった！",
		atk: 1.5,
		def: 1.5,
		atkx: 3,
		defx: 3,
		maxdmg: 0.95,
		notEndure: true,
	},
	{
		name: "阨ちゃんは猛勉強",
		limit: (data) => (data.streak ?? 0) >= 2,
		msg: "阨ちゃんはスマートな九尾になるため猛勉強を行うようだ。",
		short: "猛勉強中",
		hpmsg: "勉強度",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) =>
			`阨ちゃんは勉強に取り組んだ！\n勉強度が${dmg}ポイントアップ！`,
		defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
		abortmsg: "阨ちゃんはサボりたくなったので勉強を一旦止めた！",
		winmsg: "阨ちゃんは試験で高得点を得ることが出来た！",
		losemsg: "阨ちゃんは疲れて勉強を諦めてしまった…",
		maxhp: 320,
		atk: 2,
		def: 0.8,
		atkx: 4,
		defx: 3,
		maxdmg: 0.85,
		abort: 0.05,
	},
	{
		name: ":makihara_ojiichan_dot:",
		limit: (data) => (data.streak ?? 0) >= 2,
		msg: ":makihara_ojiichan_dot:が現れた。なぞなぞで遊んでくれるようだ",
		short: "なぞなぞ中",
		hpmsg: "正答数",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) =>
			`阨ちゃんは:makihara_ojiichan_dot:のなぞなぞに回答した！\n正答数が${dmg}個増えた！`,
		defmsg: (dmg) => `阨ちゃんは頭を使いすぎて${dmg}ポイントのダメージ！`,
		abortmsg: "阨ちゃんは疲れちゃったので一旦なぞなぞを中断した！",
		winmsg:
			"なぞなぞを解き終えた！阨ちゃんは:makihara_ojiichan_dot:に褒められた！",
		losemsg: "阨ちゃんは疲れてなぞなぞに答えるのを諦めてしまった…",
		maxhp: 320,
		atk: 1.4,
		def: 1.2,
		atkx: 3,
		defx: 3,
		maxdmg: 0.85,
		abort: 0.05,
	},
	{
		name: "阨ちゃんは村の巡回",
		limit: (data) => (data.streak ?? 0) >= 2,
		msg: "阨ちゃんは村の巡回を行うようだ。",
		short: "村の巡回中",
		hpmsg: "村巡回完了度",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) =>
			`阨ちゃんは村人に元気よく挨拶した！\n村の巡回完了度が${dmg}ポイントアップ！`,
		defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
		abortmsg: "阨ちゃんは飽きちゃったので村の巡回を一旦止めた！",
		winmsg: "阨ちゃんは村の巡回を終わらせた！",
		losemsg: "阨ちゃんは疲れて寝てしまった…",
		atk: 0.6,
		def: 2,
		atkx: 3,
		defx: 3,
		maxdmg: 0.95,
		abort: 0.05,
	},

	{
		name: ":miko_encounter_dot:",
		limit: (data) => (data.streak ?? 0) >= 2,
		msg: ":miko_encounter_dot:が神社のお掃除を手伝ってほしいようだ",
		short: "神社のお掃除中",
		hpmsg: "お掃除完了度",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) =>
			`阨ちゃんは:miko_encounter_dot:をマネしていっぱい掃き掃除をした！\n神社のお掃除完了度が${dmg}ポイントアップ！`,
		defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
		abortmsg: "阨ちゃんは疲れてしまって掃除を一旦止めた！",
		winmsg: "阨ちゃんは神社のお掃除を終わらせた！",
		losemsg: "阨ちゃんは疲れて寝てしまった…",
		atk: 1.2,
		def: 1.4,
		atkx: 3,
		defx: 3,
		maxdmg: 0.95,
		abort: 0.05,
	},
	{
		name: ":syounenz_dotto:",
		limit: (data) => (data.streak ?? 0) >= 2,
		msg: ":syounenz_dotto:が一緒にゲームで遊びたいようだ。",
		short: ":syounenz_dotto:と遊び中",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんは頭を使った！\n${dmg}ポイントを手に入れた！`,
		defmsg: (dmg) => `:syounenz_dotto:の番だ！${dmg}ポイント手に入れた！`,
		winmsg: "阨ちゃんはゲームに勝利した！",
		losemsg: ":syounenz_dotto:はゲームに勝利した！",
		atk: 1,
		def: 0.5,
		atkx: 3.5,
		defx: 3.5,
	},
	{
		name: ":role_capsaishin:",
		limit: (data) => (data.streak ?? 0) >= 2,
		msg: ":role_capsaishin:は激辛料理の試練を受けてほしいようだ",
		short: ":role_capsaishin:の激辛試練中",
		mark: "☆",
		mark2: "★",
		atkmsg: (dmg) =>
			`阨ちゃんは激辛料理を食べた！\n激辛料理を${dmg}ポイント分食べた！`,
		defmsg: (dmg) =>
			`:role_capsaishin:"の追い唐辛子！\n阨ちゃんは${dmg}ポイントのダメージ！\n阨ちゃんが次に受けるダメージが上昇した！`,
		winmsg: "阨ちゃんは完食し、:role_capsaishin:の激辛試練に打ち勝った！",
		losemsg: "阨ちゃんは辛さに耐えられずやられてしまった…",
		atk: 0.5,
		def: 2,
		atkx: 2,
		defx: 4,
		fire: 0.2,
	},
	{
		name: ":kochi_shiromaru_drop:",
		dname: ":kochi_shiromaru_drop:",
		limit: (data) =>
			(data.streak ?? 0) >= 3 && data.clearEnemy.includes(":shiromaru_dotto:"),
		msg: ":shiromaru_dotto:が:kochi_shiromaru_drop:を引き連れて現れた！リベンジをしたいようだ。",
		short: ":kochi_shiromaru_drop:とバトル中（ふたたび）",
		mark: "☆",
		mark2: "★",
		lToR: true,
		pLToR: true,
		atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}のダメージ！`,
		defmsg: (dmg) => `:shiromaru_dotto:の攻撃！\n${dmg}のダメージ`,
		winmsg: ":shiromaru_dotto:は:kochi_shiromaru_drop:の中に逃げ去った！",
		losemsg: "阨ちゃんは疲れて倒れてしまった…",
		atk: 0.7,
		def: 1.5,
		atkx: 5,
		defx: 5,
		maxdmg: 0.6,
		notEndure: true,
	},
	{
		name: ":kamoshika_dot:",
		limit: (data) => (data.winCount ?? 0) >= 2 && (data.streak ?? 0) >= 2,
		msg: "突然:kamoshika_dot:が現れた。",
		short: ":kamoshika_dot:とバトル中",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
		defmsg: (dmg) => `:kamoshika_dot:の頭突き！${dmg}ポイントのダメージ！`,
		winmsg: ":kamoshika_dot:は「世の中クソだな」と言いながら立ち去って行った！",
		losemsg: "阨ちゃんは倒れてしまった…",
		atk: 2,
		def: 2,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":densi_renzi_dot:",
		limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3,
		msg: ":densi_renzi_dot:があたためバトルを仕掛けてきた！",
		short: ":densi_renzi_dot:とあたためバトル中",
		mark: "☆",
		mark2: "★",
		atkmsg: (dmg) =>
			`阨ちゃんはミニ狐火であたため！\n${dmg}ポイントお弁当を温めた！`,
		defmsg: (dmg) =>
			`:densi_renzi_dot:の機械的なレンチン！\n${dmg}ポイントお弁当を温めた！`,
		abortmsg:
			":densi_renzi_dot:は阨ちゃんのミニ狐火からお弁当の位置をずらした！",
		winmsg: "阨ちゃんはあたためバトルを制した！",
		losemsg: "阨ちゃんはあたためバトルに敗北した…",
		atk: 0.9,
		def: 3,
		atkx: 3,
		defx: 5,
		abort: 0.2,
	},
	{
		name: ":densi_renzi_dot:2",
		limit: (data) =>
			(data.winCount ?? 0) >= 5 &&
			(data.streak ?? 0) >= 5 &&
			data.clearEnemy.includes(":densi_renzi_dot:"),
		msg: ":densi_renzi_dot:が沽券をかけて再度あたためバトルを仕掛けてきた！",
		short: ":densi_renzi_dot:とあたためバトル中",
		mark: "☆",
		mark2: "★",
		atkmsg: (dmg) =>
			`阨ちゃんはミニ狐火であたため！\n${dmg}ポイントお弁当を温めた！`,
		defmsg: (dmg) =>
			`:densi_renzi_dot:の機械的なレンチン！\n${dmg}ポイントお弁当を温めた！`,
		abortmsg:
			":densi_renzi_dot:は姑息にも阨ちゃんのミニ狐火からお弁当の位置をずらした！",
		winmsg: "阨ちゃんはあたためバトルを制した！",
		losemsg: "阨ちゃんはあたためバトルに敗北した…",
		atk: 1.8,
		def: 3.5,
		atkx: 4,
		defx: 5,
		abort: 0.5,
	},
	{
		name: ":syokusyu:",
		limit: (data) => (data.winCount ?? 0) >= 4 && (data.streak ?? 0) >= 4,
		msg: ":syokusyu:が地面から生えてきた",
		short: ":syokusyu:とバトル中",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんの攻撃！\n${dmg}ポイントのダメージ！`,
		defmsg: (dmg) => `:syokusyu:の捲きつき攻撃！${dmg}ポイントのダメージ！`,
		winmsg: ":syokusyu:はびっくりして地中に逃げ帰っていった！",
		losemsg: "阨ちゃんは倒れてしまった…",
		atk: 1.2,
		def: 2,
		spd: 2,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":panjandrum2:",
		limit: (data) => (data.winCount ?? 0) >= 3 && (data.streak ?? 0) >= 3,
		msg: "暴走:panjandrum2:が現れた！鎮めなくては！",
		short: ":panjandrum2:を鎮め中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんの妖術！\n:panjandrum2:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:panjandrum2:の高速スピン！\n阨ちゃんは${dmg}ポイントのダメージ！`,
		abortmsg: ":panjandrum2:は回転力で阨ちゃんの連続攻撃を止めた！",
		winmsg: "阨ちゃんは:panjandrum2:を鎮めた！",
		losemsg: "阨ちゃんはやられてしまった…",
		atk: 4,
		def: 0.4,
		atkx: 6,
		defx: 3,
		abort: 0.3,
	},
	{
		name: ":kochisan:",
		dname: ":kochisan:",
		limit: (data) =>
			(data.winCount ?? 0) >= 4 &&
			(data.streak ?? 0) >= 4 &&
			data.clearEnemy.includes(":kochi_shiromaru_drop:"),
		msg: ":kochisan:がただそこに存在している…",
		short: ":kochisan:と遭遇中",
		hpmsg: "認識",
		mark: "☆",
		mark2: "★",
		lToR: true,
		atkmsg: (dmg) => `阨ちゃんの念力！\n:kochisan:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:kochisan:はただそこに存在している！\n${dmg}ポイントのダメージ！`,
		winmsg: ":kochisan:はいつの間にか消えていた",
		losemsg: "阨ちゃんはやられてしまった…",
		atk: 0.75,
		def: 4,
		spd: 3,
		atkx: 3,
		defx: 4,
	},
	{
		name: ":kamoshika_dot:2",
		dname: ":kamoshika_dot:",
		limit: (data) =>
			(data.winCount ?? 0) >= 4 &&
			(data.streak ?? 0) >= 4 &&
			data.clearEnemy.includes(":kamoshika_dot:"),
		msg: "またまた:kamoshika_dot:が現れた。",
		short: ":kamoshika_dot:とバトル中（ふたたび）",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんの攻撃！\n:kamoshika_dot:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:kamoshika_dot:の頭突き！\n阨ちゃんに${dmg}ポイントのダメージ！`,
		winmsg:
			":kamoshika_dot:は「相も変わらず世の中クソだな」と言いながら立ち去って行った！",
		losemsg: "阨ちゃんは倒れてしまった…",
		atk: 3,
		def: 3,
		atkx: 3,
		defx: 3,
	},
	{
		name: ":role_capsaishin:2",
		dname: ":role_capsaishin:",
		limit: (data) =>
			(data.winCount ?? 0) >= 40 &&
			(data.streak ?? 0) >= 4 &&
			data.clearEnemy.includes(":role_capsaishin:"),
		msg: ":role_capsaishin:が新たな激辛料理の試練を用意してきた！",
		short: ":role_capsaishin:の激辛試練中（ふたたび）",
		mark: "☆",
		mark2: "★",
		atkmsg: (dmg) =>
			`阨ちゃんは全力で激辛料理を食べた！\n激辛料理を${dmg}ポイント分食べた！`,
		defmsg: (dmg) =>
			`:role_capsaishin:の追い唐辛子！\n阨ちゃんは${dmg}ポイントのダメージ！\n阨ちゃんが次に受けるダメージが上昇した！`,
		abortmsg: "阨ちゃんは全力で食べた為、すぐには連続で食べることが出来ない！",
		winmsg: "阨ちゃんは完食し、:role_capsaishin:の激辛試練に打ち勝った！",
		losemsg: "阨ちゃんは辛さに耐えられずやられてしまった…",
		atk: 0.1,
		def: 1,
		atkx: 1,
		defx: (tp) => 1.3 * tp,
		fire: 0.15,
		abort: 1,
	},
	{
		name: ":aichan:",
		limit: (data) =>
			((data.winCount ?? 0) >= 24 ||
				((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) ||
				new Date().getMonth() - new Date().getDate() === -1) &&
			(data.color ?? 1) === 8 &&
			!data.clearEnemy.includes(":aichan8:"),
		msg: "我は汝 汝は我…、もうひとりの:aichan:が現れ、勝負を仕掛けてきた！",
		short: ":aichan:と戦い中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんの攻撃！\nシャドウ阨ちゃんに${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`シャドウ阨ちゃんの攻撃！\n阨ちゃんに${dmg}ポイントのダメージ！`,
		winmsg: "もうひとりの自分は消えていった！\nどうやら幻だったようだ…",
		losemsg:
			"阨ちゃんはやられてしまった…\nもうひとりの自分はどこかへ消えていった…",
		maxhp: (hp) => hp - 3,
		atk: (atk, def, spd) => def - 3.5,
		def: (atk, def, spd) => (atk - 3.5) * spd,
		atkx: (tp) => tp,
		defx: (tp) => tp,
	},
	{
		name: ":nene_chan_dot:",
		limit: (data) => (data.winCount ?? 0) >= 6 && (data.streak ?? 0) >= 6,
		msg: ":nene_chan_dot:が突如現れ邪教の布教をしてきた！",
		short: ":nene_chan_dot:が邪教の解説中",
		mark: "☆",
		mark2: "★",
		atkmsg: (dmg) =>
			`阨ちゃんは頑張ってうんうんと頷いた！\n理解度が${dmg}ポイント上がった！`,
		defmsg: (dmg) =>
			`:nene_chan_dot:の立て続けの解説！\n難しくて理解しきれず混乱した阨ちゃんに${dmg}ポイントのダメージ！`,
		winmsg: "阨ちゃんは長文邪教解説を乗り切った！",
		losemsg: "阨ちゃんは長文邪教解説に耐えられず目の前が真っ暗になった…",
		atk: 1.1,
		def: 4,
		atkx: 2,
		defx: 4,
	},
	{
		name: ":gaming_panjandrum:",
		limit: (data, friend) =>
			(data.winCount ?? 0) >= 10 &&
			(data.streak ?? 0) >= 7 &&
			data.clearEnemy.includes(":panjandrum2:"),
		msg: "1670万色に輝く:gaming_panjandrum:が現れた！鎮めなくては！",
		short: ":gaming_panjandrum:を鎮め中（ふたたび）",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんの妖術！\n:gaming_panjandrum:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:gaming_panjandrum:の高速スピン！\n阨ちゃんは${dmg}ポイントのダメージ！`,
		abortmsg: ":gaming_panjandrum:は回転力で阨ちゃんの連続攻撃を止めた！",
		winmsg: "阨ちゃんは:gaming_panjandrum:を鎮めた！",
		losemsg: "阨ちゃんはやられてしまった…",
		atk: 8,
		def: 1,
		atkx: 4,
		defx: 3,
		abort: 0.3,
	},
	{
		name: ":aichan8:",
		limit: (data) =>
			((data.winCount ?? 0) >= 24 ||
				((data.lv ?? 1) <= 99 && (data.lv ?? 1) % 11 === 0) ||
				new Date().getMonth() - new Date().getDate() === -1) &&
			(data.color ?? 1) !== 8 &&
			!data.clearEnemy.includes(":aichan:"),
		msg: "ムラサキカガミの中から:aichan8:が現れ、勝負を仕掛けてきた！",
		short: ":aichan8:と戦い中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) => `阨ちゃんの攻撃！\n:aichan8:に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) => `:aichan8:の攻撃！\n阨ちゃんに${dmg}ポイントのダメージ！`,
		winmsg: ":aichan8:に打ち勝った！",
		losemsg: "阨ちゃんはやられてしまった…",
		maxhp: (hp) => hp,
		atk: (atk, def, spd) => def,
		def: (atk, def, spd) => atk * spd,
		atkx: (tp) => tp,
		defx: (tp) => tp,
	},
	{
		name: ":aine_oko:",
		limit: (data) => (data.winCount ?? 0) >= 5 && (data.streak ?? 0) >= 5,
		msg: "村長に話しかけたつもりが様子がおかしい…。怒った:aine_oko:が言い返してきた！",
		short: ":aine_oko:と口論中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんのお話し攻撃！\n:aine_oko:の精神に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:aine_oko:の罵詈雑言！\n阨ちゃんの精神に${dmg}ポイントのダメージ！`,
		winmsg: ":aine_kuyashii:はぶつぶつ言いながら帰っていった！",
		losemsg: "阨ちゃんは悲しくて逃げ出してしまった…",
		maxhp: 130,
		atk: 5,
		def: 5,
		maxdmg: 0.7,
		atkx: 5,
		defx: 5,
	},
	{
		name: ":aine_youshou:",
		limit: (data, friend) =>
			(data.winCount ?? 0) >= 15 &&
			(data.streak ?? 0) >= 7 &&
			(friend.love ?? 0) >= 500 &&
			data.clearEnemy.includes(":aine_oko:"),
		msg: "村長に話しかけたつもりが様子がおかしい…。激怒して様子のおかしい:aine_youshou:が酷いことを言ってきた！",
		short: ":aine_youshou:と激しい口論中",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんのお話し攻撃！\n:aine_youshou:の精神に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:aine_youshou:の罵詈雑言の嵐！\n阨ちゃんの精神に${dmg}ポイントのダメージ！`,
		abortmsg:
			":aine_youshou:は大きな声で「黙れ:aine_oko:」と言った！阨ちゃんはびっくりしてお話を止めてしまった！",
		winmsg: ":aine_kuyashii:は捨て台詞を言いながら帰っていった！",
		losemsg: "阨ちゃんは悲しくて逃げ出してしまった…",
		atk: 15,
		def: 15,
		maxdmg: 0.6,
		atkx: 7,
		defx: 7,
		abort: 0.04,
	},
	{
		name: ":ai_minazuki_buged:",
		limit: (data, friend) =>
			(data.winCount ?? 0) >= 13 &&
			(data.streak ?? 0) >= 13 &&
			data.clearEnemy.includes(":aichan8:"),
		msg: ":ai_minazuki_buged:縺ｻ繧薙→縺??繧上◆縺",
		short: ":ai_minazuki_buged:縺ｨ縺ｾ縺悶ｊ縺ゅ＞",
		mark: "☆",
		mark2: "★",
		lToR: false,
		atkmsg: (dmg) =>
			`阨ちゃんの蝠上＞縺九￠！\n:aine_youshou:の精神に${dmg}ポイントのダメージ！`,
		defmsg: (dmg) =>
			`:ai_minazuki_buged:縺阪％縺医ｋ縺ｾ縺吶°！\n阨ちゃんの精神に${dmg}ポイントのダメージ！`,
		abortmsg:
			":ai_minazuki_buged:縺ｩ縺?＠縺ｦ縺ｨ縺?≧縺ｨ髦ｨ縺｡繧?ｓ縺ｯ蜍輔￠縺ｪ縺上↑縺｣縺！",
		winmsg: ":aine_kuyashii:縺ゅｊ縺後→縺?→險?縺｣縺ｦ蜴ｻ縺｣縺ｦ縺?▲縺！",
		losemsg: "阨ちゃんは目の前が真っ暗になった…",
		atk: 13,
		def: 13,
		maxdmg: 1.3,
		atkx: 13,
		defx: 13,
		abort: 0.13,
	},
];

/** 修行モードの場合の敵 */
export const endressEnemy = (data): Enemy => ({
	name: "阨ちゃんは修行",
	msg:
		data.endress ?? 0
			? `修行の途中 (${data.endress + 1}日目)`
			: "阨ちゃんは修行に出たいようだ。",
	short: data.endress ?? 0 ? `修行の途中 (${data.endress + 1}日目)` : "修行中",
	hpmsg: "進行度",
	lToR: true,
	mark: "☆",
	mark2: "★",
	atkmsg: (dmg) => `阨ちゃんは先に進んだ。\n進行度が${dmg}ポイントアップ！`,
	defmsg: (dmg) => `阨ちゃんは疲れて${dmg}ポイントのダメージ！`,
	abortmsg: "阨ちゃんは面白いものを見つけたみたいだ。",
	winmsg:
		"寝泊りするのによい感じの草むらが見えてきた。\n今日はここにテントを張って休むようだ。\n\n次の日へ続く…",
	losemsg: "今回の修行はここで終えて家に帰るようだ。",
	atk: 1.5 + 0.1 * (data.endress ?? 0),
	def: 2 + 0.3 * (data.endress ?? 0),
	atkx: 3 + 0.05 * (data.endress ?? 0),
	defx: 3 + 0.15 * (data.endress ?? 0),
	abort: 0.01,
});

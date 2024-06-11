import * as seedrandom from 'seedrandom';
import getDate from '@/utils/get-date';

export let rng = seedrandom(getDate());

export const itemPrefixes = [
	'銅の',
	'鉄の',
	'銀の',
	'金の',
	'ダイアモンドの',
	'ネザライトの',
	'木の',
	'プラチナの',
	'新鮮な',
	'最新式の',
	'古代の',
	'手作り',
	'時計じかけの',
	'伝説の',
	'焼き',
	'生の',
	'もこチキ謹製',
	'ポケットサイズ',
	`${Math.floor(rng() * 3) + 3}日前の`,
	'そこらへんの',
	'偽の',
	'使用済み',
	'壊れた',
	'市販の',
	'オーダーメイドの',
	'業務用の',
	'よりよい',
	'Microsoft製',
	'Apple製',
	'人類の技術を結集して作った',
	`${new Date().getFullYear() - 1 - Math.floor(rng() * 10)}年製`,
	`${new Date().getFullYear() + 1 + Math.floor(rng() * 10)}年製`,
	'9999年製',
	`${Math.floor(rng() * 11)}00kgくらいある`,
	'高級',
	'腐った',
	'人工知能搭載',
	'反重力',
	'折り畳み式',
	'携帯型',
	'遺伝子組み換え',
	'飛行能力を獲得した',
	'純金製',
	'透明な',
	'光る',
	'ハート型の',
	'もこチキ型の',
	'動く',
	'半分にカットされた',
	'USBコネクタ付きの',
	'いにしえの',
	'呪われた',
	'幸運のエンチャントが付与された',
	'無限のエンチャントが付与された',
	'シルクタッチのエンチャントが付与された',
	'水中呼吸のエンチャントが付与された',
	'水中歩行のエンチャントが付与された',
	'束縛の呪いのエンチャントが付与された',
	'消滅の呪いのエンチャントが付与された',
	'一日分のビタミンが入った',
	'あすけんの女を黙らせられる',
	'かじりかけ',
	'真',
	'極',
	'幻の',
	'仮想的な',
	'原子力',
	'高度に訓練された',
	'遺伝子組み換えでない',
	'ダンジョン最深部で見つかった',
	'ラスボスの',
	'異世界の',
	'異星の',
	'謎の',
	'時空を歪める',
	'異音がする',
	'霧散する',
	'プラズマ化した',
	'衝撃を与えると低確率で爆発する',
	'ズッキーニに擬態した',
	'ズゥキニーに擬態した',
	'仮説上の',
	'毒の',
	'真の',
	'究極の',
	'チョコ入り',
	'異臭を放つ',
	'4次元',
	'脈動する',
	'得体の知れない',
	'四角い',
	'暴れ回る',
	'夢の',
	'闇の',
	'暗黒の',
	'封印されし',
	'死の',
	'凍った',
	'魔の',
	'禁断の',
	'油圧式',
	'辛そうで辛くない少し辛い',
	'焦げた',
	'宇宙',
	'電子',
	'陽電子',
	'量子力学的',
	'シュレディンガーの',
	'分散型',
	'卵かけ',
	'次世代',
	'帯電',
	'太古の',
	'WiFi対応',
	'高反発',
	'【令和最新版】',
	'廉価版',
	'ねばねば',
	'どろどろ',
	'パサパサの',
	'湿気った',
	'賞味期限切れ',
	'地獄から来た',
	'ニンニクマシ',
	'放射性',
	'再帰的',
	'ときどき分裂する',
	'消える',
	'等速直線運動する',
	'蠢く',
	'もちもち',
	'冷やし',
	'あつあつ',
	'巨大',
	'ナノサイズ',
	'やわらかい',
	'バグった',
	'人工',
	'天然',
	'チョコレートコーティング',
	'抗菌仕様',
	'耐火',
	'激',
	'猛',
	'超',
	'群生する',
	'軽量',
	'国宝級',
	'流行りの',
	'8カラットの',
	'中古の',
	'新品の',
	'愛妻',
	'ブランドものの',
	'増殖する',
	'ぷるぷる',
	'ぐにゃぐにゃ',
	'多目的',
	'いい感じ™の',
	'激辛',
	'先進的な',
	'レトロな',
	'ヴィンテージ',
	'合法',
	'プレミア付き',
	'デカ',
	'ギガ',
	'品質保証付き',
	'AppleCare+加入済み',
	'えっちな',
	'デザイナーズ',
	'つやつや',
	'べとべと',
	'ムキムキ',
	'オーバークロックされた',
	'無機質な',
	'前衛的な',
	'怪しい',
	'カビの生えた',
	'熟成',
	'養殖',
	'やばい',
	'すごい',
	'かわいい',
	'デジタル',
	'アナログ',
	'彁な',
	'カラフルな',
	'電動',
	'当たり判定のない',
	'めり込んだ',
	'100年に一度の',
	'1000年に一度の',
	'ジューシーな',
	'確変',
	'食用',
	'the ',
	'朽ちゆく',
	'滅びの',
	'摩擦係数0の',
	'解き放たれし',
	'大きな',
	'小さな',
	'強欲な',
	'うねうね',
	'水没',
	'燃え盛る',
	'高圧',
	'異常',
	'粗挽き',
	'もこもこした',
	'道端に落ちている',
	'ココイチの',
	'無印の',
	'the Ultimate ',
	'the Perfect ',
	'the Heavens ',
	'the Alpha ',
	'全権大使の',
	'ゴルベーザ',
	'欲しくなってきたな、',
	'最弱の',
	'最強の',
	'川を流れるカバの',
	'普通の',
	'猛毒巨大ウニ',
	'二郎行き',
	'夏の日の',
	'決戦の',
	'超最高スーパーHAPPY',
	'獄凶悪残虐獰猛卑劣最悪',
	'一番いい',
	'アルミホイルの',
	'超高校級の',
	'トップバリュブランドの',
	'100均の',
	'ハイリアの',
	'カスの',
	'ダブルアックス',
	'地獄の',
	'2getした',
	'3getした',
	'3以外全部getした',
	'合法の',
	'ほとんど違法の',
	'甘すぎる',
	'甘すぎない',
	'うますぎない',
	'存在しない',
	'おこがましい',
	'破壊済みの',
	'ポンコツの',
	'オレンジの',
	'ピンクの',
	'黄色の',
	'嘘の',
	'土木学会田中賞を受賞した',
	'ベタついてしゃーない',
	'コンソメの',
];

export const items = [
	'猫',
	'ピッケル',
	'ツルハシ',
	'スコップ',
	'シャベル',
	'クワ',
	'オノ',
	'剣',
	'弓',
	'釣り竿',
	'アルミホイル',
	'サランラップ',
	'狂う狂う狂うラップ',
	'ナス',
	'トマト',
	'きゅうり',
	'じゃがいも',
	'焼きビーフン',
	'腰',
	'寿司',
	'かぼちゃ',
	'諭吉',
	'5000兆円',
	'キロバー',
	'アルミニウム',
	'ナトリウム',
	'マグネシウム',
	'バカデカメダル',
	'ちいさなメダル',
	'牛乳パック',
	'ペットボトル',
	'クッキー',
	'チョコレート',
	'メイド服',
	'オレンジ',
	'ニーソ',
	'反物質コンデンサ',
	'粒子加速器',
	'マイクロプロセッサ(4コア8スレッド)',
	'原子力発電所',
	'惑星',
	'デーモンコア',
	'ゲームボーイアドバンス',
	'量子コンピューター',
	'押し入れの奥から出てきた謎の生き物',
	'スマートフォン',
	'時計',
	'プリン',
	'ハンドスピナー',
	'超立方体',
	'建築物',
	'エナジードリンク',
	'マウスカーソル',
	'メガネ',
	'まぐろ',
	'ゴミ箱',
	'つまようじ',
	'お弁当に入ってる緑の仕切りみたいなやつ',
	'割りばし',
	'換気扇',
	'ペットボトルのキャップ',
	'消波ブロック',
	'ピザ',
	'歯磨き粉',
	'空き缶',
	'キーホルダー',
	'金髪碧眼の美少女',
	'フロッピーディスク',
	'ブルーレイディスク',
	'PCカード',
	'SDカード',
	'HDD',
	'SSD',
	'MD',
	'iPodShuffle',
	'ポケベル',
	'リップクリーム',
	'人生',
	'パン無し食パン',
	`食パンの耳${Math.floor(rng() * 100) + 1}年分`,
	'麺無しラーメン',
	'カレー無しカレーパン',
	'クリーム無しクリームパン',
	'チョコ無しチョココロネ',
	'エキノコックス',
	'カンピロバクター',
	'鳥インフルエンザ',
	'自動販売機',
	'重いもの',
	'ノートパソコン',
	'ビーフジャーキー',
	'さけるチーズ',
	'ダイヤモンド',
	'物体',
	'月の石',
	'特異点',
	'液体',
	'衛星',
	'ズッキーニ',
	'ズゥキニー',
	'黒いもの',
	'白いもの',
	'赤いもの',
	'丸いもの',
	'四角いもの',
	'カード状のもの',
	'気体',
	'鉛筆',
	'消しゴム',
	'つるぎ',
	'棒状のもの',
	'農産物',
	'メタルスライム',
	'タコの足',
	'きのこ',
	'なめこ',
	'缶チューハイ',
	'爪切り',
	'耳かき',
	'ぬいぐるみ',
	'ティラノサウルス',
	'エンターキー',
	'壺',
	'水銀',
	'水',
	'土地',
	'大陸',
	'サイコロ',
	'室外機',
	'タピオカ',
	'トイレットペーパーの芯',
	'ダンボール箱',
	'ハニワ',
	'ボールペン',
	'シャーペン',
	'原子',
	'宇宙',
	'ごま油',
	'卵かけご飯',
	'ダークマター',
	'ブラックホール',
	'太陽',
	'ダム',
	'ウイルス',
	'細菌',
	'アーチ式コンクリートダム',
	'重力式コンクリートダム',
	'橋',
	'オブジェ',
	'原子力発電所',
	'原子炉',
	'ブラウン管',
	'ラッセルのティーポット',
	'電子機器',
	'TNT',
	'ポリゴン',
	'空気',
	`GTX ${Math.floor(rng() * 9) + 1}${Math.floor(rng() * 5) + 5}0`,
	`RTX ${Math.floor(rng() * 9) + 1}0${Math.floor(rng() * 5) + 5}0`,
	'[R]で所持金MAX の秘技コード',
	'[L]長押しで浮遊 の秘技コード',
	'シャーペンの芯',
	'CapsLockキー',
	'虚無',
	'UFO',
	'NumLockキー',
	'放射性廃棄物',
	'火星',
	'ウラン',
	'遠心分離機',
	'ゼロ幅スペース',
	'全角スペース',
	'太鼓',
	'石像',
	'スライム',
	'点P',
	'🤯',
	'🤔',
	'🥴',
	'フロッピーディスク',
	'掛け軸',
	'インターネットエクスプローラー',
	'ミトコンドリア',
	'ヘリウム',
	'タンパク質',
	'C18H27NO3',
	'エスカレーター',
	'核融合炉',
	'地熱発電所',
	'マンション',
	'ガリレオ温度計',
	'ラジオメーター',
	'サンドピクチャー',
	'ストームグラス',
	'永久機関',
	'柿の種のピーナッツ部分',
	'伝票入れる筒状のアレ',
	'布団',
	'寝具',
	'偶像',
	'森羅万象',
	'国民の基本的な権利',
	'こたつ',
	'靴下(片方は紛失)',
	'健康保険証',
	'テレホンカード',
	'ピアノの黒鍵',
	'ACアダプター',
	'DVD',
	'市営バス',
	'基地局',
	'タペストリー',
	'本',
	'石像',
	'古文書',
	'巻物',
	'Misskey',
	'Calckey',
	'軍手キー',
	'全部キー',
	'一部キー',
	'お嬢様キー',
	'アルミホイル系お嬢様',
	'もこきすと',
	'滅',
	'力',
	'愛',
	'全知全能',
	'マスターソード',
	'盾',
	'コログ',
	'四天王',
	'百天王',
	'オレオ',
	'あすけんの女',
	'メイドキー',
	'予防接種キー',
	'サッカー部キー',
	'もぎもぎフルーツ',
	'化石',
	'マンホールの蓋',
	'蛇口',
	'彁',
	'鬮',
	'1円玉',
	'ト音記号',
	'ポータル',
	'国家予算',
	'閉じ忘れられた鉤括弧の片割れ',
	'電動マッサージ機',
	'ポップアップ広告',
	'あああああ',
	'素数',
	'タスクマネージャー',
	'有象無象',
	'炭水化物',
	'正十二面体',
	'メビウスの輪',
	'オリハルコン',
	'ヘドロ',
	'繝九Λ縺ｮ縺ｿ縺晄ｱ',
	'もこもこ',
	'もこきー',
	'もこもこチキン',
	'俺',
	'軍手',
	'キー',
	'メンサ',
	'全部',
	'全部以外',
	'全部以外以外',
	'Legend',
	'リグレットカー',
	'二郎行きたい',
	'イキイキゼミ',
	'泣き虫ゼミ',
	'バトルフィールド',
	'裁判所',
	'曲',
	'ピカグレ判定',
	'黄グレ判定',
	'GOOD判定',
	'BAD判定',
	'地力譜面',
	'個人差譜面',
	'ソフラン譜面',
	'皿譜面',
	'犯罪譜面',
	'村長',
	'ゴルベーザ',
	'3getロボ',
	'ゆっくり',
	'ドマ茶',
	'カタコト脳筋',
	'2で消毒',
	'データセーバー',
	'絵文字',
	'この世の終わり',
	'縦連',
	'全白皆伝',
	'マスコットキャラクター',
	'因数分解',
	'アップデート',
	'限界突破',
	'トイコンテンポラリー',
	'PUC',
	'初代譜面',
	'オレオォ？',
	'地獄の呪縛',
	'ラーヴァナ',
	'オーディン',
	'ラッピー',
	'チョコボ',
	'星のカービー',
	':niwatori_kun:',
	'パンチ',
];

export const and = [
	'に擬態した',
	'入りの',
	'っぽい',
	'に見せかけて',
	'を虐げる',
	'を侍らせた',
	'が上に乗った',
	'以外の',
	'または',
	'かつ',
	'メンサの',
	'キーの',
];

export function genItem(seedOrRng?: (() => number) | string | number) {
	rng = seedOrRng
		? typeof seedOrRng === 'function'
			? seedOrRng
			: seedrandom(seedOrRng.toString())
		: Math.random;

	let item = '';
	if (Math.floor(rng() * 20) !== 0) item += itemPrefixes[Math.floor(rng() * itemPrefixes.length)];
	item += items[Math.floor(rng() * items.length)];
	if (Math.floor(rng() * 10) === 0) {
		let andItem = "";
		if (Math.floor(rng() * 3) === 0) andItem += itemPrefixes[Math.floor(rng() * itemPrefixes.length)];
		andItem += items[Math.floor(rng() * items.length)];
		andItem += and[Math.floor(rng() * and.length)];
		item = andItem + item;
	}
	return item;
}

import * as seedrandom from 'seedrandom';

export const itemPrefixes = [
	'プラチナ製',
	'新鮮な',
	'最新式の',
	'古代の',
	'手作り',
	'時計じかけの',
	'伝説の',
	'焼き',
	'生の',
	'藍謹製',
	'ポケットサイズ',
	'3日前の',
	'そこらへんの',
	'偽の',
	'使用済み',
	'壊れた',
	'市販の',
	'オーダーメイドの',
	'業務用の',
	'Microsoft製',
	'Apple製',
	'人類の技術を結集して作った',
	'2018年製', // TODO ランダム
	'500kgくらいある',
	'高級',
	'腐った',
	'人工知能搭載',
	'反重力',
	'折り畳み式',
	'携帯型',
	'遺伝子組み換え',
	'突然変異して飛行能力を獲得した',
	'純金製',
	'透明な',
	'光る',
	'ハート型の',
	'動く',
	'半分にカットされた',
	'USBコネクタ付きの',
	'いにしえの',
	'呪われた',
	'エンチャントされた',
	'一日分のビタミンが入った',
	'かじりかけ',
	'幻の',
	'仮想的な',
	'原子力',
	'高度に訓練された',
	'遺伝子組み換えでない',
	'ダンジョン最深部で見つかった',
	'異世界の',
	'異星の',
	'謎の',
	'時空を歪める',
	'異音がする',
	'霧散する',
	'プラズマ化した',
	'衝撃を与えると低確率で爆発する',
	'ズッキーニに擬態した',
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
	'ホログラフィックな',
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
	'フラクタルな',
	'再帰的',
	'ときどき分裂する',
	'消える',
	'等速直線運動する',
	'X線照射',
	'蠢く',
	'形而上学的',
	'もちもち',
	'冷やし',
	'あつあつ',
	'巨大',
	'ナノサイズ',
	'やわらかい',
	'人の手に負えない',
	'バグった',
	'どこからともなく現れる',
	'人工',
	'天然',
	'祀られた',
	'チョコレートコーティング',
	'地域で親しまれている',
	'抗菌仕様',
	'耐火',
	'血行を良くする作用がある',
	'なんらかのオーラを感じる',
	'周囲の気温を上昇させる効果がある',
	'激',
	'猛',
	'超',
	'群生する',
	'軽量',
	'国宝級',
	'称賛に値する',
	'世界に通用する',
	'つまようじに匹敵する',
	'一世を風靡した',
	'流行りの',
	'ビジネスシーンを演出する',
	'8カラットの',
	'中古の',
	'新品の',
	'愛妻',
	'ブランドものの',
	'忘らるる',
	'指数関数的勢いで増殖する',
	'ぷるぷる',
	'ぐにゃぐにゃ',
	'多目的',
	'いい感じ™の',
	'激辛',
	'先進的な',
	'レトロな',
	'ヴィンテージ',
	'100日後に何らかが起きる',
	'合法',
	'プレミア付き',
	'デカ',
	'ギガ',
	'穢れた',
	'加護を受けた',
	'品質保証付き',
	'AppleCare+加入済み',
	'えっちな',
	'純粋な',
	'構造上の欠陥がある',
	'デザイナーズ',
	'蠱惑的な',
	'概念としての',
	'霊験灼かな',
	'御利益がありそうな',
	'つやつや',
	'べとべと',
	'ムキムキの',
	'オーバークロックされた',
	'リミッター解除された',
	'無機質な',
	'前衛的な',
	'会社から支給された',
	'担保としての',
	'経費で落ちる',
	'真贋が定かでない',
	'肥えた',
	'怪しい',
	'妖しい',
	'攻撃的な',
	'現存する最古の',
	'考古学的価値がある',
	'官能的な',
	'備え付けの',
	'カビの生えた',
	'丹念に熟成された',
	'アルミダイキャスト',
	'畏怖の念を抱く',
	'養殖',
	'やばい',
	'すごい',
	'かわいい',
	'デジタル',
	'アナログ',
	'考察の対象となり得る',
	'値切る余地がありそうな',
	'彁な',
	'キミの',
	'あなただけの',
	'ゴキゲンな',
	'この文が真なら、',
	'電動',
	'当たり判定のない',
	'めり込んだ',
	'100年に一度の',
];

export const items = [
	'ナス',
	'トマト',
	'きゅうり',
	'じゃがいも',
	'焼きビーフン',
	'腰',
	'寿司',
	'かぼちゃ',
	'諭吉',
	'キロバー',
	'アルミニウム',
	'ナトリウム',
	'マグネシウム',
	'プルトニウム',
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
	'レイヤ4スイッチ',
	'緩衝チェーン',
	'陽電子頭脳',
	'惑星',
	'テルミン',
	'虫歯車',
	'マウンター',
	'バケットホイールエクスカベーター',
	'デーモンコア',
	'ゲームボーイアドバンス',
	'量子コンピューター',
	'アナモルフィックレンズ',
	'押し入れの奥から出てきた謎の生き物',
	'スマートフォン',
	'時計',
	'プリン',
	'ガブリエルのラッパ',
	'メンガーのスポンジ',
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
	'SDカード',
	'リップクリーム',
	'チョコ無しチョココロネ',
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
	'中性子星',
	'液体',
	'衛星',
	'ズッキーニ',
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
	'尿路結石',
	'エンターキー',
	'壺',
	'水銀',
	'DHMO',
	'水',
	'土地',
	'大陸',
	'サイコロ',
	'室外機',
	'油圧ジャッキ',
	'タピオカ',
	'トイレットペーパーの芯',
	'ダンボール箱',
	'ハニワ',
	'ボールペン',
	'シャーペン',
	'原子',
	'宇宙',
	'素粒子',
	'ごま油',
	'卵かけご飯',
	'ダークマター',
	'ブラックホール',
	'太陽',
	'石英ガラス',
	'ダム',
	'ウイルス',
	'細菌',
	'アーチ式コンクリートダム',
	'重力式コンクリートダム',
	'フラッシュバルブ',
	'ヴィブラスラップ',
	'オブジェ',
	'原子力発電所',
	'原子炉',
	'エラトステネスの篩',
	'ブラウン管',
	'タキオン',
	'ラッセルのティーポット',
	'電子機器',
	'TNT',
	'ポリゴン',
	'空気',
	'RTX 3090',
	'シャーペンの芯',
	'ロゼッタストーン',
	'CapsLockキー',
	'虚無',
	'UFO',
	'NumLockキー',
	'放射性廃棄物',
	'火星',
	'ウラン',
	'遠心分離機',
	'undefined',
	'null',
	'NaN',
	'[object Object]',
	'ゼロ幅スペース',
	'全角スペース',
	'太鼓',
	'石像',
	'スライム',
	'点P',
	'🤯',
	'きんのたま',
	'フロッピーディスク',
	'掛け軸',
	'JavaScriptコンソール',
	'インターネットエクスプローラー',
	'潜水艦発射弾道ミサイル',
	'ミトコンドリア',
	'ヘリウム',
	'タンパク質',
	'カプサイシン',
	'エスカレーター',
	'核融合炉',
	'地熱発電所',
	'マンション',
	'ラバライト',
	'ガリレオ温度計',
	'ラジオメーター',
	'サンドピクチャー',
	'ストームグラス',
	'ニュートンクレードル',
	'永久機関',
	'柿の種のピーナッツ部分',
	'伝票入れる筒状のアレ',
	'布団',
	'寝具',
	'偶像',
	'森羅万象',
	'卒塔婆',
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
	'404 Not Found',
	'JSON',
	'タペストリー',
	'本',
	'石像',
	'古文書',
	'巻物',
	'Misskey',
	'もぎもぎフルーツ',
	'<ここに任意の文字列>',
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
];

export const and = [
	'に擬態した',
	'入りの',
	'が埋め込まれた',
	'を連想させる',
	'っぽい',
	'に見せかけて',
	'を虐げる',
	'を侍らせた',
	'が上に乗った',
	'のそばにある',
];

export function genItem(seedOrRng?: (() => number) | string | number) {
	const rng = seedOrRng
		? typeof seedOrRng === 'function'
			? seedOrRng
			: seedrandom(seedOrRng.toString())
		: Math.random;

	let item = '';
	if (Math.floor(rng() * 5) !== 0) item += itemPrefixes[Math.floor(rng() * itemPrefixes.length)];
	item += items[Math.floor(rng() * items.length)];
	if (Math.floor(rng() * 10) === 0) {
		item += and[Math.floor(rng() * and.length)];
		if (Math.floor(rng() * 5) !== 0) item += itemPrefixes[Math.floor(rng() * itemPrefixes.length)];
		item += items[Math.floor(rng() * items.length)];
	}
	return item;
}

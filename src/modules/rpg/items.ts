type Item = {
    name: string;
    /** 種類 */
    type: "weapon" | "armor" | "medicine" | "poison";
    /** 使用した際の効果量（物理） */
    effect: number;
    /** 使用した際の効果量（精神） */
    mind: number;
}

export const rpgItems: Item[] = [
    { name: "消える原子", type: "poison", effect: 5, mind: -10 },
    { name: "いにしえのチョコボ", type: "armor", effect: 70, mind: 60 },
    { name: "生のじゃがいも", type: "poison", effect: 70, mind: -70 },
    { name: "合法のペットボトルのキャップ", type: "weapon", effect: 10, mind: 5 },
    { name: "かわいいメガネ", type: "armor", effect: 40, mind: 70 },
    { name: "カビの生えたポップアップ広告", type: "poison", effect: 90, mind: -90 },
    { name: "デジタルブルーレイディスク", type: "weapon", effect: 30, mind: 5 },
    { name: "プレミア付き石像", type: "armor", effect: 80, mind: 40 },
    { name: "異世界のメビウスの輪", type: "weapon", effect: 70, mind: 50 },
    { name: "滅びのもぎもぎフルーツ", type: "poison", effect: 100, mind: -100 },
    { name: "等速直線運動する遠心分離機かつ焦げたちいさなメダル", type: "armor", effect: 30, mind: -10 },
    { name: "最強の消しゴム", type: "weapon", effect: 20, mind: 0 },
    { name: "ネザライトのメビウスの輪", type: "weapon", effect: 90, mind: 80 },
    { name: "耐火3getロボ", type: "armor", effect: 85, mind: 40 },
    { name: "もちもちラジオメーター", type: "armor", effect: 30, mind: 20 },
    { name: "幸運のエンチャントが付与された腰", type: "armor", effect: 60, mind: 90 },
    { name: "電動裁判所", type: "weapon", effect: 50, mind: -10 },
    { name: "ラスボスの本", type: "weapon", effect: 80, mind: 70 },
    { name: "ダイアモンドの[R]で所持金MAX の秘技コード", type: "weapon", effect: 95, mind: 90 },
    { name: "遺伝子組み換え炭水化物", type: "poison", effect: 10, mind: -40 },
    { name: "かわいい原子力発電所", type: "armor", effect: 70, mind: 60 },
    { name: "中古の愛", type: "poison", effect: 50, mind: -100 },
    { name: "チョコレートコーティング太陽", type: "weapon", effect: 85, mind: 70 },
    { name: "食用電子機器", type: "poison", effect: 10, mind: -70 },
    { name: "アルミホイルのラッピー", type: "weapon", effect: 35, mind: 0 },
    { name: "手作りブラックホール", type: "weapon", effect: 100, mind: 100 },
    { name: "鉄のバカデカメダル", type: "armor", effect: 90, mind: 50 },
    { name: "川を流れるカバのツルハシ", type: "weapon", effect: 60, mind: 20 },
    { name: "ピンクのチョコレート", type: "medicine", effect: 20, mind: -20 },
    { name: "ハート型のタコの足", type: "poison", effect: 55, mind: -40 },
    { name: "800kgくらいあるリップクリーム", type: "armor", effect: 20, mind: -20 },
    { name: "デジタルSSD", type: "weapon", effect: 25, mind: 0 },
    { name: "【令和最新版】水銀", type: "poison", effect: 100, mind: -80 },
    { name: "ココイチのカード状のもの", type: "medicine", effect: 20, mind: 15 },
    { name: "高度に訓練された水", type: "medicine", effect: 85, mind: 40 },
    { name: "時空を歪めるつまようじ", type: "weapon", effect: 75, mind: 70 },
    { name: "プラズマ化したなめこ", type: "poison", effect: 50, mind: -50 },
    { name: "ギガズッキーニ", type: "weapon", effect: 40, mind: 10 },
    { name: "リップクリームを虐げる群生するタコの足", type: "weapon", effect: 45, mind: -10 },
    { name: "次世代核融合炉", type: "armor", effect: 90, mind: 70 },
    { name: "燃え盛るDVD", type: "weapon", effect: 85, mind: 50 },
    { name: "小さな空気", type: "armor", effect: 10, mind: -10 },
    { name: "分散型オリハルコン", type: "armor", effect: 75, mind: 50 },
    { name: "無機質なボールペン", type: "weapon", effect: 35, mind: -5 },
    { name: "4次元四天王メンサの時計じかけの全知全能", type: "weapon", effect: 90, mind: 90 },
    { name: "粗挽き🤯", type: "poison", effect: 70, mind: -50 },
    { name: "ぐにゃぐにゃちいさなメダル", type: "armor", effect: 15, mind: -5 },
    { name: "折り畳み式サンドピクチャー", type: "armor", effect: 40, mind: 30 },
    { name: "時計じかけの空き缶", type: "weapon", effect: 20, mind: 5 },
    { name: "中古のフロッピーディスク", type: "weapon", effect: 10, mind: -10 },
    { name: "銅のCalckey", type: "weapon", effect: 30, mind: 5 },
    { name: "熟成月の石", type: "armor", effect: 65, mind: 40 },
    { name: "800kgくらいある全知全能", type: "armor", effect: 100, mind: 50 },
    { name: "毒のブラウン管", type: "poison", effect: 100, mind: -100 },
    { name: "アナログ火星", type: "weapon", effect: 65, mind: 20 },
    { name: "前衛的なTNT", type: "weapon", effect: 80, mind: 60 },
    { name: "べとべとティラノサウルス", type: "weapon", effect: 60, mind: -10 },
    { name: "ラスボスの曲", type: "weapon", effect: 75, mind: 50 },
    { name: "新品の焼きビーフン", type: "medicine", effect: 70, mind: 70 },
    { name: "カビの生えたつるぎまたは増殖する彁", type: "poison", effect: 45, mind: -40 },
    { name: "ほとんど違法のNumLockキー", type: "weapon", effect: 70, mind: 0 },
    { name: "一番いいテレホンカード", type: "armor", effect: 60, mind: 30 },
    { name: "反重力農産物", type: "medicine", effect: 30, mind: -30 },
    { name: "ウイルスに擬態した消えるGOOD判定", type: "poison", effect: 80, mind: -70 },
    { name: "えっちな寿司", type: "poison", effect: 75, mind: -30 },
    { name: "レトロなクッキー", type: "medicine", effect: 30, mind: 30 },
    { name: "幸運のエンチャントが付与された換気扇", type: "armor", effect: 65, mind: 40 },
    { name: "カスのアップデート", type: "poison", effect: 70, mind: -50 },
    { name: "原子炉キーの人類の技術を結集して作ったPUC", type: "weapon", effect: 95, mind: 80 },
    { name: "コンソメのカンピロバクター", type: "poison", effect: 100, mind: -80 },
    { name: "多目的リグレットカー", type: "armor", effect: 50, mind: 20 },
    { name: "禁断のカタコト脳筋", type: "weapon", effect: 100, mind: -50 },
    { name: "プラズマ化した電子機器", type: "poison", effect: 100, mind: -100 },
    { name: "高圧市営バス", type: "armor", effect: 85, mind: 40 },
    { name: "宇宙古文書", type: "armor", effect: 60, mind: 30 },
    { name: "時計じかけの全部っぽい異臭を放つ個人差譜面", type: "weapon", effect: 70, mind: -50 },
    { name: "夢の地熱発電所", type: "armor", effect: 75, mind: 60 },
    { name: "猛一部キー", type: "weapon", effect: 55, mind: 30 },
    { name: "もこもこしたポケベル", type: "armor", effect: 20, mind: 20 },
    { name: "確変四天王", type: "weapon", effect: 75, mind: 40 },
    { name: "人類の技術を結集して作ったオレンジ", type: "medicine", effect: 100, mind: 100 },
    { name: "異常麺無しラーメン", type: "poison", effect: 50, mind: -40 },
    { name: "業務用の泣き虫ゼミ", type: "armor", effect: 45, mind: 15 },
    { name: "ダンジョン最深部で見つかったチョコ無しチョココロネ", type: "medicine", effect: 45, mind: 20 },
    { name: "アルミホイルの自動販売機", type: "weapon", effect: 35, mind: 5 },
    { name: "食用古文書", type: "medicine", effect: 20, mind: 10 },
    { name: "the Heavens 原子炉", type: "armor", effect: 90, mind: 80 },
    { name: "決戦のシャーペンの芯", type: "weapon", effect: 60, mind: 40 },
    { name: "伝票入れる筒状のアレを侍らせた一番いいお嬢様キー", type: "armor", effect: 70, mind: 60 },
    { name: "ぐにゃぐにゃツルハシ", type: "weapon", effect: 40, mind: 10 },
    { name: "暗黒の細菌", type: "poison", effect: 85, mind: -70 },
    { name: "ダークマターに擬態した増殖するタスクマネージャー", type: "poison", effect: 100, mind: -100 },
    { name: "最弱の気体", type: "armor", effect: 5, mind: 5 },
    { name: "つやつや割りばし", type: "weapon", effect: 20, mind: 0 },
    { name: "めり込んだエナジードリンク", type: "medicine", effect: 75, mind: 60 },
    { name: "ブランドものの虚無", type: "poison", effect: 10, mind: -40 },
    { name: "激辛全部", type: "poison", effect: 60, mind: -50 },
    { name: "2019年製液体", type: "poison", effect: 50, mind: -40 },
    { name: "燃え盛るアルミホイル系お嬢様", type: "weapon", effect: 85, mind: 60 },
    { name: "いにしえのペットボトル", type: "armor", effect: 40, mind: 20 },
    { name: "やばいGTX 380", type: "weapon", effect: 90, mind: 80 },
    { name: "電動オレンジ", type: "weapon", effect: 45, mind: 10 },
    { name: "3getした掛け軸", type: "armor", effect: 55, mind: 20 },
    { name: "土木学会田中賞を受賞した繝九Λ縺ｮ縺ｿ縺晄ｱ", type: "armor", effect: 80, mind: 70 },
    { name: "かわいいチョコ無しチョココロネ", type: "medicine", effect: 60, mind: 100 },
    { name: "100年に一度のゴルベーザ", type: "armor", effect: 70, mind: 60 },
    { name: "確変粒子加速器", type: "weapon", effect: 85, mind: 70 },
    { name: "破壊済みの全知全能", type: "armor", effect: 30, mind: -10 },
    { name: "つまようじに見せかけてえっちな水", type: "poison", effect: 20, mind: -60 },
    { name: "川を流れるカバのキーホルダー", type: "armor", effect: 35, mind: 15 },
    { name: "100均のRTX 6060", type: "weapon", effect: 40, mind: -5 },
    { name: "ヴィンテージ森羅万象", type: "armor", effect: 65, mind: 50 },
    { name: "800kgくらいあるメガネ", type: "armor", effect: 25, mind: -10 },
    { name: "チョコレートコーティング星のカービー", type: "medicine", effect: 80, mind: 30 },
    { name: "もこチキ謹製犯罪譜面", type: "weapon", effect: 90, mind: -70 },
    { name: "粗挽き全白皆伝", type: "weapon", effect: 70, mind: 40 },
    { name: "燃え盛る火星", type: "weapon", effect: 85, mind: 60 },
    { name: "最弱の化石", type: "armor", effect: 10, mind: -5 },
    { name: "焦げた3getロボ", type: "armor", effect: 45, mind: -20 },
    { name: "古代の原子力発電所", type: "armor", effect: 85, mind: 60 },
    { name: "強欲な閉じ忘れられた鉤括弧の片割れ", type: "weapon", effect: 55, mind: 0 },
    { name: "ムキムキピカグレ判定", type: "armor", effect: 60, mind: 50 },
    { name: "ゴルベーザオレオォ？", type: "poison", effect: 25, mind: -40 },
    { name: "アルミホイルのフロッピーディスク", type: "weapon", effect: 20, mind: 0 },
    { name: "真の物体", type: "armor", effect: 50, mind: 40 },
    { name: "束縛の呪いのエンチャントが付与された正十二面体", type: "armor", effect: 65, mind: 40 },
    { name: "えっちなオレオ", type: "poison", effect: 40, mind: -80 },
    { name: "凍った絵文字", type: "armor", effect: 40, mind: 20 },
    { name: "卵かけ因数分解", type: "medicine", effect: 25, mind: -20 },
    { name: "カスの農産物", type: "poison", effect: 25, mind: -20 },
    { name: "地獄の掛け軸", type: "armor", effect: 50, mind: -10 },
    { name: "デザイナーズiPodShuffle", type: "weapon", effect: 45, mind: 10 },
    { name: "賞味期限切れ牛乳パック", type: "poison", effect: 80, mind: -60 },
    { name: "耐火液体", type: "armor", effect: 75, mind: 60 },
    { name: "カビの生えた爪切り", type: "weapon", effect: 20, mind: -20 },
    { name: "帯電金髪碧眼の美少女", type: "armor", effect: 85, mind: 70 },
    { name: "弓に擬態した強欲なiPodShuffle", type: "weapon", effect: 60, mind: 20 },
    { name: "あつあつヘリウム", type: "poison", effect: 40, mind: -70 },
    { name: "the Alpha 爪切り", type: "weapon", effect: 40, mind: 5 },
    { name: "異音がする健康保険証", type: "armor", effect: 30, mind: -20 },
    { name: "もこチキ型の鉛筆を虐げる群生する有象無象", type: "weapon", effect: 55, mind: 10 },
    { name: "当たり判定のないタンパク質", type: "poison", effect: 10, mind: -10 },
    { name: "2019年製腰", type: "armor", effect: 40, mind: 20 },
    { name: "陽電子粒子加速器", type: "weapon", effect: 85, mind: 70 },
    { name: "デザイナーズ森羅万象", type: "armor", effect: 65, mind: 60 },
    { name: "うますぎないつまようじ", type: "poison", effect: 60, mind: -40 },
    { name: "5日前の放射性廃棄物", type: "poison", effect: 100, mind: -90 },
    { name: "猛チョコレート", type: "medicine", effect: 80, mind: 70 },
    { name: "つやつやヘドロ", type: "poison", effect: 70, mind: -50 },
    { name: "卵かけ火星", type: "medicine", effect: 35, mind: 20 },
    { name: "4次元テレホンカード", type: "armor", effect: 60, mind: 40 },
    { name: "シュレディンガーのお嬢様キー", type: "armor", effect: 65, mind: 40 },
    { name: "最新式のTNT", type: "weapon", effect: 80, mind: 70 },
    { name: "謎の個人差譜面", type: "weapon", effect: 75, mind: -50 },
    { name: "プラチナの特異点", type: "weapon", effect: 70, mind: 50 },
    { name: "黄色のクリーム無しクリームパン", type: "poison", effect: 30, mind: -30 },
    { name: "無印の犯罪譜面", type: "weapon", effect: 70, mind: -50 },
    { name: "原子力パン無し食パン", type: "poison", effect: 85, mind: -60 },
    { name: "あすけんの女を黙らせられるクッキーキーの解き放たれし水", type: "medicine", effect: 90, mind: 80 },
    { name: "ゴルベーザ個人差譜面", type: "weapon", effect: 75, mind: -40 },
    { name: "束縛の呪いのエンチャントが付与されたマウスカーソル", type: "armor", effect: 55, mind: 20 },
    { name: "冷やしビーフジャーキー", type: "medicine", effect: 60, mind: 60 },
    { name: "ズゥキニーに擬態したティラノサウルス", type: "weapon", effect: 85, mind: 70 },
    { name: "消える絵文字", type: "armor", effect: 10, mind: 10 },
    { name: "存在しないダークマター", type: "armor", effect: 40, mind: -10 },
    { name: "ゴルベーザもこきー", type: "armor", effect: 65, mind: 50 },
    { name: "やわらかいダム", type: "armor", effect: 40, mind: -10 },
    { name: "かわいいズッキーニ", type: "medicine", effect: 60, mind: 70 },
    { name: "先進的なもこもこチキン", type: "medicine", effect: 70, mind: 60 },
    { name: "無限のエンチャントが付与された卵かけご飯", type: "medicine", effect: 100, mind: 100 },
    { name: "エンターキーメンサの最強の原子", type: "weapon", effect: 95, mind: 80 },
    { name: "カビの生えたカレー無しカレーパン", type: "poison", effect: 50, mind: -40 },
    { name: "再帰的一部キー", type: "armor", effect: 50, mind: 20 },
    { name: "透明なもこもこ", type: "armor", effect: 15, mind: 15 },
    { name: "燃え盛るサイコロ", type: "weapon", effect: 75, mind: 70 },
    { name: "ぐにゃぐにゃC18H27NO3", type: "weapon", effect: 30, mind: -20 },
    { name: "カスの閉じ忘れられた鉤括弧の片割れ", type: "weapon", effect: 50, mind: 20 },
    { name: "異星の空き缶", type: "weapon", effect: 30, mind: 10 },
    { name: "the Ultimate 白いもの", type: "armor", effect: 70, mind: 50 },
    { name: "もこチキ謹製エキノコックス", type: "poison", effect: 90, mind: -80 },
    { name: "2032年製オノ", type: "weapon", effect: 70, mind: 50 },
    { name: "the Alpha タンパク質", type: "medicine", effect: 100, mind: 50 },
    { name: "木の森羅万象", type: "armor", effect: 60, mind: 40 },
    { name: "謎のズッキーニ", type: "medicine", effect: 55, mind: 50 },
    { name: "毒の壺", type: "weapon", effect: 85, mind: -60 },
    { name: "放射性曲", type: "weapon", effect: 75, mind: -50 },
    { name: "もこもこしたペットボトル", type: "armor", effect: 40, mind: 20 },
    { name: "個人差譜面メンサのアナログポップアップ広告", type: "weapon", effect: 70, mind: -40 },
    { name: "チョコレートまたは【令和最新版】もこもこ", type: "medicine", effect: 65, mind: 50 },
    { name: "愛妻ハンドスピナー", type: "armor", effect: 45, mind: 30 },
    { name: "束縛の呪いのエンチャントが付与された有象無象", type: "armor", effect: 60, mind: 40 },
    { name: "もこチキ型の黄グレ判定", type: "armor", effect: 55, mind: 35 },
    { name: "謎のもぎもぎフルーツ", type: "medicine", effect: 25, mind: -40 },
    { name: "ときどき分裂するNumLockキー", type: "armor", effect: 50, mind: 20 },
    { name: "オーバークロックされた遠心分離機", type: "weapon", effect: 70, mind: 40 },
    { name: "バグったソフラン譜面", type: "weapon", effect: 80, mind: -50 },
    { name: "サンドピクチャーっぽい再帰的トマト", type: "medicine", effect: 70, mind: 35 },
    { name: "前衛的な🤯", type: "weapon", effect: 65, mind: 30 },
    { name: "すごいゲームボーイアドバンス", type: "armor", effect: 50, mind: 35 },
    { name: "やわらかいちいさなメダル", type: "armor", effect: 15, mind: 10 },
    { name: "地獄から来た重いもの", type: "weapon", effect: 75, mind: 60 },
    { name: "ポケットサイズノートパソコン", type: "armor", effect: 30, mind: 25 },
    { name: "超最高スーパーHAPPYクッキー", type: "medicine", effect: 100, mind: 100 },
    { name: "高反発クワ", type: "weapon", effect: 75, mind: 55 },
    { name: "携帯型鬮", type: "weapon", effect: 50, mind: 30 },
    { name: "ぷるぷるごま油", type: "medicine", effect: 10, mind: -40 },
    { name: "土木学会田中賞を受賞した押し入れの奥から出てきた謎の生き物", type: "armor", effect: 60, mind: -30 },
    { name: "ときどき分裂するビーフジャーキー", type: "medicine", effect: 65, mind: 10 },
    { name: "水中歩行のエンチャントが付与された核融合炉", type: "armor", effect: 90, mind: 80 },
    { name: "アナログ蛇口", type: "weapon", effect: 40, mind: 20 },
    { name: "ナノサイズ金髪碧眼の美少女", type: "armor", effect: 85, mind: 70 },
    { name: "ズッキーニに擬態した原子", type: "weapon", effect: 55, mind: 30 },
    { name: "国宝級核融合炉", type: "armor", effect: 90, mind: 80 },
    { name: "NumLockキーまたは異世界のナトリウム", type: "weapon", effect: 65, mind: 40 },
    { name: "【令和最新版】本", type: "weapon", effect: 60, mind: 30 },
    { name: "時計じかけの四角いもの", type: "weapon", effect: 45, mind: 10 },
    { name: "摩擦係数0のヘドロ", type: "poison", effect: 80, mind: -60 },
    { name: "うますぎないカレー無しカレーパン", type: "medicine", effect: 20, mind: 20 },
    { name: "無機質な永久機関", type: "armor", effect: 75, mind: 50 },
    { name: "人類の技術を結集して作ったかぼちゃ", type: "medicine", effect: 100, mind: 100 },
    { name: "エナジードリンクに見せかけて摩擦係数0の国民の基本的な権利", type: "poison", effect: 90, mind: -80 },
    { name: "極じゃがいも", type: "weapon", effect: 50, mind: 20 },
    { name: "決戦の丸いもの", type: "weapon", effect: 70, mind: 50 },
    { name: "カビの生えた壺", type: "weapon", effect: 65, mind: -20 },
    { name: "ト音記号に擬態したあつあつ四角いもの", type: "weapon", effect: 65, mind: 30 },
    { name: "帯電二郎行きたい", type: "weapon", effect: 75, mind: 40 },
    { name: "放射性アーチ式コンクリートダム", type: "armor", effect: 80, mind: 60 },
    { name: "人類の技術を結集して作ったペットボトルのキャップ", type: "weapon", effect: 30, mind: 15 },
    { name: "古代のブラウン管", type: "weapon", effect: 55, mind: 20 },
    { name: "欲しくなってきたな、メイド服", type: "armor", effect: 70, mind: 90 },
    { name: "異音がするマンホールの蓋", type: "weapon", effect: 45, mind: -20 },
    { name: "布団入りのトップバリュブランドのRTX 9080", type: "armor", effect: 85, mind: 60 },
    { name: "合法のストームグラスに擬態した四角い丸いもの", type: "weapon", effect: 50, mind: 10 },
    { name: "超黒いもの", type: "weapon", effect: 70, mind: 40 },
    { name: "ネザライトのサッカー部キー", type: "weapon", effect: 75, mind: 50 },
    { name: "ネザライトのメガネ", type: "armor", effect: 65, mind: 50 },
    { name: "カスの🤔", type: "weapon", effect: 30, mind: -10 },
    { name: "抗菌仕様トイレットペーパーの芯", type: "armor", effect: 40, mind: 20 },
    { name: "養殖衛星", type: "armor", effect: 70, mind: 50 },
    { name: "ダブルアックスオレンジ", type: "weapon", effect: 60, mind: 30 },
    { name: "甘すぎるタピオカ", type: "medicine", effect: 30, mind: -30 },
    { name: "彁なつまようじ", type: "weapon", effect: 55, mind: 20 },
    { name: "2015年製爪切り", type: "weapon", effect: 40, mind: 0 },
    { name: "軍手を虐げる等速直線運動する特異点", type: "weapon", effect: 70, mind: 10 },
    { name: "ハイリアのリップクリームかつ等速直線運動する愛", type: "armor", effect: 75, mind: 50 },
    { name: "やばいバトルフィールドまたはココイチの剣", type: "weapon", effect: 80, mind: 40 },
    { name: "ナノサイズきのこ", type: "medicine", effect: 1, mind: 1 },
    { name: "いい感じ™の百天王", type: "weapon", effect: 85, mind: 60 },
    { name: "真イキイキゼミ", type: "armor", effect: 60, mind: 40 },
    { name: "腐った3getロボ", type: "armor", effect: 30, mind: -30 },
    { name: "霧散するクリーム無しクリームパン", type: "medicine", effect: 20, mind: -20 },
    { name: "蠢くリグレットカー", type: "armor", effect: 45, mind: -20 },
    { name: "水中歩行のエンチャントが付与された点P", type: "armor", effect: 65, mind: 40 },
    { name: "ラスボスの耳かき", type: "weapon", effect: 70, mind: 50 },
    { name: "夏の日の全部以外", type: "weapon", effect: 30, mind: 20 },
    { name: "ときどき分裂するあああああ", type: "weapon", effect: 10, mind: -50 },
    { name: "ニンニクマシ原子力発電所っぽいよりよいバカデカメダル", type: "armor", effect: 85, mind: 70 },
    { name: "嘘のウラン", type: "weapon", effect: 60, mind: -60 },
    { name: "よりよい全部", type: "weapon", effect: 50, mind: 30 },
    { name: "流行りの俺", type: "armor", effect: 40, mind: 50 },
    { name: "全権大使のPCカード", type: "weapon", effect: 20, mind: 10 },
    { name: "滅びの液体", type: "poison", effect: 100, mind: -80 },
    { name: "道端に落ちているペットボトル", type: "weapon", effect: 5, mind: -10 },
    { name: "分散型軍手", type: "armor", effect: 15, mind: -30 },
    { name: "巨大PUC", type: "armor", effect: 90, mind: 60 },
    { name: "燃え盛る反物質コンデンサ", type: "weapon", effect: 85, mind: 50 },
    { name: "摩擦係数0のスコップ", type: "weapon", effect: 20, mind: 10 },
    { name: "1000kgくらいあるRTX 4070", type: "weapon", effect: 90, mind: 70 },
    { name: "限界突破を虐げる消滅の呪いのエンチャントが付与されたサッカー部キー", type: "weapon", effect: 75, mind: 40 },
    { name: "オーバークロックされた空気", type: "weapon", effect: 10, mind: -40 },
    { name: "暗黒の空き缶", type: "weapon", effect: 20, mind: -50 },
    { name: "うますぎないキー", type: "weapon", effect: 30, mind: -20 },
    { name: "透明な彁", type: "weapon", effect: 15, mind: -30 },
    { name: "湿気った素数", type: "weapon", effect: 10, mind: -40 },
    { name: "極重力式コンクリートダム", type: "armor", effect: 100, mind: 80 },
    { name: "異臭を放つ石像", type: "armor", effect: 5, mind: -70 },
    { name: "ソフラン譜面に見せかけて養殖1円玉", type: "weapon", effect: 5, mind: -30 },
    { name: "オレオメンサの摩擦係数0の火星", type: "weapon", effect: 60, mind: 30 },
    { name: "カレー無しカレーパンまたは幻の食パンの耳47年分", type: "medicine", effect: 47, mind: 47 },
    { name: "原子に擬態した彁なあすけんの女", type: "weapon", effect: 70, mind: 20 },
    { name: "消える初代譜面", type: "weapon", effect: 50, mind: -60 },
    { name: "人工タペストリー", type: "armor", effect: 30, mind: 20 },
    { name: "真のハンドスピナー", type: "weapon", effect: 60, mind: 50 },
    { name: "ピンクのズッキーニ", type: "medicine", effect: 80, mind: 30 },
    { name: "高反発ゼロ幅スペース", type: "weapon", effect: 40, mind: 20 },
    { name: "ギガデータセーバー", type: "weapon", effect: 75, mind: 60 },
    { name: "9999年製キー", type: "weapon", effect: 70, mind: 50 },
    { name: "オレンジの🤔", type: "weapon", effect: 20, mind: 10 },
    { name: "遺伝子組み換えでないボールペン", type: "weapon", effect: 10, mind: 5 },
    { name: "2033年製ダム", type: "armor", effect: 90, mind: 70 },
    { name: "高反発押し入れの奥から出てきた謎の生き物", type: "armor", effect: 20, mind: -50 },
    { name: "飛行能力を獲得したヘリウム", type: "armor", effect: 60, mind: 40 },
    { name: "シルクタッチのエンチャントが付与されたオレオ", type: "medicine", effect: 75, mind: 50 },
    { name: "再帰的マグネシウム", type: "weapon", effect: 50, mind: 30 },
    { name: "ゴルベーザ四角いもの", type: "weapon", effect: 55, mind: 40 },
    { name: "彁なポータル", type: "weapon", effect: 65, mind: 30 },
    { name: "禁断の人生", type: "weapon", effect: 75, mind: 10 },
    { name: "時空を歪める市営バス", type: "armor", effect: 100, mind: 70 },
    { name: "無機質な空気", type: "weapon", effect: 5, mind: -30 },
    { name: "嘘のこたつ", type: "weapon", effect: 10, mind: -40 },
    { name: "木のラジオメーター", type: "weapon", effect: 25, mind: 15 },
    { name: "ウランメンサのハート型の建築物", type: "armor", effect: 80, mind: 60 },
    { name: "凍った棒状のもの", type: "weapon", effect: 20, mind: -50 },
    { name: "プリンに擬態した次世代[R]で所持金MAX の秘技コード", type: "weapon", effect: 90, mind: 70 },
    { name: "帯電C18H27NO3", type: "weapon", effect: 70, mind: 50 },
    { name: "嘘のソフラン譜面", type: "weapon", effect: 20, mind: -70 },
    { name: "燃え盛るフロッピーディスク", type: "weapon", effect: 85, mind: 30 },
    { name: "折り畳み式限界突破", type: "armor", effect: 100, mind: 80 },
    { name: "甘すぎるパンチ", type: "weapon", effect: 1, mind: -60 },
    { name: "無印の金髪碧眼の美少女", type: "armor", effect: 90, mind: 100 },
    { name: "人工知能搭載鬮", type: "weapon", effect: 70, mind: 50 },
    { name: "決戦のコログ", type: "weapon", effect: 75, mind: 40 },
    { name: "消滅の呪いのエンチャントが付与されたGTX 760", type: "weapon", effect: 90, mind: 20 },
    { name: "無限のエンチャントが付与された1円玉", type: "weapon", effect: 10, mind: 10 },
    { name: "道端に落ちている素数", type: "weapon", effect: 5, mind: -90 },
    { name: "宇宙地熱発電所", type: "armor", effect: 100, mind: 90 },
    { name: "焦げたコログ", type: "weapon", effect: 60, mind: -70 },
    { name: "ジューシーな犯罪譜面入りの金のアルミホイル", type: "weapon", effect: 80, mind: -90 },
    { name: "デジタルラジオメーター", type: "weapon", effect: 20, mind: 20 },
    { name: "異音がするハニワ", type: "armor", effect: 10, mind: -50 },
    { name: "量子力学的石像", type: "armor", effect: 85, mind: 70 },
    { name: "真1円玉", type: "weapon", effect: 5, mind: 10 },
    { name: "Apple製フロッピーディスク", type: "weapon", effect: 70, mind: 20 },
    { name: "ピンクの原子力発電所", type: "armor", effect: 95, mind: 80 },
    { name: "オレンジのぬいぐるみ", type: "armor", effect: 20, mind: 40 },
    { name: "ポンコツのこの世の終わり", type: "weapon", effect: 85, mind: -100 },
    { name: "仮説上のイキイキゼミ", type: "armor", effect: 10, mind: 50 },
    { name: "コンソメのSDカード", type: "weapon", effect: 5, mind: 20 },
    { name: "ブランドものの全角スペース", type: "weapon", effect: 5, mind: 30 },
    { name: "クッキーに見せかけて天然ダークマター", type: "poison", effect: 100, mind: -100 },
    { name: "2027年製UFO", type: "armor", effect: 85, mind: 90 },
    { name: "チョコ入り狂う狂う狂うラップ", type: "poison", effect: 75, mind: -70 },
    { name: "獄凶悪残虐獰猛卑劣最悪永久機関", type: "armor", effect: 100, mind: -100 },
    { name: "使用済みオブジェ", type: "armor", effect: 5, mind: -60 },
    { name: "シルクタッチのエンチャントが付与されたDVD", type: "weapon", effect: 70, mind: 40 },
    { name: "人工ナス", type: "medicine", effect: 65, mind: 30 },
    { name: "油圧式ダム", type: "armor", effect: 90, mind: 80 },
    { name: "人工知能搭載反物質コンデンサ", type: "weapon", effect: 85, mind: 60 },
    { name: "封印されし時計", type: "weapon", effect: 55, mind: 10 },
    { name: "つやつや金髪碧眼の美少女", type: "armor", effect: 100, mind: 100 },
    { name: "呪われた卵かけご飯", type: "poison", effect: 50, mind: -50 },
    { name: "コンソメの押し入れの奥から出てきた謎の生き物", type: "armor", effect: 5, mind: -50 },
    { name: "チョコレートコーティング全白皆伝", type: "medicine", effect: 75, mind: 20 },
    { name: "異世界の森羅万象", type: "armor", effect: 80, mind: 70 },
    { name: "トップバリュブランドのミトコンドリア", type: "armor", effect: 5, mind: 50 },
    { name: "電動マッサージ機かつトップバリュブランドの5000兆円", type: "armor", effect: 85, mind: 70 },
    { name: "市販のMD", type: "weapon", effect: 5, mind: 10 },
    { name: "カビの生えた電動マッサージ機", type: "weapon", effect: 80, mind: -40 },
    { name: "ポンコツの赤いもの", type: "weapon", effect: 60, mind: -40 },
    { name: "デカマイクロプロセッサ(4コア8スレッド)", type: "weapon", effect: 75, mind: 50 },
    { name: "携帯型サッカー部キー", type: "weapon", effect: 65, mind: 30 },
    { name: "欲しくなってきたな、あすけんの女", type: "armor", effect: 70, mind: 80 },
    { name: "合法エナジードリンク", type: "medicine", effect: 100, mind: 100 },
    { name: "甘すぎないなめこ", type: "medicine", effect: 70, mind: 60 },
    { name: "初代譜面かつUSBコネクタ付きの核融合炉", type: "weapon", effect: 80, mind: 40 },
    { name: "めり込んだトイコンテンポラリー", type: "weapon", effect: 20, mind: -50 },
    { name: "束縛の呪いのエンチャントが付与されたタコの足", type: "weapon", effect: 70, mind: -70 },
    { name: "純金製猫", type: "armor", effect: 95, mind: 80 },
    { name: "壊れた地熱発電所", type: "armor", effect: 10, mind: -30 },
    { name: "偶像に見せかけて2getした🤯", type: "weapon", effect: 60, mind: 20 },
    { name: "油圧式C18H27NO3", type: "weapon", effect: 50, mind: 40 },
    { name: "超高校級の🤯", type: "weapon", effect: 75, mind: 50 },
    { name: "凍った裁判所", type: "armor", effect: 40, mind: -40 },
    { name: "仮説上のキロバー", type: "weapon", effect: 50, mind: 20 },
    { name: "いにしえのキーホルダー", type: "weapon", effect: 10, mind: -20 },
    { name: "ダイアモンドのポケベル", type: "weapon", effect: 70, mind: 60 },
    { name: "カスのパンチ", type: "weapon", effect: 15, mind: -50 },
    { name: "天然室外機", type: "weapon", effect: 30, mind: 10 },
    { name: "群生する軍手", type: "armor", effect: 15, mind: -40 },
    { name: "異星のインターネットエクスプローラー", type: "weapon", effect: 40, mind: -30 },
    { name: "ヴィンテージ壺", type: "armor", effect: 50, mind: 30 },
    { name: "死の🤯", type: "poison", effect: 95, mind: -90 },
    { name: "あすけんの女入りの彁なマスターソード", type: "weapon", effect: 80, mind: 50 },
    { name: "ときどき分裂する液体", type: "poison", effect: 100, mind: -80 },
    { name: "水中呼吸のエンチャントが付与された空気", type: "armor", effect: 10, mind: 10 },
    { name: "ぷるぷる犯罪譜面が上に乗った腐ったビーフジャーキー", type: "poison", effect: 85, mind: -70 },
    { name: "半分にカットされたオブジェ", type: "weapon", effect: 10, mind: -30 },
    { name: "時計じかけの掛け軸", type: "weapon", effect: 40, mind: 20 },
    { name: "呪われた地力譜面", type: "weapon", effect: 70, mind: -50 },
    { name: "デザイナーズ食パンの耳78年分", type: "medicine", effect: 78, mind: 20 },
    { name: "人工知能搭載もこきすと", type: "weapon", effect: 60, mind: 30 },
    { name: "人類の技術を結集して作った[L]長押しで浮遊 の秘技コード", type: "weapon", effect: 75, mind: 50 },
    { name: "普通の鳥インフルエンザ", type: "poison", effect: 90, mind: -80 },
    { name: "AppleCare+加入済みTNT", type: "weapon", effect: 85, mind: 60 },
    { name: "解き放たれしアーチ式コンクリートダム", type: "armor", effect: 100, mind: 90 },
    { name: "デジタル全部", type: "weapon", effect: 50, mind: 20 },
    { name: "ピンクの牛乳パック", type: "poison", effect: 80, mind: -70 },
    { name: "Apple製ツルハシ", type: "weapon", effect: 75, mind: 50 },
    { name: "ベタついてしゃーないタペストリー", type: "armor", effect: 20, mind: -60 },
    { name: "分散型かぼちゃ", type: "armor", effect: 15, mind: 10 },
    { name: "無機質なナス", type: "weapon", effect: 30, mind: -40 },
    { name: "インターネットエクスプローラーかつ禁断の惑星", type: "weapon", effect: 85, mind: -20 },
    { name: "シュレディンガーのタペストリー", type: "armor", effect: 25, mind: 15 },
    { name: "5日前の永久機関", type: "armor", effect: 5, mind: -80 },
    { name: "アルミホイルのインターネットエクスプローラー", type: "weapon", effect: 35, mind: -30 },
    { name: "蠢くポケベル", type: "weapon", effect: 50, mind: -20 },
    { name: "怪しいCapsLockキー", type: "weapon", effect: 25, mind: -50 },
    { name: "本を虐げるチョコレートコーティング偶像", type: "weapon", effect: 60, mind: 20 },
    { name: "2017年製[R]で所持金MAX の秘技コード", type: "weapon", effect: 70, mind: 30 },
    { name: "ときどき分裂する全部以外", type: "weapon", effect: 30, mind: -40 },
    { name: "携帯型歯磨き粉", type: "weapon", effect: 20, mind: 10 },
    { name: "ニンニクマシ素数", type: "weapon", effect: 40, mind: 10 },
    { name: "カビの生えたポリゴン", type: "weapon", effect: 15, mind: -60 },
    { name: "鉄のエキノコックス", type: "armor", effect: 5, mind: -70 },
    { name: "禁断のデータセーバー", type: "weapon", effect: 75, mind: -50 },
    { name: "デジタル太鼓", type: "weapon", effect: 55, mind: 20 },
    { name: "ギガフロッピーディスク", type: "weapon", effect: 85, mind: 50 },
    { name: "量子力学的爪切り", type: "weapon", effect: 40, mind: 30 },
    { name: "水没オレンジ", type: "poison", effect: 10, mind: -10 },
    { name: "衝撃を与えると低確率で爆発する正十二面体", type: "weapon", effect: 90, mind: 20 },
    { name: "群生する重いもの", type: "armor", effect: 75, mind: -40 },
    { name: "一番いいオレオ", type: "medicine", effect: 100, mind: 100 },
    { name: "もこチキ謹製:niwatori_kun:", type: "weapon", effect: 60, mind: 50 },
    { name: "ほとんど違法の市営バス", type: "armor", effect: 90, mind: -50 },
    { name: "バグった惑星", type: "armor", effect: 20, mind: -40 },
    { name: "ダブルアックス太鼓", type: "weapon", effect: 80, mind: 30 },
    { name: "オーダーメイドの剣", type: "weapon", effect: 85, mind: 60 },
    { name: "プラズマ化したマンション", type: "armor", effect: 95, mind: 70 },
    { name: "ハート型の全白皆伝", type: "armor", effect: 100, mind: 80 },
    { name: "束縛の呪いのエンチャントが付与されたメガネ", type: "armor", effect: 20, mind: -60 },
    { name: "束縛の呪いのエンチャントが付与されたマイクロプロセッサ(4コア8スレッド)", type: "weapon", effect: 90, mind: -50 },
    { name: "レトロな赤いもの", type: "weapon", effect: 40, mind: 20 },
    { name: "時計じかけのバトルフィールド", type: "armor", effect: 85, mind: 60 },
    { name: "電動メイド服", type: "armor", effect: 60, mind: 50 },
    { name: "ナノサイズ軍手キー", type: "weapon", effect: 5, mind: -40 },
    { name: "電子メビウスの輪", type: "weapon", effect: 70, mind: 30 },
    { name: "100均の石像", type: "armor", effect: 5, mind: -50 },
    { name: "人類の技術を結集して作った鉛筆", type: "weapon", effect: 20, mind: 10 },
    { name: "ギガ押し入れの奥から出てきた謎の生き物", type: "armor", effect: 10, mind: -70 },
    { name: "すごい農産物", type: "medicine", effect: 100, mind: 100 },
    { name: "ねばねば点P", type: "weapon", effect: 15, mind: -40 },
    { name: "カスのデータセーバー", type: "weapon", effect: 25, mind: -30 },
    { name: "異世界の釣り竿", type: "weapon", effect: 60, mind: 40 },
    { name: "陽電子缶チューハイ", type: "poison", effect: 35, mind: 20 },
    { name: "もこチキ型のPUC", type: "weapon", effect: 80, mind: 60 },
    { name: "次世代もぎもぎフルーツ", type: "medicine", effect: 50, mind: 50 },
    { name: "熟成伝票入れる筒状のアレ", type: "weapon", effect: 40, mind: 10 },
    { name: "消滅の呪いのエンチャントが付与されたブルーレイディスク", type: "weapon", effect: 85, mind: -50 },
    { name: "使用済み彁", type: "weapon", effect: 20, mind: -60 },
    { name: "ねばねばGTX 890", type: "weapon", effect: 70, mind: -40 },
    { name: "幻のチョコレート", type: "medicine", effect: 100, mind: 100 },
    { name: "無限のエンチャントが付与された物体", type: "weapon", effect: 90, mind: 50 },
    { name: "軽量全部キー", type: "weapon", effect: 30, mind: 10 },
    { name: "デジタルあすけんの女", type: "weapon", effect: 55, mind: 20 },
    { name: "解き放たれしズッキーニ", type: "weapon", effect: 40, mind: 15 },
    { name: "増殖するバトルフィールド", type: "armor", effect: 80, mind: 50 },
    { name: "the Heavens 全部以外", type: "weapon", effect: 85, mind: 70 },
    { name: "金のイキイキゼミ", type: "armor", effect: 95, mind: 80 },
    { name: "謎のCalckey", type: "weapon", effect: 35, mind: 20 },
    { name: "9999年製アップデート", type: "weapon", effect: 75, mind: 50 },
    { name: "謎のクリーム無しクリームパン", type: "poison", effect: 20, mind: -20 },
    { name: "賞味期限切れつるぎ", type: "weapon", effect: 15, mind: -80 },
    { name: "腐ったクワ", type: "weapon", effect: 10, mind: -70 },
    { name: "ズゥキニーに擬態した国民の基本的な権利", type: "armor", effect: 5, mind: -40 },
    { name: "猛オリハルコン", type: "weapon", effect: 95, mind: 70 },
    { name: "黄色の衛星入りの激腰", type: "armor", effect: 60, mind: -50 },
    { name: "巨大ト音記号", type: "weapon", effect: 85, mind: 60 },
    { name: "再帰的気体", type: "armor", effect: 10, mind: -30 },
    { name: "バグったチョコ無しチョココロネ", type: "poison", effect: 15, mind: -20 },
    { name: "時空を歪めるピカグレ判定", type: "weapon", effect: 80, mind: 40 },
    { name: "うますぎないごま油", type: "medicine", effect: 5, mind: 5 },
    { name: "異臭を放つHDD", type: "armor", effect: 15, mind: -80 },
    { name: "カスのエキノコックス", type: "poison", effect: 85, mind: -90 },
    { name: "USBコネクタ付きの白いもの", type: "weapon", effect: 30, mind: -20 },
    { name: "the Ultimate 点P", type: "weapon", effect: 90, mind: 70 },
    { name: "ハート型の放射性廃棄物または強欲な消しゴム", type: "poison", effect: 95, mind: -80 },
    { name: "摩擦係数0の火星", type: "weapon", effect: 75, mind: 50 },
    { name: "衝撃を与えると低確率で爆発するオーディン", type: "weapon", effect: 90, mind: 30 },
    { name: "ギガカレー無しカレーパン", type: "medicine", effect: 20, mind: 10 },
    { name: "摩擦係数0の蛇口", type: "weapon", effect: 40, mind: -30 },
    { name: "かじりかけマスコットキャラクター", type: "armor", effect: 5, mind: -50 },
    { name: "トップバリュブランドの原子炉", type: "weapon", effect: 50, mind: -40 },
    { name: "燃え盛る偶像", type: "weapon", effect: 85, mind: 60 },
    { name: "3getした細菌", type: "weapon", effect: 25, mind: -20 },
    { name: "極宇宙", type: "armor", effect: 70, mind: 50 },
    { name: "時空を歪めるハンドスピナー", type: "weapon", effect: 75, mind: 40 },
    { name: "異音がするタスクマネージャー", type: "weapon", effect: 40, mind: -30 },
    { name: "おこがましい寿司", type: "medicine", effect: 20, mind: 10 },
    { name: "【令和最新版】トマト", type: "medicine", effect: 80, mind: 60 },
    { name: "コンソメの因数分解", type: "weapon", effect: 55, mind: 20 },
    { name: "次世代コログ", type: "weapon", effect: 70, mind: 30 },
    { name: "辛そうで辛くない少し辛い太陽", type: "poison", effect: 75, mind: -60 },
    { name: "確変きのこ", type: "weapon", effect: 45, mind: 15 },
    { name: "ぷるぷるティラノサウルス", type: "weapon", effect: 60, mind: 20 },
    { name: "the 軍手キー", type: "weapon", effect: 30, mind: -30 },
    { name: "卵かけアルミホイル", type: "poison", effect: 70, mind: -50 },
    { name: "燃え盛るポータル", type: "weapon", effect: 85, mind: 60 },
    { name: "大きな軍手キー", type: "weapon", effect: 40, mind: -20 },
    { name: "Microsoft製石像", type: "armor", effect: 60, mind: 30 },
    { name: "当たり判定のない虚無", type: "weapon", effect: 20, mind: -40 },
    { name: "カラフルなつまようじ", type: "weapon", effect: 25, mind: 10 },
    { name: "デジタルズッキーニっぽい3getしたマンション", type: "armor", effect: 20, mind: -20 },
    { name: "半分にカットされたインターネットエクスプローラー", type: "weapon", effect: 15, mind: -30 },
    { name: "当たり判定のないタピオカメンサの夏の日のミトコンドリア", type: "armor", effect: 5, mind: -50 },
    { name: "最新式のアルミニウム", type: "armor", effect: 40, mind: 30 },
    { name: "デカ鬮", type: "weapon", effect: 50, mind: 10 },
    { name: "土木学会田中賞を受賞したヘリウム", type: "armor", effect: 60, mind: 50 },
    { name: "夢のティラノサウルス", type: "weapon", effect: 75, mind: 40 },
    { name: "シャーペンに擬態したデジタルウラン", type: "weapon", effect: 70, mind: 20 },
    { name: "品質保証付き全部キー", type: "weapon", effect: 85, mind: 60 },
    { name: "無印のハンドスピナー", type: "weapon", effect: 25, mind: -10 },
    { name: "ダイアモンドの全部キー", type: "weapon", effect: 95, mind: 80 },
    { name: "デザイナーズNumLockキー", type: "weapon", effect: 40, mind: 20 },
    { name: "2029年製ミトコンドリア", type: "armor", effect: 5, mind: -30 },
    { name: "えっちなACアダプター", type: "weapon", effect: 20, mind: -10 },
    { name: "ハート型の巻物", type: "armor", effect: 50, mind: 30 },
    { name: "禁断の赤いもの", type: "poison", effect: 80, mind: -70 },
    { name: "国宝級麺無しラーメン", type: "medicine", effect: 5, mind: 5 },
    { name: "どろどろ縦連", type: "weapon", effect: 20, mind: -40 },
    { name: "大きなヘリウムっぽい4日前のスライム", type: "poison", effect: 75, mind: -70 },
    { name: "4次元[R]で所持金MAX の秘技コード", type: "weapon", effect: 95, mind: 80 },
    { name: "天然スコップ", type: "weapon", effect: 30, mind: 10 },
    { name: "もこチキ型の空き缶", type: "weapon", effect: 25, mind: -20 },
    { name: "品質保証付きピザ", type: "medicine", effect: 90, mind: 70 },
    { name: "量子力学的割りばし", type: "weapon", effect: 35, mind: 10 },
    { name: "100年に一度のニーソ", type: "armor", effect: 75, mind: 60 },
    { name: "ダンジョン最深部で見つかった曲", type: "armor", effect: 70, mind: 50 },
    { name: "高級シャーペン", type: "weapon", effect: 40, mind: 30 },
    { name: "透明なきゅうり", type: "medicine", effect: 5, mind: 10 },
    { name: "人類の技術を結集して作った正十二面体", type: "weapon", effect: 90, mind: 70 },
    { name: "データセーバーキーの卵かけフロッピーディスク", type: "poison", effect: 60, mind: -50 },
    { name: "超最高スーパーHAPPY割りばし", type: "weapon", effect: 45, mind: 60 },
    { name: "異世界のクリーム無しクリームパン", type: "medicine", effect: 10, mind: 10 },
    { name: "一番いい国民の基本的な権利", type: "armor", effect: 50, mind: 30 },
    { name: "太古のこたつ", type: "armor", effect: 20, mind: -50 },
    { name: "金の盾", type: "armor", effect: 95, mind: 80 },
    { name: "摩擦係数0の大陸", type: "weapon", effect: 50, mind: 40 },
    { name: "つまようじかつ魔の水銀", type: "poison", effect: 90, mind: -80 },
    { name: "品質保証付きト音記号", type: "armor", effect: 60, mind: 40 },
    { name: "ナノサイズ黒いもの", type: "weapon", effect: 5, mind: -40 },
    { name: "デカ蛇口", type: "weapon", effect: 70, mind: 20 },
    { name: "焦げた全部以外以外", type: "weapon", effect: 20, mind: -60 },
    { name: "そこらへんの液体", type: "poison", effect: 50, mind: -50 },
    { name: "極星のカービー", type: "weapon", effect: 95, mind: 70 },
    { name: "分散型柿の種のピーナッツ部分", type: "weapon", effect: 30, mind: -20 },
    { name: "白いもの入りの2029年製超立方体", type: "armor", effect: 60, mind: 40 },
    { name: "ナノサイズウイルス", type: "poison", effect: 85, mind: -70 },
    { name: "the オノ", type: "weapon", effect: 90, mind: 70 },
    { name: "超食パンの耳30年分に擬態したゴルベーザNumLockキー", type: "weapon", effect: 75, mind: 40 },
    { name: "携帯型もぎもぎフルーツ", type: "medicine", effect: 40, mind: 40 },
    { name: "激5000兆円", type: "weapon", effect: 80, mind: 60 },
    { name: "手作りエキノコックスを侍らせた呪われたマンション", type: "armor", effect: 20, mind: -70 },
    { name: "もちもち有象無象に擬態したアナログこたつ", type: "armor", effect: 15, mind: -50 },
    { name: "耐火サイコロかつ無印の絵文字", type: "weapon", effect: 30, mind: 20 },
    { name: "よりよい村長", type: "armor", effect: 40, mind: 30 },
    { name: "魔のラジオメーター", type: "weapon", effect: 55, mind: 10 },
    { name: "半分にカットされたマスターソード", type: "weapon", effect: 50, mind: 20 },
    { name: "帯電プリン", type: "poison", effect: 35, mind: -30 },
    { name: "燃え盛るクワ", type: "weapon", effect: 80, mind: 60 },
    { name: "多目的特異点", type: "weapon", effect: 60, mind: 30 },
    { name: "オーバークロックされたリップクリーム", type: "weapon", effect: 10, mind: 30 },
    { name: "チョコレートコーティング裁判所", type: "poison", effect: 80, mind: -40 },
    { name: "ゆっくりメンサのプラチナの蛇口", type: "weapon", effect: 40, mind: 20 }
]
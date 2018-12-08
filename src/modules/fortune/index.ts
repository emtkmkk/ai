import 藍 from '../../ai';
import IModule from '../../module';
import MessageLike from '../../message-like';
import serifs from '../../serifs';
import * as seedrandom from 'seedrandom';

const omikujis = [
	'大大吉',
	'大吉',
	'吉',
	'中吉',
	'小吉',
	'凶',
	'大凶'
];

const itemPrefixes = [
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
	'2018年製',
	'500kgくらいある',
	'高級',
	'腐った'
];

const items = [
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
	'歯磨き粉'
];

export default class FortuneModule implements IModule {
	public readonly name = 'fortune';

	public install = (ai: 藍) => { }

	public onMention = (msg: MessageLike) => {
		if (msg.includes(['占', 'うらな', '運勢', 'おみくじ'])) {
			const date = new Date();
			const seed = `${date.getFullYear()}/${date.getMonth()}/${date.getDay()}@${msg.userId}`;
			const rng = seedrandom(seed);
			const omikuji = omikujis[Math.floor(rng() * omikujis.length)];
			const itemPrefix = Math.floor(rng() * 3) == 0 ? itemPrefixes[Math.floor(rng() * itemPrefixes.length)] : '';
			const item = items[Math.floor(rng() * items.length)];
			msg.reply(`**${omikuji}🎉**\nラッキーアイテム: ${itemPrefix}${item}`, serifs.fortune.cw(msg.friend.name));
			return true;
		} else {
			return false;
		}
	}
}

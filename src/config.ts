import { StringLiteral } from "typescript";

type Config = {
	host: string;
	i: string;
	master?: string;
	wsUrl: string;
	apiUrl: string;
	keywordEnabled: boolean;
	reversiEnabled: boolean;
	notingEnabled: boolean;
	chartEnabled: boolean;
	serverMonitoring: boolean;
	mecab?: string;
	mecabDic?: string;
	mecabCustom?: string;
	memoryDir?: string;
	/** インスタンス名 */
	instanceName?: string;
	/** 全公開での投稿を禁止？ */
	postNotPublic?: boolean;
	/** ランダムポストでローカルのみを使用？ */
	randomPostLocalOnly?: boolean;
	/** ランダムポストで投稿するチャンネル */
	randomPostChannel?: string;
	/** 誕生日祝いでローカルのみを使用？ */
	birthdayPostLocalOnly?: boolean;
	/** 誕生日祝いで投稿するチャンネル */
	birthdayPostChannel?: string;
	/** RPGでの主人公の名前 */
	rpgHeroName?: string;
	/** RPGでの通貨の名前 */
	rpgCoinName?: string;
	/** RPGでの通貨の短縮名 */
	rpgCoinShortName?: string;
	/** RPGで返信必須にする？ */
	rpgReplyRequired?: boolean;
	/** RPGの返信の公開範囲 */
	rpgReplyVisibility?: string;
	/** RPG（レイド）の返信の公開範囲 */
	rpgRaidReplyVisibility?: string;
	/** 
	 * チャートからの投稿数取得を強制？
	 * リモートユーザでも必ず正しい値が取得できる場合はTrueに
	 * */
	forceRemoteChartPostCount?: boolean;
	
};

const config = require('../config.json');

config.wsUrl = config.host.replace('http', 'ws');
config.apiUrl = config.host + '/api';

// 設定が存在しない場合はデフォルトを設定
if (!config.instanceName) config.instanceName = "もこきー";
if (!config.postNotPublic !== false) config.postNotPublic = true;
if (!config.randomPostLocalOnly !== false) config.randomPostLocalOnly = true;
if (!config.birthdayPostLocalOnly !== false) config.randomPostLocalOnly = true;
if (!config.rpgHeroName) config.rpgHeroName = "もこチキ";
if (!config.rpgCoinName) config.rpgCoinName = "もこコイン";
if (!config.rpgCoinShortName) config.rpgCoinShortName = "コイン";
if (config.rpgReplyRequired !== false) config.rpgReplyRequired = true;
if (!config.forceRemoteChartPostCount) config.forceRemoteChartPostCount = false;

export default config as Config;

/**
 * @packageDocumentation
 *
 * 藍の設定管理モジュール。
 *
 * @remarks
 * `config.json` から読み込んだ設定値を {@link Config} 型で型安全に管理する。
 * 読み込み時に `wsUrl`・`apiUrl` を自動生成し、
 * 未定義のオプション項目にはデフォルト値を設定する。
 *
 * NOTE: `config.json` は `require` で同期読み込みしている。
 * 起動時に一度だけ読み込まれ、実行中の変更は反映されない。
 *
 * @internal
 */

/**
 * 藍の設定型定義
 *
 * @remarks
 * `config.json` の内容に対応する。
 * 必須項目は `host` と `i`（アクセストークン）のみ。
 * その他は未設定時にデフォルト値が適用される。
 *
 * @internal
 */
type Config = {
	/** MisskeyインスタンスのURL（例: `https://example.com`） */
	host: string;
	/** 藍として動作するアカウントのAPIアクセストークン */
	i: string;
	/** 管理者のユーザー名（管理コマンドの実行権限に使用） */
	master?: string;
	/** WebSocketの接続URL（`host` から自動生成される） */
	wsUrl: string;
	/** APIのベースURL（`host` から自動生成される） */
	apiUrl: string;
	/** キーワード学習機能の有効/無効（MeCabが必要） */
	keywordEnabled: boolean;
	/** リバーシ対局機能の有効/無効 */
	reversiEnabled: boolean;
	/** reversi-service の WebSocket URL（例: wss://example.com/api/reversi/stream）。reversi 用の別接続に使用。 */
	reversiServiceWsUrl?: string;
	/** reversi-service の HTTP API ベース URL（例: https://example.com）。invite/create 等に使用。 */
	reversiServiceApiUrl?: string;
	/** reversi-service 用セッショントークン。reversi-service の MiAuth をブラウザで完了した後、Cookie の「session」の値を使用する。Host として着手するために必要。 */
	reversiServiceToken?: string;
	/** ランダムノート投稿機能の有効/無効 */
	notingEnabled: boolean;
	/** チャート機能の有効/無効 */
	chartEnabled: boolean;
	/** サーバー監視機能の有効/無効 */
	serverMonitoring: boolean;
	/** MeCabの実行ファイルパス */
	mecab?: string;
	/** MeCabの辞書ファイルパス */
	mecabDic?: string;
	/** MeCabのカスタムコマンドオプション */
	mecabCustom?: string;
	/** memory.jsonの保存先ディレクトリパス */
	memoryDir?: string;
	/** インスタンス名 */
	instanceName?: string;
	/** 全公開での投稿を禁止するかどうか */
	postNotPublic?: boolean;
	/** 主に使用する公開範囲 */
	defaultVisibility?: string;
	/** ランダムポストでローカルのみを使用するかどうか */
	randomPostLocalOnly?: boolean;
	/** ランダムポストで投稿するチャンネル */
	randomPostChannel?: string;
	/** 誕生日祝いでローカルのみを使用するかどうか */
	birthdayPostLocalOnly?: boolean;
	/** 誕生日祝いで投稿するチャンネル */
	birthdayPostChannel?: string;
	/** RPGでの主人公の名前 */
	rpgHeroName?: string;
	/** RPGでの通貨の名前 */
	rpgCoinName?: string;
	/** RPGでの通貨の短縮名 */
	rpgCoinShortName?: string;
	/** RPGで返信必須にするかどうか */
	rpgReplyRequired?: boolean;
	/** RPGの返信の公開範囲 */
	rpgReplyVisibility?: string;
	/** RPG（レイド）の返信の公開範囲 */
	rpgRaidReplyVisibility?: string;
	/**
	 * チャートからの投稿数取得を強制するかどうか
	 *
	 * @remarks
	 * リモートユーザーでも必ず正しい値が取得できる場合は `true` に設定する。
	 */
	forceRemoteChartPostCount?: boolean;
	/** 数取りで勝利数差による反転判定を有効にするかどうか */
	kazutoriWinDiffReverseEnabled?: boolean;
	/** 数取りに参加できないユーザーのID一覧 */
	kazutoriBanUsers?: string[];

};

let config: any;
try {
	config = require('../config.json');
} catch (error) {
	if (process.env.NODE_ENV === 'test') {
		config = {
			host: 'http://localhost',
			i: 'test-token',
		};
	} else {
		throw error;
	}
}

// NOTE: host から WebSocket URL と API URL を自動生成
config.wsUrl = config.host.replace('http', 'ws');
config.apiUrl = config.host + '/api';

// 設定が存在しない場合はデフォルトを設定
if (!config.instanceName) config.instanceName = "もこきー";
if (!config.defaultVisibility) config.defaultVisibility = "public";
if (config.postNotPublic !== false) config.postNotPublic = true;
if (config.randomPostLocalOnly !== false) config.randomPostLocalOnly = true;
if (config.birthdayPostLocalOnly !== false) config.birthdayPostLocalOnly = true;
if (!config.rpgHeroName) config.rpgHeroName = "もこチキ";
if (!config.rpgCoinName) config.rpgCoinName = "もこコイン";
if (!config.rpgCoinShortName) config.rpgCoinShortName = "コイン";
if (config.rpgReplyRequired !== false) config.rpgReplyRequired = true;
if (!config.forceRemoteChartPostCount) config.forceRemoteChartPostCount = false;
if (config.kazutoriWinDiffReverseEnabled !== true) config.kazutoriWinDiffReverseEnabled = false;
if (!Array.isArray(config.kazutoriBanUsers)) config.kazutoriBanUsers = [];

export default config as Config;

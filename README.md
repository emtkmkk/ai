<h1><p align="center"><img src="./ai.svg" alt="藍" height="200"></p></h1>
<p align="center">An Ai for Misskey. <a href="./torisetu.md">About Ai</a></p>

## これなに
Misskey用の日本語Botです。
ユーザーとの対話、ゲーム、占い、サーバー監視など多彩な機能を持つAIアシスタントとして動作します。

## アーキテクチャ概要

藍はモジュールベースのアーキテクチャを採用しています。

```
藍 (AIコア)
├── Stream (WebSocket接続管理)
├── Module (機能モジュール基底クラス)
│   ├── CoreModule (名前設定、好感度、ステータス表示等)
│   ├── TalkModule (会話応答)
│   ├── RpgModule (RPGゲーム)
│   ├── KazutoriModule (数取りゲーム)
│   └── ... (その他20以上のモジュール)
├── Friend (ユーザー情報・親愛度管理)
├── Message (メッセージ解析・返信)
└── Serifs (セリフ定義)
```

## ディレクトリ構造

```
ai-1/
├── src/
│   ├── ai.ts          # AIコアクラス（藍）
│   ├── config.ts      # 設定管理
│   ├── friend.ts      # ユーザー（友達）情報管理
│   ├── index.ts       # エントリーポイント（ブートストラッパー）
│   ├── message.ts     # メッセージ処理
│   ├── module.ts      # モジュール基底クラス
│   ├── serifs.ts      # 全セリフ定義
│   ├── stream.ts      # WebSocketストリーム接続
│   ├── vocabulary.ts  # アイテム名生成用語彙
│   ├── misskey/       # Misskey APIの型定義
│   ├── modules/       # 各機能モジュール（26種）
│   ├── types/         # 外部ライブラリ型定義
│   └── utils/         # ユーティリティ関数群
├── test/              # テストコード
├── config.json        # 設定ファイル（要作成）
├── torisetu.md        # 取扱説明書（ユーザー向け）
└── Dockerfile         # Docker用設定
```

## インストール
> Node.js と npm と MeCab (オプション) がインストールされている必要があります。

まず適当なディレクトリに `git clone` します。
次にそのディレクトリに `config.json` を作成します。中身は次のようにします:

### 設定項目一覧

| キー | 型 | 必須 | 説明 |
|------|------|------|------|
| `host` | string | ✅ | インスタンスのURL（`https://` 付き、末尾の `/` は除く） |
| `i` | string | ✅ | 藍として動かしたいアカウントのアクセストークン |
| `master` | string | | 管理者のユーザー名 |
| `notingEnabled` | boolean | | ランダムにノートを投稿する機能（デフォルト: 有効） |
| `keywordEnabled` | boolean | | キーワードを覚える機能（MeCab が必要） |
| `chartEnabled` | boolean | | チャート機能（デフォルト: 有効） |
| `reversiEnabled` | boolean | | リバーシ対局機能 |
| `serverMonitoring` | boolean | | サーバー監視機能 |
| `mecab` | string | | MeCab のインストールパス |
| `mecabDic` | string | | MeCab の辞書ファイルパス |
| `memoryDir` | string | | `memory.json` の保存先（デフォルト: `.`） |
| `instanceName` | string | | インスタンス名（デフォルト: `もこきー`） |
| `postNotPublic` | boolean | | 全公開での投稿を禁止（デフォルト: `true`） |
| `defaultVisibility` | string | | 主に使用する公開範囲（デフォルト: `public`） |
| `randomPostLocalOnly` | boolean | | ランダムポストでローカルのみ使用（デフォルト: `true`） |
| `randomPostChannel` | string | | ランダムポストで投稿するチャンネル |
| `birthdayPostLocalOnly` | boolean | | 誕生日祝いでローカルのみ使用（デフォルト: `true`） |
| `birthdayPostChannel` | string | | 誕生日祝いで投稿するチャンネル |
| `rpgHeroName` | string | | RPGでの主人公の名前（デフォルト: `もこチキ`） |
| `rpgCoinName` | string | | RPGでの通貨の名前（デフォルト: `もこコイン`） |
| `rpgCoinShortName` | string | | RPGでの通貨の短縮名（デフォルト: `コイン`） |
| `rpgReplyRequired` | boolean | | RPGで返信必須にする（デフォルト: `true`） |
| `rpgReplyVisibility` | string | | RPGの返信の公開範囲 |
| `rpgRaidReplyVisibility` | string | | RPG（レイド）の返信の公開範囲 |
| `forceRemoteChartPostCount` | boolean | | チャートからの投稿数取得を強制 |
| `kazutoriWinDiffReverseEnabled` | boolean | | 数取りで勝利数差による反転判定を有効化 |
| `kazutoriBanUsers` | string[] | | 数取りに参加できないユーザのIDリスト |

### 設定例

``` json
{
	"host": "https://example.com",
	"i": "your-access-token",
	"master": "admin",
	"notingEnabled": true,
	"keywordEnabled": false,
	"chartEnabled": true,
	"reversiEnabled": false,
	"serverMonitoring": false,
	"mecab": "/usr/local/bin/mecab",
	"mecabDic": "/usr/lib/mecab/dic/",
	"memoryDir": "."
}
```

`npm install` して `npm run build` して `npm start` すれば起動できます。

## Dockerで動かす
まず適当なディレクトリに `git clone` します。
次にそのディレクトリに `config.json` を作成します。中身は上記の設定項目を参考にしてください。
（MeCabの設定、memoryDirについては触らないでください）

Docker用の設定例:
``` json
{
	"host": "https://example.com",
	"i": "your-access-token",
	"master": "admin",
	"notingEnabled": true,
	"keywordEnabled": true,
	"chartEnabled": true,
	"reversiEnabled": false,
	"serverMonitoring": false,
	"mecab": "/usr/bin/mecab",
	"mecabDic": "/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/",
	"memoryDir": "data"
}
```
`docker-compose build` して `docker-compose up` すれば起動できます。
`docker-compose.yml` の `enable_mecab` を `0` にすると、MeCabをインストールしないようにもできます。（メモリが少ない環境など）

## 搭載モジュール一覧

| モジュール | 説明 |
|------------|------|
| Core | 名前設定、好感度確認、ステータス表示、アカウントリンク等 |
| Talk | 各種会話応答（挨拶、なでなで、etc） |
| RPG | RPGゲーム機能 |
| Kazutori | 数取りゲーム |
| Reversi | リバーシ対局 |
| Fortune | 占い |
| Emoji | 福笑い（絵文字の組み合わせ） |
| EmojiReact | 絵文字リアクション |
| Timer | タイマー |
| Dice | サイコロ |
| Maze | 迷路生成 |
| GuessingGame | 数当てゲーム |
| Keyword | キーワード学習 |
| Birthday | 誕生日祝い |
| Welcome | 新規ユーザー歓迎 |
| Follow | フォロー機能 |
| Reminder | リマインダー |
| Poll | アンケート |
| Chart | インスタンスチャート投稿 |
| Server | サーバー監視 |
| SleepReport | 睡眠レポート |
| Noting | ランダムノート投稿 |
| Today | 今日の情報 |
| Ping | 生存確認 |
| Yoruho | 夜更かし検知 |
| Valentine | バレンタイン |

## 開発

### ビルド
```bash
npm install
npm run build
```

### テスト
```bash
npm test
```

### 開発時の注意
- モジュールを追加する場合は `src/modules/` にディレクトリを作成し、`Module` 基底クラスを継承して実装します
- 新しいモジュールは `src/index.ts` のモジュール配列に登録する必要があります（配列の先頭ほど高優先度）
- セリフは `src/serifs.ts` に集約されています
- ユーザーデータはインメモリDB（LokiJS）で管理され、`memory.json` に永続化されます

## フォント
一部の機能にはフォントが必要です。藍にはフォントは同梱されていないので、ご自身でフォントをインストールディレクトリに`font.ttf`という名前で設置してください。

## 記憶
藍は記憶の保持にインメモリデータベースを使用しており、藍のインストールディレクトリに `memory.json` という名前で永続化されます。

## ライセンス
MIT

## Awards
<img src="./WorksOnMyMachine.png" alt="Works on my machine" height="120">

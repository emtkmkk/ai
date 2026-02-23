# reversi モジュール

**reversi-service** と対局するリバーシ（オセロ）モジュール。Misskey のリバーシ機能には依存せず、reversi-service に専用の WebSocket / HTTP で接続する。

---

## 有効化条件

次の 4 つがすべて設定されているときのみ有効になる。

- `config.reversiEnabled === true`
- `config.reversiServiceWsUrl`（WebSocket: 例 `wss://example.com/api/reversi/stream`）
- `config.reversiServiceApiUrl`（HTTP: 例 `https://example.com`）
- `config.reversiServiceToken`（MiAuth で取得したセッショントークン）

---

## アーキテクチャ

- **接続**: reversi-service 用の **専用 WebSocket クライアント**（Misskey 用 `Stream` は使わない）。
- **matched 用 1 本**: `reversiServiceWsUrl` に常時 1 本つなぎ、`channel: 'reversi'` に加入。`matched` 受信用。
- **対局用 最大 5 本**: `matched` のたびに新しい WebSocket を 1 本開き、`channel: 'reversiGame', params: { gameId }` に加入。同時対局は最大 5 件。
- **招待**: ユーザーが「リバーシ」等でメンション → `invite/create`（Bearer）で招待URL取得 → **招待を依頼した投稿へダイレクトで返信**して招待URLを送る。ゲーム一覧に登録し、1 時間の時間切れタイマーを 1 回だけセット。
- **切断・復帰**: 対局用接続が切れたら再接続し、サーバーが送る **sync** で盤面・手番を再構築して状態を復帰する。
- **Bot 再起動時**: 永続化されている進行中ゲーム一覧から **reversiGame 接続を自動で張り直す**。接続後にサーバーが送る sync（および必要に応じ started）で盤面・手番を復元し、**自分のターンであれば自動で思考を開始する**。

```mermaid
flowchart LR
  subgraph ai["ai"]
    Module["reversi モジュール"]
    Client["reversi 専用 WS クライアント"]
    ConnReversi["接続1: reversi"]
    ConnGame["接続2〜6: reversiGame"]
    Back["ReversiGameSession（同一プロセス）"]
  end
  subgraph rs["reversi-service"]
    Invite["invite/create"]
    StreamWS["GET /api/reversi/stream"]
  end
  User["ユーザー"]
  User -->|メンション| Module
  Module -->|Bearer で招待作成| Invite
  Module -->|ダイレクトで招待URL返信| User
  User -->|招待URLで join| rs
  Client --> ConnReversi
  Client --> ConnGame
  ConnReversi <-->|?i= token| StreamWS
  ConnGame <-->|?i= token| StreamWS
  StreamWS -->|matched| ConnReversi
  ConnReversi -->|matched で新規接続| ConnGame
  StreamWS -->|started, log, ended, sync| ConnGame
  ConnGame --> Back
  Back -->|putStone, ready| ConnGame
```

---

## ファイル構成

| ファイル | 責務 |
| --- | --- |
| `index.ts` | モジュール本体。招待・matched 受信・ゲーム一覧・終局・時間切れ・親愛度・同一プレイヤー制限・勝敗記録（wins/losses）・難易度切り替え（勝ち越し時は単純モード） |
| `reversi-stream.ts` | reversi-service 用 WebSocket クライアント（matched 1 本・対局用最大 5 本） |
| `back.ts` | 思考エンジン（ReversiGameSession: 超単純／単純モード）。started / log / ended / sync 処理。従来の fork 用 Session も残存 |

---

## 思考エンジン

- **有効なモード**: **超単純**と**単純**の 2 種類。どちらを使うかは対戦相手ごとの勝敗記録で自動切り替え。**難易度名はユーザーに表示しない**（投稿・返信では言及しない）。
- **通常モード（αβ）**: 封印（コードは back.ts に残すが、reversi-service 前提では使用しない）。

### モードの切り替え条件

- その対戦相手に対して**プレイヤーが 1 回以上勝ち越している**（勝ち数 > 負け数）とき → **単純モード**。
- それ以外 → **超単純モード**。

勝敗は Friend の永続データ（`reversi.wins` / `reversi.losses`）に記録する。相手が勝ったときのみ `wins` +1、自分勝ち・引き分け・投了はいずれも `losses` +1。

### 超単純モードのルール

1. **隅を取る**: 合法手のうち隅に打てるならそのいずれかを選ぶ。
2. **角周辺回避（条件付き）**: その角がまだ空きのときだけ、その角に隣接するマスを避ける。
3. **候補の絞り込み**: 隅が打てないときは、避ける角周辺に含まれない手を候補。すべて角周辺しかない場合は全合法手を候補に。
4. **X より C を優先**: 角周辺しか打てないとき、C（隅の横／縦隣）に打てる手があればその中で、なければ X（隅の斜め隣）の中で、反転数最大を選ぶ。
5. **反転数最大化**: 候補のうち反転数が最大の手を選ぶ。

### 単純モードの概要

変則ボード対応・未来読みなし・必ず 1 手で着手を決める。現在の盤面と合法手のみを使用する。

- **回避**: 空き角の X → C の順で着手を除外（除外で候補が空になるなら行わない）。
- **優先**: 角 → GoodEdge2（角から 2 マス離れた辺）→ GoodInner（その内側）→ 辺の順で、当たった時点で候補を絞りタイブレークへ。
- **追加回避**: 優先が一度も当たらなかったとき、空き角近く（Nearset）と辺から 1 マス離れた手を回避。
- **タイブレーク**: 空きマス数に応じて反転数が最小または最小+1／最大 → 返せる石の周りの空白が少ない手 → 8 近傍の空きが少ない手 → 反転数最小の手 → 辺から遠い手 → ランダム。

角・辺・C/X・GoodEdge2・GoodInner は固定座標を使わず、盤面形状から計算する。

`canPutEverywhere` が true のゲームは対応せず、開始時に終了扱いとする。

---

## 招待・制限

| 項目 | 内容 |
| --- | --- |
| 招待のトリガー | ユーザーが「リバーシ」「オセロ」等でメンション |
| 招待URL | `invite/create` で取得し、**招待を依頼した投稿へダイレクト返信**で送る。形式は reversi-service のパス形式（例: `https://example.com/game/AbCdEfGhIjKl`）に対応 |
| 招待の有効期限 | 1 時間。期限切れ時はダイレクト返信で時間切れを通知し、今日の対局数に加算 |
| 同時対局 | 最大 5 件。6 件目は「いま忙しいから、あとでまた試してみて」とダイレクト返信で断る |
| 同一プレイヤー | 同じ相手とは同時に 1 対局まで。進行中がある場合は新規招待を断る |
| 1 日あたり | 同じ相手とは 1 日 5 回まで。6 回目以降の招待は断る |
| 好感度による開放条件 | **リモートユーザーかつ管理者以外**に適用。ローカルユーザー（`msg.user.host` なし）と管理者は制限なし。初回対局完了時刻（`firstGameCompletedAt`）までは好感度 `>= 200` でのみ可。初回対局完了後は、7日間は必要好感度 `200` 固定、その後は毎日 `100 / 7` ずつ低下し `0` まで下がる。判定は `現在の好感度 > 必要好感度`（**等号は不可**）。 |

---

## 親愛度・今日の対局数・勝敗

| アクション | 内容 |
| --- | --- |
| 対局終了 | 今日の対局数 +1。勝敗を `reversi.wins` / `reversi.losses` に記録（相手勝ちのみ wins +1、それ以外は losses +1）。親愛度は下記「増加条件（詳細）」に従って加算。 |
| 時間切れ | 今日の対局数 +1。親愛度計算は通常どおり実施（終局結果倍率は `×1.0`）。 |
| 拒否（decline） | 対局不成立として扱う。今日の対局数は増やさず、親愛度も加算しない。 |

### 親愛度の増加条件（詳細）

1. **基礎時間の集計**
   - 相手が**実際に着手して手番が移った時点**で、その1手の思考時間を合算する（1手あたり最大 5 秒）。
   - そのため、投了・時間切れになる前に進行中だった未着手の思考時間は合計に含めない。拒否（decline）は対局不成立のため 0 秒扱いで、加算を行わない。
2. **終局結果・難易度ボーナス倍率**
   - モード倍率: 単純モード `×1.35` / それ以外 `×1.0`
   - 結果倍率: `iLose`（ユーザ勝ち / bot負け）`×2.0`、`drawn`（引き分け）`×1.5`、`iWon` / `youSurrendered` / `timeout` / `decline` は `×1.0`
   - 最終倍率は「モード倍率 × 結果倍率」で計算する。
3. **チャンク化して加算**
   - `調整後思考時間 + 同日内の既存繰越(loveThinkingCarryMs)` を 40 秒単位で区切り、チャンク数を計算。
   - 1チャンクごとに `friend.incLove(0.1, "reversi-chunk-日付-連番")` を 1 回実行（まとめては加算しない）。
4. **日次上限**
   - 1日あたり最大 6 チャンクまで反映（理論上の上限は +0.6）。
   - その日の残り枠を超えた分は `loveThinkingCarryMs` に繰り越し（同日内のみ有効）。
5. **日付の扱い**
   - 上限判定の日付は**対局開始時刻**（`gameStartedAtMs`）基準。
   - 対局中に日付を跨いでも、開始日の枠を使う。
   - `loveThinkingCarryMs` は `loveChunkDate` と対局日が一致する場合のみ利用し、日付を跨いだ端数は破棄する。


### 好感度開放の挙動メモ

- `firstGameCompletedAt` は、最初に 1 局でも終局した時点でモジュール永続データに保存される。
- 好感度が条件未達の場合は、現時点の好感度で対局可能になるまでの見込み日数（最大 365 日）を案内する。
- 判定が `>` のため、必要値とちょうど同値ではまだ対局できない（例: 必要 200 の期間は 200 ちょうどでは不可）。

**Friend の reversi 永続データ**: `lastReversiDate`、`gamesPlayedToday`、`lastPlayedAt` に加え、`wins`（その相手に勝った回数）と `losses`（その相手に負けた回数・引き分け・投了を含む）、`loveThinkingCarryMs`（40秒未満の繰越ms。同日内のみ有効）、`loveChunkDate`（チャンク加算管理日付）、`loveChunksAppliedToday`（当日反映済みチャンク数）を保持する。難易度切り替え（勝ち越し時は単純モード）に利用する。

**モジュール永続データの難易度別統計**: 超単純・単純それぞれで、**全ユーザー累計**の「勝った数」「負けた数」「引き分け数」「投了数」「時間切れ数」を `difficultyStatsSuperSimple` / `difficultyStatsSimple` に保持する。終局時に `resultType`（iWon / iLose / drawn / youSurrendered / timeout）に応じて該当難易度の該当項目を +1 する。招待期限切れは時間切れ数に含めない。

---

## 設定例 (config.json)

```json
{
  "reversiEnabled": true,
  "reversiServiceWsUrl": "wss://your-reversi-service.example.com/api/reversi/stream",
  "reversiServiceApiUrl": "https://your-reversi-service.example.com",
  "reversiServiceToken": "reversi-service の MiAuth ログイン後にブラウザに設定される session Cookie の値"
}
```

- **reversiServiceToken**: reversi-service の MiAuth をブラウザで完了した後、開発者ツール → Application → Cookies → **session** の値をコピーして設定する。
- ストリーム接続時は `?i=` に `reversiServiceToken` を付与。`invite/create` は `reversiServiceApiUrl` に Bearer で送る。

---

## 依存関係

| 依存先 | 用途 |
| --- | --- |
| `misskey-reversi` | 盤面管理・合法手・反転数（超単純・単純の両思考で利用） |
| `request-promise-native` | `invite/create` の HTTP 呼び出し |
| `@/config` | `reversiEnabled`, `reversiServiceWsUrl`, `reversiServiceApiUrl`, `reversiServiceToken` |
| `ws` | reversi 専用 WebSocket クライアント |

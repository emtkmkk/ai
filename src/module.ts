/**
 * @packageDocumentation
 *
 * モジュール基底クラス。
 *
 * @remarks
 * 全ての機能モジュールが継承する抽象クラスを定義する。
 * メンションフック、コンテキストフック（返信待ち受け）、永続タイマーなどの
 * 共通機能を提供する。
 *
 * 各モジュールは以下のライフサイクルで動作する:
 * 1. {@link Module.init} — 藍のインスタンスとDBドキュメントの初期化
 * 2. {@link Module.install} — フック関数の登録
 * 3. 登録したフックが呼ばれるたびにモジュール固有のロジックを実行
 *
 * @see {@link ./ai | 藍} — モジュールの登録・管理を行う
 * @internal
 */
import autobind from 'autobind-decorator';
import 藍, { InstallerResult } from '@/ai';

/**
 * モジュールの抽象基底クラス
 *
 * @remarks
 * 各機能モジュールはこのクラスを継承し、{@link name} と {@link install} を実装する。
 * `install()` でメンションフック・コンテキストフック・タイムアウトコールバックを返す。
 *
 * モジュール固有の永続データは {@link getData} / {@link setData} で管理する。
 * データは LokiJS の `moduleData` コレクションに保存される。
 *
 * @internal
 */
export default abstract class Module {
	/**
	 * モジュールの識別名
	 *
	 * @remarks
	 * DBのキーとしても使用されるため、一度決めたら変更しないこと。
	 *
	 * @internal
	 */
	public abstract readonly name: string;

	/**
	 * 藍のインスタンスへの参照
	 *
	 * @remarks
	 * {@link init} で注入される。`install()` 以降のタイミングで使用可能。
	 *
	 * @internal
	 */
	protected ai: 藍;

	/**
	 * モジュール固有の永続データドキュメント
	 *
	 * @remarks
	 * LokiJS のドキュメントオブジェクト。直接操作せず {@link getData} / {@link setData} を使用すること。
	 *
	 * @internal
	 */
	private doc: any;

	/**
	 * モジュールを初期化する
	 *
	 * @remarks
	 * 藍のコンストラクタ内で {@link install} の前に呼び出される。
	 * DB から既存のモジュールデータをロードし、存在しなければ新規作成する。
	 *
	 * @param ai - 藍のインスタンス
	 * @returns なし
	 * @internal
	 */
	public init(ai: 藍) {
		this.ai = ai;

		this.doc = this.ai.moduleData.findOne({
			module: this.name
		});

		if (this.doc == null) {
			this.doc = this.ai.moduleData.insertOne({
				module: this.name,
				data: {}
			});
		}
	}

	/**
	 * モジュールをインストールし、フック関数を登録する
	 *
	 * @remarks
	 * 各モジュールはこのメソッドを実装し、必要なフックを返す。
	 * 返せるフックの種類は以下の通り:
	 * - `mentionHook` — メンション受信時に呼ばれる
	 * - `contextHook` — 返信（コンテキスト）受信時に呼ばれる
	 * - `timeoutCallback` — 永続タイマー発火時に呼ばれる
	 *
	 * @returns メンションフック・コンテキストフック・タイムアウトコールバックの登録情報
	 * @internal
	 */
	public abstract install(): InstallerResult;

	/**
	 * モジュール名付きでログを出力する
	 *
	 * @param msg - 出力するメッセージ
	 * @returns なし
	 * @internal
	 */
	@autobind
	public log(msg: string) {
		this.ai.log(`[${this.name}]: ${msg}`);
	}

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受ける
	 *
	 * @remarks
	 * 指定した投稿への返信、またはトーク相手からのメッセージを待ち受ける。
	 * 返信が届くと {@link install} で登録した `contextHook` が呼ばれる。
	 *
	 * @param key - コンテキストを識別するためのキー（同一モジュール内で一意）
	 * @param id - トーク相手のID、または待ち受ける投稿のID
	 * @param data - コンテキストに保存するデータ（`contextHook` で参照可能）
	 * @returns なし
	 *
	 * @see {@link unsubscribeReply} — 待ち受け解除
	 * @internal
	 */
	@autobind
	public subscribeReply(key: string | null, id: string, data?: any) {
		this.ai.subscribeReply(this, key, id, data);
	}

	/**
	 * 返信の待ち受けを解除する
	 *
	 * @param key - 解除するコンテキストのキー
	 * @returns なし
	 *
	 * @see {@link subscribeReply} — 待ち受け登録
	 * @internal
	 */
	@autobind
	public unsubscribeReply(key: string | null) {
		this.ai.unsubscribeReply(this, key);
	}

	/**
	 * 指定したミリ秒後にタイムアウトコールバックを呼び出す
	 *
	 * @remarks
	 * このタイマーは DB に永続化されるため、途中でプロセスを再起動しても有効。
	 * タイマー発火時に {@link install} で登録した `timeoutCallback` が呼ばれる。
	 *
	 * @param delay - 遅延ミリ秒
	 * @param data - コールバックに渡すデータ
	 * @returns なし
	 * @internal
	 */
	@autobind
	public setTimeoutWithPersistence(delay: number, data?: any) {
		this.ai.setTimeoutWithPersistence(this, delay, data);
	}

	/**
	 * モジュール固有の永続データを取得する
	 *
	 * @returns モジュールの永続データオブジェクト
	 * @internal
	 */
	@autobind
	protected getData() {
		return this.doc.data;
	}

	/**
	 * モジュール固有の永続データを更新して保存する
	 *
	 * @remarks
	 * 渡したデータで既存データを上書きし、DB に即座に保存する。
	 *
	 * @param data - 保存するデータ
	 * @returns なし
	 * @internal
	 */
	@autobind
	protected setData(data: any) {
		this.doc.data = data;
		this.ai.moduleData.update(this.doc);
	}
}

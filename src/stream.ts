/**
 * @packageDocumentation
 *
 * WebSocket ストリーム接続管理モジュール。
 *
 * @remarks
 * Misskey の WebSocket Streaming API への接続を管理する。
 * `reconnecting-websocket` を使用した自動再接続、コネクションプーリング、
 * 2分間の非アクティビティ検出による強制再接続などの機能を提供する。
 *
 * チャンネル接続には2種類がある:
 * - {@link SharedConnection} — 同じチャンネルへの接続を {@link Pool} で共有
 * - {@link NonSharedConnection} — パラメータ付きの独立した接続
 *
 * @see {@link ./ai | 藍} — ストリームの利用元
 * @internal
 */
import autobind from 'autobind-decorator';
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
const ReconnectingWebsocket = require('reconnecting-websocket');
import config from './config';
import log from '@/utils/log';

/**
 * Misskey WebSocket ストリーム接続クラス
 *
 * @remarks
 * `ReconnectingWebsocket` を利用して自動再接続を行う。
 * `SharedConnection`（共有）と `NonSharedConnection`（専用）の
 * 2種類のチャンネル接続を管理する。
 *
 * 2分間メッセージがない場合は非アクティビティと判断して強制再接続する。
 * 接続が確立されるまでは送信メッセージをバッファリングし、接続後に順次送信する。
 *
 * @internal
 */
export default class Stream extends EventEmitter {
	/**
	 * WebSocket インスタンス（`ReconnectingWebsocket`）
	 * @internal
	 */
	private stream: any;
	/**
	 * 接続状態
	 *
	 * @remarks
	 * `initializing` → `connected` → `reconnecting` → `connected` ...
	 *
	 * @internal
	 */
	private state: string;
	/**
	 * 未接続時にメッセージを保持するバッファ
	 *
	 * @remarks
	 * 接続確立時に {@link onOpen} で順次送信される。
	 *
	 * @internal
	 */
        private buffer: any[];
	/**
	 * 共有コネクションプールの一覧
	 * @internal
	 */
        private sharedConnectionPools: Pool[] = [];
	/**
	 * アクティブな共有コネクションの一覧
	 * @internal
	 */
        private sharedConnections: SharedConnection[] = [];
	/**
	 * アクティブな専用コネクションの一覧
	 * @internal
	 */
        private nonSharedConnections: NonSharedConnection[] = [];
	/**
	 * 最後にメッセージを受信した時刻（`Date.now()` のミリ秒値）
	 * @internal
	 */
        private lastActivityAt: number;
	/**
	 * 非アクティビティ監視タイマーのID
	 * @internal
	 */
        private inactivityCheckTimer: any;

	/**
	 * Stream インスタンスを生成する
	 *
	 * @remarks
	 * 初期化時に WebSocket 接続と非アクティビティ監視を開始する。
	 *
	 * @internal
	 */
        constructor() {
                super();

                this.state = 'initializing';
                log(`stream : ` + this.state);
                this.buffer = [];

                this.initializeStream();
                this.startInactivityWatcher();
        }

	/**
	 * 共有コネクションを取得または作成する
	 *
	 * @remarks
	 * 同じチャンネルのコネクションは {@link Pool} で共有される。
	 * プールが存在しない場合は新規作成する。
	 *
	 * @param channel - チャンネル名（例: `main`）
	 * @returns 共有コネクション
	 * @internal
	 */
        @autobind
        public useSharedConnection(channel: string): SharedConnection {
                let pool = this.sharedConnectionPools.find(p => p.channel === channel);

		if (pool == null) {
			pool = new Pool(this, channel);
			this.sharedConnectionPools.push(pool);
		}

		const connection = new SharedConnection(this, channel, pool);
		this.sharedConnections.push(connection);
		return connection;
	}

	/**
	 * 共有コネクションを一覧から削除する
	 *
	 * @param connection - 削除する共有コネクション
	 * @returns なし
	 * @internal
	 */
	@autobind
	public removeSharedConnection(connection: SharedConnection) {
		this.sharedConnections = this.sharedConnections.filter(c => c !== connection);
	}

	/**
	 * 専用コネクションを作成する
	 *
	 * @remarks
	 * プールを共有せず、独立したコネクションを作成する。
	 * パラメータ付きのチャンネル接続に使用される。
	 *
	 * @param channel - チャンネル名
	 * @param params - チャンネル接続パラメータ
	 * @returns 専用コネクション
	 * @internal
	 */
	@autobind
	public connectToChannel(channel: string, params?: any): NonSharedConnection {
		const connection = new NonSharedConnection(this, channel, params);
		this.nonSharedConnections.push(connection);
		return connection;
	}

	/**
	 * 専用コネクションを一覧から削除する
	 *
	 * @param connection - 削除する専用コネクション
	 * @returns なし
	 * @internal
	 */
	@autobind
	public disconnectToChannel(connection: NonSharedConnection) {
		this.nonSharedConnections = this.nonSharedConnections.filter(c => c !== connection);
        }

	/**
	 * WebSocket 接続確立時のコールバック
	 *
	 * @remarks
	 * バッファリングされたメッセージの送信と、
	 * 再接続時のチャンネル復帰（`pool.connect()` / `connection.connect()`）を行う。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        private onOpen() {
                const isReconnect = this.state == 'reconnecting';

                this.state = 'connected';
                log(`stream : ` + this.state);
		this.emit('_connected_');

		// バッファーを処理
		const _buffer = [...this.buffer]; // Shallow copy
		this.buffer = []; // Clear buffer
		for (const data of _buffer) {
			this.send(data); // Resend each buffered messages
		}

		// チャンネル再接続
		if (isReconnect) {
			this.sharedConnectionPools.forEach(p => {
				p.connect();
			});
			this.nonSharedConnections.forEach(c => {
				c.connect();
			});
		}
	}

	/**
	 * WebSocket 接続切断時のコールバック
	 *
	 * @remarks
	 * 状態を `reconnecting` に設定し、切断イベントを発火する。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	private onClose() {
		this.state = 'reconnecting';
		log(`stream : ` + this.state);
		this.emit('_disconnected_');
	}

	/**
	 * WebSocket メッセージ受信時のコールバック
	 *
	 * @remarks
	 * チャンネルメッセージ（`type == 'channel'`）は対応するコネクションに振り分ける。
	 * その他のメッセージはストリーム自体のイベントとして発火する。
	 *
	 * @param message - WebSocket のメッセージイベント
	 * @returns なし
	 * @internal
	 */
        @autobind
        private onMessage(message) {
                this.lastActivityAt = Date.now();
                const { type, body } = JSON.parse(message.data);

		if (type == 'channel') {
			const id = body.id;

			let connections: (Connection | undefined)[];

			// まず共有コネクションから検索し、なければ専用コネクションを探す
			connections = this.sharedConnections.filter(c => c.id === id);

			if (connections.length === 0) {
				connections = [this.nonSharedConnections.find(c => c.id === id)];
			}

			// 該当するコネクションにイベントを転送する
			for (const c of connections.filter(c => c != null)) {
				c!.emit(body.type, body.body);
				c!.emit('*', { type: body.type, body: body.body });
			}
		} else {
			// チャンネル以外のメッセージはストリーム自体のイベントとして発火
			this.emit(type, body);
			this.emit('*', { type, body });
		}
	}

	/**
	 * WebSocket にメッセージを送信する
	 *
	 * @remarks
	 * 未接続時はバッファに保存し、接続確立後に {@link onOpen} で順次送信される。
	 *
	 * @param typeOrPayload - メッセージタイプまたはペイロード全体
	 * @param payload - ペイロード（タイプを第1引数に指定した場合）
	 * @returns なし
	 * @internal
	 */
	@autobind
	public send(typeOrPayload, payload?) {
		const data = payload === undefined ? typeOrPayload : {
			type: typeOrPayload,
			body: payload
		};

		// まだ接続が確立されていなかったらバッファリングして次に接続した時に送信する
		if (this.state != 'connected') {
			this.buffer.push(data);
			log(`streamBufferPush : ` + JSON.stringify(payload) + " : " + this.state);
			return;
		}

		this.stream.send(JSON.stringify(data));
	}

	/**
	 * ストリーム接続を終了する
	 *
	 * @remarks
	 * イベントリスナーと非アクティビティ監視タイマーをクリアする。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        public close() {
                this.stream.removeEventListener('open', this.onOpen);
                this.stream.removeEventListener('message', this.onMessage);
                this.stream.removeEventListener('close', this.onClose);
                if (this.inactivityCheckTimer) {
                        clearInterval(this.inactivityCheckTimer);
                        this.inactivityCheckTimer = null;
                }
        }

	/**
	 * WebSocket ストリームを初期化する
	 *
	 * @remarks
	 * `ReconnectingWebsocket` を生成し、各イベントリスナーを登録する。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        private initializeStream() {
                this.lastActivityAt = Date.now();
                this.stream = new ReconnectingWebsocket(`${config.wsUrl}/streaming?i=${config.i}`, [], {
                        WebSocket: WebSocket
                });
                log(`streamURL : ` + `${config.wsUrl}/streaming?i=${config.i}`);
                this.stream.addEventListener('open', this.onOpen);
                this.stream.addEventListener('close', this.onClose);
                this.stream.addEventListener('message', this.onMessage);
        }

	/**
	 * 非アクティビティ監視を開始する
	 *
	 * @remarks
	 * 60秒ごとにチェックし、2分間メッセージがない場合は
	 * 接続が切れたと判断して {@link forceReconnect} を実行する。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        private startInactivityWatcher() {
                const RECONNECT_INTERVAL = 2 * 60 * 1000;
                const CHECK_INTERVAL = 60 * 1000;

                this.inactivityCheckTimer = setInterval(() => {
                        const now = Date.now();
                        if (now - this.lastActivityAt >= RECONNECT_INTERVAL) {
                                const lastActivityAt = this.lastActivityAt;
                                log(`streamInactivityDetected : reconnecting stream after ${Math.round((now - lastActivityAt) / 1000)}s of silence`);
                                this.emit('inactivityReconnect', { lastActivityAt });
                                this.forceReconnect();
                        }
                }, CHECK_INTERVAL);
        }

	/**
	 * 強制的にストリームを再接続する
	 *
	 * @remarks
	 * 現在の接続を閉じ、新しい WebSocket 接続を初期化する。
	 *
	 * @returns なし
	 * @internal
	 */
        @autobind
        private forceReconnect() {
                this.state = 'reconnecting';
                this.stream.removeEventListener('open', this.onOpen);
                this.stream.removeEventListener('close', this.onClose);
                this.stream.removeEventListener('message', this.onMessage);
                this.stream.close();
                this.initializeStream();
        }
}

/**
 * チャンネル接続プール
 *
 * @remarks
 * 同じチャンネルへの接続を共有し、利用者が0になると3秒後に接続を切断する。
 * 直後に新たな利用者が現れた場合は切断をキャンセルする。
 *
 * @internal
 */
class Pool {
	/** チャンネル名 */
	public channel: string;
	/** プールの一意なID */
	public id: string;
	/** ストリームへの参照 */
	protected stream: Stream;
	/** 現在の利用者数 */
	private users = 0;
	/** 利用者0時の切断遅延タイマーID */
	private disposeTimerId: any;
	/** チャンネルに接続済みかどうか */
	private isConnected = false;

	/**
	 * Pool を生成する
	 *
	 * @param stream - ストリームへの参照
	 * @param channel - チャンネル名
	 * @internal
	 */
	constructor(stream: Stream, channel: string) {
		this.channel = channel;
		this.stream = stream;

		this.id = Math.random().toString();
	}

	/**
	 * 利用者数を増やす
	 *
	 * @remarks
	 * 初めての利用者の場合はチャンネルへの接続を開始する。
	 * 切断タイマーが設定されていればキャンセルする。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public inc() {
		if (this.users === 0 && !this.isConnected) {
			this.connect();
		}

		this.users++;

		// タイマー解除
		if (this.disposeTimerId) {
			clearTimeout(this.disposeTimerId);
			this.disposeTimerId = null;
		}
	}

	/**
	 * 利用者数を減らす
	 *
	 * @remarks
	 * 利用者が0になった場合、3秒後に接続を切断する。
	 * 直後に新たな利用者が {@link inc} で追加されれば切断はキャンセルされる。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public dec() {
		this.users--;

		// そのコネクションの利用者が誰もいなくなったら
		if (this.users === 0) {
			// また直ぐに再利用される可能性があるので、一定時間待ち、
			// 新たな利用者が現れなければコネクションを切断する
			this.disposeTimerId = setTimeout(() => {
				this.disconnect();
			}, 3000);
		}
	}

	/**
	 * チャンネルへの接続を開始する
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public connect() {
		this.isConnected = true;
		this.stream.send('connect', {
			channel: this.channel,
			id: this.id
		});
		log(`streamConnect : ` + this.channel + " : " + this.id);
	}

	/**
	 * チャンネルへの接続を切断する
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	private disconnect() {
		this.isConnected = false;
		this.disposeTimerId = null;
		this.stream.send('disconnect', { id: this.id });
		log(`streamDisconnect : ` + this.id);
	}
}

/**
 * チャンネル接続の抽象基底クラス
 *
 * @remarks
 * {@link SharedConnection} と {@link NonSharedConnection} の共通機能を提供する。
 * チャンネルへのメッセージ送信を共通の `send` メソッドで行う。
 *
 * @internal
 */
abstract class Connection extends EventEmitter {
	/** チャンネル名 */
	public channel: string;
	/** ストリームへの参照 */
	protected stream: Stream;
	/** コネクションの一意なID */
	public abstract id: string;

	/**
	 * Connection を生成する
	 *
	 * @param stream - ストリームへの参照
	 * @param channel - チャンネル名
	 * @internal
	 */
	constructor(stream: Stream, channel: string) {
		super();

		this.stream = stream;
		this.channel = channel;
	}

	/**
	 * チャンネルにメッセージを送信する
	 *
	 * @param id - コネクションID
	 * @param typeOrPayload - メッセージタイプまたはペイロード
	 * @param payload - ペイロード（タイプを第1引数にした場合）
	 * @returns なし
	 * @internal
	 */
	@autobind
	public send(id: string, typeOrPayload, payload?) {
		const type = payload === undefined ? typeOrPayload.type : typeOrPayload;
		const body = payload === undefined ? typeOrPayload.body : payload;

		this.stream.send('ch', {
			id: id,
			type: type,
			body: body
		});
	}

	/**
	 * コネクションを破棄する
	 * @returns なし
	 * @internal
	 */
	public abstract dispose(): void;
}

/**
 * 共有コネクション
 *
 * @remarks
 * {@link Pool} を介して同じチャンネルのIDを共有する。
 * プールの利用者カウントを管理し、全利用者が解除されるとプールが切断される。
 *
 * @internal
 */
class SharedConnection extends Connection {
	/** 所属するプール */
	private pool: Pool;

	/**
	 * プールのIDを返す
	 * @returns プールのコネクションID
	 * @internal
	 */
	public get id(): string {
		return this.pool.id;
	}

	/**
	 * SharedConnection を生成する
	 *
	 * @remarks
	 * 生成時にプールの利用者数を1つ増やす。
	 *
	 * @param stream - ストリームへの参照
	 * @param channel - チャンネル名
	 * @param pool - プール
	 * @internal
	 */
	constructor(stream: Stream, channel: string, pool: Pool) {
		super(stream, channel);

		this.pool = pool;
		this.pool.inc();
	}

	/**
	 * プールのIDを使ってチャンネルにメッセージを送信する
	 *
	 * @param typeOrPayload - メッセージタイプまたはペイロード
	 * @param payload - ペイロード
	 * @returns なし
	 * @internal
	 */
	@autobind
	public send(typeOrPayload, payload?) {
		super.send(this.pool.id, typeOrPayload, payload);
	}

	/**
	 * コネクションを破棄する
	 *
	 * @remarks
	 * プールの利用者数を減らし、イベントリスナーを全て削除し、
	 * ストリームの共有コネクション一覧からも削除する。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public dispose() {
		this.pool.dec();
		this.removeAllListeners();
		this.stream.removeSharedConnection(this);
	}
}

/**
 * 専用コネクション
 *
 * @remarks
 * 各インスタンスが独自のIDを持つ。
 * パラメータ付きのチャンネル接続に使用される。
 * コンストラクタ内で即座に接続を開始する。
 *
 * @internal
 */
class NonSharedConnection extends Connection {
	/** この接続の一意なID */
	public id: string;
	/** チャンネル接続パラメータ */
	protected params: any;

	/**
	 * NonSharedConnection を生成する
	 *
	 * @remarks
	 * 生成時に即座にチャンネルへの接続を開始する。
	 *
	 * @param stream - ストリームへの参照
	 * @param channel - チャンネル名
	 * @param params - チャンネル接続パラメータ
	 * @internal
	 */
	constructor(stream: Stream, channel: string, params?: any) {
		super(stream, channel);

		this.params = params;
		this.id = Math.random().toString();

		this.connect();
	}

	/**
	 * チャンネルへの接続を開始する
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public connect() {
		this.stream.send('connect', {
			channel: this.channel,
			id: this.id,
			params: this.params
		});
		log(`streamConnectNonShared : ` + this.channel + " : " + this.id + " : " + this.params);
	}

	/**
	 * この接続のIDを使ってチャンネルにメッセージを送信する
	 *
	 * @param typeOrPayload - メッセージタイプまたはペイロード
	 * @param payload - ペイロード
	 * @returns なし
	 * @internal
	 */
	@autobind
	public send(typeOrPayload, payload?) {
		super.send(this.id, typeOrPayload, payload);
	}

	/**
	 * コネクションを破棄する
	 *
	 * @remarks
	 * イベントリスナーを削除し、切断メッセージを送信し、
	 * ストリームの専用コネクション一覧からも削除する。
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public dispose() {
		this.removeAllListeners();
		this.stream.send('disconnect', { id: this.id });
		log(`streamDisconnectNonShared : ` + this.id);
		this.stream.disconnectToChannel(this);
	}
}

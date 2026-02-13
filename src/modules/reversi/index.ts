/**
 * @packageDocumentation
 *
 * リバーシ（オセロ）対局モジュール
 *
 * Misskey のリバーシ機能を使って、ユーザーとAIが対局を行うモジュール。
 * ゲームの思考処理は別プロセス（back.ts）で実行される。
 *
 * @remarks
 * WARNING: 現在このモジュールは **実質無効化** されている。
 *          `install()` 内の `if (true || !config.reversiEnabled)` により、
 *          常に早期リターンする。また `mentionHook` 内の `if (false && config.reversiEnabled)` により、
 *          メンションによるゲーム開始もブロックされ、常に辞退メッセージが返る。
 *
 * NOTE: 対局終了時に1日1回だけ親愛度が +1（実効 +5）上昇する仕組みがあるが、
 *       モジュール自体が無効なため、この処理も実行されない。
 *
 * @public
 */
import * as childProcess from 'child_process';
import autobind from 'autobind-decorator';
import Module from '@/module';
import serifs from '@/serifs';
import config from '@/config';
import Message from '@/message';
import Friend from '@/friend';
import getDate from '@/utils/get-date';

/**
 * リバーシモジュールクラス
 *
 * @remarks
 * 招待・マッチング・ゲーム実行・終了処理を管理する。
 * ゲームの思考ロジック自体は `back.ts` で別プロセスとして実行される。
 *
 * @public
 */
export default class extends Module {
	public readonly name = 'reversi';

	/**
	 * リバーシ用のWebSocketストリーム接続
	 *
	 * @internal
	 */
	private reversiConnection?: any;

	/**
	 * モジュールの初期化
	 *
	 * @remarks
	 * WARNING: `if (true || !config.reversiEnabled)` により常に早期リターンし、
	 *          モジュールは実質無効化されている。
	 *
	 * @returns フック登録オブジェクト、または空オブジェクト
	 * @public
	 */
	@autobind
	public install() {
		// WARNING: `true ||` により常に早期リターン → モジュール無効化
		if (true || !config.reversiEnabled) return {};

		this.reversiConnection = this.ai.connection.useSharedConnection('gamesReversi');

		// リバーシの招待を受信
		this.reversiConnection.on('invited', msg => this.onReversiInviteMe(msg.parent));

		// マッチング成立を受信
		this.reversiConnection.on('matched', msg => this.onReversiGameStart(msg));

		if (config.reversiEnabled) {
			const mainStream = this.ai.connection.useSharedConnection('main');
			mainStream.on('pageEvent', msg => {
				if (msg.event === 'inviteReversi') {
					this.ai.api('games/reversi/match', {
						userId: msg.user.id
					});
				}
			});
		}

		return {
			mentionHook: this.mentionHook
		};
	}

	/**
	 * メンション受信時のフック: リバーシ対局リクエスト
	 *
	 * @remarks
	 * WARNING: `if (false && config.reversiEnabled)` により常に辞退メッセージが返る。
	 *
	 * @param msg - 受信メッセージ
	 * @returns マッチした場合は `true`、しなかった場合は `false`
	 * @internal
	 */
	@autobind
	private async mentionHook(msg: Message) {
		if (msg.includes(['リバーシ', 'オセロ', 'reversi', 'othello'])) {
			// WARNING: `false &&` により常に辞退メッセージが返る
			if (false && config.reversiEnabled) {
				msg.reply(serifs.reversi.ok);

				this.ai.api('games/reversi/match', {
					userId: msg.userId
				});
			} else {
				msg.reply(serifs.reversi.decline);
			}

			return true;
		} else {
			return false;
		}
	}

	/**
	 * リバーシの招待を受信した際の処理
	 *
	 * @param inviter - 招待したユーザーの情報
	 * @internal
	 */
	@autobind
	private async onReversiInviteMe(inviter: any) {
		this.log(`Someone invited me: @${inviter.username}`);

		if (config.reversiEnabled) {
			// 対局を承認
			const game = await this.ai.api('games/reversi/match', {
				userId: inviter.id
			});

			this.onReversiGameStart(game);
		} else {
			// TODO: リバーシできない旨をメッセージで伝える
		}
	}

	/**
	 * リバーシゲーム開始時の処理
	 *
	 * @remarks
	 * ゲームストリームに接続し、back.ts をサブプロセスとして起動する。
	 * ゲーム情報・フォーム設定・アカウント情報をバックエンドプロセスに送信し、
	 * バックエンドからの指示（石の配置、ゲーム終了）をストリーム経由でMisskeyに伝える。
	 *
	 * 強さ設定:
	 * - 接待 (0), 弱 (2), 中 (3), 強 (4), 最強 (5)
	 *
	 * @param game - Misskey リバーシゲームオブジェクト
	 * @internal
	 */
	@autobind
	private onReversiGameStart(game: any) {
		this.log('enter reversi game room');

		// ゲームストリームに接続
		const gw = this.ai.connection.connectToChannel('gamesReversiGame', {
			gameId: game.id
		});

		// 対局設定フォーム
		const form = [{
			id: 'publish',
			type: 'switch',
			label: '藍が対局情報を投稿するのを許可',
			value: true
		}, {
			id: 'strength',
			type: 'radio',
			label: '強さ',
			value: 3,
			items: [{
				label: '接待',
				value: 0
			}, {
				label: '弱',
				value: 2
			}, {
				label: '中',
				value: 3
			}, {
				label: '強',
				value: 4
			}, {
				label: '最強',
				value: 5
			}]
		}];

		//#region バックエンドプロセス開始
		const ai = childProcess.fork(__dirname + '/back.js');

		// バックエンドプロセスにゲーム情報を渡す
		ai.send({
			type: '_init_',
			body: {
				game: game,
				form: form,
				account: this.ai.account
			}
		});

		ai.on('message', (msg: Record<string, any>) => {
			if (msg.type == 'put') {
				// バックエンドからの石配置指示
				gw.send('set', {
					pos: msg.pos
				});
			} else if (msg.type == 'ended') {
				// ゲーム終了
				gw.dispose();

				this.onGameEnded(game);
			}
		});

		// ゲームストリームからの情報をバックエンドプロセスに転送
		gw.addListener('*', message => {
			ai.send(message);
		});
		//#endregion

		// フォーム初期化（1秒後）
		setTimeout(() => {
			gw.send('initForm', form);
		}, 1000);

		// 対局を受諾（2秒後）
		setTimeout(() => {
			gw.send('accept', {});
		}, 2000);
	}

	/**
	 * ゲーム終了時の処理: 親愛度の更新
	 *
	 * @remarks
	 * 1日に1回だけ対戦相手の親愛度を +1（実効 +5）上昇させる。
	 *
	 * @param game - 終了したゲームオブジェクト
	 * @internal
	 */
	@autobind
	private onGameEnded(game: any) {
		const user = game.user1Id == this.ai.account.id ? game.user2 : game.user1;

		//#region 1日に1回だけ親愛度を上げる
		const today = getDate();

		const friend = new Friend(this.ai, { user: user });

		const data = friend.getPerModulesData(this);

		if (data.lastPlayedAt != today) {
			data.lastPlayedAt = today;
			friend.setPerModulesData(this, data);

			friend.incLove();
		}
		//#endregion
	}
}

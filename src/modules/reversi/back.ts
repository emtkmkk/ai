/**
 * @packageDocumentation
 *
 * リバーシの思考エンジン（back）
 *
 * @remarks
 * - **Session**: 従来の Misskey リバーシ用。子プロセスとして fork され、親から _init_ / started / set / ended を受信する。本ファイルを直接実行したときのみ使用。
 * - **ReversiGameSession**: reversi-service 用。同一プロセス内で started / log / ended / sync を受け、超単純モードで思考し putStone / ready を送信する。{@link ../index | reversi モジュール}から利用される。
 *
 * @internal
 */

import 'module-alias/register';

import * as request from 'request-promise-native';
import Reversi, { Color } from 'misskey-reversi';
import config from '@/config';
import serifs from '@/serifs';
import log from '@/utils/log';
import { acct } from '@/utils/acct';
import { User } from '@/misskey/user';

function getUserName(user) {
	return user.name || user.username;
}

const titles = [
	'さん', 'サン', 'ｻﾝ', '㌠',
	'ちゃん', 'チャン', 'ﾁｬﾝ',
	'君', 'くん', 'クン', 'ｸﾝ',
	'先生', 'せんせい', 'センセイ', 'ｾﾝｾｲ'
];

class Session {
	private account: User;
	private game: any;
	private form: any;
	private o: Reversi;
	private botColor: Color;

	/**
	 * 隅周辺のインデックスリスト(静的評価に利用)
	 */
	private sumiNearIndexes: number[] = [];

	/**
	 * 隅のインデックスリスト(静的評価に利用)
	 */
	private sumiIndexes: number[] = [];

	/**
	 * 最大のターン数
	 */
	private maxTurn;

	/**
	 * 現在のターン数
	 */
	private currentTurn = 0;

	/**
	 * 対局が開始したことを知らせた投稿
	 */
	private startedNote: any = null;

	private get user(): User {
		return this.game.user1Id == this.account.id ? this.game.user2 : this.game.user1;
	}

	private get userName(): string {
		const name = getUserName(this.user);
		return `?[${name}](${config.host}/@${this.user.username})${titles.some(x => name.endsWith(x)) ? '' : 'さん'}`;
	}

	private get strength(): number {
		return this.form.find(i => i.id == 'strength').value;
	}

	private get isSettai(): boolean {
		return this.strength === 0;
	}

	private get allowPost(): boolean {
		return this.form.find(i => i.id == 'publish').value;
	}

	private get url(): string {
		return `${config.host}/games/reversi/${this.game.id}`;
	}

	constructor() {
		process.on('message', this.onMessage);
	}

	private onMessage = async (msg: any) => {
		switch (msg.type) {
			case '_init_': this.onInit(msg.body); break;
			case 'updateForm': this.onUpdateForn(msg.body); break;
			case 'started': this.onStarted(msg.body); break;
			case 'ended': this.onEnded(msg.body); break;
			case 'set': this.onSet(msg.body); break;
		}
	};

	// 親プロセスからデータをもらう
	private onInit = (msg: any) => {
		this.game = msg.game;
		this.form = msg.form;
		this.account = msg.account;
	};

	/**
	 * フォームが更新されたとき
	 */
	private onUpdateForn = (msg: any) => {
		this.form.find(i => i.id == msg.id).value = msg.value;
	};

	/**
	 * 対局が始まったとき
	 */
	private onStarted = (msg: any) => {
		this.game = msg;

		// TLに投稿する
		this.postGameStarted().then(note => {
			this.startedNote = note;
		});

		// リバーシエンジン初期化
		this.o = new Reversi(this.game.map, {
			isLlotheo: this.game.isLlotheo,
			canPutEverywhere: this.game.canPutEverywhere,
			loopedBoard: this.game.loopedBoard
		});

		this.maxTurn = this.o.map.filter(p => p === 'empty').length - this.o.board.filter(x => x != null).length;

		//#region 隅の位置計算など

		//#region 隅
		this.o.map.forEach((pix, i) => {
			if (pix == 'null') return;

			const [x, y] = this.o.transformPosToXy(i);
			const get = (x, y) => {
				if (x < 0 || y < 0 || x >= this.o.mapWidth || y >= this.o.mapHeight) return 'null';
				return this.o.mapDataGet(this.o.transformXyToPos(x, y));
			};

			const isNotSumi = (
				// -
				//  +
				//   -
				(get(x - 1, y - 1) == 'empty' && get(x + 1, y + 1) == 'empty') ||

				//  -
				//  +
				//  -
				(get(x, y - 1) == 'empty' && get(x, y + 1) == 'empty') ||

				//   -
				//  +
				// -
				(get(x + 1, y - 1) == 'empty' && get(x - 1, y + 1) == 'empty') ||

				//
				// -+-
				//
				(get(x - 1, y) == 'empty' && get(x + 1, y) == 'empty')
			);

			const isSumi = !isNotSumi;

			if (isSumi) this.sumiIndexes.push(i);
		});
		//#endregion

		//#region 隅の隣
		this.o.map.forEach((pix, i) => {
			if (pix == 'null') return;
			if (this.sumiIndexes.includes(i)) return;

			const [x, y] = this.o.transformPosToXy(i);

			const check = (x, y) => {
				if (x < 0 || y < 0 || x >= this.o.mapWidth || y >= this.o.mapHeight) return 0;
				return this.sumiIndexes.includes(this.o.transformXyToPos(x, y));
			};

			const isSumiNear = (
				check(x - 1, y - 1) || // 左上
				check(x, y - 1) || // 上
				check(x + 1, y - 1) || // 右上
				check(x + 1, y) || // 右
				check(x + 1, y + 1) || // 右下
				check(x, y + 1) || // 下
				check(x - 1, y + 1) || // 左下
				check(x - 1, y)    // 左
			);

			if (isSumiNear) this.sumiNearIndexes.push(i);
		});
		//#endregion

		//#endregion

		this.botColor = this.game.user1Id == this.account.id && this.game.black == 1 || this.game.user2Id == this.account.id && this.game.black == 2;

		if (this.botColor) {
			this.think();
		}
	};

	/**
	 * 対局が終わったとき
	 */
	private onEnded = async (msg: any) => {
		// ストリームから切断
		process.send!({
			type: 'ended'
		});

		let text: string;

		const name = getUserName(this.user);
		const at = acct(this.user);
		if (msg.game.surrendered) {
			if (this.isSettai) {
				text = serifs.reversi.settaiButYouSurrendered(name);
			} else {
				text = serifs.reversi.youSurrendered(name);
			}
		} else if (msg.winnerId) {
			if (msg.winnerId == this.account.id) {
				if (this.isSettai) {
					text = serifs.reversi.iWonButSettai(name);
				} else {
					text = serifs.reversi.iWon(name);
				}
			} else {
				if (this.isSettai) {
					text = serifs.reversi.iLoseButSettai(name);
				} else {
					text = serifs.reversi.iLose(name);
				}
			}
		} else {
			if (this.isSettai) {
				text = serifs.reversi.drawnSettai(name);
			} else {
				text = serifs.reversi.drawn(name);
			}
		}
		text = `${at} ${text}`;

		await this.post(text, this.startedNote);

		process.exit();
	};

	/**
	 * 打たれたとき
	 */
	private onSet = (msg: any) => {
		this.o.put(msg.color, msg.pos);
		this.currentTurn++;

		if (msg.next === this.botColor) {
			this.think();
		}
	};

	/**
	 * Botにとってある局面がどれだけ有利か静的に評価する
	 * static(静的)というのは、先読みはせずに盤面の状態のみで評価するということ。
	 * TODO: 接待時はまるっと処理の中身を変え、とにかく相手が隅を取っていること優先な評価にする
	 */
	private staticEval = () => {
		let score = this.o.canPutSomewhere(this.botColor).length;

		for (const index of this.sumiIndexes) {
			const stone = this.o.board[index];

			if (stone === this.botColor) {
				score += 1000; // 自分が隅を取っていたらスコアプラス
			} else if (stone !== null) {
				score -= 1000; // 相手が隅を取っていたらスコアマイナス
			}
		}

		// TODO: ここに (隅以外の確定石の数 * 100) をスコアに加算する処理を入れる

		for (const index of this.sumiNearIndexes) {
			const stone = this.o.board[index];

			if (stone === this.botColor) {
				score -= 10; // 自分が隅の周辺を取っていたらスコアマイナス(危険なので)
			} else if (stone !== null) {
				score += 10; // 相手が隅の周辺を取っていたらスコアプラス
			}
		}

		// ロセオならスコアを反転
		if (this.game.isLlotheo) score = -score;

		// 接待ならスコアを反転
		if (this.isSettai) score = -score;

		return score;
	};

	private think = () => {
		console.log(`(${this.currentTurn}/${this.maxTurn}) Thinking...`);
		console.time('think');

		// 接待モードのときは、全力(5手先読みくらい)で負けるようにする
		// TODO: 接待のときは、どちらかというと「自分が不利になる手を選ぶ」というよりは、「相手に角を取らせられる手を選ぶ」ように思考する
		//       自分が不利になる手を選ぶというのは、換言すれば自分が打てる箇所を減らすことになるので、
		//       自分が打てる箇所が少ないと結果的に思考の選択肢が狭まり、対局をコントロールするのが難しくなるジレンマのようなものがある。
		//       つまり「相手を勝たせる」という意味での正しい接待は、「ゲーム序盤・中盤までは(通常通り)自分の有利になる手を打ち、終盤になってから相手が勝つように打つ」こと。
		//       とはいえ藍に求められているのは、そういった「本物の」接待ではなく、単に「角を取らせてくれる」接待だと思われるので、
		//       静的評価で「角に相手の石があるかどうか(と、ゲームが終わったときは相手が勝っているかどうか)」を考慮するようにすれば良いかもしれない。
		const maxDepth = this.isSettai ? 5 : this.strength;

		/**
		 * αβ法での探索
		 */
		const dive = (pos: number, alpha = -Infinity, beta = Infinity, depth = 0): number => {
			// 試し打ち
			this.o.put(this.o.turn, pos);

			const isBotTurn = this.o.turn === this.botColor;

			// 勝った
			if (this.o.turn === null) {
				const winner = this.o.winner;

				// 勝つことによる基本スコア
				const base = 10000;

				let score;

				if (this.game.isLlotheo) {
					// 勝ちは勝ちでも、より自分の石を少なくした方が美しい勝ちだと判定する
					score = this.o.winner ? base - (this.o.blackCount * 100) : base - (this.o.whiteCount * 100);
				} else {
					// 勝ちは勝ちでも、より相手の石を少なくした方が美しい勝ちだと判定する
					score = this.o.winner ? base + (this.o.blackCount * 100) : base + (this.o.whiteCount * 100);
				}

				// 巻き戻し
				this.o.undo();

				// 接待なら自分が負けた方が高スコア
				return this.isSettai
					? winner !== this.botColor ? score : -score
					: winner === this.botColor ? score : -score;
			}

			if (depth === maxDepth) {
				// 静的に評価
				const score = this.staticEval();

				// 巻き戻し
				this.o.undo();

				return score;
			} else {
				const cans = this.o.canPutSomewhere(this.o.turn);

				let value = isBotTurn ? -Infinity : Infinity;
				let a = alpha;
				let b = beta;

				// TODO: 残りターン数というよりも「空いているマスが12以下」の場合に完全読みさせる
				const nextDepth = (this.strength >= 4) && ((this.maxTurn - this.currentTurn) <= 12) ? Infinity : depth + 1;

				// 次のターンのプレイヤーにとって最も良い手を取得
				// TODO: cansをまず浅く読んで(または価値マップを利用して)から有益そうな手から順に並べ替え、効率よく枝刈りできるようにする
				for (const p of cans) {
					if (isBotTurn) {
						const score = dive(p, a, beta, nextDepth);
						value = Math.max(value, score);
						a = Math.max(a, value);
						if (value >= beta) break;
					} else {
						const score = dive(p, alpha, b, nextDepth);
						value = Math.min(value, score);
						b = Math.min(b, value);
						if (value <= alpha) break;
					}
				}

				// 巻き戻し
				this.o.undo();

				return value;
			}
		};

		const cans = this.o.canPutSomewhere(this.botColor);
		const scores = cans.map(p => dive(p));
		const pos = cans[scores.indexOf(Math.max(...scores))];

		console.log('Thinked:', pos);
		console.timeEnd('think');

		setTimeout(() => {
			process.send!({
				type: 'put',
				pos
			});
		}, 500);
	};

	/**
	 * 対局が始まったことをMisskeyに投稿します
	 */
	private postGameStarted = async () => {
		const text = this.isSettai
			? serifs.reversi.startedSettai(this.userName)
			: serifs.reversi.started(this.userName, this.strength.toString());

		return await this.post(`${text}\n→[観戦する](${this.url})`);
	};

	/**
	 * Misskeyに投稿します
	 * @param text 投稿内容
	 */
	private post = async (text: string, renote?: any) => {
		if (this.allowPost) {
			const body = {
				i: config.i,
				text: text,
				visibility: 'home'
			} as any;

			if (renote) {
				body.renoteId = renote.id;
			}

			try {
				const res = await request.post(`${config.host}/api/notes/create`, {
					json: body
				});

				return res.createdNote;
			} catch (e) {
				console.error(e);
				return null;
			}
		} else {
			return null;
		}
	};
}

/**
 * reversi-service 用の対局セッション（同一プロセスで使用）
 *
 * @remarks
 * started / log / ended / sync を受け取り、超単純または単純モードで思考し putStone / ready を送信する。
 * 単純モードは変則盤対応・未来読みなしで、角/C/X/GoodEdge2/GoodInner/辺の優先・回避とタイブレークにより 1 手を決める。
 * canPutEverywhere が true の game は対応せず、onEndedCallback で即終了する。
 *
 * @internal
 */
export class ReversiGameSession {
	private gameId: string;
	private account: User;
	private sendPutStone: (pos: number) => void;
	private sendReady: () => void;
	/** 終局時: (結果種別, 対戦相手 User, winnerId, 単純モードか, 石差)。decline のときは ('decline', null, null, false)。石差は iWon/iLose のときのみ渡す */
	private onEndedCallback: (resultType: string, opponentUser: User | null, winnerId: string | null, useSimpleMode: boolean, stoneDiff?: number) => void;
	/** 現在の game オブジェクト（started / sync でセット）。user1, user2 等を含む */
	private game: any;
	/** リバーシエンジン（misskey-reversi）。started / sync で初期化、log で着手を適用 */
	private o: Reversi | null = null;
	private botColor: Color | null = null;
	/** 隅のマス位置（8x8 なら 0,7,56,63 等）。超単純思考で隅優先に利用 */
	private sumiIndexes: number[] = [];
	/** 隅に隣接するマス位置。角が空のときのみ避ける対象 */
	private sumiNearIndexes: number[] = [];
	private currentTurn = 0;
	private maxTurn = 0;
	/** 観戦URL（任意）。表示用 */
	private gameUrl: string;
	/** 単純モード（変則盤対応・未来読みなし）で思考するか。false のときは超単純モード */
	private useSimpleMode: boolean;
	/** 思考を 500ms 後に実行するタイマーを既に張ったか。sync と started の両方でスケジュールしないようガードする */
	private thinkScheduled = false;

	/**
	 * 対局セッションを生成する
	 *
	 * @param gameId - ゲーム ID
	 * @param account - 藍のアカウント（手番判定に使用）
	 * @param sendPutStone - 石を置く手を送信するコールバック
	 * @param sendReady - ready を送信するコールバック
	 * @param onEndedCallback - 終局時に結果種別・対戦相手・勝者 ID ・単純モード・石差（任意）を渡して呼ぶコールバック
	 * @param gameUrl - 観戦用 URL（省略可）
	 * @param useSimpleMode - 単純モードで思考するか。省略時は false（超単純）
	 *
	 * @internal
	 */
	constructor(
		gameId: string,
		account: User,
		sendPutStone: (pos: number) => void,
		sendReady: () => void,
		onEndedCallback: (resultType: string, opponentUser: User | null, winnerId: string | null, useSimpleMode: boolean, stoneDiff?: number) => void,
		gameUrl?: string,
		useSimpleMode?: boolean
	) {
		this.gameId = gameId;
		this.account = account;
		this.sendPutStone = sendPutStone;
		this.sendReady = sendReady;
		this.onEndedCallback = onEndedCallback;
		this.gameUrl = gameUrl || '';
		this.useSimpleMode = useSimpleMode === true;
	}

	/** 対戦相手の User（user1 が自分なら user2、そうでなければ user1）。user1/user2 がオブジェクトの形式にも対応 */
	private get user(): User {
		const id = String(this.account.id);
		const isUser1 = this.game.user1Id === id || this.game.user1Id === this.account.id ||
			(this.game.user1 && String((this.game.user1 as any).id ?? (this.game.user1 as any).userId ?? '') === id);
		return isUser1 ? this.game.user2 : this.game.user1;
	}

	/** 対戦相手の表示名（Markdown リンク＋敬称） */
	private get userName(): string {
		const name = getUserName(this.user);
		return `?[${name}](${config.host}/@${this.user.username})${titles.some(x => name.endsWith(x)) ? '' : 'さん'}`;
	}

	/**
	 * game.map を misskey-reversi が期待する形式（8行×8文字、'-'/'b'/'w'）に正規化する。
	 * reversi-service は 64 文字 1 文字列で '1'/'2' を使うため、8x8 配列と 'b'/'w' に変換する。
	 *
	 * @param map - game.map（64 文字列または string[]）
	 * @returns 8 要素の string[]（各要素は 8 文字。'-'=空、'b'=黒、'w'=白）
	 *
	 * @internal
	 */
	private static normalizeMapForEngine(map: string | string[]): string[] {
		if (Array.isArray(map)) {
			if (map.length === 8 && map[0]?.length === 8) return map as string[];
			const joined = map.join('');
			if (joined.length !== 64) return map as string[];
			map = joined;
		}
		if (typeof map !== 'string' || map.length !== 64) {
			return [map as string];
		}
		const rows: string[] = [];
		for (let r = 0; r < 8; r++) {
			let row = '';
			for (let c = 0; c < 8; c++) {
				const ch = map[r * 8 + c];
				row += ch === '1' ? 'b' : ch === '2' ? 'w' : ch === '-' ? '-' : ch;
			}
			rows.push(row);
		}
		return rows;
	}

	/**
	 * game オブジェクトとアカウント ID から「自分が黒か」を判定する。
	 * reversi-service が user1Id/user2Id の代わりに user1.id / user2.id や black を boolean で送る形式にも対応する。
	 *
	 * @param game - started / sync で受け取った game オブジェクト
	 * @param accountId - 藍のアカウント ID
	 * @returns 黒なら true、白なら false。判定できないときは null
	 *
	 * @internal
	 */
	private static resolveBotColor(game: any, accountId: string): Color | null {
		if (!game || accountId == null) return null;
		const id = String(accountId);
		const isUser1 = game.user1Id === id || game.user1Id === accountId ||
			(game.user1 && (String((game.user1 as any).id ?? (game.user1 as any).userId ?? '') === id));
		const isUser2 = game.user2Id === id || game.user2Id === accountId ||
			(game.user2 && (String((game.user2 as any).id ?? (game.user2 as any).userId ?? '') === id));
		// black: 1 or true = user1 が黒、2 or false = user2 が黒（数値は Misskey 互換）
		if (isUser1 && (game.black === 1 || game.black === true)) return true;
		if (isUser2 && (game.black === 2 || game.black === false)) return true;
		if (isUser1 && (game.black === 2 || game.black === false)) return false;
		if (isUser2 && (game.black === 1 || game.black === true)) return false;
		return null;
	}

	/**
	 * started 受信時の処理。エンジン初期化・隅リスト計算・ready 送信・先手なら思考開始
	 *
	 * @param body - メッセージ body（game を含む）
	 *
	 * @remarks
	 * canPutEverywhere が true の game は対応しないため、onEndedCallback で即終了する。
	 * 先手（黒）はエンジンの turn が黒かつ自分が黒のときにも思考開始する（resolveBotColor が null のときの保険）。
	 *
	 * @internal
	 */
	onStarted(body: { game: any }) {
		log(`[reversi] onStarted gameId=${this.gameId}`);
		this.game = body.game;
		if (this.game.canPutEverywhere) {
			log(`[reversi] onStarted decline (canPutEverywhere)`);
			this.onEndedCallback('decline', null, null, this.useSimpleMode);
			return; // 変則ルールは未対応
		}
		this.o = new Reversi(ReversiGameSession.normalizeMapForEngine(this.game.map), {
			isLlotheo: this.game.isLlotheo,
			canPutEverywhere: this.game.canPutEverywhere,
			loopedBoard: this.game.loopedBoard
		});
		this.maxTurn = this.o.map.filter((p: string) => p === 'empty').length - this.o.board.filter((x: any) => x != null).length;
		this.currentTurn = 0;
		this.computeSumiIndexes();
		this.botColor = ReversiGameSession.resolveBotColor(this.game, this.account.id);
		if (this.botColor == null) {
			// game の形式が想定外のとき、エンジン初期手番に合わせて botColor を推定（招待主＝ホストが黒の実装に合わせる）
			const engineTurn = (this.o as any).turn;
			if (engineTurn === true) this.botColor = true;
			else if (engineTurn === false) this.botColor = false;
		}
		const engineTurn = (this.o as any).turn;
		const isMyTurn = this.botColor != null && engineTurn === this.botColor;
		log(`[reversi] onStarted botColor=${this.botColor} engineTurn=${engineTurn} isMyTurn=${isMyTurn}`);
		this.sendReady();
		if (isMyTurn && !this.thinkScheduled) {
			this.thinkScheduled = true;
			const delayMs = this.getThinkDelayMs();
			log(`[reversi] onStarted scheduling think in ${delayMs}ms`);
			setTimeout(() => (this.useSimpleMode ? this.thinkSimple() : this.thinkSuperSimple()), delayMs);
		} else if (isMyTurn && this.thinkScheduled) {
			log(`[reversi] onStarted skip schedule (already scheduled by sync)`);
		}
	}

	/**
	 * log（着手）受信時の処理。エンジンに着手を適用し、次が自分なら思考を開始する
	 *
	 * @param body - メッセージ body（pos 必須。color / black のほか、reversi-service は hostName/guestName で着手者を送る）
	 *
	 * @internal
	 */
	onLog(body: any) {
		if (!this.o) return;
		const pos = body.pos;
		if (pos == null) return;
		log(`[reversi] onLog gameId=${this.gameId} pos=${pos} (opponent move)`);
		// 色: 明示値 > reversi-service は hostName/guestName で着手者を送るので game.black から推定 > 従来の black
		let color: boolean;
		if (body.color != null) {
			color = body.color === 1 || body.color === true;
		} else if (body.hostName != null || body.guestName != null) {
			const hostMoved = body.hostName != null;
			color = (hostMoved && this.game.black === 1) || (!hostMoved && this.game.black === 2);
		} else {
			color = body.black === true || body.black === 1;
		}
		this.o.put(color, pos);
		this.currentTurn++;
		const isMyTurn = (this.o as any).turn === this.botColor;
		log(`[reversi] onLog after put isMyTurn=${isMyTurn}`);
		if (isMyTurn) {
			const delayMs = this.getThinkDelayMs();
			log(`[reversi] onLog scheduling think in ${delayMs}ms`);
			setTimeout(() => (this.useSimpleMode ? this.thinkSimple() : this.thinkSuperSimple()), delayMs);
		}
	}

	/**
	 * sync 受信時の処理。切断復帰用に盤面・手番を再構築する
	 *
	 * @param body - メッセージ body（game, board / boardState, turn 等）
	 *
	 * @remarks
	 * body に board または boardState があればエンジンの盤面を上書き、turn があれば手番を設定する。
	 *
	 * @internal
	 */
	onSync(body: any) {
		log(`[reversi] onSync gameId=${this.gameId}`);
		const game = body.game || body;
		this.game = game;
		if (game.canPutEverywhere) {
			log(`[reversi] onSync decline (canPutEverywhere)`);
			this.onEndedCallback('decline', null, null, this.useSimpleMode);
			return;
		}
		this.o = new Reversi(ReversiGameSession.normalizeMapForEngine(game.map), {
			isLlotheo: game.isLlotheo,
			canPutEverywhere: game.canPutEverywhere,
			loopedBoard: game.loopedBoard
		});
		// サーバーから受け取った盤面で上書き（sync で復帰するため）。reversi-service は "empty"|"black"|"white"、エンジンは null|true|false
		if (body.board != null || body.boardState != null) {
			const board = body.board || body.boardState;
			for (let i = 0; i < (this.o as any).board.length; i++) {
				const c = board[i];
				if (c === 'black') (this.o as any).board[i] = true;
				else if (c === 'white') (this.o as any).board[i] = false;
				else if (c === 'empty' || c == null) (this.o as any).board[i] = null;
				else if (c === true || c === false) (this.o as any).board[i] = c;
			}
		}
		// 手番: エンジンは boolean（true=黒）。reversi-service は "host"|"guest"、他は 1/0 の可能性あり
		if (body.turn != null) {
			const t = body.turn;
			if (t === 'host' || t === 'guest') {
				(this.o as any).turn = (t === 'host' && game.black === 1) || (t === 'guest' && game.black === 2);
			} else {
				(this.o as any).turn = t === 1 || t === true ? true : t === 0 || t === false ? false : t;
			}
		}
		this.currentTurn = this.o.board.filter((x: any) => x != null).length - 4;
		this.botColor = ReversiGameSession.resolveBotColor(game, this.account.id);
		if (this.botColor == null) {
			const engineTurn = (this.o as any).turn;
			if (engineTurn === true) this.botColor = true;
			else if (engineTurn === false) this.botColor = false;
		}
		this.computeSumiIndexes();
		const engineTurn = (this.o as any).turn;
		const isMyTurn = this.botColor != null && engineTurn === this.botColor;
		log(`[reversi] onSync gameId=${this.gameId} botColor=${this.botColor} engineTurn=${engineTurn} isMyTurn=${isMyTurn}`);
		if (isMyTurn && !this.thinkScheduled) {
			this.thinkScheduled = true;
			const delayMs = this.getThinkDelayMs();
			log(`[reversi] onSync scheduling think in ${delayMs}ms`);
			setTimeout(() => (this.useSimpleMode ? this.thinkSimple() : this.thinkSuperSimple()), delayMs);
		}
	}

	/**
	 * ended 受信時の処理。勝敗・投了・引き分けに応じた結果テキストを組み立て、コールバックで返す
	 *
	 * @param body - メッセージ body（game, winnerId, surrendered 等）
	 *
	 * @internal
	 */
	onEnded(body: any) {
		const msg = body.game ? body : { game: body };
		const winnerId: string | null = msg.winnerId ?? msg.game?.winnerId ?? null;
		const opponentUser = this.user as User;
		let resultType: string;
		// NOTE: 対局中の時間切れは reversi-service が body に timeout を付与する想定。未送信の場合は drawn 扱いになる
		if (msg.game?.timeout === true || msg.timeout === true) {
			resultType = 'timeout';
		} else if (msg.game?.surrendered) {
			resultType = 'youSurrendered';
		} else if (winnerId) {
			resultType = winnerId === this.account.id ? 'iWon' : 'iLose';
		} else {
			resultType = 'drawn';
		}
		// 勝敗が決まったときのみ石差を計算（エンジンの盤面から黒/白の数を数える）
		let stoneDiff: number | undefined;
		if ((resultType === 'iWon' || resultType === 'iLose') && this.o?.board) {
			const board = (this.o as any).board as (boolean | null)[];
			const black = board.filter(x => x === true).length;
			const white = board.filter(x => x === false).length;
			stoneDiff = Math.abs(black - white);
		}
		this.onEndedCallback(resultType, opponentUser, winnerId, this.useSimpleMode, stoneDiff);
	}

	/** 隅（sumiIndexes）と隅に隣接するマス（sumiNearIndexes）を map から計算する。超単純思考で使用。 */
	private computeSumiIndexes() {
		if (!this.o) return;
		this.sumiIndexes = [];
		this.sumiNearIndexes = [];
		const o = this.o as any;
		o.map.forEach((pix: string, i: number) => {
			if (pix === 'null') return;
			const [x, y] = o.transformPosToXy(i);
			const get = (xx: number, yy: number) => {
				if (xx < 0 || yy < 0 || xx >= o.mapWidth || yy >= o.mapHeight) return 'null';
				return o.mapDataGet(o.transformXyToPos(xx, yy));
			};
			const isNotSumi = (
				(get(x - 1, y - 1) === 'empty' && get(x + 1, y + 1) === 'empty') ||
				(get(x, y - 1) === 'empty' && get(x, y + 1) === 'empty') ||
				(get(x + 1, y - 1) === 'empty' && get(x - 1, y + 1) === 'empty') ||
				(get(x - 1, y) === 'empty' && get(x + 1, y) === 'empty')
			);
			if (!isNotSumi) this.sumiIndexes.push(i);
		});
		o.map.forEach((pix: string, i: number) => {
			if (pix === 'null' || this.sumiIndexes.includes(i)) return;
			const [x, y] = o.transformPosToXy(i);
			const check = (xx: number, yy: number) => {
				if (xx < 0 || yy < 0 || xx >= o.mapWidth || yy >= o.mapHeight) return 0;
				return this.sumiIndexes.includes(o.transformXyToPos(xx, yy));
			};
			if (check(x - 1, y - 1) || check(x, y - 1) || check(x + 1, y - 1) || check(x + 1, y) ||
				check(x + 1, y + 1) || check(x, y + 1) || check(x - 1, y + 1) || check(x - 1, y)) {
				this.sumiNearIndexes.push(i);
			}
		});
	}

	/**
	 * 超単純モードの思考待機時間（ミリ秒）。打てる手が多いほど長く、2〜5 秒＋±1.5 秒の揺らぎ。
	 *
	 * @param numLegalMoves - 合法手の数
	 * @returns 待機時間（ミリ秒）。2000〜5000
	 * @internal
	 */
	private calcThinkDelaySuperSimple(numLegalMoves: number): number {
		const baseSec = 2 + Math.min(3, numLegalMoves / 10);
		const jitterSec = (Math.random() * 3 - 1.5);
		const sec = Math.max(2, Math.min(5, baseSec + jitterSec));
		return Math.round(sec * 1000);
	}

	/**
	 * 単純モードの思考待機時間（ミリ秒）。1 手あたり 0.5 秒、±50% ランダム。1 手のみのときは 0.5 秒固定。
	 *
	 * @param numLegalMoves - 合法手の数
	 * @returns 待機時間（ミリ秒）。500〜5000
	 * @internal
	 */
	private calcThinkDelaySimple(numLegalMoves: number): number {
		if (numLegalMoves <= 1) return 500;
		const baseMs = numLegalMoves * 500;
		const factor = 0.5 + Math.random();
		const ms = Math.round(baseMs * factor);
		return Math.max(500, Math.min(5000, ms));
	}

	/**
	 * 現在の局面の合法手の数から思考待機時間（ミリ秒）を算出する。
	 *
	 * @returns 待機時間（ミリ秒）。エンジン未初期化時は 500。自身が先手の 1 手目は常に 500。角が打てる場合は最短（超単純 2 秒・単純 0.5 秒）。
	 * @internal
	 */
	private getThinkDelayMs(): number {
		if (!this.o || this.botColor == null) return 500;
		// 自身が先手（黒）の 1 手目は常に 0.5 秒
		if (this.botColor === true && this.currentTurn === 0) return 500;
		const legalMoves = (this.o as any).canPutSomewhere(this.botColor) as number[];
		// 角が打てる場合は常に最短（超単純 2 秒・単純 0.5 秒）
		const canTakeCorner = legalMoves.some((pos: number) => this.sumiIndexes.includes(pos));
		if (canTakeCorner) return this.useSimpleMode ? 500 : 2000;
		const numLegalMoves = legalMoves.length;
		return this.useSimpleMode
			? this.calcThinkDelaySimple(numLegalMoves)
			: this.calcThinkDelaySuperSimple(numLegalMoves);
	}

	/**
	 * 指定位置に着手したときの反転数（裏返る相手石の数）
	 *
	 * @param pos - 着手するマス位置
	 * @returns 反転数。put して差分を取ったあと undo で盤面を戻す
	 * @internal
	 */
	private getFlippedCount(pos: number): number {
		if (!this.o) return 0;
		const o = this.o as any;
		const before = o.board.filter((x: any) => x != null).length;
		o.put(o.turn, pos);
		const after = o.board.filter((x: any) => x != null).length;
		o.undo();
		return after - before - 1;
	}

	// --- 単純モード用（変則盤対応・未来読みなし）---

	/** 4 方向（上下左右）の [dx, dy]。単純モードの隣接・step で使用 */
	private static readonly D4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
	/** 8 近傍の [dx, dy]。単純モードの emptyNeighbors8 で使用 */
	private static readonly D8: [number, number][] = [
		[0, -1], [0, 1], [-1, 0], [1, 0],
		[-1, -1], [-1, 1], [1, -1], [1, 1]
	];

	/**
	 * セルが使用可能マスか（盤外・欠けマスでないか）
	 *
	 * @param p - マス位置（map のインデックス）
	 * @returns 使用可能なら true
	 * @internal
	 */
	private simpleIsValid(p: number): boolean {
		if (!this.o || p < 0) return false;
		const o = this.o as any;
		return p < o.map.length && o.map[p] !== 'null';
	}

	/**
	 * 使用可能マスかつ空き（石が置かれていない）か
	 *
	 * @param p - マス位置
	 * @returns 空きマスなら true
	 * @internal
	 */
	private simpleIsEmpty(p: number): boolean {
		if (!this.o) return false;
		const o = this.o as any;
		return this.simpleIsValid(p) && o.board[p] == null;
	}

	/**
	 * 上下左右の隣接セル（有効なもののみ）
	 *
	 * @param p - マス位置
	 * @returns 隣接する使用可能マスの位置の配列
	 * @internal
	 */
	private simpleNeighbors4(p: number): number[] {
		if (!this.o) return [];
		const o = this.o as any;
		const [x, y] = o.transformPosToXy(p);
		const out: number[] = [];
		for (const [dx, dy] of ReversiGameSession.D4) {
			const q = o.transformXyToPos(x + dx, y + dy);
			if (this.simpleIsValid(q)) out.push(q);
		}
		return out;
	}

	/**
	 * 8 近傍のセル（有効なもののみ）
	 *
	 * @param p - マス位置
	 * @returns 8 近傍の使用可能マスの位置の配列
	 * @internal
	 */
	private simpleNeighbors8(p: number): number[] {
		if (!this.o) return [];
		const o = this.o as any;
		const [x, y] = o.transformPosToXy(p);
		const out: number[] = [];
		for (const [dx, dy] of ReversiGameSession.D8) {
			const q = o.transformXyToPos(x + dx, y + dy);
			if (this.simpleIsValid(q)) out.push(q);
		}
		return out;
	}

	/**
	 * 位置 k から方向 d に n マス進んだ先の位置
	 *
	 * @param k - 開始マス位置
	 * @param d - 方向 [dx, dy]（D4 または D8 の要素）
	 * @param n - 進むマス数
	 * @returns 有効な終端位置。途中で無効マスに当たったら undefined
	 * @internal
	 */
	private simpleStep(k: number, d: [number, number], n: number): number | undefined {
		if (!this.o || n <= 0) return k;
		const o = this.o as any;
		let [x, y] = o.transformPosToXy(k);
		const [dx, dy] = d;
		for (let i = 0; i < n; i++) {
			x += dx;
			y += dy;
			const next = o.transformXyToPos(x, y);
			if (!this.simpleIsValid(next)) return undefined;
		}
		return o.transformXyToPos(x, y);
	}

	/**
	 * 辺セルか（上下左右のいずれかが盤外または欠け）
	 *
	 * @param p - マス位置
	 * @returns 隣接 4 方向の有効数が 4 未満なら true
	 * @internal
	 */
	private simpleIsEdge(p: number): boolean {
		return this.simpleNeighbors4(p).length < 4;
	}

	/**
	 * 角のリスト（pos と内向き 2 方向）。形状のみで決まり石配置に依存しない
	 *
	 * @returns 各角の位置と、その角から盤内へ向かう 2 方向 [dx, dy] の配列
	 * @internal
	 */
	private simpleCorners(): { pos: number; inwardDirs: [number, number][] }[] {
		if (!this.o) return [];
		const o = this.o as any;
		const corners: { pos: number; inwardDirs: [number, number][] }[] = [];
		for (let i = 0; i < o.map.length; i++) {
			if (o.map[i] === 'null') continue;
			if (!this.simpleIsEdge(i)) continue;
			const n4 = this.simpleNeighbors4(i);
			if (n4.length !== 2) continue;
			const [x, y] = o.transformPosToXy(i);
			const dirs: [number, number][] = [];
			for (const q of n4) {
				const [qx, qy] = o.transformPosToXy(q);
				dirs.push([qx - x, qy - y]);
			}
			// 直交: dx1*dx2 + dy1*dy2 === 0
			if (dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1] === 0) {
				corners.push({ pos: i, inwardDirs: dirs });
			}
		}
		return corners;
	}

	/**
	 * 各使用可能マスから最も近い辺セルまでの最短 4 近傍距離
	 *
	 * @returns 位置 → 距離の Map。形状のみで決まり石配置に依存しない
	 * @internal
	 */
	private simpleEdgeDist(): Map<number, number> {
		const dist = new Map<number, number>();
		if (!this.o) return dist;
		const o = this.o as any;
		const edgeCells: number[] = [];
		for (let i = 0; i < o.map.length; i++) {
			if (o.map[i] === 'null') continue;
			if (this.simpleIsEdge(i)) {
				edgeCells.push(i);
				dist.set(i, 0);
			}
		}
		const queue = [...edgeCells];
		while (queue.length > 0) {
			const p = queue.shift()!;
			const d = dist.get(p)!;
			for (const q of this.simpleNeighbors4(p)) {
				if (!dist.has(q)) {
					dist.set(q, d + 1);
					queue.push(q);
				}
			}
		}
		return dist;
	}

	/**
	 * 使用可能マス（欠けでないマス）の総数
	 *
	 * @returns 総数。タイブレークの EMPTY_SWITCH 計算に使用
	 * @internal
	 */
	private simpleTotalValid(): number {
		if (!this.o) return 0;
		const o = this.o as any;
		let n = 0;
		for (let i = 0; i < o.map.length; i++) {
			if (this.simpleIsValid(i)) n++;
		}
		return n;
	}

	/**
	 * 空きマス（石が置かれていない使用可能マス）の数
	 *
	 * @returns 空きマス数。タイブレーク T1 の切替に使用
	 * @internal
	 */
	private simpleCountEmpty(): number {
		if (!this.o) return 0;
		const o = this.o as any;
		let n = 0;
		for (let i = 0; i < o.map.length; i++) {
			if (this.simpleIsEmpty(i)) n++;
		}
		return n;
	}

	/**
	 * 位置 p の 8 近傍のうち空きマスの個数
	 *
	 * @param p - マス位置
	 * @returns 空きの 8 近傍数。タイブレーク T2 で最小の手を残すために使用
	 * @internal
	 */
	private simpleEmptyNeighbors8(p: number): number {
		return this.simpleNeighbors8(p).filter(q => this.simpleIsEmpty(q)).length;
	}

	/**
	 * 空いている角のみ対象に Cset, Xset, GoodEdge2, GoodInner, Line2, Nearset を構築する
	 *
	 * @param emptyCornerPoses - 現局面で空きの角の位置の配列
	 * @param cornersWithDirs - 全角の位置と内向き 2 方向
	 * @param edgeDist - 辺からの距離 Map
	 * @returns 各集合（Xset, Cset, GoodEdge2set, GoodInnerset, Line2set, Nearset）
	 * @internal
	 */
	private simpleBuildSets(
		emptyCornerPoses: number[],
		cornersWithDirs: { pos: number; inwardDirs: [number, number][] }[],
		edgeDist: Map<number, number>
	): {
		Xset: Set<number>;
		Cset: Set<number>;
		GoodEdge2set: Set<number>;
		GoodInnerset: Set<number>;
		Line2set: Set<number>;
		Nearset: Set<number>;
	} {
		const Xset = new Set<number>();
		const Cset = new Set<number>();
		const GoodEdge2set = new Set<number>();
		const GoodInnerset = new Set<number>();
		const Line2set = new Set<number>();
		const cornerByPos = new Map(cornersWithDirs.map(c => [c.pos, c]));

		for (const k of emptyCornerPoses) {
			const c = cornerByPos.get(k);
			if (!c) continue;
			const [d1, d2] = c.inwardDirs;
			// C: 角の内向き 2 方向の隣
			const n1 = this.simpleStep(k, d1, 1);
			const n2 = this.simpleStep(k, d2, 1);
			if (n1 != null) Cset.add(n1);
			if (n2 != null) Cset.add(n2);
			// X: 角の斜め内側（d1 + d2 方向に 1 マス）
			const xPos = this.simpleStep(k, [d1[0] + d2[0], d1[1] + d2[1]], 1);
			if (xPos != null && this.simpleIsValid(xPos)) Xset.add(xPos);
			// GoodEdge2: 角から 2 マス離れた辺
			const p2a = this.simpleStep(k, d1, 2);
			if (p2a != null && this.simpleIsEdge(p2a)) GoodEdge2set.add(p2a);
			const p2b = this.simpleStep(k, d2, 2);
			if (p2b != null && this.simpleIsEdge(p2b)) GoodEdge2set.add(p2b);
			// Line2: 角から内向き 2 マスの点（Nearset 用）
			if (p2a != null) Line2set.add(p2a);
			if (p2b != null) Line2set.add(p2b);
			// GoodInner: 角から 2 マス→さらに 2 マスで、edgeDist >= 2 のときのみ
			const q1 = p2a != null ? this.simpleStep(p2a, d2, 2) : undefined;
			if (q1 != null && (edgeDist.get(q1) ?? 0) >= 2) GoodInnerset.add(q1);
			const q2 = p2b != null ? this.simpleStep(p2b, d1, 2) : undefined;
			if (q2 != null && (edgeDist.get(q2) ?? 0) >= 2) GoodInnerset.add(q2);
		}

		// Nearset = X ∪ C ∪ Line2（空き角近くの回避対象）
		const Nearset = new Set<number>([...Xset, ...Cset, ...Line2set]);
		return { Xset, Cset, GoodEdge2set, GoodInnerset, Line2set, Nearset };
	}

	/**
	 * 単純モードの思考。変則盤対応・未来読みなし・必ず1手。角/C/X/GoodEdge2/GoodInner/辺の優先・回避とタイブレーク。
	 *
	 * @remarks
	 * 仕様「リバーシBot仕様（変則ボード対応・未来読みなし・必ず1手）」に従う。スコア表は使わない。
	 *
	 * @internal
	 */
	private thinkSimple() {
		this.thinkScheduled = false;
		log(`[reversi] thinkSimple gameId=${this.gameId}`);
		if (!this.o || this.botColor == null) {
			log(`[reversi] thinkSimple skip: no engine or botColor`);
			return;
		}
		const o = this.o as any;
		const cans = o.canPutSomewhere(this.botColor);
		if (cans.length === 0) {
			log(`[reversi] thinkSimple skip: no legal moves`);
			return;
		}

		const cornersWithDirs = this.simpleCorners();
		const emptyCornerPoses = cornersWithDirs.map(c => c.pos).filter(k => this.simpleIsEmpty(k));
		const edgeDist = this.simpleEdgeDist();
		const { Xset, Cset, GoodEdge2set, GoodInnerset, Nearset } = this.simpleBuildSets(
			emptyCornerPoses,
			cornersWithDirs,
			edgeDist
		);

		const cornerSet = new Set(cornersWithDirs.map(c => c.pos));
		const totalValid = this.simpleTotalValid();
		const empty = this.simpleCountEmpty();
		const EMPTY_SWITCH = Math.round(totalValid * 0.31);

		// 回避: 該当を除外し、除外で空になるなら除外しない
		const avoid = (cand: number[], bad: Set<number>): number[] => {
			const next = cand.filter(p => !bad.has(p));
			return next.length > 0 ? next : cand;
		};

		let cand: number[] = [...cans];

		// A. 回避（X 優先の C/X 回避）
		cand = avoid(cand, Xset);
		cand = avoid(cand, Cset);

		// B. 優先（角 → GoodEdge2 → GoodInner → 辺の順で最初にヒットしたら候補を絞り、タイブレークへ）
		const inCorner = cand.filter(p => cornerSet.has(p));
		if (inCorner.length > 0) {
			cand = inCorner;
		} else {
			const inGoodEdge2 = cand.filter(p => GoodEdge2set.has(p));
			if (inGoodEdge2.length > 0) {
				cand = inGoodEdge2;
			} else {
				const inGoodInner = cand.filter(p => GoodInnerset.has(p));
				if (inGoodInner.length > 0) {
					cand = inGoodInner;
				} else {
					const onEdge = cand.filter(p => this.simpleIsEdge(p));
					if (onEdge.length > 0) cand = onEdge;
				}
			}
		}

		// C. 優先が一度も当たらなかったときの追加回避
		cand = avoid(cand, Nearset);
		const edgeDist1Set = new Set(cand.filter(p => (edgeDist.get(p) ?? 0) === 1));
		cand = avoid(cand, edgeDist1Set);

		// タイブレーク T1: 空き数で flips 最小/最大
		const flipVal = (p: number) => this.getFlippedCount(p);
		if (empty >= EMPTY_SWITCH) {
			const minF = Math.min(...cand.map(flipVal));
			cand = cand.filter(p => flipVal(p) === minF);
		} else {
			const maxF = Math.max(...cand.map(flipVal));
			cand = cand.filter(p => flipVal(p) === maxF);
		}

		// T2: 8近傍の空きが少ない手
		if (cand.length > 1) {
			const minN8 = Math.min(...cand.map(p => this.simpleEmptyNeighbors8(p)));
			cand = cand.filter(p => this.simpleEmptyNeighbors8(p) === minN8);
		}

		// T3: 辺から遠い手
		if (cand.length > 1) {
			const maxEd = Math.max(...cand.map(p => edgeDist.get(p) ?? 0));
			cand = cand.filter(p => (edgeDist.get(p) ?? 0) === maxEd);
		}

		// T4: ランダム
		const pos = cand[Math.floor(Math.random() * cand.length)];
		log(`[reversi] thinkSimple gameId=${this.gameId} → putStone pos=${pos}`);
		this.sendPutStone(pos);
	}

	/**
	 * 超単純モードの思考。隅優先 → 角周辺回避（角が空のときのみ）→ C 優先 then X → 反転数最大
	 *
	 * @remarks
	 * 1. 合法手のうち隅に打てるならそのいずれかを選ぶ。
	 * 2. 隅が無いとき、まだ空いている角に隣接するマスは避ける。すべて角周辺しか無い場合は候補を全合法手にする。
	 * 3. 角周辺しか打てないとき、C（隅の横／縦隣）を優先、なければ X（隅の斜め隣）を候補にする。
	 * 4. 候補のうち反転数が最大の手を選ぶ。
	 *
	 * @internal
	 */
	private thinkSuperSimple() {
		this.thinkScheduled = false;
		log(`[reversi] thinkSuperSimple gameId=${this.gameId}`);
		if (!this.o || this.botColor == null) {
			log(`[reversi] thinkSuperSimple skip: no engine or botColor`);
			return;
		}
		const cans = this.o.canPutSomewhere(this.botColor as any);
		if (cans.length === 0) {
			log(`[reversi] thinkSuperSimple skip: no legal moves`);
			return;
		}
		// 1. 隅に打てる手があればそのいずれかを選ぶ
		const sumiAvailable = cans.filter((p: number) => this.sumiIndexes.includes(p));
		if (sumiAvailable.length > 0) {
			const pos = sumiAvailable[0];
			log(`[reversi] thinkSuperSimple gameId=${this.gameId} → putStone pos=${pos} (corner)`);
			this.sendPutStone(pos);
			return;
		}
		// 2. 角がまだ空いているときだけ角周辺を避ける
		const emptySumi = this.sumiIndexes.filter((i: number) => this.o!.board[i] == null);
		const avoidNear = emptySumi.length > 0 ? this.sumiNearIndexes : [];
		let candidates = cans.filter((p: number) => !avoidNear.includes(p));
		if (candidates.length === 0) candidates = cans;
		// 3. C（隅の横／縦隣）を優先、なければ X（隅の斜め隣）
		const cPos = [1, 8, 6, 15, 48, 57, 55, 62];
		const xPos = [9, 14, 49, 54];
		const inC = candidates.filter((p: number) => cPos.includes(p));
		const inX = candidates.filter((p: number) => xPos.includes(p));
		let finalCandidates = candidates;
		if (inC.length > 0) finalCandidates = inC;
		else if (inX.length > 0) finalCandidates = inX;
		// 4. 候補のうち反転数が最大の手を選ぶ
		let bestPos = finalCandidates[0];
		let bestFlip = this.getFlippedCount(bestPos);
		for (const p of finalCandidates) {
			const n = this.getFlippedCount(p);
			if (n > bestFlip) {
				bestFlip = n;
				bestPos = p;
			}
		}
		log(`[reversi] thinkSuperSimple gameId=${this.gameId} → putStone pos=${bestPos}`);
		this.sendPutStone(bestPos);
	}
}

if (typeof require !== 'undefined' && require.main === module) {
	new Session();
}

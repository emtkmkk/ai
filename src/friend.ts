/**
 * @packageDocumentation
 *
 * ユーザー（友達）情報管理モジュール。
 *
 * @remarks
 * 藍と対話したユーザーの情報を永続管理する。
 * 親愛度の増減、ニックネームの設定、モジュールごとのデータ保存、
 * アカウント引っ越し時の自動転送などの機能を提供する。
 *
 * データは LokiJS の `friends` コレクションに {@link FriendDoc} として保存される。
 *
 * @see {@link ./ai | 藍} — Friends コレクションの管理元
 * @see {@link ./module | Module} — モジュール固有データの参照元
 * @internal
 */
import autobind from 'autobind-decorator';
import 藍 from '@/ai';
import IModule from '@/module';
import getDate from '@/utils/get-date';
import { User } from '@/misskey/user';
import { genItem } from '@/vocabulary';
import { acct } from '@/utils/acct';
import { checkNgWord } from '@/utils/check-ng-word';
import { createDefaultKazutoriData } from '@/modules/kazutori/rate';

/**
 * 友達（ユーザー）の永続化データの型定義
 *
 * @remarks
 * LokiJS の `friends` コレクションに保存されるドキュメント構造。
 * ユーザーごとに1つのドキュメントが存在し、`userId` で識別する。
 *
 * 親愛度は -30 〜 無制限の範囲を取り、マイナスになるとニックネームを忘れる。
 *
 * @internal
 */
export type FriendDoc = {
	/** ユーザーの一意なID */
	userId: string;
	/** Misskey のユーザー情報 */
	user: User;
	/**
	 * 藍が呼ぶニックネーム
	 *
	 * @remarks
	 * `null` の場合はデフォルトの呼び方（ユーザー名）を使用する。
	 * 親愛度がマイナスになると自動的に `null` にリセットされる。
	 */
	name?: string | null;
	/**
	 * 親愛度
	 *
	 * @remarks
	 * 最低値は -30。上限なし。デフォルトは 0。
	 * 100 を超えると増減計算に軽減係数がかかる。
	 * x00（100, 200, ...）到達時に感謝メッセージが送信される。
	 *
	 * @defaultValue 0
	 */
	love?: number;
	/** 数取りゲームの成績データ */
	kazutoriData?: any;
	/** 最後に親愛度が増加した日付（`YYYY/M/D` 形式） */
	lastLoveIncrementedAt?: string;
	/** 今日の親愛度増加累積量 */
	todayLoveIncrements?: number;
	/** 最後に親愛度が増加した時間帯（10分単位のクールダウン判定用） */
	lastLoveIncrementedTime?: string;
	/** 最後にRPGをプレイした日付 */
	lastRPGTime?: string;
	/** 親愛度増加のクールダウンキー一覧（10分間に同じ種類の増加を防止） */
	cooldownLoveIncrementKey?: string[];
	/** 今日のリアクション数 */
	todayReactCount?: number;
	/** 最後にリアクションした日付 */
	lastReactAt?: string;
	/** モジュールごとの永続データ（モジュール名をキーとするオブジェクト） */
	perModulesData?: any;
	/** 藍と結婚しているかどうか */
	married?: boolean;
	/** アカウント引継ぎ用の合言葉コード */
	transferCode?: string;
	/** 歓迎メッセージを送信済みかどうか */
	isWelcomeMessageSent?: boolean;
	/** リンクされたサブアカウントのURI一覧（自動転送の重複防止） */
	linkedAccounts?: string[];
};

/**
 * 友達（ユーザー）情報を管理するクラス
 *
 * @remarks
 * 親愛度の増減、ニックネームの設定、モジュール固有データの管理、
 * アカウント引継ぎ・自動転送などの機能を持つ。
 *
 * 生成方法:
 * - `{ user: User }` を渡すと、DB に既存なら取得、なければ新規作成
 * - `{ doc: FriendDoc }` を渡すと、既存のドキュメントをそのまま使用
 *
 * NB: コンストラクタ内で `users/show` API を非同期呼び出しし、
 * ユーザー情報の完全取得と `alsoKnownAs` による自動転送を行う。
 *
 * @see {@link FriendDoc} — 永続化データ構造
 * @internal
 */
export default class Friend {
	/**
	 * 藍のインスタンスへの参照
	 * @internal
	 */
	private ai: 藍;

	/**
	 * ユーザーIDを取得する
	 * @returns ユーザーの一意なID
	 * @internal
	 */
	public get userId() {
		return this.doc.userId;
	}

	/**
	 * ニックネームを取得する
	 * @returns 設定されたニックネーム。未設定の場合は `undefined`
	 * @internal
	 */
	public get name() {
		return this.doc.name;
	}

	/**
	 * 親愛度を取得する
	 * @returns 現在の親愛度（未設定の場合は 0）
	 * @internal
	 */
	public get love() {
		return this.doc.love || 0;
	}

	/**
	 * 結婚状態を取得する
	 * @returns 結婚している場合は `true`
	 * @internal
	 */
	public get married() {
		return this.doc.married;
	}

	/**
	 * LokiJS の永続化ドキュメント
	 *
	 * @remarks
	 * 直接操作可能だが、変更後は {@link save} を呼ぶこと。
	 *
	 * @internal
	 */
	public doc: FriendDoc;

	/**
	 * Friend インスタンスを生成する
	 *
	 * @remarks
	 * `opts.user` が指定された場合:
	 * 1. DB に既存のドキュメントがあればそれを使用
	 * 2. なければ新規作成し、`users/show` API で完全な情報を取得
	 * 3. `alsoKnownAs` が設定されていれば自動転送を試行
	 *
	 * `opts.doc` が指定された場合はそのドキュメントをそのまま使用する。
	 *
	 * @param ai - 藍のインスタンス
	 * @param opts - `user`（Misskey ユーザー情報）または `doc`（既存のドキュメント）を指定
	 * @throws `Error` — user も doc も指定されなかった場合
	 * @throws `Error` — DB への挿入に失敗した場合
	 * @internal
	 */
	constructor(ai: 藍, opts: { user?: User, doc?: FriendDoc; }) {
		this.ai = ai;

		if (opts.user) {
			const exist = this.ai.friends.findOne({
				userId: opts.user.id
			});

			if (exist == null) {
				// 新規ユーザー: DBにドキュメントを作成する
				let inserted = this.ai.friends.insertOne({
					userId: opts.user.id,
					user: opts.user
				});

				if (inserted == null) {
					throw new Error('Failed to insert friend doc');
				}

				this.doc = inserted;

				// 完全なユーザー情報をAPIで取得し、引っ越し元があれば自動転送を試行

				this.ai.api('users/show', {
					userId: opts.user.id
				}).then(user => {
					this.updateUser(user);
					const moveFrom = user.alsoKnownAs?.[0];
					if (moveFrom) {
						this.tryAutoTransfer(moveFrom);
					}
				});
			} else {
				// 既存ユーザー: 情報を更新する
				this.doc = exist;
				this.doc.user = { ...this.doc.user, ...opts.user };
				// ニックネームがNGワードに該当する場合はリセットする
				if (this.doc.name && !checkNgWord(this.doc.name)) this.doc.name = null;
				this.save();
			}
		} else if (opts.doc) {
			this.doc = opts.doc;
		} else {
			throw new Error('No friend info specified');
		}
	}

	/**
	 * ユーザー情報を部分更新する
	 *
	 * @param user - 更新するユーザー情報（部分的なプロパティでも可）
	 * @returns なし
	 * @internal
	 */
	@autobind
	public updateUser(user: Partial<User>) {
		this.doc.user = {
			...this.doc.user,
			...user,
		};
		this.save();
	}

	/**
	 * モジュール固有の永続データを取得する
	 *
	 * @remarks
	 * 対象モジュールのデータが存在しない場合は空オブジェクトを初期化する。
	 *
	 * @param module - 対象のモジュール
	 * @returns モジュール固有データ
	 * @internal
	 */
	@autobind
	public getPerModulesData(module: IModule) {
		if (this.doc.perModulesData == null) {
			this.doc.perModulesData = {};
			this.doc.perModulesData[module.name] = {};
			this.save();
		} else if (this.doc.perModulesData[module.name] == null) {
			this.doc.perModulesData[module.name] = {};
			this.save();
		}

		return this.doc.perModulesData[module.name];
	}

	/**
	 * モジュール固有の永続データを設定する
	 *
	 * @param module - 対象のモジュール
	 * @param data - 保存するデータ
	 * @returns なし
	 * @internal
	 */
	@autobind
	public setPerModulesData(module: IModule, data: any) {
		if (this.doc.perModulesData == null) {
			this.doc.perModulesData = {};
		}

		this.doc.perModulesData[module.name] = data;

		this.save();
	}

	/**
	 * 親愛度を増加させる
	 *
	 * @remarks
	 * 以下の制限・ルールが適用される:
	 * - 入力量は内部で5倍される
	 * - 親愛度100以上の場合、軽減係数がかかる
	 * - 同じ種類の増加は10分間に1回まで（`key` でクールダウン管理）
	 * - 100未満の場合: 1日あたり最大15まで
	 * - 100以上の場合: 1日あたり最大50まで
	 * - x00（100, 200, ...）到達時に感謝メッセージを送信
	 * - RPG関連の増加は1日1回まで
	 *
	 * @param amount - 増加量の基準値（内部で5倍される）
	 * @defaultValue amount は `1`
	 * @param key - 増加の種類を識別するキー（クールダウン制御に使用）
	 * @returns なし
	 * @internal
	 */
	@autobind
	public incLove(amount = 1, key?) {
		amount = amount * 5;

		// 親愛度100以上の場合、量に応じて上がる量が軽減
		if ((this.doc.love || 0) > 100) amount = (Math.ceil(amount / ((this.doc.love || 0) * 2 / 100 - 1) * 100) / 100);

		const today = getDate();

		if (this.doc.lastLoveIncrementedAt != today) {
			this.doc.todayLoveIncrements = 0;
		}

		if (key?.includes("mk_chicken_t") || key?.includes("hero")) key = "hero";

		// RPGに関連する好感度増加は1日に1回
		if (key?.includes("hero") && this.doc.lastRPGTime && this.doc.lastRPGTime == today) return;

		const now = new Date();

		// 同じ種類の好感度増加は10分間に1回
		if (key && key != "merge") {
			if (!this.doc.cooldownLoveIncrementKey || this.doc.lastLoveIncrementedTime !== ("" + now.getHours() + now.getMinutes()).slice(0, 3)) {
				this.doc.cooldownLoveIncrementKey = [];
				this.doc.lastLoveIncrementedTime = ("" + now.getHours() + now.getMinutes()).slice(0, 3);
			}

			if (this.doc.cooldownLoveIncrementKey.includes(key)) {
				this.ai.log(`💗 ${this.userId} +0 (${this.doc.love || 0}) <${this.doc.lastLoveIncrementedTime} : ${key}>`);
				return;
			} else {
				this.doc.cooldownLoveIncrementKey.push(key);
			}
		}

		// 100を超えるまでは1日に上げられる親愛度は最大15
		if (key != "merge" && this.doc.lastLoveIncrementedAt == today && ((this.doc.love || 0) < 100 && (this.doc.todayLoveIncrements || 0) >= 15)) return;

		// 100を超えた後は1日に上げられる親愛度は最大50
		if (key != "merge" && this.doc.lastLoveIncrementedAt == today && ((this.doc.love || 0) >= 100 && (this.doc.todayLoveIncrements || 0) >= 50)) return;

		if (this.doc.love == null) this.doc.love = 0;

		amount = parseFloat(amount.toFixed(2));

		// x00を超えた時に感謝のメッセージを送信する
		if (key != "merge" && (this.doc.love || 0) > 0 && (this.doc.love || 0) % 100 + amount >= 100) {
			this.ai.sendMessage(this.doc.userId, {
				text: `${acct(this.doc.user)}\n${this.doc.name ? this.doc.name + "、" : ""}私と${'とっても'.repeat(Math.floor((this.doc.love || 0) / 100))}たくさん遊んでいただいてありがとうございます！\nこれからもよろしくお願いします……！${this.doc.perModulesData?.rpg ? `\n（RPGモードでの行動回数が ${Math.floor((this.doc.love || 0) / 100) + 2} 回になりました！）` : ""}`
			});
		}
		this.doc.love += amount;
		this.doc.love = parseFloat((this.doc.love || 0).toFixed(2));

		/*// 最大 100
		if (this.doc.love > 100) this.doc.love = 100;*/

		if (key != "merge") {
			this.doc.lastLoveIncrementedAt = today;
			this.doc.todayLoveIncrements = (this.doc.todayLoveIncrements || 0) + amount;
			this.doc.todayLoveIncrements = parseFloat((this.doc.todayLoveIncrements || 0).toFixed(2));
		}
		if (key?.includes("hero")) {
			this.doc.lastRPGTime = today;
		}
		this.save();

		// 好感度が上昇した場合、ActiveFactorを増加させる
		if (!key || (key !== "greet" && key != "merge")) this.ai.incActiveFactor();

		if (key != "merge") this.ai.log(`💗 ${this.userId} +${amount} (${this.doc.love || 0}) <${(this.doc.todayLoveIncrements || 0)} / ${(this.doc.love || 0) < 100 ? 15 : 50}>`);
	}

	/**
	 * 親愛度を減少させる
	 *
	 * @remarks
	 * - 入力量は内部で5倍される
	 * - 親愛度100以上の場合は軽減係数がかかる
	 * - x00（100, 200, ...）を下回る場合はその境界で止まる
	 * - 最低値は -30
	 * - マイナスになるとニックネームを忘れる
	 *
	 * @param amount - 減少量の基準値（内部で5倍される）
	 * @defaultValue amount は `1`
	 * @returns なし
	 * @internal
	 */
	@autobind
	public decLove(amount = 1) {
		amount = amount * 5;

		// 親愛度100以上の場合、量に応じて下がる量が軽減
		if ((this.doc.love || 0) >= 100) amount = (Math.ceil(amount / ((this.doc.love || 0) * 2 / 100 - 1) * 100) / 100);

		// 好感度x00以下になる場合、x00で止まる
		if ((this.doc.love || 0) >= 100 && (this.doc.love || 0) % 100 - amount < 0) this.doc.love = (Math.floor((this.doc.love || 0) / 100) * 100) + amount;

		if (this.doc.love == null) this.doc.love = 0;
		this.doc.love -= amount;

		// 最低 -30
		if (this.doc.love < -30) this.doc.love = -30;

		// 親愛度マイナスなら名前を忘れる
		if (this.doc.love < 0) {
			this.doc.name = null;
		}

		this.save();

		this.ai.log(`💢 ${this.userId} -${amount} (${this.doc.love || 0})`);
	}

	/**
	 * ニックネームを更新する
	 *
	 * @param name - 新しいニックネーム。`null` でリセット
	 * @returns なし
	 * @internal
	 */
	@autobind
	public updateName(name: string | null) {
		this.doc.name = name;
		this.save();
	}

	/**
	 * 友達情報を DB に保存する
	 *
	 * @returns なし
	 * @internal
	 */
	@autobind
	public save() {
		this.ai.friends.update(this.doc);
	}

	/**
	 * アカウント引継ぎ用の合言葉コードを生成する
	 *
	 * @remarks
	 * {@link genItem} でランダムなアイテム名2つを連結した文字列を生成する。
	 * 生成後にドキュメントに保存される。
	 *
	 * @returns 生成された合言葉コード
	 *
	 * @see {@link transferMemory} — 合言葉を使った引継ぎ
	 * @internal
	 */
	@autobind
	public generateTransferCode(): string {
		const code = genItem() + genItem();

		this.doc.transferCode = code;
		this.save();

		return code;
	}

	/**
	 * 合言葉を使って別アカウントから記憶を引き継ぐ
	 *
	 * @remarks
	 * 指定された合言葉コードに該当するユーザーが見つかれば、
	 * そのユーザーの名前・親愛度・結婚状態・モジュールデータ・数取りデータを転送する。
	 *
	 * TODO: 引継ぎ後に転送元の合言葉を消去する機能が未実装
	 *
	 * @param code - 引継ぎ用の合言葉コード
	 * @returns 引継ぎに成功した場合は `true`
	 *
	 * @see {@link generateTransferCode} — 合言葉の生成
	 * @internal
	 */
	@autobind
	public transferMemory(code: string): boolean {
		const src = this.ai.friends.findOne({
			transferCode: code
		});

		if (src == null) return false;

		this.doc.name = src.name;
		this.doc.love = src.love;
		this.doc.married = src.married;
		this.doc.perModulesData = src.perModulesData;
		this.doc.kazutoriData = src.kazutoriData;
		this.save();

		// TODO: 合言葉を忘れる

		return true;
	}

	/**
	 * `alsoKnownAs` の情報を元に自動的に記憶を転送する
	 *
	 * @remarks
	 * 新規アカウント作成時に、以前のアカウントの親愛度・モジュールデータを自動統合する。
	 * 転送元の親愛度は0にリセットされる。
	 * 既にリンク済みの URI は重複転送しない。
	 *
	 * @param moveUri - 移行元ユーザーの URI
	 * @returns なし
	 * @internal
	 */
	@autobind
	private tryAutoTransfer(moveUri: string) {
		if (this.doc.linkedAccounts?.includes(moveUri)) return;
		try {
			const moveUserFriends = this.ai.friends.findOne({
				'user.uri': moveUri
			} as any);
			if (moveUserFriends) {
				const doc1 = new Friend(this.ai, { doc: moveUserFriends });
				console.log('move user ' + doc1.userId + ' -> ' + this.userId);
				this.doc.name = this.doc.name || doc1.name;

				// 転送元の親愛度を incLove の軽減係数を加味して「何回分」に換算する
				// （単純に love を加算すると軽減が適用されないため）
				let x = 0;
				let y = 0;
				while (y < doc1.love) {
					const amount = y > 100 ? (Math.ceil(0.5 / ((y || 0) * 2 / 100 - 1) * 100) / 100) : 0.5;
					y = parseFloat((y + amount || 0).toFixed(2));
					x += 1;
				}
				console.log(`${x} : ${y}`);

				// 換算した回数分だけ incLove を呼び出す（"merge" キーで日次制限を回避）
				for (let i = 0; i < x; i++) {
					this.incLove(0.1, "merge");
				}

				// 転送元の親愛度をリセットし、データを統合する
				doc1.doc.love = 0;
				this.doc.married = doc1.married || this.married;
				this.doc.perModulesData = this.mergeAndSum(doc1.doc.perModulesData, this.doc.perModulesData);
				this.doc.kazutoriData = this.mergeAndSum(doc1.doc.kazutoriData, this.doc.kazutoriData);
				doc1.doc.kazutoriData = createDefaultKazutoriData();
				this.doc.linkedAccounts = [...(this.doc.linkedAccounts ?? []), moveUri];
				this.save();
				doc1.save();
			} else {
				console.log('move user not found ' + this.userId);
			}
		} catch {
			console.log('move user error ' + this.userId);
		}
	}

	/**
	 * 2つのオブジェクトを再帰的にマージする
	 *
	 * @remarks
	 * マージルール:
	 * - 数値: 加算
	 * - 配列: 結合
	 * - 日付: 未来の方を採用
	 * - オブジェクト: 再帰的にマージ
	 * - その他: 後勝ち（`obj2` が優先）
	 *
	 * @param obj1 - ベースのオブジェクト
	 * @param obj2 - マージ元のオブジェクト
	 * @returns マージされた新しいオブジェクト
	 * @internal
	 */
	@autobind
	private mergeAndSum(obj1, obj2) {
		// 結果を格納する新しいオブジェクト
		const result = { ...obj1 };

		// obj2のキーと値を結果に追加、同じキーがあれば値を足し合わせる
		for (const key in obj2) {
			if (result[key] != undefined) {
				if (Array.isArray(result[key]) && Array.isArray(obj2[key])) {
					// 配列の場合は結合する
					result[key] = result[key].concat(obj2[key]);
				} else if (typeof result[key] === 'number' && typeof obj2[key] === 'number') {
					// 数値の場合は足し合わせる
					result[key] += obj2[key];
				} else if (result[key] instanceof Date && obj2[key] instanceof Date) {
					// 日付の場合は未来の日付を採用する
					result[key] = result[key] > obj2[key] ? result[key] : obj2[key];
				} else if (typeof result[key] === 'object' && typeof obj2[key] === 'object' && !Array.isArray(result[key])) {
					// オブジェクトの場合は再帰的にマージする
					result[key] = this.mergeAndSum(result[key], obj2[key]);
				} else {
					// 他の型の場合は後の方を採用する（ここでは単純に上書きするようにしています）
					result[key] = obj2[key];
				}
			} else {
				result[key] = obj2[key];
			}
		}

		return result;
	}

}

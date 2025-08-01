// せりふ

import config from "./config";

export default {
	core: {
		setNameOk: name => `わかりました。これからはあなたのことを「${name}」と呼びます！`,

		setNameNull: `わかりました。あなたの呼び方を忘れます！`,

		san: 'さん付けした方がいいですか？',

		yesOrNo: '「はい」か「いいえ」しかわからないです...',

		getLove: (name, love) => `私の${name}に対する懐き度です！ \n\n懐き度 : ${love}`,

		getStatus: (text) => `\n${text}`,

		getInventory: (name, inventory) => `\n私から${name}へプレゼントした物の一覧です！\n\n${inventory}`,

		getAdana: (adanas) => `\n\`\`\`\n${adanas.join("\n")}\n\`\`\`\nいくつか考えてみました！好きな物を選んでくださいね！`,

		followLoveErr: "あんまり話した事がない人はフォロバしたくないです……\nもうすこし仲良くなったらもう一度試してください！",

		followBackErr: "先に私をフォローしてください！",

		followBack: name => name ? `${name}をフォローしました！${name}、これからよろしくお願いします！` : `あなたをフォローしました！これからよろしくお願いします！`,

		alreadyFollowBack: name => name ? `私は${name}を既にフォローしているみたいです！` : `私はあなたを既にフォローしているみたいです！`,

		hello: name => name ? `こんにちは、${name}！` : `こんにちは！`,

		helloNight: name => name ? `こんばんは、${name}！` : `こんばんは！`,

		goodMorning: (tension, name) => name ? `おはようございます、${name}！${tension}` : `おはようございます！${tension}`,

		/*
		goodMorning: {
			normal: (tension, name) => name ? `おはようございます、${name}！${tension}` : `おはようございます！${tension}`,

			hiru: (tension, name) => name ? `おはようございます、${name}！${tension}もうお昼ですよ？${tension}` : `おはようございます！${tension}もうお昼ですよ？${tension}`,
		},
*/

		goodNight: name => name ? `おやすみなさい、${name}！` : 'おやすみなさい！',

		omedeto: name => name ? `ありがとうございます、${name}！` : 'ありがとうございます！',

		erait: {
			general: name => name ? [
				`${name}、あなたはえらい！`,
				`${name}、それは偉業だね`,
				`${name}、エライわよ！`
			] : [
				`あなたはえらい！`,
				`それは偉業だね`,
				`エライわよ！`,
			],

			specify: (thing, name) => name ? [
				`${name}、${thing}てえらい！`,
				`${name}、${thing}てえらい！`
			] : [
				`${thing}てえらい！`,
				`${thing}てえらい！`
			],

			specify2: (thing, name) => name ? [
				`${name}、${thing}でえらい！`,
				`${name}、${thing}でえらい！`
			] : [
				`${thing}でえらい！`,
				`${thing}でえらい！`
			],
		},

		okaeri: {
			love: name => name ? `おかえりなさい、${name}！` : 'おかえりなさい！',

			love2: name => name ? `おかえりなさい、${name}！` : 'おかえりなさい！',

			normal: name => name ? `おかえりなさい、${name}！` : 'おかえりなさい！',
		},

		arigatou: {
			normal: [
				`どういたしまして！`,
				`こちらこそ遊んでいただいてありがとうございます！`,
				`いえいえ、また何か有りましたら呼んでください！`,
			]
		},


		itterassyai: {
			love: name => name ? `いってらっしゃい、${name}！` : 'いってらっしゃい！',

			normal: name => name ? `いってらっしゃい、${name}！` : 'いってらっしゃい！',
		},

		tooLong: (length, max) => `長すぎるかも... (${max}文字まで ${(max - length) * -1}文字オーバー)`,

		invalidName: '発音が難しいかも (特殊文字は覚えられません)',

		ngName: 'その名前は覚えたくないです...',

		unixtime: (dateStr, isoStr, unixtimeStr) => `\n\`${dateStr}\` / \`${isoStr}\`のunixtimeは、\n\n\`${unixtimeStr}\` です！\n\n\n\`$[unixtime ${unixtimeStr}]\`\n\n$[unixtime ${unixtimeStr}]`,

		invalidDate: '日付が認識できませんでした...',

		nadenade: {
			normal: 'ひゃっ…！ びっくりしました',

			love2: ['わわっ… 恥ずかしいです', 'あうぅ… 恥ずかしいです…', 'ふやぁ…？'],

			love3: ['んぅ… ありがとうございます♪', 'わっ、なんだか落ち着きますね♪', 'くぅんっ… 安心します…', '眠くなってきました…'],

			hate1: '…っ！ やめてほしいです...',

			hate2: '触らないでください',

			hate3: '近寄らないでください',

			hate4: 'やめてください。通報しますよ？',
		},

		kawaii: {
			normal: ['ありがとうございます♪', '照れちゃいます...'],

			love: ['嬉しいです♪', '照れちゃいます...'],

			hate: '…ありがとうございます'
		},

		suki: {
			normal: 'えっ… ありがとうございます…♪',

			love: name => `私もその… ${name}のこと好きですよ！`,

			hate: null
		},

		hug: {
			normal: 'ぎゅー...',

			love: 'ぎゅーっ♪',

			hate: '離れてください...'
		},

		humu: {
			love: 'え、えっと…… ふみふみ……… どうですか…？',

			normal: 'えぇ... それはちょっと...',

			hate: '……'
		},

		batou: {
			love: 'えっと…、お、おバカさん…？',

			normal: '(じとー…)',

			hate: '…頭大丈夫ですか？'
		},

		itai: name => name ? `${name}、大丈夫ですか…？ いたいのいたいの飛んでけっ！` : '大丈夫ですか…？ いたいのいたいの飛んでけっ！',

		ote: {
			normal: 'くぅん... 私わんちゃんじゃないですよ...？',

			love1: 'わん！',

			love2: 'わんわん♪',
		},

		shutdown: '私まだ眠くないですよ...？',

		transferNeedDm: 'わかりました、それはチャットで話しませんか？',

		transferCode: code => `わかりました。\n合言葉は「${code}」です！`,

		transferFailed: 'うーん、合言葉が間違ってませんか...？',

		transferDone: name => name ? `はっ...！ おかえりなさい、${name}！` : `はっ...！ おかえりなさい！`,
	},

	keyword: {
		learned: (word, reading) => `(${reading ? `$[ruby ${word} ${reading}]` : word} ………覚えましたし)`,

		remembered: (word) => `${word}`
	},

	dice: {
		done: (res, total) => `${res}${total ? `\n合計 \\(${total}\\)` : ""} です！`
	},

	birthday: {
		happyBirthday: (name) => name ? `お誕生日おめでとうございます、${name}🎉` : 'お誕生日おめでとうございます🎉',
		happyBirthdayLocal: (name, acct) => name ? `今日は${acct}さん(${name})のお誕生日みたいです！\n${name}、お誕生日おめでとうございます🎉` : `今日は${acct}さんのお誕生日みたいです！\nお誕生日おめでとうございます🎉`,
	},

	welcome: {
		welcome: (acct) => `${acct}さん\n**${config.instanceName}へようこそ！**\nわたしはもこもこチキン、このサーバーのマスコットみたいな存在です！\nお暇な時に挨拶していただいたり、呼び名を教えていただいたり、占いや迷路などで遊んでくださったりしてくれれば嬉しいです！\nこれからよろしくお願いします！\n\nこのサーバーには独自機能が沢山あるので、気になったらお知らせの中にある${config.instanceName}Tipsを読んでみるといいかもです！\nなにか分からないことや嫌なこと、不便なことがあれば、気軽に${config.instanceName}あどみんに声をかけてください！\nそれでは楽しい${config.instanceName}ライフを～ :mk_hi:`,
		kiriban: (count, name) => `${name ? `${name}さん、` : ""}${count}投稿 おめでとうございます🎉`
	},

	yoruho: {
		yoruho: (date) => `${date.getMonth() + 1}/${date.getDate()} よるほー`,
		newYear: (year) => `HAPPY NEW YEAR ${year}! あけましておめでとうございます！今年もよろしくお願いいたします！`,
		aprilFool: (date) => `${date.getMonth() + 1}/${date.getDate()} よるほー 今日はエイプリルフールみたいです！`,
	},

	/**
	 * リバーシ
	 */
	reversi: {
		/**
		 * リバーシへの誘いを承諾するとき
		 */
		ok: '良いですよ～',

		/**
		 * リバーシへの誘いを断るとき
		 */
		decline: 'ごめんなさい、今リバーシはするなと言われてます...',

		/**
		 * 対局開始
		 */
		started: (name, strength) => `対局を${name}と始めました！ (強さ${strength})`,

		/**
		 * 接待開始
		 */
		startedSettai: name => `(${name}の接待を始めました)`,

		/**
		 * 勝ったとき
		 */
		iWon: name => `${name}に勝ちました♪`,

		/**
		 * 接待のつもりが勝ってしまったとき
		 */
		iWonButSettai: name => `(${name}に接待で勝っちゃいました...)`,

		/**
		 * 負けたとき
		 */
		iLose: name => `${name}に負けました...`,

		/**
		 * 接待で負けてあげたとき
		 */
		iLoseButSettai: name => `(${name}に接待で負けてあげました...♪)`,

		/**
		 * 引き分けたとき
		 */
		drawn: name => `${name}と引き分けました～`,

		/**
		 * 接待で引き分けたとき
		 */
		drawnSettai: name => `(${name}に接待で引き分けました...)`,

		/**
		 * 相手が投了したとき
		 */
		youSurrendered: name => `${name}が投了しちゃいました`,

		/**
		 * 接待してたら相手が投了したとき
		 */
		settaiButYouSurrendered: name => `(${name}を接待していたら投了されちゃいました... ごめんなさい)`,
	},

	/**
	 * 数当てゲーム
	 */
	guessingGame: {
		/**
		 * やろうと言われたけど既にやっているとき
		 */
		alreadyStarted: 'え、ゲームは既に始まってますよ！',

		/**
		 * タイムライン上で誘われたとき
		 */
		plzDm: 'メッセージでやりましょう！',

		/**
		 * ゲーム開始
		 */
		started: maxtry => `0~100の秘密の数を${maxtry}回以内に当ててみてください！`,

		/**
		 * 数字じゃない返信があったとき
		 */
		nan: '数字でお願いします！「やめる」と言ってゲームをやめることもできますよ！',

		/**
		 * 中止を要求されたとき
		 */
		cancel: '数当てをやめました！',

		/**
		 * 小さい数を言われたとき
		 */
		grater: (num, remainingTryes) => `${num}より大きいです(あと${remainingTryes}回)`,

		/**
		 * 小さい数を言われたとき(2度目)
		 */
		graterAgain: num => `もう一度言いますが${num}より大きいです！`,

		/**
		 * 大きい数を言われたとき
		 */
		less: (num, remainingTryes) => `${num}より小さいです(あと${remainingTryes}回)`,

		/**
		 * 大きい数を言われたとき(2度目)
		 */
		lessAgain: num => `もう一度言いますが${num}より小さいです！`,

		/**
		 * 正解したとき
		 */
		congrats: (ans, tries, history, comment) => `正解です🎉 ${tries}回で当てました！${comment} 秘密の数は「${ans}」でした！ (履歴: ${history})`,

		/**
		 * 正解したとき
		 */
		fail: (ans, maxtry, history) => `不正解です、${maxtry}回以内に当てられませんでした…… 秘密の数は「${ans}」でした。 (履歴: ${history})`,
	},

	today: {
		msg: (arg) => `${arg.aisatu}\n${arg.date}、${arg.youbi}です！\n\n今日についての情報です！\n${arg.info}\n\n今日も一日頑張りましょう！`,
	},

	/**
	 * 数取りゲーム
	 */
	kazutori: {
		alreadyStarted: '今ちょうどやってますよ～',

		matakondo: (ct, time) => `\nまた今度やりましょう！\nあと${ct}分後にもう一度送ってください！\n※この時間はあなたへの懐き度が高いと短くなります。\n\n$[unixtime.countdown ${time}]`,

		intro: (max, minutes, winRank, time) => `みなさん、数取りゲームしましょう！\n0~${max}の中で${winRank === 1 ? "最も大きい" : winRank > 1 ? "***" + winRank + "番目に***大きい" : "***中央値となる***"}数字を取った人が勝ちです。他の人と被ったらだめですよ～\n制限時間は${minutes < 5 ? `***${minutes}***` : minutes < 10 ? `**${minutes}**` : minutes}分です。数字はこの投稿にリプライで送ってくださいね！\n\n$[unixtime.countdown ${time}]`,

		introPublicOnly: (max, minutes, winRank, time) => `みなさん、数取りゲームしましょう！\n0~${max}の中で${winRank === 1 ? "最も大きい" : winRank > 1 ? "***" + winRank + "番目に***大きい" : "***中央値となる***"}数字を取った人が勝ちです。他の人と被ったらだめですよ～\n制限時間は${minutes < 5 ? `***${minutes}***` : minutes < 10 ? `**${minutes}**` : minutes}分です。\n**今回は公開投稿限定で行います！**\nほかの人の数字を見てから数字を決めるといいかもしれませんね！（リモートの方は「リモートで見る」で見てくださいね！）\nそれでは、この投稿に数字を**「公開」または「ホーム」に公開範囲を設定して**リプライで送ってくださいね！\n\n$[unixtime.countdown ${time}]`,

		finish: 'ゲームの結果発表です！',

		finishWithWinner: (user, name, item, reverse, perfect, winCount, medal) => `${reverse ? "...ありゃ？逆順で集計しちゃいました！\n" : ""}今回は${user}さん${name ? `(${name})` : ""}の${perfect ? "パーフェクト" : ""}勝ちです！${winCount === 5 || winCount % 10 === 0 ? `\nこれが${winCount}回目の勝利みたいです！` : winCount === 1 ? "\nこれが初勝利みたいです！" : ""}おめでとう！\n景品として${item}${medal ? `とトロフィー(${medal}個目)` : ""}をどうぞ！\nまたやりましょう！`,

		finishWithNoWinner: item => `今回は全員負けです...\n${item}は私がもらっておきますね...\nまたやりましょう！`,

		onagare: item => `参加者が集まらなかったのでお流れになりました...\n${item}は私がもらっておきますね...\nまたやりましょう！`
	},

	/**
	 * 絵文字生成
	 */
	emoji: {
		suggest: emoji => `こんなのはどうですか？→${emoji}`,
	},

	/**
	 * 占い
	 */
	fortune: {
		cw: name => name ? `私が今日の${name}の運勢を占いました...` : '私が今日のあなたの運勢を占いました...',
	},

	/**
	 * タイマー
	 */
	timer: {
		set: time => `わかりました！時間になり次第お知らせします！\n\n$[unixtime.countdown ${time}]`,

		invalid: 'うーん...？ よくわからないです...',

		tooLong: '長すぎます…… (タイマーの長さは30日まで)',

		notify: (time, name) => name ? `${name}、${time}経ちましたよ！` : `${time}経ちましたよ！`
	},

	/**
	 * リマインダー
	 */
	reminder: {
		invalid: 'うーん...？ 内容を教えてほしいです！',

		doneFromInvalidUser: '誰だオメーは！',

		reminds: 'やること一覧です！',

		notify: (name) => name ? `${name}、これもう終わった？` : `これもう終わった？`,

		lastNotify: (name) => name ? `${name}、これもう終わった？ 最後の確認です！` : `これもう終わった？ 最後の確認です！`,

		notifyWithThing: (thing, name) => name ? `${name}、「${thing}」これもう終わった？` : `「${thing}」これもう終わった？`,

		done: (name) => name ? [
			`${name}、オマエ、ナカナカ、ヤルナ！`,
			`素晴らしいです、${name}`,
			`${name}、お疲れ様です！`,
		] : [
			`オマエ、ナカナカ、ヤルナ！`,
			`素晴らしいです`,
			`お疲れ様です！`,
		],

		cancel: `わかりました。`,
	},

	/**
	 * バレンタイン
	 */
	valentine: {
		chocolateForYou: name => name ? `${name}、その... チョコレート作ったのでよかったらどうぞ！🍫` : 'チョコレート作ったのでよかったらどうぞ！🍫',
	},

	server: {
		cpu: '@emtk サーバーの負荷上昇を検知 サーバーの負荷上昇を検知'
	},

	maze: {
		post: '今日の迷路です！ #MkckMaze',
		foryou: '描きました！'
	},

	chart: {
		post: `今日の${config.instanceName}の統計のグラフです！\n今日も一日、お疲れ様でした！`,
		nenmatuPost: `今日の${config.instanceName}の統計のグラフです！\nみなさん、今年もお疲れ様でした！来年もよろしくお願いします！`,
		foryou: '描きました！'
	},

	sleepReport: {
		report: hours => `コケコッコー、${hours}時間くらい寝ちゃってたみたい`,
		reportUtatane: minutes => `コケコッコー、${minutes}分くらい寝ちゃってたみたい`,
	},

	rpg: {
		remind: (me, hours) => `<center>$[x2 ${me}]\n\n${hours}時です！\nRPGモードの時間ですよ～\n\n毎日3回プレイして、\n私を強くしてください！\n\n「RPG」と話しかけてね\n（ここに返信でも大丈夫ですよ！）</center>`,
		intro: (enemyName, time) => `<center>$[x3 ${enemyName}]\n\nすごく大きい敵がやってきました！\n\nTLのみなさんで倒しましょう！\n\nこの投稿に「参加」と返信して、\nあなたの${config.rpgHeroName}と戦いましょう！\n(RPGモードのプレイが1回以上必要です)\n\n$[unixtime.countdown ${time}]</center>`,
		onagare: (enemyName) => `${enemyName}は暴れまわったのち、帰っていきました……\n討伐隊の評判が大きく下がりました……`,
		onagare2: (enemyName) => `${enemyName}コンテストの参加者はいませんでした……`,
		finishCw: (enemyName) => `${enemyName}討伐戦の結果発表です！`,
		finishCw2: (enemyName) => `${enemyName}コンテストの結果発表です！`,
		finish: (enemyName, score) => `みなさんのお陰で${enemyName}を撃退できました！\nありがとうございます！\nお礼にみなさんに${config.rpgCoinName}を${score}枚プレゼントします！\n「RPG ショップ」で買い物してくださいね！\nまたお願いします！`,
		finish2: (enemyName, score) => `${enemyName}コンテストへの参加ありがとうございます！\n参加賞としてみなさんに${config.rpgCoinName}を${score}枚プレゼントします！\n「RPG ショップ」で買い物してくださいね！\nまたお願いします！`,
		finalAttack: (dmg) => `${config.rpgHeroName}の全力の一撃！\n${dmg}ポイントのダメージを与えた！`,
		timeUp: (enemyName, maxHp) => `${enemyName}の最後の一撃！\n${config.rpgHeroName}は${"9".repeat(String(maxHp).length)}ポイントのダメージ！`,
		timeUp2: `${config.rpgHeroName}は全力を出してヘトヘトだ！`,
		totalDmg: (dmg) => `合計 ${dmg.toLocaleString()} ダメージを与えた！`,
		hiScore: (old: number, dmg: number) => `自己ベスト更新！\n${old.toLocaleString()} -> **${dmg.toLocaleString()}**`,
		GlobalHiScore: (old: number, date, dmg: number) => `ベストダメージ更新！\n${old.toLocaleString()}(${date}) -> **${dmg.toLocaleString()}**`,
		expPoint: (exp: number) => `RPGモードで1つレベルが上がるまでに\nレイドボスに5回参加で\nレイドでのレベルアップが発生！\nレイド経験値: ${"◆".repeat(exp) + "◇".repeat(Math.max(5 - exp, 0))}`,
		expPointFast: `レイドレベルアップイベント開催中！\nLv255まで毎回レイドボスでレベルアップ！`,
		nowStatus: "現在のステータス",
		lvUp: "今回のレベルアップ :",
		rpgMode: "RPGモード : ",
		status: {
			enemy: "現在の状態",
			lv: "Lv",
			atk: "パワー",
			def: "防御",
			spd: "行動回数",
			coin: config.rpgCoinName,
			skill: "スキル",
			post: "投稿数",
			pen: "防御貫通",
			rndM: "安定感",
			rndP: "不安定",
		},
		dmg: {
			give: "与ダメージ",
			take: "被ダメージ"
		},
		tired: (date, canOkawari, showHelp) => `RPGモードは0~11時、12~17時、18~23時の1日3回です。\n${date.getHours() < 12 ? "12時以降" : date.getHours() < 18 ? "18時以降" : "明日"}になったらもう一度試してください。${canOkawari ? "\n（おかわりをプレイしたい場合は、「rpg おかわり」と話しかけてください）" : ""}${showHelp ? "\n何か他の事をしようとして間違った際は、「RPG ヘルプ」を見てみると良いかもしれません！" : ""}`,
		start: "開始！",
		end: "終了！",
		turn: "ターン目",
		bonus: {
			a: "連続RPGボーナス！\nパワー・防御がアップした！",
			b: "連続RPGボーナス（弱）！\nパワー・防御が小アップした！",
			c: "毎日RPGボーナス！\nパワー・防御が小アップした！",
		},
		super: (me, num = 2) => `$[x2 ${me}]\n\n**${config.rpgHeroName}は覚醒状態になった！**\n行動回数+**${num}**！\nパワー・防御が**超**アップ！`,
		customSuper: (me, customStr) => `$[x2 ${me}]\n\n**${config.rpgHeroName}は覚醒状態になった！**\n${customStr}`,
		spdUp: `${config.rpgHeroName}は体の調子が良さそうだ！\n行動回数+1！`,
		skill: {
			firstItem: "スキル「準備を怠らない」発動！\n",
			spdDown: (enemyName) => `スキル「闇属性剣攻撃」発動！\n${enemyName}の周辺に強重力領域が発生した！\n${enemyName}の行動速度が低下した！`,
			fire: `スキル「炎属性剣攻撃」発動！\n攻撃時最低ダメージが上昇！`,
			ice: (enemyName) => `スキル「氷属性剣攻撃」発動！\n${enemyName}は凍って動けなくなった！`,
			wind: (num) => `スキル「風属性剣攻撃」発動！\n行動回数+${num}！`,
			dart: `スキル「土属性剣攻撃」発動！\n攻撃時最高ダメージが上昇！`,
			light: (enemyName) => `スキル「光属性剣攻撃」発動！\n${enemyName}の攻撃が弱体化した！`,
			dark: (enemyName, dmg) => `スキル「闇属性剣攻撃」発動！\n${enemyName}の周辺に強重力領域が発生した！\n${dmg}ポイントのダメージを与えた！`,
			weak: (enemyName) => `スキル「毒属性剣攻撃」発動！\n${enemyName}は弱体化している！`,
			sevenFever: (num) => `スキル「７フィーバー！」発動！\nステータス+${num}%！`,
			sevenFeverRaid: `スキル「７フィーバー！」発動！\nステータスがアップ！`,
			charge: `スキル「不運チャージ」発動！\n次回、良い事あるかも！`,
			enemyStatusBonus: `スキル「強敵と戦うのが好き」発動！\nパワー・防御がアップした！`,
			firstTurnResist: `スキル「油断しない」発動！\n${config.rpgHeroName}は相手を警戒している…`,
			tenacious: `スキル「粘り強い」発動！\n${config.rpgHeroName}の防御がアップ！`,
			lowHpFood: `スキル「お腹が空いてから食べる」発動！\n`,
			amuletBoost: `スキル「お守り整備」発動！\nお守りの耐久は減らなかった！`,
			heaven: `スキル「天国か地獄か」発動！\n${config.rpgHeroName}のステータスがアップ！`,
			hell: `スキル「天国か地獄か」発動！\n${config.rpgHeroName}のステータスがダウン…`,
			fortune: `「しあわせのお守り」発動！`,
			fortuneToken: `「しあわせのお札」発動！`,
			berserk: (berserkDmg) => `「バーサクのお守り」発動！\n${berserkDmg}ポイントのダメージを受けた！\n${config.rpgHeroName}のパワーがアップ！`,
			stockRandom: `謎のお守りが光り始めた……\n何かが起こったようだ。`,
			guardAtkUp: (num) => `スキル「攻めの守勢」発動${num > 1 ? `×${num}` : ""}！\n${config.rpgHeroName}のパワーがアップ！`
		},
		lvBonus: (num) => `修行の成果ボーナス！\nステータス+${num}%！`,
		nurse: "$[x3 :mkck_nurse:]\n\n通りすがりのナースが現れた！\nナースは受けた傷を治療してくれた！", //この文を空白にすればナースは来なくなります
		haisui: `${config.rpgHeroName}は決死の覚悟をした！\nパワーが上がり、防御が下がった！`,
		endure: `${config.rpgHeroName}は気合で耐えた！`,
		fireAtk: (enemyName) => `${config.rpgHeroName}の追い打ち炎攻撃！\n${enemyName}が次に受けるダメージが上昇した！`,
		win: "勝利！おめでとう！",
		lose: ":oyoo:",
		escape: `${config.rpgHeroName}は戦闘から逃げた！`,
		escapeNotBattle: `${config.rpgHeroName}は一旦諦めて別の事をするようだ。`,
		getCoin: (num) => `${num}枚の${config.rpgCoinName}を拾った！\n「RPG ショップ」でお買い物してくださいね！`,
		next: "次回へ続く……",
		nextPlay: (str) => `次回は${str}以降に遊べます。`,
		getRerollOrb: (num) => `\n\nスキル変更珠を${num > 1 ? `${num}個` : ""}拾いました！\n「RPG スキル」と話しかけて確認してみてね！`,
		reachMaxLv: `\n\n**Lv255到達、おめでとうございます！**\n\n${config.rpgHeroName}の成長限界地点に達しました！\nこれから先はレベルを上げても、\nあまり能力が成長しないようになります！\nここから更に強くなるには、\nスキルやアイテムなどを工夫してみてね！`,
		shop2remind: "\n\nショップに新しいアイテムが追加されたようです……\n「RPG ショップ」で確認してみましょう！",
		forcePostCount: "周囲に不思議な力が働いている…\n投稿数ボーナスが無効になった！",
		oomisoka: "大晦日チャレンジ開始！\n体力が1になった！",
		oomisokaEnd: (score, num) => `大晦日チャレンジ結果！\n評価: ★${score}\n${config.rpgCoinName}を${num}枚ゲット！`,
		skillX: (num) => `$[x2 :mk_wizard:]\n\n力をそなたに与えよう……\n\n強化魔法で${config.rpgHeroName}のスキルの\n効果が${num}倍になった！`,
		giveAmulet: `$[x2 :mk_fighter:]\n\nこれをお主にやろう。\nついさっきそこで拾ったんじゃ。\n\n古びた謎のお守りを貰った！`,
		draw: "あいこになった！\nお互いにダメージなし！",
		allStageClear: `気が付いたら、ここは最初に旅を始めた場所だった。\nどうやら旅をしすぎて\n世界を1周してしまったようだ。\n\n**ステージ100クリアおめでとう！**\n${config.rpgCoinName}を1,000枚獲得しました！\n「長き旅の思い出」を入手しました！`,
		warrior: {
			get: "$[x2 :mk_warrior:]\n\nオレも手伝うぜ！\n\n:mk_warrior:が仲間になった！",
			atk: (dmg) => `:mk_warrior:の攻撃！\n${dmg}ポイントのダメージ！`,
			lose: `:mk_warrior:は${config.rpgHeroName}を庇って倒れた！\n:mk_warrior:「あとは任せたぜ……」`,
			totalDmg: (dmg) => `（:mk_warrior: 合計 ${dmg.toLocaleString()} ダメージ）`
		},
		player: {
			mark: "☆",
			mark2: "★",
			hpmsg: "体力",
		},
		fire: "🔥",
		journey: {
			err: `探索中以外の状態では旅モードは指定できません。探索中になったらもう一度試してください。`,
			win: "（次のステージへ進む場合は、\n次回も旅モードを指定してください）",
			lose: (day) => day ? `(ステージが${day}、戻ってしまった…)` : "",
		},
		trial: {
			tired: `全力を出して疲れてしまったみたいです。Lvが上がったら、もう一度試してみてください。`,
			cw: (lv) => `${config.rpgHeroName}は自分の力を確認するようだ。(Lv${lv})`,
			atk: (dmg) => `${config.rpgHeroName}は木人に攻撃！\n${dmg}ポイントのダメージ！`,
			result: (totalDmg: number) => `合計${totalDmg.toLocaleString()}ポイントのダメージ！`,
			random: (down: number, up: number) => `(ダメージ幅: ${down.toLocaleString()} ~ ${up.toLocaleString()})`,
			best: (bestScore: number) => `(これまでのベスト: **${bestScore.toLocaleString()}**)`,
		},
		oneMore: {
			tired: (flg) => `\n今日は既におかわりRPGをプレイしている様です。${flg ? "\n明日になるとまたおかわりRPGがプレイ可能になります。" : ""}`,
			maxLv: "\nあなたは過去にプレイ可能だったすべてのRPG権利をプレイ済みで、取り逃したRPG権利が無いようです！\nRPGをやり忘れた時に、もう一度試してみてください。",
			maxLv2: "\nあなたは既にLv255に到達している為、おかわりする事が出来ません！",
			err: "\nおかわりRPGの前に通常のRPGをプレイする必要があります！",
			buyQuestion: (num, coin: number) => `\n${config.rpgCoinName}を${num}枚使用すると、もう1回おかわりRPGをプレイできます！\n\n消費してプレイしますか？（所持${config.rpgCoinShortName}数: ${coin.toLocaleString()}）\n\n「はい」または「いいえ」で返信してください！`,
			buyComp: `\nおかわりRPGがプレイ可能になりました！\nもう一度おかわりRPGを試してみてください！\n（この確認を次回からスキップしたい場合、ショップで札を購入してください！）`,
			autoBuy: (coin: number) => `おかわりRPGのプレイ権利を\n自動購入しました！\n（残り${config.rpgCoinShortName}数: ${coin.toLocaleString()}）`,
		},
		info: `${config.rpgHeroName}の状況判断能力がアップ！\n今後、状況が細かく\n分析出来るようになる事があるぞ！`,
		infoPercent: "%",
		postBonusInfo: {
			post: (num: number, bonus) => `投稿数 ${num.toLocaleString()} ステータス${bonus}%`,
			continuous: {
				a: (num: number) => `連続RPGボーナス 投稿数+${num.toLocaleString()}`,
				b: (num: number) => `連続RPGボーナス（弱） 投稿数+${num.toLocaleString()}`,
				c: (num: number) => `毎日RPGボーナス 投稿数+${num.toLocaleString()}`,
			},
			super: `覚醒ボーナス 投稿数+200`,
		},
		newSkill: (newSkill) => `新しいスキル\n「${newSkill}」\nを手に入れました！\n「RPG スキル」と話しかけて確認してみてね！`,
		moveToSkill: (oldSkill, newSkill) => `スキル\n「${oldSkill}」が、\n「${newSkill}」\nに変化しました！`,
		newColor: (unlockColors) => `\n\n条件を満たしたので、\n新しい色が解放されました！\n\n$[x2 ${unlockColors}]\n\n「RPG 色」と話しかけて確認してみてね！`,
		color: {
			info: "色を変更する場合、`rpg 色変更 <数字>`と話しかけてね",
			list: "色解放条件",
			default: "初期解放",
			unlock: "解放済み",
		},
		skills: {
			info: (num: number) => `スキルを変更する場合、\`rpg スキル変更 <数字>\`と話しかけてね (変更珠所持数: ${num.toLocaleString()})`,
			duplicationInfo: (num: number) => `スキルを変更&複製する場合、\`rpg スキル変更複製 <消すスキルの数字>\`と話しかけてね 消えたスキルの枠に既に持っているスキルのどれかが入るよ (複製珠所持数: ${num.toLocaleString()})`,
			list: "所持スキル一覧",
			sort: "所持スキルをソートしました！\n次回のスキル変更の際に誤った番号を指定しない様に気を付けてください！"
		},
		shop: {
			welcome: (coin: number) => `:mk_lowpoly:ショップへようこそ！\n欲しい商品の数値またはアルファベットを返信してね\n（所持${config.rpgCoinShortName}数: ${coin.toLocaleString()}）\n`,
			welcome2: (coin: number, orb: number) => `$[spin.y,speed=5s :mk_lowpoly:]ようこそ、裏ショップへ……\n欲しい商品の数値またはアルファベットを返信してくれ……\n（所持${config.rpgCoinShortName}数: ${coin.toLocaleString()}）\n（所持変更珠数: ${orb.toLocaleString()}）\n`,
			welcome3: (coin: number) => `:mk_lowpoly:カスタムショップへようこそ！\n欲しいパーツの数値を返信してね\n（所持${config.rpgCoinShortName}数: ${coin.toLocaleString()}）\n`,
			buyItem: (itemName, coin: number) => `:mk_lowpoly:まいどあり！\n${itemName}を購入しました！\n（残り${config.rpgCoinShortName}数: ${coin.toLocaleString()}）`,
			buyItemOrb: (itemName, orb: number) => `:mk_lowpoly:まいどあり！\n${itemName}を購入しました！\n（残り変更珠数: ${orb.toLocaleString()}）`,
			useItem: (itemName) => `${itemName}を使用しました！`,
			notEnoughCoin: `:mk_lowpoly:${config.rpgCoinShortName}が足りません！`,
			notEnoughOrb: `:mk_lowpoly:変更珠が足りません！`
		},
		help: {
			title: "RPG コマンド一覧",
			normal1: "[ RPG ]\n私と一緒に戦って強くなりましょう！\n0~11時 12~17時 18~23時でそれぞれプレイ出来ますよ～",
			normal2: "[ RPG ]\n通常モードでRPGを開始します！\n0~11時 12~17時 18~23時でそれぞれプレイ出来ますよ～",
			trial: (num: number) => `[ RPG 木人 ]\n木人を叩いて強さを確認できますよ～\n通常のRPGとは別に、1Lvにつき1回までです！${num ? `\nこれまでのベストは${num.toLocaleString()}ダメージみたいです！` : ""}`,
			journey: "[ RPG 旅モード ]\n敵がいない際に指定していただくと、私が旅に出ます！\n道はどんどん険しくなり、なかなか大変みたいです…\n通常のRPGと遊べる権利を共有しているみたいです！",
			okawari1: (num) => `[ RPG おかわり ]\n1日1回、このコマンドでRPGをもう一度遊べるみたいです！\n過去にRPGをプレイし忘れた回数使えます！\n（あと${num}回使えるみたいですよ！）`,
			okawari2: (num) => `[ RPG おかわり ]\n1日1回、このコマンドでRPGをもう一度遊べるみたいです！\nさらに${config.rpgCoinName}を何枚か使用すれば、さらにもう1回おかわりも出来ちゃうみたいです！\n過去にRPGをプレイし忘れた回数使えます！\n（あと${num}回使えるみたいですよ！）`,
			okawari3: (num) => `[ RPG おかわり ]\n1日1回、このコマンドでRPGをもう一度遊べるみたいです！\nさらに${config.rpgCoinName}を何枚か使用すれば、さらにもう1回おかわりも出来ちゃうみたいです！\nLv255になるまで使えます！\n（あと${num}回使えるみたいですよ！）`,
			color: "[ RPG 色 ]\n私の色についての情報が見られるみたいです！\n頑張って色を集めて着せ替えしましょう！\n一部の色には特殊効果もついてるらしいです！",
			skills1: "[ RPG スキル ]\n私の今持っているスキルについての情報がここで確認できるみたいです！",
			skills2: "[ RPG スキル ]\n私の今持っているスキルについての情報がここで確認できるみたいです！\n変更珠があれば、スキルの入替もここで行えるみたいです！",
			shop: (coin: number) => `[ RPG ショップ ]\n${config.rpgCoinName}を使って、ショップでお買い物が楽しめるみたいです！\n1つしか持てないし壊れるけど効果が強いお守りや、捨てるまで効果が発動するお札など色々買えるみたいです！\n1日1回並んでいる商品が変わるらしいです！\n（${config.rpgCoinName}: ${coin.toLocaleString()}枚）`,
            shop2: `[ RPG 裏ショップ ]\n購入した裏ショップ入場の札を使って、裏ショップに入ります！\n${config.rpgCoinName}とスキル変更珠を使って、珍しいアイテムを買えるみたいです！\n1日1回並んでいる商品が変わるらしいです！`,
            shopCustom: `[ RPG カスタムショップ ]\nお守りパーツを組み合わせて自分好みのお守りを作成できます！`,
			item: "[ RPG アイテム ]\n私の今持っている全てのアイテムの一覧がここで確認できるみたいです！",
			status: `[ ステータス ]\n今の私の強さや私のなつき度、あなたの数取りの戦績がここで確認できるみたいです！`,
			record: `[ RPG 殿堂 ]\nRPGモードで打ち立てた記録とその全体の順位をここで確認できますよ！`,
			link: `[ リンク ]\nあなたがサブアカウントを持っているなら、アカウントをリンクさせておくとRPGで有利になります！`,
			help: "[ RPG ヘルプ ]\nここです！RPGに関係するコマンドの説明とかがここで見れるみたいです！\n迷ったらこのコマンドを使ってみてくださいね！",
		},
		command: {
			rpg: "rpg",
			color: ["色", "スキン", "color", "skin"],
			trial: ["木人", "test", "dummy"],
			journey: ["旅", "無限", "endless", "endress", "journey"],
			change: "変更",
			onemore: ["おかわり", "+", "onemore", "もう一回"],
			skill: ["スキル", "skill", "お守り", "amulet"],
			shop: ["ショップ", "shop", "お店"],
            shop2: ["裏", "ura", "2", "another"],
            shopCustom: ["カスタム", "custom"],
			help: ["h", "ヘルプ", "?"],
			Record: ["殿堂", "記録", "record", "trophy", "achieve", "achievement", "rank"],
			duplication: "複製",
			items: ["インベントリ", "inventory", "アイテム", "item", "持ち物", "belonging", "バッグ", "bag", "所持品", "possession", "道具", "tool", "装備", "equip", "お札", "charm", "壺", "jar", "pot"]
		}
	},

	noting: {
		notes: [
			'1時間以上経過した投稿は絶対時刻で表示されるようになります！',
			'絵文字ピッカーの検索欄で!を最後に入れてEnterを押すとその絵文字コードでリアクション出来ます！',
			'設定の色々からスワイプのオンオフ、感度などを調整できます！',
			'もこきーでは、誰かがフォローしている人をリストに入れてもプロキシアカウントは動きません！',
			'ホームTLにはフォローしてる人同士の返信が表示されるようになっています！',
			'ホームTLにローカルの人を含めるか含めないか設定の色々から変更できますよ！',
			'あなたのパワー、どのくらいですか？数字が高いとすごいです！',
			'webhookでDiscordやSlackなどに通知を飛ばすような設定をすると、見落としが少なくなって便利です！',
			'投稿のURLを投稿欄に貼り付けるとその投稿を引用に出来るみたいです！そのまま空白で投稿するとRTになりますよ～',
			'設定の色々からフォントサイズを変えられますよ！文字が大きすぎると思ってる人は変えてみると良いかもです',
			'投稿欄の×やアカウント切換などのボタンは設定の色々から消せますよ～',
			'投稿欄の×ボタンを投稿全消し機能に変更できるみたいです！×ボタンを使うことがあまりないなら便利かもしれません！',
			'言語設定で日本語(ｶｷｰｺ)にすると……なにこれ？',
			'言語設定で日本語(お嬢様)にするとお嬢様になることが出来ます！',
			'もこきーの便利なワードミュートで嫌いなものを全部消しちゃいましょう！',
			'苦手な絵文字は設定>ワードミュートの絵文字ミュート機能で消しちゃいましょう！',
			'MFM入力ボタンの適用範囲はカーソルの場所から次の改行までです！範囲に文字がなければ全範囲になります！上手く使えば便利です！',
			'公開TLにRTを表示するかどうかは設定>色々で変えられますよ～',
			'未ログインのユーザにはログイン状態が表示されない仕様になっています！',
			'たまにはトレンドを見たら面白い投稿があるかもです！',
			'暇なときはトレンドの投票タブでみんなのアンケートに答えて遊んでいます！',
			'リアクション設定でピッカーのサイズを自由に変えられますよ～',
			'左下のℹのボタンから招待コードを作れるみたいです～ お友達もここに呼んじゃいましょう！',
			'公開範囲を色々使う人は投稿ボタンをたくさんにしてみると快適に過ごせると思います！',
			'パワーはとにかく投稿数を増やすのが効率よく上げるコツみたいです！めざせ⭐ランク！',
			'連合ありになっているチャンネルはチャンネル名と同じ名前のハッシュタグも拾ってくるみたいですよ',
			'⭐ボタン、効果を変えたり、消したり出来るみたいですよ！設定>リアクションから可能です！',
			'ユーザーリストで⭐が付いてるのはフォローされてるよってマークみたいです！',
			'絵文字だけの投稿をすると絵文字が大きくなるみたいです！',
			'もこきー＆フォロワーで投稿すると、外部にはフォロワー限定で投稿されるみたいです。RTとかされなくなるみたいですよ～',
			'他の人のもこきー＆フォロワーをRTすると、ローカル限定でRTされますよ～',
			'トゥートにパワーを込めています！バンバンバン！あなたも設定>色々からパワーを込めてみませんか？',
			'・－・・・ －－・－－ －－－・ －－・・－ ・・ －・－・・ ・・－－ ・・－ ・・－－ －・・－・ ・－－・－ －・－－・ －－－・－ ・・－－ －－・－・ ・・ ・・－・・ ・・ ・・－ －－・・ ・・・－ －－－－ ・・ ・・－ －・－・・ ・・－－ ・・－ ・－－－ ・－・・・ ・－・－・ －・－・ －－－・－ －・－－・ ・・－・・ －－－－ ・・－ ・－ ・・－ ・・－・・ ・・－ －－－－ ・・－ ・－・－－ ・・ ・ ・・ ・－・－・ －－・ ・－・－－ ・・ －－－・－',
			'設定から空リプボタンを有効にして空リプボタンを押すといい感じの公開範囲で空リプが出来ますよ～',
			'ページの投稿フォームは、他のサーバのユーザの方でも自分のサーバーに投稿できるような仕組みになってるみたいです',
			'アンテナの通知をオンにするとプッシュ通知が来て便利です！リストをアンテナの中に入れることも出来ますよ～',
			'一部の設定は端末に保存されていますので設定のバックアップを取っておくと後々助かります！これを見たあなた、設定から今すぐバックアップを取りましょう！',
			'リアクション設定から、リアクション表示をオフにすることが出来ますよ！オフでも詳細画面に入ればリアクションを確認することが出来ます！',
			'フォローしていない人のリアクションは見えないことがあるみたいです！',
			'フォロー済の人のピン留めは省略表示になります！',
			'投稿範囲の色は、もこわー全公開：青、ホーム：緑、フォロ限：赤、ダイレクト：黄 ですよ～',
			'支援すると複数個リアクションを付けられるようになるみたいですよ！お知らせから支援しましょう！',
			'ピン留めしている投稿のメニューからピンを上に上げる機能が使えるみたいです！',
			'プライバシー設定から公開やホームなどの公開範囲を封印出来ますよ～ 誤爆しがちな人には便利かもです！',
			'グラフがグワングワンする人は設定からグラフを非表示にすると良いと思います！',
			'昔々、もこもこ港っていうサーバーがあったみたいです……',
			'リアクションで同じ名前の絵文字が纏められるようになってますが、メニューのリアクションから纏められてないのも確認できるみたいです！',
			'⭐ランクは投稿だけだと大体250投稿/日、7500投稿/月くらい必要みたいです 大変ですね……',
			'パワーのランクは31日間の活動量で決定されています！',
			'リアクションすると約0.4投稿分くらいのパワーが貰えるみたいですよ～',
			'ウィジェットを長押しすると、ウィジェットの設定や配置の設定などが行えるメニューが出るみたいです',
			'もこきーの投稿をDiscordとかに貼り付けると、いい感じに表示されるみたいですよ～',
			'設定>その他からあなたのアカウントの統計が確認できますよ！数字が増えていくと楽しいですね～',
			'毎日1投稿目は普通の時よりもたくさんパワーが貰えるみたいですよ！お得です！',
			'毎日ほどほどに使っているとランクはD~B+くらいになるみたいです！AA以上の人はかなりどっぷりですね……',
			'もこきーの招待コードは他のMisskeyサーバーの物と違って、24時間何回でも使えるみたいです！',
			'設定>ドライブから支援で増えたドライブ量が確認できますよ～',
			'データセーバーを使うと通信量が減らせるみたいです！これで月末に苦しまないですみますね！',
			'設定>色々でデータセーバー自動切り替えをオンにするとWi-Fiに繋がっている時に自動的にオフになって便利です！',
			'絵文字ピッカーで@を入力すると他のサーバーの絵文字も使用できますよ～ うまく行かないときは設定>その他>再取得、です！',
			'リアクションデッキ、5ページもあって何をどう入れるか悩みます……',
			'リアクション設定のオート追加ボタンを使うとデッキが勝手に設定されて便利です！（データセーバー時は使用できません）',
			'リアクション設定からダブルタップでリアクションするをオンにするとリアクションが誤爆しにくくて助かります！',
			'絵文字の入力待機中でも、Enterを入力するとすぐに検索開始してくれますよ～',
			'絵文字ピッカーでひらがなだけを入れるとローマ字に変換して絵文字検索してくれるみたいですよ～',
			'支援者になったらプロフィール設定からバッジを装備出来るようになるみたいです。いいな～',
			'設定>お遊び機能から下品な投稿を消せちゃうみたいです',
			'通信制限のときは `https://mkkey.net/cli`を使うと通信量が少なくて便利みたいです！',
			'もこきーにアカウントがなくても、プロフィールのフォローボタンを押すと自身のサーバーに移動してからフォローが出来るみたいです！',
			'ロード画面のメッセージの表示が消えるのが速すぎる？ 設定>色々からロード時間を長くするオプションをオンにすると良いかもです',
			'あなたの今日の運勢を占います！占ってってリプライを送ってね',
			'タイマー機能があります！測って欲しい時間をリプライで送ってね',
			'なにか覚えておいてほしい事があれば私が覚えておきます！remind 内容ってリプライを送ってね',
			'絵文字でキメラを作り出します！絵文字ってリプライを送ってね',
			'みんなで数取りゲームをしましょう！数取りってリプライを送ってね',
			'なんとかって呼んでってリプライを送っていただければあなたをその名前で呼ぶようにします！',
			'フォロバしてってリプライを送っていただければあなたをフォローします！リアクションもしますよ〜',
			'チャートってリプライを送っていただいたら、適当なチャートを出力します！投稿やフォロワーもリプライに含めてもらえれば、あなたに関するデータを出力しますよ！',
			'絵文字情報ってリプライを送っていただければあなたのよくリアクションに使っている絵文字が何かを教えますよ～',
			'懐き度ってリプライを送っていただければあなたへの懐き度を教えます！',
			'もこきーは中学生以下である事が分かりやすい人の登録が認められていないようです……\n\nたまにはサーバルールも再確認してみてくださいね！\nhttps://mkkey.net/@emtk/pages/server-rule',
		],
		want: item => `${item}、欲しいかも……`,
		see: item => `お散歩していたら、道に${item}が落ちているのを見ました！`,
		expire: item => `気づいたら、${item}の賞味期限が切れてました……`,
		talkTheme: word => `${Math.random() < 0.5 ? `みなさんは、「${word}」についてどのように感じていますか？` : `みなさんで「${word}」の事について話してみるのはどうですか？`}`
	},
};

export function getSerif(variant: string | string[]): string {
	if (Array.isArray(variant)) {
		return variant[Math.floor(Math.random() * variant.length)];
	} else {
		return variant;
	}
}

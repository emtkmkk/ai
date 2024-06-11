// せりふ

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

		tooLong: (length, max) => `長すぎるかも... (${max}文字まで ${(max-length)*-1}文字オーバー)`,

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
		done: (res,total) => `${res}${total ? `\n合計 \\(${total}\\)` : ""} です！`
	},

	birthday: {
		happyBirthday: (name) => name ? `お誕生日おめでとうございます、${name}🎉` : 'お誕生日おめでとうございます🎉',
		happyBirthdayLocal: (name, acct) => name ? `今日は${acct}さん(${name})のお誕生日みたいです！\n${name}、お誕生日おめでとうございます🎉` : `今日は${acct}さんのお誕生日みたいです！\nお誕生日おめでとうございます🎉`,
	},

	welcome: {
		welcome: (acct) => `${acct}さん\n**もこきーへようこそ！**\nわたしはもこもこチキン、このサーバーのマスコットみたいな存在です！\nお暇な時に挨拶していただいたり、呼び名を教えていただいたり、占いや迷路などで遊んでくださったりしてくれれば嬉しいです！\nこれからよろしくお願いします！\n\nこのサーバーには独自機能が沢山あるので、気になったらお知らせの中にあるもこきーTipsを読んでみるといいかもです！\nなにか分からないことや嫌なこと、不便なことがあれば、気軽にもこきーあどみんに声をかけてください！\nそれでは楽しいもこきーライフを～ :mk_hi:`,
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
		fail: (ans, maxtry,  history) => `不正解です、${maxtry}回以内に当てられませんでした…… 秘密の数は「${ans}」でした。 (履歴: ${history})`,
	},

	/**
	 * 数取りゲーム
	 */
	kazutori: {
		alreadyStarted: '今ちょうどやってますよ～',

		matakondo: (ct, time) => `また今度やりましょう！(あと${ct}分後にもう一度送ってください)\n\n$[unixtime.countdown ${time}]`,

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
		post: '今日のもこきーの統計のグラフです！\n今日も一日、お疲れ様でした！',
		nenmatuPost: '今日のもこきーの統計のグラフです！\nみなさん、今年もお疲れ様でした！来年もよろしくお願いします！',
		foryou: '描きました！'
	},

	sleepReport: {
		report: hours => `コケコッコー、${hours}時間くらい寝ちゃってたみたい`,
		reportUtatane: minutes => `コケコッコー、${minutes}分くらい寝ちゃってたみたい`,
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

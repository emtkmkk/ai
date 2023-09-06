// せりふ

export default {
	core: {
		setNameOk: name => `わかりました。これからは${name}と呼びます！`,

		san: 'さん付けした方がいいですか？',

		yesOrNo: '「はい」か「いいえ」しかわからないです...',

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
				`${name}、それは偉業だね`
			] : [
				`あなたはえらい！`,
				`それは偉業だね`
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

		itterassyai: {
			love: name => name ? `いってらっしゃい、${name}！` : 'いってらっしゃい！',

			normal: name => name ? `いってらっしゃい、${name}！` : 'いってらっしゃい！',
		},

		tooLong: '長すぎるかも...',

		invalidName: '発音が難しいかも',

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
		learned: (word, reading) => `(${word}..... ${reading}..... 覚えましたし)`,

		remembered: (word) => `${word}`
	},

	dice: {
		done: res => `${res} です！`
	},

	birthday: {
		happyBirthday: name => name ? `お誕生日おめでとうございます、${name}🎉` : 'お誕生日おめでとうございます🎉',
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
		started: '0~100の秘密の数を当ててみてください♪',

		/**
		 * 数字じゃない返信があったとき
		 */
		nan: '数字でお願いします！「やめる」と言ってゲームをやめることもできますよ！',

		/**
		 * 中止を要求されたとき
		 */
		cancel: 'わかりました～。ありがとうございました！',

		/**
		 * 小さい数を言われたとき
		 */
		grater: num => `${num}より大きいです`,

		/**
		 * 小さい数を言われたとき(2度目)
		 */
		graterAgain: num => `もう一度言いますが${num}より大きいです！`,

		/**
		 * 大きい数を言われたとき
		 */
		less: num => `${num}より小さいです`,

		/**
		 * 大きい数を言われたとき(2度目)
		 */
		lessAgain: num => `もう一度言いますが${num}より小さいです！`,

		/**
		 * 正解したとき
		 */
		congrats: tries => `正解です🎉 (${tries}回目で当てました)`,
	},

	/**
	 * 数取りゲーム
	 */
	kazutori: {
		alreadyStarted: '今ちょうどやってますよ～',

		matakondo: 'また今度やりましょう！',

		intro: (max, minutes) => `みなさん、数取りゲームしましょう！\n0~${max}の中で最も大きい数字を取った人が勝ちです。他の人と被ったらだめですよ～\n制限時間は${minutes}分です。数字はこの投稿にリプライで送ってくださいね！`,

		finish: 'ゲームの結果発表です！',

		finishWithWinner: (user, name) => name ? `今回は${user}さん(${name})の勝ちです！おめでとう！またやりましょう！` : `今回は${user}さんの勝ちです！おめでとう！またやりましょう！`,

		finishWithNoWinner: '今回は全員負けです... またやりましょう！',

		onagare: '参加者が集まらなかったのでお流れになりました...'
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
		set: 'わかりました！',

		invalid: 'うーん...？',

		tooLong: '長すぎます…',

		notify: (time, name) => name ? `${name}、${time}経ちましたよ！` : `${time}経ちましたよ！`
	},

	/**
	 * リマインダー
	 */
	reminder: {
		invalid: 'うーん...？',

		doneFromInvalidUser: 'イタズラはめっですよ！',

		reminds: 'やること一覧です！',

		notify: (name) => name ? `${name}、これもう終わった？` : `これもう終わった？`,

		notifyWithThing: (thing, name) => name ? `${name}、「${thing}」これもう終わった？` : `「${thing}」これもう終わった？`,

		done: (name) => name ? [
			`素晴らしいです、${name}`,
			`${name}、お疲れ様です！`,
			`${name}、オマエ、ナカナカ、ヤルナ！`,
		] : [
			`素晴らしいです`,
			`お疲れ様です！`,
			`オマエ、ナカナカ、ヤルナ！`,
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
		post: '今日の迷路です！ #AiMaze',
		foryou: '描きました！'
	},

	chart: {
		post: 'インスタンスの投稿数です！',
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
			'アンテナにリストを入れて通知オンにすると便利ですよ！',
			'誰かがフォローしている人をリストに入れてもプロキシアカウントは動きません！',
			'ホームTLにはフォローしてる人同士の返信が表示されるようになっています！',
			'ホームTLにローカルの人を含めるか含めないか設定の色々から変更できますよ！',
			'あなたのパワー、どのくらいですか？数字が高いとすごいです！',
			'webhookでDiscordやSlackなどに通知を飛ばせば気づきやすくて便利です！',
			'ここでもこきーの更新履歴が確認できるみたいです！\n https://code.naskya.net/emtkmkk/mkkey/src/branch/beta/patchnote.md',
			'投稿のURLを投稿欄に貼り付けるとその投稿を引用に出来るみたいです！そのまま空白で投稿するとRTになりますよ～',
			'設定の色々からフォントサイズを変えられますよ！文字が大きすぎると思ってる人は変えてみると良いかもです',
			'投稿欄の一部のボタンは設定の色々から消せますよ～',
			'言語設定で日本語(ｶｷｰｺ)にすると……なにこれ？',
			'便利なワードミュートで嫌いなものを全部消しちゃいましょう！',
			'苦手な絵文字は設定>ワードミュートの絵文字ミュート機能で消しちゃいましょう！',
			'MFM入力ボタンの範囲ってカーソルの場所から改行までに掛かるんですね、便利です！',
			'ワードミュートでpname: って入れると跡形もなく投稿を消せちゃうみたいです…',
			'公開TLにRTを表示するかどうかは設定>色々で変えられますよ～',
			'未ログインのユーザにはログイン状態が表示されません！便利です！',
			'たまにはトレンドを見てみてもいいかもです！',
			'暇なときはトレンドの投票タブで無限アンケートをして遊んでいます！',
			'もこもこチキンですよ〜',
			'リアクション設定でピッカーのサイズを自由に変えられますよ～',
			'左下のℹのボタンから招待コードを作れるみたいです～ お友達もここに呼んじゃいましょう！',
			'公開範囲を色々使う人は投稿ボタンをたくさんにしてみると快適に過ごせると思います！',
			'もこきー 最強 マスコット [検索]',
			'パワーはとにかく投稿数を増やすのが効率よく上げるコツみたいです！めざせ⭐ランク！',
			'もこきーには隠し機能というのがあるみたいですよ……',
			'連合ありになっているチャンネルはチャンネル名と同じ名前のハッシュタグも拾ってくるみたいですよ',
			'⭐ボタン、効果を変えたり、消したり出来るみたいですよ！私のおすすめは「ブックマーク」です！',
			'ユーザーリストで⭐が付いてるのはフォローされてるよってマークみたいです！',
			'設定>色々から投稿に関係性のマークが出せますよ～ ハートのマークが片思いで禁止マークみたいなのがフォロー関係無し、です！',
			'絵文字だけの投稿をすると絵文字が大きくなるみたいです！',
			'もこきー＆フォロワーで投稿すると、外部にはフォロワー限定で投稿されるみたいです。RTとかされなくなるみたいですよ～',
			'他の人のもこきー＆フォロワーをRTすると、ローカル限定でRTされますよ～',
			'トゥートにパワーを込めています！バンバンバン！あなたも設定>色々からパワーを込めてみませんか？',
			'0:00:00によるほーと投稿するとトゥートにフクロウが現れますよ！',
			'カレンダーウィジェットで日付変更の時間を6:00として扱う設定がありますよ～',
			'空リプボタンを押すといい感じの公開範囲で空リプが出来ますよ～',
			'ページの投稿フォームは、ログインしてない人でも自分のサーバーに投稿できるような仕組みになってるみたいです',
			'アンテナの通知をオンにするとプッシュ通知が来て便利です！',
			'一部の設定は端末に保存されていますので設定のバックアップをキチンと取っておくと後々助かります！',
			'リアクション設定から、リアクション表示をオフにすることが出来ますよ！詳細画面に入ればリアクションを確認することが出来ます！',
			'フォロー済の人のピン留めは省略表示になります！',
			'投稿範囲の色は、もこわー全公開：青、ホーム：緑、フォロ限：赤、ダイレクト：黄 ですよ～',
			'他の人の投稿をピン留めする方法があるみたいです……',
			'支援すると複数個リアクションを付けられるようになるみたいですよ！お知らせから支援しましょう！',
			'ピン留めしている投稿のメニューからピンを上に上げる機能が使えるみたいです！',
			'プライバシー設定から公開範囲を封印出来ますよ～ 誤爆しがちな人には便利かもです！',
			'グラフがグワングワンする人は設定からグラフを非表示にすると良いと思います！',
			'昔々、もこもこ港っていうサーバーがあったみたいです……',
			'リアクションで同じ名前の絵文字が纏められるようになってますが、メニューのリアクションから纏められてないのも確認できるみたいです！',
			'⭐ランクはだいたい200投稿/日くらい必要みたいです 大変ですね……',
			'パワーのランクは31日間の活動量で決定されています！',
			'リアクションすると約0.4投稿分くらいのパワーが貰えるみたいですよ～',
			'ウィジェットを長押しすると、ウィジェットの設定や配置の設定などが行えるメニューが出るみたいです',
			'もこきーの投稿をDiscordとかに貼り付けると、いい感じに表示されるみたいですよ～',
			'設定>その他からあなたのアカウントの統計が確認できますよ！数字が増えていくと楽しいですね～',
			'毎日1投稿目は普通の時よりもたくさんパワーが貰えるみたいですよ！お得です！',
			'毎日ほどほどに使っているとランクはD~B+くらいになるみたいです！……えっ、AA？怖い……',
			'招待コードは他のMisskeyサーバーの物と違って、24時間何回でも使えるみたいです！',
			'設定>ドライブから支援で増えたドライブ量が確認できますよ～',
			'データセーバーモードを使うと外でも通信量が削減できて便利です！',
			'設定>色々でデータセーバー自動切り替えをオンにするとWi-Fiに繋がっている時に自動的にオフになって便利です！',
			'絵文字ピッカーで@を入力すると他のサーバーの絵文字も使用できますよ～ うまく行かないときは設定>その他>再取得、です！',
			'リアクションデッキ、5ページもあって何をどう入れるか悩みます……',
			'リアクション設定のオート追加ボタンを使うとデッキが勝手に設定されて便利です！（データセーバー時は使用できません）',
			'リアクション設定からダブルタップでリアクションするをオンにするとリアクションが誤爆しにくくて助かります！',
			'絵文字の入力待機中でも、Enterを入力するとすぐに検索開始してくれますよ～',
			'絵文字ピッカーでひらがなだけを入れるとローマ字に変換して絵文字検索してくれるみたいですよ～',
			'支援者になったらプロフィール設定からバッジを装備出来るようになるみたいです。いいな～',
			'通信制限のときは `https://mkkey.net/cli`を使うと通信量が少なくて便利みたいです！',
			'もこきーにアカウントがなくても、プロフィールのフォローボタンを押すと自身のサーバーに移動してからフォローが出来るみたいです！',
			'ロード画面のメッセージの表示が消えるのが速すぎる？ 設定>色々からロード時間を長くするオプションをオンにすると良いかもです',
			'あなたの今日の運勢を占います！占ってってリプライを送ってね',
			'タイマー機能があります！時間をリプライで送ってね',
			'なにか覚えておいてほしい事があれば私が覚えておきます！remind 内容ってリプライを送ってね',
			'絵文字でキメラを作り出します！絵文字ってリプライを送ってね',
			'みんなで数取りゲームをしましょう！数取りってリプライを送ってね',
			'なんとかって呼んでってリプライを送っていただければあなたをその名前で呼ぶようにします！',
			'フォロバしてってリプライを送っていただければあなたをフォローします！リアクションもしますよ〜',
			'チャートってリプライを送っていただいたら、適当なチャートを出力します！投稿やフォロワーもリプライに含めてもらえれば、あなたに関するデータを出力しますよ！',
		],
		want: item => `${item}、欲しいかも...`,
		see: item => `お散歩していたら、道に${item}が落ちているのを見ました！`,
		expire: item => `気づいたら、${item}の賞味期限が切れてました…`,
	},
};

export function getSerif(variant: string | string[]): string {
	if (Array.isArray(variant)) {
		return variant[Math.floor(Math.random() * variant.length)];
	} else {
		return variant;
	}
}

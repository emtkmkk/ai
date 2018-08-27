export default {
	core: {
		setNameOk: 'わかりました。これからは{name}とお呼びしますね！',
		san: 'さん付けした方がいいですか？',
		yesOrNo: '「はい」か「いいえ」しかわからないんです...',
		goodMorning: 'おはようございます！',
		goodMorningWithName: 'おはようございます、{name}！',
		goodNight: 'おやすみなさい！',
		goodNightWithName: 'おやすみなさい、{name}！',
		tooLong: '長すぎる気がします...',
		requireMoreLove: 'もっと仲良くなったら考えてあげてもいいですよ？',
		happyBirthday: 'お誕生日おめでとうございます🎉',
		happyBirthdayWithName: 'お誕生日おめでとうございます、{name}🎉'
	},

	keyword: {
		learned: '({word}..... {reading}..... 覚えました)',
		remembered: '{reading}！'
	},

	/**
	 * リバーシへの誘いを承諾するとき
	 */
	REVERSI_OK: '良いですよ～',

	/**
	 * リバーシへの誘いを断るとき
	 */
	REVERSI_DECLINE: 'ごめんなさい、今リバーシはするなと言われてます...',

	/**
	 * (メモリが足りないので)再起動がスケジュールされたとき
	 */
	REBOOT_SCHEDULED_MEM: 'サーバーの空きメモリが少なくなってきたので、1分後にサーバー再起動しますね！',

	/**
	 * (CPU使用率が高いので)再起動がスケジュールされたとき
	 */
	REBOOT_SCHEDULED_CPU: 'サーバーの負荷が高いので、1分後にサーバー再起動しますね！',

	/**
	 * まもなく再起動されるとき
	 */
	REBOOT: 'では、まもなくサーバーを再起動します！',
	REBOOT_DETAIL: '(私も再起動に巻き込まれちゃうので、サーバーの再起動が完了したことのお知らせはできません...)',

	REBOOT_CANCEL_REQUESTED_ACCEPT: 'わかりました。再起動の予定を取り消しました！',
	REBOOT_CANCEL_REQUESTED_REJECT: 'ごめんなさい、再起動の取り消しは管理者のみが行えます...',

	REBOOT_CANCELED: '再起動が取り消されました。お騒がせしました',

	/**
	 * 絵文字生成
	 */
	EMOJI_SUGGEST: 'こんなのはどうですか？→$',

	FORTUNE_CW: '私が今日のあなたの運勢を占いました...',

	/**
	 * 数当てゲームをやろうと言われたけど既にやっているとき
	 */
	GUESSINGGAME_ARLEADY_STARTED: 'え、ゲームは既に始まってますよ！',

	/**
	 * タイムライン上で数当てゲームに誘われたとき
	 */
	GUESSINGGAME_PLZ_DM: 'メッセージでやりましょう！',

	/**
	 * 数当てゲーム開始
	 */
	GUESSINGGAME_STARTED: '0~100の秘密の数を当ててみてください♪',

	/**
	 * 数当てゲームで数字じゃない返信があったとき
	 */
	GUESSINGGAME_NAN: '数字でお願いします！「やめる」と言ってゲームをやめることもできますよ！',

	/**
	 * 数当てゲーム中止を要求されたとき
	 */
	GUESSINGGAME_CANCEL: 'わかりました～。ありがとうございました♪',

	/**
	 * 数当てゲームで小さい数を言われたとき
	 */
	GUESSINGGAME_GRATER: '$より大きいですね',

	/**
	 * 数当てゲームで小さい数を言われたとき(2度目)
	 */
	GUESSINGGAME_GRATER_AGAIN: 'もう一度言いますが$より大きいですよ！',

	/**
	 * 数当てゲームで大きい数を言われたとき
	 */
	GUESSINGGAME_LESS: '$より小さいですね',

	/**
	 * 数当てゲームで大きい数を言われたとき(2度目)
	 */
	GUESSINGGAME_LESS_AGAIN: 'もう一度言いますが$より小さいですよ！',

	/**
	 * 数当てゲームで正解したとき
	 */
	GUESSINGGAME_CONGRATS: '正解です🎉 ({tries}回目で当てました)',

	timer: {
		set: 'わかりました！',
		invalid: 'うーん...？',
		notify: '{time}経ちましたよ！',
		notifyWithName: '{name}、{time}経ちましたよ！'
	}
};

/**
 * @packageDocumentation
 *
 * AiOS ブートストラッパー（エントリーポイント）。
 *
 * @remarks
 * 藍の起動処理を行う。Misskey アカウントをフェッチし、
 * 全モジュールをインスタンス化して {@link ./ai | 藍} のコアクラスに渡す。
 *
 * モジュールの登録順序は優先度を表す（先頭ほど高優先度）。
 * メンションを受信した際、先頭のモジュールのフックから順に評価される。
 *
 * @internal
 */

import 'module-alias/register';

import * as chalk from 'chalk';
import * as request from 'request-promise-native';
const promiseRetry = require('promise-retry');

import 藍 from './ai';
import config from './config';
import _log from './utils/log';
const pkg = require('../package.json');

import CoreModule from './modules/core';
import TalkModule from './modules/talk';
import BirthdayModule from './modules/birthday';
import ReversiModule from './modules/reversi';
import PingModule from './modules/ping';
import EmojiModule from './modules/emoji';
import EmojiReactModule from './modules/emoji-react';
import FortuneModule from './modules/fortune';
import GuessingGameModule from './modules/guessing-game';
import KazutoriModule from './modules/kazutori';
import KeywordModule from './modules/keyword';
import WelcomeModule from './modules/welcome';
import TimerModule from './modules/timer';
import DiceModule from './modules/dice';
import ServerModule from './modules/server';
import FollowModule from './modules/follow';
import TodayModule from './modules/today';
import MazeModule from './modules/maze';
import ChartModule from './modules/chart';
import SleepReportModule from './modules/sleep-report';
import NotingModule from './modules/noting';
import PollModule from './modules/poll';
import ReminderModule from './modules/reminder';
import YoruhoModule from './modules/yoruho';
import RpgModule from './modules/rpg';

console.log('   __    ____  _____  ___ ');
console.log('  /__\\  (_  _)(  _  )/ __)');
console.log(' /(__)\\  _)(_  )(_)( \\__ \\');
console.log('(__)(__)(____)(_____)(___/\n');

/**
 * 起動時のログを出力する（`[Boot]` プレフィックス付き）
 *
 * @param msg - ログメッセージ
 * @returns なし
 * @internal
 */
function log(msg: string): void {
	_log(`[Boot]: ${msg}`);
}

log(chalk.bold(`Ai v${pkg._v}`));

promiseRetry(retry => {
	log(`Account fetching... ${chalk.gray(config.host)}`);

	// アカウントをフェッチ
	return request.post(`${config.apiUrl}/i`, {
		json: {
			i: config.i
		}
	}).catch(retry);
}, {
	retries: 3
}).then(account => {
	const acct = `@${account.username}`;
	log(chalk.green(`Account fetched successfully: ${chalk.underline(acct)}`));

	log('Starting AiOS...');

	// 藍起動
	new 藍(account, [
		new CoreModule(),
		new EmojiModule(),
		new EmojiReactModule(),
		new FortuneModule(),
		new GuessingGameModule(),
		new KazutoriModule(),
		new ReversiModule(),
		new TimerModule(),
		new RpgModule(),
		new DiceModule(),
		new TalkModule(),
		new PingModule(),
		new WelcomeModule(),
		new ServerModule(),
		new FollowModule(),
		new BirthdayModule(),
		new TodayModule(),
		new KeywordModule(),
		new MazeModule(),
		new ChartModule(),
		new SleepReportModule(),
		new NotingModule(),
		new PollModule(),
		new ReminderModule(),
		new YoruhoModule(),
	]);
}).catch(e => {
	log(chalk.red('Failed to fetch the account'));
});

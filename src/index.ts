// AiOS bootstrapper

import 'module-alias/register';

import request from 'request-promise-native';
const promiseRetry = require('promise-retry');

import 藍 from './ai';
import config from './config';
import _log from './utils/log';
const pkg = require('../package.json');

import CoreModule from './modules/core';
import TalkModule from './modules/talk';
import BirthdayModule from './modules/birthday';
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
import ValentineModule from './modules/valentine';
import MazeModule from './modules/maze';
import SleepReportModule from './modules/sleep-report';
import NotingModule from './modules/noting';
import PollModule from './modules/poll';
import ReminderModule from './modules/reminder';
import RpgModule from './modules/rpg';
import WikipediaModule from './modules/wikipedia';

console.log('   __    ____  _____  ___ ');
console.log('  /__\\  (_  _)(  _  )/ __)');
console.log(' /(__)\\  _)(_  )(_)( \\__ \\');
console.log('(__)(__)(____)(_____)(___/\n');

function log(msg: string): void {
  _log(`[Boot]: ${msg}`);
}

log(`Ai v${pkg._v}`);

promiseRetry(
  (retry) => {
    log(`Account fetching... ${config.host}`);

    // アカウントをフェッチ
    return request
      .post(`${config.apiUrl}/i`, {
        json: {
          i: config.i,
        },
      })
      .catch(retry);
  },
  {
    retries: 3,
  },
)
  .then((account) => {
    const acct = `@${account.username}`;
    log(`Account fetched successfully: ${acct}`);

    log('Starting AiOS...');

    // 藍起動
    new 藍(account, [
      new CoreModule(),
      new EmojiModule(),
      new EmojiReactModule(),
      new FortuneModule(),
      new GuessingGameModule(),
      new KazutoriModule(),
      new TimerModule(),
      new DiceModule(),
      new TalkModule(),
      new PingModule(),
      new WelcomeModule(),
      new ServerModule(),
      new FollowModule(),
      new BirthdayModule(),
      //new ValentineModule(),
      new KeywordModule(),
      new MazeModule(),
      new SleepReportModule(),
      new NotingModule(),
      new PollModule(),
      new ReminderModule(),
      new RpgModule(),
      new WikipediaModule(),
    ]);
  })
  .catch((e) => {
    log('Failed to fetch the account');
  });

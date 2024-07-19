import autobind from 'autobind-decorator';
import Message from '@/message';
import Module from '@/module';
import serifs from '@/serifs';
import loki from 'lokijs';
import { genItem } from '@/vocabulary';
import config from '@/config';
import { Note } from '@/misskey/note';

export default class extends Module {
  public readonly name = 'poll';

  private pollresult: loki.Collection<{
    key: string;
    keyword: string;
    winCount?: number;
  }>;

  private pollresultlegend: loki.Collection<{
    key: string;
    keyword: string;
    winCount?: number;
  }>;

  @autobind
  public install() {
    this.pollresult = this.ai.getCollection('_poll_pollresult', {
      indices: ['userId'],
    });
    this.pollresultlegend = this.ai.getCollection('_poll_pollresultlegend', {
      indices: ['userId'],
    });
    setInterval(
      () => {
        const hours = new Date().getHours();
        let rnd =
          (hours === 12 || (hours > 17 && hours < 24) ? 0.25 : 0.05) *
          this.ai.activeFactor;
        if ((hours > 0 && hours < 7) || (hours > 13 && hours < 17)) return;
        if (new Date().getMonth() === 11 && new Date().getDate() === 31) {
          if (hours != 20 || new Date().getMinutes() > 30) {
            return;
          } else {
            rnd = 1;
          }
        }
        if (Math.random() < rnd) {
          this.post();
        }
      },
      1000 * 60 * 30,
    );

    return {
      mentionHook: this.mentionHook,
      timeoutCallback: this.timeoutCallback,
    };
  }

  @autobind
  private async post(key?: string) {
    this.ai.decActiveFactor(0.05);

    const nenmatu = new Date().getMonth() === 11 && new Date().getDate() === 31;

    let duration = nenmatu ? 1000 * 60 * 120 : 1000 * 60 * 10;

    // 機嫌が低い場合、受付時間を延長
    if (!nenmatu && this.ai.activeFactor < 0.75) {
      duration =
        Math.floor(
          ((1 /
            (1 -
              Math.min(
                (0.91 - this.ai.activeFactor) * 1 * (0.5 + Math.random() * 0.5),
                0.6,
              ))) *
            duration) /
            120000,
        ) * 120000;
    }

    const polls = [
      // TODO: Extract serif
      ['珍しそうなもの', 'みなの者！どれがいちばん珍しいと思うんじゃ？'],
      ['美味しそうなもの', 'みなの者！どれがいちばん美味しいと思うんじゃ？'],
      ['怪しいもの', 'みなの者！どれがいちばん怪しいと思うんじゃ？'],
      ['欲しいもの', 'みなの者！どれがいちばん欲しいんじゃ？'],
      [
        '海に持っていきたいもの',
        'みなの者！海にひとつ持っていけるとしたらどれがいいんじゃ？',
      ],
      ['家に飾りたいもの', 'みなの者！家に飾るとしたらどれにするんじゃ？'],
      ['売れそうなもの', 'みなの者！どれがいちばん売れそうと思うんじゃ？'],
      [
        '降ってきてほしいもの',
        'みなの者！どれが空から降ってきてほしいんじゃ？',
      ],
      [
        '良い香りがしそうなもの',
        'みなの者！どれがいちばんいい香りがすると思うんじゃ？',
      ],
      ['高価なもの', 'みなの者！どれがいちばん高価だと思うんじゃ？'],
      [
        '皆尽村にありそうなもの',
        'みなの者！どれが皆尽村にありそうだと思うんじゃ？',
      ],
      [
        'ぷれぜんとしたいもの',
        'みなの者！わらわにぷれぜんとしてくれるとしたらどれにするのじゃ？',
      ],
      [
        'ぷれぜんとされたいもの',
        'みなの者！ぷれぜんとでもらうとしたらどれがいいんじゃ？',
      ],
      [
        'わらわが持ってそうなもの',
        'みなの者！わらわが持ってそうなものはどれだと思うんじゃ？',
      ],
      ['流行りそうなもの', 'みなの者！どれが村で流行りそうと思うんじゃ？'],
      ['朝ごはん', 'みなの者！朝ごはんにどれが食べたいんじゃ？'],
      ['お昼ごはん', 'みなの者！お昼ごはんにどれが食べたいんじゃ？'],
      ['お夕飯', 'みなの者！お夕飯にどれが食べたいんじゃ？'],
      ['体に良さそうなもの', 'みなの者！どれが体に良さそうだと思うんじゃ？'],
      ['さめ映画', 'みなの者！どれが一番さめ映画に出てきそうだと思うんじゃ？'],
      [
        '楽器になりそうなもの',
        'みなの者！どれが楽器になりそうだと思うんじゃ？',
      ],
      [
        'お味噌汁の具にしたいもの',
        'みなの者！お味噌汁の具にするとしたらどれがいいのじゃ？',
      ],
      ['ふりかけにしたいもの', 'みなの者！どれをごはんにふりかけたいんじゃ？'],
      ['よく見かけるもの', 'みなの者！どれをよく見かけるんじゃ？'],
      [
        '道端に落ちてそうなもの',
        'みなの者！道端に落ちてそうなものはどれだと思うんじゃ？',
      ],
      [
        '美術館に置いてそうなもの',
        'みなの者！この中で美術館に置いてありそうなものはどれだと思うんじゃ？',
      ],
      [
        '教室にありそうなもの',
        'みなの者！教室にありそうなものってどれだと思うんじゃ？',
      ],
      ['絵文字になってほしいもの', '絵文字になってほしいものはどれじゃ？'],
      [
        '阨ちゃんの部屋にありそうなもの',
        'みなの者！わらわの住みかにありそうなものはどれだと思うんじゃ？',
      ],
      ['燃えるごみ', 'みなの者！どれが燃えるごみだと思うんじゃ？'],
      ['好きなおにぎりの具', 'そなたらが好きなおにぎりの具はなんじゃ？'],
      [
        '嫌なおにぎりの具',
        'そなたらが一番食べたくないおにぎりの具はなんじゃ？',
      ],
      ['最強物決定', 'みなの者！この中でどれが最強だと思うんじゃ？'],
      ['最弱物決定', 'みなの者！この中でどれが最弱だと思うんじゃ？'],
      [
        '強すぎず弱すぎないもの',
        'みなの者！この中で一番強すぎず弱すぎない物はどれだと思うんじゃ？',
      ],
      [
        '音ゲーで使えるもの',
        'みなの者！この中でいちばん音ゲーに使えそうなのはどれだと思うんじゃ？',
      ],
      [
        'でいりーしょっぷで売って欲しいもの',
        'みなの者！、いちばんでいりーしょっぷで売って欲しいものはどれじゃ？',
      ],
      ['破壊力があるもの', 'みなの者！どれが一番破壊力があると感じるのじゃ？'],
      ['人に押し付けたいもの', 'みなの者！どれを一番人に押し付けたいのじゃ？'],
      [
        '欲しい物を選べって言われたら',
        'この中から一つ欲しいものを選べって言われたのじゃ…… みんなならどれにするんじゃ？',
      ],
      [
        'いぎりすに持っていきたいもの',
        'みなの者！いぎりすに持っていくならどれにするんじゃ？',
      ],
      [
        '村長になったら設置したいもの',
        'みなの者！村長になったら村に真っ先に設置したいものはどれじゃ？',
      ],
      ['村の新しいもの', '村に新しく増えるならどれがいいんじゃ？'],
      [
        '栄養ばらんす最強決定',
        'みなの者！どれがいちばん栄養ばらんすがいいんじゃ？',
      ],
      [
        '安値で取引されるもの',
        'みなの者！どれがいちばん安値で取引されると思うんじゃ？',
      ],
      ['いらないもの', 'みなの者！どれがいちばんいらないと思うんじゃ？'],
      [
        'ぷれぜんとされたくないもの',
        'みなの者！どれがいちばんぷれぜんとされたくないと思うんじゃ？',
      ],
      ['流行らないもの', 'みなの者！どれが絶対流行らなさそうだと思うんじゃ？'],
      [
        'ぎりぎり食べてもいいもの',
        'みなの者！どれがいちばん「ぎりぎり食べてもいいかも」と思えるかのう？',
      ],
      ['うつくしいもの', 'みなの者！どれがいちばんうつくしいと思うんじゃ？'],
      [
        '致死性があるもの',
        'みなの者！どれがいちばん致死性があると思うんじゃ？',
      ],
      [
        '口に出したい日本語',
        'みなの者！どれがいちばん口に出したい日本語じゃ？',
      ],
      ['子供に大人気なもの', 'みなの者！どれがいちばん子供に大人気じゃ？'],
      ['渋いもの', 'みなの者！どれがいちばん渋いと思うんじゃ？'],
      ['辛いもの', 'みなの者！どれがいちばん辛いと思うんじゃ？'],
      ['すっぱいもの', 'みなの者！どれがいちばんすっぱいと思うんじゃ？'],
      ['苦いもの', 'みなの者！どれがいちばん苦いと思うんじゃ？'],
      [
        '「自我」',
        'みなの者！この中でいちばん「自我」だと思えるものはどれじゃ？',
      ],
      [
        '観光案内で紹介されそうなもの',
        'みなの者！この中でいちばん村の観光案内に紹介されそうなものはどれだと思うんじゃ？',
      ],
      [
        '阨に使いたいもの',
        'みなの者！この中でいちばんわらわに使ってみたいものはどれじゃ？',
      ],
      [
        '生きているもの',
        'みなの者！この中でいちばん生きていると思えるものはどれじゃ？',
      ],
      [
        '生きてないもの',
        'みなの者！この中でいちばん生きてないと思えるものはどれじゃ？',
      ],
      ['新鮮なもの', 'みなの者！この中でいちばん新鮮なものはどれじゃ？'],
      [
        '叩くと気持ちいいもの',
        'みなの者！この中でいちばん叩くと気持ちいいものはどれじゃ？',
      ],
      [
        '手触りがいいもの',
        'みなの者！この中でいちばん手触りがいいものはどれだと思うんじゃ？',
      ],
      [
        '新しい信仰になりそうなもの',
        'みなの者！この中でいちばん新しく信仰を集めそうなものはどれだと思うんじゃ？',
      ],
      [
        '後世に遺したくないもの',
        'みなの者！どれが一番後世に遺したくないんじゃ？',
      ],
      [
        '資料館に置いてなさそうなもの',
        'みなの者！この中でいちばん資料館に置いてなさそうなものはどれだと思うんじゃ？',
      ],
      [
        '教室になさそうなもの',
        'みなの者！いちばん教室になさそうなものってどれだと思うんじゃ？',
      ],
      ['高級なもの', 'みなの者！どれが一番高級だと思うんじゃ？'],
      [
        '滅茶苦茶なもの',
        'みなの者！この中で一番滅茶苦茶なものってどれだと思うんじゃ？',
      ],
      [
        '面白いもの',
        'みなの者！この中で一番面白いものってどれだと思うんじゃ？',
      ],
      ['供物にしたいもの', 'みなの者は、どれを神様の供物にささげたいんじゃ？'],
      ['よく見かけるもの', 'みなの者は、どれをよく見かけるんじゃ？'],
      [
        'Z級映画',
        'みなの者は、Z級映画に出てきそうなものはどれだと思うんじゃ？',
      ],
      ['闖ｴ霈費ｽらｹｧ荳環ｰ郢ｧ蟲ｨ竊醍ｸｺ', '闖ｴ霈費ｽらｹｧ荳環ｰ郢ｧ蟲ｨ竊醍ｸｺ？'],
      [
        '資料館に置いてそうなもの',
        'みなの者は、この中で資料館に置いてありそうなものはどれだと思うんじゃ？',
      ],
      [
        '学校にありそうなもの',
        'みなの者は、学校にありそうなものってどれだと思うんじゃ？',
      ],
      ['絵文字になってほしいもの', '絵文字になってほしいものはどれじゃ？'],
      [
        '村役場にありそうなもの',
        'みなの者は、村役場にありそうなものはどれじゃ？',
      ],
      ['燃えるごみ', 'みなの者は、どれが燃えるごみだと思うんじゃ？'],
      ['やらしいもの', 'みなの者は、どれがいちばんやらしいと思うんじゃ？'],
      ['胡乱なもの', 'みなの者は、どれがいちばん胡乱だと思うんじゃ？'],
      [
        '村にありそうなもの',
        'みなの者は、どれがいちばん村にありそうだと思うんじゃ？',
      ],
      ['好きな絵文字', 'みなの者！この中でどの絵文字が一番好きじゃ？'],
      [
        '面白いばななす',
        'みなの者！この中でどのばななすが一番面白いと思うんじゃ？',
      ],
    ];

    const selectedPolls = key ? polls.filter((x) => x[0].includes(key)) : [];

    const poll = nenmatu
      ? [
          `${new Date().getFullYear()}年っぽい響きのもの`,
          `みなの者、${new Date().getFullYear()}年ももうすぐ終わりじゃのう～ みなの者はこの中でいちばん${new Date().getFullYear()}年っぽい響きのものはどれだと思うんじゃ？`,
        ]
      : selectedPolls.length
        ? selectedPolls[Math.floor(Math.random() * selectedPolls.length)]
        : polls[Math.floor(Math.random() * polls.length)];

    const exist = this.pollresult.findOne({
      key: poll[0],
    });

    let choices = nenmatu
      ? [
          genItem(),
          genItem(),
          genItem(),
          genItem(),
          genItem(),
          genItem(),
          genItem(),
          genItem(),
          genItem(),
          genItem(),
        ]
      : [genItem(), genItem(), genItem(), genItem()];

    if (!nenmatu) {
      if (Math.random() < 0.28) choices.push(genItem());
      if (Math.random() < 0.28) choices.push(genItem());
      if (Math.random() < 0.28) choices.push(genItem());
      if (Math.random() < 0.28) choices.push(genItem());
      if (Math.random() < 0.28) choices.push(genItem());
      if (poll[0] === '好きな絵文字') {
        const data = (await this.ai.api('emojis', {})).emojis
          ?.filter((x) => !x.category?.includes('!'))
          .sort(() => Math.random() - 0.5);
        choices = data.slice(0, choices.length).map((x) => `:${x.name}:`);
      }
      if (poll[0] === '面白いばななす') {
        const count = choices.length;
        choices = [];
        for (let i = 0; i < count; i++) {
          choices.push(this.ai.makeBananasu(''));
        }
      }
      if (exist?.keyword) {
        const randomIndex = Math.floor(Math.random() * (choices.length + 1));
        choices.splice(randomIndex, 0, exist.keyword);
      }
    }

    const note = await this.ai.post({
      text: poll[1],
      poll: {
        choices,
        expiredAfter: duration,
        multiple: false,
      },
    });

    // タイマーセット
    this.setTimeoutWithPersistence(duration + 3000, {
      title: poll[0],
      noteId: note.id,
      duration: duration,
    });
  }

  @autobind
  private async mentionHook(msg: Message) {
    if (
      msg.includes(['覚えた', 'おぼえた']) &&
      msg.includes(['答', 'こたえ'])
    ) {
      const convertpoll = [
        ['欲しい物を選べ', '欲しい物を選べと言われたら'],
        ['食べたくないもの', 'ぎりぎり食べてもいいもの'],
        ['道に落ちてそうなもの', '道端に落ちてそうなもの'],
      ];
      convertpoll.forEach((x) => {
        const exist = this.pollresult.findOne({
          key: x[0],
        });
        const exist2 = this.pollresult.findOne({
          key: x[1],
        });
        if (exist && !exist2) {
          this.pollresult.insertOne({
            key: x[1],
            keyword: exist.keyword,
            winCount: exist.winCount ?? 1,
          });
          this.pollresult.remove(exist);
        } else if (exist && exist2) {
          this.pollresult.remove(exist);
        }
      });
      const pollresult = this.pollresult.find().sort((a, b) => {
        //連勝数が多い順、同じなら文字列コード順
        if ((a.winCount ?? 1) === (b.winCount ?? 1)) {
          const isYearA = /^\d{4}/.test(a.key);
          const isYearB = /^\d{4}/.test(b.key);
          if (isYearA && !isYearB) {
            return 1;
          }
          if (isYearB && !isYearA) {
            return -1;
          }
          if (a.key < b.key) {
            return -1;
          }
          if (b.key > a.key) {
            return 1;
          }
          return 0;
        } else {
          return (b.winCount ?? 1) - (a.winCount ?? 1);
        }
      });
      const pollresultstr = pollresult
        .map(
          (x) =>
            x.key +
            '\n' +
            x.keyword +
            (x.winCount && x.winCount > 1 ? '(' + x.winCount + '連勝)' : ''),
        )
        .join('\n\n');
      msg.reply('わらわが覚えた答えじゃ！\n```\n' + pollresultstr + '\n```');
      return { reaction: ':neofox_heart:' };
    } else {
      if (!msg.includes(['/poll']) || msg.user.username !== config.master) {
        return false;
      } else {
      }
      const key = /\/poll\s(\S+)$/.exec(msg.text)?.[1];
      this.log('Manualy poll requested key: ' + (key ?? 'null'));
      this.post(key);

      return { reaction: ':neofox_heart:' };
    }
  }

  @autobind
  private async timeoutCallback({ title, noteId, duration }) {
    const note: Note = await this.ai.api('notes/show', { noteId });

    const choices = note.poll!.choices;

    let mostVotedChoice;
    let totalVoted = 0;

    for (const choice of choices) {
      totalVoted += choice.votes;

      if (mostVotedChoice == null) {
        mostVotedChoice = choice;
        continue;
      }

      if (choice.votes > mostVotedChoice.votes) {
        mostVotedChoice = choice;
      }
    }

    const mostVotedChoices = choices.filter(
      (choice) => choice.votes === mostVotedChoice.votes,
    );
    const nenmatu = new Date().getMonth() === 11 && new Date().getDate() === 31;

    if (mostVotedChoice.votes === 0) {
      //this.ai.post({ // TODO: Extract serif
      //	text: '投票はなかったのじゃ',
      //	renoteId: noteId,
      //});
      this.ai.decActiveFactor((0.01 * (duration ?? 600000)) / 60000);
    } else if (mostVotedChoices.length === 1) {
      let isStreak = false;
      if (mostVotedChoice.votes >= 3 || totalVoted > choices.length) {
        const exist = this.pollresult.findOne({
          key: title,
        });
        if (exist) {
          isStreak = exist.keyword === mostVotedChoice.text;
          exist.winCount = isStreak ? (exist.winCount ?? 1) + 1 : 1;
          exist.keyword = mostVotedChoice.text;
          this.pollresult.update(exist);
          const legend = this.pollresultlegend.findOne({
            key: title,
          });
          if (!legend) {
            this.pollresultlegend.insertOne({
              key: exist.key,
              keyword: exist.keyword,
              winCount: exist.winCount,
            });
          } else if (exist.winCount > (legend.winCount ?? 1)) {
            legend.winCount = exist.winCount;
            legend.keyword = exist.keyword;
            this.pollresultlegend.update(legend);
          }
        } else {
          this.pollresult.insertOne({
            key: title,
            keyword: mostVotedChoice.text,
            winCount: 1,
          });
          this.pollresultlegend.insertOne({
            key: title,
            keyword: mostVotedChoice.text,
            winCount: 1,
          });
        }
      }
      this.ai.post({
        // TODO: Extract serif
        cw: `${title}アンケートの結果発表じゃ！`,
        text: `結果は${mostVotedChoice.votes}票の「${
          mostVotedChoice.text
        }」だったのじゃ！${
          isStreak
            ? ''
            : mostVotedChoice.votes >= 3 || totalVoted > choices.length
              ? '覚えておくのじゃ！'
              : ''
        }${nenmatu ? '来年もいい年になるといいのう！' : ''}`,
        renoteId: noteId,
      });
    } else {
      const choices = mostVotedChoices
        .map((choice) => `「${choice.text}」`)
        .join('と');
      if (mostVotedChoice.votes >= 3 || totalVoted > choices.length) {
        const exist = this.pollresult.findOne({
          key: title,
        });
        if (exist) {
          const newKeywords = mostVotedChoices.filter(
            (x) => exist.keyword !== x.text,
          );
          const learnKeyword =
            newKeywords[Math.floor(Math.random() * newKeywords.length)];
          exist.keyword = learnKeyword.text;
          exist.winCount = 1;
          this.pollresult.update(exist);
          const legend = this.pollresultlegend.findOne({
            key: title,
          });
          if (!legend) {
            this.pollresultlegend.insertOne({
              key: exist.key,
              keyword: exist.keyword,
              winCount: exist.winCount,
            });
          } else if (exist.winCount > (legend.winCount ?? 1)) {
            legend.winCount = exist.winCount;
            legend.keyword = exist.keyword;
            this.pollresultlegend.update(legend);
          }
        } else {
          const learnKeyword =
            mostVotedChoices[
              Math.floor(Math.random() * mostVotedChoices.length)
            ];
          this.pollresult.insertOne({
            key: title,
            keyword: learnKeyword.text,
            winCount: 1,
          });
          this.pollresultlegend.insertOne({
            key: title,
            keyword: learnKeyword.text,
            winCount: 1,
          });
        }
      }
      this.ai.post({
        // TODO: Extract serif
        cw: `${title}アンケートの結果発表じゃ！`,
        text: `結果は${mostVotedChoice.votes}票の${choices}だったのじゃ！${
          mostVotedChoice.votes >= 3 || totalVoted > choices.length
            ? '覚えておくのじゃ！'
            : ''
        }${nenmatu ? '来年もいい年になるとよいのう' : ''}`,
        renoteId: noteId,
      });
    }
  }
}

import autobind from 'autobind-decorator';
import Module from '@/module';
import { checkNgWord, ngword } from '@/utils/check-ng-word';
import Message from '@/message';

interface Article {
  title: string;
  url: string;
}

export default class extends Module {
  public readonly name = 'wikipediaRandom';

  @autobind
  public install() {
    this.post();
    setInterval(this.post, 1000 * 60 * 3);

    return {
      mentionHook: this.mentionHook,
    };
  }

  @autobind
  private async mentionHook(msg: Message) {
    if (msg.text) {
      const keywords = ['wiki', 'ウィキ', 'うぃき'];
      const manyKeywords = ['いっぱい', '沢山', 'たくさん'];

      const lowerCaseText = msg.text.toLowerCase();

      const containsKeyword = keywords.some((keyword) =>
        lowerCaseText.includes(keyword),
      );
      const containsManyKeyword = manyKeywords.some((keyword) =>
        msg.text.includes(keyword),
      );

      if (containsKeyword) {
        const articleCount = containsManyKeyword ? 3 : 1;
        const articles = await this.fetchFilteredArticles(articleCount);

        if (articles && articles.length > 0) {
          const replyText = articles
            .map(
              (article) =>
                `「${article.title}」の記事を読むのはどうじゃ？\n${article.url}`,
            )
            .join('\n\n');
          msg.reply(replyText, {
            immediate: true,
          });
        } else {
          msg.reply(
            '何だかうぃきぺでぃあとやらの調子が悪くてなにも見つからなかったのじゃ！わらわのせいじゃないのじゃ～！',
            {
              immediate: true,
            },
          );
        }
        return true;
      }
    }
    return false;
  }

  @autobind
  private async post() {
    const now = new Date();
    if (now.getHours() !== 8) return;
    const date = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const data = this.getData();
    if (data.lastPosted == date) return;
    data.lastPosted = date;
    this.setData(data);

    const articles = await this.fetchFilteredArticles(1);
    if (articles && articles.length > 0) {
      const article = articles[0];
      this.log('Posting random Wikipedia article...');

      this.log('Posting...');
      this.ai.post({
        text: `今日は「${article.title}」の記事を読むのはどうじゃ？\n${article.url}`,
      });
    }
  }
  private async fetchFilteredArticles(
    count: number,
  ): Promise<Article[] | null> {
    const URL = 'https://ja.wikipedia.org/w/api.php';
    const RANDOM_PARAMS = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'random',
      rnlimit: count.toString(),
      rnnamespace: '0',
    });

    try {
      const articles: Article[] = [];

      while (articles.length < count) {
        const randomResponse = await fetch(
          `${URL}?${RANDOM_PARAMS.toString()}`,
        );
        const randomData = await randomResponse.json();

        for (const articleData of randomData.query.random) {
          const title = articleData.title;

          // タイトルにNGワードが含まれているか確認
          const isSafeTitle = checkNgWord(title);
          if (isSafeTitle) {
            articles.push({
              title,
              url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            });

            // 取得した記事が目標の数に達したらループを抜ける
            if (articles.length >= count) break;
          }
        }
      }

      return articles.length > 0 ? articles : null;
    } catch (error) {
      console.error('記事の取得中にエラーが発生しました:', error);
      return null;
    }
  }
}

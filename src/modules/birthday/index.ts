import autobind from "autobind-decorator";
import Module from "@/module";
import Friend from "@/friend";
import serifs from "@/serifs";
import { acct } from "@/utils/acct";
import getDate from "@/utils/get-date";

function zeroPadding(num: number, length: number): string {
  return ("0000000000" + num).slice(-length);
}

export default class extends Module {
  public readonly name = "birthday";

  @autobind
  public install() {
    this.crawleBirthday();
    setInterval(this.crawleBirthday, 1000 * 60 * 3);

    return {};
  }

  /**
   * 誕生日のユーザーがいないかチェック(いたら祝う)
   */
  @autobind
  private crawleBirthday() {
    const now = new Date();
    const m = now.getMonth();
    const d = now.getDate();
    //8時より前に通知を飛ばさない
    if (now.getHours() < 8) return;
    // Misskeyの誕生日は 2018-06-16 のような形式
    const today = `${zeroPadding(m + 1, 2)}-${zeroPadding(d, 2)}`;
    const todaydate = getDate();

    const birthFriends = this.ai.friends.find({
      "user.birthday": { $regex: new RegExp("-" + today + "$") },
    } as any);

    birthFriends.forEach((f) => {
      const friend = new Friend(this.ai, { doc: f });

      // 親愛度が1以上必要
      if (friend.love < 1) return;

      // 好感度★6以下で最後の好感度増加から31日以上経過している場合は対象外
      if (
        friend.love < 100 &&
        friend.doc?.lastLoveIncrementedAt &&
        Date.now() >
          new Date(friend.doc.lastLoveIncrementedAt)?.valueOf() +
            1000 * 60 * 60 * 24 * 31
      )
        return;
      // 好感度★7以上で最後の好感度増加から364日以上経過している場合は対象外
      if (
        friend.love >= 100 &&
        friend.doc?.lastLoveIncrementedAt &&
        Date.now() >
          new Date(friend.doc.lastLoveIncrementedAt)?.valueOf() +
            1000 * 60 * 60 * 24 * 364
      )
        return;

      const data = friend.getPerModulesData(this);

      if (data.lastBirthdayChecked == todaydate) return;
      // 前回のお祝いから364日以上経過していない場合は対象外
      if (
        Date.now() <
        new Date(data.lastBirthdayChecked)?.valueOf() +
          1000 * 60 * 60 * 24 * 364
      )
        return;

      data.lastBirthdayChecked = todaydate;
      friend.setPerModulesData(this, data);

      const text = serifs.birthday.happyBirthday(friend.name);

      // ローカルユーザで、親愛度が20以上（☆5）の場合、公開で祝う
      if (!friend.doc?.user?.host && friend.love >= 20) {
        this.ai.post({
          text: serifs.birthday.happyBirthdayLocal(
            friend.name,
            acct(friend.doc.user)
          ),
          localOnly: true,
        });
      } else {
        this.ai.sendMessage(friend.userId, {
          text: acct(friend.doc.user) + " " + text,
        });
      }
    });
  }
}

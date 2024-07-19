import autobind from "autobind-decorator";
import Module from "@/module";
import Message from "@/message";
import serifs from "@/serifs";
import seedrandom from "seedrandom";
import { genItem } from "@/vocabulary";

export const blessing = [
  "阨吉",
  "不吉",
  "吉凶相央",
  "吉凶相半",
  "吉凶未分末大吉",
  "吉凶不分末吉",
  "吉凶相交未吉",
  "小凶後吉",
  "凶後大吉",
  "凶後吉",
  "始凶末吉",
  "後吉",
  "天地渾沌兆",
  "平",
  "吉凶末分",
  "向大吉",
  "向吉",
  "福福福",
  "幸",
  "卯吉",
  "申吉",
  "大大吉",
  "大大中",
  "大吉",
  "中吉",
  "中中吉",
  "吉",
  "吉吉吉",
  "半吉",
  "小吉",
  "小小吉",
  "末吉",
  "末末吉",
  "末末末",
  "末小吉",
  "凶",
  "小凶",
  "半凶",
  "末凶",
  "大凶",
  "大大凶",
];

export default class extends Module {
  public readonly name = "fortune";

  @autobind
  public install() {
    return {
      mentionHook: this.mentionHook,
    };
  }

  @autobind
  private async mentionHook(msg: Message) {
    if (msg.includes(["占", "うらな", "運勢", "おみくじ"])) {
      const date = new Date();
      const seed = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}@${
        msg.userId
      }`;
      const rng = seedrandom(seed);
      const omikuji = blessing[Math.floor(rng() * blessing.length)];
      const item = genItem(rng);
      msg.reply(`**${omikuji}🎉**\nラッキーアイテム: ${item}`, {
        cw: serifs.fortune.cw(msg.friend.name),
      });
      return true;
    } else {
      return false;
    }
  }
}

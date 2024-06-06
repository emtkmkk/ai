import autobind from "autobind-decorator";
import Module from "@/module";
import Message from "@/message";
import serifs from "@/serifs";

export default class extends Module {
  public readonly name = "follow";

  @autobind
  public install() {
    return {
      mentionHook: this.mentionHook,
    };
  }

  @autobind
  private async mentionHook(msg: Message) {
    if (msg.text && msg.includes(["フォロー", "フォロバ", "follow me"])) {
      if (msg.user.isRenoteMuted)
        return {
          reaction: msg.friend.love >= 0 ? ":neofox_hug:" : null,
        };
      if (!msg.user.isFollowing) {
        this.ai.api("following/create", {
          userId: msg.userId,
        });
        msg.reply(serifs.core.followBack(msg.friend.name));
        return {
          reaction: msg.friend.love >= 0 ? ":neofox_blep:" : null,
        };
      } else {
        msg.reply(serifs.core.alreadyFollowBack(msg.friend.name));
        return {
          reaction: msg.friend.love >= 0 ? ":neofox_thinking:" : null,
        };
      }
    } else {
      return false;
    }
  }
}

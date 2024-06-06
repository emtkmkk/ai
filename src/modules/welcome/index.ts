import autobind from "autobind-decorator";
import Module from "@/module";
import Friend, { FriendDoc } from "@/friend";
import { acct } from "@/utils/acct";
import serifs from "@/serifs";

export default class extends Module {
  public readonly name = "welcome";

  @autobind
  public install() {
    const tl = this.ai.connection.useSharedConnection("localTimeline");

    tl.on("note", this.onLocalNote);

    return {};
  }

  @autobind
  private onLocalNote(note: any) {
    if (!note.user?.isBot && !note.user.host) {
      const friend = new Friend(this.ai, { user: note.user });
      const data = friend.getPerModulesData(this);
      if (!data.nextNotificationNotesCount) {
        data.nextNotificationNotesCount = this.getNextNotification(
          note.user.notesCount + 1
        );
        friend.setPerModulesData(this, data);
      }
      // ノート数キリ番
      else if (
        (friend.love || 0) >= 20 &&
        ["public", "home"].includes(note.visibility) &&
        !note.cw &&
        note.user.notesCount >= data.nextNotificationNotesCount - 1
      ) {
        const nc = data.nextNotificationNotesCount;
        data.nextNotificationNotesCount = this.getNextNotification(
          note.user.notesCount + 1
        );
        friend.setPerModulesData(this, data);
        setTimeout(() => {
          this.ai.api("notes/create", {
            text: serifs.welcome.kiriban(nc, acct(note.user)),
            replyId: note.id,
            visibility: "specified",
            visibleUserIds: [note.user.id],
          });
        }, 3000);
      }
      // 最初の投稿
      if (
        !friend?.doc?.isWelcomeMessageSent &&
        (note.isFirstNote ||
          (note.user.notesCount && note.user.notesCount <= 50))
      ) {
        friend.doc.isWelcomeMessageSent = true;
        friend.save();
        if (note.isFirstNote) {
          setTimeout(() => {
            this.ai.api("notes/create", {
              renoteId: note.id,
              localOnly: true,
            });
          }, 3000);

          setTimeout(() => {
            this.ai.api("notes/reactions/create", {
              noteId: note.id,
              reaction: ":neofox_heart:",
            });
          }, 4500);

          setTimeout(() => {
            this.ai.api("notes/reactions/create", {
              noteId: note.id,
              reaction: ":youkoso_kangei_minazuki:",
            });
          }, 5500);

          setTimeout(() => {
            this.ai.api("notes/reactions/create", {
              noteId: note.id,
              reaction: ":agoogletada:",
            });
          }, 6500);
        }

        setTimeout(() => {
          this.ai.api("notes/create", {
            text: serifs.welcome.welcome(acct(note.user)),
            replyId: note.id,
            visibility: "specified",
            visibleUserIds: [note.user.id],
          });
        }, 8000);
      }
    }
  }

  @autobind
  private getNextNotification(notesCount: number) {
    const target = [50, 100, 500, 1000, 5000];
    const clearTarget = target.filter((x) => x <= notesCount);
    if (target.length === clearTarget.length) {
      return (Math.floor(notesCount / 5000) + 1) * 5000;
    } else {
      return target[clearTarget.length];
    }
  }
}

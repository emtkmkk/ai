import autobind from "autobind-decorator";
import loki from "lokijs";
import Module from "@/module";
import Message from "@/message";
import serifs, { getSerif } from "@/serifs";
import { acct } from "@/utils/acct";
import config from "@/config";

const NOTIFY_INTERVAL = 1000 * 60 * 60 * 12;

export default class extends Module {
	public readonly name = "reminder";

	private reminds: loki.Collection<{
		userId: string;
		id: string;
		thing: string | null;
		quoteId: string | null;
		times: number; // 催促した回数(使うのか？)
		createdAt: number;
	}>;

	@autobind
	public install() {
		this.reminds = this.ai.getCollection("reminds", {
			indices: ["userId", "id"],
		});

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		let text = msg.extractedText.toLowerCase();
		if (
			!text.startsWith("remind") &&
			!text.startsWith("リマインド") &&
			!text.startsWith("todo")
		)
			return false;

		if (
			text.startsWith("reminds") ||
			text.startsWith("todos") ||
			text.startsWith("リマインド一覧")
		) {
			const reminds = this.reminds.find({
				userId: msg.userId,
			});

			const getQuoteLink = (id) => `[${id}](${config.host}/notes/${id})`;

			msg.reply(
				serifs.reminder.reminds +
					"\n" +
					reminds
						.map(
							(remind) =>
								`・${
									remind.thing ? remind.thing : getQuoteLink(remind.quoteId)
								}`
						)
						.join("\n")
			);
			return true;
		}

		if (text.match(/^(.+?)\s(.+)/)) {
			text = text.replace(/^(.+?)\s/, "");
		} else {
			text = "";
		}

		const separatorIndex =
			text.indexOf(" ") > -1 ? text.indexOf(" ") : text.indexOf("\n");
		const thing = text.substr(separatorIndex + 1).trim();

		if (
			(thing === "" && msg.quoteId == null) ||
			msg.visibility === "followers"
		) {
			msg.reply(serifs.reminder.invalid);
			return {
				reaction: ":neofox_think_googly:",
				immediate: true,
			};
		}

		const remind = this.reminds.insertOne({
			id: msg.id,
			userId: msg.userId,
			thing: thing === "" ? null : thing,
			quoteId: msg.quoteId,
			times: 0,
			createdAt: Date.now(),
		});

		// メンションをsubscribe
		this.subscribeReply(remind!.id, msg.id, {
			id: remind!.id,
		});

		if (msg.quoteId) {
			// 引用元をsubscribe
			this.subscribeReply(remind!.id, msg.quoteId, {
				id: remind!.id,
			});
		}

		// タイマーセット
		this.setTimeoutWithPersistence(NOTIFY_INTERVAL, {
			id: remind!.id,
		});

		return {
			reaction: ":neofox_thumbsup:",
			immediate: true,
		};
	}

	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (msg.text == null) return;

		const remind = this.reminds.findOne({
			id: data.id,
		});

		if (remind == null) {
			this.unsubscribeReply(key);
			return;
		}

		const done = msg.includes([
			"done",
			"やった",
			"やりました",
			"はい",
			"おわった",
			"終わった",
		]);
		const cancel = msg.includes(["やめる", "やめた", "キャンセル"]);
		const isOneself = msg.userId === remind.userId;

		if ((done || cancel) && isOneself) {
			this.unsubscribeReply(key);
			this.reminds.remove(remind);
			msg.reply(
				done
					? getSerif(serifs.reminder.done(msg.friend.name))
					: serifs.reminder.cancel
			);
			return {
				reaction: ":neofox_heart:",
			};
		} else if (isOneself === false) {
			msg.reply(serifs.reminder.doneFromInvalidUser);
			return {
				reaction: ":neofox_confused:",
			};
		} else {
			return false;
		}
	}

	@autobind
	private async timeoutCallback(data) {
		const remind = this.reminds.findOne({
			id: data.id,
		});
		if (remind == null) return;

		if (new Date().getHours() < 8) {
			// タイマーセット
			this.setTimeoutWithPersistence(1000 * 60 * 60 * 8, {
				id: remind.id,
			});
			return;
		}

		remind.times++;
		this.reminds.update(remind);

		const friend = this.ai.lookupFriend(remind.userId);
		if (friend == null) return; // 処理の流れ上、実際にnullになることは無さそうだけど一応

		let reply;
		try {
			reply = await this.ai.post({
				replyId:
					remind.thing == null && remind.quoteId ? remind.quoteId : remind.id,
				renoteId:
					remind.thing == null && remind.quoteId ? remind.quoteId : remind.id,
				text: acct(friend.doc.user) + " " + serifs.reminder.notify(friend.name),
				visibility: "home",
			});
		} catch (err) {
			// renote対象が消されていたらリマインダー解除
			if (err.statusCode === 400) {
				this.unsubscribeReply(
					remind.thing == null && remind.quoteId ? remind.quoteId : remind.id
				);
				this.reminds.remove(remind);
				return;
			}
			return;
		}

		if (!reply?.id) return;

		this.subscribeReply(remind.id, reply.id, {
			id: remind.id,
		});

		// タイマーセット
		this.setTimeoutWithPersistence(
			Math.round(NOTIFY_INTERVAL * (Math.random() + 0.5)),
			{
				id: remind.id,
			}
		);
	}
}

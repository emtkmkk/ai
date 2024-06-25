import autobind from "autobind-decorator";
import Module from "@/module";
import Message from "@/message";
import serifs from "@/serifs";

export default class extends Module {
	public readonly name = "dice";

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook,
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;

		if (
			msg.text.endsWith("ですか？") ||
			msg.text.endsWith("ますか？") ||
			msg.text.endsWith("ですよね？")
		) {
			if (Math.random() < 0.5) {
				if (Math.random() < 0.25) {
					msg.reply("多分そうじゃ、部分的にそうじゃ", { visibility: "public" });
				} else {
					msg.reply("そうじゃ", { visibility: "public" });
				}
			} else {
				if (Math.random() < 0.25) {
					msg.reply("多分ちがうのじゃ、部分的にちがうのじゃ", {
						visibility: "public",
					});
				} else {
					msg.reply("ちがうのじゃ", { visibility: "public" });
				}
			}
			return {
				reaction: ":neofox_heart:",
			};
		}

		const query = msg.text.match(/([0-9]+)[dD]([0-9]+)/);

		if (query == null) return false;

		const times = parseInt(query[1], 10);
		const dice = parseInt(query[2], 10);

		if (times < 1) return false;
		if (dice < 2 || dice > Number.MAX_SAFE_INTEGER) return false;

		if ((dice.toString().length + 1) * times > 7000) return false;

		const results: number[] = [];

		for (let i = 0; i < times; i++) {
			results.push(Math.floor(Math.random() * dice) + 1);
		}

		msg.reply(
			serifs.dice.done(
				results.join(" "),
				results.length > 1
					? results.reduce((a, c) => a + c).toLocaleString()
					: null
			),
			{ visibility: "public" }
		);

		return {
			reaction: ":neofox_heart:",
		};
	}
}

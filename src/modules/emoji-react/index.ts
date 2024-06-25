import log from "@/utils/log";
import autobind from "autobind-decorator";
import { parse } from "twemoji-parser";
const delay = require("timeout-as-promise");
import { Note } from "@/misskey/note";
import Module from "@/module";
import Stream from "@/stream";
import includes from "@/utils/includes";

export default class extends Module {
	public readonly name = "emoji-react";

	private htl: ReturnType<Stream["useSharedConnection"]>;

	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection("homeTimeline");
		this.htl.on("note", this.onNote);
		return {};
	}

	@autobind
	private async onNote(note: any) {
		log("onNote function called : " + note.text);

		if (note.reply != null) return;
		if (note.text == null) return;
		if (note.text.includes("@")) return; // (自分または他人問わず)メンションっぽかったらreject
		if (note.user.isBot) return;
		if (note.reply != null && note.reply.user?.id !== note.user?.id) return;
		if (note.text == null) return;
		if (note.cw != null) return;
		if (note.text.includes("@")) return;

		const react = async (reaction: string, immediate = false) => {
			log("react function called : " + note.text);

			if (!immediate) {
				await delay(1500);
			}
			this.ai.api("notes/reactions/create", {
				noteId: note.id,
				reaction: reaction,
			});
		};

		const customEmojis = note.text.match(/:([\w@.-]+):(?!\w)/g);
		if (customEmojis) {
			// カスタム絵文字が複数種類ある場合はキャンセル
			if (!customEmojis.every((val, i, arr) => val === arr[0])) return;

			this.log(`Custom emoji detected - ${customEmojis[0]}`);

			return react(customEmojis[0]);
		}

		const emojis = parse(note.text).map((x) => x.text);
		if (emojis.length > 0) {
			// 絵文字が複数種類ある場合はキャンセル
			if (!emojis.every((val, i, arr) => val === arr[0])) return;

			this.log(`Emoji detected - ${emojis[0]}`);

			let reaction = emojis[0];

			switch (reaction) {
				case "✊":
					reaction = "🤟";
					break;
				case "✌":
					reaction = "🤞";
					break;
				case "🖐":
					reaction = "🖖";
					break;
				case "✋":
					reaction = "🖖";
					break;
			}

			return react(reaction);
		}

		// 巻頭歌リスト
		const kantoukareactions = [
			":hitohaminasubekarakuakudearimizukarawoseigitosakkakusurutamenihaonoreigainonanimonokawoonoreijounoa:",
			":syuyowarewarehakujakuwomiruyounametukideanatawomirusorehakitaitokatugoutokyouhuninitasokosirenumono:",
			":103dordoni:",
			":bleach_28_kantouka:",
			":tinoyouniakakuhonenoyounisirokukodokunoyouniakakutinmokunoyounisirokukemononosinkeinoyouniakakukami:",
			":bokuha_tuiteyukerudarouka:",
			":bleach_05_kantouka:",
			":bleach_47_kantouka:",
		];

		const randomKantouka = Math.floor(Math.random() * kantoukareactions.length);
		if (includes(note.text, ["巻頭歌", "かんとうか"]))
			return react(kantoukareactions[randomKantouka]);

		// 藍染リスト
		const aizenreactions = [
			":itsukarasakkakushiteita:",
			":watashigatennitatsu:",
			":tuyoikotobawotukaunayo:",
			":kurohitsugi:",
			":kurohitugi_eisyou:",
		];

		const randomAizen = Math.floor(Math.random() * aizenreactions.length);
		if (includes(note.text, ["藍染", "あいぜん", "惣右介"]))
			return react(aizenreactions[randomAizen]);
		if (
			includes(note.text, [
				"パンジャンドラム",
				" 銅羅無",
				" 把安蛇暗",
				"ぱんじゃんどらむ",
			]) &&
			!includes(note.text, ["焼き", "やき"])
		)
			return react(":panjandoramusama:");
		if (
			includes(note.text, [
				"エロトラップダンジョン",
				" えろとらっぷだんじょん",
			]) &&
			!includes(note.text, ["焼き", "やき"])
		)
			return react(":etd:");
		if (
			includes(note.text, ["触手"]) &&
			!includes(note.text, ["焼き", "やき", "触手話"])
		)
			return react(":syokusyu:");

		if (includes(note.text, ["taikin", "退勤", "たいきん", "しごおわ"]))
			return react(":otukaresama:");
		if (includes(note.text, ["ハリーポッター", "はりーぽったー"]))
			return react(":blobharrypotter:");
		if (includes(note.text, ["卍解", "ばんかい", "bankai"]))
			return react(":bankai:");
		if (
			includes(note.text, [
				"激辛",
				"げきから",
				"🌶",
				"唐辛子",
				"とうがらし",
				"カプサイシン",
				"かぷさいしん",
			])
		)
			return react(":redfog:");
		if (
			includes(note.text, ["dam", "ダム", "だむ"]) &&
			!includes(note.text, [
				"キング",
				"ラン",
				"らん",
				"ガン",
				"マ",
				"ア",
				"ウィズ",
				"ポツ",
				"ノートル",
				"スター",
				"フリー",
			])
		)
			return react(":damuha_arimasen:");
		if (
			includes(note.text, [
				"おはよ",
				"ohayo",
				"pokita",
				"おきた",
				"起きた",
				"おっは",
				"ぽきた",
			]) &&
			note.text?.length <= 30 &&
			!includes(note.text, ["が起きた", "がおきた"])
		)
			return react(":ohayo_usagi:");
		if (
			includes(note.text, [
				"おやす",
				"oyasu",
				"poyasimi",
				"寝る",
				"ぽやしみ",
			]) &&
			note.text?.length <= 30 &&
			!includes(note.text, ["ちゃんねる"])
		)
			return react(":oyasu_mint:");
		if (includes(note.text, ["嘘"]) && note.text?.length <= 30)
			return react(":usoda:");
		if (
			includes(note.text, [
				"つら",
				"辛",
				"しんど",
				"帰りたい",
				"かえりたい",
				"sad",
			])
		)
			return react(":neofox_pat_sob:");
		if (includes(note.text, ["あいちゃん"])) return react(":neofox_peek:");
		if (includes(note.text, ["阨"])) return react(":neofox_peek:");
		if (includes(note.text, ["皆尽村", "みなづきむら"]))
			return react(":kono_kasi_mura_no_kotoda:");
	}
}

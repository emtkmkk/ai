import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { invalidChars, safeForInterpolate } from '@/utils/safe-for-interpolate';
import { checkNgWord, ngword } from '@/utils/check-ng-word';
import { acct } from '@/utils/acct';
import { genItem, itemPrefixes } from '@/vocabulary';
import Friend, { FriendDoc } from '@/friend';
import config from '@/config';
import {
        ensureKazutoriData,
        findRateRank,
        createDefaultKazutoriData,
        hasKazutoriRateHistory,
        formatKazutoriRateForDisplay,
} from '@/modules/kazutori/rate';
import type { EnsuredKazutoriData } from '@/modules/kazutori/rate';

const titles = ['さん', 'くん', '君', 'ちゃん', '様', '先生'];

type List = {
	id: string;
	createdAt: any;
	name: string;
	userIds: string[];
};

export default class extends Module {
	public readonly name = 'core';

	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	private list: List | undefined;

	@autobind
	public install() {
		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});
		// リンクしているユーザをリストに追加
		this.linkAccountListAdd();
		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook
		};
	}

	@autobind
	private async linkAccountListAdd() {
                        const lists = await this.ai.api("users/lists/list", {}) as List[];
                        this.list = lists.find((x) => x.name === "Linked");
                        if (!this.list) {
                                        this.list = await this.ai.api("users/lists/create", { name: "Linked" }) as List;
                                        if (!this.list) return;
                                        console.log("Linked List Create: " + this.list.id);
                        }
                        if (this.list) {
                                        console.log("Linked List: " + this.list.id);
                                        const friends = this.ai.friends.find() ?? [];
                                        const linkedUsers = friends.filter((x) => x.linkedAccounts);
                                        const listUserIds = new Set<string>(this.list.userIds ?? []);
                                        const newLinkedUserIds = new Set<string>();
                                        const validLinkedUserIds = new Set<string>();

                                        for (const linkedUser of linkedUsers) {
                                                        if (linkedUser.linkedAccounts !== Array.from(new Set(linkedUser.linkedAccounts))) {
                                                                        linkedUser.linkedAccounts = Array.from(new Set(linkedUser.linkedAccounts));
                                                        }
                                                        for (const linkedId of linkedUser.linkedAccounts ?? []) {
                                                                        validLinkedUserIds.add(linkedId);
                                                                        if (!listUserIds.has(linkedId)) {
                                                                                        newLinkedUserIds.add(linkedId);
                                                                        }
                                                        }
                                        }

                                        const removeLinkedUserIds: string[] = [];
                                        for (const id of listUserIds) {
                                                        if (!validLinkedUserIds.has(id)) {
                                                                        removeLinkedUserIds.push(id);
                                                        }
                                        }

                                        for (const id of removeLinkedUserIds) {
                                                        if (!this.list?.id) continue;
                                                        await this.ai.api("users/lists/pull", { listId: this.list.id, userId: id });
                                                        console.log("Linked Account List Pull: " + id);
                                        }

                                        for (const x of newLinkedUserIds) {
                                                        if (!this.list?.id) continue;
                                                        const res = await this.ai.api("users/lists/push", { listId: this.list.id, userId: x });
                                                        if (typeof x === "string" && res?.response?.body?.error?.code === "YOU_HAVE_BEEN_BLOCKED") {
                                                                        // ブロックされたユーザーIDをリンクしているユーザーのアカウントからそのIDを削除
                                                                        for (const linkedUser of linkedUsers) {
                                                                                        if (linkedUser.linkedAccounts?.includes(x)) {
                                                                                                        // 該当IDを削除
                                                                                                        linkedUser.linkedAccounts = linkedUser.linkedAccounts.filter(id => id !== x);
                                                                                                        console.log(`Removed blocked ID ${x} from user ${linkedUser.userId}`);
                                                                                        }
                                                                        }
                                                        }
                                                        console.log("Linked Account List Push: " + x);
                                        }
                        }
        }
	

	@autobind
	private async mentionHook(msg: Message) {
		if (!msg.text) return false;

		const ret = (
			(await this.findData(msg)) ||
			this.mergeData(msg) ||
			this.swapKazutoriRate(msg) ||
			(await this.ranking(msg)) ||
			this.transferBegin(msg) ||
			this.transferEnd(msg) ||
			(await this.linkAccount(msg)) ||
			this.setName(msg) ||
			this.getLove(msg) ||
			this.getKazutoriRateReport(msg) ||
			this.getStatus(msg) ||
			(await this.getEmojiData(msg)) ||
			this.getInventory(msg) ||
			this.convertUnixtime(msg) ||
			this.getAdana(msg) ||
			this.getBananasu(msg) ||
			this.getActiveFactor(msg) ||
			this.mkckAbout(msg) ||
			this.modules(msg) ||
			this.version(msg)
		);

		return ret === true ? { reaction: "love" } : ret;
	}


        @autobind
        private async linkAccount(msg: Message) {
                if (!msg.text) return false;
                if (msg.includes(['リンク解除', 'unlink'])) {
                        return this.unlinkAccount(msg);
                }
                if (!msg.includes(['リンク', 'link'])) return false;

                const exp = /@(\w+)@?([\w.-]+)?/.exec(msg.extractedText.replace("リンク", ""));
                if (!exp?.[1]) {
			if (!msg.friend.doc.linkedAccounts) {
				msg.reply("リンクしているアカウントがありません！\n新しくアカウントをリンクさせたい場合は、リンクの後にあなたのサブアカウントへのメンションを入れてください！");
				return { reaction: ":mk_hotchicken:" };
			}
			let message = "とリンクしているアカウント一覧\n\n";
			let chart;
			if (!msg.user.host || config.forceRemoteChartPostCount) {
				// ユーザの投稿数を取得
				chart = await this.ai.api('charts/user/notes', {
					span: 'day',
					limit: 2,
					userId: msg.userId,
					addInfo: true,
				});
			}

			let totalPostCount = 0;
			// チャートがない場合
			if (!chart?.diffs) {
				if (msg.friend.doc?.perModulesData?.rpg?.noChart && msg.friend.doc.perModulesData.rpg.todayNotesCount) {
					let postCount = Math.max(
						(msg.friend.doc.user.notesCount ?? msg.friend.doc.perModulesData.rpg.todayNotesCount) - msg.friend.doc.perModulesData.rpg.todayNotesCount,
						msg.friend.doc.perModulesData.rpg.todayNotesCount - (msg.friend.doc.perModulesData.rpg.yesterdayNotesCount ?? msg.friend.doc.perModulesData.rpg.todayNotesCount)
					);
					totalPostCount += postCount;
					message += acct(msg.friend.doc.user) + " 投稿数: " + postCount;
				} else {
					message += acct(msg.friend.doc.user);
				}
			} else {
				// 投稿数（今日と明日の多い方）
				let postCount = Math.max(
					(chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
					(chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
				);
				message += acct(msg.user) + " 投稿数: " + postCount;
				totalPostCount += postCount;
			}

			if (msg.friend.doc.linkedAccounts?.length) {
				msg.friend.doc.linkedAccounts = Array.from(new Set(msg.friend.doc.linkedAccounts));
				msg.friend.save();
				for (const userId of msg.friend.doc.linkedAccounts) {
					const friend = this.ai.lookupFriend(userId);
					if (!friend) continue;
					if (!friend.doc?.linkedAccounts?.includes(msg.friend.userId)) {
						message += "\n" + acct(friend.doc.user) + " 未リンク（リンク先のアカウントから" + acct(msg.user) + "をリンクしてください）";
					}

					let chart;
					if (config.forceRemoteChartPostCount) {
						// ユーザの投稿数を取得
						chart = await this.ai.api('charts/user/notes', {
							span: 'day',
							limit: 2,
							userId: userId,
						});
					}

					// チャートがない場合
					if (!chart?.diffs) {
						if (friend.doc?.perModulesData?.rpg?.noChart && friend.doc.perModulesData.rpg.todayNotesCount) {
							let postCount = Math.max(
								(friend.doc.user.notesCount ?? friend.doc.perModulesData.rpg.todayNotesCount) - friend.doc.perModulesData.rpg.todayNotesCount,
								friend.doc.perModulesData.rpg.todayNotesCount - (friend.doc.perModulesData.rpg.yesterdayNotesCount ?? friend.doc.perModulesData.rpg.todayNotesCount)
							);
							totalPostCount += postCount;
							message += "\n" + acct(friend.doc.user) + " 投稿数: " + postCount;
						} else {
							message += "\n" + acct(friend.doc.user);
						}
					} else {
						let postCount = Math.max(
							(chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
							(chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
						);
						totalPostCount += postCount;

						message += "\n" + acct(friend.doc.user) + " 投稿数: " + postCount;
					}
				}
			}
			if (chart?.add) {
				const userstats = chart.add.filter((x) => !msg.friend.doc.linkedAccounts?.includes(x.id));
				let postCount = 0;
				for (const userstat of userstats) {
					postCount += Math.max(
						(userstat.diffs.normal?.[0] ?? 0) + (userstat.diffs.reply?.[0] ?? 0) + (userstat.diffs.withFile?.[0] ?? 0),
						(userstat.diffs.normal?.[1] ?? 0) + (userstat.diffs.reply?.[1] ?? 0) + (userstat.diffs.withFile?.[1] ?? 0)
					);
				}
				totalPostCount += Math.floor(postCount * 0.3);

				message += "\n" + "同一IDのユーザの投稿数: " + postCount + ` (× 30% = ${Math.floor(postCount * 0.3)})`;
			}
			message += "\n\n" + "リンク内合計投稿数: " + totalPostCount;
			msg.reply(`${message}`, {
				visibility: 'specified',
			});

			return true;
		} else {
			const doc = this.ai.friends.find({
				'user.username': exp[1],
				...(exp?.[2] ? { 'user.host': exp[2] } : {})
			} as any) as any;
			let filteredDoc = exp?.[2] ? doc : doc.filter((x) => x.user.host == null);

			if (filteredDoc.length === 0) {
				const doc = this.ai.friends.find({
					'user.username': exp[1],
				} as any) as any;
				filteredDoc = doc.filter((x) => x.user.host == null);
			}

			if (filteredDoc.length !== 1 || (filteredDoc[0].userId === msg.userId && (exp?.[2] && exp?.[2] !== "mkkey.net"))) {
				msg.reply(`そのユーザは私が知らないユーザの様です！\n@${exp[1]}@${exp[2]} から \`@mkck@mkkey.net リンク ${acct(msg.user, true)}\`と送信していただけると上手く行く可能性があります！`);
				return { reaction: ":mk_hotchicken:" };
			}

			if (filteredDoc[0].userId === msg.userId) {
				msg.reply(`自身のアカウントとリンクはできないです……`);
				return { reaction: ":mk_hotchicken:" };
			}

			if (!msg.friend.doc.linkedAccounts) msg.friend.doc.linkedAccounts = [];

			if (msg.friend.doc.linkedAccounts.includes(filteredDoc[0].userId)) {
				msg.reply(`そのアカウントは既にリンク済みです！`);
				return { reaction: ":mk_hotchicken:" };
			}

			msg.friend.doc.linkedAccounts?.push(filteredDoc[0].userId);

			msg.friend.doc.linkedAccounts = Array.from(new Set(msg.friend.doc.linkedAccounts));

			msg.friend.save();

			this.linkAccountListAdd();

			if (filteredDoc[0].linkedAccounts?.includes(msg.friend.userId)) {
				msg.reply(`アカウントのリンクに成功しました！\n投稿数が使用される際にリンクしたアカウントの合計投稿数で計算されるようになります！\n\n\`リンク\`と話しかけてもらえれば、リンクしているアカウントの情報を表示します！`);
			} else {
				msg.reply(`アカウントを登録しました！\nリンク先のアカウントからも同じ操作を実行してください！`);
			}

                        return true;
                };
        }

        @autobind
        private async unlinkAccount(msg: Message) {
                if (!msg.friend.doc.linkedAccounts?.length) {
                        msg.reply("リンクしているアカウントがありません！\n新しくアカウントをリンクさせたい場合は、リンクの後にあなたのサブアカウントへのメンションを入れてください！");
                        return { reaction: ":mk_hotchicken:" };
                }

                const exp = /@(\w+)@?([\w.-]+)?/.exec(msg.extractedText.replace(/リンク解除|unlink/gi, ''));

                if (!exp?.[1]) {
                        msg.reply("リンク解除の後に解除したいアカウントへのメンションを入力してください！");
                        return { reaction: ":mk_hotchicken:" };
                }

                const doc = this.ai.friends.find({
                        'user.username': exp[1],
                        ...(exp?.[2] ? { 'user.host': exp[2] } : {})
                } as any) as any;
                let filteredDoc = exp?.[2] ? doc : doc.filter((x) => x.user.host == null);

                if (filteredDoc.length === 0) {
                        const doc = this.ai.friends.find({
                                'user.username': exp[1],
                        } as any) as any;
                        filteredDoc = doc.filter((x) => x.user.host == null);
                }

                if (filteredDoc.length !== 1 || (filteredDoc[0].userId === msg.userId && (exp?.[2] && exp?.[2] !== "mkkey.net"))) {
                        msg.reply(`そのユーザは私が知らないユーザの様です！\n@${exp[1]}@${exp[2]} から \`@mkck@mkkey.net リンク ${acct(msg.user, true)}\`と送信していただけると上手く行く可能性があります！`);
                        return { reaction: ":mk_hotchicken:" };
                }

                const target = filteredDoc[0];

                if (!msg.friend.doc.linkedAccounts?.includes(target.userId)) {
                        msg.reply("そのアカウントとはリンクされていません！");
                        return { reaction: ":mk_hotchicken:" };
                }

                const updatedLinkedAccounts = (msg.friend.doc.linkedAccounts ?? []).filter((id) => id !== target.userId);
                msg.friend.doc.linkedAccounts = updatedLinkedAccounts;
                msg.friend.save();

                const targetFriend = this.ai.lookupFriend(target.userId);
                if (targetFriend?.doc?.linkedAccounts?.includes(msg.friend.userId)) {
                        const targetLinkedAccounts = (targetFriend.doc.linkedAccounts ?? []).filter((id) => id !== msg.friend.userId);
                        targetFriend.doc.linkedAccounts = targetLinkedAccounts;
                        targetFriend.save();
                }

                await this.linkAccountListAdd();

                msg.reply(`アカウントのリンクを解除しました！\nまたリンクしたくなったら \`リンク ${acct(target.user, true)}\` と話しかけてください！`);

                return true;
        }

        @autobind
        private async findData(msg: Message) {
                if (msg.user.host || msg.user.username !== config.master) return false;
                if (!msg.text) return false;
                if (!msg.includes(['データ照会'])) return false;

		const doc = this.ai.friends.find({
			'user.username': { '$regex': new RegExp(msg.extractedText.replace("データ照会 ", ""), "i") }
		} as any) as any;

		if (doc == null || (Array.isArray(doc) && !doc.length)) return { reaction: ":mk_hotchicken:" };

		for (let i = 0; i < doc.length; i++) {
			if (doc[i].user.fields == "[Array]" || doc[i].user.emojis == "[Array]" || doc[i].user.pinnedNoteIds == "[Array]") {
				const user = await this.ai.api('users/show', {
					userId: doc[i].userId
				});
				const friend = new Friend(this.ai, { doc: doc[i] });
				friend.updateUser(user);
				console.log("fix userdata : " + doc[i].userId);
			}
		}

		let json = JSON.parse(JSON.stringify(doc));
		console.log("json : " + JSON.stringify(json, null, 2).length);
		try {
			if (Array.isArray(json)) {
				for (let i = 0; i < json.length; i++) {
					for (let key2 in json[i].user) {
						if (json[i].user[key2] != null && Array.isArray(json[i].user[key2])) {
							console.log("json[" + i + "].user[" + key2 + "] is Array");
							json[i].user[key2] = "[Array]";
						} else if (typeof json[i].user[key2] === 'object' && json[i].user[key2] != null) {
							console.log("json[" + i + "].user[" + key2 + "] is Object");
							json[i].user[key2] = json[i].user[key2].name || "[Object]";
						}
					}
				}
			} else {
				for (let key in json) {
					for (let key2 in json[key].user) {
						if (json[key].user[key2] != null && Array.isArray(json[key].user[key2])) {
							console.log("json[" + key + "].user[" + key2 + "] is Array");
							json[key].user[key2] = "[Array]";
						} else if (typeof json[key].user[key2] === 'object' && json[key].user[key2] != null) {
							console.log("json[" + key + "].user[" + key2 + "] is Object");
							json[key].user[key2] = json[key].user[key2].name || "[Object]";
						}
					}
				}
			}
		} catch (e) {
			console.log(e);
		}

		const text = JSON.stringify(json, null, 2);

		if (text.length >= 7899) {
			console.log(text);
			return { reaction: ":mk_moyochicken:" };
		}

		console.log(text);
		msg.reply(`\n\`\`\`\n${text}\n\`\`\``, {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private mergeAndSum(obj1, obj2) {
		// 結果を格納する新しいオブジェクト
		const result = { ...obj1 };

		// obj2のキーと値を結果に追加、同じキーがあれば値を足し合わせる
		for (const key in obj2) {
			if (result[key] != undefined) {
				if (Array.isArray(result[key]) && Array.isArray(obj2[key])) {
					// 配列の場合は結合する
					if (key === "linkedAccounts") continue;
					result[key] = result[key].concat(obj2[key]);
				} else if (typeof result[key] === 'number' && typeof obj2[key] === 'number') {
					// 数値の場合は足し合わせる
					result[key] += obj2[key];
				} else if (result[key] instanceof Date && obj2[key] instanceof Date) {
					// 日付の場合は未来の日付を採用する
					result[key] = result[key] > obj2[key] ? result[key] : obj2[key];
				} else if (typeof result[key] === 'object' && typeof obj2[key] === 'object' && !Array.isArray(result[key])) {
					// オブジェクトの場合は再帰的にマージする
					if (key === "rpg") continue;
					result[key] = this.mergeAndSum(result[key], obj2[key]);
				} else {
					// 他の型の場合は後の方を採用する（ここでは単純に上書きするようにしています）
					result[key] = obj2[key];
				}
			} else {
				result[key] = obj2[key];
			}
		}

		return result;
	}

	@autobind
	private mergeData(msg: Message) {
		if (msg.user.host || msg.user.username !== config.master) return false;
		if (!msg.text) return false;
		if (!msg.includes(['データ合体'])) return false;

		const ids = /データ合体 (\w{10}) (\w{10})/.exec(msg.extractedText);

		if (!ids?.[1]) return { reaction: ":mk_hotchicken:" };
		if (!ids?.[2]) return { reaction: ":mk_hotchicken:" };

		const doc1 = this.ai.lookupFriend(ids?.[1]);

		if (doc1 == null) return { reaction: ":mk_hotchicken:" };

		const doc2 = this.ai.lookupFriend(ids?.[2]);

		if (doc2 == null) return { reaction: ":mk_hotchicken:" };

		doc2.doc.name = doc2.name || doc1.name;
		const doc1Rpg = doc1.doc.perModulesData?.rpg
			? JSON.parse(JSON.stringify(doc1.doc.perModulesData.rpg))
			: undefined;
		const doc2Rpg = doc2.doc.perModulesData?.rpg
			? JSON.parse(JSON.stringify(doc2.doc.perModulesData.rpg))
			: undefined;
		const doc1KazutoriRate = doc1.doc.kazutoriData?.rate;
		const doc2KazutoriRate = doc2.doc.kazutoriData?.rate;
		let x = 0;
		let y = 0;
		while (y < doc1.love) {
			const amount = y > 100 ? (Math.ceil(0.5 / ((y || 0) * 2 / 100 - 1) * 100) / 100) : 0.5;
			y = parseFloat((y + amount || 0).toFixed(2));
			x += 1;
		}
		console.log(`${x} : ${y}`);
		for (let i = 0; i < x; i++) {
			doc2.incLove(0.1, "merge");
		}
		doc1.doc.love = 0;
		doc2.doc.married = doc1.married || doc2.married;
		doc2.doc.perModulesData = this.mergeAndSum(doc1.doc.perModulesData, doc2.doc.perModulesData);
                doc2.doc.kazutoriData = this.mergeAndSum(doc1.doc.kazutoriData, doc2.doc.kazutoriData);
                doc1.doc.kazutoriData = createDefaultKazutoriData();
		if (doc2.doc.kazutoriData == null) doc2.doc.kazutoriData = createDefaultKazutoriData();
		doc2.doc.kazutoriData.rate = doc1KazutoriRate ?? doc2.doc.kazutoriData.rate;
		doc1.doc.kazutoriData.rate = doc2KazutoriRate ?? doc1.doc.kazutoriData.rate;
		if (doc2.doc.perModulesData == null) doc2.doc.perModulesData = {};
		if (doc1.doc.perModulesData == null) doc1.doc.perModulesData = {};
		doc2.doc.perModulesData.rpg = doc1Rpg;
		doc1.doc.perModulesData.rpg = doc2Rpg;
		doc2.save();
		doc1.save();

		let json = JSON.parse(JSON.stringify(doc2.doc));

		delete json.user;

		const text = JSON.stringify(json, null, 2);

		if (text.length >= 7899) {
			console.log(text);
			return { reaction: ":mk_moyochicken:" };
		}

		msg.reply(`合体完了\n\`\`\`\n${text}\n\`\`\``, {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private swapKazutoriRate(msg: Message) {
		if (msg.user.host || msg.user.username !== config.master) return false;
		if (!msg.text) return false;
		if (!msg.includes(['レート移行'])) return false;

		const ids = /レート移行 (\w{10}) (\w{10})/.exec(msg.extractedText);

		if (!ids?.[1]) return { reaction: ":mk_hotchicken:" };
		if (!ids?.[2]) return { reaction: ":mk_hotchicken:" };

		const doc1 = this.ai.lookupFriend(ids[1]);
		if (doc1 == null) return { reaction: ":mk_hotchicken:" };

		const doc2 = this.ai.lookupFriend(ids[2]);
		if (doc2 == null) return { reaction: ":mk_hotchicken:" };

		const { data: data1, updated: updated1 } = ensureKazutoriData(doc1.doc);
		const { data: data2, updated: updated2 } = ensureKazutoriData(doc2.doc);

		const beforeRate1 = data1.rate;
		const beforeRate2 = data2.rate;

		data1.rate = beforeRate2;
		data2.rate = beforeRate1;
		data1.rateChanged = true;
		data2.rateChanged = true;

		if (updated1 || updated2 || beforeRate1 !== data1.rate || beforeRate2 !== data2.rate) {
			doc1.save();
			doc2.save();
		}

		msg.reply(
			`レートを入れ替えました！\n` +
				`${acct(doc1.doc.user)} : ${formatKazutoriRateForDisplay(beforeRate1)} → ${formatKazutoriRateForDisplay(data1.rate)}\n` +
				`${acct(doc2.doc.user)} : ${formatKazutoriRateForDisplay(beforeRate2)} → ${formatKazutoriRateForDisplay(data2.rate)}`,
			{ visibility: 'specified' }
		);

		return true;
	}

	@autobind
	private async ranking(msg: Message) {
		if (msg.user.host || msg.user.username !== config.master) return false;
		if (!msg.text) return false;
		if (!msg.includes(['ランキング'])) return false;

		const friends = this.ai.friends.find() ?? [];

		const docs = friends.filter((x) => (x.love && x.love >= 100)).slice(0, 100) as any;

		for (let i = 0; i < docs.length; i++) {
			if (docs[i].user.fields == "[Array]" || docs[i].user.emojis == "[Array]" || docs[i].user.pinnedNoteIds == "[Array]") {
				const user = await this.ai.api('users/show', {
					userId: docs[i].userId
				});
				const friend = new Friend(this.ai, { doc: docs[i] });
				friend.updateUser(user);
				console.log("fix userdata : " + docs[i].userId);
			}
		}

		const rank = docs.sort((a, b) => (b.love ?? 0) - (a.love ?? 0)).map((x) => `${x.user ? `@${x.user?.username}${x.user?.host ? `@${x.user.host}` : ""}` : x.userId} : ★${((x.love ?? 0) / (100 / 7)).toFixed(2)}`);

		msg.reply(`ランキング\n\n${rank.join("\n")}`, {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private transferBegin(msg: Message): boolean {
		return false;
		if (!msg.text) return false;
		if (!msg.includes(['引継', '引き継ぎ', '引越', '引っ越し'])) return false;

		const code = msg.friend.generateTransferCode();

		console.log("move account code generated : " + msg.user.id + " : " + code);

		msg.reply(serifs.core.transferCode(code), {
			visibility: 'specified',
		});

		return true;
	}

	@autobind
	private transferEnd(msg: Message): boolean {
		return false;
		if (!msg.extractedText) return false;
		if (!msg.extractedText.startsWith('「') || !msg.extractedText.endsWith('」')) return false;


		const code = msg.extractedText.substring(1, msg.extractedText.length - 1);

		console.log("move account code : " + msg.user.id + " : " + code);

		const succ = msg.friend.transferMemory(code);

		if (succ) {
			console.log("move Success : " + msg.user.id);
			msg.reply(serifs.core.transferDone(msg.friend.name));
		} else {
			console.log("move Failed : " + msg.user.id);
			msg.reply(serifs.core.transferFailed);
		}

		return true;
	}

	@autobind
	private setName(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('って呼んで') && !(msg.includes(['あだ名', '名前', '呼び名']) && msg.includes(['忘れて', '忘れろ']))) return false;
		if (msg.text.startsWith('って呼んで')) return false;

		if ((msg.includes(['あだ名', '名前', '呼び名']) && msg.includes(['忘れて', '忘れろ']))) {
			msg.friend.updateName(null);
			msg.reply(serifs.core.setNameNull);
			return true;
		}

		const name = msg.extractedText.match(/^(.+?)って呼んで/)![1].trim();

		// 好感度が100（★7）を超えている場合、20文字までOK

		if ((msg.friend.love < 100 && name.length > 10) || (msg.friend.love >= 100 && name.length > 20)) {
			msg.reply(serifs.core.tooLong(name.length, msg.friend.love >= 100 ? 20 : 10));
			return true;
		}

		if (!safeForInterpolate(name)) {
			msg.reply(serifs.core.invalidName);
			return true;
		}

		if (!checkNgWord(name)) {
			msg.reply(serifs.core.ngName);
			return true;
		}

		const withSan = titles.some(t => name.endsWith(t));

		if (withSan) {
			msg.friend.updateName(name);
			msg.reply(serifs.core.setNameOk(name));
		} else {
			msg.reply(serifs.core.san).then(reply => {
				this.subscribeReply(msg.userId, reply.id, {
					name: name
				});
			});
		}

		return true;
	}

	@autobind
	private convertUnixtime(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('のunixtimeは')) return false;

		const timeStr = msg.extractedText.match(/^(.+?)のunixtimeは/)![1].trim();

		if (!isNaN(Date.parse(timeStr))) {
			const time = new Date(timeStr);
			msg.reply(serifs.core.unixtime(`${time.toString()}`, `${time.toISOString()}`, time.valueOf() / 1000));
		} else {
			msg.reply(serifs.core.invalidDate);
		}

		return true;
	}

	@autobind
	private getLove(msg: Message): boolean {
		if (!msg.text) return false;
		if (!msg.text.includes('好感度') && !msg.text.includes('懐き度') && !msg.text.includes('なつき度')) return false;

                const { data: kazutoriData, updated: kazutoriUpdated } = ensureKazutoriData(msg.friend.doc);
                if (kazutoriUpdated) msg.friend.save();

                const lovep = msg.friend.love || 0;
		let love = "";
		let over = Math.floor(lovep / (100 / 7)) - 7;
		let point = (lovep / (100 / 7)).toFixed(2);
		love += lovep >= -29 ? "★" : "☆";
		love += lovep >= -10 ? "★" : "☆";
		love += lovep >= 0 ? "★" : "☆";
		love += lovep >= 5 ? "★" : "☆";
		love += lovep >= 20 ? "★" : "☆";
		love += lovep >= 50 ? "★" : "☆";
		love += lovep >= 100 ? "★" : "☆";
		love += over >= 1 ? "★".repeat(over) + "\n(★\\(" + point + "\\))" : "";

		msg.reply(serifs.core.getLove(msg.friend.name || 'あなた', love));

		return true;
	}

	@autobind
        private getStatus(msg: Message): boolean {
                if (!msg.text) return false;
                if (!msg.text.includes('ステータス') && !msg.includes(["status"])) return false;

                const { data: kazutoriData, updated: kazutoriUpdated } = ensureKazutoriData(msg.friend.doc);
                if (kazutoriUpdated) msg.friend.save();

                const lovep = msg.friend.love || 0;
                let love = "";
                let over = Math.floor(lovep / (100 / 7)) - 7;
                love += lovep >= -29 ? "★" : "☆";
                love += lovep >= -10 ? "★" : "☆";
		love += lovep >= 0 ? "★" : "☆";
		love += lovep >= 5 ? "★" : "☆";
		love += lovep >= 20 ? "★" : "☆";
		love += lovep >= 50 ? "★" : "☆";
		love += lovep >= 100 ? "★" : "☆";
		love += over >= 1 ? "+" + (over >= 2 ? over : "") : "";

		const name = msg.friend.name ? '呼び方 : ' + msg.friend.name : '';

		const lovemsg = `懐き度 : ${love}`;

                const rateInfo = this.getKazutoriRateInfo(msg.friend.userId);
                const rankText = rateInfo?.rank != null
                        ? `${rateInfo.rank}位`
                        : undefined;
                const rateText = rateInfo?.rate != null
                        ? `\nレート : ${formatKazutoriRateForDisplay(rateInfo.rate)}${rankText ? ` / ${rankText}` : ''}`
                        : '';
                const kazutori = `数取り : ${kazutoriData.winCount ?? 0} / ${kazutoriData.playCount ?? 0}${rateText}${kazutoriData.medal ? "\nトロフィー : " + kazutoriData.medal : ""}`;

		const bonus = msg.friend.doc.perModulesData?.rpg ? (((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) + ((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0))) / 2 : 0;
		const rpg = msg.friend.doc.perModulesData?.rpg
			? [
				serifs.rpg.rpgMode + ((msg.friend.doc.perModulesData.rpg.clearHistory ?? []).includes("ending") ? "⭐" : "") + ((msg.friend.doc.perModulesData.rpg.maxEndress ?? 0) >= 99 ? "⭐" : ""),
				`  ${serifs.rpg.status.enemy} : ${msg.friend.doc.perModulesData.rpg.enemy ? (msg.friend.doc.perModulesData.rpg.enemy?.short ?? "") : "探索中"}`,
				`  ${serifs.rpg.status.lv} : ${msg.friend.doc.perModulesData.rpg.lv ?? 1}`,
				`  ${serifs.rpg.status.atk} : ${msg.friend.doc.perModulesData.rpg.atk ?? 0}${bonus >= 1 ? ` (+${Math.floor(bonus * ((100 + (msg.friend.doc.perModulesData.rpg.atk ?? 0)) / 100))})` : ""}`,
				`  ${serifs.rpg.status.def} : ${msg.friend.doc.perModulesData.rpg.def ?? 0}${bonus >= 1 ? ` (+${Math.floor(bonus * ((100 + (msg.friend.doc.perModulesData.rpg.def ?? 0)) / 100))})` : ""}`,
				lovep >= 100 ? `  ${serifs.rpg.status.spd} : ${Math.floor(lovep / 100) + 1}` : "",
				msg.friend.doc.perModulesData.rpg.skills ? `  ${serifs.rpg.status.skill} : ` : undefined,
				...(msg.friend.doc.perModulesData.rpg.skills ? msg.friend.doc.perModulesData.rpg.skills.map((x) => "    " + x.name) : []),
				msg.friend.doc.perModulesData.rpg.coin ? `  ${serifs.rpg.status.coin} : ${msg.friend.doc.perModulesData.rpg.coin}` : "",
			].filter(Boolean).join("\n")
			: "";

                msg.reply(serifs.core.getStatus([name, lovemsg, kazutori, rpg].filter(Boolean).join("\n")));

                return true;
        }

        @autobind
        private getKazutoriRateReport(msg: Message): boolean {
                if (!msg.text) return false;
                const rateKeywords = ['レート'];
                if (!msg.includes(rateKeywords)) return false;

                const { data: kazutoriData, updated: kazutoriUpdated } = ensureKazutoriData(msg.friend.doc);
                if (kazutoriUpdated) msg.friend.save();

                const rateInfo = this.getKazutoriRateInfo(msg.friend.userId);
                const lastGameId = this.getLatestKazutoriGameId();
                const shouldOverrideResult =
                        lastGameId != null && kazutoriData.lastRateChangeGameId !== lastGameId;
                const changeValue = shouldOverrideResult ? undefined : kazutoriData.lastRateChange;
                const formatDelta = (value?: number) => {
                        if (typeof value !== 'number' || Number.isNaN(value)) return '→';
                        if (value > 0) return `↑${value}`;
                        if (value < 0) return `↓${Math.abs(value)}`;
                        return '→';
                };
                const rateText = rateInfo?.rate != null ? formatKazutoriRateForDisplay(rateInfo.rate) : '--';
                const rateDeltaText = formatDelta(changeValue);
                const rankText = rateInfo?.rank != null ? `${rateInfo.rank}位` : '--位';
                const adjustmentValue = kazutoriData.lastRateLossAdjustmentPercent;
                const lossAdjustmentText = (() => {
                        if (typeof adjustmentValue !== 'number' || Number.isNaN(adjustmentValue)) return undefined;
                        if (adjustmentValue >= 100) return undefined;
                        const reductionPercent = Math.max(0, Math.round(100 - adjustmentValue));
                        return `軽減: ${reductionPercent}%`;
                })();

                const gameResultLabel = (() => {
                        if (shouldOverrideResult) {
                                return '不参加';
                        }
                        switch (kazutoriData.lastGameResult) {
                                case 'win':
                                        return '勝ち';
                                case 'lose':
                                        return lossAdjustmentText ? `負け (${lossAdjustmentText})` : '負け';
                                case 'no-winner':
                                        return '勝者なし';
                                case 'absent':
                                        return '不参加';
                                default:
                                        return '--';
                        }
                })();

                const ranking = this.getKazutoriRateRankingSnapshot();
                const topRates = ranking.slice(0, 3).map((entry, index) => {
                        const hasEntryChange =
                                lastGameId == null || entry.lastRateChangeGameId === lastGameId;
                        const deltaText = hasEntryChange ? formatDelta(entry.lastRateChange) : '→';
                        return `${index + 1}位 ${formatKazutoriRateForDisplay(entry.rate)} (${deltaText})`;
                });

                const topText = topRates.length > 0 ? topRates.join('\n') : 'データがありません';

                msg.reply(
                        `数取りレート情報\n` +
                                `-----------\n` +
                                `現在のレート: ${rateText} (${rateDeltaText})\n` +
                                `前回の数取り: ${gameResultLabel}\n` +
                                `-----------\n` +
                                `現在の順位: ${rankText}\n` +
                                `ランキングTOP3:\n` +
                                `${topText}`,
                        { visibility: 'home' }
                );

                return true;
        }

        private getKazutoriRateRankingSnapshot(): {
                userId: string;
                rate: number;
                lastRateChange?: number;
                lastRateChangeGameId?: string;
        }[] {
                const friendDocs = this.ai.friends.find({}) as FriendDoc[];
                const ranking: {
                        userId: string;
                        rate: number;
                        lastRateChange?: number;
                        lastRateChangeGameId?: string;
                }[] = [];
                const updatedDocs: FriendDoc[] = [];

                for (const doc of friendDocs) {
                        const { data, updated } = ensureKazutoriData(doc);
                        if (updated) updatedDocs.push(doc);
                        if (hasKazutoriRateHistory(data)) {
                                ranking.push({
                                        userId: doc.userId,
                                        rate: data.rate,
                                        lastRateChange: data.lastRateChange,
                                        lastRateChangeGameId: data.lastRateChangeGameId,
                                });
                        }
                }

                for (const doc of updatedDocs) {
                        this.ai.friends.update(doc);
                }

                ranking.sort((a, b) => (b.rate === a.rate ? a.userId.localeCompare(b.userId) : b.rate - a.rate));
                return ranking;
        }

        private getLatestKazutoriGameId(): string | null {
                const games = this.ai.getCollection('kazutori');
                if (!games) return null;
                const list = games.find({ isEnded: true }) as Array<{ finishedAt?: number; postId?: string }>;
                if (!list?.length) return null;
                let latest: { finishedAt?: number; postId?: string } | null = null;
                for (const game of list) {
                        if (!game?.postId) continue;
                        if (!latest) {
                                latest = game;
                                continue;
                        }
                        const latestTime = latest.finishedAt ?? 0;
                        const currentTime = game.finishedAt ?? 0;
                        if (currentTime >= latestTime) {
                                latest = game;
                        }
                }
                return latest?.postId ?? null;
        }

        private getKazutoriRateInfo(userId: string): { rate?: number; rank?: number; total: number; } {
                const friendDocs = this.ai.friends.find({}) as FriendDoc[];
                const ranking: { userId: string; rate: number; }[] = [];
                const updatedDocs: FriendDoc[] = [];
                let selfData: EnsuredKazutoriData | undefined;

                for (const doc of friendDocs) {
                        const { data, updated } = ensureKazutoriData(doc);
                        if (updated) updatedDocs.push(doc);
                        if (doc.userId === userId) {
                                selfData = data;
                        }
                        if (hasKazutoriRateHistory(data)) {
                                ranking.push({ userId: doc.userId, rate: data.rate });
                        }
                }

                for (const doc of updatedDocs) {
                        this.ai.friends.update(doc);
                }

                ranking.sort((a, b) => (b.rate === a.rate ? a.userId.localeCompare(b.userId) : b.rate - a.rate));
                const rank = findRateRank(ranking, userId);

                return {
                        rate: selfData?.rate,
                        rank,
                        total: ranking.length,
                };
        }

        @autobind
        private getInventory(msg: Message): boolean {
                if (!msg.text) return false;
                if (!msg.friend.doc.kazutoriData?.inventory?.length) return false;
		if (!(msg.includes(['貰った', 'もらった', 'くれた']) && msg.includes(['もの', '物']))) return false;

		const inventory = [...msg.friend.doc.kazutoriData?.inventory].reverse();

		msg.reply(serifs.core.getInventory(msg.friend.name || 'あなた', inventory.join('\n')) + (
			msg.friend.doc.kazutoriData?.inventory?.length === 50
				? `\n\n沢山プレゼントがありますね！\n次に物を入手すると最も古い物が消えてしまうので注意してください！（次は「**${msg.friend.doc.kazutoriData?.inventory[0]}**」が消滅します。）`
				: msg.friend.doc.kazutoriData?.inventory?.length >= 35
					? `\n\n沢山プレゼントがありますね！\n**50**個を超えると古い物から消えてしまうので注意してください！（現在**${msg.friend.doc.kazutoriData?.inventory?.length}**個）`
					: ""
		));

		return true;
	}

	@autobind
	private getAdana(msg: Message): boolean {
		if (!msg.text) return false;
		if (!(msg.includes(['あだ名', 'あだな']))) return false;

		const genAdana = (): string => {
			let adana = "";
			if (Math.random() < 0.5) {
				adana = genItem();
			} else {
				if (Math.random() > 0.1) adana = itemPrefixes[Math.floor(Math.random() * itemPrefixes.length)];
				const words = this.learnedKeywords.find();
				const word = words ? words[Math.floor(Math.random() * words.length)].keyword : undefined;
				adana += word;
			}
			if (Math.random() < 0.4) {
				adana += titles[Math.floor(Math.random() * titles.length)];
			}
			return adana;
		};

		const adanas = msg.includes(['たくさん', '沢山', 'いっぱい', '大量']) ? [genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana(), genAdana()] : [genAdana(), genAdana(), genAdana()];

		msg.reply(serifs.core.getAdana(adanas));

		return true;
	}

	@autobind
	private getBananasu(msg: Message): boolean {
		if (!msg.text) return false;
		if (!(msg.includes(['バナナス', 'バニャニャス']))) return false;
		let debug = false;
		if (msg.includes(['-d'])) debug = true;

		let inputWord: string | undefined;
		if (/^[^\s]{1,10}(の|で)(たくさん)?(バナナス|バニャニャス|ばななす|ばにゃにゃす)/.test(msg.extractedText)) {
			inputWord = /^([^\s]+)(の|で)(たくさん)?(バナナス|バニャニャス|ばななす|ばにゃにゃす)/.exec(msg.extractedText)?.[1];
		}

		invalidChars.forEach((x) => {
			if (inputWord) inputWord = inputWord.replaceAll(x, "");
		});

		ngword.forEach((x) => {
			if (inputWord) inputWord = inputWord.replaceAll(x, "");
		});

		const words = this.learnedKeywords.find()?.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
		const exWords = words?.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
		const words2 = exWords?.filter((x) => x.keyword.length >= 4);
		const jpWords = exWords?.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
		const hirakanaWords = jpWords?.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));
		let word1error = false;
		let word2error = false;

		const bananasu = msg.includes(['たくさん', '沢山', 'いっぱい', '大量']) ? Array.from(new Set([this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error), this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error)])).filter((x) => x).join("\n") : this.ai.makeBananasu(inputWord, words, exWords, words2, jpWords, hirakanaWords, word1error, word2error);

		msg.reply("\n" + (bananasu ? bananasu : "上手く思いつきませんでした。また今度試してみてください！"), { visibility: bananasu ? "public" : "home" });
		return true;
	}

	@autobind
	private async getEmojiData(msg: Message) {
		if (!msg.text) return false;
		if (!msg.text.includes('絵文字情報')) return false;

		const data = await this.ai.api('users/emoji-stats', {
			userId: msg.userId,
			limit: 20,
			localOnly: false,
		});

		if (!data) {
			return false;
		}

		if (!msg.user.host) {			//ローカル
			msg.reply(`
送った事がある絵文字の種類 : **${data.sentReactionsCount}** 種類
受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}** 種類

よく送る絵文字（累計） : 
${data.sentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

よく貰う絵文字（累計） : 
${data.receivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく送る絵文字 : 
${data.recentlySentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく貰う絵文字 : 
${data.recentlyReceivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}
`, { cw: `${acct(msg.user)} ${msg.friend.name || 'さん'}の絵文字情報（リアクション）` });
		} else {
			//リモート
			msg.reply(`
※リモートユーザの為、絵文字がうまく表示されない可能性、正しい情報が表示されない可能性があります。
絵文字がうまく表示されない場合はリモートで表示などのボタンを使用し、${config.instanceName}にて確認してください。

受け取った事がある絵文字の種類 : **${data.receivedReactionsCount}** 種類

よく送る絵文字（累計） : 
${data.sentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

よく貰う絵文字（累計） : 
${data.receivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく送る絵文字 : 
${data.recentlySentReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}

最近よく貰う絵文字 : 
${data.recentlyReceivedReactions.map((x, i) => `第${i + 1}位 (${x.count}回) ${x.name}${x.name.includes("@") ? ` (${x.name.replace(/^[^@]+@/, "").replace(":", "")})` : ''}`).join('\n')}
`, { cw: `${acct(msg.user)} ${msg.friend.name || 'さん'}の絵文字情報（リアクション）` });
		}

		return true;
	}


	@autobind
	private modules(msg: Message) {
		if (!msg.text) return false;
		if (!msg.or(['modules'])) return false;

		let text = '\n```\n';

		for (const m of this.ai.modules) {
			text += `${m.name}\n`;
		}

		text += '```';

		msg.reply(text, {
			immediate: true
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private version(msg: Message) {
		if (!msg.text) return false;
		if (!msg.or(['v', 'version', 'バージョン'])) return false;

		msg.reply(`\n\`\`\`\nv${this.ai.version}\n\`\`\``, {
			immediate: true
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private mkckAbout(msg: Message) {
		if (!msg.text) return false;
		if (!msg.includes(['もこチキについて', 'もこもこチキンについて'])) return false;

		const friends = this.ai.friends.find() ?? [];
		const words = this.learnedKeywords.find();
		const baWords = words?.filter((x) => x.keyword.length >= 3 && !/^[0-9]/.test(x.keyword) && !/[0-9]$/.test(x.keyword));
		const specialWords = words?.filter((x) => /^[!-\/:-@[-`{-~！？]/.test(x.keyword) || /[!-\/:-@[-`{-~！？]$/.test(x.keyword));
		const exWords = baWords?.map((x) => ({ ...x, keyword: x.keyword.replaceAll(/^[!-\/:-@[-`{-~！？]/g, "").replaceAll(/[!-\/:-@[-`{-~！？]$/g, "") }));
		const words2 = exWords?.filter((x) => x.keyword.length >= 4);
		const jpWords = exWords?.filter((x) => !/[a-zA-Z0-9_]$/.test(x.keyword));
		const hirakanaWords = jpWords?.filter((x) => /[ぁ-んァ-ンヴー]$/.test(x.keyword));
		msg.reply(`\n\`\`\`\n友達の人数 : ${friends.filter((x) => x.love && x.love >= 20).length}\n親友の人数 : ${friends.filter((x) => x.love && x.love >= 100).length}\n合計好感度 : ☆${Math.floor(friends.filter((x) => x.love).reduce((acc, cur) => acc + (cur.love ?? 0), 0) / (10 / 7)) / 10}\n\n数取り回数 : ${friends.filter((x) => x.kazutoriData?.winCount).reduce((acc, cur) => acc + (cur.kazutoriData?.winCount ?? 0), 0)}\nトロフィー発行数 : ${friends.filter((x) => x.kazutoriData?.medal).reduce((acc, cur) => acc + (cur.kazutoriData?.medal ?? 0), 0)}\n\n現在の機嫌 : ${Math.floor(this.ai.activeFactor * 100)}%\n\n覚えた言葉数 : ${words.length}\nバナナスに使う言葉数 : ${baWords.length - specialWords.length} + ${specialWords.length}\n英語以外で終わる言葉数 : ${jpWords.length}\n英語・漢字以外で終わる言葉数 : ${hirakanaWords.length}\n\`\`\``, {
			immediate: false
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private getActiveFactor(msg: Message) {
		if (!msg.text) return false;
		if (!msg.includes(['きげん', 'きもち', '機嫌', '気持ち'])) return false;

		msg.reply(`\n\`\`\`\n現在の機嫌 : ${Math.floor(this.ai.activeFactor * 1000) / 10}%\n\`\`\``, {
			immediate: false
		});

		return { reaction: ":mk_moyochicken:" };
	}

	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (msg.text == null) return;

		if (key !== msg.userId) {
			msg.reply(serifs.reminder.doneFromInvalidUser);
			return {
				reaction: 'confused'
			};
		}

		const done = () => {
			msg.reply(serifs.core.setNameOk(msg.friend.name));
			this.unsubscribeReply(key);
		};

		if (msg.text.includes('はい')) {
			msg.friend.updateName(data.name + 'さん');
			done();
			return { reaction: 'love' };
		} else if (msg.text.includes('いいえ')) {
			msg.friend.updateName(data.name);
			done();
			return { reaction: 'love' };
		} else {
			msg.reply(serifs.core.yesOrNo).then(reply => {
				this.subscribeReply(msg.userId, reply.id, data);
			});
			return { reaction: 'hmm' };
		}
	}
}

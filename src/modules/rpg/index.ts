import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import * as seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';
import getDate from '@/utils/get-date';
import { acct } from '@/utils/acct';
import { enemys } from './enemys';
import { colors } from './colors';

export default class extends Module {
    public readonly name = 'rpg';

    @autobind
    public install() {
        setInterval(() => {
            const hours = new Date().getHours()
            if ((hours === 0 || hours === 12 || hours === 18) && new Date().getMinutes() >= 3 && new Date().getMinutes() < 8) {
                const me = Math.random() < 0.75 ? ":mk_hero:" : [":mk_hero_2p:", ":mk_hero_3p:", ":mk_hero_4p:", ":mk_hero_5p:", ":mk_hero_6p:", ":mk_hero_7p:"].sort(() => Math.random() - 0.5)[0];
                this.ai.post({
                    text: `<center>$[x2 ${me}]\n\n${hours}時です！\nRPGモードの時間ですよ～\n\n毎日3回プレイして、\n私を強くしてください！\n\n「RPG」と話しかけてね\n（ここに返信でも大丈夫ですよ！）</center>`,
                })
            }
        }, 1000 * 60 * 5);
        return {
            mentionHook: this.mentionHook
        };
    }

    @autobind
    private async mentionHook(msg: Message) {
        if (msg.includes(['rpg']) && msg.includes(['色'])) {
            // データを読み込み
            const data = msg.friend.getPerModulesData(this);
            if (!data) return false;

            if (msg.includes(['変更'])) {
                for (let i = 0; i < colors.length; i++) {
                    if (msg.includes([colors[i].keyword])) {
                        if (colors[i].unlock(data)) {
                            data.color = i + 1
                            msg.friend.setPerModulesData(this, data);
                            return {
                                reaction: ':mk_muscleok:'
                            };
                        } else {
                            return {
                                reaction: 'confused'
                            };
                        }
                    }
                }
            }

            msg.reply([
                "色を変更する場合、`rpg 色変更 <数字>`と話しかけてね",
                "",
                "色解放条件",
                ...colors.map((x) => `${x.keyword}: ${x.name} ${x.message(data)}`)
            ].join("\n"));

            return {
                reaction: 'love'
            };
        }
        if (msg.includes(['rpg']) && msg.includes(['木人'])) {
            // データを読み込み
            const data = msg.friend.getPerModulesData(this);
            // 各種データがない場合は、初期化
            if (!data.clearEnemy) data.clearEnemy = [data.preEnemy ?? ""].filter(Boolean);
            if (!data.clearHistory) data.clearHistory = data.clearEnemy;
            const colorData = colors.map((x) => x.unlock(data));
            // プレイ済でないかのチェック
            if (data.lastPlayedLv >= data.lv) {
                msg.reply(`全力を出して疲れてしまったみたいです。Lvが上がったら、もう一度試してみてください。`);
                return {
                    reaction: 'confused'
                };
            }

            data.lastPlayedLv = data.lv;

            // 覚醒状態か？
            const isSuper = data.color === 9;

            // ユーザの投稿数を取得
            const chart = await this.ai.api('charts/user/notes', {
                span: 'day',
                limit: 2,
                userId: msg.userId
            })
            
            // 投稿数（今日と明日の多い方）
            let postCount = Math.max(
                (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.renote?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
                (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.renote?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
            ) + (isSuper ? 200 : 0);

            if (msg.friend.doc.linkedAccounts.length) {
                for (const userId of msg.friend.doc.linkedAccounts) {
                    const friend = this.ai.lookupFriend(userId);
                    if (!friend || !friend.doc?.linkedAccounts?.includes(msg.friend.userId)) continue;

                    // ユーザの投稿数を取得
                    const chart = await this.ai.api('charts/user/notes', {
                        span: 'day',
                        limit: 2,
                        userId: userId
                    })

                    postCount += Math.max(
                        (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.renote?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
                        (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.renote?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
                    );
                }
            }

            // 投稿数に応じてステータス倍率を得る
            // 連続プレイの場合は倍率アップ
            let tp =
                    postCount >= 75
                        ? (postCount - 75) / 100 + 4
                        : postCount >= 25
                            ? (postCount - 25) / 50 + 3
                            : postCount >= 10
                                ? (postCount - 10) / 15 + 2
                                : postCount >= 3
                                    ? (postCount - 3) / 7 + 1
                                    : Math.max(postCount / 3, (1/3))

            // 自分のカラー
            let me = ":mk_hero" + (!data.color || data.color === 1 ? ":" : `_${data.color}p:`)

            // 画面に出力するメッセージ
            let cw = acct(msg.user) + " ";
            let message = ""

            // ここで残りのステータスを計算しなおす
            let atk = 5 + (data.atk ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.atk ?? 0)) / 100);
            let def = 5 + (data.def ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.def ?? 0)) / 100);
            let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
            if (data.color === 8) {
                // 8Pカラーがセットされている場合、パラメータを逆転
                const _atk = atk;
                atk = def
                def = _atk
            }

            if (isSuper) {
                spd += 2;
            }

			message += [
                `現在のステータス\n`,
				`パワー : ${Math.round(atk)}`,
				`投稿数 : ${Math.round(postCount - (isSuper ? 200 : 0))}\n\n`,
			].filter(Boolean).join("\n")

            cw += `もこチキは自分の力を確認するようだ。(Lv${data.lv})`
            message += `$[x2 ${me}]\n\n開始！\n\n`


            // 敵のステータスを計算
            const edef = data.lv * 3.5;

            let totalDmg = 0;

            for (let i = 0; i < spd; i++) {
                let dmg = this.getAtkDmg(data, atk, tp, 1, false, edef, 0, 1, 3)
                totalDmg += dmg
                // メッセージの出力
                message += `もこチキは木人に攻撃！\n${dmg}ポイントのダメージ！` + "\n"
            }

            message += `\n終了！\n\n合計${totalDmg}ポイントのダメージ！\n(ダメージ幅: ${Math.round(totalDmg * 0.2)} ~ ${Math.round(totalDmg * 1.8)})${data.bestScore ? `\n(これまでのベスト: **${data.bestScore}**)` : ""}`
            
            data.bestScore = Math.max(data.bestScore ?? 0, totalDmg)

            msg.friend.setPerModulesData(this, data);

            // 色解禁確認
            const newColorData = colors.map((x) => x.unlock(data));
            let unlockColors = "";
            for (let i = 0; i < newColorData.length; i++) {
                if (!colorData[i] && newColorData[i]) {
                    unlockColors += colors[i].name
                }
            }
            if (unlockColors) {
                message += `\n\n条件を満たしたので、\n新しい色が解放されました！\n\n$[x2 ${unlockColors}]\n\n「RPG 色」と話しかけて確認してみてね！`
            }

            msg.reply(`<center>${message}</center>`, {
                cw,
                visibility: 'public'
            });

            return {
                reaction: me
            };

        }

        if (msg.includes(['rpg'])) {
            // データを読み込み
            const data = msg.friend.getPerModulesData(this);
            // 各種データがない場合は、初期化
            if (!data.clearEnemy) data.clearEnemy = [data.preEnemy ?? ""].filter(Boolean);
            if (!data.clearHistory) data.clearHistory = data.clearEnemy;
            const colorData = colors.map((x) => x.unlock(data));
            // プレイ済でないかのチェック
            if (data.lastPlayedAt === getDate() + (new Date().getHours() < 12 ? "" : new Date().getHours() < 18 ? "/12" : "/18") && data.ehp <= 110 + data.lv * 3 + (data.winCount ?? 0) * 5) {
                msg.reply(`RPGモードは0~11時、12~17時、18~23時の1日3回です。\n${new Date().getHours() < 12 ? "12時以降" : new Date().getHours() < 18 ? "18時以降" : "明日"}になったらもう一度試してください。`);
                return {
                    reaction: 'confused'
                };
            }
            // 連続プレイかどうかをチェック
            let continuousBonus = 0;
            let continuousFlg = false;
            if (data.lastPlayedAt === (new Date().getHours() < 12 ? getDate(-1) + "/18" : new Date().getHours() < 18 ? getDate() : getDate() + "/12")) {
                continuousBonus = 1;
            } else {
                if (
                    data.lastPlayedAt === (new Date().getHours() < 12 ? getDate(-1) + "/12" : new Date().getHours() < 18 ? getDate(-1) + "/18" : getDate()) ||
                    data.lastPlayedAt === (new Date().getHours() < 12 ? getDate(-1) : new Date().getHours() < 18 ? getDate(-1) + "/12" : getDate(-1) + "/18") ||
                    data.lastPlayedAt?.startsWith(getDate(-1))
                ) {
                    if (new Date().getHours() >= 18 && data.lastPlayedAt === getDate()) continuousFlg = true;
                    continuousBonus = 0.5;
                }
            }

            // 現在の敵と戦ってるターン数。 敵がいない場合は1。
            let count = data.count ?? 1

            // 旅モード（エンドレスモード）のフラグ
            if (msg.includes(['旅モード'])) {
                // 現在戦っている敵がいない場合で旅モード指定がある場合はON
                if (!data.enemy || count === 1 || data.endressFlg) {
                    data.endressFlg = true;
                } else {
                    msg.reply(`探索中以外の状態では旅モードは指定できません。探索中になったらもう一度試してください。`);
                    return {
                        reaction: 'confused'
                    };
                }
            } else {
                // 現在戦っている敵がいない場合で旅モード指定がない場合はOFF
                if (!data.enemy || count === 1) {
                    data.endressFlg = false;
                }
            }

            // 旅モードの場合の敵を定義
            let endressEnemy = {
                name: "もこチキは旅",
                msg: (data.endress ?? 0) ? `旅の途中 (${data.endress + 1}日目)` : "もこチキは旅に出たいようだ。",
                short: (data.endress ?? 0) ? `旅の途中 (${data.endress + 1}日目)` : "旅立ち中",
                hpmsg: "進行度",
                lToR: true,
                mark: "☆",
                mark2: "★",
                atkmsg: (dmg) => `もこチキは先に進んだ。\n進行度が${dmg}ポイントアップ！`,
                defmsg: (dmg) => `もこチキは疲れて${dmg}ポイントのダメージ！`,
                abortmsg: "もこチキは面白いものを見つけたみたいだ。",
                winmsg: "宿が見えてきた。\n今日はここで休むようだ。\n\n次の日へ続く…",
                losemsg: "今回の旅はここで終えて家に帰るようだ。",
                atk: 1.5 + (0.1 * (data.endress ?? 0)),
                def: 2 + (0.3 * (data.endress ?? 0)),
                atkx: 3 + (0.05 * (data.endress ?? 0)),
                defx: 3 + (0.15 * (data.endress ?? 0)),
                about: 0.01,
            }

            // 最終プレイの状態を記録
            data.lastPlayedAt = getDate() + (new Date().getHours() < 12 ? "" : new Date().getHours() < 18 ? "/12" : "/18");

            // ユーザの投稿数を取得
            const chart = await this.ai.api('charts/user/notes', {
                span: 'day',
                limit: 2,
                userId: msg.userId
            })

            // 覚醒状態か？
            const isSuper = Math.random() < (0.02 + Math.max(data.superPoint / 200, 0)) || (data.lv ?? 1) % 100 === 0 || data.color === 9;

            // 投稿数（今日と明日の多い方）
            let postCount = Math.max(
                (chart.diffs.normal?.[0] ?? 0) + (chart.diffs.reply?.[0] ?? 0) + (chart.diffs.renote?.[0] ?? 0) + (chart.diffs.withFile?.[0] ?? 0),
                (chart.diffs.normal?.[1] ?? 0) + (chart.diffs.reply?.[1] ?? 0) + (chart.diffs.renote?.[1] ?? 0) + (chart.diffs.withFile?.[1] ?? 0)
            ) + (isSuper ? 200 : 0);

            if (continuousBonus > 0) {
                postCount = postCount + (Math.min(Math.max(10, postCount / 2), 25) * continuousBonus)
            }

            // 投稿数に応じてステータス倍率を得る
            // 連続プレイの場合は倍率アップ
            let tp =
                    postCount >= 75
                        ? (postCount - 75) / 100 + 4
                        : postCount >= 25
                            ? (postCount - 25) / 50 + 3
                            : postCount >= 10
                                ? (postCount - 10) / 15 + 2
                                : postCount >= 3
                                    ? (postCount - 3) / 7 + 1
                                    : Math.max(postCount / 3, (1/3))

            // これが2ターン目以降の場合、戦闘中に計算された最大倍率の50%の倍率が保証される
            data.maxTp = Math.max(tp, data.maxTp ?? 0);
            tp = Math.max(tp, data.maxTp / 2);

            if (!isSuper) {
                data.superPoint = Math.max(data.superPoint ?? 0 - (tp - 2), -3)
            } else {
                data.superPoint = 0;
            }


            // 画面に出力するメッセージ
            let cw = acct(msg.user) + " ";
            let message = ""

            // 自分のカラー
            let me = ":mk_hero" + (!data.color || data.color === 1 ? ":" : `_${data.color}p:`)

            // ステータスを計算
            const lv = data.lv ?? 1
            let php = data.php ?? 100;

            // 敵情報
            if (!data.enemy || count === 1) {
                // 新しい敵
                count = 1
                data.count = 1
                php = 100 + lv * 3
                // すでにこの回で倒している敵、出現条件を満たしていない敵を除外
                const filteredEnemys = enemys.filter((x) => !(data.clearEnemy ?? []).includes(x.name) && (!x.limit || x.limit(data, msg.friend)));
                if (filteredEnemys.length && !data.endressFlg) {
                    const notClearedEnemys = filteredEnemys.filter((x) => !(data.clearHistory ?? []).includes(x.name));
                    if (notClearedEnemys.length) {
                        // 出現条件を満たしている敵の中で、1度も倒した事のない敵がいる場合、優先的に選ばれる
                        data.enemy = notClearedEnemys[Math.floor(notClearedEnemys.length * Math.random())]
                    } else {
                        // 1度も倒した事のない敵が誰もいない場合
                        data.enemy = filteredEnemys[Math.floor(filteredEnemys.length * Math.random())]
                    }
                } else {
                    // 旅モード（エンドレスモード）
                    // 倒す敵がいなくてこのモードに入った場合、旅モード任意入場フラグをOFFにする
                    if (!filteredEnemys.length) {
                        if (!data.allClear) {
                            data.allClear = lv - 1;
                            data.allClearDate = Date.now();
                        }
                        data.endressFlg = false;
                    }
                    // エンドレス用の敵を設定
                    data.enemy = endressEnemy
								}
                // 敵の開始メッセージなどを設定
                cw += `${data.enemy.msg}`
                message += `$[x2 ${me}]\n\n開始！\n\n`;
							data.ehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
            } else {
                // 一度敵の情報を取得しなおす（関数のデータなどが吹き飛ぶ為）
                data.enemy = [...enemys, endressEnemy].find((x) => data.enemy.name === x.name);
                // 敵の開始メッセージなどを設定
                cw += `${data.enemy.short} ${count}ターン目`
                // 前ターン時点のステータスを表示
                let mehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
                let ehp = Math.min(data.ehp ?? 100, mehp);
                data.count -= 1;
                message += this.showStatus(data, php, ehp, mehp, me) + "\n\n"
                data.count += 1;
            }

            // バフを得た数。行数のコントロールに使用
            let buff = 0;
			
			if ((data.info ?? 0) < 1 && ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
				data.info = 1
                buff += 1;
				message += `もこチキの状況判断能力がアップ！\n今後、状況が細かく\n分析出来るようになる事があるぞ！\n`
			}

            // 連続ボーナスの場合、メッセージを追加
            // バフはすでに上で付与済み
            if (continuousBonus >= 1) {
                buff += 1
                message += `連続RPGボーナス！\nパワー・防御がアップした！\n`
            } else if (continuousFlg && continuousBonus > 0) {
                buff += 1
                message += `連続RPGボーナス（弱）！\nパワー・防御が小アップした！\n`
            } else if (continuousBonus > 0) {
                buff += 1
                message += `毎日RPGボーナス！\nパワー・防御が小アップした！\n`
            }

            // ここで残りのステータスを計算しなおす
            let atk = 5 + (data.atk ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.atk ?? 0)) / 100);
            let def = 5 + (data.def ?? 0) + Math.floor(((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) * (100 + (data.def ?? 0)) / 100);
            let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;
            if (data.color === 8) {
                // 8Pカラーがセットされている場合、パラメータを逆転
                const _atk = atk;
                atk = def
                def = _atk
            }
            // 敵の最大HP
            let mehp = (typeof data.enemy.maxhp === "function") ? data.enemy.maxhp((100 + lv * 3)) : Math.min((100 + lv * 3) + ((data.winCount ?? 0) * 5), (data.enemy.maxhp ?? 300));
            // 敵のHP
            let ehp = Math.min(data.ehp ?? 100, mehp);
            // HPの割合
            let phpp = php / (100 + lv * 3);
            let ehpp = ehp / mehp;
            // 負けた場合のステータスボーナスをここで保持
            let bonus = 0;
            // 連続攻撃中断の場合の攻撃可能回数 0は最後まで攻撃
            let abort = 0;

            if (isSuper) {
                if (me !== ":mk_hero_9p:") {
									// バフが1つでも付与された場合、改行を追加する
									if (buff > 0) message += "\n"
                    buff += 1;
                    me = ":mk_hero_9p:"
                    message += `$[x2 ${me}]\n\n**もこチキは覚醒状態になった！**\n行動回数+**2**！\nパワー・防御が**超**アップ！\n`;
                    data.superCount = (data.superCount ?? 0) + 1
                }
                spd += 2;
            }

            // spdが低い場合、確率でspdが+1。
            if (spd === 2 && Math.random() < 0.1) {
                buff += 1
                message += "もこチキは体の調子が良さそうだ！\n行動回数+1！\n"
                spd = 3;
            }
            if (spd === 1 && Math.random() < 0.5) {
                buff += 1
                message += "もこチキは体の調子が良さそうだ！\n行動回数+1！\n"
                spd = 2;
            }

            // HPが1/7以下で相手とのHP差がかなりある場合、決死の覚悟のバフを得る
            if (phpp <= (1 / 7) && (ehpp - phpp) >= 0.5) {
                buff += 1
                message += "もこチキは決死の覚悟をした！\nパワーが上がり、防御が下がった！\n"
                atk = atk + Math.round(def * (ehpp - phpp))
                def = Math.round(def * (1 - (ehpp - phpp)))
            }

            // 敵のステータスを計算
            const eatk = (typeof data.enemy.atk === "function") ? data.enemy.atk(atk, def, spd) : lv * 3.5 * data.enemy.atk;
            const edef = (typeof data.enemy.def === "function") ? data.enemy.def(atk, def, spd) : lv * 3.5 * data.enemy.def;

            // 敵に最大ダメージ制限がある場合、ここで計算
            let maxdmg = data.enemy.maxdmg ? mehp * data.enemy.maxdmg : undefined

            // 敵が中断能力持ちの場合、ここで何回攻撃可能か判定
            for (let i = 1; i < spd; i++) {
                if (data.enemy.abort && Math.random() < data.enemy.abort) {
                    abort = i;
                    break;
                }
            }

            // バフが1つでも付与された場合、改行を追加する
            if (buff > 0) message += "\n"

            // 予測最大ダメージ
            let predictedDmg = Math.round((atk * tp * 1.8) * (1 / (((edef * (this.getVal(data.enemy.defx, [tp]) ?? 3)) + 100) / 100))) * (abort || spd);

            // 予測最大ダメージは最大ダメージ制限を超えない
            if (maxdmg && predictedDmg > maxdmg) predictedDmg = maxdmg;

            // 敵のターンが既に完了したかのフラグ
            let enemyTurnFinished = false

            // 敵先制攻撃の処理
            // spdが1ではない、または戦闘ではない場合は先制攻撃しない
            if (!data.enemy.spd && !data.enemy.hpmsg) {
                const crit = Math.random() < phpp - ehpp;
                // 予測最大ダメージが相手のHPの何割かで先制攻撃の確率が判定される
                if (Math.random() < predictedDmg / ehp || (count === 3 && data.enemy.fire && (data.thirdFire ?? 0) <= 2)) {
                    const dmg = this.getEnemyDmg(data, def, tp, count, crit, eatk)
                    // ダメージが負けるほど多くなる場合は、先制攻撃しない
                    if (php > dmg || (count === 3 && data.enemy.fire && (data.thirdFire ?? 0) <= 2)) {
                        php -= dmg
                        message += (crit ? `**${data.enemy.defmsg(dmg)}**` : data.enemy.defmsg(dmg)) + "\n"
                        if (php <= 0 && !data.enemy.notEndure) {
                            message += "もこチキは気合で耐えた！\n"
                            php = 1;
                            data.endure = Math.max(data.endure - 1, 0);
                        }
                        message += "\n";
                        enemyTurnFinished = true;
                        if (data.enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
                        if (dmg > (data.superMuscle ?? 0)) data.superMuscle = dmg;
                    }
                }
            }

            // 自身攻撃の処理
            // spdの回数分、以下の処理を繰り返す
            for (let i = 0; i < spd; i++) {
                let crit = Math.random() < ehpp - phpp;
                let dmg = this.getAtkDmg(data, atk, tp, count, crit, edef, mehp)
                // 最大ダメージ制限処理
                if (maxdmg && maxdmg > 0 && dmg > Math.round(maxdmg * (1 / ((abort || spd) - i)))) {
                    // 最大ダメージ制限を超えるダメージの場合は、ダメージが制限される。
                    dmg = Math.round(maxdmg * (1 / ((abort || spd) - i)))
                    maxdmg -= dmg
                    crit = false;
                } else if (maxdmg && maxdmg > 0) {
                    maxdmg -= dmg
                }
                // メッセージの出力
                message += (crit ? `**${data.enemy.atkmsg(dmg)}**` : data.enemy.atkmsg(dmg)) + "\n"
                ehp -= dmg
                // 敵のHPが0以下になった場合は、以降の攻撃をキャンセル
                if (ehp <= 0) break;
                // 攻撃が中断される場合
                if ((i + 1) === abort) {
                    if (data.enemy.abortmsg) message += data.enemy.abortmsg + "\n"
                    break;
                }
            }

            // 覚醒状態でこれが戦闘なら炎で追加攻撃
            if (isSuper && ehp > 0 && !data.enemy.hpmsg && !data.enemy.lToR && !data.enemy.pLToR) {
                message += `もこチキの追い打ち炎攻撃！\n${data.enemy.dname ?? data.enemy.name}が次に受けるダメージが上昇した！\n`
                data.fireAtk = (data.fireAtk ?? 0) + 10;
            }

            // 勝利処理
            if (ehp <= 0) {
                // エンドレスモードかどうかでメッセージ変更
                if (data.enemy.name !== "もこチキは旅") {
                    message += "\n" + data.enemy.winmsg + "\n\n勝利！おめでとう！"
                } else {
                    message += "\n" + data.enemy.winmsg + (data.endressFlg ? "\n（次の日へ進む場合は、次回も旅モードを指定してください）" : "")
                    if ((data.endress ?? 0) > (data.maxEndress ?? 0)) data.maxEndress = data.endress;
                    data.endress = (data.endress ?? 0) + 1;
                }
                // 連続勝利数
                data.streak = (data.streak ?? 0) + 1;
                // 1ターンで勝利した場合はさらに+1
                if (data.count == 1) data.streak = (data.streak ?? 0) + 1;
                data.winCount = (data.winCount ?? 0) + 1
                // クリアした敵のリストを追加
                if (!(data.clearEnemy ?? []).includes(data.enemy.name)) data.clearEnemy.push(data.enemy.name);
                if (!(data.clearHistory ?? []).includes(data.enemy.name)) data.clearHistory.push(data.enemy.name);
                if (data.enemy.name === ":mk_hero_8p:" && !data.aHeroLv) {
                    data.aHeroLv = data.lv;
                    data.aHeroClearDate = Date.now();
                }
                // 次の試合に向けてのパラメータセット
                data.enemy = null;
                data.count = 1;
                data.php = 103 + lv * 3
                data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
                data.maxTp = 0;
                data.fireAtk = 0;
            } else {
                // 敵のターンが既に終了していない場合
                let maxDmg = 0;
                if (!enemyTurnFinished) {
                    for (let i = 0; i < (data.enemy.spd ?? 1); i++) {
                        const crit = Math.random() < phpp - ehpp;
                        const dmg = this.getEnemyDmg(data, def, tp, count, crit, eatk)
                        php -= dmg
                        message += "\n" + (crit ? `**${data.enemy.defmsg(dmg)}**` : data.enemy.defmsg(dmg)) + "\n"
                        if (dmg > maxDmg) maxDmg = dmg;
                        if (data.enemy.fire && count > (data.thirdFire ?? 0)) data.thirdFire = count;
                    }
                    // HPが0で食いしばりが可能な場合、食いしばる
                    if (php <= 0 && !data.enemy.notEndure && count === 1 && Math.random() < 0.05 + (0.1 * (data.endure ?? 0))) {
                        message += "もこチキは気合で耐えた！\n"
                        php = 1;
                        data.endure = Math.max(data.endure - 1, 0);
                    }
                    if (maxDmg > (data.superMuscle ?? 0) && php > 0) data.superMuscle = maxDmg;
                }
                // 敗北処理
                if (php <= 0) {
                    // エンドレスモードかどうかでメッセージ変更
                    if (data.enemy.name !== "もこチキは旅") {
                        message += "\n" + data.enemy.losemsg + "\n\n:oyoo:"
                    } else {
                        message += "\n" + data.enemy.losemsg + `\n(今回の旅の日数 : ${(data.endress ?? 0) + 1}日)`
                        if ((data.endress ?? 0) > (data.maxEndress ?? 0)) data.maxEndress = data.endress;
                        data.endress = 0;
                    }
                    // これが任意に入った旅モードだった場合は、各種フラグをリセットしない
                    if (!data.endressFlg) {
                        data.streak = 0;
                        data.clearEnemy = [];
                    }
                    // 食いしばり成功率を上げる
                    data.endure = (data.endure ?? 0) + 1
                    // 敗北で能力上昇ボーナス
                    data.atk = (data.atk ?? 0) + 2
                    data.def = (data.def ?? 0) + 2
                    bonus += 2;
                    // 次の試合に向けてのパラメータセット
                    data.enemy = null;
                    data.count = 1;
                    data.php = 113 + lv * 3
                    data.ehp = 103 + lv * 3 + (data.winCount ?? 0) * 5
                    data.maxTp = 0;
                    data.fireAtk = 0;
                } else {
                    // 決着がつかない場合
                    message += this.showStatus(data, php, ehp, mehp, me) + "\n\n次回へ続く……"
                    data.count = (data.count ?? 1) + 1;
                    data.php = php;
                    data.ehp = ehp;
                }
            }
            // レベルアップ処理
            data.lv = (data.lv ?? 1) + 1;
            let atkUp = (2 + Math.floor(Math.random() * 4));
            let totalUp = 7;
            while (Math.random() < 0.335) {
                totalUp += 1;
                if (Math.random() < 0.5) atkUp += 1
            }

            if (totalUp > (data.maxStatusUp ?? 7)) data.maxStatusUp = totalUp;

            while (data.lv >= 3 && data.atk + data.def + totalUp < (data.lv - 1) * 7) {
                totalUp += 1
                if (Math.random() < 0.5) atkUp += 1
            }

            if (data.atk > 0 && data.def > 0) {
                const diff = data.atk - data.def;
                const totalrate = 0.2 + Math.min(Math.abs(diff) * 0.005, 0.3)
                const rate = (Math.pow(0.5, Math.abs(diff / 100)) * (totalrate / 2))
                if (Math.random() < (diff > 0 ? totalrate - rate : rate)) atkUp = totalUp;
                else if (Math.random() < (diff < 0 ? totalrate - rate : rate)) atkUp = 0;
            }
            data.atk = (data.atk ?? 0) + atkUp;
            data.def = (data.def ?? 0) + totalUp - atkUp;

			let addMessage = ""

			if ((data.info ?? 0) < 1 && ((100 + lv * 3) + ((data.winCount ?? 0) * 5)) >= 300) {
				data.info = 1
				addMessage += `\nもこチキの状況判断能力がアップ！\n次回から状況が細かく\n分析出来るようになる事があるぞ！`
			}

            message += [
                `\n\n今回のレベルアップ :`,
                `  Lv : ${data.lv ?? 1} (+1)`,
                `  パワー : ${data.atk ?? 0} (+${atkUp + bonus})`,
                `  防御 : ${data.def ?? 0} (+${totalUp - atkUp + bonus})`,
				addMessage,
                `\n次回は${new Date().getHours() < 12 ? "12時以降に" : new Date().getHours() < 18 ? "18時以降に" : "明日以降に"}遊べます。`,
            ].filter(Boolean).join("\n")

            msg.friend.setPerModulesData(this, data);

            // 色解禁確認
            const newColorData = colors.map((x) => x.unlock(data));
            let unlockColors = "";
            for (let i = 0; i < newColorData.length; i++) {
                if (!colorData[i] && newColorData[i]) {
                    unlockColors += colors[i].name
                }
            }
            if (unlockColors) {
                message += `\n\n条件を満たしたので、\n新しい色が解放されました！\n\n$[x2 ${unlockColors}]\n\n「RPG 色」と話しかけて確認してみてね！`
            }

            msg.reply(`<center>${message}</center>`, {
                cw,
                visibility: 'public'
            });

            return {
                reaction: me
            };
        } else {
            return false;
        }
    }

    @autobind
    private showStatus(data, php: number, ehp: number, mehp: number, me = ":mk_hero:"): string {
        const ehpGaugeCount = Math.min(Math.ceil(ehp / mehp / (1 / 7)), 7)
        const ehpGauge = data.enemy.lToR
            ? data.enemy.mark2.repeat(7 - ehpGaugeCount) + data.enemy.mark.repeat(ehpGaugeCount)
            : data.enemy.mark2.repeat(ehpGaugeCount) + data.enemy.mark.repeat(7 - ehpGaugeCount)
        const ehpInfo = data.enemy.lToR
            ? "**" + (Math.ceil((100 - Math.min(Math.ceil(ehp / mehp / (1 / 100)), 100)) / 5) * 5) + "** %？"
            : "**" + (Math.ceil((Math.min(Math.ceil(ehp / mehp / (1 / 100)), 100)) / 5) * 5) + "** %？"
        const phpGaugeCount = Math.min(Math.ceil(php / (100 + (data.lv ?? 1) * 3) / (1 / 7)), 7)
        const phpGauge = data.enemy.pLToR
            ? "★".repeat(7 - phpGaugeCount) + "☆".repeat(phpGaugeCount)
            : "★".repeat(phpGaugeCount) + "☆".repeat(7 - phpGaugeCount)
        const phpInfo = data.enemy.pLToR
            ? "**" + (Math.ceil((100 - Math.min(Math.ceil(php / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + "** %？"
            : "**" + (Math.ceil((Math.min(Math.ceil(php / (100 + (data.lv ?? 1) * 3) / (1 / 100)), 100)) / 5) * 5) + "** %？"
        const debuff = [data.enemy.fire ? "🔥" + data.count : ""].filter(Boolean).join(" ")
        if (data.enemy.pLToR) {
            return `\n${data.enemy.hpmsg ? "体力" : me} : ${data.info && (data.clearHistory ?? []).includes(data.enemy.name) ? ehpInfo : ehpGauge}\n${data.enemy.hpmsg ?? data.enemy.dname ?? data.enemy.name} : ${data.info ? phpInfo : phpGauge}${debuff ? `\n${debuff}` : ""}`
        } else {
            return `\n${data.enemy.hpmsg ?? data.enemy.dname ?? data.enemy.name} : ${data.info && (data.clearHistory ?? []).includes(data.enemy.name) ? ehpInfo : ehpGauge}\n${data.enemy.hpmsg ? "体力" : me} : ${data.info ? phpInfo : phpGauge}${debuff ? `\n${debuff}` : ""}`
        }
    }

    @autobind
    private getAtkDmg(data, atk, tp, count, crit, edef, mehp, rng = (0.2 + Math.random() * 1.6), defx?) {
        let dmg = Math.round((atk * tp * (Math.max((count ?? 1) - 1, 1) * 0.5 + 0.5) * rng * (crit ? 2 : 1)) * (1 / (((edef * (defx ?? this.getVal(data.enemy.defx, [tp]) ?? 3)) + 100) / 100)))
        if (data.fireAtk > 0) {
            dmg += Math.round((data.fireAtk) * mehp * 0.01)
            data.fireAtk = (data.fireAtk ?? 0) - 1;
        }
        return dmg;
    }

    @autobind
    private getEnemyDmg(data, def, tp, count, crit, eatk) {
        let dmg = Math.round((eatk * (this.getVal(data.enemy.atkx, [tp]) ?? 3) * (Math.max((count ?? 1) - 1, 1) * 0.5 + 0.5) * (0.2 + Math.random() * 1.6) * (crit ? 2 : 1)) * (1 / (((def * tp) + 100) / 100)))
        if (data.enemy.fire) {
            dmg += Math.round((count - 1) * (100 + data.lv * 3) * data.enemy.fire)
        }
        return dmg;
    }

    @autobind
    private getVal(val, props?) {
        if (typeof val === "function") {
            return val(...props);
        }
        return val
    }
}

import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import * as Decimal from 'break_infinity.js';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import { User } from '@/misskey/user';
import { acct } from '@/utils/acct';
import { genItem } from '@/vocabulary';
import config from '@/config';

type Game = {
    votes: {
        user: {
            id: string;
            username: string;
            host: User['host'];
            winCount: number;
        };
        number: Decimal;
    }[];
    isEnded: boolean;
    startedAt: number;
    finishedAt: number;
    winRank: number;
    postId: string;
    maxnum: Decimal;
    triggerUserId: string | undefined;
    publicOnly: boolean;
    replyKey: string[];
};

export default class extends Module {
    public readonly name = 'kazutori';

    private games: loki.Collection<Game>;

    @autobind
    public install() {
        this.games = this.ai.getCollection('kazutori');

        this.crawleGameEnd();
        setInterval(this.crawleGameEnd, 1000);
        setInterval(() => {
            const hours = new Date().getHours();
            const rnd = ((hours === 12 || (hours > 17 && hours < 24)) ? 0.5 : 0.1) * this.ai.activeFactor;
            if (Math.random() < rnd) {
                this.start();
            }
        }, 1000 * 60 * 37);

        return {
            mentionHook: this.mentionHook,
            contextHook: this.contextHook
        };
    }

    @autobind
    private async start(triggerUserId?, flg?) {

        this.ai.decActiveFactor();

        const games = this.games.find({});

        const recentGame = games.length == 0 ? null : games[games.length - 1];

        const penultimateGame = recentGame && games.length > 1 ? games[games.length - 2] : null;

        let publicOnly = false;

        // ゲーム開始条件判定
        const h = new Date().getHours();

        // 前回がお流れの場合はランダム発生のクールダウンを240分にする
        if (
            recentGame && (
                !recentGame.isEnded ||
                (
                    (h > 0 && h < 8) ||
                    (
                        Date.now() - recentGame.startedAt < 1000 * 60 *
                        (
                            (recentGame?.votes?.length ?? 2) <= 1 && !triggerUserId ? 240 : 120
                        )
                    ) && !triggerUserId
                )
            )
        ) return;

        // 最大値は(前回の参加者＋前々回の参加者/2)に50%で1を足した物
        let maxnum = new Decimal((Math.floor(((recentGame?.votes?.length || 0) + (penultimateGame?.votes?.length || 0)) / 2) + (Math.random() < 0.5 ? 1 : 0)) || 1);

        // 3%かつ開催2回目以降かつ前回がMax50以上ではない場合 Maxを50 ~ 500倍にする
        if (Math.random() < 0.03 && recentGame?.maxnum && recentGame.maxnum.lessThanOrEqualTo(50)) {
            maxnum = maxnum.times(new Decimal(50 + (Math.random() * 450)));
            maxnum = maxnum.floor();
        }
        // 2%かつ開催2回目以降かつ前回がMax1ではない場合 Max1
        else if (Math.random() < 0.02 && recentGame?.maxnum && !recentGame.maxnum.equals(1)) {
            maxnum = new Decimal(1);
        }
        // 3%かつ開催2回目以降かつ前回が無限モードではない場合 Maxを Decimal.MAX_VALUE にする
        else if ((Math.random() < 0.03 && recentGame?.maxnum && !recentGame.maxnum.equals(Decimal.MAX_VALUE)) || flg?.includes("inf")) {
            maxnum = Decimal.MAX_VALUE;
        }

        // 前回が2番目勝利モードでないかつ15%で2番目勝利モードになる
        let winRank = (recentGame?.winRank ?? 1) <= 1 && this.ai.activeFactor >= 0.5 && Math.random() < (maxnum.equals(Decimal.MAX_VALUE) ? 0.3 : 0.15) ? 2 : 1;

        // 前回が中央値勝利モードでないかつ15%で中央値勝利モードになる
        if (((recentGame?.winRank ?? 1) > 0 && this.ai.activeFactor >= 0.5 && Math.random() < (maxnum.equals(Decimal.MAX_VALUE) ? 0.3 : 0.15)) || flg?.includes("med")) {
            winRank = -1;
        }

        // 1番目勝利モードでないかつ75%で最大数値がx倍 (x = x番目勝利モード)
        if (maxnum.greaterThan(0) && winRank != 1 && Math.random() < 0.75) {
            maxnum = maxnum.times(2);
        }
        const now = new Date();

        // 今日が1/1の場合 最大値は新年の年数
        if (now.getMonth() === 0 && now.getDate() === 1) {
            maxnum = new Decimal(now.getFullYear());
        }

        let visibility;

        if (this.ai.activeFactor >= 0.85) {
            // 自然発生かつ3%の確率でフォロワー限定になる
            visibility = Math.random() < 0.03 && !triggerUserId ? 'followers' : undefined;

            if (!visibility) {
                // 投稿がフォロワー限定でない場合は、3%の確率で公開投稿のみ受付けるモードにする
                publicOnly = this.ai.activeFactor >= 0.5 && !recentGame?.publicOnly && (recentGame?.publicOnly == null || Math.random() < 0.005);
            }
        }

        // 10% → 自然発生かつ50%で1分 そうでない場合2分
        // 90% → 5分 or 10分
        let limitMinutes = Math.random() < 0.1 && this.ai.activeFactor >= 0.75 ? Math.random() < 0.5 && !triggerUserId ? 1 : 2 : Math.random() < 0.5 ? 5 : 10;

        // 機嫌が低い場合、受付時間を延長
        if (this.ai.activeFactor < 0.75) {
            limitMinutes = Math.floor(1 / (1 - Math.min((1 - this.ai.activeFactor) * 1.2 * (0.7 + Math.random() * 0.3), 0.8)) * limitMinutes / 5) * 5;
        }

        const maxnumText = maxnum.equals(Decimal.MAX_VALUE) ? "∞" : maxnum.toString();

        const post = await this.ai.post({
            text: !publicOnly ? serifs.kazutori.intro(maxnumText, limitMinutes, winRank, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)) : serifs.kazutori.introPublicOnly(maxnumText, limitMinutes, winRank, Math.ceil((Date.now() + 1000 * 60 * limitMinutes) / 1000)),
            ...(visibility ? { visibility } : {})
        });

        this.games.insertOne({
            votes: [],
            isEnded: false,
            startedAt: Date.now(),
            finishedAt: Date.now() + 1000 * 60 * limitMinutes,
            winRank,
            postId: post.id,
            maxnum: maxnum,
            triggerUserId,
            publicOnly,
            replyKey: triggerUserId ? [triggerUserId] : [],
        });

        this.subscribeReply(null, post.id);

        this.log('New kazutori game started');
    }

    @autobind
    private async mentionHook(msg: Message) {
        if (!msg.includes(['数取り'])) return false;

        const games = this.games.find({});

        const recentGame = games.length == 0 ? null : games[games.length - 1];

        let flg = "";

        if (recentGame) {
            // 現在アクティブなゲームがある場合
            if (!recentGame.isEnded) {
                msg.reply(serifs.kazutori.alreadyStarted, {
                    renote: recentGame.postId
                });
                return {
                    reaction: 'confused'
                };
            }

            const h = new Date().getHours();

            if (h > 0 && h < 8) {
                msg.reply("現在、数取り開催不可に指定されている時間です。8時から開催を受け付けます！");
                return {
                    reaction: 'hmm'
                };
            }

            // 懐き度が高いほどトリガーのクールタイムを短く
            // トリガーの公開範囲がフォロワー以下ならクールタイム２倍
            const cth = Math.max((msg.friend.love >= 200 ? 2 : msg.friend.love >= 100 ? 4 : msg.friend.love >= 20 ? 8 : msg.friend.love >= 5 ? 12 : 16) * (["public", "home"].includes(msg.visibility) ? 1 : 2), 1);

            // トリガー者が管理人でない かつ クールタイムが開けていない場合
            if ((msg.user.host || msg.user.username !== config.master) && Date.now() - recentGame.startedAt < 1000 * 60 * 60 * cth) {
                const ct = Math.ceil((60 * cth) - ((Date.now() - recentGame.startedAt) / (1000 * 60)));
                msg.reply(serifs.kazutori.matakondo(ct, Math.ceil((recentGame.startedAt + 1000 * 60 * 60 * cth) / 1000)));
                return {
                    reaction: 'hmm'
                };
            }

            if (!msg.user.host && msg.user.username === config.master && msg.includes(['inf'])) flg = "inf";
            if (!msg.user.host && msg.user.username === config.master && msg.includes(['med'])) flg += " med";
        }

        //TODO : このへんのセリフをserifに移行する
        msg.reply("\n分かりました！数取りを開催します！\nあなたは開催1分後から数取りへの投票を行うことができます！\n（ダイレクトなら今すぐでも大丈夫です！）", { visibility: 'specified' }).then(reply => {
            this.subscribeReply(msg.userId, reply.id);
        });

        this.start(msg.user.id, flg);

        return {
            reaction: 'love'
        };
    }

    @autobind
    private async contextHook(key: any, msg: Message) {
        if (msg.text == null) return {
            reaction: 'hmm'
        };

        const game = this.games.findOne({
            isEnded: false
        });

        // 処理の流れ上、実際にnullになることは無さそうだけど一応
        if (game == null) return;

        // 数取りトリガー者で、開始から1分以内の場合
        const time = Date.now() - game.startedAt;
        if (game.triggerUserId === msg.user.id && time < 60 * 1000 && msg.visibility !== 'specified') {
            msg.reply(`\n${60 - Math.floor(time / 1000)}秒後にもう一度送ってください！`, { visibility: 'specified' }).then(reply => {
                game.replyKey.push(msg.userId);
                this.games.update(game);
                this.subscribeReply(msg.userId, reply.id);
            });
            return { reaction: '❌' };
        }

        // 公開投稿限定モードで公開投稿じゃない場合
        if (game.publicOnly && ((msg.visibility != 'public' && msg.visibility != 'home') || msg.localOnly)) {
            const visibility =
                msg.visibility == 'followers' ? "フォロワー限定" :
                    msg.visibility == 'specified' ? "ダイレクト" :
                        msg.user.host == null ? `ローカル＆フォロワー` : "";

            msg.reply(`\n公開投稿限定です！\n参加するには${visibility ? "「" + visibility + "」ではなく、" : ""}「公開」または「ホーム」の公開範囲にてリプライしてくださいね～`).then(reply => {
                game.replyKey.push(msg.userId);
                this.games.update(game);
                this.subscribeReply(msg.userId, reply.id);
            });
            return {
                reaction: 'confused'
            };
        }

        // 既に数字を取っていたら
        if (game.votes.some(x => x.user.id == msg.userId)) {
            msg.reply('すでに投票済みの様です！').then(reply => {
                game.replyKey.push(msg.userId);
                this.games.update(game);
                this.subscribeReply(msg.userId, reply.id);
            });
            return {
                reaction: 'confused'
            };
        }

        let num: Decimal;

        // 数字が含まれていない
        const match = msg.extractedText.replace(/[０-９]/g, m => '０１２３４５６７８９'.indexOf(m).toString()).match(/[0-9]+|∞/);
        if (match == null) {
            msg.reply('リプライの中に数字が見つかりませんでした！').then(reply => {
                game.replyKey.push(msg.userId);
                this.games.update(game);
                this.subscribeReply(msg.userId, reply.id);
            });
            return {
                reaction: 'hmm'
            };
        }

        if (match[0] === '∞') {
            num = new Decimal(Decimal.NUMBER_MAX_VALUE);
        } else {
            num = new Decimal(match[0]);
        }

        // 整数じゃない
        if (!num.equals(num.floor())) {
            msg.reply('リプライの中に整数が見つかりませんでした！').then(reply => {
                game.replyKey.push(msg.userId);
                this.games.update(game);
                this.subscribeReply(msg.userId, reply.id);
            });
            return {
                reaction: 'hmm'
            };
        }

        // 範囲外
        if (game.maxnum.greaterThan(0) && (num.lessThan(0) || num.greaterThan(game.maxnum))) {
            let strn = num.equals(new Decimal(Decimal.NUMBER_MAX_VALUE)) ? '∞' : num.toString();
            let maxStr = game.maxnum.equals(Decimal.MAX_VALUE) ? '∞' : game.maxnum.toString();
            msg.reply(`\n「${strn}」は今回のゲームでは範囲外です！\n0~${maxStr}の範囲で指定してくださいね！`).then(reply => {
                game.replyKey.push(msg.userId);
                this.games.update(game);
                this.subscribeReply(msg.userId, reply.id);
            });
            return {
                reaction: 'confused'
            };
        }

        this.log(`Voted ${num.toString()} by ${msg.user.id}`);

        // 投票
        game.votes.push({
            user: {
                id: msg.user.id,
                username: msg.user.username,
                host: msg.user.host,
                winCount: msg.friend?.doc?.kazutoriData?.winCount ?? 0,
            },
            number: num
        });

        this.games.update(game);

        if (msg.friend?.doc) {
            if (msg.friend.doc.kazutoriData) {
                msg.friend.doc.kazutoriData.playCount += 1;
                msg.friend.doc.kazutoriData.rate = (msg.friend.doc.kazutoriData.rate ?? 0) - 1;
            } else {
                msg.friend.doc.kazutoriData = { winCount: 0, playCount: 1, rate: -1, inventory: [] };
            }
            msg.friend.save();
        }

        return {
            reaction: ':mk_discochicken:'
        };
    }

    /**
     * 終了すべきゲームがないかチェック
     */
    @autobind
    private crawleGameEnd() {
        const game = this.games.findOne({
            isEnded: false
        });

        if (game == null) return;

        // 制限時間が経過していたら
        if (Date.now() - (game.finishedAt ?? game.startedAt + 1000 * 60 * 10) >= 0) {
            this.finish(game);
        }
    }

    /**
     * ゲームを終わらせる
     */
    @autobind
    private finish(game: Game) {
        game.isEnded = true;
        this.games.update(game);

        this.log('Kazutori game finished');

        const item = genItem();

        const medal = game.votes?.length > 1 && game.votes?.filter((x) => x.user.winCount < 50).length < game.votes?.filter((x) => x.user.winCount >= 50).length;

        // お流れ
        if (game.votes?.filter((x) => x.user.winCount < 50).length <= 1 && !medal) {
            game.votes.forEach((x) => {
                const friend = this.ai.lookupFriend(x.user.id);
                if (friend) {
                    friend.doc.kazutoriData.playCount -= 1;
                    friend.doc.kazutoriData.rate = (friend.doc.kazutoriData.rate ?? 0) + 1;
                    friend.save();
                }
            });
            this.ai.decActiveFactor((game.finishedAt.valueOf() - game.startedAt.valueOf()) / (60 * 1000 * 100) * Math.max(1 - (game.votes.length / 3), 0));

            if (this.ai.activeFactor < 0.5 || game.votes.length < 1) return;

            this.ai.post({
                text: serifs.kazutori.onagare(item),
                renoteId: game.postId
            });

            return;
        }

        let results: string[] = [];
        let winner: Game['votes'][0]['user'] | null = null;
        let reverseResults: string[] = [];
        let reverseWinner: Game['votes'][0]['user'] | null = null;

        let winRank = game.winRank ?? 1;
        let reverseWinRank = game.winRank ?? 1;

        let reverse = Math.random() < (winRank === 1 ? 0.15 : 0.3);
        const now = new Date();

        let useNumbers = Array.from(new Set(game.votes.map((x) => x.number.toString()))).map(s => new Decimal(s));
        // 降順ソート
        useNumbers.sort((a, b) => {
            if (a.greaterThan(b)) return -1;
            if (a.lessThan(b)) return 1;
            return 0;
        });

        let med;

        if (winRank === -1) {
            function median(arr: Decimal[]) {
                // 昇順ソート
                let inOrderArr = arr.slice().sort((a, b) => {
                    if (a.lessThan(b)) return -1;
                    if (a.greaterThan(b)) return 1;
                    return 0;
                });
                let result: Decimal;
                if (inOrderArr.length % 2 === 0) {
                    result = inOrderArr[inOrderArr.length / 2 - 1].plus(inOrderArr[inOrderArr.length / 2]).dividedBy(2);
                } else {
                    result = inOrderArr[(inOrderArr.length + 1) / 2 - 1];
                }
                return result;
            }
            med = median(useNumbers.filter((n) => {
                const users = game.votes
                    .filter(x => x.number.equals(n))
                    .map(x => x.user);
                return users.length == 1;
            }));
        }

        // 正常
        for (let i = 0; i < useNumbers.length; i++) {
            const n = useNumbers[i];
            let strn = n.equals(new Decimal(Decimal.NUMBER_MAX_VALUE)) ? '∞' : n.toString();
            if (strn.includes("e+")) {
                if (strn == "Infinity") strn = "∞";
                strn = strn.replace(/^1e/, "");
                strn = strn.replace("e", "×");
                strn = strn.replace("+", "10^{");
                strn += "}\\)";
                strn = "\\(" + strn;
            }
            const users = game.votes
                .filter(x => x.number.equals(n))
                .map(x => x.user);

            if (users.length == 1) {
                if (winner == null) {
                    if (winRank == -1) {
                        if (n.equals(med)) {
                            winner = users[0];
                            const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
                            results.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
                        } else {
                            results.push(`➖ ${strn}: ${acct(users[0])}`);
                        }
                    } else if (winRank > 1) {
                        winRank -= 1;
                        results.push(`➖ ${strn}: ${acct(users[0])}`);
                    } else {
                        winner = users[0];
                        const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
                        results.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
                    }
                } else {
                    results.push(`➖ ${strn}: ${acct(users[0])}`);
                }
            } else if (users.length > 1) {
                results.push(`❌ ${strn}: ${users.map(u => acct(u)).join(' ')}`);
            }
        }
        if (winRank != -1) {
            // 昇順ソート
            useNumbers.sort((a, b) => {
                if (a.lessThan(b)) return -1;
                if (a.greaterThan(b)) return 1;
                return 0;
            });
            // 反転
            for (let i = 0; i < useNumbers.length; i++) {
                const n = useNumbers[i];
                let strn = n.equals(new Decimal(Decimal.NUMBER_MAX_VALUE)) ? '∞' : n.toString();
                if (strn.includes("e+")) {
                    if (strn == "Infinity") strn = "∞";
                    strn = strn.replace(/^1e/, "");
                    strn = strn.replace("e", "×");
                    strn = strn.replace("+", "10^{");
                    strn += "}\\)";
                    strn = "\\(" + strn;
                }
                const users = game.votes
                    .filter(x => x.number.equals(n))
                    .map(x => x.user);

                if (users.length == 1) {
                    if (reverseWinner == null) {
                        if (reverseWinRank > 1) {
                            reverseWinRank -= 1;
                            reverseResults.push(`➖ ${strn}: ${acct(users[0])}`);
                        } else {
                            reverseWinner = users[0];
                            const icon = n.equals(100) ? '💯' : n.equals(0) ? '0️⃣' : '🎉';
                            reverseResults.push(`${icon} **${strn}**: $[jelly ${acct(users[0])}]`);
                        }
                    } else {
                        reverseResults.push(`➖ ${strn}: ${acct(users[0])}`);
                    }
                } else if (users.length > 1) {
                    reverseResults.push(`❌ ${strn}: ${users.map(u => acct(u)).join(' ')}`);
                }
            }
        } else {
            reverseResults = results;
            reverseWinner = winner;
        }

        if (!medal) {
            const winDiff = (Math.min(winner?.winCount ?? 0, 50)) - (Math.min(reverseWinner?.winCount ?? 0, 50));
            if (!reverse && winner && winDiff > 10 && Math.random() < Math.min((winDiff - 10) * 0.02, 0.7)) {
                reverse = !reverse;
            } else if (reverse && reverseWinner && winDiff < -10 && Math.random() < Math.min((winDiff + 10) * -0.02, 0.7)) {
                reverse = !reverse;
            }
        }

        let perfect = false;

        //そのままでも反転しても結果が同じの場合は反転しない
        if ((!winner || !reverseWinner) || winner?.id === reverseWinner?.id) {
            perfect = winRank != -1;
            reverse = false;
        }

        if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

        if (reverse) {
            results = reverseResults;
            winner = reverseWinner;
        }

        if (now.getMonth() === 3 && now.getDate() === 1) reverse = !reverse;

        const winnerFriend = winner?.id ? this.ai.lookupFriend(winner.id) : null;
        const name = winnerFriend ? winnerFriend.name : null;

        if (winnerFriend) {
            if (winnerFriend.doc.kazutoriData.winCount != null) {
                winnerFriend.doc.kazutoriData.winCount += 1;
                winnerFriend.doc.kazutoriData.rate += game.votes.length;
            } else {
                winnerFriend.doc.kazutoriData = { winCount: 1, playCount: 1, rate: game.votes.length, inventory: [] };
            }
            if (medal && winnerFriend.doc.kazutoriData.winCount > 50) {
                winnerFriend.doc.kazutoriData.medal = (winnerFriend.doc.kazutoriData.medal || 0) + 1;
            }
            if (winnerFriend.doc.kazutoriData.inventory) {
                if (winnerFriend.doc.kazutoriData.inventory.length >= 50) winnerFriend.doc.kazutoriData.inventory.shift();
                winnerFriend.doc.kazutoriData.inventory.push(item);
            } else {
                winnerFriend.doc.kazutoriData.inventory = [item];
            }
            winnerFriend.save();
        }

        let strmed = med != null ? med.equals(new Decimal(Decimal.NUMBER_MAX_VALUE)) ? '∞' : med.toString() : "";
        if (strmed.includes("e+")) {
            if (strmed == "Infinity") strmed = "∞";
            strmed = strmed.replace(/^1e/, "");
            strmed = strmed.replace("e", "×");
            strmed = strmed.replace("+", "10^{");
            strmed += "}\\)";
            strmed = "\\(" + strmed;
        }
        const maxnumText = game.maxnum.equals(Decimal.MAX_VALUE) ? '∞' : game.maxnum.toString();
        const text = (game.winRank > 0 ? game.winRank === 1 ? "" : "勝利条件 : " + game.winRank + "番目に大きい値\n\n" : "勝利条件 : 中央値 (" + strmed + ")\n\n") + results.join('\n') + '\n\n' + (winner
            ? serifs.kazutori.finishWithWinner(acct(winner), name, item, reverse, perfect, winnerFriend?.doc?.kazutoriData?.winCount ?? 0, medal && (winnerFriend?.doc?.kazutoriData?.winCount ?? 0) > 50 ? winnerFriend?.doc?.kazutoriData?.medal ?? 0 : null)
            : serifs.kazutori.finishWithNoWinner(item));

        this.ai.post({
            text: text,
            cw: serifs.kazutori.finish,
            renoteId: game.postId
        });

        this.unsubscribeReply(null);
        game.replyKey.forEach((x) => this.unsubscribeReply(x));
    }
}

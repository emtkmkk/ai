import Message from "@/message";
import Module from "@/module";
import serifs from "@/serifs";
import { colors } from './colors';

export const colorReply = (module: Module, msg: Message) => {

    // データを読み込み
    const data = msg.friend.getPerModulesData(module);
    if (!data) return false;

    if (msg.includes([serifs.rpg.command.change])) {
        // 文字数が多い物を先に判定
        const sortedColors = colors.sort((a,b) => b.keyword.length - a.keyword.length)
        for (let i = 0; i < sortedColors.length; i++) {
            if (msg.includes([sortedColors[i].keyword])) {
                if (sortedColors[i].unlock(data)) {
                    data.color = sortedColors[i].id
                    msg.friend.setPerModulesData(module, data);
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
        serifs.rpg.color.info,
        "",
        serifs.rpg.color.list,
        ...colors.filter((x) => !x.hidden || x.unlock(data)).map((x) => `${x.keyword}: ${x.name} ${x.message(data)}`)
    ].join("\n"));

    return {
        reaction: 'love'
    };

}

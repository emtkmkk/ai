export function calculateStats(data, msg, skillEffects, color) {
    const stbonus = (((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) + ((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0))) / 2;
    let atk = Math.max(5 + (data.atk ?? 0) + Math.floor(stbonus * ((100 + (data.atk ?? 0)) / 100)), 15);
    let def = Math.max(5 + (data.def ?? 0) + Math.floor(stbonus * ((100 + (data.def ?? 0)) / 100)), 15);
    let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;

    if (color.reverseStatus) {
        const _atk = atk;
        atk = def;
        def = _atk;
    }

    atk *= (1 + (skillEffects.atkUp ?? 0));
    def *= (1 + (skillEffects.defUp ?? 0));

    return { atk, def, spd };
}



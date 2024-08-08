import serifs from "@/serifs";

export function calculateStats(data, msg, skillEffects, color, maxBonus = 100) {
	const stbonus = (((Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3)) + (msg.friend.doc.kazutoriData?.medal ?? 0)) + ((Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7)) + (msg.friend.doc.kazutoriData?.medal ?? 0))) / 2;
	let atk = Math.max(5 + (data.atk ?? 0) + Math.floor(Math.min(stbonus * ((100 + (data.atk ?? 0)) / 100), (data.atk ?? 0) * maxBonus)), 10);
	let def = Math.max(5 + (data.def ?? 0) + Math.floor(Math.min(stbonus * ((100 + (data.def ?? 0)) / 100), (data.def ?? 0) * maxBonus)), 10);
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

export function fortune(_atk, _def, effect = 1) {

	let atk = _atk;
	let def = _def;

	const rnd = Math.random;

	if (effect % 1 !== 0) {
		atk = Math.floor(atk * (1 + ((effect % 1) * 0.1)));
		def = Math.floor(def * (1 + ((effect % 1) * 0.1)));
		effect = effect % 1;
	}

	for (let i = 0; i < effect; i++) {

		atk = Math.floor(atk * 1.05);
		def = Math.floor(def * 1.05);

		let targetAllStatus = rnd() < 0.2;

		if (rnd() < 0.5) {
			if (rnd() < 0.5) {
				atk = Math.floor(atk * 1.01);
				def = Math.floor(def * 1.01);
			} else {
				if (targetAllStatus) {
					atk = Math.floor(atk * 1.02);
					def = Math.floor(def * 1.02);
					const a = Math.floor(atk);
					const d = Math.floor(def);
					atk = Math.floor((a + d) / 2);
					def = Math.floor((a + d) / 2);
				} else {
					const a = Math.floor(atk * 0.6);
					const d = Math.floor(def * 0.6);
					atk = atk - a + Math.floor((a + d) / 2);
					def = def - d + Math.floor((a + d) / 2);
				}
			}
		} else {
			if (rnd() < 0.5) {
				if (targetAllStatus) {
					atk = Math.floor(atk * 1.02);
					def = Math.floor(def * 1.02);
					if (rnd() < 0.5) {
						def = def + atk - 1;
						atk = 1;
					} else {
						atk = atk + def;
						def = 0;
					}
				} else {
					const a = Math.floor(atk * 0.3);
					const d = Math.floor(def * 0.3);
					if (rnd() < 0.5) {
						atk = atk - a;
						def = def + a;
					} else {
						atk = atk + d;
						def = def - d;
					}
				}
			} else {
				const a = atk;
				atk = def;
				def = a;
			}
		}
	}


	const atkDiff = Math.floor(atk - _atk);
	const defDiff = Math.floor(def - _def);

	const message = [
		`${serifs.rpg.status.atk} : ${atk ?? 0}${atkDiff !== 0 ? ` (${atkDiff > 0 ? "+" + atkDiff : atkDiff})` : ""}`,
		`${serifs.rpg.status.def} : ${def ?? 0}${defDiff !== 0 ? ` (${defDiff > 0 ? "+" + defDiff : defDiff})` : ""}`,
	].filter(Boolean).join("\n");

	return { atk, def, message };
}

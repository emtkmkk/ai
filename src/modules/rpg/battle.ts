import serifs from '@/serifs';
import { SkillEffect } from './skills';
import { aggregateTokensEffects } from './shop';

export function calculateStats(data, msg, skillEffects, color, maxBonus = 100) {
  const stbonus =
    (Math.floor((msg.friend.doc.kazutoriData?.winCount ?? 0) / 3) +
      (msg.friend.doc.kazutoriData?.medal ?? 0) +
      (Math.floor((msg.friend.doc.kazutoriData?.playCount ?? 0) / 7) +
        (msg.friend.doc.kazutoriData?.medal ?? 0))) /
    2;
  let atk = Math.max(
    5 +
      (data.atk ?? 0) +
      Math.floor(
        Math.min(
          stbonus * ((100 + (data.atk ?? 0)) / 100),
          (data.atk ?? 0) * maxBonus,
        ),
      ),
    10,
  );
  let def = Math.max(
    5 +
      (data.def ?? 0) +
      Math.floor(
        Math.min(
          stbonus * ((100 + (data.def ?? 0)) / 100),
          (data.def ?? 0) * maxBonus,
        ),
      ),
    10,
  );
  let spd = Math.floor((msg.friend.love ?? 0) / 100) + 1;

  if (data.maxSpd < spd) data.maxSpd = spd;

  if (spd < 5 && aggregateTokensEffects(data).fivespd) {
    spd = 5;
  }

  if (color.reverseStatus) {
    const _atk = atk;
    atk = def;
    def = _atk;
  }

  atk *=
    1 +
    (skillEffects.atkUp ?? 0) +
    (data.items?.some((y) => y.type === 'amulet')
      ? 0
      : (skillEffects.noAmuletAtkUp ?? 0));
  def *= 1 + (skillEffects.defUp ?? 0);

  atk *= 1 + (data.atkMedal ?? 0) * 0.01;

  return { atk, def, spd };
}

export function fortune(_atk, _def, effect = 0) {
  let atk = _atk;
  let def = _def;

  const zeroEffect = effect === 0;

  if (zeroEffect) effect = 1;

  const rnd = Math.random;

  if (effect % 1 !== 0) {
    atk = Math.floor(atk * (1 + (effect % 1) * 0.1));
    def = Math.floor(def * (1 + (effect % 1) * 0.1));
    effect = Math.floor(effect);
  }

  for (let i = 0; i < effect; i++) {
    if (!zeroEffect) {
      atk = Math.floor(atk * 1.05);
      def = Math.floor(def * 1.05);
    }

    let targetAllStatus = rnd() < 0.2;

    if (rnd() < 0.5) {
      if (rnd() < 0.5) {
        if (!zeroEffect) {
          atk = Math.floor(atk * 1.01);
          def = Math.floor(def * 1.01);
        }
      } else {
        if (targetAllStatus) {
          if (!zeroEffect) {
            atk = Math.floor(atk * 1.02);
            def = Math.floor(def * 1.02);
          }
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
          if (!zeroEffect) {
            atk = Math.floor(atk * 1.02);
            def = Math.floor(def * 1.02);
          }
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
    `${serifs.rpg.status.atk} : ${atk ?? 0}${atkDiff !== 0 ? ` (${atkDiff > 0 ? '+' + atkDiff : atkDiff})` : ''}`,
    `${serifs.rpg.status.def} : ${def ?? 0}${defDiff !== 0 ? ` (${defDiff > 0 ? '+' + defDiff : defDiff})` : ''}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { atk, def, message };
}

export function stockRandom(data, skillEffects) {
  let activate = false;

  if (skillEffects?.stockRandomEffect) {
    const probability = Math.min(data.stockRandomCount * 0.012, 0.12);

    if (Math.random() < probability) {
      activate = true;
      let effectPoint =
        data.stockRandomCount > 5
          ? 20 + (data.stockRandomCount - 5) * 2
          : data.stockRandomCount * 4;
      let attackUpFlg = false;
      if (!data.maxStock || data.maxStock < data.stockRandomCount)
        data.maxStock = data.stockRandomCount;
      data.stockRandomCount = 0;
      const effects: { limit: boolean; effect: () => void }[] = [
        {
          limit: !attackUpFlg,
          effect: () => {
            skillEffects.atkDmgUp =
              (skillEffects.atkDmgUp ?? 0) + Math.min(effectPoint / 100, 0.35);
            effectPoint -= Math.min(effectPoint, 35);
            attackUpFlg = true;
          },
        },
        {
          limit: true,
          effect: () => {
            skillEffects.defDmgUp =
              (skillEffects.defDmgUp ?? 0) - Math.min(effectPoint / 100, 0.35);
            effectPoint -= Math.min(effectPoint, 35);
          },
        },
        {
          limit: !attackUpFlg,
          effect: () => {
            skillEffects.fire =
              (skillEffects.fire ?? 0) + Math.min(effectPoint / 800, 0.1);
            skillEffects.ice =
              (skillEffects.ice ?? 0) + Math.min(effectPoint / 800, 0.1);
            skillEffects.thunder =
              (skillEffects.thunder ?? 0) + Math.min(effectPoint / 400, 0.2);
            skillEffects.spdUp =
              (skillEffects.spdUp ?? 0) + Math.min(effectPoint / 800, 0.1);
            skillEffects.dart =
              (skillEffects.dart ?? 0) + Math.min(effectPoint / 400, 0.2);
            skillEffects.light =
              (skillEffects.light ?? 0) + Math.min(effectPoint / 400, 0.2);
            skillEffects.dark =
              (skillEffects.dark ?? 0) + Math.min(effectPoint / 800, 0.1);
            skillEffects.weak =
              (skillEffects.weak ?? 0) + Math.min(effectPoint / 1333, 0.06);
            effectPoint -= Math.min(effectPoint, 80);
            attackUpFlg = true;
          },
        },
        {
          limit: !attackUpFlg,
          effect: () => {
            skillEffects.itemEquip =
              (skillEffects.itemEquip ?? 0) + Math.min(effectPoint / 60, 1);
            skillEffects.itemBoost =
              (skillEffects.itemBoost ?? 0) + Math.min(effectPoint / 60, 1);
            skillEffects.mindMinusAvoid =
              (skillEffects.mindMinusAvoid ?? 0) +
              Math.min((effectPoint / 60) * 0.3, 0.3);
            skillEffects.poisonAvoid =
              (skillEffects.poisonAvoid ?? 0) +
              Math.min((effectPoint / 60) * 0.8, 0.8);
            effectPoint -= Math.min(effectPoint, 60);
            attackUpFlg = true;
          },
        },
        {
          limit: !attackUpFlg,
          effect: () => {
            skillEffects.critUp =
              (skillEffects.critUp ?? 0) +
              Math.min((effectPoint / 30) * 0.8, 0.8);
            skillEffects.critUpFixed =
              (skillEffects.critUpFixed ?? 0) +
              Math.min((effectPoint / 30) * 0.09, 0.12);
            skillEffects.critDmgUp =
              (skillEffects.critDmgUp ?? 0) +
              Math.min((effectPoint / 30) * 0.8, 0.8);
            effectPoint -= Math.min(effectPoint, 40);
            attackUpFlg = true;
          },
        },
        {
          limit: skillEffects.tenacious <= 0.15,
          effect: () => {
            skillEffects.tenacious =
              (skillEffects.tenacious ?? 0) + Math.min(effectPoint / 40, 0.75);
            effectPoint -= Math.min(effectPoint, 30);
          },
        },
        {
          limit: skillEffects.firstTurnResist <= 1.4,
          effect: () => {
            skillEffects.firstTurnResist =
              (skillEffects.firstTurnResist ?? 0) +
              Math.min((effectPoint / 20) * 0.6, 0.6);
            effectPoint -= Math.min(effectPoint, 20);
          },
        },
        {
          limit: true,
          effect: () => {
            skillEffects.endureUp =
              (skillEffects.endureUp ?? 0) + Math.min(effectPoint / 20, 1);
            effectPoint -= Math.min(effectPoint, 20);
          },
        },
        {
          limit: skillEffects.firstTurnItem < 1 && effectPoint >= 10,
          effect: () => {
            skillEffects.firstTurnItem = 1;
            skillEffects.firstTurnMindMinusAvoid = 1;
            effectPoint -= Math.min(effectPoint, 10);
          },
        },
        {
          limit:
            !skillEffects.atkRndMin &&
            !skillEffects.atkRndMax &&
            effectPoint >= 10,
          effect: () => {
            skillEffects.atkRndMin = 0.5;
            skillEffects.atkRndMax = -0.5;
            effectPoint -= Math.min(effectPoint, 10);
          },
        },
        {
          limit:
            !attackUpFlg && !skillEffects.atkRndMin && !skillEffects.atkRndMax,
          effect: () => {
            skillEffects.atkRndMax = Math.min((effectPoint / 35) * 0.7, 0.7);
            effectPoint -= Math.min(effectPoint, 35);
            attackUpFlg = true;
          },
        },
        {
          limit: !skillEffects.defRndMin && !skillEffects.defRndMax,
          effect: () => {
            skillEffects.defRndMax = Math.min((effectPoint / 35) * -0.7, -0.7);
            effectPoint -= Math.min(effectPoint, 35);
            attackUpFlg = true;
          },
        },
        {
          limit: !skillEffects.defRndMin && !skillEffects.defRndMax,
          effect: () => {
            skillEffects.defRndMax = Math.min((effectPoint / 35) * -0.7, -0.7);
            effectPoint -= Math.min(effectPoint, 35);
            attackUpFlg = true;
          },
        },
        {
          limit:
            !skillEffects.notRandom &&
            !aggregateTokensEffects(data).notRandom &&
            effectPoint >= 10,
          effect: () => {
            skillEffects.notRandom = 1;
            effectPoint -= Math.min(effectPoint, 10);
          },
        },
        {
          limit: skillEffects.charge,
          effect: () => {
            data.charge = (data.charge ?? 0) + Math.min(effectPoint / 10, 1);
            effectPoint -= Math.min(effectPoint, 10);
          },
        },
        {
          limit: true,
          effect: () => {
            skillEffects.escape =
              (skillEffects.escape ?? 0) + Math.min((effectPoint / 20) * 2, 2);
            effectPoint -= Math.min(effectPoint, 20);
          },
        },
      ];
      while (effectPoint > 0) {
        const filterEffects = effects.filter((x) => x.limit);
        filterEffects[
          Math.floor(Math.random() * filterEffects.length)
        ].effect();
      }
    } else {
      data.stockRandomCount = (data.stockRandomCount ?? 0) + 1;
    }
  }

  return {
    activate,
    skillEffects,
  };
}

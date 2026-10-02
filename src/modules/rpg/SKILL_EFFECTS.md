# スキル効果 実挙動一覧

`skills.ts` の `SkillEffect` の各キーが、**実際にコード上でどう処理されているか**をモード別にまとめたもの。
スキルの `info` 文言や効果表示ではなく、コードの挙動を正とする。

- 調査時点: 2026-10-02（commit 70ffda41）。その後の修正は「要確認リスト」の対応欄を参照
- 「通常」= `index.ts` `handleNormalCommands`、「レイド」= `raid.ts` `getTotalDmg`（pattern 1）、「表示」= `skills.ts` `getTotalEffectString`

## 効果の流れ

```
skills.ts  スキル定義 (effect) ─┐
shop*.ts   お守り定義 (effect) ─┼─▶ aggregateSkillsEffects(data)        ← 合算・曜日補正・上限処理
ultimateEffect                  ─┘    aggregateSkillsEffectsSkillX(data, x) ← ほぼコピー（後述）
                                          │
          ┌───────────────┬─────────────┼───────────────┬──────────────────┐
          ▼               ▼             ▼               ▼                  ▼
    通常戦闘         レイド(通常)    レイド(コンテスト)  木人(trial)        効果表示
 index.ts:1490    raid.ts:1017     raid.ts:3279      index.ts:1308     skills.ts:1096
  約1400行          約1950行        独自の器用さ計算     期待値の概算        レイド前提の概算
```

効果を参照するロジックは、上の各ファイルに**個別に書かれている**。共通化されているのは
`battle.ts` の `calculateStats`（atkUp/defUp/noAmuletAtkUp の適用）、`stockRandom`、数取りの達人系、
`utils.ts` の `random`（notRandom/charge）、`getAtkDmg` / `getEnemyDmg` だけ。
じゃんけん型レイド（`getTotalDmg2`）はスキル効果を一切参照しない。

---

## 要確認リスト

コードを読んで見つかった、**意図か不具合か判断が必要なもの**。上ほど影響が大きい。
「場所」の行番号は調査時点のもの。

| # | 内容 | 場所 | 影響 | 対応 |
|---|---|---|---|---|
| 1 | **レイドで水属性・決死の覚悟の与ダメージ補正がほぼ効かない**。`1 + atkDmgUp * dmgUp` になっていて、`dmgUp`（水・覚悟与ダメ）が `atkDmgUp` の部分にしか掛からない。与ダメージアップ系スキルが無いと完全に無効。通常戦闘は `(1 + atkDmgUp) * dmgUp` で正しく効いている | raid.ts:2521 | 水属性剣攻撃（対炎敵 +18%）、すぐ決死の覚悟（覚悟時 +5%）がレイドで実質無効。verbose ログには「水スキル効果: 与ダメージ+18%」と出る | ✅ 修正済み（通常と同じ `(1+atkDmgUp)×dmgUp` に） |
| 2 | **傲慢の力の「被ダメ2倍」が先制攻撃では HP に反映されない**。先制攻撃は HP を減らした**後**に `dmg *= 2` している（敵ターン側は減らす前で正しい） | raid.ts:2415→2421 | 先制攻撃での被ダメ2倍デメリットが発生しない | ✅ 修正済み（HP を減らす前に2倍） |
| 3 | **通常戦闘で高速RPG（plusActionX）時に一部効果が二重がけ**。通常戦闘は `actionX` ループの中で atk/def をリセットしないため、ループ内の「非戦闘時の変換」（土・炎→パワー、氷・光・闇→防御）、攻めの守勢、毒の貫通、遂の変換が2回目の行動で重複して掛かる。レイドは毎ターン `_atk` からリセットしているので重複しない | index.ts:2339 のループ内（2355-2412, 2597-2628） | 高速RPG / 究極のお守り所持者の2ターン目が想定より強い | ✅ 修正済み（行動ごとに atk/def/spd/敵atk をループ前の値に戻す） |
| 4 | **炎属性の Lv 上限処理が通常とレイドで逆**。通常: 戦闘時 `lv`・非戦闘時 `min(lv,255)`。レイド: 戦闘時 `min(lv,255)`・非戦闘時 `lv`。表示はレイドと同じ | index.ts:2372,2375 / raid.ts:2312,2319 | Lv255超（旅モード）でモード間の効果量が変わる | ✅ レイドに統一（固定ダメージは `min(lv,255)`、パワー換算は `lv`）|
| 5 | **`aggregateSkillsEffectsSkillX` に水属性の処理が無い**。氷・雷の強化と、水曜・虹の水強化が抜けている。他の部分は `aggregateSkillsEffects` のコピー | skills.ts:849 | skillX 付きレイドと、skillX>1 の効果表示で水の効果が消える | 未対応（集計関数の統合時に対応予定） |
| 6 | **罪のお守り（傲慢・強欲・憤怒・暴食・怠惰）が通常戦闘で何もしない**。説明文にレイド限定とは書いていない（嫉妬だけはレイドと明記） | raid.ts のみ | 通常戦闘では装備しても無効果 | ✅ 説明文に「レイド時」を追記。罪スキルなどレイド専用スキル（`raidOnly`）だけのお守りは、通常戦闘で耐久が減らないように |
| 7 | **罪スキル系の effect 値が使われていない**。pride 0.15 / gluttony 0.2 / sloth 0.5 / wrath 0.4 / greed 0.5 は真偽値としてしか見ておらず、倍率はコードに直書き（1.15, 1.1/1.2, 1.5, 0.4, 2/3） | raid.ts 各所 | お守り整備・skillX による強化が乗らない | 未対応 |
| 8 | **敵のクリティカル性能減少: レイドの防御ボーナスが説明と違う**。info「レイド時は追加で防御+10%」→ コードは `enemyCritDmgDown / 30` = **+1.3%** | raid.ts:1731 / skills.ts:349 | 説明と10倍近い差 | ✅ 説明文に合わせて `/4`（+10%）に |
| 9 | **闇属性: 非戦闘時の防御ボーナスが説明と違う**。info「防御+6.3%」（闇＋は+10.5%）＝ dark×0.7 → コードは dark×**0.3**（+2.7% / +4.5%） | index.ts:2627 / raid.ts:2617 | 説明の半分以下 | ✅ 説明文に合わせて dark×0.7 に |
| 10 | **攻めの守勢: 上限が説明と違う**。info「防御の12.5~40%分」→ コードは 0.125×[1, 2.4, 4.8, 8] = **12.5%〜100%** | index.ts:2383 / raid.ts:1871 | 説明より最大2.5倍強い | ✅ コードに合わせて説明文を修正 |
| 11 | **雷属性の掛かり方がモードで違う**。通常: 与ダメ倍率に**乗算**。レイド: 与ダメ倍率に**加算**し、さらに多段減衰（turnDmgX）の外にあるので、3hit目以降は雷の比重が大きくなる | index.ts:2491 / raid.ts:2521 | 意図的かどうか不明 | ✅ 通常戦闘と同じく、段数による減衰の内側で乗算するよう修正 |
| 12 | **`statusBonus` / `loseBonus` / `lust` は付与元が存在しない**。参照コードだけ残っている（statusBonus は通常戦闘とレイドで処理内容も違う：通常は atk/def の振り分けだけ、レイドは合計も増える） | index.ts:2753 / raid.ts:2896 | デッドコード | 未対応 |
| 13 | **投稿数固定の敵 × 覚醒 × 投稿数ボーナス量アップでマイナス補正**。投稿数固定時は覚醒の+200が投稿数に足されないのに、補正式は `postCount - superBonusPost` を引くので負になる | raid.ts:1095 | 該当の敵で投スキル持ちが弱体化 | ✅ 修正済み |
| 14 | **先制攻撃が取りやめになっても、７フィーバーのバリアと炎上スタックが消費・加算される**（判定より前に処理している）| raid.ts:2385-2410 | バリアが無駄に減る | ✅ 修正済み |
| 15 | **複数スキルのお守りで、同じ効果キーを持つスキル同士が加算されず上書きされる**（`{ ...acc, ...skill.effect }`）| shop.ts `mergeSkillAmulet` / shop-custom.ts | 組み合わせ次第で片方の効果が消える | ✅ 加算するよう修正（`mergeSkillEffects`）|

---

## 効果ごとの実挙動

凡例: ✅ 同じ処理 / ⚠ モードで違う（意図的かも）/ ❌ 不具合の疑い（上の表の番号） / － 処理なし

### 基礎ステータス（集計時に確定）

| キー | 主な付与元 | 処理 |
|---|---|---|
| atkUp〜atkUp6, atkUpBonus | パワーアップ、伝説 他 | グループごとに `(1+x)` を**乗算**、atkUpBonus は `1.04^n`。`calculateStats` で適用 ✅ |
| defUp〜defUp5 | 防御アップ 他 | 同上 ✅ |
| atkDmgUp, atkDmgUp2 | 脳筋、慎重、決死 | `(1+a)(1+b)-1` に合成。適用方法はモードで違う（#1, #11）|
| defDmgUp, defDmgUp2 | 脳筋、慎重 | 同上。被ダメ倍率 `defDmgX` に入る ✅ |
| noAmuletAtkUp | かるわざ | お守り未装備時にパワー加算（calculateStats）✅ |
| beginner | わかばのお守り | 集計時: スキル数が5未満の分 atk/def ×(1+n)^不足数、レイドかつ非常時覚醒なら ×1.15。レイドのみ: ターン4まで被ダメカット |
| rainbow | お守り | 集計時: 全属性に曜日ボーナス、>1 なら atk/def +5%/段 |
| distributed | 分散型 | 集計時: 重複スキル数で減衰しつつ atk/def/critUpFixed/defDmgUp を補正 |

### 属性

| キー | 通常 | レイド | 表示 |
|---|---|---|---|
| fire 炎 | 戦闘: 1hit毎 +`min(lv,255)×fire` 固定 / 非戦闘: パワー +`lv×3.75×fire` | 同左（多段減衰あり）✅ | ✅ |
| ice 氷 | 戦闘: 確率で敵ターンスキップ / 非戦闘: 防御 ×(1+ice) | 同左 ✅ | ✅ |
| thunder 雷 | 与ダメ倍率に乗算 `1+thunder×(i+1)/spd/k`（後の攻撃ほど強い）| そのターンの合計ダメージを `thunder/2×max(1, 行動倍率(spd)÷行動倍率(max(好感度による行動回数,5)))^1.5` だけ増やし、何回目の攻撃かに比例した上乗せとして配る（行動倍率は段数の減衰込みの getSpdX。後の攻撃ほど上乗せが大きい）⚠（レイドは段数の減衰で後の攻撃が軽いため、行動回数の多さで効く形にしている）| `thunder/2` |
| spdUp 風 | 戦闘: `spd×spdUp` 回追加行動 / 非戦闘: パワー ×(1+spdUp) | 戦闘: getSpdX 換算で追加 / 非戦闘: 同左 ⚠ | ✅ |
| dart 土 | 最大ダメ制限ありの戦闘: 上限 ×(1+dart) / それ以外: パワー ×(1+dart/2) | 同左 ✅ | ✅ |
| light 光 | 戦闘: 確率で被ダメ半減 / 非戦闘: 防御 ×(1+light/2) | 同左 ✅ | ✅ |
| dark 闇 | 敵spd≥2: 確率`dark×2`で敵spd=1 / 戦闘かつ前ターン敵HP>150: 確率で敵現HP半減 / 非戦闘: 防御 ×(1+dark×0.7) | 半減の代わりに固定150ダメ、判定は常に成立 ⚠ | ✅ |
| water 水 | 対炎敵: 与ダメ ×(1+water)、敵の炎 ÷(1+water×3) / 集計時に氷・雷を強化 | 同左 ✅ | 表示なし |
| weak 毒 | ターン経過で `1-1/(1+weak×(count-1))` だけ敵パワー減＋貫通 | 経過係数が表 `[0,0.25,0.5,1,1.5,3.5,…]` ⚠（info に明記あり）| 係数1.125の概算 |

曜日ボーナス（集計時）: 日=雷 月=闇 火=炎 水=氷・水 木=風 金=光 土=土 が ×5/3。

### 非戦闘・状況

| キー | 通常 | レイド |
|---|---|---|
| notBattleBonusAtk | 非戦闘時 パワー ×(1+x) | 同左 ✅（コンテスト型では器用さに換算）|
| notBattleBonusDef | 疲れダメージ時 防御 ×(1+x) | 同左 ✅ |
| enemyStatusBonus | 敵の強さ/4 をソフトキャップ（applySoftCapPow2）して atk/def% | 敵の強さを40で頭打ちにした線形 ⚠（表示は一律 +10%）|
| arpen | calculateArpen で倍率 ✅ | ✅ |
| postXUp | tp ×(1+x×min(投稿/20,10)) ✅ | ✅ |
| continuousBonusUp | 連続ボーナス倍率 | －（レイドの連続ボーナスは固定）|
| plusActionX | 1コマンドで進むターン数 +n | パワー ×(1+n/10)（レイドは常に7ターン）|
| heavenOrHell | 60%: A×(1+h) D×(1+1.5h) / 40%: A÷(1+h) D÷(1+0.75h) | 同左 ✅ | 
| haisuiUp / haisuiAtkUp / haisuiCritUp | 決死の覚悟の条件・効果拡大、覚悟時の与ダメ・クリ率 | 同左 ✅ |
| enemyBuff | 撃破済みの通常敵を強化 | atk/def ×(1+x/20) |
| allForOne | atk×spd、spd=1 | atk×getSpdX(spd)、炎の固定ダメにも乗る ⚠ |

### 防御・生存

| キー | 通常 | レイド |
|---|---|---|
| firstTurnResist | T1 被ダメ ×(1-x)、1超過分は T2 へ ✅ | ✅ |
| tenacious | 被ダメ ×(1-min(x×減少HP率, 0.9)) ✅ | ✅ |
| endureUp | 食いしばり率 `(0.1+0.1×endure)×(1+x) - count×0.05` | `0.1 + (1+2x)×0.1 - count×0.05`、発動ごとに減る ⚠ |
| escape | 敗北時に逃走（回数超過で確率半減）| HP が `-maxHp×x/16` 以上の負なら1ターン回復、ターン消費 ⚠ |
| enemyCritDown | 敵クリ率（HP差依存）×(1-x) | 敵クリは alwaysCrit 敵のみ ⚠ |
| enemyCritDmgDown | 敵クリダメ ×(1-x) | 同左 ＋ 防御 ×(1+x/4) |
| defRndMin / defRndMax | 被ダメ乱数幅 ✅ | ✅ |

### 攻撃・クリティカル

| キー | 通常 | レイド |
|---|---|---|
| critUp | クリ率 = (敵HP%-自HP%)×(1+critUp+覚悟) + critUpFixed | 敵HP%はターン数から算出した擬似値 ⚠ |
| critUpFixed / critDmgUp | ✅ | ✅（憤怒で critDmgUp +0.4）|
| noCrit | クリ無効、期待値分を与ダメに上乗せ ✅ | ✅ |
| atkRndMin / atkRndMax | 与ダメ乱数幅。**覚醒時は下限+0.3・上限-0.3** | 覚醒補正なし ⚠ |
| notRandom / charge | utils.ts `random` で共通 ✅ | ✅ |
| abortDown | 敵の連撃中断率 ×(1-x)、中断持ちでない敵ならパワー ×(1+x/3) | 同左 ✅ |
| guardAtkUp | 軽減ダメ累計300毎にパワー +防御×0.125×[1,2.4,4.8,8] | 同左 ＋ 終了時に減少HPの同割合を回復 ⚠ |
| sevenFever | atk/def +X%（Lv・ステの7の数で算出）| **防御 +7%×n とバリア、与ダメを7の倍数化**（パワー補正なし）⚠ 表示はパワーにも+7% |
| finalAttackUp | － | 全力の一撃 ×(1+x) |

### アイテム

| キー | 通常 | レイド |
|---|---|---|
| itemEquip | 装備率 ×(1+x)、1.5超過分は itemBoost へ ✅ | ✅ |
| itemBoost / weaponBoost / armorBoost / foodBoost | 効果量倍率、毒は割り算 ✅ | ✅ |
| （効果量の係数）| 武器・防具 `lv×4×effect×0.005`、気合 0.0025 | 武器・防具 **0.007**、防具の気合と過剰回復は **0.0035** ⚠ |
| weaponSelect / armorSelect / foodSelect | ≥1 で種類固定 ✅ | ✅ |
| lowHpFood | HP が減るほど食べ物を選ぶ | 同左（HP95%以上では食べ物候補なし）⚠ |
| poisonAvoid / poisonResist / mindMinusAvoid | ✅ | ✅ |
| firstTurnItem / firstTurnMindMinusAvoid | T1 確定装備・悪アイテム回避 ✅ | ✅ |
| firstTurnItemChoice / firstTurnDoubleItem | － | T1 最低効果量、二刀流 |
| itemAtkStock | 装備で上がったパワーの x を次ターン以降に累積（data に永続）| 同左（戦闘内の変数）✅ |
| shieldBash | 防具の防御上昇の (1-0.5^x) をパワーにも ✅ | ✅ |
| greed | － | 前の装備を劣化させつつ使い回す（係数 2/3 直書き ❌#7）|

### レイド専用・特殊

| キー | 処理（レイドのみ）|
|---|---|
| berserk | 毎ターン HP 減少、パワー ×(1+x×1.6) |
| slowStart | ターン経過で atk/def が上昇 |
| fortuneEffect | battle.ts `fortune` でステ再分配 |
| stockRandomEffect | battle.ts `stockRandom` で溜めたポイントを各効果へランダム配分 |
| transcendence | HP を1にしてバリアへ変換、回復はバリア化 |
| amuletPower | お守り数に応じて付与。コンテスト型の器用さのみで使用 |
| pride / wrath / gluttony / sloth / envy | 罪のお守り（`raidOnly`）。❌#7 |
| kazutoriMaster | battle.ts の数取り系関数（全モード共通）✅ |

### ショップ系

| キー | 処理 |
|---|---|
| priceOff | shop.ts / shop2.ts で割引 |
| amuletBoost | 集計時にお守り effect を倍率 |

### 未使用

| キー | 状態 |
|---|---|
| statusBonus | 参照のみ・付与元なし（#12）|
| loseBonus | 参照のみ・付与元なし（廃止スキルの名残）|
| lust | 型定義のみ |

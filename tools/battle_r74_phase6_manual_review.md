# BattleUI V7.3-R7.4 Phase 6 人工真实性审阅

> 本记录由执行者在读取当前版本完整战斗结果后填写。自动门禁只验证结构、数值、确定性和覆盖，不生成以下结论。

## 审阅范围

- 代码阶段：Phase 6
- 审阅目的：确认全原型、资源、团队、控制、召唤和造物接入后，Next 链不存在立即可见的结构性行为崩坏。
- 结论边界：本记录不是 Phase 8 的 24 场最终真实性审阅，也不替代战报模块的可读性审阅。
- 自动结果：Phase 6 quick `31/31`，正式 `weixiaofeng_20_round` `26/26`，full 自动检查 `35/35`；人工状态仍独立记录。

## 1. duel_agile_counter_options

- `caseId`: `duel_agile_counter_options`
- `seed`: `630071`
- `inputHash`: `r74-b1bf7c2baad550ae`
- `beliefHash`: `r74-5465b825baa9e378`
- `ledgerHash`: `r74-fcb95c34d448a5b4`
- `reportHash`: `r74-1fb6c469a8657d2c`
- `actualRoundCount`: `5`
- 行为结论：**合理但需要更具体的解释**。谢邂首轮选择普通攻击，当前候选中普通攻击的直接推进高于两个魂技，不能仅因为有魂技就强制释放。王金玺在受到推进压力时先建立防御姿态，随后仍有真实普通攻击机会，行为不是单纯轮换。
- 战报结论：**事实完整，表达欠佳**。主动攻击、失败命中、受击后的后续机会都能追溯；但判定原因仍容易退化为“稳定推进/替代收益不足”，需要 Phase 7 以结构化替代差异说明，而不是泛化文案。
- 判定结论：**可理解性待 Phase 7 补强**。当前能定位选中动作和替代动作，但还不能直接从玩家视角看出“普通攻击具体比两个魂技多兑现了什么”。
- 反常识点：未发现明确反常识；当前风险是解释粒度不足。
- 责任模块：BattleReport 判定投影。
- 阻断：否（Phase 6）；Phase 7 必须补齐。

证据：

| 回合 | eventId | 事实 |
|---|---|---|
| 1 | `battle-ledger-structured-shadow-di5z-2` | 谢邂声明普通攻击，目标王金玺。 |
| 1 | `battle-ledger-structured-shadow-di5z-6` | 普通攻击首次命中判定失败，没有被战报伪写成伤害。 |
| 1 | `battle-ledger-structured-shadow-di5z-e` | 王金玺普通攻击成功命中谢邂，形成真实交锋。 |
| 2 | `battle-ledger-structured-shadow-di5z-z` | 谢邂第二回合普通攻击成功，后续选择仍有实际推进。 |

## 2. raid_balanced

- `caseId`: `raid_balanced`
- `seed`: `631321`
- `inputHash`: `r74-c5119ee0c1edde00`
- `beliefHash`: `r74-5465b825baa9e378`
- `ledgerHash`: `r74-46436dabe6d3c9d1`
- `reportHash`: `r74-c3d2f856fe565a9e`
- `actualRoundCount`: `5`
- 行为结论：**阶段性可解释，不能据此宣称团战真实性闭环**。首轮确实存在群体技能、目标差异、保护和主动命中，双方不是一方完全看戏；但部分单位连续防御/普攻的长期策略变化仍需 Phase 8 在完整战报中逐回合复核。
- 战报结论：**事实足够，交锋组织仍需 Phase 7**。同一群攻包含多个独立目标结果，说明 Ledger 没有丢数值；但最终玩家视角必须把“一个群攻声明下的多目标结果”组织成一个交锋，而不是平铺成多条互不相干的句子。
- 判定结论：**可定位但不够可读**。唐舞麟首轮选择蓝银突刺阵的群攻理由可以从目标集合解释，但替代动作仍显示为泛化的 `BASIC_ATTACK`，需要结构化目标收益差异。
- 反常识点：未发现单回合严重反常识；长期策略适应不在本次阶段性抽审中定案。
- 责任模块：BattleReport 交锋聚合与判定明细；Phase 8 负责行为连续性。
- 阻断：否（Phase 6）；不可作为最终团战通过证据。

证据：

| 回合 | eventId | 事实 |
|---|---|---|
| 1 | `battle-ledger-structured-shadow-dj4p-2` | 唐舞麟声明蓝银突刺阵，目标龙跃。 |
| 1 | `battle-ledger-structured-shadow-dj4p-z` | 龙跃对该群攻结果为失败。 |
| 1 | `battle-ledger-structured-shadow-dj4p-14` | 戴月炎独立记录成功结果。 |
| 1 | `battle-ledger-structured-shadow-dj4p-1g` | 韦小枫独立记录成功结果，群攻没有被压成一条总伤害。 |

## 3. raid_summon_heavy

- `caseId`: `raid_summon_heavy`
- `seed`: `631818`
- `inputHash`: `r74-7b1f7aa7cc5ed59b`
- `beliefHash`: `r74-5465b825baa9e378`
- `ledgerHash`: `r74-1ee8401216993b4d`
- `reportHash`: `r74-56afa7a9a9279f9f`
- `actualRoundCount`: `5`
- 行为结论：**召唤行为的实际窗口和后续行动已成立**。宿主技能、召唤物生成、召唤物自主窗口和支援效果确实进入 Runtime；没有发现零行动召唤或宿主技能库错误复用导致的立即循环。
- 战报结论：**阻断：玩家可见文本泄漏内部召唤实例 ID**。完整结果中出现 `structured-summon:` 形式的内部实例标识。事实来源正确不等于玩家战报可接受，必须在 BattleReport 的 PLAYER 投影中转换为可读名称，同时保留开发者模式的内部关联。
- 判定结论：**阶段性可追溯，玩家可见性不通过**。召唤选择的窗口和目标可以由 Ledger 追溯，但不能把内部 ID 暴露给玩家。
- 反常识点：内部 ID 泄漏会破坏可读性和沉浸感；不是战斗逻辑本身的合理性问题。
- 责任模块：BattleReport 可见性映射。
- 阻断：**是（Phase 7 的已知阻断）**。

证据：

| 回合 | eventId | 事实 |
|---|---|---|
| 1 | `battle-ledger-structured-shadow-djii-k` | 谢邂声明光龙风暴，后续存在召唤/反应链。 |
| 1 | `battle-ledger-structured-shadow-djii-1n` | 光龙风暴对龙跃形成独立成功事实。 |
| 1 | `battle-ledger-structured-shadow-djii-21` | 同一动作对苏沐形成独立成功事实。 |
| 1 | `battle-ledger-structured-shadow-djii-24` | 同一动作对苏沐也保留独立失败事实，未把结果统一伪写成全中。 |

## 4. item_creation_consumption

- `caseId`: `item_creation_consumption`
- `seed`: `632689`
- `inputHash`: `r74-15885b3401f97926`
- `beliefHash`: `r74-5465b825baa9e378`
- `ledgerHash`: `r74-3d546273b6f8b27a`
- `reportHash`: `r74-5ea829597b6dabe0`
- `actualRoundCount`: `6`
- 行为结论：**造物链路接入正确，但完整战斗没有证明造物选择会自然出现**。造物 Preview 能写入未来库存，正式结算后成品能进入行为库；然而当前完整战斗中徐笠智实际多次选择闪避/普通攻击，没有选择造物。该结果可能是当前盘面下直接行动更优，不能被强行解释成“造物已被合理使用”。
- 战报结论：**结构事实通过，用户目标覆盖不足**。造物候选、库存和消费专项测试存在，但真实战斗战报没有展示一次“生产→消费”的完整交锋闭环。
- 判定结论：**不能据此判定造物决策已通过**。下一阶段需要真正资源紧缺且造物收益超过直接行动的完整案例，并人工阅读其生产、消费和后续资源变化。
- 反常识点：当前未发现“无消费者仍造物”的强制错误；缺陷是案例没有覆盖关键真实决策窗口。
- 责任模块：Phase 7/8 的案例契约与判定/战报审阅。
- 阻断：否（Phase 6）；追加高资源危机案例为后续必做项。

证据：

| 回合 | eventId | 事实 |
|---|---|---|
| 1 | `battle-ledger-structured-shadow-dk6p-2` | 唐舞麟先以蓝银突刺阵推进战局。 |
| 1 | `battle-ledger-structured-shadow-dk6p-1o` | 龙跃对徐笠智发动山川，形成真实资源危机背景。 |
| 1 | `battle-ledger-structured-shadow-dk6p-29` | 戴月炎对白笠智造成实际命中，证明受伤窗口存在。 |
| 1 | `battle-ledger-structured-shadow-dk6p-2h` | 徐笠智仍选择普通攻击，说明本场没有自然选择造物；该事实必须保留，不能用测试说明替代。 |

## Phase 6 结论

- 代码退出结论：**通过**。Phase 6 的原型/资源/团队/控制/召唤接入没有引入结构 Fatal，且正式案例和 full 自动门禁通过。
- 人工真实性结论：**阶段性通过，非最终闭环**。
- 必须带入 Phase 7：
  1. PLAYER 战报不得泄漏 `structured-summon:` 等内部实例 ID。
  2. 判定明细必须展示选中动作与两个替代动作的真实差异，不再只显示泛化理由。
  3. 群攻、召唤、反应和状态结果必须在交锋层组织为可读因果链。
  4. 追加“资源危机下造物优于直接行动”的真实完整案例。
  5. Phase 8 重新逐回合审阅双方策略适应、重复动作边际和长期交锋，不接受自动门禁代替人工结论。

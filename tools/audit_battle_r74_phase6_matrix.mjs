import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
  Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
  parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const relativePath of [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const manualCases = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__);

function manual(caseId) {
  const definition = manualCases.find(item => item.caseId === caseId);
  assert.ok(definition, `Phase 6人工案例缺失:${caseId}`);
  return definition;
}

function runNext(definition) {
  return runtime.runBattleCase({
    caseId: `${definition.caseId}:phase6-next`,
    seed: definition.seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    settings: { decisionEngine: 'next-shadow' },
  });
}

const formerlyCrashingCases = [
  'raid_balanced',
  'raid_summon_heavy',
  'item_creation_consumption',
].map(caseId => {
  const result = runNext(manual(caseId));
  assert.equal(result.audit.fatalCount, 0, `${caseId}:Next完整战斗存在结构Fatal:${JSON.stringify(result.audit.fatals)}`);
  return {
    caseId,
    rounds: result.roundsExecuted,
    ledgerHash: runtime.hashBattleValue(result.ledger),
    decisionHash: runtime.hashBattleValue(result.decisions),
  };
});

const creationDefinition = manual('item_creation_consumption');
const creationWorld = runtime.cloneValue(creationDefinition.combatData);
const creator = preview.findUnit(creationWorld, '徐笠智');
assert.ok(creator, 'Phase 6造物者缺失');
const creationSkill = decision.collectSkills(creator)
  .find(skill => String(skill?.承载方式 || '').trim() === '造物承载' && String(skill?.name || skill?.魂技名 || '').trim() === '恢复大肉包');
assert.ok(creationSkill, 'Phase 6造物技能缺失');
const creationCandidate = decision.enumerateCandidates({
  worldSnapshot: creationWorld,
  actorId: preview.unitId(creator),
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: creationDefinition.initialBelief || {},
  battleIntent: { mode: creationDefinition.intent },
}).find(candidate =>
  candidate?.declaration?.actionKind === 'RELEASE_SKILL' &&
  String(candidate?.skill?.name || candidate?.skill?.魂技名 || '').trim() === String(creationSkill?.name || creationSkill?.魂技名 || '').trim()
);
assert.ok(creationCandidate?.creation?.useful, '存在受伤消费者时造物没有识别真实兑现窗口');

const scoredCreation = decision.scoreCandidatesNext({
  worldSnapshot: creationWorld,
  actorId: preview.unitId(creator),
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: creationDefinition.initialBelief || {},
  battleIntent: { mode: creationDefinition.intent },
  seed: creationDefinition.seed,
  __frozenCandidates: [creationCandidate],
});
assert.equal(scoredCreation.length, 1, '造物候选没有进入Next评分');
assert.ok(scoredCreation[0].preview, '造物候选没有通过共享Preview');
assert.ok(scoredCreation[0].preview.scheduledEvents.some(event => event?.eventKind === 'item_created'), '造物Preview缺少未来物品事实');
const previewCreator = preview.findUnit(scoredCreation[0].preview.afterSnapshot, preview.unitId(creator));
const previewInventory = decision.collectInventory(previewCreator);
assert.ok(previewInventory.some(entry => entry.id === creationCandidate.creation.productId && entry.quantity > 0), '造物Preview没有增加覆盖层库存');
assert.equal(preview.readHp(previewCreator), preview.readHp(creator), '造物Preview错误提前结算了成品恢复效果');
assert.ok(
  !['HARD_INVALID', 'DOMINATED', 'ZERO_EFFECT_COSTLY'].includes(String(scoredCreation[0].rejectionCode || '').trim()),
  `存在真实消费者的造物被错误判为不可用:${JSON.stringify(scoredCreation[0])}`,
);

const settledCreationWorld = runtime.cloneValue(creationDefinition.combatData);
const settledCreator = preview.findUnit(settledCreationWorld, '徐笠智');
runtime.executeStructuredDeclaration({
  combatData: settledCreationWorld,
  declaration: {
    ...runtime.cloneValue(creationCandidate.declaration),
    actorId: preview.unitId(settledCreator),
  },
});
const postCreationCandidates = decision.enumerateCandidates({
  worldSnapshot: settledCreationWorld,
  actorId: preview.unitId(settledCreator),
  actionOpportunity: { role: 'ACTIVE', sequence: 2 },
  beliefState: creationDefinition.initialBelief || {},
  battleIntent: { mode: creationDefinition.intent },
});
assert.ok(postCreationCandidates.some(candidate =>
  candidate?.declaration?.actionKind === 'USE_ITEM' &&
  String(candidate?.declaration?.skill?.name || '').trim() === creationCandidate.creation.productId
), '正式造物结算后成品没有进入下一次真实行为库');

function syntheticUnit(id, side, skills = [], overrides = {}) {
  return {
    id,
    name: id,
    名称: id,
    side,
    type: '强攻系',
    系别: '强攻系',
    hp: 1000,
    HP: 1000,
    hp_max: 1000,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    sta: 100,
    vit_max: 100,
    str: 200,
    def: 120,
    agi: 100,
    属性: {
      等级: 50, HP: 1000, HP上限: 1000, 魂力: 100, 魂力上限: 100,
      精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100,
      力量: 200, 防御: 120, 敏捷: 100, 状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: skills,
    ...overrides,
  };
}

function syntheticSkill(id, effects, cost = 0) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: cost },
    前摇: 1,
    _效果数组: effects,
  };
}

function syntheticWorld(actorSkills, allyOverrides = {}, enemySkills = []) {
  return {
    回合: 0,
    战斗意图: '守护',
    进行中: true,
    参战者: {
      team_player: [
        syntheticUnit('support', 'player', actorSkills),
        syntheticUnit('ally', 'player', [], {
          hp: 180,
          HP: 180,
          属性: {
            等级: 50, HP: 180, HP上限: 1000, 魂力: 100, 魂力上限: 100,
            精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100,
            力量: 160, 防御: 100, 敏捷: 100, 状态效果: {},
          },
          ...allyOverrides,
        }),
      ],
      team_enemy: [syntheticUnit('enemy', 'enemy', enemySkills)],
    },
  };
}

const healSkill = syntheticSkill('危急治疗', [
  { effectId: 'heal', 原型: '资源变化', 目标: '单体', 资源: '生命', 数值: '+40%', 生效方式: '独立生效' },
]);
const healWorld = syntheticWorld([healSkill]);
const healCandidates = decision.enumerateCandidates({
  worldSnapshot: healWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '守护' },
});
const healCandidate = healCandidates.find(candidate =>
  candidate?.skill?.name === '危急治疗' &&
  candidate?.declaration?.targetIds?.includes('ally')
);
assert.ok(healCandidate, '危急治疗没有进入完整候选池');
const healScore = decision.scoreCandidatesNext({
  worldSnapshot: healWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '守护' },
  __frozenCandidates: [healCandidate],
});
assert.ok(healScore[0]?.preview, '危急治疗没有通过共享Preview');
assert.ok(preview.readHp(preview.findUnit(healScore[0].preview.afterSnapshot, 'ally')) > 180, '危急治疗Preview没有兑现友方生命变化');

const emptyResourceSkill = syntheticSkill('空回魂', [
  { effectId: 'empty-resource', 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+40', 生效方式: '独立生效' },
]);
const emptyResourceWorld = syntheticWorld([emptyResourceSkill], {
  hp: 1000,
  HP: 1000,
  属性: { 等级: 50, HP: 1000, HP上限: 1000, 魂力: 100, 魂力上限: 100, 精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100, 力量: 160, 防御: 100, 敏捷: 100, 状态效果: {} },
});
const emptyResourceCandidate = decision.enumerateCandidates({
  worldSnapshot: emptyResourceWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '击败' },
}).find(candidate => candidate?.skill?.name === '空回魂');
const emptyResourceScore = decision.scoreCandidatesNext({
  worldSnapshot: emptyResourceWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '击败' },
  __frozenCandidates: [emptyResourceCandidate],
});
assert.ok(['ZERO_PROGRESS', 'ZERO_EFFECT_COSTLY'].includes(String(emptyResourceScore[0]?.rejectionCode || '').trim()), '无消费者资源回复没有归零');

const consumerSkill = syntheticSkill('耗魂重击', [
  { effectId: 'consumer-hit', 原型: '伤害结算', 目标: '单体', 威力倍率: 180, 伤害类型: '近身攻击', 生效方式: '独立生效' },
], 80);
const resourceWithConsumer = syntheticSkill('战前回魂', [
  { effectId: 'consumer-resource', 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+60', 生效方式: '独立生效' },
]);
const resourceWorld = syntheticWorld([resourceWithConsumer, consumerSkill], {
  hp: 1000,
  HP: 1000,
  属性: { 等级: 50, HP: 1000, HP上限: 1000, 魂力: 20, 魂力上限: 100, 精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100, 力量: 160, 防御: 100, 敏捷: 100, 状态效果: {} },
});
const resourceCandidate = decision.enumerateCandidates({
  worldSnapshot: resourceWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '击败' },
}).find(candidate => candidate?.skill?.name === '战前回魂');
const resourceScore = decision.scoreCandidatesNext({
  worldSnapshot: resourceWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '击败' },
  __frozenCandidates: [resourceCandidate],
});
assert.notEqual(String(resourceScore[0]?.rejectionCode || '').trim(), 'ZERO_PROGRESS', '存在消费者时资源回复仍被判为零进展');

const controlSkill = syntheticSkill('重复眩晕', [
  { effectId: 'overlap-stun', 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: 1 },
]);
const controlWorld = syntheticWorld([controlSkill]);
controlWorld.参战者.team_enemy[0].状态效果 = {
  stun: { 状态: '眩晕', duration: 2, 持续回合: 2, 战斗效果: { cannot_act: true, skip_turn: true } },
};
const controlCandidate = decision.enumerateCandidates({
  worldSnapshot: controlWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '击败' },
}).find(candidate => candidate?.skill?.name === '重复眩晕');
const controlScore = decision.scoreCandidatesNext({
  worldSnapshot: controlWorld,
  actorId: 'support',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  battleIntent: { mode: '击败' },
  __frozenCandidates: [controlCandidate],
});
assert.ok(['ZERO_PROGRESS', 'ZERO_EFFECT_COSTLY'].includes(String(controlScore[0]?.rejectionCode || '').trim()), '已覆盖真实行动窗口的控制仍被评分为有效');

const beliefKey = decision.mechanicKey({
  sourceActionId: 'known-control',
  effectPrototype: '状态施加',
  targetId: 'enemy',
  relevantStateFingerprint: 'stable',
});
const initialPosterior = decision.mechanicPosterior({}, beliefKey, 0.8, 0.5);
let learnedBelief = {};
for (let index = 0; index < 3; index += 1) {
  learnedBelief = decision.updateMechanicBelief(learnedBelief, {
    sourceActionId: 'known-control',
    effectPrototype: '状态施加',
    targetId: 'enemy',
    relevantStateFingerprint: 'stable',
    estimatedProbability: 0.8,
    experience: 0.5,
    success: false,
  });
}
assert.ok(decision.mechanicPosterior(learnedBelief, beliefKey, 0.8, 0.5) < initialPosterior, '连续抵抗没有降低同机制后验概率');

const nextPrototypeEffects = {
  伤害结算: { 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' },
  资源变化: { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' },
  资源转移: { 原型: '资源转移', 目标: '单体', 资源: '魂力', 数值: '10', 资源转移方式: '转移' },
  护盾变化: { 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+20' },
  属性修正: { 原型: '属性修正', 目标: '自身', 属性: '力量', 数值: '+10%', 持续回合: 1 },
  判定修正: { 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%', 持续回合: 1 },
  结算修正: { 原型: '结算修正', 目标: '自身', 结算: '造成伤害', 数值: '+10%', 持续回合: 1 },
  炸环: { 原型: '炸环', 目标: '自身', 强化倍率: 1.5 },
  状态施加: { 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: '100%' },
  时窗修正: { 原型: '时窗修正', 目标: '单体', 调整字段: '持续回合', 调整方式: '延长', 调整回合: 1 },
  状态移除: { 原型: '状态移除', 目标: '自身', 状态: '任意负面', 数量: 1 },
  规则防御: { 原型: '规则防御', 目标: '自身', 规则: '免伤', 次数: 1 },
  状态转移: { 原型: '状态转移', 目标: '单体', 状态: '任意负面', 来源: '自身', 去向: '目标', 数量: 1 },
  状态交换: { 原型: '状态交换', 目标: '单体', 状态: '任意负面' },
  资源锁定: { 原型: '资源锁定', 目标: '单体', 资源: '魂力', 锁定类型: '资源池锁定', 数值: '-50%' },
  规则改写: { 原型: '规则改写', 目标: '单体', 规则: '缴械', 数值: '+25%' },
  机制抹消: { 原型: '机制抹消', 目标: '单体', 抹消对象: { 原型: '状态施加', 状态: '眩晕' } },
  机制授予: { 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] },
  复制执行: { 原型: '复制执行', 目标: '自身', 复制类型: '复制属性', 复制模式: '即时镜像', 削减比例: '20%', 使用效果: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击' }] },
  时光回溯: { 原型: '时光回溯', 目标: '单体', 发动方式: '主动' },
  位移执行: { 原型: '位移执行', 目标: '单体', 位移类型: '击退', 位移对象: '目标', 距离: 3 },
  决策干扰: { 原型: '决策干扰', 目标: '单体', 干扰: '判断干扰', 数值: '-20%', 持续回合: 1 },
  召唤生成: { 原型: '召唤生成', 目标: '自身', 生效方式: '独立生效', 召唤单位类型: '魂兽', 召唤物名称: 'Phase6测试召唤物', 数量: 1, 强度: 1, 行动模式: '协同攻击', 持续回合: 1 },
};

const nextPrototypeCoverage = [];
for (const [prototype, effect] of Object.entries(nextPrototypeEffects)) {
  const actorSkill = {
    id: `phase6:${prototype}`,
    name: `Phase6-${prototype}`,
    魂技名: `Phase6-${prototype}`,
    消耗: { 魂力: 0 },
    前摇: 0,
    historySnapshot: prototype === '时光回溯' ? { hp: 900, HP: 900, sp: 90 } : undefined,
    ringId: prototype === '炸环' ? '第1武魂/第1魂环' : undefined,
    _效果数组: [{
      effectId: `phase6-effect:${prototype}`,
      ...runtime.cloneValue(effect),
    }, ...(prototype === '炸环'
      ? [{ effectId: 'phase6-ring-damage', 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击' }]
      : [])],
  };
  const world = {
    回合: 0,
    战斗意图: '击败',
    进行中: true,
    参战者: {
      team_player: [syntheticUnit('prototype-actor', 'player', [actorSkill], {
        第1武魂: { 第1魂环: { 年限: 1000, 状态: '可用' } },
        状态效果: { poison: { 状态: '中毒', 类型: 'debuff', duration: 2 } },
      })],
      team_enemy: [syntheticUnit('prototype-target', 'enemy', [], {
        hp: 700,
        HP: 700,
        属性: {
          等级: 50, HP: 700, HP上限: 1000, 魂力: 100, 魂力上限: 100,
          精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100,
          力量: 180, 防御: 120, 敏捷: 1, 状态效果: { poison: { 状态: '中毒', 类型: 'debuff', duration: 2 } },
        },
        状态效果: { stun: { 状态: '眩晕', duration: 1, 持续回合: 1, 战斗效果: { cannot_act: true } } },
      })],
    },
  };
  const targetIds = effect.目标 === '自身' ? ['prototype-actor'] : ['prototype-target'];
  const candidate = {
    candidateId: `phase6-prototype:${prototype}`,
    declaration: {
      actionId: `phase6-prototype:${prototype}`,
      actorId: 'prototype-actor',
      actionKind: 'RELEASE_SKILL',
      targetIds,
      skill: actorSkill,
      ringId: actorSkill.ringId,
      historySnapshot: actorSkill.historySnapshot ? world : undefined,
    },
    skill: actorSkill,
    costs: {},
  };
  const scored = decision.scoreCandidatesNext({
    worldSnapshot: world,
    actorId: 'prototype-actor',
    actionOpportunity: { role: 'ACTIVE', sequence: 1 },
    beliefState: {},
    battleIntent: { mode: '击败' },
    __frozenCandidates: [candidate],
  });
  assert.equal(scored.length, 1, `${prototype}没有经过Next评分`);
  assert.ok(scored[0].preview, `${prototype}Next评分没有共享Preview结果`);
  nextPrototypeCoverage.push({
    prototype,
    preview: true,
    nextScored: true,
    rejectionCode: scored[0].rejectionCode || '',
  });
}

console.log(JSON.stringify({
  summary: {
    formerlyCrashingCaseCount: formerlyCrashingCases.length,
    creationPreviewCount: 1,
    creationSettlementCount: 1,
    supportAndResourceChecks: 6,
    nextPrototypeCount: nextPrototypeCoverage.length,
    formerlyCrashingCases,
    passed: true,
  },
}, null, 2));

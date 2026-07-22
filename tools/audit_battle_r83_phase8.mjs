import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {
  console,
  structuredClone,
  Math: Object.create(Math),
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Symbol,
  parseInt,
  parseFloat,
  isNaN,
  Intl,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const fileName of [
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'), sandbox, { filename: fileName });
}

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const registry = sandbox.__LWCS_SKILL_MECHANISM_REGISTRY__?.原型定义 || {};
const checks = [];
const add = (checkId, passed, detail = {}) => checks.push({ checkId, passed: passed === true, ...detail });

function unit(id, side, options = {}) {
  const hp = Number(options.hp ?? 100);
  const hpMax = Number(options.hpMax ?? 100);
  const sp = Number(options.sp ?? 100);
  const skills = Array.isArray(options.skills) ? options.skills : [];
  return {
    id,
    name: id,
    名称: id,
    side,
    hp,
    hp_max: hpMax,
    sp,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: Number(options.str ?? 150),
    def: Number(options.def ?? 100),
    agi: Number(options.agi ?? 100),
    属性: {
      等级: 60,
      HP: hp,
      HP上限: hpMax,
      魂力: sp,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: Number(options.str ?? 150),
      防御: Number(options.def ?? 100),
      敏捷: Number(options.agi ?? 100),
    },
    状态: { 存活: hp > 0, 行动: hp > 0 ? '战斗' : '死亡' },
    状态效果: structuredClone(options.states || {}),
    持续效果: {},
    背包: structuredClone(options.inventory || {}),
    装备: {},
    技能列表: skills,
  };
}

function damageSkill(id, power = 80, cost = 0) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: cost ? { 魂力: cost } : '无',
    _效果数组: [{
      effectId: `${id}:damage`,
      原型: '伤害结算',
      目标: '单体',
      威力倍率: power,
      伤害类型: '近身攻击',
      命中概率: '100%',
    }],
  };
}

function objective() {
  return {
    startRound: 1,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{ conditionId: 'victory', type: 'TEAM_INCAPACITATED', side: 'ENEMY' }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{ conditionId: 'defeat', type: 'TEAM_INCAPACITATED', side: 'PLAYER' }],
    },
  };
}

function world(actor, enemy, ally = null) {
  return {
    回合: 1,
    战斗类型: '普通战斗',
    战斗意图: '击败',
    进行中: true,
    胜负条件: objective(),
    参战者: {
      team_player: ally ? [actor, ally] : [actor],
      team_enemy: [enemy],
    },
  };
}

function runtimeSnapshot(extra = {}) {
  return {
    opportunitySnapshot: [
      {
        opportunityId: 'natural:actor:current',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'EXECUTING',
        createdAtSequence: 1,
      },
      {
        opportunityId: 'natural:actor:next',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 2,
      },
      {
        opportunityId: 'natural:enemy:next',
        ownerId: 'enemy',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 3,
      },
      ...(extra.opportunities || []),
    ],
    resourceTimeline: extra.resourceTimeline || [],
    scheduledEvents: extra.scheduledEvents || [],
  };
}

function prepare(combatData, extra = {}) {
  return decision.prepareDecisionRequest({
    worldSnapshot: combatData,
    actorId: 'actor',
    objectiveContract: combatData.胜负条件,
    actionOpportunity: {
      opportunityId: 'natural:actor:current',
      ownerId: 'actor',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 1,
    },
    runtimeSnapshot: extra.runtimeSnapshot || runtimeSnapshot(),
    seed: extra.seed || 838000,
  });
}

function candidateBySkill(request, skillId) {
  return request.frozenCandidates.find(candidate =>
    String(candidate?.declaration?.skill?.id || '').trim() === skillId
  );
}

function projectionFor(request, candidate) {
  return decision.projectR8GoalUtility(
    request,
    candidate,
    request.actorCandidateRoutes[candidate.candidateId],
  );
}

const effects = {
  伤害结算: { 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' },
  资源变化: { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' },
  资源转移: { 原型: '资源转移', 目标: '单体', 资源: '魂力', 数值: '10', 资源转移方式: '吞噬' },
  护盾变化: { 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+20' },
  属性修正: { 原型: '属性修正', 目标: '自身', 属性: '力量', 数值: '+10%', 持续回合: 1 },
  判定修正: { 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%', 持续回合: 1 },
  结算修正: { 原型: '结算修正', 目标: '自身', 结算: '造成伤害', 数值: '+10%', 持续回合: 1 },
  炸环: { 原型: '炸环', 目标: '自身', 强化倍率: 1.5 },
  状态施加: { 原型: '状态施加', 目标: '单体', 状态: '中毒', 数值: '-5%', 持续回合: 2, 成功率: '100%' },
  时窗修正: { 原型: '时窗修正', 目标: '单体', 调整字段: '持续回合', 调整方式: '延长', 调整回合: 1 },
  状态移除: { 原型: '状态移除', 目标: '自身', 状态: '任意负面', 数量: 1 },
  规则防御: { 原型: '规则防御', 目标: '自身', 规则: '免伤', 次数: 1 },
  状态转移: { 原型: '状态转移', 目标: '单体', 状态: '任意负面', 来源: '自身', 去向: '目标', 数量: 1 },
  状态交换: { 原型: '状态交换', 目标: '单体', 状态: '任意负面' },
  资源锁定: { 原型: '资源锁定', 目标: '单体', 资源: '魂力', 锁定类型: '资源池锁定', 数值: '-50%' },
  规则改写: { 原型: '规则改写', 目标: '单体', 规则: '缴械', 数值: '+25%' },
  机制抹消: { 原型: '机制抹消', 目标: '单体', 抹消对象: { 原型: '状态施加', 状态: '眩晕' } },
  机制授予: {
    原型: '机制授予',
    目标: '自身',
    触发条件: '随下次行动触发',
    授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }],
  },
  复制执行: {
    原型: '复制执行',
    目标: '单体',
    复制类型: '复制技能',
    复制模式: '即时镜像',
    使用效果: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击' }],
  },
  时光回溯: { 原型: '时光回溯', 目标: '自身', 发动方式: '主动' },
  位移执行: { 原型: '位移执行', 目标: '单体', 位移类型: '击退', 位移对象: '目标', 距离: 3 },
  决策干扰: { 原型: '决策干扰', 目标: '单体', 干扰: '判断干扰', 数值: '-20%', 持续回合: 1 },
  召唤生成: {
    原型: '召唤生成',
    目标: '自身',
    生效方式: '独立生效',
    召唤单位类型: '魂兽',
    召唤物名称: '审计召唤物',
    数量: 1,
    强度: 0.5,
    行动模式: '自主行动',
    持续回合: 1,
  },
};

const actorBase = unit('actor', 'player', {
  hp: 60,
  sp: 40,
  skills: [damageSkill('baseline-attack', 80)],
  states: {
    中毒: {
      状态: '中毒',
      类型: '负面',
      duration: 1,
      战斗效果: { dot_damage_ratio: 0.05 },
    },
    自身负面: {
      状态: '迟缓',
      类型: '负面',
      duration: 1,
      战斗效果: { dodge_penalty: 0.2 },
    },
  },
});
actorBase.第1武魂 = { 第1魂环: { 年限: 1000 } };
const enemyBase = unit('target', 'enemy', {
  hp: 80,
  sp: 80,
  skills: [damageSkill('enemy-attack', 100, 20)],
  states: {
    目标增益: {
      状态: '力量增益',
      类型: '增益',
      duration: 2,
      战斗效果: { damage_bonus: 0.2 },
    },
  },
});
const prototypeRows = [];
let enumOptionCount = 0;
for (const [prototype, baseEffect] of Object.entries(effects)) {
  const actor = structuredClone(actorBase);
  const target = structuredClone(enemyBase);
  const combatData = world(actor, target);
  combatData.回合开始快照 = structuredClone(combatData);
  combatData.回合开始快照.参战者.team_player[0].hp = 90;
  combatData.回合开始快照.参战者.team_player[0].HP = 90;
  combatData.回合开始快照.参战者.team_player[0].属性.HP = 90;
  combatData.回合开始快照.参战者.team_player[0].sp = 70;
  combatData.回合开始快照.参战者.team_player[0].属性.魂力 = 70;
  const skill = {
    id: `prototype-${prototype}`,
    name: `原型${prototype}`,
    魂技名: `原型${prototype}`,
    消耗: '无',
    historySnapshot: prototype === '时光回溯' ? true : undefined,
    _效果数组: [
      { effectId: `effect:${prototype}`, ...structuredClone(baseEffect) },
      ...(prototype === '炸环'
        ? [{ effectId: 'effect:ring-damage', 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击', 命中概率: '100%' }]
        : []),
    ],
  };
  const declaration = {
    actionId: `prototype:${prototype}`,
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: baseEffect.目标 === '自身' && prototype !== '炸环' ? ['actor'] : ['target'],
    skill,
    ringId: prototype === '炸环' ? '第1武魂/第1魂环' : undefined,
    ringPath: prototype === '炸环' ? ['第1武魂', '第1魂环'] : undefined,
    historySnapshot: prototype === '时光回溯' ? combatData.回合开始快照 : undefined,
  };
  const result = preview.previewAction({
    worldSnapshot: combatData,
    worldRevision: `r83-phase8:${prototype}`,
    actorId: 'actor',
    declaration,
    actionFingerprint: `r83-phase8:${prototype}`,
  });
  const route = decision.actionRouteFromPreview({
    candidate: {
      candidateId: `prototype:${prototype}`,
      declaration,
      declarationFingerprint: decision.declarationFingerprint(declaration),
    },
    previewResult: result,
    worldSnapshot: combatData,
    actorSide: 'team_player',
    dependencyKeys: [],
  });
  const pathKinds = new Set([
    ...(route.healthTrajectoryByTarget.length ? ['HEALTH_TRAJECTORY'] : []),
    ...(route.actionPoolEffects.length ? ['ACTION_POOL'] : []),
    ...(result.scheduledEvents.length ? ['SCHEDULE'] : []),
    ...(Object.keys(result.changedRules).length ? ['RULE_OVERLAY'] : []),
  ]);
  prototypeRows.push({
    prototype,
    pathKinds: [...pathKinds],
    outcomeKinds: [...route.outcomeKinds],
    nodeCount: result.nodeCount,
  });
  for (const [field, definition] of Object.entries(registry?.[prototype]?.字段定义 || {})) {
    if (field === '原型') continue;
    const options = Array.isArray(definition?.选项) ? definition.选项 : [];
    for (const option of options) {
      const enumEffect = { ...structuredClone(baseEffect), [field]: option };
      const enumDeclaration = {
        ...declaration,
        actionId: `enum:${prototype}:${field}:${option}`,
        skill: { ...skill, _效果数组: [{ ...enumEffect, effectId: `enum-effect:${prototype}:${field}:${option}` }] },
      };
      preview.previewAction({
        worldSnapshot: combatData,
        worldRevision: `r83-enum:${prototype}:${field}:${option}`,
        actorId: 'actor',
        declaration: enumDeclaration,
        actionFingerprint: `r83-enum:${prototype}:${field}:${option}`,
      });
      enumOptionCount += 1;
    }
  }
}
add(
  'prototype:all-registered-battle-prototypes-have-r8-value-path',
  prototypeRows.length === 23 &&
    prototypeRows.every(row => row.pathKinds.length > 0 && row.nodeCount >= 1 && row.nodeCount <= 12),
  { prototypeRows },
);
add(
  'prototype:all-enum-options-enter-preview-without-second-formula',
  enumOptionCount === 621,
  { enumOptionCount },
);

const summonSkill = {
  id: 'independent-summon',
  name: '独立召唤',
  魂技名: '独立召唤',
  消耗: '无',
  _效果数组: [{ ...effects.召唤生成, effectId: 'summon-effect' }],
};
const summonWorld = world(
  unit('actor', 'player', { skills: [summonSkill, damageSkill('actor-attack', 50)] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 80)] }),
);
const summonRequest = prepare(summonWorld);
const summonCandidate = candidateBySkill(summonRequest, 'independent-summon');
const summonProjection = projectionFor(summonRequest, summonCandidate);
const summonEnvelope = summonRequest.candidateEnvelopeDeltas[summonCandidate.candidateId];
add(
  'summon:future-window-enters-new-unit-action-envelope',
  summonProjection.actionPoolHEPP > 0 &&
    summonEnvelope.some(entry =>
      !['actor', 'enemy'].includes(entry.targetId) &&
      entry.beforePP === 0 &&
      entry.afterPP > 0
    ),
  { summonProjection, summonEnvelope },
);

const shieldSkill = {
  id: 'shield',
  name: '护盾',
  魂技名: '护盾',
  消耗: '无',
  _效果数组: [{ ...effects.护盾变化, effectId: 'shield-effect' }],
};
const shieldWorld = world(
  unit('actor', 'player', { skills: [shieldSkill, damageSkill('actor-attack', 50)] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 160)] }),
);
const shieldWithRequest = prepare(shieldWorld);
const shieldWithCandidate = candidateBySkill(shieldWithRequest, 'shield');
const shieldWithProjection = projectionFor(shieldWithRequest, shieldWithCandidate);
const shieldWithoutRequest = prepare(shieldWorld, {
  runtimeSnapshot: runtimeSnapshot({
    opportunities: [],
  }),
});
shieldWithoutRequest.evaluationContext.opportunitySnapshot;
const shieldWithoutRoute = shieldWithoutRequest.actorCandidateRoutes[
  candidateBySkill(shieldWithoutRequest, 'shield').candidateId
];
const shieldWithoutProjection = decision.projectR8GoalUtility(
  {
    ...shieldWithoutRequest,
    evaluationContext: {
      ...shieldWithoutRequest.evaluationContext,
      opportunitySnapshot: [shieldWithoutRequest.actionOpportunity],
      scheduledEvents: [],
    },
  },
  candidateBySkill(shieldWithoutRequest, 'shield'),
  shieldWithoutRoute,
);
add(
  'shield:value-requires-real-hostile-opportunity',
  shieldWithProjection.actionPoolHEPP > 0 && shieldWithoutProjection.actionPoolHEPP === 0,
  { withWindow: shieldWithProjection.actionPoolHEPP, withoutWindow: shieldWithoutProjection.actionPoolHEPP },
);

const restoreSkill = {
  id: 'restore',
  name: '恢复魂力',
  魂技名: '恢复魂力',
  消耗: '无',
  _效果数组: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+50', effectId: 'restore-effect' }],
};
const resourceWorld = world(
  unit('actor', 'player', { sp: 0, skills: [restoreSkill, damageSkill('expensive', 220, 50), damageSkill('free', 30)] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 80)] }),
);
const resourceRequest = prepare(resourceWorld);
const restoreCandidate = candidateBySkill(resourceRequest, 'restore');
const restoreProjection = projectionFor(resourceRequest, restoreCandidate);
add(
  'resource:future-payment-capability-is-action-envelope-delta',
  restoreProjection.actionPoolHEPP > 0 &&
    resourceRequest.candidateEnvelopeDeltas[restoreCandidate.candidateId].some(entry =>
      entry.targetId === 'actor' && entry.afterPP > entry.beforePP
    ),
  {
    actionPoolHEPP: restoreProjection.actionPoolHEPP,
    envelope: resourceRequest.candidateEnvelopeDeltas[restoreCandidate.candidateId],
  },
);

const restoreRoute = resourceRequest.actorCandidateRoutes[
  restoreCandidate.candidateId
];
const restoreEnvelope = resourceRequest.candidateEnvelopeDeltas[
  restoreCandidate.candidateId
].find(entry => entry.targetId === 'actor');
const mixedResourceProjectedWorld = structuredClone(
  resourceRequest.actorProjectedWorlds[restoreCandidate.candidateId],
);
const mixedResourceEnemy =
  mixedResourceProjectedWorld.参战者.team_enemy[0];
mixedResourceEnemy.hp = 10;
mixedResourceEnemy.属性.HP = 10;
const mixedResourceRoute = {
  ...restoreRoute,
  healthTrajectoryByTarget: [
    ...(restoreRoute.healthTrajectoryByTarget || []),
    {
      targetId: 'enemy',
      outcomeKind: 'HP_DELTA',
      windowId: 'mixed-resource-direct-health',
      healthDeltaPP: -90,
      actorBenefitPP: 90,
      rootActionId: restoreCandidate.candidateId,
      sourceEffectInstanceId: 'mixed-resource-direct-health',
    },
  ],
};
const mixedResourceEnvelopeDeltas = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: resourceRequest.visibleWorld,
  actorSide: resourceRequest.actorSide,
  routeCatalog: resourceRequest.actionRouteCatalog,
  projectedWorlds: {
    [restoreCandidate.candidateId]: mixedResourceProjectedWorld,
  },
  projectedWorldRevisions: {
    [restoreCandidate.candidateId]: 'mixed-resource-projected-world',
  },
  candidateRoutes: {
    [restoreCandidate.candidateId]: mixedResourceRoute,
  },
  fullRoutesByUnit:
    decision.preparedRouteCacheSnapshot(resourceRequest).fullRoutesByUnit,
  resourceRouteCatalog: resourceRequest.actionRouteCatalog,
  resourceFullRoutesByUnit:
    decision.preparedRouteCacheSnapshot(resourceRequest).fullRoutesByUnit,
  beliefState: resourceRequest.beliefState,
  battleIntent: resourceRequest.battleIntent,
  actionOpportunity: resourceRequest.actionOpportunity,
  opportunitySnapshot:
    resourceRequest.evaluationContext.opportunitySnapshot,
  resourceTimeline:
    resourceRequest.evaluationContext.resourceTimeline,
  scheduledEvents:
    resourceRequest.evaluationContext.scheduledEvents,
  objectiveContract: resourceRequest.objectiveContract,
});
const mixedResourceEnvelope = mixedResourceEnvelopeDeltas[
  restoreCandidate.candidateId
].find(entry => entry.targetId === 'actor');
add(
  'resource:non-resource-outcomes-do-not-enter-resource-opportunity-delta',
  Math.abs(
    Number(mixedResourceEnvelope?.resourceOpportunityDeltaPP || 0) -
    Number(restoreEnvelope?.resourceOpportunityDeltaPP || 0)
  ) <= 1e-9 &&
    mixedResourceEnvelope?.beforeRouteKey === restoreEnvelope?.beforeRouteKey &&
    mixedResourceEnvelope?.afterRouteKey === restoreEnvelope?.afterRouteKey,
  {
    restore: {
      beforeRouteKey: restoreEnvelope?.beforeRouteKey || '',
      afterRouteKey: restoreEnvelope?.afterRouteKey || '',
      resourceOpportunityDeltaPP: Number(
        restoreEnvelope?.resourceOpportunityDeltaPP || 0
      ),
    },
    mixed: {
      beforeRouteKey: mixedResourceEnvelope?.beforeRouteKey || '',
      afterRouteKey: mixedResourceEnvelope?.afterRouteKey || '',
      resourceOpportunityDeltaPP: Number(
        mixedResourceEnvelope?.resourceOpportunityDeltaPP || 0
      ),
    },
  },
);

const dotActor = unit('actor', 'player', {
  hp: 50,
  skills: [{
    id: 'hot',
    name: '持续恢复',
    魂技名: '持续恢复',
    消耗: '无',
    _效果数组: [{
      原型: '状态施加',
      目标: '自身',
      状态: '持续恢复',
      数值: '+5%',
      持续回合: 2,
      成功率: '100%',
      effectId: 'hot-effect',
    }],
  }],
});
const dotWorld = world(dotActor, unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 40)] }));
const hotPreview = preview.previewAction({
  worldSnapshot: dotWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'hot-action',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['actor'],
    skill: dotActor.技能列表[0],
  },
});
const hotScheduled = hotPreview.contributions.find(entry => entry.outcomeKind === 'SCHEDULED_HP_DELTA');
add(
  'lifecycle:dot-and-hot-use-signed-scheduled-health-trajectory',
  hotScheduled?.evidence?.delta > 0 &&
    prototypeRows.find(row => row.prototype === '状态施加')?.outcomeKinds.includes('SCHEDULED_HP_DELTA'),
  { hotScheduled, statePrototype: prototypeRows.find(row => row.prototype === '状态施加') },
);

const lifecycleActor = unit('actor', 'player', {
  hp: 60,
  skills: [],
  states: {
    中毒: {
      状态: '中毒',
      类型: '负面',
      duration: 2,
      战斗效果: { dot_damage_ratio: 0.05 },
    },
  },
});
const lifecycleWorld = world(
  lifecycleActor,
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 40)] }),
);
const removePreview = preview.previewAction({
  worldSnapshot: lifecycleWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'remove-dot',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['actor'],
    skill: {
      name: '净化',
      _效果数组: [{ 原型: '状态移除', 目标: '自身', 状态: '任意负面', 数量: 1, effectId: 'remove-effect' }],
    },
  },
});
const extendPreview = preview.previewAction({
  worldSnapshot: lifecycleWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'extend-dot',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['actor'],
    skill: {
      name: '延长',
      _效果数组: [{
        原型: '时窗修正',
        目标: '自身',
        调整字段: '持续回合',
        调整方式: '延长',
        调整回合: 1,
        effectId: 'extend-effect',
      }],
    },
  },
});
const removedDot = removePreview.contributions.find(entry => entry.outcomeKind === 'SCHEDULED_HP_DELTA');
const extendedDot = extendPreview.contributions.find(entry => entry.outcomeKind === 'SCHEDULED_HP_DELTA');
add(
  'lifecycle:remove-and-window-adjustment-own-only-the-remaining-ticks',
  Number(removedDot?.evidence?.delta || 0) === 10 &&
    Number(extendedDot?.evidence?.delta || 0) === -5,
  { removedDot, extendedDot },
);

const rewindActor = unit('actor', 'player', { hp: 30, sp: 20, skills: [] });
const rewindEnemy = unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 40)] });
const rewindWorld = world(rewindActor, rewindEnemy);
const rewindHistory = structuredClone(rewindWorld);
rewindHistory.参战者.team_player[0].hp = 80;
rewindHistory.参战者.team_player[0].HP = 80;
rewindHistory.参战者.team_player[0].属性.HP = 80;
rewindHistory.参战者.team_player[0].sp = 70;
rewindHistory.参战者.team_player[0].属性.魂力 = 70;
const rewindPreview = preview.previewAction({
  worldSnapshot: rewindWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'rewind',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['actor'],
    historySnapshot: rewindHistory,
    skill: { name: '回溯', _效果数组: [{ ...effects.时光回溯, effectId: 'rewind-effect' }] },
  },
});
add(
  'rewind:restored-hp-and-resource-are-atomic-value-facts',
  rewindPreview.contributions.some(entry =>
    entry.outcomeKind === 'HP_DELTA' && Number(entry?.evidence?.delta || 0) === 50
  ) &&
    rewindPreview.contributions.some(entry =>
      entry.outcomeKind === 'RESOURCE_OPTION_CHANGED' &&
      entry?.evidence?.resource === '魂力' &&
      Number(entry?.evidence?.delta || 0) === 50
    ),
  { contributions: rewindPreview.contributions },
);

const creationSkill = {
  id: 'create-heal',
  name: '制造恢复物',
  魂技名: '制造恢复物',
  消耗: '无',
  生成物: { id: '恢复物', 名称: '恢复物' },
  _效果数组: [{
    目标: '自身',
    数量: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '生命', 数值: '+30' }],
  }],
};
const equipmentItem = {
  id: '力量护符',
  name: '力量护符',
  类型: '装备',
  数量: 1,
  装备属性: { 力量: '+50%' },
};
const creationWorld = world(
  unit('actor', 'player', {
    hp: 40,
    skills: [creationSkill, damageSkill('actor-attack', 40)],
    inventory: { 力量护符: equipmentItem },
  }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 80)] }),
);
const creationRequest = prepare(creationWorld);
const creationCandidate = candidateBySkill(creationRequest, 'create-heal');
const creationProjection = projectionFor(creationRequest, creationCandidate);
const equipmentCandidate = creationRequest.frozenCandidates.find(candidate =>
  String(candidate?.declaration?.actionKind || '').trim() === 'EQUIP'
);
const equipmentProjection = projectionFor(creationRequest, equipmentCandidate);
add(
  'inventory:creation-and-equipment-enter-future-action-envelope',
  creationProjection.actionPoolHEPP > 0 &&
    equipmentProjection.actionPoolHEPP > 0 &&
    creationRequest.candidateEnvelopeDeltas[creationCandidate.candidateId].some(entry =>
      entry.targetId === 'actor' && entry.afterPP > entry.beforePP
    ),
  {
    creationActionPoolHEPP: creationProjection.actionPoolHEPP,
    equipmentActionPoolHEPP: equipmentProjection.actionPoolHEPP,
    creationEnvelope: creationRequest.candidateEnvelopeDeltas[creationCandidate.candidateId],
  },
);

function consumableWorld(quantity) {
  return world(
    unit('actor', 'player', {
      hp: 40,
      skills: [damageSkill('actor-attack', 40)],
      inventory: {
        恢复食物: {
          id: 'restore-food',
          name: '恢复食物',
          名称: '恢复食物',
          类型: '食物',
          数量: quantity,
          _效果数组: [{
            原型: '资源变化',
            目标: '自身',
            资源: '生命',
            数值: '+30',
            effectId: 'restore-food-effect',
          }],
        },
      },
    }),
    unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 80)] }),
  );
}
const oneItemAudit = decision.runR8Provider(prepare(consumableWorld(1)));
const twoItemAudit = decision.runR8Provider(prepare(consumableWorld(2)));
const itemRecord = audit => audit.candidateAudit.find(record =>
  record?.declaration?.irreversibleAsset?.assetId === 'restore-food'
);
const oneItemRecord = itemRecord(oneItemAudit);
const twoItemRecord = itemRecord(twoItemAudit);
add(
  'inventory:item-quantity-enters-pareto-asset-reserve-without-direct-score',
  oneItemRecord?.vector?.assetReserve === 0 &&
    twoItemRecord?.vector?.assetReserve === 50 &&
    oneItemRecord?.objectiveUtilityHEPP === twoItemRecord?.objectiveUtilityHEPP,
  { oneItemRecord, twoItemRecord },
);

const ruleDefenseSkill = {
  id: 'rule-defense',
  name: '规则防御',
  魂技名: '规则防御',
  消耗: '无',
  _效果数组: [{
    原型: '规则防御',
    目标: '自身',
    规则: '免伤',
    次数: 1,
    持续回合: 1,
    effectId: 'rule-defense-effect',
  }],
};
const ruleDefenseRequest = prepare(world(
  unit('actor', 'player', { skills: [ruleDefenseSkill, damageSkill('actor-attack', 50)] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-heavy', 180)] }),
));
const ruleDefenseCandidate = candidateBySkill(ruleDefenseRequest, 'rule-defense');
const ruleDefenseProjection = projectionFor(ruleDefenseRequest, ruleDefenseCandidate);
const ruleDefenseEnemyDelta = ruleDefenseRequest.candidateEnvelopeDeltas[
  ruleDefenseCandidate.candidateId
].find(entry => entry.targetId === 'enemy');
add(
  'rule-defense:actual-incoming-route-is-reduced',
  ruleDefenseProjection.actionPoolHEPP > 0 &&
    ruleDefenseEnemyDelta?.afterPP < ruleDefenseEnemyDelta?.beforePP,
  { projection: ruleDefenseProjection, enemyEnvelope: ruleDefenseEnemyDelta },
);

const disarmSkill = {
  id: 'disarm-rule',
  name: '缴械规则',
  魂技名: '缴械规则',
  消耗: '无',
  _效果数组: [{
    原型: '规则改写',
    目标: '单体',
    规则: '缴械',
    数值: '+25%',
    持续回合: 1,
    effectId: 'disarm-effect',
  }],
};
const disarmRequest = prepare(world(
  unit('actor', 'player', { skills: [disarmSkill, damageSkill('actor-attack', 50)] }),
  unit('enemy', 'enemy', { skills: [] }),
));
const disarmCandidate = candidateBySkill(disarmRequest, 'disarm-rule');
const disarmProjection = projectionFor(disarmRequest, disarmCandidate);
const disarmEnemyDelta = disarmRequest.candidateEnvelopeDeltas[
  disarmCandidate.candidateId
].find(entry => entry.targetId === 'enemy');
add(
  'rule-rewrite:disarm-removes-a-real-attack-route',
  disarmProjection.actionPoolHEPP > 0 &&
    disarmEnemyDelta?.beforePP > 0 &&
    disarmEnemyDelta?.afterPP === 0,
  { projection: disarmProjection, enemyEnvelope: disarmEnemyDelta },
);

const suppressSkill = {
  id: 'suppress-defense',
  name: '抹消防御',
  魂技名: '抹消防御',
  消耗: '无',
  _效果数组: [{
    原型: '机制抹消',
    目标: '单体',
    抹消对象: { 原型: '规则防御' },
    持续回合: 1,
    effectId: 'suppress-defense-effect',
  }],
};
const defendedEnemy = unit('enemy', 'enemy', {
  skills: [damageSkill('enemy-attack', 50)],
  states: {
    免伤规则: {
      状态: '规则防御:免伤',
      类型: 'buff',
      duration: 2,
      来源原型摘要: '规则防御',
      战斗效果: { damage_reduction: 0.5 },
    },
    无关增益: {
      状态: '力量增益',
      类型: 'buff',
      duration: 2,
      来源原型摘要: '属性修正',
      战斗效果: { damage_bonus: 0.1 },
    },
  },
});
const suppressRequest = prepare(world(
  unit('actor', 'player', { skills: [suppressSkill, damageSkill('actor-heavy', 180)] }),
  defendedEnemy,
));
const suppressCandidate = candidateBySkill(suppressRequest, 'suppress-defense');
const suppressProjection = projectionFor(suppressRequest, suppressCandidate);
const suppressPreview = preview.previewAction({
  worldSnapshot: suppressRequest.visibleWorld,
  actorId: 'actor',
  declaration: suppressCandidate.declaration,
  actionFingerprint: suppressCandidate.declarationFingerprint,
});
const suppressAfterEnemy = preview.findUnit(
  suppressPreview.afterSnapshot,
  'enemy',
);
add(
  'mechanism-suppress:only-the-matched-real-mechanism-is-removed',
  suppressProjection.actionPoolHEPP > 0 &&
    !Object.values(suppressAfterEnemy?.状态效果 || {}).some(state =>
      String(state?.状态 || '').startsWith('规则防御:')
    ) &&
    Object.values(suppressAfterEnemy?.状态效果 || {}).some(state =>
      String(state?.状态 || '') === '力量增益'
    ),
  {
    projection: suppressProjection,
    states: suppressAfterEnemy?.状态效果,
  },
);

const suppressDotSkill = {
  id: 'suppress-dot',
  name: '抹消持续伤害',
  魂技名: '抹消持续伤害',
  消耗: '无',
  _效果数组: [{
    原型: '机制抹消',
    目标: '单体',
    抹消对象: { 原型: '状态施加', 状态: '中毒' },
    持续回合: 1,
    effectId: 'suppress-dot-effect',
  }],
};
const poisonedEnemy = unit('enemy', 'enemy', {
  skills: [damageSkill('enemy-attack', 50)],
  states: {
    中毒: {
      状态: '中毒',
      状态名称: '中毒',
      类型: 'debuff',
      duration: 3,
      来源原型摘要: '状态施加',
      战斗效果: { dot_damage: 5 },
    },
  },
});
const suppressDotRequest = prepare(world(
  unit('actor', 'player', { skills: [suppressDotSkill] }),
  poisonedEnemy,
));
const suppressDotCandidate = candidateBySkill(suppressDotRequest, 'suppress-dot');
const suppressDotPreview = preview.previewAction({
  worldSnapshot: suppressDotRequest.visibleWorld,
  actorId: 'actor',
  declaration: suppressDotCandidate.declaration,
  actionFingerprint: suppressDotCandidate.declarationFingerprint,
});
const suppressDotWindow = suppressDotPreview.contributions.find(entry =>
  entry.outcomeKind === 'SCHEDULED_HP_DELTA' &&
  entry.effectInstanceId === 'suppress-dot-effect:removed-health',
);
add(
  'mechanism-suppress:removes-remaining-scheduled-health-window',
  !!suppressDotWindow &&
    Number(suppressDotWindow.evidence?.removedScheduledDelta || 0) === -15 &&
    Number(suppressDotWindow.evidence?.delta || 0) === 15 &&
    Number(suppressDotWindow.evidence?.tickCount || 0) === 3 &&
    suppressDotPreview.afterSnapshot.参战者.team_enemy[0].状态效果.中毒 === undefined,
  {
    contribution: suppressDotWindow,
    remainingStates: suppressDotPreview.afterSnapshot.参战者.team_enemy[0].状态效果,
  },
);

const grantSkill = {
  id: 'grant-next-damage',
  name: '授予下次增伤',
  魂技名: '授予下次增伤',
  消耗: '无',
  _效果数组: [{
    原型: '机制授予',
    目标: '自身',
    触发条件: '随下次行动触发',
    可用次数: 1,
    持续回合: 1,
    授予效果: [{
      原型: '结算修正',
      目标: '自身',
      结算: '造成伤害',
      数值: '+50%',
      持续回合: 1,
    }],
    effectId: 'grant-next-damage-effect',
  }],
};
const grantRequest = prepare(world(
  unit('actor', 'player', { skills: [grantSkill, damageSkill('actor-follow-up', 120)] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 50)] }),
));
const grantCandidate = candidateBySkill(grantRequest, 'grant-next-damage');
const grantProjection = projectionFor(grantRequest, grantCandidate);
const grantActorDelta = grantRequest.candidateEnvelopeDeltas[
  grantCandidate.candidateId
].find(entry => entry.targetId === 'actor');
add(
  'mechanism-grant:only-the-granted-next-action-effect-changes-the-route',
  grantProjection.actionPoolHEPP > 0 &&
    grantActorDelta?.afterPP > grantActorDelta?.beforePP &&
    !grantRequest.actorCandidateRoutes[grantCandidate.candidateId].outcomeKinds.includes('ACTION_GRANTED'),
  {
    projection: grantProjection,
    actorEnvelope: grantActorDelta,
    route: grantRequest.actorCandidateRoutes[grantCandidate.candidateId],
  },
);

const delayedDisarmSkill = {
  id: 'delayed-disarm',
  name: '延迟缴械',
  魂技名: '延迟缴械',
  消耗: '无',
  _效果数组: [{
    原型: '状态施加',
    目标: '单体',
    状态: '眩晕',
    数值: '-20%',
    持续回合: 1,
    延迟回合: 1,
    成功率: '100%',
    effectId: 'delayed-disarm-effect',
  }],
};
const delayedWorld = world(
  unit('actor', 'player', { skills: [delayedDisarmSkill, damageSkill('actor-attack', 50)] }),
  unit('enemy', 'enemy', { skills: [] }),
);
const delayedWithRequest = prepare(delayedWorld, {
  runtimeSnapshot: runtimeSnapshot({
    opportunities: [{
      opportunityId: 'natural:enemy:round2',
      ownerId: 'enemy',
      grantType: 'NATURAL_ACTION',
      status: 'PENDING',
      round: 2,
    }],
  }),
});
const delayedWithoutRequest = prepare(delayedWorld);
const delayedWithCandidate = candidateBySkill(delayedWithRequest, 'delayed-disarm');
const delayedWithoutCandidate = candidateBySkill(delayedWithoutRequest, 'delayed-disarm');
const delayedWithProjection = projectionFor(delayedWithRequest, delayedWithCandidate);
const delayedWithoutProjection = projectionFor(delayedWithoutRequest, delayedWithoutCandidate);
const delayedPreview = preview.previewAction({
  worldSnapshot: delayedWithRequest.visibleWorld,
  actorId: 'actor',
  declaration: delayedWithCandidate.declaration,
  actionFingerprint: delayedWithCandidate.declarationFingerprint,
});
add(
  'delayed-state:value-requires-an-opportunity-after-the-scheduled-round',
  delayedWithProjection.actionPoolHEPP > 0 &&
    delayedWithoutProjection.actionPoolHEPP === 0,
  {
    withFutureOpportunity: delayedWithProjection,
    withoutFutureOpportunity: delayedWithoutProjection,
    withEnvelope: delayedWithRequest.candidateEnvelopeDeltas[delayedWithCandidate.candidateId],
    withoutEnvelope: delayedWithoutRequest.candidateEnvelopeDeltas[delayedWithoutCandidate.candidateId],
    scheduledEvents: delayedPreview.scheduledEvents,
    projectedScheduledEvents: delayedPreview.afterSnapshot.__battlePreviewScheduledEvents,
    opportunitySnapshot: delayedWithRequest.evaluationContext.opportunitySnapshot,
  },
);

const displacementSkill = {
  id: 'hostile-displacement',
  name: '击退',
  魂技名: '击退',
  消耗: '无',
  _效果数组: [{
    原型: '位移执行',
    目标: '单体',
    位移类型: '击退',
    位移对象: '目标',
    距离: 20,
    持续回合: 1,
    effectId: 'displacement-effect',
  }],
};
const interferenceSkill = {
  id: 'target-interference',
  name: '索敌干扰',
  魂技名: '索敌干扰',
  消耗: '无',
  _效果数组: [{
    原型: '决策干扰',
    目标: '单体',
    干扰: '索敌干扰',
    数值: '-20%',
    持续回合: 1,
    effectId: 'interference-effect',
  }],
};
const behaviorDerivationRequest = prepare(world(
  unit('actor', 'player', {
    skills: [displacementSkill, interferenceSkill, damageSkill('actor-attack', 50)],
  }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 160)] }),
));
const displacementCandidate = candidateBySkill(behaviorDerivationRequest, 'hostile-displacement');
const interferenceCandidate = candidateBySkill(behaviorDerivationRequest, 'target-interference');
const displacementProjection = projectionFor(behaviorDerivationRequest, displacementCandidate);
const interferenceProjection = projectionFor(behaviorDerivationRequest, interferenceCandidate);
add(
  'behavior-derivation:position-and-interference-change-health-routes',
  displacementProjection.actionPoolHEPP > 0 &&
    interferenceProjection.actionPoolHEPP > 0,
  { displacementProjection, interferenceProjection },
);

const transferSkill = {
  id: 'transfer-debuff',
  name: '转移负面',
  魂技名: '转移负面',
  消耗: '无',
  _效果数组: [{
    原型: '状态转移',
    目标: '单体',
    状态: '任意负面',
    来源: '自身',
    去向: '目标',
    数量: 1,
    effectId: 'transfer-effect',
  }],
};
const exchangeSkill = {
  id: 'exchange-state',
  name: '交换状态',
  魂技名: '交换状态',
  消耗: '无',
  _效果数组: [{
    原型: '状态交换',
    目标: '单体',
    状态: '任意负面',
    effectId: 'exchange-effect',
  }],
};
const transferRequest = prepare(world(
  unit('actor', 'player', {
    skills: [transferSkill, exchangeSkill, damageSkill('actor-attack', 120)],
    states: {
      自身缴械: {
        状态: '缴械',
        类型: '负面',
        duration: 1,
        战斗效果: { disarm: true },
      },
    },
  }),
  unit('enemy', 'enemy', {
    skills: [damageSkill('enemy-attack', 120)],
    states: {
      目标增伤: {
        状态: '力量增益',
        类型: '增益',
        duration: 1,
        战斗效果: { damage_bonus: 0.3 },
      },
    },
  }),
));
const transferProjection = projectionFor(
  transferRequest,
  candidateBySkill(transferRequest, 'transfer-debuff'),
);
const exchangeProjection = projectionFor(
  transferRequest,
  candidateBySkill(transferRequest, 'exchange-state'),
);
add(
  'state-transaction:transfer-and-exchange-change-both-action-envelopes',
  transferProjection.actionPoolHEPP > 0 &&
    exchangeProjection.actionPoolHEPP > transferProjection.actionPoolHEPP,
  { transferProjection, exchangeProjection },
);

const deadlineWorld = world(
  unit('actor', 'player', { skills: [summonSkill, damageSkill('actor-attack', 50)] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 80)] }),
);
deadlineWorld.胜负条件.maxRounds = 1;
const deadlineRequest = prepare(deadlineWorld);
const deadlineCandidate = candidateBySkill(deadlineRequest, 'independent-summon');
const deadlineProjection = projectionFor(deadlineRequest, deadlineCandidate);
const fatalHostSummonSkill = {
  ...structuredClone(summonSkill),
  id: 'fatal-host-summon',
  name: '宿主终止召唤',
  魂技名: '宿主终止召唤',
  _效果数组: [
    ...structuredClone(summonSkill._效果数组),
    {
      原型: '伤害结算',
      目标: '自身',
      威力倍率: 1000,
      伤害类型: '真实攻击',
      命中概率: '100%',
      effectId: 'fatal-host-effect',
    },
  ],
};
const fatalHostRequest = prepare(world(
  unit('actor', 'player', { hp: 20, skills: [fatalHostSummonSkill] }),
  unit('enemy', 'enemy', { skills: [damageSkill('enemy-attack', 80)] }),
));
const fatalHostCandidate = candidateBySkill(fatalHostRequest, 'fatal-host-summon');
const fatalHostProjection = projectionFor(fatalHostRequest, fatalHostCandidate);
add(
  'summon:host-death-and-round-deadline-remove-future-window-value',
  deadlineProjection.actionPoolHEPP === 0 &&
    fatalHostProjection.actionPoolHEPP === 0,
  { deadlineProjection, fatalHostProjection },
);

const runtimeRuleAttack = damageSkill('runtime-rule-attack', 120);
const runtimeRulePlainWorld = world(
  unit('actor', 'player', { skills: [runtimeRuleAttack] }),
  unit('enemy', 'enemy', { hp: 100, skills: [] }),
);
const runtimeRuleDefendedWorld = world(
  unit('actor', 'player', { skills: [runtimeRuleAttack] }),
  unit('enemy', 'enemy', {
    hp: 100,
    skills: [],
    states: {
      规则防御: {
        状态: '规则防御:免伤',
        类型: 'buff',
        duration: 1,
        来源原型摘要: '规则防御',
        战斗效果: { damage_reduction: 0.5 },
      },
    },
  }),
);
runtime.executeDeclaration({
  combatData: runtimeRulePlainWorld,
  declaration: {
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: runtimeRuleAttack,
  },
  seed: 838200,
});
runtime.executeDeclaration({
  combatData: runtimeRuleDefendedWorld,
  declaration: {
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: runtimeRuleAttack,
  },
  seed: 838200,
});
const runtimeRulePlainDamage = 100 - preview.readHp(runtimeRulePlainWorld.参战者.team_enemy[0]);
const runtimeRuleDefendedDamage = 100 - preview.readHp(runtimeRuleDefendedWorld.参战者.team_enemy[0]);
const runtimeGrantAttack = damageSkill('runtime-grant-attack', 120);
const runtimeGrantWorld = world(
  unit('actor', 'player', {
    skills: [runtimeGrantAttack],
    states: {
      下次增伤: {
        状态: '机制授予',
        类型: 'buff',
        duration: 1,
        来源原型摘要: '机制授予',
        授予触发条件: '随下次行动触发',
        授予效果: [{
          原型: '结算修正',
          目标: '自身',
          结算: '造成伤害',
          数值: '+50%',
          持续回合: 1,
        }],
        可用次数: 1,
        战斗效果: {},
      },
    },
  }),
  unit('enemy', 'enemy', { hp: 100, skills: [] }),
);
runtime.executeDeclaration({
  combatData: runtimeGrantWorld,
  declaration: {
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: runtimeGrantAttack,
  },
  seed: 838201,
});
const runtimeGrantedDamage = 100 - preview.readHp(runtimeGrantWorld.参战者.team_enemy[0]);
add(
  'runtime:rule-defense-and-next-action-grant-realize-preview-direction',
  runtimeRulePlainDamage > runtimeRuleDefendedDamage &&
    Math.abs(runtimeRuleDefendedDamage * 2 - runtimeRulePlainDamage) <= 1 &&
    runtimeGrantedDamage > runtimeRulePlainDamage &&
    !Object.values(runtimeGrantWorld.参战者.team_player[0]?.状态效果 || {}).some(state =>
      /下次行动/.test(String(state?.授予触发条件 || ''))
    ),
  {
    runtimeRulePlainDamage,
    runtimeRuleDefendedDamage,
    runtimeGrantedDamage,
    remainingActorStates: runtimeGrantWorld.参战者.team_player[0]?.状态效果,
  },
);

const plainSkill = damageSkill('plain-ring-comparison', 40);
const burstSkill = {
  id: 'ring-burst',
  name: '炸环爆发',
  魂技名: '炸环爆发',
  消耗: '无',
  _效果数组: [
    { ...effects.炸环, effectId: 'ring-effect' },
    { 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击', 命中概率: '100%', effectId: 'ring-damage' },
  ],
};
const ringActor = unit('actor', 'player', { skills: [plainSkill, burstSkill] });
ringActor.第1武魂 = { 第1魂环: { 年限: 1000 } };
const ringEnemy = unit('enemy', 'enemy', { hp: 100, skills: [] });
const ringWorld = world(ringActor, ringEnemy);
const plainPreview = preview.previewAction({
  worldSnapshot: ringWorld,
  actorId: 'actor',
  declaration: { actionId: 'plain', actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['enemy'], skill: plainSkill },
});
const burstPreview = preview.previewAction({
  worldSnapshot: ringWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'burst',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: burstSkill,
    ringId: '第1武魂/第1魂环',
    ringPath: ['第1武魂', '第1魂环'],
  },
});
const previewPlainDamage = Math.abs(Number(plainPreview.contributions.find(entry => entry.outcomeKind === 'HP_DELTA')?.evidence?.delta || 0));
const previewBurstDamage = Math.abs(Number(burstPreview.contributions.find(entry => entry.outcomeKind === 'HP_DELTA')?.evidence?.delta || 0));
const runtimePlainWorld = structuredClone(ringWorld);
runtime.executeDeclaration({
  combatData: runtimePlainWorld,
  declaration: { actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['enemy'], skill: plainSkill },
  seed: 838100,
});
const runtimeBurstWorld = structuredClone(ringWorld);
runtime.executeDeclaration({
  combatData: runtimeBurstWorld,
  declaration: {
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: burstSkill,
    ringId: '第1武魂/第1魂环',
    ringPath: ['第1武魂', '第1魂环'],
  },
  seed: 838100,
});
const runtimePlainDamage = 100 - preview.readHp(runtimePlainWorld.参战者.team_enemy[0]);
const runtimeBurstDamage = 100 - preview.readHp(runtimeBurstWorld.参战者.team_enemy[0]);
add(
  'ring-burst:preview-and-runtime-apply-the-same-damage-multiplier',
  previewBurstDamage === runtimeBurstDamage &&
    previewPlainDamage === runtimePlainDamage &&
    Math.abs(previewBurstDamage - previewPlainDamage * 1.5) <= 1,
  { previewPlainDamage, previewBurstDamage, runtimePlainDamage, runtimeBurstDamage },
);

const source = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
add(
  'source:phase8-r8-path-does-not-call-legacy-value-compensation',
  !/function runR8Provider\([\s\S]*?\b(resourceThreatProfile|crisisResponseAudit|riskCompensationAudit|scoreCandidatesNext|stateUtilityNext)\s*\(/.test(source),
);

const failed = checks.filter(check => !check.passed);
console.log(JSON.stringify({
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    prototypeCount: prototypeRows.length,
    enumOptionCount,
    prototypeValuePathStatus: failed.length ? 'BLOCKED' : 'R8_PROTOTYPE_VALUE_PATH_PASSED',
  },
  checks,
}, null, 2));
if (failed.length) process.exitCode = 1;

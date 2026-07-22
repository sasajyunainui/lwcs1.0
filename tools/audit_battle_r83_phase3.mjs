import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
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

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

function unit(id, side, hp = 500) {
  return {
    id,
    name: id,
    名称: id,
    side,
    hp,
    hp_max: 500,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    属性: {
      等级: 50,
      HP: hp,
      HP上限: 500,
      魂力: 100,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 120,
      防御: 100,
      敏捷: 100,
      状态效果: {},
    },
    状态: { 存活: hp > 0, 行动: hp > 0 ? '战斗' : '失去战斗力' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: [],
  };
}

function objective() {
  return {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 5,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }] },
  };
}

const futureScheduleWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('future-fast', 'player', 500)],
    team_enemy: [unit('future-slow', 'enemy', 500)],
  },
};
futureScheduleWorld.参战者.team_player[0].agi = 200;
futureScheduleWorld.参战者.team_player[0].属性.敏捷 = 200;
futureScheduleWorld.参战者.team_enemy[0].agi = 50;
futureScheduleWorld.参战者.team_enemy[0].属性.敏捷 = 50;
const futureScheduleSnapshot = runtime.buildDecisionRuntimeSnapshot(
  futureScheduleWorld,
  'future-fast',
  {
    opportunityId: 'natural:1:player:future-fast:1',
    ownerId: 'future-fast',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
    battleHorizon: {
      currentRound: 1,
      finalRound: 4,
    },
  },
);
const futureNaturalDescriptors = futureScheduleSnapshot.scheduledEvents.filter(event =>
  event.eventType === 'FUTURE_NATURAL_ACTION'
);
addCheck(
  'runtime:future-natural-descriptors-cover-entire-horizon-in-formal-order',
  futureNaturalDescriptors.length === 6 &&
    new Set(futureNaturalDescriptors.map(event => event.descriptorId)).size === 6 &&
    JSON.stringify(futureNaturalDescriptors.map(event => [event.round, event.ownerId])) ===
      JSON.stringify([
        [2, 'future-fast'],
        [2, 'future-slow'],
        [3, 'future-fast'],
        [3, 'future-slow'],
        [4, 'future-fast'],
        [4, 'future-slow'],
      ]) &&
    futureNaturalDescriptors.every((event, index) =>
      event.creationSequence === index + 3 &&
      event.expirySequence === index + 3
    ),
  { futureNaturalDescriptors },
);

const conditionWorld = {
  回合: 1,
  时间段: '夜晚',
  环境: { 地形: '森林', 天气: '雨' },
  胜负条件: objective(),
  参战者: {
    team_player: [
      unit('condition-actor', 'player', 200),
      unit('condition-ally', 'player', 400),
    ],
    team_enemy: [unit('condition-enemy', 'enemy', 400)],
  },
};
const conditionActor = conditionWorld.参战者.team_player[0];
const conditionAlly = conditionWorld.参战者.team_player[1];
const conditionEnemy = conditionWorld.参战者.team_enemy[0];
conditionActor.魂力 = 40;
conditionActor.sp = 40;
conditionActor.属性.魂力 = 40;
conditionActor.护盾 = 25;
conditionActor.状态效果.蓄力中 = {
  状态: '蓄力中',
  状态名称: '蓄力中',
  duration: 1,
};
conditionActor.__battleRuntime = {
  equippedDecisionItem: { id: 'condition-sword', name: '条件剑' },
};
const conditionDeclaration = {
  actorId: 'condition-actor',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['condition-enemy'],
  skill: { name: '条件测试技' },
  fusionKey: 'condition-fusion',
  fusionParticipantIds: ['condition-actor', 'condition-ally'],
};
const conditionEnabled = (
  type,
  object,
  comparison,
  value,
  target = conditionActor,
) => preview.effectConditionEnabled(
  {
    原型: '状态施加',
    条件分支: [{
      条件: [{
        类型: type,
        对象: object,
        比较: comparison,
        值: value,
      }],
      处理: '生效',
    }],
  },
  conditionWorld,
  conditionActor,
  target,
  { declaration: conditionDeclaration },
);
addCheck(
  'preview:condition-matrix-uses-formal-world-state',
  conditionEnabled('生命比例', '自身', '<=', '40%') &&
    !conditionEnabled('生命比例', '自身', '<', '40%') &&
    conditionEnabled('生命数值', '自身', '==', '200') &&
    conditionEnabled('魂力比例', '自身', '<=', '40%') &&
    conditionEnabled('状态存在', '自身', '有', '蓄力中') &&
    conditionEnabled('护盾', '自身', '有', '') &&
    conditionEnabled('目标', '目标', '有', '敌对', conditionEnemy) &&
    conditionEnabled('目标', '目标', '有', '己方', conditionAlly) &&
    conditionEnabled('当前行动', '自身', '==', '魂技') &&
    conditionEnabled('环境满足', '自身', '==', '森林') &&
    conditionEnabled('时间', '自身', '==', '夜晚') &&
    conditionEnabled('装备状态', '自身', '==', '条件剑') &&
    conditionEnabled('自身状态', '自身', '==', '蓄力中') &&
    conditionEnabled('连携前提', '自身', '==', 'condition-fusion'),
);

const conditionalTransformEffect = {
  原型: '资源变化',
  目标: '自身',
  资源: '生命',
  数值: '+10%',
  条件分支: [
    {
      条件: [{ 类型: '时间', 对象: '自身', 比较: '==', 值: '夜晚' }],
      处理: '替换效果',
      替换效果: [{
        原型: '资源变化',
        目标: '自身',
        资源: '生命',
        数值: '+20%',
      }],
    },
    {
      条件: [{ 类型: '环境满足', 对象: '自身', 比较: '==', 值: '森林' }],
      处理: '追加效果',
      追加效果: [{
        原型: '资源变化',
        目标: '自身',
        资源: '生命',
        数值: '+5%',
      }],
    },
  ],
};
const conditionalTransformPlan = preview.resolveConditionalEffectPlan(
  conditionalTransformEffect,
  conditionWorld,
  conditionActor,
  conditionActor,
  { declaration: conditionDeclaration },
);
addCheck(
  'preview:conditional-transform-resolves-replacement-before-appends',
  conditionalTransformPlan.length === 2 &&
    conditionalTransformPlan[0]?.mode === 'REPLACE' &&
    conditionalTransformPlan[0]?.effect?.数值 === '+20%' &&
    conditionalTransformPlan[1]?.mode === 'APPEND' &&
    conditionalTransformPlan[1]?.effect?.数值 === '+5%',
  { conditionalTransformPlan },
);

const conditionalTransformDeclaration = {
  actorId: 'condition-actor',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['condition-actor'],
  resourceCosts: {},
  skill: {
    name: '条件改写测试技',
    魂技名: '条件改写测试技',
    _效果数组: [conditionalTransformEffect],
  },
};
const conditionalTransformPreview = preview.previewAction({
  worldSnapshot: conditionWorld,
  actorId: 'condition-actor',
  declaration: conditionalTransformDeclaration,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const conditionalTransformRuntimeWorld = structuredClone(conditionWorld);
const conditionalTransformRuntime = runtime.executeStructuredDeclaration({
  combatData: conditionalTransformRuntimeWorld,
  declaration: structuredClone(conditionalTransformDeclaration),
});
addCheck(
  'preview-runtime:conditional-replacement-and-append-calibrated',
  preview.readHp(
    preview.findUnit(
      conditionalTransformPreview.afterSnapshot,
      'condition-actor',
    ),
  ) === 325 &&
    preview.readHp(
      preview.findUnit(
        conditionalTransformRuntimeWorld,
        'condition-actor',
      ),
    ) === 325 &&
    conditionalTransformPreview.contributions.filter(entry =>
      entry.outcomeKind === 'HP_DELTA'
    ).length === 2 &&
    conditionalTransformRuntime.facts.filter(entry =>
      entry.eventKind === 'resource_change' &&
      entry.meta?.resource === '生命'
    ).length === 2,
  {
    previewHp: preview.readHp(
      preview.findUnit(
        conditionalTransformPreview.afterSnapshot,
        'condition-actor',
      ),
    ),
    runtimeHp: preview.readHp(
      preview.findUnit(
        conditionalTransformRuntimeWorld,
        'condition-actor',
      ),
    ),
    previewContributions: conditionalTransformPreview.contributions,
    runtimeFacts: conditionalTransformRuntime.facts,
  },
);

const conditionalPerTargetDeclaration = {
  actorId: 'condition-actor',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['condition-enemy'],
  resourceCosts: {},
  skill: {
    name: '条件逐目标测试技',
    魂技名: '条件逐目标测试技',
    _效果数组: [{
      原型: '资源变化',
      目标: '全场',
      资源: '生命',
      数值: '-10%',
      条件分支: [
        {
          条件: [{ 类型: '目标', 对象: '目标', 比较: '有', 值: '己方' }],
          处理: '替换效果',
          替换效果: [{
            原型: '资源变化',
            目标: '全场',
            资源: '生命',
            数值: '+10%',
          }],
        },
        {
          条件: [{ 类型: '目标', 对象: '目标', 比较: '有', 值: '敌方' }],
          处理: '追加效果',
          追加效果: [{
            原型: '资源变化',
            目标: '全场',
            资源: '生命',
            数值: '-5%',
          }],
        },
      ],
    }],
  },
};
const conditionalPerTargetPreview = preview.previewAction({
  worldSnapshot: conditionWorld,
  actorId: 'condition-actor',
  declaration: conditionalPerTargetDeclaration,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const conditionalPerTargetPreviewHp = Object.fromEntries(
  preview.listUnits(conditionalPerTargetPreview.afterSnapshot).map(entry => [
    preview.unitId(entry.unit),
    preview.readHp(entry.unit),
  ]),
);
const conditionalPerTargetRuntimeWorld = structuredClone(conditionWorld);
const conditionalPerTargetRuntime = runtime.executeStructuredDeclaration({
  combatData: conditionalPerTargetRuntimeWorld,
  declaration: structuredClone(conditionalPerTargetDeclaration),
});
const conditionalPerTargetRuntimeHp = Object.fromEntries(
  preview.listUnits(conditionalPerTargetRuntimeWorld).map(entry => [
    preview.unitId(entry.unit),
    preview.readHp(entry.unit),
  ]),
);
addCheck(
  'preview-runtime:conditional-transform-is-resolved-per-target',
  conditionalPerTargetPreviewHp['condition-actor'] === 250 &&
    conditionalPerTargetPreviewHp['condition-ally'] === 450 &&
    conditionalPerTargetPreviewHp['condition-enemy'] === 325 &&
    JSON.stringify(conditionalPerTargetRuntimeHp) ===
      JSON.stringify(conditionalPerTargetPreviewHp) &&
    conditionalPerTargetRuntime.facts.filter(entry =>
      entry.eventKind === 'resource_change' &&
      entry.meta?.resource === '生命'
    ).length === 4,
  {
    conditionalPerTargetPreviewHp,
    conditionalPerTargetRuntimeHp,
    runtimeFacts: conditionalPerTargetRuntime.facts,
  },
);

const correlatedConditionalSkill = {
  name: '概率条件关联测试技',
  魂技名: '概率条件关联测试技',
  _效果数组: [
    {
      effectId: 'correlated-primary-damage',
      原型: '伤害结算',
      目标: '单体',
      威力倍率: 100,
      伤害类型: '近身攻击',
      命中概率: '50%',
      攻击段数: 1,
    },
    {
      effectId: 'correlated-hit-loss',
      原型: '资源变化',
      目标: '单体',
      资源: '生命',
      数值: '-20%',
      条件分支: [{
        条件: [{ 类型: '命中', 对象: '目标', 比较: '有', 值: '' }],
        处理: '生效',
      }],
    },
    {
      effectId: 'correlated-evade-loss',
      原型: '资源变化',
      目标: '单体',
      资源: '生命',
      数值: '-10%',
      条件分支: [{
        条件: [{ 类型: '被闪避', 对象: '目标', 比较: '有', 值: '' }],
        处理: '生效',
      }],
    },
  ],
};
const correlatedConditionalDeclaration = {
  actorId: 'condition-actor',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['condition-enemy'],
  resourceCosts: {},
  skill: correlatedConditionalSkill,
};
const correlatedConditionalPreview = preview.previewAction({
  worldSnapshot: conditionWorld,
  actorId: 'condition-actor',
  declaration: correlatedConditionalDeclaration,
  actionFingerprint: 'phase3:correlated-conditionals',
  hitProbabilityResolver: () => 0.5,
  evadeProbabilityByTarget: { 'condition-enemy': 0.25 },
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const correlatedPrimary = correlatedConditionalPreview.contributions.find(entry =>
  entry.effectInstanceId === 'correlated-primary-damage' &&
  entry.outcomeKind === 'HP_DELTA'
);
const correlatedHitLoss = correlatedConditionalPreview.contributions.find(entry =>
  entry.effectInstanceId === 'correlated-hit-loss' &&
  entry.outcomeKind === 'HP_DELTA'
);
const correlatedEvadeLoss = correlatedConditionalPreview.contributions.find(entry =>
  entry.effectInstanceId === 'correlated-evade-loss' &&
  entry.outcomeKind === 'HP_DELTA'
);
const primaryAssignmentKey = Object.keys(
  correlatedPrimary?.evidence?.outcomeDistribution
    ?.find(branch => branch.assignments)?.assignments || {}
)[0] || '';
const conditionalOnValues = entry => new Set(
  (entry?.evidence?.outcomeDistribution || []).flatMap(branch =>
    Object.values(branch?.conditionalOn || {})
  ),
);
addCheck(
  'preview:hit-evade-and-miss-conditionals-share-primary-outcome-key',
  !!primaryAssignmentKey &&
    (correlatedPrimary?.evidence?.outcomeDistribution || []).some(branch =>
      branch.assignments?.[primaryAssignmentKey] === 'HIT'
    ) &&
    (correlatedPrimary?.evidence?.outcomeDistribution || []).some(branch =>
      branch.assignments?.[primaryAssignmentKey] === 'MISS'
    ) &&
    (correlatedPrimary?.evidence?.outcomeDistribution || []).some(branch =>
      branch.assignments?.[primaryAssignmentKey] === 'EVADED'
    ) &&
    Math.abs(Number(correlatedHitLoss?.evidence?.applicationProbability || 0) - 0.375) < 1e-9 &&
    Math.abs(Number(correlatedHitLoss?.evidence?.delta || 0) + 37.5) < 1e-9 &&
    conditionalOnValues(correlatedHitLoss).has('HIT') &&
    Math.abs(Number(correlatedEvadeLoss?.evidence?.applicationProbability || 0) - 0.25) < 1e-9 &&
    Math.abs(Number(correlatedEvadeLoss?.evidence?.delta || 0) + 12.5) < 1e-9 &&
    conditionalOnValues(correlatedEvadeLoss).has('EVADED'),
  {
    primaryAssignmentKey,
    correlatedPrimary,
    correlatedHitLoss,
    correlatedEvadeLoss,
  },
);

const originalRandom = sandbox.Math.random;
const runtimeConditionalWorld = () => structuredClone(conditionWorld);
const executeConditionalRuntime = (roll, reactionByTarget = {}) => {
  sandbox.Math.random = () => roll;
  const world = runtimeConditionalWorld();
  const result = runtime.executeStructuredDeclaration({
    combatData: world,
    declaration: structuredClone(correlatedConditionalDeclaration),
    reactionByTarget,
  });
  return {
    hp: preview.readHp(preview.findUnit(world, 'condition-enemy')),
    facts: result.facts,
  };
};
const runtimeConditionalHit = executeConditionalRuntime(0);
const runtimeConditionalMiss = executeConditionalRuntime(0.99);
const runtimeConditionalEvaded = executeConditionalRuntime(0, {
  'condition-enemy': {
    evaded: true,
    event: {
      eventId: 'phase3:evade',
      chainNodeId: 'phase3:evade-node',
    },
  },
});
sandbox.Math.random = originalRandom;
const runtimeHasResourceDelta = (result, delta) => result.facts.some(fact =>
  fact.eventKind === 'resource_change' &&
  fact.meta?.resource === '生命' &&
  Math.abs(Number(fact.meta?.delta || 0) - delta) < 1e-9
);
addCheck(
  'preview-runtime:correlated-conditionals-distinguish-hit-miss-and-evade',
  runtimeConditionalHit.hp < 300 &&
    runtimeHasResourceDelta(runtimeConditionalHit, -100) &&
    runtimeConditionalMiss.hp === 400 &&
    !runtimeHasResourceDelta(runtimeConditionalMiss, -100) &&
    !runtimeHasResourceDelta(runtimeConditionalMiss, -50) &&
    runtimeConditionalEvaded.hp === 350 &&
    !runtimeHasResourceDelta(runtimeConditionalEvaded, -100) &&
    runtimeHasResourceDelta(runtimeConditionalEvaded, -50),
  {
    runtimeConditionalHit,
    runtimeConditionalMiss,
    runtimeConditionalEvaded,
  },
);

const resistedIsNotEvadedPreview = preview.previewAction({
  worldSnapshot: conditionWorld,
  actorId: 'condition-actor',
  declaration: {
    actorId: 'condition-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['condition-enemy'],
    resourceCosts: {},
    skill: {
      name: '抵抗与闪避区分测试技',
      魂技名: '抵抗与闪避区分测试技',
      _效果数组: [
        {
          effectId: 'resisted-primary-state',
          原型: '状态施加',
          目标: '单体',
          状态: '标记',
          持续回合: 1,
          成功率: '50%',
        },
        {
          effectId: 'resisted-evade-loss',
          原型: '资源变化',
          目标: '单体',
          资源: '生命',
          数值: '-10%',
          条件分支: [{
            条件: [{ 类型: '被闪避', 对象: '目标', 比较: '有', 值: '' }],
            处理: '生效',
          }],
        },
      ],
    },
  },
  actionFingerprint: 'phase3:resisted-is-not-evaded',
  applicationProbabilityResolver: () => 0.5,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const resistedPrimary = resistedIsNotEvadedPreview.contributions.find(entry =>
  entry.effectInstanceId === 'resisted-primary-state' &&
  entry.outcomeKind === 'STATE_CHANGED'
);
addCheck(
  'preview:state-resisted-is-not-treated-as-formal-evade',
  (resistedPrimary?.evidence?.outcomeDistribution || []).some(branch =>
    Object.values(branch?.assignments || {}).includes('HIT')
  ) &&
    (resistedPrimary?.evidence?.outcomeDistribution || []).some(branch =>
      Object.values(branch?.assignments || {}).includes('RESISTED')
    ) &&
    !resistedIsNotEvadedPreview.contributions.some(entry =>
      entry.effectInstanceId === 'resisted-evade-loss'
    ),
  {
    resistedPrimary,
    contributions: resistedIsNotEvadedPreview.contributions,
  },
);

const conditionalGroupSkill = {
  name: '友方全场恢复',
  魂技名: '友方全场恢复',
  _效果数组: [{
    原型: '资源变化',
    目标: '全场',
    生效方式: '独立生效',
    资源: '生命',
    数值: '+10%',
    条件分支: [{
      条件: [{ 类型: '目标', 对象: '目标', 比较: '有', 值: '己方' }],
      处理: '生效',
    }],
  }],
};
const conditionalGroupDeclaration = {
  actorId: 'condition-actor',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['condition-enemy'],
  resourceCosts: {},
  skill: conditionalGroupSkill,
};
const conditionalGroupPreview = preview.previewAction({
  worldSnapshot: conditionWorld,
  actorId: 'condition-actor',
  declaration: conditionalGroupDeclaration,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const conditionalPreviewHp = Object.fromEntries(
  preview.listUnits(conditionalGroupPreview.afterSnapshot).map(entry => [
    preview.unitId(entry.unit),
    preview.readHp(entry.unit),
  ]),
);
const conditionalRuntimeWorld = structuredClone(conditionWorld);
const conditionalGroupRuntime = runtime.executeStructuredDeclaration({
  combatData: conditionalRuntimeWorld,
  declaration: structuredClone(conditionalGroupDeclaration),
});
const conditionalRuntimeHp = Object.fromEntries(
  preview.listUnits(conditionalRuntimeWorld).map(entry => [
    preview.unitId(entry.unit),
    preview.readHp(entry.unit),
  ]),
);
addCheck(
  'preview-runtime:conditional-group-target-filter-calibrated',
  conditionalPreviewHp['condition-actor'] === 250 &&
    conditionalPreviewHp['condition-ally'] === 450 &&
    conditionalPreviewHp['condition-enemy'] === 400 &&
    JSON.stringify(conditionalRuntimeHp) === JSON.stringify(conditionalPreviewHp) &&
    conditionalGroupRuntime.facts.filter(fact =>
      fact.eventKind === 'resource_change' &&
      fact.meta?.resource === '生命'
    ).length === 2,
  {
    conditionalPreviewHp,
    conditionalRuntimeHp,
    runtimeFacts: conditionalGroupRuntime.facts,
  },
);

const probabilityWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('probability-actor', 'player', 100)],
    team_enemy: [unit('probability-target', 'enemy', 100)],
  },
};
probabilityWorld.参战者.team_player[0].str = 10000;
probabilityWorld.参战者.team_player[0].属性.力量 = 10000;
probabilityWorld.参战者.team_enemy[0].def = 1;
probabilityWorld.参战者.team_enemy[0].属性.防御 = 1;
const probabilityPreview = preview.previewAction({
  worldSnapshot: probabilityWorld,
  actorId: 'probability-actor',
  declaration: {
    actorId: 'probability-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['probability-target'],
    resourceCosts: {},
    skill: {
      name: '概率致死校准',
      _效果数组: [{
        原型: '伤害结算',
        目标: '单体',
        威力倍率: 10000,
        伤害类型: '近身攻击',
        命中概率: '50%',
        攻击段数: 1,
      }],
    },
  },
  actionFingerprint: 'phase3:probability-lethal',
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const probabilityDamage = probabilityPreview.contributions.find(entry =>
  entry.outcomeKind === 'HP_DELTA' &&
  entry.targetId === 'probability-target'
);
addCheck(
  'preview:probabilistic-lethal-keeps-expected-hp',
    Math.abs(Number(probabilityDamage?.evidence?.expectedDamage || 0) - 50) < 1e-9 &&
    Math.abs(Number(probabilityDamage?.evidence?.fullHitDamage || 0) - 100) < 1e-9 &&
    Math.abs(preview.readHp(probabilityPreview.afterSnapshot.参战者.team_enemy[0]) - 50) < 1e-9,
  { probabilityDamage },
);

const dotProbabilityWorld = structuredClone(probabilityWorld);
dotProbabilityWorld.参战者.team_enemy[0].hp = 40;
dotProbabilityWorld.参战者.team_enemy[0].HP = 40;
dotProbabilityWorld.参战者.team_enemy[0].属性.HP = 40;
const dotProbabilityPreview = preview.previewAction({
  worldSnapshot: dotProbabilityWorld,
  actorId: 'probability-actor',
  declaration: {
    actorId: 'probability-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['probability-target'],
    resourceCosts: {},
    skill: {
      name: '概率持续致死校准',
      _效果数组: [{
        原型: '状态施加',
        目标: '单体',
        状态: '灼烧',
        数值: '-100%',
        持续回合: 3,
        成功率: '50%',
        战斗效果: { dot_damage_ratio: 1 },
      }],
    },
  },
  actionFingerprint: 'phase3:probability-dot-lethal',
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const dotProbabilityDamage = dotProbabilityPreview.contributions.find(entry =>
  entry.outcomeKind === 'SCHEDULED_HP_DELTA' &&
  entry.targetId === 'probability-target'
);
addCheck(
  'preview:probabilistic-dot-clamps-before-expectation',
  Math.abs(Number(dotProbabilityDamage?.evidence?.expectedDamage || 0) - 20) < 1e-9 &&
    Math.abs(Number(dotProbabilityDamage?.evidence?.applicationProbability || 0) - 0.5) < 1e-9,
  { dotProbabilityDamage },
);

const followedObjective = {
  ...objective(),
  victory: {
    logic: 'ANY',
    conditions: [{
      type: 'UNIT_DEAD',
      side: 'ENEMY',
      targetIds: ['probability-target'],
    }],
  },
};
const followedWorld = structuredClone(probabilityWorld);
followedWorld.胜负条件 = followedObjective;
const followedPreview = preview.previewAction({
  worldSnapshot: followedWorld,
  actorId: 'probability-actor',
  declaration: {
    actorId: 'probability-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['probability-target'],
    resourceCosts: {},
    skill: {
      name: '主效果依赖校准',
      _效果数组: [
        {
          原型: '状态施加',
          目标: '单体',
          状态: '标记',
          持续回合: 1,
          成功率: '50%',
        },
        {
          原型: '伤害结算',
          目标: '单体',
          生效方式: '跟随主原型',
          威力倍率: 10000,
          伤害类型: '近身攻击',
          命中概率: '100%',
          攻击段数: 1,
        },
      ],
    },
  },
  actionFingerprint: 'phase3:followed-terminal',
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const followedCandidate = {
  candidateId: 'phase3:followed-terminal',
  declaration: {
    actorId: 'probability-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['probability-target'],
  },
  declarationFingerprint: 'phase3:followed-terminal',
};
const followedRoute = decision.actionRouteFromPreview({
  candidate: followedCandidate,
  previewResult: followedPreview,
  worldSnapshot: followedWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
});
const followedTerminal = decision.r8TerminalUtility({
  actorId: 'probability-actor',
  actorSide: 'team_player',
  visibleWorld: followedWorld,
  objectiveContract: followedObjective,
}, followedRoute);
const followedStateFactor = followedRoute.probabilityFactors.find(factor =>
  factor.outcomeKind === 'STATE_CHANGED' &&
  factor.targetId === 'probability-target'
);
const followedDamageRoute = followedRoute.healthTrajectoryByTarget.find(trajectory =>
  trajectory.outcomeKind === 'HP_DELTA' &&
  trajectory.targetId === 'probability-target'
);
addCheck(
  'preview:followed-effect-shares-primary-outcome',
  followedStateFactor?.outcomeDistribution?.length === 2 &&
    followedDamageRoute?.outcomeDistribution?.some(branch =>
      Object.values(branch.conditionalOn || {}).includes('HIT')
    ) &&
    followedDamageRoute?.outcomeDistribution?.some(branch =>
      Object.values(branch.conditionalOn || {}).includes('RESISTED')
    ) &&
    Math.abs(Number(followedTerminal.terminalProbability || 0) - 0.5) < 1e-9 &&
    followedTerminal.terminal !== true,
  {
    followedStateFactor,
    followedDamageRoute,
    followedTerminal,
  },
);

const incapacitationObjective = {
  ...objective(),
  victory: {
    logic: 'ANY',
    conditions: [{
      type: 'UNIT_INCAPACITATED',
      side: 'ENEMY',
      targetIds: ['probability-target'],
    }],
  },
};
const incapacitationWorld = structuredClone(probabilityWorld);
incapacitationWorld.胜负条件 = incapacitationObjective;
const incapacitationPreview = preview.previewAction({
  worldSnapshot: incapacitationWorld,
  actorId: 'probability-actor',
  declaration: {
    actorId: 'probability-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['probability-target'],
    resourceCosts: {},
    skill: {
      name: '概率非致命击倒校准',
      _效果数组: [{
        原型: '伤害结算',
        目标: '单体',
        威力倍率: 10000,
        伤害类型: '近身攻击',
        命中概率: '50%',
        攻击段数: 1,
      }],
    },
  },
  actionFingerprint: 'phase3:probabilistic-incapacitation',
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
  battleIntent: {
    mode: '非致命',
    objectives: incapacitationObjective,
  },
});
const incapacitationRoute = decision.actionRouteFromPreview({
  candidate: {
    candidateId: 'phase3:probabilistic-incapacitation',
    declaration: {
      actorId: 'probability-actor',
      actionKind: 'RELEASE_SKILL',
      targetIds: ['probability-target'],
    },
    declarationFingerprint: 'phase3:probabilistic-incapacitation',
  },
  previewResult: incapacitationPreview,
  worldSnapshot: incapacitationWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
});
const incapacitationTerminal = decision.r8TerminalUtility({
  actorId: 'probability-actor',
  actorSide: 'team_player',
  visibleWorld: incapacitationWorld,
  objectiveContract: incapacitationObjective,
}, incapacitationRoute);
const incapacitationDamageRoute = incapacitationRoute.healthTrajectoryByTarget.find(trajectory =>
  trajectory.outcomeKind === 'HP_DELTA' &&
  trajectory.targetId === 'probability-target'
);
addCheck(
  'preview:probabilistic-incapacitation-enters-terminal-distribution',
  incapacitationDamageRoute?.outcomeDistribution?.some(branch =>
    branch.actionState === '失去战斗力'
  ) &&
    Math.abs(Number(incapacitationTerminal.terminalProbability || 0) - 0.5) < 1e-9 &&
    incapacitationTerminal.terminal !== true,
  {
    incapacitationDamageRoute,
    incapacitationTerminal,
  },
);

const deathOnlyObjective = {
  ...objective(),
  victory: {
    logic: 'ANY',
    conditions: [{
      type: 'UNIT_DEAD',
      side: 'ENEMY',
      targetIds: ['probability-target'],
    }],
  },
};
const nonlethalAgainstDeathTerminal = decision.r8TerminalUtility({
  actorId: 'probability-actor',
  actorSide: 'team_player',
  visibleWorld: incapacitationWorld,
  objectiveContract: deathOnlyObjective,
}, incapacitationRoute);
addCheck(
  'objective:nonlethal-incapacitation-does-not-satisfy-death-condition',
  Math.abs(Number(nonlethalAgainstDeathTerminal.terminalProbability || 0)) < 1e-9 &&
    nonlethalAgainstDeathTerminal.terminal === false &&
    nonlethalAgainstDeathTerminal.status === 'ONGOING',
  { nonlethalAgainstDeathTerminal },
);

const queueChanges = [];
const queue = runtime.createActionQueue({
  round: 1,
  describeActor: entry => entry.name,
  describeActorId: entry => entry.id,
  onOpportunityChange: record => queueChanges.push(record),
});
assert.equal(queue.enqueue({
  actorEntry: { id: 'actor', name: 'actor' },
  grantId: 'natural:1:actor',
  opportunityId: 'natural:1:actor',
  grantType: 'NATURAL_ACTION',
  nodeKind: 'ACTIVE',
  actionRole: 'ACTIVE',
}), true);
const activeNode = queue.dequeue();
queue.recordTrace('EXECUTING', activeNode);
queue.recordTrace('EXECUTED', activeNode, { actionId: 'action:actor:1' });
const activeOpportunity = queue.opportunitySnapshot()[0];
addCheck(
  'opportunity:natural-lifecycle',
  activeOpportunity?.ownerId === 'actor' &&
    activeOpportunity?.grantType === 'NATURAL_ACTION' &&
    activeOpportunity?.status === 'CONSUMED' &&
    activeOpportunity?.consumedByActionId === 'action:actor:1' &&
    queueChanges.map(item => item.status).join('|') === 'PENDING|EXECUTING|CONSUMED',
  { activeOpportunity, states: queueChanges.map(item => item.status) },
);

const reactionQueue = runtime.createActionQueue({
  round: 1,
  describeActorId: entry => entry.id,
});
assert.equal(reactionQueue.enqueue({
  actorEntry: { id: 'defender', name: 'defender' },
  grantId: 'counter:attack:1',
  opportunityId: 'counter:attack:1',
  nodeKind: 'COUNTER',
  actionRole: 'COUNTER',
  grantType: 'COUNTER_WINDOW',
  sourceActorId: 'attacker',
  sourceActionId: 'attack:1',
  validTargetIds: ['attacker'],
}), true);
const counterOpportunity = reactionQueue.opportunitySnapshot()[0];
addCheck(
  'opportunity:counter-owner-source-target',
  counterOpportunity?.ownerId === 'defender' &&
    counterOpportunity?.sourceActorId === 'attacker' &&
    counterOpportunity?.sourceActionId === 'attack:1' &&
    counterOpportunity?.validTargetIds?.[0] === 'attacker',
  { counterOpportunity },
);

let selfSourceError = '';
try {
  runtime.normalizeOpportunityRecord({
    opportunityId: 'bad:self',
    ownerId: 'same',
    sourceActorId: 'same',
    grantType: 'COUNTER_WINDOW',
  });
} catch (error) {
  selfSourceError = String(error?.message || error);
}
addCheck('opportunity:self-source-rejected', selfSourceError === 'REACTION_SELF_SOURCE_INVALID', { selfSourceError });

const baseSnapshot = {
  schemaVersion: '8.3-runtime-snapshot-1',
  opportunitySnapshot: [{
    opportunityId: 'natural:noop',
    ownerId: 'actor',
    role: 'ACTIVE',
    sourceActorId: '',
    sourceActionId: '',
    grantType: 'NATURAL_ACTION',
    validTargetIds: [],
    createdAtSequence: 1,
    expiresAtSequence: 0,
    status: 'PENDING',
    consumedByActionId: '',
    lostReason: '',
  }],
  resourceTimeline: [{ eventId: 'resource:1', operation: 'RESTORE', delta: 10 }],
  scheduledEvents: [{ descriptorId: 'schedule:1', eventType: 'DOT_TICK' }],
  firstTerminalSequence: null,
};
const noOpSnapshot = runtime.buildNoOpRuntimeSnapshot(baseSnapshot, 'natural:noop');
addCheck(
  'noop:same-world-timeline-schedule',
  noOpSnapshot.opportunitySnapshot[0].status === 'CONSUMED' &&
    noOpSnapshot.opportunitySnapshot[0].consumedByActionId === 'NO_OP:natural:noop' &&
    runtime.hashBattleValue(noOpSnapshot.resourceTimeline) === runtime.hashBattleValue(baseSnapshot.resourceTimeline) &&
    runtime.hashBattleValue(noOpSnapshot.scheduledEvents) === runtime.hashBattleValue(baseSnapshot.scheduledEvents) &&
    noOpSnapshot.noOp.paysResources === false &&
    noOpSnapshot.noOp.establishesStance === false &&
    noOpSnapshot.noOp.triggersActionReaction === false,
);

const timelineCombat = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player')],
    team_enemy: [unit('enemy', 'enemy')],
  },
};
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'action_cost',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '测试支付',
  opportunitySequence: 1,
  meta: { resource: '魂力', amount: 30, actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'resource_change',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '支付前恢复',
  opportunitySequence: 1,
  meta: { resource: '魂力', amount: 20, delta: 20, actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'resource_change',
  actorId: 'enemy',
  actorName: 'enemy',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '资源削减',
  opportunitySequence: 1,
  meta: { resource: '魂力', amount: 10, delta: -10, actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'state_apply',
  actorId: 'enemy',
  actorName: 'enemy',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '资源锁定',
  ruleCode: 'RESOURCE_LOCK',
  opportunitySequence: 1,
  meta: { resource: '魂力', actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'state_tick',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '资源解锁',
  ruleCode: 'RESOURCE_UNLOCK',
  opportunitySequence: 1,
  meta: { resource: '魂力', actionSequence: 1 },
});
const timeline = runtime.resourceTimelineFromRuntime(timelineCombat);
addCheck(
  'resource:single-ordered-timeline',
  timeline.map(event => event.operation).join('|') === 'RESTORE|UNLOCK|REDUCE|LOCK|PAY' &&
    timeline.every((event, index) => index === 0 || event.phasePriority >= timeline[index - 1].phasePriority),
  { operations: timeline.map(event => event.operation), priorities: timeline.map(event => event.phasePriority) },
);

runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'state_apply',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'enemy',
  targetName: 'enemy',
  actionName: '延迟控制',
  result: 'scheduled',
  meta: {
    scheduledIndex: 0,
    scheduled: {
      type: 'DELAYED_STATE',
      targetId: 'enemy',
      delay: 2,
      expectedGrantType: 'NATURAL_ACTION',
    },
  },
});
const schedules = runtime.scheduledEventsFromRuntime(timelineCombat);
addCheck(
  'schedule:descriptor-from-runtime-event',
  schedules.length === 1 &&
    schedules[0].ownerId === 'enemy' &&
    schedules[0].eventType === 'DELAYED_STATE' &&
    schedules[0].expirySequence >= schedules[0].creationSequence,
  { schedules },
);

const terminalCombat = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player')],
    team_enemy: [unit('enemy', 'enemy', 0)],
  },
};
const terminal = runtime.evaluateBattleTerminal({
  combatData: terminalCombat,
  currentRound: 1,
  roundCompleted: false,
});
const terminalSnapshot = runtime.buildRuntimeDecisionSnapshot(terminalCombat);
const terminalEvent = terminalCombat.__battleEventLedger.find(event => event.eventKind === 'battle_objective_resolved');
addCheck(
  'terminal:first-sequence-owned-by-runtime',
  terminal.terminal === true &&
    terminal.winner === 'player' &&
    terminalSnapshot.firstTerminalSequence?.eventId === terminalEvent?.eventId &&
    terminalSnapshot.firstTerminalSequence?.sequence === terminalEvent?.sequence,
  { firstTerminalSequence: terminalSnapshot.firstTerminalSequence },
);

const decisionSnapshot = runtime.buildDecisionRuntimeSnapshot(timelineCombat, 'actor', {
  role: 'ACTIVE',
  opportunityId: 'decision:actor:1',
});
addCheck(
  'decision:runtime-snapshot-complete',
  decisionSnapshot.schemaVersion === '8.3-runtime-snapshot-1' &&
    decisionSnapshot.opportunitySnapshot.some(item => item.opportunityId === 'decision:actor:1') &&
    decisionSnapshot.resourceTimeline.length === timeline.length &&
    decisionSnapshot.scheduledEvents.length === schedules.length,
);

const orderUnit = (id, side, agility, stateEffects = {}) => ({
  id,
  name: id,
  名称: id,
  side,
  type: '强攻系',
  hp: 500,
  hp_max: 500,
  sp: 100,
  sp_max: 100,
  men: 100,
  men_max: 100,
  vit: 100,
  vit_max: 100,
  属性: {
    等级: 30,
    HP: 500,
    HP上限: 500,
    魂力: 100,
    魂力上限: 100,
    精神力: 100,
    精神力上限: 100,
    体力: 100,
    体力上限: 100,
    力量: 100,
    防御: 100,
    敏捷: agility,
    状态效果: stateEffects,
  },
  状态: { 存活: true, 行动: '战斗' },
  状态效果: stateEffects,
  技能列表: [],
});
const fastOrderUnit = orderUnit('order-fast', 'player', 100);
const slowOrderUnit = orderUnit('order-slow', 'enemy', 100, {
  迟缓: {
    状态: '迟缓',
    状态名称: '迟缓',
    duration: 1,
    战斗效果: { cast_speed_penalty: 0.2 },
  },
});
const middleOrderUnit = orderUnit('order-middle', 'player', 90);
addCheck(
  'action-axis:slow-crossing-changes-same-phase-order',
  preview.compareNaturalActionOrder(slowOrderUnit, middleOrderUnit) > 0 &&
    preview.compareNaturalActionOrder(fastOrderUnit, slowOrderUnit) < 0,
  {
    slowProfile: preview.naturalActionOrderProfile(slowOrderUnit),
    middleProfile: preview.naturalActionOrderProfile(middleOrderUnit),
  },
);
const nonCrossingUnit = orderUnit('order-non-crossing', 'enemy', 100, {
  迟缓: {
    状态: '迟缓',
    状态名称: '迟缓',
    duration: 1,
    战斗效果: { cast_speed_penalty: 0.05 },
  },
});
addCheck(
  'action-axis:slow-without-crossing-keeps-order',
  preview.compareNaturalActionOrder(nonCrossingUnit, middleOrderUnit) < 0 &&
    preview.naturalActionOrderProfile(nonCrossingUnit).effectiveAgility === 95,
  {
    nonCrossingProfile: preview.naturalActionOrderProfile(nonCrossingUnit),
  },
);
const durationCombat = {
  回合: 1,
  参战者: {
    team_player: [
      {
        ...orderUnit('slow-caster', 'player', 120),
        技能列表: [],
      },
      middleOrderUnit,
    ],
    team_enemy: [orderUnit('duration-target', 'enemy', 100)],
  },
  胜负条件: objective(),
};
const durationContext = runtime.beginStructuredDeclaration({
  combatData: durationCombat,
  actionId: 'phase3:slow-apply',
  declaration: {
    actorId: 'slow-caster',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['duration-target'],
    skill: {
      id: 'phase3-slow',
      name: '迟缓校准',
      消耗: '无',
      前摇: 0,
      _效果数组: [{
        原型: '状态施加',
        目标: '敌方单体',
        状态: '迟缓',
        状态名称: '迟缓',
        数值: '-20%',
        持续回合: 1,
        成功率: 1,
      }],
    },
  },
});
runtime.executeStructuredDeclaration({ actionContext: durationContext });
runtime.settleConditionsAtRoundEnd(
  durationCombat.参战者.team_enemy[0],
  'duration-target',
  durationCombat,
);
const durationTarget = durationCombat.参战者.team_enemy[0];
const durationQueue = runtime.buildActionQueue(durationCombat)
  .map(entry => entry.char.id);
addCheck(
  'action-axis:runtime-state-survives-to-next-queue',
  durationTarget.状态效果?.迟缓?.duration === 1 &&
    durationTarget.状态效果?.迟缓?.__本回合新附加 !== true &&
    durationQueue.indexOf('middle-order') < durationQueue.indexOf('duration-target'),
  {
    duration: durationTarget.状态效果?.迟缓?.duration,
    queue: durationQueue,
    targetProfile: preview.naturalActionOrderProfile(durationTarget),
  },
);

const dotRuntimeCombat = {
  回合: 1,
  参战者: {
    team_player: [orderUnit('dot-caster', 'player', 120)],
    team_enemy: [orderUnit('dot-target', 'enemy', 100)],
  },
  胜负条件: objective(),
};
const dotRuntimeContext = runtime.beginStructuredDeclaration({
  combatData: dotRuntimeCombat,
  actionId: 'phase3:dot-apply',
  declaration: {
    actorId: 'dot-caster',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['dot-target'],
    skill: {
      id: 'phase3-dot',
      name: '持续伤害校准',
      消耗: '无',
      前摇: 0,
      _效果数组: [{
        effectId: 'phase3-dot-effect',
        原型: '状态施加',
        目标: '敌方单体',
        状态: '中毒',
        状态名称: '中毒',
        数值: '-10%',
        持续回合: 2,
        成功率: '100%',
      }],
    },
  },
});
runtime.executeStructuredDeclaration({ actionContext: dotRuntimeContext });
const dotRuntimeTarget = dotRuntimeCombat.参战者.team_enemy[0];
const dotRuntimeHpBeforeTicks = preview.readHp(dotRuntimeTarget);
runtime.settleConditionsAtRoundEnd(dotRuntimeTarget, 'dot-target', dotRuntimeCombat);
dotRuntimeCombat.回合 = 2;
runtime.settleConditionsAtRoundEnd(dotRuntimeTarget, 'dot-target', dotRuntimeCombat);
dotRuntimeCombat.回合 = 3;
runtime.settleConditionsAtRoundEnd(dotRuntimeTarget, 'dot-target', dotRuntimeCombat);
const dotRuntimeLedger = runtime.ensureLedger(dotRuntimeCombat);
const dotRuntimeTicks = dotRuntimeLedger.filter(event =>
  String(event?.eventKind || '').trim() === 'state_tick' &&
  String(event?.targetName || event?.targetId || '').trim() === 'dot-target' &&
  Number(event?.appliedDamage || event?.meta?.amount || 0) > 0
);
addCheck(
  'runtime:dot-each-real-tick-keeps-source-window',
  dotRuntimeTicks.length === 2 &&
    dotRuntimeHpBeforeTicks - preview.readHp(dotRuntimeTarget) > 0 &&
    dotRuntimeTicks.map(event => Number(event.round || 0)).join('|') === '2|3' &&
    dotRuntimeTicks.every(event =>
      String(event?.sourceActionId || '').trim() ===
        'phase3:dot-apply' &&
      Number(event?.sourceRound || event?.meta?.sourceRound || 0) === 1 &&
      String(event?.applicationId || event?.meta?.applicationId || '').trim()
    ) &&
    new Set(dotRuntimeTicks.map(event =>
      String(event?.applicationId || event?.meta?.applicationId || '').trim()
    )).size === 1,
  {
    states: dotRuntimeTarget.状态效果,
    hpBeforeTicks: dotRuntimeHpBeforeTicks,
    hpAfterTicks: preview.readHp(dotRuntimeTarget),
    ledgerKinds: dotRuntimeLedger.map(event => ({
      eventKind: event?.eventKind,
      round: event?.round,
      result: event?.result,
      targetId: event?.targetId,
      targetName: event?.targetName,
      amount: event?.appliedDamage || event?.meta?.amount || 0,
    })),
    ticks: dotRuntimeTicks.map(event => ({
      round: event.round,
      sourceActionId: event.sourceActionId,
      sourceRound: event.sourceRound,
      applicationId: event.applicationId,
      amount: event.appliedDamage || event?.meta?.amount || 0,
    })),
  },
);

const dotRefreshCombat = {
  回合: 1,
  参战者: {
    team_player: [orderUnit('dot-refresh-caster', 'player', 120)],
    team_enemy: [orderUnit('dot-refresh-target', 'enemy', 100)],
  },
  胜负条件: objective(),
};
const dotRefreshSkill = {
  id: 'phase3-dot-refresh',
  name: '持续伤害刷新校准',
  消耗: '无',
  前摇: 0,
  _效果数组: [{
    effectId: 'phase3-dot-refresh-effect',
    原型: '状态施加',
    目标: '敌方单体',
    状态: '中毒',
    状态名称: '中毒',
    数值: '-10%',
    持续回合: 2,
    成功率: '100%',
  }],
};
const applyDotRefresh = actionId => {
  const actionContext = runtime.beginStructuredDeclaration({
    combatData: dotRefreshCombat,
    actionId,
    declaration: {
      actorId: 'dot-refresh-caster',
      actionKind: 'RELEASE_SKILL',
      targetIds: ['dot-refresh-target'],
      skill: dotRefreshSkill,
    },
  });
  return runtime.executeStructuredDeclaration({ actionContext });
};
applyDotRefresh('phase3:dot-refresh:first');
const dotRefreshTarget = dotRefreshCombat.参战者.team_enemy[0];
runtime.settleConditionsAtRoundEnd(
  dotRefreshTarget,
  'dot-refresh-target',
  dotRefreshCombat,
);
dotRefreshCombat.回合 = 2;
runtime.settleConditionsAtRoundEnd(
  dotRefreshTarget,
  'dot-refresh-target',
  dotRefreshCombat,
);
dotRefreshCombat.回合 = 3;
const dotRefreshPreview = preview.previewAction({
  worldSnapshot: dotRefreshCombat,
  worldRevision: 'phase3:dot-refresh:before-second-application',
  actorId: 'dot-refresh-caster',
  declaration: {
    actorId: 'dot-refresh-caster',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['dot-refresh-target'],
    skill: {
      ...dotRefreshSkill,
      _效果数组: dotRefreshSkill._效果数组.map(effect => ({
        ...effect,
        目标: '单体',
      })),
    },
  },
  actionFingerprint: 'phase3:dot-refresh:second',
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
applyDotRefresh('phase3:dot-refresh:second');
runtime.settleConditionsAtRoundEnd(
  dotRefreshTarget,
  'dot-refresh-target',
  dotRefreshCombat,
);
dotRefreshCombat.回合 = 4;
runtime.settleConditionsAtRoundEnd(
  dotRefreshTarget,
  'dot-refresh-target',
  dotRefreshCombat,
);
const dotRefreshLedger = runtime.ensureLedger(dotRefreshCombat);
const dotRefreshTicks = dotRefreshLedger.filter(event =>
  String(event?.eventKind || '').trim() === 'state_tick' &&
  String(event?.targetName || event?.targetId || '').trim() ===
    'dot-refresh-target' &&
  Number(event?.appliedDamage || event?.meta?.amount || 0) > 0
);
const dotRefreshApplications = dotRefreshLedger.filter(event =>
  String(event?.eventKind || '').trim() === 'state_apply' &&
  String(event?.result || '').trim() === 'applied' &&
  String(event?.targetName || event?.targetId || '').trim() ===
    'dot-refresh-target'
);
const firstDotRefreshApplicationId = String(
  dotRefreshApplications[0]?.applicationId ||
    dotRefreshApplications[0]?.meta?.applicationId ||
    '',
).trim();
const secondDotRefreshApplicationId = String(
  dotRefreshApplications[1]?.applicationId ||
    dotRefreshApplications[1]?.meta?.applicationId ||
    '',
).trim();
const dotRefreshPreviewScheduled = (
  dotRefreshPreview?.scheduledEvents || []
).filter(event =>
  String(event?.type || event?.eventKind || '').trim() ===
    'SCHEDULED_HP_DELTA'
);
addCheck(
  'preview-runtime:dot-refresh-preserves-earned-tick-and-owns-only-extension',
  dotRefreshApplications.length === 2 &&
    firstDotRefreshApplicationId &&
    secondDotRefreshApplicationId &&
    firstDotRefreshApplicationId !== secondDotRefreshApplicationId &&
    dotRefreshTicks.length === 3 &&
    dotRefreshTicks.map(event => Number(event?.round || 0)).join('|') ===
      '2|3|4' &&
    dotRefreshTicks.map(event =>
      String(
        event?.applicationId || event?.meta?.applicationId || '',
      ).trim()
    ).join('|') === [
      firstDotRefreshApplicationId,
      firstDotRefreshApplicationId,
      secondDotRefreshApplicationId,
    ].join('|') &&
    dotRefreshTicks.map(event =>
      String(event?.sourceActionId || event?.meta?.sourceActionId || '').trim()
    ).join('|') === [
      'phase3:dot-refresh:first',
      'phase3:dot-refresh:first',
      'phase3:dot-refresh:second',
    ].join('|') &&
    dotRefreshPreviewScheduled.length === 1 &&
    Number(dotRefreshPreviewScheduled[0]?.tickCount || 0) === 1 &&
    !dotRefreshTarget.状态效果?.中毒,
  {
    previewScheduled: dotRefreshPreviewScheduled,
    applications: dotRefreshApplications.map(event => ({
      round: event?.round,
      sourceActionId: event?.sourceActionId,
      applicationId:
        event?.applicationId || event?.meta?.applicationId || '',
    })),
    ticks: dotRefreshTicks.map(event => ({
      round: event?.round,
      sourceRound: event?.sourceRound || event?.meta?.sourceRound || 0,
      sourceActionId:
        event?.sourceActionId || event?.meta?.sourceActionId || '',
      applicationId:
        event?.applicationId || event?.meta?.applicationId || '',
      amount: event?.appliedDamage || event?.meta?.amount || 0,
    })),
    remainingState: dotRefreshTarget.状态效果?.中毒 || null,
  },
);

const objectiveEvaluationSummary = result => ({
  status: result?.status,
  winner: result?.winner,
  terminal: result?.terminal,
  timeLimitReached: result?.timeLimitReached,
  terminalReason: result?.terminalReason,
});
const objectiveMatrixWorld = ({
  round = 1,
  playerHp = 500,
  enemyHp = 500,
  playerVit = 100,
  enemyVit = 100,
  playerAction = '战斗',
  enemyAction = '战斗',
  summon = null,
  battleRuntime = null,
} = {}) => {
  const player = unit('objective-player', 'player', playerHp);
  const enemy = unit('objective-enemy', 'enemy', enemyHp);
  player.vit = playerVit;
  player.属性.体力 = playerVit;
  player.状态.行动 = playerAction;
  enemy.vit = enemyVit;
  enemy.属性.体力 = enemyVit;
  enemy.状态.行动 = enemyAction;
  const world = {
    回合: round,
    参战者: {
      team_player: [player],
      team_enemy: [enemy],
    },
  };
  if (summon) world.参战者.team_enemy.push(summon);
  if (battleRuntime) world.__battleRuntime = battleRuntime;
  return world;
};
const objectiveGroup = (logic, conditions) => ({ logic, conditions });
const objectiveContract = ({
  victory,
  defeat = objectiveGroup('ANY', [{
    type: 'TEAM_INCAPACITATED',
    side: 'PLAYER',
  }]),
  maxRounds = 5,
  resolutionPriority = 'DEFEAT_FIRST',
} = {}) => ({
  version: 1,
  explicit: true,
  startRound: 0,
  maxRounds,
  resolutionPriority,
  victory,
  defeat,
});
const objectiveEquivalenceCases = [
  {
    caseId: 'TEAM_INCAPACITATED',
    world: objectiveMatrixWorld({
      enemyVit: 0,
      enemyAction: '失去战斗力',
    }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'TEAM_INCAPACITATED',
        side: 'ENEMY',
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'TEAM_DEAD',
    world: objectiveMatrixWorld({ enemyHp: 0 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'TEAM_DEAD',
        side: 'ENEMY',
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'HP_RATIO_AT_OR_BELOW',
    world: objectiveMatrixWorld({ enemyHp: 150 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'HP_RATIO_AT_OR_BELOW',
        side: 'ENEMY',
        threshold: 0.3,
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'ROUND_REACHED',
    world: objectiveMatrixWorld({ round: 2 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'ROUND_REACHED',
        side: 'PLAYER',
        round: 2,
      }]),
    }),
    options: { round: 2, roundCompleted: true },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'UNIT_DAMAGED',
    world: objectiveMatrixWorld({ enemyHp: 499 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DAMAGED',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
        baselineHp: { 'objective-enemy': 500 },
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'UNIT_INCAPACITATED',
    world: objectiveMatrixWorld({
      enemyVit: 0,
      enemyAction: '失去战斗力',
    }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_INCAPACITATED',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'UNIT_DEAD',
    world: objectiveMatrixWorld({ enemyHp: 0 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'WITHDRAW_SUCCESS',
    world: objectiveMatrixWorld({
      battleRuntime: {
        withdrawalSuccessSides: ['PLAYER'],
      },
    }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'WITHDRAW_SUCCESS',
        side: 'PLAYER',
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'ANY',
    world: objectiveMatrixWorld({ enemyHp: 150 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [
        {
          type: 'UNIT_DEAD',
          side: 'ENEMY',
          targetIds: ['objective-enemy'],
        },
        {
          type: 'HP_RATIO_AT_OR_BELOW',
          side: 'ENEMY',
          targetIds: ['objective-enemy'],
          threshold: 0.3,
        },
      ]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'ALL',
    world: objectiveMatrixWorld({ enemyHp: 150, round: 2 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ALL', [
        {
          type: 'HP_RATIO_AT_OR_BELOW',
          side: 'ENEMY',
          targetIds: ['objective-enemy'],
          threshold: 0.3,
        },
        {
          type: 'ROUND_REACHED',
          side: 'PLAYER',
          round: 2,
        },
      ]),
    }),
    options: { round: 2, roundCompleted: true },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
  },
  {
    caseId: 'DEFEAT_FIRST',
    world: objectiveMatrixWorld({ playerHp: 0, enemyHp: 0 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
      defeat: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'PLAYER',
        targetIds: ['objective-player'],
      }]),
      resolutionPriority: 'DEFEAT_FIRST',
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'ENEMY_WIN',
      winner: 'enemy',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_CONFLICT',
    },
  },
  {
    caseId: 'DRAW_ON_CONFLICT',
    world: objectiveMatrixWorld({ playerHp: 0, enemyHp: 0 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
      defeat: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'PLAYER',
        targetIds: ['objective-player'],
      }]),
      resolutionPriority: 'DRAW_ON_CONFLICT',
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'DRAW',
      winner: 'draw',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_CONFLICT',
    },
  },
  {
    caseId: 'ROUND_LIMIT_DRAW',
    world: objectiveMatrixWorld({ round: 1 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
      maxRounds: 1,
    }),
    options: { round: 1, roundCompleted: true },
    expected: {
      status: 'DRAW',
      winner: 'draw',
      terminal: true,
      timeLimitReached: true,
      terminalReason: 'ROUND_LIMIT_REACHED',
    },
  },
  {
    caseId: 'SUMMON_EXCLUDED_FROM_FROZEN_PRIMARY_TARGETS',
    world: objectiveMatrixWorld({
      enemyHp: 0,
      summon: {
        ...unit('objective-enemy-summon', 'enemy', 500),
        单位性质: '召唤物',
      },
    }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'TEAM_DEAD',
        side: 'ENEMY',
      }]),
    }),
    options: { round: 1, roundCompleted: false },
    expected: {
      status: 'PLAYER_WIN',
      winner: 'player',
      terminal: true,
      timeLimitReached: false,
      terminalReason: 'OBJECTIVE_VICTORY',
    },
    validateDetailed(result) {
      const targetIds = result?.objectives?.victory?.conditions?.[0]?.targetIds || [];
      return targetIds.length === 1 &&
        targetIds[0] === 'objective-enemy' &&
        !targetIds.includes('objective-enemy-summon');
    },
  },
];
const objectiveEquivalenceResults = objectiveEquivalenceCases.map(testCase => {
  const detailed = preview.evaluateBattleObjectives(
    testCase.world,
    testCase.objectives,
    testCase.options,
  );
  const compact = preview.evaluateBattleObjectivesCompact(
    testCase.world,
    testCase.objectives,
    testCase.options,
  );
  const detailedSummary = objectiveEvaluationSummary(detailed);
  const compactSummary = objectiveEvaluationSummary(compact);
  return {
    caseId: testCase.caseId,
    detailedSummary,
    compactSummary,
    equivalent:
      JSON.stringify(detailedSummary) === JSON.stringify(compactSummary),
    expected:
      JSON.stringify(detailedSummary) === JSON.stringify(testCase.expected),
    detailedInvariant:
      typeof testCase.validateDetailed !== 'function' ||
      testCase.validateDetailed(detailed),
  };
});
addCheck(
  'objective:compact-and-detailed-evaluators-are-semantically-equivalent',
  objectiveEquivalenceResults.every(result =>
    result.equivalent &&
    result.expected &&
    result.detailedInvariant
  ),
  { objectiveEquivalenceResults },
);

const objectiveOverrideCases = [
  {
    caseId: 'HP_THRESHOLD_OVERRIDE',
    baseWorld: objectiveMatrixWorld(),
    materializedWorld: objectiveMatrixWorld({ enemyHp: 150 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'HP_RATIO_AT_OR_BELOW',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
        threshold: 0.3,
      }]),
    }),
    stateByUnitId: {
      'objective-enemy': { hp: 150, alive: true, capable: true },
    },
  },
  {
    caseId: 'INCAPACITATED_OVERRIDE',
    baseWorld: objectiveMatrixWorld(),
    materializedWorld: objectiveMatrixWorld({
      enemyVit: 0,
      enemyAction: '失去战斗力',
    }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_INCAPACITATED',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
    }),
    stateByUnitId: {
      'objective-enemy': { hp: 500, alive: true, capable: false },
    },
  },
  {
    caseId: 'DEAD_OVERRIDE',
    baseWorld: objectiveMatrixWorld(),
    materializedWorld: objectiveMatrixWorld({ enemyHp: 0 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
    }),
    stateByUnitId: {
      'objective-enemy': { hp: 0, alive: false, capable: false },
    },
  },
  {
    caseId: 'DAMAGED_OVERRIDE',
    baseWorld: objectiveMatrixWorld(),
    materializedWorld: objectiveMatrixWorld({ enemyHp: 499 }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DAMAGED',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
        baselineHp: { 'objective-enemy': 500 },
      }]),
    }),
    stateByUnitId: {
      'objective-enemy': { hp: 499, alive: true, capable: true },
    },
  },
  {
    caseId: 'CONFLICT_OVERRIDE',
    baseWorld: objectiveMatrixWorld(),
    materializedWorld: objectiveMatrixWorld({
      playerHp: 0,
      enemyHp: 0,
    }),
    objectives: objectiveContract({
      victory: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['objective-enemy'],
      }]),
      defeat: objectiveGroup('ANY', [{
        type: 'UNIT_DEAD',
        side: 'PLAYER',
        targetIds: ['objective-player'],
      }]),
      resolutionPriority: 'DRAW_ON_CONFLICT',
    }),
    stateByUnitId: {
      'objective-player': { hp: 0, alive: false, capable: false },
      'objective-enemy': { hp: 0, alive: false, capable: false },
    },
  },
];
const objectiveOverrideResults = objectiveOverrideCases.map(testCase => {
  const expected = preview.evaluateBattleObjectivesCompact(
    testCase.materializedWorld,
    testCase.objectives,
    { round: 1, roundCompleted: false },
  );
  const actual = preview.evaluateBattleObjectivesCompact(
    testCase.baseWorld,
    testCase.objectives,
    {
      round: 1,
      roundCompleted: false,
      unitIndex: preview.buildObjectiveUnitIndex(testCase.baseWorld),
      objectiveStateByUnitId: testCase.stateByUnitId,
    },
  );
  return {
    caseId: testCase.caseId,
    expected: objectiveEvaluationSummary(expected),
    actual: objectiveEvaluationSummary(actual),
    equivalent:
      JSON.stringify(objectiveEvaluationSummary(expected)) ===
      JSON.stringify(objectiveEvaluationSummary(actual)),
  };
});
addCheck(
  'objective:sparse-state-overrides-match-materialized-world',
  objectiveOverrideResults.every(result => result.equivalent),
  { objectiveOverrideResults },
);

const runtimeSource = fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'), 'utf8');
addCheck(
  'source:single-runtime-contract-owner',
  /function buildRuntimeDecisionSnapshot\(combatData = \{\}\)/.test(runtimeSource) &&
    /function buildNoOpRuntimeSnapshot\(runtimeSnapshot = \{\}, opportunityId = ''\)/.test(runtimeSource) &&
    /appendRuntimeEventContracts\(rootData, event\)/.test(runtimeSource) &&
    /runtime\.firstTerminalSequence = \{/.test(runtimeSource),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    opportunityCheckCount: checks.filter(check => check.checkId.startsWith('opportunity:')).length,
    runtimeEventContractStatus: failed.length === 0 ? 'RUNTIME_EVENT_CONTRACT_PASSED' : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

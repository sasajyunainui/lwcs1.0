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

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

function firstStructuralDifference(left, right, currentPath = '$') {
  if (Object.is(left, right)) return null;
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return { path: currentPath, left, right };
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return { path: currentPath, left, right };
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) {
      return {
        path: `${currentPath}.${key}`,
        left: left[key],
        right: right[key],
      };
    }
    const difference = firstStructuralDifference(
      left[key],
      right[key],
      `${currentPath}.${key}`,
    );
    if (difference) return difference;
  }
  return null;
}

function skill(id, power, cost = 0) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: cost },
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

function unit(id, side, overrides = {}) {
  const hp = Number(overrides.hp ?? 500);
  const sp = Number(overrides.sp ?? 100);
  return {
    id,
    name: id,
    名称: id,
    side,
    hp,
    hp_max: 500,
    sp,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: Number(overrides.str ?? 170),
    def: Number(overrides.def ?? 100),
    agi: 100,
    属性: {
      等级: 50,
      HP: hp,
      HP上限: 500,
      魂力: sp,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: Number(overrides.str ?? 170),
      防御: Number(overrides.def ?? 100),
      敏捷: 100,
      状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: overrides.skills || [],
  };
}

function objective() {
  return {
    schemaVersion: '8.3-objective-1',
    startRound: 1,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ conditionId: 'victory', type: 'TEAM_INCAPACITATED', side: 'ENEMY' }] },
    defeat: { logic: 'ANY', conditions: [{ conditionId: 'defeat', type: 'TEAM_INCAPACITATED', side: 'PLAYER' }] },
  };
}

function world(actorSp = 100, enemyDefense = 100) {
  return {
    回合: 1,
    胜负条件: objective(),
    参战者: {
      team_player: [
        unit('actor', 'player', {
          sp: actorSp,
          skills: [
            skill('weak', 45, 0),
            skill('medium', 100, 20),
            skill('strong', 180, 60),
          ],
        }),
        unit('ally', 'player', { skills: [skill('ally-strike', 90, 0)] }),
      ],
      team_enemy: [
        unit('enemy', 'enemy', { def: enemyDefense, skills: [skill('enemy-strike', 110, 0)] }),
      ],
    },
  };
}

const source = world();
const sourceHash = preview.stableHash(source);
const request = decision.prepareDecisionRequest({
  worldSnapshot: source,
  actorId: 'actor',
  objectiveContract: source.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      {
        opportunityId: 'natural:actor:1',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'EXECUTING',
        createdAtSequence: 1,
      },
      {
        opportunityId: 'natural:ally:1',
        ownerId: 'ally',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 2,
      },
      {
        opportunityId: 'natural:enemy:1',
        ownerId: 'enemy',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 3,
      },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 835001,
});
assert.equal(preview.stableHash(source), sourceHash);

const dependencyView = request.evaluationContext.dependencyView;
dependencyView.readUnitHp('actor');
dependencyView.readUnitBaseMaxHp('enemy');
dependencyView.readResource('actor', '魂力');
dependencyView.readDefenseProfile('enemy');
dependencyView.readOpportunity('natural:actor:1');
dependencyView.readObjective('victory');
const dependencyKeys = dependencyView.dependencyKeys();
addCheck(
  'dependency-view:typed-access-log',
  [
    'unit:actor:hp',
    'unit:enemy:baseMaxHp',
    'unit:actor:resource:魂力',
    'target:enemy:defense',
    'opportunity:natural:actor:1',
    'objective:victory',
  ].every(key => dependencyKeys.includes(key)),
  { dependencyKeys },
);

const routeCatalog = request.actionRouteCatalog;
const actorEnvelope = routeCatalog.actor;
addCheck(
  'routes:full-search-two-route-storage',
  actorEnvelope.searchedRouteCount === request.frozenCandidates.length &&
    actorEnvelope.searchedRouteCount > 2 &&
    actorEnvelope.primaryRoute &&
    actorEnvelope.backupRoute &&
    actorEnvelope.primaryRoute.routeKey !== actorEnvelope.backupRoute.routeKey &&
    Object.keys(routeCatalog).sort().join(',') === 'actor,ally,enemy',
  {
    searchedRouteCount: actorEnvelope.searchedRouteCount,
    primaryCandidateId: actorEnvelope.primaryRoute?.candidateId,
    backupCandidateId: actorEnvelope.backupRoute?.candidateId,
    catalogUnitIds: Object.keys(routeCatalog).sort(),
  },
);

const isolatedDependencyWorld = world();
isolatedDependencyWorld.参战者.team_enemy.push(
  unit('enemy-2', 'enemy', { def: 130, skills: [skill('enemy-2-strike', 90, 0)] }),
);
const isolatedDependencyRequest = decision.prepareDecisionRequest({
  worldSnapshot: isolatedDependencyWorld,
  actorId: 'actor',
  objectiveContract: isolatedDependencyWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:dependency-isolation',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [{
      opportunityId: 'natural:actor:dependency-isolation',
      ownerId: 'actor',
      grantType: 'NATURAL_ACTION',
      status: 'EXECUTING',
      createdAtSequence: 1,
    }],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 835002,
});
const routeAgainstEnemy = Object.values(isolatedDependencyRequest.actorCandidateRoutes)
  .find(route =>
    route.targetIds?.length === 1 &&
    route.targetIds[0] === 'enemy'
  );
const routeAgainstEnemy2 = Object.values(isolatedDependencyRequest.actorCandidateRoutes)
  .find(route =>
    route.targetIds?.length === 1 &&
    route.targetIds[0] === 'enemy-2'
  );
addCheck(
  'dependency-view:candidate-captures-do-not-inherit-other-targets',
  routeAgainstEnemy &&
    routeAgainstEnemy2 &&
    routeAgainstEnemy.dependencyKeys.includes('target:enemy:defense') &&
    !routeAgainstEnemy.dependencyKeys.some(key => key.includes('enemy-2')) &&
    routeAgainstEnemy2.dependencyKeys.includes('target:enemy-2:defense') &&
    !routeAgainstEnemy2.dependencyKeys.some(key =>
      key === 'target:enemy:defense' ||
      key.startsWith('unit:enemy:')
    ),
  {
    routeAgainstEnemy: routeAgainstEnemy?.dependencyKeys,
    routeAgainstEnemy2: routeAgainstEnemy2?.dependencyKeys,
  },
);

const freeRouteAgainstEnemy = Object.values(isolatedDependencyRequest.actorCandidateRoutes)
  .find(route =>
    String(route?.candidateId || '').includes(':skill:weak:') &&
    route.targetIds?.length === 1 &&
    route.targetIds[0] === 'enemy'
  );
const worldDependencyHash = (snapshot, route) => preview.stableHash(
  (route?.dependencyKeys || [])
    .filter(key => /^(unit:|target:|rule:)/.test(String(key || '').trim()))
    .map(key => [key, preview.dependencyValueForKey(snapshot, key)]),
);
addCheck(
  'dependency-view:free-physical-route-captures-directional-state-scopes',
  freeRouteAgainstEnemy &&
    !freeRouteAgainstEnemy.dependencyKeys.includes('unit:actor:resource:魂力') &&
    !freeRouteAgainstEnemy.dependencyKeys.includes('unit:enemy:resource:魂力') &&
    !freeRouteAgainstEnemy.dependencyKeys.includes('unit:enemy:resource:精神力') &&
    !freeRouteAgainstEnemy.dependencyKeys.includes('unit:enemy:resourceMax:精神力') &&
    !freeRouteAgainstEnemy.dependencyKeys.includes('unit:actor:state:__collection') &&
    !freeRouteAgainstEnemy.dependencyKeys.includes('unit:enemy:state:__collection') &&
    freeRouteAgainstEnemy.dependencyKeys.includes('unit:actor:state:__OUTGOING_DAMAGE') &&
    freeRouteAgainstEnemy.dependencyKeys.includes('unit:actor:state:__OUTGOING_HIT') &&
    freeRouteAgainstEnemy.dependencyKeys.includes('unit:enemy:state:__INCOMING_DAMAGE') &&
    freeRouteAgainstEnemy.dependencyKeys.includes('unit:enemy:state:__INCOMING_HIT') &&
    freeRouteAgainstEnemy.dependencyKeys
      .filter(key => key.startsWith('unit:actor:state:'))
      .every(key => [
        'unit:actor:state:__action',
        'unit:actor:state:__OUTGOING_DAMAGE',
        'unit:actor:state:__OUTGOING_HIT',
        'unit:actor:state:__SUPPRESSION',
        'unit:actor:state:__GRANTED_EFFECTS',
      ].includes(key)),
  { dependencyKeys: freeRouteAgainstEnemy?.dependencyKeys },
);

const unreadFieldWorld = structuredClone(isolatedDependencyWorld);
unreadFieldWorld.参战者.team_enemy[0].审计备注 = 'does-not-affect-preview';
const readDefenseWorld = structuredClone(isolatedDependencyWorld);
readDefenseWorld.参战者.team_enemy[0].def = 155;
readDefenseWorld.参战者.team_enemy[0].属性.防御 = 155;
const addedStateWorld = structuredClone(isolatedDependencyWorld);
addedStateWorld.参战者.team_player[0].状态效果['新增命中增益'] = {
  状态: '新增命中增益',
  战斗效果: { hit_bonus: 0.2 },
};
const baseRouteDependencyHash = worldDependencyHash(
  isolatedDependencyWorld,
  freeRouteAgainstEnemy,
);
addCheck(
  'cache:unread-world-field-preserves-route-dependency-hash',
  baseRouteDependencyHash === worldDependencyHash(unreadFieldWorld, freeRouteAgainstEnemy),
  {
    baseRouteDependencyHash,
    unreadFieldDependencyHash: worldDependencyHash(unreadFieldWorld, freeRouteAgainstEnemy),
  },
);
addCheck(
  'cache:read-defense-and-new-state-invalidate-route-dependency-hash',
  baseRouteDependencyHash !== worldDependencyHash(readDefenseWorld, freeRouteAgainstEnemy) &&
    baseRouteDependencyHash !== worldDependencyHash(addedStateWorld, freeRouteAgainstEnemy),
  {
    baseRouteDependencyHash,
    defenseDependencyHash: worldDependencyHash(readDefenseWorld, freeRouteAgainstEnemy),
    addedStateDependencyHash: worldDependencyHash(addedStateWorld, freeRouteAgainstEnemy),
  },
);

const actorOutgoingStateWorld = structuredClone(isolatedDependencyWorld);
actorOutgoingStateWorld.参战者.team_player[0].状态效果['输出命中增益'] = {
  状态: '输出命中增益',
  战斗效果: { hit_bonus: 0.2 },
};
const actorIncomingStateWorld = structuredClone(isolatedDependencyWorld);
actorIncomingStateWorld.参战者.team_player[0].状态效果['来袭减伤'] = {
  状态: '来袭减伤',
  战斗效果: { damage_reduction: 0.2 },
};
const targetIncomingStateWorld = structuredClone(isolatedDependencyWorld);
targetIncomingStateWorld.参战者.team_enemy[0].状态效果['目标减伤'] = {
  状态: '目标减伤',
  战斗效果: { damage_reduction: 0.2 },
};
const targetOutgoingStateWorld = structuredClone(isolatedDependencyWorld);
targetOutgoingStateWorld.参战者.team_enemy[0].状态效果['目标输出增益'] = {
  状态: '目标输出增益',
  战斗效果: { damage_bonus: 0.2 },
};
addCheck(
  'cache:directional-state-change-invalidates-only-affected-route-side',
  baseRouteDependencyHash !==
    worldDependencyHash(actorOutgoingStateWorld, freeRouteAgainstEnemy) &&
    baseRouteDependencyHash ===
    worldDependencyHash(actorIncomingStateWorld, freeRouteAgainstEnemy) &&
    baseRouteDependencyHash !==
    worldDependencyHash(targetIncomingStateWorld, freeRouteAgainstEnemy) &&
    baseRouteDependencyHash ===
    worldDependencyHash(targetOutgoingStateWorld, freeRouteAgainstEnemy),
  {
    baseRouteDependencyHash,
    actorOutgoingStateHash: worldDependencyHash(
      actorOutgoingStateWorld,
      freeRouteAgainstEnemy,
    ),
    actorIncomingStateHash: worldDependencyHash(
      actorIncomingStateWorld,
      freeRouteAgainstEnemy,
    ),
    targetIncomingStateHash: worldDependencyHash(
      targetIncomingStateWorld,
      freeRouteAgainstEnemy,
    ),
    targetOutgoingStateHash: worldDependencyHash(
      targetOutgoingStateWorld,
      freeRouteAgainstEnemy,
    ),
  },
);

const thresholdWorld = {
  回合: 1,
  参战者: {
    team_player: [unit('threshold-actor', 'player')],
    team_enemy: [unit('threshold-enemy', 'enemy', { hp: 175 })],
  },
};
const thresholdObjective = {
  schemaVersion: '8.3-objective-1',
  startRound: 1,
  maxRounds: 6,
  resolutionPriority: 'DEFEAT_FIRST',
  victory: {
    logic: 'ANY',
    conditions: [{
      conditionId: 'threshold',
      type: 'HP_RATIO_AT_OR_BELOW',
      side: 'ENEMY',
      targetIds: ['threshold-enemy'],
      threshold: 0.3,
    }],
  },
  defeat: {
    logic: 'ANY',
    conditions: [{
      conditionId: 'defeat',
      type: 'TEAM_INCAPACITATED',
      side: 'PLAYER',
      targetIds: ['threshold-actor'],
    }],
  },
};
thresholdWorld.胜负条件 = thresholdObjective;
const thresholdRoute = (candidateId, delta) => decision.actionRouteFromPreview({
  candidate: {
    candidateId,
    declaration: {
      actionKind: 'RELEASE_SKILL',
      actorId: 'threshold-actor',
      targetIds: ['threshold-enemy'],
    },
  },
  previewResult: {
    contributions: [{
      rootCauseId: candidateId,
      effectInstanceId: `${candidateId}:effect`,
      targetId: 'threshold-enemy',
      outcomeKind: 'HP_DELTA',
      windowId: 'NOW',
      expectedDelta: delta,
      evidence: { delta },
    }],
  },
  worldSnapshot: thresholdWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'threshold-actor',
    actorSide: 'team_player',
    visibleWorld: thresholdWorld,
    objectiveContract: thresholdObjective,
  },
});
const preciseThresholdRoute = thresholdRoute('threshold:precise', -25);
const lethalThresholdRoute = thresholdRoute('threshold:lethal', -175);
const thresholdEnvelope = decision.selectPrimaryBackupRoutes([
  preciseThresholdRoute,
  lethalThresholdRoute,
]);
addCheck(
  'routes:objective-conditioned-threshold-prefers-non-overkill',
  thresholdEnvelope.primaryRoute?.candidateId === 'threshold:precise' &&
    preciseThresholdRoute.objectiveRouteUtilityHEPP === 100 &&
    lethalThresholdRoute.objectiveRouteUtilityHEPP === 100 &&
    preciseThresholdRoute.routeDiscardedOverkillPP === 0 &&
    lethalThresholdRoute.routeDiscardedOverkillPP === 30,
  {
    primaryCandidateId: thresholdEnvelope.primaryRoute?.candidateId,
    preciseObjectiveUtility: preciseThresholdRoute.objectiveRouteUtilityHEPP,
    lethalObjectiveUtility: lethalThresholdRoute.objectiveRouteUtilityHEPP,
    preciseOverkillPP: preciseThresholdRoute.routeDiscardedOverkillPP,
    lethalOverkillPP: lethalThresholdRoute.routeDiscardedOverkillPP,
  },
);

addCheck(
  'routes:structural-key-and-health-path',
  String(actorEnvelope.primaryRoute.routeKey).startsWith('route:') &&
    actorEnvelope.primaryRoute.healthTrajectoryByTarget.some(entry =>
      entry.targetId === 'enemy' && entry.actorBenefitPP > 0
    ) &&
    !actorEnvelope.primaryRoute.routeKey.includes('strong'),
);

addCheck(
  'team-plan:stable-excludes-current-actor',
  request.teamMarginalPlan.length > 0 &&
    request.teamMarginalPlan.every(entry =>
      !String(entry.sourceOpportunityId || '').includes(':actor') &&
      !String(entry.sourceOpportunityId || '').startsWith('projected-natural:')
    ) &&
    request.teamMarginalPlan.some(entry =>
      entry.sourceOpportunityId === 'natural:ally:1'
    ),
  { teamMarginalPlan: request.teamMarginalPlan },
);

const reducedWorld = world(10, 100);
const reducedRequest = decision.prepareDecisionRequest({
  worldSnapshot: reducedWorld,
  actorId: 'actor',
  objectiveContract: reducedWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  seed: 835002,
});
const previousStoredIds = new Set([
  actorEnvelope.primaryRoute?.candidateId,
  actorEnvelope.backupRoute?.candidateId,
]);
addCheck(
  'routes:full-rebuild-can-promote-unstored-route',
  reducedRequest.actionRouteCatalog.actor.searchedRouteCount > 1 &&
    [
      reducedRequest.actionRouteCatalog.actor.primaryRoute?.candidateId,
      reducedRequest.actionRouteCatalog.actor.backupRoute?.candidateId,
    ].some(candidateId => candidateId && !previousStoredIds.has(candidateId)),
  {
    previousStoredIds: [...previousStoredIds],
    rebuiltPrimary: reducedRequest.actionRouteCatalog.actor.primaryRoute?.candidateId,
    rebuiltBackup: reducedRequest.actionRouteCatalog.actor.backupRoute?.candidateId,
  },
);

const changedWorld = world(100, 180);
changedWorld.参战者.team_enemy[0].hp = 450;
changedWorld.参战者.team_enemy[0].属性.HP = 450;
const fullChanged = decision.prepareDecisionRequest({
  worldSnapshot: changedWorld,
  actorId: 'actor',
  objectiveContract: changedWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      {
        opportunityId: 'natural:actor:1',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'EXECUTING',
        createdAtSequence: 1,
      },
      {
        opportunityId: 'natural:ally:1',
        ownerId: 'ally',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 2,
      },
      {
        opportunityId: 'natural:enemy:1',
        ownerId: 'enemy',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 3,
      },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 835003,
});
const localDependencyView = decision.createDependencyView({
  worldSnapshot: fullChanged.visibleWorld,
  objectiveContract: fullChanged.objectiveContract,
  opportunitySnapshot: fullChanged.evaluationContext.opportunitySnapshot,
  scheduledEvents: fullChanged.evaluationContext.scheduledEvents,
  beliefState: fullChanged.beliefState,
});
const localChanged = decision.buildR8RouteCatalog({
  worldSnapshot: fullChanged.visibleWorld,
  actorId: 'actor',
  actorCandidates: fullChanged.frozenCandidates,
  beliefState: fullChanged.beliefState,
  battleIntent: fullChanged.battleIntent,
  actionOpportunity: fullChanged.actionOpportunity,
  objectiveContract: fullChanged.objectiveContract,
  dependencyView: localDependencyView,
  evaluationContext: fullChanged.evaluationContext,
  previousCatalog: request.actionRouteCatalog,
  affectedUnitIds: ['enemy'],
});
addCheck(
  'cache:local-full-route-hash-equal',
  preview.stableHash(localChanged.routeCatalog) === preview.stableHash(fullChanged.actionRouteCatalog),
  {
    localHash: preview.stableHash(localChanged.routeCatalog),
    fullHash: preview.stableHash(fullChanged.actionRouteCatalog),
    recomputedUnitCount: localChanged.cacheMetrics.recomputedUnitCount,
    firstDifference: firstStructuralDifference(
      localChanged.routeCatalog,
      fullChanged.actionRouteCatalog,
    ),
  },
);

const reusedRequest = decision.prepareDecisionRequest({
  worldSnapshot: source,
  actorId: 'actor',
  objectiveContract: source.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      {
        opportunityId: 'natural:actor:1',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'EXECUTING',
        createdAtSequence: 1,
      },
      {
        opportunityId: 'natural:ally:1',
        ownerId: 'ally',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 2,
      },
      {
        opportunityId: 'natural:enemy:1',
        ownerId: 'enemy',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 3,
      },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  previousRouteCatalog: request.actionRouteCatalog,
  affectedRouteUnitIds: ['actor'],
  affectedRouteTargetUnitIds: [],
  seed: 835001,
});
addCheck(
  'cache:unused-invalidation-hint-does-not-falsify-executed-work-metrics',
  request.requestHash === reusedRequest.requestHash &&
    preview.stableHash(request.actionRouteCatalog) ===
      preview.stableHash(reusedRequest.actionRouteCatalog) &&
    preview.stableHash(request.routeCacheMetrics) ===
      preview.stableHash(reusedRequest.routeCacheMetrics),
  {
    requestHash: request.requestHash,
    reusedRequestHash: reusedRequest.requestHash,
    firstRouteDifference: firstStructuralDifference(
      request.actionRouteCatalog,
      reusedRequest.actionRouteCatalog,
    ),
    originalMetrics: request.routeCacheMetrics,
    reusedMetrics: reusedRequest.routeCacheMetrics,
  },
);

const preparedRouteCache = decision.preparedRouteCacheSnapshot(request);
const ownershipIndex = preparedRouteCache.routeFactOwnershipIndex || {};
const ownersByFact = ownershipIndex.ownersByFact || {};
const expectedOwnershipRows = Object.entries(
  preparedRouteCache.fullRoutesByUnit || {},
).flatMap(([unitId, routes]) =>
  (Array.isArray(routes) ? routes : []).flatMap(route => [
    ...(route?.dependencyKeys || []).map(factKey => ({
      factKey,
      unitId,
      candidateId: route.candidateId,
      role: 'DEPENDENCY_READ',
    })),
    ...(route?.opportunityDependencies || [])
      .map(dependency => ({
        factKey: `opportunity:${
          String(
            dependency?.opportunityId ||
            dependency?.grantId ||
            dependency?.descriptorId ||
            '',
          ).trim()
        }`,
        unitId,
        candidateId: route.candidateId,
        role: String(dependency?.role || 'OPPORTUNITY_DEPENDENCY'),
      }))
      .filter(row => row.factKey !== 'opportunity:'),
    ...(route?.paymentDependencies || [])
      .map(dependency => ({
        factKey: `unit:${String(dependency?.unitId || '').trim()}:resource:${
          String(dependency?.resource || '').trim()
        }`,
        unitId,
        candidateId: route.candidateId,
        role: 'PAYMENT_DEPENDENCY',
      }))
      .filter(row => !/:resource:$/.test(row.factKey)),
  ]),
);
const missingOwnershipRows = expectedOwnershipRows.filter(expected =>
  !(ownersByFact[expected.factKey] || []).some(owner =>
    String(owner?.unitId || '') === String(expected.unitId || '') &&
    String(owner?.candidateId || '') ===
      String(expected.candidateId || '') &&
    String(owner?.role || '') === String(expected.role || '')
  ),
);
addCheck(
  'route-fact-ownership:complete-private-index',
  ownershipIndex.schemaVersion === 'RouteFactOwnershipIndexV1' &&
    expectedOwnershipRows.length > 0 &&
    missingOwnershipRows.length === 0 &&
    !Object.hasOwn(request, 'routeFactOwnershipIndex') &&
    !JSON.stringify(request).includes('RouteFactOwnershipIndexV1'),
  {
    summary: preparedRouteCache.routeFactOwnershipSummary,
    expectedOwnershipCount: expectedOwnershipRows.length,
    missingOwnershipRows,
    requestContainsOwnershipIndex:
      Object.hasOwn(request, 'routeFactOwnershipIndex') ||
      JSON.stringify(request).includes('RouteFactOwnershipIndexV1'),
  },
);
addCheck(
  'route-fact-ownership:unread-fact-has-no-owner',
  !Object.hasOwn(ownersByFact, 'unit:unrelated:state:never-read'),
);
const candidateScopedReuseRequest = decision.prepareDecisionRequest({
  worldSnapshot: source,
  actorId: 'actor',
  objectiveContract: source.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      {
        opportunityId: 'natural:actor:1',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'EXECUTING',
        createdAtSequence: 1,
      },
      {
        opportunityId: 'natural:ally:1',
        ownerId: 'ally',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 2,
      },
      {
        opportunityId: 'natural:enemy:1',
        ownerId: 'enemy',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 3,
      },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  previousRouteCatalog: request.actionRouteCatalog,
  previousFullRoutesByUnit: preparedRouteCache.fullRoutesByUnit,
  previousActorCandidateRoutes: preparedRouteCache.actorCandidateRoutes,
  previousActorProjectedWorlds: preparedRouteCache.actorProjectedWorlds,
  previousActorProjectedWorldRevisions: preparedRouteCache.actorProjectedWorldRevisions,
  previousActorPredictedOutcomeEvidence: preparedRouteCache.actorPredictedOutcomeEvidence,
  previousActorCandidateEnvelopeDeltas: preparedRouteCache.actorCandidateEnvelopeDeltas,
  affectedRouteUnitIds: ['actor'],
  affectedRouteTargetUnitIds: [],
  affectedRouteKeysByUnit: {
    actor: [request.frozenCandidates[0].candidateId],
  },
  seed: 835001,
});
addCheck(
  'cache:candidate-scoped-invalidation-preserves-unaffected-mechanical-routes',
  preview.stableHash(request.actionRouteCatalog) ===
    preview.stableHash(candidateScopedReuseRequest.actionRouteCatalog) &&
    candidateScopedReuseRequest.routeCacheMetrics.recomputedUnitIds.length === 1 &&
    candidateScopedReuseRequest.routeCacheMetrics.recomputedUnitIds[0] === 'actor' &&
    candidateScopedReuseRequest.routeCacheMetrics.mechanicalReuseAttemptCount > 0 &&
    candidateScopedReuseRequest.routeCacheMetrics.reusedRouteCandidateCount >=
      request.frozenCandidates.length - 1,
  {
    expectedAffectedCandidateId: request.frozenCandidates[0].candidateId,
    firstRouteDifference: firstStructuralDifference(
      request.actionRouteCatalog,
      candidateScopedReuseRequest.actionRouteCatalog,
    ),
    routeCacheMetrics: candidateScopedReuseRequest.routeCacheMetrics,
  },
);

addCheck(
  'cache:reported-recomputed-unit-count-equals-executed-rebuild-set',
  reusedRequest.routeCacheMetrics.recomputedUnitCount ===
    reusedRequest.routeCacheMetrics.recomputedUnitIds.length,
  {
    reportedRecomputedUnitCount:
      reusedRequest.routeCacheMetrics.recomputedUnitCount,
    executedRecomputedUnitIds:
      reusedRequest.routeCacheMetrics.recomputedUnitIds,
    previewCalls: reusedRequest.routeCacheMetrics.previewCalls,
  },
);

const directOpportunityImpact = decision.buildOpportunityImpactSet({
  candidate: {
    candidateId: 'actor:basic:enemy',
    declaration: {
      actionKind: 'BASIC_ATTACK',
      actorId: 'actor',
      targetIds: ['enemy'],
    },
  },
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    grantType: 'NATURAL_ACTION',
    status: 'EXECUTING',
  },
  previewResult: { contributions: [] },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:actor:1',
      ownerId: 'actor',
      grantType: 'NATURAL_ACTION',
      status: 'EXECUTING',
    },
    {
      opportunityId: 'natural:ally:1',
      ownerId: 'ally',
      grantType: 'NATURAL_ACTION',
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:enemy:1',
      ownerId: 'enemy',
      grantType: 'NATURAL_ACTION',
      status: 'PENDING',
    },
  ],
});
addCheck(
  'opportunity-impact:ordinary-action-depends-only-on-executing-opportunity',
  directOpportunityImpact.concreteIds.length === 1 &&
    directOpportunityImpact.concreteIds[0] === 'natural:actor:1',
  {
    opportunityImpact: directOpportunityImpact,
  },
);

const originalDependencyHash = dependencyView.dependencyValueHash(dependencyKeys);
const changedDependencyView = fullChanged.evaluationContext.dependencyView;
changedDependencyView.readUnitHp('actor');
changedDependencyView.readUnitBaseMaxHp('enemy');
changedDependencyView.readResource('actor', '魂力');
changedDependencyView.readDefenseProfile('enemy');
changedDependencyView.readOpportunity('natural:actor:1');
changedDependencyView.readObjective('victory');
const changedDependencyHash = changedDependencyView.dependencyValueHash(dependencyKeys);
addCheck(
  'cache:dependency-value-invalidates-key',
  originalDependencyHash !== changedDependencyHash &&
    decision.r8PreviewCacheKey(request.evaluationContext, request.frozenCandidates[0], originalDependencyHash) !==
      decision.r8PreviewCacheKey(fullChanged.evaluationContext, fullChanged.frozenCandidates[0], changedDependencyHash),
  { originalDependencyHash, changedDependencyHash },
);

const hiddenOnlyWorld = world(100, 180);
const hiddenOnlyRequest = decision.prepareDecisionRequest({
  worldSnapshot: hiddenOnlyWorld,
  actorId: 'actor',
  objectiveContract: hiddenOnlyWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      {
        opportunityId: 'natural:actor:1',
        ownerId: 'actor',
        grantType: 'NATURAL_ACTION',
        status: 'EXECUTING',
        createdAtSequence: 1,
      },
      {
        opportunityId: 'natural:ally:1',
        ownerId: 'ally',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 2,
      },
      {
        opportunityId: 'natural:enemy:1',
        ownerId: 'enemy',
        grantType: 'NATURAL_ACTION',
        status: 'PENDING',
        createdAtSequence: 3,
      },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 835004,
});
const hiddenOnlyView = hiddenOnlyRequest.evaluationContext.dependencyView;
hiddenOnlyView.readUnitHp('actor');
hiddenOnlyView.readUnitBaseMaxHp('enemy');
hiddenOnlyView.readResource('actor', '魂力');
hiddenOnlyView.readDefenseProfile('enemy');
hiddenOnlyView.readOpportunity('natural:actor:1');
hiddenOnlyView.readObjective('victory');
addCheck(
  'cache:hidden-defense-does-not-leak-into-visible-key',
  hiddenOnlyView.dependencyValueHash(dependencyKeys) === originalDependencyHash,
);

const decisionSource = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
addCheck(
  'source:r8-route-chain-is-separate-from-old-scorers',
  /function createDependencyView\(/.test(decisionSource) &&
    /function buildR8RouteCatalog\(/.test(decisionSource) &&
    /function buildTeamMarginalPlan\(/.test(decisionSource) &&
    !/scoreCandidatesNext\([\s\S]{0,120}buildR8RouteCatalog/.test(decisionSource),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    searchedRouteCount: request.routeCacheMetrics.searchedRouteCount,
    routeCacheStatus: failed.length === 0 ? 'R8_ROUTE_CACHE_CONTRACT_PASSED' : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

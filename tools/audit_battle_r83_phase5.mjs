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
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
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
      !String(entry.sourceOpportunityId || '').includes(':actor')
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
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
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

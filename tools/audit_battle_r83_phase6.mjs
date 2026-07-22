import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, structuredClone, Math: Object.create(Math), Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol, parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const fileName of ['MVU_Skill_Runtime.js', 'BattlePreview_Module.js', 'BattleDecision_Module.js']) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'), sandbox, { filename: fileName });
}
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const checks = [];
const add = (id, passed, detail = {}) => checks.push({ checkId: id, passed: passed === true, ...detail });

const actor = {
  id: 'actor', name: 'actor', side: 'player', hp: 500, hp_max: 500, sp: 100, sp_max: 100,
  men: 100, men_max: 100, vit: 100, vit_max: 100, str: 150, def: 100, agi: 100,
  属性: { 等级: 60, HP: 500, HP上限: 500, 魂力: 100, 魂力上限: 100, 精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100, 力量: 150, 防御: 100, 敏捷: 100 },
  状态: { 存活: true, 行动: '战斗' }, 状态效果: {}, 技能列表: [],
};
const enemy = structuredClone(actor);
enemy.id = 'enemy';
enemy.name = 'enemy';
enemy.side = 'enemy';
enemy.sp = 7;
enemy.属性.魂力 = 7;
const world = { 回合: 1, 参战者: { team_player: [actor], team_enemy: [enemy] } };
const publicResponses = {
  enemy: [
    { responseId: 'a', responseRole: 'ACTIVE', baseActionValue: 10, evidenceEventIds: ['e1'] },
    { responseId: 'b', responseRole: 'ACTIVE', baseActionValue: 20, evidenceEventIds: ['e2'] },
    { responseId: 'c', responseRole: 'ACTIVE', baseActionValue: 40, lethal: true, evidenceEventIds: ['e3'] },
  ],
};
const belief = decision.buildInitialBelief(world, 'actor', { confidence: 0.6, publicResponses });
add('belief:deterministic-level-experience', belief.confidence === 0.6);
const visible = decision.buildDecisionWorld(world, 'actor', belief);
const visibleEnemy = visible.参战者.team_enemy[0];
add('belief:hidden-resource-not-exact', visibleEnemy.sp !== 7 && belief.units.enemy.resources === undefined);

const response = decision.buildR8ResponseModel({
  actorSide: 'team_player',
  visibleWorld: visible,
  beliefState: belief,
  actionOpportunity: { futureHostileResponseAllowed: true },
  evaluationContext: {
    opportunitySnapshot: [{
      opportunityId: 'natural:enemy:future',
      ownerId: 'enemy',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      status: 'PENDING',
    }],
  },
}, 'candidate');
add(
  'response:max-two-plus-disaster-and-mass',
    response.mainBranches.length === 2 &&
    response.disasterTail?.sourceActorId === 'enemy' &&
    Math.abs(response.unknownMass - 0.14) < 1e-9 &&
    response.noResponseProbability >= 0,
  { response },
);

let adapted = belief;
for (let index = 0; index < 20; index += 1) {
  adapted = decision.updateMechanicBelief(adapted, {
    sourceActionId: 'family',
    effectPrototype: '状态施加',
    targetId: 'enemy',
    relevantStateFingerprint: 'state',
    estimatedProbability: 0.8,
    experience: 0.6,
    success: false,
  });
}
const key = decision.mechanicKey({
  sourceActionId: 'family',
  effectPrototype: '状态施加',
  targetId: 'enemy',
  relevantStateFingerprint: 'state',
});
const posterior = decision.mechanicPosterior(adapted, key, 0.8, 0.6);
add('belief:beta-failure-degrades-without-hard-zero', posterior > 0 && posterior < 0.8, { posterior });

const fakeRequest = {
  actorId: 'actor',
  beliefState: { confidence: 0.5 },
  actionOpportunity: {},
  frozenCandidates: [{ candidateId: 'observe', declaration: { actionKind: 'OBSERVE', skill: { _效果数组: [] } } }],
  actionRouteCatalog: { actor: { primaryRoute: { routeKey: 'p', routeBenefitPP: 10 }, backupRoute: { routeKey: 'b', routeBenefitPP: 4 } } },
  observationOutcomesByCandidate: {
    observe: [{
      observationGroupId: 'hit',
      probability: 1,
      valueBeforeHEPP: 10,
      bestValueAfterHEPP: 14,
      nextPrimaryRouteKey: 'p',
      nextBackupRouteKey: 'b2',
    }],
  },
};
add('information:value-only-when-route-can-change', decision.r8InformationValue(fakeRequest, 'observe') === 4);
fakeRequest.actionOpportunity.noFutureOpportunity = true;
add('information:zero-without-future-opportunity', decision.r8InformationValue(fakeRequest, 'observe') === 0);

const objectiveConditionedInformationValue = decision.r8InformationValue({
  actorId: 'actor',
  beliefState: { confidence: 0.5 },
  actionOpportunity: {},
  actionRouteCatalog: {
    actor: {
      primaryRoute: {
        routeKey: 'raw-high-objective-low',
        routeBenefitPP: 100,
        objectiveRouteUtilityHEPP: 5,
      },
      backupRoute: {
        routeKey: 'raw-low-objective-high',
        routeBenefitPP: 4,
        objectiveRouteUtilityHEPP: 9,
      },
    },
  },
  observationOutcomesByCandidate: {
    observe: [{
      observationGroupId: 'objective-conditioned-route-switch',
      probability: 1,
      nextPrimaryRouteKey: 'raw-low-objective-high',
      nextBackupRouteKey: 'raw-high-objective-low',
    }],
  },
}, 'observe');
add(
  'information:uses-objective-conditioned-route-value',
  Math.abs(objectiveConditionedInformationValue - 4) < 1e-9,
  { objectiveConditionedInformationValue },
);

function damageSkill(id, power, hitProbability) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: `${id}:damage`,
      原型: '伤害结算',
      目标: '单体',
      威力倍率: power,
      伤害类型: '近身攻击',
      命中概率: `${hitProbability}%`,
    }],
  };
}

function productionUnit(id, side, skills = []) {
  return {
    id,
    name: id,
    名称: id,
    side,
    hp: 500,
    hp_max: 500,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: 160,
    def: 100,
    agi: 100,
    属性: {
      等级: 60,
      HP: 500,
      HP上限: 500,
      魂力: 100,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 160,
      防御: 100,
      敏捷: 100,
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    技能列表: skills,
  };
}

function productionObjective() {
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

function productionInformationRequest({
  futureOpportunity = true,
  lethal = false,
  disableObservationRouteReuse = false,
} = {}) {
  const objectiveContract = productionObjective();
  const worldSnapshot = {
    回合: 1,
    胜负条件: objectiveContract,
    参战者: {
      team_player: [productionUnit('actor', 'player', [
        damageSkill('risky', lethal ? 2000 : 100, lethal ? 100 : 20),
        damageSkill('safe', 60, 70),
      ])],
      team_enemy: [productionUnit('enemy', 'enemy')],
    },
  };
  return decision.prepareDecisionRequest({
    worldSnapshot,
    actorId: 'actor',
    objectiveContract,
    beliefState: { confidence: 0.45, observationGranted: true },
    actionOpportunity: {
      opportunityId: 'natural:actor:current',
      ownerId: 'actor',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 1,
    },
    runtimeSnapshot: {
      opportunitySnapshot: [
        {
          opportunityId: 'natural:actor:current',
          ownerId: 'actor',
          grantType: 'NATURAL_ACTION',
          status: 'EXECUTING',
          createdAtSequence: 1,
        },
        ...(futureOpportunity ? [{
          opportunityId: 'natural:actor:next',
          ownerId: 'actor',
          grantType: 'NATURAL_ACTION',
          status: 'PENDING',
          createdAtSequence: 3,
        }] : []),
      ],
      resourceTimeline: [],
      scheduledEvents: [],
    },
    seed: 836001,
    disableObservationRouteReuse,
  });
}

const productionInformation = productionInformationRequest();
const observeCandidate = productionInformation.frozenCandidates.find(candidate =>
  candidate.declaration.actionKind === 'OBSERVE'
);
const productionOutcomes =
  productionInformation.observationOutcomesByCandidate[observeCandidate?.candidateId] || [];
add(
  'information:production-request-rebuilds-future-routes',
  !!observeCandidate &&
    productionOutcomes.length >= 2 &&
    productionOutcomes.some(outcome =>
      outcome.nextPrimaryRouteKey !==
        productionInformation.actionRouteCatalog.actor.primaryRoute?.routeKey
    ) &&
    Number(productionInformation.informationValueByCandidate[observeCandidate.candidateId] || 0) > 0,
  {
    observeCandidateId: observeCandidate?.candidateId,
    informationValue:
      productionInformation.informationValueByCandidate[observeCandidate?.candidateId] || 0,
    productionOutcomes,
  },
);

const fullProductionInformation = productionInformationRequest({
  disableObservationRouteReuse: true,
});
add(
  'information:optimized-full-observation-outcomes-hash-equal',
  preview.stableHash(productionInformation.observationOutcomesByCandidate) ===
    preview.stableHash(fullProductionInformation.observationOutcomesByCandidate),
);
add(
  'information:optimized-full-request-hash-equal',
  productionInformation.requestHash === fullProductionInformation.requestHash,
  {
    optimizedRequestHash: productionInformation.requestHash,
    fullRequestHash: fullProductionInformation.requestHash,
  },
);
add(
  'information:optimized-full-information-value-hash-equal',
  preview.stableHash(productionInformation.informationValueByCandidate) ===
    preview.stableHash(fullProductionInformation.informationValueByCandidate),
);
add(
  'information:optimized-reuses-unaffected-routes',
  Number(
    productionInformation.candidateEnvelopeMetrics
      ?.informationEnvelopeReusedRouteCount || 0
  ) > 0 &&
    Number(
      fullProductionInformation.candidateEnvelopeMetrics
        ?.informationEnvelopeReusedRouteCount || 0
    ) === 0,
  {
    optimizedMetrics: productionInformation.candidateEnvelopeMetrics,
    fullMetrics: fullProductionInformation.candidateEnvelopeMetrics,
  },
);

const noFutureInformation = productionInformationRequest({ futureOpportunity: false });
const noFutureObserve = noFutureInformation.frozenCandidates.find(candidate =>
  candidate.declaration.actionKind === 'OBSERVE'
);
add(
  'information:production-request-zero-without-formal-future-opportunity',
  !!noFutureObserve &&
    !(noFutureInformation.observationOutcomesByCandidate[noFutureObserve.candidateId] || []).length &&
    Number(noFutureInformation.informationValueByCandidate[noFutureObserve.candidateId] || 0) === 0,
);

const terminalInformation = productionInformationRequest({ lethal: true });
const lethalCandidate = terminalInformation.frozenCandidates.find(candidate =>
  candidate.declaration.skill?.id === 'risky'
);
add(
  'information:production-request-zero-after-projected-terminal',
  !!lethalCandidate &&
    !(terminalInformation.observationOutcomesByCandidate[lethalCandidate.candidateId] || []).length &&
    Number(terminalInformation.informationValueByCandidate[lethalCandidate.candidateId] || 0) === 0,
);

const source = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
const experienceBody = source.match(/function experienceOf\([\s\S]*?\n  \}/)?.[0] || '';
add(
  'source:no-random-experience-or-r8-hard-ban',
  !/stableRoll/.test(experienceBody) &&
    !/misjudgmentBudget|失败次数硬禁|adaptationBudget/.test(
      source.match(/function buildR8ResponseModel\([\s\S]*?(?=\n  function r8InformationValue)/)?.[0] || '',
    ),
);

const failed = checks.filter(check => !check.passed);
console.log(JSON.stringify({
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    beliefResponseStatus: failed.length ? 'BLOCKED' : 'R8_BELIEF_RESPONSE_CONTRACT_PASSED',
  },
  checks,
}, null, 2));
if (failed.length) process.exitCode = 1;

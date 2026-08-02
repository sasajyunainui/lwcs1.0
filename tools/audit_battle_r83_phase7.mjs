import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

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
  process,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const fileName of [
  'LibraryData_Runtime.js',
  'CharacterLibrary.js',
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
const contracts = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tools', 'evidence', 'r8', 'r75_minimal_case_contracts.json'), 'utf8'),
);
const checks = [];
const add = (checkId, passed, detail = {}) => checks.push({ checkId, passed: passed === true, ...detail });

let irrelevantTerminalFactorResult = null;
let irrelevantTerminalFactorError = '';
try {
  irrelevantTerminalFactorResult = decision.r8TerminalUtility(
    request(),
    route({
      probabilityFactors: Array.from({ length: 8 }, (_, index) => ({
        rootActionId: 'irrelevant-state',
        effectInstanceId: `irrelevant-state:${index}`,
        targetId: index % 2 ? 'enemy' : 'actor',
        outcomeKind: 'STATE_CHANGED',
        windowId: `state:${index}`,
        distributionGroupKey: `irrelevant-state:${index}`,
        outcomeDistribution: [
          {
            branchKey: 'required-failure',
            probability: 1,
            conditionalOn: { [`primary:${index}`]: 'FAILURE' },
            assignments: { [`state:${index}`]: 'FAILURE' },
            actionState: '',
          },
          {
            branchKey: 'state-failure',
            probability: 0.5,
            conditionalOn: { [`primary:${index}`]: 'SUCCESS' },
            assignments: { [`state:${index}`]: 'FAILURE' },
            actionState: '',
          },
          {
            branchKey: 'state-success',
            probability: 0.5,
            conditionalOn: { [`primary:${index}`]: 'SUCCESS' },
            assignments: { [`state:${index}`]: 'SUCCESS' },
            actionState: '',
          },
        ],
      })),
    }),
  );
} catch (error) {
  irrelevantTerminalFactorError = String(error?.message || error);
}
add(
  'oracle:terminal-ignores-probability-factors-without-terminal-dependency',
  !irrelevantTerminalFactorError &&
    irrelevantTerminalFactorResult?.terminal === false &&
    irrelevantTerminalFactorResult?.ongoingProbability === 1,
  {
    error: irrelevantTerminalFactorError,
    terminal: irrelevantTerminalFactorResult,
  },
);

const negativeReactionRequest = request({
  actionOpportunity: {
    opportunityId: 'reaction:negative',
    ownerId: 'actor',
    role: 'REACTION',
    grantType: 'DEFEND_WINDOW',
    sourceActorId: 'enemy',
    validTargetIds: ['actor'],
    incomingAction: {
      actorId: 'enemy',
      actionKind: 'BASIC_ATTACK',
      targetId: 'actor',
    },
  },
});
const negativeReactionExclusion = decision.r8CandidateExclusion(
  negativeReactionRequest,
  {
    candidateId: 'actor:EVADE',
    declaration: {
      actorId: 'actor',
      actionKind: 'EVADE',
      targetIds: ['actor'],
    },
    costs: {},
  },
  route(),
  {
    objectiveUtilityHEPP: 0,
    directTrajectoryHEPP: 0,
    actionPoolDeltas: [],
    terminal: { terminal: false },
  },
);
add(
  'oracle:negative-reaction-action-yields-opportunity-decline',
  negativeReactionExclusion === 'ZERO_MARGINAL_WITH_COST',
  { negativeReactionExclusion },
);

function unit(id, side, hp = 100, skills = []) {
  return {
    id,
    name: id,
    side,
    hp,
    hp_max: 100,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: 150,
    def: 100,
    agi: 100,
    属性: {
      等级: 60,
      HP: hp,
      HP上限: 100,
      魂力: 100,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 150,
      防御: 100,
      敏捷: 100,
    },
    状态: { 存活: hp > 0, 行动: hp > 0 ? '战斗' : '死亡' },
    状态效果: {},
    技能列表: skills,
  };
}

function objective(type = 'TEAM_INCAPACITATED', extraVictory = []) {
  const primary = type === 'HP_RATIO_AT_OR_BELOW'
    ? { conditionId: 'threshold', type, side: 'ENEMY', threshold: 0.3 }
    : type === 'ROUND_REACHED'
      ? { conditionId: 'round', type, side: 'PLAYER', round: 3 }
      : { conditionId: 'victory', type, side: 'ENEMY' };
  return {
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [primary, ...extraVictory] },
    defeat: {
      logic: 'ANY',
      conditions: [{ conditionId: 'defeat', type: 'TEAM_INCAPACITATED', side: 'PLAYER' }],
    },
  };
}

function request(options = {}) {
  const actor = unit('actor', 'player', options.actorHp ?? 100);
  const ally = unit('ally', 'player', options.allyHp ?? 100);
  const enemy = unit('enemy', 'enemy', options.enemyHp ?? 100);
  const world = {
    回合: 1,
    胜负条件: options.objective || objective(),
    参战者: { team_player: [actor, ally], team_enemy: [enemy] },
  };
  const opportunitySnapshot = options.opportunities || [];
  const scheduledEvents = options.scheduledEvents || [];
  return {
    actorId: 'actor',
    actorSide: 'team_player',
    visibleWorld: world,
    objectiveContract: world.胜负条件,
    beliefState: { confidence: options.confidence ?? 0.6 },
    actionOpportunity: options.actionOpportunity || {
      opportunityId: 'natural:actor:1',
      ownerId: 'actor',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 1,
    },
    evaluationContext: { opportunitySnapshot, scheduledEvents },
    actionRouteCatalog: {
      actor: { primaryRoute: { routeBenefitPP: options.actorRouteValue ?? 20 }, backupRoute: { routeBenefitPP: 8 } },
      ally: { primaryRoute: { routeBenefitPP: options.allyRouteValue ?? 15 }, backupRoute: { routeBenefitPP: 6 } },
      enemy: { primaryRoute: { routeBenefitPP: options.enemyRouteValue ?? 20 }, backupRoute: { routeBenefitPP: 8 } },
    },
    candidateEnvelopeDeltas: options.candidateEnvelopeDeltas || {},
    responseModelByCandidate: {
      test: options.responseModel || { mainBranches: [], disasterTail: null, noResponseProbability: 1 },
    },
    informationValueByCandidate: { test: Number(options.informationValue || 0) },
    seed: options.seed || 1,
    requestHash: 'audit-request',
  };
}

function route(options = {}) {
  const candidateId = options.candidateId || 'test';
  const intrinsicActionPoolDeltas =
    options.intrinsicActionPoolDeltas || [];
  const graphContributions = intrinsicActionPoolDeltas.map(delta => ({
    ...delta,
    rootCauseId: delta?.rootCauseId || delta?.rootActionId || candidateId,
    sourceActionId:
      delta?.sourceActionId || delta?.rootActionId || candidateId,
    evidence: {
      ...(delta?.evidence || {}),
      applicationProbability:
        delta?.evidence?.applicationProbability ??
        delta?.evidence?.r8RealizationProbability ??
        1,
    },
  }));
  const hasProbabilisticGraphContribution = graphContributions.some(delta => {
    const probability = Number(delta?.evidence?.applicationProbability ?? 1);
    return probability > 1e-9 && probability < 1 - 1e-9;
  });
  const operationGraph =
    options.operationGraph ||
    (
      hasProbabilisticGraphContribution
        ? preview.buildActionOperationGraph({
            previewResult: {
              actorId: String(
                options.actorId ||
                candidateId.split(':')[0] ||
                'actor'
              ).trim(),
              actionId: candidateId,
              contributions: graphContributions,
              scheduledEvents: [],
            },
            rootActionId: candidateId,
            actionFingerprint: candidateId,
            round: 1,
            opportunitySequence: 1,
            actionSequence: 1,
          })
        : null
    );
  return {
    routeKey: options.routeKey || 'route:test',
    candidateId,
    declarationFingerprint: 'declaration:test',
    targetIds: options.targetIds || ['enemy'],
    outcomeKinds: options.outcomeKinds || [],
    paymentDependencies: options.paymentDependencies || [],
    opportunityDependencies: options.opportunityDependencies || [],
    realizationWindows: options.realizationWindows || ['NOW'],
    healthTrajectoryByTarget: options.health || [],
    actionPoolEffects: options.effects || [],
    intrinsicActionPoolDeltas,
    probabilityFactors: options.probabilityFactors || [],
    operationGraph,
    terminalPathId: '',
    probabilityBounds: { lower: 0, upper: 1 },
    dependencyKeys: [],
    routeBenefitPP: Number(options.routeBenefitPP || 0),
    ...(Number.isFinite(Number(options.objectiveRouteUtilityHEPP))
      ? { objectiveRouteUtilityHEPP: Number(options.objectiveRouteUtilityHEPP) }
      : {}),
    ...(Number.isFinite(Number(options.intrinsicBehaviorUtilityHEPP))
      ? { intrinsicBehaviorUtilityHEPP: Number(options.intrinsicBehaviorUtilityHEPP) }
      : {}),
    ...(Number.isFinite(Number(options.behaviorRouteUtilityHEPP))
      ? { behaviorRouteUtilityHEPP: Number(options.behaviorRouteUtilityHEPP) }
      : {}),
  };
}

function operationGraphProjection(source, world, assignmentKeys = []) {
  const graph = source?.operationGraph;
  if (!graph) return null;
  return preview.evaluateOperationGraph({
    graph,
    baseState: { world },
    projectionContract: {
      kind: 'PHASE7_ORACLE',
      mergeKey: 'FULL',
      assignmentKeys,
    },
    maxActiveStates: 64,
  });
}

const terminalProjectionFields = [
  'terminal',
  'status',
  'utility',
  'terminalProbability',
  'winProbability',
  'lossProbability',
  'drawProbability',
  'ongoingProbability',
  'expectedTerminalUtility',
  'expectedOngoingTrajectoryUtility',
  'expectedDiscardedOverkillPP',
  'terminalPaths',
  'terminalAfterEffectInstanceId',
  'terminalAtomicKey',
];

function terminalProjectionSnapshot(result = {}) {
  return Object.fromEntries(
    terminalProjectionFields.map(field => [field, result?.[field]]),
  );
}

function terminalProjectionMatches(left = {}, right = {}) {
  return preview.stableHash(terminalProjectionSnapshot(left)) ===
    preview.stableHash(terminalProjectionSnapshot(right));
}

function hp(targetId, deltaPP, effect = 'effect', outcomeKind = 'HP_DELTA', windowId = 'NOW') {
  return {
    targetId,
    outcomeKind,
    windowId,
    healthDeltaPP: deltaPP,
    actorBenefitPP: targetId === 'enemy' ? -deltaPP : deltaPP,
    rootActionId: 'test',
    sourceEffectInstanceId: effect,
  };
}

function probabilisticThresholdRoute(req, candidateId, targetIds) {
  return decision.actionRouteFromPreview({
    candidate: {
      candidateId,
      declaration: {
        actionKind: 'RELEASE_SKILL',
        actorId: 'actor',
        targetIds,
      },
    },
    previewResult: {
      contributions: targetIds.map((targetId, index) => ({
        rootCauseId: candidateId,
        effectInstanceId: `${candidateId}:effect:${index}`,
        targetId,
        outcomeKind: 'HP_DELTA',
        windowId: `HIT:${index}`,
        expectedDelta: -17.5,
        evidence: {
          delta: -17.5,
          distributionGroupKey: `${candidateId}:hit:${index}`,
          outcomeDistribution: [
            {
              branchKey: 'miss',
              probability: 0.5,
              delta: 0,
              assignments: { [`${candidateId}:hit:${index}`]: 'MISS' },
            },
            {
              branchKey: 'hit',
              probability: 0.5,
              delta: -35,
              assignments: { [`${candidateId}:hit:${index}`]: 'HIT' },
            },
          ],
        },
      })),
    },
    worldSnapshot: req.visibleWorld,
    actorSide: req.actorSide,
    dependencyKeys: [],
    objectiveRequest: req,
  });
}

function multiThresholdRequest(logic = 'ANY') {
  const req = request({ enemyHp: 35 });
  const enemies = [
    unit('enemy', 'enemy', 35),
    unit('enemy-2', 'enemy', 35),
    ...Array.from({ length: 5 }, (_, index) =>
      unit(`irrelevant-enemy-${index}`, 'enemy', 100)
    ),
  ];
  req.visibleWorld.参战者.team_enemy = enemies;
  req.objectiveContract = {
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic,
      conditions: [
        {
          conditionId: 'threshold:enemy',
          type: 'HP_RATIO_AT_OR_BELOW',
          side: 'ENEMY',
          targetIds: ['enemy'],
          threshold: 0.3,
        },
        {
          conditionId: 'threshold:enemy-2',
          type: 'HP_RATIO_AT_OR_BELOW',
          side: 'ENEMY',
          targetIds: ['enemy-2'],
          threshold: 0.3,
        },
      ],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'defeat',
        type: 'TEAM_INCAPACITATED',
        side: 'PLAYER',
        targetIds: ['actor', 'ally'],
      }],
    },
  };
  req.visibleWorld.胜负条件 = req.objectiveContract;
  return req;
}

function effect(outcomeKind, targetId, evidence = {}, windowId = 'NEXT') {
  return {
    rootActionId: 'test',
    effectInstanceId: `effect:${outcomeKind}:${targetId}`,
    targetId,
    outcomeKind,
    windowId,
    expectedDelta: 0,
    threatValue: 0,
    evidence,
  };
}

function qualityEnvelopeRequest(targetId, qualityEffect, healthTrajectoryDeltaPP) {
  const opportunityId = `natural:${targetId}:next`;
  return request({
    opportunities: [{
      opportunityId,
      ownerId: targetId,
      grantType: 'NATURAL_ACTION',
      status: 'OPEN',
      round: 1,
      sequence: 2,
    }],
    candidateEnvelopeDeltas: {
      test: [{
        targetId,
        beforeRouteKey: `${targetId}:before`,
        afterRouteKey: `${targetId}:after`,
        beforePP: 20,
        afterPP: 20 + healthTrajectoryDeltaPP,
        healthTrajectoryDeltaPP,
        sourceEffectKeys: [[
          qualityEffect.effectInstanceId,
          qualityEffect.targetId,
          qualityEffect.outcomeKind,
          qualityEffect.windowId,
        ].join('|')],
        sourceHealthFactKeys: [],
        behaviorRealizationWindow: {
          affectedOpportunityIds: [opportunityId],
        },
      }],
    },
  });
}

function project(req, testRoute) {
  return decision.projectR8GoalUtility(req, { candidateId: 'test', declaration: { actionKind: 'RELEASE_SKILL' } }, testRoute);
}

const unsupportedQualityFallbackRoute = route({
  routeKey: 'route:direct-plus-unsupported-quality',
  health: [hp('enemy', -10, 'direct-damage')],
  effects: [effect('NEXT_ACTION_QUALITY_CHANGED', 'actor', {
    qualityFactor: 0.5,
  })],
});
const unsupportedQualityFallbackProjection = project(
  request({ actorRouteValue: 20 }),
  unsupportedQualityFallbackRoute,
);
add(
  'oracle:next-action-quality-requires-real-envelope-delta',
  unsupportedQualityFallbackProjection.directTrajectoryHEPP === 10 &&
    unsupportedQualityFallbackProjection.actionPoolHEPP === 0 &&
    unsupportedQualityFallbackProjection.objectiveUtilityHEPP === 10,
  {
    projection: unsupportedQualityFallbackProjection,
    expected: {
      directTrajectoryHEPP: 10,
      actionPoolHEPP: 0,
      objectiveUtilityHEPP: 10,
    },
  },
);

const supportedQualityEffect = effect(
  'NEXT_ACTION_QUALITY_CHANGED',
  'actor',
  { qualityFactor: 0.5 },
);
const supportedQualityProjection = project(
  qualityEnvelopeRequest('actor', supportedQualityEffect, 6),
  route({
    routeKey: 'route:quality-with-envelope',
    effects: [supportedQualityEffect],
  }),
);
add(
  'oracle:next-action-quality-uses-source-matched-envelope-delta',
  supportedQualityProjection.directTrajectoryHEPP === 0 &&
    supportedQualityProjection.actionPoolHEPP === 6 &&
    supportedQualityProjection.objectiveUtilityHEPP === 6 &&
    supportedQualityProjection.actionPoolDeltas.length === 1 &&
    supportedQualityProjection.actionPoolDeltas[0]?.healthTrajectoryDeltaPP === 6,
  {
    projection: supportedQualityProjection,
  },
);

const copyOnWriteRequest = request();
const copyOnWriteWorldHash = preview.stableHash(copyOnWriteRequest.visibleWorld);
const cumulativeTerminal = decision.r8TerminalUtility(
  copyOnWriteRequest,
  route({
    health: [
      { ...hp('enemy', -30, 'cow:first', 'HP_DELTA', 'FIRST'), contributionSequence: 0 },
      { ...hp('enemy', -20, 'cow:second', 'HP_DELTA', 'SECOND'), contributionSequence: 1 },
    ],
  }),
);
const cumulativeWorld = cumulativeTerminal.ongoingBranchWorlds?.[0]?.world;
const cumulativeEnemy = preview.listUnits(cumulativeWorld)
  .find(entry => preview.unitId(entry.unit) === 'enemy')?.unit;
const branchTerminal = decision.r8TerminalUtility(
  copyOnWriteRequest,
  route({
    health: [{
      ...hp('enemy', -30, 'cow:branch', 'HP_DELTA', 'BRANCH'),
      contributionSequence: 0,
      distributionGroupKey: 'cow:branch',
      outcomeDistribution: [
        { branchKey: 'miss', probability: 0.5, healthDeltaPP: 0 },
        { branchKey: 'hit', probability: 0.5, healthDeltaPP: -30 },
      ],
    }],
  }),
);
const branchEnemyHp = (branchTerminal.ongoingBranchWorlds || [])
  .map(branch => {
    const enemy = preview.listUnits(branch.world)
      .find(entry => preview.unitId(entry.unit) === 'enemy')?.unit;
    return preview.readHp(enemy);
  })
  .sort((left, right) => left - right);
add(
  'oracle:terminal-copy-on-write-preserves-input-and-branch-isolation',
  preview.stableHash(copyOnWriteRequest.visibleWorld) === copyOnWriteWorldHash &&
    preview.readHp(
      preview.listUnits(copyOnWriteRequest.visibleWorld)
        .find(entry => preview.unitId(entry.unit) === 'enemy')?.unit,
    ) === 100 &&
    preview.readHp(cumulativeEnemy) === 50 &&
    JSON.stringify(branchEnemyHp) === JSON.stringify([70, 100]),
  {
    inputWorldHash: copyOnWriteWorldHash,
    cumulativeEnemyHp: preview.readHp(cumulativeEnemy),
    branchEnemyHp,
  },
);
const overhealRequest = request();
overhealRequest.visibleWorld.参战者.team_enemy[0].hp = 95;
overhealRequest.visibleWorld.参战者.team_enemy[0].属性.HP = 95;
const overhealTerminal = decision.r8TerminalUtility(
  overhealRequest,
  route({
    health: [{
      ...hp('enemy', 20, 'overheal', 'HP_DELTA', 'NOW'),
      actorBenefitPP: -20,
    }],
  }),
);
const overhealEnemy = preview.listUnits(
  overhealTerminal.ongoingBranchWorlds?.[0]?.world,
).find(entry => preview.unitId(entry.unit) === 'enemy')?.unit;
add(
  'oracle:projected-healing-cannot-exceed-target-max-hp',
  preview.readHp(overhealEnemy) === 100,
  {
    projectedHp: preview.readHp(overhealEnemy),
    targetMaxHp: preview.readHpMax(overhealEnemy),
  },
);

const sufficientStateRequest = request();
const sufficientStateTerminal = decision.r8TerminalUtility(
  sufficientStateRequest,
  route({
    health: [
      {
        ...hp('enemy', -5, 'sufficient:irrelevant', 'HP_DELTA', 'IRRELEVANT'),
        contributionSequence: 0,
        distributionGroupKey: 'sufficient:irrelevant',
        outcomeDistribution: [
          {
            branchKey: 'history-a',
            probability: 0.5,
            healthDeltaPP: -5,
            assignments: { 'irrelevant-history': 'A' },
          },
          {
            branchKey: 'history-b',
            probability: 0.5,
            healthDeltaPP: -5,
            assignments: { 'irrelevant-history': 'B' },
          },
        ],
      },
      {
        ...hp('enemy', 0, 'sufficient:correlated-source', 'HP_DELTA', 'CORRELATED_SOURCE'),
        contributionSequence: 1,
        distributionGroupKey: 'sufficient:correlated-source',
        outcomeDistribution: [
          {
            branchKey: 'failure',
            probability: 0.5,
            healthDeltaPP: 0,
            assignments: { 'correlated-result': 'FAILURE' },
          },
          {
            branchKey: 'success',
            probability: 0.5,
            healthDeltaPP: 0,
            assignments: { 'correlated-result': 'SUCCESS' },
          },
        ],
      },
      {
        ...hp('enemy', -5, 'sufficient:correlated-follow', 'HP_DELTA', 'CORRELATED_FOLLOW'),
        contributionSequence: 2,
        distributionGroupKey: 'sufficient:correlated-follow',
        outcomeDistribution: [
          {
            branchKey: 'required-failure',
            probability: 1,
            healthDeltaPP: 0,
            conditionalOn: { 'correlated-result': 'FAILURE' },
          },
          {
            branchKey: 'required-success',
            probability: 1,
            healthDeltaPP: -10,
            conditionalOn: { 'correlated-result': 'SUCCESS' },
          },
        ],
      },
    ],
  }),
);
const sufficientStateHp = (sufficientStateTerminal.ongoingBranchWorlds || [])
  .map(branch => {
    const enemy = preview.listUnits(branch.world)
      .find(entry => preview.unitId(entry.unit) === 'enemy')?.unit;
    return {
      probability: branch.probability,
      hp: preview.readHp(enemy),
    };
  })
  .sort((left, right) => left.hp - right.hp);
add(
  'oracle:terminal-sufficient-state-merges-only-irrelevant-history',
  sufficientStateTerminal.terminal === false &&
    sufficientStateTerminal.ongoingProbability === 1 &&
    sufficientStateTerminal.terminalBranchMetrics?.mergeCalls === 6 &&
    sufficientStateTerminal.terminalBranchMetrics?.totalInputBranches -
      sufficientStateTerminal.terminalBranchMetrics?.totalOutputBranches === 1 &&
    sufficientStateTerminal.terminalBranchMetrics?.maxOutputBranches === 2 &&
    JSON.stringify(sufficientStateHp) === JSON.stringify([
      { probability: 0.5, hp: 85 },
      { probability: 0.5, hp: 95 },
    ]),
  {
    terminal: sufficientStateTerminal,
    terminalBranchMetrics: sufficientStateTerminal.terminalBranchMetrics,
    ongoingHp: sufficientStateHp,
  },
);

const thresholdRequest = request({ enemyHp: 35, objective: objective('HP_RATIO_AT_OR_BELOW') });
const thresholdSix = project(thresholdRequest, route({ health: [hp('enemy', -6)] }));
const thresholdLethal = project(thresholdRequest, route({ health: [hp('enemy', -35)] }));
add(
  'oracle:threshold-overkill-exact',
  Math.abs(thresholdSix.directTrajectoryHEPP - 5) < 1e-9 &&
    Math.abs(thresholdSix.discardedOverkillPP - 1) < 1e-9 &&
    Math.abs(thresholdLethal.directTrajectoryHEPP - 5) < 1e-9 &&
    Math.abs(thresholdLethal.discardedOverkillPP - 30) < 1e-9,
  { thresholdSix, thresholdLethal },
);

const deterministicThresholdRoute = route({
  routeKey: 'route:deterministic-threshold',
  health: [hp('enemy', -6, 'deterministic-threshold-effect')],
});
const deterministicThresholdFast = decision.r8TerminalUtility(
  {
    ...thresholdRequest,
    objectiveCompactMode: 'FAST',
  },
  deterministicThresholdRoute,
);
const deterministicThresholdFull = decision.r8TerminalUtility(
  {
    ...thresholdRequest,
    objectiveCompactMode: 'FULL',
  },
  deterministicThresholdRoute,
);
add(
  'oracle:deterministic-terminal-state-overlay-matches-full-world',
  deterministicThresholdFast.terminal === true &&
    deterministicThresholdFast.status === 'PLAYER_WIN' &&
    preview.stableHash(deterministicThresholdFast) ===
      preview.stableHash(deterministicThresholdFull),
  {
    fast: deterministicThresholdFast,
    full: deterministicThresholdFull,
  },
);

const deterministicSummaryRequest = request();
const deterministicSummaryRoute = route({
  routeKey: 'route:summary-deterministic',
  health: [hp('enemy', -30, 'summary-deterministic')],
});
const deterministicSummary = decision.r8TerminalUtility(
  {
    ...deterministicSummaryRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  deterministicSummaryRoute,
);
const deterministicFull = decision.r8TerminalUtility(
  {
    ...deterministicSummaryRequest,
    terminalProjectionMode: 'FULL',
  },
  deterministicSummaryRoute,
);
add(
  'oracle:terminal-summary-matches-full-for-deterministic-damage',
  terminalProjectionMatches(deterministicSummary, deterministicFull) &&
    deterministicSummary.ongoingBranchWorlds.length === 0 &&
    deterministicSummary.terminalBranchWorlds.length === 0 &&
    deterministicFull.ongoingBranchWorlds.length === 1,
  {
    summary: terminalProjectionSnapshot(deterministicSummary),
    full: terminalProjectionSnapshot(deterministicFull),
    summaryOngoingWorldCount: deterministicSummary.ongoingBranchWorlds.length,
    fullOngoingWorldCount: deterministicFull.ongoingBranchWorlds.length,
  },
);

const probabilisticMultiHitRoute = route({
  routeKey: 'route:summary-probabilistic-multi-hit',
  health: Array.from({ length: 3 }, (_, index) => ({
    ...hp(
      'enemy',
      -10,
      `summary-probabilistic-hit:${index}`,
      'HP_DELTA',
      `HIT:${index}`,
    ),
    contributionSequence: index,
    distributionGroupKey: `summary-probabilistic-hit:${index}`,
    outcomeDistribution: [
      {
        branchKey: 'miss',
        probability: 0.5,
        healthDeltaPP: 0,
        assignments: { [`summary-hit:${index}`]: 'MISS' },
      },
      {
        branchKey: 'hit',
        probability: 0.5,
        healthDeltaPP: -20,
        assignments: { [`summary-hit:${index}`]: 'HIT' },
      },
    ],
  })),
});
const probabilisticMultiHitSummary = decision.r8TerminalUtility(
  {
    ...request(),
    terminalProjectionMode: 'SUMMARY',
  },
  probabilisticMultiHitRoute,
);
const probabilisticMultiHitFull = decision.r8TerminalUtility(
  {
    ...request(),
    terminalProjectionMode: 'FULL',
  },
  probabilisticMultiHitRoute,
);
add(
  'oracle:terminal-summary-matches-full-for-probabilistic-multi-hit',
  terminalProjectionMatches(
    probabilisticMultiHitSummary,
    probabilisticMultiHitFull,
  ) &&
    probabilisticMultiHitSummary.ongoingBranchWorlds.length === 0 &&
    probabilisticMultiHitFull.ongoingBranchWorlds.length === 4,
  {
    summary: terminalProjectionSnapshot(probabilisticMultiHitSummary),
    full: terminalProjectionSnapshot(probabilisticMultiHitFull),
    fullOngoingWorldCount: probabilisticMultiHitFull.ongoingBranchWorlds.length,
  },
);

decision.resetMetrics();
const summaryDeferralEnabled = decision.r8TerminalUtility(
  {
    ...request(),
    terminalProjectionMode: 'SUMMARY',
  },
  probabilisticMultiHitRoute,
);
const summaryDeferralEnabledMetrics = decision.readMetrics();
const previousSummaryMergeDeferralFlag =
  process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL;
process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL = '1';
decision.resetMetrics();
let summaryDeferralDisabled = null;
let summaryDeferralDisabledMetrics = null;
try {
  summaryDeferralDisabled = decision.r8TerminalUtility(
    {
      ...request(),
      terminalProjectionMode: 'SUMMARY',
    },
    probabilisticMultiHitRoute,
  );
  summaryDeferralDisabledMetrics = decision.readMetrics();
} finally {
  if (previousSummaryMergeDeferralFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL;
  } else {
    process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL =
      previousSummaryMergeDeferralFlag;
  }
}
add(
  'oracle:summary-branch-merge-deferral-preserves-terminal-projection',
  preview.stableHash(
    terminalProjectionSnapshot(summaryDeferralEnabled),
  ) === preview.stableHash(
    terminalProjectionSnapshot(summaryDeferralDisabled),
  ) &&
    summaryDeferralEnabledMetrics.terminalSummaryDeferredMergeCalls > 0 &&
    summaryDeferralDisabledMetrics.terminalSummaryDeferredMergeCalls === 0 &&
    summaryDeferralDisabledMetrics.terminalBranchMergeCalls > 0,
  {
    enabled: terminalProjectionSnapshot(summaryDeferralEnabled),
    disabled: terminalProjectionSnapshot(summaryDeferralDisabled),
    enabledMetrics: summaryDeferralEnabledMetrics,
    disabledMetrics: summaryDeferralDisabledMetrics,
  },
);

const simpleSummaryRoute = route({
  routeKey: 'route:summary-simple-probabilistic',
  health: [{
    ...hp(
      'enemy',
      -10,
      'summary-simple-probabilistic',
      'HP_DELTA',
      'SIMPLE',
    ),
    contributionSequence: 0,
    distributionGroupKey: 'summary-simple-probabilistic',
    outcomeDistribution: [
      {
        branchKey: 'miss',
        probability: 0.4,
        healthDeltaPP: 0,
        assignments: { 'summary-simple-result': 'MISS' },
      },
      {
        branchKey: 'hit',
        probability: 0.6,
        healthDeltaPP: -20,
        assignments: { 'summary-simple-result': 'HIT' },
      },
    ],
  }],
});
decision.resetMetrics();
const simpleSummaryFast = decision.r8TerminalUtility(
  {
    ...request(),
    terminalProjectionMode: 'SUMMARY',
  },
  simpleSummaryRoute,
);
const simpleSummaryFastMetrics = decision.readMetrics();
const previousSimpleSummaryPathFlag =
  process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH;
process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH = '1';
decision.resetMetrics();
let simpleSummaryGeneric = null;
let simpleSummaryGenericMetrics = null;
try {
  simpleSummaryGeneric = decision.r8TerminalUtility(
    {
      ...request(),
      terminalProjectionMode: 'SUMMARY',
    },
    simpleSummaryRoute,
  );
  simpleSummaryGenericMetrics = decision.readMetrics();
} finally {
  if (previousSimpleSummaryPathFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH;
  } else {
    process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH =
      previousSimpleSummaryPathFlag;
  }
}
add(
  'oracle:simple-summary-terminal-fast-path-matches-generic-projection',
  preview.stableHash(
    terminalProjectionSnapshot(simpleSummaryFast),
  ) === preview.stableHash(
    terminalProjectionSnapshot(simpleSummaryGeneric),
  ) &&
    simpleSummaryFastMetrics.terminalSimpleSummaryFastPathHits === 1 &&
    simpleSummaryGenericMetrics.terminalSimpleSummaryFastPathHits === 0,
  {
    fast: terminalProjectionSnapshot(simpleSummaryFast),
    generic: terminalProjectionSnapshot(simpleSummaryGeneric),
    fastMetrics: simpleSummaryFastMetrics,
    genericMetrics: simpleSummaryGenericMetrics,
  },
);

const thresholdSummary = decision.r8TerminalUtility(
  {
    ...thresholdRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  deterministicThresholdRoute,
);
const thresholdProjectionFull = decision.r8TerminalUtility(
  {
    ...thresholdRequest,
    terminalProjectionMode: 'FULL',
  },
  deterministicThresholdRoute,
);
add(
  'oracle:terminal-summary-preserves-threshold-overkill',
  terminalProjectionMatches(thresholdSummary, thresholdProjectionFull) &&
    thresholdSummary.expectedDiscardedOverkillPP === 1,
  {
    summary: terminalProjectionSnapshot(thresholdSummary),
    full: terminalProjectionSnapshot(thresholdProjectionFull),
  },
);

const deathSummaryRequest = request({
  enemyHp: 10,
  objective: objective('UNIT_DEAD'),
});
const deathSummaryRoute = route({
  routeKey: 'route:summary-death',
  health: [hp('enemy', -10, 'summary-death')],
});
const deathSummary = decision.r8TerminalUtility(
  {
    ...deathSummaryRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  deathSummaryRoute,
);
const deathFull = decision.r8TerminalUtility(
  {
    ...deathSummaryRequest,
    terminalProjectionMode: 'FULL',
  },
  deathSummaryRoute,
);
const incapacitationRequest = request({
  objective: {
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'incapacitate-enemy',
        type: 'UNIT_INCAPACITATED',
        side: 'ENEMY',
        targetIds: ['enemy'],
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'incapacitate-actor',
        type: 'UNIT_INCAPACITATED',
        side: 'PLAYER',
        targetIds: ['actor'],
      }],
    },
  },
});
const incapacitationRoute = route({
  routeKey: 'route:summary-incapacitation',
  probabilityFactors: [{
    rootActionId: 'test',
    effectInstanceId: 'summary-incapacitation',
    targetId: 'enemy',
    windowId: 'NOW',
    distributionGroupKey: 'summary-incapacitation',
    contributionSequence: 0,
    outcomeDistribution: [
      {
        branchKey: 'resisted',
        probability: 0.5,
        assignments: { 'summary-incapacitation': 'RESISTED' },
        actionState: '',
      },
      {
        branchKey: 'applied',
        probability: 0.5,
        assignments: { 'summary-incapacitation': 'APPLIED' },
        actionState: '昏迷',
      },
    ],
  }],
});
const incapacitationSummary = decision.r8TerminalUtility(
  {
    ...incapacitationRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  incapacitationRoute,
);
const incapacitationFull = decision.r8TerminalUtility(
  {
    ...incapacitationRequest,
    terminalProjectionMode: 'FULL',
  },
  incapacitationRoute,
);
add(
  'oracle:terminal-summary-matches-full-for-death-and-incapacitation',
  terminalProjectionMatches(deathSummary, deathFull) &&
    deathSummary.status === 'PLAYER_WIN' &&
    terminalProjectionMatches(incapacitationSummary, incapacitationFull) &&
    incapacitationSummary.winProbability === 0.5 &&
    incapacitationSummary.ongoingProbability === 0.5,
  {
    deathSummary: terminalProjectionSnapshot(deathSummary),
    deathFull: terminalProjectionSnapshot(deathFull),
    incapacitationSummary: terminalProjectionSnapshot(incapacitationSummary),
    incapacitationFull: terminalProjectionSnapshot(incapacitationFull),
  },
);

const conflictRequest = request({
  actorHp: 10,
  enemyHp: 10,
  objective: {
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DRAW_ON_CONFLICT',
    victory: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'conflict-victory',
        type: 'UNIT_DEAD',
        side: 'ENEMY',
        targetIds: ['enemy'],
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'conflict-defeat',
        type: 'UNIT_DEAD',
        side: 'PLAYER',
        targetIds: ['actor'],
      }],
    },
  },
});
const conflictRoute = route({
  routeKey: 'route:summary-conflict',
  health: [
    {
      ...hp('enemy', -10, 'summary-conflict', 'HP_DELTA', 'NOW'),
      contributionSequence: 0,
    },
    {
      ...hp('actor', -10, 'summary-conflict', 'HP_DELTA', 'NOW'),
      contributionSequence: 0,
    },
  ],
});
const conflictSummary = decision.r8TerminalUtility(
  {
    ...conflictRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  conflictRoute,
);
const conflictFull = decision.r8TerminalUtility(
  {
    ...conflictRequest,
    terminalProjectionMode: 'FULL',
  },
  conflictRoute,
);
add(
  'oracle:terminal-summary-preserves-simultaneous-resolution-priority',
  terminalProjectionMatches(conflictSummary, conflictFull) &&
    conflictSummary.status === 'DRAW' &&
    conflictSummary.drawProbability === 1,
  {
    summary: terminalProjectionSnapshot(conflictSummary),
    full: terminalProjectionSnapshot(conflictFull),
  },
);

const cachedSummaryRequest = request({
  enemyHp: 35,
  objective: objective('HP_RATIO_AT_OR_BELOW'),
});
const cachedSummaryRoute = probabilisticThresholdRoute(
  cachedSummaryRequest,
  'summary-cache-isolation',
  ['enemy'],
);
const cachedSummaryResult = decision.r8TerminalUtility(
  {
    ...cachedSummaryRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  cachedSummaryRoute,
);
const cachedFullResult = decision.r8TerminalUtility(
  {
    ...cachedSummaryRequest,
    terminalProjectionMode: 'FULL',
  },
  cachedSummaryRoute,
);
add(
  'oracle:terminal-summary-cache-cannot-satisfy-full-request',
  terminalProjectionMatches(cachedSummaryResult, cachedFullResult) &&
    cachedSummaryResult.ongoingBranchWorlds.length === 0 &&
    cachedSummaryResult.terminalBranchWorlds.length === 0 &&
    cachedFullResult.ongoingBranchWorlds.length > 0 &&
    cachedFullResult.terminalBranchWorlds.length > 0 &&
    cachedFullResult.ongoingBranchWorlds.every(branch => branch.world) &&
    cachedFullResult.terminalBranchWorlds.every(branch => branch.world),
  {
    summary: terminalProjectionSnapshot(cachedSummaryResult),
    full: terminalProjectionSnapshot(cachedFullResult),
    summaryOngoingWorldCount: cachedSummaryResult.ongoingBranchWorlds.length,
    summaryTerminalWorldCount: cachedSummaryResult.terminalBranchWorlds.length,
    fullOngoingWorldCount: cachedFullResult.ongoingBranchWorlds.length,
    fullTerminalWorldCount: cachedFullResult.terminalBranchWorlds.length,
  },
);

decision.resetMetrics();
const semanticTerminalFirst = decision.r8TerminalUtility(
  {
    ...cachedSummaryRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  cachedSummaryRoute,
);
const semanticTerminalClonedRequest = structuredClone(cachedSummaryRequest);
const semanticTerminalClonedRoute = structuredClone(cachedSummaryRoute);
const semanticTerminalSecond = decision.r8TerminalUtility(
  {
    ...semanticTerminalClonedRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  semanticTerminalClonedRoute,
);
const semanticTerminalReuseMetrics = decision.readMetrics();
add(
  'oracle:terminal-summary-semantic-cache-reuses-cloned-equivalent-state',
  terminalProjectionMatches(
    semanticTerminalFirst,
    semanticTerminalSecond,
  ) &&
    Number(
      semanticTerminalReuseMetrics?.terminalSemanticCacheHits || 0
    ) >= 1,
  {
    first: terminalProjectionSnapshot(semanticTerminalFirst),
    second: terminalProjectionSnapshot(semanticTerminalSecond),
    metrics: semanticTerminalReuseMetrics,
  },
);

decision.resetMetrics();
const sourceNeutralTerminalRequest = request({
  enemyHp: 10,
  objective: objective('UNIT_DEAD'),
});
const sourceNeutralRouteA = route({
  routeKey: 'route:source-neutral-a',
  health: [{
    ...hp('enemy', -10, 'source-effect-a'),
    rootActionId: 'source-action-a',
  }],
});
const sourceNeutralRouteB = route({
  routeKey: 'route:source-neutral-b',
  health: [{
    ...hp('enemy', -10, 'source-effect-b'),
    rootActionId: 'source-action-b',
  }],
});
const sourceNeutralTerminalA = decision.r8TerminalUtility(
  {
    ...sourceNeutralTerminalRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  sourceNeutralRouteA,
);
const sourceNeutralTerminalB = decision.r8TerminalUtility(
  {
    ...structuredClone(sourceNeutralTerminalRequest),
    terminalProjectionMode: 'SUMMARY',
  },
  sourceNeutralRouteB,
);
const sourceNeutralMetrics = decision.readMetrics();
add(
  'oracle:mechanical-terminal-distribution-reuses-with-source-attribution-rebound',
  sourceNeutralTerminalA.mechanicalTerminalDistribution?.schemaVersion ===
      'MechanicalTerminalDistributionV1' &&
    sourceNeutralTerminalB.terminalAttributionProjection?.schemaVersion ===
      'TerminalAttributionProjectionV1' &&
    sourceNeutralTerminalA.mechanicalTerminalDistribution?.distributionHash ===
      sourceNeutralTerminalB.mechanicalTerminalDistribution?.distributionHash &&
    sourceNeutralTerminalA.terminalAtomicKey ===
      'source-action-a|source-effect-a|NOW' &&
    sourceNeutralTerminalB.terminalAtomicKey ===
      'source-action-b|source-effect-b|NOW' &&
    !sourceNeutralTerminalB.terminalAtomicKey.includes('source-action-a') &&
    Number(sourceNeutralMetrics?.terminalMechanicalDistributionCacheHits || 0) >= 1,
  {
    first: terminalProjectionSnapshot(sourceNeutralTerminalA),
    second: terminalProjectionSnapshot(sourceNeutralTerminalB),
    firstDistributionHash:
      sourceNeutralTerminalA.mechanicalTerminalDistribution?.distributionHash,
    secondDistributionHash:
      sourceNeutralTerminalB.mechanicalTerminalDistribution?.distributionHash,
    metrics: sourceNeutralMetrics,
  },
);

decision.resetMetrics();
const targetedWorldRequest = request({
  enemyHp: 35,
  objective: {
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'targeted-world-threshold',
        type: 'HP_RATIO_AT_OR_BELOW',
        side: 'ENEMY',
        targetIds: ['enemy'],
        threshold: 0.3,
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'targeted-world-actor-death',
        type: 'UNIT_DEAD',
        side: 'PLAYER',
        targetIds: ['actor'],
      }],
    },
  },
});
const targetedWorldRoute = route({
  routeKey: 'route:targeted-terminal-world',
  health: [hp('enemy', -6, 'targeted-terminal-world')],
});
const targetedWorldBaseline = decision.r8TerminalUtility(
  {
    ...targetedWorldRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  targetedWorldRoute,
);
const unrelatedWorldRequest = structuredClone(targetedWorldRequest);
const unrelatedAlly = preview.listUnits(unrelatedWorldRequest.visibleWorld)
  .find(entry => preview.unitId(entry.unit) === 'ally')?.unit;
unrelatedAlly.hp = 1;
unrelatedAlly.HP = 1;
unrelatedAlly.生命 = 1;
unrelatedAlly.属性.HP = 1;
unrelatedAlly.属性.生命 = 1;
const targetedHitsBeforeUnrelated = Number(
  decision.readMetrics()?.terminalMechanicalDistributionCacheHits || 0,
);
const targetedWorldUnrelated = decision.r8TerminalUtility(
  {
    ...unrelatedWorldRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  structuredClone(targetedWorldRoute),
);
const targetedMetricsAfterUnrelated = decision.readMetrics();
const relatedWorldRequest = structuredClone(targetedWorldRequest);
const relatedEnemy = preview.listUnits(relatedWorldRequest.visibleWorld)
  .find(entry => preview.unitId(entry.unit) === 'enemy')?.unit;
relatedEnemy.hp = 80;
relatedEnemy.HP = 80;
relatedEnemy.生命 = 80;
relatedEnemy.属性.HP = 80;
relatedEnemy.属性.生命 = 80;
const targetedHitsBeforeRelated = Number(
  targetedMetricsAfterUnrelated?.terminalMechanicalDistributionCacheHits || 0,
);
const targetedWorldRelated = decision.r8TerminalUtility(
  {
    ...relatedWorldRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  structuredClone(targetedWorldRoute),
);
const targetedMetricsAfterRelated = decision.readMetrics();
add(
  'oracle:terminal-world-dependency-signature-ignores-unrelated-and-invalidates-related-unit',
  terminalProjectionMatches(targetedWorldBaseline, targetedWorldUnrelated) &&
    Number(
      targetedMetricsAfterUnrelated?.terminalMechanicalDistributionCacheHits || 0,
    ) === targetedHitsBeforeUnrelated + 1 &&
    !terminalProjectionMatches(targetedWorldUnrelated, targetedWorldRelated) &&
    Number(
      targetedMetricsAfterRelated?.terminalMechanicalDistributionCacheHits || 0,
    ) === targetedHitsBeforeRelated,
  {
    baseline: terminalProjectionSnapshot(targetedWorldBaseline),
    unrelated: terminalProjectionSnapshot(targetedWorldUnrelated),
    related: terminalProjectionSnapshot(targetedWorldRelated),
    metricsAfterUnrelated: targetedMetricsAfterUnrelated,
    metricsAfterRelated: targetedMetricsAfterRelated,
  },
);

const semanticTerminalChangedRequest =
  structuredClone(cachedSummaryRequest);
const semanticTerminalChangedEnemy = preview.listUnits(
  semanticTerminalChangedRequest.visibleWorld,
).find(entry => preview.unitId(entry.unit) === 'enemy')?.unit;
semanticTerminalChangedEnemy.hp = 80;
semanticTerminalChangedEnemy.HP = 80;
semanticTerminalChangedEnemy.生命 = 80;
semanticTerminalChangedEnemy.属性.HP = 80;
semanticTerminalChangedEnemy.属性.生命 = 80;
const semanticTerminalHitsBeforeHpChange = Number(
  decision.readMetrics()?.terminalSemanticCacheHits || 0,
);
const semanticTerminalChanged = decision.r8TerminalUtility(
  {
    ...semanticTerminalChangedRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  structuredClone(cachedSummaryRoute),
);
const semanticTerminalMetricsAfterHpChange = decision.readMetrics();
add(
  'oracle:terminal-summary-semantic-cache-invalidates-on-hp-change',
  !terminalProjectionMatches(
    semanticTerminalSecond,
    semanticTerminalChanged,
  ) &&
    Number(
      semanticTerminalMetricsAfterHpChange?.terminalSemanticCacheHits || 0
    ) === semanticTerminalHitsBeforeHpChange,
  {
    baseline: terminalProjectionSnapshot(semanticTerminalSecond),
    changed: terminalProjectionSnapshot(semanticTerminalChanged),
    metrics: semanticTerminalMetricsAfterHpChange,
  },
);

const terminalUtilitySplitMechanical = route({
  routeKey: 'route:terminal-utility-split',
  health: [hp('enemy', -10, 'terminal-utility-split')],
});
const terminalUtilitySplitRequest = request({
  enemyHp: 100,
  objective: objective('TEAM_DEAD'),
});
const terminalUtilitySplitRoute = marginalPP => ({
  ...terminalUtilitySplitMechanical,
  routeKey: terminalUtilitySplitMechanical.routeKey,
  healthTrajectoryByTarget:
    terminalUtilitySplitMechanical.healthTrajectoryByTarget.map(
      trajectory => ({
        ...trajectory,
        objectiveMarginalHealthDeltaPP: -marginalPP,
        objectiveMarginalActorBenefitPP: marginalPP,
      }),
    ),
});
const terminalUtilitySplitLow = decision.r8TerminalUtility(
  {
    ...terminalUtilitySplitRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  terminalUtilitySplitMechanical,
  terminalUtilitySplitRoute(2),
);
const terminalUtilitySplitHigh = decision.r8TerminalUtility(
  {
    ...terminalUtilitySplitRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  terminalUtilitySplitMechanical,
  terminalUtilitySplitRoute(8),
);
add(
  'oracle:terminal-semantic-cache-distinguishes-utility-trajectory-with-same-route-key',
  Math.abs(
    Number(terminalUtilitySplitLow.expectedOngoingTrajectoryUtility || 0) -
      2
  ) < 1e-9 &&
    Math.abs(
      Number(terminalUtilitySplitHigh.expectedOngoingTrajectoryUtility || 0) -
        8
    ) < 1e-9,
  {
    low: terminalProjectionSnapshot(terminalUtilitySplitLow),
    high: terminalProjectionSnapshot(terminalUtilitySplitHigh),
  },
);

const objectiveConditionedControlRequest = request({
  opportunities: [{
    opportunityId: 'natural:enemy:objective-conditioned',
    ownerId: 'enemy',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    status: 'PENDING',
    createdAtSequence: 2,
  }],
});
objectiveConditionedControlRequest.actionRouteCatalog.enemy = {
  primaryRoute: {
    routeKey: 'enemy-raw-threat-without-objective-value',
    routeBenefitPP: 20,
    objectiveRouteUtilityHEPP: 0,
  },
  backupRoute: {
    routeKey: 'enemy-backup-without-objective-value',
    routeBenefitPP: 8,
    objectiveRouteUtilityHEPP: 0,
  },
};
const objectiveConditionedControl = project(
  objectiveConditionedControlRequest,
  route({
    effects: [effect('ACTION_CANCELLED', 'enemy', {
      applicationProbability: 1,
      duration: 1,
    })],
  }),
);
add(
  'oracle:action-pool-fallback-uses-objective-conditioned-route-value',
  objectiveConditionedControl.actionPoolHEPP === 0,
  { objectiveConditionedControl },
);

const probabilisticSingleThresholdRequest = request({
  enemyHp: 35,
  objective: objective('HP_RATIO_AT_OR_BELOW'),
});
const probabilisticSingleThresholdRoute = probabilisticThresholdRoute(
  probabilisticSingleThresholdRequest,
  'probabilistic-threshold:single',
  Array.from({ length: 7 }, () => 'enemy'),
);
add(
  'oracle:route-preserves-probabilistic-threshold-terminal-mass',
  probabilisticSingleThresholdRoute.routeObjectiveAnalysisMode === 'EXACT_TERMINAL' &&
    Math.abs(probabilisticSingleThresholdRoute.objectiveRouteUtilityHEPP - 99.21875) < 1e-9 &&
    Math.abs(probabilisticSingleThresholdRoute.routeDiscardedOverkillPP - 29.765625) < 1e-9,
  { probabilisticSingleThresholdRoute },
);

const probabilisticAnyRequest = multiThresholdRequest('ANY');
const probabilisticAnyRoute = probabilisticThresholdRoute(
  probabilisticAnyRequest,
  'probabilistic-threshold:any',
  [
    'enemy',
    'enemy-2',
    'irrelevant-enemy-0',
    'irrelevant-enemy-1',
    'irrelevant-enemy-2',
    'irrelevant-enemy-3',
    'irrelevant-enemy-4',
  ],
);
add(
  'oracle:route-preserves-any-union-terminal-mass',
  probabilisticAnyRoute.routeObjectiveAnalysisMode === 'EXACT_TERMINAL' &&
    Math.abs(probabilisticAnyRoute.objectiveRouteUtilityHEPP - 75) < 1e-9 &&
    Math.abs(probabilisticAnyRoute.routeDiscardedOverkillPP - 22.5) < 1e-9,
  { probabilisticAnyRoute },
);

const probabilisticAllRequest = multiThresholdRequest('ALL');
const probabilisticAllRoute = probabilisticThresholdRoute(
  probabilisticAllRequest,
  'probabilistic-threshold:all',
  [
    'enemy',
    'enemy-2',
    'irrelevant-enemy-0',
    'irrelevant-enemy-1',
    'irrelevant-enemy-2',
    'irrelevant-enemy-3',
    'irrelevant-enemy-4',
  ],
);
add(
  'oracle:route-preserves-all-joint-terminal-mass',
  probabilisticAllRoute.routeObjectiveAnalysisMode === 'EXACT_TERMINAL' &&
    Math.abs(probabilisticAllRoute.objectiveRouteUtilityHEPP - 25) < 1e-9 &&
    Math.abs(probabilisticAllRoute.routeDiscardedOverkillPP - 30) < 1e-9,
  { probabilisticAllRoute },
);

const summaryAnyFull = decision.r8TerminalUtility(
  {
    ...probabilisticAnyRequest,
    terminalProjectionMode: 'FULL',
  },
  probabilisticAnyRoute,
);
const summaryAny = decision.r8TerminalUtility(
  {
    ...probabilisticAnyRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  probabilisticAnyRoute,
);
const summaryAllFull = decision.r8TerminalUtility(
  {
    ...probabilisticAllRequest,
    terminalProjectionMode: 'FULL',
  },
  probabilisticAllRoute,
);
const summaryAll = decision.r8TerminalUtility(
  {
    ...probabilisticAllRequest,
    terminalProjectionMode: 'SUMMARY',
  },
  probabilisticAllRoute,
);
add(
  'oracle:terminal-summary-matches-full-for-any-and-all-objectives',
  terminalProjectionMatches(summaryAny, summaryAnyFull) &&
    terminalProjectionMatches(summaryAll, summaryAllFull),
  {
    anySummary: terminalProjectionSnapshot(summaryAny),
    anyFull: terminalProjectionSnapshot(summaryAnyFull),
    allSummary: terminalProjectionSnapshot(summaryAll),
    allFull: terminalProjectionSnapshot(summaryAllFull),
  },
);

const killRequest = request({
  enemyHp: 35,
  objective: objective('HP_RATIO_AT_OR_BELOW', [{ conditionId: 'kill', type: 'UNIT_DEAD', side: 'ENEMY', targetIds: ['enemy'] }]),
});
const killProjection = project(killRequest, route({ health: [hp('enemy', -35)] }));
add(
  'oracle:kill-objective-protects-below-threshold-value',
  killProjection.directTrajectoryHEPP === 35 && killProjection.discardedOverkillPP === 0 &&
    killProjection.terminal.utility === 100,
  { killProjection },
);

const terminalInformationProjection = project(
  request({
    enemyHp: 10,
    informationValue: 5,
    objective: objective('UNIT_DEAD'),
  }),
  route({ health: [hp('enemy', -10, 'terminal-information')] }),
);
add(
  'oracle:terminal-candidate-does-not-stack-information-value',
  terminalInformationProjection.terminal.terminal === true &&
    terminalInformationProjection.expectedCandidateUtility === 100 &&
    terminalInformationProjection.informationValueHEPP === 0 &&
    terminalInformationProjection.objectiveUtilityHEPP === 100,
  { terminalInformationProjection },
);

const noThreatRequest = request();
const defendCandidate = { candidateId: 'test', declaration: { actionKind: 'DEFEND' }, costs: {} };
const defendRoute = route();
const defendProjection = project(noThreatRequest, defendRoute);
add(
  'oracle:defense-without-formal-window-zero',
  decision.r8CandidateExclusion(noThreatRequest, defendCandidate, defendRoute, defendProjection) ===
    'ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED',
);
const incomingRequest = request({ actionOpportunity: { role: 'ACTIVE', imminentThreat: true, incomingAction: { actionId: 'incoming' } } });
add('oracle:defense-with-formal-window-preserved', decision.hasDefenseWindow(incomingRequest) === true);

const noOpFallbackRequest = request({
  objective: objective('ROUND_REACHED'),
  responseModel: {
    mainBranches: [],
    disasterTail: {
      projectionId: 'disaster:test:unknown',
      probability: 0.2,
      threatEnvelope: { lower: 70, upper: 70 },
      appliesToNoOp: true,
    },
    noResponseProbability: 0.8,
  },
});
noOpFallbackRequest.frozenCandidates = [
  {
    candidateId: 'test',
    declaration: { actionKind: 'BASIC_ATTACK', actorId: 'actor', targetIds: ['enemy'] },
    costs: {},
  },
  {
    candidateId: 'pass:opportunity',
    declaration: { actionKind: 'PASS_OPPORTUNITY', actorId: 'actor', targetIds: ['actor'] },
    costs: {},
  },
];
noOpFallbackRequest.actorCandidateRoutes = {
  test: route({ routeKey: 'route:negative-basic' }),
  'pass:opportunity': {
    ...route({ routeKey: 'route:pass-opportunity', targetIds: ['actor'] }),
    candidateId: 'pass:opportunity',
  },
};
noOpFallbackRequest.responseModelByCandidate = {
  test: noOpFallbackRequest.responseModelByCandidate.test,
  'pass:opportunity': noOpFallbackRequest.responseModelByCandidate.test,
};
noOpFallbackRequest.informationValueByCandidate = {
  test: 0,
  'pass:opportunity': 0,
};
const noOpFallbackResult = decision.runR8Provider(noOpFallbackRequest);
const rejectedNegativeAction = noOpFallbackResult.candidateAudit.find(entry =>
  entry.candidateId === 'test'
);
add(
  'oracle:negative-natural-action-yields-formal-pass',
  noOpFallbackResult.selected.candidateId === 'pass:opportunity' &&
    noOpFallbackResult.decisionProfile.selectionMode !== 'FORCED_DEFEND_FALLBACK' &&
    noOpFallbackResult.selected.declaration.actionKind === 'PASS_OPPORTUNITY' &&
    noOpFallbackResult.selected.forcedFallback !== true &&
    noOpFallbackResult.selected.rejectionCode === '' &&
    noOpFallbackResult.selected.classification === 'VIABLE' &&
    noOpFallbackResult.selected.objectiveUtilityHEPP === 0 &&
    noOpFallbackResult.selected.goalProjection.expectedCandidateUtility ===
      noOpFallbackResult.selected.goalProjection.expectedNoOpUtility &&
    rejectedNegativeAction?.rejectionCode === 'ZERO_MARGINAL_WITH_COST',
  {
    selected: noOpFallbackResult.selected,
    rejectedNegativeAction,
  },
);

const noWindowPassRuntimeWorld = {
  回合: 0,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [unit('pass-actor', 'player', 100)],
    team_enemy: [unit('pass-enemy', 'enemy', 100)],
  },
};
const noWindowPassRuntimeResult = runtime.runBattleCase({
  caseId: 'phase7-formal-pass-runtime',
  seed: 837009,
  combatData: noWindowPassRuntimeWorld,
  mode: 'team_preview',
  rounds: 1,
  battleIntent: {
    mode: '求生',
    objectives: noWindowPassRuntimeWorld.胜负条件,
  },
  selectedAction: {
    actorId: 'pass-actor',
    actionKind: 'PASS_OPPORTUNITY',
    targetIds: ['pass-actor'],
  },
  settings: {
    providerId: 'r8',
  },
});
const noWindowPassLedger = noWindowPassRuntimeResult?.ledger || [];
const formalPassEvent = noWindowPassLedger.find(event =>
  event?.eventKind === 'pass' &&
  event?.actorId === 'pass-actor' &&
  event?.actionType === 'PASS_OPPORTUNITY'
);
const formalPassAction = noWindowPassLedger.find(event =>
  event?.eventKind === 'action_start' &&
  event?.actorId === 'pass-actor' &&
  event?.actionType === 'PASS_OPPORTUNITY'
);
add(
  'oracle:formal-pass-consumes-action-without-defense-stance',
  !!formalPassEvent &&
    formalPassEvent?.primaryOutcome === 'opportunity_passed' &&
    formalPassEvent?.meta?.voluntaryOpportunityPass === true &&
    formalPassEvent?.meta?.preparedDefense === false &&
    formalPassAction?.actionId === formalPassEvent?.actionId &&
    !noWindowPassLedger.some(event =>
      event?.actorId === 'pass-actor' &&
      event?.eventKind === 'defend'
    ) &&
    !noWindowPassRuntimeResult?.audit?.fatals?.length,
  {
    pass: formalPassEvent,
    action: formalPassAction,
    fatals: noWindowPassRuntimeResult?.audit?.fatals || [],
  },
);

const reactionPassWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [unit('reaction-pass-actor', 'player', 100)],
    team_enemy: [unit('reaction-pass-source', 'enemy', 100)],
  },
};
const reactionPassActor = reactionPassWorld.参战者.team_player[0];
const reactionPassSource = reactionPassWorld.参战者.team_enemy[0];
const reactionPassSourceContext = runtime.beginStructuredDeclaration({
  combatData: reactionPassWorld,
  declaration: {
    actorId: 'reaction-pass-source',
    actionKind: 'BASIC_ATTACK',
    targetIds: ['reaction-pass-actor'],
  },
  actionRole: 'ACTIVE',
});
const reactionPassUnitsBefore = JSON.stringify(reactionPassWorld.参战者);
const reactionPassResult = runtime.settleStructuredReaction({
  combatData: reactionPassWorld,
  reactor: reactionPassActor,
  sourceActor: reactionPassSource,
  declaration: {
    actorId: 'reaction-pass-actor',
    actionKind: 'PASS_OPPORTUNITY',
    targetIds: ['reaction-pass-actor'],
  },
  parentActionEvent: reactionPassSourceContext.actionEvent,
  opportunityId: 'reaction:formal-pass',
  opportunitySequence: 2,
  grantId: 'reaction:formal-pass',
});
const reactionPassUnitsAfter = JSON.stringify(reactionPassWorld.参战者);
const reactionPassLedger = runtime.ensureLedger(reactionPassWorld);
const reactionPassAudit = runtime.auditFacts({
  eventLedger: reactionPassLedger,
  combatData: reactionPassWorld,
});
const reactionPassEvent = reactionPassResult?.event;
const reactionPassForbiddenKinds = new Set([
  'action_cost',
  'defend',
  'dodge',
  'hit_result',
  'state_apply',
  'resource_change',
  'shield_create',
  'counter_window',
]);
add(
  'oracle:reaction-pass-binds-incoming-source-without-mechanical-mutation',
  reactionPassEvent?.eventKind === 'pass' &&
    reactionPassEvent?.actorId === 'reaction-pass-actor' &&
    reactionPassEvent?.targetId === 'reaction-pass-source' &&
    reactionPassEvent?.sourceActionId ===
      reactionPassSourceContext.actionEvent.actionId &&
    reactionPassEvent?.actionId !==
      reactionPassSourceContext.actionEvent.actionId &&
    reactionPassEvent?.opportunityId === 'reaction:formal-pass' &&
    reactionPassEvent?.primaryOutcome === 'opportunity_passed' &&
    reactionPassEvent?.operation === 'OPPORTUNITY_PASS' &&
    reactionPassEvent?.meta?.voluntaryOpportunityPass === true &&
    reactionPassResult?.evaded === false &&
    reactionPassResult?.damageMultiplier === 1 &&
    reactionPassResult?.opensCounterCheck === false &&
    reactionPassUnitsBefore === reactionPassUnitsAfter &&
    !reactionPassLedger.some(event =>
      event !== reactionPassEvent &&
      event?.actorId === 'reaction-pass-actor' &&
      reactionPassForbiddenKinds.has(String(event?.eventKind || '').trim())
    ) &&
    !reactionPassAudit?.fatals?.length,
  {
    event: reactionPassEvent,
    ledger: reactionPassLedger,
    fatals: reactionPassAudit?.fatals || [],
  },
);

const malformedReactionPassAudit = runtime.auditFacts({
  eventLedger: [
    reactionPassSourceContext.actionEvent,
    {
      ...reactionPassEvent,
      eventId: 'malformed-reaction-pass-self-source',
      targetId: 'reaction-pass-actor',
      targetName: 'reaction-pass-actor',
      targetIds: ['reaction-pass-actor'],
    },
  ],
  combatData: reactionPassWorld,
});
add(
  'oracle:reaction-pass-self-source-remains-fatal',
  malformedReactionPassAudit?.fatals?.some(fatal =>
    fatal?.code === 'REACTION_SELF_SOURCE_INVALID'
  ),
  {
    fatals: malformedReactionPassAudit?.fatals || [],
  },
);

function chargeWorld(power) {
  const actor = unit('actor', 'player', 100);
  const enemy = unit('enemy', 'enemy', 100);
  enemy.蓄力技能 = {
    id: `charge:${power}`,
    cast_time: 40,
    skill: {
      id: `charge-skill:${power}`,
      name: `charge-skill:${power}`,
      魂技名: `charge-skill:${power}`,
      消耗: '无',
      _效果数组: [{
        effectId: `charge-damage:${power}`,
        原型: '伤害结算',
        目标: '单体',
        威力倍率: power,
        伤害类型: '近身攻击',
        命中概率: '100%',
      }],
    },
  };
  return {
    回合: 1,
    战斗意图: '求生',
    胜负条件: objective('ROUND_REACHED'),
    参战者: { team_player: [actor], team_enemy: [enemy] },
  };
}

function scheduledDefenseAudit(power, seed) {
  const world = chargeWorld(power);
  const opportunity = {
    opportunityId: `natural:actor:${power}`,
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
    battleHorizon: { currentRound: 1, finalRound: 3 },
  };
  const runtimeSnapshot = runtime.buildDecisionRuntimeSnapshot(world, 'actor', opportunity);
  const prepared = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId: 'actor',
    objectiveContract: world.胜负条件,
    actionOpportunity: opportunity,
    runtimeSnapshot,
    battleIntent: { mode: '求生', objectives: world.胜负条件 },
    seed,
  });
  const result = decision.runProvider({ providerId: 'r8', request: prepared });
  const candidates = result.decisionAudit.candidateAudit;
  return {
    runtimeSnapshot,
    defend: candidates.find(candidate => candidate.declaration?.actionKind === 'DEFEND'),
    evade: candidates.find(candidate => candidate.declaration?.actionKind === 'EVADE'),
    basic: candidates.find(candidate => candidate.declaration?.actionKind === 'BASIC_ATTACK'),
  };
}

const survivableCharge = scheduledDefenseAudit(20, 837010);
const lethalCharge = scheduledDefenseAudit(5000, 837011);
const survivableDefendDelta = survivableCharge.defend?.goalProjection?.actionPoolDeltas?.find(
  delta => delta.outcomeKind === 'INCOMING_HEALTH_DELTA',
);
const survivableEvadeDelta = survivableCharge.evade?.goalProjection?.actionPoolDeltas?.find(
  delta => delta.outcomeKind === 'INCOMING_HEALTH_DELTA',
);
const lethalDefendDelta = lethalCharge.defend?.goalProjection?.actionPoolDeltas?.find(
  delta => delta.outcomeKind === 'INCOMING_HEALTH_DELTA',
);
const lethalEvadeDelta = lethalCharge.evade?.goalProjection?.actionPoolDeltas?.find(
  delta => delta.outcomeKind === 'INCOMING_HEALTH_DELTA',
);
const incomingDistributionProbability = distribution =>
  (distribution || []).reduce(
    (sum, trajectory) =>
      sum + (trajectory?.outcomeDistribution || []).reduce(
        (trajectorySum, branch) =>
          trajectorySum + Number(branch?.probability || 0),
        0,
      ),
    0,
  );
add(
  'oracle:scheduled-visible-charge-produces-real-defense-delta',
  survivableCharge.runtimeSnapshot.scheduledEvents.some(event =>
    event.eventType === 'VISIBLE_CHARGE_RELEASE' &&
    event.ownerId === 'actor' &&
    event.sourceActorId === 'enemy' &&
    event.targetId === 'actor' &&
    event.targetIds?.length === 1 &&
    event.targetIds[0] === 'actor' &&
    event.incomingAction?.targetId === 'actor' &&
    event.incomingAction?.targetIds?.[0] === 'actor'
  ) &&
    Number(survivableDefendDelta?.healthTrajectoryDeltaPP || 0) > 0 &&
    Number(survivableEvadeDelta?.healthTrajectoryDeltaPP || 0) > 0 &&
    Math.abs(
      Number(survivableDefendDelta?.healthTrajectoryDeltaPP || 0) -
      (
        Number(survivableDefendDelta?.baselineDamagePP || 0) -
        Number(survivableDefendDelta?.candidateDamagePP || 0)
      )
    ) < 1e-9 &&
    Math.abs(
      Number(survivableEvadeDelta?.healthTrajectoryDeltaPP || 0) -
      (
        Number(survivableEvadeDelta?.baselineDamagePP || 0) -
        Number(survivableEvadeDelta?.candidateDamagePP || 0)
      )
    ) < 1e-9 &&
    survivableCharge.defend?.primaryRoute?.routeKey !== survivableCharge.evade?.primaryRoute?.routeKey,
  {
    scheduledEvents: survivableCharge.runtimeSnapshot.scheduledEvents,
    defend: survivableCharge.defend,
    evade: survivableCharge.evade,
  },
);
add(
  'oracle:lethal-charge-preserves-evade-survival-distribution',
  !lethalDefendDelta &&
    Number(lethalEvadeDelta?.healthTrajectoryDeltaPP || 0) > 0 &&
    Number(lethalEvadeDelta?.evidence?.dodgeProbability || 0) > 0 &&
    Number(lethalEvadeDelta?.evidence?.dodgeProbability || 0) < 1 &&
    Math.abs(
      incomingDistributionProbability(
        lethalEvadeDelta?.evidence?.baselineDistribution,
      ) - 1
    ) < 1e-9 &&
    Math.abs(
      incomingDistributionProbability(
        lethalEvadeDelta?.evidence?.candidateDistribution,
      ) - 1
    ) < 1e-9 &&
    lethalEvadeDelta?.evidence?.candidateDistribution?.some(trajectory =>
      trajectory?.outcomeDistribution?.some(branch =>
        Object.values(branch?.assignments || {}).includes('EVADED') &&
        Number(branch?.healthDeltaPP || 0) === 0
      )
    ) &&
    Number(lethalEvadeDelta?.evidence?.baselineExpectedUtility || 0) === -100 &&
    Number(lethalEvadeDelta?.evidence?.candidateExpectedUtility || 0) > -100,
  {
    scheduledEvents: lethalCharge.runtimeSnapshot.scheduledEvents,
    defend: lethalCharge.defend,
    evade: lethalCharge.evade,
  },
);

const alreadyLostRequest = request({
  allyHp: 0,
  objective: {
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'victory',
        type: 'TEAM_INCAPACITATED',
        side: 'ENEMY',
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        conditionId: 'fallen-ally-loss',
        type: 'UNIT_DEAD',
        side: 'PLAYER',
        targetIds: ['ally'],
      }],
    },
  },
});
const alreadyLostBaseline = decision.r8TerminalUtility(
  alreadyLostRequest,
  route({
    health: [{
      ...hp('actor', -100, 'already-lost:baseline'),
      distributionGroupKey: 'already-lost:baseline',
      outcomeDistribution: [{
        branchKey: 'hit',
        probability: 1,
        healthDeltaPP: -100,
        assignments: { 'already-lost:baseline': 'HIT' },
      }],
    }],
  }),
);
const alreadyLostEvade = decision.r8TerminalUtility(
  alreadyLostRequest,
  route({
    health: [{
      ...hp('actor', -50, 'already-lost:evade'),
      distributionGroupKey: 'already-lost:evade',
      outcomeDistribution: [
        {
          branchKey: 'evaded',
          probability: 0.5,
          healthDeltaPP: 0,
          assignments: { 'already-lost:evade': 'EVADED' },
        },
        {
          branchKey: 'hit',
          probability: 0.5,
          healthDeltaPP: -100,
          assignments: { 'already-lost:evade': 'HIT' },
        },
      ],
    }],
  }),
);
add(
  'oracle:evade-does-not-invent-value-when-all-branches-already-lose',
  Number(alreadyLostBaseline?.expectedTerminalUtility || 0) === -100 &&
    Number(alreadyLostEvade?.expectedTerminalUtility || 0) === -100 &&
    Number(alreadyLostBaseline?.expectedOngoingTrajectoryUtility || 0) === 0 &&
    Number(alreadyLostEvade?.expectedOngoingTrajectoryUtility || 0) === 0,
  {
    baseline: alreadyLostBaseline,
    evade: alreadyLostEvade,
  },
);

const zeroDodgeBaseline = decision.r8TerminalUtility(
  request({ actorHp: 10 }),
  route({
    health: [{
      ...hp('actor', -100, 'zero-dodge:baseline'),
      distributionGroupKey: 'zero-dodge:baseline',
      outcomeDistribution: [{
        branchKey: 'hit',
        probability: 1,
        healthDeltaPP: -100,
        assignments: { 'zero-dodge:baseline': 'HIT' },
      }],
    }],
  }),
);
const zeroDodgeCandidate = decision.r8TerminalUtility(
  request({ actorHp: 10 }),
  route({
    health: [{
      ...hp('actor', -100, 'zero-dodge:candidate'),
      distributionGroupKey: 'zero-dodge:candidate',
      outcomeDistribution: [{
        branchKey: 'hit',
        probability: 1,
        healthDeltaPP: -100,
        assignments: { 'zero-dodge:candidate': 'HIT' },
      }],
    }],
  }),
);
add(
  'oracle:zero-dodge-distribution-has-no-evade-value',
  Number(zeroDodgeCandidate?.expectedTerminalUtility || 0) ===
      Number(zeroDodgeBaseline?.expectedTerminalUtility || 0) &&
    Number(zeroDodgeCandidate?.expectedOngoingTrajectoryUtility || 0) ===
      Number(zeroDodgeBaseline?.expectedOngoingTrajectoryUtility || 0),
  {
    baseline: zeroDodgeBaseline,
    candidate: zeroDodgeCandidate,
  },
);

const allyTargetedChargeWorld = chargeWorld(20);
const ally = unit('ally', 'player', 100);
allyTargetedChargeWorld.参战者.team_player.push(ally);
allyTargetedChargeWorld.参战者.team_enemy[0].蓄力技能.targetId = 'ally';
const actorOpportunity = {
  opportunityId: 'natural:actor:ally-targeted-charge',
  ownerId: 'actor',
  role: 'ACTIVE',
  grantType: 'NATURAL_ACTION',
  sequence: 1,
  battleHorizon: { currentRound: 1, finalRound: 3 },
};
const allyTargetedRuntimeSnapshot = runtime.buildDecisionRuntimeSnapshot(
  allyTargetedChargeWorld,
  'actor',
  actorOpportunity,
);
const allyTargetedRequest = decision.prepareDecisionRequest({
  worldSnapshot: allyTargetedChargeWorld,
  actorId: 'actor',
  objectiveContract: allyTargetedChargeWorld.胜负条件,
  actionOpportunity: actorOpportunity,
  runtimeSnapshot: allyTargetedRuntimeSnapshot,
  battleIntent: {
    mode: '求生',
    objectives: allyTargetedChargeWorld.胜负条件,
  },
  seed: 837012,
});
const allyTargetedResult = decision.runProvider({
  providerId: 'r8',
  request: allyTargetedRequest,
});
const allyTargetedDefend = allyTargetedResult.decisionAudit.candidateAudit.find(
  candidate => candidate.declaration?.actionKind === 'DEFEND',
);
const allyTargetedEvade = allyTargetedResult.decisionAudit.candidateAudit.find(
  candidate => candidate.declaration?.actionKind === 'EVADE',
);
add(
  'oracle:visible-charge-targeting-ally-does-not-value-self-defense',
  !allyTargetedRuntimeSnapshot.scheduledEvents.some(event =>
    event.eventType === 'VISIBLE_CHARGE_RELEASE' &&
    event.ownerId === 'actor'
  ) &&
    (
      allyTargetedDefend?.rejectionCode === 'ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED' ||
      allyTargetedDefend?.fallbackSourceRejectionCode ===
        'ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED'
    ) &&
    allyTargetedEvade?.rejectionCode === 'ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED' &&
    !allyTargetedDefend?.goalProjection?.actionPoolDeltas?.some(delta =>
      delta.outcomeKind === 'INCOMING_HEALTH_DELTA'
    ) &&
    !allyTargetedEvade?.goalProjection?.actionPoolDeltas?.some(delta =>
      delta.outcomeKind === 'INCOMING_HEALTH_DELTA'
    ),
  {
    scheduledEvents: allyTargetedRuntimeSnapshot.scheduledEvents,
    defend: allyTargetedDefend,
    evade: allyTargetedEvade,
  },
);

const preparedDefenseRuntimeWorld = chargeWorld(20);
preparedDefenseRuntimeWorld.回合 = 0;
preparedDefenseRuntimeWorld.参战者.team_enemy[0].蓄力技能.cast_time = 40;
preparedDefenseRuntimeWorld.参战者.team_enemy[0].蓄力技能.skill.前摇 = 40;
const preparedDefenseRuntimeResult = runtime.runBattleCase({
  caseId: 'phase7-prepared-defense-runtime',
  seed: 837013,
  combatData: preparedDefenseRuntimeWorld,
  mode: 'team_preview',
  rounds: 3,
  battleIntent: {
    mode: '求生',
    objectives: preparedDefenseRuntimeWorld.胜负条件,
  },
  selectedAction: {
    actorId: 'actor',
    actionKind: 'DEFEND',
    targetIds: ['actor'],
  },
  settings: {
    providerId: 'r8',
  },
});
const preparedDefenseRuntimeLedger = preparedDefenseRuntimeResult?.ledger || [];
const preparedDefenseEstablished = preparedDefenseRuntimeLedger.find(event =>
  event?.eventKind === 'defend' &&
  event?.actionRole === 'ACTIVE' &&
  event?.actorId === 'actor' &&
  event?.meta?.preparedDefense === true
);
const preparedDefenseConsumed = preparedDefenseRuntimeLedger.find(event =>
  event?.eventKind === 'defend' &&
  event?.actionRole === 'REACTION' &&
  event?.actorId === 'actor' &&
  event?.meta?.preparedDefenseConsumed === true
);
const preparedDefenseDamage = preparedDefenseRuntimeLedger.find(event =>
  event?.eventKind === 'hit_result' &&
  event?.targetId === 'actor' &&
  String(event?.reactionNodeId || '').trim() !== ''
);
const preparedDefenseDecision = (preparedDefenseRuntimeResult?.decisions || []).find(decisionAudit =>
  decisionAudit?.actorId === 'actor' &&
  String(decisionAudit?.actorControl || '').trim() === 'PLAYER_LOCKED'
);
add(
  'oracle:prepared-defense-is-consumed-by-formal-runtime-damage',
  !!preparedDefenseEstablished &&
    preparedDefenseEstablished?.actorControl === 'PLAYER_LOCKED' &&
    !!preparedDefenseConsumed &&
    Number(preparedDefenseConsumed?.meta?.damageMultiplier || 1) < 1 &&
    !!preparedDefenseDamage &&
    preparedDefenseDamage?.reactionNodeId === preparedDefenseConsumed?.chainNodeId &&
    Number(preparedDefenseDamage?.meta?.defenseMultiplier || 1) ===
      Number(preparedDefenseConsumed?.meta?.damageMultiplier || 0) &&
    !preparedDefenseRuntimeResult?.audit?.fatals?.length,
  {
    established: preparedDefenseEstablished,
    consumed: preparedDefenseConsumed,
    damage: preparedDefenseDamage,
    terminal: preparedDefenseRuntimeResult?.terminal,
    fatals: preparedDefenseRuntimeResult?.audit?.fatals || [],
  },
);
add(
  'oracle:player-locked-legal-declaration-executes-exactly',
  preparedDefenseDecision?.selected?.playerLocked === true &&
    preparedDefenseDecision?.selected?.selectionMode === 'PLAYER_LOCKED' &&
    preparedDefenseDecision?.selected?.declaration?.actionKind === 'DEFEND' &&
    preview.stableHash(preparedDefenseDecision?.selected?.declaration?.targetIds || []) ===
      preview.stableHash(['actor']) &&
    preparedDefenseEstablished?.actorControl === 'PLAYER_LOCKED',
  {
    decision: preparedDefenseDecision,
    established: preparedDefenseEstablished,
  },
);

const responseConsumptionWorld = {
  回合: 1,
  胜负条件: objective('TEAM_INCAPACITATED'),
  参战者: {
    team_player: [
      unit('response-consumption-actor', 'player', 100),
      unit('response-consumption-ally-a', 'player', 100),
      unit('response-consumption-ally-b', 'player', 100),
    ],
    team_enemy: [unit('response-consumption-enemy', 'enemy', 150)],
  },
};
responseConsumptionWorld.参战者.team_player[0].agi = 120;
responseConsumptionWorld.参战者.team_player[0].属性.敏捷 = 120;
responseConsumptionWorld.参战者.team_player[1].agi = 110;
responseConsumptionWorld.参战者.team_player[1].属性.敏捷 = 110;
responseConsumptionWorld.参战者.team_player[2].agi = 100;
responseConsumptionWorld.参战者.team_player[2].属性.敏捷 = 100;
responseConsumptionWorld.参战者.team_enemy[0].agi = 90;
responseConsumptionWorld.参战者.team_enemy[0].属性.敏捷 = 90;
responseConsumptionWorld.参战者.team_enemy[0].hp_max = 150;
responseConsumptionWorld.参战者.team_enemy[0].属性.HP上限 = 150;
const responseConsumptionShield = {
  id: 'response-consumption-shield',
  name: '一次性护盾',
  消耗: '无',
  前摇: 0,
  _效果数组: [{
    effectId: 'response-consumption-shield-effect',
    原型: '护盾变化',
    目标: '自身',
    护盾模式: '正向护盾',
    数值: '+30%',
    持续回合: 1,
  }],
};
const responseConsumptionOpportunities = [
  'response-consumption-actor',
  'response-consumption-ally-a',
  'response-consumption-ally-b',
  'response-consumption-enemy',
].map((ownerId, index) => ({
  opportunityId: `natural:${ownerId}:1`,
  ownerId,
  role: 'ACTIVE',
  grantType: 'NATURAL_ACTION',
  sequence: index + 1,
  status: 'PENDING',
  round: 1,
}));
const responseConsumptionOpportunity =
  responseConsumptionOpportunities[0];
const responseConsumptionRuntimeSnapshot = {
  ...runtime.buildDecisionRuntimeSnapshot(
    responseConsumptionWorld,
    'response-consumption-actor',
    responseConsumptionOpportunity,
  ),
  opportunitySnapshot: responseConsumptionOpportunities,
};
const responseConsumptionBelief = {
  confidence: 1,
  publicResponses: {
    'response-consumption-enemy': [{
      responseId: 'response-consumption-shield-once',
      responseRole: 'REACTION',
      responseRoles: ['REACTION'],
      actionName: '一次性护盾',
      baseActionValue: 1,
      declaration: {
        actorId: 'response-consumption-enemy',
        actionKind: 'RELEASE_SKILL',
        targetIds: ['response-consumption-enemy'],
        skill: responseConsumptionShield,
      },
    }],
  },
};
const responseConsumptionRequest = decision.prepareDecisionRequest({
  worldSnapshot: responseConsumptionWorld,
  actorId: 'response-consumption-actor',
  actionOpportunity: responseConsumptionOpportunity,
  runtimeSnapshot: responseConsumptionRuntimeSnapshot,
  beliefState: responseConsumptionBelief,
  battleIntent: {
    mode: '击败',
    objectives: responseConsumptionWorld.胜负条件,
  },
  seed: 837015,
});
const responseConsumptionResult = decision.runProvider({
  providerId: 'r8',
  request: responseConsumptionRequest,
});
const responseConsumptionAttack =
  responseConsumptionResult.decisionAudit.candidateAudit.find(candidate =>
    candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
    candidate?.declaration?.targetIds?.includes(
      'response-consumption-enemy',
    )
  );
const responseConsumptionBranch =
  responseConsumptionAttack?.goalProjection?.responseModel?.mainBranches?.[0];
const responseConsumptionProjection =
  responseConsumptionRequest.preActionResponseProjectionByCandidate?.[
    responseConsumptionAttack?.candidateId
  ]?.[responseConsumptionBranch?.projectionId];
const responseConsumptionDelta =
  responseConsumptionAttack?.goalProjection?.actionPoolDeltas?.find(delta =>
    delta?.outcomeKind === 'RESPONSE_CONSUMPTION_ACTION_POOL'
  );
const responseConsumptionFact =
  responseConsumptionAttack?.causalValueFacts?.find(fact =>
    fact?.outcomeKind === 'RESPONSE_CONSUMPTION_ACTION_POOL'
  );
const responseConsumptionCounterDelta =
  responseConsumptionAttack?.goalProjection?.actionPoolDeltas?.find(delta =>
    delta?.outcomeKind === 'COUNTER_AUTHORIZATION'
  );
const responseConsumptionNoResponseRequest = decision.prepareDecisionRequest({
  worldSnapshot: structuredClone(responseConsumptionWorld),
  actorId: 'response-consumption-actor',
  actionOpportunity: responseConsumptionOpportunity,
  runtimeSnapshot: {
    ...responseConsumptionRuntimeSnapshot,
    opportunitySnapshot: responseConsumptionOpportunities,
  },
  beliefState: { confidence: 1 },
  battleIntent: {
    mode: '击败',
    objectives: responseConsumptionWorld.胜负条件,
  },
  seed: 837015,
});
const responseConsumptionNoResponseResult = decision.runProvider({
  providerId: 'r8',
  request: responseConsumptionNoResponseRequest,
});
const responseConsumptionNoResponseAttack =
  responseConsumptionNoResponseResult.decisionAudit.candidateAudit.find(
    candidate =>
      candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
      candidate?.declaration?.targetIds?.includes(
        'response-consumption-enemy',
      )
  );
add(
  'oracle:one-use-defense-consumption-rebuilds-formal-teammate-envelopes',
  responseConsumptionAttack?.rejectionCode === '' &&
    Number(responseConsumptionAttack?.objectiveUtilityHEPP || 0) > 0 &&
    Number(responseConsumptionAttack?.objectiveUtilityHEPP || 0) <
      Number(responseConsumptionNoResponseAttack?.objectiveUtilityHEPP || 0) &&
    responseConsumptionBranch?.triggerTiming === 'PRE_ACTION' &&
    responseConsumptionProjection?.responseConsumed === true &&
    Number(responseConsumptionProjection?.directTrajectoryHEPP || 0) === 0 &&
    Number(responseConsumptionProjection?.continuationDeltaHEPP || 0) > 0 &&
    responseConsumptionDelta?.ownerType === 'ACTION_POOL_DELTA' &&
    Number(responseConsumptionDelta?.healthTrajectoryDeltaPP || 0) > 0 &&
    preview.stableHash(
      responseConsumptionDelta?.evidence?.opportunityIds || [],
    ) === preview.stableHash([
      'natural:response-consumption-ally-a:1',
      'natural:response-consumption-ally-b:1',
    ]) &&
    preview.stableHash(
      responseConsumptionDelta?.evidence?.affectedUnitIds || [],
    ) === preview.stableHash([
      'response-consumption-ally-a',
      'response-consumption-ally-b',
    ]) &&
    !(responseConsumptionDelta?.evidence?.baselineRouteKeys || []).length &&
    (responseConsumptionDelta?.evidence?.candidateRouteKeys || []).length === 2 &&
    !responseConsumptionCounterDelta &&
    responseConsumptionFact?.ownerType === 'ACTION_POOL_DELTA' &&
    responseConsumptionFact?.valueKey === [
      responseConsumptionAttack?.candidateId,
      responseConsumptionDelta?.effectInstanceId,
      'response-consumption-enemy',
      'RESPONSE_CONSUMPTION_ACTION_POOL',
      responseConsumptionDelta?.windowId,
    ].join('|'),
  {
    selectedCandidateId: responseConsumptionResult.selectedCandidateId,
    attack: responseConsumptionAttack,
    noResponseAttack: responseConsumptionNoResponseAttack,
    projection: responseConsumptionProjection,
    delta: responseConsumptionDelta,
    fact: responseConsumptionFact,
    counterDelta: responseConsumptionCounterDelta || null,
  },
);

let illegalPlayerLockedError = '';
try {
  runtime.runBattleCase({
    caseId: 'phase7-player-locked-illegal',
    seed: 837014,
    combatData: chargeWorld(20),
    mode: 'team_preview',
    rounds: 1,
    selectedAction: {
      actorId: 'actor',
      actionKind: 'DEFEND',
      targetIds: ['charger'],
    },
    settings: {
      providerId: 'r8',
    },
  });
} catch (error) {
  illegalPlayerLockedError = String(error?.message || error);
}
add(
  'oracle:player-locked-illegal-declaration-is-rejected-without-ai-fallback',
  illegalPlayerLockedError.endsWith(
    'battle_player_locked_declaration_mechanically_illegal'
  ),
  { illegalPlayerLockedError },
);

const controlEffect = effect('ACTION_CANCELLED', 'enemy', { applicationProbability: 1 });
const controlWithout = project(request(), route({ effects: [controlEffect] }));
const controlWith = project(request({
  opportunities: [{ opportunityId: 'natural:enemy:1', ownerId: 'enemy', grantType: 'NATURAL_ACTION', status: 'OPEN' }],
}), route({ effects: [controlEffect] }));
add(
  'oracle:control-binds-concrete-opportunity',
  controlWithout.actionPoolHEPP === 0 && controlWith.actionPoolHEPP === 20,
  { controlWithout: controlWithout.actionPoolDeltas, controlWith: controlWith.actionPoolDeltas },
);
const controlAfterTargetOpportunity = project(request({
  actionOpportunity: {
    opportunityId: 'natural:actor:after-enemy',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    round: 1,
    sequence: 3,
  },
  opportunities: [{
    opportunityId: 'natural:enemy:before-controller',
    ownerId: 'enemy',
    grantType: 'NATURAL_ACTION',
    round: 1,
    sequence: 2,
    status: 'OPEN',
  }],
}), route({ effects: [controlEffect] }));
const controlBeforeNextRoundOpportunity = project(request({
  actionOpportunity: {
    opportunityId: 'natural:actor:round1',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    round: 1,
    sequence: 3,
  },
  opportunities: [{
    opportunityId: 'natural:enemy:round2',
    ownerId: 'enemy',
    grantType: 'NATURAL_ACTION',
    round: 2,
    sequence: 1,
    status: 'OPEN',
  }],
}), route({ effects: [controlEffect] }));
add(
  'oracle:control-cannot-cancel-opportunity-before-its-own-execution-row',
  controlAfterTargetOpportunity.actionPoolHEPP === 0 &&
    controlBeforeNextRoundOpportunity.actionPoolHEPP === 20,
  {
    controlAfterTargetOpportunity:
      controlAfterTargetOpportunity.actionPoolDeltas,
    controlBeforeNextRoundOpportunity:
      controlBeforeNextRoundOpportunity.actionPoolDeltas,
  },
);
const futureControllerOpportunity = decision.r8ExecutionOpportunityForUnit({
  worldSnapshot: request().visibleWorld,
  actorId: 'actor',
  actionOpportunity: {
    opportunityId: 'natural:actor:current',
    ownerId: 'actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:enemy:first',
      ownerId: 'enemy',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:ally:future',
      ownerId: 'ally',
      round: 1,
      sequence: 3,
      status: 'PENDING',
    },
  ],
}, 'ally');
add(
  'oracle:future-route-uses-owner-formal-opportunity-as-execution-context',
  futureControllerOpportunity?.opportunityId === 'natural:ally:future' &&
    futureControllerOpportunity?.ownerId === 'ally' &&
    Number(futureControllerOpportunity?.sequence || 0) === 3,
  { futureControllerOpportunity },
);

let duplicateFatal = '';
try {
  decision.validateR8CausalOwnership([
    { valueKey: 'duplicate', ownerType: 'STATE_DELTA', targetId: 'enemy', windowId: 'NOW', outcomeKind: 'HP_DELTA', healthRangePP: { lower: 20, upper: 30 } },
    { valueKey: 'duplicate', ownerType: 'ACTION_POOL_DELTA', targetId: 'enemy', windowId: 'NOW', outcomeKind: 'HP_DELTA', healthRangePP: { lower: 20, upper: 30 } },
  ]);
} catch (error) {
  duplicateFatal = String(error?.message || error);
}
add('oracle:duplicate-causal-owner-fatal', duplicateFatal.startsWith('DUPLICATE_CAUSAL_VALUE:'), { duplicateFatal });

let actionPoolRangeFatal = '';
try {
  decision.validateR8CausalOwnership([
    { valueKey: 'response-branch:a', ownerType: 'ACTION_POOL_DELTA', targetId: 'enemy', windowId: 'NEXT', outcomeKind: 'RESPONSE_CONSUMPTION_ACTION_POOL', healthRangePP: { lower: 0, upper: 12 } },
    { valueKey: 'response-branch:b', ownerType: 'ACTION_POOL_DELTA', targetId: 'enemy', windowId: 'NEXT', outcomeKind: 'RESPONSE_CONSUMPTION_ACTION_POOL', healthRangePP: { lower: 0, upper: 9 } },
  ]);
} catch (error) {
  actionPoolRangeFatal = String(error?.message || error);
}
add(
  'oracle:mutually-exclusive-action-pool-scalars-do-not-conflict-as-physical-ranges',
  !actionPoolRangeFatal,
  { actionPoolRangeFatal },
);

let stateRangeFatal = '';
try {
  decision.validateR8CausalOwnership([
    { valueKey: 'state-range:a', ownerType: 'STATE_DELTA', targetId: 'enemy', windowId: 'NOW', outcomeKind: 'HP_DELTA', healthRangePP: { lower: 20, upper: 35 } },
    { valueKey: 'state-range:b', ownerType: 'STATE_DELTA', targetId: 'enemy', windowId: 'NOW', outcomeKind: 'HP_DELTA', healthRangePP: { lower: 25, upper: 40 } },
  ]);
} catch (error) {
  stateRangeFatal = String(error?.message || error);
}
add(
  'oracle:overlapping-state-delta-physical-ranges-remain-fatal',
  stateRangeFatal.startsWith('CAUSAL_RANGE_OWNER_CONFLICT:'),
  { stateRangeFatal },
);

const responseModel = {
  mainBranches: [{
    projectionId: 'response:test',
    probability: 1,
    threatEnvelope: { lower: 20, upper: 20 },
    appliesToNoOp: false,
  }],
  disasterTail: null,
  noResponseProbability: 0,
};
const noOpComparable = project(request({ responseModel }), route({ health: [hp('enemy', -10)] }));
add(
  'oracle:candidate-triggered-response-does-not-attack-no-op',
  Math.abs(noOpComparable.objectiveUtilityHEPP + 10) < 1e-9 &&
    noOpComparable.expectedCandidateUtility === -10 &&
    noOpComparable.expectedNoOpUtility === 0,
  { noOpComparable },
);

const filteredResponseRequest = request();
filteredResponseRequest.visibleWorld.参战者.team_enemy.push(unit('enemy-2', 'enemy'));
filteredResponseRequest.frozenCandidates = [{
  candidateId: 'test',
  declaration: { actorId: 'actor', targetIds: ['enemy'] },
}];
filteredResponseRequest.beliefState = {
  confidence: 0.6,
  publicResponses: {
    actor: [{
      responseId: 'own-reaction',
      responseRole: 'REACTION',
      baseActionValue: 100,
    }],
    enemy: [
      {
        responseId: 'target-reaction',
        responseRole: 'REACTION',
        baseActionValue: 20,
      },
      {
        responseId: 'target-future-active-without-window',
        responseRole: 'ACTIVE',
        baseActionValue: 30,
      },
    ],
    'enemy-2': [{
      responseId: 'unrelated-reaction',
      responseRole: 'REACTION',
      baseActionValue: 100,
    }],
  },
};
const filteredResponseModel = decision.buildR8ResponseModel(
  filteredResponseRequest,
  'test',
);
add(
  'oracle:response-model-filters-side-role-target-and-formal-window',
  filteredResponseModel.mainBranches.length === 1 &&
    filteredResponseModel.mainBranches[0].sourceActorId === 'enemy' &&
    filteredResponseModel.mainBranches[0].projectionId.endsWith(':target-reaction') &&
    filteredResponseModel.mainBranches[0].appliesToNoOp === false,
  { filteredResponseModel },
);

const timelineResponseRequest = {
  ...filteredResponseRequest,
  evaluationContext: {
    ...filteredResponseRequest.evaluationContext,
    opportunitySnapshot: [{
      opportunityId: 'natural:enemy-2:future',
      ownerId: 'enemy-2',
      grantType: 'NATURAL_ACTION',
      status: 'PENDING',
    }],
  },
  beliefState: {
    confidence: 0.6,
    publicResponses: {
      enemy: [{
        responseId: 'target-reaction',
        responseRole: 'REACTION',
        baseActionValue: 20,
      }],
      'enemy-2': [{
        responseId: 'future-active',
        responseRole: 'ACTIVE',
        baseActionValue: 30,
      }],
    },
  },
};
const timelineResponseModel = decision.buildR8ResponseModel(
  timelineResponseRequest,
  'test',
);
const timelineResponseById = Object.fromEntries(
  timelineResponseModel.mainBranches.map(branch => [
    branch.projectionId.split(':').at(-1),
    branch,
  ]),
);
add(
  'oracle:response-model-keeps-formal-future-action-on-both-counterfactuals',
  timelineResponseModel.mainBranches.length === 2 &&
    timelineResponseById['target-reaction']?.appliesToNoOp === false &&
    timelineResponseById['future-active']?.appliesToNoOp === true,
  { timelineResponseModel },
);

const catastrophicResponseRequest = structuredClone(timelineResponseRequest);
catastrophicResponseRequest.beliefState.confidence = 1;
catastrophicResponseRequest.beliefState.publicResponses['enemy-2'].push({
  responseId: 'future-active-catastrophic',
  responseRole: 'ACTIVE',
  baseActionValue: 90,
  lethal: true,
});
const catastrophicResponseModel = decision.buildR8ResponseModel(
  catastrophicResponseRequest,
  'test',
);
const catastrophicFutureMass =
  catastrophicResponseModel.futureActiveBranches.reduce(
    (sum, branch) => sum + Number(branch?.probability || 0),
    0,
  ) +
  Number(catastrophicResponseModel.disasterTail?.probability || 0) +
  Number(
    catastrophicResponseModel.laneNoResponseProbabilities?.futureActive || 0,
  );
add(
  'oracle:future-active-lane-probability-mass-is-normalized',
  Math.abs(catastrophicFutureMass - 1) <= 1e-12,
  {
    catastrophicFutureMass,
    catastrophicResponseModel,
  },
);

const storedCatastrophicObservation = decision.updatePublicObservation(
  { confidence: 0.5, publicResponses: {}, units: {} },
  {
    sourceActorId: 'enemy-2',
    responseId: 'future-active-catastrophic',
    responseRole: 'ACTIVE',
    actionName: 'catastrophic-action',
    declaration: {
      actorId: 'enemy-2',
      actionKind: 'RELEASE_SKILL',
      targetIds: ['actor'],
      resourceCosts: { 魂力: 50 },
      __runtimeSecret: 'hidden',
      skill: {
        id: 'catastrophic-action',
        name: 'catastrophic-action',
        消耗: { 魂力: 50 },
        __privateSkillState: 'hidden',
        _效果数组: [],
      },
    },
    lethal: true,
    incapacitating: true,
    cancelsOpportunity: true,
    breaksObjective: true,
  },
)?.publicResponses?.['enemy-2']?.[0];
add(
  'oracle:public-response-observation-preserves-catastrophe-semantics',
  storedCatastrophicObservation?.lethal === true &&
    storedCatastrophicObservation?.incapacitating === true &&
    storedCatastrophicObservation?.cancelsOpportunity === true &&
    storedCatastrophicObservation?.breaksObjective === true &&
    storedCatastrophicObservation?.declaration?.resourceCosts === undefined &&
    storedCatastrophicObservation?.declaration?.__runtimeSecret === undefined &&
    storedCatastrophicObservation?.declaration?.skill?.消耗 === undefined &&
    storedCatastrophicObservation?.declaration?.skill?.__privateSkillState ===
      undefined &&
    Array.isArray(
      storedCatastrophicObservation?.declaration?.skill?._效果数组,
    ),
  { storedCatastrophicObservation },
);

const publicItemBelief = decision.updatePublicObservation(
  { confidence: 1, publicResponses: {}, units: {} },
  {
    sourceActorId: 'enemy',
    responseId: 'future-active-public-item',
    responseRole: 'ACTIVE',
    actionName: '公开恢复物品',
    baseActionValue: 40,
    declaration: {
      actorId: 'enemy',
      actionKind: 'USE_ITEM',
      targetIds: ['enemy'],
      resourceCosts: { 魂力: 20 },
      irreversibleAsset: {
        assetId: '公开恢复物品',
        quantityBefore: 1,
        remainingQuantity: 0,
        cost: 12,
      },
      skill: {
        id: '公开恢复物品',
        name: '公开恢复物品',
        物品名: '公开恢复物品',
        消耗: { 魂力: 20 },
        _效果数组: [{ 原型: '治疗', 数值: 30 }],
      },
    },
  },
);
const storedPublicItemObservation =
  publicItemBelief?.publicResponses?.enemy?.[0];
const publicItemResponseRequest = request({
  confidence: 1,
  opportunities: [{
    opportunityId: 'natural:enemy:future-item',
    ownerId: 'enemy',
    grantType: 'NATURAL_ACTION',
    status: 'PENDING',
  }],
});
publicItemResponseRequest.frozenCandidates = [{
  candidateId: 'test',
  declaration: {
    actorId: 'actor',
    actionKind: 'BASIC_ATTACK',
    targetIds: ['enemy'],
    resourceCosts: {},
  },
}];
publicItemResponseRequest.beliefState = publicItemBelief;
const publicItemResponseModel = decision.buildR8ResponseModel(
  publicItemResponseRequest,
  'test',
);
const projectedPublicItemResponse =
  publicItemResponseModel.futureActiveBranches.find(branch =>
    String(branch?.responseId || '').trim() === 'future-active-public-item'
  )?.declaration;
add(
  'oracle:public-item-response-hides-inventory-and-replays-observable-mechanics',
  storedPublicItemObservation?.declaration?.actionKind === 'USE_ITEM' &&
    storedPublicItemObservation?.declaration?.irreversibleAsset === undefined &&
    storedPublicItemObservation?.declaration?.resourceCosts === undefined &&
    storedPublicItemObservation?.declaration?.skill?.消耗 === undefined &&
    storedPublicItemObservation?.declaration?.__skipInventoryConsume ===
      undefined &&
    Array.isArray(
      storedPublicItemObservation?.declaration?.skill?._效果数组,
    ) &&
    projectedPublicItemResponse?.actionKind === 'USE_ITEM' &&
    projectedPublicItemResponse?.irreversibleAsset === undefined &&
    projectedPublicItemResponse?.__skipInventoryConsume === true,
  {
    storedPublicItemObservation,
    projectedPublicItemResponse,
  },
);

const incapableResponseRequest = request();
incapableResponseRequest.visibleWorld.参战者.team_enemy.push(
  unit('incapable-response-enemy', 'enemy', 0),
);
incapableResponseRequest.frozenCandidates = [{
  candidateId: 'test',
  declaration: {
    actorId: 'actor',
    actionKind: 'BASIC_ATTACK',
    targetIds: ['enemy'],
    resourceCosts: {},
  },
}];
incapableResponseRequest.evaluationContext = {
  opportunitySnapshot: [{
    opportunityId: 'natural:incapable-response-enemy:future',
    ownerId: 'incapable-response-enemy',
    grantType: 'NATURAL_ACTION',
    status: 'PENDING',
  }],
  scheduledEvents: [],
};
incapableResponseRequest.beliefState = {
  confidence: 1,
  publicResponses: {
    'incapable-response-enemy': [{
      responseId: 'incapable-future-active',
      responseRole: 'ACTIVE',
      baseActionValue: 30,
      declaration: {
        actorId: 'incapable-response-enemy',
        actionKind: 'BASIC_ATTACK',
        targetIds: ['actor'],
        resourceCosts: {},
      },
    }],
  },
};
const incapableResponseModel = decision.buildR8ResponseModel(
  incapableResponseRequest,
  'test',
);
add(
  'oracle:response-model-incapable-unit-occupies-zero-lane-mass',
  incapableResponseModel.reactionBranches.length === 0 &&
    incapableResponseModel.counterBranches.length === 0 &&
    incapableResponseModel.futureActiveBranches.length === 0 &&
    incapableResponseModel.noResponseProbability === 1,
  { incapableResponseModel },
);

const sharedFutureResponse = {
  projectionId: 'response:test:FUTURE_ACTIVE:enemy:shared-basic',
  responseLane: 'FUTURE_ACTIVE',
  sourceActorId: 'enemy',
  responseId: 'shared-basic',
  probability: 0.6,
  threatEnvelope: { lower: 10, upper: 10 },
  declaration: {
    actorId: 'enemy',
    actionKind: 'BASIC_ATTACK',
    targetIds: ['actor'],
    resourceCosts: {},
  },
  appliesToNoOp: true,
  triggerTiming: 'POST_ACTION',
};
const sharedFutureRequest = request({
  responseModel: {
    reactionBranches: [],
    counterBranches: [],
    futureActiveBranches: [sharedFutureResponse],
    laneNoResponseProbabilities: {
      reaction: 1,
      counter: 1,
      futureActive: 0.4,
    },
    mainBranches: [sharedFutureResponse],
    disasterTail: null,
    noResponseProbability: 0.4,
  },
});
const sharedFutureProjection = project(
  sharedFutureRequest,
  route({ health: [hp('enemy', -10)] }),
);
add(
  'oracle:shared-future-active-cancels-between-candidate-and-no-op',
  Math.abs(
    sharedFutureProjection.objectiveUtilityHEPP -
      sharedFutureProjection.directTrajectoryHEPP
  ) <= 1e-9 &&
    Math.abs(
      (
        sharedFutureProjection.expectedCandidateUtility -
        sharedFutureProjection.expectedNoOpUtility
      ) -
      sharedFutureProjection.directTrajectoryHEPP
    ) <= 1e-9,
  { sharedFutureProjection },
);

function directionalCheck(contract) {
  const id = contract.caseId;
  const category = contract.behaviorContract.category;
  const variant = id.endsWith('_positive') ? 'positive' : id.endsWith('_negative') ? 'negative' : 'mutation';
  const concreteEnemy = [{ opportunityId: 'enemy-next', ownerId: 'enemy', grantType: 'NATURAL_ACTION', status: 'OPEN' }];
  if (category === 'c01_hit_bonus') {
    const factor = variant === 'negative' ? 0 : variant === 'mutation' ? 0.5 : 0.25;
    const qualityEffect = effect(
      'NEXT_ACTION_QUALITY_CHANGED',
      'actor',
      { qualityFactor: factor },
    );
    const value = project(
      qualityEnvelopeRequest('actor', qualityEffect, factor * 20),
      route({ effects: [qualityEffect] }),
    ).actionPoolHEPP;
    return variant === 'negative' ? value === 0 : value > 0 && value <= 10;
  }
  if (category === 'c02_evasion_reduction') {
    const routeValue = variant === 'negative' || variant === 'mutation' ? 0 : 20;
    const qualityEffect = effect(
      'NEXT_ACTION_QUALITY_CHANGED',
      'enemy',
      { qualityFactor: -0.25 },
    );
    const value = project(
      qualityEnvelopeRequest('enemy', qualityEffect, routeValue * 0.25),
      route({ effects: [qualityEffect] }),
    ).actionPoolHEPP;
    return variant === 'positive' ? value > 0 : value === 0;
  }
  if (category === 'c03_defense') {
    if (variant === 'negative') return !decision.hasDefenseWindow(request());
    const low = project(request({ actorHp: 80, actionOpportunity: { imminentThreat: true } }), route({ health: [hp('actor', 5)] })).directTrajectoryHEPP;
    const high = project(request({ actorHp: 80, actionOpportunity: { imminentThreat: true } }), route({ health: [hp('actor', 10)] })).directTrajectoryHEPP;
    return variant === 'positive' ? high > low : high === 2 * low;
  }
  if (category === 'c04_evade_counter') {
    const factor = variant === 'negative' ? 0 : variant === 'mutation' ? 0.2 : 0.5;
    const value = project(request({
      actorRouteValue: variant === 'negative' ? 0 : 20,
      scheduledEvents: [{ effectInstanceId: 'effect:ACTION_GRANTED:actor' }],
    }), route({
      effects: [effect('ACTION_GRANTED', 'actor', { r8HealthTrajectoryDeltaPP: 20 * factor })],
    })).actionPoolHEPP;
    return variant === 'negative' ? value === 0 : value > 0 && (variant !== 'mutation' || value < 20);
  }
  if (['c05_hard_control', 'c06_control_overlap', 'c07_slow_axis'].includes(category)) {
    const opportunities = variant === 'positive' ? concreteEnemy : [];
    const value = project(request({ opportunities }), route({ effects: [controlEffect] })).actionPoolHEPP;
    return variant === 'positive' ? value > 0 : value === 0;
  }
  if (['c08_resource_block', 'c09_resource_no_consumer', 'c10_resource_consumers', 'c11_resource_recovery'].includes(category)) {
    const noConsumer = category === 'c09_resource_no_consumer';
    const routeDelta = noConsumer
      ? 0
      : variant === 'positive'
        ? 18
        : variant === 'negative'
          ? 0
          : 6;
    const resourceDelta = category === 'c11_resource_recovery' ? 20 : -20;
    const resourceEffect = {
      ...effect(
        'RESOURCE_OPTION_CHANGED',
        category === 'c11_resource_recovery' ? 'actor' : 'enemy',
        { routeDeltaPP: routeDelta, delta: resourceDelta },
      ),
      expectedDelta: resourceDelta,
    };
    const value = project(request(), route({
      effects: [resourceEffect],
    })).actionPoolHEPP;
    if (noConsumer) return value === 0;
    return variant === 'positive'
      ? value === 18
      : variant === 'negative'
        ? value === 0
        : value === 6;
  }
  if (category === 'c12_defensive_windows') {
    const value = variant === 'positive'
      ? project(request({ actorHp: 80 }), route({ health: [hp('actor', 8, 'absorbed')] })).directTrajectoryHEPP
      : project(request(), route()).directTrajectoryHEPP;
    return variant === 'positive' ? value === 8 : value === 0;
  }
  if (category === 'c13_dot') {
    const damage = variant === 'positive' ? -12 : variant === 'negative' ? 0 : -4;
    const value = project(request(), route({ health: damage ? [hp('enemy', damage, 'dot', 'SCHEDULED_HP_DELTA', 'tick:1')] : [] })).directTrajectoryHEPP;
    return variant === 'positive' ? value === 12 : variant === 'negative' ? value === 0 : value === 4;
  }
  if (category === 'c14_summon') {
    const scheduledEvents = variant === 'positive'
      ? [{ effectInstanceId: 'effect:SUMMON_WINDOW:actor' }]
      : [];
    const value = project(request({ scheduledEvents, actorRouteValue: variant === 'mutation' ? 8 : 20 }), route({
      effects: [effect('SUMMON_WINDOW', 'actor', {})],
    })).actionPoolHEPP;
    return variant === 'positive' ? value > 0 : value === 0;
  }
  if (category === 'c15_information') {
    const confidence = variant === 'positive' ? 0.2 : 1;
    const fake = {
      actorId: 'actor',
      beliefState: { confidence },
      actionOpportunity: variant === 'negative' ? { noFutureOpportunity: true } : {},
      frozenCandidates: [{ candidateId: 'observe', declaration: { actionKind: 'OBSERVE', skill: { _效果数组: [] } } }],
      actionRouteCatalog: { actor: { primaryRoute: { routeKey: 'p', routeBenefitPP: 10 }, backupRoute: { routeKey: 'b', routeBenefitPP: 4 } } },
      observationOutcomes: variant === 'positive'
        ? [{
            observationGroupId: 'public-result',
            probability: 1,
            valueBeforeHEPP: 10,
            bestValueAfterHEPP: 13,
            nextPrimaryRouteKey: 'p2',
            nextBackupRouteKey: 'p',
          }]
        : [],
    };
    const value = decision.r8InformationValue(fake, 'observe');
    return variant === 'positive' ? value > 0 : value === 0;
  }
  if (category === 'c16_objectives') {
    if (variant === 'negative') {
      return project(request({ objective: objective('ROUND_REACHED') }), route({ health: [hp('enemy', -20)] })).directTrajectoryHEPP === 0;
    }
    const req = variant === 'mutation'
      ? request({ enemyHp: 35, objective: objective('UNIT_DEAD') })
      : thresholdRequest;
    const value = project(req, route({ health: [hp('enemy', -35)] }));
    return variant === 'mutation'
      ? value.directTrajectoryHEPP === 35
      : value.directTrajectoryHEPP === 5 && value.discardedOverkillPP === 30;
  }
  if (category === 'x01_resource_recovery_timing') {
    return project(request(), route({ effects: [effect('RESOURCE_OPTION_CHANGED', 'enemy', { routeDeltaPP: 0 })] })).actionPoolHEPP === 0;
  }
  if (category === 'x02_slow_axis_duration') {
    return project(request(), route({ effects: [controlEffect] })).actionPoolHEPP === 0;
  }
  if (category === 'x03_defense_multihit_reflect') {
    return project(request({ actorHp: 80, actionOpportunity: { imminentThreat: true } }), route({ health: [hp('actor', 6), hp('enemy', -2, 'reflect')] })).directTrajectoryHEPP === 8;
  }
  if (category === 'x04_control_ally_dot') {
    return project(request({ opportunities: concreteEnemy }), route({
      health: [hp('enemy', -4, 'dot', 'SCHEDULED_HP_DELTA')],
      effects: [controlEffect],
    })).objectiveUtilityHEPP > 4;
  }
  if (category === 'x05_summon_host_deadline') {
    return project(request(), route({ effects: [effect('SUMMON_WINDOW', 'actor', {})] })).actionPoolHEPP === 0;
  }
  if (category === 'x06_antiheal_food_crisis') {
    return project(request(), route({ effects: [effect('RESOURCE_OPTION_CHANGED', 'enemy', { routeDeltaPP: 0 })] })).actionPoolHEPP === 0;
  }
  return false;
}

const summonCandidate = {
  candidateId: 'test',
  declaration: { actionKind: 'RELEASE_SKILL' },
  costs: { 魂力: 10 },
};
const unrealizableSummonRoute = route({
  effects: [effect('SUMMON_WINDOW', 'actor', {})],
});
const unrealizableSummonProjection = project(request(), unrealizableSummonRoute);
add(
  'oracle:pure-summon-without-realization-window-is-rejected',
  decision.r8CandidateExclusion(
    request(),
    summonCandidate,
    unrealizableSummonRoute,
    unrealizableSummonProjection,
  ) === 'SUMMON_WINDOW_NOT_REALIZABLE',
);

const compoundSummonRoute = route({
  health: [hp('enemy', -12, 'compound-damage')],
  effects: [effect('SUMMON_WINDOW', 'actor', {})],
});
const compoundSummonProjection = project(request(), compoundSummonRoute);
add(
  'oracle:compound-summon-keeps-independent-direct-value',
  decision.r8CandidateExclusion(
    request(),
    summonCandidate,
    compoundSummonRoute,
    compoundSummonProjection,
  ) !== 'SUMMON_WINDOW_NOT_REALIZABLE' &&
    compoundSummonProjection.directTrajectoryHEPP === 12,
);

const immediateSummonRoute = route({
  health: [hp('enemy', -8, 'test:summon-assist:1')],
  effects: [effect('SUMMON_WINDOW', 'summon', {
    immediateWindowConsumed: true,
    remainingWindows: 0,
  })],
});
const immediateSummonProjection = project(request(), immediateSummonRoute);
add(
  'oracle:immediate-summon-window-is-realized-before-remaining-window-reaches-zero',
  immediateSummonProjection.actionPoolDeltas.some(delta =>
    delta.outcomeKind === 'SUMMON_WINDOW' &&
    delta.realizable === true
  ) &&
    decision.r8CandidateExclusion(
      request(),
      summonCandidate,
      immediateSummonRoute,
      immediateSummonProjection,
    ) !== 'SUMMON_WINDOW_NOT_REALIZABLE',
  {
    actionPoolDeltas: immediateSummonProjection.actionPoolDeltas,
  },
);
add(
  'oracle:summon-envelope-rebuild-requires-future-window',
  decision.r8SummonHasFutureEnvelopeWindow(
    immediateSummonRoute.actionPoolEffects[0],
    [],
  ) === false &&
    decision.r8SummonHasFutureEnvelopeWindow(
      effect('SUMMON_WINDOW', 'summon', {
        immediateWindowConsumed: false,
        remainingWindows: 1,
      }),
      [],
    ) === true &&
    decision.r8SummonHasFutureEnvelopeWindow(
      immediateSummonRoute.actionPoolEffects[0],
      [{
        sourceEventId: immediateSummonRoute.actionPoolEffects[0].effectInstanceId,
      }],
    ) === true,
);
const scheduledStateDependency = decision.r8StateDependencyClass(
  effect('STATE_CHANGED', 'enemy', {
    combatEffect: { dot_damage_ratio: 0.05 },
  }),
);
const incomingStateDependency = decision.r8StateDependencyClass(
  effect('STATE_CHANGED', 'enemy', {
    combatEffect: { dodge_penalty: 0.2, reaction_penalty: 0.1 },
  }),
);
const antiHealStateDependency = decision.r8StateDependencyClass(
  effect('STATE_CHANGED', 'enemy', {
    combatEffect: { heal_reduction: 0.5 },
  }),
);
const unknownStateDependency = decision.r8StateDependencyClass(
  effect('STATE_CHANGED', 'enemy', {
    combatEffect: { future_unmapped_mechanic: 1 },
  }),
);
add(
  'oracle:state-dependency-classification-does-not-broadcast-unknown-or-dot',
  scheduledStateDependency.scheduledOnly === true &&
    scheduledStateDependency.selfRoute === false &&
    scheduledStateDependency.incomingRoute === false &&
    incomingStateDependency.selfRoute === false &&
    incomingStateDependency.incomingRoute === true &&
    antiHealStateDependency.selfRoute === true &&
    antiHealStateDependency.incomingRoute === true &&
    unknownStateDependency.selfRoute === false &&
    unknownStateDependency.incomingRoute === false &&
    unknownStateDependency.unknownKeys.includes('future_unmapped_mechanic'),
  {
    scheduledStateDependency,
    incomingStateDependency,
    antiHealStateDependency,
    unknownStateDependency,
  },
);

const survivalObjectiveRequest = request({
  enemyHp: 10,
  objective: {
    schemaVersion: '8.3-objective-1',
    startRound: 1,
    maxRounds: 5,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ALL',
      conditions: [{
        type: 'ROUND_REACHED',
        side: 'PLAYER',
        round: 5,
        requireActive: true,
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        type: 'TEAM_INCAPACITATED',
        side: 'PLAYER',
        scope: 'ALL',
      }],
    },
  },
});
const survivalLethalRoute = route({
  health: [hp('enemy', -10, 'survival-lethal')],
});
const survivalLethalProjection = project(survivalObjectiveRequest, survivalLethalRoute);
add(
  'oracle:explicit-survival-objective-does-not-inject-enemy-exhaustion-victory',
  survivalLethalProjection.terminal.terminalProbability === 0 &&
    survivalLethalProjection.terminal.winProbability === 0 &&
    survivalLethalProjection.directTrajectoryHEPP === 0,
  {
    terminal: survivalLethalProjection.terminal,
    directTrajectoryHEPP: survivalLethalProjection.directTrajectoryHEPP,
  },
);

const summonObjectiveRequest = request({
  objective: objective('ROUND_REACHED'),
});
summonObjectiveRequest.actorId = 'enemy';
summonObjectiveRequest.actorSide = 'team_enemy';
const objectiveSummon = unit('objective-summon', 'player', 100);
objectiveSummon.单位性质 = '召唤物';
objectiveSummon.阵营 = 'player';
summonObjectiveRequest.visibleWorld.召唤单位表 = {
  'objective-summon': objectiveSummon,
};
const summonObjectiveProjection = project(
  summonObjectiveRequest,
  route({
    targetIds: ['objective-summon'],
    health: [hp('objective-summon', -80, 'summon-damage')],
  }),
);
const normalizedSummonObjective = preview.normalizeBattleObjectives(
  summonObjectiveRequest.objectiveContract,
  summonObjectiveRequest.visibleWorld,
);
add(
  'oracle:summon-does-not-enter-frozen-team-objective-targets',
  summonObjectiveProjection.directTrajectoryHEPP === 0 &&
    normalizedSummonObjective.victory.conditions[0].targetIds.includes('actor') &&
    normalizedSummonObjective.victory.conditions[0].targetIds.includes('ally') &&
    !normalizedSummonObjective.victory.conditions[0].targetIds.includes('objective-summon') &&
    normalizedSummonObjective.defeat.conditions[0].targetIds.includes('actor') &&
    normalizedSummonObjective.defeat.conditions[0].targetIds.includes('ally') &&
    !normalizedSummonObjective.defeat.conditions[0].targetIds.includes('objective-summon'),
  {
    summonObjectiveProjection,
    normalizedSummonObjective,
  },
);

const healthRouteFactKey = 'test|effect|enemy|HP_DELTA|NOW';
const sustainThreatRequest = request({
  objective: objective('ROUND_REACHED'),
  opportunities: [{
    opportunityId: 'natural:enemy:2',
    ownerId: 'enemy',
    grantType: 'NATURAL_ACTION',
    status: 'OPEN',
  }],
  candidateEnvelopeDeltas: {
    test: [{
      targetId: 'enemy',
      beforeRouteKey: 'enemy:threat:20',
      afterRouteKey: 'enemy:threat:5',
      beforePP: 20,
      afterPP: 5,
      healthTrajectoryDeltaPP: 15,
      sourceEffectKeys: [],
      sourceHealthFactKeys: [healthRouteFactKey],
    }],
  },
});
const sustainThreatRoute = route({ health: [hp('enemy', -20)] });
const sustainThreatProjection = project(sustainThreatRequest, sustainThreatRoute);
const sustainThreatFacts = decision.buildR8CausalValueFacts(
  sustainThreatRequest,
  summonCandidate,
  sustainThreatRoute,
  sustainThreatProjection,
);
add(
  'oracle:round-reached-damage-values-only-real-future-threat-reduction',
  sustainThreatProjection.directTrajectoryHEPP === 0 &&
    sustainThreatProjection.actionPoolHEPP === 15 &&
    sustainThreatProjection.actionPoolDeltas.some(delta =>
      delta.outcomeKind === 'HEALTH_ROUTE_CHANGED' &&
      delta.evidence?.sourceFactIds?.includes(healthRouteFactKey)
    ) &&
    sustainThreatFacts.some(fact =>
      fact.ownerType === 'ACTION_POOL_DELTA' &&
      fact.sourceFactIds?.includes(healthRouteFactKey)
    ),
);

const noFutureThreatProjection = project(
  request({
    objective: objective('ROUND_REACHED'),
    candidateEnvelopeDeltas: sustainThreatRequest.candidateEnvelopeDeltas,
  }),
  sustainThreatRoute,
);
add(
  'oracle:round-reached-damage-without-future-threat-window-stays-zero',
  noFutureThreatProjection.directTrajectoryHEPP === 0 &&
    noFutureThreatProjection.actionPoolHEPP === 0,
);

const futureWindowThreatWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('survival-actor', 'player', 100),
      unit('survival-ally', 'player', 100),
    ],
    team_enemy: [
      unit('survival-enemy', 'enemy', 30),
      unit('survival-healer', 'enemy', 100),
    ],
  },
};
const futureWindowThreatProjectedWorld = structuredClone(futureWindowThreatWorld);
const futureWindowProjectedEnemy = preview.listUnits(futureWindowThreatProjectedWorld)
  .find(entry => preview.unitId(entry.unit) === 'survival-enemy')
  ?.unit;
futureWindowProjectedEnemy.hp = 20;
futureWindowProjectedEnemy.HP = 20;
futureWindowProjectedEnemy.属性.HP = 20;
const futureWindowThreatRouteCatalog = {
  'survival-ally': {
    primaryRoute: route({
      routeKey: 'route:survival-ally-follow-up',
      candidateId: 'survival-ally:attack',
      health: [hp('survival-enemy', -25, 'ally-follow-up')],
    }),
  },
  'survival-enemy': {
    primaryRoute: route({
      routeKey: 'route:survival-enemy-threat',
      candidateId: 'survival-enemy:attack',
      health: [hp('survival-actor', -20, 'enemy-threat')],
    }),
  },
  'survival-healer': {
    primaryRoute: route({
      routeKey: 'route:survival-healer-recovery',
      candidateId: 'survival-healer:heal',
      health: [hp('survival-enemy', 10, 'enemy-recovery')],
    }),
  },
};
const futureThreatInput = {
  worldSnapshot: futureWindowThreatWorld,
  projectedWorld: futureWindowThreatProjectedWorld,
  actorSide: 'team_player',
  targetId: 'survival-enemy',
  routeCatalog: futureWindowThreatRouteCatalog,
  actionOpportunity: {
    opportunityId: 'natural:survival-actor:1',
    sequence: 1,
  },
  objectiveContract: futureWindowThreatWorld.胜负条件,
};
const futureThreatCrossing = decision.r8FutureThreatWindowDelta({
  ...futureThreatInput,
  opportunitySnapshot: [
    {
      opportunityId: 'natural:survival-ally:1',
      ownerId: 'survival-ally',
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:survival-enemy:1',
      ownerId: 'survival-enemy',
      sequence: 3,
      status: 'PENDING',
    },
  ],
});
const futureThreatNoFollowUp = decision.r8FutureThreatWindowDelta({
  ...futureThreatInput,
  opportunitySnapshot: [{
    opportunityId: 'natural:survival-enemy:1',
    ownerId: 'survival-enemy',
    sequence: 2,
    status: 'PENDING',
  }],
});
const futureThreatRecovered = decision.r8FutureThreatWindowDelta({
  ...futureThreatInput,
  opportunitySnapshot: [
    {
      opportunityId: 'natural:survival-healer:1',
      ownerId: 'survival-healer',
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:survival-ally:1',
      ownerId: 'survival-ally',
      sequence: 3,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:survival-enemy:1',
      ownerId: 'survival-enemy',
      sequence: 4,
      status: 'PENDING',
    },
  ],
});
add(
  'oracle:round-reached-nonlethal-pressure-values-only-removed-future-threat-window',
  Math.abs(futureThreatCrossing - 20) < 1e-9 &&
    futureThreatNoFollowUp === 0 &&
    futureThreatRecovered === 0,
  {
    futureThreatCrossing,
    futureThreatNoFollowUp,
    futureThreatRecovered,
  },
);

const slowAxisWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('axis-actor', 'player', 100),
      unit('axis-ally', 'player', 100),
    ],
    team_enemy: [unit('axis-enemy', 'enemy', 100)],
  },
};
slowAxisWorld.参战者.team_player[1].agi = 90;
slowAxisWorld.参战者.team_player[1].属性.敏捷 = 90;
slowAxisWorld.参战者.team_enemy[0].agi = 100;
slowAxisWorld.参战者.team_enemy[0].属性.敏捷 = 100;
const slowAxisProjectedWorld = structuredClone(slowAxisWorld);
slowAxisProjectedWorld.参战者.team_enemy[0].状态效果 = {
  迟缓: {
    状态: '迟缓',
    状态名称: '迟缓',
    duration: 1,
    战斗效果: { cast_speed_penalty: 0.2 },
  },
};
const slowAxisAllyRoute = route({
  routeKey: 'route:axis-ally-kill',
  candidateId: 'axis-ally:kill',
  targetIds: ['axis-enemy'],
  health: [hp('axis-enemy', -100, 'axis-ally-kill')],
});
const slowAxisEnemyRoute = route({
  routeKey: 'route:axis-enemy-threat',
  candidateId: 'axis-enemy:attack',
  targetIds: ['axis-actor'],
  health: [hp('axis-actor', -20, 'axis-enemy-threat')],
});
const slowAxisSchedule = [
  {
    descriptorId: 'future-natural:2:axis-ally',
    ownerId: 'axis-ally',
    expectedGrantType: 'NATURAL_ACTION',
    eventType: 'FUTURE_NATURAL_ACTION',
    round: 2,
    creationSequence: 1,
    expirySequence: 1,
    status: 'PENDING',
  },
  {
    descriptorId: 'future-natural:2:axis-enemy',
    ownerId: 'axis-enemy',
    expectedGrantType: 'NATURAL_ACTION',
    eventType: 'FUTURE_NATURAL_ACTION',
    round: 2,
    creationSequence: 2,
    expirySequence: 2,
    status: 'PENDING',
  },
];
const slowAxisPlanInput = {
  actorSide: 'team_player',
  actionOpportunity: {
    opportunityId: 'natural:axis-actor:1',
    ownerId: 'axis-actor',
    round: 1,
    sequence: 0,
  },
  opportunitySnapshot: [],
  scheduledEvents: slowAxisSchedule,
  objectiveContract: slowAxisWorld.胜负条件,
  routeCatalog: {
    'axis-ally': { primaryRoute: slowAxisAllyRoute },
    'axis-enemy': { primaryRoute: slowAxisEnemyRoute },
  },
  fullRoutesByUnit: {
    'axis-ally': [slowAxisAllyRoute],
    'axis-enemy': [slowAxisEnemyRoute],
  },
};
const slowAxisBaselinePlan = decision.r8BuildTargetPressurePlan({
  ...slowAxisPlanInput,
  worldSnapshot: slowAxisWorld,
  orderWorldSnapshot: slowAxisWorld,
});
const slowAxisCandidatePlan = decision.r8BuildTargetPressurePlan({
  ...slowAxisPlanInput,
  worldSnapshot: slowAxisWorld,
  orderWorldSnapshot: slowAxisProjectedWorld,
});
add(
  'oracle:slow-axis-crossing-reorders-future-opportunities-and-removes-threat',
  slowAxisBaselinePlan.rows[0]?.ownerId === 'axis-enemy' &&
    slowAxisCandidatePlan.rows[0]?.ownerId === 'axis-ally' &&
    Number(slowAxisBaselinePlan.threatPP || 0) > Number(slowAxisCandidatePlan.threatPP || 0),
  {
    baselineRows: slowAxisBaselinePlan.rows,
    candidateRows: slowAxisCandidatePlan.rows,
    baselineThreatPP: slowAxisBaselinePlan.threatPP,
    candidateThreatPP: slowAxisCandidatePlan.threatPP,
  },
);
const slowAxisNonCrossingWorld = structuredClone(slowAxisWorld);
slowAxisNonCrossingWorld.参战者.team_enemy[0].状态效果 = {
  迟缓: {
    状态: '迟缓',
    状态名称: '迟缓',
    duration: 1,
    战斗效果: { cast_speed_penalty: 0.05 },
  },
};
const slowAxisNonCrossingPlan = decision.r8BuildTargetPressurePlan({
  ...slowAxisPlanInput,
  worldSnapshot: slowAxisWorld,
  orderWorldSnapshot: slowAxisNonCrossingWorld,
});
add(
  'oracle:slow-axis-without-crossing-does-not-create-threat-delta',
  slowAxisNonCrossingPlan.rows[0]?.ownerId === 'axis-enemy' &&
    Math.abs(
      Number(slowAxisBaselinePlan.threatPP || 0) -
      Number(slowAxisNonCrossingPlan.threatPP || 0),
    ) < 1e-9,
  {
    nonCrossingRows: slowAxisNonCrossingPlan.rows,
    nonCrossingThreatPP: slowAxisNonCrossingPlan.threatPP,
  },
);
const slowAxisLifecycleSchedule = [
  ...slowAxisSchedule,
  ...slowAxisSchedule.map(entry => ({
    ...entry,
    descriptorId: String(entry.descriptorId).replace(':2:', ':3:'),
    round: 3,
    creationSequence: Number(entry.creationSequence || 0) + 2,
    expirySequence: Number(entry.expirySequence || 0) + 2,
  })),
];
const slowAxisLifecyclePlan = decision.r8BuildTargetPressurePlan({
  ...slowAxisPlanInput,
  worldSnapshot: slowAxisWorld,
  orderWorldSnapshot: slowAxisProjectedWorld,
  orderWorldExpiresAfterRound: 2,
  scheduledEvents: slowAxisLifecycleSchedule,
  routeCatalog: {
    'axis-ally': { primaryRoute: route({
      routeKey: 'route:axis-ally-wait',
      candidateId: 'axis-ally:wait',
    }) },
    'axis-enemy': { primaryRoute: route({
      routeKey: 'route:axis-enemy-wait',
      candidateId: 'axis-enemy:wait',
    }) },
  },
  fullRoutesByUnit: {},
});
add(
  'oracle:slow-axis-order-change-expires-with-state-lifecycle',
  slowAxisLifecyclePlan.rows.filter(row => row.opportunityRound === 2)[0]?.ownerId ===
      'axis-ally' &&
    slowAxisLifecyclePlan.rows.filter(row => row.opportunityRound === 3)[0]?.ownerId ===
      'axis-enemy',
  { rows: slowAxisLifecyclePlan.rows },
);

const pressureOnlyCandidateRoute = route({
  candidateId: 'pressure-only-candidate',
  health: [{
    ...hp('survival-enemy', -10, 'pressure-only-hit'),
    rootActionId: 'pressure-only-candidate',
  }],
});
const pressureOnlyWorld = structuredClone(futureWindowThreatWorld);
pressureOnlyWorld.参战者.team_player = pressureOnlyWorld.参战者.team_player
  .filter(entry => preview.unitId(entry) === 'survival-actor');
const pressureOnlyProjectedWorld = structuredClone(futureWindowThreatProjectedWorld);
pressureOnlyProjectedWorld.参战者.team_player = pressureOnlyProjectedWorld.参战者.team_player
  .filter(entry => preview.unitId(entry) === 'survival-actor');
const pressureOnlyRouteCatalog = {
  'survival-actor': {
    primaryRoute: route({
      routeKey: 'route:survival-actor-follow-up',
      candidateId: 'survival-actor:attack',
      health: [hp('survival-enemy', -25, 'actor-follow-up')],
    }),
  },
  'survival-enemy': futureWindowThreatRouteCatalog['survival-enemy'],
  'survival-healer': futureWindowThreatRouteCatalog['survival-healer'],
};
const pressureOnlyMetrics = {
  rebuildCount: 0,
  previewCalls: 0,
  searchedRouteCount: 0,
  reusedRouteCount: 0,
  healthOnlyRebuildCount: 0,
  effectOnlyRebuildCount: 0,
  mixedSourceRebuildCount: 0,
  zeroDeltaRebuildCount: 0,
  nonZeroDeltaRebuildCount: 0,
  rebuildSourceOutcomeCounts: {},
  zeroDeltaSourceOutcomeCounts: {},
  targetPressureAudits: [],
  collectTargetPressureAudit: true,
  skippedZeroWindowSummonRebuildCount: 0,
  skippedHealthEnvelopeRebuildCount: 0,
  pressureOnlyHealthEvaluationCount: 0,
  zeroPressureOnlyHealthEvaluationCount: 0,
  nonZeroPressureOnlyHealthEvaluationCount: 0,
  stateDependencyClassCounts: {},
  unknownStateDependencyKeys: {},
};
const pressureOnlyEnvelope = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: pressureOnlyWorld,
  actorSide: 'team_player',
  routeCatalog: pressureOnlyRouteCatalog,
  fullRoutesByUnit: Object.fromEntries(
    Object.entries(pressureOnlyRouteCatalog).map(([unitId, envelope]) => [
      unitId,
      [envelope.primaryRoute].filter(Boolean),
    ]),
  ),
  projectedWorlds: {
    'pressure-only-candidate': pressureOnlyProjectedWorld,
  },
  projectedWorldRevisions: {
    'pressure-only-candidate': 'pressure-only-projected',
  },
  candidateRoutes: {
    'pressure-only-candidate': pressureOnlyCandidateRoute,
  },
  actionOpportunity: {
    opportunityId: 'natural:survival-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:survival-actor:2',
      ownerId: 'survival-actor',
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:survival-enemy:1',
      ownerId: 'survival-enemy',
      sequence: 3,
      status: 'PENDING',
    },
  ],
  scheduledEvents: [],
  objectiveContract: futureWindowThreatWorld.胜负条件,
  beliefState: {},
  battleIntent: { mode: '求生' },
  metrics: pressureOnlyMetrics,
});
const pressureOnlyDelta = pressureOnlyEnvelope['pressure-only-candidate']?.[0];
add(
  'oracle:round-reached-hostile-hp-uses-pressure-plan-without-self-envelope-rebuild',
  pressureOnlyMetrics.rebuildCount === 0 &&
    pressureOnlyMetrics.skippedHealthEnvelopeRebuildCount === 1 &&
    pressureOnlyMetrics.pressureOnlyHealthEvaluationCount === 1 &&
    pressureOnlyMetrics.nonZeroPressureOnlyHealthEvaluationCount === 1 &&
    pressureOnlyDelta?.pressureOnly === true &&
    Math.abs(Number(pressureOnlyDelta?.healthTrajectoryDeltaPP || 0) - 20) < 1e-9,
  {
    pressureOnlyMetrics,
    pressureOnlyDelta,
  },
);

const hpSensitiveEnemy = unit('hp-sensitive-enemy', 'enemy', 30, [{
  id: 'hp-sensitive-skill',
  name: 'hp-sensitive-skill',
  魂技名: 'hp-sensitive-skill',
  消耗: { 魂力: 0 },
  _效果数组: [{
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 100,
    伤害类型: '近身攻击',
    条件分支: [{
      条件: [{
        类型: '生命比例',
        对象: '自身',
        比较: '<=',
        值: '30%',
      }],
      处理: '生效',
    }],
  }],
}]);
const hpHealingEnemy = unit('hp-healing-enemy', 'enemy', 30, [{
  id: 'hp-healing-skill',
  name: 'hp-healing-skill',
  魂技名: 'hp-healing-skill',
  消耗: { 魂力: 0 },
  _效果数组: [{
    原型: '资源变化',
    目标: '自身',
    资源: '生命',
    数值: '+20%',
  }],
}]);
const hpSensitivityWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [unit('hp-pressure-actor', 'player', 100)],
    team_enemy: [hpSensitiveEnemy, hpHealingEnemy],
  },
};
const hpSensitivityProjected = structuredClone(hpSensitivityWorld);
for (const targetId of ['hp-sensitive-enemy', 'hp-healing-enemy']) {
  const target = preview.listUnits(hpSensitivityProjected)
    .find(entry => preview.unitId(entry.unit) === targetId)?.unit;
  target.hp = 20;
  target.HP = 20;
  target.属性.HP = 20;
}
add(
  'oracle:hp-sensitive-and-self-healing-routes-cannot-use-pressure-only-shortcut',
  decision.r8UnitHasHpSensitiveBehavior(hpSensitiveEnemy) === true &&
    decision.r8UnitHasHpSensitiveBehavior(hpHealingEnemy) === true &&
    decision.r8HealthTrajectoryUsesPressureOnly({
      worldSnapshot: hpSensitivityWorld,
      projectedWorld: hpSensitivityProjected,
      actorSide: 'team_player',
      objectiveContract: hpSensitivityWorld.胜负条件,
    }, {
      targetId: 'hp-sensitive-enemy',
      healthDeltaPP: -10,
    }) === false &&
    decision.r8HealthTrajectoryUsesPressureOnly({
      worldSnapshot: hpSensitivityWorld,
      projectedWorld: hpSensitivityProjected,
      actorSide: 'team_player',
      objectiveContract: hpSensitivityWorld.胜负条件,
    }, {
      targetId: 'hp-healing-enemy',
      healthDeltaPP: -10,
    }) === false,
);

const targetPressureWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('pressure-actor', 'player', 100),
      unit('pressure-ally', 'player', 100),
    ],
    team_enemy: [
      unit('pressure-target', 'enemy', 30),
      unit('pressure-other', 'enemy', 100),
    ],
  },
};
const targetPressureProjectedWorld = structuredClone(targetPressureWorld);
const targetPressureProjectedTarget = preview.listUnits(targetPressureProjectedWorld)
  .find(entry => preview.unitId(entry.unit) === 'pressure-target')
  ?.unit;
targetPressureProjectedTarget.hp = 20;
targetPressureProjectedTarget.HP = 20;
targetPressureProjectedTarget.属性.HP = 20;
const pressurePrimaryOther = route({
  routeKey: 'route:pressure-primary-other',
  candidateId: 'pressure-ally:other',
  targetIds: ['pressure-other'],
  health: [hp('pressure-other', -10, 'pressure-other-hit')],
});
const pressureThirdTarget = route({
  routeKey: 'route:pressure-third-target',
  candidateId: 'pressure-ally:target',
  targetIds: ['pressure-target'],
  health: [hp('pressure-target', -25, 'pressure-target-hit')],
});
const pressureTargetThreat = route({
  routeKey: 'route:pressure-target-threat',
  candidateId: 'pressure-target:attack',
  targetIds: ['pressure-actor'],
  health: [hp('pressure-actor', -20, 'pressure-threat')],
});
const pressureOtherThreat = route({
  routeKey: 'route:pressure-other-threat',
  candidateId: 'pressure-other:attack',
  targetIds: ['pressure-actor'],
  health: [hp('pressure-actor', -30, 'pressure-other-threat')],
});
const targetPressureRouteCatalog = {
  'pressure-ally': {
    primaryRoute: pressurePrimaryOther,
    backupRoute: null,
  },
  'pressure-target': {
    primaryRoute: pressureTargetThreat,
    backupRoute: null,
  },
  'pressure-other': {
    primaryRoute: pressureOtherThreat,
    backupRoute: null,
  },
};
const targetPressureFullRoutes = {
  'pressure-ally': [pressurePrimaryOther, pressureThirdTarget],
  'pressure-target': [pressureTargetThreat],
  'pressure-other': [pressureOtherThreat],
};
const targetPressureOpportunities = [
  {
    opportunityId: 'natural:pressure-ally:1',
    ownerId: 'pressure-ally',
    sequence: 2,
    status: 'PENDING',
  },
  {
    opportunityId: 'natural:pressure-target:1',
    ownerId: 'pressure-target',
    sequence: 3,
    status: 'PENDING',
  },
];
const targetPressureDelta = decision.r8FutureThreatWindowDelta({
  worldSnapshot: targetPressureWorld,
  projectedWorld: targetPressureProjectedWorld,
  actorSide: 'team_player',
  targetId: 'pressure-target',
  routeCatalog: targetPressureRouteCatalog,
  fullRoutesByUnit: targetPressureFullRoutes,
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: targetPressureOpportunities,
  objectiveContract: targetPressureWorld.胜负条件,
});
const targetPressureCandidatePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: targetPressureWorld,
  actorSide: 'team_player',
  routeCatalog: targetPressureRouteCatalog,
  fullRoutesByUnit: targetPressureFullRoutes,
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: targetPressureOpportunities,
  initialHpOverrides: { 'pressure-target': 20 },
});
const controlledTargetPressurePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: targetPressureWorld,
  actorSide: 'team_player',
  routeCatalog: targetPressureRouteCatalog,
  fullRoutesByUnit: targetPressureFullRoutes,
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: targetPressureOpportunities,
  blockedOpportunityIds: ['natural:pressure-target:1'],
});
add(
  'oracle:round-reached-full-route-search-promotes-third-target-route',
  Math.abs(targetPressureDelta - 20) < 1e-9 &&
    targetPressureCandidatePlan.rows[0]?.selectedRouteKey ===
      'route:pressure-third-target' &&
    targetPressureCandidatePlan.rows[1]?.skippedReason === 'OWNER_NOT_CAPABLE',
  {
    targetPressureDelta,
    targetPressureCandidatePlan,
  },
);
add(
  'oracle:controlled-concrete-opportunity-is-not-recovered-from-full-route-catalog',
  controlledTargetPressurePlan.rows.find(row =>
    row.opportunityId === 'natural:pressure-target:1'
  )?.skippedReason === 'CONTROLLED_OPPORTUNITY' &&
    Math.abs(controlledTargetPressurePlan.threatPP) < 1e-9,
  { controlledTargetPressurePlan },
);

const probabilisticPressureRoute = route({
  routeKey: 'route:probabilistic-pressure-hit',
  candidateId: 'pressure-ally:probabilistic-hit',
  targetIds: ['pressure-target'],
  health: [hp('pressure-target', -7.5, 'pressure-probabilistic-hit')],
});
probabilisticPressureRoute.healthTrajectoryByTarget[0].outcomeDistribution =
  Object.freeze([
    Object.freeze({
      branchKey: 'hit',
      probability: 0.5,
      healthDeltaPP: -15,
      conditionalOn: Object.freeze({}),
      assignments: Object.freeze({}),
      actionState: '',
    }),
    Object.freeze({
      branchKey: 'miss',
      probability: 0.5,
      healthDeltaPP: 0,
      conditionalOn: Object.freeze({}),
      assignments: Object.freeze({}),
      actionState: '',
    }),
  ]);
const probabilisticPressureWorld = structuredClone(targetPressureWorld);
const probabilisticPressureTarget = preview.listUnits(probabilisticPressureWorld)
  .find(entry => preview.unitId(entry.unit) === 'pressure-target')
  ?.unit;
probabilisticPressureTarget.hp = 10;
probabilisticPressureTarget.HP = 10;
probabilisticPressureTarget.属性.HP = 10;
const probabilisticPressurePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: probabilisticPressureWorld,
  actorSide: 'team_player',
  routeCatalog: {
    ...targetPressureRouteCatalog,
    'pressure-ally': {
      primaryRoute: probabilisticPressureRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    ...targetPressureFullRoutes,
    'pressure-ally': [probabilisticPressureRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: targetPressureOpportunities,
});
add(
  'oracle:probabilistic-future-kill-does-not-remove-all-threat',
  Math.abs(Number(probabilisticPressurePlan.threatPP || 0) - 10) < 1e-9 &&
    Math.abs(
      Number(probabilisticPressurePlan.finalCapableProbabilityByUnit['pressure-target']) -
        0.5,
    ) < 1e-9,
  { probabilisticPressurePlan },
);

const probabilisticPressureBaselineWorld = structuredClone(targetPressureWorld);
const probabilisticPressureBaselineTarget = preview.listUnits(
  probabilisticPressureBaselineWorld,
).find(entry => preview.unitId(entry.unit) === 'pressure-target')?.unit;
probabilisticPressureBaselineTarget.hp = 20;
probabilisticPressureBaselineTarget.HP = 20;
probabilisticPressureBaselineTarget.属性.HP = 20;
const probabilisticPressureCandidateWorld = structuredClone(
  probabilisticPressureBaselineWorld,
);
const probabilisticPressureCandidateTarget = preview.listUnits(
  probabilisticPressureCandidateWorld,
).find(entry => preview.unitId(entry.unit) === 'pressure-target')?.unit;
probabilisticPressureCandidateTarget.hp = 10;
probabilisticPressureCandidateTarget.HP = 10;
probabilisticPressureCandidateTarget.属性.HP = 10;
const probabilisticPressureDelta = decision.r8FutureThreatWindowDelta({
  worldSnapshot: probabilisticPressureBaselineWorld,
  projectedWorld: probabilisticPressureCandidateWorld,
  actorSide: 'team_player',
  targetId: 'pressure-target',
  routeCatalog: {
    ...targetPressureRouteCatalog,
    'pressure-ally': {
      primaryRoute: probabilisticPressureRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    ...targetPressureFullRoutes,
    'pressure-ally': [probabilisticPressureRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: targetPressureOpportunities,
  objectiveContract: probabilisticPressureBaselineWorld.胜负条件,
});
add(
  'oracle:current-pressure-only-receives-probabilistic-future-kill-margin',
  Math.abs(probabilisticPressureDelta - 10) < 1e-9,
  { probabilisticPressureDelta },
);

const shieldTimelineWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [unit('shield-survivor', 'player', 100)],
    team_enemy: [unit('shield-attacker', 'enemy', 100)],
  },
};
const shieldTimelineSurvivor = preview.listUnits(shieldTimelineWorld)
  .find(entry => preview.unitId(entry.unit) === 'shield-survivor')
  ?.unit;
shieldTimelineSurvivor.shield = 10;
shieldTimelineSurvivor.护盾 = 10;
const shieldedAttackRoute = route({
  routeKey: 'route:shield-timeline-attack',
  candidateId: 'shield-attacker:attack',
  targetIds: ['shield-survivor'],
  health: [{
    ...hp('shield-survivor', 0, 'shield-timeline-hit'),
    outcomeDistribution: Object.freeze([Object.freeze({
      branchKey: 'hit',
      probability: 1,
      healthDeltaPP: 0,
      incomingDamagePP: 10,
      shieldAbsorbPP: 10,
      conditionalOn: Object.freeze({}),
      assignments: Object.freeze({}),
      actionState: '',
    })]),
  }],
});
const shieldTimelinePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: shieldTimelineWorld,
  actorSide: 'team_player',
  routeCatalog: {
    'shield-attacker': {
      primaryRoute: shieldedAttackRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    'shield-attacker': [shieldedAttackRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:shield-survivor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:shield-attacker:1',
    ownerId: 'shield-attacker',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [{
    descriptorId: 'future-natural:2:shield-attacker',
    ownerId: 'shield-attacker',
    scheduledRound: 2,
    creationSequence: 3,
    eventType: 'FUTURE_NATURAL_ACTION',
  }],
});
add(
  'oracle:target-pressure-consumes-one-shield-layer-only-once',
  Math.abs(Number(shieldTimelinePlan.threatPP || 0) - 10) < 1e-9 &&
    Math.abs(Number(shieldTimelinePlan.finalHpByUnit['shield-survivor']) - 90) < 1e-9 &&
    Math.abs(Number(shieldTimelinePlan.finalShieldPPByUnit['shield-survivor'])) < 1e-9 &&
    Number(shieldTimelinePlan.rows[0]?.addedThreatPP || 0) === 0 &&
    Math.abs(Number(shieldTimelinePlan.rows[1]?.addedThreatPP || 0) - 10) < 1e-9,
  { shieldTimelinePlan },
);

const fullShieldTimelineWorld = structuredClone(shieldTimelineWorld);
const fullShieldTimelineSurvivor = preview.listUnits(fullShieldTimelineWorld)
  .find(entry => preview.unitId(entry.unit) === 'shield-survivor')
  ?.unit;
fullShieldTimelineSurvivor.shield = 20;
fullShieldTimelineSurvivor.护盾 = 20;
const fullShieldTimelinePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: fullShieldTimelineWorld,
  actorSide: 'team_player',
  routeCatalog: {
    'shield-attacker': {
      primaryRoute: shieldedAttackRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    'shield-attacker': [shieldedAttackRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:shield-survivor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:shield-attacker:1',
    ownerId: 'shield-attacker',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [{
    descriptorId: 'future-natural:2:shield-attacker',
    ownerId: 'shield-attacker',
    scheduledRound: 2,
    creationSequence: 3,
    eventType: 'FUTURE_NATURAL_ACTION',
  }],
});
add(
  'oracle:target-pressure-zero-only-when-shield-covers-entire-horizon',
  Number(fullShieldTimelinePlan.threatPP || 0) === 0 &&
    Number(fullShieldTimelinePlan.finalHpByUnit['shield-survivor']) === 100 &&
    Number(fullShieldTimelinePlan.finalShieldPPByUnit['shield-survivor']) === 0,
  { fullShieldTimelinePlan },
);

const expiringShieldTimelineWorld = structuredClone(shieldTimelineWorld);
const expiringShieldTimelineSurvivor = preview.listUnits(
  expiringShieldTimelineWorld,
).find(entry => preview.unitId(entry.unit) === 'shield-survivor')?.unit;
expiringShieldTimelineSurvivor.shield = 0;
expiringShieldTimelineSurvivor.护盾 = 0;
expiringShieldTimelineSurvivor.状态效果 = {
  'short-shield': {
    状态: '短效护盾',
    duration: 1,
    shield_value: 10,
  },
};
const expiringShieldTimelinePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: expiringShieldTimelineWorld,
  actorSide: 'team_player',
  routeCatalog: {
    'shield-attacker': {
      primaryRoute: shieldedAttackRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    'shield-attacker': [shieldedAttackRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:shield-survivor:1',
    round: 1,
    sequence: 1,
  },
  scheduledEvents: [{
    descriptorId: 'future-natural:2:shield-attacker',
    ownerId: 'shield-attacker',
    scheduledRound: 2,
    creationSequence: 2,
    eventType: 'FUTURE_NATURAL_ACTION',
  }],
});
add(
  'oracle:target-pressure-expires-short-shield-before-future-round',
  Math.abs(Number(expiringShieldTimelinePlan.threatPP || 0) - 10) < 1e-9 &&
    Math.abs(
      Number(expiringShieldTimelinePlan.finalHpByUnit['shield-survivor']) - 90,
    ) < 1e-9 &&
    Number(expiringShieldTimelinePlan.rows[0]?.addedThreatPP || 0) === 10,
  { expiringShieldTimelinePlan },
);

const competingPressureWorld = structuredClone(targetPressureWorld);
const competingTarget = preview.listUnits(competingPressureWorld)
  .find(entry => preview.unitId(entry.unit) === 'pressure-target')
  ?.unit;
const competingOther = preview.listUnits(competingPressureWorld)
  .find(entry => preview.unitId(entry.unit) === 'pressure-other')
  ?.unit;
competingTarget.hp = 20;
competingTarget.HP = 20;
competingTarget.属性.HP = 20;
competingOther.hp = 20;
competingOther.HP = 20;
competingOther.属性.HP = 20;
const competingOtherKill = route({
  routeKey: 'route:pressure-kill-other',
  candidateId: 'pressure-ally:kill-other',
  targetIds: ['pressure-other'],
  health: [hp('pressure-other', -25, 'pressure-other-kill')],
});
const competingPlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: competingPressureWorld,
  actorSide: 'team_player',
  routeCatalog: {
    ...targetPressureRouteCatalog,
    'pressure-ally': {
      primaryRoute: competingOtherKill,
      backupRoute: pressureThirdTarget,
    },
  },
  fullRoutesByUnit: {
    ...targetPressureFullRoutes,
    'pressure-ally': [pressureThirdTarget, competingOtherKill],
  },
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: [
    targetPressureOpportunities[0],
    targetPressureOpportunities[1],
    {
      opportunityId: 'natural:pressure-other:1',
      ownerId: 'pressure-other',
      sequence: 4,
      status: 'PENDING',
    },
  ],
});
add(
  'oracle:target-pressure-uses-each-future-opportunity-once',
  competingPlan.rows.filter(row => row.ownerId === 'pressure-ally').length === 1 &&
    competingPlan.rows[0]?.selectedRouteKey === 'route:pressure-kill-other' &&
    Number(competingPlan.finalHpByUnit['pressure-target']) === 20 &&
    Number(competingPlan.finalHpByUnit['pressure-other']) === 0 &&
    Math.abs(Number(competingPlan.threatPP || 0) - 20) < 1e-9,
  { competingPlan },
);

const rollingPressureWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('rolling-first', 'player', 100),
      unit('rolling-last', 'player', 100),
    ],
    team_enemy: [unit('rolling-threat', 'enemy', 20)],
  },
};
const rollingThreatRoute = route({
  routeKey: 'route:rolling-threat',
  candidateId: 'rolling-threat:attack',
  targetIds: ['rolling-first'],
  health: [hp('rolling-first', -20, 'rolling-threat-hit')],
});
const rollingLastKillRoute = route({
  routeKey: 'route:rolling-last-kill',
  candidateId: 'rolling-last:kill',
  targetIds: ['rolling-threat'],
  health: [hp('rolling-threat', -25, 'rolling-last-kill')],
});
const rollingCurrentKillRoute = route({
  routeKey: 'route:rolling-current-kill',
  candidateId: 'rolling-current:kill',
  targetIds: ['rolling-threat'],
  health: [{
    ...hp('rolling-threat', -25, 'rolling-current-kill'),
    rootActionId: 'rolling-current:kill',
  }],
});
const rollingProjectedWorld = structuredClone(rollingPressureWorld);
const rollingProjectedThreat = preview.listUnits(rollingProjectedWorld)
  .find(entry => preview.unitId(entry.unit) === 'rolling-threat')?.unit;
rollingProjectedThreat.hp = 0;
rollingProjectedThreat.HP = 0;
rollingProjectedThreat.属性.HP = 0;
rollingProjectedThreat.状态.存活 = false;
rollingProjectedThreat.状态.行动 = '死亡';
const rollingRouteCatalog = {
  'rolling-last': {
    primaryRoute: rollingLastKillRoute,
    backupRoute: null,
  },
  'rolling-threat': {
    primaryRoute: rollingThreatRoute,
    backupRoute: null,
  },
};
const rollingFullRoutes = {
  'rolling-last': [rollingLastKillRoute],
  'rolling-threat': [rollingThreatRoute],
};
const rollingFirstEnvelope = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: rollingPressureWorld,
  actorSide: 'team_player',
  routeCatalog: rollingRouteCatalog,
  fullRoutesByUnit: rollingFullRoutes,
  projectedWorlds: {
    'rolling-current:kill': rollingProjectedWorld,
  },
  projectedWorldRevisions: {
    'rolling-current:kill': 'rolling-first-projected',
  },
  candidateRoutes: {
    'rolling-current:kill': rollingCurrentKillRoute,
  },
  actionOpportunity: {
    opportunityId: 'natural:rolling-first:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:rolling-last:1',
      ownerId: 'rolling-last',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:rolling-threat:1',
      ownerId: 'rolling-threat',
      round: 1,
      sequence: 3,
      status: 'PENDING',
    },
  ],
  scheduledEvents: [],
  objectiveContract: rollingPressureWorld.胜负条件,
  beliefState: {},
  battleIntent: { mode: '求生' },
});
const rollingLastEnvelope = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: rollingPressureWorld,
  actorSide: 'team_player',
  routeCatalog: rollingRouteCatalog,
  fullRoutesByUnit: rollingFullRoutes,
  projectedWorlds: {
    'rolling-current:kill': rollingProjectedWorld,
  },
  projectedWorldRevisions: {
    'rolling-current:kill': 'rolling-last-projected',
  },
  candidateRoutes: {
    'rolling-current:kill': rollingCurrentKillRoute,
  },
  actionOpportunity: {
    opportunityId: 'natural:rolling-last:1',
    round: 1,
    sequence: 2,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:rolling-threat:1',
    ownerId: 'rolling-threat',
    round: 1,
    sequence: 3,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  objectiveContract: rollingPressureWorld.胜负条件,
  beliefState: {},
  battleIntent: { mode: '求生' },
});
const rollingFirstDelta = rollingFirstEnvelope['rolling-current:kill']?.[0];
const rollingLastDelta = rollingLastEnvelope['rolling-current:kill']?.[0];
add(
  'oracle:target-pressure-rolls-from-reasonable-preserve-to-last-actionable-marginal',
  Math.abs(Number(rollingFirstDelta?.healthTrajectoryDeltaPP || 0)) < 1e-9 &&
    Math.abs(Number(rollingLastDelta?.healthTrajectoryDeltaPP || 0) - 20) < 1e-9,
  {
    rollingFirstDelta,
    rollingLastDelta,
  },
);

const unavailablePressureWorld = structuredClone(rollingPressureWorld);
const unavailableLast = preview.listUnits(unavailablePressureWorld)
  .find(entry => preview.unitId(entry.unit) === 'rolling-last')?.unit;
unavailableLast.hp = 0;
unavailableLast.HP = 0;
unavailableLast.属性.HP = 0;
unavailableLast.状态.存活 = false;
unavailableLast.状态.行动 = '死亡';
const unavailableProjectedWorld = structuredClone(unavailablePressureWorld);
const unavailableProjectedThreat = preview.listUnits(unavailableProjectedWorld)
  .find(entry => preview.unitId(entry.unit) === 'rolling-threat')?.unit;
unavailableProjectedThreat.hp = 0;
unavailableProjectedThreat.HP = 0;
unavailableProjectedThreat.属性.HP = 0;
unavailableProjectedThreat.状态.存活 = false;
unavailableProjectedThreat.状态.行动 = '死亡';
const unavailableEnvelope = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: unavailablePressureWorld,
  actorSide: 'team_player',
  routeCatalog: rollingRouteCatalog,
  fullRoutesByUnit: rollingFullRoutes,
  projectedWorlds: {
    'rolling-current:kill': unavailableProjectedWorld,
  },
  projectedWorldRevisions: {
    'rolling-current:kill': 'rolling-unavailable-projected',
  },
  candidateRoutes: {
    'rolling-current:kill': rollingCurrentKillRoute,
  },
  actionOpportunity: {
    opportunityId: 'natural:rolling-first:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:rolling-last:1',
      ownerId: 'rolling-last',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:rolling-threat:1',
      ownerId: 'rolling-threat',
      round: 1,
      sequence: 3,
      status: 'PENDING',
    },
  ],
  scheduledEvents: [],
  objectiveContract: unavailablePressureWorld.胜负条件,
  beliefState: {},
  battleIntent: { mode: '求生' },
});
const unavailableDelta = unavailableEnvelope['rolling-current:kill']?.[0];
add(
  'oracle:target-pressure-rebuilds-when-planned-future-ally-is-unavailable',
  Math.abs(Number(unavailableDelta?.healthTrajectoryDeltaPP || 0) - 20) < 1e-9,
  { unavailableDelta },
);

const resourcePressureWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('resource-pressure-actor', 'player', 100),
      unit('resource-pressure-ally', 'player', 100),
    ],
    team_enemy: [
      unit('resource-pressure-a', 'enemy', 20),
      unit('resource-pressure-b', 'enemy', 20),
    ],
  },
};
const resourceKillA = route({
  routeKey: 'route:resource-kill-a',
  candidateId: 'resource-pressure-ally:kill-a',
  targetIds: ['resource-pressure-a'],
  paymentDependencies: [{
    unitId: 'resource-pressure-ally',
    resource: '魂力',
    amount: 60,
  }],
  health: [hp('resource-pressure-a', -25, 'resource-kill-a')],
});
const resourceKillB = route({
  routeKey: 'route:resource-kill-b',
  candidateId: 'resource-pressure-ally:kill-b',
  targetIds: ['resource-pressure-b'],
  paymentDependencies: [{
    unitId: 'resource-pressure-ally',
    resource: '魂力',
    amount: 60,
  }],
  health: [hp('resource-pressure-b', -25, 'resource-kill-b')],
});
const resourceFreeRoute = route({
  routeKey: 'route:resource-free',
  candidateId: 'resource-pressure-ally:free',
  targetIds: ['resource-pressure-ally'],
});
const resourceThreatA = route({
  routeKey: 'route:resource-threat-a',
  candidateId: 'resource-pressure-a:attack',
  targetIds: ['resource-pressure-actor'],
  health: [hp('resource-pressure-actor', -10, 'resource-threat-a')],
});
const resourceThreatB = route({
  routeKey: 'route:resource-threat-b',
  candidateId: 'resource-pressure-b:attack',
  targetIds: ['resource-pressure-actor'],
  health: [hp('resource-pressure-actor', -10, 'resource-threat-b')],
});
const resourcePressurePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: resourcePressureWorld,
  actorSide: 'team_player',
  routeCatalog: {
    'resource-pressure-ally': {
      primaryRoute: resourceKillA,
      backupRoute: resourceKillB,
    },
    'resource-pressure-a': {
      primaryRoute: resourceThreatA,
      backupRoute: null,
    },
    'resource-pressure-b': {
      primaryRoute: resourceThreatB,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    'resource-pressure-ally': [
      resourceKillA,
      resourceKillB,
      resourceFreeRoute,
    ],
    'resource-pressure-a': [resourceThreatA],
    'resource-pressure-b': [resourceThreatB],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-pressure-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:resource-pressure-ally:1',
      ownerId: 'resource-pressure-ally',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'extra:resource-pressure-ally:1',
      ownerId: 'resource-pressure-ally',
      round: 1,
      sequence: 3,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:resource-pressure-a:1',
      ownerId: 'resource-pressure-a',
      round: 1,
      sequence: 4,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:resource-pressure-b:1',
      ownerId: 'resource-pressure-b',
      round: 1,
      sequence: 5,
      status: 'PENDING',
    },
  ],
});
add(
  'oracle:target-pressure-resource-payment-persists-across-opportunities',
  resourcePressurePlan.rows[0]?.selectedRouteKey === 'route:resource-kill-a' &&
    resourcePressurePlan.rows[1]?.selectedRouteKey === 'route:resource-free' &&
    Number(resourcePressurePlan.finalHpByUnit['resource-pressure-a']) === 0 &&
    Number(resourcePressurePlan.finalHpByUnit['resource-pressure-b']) === 20 &&
    Math.abs(Number(resourcePressurePlan.threatPP || 0) - 10) < 1e-9,
  { resourcePressurePlan },
);

const resourceContinuityActor = unit('resource-continuity-actor', 'player');
const resourceContinuityAlly = unit('resource-continuity-ally', 'player');
const resourceContinuityEnemy = unit('resource-continuity-enemy', 'enemy');
resourceContinuityAlly.属性.魂力 = 120;
resourceContinuityAlly.属性.魂力上限 = 240;
resourceContinuityAlly.sp = 120;
resourceContinuityAlly.sp_max = 240;
const resourceContinuityWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [resourceContinuityActor, resourceContinuityAlly],
    team_enemy: [resourceContinuityEnemy],
  },
};
const resourceContinuityHigh = route({
  routeKey: 'route:resource-continuity-high',
  candidateId: 'resource-continuity-ally:high',
  routeBenefitPP: 20,
  paymentDependencies: [{
    unitId: 'resource-continuity-ally',
    resource: '魂力',
    amount: 60,
  }],
  health: [{
    ...hp('resource-continuity-enemy', -20, 'resource-continuity-high'),
    actorBenefitPP: 20,
  }],
});
const resourceContinuityFree = route({
  routeKey: 'route:resource-continuity-free',
  candidateId: 'resource-continuity-ally:free',
  routeBenefitPP: 2,
  health: [{
    ...hp('resource-continuity-enemy', -2, 'resource-continuity-free'),
    actorBenefitPP: 2,
  }],
});
const resourceContinuityOpportunities = [2, 3, 4].map(sequence => ({
  opportunityId: `natural:resource-continuity-ally:${sequence}`,
  ownerId: 'resource-continuity-ally',
  round: 1,
  sequence,
  status: 'PENDING',
}));
const buildResourceContinuityPlan = initialSoul => {
  const snapshot = structuredClone(resourceContinuityWorld);
  snapshot.参战者.team_player[1].属性.魂力 = initialSoul;
  snapshot.参战者.team_player[1].sp = initialSoul;
  return decision.r8BuildResourceOpportunityPlan?.({
    worldSnapshot: snapshot,
    actorSide: 'team_player',
    unitIds: ['resource-continuity-ally'],
    routeCatalog: {
      'resource-continuity-ally': {
        primaryRoute: resourceContinuityHigh,
        backupRoute: resourceContinuityFree,
      },
    },
    fullRoutesByUnit: {
      'resource-continuity-ally': [
        resourceContinuityHigh,
        resourceContinuityFree,
      ],
    },
    actionOpportunity: {
      opportunityId: 'natural:resource-continuity-actor:1',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: resourceContinuityOpportunities,
    scheduledEvents: [],
    resourceTimeline: [],
  });
};
const resourceContinuityBaseline = buildResourceContinuityPlan(120);
const resourceContinuityCandidate = buildResourceContinuityPlan(180);
const resourceContinuityNoDifference = buildResourceContinuityPlan(200);
add(
  'oracle:resource-support-values-third-use-when-next-primary-route-is-unchanged',
  resourceContinuityBaseline?.rows?.[0]?.selectedRouteKey ===
      'route:resource-continuity-high' &&
    resourceContinuityCandidate?.rows?.[0]?.selectedRouteKey ===
      'route:resource-continuity-high' &&
    resourceContinuityBaseline?.rows?.filter(row =>
      row?.selectedRouteKey === 'route:resource-continuity-high'
    ).length === 2 &&
    resourceContinuityCandidate?.rows?.filter(row =>
      row?.selectedRouteKey === 'route:resource-continuity-high'
    ).length === 3 &&
    Number(resourceContinuityCandidate?.cumulativeUtilityHEPP || 0) >
      Number(resourceContinuityBaseline?.cumulativeUtilityHEPP || 0),
  {
    resourceContinuityBaseline,
    resourceContinuityCandidate,
  },
);
add(
  'oracle:resource-support-is-zero-when-future-payable-route-set-does-not-change',
  Math.abs(
    Number(resourceContinuityNoDifference?.cumulativeUtilityHEPP || 0) -
    Number(resourceContinuityCandidate?.cumulativeUtilityHEPP || 0),
  ) < 1e-9,
  {
    resourceContinuityCandidate,
    resourceContinuityNoDifference,
  },
);
decision.resetMetrics();
const resourceCacheWorld = structuredClone(resourceContinuityWorld);
const resourceCacheInput = {
  worldSnapshot: resourceCacheWorld,
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally': decision.selectPrimaryBackupRoutes([
      resourceContinuityHigh,
      resourceContinuityFree,
    ]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [
      resourceContinuityHigh,
      resourceContinuityFree,
    ],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: resourceContinuityOpportunities,
  scheduledEvents: [],
  resourceTimeline: [],
};
const resourceCacheInputHash = preview.stableHash(resourceCacheWorld);
const resourceCacheFirst = decision.r8BuildResourceOpportunityPlan(
  resourceCacheInput,
);
const resourceCacheSecond = decision.r8BuildResourceOpportunityPlan({
  ...resourceCacheInput,
  worldSnapshot: structuredClone(resourceCacheWorld),
});
const resourceCacheMetrics = decision.readMetrics();
add(
  'oracle:resource-plan-semantic-clone-cache-is-hash-equivalent',
  Number(resourceCacheMetrics?.resourceOpportunityPlanCacheHits || 0) >= 1 &&
    preview.stableHash(resourceCacheFirst) ===
      preview.stableHash(resourceCacheSecond),
  {
    resourceCacheMetrics,
    firstHash: preview.stableHash(resourceCacheFirst),
    secondHash: preview.stableHash(resourceCacheSecond),
  },
);
add(
  'oracle:resource-plan-does-not-mutate-input-world-while-advancing-rounds',
  preview.stableHash(resourceCacheWorld) === resourceCacheInputHash &&
    Number(resourceCacheWorld?.回合 || 0) ===
      Number(resourceContinuityWorld?.回合 || 0),
  {
    beforeHash: resourceCacheInputHash,
    afterHash: preview.stableHash(resourceCacheWorld),
    round: resourceCacheWorld?.回合,
  },
);
const resourceTerminalWorld = structuredClone(resourceContinuityWorld);
resourceTerminalWorld.参战者.team_enemy[0].hp = 10;
resourceTerminalWorld.参战者.team_enemy[0].属性.HP = 10;
const resourceTerminalRoute = route({
  routeKey: 'route:resource-terminal-hit',
  candidateId: 'resource-continuity-ally:terminal-hit',
  routeBenefitPP: 20,
  behaviorRouteUtilityHEPP: 20,
  health: [
    hp(
      'resource-continuity-enemy',
      -20,
      'resource-terminal-hit',
    ),
  ],
});
const resourceTerminalPlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: resourceTerminalWorld,
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally':
      decision.selectPrimaryBackupRoutes([resourceTerminalRoute]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [resourceTerminalRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: resourceContinuityOpportunities.slice(0, 2),
  scheduledEvents: [],
  resourceTimeline: [],
  objectiveContract: resourceTerminalWorld.胜负条件,
});
add(
  'oracle:resource-plan-stops-at-first-terminal-and-does-not-repeat-lethal-route',
  Number(resourceTerminalPlan?.finalHpByUnit?.['resource-continuity-enemy']) === 0 &&
    resourceTerminalPlan?.terminalStatus === 'PLAYER_WIN' &&
    resourceTerminalPlan?.rows?.length === 1 &&
    resourceTerminalPlan?.rows?.[0]?.selectedRouteKey ===
      'route:resource-terminal-hit' &&
    Math.abs(
      Number(resourceTerminalPlan?.cumulativeUtilityHEPP || 0) - 100,
    ) < 1e-9,
  { resourceTerminalPlan },
);
const resourceTerminalPriorityWorld = structuredClone(resourceContinuityWorld);
resourceTerminalPriorityWorld.参战者.team_enemy[0].hp = 10;
resourceTerminalPriorityWorld.参战者.team_enemy[0].属性.HP = 10;
const resourceOngoingHighValueRoute = route({
  routeKey: 'route:resource-ongoing-high-value',
  candidateId: 'resource-continuity-ally:ongoing-high-value',
  behaviorRouteUtilityHEPP: 80,
});
const resourceCertainTerminalRoute = route({
  routeKey: 'route:resource-certain-terminal',
  candidateId: 'resource-continuity-ally:certain-terminal',
  routeBenefitPP: 20,
  health: [
    hp(
      'resource-continuity-enemy',
      -20,
      'resource-certain-terminal',
    ),
  ],
});
const resourceTerminalPriorityPlan =
  decision.r8BuildResourceOpportunityPlan?.({
    worldSnapshot: resourceTerminalPriorityWorld,
    actorSide: 'team_player',
    unitIds: ['resource-continuity-ally'],
    routeCatalog: {
      'resource-continuity-ally': decision.selectPrimaryBackupRoutes([
        resourceOngoingHighValueRoute,
        resourceCertainTerminalRoute,
      ]),
    },
    fullRoutesByUnit: {
      'resource-continuity-ally': [
        resourceOngoingHighValueRoute,
        resourceCertainTerminalRoute,
      ],
    },
    actionOpportunity: {
      opportunityId: 'natural:resource-continuity-actor:1',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: resourceContinuityOpportunities.slice(0, 2),
    scheduledEvents: [],
    resourceTimeline: [],
    objectiveContract: resourceTerminalPriorityWorld.胜负条件,
  });
add(
  'oracle:resource-plan-deterministic-terminal-beats-uncapped-ongoing-accumulation',
  resourceTerminalPriorityPlan?.terminalStatus === 'PLAYER_WIN' &&
    resourceTerminalPriorityPlan?.rows?.length === 1 &&
    resourceTerminalPriorityPlan?.rows?.[0]?.selectedRouteKey ===
      'route:resource-certain-terminal' &&
    Math.abs(
      Number(resourceTerminalPriorityPlan?.cumulativeUtilityHEPP || 0) - 100,
    ) < 1e-9,
  { resourceTerminalPriorityPlan },
);
const resourceThresholdWorld = structuredClone(resourceContinuityWorld);
resourceThresholdWorld.胜负条件 = objective('HP_RATIO_AT_OR_BELOW');
resourceThresholdWorld.参战者.team_enemy[0].hp = 35;
resourceThresholdWorld.参战者.team_enemy[0].属性.HP = 35;
const resourceThresholdRoute = route({
  routeKey: 'route:resource-threshold-hit',
  candidateId: 'resource-continuity-ally:threshold-hit',
  routeBenefitPP: 5,
  objectiveRouteUtilityHEPP: 5,
  behaviorRouteUtilityHEPP: 5,
  health: [
    hp(
      'resource-continuity-enemy',
      -10,
      'resource-threshold-hit',
    ),
  ],
});
const resourceThresholdPlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: resourceThresholdWorld,
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally':
      decision.selectPrimaryBackupRoutes([resourceThresholdRoute]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [resourceThresholdRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: resourceContinuityOpportunities.slice(0, 2),
  scheduledEvents: [],
  resourceTimeline: [],
  objectiveContract: resourceThresholdWorld.胜负条件,
});
add(
  'oracle:resource-plan-stops-after-threshold-terminal-without-static-second-use',
  Number(resourceThresholdPlan?.finalHpByUnit?.['resource-continuity-enemy']) === 25 &&
    resourceThresholdPlan?.terminalStatus === 'PLAYER_WIN' &&
    resourceThresholdPlan?.rows?.length === 1 &&
    Math.abs(
      Number(resourceThresholdPlan?.cumulativeUtilityHEPP || 0) - 100,
    ) < 1e-9,
  { resourceThresholdPlan },
);
const probabilisticResourceThresholdRoute = route({
  routeKey: 'route:resource-probabilistic-threshold',
  candidateId: 'resource-continuity-ally:probabilistic-threshold',
  routeBenefitPP: 5,
  health: [{
    ...hp(
      'resource-continuity-enemy',
      -5,
      'resource-probabilistic-threshold',
    ),
    actorBenefitPP: 5,
    outcomeDistribution: [
      { branchKey: 'miss', probability: 0.5, healthDeltaPP: 0 },
      { branchKey: 'hit', probability: 0.5, healthDeltaPP: -10 },
    ],
  }],
});
const probabilisticResourceThresholdPlan =
  decision.r8BuildResourceOpportunityPlan?.({
    worldSnapshot: resourceThresholdWorld,
    actorSide: 'team_player',
    unitIds: ['resource-continuity-ally'],
    routeCatalog: {
      'resource-continuity-ally':
        decision.selectPrimaryBackupRoutes([
          probabilisticResourceThresholdRoute,
        ]),
    },
    fullRoutesByUnit: {
      'resource-continuity-ally': [
        probabilisticResourceThresholdRoute,
      ],
    },
    actionOpportunity: {
      opportunityId: 'natural:resource-continuity-actor:1',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: resourceContinuityOpportunities.slice(0, 2),
    scheduledEvents: [],
    resourceTimeline: [],
    objectiveContract: resourceThresholdWorld.胜负条件,
  });
add(
  'oracle:resource-plan-preserves-exact-probabilistic-threshold-branches',
  probabilisticResourceThresholdPlan?.terminalStatus === 'ONGOING' &&
    probabilisticResourceThresholdPlan?.terminalResult === null &&
    probabilisticResourceThresholdPlan?.probabilisticStateUnresolved === false &&
    probabilisticResourceThresholdPlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    probabilisticResourceThresholdPlan?.branchPlanCount === 3 &&
    Math.abs(
      Number(probabilisticResourceThresholdPlan?.terminalProbability || 0) -
      0.75,
    ) < 1e-9 &&
    Math.abs(
      Number(probabilisticResourceThresholdPlan?.ongoingProbability || 0) -
      0.25,
    ) < 1e-9 &&
    Math.abs(
      Number(probabilisticResourceThresholdPlan?.cumulativeUtilityHEPP || 0) -
      75,
    ) < 1e-9 &&
    probabilisticResourceThresholdPlan?.rows?.every(row =>
      row?.projectionMode === 'EXACT_PROBABILISTIC_BRANCH_STATE'
    ),
  { probabilisticResourceThresholdPlan },
);
const repeatedControlRoute = route({
  routeKey: 'route:resource-repeated-control',
  candidateId: 'resource-continuity-ally:repeated-control',
  routeBenefitPP: 0,
  intrinsicBehaviorUtilityHEPP: 20,
  behaviorRouteUtilityHEPP: 20,
  effects: [effect('ACTION_CANCELLED', 'resource-continuity-enemy', {
    applicationProbability: 1,
    duration: 1,
  })],
  intrinsicActionPoolDeltas: [{
    ...effect('ACTION_CANCELLED', 'resource-continuity-enemy', {
      applicationProbability: 1,
      duration: 1,
    }),
    ownerType: 'ACTION_POOL_DELTA',
    realizable: true,
    healthTrajectoryDeltaPP: 20,
  }],
});
const repeatedControlPlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: resourceContinuityWorld,
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally':
      decision.selectPrimaryBackupRoutes([repeatedControlRoute]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [repeatedControlRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [
    resourceContinuityOpportunities[0],
    {
      opportunityId: 'natural:resource-continuity-enemy:3',
      ownerId: 'resource-continuity-enemy',
      round: 1,
      sequence: 3,
      status: 'PENDING',
    },
    resourceContinuityOpportunities[2],
  ],
  scheduledEvents: [],
  resourceTimeline: [],
});
add(
  'oracle:resource-plan-control-value-consumes-the-covered-opportunity-once',
  Math.abs(
    Number(repeatedControlPlan?.cumulativeUtilityHEPP || 0) - 20,
  ) < 1e-9 &&
    repeatedControlPlan?.consumedBehaviorKeys?.includes(
      'control-opportunity:natural:resource-continuity-enemy:3',
    ) &&
    repeatedControlPlan?.rows?.filter(row =>
      Number(row?.routeUtilityHEPP || 0) > 1e-9
    ).length === 1,
  { repeatedControlPlan },
);
const probabilisticControlDelta = {
  ...effect('ACTION_CANCELLED', 'resource-continuity-enemy', {
    prototype: '状态施加',
    state: '眩晕',
    applicationProbability: 0.5,
    duration: 1,
    r8RealizationProbability: 0.5,
    r8RealizedHealthTrajectoryDeltaPP: 20,
  }),
  ownerType: 'ACTION_POOL_DELTA',
  realizable: true,
  healthTrajectoryDeltaPP: 10,
};
const probabilisticControlGraph = preview.buildActionOperationGraph({
  previewResult: {
    actorId: 'resource-continuity-ally',
    actionId: 'resource-continuity-ally:probabilistic-control',
    contributions: [probabilisticControlDelta],
    scheduledEvents: [],
  },
  worldSnapshot: resourceContinuityWorld,
  rootActionId: 'resource-continuity-ally:probabilistic-control',
  actionFingerprint: 'resource-continuity-ally:probabilistic-control',
  round: 1,
  opportunitySequence: 2,
  actionSequence: 1,
});
const probabilisticControlRoute = route({
  routeKey: 'route:resource-probabilistic-control',
  candidateId: 'resource-continuity-ally:probabilistic-control',
  routeBenefitPP: 0,
  intrinsicBehaviorUtilityHEPP: 10,
  behaviorRouteUtilityHEPP: 10,
  effects: [probabilisticControlDelta],
  intrinsicActionPoolDeltas: [probabilisticControlDelta],
  operationGraph: probabilisticControlGraph,
});
const probabilisticControlPlan =
  decision.r8BuildResourceOpportunityPlan?.({
    worldSnapshot: resourceContinuityWorld,
    actorSide: 'team_player',
    unitIds: ['resource-continuity-ally'],
    routeCatalog: {
      'resource-continuity-ally':
        decision.selectPrimaryBackupRoutes([probabilisticControlRoute]),
    },
    fullRoutesByUnit: {
      'resource-continuity-ally': [probabilisticControlRoute],
    },
    actionOpportunity: {
      opportunityId: 'natural:resource-continuity-actor:1',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: [
      {
        opportunityId: 'natural:resource-continuity-ally:2',
        ownerId: 'resource-continuity-ally',
        round: 1,
        sequence: 2,
        status: 'PENDING',
      },
      {
        opportunityId: 'natural:resource-continuity-ally:3',
        ownerId: 'resource-continuity-ally',
        round: 1,
        sequence: 3,
        status: 'PENDING',
      },
      {
        opportunityId: 'natural:resource-continuity-enemy:4',
        ownerId: 'resource-continuity-enemy',
        round: 1,
        sequence: 4,
        status: 'PENDING',
      },
    ],
    scheduledEvents: [],
    resourceTimeline: [],
  });
const probabilisticControlBranches =
  probabilisticControlPlan?.branchPlanSummary || [];
add(
  'oracle:probabilistic-control-consumes-opportunity-only-on-success-branch',
  probabilisticControlPlan?.probabilisticStateUnresolved === false &&
    probabilisticControlPlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    probabilisticControlPlan?.branchPlanCount === 2 &&
    Math.abs(
      Number(probabilisticControlPlan?.cumulativeUtilityHEPP || 0) - 15,
    ) < 1e-9 &&
    probabilisticControlBranches.filter(branch =>
      branch?.consumedOpportunityIds?.includes(
        'natural:resource-continuity-enemy:4',
      )
    ).reduce(
      (sum, branch) => sum + Number(branch?.probability || 0),
      0,
    ) === 0.75 &&
    probabilisticControlBranches.filter(branch =>
      !branch?.consumedOpportunityIds?.includes(
        'natural:resource-continuity-enemy:4',
      )
    ).reduce(
      (sum, branch) => sum + Number(branch?.probability || 0),
      0,
    ) === 0.25,
  { probabilisticControlPlan },
);
const longControlTargetOpportunityIds = [
  'natural:resource-continuity-enemy:4',
  'natural:resource-continuity-enemy:5',
];
const longControlTargetOpportunities =
  longControlTargetOpportunityIds.map((opportunityId, index) => ({
    opportunityId,
    ownerId: 'resource-continuity-enemy',
    round: 1,
    sequence: 4 + index,
    status: 'PENDING',
  }));
const longControlDeltaRequest = {
  visibleWorld: resourceContinuityWorld,
  actorSide: 'team_player',
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  evaluationContext: {
    opportunitySnapshot: longControlTargetOpportunities,
    scheduledEvents: [],
  },
  actionRouteCatalog: {
    'resource-continuity-enemy': {
      primaryRoute: { routeBenefitPP: 20 },
    },
  },
  candidateEnvelopeDeltas: {},
};
const deterministicLongControlEffect =
  effect('ACTION_CANCELLED', 'resource-continuity-enemy', {
    applicationProbability: 1,
    duration: 2,
  });
const deterministicLongControlDeltas = decision.r8ActionPoolDeltas?.(
  longControlDeltaRequest,
  {
    candidateId: 'resource-continuity-ally:deterministic-long-control',
    actionPoolEffects: [deterministicLongControlEffect],
  },
) || [];
const deterministicLongControlRoute = route({
  routeKey: 'route:resource-deterministic-long-control',
  candidateId: 'resource-continuity-ally:deterministic-long-control',
  routeBenefitPP: 0,
  intrinsicBehaviorUtilityHEPP: 40,
  behaviorRouteUtilityHEPP: 40,
  effects: [deterministicLongControlEffect],
  intrinsicActionPoolDeltas: deterministicLongControlDeltas,
});
const deterministicLongControlPlan =
  decision.r8BuildResourceOpportunityPlan?.({
    worldSnapshot: resourceContinuityWorld,
    actorSide: 'team_player',
    unitIds: ['resource-continuity-ally'],
    routeCatalog: {
      'resource-continuity-ally':
        decision.selectPrimaryBackupRoutes([deterministicLongControlRoute]),
    },
    fullRoutesByUnit: {
      'resource-continuity-ally': [deterministicLongControlRoute],
    },
    actionOpportunity: {
      opportunityId: 'natural:resource-continuity-actor:1',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: [
      {
        opportunityId: 'natural:resource-continuity-ally:2',
        ownerId: 'resource-continuity-ally',
        round: 1,
        sequence: 2,
        status: 'PENDING',
      },
      ...longControlTargetOpportunities,
    ],
    scheduledEvents: [],
    resourceTimeline: [],
  });
add(
  'oracle:deterministic-long-control-consumes-all-covered-opportunities-once',
  Math.abs(
    Number(deterministicLongControlPlan?.cumulativeUtilityHEPP || 0) - 40,
  ) < 1e-9 &&
    deterministicLongControlDeltas.length === 1 &&
    Number(
      deterministicLongControlDeltas[0]?.healthTrajectoryDeltaPP || 0,
    ) === 40 &&
    Number(
      deterministicLongControlDeltas[0]?.evidence
        ?.r8RealizationProbability || 0,
    ) === 1 &&
    longControlTargetOpportunityIds.every(opportunityId =>
      deterministicLongControlDeltas[0]?.evidence
        ?.coveredTargetOpportunityIds?.includes(opportunityId)
    ) &&
    longControlTargetOpportunityIds.every(opportunityId =>
      deterministicLongControlPlan?.branchPlanSummary?.[0]
        ?.consumedOpportunityIds?.includes(opportunityId)
    ) &&
    deterministicLongControlPlan?.branchPlanSummary?.[0]
      ?.consumedOpportunityIds?.length === 2,
  { deterministicLongControlPlan },
);
const probabilisticLongControlEffect =
  effect('ACTION_CANCELLED', 'resource-continuity-enemy', {
    applicationProbability: 0.5,
    duration: 2,
  });
const probabilisticLongControlDeltas = decision.r8ActionPoolDeltas?.(
  longControlDeltaRequest,
  {
    candidateId: 'resource-continuity-ally:probabilistic-long-control',
    actionPoolEffects: [probabilisticLongControlEffect],
  },
) || [];
const probabilisticLongControlRoute = route({
  routeKey: 'route:resource-probabilistic-long-control',
  candidateId: 'resource-continuity-ally:probabilistic-long-control',
  routeBenefitPP: 0,
  intrinsicBehaviorUtilityHEPP: 20,
  behaviorRouteUtilityHEPP: 20,
  effects: [probabilisticLongControlEffect],
  intrinsicActionPoolDeltas: probabilisticLongControlDeltas,
});
const probabilisticLongControlPlan =
  decision.r8BuildResourceOpportunityPlan?.({
    worldSnapshot: resourceContinuityWorld,
    actorSide: 'team_player',
    unitIds: ['resource-continuity-ally'],
    routeCatalog: {
      'resource-continuity-ally':
        decision.selectPrimaryBackupRoutes([probabilisticLongControlRoute]),
    },
    fullRoutesByUnit: {
      'resource-continuity-ally': [probabilisticLongControlRoute],
    },
    actionOpportunity: {
      opportunityId: 'natural:resource-continuity-actor:1',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: [
      {
        opportunityId: 'natural:resource-continuity-ally:2',
        ownerId: 'resource-continuity-ally',
        round: 1,
        sequence: 2,
        status: 'PENDING',
      },
      {
        opportunityId: 'natural:resource-continuity-ally:3',
        ownerId: 'resource-continuity-ally',
        round: 1,
        sequence: 3,
        status: 'PENDING',
      },
      ...longControlTargetOpportunities,
    ],
    scheduledEvents: [],
    resourceTimeline: [],
  });
const probabilisticLongControlBranches =
  probabilisticLongControlPlan?.branchPlanSummary || [];
const longControlSuccessProbability =
  probabilisticLongControlBranches
    .filter(branch =>
      longControlTargetOpportunityIds.every(opportunityId =>
        branch?.consumedOpportunityIds?.includes(opportunityId)
      )
    )
    .reduce(
      (sum, branch) => sum + Number(branch?.probability || 0),
      0,
    );
const longControlFailureProbability =
  probabilisticLongControlBranches
    .filter(branch =>
      longControlTargetOpportunityIds.every(opportunityId =>
        !branch?.consumedOpportunityIds?.includes(opportunityId)
      )
    )
    .reduce(
      (sum, branch) => sum + Number(branch?.probability || 0),
      0,
    );
add(
  'oracle:probabilistic-long-control-correlates-all-covered-opportunities',
  probabilisticLongControlPlan?.probabilisticStateUnresolved === false &&
    probabilisticLongControlPlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    probabilisticLongControlDeltas.length === 1 &&
    Math.abs(
      Number(
        probabilisticLongControlDeltas[0]?.healthTrajectoryDeltaPP || 0,
      ) - 20,
    ) < 1e-9 &&
    Math.abs(
      Number(
        probabilisticLongControlDeltas[0]?.evidence
          ?.r8RealizationProbability || 0,
      ) - 0.5,
    ) < 1e-9 &&
    Math.abs(
      Number(
        probabilisticLongControlDeltas[0]?.evidence
          ?.r8RealizedHealthTrajectoryDeltaPP || 0,
      ) - 40,
    ) < 1e-9 &&
    probabilisticLongControlPlan?.branchPlanCount === 2 &&
    Math.abs(
      Number(probabilisticLongControlPlan?.cumulativeUtilityHEPP || 0) - 30,
    ) < 1e-9 &&
    Math.abs(longControlSuccessProbability - 0.75) < 1e-9 &&
    Math.abs(longControlFailureProbability - 0.25) < 1e-9 &&
    probabilisticLongControlBranches.every(branch => {
      const consumedCount = longControlTargetOpportunityIds.filter(
        opportunityId =>
          branch?.consumedOpportunityIds?.includes(opportunityId)
      ).length;
      return consumedCount === 0 ||
        consumedCount === longControlTargetOpportunityIds.length;
    }),
  { probabilisticLongControlPlan },
);
const probabilisticStateWorld = request({ enemyHp: 100 });
const probabilisticStateSkillValue = probabilisticStateSkill(
  'probabilistic-state',
  '迟缓',
  {
    计算层效果: {
      speed_penalty: 0.5,
    },
  },
);
const probabilisticStateCandidate = {
  candidateId: 'actor:skill:probabilistic-state:0',
  declarationFingerprint: 'probabilistic-state:fingerprint',
  declaration: {
    actionId: 'actor:probabilistic-state',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: probabilisticStateSkillValue,
  },
};
const probabilisticStatePreview = preview.previewAction({
  worldSnapshot: probabilisticStateWorld.visibleWorld,
  worldRevision: 'phase7:probabilistic-state',
  actorId: 'actor',
  declaration: probabilisticStateCandidate.declaration,
  actionFingerprint: probabilisticStateCandidate.declarationFingerprint,
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const probabilisticStateRoute = decision.actionRouteFromPreview({
  candidate: probabilisticStateCandidate,
  previewResult: probabilisticStatePreview,
  worldSnapshot: probabilisticStateWorld.visibleWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'actor',
    actorSide: 'team_player',
    visibleWorld: probabilisticStateWorld.visibleWorld,
    objectiveContract: probabilisticStateWorld.objectiveContract,
  },
});
const probabilisticStateOperationProjection = operationGraphProjection(
  probabilisticStatePreview,
  probabilisticStateWorld.visibleWorld,
);
const stateBranchTargetHasState = branch => {
  const target = branch?.world?.参战者?.team_enemy?.[0];
  return target?.状态效果 &&
    Object.values(target.状态效果).some(state =>
      String(state?.状态 || state?.状态名称 || '').trim() === '迟缓',
    );
};
add(
  'oracle:preview-exposes-correlated-probabilistic-state-worlds',
  probabilisticStatePreview?.operationGraph?.outcomeGroups?.length === 1 &&
    probabilisticStateOperationProjection?.finalStates?.length === 2 &&
    Math.abs(
      probabilisticStateOperationProjection.finalStates.reduce(
        (sum, branch) => sum + Number(branch?.probability || 0),
        0,
      ) - 1
    ) < 1e-9 &&
    probabilisticStateOperationProjection.finalStates.some(
      branch =>
        Object.values(branch?.assignments || {}).includes('HIT') &&
        stateBranchTargetHasState(branch),
    ) &&
    probabilisticStateOperationProjection.finalStates.some(
      branch =>
        Object.values(branch?.assignments || {}).includes('RESISTED') &&
        !stateBranchTargetHasState(branch),
    ) &&
    probabilisticStateRoute?.operationGraph?.graphHash ===
      probabilisticStatePreview?.operationGraph?.graphHash,
  {
    operationStates:
      probabilisticStateOperationProjection?.finalStates?.map(branch => ({
        assignments: branch?.assignments,
        probability: branch?.probability,
        hasState: stateBranchTargetHasState(branch),
      })),
    outcomeGroupCount:
      probabilisticStatePreview?.operationGraph?.outcomeGroups?.length || 0,
  },
);
const probabilisticStateActionPoolEffect =
  probabilisticStateRoute?.actionPoolEffects?.[0] || null;
const probabilisticStatePlannerRoute = {
  ...probabilisticStateRoute,
  routeKey: 'route:probabilistic-state-planner',
  intrinsicActionPoolDeltas: probabilisticStateActionPoolEffect
    ? [{
        ...probabilisticStateActionPoolEffect,
        ownerType: 'ACTION_POOL_DELTA',
        realizable: true,
        healthTrajectoryDeltaPP: 20,
        evidence: {
          ...(probabilisticStateActionPoolEffect.evidence || {}),
          r8RealizationProbability: 0.5,
          r8RealizedHealthTrajectoryDeltaPP: 40,
        },
      }]
    : [],
};
const probabilisticStatePlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: probabilisticStateWorld.visibleWorld,
  actorSide: 'team_player',
  unitIds: ['actor'],
  routeCatalog: {
    actor: decision.selectPrimaryBackupRoutes([
      probabilisticStatePlannerRoute,
    ]),
  },
  fullRoutesByUnit: {
    actor: [probabilisticStatePlannerRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [
    {
      opportunityId: 'natural:actor:2',
      ownerId: 'actor',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    },
    {
      opportunityId: 'natural:enemy:3',
      ownerId: 'enemy',
      round: 1,
      sequence: 3,
      status: 'PENDING',
    },
  ],
  scheduledEvents: [],
  resourceTimeline: [],
});
const statePlanStateHashes = (probabilisticStatePlan?.branchPlanSummary || [])
  .map(branch => ({
    probability: Number(branch?.probability || 0),
    stateHash: String(branch?.worldStateHash || ''),
  }));
add(
  'oracle:probabilistic-state-branch-enters-resource-plan-as-real-world',
  probabilisticStatePlan?.probabilisticStateUnresolved === false &&
    probabilisticStatePlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    probabilisticStatePlan?.branchPlanCount === 2 &&
    Math.abs(
      Number(probabilisticStatePlan?.cumulativeUtilityHEPP || 0) - 20,
    ) < 1e-9 &&
    (probabilisticStatePlan?.branchPlanSummary || []).every(branch =>
      Number(branch?.probability || 0) > 0
    ) &&
    new Set(statePlanStateHashes.map(entry => entry.stateHash)).size === 2,
  {
    probabilisticStatePlan,
    statePlanStateHashes,
    route: {
      probabilityStateBranches:
        probabilisticStatePlannerRoute.probabilityStateBranches,
      probabilityFactors: probabilisticStatePlannerRoute.probabilityFactors,
      intrinsicActionPoolDeltas:
        probabilisticStatePlannerRoute.intrinsicActionPoolDeltas,
    },
  },
);
const probabilisticStateRefreshWorld = structuredClone(
  probabilisticStateWorld.visibleWorld,
);
probabilisticStateRefreshWorld.参战者.team_enemy[0].状态效果 = {
  'existing:迟缓': {
    状态: '迟缓',
    状态名称: '迟缓',
    duration: 1,
    战斗效果: {
      speed_penalty: 0.5,
    },
  },
};
const probabilisticStateRefreshSkill = probabilisticStateSkill(
  'probabilistic-state-refresh',
  '迟缓',
  {
    刷新: true,
    计算层效果: {
      speed_penalty: 0.5,
    },
  },
);
const probabilisticStateRefreshCandidate = {
  candidateId: 'actor:skill:probabilistic-state-refresh:0',
  declarationFingerprint: 'probabilistic-state-refresh:fingerprint',
  declaration: {
    actionId: 'actor:probabilistic-state-refresh',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: probabilisticStateRefreshSkill,
  },
};
const probabilisticStateRefreshPreview = preview.previewAction({
  worldSnapshot: probabilisticStateRefreshWorld,
  worldRevision: 'phase7:probabilistic-state-refresh',
  actorId: 'actor',
  declaration: probabilisticStateRefreshCandidate.declaration,
  actionFingerprint: probabilisticStateRefreshCandidate.declarationFingerprint,
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const probabilisticStateRefreshRoute = decision.actionRouteFromPreview({
  candidate: probabilisticStateRefreshCandidate,
  previewResult: probabilisticStateRefreshPreview,
  worldSnapshot: probabilisticStateRefreshWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'actor',
    actorSide: 'team_player',
    visibleWorld: probabilisticStateRefreshWorld,
    objectiveContract: probabilisticStateWorld.胜负条件,
  },
});
const probabilisticStateRefreshProjection = operationGraphProjection(
  probabilisticStateRefreshPreview,
  probabilisticStateRefreshWorld,
);
const refreshBranchState = (branch, stateKey) =>
  branch?.world?.参战者?.team_enemy?.[0]?.状态效果?.[stateKey] || null;
const refreshHitBranch =
  probabilisticStateRefreshProjection?.finalStates?.find(branch =>
    Object.values(branch?.assignments || {}).includes('HIT')
  );
const refreshResistedBranch =
  probabilisticStateRefreshProjection?.finalStates?.find(branch =>
    Object.values(branch?.assignments || {}).includes('RESISTED')
  );
add(
  'oracle:probabilistic-state-refresh-uses-state-diff-not-preview-key-only',
  probabilisticStateRefreshProjection?.finalStates?.length === 2 &&
    Number(
      refreshBranchState(refreshHitBranch, 'existing:迟缓')?.duration || 0,
    ) === 2 &&
    Number(
      refreshBranchState(refreshResistedBranch, 'existing:迟缓')?.duration || 0,
    ) === 1 &&
    Object.keys(
      refreshHitBranch?.world?.参战者?.team_enemy?.[0]?.状态效果 || {},
    ).length === 1 &&
    Object.keys(
      refreshResistedBranch?.world?.参战者?.team_enemy?.[0]?.状态效果 || {},
    ).length === 1 &&
    probabilisticStateRefreshRoute?.operationGraph?.graphHash ===
      probabilisticStateRefreshPreview?.operationGraph?.graphHash,
  {
    hitStates:
      refreshHitBranch?.world?.参战者?.team_enemy?.[0]?.状态效果,
    resistedStates:
      refreshResistedBranch?.world?.参战者?.team_enemy?.[0]?.状态效果,
    outcomeGroupCount:
      probabilisticStateRefreshPreview?.operationGraph?.outcomeGroups?.length ||
      0,
  },
);
const probabilisticStateOverlapWorld = structuredClone(
  probabilisticStateWorld.visibleWorld,
);
probabilisticStateOverlapWorld.参战者.team_enemy[0].状态效果 = {
  'existing:迟缓': {
    状态: '迟缓',
    状态名称: '迟缓',
    duration: 2,
    战斗效果: {
      speed_penalty: 0.5,
    },
  },
};
const probabilisticStateOverlapCandidate = {
  candidateId: 'actor:skill:probabilistic-state-overlap:0',
  declarationFingerprint: 'probabilistic-state-overlap:fingerprint',
  declaration: {
    actionId: 'actor:probabilistic-state-overlap',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy'],
    skill: probabilisticStateSkill(
      'probabilistic-state-overlap',
      '迟缓',
      {
        计算层效果: {
          speed_penalty: 0.5,
        },
      },
    ),
  },
};
const probabilisticStateOverlapPreview = preview.previewAction({
  worldSnapshot: probabilisticStateOverlapWorld,
  worldRevision: 'phase7:probabilistic-state-overlap',
  actorId: 'actor',
  declaration: probabilisticStateOverlapCandidate.declaration,
  actionFingerprint: probabilisticStateOverlapCandidate.declarationFingerprint,
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const probabilisticStateOverlapRoute = decision.actionRouteFromPreview({
  candidate: probabilisticStateOverlapCandidate,
  previewResult: probabilisticStateOverlapPreview,
  worldSnapshot: probabilisticStateOverlapWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'actor',
    actorSide: 'team_player',
    visibleWorld: probabilisticStateOverlapWorld,
    objectiveContract: probabilisticStateWorld.胜负条件,
  },
});
add(
  'oracle:equal-nonrefreshable-state-overlap-has-zero-marginal',
  probabilisticStateOverlapPreview?.operationGraph?.outcomeGroups?.length === 0 &&
    probabilisticStateOverlapPreview?.operationGraph?.conditionalEvents?.length ===
      0 &&
    probabilisticStateOverlapRoute?.operationGraph?.outcomeGroups?.length === 0 &&
    !probabilisticStateOverlapRoute?.actionPoolEffects?.some(effectEntry =>
      Math.abs(Number(effectEntry?.evidence?.r8HealthTrajectoryDeltaPP || 0)) >
        1e-9
    ),
  {
    previewContributions: probabilisticStateOverlapPreview?.contributions,
    actionPoolEffects: probabilisticStateOverlapRoute?.actionPoolEffects,
    operationGraph: probabilisticStateOverlapPreview?.operationGraph,
  },
);
const probabilisticStateDotPreview = preview.previewAction({
  worldSnapshot: probabilisticStateWorld.visibleWorld,
  worldRevision: 'phase7:probabilistic-state-dot',
  actorId: 'actor',
  declaration: {
    ...probabilisticStateCandidate.declaration,
    actionId: 'actor:probabilistic-state-dot',
    skill: probabilisticStateSkill(
      'probabilistic-state-dot',
      '中毒',
      {
        计算层效果: {
          dot_damage: 5,
        },
      },
    ),
  },
  actionFingerprint: 'probabilistic-state-dot:fingerprint',
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const probabilisticStateDotRoute = decision.actionRouteFromPreview({
  candidate: {
    ...probabilisticStateCandidate,
    candidateId: 'actor:skill:probabilistic-state-dot:0',
    declarationFingerprint: 'probabilistic-state-dot:fingerprint',
    declaration: {
      ...probabilisticStateCandidate.declaration,
      actionId: 'actor:probabilistic-state-dot',
      skill: probabilisticStateSkill(
        'probabilistic-state-dot',
        '中毒',
        {
          计算层效果: {
            dot_damage: 5,
          },
        },
      ),
    },
  },
  previewResult: probabilisticStateDotPreview,
  worldSnapshot: probabilisticStateWorld.visibleWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'actor',
    actorSide: 'team_player',
    visibleWorld: probabilisticStateWorld.visibleWorld,
    objectiveContract: probabilisticStateWorld.objectiveContract,
  },
});
const probabilisticStateDotPlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: probabilisticStateWorld.visibleWorld,
  actorSide: 'team_player',
  unitIds: ['actor'],
  routeCatalog: {
    actor: decision.selectPrimaryBackupRoutes([
      probabilisticStateDotRoute,
    ]),
  },
  fullRoutesByUnit: {
    actor: [probabilisticStateDotRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:actor:1:dot',
    ownerId: 'actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:actor:2:dot',
    ownerId: 'actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  resourceTimeline: [],
});
const probabilisticStateDotProjection = operationGraphProjection(
  probabilisticStateDotPreview,
  probabilisticStateWorld.visibleWorld,
);
add(
  'oracle:probabilistic-state-and-dot-share-correlated-world-branches',
  probabilisticStateDotPreview?.operationGraph?.outcomeGroups?.length === 1 &&
    probabilisticStateDotProjection?.finalStates?.length === 2 &&
    probabilisticStateDotRoute?.operationGraph?.graphHash ===
      probabilisticStateDotPreview?.operationGraph?.graphHash &&
    probabilisticStateDotRoute?.probabilityFactors?.some(factor =>
      factor?.outcomeKind === 'STATE_CHANGED'
    ) &&
    probabilisticStateDotRoute?.healthTrajectoryByTarget?.some(trajectory =>
      trajectory?.outcomeKind === 'SCHEDULED_HP_DELTA'
    ) &&
    probabilisticStateDotPlan?.probabilisticStateUnresolved === false &&
    probabilisticStateDotPlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    probabilisticStateDotPlan?.branchPlanCount === 2 &&
    Math.abs(
      Number(probabilisticStateDotPlan?.cumulativeUtilityHEPP || 0) - 5,
    ) < 1e-9 &&
    probabilisticStateDotPlan?.branchPlanSummary?.some(branch =>
      Number(branch?.finalHpByUnit?.enemy || 0) === 90 &&
      Math.abs(Number(branch?.probability || 0) - 0.5) < 1e-9
    ) &&
    probabilisticStateDotPlan?.branchPlanSummary?.some(branch =>
      Number(branch?.finalHpByUnit?.enemy || 0) === 100 &&
      Math.abs(Number(branch?.probability || 0) - 0.5) < 1e-9
  ),
  {
    operationStateCount:
      probabilisticStateDotProjection?.finalStates?.length || 0,
    operationGraph: probabilisticStateDotPreview?.operationGraph,
    probabilityFactors: probabilisticStateDotRoute?.probabilityFactors,
    healthTrajectoryByTarget:
      probabilisticStateDotRoute?.healthTrajectoryByTarget,
    probabilisticStateDotPlan,
  },
);
const scheduledDotTickKeys = [
  ...new Set(
    (probabilisticStateDotRoute?.healthTrajectoryByTarget || [])
      .map(trajectory => String(trajectory?.scheduledEventId || '').trim())
      .filter(Boolean),
  ),
];
add(
  'oracle:scheduled-dot-expands-to-independent-realization-windows',
  probabilisticStateDotRoute?.healthTrajectoryByTarget?.length === 2 &&
    scheduledDotTickKeys.length === 2 &&
    (probabilisticStateDotRoute?.healthTrajectoryByTarget || []).every(
      trajectory =>
        Number(trajectory?.tickCount || 0) === 2 &&
        Number(trajectory?.tickIndex || 0) >= 1 &&
        Number(trajectory?.tickIndex || 0) <= 2 &&
        String(trajectory?.windowId || '').includes(':tick:'),
    ),
  {
    trajectoryCount:
      probabilisticStateDotRoute?.healthTrajectoryByTarget?.length || 0,
    scheduledDotTickKeys,
    trajectories: probabilisticStateDotRoute?.healthTrajectoryByTarget,
  },
);
const terminalAfterSecondDotTick = decision.r8TerminalUtility(
  request({
    enemyHp: 15,
    objective: objective('TEAM_INCAPACITATED'),
  }),
  route({
    routeKey: 'route:dot-terminal-after-second-tick',
    candidateId: 'dot-terminal-after-second-tick',
    health: [
      hp('enemy', -10, 'dot:tick:1', 'SCHEDULED_HP_DELTA', 'dot:tick:1'),
      hp('enemy', -10, 'dot:tick:2', 'SCHEDULED_HP_DELTA', 'dot:tick:2'),
      hp('enemy', -10, 'dot:tick:3', 'SCHEDULED_HP_DELTA', 'dot:tick:3'),
    ],
  }),
);
add(
  'oracle:scheduled-dot-stops-after-first-terminal-tick',
  terminalAfterSecondDotTick?.terminal === true &&
    terminalAfterSecondDotTick?.status === 'PLAYER_WIN' &&
    String(
      terminalAfterSecondDotTick?.terminalPaths?.[0]?.terminalAtomicKey || '',
    ).includes('dot:tick:2') &&
    Number(terminalAfterSecondDotTick?.expectedDiscardedOverkillPP || 0) === 0,
  {
    terminalAfterSecondDotTick,
  },
);
const repeatedDotRoute = route({
  routeKey: 'route:resource-repeated-dot-window',
  candidateId: 'resource-continuity-ally:repeated-dot-window',
  routeBenefitPP: 10,
  health: [{
    ...hp(
      'resource-continuity-enemy',
      -10,
      'resource-repeated-dot',
      'SCHEDULED_HP_DELTA',
      'tick:resource-repeated-dot:1',
    ),
    actorBenefitPP: 10,
    scheduledEventId: 'tick:resource-repeated-dot:1',
  }],
});
const repeatedDotPlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: resourceContinuityWorld,
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally':
      decision.selectPrimaryBackupRoutes([repeatedDotRoute]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [repeatedDotRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: resourceContinuityOpportunities.slice(0, 2),
  scheduledEvents: [],
  resourceTimeline: [],
});
add(
  'oracle:resource-plan-does-not-realize-the-same-scheduled-dot-tick-twice',
  Number(
    repeatedDotPlan?.finalHpByUnit?.['resource-continuity-enemy'],
  ) === 90 &&
    repeatedDotPlan?.consumedHealthWindowKeys?.includes(
      'health-window:tick:resource-repeated-dot:1',
    ) &&
    repeatedDotPlan?.rows?.filter(row =>
      Number(row?.routeUtilityHEPP || 0) > 1e-9
    ).length === 1,
  { repeatedDotPlan },
);
const repeatedSummonRoute = route({
  routeKey: 'route:resource-repeated-summon-window',
  candidateId: 'resource-continuity-ally:repeated-summon-window',
  routeBenefitPP: 0,
  intrinsicBehaviorUtilityHEPP: 15,
  behaviorRouteUtilityHEPP: 15,
  effects: [effect('SUMMON_WINDOW', 'resource-summon-instance', {
    summonInstanceId: 'resource-summon-instance',
    remainingWindows: 1,
  })],
  intrinsicActionPoolDeltas: [{
    ...effect('SUMMON_WINDOW', 'resource-summon-instance', {
      summonInstanceId: 'resource-summon-instance',
      remainingWindows: 1,
    }),
    ownerType: 'ACTION_POOL_DELTA',
    realizable: true,
    healthTrajectoryDeltaPP: 15,
  }],
});
const repeatedSummonPlan = decision.r8BuildResourceOpportunityPlan?.({
  worldSnapshot: resourceContinuityWorld,
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally':
      decision.selectPrimaryBackupRoutes([repeatedSummonRoute]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [repeatedSummonRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: resourceContinuityOpportunities.slice(0, 2),
  scheduledEvents: [],
  resourceTimeline: [],
});
add(
  'oracle:resource-plan-reuses-the-same-summon-instance-window-idempotently',
  Math.abs(
    Number(repeatedSummonPlan?.cumulativeUtilityHEPP || 0) - 15,
  ) < 1e-9 &&
    repeatedSummonPlan?.consumedBehaviorKeys?.includes(
      'summon-window:resource-summon-instance',
    ) &&
    repeatedSummonPlan?.rows?.filter(row =>
      Number(row?.routeUtilityHEPP || 0) > 1e-9
    ).length === 1,
  { repeatedSummonPlan },
);
const resourceOrderBase = {
  worldSnapshot: structuredClone(resourceContinuityWorld),
  actorSide: 'team_player',
  unitIds: ['resource-continuity-ally'],
  routeCatalog: {
    'resource-continuity-ally': {
      primaryRoute: resourceContinuityHigh,
      backupRoute: resourceContinuityFree,
    },
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [
      resourceContinuityHigh,
      resourceContinuityFree,
    ],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-continuity-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [resourceContinuityOpportunities[0]],
  scheduledEvents: [],
};
resourceOrderBase.worldSnapshot.参战者.team_player[1].属性.魂力 = 50;
resourceOrderBase.worldSnapshot.参战者.team_player[1].sp = 50;
const restoreBeforePayPlan = decision.r8BuildResourceOpportunityPlan?.({
  ...resourceOrderBase,
  resourceTimeline: [{
    eventId: 'restore-before-pay',
    actorId: 'resource-continuity-ally',
    resource: '魂力',
    delta: 20,
    operation: 'RESTORE',
    round: 1,
    opportunitySequence: 2,
    actionSequence: 0,
    phasePriority: 10,
    effectSequence: 1,
  }],
});
const restoreAfterPayPlan = decision.r8BuildResourceOpportunityPlan?.({
  ...resourceOrderBase,
  resourceTimeline: [{
    eventId: 'restore-after-pay',
    actorId: 'resource-continuity-ally',
    resource: '魂力',
    delta: 20,
    operation: 'RESTORE',
    round: 1,
    opportunitySequence: 2,
    actionSequence: 2,
    phasePriority: 10,
    effectSequence: 1,
  }],
});
const lockedPaymentPlan = decision.r8BuildResourceOpportunityPlan?.({
  ...resourceOrderBase,
  resourceTimeline: [{
    eventId: 'lock-before-pay',
    actorId: 'resource-continuity-ally',
    resource: '魂力',
    delta: 0,
    operation: 'LOCK',
    round: 1,
    opportunitySequence: 2,
    actionSequence: 0,
    phasePriority: 35,
    effectSequence: 1,
  }],
});
add(
  'oracle:resource-opportunity-plan-respects-restore-payment-order-and-lock',
  restoreBeforePayPlan?.rows?.[0]?.selectedRouteKey ===
      'route:resource-continuity-high' &&
    restoreAfterPayPlan?.rows?.[0]?.selectedRouteKey ===
      'route:resource-continuity-free' &&
    lockedPaymentPlan?.rows?.[0]?.selectedRouteKey ===
      'route:resource-continuity-free',
  {
    restoreBeforePayPlan,
    restoreAfterPayPlan,
    lockedPaymentPlan,
  },
);

const indirectControlRoute = route({
  routeKey: 'route:indirect-control',
  candidateId: 'resource-continuity-ally:indirect-control',
  objectiveRouteUtilityHEPP: 0,
  intrinsicBehaviorUtilityHEPP: 20,
  behaviorRouteUtilityHEPP: 20,
  paymentDependencies: [{
    unitId: 'resource-continuity-ally',
    resource: '魂力',
    amount: 60,
  }],
});
const directAttackRoute = route({
  routeKey: 'route:direct-attack',
  candidateId: 'resource-continuity-ally:direct-attack',
  objectiveRouteUtilityHEPP: 5,
  intrinsicBehaviorUtilityHEPP: 5,
  behaviorRouteUtilityHEPP: 5,
  routeBenefitPP: 5,
  health: [hp('resource-continuity-enemy', -5, 'direct-attack')],
});
const indirectResourcePlan = decision.r8BuildResourceOpportunityPlan?.({
  ...resourceOrderBase,
  worldSnapshot: structuredClone(resourceContinuityWorld),
  routeCatalog: {
    'resource-continuity-ally': decision.selectPrimaryBackupRoutes([
      directAttackRoute,
      indirectControlRoute,
    ]),
  },
  fullRoutesByUnit: {
    'resource-continuity-ally': [
      directAttackRoute,
      indirectControlRoute,
    ],
  },
  opportunitySnapshot: [resourceContinuityOpportunities[0]],
  resourceTimeline: [],
});
const forwardBehaviorEnvelope = decision.selectPrimaryBackupRoutes([
  directAttackRoute,
  indirectControlRoute,
]);
const reverseBehaviorEnvelope = decision.selectPrimaryBackupRoutes([
  indirectControlRoute,
  directAttackRoute,
]);
add(
  'oracle:resource-plan-uses-full-indirect-behavior-route-value',
  indirectResourcePlan?.rows?.[0]?.selectedRouteKey ===
    'route:indirect-control',
  { indirectResourcePlan },
);

const paidEnvelopeWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('paid-envelope-actor', 'player', 100),
      unit('paid-envelope-ally', 'player', 100),
    ],
    team_enemy: [unit('paid-envelope-enemy', 'enemy', 100)],
  },
};
paidEnvelopeWorld.参战者.team_player[0].sp = 100;
paidEnvelopeWorld.参战者.team_player[0].属性.魂力 = 100;
paidEnvelopeWorld.参战者.team_player[1].sp = 100;
paidEnvelopeWorld.参战者.team_player[1].属性.魂力 = 100;
const paidEnvelopeOpportunities = [{
  opportunityId: 'natural:paid-envelope-ally:2',
  ownerId: 'paid-envelope-ally',
  round: 1,
  sequence: 2,
  status: 'PENDING',
}];
const paidEnvelopeHighRoute = route({
  routeKey: 'route:paid-envelope-high',
  candidateId: 'paid-envelope-ally:high',
  behaviorRouteUtilityHEPP: 30,
  paymentDependencies: [{
    unitId: 'paid-envelope-ally',
    resource: '魂力',
    amount: 60,
  }],
  health: [hp('paid-envelope-enemy', -30, 'paid-envelope-high')],
});
const paidEnvelopeFallbackRoute = route({
  routeKey: 'route:paid-envelope-fallback',
  candidateId: 'paid-envelope-ally:fallback',
  behaviorRouteUtilityHEPP: 2,
  health: [hp('paid-envelope-enemy', -2, 'paid-envelope-fallback')],
});
const paidEnvelopeRouteCatalog = {
  'paid-envelope-ally': decision.selectPrimaryBackupRoutes([
    paidEnvelopeHighRoute,
    paidEnvelopeFallbackRoute,
  ]),
};
const paidEnvelopeFullRoutes = {
  'paid-envelope-ally': [
    paidEnvelopeHighRoute,
    paidEnvelopeFallbackRoute,
  ],
};
const paidEnvelopeCandidate = route({
  routeKey: 'route:paid-envelope-current-action',
  candidateId: 'paid-envelope-actor:current-action',
  effects: [{
    rootActionId: 'paid-envelope-actor:current-action',
    effectInstanceId: 'paid-envelope-cost',
    targetId: 'paid-envelope-ally',
    outcomeKind: 'RESOURCE_OPTION_CHANGED',
    windowId: 'ACTION_COST',
    expectedDelta: -80,
    evidence: {
      resource: '魂力',
      delta: -80,
    },
  }],
});
const paidEnvelopeProjectedWorld = structuredClone(paidEnvelopeWorld);
paidEnvelopeProjectedWorld.参战者.team_player[1].sp = 20;
paidEnvelopeProjectedWorld.参战者.team_player[1].属性.魂力 = 20;
const paidEnvelopeDeltas = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: paidEnvelopeWorld,
  projectedWorlds: {
    [paidEnvelopeCandidate.candidateId]: paidEnvelopeProjectedWorld,
  },
  projectedWorldRevisions: {
    [paidEnvelopeCandidate.candidateId]: 'paid-envelope-after-cost',
  },
  routeCatalog: paidEnvelopeRouteCatalog,
  candidateRoutes: {
    [paidEnvelopeCandidate.candidateId]: paidEnvelopeCandidate,
  },
  fullRoutesByUnit: paidEnvelopeFullRoutes,
  actorSide: 'team_player',
  actionOpportunity: {
    opportunityId: 'natural:paid-envelope-actor:1',
    ownerId: 'paid-envelope-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: paidEnvelopeOpportunities,
  scheduledEvents: [],
  resourceTimeline: [],
  objectiveContract: paidEnvelopeWorld.胜负条件,
});
const paidEnvelopeDeltaRows = paidEnvelopeDeltas[paidEnvelopeCandidate.candidateId] || [];
const paidEnvelopeResourceDelta = paidEnvelopeDeltaRows.find(row =>
  row?.targetId === 'paid-envelope-ally'
);
const paidEnvelopePaymentChecks = {
  hasRow: !!paidEnvelopeResourceDelta,
  beforeRoute:
    paidEnvelopeResourceDelta?.beforeRouteKey === 'route:paid-envelope-high',
  afterSelectedRoute:
    paidEnvelopeResourceDelta?.resourceOpportunityCandidate?.rows?.[0]?.selectedRouteKey ===
      'route:paid-envelope-fallback',
  negativeDelta:
    Number(paidEnvelopeResourceDelta?.healthTrajectoryDeltaPP || 0) < 0,
  singleOwnedDelta:
    Math.abs(Number(paidEnvelopeResourceDelta?.healthTrajectoryDeltaPP || 0) + 28) < 1e-9,
  affordabilityProjection:
    paidEnvelopeResourceDelta?.resourceOpportunityCandidate?.rows?.[0]?.projectionMode ===
      'RESOURCE_AFFORDABILITY_ENVELOPE',
  nonResourceHpNotReplayed:
    paidEnvelopeResourceDelta?.resourceOpportunityCandidate?.rows?.[0]?.hpAfter?.[
      'paid-envelope-enemy'
    ] === 100,
  resource:
    paidEnvelopeCandidate.actionPoolEffects?.[0]?.evidence?.resource === '魂力',
};
add(
  'oracle:current-action-payment-enters-future-resource-envelope-once',
  Object.values(paidEnvelopePaymentChecks).every(Boolean),
  {
    baselineResources: { 'paid-envelope-ally': 100 },
    projectedResources: { 'paid-envelope-ally': 20 },
    expectedSingleOwnedDelta: -28,
    rejectedDuplicateDelta: -56,
    paymentChecks: paidEnvelopePaymentChecks,
    paidEnvelopeDeltaRows,
    paidEnvelopeResourceDelta,
  },
);

const paidEnvelopeEquivalentRoute = route({
  routeKey: 'route:paid-envelope-equivalent-lower',
  candidateId: 'paid-envelope-ally:equivalent-lower',
  behaviorRouteUtilityHEPP: 12,
  paymentDependencies: [{
    unitId: 'paid-envelope-ally',
    resource: '魂力',
    amount: 60,
  }],
  health: [hp('paid-envelope-enemy', -12, 'paid-envelope-equivalent-lower')],
});
decision.resetMetrics();
const paidEnvelopeGroupedPlan = decision.r8BuildResourceOpportunityPlan({
  worldSnapshot: structuredClone(paidEnvelopeWorld),
  actorSide: 'team_player',
  unitIds: ['paid-envelope-ally'],
  projectionScope: 'RESOURCE_AFFORDABILITY',
  routeCatalog: {
    'paid-envelope-ally': decision.selectPrimaryBackupRoutes([
      paidEnvelopeHighRoute,
      paidEnvelopeEquivalentRoute,
      paidEnvelopeFallbackRoute,
    ]),
  },
  fullRoutesByUnit: {
    'paid-envelope-ally': [
      paidEnvelopeHighRoute,
      paidEnvelopeEquivalentRoute,
      paidEnvelopeFallbackRoute,
    ],
  },
  actionOpportunity: {
    opportunityId: 'natural:paid-envelope-actor:1',
    ownerId: 'paid-envelope-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: paidEnvelopeOpportunities,
  scheduledEvents: [],
  resourceTimeline: [],
  objectiveContract: paidEnvelopeWorld.胜负条件,
});
const paidEnvelopeGroupedMetrics = decision.readMetrics();
add(
  'oracle:resource-affordability-groups-identical-payment-terminal-routes-without-changing-choice',
  paidEnvelopeGroupedPlan?.rows?.[0]?.selectedRouteKey ===
    'route:paid-envelope-high' &&
    Number(
      paidEnvelopeGroupedMetrics?.resourceAffordabilityRouteElidedCount || 0,
    ) >= 1,
  {
    selectedRouteKey:
      paidEnvelopeGroupedPlan?.rows?.[0]?.selectedRouteKey || '',
    metrics: paidEnvelopeGroupedMetrics,
  },
);

const paidEnvelopeDifferentPaymentWorld = structuredClone(paidEnvelopeWorld);
paidEnvelopeDifferentPaymentWorld.参战者.team_player[1].sp = 50;
paidEnvelopeDifferentPaymentWorld.参战者.team_player[1].属性.魂力 = 50;
const paidEnvelopeAffordableMidRoute = route({
  routeKey: 'route:paid-envelope-affordable-mid',
  candidateId: 'paid-envelope-ally:affordable-mid',
  behaviorRouteUtilityHEPP: 20,
  paymentDependencies: [{
    unitId: 'paid-envelope-ally',
    resource: '魂力',
    amount: 40,
  }],
  health: [hp('paid-envelope-enemy', -20, 'paid-envelope-affordable-mid')],
});
const paidEnvelopeDifferentPaymentPlan =
  decision.r8BuildResourceOpportunityPlan({
    worldSnapshot: paidEnvelopeDifferentPaymentWorld,
    actorSide: 'team_player',
    unitIds: ['paid-envelope-ally'],
    projectionScope: 'RESOURCE_AFFORDABILITY',
    routeCatalog: {
      'paid-envelope-ally': decision.selectPrimaryBackupRoutes([
        paidEnvelopeHighRoute,
        paidEnvelopeAffordableMidRoute,
        paidEnvelopeFallbackRoute,
      ]),
    },
    fullRoutesByUnit: {
      'paid-envelope-ally': [
        paidEnvelopeHighRoute,
        paidEnvelopeAffordableMidRoute,
        paidEnvelopeFallbackRoute,
      ],
    },
    actionOpportunity: {
      opportunityId: 'natural:paid-envelope-actor:1',
      ownerId: 'paid-envelope-actor',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: paidEnvelopeOpportunities,
    scheduledEvents: [],
    resourceTimeline: [],
    objectiveContract: paidEnvelopeWorld.胜负条件,
  });
add(
  'oracle:resource-affordability-never-merges-different-payment-vectors',
  paidEnvelopeDifferentPaymentPlan?.rows?.[0]?.selectedRouteKey ===
    'route:paid-envelope-affordable-mid',
  {
    selectedRouteKey:
      paidEnvelopeDifferentPaymentPlan?.rows?.[0]?.selectedRouteKey || '',
    plan: paidEnvelopeDifferentPaymentPlan,
  },
);

const envelopePhaseCache = new Map();
const envelopePhaseMetrics = () => ({
  rebuildSourceOutcomeCounts: {},
  zeroDeltaSourceOutcomeCounts: {},
  targetPressureAudits: [],
  resourceOpportunityAudits: [],
});
const envelopePhaseMetricsWithHealth = envelopePhaseMetrics();
const envelopePhaseMetricsWithoutHealth = envelopePhaseMetrics();
const envelopePhaseInput = {
  worldSnapshot: paidEnvelopeWorld,
  projectedWorlds: {
    [paidEnvelopeCandidate.candidateId]: paidEnvelopeProjectedWorld,
  },
  projectedWorldRevisions: {
    [paidEnvelopeCandidate.candidateId]: 'paid-envelope-after-cost',
  },
  routeCatalog: paidEnvelopeRouteCatalog,
  candidateRoutes: {
    [paidEnvelopeCandidate.candidateId]: paidEnvelopeCandidate,
  },
  fullRoutesByUnit: paidEnvelopeFullRoutes,
  actorSide: 'team_player',
  actionOpportunity: {
    opportunityId: 'natural:paid-envelope-actor:1',
    ownerId: 'paid-envelope-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: paidEnvelopeOpportunities,
  scheduledEvents: [],
  resourceTimeline: [],
  objectiveContract: paidEnvelopeWorld.胜负条件,
  includedEffectOutcomeKinds: ['RESOURCE_OPTION_CHANGED'],
  envelopeSemanticCache: envelopePhaseCache,
};
const envelopePhaseWithHealth = decision.buildR8CandidateEnvelopeDeltas({
  ...envelopePhaseInput,
  includeHealthTrajectories: true,
  metrics: envelopePhaseMetricsWithHealth,
});
const envelopePhaseCacheSizeAfterFirst = envelopePhaseCache.size;
const envelopePhaseWithoutHealth = decision.buildR8CandidateEnvelopeDeltas({
  ...envelopePhaseInput,
  includeHealthTrajectories: false,
  metrics: envelopePhaseMetricsWithoutHealth,
});
add(
  'oracle:envelope-cache-isolated-by-valuation-phase',
  envelopePhaseCacheSizeAfterFirst > 0 &&
    envelopePhaseCache.size > envelopePhaseCacheSizeAfterFirst &&
    Number(envelopePhaseMetricsWithHealth.envelopeSemanticCacheMisses || 0) >
      0 &&
    Number(
      envelopePhaseMetricsWithoutHealth.envelopeSemanticCacheMisses || 0,
    ) > 0 &&
    preview.stableHash(envelopePhaseWithHealth) ===
      preview.stableHash(envelopePhaseWithoutHealth),
  {
    cacheSizeAfterFirst: envelopePhaseCacheSizeAfterFirst,
    cacheSizeAfterSecond: envelopePhaseCache.size,
    withHealthMetrics: envelopePhaseMetricsWithHealth,
    withoutHealthMetrics: envelopePhaseMetricsWithoutHealth,
    withHealthHash: preview.stableHash(envelopePhaseWithHealth),
    withoutHealthHash: preview.stableHash(envelopePhaseWithoutHealth),
  },
);

const crossUnitPaymentWorld = {
  回合: 1,
  胜负条件: objective('ROUND_REACHED'),
  参战者: {
    team_player: [
      unit('cross-payment-actor', 'player', 100),
      unit('cross-payment-payer', 'player', 100),
    ],
    team_enemy: [unit('cross-payment-enemy', 'enemy', 100)],
  },
};
crossUnitPaymentWorld.参战者.team_player[0].sp = 100;
crossUnitPaymentWorld.参战者.team_player[0].属性.魂力 = 100;
crossUnitPaymentWorld.参战者.team_player[1].sp = 100;
crossUnitPaymentWorld.参战者.team_player[1].属性.魂力 = 100;
const crossUnitHighRoute = route({
  routeKey: 'route:cross-payment-high',
  candidateId: 'cross-payment-actor:high',
  behaviorRouteUtilityHEPP: 30,
  paymentDependencies: [{
    unitId: 'cross-payment-payer',
    resource: '魂力',
    amount: 60,
  }],
  health: [hp('cross-payment-enemy', -30, 'cross-payment-high')],
});
const crossUnitFallbackRoute = route({
  routeKey: 'route:cross-payment-fallback',
  candidateId: 'cross-payment-actor:fallback',
  behaviorRouteUtilityHEPP: 2,
  health: [hp('cross-payment-enemy', -2, 'cross-payment-fallback')],
});
const crossUnitRouteCatalog = {
  'cross-payment-actor': decision.selectPrimaryBackupRoutes([
    crossUnitHighRoute,
    crossUnitFallbackRoute,
  ]),
};
const crossUnitFullRoutes = {
  'cross-payment-actor': [
    crossUnitHighRoute,
    crossUnitFallbackRoute,
  ],
};
const crossUnitCurrentRoute = route({
  routeKey: 'route:cross-payment-current',
  candidateId: 'cross-payment-actor:current-action',
  effects: [{
    rootActionId: 'cross-payment-actor:current-action',
    effectInstanceId: 'cross-payment-cost',
    targetId: 'cross-payment-payer',
    outcomeKind: 'RESOURCE_OPTION_CHANGED',
    windowId: 'ACTION_COST',
    expectedDelta: -80,
    evidence: {
      resource: '魂力',
      delta: -80,
    },
  }],
});
const crossUnitProjectedWorld = structuredClone(crossUnitPaymentWorld);
crossUnitProjectedWorld.参战者.team_player[1].sp = 20;
crossUnitProjectedWorld.参战者.team_player[1].属性.魂力 = 20;
const crossUnitEnvelopeDeltas = decision.buildR8CandidateEnvelopeDeltas({
  worldSnapshot: crossUnitPaymentWorld,
  projectedWorlds: {
    [crossUnitCurrentRoute.candidateId]: crossUnitProjectedWorld,
  },
  projectedWorldRevisions: {
    [crossUnitCurrentRoute.candidateId]: 'cross-payment-after-cost',
  },
  routeCatalog: crossUnitRouteCatalog,
  candidateRoutes: {
    [crossUnitCurrentRoute.candidateId]: crossUnitCurrentRoute,
  },
  fullRoutesByUnit: crossUnitFullRoutes,
  actorSide: 'team_player',
  actionOpportunity: {
    opportunityId: 'natural:cross-payment-actor:1',
    ownerId: 'cross-payment-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:cross-payment-actor:2',
    ownerId: 'cross-payment-actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  resourceTimeline: [],
  objectiveContract: crossUnitPaymentWorld.胜负条件,
});
const crossUnitPaymentDeltaRows =
  crossUnitEnvelopeDeltas[crossUnitCurrentRoute.candidateId] || [];
const crossUnitPaymentDelta = crossUnitPaymentDeltaRows.find(row =>
  row?.targetId === 'cross-payment-payer'
);
const crossUnitPaymentChecks = {
  hasRow: !!crossUnitPaymentDelta,
  routeChanged:
    crossUnitPaymentDelta?.resourceOpportunityCandidate?.rows?.[0]?.selectedRouteKey ===
      'route:cross-payment-fallback',
  negativeDelta:
    Number(crossUnitPaymentDelta?.healthTrajectoryDeltaPP || 0) < 0,
  singleOwnedDelta:
    Math.abs(Number(crossUnitPaymentDelta?.healthTrajectoryDeltaPP || 0) + 28) < 1e-9,
  affordabilityProjection:
    crossUnitPaymentDelta?.resourceOpportunityCandidate?.rows?.[0]?.projectionMode ===
      'RESOURCE_AFFORDABILITY_ENVELOPE',
  nonResourceHpNotReplayed:
    crossUnitPaymentDelta?.resourceOpportunityCandidate?.rows?.[0]?.hpAfter?.[
      'cross-payment-enemy'
    ] === 100,
};
add(
  'oracle:cross-unit-payment-invalidates-payer-dependent-future-route-once',
  Object.values(crossUnitPaymentChecks).every(Boolean),
  {
    expectedSingleOwnedDelta: -28,
    rejectedDuplicateDelta: -56,
    paymentChecks: crossUnitPaymentChecks,
    crossUnitPaymentDeltaRows,
    crossUnitPaymentDelta,
  },
);

const crossUnitRecoveryInput = {
  worldSnapshot: crossUnitProjectedWorld,
  actorSide: 'team_player',
  unitIds: ['cross-payment-actor', 'cross-payment-payer'],
  routeCatalog: crossUnitRouteCatalog,
  fullRoutesByUnit: crossUnitFullRoutes,
  actionOpportunity: {
    opportunityId: 'natural:cross-payment-actor:1',
    ownerId: 'cross-payment-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:cross-payment-actor:future',
    ownerId: 'cross-payment-actor',
    round: 2,
    sequence: 3,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  objectiveContract: crossUnitPaymentWorld.胜负条件,
};
const crossUnitRecoveryBeforePayment = decision.r8BuildResourceOpportunityPlan({
  ...crossUnitRecoveryInput,
  resourceTimeline: [{
    eventId: 'cross-payment-restore-before',
    actorId: 'cross-payment-payer',
    resource: '魂力',
    delta: 40,
    operation: 'RESTORE',
    round: 2,
    opportunitySequence: 3,
    actionSequence: 0,
    phasePriority: 10,
    effectSequence: 1,
  }],
});
const crossUnitRecoveryAfterPayment = decision.r8BuildResourceOpportunityPlan({
  ...crossUnitRecoveryInput,
  resourceTimeline: [{
    eventId: 'cross-payment-restore-after',
    actorId: 'cross-payment-payer',
    resource: '魂力',
    delta: 40,
    operation: 'RESTORE',
    round: 2,
    opportunitySequence: 3,
    actionSequence: 2,
    phasePriority: 10,
    effectSequence: 1,
  }],
});
add(
  'oracle:cross-unit-recovery-timing-restores-only-when-before-dependent-payment',
  crossUnitRecoveryBeforePayment?.rows?.[0]?.selectedRouteKey ===
      'route:cross-payment-high' &&
    crossUnitRecoveryAfterPayment?.rows?.[0]?.selectedRouteKey ===
      'route:cross-payment-fallback',
  {
    crossUnitRecoveryBeforePayment,
    crossUnitRecoveryAfterPayment,
  },
);

function resourceOwnershipSkill(id, {
  cost = 0,
  prototype = '伤害结算',
  target = '单体',
  resource = '',
  value = 0,
  power = 0,
} = {}) {
  const effect = prototype === '资源变化'
    ? {
        effectId: `${id}:resource`,
        原型: prototype,
        目标: target,
        资源: resource,
        数值: value,
      }
    : {
        effectId: `${id}:damage`,
        原型: prototype,
        目标: target,
        威力倍率: power,
        伤害类型: '近身攻击',
        命中概率: '100%',
      };
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: cost },
    _效果数组: [effect],
  };
}

function prepareResourceOwnershipCase({
  caseId,
  actorSoul = 100,
  actorSkills = [],
  allyHp = 100,
  allySkills = [],
  objectiveContract = objective(),
  futureActorOpportunity = true,
  futureAllyOpportunity = false,
  skillId,
  targetId,
}) {
  const actorId = `${caseId}:actor`;
  const allyId = `${caseId}:ally`;
  const enemyId = `${caseId}:enemy`;
  const actor = unit(actorId, 'player', 100, actorSkills);
  actor.sp = actorSoul;
  actor.属性.魂力 = actorSoul;
  const world = {
    回合: 1,
    胜负条件: objectiveContract,
    参战者: {
      team_player: [
        actor,
        unit(allyId, 'player', allyHp, allySkills),
      ],
      team_enemy: [
        unit(enemyId, 'enemy', 100, [
          resourceOwnershipSkill(`${caseId}:enemy-hit`, { power: 50 }),
        ]),
      ],
    },
  };
  const actionOpportunity = {
    opportunityId: `natural:${actorId}:1`,
    ownerId: actorId,
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    round: 1,
    sequence: 1,
    battleHorizon: {
      currentRound: 1,
      finalRound: Number(objectiveContract?.maxRounds || 1),
    },
  };
  const baseRuntimeSnapshot = runtime.buildDecisionRuntimeSnapshot(
    world,
    actorId,
    actionOpportunity,
  );
  const runtimeSnapshot = {
    ...baseRuntimeSnapshot,
    opportunitySnapshot: [
      { ...actionOpportunity, status: 'EXECUTING' },
      ...(futureActorOpportunity
        ? [{
            opportunityId: `natural:${actorId}:2`,
            ownerId: actorId,
            role: 'ACTIVE',
            grantType: 'NATURAL_ACTION',
            round: 2,
            sequence: 2,
            status: 'PENDING',
          }]
        : []),
      ...(futureAllyOpportunity
        ? [{
            opportunityId: `natural:${allyId}:2`,
            ownerId: allyId,
            role: 'ACTIVE',
            grantType: 'NATURAL_ACTION',
            round: 2,
            sequence: 3,
            status: 'PENDING',
          }]
        : []),
    ],
  };
  const prepared = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId,
    objectiveContract,
    actionOpportunity,
    runtimeSnapshot,
    seed: 837100,
  });
  const candidate = prepared.frozenCandidates.find(entry =>
    entry?.declaration?.skill?.id === skillId &&
    (!targetId || entry?.declaration?.targetIds?.includes(targetId))
  );
  const routeAnalysis = decision.preparedRouteCacheSnapshot(prepared);
  const candidateRoute = routeAnalysis.fullRoutesByUnit[actorId]?.find(
    routeEntry => routeEntry?.candidateId === candidate?.candidateId,
  );
  const projection = candidate && candidateRoute
    ? decision.projectR8GoalUtility(prepared, candidate, candidateRoute)
    : null;
  return {
    actorId,
    allyId,
    enemyId,
    candidate,
    route: candidateRoute,
    projection,
    candidateEnvelopeDeltas:
      routeAnalysis.actorCandidateEnvelopeDeltas?.[
        candidate?.candidateId
      ] || [],
  };
}

const crisisHealSkill = resourceOwnershipSkill('ownership-crisis-heal', {
  cost: 80,
  prototype: '资源变化',
  resource: '生命',
  value: '+50%',
});
const crisisObjective = objective('ROUND_REACHED');
crisisObjective.maxRounds = 1;
crisisObjective.victory.conditions[0].round = 1;
crisisObjective.defeat.conditions[0].targetIds = ['ownership-heal:ally'];
const crisisHealOwnership = prepareResourceOwnershipCase({
  caseId: 'ownership-heal',
  actorSkills: [crisisHealSkill],
  allyHp: 20,
  objectiveContract: crisisObjective,
  futureActorOpportunity: false,
  skillId: crisisHealSkill.id,
  targetId: 'ownership-heal:ally',
});
add(
  'oracle:resource-ownership-keeps-health-change-in-direct-trajectory',
  Math.abs(
    Number(crisisHealOwnership.projection?.directTrajectoryHEPP || 0) - 50
  ) < 1e-9 &&
    Number(crisisHealOwnership.route?.intrinsicActionPoolHEPP || 0) === 0 &&
    Number(crisisHealOwnership.route?.resourceActionPoolHEPP || 0) === 0 &&
    crisisHealOwnership.route?.healthTrajectoryByTarget?.some(trajectory =>
      trajectory?.targetId === crisisHealOwnership.allyId &&
      trajectory?.outcomeKind === 'HP_DELTA'
    ),
  {
    directTrajectoryHEPP:
      crisisHealOwnership.projection?.directTrajectoryHEPP,
    intrinsicActionPoolHEPP:
      crisisHealOwnership.route?.intrinsicActionPoolHEPP,
    resourceActionPoolHEPP:
      crisisHealOwnership.route?.resourceActionPoolHEPP,
  },
);

const compoundHealShieldSkill = {
  id: 'ownership-compound-heal-shield',
  name: 'ownership-compound-heal-shield',
  魂技名: 'ownership-compound-heal-shield',
  消耗: { 魂力: 80 },
  _效果数组: [
    {
      effectId: 'ownership-compound-heal-shield:heal',
      原型: '资源变化',
      目标: '单体',
      资源: '生命',
      数值: '+50%',
    },
    {
      effectId: 'ownership-compound-heal-shield:shield',
      原型: '护盾变化',
      目标: '单体',
      护盾模式: '正向护盾',
      数值: '+30%',
      持续回合: 1,
    },
  ],
};
const hpSensitiveAllySkill = resourceOwnershipSkill(
  'ownership-compound-heal-shield:ally-heal',
  {
    prototype: '资源变化',
    target: '自身',
    resource: '生命',
    value: '+25%',
  },
);
const compoundHealShieldObjective = objective('ROUND_REACHED');
compoundHealShieldObjective.maxRounds = 2;
compoundHealShieldObjective.victory.conditions[0].round = 2;
compoundHealShieldObjective.defeat.conditions[0].targetIds = [
  'ownership-compound-heal-shield:ally',
];
const compoundHealShieldOwnership = prepareResourceOwnershipCase({
  caseId: 'ownership-compound-heal-shield',
  actorSkills: [compoundHealShieldSkill],
  allyHp: 20,
  allySkills: [hpSensitiveAllySkill],
  objectiveContract: compoundHealShieldObjective,
  futureActorOpportunity: false,
  futureAllyOpportunity: true,
  skillId: compoundHealShieldSkill.id,
  targetId: 'ownership-compound-heal-shield:ally',
});
add(
  'oracle:direct-heal-does-not-reappear-as-negative-health-route-through-shield-envelope',
  Math.abs(
    Number(
      compoundHealShieldOwnership.projection?.directTrajectoryHEPP || 0,
    ) - 50,
  ) < 1e-9 &&
    Number(
      compoundHealShieldOwnership.route?.intrinsicActionPoolHEPP || 0,
    ) >= -1e-9 &&
    !compoundHealShieldOwnership.route?.intrinsicActionPoolDeltas?.some(
      delta =>
        delta?.outcomeKind === 'HEALTH_ROUTE_CHANGED' &&
        Number(delta?.healthTrajectoryDeltaPP || 0) < -1e-9,
    ),
  {
    directTrajectoryHEPP:
      compoundHealShieldOwnership.projection?.directTrajectoryHEPP,
    intrinsicActionPoolHEPP:
      compoundHealShieldOwnership.route?.intrinsicActionPoolHEPP,
    intrinsicActionPoolDeltas:
      compoundHealShieldOwnership.route?.intrinsicActionPoolDeltas,
  },
);

const manualCases = buildManualCases(
  sandbox.__LWCS_内置角色库__,
  sandbox.__LWCS_GET_BASE_STATS__,
);
const teamHealDefinition = manualCases.find(
  entry => entry.caseId === 'team_heal_crisis',
);
const teamHealWorld = structuredClone(teamHealDefinition.combatData);
const teamHealActorId = '雅莉';
const teamHealQueue = runtime.buildActionQueue(teamHealWorld);
const teamHealOpportunities = teamHealQueue.map((entry, index) => {
  const ownerId = preview.unitId(entry?.char);
  const side = String(entry?.side || '').includes('enemy')
    ? 'enemy'
    : 'player';
  return runtime.normalizeOpportunityRecord({
    opportunityId: `natural:1:${side}:${ownerId}:${index + 1}`,
    grantId: `natural:1:${side}:${ownerId}:${index + 1}`,
    ownerId,
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    round: 1,
    sequence: index + 1,
    createdAtSequence: index + 1,
    status: ownerId === teamHealActorId ? 'EXECUTING' : 'PENDING',
  });
});
const teamHealActionOpportunity = {
  ...teamHealOpportunities.find(
    opportunity => opportunity.ownerId === teamHealActorId,
  ),
  battleHorizon: {
    currentRound: 1,
    finalRound: Number(teamHealWorld?.胜负条件?.maxRounds || 4),
  },
};
const teamHealBaseSnapshot = runtime.buildDecisionRuntimeSnapshot(
  teamHealWorld,
  teamHealActorId,
  teamHealActionOpportunity,
);
const teamHealRuntimeSnapshot = {
  ...teamHealBaseSnapshot,
  opportunitySnapshot: teamHealOpportunities,
};
const teamHealPrepared = decision.prepareDecisionRequest({
  worldSnapshot: teamHealWorld,
  actorId: teamHealActorId,
  objectiveContract: teamHealWorld.胜负条件,
  battleIntent: { mode: teamHealDefinition.intent },
  beliefState:
    teamHealDefinition.initialBelief?.[teamHealActorId] ||
    teamHealDefinition.initialBelief ||
    {},
  actionOpportunity: teamHealActionOpportunity,
  runtimeSnapshot: teamHealRuntimeSnapshot,
  seed: `${teamHealDefinition.seed}:1:0`,
});
const teamHealRouteAnalysis =
  decision.preparedRouteCacheSnapshot(teamHealPrepared);
const teamHealCandidate = teamHealPrepared.frozenCandidates.find(candidate =>
  String(candidate?.declaration?.skill?.魂技名 || '').trim() === '第八魂技'
);
const teamHealRoute =
  teamHealRouteAnalysis.actorCandidateRoutes?.[
    teamHealCandidate?.candidateId
  ];
const teamHealProjection = teamHealCandidate && teamHealRoute
  ? decision.projectR8GoalUtility(
      teamHealPrepared,
      teamHealCandidate,
      teamHealRoute,
    )
  : null;
const teamHealNegativeRows = (
  teamHealRouteAnalysis.actorCandidateEnvelopeDeltas?.[
    teamHealCandidate?.candidateId
  ] || []
).filter(row =>
  ['舞长空', '古月'].includes(String(row?.targetId || '').trim()) &&
  Number(row?.healthTrajectoryDeltaPP || 0) < -1e-9
);
add(
  'oracle:resource-bearing-candidate-does-not-compare-valued-baseline-to-unvalued-rebuild',
  teamHealNegativeRows.length === 0 &&
    Number(teamHealProjection?.actionPoolHEPP || 0) >= -1e-9,
  {
    candidateEnvelopeDeltas:
      teamHealRouteAnalysis.actorCandidateEnvelopeDeltas?.[
        teamHealCandidate?.candidateId
      ] || [],
    teamHealNegativeRows,
    routeIntrinsicActionPoolHEPP:
      teamHealRoute?.intrinsicActionPoolHEPP,
    projectionActionPoolHEPP:
      teamHealProjection?.actionPoolHEPP,
  },
);

const positiveHealBranchRoute = route({
  health: [hp('ally', 50, 'positive-heal')],
});
const positiveHealBranchRequest = request({
  opportunities: [{
    opportunityId: 'natural:ally:2',
    ownerId: 'ally',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    round: 2,
    sequence: 2,
    status: 'PENDING',
  }],
  candidateEnvelopeDeltas: {
    test: [{
      targetId: 'ally',
      beforeRouteKey: 'route:ally-before',
      afterRouteKey: 'route:ally-after',
      beforePP: 15,
      afterPP: 15,
      healthTrajectoryDeltaPP: 0,
      sourceEffectKeys: [],
      sourceHealthFactKeys: ['test|positive-heal|ally|HP_DELTA|NOW'],
      behaviorRealizationWindow: {
        affectedOpportunityIds: ['natural:ally:2'],
      },
    }],
  },
});
positiveHealBranchRequest.ongoingBranchWorlds = [{
  probability: 1,
  world: request({ allyHp: 0 }).visibleWorld,
}];
const positiveHealBranchDeltas = decision.r8ActionPoolDeltas(
  positiveHealBranchRequest,
  positiveHealBranchRoute,
);
add(
  'oracle:positive-health-fact-cannot-own-later-capability-loss',
  !positiveHealBranchDeltas.some(delta =>
    delta?.outcomeKind === 'HEALTH_ROUTE_CHANGED' &&
    Number(delta?.healthTrajectoryDeltaPP || 0) < -1e-9
  ),
  { positiveHealBranchDeltas },
);

const costlyStrike = resourceOwnershipSkill('ownership-costly-strike', {
  cost: 80,
  power: 100,
});
const futureConsumer = resourceOwnershipSkill('ownership-future-consumer', {
  cost: 60,
  power: 1000,
});
const paymentOwnership = prepareResourceOwnershipCase({
  caseId: 'ownership-payment',
  actorSkills: [costlyStrike, futureConsumer],
  skillId: costlyStrike.id,
  targetId: 'ownership-payment:enemy',
});
const paymentResourceDeltas =
  paymentOwnership.route?.resourceActionPoolDeltas || [];
add(
  'oracle:action-cost-is-owned-once-by-resource-layer',
  paymentResourceDeltas.length === 1 &&
    Number(paymentOwnership.route?.resourceActionPoolHEPP || 0) < 0 &&
    Number(paymentOwnership.route?.intrinsicActionPoolHEPP || 0) === 0 &&
    !paymentOwnership.route?.intrinsicActionPoolDeltas?.some(delta =>
      delta?.outcomeKind === 'HEALTH_ROUTE_CHANGED' ||
      delta?.windowId === 'ACTION_COST'
    ) &&
    Math.abs(
      Number(paymentOwnership.projection?.actionPoolHEPP || 0) -
      Number(paymentOwnership.route?.resourceActionPoolHEPP || 0)
    ) < 1e-9,
  {
    resourceActionPoolHEPP:
      paymentOwnership.route?.resourceActionPoolHEPP,
    projectionActionPoolHEPP:
      paymentOwnership.projection?.actionPoolHEPP,
    resourceActionPoolDeltas: paymentResourceDeltas,
  },
);

const noConsumerObjective = objective();
noConsumerObjective.maxRounds = 1;
const noConsumerPayment = prepareResourceOwnershipCase({
  caseId: 'ownership-no-consumer',
  actorSkills: [costlyStrike],
  objectiveContract: noConsumerObjective,
  futureActorOpportunity: false,
  skillId: costlyStrike.id,
  targetId: 'ownership-no-consumer:enemy',
});
add(
  'oracle:action-cost-without-future-consumer-has-no-nominal-penalty',
  Number(noConsumerPayment.route?.resourceActionPoolHEPP || 0) === 0 &&
    Number(noConsumerPayment.projection?.actionPoolHEPP || 0) === 0 &&
    Math.abs(
      Number(noConsumerPayment.projection?.objectiveUtilityHEPP || 0) -
      Number(noConsumerPayment.projection?.directTrajectoryHEPP || 0)
    ) < 1e-9,
  {
    directTrajectoryHEPP:
      noConsumerPayment.projection?.directTrajectoryHEPP,
    resourceActionPoolHEPP:
      noConsumerPayment.route?.resourceActionPoolHEPP,
    objectiveUtilityHEPP:
      noConsumerPayment.projection?.objectiveUtilityHEPP,
  },
);

const resourceRecovery = resourceOwnershipSkill('ownership-resource-recovery', {
  prototype: '资源变化',
  target: '自身',
  resource: '魂力',
  value: 80,
});
const freeStrike = resourceOwnershipSkill('ownership-free-strike', {
  power: 100,
});
const recoveryOwnership = prepareResourceOwnershipCase({
  caseId: 'ownership-recovery',
  actorSoul: 20,
  actorSkills: [resourceRecovery, futureConsumer, freeStrike],
  skillId: resourceRecovery.id,
  targetId: 'ownership-recovery:actor',
});
add(
  'oracle:resource-recovery-is-positive-only-through-real-future-consumer',
  Number(recoveryOwnership.projection?.directTrajectoryHEPP || 0) === 0 &&
    Number(recoveryOwnership.route?.intrinsicActionPoolHEPP || 0) === 0 &&
    Number(recoveryOwnership.route?.resourceActionPoolHEPP || 0) > 0 &&
    Math.abs(
      Number(recoveryOwnership.projection?.objectiveUtilityHEPP || 0) -
      Number(recoveryOwnership.route?.resourceActionPoolHEPP || 0)
    ) < 1e-9,
  {
    resourceActionPoolHEPP:
      recoveryOwnership.route?.resourceActionPoolHEPP,
    objectiveUtilityHEPP:
      recoveryOwnership.projection?.objectiveUtilityHEPP,
    resourceActionPoolDeltas:
      recoveryOwnership.route?.resourceActionPoolDeltas,
  },
);

const directOwnership = prepareResourceOwnershipCase({
  caseId: 'ownership-direct',
  actorSoul: 20,
  actorSkills: [resourceRecovery, futureConsumer, freeStrike],
  skillId: freeStrike.id,
  targetId: 'ownership-direct:enemy',
});
add(
  'oracle:non-resource-direct-route-is-unchanged-by-resource-neutralization',
  Number(directOwnership.projection?.directTrajectoryHEPP || 0) > 0 &&
    Number(directOwnership.route?.resourceActionPoolHEPP || 0) === 0 &&
    directOwnership.route?.resourceActionPoolDeltas?.length === 0,
  {
    directTrajectoryHEPP:
      directOwnership.projection?.directTrajectoryHEPP,
    resourceActionPoolHEPP:
      directOwnership.route?.resourceActionPoolHEPP,
    resourceActionPoolDeltas:
      directOwnership.route?.resourceActionPoolDeltas,
  },
);

const probabilisticResourceRoute = route({
  routeKey: 'route:probabilistic-resource-effect',
  candidateId: 'probabilistic-resource-actor:resource-effect',
  behaviorRouteUtilityHEPP: 0,
  intrinsicActionPoolDeltas: [{
    rootActionId: 'probabilistic-resource-actor:resource-effect',
    effectInstanceId: 'probabilistic-resource-effect',
    targetId: 'probabilistic-resource-enemy',
    outcomeKind: 'RESOURCE_OPTION_CHANGED',
    windowId: 'NEXT',
    ownerType: 'ACTION_POOL_DELTA',
    realizable: true,
    healthTrajectoryDeltaPP: 10,
    evidence: {
      resource: '魂力',
      delta: -40,
      r8RealizationProbability: 0.5,
      r8RealizedHealthTrajectoryDeltaPP: 20,
    },
  }],
});
const probabilisticResourceWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('probabilistic-resource-actor', 'player', 100)],
    team_enemy: [unit('probabilistic-resource-enemy', 'enemy', 100)],
  },
};
const probabilisticResourcePlan = decision.r8BuildResourceOpportunityPlan({
  worldSnapshot: probabilisticResourceWorld,
  actorSide: 'team_player',
  unitIds: ['probabilistic-resource-actor'],
  routeCatalog: {
    'probabilistic-resource-actor': decision.selectPrimaryBackupRoutes([
      probabilisticResourceRoute,
    ]),
  },
  fullRoutesByUnit: {
    'probabilistic-resource-actor': [probabilisticResourceRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:probabilistic-resource-actor:1',
    ownerId: 'probabilistic-resource-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:probabilistic-resource-actor:2',
    ownerId: 'probabilistic-resource-actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  resourceTimeline: [],
});
const probabilisticResourceBranchMass =
  (probabilisticResourcePlan?.branchPlanSummary || [])
    .reduce((sum, branch) => sum + Number(branch?.probability || 0), 0);
add(
  'oracle:probabilistic-resource-effect-enters-exact-resource-worlds',
  probabilisticResourcePlan?.probabilisticStateUnresolved === false &&
    probabilisticResourcePlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    probabilisticResourcePlan?.branchPlanCount === 2 &&
    Math.abs(probabilisticResourceBranchMass - 1) < 1e-9,
  {
    plan: probabilisticResourcePlan,
    branchMass: probabilisticResourceBranchMass,
  },
);

const multiProbabilisticResourceRoute = route({
  routeKey: 'route:multi-probabilistic-resource-effect',
  candidateId: 'probabilistic-resource-actor:multi-resource-effect',
  behaviorRouteUtilityHEPP: 0,
  intrinsicActionPoolDeltas: [1, 2].map(index => ({
    rootActionId: 'probabilistic-resource-actor:multi-resource-effect',
    effectInstanceId: `multi-probabilistic-resource-effect:${index}`,
    targetId: 'probabilistic-resource-enemy',
    outcomeKind: 'RESOURCE_OPTION_CHANGED',
    windowId: `NEXT:${index}`,
    ownerType: 'ACTION_POOL_DELTA',
    realizable: true,
    healthTrajectoryDeltaPP: 10,
    evidence: {
      resource: index === 1 ? '魂力' : '精神力',
      delta: -40,
      r8RealizationProbability: 0.5,
      r8RealizedHealthTrajectoryDeltaPP: 20,
    },
  })),
});
const multiProbabilisticResourcePlan = decision.r8BuildResourceOpportunityPlan({
  worldSnapshot: probabilisticResourceWorld,
  actorSide: 'team_player',
  unitIds: ['probabilistic-resource-actor'],
  routeCatalog: {
    'probabilistic-resource-actor': decision.selectPrimaryBackupRoutes([
      multiProbabilisticResourceRoute,
    ]),
  },
  fullRoutesByUnit: {
    'probabilistic-resource-actor': [multiProbabilisticResourceRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:probabilistic-resource-actor:1',
    ownerId: 'probabilistic-resource-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:probabilistic-resource-actor:2',
    ownerId: 'probabilistic-resource-actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  resourceTimeline: [],
});
const multiProbabilisticResourceUtilities =
  (multiProbabilisticResourcePlan?.branchPlanSummary || [])
    .map(branch => Number(branch?.cumulativeUtilityHEPP || 0))
    .sort((left, right) => left - right);
const multiProbabilisticResourceBranchMass =
  (multiProbabilisticResourcePlan?.branchPlanSummary || [])
    .reduce((sum, branch) => sum + Number(branch?.probability || 0), 0);
add(
  'oracle:multiple-probabilistic-resource-effects-expand-combination-worlds',
  multiProbabilisticResourcePlan?.probabilisticStateUnresolved === false &&
    multiProbabilisticResourcePlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    multiProbabilisticResourcePlan?.branchPlanCount === 4 &&
    Math.abs(multiProbabilisticResourceBranchMass - 1) < 1e-9 &&
    JSON.stringify(multiProbabilisticResourceUtilities) ===
      JSON.stringify([0, 20, 20, 40]),
  {
    plan: multiProbabilisticResourcePlan,
    branchMass: multiProbabilisticResourceBranchMass,
    utilities: multiProbabilisticResourceUtilities,
  },
);
add(
  'oracle:full-behavior-route-order-does-not-change-primary-backup',
  forwardBehaviorEnvelope?.primaryRoute?.routeKey ===
      'route:indirect-control' &&
    reverseBehaviorEnvelope?.primaryRoute?.routeKey ===
      'route:indirect-control' &&
    preview.stableHash(forwardBehaviorEnvelope) ===
      preview.stableHash(reverseBehaviorEnvelope),
  {
    forwardBehaviorEnvelope,
    reverseBehaviorEnvelope,
  },
);

const potentialFusionSkill = damageSkill('potential-fusion', 180);
potentialFusionSkill.消耗 = { 魂力: '50%' };
const potentialFusionActor = unit(
  'potential-fusion-actor',
  'player',
  100,
  [potentialFusionSkill],
);
const potentialFusionPartner = unit(
  'potential-fusion-partner',
  'player',
  100,
  [],
);
const potentialFusionEnemy = unit(
  'potential-fusion-enemy',
  'enemy',
  100,
  [],
);
for (const participant of [potentialFusionActor, potentialFusionPartner]) {
  participant.sp = 0;
  participant.属性.魂力 = 0;
  participant.__battleRuntime = {
    naturalOpportunity: {
      round: 1,
      status: 'CONSUMED',
      opportunityId: `natural:${participant.id}:1`,
    },
  };
}
potentialFusionActor.武魂融合技 = {
  潜在融合: {
    融合模式: 'partner',
    融合对象: 'potential-fusion-partner',
    用法模式: '一次性释放',
    融合参与者: [
      {
        类型: '自身',
        角色键: 'potential-fusion-actor',
        角色名: 'potential-fusion-actor',
      },
      {
        类型: '搭档',
        角色键: 'potential-fusion-partner',
        角色名: 'potential-fusion-partner',
      },
    ],
    技能数据: potentialFusionSkill,
  },
};
const potentialFusionWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [potentialFusionActor, potentialFusionPartner],
    team_enemy: [potentialFusionEnemy],
  },
};
const strictFusionCandidates = decision.enumerateCandidates({
  worldSnapshot: potentialFusionWorld,
  actorId: 'potential-fusion-actor',
  actionOpportunity: {
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
});
const potentialFusionCandidates = decision.enumerateCandidates({
  worldSnapshot: potentialFusionWorld,
  actorId: 'potential-fusion-actor',
  includeUnaffordableRoutes: true,
  actionOpportunity: {
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
});
const potentialFusionCandidate = potentialFusionCandidates.find(candidate =>
  candidate?.declaration?.skill?.id === 'potential-fusion'
);
add(
  'oracle:future-fusion-route-survives-current-resource-and-opportunity-gap',
  !strictFusionCandidates.some(candidate =>
    candidate?.declaration?.skill?.id === 'potential-fusion'
  ) &&
    potentialFusionCandidate?.resourcePotentialOnly === true &&
    preview.stableHash(
      [...(potentialFusionCandidate?.declaration?.fusionParticipantIds || [])]
        .sort(),
    ) === preview.stableHash([
      'potential-fusion-actor',
      'potential-fusion-partner',
    ]),
  {
    strictFusionCandidateIds: strictFusionCandidates.map(candidate =>
      candidate.candidateId
    ),
    potentialFusionCandidate,
  },
);

const fusionPlannerActor = unit('fusion-planner-actor', 'player');
const fusionPlannerPartner = unit('fusion-planner-partner', 'player');
const fusionPlannerEnemy = unit('fusion-planner-enemy', 'enemy');
const fusionPlannerWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [fusionPlannerActor, fusionPlannerPartner],
    team_enemy: [fusionPlannerEnemy],
  },
};
const fusionPlannerRoute = route({
  routeKey: 'route:future-fusion',
  candidateId: 'fusion-planner-actor:future-fusion',
  behaviorRouteUtilityHEPP: 20,
  paymentDependencies: [
    {
      unitId: 'fusion-planner-actor',
      resource: '魂力',
      amount: 50,
    },
    {
      unitId: 'fusion-planner-partner',
      resource: '魂力',
      amount: 50,
    },
  ],
});
fusionPlannerRoute.opportunityDependencies = [{
  targetId: 'fusion-planner-partner',
  outcomeKind: 'FUSION_PARTNER_OPPORTUNITY',
  windowId: 'CURRENT_ROUND_PENDING_NATURAL_ACTION',
}];
const fusionPlannerBasic = route({
  routeKey: 'route:fusion-planner-basic',
  candidateId: 'fusion-planner-actor:basic',
  behaviorRouteUtilityHEPP: 5,
});
const buildFusionResourcePlan = opportunitySnapshot =>
  decision.r8BuildResourceOpportunityPlan({
    worldSnapshot: fusionPlannerWorld,
    actorSide: 'team_player',
    unitIds: ['fusion-planner-actor', 'fusion-planner-partner'],
    routeCatalog: {
      'fusion-planner-actor': decision.selectPrimaryBackupRoutes([
        fusionPlannerBasic,
      ]),
      'fusion-planner-partner': decision.selectPrimaryBackupRoutes([]),
    },
    fullRoutesByUnit: {
      'fusion-planner-actor': [
        fusionPlannerBasic,
        fusionPlannerRoute,
      ],
      'fusion-planner-partner': [],
    },
    actionOpportunity: {
      opportunityId: 'natural:fusion-planner-current',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot,
    scheduledEvents: [],
    resourceTimeline: [],
  });
const fusionPartnerPendingPlan = buildFusionResourcePlan([
  {
    opportunityId: 'natural:fusion-planner-actor:2',
    ownerId: 'fusion-planner-actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  },
  {
    opportunityId: 'natural:fusion-planner-partner:3',
    ownerId: 'fusion-planner-partner',
    round: 1,
    sequence: 3,
    status: 'PENDING',
  },
]);
const fusionPartnerAlreadyUsedPlan = buildFusionResourcePlan([
  {
    opportunityId: 'natural:fusion-planner-partner:2',
    ownerId: 'fusion-planner-partner',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  },
  {
    opportunityId: 'natural:fusion-planner-actor:3',
    ownerId: 'fusion-planner-actor',
    round: 1,
    sequence: 3,
    status: 'PENDING',
  },
]);
add(
  'oracle:future-fusion-route-requires-and-consumes-partner-opportunity',
  fusionPartnerPendingPlan?.rows?.[0]?.selectedRouteKey ===
      'route:future-fusion' &&
    fusionPartnerPendingPlan?.rows?.[1]?.consumedByFusion === true &&
    fusionPartnerAlreadyUsedPlan?.rows?.[1]?.selectedRouteKey ===
      'route:fusion-planner-basic',
  {
    fusionPartnerPendingPlan,
    fusionPartnerAlreadyUsedPlan,
  },
);

const roundOrderedPressurePlan = decision.r8BuildTargetPressurePlan({
  worldSnapshot: resourcePressureWorld,
  actorSide: 'team_player',
  routeCatalog: {
    'resource-pressure-ally': {
      primaryRoute: resourceFreeRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    'resource-pressure-ally': [resourceFreeRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:resource-pressure-actor:1',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:resource-pressure-ally:1',
    ownerId: 'resource-pressure-ally',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [{
    descriptorId: 'future-natural:2:resource-pressure-ally',
    ownerId: 'resource-pressure-ally',
    scheduledRound: 2,
    creationSequence: 2,
    eventType: 'FUTURE_NATURAL_ACTION',
  }],
});
add(
  'oracle:target-pressure-orders-by-round-before-sequence',
  roundOrderedPressurePlan.rows.length === 2 &&
    roundOrderedPressurePlan.rows[0]?.opportunityRound === 1 &&
    roundOrderedPressurePlan.rows[1]?.opportunityRound === 2,
  { roundOrderedPressurePlan },
);

const noThreatRoute = route({
  routeKey: 'route:no-threat-support',
  candidateId: 'pressure-target:support',
  targetIds: ['pressure-target'],
  health: [hp('pressure-target', 10, 'pressure-support')],
});
const noThreatDelta = decision.r8FutureThreatWindowDelta({
  worldSnapshot: targetPressureWorld,
  projectedWorld: targetPressureProjectedWorld,
  actorSide: 'team_player',
  targetId: 'pressure-target',
  routeCatalog: {
    ...targetPressureRouteCatalog,
    'pressure-target': {
      primaryRoute: noThreatRoute,
      backupRoute: null,
    },
  },
  fullRoutesByUnit: {
    ...targetPressureFullRoutes,
    'pressure-target': [noThreatRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:pressure-actor:1',
    sequence: 1,
  },
  opportunitySnapshot: targetPressureOpportunities,
  objectiveContract: targetPressureWorld.胜负条件,
});
add(
  'oracle:round-reached-pressure-on-unit-without-future-threat-is-zero',
  noThreatDelta === 0,
  { noThreatDelta },
);

for (const contract of contracts.cases) {
  add(
    `contract:${contract.caseId}`,
    directionalCheck(contract),
    { directionalRelations: contract.behaviorContract.directionalRelations },
  );
}

function damageSkill(id, power) {
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
      命中概率: '100%',
    }],
  };
}

function modifierSkill(id, target, check, value) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: `${id}:modifier`,
      原型: '判定修正',
      目标: target,
      判定: check,
      数值: value,
      持续回合: 2,
    }],
  };
}

function probabilisticStateSkill(id, state, effect = {}) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: `${id}:state`,
      原型: '状态施加',
      目标: '单体',
      状态: state,
      成功率: '50%',
      持续回合: 2,
      ...effect,
    }],
  };
}

function attributeSkill(id, target, attribute, value) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: `${id}:attribute`,
      原型: '属性修正',
      目标: target,
      属性: attribute,
      数值: value,
      持续回合: 2,
    }],
  };
}

function explicitCounterSkill(id, power, soulCost = 0) {
  return {
    id,
    name: id,
    魂技名: id,
    反击技能: true,
    前摇: 10,
    消耗: { 魂力: soulCost },
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

function counterReactionRequest(skills = [], soul = 100) {
  const actor = unit('counter-actor', 'player', 100, skills);
  actor.sp = soul;
  actor.属性.魂力 = soul;
  const enemy = unit('counter-source', 'enemy', 100, [damageSkill('incoming-hit', 80)]);
  const world = {
    回合: 1,
    胜负条件: objective(),
    参战者: {
      team_player: [actor],
      team_enemy: [enemy],
    },
  };
  const actionOpportunity = {
    opportunityId: 'reaction:counter-actor:incoming',
    ownerId: 'counter-actor',
    role: 'REACTION',
    grantType: 'DEFEND_WINDOW',
    sourceActorId: 'counter-source',
    validTargetIds: ['counter-actor'],
    sequence: 2,
    incomingAction: {
      actorId: 'counter-source',
      actionKind: 'BASIC_ATTACK',
      targetIds: ['counter-actor'],
    },
  };
  return decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId: 'counter-actor',
    objectiveContract: world.胜负条件,
    actionOpportunity,
    runtimeSnapshot: {
      opportunitySnapshot: [{
        ...actionOpportunity,
        status: 'EXECUTING',
      }],
      resourceTimeline: [],
      scheduledEvents: [],
    },
    seed: 837010,
  });
}

function reactionCandidateProjection(req, actionKind) {
  const candidate = req.frozenCandidates.find(entry =>
    String(entry?.declaration?.actionKind || '') === actionKind
  );
  return {
    candidate,
    projection: decision.projectR8GoalUtility(
      req,
      candidate,
      req.actorCandidateRoutes[candidate.candidateId],
    ),
  };
}

const payableCounterSkill = explicitCounterSkill('payable-counter', 220, 20);
const payableCounterRequest = counterReactionRequest([payableCounterSkill], 100);
const basicCounterRequest = counterReactionRequest([], 100);
const unaffordableCounterRequest = counterReactionRequest([payableCounterSkill], 0);
const payableDefend = reactionCandidateProjection(payableCounterRequest, 'DEFEND');
const basicDefend = reactionCandidateProjection(basicCounterRequest, 'DEFEND');
const unaffordableDefend = reactionCandidateProjection(
  unaffordableCounterRequest,
  'DEFEND',
);
const payableAuthorization = payableDefend.projection.actionPoolDeltas.find(delta =>
  String(delta?.outcomeKind || '') === 'COUNTER_AUTHORIZATION'
);
const basicAuthorization = basicDefend.projection.actionPoolDeltas.find(delta =>
  String(delta?.outcomeKind || '') === 'COUNTER_AUTHORIZATION'
);
const unaffordableAuthorization =
  unaffordableDefend.projection.actionPoolDeltas.find(delta =>
    String(delta?.outcomeKind || '') === 'COUNTER_AUTHORIZATION'
  );
const payableCounterFacts = decision.buildR8CausalValueFacts(
  payableCounterRequest,
  payableDefend.candidate,
  payableCounterRequest.actorCandidateRoutes[payableDefend.candidate.candidateId],
  payableDefend.projection,
);
add(
  'oracle:reaction-counter-authorization-uses-complete-payable-counter-pool',
  Number(payableAuthorization?.healthTrajectoryDeltaPP || 0) >
    Number(basicAuthorization?.healthTrajectoryDeltaPP || 0) &&
    Math.abs(
      Number(unaffordableAuthorization?.healthTrajectoryDeltaPP || 0) -
      Number(basicAuthorization?.healthTrajectoryDeltaPP || 0)
    ) < 1e-9 &&
    payableAuthorization?.evidence?.payableCounterCandidateIds?.some(candidateId =>
      String(candidateId).includes('payable-counter')
    ) &&
    !unaffordableAuthorization?.evidence?.payableCounterCandidateIds?.some(candidateId =>
      String(candidateId).includes('payable-counter')
    ) &&
    payableCounterFacts.some(fact =>
      fact.ownerType === 'ACTION_POOL_DELTA' &&
      fact.outcomeKind === 'COUNTER_AUTHORIZATION'
    ) &&
    !payableCounterFacts.some(fact =>
      fact.ownerType === 'STATE_DELTA' &&
      fact.outcomeKind === 'COUNTER_AUTHORIZATION'
    ),
  {
    payableAuthorization,
    basicAuthorization,
    unaffordableAuthorization,
    payableCounterFacts,
  },
);

const counterRuntimeWorld = structuredClone(payableCounterRequest.visibleWorld);
const counterRuntimeSource = counterRuntimeWorld.参战者.team_enemy[0];
const counterRuntimeActor = counterRuntimeWorld.参战者.team_player[0];
const incomingActionContext = runtime.beginStructuredDeclaration({
  combatData: counterRuntimeWorld,
  declaration: {
    actorId: 'counter-source',
    actionKind: 'BASIC_ATTACK',
    targetIds: ['counter-actor'],
  },
  actionRole: 'ACTIVE',
});
const counterReaction = runtime.settleStructuredReaction({
  combatData: counterRuntimeWorld,
  reactor: counterRuntimeActor,
  sourceActor: counterRuntimeSource,
  declaration: {
    actorId: 'counter-actor',
    actionKind: 'DEFEND',
    targetIds: ['counter-actor'],
  },
  parentActionEvent: incomingActionContext.actionEvent,
});
const originalCounterRandom = sandbox.Math.random;
sandbox.Math.random = () => 0;
let openedCounterWindow;
try {
  openedCounterWindow = runtime.openStructuredCounterWindow({
    combatData: counterRuntimeWorld,
    reactor: counterRuntimeActor,
    sourceActor: counterRuntimeSource,
    parentActionEvent: incomingActionContext.actionEvent,
    reaction: counterReaction,
    settlementFacts: [{
      eventKind: 'hit_result',
      targetId: 'counter-actor',
      appliedDamage: 10,
    }],
  });
} finally {
  sandbox.Math.random = originalCounterRandom;
}
const formalCounterCandidates = decision.enumerateCandidates({
  worldSnapshot: counterRuntimeWorld,
  actorId: 'counter-actor',
  actionOpportunity: {
    opportunityId: 'counter:formal',
    ownerId: 'counter-actor',
    role: 'COUNTER',
    grantType: 'COUNTER_WINDOW',
    sourceActorId: 'counter-source',
    validTargetIds: ['counter-source'],
    immediateBudget: 40,
  },
  beliefState: {},
});
const formalCounterCandidate = formalCounterCandidates.find(candidate =>
  String(candidate?.declaration?.skill?.id || '') === 'payable-counter'
);
const counterSoulBefore = counterRuntimeActor.属性.魂力;
const formalCounterSettlement = formalCounterCandidate
  ? runtime.executeStructuredDeclaration({
      combatData: counterRuntimeWorld,
      declaration: formalCounterCandidate.declaration,
      actionRole: 'COUNTER',
      sourceActionId: incomingActionContext.actionEvent.actionId,
    })
  : null;
const formalCounterHit = formalCounterSettlement?.facts?.find(fact =>
  String(fact?.eventKind || '') === 'hit_result' &&
  String(fact?.actorId || '') === 'counter-actor' &&
  String(fact?.targetId || '') === 'counter-source'
);
add(
  'oracle:runtime-counter-window-executes-owner-against-source-with-real-cost',
  openedCounterWindow?.opened === true &&
    !!formalCounterCandidate &&
    formalCounterCandidate.declaration.resourceCosts?.魂力 === 20 &&
    !!formalCounterHit &&
    Number(formalCounterHit?.appliedDamage || 0) > 0 &&
    counterRuntimeActor.属性.魂力 === counterSoulBefore - 20 &&
    formalCounterSettlement?.actionEvent?.sourceActionId ===
      incomingActionContext.actionEvent.actionId,
  {
    counterWindow: openedCounterWindow,
    counterCandidateId: String(formalCounterCandidate?.candidateId || ''),
    counterResourceCosts: formalCounterCandidate?.declaration?.resourceCosts || {},
    counterSoulBefore,
    counterSoulAfter: counterRuntimeActor.属性.魂力,
    counterHit: formalCounterHit,
  },
);

const counterLaneWorld = structuredClone(payableCounterRequest.visibleWorld);
const counterLaneCandidateId = 'counter-source:basic:counter-actor';
const counterLaneReaction = {
  responseId: 'REACTION:DEFEND:counter-lane',
  responseRole: 'REACTION',
  actionName: 'DEFEND',
  baseActionValue: 0,
  opensCounterCheck: true,
  damageMultiplier: 0.5,
  declaration: {
    actorId: 'counter-actor',
    actionKind: 'DEFEND',
    targetIds: ['counter-actor'],
    resourceCosts: {},
  },
};
const counterLaneRequest = {
  actorId: 'counter-source',
  actorSide: 'team_enemy',
  visibleWorld: counterLaneWorld,
  frozenCandidates: [{
    candidateId: counterLaneCandidateId,
    declaration: {
      actorId: 'counter-source',
      actionKind: 'BASIC_ATTACK',
      targetIds: ['counter-actor'],
      resourceCosts: {},
    },
  }],
  actorCandidateRoutes: {
    [counterLaneCandidateId]: {
      healthTrajectoryByTarget: [{
        targetId: 'counter-actor',
        healthDeltaPP: -10,
        outcomeDistribution: [
          {
            branchKey: 'hit',
            probability: 0.6,
            healthDeltaPP: -10,
          },
          {
            branchKey: 'miss',
            probability: 0.4,
            healthDeltaPP: 0,
          },
        ],
      }],
    },
  },
  actorProjectedWorlds: {
    [counterLaneCandidateId]: counterLaneWorld,
  },
  actionOpportunity: {
    opportunityId: 'natural:counter-source:counter-lane',
    ownerId: 'counter-source',
    role: 'ACTIVE',
    sequence: 1,
  },
  evaluationContext: {
    opportunitySnapshot: [],
    scheduledEvents: [],
  },
  beliefState: {
    confidence: 1,
    publicResponses: {
      'counter-actor': [
        counterLaneReaction,
        {
          responseId: 'COUNTER:payable-counter:counter-lane',
          responseRole: 'COUNTER',
          actionName: 'payable-counter',
          baseActionValue: 10,
          declaration: {
            actorId: 'counter-actor',
            actionKind: 'RELEASE_SKILL',
            targetIds: ['counter-source'],
            skill: payableCounterSkill,
            resourceCosts: { 魂力: 20 },
          },
        },
      ],
    },
  },
};
const counterLaneModel = decision.buildR8ResponseModel(
  counterLaneRequest,
  counterLaneCandidateId,
);
const counterLaneBranch = counterLaneModel.counterBranches[0];
const counterLaneWithoutWindowRequest = structuredClone(counterLaneRequest);
counterLaneWithoutWindowRequest.beliefState.publicResponses['counter-actor'][0]
  .opensCounterCheck = false;
const counterLaneWithoutWindow = decision.buildR8ResponseModel(
  counterLaneWithoutWindowRequest,
  counterLaneCandidateId,
);
add(
  'oracle:counter-lane-probability-matches-runtime-formula',
  Math.abs(
    Number(counterLaneBranch?.counterConditionalProbability || 0) -
      Number(openedCounterWindow?.probability || 0)
  ) <= 1e-12 &&
    Math.abs(
      Number(counterLaneBranch?.probability || 0) -
        0.6 * Number(openedCounterWindow?.probability || 0)
    ) <= 1e-12 &&
    counterLaneWithoutWindow.counterBranches.length === 0,
  {
    runtimeProbability: Number(openedCounterWindow?.probability || 0),
    counterLaneBranch,
    counterLaneWithoutWindow,
  },
);

const counterAfterEvadeRequest = structuredClone(counterLaneRequest);
counterAfterEvadeRequest.beliefState.publicResponses['counter-actor'][0] = {
  ...counterAfterEvadeRequest.beliefState.publicResponses['counter-actor'][0],
  responseId: 'REACTION:EVADE:counter-lane',
  actionName: 'EVADE',
  dodgeProbability: 1,
  declaration: {
    actorId: 'counter-actor',
    actionKind: 'EVADE',
    targetIds: ['counter-actor'],
    resourceCosts: {},
  },
};
counterAfterEvadeRequest.actorCandidateRoutes[counterLaneCandidateId]
  .healthTrajectoryByTarget = [{
    targetId: 'counter-actor',
    healthDeltaPP: -100,
    outcomeDistribution: [{
      branchKey: 'hit',
      probability: 1,
      healthDeltaPP: -100,
    }],
  }];
counterAfterEvadeRequest.actorProjectedWorlds[counterLaneCandidateId] =
  structuredClone(counterLaneWorld);
const counterAfterEvadeTarget =
  counterAfterEvadeRequest.actorProjectedWorlds[counterLaneCandidateId]
    .参战者.team_player[0];
counterAfterEvadeTarget.hp = 0;
counterAfterEvadeTarget.属性.HP = 0;
counterAfterEvadeTarget.状态 = { 存活: false, 行动: '死亡' };
const counterAfterEvadeModel = decision.buildR8ResponseModel(
  counterAfterEvadeRequest,
  counterLaneCandidateId,
);
add(
  'oracle:counter-lane-uses-post-reaction-world-before-lethal-candidate',
  counterAfterEvadeModel.reactionBranches.length === 1 &&
    counterAfterEvadeModel.counterBranches.length === 1,
  { counterAfterEvadeModel },
);

const adaptationUncertainSkill = damageSkill('adaptation-uncertain', 300);
adaptationUncertainSkill._效果数组[0].命中概率 = '60%';
const adaptationReliableSkill = damageSkill('adaptation-reliable', 120);
adaptationReliableSkill._效果数组[0].命中概率 = '100%';
const adaptationWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [
      unit('adaptation-actor', 'player', 100, [
        adaptationUncertainSkill,
        adaptationReliableSkill,
      ]),
    ],
    team_enemy: [unit('adaptation-target', 'enemy', 100)],
  },
};
adaptationWorld.参战者.team_player[0].属性.等级 = 30;
const adaptationOpportunity = {
  opportunityId: 'natural:adaptation-actor',
  ownerId: 'adaptation-actor',
  role: 'ACTIVE',
  grantType: 'NATURAL_ACTION',
  sequence: 1,
};
const prepareAdaptationRequest = beliefState => decision.prepareDecisionRequest({
  worldSnapshot: adaptationWorld,
  actorId: 'adaptation-actor',
  objectiveContract: adaptationWorld.胜负条件,
  actionOpportunity: adaptationOpportunity,
  runtimeSnapshot: {
    opportunitySnapshot: [{
      ...adaptationOpportunity,
      status: 'EXECUTING',
    }],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  beliefState,
  seed: 837020,
});
const adaptationInitialRequest = prepareAdaptationRequest({ confidence: 0.5 });
const adaptationUncertainCandidate = adaptationInitialRequest.frozenCandidates.find(candidate =>
  String(candidate?.declaration?.skill?.id || '') === 'adaptation-uncertain'
);
const adaptationTargetId = 'adaptation-target';
const adaptationEffect = adaptationUncertainSkill._效果数组[0];
const adaptationFingerprint = decision.relevantStateFingerprint(
  adaptationInitialRequest.beliefState,
  adaptationTargetId,
);
const adaptationMechanicKey = decision.hitMechanicKey({
  sourceActionId: adaptationUncertainCandidate.candidateId,
  targetId: adaptationTargetId,
  effectIndex: 0,
  effect: adaptationEffect,
  beliefState: adaptationInitialRequest.beliefState,
});
const adaptationFamilyKey = decision.mechanicAdaptationKey({
  actionKind: 'RELEASE_SKILL',
  effectPrototype: '命中判定',
  targetId: adaptationTargetId,
  damageClassName: 'MELEE',
  relevantStateFingerprint: adaptationFingerprint,
});
let adaptationBelief = adaptationInitialRequest.beliefState;
const adaptationRequests = [adaptationInitialRequest];
for (let failureCount = 1; failureCount <= 4; failureCount += 1) {
  adaptationBelief = decision.updateMechanicBelief(adaptationBelief, {
    mechanicKey: adaptationMechanicKey,
    adaptationKey: adaptationFamilyKey,
    estimatedProbability: 0.6,
    experience: 0.425,
    success: false,
  });
  adaptationRequests.push(prepareAdaptationRequest(adaptationBelief));
}
const adaptationAudits = adaptationRequests.map(requestEntry => {
  const result = decision.runProvider({
    providerId: 'r8',
    request: requestEntry,
  });
  const uncertain = result.decisionAudit.candidateAudit.find(candidate =>
    String(candidate?.declaration?.skill?.id || '') === 'adaptation-uncertain'
  );
  const reliable = result.decisionAudit.candidateAudit.find(candidate =>
    String(candidate?.declaration?.skill?.id || '') === 'adaptation-reliable'
  );
  const hitProbability = uncertain?.primaryRoute?.healthTrajectoryByTarget?.[0]
    ?.outcomeDistribution
    ?.filter(branch => Number(branch?.healthDeltaPP || 0) < 0)
    .reduce((sum, branch) => sum + Number(branch?.probability || 0), 0);
  return {
    request: requestEntry,
    result,
    uncertain,
    reliable,
    hitProbability: Number(hitProbability || 0),
  };
});
const initialAdaptation = adaptationAudits[0];
const retainedAdaptation = adaptationAudits[1];
const switchedAdaptation = adaptationAudits[4];
add(
  'oracle:belief-failure-rebuilds-routes-and-switches-only-after-value-crossing',
  initialAdaptation.result.selectedDeclaration?.skill?.id ===
    'adaptation-uncertain' &&
    retainedAdaptation.result.selectedDeclaration?.skill?.id ===
      'adaptation-uncertain' &&
    switchedAdaptation.result.selectedDeclaration?.skill?.id ===
      'adaptation-reliable' &&
    initialAdaptation.hitProbability > retainedAdaptation.hitProbability &&
    retainedAdaptation.hitProbability > switchedAdaptation.hitProbability &&
    initialAdaptation.uncertain.primaryRoute.routeKey !==
      retainedAdaptation.uncertain.primaryRoute.routeKey &&
    retainedAdaptation.uncertain.primaryRoute.routeKey !==
      switchedAdaptation.uncertain.primaryRoute.routeKey &&
    initialAdaptation.reliable.primaryRoute.routeKey ===
      retainedAdaptation.reliable.primaryRoute.routeKey &&
    retainedAdaptation.reliable.primaryRoute.routeKey ===
      switchedAdaptation.reliable.primaryRoute.routeKey &&
    retainedAdaptation.uncertain.objectiveUtilityHEPP >
      retainedAdaptation.reliable.objectiveUtilityHEPP &&
    switchedAdaptation.uncertain.objectiveUtilityHEPP <
      switchedAdaptation.reliable.objectiveUtilityHEPP &&
    switchedAdaptation.uncertain.rejectionCode === '' &&
    switchedAdaptation.request.beliefState.mechanics[adaptationMechanicKey]
      ?.observations === 4 &&
    switchedAdaptation.request.beliefState.mechanics[adaptationFamilyKey]
      ?.observations === 4 &&
    new Set(adaptationRequests.map(requestEntry =>
      requestEntry.evaluationContext.beliefRevision
    )).size === 5,
  {
    mechanicKey: adaptationMechanicKey,
    adaptationKey: adaptationFamilyKey,
    steps: adaptationAudits.map((audit, failureCount) => ({
      failureCount,
      beliefRevision: audit.request.evaluationContext.beliefRevision,
      selectedSkillId: String(audit.result.selectedDeclaration?.skill?.id || ''),
      uncertainUtility: Number(audit.uncertain?.objectiveUtilityHEPP || 0),
      reliableUtility: Number(audit.reliable?.objectiveUtilityHEPP || 0),
      uncertainRouteKey: String(audit.uncertain?.primaryRoute?.routeKey || ''),
      reliableRouteKey: String(audit.reliable?.primaryRoute?.routeKey || ''),
      uncertainHitProbability: audit.hitProbability,
      uncertainRejectionCode: String(audit.uncertain?.rejectionCode || ''),
    })),
  },
);

const entropyInvariantCandidates = [
  {
    candidateId: 'entropy-best',
    objectiveUtilityHEPP: 1,
    informationValueHEPP: 0,
    assetReserve: 0,
    survivalLowerBound: 0,
    worstTailLossHEPP: 0,
    discardedOverkillPP: 0,
    rejectionCode: '',
  },
  {
    candidateId: 'entropy-near',
    objectiveUtilityHEPP: 0.8,
    informationValueHEPP: 0,
    assetReserve: 1,
    survivalLowerBound: 0,
    worstTailLossHEPP: 0,
    discardedOverkillPP: 0,
    rejectionCode: '',
  },
];
const entropyInvariantRequest = {
  seed: 19,
  actorId: 'entropy-actor',
  actorSide: 'team_player',
  visibleWorld: {
    参战者: {
      team_player: [unit('entropy-actor', 'player', 100)],
      team_enemy: [unit('entropy-target', 'enemy', 100)],
    },
  },
  actionOpportunity: {
    opportunityId: 'natural:entropy:1',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  evaluationContext: {
    visibleWorldRevision: 'visible:entropy',
    beliefRevision: 'belief:entropy',
    objectiveHash: 'objective:entropy',
    opportunityRevision: 'opportunity:entropy',
    resourceTimelineRevision: 'resource:entropy',
    scheduleRevision: 'schedule:entropy',
  },
};
const entropyInvariantLeft = decision.selectR8Candidate({
  ...entropyInvariantRequest,
  requestHash: 'request:before-audit-field',
  candidateEnvelopeMetrics: { rebuildCount: 1 },
}, entropyInvariantCandidates);
const entropyInvariantRight = decision.selectR8Candidate({
  ...entropyInvariantRequest,
  requestHash: 'request:after-audit-field',
  candidateEnvelopeMetrics: {
    rebuildCount: 1,
    pressureOnlyHealthEvaluationCount: 999,
  },
}, entropyInvariantCandidates.map(candidate => ({
  ...candidate,
  pressureOnly: false,
})));
add(
  'oracle:softmax-entropy-ignores-request-and-audit-shape',
  entropyInvariantLeft.selectionMode === 'SEEDED_SOFTMAX' &&
    entropyInvariantRight.selectionMode === 'SEEDED_SOFTMAX' &&
    entropyInvariantLeft.selectionEntropyKey === entropyInvariantRight.selectionEntropyKey &&
    entropyInvariantLeft.selectionRoll === entropyInvariantRight.selectionRoll &&
    entropyInvariantLeft.selected?.candidateId === entropyInvariantRight.selected?.candidateId,
  {
    left: {
      selectedCandidateId: entropyInvariantLeft.selected?.candidateId || '',
      selectionEntropyKey: entropyInvariantLeft.selectionEntropyKey || '',
      selectionRoll: entropyInvariantLeft.selectionRoll,
    },
    right: {
      selectedCandidateId: entropyInvariantRight.selected?.candidateId || '',
      selectionEntropyKey: entropyInvariantRight.selectionEntropyKey || '',
      selectionRoll: entropyInvariantRight.selectionRoll,
    },
  },
);

const runtimeAdaptationWorld = structuredClone(adaptationWorld);
runtimeAdaptationWorld.回合 = 0;
runtimeAdaptationWorld.胜负条件 = objective();
for (const combatant of [
  ...runtimeAdaptationWorld.参战者.team_player,
  ...runtimeAdaptationWorld.参战者.team_enemy,
]) {
  combatant.hp = 1000;
  combatant.hp_max = 1000;
  combatant.属性.HP = 1000;
  combatant.属性.HP上限 = 1000;
  combatant.属性.等级 = 30;
}
runtimeAdaptationWorld.参战者.team_enemy[0].技能列表 = [
  damageSkill('adaptation-target-weak', 1),
];
const runtimeAdaptationResult = runtime.runBattleCase({
  caseId: 'phase7-runtime-adaptation-crossing',
  seed: 4,
  combatData: runtimeAdaptationWorld,
  mode: 'team_preview',
  rounds: 5,
  battleIntent: {
    mode: '击杀',
    objectives: runtimeAdaptationWorld.胜负条件,
  },
  settings: {
    providerId: 'r8',
  },
});
const runtimeAdaptationDecisions = runtimeAdaptationResult.decisions
  .filter(entry =>
    entry.actorId === 'adaptation-actor' &&
    entry.actionRole === 'ACTIVE'
  );
const runtimeAdaptationMisses = runtimeAdaptationResult.beliefObservations
  .filter(entry =>
    entry.observationType === 'MECHANIC_RESULT' &&
    entry.actorId === 'adaptation-actor' &&
    entry.actionRole === 'ACTIVE' &&
    entry.candidateId === adaptationUncertainCandidate.candidateId &&
    entry.success === false
  );
const runtimeAdaptationReliableObservations = runtimeAdaptationResult.beliefObservations
  .filter(entry =>
    entry.observationType === 'MECHANIC_RESULT' &&
    entry.actorId === 'adaptation-actor' &&
    entry.candidateId.includes('adaptation-reliable')
  );
const runtimeAdaptationTargetRealizations = runtimeAdaptationResult.beliefObservations
  .filter(entry =>
    entry.observationType === 'TARGET_REALIZATION' &&
    entry.actorId === 'adaptation-actor' &&
    entry.sourceActorId === 'adaptation-actor' &&
    entry.targetId === 'adaptation-target'
  );
const runtimeAdaptationRoundFour = runtimeAdaptationDecisions[3];
const runtimeRoundFourUncertain = runtimeAdaptationRoundFour?.candidateAudit?.find(candidate =>
  String(candidate?.candidateId || '').includes('adaptation-uncertain')
);
const runtimeRoundFourReliable = runtimeAdaptationRoundFour?.candidateAudit?.find(candidate =>
  String(candidate?.candidateId || '').includes('adaptation-reliable')
);
const runtimeMissLedgerEvents = runtimeAdaptationMisses.map(observation =>
  runtimeAdaptationResult.ledger.find(event => event.eventId === observation.sourceEventId)
);
add(
  'oracle:runtime-mechanic-result-rebuilds-routes-and-switches-after-value-crossing',
  runtimeAdaptationResult.audit?.fatalCount === 0 &&
    runtimeAdaptationDecisions.length === 5 &&
    runtimeAdaptationDecisions[0]?.selected?.candidateId ===
      adaptationUncertainCandidate.candidateId &&
    runtimeAdaptationDecisions[1]?.selected?.candidateId ===
      adaptationUncertainCandidate.candidateId &&
    runtimeAdaptationDecisions[2]?.selected?.candidateId ===
      adaptationUncertainCandidate.candidateId &&
    runtimeAdaptationDecisions[3]?.selected?.candidateId.includes('adaptation-reliable') &&
    runtimeAdaptationDecisions.slice(3).every(entry => {
      const uncertain = entry?.candidateAudit?.find(candidate =>
        String(candidate?.candidateId || '').includes('adaptation-uncertain')
      );
      const reliable = entry?.candidateAudit?.find(candidate =>
        String(candidate?.candidateId || '').includes('adaptation-reliable')
      );
      return Number(uncertain?.objectiveUtilityHEPP || 0) <
        Number(reliable?.objectiveUtilityHEPP || 0);
    }) &&
    (
      runtimeAdaptationDecisions[4]?.selected?.candidateId.includes(
        'adaptation-reliable',
      ) ||
      runtimeAdaptationDecisions[4]?.decisionProfile?.selectionMode ===
        'SEEDED_SOFTMAX'
    ) &&
    runtimeAdaptationMisses.length >= 3 &&
    runtimeAdaptationMisses.slice(0, 3).every((observation, index, rows) =>
      index === 0 ||
      observation.posterior < rows[index - 1].posterior
    ) &&
    runtimeMissLedgerEvents.every(event =>
      event?.eventKind === 'hit_result' &&
      event?.result === 'miss'
    ) &&
    new Set(runtimeAdaptationDecisions.slice(0, 4).map(entry =>
      entry.selected?.primaryRoute?.routeKey
    )).size === 4 &&
    runtimeAdaptationRoundFour?.beliefState?.mechanics?.[adaptationMechanicKey]
      ?.observations === 3 &&
    runtimeAdaptationRoundFour?.beliefState?.mechanics?.[adaptationFamilyKey]
      ?.observations === 3 &&
    Number(runtimeRoundFourUncertain?.objectiveUtilityHEPP || 0) <
      Number(runtimeRoundFourReliable?.objectiveUtilityHEPP || 0) &&
    runtimeRoundFourUncertain?.rejectionCode === '' &&
    runtimeAdaptationReliableObservations.length === 0 &&
    runtimeAdaptationTargetRealizations.some(entry =>
      Number(entry.predictedValuePercent || 0) > 0 &&
      Number(entry.actualValuePercent || 0) > 0
    ) &&
    runtimeAdaptationRoundFour?.selected?.predictedOutcomeEvidence?.some(evidence =>
      evidence.outcomeKind === 'HP_DELTA' &&
      evidence.targetId === 'adaptation-target'
    ),
  {
    mechanicKey: adaptationMechanicKey,
    adaptationKey: adaptationFamilyKey,
    decisions: runtimeAdaptationDecisions.map(entry => ({
      round: entry.round,
      beliefRevision: entry.beliefRevision,
      selectedCandidateId: entry.selected?.candidateId || '',
      selectedRouteKey: entry.selected?.primaryRoute?.routeKey || '',
      uncertainUtility: Number(entry.candidateAudit?.find(candidate =>
        String(candidate?.candidateId || '').includes('adaptation-uncertain')
      )?.objectiveUtilityHEPP || 0),
      reliableUtility: Number(entry.candidateAudit?.find(candidate =>
        String(candidate?.candidateId || '').includes('adaptation-reliable')
      )?.objectiveUtilityHEPP || 0),
      selectionMode: entry.decisionProfile?.selectionMode || '',
      selectionEntropyKey: entry.decisionProfile?.selectionEntropyKey || '',
      selectionRoll: entry.decisionProfile?.selectionRoll ?? null,
    })),
    mechanicResults: runtimeAdaptationResult.beliefObservations.filter(entry =>
      entry.observationType === 'MECHANIC_RESULT' &&
      entry.actorId === 'adaptation-actor'
    ),
    targetRealizations: runtimeAdaptationTargetRealizations,
    missLedgerEvents: runtimeMissLedgerEvents,
    exactRecordBeforeSwitch:
      runtimeAdaptationRoundFour?.beliefState?.mechanics?.[adaptationMechanicKey] || null,
    familyRecordBeforeSwitch:
      runtimeAdaptationRoundFour?.beliefState?.mechanics?.[adaptationFamilyKey] || null,
    fatalCount: runtimeAdaptationResult.audit?.fatalCount || 0,
  },
);

const itemOwnershipWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [
      unit('producer', 'player', 100),
      unit('consumer', 'player', 45),
    ],
    team_enemy: [unit('item-enemy', 'enemy', 100)],
  },
};
const createdRecoveryItemSkill = {
  id: 'created-recovery-item',
  name: 'created-recovery-item',
  魂技名: 'created-recovery-item',
  承载方式: '造物承载',
  消耗: { 魂力: 0 },
  _效果数组: [{
    物品类型: '食物',
    数量: 1,
    有效期tick: 12,
    使用效果: [{
      原型: '资源变化',
      目标: '自身',
      资源: '生命',
      数值: '+20%',
    }],
  }],
};
const itemCreationSettlement = runtime.executeStructuredDeclaration({
  combatData: itemOwnershipWorld,
  declaration: {
    actorId: 'producer',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['producer'],
    creationRecipientId: 'consumer',
    skill: createdRecoveryItemSkill,
  },
});
const itemCreateFact = itemCreationSettlement.facts.find(fact =>
  String(fact?.eventKind || '') === 'create'
);
const itemCreateActionFact = itemCreationSettlement.facts.find(fact =>
  String(fact?.eventKind || '') === 'action_start'
);
const consumerCandidatesBeforeUse = decision.enumerateCandidates({
  worldSnapshot: itemOwnershipWorld,
  actorId: 'consumer',
  actionOpportunity: {
    opportunityId: 'natural:consumer:item-use',
    ownerId: 'consumer',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 2,
  },
  beliefState: {},
});
const consumerItemCandidate = consumerCandidatesBeforeUse.find(candidate =>
  String(candidate?.declaration?.actionKind || '') === 'USE_ITEM' &&
  String(candidate?.declaration?.skill?.name || '') === 'created-recovery-item'
);
let itemConsumeSettlement = null;
let consumerCandidatesAfterUse = [];
if (consumerItemCandidate) {
  itemConsumeSettlement = runtime.executeStructuredDeclaration({
    combatData: itemOwnershipWorld,
    declaration: consumerItemCandidate.declaration,
  });
  consumerCandidatesAfterUse = decision.enumerateCandidates({
    worldSnapshot: itemOwnershipWorld,
    actorId: 'consumer',
    actionOpportunity: {
      opportunityId: 'natural:consumer:item-used',
      ownerId: 'consumer',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 3,
    },
    beliefState: {},
  });
}
const itemConsumeFact = itemConsumeSettlement?.facts?.find(fact =>
  String(fact?.eventKind || '') === 'item_consume'
);
const itemConsumeActionFact = itemConsumeSettlement?.facts?.find(fact =>
  String(fact?.eventKind || '') === 'action_start'
);
add(
  'oracle:created-item-owner-autonomously-consumes-and-candidate-closes',
  itemCreateFact?.actorId === 'producer' &&
    itemCreateFact?.targetId === 'consumer' &&
    itemCreateFact?.meta?.producerId === 'producer' &&
    itemCreateFact?.meta?.ownerId === 'consumer' &&
    itemCreateFact?.sourceActionId === itemCreateActionFact?.actionId &&
    itemOwnershipWorld.参战者.team_player[0]?.背包?.['created-recovery-item'] ===
      undefined &&
    !!consumerItemCandidate &&
    itemConsumeFact?.actorId === 'consumer' &&
    itemConsumeFact?.meta?.quantityBefore === 1 &&
    itemConsumeFact?.meta?.remainingQuantity === 0 &&
    itemConsumeFact?.sourceActionId === itemConsumeActionFact?.actionId &&
    itemOwnershipWorld.参战者.team_player[1]?.背包?.['created-recovery-item']?.数量 ===
      0 &&
    !consumerCandidatesAfterUse.some(candidate =>
      String(candidate?.declaration?.actionKind || '') === 'USE_ITEM' &&
      String(candidate?.declaration?.skill?.name || '') === 'created-recovery-item'
    ),
  {
    createFact: itemCreateFact,
    consumeFact: itemConsumeFact,
    consumerItemCandidateId: String(consumerItemCandidate?.candidateId || ''),
    candidateCountBeforeUse: consumerCandidatesBeforeUse.length,
    candidateCountAfterUse: consumerCandidatesAfterUse.length,
    producerInventory: itemOwnershipWorld.参战者.team_player[0]?.背包 || {},
    consumerInventory: itemOwnershipWorld.参战者.team_player[1]?.背包 || {},
  },
);

let unavailableItemPreviewError = '';
let unavailableItemRuntimeError = '';
if (consumerItemCandidate) {
  try {
    preview.previewAction({
      worldSnapshot: itemOwnershipWorld,
      worldRevision: 'phase7:consumed-item-unavailable',
      actorId: 'consumer',
      declaration: consumerItemCandidate.declaration,
      actionFingerprint: consumerItemCandidate.declarationFingerprint,
      collectProbabilityBranches: true,
      horizon: 'SHALLOW',
      previewBudget: { maxNodes: 12 },
    });
  } catch (error) {
    unavailableItemPreviewError = String(error?.message || error);
  }
  try {
    runtime.executeStructuredDeclaration({
      combatData: itemOwnershipWorld,
      declaration: consumerItemCandidate.declaration,
    });
  } catch (error) {
    unavailableItemRuntimeError = String(error?.message || error);
  }
}
add(
  'oracle:formal-item-preview-and-runtime-reject-missing-inventory',
  unavailableItemPreviewError ===
      'battle_preview_item_unavailable:created-recovery-item' &&
    unavailableItemRuntimeError ===
      'battle_structured_item_unavailable:created-recovery-item',
  {
    unavailableItemPreviewError,
    unavailableItemRuntimeError,
  },
);

const poolWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [
      unit('actor', 'player', 100, [
        modifierSkill('hit-up', '自身', '命中', '+20%'),
        modifierSkill('dodge-down', '单体', '闪避', '-20%'),
        attributeSkill('defense-up', '自身', '防御', '+50%'),
        damageSkill('uncertain-attack', 150),
      ]),
      unit('ally', 'player', 100, [damageSkill('ally-uncertain-attack', 120)]),
    ],
    team_enemy: [unit('enemy', 'enemy', 100, [damageSkill('enemy-attack', 100)])],
  },
};
for (const combatant of [
  ...poolWorld.参战者.team_player,
  ...poolWorld.参战者.team_enemy,
]) {
  for (const skillEntry of combatant.技能列表 || []) {
    for (const effectEntry of skillEntry._效果数组 || []) {
      if (effectEntry.原型 === '伤害结算') effectEntry.命中概率 = '60%';
    }
  }
}
const poolRequest = decision.prepareDecisionRequest({
  worldSnapshot: poolWorld,
  actorId: 'actor',
  objectiveContract: poolWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:current',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      { opportunityId: 'natural:actor:current', ownerId: 'actor', grantType: 'NATURAL_ACTION', status: 'EXECUTING' },
      { opportunityId: 'natural:actor:next', ownerId: 'actor', grantType: 'NATURAL_ACTION', status: 'PENDING' },
      { opportunityId: 'natural:ally:next', ownerId: 'ally', grantType: 'NATURAL_ACTION', status: 'PENDING' },
      { opportunityId: 'natural:enemy:next', ownerId: 'enemy', grantType: 'NATURAL_ACTION', status: 'PENDING' },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 837000,
});
const hitCandidate = poolRequest.frozenCandidates.find(candidate => candidate.declaration.skill?.id === 'hit-up');
const dodgeCandidate = poolRequest.frozenCandidates.find(candidate => candidate.declaration.skill?.id === 'dodge-down');
const defenseCandidate = poolRequest.frozenCandidates.find(candidate => candidate.declaration.skill?.id === 'defense-up');
const hitProjection = decision.projectR8GoalUtility(
  poolRequest,
  hitCandidate,
  poolRequest.actorCandidateRoutes[hitCandidate.candidateId],
);
const dodgeProjection = decision.projectR8GoalUtility(
  poolRequest,
  dodgeCandidate,
  poolRequest.actorCandidateRoutes[dodgeCandidate.candidateId],
);
const defenseWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player', 100, [
      attributeSkill('defense-up', '自身', '防御', '+50%'),
      damageSkill('actor-attack', 100),
    ])],
    team_enemy: [unit('enemy', 'enemy', 100, [damageSkill('enemy-attack', 150)])],
  },
};
for (const combatant of [...defenseWorld.参战者.team_player, ...defenseWorld.参战者.team_enemy]) {
  for (const skillEntry of combatant.技能列表 || []) {
    for (const effectEntry of skillEntry._效果数组 || []) {
      if (effectEntry.原型 === '伤害结算') effectEntry.命中概率 = '60%';
    }
  }
}
const defenseRequest = decision.prepareDecisionRequest({
  worldSnapshot: defenseWorld,
  actorId: 'actor',
  objectiveContract: defenseWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:current',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [
      { opportunityId: 'natural:actor:current', ownerId: 'actor', grantType: 'NATURAL_ACTION', status: 'EXECUTING' },
      { opportunityId: 'natural:enemy:next', ownerId: 'enemy', grantType: 'NATURAL_ACTION', status: 'PENDING' },
    ],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 837002,
});
const defenseOnlyCandidate = defenseRequest.frozenCandidates.find(candidate =>
  candidate.declaration.skill?.id === 'defense-up'
);
const defenseProjection = decision.projectR8GoalUtility(
  defenseRequest,
  defenseOnlyCandidate,
  defenseRequest.actorCandidateRoutes[defenseOnlyCandidate.candidateId],
);
const poolRouteCache = decision.preparedRouteCacheSnapshot(poolRequest);
const hitBehaviorRoute = poolRouteCache.fullRoutesByUnit.actor.find(route =>
  route.candidateId === hitCandidate.candidateId
);
add(
  'oracle:real-preview-hit-and-dodge-change-action-pools',
    hitProjection.actionPoolHEPP > 0 &&
    dodgeProjection.actionPoolHEPP > hitProjection.actionPoolHEPP &&
    defenseProjection.actionPoolHEPP > 0 &&
    poolRequest.candidateEnvelopeDeltas[hitCandidate.candidateId].some(entry =>
      entry.targetId === 'actor' && entry.afterPP > entry.beforePP
    ) &&
    poolRequest.candidateEnvelopeDeltas[dodgeCandidate.candidateId].some(entry =>
      ['actor', 'ally'].includes(entry.targetId) && entry.afterPP > entry.beforePP
    ),
  {
    hitActionPoolHEPP: hitProjection.actionPoolHEPP,
    dodgeActionPoolHEPP: dodgeProjection.actionPoolHEPP,
    defenseActionPoolHEPP: defenseProjection.actionPoolHEPP,
    hitEnvelope: poolRequest.candidateEnvelopeDeltas[hitCandidate.candidateId],
    dodgeEnvelope: poolRequest.candidateEnvelopeDeltas[dodgeCandidate.candidateId],
    teamDefenseEnvelope: poolRequest.candidateEnvelopeDeltas[defenseCandidate.candidateId],
    defenseEnvelope: defenseRequest.candidateEnvelopeDeltas[defenseOnlyCandidate.candidateId],
  },
);
add(
  'oracle:real-indirect-action-value-is-owned-by-the-action-route',
  hitProjection.actionPoolHEPP > 0 &&
    Number(hitBehaviorRoute?.behaviorRouteUtilityHEPP || 0) >
      Number(hitBehaviorRoute?.objectiveRouteUtilityHEPP || 0) &&
    Math.abs(
      Number(hitBehaviorRoute?.behaviorRouteUtilityHEPP || 0) -
      (
        Number(hitBehaviorRoute?.objectiveRouteUtilityHEPP || 0) +
        Number(hitBehaviorRoute?.intrinsicActionPoolHEPP || 0) +
        Number(hitBehaviorRoute?.resourceActionPoolHEPP || 0)
      )
    ) < 1e-9,
  {
    hitProjection,
    hitBehaviorRoute,
  },
);

const providerWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player', 100, [damageSkill('weak', 50), damageSkill('strong', 150)])],
    team_enemy: [unit('enemy', 'enemy', 100, [damageSkill('enemy-attack', 80)])],
  },
};
const survivalThreatWorld = {
  回合: 0,
  胜负条件: {
    schemaVersion: '8.3-objective-1',
    startRound: 0,
    maxRounds: 5,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ALL',
      conditions: [{
        type: 'ROUND_REACHED',
        side: 'PLAYER',
        round: 5,
        requireActive: true,
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        type: 'TEAM_INCAPACITATED',
        side: 'PLAYER',
        scope: 'ALL',
      }],
    },
  },
  参战者: {
    team_player: [unit('survivor', 'player', 100, [damageSkill('survival-hit', 150)])],
    team_enemy: [unit('survival-threat', 'enemy', 5, [damageSkill('threat-hit', 100)])],
  },
};
const survivalThreatOpportunity = {
  opportunityId: 'natural:survivor:1',
  ownerId: 'survivor',
  role: 'ACTIVE',
  grantType: 'NATURAL_ACTION',
  sequence: 1,
  battleHorizon: {
    currentRound: 0,
    finalRound: 5,
  },
};
const survivalThreatRequest = decision.prepareDecisionRequest({
  worldSnapshot: survivalThreatWorld,
  actorId: 'survivor',
  objectiveContract: survivalThreatWorld.胜负条件,
  actionOpportunity: survivalThreatOpportunity,
  runtimeSnapshot: runtime.buildDecisionRuntimeSnapshot(
    survivalThreatWorld,
    'survivor',
    survivalThreatOpportunity,
  ),
  seed: 837002,
});
const survivalThreatResult = decision.runProvider({
  providerId: 'r8',
  request: survivalThreatRequest,
});
const survivalThreatAttack = survivalThreatResult.decisionAudit.candidateAudit
  .find(candidate => String(candidate?.actionKind || '') === 'BASIC_ATTACK');
add(
  'oracle:round-reached-probabilistic-incapacitation-uses-immediate-branch-resolution',
  survivalThreatAttack?.goalProjection?.directTrajectoryHEPP === 0 &&
    survivalThreatAttack?.goalProjection?.terminal?.terminalProbability === 0 &&
    Number(survivalThreatAttack?.goalProjection?.actionPoolHEPP || 0) > 0 &&
    survivalThreatAttack?.goalProjection?.actionPoolDeltas?.some(delta =>
      delta.outcomeKind === 'HEALTH_ROUTE_CHANGED' &&
      delta.ownerType === 'ACTION_POOL_DELTA' &&
      delta.evidence?.branchResolved === true &&
      delta.evidence?.futureThreatWindowResolved === false &&
      Array.isArray(delta.evidence?.sourceFactIds) &&
      delta.evidence.sourceFactIds.length > 0
    ),
  {
    selectedCandidateId: survivalThreatResult.selectedCandidateId,
    attack: survivalThreatAttack,
  },
);
const survivalRuntimeResult = runtime.runBattleCase({
  caseId: 'phase7-explicit-survival-runtime',
  seed: 837003,
  combatData: survivalThreatWorld,
  mode: 'team_preview',
  rounds: 5,
  battleIntent: {
    mode: '求生',
    objectives: survivalThreatWorld.胜负条件,
  },
  selectedAction: {
    actorId: 'survivor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['survival-threat'],
    skill: structuredClone(
      survivalThreatWorld.参战者.team_player[0].技能列表[0],
    ),
  },
  settings: {
    providerId: 'r8',
  },
});
const survivalRuntimeObjectiveEvents = (survivalRuntimeResult?.ledger || [])
  .filter(event => String(event?.eventKind || '') === 'battle_objective_resolved');
add(
  'oracle:runtime-obeys-explicit-survival-objective-after-enemy-exhaustion',
  survivalRuntimeResult?.winner === 'player' &&
    survivalRuntimeResult?.roundsExecuted === 5 &&
    survivalRuntimeObjectiveEvents.length === 1 &&
    Number(survivalRuntimeObjectiveEvents[0]?.round || 0) === 5 &&
    String(survivalRuntimeObjectiveEvents[0]?.meta?.terminalReason || '') ===
      'OBJECTIVE_VICTORY',
  {
    winner: survivalRuntimeResult?.winner,
    roundsExecuted: survivalRuntimeResult?.roundsExecuted,
    objectiveEvents: survivalRuntimeObjectiveEvents,
    fatals: survivalRuntimeResult?.audit?.fatals || [],
  },
);
const oneRoundSurvivalRuntimeResult = runtime.runBattleCase({
  caseId: 'phase7-explicit-survival-one-round-window',
  seed: 837004,
  combatData: survivalThreatWorld,
  mode: 'team_preview',
  rounds: 1,
  battleIntent: {
    mode: '求生',
    objectives: survivalThreatWorld.胜负条件,
  },
  settings: {
    providerId: 'r8',
  },
});
const oneRoundFirstDecision = oneRoundSurvivalRuntimeResult?.decisions?.[0];
const oneRoundDependencyKeys = oneRoundFirstDecision?.selected?.primaryRoute
  ?.dependencyKeys || [];
add(
  'oracle:execution-batch-limit-does-not-truncate-objective-horizon',
  oneRoundSurvivalRuntimeResult?.roundsExecuted === 1 &&
    oneRoundDependencyKeys.some(key =>
      String(key).startsWith('schedule:future-natural:5:')
    ),
  {
    roundsExecuted: oneRoundSurvivalRuntimeResult?.roundsExecuted,
    dependencyKeys: oneRoundDependencyKeys,
    fatals: oneRoundSurvivalRuntimeResult?.audit?.fatals || [],
  },
);
const oneRoundFormalDecisionHash = preview.stableHash(
  oneRoundSurvivalRuntimeResult?.decisions || [],
);
const oneRoundDiagnosticsMutation = structuredClone(
  oneRoundSurvivalRuntimeResult,
);
if (
  Array.isArray(oneRoundDiagnosticsMutation.decisionPerformanceDiagnostics) &&
  oneRoundDiagnosticsMutation.decisionPerformanceDiagnostics.length
) {
  oneRoundDiagnosticsMutation.decisionPerformanceDiagnostics[0]
    .candidateEnvelopeMetrics = {
      syntheticDiagnosticMutation: true,
    };
}
const oneRoundDraft = runtime.executeBattleDraftR8({
  caseId: 'phase7-performance-diagnostics-draft-isolation',
  seed: 837005,
  combatData: survivalThreatWorld,
  mode: 'team_preview',
  rounds: 1,
  battleIntent: {
    mode: '求生',
    objectives: survivalThreatWorld.胜负条件,
  },
  settings: {
    providerId: 'r8',
  },
});
add(
  'oracle:performance-diagnostics-stay-outside-formal-decision-audit-hash',
  Array.isArray(
    oneRoundSurvivalRuntimeResult?.decisionPerformanceDiagnostics
  ) &&
    oneRoundSurvivalRuntimeResult.decisionPerformanceDiagnostics.length > 0 &&
    (oneRoundSurvivalRuntimeResult?.decisions || []).every(entry =>
      !Object.hasOwn(entry, 'routeCacheMetrics') &&
      !Object.hasOwn(entry, 'candidateEnvelopeMetrics')
    ) &&
    preview.stableHash(
      oneRoundDiagnosticsMutation?.decisions || [],
    ) === oneRoundFormalDecisionHash &&
    !Object.hasOwn(oneRoundDraft, 'decisionPerformanceDiagnostics') &&
    (oneRoundDraft?.decisionAudit || []).every(entry =>
      !Object.hasOwn(entry, 'routeCacheMetrics') &&
      !Object.hasOwn(entry, 'candidateEnvelopeMetrics')
    ),
  {
    formalDecisionHash: oneRoundFormalDecisionHash,
    mutatedFormalDecisionHash: preview.stableHash(
      oneRoundDiagnosticsMutation?.decisions || [],
    ),
    diagnosticCount:
      oneRoundSurvivalRuntimeResult?.decisionPerformanceDiagnostics?.length ||
      0,
    draftKeys: Object.keys(oneRoundDraft || {}),
  },
);
const prepared = decision.prepareDecisionRequest({
  worldSnapshot: providerWorld,
  actorId: 'actor',
  objectiveContract: providerWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:actor:1',
    ownerId: 'actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  seed: 837001,
});
const beforeHash = preview.stableHash(prepared);
const shadow = decision.runProvider({ providerId: 'r8-shadow', request: prepared });
const formal = decision.runProvider({ providerId: 'r8', request: prepared });
add(
  'provider:r8-shadow-formal-same-kernel',
  shadow.selectedCandidateId === formal.selectedCandidateId &&
    preview.stableHash(shadow.decisionAudit) === preview.stableHash(formal.decisionAudit) &&
    preview.stableHash(prepared) === beforeHash,
  {
    shadowSelected: shadow.selectedCandidateId,
    formalSelected: formal.selectedCandidateId,
  },
);

const source = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
const providerBody = source.match(/function runR8Provider\([\s\S]*?(?=\n  function prepareDecisionRequest)/)?.[0] || '';
add(
  'source:r8-provider-does-not-call-old-scorers',
  providerBody.length > 0 &&
    !/\b(decideNext|decide|scoreCandidatesNext|scoreCandidate|stateUtilityNext|stateUtility)\s*\(/.test(providerBody),
);
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'), 'utf8');
const runtimeAssistBranch = runtimeSource.match(
  /else if \(node\.actionRole === 'ASSIST'[\s\S]*?(?=\n\s*} else \{)/,
)?.[0] || '';
add(
  'oracle:assist-window-does-not-bypass-decision-provider',
  !runtimeAssistBranch ||
    (
      /decideForNode\s*\(/.test(runtimeAssistBranch) &&
      !/技能列表\s*\|\|\s*\[\]\)\[0\]/.test(runtimeAssistBranch)
  ),
  { runtimeAssistBranch },
);
const publicActionObservationCall = runtimeSource.match(
  /decisionRuntime\.updatePublicObservation\(previous,\s*\{\s*sourceActorId,\s*sourceActionId:\s*actionEvent\.actionId,[\s\S]*?responseRole:\s*settledActionRole,[\s\S]*?\n\s*\}\)/,
)?.[0] || '';
add(
  'oracle:runtime-public-active-counter-observation-preserves-replay-contract',
  publicActionObservationCall.length > 0 &&
    /\bdeclaration\s*:/.test(publicActionObservationCall) &&
    /\blethal\s*:/.test(publicActionObservationCall) &&
    /\bincapacitating\s*:/.test(publicActionObservationCall) &&
    /\bcancelsOpportunity\s*:/.test(publicActionObservationCall) &&
    /\bbreaksObjective\s*:/.test(publicActionObservationCall),
  { publicActionObservationCall },
);

const mixedProbabilitySkill = {
  id: 'mixed-probability-action',
  name: 'mixed-probability-action',
  魂技名: 'mixed-probability-action',
  消耗: { 魂力: 0 },
  _效果数组: [
    {
      effectId: 'mixed-probability-state',
      原型: '状态施加',
      目标: '单体',
      状态: '迟缓',
      成功率: '50%',
      持续回合: 2,
      战斗效果: { hit_penalty: 0.2 },
    },
    {
      effectId: 'mixed-probability-damage',
      原型: '伤害结算',
      目标: '单体',
      威力倍率: 100,
      伤害类型: '近身攻击',
      命中概率: '50%',
    },
  ],
};
const mixedProbabilityWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('mixed-actor', 'player', 100, [mixedProbabilitySkill])],
    team_enemy: [unit('mixed-enemy', 'enemy', 100)],
  },
};
const mixedProbabilityCandidate = {
  candidateId: 'mixed-actor:skill:mixed-probability-action:0',
  declaration: {
    actionKind: 'RELEASE_SKILL',
    actorId: 'mixed-actor',
    targetIds: ['mixed-enemy'],
    skill: mixedProbabilitySkill,
  },
  declarationFingerprint: 'mixed-probability-declaration',
};
const mixedProbabilityPreview = preview.previewAction({
  worldSnapshot: mixedProbabilityWorld,
  actorId: 'mixed-actor',
  actorSide: 'team_player',
  declaration: mixedProbabilityCandidate.declaration,
  actionFingerprint: mixedProbabilityCandidate.declarationFingerprint,
  collectProbabilityBranches: true,
});
const mixedProbabilityRoute = decision.actionRouteFromPreview({
  candidate: mixedProbabilityCandidate,
  previewResult: mixedProbabilityPreview,
  worldSnapshot: mixedProbabilityWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'mixed-actor',
    actorSide: 'team_player',
    visibleWorld: mixedProbabilityWorld,
    objectiveContract: mixedProbabilityWorld.胜负条件,
    actionOpportunity: {
      opportunityId: 'natural:mixed-actor:1',
      ownerId: 'mixed-actor',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 1,
    },
  },
});
const mixedProbabilityStateEffect = mixedProbabilityRoute.actionPoolEffects
  .find(effect => effect.outcomeKind === 'STATE_CHANGED');
const mixedProbabilityPlannerRoute = {
  ...mixedProbabilityRoute,
  routeKey: 'route:mixed-probability-planner',
  intrinsicActionPoolDeltas: mixedProbabilityStateEffect
    ? [{
        ...mixedProbabilityStateEffect,
        ownerType: 'ACTION_POOL_DELTA',
        realizable: true,
        healthTrajectoryDeltaPP: 10,
        evidence: {
          ...(mixedProbabilityStateEffect.evidence || {}),
          r8RealizationProbability: 0.5,
          r8RealizedHealthTrajectoryDeltaPP: 20,
        },
      }]
    : [],
};
const mixedProbabilityPlan = decision.r8BuildResourceOpportunityPlan({
  worldSnapshot: mixedProbabilityWorld,
  actorSide: 'team_player',
  unitIds: ['mixed-actor'],
  routeCatalog: {
    'mixed-actor': decision.selectPrimaryBackupRoutes([
      mixedProbabilityPlannerRoute,
    ]),
  },
  fullRoutesByUnit: {
    'mixed-actor': [mixedProbabilityPlannerRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:mixed-actor:1',
    ownerId: 'mixed-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:mixed-actor:2',
    ownerId: 'mixed-actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  resourceTimeline: [],
});
const mixedProbabilityBranchMass = (mixedProbabilityPlan?.branchPlanSummary || [])
  .reduce((sum, branch) => sum + Number(branch?.probability || 0), 0);
const mixedProbabilityBranchHashes = new Set(
  (mixedProbabilityPlan?.branchPlanSummary || [])
    .map(branch => String(branch?.worldStateHash || '').trim())
    .filter(Boolean),
);
const mixedProbabilityStateProjection = operationGraphProjection(
  mixedProbabilityPreview,
  mixedProbabilityWorld,
);
add(
  'oracle:probabilistic-state-and-direct-health-share-exact-branch-worlds',
  mixedProbabilityPreview?.operationGraph?.outcomeGroups?.length === 1 &&
    mixedProbabilityStateProjection?.finalStates?.length === 2 &&
    Math.abs(
      mixedProbabilityStateProjection.finalStates.reduce(
        (sum, branch) => sum + Number(branch?.probability || 0),
        0,
      ) - 1,
    ) < 1e-9 &&
    mixedProbabilityRoute?.operationGraph?.graphHash ===
      mixedProbabilityPreview?.operationGraph?.graphHash &&
    mixedProbabilityRoute?.healthTrajectoryByTarget?.some(entry =>
      entry.outcomeKind === 'HP_DELTA' &&
      entry.outcomeDistribution?.some(branch =>
        Number(branch?.probability || 0) > 0 &&
        Number(branch?.probability || 0) < 1
      )
    ) &&
    mixedProbabilityPlan?.probabilisticStateUnresolved === false &&
    mixedProbabilityPlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    mixedProbabilityPlan?.branchPlanCount === 4 &&
    Math.abs(mixedProbabilityBranchMass - 1) < 1e-9 &&
    mixedProbabilityBranchHashes.size === 4,
  {
    operationStateCount:
      mixedProbabilityStateProjection?.finalStates?.length || 0,
    outcomeGroupCount:
      mixedProbabilityPreview?.operationGraph?.outcomeGroups?.length || 0,
    plan: {
      probabilisticStateUnresolved: mixedProbabilityPlan?.probabilisticStateUnresolved,
      probabilityProjectionMode: mixedProbabilityPlan?.probabilityProjectionMode,
      branchPlanCount: mixedProbabilityPlan?.branchPlanCount,
      branchMass: mixedProbabilityBranchMass,
      branchWorldHashes: [...mixedProbabilityBranchHashes],
    },
  },
);

const multiProbabilityStateSkill = {
  id: 'multi-probability-state-action',
  name: 'multi-probability-state-action',
  魂技名: 'multi-probability-state-action',
  消耗: { 魂力: 0 },
  _效果数组: [
    {
      effectId: 'multi-probability-state-a',
      原型: '状态施加',
      目标: '单体',
      状态: '迟缓',
      成功率: '50%',
      持续回合: 2,
      战斗效果: { hit_penalty: 0.2 },
    },
    {
      effectId: 'multi-probability-state-b',
      原型: '状态施加',
      目标: '单体',
      状态: '致盲',
      成功率: '50%',
      持续回合: 2,
      战斗效果: { hit_penalty: 0.3 },
    },
  ],
};
const multiProbabilityStateWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit(
      'multi-state-actor',
      'player',
      100,
      [multiProbabilityStateSkill],
    )],
    team_enemy: [unit('multi-state-enemy', 'enemy', 100)],
  },
};
const multiProbabilityStateCandidate = {
  candidateId: 'multi-state-actor:skill:multi-probability-state-action:0',
  declaration: {
    actionKind: 'RELEASE_SKILL',
    actorId: 'multi-state-actor',
    targetIds: ['multi-state-enemy'],
    skill: multiProbabilityStateSkill,
  },
  declarationFingerprint: 'multi-probability-state-declaration',
};
const multiProbabilityStatePreview = preview.previewAction({
  worldSnapshot: multiProbabilityStateWorld,
  actorId: 'multi-state-actor',
  actorSide: 'team_player',
  declaration: multiProbabilityStateCandidate.declaration,
  actionFingerprint: multiProbabilityStateCandidate.declarationFingerprint,
  collectProbabilityBranches: true,
  previewBudget: { maxProbabilityBranches: 16 },
});
const multiProbabilityStateRoute = decision.actionRouteFromPreview({
  candidate: multiProbabilityStateCandidate,
  previewResult: multiProbabilityStatePreview,
  worldSnapshot: multiProbabilityStateWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'multi-state-actor',
    actorSide: 'team_player',
    visibleWorld: multiProbabilityStateWorld,
    objectiveContract: multiProbabilityStateWorld.胜负条件,
    actionOpportunity: {
      opportunityId: 'natural:multi-state-actor:1',
      ownerId: 'multi-state-actor',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 1,
    },
  },
});
const multiProbabilityStateEffects =
  multiProbabilityStateRoute.actionPoolEffects.filter(effect =>
    effect.outcomeKind === 'STATE_CHANGED'
  );
const multiProbabilityStatePlannerRoute = {
  ...multiProbabilityStateRoute,
  routeKey: 'route:multi-probability-state-planner',
  intrinsicActionPoolDeltas: multiProbabilityStateEffects.map(effect => ({
    ...effect,
    ownerType: 'ACTION_POOL_DELTA',
    realizable: true,
    healthTrajectoryDeltaPP: 10,
    evidence: {
      ...(effect.evidence || {}),
      r8RealizationProbability: 0.5,
      r8RealizedHealthTrajectoryDeltaPP: 20,
    },
  })),
};
const multiProbabilityStatePlan = decision.r8BuildResourceOpportunityPlan({
  worldSnapshot: multiProbabilityStateWorld,
  actorSide: 'team_player',
  unitIds: ['multi-state-actor'],
  routeCatalog: {
    'multi-state-actor': decision.selectPrimaryBackupRoutes([
      multiProbabilityStatePlannerRoute,
    ]),
  },
  fullRoutesByUnit: {
    'multi-state-actor': [multiProbabilityStatePlannerRoute],
  },
  actionOpportunity: {
    opportunityId: 'natural:multi-state-actor:1',
    ownerId: 'multi-state-actor',
    round: 1,
    sequence: 1,
  },
  opportunitySnapshot: [{
    opportunityId: 'natural:multi-state-actor:2',
    ownerId: 'multi-state-actor',
    round: 1,
    sequence: 2,
    status: 'PENDING',
  }],
  scheduledEvents: [],
  resourceTimeline: [],
});
const multiProbabilityStateBranchMass =
  (multiProbabilityStatePlan?.branchPlanSummary || [])
    .reduce((sum, branch) => sum + Number(branch?.probability || 0), 0);
const multiProbabilityStateUtilities =
  (multiProbabilityStatePlan?.branchPlanSummary || [])
    .map(branch => Number(branch?.cumulativeUtilityHEPP || 0))
    .sort((left, right) => left - right);
const multiProbabilityStateProjection = operationGraphProjection(
  multiProbabilityStatePreview,
  multiProbabilityStateWorld,
);
add(
  'oracle:multiple-probabilistic-states-expand-to-complete-combination-worlds',
  multiProbabilityStatePreview?.operationGraph?.outcomeGroups?.length === 2 &&
    multiProbabilityStateProjection?.rawCartesianUpperBound === 4 &&
    multiProbabilityStateProjection?.finalStates?.length === 4 &&
    Math.abs(
      multiProbabilityStateProjection.finalStates.reduce(
        (sum, branch) => sum + Number(branch?.probability || 0),
        0,
      ) - 1,
    ) < 1e-9 &&
    new Set(
      multiProbabilityStateProjection.finalStates.map(branch =>
        Object.entries(branch?.assignments || {})
          .filter(([key]) => key.includes('|'))
          .map(([key, outcome]) => `${key}:${outcome}`)
          .sort()
          .join('|')
      ),
    ).size === 4 &&
    multiProbabilityStateRoute?.operationGraph?.graphHash ===
      multiProbabilityStatePreview?.operationGraph?.graphHash &&
    multiProbabilityStatePlan?.probabilisticStateUnresolved === false &&
    multiProbabilityStatePlan?.probabilityProjectionMode ===
      'EXACT_PROBABILISTIC_BRANCH_STATE' &&
    multiProbabilityStatePlan?.branchPlanCount === 4 &&
    Math.abs(multiProbabilityStateBranchMass - 1) < 1e-9 &&
    multiProbabilityStateUtilities.length === 4 &&
    Math.abs(multiProbabilityStateUtilities[0] - 0) < 1e-9 &&
    Math.abs(multiProbabilityStateUtilities[1] - 20) < 1e-9 &&
    Math.abs(multiProbabilityStateUtilities[2] - 20) < 1e-9 &&
    Math.abs(multiProbabilityStateUtilities[3] - 40) < 1e-9,
  {
    outcomeGroupCount:
      multiProbabilityStatePreview?.operationGraph?.outcomeGroups?.length || 0,
    operationProjection: {
      rawCartesianUpperBound:
        multiProbabilityStateProjection?.rawCartesianUpperBound,
      finalStateCount:
        multiProbabilityStateProjection?.finalStates?.length || 0,
    },
    plan: {
      probabilisticStateUnresolved:
        multiProbabilityStatePlan?.probabilisticStateUnresolved,
      probabilityProjectionMode:
        multiProbabilityStatePlan?.probabilityProjectionMode,
      branchPlanCount: multiProbabilityStatePlan?.branchPlanCount,
      branchMass: multiProbabilityStateBranchMass,
      utilities: multiProbabilityStateUtilities,
    },
  },
);

const followPrimarySkill = {
  id: 'follow-primary-correlation',
  name: 'follow-primary-correlation',
  魂技名: 'follow-primary-correlation',
  消耗: { 魂力: 0 },
  _效果数组: [
    {
      effectId: 'follow-primary-damage',
      原型: '伤害结算',
      目标: '单体',
      生效方式: '独立生效',
      威力倍率: 100,
      伤害类型: '近身攻击',
    },
    {
      effectId: 'follow-primary-slow',
      原型: '状态施加',
      目标: '单体',
      生效方式: '跟随主原型',
      状态: '迟缓',
      成功率: '100%',
      持续回合: 2,
      战斗效果: { speed_penalty: 0.5 },
    },
    {
      effectId: 'follow-primary-blind',
      原型: '状态施加',
      目标: '单体',
      生效方式: '跟随主原型',
      状态: '致盲',
      成功率: '100%',
      持续回合: 2,
      战斗效果: { hit_penalty: 0.2 },
    },
  ],
};
const followPrimaryWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit(
      'follow-primary-actor',
      'player',
      100,
      [followPrimarySkill],
    )],
    team_enemy: [unit('follow-primary-enemy', 'enemy', 100)],
  },
};
const followPrimaryCandidate = {
  candidateId: 'follow-primary-actor:skill:follow-primary-correlation:0',
  declarationFingerprint: 'follow-primary-correlation:fingerprint',
  declaration: {
    actionId: 'follow-primary-correlation',
    actorId: 'follow-primary-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['follow-primary-enemy'],
    skill: followPrimarySkill,
  },
};
const followPrimaryPreview = preview.previewAction({
  worldSnapshot: followPrimaryWorld,
  worldRevision: 'phase7:follow-primary-correlation',
  actorId: 'follow-primary-actor',
  declaration: followPrimaryCandidate.declaration,
  actionFingerprint: followPrimaryCandidate.declarationFingerprint,
  hitProbabilityResolver: () => 0.5,
  applicationProbabilityResolver: ({ baseApplicationProbability }) =>
    baseApplicationProbability,
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const followPrimaryPreparedRequest = decision.prepareDecisionRequest({
  worldSnapshot: followPrimaryWorld,
  actorId: 'follow-primary-actor',
  objectiveContract: followPrimaryWorld.胜负条件,
  actionOpportunity: {
    opportunityId: 'natural:follow-primary-actor:1',
    ownerId: 'follow-primary-actor',
    role: 'ACTIVE',
    grantType: 'NATURAL_ACTION',
    sequence: 1,
  },
  runtimeSnapshot: {
    opportunitySnapshot: [],
    resourceTimeline: [],
    scheduledEvents: [],
  },
  seed: 837030,
});
const followPrimaryPreparedCandidate = followPrimaryPreparedRequest.frozenCandidates.find(
  candidate => String(candidate?.candidateId || '').includes(
    ':skill:follow-primary-correlation:',
  ),
);
const followPrimaryPreparedRoute = followPrimaryPreparedRequest.actorCandidateRoutes?.[
  followPrimaryPreparedCandidate?.candidateId
];
const followPrimaryFollowerEffect = (
  followPrimaryPreparedRoute?.actionPoolEffects || []
).find(effectEntry =>
  effectEntry?.outcomeKind === 'STATE_CHANGED' &&
  String(effectEntry?.effectInstanceId || '').includes('follow-primary-slow')
);
const followPrimaryFollowerPrediction = (
  followPrimaryPreparedRequest.predictedOutcomeEvidenceByCandidate?.[
    followPrimaryPreparedCandidate?.candidateId
  ] || []
).find(evidence =>
  evidence?.outcomeKind === 'STATE_CHANGED' &&
  String(evidence?.sourceEffectId || '').includes('follow-primary-slow')
);
add(
  'oracle:follow-primary-public-prediction-uses-application-probability',
  Number(followPrimaryFollowerEffect?.evidence?.applicationProbability || 0) >
      0 &&
    Number(followPrimaryFollowerEffect?.evidence?.applicationProbability || 0) <
      1 &&
    Math.abs(
      Number(followPrimaryFollowerPrediction?.hitProbability || 0) -
      Number(
        followPrimaryFollowerEffect?.evidence?.applicationProbability || 0,
      )
    ) < 1e-12,
  {
    candidateId: followPrimaryPreparedCandidate?.candidateId || '',
    followerEffect: followPrimaryFollowerEffect,
    followerPrediction: followPrimaryFollowerPrediction,
  },
);
const followPrimaryProjection = operationGraphProjection(
  followPrimaryPreview,
  followPrimaryWorld,
);
const followPrimaryStateNames = branch => new Set(
  Object.values(
    branch?.world?.参战者?.team_enemy?.[0]?.状态效果 || {},
  ).map(state => String(state?.状态 || state?.状态名称 || '').trim()),
);
const followPrimaryBranchProfiles =
  (followPrimaryProjection?.finalStates || []).map(branch => ({
    probability: Number(branch?.probability || 0),
    states: [...followPrimaryStateNames(branch)].sort(),
  }));
add(
  'oracle:follow-primary-deterministic-effects-share-one-primary-outcome',
  followPrimaryPreview?.operationGraph?.outcomeGroups?.length === 1 &&
    followPrimaryProjection?.rawCartesianUpperBound === 2 &&
    followPrimaryProjection?.finalStates?.length === 2 &&
    followPrimaryBranchProfiles.some(branch =>
      Math.abs(branch.probability - 0.5) < 1e-9 &&
      branch.states.length === 0
    ) &&
    followPrimaryBranchProfiles.some(branch =>
      Math.abs(branch.probability - 0.5) < 1e-9 &&
      branch.states.length === 2 &&
      branch.states.includes('迟缓') &&
      branch.states.includes('致盲')
    ) &&
    !followPrimaryBranchProfiles.some(branch =>
      branch.states.length === 1
    ),
  {
    outcomeGroups: followPrimaryPreview?.operationGraph?.outcomeGroups,
    conditionalEvents: followPrimaryPreview?.operationGraph?.conditionalEvents,
    branchProfiles: followPrimaryBranchProfiles,
  },
);

const followPrimaryOwnCheckSkill = {
  id: 'follow-primary-own-check',
  name: 'follow-primary-own-check',
  魂技名: 'follow-primary-own-check',
  消耗: { 魂力: 0 },
  _效果数组: [
    {
      effectId: 'follow-own-primary-damage',
      原型: '伤害结算',
      目标: '单体',
      生效方式: '独立生效',
      威力倍率: 100,
      伤害类型: '近身攻击',
    },
    {
      effectId: 'follow-own-state',
      原型: '状态施加',
      目标: '单体',
      生效方式: '跟随主原型',
      状态: '迟缓',
      成功率: '50%',
      持续回合: 2,
      战斗效果: { speed_penalty: 0.5 },
    },
  ],
};
const followPrimaryOwnCheckCandidate = {
  candidateId: 'follow-primary-actor:skill:follow-primary-own-check:0',
  declarationFingerprint: 'follow-primary-own-check:fingerprint',
  declaration: {
    actionId: 'follow-primary-own-check',
    actorId: 'follow-primary-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['follow-primary-enemy'],
    skill: followPrimaryOwnCheckSkill,
  },
};
const followPrimaryOwnCheckPreview = preview.previewAction({
  worldSnapshot: followPrimaryWorld,
  worldRevision: 'phase7:follow-primary-own-check',
  actorId: 'follow-primary-actor',
  declaration: followPrimaryOwnCheckCandidate.declaration,
  actionFingerprint: followPrimaryOwnCheckCandidate.declarationFingerprint,
  hitProbabilityResolver: () => 0.5,
  applicationProbabilityResolver: ({ baseApplicationProbability }) =>
    baseApplicationProbability,
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const followPrimaryOwnCheckProjection = preview.evaluateOperationGraph({
  graph: followPrimaryOwnCheckPreview.operationGraph,
  baseState: { world: followPrimaryWorld },
  projectionContract: {
    kind: 'PHASE7_FOLLOW_PRIMARY_OWN_CHECK',
    mergeKey: 'FULL',
  },
  maxActiveStates: 64,
});
const followPrimaryOwnCheckProfiles =
  (followPrimaryOwnCheckProjection?.finalStates || []).map(branch => ({
    probability: Number(branch?.probability || 0),
    hasState: followPrimaryStateNames(branch).has('迟缓'),
  }));
add(
  'oracle:follow-primary-own-check-remains-conditional-after-primary-hit',
  followPrimaryOwnCheckPreview?.operationGraph?.outcomeGroups?.length === 2 &&
    followPrimaryOwnCheckProjection?.rawCartesianUpperBound === 4 &&
    followPrimaryOwnCheckProjection?.finalStates?.length === 2 &&
    Math.abs(
      followPrimaryOwnCheckProfiles
        .filter(branch => branch.hasState)
        .reduce((sum, branch) => sum + branch.probability, 0) -
        0.25
    ) < 1e-9 &&
    Math.abs(
      followPrimaryOwnCheckProfiles
        .filter(branch => !branch.hasState)
        .reduce((sum, branch) => sum + branch.probability, 0) -
        0.75
    ) < 1e-9,
  {
    outcomeGroups:
      followPrimaryOwnCheckPreview?.operationGraph?.outcomeGroups,
    conditionalEvents:
      followPrimaryOwnCheckPreview?.operationGraph?.conditionalEvents,
    branchProfiles: followPrimaryOwnCheckProfiles,
  },
);

function followPrimaryVariant({
  id,
  follower,
  configureWorld = () => {},
}) {
  const skill = {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [
      {
        effectId: `${id}:primary`,
        原型: '伤害结算',
        目标: '单体',
        生效方式: '独立生效',
        威力倍率: 100,
        伤害类型: '近身攻击',
      },
      {
        effectId: `${id}:follower`,
        目标: '单体',
        生效方式: '跟随主原型',
        ...follower,
      },
    ],
  };
  const world = {
    回合: 1,
    胜负条件: objective(),
    参战者: {
      team_player: [unit(`${id}:actor`, 'player', 100, [skill])],
      team_enemy: [unit(`${id}:enemy`, 'enemy', 100)],
    },
  };
  configureWorld(world);
  const candidate = {
    candidateId: `${id}:actor:skill:${id}:0`,
    declarationFingerprint: `${id}:fingerprint`,
    declaration: {
      actionId: id,
      actorId: `${id}:actor`,
      actionKind: 'RELEASE_SKILL',
      targetIds: [`${id}:enemy`],
      skill,
    },
  };
  let previewResult = null;
  let previewError = '';
  try {
    previewResult = preview.previewAction({
      worldSnapshot: world,
      worldRevision: `phase7:${id}`,
      actorId: `${id}:actor`,
      declaration: candidate.declaration,
      actionFingerprint: candidate.declarationFingerprint,
      hitProbabilityResolver: () => 0.5,
      applicationProbabilityResolver: ({ baseApplicationProbability }) =>
        baseApplicationProbability,
      collectProbabilityBranches: true,
      horizon: 'SHALLOW',
      previewBudget: { maxNodes: 12 },
    });
  } catch (error) {
    previewError = String(error?.message || error);
  }
  return {
    skill,
    world,
    candidate,
    previewResult,
    previewError,
    projection: previewResult
      ? operationGraphProjection(previewResult, world)
      : null,
  };
}

const followResourceChange = followPrimaryVariant({
  id: 'follow-primary-resource-change',
  follower: {
    原型: '资源变化',
    资源: '魂力',
    数值: -20,
  },
});
const followResourceChangeValues =
  (followResourceChange.projection?.finalStates || [])
    .map(branch => preview.readResource(
      preview.findUnit(
        branch.world,
        'follow-primary-resource-change:enemy',
      ),
      '魂力',
    ))
    .sort((left, right) => left - right);
add(
  'oracle:follow-primary-resource-change-shares-primary-outcome',
  followResourceChange.previewResult?.operationGraph?.outcomeGroups?.length === 1 &&
    followResourceChange.projection?.finalStates?.length === 2 &&
    followResourceChangeValues.length === 2 &&
    Math.abs(followResourceChangeValues[0] - 80) < 1e-9 &&
    Math.abs(followResourceChangeValues[1] - 100) < 1e-9,
  {
    error: followResourceChange.previewError,
    outcomeGroups:
      followResourceChange.previewResult?.operationGraph?.outcomeGroups,
    conditionalEvents:
      followResourceChange.previewResult?.operationGraph?.conditionalEvents,
    resourceValues: followResourceChangeValues,
  },
);

const followResourceTransfer = followPrimaryVariant({
  id: 'follow-primary-resource-transfer',
  follower: {
    原型: '资源转移',
    资源: '魂力',
    数值: 20,
    资源转移方式: '吞噬',
  },
  configureWorld(world) {
    const actor = world.参战者.team_player[0];
    actor.sp = 50;
    actor.属性.魂力 = 50;
  },
});
const followResourceTransferProfiles =
  (followResourceTransfer.projection?.finalStates || []).map(branch => ({
    probability: Number(branch?.probability || 0),
    actorResource: preview.readResource(
      preview.findUnit(
        branch.world,
        'follow-primary-resource-transfer:actor',
      ),
      '魂力',
    ),
    enemyResource: preview.readResource(
      preview.findUnit(
        branch.world,
        'follow-primary-resource-transfer:enemy',
      ),
      '魂力',
    ),
  }));
add(
  'oracle:follow-primary-resource-transfer-is-one-atomic-conserved-outcome',
  followResourceTransfer.previewResult?.operationGraph?.outcomeGroups?.length === 1 &&
    followResourceTransfer.projection?.finalStates?.length === 2 &&
    followResourceTransferProfiles.every(branch =>
      Math.abs(branch.actorResource + branch.enemyResource - 150) < 1e-9
    ) &&
    followResourceTransferProfiles.some(branch =>
      Math.abs(branch.probability - 0.5) < 1e-9 &&
      Math.abs(branch.actorResource - 50) < 1e-9 &&
      Math.abs(branch.enemyResource - 100) < 1e-9
    ) &&
    followResourceTransferProfiles.some(branch =>
      Math.abs(branch.probability - 0.5) < 1e-9 &&
      Math.abs(branch.actorResource - 70) < 1e-9 &&
      Math.abs(branch.enemyResource - 80) < 1e-9
    ),
  {
    error: followResourceTransfer.previewError,
    outcomeGroups:
      followResourceTransfer.previewResult?.operationGraph?.outcomeGroups,
    conditionalEvents:
      followResourceTransfer.previewResult?.operationGraph?.conditionalEvents,
    branchProfiles: followResourceTransferProfiles,
  },
);

const followShield = followPrimaryVariant({
  id: 'follow-primary-shield',
  follower: {
    原型: '护盾变化',
    数值: 20,
    护盾模式: '正向护盾',
  },
});
const followShieldProfiles =
  (followShield.projection?.finalStates || []).map(branch => ({
    probability: Number(branch?.probability || 0),
    shield: preview.readShield(
      preview.findUnit(branch.world, 'follow-primary-shield:enemy'),
    ),
  }));
add(
  'oracle:follow-primary-shield-remains-exact-not-expectation-scaled',
  followShield.previewResult?.operationGraph?.outcomeGroups?.length === 1 &&
    followShield.projection?.finalStates?.length === 2 &&
    followShieldProfiles.some(branch =>
      Math.abs(branch.probability - 0.5) < 1e-9 &&
      Math.abs(branch.shield) < 1e-9
    ) &&
    followShieldProfiles.some(branch =>
      Math.abs(branch.probability - 0.5) < 1e-9 &&
      Math.abs(branch.shield - 20) < 1e-9
    ),
  {
    error: followShield.previewError,
    contributions: followShield.previewResult?.contributions,
    outcomeGroups: followShield.previewResult?.operationGraph?.outcomeGroups,
    conditionalEvents:
      followShield.previewResult?.operationGraph?.conditionalEvents,
    branchProfiles: followShieldProfiles,
  },
);

const followAttribute = followPrimaryVariant({
  id: 'follow-primary-attribute',
  follower: {
    原型: '属性修正',
    属性: '敏捷',
    数值: '20%',
    持续回合: 2,
  },
});
const followAttributeContribution =
  (followAttribute.previewResult?.contributions || []).find(entry =>
    entry?.effectInstanceId === 'follow-primary-attribute:follower'
  );
add(
  'oracle:follow-primary-attribute-keeps-full-effect-behind-primary-condition',
  followAttribute.previewResult?.operationGraph?.outcomeGroups?.length === 1 &&
    String(
      followAttributeContribution?.evidence?.projectedEffect?.数值 ??
      followAttributeContribution?.evidence?.value ??
      ''
    ).includes('20') &&
    String(
      followAttribute.previewResult?.operationGraph?.conditionalEvents?.[0]
        ?.payload?.effect?.数值 || ''
    ).includes('20') &&
    Object.keys(
      followAttribute.previewResult?.operationGraph?.conditionalEvents?.[0]
        ?.conditionalOn || {},
    ).some(key => key.includes('primary-resolution')),
  {
    error: followAttribute.previewError,
    contribution: followAttributeContribution,
    outcomeGroups: followAttribute.previewResult?.operationGraph?.outcomeGroups,
    conditionalEvents:
      followAttribute.previewResult?.operationGraph?.conditionalEvents,
  },
);

const followSummon = followPrimaryVariant({
  id: 'follow-primary-summon',
  follower: {
    原型: '召唤生成',
    召唤单位类型: '本命召唤兽',
    召唤物名称: 'phase7-follow-summon',
    数量: 1,
    持续回合: 2,
    行动模式: '自主行动',
    继承属性比例: 0.3,
  },
});
const followSummonSchedule =
  (followSummon.previewResult?.scheduledEvents || []).find(event =>
    String(event?.type || '').trim().toUpperCase() === 'SUMMON_CREATE'
  );
const followSummonGroup =
  (followSummon.previewResult?.operationGraph?.outcomeGroups || []).find(group =>
    (group?.effectInstanceIds || []).includes('follow-primary-summon:follower')
  );
add(
  'oracle:follow-primary-summon-uses-primary-group-without-second-roll',
  Boolean(followSummonSchedule?.requiredOutcomeKey) &&
    followSummon.previewResult?.operationGraph?.outcomeGroups?.length === 1 &&
    followSummonGroup?.groupKey === followSummonSchedule?.requiredOutcomeKey &&
    (followSummon.previewResult?.operationGraph?.conditionalEvents || [])
      .filter(event => event?.operation === 'SUMMON_CREATE')
      .every(event =>
        event?.conditionalOn?.[followSummonSchedule.requiredOutcomeKey] === 'HIT'
      ),
  {
    error: followSummon.previewError,
    scheduledEvent: followSummonSchedule,
    outcomeGroups: followSummon.previewResult?.operationGraph?.outcomeGroups,
    conditionalEvents:
      followSummon.previewResult?.operationGraph?.conditionalEvents,
  },
);

const followResourceLifecycle = followResourceChange.previewResult
  ? preview.buildLifecycleEventSet(
      followResourceChange.previewResult,
      {
        worldSnapshot: followResourceChange.world,
      },
    )
  : null;
const followResourceLifecycleEvent =
  (followResourceLifecycle?.events || []).find(event =>
    event?.kind === 'RESOURCE_REDUCE'
  );
add(
  'oracle:lifecycle-resource-event-preserves-primary-outcome-condition',
  Boolean(followResourceLifecycleEvent) &&
    followResourceLifecycleEvent?.conditionalOn?.[
      followResourceChange.previewResult?.contributions?.find(entry =>
        entry?.outcomeKind === 'RESOURCE_OPTION_CHANGED'
      )?.evidence?.requiredOutcomeKey
    ] === 'HIT',
  {
    lifecycleEvent: followResourceLifecycleEvent,
    contribution:
      followResourceChange.previewResult?.contributions?.find(entry =>
        entry?.outcomeKind === 'RESOURCE_OPTION_CHANGED'
      ),
  },
);

const followPrimaryGroupTargetIds = Array.from(
  { length: 7 },
  (_, index) => `follow-primary-target-${index + 1}`,
);
const followPrimaryGroupSkill = {
  ...followPrimarySkill,
  id: 'follow-primary-group',
  name: 'follow-primary-group',
  魂技名: 'follow-primary-group',
  _效果数组: followPrimarySkill._效果数组.map(effectEntry => ({
    ...effectEntry,
    effectId: effectEntry.effectId.replace(
      'follow-primary-',
      'follow-primary-group-',
    ),
    目标: '群体',
  })),
};
const followPrimaryGroupWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit(
      'follow-primary-group-actor',
      'player',
      100,
      [followPrimaryGroupSkill],
    )],
    team_enemy: followPrimaryGroupTargetIds.map(targetId =>
      unit(targetId, 'enemy', 100)
    ),
  },
};
const followPrimaryGroupCandidate = {
  candidateId: 'follow-primary-group-actor:skill:follow-primary-group:0',
  declarationFingerprint: 'follow-primary-group:fingerprint',
  declaration: {
    actionId: 'follow-primary-group',
    actorId: 'follow-primary-group-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: followPrimaryGroupTargetIds,
    skill: followPrimaryGroupSkill,
  },
};
const followPrimaryGroupPreview = preview.previewAction({
  worldSnapshot: followPrimaryGroupWorld,
  worldRevision: 'phase7:follow-primary-group',
  actorId: 'follow-primary-group-actor',
  declaration: followPrimaryGroupCandidate.declaration,
  actionFingerprint: followPrimaryGroupCandidate.declarationFingerprint,
  hitProbabilityResolver: () => 0.5,
  applicationProbabilityResolver: ({ baseApplicationProbability }) =>
    baseApplicationProbability,
  collectProbabilityBranches: true,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const followPrimaryGroupRoute = decision.actionRouteFromPreview({
  candidate: followPrimaryGroupCandidate,
  previewResult: followPrimaryGroupPreview,
  worldSnapshot: followPrimaryGroupWorld,
  actorSide: 'team_player',
  dependencyKeys: [],
  objectiveRequest: {
    actorId: 'follow-primary-group-actor',
    actorSide: 'team_player',
    visibleWorld: followPrimaryGroupWorld,
    objectiveContract: followPrimaryGroupWorld.胜负条件,
  },
});
const followPrimaryGroupEffects =
  (followPrimaryGroupRoute?.actionPoolEffects || []).filter(effectEntry =>
    effectEntry?.outcomeKind === 'STATE_CHANGED'
  );
const followPrimaryGroupPlannerRoute = {
  ...followPrimaryGroupRoute,
  routeKey: 'route:follow-primary-group-planner',
  healthTrajectoryByTarget: Object.freeze([]),
  routeBenefitPP: 0,
  objectiveRouteUtilityHEPP: 0,
  intrinsicActionPoolHEPP: 35,
  intrinsicBehaviorUtilityHEPP: 35,
  behaviorRouteUtilityHEPP: 35,
  intrinsicActionPoolDeltas: Object.freeze(
    followPrimaryGroupEffects.map(effectEntry => Object.freeze({
      ...effectEntry,
      ownerType: 'ACTION_POOL_DELTA',
      realizable: true,
      healthTrajectoryDeltaPP: 2.5,
      evidence: Object.freeze({
        ...(effectEntry?.evidence || {}),
        r8RealizationProbability: 0.5,
        r8RealizedHealthTrajectoryDeltaPP: 5,
      }),
    })),
  ),
};
let followPrimaryGroupPlan = null;
let followPrimaryGroupPlanError = '';
try {
  followPrimaryGroupPlan = decision.r8BuildResourceOpportunityPlan({
    worldSnapshot: followPrimaryGroupWorld,
    actorSide: 'team_player',
    unitIds: ['follow-primary-group-actor'],
    routeCatalog: {
      'follow-primary-group-actor':
        decision.selectPrimaryBackupRoutes([followPrimaryGroupPlannerRoute]),
    },
    fullRoutesByUnit: {
      'follow-primary-group-actor': [followPrimaryGroupPlannerRoute],
    },
    actionOpportunity: {
      opportunityId: 'natural:follow-primary-group-actor:1',
      ownerId: 'follow-primary-group-actor',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: [{
      opportunityId: 'natural:follow-primary-group-actor:2',
      ownerId: 'follow-primary-group-actor',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    }],
    scheduledEvents: [],
    resourceTimeline: [],
    objectiveContract: followPrimaryGroupWorld.胜负条件,
  });
} catch (error) {
  followPrimaryGroupPlanError = String(error?.message || error);
}
add(
  'oracle:multi-target-follow-primary-planner-uses-marginal-sufficient-state',
  !followPrimaryGroupPlanError &&
    followPrimaryGroupPreview?.operationGraph?.outcomeGroups?.length === 7 &&
    followPrimaryGroupEffects.length === 14 &&
    Math.abs(
      Number(followPrimaryGroupPlan?.cumulativeUtilityHEPP || 0) - 35
    ) < 1e-9 &&
    Number(followPrimaryGroupPlan?.branchPlanCount || 0) <= 8,
  {
    error: followPrimaryGroupPlanError,
    outcomeGroupCount:
      followPrimaryGroupPreview?.operationGraph?.outcomeGroups?.length || 0,
    actionPoolEffectCount: followPrimaryGroupEffects.length,
    plan: followPrimaryGroupPlan,
  },
);

const followPrimaryGroupMixedPlannerRoute = {
  ...followPrimaryGroupPlannerRoute,
  routeKey: 'route:follow-primary-group-mixed-planner',
  healthTrajectoryByTarget: followPrimaryGroupRoute.healthTrajectoryByTarget,
  routeBenefitPP: Number(followPrimaryGroupRoute.routeBenefitPP || 0),
  objectiveRouteUtilityHEPP: Number(
    followPrimaryGroupRoute.objectiveRouteUtilityHEPP || 0
  ),
};
let followPrimaryGroupMixedPlan = null;
let followPrimaryGroupMixedPlanError = '';
try {
  followPrimaryGroupMixedPlan = decision.r8BuildResourceOpportunityPlan({
    worldSnapshot: followPrimaryGroupWorld,
    actorSide: 'team_player',
    unitIds: ['follow-primary-group-actor'],
    routeCatalog: {
      'follow-primary-group-actor':
        decision.selectPrimaryBackupRoutes([
          followPrimaryGroupMixedPlannerRoute,
        ]),
    },
    fullRoutesByUnit: {
      'follow-primary-group-actor': [
        followPrimaryGroupMixedPlannerRoute,
      ],
    },
    actionOpportunity: {
      opportunityId: 'natural:follow-primary-group-actor:mixed:1',
      ownerId: 'follow-primary-group-actor',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: [{
      opportunityId: 'natural:follow-primary-group-actor:mixed:2',
      ownerId: 'follow-primary-group-actor',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    }],
    scheduledEvents: [],
    resourceTimeline: [],
    objectiveContract: followPrimaryGroupWorld.胜负条件,
  });
} catch (error) {
  followPrimaryGroupMixedPlanError = String(error?.message || error);
}
const followPrimaryGroupMixedRow =
  followPrimaryGroupMixedPlan?.rows?.[0] || null;
add(
  'oracle:mixed-health-state-over-64-uses-marginal-only-when-safe',
  !followPrimaryGroupMixedPlanError &&
    followPrimaryGroupMixedPlannerRoute.healthTrajectoryByTarget.length > 0 &&
    followPrimaryGroupPreview?.operationGraph?.outcomeGroups?.length === 7 &&
    followPrimaryGroupMixedRow?.projectionMode ===
      'MARGINAL_SUFFICIENT_BEHAVIOR_STATE' &&
    followPrimaryGroupTargetIds.every(targetId =>
      Number(followPrimaryGroupMixedRow?.hpAfter?.[targetId] || 100) > 0 &&
      Number(followPrimaryGroupMixedRow?.hpAfter?.[targetId] || 100) < 100
    ) &&
    Number(followPrimaryGroupMixedPlan?.branchPlanCount || 0) <= 8,
  {
    error: followPrimaryGroupMixedPlanError,
    healthTrajectoryCount:
      followPrimaryGroupMixedPlannerRoute.healthTrajectoryByTarget.length,
    rawCartesianUpperBound: 2 ** Number(
      followPrimaryGroupPreview?.operationGraph?.outcomeGroups?.length || 0
    ),
    row: followPrimaryGroupMixedRow,
    plan: followPrimaryGroupMixedPlan,
  },
);

const hpSensitiveGroupWorld = structuredClone(followPrimaryGroupWorld);
hpSensitiveGroupWorld.参战者.team_enemy[0].技能列表 = [{
  id: 'hp-sensitive-route',
  name: 'hp-sensitive-route',
  驱动属性: 'HP',
  _效果数组: [{
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 10,
  }],
}];
let hpSensitiveGroupPlanError = '';
try {
  decision.r8BuildResourceOpportunityPlan({
    worldSnapshot: hpSensitiveGroupWorld,
    actorSide: 'team_player',
    unitIds: ['follow-primary-group-actor'],
    routeCatalog: {
      'follow-primary-group-actor':
        decision.selectPrimaryBackupRoutes([
          followPrimaryGroupMixedPlannerRoute,
        ]),
    },
    fullRoutesByUnit: {
      'follow-primary-group-actor': [
        followPrimaryGroupMixedPlannerRoute,
      ],
    },
    actionOpportunity: {
      opportunityId: 'natural:follow-primary-group-actor:unsafe:1',
      ownerId: 'follow-primary-group-actor',
      round: 1,
      sequence: 1,
    },
    opportunitySnapshot: [{
      opportunityId: 'natural:follow-primary-group-actor:unsafe:2',
      ownerId: 'follow-primary-group-actor',
      round: 1,
      sequence: 2,
      status: 'PENDING',
    }],
    scheduledEvents: [],
    resourceTimeline: [],
    objectiveContract: hpSensitiveGroupWorld.胜负条件,
  });
} catch (error) {
  hpSensitiveGroupPlanError = String(error?.message || error);
}
add(
  'oracle:mixed-health-state-over-64-refuses-marginal-for-hp-sensitive-target',
  hpSensitiveGroupPlanError.startsWith(
    'BATTLE_PREVIEW_PROBABILITY_BRANCH_BUDGET_EXCEEDED:'
  ),
  { error: hpSensitiveGroupPlanError },
);

const localCacheWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [
      unit('local-cache-actor', 'player', 100, [
        damageSkill('local-cache-actor-weak', 60),
        damageSkill('local-cache-actor-strong', 140),
      ]),
      unit('local-cache-ally', 'player', 100, [
        damageSkill('local-cache-ally-hit', 90),
      ]),
    ],
    team_enemy: [unit('local-cache-enemy', 'enemy', 100, [
      damageSkill('local-cache-enemy-hit', 110),
    ])],
  },
};
const localCacheOpportunity = {
  opportunityId: 'natural:local-cache-actor:1',
  ownerId: 'local-cache-actor',
  role: 'ACTIVE',
  grantType: 'NATURAL_ACTION',
  sequence: 1,
};
const localCacheRuntimeSnapshot = runtime.buildDecisionRuntimeSnapshot(
  localCacheWorld,
  'local-cache-actor',
  localCacheOpportunity,
);
const localCacheBaseRequest = decision.prepareDecisionRequest({
  worldSnapshot: localCacheWorld,
  actorId: 'local-cache-actor',
  objectiveContract: localCacheWorld.胜负条件,
  actionOpportunity: localCacheOpportunity,
  runtimeSnapshot: localCacheRuntimeSnapshot,
  seed: 837100,
});
const localCacheBaseRoutes =
  decision.preparedRouteCacheSnapshot(localCacheBaseRequest);
const localCacheChangedWorld = structuredClone(localCacheWorld);
const localCacheChangedAlly =
  localCacheChangedWorld.参战者.team_player.find(entry =>
    entry.id === 'local-cache-ally'
  );
localCacheChangedAlly.def = 220;
localCacheChangedAlly.属性.防御 = 220;
const localCacheChangedRuntimeSnapshot = runtime.buildDecisionRuntimeSnapshot(
  localCacheChangedWorld,
  'local-cache-actor',
  localCacheOpportunity,
);
const localCacheIncrementalRequest = decision.prepareDecisionRequest({
  worldSnapshot: localCacheChangedWorld,
  actorId: 'local-cache-actor',
  objectiveContract: localCacheChangedWorld.胜负条件,
  actionOpportunity: localCacheOpportunity,
  runtimeSnapshot: localCacheChangedRuntimeSnapshot,
  previousRouteCatalog: localCacheBaseRequest.actionRouteCatalog,
  previousFullRoutesByUnit: localCacheBaseRoutes.fullRoutesByUnit,
  previousActorCandidateRoutes:
    localCacheBaseRoutes.actorCandidateRoutes,
  previousActorProjectedWorlds:
    localCacheBaseRoutes.actorProjectedWorlds,
  previousActorProjectedWorldRevisions:
    localCacheBaseRoutes.actorProjectedWorldRevisions,
  previousActorPredictedOutcomeEvidence:
    localCacheBaseRoutes.actorPredictedOutcomeEvidence,
  previousActorCandidateEnvelopeDeltas:
    localCacheBaseRoutes.actorCandidateEnvelopeDeltas,
  affectedRouteUnitIds: ['local-cache-ally'],
  affectedRouteTargetUnitIds: ['local-cache-ally'],
  routeInvalidationAudit: {
    changedDependencyKeys: ['target:local-cache-ally:defense'],
  },
  seed: 837100,
});
const localCacheFullRequest = decision.prepareDecisionRequest({
  worldSnapshot: localCacheChangedWorld,
  actorId: 'local-cache-actor',
  objectiveContract: localCacheChangedWorld.胜负条件,
  actionOpportunity: localCacheOpportunity,
  runtimeSnapshot: localCacheChangedRuntimeSnapshot,
  seed: 837100,
});
let localCacheIncrementalResult = null;
let localCacheIncrementalError = '';
try {
  localCacheIncrementalResult = decision.runProvider({
    providerId: 'r8',
    request: localCacheIncrementalRequest,
  });
} catch (error) {
  localCacheIncrementalError = String(error?.message || error);
}
let localCacheFullResult = null;
let localCacheFullError = '';
try {
  localCacheFullResult = decision.runProvider({
    providerId: 'r8',
    request: localCacheFullRequest,
  });
} catch (error) {
  localCacheFullError = String(error?.message || error);
}
const localCacheRouteSemantic = requestValue => ({
  actorCandidateRoutes: Object.fromEntries(
    Object.entries(requestValue?.actorCandidateRoutes || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([candidateId, routeValue]) => [
        candidateId,
        {
          routeKey: routeValue?.routeKey,
          routeBenefitPP: routeValue?.routeBenefitPP,
          objectiveRouteUtilityHEPP: routeValue?.objectiveRouteUtilityHEPP,
          intrinsicBehaviorUtilityHEPP:
            routeValue?.intrinsicBehaviorUtilityHEPP,
          behaviorRouteUtilityHEPP: routeValue?.behaviorRouteUtilityHEPP,
          targetIds: routeValue?.targetIds,
          healthTrajectoryByTarget: routeValue?.healthTrajectoryByTarget,
          intrinsicActionPoolDeltas: routeValue?.intrinsicActionPoolDeltas,
        },
      ]),
  ),
  routeCatalog: Object.fromEntries(
    Object.entries(requestValue?.actionRouteCatalog || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([unitIdValue, envelope]) => [
        unitIdValue,
        {
          primaryRouteKey: envelope?.primaryRoute?.routeKey || '',
          backupRouteKey: envelope?.backupRoute?.routeKey || '',
          primaryValue:
            envelope?.primaryRoute?.behaviorRouteUtilityHEPP ??
            envelope?.primaryRoute?.routeBenefitPP ??
            0,
          backupValue:
            envelope?.backupRoute?.behaviorRouteUtilityHEPP ??
            envelope?.backupRoute?.routeBenefitPP ??
            0,
        },
      ]),
  ),
  candidateEnvelopeDeltas: requestValue?.candidateEnvelopeDeltas,
  teamMarginalPlan: requestValue?.teamMarginalPlan,
});
const localCacheDecisionSemantic = resultValue => ({
  selectedCandidateId: resultValue?.selectedCandidateId,
  selectedDeclaration: resultValue?.selectedDeclaration,
  candidates: (resultValue?.decisionAudit?.candidateAudit || []).map(entry => ({
    candidateId: entry?.candidateId,
    objectiveUtilityHEPP: entry?.objectiveUtilityHEPP,
    normalizedUtility: entry?.normalizedUtility,
    classification: entry?.classification,
    dominatedBy: entry?.dominatedBy,
    rejectionCode: entry?.rejectionCode,
    primaryRouteKey: entry?.route?.routeKey || entry?.primaryRoute?.routeKey || '',
  })),
});
const firstLocalCacheDifference = (left, right, path = '$') => {
  if (Object.is(left, right)) return null;
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return { path, left, right };
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return { path, left, right };
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  const keys = [...new Set([...leftKeys, ...rightKeys])].sort();
  for (const key of keys) {
    if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) {
      return {
        path: `${path}.${key}`,
        left: left[key],
        right: right[key],
      };
    }
    const difference = firstLocalCacheDifference(
      left[key],
      right[key],
      `${path}.${key}`,
    );
    if (difference) return difference;
  }
  return null;
};
const localCacheIncrementalRouteHash = preview.stableHash(
  localCacheRouteSemantic(localCacheIncrementalRequest),
);
const localCacheFullRouteHash = preview.stableHash(
  localCacheRouteSemantic(localCacheFullRequest),
);
const localCacheIncrementalDecisionHash = preview.stableHash(
  localCacheDecisionSemantic(localCacheIncrementalResult),
);
const localCacheFullDecisionHash = preview.stableHash(
  localCacheDecisionSemantic(localCacheFullResult),
);
const previousMechanicalCacheFlag =
  process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_CACHE;
const previousTerminalCacheFlag =
  process.env.BATTLE_R8_DISABLE_TERMINAL_SEMANTIC_CACHE;
const previousLightweightEnvelopeFlag =
  process.env.BATTLE_R8_DISABLE_LIGHTWEIGHT_ENVELOPE_ROUTE;
const previousMechanicalRouteCacheFlag =
  process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_ROUTE_CACHE;
const previousSummaryMergeDeferralCacheFlag =
  process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL;
const previousSimpleSummaryTerminalFlag =
  process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH;
process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_CACHE = '1';
process.env.BATTLE_R8_DISABLE_TERMINAL_SEMANTIC_CACHE = '1';
process.env.BATTLE_R8_DISABLE_LIGHTWEIGHT_ENVELOPE_ROUTE = '1';
process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_ROUTE_CACHE = '1';
process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL = '1';
process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH = '1';
let localCacheDisabledRequest = null;
let localCacheDisabledResult = null;
let localCacheDisabledSummaryTerminal = null;
let localCacheDisabledFullTerminal = null;
let localCacheDisabledError = '';
try {
  localCacheDisabledRequest = decision.prepareDecisionRequest({
    worldSnapshot: structuredClone(localCacheChangedWorld),
    actorId: 'local-cache-actor',
    objectiveContract: localCacheChangedWorld.胜负条件,
    actionOpportunity: localCacheOpportunity,
    runtimeSnapshot: runtime.buildDecisionRuntimeSnapshot(
      localCacheChangedWorld,
      'local-cache-actor',
      localCacheOpportunity,
    ),
    seed: 837100,
  });
  localCacheDisabledResult = decision.runProvider({
    providerId: 'r8',
    request: localCacheDisabledRequest,
  });
  const localCacheStrongCandidateId = Object.keys(
    localCacheDisabledRequest?.actorCandidateRoutes || {},
  ).find(candidateId =>
    candidateId.includes(':skill:local-cache-actor-strong:')
  );
  const localCacheStrongRoute =
    localCacheDisabledRequest?.actorCandidateRoutes?.[
      localCacheStrongCandidateId
    ];
  if (localCacheStrongRoute) {
    localCacheDisabledSummaryTerminal = decision.r8TerminalUtility(
      {
        ...localCacheDisabledRequest,
        terminalProjectionMode: 'SUMMARY',
        terminalCallOrigin: 'PHASE7_DISABLED_CACHE_SUMMARY',
      },
      structuredClone(localCacheStrongRoute),
    );
    localCacheDisabledFullTerminal = decision.r8TerminalUtility(
      {
        ...localCacheDisabledRequest,
        terminalProjectionMode: 'FULL',
        terminalCallOrigin: 'PHASE7_DISABLED_CACHE_FULL',
      },
      structuredClone(localCacheStrongRoute),
    );
  }
} catch (error) {
  localCacheDisabledError = String(error?.message || error);
} finally {
  if (previousMechanicalCacheFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_CACHE;
  } else {
    process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_CACHE =
      previousMechanicalCacheFlag;
  }
  if (previousTerminalCacheFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_TERMINAL_SEMANTIC_CACHE;
  } else {
    process.env.BATTLE_R8_DISABLE_TERMINAL_SEMANTIC_CACHE =
      previousTerminalCacheFlag;
  }
  if (previousLightweightEnvelopeFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_LIGHTWEIGHT_ENVELOPE_ROUTE;
  } else {
    process.env.BATTLE_R8_DISABLE_LIGHTWEIGHT_ENVELOPE_ROUTE =
      previousLightweightEnvelopeFlag;
  }
  if (previousMechanicalRouteCacheFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_ROUTE_CACHE;
  } else {
    process.env.BATTLE_R8_DISABLE_ENVELOPE_MECHANICAL_ROUTE_CACHE =
      previousMechanicalRouteCacheFlag;
  }
  if (previousSummaryMergeDeferralCacheFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL;
  } else {
    process.env.BATTLE_R8_DISABLE_SUMMARY_BRANCH_MERGE_DEFERRAL =
      previousSummaryMergeDeferralCacheFlag;
  }
  if (previousSimpleSummaryTerminalFlag === undefined) {
    delete process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH;
  } else {
    process.env.BATTLE_R8_DISABLE_SIMPLE_SUMMARY_TERMINAL_PATH =
      previousSimpleSummaryTerminalFlag;
  }
}
const localCacheDisabledRouteHash = preview.stableHash(
  localCacheRouteSemantic(localCacheDisabledRequest),
);
const localCacheDisabledDecisionHash = preview.stableHash(
  localCacheDecisionSemantic(localCacheDisabledResult),
);
const localCacheActorRouteHash = requestValue => preview.stableHash(
  requestValue?.actorCandidateRoutes || {},
);
const localCacheActorProjectedWorldHash = requestValue => preview.stableHash(
  requestValue?.actorProjectedWorlds || {},
);
const localCacheActorProjectedRevisionHash = requestValue => preview.stableHash(
  requestValue?.actorProjectedWorldRevisions || {},
);
const localCacheActorEvidenceHash = requestValue => preview.stableHash(
  requestValue?.predictedOutcomeEvidenceByCandidate ||
  requestValue?.actorPredictedOutcomeEvidence ||
  {},
);
add(
  'oracle:local-route-reuse-restores-current-actor-candidate-routes',
  localCacheActorRouteHash(localCacheIncrementalRequest) ===
    localCacheActorRouteHash(localCacheFullRequest) &&
    Object.keys(localCacheIncrementalRequest?.actorCandidateRoutes || {})
      .length > 0,
  {
    incrementalKeys:
      Object.keys(localCacheIncrementalRequest?.actorCandidateRoutes || {}),
    fullKeys: Object.keys(localCacheFullRequest?.actorCandidateRoutes || {}),
    incrementalHash: localCacheActorRouteHash(localCacheIncrementalRequest),
    fullHash: localCacheActorRouteHash(localCacheFullRequest),
  },
);
add(
  'oracle:local-route-reuse-restores-current-actor-projected-worlds',
  localCacheActorProjectedWorldHash(localCacheIncrementalRequest) ===
    localCacheActorProjectedWorldHash(localCacheFullRequest) &&
    Object.keys(localCacheIncrementalRequest?.actorProjectedWorlds || {})
      .length > 0,
  {
    incrementalKeys:
      Object.keys(localCacheIncrementalRequest?.actorProjectedWorlds || {}),
    fullKeys: Object.keys(localCacheFullRequest?.actorProjectedWorlds || {}),
    incrementalHash:
      localCacheActorProjectedWorldHash(localCacheIncrementalRequest),
    fullHash: localCacheActorProjectedWorldHash(localCacheFullRequest),
  },
);
add(
  'oracle:local-route-reuse-restores-current-actor-projected-revisions',
  localCacheActorProjectedRevisionHash(localCacheIncrementalRequest) ===
    localCacheActorProjectedRevisionHash(localCacheFullRequest),
  {
    incrementalKeys: Object.keys(
      localCacheIncrementalRequest?.actorProjectedWorldRevisions || {},
    ),
    fullKeys: Object.keys(
      localCacheFullRequest?.actorProjectedWorldRevisions || {},
    ),
    incrementalHash:
      localCacheActorProjectedRevisionHash(localCacheIncrementalRequest),
    fullHash: localCacheActorProjectedRevisionHash(localCacheFullRequest),
  },
);
add(
  'oracle:local-route-reuse-restores-current-actor-predicted-evidence',
  localCacheActorEvidenceHash(localCacheIncrementalRequest) ===
    localCacheActorEvidenceHash(localCacheFullRequest) &&
    Object.keys(
      localCacheIncrementalRequest?.predictedOutcomeEvidenceByCandidate ||
      localCacheIncrementalRequest?.actorPredictedOutcomeEvidence ||
      {},
    ).length > 0,
  {
    incrementalKeys: Object.keys(
      localCacheIncrementalRequest?.predictedOutcomeEvidenceByCandidate ||
      localCacheIncrementalRequest?.actorPredictedOutcomeEvidence ||
      {},
    ),
    fullKeys: Object.keys(
      localCacheFullRequest?.predictedOutcomeEvidenceByCandidate ||
      localCacheFullRequest?.actorPredictedOutcomeEvidence ||
      {},
    ),
    incrementalHash:
      localCacheActorEvidenceHash(localCacheIncrementalRequest),
    fullHash: localCacheActorEvidenceHash(localCacheFullRequest),
  },
);
add(
  'oracle:local-route-invalidation-matches-full-recompute-semantics',
  !localCacheIncrementalError &&
    !localCacheFullError &&
    Number(
      localCacheIncrementalRequest?.routeCacheMetrics
        ?.reusedMechanicalRouteCount || 0,
    ) > 0 &&
    localCacheIncrementalRouteHash === localCacheFullRouteHash &&
    localCacheIncrementalDecisionHash === localCacheFullDecisionHash,
  {
    incrementalError: localCacheIncrementalError,
    fullError: localCacheFullError,
    incrementalRouteHash: localCacheIncrementalRouteHash,
    fullRouteHash: localCacheFullRouteHash,
    firstRouteDifference: firstLocalCacheDifference(
      localCacheRouteSemantic(localCacheIncrementalRequest),
      localCacheRouteSemantic(localCacheFullRequest),
    ),
    incrementalDecisionHash: localCacheIncrementalDecisionHash,
    fullDecisionHash: localCacheFullDecisionHash,
    incrementalMetrics: localCacheIncrementalRequest?.routeCacheMetrics,
    fullMetrics: localCacheFullRequest?.routeCacheMetrics,
  },
);
add(
  'oracle:performance-reuse-switches-preserve-route-and-decision-hashes',
  !localCacheDisabledError &&
    localCacheDisabledRouteHash === localCacheFullRouteHash &&
    localCacheDisabledDecisionHash === localCacheFullDecisionHash,
  {
    error: localCacheDisabledError,
    cachedRouteHash: localCacheFullRouteHash,
    disabledRouteHash: localCacheDisabledRouteHash,
    cachedDecisionHash: localCacheFullDecisionHash,
    disabledDecisionHash: localCacheDisabledDecisionHash,
  },
);
add(
  'oracle:terminal-distribution-identity-survives-cache-disable',
  !!localCacheDisabledSummaryTerminal &&
    !!localCacheDisabledFullTerminal &&
    String(
      localCacheDisabledSummaryTerminal
        ?.mechanicalTerminalDistribution
        ?.distributionHash || '',
    ) !==
      String(
        localCacheDisabledFullTerminal
          ?.mechanicalTerminalDistribution
          ?.distributionHash || '',
      ) &&
    Number(
      localCacheDisabledFullTerminal
        ?.expectedOngoingTrajectoryUtility || 0,
    ) > 0 &&
    Number(
      localCacheDisabledFullTerminal?.ongoingBranchWorlds?.length || 0,
    ) > 0,
  {
    summaryDistributionHash: String(
      localCacheDisabledSummaryTerminal
        ?.mechanicalTerminalDistribution
        ?.distributionHash || '',
    ),
    fullDistributionHash: String(
      localCacheDisabledFullTerminal
        ?.mechanicalTerminalDistribution
        ?.distributionHash || '',
    ),
    fullExpectedOngoingTrajectoryUtility: Number(
      localCacheDisabledFullTerminal
        ?.expectedOngoingTrajectoryUtility || 0,
    ),
    fullOngoingBranchWorldCount: Number(
      localCacheDisabledFullTerminal?.ongoingBranchWorlds?.length || 0,
    ),
  },
);
add(
  'oracle:cross-decision-valued-route-and-actor-envelope-cache-reuse-is-hash-equivalent',
  Number(
    localCacheIncrementalRequest?.routeCacheMetrics
      ?.reusedValuedUnitCount || 0,
  ) > 0 &&
    preview.stableHash(
      localCacheBaseRoutes.actorCandidateEnvelopeDeltas || {},
    ) ===
      preview.stableHash(
        localCacheIncrementalRequest?.candidateEnvelopeDeltas || {},
      ) &&
    localCacheIncrementalRouteHash === localCacheFullRouteHash &&
    localCacheIncrementalDecisionHash === localCacheFullDecisionHash,
  {
    reusedValuedUnitCount:
      localCacheIncrementalRequest?.routeCacheMetrics
        ?.reusedValuedUnitCount || 0,
    cachedActorEnvelopeHash: preview.stableHash(
      localCacheBaseRoutes.actorCandidateEnvelopeDeltas || {},
    ),
    incrementalActorEnvelopeHash: preview.stableHash(
      localCacheIncrementalRequest?.candidateEnvelopeDeltas || {},
    ),
    incrementalRouteHash: localCacheIncrementalRouteHash,
    fullRouteHash: localCacheFullRouteHash,
    firstRouteDifference: firstLocalCacheDifference(
      localCacheRouteSemantic(localCacheIncrementalRequest),
      localCacheRouteSemantic(localCacheFullRequest),
    ),
    incrementalDecisionHash: localCacheIncrementalDecisionHash,
    fullDecisionHash: localCacheFullDecisionHash,
  },
);

const failed = checks.filter(check => !check.passed);
console.log(JSON.stringify({
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    executableContractCount: contracts.cases.length,
    r8ValueChainStatus: failed.length ? 'BLOCKED' : 'R8_GOAL_CAUSAL_SELECTION_CONTRACT_PASSED',
  },
  checks,
}, null, 2));
if (failed.length) process.exitCode = 1;

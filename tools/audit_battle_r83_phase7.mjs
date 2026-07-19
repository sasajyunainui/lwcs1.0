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
const contracts = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tools', 'evidence', 'r8', 'r75_minimal_case_contracts.json'), 'utf8'),
);
const checks = [];
const add = (checkId, passed, detail = {}) => checks.push({ checkId, passed: passed === true, ...detail });

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
    startRound: 1,
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
  return {
    routeKey: options.routeKey || 'route:test',
    candidateId: 'test',
    declarationFingerprint: 'declaration:test',
    targetIds: options.targetIds || ['enemy'],
    outcomeKinds: options.outcomeKinds || [],
    paymentDependencies: options.paymentDependencies || [],
    opportunityDependencies: options.opportunityDependencies || [],
    realizationWindows: options.realizationWindows || ['NOW'],
    healthTrajectoryByTarget: options.health || [],
    actionPoolEffects: options.effects || [],
    terminalPathId: '',
    probabilityBounds: { lower: 0, upper: 1 },
    dependencyKeys: [],
    routeBenefitPP: Number(options.routeBenefitPP || 0),
  };
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

function project(req, testRoute) {
  return decision.projectR8GoalUtility(req, { candidateId: 'test', declaration: { actionKind: 'RELEASE_SKILL' } }, testRoute);
}

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
add('oracle:defense-with-formal-window-preserved', decision.r8HasDefenseWindow(incomingRequest) === true);

function chargeWorld(power) {
  const actor = unit('actor', 'player', 100);
  const enemy = unit('enemy', 'enemy', 100);
  enemy.蓄力技能 = {
    id: `charge:${power}`,
    cast_time: 40,
    targetId: 'actor',
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
const unavoidableCharge = scheduledDefenseAudit(5000, 837011);
const survivableDefendDelta = survivableCharge.defend?.goalProjection?.actionPoolDeltas?.find(
  delta => delta.outcomeKind === 'INCOMING_HEALTH_DELTA',
);
const survivableEvadeDelta = survivableCharge.evade?.goalProjection?.actionPoolDeltas?.find(
  delta => delta.outcomeKind === 'INCOMING_HEALTH_DELTA',
);
add(
  'oracle:scheduled-visible-charge-produces-real-defense-delta',
  survivableCharge.runtimeSnapshot.scheduledEvents.some(event =>
    event.eventType === 'VISIBLE_CHARGE_RELEASE' &&
    event.ownerId === 'actor' &&
    event.sourceActorId === 'enemy'
  ) &&
    Number(survivableDefendDelta?.healthTrajectoryDeltaPP || 0) > 0 &&
    Number(survivableEvadeDelta?.healthTrajectoryDeltaPP || 0) > 0 &&
    survivableCharge.defend?.primaryRoute?.routeKey !== survivableCharge.evade?.primaryRoute?.routeKey,
  {
    scheduledEvents: survivableCharge.runtimeSnapshot.scheduledEvents,
    defend: survivableCharge.defend,
    evade: survivableCharge.evade,
  },
);
add(
  'oracle:unavoidable-charge-does-not-invent-defense-value',
  !unavoidableCharge.defend?.goalProjection?.actionPoolDeltas?.some(delta =>
    delta.outcomeKind === 'INCOMING_HEALTH_DELTA' &&
    Number(delta.healthTrajectoryDeltaPP || 0) > 1e-9
  ) &&
    !unavoidableCharge.evade?.goalProjection?.actionPoolDeltas?.some(delta =>
      delta.outcomeKind === 'INCOMING_HEALTH_DELTA' &&
      Number(delta.healthTrajectoryDeltaPP || 0) > 1e-9
    ),
  {
    scheduledEvents: unavoidableCharge.runtimeSnapshot.scheduledEvents,
    defend: unavoidableCharge.defend,
    evade: unavoidableCharge.evade,
  },
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

const responseModel = {
  mainBranches: [{ projectionId: 'response:test', probability: 1, threatEnvelope: { lower: 20, upper: 20 } }],
  disasterTail: null,
  noResponseProbability: 0,
};
const noOpComparable = project(request({ responseModel }), route({ health: [hp('enemy', -10)] }));
add(
  'oracle:no-op-shares-response-axis',
  Math.abs(noOpComparable.objectiveUtilityHEPP - 10) < 1e-9 &&
    noOpComparable.expectedCandidateUtility === -10 &&
    noOpComparable.expectedNoOpUtility === -20,
  { noOpComparable },
);

function directionalCheck(contract) {
  const id = contract.caseId;
  const category = contract.behaviorContract.category;
  const variant = id.endsWith('_positive') ? 'positive' : id.endsWith('_negative') ? 'negative' : 'mutation';
  const concreteEnemy = [{ opportunityId: 'enemy-next', ownerId: 'enemy', grantType: 'NATURAL_ACTION', status: 'OPEN' }];
  if (category === 'c01_hit_bonus') {
    const factor = variant === 'negative' ? 0 : variant === 'mutation' ? 0.5 : 0.25;
    const value = project(request({ actorRouteValue: 20 }), route({
      effects: [effect('NEXT_ACTION_QUALITY_CHANGED', 'actor', { qualityFactor: factor })],
    })).actionPoolHEPP;
    return variant === 'negative' ? value === 0 : value > 0 && value <= 10;
  }
  if (category === 'c02_evasion_reduction') {
    const routeValue = variant === 'negative' || variant === 'mutation' ? 0 : 20;
    const value = project(request({ enemyRouteValue: routeValue }), route({
      effects: [effect('NEXT_ACTION_QUALITY_CHANGED', 'enemy', { qualityFactor: -0.25 })],
    })).actionPoolHEPP;
    return variant === 'positive' ? value > 0 : value === 0;
  }
  if (category === 'c03_defense') {
    if (variant === 'negative') return !decision.r8HasDefenseWindow(request());
    const low = project(request({ actionOpportunity: { imminentThreat: true } }), route({ health: [hp('actor', 5)] })).directTrajectoryHEPP;
    const high = project(request({ actionOpportunity: { imminentThreat: true } }), route({ health: [hp('actor', 10)] })).directTrajectoryHEPP;
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
    const routeDelta = variant === 'positive' ? 18 : variant === 'negative' ? 0 : 6;
    const value = project(request(), route({
      effects: [effect('RESOURCE_OPTION_CHANGED', variant === 'c08_resource_block' ? 'enemy' : 'actor', { routeDeltaPP: routeDelta })],
    })).actionPoolHEPP;
    return variant === 'positive' ? value === 18 : variant === 'negative' ? value === 0 : value === 6;
  }
  if (category === 'c12_defensive_windows') {
    const value = variant === 'positive'
      ? project(request(), route({ health: [hp('actor', 8, 'absorbed')] })).directTrajectoryHEPP
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
    return project(request({ actionOpportunity: { imminentThreat: true } }), route({ health: [hp('actor', 6), hp('enemy', -2, 'reflect')] })).directTrajectoryHEPP === 8;
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

const providerWorld = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player', 100, [damageSkill('weak', 50), damageSkill('strong', 150)])],
    team_enemy: [unit('enemy', 'enemy', 100, [damageSkill('enemy-attack', 80)])],
  },
};
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

export const PARETO_DIMENSIONS = Object.freeze([
  ['objectiveUtilityHEPP', 'MAXIMIZE'],
  ['worstTailUtilityHEPP', 'MAXIMIZE'],
  ['survivalUtilityHEPP', 'MAXIMIZE'],
  ['assetReserveHEPP', 'MAXIMIZE'],
  ['informationValueHEPP', 'MAXIMIZE'],
  ['discardedOverkillPP', 'MINIMIZE'],
]);

const TERMINAL_UTILITY = Object.freeze({ WIN: 100, LOSS: -100, DRAW: 0 });
const STATE_CONTRACT = Object.freeze({
  CONTROLLED: Object.freeze({ beneficial: false, utilityPP: 20 }),
  INSPIRED: Object.freeze({ beneficial: true, utilityPP: 8 }),
  PROTECTED: Object.freeze({ beneficial: true, utilityPP: 10 }),
});

const CASE_KEYS = ['caseId', 'mode', 'playerLockedCandidateId', 'candidates'];
const CANDIDATE_KEYS = [
  'candidateId', 'actionId', 'targetSet', 'paymentMode', 'legal', 'playerLocked',
  'hardExclusionCodes', 'actorSide', 'world', 'objectiveContract', 'actionFacts',
  'opportunities', 'riskInputs', 'informationGroups',
];
const WORLD_KEYS = ['tick', 'horizonTick', 'units', 'resources', 'states', 'inventory', 'summons'];
const UNIT_KEYS = ['unitId', 'side', 'currentHp', 'maxHp'];
const RESOURCE_KEYS = ['unitId', 'resourceId', 'current', 'maximum'];
const STATE_KEYS = ['unitId', 'stateId', 'startTick', 'expireTick'];
const INVENTORY_KEYS = ['unitId', 'itemId', 'quantity', 'startTick', 'expireTick'];
const SUMMON_KEYS = ['summonUnitId', 'hostUnitId', 'startTick', 'expireTick'];
const ACTION_FACT_KEYS = [
  'kind', 'factId', 'eventId', 'sequence', 'resolveTick', 'startTick', 'expireTick',
  'targetUnitId', 'deltaHp', 'resourceId', 'delta', 'stateId', 'operation',
  'winProbability', 'lossProbability', 'drawProbability', 'hostUnitId', 'itemId', 'quantity',
];
const EFFECT_KEYS = [
  'kind', 'targetUnitId', 'deltaHp', 'resourceId', 'delta', 'stateId', 'operation',
  'startTick', 'expireTick',
];
const ROUTE_KEYS = [
  'actorUnitId', 'startTick', 'expireTick', 'resourceId', 'resourceCost',
  'requiredStateUnitId', 'requiredStateId', 'requiredItemUnitId', 'requiredItemId',
  'requiredSummonId', 'affectedUnitIds', 'effects',
];
const OPPORTUNITY_KEYS = ['opportunityId', ...ROUTE_KEYS];
const FUTURE_ACTION_KEYS = ['candidateId', ...ROUTE_KEYS];
const RISK_KEYS = ['actorUnitId', 'actorOutcomeDeltas', 'shieldFacts', 'negativeTerminal'];
const OUTCOME_DELTA_KEYS = ['deltas'];
const SHIELD_KEYS = ['targetUnitId', 'deltaHp'];
const GROUP_KEYS = ['groupId', 'outcomes'];
const OUTCOME_KEYS = ['outcomeId', 'probability', 'observations', 'futureActions'];
const OBJECTIVE_KEYS = ['victory', 'defeat'];
const OBJECTIVE_SIDE_KEYS = ['logic', 'conditions'];
const CONDITION_KEYS = ['type', 'threshold', 'targetIds', 'side', 'scope'];
const PRECOMPUTED_KEY = /(?:hepp|score|vector|pareto|causal|selection|routeResult|candidateValue|routeValue|beforeRoute|afterRoute)/iu;
const PRECOMPUTED_LITERAL = new Set(['CONSTANT_HEPP', 'ROUTE_DELTA']);

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

function object(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, 'object required');
  return value;
}

function finite(value, code) {
  if (!Number.isFinite(value)) fail(code, 'finite number required');
  return value;
}

function text(value, code) {
  if (typeof value !== 'string' || value.length === 0) fail(code, 'non-empty string required');
  return value;
}

function exactKeys(value, allowed, required, code) {
  object(value, code);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) fail(code, `unknown field ${key}`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(code, `missing field ${key}`);
}

function assertNoPrecomputed(value, path = '$') {
  if (!value || typeof value !== 'object') {
    if (PRECOMPUTED_LITERAL.has(value)) fail('E_PRECOMPUTED_INPUT', `${path}=${value}`);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (PRECOMPUTED_KEY.test(key)) fail('E_PRECOMPUTED_INPUT', `${path}.${key}`);
    assertNoPrecomputed(nested, `${path}.${key}`);
  }
}

function stringArray(value, code) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.length === 0)) {
    fail(code, 'string array required');
  }
  if (new Set(value).size !== value.length) fail(code, 'duplicate string');
  return value;
}

function nullableText(value, code) {
  if (value !== null) text(value, code);
  return value;
}

function probability(value, code) {
  finite(value, code);
  if (value < 0 || value > 1) fail(code, 'probability out of range');
  return value;
}

export function neumaierSum(values) {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    finite(value, 'E_SUM');
    const next = sum + value;
    compensation += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum;
    sum = next;
  }
  return Object.is(sum + compensation, -0) ? 0 : sum + compensation;
}

function utf16Compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function activeAt(startTick, expireTick, tick) {
  return startTick <= tick && tick <= expireTick;
}

function buildWorld(raw) {
  exactKeys(raw, WORLD_KEYS, WORLD_KEYS, 'E_WORLD');
  finite(raw.tick, 'E_WORLD_TICK');
  finite(raw.horizonTick, 'E_WORLD_HORIZON');
  if (raw.horizonTick < raw.tick) fail('E_WORLD_HORIZON', 'before tick');
  for (const key of ['units', 'resources', 'states', 'inventory', 'summons']) {
    if (!Array.isArray(raw[key])) fail('E_WORLD', `${key} array required`);
  }
  if (raw.units.length === 0) fail('E_WORLD', 'unit required');

  const units = new Map();
  for (const unit of raw.units) {
    exactKeys(unit, UNIT_KEYS, UNIT_KEYS, 'E_UNIT');
    text(unit.unitId, 'E_UNIT_ID');
    text(unit.side, 'E_UNIT_SIDE');
    finite(unit.currentHp, 'E_UNIT_HP');
    finite(unit.maxHp, 'E_UNIT_MAX_HP');
    if (unit.maxHp <= 0 || units.has(unit.unitId)) fail('E_UNIT', unit.unitId);
    units.set(unit.unitId, { ...unit });
  }

  const resources = new Map();
  for (const resource of raw.resources) {
    exactKeys(resource, RESOURCE_KEYS, RESOURCE_KEYS, 'E_RESOURCE');
    text(resource.unitId, 'E_RESOURCE_UNIT');
    text(resource.resourceId, 'E_RESOURCE_ID');
    finite(resource.current, 'E_RESOURCE_CURRENT');
    finite(resource.maximum, 'E_RESOURCE_MAX');
    const key = `${resource.unitId}\u0000${resource.resourceId}`;
    if (!units.has(resource.unitId) || resource.maximum <= 0 || resources.has(key)) fail('E_RESOURCE', key);
    resources.set(key, { ...resource });
  }

  const states = [];
  for (const state of raw.states) {
    exactKeys(state, STATE_KEYS, STATE_KEYS, 'E_STATE');
    text(state.unitId, 'E_STATE_UNIT');
    text(state.stateId, 'E_STATE_ID');
    finite(state.startTick, 'E_STATE_START');
    finite(state.expireTick, 'E_STATE_EXPIRE');
    if (!units.has(state.unitId) || state.expireTick < state.startTick) fail('E_STATE', state.stateId);
    states.push({ ...state });
  }

  const inventory = [];
  for (const item of raw.inventory) {
    exactKeys(item, INVENTORY_KEYS, INVENTORY_KEYS, 'E_INVENTORY');
    text(item.unitId, 'E_ITEM_UNIT');
    text(item.itemId, 'E_ITEM_ID');
    finite(item.quantity, 'E_ITEM_QUANTITY');
    finite(item.startTick, 'E_ITEM_START');
    finite(item.expireTick, 'E_ITEM_EXPIRE');
    if (!units.has(item.unitId) || item.quantity < 0 || item.expireTick < item.startTick) fail('E_INVENTORY', item.itemId);
    inventory.push({ ...item });
  }

  const summons = [];
  for (const summon of raw.summons) {
    exactKeys(summon, SUMMON_KEYS, SUMMON_KEYS, 'E_SUMMON');
    text(summon.summonUnitId, 'E_SUMMON_ID');
    text(summon.hostUnitId, 'E_SUMMON_HOST');
    finite(summon.startTick, 'E_SUMMON_START');
    finite(summon.expireTick, 'E_SUMMON_EXPIRE');
    if (!units.has(summon.hostUnitId) || summon.expireTick < summon.startTick) fail('E_SUMMON', summon.summonUnitId);
    summons.push({ ...summon });
  }

  return { tick: raw.tick, horizonTick: raw.horizonTick, units, resources, states, inventory, summons };
}

function cloneWorld(world) {
  return {
    tick: world.tick,
    horizonTick: world.horizonTick,
    units: new Map([...world.units].map(([key, value]) => [key, { ...value }])),
    resources: new Map([...world.resources].map(([key, value]) => [key, { ...value }])),
    states: world.states.map(value => ({ ...value })),
    inventory: world.inventory.map(value => ({ ...value })),
    summons: world.summons.map(value => ({ ...value })),
  };
}

function stateUtility(stateId, operation, sameSide) {
  const contract = STATE_CONTRACT[stateId];
  if (!contract) fail('E_STATE_CONTRACT', stateId);
  if (operation !== 'ADD' && operation !== 'REMOVE') fail('E_STATE_OPERATION', operation);
  const targetBenefit = contract.beneficial === sameSide ? 1 : -1;
  return contract.utilityPP * targetBenefit * (operation === 'ADD' ? 1 : -1);
}

function applyEffect(world, effect, actorSide, mutate) {
  exactKeys(effect, EFFECT_KEYS, ['kind', 'targetUnitId'], 'E_EFFECT');
  text(effect.kind, 'E_EFFECT_KIND');
  text(effect.targetUnitId, 'E_EFFECT_TARGET');
  const target = world.units.get(effect.targetUnitId);
  if (!target) fail('E_EFFECT_TARGET', effect.targetUnitId);
  const sameSide = target.side === actorSide;

  if (effect.kind === 'HEALTH_CHANGE') {
    finite(effect.deltaHp, 'E_EFFECT_HP');
    if (mutate) target.currentHp += effect.deltaHp;
    return 100 * effect.deltaHp / target.maxHp * (sameSide ? 1 : -1);
  }
  if (effect.kind === 'RESOURCE_CHANGE') {
    text(effect.resourceId, 'E_EFFECT_RESOURCE');
    finite(effect.delta, 'E_EFFECT_DELTA');
    const key = `${effect.targetUnitId}\u0000${effect.resourceId}`;
    const resource = world.resources.get(key);
    if (!resource) fail('E_EFFECT_RESOURCE', key);
    if (mutate) resource.current += effect.delta;
    return 100 * effect.delta / resource.maximum * (sameSide ? 1 : -1);
  }
  if (effect.kind === 'STATE_CHANGE') {
    text(effect.stateId, 'E_EFFECT_STATE');
    text(effect.operation, 'E_EFFECT_OPERATION');
    finite(effect.startTick, 'E_EFFECT_START');
    finite(effect.expireTick, 'E_EFFECT_EXPIRE');
    if (effect.expireTick < effect.startTick) fail('E_EFFECT_EXPIRE', effect.stateId);
    if (mutate) {
      world.states = world.states.filter(state => !(state.unitId === effect.targetUnitId && state.stateId === effect.stateId));
      if (effect.operation === 'ADD') {
        world.states.push({ unitId: effect.targetUnitId, stateId: effect.stateId, startTick: effect.startTick, expireTick: effect.expireTick });
      }
    }
    return stateUtility(effect.stateId, effect.operation, sameSide);
  }
  fail('E_EFFECT_KIND', effect.kind);
}

function actionFactEffect(fact) {
  if (fact.kind === 'HEALTH_CHANGE') return { kind: fact.kind, targetUnitId: fact.targetUnitId, deltaHp: fact.deltaHp };
  if (fact.kind === 'RESOURCE_CHANGE') {
    return { kind: fact.kind, targetUnitId: fact.targetUnitId, resourceId: fact.resourceId, delta: fact.delta };
  }
  if (fact.kind === 'STATE_CHANGE') {
    return {
      kind: fact.kind,
      targetUnitId: fact.targetUnitId,
      stateId: fact.stateId,
      operation: fact.operation,
      startTick: fact.startTick,
      expireTick: fact.expireTick,
    };
  }
  return null;
}

function validateActionFact(fact) {
  exactKeys(fact, ACTION_FACT_KEYS, [
    'kind', 'factId', 'eventId', 'sequence', 'resolveTick', 'startTick', 'expireTick', 'targetUnitId',
  ], 'E_ACTION_FACT');
  for (const key of ['kind', 'factId', 'eventId', 'targetUnitId']) text(fact[key], 'E_ACTION_FACT');
  for (const key of ['sequence', 'resolveTick', 'startTick', 'expireTick']) finite(fact[key], 'E_ACTION_FACT');
  if (fact.expireTick < fact.startTick) fail('E_ACTION_FACT', fact.factId);
  if (fact.kind === 'HEALTH_CHANGE') finite(fact.deltaHp, 'E_ACTION_FACT_HP');
  else if (fact.kind === 'RESOURCE_CHANGE') {
    text(fact.resourceId, 'E_ACTION_FACT_RESOURCE');
    finite(fact.delta, 'E_ACTION_FACT_DELTA');
  } else if (fact.kind === 'STATE_CHANGE') {
    text(fact.stateId, 'E_ACTION_FACT_STATE');
    text(fact.operation, 'E_ACTION_FACT_OPERATION');
  } else if (fact.kind === 'TERMINAL_OUTCOME') {
    probability(fact.winProbability, 'E_ACTION_FACT_WIN');
    probability(fact.lossProbability, 'E_ACTION_FACT_LOSS');
    probability(fact.drawProbability, 'E_ACTION_FACT_DRAW');
    if (Math.abs(fact.winProbability + fact.lossProbability + fact.drawProbability - 1) > 1e-12) {
      fail('E_ACTION_FACT_TERMINAL', fact.factId);
    }
  } else if (fact.kind === 'SUMMON') {
    text(fact.hostUnitId, 'E_ACTION_FACT_HOST');
  } else if (fact.kind === 'CREATION') {
    text(fact.itemId, 'E_ACTION_FACT_ITEM');
    finite(fact.quantity, 'E_ACTION_FACT_QUANTITY');
    if (fact.quantity <= 0) fail('E_ACTION_FACT_QUANTITY', fact.factId);
  } else fail('E_ACTION_FACT_KIND', fact.kind);
}

function hasState(world, unitId, stateId, tick) {
  return world.states.some(state => state.unitId === unitId && state.stateId === stateId && activeAt(state.startTick, state.expireTick, tick));
}

function hasItem(world, unitId, itemId, tick) {
  return world.inventory.some(item => item.unitId === unitId && item.itemId === itemId && item.quantity > 0 && activeAt(item.startTick, item.expireTick, tick));
}

function hasSummon(world, summonUnitId, tick) {
  return world.summons.some(summon => {
    const host = world.units.get(summon.hostUnitId);
    return summon.summonUnitId === summonUnitId && host && host.currentHp > 0 && activeAt(summon.startTick, summon.expireTick, tick);
  });
}

function evaluateRoute(world, route, actorSide, idField) {
  const allowed = idField === 'opportunityId' ? OPPORTUNITY_KEYS : FUTURE_ACTION_KEYS;
  exactKeys(route, allowed, [idField, ...ROUTE_KEYS], 'E_ROUTE');
  text(route[idField], 'E_ROUTE_ID');
  text(route.actorUnitId, 'E_ROUTE_ACTOR');
  if (!world.units.has(route.actorUnitId)) fail('E_ROUTE_ACTOR', route.actorUnitId);
  finite(route.startTick, 'E_ROUTE_START');
  finite(route.expireTick, 'E_ROUTE_EXPIRE');
  finite(route.resourceCost, 'E_ROUTE_COST');
  if (route.resourceCost < 0 || route.expireTick < route.startTick) fail('E_ROUTE_WINDOW', route[idField]);
  for (const key of ['resourceId', 'requiredStateUnitId', 'requiredStateId', 'requiredItemUnitId', 'requiredItemId', 'requiredSummonId']) {
    nullableText(route[key], 'E_ROUTE_REQUIREMENT');
  }
  stringArray(route.affectedUnitIds, 'E_ROUTE_AFFECTED');
  for (const unitId of route.affectedUnitIds) if (!world.units.has(unitId)) fail('E_ROUTE_AFFECTED', unitId);
  if (!Array.isArray(route.effects) || route.effects.length === 0) fail('E_ROUTE_EFFECTS', route[idField]);
  if (route.requiredStateId !== null && !Object.hasOwn(STATE_CONTRACT, route.requiredStateId)) fail('E_ROUTE_REQUIREMENT', route.requiredStateId);

  const tick = world.horizonTick;
  let reason = null;
  if (tick < route.startTick) reason = 'NOT_STARTED';
  else if (tick > route.expireTick) reason = 'EXPIRED';
  else if (route.resourceId === null && route.resourceCost !== 0) reason = 'RESOURCE_ID_REQUIRED';
  else if (route.resourceId !== null) {
    const resource = world.resources.get(`${route.actorUnitId}\u0000${route.resourceId}`);
    if (!resource || resource.current < route.resourceCost) reason = 'INSUFFICIENT_RESOURCE';
  }
  if (!reason && route.requiredStateId !== null) {
    if (route.requiredStateUnitId === null || !hasState(world, route.requiredStateUnitId, route.requiredStateId, tick)) reason = 'MISSING_STATE';
  }
  if (!reason && route.requiredItemId !== null) {
    if (route.requiredItemUnitId === null || !hasItem(world, route.requiredItemUnitId, route.requiredItemId, tick)) reason = 'MISSING_ITEM';
  }
  if (!reason && route.requiredSummonId !== null && !hasSummon(world, route.requiredSummonId, tick)) reason = 'MISSING_SUMMON';

  const routeWorld = cloneWorld(world);
  const values = [];
  for (const effect of route.effects) {
    if (!route.affectedUnitIds.includes(effect.targetUnitId)) fail('E_ROUTE_AFFECTED', effect.targetUnitId);
    values.push(applyEffect(routeWorld, effect, actorSide, true));
  }
  return {
    id: route[idField],
    usable: reason === null,
    reason,
    valueHEPP: reason === null ? neumaierSum(values) : 0,
    affectedUnitIds: [...route.affectedUnitIds].sort(utf16Compare),
  };
}

function objectiveHealth(worldBefore, healthByTarget, objectiveContract) {
  if (objectiveContract === null) {
    return { valueHEPP: neumaierSum([...healthByTarget.values()].map(entry => entry.valueHEPP)), discardedOverkillPP: 0 };
  }
  exactKeys(objectiveContract, OBJECTIVE_KEYS, OBJECTIVE_KEYS, 'E_OBJECTIVE');
  const conditions = [];
  for (const sideName of OBJECTIVE_KEYS) {
    const side = objectiveContract[sideName];
    exactKeys(side, OBJECTIVE_SIDE_KEYS, OBJECTIVE_SIDE_KEYS, 'E_OBJECTIVE_SIDE');
    if (side.logic !== 'ANY' && side.logic !== 'ALL') fail('E_OBJECTIVE_LOGIC', side.logic);
    if (!Array.isArray(side.conditions)) fail('E_OBJECTIVE_CONDITIONS', sideName);
    for (const condition of side.conditions) {
      exactKeys(condition, CONDITION_KEYS, CONDITION_KEYS, 'E_OBJECTIVE_CONDITION');
      if (condition.type !== 'HP_RATIO_AT_OR_BELOW' && condition.type !== 'HP_RATIO_AT_OR_ABOVE') fail('E_OBJECTIVE_TYPE', condition.type);
      probability(condition.threshold, 'E_OBJECTIVE_THRESHOLD');
      stringArray(condition.targetIds, 'E_OBJECTIVE_TARGETS');
      text(condition.side, 'E_OBJECTIVE_SIDE');
      if (condition.scope !== 'ANY' && condition.scope !== 'ALL') fail('E_OBJECTIVE_SCOPE', condition.scope);
      conditions.push(condition);
    }
  }

  const values = [];
  const discarded = [];
  for (const [targetId, trajectory] of healthByTarget) {
    const unit = worldBefore.units.get(targetId);
    const condition = conditions.find(item => item.targetIds.includes(targetId));
    if (!condition || unit.side !== condition.side) {
      values.push(trajectory.valueHEPP);
      continue;
    }
    const deltaPP = 100 * trajectory.deltaHp / unit.maxHp;
    if (condition.type === 'HP_RATIO_AT_OR_BELOW' && deltaPP < 0) {
      const useful = Math.min(-deltaPP, Math.max(0, 100 * (unit.currentHp / unit.maxHp - condition.threshold)));
      values.push(useful * (unit.side === trajectory.actorSide ? -1 : 1));
      discarded.push(Math.max(0, -deltaPP - useful));
    } else if (condition.type === 'HP_RATIO_AT_OR_ABOVE' && deltaPP > 0) {
      const useful = Math.min(deltaPP, Math.max(0, 100 * (condition.threshold - unit.currentHp / unit.maxHp)));
      values.push(useful * (unit.side === trajectory.actorSide ? 1 : -1));
      discarded.push(Math.max(0, deltaPP - useful));
    } else values.push(trajectory.valueHEPP);
  }
  return { valueHEPP: neumaierSum(values), discardedOverkillPP: neumaierSum(discarded) };
}

function evaluateInformation(groups, baseWorld, actorSide) {
  if (!Array.isArray(groups)) fail('E_INFORMATION', 'array required');
  const breakdown = [];
  const groupIds = new Set();
  for (const group of groups) {
    exactKeys(group, GROUP_KEYS, GROUP_KEYS, 'E_INFORMATION_GROUP');
    text(group.groupId, 'E_INFORMATION_GROUP_ID');
    if (groupIds.has(group.groupId)) fail('E_INFORMATION_GROUP_ID', `duplicate ${group.groupId}`);
    groupIds.add(group.groupId);
    if (!Array.isArray(group.outcomes) || group.outcomes.length === 0) fail('E_INFORMATION_OUTCOMES', group.groupId);
    const outcomes = [];
    const outcomeIds = new Set();
    let probabilityTotal = 0;
    for (const outcome of group.outcomes) {
      exactKeys(outcome, OUTCOME_KEYS, OUTCOME_KEYS, 'E_INFORMATION_OUTCOME');
      text(outcome.outcomeId, 'E_INFORMATION_OUTCOME_ID');
      if (outcomeIds.has(outcome.outcomeId)) fail('E_INFORMATION_OUTCOME_ID', `duplicate ${outcome.outcomeId}`);
      outcomeIds.add(outcome.outcomeId);
      probability(outcome.probability, 'E_INFORMATION_PROBABILITY');
      probabilityTotal += outcome.probability;
      if (!Array.isArray(outcome.observations) || !Array.isArray(outcome.futureActions)) fail('E_INFORMATION_BRANCH', outcome.outcomeId);
      const branchWorld = cloneWorld(baseWorld);
      for (const observation of outcome.observations) applyEffect(branchWorld, observation, actorSide, true);
      const routeValues = new Map();
      const routes = [];
      const routeIds = new Set();
      for (const route of outcome.futureActions) {
        const evaluated = evaluateRoute(branchWorld, route, actorSide, 'candidateId');
        if (routeIds.has(evaluated.id)) fail('E_INFORMATION_ROUTE_ID', `duplicate ${evaluated.id}`);
        routeIds.add(evaluated.id);
        routes.push({ candidateId: evaluated.id, usable: evaluated.usable, reason: evaluated.reason, valueHEPP: evaluated.valueHEPP });
        if (evaluated.usable) routeValues.set(evaluated.id, evaluated.valueHEPP);
      }
      outcomes.push({ outcomeId: outcome.outcomeId, probability: outcome.probability, routeValues, routes });
    }
    if (Math.abs(probabilityTotal - 1) > 1e-12) fail('E_INFORMATION_PROBABILITY_SUM', group.groupId);

    const adaptive = neumaierSum(outcomes.map(outcome => {
      const best = Math.max(0, ...outcome.routeValues.values());
      return outcome.probability * best;
    }));
    let commonIds = new Set(outcomes[0].routeValues.keys());
    for (const outcome of outcomes.slice(1)) commonIds = new Set([...commonIds].filter(id => outcome.routeValues.has(id)));
    const committed = Math.max(0, ...[...commonIds].map(id => neumaierSum(outcomes.map(outcome => outcome.probability * outcome.routeValues.get(id)))));
    const deterministic = outcomes.filter(outcome => outcome.probability > 0).length <= 1;
    const valueHEPP = deterministic ? 0 : Math.max(0, adaptive - committed);
    breakdown.push({
      groupId: group.groupId,
      adaptiveHEPP: adaptive,
      committedHEPP: committed,
      valueHEPP,
      outcomes: outcomes.map(outcome => ({ outcomeId: outcome.outcomeId, probability: outcome.probability, routes: outcome.routes })),
    });
  }
  return { valueHEPP: Math.max(0, ...breakdown.map(group => group.valueHEPP)), breakdown };
}

function evaluateRisk(raw, world) {
  exactKeys(raw, RISK_KEYS, RISK_KEYS, 'E_RISK');
  text(raw.actorUnitId, 'E_RISK_ACTOR');
  const actor = world.units.get(raw.actorUnitId);
  if (!actor) fail('E_RISK_ACTOR', raw.actorUnitId);
  if (typeof raw.negativeTerminal !== 'boolean') fail('E_RISK_TERMINAL', 'boolean required');
  if (!Array.isArray(raw.actorOutcomeDeltas) || !Array.isArray(raw.shieldFacts)) fail('E_RISK', 'arrays required');
  const finalDeltas = raw.actorOutcomeDeltas.map(outcome => {
    exactKeys(outcome, OUTCOME_DELTA_KEYS, OUTCOME_DELTA_KEYS, 'E_RISK_OUTCOME');
    if (!Array.isArray(outcome.deltas)) fail('E_RISK_DELTAS', 'array required');
    return neumaierSum(outcome.deltas);
  });
  const worstDelta = finalDeltas.length === 0 ? 0 : Math.min(...finalDeltas);
  const survivalUtilityHEPP = 100 * Math.max(0, actor.currentHp + worstDelta) / actor.maxHp;
  const worstTailUtilityHEPP = -100 * Math.max(0, -worstDelta) / actor.maxHp + (raw.negativeTerminal ? -100 : 0);
  const reserveValues = [];
  for (const shield of raw.shieldFacts) {
    exactKeys(shield, SHIELD_KEYS, SHIELD_KEYS, 'E_RISK_SHIELD');
    text(shield.targetUnitId, 'E_RISK_SHIELD_TARGET');
    finite(shield.deltaHp, 'E_RISK_SHIELD_HP');
    const target = world.units.get(shield.targetUnitId);
    if (!target) fail('E_RISK_SHIELD_TARGET', shield.targetUnitId);
    reserveValues.push(100 * Math.max(0, shield.deltaHp) / target.maxHp);
  }
  return { worstTailUtilityHEPP, survivalUtilityHEPP, assetReserveHEPP: neumaierSum(reserveValues) };
}

export function evaluateRawCandidate(candidate) {
  assertNoPrecomputed(candidate, '$candidate');
  exactKeys(candidate, CANDIDATE_KEYS, CANDIDATE_KEYS, 'E_CANDIDATE');
  for (const key of ['candidateId', 'actionId', 'paymentMode', 'actorSide']) text(candidate[key], 'E_CANDIDATE');
  stringArray(candidate.targetSet, 'E_CANDIDATE_TARGETS');
  stringArray(candidate.hardExclusionCodes, 'E_CANDIDATE_EXCLUSIONS');
  if (typeof candidate.legal !== 'boolean' || typeof candidate.playerLocked !== 'boolean') fail('E_CANDIDATE_FLAGS', candidate.candidateId);
  if (!Array.isArray(candidate.actionFacts) || !Array.isArray(candidate.opportunities)) fail('E_CANDIDATE_FACTS', candidate.candidateId);

  const worldBefore = buildWorld(candidate.world);
  const world = cloneWorld(worldBefore);
  const orderedFacts = candidate.actionFacts.map((fact, index) => ({ fact, index }));
  for (const entry of orderedFacts) validateActionFact(entry.fact);
  if (new Set(orderedFacts.map(entry => entry.fact.factId)).size !== orderedFacts.length) fail('E_ACTION_FACT_ID', 'duplicate');
  if (new Set(candidate.opportunities.map(opportunity => opportunity.opportunityId)).size !== candidate.opportunities.length) fail('E_ROUTE_ID', 'duplicate');
  orderedFacts.sort((left, right) => left.fact.sequence - right.fact.sequence || left.index - right.index);

  const causalFacts = [];
  const factAudit = [];
  const healthByTarget = new Map();
  let terminalReached = false;
  for (const { fact } of orderedFacts) {
    if (terminalReached) {
      factAudit.push({ factId: fact.factId, applied: false, reason: 'POST_TERMINAL' });
      continue;
    }
    const scheduled = activeAt(fact.startTick, fact.expireTick, fact.resolveTick)
      && fact.resolveTick >= world.tick && fact.resolveTick <= world.horizonTick;
    if (!scheduled) {
      factAudit.push({ factId: fact.factId, applied: false, reason: 'OUTSIDE_WINDOW' });
      continue;
    }
    factAudit.push({ factId: fact.factId, applied: true, reason: null });
    let owner = 'STATE_DELTA';
    let valueHEPP = 0;
    const effect = actionFactEffect(fact);
    if (effect) {
      valueHEPP = applyEffect(world, effect, candidate.actorSide, true);
      if (fact.kind === 'HEALTH_CHANGE') {
        const current = healthByTarget.get(fact.targetUnitId) || { deltaHp: 0, valueHEPP: 0, actorSide: candidate.actorSide };
        current.deltaHp = neumaierSum([current.deltaHp, fact.deltaHp]);
        current.valueHEPP = neumaierSum([current.valueHEPP, valueHEPP]);
        healthByTarget.set(fact.targetUnitId, current);
      }
    } else if (fact.kind === 'TERMINAL_OUTCOME') {
      owner = 'TERMINAL_DELTA';
      valueHEPP = neumaierSum([
        fact.winProbability * TERMINAL_UTILITY.WIN,
        fact.lossProbability * TERMINAL_UTILITY.LOSS,
        fact.drawProbability * TERMINAL_UTILITY.DRAW,
      ]);
      terminalReached = true;
    } else if (fact.kind === 'SUMMON') {
      owner = 'ACTION_POOL_DELTA';
      if (!world.units.has(fact.hostUnitId)) fail('E_ACTION_FACT_HOST', fact.hostUnitId);
      world.summons.push({ summonUnitId: fact.targetUnitId, hostUnitId: fact.hostUnitId, startTick: fact.startTick, expireTick: fact.expireTick });
    } else if (fact.kind === 'CREATION') {
      owner = 'ACTION_POOL_DELTA';
      if (!world.units.has(fact.targetUnitId)) fail('E_ACTION_FACT_TARGET', fact.targetUnitId);
      world.inventory.push({ unitId: fact.targetUnitId, itemId: fact.itemId, quantity: fact.quantity, startTick: fact.startTick, expireTick: fact.expireTick });
    }
    causalFacts.push({
      owner,
      componentCode: `RAW_${fact.kind}`,
      sourceEventId: fact.eventId,
      sourceFactId: fact.factId,
      targetUnitId: fact.targetUnitId,
      valueHEPP,
    });
  }

  const opportunityAudit = [];
  if (terminalReached) {
    for (const opportunity of candidate.opportunities) {
      const route = evaluateRoute(world, opportunity, candidate.actorSide, 'opportunityId');
      opportunityAudit.push({ opportunityId: route.id, usable: false, reason: 'POST_TERMINAL', valueHEPP: 0, affectedUnitIds: route.affectedUnitIds });
    }
  } else {
    for (const opportunity of candidate.opportunities) {
      const route = evaluateRoute(world, opportunity, candidate.actorSide, 'opportunityId');
      opportunityAudit.push({ opportunityId: route.id, usable: route.usable, reason: route.reason, valueHEPP: route.valueHEPP, affectedUnitIds: route.affectedUnitIds });
      if (route.usable) {
        causalFacts.push({
          owner: 'ACTION_POOL_DELTA',
          componentCode: 'RAW_OPPORTUNITY',
          sourceEventId: opportunity.opportunityId,
          sourceFactId: opportunity.opportunityId,
          targetUnitId: opportunity.actorUnitId,
          valueHEPP: route.valueHEPP,
        });
      }
    }
  }

  const healthResult = objectiveHealth(worldBefore, healthByTarget, candidate.objectiveContract);
  const nonHealthState = causalFacts.filter(fact => fact.owner === 'STATE_DELTA' && fact.componentCode !== 'RAW_HEALTH_CHANGE');
  const terminalFacts = causalFacts.filter(fact => fact.owner === 'TERMINAL_DELTA');
  const actionPoolFacts = causalFacts.filter(fact => fact.owner === 'ACTION_POOL_DELTA');
  const reconciledFacts = [
    ...nonHealthState,
    ...(healthByTarget.size === 0 ? [] : [{
      owner: 'STATE_DELTA',
      componentCode: 'RAW_OBJECTIVE_HEALTH',
      sourceEventId: 'objective:health',
      sourceFactId: 'objective:health',
      targetUnitId: [...healthByTarget.keys()].sort(utf16Compare).join('|'),
      valueHEPP: healthResult.valueHEPP,
    }]),
    ...terminalFacts,
    ...actionPoolFacts,
  ];
  const stateDeltaTotalHEPP = neumaierSum(reconciledFacts.filter(fact => fact.owner === 'STATE_DELTA').map(fact => fact.valueHEPP));
  const actionPoolDeltaTotalHEPP = neumaierSum(reconciledFacts.filter(fact => fact.owner === 'ACTION_POOL_DELTA').map(fact => fact.valueHEPP));
  const terminalDeltaTotalHEPP = neumaierSum(reconciledFacts.filter(fact => fact.owner === 'TERMINAL_DELTA').map(fact => fact.valueHEPP));
  const causalTotalHEPP = neumaierSum(reconciledFacts.map(fact => fact.valueHEPP));
  if (causalTotalHEPP !== neumaierSum([stateDeltaTotalHEPP, actionPoolDeltaTotalHEPP, terminalDeltaTotalHEPP])) {
    fail('E_CAUSAL_RECONCILIATION', candidate.candidateId);
  }

  const information = evaluateInformation(candidate.informationGroups, world, candidate.actorSide);
  const risk = evaluateRisk(candidate.riskInputs, world);
  const exclusionReasons = [...candidate.hardExclusionCodes];
  if (!candidate.legal) exclusionReasons.push('ILLEGAL');
  const affectedUnitIds = [...new Set(opportunityAudit.filter(route => route.usable).flatMap(route => route.affectedUnitIds))].sort(utf16Compare);
  const objectiveUtilityHEPP = neumaierSum([causalTotalHEPP, information.valueHEPP]);
  return {
    candidateId: candidate.candidateId,
    actionId: candidate.actionId,
    targetSet: [...candidate.targetSet],
    paymentMode: candidate.paymentMode,
    eligible: exclusionReasons.length === 0,
    exclusionReasons,
    playerLocked: candidate.playerLocked,
    goalSatisfaction: {
      stateDeltaTotalHEPP,
      actionPoolDeltaTotalHEPP,
      terminalDeltaTotalHEPP,
      informationValueHEPP: information.valueHEPP,
      objectiveUtilityHEPP,
      discardedOverkillPP: healthResult.discardedOverkillPP,
    },
    risk,
    valueVector: {
      objectiveUtilityHEPP,
      worstTailUtilityHEPP: risk.worstTailUtilityHEPP,
      survivalUtilityHEPP: risk.survivalUtilityHEPP,
      assetReserveHEPP: risk.assetReserveHEPP,
      informationValueHEPP: information.valueHEPP,
      discardedOverkillPP: healthResult.discardedOverkillPP,
    },
    causalFacts: reconciledFacts,
    causalTotalHEPP,
    factAudit,
    opportunityAudit,
    affectedUnitIds,
    informationBreakdown: information.breakdown,
  };
}

function dominates(left, right) {
  let strict = false;
  for (const [dimension, direction] of PARETO_DIMENSIONS) {
    const leftValue = left.valueVector[dimension];
    const rightValue = right.valueVector[dimension];
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) fail('E_VECTOR', dimension);
    if (direction === 'MAXIMIZE') {
      if (leftValue < rightValue) return false;
      if (leftValue > rightValue) strict = true;
    } else {
      if (leftValue > rightValue) return false;
      if (leftValue < rightValue) strict = true;
    }
  }
  return strict;
}

function rankCompare(left, right) {
  for (const [dimension, direction] of PARETO_DIMENSIONS) {
    if (left.valueVector[dimension] === right.valueVector[dimension]) continue;
    return direction === 'MAXIMIZE'
      ? right.valueVector[dimension] - left.valueVector[dimension]
      : left.valueVector[dimension] - right.valueVector[dimension];
  }
  return utf16Compare(left.candidateId, right.candidateId);
}

export function evaluateRawCase(rawCase) {
  assertNoPrecomputed(rawCase, '$case');
  exactKeys(rawCase, CASE_KEYS, ['caseId', 'mode', 'playerLockedCandidateId', 'candidates'], 'E_CASE');
  text(rawCase.caseId, 'E_CASE_ID');
  if (rawCase.mode !== 'auto' && rawCase.mode !== 'manual') fail('E_CASE_MODE', rawCase.mode);
  nullableText(rawCase.playerLockedCandidateId, 'E_CASE_LOCK');
  if (!Array.isArray(rawCase.candidates) || rawCase.candidates.length === 0) fail('E_CASE_CANDIDATES', rawCase.caseId);
  const evaluatedCandidates = rawCase.candidates.map(evaluateRawCandidate);
  if (new Set(evaluatedCandidates.map(candidate => candidate.candidateId)).size !== evaluatedCandidates.length) fail('E_CASE_CANDIDATE_ID', 'duplicate');
  const eligible = evaluatedCandidates.filter(candidate => candidate.eligible);
  if (eligible.length === 0) fail('E_NO_ELIGIBLE_CANDIDATE', rawCase.caseId);
  const pareto = eligible.filter(candidate => !eligible.some(other => other !== candidate && dominates(other, candidate))).sort(rankCompare);
  let selected;
  if (rawCase.mode === 'manual') {
    selected = pareto.find(candidate => candidate.candidateId === rawCase.playerLockedCandidateId && candidate.playerLocked);
    if (!selected) fail('E_MANUAL_LOCK', rawCase.playerLockedCandidateId);
  } else selected = pareto[0];
  return {
    caseId: rawCase.caseId,
    mode: rawCase.mode,
    selected,
    paretoCandidateIds: pareto.map(candidate => candidate.candidateId).sort(utf16Compare),
    alternatives: pareto.filter(candidate => candidate !== selected).sort(rankCompare).map(candidate => candidate.candidateId),
    excludedCandidateIds: evaluatedCandidates.filter(candidate => !candidate.eligible).map(candidate => candidate.candidateId).sort(utf16Compare),
    evaluatedCandidates,
  };
}

export function assertRawCase(fixture) {
  exactKeys(fixture, ['caseId', 'semanticDomain', 'input', 'expected'], ['caseId', 'semanticDomain', 'input', 'expected'], 'E_FIXTURE');
  text(fixture.caseId, 'E_FIXTURE_ID');
  text(fixture.semanticDomain, 'E_FIXTURE_DOMAIN');
  exactKeys(fixture.input, ['mode', 'playerLockedCandidateId', 'candidates'], ['mode', 'playerLockedCandidateId', 'candidates'], 'E_FIXTURE_INPUT');
  object(fixture.expected, 'E_FIXTURE_EXPECTED');
  const result = evaluateRawCase({ caseId: fixture.caseId, ...fixture.input });
  if (result.selected.candidateId !== fixture.expected.selectedCandidateId) fail('E_EXPECTED_SELECTION', fixture.caseId);
  if (Object.hasOwn(fixture.expected, 'objectiveUtilityHEPP') && result.selected.valueVector.objectiveUtilityHEPP !== fixture.expected.objectiveUtilityHEPP) {
    fail('E_EXPECTED_OBJECTIVE', fixture.caseId);
  }
  return result;
}

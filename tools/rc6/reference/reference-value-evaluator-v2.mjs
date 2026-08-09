const OWNER_TYPES = new Set([
  'STATE_DELTA',
  'ACTION_POOL_DELTA',
  'TERMINAL_DELTA',
]);

const OWNER_BY_COMPONENT = Object.freeze({
  S1_HEALTH: 'STATE_DELTA',
  S1_TERMINAL: 'TERMINAL_DELTA',
  S2_ROUTE: 'ACTION_POOL_DELTA',
  S2_CONSTANT: 'ACTION_POOL_DELTA',
  S3_ROUTE: 'ACTION_POOL_DELTA',
  S3_BASIC_HIT: 'STATE_DELTA',
  S3_EVASION: 'STATE_DELTA',
  S3_DEFENSE: 'STATE_DELTA',
  S3_COUNTER: 'ACTION_POOL_DELTA',
  S3_HARD_CONTROL: 'ACTION_POOL_DELTA',
  S3_SOFT_CONTROL: 'ACTION_POOL_DELTA',
  S3_HEAL: 'STATE_DELTA',
  S3_SUPPORT_RESOURCE: 'ACTION_POOL_DELTA',
  S5_DOT: 'STATE_DELTA',
  S5_HOT: 'STATE_DELTA',
  S5_DELAYED_EFFECT: 'STATE_DELTA',
  S5_CREATION_CONSUMER: 'ACTION_POOL_DELTA',
  S5_SUMMON_WINDOW: 'ACTION_POOL_DELTA',
  S5_ITEM: 'ACTION_POOL_DELTA',
  S5_EQUIPMENT: 'ACTION_POOL_DELTA',
});

export const PARETO_DIMENSIONS = [
  ['objectiveUtilityHEPP', 'MAXIMIZE'],
  ['worstTailUtilityHEPP', 'MAXIMIZE'],
  ['survivalUtilityHEPP', 'MAXIMIZE'],
  ['assetReserveHEPP', 'MAXIMIZE'],
  ['informationValueHEPP', 'MAXIMIZE'],
  ['discardedOverkillPP', 'MINIMIZE'],
];

const fatal = (code, detail = '') => {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
};

const finite = (value, code, detail = '') => {
  const number = Number(value);
  if (!Number.isFinite(number)) fatal(code, detail);
  return Object.is(number, -0) ? 0 : number;
};

export const neumaierSum = values => {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const number = finite(value, 'REFERENCE_V2_NON_FINITE_SUM');
    const next = total + number;
    if (Math.abs(total) >= Math.abs(number)) compensation += (total - next) + number;
    else compensation += (number - next) + total;
    total = next;
  }
  const result = total + compensation;
  return Object.is(result, -0) ? 0 : result;
};

const array = (value, code, detail = '') => {
  if (!Array.isArray(value)) fatal(code, detail);
  return value;
};

const string = (value, code, detail = '') => {
  const result = String(value ?? '').trim();
  if (!result) fatal(code, detail);
  return result;
};

const probability = (value, detail) => {
  const result = finite(value, 'REFERENCE_V2_PROBABILITY_NON_FINITE', detail);
  if (result < 0 || result > 1) fatal('REFERENCE_V2_PROBABILITY_RANGE', detail);
  return result;
};

const evaluateInformation = groups => Math.max(0, ...array(
  groups || [],
  'REFERENCE_V2_INFORMATION_GROUPS_NOT_ARRAY',
).map(group => {
  const groupId = String(group?.groupId || '').trim();
  const outcomes = array(
    group?.outcomes,
    'REFERENCE_V2_INFORMATION_OUTCOMES_NOT_ARRAY',
    groupId,
  );
  if (!outcomes.length) fatal('REFERENCE_V2_INFORMATION_OUTCOMES_EMPTY', groupId);
  const probabilities = outcomes.map(outcome => probability(
    outcome?.probability,
    groupId,
  ));
  if (Math.abs(neumaierSum(probabilities) - 1) > 1e-12) {
    fatal('REFERENCE_V2_PROBABILITY_SUM_MISMATCH', groupId);
  }
  const routeValue = facts => neumaierSum(array(
    facts || [],
    'REFERENCE_V2_INFORMATION_ROUTE_FACTS_NOT_ARRAY',
    groupId,
  ).map(fact => factValue(fact, groupId)));
  const routeTableForOutcome = outcome => {
    if (!Object.hasOwn(outcome, 'futureCandidateRouteVector')) return null;
    const vector = outcome.futureCandidateRouteVector;
    const candidateIds = array(
      vector?.candidateIds,
      'REFERENCE_V2_INFORMATION_FUTURE_CANDIDATE_IDS_NOT_ARRAY',
      groupId,
    );
    const beforeRouteHEPP = array(
      vector?.beforeRouteHEPP,
      'REFERENCE_V2_INFORMATION_FUTURE_BEFORE_VALUES_NOT_ARRAY',
      groupId,
    );
    const afterRouteHEPP = array(
      vector?.afterRouteHEPP,
      'REFERENCE_V2_INFORMATION_FUTURE_AFTER_VALUES_NOT_ARRAY',
      groupId,
    );
    const applicationProbability = array(
      vector?.applicationProbability,
      'REFERENCE_V2_INFORMATION_FUTURE_PROBABILITIES_NOT_ARRAY',
      groupId,
    );
    const polarity = array(
      vector?.polarity,
      'REFERENCE_V2_INFORMATION_FUTURE_POLARITIES_NOT_ARRAY',
      groupId,
    );
    if (
      [beforeRouteHEPP, afterRouteHEPP, applicationProbability, polarity]
        .some(column => column.length !== candidateIds.length)
    ) {
      fatal('REFERENCE_V2_INFORMATION_FUTURE_VECTOR_LENGTH_MISMATCH', groupId);
    }
    const table = new Map();
    candidateIds.forEach((candidateIdValue, index) => {
      const candidateId = string(
        candidateIdValue,
        'REFERENCE_V2_INFORMATION_FUTURE_CANDIDATE_ID_MISSING',
        `${groupId}:${index}`,
      );
      if (table.has(candidateId)) {
        fatal(
          'REFERENCE_V2_INFORMATION_FUTURE_CANDIDATE_DUPLICATE',
          `${groupId}:${candidateId}`,
        );
      }
      const probabilityValue = probability(
        applicationProbability[index],
        `${groupId}:${index}`,
      );
      const value = (
        finite(
          afterRouteHEPP[index],
          'REFERENCE_V2_INFORMATION_FUTURE_AFTER_NON_FINITE',
          `${groupId}:${index}`,
        ) - finite(
          beforeRouteHEPP[index],
          'REFERENCE_V2_INFORMATION_FUTURE_BEFORE_NON_FINITE',
          `${groupId}:${index}`,
        )
      ) * probabilityValue * finite(
        polarity[index],
        'REFERENCE_V2_INFORMATION_FUTURE_POLARITY_NON_FINITE',
        `${groupId}:${index}`,
      );
      table.set(candidateId, value);
    });
    return table;
  };
  const routeTables = outcomes.map(routeTableForOutcome);
  const hasRouteTable = routeTables.some(Boolean);
  if (hasRouteTable && routeTables.some(table => !table)) {
    fatal('REFERENCE_V2_INFORMATION_FUTURE_ROUTES_INCOMPLETE', groupId);
  }
  if (hasRouteTable) {
    const adaptive = neumaierSum(routeTables.map((table, index) =>
      probabilities[index] * Math.max(0, ...table.values()),
    ));
    const deterministic = probabilities.every(
      value => value === 0 || value === 1,
    );
    if (deterministic) return 0;
    const commonCandidateIds = [...routeTables[0].keys()]
      .filter(candidateId => routeTables.every(table =>
        table.has(candidateId),
      ));
    const committed = Math.max(
      0,
      ...commonCandidateIds.map(candidateId =>
        neumaierSum(routeTables.map((table, index) =>
          probabilities[index] * table.get(candidateId),
        )),
      ),
    );
    return Math.max(0, adaptive - committed);
  }
  const deterministic = probabilities.every(
    value => value === 0 || value === 1,
  );
  if (deterministic) return 0;
  const adaptive = neumaierSum(outcomes.map((outcome, index) => {
    if (Object.hasOwn(outcome, 'bestFutureRouteValueHEPP')) {
      fatal('REFERENCE_V2_INFORMATION_PRECOMPUTED_VALUE', groupId);
    }
    return probabilities[index] * routeValue(outcome?.bestFutureRouteFacts || []);
  }));
  if (Object.hasOwn(group, 'committedValueHEPP')) {
    fatal('REFERENCE_V2_INFORMATION_PRECOMPUTED_VALUE', groupId);
  }
  const committed = routeValue(group?.committedRouteFacts || []);
  return Math.max(0, adaptive - committed);
}));

const factValue = (fact, candidateId) => {
  const formula = string(fact?.formula, 'REFERENCE_V2_FACT_FORMULA_MISSING', candidateId);
  if (formula === 'HEALTH_PP') {
    const deltaHp = finite(fact?.deltaHp, 'REFERENCE_V2_HEALTH_DELTA_NON_FINITE', candidateId);
    const maxHp = finite(fact?.maxHp, 'REFERENCE_V2_HEALTH_MAX_NON_FINITE', candidateId);
    if (maxHp <= 0) fatal('REFERENCE_V2_HEALTH_MAX_INVALID', candidateId);
    return 100 * deltaHp / maxHp * finite(fact?.polarity ?? 1, 'REFERENCE_V2_HEALTH_POLARITY_NON_FINITE', candidateId);
  }
  if (formula === 'ROUTE_DELTA') {
    const before = finite(fact?.beforeRouteHEPP, 'REFERENCE_V2_ROUTE_BEFORE_NON_FINITE', candidateId);
    const after = finite(fact?.afterRouteHEPP, 'REFERENCE_V2_ROUTE_AFTER_NON_FINITE', candidateId);
    const applicationProbability = probability(fact?.applicationProbability ?? 1, candidateId);
    const polarity = finite(fact?.polarity ?? 1, 'REFERENCE_V2_ROUTE_POLARITY_NON_FINITE', candidateId);
    return (after - before) * applicationProbability * polarity;
  }
  if (formula === 'TERMINAL_OUTCOME') {
    const win = probability(fact?.winProbability ?? 0, candidateId);
    const loss = probability(fact?.lossProbability ?? 0, candidateId);
    const draw = probability(fact?.drawProbability ?? 0, candidateId);
    if (Math.abs(neumaierSum([win, loss, draw]) - 1) > 1e-12) {
      fatal('REFERENCE_V2_TERMINAL_PROBABILITY_SUM_MISMATCH', candidateId);
    }
    return neumaierSum([
      win * finite(fact?.winUtilityHEPP ?? 100, 'REFERENCE_V2_WIN_UTILITY_NON_FINITE', candidateId),
      loss * finite(fact?.lossUtilityHEPP ?? -100, 'REFERENCE_V2_LOSS_UTILITY_NON_FINITE', candidateId),
      draw * finite(fact?.drawUtilityHEPP ?? 0, 'REFERENCE_V2_DRAW_UTILITY_NON_FINITE', candidateId),
    ]);
  }
  if (formula === 'CONSTANT_HEPP') {
    return finite(fact?.amountHEPP, 'REFERENCE_V2_CONSTANT_VALUE_NON_FINITE', candidateId);
  }
  fatal('REFERENCE_V2_FACT_FORMULA_UNSUPPORTED', `${candidateId}:${formula}`);
};

const objectiveSide = value => {
  const text = String(value ?? '').trim().toUpperCase();
  if (/ENEMY|敌方|对方/.test(text)) return 'ENEMY';
  if (/PLAYER|玩家|己方|友方/.test(text)) return 'PLAYER';
  return text;
};

const objectiveTargetRows = (candidate, condition) => {
  const targetIds = new Set(array(
    condition?.targetIds || [],
    'REFERENCE_V2_OBJECTIVE_TARGET_IDS_NOT_ARRAY',
    candidate?.candidateId,
  ).map(value => String(value ?? '').trim()).filter(Boolean));
  const expectedSide = objectiveSide(condition?.side);
  return array(
    candidate?.targetProfiles,
    'REFERENCE_V2_TARGET_PROFILES_NOT_ARRAY',
    candidate?.candidateId,
  ).filter(profile => {
    const targetId = String(profile?.targetId || '').trim();
    return (!targetIds.size || targetIds.has(targetId) ||
      targetIds.has(String(profile?.name || '').trim())) &&
      (!expectedSide || objectiveSide(profile?.side) === expectedSide);
  });
};

const objectiveConditionValue = (
  candidate,
  condition,
  trajectoryByTarget,
  groupRole,
) => {
  const type = String(condition?.type || '').trim().toUpperCase();
  const thresholdPP = 100 * Number(condition?.threshold || 0);
  const values = [];
  objectiveTargetRows(candidate, condition).forEach(profile => {
    const targetId = String(profile?.targetId || '').trim();
    const deltaPP = Number(trajectoryByTarget.get(targetId) || 0);
    const currentPP = finite(
      profile?.currentHpPP,
      'REFERENCE_V2_CURRENT_HP_RATIO_NON_FINITE',
      targetId,
    );
    const afterPP = Math.max(0, Math.min(100, currentPP + deltaPP));
    const ownTarget = objectiveSide(profile?.side) ===
      objectiveSide(candidate?.actorSide);
    let value = 0;
    if (groupRole === 'DEFEAT') {
      if (!ownTarget) return;
      value = type === 'HP_RATIO_AT_OR_BELOW'
        ? Math.max(0, afterPP - thresholdPP) -
          Math.max(0, currentPP - thresholdPP)
        : afterPP - currentPP;
    } else if (type === 'ROUND_REACHED' || type === 'WITHDRAW_SUCCESS') {
      if (ownTarget) value = afterPP - currentPP;
    } else if (!ownTarget) {
      value = type === 'HP_RATIO_AT_OR_BELOW'
        ? Math.max(0, currentPP - thresholdPP) -
          Math.max(0, afterPP - thresholdPP)
        : currentPP - afterPP;
    }
    values.push(value);
  });
  if (!values.length) return 0;
  return String(condition?.scope || 'ANY').trim().toUpperCase() === 'ALL'
    ? Math.min(...values)
    : Math.max(...values);
};

const objectiveGroupValue = (candidate, group, trajectoryByTarget, role) => {
  const values = array(
    group?.conditions || [],
    'REFERENCE_V2_OBJECTIVE_CONDITIONS_NOT_ARRAY',
    candidate?.candidateId,
  ).map(condition => objectiveConditionValue(
    candidate,
    condition,
    trajectoryByTarget,
    role,
  ));
  if (!values.length) return 0;
  return String(group?.logic || 'ANY').trim().toUpperCase() === 'ALL'
    ? Math.min(...values)
    : Math.max(...values);
};

const objectiveHealthValue = (candidate, healthByTarget) => {
  const objective = candidate?.objectiveContract;
  if (!objective || typeof objective !== 'object') return null;
  const victory = objectiveGroupValue(
    candidate,
    objective.victory || {},
    healthByTarget,
    'VICTORY',
  );
  const defeat = objectiveGroupValue(
    candidate,
    objective.defeat || {},
    healthByTarget,
    'DEFEAT',
  );
  if (
    Math.sign(victory) !== Math.sign(defeat) ||
    Math.abs(victory) <= 1e-9 ||
    Math.abs(defeat) <= 1e-9
  ) return victory + defeat;
  const victoryTargets = new Set(
    (objective.victory?.conditions || []).flatMap(condition =>
      objectiveTargetRows(candidate, condition).map(profile =>
        String(profile?.targetId || '').trim()
      )
    ),
  );
  const sharesTarget = (objective.defeat?.conditions || []).some(condition =>
    objectiveTargetRows(candidate, condition).some(profile =>
      victoryTargets.has(String(profile?.targetId || '').trim())
    )
  );
  return sharesTarget
    ? victory + defeat -
      Math.sign(victory) * Math.min(Math.abs(victory), Math.abs(defeat))
    : victory + defeat;
};

const evaluateFacts = (candidate, candidateId) => {
  const facts = array(candidate?.rawFacts, 'REFERENCE_V2_RAW_FACTS_NOT_ARRAY', candidateId);
  const sourceFactIds = new Set();
  const causalFacts = [];
  const totals = {
    STATE_DELTA: [],
    ACTION_POOL_DELTA: [],
    TERMINAL_DELTA: [],
  };
  const healthByTarget = new Map();
  const healthSourceFactIds = new Set();
  const orderedFacts = facts.map((fact, index) => ({
    fact,
    index,
    sourceFactId: string(
      fact?.sourceFactId,
      'REFERENCE_V2_SOURCE_FACT_ID_MISSING',
      candidateId,
    ),
    sequence: finite(
      fact?.sequence ?? index,
      'REFERENCE_V2_SEQUENCE_NON_FINITE',
      candidateId,
    ),
  })).sort((left, right) => left.sequence - right.sequence || left.index - right.index);
  orderedFacts.forEach(({ fact, index, sourceFactId, sequence }) => {
    if (sourceFactIds.has(sourceFactId)) fatal('REFERENCE_V2_DUPLICATE_SOURCE_FACT', sourceFactId);
    sourceFactIds.add(sourceFactId);
  });
  let terminalReached = false;
  orderedFacts.forEach(({ fact, index, sourceFactId, sequence }) => {
    if (terminalReached) return;
    if (Object.hasOwn(fact, 'causalOwnerType') || Object.hasOwn(fact, 'valueHEPP')) {
      fatal('REFERENCE_V2_RAW_OWNER_VALUE_INPUT', sourceFactId);
    }
    const componentCode = string(
      fact?.componentCode,
      'REFERENCE_V2_COMPONENT_CODE_MISSING',
      sourceFactId,
    );
    const ownerType = OWNER_BY_COMPONENT[componentCode];
    if (!ownerType) fatal('REFERENCE_V2_COMPONENT_OWNER_UNKNOWN', componentCode);
    if (!OWNER_TYPES.has(ownerType)) fatal('REFERENCE_V2_OWNER_TYPE_UNKNOWN', ownerType);
    const valueHEPP = factValue(fact, candidateId);
    if (String(fact?.formula || '').trim() === 'HEALTH_PP') {
      healthSourceFactIds.add(sourceFactId);
      const targetId = string(
        fact?.targetUnitId,
        'REFERENCE_V2_HEALTH_TARGET_ID_MISSING',
        sourceFactId,
      );
      const deltaHp = finite(
        fact?.deltaHp,
        'REFERENCE_V2_HEALTH_DELTA_NON_FINITE',
        sourceFactId,
      );
      const maxHp = finite(
        fact?.maxHp,
        'REFERENCE_V2_HEALTH_MAX_NON_FINITE',
        sourceFactId,
      );
      healthByTarget.set(
        targetId,
        neumaierSum([
          healthByTarget.get(targetId) || 0,
          100 * deltaHp / maxHp,
        ]),
      );
    }
    const normalized = {
      componentCode,
      causalOwnerType: ownerType,
      valueHEPP,
      sourceEventId: string(fact?.sourceEventId, 'REFERENCE_V2_SOURCE_EVENT_ID_MISSING', sourceFactId),
      sourceFactId,
      targetUnitId: string(fact?.targetUnitId, 'REFERENCE_V2_TARGET_UNIT_ID_MISSING', sourceFactId),
      sequence,
    };
    causalFacts.push(normalized);
    totals[ownerType].push(valueHEPP);
    if (String(fact?.formula || '').trim() === 'TERMINAL_OUTCOME') {
      terminalReached = true;
    }
  });
  return {
    causalFacts,
    stateDeltaTotal: neumaierSum(totals.STATE_DELTA),
    actionPoolDeltaTotal: neumaierSum(totals.ACTION_POOL_DELTA),
    terminalDeltaTotal: neumaierSum(totals.TERMINAL_DELTA),
    healthByTarget,
    healthSourceFactIds,
  };
};

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const evaluateDiscardedOverkill = (candidate, healthByTarget) => {
  const victoryConditions = Array.isArray(candidate?.objectiveContract?.victory?.conditions)
    ? candidate.objectiveContract.victory.conditions
    : [];
  let discarded = 0;
  healthByTarget.forEach((deltaPP, targetId) => {
    const damagePP = Math.max(0, -Number(deltaPP || 0));
    if (!(damagePP > 0)) return;
    const matchingThresholds = victoryConditions.filter(condition =>
      String(condition?.type || '').trim().toUpperCase() === 'HP_RATIO_AT_OR_BELOW' &&
      objectiveTargetRows(candidate, condition).some(profile =>
        String(profile?.targetId || '').trim() === targetId,
      ),
    );
    if (!matchingThresholds.length) return;
    const requiresKill = victoryConditions.some(condition =>
      ['TEAM_DEAD', 'UNIT_DEAD'].includes(
        String(condition?.type || '').trim().toUpperCase(),
      ) && objectiveTargetRows(candidate, condition).some(profile =>
        String(profile?.targetId || '').trim() === targetId,
      ),
    );
    if (requiresKill) return;
    const profile = candidate.targetProfiles?.find(row =>
      String(row?.targetId || '').trim() === targetId,
    );
    const currentPP = finite(
      profile?.currentHpPP,
      'REFERENCE_V2_CURRENT_HP_RATIO_NON_FINITE',
      targetId,
    );
    const countablePP = Math.max(...matchingThresholds.map(condition =>
      Math.max(0, currentPP - 100 * Number(condition?.threshold || 0)),
    ));
    discarded += Math.max(0, damagePP - Math.min(damagePP, countablePP));
  });
  return finite(discarded, 'REFERENCE_V2_OVERKILL_NON_FINITE', candidate?.candidateId);
};

const evaluateRisk = (candidate, candidateId, healthByTarget) => {
  const inputs = candidate?.riskInputs;
  if (!inputs || typeof inputs !== 'object') {
    return {
      worstTailUtilityHEPP: finite(
        candidate?.risk?.worstTailUtilityHEPP ?? 0,
        'REFERENCE_V2_TAIL_NON_FINITE',
        candidateId,
      ),
      survivalUtilityHEPP: finite(
        candidate?.risk?.survivalUtilityHEPP ?? 0,
        'REFERENCE_V2_SURVIVAL_NON_FINITE',
        candidateId,
      ),
      assetReserveHEPP: finite(
        candidate?.risk?.assetReserveHEPP ?? 0,
        'REFERENCE_V2_RESERVE_NON_FINITE',
        candidateId,
      ),
      discardedOverkillPP: finite(
        candidate?.risk?.discardedOverkillPP ?? 0,
        'REFERENCE_V2_OVERKILL_NON_FINITE',
        candidateId,
      ),
    };
  }
  const maxHp = finite(inputs.actorMaxHp, 'REFERENCE_V2_RISK_MAX_HP_NON_FINITE', candidateId);
  if (maxHp <= 0) fatal('REFERENCE_V2_RISK_MAX_HP_INVALID', candidateId);
  const baseHp = finite(inputs.actorHp, 'REFERENCE_V2_RISK_BASE_HP_NON_FINITE', candidateId);
  let lowerBoundPP = clamp(100 * baseHp / maxHp, 0, 100);
  let worstTailLossPP = 0;
  array(inputs.actorOutcomeDeltas || [], 'REFERENCE_V2_RISK_OUTCOMES_NOT_ARRAY', candidateId)
    .forEach((outcome, index) => {
      const deltas = array(
        outcome?.deltas || [],
        'REFERENCE_V2_RISK_DELTA_BRANCHES_NOT_ARRAY',
        `${candidateId}:${index}`,
      ).map((delta, deltaIndex) => finite(
        delta,
        'REFERENCE_V2_RISK_DELTA_NON_FINITE',
        `${candidateId}:${index}:${deltaIndex}`,
      ));
      if (!deltas.length) return;
      const minimumDeltaPP = 100 * Math.min(...deltas) / maxHp;
      lowerBoundPP = clamp(lowerBoundPP + minimumDeltaPP, 0, 100);
      worstTailLossPP = Math.max(worstTailLossPP, Math.max(0, -minimumDeltaPP));
    });
  if (inputs.negativeTerminal === true) {
    worstTailLossPP = Math.max(worstTailLossPP, 100);
    lowerBoundPP = 0;
  }
  const assetReserveHEPP = neumaierSum(
    array(inputs.shieldFacts || [], 'REFERENCE_V2_RISK_SHIELDS_NOT_ARRAY', candidateId)
      .map((fact, index) => {
        const deltaHp = finite(fact?.deltaHp, 'REFERENCE_V2_RISK_SHIELD_DELTA_NON_FINITE', `${candidateId}:${index}`);
        const shieldMaxHp = finite(fact?.maxHp, 'REFERENCE_V2_RISK_SHIELD_MAX_HP_NON_FINITE', `${candidateId}:${index}`);
        if (shieldMaxHp <= 0) fatal('REFERENCE_V2_RISK_SHIELD_MAX_HP_INVALID', candidateId);
        const polarity = String(fact?.side || '').trim() === String(inputs.actorSide || '').trim()
          ? 1
          : -1;
        return 100 * deltaHp / shieldMaxHp * polarity;
      }),
  );
  return {
    worstTailUtilityHEPP: finite(-worstTailLossPP, 'REFERENCE_V2_TAIL_NON_FINITE', candidateId),
    survivalUtilityHEPP: finite(lowerBoundPP, 'REFERENCE_V2_SURVIVAL_NON_FINITE', candidateId),
    assetReserveHEPP: finite(assetReserveHEPP, 'REFERENCE_V2_RESERVE_NON_FINITE', candidateId),
    discardedOverkillPP: evaluateDiscardedOverkill(candidate, healthByTarget),
  };
};

export const evaluateRawCandidate = (candidate = {}) => {
  const candidateId = string(candidate?.candidateId, 'REFERENCE_V2_CANDIDATE_ID_MISSING');
  const forbiddenComputedFields = [
    'stateDeltaTotal',
    'actionPoolDeltaTotal',
    'terminalDeltaTotal',
    'goalUtilityDeltaHEPP',
    'informationValueHEPP',
    'objectiveUtilityHEPP',
    'causalFacts',
  ];
  const leakedField = forbiddenComputedFields.find(field =>
    Object.hasOwn(candidate, field),
  );
  if (leakedField) fatal('REFERENCE_V2_PRECOMPUTED_INPUT', `${candidateId}:${leakedField}`);
  const facts = evaluateFacts(candidate, candidateId);
  const objectiveStateValue = objectiveHealthValue(
    candidate,
    facts.healthByTarget,
  );
  const objectiveHealthSources = facts.causalFacts.filter(fact =>
    facts.healthSourceFactIds.has(fact.sourceFactId),
  );
  const causalFacts = (
    objectiveStateValue === null
      ? facts.causalFacts
      : facts.causalFacts
        .filter(fact => !facts.healthSourceFactIds.has(fact.sourceFactId))
        .concat(objectiveHealthSources.length ? [{
          componentCode: 'S1_HEALTH',
          causalOwnerType: 'STATE_DELTA',
          valueHEPP: objectiveStateValue,
          sourceEventId: objectiveHealthSources[0].sourceEventId,
          sourceFactId: `${candidateId}:objective-state`,
          sourceFactIds: objectiveHealthSources.map(fact => fact.sourceFactId),
          targetUnitId: objectiveHealthSources.map(fact => fact.targetUnitId).sort().join('|'),
          sequence: Math.min(...objectiveHealthSources.map(fact => Number(fact.sequence || 0))),
        }] : [])
  );
  const stateDeltaTotal = objectiveStateValue === null
    ? facts.stateDeltaTotal
    : neumaierSum(causalFacts
      .filter(fact => fact.causalOwnerType === 'STATE_DELTA')
      .map(fact => fact.valueHEPP));
  const goalUtilityDeltaHEPP = neumaierSum([
    stateDeltaTotal,
    facts.actionPoolDeltaTotal,
    facts.terminalDeltaTotal,
  ]);
  const causalTotal = neumaierSum(causalFacts.map(fact => fact.valueHEPP));
  if (Math.abs(causalTotal - goalUtilityDeltaHEPP) > 1e-6) {
    fatal('REFERENCE_V2_CAUSAL_RECONCILIATION_MISMATCH', candidateId);
  }
  const informationValueHEPP = evaluateInformation(candidate?.informationGroups || []);
  const objectiveUtilityHEPP = neumaierSum([
    goalUtilityDeltaHEPP,
    informationValueHEPP,
  ]);
  const risk = evaluateRisk(candidate, candidateId, facts.healthByTarget);
  return {
    ...candidate,
    candidateId,
    actionId: string(candidate?.actionId, 'REFERENCE_V2_ACTION_ID_MISSING', candidateId),
    targetSet: array(candidate?.targetSet, 'REFERENCE_V2_TARGET_SET_NOT_ARRAY', candidateId).map(String),
    paymentMode: string(candidate?.paymentMode || 'FULL', 'REFERENCE_V2_PAYMENT_MODE_MISSING', candidateId),
    legal: candidate?.legal !== false,
    hardExclusionCodes: array(candidate?.hardExclusionCodes || [], 'REFERENCE_V2_EXCLUSIONS_NOT_ARRAY', candidateId).map(String),
    ...facts,
    causalFacts,
    stateDeltaTotal,
    goalUtilityDeltaHEPP,
    informationValueHEPP,
    objectiveUtilityHEPP,
    worstTailUtilityHEPP: risk.worstTailUtilityHEPP,
    survivalUtilityHEPP: risk.survivalUtilityHEPP,
    assetReserveHEPP: risk.assetReserveHEPP,
    discardedOverkillPP: risk.discardedOverkillPP,
    vector: {
      objectiveUtilityHEPP,
      worstTailUtilityHEPP: risk.worstTailUtilityHEPP,
      survivalUtilityHEPP: risk.survivalUtilityHEPP,
      assetReserveHEPP: risk.assetReserveHEPP,
      informationValueHEPP,
      discardedOverkillPP: risk.discardedOverkillPP,
    },
  };
};

const dominates = (left, right) => {
  let strictlyBetter = false;
  for (const [field, direction] of PARETO_DIMENSIONS) {
    const leftValue = left.vector[field];
    const rightValue = right.vector[field];
    if (direction === 'MAXIMIZE') {
      if (leftValue < rightValue) return false;
      if (leftValue > rightValue) strictlyBetter = true;
    } else {
      if (leftValue > rightValue) return false;
      if (leftValue < rightValue) strictlyBetter = true;
    }
  }
  return strictlyBetter;
};

const rankCompare = (left, right) => {
  for (const [field, direction] of PARETO_DIMENSIONS) {
    const delta = left.vector[field] - right.vector[field];
    if (delta !== 0) return direction === 'MAXIMIZE' ? -delta : delta;
  }
  return left.candidateId < right.candidateId
    ? -1
    : left.candidateId > right.candidateId
      ? 1
      : 0;
};

const structurallyDifferent = (left, right) =>
  left.actionId !== right.actionId ||
  JSON.stringify(left.targetSet) !== JSON.stringify(right.targetSet) ||
  left.paymentMode !== right.paymentMode;

const normalizedDistance = (candidate, selected, pool) => {
  let distance = 0;
  for (const [field, direction] of PARETO_DIMENSIONS) {
    const values = pool.map(item => item.vector[field]);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum;
    if (span === 0) continue;
    const value = candidate.vector[field];
    const normalized = direction === 'MAXIMIZE'
      ? (value - minimum) / span
      : (maximum - value) / span;
    const selectedValue = selected.vector[field];
    const selectedNormalized = direction === 'MAXIMIZE'
      ? (selectedValue - minimum) / span
      : (maximum - selectedValue) / span;
    if (!Number.isFinite(normalized) || !Number.isFinite(selectedNormalized)) {
      fatal('REFERENCE_V2_NON_FINITE_L1_DISTANCE', field);
    }
    distance += Math.abs(normalized - selectedNormalized);
  }
  return distance;
};

export const evaluateRawCase = (input = {}) => {
  const candidates = array(input?.candidates, 'REFERENCE_V2_CANDIDATES_NOT_ARRAY', input?.caseId);
  const ids = new Set();
  const evaluated = candidates.map(candidate => {
    const item = evaluateRawCandidate(candidate);
    if (ids.has(item.candidateId)) fatal('REFERENCE_V2_DUPLICATE_CANDIDATE_ID', item.candidateId);
    ids.add(item.candidateId);
    return item;
  });
  const eligible = evaluated.filter(candidate =>
    candidate.legal !== false && candidate.hardExclusionCodes.length === 0,
  );
  if (!eligible.length) fatal('REFERENCE_V2_NO_LEGAL_CANDIDATE', input?.caseId);
  const pareto = eligible
    .filter(candidate => !eligible.some(other => other !== candidate && dominates(other, candidate)))
    .sort(rankCompare);
  const selected = input?.mode === 'manual'
    ? eligible.find(candidate => candidate.candidateId === input.playerLockedCandidateId)
    : pareto[0];
  if (!selected) fatal('REFERENCE_V2_SELECTED_CANDIDATE_MISSING', input?.caseId);
  const alternative1 = pareto.find(candidate =>
    candidate.candidateId !== selected.candidateId && structurallyDifferent(candidate, selected),
  ) || null;
  const remaining = pareto.filter(candidate =>
    candidate.candidateId !== selected.candidateId && candidate !== alternative1,
  );
  const alternative2 = remaining.length
    ? remaining.slice().sort((left, right) =>
        normalizedDistance(right, selected, pareto) - normalizedDistance(left, selected, pareto) ||
        rankCompare(left, right),
      )[0]
    : null;
  return {
    caseId: String(input?.caseId || ''),
    evaluated,
    eligible,
    pareto,
    selected,
    alternatives: [alternative1, alternative2].filter(Boolean),
  };
};

export const assertRawCase = input => {
  const result = evaluateRawCase(input);
  if (result.selected.candidateId !== input?.expected?.selectedCandidateId) {
    fatal(
      'REFERENCE_V2_SELECTION_MISMATCH',
      `${input?.caseId}:${result.selected.candidateId}:${input?.expected?.selectedCandidateId}`,
    );
  }
  return result;
};

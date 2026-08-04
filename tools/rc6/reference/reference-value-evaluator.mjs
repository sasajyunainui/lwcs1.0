import fs from 'node:fs';

export const CAUSAL_OWNER_TYPES = new Set([
  'STATE_DELTA',
  'ACTION_POOL_DELTA',
  'TERMINAL_DELTA',
]);

export const PARETO_DIMENSIONS = [
  ['objectiveUtilityHEPP', 'MAXIMIZE'],
  ['worstTailUtilityHEPP', 'MAXIMIZE'],
  ['survivalUtilityHEPP', 'MAXIMIZE'],
  ['assetReserveHEPP', 'MAXIMIZE'],
  ['informationValueHEPP', 'MAXIMIZE'],
  ['discardedOverkillPP', 'MINIMIZE'],
];

const TOLERANCE = 1e-6;

const fatal = (code, detail = '') => {
  const suffix = detail ? `:${detail}` : '';
  throw new Error(`${code}${suffix}`);
};

const finite = (value, code, detail) => {
  const number = Number(value);
  if (!Number.isFinite(number)) fatal(code, detail);
  return Object.is(number, -0) ? 0 : number;
};

export const neumaierSum = values => {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const number = finite(value, 'REFERENCE_NON_FINITE_SUMMATION');
    const next = sum + number;
    if (Math.abs(sum) >= Math.abs(number)) compensation += (sum - next) + number;
    else compensation += (number - next) + sum;
    sum = next;
  }
  return Object.is(sum + compensation, -0) ? 0 : sum + compensation;
};

const ensureArray = (value, code, detail) => {
  if (!Array.isArray(value)) fatal(code, detail);
  return value;
};

const assertProbability = (value, detail) => {
  const probability = finite(value, 'REFERENCE_NON_FINITE_PROBABILITY', detail);
  if (probability < 0 || probability > 1) fatal('REFERENCE_PROBABILITY_OUT_OF_RANGE', detail);
  return probability;
};

export const evaluateInformation = (groups = []) => {
  ensureArray(groups, 'REFERENCE_INFORMATION_GROUPS_NOT_ARRAY');
  if (groups.length === 0) return 0;
  const values = groups.map(group => {
    const outcomes = ensureArray(group?.outcomes, 'REFERENCE_INFORMATION_OUTCOMES_NOT_ARRAY', group?.groupId);
    if (outcomes.length === 0) fatal('REFERENCE_INFORMATION_OUTCOMES_EMPTY', group?.groupId);
    const probabilities = outcomes.map(outcome => assertProbability(outcome?.probability, group?.groupId));
    const probabilityTotal = neumaierSum(probabilities);
    if (Math.abs(probabilityTotal - 1) > 1e-12) fatal('REFERENCE_PROBABILITY_SUM_MISMATCH', group?.groupId);
    const adaptive = neumaierSum(outcomes.map((outcome, index) => (
      probabilities[index] * finite(outcome?.bestFutureRouteValueHEPP, 'REFERENCE_NON_FINITE_FUTURE_VALUE', group?.groupId)
    )));
    const committed = finite(group?.committedValueHEPP, 'REFERENCE_NON_FINITE_COMMITTED_VALUE', group?.groupId);
    return Math.max(0, adaptive - committed);
  });
  return Math.max(0, ...values);
};

const causalFactsFor = (candidate, candidateId) => {
  const facts = ensureArray(candidate?.causalFacts, 'REFERENCE_CAUSAL_FACTS_NOT_ARRAY', candidateId);
  const factIds = new Set();
  for (const fact of facts) {
    const factId = String(fact?.sourceFactId || '');
    if (!factId) fatal('REFERENCE_CAUSAL_FACT_ID_MISSING', candidateId);
    if (factIds.has(factId)) fatal('REFERENCE_DUPLICATE_CAUSAL_VALUE', factId);
    factIds.add(factId);
    if (!CAUSAL_OWNER_TYPES.has(fact?.causalOwnerType)) fatal('REFERENCE_UNKNOWN_CAUSAL_OWNER', factId);
    finite(fact?.valueHEPP, 'REFERENCE_NON_FINITE_CAUSAL_VALUE', factId);
    if (!String(fact?.sourceEventId || '') || !String(fact?.targetUnitId || '')) {
      fatal('REFERENCE_CAUSAL_SOURCE_MISSING', factId);
    }
  }
  return facts;
};

export const evaluateCandidate = (candidate = {}) => {
  const candidateId = String(candidate.candidateId || '');
  if (!candidateId) fatal('REFERENCE_CANDIDATE_ID_MISSING');
  const stateDeltaTotal = finite(candidate.stateDeltaTotal, 'REFERENCE_NON_FINITE_STATE_DELTA', candidateId);
  const actionPoolDeltaTotal = finite(candidate.actionPoolDeltaTotal, 'REFERENCE_NON_FINITE_ACTION_POOL_DELTA', candidateId);
  const terminalDeltaTotal = finite(candidate.terminalDeltaTotal, 'REFERENCE_NON_FINITE_TERMINAL_DELTA', candidateId);
  const goalUtilityDeltaHEPP = neumaierSum([stateDeltaTotal, actionPoolDeltaTotal, terminalDeltaTotal]);
  const informationValueHEPP = evaluateInformation(candidate.informationGroups || []);
  const objectiveUtilityHEPP = neumaierSum([goalUtilityDeltaHEPP, informationValueHEPP]);
  const causalFacts = causalFactsFor(candidate, candidateId);
  const causalTotal = neumaierSum(causalFacts.map(fact => fact.valueHEPP));
  if (Math.abs(causalTotal - goalUtilityDeltaHEPP) > TOLERANCE) {
    fatal('REFERENCE_CAUSAL_RECONCILIATION_MISMATCH', candidateId);
  }
  const targetSet = ensureArray(candidate.targetSet, 'REFERENCE_TARGET_SET_NOT_ARRAY', candidateId).map(String);
  const vector = {
    objectiveUtilityHEPP,
    worstTailUtilityHEPP: finite(candidate.worstTailUtilityHEPP, 'REFERENCE_NON_FINITE_TAIL', candidateId),
    survivalUtilityHEPP: finite(candidate.survivalUtilityHEPP, 'REFERENCE_NON_FINITE_SURVIVAL', candidateId),
    assetReserveHEPP: finite(candidate.assetReserveHEPP, 'REFERENCE_NON_FINITE_RESERVE', candidateId),
    informationValueHEPP,
    discardedOverkillPP: finite(candidate.discardedOverkillPP, 'REFERENCE_NON_FINITE_OVERKILL', candidateId),
  };
  return {
    ...candidate,
    candidateId,
    actionId: String(candidate.actionId || ''),
    targetSet,
    paymentMode: String(candidate.paymentMode || ''),
    hardExclusionCodes: ensureArray(candidate.hardExclusionCodes || [], 'REFERENCE_EXCLUSION_NOT_ARRAY', candidateId).map(String),
    causalFacts,
    stateDeltaTotal,
    actionPoolDeltaTotal,
    terminalDeltaTotal,
    goalUtilityDeltaHEPP,
    informationValueHEPP,
    objectiveUtilityHEPP,
    vector,
  };
};

const structurallyDifferent = (left, right) => (
  left.actionId !== right.actionId ||
  JSON.stringify(left.targetSet) !== JSON.stringify(right.targetSet) ||
  left.paymentMode !== right.paymentMode
);

export const dominates = (left, right) => {
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
  if (left.candidateId < right.candidateId) return -1;
  if (left.candidateId > right.candidateId) return 1;
  return 0;
};

export const normalizeParetoDistance = (candidate, pool) => {
  let distance = 0;
  for (const [field, direction] of PARETO_DIMENSIONS) {
    const values = pool.map(item => item.vector[field]);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum;
    if (span === 0) continue;
    const normalized = direction === 'MAXIMIZE'
      ? (candidate.vector[field] - minimum) / span
      : (maximum - candidate.vector[field]) / span;
    if (!Number.isFinite(normalized)) fatal('REFERENCE_NON_FINITE_L1_DISTANCE', field);
    distance += Math.abs(normalized);
  }
  return distance;
};

export const evaluateCase = (input = {}) => {
  const candidates = ensureArray(input.candidates, 'REFERENCE_CANDIDATES_NOT_ARRAY', input.caseId);
  const ids = new Set();
  const evaluated = candidates.map(candidate => {
    const item = evaluateCandidate(candidate);
    if (ids.has(item.candidateId)) fatal('REFERENCE_DUPLICATE_CANDIDATE_ID', item.candidateId);
    ids.add(item.candidateId);
    return item;
  });
  const eligible = evaluated.filter(candidate => candidate.legal !== false && candidate.hardExclusionCodes.length === 0);
  if (eligible.length === 0) fatal('REFERENCE_NO_LEGAL_CANDIDATE', input.caseId);
  const pareto = eligible.filter(candidate => !eligible.some(other => other !== candidate && dominates(other, candidate)));
  const rankedPareto = pareto.slice().sort(rankCompare);
  let selected;
  if (input.mode === 'manual') {
    selected = evaluated.find(candidate => candidate.candidateId === input.playerLockedCandidateId);
    if (!selected || selected.legal === false || selected.hardExclusionCodes.length) fatal('REFERENCE_PLAYER_LOCKED_INVALID', input.caseId);
  } else {
    selected = rankedPareto[0];
  }
  const alternative1 = rankedPareto.find(candidate => candidate.candidateId !== selected.candidateId && structurallyDifferent(candidate, selected)) || null;
  const remaining = rankedPareto.filter(candidate => candidate.candidateId !== selected.candidateId);
  const alternative2 = remaining.length
    ? remaining.slice().sort((left, right) => {
      const delta = normalizeParetoDistance(right, rankedPareto) - normalizeParetoDistance(left, rankedPareto);
      return delta || rankCompare(left, right);
    })[0]
    : null;
  return {
    caseId: String(input.caseId || ''),
    mode: String(input.mode || 'auto'),
    evaluated,
    eligible,
    pareto: rankedPareto,
    selected,
    alternatives: [alternative1, alternative2].filter(Boolean),
  };
};

export const assertReferenceCase = input => {
  const result = evaluateCase(input);
  const expected = input.expected || {};
  if (result.selected.candidateId !== expected.selectedCandidateId) {
    fatal('REFERENCE_SELECTION_MISMATCH', `${input.caseId}:${result.selected.candidateId}:${expected.selectedCandidateId}`);
  }
  return result;
};

export const readJson = fileName => JSON.parse(fs.readFileSync(fileName, 'utf8'));

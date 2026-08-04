/* BattleDecisionR9v2Kernel_Module.js - isolated R9v2 value-kernel contract. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const VERSION = '9v2-kernel-1.0.0';
  const SCHEMA_VERSION = 'ValueKernelSessionV1';
  const OPERATIONS = new Set([
    'SET',
    'ADD',
    'REMOVE',
    'EXPIRE',
    'SPAWN',
    'DESPAWN',
    'SCHEDULE',
    'CANCEL',
  ]);
  const OWNER_TYPES = new Set([
    'STATE_DELTA',
    'ACTION_POOL_DELTA',
    'TERMINAL_DELTA',
    'NONE',
  ]);
  const PARETO_DIMENSIONS = Object.freeze([
    ['objectiveUtilityHEPP', 'MAXIMIZE'],
    ['worstTailUtilityHEPP', 'MAXIMIZE'],
    ['survivalUtilityHEPP', 'MAXIMIZE'],
    ['assetReserveHEPP', 'MAXIMIZE'],
    ['informationValueHEPP', 'MAXIMIZE'],
    ['discardedOverkillPP', 'MINIMIZE'],
  ]);

  const fatal = (code, detail = '') => {
    throw new Error(`${code}${detail ? `:${detail}` : ''}`);
  };
  const finite = (value, code, detail) => {
    const number = Number(value);
    if (!Number.isFinite(number)) fatal(code, detail);
    return Object.is(number, -0) ? 0 : number;
  };
  const clone = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
    return value;
  };
  const sum = values => {
    let total = 0;
    let compensation = 0;
    for (const value of values) {
      const number = finite(value, 'R9V2_KERNEL_NON_FINITE_SUM');
      const next = total + number;
      if (Math.abs(total) >= Math.abs(number)) compensation += (total - next) + number;
      else compensation += (number - next) + total;
      total = next;
    }
    return Object.is(total + compensation, -0) ? 0 : total + compensation;
  };
  const stringValue = (value, code) => {
    const result = String(value ?? '').trim();
    if (!result) fatal(code);
    return result;
  };
  const arrayValue = (value, code) => {
    if (!Array.isArray(value)) fatal(code);
    return value;
  };

  function buildMechanicalColumns(rows) {
    const candidateIds = rows.map(row => stringValue(row.candidateId, 'R9V2_KERNEL_CANDIDATE_ID_MISSING'));
    const targetOffsets = [];
    const targetUnitIds = [];
    const directFactRanges = [];
    const scheduledFactRanges = [];
    const dependencyTokenRanges = [];
    let targetOffset = 0;
    let factOffset = 0;
    let scheduledOffset = 0;
    let dependencyOffset = 0;
    const columns = {
      schemaVersion: 'MechanicalColumnsV1',
      worldRevision: '',
      opportunityRevision: '',
      candidateIds,
      actorIds: [],
      targetOffsets,
      targetUnitIds,
      sourceActionIds: [],
      paymentModes: [],
      resourceCosts: [],
      successProbabilities: [],
      directFactRanges,
      scheduledFactRanges,
      dependencyTokenRanges,
    };
    for (const row of rows) {
      const targets = arrayValue(row.targetSet || row.targetUnitIds || [], 'R9V2_KERNEL_TARGETS_NOT_ARRAY').map(String);
      const directFacts = arrayValue(row.directFacts || [], 'R9V2_KERNEL_DIRECT_FACTS_NOT_ARRAY');
      const scheduledFacts = arrayValue(row.scheduledFacts || [], 'R9V2_KERNEL_SCHEDULED_FACTS_NOT_ARRAY');
      const dependencies = arrayValue(row.dependencyTokens || [], 'R9V2_KERNEL_DEPENDENCY_TOKENS_NOT_ARRAY').map(String);
      columns.actorIds.push(stringValue(row.actorId, 'R9V2_KERNEL_ACTOR_ID_MISSING'));
      columns.targetOffsets.push([targetOffset, targetOffset + targets.length]);
      columns.targetUnitIds.push(...targets);
      columns.sourceActionIds.push(stringValue(row.actionId, 'R9V2_KERNEL_ACTION_ID_MISSING'));
      columns.paymentModes.push(stringValue(row.paymentMode || 'FULL', 'R9V2_KERNEL_PAYMENT_MODE_MISSING'));
      columns.resourceCosts.push(clone(row.resourceCosts || {}));
      columns.successProbabilities.push(row.successProbability ?? 1);
      columns.directFactRanges.push([factOffset, factOffset + directFacts.length]);
      columns.scheduledFactRanges.push([scheduledOffset, scheduledOffset + scheduledFacts.length]);
      columns.dependencyTokenRanges.push([dependencyOffset, dependencyOffset + dependencies.length]);
      targetOffset += targets.length;
      factOffset += directFacts.length;
      scheduledOffset += scheduledFacts.length;
      dependencyOffset += dependencies.length;
    }
    return freeze(columns);
  }

  function assertColumns(columns, candidateIds) {
    if (!columns || columns.schemaVersion !== 'MechanicalColumnsV1') fatal('R9V2_KERNEL_COLUMNS_SCHEMA_MISMATCH');
    for (const key of ['candidateIds', 'actorIds', 'targetOffsets', 'targetUnitIds', 'sourceActionIds', 'paymentModes', 'resourceCosts', 'successProbabilities', 'directFactRanges', 'scheduledFactRanges', 'dependencyTokenRanges']) {
      arrayValue(columns[key], `R9V2_KERNEL_COLUMN_MISSING:${key}`);
    }
    if (JSON.stringify(columns.candidateIds) !== JSON.stringify(candidateIds)) fatal('R9V2_KERNEL_CANDIDATE_COLUMN_MISMATCH');
    if (columns.actorIds.length !== candidateIds.length || columns.sourceActionIds.length !== candidateIds.length) fatal('R9V2_KERNEL_COLUMN_LENGTH_MISMATCH');
    return freeze(clone(columns));
  }

  function normalizeBeliefOverlay(input = {}) {
    for (const forbiddenKey of ['hiddenExactHp', 'hiddenResistance', 'hiddenInventory', 'hiddenAbility', 'unobservedPosterior']) {
      if (Object.hasOwn(input, forbiddenKey)) fatal('BELIEF_HIDDEN_STATE_LEAK', forbiddenKey);
    }
    const overlay = {
      schemaVersion: 'BeliefOverlayV1',
      observerId: stringValue(input.observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING'),
      beliefRevision: stringValue(input.beliefRevision || '1', 'R9V2_KERNEL_BELIEF_REVISION_MISSING'),
      visibleHpRatios: clone(input.visibleHpRatios || {}),
      visibleStates: clone(input.visibleStates || {}),
      revealedAbilityIds: arrayValue(input.revealedAbilityIds || [], 'R9V2_KERNEL_REVEALED_ABILITIES_NOT_ARRAY').map(String),
      observableDeclarations: clone(input.observableDeclarations || []),
      posteriorParameters: clone(input.posteriorParameters || {}),
      visibilityTokens: arrayValue(input.visibilityTokens || [], 'R9V2_KERNEL_VISIBILITY_TOKENS_NOT_ARRAY').map(String),
    };
    return freeze(overlay);
  }

  function normalizeCausalFacts(candidateId, facts = []) {
    const seen = new Set();
    return freeze(arrayValue(facts, 'R9V2_KERNEL_CAUSAL_FACTS_NOT_ARRAY').map(fact => {
      const sourceFactId = stringValue(fact.sourceFactId, 'R9V2_KERNEL_CAUSAL_SOURCE_FACT_MISSING');
      if (seen.has(sourceFactId)) fatal('DUPLICATE_CAUSAL_VALUE', `${candidateId}:${sourceFactId}`);
      seen.add(sourceFactId);
      const causalOwnerType = stringValue(fact.causalOwnerType, 'R9V2_KERNEL_CAUSAL_OWNER_MISSING');
      if (!OWNER_TYPES.has(causalOwnerType)) fatal('R9V2_KERNEL_UNKNOWN_CAUSAL_OWNER', causalOwnerType);
      return freeze({
        componentCode: stringValue(fact.componentCode || 'unassigned', 'R9V2_KERNEL_COMPONENT_CODE_MISSING'),
        causalOwnerType,
        valueHEPP: finite(fact.valueHEPP, 'R9V2_KERNEL_CAUSAL_VALUE_NON_FINITE', sourceFactId),
        sourceEventId: stringValue(fact.sourceEventId, 'R9V2_KERNEL_CAUSAL_EVENT_MISSING'),
        sourceFactId,
        targetUnitId: stringValue(fact.targetUnitId, 'R9V2_KERNEL_CAUSAL_TARGET_MISSING'),
        sequence: finite(fact.sequence ?? 0, 'R9V2_KERNEL_CAUSAL_SEQUENCE_NON_FINITE', sourceFactId),
      });
    }));
  }

  function normalizeCandidate(row) {
    const candidateId = stringValue(row.candidateId, 'R9V2_KERNEL_CANDIDATE_ID_MISSING');
    const stateDeltaTotal = finite(row.stateDeltaTotal ?? 0, 'R9V2_KERNEL_STATE_DELTA_NON_FINITE', candidateId);
    const actionPoolDeltaTotal = finite(row.actionPoolDeltaTotal ?? 0, 'R9V2_KERNEL_ACTION_POOL_DELTA_NON_FINITE', candidateId);
    const terminalDeltaTotal = finite(row.terminalDeltaTotal ?? 0, 'R9V2_KERNEL_TERMINAL_DELTA_NON_FINITE', candidateId);
    const causalFacts = normalizeCausalFacts(candidateId, row.causalFacts || []);
    const causalTotal = sum(causalFacts.map(fact => fact.valueHEPP));
    const goalUtilityDeltaHEPP = sum([stateDeltaTotal, actionPoolDeltaTotal, terminalDeltaTotal]);
    if (Math.abs(causalTotal - goalUtilityDeltaHEPP) > 1e-6) fatal('CAUSAL_RECONCILIATION_MISMATCH', candidateId);
    return freeze({
      ...clone(row),
      candidateId,
      actionId: stringValue(row.actionId, 'R9V2_KERNEL_ACTION_ID_MISSING'),
      actorId: stringValue(row.actorId, 'R9V2_KERNEL_ACTOR_ID_MISSING'),
      targetSet: arrayValue(row.targetSet || [], 'R9V2_KERNEL_TARGET_SET_NOT_ARRAY').map(String),
      paymentMode: stringValue(row.paymentMode || 'FULL', 'R9V2_KERNEL_PAYMENT_MODE_MISSING'),
      dependencyTokens: arrayValue(row.dependencyTokens || [], 'R9V2_KERNEL_DEPENDENCY_TOKENS_NOT_ARRAY').map(String),
      stateDeltaTotal,
      actionPoolDeltaTotal,
      terminalDeltaTotal,
      causalFacts,
      legal: row.legal !== false,
      hardExclusionCodes: arrayValue(row.hardExclusionCodes || [], 'R9V2_KERNEL_EXCLUSIONS_NOT_ARRAY').map(String),
      informationGroups: arrayValue(row.informationGroups || [], 'R9V2_KERNEL_INFORMATION_GROUPS_NOT_ARRAY'),
      discardedOverkillPP: finite(row.discardedOverkillPP ?? 0, 'R9V2_KERNEL_OVERKILL_NON_FINITE', candidateId),
      worstTailUtilityHEPP: finite(row.worstTailUtilityHEPP ?? 0, 'R9V2_KERNEL_TAIL_NON_FINITE', candidateId),
      survivalUtilityHEPP: finite(row.survivalUtilityHEPP ?? 0, 'R9V2_KERNEL_SURVIVAL_NON_FINITE', candidateId),
      assetReserveHEPP: finite(row.assetReserveHEPP ?? 0, 'R9V2_KERNEL_RESERVE_NON_FINITE', candidateId),
    });
  }

  function createDependencyOwners(candidates) {
    const owners = new Map();
    candidates.forEach(candidate => candidate.dependencyTokens.forEach(token => {
      if (!owners.has(token)) owners.set(token, new Set());
      owners.get(token).add(candidate.candidateId);
    }));
    return owners;
  }

  function createSession(input = {}) {
    if (!input || typeof input !== 'object') fatal('R9V2_KERNEL_SESSION_INPUT_INVALID');
    const rows = arrayValue(input.candidates, 'R9V2_KERNEL_CANDIDATES_NOT_ARRAY');
    if (!rows.length) fatal('R9V2_KERNEL_CANDIDATE_POOL_EMPTY');
    const ids = new Set();
    const candidates = rows.map(row => {
      const candidate = normalizeCandidate(row);
      if (ids.has(candidate.candidateId)) fatal('R9V2_KERNEL_DUPLICATE_CANDIDATE_ID', candidate.candidateId);
      ids.add(candidate.candidateId);
      return candidate;
    });
    const candidateIds = candidates.map(candidate => candidate.candidateId);
    const baseColumns = input.mechanicalColumns
      ? assertColumns(input.mechanicalColumns, candidateIds)
      : buildMechanicalColumns(candidates);
    const columns = freeze({
      ...clone(baseColumns),
      worldRevision: stringValue(input.worldRevision || '1', 'R9V2_KERNEL_WORLD_REVISION_MISSING'),
      opportunityRevision: stringValue(input.opportunityRevision || '1', 'R9V2_KERNEL_OPPORTUNITY_REVISION_MISSING'),
    });
    const observerId = stringValue(input.observerId || candidates[0].actorId, 'R9V2_KERNEL_OBSERVER_ID_MISSING');
    const overlay = normalizeBeliefOverlay({
      ...(input.beliefOverlay || {}),
      observerId,
      beliefRevision: input.beliefRevision || input.beliefOverlay?.beliefRevision || '1',
    });
    const session = {
      schemaVersion: SCHEMA_VERSION,
      kernelVersion: VERSION,
      worldRevision: stringValue(input.worldRevision || '1', 'R9V2_KERNEL_WORLD_REVISION_MISSING'),
      beliefRevision: overlay.beliefRevision,
      opportunityRevision: stringValue(input.opportunityRevision || '1', 'R9V2_KERNEL_OPPORTUNITY_REVISION_MISSING'),
      declarationCatalogs: new Map(),
      mechanicalBasisStore: new Map(),
      baselineBehaviorPools: new Map(),
      dependencyOwners: createDependencyOwners(candidates),
      targetSourceUnitIds: new Set(candidates.map(candidate => candidate.actorId)),
      factDeltas: [],
      proofComponentStore: new Map(),
      candidateIds: Object.freeze(candidateIds),
      candidates: Object.freeze(candidates),
      mechanicalColumns: columns,
      beliefOverlay: overlay,
      revision: 0,
      vectorStore: new Map(),
      metrics: {
        candidateCount: candidates.length,
        fullRebuilds: 0,
        dirtyCandidateRebuilds: 0,
        proofsMaterialized: 0,
      },
    };
    return session;
  }

  function informationValue(groups) {
    return Math.max(0, ...arrayValue(groups, 'R9V2_KERNEL_INFORMATION_GROUPS_NOT_ARRAY').map(group => {
      const outcomes = arrayValue(group.outcomes, 'R9V2_KERNEL_INFORMATION_OUTCOMES_NOT_ARRAY');
      const probabilityTotal = sum(outcomes.map(outcome => {
        const probability = finite(outcome.probability, 'R9V2_KERNEL_PROBABILITY_NON_FINITE');
        if (probability < 0 || probability > 1) fatal('R9V2_KERNEL_PROBABILITY_RANGE');
        return probability;
      }));
      if (Math.abs(probabilityTotal - 1) > 1e-12) fatal('R9V2_KERNEL_PROBABILITY_SUM_MISMATCH');
      const adaptive = sum(outcomes.map(outcome => finite(outcome.probability, 'R9V2_KERNEL_PROBABILITY_NON_FINITE') * finite(outcome.bestFutureRouteValueHEPP, 'R9V2_KERNEL_FUTURE_VALUE_NON_FINITE')));
      const committed = finite(group.committedValueHEPP ?? 0, 'R9V2_KERNEL_COMMITTED_VALUE_NON_FINITE');
      return Math.max(0, adaptive - committed);
    }));
  }

  function materializeVector(candidate) {
    const informationValueHEPP = informationValue(candidate.informationGroups);
    const goalUtilityDeltaHEPP = sum([
      candidate.stateDeltaTotal,
      candidate.actionPoolDeltaTotal,
      candidate.terminalDeltaTotal,
    ]);
    return freeze({
      schemaVersion: 'CandidateValueVectorV1',
      candidateId: candidate.candidateId,
      componentTotals: Object.freeze({
        stateDeltaTotal: candidate.stateDeltaTotal,
        actionPoolDeltaTotal: candidate.actionPoolDeltaTotal,
        terminalDeltaTotal: candidate.terminalDeltaTotal,
      }),
      stateDeltaTotal: candidate.stateDeltaTotal,
      actionPoolDeltaTotal: candidate.actionPoolDeltaTotal,
      terminalDeltaTotal: candidate.terminalDeltaTotal,
      goalUtilityDeltaHEPP,
      informationValueHEPP,
      objectiveUtilityHEPP: sum([goalUtilityDeltaHEPP, informationValueHEPP]),
      paretoDimensions: Object.freeze({
        objectiveUtilityHEPP: sum([goalUtilityDeltaHEPP, informationValueHEPP]),
        worstTailUtilityHEPP: candidate.worstTailUtilityHEPP,
        survivalUtilityHEPP: candidate.survivalUtilityHEPP,
        assetReserveHEPP: candidate.assetReserveHEPP,
        informationValueHEPP,
        discardedOverkillPP: candidate.discardedOverkillPP,
      }),
      hardExclusionCodes: Object.freeze([...candidate.hardExclusionCodes]),
      legal: candidate.legal,
      causalFacts: candidate.causalFacts,
      paretoWitness: null,
    });
  }

  function vectorDominates(left, right) {
    let strictlyBetter = false;
    for (const [field, direction] of PARETO_DIMENSIONS) {
      const leftValue = left.paretoDimensions[field];
      const rightValue = right.paretoDimensions[field];
      if (direction === 'MAXIMIZE') {
        if (leftValue < rightValue) return false;
        if (leftValue > rightValue) strictlyBetter = true;
      } else {
        if (leftValue > rightValue) return false;
        if (leftValue < rightValue) strictlyBetter = true;
      }
    }
    return strictlyBetter;
  }

  function paretoWitnessFor(vector, vectors) {
    if (vector.legal !== true || vector.hardExclusionCodes.length) {
      return freeze({
        kind: 'HARD_EXCLUDED',
        hardExclusionCodes: Object.freeze([...vector.hardExclusionCodes]),
      });
    }
    const eligible = vectors.filter(candidate => candidate.legal === true && candidate.hardExclusionCodes.length === 0);
    const dominator = eligible.find(candidate => candidate !== vector && vectorDominates(candidate, vector));
    return dominator
      ? freeze({ kind: 'DOMINATED', dominatorCandidateId: dominator.candidateId })
      : freeze({ kind: 'NON_DOMINATED' });
  }

  function evaluateAllCandidates(session, observerId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    if (stringValue(observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING') !== session.beliefOverlay.observerId) fatal('R9V2_KERNEL_OBSERVER_MISMATCH');
    const vectors = session.candidates.map(candidate => {
      const vector = materializeVector(candidate);
      session.vectorStore.set(candidate.candidateId, vector);
      return vector;
    });
    const decorated = vectors.map(vector => freeze({
      ...vector,
      paretoWitness: paretoWitnessFor(vector, vectors),
    }));
    decorated.forEach(vector => session.vectorStore.set(vector.candidateId, vector));
    return Object.freeze(decorated);
  }

  function applyFactDelta(session, expectedRevision, delta = {}) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    if (Number(expectedRevision) !== session.revision) fatal('R9V2_KERNEL_REVISION_MISMATCH');
    if (!OPERATIONS.has(delta.operation)) fatal('R9V2_KERNEL_FACT_DELTA_OPERATION_UNKNOWN', delta.operation);
    const dependencyTokens = arrayValue(delta.dependencyTokens || [], 'R9V2_KERNEL_FACT_DELTA_DEPENDENCIES_NOT_ARRAY').map(String);
    const unknownDependency = dependencyTokens.some(token => !session.dependencyOwners.has(token));
    const dirtyCandidateIds = new Set();
    dependencyTokens.forEach(token => session.dependencyOwners.get(token)?.forEach(candidateId => dirtyCandidateIds.add(candidateId)));
    const fullRebuildRequired = unknownDependency || dependencyTokens.length === 0;
    if (fullRebuildRequired) session.candidates.forEach(candidate => dirtyCandidateIds.add(candidate.candidateId));
    session.revision += 1;
    session.factDeltas.push(freeze({
      schemaVersion: 'FactDeltaV1',
      baseRevision: expectedRevision,
      operation: delta.operation,
      entityType: stringValue(delta.entityType, 'R9V2_KERNEL_FACT_DELTA_ENTITY_TYPE_MISSING'),
      entityId: stringValue(delta.entityId, 'R9V2_KERNEL_FACT_DELTA_ENTITY_ID_MISSING'),
      fieldCode: stringValue(delta.fieldCode, 'R9V2_KERNEL_FACT_DELTA_FIELD_MISSING'),
      beforeValue: clone(delta.beforeValue),
      afterValue: clone(delta.afterValue),
      sourceEventId: stringValue(delta.sourceEventId, 'R9V2_KERNEL_FACT_DELTA_EVENT_MISSING'),
      sourceFactId: stringValue(delta.sourceFactId, 'R9V2_KERNEL_FACT_DELTA_FACT_MISSING'),
      dependencyTokens,
    }));
    for (const candidateId of dirtyCandidateIds) session.vectorStore.delete(candidateId);
    session.metrics.dirtyCandidateRebuilds += dirtyCandidateIds.size;
    if (fullRebuildRequired) session.metrics.fullRebuilds += 1;
    return Object.freeze({
      revision: session.revision,
      dirtyCandidateIds: Object.freeze([...dirtyCandidateIds]),
      invalidatedComponentCodes: Object.freeze(['ALL_VALUE_COMPONENTS']),
      fullRebuildRequired,
    });
  }

  function materializeProof(session, candidateId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    const id = stringValue(candidateId, 'R9V2_KERNEL_PROOF_CANDIDATE_ID_MISSING');
    const candidate = session.candidates.find(row => row.candidateId === id);
    if (!candidate) fatal('R9V2_KERNEL_PROOF_CANDIDATE_MISSING', id);
    const vector = session.vectorStore.get(id) || materializeVector(candidate);
    session.vectorStore.set(id, vector);
    session.metrics.proofsMaterialized += 1;
    return freeze({
      schemaVersion: 'CandidateValueProofV1',
      candidateId: id,
      vector,
      goalUtilityDeltaHEPP: vector.goalUtilityDeltaHEPP,
      informationValueHEPP: vector.informationValueHEPP,
      objectiveUtilityHEPP: vector.objectiveUtilityHEPP,
      causalValueFacts: vector.causalFacts,
      source: Object.freeze({
        worldRevision: session.worldRevision,
        beliefRevision: session.beliefRevision,
        opportunityRevision: session.opportunityRevision,
        sessionRevision: session.revision,
      }),
    });
  }

  const api = Object.freeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    operations: Object.freeze([...OPERATIONS]),
    paretoDimensions: PARETO_DIMENSIONS,
    createSession,
    evaluateAllCandidates,
    applyFactDelta,
    materializeProof,
  });
  if (root.__LWCS_BATTLE_R9V2_KERNEL__) fatal('R9V2_KERNEL_DUPLICATE_LOAD');
  root.__LWCS_BATTLE_R9V2_KERNEL__ = api;
})();

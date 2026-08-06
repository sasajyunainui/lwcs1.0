/* BattleDecisionR9v2Kernel_Module.js - isolated R9v2 value-kernel contract. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const VERSION = '9v2-kernel-1.3.0';
  const SCHEMA_VERSION = 'ValueKernelSessionV1';
  const RAW_CALCULATION_MODE = 'COMPONENT_REGISTRY_V1';
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
  const RAW_FORBIDDEN_FIELDS = new Set([
    'stateDeltaTotal',
    'actionPoolDeltaTotal',
    'terminalDeltaTotal',
    'goalUtilityDeltaHEPP',
    'informationValueHEPP',
    'objectiveUtilityHEPP',
    'causalFacts',
    'informationGroups',
    'discardedOverkillPP',
    'worstTailUtilityHEPP',
    'survivalUtilityHEPP',
    'assetReserveHEPP',
    'directGoalUtilityHEPP',
    'bestFutureRouteValueHEPP',
    'committedValueHEPP',
    'actionPoolDeltaHEPP',
    'routeDeltaHEPP',
    'objectiveDeltaHEPP',
    'terminalDeltaHEPP',
    'terminalValueHEPP',
    'valueHEPP',
    'causalOwnerType',
    'ownerType',
    'directGoalUtility',
    'assetReserve',
  ]);
  const PARETO_COMPONENT_CODES = new Set([
    'worstTailUtilityHEPP',
    'survivalUtilityHEPP',
    'assetReserveHEPP',
    'discardedOverkillPP',
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

  function normalizeComponentDefinitions(registry) {
    const definitions = Array.isArray(registry?.componentDefinitions)
      ? registry.componentDefinitions
      : [];
    if (!definitions.length) {
      fatal('R9V2_KERNEL_COMPONENT_DEFINITIONS_INCOMPLETE');
    }
    const seen = new Set();
    const normalized = definitions.map(definition => {
      const componentCode = stringValue(
        definition?.componentCode,
        'R9V2_KERNEL_COMPONENT_CODE_MISSING',
      );
      if (seen.has(componentCode)) {
        fatal('R9V2_KERNEL_COMPONENT_CODE_DUPLICATE', componentCode);
      }
      seen.add(componentCode);
      const requires = arrayValue(
        definition?.requires || [],
        'R9V2_KERNEL_COMPONENT_REQUIRES_NOT_ARRAY',
      ).map(value => String(value || '').trim()).filter(Boolean);
      const causalOwnerType = stringValue(
        definition?.causalOwnerType || 'NONE',
        'R9V2_KERNEL_COMPONENT_OWNER_MISSING',
      );
      if (!OWNER_TYPES.has(causalOwnerType)) {
        fatal('R9V2_KERNEL_COMPONENT_OWNER_UNKNOWN', componentCode);
      }
      return freeze({
        componentCode,
        semanticDomain: stringValue(
          definition?.semanticDomain,
          'R9V2_KERNEL_COMPONENT_DOMAIN_MISSING',
        ),
        causalOwnerType,
        inputColumnCodes: Object.freeze(
          arrayValue(
            definition?.inputColumnCodes || [],
            'R9V2_KERNEL_COMPONENT_INPUT_COLUMNS_NOT_ARRAY',
          ).map(value => String(value || '').trim()).filter(Boolean),
        ),
        dependencyKinds: Object.freeze(
          arrayValue(
            definition?.dependencyKinds || [],
            'R9V2_KERNEL_COMPONENT_DEPENDENCIES_NOT_ARRAY',
          ).map(value => String(value || '').trim()).filter(Boolean),
        ),
        contributesToGoal: definition?.contributesToGoal === true,
        contributesToPareto: definition?.contributesToPareto === true,
        materializerId: String(definition?.materializerId || '').trim(),
        requires: Object.freeze([...new Set(requires)]),
      });
    });
    normalized.forEach(definition => {
      if (definition.requires.some(code => !seen.has(code))) {
        fatal(
          'R9V2_KERNEL_COMPONENT_REQUIREMENT_UNKNOWN',
          definition.componentCode,
        );
      }
    });
    return Object.freeze(normalized);
  }

  function expandComponentCodes(session, requestedCodes) {
    const expanded = new Set();
    const definitions = new Map(
      session.componentDefinitions.map(definition => [
        definition.componentCode,
        definition,
      ]),
    );
    const visit = code => {
      if (expanded.has(code)) return;
      const definition = definitions.get(code);
      if (!definition) fatal('R9V2_KERNEL_COMPONENT_CODE_UNKNOWN', code);
      expanded.add(code);
      definition.requires.forEach(visit);
    };
    requestedCodes.forEach(visit);
    return Object.freeze(
      session.componentCodes.filter(code => expanded.has(code)),
    );
  }

  function assertRawInputValueFree(value, path = 'rawInput') {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child, index) =>
        assertRawInputValueFree(child, `${path}[${index}]`),
      );
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      if (RAW_FORBIDDEN_FIELDS.has(key)) {
        fatal('R9V2_KERNEL_RAW_COMPUTED_FIELD_INPUT', `${path}.${key}`);
      }
      assertRawInputValueFree(child, `${path}.${key}`);
    });
  }

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

  function compareCausalFacts(left, right) {
    for (const field of [
      'componentCode',
      'causalOwnerType',
      'sourceEventId',
      'sourceFactId',
      'targetUnitId',
    ]) {
      const leftValue = String(left?.[field] || '');
      const rightValue = String(right?.[field] || '');
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
    }
    return Number(left?.sequence || 0) - Number(right?.sequence || 0);
  }

  function normalizeCausalFacts(candidateId, facts = []) {
    const seen = new Set();
    const normalizedFacts = arrayValue(facts, 'R9V2_KERNEL_CAUSAL_FACTS_NOT_ARRAY').map(fact => {
      const sourceFactId = stringValue(fact.sourceFactId, 'R9V2_KERNEL_CAUSAL_SOURCE_FACT_MISSING');
      if (seen.has(sourceFactId)) fatal('DUPLICATE_CAUSAL_VALUE', `${candidateId}:${sourceFactId}`);
      seen.add(sourceFactId);
      const causalOwnerType = stringValue(fact.causalOwnerType, 'R9V2_KERNEL_CAUSAL_OWNER_MISSING');
      if (!OWNER_TYPES.has(causalOwnerType)) fatal('R9V2_KERNEL_UNKNOWN_CAUSAL_OWNER', causalOwnerType);
      const normalized = {
        ...clone(fact),
        componentCode: stringValue(fact.componentCode || 'unassigned', 'R9V2_KERNEL_COMPONENT_CODE_MISSING'),
        causalOwnerType,
        valueHEPP: finite(fact.valueHEPP, 'R9V2_KERNEL_CAUSAL_VALUE_NON_FINITE', sourceFactId),
        sourceEventId: stringValue(fact.sourceEventId, 'R9V2_KERNEL_CAUSAL_EVENT_MISSING'),
        sourceFactId,
        targetUnitId: stringValue(fact.targetUnitId, 'R9V2_KERNEL_CAUSAL_TARGET_MISSING'),
        sequence: finite(fact.sequence ?? 0, 'R9V2_KERNEL_CAUSAL_SEQUENCE_NON_FINITE', sourceFactId),
      };
      if (Object.hasOwn(fact, 'sourceOutcomeKind')) {
        normalized.sourceOutcomeKind = stringValue(
          fact.sourceOutcomeKind,
          'R9V2_KERNEL_CAUSAL_OUTCOME_KIND_MISSING',
        );
      }
      for (const key of ['sourceActorId', 'sourceActionId', 'effectInstanceId']) {
        if (Object.hasOwn(fact, key)) {
          normalized[key] = stringValue(
            fact[key],
            `R9V2_KERNEL_CAUSAL_${key.toUpperCase()}_MISSING`,
          );
        }
      }
      for (const key of [
        'sourceActorIds',
        'sourceDescriptorIds',
        'terminalAfterEffectInstanceIds',
        'terminalAtomicKeys',
        'candidateTerminalAfterEffectInstanceIds',
        'candidateTerminalAtomicKeys',
      ]) {
        if (Object.hasOwn(fact, key)) {
          if (!Array.isArray(fact[key])) {
            fatal('R9V2_KERNEL_CAUSAL_METADATA_NOT_ARRAY', `${candidateId}:${key}`);
          }
          normalized[key] = Object.freeze(
            fact[key].map(value => String(value ?? '').trim()).filter(Boolean),
          );
        }
      }
      if (Object.hasOwn(fact, 'terminalProbability')) {
        normalized.terminalProbability = finite(
          fact.terminalProbability,
          'R9V2_KERNEL_CAUSAL_TERMINAL_PROBABILITY_NON_FINITE',
          sourceFactId,
        );
      }
      for (const key of [
        'terminalAfterEffectInstanceId',
        'terminalEventId',
        'terminalAtomicKey',
        'candidateTerminalAfterEffectInstanceId',
        'candidateTerminalAtomicKey',
      ]) {
        if (Object.hasOwn(fact, key)) {
          normalized[key] = String(fact[key] ?? '').trim();
        }
      }
      for (const key of ['terminalPaths', 'candidateTerminalPaths']) {
        if (Object.hasOwn(fact, key)) {
          if (!Array.isArray(fact[key])) {
            fatal('R9V2_KERNEL_CAUSAL_METADATA_NOT_ARRAY', `${candidateId}:${key}`);
          }
          normalized[key] = clone(fact[key]);
        }
      }
      return freeze(normalized);
    }).sort(compareCausalFacts);
    return freeze(normalizedFacts);
  }

  function normalizeCandidate(row, { rawMode = false } = {}) {
    const candidateId = stringValue(row.candidateId, 'R9V2_KERNEL_CANDIDATE_ID_MISSING');
    if (rawMode) {
      const forbiddenComputedFields = [
        'stateDeltaTotal',
        'actionPoolDeltaTotal',
        'terminalDeltaTotal',
        'goalUtilityDeltaHEPP',
        'informationValueHEPP',
        'objectiveUtilityHEPP',
        'causalFacts',
        'informationGroups',
        'discardedOverkillPP',
        'worstTailUtilityHEPP',
        'survivalUtilityHEPP',
        'assetReserveHEPP',
      ];
      const leakedField = forbiddenComputedFields.find(field =>
        Object.hasOwn(row, field),
      );
      if (leakedField) {
        fatal('R9V2_KERNEL_PRECOMPUTED_VALUE_INPUT', `${candidateId}:${leakedField}`);
      }
      if (!row.rawInput || typeof row.rawInput !== 'object') {
        fatal('R9V2_KERNEL_RAW_INPUT_MISSING', candidateId);
      }
      assertRawInputValueFree(row.rawInput, `${candidateId}:rawInput`);
      return freeze({
        ...clone(row),
        candidateId,
        actionId: stringValue(row.actionId, 'R9V2_KERNEL_ACTION_ID_MISSING'),
        actorId: stringValue(row.actorId, 'R9V2_KERNEL_ACTOR_ID_MISSING'),
        targetSet: arrayValue(row.targetSet || [], 'R9V2_KERNEL_TARGET_SET_NOT_ARRAY').map(String),
        paymentMode: stringValue(row.paymentMode || 'FULL', 'R9V2_KERNEL_PAYMENT_MODE_MISSING'),
        dependencyTokens: arrayValue(row.dependencyTokens || [], 'R9V2_KERNEL_DEPENDENCY_TOKENS_NOT_ARRAY').map(String),
        legal: row.legal !== false,
        hardExclusionCodes: arrayValue(row.hardExclusionCodes || [], 'R9V2_KERNEL_EXCLUSIONS_NOT_ARRAY').map(String),
        rawInput: row.rawInput,
      });
    }
    const causalFacts = normalizeCausalFacts(candidateId, row.causalFacts || []);
    const derivedTotals = {
      state: sum(causalFacts
        .filter(fact => fact.causalOwnerType === 'STATE_DELTA')
        .map(fact => fact.valueHEPP)),
      actionPool: sum(causalFacts
        .filter(fact => fact.causalOwnerType === 'ACTION_POOL_DELTA')
        .map(fact => fact.valueHEPP)),
      terminal: sum(causalFacts
        .filter(fact => fact.causalOwnerType === 'TERMINAL_DELTA')
        .map(fact => fact.valueHEPP)),
    };
    const suppliedTotals = {
      state: finite(row.stateDeltaTotal ?? 0, 'R9V2_KERNEL_STATE_DELTA_NON_FINITE', candidateId),
      actionPool: finite(row.actionPoolDeltaTotal ?? 0, 'R9V2_KERNEL_ACTION_POOL_DELTA_NON_FINITE', candidateId),
      terminal: finite(row.terminalDeltaTotal ?? 0, 'R9V2_KERNEL_TERMINAL_DELTA_NON_FINITE', candidateId),
    };
    for (const [ownerType, key] of [
      ['STATE_DELTA', 'state'],
      ['ACTION_POOL_DELTA', 'actionPool'],
      ['TERMINAL_DELTA', 'terminal'],
    ]) {
      if (Math.abs(derivedTotals[key] - suppliedTotals[key]) > 1e-9) {
        fatal('R9V2_KERNEL_CAUSAL_OWNER_TOTAL_MISMATCH', `${candidateId}:${ownerType}`);
      }
    }
    const stateDeltaTotal = derivedTotals.state;
    const actionPoolDeltaTotal = derivedTotals.actionPool;
    const terminalDeltaTotal = derivedTotals.terminal;
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
      valueSource: String(row.valueSource || 'SCALAR_INPUT').trim(),
      mechanicalSource: String(row.mechanicalSource || 'UNKNOWN').trim(),
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
    const calculationMode = String(input.calculationMode || 'SCALAR_INPUT').trim();
    const rawMode = calculationMode === RAW_CALCULATION_MODE;
    const componentRegistry = input.componentRegistry;
    if (rawMode && (!componentRegistry || typeof componentRegistry.evaluateComponents !== 'function')) {
      fatal('R9V2_KERNEL_COMPONENT_REGISTRY_MISSING');
    }
    if (rawMode && typeof componentRegistry.componentCodesForFactDelta !== 'function') {
      fatal('R9V2_KERNEL_COMPONENT_INVALIDATION_RESOLVER_MISSING');
    }
    const componentDefinitions = rawMode
      ? normalizeComponentDefinitions(componentRegistry)
      : Object.freeze([]);
    const ids = new Set();
    const candidates = rows.map(row => {
      const candidate = normalizeCandidate(row, { rawMode });
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
      calculationMode,
      rawMode,
      componentRegistry,
      componentDefinitions,
      componentCodes: Object.freeze(
        componentDefinitions.map(definition => definition.componentCode),
      ),
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
      futureRoutePoolStore: new Map(),
      candidateIds: Object.freeze(candidateIds),
      candidates: Object.freeze(candidates),
      mechanicalColumns: columns,
      beliefOverlay: overlay,
      revision: 0,
      vectorStore: new Map(),
      computedCandidateStore: new Map(),
      componentStore: new Map(),
      invalidatedComponentsByCandidate: new Map(),
      metrics: {
        candidateCount: candidates.length,
        fullRebuilds: 0,
        dirtyCandidateRebuilds: 0,
        candidateEvaluations: 0,
        candidateCacheHits: 0,
        vectorMaterializations: 0,
        vectorCacheHits: 0,
        paretoReassemblies: 0,
        proofsMaterialized: 0,
        factDeltaApplications: 0,
        candidateSnapshotDeltas: 0,
        contextInvalidations: 0,
        componentEvaluations: 0,
        componentCacheHits: 0,
        componentInvalidations: 0,
      },
      baseVectorStore: new Map(),
      lastEvaluatedVectors: null,
      paretoDirty: true,
    };
    return session;
  }

  function informationValue(groups) {
    const routeValue = facts => sum(arrayValue(
      facts || [],
      'R9V2_KERNEL_INFORMATION_ROUTE_FACTS_NOT_ARRAY',
    ).map(fact => {
      const formula = stringValue(
        fact?.formula,
        'R9V2_KERNEL_INFORMATION_ROUTE_FORMULA_MISSING',
      );
      if (formula === 'CONSTANT_HEPP') {
        return finite(
          fact?.amountHEPP,
          'R9V2_KERNEL_INFORMATION_ROUTE_VALUE_NON_FINITE',
        );
      }
      if (formula === 'ROUTE_DELTA') {
        const before = finite(
          fact?.beforeRouteHEPP,
          'R9V2_KERNEL_INFORMATION_ROUTE_BEFORE_NON_FINITE',
        );
        const after = finite(
          fact?.afterRouteHEPP,
          'R9V2_KERNEL_INFORMATION_ROUTE_AFTER_NON_FINITE',
        );
        const probability = finite(
          fact?.applicationProbability ?? 1,
          'R9V2_KERNEL_INFORMATION_ROUTE_PROBABILITY_NON_FINITE',
        );
        if (probability < 0 || probability > 1) {
          fatal('R9V2_KERNEL_INFORMATION_ROUTE_PROBABILITY_RANGE');
        }
        return (after - before) * probability * finite(
          fact?.polarity ?? 1,
          'R9V2_KERNEL_INFORMATION_ROUTE_POLARITY_NON_FINITE',
        );
      }
      fatal('R9V2_KERNEL_INFORMATION_ROUTE_FORMULA_UNSUPPORTED', formula);
    }));
    const routeTableForOutcome = (outcome, groupId) => {
      if (!Object.hasOwn(outcome, 'futureCandidateRouteVector')) return null;
      const vector = outcome.futureCandidateRouteVector;
      const candidateIds = arrayValue(
        vector?.candidateIds,
        'R9V2_KERNEL_INFORMATION_FUTURE_CANDIDATE_IDS_NOT_ARRAY',
      );
      const beforeRouteHEPP = arrayValue(
        vector?.beforeRouteHEPP,
        'R9V2_KERNEL_INFORMATION_FUTURE_BEFORE_VALUES_NOT_ARRAY',
      );
      const afterRouteHEPP = arrayValue(
        vector?.afterRouteHEPP,
        'R9V2_KERNEL_INFORMATION_FUTURE_AFTER_VALUES_NOT_ARRAY',
      );
      const applicationProbability = arrayValue(
        vector?.applicationProbability,
        'R9V2_KERNEL_INFORMATION_FUTURE_PROBABILITIES_NOT_ARRAY',
      );
      const polarity = arrayValue(
        vector?.polarity,
        'R9V2_KERNEL_INFORMATION_FUTURE_POLARITIES_NOT_ARRAY',
      );
      const vectorLength = candidateIds.length;
      if (
        [
          beforeRouteHEPP,
          afterRouteHEPP,
          applicationProbability,
          polarity,
        ].some(column => column.length !== vectorLength)
      ) {
        fatal(
          'R9V2_KERNEL_INFORMATION_FUTURE_VECTOR_LENGTH_MISMATCH',
          groupId,
        );
      }
      const table = new Map();
      candidateIds.forEach((candidateIdValue, index) => {
        const candidateId = stringValue(
          candidateIdValue,
          'R9V2_KERNEL_INFORMATION_FUTURE_CANDIDATE_ID_MISSING',
        );
        if (table.has(candidateId)) {
          fatal(
            'R9V2_KERNEL_INFORMATION_FUTURE_CANDIDATE_DUPLICATE',
            `${groupId}:${candidateId}`,
          );
        }
        const probability = finite(
          applicationProbability[index],
          'R9V2_KERNEL_INFORMATION_FUTURE_PROBABILITY_NON_FINITE',
          `${groupId}:${index}`,
        );
        if (probability < 0 || probability > 1) {
          fatal(
            'R9V2_KERNEL_INFORMATION_FUTURE_PROBABILITY_RANGE',
            `${groupId}:${index}`,
          );
        }
        table.set(candidateId, (
          finite(
            afterRouteHEPP[index],
            'R9V2_KERNEL_INFORMATION_FUTURE_AFTER_NON_FINITE',
            `${groupId}:${index}`,
          ) - finite(
            beforeRouteHEPP[index],
            'R9V2_KERNEL_INFORMATION_FUTURE_BEFORE_NON_FINITE',
            `${groupId}:${index}`,
          )
        ) * probability * finite(
          polarity[index],
          'R9V2_KERNEL_INFORMATION_FUTURE_POLARITY_NON_FINITE',
          `${groupId}:${index}`,
        ));
      });
      return table;
    };
    const routeValueForOutcome = (outcome, groupId) => {
      if (Object.hasOwn(outcome, 'futureCandidateRouteVector')) {
        return Math.max(...routeTableForOutcome(outcome, groupId).values());
      }
      return Array.isArray(outcome?.bestFutureRouteFacts)
        ? routeValue(outcome.bestFutureRouteFacts)
        : finite(
          outcome?.bestFutureRouteValueHEPP,
          'R9V2_KERNEL_FUTURE_VALUE_NON_FINITE',
        );
    };
    return Math.max(0, ...arrayValue(
      groups,
      'R9V2_KERNEL_INFORMATION_GROUPS_NOT_ARRAY',
    ).map(group => {
      const groupId = String(group?.groupId || '').trim();
      const outcomes = arrayValue(
        group.outcomes,
        'R9V2_KERNEL_INFORMATION_OUTCOMES_NOT_ARRAY',
      );
      if (!outcomes.length) fatal('R9V2_KERNEL_INFORMATION_OUTCOMES_EMPTY', groupId);
      const probabilities = outcomes.map(outcome => {
        const probability = finite(
          outcome.probability,
          'R9V2_KERNEL_PROBABILITY_NON_FINITE',
        );
        if (probability < 0 || probability > 1) {
          fatal('R9V2_KERNEL_PROBABILITY_RANGE');
        }
        return probability;
      });
      if (Math.abs(sum(probabilities) - 1) > 1e-12) {
        fatal('R9V2_KERNEL_PROBABILITY_SUM_MISMATCH');
      }
      const routeTables = outcomes.map(outcome =>
        routeTableForOutcome(outcome, groupId),
      );
      const hasRouteTable = routeTables.some(Boolean);
      if (hasRouteTable && routeTables.some(table => !table)) {
        fatal('R9V2_KERNEL_INFORMATION_FUTURE_ROUTES_INCOMPLETE', groupId);
      }
      if (hasRouteTable) {
        const adaptive = sum(routeTables.map((table, index) =>
          probabilities[index] * Math.max(0, ...table.values()),
        ));
        const deterministic = probabilities.every(
          probability => probability === 0 || probability === 1,
        );
        if (deterministic) return 0;
        const commonCandidateIds = [...routeTables[0].keys()]
          .filter(candidateId => routeTables.every(table =>
            table.has(candidateId),
          ));
        const committed = Math.max(
          0,
          ...commonCandidateIds.map(candidateId =>
            sum(routeTables.map((table, index) =>
              probabilities[index] * table.get(candidateId),
            )),
          ),
        );
        return Math.max(0, adaptive - committed);
      }
      if (probabilities.every(
        probability => probability === 0 || probability === 1,
      )) return 0;
      const adaptive = sum(outcomes.map((outcome, index) =>
        probabilities[index] * routeValueForOutcome(outcome, groupId),
      ));
      const committed = Array.isArray(group.committedRouteFacts)
        ? routeValue(group.committedRouteFacts)
        : finite(
          group.committedValueHEPP ?? 0,
          'R9V2_KERNEL_COMMITTED_VALUE_NON_FINITE',
        );
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
      valueSource: candidate.valueSource,
      mechanicalSource: candidate.mechanicalSource,
      componentTotals: Object.freeze({
        stateDeltaTotal: candidate.stateDeltaTotal,
        actionPoolDeltaTotal: candidate.actionPoolDeltaTotal,
        terminalDeltaTotal: candidate.terminalDeltaTotal,
        worstTailUtilityHEPP: candidate.worstTailUtilityHEPP,
        survivalUtilityHEPP: candidate.survivalUtilityHEPP,
        assetReserveHEPP: candidate.assetReserveHEPP,
        discardedOverkillPP: candidate.discardedOverkillPP,
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

  function normalizeRawComponentResult(candidateId, result) {
    const forbiddenComputedFields = [
      'stateDeltaTotal',
      'actionPoolDeltaTotal',
      'terminalDeltaTotal',
      'goalUtilityDeltaHEPP',
      'informationValueHEPP',
      'objectiveUtilityHEPP',
      'causalFacts',
      'informationGroups',
      'discardedOverkillPP',
      'worstTailUtilityHEPP',
      'survivalUtilityHEPP',
      'assetReserveHEPP',
    ];
    const leakedField = forbiddenComputedFields.find(field =>
      Object.hasOwn(result, field),
    );
    if (leakedField) {
      fatal(
        'R9V2_KERNEL_COMPONENT_PRECOMPUTED_RESULT',
        `${candidateId}:${leakedField}`,
      );
    }
    const componentFacts = normalizeCausalFacts(
      candidateId,
      arrayValue(
        result.componentFacts,
        'R9V2_KERNEL_COMPONENT_FACTS_NOT_ARRAY',
      ),
    );
    if (componentFacts.some(fact =>
      fact.causalOwnerType === 'NONE' && Math.abs(fact.valueHEPP) > 1e-9,
    )) {
      fatal('R9V2_KERNEL_NONE_OWNER_NONZERO', candidateId);
    }
    const informationComponents = arrayValue(
      result.informationComponents || [],
      'R9V2_KERNEL_INFORMATION_COMPONENTS_NOT_ARRAY',
    );
    assertRawInputValueFree(
      informationComponents,
      `${candidateId}:informationComponents`,
    );
    const paretoComponents = arrayValue(
      result.paretoComponents || [],
      'R9V2_KERNEL_PARETO_COMPONENTS_NOT_ARRAY',
    );
    const paretoValues = {};
    paretoComponents.forEach(component => {
      const code = stringValue(
        component?.dimensionCode,
        'R9V2_KERNEL_PARETO_COMPONENT_CODE_MISSING',
      );
      if (!PARETO_COMPONENT_CODES.has(code)) {
        fatal('R9V2_KERNEL_PARETO_COMPONENT_UNKNOWN', `${candidateId}:${code}`);
      }
      if (Object.hasOwn(paretoValues, code)) {
        fatal('R9V2_KERNEL_PARETO_COMPONENT_DUPLICATE', `${candidateId}:${code}`);
      }
      paretoValues[code] = finite(
        component?.value,
        'R9V2_KERNEL_PARETO_COMPONENT_NON_FINITE',
        `${candidateId}:${code}`,
      );
    });
    for (const code of PARETO_COMPONENT_CODES) {
      if (!Object.hasOwn(paretoValues, code)) {
        fatal('R9V2_KERNEL_PARETO_COMPONENT_MISSING', `${candidateId}:${code}`);
      }
    }
    const totals = {
      state: sum(componentFacts
        .filter(fact => fact.causalOwnerType === 'STATE_DELTA')
        .map(fact => fact.valueHEPP)),
      actionPool: sum(componentFacts
        .filter(fact => fact.causalOwnerType === 'ACTION_POOL_DELTA')
        .map(fact => fact.valueHEPP)),
      terminal: sum(componentFacts
        .filter(fact => fact.causalOwnerType === 'TERMINAL_DELTA')
        .map(fact => fact.valueHEPP)),
    };
    return {
      ...result,
      causalFacts: componentFacts,
      informationGroups: clone(informationComponents),
      stateDeltaTotal: totals.state,
      actionPoolDeltaTotal: totals.actionPool,
      terminalDeltaTotal: totals.terminal,
      discardedOverkillPP: paretoValues.discardedOverkillPP,
      worstTailUtilityHEPP: paretoValues.worstTailUtilityHEPP,
      survivalUtilityHEPP: paretoValues.survivalUtilityHEPP,
      assetReserveHEPP: paretoValues.assetReserveHEPP,
    };
  }

  function normalizeComponentResult(candidateId, definition, result) {
    const componentCode = definition.componentCode;
    if (!result || typeof result !== 'object') {
      fatal('R9V2_KERNEL_COMPONENT_RESULT_INVALID', `${candidateId}:${componentCode}`);
    }
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
      Object.hasOwn(result, field),
    );
    if (leakedField) {
      fatal(
        'R9V2_KERNEL_COMPONENT_PRECOMPUTED_RESULT',
        `${candidateId}:${componentCode}:${leakedField}`,
      );
    }
    const facts = arrayValue(
      result.facts || [],
      'R9V2_KERNEL_COMPONENT_FACTS_NOT_ARRAY',
    );
    const informationComponents = arrayValue(
      result.informationComponents || [],
      'R9V2_KERNEL_COMPONENT_INFORMATION_NOT_ARRAY',
    );
    const paretoComponents = arrayValue(
      result.paretoComponents || [],
      'R9V2_KERNEL_COMPONENT_PARETO_NOT_ARRAY',
    );
    const normalizedFacts = normalizeCausalFacts(candidateId, facts);
    normalizedFacts.forEach(fact => {
      if (fact.componentCode !== componentCode) {
        fatal(
          'R9V2_KERNEL_FACT_COMPONENT_MISMATCH',
          `${candidateId}:${componentCode}:${fact.componentCode}`,
        );
      }
      if (fact.causalOwnerType !== definition.causalOwnerType) {
        fatal(
          'R9V2_KERNEL_FACT_OWNER_MISMATCH',
          `${candidateId}:${componentCode}:${definition.causalOwnerType}:${fact.causalOwnerType}`,
        );
      }
    });
    return freeze({
      ...clone(result),
      componentCode,
      facts: freeze(normalizedFacts),
      informationComponents: clone(informationComponents),
      paretoComponents: clone(paretoComponents),
      unsupportedOutcomeKinds: Object.freeze(
        arrayValue(
          result.unsupportedOutcomeKinds || [],
          'R9V2_KERNEL_COMPONENT_UNSUPPORTED_NOT_ARRAY',
        ).map(String),
      ),
    });
  }

  function assembleComponentResults(session, candidateId, componentStore) {
    const componentFacts = [];
    const informationComponents = [];
    const paretoComponents = [];
    const unsupportedOutcomeKinds = new Set();
    for (const componentCode of session.componentCodes) {
      const component = componentStore.get(componentCode);
      if (!component) {
        fatal(
          'R9V2_KERNEL_COMPONENT_RESULT_MISSING',
          `${candidateId}:${componentCode}`,
        );
      }
      componentFacts.push(...component.facts);
      informationComponents.push(...component.informationComponents);
      paretoComponents.push(...component.paretoComponents);
      component.unsupportedOutcomeKinds.forEach(kind =>
        unsupportedOutcomeKinds.add(kind),
      );
    }
    return {
      componentFacts,
      informationComponents,
      paretoComponents,
      unsupportedOutcomeKinds: [...unsupportedOutcomeKinds],
    };
  }

  function evaluateComponentCandidate(session, candidate) {
    if (!session.rawMode) return candidate;
    const candidateId = candidate.candidateId;
    const componentStore = session.componentStore.get(candidateId) || new Map();
    const invalidated = session.invalidatedComponentsByCandidate.get(candidateId);
    const requested = invalidated && invalidated.size
      ? [...invalidated]
      : session.componentCodes.filter(code => !componentStore.has(code));
    const componentCodes = expandComponentCodes(session, requested.length
      ? requested
      : session.componentCodes);
    const result = session.componentRegistry.evaluateComponents({
      candidate,
      session,
      factDeltas: Object.freeze(session.factDeltas.slice()),
      componentCodes,
    });
    if (!result || typeof result !== 'object' || !result.components) {
      fatal('R9V2_KERNEL_COMPONENT_RESULT_INVALID', candidateId);
    }
    const returnedComponents = result.components;
    for (const componentCode of componentCodes) {
      const componentResult = returnedComponents[componentCode];
      if (!componentResult) {
        fatal(
          'R9V2_KERNEL_COMPONENT_RESULT_MISSING',
          `${candidateId}:${componentCode}`,
        );
      }
      componentStore.set(
        componentCode,
        normalizeComponentResult(
          candidateId,
          session.componentDefinitions.find(definition =>
            definition.componentCode === componentCode
          ),
          componentResult,
        ),
      );
    }
    session.componentStore.set(candidateId, componentStore);
    session.invalidatedComponentsByCandidate.delete(candidateId);
    session.metrics.componentEvaluations += componentCodes.length;
    const assembled = assembleComponentResults(session, candidateId, componentStore);
    if (assembled.unsupportedOutcomeKinds.length) {
      fatal(
        'R9V2_KERNEL_UNSUPPORTED_FACT',
        `${candidateId}:${assembled.unsupportedOutcomeKinds.join(',')}`,
      );
    }
    const normalizedResult = normalizeRawComponentResult(candidateId, assembled);
    return normalizeCandidate({
      ...candidate,
      ...clone(normalizedResult),
      candidateId,
      actionId: candidate.actionId,
      actorId: candidate.actorId,
      targetSet: candidate.targetSet,
      paymentMode: candidate.paymentMode,
      dependencyTokens: candidate.dependencyTokens,
      rawInput: candidate.rawInput,
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
    const evaluatedCandidates = session.candidates.map(candidate => {
      const cached = session.computedCandidateStore.get(candidate.candidateId);
      if (cached) {
        session.metrics.candidateCacheHits += 1;
        return cached;
      }
      const evaluated = evaluateComponentCandidate(session, candidate);
      session.computedCandidateStore.set(candidate.candidateId, evaluated);
      session.metrics.candidateEvaluations += 1;
      return evaluated;
    });
    const vectors = evaluatedCandidates.map(candidate => {
      const cached = session.baseVectorStore.get(candidate.candidateId);
      if (cached) {
        session.metrics.vectorCacheHits += 1;
        return cached;
      }
      const vector = materializeVector(candidate);
      session.baseVectorStore.set(candidate.candidateId, vector);
      session.metrics.vectorMaterializations += 1;
      return vector;
    });
    if (!session.paretoDirty && session.lastEvaluatedVectors) {
      return session.lastEvaluatedVectors;
    }
    const decorated = vectors.map(vector => freeze({
      ...vector,
      paretoWitness: paretoWitnessFor(vector, vectors),
    }));
    decorated.forEach(vector => session.vectorStore.set(vector.candidateId, vector));
    session.lastEvaluatedVectors = Object.freeze(decorated);
    session.paretoDirty = false;
    session.metrics.paretoReassemblies += 1;
    return session.lastEvaluatedVectors;
  }

  function applyFactDelta(session, expectedRevision, delta = {}) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    if (Number(expectedRevision) !== session.revision) fatal('R9V2_KERNEL_REVISION_MISMATCH');
    if (!OPERATIONS.has(delta.operation)) fatal('R9V2_KERNEL_FACT_DELTA_OPERATION_UNKNOWN', delta.operation);
    if (
      session.rawMode &&
      typeof session.componentRegistry.validateFactDelta === 'function' &&
      session.componentRegistry.validateFactDelta(delta) !== true
    ) fatal(
      'R9V2_KERNEL_FACT_DELTA_UNEXPRESSIBLE',
      `${delta.entityType || ''}:${delta.fieldCode || ''}`,
    );
    const resolvedInvalidations = session.rawMode
      ? session.componentRegistry.componentCodesForFactDelta(delta)
      : session.componentCodes;
    if (
      session.rawMode &&
      resolvedInvalidations !== null &&
      !Array.isArray(resolvedInvalidations)
    ) {
      fatal('R9V2_KERNEL_COMPONENT_INVALIDATION_RESULT_INVALID');
    }
    const requestedInvalidations = resolvedInvalidations === null
      ? null
      : [...new Set(resolvedInvalidations.map(value => String(value || '').trim()))];
    if (requestedInvalidations?.some(code => !session.componentCodes.includes(code))) {
      fatal('R9V2_KERNEL_COMPONENT_INVALIDATION_CODE_UNKNOWN');
    }
    const dependencyTokens = arrayValue(delta.dependencyTokens || [], 'R9V2_KERNEL_FACT_DELTA_DEPENDENCIES_NOT_ARRAY').map(String);
    const unknownDependency = dependencyTokens.some(token => !session.dependencyOwners.has(token));
    const dirtyCandidateIds = new Set();
    dependencyTokens.forEach(token => session.dependencyOwners.get(token)?.forEach(candidateId => dirtyCandidateIds.add(candidateId)));
    const fullRebuildRequired = unknownDependency ||
      dependencyTokens.length === 0 ||
      requestedInvalidations === null;
    if (fullRebuildRequired) session.candidates.forEach(candidate => dirtyCandidateIds.add(candidate.candidateId));
    const invalidatedComponentCodes = fullRebuildRequired
      ? [...session.componentCodes]
      : requestedInvalidations;
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
      invalidatedComponentCodes,
    }));
    session.metrics.factDeltaApplications += 1;
    if (
      String(delta.entityType || '').trim().toUpperCase() ===
        'MECHANICAL_ENTRY' &&
      String(delta.fieldCode || '').trim() === 'candidateSnapshot'
    ) {
      session.metrics.candidateSnapshotDeltas += 1;
    }
    if (
      String(delta.entityType || '').trim().toUpperCase() ===
        'TARGET_KERNEL_CONTEXT'
    ) {
      session.metrics.contextInvalidations += 1;
    }
    for (const candidateId of dirtyCandidateIds) {
      session.vectorStore.delete(candidateId);
      session.baseVectorStore.delete(candidateId);
      session.computedCandidateStore.delete(candidateId);
      const invalidated = session.invalidatedComponentsByCandidate.get(candidateId) || new Set();
      invalidatedComponentCodes.forEach(code => invalidated.add(code));
      session.invalidatedComponentsByCandidate.set(candidateId, invalidated);
    }
    session.paretoDirty = true;
    session.metrics.dirtyCandidateRebuilds += dirtyCandidateIds.size;
    session.metrics.componentInvalidations +=
      dirtyCandidateIds.size * invalidatedComponentCodes.length;
    if (fullRebuildRequired) session.metrics.fullRebuilds += 1;
    return Object.freeze({
      revision: session.revision,
      dirtyCandidateIds: Object.freeze([...dirtyCandidateIds]),
      invalidatedComponentCodes: Object.freeze(invalidatedComponentCodes),
      fullRebuildRequired,
    });
  }

  function materializeProof(session, candidateId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    const id = stringValue(candidateId, 'R9V2_KERNEL_PROOF_CANDIDATE_ID_MISSING');
    const candidate = session.rawMode
      ? session.computedCandidateStore.get(id)
      : session.candidates.find(row => row.candidateId === id);
    if (!candidate) {
      fatal(
        session.rawMode
          ? 'R9V2_KERNEL_PROOF_VECTOR_NOT_EVALUATED'
          : 'R9V2_KERNEL_PROOF_CANDIDATE_MISSING',
        id,
      );
    }
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
    rawCalculationMode: RAW_CALCULATION_MODE,
    paretoDimensions: PARETO_DIMENSIONS,
    createSession,
    evaluateAllCandidates,
    applyFactDelta,
    materializeProof,
  });
  if (root.__LWCS_BATTLE_R9V2_KERNEL__) fatal('R9V2_KERNEL_DUPLICATE_LOAD');
  root.__LWCS_BATTLE_R9V2_KERNEL__ = api;
})();

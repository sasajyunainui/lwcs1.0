/* BattleDecisionR9v2Kernel_Module.js - isolated R9v2 value-kernel contract. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const VERSION = '9v2-kernel-1.4.0';
  const SCHEMA_VERSION = 'ValueKernelSessionV1';
  const RAW_CALCULATION_MODE = 'COMPONENT_REGISTRY_V1';
  const BATCH_CALCULATION_MODE = 'BEHAVIOR_POOL_COLUMNS_V1';
  const BATCH_COLUMNS_SCHEMA = 'BehaviorPoolColumnsV1';
  const PROBABILITY_TOLERANCE = 1e-12;
  const CAUSAL_TOLERANCE = 1e-6;
  const SEMANTIC_DOMAINS = Object.freeze(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
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
  const OWNER_TYPE_CODES = Object.freeze({
    NONE: 0,
    STATE_DELTA: 1,
    ACTION_POOL_DELTA: 2,
    TERMINAL_DELTA: 3,
  });
  const OWNER_TYPE_NAMES = Object.freeze([
    'NONE',
    'STATE_DELTA',
    'ACTION_POOL_DELTA',
    'TERMINAL_DELTA',
  ]);
  const TERMINAL_KINDS = new Set(['NONE', 'VICTORY', 'FAILURE', 'DRAW']);
  const BATCH_UNSUPPORTED_TERMINAL_KEYS = new Set([
    'terminal',
    'terminalresult',
    'branchterminal',
    'branchterminalkind',
    'terminaloutcome',
    'branchoutcome',
  ]);
  const BATCH_FORBIDDEN_ROUTE_PATTERN = /future|route/iu;
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
  const strictFinite = (value, code, detail) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) fatal(code, detail);
    return Object.is(value, -0) ? 0 : value;
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
    const result = total + compensation;
    if (!Number.isFinite(result)) fatal('R9V2_KERNEL_NON_FINITE_SUM');
    return Object.is(result, -0) ? 0 : result;
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

  function compareUtf16(left, right) {
    const a = String(left);
    const b = String(right);
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const delta = a.charCodeAt(index) - b.charCodeAt(index);
      if (delta) return delta;
    }
    return a.length - b.length;
  }

  function integerIndex(value, code, upper, detail = '') {
    const number = strictFinite(value, code, detail);
    if (!Number.isInteger(number) || number < 0 || number >= upper) {
      fatal(code, detail);
    }
    return number;
  }

  function normalizedRange(value, code, upper, detail = '') {
    const range = arrayValue(value, code);
    if (range.length !== 2) fatal(code, detail);
    const start = strictFinite(range[0], code, detail);
    const end = strictFinite(range[1], code, detail);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > upper) {
      fatal(code, detail);
    }
    return Object.freeze([start, end]);
  }

  function normalizeIdentityCatalog(value, code) {
    const values = arrayValue(value, code).map(item => stringValue(item, code));
    return Object.freeze(values);
  }

  function requireBatchInformationColumn(columns, key) {
    if (!Object.hasOwn(columns, key) || !Array.isArray(columns[key])) {
      fatal(
        'R9V2_KERNEL_BATCH_ADAPTER_INPUT_BLOCKED',
        `S4_DIRECT_OUTCOME_CANDIDATE_COLUMN_MISSING:${key}`,
      );
    }
    return columns[key];
  }

  function requireBatchColumn(columns, key) {
    if (!Object.hasOwn(columns, key)) {
      fatal('R9V2_KERNEL_BATCH_COLUMN_MISSING', key);
    }
    return columns[key];
  }

  function assertUniqueStrings(values, code) {
    const seen = new Set();
    values.forEach((value, index) => {
      if (seen.has(value)) fatal(code, `${index}:${value}`);
      seen.add(value);
    });
    return values;
  }

  function assertBatchMetadataValue(value, path, seen = new WeakSet()) {
    if (typeof value === 'number') {
      strictFinite(value, 'R9V2_KERNEL_BATCH_METADATA_NON_FINITE', path);
      return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value !== 'object' || seen.has(value)) {
      if (typeof value === 'object' && seen.has(value)) {
        fatal('R9V2_KERNEL_BATCH_METADATA_CYCLE', path);
      }
      fatal('R9V2_KERNEL_BATCH_METADATA_VALUE_INVALID', path);
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((child, index) => assertBatchMetadataValue(child, `${path}[${index}]`, seen));
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      if (BATCH_FORBIDDEN_ROUTE_PATTERN.test(key)) {
        fatal('R9V2_KERNEL_BATCH_FUTURE_ROUTE_FORBIDDEN', `${path}.${key}`);
      }
      assertBatchMetadataValue(child, `${path}.${key}`, seen);
    });
  }

  function normalizeBatchMetadata(value, path) {
    assertBatchMetadataValue(value, path);
    return freeze(clone(value));
  }

  function compareBatchFactIndexes(left, right, columns) {
    for (const [a, b] of [
      [columns.componentCodes[columns.componentCodeIndex[left]], columns.componentCodes[columns.componentCodeIndex[right]]],
      [OWNER_TYPE_NAMES[columns.causalOwnerTypeCode[left]], OWNER_TYPE_NAMES[columns.causalOwnerTypeCode[right]]],
      [columns.sourceEventIds[columns.sourceEventIndex[left]], columns.sourceEventIds[columns.sourceEventIndex[right]]],
      [columns.sourceFactIds[columns.sourceFactIndex[left]], columns.sourceFactIds[columns.sourceFactIndex[right]]],
      [columns.factTargetIds[columns.factTargetIndex[left]], columns.factTargetIds[columns.factTargetIndex[right]]],
    ]) {
      const comparison = compareUtf16(a, b);
      if (comparison) return comparison;
    }
    if (columns.sequence[left] !== columns.sequence[right]) {
      return columns.sequence[left] < columns.sequence[right] ? -1 : 1;
    }
    return left - right;
  }

  function compareBatchExecutionOrder(left, right, columns) {
    if (columns.sequence[left] !== columns.sequence[right]) {
      return columns.sequence[left] < columns.sequence[right] ? -1 : 1;
    }
    const leftFactId = columns.sourceFactIds[columns.sourceFactIndex[left]];
    const rightFactId = columns.sourceFactIds[columns.sourceFactIndex[right]];
    const comparison = compareUtf16(leftFactId, rightFactId);
    return comparison || left - right;
  }

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

  const BELIEF_OVERLAY_FIELDS = new Set([
    'schemaVersion',
    'observerId',
    'beliefRevision',
    'visibleHpRatios',
    'visibleStates',
    'publicStates',
    'revealedAbilityIds',
    'observableDeclarations',
    'observableResults',
    'posteriorParameters',
    'visibilityTokens',
  ]);
  const BELIEF_HIDDEN_KEY_PATTERN = /hidden|private|unobserved|secret|internal|confidential/iu;

  function assertPublicBeliefValue(value, path = 'beliefOverlay', seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((child, index) => assertPublicBeliefValue(child, `${path}[${index}]`, seen));
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      if (BELIEF_HIDDEN_KEY_PATTERN.test(key)) {
        fatal('BELIEF_HIDDEN_STATE_LEAK', `${path}.${key}`);
      }
      assertPublicBeliefValue(child, `${path}.${key}`, seen);
    });
  }

  function normalizeBeliefOverlay(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      fatal('R9V2_KERNEL_BELIEF_OVERLAY_INVALID');
    }
    Object.keys(input).forEach(key => {
      if (BELIEF_HIDDEN_KEY_PATTERN.test(key)) fatal('BELIEF_HIDDEN_STATE_LEAK', key);
      if (!BELIEF_OVERLAY_FIELDS.has(key)) fatal('BELIEF_PUBLIC_FIELD_UNKNOWN', key);
    });
    assertPublicBeliefValue(input);
    const visibleStates = clone(input.visibleStates ?? input.publicStates ?? {});
    const publicStates = clone(input.publicStates ?? input.visibleStates ?? {});
    const overlay = {
      schemaVersion: 'BeliefOverlayV1',
      observerId: stringValue(input.observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING'),
      beliefRevision: stringValue(input.beliefRevision || '1', 'R9V2_KERNEL_BELIEF_REVISION_MISSING'),
      visibleHpRatios: clone(input.visibleHpRatios || {}),
      visibleStates,
      publicStates,
      revealedAbilityIds: arrayValue(input.revealedAbilityIds || [], 'R9V2_KERNEL_REVEALED_ABILITIES_NOT_ARRAY').map(String),
      observableDeclarations: clone(input.observableDeclarations || []),
      observableResults: clone(input.observableResults || []),
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

  function normalizeBatchCandidate(row) {
    if (!row || typeof row !== 'object') fatal('R9V2_KERNEL_BATCH_CANDIDATE_INVALID');
    for (const field of [
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
    ]) {
      if (Object.hasOwn(row, field)) fatal('R9V2_KERNEL_BATCH_PRECOMPUTED_VALUE_INPUT', `${row.candidateId || ''}:${field}`);
    }
    return freeze({
      candidateId: stringValue(row.candidateId, 'R9V2_KERNEL_CANDIDATE_ID_MISSING'),
      mechanicalSource: stringValue(
        row.mechanicalSource || 'PREVIEW_ATOMIC_FACTS_V1',
        'R9V2_KERNEL_MECHANICAL_SOURCE_MISSING',
      ),
      legal: row.legal === undefined ? true : row.legal === true,
      hardExclusionCodes: arrayValue(
        row.hardExclusionCodes || [],
        'R9V2_KERNEL_EXCLUSIONS_NOT_ARRAY',
      ).map(value => stringValue(value, 'R9V2_KERNEL_EXCLUSION_CODE_MISSING')),
    });
  }

  function normalizeBatchRangeColumn(columns, key, count, upper, code) {
    const values = arrayValue(requireBatchColumn(columns, key), code);
    if (values.length !== count) fatal('R9V2_KERNEL_BATCH_COLUMN_LENGTH_MISMATCH', key);
    return values.map((value, index) => normalizedRange(value, code, upper, String(index)));
  }

  function assertBatchBranchTerminalFree(value, path = 'branch', seen = new WeakSet()) {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) fatal('R9V2_KERNEL_BATCH_METADATA_CYCLE', path);
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((child, index) => assertBatchBranchTerminalFree(child, `${path}[${index}]`, seen));
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      if (BATCH_UNSUPPORTED_TERMINAL_KEYS.has(String(key).toLowerCase()) || ['terminalkind', 'isterminal'].includes(String(key).toLowerCase())) {
        fatal('R9V2_KERNEL_UNSUPPORTED_BRANCH_TERMINAL_REPRESENTATION', `${path}.${key}`);
      }
      assertBatchBranchTerminalFree(child, `${path}.${key}`, seen);
    });
  }

  function normalizeBatchOutcomeRows(
    columns,
    candidateIds,
    candidateFactRanges,
    factColumns,
  ) {
    const rawRows = arrayValue(
      requireBatchColumn(columns, 'outcomeRows'),
      'R9V2_KERNEL_BATCH_OUTCOME_ROWS_NOT_ARRAY',
    );
    const candidateOutcomeRanges = normalizeBatchRangeColumn(
      columns,
      'candidateOutcomeRanges',
      candidateIds.length,
      rawRows.length,
      'R9V2_KERNEL_BATCH_OUTCOME_RANGE_INVALID',
    );
    let outcomeCursor = 0;
    candidateOutcomeRanges.forEach((range, candidateIndex) => {
      if (range[0] !== outcomeCursor) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_RANGES_NOT_CONTIGUOUS', String(candidateIndex));
      }
      outcomeCursor = range[1];
    });
    if (outcomeCursor !== rawRows.length) {
      fatal('R9V2_KERNEL_BATCH_OUTCOME_RANGES_INCOMPLETE');
    }

    const candidateForOutcome = new Array(rawRows.length);
    candidateOutcomeRanges.forEach((range, candidateIndex) => {
      for (let index = range[0]; index < range[1]; index += 1) candidateForOutcome[index] = candidateIndex;
    });
    const normalizedRows = rawRows.map((row, outcomeIndex) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_ROW_INVALID', String(outcomeIndex));
      }
      Object.keys(row).forEach(key => {
        if (BATCH_UNSUPPORTED_TERMINAL_KEYS.has(key.toLowerCase())) {
          fatal('R9V2_KERNEL_UNSUPPORTED_BRANCH_TERMINAL_REPRESENTATION', `${candidateIds[candidateForOutcome[outcomeIndex]]}:${outcomeIndex}:${key}`);
        }
      });
      const candidateIndex = candidateForOutcome[outcomeIndex];
      const candidateId = candidateIds[candidateIndex];
      if (!Object.hasOwn(row, 'candidateId')) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_CANDIDATE_ID_MISSING', `${candidateId}:${outcomeIndex}`);
      }
      const sourceFactIndex = integerIndex(
        row.sourceFactIndex,
        'R9V2_KERNEL_BATCH_OUTCOME_FACT_INDEX_INVALID',
        factColumns.componentCodeIndex.length,
        `${candidateId}:${outcomeIndex}`,
      );
      const factRange = candidateFactRanges[candidateIndex];
      if (sourceFactIndex < factRange[0] || sourceFactIndex >= factRange[1]) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_FACT_CANDIDATE_MISMATCH', `${candidateId}:${outcomeIndex}`);
      }
      const sourceFactId = factColumns.sourceFactIds[factColumns.sourceFactIndex[sourceFactIndex]];
      if (!Object.hasOwn(row, 'sourceFactId') || String(row.sourceFactId).trim() !== sourceFactId) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_FACT_ID_MISMATCH', `${candidateId}:${outcomeIndex}`);
      }
      if (Object.hasOwn(row, 'candidateId') && String(row.candidateId).trim() !== candidateId) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_CANDIDATE_ID_MISMATCH', String(outcomeIndex));
      }
      if (!Object.hasOwn(row, 'probability')) {
        fatal('R9V2_KERNEL_PROBABILITY_MISSING', `${candidateId}:${outcomeIndex}`);
      }
      const probability = strictFinite(
        row.probability,
        'R9V2_KERNEL_PROBABILITY_NON_FINITE',
        `${candidateId}:${outcomeIndex}`,
      );
      if (probability < 0 || probability > 1) {
        fatal('R9V2_KERNEL_PROBABILITY_RANGE', `${candidateId}:${outcomeIndex}`);
      }
      const outcomeKind = stringValue(
        row.outcomeKind,
        'R9V2_KERNEL_BATCH_OUTCOME_KIND_MISSING',
      );
      if (outcomeKind !== factColumns.sourceOutcomeKind[sourceFactIndex]) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_KIND_FACT_MISMATCH', `${candidateId}:${outcomeIndex}`);
      }
      const branchIndex = strictFinite(
        row.branchIndex,
        'R9V2_KERNEL_BATCH_OUTCOME_BRANCH_INDEX_INVALID',
        `${candidateId}:${outcomeIndex}`,
      );
      if (!Number.isInteger(branchIndex) || branchIndex < 0) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_BRANCH_INDEX_INVALID', `${candidateId}:${outcomeIndex}`);
      }
      if (!Object.hasOwn(row, 'isTerminal') || typeof row.isTerminal !== 'boolean') {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_TERMINAL_FLAG_MISSING', `${candidateId}:${outcomeIndex}`);
      }
      const terminalKind = stringValue(
        row.terminalKind,
        'R9V2_KERNEL_BATCH_OUTCOME_TERMINAL_KIND_MISSING',
      ).toUpperCase();
      if (!TERMINAL_KINDS.has(terminalKind)) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_TERMINAL_KIND_UNKNOWN', `${candidateId}:${outcomeIndex}`);
      }
      const ownerCode = factColumns.causalOwnerTypeCode[sourceFactIndex];
      if (row.isTerminal && (terminalKind === 'NONE' || ownerCode !== OWNER_TYPE_CODES.TERMINAL_DELTA)) {
        fatal('R9V2_KERNEL_UNSUPPORTED_BRANCH_TERMINAL_REPRESENTATION', `${candidateId}:${outcomeIndex}`);
      }
      if (!row.isTerminal && terminalKind !== 'NONE') {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_TERMINAL_FLAG_AMBIGUOUS', `${candidateId}:${outcomeIndex}`);
      }
      if (!Object.hasOwn(row, 'postTerminal') || typeof row.postTerminal !== 'boolean') {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_POST_TERMINAL_FLAG_MISSING', `${candidateId}:${outcomeIndex}`);
      }
      const branch = Object.hasOwn(row, 'branch')
        ? normalizeBatchMetadata(row.branch, `${candidateId}:${outcomeIndex}:branch`)
        : null;
      if (branch) assertBatchBranchTerminalFree(branch, `${candidateId}:${outcomeIndex}:branch`);
      return {
        candidateId,
        sourceFactIndex,
        sourceFactId,
        sourceOutcomeKind: outcomeKind,
        outcomeKind,
        branchIndex,
        probability,
        isTerminal: row.isTerminal,
        terminalKind,
        postTerminal: row.postTerminal,
        ...(branch ? { branch } : {}),
      };
    });

    const rawGroups = arrayValue(
      requireBatchColumn(columns, 'primaryOutcomeGroups'),
      'R9V2_KERNEL_BATCH_PRIMARY_GROUPS_NOT_ARRAY',
    );
    const candidatePrimaryOutcomeGroupRanges = normalizeBatchRangeColumn(
      columns,
      'candidatePrimaryOutcomeGroupRanges',
      candidateIds.length,
      rawGroups.length,
      'R9V2_KERNEL_BATCH_PRIMARY_GROUP_RANGE_INVALID',
    );
    let groupCursor = 0;
    const groupIdsByCandidate = candidateIds.map(() => new Set());
    const normalizedGroups = rawGroups.map((group, groupIndex) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) {
        fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_INVALID', String(groupIndex));
      }
      assertBatchBranchTerminalFree(group, `primaryOutcomeGroups[${groupIndex}]`);
      const candidateIndex = candidatePrimaryOutcomeGroupRanges.findIndex(
        range => groupIndex >= range[0] && groupIndex < range[1],
      );
      if (candidateIndex < 0) fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_CANDIDATE_MISSING', String(groupIndex));
      const candidateId = candidateIds[candidateIndex];
      const outcomeRange = normalizedRange(
        group.outcomeRange,
        'R9V2_KERNEL_BATCH_PRIMARY_GROUP_OUTCOME_RANGE_INVALID',
        normalizedRows.length,
        `${candidateId}:${groupIndex}`,
      );
      const candidateOutcomeRange = candidateOutcomeRanges[candidateIndex];
      if (
        outcomeRange[0] < candidateOutcomeRange[0] ||
        outcomeRange[1] > candidateOutcomeRange[1] ||
        outcomeRange[0] === outcomeRange[1]
      ) {
        fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_OUTCOME_RANGE_INVALID', `${candidateId}:${groupIndex}`);
      }
      const sourceFactIndex = integerIndex(
        group.sourceFactIndex,
        'R9V2_KERNEL_BATCH_PRIMARY_GROUP_FACT_INDEX_INVALID',
        factColumns.componentCodeIndex.length,
        `${candidateId}:${groupIndex}`,
      );
      if (sourceFactIndex < candidateFactRanges[candidateIndex][0] || sourceFactIndex >= candidateFactRanges[candidateIndex][1]) {
        fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_FACT_CANDIDATE_MISMATCH', `${candidateId}:${groupIndex}`);
      }
      const targetUnitId = stringValue(
        group.targetUnitId,
        'R9V2_KERNEL_BATCH_PRIMARY_GROUP_TARGET_MISSING',
      );
      const outcomeKind = stringValue(
        group.outcomeKind,
        'R9V2_KERNEL_BATCH_PRIMARY_GROUP_KIND_MISSING',
      );
      const groupId = stringValue(group.groupId, 'R9V2_KERNEL_BATCH_PRIMARY_GROUP_ID_MISSING');
      if (groupIdsByCandidate[candidateIndex].has(groupId)) fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_ID_DUPLICATE', `${candidateId}:${groupId}`);
      groupIdsByCandidate[candidateIndex].add(groupId);
      for (let outcomeIndex = outcomeRange[0]; outcomeIndex < outcomeRange[1]; outcomeIndex += 1) {
        const row = normalizedRows[outcomeIndex];
        if (row.branchIndex !== outcomeIndex - outcomeRange[0]) {
          fatal('R9V2_KERNEL_BATCH_OUTCOME_BRANCH_INDEX_NOT_CONTIGUOUS', `${candidateId}:${groupId}`);
        }
        if (
          row.sourceFactIndex !== sourceFactIndex ||
          row.outcomeKind !== outcomeKind ||
          factColumns.factTargetIds[factColumns.factTargetIndex[row.sourceFactIndex]] !== targetUnitId
        ) {
          fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_ROW_MISMATCH', `${candidateId}:${groupIndex}`);
        }
      }
      const probabilityTotal = sum(
        normalizedRows.slice(outcomeRange[0], outcomeRange[1]).map(row => row.probability),
      );
      if (Math.abs(probabilityTotal - 1) > PROBABILITY_TOLERANCE) {
        fatal('R9V2_KERNEL_PROBABILITY_SUM_MISMATCH', `${candidateId}:${groupId}`);
      }
      return {
        candidateId,
        groupId,
        sourceFactIndex,
        targetUnitId,
        outcomeKind,
        outcomeRange,
      };
    });
    candidatePrimaryOutcomeGroupRanges.forEach((range, candidateIndex) => {
      if (range[0] !== groupCursor) {
        fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_RANGES_NOT_CONTIGUOUS', String(candidateIndex));
      }
      const outcomeRange = candidateOutcomeRanges[candidateIndex];
      let rowCursor = outcomeRange[0];
      for (let groupIndex = range[0]; groupIndex < range[1]; groupIndex += 1) {
        const group = normalizedGroups[groupIndex];
        if (group.outcomeRange[0] !== rowCursor) {
          fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_ROWS_NOT_CONTIGUOUS', `${candidateIds[candidateIndex]}:${groupIndex}`);
        }
        rowCursor = group.outcomeRange[1];
      }
      if (rowCursor !== outcomeRange[1]) {
        fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_ROWS_INCOMPLETE', candidateIds[candidateIndex]);
      }
      if (range[0] === range[1] && outcomeRange[0] !== outcomeRange[1]) {
        fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUPS_MISSING', candidateIds[candidateIndex]);
      }
      groupCursor = range[1];
    });
    if (groupCursor !== rawGroups.length) fatal('R9V2_KERNEL_BATCH_PRIMARY_GROUP_RANGES_INCOMPLETE');
    return {
      candidateOutcomeRanges,
      outcomeRows: normalizedRows,
      candidatePrimaryOutcomeGroupRanges,
      primaryOutcomeGroups: normalizedGroups,
    };
  }

  function normalizeBehaviorPoolColumns(input, candidateIds) {
    const columns = input?.behaviorPoolColumns;
    if (!columns || columns.schemaVersion !== BATCH_COLUMNS_SCHEMA) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_COLUMNS_SCHEMA_MISMATCH');
    }
    Object.keys(columns).forEach(key => {
      if (BATCH_FORBIDDEN_ROUTE_PATTERN.test(key)) {
        fatal('R9V2_KERNEL_BATCH_FUTURE_ROUTE_FORBIDDEN', key);
      }
    });
    const worldRevision = stringValue(
      requireBatchColumn(columns, 'worldRevision'),
      'R9V2_KERNEL_WORLD_REVISION_MISSING',
    );
    const opportunityRevision = stringValue(
      requireBatchColumn(columns, 'opportunityRevision'),
      'R9V2_KERNEL_OPPORTUNITY_REVISION_MISSING',
    );
    if (Object.hasOwn(input, 'worldRevision') && String(input.worldRevision) !== worldRevision) {
      fatal('R9V2_KERNEL_BATCH_WORLD_REVISION_MISMATCH');
    }
    if (Object.hasOwn(input, 'opportunityRevision') && String(input.opportunityRevision) !== opportunityRevision) {
      fatal('R9V2_KERNEL_BATCH_OPPORTUNITY_REVISION_MISMATCH');
    }
    const suppliedCandidateIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'candidateIds'),
      'R9V2_KERNEL_BEHAVIOR_POOL_CANDIDATE_IDS_NOT_ARRAY',
    );
    if (
      suppliedCandidateIds.length !== candidateIds.length ||
      suppliedCandidateIds.some((candidateId, index) => candidateId !== candidateIds[index])
    ) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_CANDIDATE_COLUMN_MISMATCH');
    }
    const actorIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'actorIds'),
      'R9V2_KERNEL_BATCH_ACTOR_IDS_NOT_ARRAY',
    );
    const sourceActionIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'sourceActionIds'),
      'R9V2_KERNEL_BATCH_SOURCE_ACTION_IDS_NOT_ARRAY',
    );
    const paymentModes = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'paymentModes'),
      'R9V2_KERNEL_BATCH_PAYMENT_MODES_NOT_ARRAY',
    );
    for (const [key, values] of [
      ['actorIds', actorIds],
      ['sourceActionIds', sourceActionIds],
      ['paymentModes', paymentModes],
    ]) {
      if (values.length !== candidateIds.length) fatal('R9V2_KERNEL_BATCH_COLUMN_LENGTH_MISMATCH', key);
    }
    const targetUnitIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'targetUnitIds'),
      'R9V2_KERNEL_BATCH_TARGET_UNIT_IDS_NOT_ARRAY',
    );
    const targetOffsets = normalizeBatchRangeColumn(
      columns,
      'targetOffsets',
      candidateIds.length,
      targetUnitIds.length,
      'R9V2_KERNEL_BATCH_TARGET_RANGE_INVALID',
    );
    let targetCursor = 0;
    targetOffsets.forEach((range, candidateIndex) => {
      if (range[0] !== targetCursor) fatal('R9V2_KERNEL_BATCH_TARGET_RANGES_NOT_CONTIGUOUS', String(candidateIndex));
      const seen = new Set();
      for (let index = range[0]; index < range[1]; index += 1) {
        if (seen.has(targetUnitIds[index])) fatal('R9V2_KERNEL_BATCH_TARGET_DUPLICATE', candidateIds[candidateIndex]);
        seen.add(targetUnitIds[index]);
      }
      targetCursor = range[1];
    });
    if (targetCursor !== targetUnitIds.length) fatal('R9V2_KERNEL_BATCH_TARGET_RANGES_INCOMPLETE');
    const resourceCosts = arrayValue(
      requireBatchColumn(columns, 'resourceCosts'),
      'R9V2_KERNEL_BATCH_RESOURCE_COSTS_NOT_ARRAY',
    );
    if (resourceCosts.length !== candidateIds.length) fatal('R9V2_KERNEL_BATCH_COLUMN_LENGTH_MISMATCH', 'resourceCosts');
    const normalizedResourceCosts = resourceCosts.map((value, index) => {
      const normalized = normalizeBatchMetadata(value, `candidate:${candidateIds[index]}:resourceCosts`);
      if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
        fatal('R9V2_KERNEL_BATCH_RESOURCE_COSTS_INVALID', candidateIds[index]);
      }
      Object.entries(normalized).forEach(([resource, amount]) => {
        stringValue(resource, 'R9V2_KERNEL_BATCH_RESOURCE_NAME_MISSING');
        const cost = strictFinite(amount, 'R9V2_KERNEL_BATCH_RESOURCE_COST_NON_FINITE', `${candidateIds[index]}:${resource}`);
        if (cost < 0) fatal('R9V2_KERNEL_BATCH_RESOURCE_COST_NEGATIVE', `${candidateIds[index]}:${resource}`);
      });
      return normalized;
    });
    const successProbabilities = arrayValue(
      requireBatchColumn(columns, 'successProbabilities'),
      'R9V2_KERNEL_BATCH_SUCCESS_PROBABILITIES_NOT_ARRAY',
    ).map((value, index) => {
      const probability = strictFinite(value, 'R9V2_KERNEL_PROBABILITY_NON_FINITE', `candidate:${candidateIds[index]}`);
      if (probability < 0 || probability > 1) fatal('R9V2_KERNEL_PROBABILITY_RANGE', candidateIds[index]);
      return probability;
    });
    if (successProbabilities.length !== candidateIds.length) fatal('R9V2_KERNEL_BATCH_COLUMN_LENGTH_MISMATCH', 'successProbabilities');
    const dependencyTokens = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'dependencyTokens'),
      'R9V2_KERNEL_BATCH_DEPENDENCY_TOKENS_NOT_ARRAY',
    );
    const dependencyTokenRanges = normalizeBatchRangeColumn(
      columns,
      'dependencyTokenRanges',
      candidateIds.length,
      dependencyTokens.length,
      'R9V2_KERNEL_BATCH_DEPENDENCY_RANGE_INVALID',
    );
    let dependencyCursor = 0;
    dependencyTokenRanges.forEach((range, candidateIndex) => {
      if (range[0] !== dependencyCursor) fatal('R9V2_KERNEL_BATCH_DEPENDENCY_RANGES_NOT_CONTIGUOUS', String(candidateIndex));
      const seen = new Set();
      for (let index = range[0]; index < range[1]; index += 1) {
        if (seen.has(dependencyTokens[index])) fatal('R9V2_KERNEL_BATCH_DEPENDENCY_DUPLICATE', candidateIds[candidateIndex]);
        seen.add(dependencyTokens[index]);
      }
      dependencyCursor = range[1];
    });
    if (dependencyCursor !== dependencyTokens.length) fatal('R9V2_KERNEL_BATCH_DEPENDENCY_RANGES_INCOMPLETE');
    const componentCodes = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'componentCodes'),
      'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_CODES_NOT_ARRAY',
    );
    if (!componentCodes.length) fatal('R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_CODES_EMPTY');
    if (new Set(componentCodes).size !== componentCodes.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_CODES_DUPLICATE');
    }
    const componentSemanticDomainCodes = arrayValue(
      columns.componentSemanticDomainCodes,
      'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_DOMAINS_NOT_ARRAY',
    ).map((value, index) => {
      const domain = stringValue(value, 'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_DOMAIN_MISSING');
      if (!SEMANTIC_DOMAINS.includes(domain)) {
        fatal('R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_DOMAIN_UNKNOWN', `${index}:${domain}`);
      }
      return domain;
    });
    const componentOwnerTypeCodes = arrayValue(
      columns.componentOwnerTypeCodes,
      'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_OWNERS_NOT_ARRAY',
    ).map((value, index) => integerIndex(
      value,
      'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_OWNER_UNKNOWN',
      OWNER_TYPE_NAMES.length,
      String(index),
    ));
    if (
      componentSemanticDomainCodes.length !== componentCodes.length ||
      componentOwnerTypeCodes.length !== componentCodes.length
    ) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_CATALOG_LENGTH_MISMATCH');
    }
    const sourceEventIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'sourceEventIds'),
      'R9V2_KERNEL_BEHAVIOR_POOL_SOURCE_EVENTS_NOT_ARRAY',
    );
    assertUniqueStrings(sourceEventIds, 'R9V2_KERNEL_BEHAVIOR_POOL_SOURCE_EVENTS_DUPLICATE');
    const sourceFactIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'sourceFactIds'),
      'R9V2_KERNEL_BEHAVIOR_POOL_SOURCE_FACTS_NOT_ARRAY',
    );
    assertUniqueStrings(sourceFactIds, 'R9V2_KERNEL_BEHAVIOR_POOL_SOURCE_FACTS_DUPLICATE');
    const factTargetIds = normalizeIdentityCatalog(
      requireBatchColumn(columns, 'factTargetIds'),
      'R9V2_KERNEL_BATCH_FACT_TARGET_IDS_NOT_ARRAY',
    );
    assertUniqueStrings(factTargetIds, 'R9V2_KERNEL_BATCH_FACT_TARGET_IDS_DUPLICATE');
    const factCount = arrayValue(
      requireBatchColumn(columns, 'componentCodeIndex'),
      'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_INDEX_NOT_ARRAY',
    ).length;
    const causalOwnerTypeCode = arrayValue(
      columns.causalOwnerTypeCode,
      'R9V2_KERNEL_BEHAVIOR_POOL_OWNER_INDEX_NOT_ARRAY',
    ).map((value, index) => integerIndex(
      value,
      'R9V2_KERNEL_BEHAVIOR_POOL_OWNER_UNKNOWN',
      OWNER_TYPE_NAMES.length,
      String(index),
    ));
    const componentCodeIndex = arrayValue(
      columns.componentCodeIndex,
      'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_INDEX_NOT_ARRAY',
    ).map((value, index) =>
      integerIndex(value, 'R9V2_KERNEL_BEHAVIOR_POOL_COMPONENT_INDEX_UNKNOWN', componentCodes.length, String(index))
    );
    const sourceEventIndex = arrayValue(
      columns.sourceEventIndex,
      'R9V2_KERNEL_BEHAVIOR_POOL_EVENT_INDEX_NOT_ARRAY',
    ).map((value, index) => integerIndex(
      value,
      'R9V2_KERNEL_BEHAVIOR_POOL_EVENT_INDEX_UNKNOWN',
      sourceEventIds.length,
      String(index),
    ));
    const sourceFactIndex = arrayValue(
      columns.sourceFactIndex,
      'R9V2_KERNEL_BEHAVIOR_POOL_FACT_INDEX_NOT_ARRAY',
    ).map((value, index) => integerIndex(
      value,
      'R9V2_KERNEL_BEHAVIOR_POOL_FACT_INDEX_UNKNOWN',
      sourceFactIds.length,
      String(index),
    ));
    const factTargetIndex = arrayValue(
      requireBatchColumn(columns, 'factTargetIndex'),
      'R9V2_KERNEL_BATCH_FACT_TARGET_INDEX_NOT_ARRAY',
    ).map((value, index) => integerIndex(
      value,
      'R9V2_KERNEL_BATCH_FACT_TARGET_INDEX_UNKNOWN',
      factTargetIds.length,
      String(index),
    ));
    const sequence = arrayValue(
      columns.sequence,
      'R9V2_KERNEL_BEHAVIOR_POOL_SEQUENCE_NOT_ARRAY',
    ).map((value, index) => strictFinite(value, 'R9V2_KERNEL_BEHAVIOR_POOL_SEQUENCE_NON_FINITE', String(index)));
    const valueHEPP = arrayValue(
      requireBatchColumn(columns, 'valueHEPP'),
      'R9V2_KERNEL_BEHAVIOR_POOL_VALUES_NOT_ARRAY',
    ).map((value, index) => strictFinite(value, 'R9V2_KERNEL_BEHAVIOR_POOL_VALUE_NON_FINITE', String(index)));
    const sourceOutcomeKind = arrayValue(
      requireBatchColumn(columns, 'sourceOutcomeKind'),
      'R9V2_KERNEL_BATCH_SOURCE_OUTCOME_KIND_NOT_ARRAY',
    ).map((value, index) => stringValue(value, 'R9V2_KERNEL_BATCH_SOURCE_OUTCOME_KIND_MISSING', String(index)));
    const postTerminalFlags = arrayValue(
      requireBatchColumn(columns, 'postTerminalFlags'),
      'R9V2_KERNEL_BATCH_POST_TERMINAL_FLAGS_NOT_ARRAY',
    ).map((value, index) => {
      if (typeof value !== 'boolean') fatal('R9V2_KERNEL_BATCH_POST_TERMINAL_FLAG_INVALID', String(index));
      return value;
    });
    if (
      componentCodeIndex.length !== factCount ||
      causalOwnerTypeCode.length !== factCount ||
      sourceEventIndex.length !== factCount ||
      sourceFactIndex.length !== factCount ||
      factTargetIndex.length !== factCount ||
      sequence.length !== factCount ||
      valueHEPP.length !== factCount ||
      sourceOutcomeKind.length !== factCount ||
      postTerminalFlags.length !== factCount
    ) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_FACT_COLUMN_LENGTH_MISMATCH');
    }
    for (let index = 0; index < factCount; index += 1) {
      const componentIndex = componentCodeIndex[index];
      if (causalOwnerTypeCode[index] !== componentOwnerTypeCodes[componentIndex]) {
        fatal('R9V2_KERNEL_BEHAVIOR_POOL_OWNER_COMPONENT_MISMATCH', String(index));
      }
      if (
        causalOwnerTypeCode[index] === OWNER_TYPE_CODES.NONE &&
        valueHEPP[index] !== 0
      ) {
        fatal('R9V2_KERNEL_NONE_OWNER_NONZERO', String(index));
      }
    }
    const factColumns = {
      componentCodes,
      componentCodeIndex,
      causalOwnerTypeCode,
      sourceEventIds,
      sourceEventIndex,
      sourceFactIds,
      sourceFactIndex,
      factTargetIds,
      factTargetIndex,
      sourceOutcomeKind,
      sequence,
      valueHEPP,
    };
    const candidateFactRanges = normalizeBatchRangeColumn(
      columns,
      'candidateFactRanges',
      candidateIds.length,
      factCount,
      'R9V2_KERNEL_BEHAVIOR_POOL_FACT_RANGE_INVALID',
    );
    const directFactRanges = normalizeBatchRangeColumn(
      columns,
      'directFactRanges',
      candidateIds.length,
      factCount,
      'R9V2_KERNEL_BATCH_DIRECT_FACT_RANGE_INVALID',
    );
    const scheduledFactRanges = normalizeBatchRangeColumn(
      columns,
      'scheduledFactRanges',
      candidateIds.length,
      factCount,
      'R9V2_KERNEL_BATCH_SCHEDULED_FACT_RANGE_INVALID',
    );
    let factCursor = 0;
    const oldFactOrderByCandidate = [];
    candidateFactRanges.forEach((candidateRange, candidateIndex) => {
      if (candidateRange[0] !== factCursor) fatal('R9V2_KERNEL_BEHAVIOR_POOL_FACT_RANGES_NOT_CONTIGUOUS', String(candidateIndex));
      const direct = directFactRanges[candidateIndex];
      const scheduled = scheduledFactRanges[candidateIndex];
      if (
        direct[0] < candidateRange[0] || direct[1] > candidateRange[1] ||
        scheduled[0] < candidateRange[0] || scheduled[1] > candidateRange[1] ||
        direct[1] !== scheduled[0] || direct[0] !== candidateRange[0] || scheduled[1] !== candidateRange[1]
      ) {
        fatal('R9V2_KERNEL_BATCH_FACT_RANGE_PARTITION_INVALID', candidateIds[candidateIndex]);
      }
      const indexes = [
        ...Array.from({ length: direct[1] - direct[0] }, (_, offset) => direct[0] + offset),
        ...Array.from({ length: scheduled[1] - scheduled[0] }, (_, offset) => scheduled[0] + offset),
      ];
      const seenFactIds = new Set();
      indexes.forEach(index => {
        const sourceFactId = sourceFactIds[sourceFactIndex[index]];
        if (seenFactIds.has(sourceFactId)) fatal('DUPLICATE_CAUSAL_VALUE', `${candidateIds[candidateIndex]}:${sourceFactId}`);
        seenFactIds.add(sourceFactId);
      });
      oldFactOrderByCandidate.push({
        candidateRange,
        direct,
        scheduled,
        indexes: [
          ...indexes.slice(0, direct[1] - direct[0]).sort((left, right) => compareBatchFactIndexes(left, right, factColumns)),
          ...indexes.slice(direct[1] - direct[0]).sort((left, right) => compareBatchFactIndexes(left, right, factColumns)),
        ],
      });
      factCursor = candidateRange[1];
    });
    if (factCursor !== factCount) fatal('R9V2_KERNEL_BEHAVIOR_POOL_FACT_RANGES_INCOMPLETE');
    const orderedFactIndexes = oldFactOrderByCandidate.flatMap(item => item.indexes);
    const oldToNewFactIndex = new Map(orderedFactIndexes.map((oldIndex, newIndex) => [oldIndex, newIndex]));
    const reorderFacts = values => Object.freeze(orderedFactIndexes.map(index => values[index]));
    const normalizedCandidateFactRanges = [];
    const normalizedDirectFactRanges = [];
    const normalizedScheduledFactRanges = [];
    let normalizedFactCursor = 0;
    oldFactOrderByCandidate.forEach(item => {
      const directLength = item.direct[1] - item.direct[0];
      const scheduledLength = item.scheduled[1] - item.scheduled[0];
      normalizedCandidateFactRanges.push(Object.freeze([normalizedFactCursor, normalizedFactCursor + directLength + scheduledLength]));
      normalizedDirectFactRanges.push(Object.freeze([normalizedFactCursor, normalizedFactCursor + directLength]));
      normalizedScheduledFactRanges.push(Object.freeze([normalizedFactCursor + directLength, normalizedFactCursor + directLength + scheduledLength]));
      normalizedFactCursor += directLength + scheduledLength;
    });
    const normalizedFirstTerminalMetadata = arrayValue(
      requireBatchColumn(columns, 'firstTerminalMetadata'),
      'R9V2_KERNEL_BATCH_FIRST_TERMINAL_METADATA_NOT_ARRAY',
    );
    if (normalizedFirstTerminalMetadata.length !== candidateIds.length) fatal('R9V2_KERNEL_BATCH_COLUMN_LENGTH_MISMATCH', 'firstTerminalMetadata');
    const firstTerminalMetadata = [];
    const normalizedPostTerminalFlags = new Array(factCount);
    candidateIds.forEach((candidateId, candidateIndex) => {
      const item = oldFactOrderByCandidate[candidateIndex];
      const candidateFactIndexes = item.indexes;
      const terminalIndexes = candidateFactIndexes.filter(index =>
        causalOwnerTypeCode[index] === OWNER_TYPE_CODES.TERMINAL_DELTA,
      ).sort((left, right) => compareBatchExecutionOrder(left, right, factColumns));
      const metadata = normalizedFirstTerminalMetadata[candidateIndex];
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fatal('R9V2_KERNEL_BATCH_FIRST_TERMINAL_METADATA_INVALID', candidateId);
      if (typeof metadata.hasTerminal !== 'boolean') fatal('R9V2_KERNEL_BATCH_FIRST_TERMINAL_FLAG_MISSING', candidateId);
      const expectedHasTerminal = terminalIndexes.length > 0;
      if (metadata.hasTerminal !== expectedHasTerminal) fatal('R9V2_KERNEL_BATCH_FIRST_TERMINAL_AMBIGUOUS', candidateId);
      const expectedIndex = expectedHasTerminal ? terminalIndexes[0] : null;
      const terminalKind = String(metadata.terminalKind ?? '').trim().toUpperCase();
      if (
        !TERMINAL_KINDS.has(terminalKind) ||
        (expectedHasTerminal ? terminalKind === 'NONE' : terminalKind !== 'NONE')
      ) {
        fatal('R9V2_KERNEL_BATCH_FIRST_TERMINAL_KIND_INVALID', candidateId);
      }
      const expectedSourceFactId = expectedIndex === null ? null : sourceFactIds[sourceFactIndex[expectedIndex]];
      const expectedOutcomeKind = expectedIndex === null ? null : sourceOutcomeKind[expectedIndex];
      if (expectedHasTerminal) {
        if (
          strictFinite(metadata.factIndex, 'R9V2_KERNEL_BATCH_FIRST_TERMINAL_INDEX_INVALID', candidateId) !== expectedIndex ||
          strictFinite(metadata.sequence, 'R9V2_KERNEL_BATCH_FIRST_TERMINAL_SEQUENCE_INVALID', candidateId) !== sequence[expectedIndex] ||
          stringValue(metadata.sourceFactId, 'R9V2_KERNEL_BATCH_FIRST_TERMINAL_FACT_ID_MISSING') !== expectedSourceFactId ||
          stringValue(metadata.sourceOutcomeKind, 'R9V2_KERNEL_BATCH_FIRST_TERMINAL_OUTCOME_KIND_MISSING') !== expectedOutcomeKind
        ) {
          fatal('R9V2_KERNEL_BATCH_FIRST_TERMINAL_METADATA_MISMATCH', candidateId);
        }
      } else if (
        metadata.factIndex !== null || metadata.sequence !== null || metadata.sourceFactId !== null || metadata.sourceOutcomeKind !== null
      ) {
        fatal('R9V2_KERNEL_BATCH_FIRST_TERMINAL_METADATA_MISMATCH', candidateId);
      }
      const orderedTerminalIndex = expectedIndex === null ? null : oldToNewFactIndex.get(expectedIndex);
      firstTerminalMetadata.push(Object.freeze({
        hasTerminal: expectedHasTerminal,
        factIndex: orderedTerminalIndex,
        sequence: expectedIndex === null ? null : sequence[expectedIndex],
        sourceFactId: expectedSourceFactId,
        sourceOutcomeKind: expectedOutcomeKind,
        terminalKind,
      }));
      const executionOrder = candidateFactIndexes.slice().sort((left, right) => compareBatchExecutionOrder(left, right, factColumns));
      const firstPosition = expectedIndex === null ? -1 : executionOrder.indexOf(expectedIndex);
      executionOrder.forEach((oldIndex, position) => {
        const expectedPostTerminal = firstPosition >= 0 && position > firstPosition;
        if (postTerminalFlags[oldIndex] !== expectedPostTerminal) fatal('R9V2_KERNEL_BATCH_POST_TERMINAL_METADATA_MISMATCH', `${candidateId}:${oldIndex}`);
        if (expectedPostTerminal && Math.abs(valueHEPP[oldIndex]) > CAUSAL_TOLERANCE) fatal('R9V2_KERNEL_BATCH_POST_TERMINAL_NONZERO', `${candidateId}:${oldIndex}`);
        normalizedPostTerminalFlags[oldToNewFactIndex.get(oldIndex)] = expectedPostTerminal;
      });
    });
    const normalizedOutcomeData = normalizeBatchOutcomeRows(
      columns,
      candidateIds,
      candidateFactRanges,
      factColumns,
    );
    normalizedOutcomeData.candidateOutcomeRanges.forEach((range, candidateIndex) => {
      if (range[0] === range[1] && ![0, 1].includes(successProbabilities[candidateIndex])) {
        fatal('R9V2_KERNEL_PROBABILITY_AMBIGUOUS', candidateIds[candidateIndex]);
      }
    });
    normalizedOutcomeData.outcomeRows.forEach((row, outcomeIndex) => {
      const oldFactIndex = row.sourceFactIndex;
      const normalizedFactIndex = oldToNewFactIndex.get(oldFactIndex);
      if (normalizedFactIndex === undefined) fatal('R9V2_KERNEL_BATCH_OUTCOME_FACT_INDEX_INVALID', row.candidateId);
      const candidateIndex = normalizedOutcomeData.candidateOutcomeRanges.findIndex(
        range => outcomeIndex >= range[0] && outcomeIndex < range[1],
      );
      const suppliedPostTerminal = row.postTerminal;
      row.sourceFactIndex = normalizedFactIndex;
      row.sourceFactId = sourceFactIds[sourceFactIndex[oldFactIndex]];
      row.postTerminal = normalizedPostTerminalFlags[normalizedFactIndex];
      if (suppliedPostTerminal !== row.postTerminal) fatal('R9V2_KERNEL_BATCH_OUTCOME_POST_TERMINAL_MISMATCH', row.candidateId);
      const terminalMetadata = firstTerminalMetadata[candidateIndex];
      if (row.isTerminal && (!terminalMetadata.hasTerminal || normalizedFactIndex !== terminalMetadata.factIndex)) {
        fatal('R9V2_KERNEL_UNSUPPORTED_BRANCH_TERMINAL_REPRESENTATION', `${row.candidateId}:${outcomeIndex}`);
      }
      if (row.isTerminal && row.postTerminal) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_TERMINAL_AFTER_FIRST', `${row.candidateId}:${outcomeIndex}`);
      }
      if (row.isTerminal && row.terminalKind !== terminalMetadata.terminalKind) {
        fatal('R9V2_KERNEL_BATCH_OUTCOME_TERMINAL_KIND_AMBIGUOUS', `${row.candidateId}:${outcomeIndex}`);
      }
    });
    normalizedOutcomeData.primaryOutcomeGroups.forEach(group => {
      const normalizedFactIndex = oldToNewFactIndex.get(group.sourceFactIndex);
      group.sourceFactIndex = normalizedFactIndex;
    });

    const paretoColumns = columns.paretoColumns;
    if (!paretoColumns || typeof paretoColumns !== 'object') {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_PARETO_COLUMNS_MISSING');
    }
    const normalizeCandidateColumn = key => {
      const values = arrayValue(
        paretoColumns[key],
        `R9V2_KERNEL_BEHAVIOR_POOL_PARETO_COLUMN_MISSING:${key}`,
      ).map((value, index) => strictFinite(value, 'R9V2_KERNEL_BEHAVIOR_POOL_PARETO_NON_FINITE', `${key}:${index}`));
      if (values.length !== candidateIds.length) {
        fatal('R9V2_KERNEL_BEHAVIOR_POOL_PARETO_LENGTH_MISMATCH', key);
      }
      return Object.freeze(values);
    };
    const normalizedParetoColumns = {
      worstTailUtilityHEPP: normalizeCandidateColumn('worstTailUtilityHEPP'),
      survivalUtilityHEPP: normalizeCandidateColumn('survivalUtilityHEPP'),
      assetReserveHEPP: normalizeCandidateColumn('assetReserveHEPP'),
      discardedOverkillPP: normalizeCandidateColumn('discardedOverkillPP'),
    };

    const candidateInformationGroupRanges = requireBatchInformationColumn(
      columns,
      'candidateInformationGroupRanges',
    );
    const informationGroupOutcomeRanges = requireBatchInformationColumn(
      columns,
      'informationGroupOutcomeRanges',
    );
    const informationOutcomeProbabilities = requireBatchInformationColumn(
      columns,
      'informationOutcomeProbabilities',
    ).map((value, index) => {
      const probability = strictFinite(value, 'R9V2_KERNEL_PROBABILITY_NON_FINITE', String(index));
      if (probability < 0 || probability > 1) fatal('R9V2_KERNEL_PROBABILITY_RANGE', String(index));
      return probability;
    });
    const informationOutcomeCandidateRanges = requireBatchInformationColumn(
      columns,
      'informationOutcomeCandidateRanges',
    );
    const informationCandidateIds = normalizeIdentityCatalog(
      requireBatchInformationColumn(columns, 'informationCandidateIds'),
      'R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_CANDIDATES_NOT_ARRAY',
    );
    const candidateIdSet = new Set(candidateIds);
    informationCandidateIds.forEach((candidateId, index) => {
      if (!candidateIdSet.has(candidateId)) {
        fatal('R9V2_KERNEL_INFORMATION_OUTCOME_CANDIDATE_UNKNOWN', `${index}:${candidateId}`);
      }
    });
    const informationCandidateValuesHEPP = requireBatchInformationColumn(
      columns,
      'informationCandidateValuesHEPP',
    ).map((value, index) => strictFinite(value, 'R9V2_KERNEL_INFORMATION_OUTCOME_CANDIDATE_VALUE_NON_FINITE', String(index)));
    if (informationCandidateValuesHEPP.length !== informationCandidateIds.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_COLUMN_LENGTH_MISMATCH');
    }
    const normalizedCandidateInformationGroupRanges = [];
    if (candidateInformationGroupRanges.length !== candidateIds.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_GROUP_RANGE_LENGTH_MISMATCH');
    }
    let groupCursor = 0;
    candidateInformationGroupRanges.forEach((rangeValue, candidateIndex) => {
      const range = normalizedRange(
        rangeValue,
        'R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_GROUP_RANGE_INVALID',
        informationGroupOutcomeRanges.length,
        String(candidateIndex),
      );
      if (range[0] !== groupCursor) {
        fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_GROUP_RANGES_NOT_CONTIGUOUS', String(candidateIndex));
      }
      normalizedCandidateInformationGroupRanges.push(range);
      groupCursor = range[1];
    });
    if (groupCursor !== informationGroupOutcomeRanges.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_GROUP_RANGES_INCOMPLETE');
    }
    const normalizedInformationGroupOutcomeRanges = [];
    let outcomeCursor = 0;
    informationGroupOutcomeRanges.forEach((rangeValue, groupIndex) => {
      const range = normalizedRange(
        rangeValue,
        'R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_OUTCOME_RANGE_INVALID',
        informationOutcomeProbabilities.length,
        String(groupIndex),
      );
      if (range[0] !== outcomeCursor || range[0] === range[1]) {
        fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_OUTCOME_RANGES_INVALID', String(groupIndex));
      }
      const probabilityTotal = sum(informationOutcomeProbabilities.slice(range[0], range[1]));
      if (Math.abs(probabilityTotal - 1) > PROBABILITY_TOLERANCE) {
        fatal('R9V2_KERNEL_PROBABILITY_SUM_MISMATCH', String(groupIndex));
      }
      normalizedInformationGroupOutcomeRanges.push(range);
      outcomeCursor = range[1];
    });
    if (outcomeCursor !== informationOutcomeProbabilities.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_OUTCOME_RANGES_INCOMPLETE');
    }
    if (informationOutcomeCandidateRanges.length !== informationOutcomeProbabilities.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_CANDIDATE_RANGE_LENGTH_MISMATCH');
    }
    const normalizedInformationOutcomeCandidateRanges = [];
    let informationCandidateCursor = 0;
    informationOutcomeCandidateRanges.forEach((rangeValue, outcomeIndex) => {
      const range = normalizedRange(
        rangeValue,
        'R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_CANDIDATE_RANGE_INVALID',
        informationCandidateIds.length,
        String(outcomeIndex),
      );
      if (range[0] !== informationCandidateCursor) {
        fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_CANDIDATE_RANGES_NOT_CONTIGUOUS', String(outcomeIndex));
      }
      const seen = new Set();
      for (let index = range[0]; index < range[1]; index += 1) {
        const candidateId = informationCandidateIds[index];
        if (seen.has(candidateId)) {
          fatal('R9V2_KERNEL_INFORMATION_OUTCOME_CANDIDATE_DUPLICATE', `${outcomeIndex}:${candidateId}`);
        }
        seen.add(candidateId);
      }
      if (range[1] - range[0] !== candidateIds.length || seen.size !== candidateIds.length) {
        fatal('R9V2_KERNEL_INFORMATION_OUTCOME_CANDIDATE_SET_INCOMPLETE', String(outcomeIndex));
      }
      candidateIds.forEach(candidateId => {
        if (!seen.has(candidateId)) fatal('R9V2_KERNEL_INFORMATION_OUTCOME_CANDIDATE_SET_INCOMPLETE', `${outcomeIndex}:${candidateId}`);
      });
      normalizedInformationOutcomeCandidateRanges.push(range);
      informationCandidateCursor = range[1];
    });
    if (informationCandidateCursor !== informationCandidateIds.length) {
      fatal('R9V2_KERNEL_BEHAVIOR_POOL_INFORMATION_CANDIDATE_RANGES_INCOMPLETE');
    }
    return freeze({
      schemaVersion: BATCH_COLUMNS_SCHEMA,
      worldRevision,
      opportunityRevision,
      candidateIds: suppliedCandidateIds,
      actorIds,
      targetOffsets: Object.freeze(targetOffsets),
      targetUnitIds,
      sourceActionIds,
      paymentModes,
      resourceCosts: Object.freeze(normalizedResourceCosts),
      successProbabilities: Object.freeze(successProbabilities),
      dependencyTokens,
      dependencyTokenRanges: Object.freeze(dependencyTokenRanges),
      componentCodes: Object.freeze(componentCodes),
      componentSemanticDomainCodes: Object.freeze(componentSemanticDomainCodes),
      componentOwnerTypeCodes: Object.freeze(componentOwnerTypeCodes),
      sourceEventIds,
      sourceFactIds,
      factTargetIds,
      candidateFactRanges: Object.freeze(normalizedCandidateFactRanges),
      directFactRanges: Object.freeze(normalizedDirectFactRanges),
      scheduledFactRanges: Object.freeze(normalizedScheduledFactRanges),
      componentCodeIndex: reorderFacts(componentCodeIndex),
      causalOwnerTypeCode: reorderFacts(causalOwnerTypeCode),
      sourceEventIndex: reorderFacts(sourceEventIndex),
      sourceFactIndex: reorderFacts(sourceFactIndex),
      factTargetIndex: reorderFacts(factTargetIndex),
      sourceOutcomeKind: reorderFacts(sourceOutcomeKind),
      sequence: reorderFacts(sequence),
      valueHEPP: reorderFacts(valueHEPP),
      postTerminalFlags: Object.freeze(normalizedPostTerminalFlags),
      firstTerminalMetadata: Object.freeze(firstTerminalMetadata),
      candidateOutcomeRanges: Object.freeze(normalizedOutcomeData.candidateOutcomeRanges),
      outcomeRows: freeze(normalizedOutcomeData.outcomeRows),
      candidatePrimaryOutcomeGroupRanges: Object.freeze(normalizedOutcomeData.candidatePrimaryOutcomeGroupRanges),
      primaryOutcomeGroups: freeze(normalizedOutcomeData.primaryOutcomeGroups),
      paretoColumns: freeze(normalizedParetoColumns),
      candidateInformationGroupRanges: Object.freeze(normalizedCandidateInformationGroupRanges),
      informationGroupOutcomeRanges: Object.freeze(normalizedInformationGroupOutcomeRanges),
      informationOutcomeProbabilities: Object.freeze(informationOutcomeProbabilities),
      informationOutcomeCandidateRanges: Object.freeze(normalizedInformationOutcomeCandidateRanges),
      informationCandidateIds,
      informationCandidateValuesHEPP: Object.freeze(informationCandidateValuesHEPP),
    });
  }

  function createBatchSession(input, rows) {
    const ids = new Set();
    const normalizedCandidates = rows.map(row => {
      const candidate = normalizeBatchCandidate(row);
      if (ids.has(candidate.candidateId)) fatal('R9V2_KERNEL_DUPLICATE_CANDIDATE_ID', candidate.candidateId);
      ids.add(candidate.candidateId);
      return candidate;
    });
    const candidateIds = Object.freeze(normalizedCandidates.map(candidate => candidate.candidateId));
    const behaviorPoolColumns = normalizeBehaviorPoolColumns(input, candidateIds);
    const candidates = normalizedCandidates.map((candidate, candidateIndex) => {
      const targetRange = behaviorPoolColumns.targetOffsets[candidateIndex];
      const dependencyRange = behaviorPoolColumns.dependencyTokenRanges[candidateIndex];
      const metadata = {
        actionId: behaviorPoolColumns.sourceActionIds[candidateIndex],
        actorId: behaviorPoolColumns.actorIds[candidateIndex],
        targetSet: behaviorPoolColumns.targetUnitIds.slice(targetRange[0], targetRange[1]),
        paymentMode: behaviorPoolColumns.paymentModes[candidateIndex],
        dependencyTokens: behaviorPoolColumns.dependencyTokens.slice(dependencyRange[0], dependencyRange[1]),
        resourceCosts: behaviorPoolColumns.resourceCosts[candidateIndex],
        successProbability: behaviorPoolColumns.successProbabilities[candidateIndex],
      };
      const row = rows[candidateIndex];
      if (Object.hasOwn(row, 'actionId') && String(row.actionId).trim() !== metadata.actionId) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:actionId`);
      if (Object.hasOwn(row, 'actorId') && String(row.actorId).trim() !== metadata.actorId) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:actorId`);
      const suppliedTargets = Object.hasOwn(row, 'targetSet') ? row.targetSet : row.targetUnitIds;
      if (suppliedTargets !== undefined) {
        const normalizedTargets = arrayValue(suppliedTargets, 'R9V2_KERNEL_TARGET_SET_NOT_ARRAY').map(value => String(value).trim());
        if (JSON.stringify(normalizedTargets) !== JSON.stringify(metadata.targetSet)) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:targetSet`);
      }
      if (Object.hasOwn(row, 'paymentMode') && String(row.paymentMode).trim() !== metadata.paymentMode) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:paymentMode`);
      if (Object.hasOwn(row, 'dependencyTokens')) {
        const normalizedDependencies = arrayValue(row.dependencyTokens, 'R9V2_KERNEL_DEPENDENCY_TOKENS_NOT_ARRAY').map(value => String(value).trim());
        if (JSON.stringify(normalizedDependencies) !== JSON.stringify(metadata.dependencyTokens)) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:dependencyTokens`);
      }
      if (Object.hasOwn(row, 'resourceCosts') && JSON.stringify(row.resourceCosts) !== JSON.stringify(metadata.resourceCosts)) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:resourceCosts`);
      if (Object.hasOwn(row, 'successProbability') && row.successProbability !== metadata.successProbability) fatal('R9V2_KERNEL_BATCH_ROW_METADATA_MISMATCH', `${candidate.candidateId}:successProbability`);
      return freeze({ ...candidate, ...metadata });
    });
    const observerId = stringValue(input.observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING');
    const beliefOverlay = normalizeBeliefOverlay({
      ...(input.beliefOverlay || {}),
      observerId,
      beliefRevision: input.beliefRevision || input.beliefOverlay?.beliefRevision || '1',
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      kernelVersion: VERSION,
      calculationMode: BATCH_CALCULATION_MODE,
      batchMode: true,
      rawMode: false,
      worldRevision: behaviorPoolColumns.worldRevision,
      beliefRevision: beliefOverlay.beliefRevision,
      opportunityRevision: behaviorPoolColumns.opportunityRevision,
      dependencyOwners: createDependencyOwners(candidates),
      candidateIndexById: new Map(candidateIds.map((candidateId, index) => [candidateId, index])),
      factDeltas: [],
      candidateIds,
      candidates: Object.freeze(candidates),
      behaviorPoolColumns,
      beliefOverlay,
      revision: 0,
      batchVectorStore: new Map(),
      batchProofStore: new Map(),
      lastBatchVectors: null,
      batchParetoDirty: true,
      metrics: {
        candidateCount: candidates.length,
        batchEvaluations: 0,
        batchCacheHits: 0,
        batchParetoReassemblies: 0,
        batchProofsMaterialized: 0,
        fullRebuilds: 0,
        dirtyCandidateRebuilds: 0,
        factDeltaApplications: 0,
      },
    };
  }

  function createSession(input = {}) {
    if (!input || typeof input !== 'object') fatal('R9V2_KERNEL_SESSION_INPUT_INVALID');
    const rows = arrayValue(input.candidates, 'R9V2_KERNEL_CANDIDATES_NOT_ARRAY');
    if (!rows.length) fatal('R9V2_KERNEL_CANDIDATE_POOL_EMPTY');
    const calculationMode = String(input.calculationMode || 'SCALAR_INPUT').trim();
    if (calculationMode === BATCH_CALCULATION_MODE) return createBatchSession(input, rows);
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
        vectorFirstEvaluations: 0,
        vectorFirstCacheHits: 0,
        vectorFirstProofsMaterialized: 0,
        scalarGraphEvaluations: 0,
        scalarGraphCacheHits: 0,
        scalarGraphProofsMaterialized: 0,
        decisionValueGraphBuilds: 0,
        decisionValueGraphHits: 0,
        decisionValueGraphOverlayBuilds: 0,
        decisionValueGraphOverlayHits: 0,
        decisionValueGraphDirtyNodeEvaluations: 0,
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
      vectorFirstBaseStore: new Map(),
      vectorFirstStore: new Map(),
      vectorFirstProofStore: new Map(),
      vectorFirstLastEvaluatedVectors: null,
      vectorFirstParetoDirty: true,
      scalarGraphBaseStore: new Map(),
      scalarGraphStore: new Map(),
      scalarGraphProofStore: new Map(),
      scalarGraphLastEvaluatedVectors: null,
      scalarGraphParetoDirty: true,
      decisionValueGraphStore: new Map(),
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

  function evaluateVectorFirstCandidate(session, candidate) {
    if (!session.rawMode || typeof session.componentRegistry.evaluateVectorComponents !== 'function') {
      fatal('R9V2_KERNEL_VECTOR_COMPONENT_REGISTRY_MISSING');
    }
    const result = session.componentRegistry.evaluateVectorComponents({
      candidate,
      session,
      factDeltas: Object.freeze(session.factDeltas.slice()),
      componentCodes: session.componentCodes,
    });
    if (!result || typeof result !== 'object' || !result.components) {
      fatal('R9V2_KERNEL_VECTOR_COMPONENT_RESULT_INVALID', candidate.candidateId);
    }
    const componentCodes = [];
    const ownerTypeCodes = [];
    const sourceEventIds = [];
    const sourceFactIds = [];
    const targetUnitIds = [];
    const sequences = [];
    const valuesHEPP = [];
    const informationGroups = [];
    const paretoValues = {};
    const seenFacts = new Set();
    const unsupported = new Set();
    const ownerValues = [[], [], [], []];
    for (const componentCode of session.componentCodes) {
      const definition = session.componentDefinitions.find(item => item.componentCode === componentCode);
      const component = result.components[componentCode];
      if (!component || typeof component !== 'object') {
        fatal('R9V2_KERNEL_VECTOR_COMPONENT_RESULT_MISSING', `${candidate.candidateId}:${componentCode}`);
      }
      if (Object.hasOwn(component, 'facts') || Object.hasOwn(component, 'causalFacts')) {
        fatal('R9V2_KERNEL_VECTOR_FACT_ARRAY_FORBIDDEN', `${candidate.candidateId}:${componentCode}`);
      }
      const contributions = arrayValue(component.contributions || [], 'R9V2_KERNEL_VECTOR_CONTRIBUTIONS_NOT_ARRAY');
      for (const contribution of contributions) {
        if (!contribution || typeof contribution !== 'object') {
          fatal('R9V2_KERNEL_VECTOR_CONTRIBUTION_INVALID', `${candidate.candidateId}:${componentCode}`);
        }
        const sourceFactId = stringValue(contribution.sourceFactId, 'R9V2_KERNEL_CAUSAL_SOURCE_FACT_MISSING');
        if (seenFacts.has(sourceFactId)) fatal('DUPLICATE_CAUSAL_VALUE', `${candidate.candidateId}:${sourceFactId}`);
        seenFacts.add(sourceFactId);
        if (Object.hasOwn(contribution, 'componentCode') && contribution.componentCode !== componentCode) {
          fatal('R9V2_KERNEL_VECTOR_COMPONENT_MISMATCH', `${candidate.candidateId}:${componentCode}`);
        }
        if (Object.hasOwn(contribution, 'causalOwnerType') && contribution.causalOwnerType !== definition.causalOwnerType) {
          fatal('R9V2_KERNEL_VECTOR_OWNER_MISMATCH', `${candidate.candidateId}:${componentCode}`);
        }
        const valueHEPP = finite(contribution.valueHEPP, 'R9V2_KERNEL_CAUSAL_VALUE_NON_FINITE', sourceFactId);
        const ownerCode = OWNER_TYPE_CODES[definition.causalOwnerType];
        if (ownerCode === undefined) fatal('R9V2_KERNEL_UNKNOWN_CAUSAL_OWNER', definition.causalOwnerType);
        if (ownerCode === OWNER_TYPE_CODES.NONE && Math.abs(valueHEPP) > 1e-9) {
          fatal('R9V2_KERNEL_NONE_OWNER_NONZERO', candidate.candidateId);
        }
        componentCodes.push(componentCode);
        ownerTypeCodes.push(ownerCode);
        sourceEventIds.push(stringValue(contribution.sourceEventId, 'R9V2_KERNEL_CAUSAL_EVENT_MISSING'));
        sourceFactIds.push(sourceFactId);
        targetUnitIds.push(stringValue(contribution.targetUnitId, 'R9V2_KERNEL_CAUSAL_TARGET_MISSING'));
        sequences.push(finite(contribution.sequence ?? 0, 'R9V2_KERNEL_CAUSAL_SEQUENCE_NON_FINITE', sourceFactId));
        valuesHEPP.push(valueHEPP);
        ownerValues[ownerCode].push(valueHEPP);
      }
      const information = arrayValue(component.informationComponents || [], 'R9V2_KERNEL_COMPONENT_INFORMATION_NOT_ARRAY');
      assertRawInputValueFree(information, `${candidate.candidateId}:${componentCode}:informationComponents`);
      informationGroups.push(...clone(information));
      const pareto = arrayValue(component.paretoComponents || [], 'R9V2_KERNEL_COMPONENT_PARETO_NOT_ARRAY');
      for (const entry of pareto) {
        const code = stringValue(entry?.dimensionCode, 'R9V2_KERNEL_PARETO_COMPONENT_CODE_MISSING');
        if (!PARETO_COMPONENT_CODES.has(code) || Object.hasOwn(paretoValues, code)) {
          fatal('R9V2_KERNEL_PARETO_COMPONENT_UNKNOWN', `${candidate.candidateId}:${code}`);
        }
        paretoValues[code] = finite(entry?.value, 'R9V2_KERNEL_PARETO_COMPONENT_NON_FINITE', `${candidate.candidateId}:${code}`);
      }
      arrayValue(component.unsupportedOutcomeKinds || [], 'R9V2_KERNEL_COMPONENT_UNSUPPORTED_NOT_ARRAY')
        .forEach(kind => unsupported.add(String(kind)));
    }
    if (unsupported.size) fatal('R9V2_KERNEL_UNSUPPORTED_FACT', `${candidate.candidateId}:${[...unsupported].join(',')}`);
    for (const code of PARETO_COMPONENT_CODES) {
      if (!Object.hasOwn(paretoValues, code)) fatal('R9V2_KERNEL_PARETO_COMPONENT_MISSING', `${candidate.candidateId}:${code}`);
    }
    const order = valuesHEPP.map((_, index) => index).sort((left, right) => {
      for (const [a, b] of [
        [componentCodes[left], componentCodes[right]],
        [OWNER_TYPE_NAMES[ownerTypeCodes[left]], OWNER_TYPE_NAMES[ownerTypeCodes[right]]],
        [sourceEventIds[left], sourceEventIds[right]],
        [sourceFactIds[left], sourceFactIds[right]],
        [targetUnitIds[left], targetUnitIds[right]],
      ]) {
        if (a < b) return -1;
        if (a > b) return 1;
      }
      return sequences[left] - sequences[right];
    });
    const reorder = values => Object.freeze(order.map(index => values[index]));
    const columns = freeze({
      schemaVersion: 'CausalContributionColumnsV1',
      componentCodes: reorder(componentCodes),
      causalOwnerTypeCodes: reorder(ownerTypeCodes),
      sourceEventIds: reorder(sourceEventIds),
      sourceFactIds: reorder(sourceFactIds),
      targetUnitIds: reorder(targetUnitIds),
      sequences: reorder(sequences),
      valuesHEPP: reorder(valuesHEPP),
    });
    const stateDeltaTotal = sum(ownerValues[OWNER_TYPE_CODES.STATE_DELTA]);
    const actionPoolDeltaTotal = sum(ownerValues[OWNER_TYPE_CODES.ACTION_POOL_DELTA]);
    const terminalDeltaTotal = sum(ownerValues[OWNER_TYPE_CODES.TERMINAL_DELTA]);
    const goalUtilityDeltaHEPP = sum([stateDeltaTotal, actionPoolDeltaTotal, terminalDeltaTotal]);
    if (Math.abs(sum(valuesHEPP) - goalUtilityDeltaHEPP) > 1e-6) {
      fatal('CAUSAL_RECONCILIATION_MISMATCH', candidate.candidateId);
    }
    const informationValueHEPP = informationValue(informationGroups);
    const objectiveUtilityHEPP = sum([goalUtilityDeltaHEPP, informationValueHEPP]);
    return freeze({
      schemaVersion: 'CandidateValueVectorV1',
      candidateId: candidate.candidateId,
      valueSource: 'VECTOR_COMPONENT_COLUMNS_V1',
      mechanicalSource: String(candidate.mechanicalSource || 'UNKNOWN').trim(),
      componentTotals: Object.freeze({ stateDeltaTotal, actionPoolDeltaTotal, terminalDeltaTotal, ...paretoValues }),
      causalOwnerTotals: Object.freeze({ stateDeltaTotal, actionPoolDeltaTotal, terminalDeltaTotal }),
      stateDeltaTotal,
      actionPoolDeltaTotal,
      terminalDeltaTotal,
      goalUtilityDeltaHEPP,
      informationValueHEPP,
      objectiveUtilityHEPP,
      paretoDimensions: Object.freeze({ objectiveUtilityHEPP, informationValueHEPP, ...paretoValues }),
      hardExclusionCodes: Object.freeze([...candidate.hardExclusionCodes]),
      legal: candidate.legal,
      causalContributionColumns: columns,
      paretoWitness: null,
    });
  }

  function assertVectorProofEquality(vector, proofVector) {
    for (const field of ['stateDeltaTotal', 'actionPoolDeltaTotal', 'terminalDeltaTotal', 'goalUtilityDeltaHEPP', 'informationValueHEPP', 'objectiveUtilityHEPP']) {
      if (Math.abs(vector[field] - proofVector[field]) > 1e-9) fatal('R9V2_KERNEL_VECTOR_PROOF_VALUE_MISMATCH', `${vector.candidateId}:${field}`);
    }
    for (const [field] of PARETO_DIMENSIONS) {
      if (Math.abs(vector.paretoDimensions[field] - proofVector.paretoDimensions[field]) > 1e-9) fatal('R9V2_KERNEL_VECTOR_PROOF_PARETO_MISMATCH', `${vector.candidateId}:${field}`);
    }
    const columns = vector.causalContributionColumns;
    if (!columns || proofVector.causalFacts.length !== columns.valuesHEPP.length) {
      fatal('R9V2_KERNEL_VECTOR_PROOF_CAUSAL_COUNT_MISMATCH', vector.candidateId);
    }
    proofVector.causalFacts.forEach((fact, index) => {
      if (
        fact.componentCode !== columns.componentCodes[index] ||
        fact.causalOwnerType !== OWNER_TYPE_NAMES[columns.causalOwnerTypeCodes[index]] ||
        fact.sourceEventId !== columns.sourceEventIds[index] ||
        fact.sourceFactId !== columns.sourceFactIds[index] ||
        fact.targetUnitId !== columns.targetUnitIds[index] ||
        fact.sequence !== columns.sequences[index] ||
        Math.abs(fact.valueHEPP - columns.valuesHEPP[index]) > 1e-9
      ) fatal('R9V2_KERNEL_VECTOR_PROOF_CAUSAL_MISMATCH', `${vector.candidateId}:${index}`);
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

  function batchInformationForCandidate(columns, candidateIndex, eligibleCandidateIds) {
    const groupRange = columns.candidateInformationGroupRanges[candidateIndex];
    const groupValuesHEPP = [];
    let selectedAdaptiveValueHEPP = 0;
    let selectedCommittedValueHEPP = 0;
    let informationValueHEPP = 0;
    for (let groupIndex = groupRange[0]; groupIndex < groupRange[1]; groupIndex += 1) {
      const outcomeRange = columns.informationGroupOutcomeRanges[groupIndex];
      const probabilities = columns.informationOutcomeProbabilities.slice(outcomeRange[0], outcomeRange[1]);
      const outcomeCandidateSets = [];
      const expectedTermsByCandidate = new Map();
      const adaptiveTerms = [];
      for (let outcomeIndex = outcomeRange[0]; outcomeIndex < outcomeRange[1]; outcomeIndex += 1) {
        const candidateRange = columns.informationOutcomeCandidateRanges[outcomeIndex];
        const seenCandidateIds = new Set();
        const candidateSet = new Set();
        let bestOutcomeCandidateValueHEPP = 0;
        for (let valueIndex = candidateRange[0]; valueIndex < candidateRange[1]; valueIndex += 1) {
          const candidateId = columns.informationCandidateIds[valueIndex];
          if (seenCandidateIds.has(candidateId)) {
            fatal('R9V2_KERNEL_INFORMATION_OUTCOME_CANDIDATE_DUPLICATE', `${groupIndex}:${candidateId}`);
          }
          seenCandidateIds.add(candidateId);
          if (!eligibleCandidateIds.has(candidateId)) continue;
          candidateSet.add(candidateId);
          const valueHEPP = columns.informationCandidateValuesHEPP[valueIndex];
          if (valueHEPP > bestOutcomeCandidateValueHEPP) bestOutcomeCandidateValueHEPP = valueHEPP;
          if (!expectedTermsByCandidate.has(candidateId)) expectedTermsByCandidate.set(candidateId, []);
          expectedTermsByCandidate.get(candidateId).push(
            probabilities[outcomeIndex - outcomeRange[0]] * valueHEPP,
          );
        }
        outcomeCandidateSets.push(candidateSet);
        adaptiveTerms.push(
          probabilities[outcomeIndex - outcomeRange[0]] * bestOutcomeCandidateValueHEPP,
        );
      }
      const adaptive = sum(adaptiveTerms);
      const commonCandidateIds = outcomeCandidateSets.length
        ? [...outcomeCandidateSets[0]].filter(candidateId => outcomeCandidateSets.every(set => set.has(candidateId)))
        : [];
      let committed = 0;
      for (const candidateId of commonCandidateIds) {
        const expected = sum(expectedTermsByCandidate.get(candidateId) || []);
        if (expected > committed) committed = expected;
      }
      const deterministic = probabilities.every(probability => probability === 0 || probability === 1);
      const groupValue = deterministic
        ? 0
        : finite(
          Math.max(0, adaptive - committed),
          'R9V2_KERNEL_NON_FINITE_INFORMATION_VALUE',
          String(groupIndex),
        );
      groupValuesHEPP.push(groupValue);
      if (groupValue > informationValueHEPP) {
        informationValueHEPP = groupValue;
        selectedAdaptiveValueHEPP = adaptive;
        selectedCommittedValueHEPP = committed;
      }
    }
    return {
      informationValueHEPP,
      informationAdaptiveValueHEPP: selectedAdaptiveValueHEPP,
      informationCommittedValueHEPP: selectedCommittedValueHEPP,
      informationGroupValuesHEPP: Object.freeze(groupValuesHEPP),
    };
  }

  function batchCandidateMetadataForCandidate(columns, candidateIndex) {
    const targetRange = columns.targetOffsets[candidateIndex];
    const dependencyRange = columns.dependencyTokenRanges[candidateIndex];
    return freeze({
      actorId: columns.actorIds[candidateIndex],
      targetOffset: Object.freeze([...targetRange]),
      targetUnitIds: Object.freeze(columns.targetUnitIds.slice(targetRange[0], targetRange[1])),
      sourceActionId: columns.sourceActionIds[candidateIndex],
      paymentMode: columns.paymentModes[candidateIndex],
      resourceCosts: columns.resourceCosts[candidateIndex],
      successProbability: columns.successProbabilities[candidateIndex],
      dependencyTokenRange: Object.freeze([...dependencyRange]),
      dependencyTokens: Object.freeze(columns.dependencyTokens.slice(dependencyRange[0], dependencyRange[1])),
    });
  }

  function batchFactsForCandidate(columns, candidateIndex) {
    const range = columns.candidateFactRanges[candidateIndex];
    const facts = [];
    const ownerValues = [[], [], [], []];
    const ownerValuesByDomain = Object.fromEntries(
      SEMANTIC_DOMAINS.map(domain => [domain, [[], [], [], []]]),
    );
    const allValues = [];
    for (let index = range[0]; index < range[1]; index += 1) {
      const ownerCode = columns.causalOwnerTypeCode[index];
      const domain = columns.componentSemanticDomainCodes[
        columns.componentCodeIndex[index]
      ];
      const valueHEPP = columns.valueHEPP[index];
      facts.push(Object.freeze({
        componentCode: columns.componentCodes[columns.componentCodeIndex[index]],
        causalOwnerType: OWNER_TYPE_NAMES[ownerCode],
        valueHEPP,
        sourceEventId: columns.sourceEventIds[columns.sourceEventIndex[index]],
        sourceFactId: columns.sourceFactIds[columns.sourceFactIndex[index]],
        targetUnitId: columns.factTargetIds[columns.factTargetIndex[index]],
        sequence: columns.sequence[index],
        sourceOutcomeKind: columns.sourceOutcomeKind[index],
        postTerminal: columns.postTerminalFlags[index],
      }));
      ownerValues[ownerCode].push(valueHEPP);
      ownerValuesByDomain[domain][ownerCode].push(valueHEPP);
      allValues.push(valueHEPP);
    }
    const stateDeltaTotal = sum(ownerValues[OWNER_TYPE_CODES.STATE_DELTA]);
    const actionPoolDeltaTotal = sum(ownerValues[OWNER_TYPE_CODES.ACTION_POOL_DELTA]);
    const terminalDeltaTotal = sum(ownerValues[OWNER_TYPE_CODES.TERMINAL_DELTA]);
    const goalUtilityDeltaHEPP = sum([
      stateDeltaTotal,
      actionPoolDeltaTotal,
      terminalDeltaTotal,
    ]);
    const ownerTotalsBySemanticDomain = Object.fromEntries(
      SEMANTIC_DOMAINS.map(domain => [
        domain,
        Object.freeze({
          NONE: sum(ownerValuesByDomain[domain][OWNER_TYPE_CODES.NONE]),
          STATE_DELTA: sum(ownerValuesByDomain[domain][OWNER_TYPE_CODES.STATE_DELTA]),
          ACTION_POOL_DELTA: sum(ownerValuesByDomain[domain][OWNER_TYPE_CODES.ACTION_POOL_DELTA]),
          TERMINAL_DELTA: sum(ownerValuesByDomain[domain][OWNER_TYPE_CODES.TERMINAL_DELTA]),
        }),
      ]),
    );
    if (Math.abs(sum(allValues) - goalUtilityDeltaHEPP) > CAUSAL_TOLERANCE) {
      fatal('CAUSAL_RECONCILIATION_MISMATCH', columns.candidateIds[candidateIndex]);
    }
    return {
      range,
      directRange: columns.directFactRanges[candidateIndex],
      scheduledRange: columns.scheduledFactRanges[candidateIndex],
      facts: Object.freeze(facts),
      causalContributionColumns: freeze({
        schemaVersion: 'CausalContributionColumnsV1',
        componentCodeIndex: Object.freeze(columns.componentCodeIndex.slice(range[0], range[1])),
        causalOwnerTypeCode: Object.freeze(columns.causalOwnerTypeCode.slice(range[0], range[1])),
        sourceEventIndex: Object.freeze(columns.sourceEventIndex.slice(range[0], range[1])),
        sourceFactIndex: Object.freeze(columns.sourceFactIndex.slice(range[0], range[1])),
        factTargetIndex: Object.freeze(columns.factTargetIndex.slice(range[0], range[1])),
        sourceOutcomeKind: Object.freeze(columns.sourceOutcomeKind.slice(range[0], range[1])),
        postTerminalFlags: Object.freeze(columns.postTerminalFlags.slice(range[0], range[1])),
        sequence: Object.freeze(columns.sequence.slice(range[0], range[1])),
        valueHEPP: Object.freeze(columns.valueHEPP.slice(range[0], range[1])),
      }),
      stateDeltaTotal,
      actionPoolDeltaTotal,
      terminalDeltaTotal,
      goalUtilityDeltaHEPP,
      ownerTotalsBySemanticDomain: freeze(ownerTotalsBySemanticDomain),
    };
  }

  function batchOutcomeDataForCandidate(columns, candidateIndex) {
    const outcomeRange = columns.candidateOutcomeRanges[candidateIndex];
    const groupRange = columns.candidatePrimaryOutcomeGroupRanges[candidateIndex];
    return {
      outcomeRows: Object.freeze(columns.outcomeRows.slice(outcomeRange[0], outcomeRange[1]).map(row => freeze(clone(row)))),
      primaryOutcomeGroups: Object.freeze(columns.primaryOutcomeGroups.slice(groupRange[0], groupRange[1]).map(group => freeze({
        ...clone(group),
        outcomeRange: Object.freeze([
          group.outcomeRange[0] - outcomeRange[0],
          group.outcomeRange[1] - outcomeRange[0],
        ]),
      }))),
    };
  }

  function batchReconstructCandidate(session, candidateIndex, eligibleCandidateIds) {
    const columns = session.behaviorPoolColumns;
    const facts = batchFactsForCandidate(columns, candidateIndex);
    const information = batchInformationForCandidate(columns, candidateIndex, eligibleCandidateIds);
    const pareto = {
      worstTailUtilityHEPP: columns.paretoColumns.worstTailUtilityHEPP[candidateIndex],
      survivalUtilityHEPP: columns.paretoColumns.survivalUtilityHEPP[candidateIndex],
      assetReserveHEPP: columns.paretoColumns.assetReserveHEPP[candidateIndex],
      discardedOverkillPP: columns.paretoColumns.discardedOverkillPP[candidateIndex],
    };
    const objectiveUtilityHEPP = sum([facts.goalUtilityDeltaHEPP, information.informationValueHEPP]);
    const outcomeData = batchOutcomeDataForCandidate(columns, candidateIndex);
    return freeze({
      candidateMetadata: batchCandidateMetadataForCandidate(columns, candidateIndex),
      firstTerminalMetadata: columns.firstTerminalMetadata[candidateIndex],
      facts: facts.facts,
      causalFacts: facts.facts,
      causalContributionColumns: facts.causalContributionColumns,
      factRanges: freeze({
        candidate: Object.freeze([...facts.range]),
        direct: Object.freeze([...facts.directRange]),
        scheduled: Object.freeze([...facts.scheduledRange]),
      }),
      outcomeRows: outcomeData.outcomeRows,
      primaryOutcomeGroups: outcomeData.primaryOutcomeGroups,
      stateDeltaTotal: facts.stateDeltaTotal,
      actionPoolDeltaTotal: facts.actionPoolDeltaTotal,
      terminalDeltaTotal: facts.terminalDeltaTotal,
      goalUtilityDeltaHEPP: facts.goalUtilityDeltaHEPP,
      ownerTotalsBySemanticDomain: facts.ownerTotalsBySemanticDomain,
      causalOwnerTotals: Object.freeze({
        stateDeltaTotal: facts.stateDeltaTotal,
        actionPoolDeltaTotal: facts.actionPoolDeltaTotal,
        terminalDeltaTotal: facts.terminalDeltaTotal,
      }),
      informationAdaptiveValueHEPP: information.informationAdaptiveValueHEPP,
      informationCommittedValueHEPP: information.informationCommittedValueHEPP,
      informationGroupValuesHEPP: information.informationGroupValuesHEPP,
      informationValueHEPP: information.informationValueHEPP,
      objectiveUtilityHEPP,
      paretoInputs: Object.freeze(pareto),
      paretoDimensions: Object.freeze({
        objectiveUtilityHEPP,
        worstTailUtilityHEPP: pareto.worstTailUtilityHEPP,
        survivalUtilityHEPP: pareto.survivalUtilityHEPP,
        assetReserveHEPP: pareto.assetReserveHEPP,
        informationValueHEPP: information.informationValueHEPP,
        discardedOverkillPP: pareto.discardedOverkillPP,
      }),
    });
  }

  function evaluateBatchCandidate(session, candidate, candidateIndex, eligibleCandidateIds) {
    const reconstructed = batchReconstructCandidate(session, candidateIndex, eligibleCandidateIds);
    return freeze({
      schemaVersion: 'CandidateValueVectorV1',
      candidateId: candidate.candidateId,
      valueSource: 'BEHAVIOR_POOL_COLUMNS_V1',
      mechanicalSource: candidate.mechanicalSource,
      componentTotals: Object.freeze({
        stateDeltaTotal: reconstructed.stateDeltaTotal,
        actionPoolDeltaTotal: reconstructed.actionPoolDeltaTotal,
        terminalDeltaTotal: reconstructed.terminalDeltaTotal,
        ...reconstructed.paretoInputs,
      }),
      causalOwnerTotals: reconstructed.causalOwnerTotals,
      ownerTotalsBySemanticDomain: reconstructed.ownerTotalsBySemanticDomain,
      candidateMetadata: reconstructed.candidateMetadata,
      firstTerminalMetadata: reconstructed.firstTerminalMetadata,
      causalFacts: reconstructed.causalFacts,
      factRanges: reconstructed.factRanges,
      outcomeRows: reconstructed.outcomeRows,
      primaryOutcomeGroups: reconstructed.primaryOutcomeGroups,
      paretoInputs: reconstructed.paretoInputs,
      stateDeltaTotal: reconstructed.stateDeltaTotal,
      actionPoolDeltaTotal: reconstructed.actionPoolDeltaTotal,
      terminalDeltaTotal: reconstructed.terminalDeltaTotal,
      goalUtilityDeltaHEPP: reconstructed.goalUtilityDeltaHEPP,
      informationAdaptiveValueHEPP: reconstructed.informationAdaptiveValueHEPP,
      informationCommittedValueHEPP: reconstructed.informationCommittedValueHEPP,
      informationGroupValuesHEPP: reconstructed.informationGroupValuesHEPP,
      informationValueHEPP: reconstructed.informationValueHEPP,
      objectiveUtilityHEPP: reconstructed.objectiveUtilityHEPP,
      paretoDimensions: reconstructed.paretoDimensions,
      hardExclusionCodes: Object.freeze([...candidate.hardExclusionCodes]),
      legal: candidate.legal,
      causalContributionColumns: reconstructed.causalContributionColumns,
      paretoWitness: null,
      paretoRank: null,
    });
  }

  function batchRankCompare(left, right) {
    for (const [field, direction] of PARETO_DIMENSIONS) {
      const leftValue = left.paretoDimensions[field];
      const rightValue = right.paretoDimensions[field];
      if (leftValue !== rightValue) {
        if (direction === 'MAXIMIZE') return leftValue > rightValue ? -1 : 1;
        return leftValue < rightValue ? -1 : 1;
      }
    }
    return compareUtf16(left.candidateId, right.candidateId);
  }

  function batchParetoWitnessFor(vector, vectors) {
    if (vector.legal !== true || vector.hardExclusionCodes.length) {
      return freeze({
        kind: 'HARD_EXCLUDED',
        hardExclusionCodes: Object.freeze([...vector.hardExclusionCodes]),
      });
    }
    const eligible = vectors.filter(candidate => candidate.legal === true && candidate.hardExclusionCodes.length === 0);
    const dominators = eligible
      .filter(candidate => candidate !== vector && vectorDominates(candidate, vector))
      .sort(batchRankCompare);
    return dominators.length
      ? freeze({ kind: 'DOMINATED', dominatorCandidateId: dominators[0].candidateId })
      : freeze({ kind: 'NON_DOMINATED' });
  }

  function evaluateAllCandidatesBatch(session, observerId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION || session.batchMode !== true) {
      fatal('R9V2_KERNEL_BATCH_SESSION_SCHEMA_MISMATCH');
    }
    if (stringValue(observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING') !== session.beliefOverlay.observerId) {
      fatal('R9V2_KERNEL_OBSERVER_MISMATCH');
    }
    const eligibleCandidateIds = new Set(
      session.candidates
        .filter(candidate => candidate.legal === true && candidate.hardExclusionCodes.length === 0)
        .map(candidate => candidate.candidateId),
    );
    const vectors = session.candidates.map((candidate, candidateIndex) => {
      const cached = session.batchVectorStore.get(candidate.candidateId);
      if (cached) {
        session.metrics.batchCacheHits += 1;
        return cached;
      }
      const vector = evaluateBatchCandidate(session, candidate, candidateIndex, eligibleCandidateIds);
      session.batchVectorStore.set(candidate.candidateId, vector);
      session.metrics.batchEvaluations += 1;
      return vector;
    });
    if (!session.batchParetoDirty && session.lastBatchVectors) return session.lastBatchVectors;
    const eligible = vectors.filter(candidate => candidate.legal === true && candidate.hardExclusionCodes.length === 0);
    const pareto = eligible.filter(vector => !eligible.some(candidate => candidate !== vector && vectorDominates(candidate, vector)));
    const rankByCandidateId = new Map(
      pareto.slice().sort(batchRankCompare).map((vector, index) => [vector.candidateId, index + 1]),
    );
    const decorated = vectors.map(vector => freeze({
      ...vector,
      paretoWitness: batchParetoWitnessFor(vector, vectors),
      paretoRank: rankByCandidateId.get(vector.candidateId) || null,
    }));
    decorated.forEach(vector => session.batchVectorStore.set(vector.candidateId, vector));
    session.lastBatchVectors = Object.freeze(decorated);
    session.batchParetoDirty = false;
    session.metrics.batchParetoReassemblies += 1;
    return session.lastBatchVectors;
  }

  function evaluateAllCandidates(session, observerId) {
    if (session?.batchMode === true) return evaluateAllCandidatesBatch(session, observerId);
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

  function evaluateAllCandidatesVectorFirst(session, observerId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    if (stringValue(observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING') !== session.beliefOverlay.observerId) fatal('R9V2_KERNEL_OBSERVER_MISMATCH');
    const vectors = session.candidates.map(candidate => {
      const cached = session.vectorFirstBaseStore.get(candidate.candidateId);
      if (cached) {
        session.metrics.vectorFirstCacheHits += 1;
        return cached;
      }
      const vector = evaluateVectorFirstCandidate(session, candidate);
      session.vectorFirstBaseStore.set(candidate.candidateId, vector);
      session.metrics.vectorFirstEvaluations += 1;
      return vector;
    });
    if (!session.vectorFirstParetoDirty && session.vectorFirstLastEvaluatedVectors) {
      return session.vectorFirstLastEvaluatedVectors;
    }
    const decorated = vectors.map(vector => freeze({
      ...vector,
      paretoWitness: paretoWitnessFor(vector, vectors),
    }));
    decorated.forEach(vector => session.vectorFirstStore.set(vector.candidateId, vector));
    session.vectorFirstLastEvaluatedVectors = Object.freeze(decorated);
    session.vectorFirstParetoDirty = false;
    return session.vectorFirstLastEvaluatedVectors;
  }

  function scalarParetoValues(candidateId, components) {
    const values = {};
    for (const component of arrayValue(components || [], 'R9V2_KERNEL_SCALAR_PARETO_COMPONENTS_NOT_ARRAY')) {
      const code = stringValue(component?.dimensionCode, 'R9V2_KERNEL_SCALAR_PARETO_COMPONENT_CODE_MISSING');
      if (!PARETO_COMPONENT_CODES.has(code) || Object.hasOwn(values, code)) {
        fatal('R9V2_KERNEL_SCALAR_PARETO_COMPONENT_UNKNOWN', `${candidateId}:${code}`);
      }
      values[code] = finite(component?.value, 'R9V2_KERNEL_SCALAR_PARETO_COMPONENT_NON_FINITE', `${candidateId}:${code}`);
    }
    for (const code of PARETO_COMPONENT_CODES) {
      if (!Object.hasOwn(values, code)) fatal('R9V2_KERNEL_SCALAR_PARETO_COMPONENT_MISSING', `${candidateId}:${code}`);
    }
    return values;
  }

  function evaluateScalarGraphCandidate(session, candidate) {
    if (!session.rawMode || typeof session.componentRegistry.evaluateScalarComponents !== 'function') {
      fatal('R9V2_KERNEL_SCALAR_COMPONENT_REGISTRY_MISSING');
    }
    const result = session.componentRegistry.evaluateScalarComponents({
      candidate,
      session,
      factDeltas: Object.freeze(session.factDeltas.slice()),
      componentCodes: session.componentCodes,
    });
    if (!result || typeof result !== 'object') fatal('R9V2_KERNEL_SCALAR_COMPONENT_RESULT_INVALID', candidate.candidateId);
    const totals = result.scalarOwnerTotals || {};
    const stateDeltaTotal = finite(totals.STATE_DELTA, 'R9V2_KERNEL_SCALAR_STATE_DELTA_NON_FINITE', candidate.candidateId);
    const actionPoolDeltaTotal = finite(totals.ACTION_POOL_DELTA, 'R9V2_KERNEL_SCALAR_ACTION_POOL_DELTA_NON_FINITE', candidate.candidateId);
    const terminalDeltaTotal = finite(totals.TERMINAL_DELTA, 'R9V2_KERNEL_SCALAR_TERMINAL_DELTA_NON_FINITE', candidate.candidateId);
    const noneTotal = finite(totals.NONE || 0, 'R9V2_KERNEL_SCALAR_NONE_DELTA_NON_FINITE', candidate.candidateId);
    if (Math.abs(noneTotal) > 1e-9) fatal('R9V2_KERNEL_NONE_OWNER_NONZERO', candidate.candidateId);
    const informationGroups = arrayValue(result.informationComponents || [], 'R9V2_KERNEL_SCALAR_INFORMATION_COMPONENTS_NOT_ARRAY');
    assertRawInputValueFree(informationGroups, `${candidate.candidateId}:informationComponents`);
    const paretoValues = scalarParetoValues(candidate.candidateId, result.paretoComponents);
    const unsupported = arrayValue(result.unsupportedOutcomeKinds || [], 'R9V2_KERNEL_SCALAR_UNSUPPORTED_NOT_ARRAY').map(String);
    if (unsupported.length) fatal('R9V2_KERNEL_UNSUPPORTED_FACT', `${candidate.candidateId}:${unsupported.join(',')}`);
    const vector = materializeVector({
      ...candidate,
      stateDeltaTotal,
      actionPoolDeltaTotal,
      terminalDeltaTotal,
      informationGroups,
      ...paretoValues,
      causalFacts: undefined,
    });
    return freeze({
      ...vector,
      valueSource: 'DECISION_VALUE_GRAPH_SCALAR_V1',
      causalOwnerTotals: Object.freeze({ stateDeltaTotal, actionPoolDeltaTotal, terminalDeltaTotal }),
      causalContributionColumns: null,
    });
  }

  function evaluateAllCandidatesScalarGraph(session, observerId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    if (stringValue(observerId, 'R9V2_KERNEL_OBSERVER_ID_MISSING') !== session.beliefOverlay.observerId) fatal('R9V2_KERNEL_OBSERVER_MISMATCH');
    const vectors = session.candidates.map(candidate => {
      const cached = session.scalarGraphBaseStore.get(candidate.candidateId);
      if (cached) {
        session.metrics.scalarGraphCacheHits += 1;
        return cached;
      }
      const vector = evaluateScalarGraphCandidate(session, candidate);
      session.scalarGraphBaseStore.set(candidate.candidateId, vector);
      session.metrics.scalarGraphEvaluations += 1;
      return vector;
    });
    if (!session.scalarGraphParetoDirty && session.scalarGraphLastEvaluatedVectors) return session.scalarGraphLastEvaluatedVectors;
    const decorated = vectors.map(vector => freeze({ ...vector, paretoWitness: paretoWitnessFor(vector, vectors) }));
    decorated.forEach(vector => session.scalarGraphStore.set(vector.candidateId, vector));
    session.scalarGraphLastEvaluatedVectors = Object.freeze(decorated);
    session.scalarGraphParetoDirty = false;
    session.metrics.paretoReassemblies += 1;
    return session.scalarGraphLastEvaluatedVectors;
  }

  function assertScalarProofEquality(vector, proofVector) {
    for (const field of ['stateDeltaTotal', 'actionPoolDeltaTotal', 'terminalDeltaTotal', 'goalUtilityDeltaHEPP', 'informationValueHEPP', 'objectiveUtilityHEPP']) {
      if (Math.abs(vector[field] - proofVector[field]) > 1e-9) fatal('R9V2_KERNEL_SCALAR_PROOF_VALUE_MISMATCH', `${vector.candidateId}:${field}`);
    }
    for (const [field] of PARETO_DIMENSIONS) {
      if (Math.abs(vector.paretoDimensions[field] - proofVector.paretoDimensions[field]) > 1e-9) fatal('R9V2_KERNEL_SCALAR_PROOF_PARETO_MISMATCH', `${vector.candidateId}:${field}`);
    }
  }

  function materializeProofFromScalarGraph(session, candidateId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    const id = stringValue(candidateId, 'R9V2_KERNEL_PROOF_CANDIDATE_ID_MISSING');
    const cached = session.scalarGraphProofStore.get(id);
    if (cached) return cached;
    const vector = session.scalarGraphStore.get(id) || evaluateAllCandidatesScalarGraph(session, session.beliefOverlay.observerId).find(item => item.candidateId === id);
    const candidate = session.candidates.find(item => item.candidateId === id);
    if (!vector || !candidate) fatal('R9V2_KERNEL_PROOF_CANDIDATE_MISSING', id);
    const proofCandidate = session.computedCandidateStore.get(id) || evaluateComponentCandidate(session, candidate);
    session.computedCandidateStore.set(id, proofCandidate);
    const proofVector = materializeVector(proofCandidate);
    assertScalarProofEquality(vector, proofVector);
    const proof = freeze({
      schemaVersion: 'CandidateValueProofV1',
      candidateId: id,
      vector: proofVector,
      goalUtilityDeltaHEPP: proofVector.goalUtilityDeltaHEPP,
      informationValueHEPP: proofVector.informationValueHEPP,
      objectiveUtilityHEPP: proofVector.objectiveUtilityHEPP,
      causalValueFacts: proofVector.causalFacts,
      source: Object.freeze({ worldRevision: session.worldRevision, beliefRevision: session.beliefRevision, opportunityRevision: session.opportunityRevision, sessionRevision: session.revision }),
    });
    session.scalarGraphProofStore.set(id, proof);
    session.metrics.scalarGraphProofsMaterialized += 1;
    return proof;
  }

  function materializeProofFromVectorFirst(session, candidateId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION) fatal('R9V2_KERNEL_SESSION_SCHEMA_MISMATCH');
    const id = stringValue(candidateId, 'R9V2_KERNEL_PROOF_CANDIDATE_ID_MISSING');
    const cached = session.vectorFirstProofStore.get(id);
    if (cached) return cached;
    const vector = session.vectorFirstStore.get(id) || evaluateAllCandidatesVectorFirst(session, session.beliefOverlay.observerId)
      .find(item => item.candidateId === id);
    const candidate = session.candidates.find(item => item.candidateId === id);
    if (!vector || !candidate) fatal('R9V2_KERNEL_PROOF_CANDIDATE_MISSING', id);
    const proofCandidate = session.computedCandidateStore.get(id) || evaluateComponentCandidate(session, candidate);
    session.computedCandidateStore.set(id, proofCandidate);
    const proofVector = materializeVector(proofCandidate);
    assertVectorProofEquality(vector, proofVector);
    const proof = freeze({
      schemaVersion: 'CandidateValueProofV1',
      candidateId: id,
      vector: proofVector,
      goalUtilityDeltaHEPP: proofVector.goalUtilityDeltaHEPP,
      informationValueHEPP: proofVector.informationValueHEPP,
      objectiveUtilityHEPP: proofVector.objectiveUtilityHEPP,
      causalValueFacts: proofVector.causalFacts,
      source: Object.freeze({
        worldRevision: session.worldRevision,
        beliefRevision: session.beliefRevision,
        opportunityRevision: session.opportunityRevision,
        sessionRevision: session.revision,
      }),
    });
    session.vectorFirstProofStore.set(id, proof);
    session.metrics.vectorFirstProofsMaterialized += 1;
    return proof;
  }

  function applyBatchFactDelta(session, expectedRevision, delta = {}) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION || session.batchMode !== true) {
      fatal('R9V2_KERNEL_BATCH_SESSION_SCHEMA_MISMATCH');
    }
    if (strictFinite(expectedRevision, 'R9V2_KERNEL_REVISION_NON_FINITE') !== session.revision) {
      fatal('R9V2_KERNEL_REVISION_MISMATCH');
    }
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
      fatal('R9V2_KERNEL_BATCH_FACT_DELTA_INVALID');
    }
    const operation = String(delta.operation || '').trim().toUpperCase();
    if (!['SET', 'ADD'].includes(operation)) {
      fatal('R9V2_KERNEL_BATCH_FACT_DELTA_OPERATION_UNKNOWN', operation);
    }
    if (
      String(delta.entityType || '').trim() !== 'BEHAVIOR_POOL_FACT' ||
      String(delta.fieldCode || '').trim() !== 'valueHEPP'
    ) {
      fatal('R9V2_KERNEL_BATCH_FACT_DELTA_UNEXPRESSIBLE', `${delta.entityType || ''}:${delta.fieldCode || ''}`);
    }
    const candidateId = stringValue(delta.entityId, 'R9V2_KERNEL_FACT_DELTA_ENTITY_ID_MISSING');
    const candidateIndex = session.candidateIndexById.get(candidateId);
    if (candidateIndex === undefined) fatal('R9V2_KERNEL_BATCH_FACT_CANDIDATE_MISSING', candidateId);
    const range = session.behaviorPoolColumns.candidateFactRanges[candidateIndex];
    let factIndex = null;
    if (!Object.hasOwn(delta, 'sourceFactIndex')) fatal('R9V2_KERNEL_BATCH_FACT_INDEX_MISSING', candidateId);
    const sourceFactIndex = strictFinite(delta.sourceFactIndex, 'R9V2_KERNEL_BATCH_FACT_INDEX_NON_FINITE');
    if (!Number.isInteger(sourceFactIndex) || sourceFactIndex < 0 || sourceFactIndex >= session.behaviorPoolColumns.sourceFactIds.length) {
      fatal('R9V2_KERNEL_BATCH_FACT_INDEX_OUT_OF_RANGE', candidateId);
    }
    const matchingIndexes = [];
    for (let index = range[0]; index < range[1]; index += 1) {
      if (session.behaviorPoolColumns.sourceFactIndex[index] === sourceFactIndex) matchingIndexes.push(index);
    }
    if (matchingIndexes.length !== 1) fatal('R9V2_KERNEL_BATCH_FACT_INDEX_NOT_FOUND', candidateId);
    factIndex = matchingIndexes[0];
    if (factIndex === null) fatal('R9V2_KERNEL_BATCH_FACT_INDEX_MISSING', candidateId);
    const currentValue = session.behaviorPoolColumns.valueHEPP[factIndex];
    if (!Object.hasOwn(delta, 'beforeValue')) fatal('R9V2_KERNEL_BATCH_FACT_BEFORE_MISSING', candidateId);
    const beforeValue = strictFinite(delta.beforeValue, 'R9V2_KERNEL_BATCH_FACT_BEFORE_NON_FINITE', candidateId);
    if (Math.abs(beforeValue - currentValue) > CAUSAL_TOLERANCE) {
      fatal('R9V2_KERNEL_BATCH_FACT_BEFORE_MISMATCH', candidateId);
    }
    const expectedSourceFactId = session.behaviorPoolColumns.sourceFactIds[sourceFactIndex];
    const expectedSourceEventId = session.behaviorPoolColumns.sourceEventIds[
      session.behaviorPoolColumns.sourceEventIndex[factIndex]
    ];
    const sourceEventId = stringValue(delta.sourceEventId, 'R9V2_KERNEL_FACT_DELTA_EVENT_MISSING');
    const sourceFactId = stringValue(delta.sourceFactId, 'R9V2_KERNEL_FACT_DELTA_FACT_MISSING');
    if (sourceFactId !== expectedSourceFactId || sourceEventId !== expectedSourceEventId) {
      fatal('R9V2_KERNEL_BATCH_FACT_IDENTITY_MISMATCH', candidateId);
    }
    const afterValue = strictFinite(delta.afterValue, 'R9V2_KERNEL_BATCH_FACT_AFTER_NON_FINITE', candidateId);
    const nextValue = operation === 'ADD' ? sum([currentValue, afterValue]) : afterValue;
    const ownerCode = session.behaviorPoolColumns.causalOwnerTypeCode[factIndex];
    if (ownerCode === OWNER_TYPE_CODES.NONE && nextValue !== 0) {
      fatal('R9V2_KERNEL_NONE_OWNER_NONZERO', candidateId);
    }
    if (session.behaviorPoolColumns.postTerminalFlags[factIndex] && Math.abs(nextValue) > CAUSAL_TOLERANCE) {
      fatal('R9V2_KERNEL_BATCH_POST_TERMINAL_NONZERO', candidateId);
    }
    const dependencyTokens = arrayValue(
      Object.hasOwn(delta, 'dependencyTokens') ? delta.dependencyTokens : null,
      'R9V2_KERNEL_FACT_DELTA_DEPENDENCIES_NOT_ARRAY',
    ).map((value, index) => stringValue(value, 'R9V2_KERNEL_FACT_DELTA_DEPENDENCY_MISSING', String(index)));
    if (new Set(dependencyTokens).size !== dependencyTokens.length) fatal('R9V2_KERNEL_FACT_DELTA_DEPENDENCY_DUPLICATE', candidateId);
    const unknownDependency = dependencyTokens.some(token => !session.dependencyOwners.has(token));
    const dirtyCandidateIds = new Set([candidateId]);
    dependencyTokens.forEach(token => session.dependencyOwners.get(token)?.forEach(id => dirtyCandidateIds.add(id)));
    const fullRebuildRequired = unknownDependency || dependencyTokens.length === 0;
    if (fullRebuildRequired) session.candidates.forEach(candidate => dirtyCandidateIds.add(candidate.candidateId));
    const invalidatedComponentCodes = Object.freeze(['BEHAVIOR_POOL_COLUMNS']);
    const nextColumnsInput = clone(session.behaviorPoolColumns);
    nextColumnsInput.valueHEPP[factIndex] = nextValue;
    const nextColumns = normalizeBehaviorPoolColumns(
      {
        behaviorPoolColumns: nextColumnsInput,
        worldRevision: session.worldRevision,
        opportunityRevision: session.opportunityRevision,
      },
      session.candidateIds,
    );
    const nextRange = nextColumns.candidateFactRanges[candidateIndex];
    let nextFactPoolIndex = -1;
    for (let index = nextRange[0]; index < nextRange[1]; index += 1) {
      if (nextColumns.sourceFactIndex[index] === sourceFactIndex) {
        nextFactPoolIndex = index;
        break;
      }
    }
    if (nextFactPoolIndex < 0 || Math.abs(nextColumns.valueHEPP[nextFactPoolIndex] - nextValue) > 1e-12) {
      fatal('R9V2_KERNEL_BATCH_FACT_DELTA_REBUILD_MISMATCH', candidateId);
    }
    session.behaviorPoolColumns = nextColumns;
    session.revision += 1;
    session.factDeltas.push(freeze({
      schemaVersion: 'FactDeltaV1',
      baseRevision: expectedRevision,
      operation,
      entityType: 'BEHAVIOR_POOL_FACT',
      entityId: candidateId,
      fieldCode: 'valueHEPP',
      sourceFactIndex,
      beforeValue: currentValue,
      afterValue: nextValue,
      sourceEventId,
      sourceFactId,
      dependencyTokens,
      invalidatedComponentCodes,
    }));
    for (const dirtyCandidateId of dirtyCandidateIds) {
      session.batchVectorStore.delete(dirtyCandidateId);
    }
    session.batchProofStore.clear();
    session.lastBatchVectors = null;
    session.batchParetoDirty = true;
    session.metrics.factDeltaApplications += 1;
    session.metrics.dirtyCandidateRebuilds += dirtyCandidateIds.size;
    if (fullRebuildRequired) session.metrics.fullRebuilds += 1;
    return Object.freeze({
      revision: session.revision,
      dirtyCandidateIds: Object.freeze([...dirtyCandidateIds]),
      invalidatedComponentCodes,
      fullRebuildRequired,
    });
  }

  function assertBatchNumberEquality(left, right, code, detail, tolerance = 1e-9) {
    if (typeof left !== 'number' || typeof right !== 'number' || Math.abs(left - right) > tolerance) {
      fatal(code, detail);
    }
  }

  function assertBatchNumberArrayEquality(left, right, code, detail, tolerance = 1e-9) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) fatal(code, detail);
    left.forEach((value, index) => assertBatchNumberEquality(value, right[index], code, `${detail}:${index}`, tolerance));
  }

  function assertBatchFactsEquality(leftFacts, rightFacts, candidateId) {
    if (!Array.isArray(leftFacts) || leftFacts.length !== rightFacts.length) fatal('R9V2_KERNEL_BATCH_PROOF_FACT_COUNT_MISMATCH', candidateId);
    leftFacts.forEach((left, index) => {
      const right = rightFacts[index];
      for (const field of ['componentCode', 'causalOwnerType', 'sourceEventId', 'sourceFactId', 'targetUnitId', 'sourceOutcomeKind']) {
        if (left?.[field] !== right?.[field]) fatal('R9V2_KERNEL_BATCH_PROOF_FACT_MISMATCH', `${candidateId}:${index}:${field}`);
      }
      if (left?.sequence !== right?.sequence || left?.postTerminal !== right?.postTerminal) fatal('R9V2_KERNEL_BATCH_PROOF_FACT_MISMATCH', `${candidateId}:${index}:metadata`);
      assertBatchNumberEquality(left?.valueHEPP, right?.valueHEPP, 'R9V2_KERNEL_BATCH_PROOF_FACT_VALUE_MISMATCH', `${candidateId}:${index}`, CAUSAL_TOLERANCE);
    });
  }

  function assertBatchVectorMatchesReconstruction(vector, reconstructed, candidate, candidateId) {
    if (vector.valueSource !== 'BEHAVIOR_POOL_COLUMNS_V1' || vector.mechanicalSource !== candidate.mechanicalSource) {
      fatal('R9V2_KERNEL_BATCH_PROOF_SOURCE_MISMATCH', candidateId);
    }
    for (const field of ['stateDeltaTotal', 'actionPoolDeltaTotal', 'terminalDeltaTotal', 'worstTailUtilityHEPP', 'survivalUtilityHEPP', 'assetReserveHEPP', 'discardedOverkillPP']) {
      assertBatchNumberEquality(
        vector.componentTotals?.[field],
        field in reconstructed ? reconstructed[field] : reconstructed.paretoInputs[field],
        'R9V2_KERNEL_BATCH_PROOF_COMPONENT_TOTAL_MISMATCH',
        `${candidateId}:${field}`,
      );
    }
    for (const field of ['stateDeltaTotal', 'actionPoolDeltaTotal', 'terminalDeltaTotal', 'goalUtilityDeltaHEPP', 'informationValueHEPP', 'objectiveUtilityHEPP']) {
      assertBatchNumberEquality(vector[field], reconstructed[field], 'R9V2_KERNEL_BATCH_PROOF_VECTOR_MISMATCH', `${candidateId}:${field}`);
    }
    for (const [field] of PARETO_DIMENSIONS) {
      assertBatchNumberEquality(vector.paretoDimensions?.[field], reconstructed.paretoDimensions[field], 'R9V2_KERNEL_BATCH_PROOF_PARETO_MISMATCH', `${candidateId}:${field}`);
    }
    for (const field of ['informationAdaptiveValueHEPP', 'informationCommittedValueHEPP']) {
      assertBatchNumberEquality(vector[field], reconstructed[field], 'R9V2_KERNEL_BATCH_PROOF_INFORMATION_MISMATCH', `${candidateId}:${field}`);
    }
    assertBatchNumberArrayEquality(
      vector.informationGroupValuesHEPP,
      reconstructed.informationGroupValuesHEPP,
      'R9V2_KERNEL_BATCH_PROOF_INFORMATION_GROUP_MISMATCH',
      candidateId,
    );
    if (JSON.stringify(vector.candidateMetadata) !== JSON.stringify(reconstructed.candidateMetadata)) fatal('R9V2_KERNEL_BATCH_PROOF_METADATA_MISMATCH', `${candidateId}:candidate`);
    if (JSON.stringify(vector.firstTerminalMetadata) !== JSON.stringify(reconstructed.firstTerminalMetadata)) fatal('R9V2_KERNEL_BATCH_PROOF_TERMINAL_METADATA_MISMATCH', candidateId);
    if (JSON.stringify(vector.factRanges) !== JSON.stringify(reconstructed.factRanges)) fatal('R9V2_KERNEL_BATCH_PROOF_FACT_RANGES_MISMATCH', candidateId);
    for (const field of ['stateDeltaTotal', 'actionPoolDeltaTotal', 'terminalDeltaTotal']) {
      assertBatchNumberEquality(
        vector.causalOwnerTotals?.[field],
        reconstructed.causalOwnerTotals?.[field],
        'R9V2_KERNEL_BATCH_PROOF_OWNER_TOTAL_MISMATCH',
        `${candidateId}:${field}`,
        CAUSAL_TOLERANCE,
      );
    }
    for (const domain of SEMANTIC_DOMAINS) {
      for (const ownerType of OWNER_TYPE_NAMES) {
        assertBatchNumberEquality(
          vector.ownerTotalsBySemanticDomain?.[domain]?.[ownerType],
          reconstructed.ownerTotalsBySemanticDomain?.[domain]?.[ownerType],
          'R9V2_KERNEL_BATCH_PROOF_DOMAIN_TOTAL_MISMATCH',
          `${candidateId}:${domain}:${ownerType}`,
          CAUSAL_TOLERANCE,
        );
      }
    }
    for (const field of ['worstTailUtilityHEPP', 'survivalUtilityHEPP', 'assetReserveHEPP', 'discardedOverkillPP']) {
      assertBatchNumberEquality(vector.paretoInputs?.[field], reconstructed.paretoInputs?.[field], 'R9V2_KERNEL_BATCH_PROOF_PARETO_INPUT_MISMATCH', `${candidateId}:${field}`);
    }
    assertBatchFactsEquality(vector.causalFacts, reconstructed.causalFacts, candidateId);
    if (!Array.isArray(vector.outcomeRows) || vector.outcomeRows.length !== reconstructed.outcomeRows.length) fatal('R9V2_KERNEL_BATCH_PROOF_OUTCOME_ROWS_MISMATCH', candidateId);
    vector.outcomeRows.forEach((left, index) => {
      const right = reconstructed.outcomeRows[index];
      if (JSON.stringify({ ...left, probability: undefined }) !== JSON.stringify({ ...right, probability: undefined })) {
        fatal('R9V2_KERNEL_BATCH_PROOF_OUTCOME_ROWS_MISMATCH', `${candidateId}:${index}`);
      }
      assertBatchNumberEquality(left?.probability, right?.probability, 'R9V2_KERNEL_BATCH_PROOF_OUTCOME_PROBABILITY_MISMATCH', `${candidateId}:${index}`, PROBABILITY_TOLERANCE);
    });
    if (JSON.stringify(vector.primaryOutcomeGroups) !== JSON.stringify(reconstructed.primaryOutcomeGroups)) fatal('R9V2_KERNEL_BATCH_PROOF_PRIMARY_GROUPS_MISMATCH', candidateId);
    const leftColumns = vector.causalContributionColumns;
    const rightColumns = reconstructed.causalContributionColumns;
    for (const key of ['componentCodeIndex', 'causalOwnerTypeCode', 'sourceEventIndex', 'sourceFactIndex', 'factTargetIndex', 'sourceOutcomeKind', 'postTerminalFlags', 'sequence', 'valueHEPP']) {
      if (key === 'valueHEPP') {
        assertBatchNumberArrayEquality(leftColumns?.[key], rightColumns?.[key], 'R9V2_KERNEL_BATCH_PROOF_COLUMN_MISMATCH', `${candidateId}:${key}`, CAUSAL_TOLERANCE);
      } else if (JSON.stringify(leftColumns?.[key]) !== JSON.stringify(rightColumns?.[key])) {
        fatal('R9V2_KERNEL_BATCH_PROOF_COLUMN_MISMATCH', `${candidateId}:${key}`);
      }
    }
    if (vector.legal !== candidate.legal || JSON.stringify(vector.hardExclusionCodes) !== JSON.stringify(candidate.hardExclusionCodes)) fatal('R9V2_KERNEL_BATCH_PROOF_LEGALITY_MISMATCH', candidateId);
  }

  function materializeBatchProof(session, candidateId) {
    if (!session || session.schemaVersion !== SCHEMA_VERSION || session.batchMode !== true) fatal('R9V2_KERNEL_BATCH_SESSION_SCHEMA_MISMATCH');
    const id = stringValue(candidateId, 'R9V2_KERNEL_PROOF_CANDIDATE_ID_MISSING');
    if (session.batchParetoDirty) evaluateAllCandidatesBatch(session, session.beliefOverlay.observerId);
    const vector = session.batchVectorStore.get(id);
    const candidateIndex = session.candidateIndexById.get(id);
    const candidate = candidateIndex === undefined ? null : session.candidates[candidateIndex];
    if (!vector || !candidate) fatal('R9V2_KERNEL_PROOF_VECTOR_NOT_EVALUATED', id);
    const eligibleCandidateIds = new Set(
      session.candidates.filter(item => item.legal === true && item.hardExclusionCodes.length === 0).map(item => item.candidateId),
    );
    const reconstructed = batchReconstructCandidate(session, candidateIndex, eligibleCandidateIds);
    assertBatchVectorMatchesReconstruction(vector, reconstructed, candidate, id);
    const proofVector = freeze({
      schemaVersion: 'CandidateValueVectorV1',
      candidateId: id,
      valueSource: 'BEHAVIOR_POOL_COLUMNS_V1',
      mechanicalSource: candidate.mechanicalSource,
      componentTotals: Object.freeze({
        stateDeltaTotal: reconstructed.stateDeltaTotal,
        actionPoolDeltaTotal: reconstructed.actionPoolDeltaTotal,
        terminalDeltaTotal: reconstructed.terminalDeltaTotal,
        ...reconstructed.paretoInputs,
      }),
      causalOwnerTotals: reconstructed.causalOwnerTotals,
      ownerTotalsBySemanticDomain: reconstructed.ownerTotalsBySemanticDomain,
      candidateMetadata: reconstructed.candidateMetadata,
      firstTerminalMetadata: reconstructed.firstTerminalMetadata,
      factRanges: reconstructed.factRanges,
      causalFacts: reconstructed.causalFacts,
      outcomeRows: reconstructed.outcomeRows,
      primaryOutcomeGroups: reconstructed.primaryOutcomeGroups,
      paretoInputs: reconstructed.paretoInputs,
      stateDeltaTotal: reconstructed.stateDeltaTotal,
      actionPoolDeltaTotal: reconstructed.actionPoolDeltaTotal,
      terminalDeltaTotal: reconstructed.terminalDeltaTotal,
      goalUtilityDeltaHEPP: reconstructed.goalUtilityDeltaHEPP,
      informationAdaptiveValueHEPP: reconstructed.informationAdaptiveValueHEPP,
      informationCommittedValueHEPP: reconstructed.informationCommittedValueHEPP,
      informationGroupValuesHEPP: reconstructed.informationGroupValuesHEPP,
      informationValueHEPP: reconstructed.informationValueHEPP,
      objectiveUtilityHEPP: reconstructed.objectiveUtilityHEPP,
      paretoDimensions: reconstructed.paretoDimensions,
      hardExclusionCodes: Object.freeze([...candidate.hardExclusionCodes]),
      legal: candidate.legal,
      causalContributionColumns: reconstructed.causalContributionColumns,
      paretoWitness: vector.paretoWitness,
      paretoRank: vector.paretoRank,
    });
    const proof = freeze({
      schemaVersion: 'CandidateValueProofV1',
      candidateId: id,
      vector: proofVector,
      goalUtilityDeltaHEPP: reconstructed.goalUtilityDeltaHEPP,
      informationValueHEPP: reconstructed.informationValueHEPP,
      objectiveUtilityHEPP: reconstructed.objectiveUtilityHEPP,
      causalValueFacts: reconstructed.causalFacts,
      candidateMetadata: reconstructed.candidateMetadata,
      outcomeRows: reconstructed.outcomeRows,
      primaryOutcomeGroups: reconstructed.primaryOutcomeGroups,
      firstTerminalMetadata: reconstructed.firstTerminalMetadata,
      factRanges: reconstructed.factRanges,
      ownerTotalsBySemanticDomain: reconstructed.ownerTotalsBySemanticDomain,
      paretoInputs: reconstructed.paretoInputs,
      source: Object.freeze({
        worldRevision: session.worldRevision,
        beliefRevision: session.beliefRevision,
        opportunityRevision: session.opportunityRevision,
        sessionRevision: session.revision,
      }),
    });
    const cached = session.batchProofStore.get(id);
    if (cached) {
      if (JSON.stringify(cached.vector) !== JSON.stringify(proof.vector)) fatal('R9V2_KERNEL_BATCH_PROOF_CACHE_TAMPERED', id);
      return cached;
    }
    session.batchProofStore.set(id, proof);
    session.metrics.batchProofsMaterialized += 1;
    return proof;
  }

  function applyFactDelta(session, expectedRevision, delta = {}) {
    if (session?.batchMode === true) return applyBatchFactDelta(session, expectedRevision, delta);
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
      session.vectorFirstStore.delete(candidateId);
      session.vectorFirstBaseStore.delete(candidateId);
      session.vectorFirstProofStore.delete(candidateId);
      session.scalarGraphStore.delete(candidateId);
      session.scalarGraphBaseStore.delete(candidateId);
      session.scalarGraphProofStore.delete(candidateId);
      const invalidated = session.invalidatedComponentsByCandidate.get(candidateId) || new Set();
      invalidatedComponentCodes.forEach(code => invalidated.add(code));
      session.invalidatedComponentsByCandidate.set(candidateId, invalidated);
    }
    session.paretoDirty = true;
    session.vectorFirstParetoDirty = true;
    session.scalarGraphParetoDirty = true;
    session.scalarGraphLastEvaluatedVectors = null;
    session.decisionValueGraphStore.clear();
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
    if (session?.batchMode === true) return materializeBatchProof(session, candidateId);
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
    batchCalculationMode: BATCH_CALCULATION_MODE,
    paretoDimensions: PARETO_DIMENSIONS,
    createSession,
    evaluateAllCandidates,
    evaluateAllCandidatesVectorFirst,
    applyFactDelta,
    materializeProof,
    materializeProofFromVectorFirst,
    evaluateAllCandidatesScalarGraph,
    materializeProofFromScalarGraph,
  });
  if (root.__LWCS_BATTLE_R9V2_KERNEL__) fatal('R9V2_KERNEL_DUPLICATE_LOAD');
  root.__LWCS_BATTLE_R9V2_KERNEL__ = api;
})();

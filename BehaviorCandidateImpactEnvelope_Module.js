// BehaviorCandidateImpactEnvelope_Module.js
// Current-step public impact carrier. It never reads another module or a runtime.
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 'BehaviorCandidateImpactEnvelopeV1';
  const CONTRACT_HASH = '7a575aa29a30403719374cde3c6db763f0df0368025e6542beed1093589318b4';
  const SCHEMA_HASH = 'f05bcb34afc82922bda3e965213b2af6d85483e605159b8752e61ca037ff4b77';
  const SUM_TOLERANCE = 1e-12;
  const STATUSES = new Set(['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE']);
  const CAUSAL_OWNERS = new Set(['STATE_DELTA', 'ACTION_POOL_DELTA', 'TERMINAL_DELTA', 'NONE']);
  const UNIT_FAMILIES = new Set([
    'COUNT', 'ABS', 'POWER', 'PERCENT', 'RATIO_0_1', 'PROBABILITY_0_1',
    'TURNS', 'BOOL', 'ENUM', 'RATIO',
  ]);
  const FORBIDDEN_KEYS = /^(?:futureWorld|futureRoute|futureRouteTree|routeTree|runtimeRealized|realizedOutcome|hiddenIntent|topK|renormalized|renormalize|skillName|roleName)$/iu;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function fail(code, path) {
    const error = new Error(code + (path ? ':' + path : ''));
    error.code = code;
    throw error;
  }

  function plainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.prototype.toString.call(value) !== '[object Object]') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || (typeof prototype === 'object' && prototype.constructor?.name === 'Object');
  }

  function ensurePlain(value, path) {
    if (!plainObject(value)) fail('PLAIN_OBJECT_REQUIRED', path);
  }

  function ensureKeys(value, allowed, path) {
    ensurePlain(value, path);
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(value)) {
      if (!allowedSet.has(key)) fail('CLOSED_SHAPE_EXTRA_KEY', path + '.' + key);
    }
  }

  function opaqueId(value, path) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) {
      fail('OPAQUE_ID_INVALID', path);
    }
    return value;
  }

  function reasonCode(value, path) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 128 || !/^[A-Z0-9:_-]+$/u.test(value)) {
      fail('REASON_CODE_INVALID', path);
    }
    return value;
  }

  function hash(value, path) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) fail('HASH_INVALID', path);
    return value;
  }

  function finite(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('FINITE_NUMBER_REQUIRED', path);
    return Object.is(value, -0) ? 0 : value;
  }

  function probability(value, path) {
    value = finite(value, path);
    if (value < 0 || value > 1) fail('PROBABILITY_OUT_OF_RANGE', path);
    return value;
  }

  function idArray(value, path, required) {
    if (!Array.isArray(value) || (required && value.length === 0)) fail('ID_ARRAY_INVALID', path);
    const result = value.map((item, index) => opaqueId(item, path + '[' + index + ']'));
    if (new Set(result).size !== result.length) fail('ID_ARRAY_DUPLICATE', path);
    return result;
  }

  function deepFreeze(value, seen) {
    if (value === null || typeof value !== 'object') return value;
    seen = seen || new WeakSet();
    if (seen.has(value)) return value;
    seen.add(value);
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key], seen);
    return value;
  }

  function rejectForbidden(value, path, seen) {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) fail('INPUT_CYCLE', path);
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => rejectForbidden(item, path + '[' + index + ']', seen));
      seen.delete(value);
      return;
    }
    if (!plainObject(value)) fail('PLAIN_OBJECT_REQUIRED', path);
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.test(key)) fail('FORBIDDEN_INPUT_KEY', path + '.' + key);
      rejectForbidden(value[key], path + '.' + key, seen);
    }
    seen.delete(value);
  }

  function normalizeSource(value, path) {
    if (value === undefined) return undefined;
    ensurePlain(value, path);
    ensureKeys(value, ['kind', 'sourceFactIds', 'sourceEventIds', 'modelId', 'modelVersion', 'modelHash', 'inputHash', 'prototypeHash'], path);
    if (value.kind === 'NONE') {
      if (Object.keys(value).length !== 1) fail('NONE_SOURCE_HAS_FIELDS', path);
      return { kind: 'NONE' };
    }
    if (value.kind === 'CURRENT_PUBLIC_MECHANICS') {
      return {
        kind: value.kind,
        sourceFactIds: idArray(value.sourceFactIds, path + '.sourceFactIds', true),
        sourceEventIds: idArray(value.sourceEventIds, path + '.sourceEventIds', true),
      };
    }
    if (value.kind === 'OFFLINE_DISTILLED_MODEL') {
      return {
        kind: value.kind,
        modelId: opaqueId(value.modelId, path + '.modelId'),
        modelVersion: opaqueId(value.modelVersion, path + '.modelVersion'),
        modelHash: hash(value.modelHash, path + '.modelHash'),
        inputHash: hash(value.inputHash, path + '.inputHash'),
        prototypeHash: hash(value.prototypeHash, path + '.prototypeHash'),
      };
    }
    fail('SOURCE_KIND_INVALID', path + '.kind');
  }

  function responseSourceOrUnknown(value, path) {
    if (value === undefined) return { source: undefined, reason: 'MODEL_SOURCE_MISSING' };
    ensurePlain(value, path);
    ensureKeys(value, ['kind', 'sourceFactIds', 'sourceEventIds', 'modelId', 'modelVersion', 'modelHash', 'inputHash', 'prototypeHash'], path);
    if (value.kind === 'NONE') return { source: undefined, reason: 'MODEL_SOURCE_MISSING' };
    if (value.kind === 'OFFLINE_DISTILLED_MODEL') {
      const required = ['modelId', 'modelVersion', 'modelHash', 'inputHash', 'prototypeHash'];
      if (required.some(key => !own(value, key))) return { source: undefined, reason: 'MODEL_INPUT_NOT_CLOSED' };
    }
    if (value.kind === 'CURRENT_PUBLIC_MECHANICS' && (!own(value, 'sourceFactIds') || !own(value, 'sourceEventIds'))) {
      return { source: undefined, reason: 'PUBLIC_INPUT_NOT_CLOSED' };
    }
    return { source: normalizeSource(value, path), reason: 'NONE' };
  }

  function normalizeFactDeltas(value, path) {
    if (!Array.isArray(value)) fail('FACT_DELTA_ARRAY_REQUIRED', path);
    return value.map((row, index) => {
      const rowPath = path + '[' + index + ']';
      ensureKeys(row, ['status', 'targetUnitId', 'sourceFactId', 'sourceEventId', 'causalOwner', 'unitFamily', 'value'], rowPath);
      if (!STATUSES.has(row.status)) fail('FACT_DELTA_STATUS_INVALID', rowPath + '.status');
      const result = {
        status: row.status,
        targetUnitId: opaqueId(row.targetUnitId, rowPath + '.targetUnitId'),
        sourceFactId: opaqueId(row.sourceFactId, rowPath + '.sourceFactId'),
        sourceEventId: opaqueId(row.sourceEventId, rowPath + '.sourceEventId'),
        causalOwner: row.causalOwner,
        unitFamily: row.unitFamily,
      };
      if (!CAUSAL_OWNERS.has(row.causalOwner)) fail('FACT_DELTA_CAUSAL_OWNER_INVALID', rowPath + '.causalOwner');
      if (typeof row.unitFamily !== 'string' || !UNIT_FAMILIES.has(row.unitFamily)) fail('FACT_DELTA_UNIT_FAMILY_INVALID', rowPath + '.unitFamily');
      if (row.status === 'KNOWN') result.value = finite(row.value, rowPath + '.value');
      else if (own(row, 'value')) fail('UNKNOWN_FACT_VALUE_FORBIDDEN', rowPath + '.value');
      return result;
    });
  }

  function normalizeActionPool(value, path) {
    ensureKeys(value, ['status', 'value', 'sourceFactIds', 'sourceEventIds', 'causalOwner'], path);
    if (!STATUSES.has(value.status)) fail('ACTION_POOL_STATUS_INVALID', path + '.status');
    if (value.causalOwner !== 'ACTION_POOL_DELTA') fail('ACTION_POOL_CAUSAL_OWNER_INVALID', path + '.causalOwner');
    const result = {
      status: value.status,
      sourceFactIds: idArray(value.sourceFactIds, path + '.sourceFactIds', true),
      sourceEventIds: idArray(value.sourceEventIds, path + '.sourceEventIds', true),
    };
    if (value.status === 'KNOWN') result.value = finite(value.value, path + '.value');
    else if (own(value, 'value')) fail('UNKNOWN_ACTION_POOL_VALUE_FORBIDDEN', path + '.value');
    return result;
  }

  function normalizeConsumers(value, path) {
    ensureKeys(value, ['status', 'identities', 'sourceFactIds', 'sourceEventIds', 'reason'], path);
    if (!STATUSES.has(value.status)) fail('CONSUMER_STATUS_INVALID', path + '.status');
    const identities = idArray(value.identities, path + '.identities', false);
    const sourceFactIds = idArray(value.sourceFactIds, path + '.sourceFactIds', false);
    const sourceEventIds = idArray(value.sourceEventIds, path + '.sourceEventIds', false);
    if (value.status === 'KNOWN' && (!identities.length || !sourceFactIds.length || !sourceEventIds.length)) fail('KNOWN_CONSUMER_PROVENANCE_REQUIRED', path);
    if (value.status !== 'KNOWN' && identities.length) fail('UNKNOWN_CONSUMER_IDENTITY_FORBIDDEN', path + '.identities');
    const result = { status: value.status, identities, sourceFactIds, sourceEventIds };
    if (value.status !== 'KNOWN') result.reason = reasonCode(value.reason, path + '.reason');
    return result;
  }

  function normalizePublicEvidence(value, path) {
    ensureKeys(value, ['status', 'beliefRevision', 'sourceFactIds', 'sourceEventIds'], path);
    if (value.status !== 'KNOWN') fail('PUBLIC_EVIDENCE_MUST_BE_KNOWN', path + '.status');
    return {
      status: 'KNOWN',
      beliefRevision: opaqueId(value.beliefRevision, path + '.beliefRevision'),
      sourceFactIds: idArray(value.sourceFactIds, path + '.sourceFactIds', true),
      sourceEventIds: idArray(value.sourceEventIds, path + '.sourceEventIds', true),
    };
  }

  function normalizeCapabilities(value, path) {
    ensureKeys(value, ['status', 'capabilityIds', 'source', 'reason'], path);
    if (!STATUSES.has(value.status)) fail('CAPABILITY_STATUS_INVALID', path + '.status');
    const capabilityIds = idArray(value.capabilityIds, path + '.capabilityIds', false);
    const result = { status: value.status, capabilityIds };
    if (value.status === 'KNOWN') {
      if (!capabilityIds.length) fail('KNOWN_CAPABILITY_EMPTY', path + '.capabilityIds');
      result.source = normalizeSource(value.source, path + '.source');
      if (!result.source || result.source.kind === 'NONE') fail('KNOWN_CAPABILITY_SOURCE_REQUIRED', path + '.source');
    } else {
      if (capabilityIds.length) fail('UNKNOWN_CAPABILITY_IDENTITY_FORBIDDEN', path + '.capabilityIds');
      if (value.source !== undefined) result.source = normalizeSource(value.source, path + '.source');
      result.reason = reasonCode(value.reason, path + '.reason');
    }
    return result;
  }

  function normalizeContinuation(value, path) {
    ensureKeys(value, ['status', 'value', 'source', 'reason'], path);
    if (!STATUSES.has(value.status)) fail('CONTINUATION_STATUS_INVALID', path + '.status');
    const result = { status: value.status };
    if (value.status === 'KNOWN') {
      result.value = probability(value.value, path + '.value');
      result.source = normalizeSource(value.source, path + '.source');
      if (!result.source || result.source.kind === 'NONE') fail('KNOWN_CONTINUATION_SOURCE_REQUIRED', path + '.source');
    } else {
      if (own(value, 'value')) fail('UNKNOWN_CONTINUATION_VALUE_FORBIDDEN', path + '.value');
      result.source = normalizeSource(value.source, path + '.source');
      if (!result.source) fail('UNKNOWN_CONTINUATION_SOURCE_REQUIRED', path + '.source');
      result.reason = reasonCode(value.reason, path + '.reason');
    }
    return result;
  }

  function normalizeRequestIdentity(value, path) {
    ensureKeys(value, ['preparedRequestHash', 'worldRevision', 'beliefRevision', 'opportunityRevision', 'candidateSetHash'], path);
    const result = {};
    if (own(value, 'preparedRequestHash')) result.preparedRequestHash = hash(value.preparedRequestHash, path + '.preparedRequestHash');
    if (own(value, 'worldRevision')) result.worldRevision = opaqueId(value.worldRevision, path + '.worldRevision');
    if (own(value, 'beliefRevision')) result.beliefRevision = opaqueId(value.beliefRevision, path + '.beliefRevision');
    if (own(value, 'opportunityRevision')) result.opportunityRevision = opaqueId(value.opportunityRevision, path + '.opportunityRevision');
    if (own(value, 'candidateSetHash')) result.candidateSetHash = hash(value.candidateSetHash, path + '.candidateSetHash');
    return result;
  }

  function unknownResponse(legalResponseCandidateIds, reason) {
    return {
      status: 'UNKNOWN',
      legalResponseCandidateIds: legalResponseCandidateIds.slice(),
      entries: [],
      reason: reasonCode(reason, 'response.reason'),
    };
  }

  function normalizeResponse(legalResponseCandidateIds, responseModel, candidateId, preparedIds) {
    if (responseModel === undefined) return unknownResponse(legalResponseCandidateIds, 'NO_RESPONSE_MODEL');
    ensurePlain(responseModel, 'responseModel');
    ensureKeys(responseModel, ['source', 'outputsByCandidateId'], 'responseModel');
    const sourceState = responseSourceOrUnknown(responseModel.source, 'responseModel.source');
    const outputs = responseModel.outputsByCandidateId;
    if (!sourceState.source || outputs === undefined) return unknownResponse(legalResponseCandidateIds, sourceState.reason === 'NONE' ? 'MODEL_OUTPUT_NOT_CLOSED' : sourceState.reason);
    ensurePlain(outputs, 'responseModel.outputsByCandidateId');
    for (const key of Object.keys(outputs)) if (!preparedIds.includes(key)) fail('RESPONSE_OUTPUT_UNKNOWN_CANDIDATE', key);
    if (!own(outputs, candidateId)) return unknownResponse(legalResponseCandidateIds, 'MODEL_OUTPUT_MISSING');
    const output = outputs[candidateId];
    ensureKeys(output, ['entries'], 'responseModel.outputsByCandidateId.' + candidateId);
    if (!Array.isArray(output.entries) || output.entries.length !== legalResponseCandidateIds.length) fail('RESPONSE_COVERAGE', candidateId);
    const entries = output.entries.map((entry, index) => {
      ensureKeys(entry, ['candidateId', 'probability'], 'responseModel.entries[' + index + ']');
      return {
        candidateId: opaqueId(entry.candidateId, 'responseModel.entries[' + index + '].candidateId'),
        probability: probability(entry.probability, 'responseModel.entries[' + index + '].probability'),
      };
    });
    if (entries.some((entry, index) => entry.candidateId !== legalResponseCandidateIds[index])) fail('RESPONSE_COVERAGE', candidateId);
    const sum = entries.reduce((total, entry) => total + entry.probability, 0);
    if (Math.abs(sum - 1) > SUM_TOLERANCE) fail('RESPONSE_PROBABILITY_SUM', candidateId);
    return {
      status: 'KNOWN',
      legalResponseCandidateIds: legalResponseCandidateIds.slice(),
      entries,
      source: sourceState.source,
      reason: 'NONE',
    };
  }

  function build(input) {
    ensurePlain(input, 'input');
    rejectForbidden(input, 'input', new WeakSet());
    ensureKeys(input, ['preparedFrozenCandidateIds', 'candidates', 'legalResponseCandidateIds', 'responseModel', 'requestIdentity'], 'input');
    const preparedIds = idArray(input.preparedFrozenCandidateIds, 'input.preparedFrozenCandidateIds', true);
    const legalResponseCandidateIds = idArray(input.legalResponseCandidateIds, 'input.legalResponseCandidateIds', true);
    if (!Array.isArray(input.candidates) || input.candidates.length !== preparedIds.length) fail('CANDIDATE_CLOSURE', 'input.candidates');

    const envelopes = input.candidates.map((candidate, index) => {
      const candidatePath = 'input.candidates[' + index + ']';
      ensureKeys(candidate, [
        'candidateId', 'currentFactDeltas', 'actionPoolFacts', 'futureConsumerIdentities',
        'publicEvidence', 'contingencyCapabilities', 'continuationSurrogate',
      ], candidatePath);
      if (candidate.candidateId !== preparedIds[index]) fail('CANDIDATE_ORDER_OR_SET', candidatePath + '.candidateId');
      return {
        candidateId: candidate.candidateId,
        currentFactDeltas: normalizeFactDeltas(candidate.currentFactDeltas, candidatePath + '.currentFactDeltas'),
        actionPoolDelta: normalizeActionPool(candidate.actionPoolFacts, candidatePath + '.actionPoolFacts'),
        futureConsumerIdentities: normalizeConsumers(candidate.futureConsumerIdentities, candidatePath + '.futureConsumerIdentities'),
        opponentResponseDistribution: normalizeResponse(legalResponseCandidateIds, input.responseModel, candidate.candidateId, preparedIds),
        publicEvidence: normalizePublicEvidence(candidate.publicEvidence, candidatePath + '.publicEvidence'),
        contingencyCapabilities: normalizeCapabilities(candidate.contingencyCapabilities, candidatePath + '.contingencyCapabilities'),
        continuationSurrogate: normalizeContinuation(candidate.continuationSurrogate, candidatePath + '.continuationSurrogate'),
      };
    });

    const document = {
      preparedFrozenCandidateIds: preparedIds.slice(),
      envelopes,
    };
    if (input.requestIdentity !== undefined) document.requestIdentity = normalizeRequestIdentity(input.requestIdentity, 'input.requestIdentity');
    const audit = {
      schemaVersion: 'BehaviorCandidateImpactEnvelopeBuildAuditV1',
      candidateCount: envelopes.length,
      responseKnownCount: envelopes.filter(item => item.opponentResponseDistribution.status === 'KNOWN').length,
      responseUnknownCount: envelopes.filter(item => item.opponentResponseDistribution.status === 'UNKNOWN').length,
      factKnownRowCount: envelopes.reduce((total, item) => total + item.currentFactDeltas.filter(row => row.status === 'KNOWN').length, 0),
      factUnknownRowCount: envelopes.reduce((total, item) => total + item.currentFactDeltas.filter(row => row.status !== 'KNOWN').length, 0),
      actionPoolKnownCount: envelopes.filter(item => item.actionPoolDelta.status === 'KNOWN').length,
      actionPoolUnknownCount: envelopes.filter(item => item.actionPoolDelta.status !== 'KNOWN').length,
      actionPoolOwnerValidated: true,
      carrierOnly: true,
    };
    return deepFreeze({ document, audit });
  }

  function selfCheck() {
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      contractHash: CONTRACT_HASH,
      schemaHash: SCHEMA_HASH,
      carrierOnly: true,
      closedCandidateSet: true,
      noExternalReads: true,
    });
  }

  const api = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    contractHash: CONTRACT_HASH,
    schemaHash: SCHEMA_HASH,
    build,
    selfCheck,
  });
  root.__LWCS_BEHAVIOR_CANDIDATE_IMPACT_ENVELOPE__ = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);

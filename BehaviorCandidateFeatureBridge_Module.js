// BehaviorCandidateFeatureBridge_Module.js
// M2 candidate-feature bridge writer C - revision 5 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority (frozen, disk-verified):
//   tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.json       b26ace4fbf5862a6126e1190e1b2248b83c752e354f61bdbd81f3dd5c0e8cd4c
//   tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.schema.json 171f102ae7317ed87c1d4a48e801985ee4bf82b18e42237a062d6c7473bfe394
//   BehaviorImmediateFeature_Module.js                              f1dc6c36cbd6c3cddae924378e3f6c456d4ac6d8a18d45a4c2cd345c18cfe648
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.json             8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json     b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49
//   tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json           4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55
//   BehaviorPrototypeAdapter_Module.js                              a3af7b5aa1203ca604254a8755ee7415e5ce52e1cfe7e7923a23c5b0707ddd39
//   tools/rc6/contracts/PrototypeDirectAdapterV1.json               4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e
//   tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json        7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22
//   tools/rc6/cases/PrototypeDirectAdapterCasesV1.json              1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c
//   tools/rc6/contracts/DirectFactRowV1.json                        493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917
//   tools/rc6/contracts/DirectFactRowV1.schema.json                0325e39cd33ecf1c925268d451f23c3bde4d75eca3b5405b614c255b931b0538
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.json             69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8 (read-only, untrained, revision 15)
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.schema.json      3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e (read-only, untrained, revision 15)
// One-pass transcription bridge: prepared CANDIDATES_ONLY frozen candidate + public
// visible snapshot + preview DECISION_VISIBLE atomic contributions + per-effect PDA
// projection records + candidate declaration -> BIF input rev10 production subset.
// Strictly no R8 selection, no old shadow, no future-route, no world clone, no result
// enumeration, no hidden reads, no teacher, no wall clock, no Runtime/loader wiring.
// mechanicMetadataEntries/projectionFamilies are lifted (aggregated verbatim, never
// scored/weighted); scheduledFacts are verbatim (entryId already stamped by PDA);
// opportunityModifiers are transcribed minus the lifted keys; test-only keys
// (forbiddenFacts/branchCombination/preMultiplied) are never emitted; paymentMode
// follows paymentModeDerivationV1; ZERO_SUPPORTED_PROJECTION is fatal and counted.
// Prototype attestation: the bridge resolves the authoritative PDA registry
// (per-input pdaApi or the formal global __LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__,
// fail-closed when neither exists) and stamps the read-only prototypeRegistry
// carrier into every bifInput: registryId + canonical-sorted prototypeNames from
// Object.keys(registry).sort() + fnv1a32 hex + sourceContractHash pin; unknown
// names and registry drift fail closed downstream in the compiler; new prototypes
// auto-adopt without any bridge-side name list.
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var SCHEMA_VERSION = 'BehaviorCandidateFeatureBridgeV1';
  var REGISTRY_ID = 'RC6-M2-BEHAVIOR-CANDIDATE-FEATURE-BRIDGE-V1-2026-08-14';
  var REVISION = 10;

  var CONTRACT_HASHES = {
    bridgeContract: 'b26ace4fbf5862a6126e1190e1b2248b83c752e354f61bdbd81f3dd5c0e8cd4c',
    bridgeSchema: '171f102ae7317ed87c1d4a48e801985ee4bf82b18e42237a062d6c7473bfe394',
    featureModule: 'f1dc6c36cbd6c3cddae924378e3f6c456d4ac6d8a18d45a4c2cd345c18cfe648',
    featureContract: '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76',
    featureSchema: 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49',
    featureCases: '4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55',
    adapterModule: 'a3af7b5aa1203ca604254a8755ee7415e5ce52e1cfe7e7923a23c5b0707ddd39',
    adapterContract: '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
    adapterSchema: '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
    adapterCases: '1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c',
    directFactRow: '493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917',
    policyContract: '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8',
    policySchema: '3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e'
  };

  var BIF_INPUT_KEYS = [
    'candidate', 'publicSnapshot', 'actionOpportunity', 'atomicFacts', 'directFacts', 'legalityModifiers',
    'opportunityModifiers', 'scheduledFacts', 'mechanicMetadataEntries',
    'projectionFamilies', 'publicCost', 'publicProbability', 'publicDeclarations',
    'prototypeRegistry', 'creationProfile'
  ];
  var TEST_ONLY_KEYS = ['forbiddenFacts', 'branchCombination', 'preMultiplied'];
  var UNTRANSCRIBED_REASONS = [
    'non-finite expectedDelta', 'non-finite hitProbability', 'missing outcomeKind',
    'missing eventId', 'unmatched contribution source'
  ];
  var PENDING_KINDS = [
    'PENDING_CONDITIONAL_PROJECTION', 'PENDING_TRIGGER_PROJECTION',
    'PENDING_DURATION_PROJECTION', 'PENDING_DIRECTION_PROJECTION',
    'PENDING_DIRECT_PROJECTION'
  ];
  var DEFER_KINDS = [
    'DEFER_MECHANICS_PROJECTION', 'DEFER_LEGALITY_INJECTION', 'DEFER_REPORT_PROJECTION'
  ];
  var REJECT_CODES = [
    'UNKNOWN_PROTOTYPE_REJECTED', 'FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE',
    'MISSING_SOURCE_CONTEXT', 'MISSING_TARGET_CONTEXT', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_RULE', 'AMBIGUOUS_TAUNT_TARGET'
  ];
  var NO_OFFICIAL_EFFECT_KINDS = ['BASIC_ATTACK', 'DEFEND', 'EVADE', 'PASS'];
  var HARD_EXCLUSION_CODES = [
    'ACTOR_DISABLED', 'ACTOR_TERMINAL', 'TARGET_EMPTY', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_STATE', 'UNKNOWN_RULE',
    'AMBIGUOUS_TAUNT_TARGET', 'ILLEGAL_TARGET', 'RESOURCE_INSUFFICIENT'
  ];
  var CARRIER_KIND = 'UNSUPPORTED_CARRIER_REQUIRES_UNPACK';
  var FATAL_ZERO = 'ZERO_SUPPORTED_PROJECTION';
  var LIFTED_OPP_KEYS = ['mechanicMetadataEntries', 'projectionFamilies'];
  var RESOURCE_NAMES = ['魂力', '精神力', '体力', '生命'];
  var CANDIDATE_IDENTITY_KEYS = ['candidateId', 'actorId', 'actorSide', 'actionKind', 'targetSet', 'paymentMode'];
  var ACTION_OPPORTUNITY_KEYS = ['role', 'sourceActorId', 'incomingAction', 'actionContext', 'counterWindow', 'reactionMechanics'];
  var REACTION_MECHANICS_KEYS = [
    'candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId',
    'targetId', 'prepared', 'damageMultiplier', 'dodgeProbability',
    'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'
  ];
  var REACTION_RESPONSE_KINDS = ['PASS_OPPORTUNITY', 'DEFEND', 'EVADE'];
  var REACTION_UNKNOWN_REASONS = [
    'NO_PUBLIC_DECLARATION', 'CONDITIONAL_PROBABILITY_UNRESOLVED', 'FINAL_SETTLEMENT_UNKNOWN',
    'FUTURE_REALIZATION_UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', 'MISSING_SOURCE_FACT',
    'SIDE_UNOBSERVED', 'STATE_FORM_UNMAPPED', 'CONFLICTING_DELIVERIES', 'NON_FINITE_DELIVERY',
    'SOURCE_PROVENANCE_INCOMPLETE'
  ];
  var CREATION_PROFILE_KEYS = ['recipientId', 'useEffects'];
  var CREATION_PROFILE_ROW_KEYS = ['原型', '目标', '资源', '数值'];

  var FORBIDDEN_CALL_TOKENS = [
    'require(', 'import(', 'import ', 'fetch(', 'XMLHttpRequest', 'WebSocket',
    'localStorage', 'sessionStorage', 'process.', 'module.exports', 'eval(', 'new Function',
    'Math.random', 'Date.now', 'performance.now', 'decide(', 'runProvider(',
    'teacherOutput(', 'factColumns', 'simpleAdapter', 'worldClone(', 'structuredClone(',
    'futureRoute(', 'kernelRoute(', 'resultCartesian(', 'enumerateCandidates('
  ];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      hasOwn(proto, 'constructor') && proto.constructor && proto.constructor.name === 'Object');
  }
  // Deterministic sandbox-safe hash (FNV-1a 32-bit over UTF-16 code units of the
  // canonical JSON {"prototypeNames":[...]}) binding the prototypeRegistry carrier;
  // the compiler recomputes and compares it (registry drift fails closed).
  function fnv1a32Hex(names) {
    var s = '{"prototypeNames":[';
    for (var i = 0; i < names.length; i += 1) {
      if (i > 0) s += ',';
      s += JSON.stringify(names[i]);
    }
    s += ']}';
    var h = 0x811c9dc5;
    for (var j = 0; j < s.length; j += 1) {
      h ^= s.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    var hex = h.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex;
  }
  function globalPdaApi() {
    if (typeof globalThis !== 'undefined' && globalThis.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__ &&
      typeof globalThis.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__.registry === 'function') return globalThis.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__;
    if (typeof self !== 'undefined' && self.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__ &&
      typeof self.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__.registry === 'function') return self.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__;
    if (typeof window !== 'undefined' && window.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__ &&
      typeof window.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__.registry === 'function') return window.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__;
    return null;
  }
  function resolvePdaApi(input) {
    var pda = input && input.pdaApi;
    if (pda && typeof pda === 'object' && typeof pda.registry === 'function') return pda;
    pda = globalPdaApi();
    if (pda) return pda;
    throw rejection('MISSING_REQUIRED_FIELD', { field: 'pdaApi' });
  }
  function prototypeRegistryFrom(pdaApi) {
    var reg = pdaApi.registry();
    if (!reg || typeof reg !== 'object' || Array.isArray(reg)) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry' });
    var regId = reg.registryId;
    if (typeof regId !== 'string' || regId.indexOf('RC6-M2-PROTOTYPE-DIRECT-ADAPTER') !== 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.registryId', value: regId });
    }
    var rows = reg.registry;
    if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry' });
    var names = Object.keys(rows).sort();
    if (names.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames' });
    for (var i = 1; i < names.length; i += 1) {
      if (names[i - 1] >= names[i]) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames' });
    }
    return {
      registryId: regId,
      prototypeNames: names,
      prototypeRegistryHash: fnv1a32Hex(names),
      sourceContractHash: CONTRACT_HASHES.adapterContract
    };
  }
  function cloneDeep(v) { return JSON.parse(JSON.stringify(v)); }
  function normZero(v) { return v === 0 ? 0 : v; }
  function isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }
  function rejection(code, detail) {
    var e = new Error(code + (detail ? ' :: ' + JSON.stringify(detail) : ''));
    e.code = code;
    e.reasonCode = code;
    e.detail = detail === undefined ? null : detail;
    return e;
  }
  function freezeDeep(v) {
    if (v && typeof v === 'object' && Object.isFrozen(v)) return v;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i += 1) freezeDeep(v[i]);
      Object.freeze(v);
    } else if (v && typeof v === 'object') {
      for (var k in v) if (hasOwn(v, k)) freezeDeep(v[k]);
      Object.freeze(v);
    }
    return v;
  }
  function validateIdString(v, field) {
    if (typeof v !== 'string' || v.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: field });
    if (v.length > 512 || /[\u0000-\u001F\u007F]/.test(v)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    return v;
  }
  function canonicalActionId(candidate, declaration) {
    if (declaration === undefined) return candidate.candidateId;
    if (!isPlainObject(declaration)) throw rejection('INVALID_OPTION_VALUE', { field: 'declaration' });
    if (!hasOwn(declaration, 'actionId')) return candidate.candidateId;
    var value = declaration.actionId;
    if (typeof value !== 'string' || value.length === 0 || value.length > 512 || /[\u0000-\u001F\u007F]/.test(value)) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.actionId' });
    }
    return value;
  }

  function validateReactionRefs(value, field) {
    if (!Array.isArray(value)) throw rejection('MISSING_REQUIRED_FIELD', { field: field });
    var seen = {};
    for (var i = 0; i < value.length; i += 1) {
      validateIdString(value[i], field + '[' + i + ']');
      if (hasOwn(seen, value[i])) throw rejection('INVALID_OPTION_VALUE', { field: field, duplicate: value[i] });
      seen[value[i]] = true;
    }
  }

  function sameReactionRefs(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every(function (value, index) { return value === right[index]; });
  }

  function validateActionContext(value, field) {
    if (value === undefined) return undefined;
    if (!isPlainObject(value)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    rejectUnknownKeys(value, ['actionEvent', 'targetResolutionEvent'], field);
    var actionEvent = value.actionEvent;
    if (!isPlainObject(actionEvent)) throw rejection('MISSING_REQUIRED_FIELD', { field: field + '.actionEvent' });
    rejectUnknownKeys(actionEvent, ['actionId', 'eventId'], field + '.actionEvent');
    validateIdString(actionEvent.actionId, field + '.actionEvent.actionId');
    validateIdString(actionEvent.eventId, field + '.actionEvent.eventId');
    var normalized = { actionEvent: { actionId: actionEvent.actionId, eventId: actionEvent.eventId } };
    if (value.targetResolutionEvent !== undefined) {
      var targetEvent = value.targetResolutionEvent;
      if (!isPlainObject(targetEvent)) throw rejection('INVALID_OPTION_VALUE', { field: field + '.targetResolutionEvent' });
      rejectUnknownKeys(targetEvent, ['eventId'], field + '.targetResolutionEvent');
      validateIdString(targetEvent.eventId, field + '.targetResolutionEvent.eventId');
      normalized.targetResolutionEvent = { eventId: targetEvent.eventId };
    }
    return normalized;
  }

  function contextRefs(context) {
    var ids = [context.actionEvent.eventId];
    if (context.targetResolutionEvent && context.targetResolutionEvent.eventId !== context.actionEvent.eventId) {
      ids.push(context.targetResolutionEvent.eventId);
    }
    return { sourceActionId: context.actionEvent.actionId, sourceFactIds: ids.slice(), sourceEventIds: ids.slice() };
  }

  function validateActionOpportunityCarrier(value, cand) {
    if (value === undefined) return undefined;
    if (!isPlainObject(value)) throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity' });
    rejectUnknownKeys(value, ACTION_OPPORTUNITY_KEYS, 'actionOpportunity');
    validateIdString(value.role, 'actionOpportunity.role');
    if (value.sourceActorId !== undefined) validateIdString(value.sourceActorId, 'actionOpportunity.sourceActorId');
    if (value.counterWindow !== undefined && typeof value.counterWindow !== 'boolean') {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.counterWindow' });
    }
    var actionContext = validateActionContext(value.actionContext, 'actionOpportunity.actionContext');
    var incoming = value.incomingAction;
    if (!isPlainObject(incoming)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'actionOpportunity.incomingAction' });
    if (hasOwn(incoming, 'reactionMechanics') || hasOwn(incoming, 'damageMultiplier') || hasOwn(incoming, 'dodgeProbability')) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.incomingAction' });
    }
    validateIdString(incoming.sourceActionId, 'actionOpportunity.incomingAction.sourceActionId');
    if (actionContext) {
      var refs = contextRefs(actionContext);
      validateReactionRefs(incoming.sourceFactIds, 'actionOpportunity.incomingAction.sourceFactIds');
      validateReactionRefs(incoming.sourceEventIds, 'actionOpportunity.incomingAction.sourceEventIds');
      if (incoming.sourceActionId !== refs.sourceActionId || !sameReactionRefs(incoming.sourceFactIds, refs.sourceFactIds) ||
        !sameReactionRefs(incoming.sourceEventIds, refs.sourceEventIds)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.identity' });
      }
    }
    var mechanics = value.reactionMechanics;
    if (!isPlainObject(mechanics)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'actionOpportunity.reactionMechanics' });
    rejectUnknownKeys(mechanics, REACTION_MECHANICS_KEYS, 'actionOpportunity.reactionMechanics');
    var required = ['candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId', 'targetId', 'prepared', 'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'];
    for (var r = 0; r < required.length; r += 1) {
      if (mechanics[required[r]] === undefined) throw rejection('MISSING_REQUIRED_FIELD', { field: 'actionOpportunity.reactionMechanics.' + required[r] });
    }
    validateIdString(mechanics.candidateId, 'actionOpportunity.reactionMechanics.candidateId');
    validateIdString(mechanics.sourceActionId, 'actionOpportunity.reactionMechanics.sourceActionId');
    validateIdString(mechanics.sourceActorId, 'actionOpportunity.reactionMechanics.sourceActorId');
    validateIdString(mechanics.targetId, 'actionOpportunity.reactionMechanics.targetId');
    validateIdString(mechanics.visibleWorldRevision, 'actionOpportunity.reactionMechanics.visibleWorldRevision');
    validateIdString(mechanics.requestHash, 'actionOpportunity.reactionMechanics.requestHash');
    validateReactionRefs(mechanics.sourceFactIds, 'actionOpportunity.reactionMechanics.sourceFactIds');
    validateReactionRefs(mechanics.sourceEventIds, 'actionOpportunity.reactionMechanics.sourceEventIds');
    if (REACTION_RESPONSE_KINDS.indexOf(mechanics.responseKind) < 0 || (mechanics.status !== 'KNOWN' && mechanics.status !== 'UNKNOWN')) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics' });
    }
    if (mechanics.prepared !== true || mechanics.candidateId !== cand.candidateId || mechanics.responseKind !== cand.actionKind ||
      mechanics.sourceActorId !== value.sourceActorId || mechanics.sourceActionId !== incoming.sourceActionId ||
      mechanics.targetId !== cand.actorId || cand.targetSet.indexOf(mechanics.targetId) < 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.identity' });
    }
    if (actionContext) {
      var contextIdentity = contextRefs(actionContext);
      if (mechanics.sourceActionId !== contextIdentity.sourceActionId ||
        !sameReactionRefs(mechanics.sourceFactIds, contextIdentity.sourceFactIds) ||
        !sameReactionRefs(mechanics.sourceEventIds, contextIdentity.sourceEventIds)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.reactionMechanics' });
      }
    }
    if (mechanics.status === 'KNOWN') {
      if (mechanics.reason !== 'OK' || !isFiniteNumber(mechanics.damageMultiplier) || mechanics.damageMultiplier < 0 || mechanics.damageMultiplier > 1 ||
        !isFiniteNumber(mechanics.dodgeProbability) || mechanics.dodgeProbability < 0 || mechanics.dodgeProbability > 1) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.values' });
      }
      if (mechanics.responseKind === 'PASS_OPPORTUNITY' && (mechanics.damageMultiplier !== 1 || mechanics.dodgeProbability !== 0)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.PASS_OPPORTUNITY' });
      }
      if (mechanics.sourceFactIds.length === 0 || mechanics.sourceEventIds.length === 0) {
        var downgraded = cloneDeep(value);
        downgraded.reactionMechanics.status = 'UNKNOWN';
        downgraded.reactionMechanics.reason = 'SOURCE_PROVENANCE_INCOMPLETE';
        delete downgraded.reactionMechanics.damageMultiplier;
        delete downgraded.reactionMechanics.dodgeProbability;
        return downgraded;
      }
    } else if (hasOwn(mechanics, 'damageMultiplier') || hasOwn(mechanics, 'dodgeProbability') || REACTION_UNKNOWN_REASONS.indexOf(mechanics.reason) < 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.UNKNOWN' });
    }
    return cloneDeep(value);
  }

  function rejectUnknownKeys(obj, allowed, field) {
    for (var k in obj) {
      if (hasOwn(obj, k) && allowed.indexOf(k) < 0) throw rejection('INVALID_OPTION_VALUE', { field: field, extraKey: k });
    }
  }

  function derivePaymentMode(candidate, declaration) {
    if (candidate && typeof candidate.paymentMode === 'string' && candidate.paymentMode.length > 0) return candidate.paymentMode;
    if (declaration && typeof declaration.paymentMode === 'string' && declaration.paymentMode.length > 0) return declaration.paymentMode;
    if (candidate && candidate.resourcePotentialOnly === true) return 'EXTERNAL_TIMELINE';
    return 'FORMAL';
  }

  function emptyOppMods() { return {}; }

  function untranscribedReasonOf(contrib) {
    if (contrib === null || typeof contrib !== 'object') return 'missing outcomeKind';
    if (typeof contrib.eventId !== 'string' || contrib.eventId.length === 0) return 'missing eventId';
    if (typeof contrib.outcomeKind !== 'string' || contrib.outcomeKind.length === 0) return 'missing outcomeKind';
    if (!isFiniteNumber(contrib.expectedDelta)) return 'non-finite expectedDelta';
    var ev = contrib.evidence;
    // R4b2: HP_DELTA rows keep their delivery identity; missing/non-finite
    // probability is transcribed as deliveryStatus below, not dropped here.
    if (String(contrib.outcomeKind || '').trim() === 'HP_DELTA') return null;
    if (!ev || typeof ev !== 'object' || !isFiniteNumber(ev.hitProbability)) return 'non-finite hitProbability';
    return null;
  }

  function atomicFromContributions(canonicalActionId, contributions) {
    var facts = [];
    var untranscribed = [];
    var list = Array.isArray(contributions) ? contributions : [];
    for (var i = 0; i < list.length; i += 1) {
      var c = list[i];
      if (c === null || typeof c !== 'object') { untranscribed.push({ reason: 'missing outcomeKind', index: i }); continue; }
      var sourceOk = typeof c.sourceActionId === 'string' && c.sourceActionId === canonicalActionId;
      var reason = untranscribedReasonOf(c);
      if (!sourceOk && !reason) reason = 'unmatched contribution source';
      if (reason) { untranscribed.push({ reason: reason, index: i }); continue; }
      var isHpDelta = String(c.outcomeKind || '').trim() === 'HP_DELTA';
      if (isHpDelta) {
        var effectId = typeof c.effectInstanceId === 'string' ? c.effectInstanceId : '';
        var targetId = typeof c.targetId === 'string' ? c.targetId : '';
        if (!effectId || !targetId) {
          facts.push({ eventId: c.eventId, sourceActionId: c.sourceActionId,
            outcomeKind: c.outcomeKind, expectedDelta: normZero(c.expectedDelta),
            hitCheckApplicability: 'UNKNOWN' });
          continue;
        }
        var basis = c.evidence && c.evidence.damageBasis && typeof c.evidence.damageBasis === 'object'
          ? c.evidence.damageBasis
          : null;
        var rawP = c.evidence && c.evidence.hitProbability;
        var pFinite = isFiniteNumber(rawP);
        var fact = {
          eventId: c.eventId,
          sourceActionId: c.sourceActionId,
          outcomeKind: c.outcomeKind,
          expectedDelta: normZero(c.expectedDelta),
          effectInstanceId: effectId,
          targetId: targetId
        };
        if (pFinite) {
          fact.hitCheckApplicability = 'APPLICABLE';
          fact.evidence = { hitProbability: normZero(rawP) };
          if (basis) fact.evidence.damageBasis = basis;
        } else {
          fact.hitCheckApplicability = 'APPLICABLE';
          fact.evidence = { deliveryStatus: rawP === undefined || rawP === null ? 'MISSING' : 'NON_FINITE' };
          if (basis) fact.evidence.damageBasis = basis;
        }
        facts.push(fact);
        continue;
      }
      facts.push({
        eventId: c.eventId,
        sourceActionId: c.sourceActionId,
        outcomeKind: c.outcomeKind,
        expectedDelta: normZero(c.expectedDelta),
        hitCheckApplicability: 'APPLICABLE',
        evidence: { hitProbability: normZero(c.evidence.hitProbability) },
        effectInstanceId: typeof c.effectInstanceId === 'string' ? c.effectInstanceId : '',
        targetId: typeof c.targetId === 'string' ? c.targetId : ''
      });
    }
    return { atomicFacts: facts, untranscribed: untranscribed };
  }

  function classifyProjection(proj) {
    var kinds = Array.isArray(proj.unsupportedOutcomeKinds) ? proj.unsupportedOutcomeKinds : [];
    var deferCode = typeof proj.deferCode === 'string' ? proj.deferCode : '';
    var out = { rejection: null, pending: [], deferred: null, carrier: false };
    if (deferCode && DEFER_KINDS.indexOf(deferCode) >= 0) out.deferred = deferCode;
    for (var i = 0; i < kinds.length; i += 1) {
      var k = kinds[i];
      if (k === CARRIER_KIND) { out.carrier = true; continue; }
      if (PENDING_KINDS.indexOf(k) >= 0) { out.pending.push(k); continue; }
      if (k === 'DEFER_LIFT_PROJECTION_REQUIRED') { continue; }
      if (k === 'OUT_OF_BATTLE_SCOPE') { if (!out.rejection) out.rejection = 'FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE'; continue; }
      if (REJECT_CODES.indexOf(k) >= 0) { if (!out.rejection) out.rejection = k; continue; }
      if (out.deferred) continue;
      if (!out.rejection) out.rejection = k;
    }
    return out;
  }

  function isZeroProjection(proj) {
    return (Array.isArray(proj.directFacts) ? proj.directFacts.length : 0) === 0 &&
      (Array.isArray(proj.scheduledFacts) ? proj.scheduledFacts.length : 0) === 0 &&
      (!proj.legalityModifiers || Object.keys(proj.legalityModifiers).length === 0) &&
      (!proj.opportunityModifiers || Object.keys(proj.opportunityModifiers).length === 0);
  }

  function mergeMods(a, b) {
    var out = {};
    for (var k in a) if (hasOwn(a, k)) out[k] = cloneDeep(a[k]);
    for (var k2 in b) if (hasOwn(b, k2)) out[k2] = cloneDeep(b[k2]);
    return out;
  }

  function liftProjections(pdaProjections) {
    var agg = {
      directFacts: [], scheduledFacts: [], legalityModifiers: {}, opportunityModifiers: {},
      mechanicMetadataEntries: [], projectionFamilies: [], rejections: [], pendings: [],
      deferreds: [], fatals: []
    };
    var items = Array.isArray(pdaProjections) ? pdaProjections : [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var seid = item && typeof item === 'object' ? item.sourceEffectId : null;
      if (typeof seid !== 'string' || seid.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'pdaProjections[].sourceEffectId' });
      var proj = item.projection;
      if (!proj || typeof proj !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'pdaProjections[].projection' });
      var cls = classifyProjection(proj);
      if (cls.carrier) { agg.rejections.push({ kind: CARRIER_KIND, sourceEffectId: seid }); continue; }
      if (cls.rejection) { agg.rejections.push({ kind: 'REJECTED_INPUT_WITH_REASON', code: cls.rejection, sourceEffectId: seid }); continue; }
      for (var p = 0; p < cls.pending.length; p += 1) agg.pendings.push({ kind: cls.pending[p], sourceEffectId: seid });
      if (cls.deferred) agg.deferreds.push({ kind: cls.deferred, sourceEffectId: seid });
      if (Array.isArray(proj.directFacts)) {
        for (var r = 0; r < proj.directFacts.length; r += 1) agg.directFacts.push(cloneDeep(proj.directFacts[r]));
      }
      if (Array.isArray(proj.scheduledFacts)) {
        for (var s = 0; s < proj.scheduledFacts.length; s += 1) agg.scheduledFacts.push(cloneDeep(proj.scheduledFacts[s]));
      }
      if (proj.legalityModifiers && typeof proj.legalityModifiers === 'object') {
        agg.legalityModifiers = mergeMods(agg.legalityModifiers, proj.legalityModifiers);
      }
      if (proj.opportunityModifiers && typeof proj.opportunityModifiers === 'object') {
        var om = proj.opportunityModifiers;
        var rest = {};
        for (var k in om) {
          if (!hasOwn(om, k) || LIFTED_OPP_KEYS.indexOf(k) >= 0) continue;
          rest[k] = cloneDeep(om[k]);
        }
        agg.opportunityModifiers = mergeMods(agg.opportunityModifiers, rest);
        if (Array.isArray(om.mechanicMetadataEntries)) {
          for (var m = 0; m < om.mechanicMetadataEntries.length; m += 1) agg.mechanicMetadataEntries.push(cloneDeep(om.mechanicMetadataEntries[m]));
        }
        if (Array.isArray(om.projectionFamilies)) {
          for (var f = 0; f < om.projectionFamilies.length; f += 1) agg.projectionFamilies.push(cloneDeep(om.projectionFamilies[f]));
        }
      }
      if (cls.pending.length === 0 && !cls.deferred && isZeroProjection(proj)) {
        agg.fatals.push({ kind: FATAL_ZERO, sourceEffectId: seid });
      }
    }
    return agg;
  }

  // Structured creation declaration carrier: validates and normalizes the per-candidate
  // creationProfile into the closed bifInput shape {recipientId, useEffects rows closed
  // {原型,目标,资源,数值}}; non-semantic source row keys (e.g. 生效方式) are dropped,
  // never parsed as free text, never derived from candidateId/targetSet.
  function normalizeCreationProfile(cp) {
    if (cp === undefined || cp === null) return null;
    if (typeof cp !== 'object' || Array.isArray(cp)) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile' });
    rejectUnknownKeys(cp, CREATION_PROFILE_KEYS, 'creationProfile');
    if (typeof cp.recipientId !== 'string' || cp.recipientId.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'creationProfile.recipientId' });
    if (cp.recipientId.length > 512 || /[\u0000-\u001F\u007F]/.test(cp.recipientId)) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.recipientId' });
    if (!Array.isArray(cp.useEffects)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'creationProfile.useEffects' });
    var out = { recipientId: cp.recipientId, useEffects: [] };
    for (var i = 0; i < cp.useEffects.length; i += 1) {
      var row = cp.useEffects[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + ']' });
      var norm = {};
      for (var k = 0; k < CREATION_PROFILE_ROW_KEYS.length; k += 1) {
        var key = CREATION_PROFILE_ROW_KEYS[k];
        if (row[key] === undefined) throw rejection('MISSING_REQUIRED_FIELD', { field: 'creationProfile.useEffects[' + i + '].' + key });
        var v = row[key];
        if ((key === '原型' || key === '目标' || key === '数值') && (typeof v !== 'string' || v.length === 0)) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].' + key });
        }
        if (key === '资源') {
          if (typeof v === 'string') {
            if (v.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
            norm[key] = v;
          } else if (Array.isArray(v)) {
            if (v.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
            var seen = {};
            for (var r = 0; r < v.length; r += 1) {
              if (typeof v[r] !== 'string' || v[r].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源[' + r + ']' });
              if (hasOwn(seen, v[r])) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源', duplicate: v[r] });
              seen[v[r]] = true;
            }
            norm[key] = v.slice();
          } else {
            throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
          }
        } else {
          norm[key] = v;
        }
      }
      out.useEffects.push(norm);
    }
    return out;
  }

  function bridgeCandidate(input, m) {
    if (!input || typeof input !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'candidate input' });
    var pdaApi = resolvePdaApi(input);
    var cand = input.frozenCandidate;
    if (!cand || typeof cand !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'frozenCandidate' });
    validateIdString(cand.candidateId, 'frozenCandidate.candidateId');
    validateIdString(cand.actorId, 'frozenCandidate.actorId');
    validateIdString(cand.actorSide, 'frozenCandidate.actorSide');
    validateIdString(cand.actionKind, 'frozenCandidate.actionKind');
    if (!Array.isArray(cand.targetSet) || cand.targetSet.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'frozenCandidate.targetSet' });
    var world = input.visibleWorld;
    if (!world || typeof world !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'visibleWorld' });
    var declaration = input.declaration;
    if (declaration === undefined) declaration = {};
    else if (!isPlainObject(declaration)) throw rejection('INVALID_OPTION_VALUE', { field: 'declaration' });
    var declaredEffects = declaration.skill && declaration.skill._效果数组;
    if (declaredEffects !== undefined && !Array.isArray(declaredEffects)) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.skill._效果数组' });
    }
    if (Array.isArray(declaredEffects)) {
      for (var de = 0; de < declaredEffects.length; de += 1) {
        if (declaredEffects[de] !== undefined && !isPlainObject(declaredEffects[de])) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.skill._效果数组[' + de + ']' });
        }
      }
    }
    var paymentMode = derivePaymentMode(cand, declaration);
    var actionId = canonicalActionId(cand, declaration);
    var actionOpportunity = validateActionOpportunityCarrier(input.actionOpportunity, cand);
    var atomic = atomicFromContributions(actionId, input.contributions);
    var lifted = liftProjections(input.pdaProjections);
    var noOfficial = [];
    if (NO_OFFICIAL_EFFECT_KINDS.indexOf(cand.actionKind) >= 0) {
      noOfficial.push({ kind: cand.actionKind, note: 'implicit base-action public mechanics must be materialized upstream from preview public operands; the bridge never invents a skill effect object' });
    }
    var bifCandidate = {
      candidateId: cand.candidateId, actorId: cand.actorId, actorSide: cand.actorSide,
      actionKind: cand.actionKind, targetSet: cand.targetSet.slice(), paymentMode: paymentMode
    };
    var bifInput = {
      candidate: bifCandidate,
      publicSnapshot: Object.isFrozen(world) ? world : cloneDeep(world),
      atomicFacts: atomic.atomicFacts,
      directFacts: lifted.directFacts,
      legalityModifiers: lifted.legalityModifiers,
      opportunityModifiers: lifted.opportunityModifiers,
      scheduledFacts: lifted.scheduledFacts,
      mechanicMetadataEntries: lifted.mechanicMetadataEntries,
      projectionFamilies: lifted.projectionFamilies
    };
    if (actionOpportunity !== undefined) bifInput.actionOpportunity = actionOpportunity;
    bifInput.prototypeRegistry = prototypeRegistryFrom(pdaApi);
    if (Array.isArray(declaration.publicCost) && declaration.publicCost.length > 0) {
      var cost = [];
      for (var c = 0; c < declaration.publicCost.length; c += 1) {
        var e = declaration.publicCost[c];
        if (!e || typeof e !== 'object' || RESOURCE_NAMES.indexOf(e.resource) < 0 || !isFiniteNumber(e.amount)) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.publicCost' });
        }
        cost.push({ resource: e.resource, amount: normZero(e.amount) });
      }
      bifInput.publicCost = cost;
    }
    if (declaration.publicProbability && typeof declaration.publicProbability === 'object') {
      bifInput.publicProbability = cloneDeep(declaration.publicProbability);
    }
    if (declaration.publicDeclarations && typeof declaration.publicDeclarations === 'object' &&
      Object.keys(declaration.publicDeclarations).length > 0) {
      bifInput.publicDeclarations = cloneDeep(declaration.publicDeclarations);
    }
    if (input.creationProfile !== undefined) {
      var cp = normalizeCreationProfile(input.creationProfile);
      if (cp) bifInput.creationProfile = cp;
    }
    for (var t = 0; t < TEST_ONLY_KEYS.length; t += 1) {
      if (hasOwn(bifInput, TEST_ONLY_KEYS[t])) throw rejection('INVALID_OPTION_VALUE', { field: TEST_ONLY_KEYS[t] });
    }
    var per = {
      candidateId: cand.candidateId,
      bifInput: bifInput,
      untranscribedPreviewFacts: {
        count: atomic.untranscribed.length,
        reasons: atomic.untranscribed
      },
      rejections: lifted.rejections,
      pdaPending: lifted.pendings,
      pdaDeferred: lifted.deferreds,
      fatalViolations: lifted.fatals,
      noOfficialEffectMaterialization: noOfficial
    };
    var work = 14 + bifInput.directFacts.length + bifInput.scheduledFacts.length +
      atomic.atomicFacts.length + lifted.mechanicMetadataEntries.length + lifted.projectionFamilies.length;
    if (m) {
      m.calls += 1;
      m.workUnitsTotal += work;
      m.lastWorkUnits = work;
      m.lastCandidateId = cand.candidateId;
      m.itemsTotal += Array.isArray(input.pdaProjections) ? input.pdaProjections.length : 0;
      m.compiled += 1;
      m.rejectionTotal += lifted.rejections.length;
      m.pendingTotal += lifted.pendings.length;
      m.deferTotal += lifted.deferreds.length;
      m.fatalTotal += lifted.fatals.length;
      m.untranscribedTotal += atomic.untranscribed.length;
    }
    return per;
  }

  function freshMetrics() {
    return { calls: 0, workUnitsTotal: 0, lastWorkUnits: 0, lastCandidateId: null, itemsTotal: 0, compiled: 0, rejectionTotal: 0, pendingTotal: 0, deferTotal: 0, fatalTotal: 0, untranscribedTotal: 0 };
  }
  var metrics = freshMetrics();

  function bridgeCandidates(inputs) {
    if (!Array.isArray(inputs)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'inputs' });
    metrics = freshMetrics();
    var perCandidate = [];
    for (var i = 0; i < inputs.length; i += 1) perCandidate.push(bridgeCandidate(inputs[i], metrics));
    var totals = {
      candidateCount: perCandidate.length,
      pdaItems: metrics.itemsTotal,
      compiledCount: metrics.compiled,
      rejectionSum: metrics.rejectionTotal,
      pendingSum: metrics.pendingTotal,
      deferSum: metrics.deferTotal,
      fatalSum: metrics.fatalTotal,
      untranscribedSum: metrics.untranscribedTotal
    };
    var out = { schemaVersion: SCHEMA_VERSION, totals: totals, perCandidate: perCandidate };
    return freezeDeep(out);
  }

  function readMetrics() {
    var m = {};
    for (var k in metrics) if (hasOwn(metrics, k)) m[k] = metrics[k];
    return freezeDeep(m);
  }

  function buildRegistry() {
    return {
      schemaVersion: SCHEMA_VERSION,
      contractId: REGISTRY_ID,
      revision: REVISION,
      role: ROLE,
      mount: MOUNT_NAME,
      apiSurface: ['bridgeCandidates', 'bridgeCandidate', 'registry', 'readMetrics', 'selfCheck'],
      authority: {
        milestone: 'M2',
        claim: 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED',
        claimDetail: 'freezes the transcription bridge input/output shape, lifting rules and accounting; the runtime bridge module is implemented as the transcription layer only; no selection, no teacher, no future route',
        futureRouteDerivation: false,
        worldClone: false,
        resultWorldEnumeration: false,
        hiddenInformationRead: false,
        selectionOrTopK: false,
        teacherInProductionClosure: false
      },
      contractHashes: cloneDeep(CONTRACT_HASHES),
      enums: {
        untranscribedReasons: UNTRANSCRIBED_REASONS.slice(),
        pendingKinds: PENDING_KINDS.slice(),
        deferKinds: DEFER_KINDS.slice(),
        rejectCodes: REJECT_CODES.slice(),
        noOfficialEffectKinds: NO_OFFICIAL_EFFECT_KINDS.slice(),
        hardExclusionCodes: HARD_EXCLUSION_CODES.slice()
      },
      paymentModeDerivationV1: '1) candidate.paymentMode; 2) declaration.paymentMode; 3) candidate.resourcePotentialOnly===true => EXTERNAL_TIMELINE; 4) FORMAL',
      lifting: 'mechanicMetadataEntries/projectionFamilies aggregated verbatim across effects into the BIF input; opportunityModifiers minus lifted keys; scheduledFacts verbatim with PDA entryId',
      testOnlyKeysNeverEmitted: TEST_ONLY_KEYS.slice(),
      zeroProjectionPolicy: 'SUPPORTED effect with zero directFacts/legality/opportunity/scheduled rows is FATAL ZERO_SUPPORTED_PROJECTION, never disguised as pending/deferred/silent',
      workFormula: 'per candidate 14 (F0) + directFacts rows + scheduledFacts entries + atomicFacts entries + metadata entries; no wall clock; BIF caps referenced whole-compile'
    };
  }

  function codeOnly(src) {
    var out = '';
    var i = 0;
    var n = src.length;
    while (i < n) {
      var ch = src.charAt(i);
      if (ch === '/' && src.charAt(i + 1) === '/') { while (i < n && src.charAt(i) !== '\n') i += 1; continue; }
      if (ch === '/' && src.charAt(i + 1) === '*') { i += 2; while (i < n && !(src.charAt(i) === '*' && src.charAt(i + 1) === '/')) i += 1; i += 2; continue; }
      if (ch === '"' || ch === "'") {
        var q = ch;
        i += 1;
        while (i < n) {
          if (src.charAt(i) === '\\') { i += 2; continue; }
          if (src.charAt(i) === q) { i += 1; break; }
          i += 1;
        }
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  }

  function scCandidate(id, actionKind, targets) {
    return { candidateId: id, actorId: 'actor-1', actorSide: 'side-blue', actionKind: actionKind || 'RELEASE_SKILL', targetSet: targets || ['enemy-1'], paymentMode: 'FORMAL' };
  }
  function scWorld() {
    return {
      actorStatus: 'NORMAL',
      units: {
        'actor-1': { hp: 100, hp_max: 100, sp: 100, sp_max: 100, men: 100, men_max: 100, vit: 100, vit_max: 100, def: 20, agi: 10, shield: 0, 状态效果: {} },
        'enemy-1': { hp: 100, hp_max: 100, sp: 100, sp_max: 100, men: 100, men_max: 100, vit: 100, vit_max: 100, def: 20, agi: 10, shield: 0, 状态效果: {} }
      },
      sides: { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }
    };
  }
  function scContrib(eventId, outcomeKind, delta, prob, sourceActionId) {
    return { eventId: eventId, sourceActionId: sourceActionId || 'cand-sc', outcomeKind: outcomeKind, expectedDelta: delta, effectInstanceId: 'cand-sc:effect:0', targetId: 'enemy-1', evidence: { hitProbability: prob } };
  }
  function scProjection(over) {
    var base = { directFacts: [], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
    if (over) for (var k in over) if (hasOwn(over, k)) base[k] = over[k];
    return base;
  }
  function scRow() {
    return { schemaVersion: 'DirectFactRowV1', factType: 'HP_DELTA', key: '', sourceActionId: 'cand-sc', sourceActorId: 'actor-1', sourceEffectId: 'cand-sc:effect:0', targetIds: ['enemy-1'], amount: 60, unit: 'POWER', durationTurns: 0 };
  }
  function scPdaApi() {
    var fixtureNames = ['伤害结算', '状态施加', '召唤生成', '结算修正'].sort();
    var fixtureRegistry = {};
    for (var i = 0; i < fixtureNames.length; i += 1) fixtureRegistry[fixtureNames[i]] = { status: 'SUPPORTED' };
    return {
      registry: function () {
        return { registryId: 'RC6-M2-PROTOTYPE-DIRECT-ADAPTER-2026-08-14', registry: fixtureRegistry };
      }
    };
  }
  function scBaseCandidate(extra) {
    var c = {
      frozenCandidate: scCandidate('cand-sc'),
      visibleWorld: scWorld(),
      contributions: [scContrib('evt:sc:0', 'HP_DELTA', -60, 0.8)],
      pdaApi: scPdaApi(),
      pdaProjections: [{ sourceEffectId: 'cand-sc:effect:0', projection: scProjection({ directFacts: [scRow()], opportunityModifiers: { mechanicMetadataEntries: [{ sourceEffectId: 'cand-sc:effect:0', 生效方式: '独立生效' }], projectionFamilies: [{ sourceEffectId: 'cand-sc:effect:0', prototype: '伤害结算' }] } }) }],
      declaration: { publicCost: [{ resource: '魂力', amount: 20 }], publicProbability: { hitProbability: 0.8, source: 'DECLARED' } }
    };
    if (extra) for (var k in extra) if (hasOwn(extra, k)) c[k] = extra[k];
    return c;
  }

  function runSelfCheck(sourceText, loadedHashes) {
    var checks = [];
    function add(id, passed, detail) { checks.push({ id: id, passed: !!passed, counted: true, detail: detail === undefined ? null : detail }); }
    var sourceSelfCheckable = typeof sourceText === 'string' && sourceText.length > 0;
    var fca = { id: 'forbiddenCallsAbsent', counted: sourceSelfCheckable, passed: false, detail: { sourceScanned: sourceSelfCheckable } };
    if (sourceSelfCheckable) {
      var code = codeOnly(sourceText);
      var hit = null;
      for (var t = 0; t < FORBIDDEN_CALL_TOKENS.length; t += 1) {
        if (code.indexOf(FORBIDDEN_CALL_TOKENS[t]) >= 0) { hit = FORBIDDEN_CALL_TOKENS[t]; break; }
      }
      fca.passed = hit === null;
      fca.detail = { sourceScanned: true, hit: hit };
    }
    checks.push(fca);
    add('contractPinsClosed', Object.keys(CONTRACT_HASHES).length === 13 &&
      CONTRACT_HASHES.bridgeContract === 'b26ace4fbf5862a6126e1190e1b2248b83c752e354f61bdbd81f3dd5c0e8cd4c' &&
      CONTRACT_HASHES.bridgeSchema === '171f102ae7317ed87c1d4a48e801985ee4bf82b18e42237a062d6c7473bfe394' &&
      CONTRACT_HASHES.featureModule === 'f1dc6c36cbd6c3cddae924378e3f6c456d4ac6d8a18d45a4c2cd345c18cfe648' &&
      CONTRACT_HASHES.featureContract === '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76' &&
      CONTRACT_HASHES.featureSchema === 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49' &&
      CONTRACT_HASHES.featureCases === '4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55' &&
      CONTRACT_HASHES.adapterModule === 'a3af7b5aa1203ca604254a8755ee7415e5ce52e1cfe7e7923a23c5b0707ddd39' &&
      CONTRACT_HASHES.adapterContract === '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e' &&
      CONTRACT_HASHES.adapterSchema === '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22' &&
      CONTRACT_HASHES.adapterCases === '1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c' &&
      CONTRACT_HASHES.directFactRow === '493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917', { pins: Object.keys(CONTRACT_HASHES).length });
    add('contractRevisionClosed', REVISION === 10, { revision: REVISION });
    var policyPins = { id: 'policyPinsLoaded', counted: false, passed: false, detail: { pins: Object.keys(CONTRACT_HASHES).length, loadedProvided: false } };
    if (loadedHashes && typeof loadedHashes === 'object') {
      var pc = loadedHashes.policyContract;
      var ps = loadedHashes.policySchema;
      policyPins.counted = typeof pc === 'string' && pc.length === 64 && typeof ps === 'string' && ps.length === 64;
      policyPins.passed = policyPins.counted && pc === CONTRACT_HASHES.policyContract && ps === CONTRACT_HASHES.policySchema;
      policyPins.detail = { pins: Object.keys(CONTRACT_HASHES).length, loadedProvided: true, match: policyPins.passed };
    }
    checks.push(policyPins);
    add('enumsClosed', REJECT_CODES.length === 8 && PENDING_KINDS.length === 5 && DEFER_KINDS.length === 3 && UNTRANSCRIBED_REASONS.length === 5 && NO_OFFICIAL_EFFECT_KINDS.length === 4 && HARD_EXCLUSION_CODES.length === 10 && TEST_ONLY_KEYS.length === 3, {});
    add('bifInputKeysClosed', BIF_INPUT_KEYS.length === 15 && TEST_ONLY_KEYS.every(function (k) { return BIF_INPUT_KEYS.indexOf(k) < 0; }), {});

    var base = bridgeCandidates([scBaseCandidate()]);
    var pc = base.perCandidate[0];
    var bi = pc.bifInput;
    add('baseCompiles', base.totals.candidateCount === 1 && base.totals.compiledCount === 1 && pc.candidateId === 'cand-sc' && base.totals.pdaItems === 1, base.totals);
    add('bifInputProductionSubset', Object.keys(bi).every(function (k) { return BIF_INPUT_KEYS.indexOf(k) >= 0; }) && TEST_ONLY_KEYS.every(function (k) { return !hasOwn(bi, k); }) && bi.candidate.paymentMode === 'FORMAL' && Array.isArray(bi.mechanicMetadataEntries) && bi.mechanicMetadataEntries.length === 1 && Array.isArray(bi.projectionFamilies) && bi.projectionFamilies.length === 1 && !hasOwn(bi.opportunityModifiers, 'mechanicMetadataEntries') && !hasOwn(bi.opportunityModifiers, 'projectionFamilies') && bi.directFacts.length === 1 && bi.atomicFacts.length === 1 && pc.untranscribedPreviewFacts.count === 0, { keys: Object.keys(bi) });
    add('actionContextClosedAndProvenanceEqual', function () {
      var context = { actionEvent: { actionId: 'ctx-action', eventId: 'ctx-event' }, targetResolutionEvent: { eventId: 'ctx-target' } };
      var refs = ['ctx-event', 'ctx-target'];
      var carrier = scBaseCandidate({
        frozenCandidate: scCandidate('cand-ctx', 'PASS_OPPORTUNITY', ['actor-1']),
        declaration: { actionId: 'cand-ctx' },
        actionOpportunity: {
          role: 'REACTION', sourceActorId: 'enemy-1', actionContext: context,
          incomingAction: { sourceActionId: 'ctx-action', sourceFactIds: refs.slice(), sourceEventIds: refs.slice() },
          reactionMechanics: {
            candidateId: 'cand-ctx', responseKind: 'PASS_OPPORTUNITY', status: 'KNOWN', reason: 'OK',
            sourceActionId: 'ctx-action', sourceActorId: 'enemy-1', targetId: 'actor-1', prepared: true,
            visibleWorldRevision: 'ctx-world', requestHash: 'ctx-request', damageMultiplier: 1, dodgeProbability: 0,
            sourceFactIds: refs.slice(), sourceEventIds: refs.slice()
          }
        }
      });
      var output = bridgeCandidates([carrier]).perCandidate[0].bifInput.actionOpportunity;
      var rejected = false;
      try {
        bridgeCandidates([scBaseCandidate({
          frozenCandidate: scCandidate('cand-ctx-bad', 'PASS_OPPORTUNITY', ['actor-1']),
          declaration: { actionId: 'cand-ctx-bad' },
          actionOpportunity: { ...carrier.actionOpportunity,
            reactionMechanics: { ...carrier.actionOpportunity.reactionMechanics, candidateId: 'cand-ctx-bad' },
            actionContext: { actionEvent: { actionId: 'wrong', eventId: 'ctx-event' } }
          }
        })]);
      } catch (e) { rejected = (e && (e.code || e.reasonCode)) === 'INVALID_OPTION_VALUE'; }
      return !!output && JSON.stringify(output.actionContext) === JSON.stringify(context) &&
        JSON.stringify(output.incomingAction.sourceEventIds) === JSON.stringify(refs) &&
        JSON.stringify(output.reactionMechanics.sourceEventIds) === JSON.stringify(refs) && rejected;
    }(), {});
    add('prototypeRegistryStamped', function () {
      var pr = bridgeCandidates([scBaseCandidate()]).perCandidate[0].bifInput.prototypeRegistry;
      return !!pr && pr.registryId.indexOf('RC6-M2-PROTOTYPE-DIRECT-ADAPTER') === 0 &&
        Array.isArray(pr.prototypeNames) && pr.prototypeNames.length === 4 &&
        pr.prototypeRegistryHash === fnv1a32Hex(pr.prototypeNames) &&
        pr.sourceContractHash === CONTRACT_HASHES.adapterContract;
    }(), {});
    add('prototypeRegistryFailClosed', function () {
      var bad = false;
      try {
        bridgeCandidates([scBaseCandidate({ pdaApi: { registry: function () { return { registryId: 'RC6-WRONG-REGISTRY', registry: { '伤害结算': {} } }; } } })]);
      } catch (e) {
        bad = (e && (e.code || e.reasonCode)) === 'INVALID_OPTION_VALUE';
      }
      return bad;
    }(), {});
    add('paymentModeChain', bridgeCandidates([scBaseCandidate({ frozenCandidate: Object.assign({}, scCandidate('cand-pm'), { paymentMode: undefined }), declaration: { paymentMode: 'EXTERNAL_TIMELINE' } })]).perCandidate[0].bifInput.candidate.paymentMode === 'EXTERNAL_TIMELINE' && bridgeCandidates([scBaseCandidate({ frozenCandidate: Object.assign({}, scCandidate('cand-rp'), { paymentMode: undefined, resourcePotentialOnly: true }), declaration: {} })]).perCandidate[0].bifInput.candidate.paymentMode === 'EXTERNAL_TIMELINE' && bridgeCandidates([scBaseCandidate({ frozenCandidate: Object.assign({}, scCandidate('cand-fd'), { paymentMode: undefined }), declaration: {} })]).perCandidate[0].bifInput.candidate.paymentMode === 'FORMAL', {});
    add('untranscribedReasons', function () {
      var bad = bridgeCandidates([scBaseCandidate({ contributions: [
        scContrib('', 'HP_DELTA', -60, 0.8),
        scContrib('evt:x', '', -60, 0.8),
        scContrib('evt:x', 'HP_DELTA', 'NaN', 0.8),
        scContrib('evt:x', 'HP_DELTA', -60, 'NaN'),
        scContrib('evt:x', 'HP_DELTA', -60, 0.8, 'other-source')
      ] })]).perCandidate[0];
      var reasons = bad.untranscribedPreviewFacts.reasons.map(function (r) { return r.reason; }).sort();
      return bad.untranscribedPreviewFacts.count === 4 && bad.bifInput.atomicFacts.length === 1 &&
        bad.bifInput.atomicFacts[0].evidence.deliveryStatus === 'NON_FINITE' &&
        JSON.stringify(reasons) === JSON.stringify(['missing eventId', 'missing outcomeKind', 'non-finite expectedDelta', 'unmatched contribution source'].sort());
    }(), {});
    add('sourceActionIdStrict', function () {
      var exact = bridgeCandidates([scBaseCandidate({ declaration: { actionId: 'act-7' }, contributions: [scContrib('evt:exact', 'HP_DELTA', -1, 0.5, 'act-7')] })]).perCandidate[0];
      var fallback = bridgeCandidates([scBaseCandidate({ contributions: [scContrib('evt:fallback', 'HP_DELTA', -1, 0.5, 'cand-sc')] })]).perCandidate[0];
      var prefix = bridgeCandidates([scBaseCandidate({ declaration: { actionId: 'act-7' }, contributions: [scContrib('evt:prefix', 'HP_DELTA', -1, 0.5, 'prefix-act-7-suffix')] })]).perCandidate[0];
      var invalid = false;
      try { bridgeCandidates([scBaseCandidate({ declaration: { actionId: '' }, contributions: [scContrib('evt:invalid', 'HP_DELTA', -1, 0.5, 'cand-sc')] })]); }
      catch (e) { invalid = (e && (e.code || e.reasonCode)) === 'INVALID_OPTION_VALUE'; }
      return exact.bifInput.atomicFacts.length === 1 && fallback.bifInput.atomicFacts.length === 1 &&
        prefix.untranscribedPreviewFacts.count === 1 && prefix.bifInput.atomicFacts.length === 0 && invalid;
    }(), {});
    add('rejectionKinds', function () {
      var carrier = bridgeCandidates([scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:car:0', projection: scProjection({ unsupportedOutcomeKinds: ['UNSUPPORTED_CARRIER_REQUIRES_UNPACK'] }) }] })]).perCandidate[0];
      var rej = bridgeCandidates([scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:rej:0', projection: scProjection({ unsupportedOutcomeKinds: ['INVALID_OPTION_VALUE'] }) }] })]).perCandidate[0];
      var oob = bridgeCandidates([scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:oob:0', projection: scProjection({ unsupportedOutcomeKinds: ['OUT_OF_BATTLE_SCOPE'] }) }] })]).perCandidate[0];
      return carrier.rejections.length === 1 && carrier.rejections[0].kind === 'UNSUPPORTED_CARRIER_REQUIRES_UNPACK' && carrier.bifInput.directFacts.length === 0 &&
        rej.rejections.length === 1 && rej.rejections[0].kind === 'REJECTED_INPUT_WITH_REASON' && rej.rejections[0].code === 'INVALID_OPTION_VALUE' &&
        oob.rejections.length === 1 && oob.rejections[0].code === 'FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE';
    }(), {});
    add('pendingDeferredKinds', function () {
      var pend = bridgeCandidates([scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:p:0', projection: scProjection({ unsupportedOutcomeKinds: ['PENDING_DIRECTION_PROJECTION'] }) }] })]).perCandidate[0];
      var def = bridgeCandidates([scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:d:0', projection: scProjection({ deferCode: 'DEFER_MECHANICS_PROJECTION', unsupportedOutcomeKinds: ['COPY_EXECUTION'] }) }] })]).perCandidate[0];
      return pend.pdaPending.length === 1 && pend.pdaPending[0].kind === 'PENDING_DIRECTION_PROJECTION' && pend.bifInput.directFacts.length === 0 &&
        def.pdaDeferred.length === 1 && def.pdaDeferred[0].kind === 'DEFER_MECHANICS_PROJECTION';
    }(), {});
    add('zeroProjectionFatal', function () {
      var z = bridgeCandidates([scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:z:0', projection: scProjection({}) }] })]).perCandidate[0];
      return z.fatalViolations.length === 1 && z.fatalViolations[0].kind === 'ZERO_SUPPORTED_PROJECTION' && z.fatalViolations[0].sourceEffectId === 'effect:z:0';
    }(), {});
    add('noOfficialEffect', function () {
      var kinds = NO_OFFICIAL_EFFECT_KINDS.map(function (k) {
        return bridgeCandidates([scBaseCandidate({ frozenCandidate: scCandidate('cand-' + k, k) })]).perCandidate[0].noOfficialEffectMaterialization[0].kind;
      });
      return JSON.stringify(kinds) === JSON.stringify(NO_OFFICIAL_EFFECT_KINDS);
    }(), {});
    add('publicDeclarationsExplicitSource', bridgeCandidates([scBaseCandidate({ declaration: { publicDeclarations: { revealStrength: 0.4, declaredOverkill: 0.3 } } })]).perCandidate[0].bifInput.publicDeclarations.revealStrength === 0.4 && !hasOwn(bridgeCandidates([scBaseCandidate({ declaration: {} })]).perCandidate[0].bifInput, 'publicDeclarations'), {});
    add('creationProfileTranscribed', function () {
      var ok = bridgeCandidates([scBaseCandidate({ creationProfile: { recipientId: '古月', useEffects: [
        { 原型: '资源变化', 目标: '自身', 资源: ['生命', '体力'], 数值: '+18%', 生效方式: '独立生效' },
        { 原型: '属性修正', 目标: '自身', 资源: '力量', 数值: '+5' }
      ] } })]).perCandidate[0].bifInput.creationProfile;
      var absent = !hasOwn(bridgeCandidates([scBaseCandidate()]).perCandidate[0].bifInput, 'creationProfile');
      var badRecipient = false;
      try { bridgeCandidates([scBaseCandidate({ creationProfile: { recipientId: '', useEffects: [] } })]); }
      catch (e) { badRecipient = (e && (e.code || e.reasonCode)) === 'MISSING_REQUIRED_FIELD'; }
      var badDuplicateResource = false;
      try { bridgeCandidates([scBaseCandidate({ creationProfile: { recipientId: '古月', useEffects: [{ 原型: '资源变化', 目标: '自身', 资源: ['生命', '生命'], 数值: '+18%' }] } })]); }
      catch (e) { badDuplicateResource = (e && (e.code || e.reasonCode)) === 'INVALID_OPTION_VALUE'; }
      return absent && badRecipient && badDuplicateResource && !!ok &&
        ok.recipientId === '古月' && ok.useEffects.length === 2 &&
        JSON.stringify(ok.useEffects[0]) === JSON.stringify({ 原型: '资源变化', 目标: '自身', 资源: ['生命', '体力'], 数值: '+18%' }) &&
        !hasOwn(ok.useEffects[0], '生效方式');
    }(), {});
    add('triggerLimitObjectVerbatim', function () {
      var o = bridgeCandidates([scBaseCandidate({ pdaProjections: [{
        sourceEffectId: 'effect:tl:0',
        projection: scProjection({ opportunityModifiers: { mechanicMetadataEntries: [{ sourceEffectId: 'effect:tl:0', 生效方式: '独立生效', 触发限制: { 周期: '每战', 次数: 1 } }] } })
      }] })]).perCandidate[0];
      var mm = o.bifInput.mechanicMetadataEntries;
      return mm.length === 1 && mm[0].sourceEffectId === 'effect:tl:0' && mm[0]['触发限制'] &&
        typeof mm[0]['触发限制'] === 'object' && mm[0]['触发限制']['周期'] === '每战' && mm[0]['触发限制']['次数'] === 1;
    }(), {});
    add('followUpIdentityVerbatim', function () {
      var row = {
        entryId: 'effect:fu:0:schedule:0',
        grantType: 'FOLLOW_UP',
        ownerId: 'actor-1',
        followUpKey: 'follow-up-1',
        triggerKey: '主动触发',
        maxActions: 2,
        payloadDirectFacts: [{
          schemaVersion: 'DirectFactRowV1',
          factType: 'HP_DELTA',
          key: '',
          sourceActionId: 'action:actor-1',
          sourceActorId: 'actor-1',
          sourceEffectId: 'effect:fu:0',
          targetIds: ['enemy-1'],
          amount: 1,
          unit: 'POWER',
          durationTurns: 0
        }]
      };
      var o = bridgeCandidates([scBaseCandidate({ pdaProjections: [{
        sourceEffectId: 'effect:fu:0',
        projection: scProjection({ scheduledFacts: [row] })
      }] })]).perCandidate[0];
      return JSON.stringify(o.bifInput.scheduledFacts[0]) === JSON.stringify(row);
    }(), {});
    add('totalsSums', function () {
      var o = bridgeCandidates([
        scBaseCandidate(),
        scBaseCandidate({ pdaProjections: [{ sourceEffectId: 'effect:c2:0', projection: scProjection({ directFacts: [scRow()] }) }], contributions: [] })
      ]);
      return o.totals.candidateCount === 2 && o.totals.pdaItems === 2 && o.totals.compiledCount === 2 &&
        o.totals.rejectionSum === o.perCandidate[0].rejections.length + o.perCandidate[1].rejections.length &&
        o.totals.pendingSum === o.perCandidate[0].pdaPending.length + o.perCandidate[1].pdaPending.length &&
        o.totals.deferSum === o.perCandidate[0].pdaDeferred.length + o.perCandidate[1].pdaDeferred.length &&
        o.totals.fatalSum === o.perCandidate[0].fatalViolations.length + o.perCandidate[1].fatalViolations.length &&
        o.totals.untranscribedSum === o.perCandidate[0].untranscribedPreviewFacts.count + o.perCandidate[1].untranscribedPreviewFacts.count;
    }(), {});
    add('deepFrozenDeterministic', function () {
      var a = bridgeCandidates([scBaseCandidate()]);
      var b = bridgeCandidates([scBaseCandidate()]);
      function frozen(v, seen) {
        if (v === null || typeof v !== 'object') return true;
        if (seen.has(v)) return true;
        seen.add(v);
        if (!Object.isFrozen(v)) return false;
        for (var k in v) if (hasOwn(v, k) && !frozen(v[k], seen)) return false;
        return true;
      }
      return frozen(a, new Set()) && JSON.stringify(a) === JSON.stringify(b);
    }(), {});

    var passed = true;
    for (var c = 0; c < checks.length; c += 1) if (checks[c].counted && !checks[c].passed) passed = false;
    return { schemaVersion: SCHEMA_VERSION, role: ROLE, revision: REVISION, passed: passed, sourceSelfCheckable: sourceSelfCheckable, checks: checks };
  }

  var api = {
    bridgeCandidates: bridgeCandidates,
    bridgeCandidate: function (input) {
      metrics = freshMetrics();
      var per = bridgeCandidate(input, metrics);
      return freezeDeep(per);
    },
    registry: function () { return freezeDeep(buildRegistry()); },
    readMetrics: readMetrics,
    selfCheck: function (sourceText, loadedHashes) { return runSelfCheck(sourceText, loadedHashes); }
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

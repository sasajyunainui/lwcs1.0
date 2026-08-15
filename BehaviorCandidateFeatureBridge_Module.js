// BehaviorCandidateFeatureBridge_Module.js
// M2 candidate-feature bridge writer C - revision 2 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority (frozen, disk-verified):
//   tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.json       a84f43bd6179f1de529700175a75ba5bdf755d51c86e899b96f81c66b5ee125c
//   tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.schema.json 11e9a0656ae589dcaa1a49a425f3d934082af2bd4c6d300d901cc1300a74dc0a
//   BehaviorImmediateFeature_Module.js                              8add454b2197c8bf5be825c5584ade4369343c6eb62cac391f51cdd1bfd2cb6c
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.json             6c781ddbd2a970b25193743f9d5a26a527b4b041824485abf2e8958880c641f5
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json     686e41a085ae83a3b04bca1deea61f5a063fa75fdb52805fd3bfe927587f7937
//   tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json           7b98b599214824632181dca252f58700603876d4425f8fa7c7cb3cb351a9bea0
//   BehaviorPrototypeAdapter_Module.js                              6924daa535b98e369da67b924bcd0a4e957ed6bf4ca2a9bc9aaa2184c6886c70
//   tools/rc6/contracts/PrototypeDirectAdapterV1.json               4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e
//   tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json        7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22
//   tools/rc6/cases/PrototypeDirectAdapterCasesV1.json              f8a4c4e002d63718a112987f1cb8c9b1c6baa7a3438a81ea348d7f8e39e43c2d
//   tools/rc6/contracts/DirectFactRowV1.json                        7edd6a9fe2448764ba8ff18450d3536cc05e74fc6970560b90496d3ec8da7d67
//   tools/rc6/contracts/DirectFactRowV1.schema.json                0325e39cd33ecf1c925268d451f23c3bde4d75eca3b5405b614c255b931b0538
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.json             8f5ebca2c856ab01883484bff10e321ac5c61963d5dbd74740786c00296a774c (read-only, untrained)
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.schema.json      19f5513677600ec24112346a8069df577b39492f4ec43f5c4eaead0d71a95b0b (read-only, untrained)
// One-pass transcription bridge: prepared CANDIDATES_ONLY frozen candidate + public
// visible snapshot + preview DECISION_VISIBLE atomic contributions + per-effect PDA
// projection records + candidate declaration -> BIF input rev6 production subset.
// Strictly no R8 selection, no old shadow, no future-route, no world clone, no result
// enumeration, no hidden reads, no teacher, no wall clock, no Runtime/loader wiring.
// mechanicMetadataEntries/projectionFamilies are lifted (aggregated verbatim, never
// scored/weighted); scheduledFacts are verbatim (entryId already stamped by PDA);
// opportunityModifiers are transcribed minus the lifted keys; test-only keys
// (forbiddenFacts/branchCombination/preMultiplied) are never emitted; paymentMode
// follows paymentModeDerivationV1; ZERO_SUPPORTED_PROJECTION is fatal and counted.
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var SCHEMA_VERSION = 'BehaviorCandidateFeatureBridgeV1';
  var REGISTRY_ID = 'RC6-M2-BEHAVIOR-CANDIDATE-FEATURE-BRIDGE-V1-2026-08-14';
  var REVISION = 2;

  var CONTRACT_HASHES = {
    bridgeContract: 'a84f43bd6179f1de529700175a75ba5bdf755d51c86e899b96f81c66b5ee125c',
    bridgeSchema: '11e9a0656ae589dcaa1a49a425f3d934082af2bd4c6d300d901cc1300a74dc0a',
    featureModule: '8add454b2197c8bf5be825c5584ade4369343c6eb62cac391f51cdd1bfd2cb6c',
    featureContract: '6c781ddbd2a970b25193743f9d5a26a527b4b041824485abf2e8958880c641f5',
    featureSchema: '686e41a085ae83a3b04bca1deea61f5a063fa75fdb52805fd3bfe927587f7937',
    featureCases: '7b98b599214824632181dca252f58700603876d4425f8fa7c7cb3cb351a9bea0',
    adapterModule: '6924daa535b98e369da67b924bcd0a4e957ed6bf4ca2a9bc9aaa2184c6886c70',
    adapterContract: '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
    adapterSchema: '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
    adapterCases: 'f8a4c4e002d63718a112987f1cb8c9b1c6baa7a3438a81ea348d7f8e39e43c2d',
    directFactRow: '7edd6a9fe2448764ba8ff18450d3536cc05e74fc6970560b90496d3ec8da7d67',
    policyContract: '8f5ebca2c856ab01883484bff10e321ac5c61963d5dbd74740786c00296a774c',
    policySchema: '19f5513677600ec24112346a8069df577b39492f4ec43f5c4eaead0d71a95b0b'
  };

  var BIF_INPUT_KEYS = [
    'candidate', 'publicSnapshot', 'atomicFacts', 'directFacts', 'legalityModifiers',
    'opportunityModifiers', 'scheduledFacts', 'mechanicMetadataEntries',
    'projectionFamilies', 'publicCost', 'publicProbability', 'publicDeclarations'
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

  var FORBIDDEN_CALL_TOKENS = [
    'require(', 'import(', 'import ', 'fetch(', 'XMLHttpRequest', 'WebSocket',
    'localStorage', 'sessionStorage', 'process.', 'module.exports', 'eval(', 'new Function',
    'Math.random', 'Date.now', 'performance.now', 'decide(', 'runProvider(',
    'teacherOutput(', 'factColumns', 'simpleAdapter', 'worldClone(', 'structuredClone(',
    'futureRoute(', 'kernelRoute(', 'resultCartesian(', 'enumerateCandidates('
  ];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
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
    if (!ev || typeof ev !== 'object' || !isFiniteNumber(ev.hitProbability)) return 'non-finite hitProbability';
    return null;
  }

  function atomicFromContributions(candidate, contributions) {
    var facts = [];
    var untranscribed = [];
    var list = Array.isArray(contributions) ? contributions : [];
    for (var i = 0; i < list.length; i += 1) {
      var c = list[i];
      if (c === null || typeof c !== 'object') { untranscribed.push({ reason: 'missing outcomeKind', index: i }); continue; }
      var sourceOk = typeof c.sourceActionId === 'string' && c.sourceActionId.length > 0 &&
        candidate && typeof candidate.actorId === 'string' && c.sourceActionId.indexOf(candidate.actorId) >= 0;
      var reason = untranscribedReasonOf(c);
      if (!sourceOk && !reason) reason = 'unmatched contribution source';
      if (reason) { untranscribed.push({ reason: reason, index: i }); continue; }
      facts.push({
        eventId: c.eventId,
        sourceActionId: c.sourceActionId,
        outcomeKind: c.outcomeKind,
        expectedDelta: normZero(c.expectedDelta),
        hitCheckApplicability: 'APPLICABLE',
        evidence: { hitProbability: normZero(c.evidence.hitProbability) }
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

  function bridgeCandidate(input, m) {
    if (!input || typeof input !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'candidate input' });
    var cand = input.frozenCandidate;
    if (!cand || typeof cand !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'frozenCandidate' });
    validateIdString(cand.candidateId, 'frozenCandidate.candidateId');
    validateIdString(cand.actorId, 'frozenCandidate.actorId');
    validateIdString(cand.actorSide, 'frozenCandidate.actorSide');
    validateIdString(cand.actionKind, 'frozenCandidate.actionKind');
    if (!Array.isArray(cand.targetSet) || cand.targetSet.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'frozenCandidate.targetSet' });
    var world = input.visibleWorld;
    if (!world || typeof world !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'visibleWorld' });
    var declaration = input.declaration && typeof input.declaration === 'object' ? input.declaration : {};
    var paymentMode = derivePaymentMode(cand, declaration);
    var atomic = atomicFromContributions(cand, input.contributions);
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
      publicSnapshot: cloneDeep(world),
      atomicFacts: atomic.atomicFacts,
      directFacts: lifted.directFacts,
      legalityModifiers: lifted.legalityModifiers,
      opportunityModifiers: lifted.opportunityModifiers,
      scheduledFacts: lifted.scheduledFacts,
      mechanicMetadataEntries: lifted.mechanicMetadataEntries,
      projectionFamilies: lifted.projectionFamilies
    };
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
    var work = 13 + bifInput.directFacts.length + bifInput.scheduledFacts.length +
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
      workFormula: 'per candidate 13 (F0) + directFacts rows + scheduledFacts entries + atomicFacts entries + metadata entries; no wall clock; BIF caps referenced whole-compile'
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
    return { eventId: eventId, sourceActionId: sourceActionId || 'action:actor-1', outcomeKind: outcomeKind, expectedDelta: delta, evidence: { hitProbability: prob } };
  }
  function scProjection(over) {
    var base = { directFacts: [], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
    if (over) for (var k in over) if (hasOwn(over, k)) base[k] = over[k];
    return base;
  }
  function scRow() {
    return { schemaVersion: 'DirectFactRowV1', factType: 'HP_DELTA', key: '', sourceActionId: 'action:actor-1', sourceActorId: 'actor-1', sourceEffectId: 'effect:sc:0', targetIds: ['enemy-1'], amount: 60, unit: 'POWER', durationTurns: 0 };
  }
  function scBaseCandidate(extra) {
    var c = {
      frozenCandidate: scCandidate('cand-sc'),
      visibleWorld: scWorld(),
      contributions: [scContrib('evt:sc:0', 'HP_DELTA', -60, 0.8)],
      pdaProjections: [{ sourceEffectId: 'effect:sc:0', projection: scProjection({ directFacts: [scRow()], opportunityModifiers: { mechanicMetadataEntries: [{ sourceEffectId: 'effect:sc:0', 生效方式: '独立生效' }], projectionFamilies: [{ sourceEffectId: 'effect:sc:0', prototype: '伤害结算' }] } }) }],
      declaration: { publicCost: [{ resource: '魂力', amount: 20 }], publicProbability: { hitProbability: 0.8, source: 'DECLARED' } }
    };
    if (extra) for (var k in extra) if (hasOwn(extra, k)) c[k] = extra[k];
    return c;
  }

  function runSelfCheck(sourceText) {
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
      CONTRACT_HASHES.bridgeContract === 'a84f43bd6179f1de529700175a75ba5bdf755d51c86e899b96f81c66b5ee125c' &&
      CONTRACT_HASHES.bridgeSchema === '11e9a0656ae589dcaa1a49a425f3d934082af2bd4c6d300d901cc1300a74dc0a' &&
      CONTRACT_HASHES.featureModule === '8add454b2197c8bf5be825c5584ade4369343c6eb62cac391f51cdd1bfd2cb6c' &&
      CONTRACT_HASHES.featureContract === '6c781ddbd2a970b25193743f9d5a26a527b4b041824485abf2e8958880c641f5' &&
      CONTRACT_HASHES.featureSchema === '686e41a085ae83a3b04bca1deea61f5a063fa75fdb52805fd3bfe927587f7937' &&
      CONTRACT_HASHES.featureCases === '7b98b599214824632181dca252f58700603876d4425f8fa7c7cb3cb351a9bea0' &&
      CONTRACT_HASHES.adapterModule === '6924daa535b98e369da67b924bcd0a4e957ed6bf4ca2a9bc9aaa2184c6886c70' &&
      CONTRACT_HASHES.adapterContract === '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e' &&
      CONTRACT_HASHES.adapterSchema === '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22' &&
      CONTRACT_HASHES.adapterCases === 'f8a4c4e002d63718a112987f1cb8c9b1c6baa7a3438a81ea348d7f8e39e43c2d', { pins: Object.keys(CONTRACT_HASHES).length });
    add('enumsClosed', REJECT_CODES.length === 8 && PENDING_KINDS.length === 5 && DEFER_KINDS.length === 3 && UNTRANSCRIBED_REASONS.length === 5 && NO_OFFICIAL_EFFECT_KINDS.length === 4 && HARD_EXCLUSION_CODES.length === 10 && TEST_ONLY_KEYS.length === 3, {});
    add('bifInputKeysClosed', BIF_INPUT_KEYS.length === 12 && TEST_ONLY_KEYS.every(function (k) { return BIF_INPUT_KEYS.indexOf(k) < 0; }), {});

    var base = bridgeCandidates([scBaseCandidate()]);
    var pc = base.perCandidate[0];
    var bi = pc.bifInput;
    add('baseCompiles', base.totals.candidateCount === 1 && base.totals.compiledCount === 1 && pc.candidateId === 'cand-sc' && base.totals.pdaItems === 1, base.totals);
    add('bifInputProductionSubset', Object.keys(bi).every(function (k) { return BIF_INPUT_KEYS.indexOf(k) >= 0; }) && TEST_ONLY_KEYS.every(function (k) { return !hasOwn(bi, k); }) && bi.candidate.paymentMode === 'FORMAL' && Array.isArray(bi.mechanicMetadataEntries) && bi.mechanicMetadataEntries.length === 1 && Array.isArray(bi.projectionFamilies) && bi.projectionFamilies.length === 1 && !hasOwn(bi.opportunityModifiers, 'mechanicMetadataEntries') && !hasOwn(bi.opportunityModifiers, 'projectionFamilies') && bi.directFacts.length === 1 && bi.atomicFacts.length === 1 && pc.untranscribedPreviewFacts.count === 0, { keys: Object.keys(bi) });
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
      return bad.untranscribedPreviewFacts.count === 5 && bad.bifInput.atomicFacts.length === 0 &&
        JSON.stringify(reasons) === JSON.stringify(['missing eventId', 'missing outcomeKind', 'non-finite expectedDelta', 'non-finite hitProbability', 'unmatched contribution source'].sort());
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
    selfCheck: function (sourceText) { return runSelfCheck(sourceText); }
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

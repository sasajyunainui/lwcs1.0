// BehaviorImmediateFeature_Module.js
// M2 immediate feature compiler writer F - revision 2 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority (frozen, disk-verified):
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.json       5715f6125beacd49234c5edb2604286d5ce8828e23da8a3a13a46f744a6683ad
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json e3036e6a5171ee512fbea859268924c0ea696174cbb55854f8b6d0364f690015
//   tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json       e5bef21c6d76c94d989a921f55605193bfb0314359c44d28a0f93160ee4a3501
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.json         abac2935300fd4a9a9cc0a623e1d8be4516df51e268b0f541205511f5f978679 (read-only, untrained)
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.schema.json  6314cc703ddaf56298331fb4c72e5bbf74df3c1516b05912a20185a6ed90693c (read-only, untrained)
// Governed frozen sources (read-only): BehaviorProviderV1 cc32c251236906c5e128164f76a25a1196ebe089ef7903edb454e3374a90f156;
//   PrototypeDirectAdapterV1 390d5f2efe0409301cfb894c30c4312e16d7d488a386aa943f008718e65fb0bb;
//   PrototypeDirectAdapterV1.schema ca17d0d8c1d526001fd65941768d4e996c2dfb6488d3e7b484c66343b3f85ed3;
//   DirectFactRowV1 6a1951015a6bde4f00db502c8ce7805888942251f2c38507fe2769265f589fa1.
// Revision 2 boundary: CANDIDATES_ONLY pure compiler; closed input contract; real ids (CJK/
// hyphen/space ok, <=512, C0/DEL rejected); actor identity (actorId/actorSide/sides) with no
// prefix guessing, no neutral folding, no default ALLY; cost reads units[actorId] only;
// explicit hitCheckApplicability (no actionKind special casing); scheduledFacts never silent
// (counted with entryId in sourceEventIds); STATE_PRESENCE KNOWN only for BOOL rows with
// value in {0,1} (COUNT rows are UNKNOWN(STATE_FORM_UNMAPPED)); 23 raw features in stable
// UTF-16 order; value exists only for KNOWN; raw units preserved; no normalization constants,
// no scoring weights, no skill/prototype-name weighting; no Decision/Preview/Provider
// invocation; no future-route/world-clone/result enumeration; no Runtime/loader wiring.
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var REVISION = 2;
  var REGISTRY_ID = 'RC6-M2-BEHAVIOR-IMMEDIATE-FEATURE-V1-2026-08-14';
  var SCHEMA_VERSION = 'BehaviorImmediateFeatureV1';
  var F0 = 13;

  var CAPS = {
    MAX_FEATURES_PER_CANDIDATE: 256,
    MAX_FACT_ROWS_PER_CANDIDATE: 128,
    MAX_MODIFIER_ENTRIES_PER_CANDIDATE: 64,
    MAX_WORK_UNITS_PER_CALL: 200000,
    fixedCandidateFeatureCount: F0
  };

  var FEATURE_CODES = [
    'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE', 'SUCCESS_PROBABILITY',
    'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY',
    'REVEAL_STRENGTH', 'OVERKILL_AVAILABILITY', 'HARD_EXCLUSION',
    'HARD_EXCLUSION_REASON', 'SETTLEMENT_DAMAGE', 'ROLL_REALIZATION',
    'OUTSIDE_BATCH1_ROW_COUNT', 'DAMAGE_POWER', 'DAMAGE_SEGMENTS',
    'DAMAGE_PENETRATION', 'DAMAGE_TYPE', 'RESOURCE_DELTA', 'SHIELD_DELTA',
    'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'STATE_PRESENCE', 'STATE_DURATION'
  ];
  var CANDIDATE_CODES = FEATURE_CODES.slice(0, 13);
  var ROW_CODES = FEATURE_CODES.slice(13);

  var UNIT_FAMILY = {
    'RELATION_TARGET_COUNT': 'COUNT',
    'RELATION_TARGET_SIDE': 'ENUM',
    'SUCCESS_PROBABILITY': 'PROBABILITY_0_1',
    'PUBLIC_HP_RATIO': 'RATIO_0_1',
    'PUBLIC_RESOURCE_RATIO': 'RATIO_0_1',
    'COST_AFFORDABILITY': 'RATIO_0_1',
    'REVEAL_STRENGTH': 'RATIO_0_1',
    'OVERKILL_AVAILABILITY': 'BOOL',
    'HARD_EXCLUSION': 'BOOL',
    'HARD_EXCLUSION_REASON': 'ENUM',
    'SETTLEMENT_DAMAGE': 'ABS',
    'ROLL_REALIZATION': 'BOOL',
    'OUTSIDE_BATCH1_ROW_COUNT': 'COUNT',
    'DAMAGE_POWER': 'POWER',
    'DAMAGE_SEGMENTS': 'COUNT',
    'DAMAGE_PENETRATION': 'PERCENT',
    'DAMAGE_TYPE': 'BOOL',
    'RESOURCE_DELTA': 'ABS',
    'SHIELD_DELTA': 'ABS',
    'ATTRIBUTE_DELTA': 'PERCENT',
    'JUDGMENT_DELTA': 'PERCENT',
    'STATE_PRESENCE': 'BOOL',
    'STATE_DURATION': 'TURNS'
  };
  var UNIT_FAMILIES = ['COUNT', 'ABS', 'POWER', 'PERCENT', 'RATIO_0_1', 'PROBABILITY_0_1', 'TURNS', 'BOOL', 'ENUM'];
  var BOOL_CODES = ['OVERKILL_AVAILABILITY', 'HARD_EXCLUSION', 'DAMAGE_TYPE', 'STATE_PRESENCE'];

  var ATTRIBUTE_KEYS = ['力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限'];
  var JUDGMENT_KEYS = ['命中', '闪避', '反应'];
  var RESOURCE_FIELD = { '魂力': 'sp', '精神力': 'men', '体力': 'vit', '生命': 'hp' };
  var RESOURCE_NAMES = ['魂力', '精神力', '体力', '生命'];
  var UNIT_ENUM = ['POWER', 'ABS', 'PERCENT', 'RATIO', 'COUNT', 'TURNS', 'DISTANCE', 'BOOL'];
  var FACT_TYPE_ENUM = [
    'HP_DELTA', 'RESOURCE_OPTION_CHANGED', 'SHIELD_DELTA', 'STATE_DELTA',
    'SCHEDULED_HP_DELTA', 'SUMMON_WINDOW', 'RESOURCE_TRANSFER', 'RULE_DEFENSE_COUNTER',
    'POSITION_DELTA', 'COPY_EXECUTION', 'TIME_REWIND'
  ];
  var SYMBOLIC_TARGETS = ['自身', '单体', '群体', '全场', '召唤物', '目标', 'target', 'actor', 'self'];
  var HARD_EXCLUSION_CODES = [
    'ACTOR_DISABLED', 'ACTOR_TERMINAL', 'TARGET_EMPTY', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_STATE', 'UNKNOWN_RULE', 'AMBIGUOUS_TAUNT_TARGET',
    'ILLEGAL_TARGET', 'RESOURCE_INSUFFICIENT'
  ];
  var UNKNOWN_REASONS = [
    'NO_PUBLIC_DECLARATION', 'CONDITIONAL_PROBABILITY_UNRESOLVED', 'FINAL_SETTLEMENT_UNKNOWN',
    'FUTURE_REALIZATION_UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', 'MISSING_SOURCE_FACT',
    'SIDE_UNOBSERVED', 'STATE_FORM_UNMAPPED'
  ];
  var NA_REASONS = ['NO_TARGET_AXIS', 'NO_HIT_AXIS', 'NO_PUBLIC_COST', 'NOT_EXCLUDED', 'NO_DURATION'];
  var HIT_APPLICABILITY = ['APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN'];
  var ACTOR_STATUSES = ['NORMAL', 'DISABLED', 'TERMINAL', 'UNKNOWN'];

  var BATCH1_FAMILY = {
    '伤害结算': ['DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE'],
    '资源变化': ['RESOURCE_DELTA'],
    '护盾变化': ['SHIELD_DELTA'],
    '属性修正': ['ATTRIBUTE_DELTA', 'STATE_DURATION'],
    '判定修正': ['JUDGMENT_DELTA', 'STATE_DURATION'],
    '状态施加/状态移除': ['STATE_PRESENCE', 'STATE_DURATION']
  };

  var FORBIDDEN_SOURCE_CODE = {
    'ROUTE': 'ROUTE_INPUT_REJECTED',
    'WORLD_CLONE': 'WORLD_CLONE_REJECTED',
    'RESULT_WORLD': 'RESULT_WORLD_CARTESIAN_REJECTED',
    'HIDDEN': 'HIDDEN_INPUT_REJECTED',
    'WALL_CLOCK': 'WALL_CLOCK_REJECTED',
    'SKILL_ROLE_NAME': 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
    'TEACHER': 'TEACHER_INPUT_REJECTED'
  };
  var FORBIDDEN_TOP_KEY = {
    'route': 'ROUTE_INPUT_REJECTED',
    'worldClone': 'WORLD_CLONE_REJECTED',
    'resultWorld': 'RESULT_WORLD_CARTESIAN_REJECTED',
    'hidden': 'HIDDEN_INPUT_REJECTED',
    'wallClock': 'WALL_CLOCK_REJECTED',
    'skillRoleName': 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
    'teacher': 'TEACHER_INPUT_REJECTED',
    'kernelRouteValue': 'ROUTE_INPUT_REJECTED'
  };

  var INPUT_KEYS = [
    'candidate', 'publicSnapshot', 'atomicFacts', 'directFacts', 'legalityFlags',
    'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'publicCost',
    'publicProbability', 'publicDeclarations', 'forbiddenFacts', 'branchCombination',
    'preMultiplied'
  ];
  var CANDIDATE_KEYS = ['candidateId', 'actorId', 'actorSide', 'actionKind', 'targetSet', 'paymentMode'];
  var SNAPSHOT_KEYS = ['units', 'sides', 'actorStatus'];
  var UNIT_FIELDS = ['hp', 'hp_max', 'sp', 'sp_max', 'men', 'men_max', 'vit', 'vit_max', 'def', 'agi', 'shield', '状态效果'];
  var NUMERIC_UNIT_FIELDS = ['hp', 'hp_max', 'sp', 'sp_max', 'men', 'men_max', 'vit', 'vit_max', 'def', 'agi', 'shield'];
  var ATOMIC_KEYS = ['eventId', 'sourceActionId', 'outcomeKind', 'expectedDelta', 'hitCheckApplicability', 'evidence'];
  var EVIDENCE_KEYS = ['hitProbability'];
  var ROW_KEYS = ['schemaVersion', 'factType', 'key', 'sourceActionId', 'sourceActorId', 'sourceEffectId', 'targetIds', 'amount', 'unit', 'durationTurns'];
  var LM_KEYS = ['judgmentRates', 'taunt', 'tauntRemoved', 'stateMigration', 'stateSwap', 'mechanismRemoval', 'hardExclusions', 'legalityFlags'];
  var OM_KEYS = ['resourceLocks', 'opportunityConstraints', 'interferenceRates', 'dependencyTokens'];
  var SCHED_KEYS = ['entryId', 'operation', 'triggerKey', 'maxActions', 'payload'];
  var TRIGGER_ENUM = ['主动触发', '随下次行动触发'];
  var COST_KEYS = ['resource', 'amount'];
  var DECL_KEYS = ['revealStrength', 'declaredOverkill'];
  var FORBIDDEN_FACT_KEYS = ['source', 'fact'];

  var CONTRACT_HASHES = {
    featureContract: '5715f6125beacd49234c5edb2604286d5ce8828e23da8a3a13a46f744a6683ad',
    featureSchema: 'e3036e6a5171ee512fbea859268924c0ea696174cbb55854f8b6d0364f690015',
    featureCases: 'e5bef21c6d76c94d989a921f55605193bfb0314359c44d28a0f93160ee4a3501',
    policyContract: 'abac2935300fd4a9a9cc0a623e1d8be4516df51e268b0f541205511f5f978679',
    policySchema: '6314cc703ddaf56298331fb4c72e5bbf74df3c1516b05912a20185a6ed90693c',
    governed: {
      provider: 'cc32c251236906c5e128164f76a25a1196ebe089ef7903edb454e3374a90f156',
      adapterContract: '390d5f2efe0409301cfb894c30c4312e16d7d488a386aa943f008718e65fb0bb',
      adapterSchema: 'ca17d0d8c1d526001fd65941768d4e996c2dfb6488d3e7b484c66343b3f85ed3',
      directFactRow: '6a1951015a6bde4f00db502c8ce7805888942251f2c38507fe2769265f589fa1'
    }
  };

  var FORBIDDEN_CALL_TOKENS = [
    'require(', 'import(', 'import ', 'fetch(', 'XMLHttpRequest', 'WebSocket',
    'localStorage', 'sessionStorage', 'process.', 'module.exports', 'eval(', 'new Function',
    'Math.random', 'Date.now', 'performance.now', 'decide(', 'runProvider(',
    'teacherOutput(', 'factColumns', 'simpleAdapter', 'worldClone(', 'structuredClone(',
    'futureRoute(', 'kernelRoute(', 'resultCartesian('
  ];
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function normZero(v) { return v === 0 ? 0 : v; }
  function toFiniteNumber(x, where) {
    var n = (typeof x === 'string') ? Number(x) : x;
    if (typeof n !== 'number' || !isFinite(n)) throw rejection('NON_FINITE_REJECTED', { field: where, raw: String(x) });
    return n === 0 ? 0 : n;
  }
  function rejection(code, detail) {
    var e = new Error(code + (detail ? ' :: ' + JSON.stringify(detail) : ''));
    e.code = code;
    e.reasonCode = code;
    e.detail = detail === undefined ? null : detail;
    return e;
  }
  function dedupSort(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i += 1) if (out.indexOf(arr[i]) < 0) out.push(arr[i]);
    out.sort(cmpStr);
    return out;
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
  function rec(code, family, status, reason, value, factIds, eventIds, scopeRank, seid, key) {
    var f = {
      featureCode: code,
      unitFamily: family,
      status: status,
      reasonCode: reason,
      sourceFactIds: factIds.slice(),
      sourceEventIds: dedupSort(eventIds || []),
      _scopeRank: scopeRank,
      _seid: seid,
      _key: key
    };
    if (status === 'KNOWN') f.value = normZero(value);
    return f;
  }
  function known(code, family, value) { return rec(code, family, 'KNOWN', 'OK', value, [], [], 0, '', ''); }
  function knownStr(code, family, value) { return rec(code, family, 'KNOWN', 'OK', value, [], [], 0, '', ''); }
  function unk(code, family, reason, factIds, eventIds) { return rec(code, family, 'UNKNOWN', reason, undefined, factIds || [], eventIds || [], 0, '', ''); }
  function na(code, family, reason) { return rec(code, family, 'NOT_APPLICABLE', reason, undefined, [], [], 0, '', ''); }
  function freshMetrics() {
    return { calls: 0, workUnitsTotal: 0, lastWorkUnits: 0, lastCandidateId: null, lastFeatureCount: 0, rejections: {}, lastRejection: null };
  }
  function rejectUnknownKeys(obj, allowed, field) {
    for (var k in obj) {
      if (hasOwn(obj, k) && allowed.indexOf(k) < 0) throw rejection('INVALID_OPTION_VALUE', { field: field, extraKey: k });
    }
  }
  function validateIdString(v, field) {
    if (typeof v !== 'string' || v.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: field });
    if (v.length > 512 || /[\u0000-\u001F\u007F]/.test(v)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    return v;
  }
  function checkForbiddenInput(input) {
    if (input.branchCombination === true) throw rejection('BRANCH_COMBINATION_FORBIDDEN');
    if (input.preMultiplied !== undefined) throw rejection('DURATION_MULTIPLIES_MAGNITUDE');
    if (Array.isArray(input.forbiddenFacts)) {
      for (var i = 0; i < input.forbiddenFacts.length; i += 1) {
        var f = input.forbiddenFacts[i];
        if (!f || typeof f !== 'object') throw rejection('UNKNOWN_FEATURE_CODE', { source: String(f) });
        rejectUnknownKeys(f, FORBIDDEN_FACT_KEYS, 'forbiddenFacts[]');
        var code = FORBIDDEN_SOURCE_CODE[f.source];
        if (!code) throw rejection('UNKNOWN_FEATURE_CODE', { source: String(f.source) });
        throw rejection(code, { source: f.source });
      }
    }
    for (var k in FORBIDDEN_TOP_KEY) {
      if (hasOwn(FORBIDDEN_TOP_KEY, k) && input[k] !== undefined) throw rejection(FORBIDDEN_TOP_KEY[k], { key: k });
    }
  }

  function validateTopLevelKeys(input) {
    rejectUnknownKeys(input, INPUT_KEYS, 'input');
  }

  function validateCandidate(input) {
    var cand = input.candidate;
    if (!cand || typeof cand !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate' });
    rejectUnknownKeys(cand, CANDIDATE_KEYS, 'candidate');
    for (var i = 0; i < CANDIDATE_KEYS.length; i += 1) {
      if (cand[CANDIDATE_KEYS[i]] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate.' + CANDIDATE_KEYS[i] });
    }
    validateIdString(cand.candidateId, 'candidate.candidateId');
    validateIdString(cand.actorId, 'candidate.actorId');
    validateIdString(cand.actorSide, 'candidate.actorSide');
    validateIdString(cand.actionKind, 'candidate.actionKind');
    validateIdString(cand.paymentMode, 'candidate.paymentMode');
    if (!Array.isArray(cand.targetSet)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate.targetSet' });
    var seen = {};
    for (var t = 0; t < cand.targetSet.length; t += 1) {
      var tid = cand.targetSet[t];
      if (typeof tid !== 'string' || tid.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate.targetSet[' + t + ']' });
      if (tid.length > 512 || /[\u0000-\u001F\u007F]/.test(tid)) throw rejection('INVALID_OPTION_VALUE', { field: 'candidate.targetSet[' + t + ']' });
      if (hasOwn(seen, tid)) throw rejection('INVALID_OPTION_VALUE', { field: 'candidate.targetSet', duplicate: tid });
      seen[tid] = true;
    }
  }

  function validateSnapshot(input) {
    var snap = input.publicSnapshot;
    if (!snap || typeof snap !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot' });
    rejectUnknownKeys(snap, SNAPSHOT_KEYS, 'publicSnapshot');
    for (var i = 0; i < SNAPSHOT_KEYS.length; i += 1) {
      if (snap[SNAPSHOT_KEYS[i]] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.' + SNAPSHOT_KEYS[i] });
    }
    if (ACTOR_STATUSES.indexOf(snap.actorStatus) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'publicSnapshot.actorStatus', value: String(snap.actorStatus) });
    var units = snap.units;
    if (typeof units !== 'object' || units === null || Array.isArray(units)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.units' });
    for (var uid in units) if (hasOwn(units, uid)) {
      var u = units[uid];
      if (!u || typeof u !== 'object' || Array.isArray(u)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.units.' + uid });
      rejectUnknownKeys(u, UNIT_FIELDS, 'publicSnapshot.units.' + uid);
      for (var f = 0; f < NUMERIC_UNIT_FIELDS.length; f += 1) {
        var fn = NUMERIC_UNIT_FIELDS[f];
        if (u[fn] !== undefined) toFiniteNumber(u[fn], 'units.' + uid + '.' + fn);
      }
      if (u['状态效果'] !== undefined && (typeof u['状态效果'] !== 'object' || u['状态效果'] === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'units.' + uid + '.状态效果' });
    }
    var sides = snap.sides;
    if (typeof sides !== 'object' || sides === null || Array.isArray(sides)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.sides' });
    for (var sid in sides) if (hasOwn(sides, sid)) {
      var sv = sides[sid];
      if (typeof sv !== 'string' || sv.length === 0 || sv.length > 512) throw rejection('INVALID_OPTION_VALUE', { field: 'publicSnapshot.sides.' + sid });
    }
    if (!hasOwn(sides, input.candidate.actorId) || sides[input.candidate.actorId] !== input.candidate.actorSide) {
      throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.sides.actorId', actorSide: input.candidate.actorSide });
    }
  }

  function validateAtomicFacts(input) {
    var facts = input.atomicFacts;
    if (facts === undefined) return;
    if (!Array.isArray(facts)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts' });
    for (var i = 0; i < facts.length; i += 1) {
      var f = facts[i];
      if (!f || typeof f !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[' + i + ']' });
      rejectUnknownKeys(f, ATOMIC_KEYS, 'atomicFacts[]');
      validateIdString(f.eventId, 'atomicFacts[].eventId');
      if (HIT_APPLICABILITY.indexOf(f.hitCheckApplicability) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].hitCheckApplicability', value: String(f.hitCheckApplicability) });
      if (f.expectedDelta !== undefined) toFiniteNumber(f.expectedDelta, 'atomicFacts.expectedDelta');
      if (f.sourceActionId !== undefined && (typeof f.sourceActionId !== 'string' || f.sourceActionId.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].sourceActionId' });
      if (f.outcomeKind !== undefined && (typeof f.outcomeKind !== 'string' || f.outcomeKind.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].outcomeKind' });
      if (f.hitCheckApplicability === 'APPLICABLE') {
        if (!f.evidence || typeof f.evidence !== 'object' || f.evidence.hitProbability === undefined) {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].evidence.hitProbability' });
        }
        toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability');
      } else if (f.evidence !== undefined) {
        if (typeof f.evidence !== 'object' || f.evidence === null) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence' });
        rejectUnknownKeys(f.evidence, EVIDENCE_KEYS, 'atomicFacts[].evidence');
        if (f.evidence.hitProbability !== undefined) toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability');
      }
    }
  }

  function validateDirectFactsRows(input) {
    var rows = input.directFacts;
    if (rows === undefined) return;
    if (!Array.isArray(rows)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts' });
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (!row || typeof row !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[' + i + ']' });
      rejectUnknownKeys(row, ROW_KEYS, 'directFacts[]');
      if (row.schemaVersion !== 'DirectFactRowV1') throw rejection('INVALID_OPTION_VALUE', { field: 'directFacts[].schemaVersion', value: String(row.schemaVersion) });
      if (typeof row.factType !== 'string' || FACT_TYPE_ENUM.indexOf(row.factType) < 0) throw rejection('UNKNOWN_FEATURE_CODE', { field: 'directFacts[].factType', value: String(row.factType) });
      if (typeof row.key !== 'string') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].key' });
      if (typeof row.sourceActionId !== 'string' || row.sourceActionId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceActionId' });
      if (typeof row.sourceActorId !== 'string' || row.sourceActorId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceActorId' });
      if (row.sourceActorId !== input.candidate.actorId) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceActorId', actorId: input.candidate.actorId });
      if (typeof row.sourceEffectId !== 'string' || row.sourceEffectId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceEffectId' });
      if (typeof row.unit !== 'string' || UNIT_ENUM.indexOf(row.unit) < 0) throw rejection('UNKNOWN_UNIT_FAMILY', { field: 'directFacts[].unit', value: String(row.unit) });
      if (row.amount === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].amount' });
      toFiniteNumber(row.amount, 'directFacts.amount');
      if (row.durationTurns === undefined || row.durationTurns === null) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].durationTurns' });
      var dur = toFiniteNumber(row.durationTurns, 'directFacts.durationTurns');
      if (dur < 0 || Math.floor(dur) !== dur) throw rejection('INVALID_OPTION_VALUE', { field: 'directFacts[].durationTurns', value: dur });
      if (!Array.isArray(row.targetIds) || row.targetIds.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].targetIds' });
      for (var j = 0; j < row.targetIds.length; j += 1) {
        var t = row.targetIds[j];
        if (typeof t !== 'string' || t.length === 0 || SYMBOLIC_TARGETS.indexOf(t) >= 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].targetIds', value: String(t) });
      }
    }
  }

  function validateLegalityCodeArray(arr, field) {
    if (!Array.isArray(arr)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    for (var i = 0; i < arr.length; i += 1) {
      if (HARD_EXCLUSION_CODES.indexOf(arr[i]) < 0) throw rejection('INVALID_OPTION_VALUE', { field: field, value: String(arr[i]) });
    }
  }

  function validateLegalityFlags(input) {
    if (input.legalityFlags !== undefined) validateLegalityCodeArray(input.legalityFlags, 'legalityFlags');
  }

  function validateLegalityModifiers(input) {
    var lm = input.legalityModifiers;
    if (lm === undefined) return;
    if (typeof lm !== 'object' || lm === null || Array.isArray(lm)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'legalityModifiers' });
    rejectUnknownKeys(lm, LM_KEYS, 'legalityModifiers');
    if (lm.hardExclusions !== undefined) validateLegalityCodeArray(lm.hardExclusions, 'legalityModifiers.hardExclusions');
    if (lm.legalityFlags !== undefined) validateLegalityCodeArray(lm.legalityFlags, 'legalityModifiers.legalityFlags');
    if (lm.judgmentRates !== undefined && !Array.isArray(lm.judgmentRates)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.judgmentRates' });
    if (lm.mechanismRemoval !== undefined && !Array.isArray(lm.mechanismRemoval)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.mechanismRemoval' });
    if (lm.taunt !== undefined && (typeof lm.taunt !== 'object' || lm.taunt === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.taunt' });
    if (lm.tauntRemoved !== undefined && (typeof lm.tauntRemoved !== 'object' || lm.tauntRemoved === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.tauntRemoved' });
    if (lm.stateMigration !== undefined && (typeof lm.stateMigration !== 'object' || lm.stateMigration === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.stateMigration' });
    if (lm.stateSwap !== undefined && (typeof lm.stateSwap !== 'object' || lm.stateSwap === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.stateSwap' });
  }

  function validateOpportunityModifiers(input) {
    var om = input.opportunityModifiers;
    if (om === undefined) return;
    if (typeof om !== 'object' || om === null || Array.isArray(om)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'opportunityModifiers' });
    rejectUnknownKeys(om, OM_KEYS, 'opportunityModifiers');
    if (om.resourceLocks !== undefined && !Array.isArray(om.resourceLocks)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.resourceLocks' });
    if (om.interferenceRates !== undefined && !Array.isArray(om.interferenceRates)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.interferenceRates' });
    if (om.dependencyTokens !== undefined && !Array.isArray(om.dependencyTokens)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.dependencyTokens' });
    if (om.opportunityConstraints !== undefined && (typeof om.opportunityConstraints !== 'object' || om.opportunityConstraints === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.opportunityConstraints' });
  }

  function validateScheduledFacts(input) {
    var sched = input.scheduledFacts;
    if (sched === undefined) return;
    if (!Array.isArray(sched)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts' });
    for (var i = 0; i < sched.length; i += 1) {
      var e = sched[i];
      if (!e || typeof e !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[' + i + ']' });
      rejectUnknownKeys(e, SCHED_KEYS, 'scheduledFacts[]');
      if (e.entryId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].entryId' });
      validateIdString(e.entryId, 'scheduledFacts[].entryId');
      if (e.operation !== undefined && (typeof e.operation !== 'string' || e.operation.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].operation' });
      if (e.triggerKey !== undefined && TRIGGER_ENUM.indexOf(e.triggerKey) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].triggerKey', value: String(e.triggerKey) });
      if (e.maxActions !== undefined) {
        var ma = toFiniteNumber(e.maxActions, 'scheduledFacts[].maxActions');
        if (ma < 0 || Math.floor(ma) !== ma) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', value: ma });
      }
      if (e.payload !== undefined && !Array.isArray(e.payload)) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].payload' });
    }
  }

  function validatePublicCost(input) {
    var cost = input.publicCost;
    if (cost === undefined) return;
    if (!Array.isArray(cost)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost' });
    for (var i = 0; i < cost.length; i += 1) {
      var e = cost[i];
      if (!e || typeof e !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost[' + i + ']' });
      rejectUnknownKeys(e, COST_KEYS, 'publicCost[]');
      if (e.resource === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost[].resource' });
      if (RESOURCE_NAMES.indexOf(e.resource) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'publicCost[].resource', value: String(e.resource) });
      if (e.amount === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost[].amount' });
      var amt = toFiniteNumber(e.amount, 'publicCost.amount');
      if (amt <= 0) throw rejection('INVALID_OPTION_VALUE', { field: 'publicCost[].amount', value: amt });
    }
  }

  function validatePublicProbability(input) {
    var pp = input.publicProbability;
    if (pp === undefined) return;
    if (typeof pp !== 'object' || pp === null || Array.isArray(pp)) throw rejection('INVALID_OPTION_VALUE', { field: 'publicProbability' });
    var keys = Object.keys(pp);
    if (pp.hitProbability !== undefined) {
      rejectUnknownKeys(pp, ['hitProbability', 'source'], 'publicProbability');
      toFiniteNumber(pp.hitProbability, 'publicProbability.hitProbability');
      if (pp.source !== undefined && (typeof pp.source !== 'string' || pp.source.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicProbability.source' });
    } else if (pp.resolved === false) {
      rejectUnknownKeys(pp, ['resolved', 'unresolvedCondition'], 'publicProbability');
      if (pp.unresolvedCondition !== undefined && (typeof pp.unresolvedCondition !== 'string' || pp.unresolvedCondition.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicProbability.unresolvedCondition' });
    } else {
      throw rejection('INVALID_OPTION_VALUE', { field: 'publicProbability', keys: keys });
    }
  }

  function validatePublicDeclarations(input) {
    var pd = input.publicDeclarations;
    if (pd === undefined) return;
    if (typeof pd !== 'object' || pd === null || Array.isArray(pd)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicDeclarations' });
    rejectUnknownKeys(pd, DECL_KEYS, 'publicDeclarations');
    if (pd.revealStrength !== undefined) toFiniteNumber(pd.revealStrength, 'publicDeclarations.revealStrength');
    if (pd.declaredOverkill !== undefined) toFiniteNumber(pd.declaredOverkill, 'publicDeclarations.declaredOverkill');
  }

  function validateInput(input) {
    checkForbiddenInput(input);
    validateTopLevelKeys(input);
    validateCandidate(input);
    validateSnapshot(input);
    validateAtomicFacts(input);
    validateDirectFactsRows(input);
    validateLegalityFlags(input);
    validateLegalityModifiers(input);
    validateOpportunityModifiers(input);
    validateScheduledFacts(input);
    validatePublicCost(input);
    validatePublicProbability(input);
    validatePublicDeclarations(input);
  }
  function expectUnit(unit, want) {
    if (unit !== want) throw rejection('UNIT_FAMILY_MISMATCH', { unit: unit, expected: want });
  }
  function kKnown(code, family, value) {
    return { featureCode: code, unitFamily: family, status: 'KNOWN', reasonCode: 'OK', value: normZero(value) };
  }
  function kUnknown(code, family, reason) {
    return { featureCode: code, unitFamily: family, status: 'UNKNOWN', reasonCode: reason };
  }
  function projectRow(factType, key, unit, amount, dur) {
    var out = [];
    if (factType === 'HP_DELTA') {
      if (key === '' || key === 'damage.power') {
        expectUnit(unit, 'POWER');
        out.push(kKnown('DAMAGE_POWER', 'POWER', amount));
      } else if (key === 'damage.segments') {
        expectUnit(unit, 'COUNT');
        out.push(kKnown('DAMAGE_SEGMENTS', 'COUNT', amount));
      } else if (key === 'damage.penetration') {
        expectUnit(unit, 'PERCENT');
        out.push(kKnown('DAMAGE_PENETRATION', 'PERCENT', amount));
      } else if (key === 'damage.type') {
        expectUnit(unit, 'BOOL');
        out.push(kKnown('DAMAGE_TYPE', 'BOOL', amount > 0 ? 1 : 0));
      } else {
        return null;
      }
    } else if (factType === 'RESOURCE_OPTION_CHANGED') {
      expectUnit(unit, 'ABS');
      out.push(kKnown('RESOURCE_DELTA', 'ABS', amount));
    } else if (factType === 'SHIELD_DELTA') {
      expectUnit(unit, 'ABS');
      out.push(kKnown('SHIELD_DELTA', 'ABS', amount));
    } else if (factType === 'STATE_DELTA') {
      if (ATTRIBUTE_KEYS.indexOf(key) >= 0) {
        expectUnit(unit, 'PERCENT');
        out.push(kKnown('ATTRIBUTE_DELTA', 'PERCENT', amount));
      } else if (JUDGMENT_KEYS.indexOf(key) >= 0) {
        expectUnit(unit, 'PERCENT');
        out.push(kKnown('JUDGMENT_DELTA', 'PERCENT', amount));
      } else if (unit === 'BOOL') {
        out.push(kKnown('STATE_PRESENCE', 'BOOL', amount > 0 ? 1 : 0));
      } else if (unit === 'COUNT') {
        out.push(kUnknown('STATE_PRESENCE', 'BOOL', 'STATE_FORM_UNMAPPED'));
      } else {
        throw rejection('UNIT_FAMILY_MISMATCH', { factType: factType, key: key, unit: unit });
      }
      if (dur === 0) {
        out.push({ featureCode: 'STATE_DURATION', unitFamily: 'TURNS', status: 'NOT_APPLICABLE', reasonCode: 'NO_DURATION' });
      } else {
        out.push(kKnown('STATE_DURATION', 'TURNS', dur));
      }
    } else {
      return null;
    }
    return out;
  }

  function computeRows(input) {
    var recs = [];
    var outside = 0;
    var seen = {};
    var rows = input.directFacts || [];
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var factType = row.factType;
      var key = row.key;
      var amount = toFiniteNumber(row.amount, 'directFacts.amount');
      var dur = toFiniteNumber(row.durationTurns, 'directFacts.durationTurns');
      var rowFactId = row.sourceEffectId + '::' + key;
      if (hasOwn(seen, rowFactId)) throw rejection('DUPLICATE_FEATURE', { rowFactId: rowFactId });
      seen[rowFactId] = true;
      var projs = projectRow(factType, key, row.unit, amount, dur);
      if (projs === null) { outside += 1; continue; }
      for (var p = 0; p < projs.length; p += 1) {
        var pr = projs[p];
        recs.push(rec(pr.featureCode, pr.unitFamily, pr.status, pr.reasonCode, pr.value, [rowFactId], [], 1, row.sourceEffectId, key));
      }
    }
    return { recs: recs, outsideCount: outside };
  }

  function targetSideRec(input) {
    var cand = input.candidate;
    var sides = input.publicSnapshot.sides;
    var targets = cand.targetSet;
    if (targets.length === 0) return na('RELATION_TARGET_SIDE', 'ENUM', 'NO_TARGET_AXIS');
    var classes = {};
    var anyUnobserved = false;
    for (var i = 0; i < targets.length; i += 1) {
      var t = targets[i];
      if (!hasOwn(sides, t)) { anyUnobserved = true; continue; }
      if (t === cand.actorId) { classes['SELF'] = true; }
      else if (sides[t] === cand.actorSide) { classes['ALLY'] = true; }
      else { classes['ENEMY'] = true; }
    }
    if (anyUnobserved) return unk('RELATION_TARGET_SIDE', 'ENUM', 'SIDE_UNOBSERVED');
    var keys = Object.keys(classes);
    if (keys.length === 1) return knownStr('RELATION_TARGET_SIDE', 'ENUM', keys[0]);
    return knownStr('RELATION_TARGET_SIDE', 'ENUM', 'MIXED');
  }

  function atomicHitProbabilities(input) {
    var out = [];
    var facts = input.atomicFacts;
    if (!Array.isArray(facts)) return out;
    for (var i = 0; i < facts.length; i += 1) {
      var f = facts[i];
      if (f.hitCheckApplicability === 'APPLICABLE') {
        out.push({ eventId: f.eventId, value: toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability') });
      }
    }
    return out;
  }

  function successProbabilityRec(input) {
    var facts = input.atomicFacts;
    var hasFacts = Array.isArray(facts) && facts.length > 0;
    var pp = input.publicProbability;
    if (pp && typeof pp === 'object') {
      if (pp.hitProbability !== undefined) {
        var evs = atomicHitProbabilities(input);
        var evIds = [];
        for (var e = 0; e < evs.length; e += 1) evIds.push(evs[e].eventId);
        return rec('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'KNOWN', 'OK', toFiniteNumber(pp.hitProbability, 'publicProbability.hitProbability'), [], evIds, 0, '', '');
      }
      if (pp.resolved === false) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONDITIONAL_PROBABILITY_UNRESOLVED');
    }
    if (!hasFacts) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'MISSING_SOURCE_FACT');
    for (var i = 0; i < facts.length; i += 1) {
      if (facts[i].hitCheckApplicability === 'UNKNOWN') return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONDITIONAL_PROBABILITY_UNRESOLVED');
    }
    var allNa = true;
    for (var n = 0; n < facts.length; n += 1) {
      if (facts[n].hitCheckApplicability !== 'NOT_APPLICABLE') allNa = false;
    }
    if (allNa) return na('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'NO_HIT_AXIS');
    var evs2 = atomicHitProbabilities(input);
    var ids = [];
    for (var e2 = 0; e2 < evs2.length; e2 += 1) ids.push(evs2[e2].eventId);
    var first = evs2[0].value;
    var allSame = true;
    for (var s = 1; s < evs2.length; s += 1) if (evs2[s].value !== first) allSame = false;
    if (allSame) return rec('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'KNOWN', 'OK', first, [], ids, 0, '', '');
    return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONDITIONAL_PROBABILITY_UNRESOLVED', [], ids);
  }
  function hpRatioRec(input) {
    var targets = input.candidate.targetSet;
    if (targets.length === 0) return unk('PUBLIC_HP_RATIO', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    var units = input.publicSnapshot.units;
    var sum = 0;
    for (var i = 0; i < targets.length; i += 1) {
      var u = units[targets[i]];
      if (!u || typeof u !== 'object' || u.hp === undefined || u.hp_max === undefined) return unk('PUBLIC_HP_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      var hp = toFiniteNumber(u.hp, 'units.hp');
      var hpMax = toFiniteNumber(u.hp_max, 'units.hp_max');
      if (hpMax <= 0) return unk('PUBLIC_HP_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      sum += hp / hpMax;
    }
    return known('PUBLIC_HP_RATIO', 'RATIO_0_1', sum / targets.length);
  }

  function resourceRatioRec(input) {
    var targets = input.candidate.targetSet;
    if (targets.length === 0) return unk('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    var units = input.publicSnapshot.units;
    var sum = 0;
    for (var i = 0; i < targets.length; i += 1) {
      var u = units[targets[i]];
      if (!u || typeof u !== 'object' || u.sp === undefined || u.sp_max === undefined || u.men === undefined || u.men_max === undefined) {
        return unk('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      }
      var sp = toFiniteNumber(u.sp, 'units.sp');
      var spMax = toFiniteNumber(u.sp_max, 'units.sp_max');
      var men = toFiniteNumber(u.men, 'units.men');
      var menMax = toFiniteNumber(u.men_max, 'units.men_max');
      if (spMax <= 0 || menMax <= 0) return unk('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      sum += (sp / spMax + men / menMax) / 2;
    }
    return known('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', sum / targets.length);
  }

  function costAffordabilityRec(input) {
    var cost = input.publicCost;
    if (!Array.isArray(cost) || cost.length === 0) return na('COST_AFFORDABILITY', 'RATIO_0_1', 'NO_PUBLIC_COST');
    var actor = input.publicSnapshot.units[input.candidate.actorId];
    if (!actor || typeof actor !== 'object') return unk('COST_AFFORDABILITY', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
    var minRatio = Infinity;
    for (var i = 0; i < cost.length; i += 1) {
      var entry = cost[i];
      var field = RESOURCE_FIELD[entry.resource];
      var available = actor[field];
      if (available === undefined) return unk('COST_AFFORDABILITY', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      var ratio = toFiniteNumber(available, 'units.' + input.candidate.actorId + '.' + field) / toFiniteNumber(entry.amount, 'publicCost.amount');
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      if (ratio < minRatio) minRatio = ratio;
    }
    return known('COST_AFFORDABILITY', 'RATIO_0_1', minRatio);
  }

  function revealRec(input) {
    var pd = input.publicDeclarations;
    if (pd && typeof pd === 'object' && pd.revealStrength !== undefined) {
      return known('REVEAL_STRENGTH', 'RATIO_0_1', toFiniteNumber(pd.revealStrength, 'publicDeclarations.revealStrength'));
    }
    return unk('REVEAL_STRENGTH', 'RATIO_0_1', 'NO_PUBLIC_DECLARATION');
  }

  function overkillRec(input) {
    var pd = input.publicDeclarations;
    if (pd && typeof pd === 'object' && pd.declaredOverkill !== undefined) {
      return known('OVERKILL_AVAILABILITY', 'BOOL', toFiniteNumber(pd.declaredOverkill, 'publicDeclarations.declaredOverkill') > 0 ? 1 : 0);
    }
    return unk('OVERKILL_AVAILABILITY', 'BOOL', 'NO_PUBLIC_DECLARATION');
  }

  function hardExclusionCode(input) {
    var codes = [];
    if (Array.isArray(input.legalityFlags)) codes = codes.concat(input.legalityFlags);
    var lm = input.legalityModifiers;
    if (lm && typeof lm === 'object') {
      if (Array.isArray(lm.hardExclusions)) codes = codes.concat(lm.hardExclusions);
      if (Array.isArray(lm.legalityFlags)) codes = codes.concat(lm.legalityFlags);
    }
    for (var i = 0; i < codes.length; i += 1) {
      if (HARD_EXCLUSION_CODES.indexOf(codes[i]) >= 0) return codes[i];
    }
    var status = input.publicSnapshot.actorStatus;
    if (status === 'DISABLED') return 'ACTOR_DISABLED';
    if (status === 'TERMINAL') return 'ACTOR_TERMINAL';
    if (status === 'UNKNOWN') return 'UNKNOWN_STATE';
    if (input.candidate.targetSet.length < 1) return 'TARGET_EMPTY';
    return null;
  }

  function scheduledEntryIds(input) {
    var sched = input.scheduledFacts;
    var out = [];
    if (!Array.isArray(sched)) return out;
    for (var i = 0; i < sched.length; i += 1) out.push(sched[i].entryId);
    return out;
  }

  function candidateFeatures(input, outsideCount) {
    var out = [];
    out.push(known('RELATION_TARGET_COUNT', 'COUNT', input.candidate.targetSet.length));
    out.push(targetSideRec(input));
    out.push(successProbabilityRec(input));
    out.push(hpRatioRec(input));
    out.push(resourceRatioRec(input));
    out.push(costAffordabilityRec(input));
    out.push(revealRec(input));
    out.push(overkillRec(input));
    var excl = hardExclusionCode(input);
    out.push(known('HARD_EXCLUSION', 'BOOL', excl ? 1 : 0));
    out.push(excl ? knownStr('HARD_EXCLUSION_REASON', 'ENUM', excl) : na('HARD_EXCLUSION_REASON', 'ENUM', 'NOT_EXCLUDED'));
    out.push(unk('SETTLEMENT_DAMAGE', 'ABS', 'FINAL_SETTLEMENT_UNKNOWN'));
    out.push(unk('ROLL_REALIZATION', 'BOOL', 'FUTURE_REALIZATION_UNKNOWN'));
    out.push(rec('OUTSIDE_BATCH1_ROW_COUNT', 'COUNT', 'KNOWN', 'OK', outsideCount, [], scheduledEntryIds(input), 0, '', ''));
    for (var j = 0; j < out.length; j += 1) {
      out[j]._scopeRank = 0;
      out[j]._seid = '';
      out[j]._key = '';
    }
    return out;
  }

  function featCompare(a, b) {
    var c = a._scopeRank - b._scopeRank;
    if (c !== 0) return c;
    c = cmpStr(a._seid, b._seid);
    if (c !== 0) return c;
    c = cmpStr(a._key, b._key);
    if (c !== 0) return c;
    return cmpStr(a.featureCode, b.featureCode);
  }

  function assemble(candidateId, recs) {
    var sorted = recs.slice();
    sorted.sort(featCompare);
    var feats = [];
    for (var i = 0; i < sorted.length; i += 1) {
      var r = sorted[i];
      var f = {
        featureCode: r.featureCode,
        unitFamily: r.unitFamily,
        status: r.status,
        reasonCode: r.reasonCode,
        sourceFactIds: r.sourceFactIds.slice(),
        sourceEventIds: r.sourceEventIds.slice()
      };
      if (r.status === 'KNOWN') {
        f.value = normZero(r.value);
        if (BOOL_CODES.indexOf(r.featureCode) >= 0 && f.value !== 0 && f.value !== 1) {
          throw rejection('INVALID_STATUS_VALUE', { featureCode: r.featureCode, value: f.value });
        }
      }
      feats.push(f);
    }
    if (feats.length > CAPS.MAX_FEATURES_PER_CANDIDATE) throw rejection('CAP_EXCEEDED', { features: feats.length });
    return {
      schemaVersion: SCHEMA_VERSION,
      candidateId: candidateId,
      features: feats,
      featureCount: feats.length
    };
  }

  function modifierEntryCount(input) {
    var n = 0;
    var lm = input.legalityModifiers;
    if (lm && typeof lm === 'object') {
      if (Array.isArray(lm.judgmentRates)) n += lm.judgmentRates.length;
      if (lm.taunt) n += 1;
      if (lm.tauntRemoved) n += 1;
      if (lm.stateMigration) n += 1;
      if (lm.stateSwap) n += 1;
      if (Array.isArray(lm.mechanismRemoval)) n += lm.mechanismRemoval.length;
      if (Array.isArray(lm.hardExclusions)) n += lm.hardExclusions.length;
      if (Array.isArray(lm.legalityFlags)) n += lm.legalityFlags.length;
    }
    var om = input.opportunityModifiers;
    if (om && typeof om === 'object') {
      if (Array.isArray(om.resourceLocks)) n += om.resourceLocks.length;
      if (om.opportunityConstraints && typeof om.opportunityConstraints === 'object') n += Object.keys(om.opportunityConstraints).length;
      if (Array.isArray(om.interferenceRates)) n += om.interferenceRates.length;
      if (Array.isArray(om.dependencyTokens)) n += om.dependencyTokens.length;
    }
    if (Array.isArray(input.legalityFlags)) n += input.legalityFlags.length;
    return n;
  }

  function compileCore(input, m) {
    if (!input || typeof input !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'input' });
    validateInput(input);
    if (input.directFacts && input.directFacts.length > CAPS.MAX_FACT_ROWS_PER_CANDIDATE) throw rejection('CAP_EXCEEDED', { rows: input.directFacts.length });
    var modCount = modifierEntryCount(input);
    if (modCount > CAPS.MAX_MODIFIER_ENTRIES_PER_CANDIDATE) throw rejection('CAP_EXCEEDED', { modifiers: modCount });
    var atomicCount = Array.isArray(input.atomicFacts) ? input.atomicFacts.length : 0;
    var schedCount = Array.isArray(input.scheduledFacts) ? input.scheduledFacts.length : 0;
    var work = F0 + (Array.isArray(input.directFacts) ? input.directFacts.length : 0) + modCount + schedCount + atomicCount;
    if (work > CAPS.MAX_WORK_UNITS_PER_CALL) throw rejection('CAP_EXCEEDED', { work: work });
    var rowsOut = computeRows(input);
    var candRecs = candidateFeatures(input, rowsOut.outsideCount + schedCount);
    var doc = assemble(input.candidate.candidateId, candRecs.concat(rowsOut.recs));
    var frozen = freezeDeep(doc);
    if (m) {
      m.calls += 1;
      m.workUnitsTotal += work;
      m.lastWorkUnits = work;
      m.lastFeatureCount = frozen.featureCount;
      m.lastCandidateId = input.candidate.candidateId;
    }
    return frozen;
  }

  var metrics = freshMetrics();

  function compileCandidate(input) {
    try {
      return compileCore(input, metrics);
    } catch (e) {
      var code = (e && (e.code || e.reasonCode)) || 'UNKNOWN';
      metrics.rejections[code] = (metrics.rejections[code] || 0) + 1;
      metrics.lastRejection = code;
      throw e;
    }
  }
  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function buildRegistry() {
    return {
      schemaVersion: SCHEMA_VERSION,
      contractId: REGISTRY_ID,
      revision: REVISION,
      role: ROLE,
      mount: MOUNT_NAME,
      apiSurface: ['compileCandidate', 'inputSchema', 'registry', 'readMetrics', 'selfCheck'],
      authority: {
        milestone: 'M2',
        claim: 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED',
        declaredMagnitudeOnly: true,
        finalSettlement: 'DEFERRED_TO_DOWNSTREAM_KERNEL',
        futureRouteDerivation: false,
        worldClone: false,
        runtimeFutureTraversal: false,
        resultWorldCartesian: false,
        inputMode: 'CANDIDATES_ONLY'
      },
      featureCodes: FEATURE_CODES.slice(),
      candidateFeatureCodes: CANDIDATE_CODES.slice(),
      effectRowFeatureCodes: ROW_CODES.slice(),
      unitFamily: copyOf(UNIT_FAMILY),
      boolFeatureCodes: BOOL_CODES.slice(),
      batch1PrototypeFamilies: copyOf(BATCH1_FAMILY),
      caps: copyOf(CAPS),
      workFormula: '13 (F0) + directFactsRows + modifierEntries + scheduledFactsEntries + atomicFactsCount',
      statusReasonCodes: { KNOWN: ['OK'], UNKNOWN: UNKNOWN_REASONS.slice(), NOT_APPLICABLE: NA_REASONS.slice() },
      hardExclusionCodes: HARD_EXCLUSION_CODES.slice(),
      rejectionReasonCodes: [
        'ROUTE_INPUT_REJECTED', 'WORLD_CLONE_REJECTED', 'RESULT_WORLD_CARTESIAN_REJECTED',
        'HIDDEN_INPUT_REJECTED', 'WALL_CLOCK_REJECTED', 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
        'TEACHER_INPUT_REJECTED', 'BRANCH_COMBINATION_FORBIDDEN', 'NON_FINITE_REJECTED',
        'DUPLICATE_FEATURE', 'UNIT_FAMILY_MISMATCH', 'UNKNOWN_ZERO_PLACEHOLDER',
        'DURATION_MULTIPLIES_MAGNITUDE', 'UNKNOWN_FEATURE_CODE', 'UNKNOWN_UNIT_FAMILY',
        'INVALID_STATUS_VALUE', 'MISSING_SOURCE_REFERENCE', 'INVALID_OPTION_VALUE', 'CAP_EXCEEDED'
      ],
      contractHashes: copyOf(CONTRACT_HASHES),
      subsetSemantics: 'UNORDERED_MULTISET_WITH_COUNT_ASSERTIONS; expect order never represents output order; featureOrdering is the single global output order',
      identityRules: {
        charset: 'candidateId/actorId/actorSide/actionKind/paymentMode/target ids/eventId/entryId: nonempty, <=512, C0 (U+0000-U+001F) and DEL (U+007F) rejected; CJK/hyphen/space allowed; equality by UTF-16 code unit',
        sidesCoverage: 'sides must contain actorId and every declared target; missing target side makes RELATION_TARGET_SIDE UNKNOWN(SIDE_UNOBSERVED)',
        sidesConsistency: 'sides[actorId] must equal actorSide, violation rejects MISSING_SOURCE_REFERENCE',
        targetCount: 'RELATION_TARGET_COUNT = unique declared targetSet length; unknown units never dropped',
        noGuessing: 'no id-prefix guessing, no neutral-side folding, no default ALLY; RELATION_TARGET_SIDE uses t===actorId => SELF, sides[t]===actorSide => ALLY, other value => ENEMY, distinct classes => MIXED'
      },
      semantics: {
        judgmentSingleSource: 'JUDGMENT_DELTA magnitude comes from the directFacts STATE_DELTA row only; legalityModifiers.judgmentRates are metadata and never a second magnitude',
        durationNeverMultiplies: 'STATE_DURATION keeps durationTurns raw; pre-multiplied inputs reject DURATION_MULTIPLIES_MAGNITUDE',
        multiTargetOnce: 'RELATION_TARGET_COUNT counts the unique declared target set once; EFFECT_ROW features never expand per targetIds',
        unknownNeverZero: 'UNKNOWN/NOT_APPLICABLE never carry value; 0 placeholders are forbidden',
        declaredNeverSettlement: 'SETTLEMENT_DAMAGE and ROLL_REALIZATION are always UNKNOWN',
        costActorOnly: 'COST_AFFORDABILITY reads publicSnapshot.units[actorId] only; frozen resource map 魂力->sp, 精神力->men, 体力->vit, 生命->hp; clamp(available/required,0,1), min over entries; target resources never consulted',
        targetSide: 'sides-map equality only (SELF by id equality, ALLY by side equality, ENEMY otherwise, MIXED on distinct classes, SIDE_UNOBSERVED when any declared target side missing, NO_TARGET_AXIS on empty axis); no prefix guessing/default ALLY/neutral folding',
        successProbability: 'declared publicProbability first; else atomicFacts: any UNKNOWN applicability => UNKNOWN(CONDITIONAL_PROBABILITY_UNRESOLVED); all NOT_APPLICABLE => NOT_APPLICABLE(NO_HIT_AXIS); APPLICABLE equal hitProbability => KNOWN, differing => UNKNOWN(CONDITIONAL_PROBABILITY_UNRESOLVED); no atomic facts => UNKNOWN(MISSING_SOURCE_FACT); actionKind never special-cased',
        outsideRowCounting: 'rows outside the batch-1 families plus every scheduledFacts entry count into OUTSIDE_BATCH1_ROW_COUNT; scheduled entryIds recorded in sourceEventIds; nothing silently dropped',
        statePresence: 'STATE_DELTA non-attribute/judgment key: unit=BOOL => KNOWN 1 (amount>0) or 0 (amount<=0); unit=COUNT => UNKNOWN(STATE_FORM_UNMAPPED), never coerced to BOOL; other units => UNIT_FAMILY_MISMATCH; BOOL KNOWN domain strictly {0,1}'
      }
    };
  }

  function buildInputSchema() {
    return {
      schemaVersion: SCHEMA_VERSION,
      surface: 'CANDIDATES_ONLY',
      requiredTopLevel: ['candidate', 'publicSnapshot'],
      keys: {
        candidate: { required: true, shape: { candidateId: 'string nonempty <=512 no C0/DEL', actorId: 'string nonempty <=512 no C0/DEL', actorSide: 'string nonempty <=512 no C0/DEL', actionKind: 'string nonempty <=512 no C0/DEL (identity only)', targetSet: 'unique string[] of nonempty ids <=512 no C0/DEL', paymentMode: 'string nonempty <=512 no C0/DEL (identity only)' }, closed: true },
        publicSnapshot: {
          required: true,
          shape: {
            units: { '<unitId>': { hp: 'number', hp_max: 'number', sp: 'number', sp_max: 'number', men: 'number', men_max: 'number', vit: 'number', vit_max: 'number', def: 'number', agi: 'number', shield: 'number', 状态效果: 'object' } },
            sides: 'unitId -> opaque side id string 1..512; must contain actorId with sides[actorId]===actorSide',
            actorStatus: 'enum NORMAL|DISABLED|TERMINAL|UNKNOWN (required)'
          },
          closed: true
        },
        atomicFacts: { required: false, shape: [{ eventId: 'string nonempty', hitCheckApplicability: 'enum APPLICABLE|NOT_APPLICABLE|UNKNOWN', evidence: { hitProbability: 'number finite (required when APPLICABLE)' }, sourceActionId: 'string', outcomeKind: 'string', expectedDelta: 'number finite' }], closed: true },
        directFacts: { required: false, shape: 'DirectFactRowV1 rows: schemaVersion const DirectFactRowV1, factType enum, key string, sourceActionId/sourceActorId/sourceEffectId nonempty, sourceActorId===candidate.actorId, targetIds nonempty non-symbolic, amount finite, unit enum, durationTurns integer >=0', closed: true },
        legalityFlags: { required: false, shape: 'string[] every member in hardExclusionCodes' },
        legalityModifiers: { required: false, shape: 'judgmentRates/taunt/tauntRemoved/stateMigration/stateSwap/mechanismRemoval metadata; hardExclusions/legalityFlags code arrays restricted to hardExclusionCodes', closed: true },
        opportunityModifiers: { required: false, shape: 'resourceLocks/opportunityConstraints/interferenceRates/dependencyTokens metadata', closed: true },
        scheduledFacts: { required: false, shape: [{ entryId: 'string nonempty <=512 no C0/DEL (required)', operation: 'string', triggerKey: 'enum 主动触发|随下次行动触发', maxActions: 'integer >=0', payload: 'array' }], closed: true },
        publicCost: { required: false, shape: [{ resource: 'enum 魂力|精神力|体力|生命', amount: 'number finite positive' }], closed: true },
        publicProbability: { required: false, shape: '{ hitProbability: number finite, source?: string } or { resolved: false, unresolvedCondition?: string }', closed: true },
        publicDeclarations: { required: false, shape: { revealStrength: 'number finite', declaredOverkill: 'number finite' }, closed: true }
      },
      forbiddenKeys: ['forbiddenFacts', 'branchCombination', 'preMultiplied', 'route', 'worldClone', 'resultWorld', 'hidden', 'wallClock', 'skillRoleName', 'teacher', 'kernelRouteValue'],
      note: 'pure compiler; closed input contract; never invokes Decision/Preview/Provider; never traverses future routes'
    };
  }

  function readMetrics() {
    var rej = {};
    for (var k in metrics.rejections) if (hasOwn(metrics.rejections, k)) rej[k] = metrics.rejections[k];
    return freezeDeep({
      calls: metrics.calls,
      workUnitsTotal: metrics.workUnitsTotal,
      lastWorkUnits: metrics.lastWorkUnits,
      lastCandidateId: metrics.lastCandidateId,
      lastFeatureCount: metrics.lastFeatureCount,
      rejections: rej,
      lastRejection: metrics.lastRejection
    });
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

  function scUnit(hp, sp) {
    return { hp: hp, hp_max: 100, sp: sp, sp_max: 100, men: 100, men_max: 100, def: 20, agi: 10, shield: 0, 状态效果: {} };
  }
  function scCandidate(id, actorId, actorSide, targets, actionKind) {
    return { candidateId: id, actorId: actorId, actorSide: actorSide, actionKind: actionKind || 'RELEASE_SKILL', targetSet: targets, paymentMode: 'FORMAL' };
  }
  function scSnapshot(units, sides, actorStatus) {
    return { actorStatus: actorStatus || 'NORMAL', units: units, sides: sides };
  }
  function scRow(factType, key, amount, unit, dur, seid, targetIds) {
    return { schemaVersion: 'DirectFactRowV1', factType: factType, key: key, sourceActionId: 'action:sc', sourceActorId: 'actor-1', sourceEffectId: seid, targetIds: targetIds || ['actor-1'], amount: amount, unit: unit, durationTurns: dur };
  }

  function baseInput() {
    return {
      candidate: scCandidate('cand-selfcheck', 'actor-1', 'side-blue', ['enemy-1']),
      publicSnapshot: scSnapshot({
        'enemy-1': scUnit(80, 60),
        'actor-1': scUnit(100, 100)
      }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }),
      atomicFacts: [{ eventId: 'evt:sc:0', sourceActionId: 'action:sc', outcomeKind: 'HP_DELTA', expectedDelta: -60, hitCheckApplicability: 'APPLICABLE', evidence: { hitProbability: 0.8 } }],
      directFacts: [
        scRow('HP_DELTA', '', 60, 'POWER', 0, 'effect:sc:0', ['enemy-1']),
        scRow('HP_DELTA', 'damage.segments', 2, 'COUNT', 0, 'effect:sc:0', ['enemy-1']),
        scRow('HP_DELTA', 'damage.penetration', 20, 'PERCENT', 0, 'effect:sc:0', ['enemy-1']),
        scRow('HP_DELTA', 'damage.type', 1, 'BOOL', 0, 'effect:sc:0', ['enemy-1'])
      ],
      legalityModifiers: {},
      publicCost: [{ resource: '魂力', amount: 20 }],
      publicProbability: { hitProbability: 0.8, source: 'DECLARED' },
      publicDeclarations: { revealStrength: 0.4, declaredOverkill: 0.3 }
    };
  }

  function findFeature(doc, code) {
    for (var i = 0; i < doc.features.length; i += 1) {
      if (doc.features[i].featureCode === code) return doc.features[i];
    }
    return null;
  }

  function runSelfCheck(sourceText) {
    var sourceSelfCheckable = typeof sourceText === 'string' && sourceText.length > 0;
    var checks = [];
    function add(id, passed, detail) { checks.push({ id: id, passed: !!passed, counted: true, detail: detail === undefined ? null : detail }); }
    var fca = { id: 'forbiddenCallsAbsent', counted: sourceSelfCheckable, passed: false, detail: { sourceScanned: sourceSelfCheckable } };
    if (sourceSelfCheckable) {
      var code = codeOnly(sourceText);
      var hit = null;
      for (var t = 0; t < FORBIDDEN_CALL_TOKENS.length; t += 1) {
        if (code.indexOf(FORBIDDEN_CALL_TOKENS[t]) >= 0) { hit = FORBIDDEN_CALL_TOKENS[t]; break; }
      }
      fca.passed = hit === null;
      fca.detail = { sourceScanned: true, forbiddenTokens: FORBIDDEN_CALL_TOKENS.slice(), hit: hit };
    }
    checks.push(fca);
    add('featureCatalogClosed', FEATURE_CODES.length === 23 && CANDIDATE_CODES.length === 13 && ROW_CODES.length === 10, { total: FEATURE_CODES.length, candidate: CANDIDATE_CODES.length, row: ROW_CODES.length });
    var familyOk = true;
    for (var fc = 0; fc < FEATURE_CODES.length; fc += 1) if (UNIT_FAMILIES.indexOf(UNIT_FAMILY[FEATURE_CODES[fc]]) < 0) familyOk = false;
    add('unitFamilyClosed', familyOk, { families: UNIT_FAMILIES.slice() });
    add('rejectionMappingComplete', Object.keys(FORBIDDEN_SOURCE_CODE).length === 7 && HARD_EXCLUSION_CODES.length === 10, { sources: Object.keys(FORBIDDEN_SOURCE_CODE).slice() });
    add('batchFamilyMapping', Object.keys(BATCH1_FAMILY).length === 6 && BATCH1_FAMILY['状态施加/状态移除'].length === 2, { families: Object.keys(BATCH1_FAMILY).length });
    add('capsFixed', CAPS.MAX_FEATURES_PER_CANDIDATE === 256 && CAPS.MAX_FACT_ROWS_PER_CANDIDATE === 128 && CAPS.MAX_MODIFIER_ENTRIES_PER_CANDIDATE === 64 && CAPS.MAX_WORK_UNITS_PER_CALL === 200000 && F0 === 13, { caps: CAPS });

    var base = compileCore(baseInput(), freshMetrics());
    var probe = {};
    probe.featureCount17 = base.featureCount === 17;
    probe.always13Candidate = base.features.filter(function (f) { return CANDIDATE_CODES.indexOf(f.featureCode) >= 0; }).length === 13;
    var settlement = findFeature(base, 'SETTLEMENT_DAMAGE');
    var roll = findFeature(base, 'ROLL_REALIZATION');
    probe.settlementAlwaysUnknown = settlement !== null && settlement.status === 'UNKNOWN' && settlement.reasonCode === 'FINAL_SETTLEMENT_UNKNOWN' && !hasOwn(settlement, 'value');
    probe.rollAlwaysUnknown = roll !== null && roll.status === 'UNKNOWN' && roll.reasonCode === 'FUTURE_REALIZATION_UNKNOWN' && !hasOwn(roll, 'value');
    probe.noUnknownValue = base.features.every(function (f) { return f.status === 'KNOWN' || !hasOwn(f, 'value'); });
    probe.zeroNormalized = normZero(-0) === 0 && !Object.is(normZero(-0), -0);
    probe.deterministic = JSON.stringify(base) === JSON.stringify(compileCore(baseInput(), freshMetrics()));
    probe.deepFrozen = Object.isFrozen(base) && Object.isFrozen(base.features) && base.features.every(function (f) { return Object.isFrozen(f) && Object.isFrozen(f.sourceFactIds) && Object.isFrozen(f.sourceEventIds); });
    var noAlias = true;
    try { base.features[0].sourceFactIds.push('x'); noAlias = false; } catch (e) { noAlias = true; }
    probe.frozenArraysRejectMutation = noAlias;
    var EXPECTED_SELFCHECK_ORDER = [
      'COST_AFFORDABILITY', 'HARD_EXCLUSION', 'HARD_EXCLUSION_REASON',
      'OUTSIDE_BATCH1_ROW_COUNT', 'OVERKILL_AVAILABILITY', 'PUBLIC_HP_RATIO',
      'PUBLIC_RESOURCE_RATIO', 'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE',
      'REVEAL_STRENGTH', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE', 'SUCCESS_PROBABILITY',
      'DAMAGE_POWER', 'DAMAGE_PENETRATION', 'DAMAGE_SEGMENTS', 'DAMAGE_TYPE'
    ];
    var orderOk = base.features.length === EXPECTED_SELFCHECK_ORDER.length;
    for (var o = 0; o < base.features.length; o += 1) {
      if (base.features[o].featureCode !== EXPECTED_SELFCHECK_ORDER[o]) orderOk = false;
    }
    probe.stableOrder = orderOk;
    probe.costActorOnly = false;
    var costIn = {
      candidate: scCandidate('cand-costp', 'actor-1', 'side-blue', ['enemy-1']),
      publicSnapshot: scSnapshot({ 'enemy-1': scUnit(100, 200), 'actor-1': scUnit(100, 10) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }),
      publicCost: [{ resource: '魂力', amount: 20 }]
    };
    var costDoc = compileCore(costIn, freshMetrics());
    var costFeat = findFeature(costDoc, 'COST_AFFORDABILITY');
    probe.costActorOnly = costFeat !== null && costFeat.status === 'KNOWN' && costFeat.value === 0.5;
    probe.sideRules = {};
    var sideIn = function (targets, sides) {
      return { candidate: scCandidate('cand-side', 'actor-1', 'side-blue', targets), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'ally-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, sides) };
    };
    probe.sideRules.self = findFeature(compileCore(sideIn(['actor-1'], { 'actor-1': 'side-blue' }), freshMetrics()), 'RELATION_TARGET_SIDE').value === 'SELF';
    probe.sideRules.ally = findFeature(compileCore(sideIn(['ally-1'], { 'actor-1': 'side-blue', 'ally-1': 'side-blue' }), freshMetrics()), 'RELATION_TARGET_SIDE').value === 'ALLY';
    probe.sideRules.enemy = findFeature(compileCore(sideIn(['enemy-1'], { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), freshMetrics()), 'RELATION_TARGET_SIDE').value === 'ENEMY';
    probe.sideRules.mixed = findFeature(compileCore(sideIn(['actor-1', 'ally-1'], { 'actor-1': 'side-blue', 'ally-1': 'side-blue' }), freshMetrics()), 'RELATION_TARGET_SIDE').value === 'MIXED';
    var noside = findFeature(compileCore(sideIn(['enemy-1'], { 'actor-1': 'side-blue' }), freshMetrics()), 'RELATION_TARGET_SIDE');
    probe.sideRules.unobserved = noside !== null && noside.status === 'UNKNOWN' && noside.reasonCode === 'SIDE_UNOBSERVED';
    probe.statePresence = {};
    var st1 = compileCore({ candidate: scCandidate('cand-st1', 'actor-1', 'side-blue', ['actor-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100) }, { 'actor-1': 'side-blue' }), directFacts: [scRow('STATE_DELTA', '嘲讽', 3, 'BOOL', 1, 'effect:st:0')] }, freshMetrics());
    probe.statePresence.positiveOverflowClampedTo1 = findFeature(st1, 'STATE_PRESENCE').value === 1;
    var st2 = compileCore({ candidate: scCandidate('cand-st2', 'actor-1', 'side-blue', ['actor-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100) }, { 'actor-1': 'side-blue' }), directFacts: [scRow('STATE_DELTA', '中毒', -1, 'BOOL', 0, 'effect:st:1')] }, freshMetrics());
    probe.statePresence.negativeRemovalTo0 = findFeature(st2, 'STATE_PRESENCE').value === 0;
    probe.statePresence.zeroDurationNa = findFeature(st2, 'STATE_DURATION').status === 'NOT_APPLICABLE' && findFeature(st2, 'STATE_DURATION').reasonCode === 'NO_DURATION';
    var st3 = compileCore({ candidate: scCandidate('cand-st3', 'actor-1', 'side-blue', ['actor-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100) }, { 'actor-1': 'side-blue' }), directFacts: [scRow('STATE_DELTA', '中毒', 3, 'COUNT', 2, 'effect:st:2')] }, freshMetrics());
    var sp3 = findFeature(st3, 'STATE_PRESENCE');
    probe.statePresence.countUnmapped = sp3 !== null && sp3.status === 'UNKNOWN' && sp3.reasonCode === 'STATE_FORM_UNMAPPED' && !hasOwn(sp3, 'value');
    var sd3 = findFeature(st3, 'STATE_DURATION');
    probe.statePresence.countDurationKept = sd3 !== null && sd3.status === 'KNOWN' && sd3.value === 2;
    probe.scheduledCounted = false;
    var schIn = {
      candidate: scCandidate('cand-sch', 'actor-1', 'side-blue', ['enemy-1']),
      publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }),
      scheduledFacts: [{ entryId: 'sf:x', operation: 'WINDOW_ADJUST', triggerKey: '随下次行动触发', payload: [] }]
    };
    var schDoc = compileCore(schIn, freshMetrics());
    var schFeat = findFeature(schDoc, 'OUTSIDE_BATCH1_ROW_COUNT');
    probe.scheduledCounted = schFeat !== null && schFeat.status === 'KNOWN' && schFeat.value === 1 && schFeat.sourceEventIds.length === 1 && schFeat.sourceEventIds[0] === 'sf:x';
    probe.atomicProbes = {};
    var at1 = compileCore({ candidate: scCandidate('cand-at1', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:a', hitCheckApplicability: 'APPLICABLE', evidence: { hitProbability: 0.8 } }, { eventId: 'evt:b', hitCheckApplicability: 'APPLICABLE', evidence: { hitProbability: 0.8 } }] }, freshMetrics());
    var sp1 = findFeature(at1, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.equalApplicableKnown = sp1 !== null && sp1.status === 'KNOWN' && sp1.value === 0.8 && sp1.sourceEventIds.length === 2 && sp1.sourceEventIds[0] === 'evt:a' && sp1.sourceEventIds[1] === 'evt:b';
    var at2 = compileCore({ candidate: scCandidate('cand-at2', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:c', hitCheckApplicability: 'NOT_APPLICABLE' }] }, freshMetrics());
    var sp2 = findFeature(at2, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.allNotApplicableNa = sp2 !== null && sp2.status === 'NOT_APPLICABLE' && sp2.reasonCode === 'NO_HIT_AXIS';
    var at3 = compileCore({ candidate: scCandidate('cand-at3', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:d', hitCheckApplicability: 'UNKNOWN' }] }, freshMetrics());
    var sp3b = findFeature(at3, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.unknownApplicabilityUnknown = sp3b !== null && sp3b.status === 'UNKNOWN' && sp3b.reasonCode === 'CONDITIONAL_PROBABILITY_UNRESOLVED';
    var at4 = compileCore({ candidate: scCandidate('cand-at4', 'actor-1', 'side-blue', ['actor-1'], 'DEFEND'), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100) }, { 'actor-1': 'side-blue' }) }, freshMetrics());
    var sp4 = findFeature(at4, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.noActionKindSpecialCase = sp4 !== null && sp4.status === 'UNKNOWN' && sp4.reasonCode === 'MISSING_SOURCE_FACT';
    add('behaviorProbes', probe.featureCount17 && probe.always13Candidate && probe.settlementAlwaysUnknown && probe.rollAlwaysUnknown && probe.noUnknownValue && probe.zeroNormalized && probe.deterministic && probe.deepFrozen && probe.frozenArraysRejectMutation && probe.stableOrder && probe.costActorOnly && probe.sideRules.self && probe.sideRules.ally && probe.sideRules.enemy && probe.sideRules.mixed && probe.sideRules.unobserved && probe.statePresence.positiveOverflowClampedTo1 && probe.statePresence.negativeRemovalTo0 && probe.statePresence.zeroDurationNa && probe.statePresence.countUnmapped && probe.statePresence.countDurationKept && probe.scheduledCounted && probe.atomicProbes.equalApplicableKnown && probe.atomicProbes.allNotApplicableNa && probe.atomicProbes.unknownApplicabilityUnknown && probe.atomicProbes.noActionKindSpecialCase, probe);

    var rej = {};
    function expectReject(input, code) {
      try { compileCore(input, freshMetrics()); return false; } catch (e) { return e.code === code; }
    }
    var plain = { candidate: scCandidate('cand-r', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }) };
    rej.route = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, forbiddenFacts: [{ source: 'ROUTE' }] }, 'ROUTE_INPUT_REJECTED');
    rej.hidden = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, forbiddenFacts: [{ source: 'HIDDEN' }] }, 'HIDDEN_INPUT_REJECTED');
    rej.branch = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, branchCombination: true }, 'BRANCH_COMBINATION_FORBIDDEN');
    rej.preMultiplied = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, preMultiplied: { featureCode: 'ATTRIBUTE_DELTA', magnitude: 10, durationTurns: 3, claimedValue: 30 } }, 'DURATION_MULTIPLIES_MAGNITUDE');
    rej.nonFinite = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, directFacts: [scRow('RESOURCE_OPTION_CHANGED', '魂力', 'NaN', 'ABS', 0, 'effect:n:0')] }, 'NON_FINITE_REJECTED');
    var dupRow = scRow('HP_DELTA', '', 60, 'POWER', 0, 'effect:dup:0', ['enemy-1']);
    rej.duplicate = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, directFacts: [dupRow, dupRow] }, 'DUPLICATE_FEATURE');
    rej.unitMismatch = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, directFacts: [scRow('RESOURCE_OPTION_CHANGED', '魂力', 60, 'POWER', 0, 'effect:u:0')] }, 'UNIT_FAMILY_MISMATCH');
    var noStatus = { candidate: plain.candidate, publicSnapshot: { units: plain.publicSnapshot.units, sides: plain.publicSnapshot.sides } };
    rej.missingActorStatus = expectReject(noStatus, 'MISSING_SOURCE_REFERENCE');
    rej.unknownLegalityCode = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, legalityFlags: ['BOGUS_CODE'] }, 'INVALID_OPTION_VALUE');
    rej.costInvalidResource = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, publicCost: [{ resource: '未知', amount: 10 }] }, 'INVALID_OPTION_VALUE');
    rej.scheduledMissingEntryId = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, scheduledFacts: [{ operation: 'WINDOW_ADJUST' }] }, 'MISSING_SOURCE_REFERENCE');
    rej.unknownTopKey = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, bogusKey: 1 }, 'INVALID_OPTION_VALUE');
    rej.controlCharId = expectReject({ candidate: scCandidate('bad\u0007id', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: plain.publicSnapshot }, 'INVALID_OPTION_VALUE');
    rej.sidesInconsistent = expectReject({ candidate: plain.candidate, publicSnapshot: scSnapshot(plain.publicSnapshot.units, { 'actor-1': 'side-other', 'enemy-1': 'side-red' }) }, 'MISSING_SOURCE_REFERENCE');
    var mismatchRow = { schemaVersion: 'DirectFactRowV1', factType: 'HP_DELTA', key: '', sourceActionId: 'action:sc', sourceActorId: 'other-1', sourceEffectId: 'effect:m:0', targetIds: ['enemy-1'], amount: 60, unit: 'POWER', durationTurns: 0 };
    rej.rowActorMismatch = expectReject({ candidate: plain.candidate, publicSnapshot: plain.publicSnapshot, directFacts: [mismatchRow] }, 'MISSING_SOURCE_REFERENCE');
    add('rejectionProbes', rej.route && rej.hidden && rej.branch && rej.preMultiplied && rej.nonFinite && rej.duplicate && rej.unitMismatch && rej.missingActorStatus && rej.unknownLegalityCode && rej.costInvalidResource && rej.scheduledMissingEntryId && rej.unknownTopKey && rej.controlCharId && rej.sidesInconsistent && rej.rowActorMismatch, rej);

    var passed = true;
    for (var c = 0; c < checks.length; c += 1) if (checks[c].counted && !checks[c].passed) passed = false;
    return { schemaVersion: SCHEMA_VERSION, role: ROLE, revision: REVISION, passed: passed, sourceSelfCheckable: sourceSelfCheckable, checks: checks };
  }

  var api = {
    compileCandidate: compileCandidate,
    inputSchema: function () { return freezeDeep(buildInputSchema()); },
    registry: function () { return freezeDeep(buildRegistry()); },
    readMetrics: readMetrics,
    selfCheck: function (sourceText) { return runSelfCheck(sourceText); }
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

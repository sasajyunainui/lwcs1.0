// BehaviorImmediateFeature_Module.js
// M2 immediate feature compiler writer F - revision 4 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority (frozen, disk-verified):
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.json       8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49
//   tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json       4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.json         69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8 (read-only, untrained, revision 15)
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.schema.json  3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e (read-only, untrained, revision 15)
// Governed frozen sources (read-only): BehaviorProviderV1 cc32c251236906c5e128164f76a25a1196ebe089ef7903edb454e3374a90f156;
//   PrototypeDirectAdapterV1 4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e;
//   PrototypeDirectAdapterV1.schema 7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22;
//   PrototypeDirectAdapterCasesV1 1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c; DirectFactRowV1 493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917;
//   DirectFactRowV1.schema 0325e39cd33ecf1c925268d451f23c3bde4d75eca3b5405b614c255b931b0538.
// Prototype attestation: projectionFamilies prototype legitimacy comes from the
// read-only input.prototypeRegistry PDA registry attestation carrier (stamped by
// BehaviorCandidateFeatureBridge_Module); no hardcoded prototype name list; unknown
// names and registry hash/sourceContractHash drift fail closed; new prototypes
// auto-adopt (family-neutral until a later contract revision routes them).
// Revision 4 final (cases 62): scheduledFacts closed four-shape per PDA rev5 schema
// (WINDOW_ADJUST entryId/operation/调整字段/调整方式 + optional 调整回合/调整tick/调整次数/
// 结算倍率; SETTLEMENT_RATIO_ADJUST entryId/operation/结算倍率; FOLLOW_UP entryId/grantType/
// ownerId/followUpKey/triggerKey/payloadDirectFacts with maxActions >=1 only for 主动触发; SUMMON_WINDOW entryId/
// grantType/召唤单位类型/召唤物名称/行动模式/durationTurns); private aliases key/字段/方式
// are rejected; every entry requires entryId and counts into OUTSIDE_BATCH1_ROW_COUNT.
// Revision 4 (batch-2 rev4): six raw feature codes pinned at fixed catalog positions 23-28
// (STATE_DELTA_PERCENT/SETTLEMENT_MODIFIER_PERCENT/SUMMON_COUNT/SUMMON_STRENGTH/
// SUMMON_DURATION/RESOURCE_DELTA_PERCENT);
// STATE_DELTA rows route state.primary/state.secondary PERCENT to STATE_DELTA_PERCENT,
// settlement.primary PERCENT to SETTLEMENT_MODIFIER_PERCENT (never HP/RESOURCE double rows),
// other PERCENT keys to UNKNOWN(MISSING_SOURCE_FACT); RESOURCE_OPTION_CHANGED rows with
// unit=PERCENT route key=resource name to RESOURCE_DELTA_PERCENT (raw signed percent,
// never multiplied by duration; ABS rows keep RESOURCE_DELTA; unsigned percent rows stay
// PENDING_DIRECTION_PROJECTION upstream in the adapter and never reach the compiler);
// SUMMON_WINDOW rows route
// summon.count/summon.strength/summon.duration (wrong unit => UNKNOWN with row fact id),
// summon.inheritRatio maps to no feature code and only counts OUTSIDE_BATCH1_ROW_COUNT;
// the summon family block (all three codes) is emitted per activating sourceEffectId
// (routed row or projectionFamilies 召唤生成 entry); mechanicMetadataEntries (closed entries
// array, one per effect instance) / projectionFamilies root inputs are closed audit/
// routing-only bridges (per-prototype key subsets per PDA rev5Spec, values never enter
// features, prototype names never weighted => PROTOTYPE_NAME_WEIGHTING_REJECTED);
// SUMMON_WINDOW scheduledFacts entries carry grantType/召唤单位类型/召唤物名称/行动模式/
// durationTurns and count into OUTSIDE with entryId in sourceEventIds; scheduled windows
// never become KNOWN SUMMON_DURATION; formal caps (256 features / 128 rows / 64 modifier
// entries / 200000 work units) throw CAP_EXCEEDED as whole-compile rejections. Revision 2
// semantics stay (identity/sides/cost/
// hitCheckApplicability/STATE_PRESENCE {0,1}/29 raw features base, no normalization
// constants, no weights, no Decision/Preview/Provider invocation, no future-route/
// world-clone/result enumeration, no Runtime/loader wiring).
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var REVISION = 17;
  var REGISTRY_ID = 'RC6-M2-BEHAVIOR-IMMEDIATE-FEATURE-V1-2026-08-14';
  var SCHEMA_VERSION = 'BehaviorImmediateFeatureV1';
  var F0 = 14;

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
    'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'STATE_PRESENCE', 'STATE_DURATION',
    'STATE_DELTA_PERCENT', 'SETTLEMENT_MODIFIER_PERCENT', 'SUMMON_COUNT',
    'SUMMON_STRENGTH', 'SUMMON_DURATION', 'RESOURCE_DELTA_PERCENT',
    'PUBLIC_RECIPIENT_NEED_MATCH', 'TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME',
    'REACTION_DAMAGE_MULTIPLIER', 'REACTION_DODGE_PROBABILITY', 'REACTION_COUNTER_WINDOW_OPEN'
  ];
  // PUBLIC_RECIPIENT_NEED_MATCH is candidate-scope and lives at frozen position 29;
  // positions 0-28 stay unchanged, so the candidate block is explicit. The two
  // TARGET_CHARGE_* codes live at frozen positions 30/31 as per-target row facts
  // (one row per declared target in targetSet declaration order).
  var CANDIDATE_CODES = FEATURE_CODES.slice(0, 13).concat([
    'PUBLIC_RECIPIENT_NEED_MATCH', 'REACTION_DAMAGE_MULTIPLIER',
    'REACTION_DODGE_PROBABILITY', 'REACTION_COUNTER_WINDOW_OPEN'
  ]);
  var ROW_CODES = FEATURE_CODES.slice(13, 29).concat(['TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME']);

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
    'STATE_DURATION': 'TURNS',
    'STATE_DELTA_PERCENT': 'PERCENT',
    'SETTLEMENT_MODIFIER_PERCENT': 'PERCENT',
    'SUMMON_COUNT': 'COUNT',
    'SUMMON_STRENGTH': 'RATIO',
    'SUMMON_DURATION': 'TURNS',
    'RESOURCE_DELTA_PERCENT': 'PERCENT',
    'PUBLIC_RECIPIENT_NEED_MATCH': 'RATIO_0_1',
    'TARGET_CHARGE_ACTIVE': 'BOOL',
    'TARGET_CHARGE_CAST_TIME': 'TURNS',
    'REACTION_DAMAGE_MULTIPLIER': 'RATIO_0_1',
    'REACTION_DODGE_PROBABILITY': 'PROBABILITY_0_1',
    'REACTION_COUNTER_WINDOW_OPEN': 'BOOL'
  };
  var UNIT_FAMILIES = ['COUNT', 'ABS', 'POWER', 'PERCENT', 'RATIO_0_1', 'PROBABILITY_0_1', 'TURNS', 'BOOL', 'ENUM', 'RATIO'];
  var BOOL_CODES = ['OVERKILL_AVAILABILITY', 'HARD_EXCLUSION', 'DAMAGE_TYPE', 'STATE_PRESENCE', 'TARGET_CHARGE_ACTIVE', 'REACTION_COUNTER_WINDOW_OPEN'];

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
    'SIDE_UNOBSERVED', 'STATE_FORM_UNMAPPED', 'CONFLICTING_DELIVERIES', 'NON_FINITE_DELIVERY',
    'SOURCE_PROVENANCE_INCOMPLETE'
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
  var BATCH2_FAMILY = {
    '状态施加': ['STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT'],
    '召唤生成': ['SUMMON_COUNT', 'SUMMON_STRENGTH', 'SUMMON_DURATION'],
    '结算修正': ['SETTLEMENT_MODIFIER_PERCENT']
  };
  // projectionFamilies prototype legitimacy is attested at runtime: the authoritative
  // 27-name registry is carried in input.prototypeRegistry (read-only PDA registry
  // attestation carrier stamped by BehaviorCandidateFeatureBridge_Module). No
  // hardcoded prototype name list lives in this module; unknown names and registry
  // hash/sourceContractHash drift fail closed; new prototypes auto-adopt.
  var MECHANIC_METADATA_CLOSED_KEYS = [
    'sourceEffectId', '生效方式', '结算标签', '抗性类型', '驱动属性', '影响方向',
    '对应等级', '触发方式', '触发限制', '结算', '限定元素', '吸收资源', '吸收来源'
  ];
  var MECHANIC_METADATA_SUBSETS = {
    '伤害结算': ['生效方式', '结算标签', '抗性类型', '对应等级'],
    '资源变化': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '护盾变化': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '属性修正': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '判定修正': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '状态施加': ['生效方式', '驱动属性', '影响方向', '对应等级', '触发方式'],
    '召唤生成': ['生效方式', '触发限制'],
    '结算修正': ['生效方式', '结算', '限定元素', '吸收资源', '吸收来源', '影响方向', '驱动属性', '对应等级']
  };
  var GRANT_TYPES = ['SUMMON_WINDOW', 'FOLLOW_UP', 'WINDOW_ADJUST', 'SETTLEMENT_RATIO_ADJUST'];

  var FORBIDDEN_SOURCE_CODE = {
    'ROUTE': 'ROUTE_INPUT_REJECTED',
    'WORLD_CLONE': 'WORLD_CLONE_REJECTED',
    'RESULT_WORLD': 'RESULT_WORLD_CARTESIAN_REJECTED',
    'HIDDEN': 'HIDDEN_INPUT_REJECTED',
    'WALL_CLOCK': 'WALL_CLOCK_REJECTED',
    'SKILL_ROLE_NAME': 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
    'TEACHER': 'TEACHER_INPUT_REJECTED',
    'PROTOTYPE_NAME_WEIGHTING': 'PROTOTYPE_NAME_WEIGHTING_REJECTED'
  };
  var FORBIDDEN_TOP_KEY = {
    'route': 'ROUTE_INPUT_REJECTED',
    'worldClone': 'WORLD_CLONE_REJECTED',
    'resultWorld': 'RESULT_WORLD_CARTESIAN_REJECTED',
    'hidden': 'HIDDEN_INPUT_REJECTED',
    'wallClock': 'WALL_CLOCK_REJECTED',
    'skillRoleName': 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
    'teacher': 'TEACHER_INPUT_REJECTED',
    'kernelRouteValue': 'ROUTE_INPUT_REJECTED',
    'prototypeNameWeighting': 'PROTOTYPE_NAME_WEIGHTING_REJECTED'
  };

  var INPUT_KEYS = [
    'candidate', 'publicSnapshot', 'atomicFacts', 'directFacts', 'legalityFlags',
    'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'publicCost',
    'publicProbability', 'publicDeclarations', 'forbiddenFacts', 'branchCombination',
    'preMultiplied', 'mechanicMetadataEntries', 'projectionFamilies', 'prototypeRegistry',
    'creationProfile', 'actionOpportunity'
  ];
  var CANDIDATE_KEYS = ['candidateId', 'actorId', 'actorSide', 'actionKind', 'targetSet', 'paymentMode'];
  var ACTION_OPPORTUNITY_KEYS = ['role', 'sourceActorId', 'incomingAction', 'actionContext', 'counterWindow', 'reactionMechanics'];
  var REACTION_MECHANICS_KEYS = [
    'candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId',
    'targetId', 'prepared', 'damageMultiplier', 'dodgeProbability',
    'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'
  ];
  var REACTION_RESPONSE_KINDS = ['PASS_OPPORTUNITY', 'DEFEND', 'EVADE'];
  var SNAPSHOT_KEYS = ['units', 'sides', 'actorStatus'];
  var UNIT_FIELDS = ['hp', 'hp_max', 'sp', 'sp_max', 'men', 'men_max', 'vit', 'vit_max', 'def', 'agi', 'shield', '状态效果', '蓄力技能'];
  var NUMERIC_UNIT_FIELDS = ['hp', 'hp_max', 'sp', 'sp_max', 'men', 'men_max', 'vit', 'vit_max', 'def', 'agi', 'shield'];
  // R4b2 delivery identity: HP_DELTA atomic rows carry effectInstanceId/targetId
  // (transcribed by the bridge from preview contribution identity) plus the
  // decision-visible damageBasis.basisView attestation inside evidence.
  var ATOMIC_KEYS = ['eventId', 'sourceActionId', 'outcomeKind', 'expectedDelta', 'hitCheckApplicability', 'evidence', 'effectInstanceId', 'targetId'];
  var EVIDENCE_KEYS = ['hitProbability', 'damageBasis', 'deliveryStatus'];
  var ROW_KEYS = ['schemaVersion', 'factType', 'key', 'sourceActionId', 'sourceActorId', 'sourceEffectId', 'targetIds', 'amount', 'unit', 'durationTurns'];
  var LM_KEYS = ['judgmentRates', 'taunt', 'tauntRemoved', 'stateMigration', 'stateSwap', 'mechanismRemoval', 'hardExclusions', 'legalityFlags'];
  var OM_KEYS = ['resourceLocks', 'opportunityConstraints', 'interferenceRates', 'dependencyTokens'];
  var SCHED_SHAPES = {
    WINDOW_ADJUST: ['entryId', 'operation', '调整字段', '调整方式', '调整回合', '调整tick', '调整次数', '结算倍率'],
    SETTLEMENT_RATIO_ADJUST: ['entryId', 'operation', '结算倍率'],
    FOLLOW_UP: ['entryId', 'grantType', 'ownerId', 'followUpKey', 'triggerKey', 'maxActions', 'payloadDirectFacts'],
    SUMMON_WINDOW: ['entryId', 'grantType', '召唤单位类型', '召唤物名称', '行动模式', 'durationTurns']
  };
  var TRIGGER_ENUM = ['主动触发', '随下次行动触发'];
  var COST_KEYS = ['resource', 'amount'];
  var DECL_KEYS = ['revealStrength', 'declaredOverkill'];
  var FORBIDDEN_FACT_KEYS = ['source', 'fact'];
  var CREATION_PROFILE_KEYS = ['recipientId', 'useEffects'];
  var CREATION_PROFILE_ROW_KEYS = ['原型', '目标', '资源', '数值'];

  var CONTRACT_HASHES = {
    featureContract: '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76',
    featureSchema: 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49',
    featureCases: '4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55',
    policyContract: '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8',
    policySchema: '3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e',
    governed: {
      provider: 'cc32c251236906c5e128164f76a25a1196ebe089ef7903edb454e3374a90f156',
      adapterContract: '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
      adapterSchema: '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
      adapterCases: '1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c',
      directFactRow: '493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917'
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
  function isPlainObject(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    var proto = Object.getPrototypeOf(o);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      hasOwn(proto, 'constructor') && proto.constructor && proto.constructor.name === 'Object');
  }
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
  // Deterministic sandbox-safe hash (FNV-1a 32-bit over UTF-16 code units of the
  // canonical JSON {"prototypeNames":[...]}). Verifies the PDA registry attestation
  // carrier inside prototypeRegistry; production sandboxes have no crypto, so the
  // file-level SHA-256 anchors stay harness-side.
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

  function validateReactionRefs(value, field) {
    if (!Array.isArray(value)) throw rejection('MISSING_SOURCE_REFERENCE', { field: field });
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
    if (!isPlainObject(actionEvent)) throw rejection('MISSING_SOURCE_REFERENCE', { field: field + '.actionEvent' });
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

  function validateActionOpportunity(input) {
    var opportunity = input.actionOpportunity;
    if (opportunity === undefined) return;
    if (!isPlainObject(opportunity)) throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity' });
    rejectUnknownKeys(opportunity, ACTION_OPPORTUNITY_KEYS, 'actionOpportunity');
    validateIdString(opportunity.role, 'actionOpportunity.role');
    if (opportunity.sourceActorId !== undefined) validateIdString(opportunity.sourceActorId, 'actionOpportunity.sourceActorId');
    if (opportunity.counterWindow !== undefined && typeof opportunity.counterWindow !== 'boolean') {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.counterWindow' });
    }
    var actionContext = validateActionContext(opportunity.actionContext, 'actionOpportunity.actionContext');
    var incoming = opportunity.incomingAction;
    if (incoming !== undefined && incoming !== null) {
      if (!isPlainObject(incoming)) throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.incomingAction' });
      if (hasOwn(incoming, 'reactionMechanics') || hasOwn(incoming, 'damageMultiplier') || hasOwn(incoming, 'dodgeProbability')) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.incomingAction' });
      }
      validateIdString(incoming.sourceActionId, 'actionOpportunity.incomingAction.sourceActionId');
    }
    if (actionContext) {
      var refs = contextRefs(actionContext);
      if (!incoming || !sameReactionRefs(incoming.sourceFactIds, refs.sourceFactIds) ||
        !sameReactionRefs(incoming.sourceEventIds, refs.sourceEventIds) || incoming.sourceActionId !== refs.sourceActionId) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.identity' });
      }
    }
    var mechanics = opportunity.reactionMechanics;
    if (!isPlainObject(mechanics)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'actionOpportunity.reactionMechanics' });
    rejectUnknownKeys(mechanics, REACTION_MECHANICS_KEYS, 'actionOpportunity.reactionMechanics');
    var required = ['candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId', 'targetId', 'prepared', 'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'];
    for (var r = 0; r < required.length; r += 1) {
      if (mechanics[required[r]] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'actionOpportunity.reactionMechanics.' + required[r] });
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
    if (mechanics.prepared !== true || mechanics.candidateId !== input.candidate.candidateId ||
      mechanics.targetId !== input.candidate.actorId || mechanics.responseKind !== input.candidate.actionKind ||
      mechanics.sourceActorId !== opportunity.sourceActorId || !incoming || mechanics.sourceActionId !== incoming.sourceActionId ||
      input.candidate.targetSet.indexOf(mechanics.targetId) < 0) {
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
      if (mechanics.reason !== 'OK' || !isFinite(mechanics.damageMultiplier) || mechanics.damageMultiplier < 0 || mechanics.damageMultiplier > 1 ||
        !isFinite(mechanics.dodgeProbability) || mechanics.dodgeProbability < 0 || mechanics.dodgeProbability > 1) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.values' });
      }
      if (mechanics.responseKind === 'PASS_OPPORTUNITY' && (mechanics.damageMultiplier !== 1 || mechanics.dodgeProbability !== 0)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.PASS_OPPORTUNITY' });
      }
    } else {
      if (hasOwn(mechanics, 'damageMultiplier') || hasOwn(mechanics, 'dodgeProbability') || UNKNOWN_REASONS.indexOf(mechanics.reason) < 0) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.UNKNOWN' });
      }
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
      var chargeField = u['蓄力技能'];
      if (chargeField !== undefined && chargeField !== null && (typeof chargeField !== 'object' || Array.isArray(chargeField))) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'units.' + uid + '.蓄力技能' });
      }
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
      if (f.effectInstanceId !== undefined) validateIdString(f.effectInstanceId, 'atomicFacts[].effectInstanceId');
      if (f.targetId !== undefined) validateIdString(f.targetId, 'atomicFacts[].targetId');
      if (f.hitCheckApplicability === 'APPLICABLE') {
        if (!f.evidence || typeof f.evidence !== 'object') {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].evidence.hitProbability' });
        }
        if (f.evidence.deliveryStatus !== undefined && f.evidence.deliveryStatus !== null) {
          if (['MISSING', 'NON_FINITE'].indexOf(f.evidence.deliveryStatus) < 0) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.deliveryStatus', value: String(f.evidence.deliveryStatus) });
          }
          if (f.evidence.deliveryStatus === 'MISSING' && f.evidence.hitProbability !== undefined) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.deliveryStatus', value: 'MISSING_WITH_PROBABILITY' });
          }
          if (f.evidence.deliveryStatus === 'NON_FINITE' && f.evidence.hitProbability !== undefined) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.deliveryStatus', value: 'NON_FINITE_WITH_PROBABILITY' });
          }
        } else if (f.evidence.hitProbability === undefined) {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].evidence.hitProbability' });
        } else {
          toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability');
        }
      } else if (f.evidence !== undefined) {
        if (typeof f.evidence !== 'object' || f.evidence === null) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence' });
        rejectUnknownKeys(f.evidence, EVIDENCE_KEYS, 'atomicFacts[].evidence');
        if (f.evidence.hitProbability !== undefined) toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability');
      }
      if (f.evidence && typeof f.evidence === 'object' && f.evidence.damageBasis !== undefined) {
        var db = f.evidence.damageBasis;
        if (!db || typeof db !== 'object' || Array.isArray(db)) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.damageBasis' });
        if (typeof db.basisView !== 'string' || ['DECISION_VISIBLE', 'BELIEF', 'RUNTIME_ACTUAL'].indexOf(db.basisView) < 0) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.damageBasis.basisView', value: String(db && db.basisView) });
        }
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
      if (e.entryId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].entryId' });
      validateIdString(e.entryId, 'scheduledFacts[].entryId');
      var shape = null;
      if (e.operation !== undefined) {
        if (e.operation === 'WINDOW_ADJUST') shape = 'WINDOW_ADJUST';
        else if (e.operation === 'SETTLEMENT_RATIO_ADJUST') shape = 'SETTLEMENT_RATIO_ADJUST';
        else throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].operation', value: String(e.operation) });
      } else if (e.grantType !== undefined) {
        if (e.grantType === 'FOLLOW_UP') shape = 'FOLLOW_UP';
        else if (e.grantType === 'SUMMON_WINDOW') shape = 'SUMMON_WINDOW';
        else throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].grantType', value: String(e.grantType) });
      } else {
        throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[]', detail: 'operation or grantType required' });
      }
      rejectUnknownKeys(e, SCHED_SHAPES[shape], 'scheduledFacts[]');
      if (shape === 'WINDOW_ADJUST') {
        if (typeof e['调整字段'] !== 'string' || e['调整字段'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].调整字段' });
        if (typeof e['调整方式'] !== 'string' || e['调整方式'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].调整方式' });
        var wKeys = ['调整回合', '调整tick', '调整次数'];
        for (var wf = 0; wf < wKeys.length; wf += 1) {
          if (e[wKeys[wf]] !== undefined) {
            var wv = toFiniteNumber(e[wKeys[wf]], 'scheduledFacts[].' + wKeys[wf]);
            if (wv < 0 || Math.floor(wv) !== wv) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].' + wKeys[wf], value: wv });
          }
        }
        if (e['结算倍率'] !== undefined) toFiniteNumber(e['结算倍率'], 'scheduledFacts[].结算倍率');
      } else if (shape === 'SETTLEMENT_RATIO_ADJUST') {
        if (e['结算倍率'] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].结算倍率' });
        toFiniteNumber(e['结算倍率'], 'scheduledFacts[].结算倍率');
      } else if (shape === 'FOLLOW_UP') {
        validateIdString(e.ownerId, 'scheduledFacts[].ownerId');
        validateIdString(e.followUpKey, 'scheduledFacts[].followUpKey');
        if (TRIGGER_ENUM.indexOf(e.triggerKey) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].triggerKey', value: String(e.triggerKey) });
        if (!Array.isArray(e.payloadDirectFacts) || e.payloadDirectFacts.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts' });
        for (var pi = 0; pi < e.payloadDirectFacts.length; pi += 1) {
          var prow = e.payloadDirectFacts[pi];
          if (!prow || typeof prow !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[' + pi + ']' });
          rejectUnknownKeys(prow, ROW_KEYS, 'scheduledFacts[].payloadDirectFacts[]');
          if (prow.schemaVersion !== 'DirectFactRowV1') throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].payloadDirectFacts[].schemaVersion' });
          if (typeof prow.factType !== 'string' || FACT_TYPE_ENUM.indexOf(prow.factType) < 0) throw rejection('UNKNOWN_FEATURE_CODE', { field: 'scheduledFacts[].payloadDirectFacts[].factType' });
          if (typeof prow.key !== 'string') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].key' });
          if (typeof prow.sourceActionId !== 'string' || prow.sourceActionId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].sourceActionId' });
          if (typeof prow.sourceActorId !== 'string' || prow.sourceActorId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].sourceActorId' });
          if (typeof prow.sourceEffectId !== 'string' || prow.sourceEffectId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].sourceEffectId' });
          if (typeof prow.unit !== 'string' || UNIT_ENUM.indexOf(prow.unit) < 0) throw rejection('UNKNOWN_UNIT_FAMILY', { field: 'scheduledFacts[].payloadDirectFacts[].unit' });
          toFiniteNumber(prow.amount, 'scheduledFacts[].payloadDirectFacts[].amount');
          var pdur = toFiniteNumber(prow.durationTurns, 'scheduledFacts[].payloadDirectFacts[].durationTurns');
          if (pdur < 0 || Math.floor(pdur) !== pdur) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].payloadDirectFacts[].durationTurns' });
          if (!Array.isArray(prow.targetIds) || prow.targetIds.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].targetIds' });
          for (var tj = 0; tj < prow.targetIds.length; tj += 1) {
            var t = prow.targetIds[tj];
            if (typeof t !== 'string' || t.length === 0 || SYMBOLIC_TARGETS.indexOf(t) >= 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].targetIds', value: String(t) });
          }
        }
        if (e.maxActions !== undefined) {
          if (typeof e.maxActions !== 'number') throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', value: String(e.maxActions) });
          var ma = toFiniteNumber(e.maxActions, 'scheduledFacts[].maxActions');
          if (ma < 1 || Math.floor(ma) !== ma) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', value: ma });
          if (e.triggerKey !== '主动触发') throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', triggerKey: String(e.triggerKey) });
        } else if (e.triggerKey === '主动触发') {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].maxActions' });
        }
      } else if (shape === 'SUMMON_WINDOW') {
        if (typeof e['召唤单位类型'] !== 'string' || e['召唤单位类型'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].召唤单位类型' });
        if (typeof e['召唤物名称'] !== 'string' || e['召唤物名称'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].召唤物名称' });
        if (e['行动模式'] !== undefined && (typeof e['行动模式'] !== 'string' || e['行动模式'].length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].行动模式' });
        if (e.durationTurns !== undefined) {
          var dt = toFiniteNumber(e.durationTurns, 'scheduledFacts[].durationTurns');
          if (dt < 0 || Math.floor(dt) !== dt) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].durationTurns', value: dt });
        }
      }
    }
  }

  // ---- audit-only bridges: mechanicMetadataEntries / projectionFamilies (rev4) ----
  function validateMechanicMetadataEntries(input) {
    var mm = input.mechanicMetadataEntries;
    if (mm === undefined) return;
    if (!Array.isArray(mm)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries' });
    for (var e = 0; e < mm.length; e += 1) {
      var entry = mm[e];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries[' + e + ']' });
      rejectUnknownKeys(entry, MECHANIC_METADATA_CLOSED_KEYS, 'mechanicMetadataEntries[]');
      if (entry.sourceEffectId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries[].sourceEffectId' });
      validateIdString(entry.sourceEffectId, 'mechanicMetadataEntries[].sourceEffectId');
      if (entry['生效方式'] !== undefined && ['独立生效', '跟随主原型'].indexOf(entry['生效方式']) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.生效方式', value: String(entry['生效方式']) });
      if (entry['对应等级'] !== undefined) toFiniteNumber(entry['对应等级'], 'mechanicMetadataEntries.对应等级');
      if (entry['限定元素'] !== undefined) {
      if (!Array.isArray(entry['限定元素'])) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.限定元素' });
      var seen = {};
      for (var i = 0; i < entry['限定元素'].length; i += 1) {
        var el = entry['限定元素'][i];
        if (typeof el !== 'string' || el.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadata.限定元素[' + i + ']' });
        if (hasOwn(seen, el)) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadata.限定元素', duplicate: el });
        seen[el] = true;
      }
      }
      // 触发限制 is audit-only metadata: revision 4 inputContract closes it as a
      // non-empty string OR a closed {周期: string, 次数: integer >= 1} object
      // (unknown keys / zero count / missing 周期 rejected); its value never enters
      // features (PDA keeps PENDING_TRIGGER_PROJECTION semantics upstream).
      if (entry['触发限制'] !== undefined) {
        var tl = entry['触发限制'];
        if (typeof tl === 'string') {
          if (tl.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制' });
        } else if (tl && typeof tl === 'object' && !Array.isArray(tl)) {
          rejectUnknownKeys(tl, ['周期', '次数'], 'mechanicMetadataEntries.触发限制');
          if (typeof tl['周期'] !== 'string' || tl['周期'].length === 0) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制.周期' });
          }
          if (typeof tl['次数'] !== 'number' || !isFinite(tl['次数']) || Math.floor(tl['次数']) !== tl['次数'] || tl['次数'] < 1) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制.次数' });
          }
        } else {
          throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制' });
        }
      }
      var textKeys = ['结算标签', '抗性类型', '驱动属性', '影响方向', '触发方式', '结算', '吸收资源', '吸收来源'];
      for (var t = 0; t < textKeys.length; t += 1) {
        if (entry[textKeys[t]] !== undefined && (typeof entry[textKeys[t]] !== 'string' || entry[textKeys[t]].length === 0)) {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries.' + textKeys[t] });
        }
      }
      // Per-prototype subset violation: when projectionFamilies identifies the same
      // sourceEffectId, metadata keys must stay inside that prototype's closed subset.
      var pf = input.projectionFamilies;
      if (Array.isArray(pf)) {
        for (var p = 0; p < pf.length; p += 1) {
          if (pf[p].sourceEffectId !== entry.sourceEffectId) continue;
          var subset = MECHANIC_METADATA_SUBSETS[pf[p].prototype];
          if (!subset) continue;
          for (var k in entry) {
            if (!hasOwn(entry, k)) continue;
            if (k === 'sourceEffectId') continue;
            if (subset.indexOf(k) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries', prototype: pf[p].prototype, extraKey: k });
          }
        }
      }
    }
  }
  function validatePrototypeRegistry(input) {
    var pr = input.prototypeRegistry;
    if (pr === undefined) {
      if (Array.isArray(input.projectionFamilies)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'prototypeRegistry' });
      return;
    }
    if (!pr || typeof pr !== 'object' || Array.isArray(pr)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'prototypeRegistry' });
    rejectUnknownKeys(pr, ['registryId', 'prototypeNames', 'prototypeRegistryHash', 'sourceContractHash'], 'prototypeRegistry');
    if (typeof pr.registryId !== 'string' || pr.registryId.indexOf('RC6-M2-PROTOTYPE-DIRECT-ADAPTER') !== 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.registryId', value: pr.registryId });
    }
    var names = pr.prototypeNames;
    if (!Array.isArray(names) || names.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames' });
    for (var i = 0; i < names.length; i += 1) {
      var n = names[i];
      if (typeof n !== 'string' || n.length === 0 || n.length > 512 || /[\u0000-\u001F\u007F]/.test(n)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames[' + i + ']' });
      }
      if (i > 0 && cmpStr(names[i - 1], n) >= 0) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames', notCanonicalSorted: true });
      }
    }
    if (typeof pr.prototypeRegistryHash !== 'string' || !/^[0-9a-f]{8}$/.test(pr.prototypeRegistryHash) || pr.prototypeRegistryHash !== fnv1a32Hex(names)) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeRegistryHash' });
    }
    if (typeof pr.sourceContractHash !== 'string' || !/^[0-9a-f]{64}$/.test(pr.sourceContractHash) || pr.sourceContractHash !== CONTRACT_HASHES.governed.adapterContract) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.sourceContractHash' });
    }
  }

  function validateProjectionFamilies(input) {
    var pf = input.projectionFamilies;
    if (pf === undefined) return;
    if (!input.prototypeRegistry) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'prototypeRegistry' });
    var names = input.prototypeRegistry.prototypeNames;
    if (!Array.isArray(pf)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'projectionFamilies' });
    var seen = {};
    for (var i = 0; i < pf.length; i += 1) {
      var e = pf[i];
      if (!e || typeof e !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'projectionFamilies[' + i + ']' });
      rejectUnknownKeys(e, ['sourceEffectId', 'prototype'], 'projectionFamilies[]');
      validateIdString(e.sourceEffectId, 'projectionFamilies[].sourceEffectId');
      if (typeof e.prototype !== 'string' || e.prototype.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'projectionFamilies[].prototype' });
      if (names.indexOf(e.prototype) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'projectionFamilies[].prototype', value: e.prototype });
      var uid = e.sourceEffectId + '\u0000' + e.prototype;
      if (hasOwn(seen, uid)) throw rejection('INVALID_OPTION_VALUE', { field: 'projectionFamilies', duplicate: uid });
      seen[uid] = true;
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

  function validateCreationProfile(input) {
    var cp = input.creationProfile;
    if (cp === undefined) return;
    if (typeof cp !== 'object' || cp === null || Array.isArray(cp)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile' });
    rejectUnknownKeys(cp, CREATION_PROFILE_KEYS, 'creationProfile');
    if (cp.recipientId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.recipientId' });
    validateIdString(cp.recipientId, 'creationProfile.recipientId');
    if (cp.useEffects === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects' });
    if (!Array.isArray(cp.useEffects)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects' });
    for (var i = 0; i < cp.useEffects.length; i += 1) {
      var row = cp.useEffects[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects[' + i + ']' });
      rejectUnknownKeys(row, CREATION_PROFILE_ROW_KEYS, 'creationProfile.useEffects[' + i + ']');
      for (var k = 0; k < CREATION_PROFILE_ROW_KEYS.length; k += 1) {
        var key = CREATION_PROFILE_ROW_KEYS[k];
        if (row[key] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects[' + i + '].' + key });
      }
      if (typeof row['原型'] !== 'string' || row['原型'].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].原型' });
      if (typeof row['目标'] !== 'string' || row['目标'].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].目标' });
      if (typeof row['数值'] !== 'string' || row['数值'].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].数值' });
      var res = row['资源'];
      if (typeof res === 'string') {
        if (res.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
      } else if (Array.isArray(res)) {
        if (res.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
        for (var r = 0; r < res.length; r += 1) {
          if (typeof res[r] !== 'string' || res[r].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源[' + r + ']' });
        }
      } else {
        throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
      }
    }
  }

  function validateInput(input) {
    checkForbiddenInput(input);
    validateTopLevelKeys(input);
    validateCandidate(input);
    validateActionOpportunity(input);
    validateSnapshot(input);
    validateAtomicFacts(input);
    validateDirectFactsRows(input);
    validateLegalityFlags(input);
    validateLegalityModifiers(input);
    validateOpportunityModifiers(input);
    validateScheduledFacts(input);
    validateMechanicMetadataEntries(input);
    validatePrototypeRegistry(input);
    validateProjectionFamilies(input);
    validatePublicCost(input);
    validatePublicProbability(input);
    validatePublicDeclarations(input);
    validateCreationProfile(input);
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
      if (unit === 'ABS') {
        out.push(kKnown('RESOURCE_DELTA', 'ABS', amount));
      } else if (unit === 'PERCENT') {
        out.push(kKnown('RESOURCE_DELTA_PERCENT', 'PERCENT', amount));
      } else {
        throw rejection('UNIT_FAMILY_MISMATCH', { factType: factType, key: key, unit: unit });
      }
    } else if (factType === 'SHIELD_DELTA') {
      if (unit === 'ABS') {
        out.push(kKnown('SHIELD_DELTA', 'ABS', amount));
      } else if (unit === 'PERCENT') {
        // Percent-declared shield magnitudes cannot be faithfully scalarized
        // into the ABS shield-delta feature: the final ABS settlement depends on
        // effect-strength resolution and is not public at feature time. The row
        // keeps its feature home and sourceFactIds ownership as UNKNOWN
        // (FINAL_SETTLEMENT_UNKNOWN), never coerced to ABS, never OUTSIDE.
        out.push(kUnknown('SHIELD_DELTA', 'ABS', 'FINAL_SETTLEMENT_UNKNOWN'));
      } else {
        throw rejection('UNIT_FAMILY_MISMATCH', { factType: factType, key: key, unit: unit });
      }
    } else if (factType === 'STATE_DELTA') {
      if (key === 'settlement.primary') {
        expectUnit(unit, 'PERCENT');
        out.push(kKnown('SETTLEMENT_MODIFIER_PERCENT', 'PERCENT', amount));
      } else {
        if (ATTRIBUTE_KEYS.indexOf(key) >= 0) {
          expectUnit(unit, 'PERCENT');
          out.push(kKnown('ATTRIBUTE_DELTA', 'PERCENT', amount));
        } else if (JUDGMENT_KEYS.indexOf(key) >= 0) {
          expectUnit(unit, 'PERCENT');
          out.push(kKnown('JUDGMENT_DELTA', 'PERCENT', amount));
        } else if (key === 'state.primary' || key === 'state.secondary') {
          expectUnit(unit, 'PERCENT');
          out.push(kKnown('STATE_DELTA_PERCENT', 'PERCENT', amount));
        } else if (unit === 'PERCENT') {
          out.push(kUnknown('STATE_DELTA_PERCENT', 'PERCENT', 'MISSING_SOURCE_FACT'));
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
      }
    } else if (factType === 'SUMMON_WINDOW') {
      if (key === 'summon.count') {
        if (unit === 'COUNT') out.push(kKnown('SUMMON_COUNT', 'COUNT', amount));
        else out.push(kUnknown('SUMMON_COUNT', 'COUNT', 'MISSING_SOURCE_FACT'));
      } else if (key === 'summon.strength') {
        if (unit === 'RATIO') out.push(kKnown('SUMMON_STRENGTH', 'RATIO', amount));
        else out.push(kUnknown('SUMMON_STRENGTH', 'RATIO', 'MISSING_SOURCE_FACT'));
      } else if (key === 'summon.duration') {
        if (unit === 'TURNS') out.push(kKnown('SUMMON_DURATION', 'TURNS', amount));
        else out.push(kUnknown('SUMMON_DURATION', 'TURNS', 'MISSING_SOURCE_FACT'));
      } else {
        // summon.inheritRatio and unknown summon keys map to no feature code
        return [];
      }
    } else {
      return null;
    }
    return out;
  }

  function summonFamilyBlock(recs, seid, block) {
    var codes = [
      ['SUMMON_COUNT', 'COUNT', 'summon.count'],
      ['SUMMON_STRENGTH', 'RATIO', 'summon.strength'],
      ['SUMMON_DURATION', 'TURNS', 'summon.duration']
    ];
    for (var c = 0; c < codes.length; c += 1) {
      var code = codes[c][0];
      var family = codes[c][1];
      var key = codes[c][2];
      var info = block[key];
      if (info && info.unit === family) {
        recs.push(rec(code, family, 'KNOWN', 'OK', info.amount, [info.factId], [], 1, seid, key));
      } else if (info) {
        recs.push(rec(code, family, 'UNKNOWN', 'MISSING_SOURCE_FACT', undefined, [info.factId], [], 1, seid, key));
      } else {
        recs.push(rec(code, family, 'UNKNOWN', 'MISSING_SOURCE_FACT', undefined, [], [], 1, seid, ''));
      }
    }
  }

  function computeRows(input) {
    var recs = [];
    var outside = 0;
    var outsideFactIds = [];
    var seen = {};
    var rows = input.directFacts || [];
    var summonByEffect = {};
    var summonActivated = {};
    var pfSummon = {};
    var pf = input.projectionFamilies;
    if (Array.isArray(pf)) {
      for (var f = 0; f < pf.length; f += 1) {
        if (pf[f].prototype === '召唤生成') pfSummon[pf[f].sourceEffectId] = true;
      }
    }
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var factType = row.factType;
      var key = row.key;
      var amount = toFiniteNumber(row.amount, 'directFacts.amount');
      var dur = toFiniteNumber(row.durationTurns, 'directFacts.durationTurns');
      var rowFactId = row.sourceEffectId + '::' + key;
      if (hasOwn(seen, rowFactId)) throw rejection('DUPLICATE_FEATURE', { rowFactId: rowFactId });
      seen[rowFactId] = true;
      if (factType === 'SUMMON_WINDOW') {
        if (key === 'summon.count' || key === 'summon.strength' || key === 'summon.duration') {
          if (!summonByEffect[row.sourceEffectId]) summonByEffect[row.sourceEffectId] = {};
          summonByEffect[row.sourceEffectId][key] = { unit: row.unit, amount: amount, factId: rowFactId };
          summonActivated[row.sourceEffectId] = true;
        } else {
          // summon.inheritRatio and unknown summon keys map to no feature code
          outside += 1;
          outsideFactIds.push(rowFactId);
        }
        continue;
      }
      var projs = projectRow(factType, key, row.unit, amount, dur);
      if (projs === null || projs.length === 0) { outside += 1; outsideFactIds.push(rowFactId); continue; }
      for (var p = 0; p < projs.length; p += 1) {
        var pr = projs[p];
        recs.push(rec(pr.featureCode, pr.unitFamily, pr.status, pr.reasonCode, pr.value, [rowFactId], [], 1, row.sourceEffectId, key));
      }
    }
    var summonEffects = Object.keys(summonActivated);
    for (var se = 0; se < summonEffects.length; se += 1) {
      summonFamilyBlock(recs, summonEffects[se], summonByEffect[summonEffects[se]]);
    }
    for (var pfk in pfSummon) {
      if (hasOwn(pfSummon, pfk) && !hasOwn(summonActivated, pfk)) {
        summonFamilyBlock(recs, pfk, {});
      }
    }
    recs = collapseAttributeDeltaRows(recs);
    return { recs: recs, outsideCount: outside, outsideFactIds: outsideFactIds };
  }

  // Same-candidate duplicate KNOWN ATTRIBUTE_DELTA rows (same unit) collapse to
  // a single row: stable-order signed SUM with unioned sourceFactIds and
  // sourceEventIds. Mixed units or non-finite values are rejected; MAX is never
  // used. computeRows runs strictly once per candidate, so all rows here are
  // provably within the same candidate scope by construction.
  function collapseAttributeDeltaRows(recs) {
    var attrs = [];
    var kept = [];
    for (var i = 0; i < recs.length; i += 1) {
      if (recs[i].featureCode === 'ATTRIBUTE_DELTA' && recs[i].status === 'KNOWN') attrs.push(recs[i]);
      else kept.push(recs[i]);
    }
    if (attrs.length <= 1) return recs;
    var unit = attrs[0].unitFamily;
    var sum = 0;
    var factIds = [];
    var eventIds = [];
    for (var a = 0; a < attrs.length; a += 1) {
      if (attrs[a].unitFamily !== unit) {
        throw rejection('UNIT_FAMILY_MISMATCH', { featureCode: 'ATTRIBUTE_DELTA', unit: attrs[a].unitFamily, expected: unit });
      }
      if (typeof attrs[a].value !== 'number' || !Number.isFinite(attrs[a].value)) {
        throw rejection('INVALID_OPTION_VALUE', { featureCode: 'ATTRIBUTE_DELTA', value: attrs[a].value });
      }
      sum = normZero(sum + attrs[a].value);
      factIds = factIds.concat(attrs[a].sourceFactIds || []);
      eventIds = eventIds.concat(attrs[a].sourceEventIds || []);
    }
    var uniqueFactIds = [];
    for (var f = 0; f < factIds.length; f += 1) {
      if (uniqueFactIds.indexOf(factIds[f]) < 0) uniqueFactIds.push(factIds[f]);
    }
    kept.push(rec('ATTRIBUTE_DELTA', unit, 'KNOWN', 'OK', sum, uniqueFactIds, eventIds, attrs.length, attrs[0]._seid, attrs[0]._key));
    return kept;
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

  // R4b2 damage-delivery hit axis. A valid delivery requires outcomeKind
  // HP_DELTA, evidence.damageBasis.basisView DECISION_VISIBLE, nonempty
  // effectInstanceId + targetId and finite hitProbability. Rows are deduped by
  // (effectInstanceId,targetId); same identity with differing probabilities is
  // UNKNOWN(CONFLICTING_DELIVERIES). Candidate value = arithmetic mean over the
  // declared targets that have a hit axis: first the per-target mean over that
  // target's independent deliveries, then the mean over targets. Targets with
  // no damage delivery are NO_HIT_AXIS and excluded from the denominator; a
  // candidate with no damage delivery at all is NOT_APPLICABLE(NO_HIT_AXIS).
  // deliveryStatus 'MISSING'/'NON_FINITE' is the explicit fail-closed carrier
  // for a delivery that mechanically should exist but is absent/non-finite.
  function successProbabilityRec(input) {
    var facts = Array.isArray(input.atomicFacts) ? input.atomicFacts : [];
    var targets = input.candidate.targetSet;
    var deliveryByKey = {};
    var keyOrder = [];
    var conflictKey = null;
    var brokenReason = null;
    var brokenEvents = [];
    var unresolvedEvent = null;
    var hasDeliveryRow = false;
    for (var i = 0; i < facts.length; i += 1) {
      var f = facts[i];
      if (String(f.outcomeKind || '').trim() !== 'HP_DELTA') continue;
      hasDeliveryRow = true;
      if (f.hitCheckApplicability === 'UNKNOWN') {
        if (!unresolvedEvent) unresolvedEvent = f.eventId;
        continue;
      }
      if (f.hitCheckApplicability === 'NOT_APPLICABLE') continue;
      var ev = f.evidence && typeof f.evidence === 'object' ? f.evidence : {};
      var status = ev.deliveryStatus;
      if (status === 'MISSING') {
        if (!brokenReason) brokenReason = 'MISSING_SOURCE_FACT';
        brokenEvents.push(f.eventId);
        continue;
      }
      if (status === 'NON_FINITE') {
        if (!brokenReason) brokenReason = 'NON_FINITE_DELIVERY';
        brokenEvents.push(f.eventId);
        continue;
      }
      var basis = ev.damageBasis && typeof ev.damageBasis === 'object' ? ev.damageBasis : null;
      var basisOk = !!basis && String(basis.basisView || '').trim() === 'DECISION_VISIBLE';
      var effId = typeof f.effectInstanceId === 'string' ? f.effectInstanceId.trim() : '';
      var tgtId = typeof f.targetId === 'string' ? f.targetId.trim() : '';
      var idOk = effId.length > 0 && tgtId.length > 0;
      if (!basisOk || !idOk) {
        if (!brokenReason) brokenReason = 'MISSING_SOURCE_FACT';
        brokenEvents.push(f.eventId);
        continue;
      }
      var raw = ev.hitProbability;
      if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) {
        if (!brokenReason) brokenReason = 'NON_FINITE_DELIVERY';
        brokenEvents.push(f.eventId);
        continue;
      }
      var value = Number(raw);
      var key = effId + '\u0000' + tgtId;
      var entry = deliveryByKey[key];
      if (!entry) {
        entry = { p: value, targetId: tgtId, events: [] };
        deliveryByKey[key] = entry;
        keyOrder.push(key);
      } else if (entry.p !== value) {
        if (!conflictKey) conflictKey = key;
        entry.conflict = true;
      }
      entry.events.push(f.eventId);
    }
    if (unresolvedEvent) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONDITIONAL_PROBABILITY_UNRESOLVED', [], [unresolvedEvent]);
    if (conflictKey) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONFLICTING_DELIVERIES', [], deliveryByKey[conflictKey].events);
    if (brokenReason) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', brokenReason, [], brokenEvents);
    // R4b2 declared-target mechanical closure: the PDA projections lifted into
    // directFacts are the authoritative obligation carrier. Every HP_DELTA row's
    // targetIds is a target the action mechanically owes a damage delivery to;
    // a declared obligation target with no transcribed delivery is a missing
    // source fact (fail-closed), not a NO_HIT_AXIS exclusion. Non-obligation
    // declared targets keep the existing no-hit-axis exclusion semantics.
    var obligationTargets = {};
    var rows = Array.isArray(input.directFacts) ? input.directFacts : [];
    for (var r = 0; r < rows.length; r += 1) {
      if (String(rows[r].factType || '').trim() !== 'HP_DELTA') continue;
      var ids = Array.isArray(rows[r].targetIds) ? rows[r].targetIds : [];
      for (var u = 0; u < ids.length; u += 1) obligationTargets[ids[u]] = true;
    }
    if (Object.keys(obligationTargets).length > 0) {
      var deliveredTargets = {};
      for (var d = 0; d < keyOrder.length; d += 1) deliveredTargets[deliveryByKey[keyOrder[d]].targetId] = true;
      var obligationKeys = Object.keys(obligationTargets);
      for (var o = 0; o < obligationKeys.length; o += 1) {
        if (!hasOwn(deliveredTargets, obligationKeys[o])) {
          return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'MISSING_SOURCE_FACT', [], []);
        }
      }
    }
    if (!hasDeliveryRow) {
      if (!targets || targets.length === 0) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'MISSING_SOURCE_FACT');
      return na('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'NO_HIT_AXIS');
    }
    if (!keyOrder.length) return na('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'NO_HIT_AXIS');
    var targetSum = {};
    var targetCount = {};
    var targetEventIds = {};
    for (var o = 0; o < keyOrder.length; o += 1) {
      var item = deliveryByKey[keyOrder[o]];
      targetSum[item.targetId] = (targetSum[item.targetId] || 0) + item.p;
      targetCount[item.targetId] = (targetCount[item.targetId] || 0) + 1;
      for (var x = 0; x < item.events.length; x += 1) {
        (targetEventIds[item.targetId] = targetEventIds[item.targetId] || []).push(item.events[x]);
      }
    }
    var targetIds = Object.keys(targetSum);
    var total = 0;
    var allEventIds = [];
    for (var t = 0; t < targetIds.length; t += 1) {
      total += targetSum[targetIds[t]] / targetCount[targetIds[t]];
      for (var y = 0; y < targetEventIds[targetIds[t]].length; y += 1) allEventIds.push(targetEventIds[targetIds[t]][y]);
    }
    return rec('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'KNOWN', 'OK', total / targetIds.length, [], allEventIds, 0, '', '');
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

  // PUBLIC_RECIPIENT_NEED_MATCH: declared positive recovery (creationProfile.useEffects
  // 资源变化 rows with percent 数值) vs the same observer-visible recipient resource
  // gap. Per (recipientId, resource) duplicates take max, never sum; the value is the
  // arithmetic mean over the actual recovery channels; no channel => KNOWN 0; any
  // unprovable recipient/axis/percent-unit fails closed to UNKNOWN, never guessed.
  // 数值 grammar: optional sign, decimal digits, optional literal percent sign
  // ([+-]?[0-9]+(\.[0-9]+)?%?); negative and zero rows are drains, never recovery
  // channels; malformed strings or non-finite magnitudes are UNKNOWN(MISSING_SOURCE_FACT).
  function recipientNeedMatchRec(input) {
    var cp = input.creationProfile;
    if (!cp || typeof cp !== 'object') return known('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 0);
    if (typeof cp.recipientId !== 'string' || cp.recipientId.length === 0) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    if (!Array.isArray(cp.useEffects)) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    var unit = input.publicSnapshot.units[cp.recipientId];
    var channels = {};
    var factIds = [];
    for (var i = 0; i < cp.useEffects.length; i += 1) {
      var row = cp.useEffects[i];
      if (row['原型'] !== '资源变化') continue;
      var m = /^([+-]?)([0-9]+(?:\.[0-9]+)?)(%)?$/.exec(String(row['数值']).trim());
      if (!m) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
      var ratio = (m[1] === '-' ? -1 : 1) * Number(m[2]);
      if (m[3] === '%') ratio = ratio / 100;
      if (ratio <= 0) continue;
      if (!isFinite(ratio)) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
      if (m[3] !== '%') return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
      var resList = Array.isArray(row['资源']) ? row['资源'] : [row['资源']];
      for (var r = 0; r < resList.length; r += 1) {
        var resName = resList[r];
        if (RESOURCE_NAMES.indexOf(resName) < 0) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        if (!unit || typeof unit !== 'object') return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        var field = RESOURCE_FIELD[resName];
        var cur = unit[field];
        var max = unit[field + '_max'];
        if (cur === undefined || max === undefined) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        cur = toFiniteNumber(cur, 'units.' + cp.recipientId + '.' + field);
        max = toFiniteNumber(max, 'units.' + cp.recipientId + '.' + field + '_max');
        if (max <= 0) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        var gap = (max - cur) / max;
        if (gap < 0) gap = 0;
        if (gap > 1) gap = 1;
        var realized = gap < ratio ? gap : ratio;
        if (realized < 0) realized = 0;
        if (realized > 1) realized = 1;
        channels[resName] = hasOwn(channels, resName) && channels[resName] > realized ? channels[resName] : realized;
        if (factIds.indexOf('creationProfile:useEffects:' + i) < 0) factIds.push('creationProfile:useEffects:' + i);
      }
    }
    var keys = Object.keys(channels);
    if (keys.length === 0) return known('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 0);
    var sum = 0;
    for (var k = 0; k < keys.length; k += 1) sum += channels[keys[k]];
    return rec('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'KNOWN', 'OK', sum / keys.length, factIds.sort(cmpStr), [], 0, '', '');
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
    var affordability = costAffordabilityRec(input);
    if (affordability.status === 'KNOWN' && affordability.value < 1) return 'RESOURCE_INSUFFICIENT';
    return null;
  }

  function scheduledEntryIds(input) {
    var sched = input.scheduledFacts;
    var out = [];
    if (!Array.isArray(sched)) return out;
    for (var i = 0; i < sched.length; i += 1) out.push(sched[i].entryId);
    return out;
  }

  function reactionMechanicsRows(input) {
    var mechanics = input.actionOpportunity && input.actionOpportunity.reactionMechanics;
    var factIds = mechanics && Array.isArray(mechanics.sourceFactIds) ? mechanics.sourceFactIds : [];
    var eventIds = mechanics && Array.isArray(mechanics.sourceEventIds) ? mechanics.sourceEventIds : [];
    var provenanceComplete = factIds.length > 0 && eventIds.length > 0;
    if (!mechanics || mechanics.status !== 'KNOWN' || !provenanceComplete) {
      var reason = !mechanics
        ? 'HIDDEN_AXIS_UNOBSERVED'
        : mechanics.status === 'KNOWN' && !provenanceComplete
          ? 'SOURCE_PROVENANCE_INCOMPLETE'
          : mechanics.reason || 'HIDDEN_AXIS_UNOBSERVED';
      return [
        rec('REACTION_DAMAGE_MULTIPLIER', 'RATIO_0_1', 'UNKNOWN', reason, undefined, factIds, eventIds, 0, '', ''),
        rec('REACTION_DODGE_PROBABILITY', 'PROBABILITY_0_1', 'UNKNOWN', reason, undefined, factIds, eventIds, 0, '', '')
      ];
    }
    return [
      rec('REACTION_DAMAGE_MULTIPLIER', 'RATIO_0_1', 'KNOWN', 'OK', mechanics.damageMultiplier, factIds, eventIds, 0, '', ''),
      rec('REACTION_DODGE_PROBABILITY', 'PROBABILITY_0_1', 'KNOWN', 'OK', mechanics.dodgeProbability, factIds, eventIds, 0, '', '')
    ];
  }

  function reactionCounterWindowRow(input) {
    var opportunity = input.actionOpportunity;
    if (!opportunity) return unk('REACTION_COUNTER_WINDOW_OPEN', 'BOOL', 'MISSING_SOURCE_FACT');
    var mechanics = opportunity.reactionMechanics;
    var factIds = mechanics && Array.isArray(mechanics.sourceFactIds) ? mechanics.sourceFactIds : [];
    var eventIds = mechanics && Array.isArray(mechanics.sourceEventIds) ? mechanics.sourceEventIds : [];
    if (!mechanics || factIds.length === 0 || eventIds.length === 0) {
      return unk('REACTION_COUNTER_WINDOW_OPEN', 'BOOL', mechanics?.status === 'KNOWN'
        ? 'SOURCE_PROVENANCE_INCOMPLETE'
        : mechanics?.reason || 'MISSING_SOURCE_FACT');
    }
    return rec(
      'REACTION_COUNTER_WINDOW_OPEN', 'BOOL', 'KNOWN', 'OK',
      opportunity.role === 'COUNTER' || opportunity.counterWindow === true ? 1 : 0,
      factIds, eventIds, 0, '', '',
    );
  }

  function candidateFeatures(input, outsideCount, outsideFactIds) {
    var out = [];
    out.push(known('RELATION_TARGET_COUNT', 'COUNT', input.candidate.targetSet.length));
    out.push(targetSideRec(input));
    out.push(successProbabilityRec(input));
    out.push(hpRatioRec(input));
    out.push(resourceRatioRec(input));
    out.push(recipientNeedMatchRec(input));
    out.push(costAffordabilityRec(input));
    out.push(revealRec(input));
    out.push(overkillRec(input));
    var excl = hardExclusionCode(input);
    out.push(known('HARD_EXCLUSION', 'BOOL', excl ? 1 : 0));
    out.push(excl ? knownStr('HARD_EXCLUSION_REASON', 'ENUM', excl) : na('HARD_EXCLUSION_REASON', 'ENUM', 'NOT_EXCLUDED'));
    out.push(unk('SETTLEMENT_DAMAGE', 'ABS', 'FINAL_SETTLEMENT_UNKNOWN'));
    out.push(unk('ROLL_REALIZATION', 'BOOL', 'FUTURE_REALIZATION_UNKNOWN'));
    out.push(rec('OUTSIDE_BATCH1_ROW_COUNT', 'COUNT', 'KNOWN', 'OK', outsideCount, outsideFactIds || [], scheduledEntryIds(input), 0, '', ''));
    out.push.apply(out, reactionMechanicsRows(input));
    out.push(reactionCounterWindowRow(input));
    for (var j = 0; j < out.length; j += 1) {
      out[j]._scopeRank = 0;
      out[j]._seid = '';
      out[j]._key = '';
    }
    return out;
  }

  // Per-target charge transport rows (M3 R4b5): one row per declared target in
  // targetSet declaration order. Sources are only the decision-visible public
  // snapshot paths publicSnapshot.units[targetId].蓄力技能.cast_time and
  // publicSnapshot.units[targetId].蓄力技能.skill.前摇 (fallback). Nothing else is
  // read: no Runtime internals, no skill names, no _效果数组, no future values.
  // The facts are transport-only and non-scoreable (catalog CATALOG_ONLY);
  // Provider weights/hashes never reference these codes.
  function chargeCastTime(charge, activeFact) {
    if (charge && typeof charge === 'object' && !Array.isArray(charge)) {
      var ct = charge['cast_time'];
      if (ct !== undefined && ct !== null) {
        var n = (typeof ct === 'string') ? Number(ct) : ct;
        if (typeof n === 'number' && isFinite(n) && n >= 0) {
          return { value: normZero(n), factId: activeFact + '.cast_time' };
        }
      }
      var skill = charge['skill'];
      if (skill && typeof skill === 'object' && !Array.isArray(skill)) {
        var pre = skill['前摇'];
        if (pre !== undefined && pre !== null) {
          var pn = (typeof pre === 'string') ? Number(pre) : pre;
          if (typeof pn === 'number' && isFinite(pn) && pn >= 0) {
            return { value: normZero(pn), factId: activeFact + '.skill.前摇' };
          }
        }
      }
    }
    return null;
  }

  function chargeTargetRows(input) {
    var recs = [];
    var targets = input.candidate.targetSet;
    var units = input.publicSnapshot.units;
    if (targets.length === 0) {
      recs.push(na('TARGET_CHARGE_ACTIVE', 'BOOL', 'NO_TARGET_AXIS'));
      recs.push(na('TARGET_CHARGE_CAST_TIME', 'TURNS', 'NO_TARGET_AXIS'));
      return recs;
    }
    for (var i = 0; i < targets.length; i += 1) {
      var tid = targets[i];
      var key = 'target:' + i;
      var unitPath = 'publicSnapshot.units.' + tid;
      var activeFact = unitPath + '.蓄力技能';
      if (!hasOwn(units, tid)) {
        recs.push(rec('TARGET_CHARGE_ACTIVE', 'BOOL', 'UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', undefined, [unitPath], [], 1, '', key));
        recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', undefined, [unitPath], [], 1, '', key));
        continue;
      }
      var charge = units[tid]['蓄力技能'];
      var chargePresent = charge !== undefined && charge !== null;
      recs.push(rec('TARGET_CHARGE_ACTIVE', 'BOOL', 'KNOWN', 'OK', chargePresent ? 1 : 0, [activeFact], [], 1, '', key));
      if (!chargePresent) {
        // Observable no charge: both facts KNOWN 0 (never a guessed value).
        recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'KNOWN', 'OK', 0, [activeFact], [], 1, '', key));
      } else {
        var cast = chargeCastTime(charge, activeFact);
        if (cast === null) {
          recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'UNKNOWN', 'MISSING_SOURCE_FACT', undefined, [activeFact], [], 1, '', key));
        } else {
          recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'KNOWN', 'OK', cast.value, [cast.factId], [], 1, '', key));
        }
      }
    }
    return recs;
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
    var candRecs = candidateFeatures(input, rowsOut.outsideCount + schedCount, rowsOut.outsideFactIds);
    var doc = assemble(input.candidate.candidateId, candRecs.concat(chargeTargetRows(input)).concat(rowsOut.recs));
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
      batch2PrototypeFamilies: copyOf(BATCH2_FAMILY),
      fixedCatalogPositionsV1: {
        'RELATION_TARGET_COUNT': 0, 'RELATION_TARGET_SIDE': 1, 'SUCCESS_PROBABILITY': 2,
        'PUBLIC_HP_RATIO': 3, 'PUBLIC_RESOURCE_RATIO': 4, 'COST_AFFORDABILITY': 5,
        'REVEAL_STRENGTH': 6, 'OVERKILL_AVAILABILITY': 7, 'HARD_EXCLUSION': 8,
        'HARD_EXCLUSION_REASON': 9, 'SETTLEMENT_DAMAGE': 10, 'ROLL_REALIZATION': 11,
        'OUTSIDE_BATCH1_ROW_COUNT': 12, 'DAMAGE_POWER': 13, 'DAMAGE_SEGMENTS': 14,
        'DAMAGE_PENETRATION': 15, 'DAMAGE_TYPE': 16, 'RESOURCE_DELTA': 17,
        'SHIELD_DELTA': 18, 'ATTRIBUTE_DELTA': 19, 'JUDGMENT_DELTA': 20,
        'STATE_PRESENCE': 21, 'STATE_DURATION': 22, 'STATE_DELTA_PERCENT': 23,
        'SETTLEMENT_MODIFIER_PERCENT': 24, 'SUMMON_COUNT': 25, 'SUMMON_STRENGTH': 26,
        'SUMMON_DURATION': 27, 'RESOURCE_DELTA_PERCENT': 28,
        'PUBLIC_RECIPIENT_NEED_MATCH': 29, 'TARGET_CHARGE_ACTIVE': 30,
        'TARGET_CHARGE_CAST_TIME': 31, 'REACTION_DAMAGE_MULTIPLIER': 32,
        'REACTION_DODGE_PROBABILITY': 33, 'REACTION_COUNTER_WINDOW_OPEN': 34
      },
      caps: copyOf(CAPS),
      workFormula: '14 (F0) + directFactsRows + modifierEntries + scheduledFactsEntries + atomicFactsCount (each row yields at most its own features; no cross-row/branch product); any breach throws CAP_EXCEEDED whole-compile',
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
        recipientNeedMatch: 'PUBLIC_RECIPIENT_NEED_MATCH reads only the structured creationProfile (recipientId + closed useEffects rows) against the same observer-visible recipient resource axes (frozen map 魂力->sp, 精神力->men, 体力->vit, 生命->hp); recovery channel = 资源变化 row with positive percent 数值 (percent /100 is the sole admitted unit; negative/zero rows are drains and never count); per (recipientId, resource) duplicates take max, never sum; value = arithmetic mean over the actual recovery channels; no recovery channel (absent creationProfile, non-recovery or empty useEffects) => KNOWN 0; missing recipientId, recipient unit/current/max unprovable, max<=0, unmappable resource name or unprovable percent unit => UNKNOWN (MISSING_SOURCE_FACT / HIDDEN_AXIS_UNOBSERVED), never guessed; no hidden reads, no future route, no role/skill-name special-casing',
        resourceInsufficientDerivation: 'RESOURCE_INSUFFICIENT derives from the same actor-only affordability check, last in precedence (after legalityFlags/legalityModifiers, actorStatus, TARGET_EMPTY): KNOWN min ratio < 1 (strict cost > available) => RESOURCE_INSUFFICIENT; equality and affordable => not excluded; no publicCost, missing actor/axis or UNKNOWN => no exclusion, never guessed; other hard-exclusion codes keep first-code precedence',
        targetSide: 'sides-map equality only (SELF by id equality, ALLY by side equality, ENEMY otherwise, MIXED on distinct classes, SIDE_UNOBSERVED when any declared target side missing, NO_TARGET_AXIS on empty axis); no prefix guessing/default ALLY/neutral folding',
        successProbability: 'R4b2 damage-delivery hit axis: only outcomeKind HP_DELTA rows with evidence.damageBasis.basisView DECISION_VISIBLE, nonempty effectInstanceId/targetId and finite hitProbability are deliveries; dedupe by (effectInstanceId,targetId), same identity differing probability => UNKNOWN(CONFLICTING_DELIVERIES); per-target mean over independent deliveries then mean over hit-axis targets (targets without delivery are NO_HIT_AXIS and excluded from the denominator); no damage delivery at all => NOT_APPLICABLE(NO_HIT_AXIS); deliveryStatus MISSING/NON_FINITE or missing identity/basis => UNKNOWN fail-closed; empty targetSet keeps existing missing semantics; no FIRST/JOINT/MIN/MAX/applicationProbability/Runtime roll; actionKind never special-cased',
        outsideRowCounting: 'rows outside the batch-1 families plus every scheduledFacts entry count into OUTSIDE_BATCH1_ROW_COUNT; scheduled entryIds recorded in sourceEventIds; nothing silently dropped',
        statePresence: 'STATE_DELTA non-attribute/judgment key: unit=BOOL => KNOWN 1 (amount>0) or 0 (amount<=0); unit=COUNT => UNKNOWN(STATE_FORM_UNMAPPED), never coerced to BOOL; other units => UNIT_FAMILY_MISMATCH; BOOL KNOWN domain strictly {0,1}',
        batch2StateDeltaPercent: 'STATE_DELTA state.primary/state.secondary PERCENT => STATE_DELTA_PERCENT (signed declared magnitude, never multiplied by duration); other PERCENT keys => UNKNOWN(MISSING_SOURCE_FACT); other units/keys keep revision-2 STATE_PRESENCE/UNIT_FAMILY_MISMATCH rules',
        resourceDeltaPercent: 'RESOURCE_OPTION_CHANGED key=resource name unit=PERCENT => RESOURCE_DELTA_PERCENT (raw signed percent, never multiplied by duration); ABS rows keep RESOURCE_DELTA; unsigned percent rows stay PENDING_DIRECTION_PROJECTION upstream and never reach the compiler',
        batch2Settlement: 'STATE_DELTA settlement.primary PERCENT => SETTLEMENT_MODIFIER_PERCENT only (no STATE_DURATION, no HP/RESOURCE double rows from the same effect); SETTLEMENT_DAMAGE stays ALWAYS_UNKNOWN',
        batch2Summon: 'SUMMON_WINDOW rows route summon.count/strength/duration (wrong unit => UNKNOWN(MISSING_SOURCE_FACT) with row fact id); summon.inheritRatio and unknown summon keys map to no feature code and count OUTSIDE_BATCH1_ROW_COUNT with row fact ids; the summon family block (all three codes) is emitted once per activating sourceEffectId (routed row or projectionFamilies 召唤生成); scheduled SUMMON_WINDOW entries never become KNOWN SUMMON_DURATION',
        auditBridges: 'mechanicMetadataEntries (closed per-effect array with per-prototype key subsets per PDA rev5Spec) / projectionFamilies root inputs are the only admitted bridge (bridgeV1); strictly validated closed shapes; values never enter feature values; prototype names are routing/audit identity only (PROTOTYPE_NAME_WEIGHTING_REJECTED)',
        formalCaps: 'MAX_FEATURES_PER_CANDIDATE=256, MAX_FACT_ROWS_PER_CANDIDATE=128, MAX_MODIFIER_ENTRIES_PER_CANDIDATE=64, MAX_WORK_UNITS_PER_CALL=200000; any breach throws CAP_EXCEEDED as a whole-compile rejection, never candidate pruning, never wall clock'
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
        atomicFacts: { required: false, shape: [{ eventId: 'string nonempty', hitCheckApplicability: 'enum APPLICABLE|NOT_APPLICABLE|UNKNOWN', effectInstanceId: 'string (delivery identity, required for HP_DELTA APPLICABLE)', targetId: 'string (delivery target, required for HP_DELTA APPLICABLE)', evidence: { hitProbability: 'number finite (required when APPLICABLE unless deliveryStatus set)', damageBasis: '{ basisView: enum DECISION_VISIBLE|BELIEF|RUNTIME_ACTUAL } (required for HP_DELTA APPLICABLE)', deliveryStatus: 'enum MISSING|NON_FINITE (explicit fail-closed carrier)' }, sourceActionId: 'string', outcomeKind: 'string', expectedDelta: 'number finite' }], closed: true },
        directFacts: { required: false, shape: 'DirectFactRowV1 rows: schemaVersion const DirectFactRowV1, factType enum, key string, sourceActionId/sourceActorId/sourceEffectId nonempty, sourceActorId===candidate.actorId, targetIds nonempty non-symbolic, amount finite, unit enum, durationTurns integer >=0', closed: true },
        legalityFlags: { required: false, shape: 'string[] every member in hardExclusionCodes' },
        legalityModifiers: { required: false, shape: 'judgmentRates/taunt/tauntRemoved/stateMigration/stateSwap/mechanismRemoval metadata; hardExclusions/legalityFlags code arrays restricted to hardExclusionCodes', closed: true },
        opportunityModifiers: { required: false, shape: 'resourceLocks/opportunityConstraints/interferenceRates/dependencyTokens metadata', closed: true },
        scheduledFacts: { required: false, shape: 'closed four-shape: WINDOW_ADJUST {entryId/operation/调整字段/调整方式 + optional 调整回合/调整tick/调整次数/结算倍率}, SETTLEMENT_RATIO_ADJUST {entryId/operation/结算倍率}, FOLLOW_UP {entryId/grantType/ownerId/followUpKey/triggerKey/payloadDirectFacts, maxActions integer >=1 and required only for 主动触发}, SUMMON_WINDOW {entryId/grantType/召唤单位类型/召唤物名称/行动模式/durationTurns}; entryId/ownerId/followUpKey required; all IDs validateIdString; private aliases key/字段/方式 rejected', closed: true },
        mechanicMetadataEntries: { required: false, shape: 'closed entries array, one entry per effect instance: {sourceEffectId (required id) + prototype-allowed Chinese keys} per PDA rev5Spec perPrototypeSubsets (生效方式/结算标签/抗性类型/驱动属性/影响方向/对应等级/触发方式/触发限制/结算/限定元素/吸收资源/吸收来源); audit-only, values never enter features', closed: true },
        projectionFamilies: { required: false, shape: '[{ sourceEffectId: id string, prototype: closed registry prototype enum }] unique; audit-only routing identity, never weighted', closed: true },
        prototypeRegistry: { required: false, shape: '{ registryId: string prefix RC6-M2-PROTOTYPE-DIRECT-ADAPTER, prototypeNames: unique canonical-sorted nonempty strings, prototypeRegistryHash: 8-hex fnv1a32 of canonical names JSON, sourceContractHash: 64-hex equal to governed adapterContract pin } read-only PDA registry attestation carrier; required whenever projectionFamilies present; values never enter features', closed: true },
        publicCost: { required: false, shape: [{ resource: 'enum 魂力|精神力|体力|生命', amount: 'number finite positive' }], closed: true, semantics: 'declared costs only; drives COST_AFFORDABILITY and the RESOURCE_INSUFFICIENT hard exclusion (strict cost > available on the same observer-visible units[actorId] axis; equality affordable; missing/non-finite facts never guess)' },
        publicProbability: { required: false, shape: '{ hitProbability: number finite, source?: string } or { resolved: false, unresolvedCondition?: string }', closed: true },
        publicDeclarations: { required: false, shape: { revealStrength: 'number finite', declaredOverkill: 'number finite' }, closed: true }
        ,
        actionOpportunity: { required: false, shape: '{ role: id, sourceActorId?: id, incomingAction: normalized plain object, actionContext?: { actionEvent: { actionId: id, eventId: id }, targetResolutionEvent?: { eventId: id } }, counterWindow?: boolean, reactionMechanics: closed candidate-level carrier; actionContext is provenance-only and never a feature/value input }', closed: true },
        creationProfile: { required: false, shape: '{ recipientId: nonempty id <=512 no C0/DEL, useEffects: rows closed {原型,目标,资源,数值} (原型/目标/数值 nonempty strings, 资源 single nonempty string or unique nonempty string array) }', closed: true, semantics: 'structured creation declaration carrier; drives PUBLIC_RECIPIENT_NEED_MATCH only (positive percent 资源变化 rows vs the same observer-visible recipient resource axes; per (recipientId, resource) duplicates max; arithmetic mean over actual recovery channels; no channel => KNOWN 0; recipient/axis/percent unit unprovable => UNKNOWN fail-closed; drains/zero rows never count)' }
      },
      forbiddenKeys: ['forbiddenFacts', 'branchCombination', 'preMultiplied', 'route', 'worldClone', 'resultWorld', 'hidden', 'wallClock', 'skillRoleName', 'teacher', 'kernelRouteValue', 'prototypeNameWeighting'],
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
      atomicFacts: [{ eventId: 'evt:sc:0', sourceActionId: 'action:sc', outcomeKind: 'HP_DELTA', effectInstanceId: 'action:sc:effect:0', targetId: 'enemy-1', expectedDelta: -60, hitCheckApplicability: 'APPLICABLE', evidence: { hitProbability: 0.8, damageBasis: { basisView: 'DECISION_VISIBLE' } } }],
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

  function runSelfCheck(sourceText, loadedHashes) {
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
    add('featureCatalogClosed', FEATURE_CODES.length === 35 && CANDIDATE_CODES.length === 17 && ROW_CODES.length === 18, { total: FEATURE_CODES.length, candidate: CANDIDATE_CODES.length, row: ROW_CODES.length });
    var fixedOk = FEATURE_CODES.indexOf('STATE_DELTA_PERCENT') === 23 && FEATURE_CODES.indexOf('SETTLEMENT_MODIFIER_PERCENT') === 24 && FEATURE_CODES.indexOf('SUMMON_COUNT') === 25 && FEATURE_CODES.indexOf('SUMMON_STRENGTH') === 26 && FEATURE_CODES.indexOf('SUMMON_DURATION') === 27 && FEATURE_CODES.indexOf('RESOURCE_DELTA_PERCENT') === 28 && FEATURE_CODES.indexOf('PUBLIC_RECIPIENT_NEED_MATCH') === 29 && FEATURE_CODES.indexOf('TARGET_CHARGE_ACTIVE') === 30 && FEATURE_CODES.indexOf('TARGET_CHARGE_CAST_TIME') === 31 && FEATURE_CODES.indexOf('REACTION_DAMAGE_MULTIPLIER') === 32 && FEATURE_CODES.indexOf('REACTION_DODGE_PROBABILITY') === 33 && FEATURE_CODES.indexOf('REACTION_COUNTER_WINDOW_OPEN') === 34;
    add('fixedCatalogPositions23to34', fixedOk, { positions: FEATURE_CODES.slice(23) });
    var familyOk = true;
    for (var fc = 0; fc < FEATURE_CODES.length; fc += 1) if (UNIT_FAMILIES.indexOf(UNIT_FAMILY[FEATURE_CODES[fc]]) < 0) familyOk = false;
    add('unitFamilyClosed', familyOk && UNIT_FAMILY['SUMMON_STRENGTH'] === 'RATIO' && UNIT_FAMILIES.indexOf('RATIO') >= 0, { families: UNIT_FAMILIES.slice() });
    add('rejectionMappingComplete', Object.keys(FORBIDDEN_SOURCE_CODE).length === 8 && HARD_EXCLUSION_CODES.length === 10 && FORBIDDEN_SOURCE_CODE['PROTOTYPE_NAME_WEIGHTING'] === 'PROTOTYPE_NAME_WEIGHTING_REJECTED', { sources: Object.keys(FORBIDDEN_SOURCE_CODE).slice() });
    add('batchFamilyMapping', Object.keys(BATCH1_FAMILY).length === 6 && BATCH1_FAMILY['状态施加/状态移除'].length === 2 && Object.keys(BATCH2_FAMILY).length === 3 && BATCH2_FAMILY['状态施加'].length === 3 && BATCH2_FAMILY['召唤生成'].length === 3 && BATCH2_FAMILY['结算修正'].length === 1, { families: Object.keys(BATCH1_FAMILY).length, batch2: Object.keys(BATCH2_FAMILY).length });
    add('capsFixed', CAPS.MAX_FEATURES_PER_CANDIDATE === 256 && CAPS.MAX_FACT_ROWS_PER_CANDIDATE === 128 && CAPS.MAX_MODIFIER_ENTRIES_PER_CANDIDATE === 64 && CAPS.MAX_WORK_UNITS_PER_CALL === 200000 && F0 === 14, { caps: CAPS });
    var policyPins = { id: 'policyPinsLoaded', counted: false, passed: false, detail: { pins: Object.keys(CONTRACT_HASHES).length, loadedProvided: false } };
    if (loadedHashes && typeof loadedHashes === 'object') {
      var pc = loadedHashes.policyContract;
      var ps = loadedHashes.policySchema;
      policyPins.counted = typeof pc === 'string' && pc.length === 64 && typeof ps === 'string' && ps.length === 64;
      policyPins.passed = policyPins.counted && pc === CONTRACT_HASHES.policyContract && ps === CONTRACT_HASHES.policySchema;
      policyPins.detail = { pins: Object.keys(CONTRACT_HASHES).length, loadedProvided: true, match: policyPins.passed };
    }
    checks.push(policyPins);
    add('contractRevisionClosed', REVISION === 17, { revision: REVISION });
    var contextProbe = baseInput();
    var contextRefsProbe = ['ctx-event', 'ctx-target'];
    contextProbe.candidate = scCandidate('cand-ctx', 'actor-1', 'side-blue', ['actor-1'], 'PASS_OPPORTUNITY');
    contextProbe.actionOpportunity = {
      role: 'REACTION', sourceActorId: 'enemy-1',
      actionContext: { actionEvent: { actionId: 'ctx-action', eventId: 'ctx-event' }, targetResolutionEvent: { eventId: 'ctx-target' } },
      incomingAction: { sourceActionId: 'ctx-action', sourceFactIds: contextRefsProbe.slice(), sourceEventIds: contextRefsProbe.slice() },
      reactionMechanics: {
        candidateId: 'cand-ctx', responseKind: 'PASS_OPPORTUNITY', status: 'KNOWN', reason: 'OK',
        sourceActionId: 'ctx-action', sourceActorId: 'enemy-1', targetId: 'actor-1', prepared: true,
        visibleWorldRevision: 'ctx-world', requestHash: 'ctx-request', damageMultiplier: 1, dodgeProbability: 0,
        sourceFactIds: contextRefsProbe.slice(), sourceEventIds: contextRefsProbe.slice()
      }
    };
    var contextDoc = compileCore(contextProbe, freshMetrics());
    var contextRows = contextDoc.features.filter(function (row) { return row.featureCode === 'REACTION_DAMAGE_MULTIPLIER' || row.featureCode === 'REACTION_DODGE_PROBABILITY'; });
    var contextConflict = false;
    try {
      var badContext = JSON.parse(JSON.stringify(contextProbe));
      badContext.actionOpportunity.actionContext.actionEvent.actionId = 'ctx-other';
      compileCore(badContext, freshMetrics());
    } catch (e) { contextConflict = (e && (e.code || e.reasonCode)) === 'INVALID_OPTION_VALUE'; }
    add('actionContextClosedProvenanceOnly', contextRows.length === 2 && contextRows.every(function (row) {
      return row.status === 'KNOWN' && JSON.stringify(row.sourceFactIds) === JSON.stringify(contextRefsProbe) && JSON.stringify(row.sourceEventIds) === JSON.stringify(contextRefsProbe);
    }) && JSON.stringify(contextDoc.features).indexOf('actionContext') < 0 && contextConflict, {});

    var base = compileCore(baseInput(), freshMetrics());
    var probe = {};
    probe.featureCount23 = base.featureCount === 23;
    probe.always17Candidate = base.features.filter(function (f) { return CANDIDATE_CODES.indexOf(f.featureCode) >= 0; }).length === 17;
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
      'PUBLIC_RECIPIENT_NEED_MATCH',
      'PUBLIC_RESOURCE_RATIO', 'REACTION_COUNTER_WINDOW_OPEN', 'REACTION_DAMAGE_MULTIPLIER',
      'REACTION_DODGE_PROBABILITY', 'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE',
      'REVEAL_STRENGTH', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE', 'SUCCESS_PROBABILITY',
      'TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME',
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
    var hCostBit = findFeature(costDoc, 'HARD_EXCLUSION');
    var hCostReason = findFeature(costDoc, 'HARD_EXCLUSION_REASON');
    probe.resourceInsufficientDerivation = hCostBit !== null && hCostBit.value === 1 && hCostReason !== null && hCostReason.status === 'KNOWN' && hCostReason.value === 'RESOURCE_INSUFFICIENT';
    function hardProbe(actorSp, costAmount, withCost, hiddenAxis) {
      var inp = {
        candidate: scCandidate('cand-ri', 'actor-1', 'side-blue', ['enemy-1']),
        publicSnapshot: scSnapshot({ 'enemy-1': scUnit(100, 200), 'actor-1': scUnit(100, actorSp) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' })
      };
      if (withCost) inp.publicCost = [{ resource: '魂力', amount: costAmount }];
      if (hiddenAxis) delete inp.publicSnapshot.units['actor-1'].sp;
      var doc = compileCore(inp, freshMetrics());
      var bit = findFeature(doc, 'HARD_EXCLUSION');
      return bit !== null && bit.value === 0;
    }
    probe.resourceInsufficientEquality = hardProbe(20, 20, true, false);
    probe.resourceInsufficientAffordable = hardProbe(30, 20, true, false);
    probe.resourceInsufficientNoCost = hardProbe(10, 20, false, false);
    probe.resourceInsufficientHiddenAxis = hardProbe(10, 20, true, true);
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
      scheduledFacts: [{ entryId: 'sf:x', operation: 'WINDOW_ADJUST', 调整字段: '持续回合', 调整方式: '延长' }]
    };
    var schDoc = compileCore(schIn, freshMetrics());
    var schFeat = findFeature(schDoc, 'OUTSIDE_BATCH1_ROW_COUNT');
    probe.scheduledCounted = schFeat !== null && schFeat.status === 'KNOWN' && schFeat.value === 1 && schFeat.sourceEventIds.length === 1 && schFeat.sourceEventIds[0] === 'sf:x';
    probe.atomicProbes = {};
    var dmgFact = function (eventId, eff, tgt, p) {
      return { eventId: eventId, outcomeKind: 'HP_DELTA', effectInstanceId: eff, targetId: tgt, hitCheckApplicability: 'APPLICABLE', evidence: { hitProbability: p, damageBasis: { basisView: 'DECISION_VISIBLE' } } };
    };
    var at1 = compileCore({ candidate: scCandidate('cand-at1', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [dmgFact('evt:a', 'fx:a', 'enemy-1', 0.8), dmgFact('evt:b', 'fx:b', 'enemy-1', 0.8)] }, freshMetrics());
    var sp1 = findFeature(at1, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.equalApplicableKnown = sp1 !== null && sp1.status === 'KNOWN' && sp1.value === 0.8 && sp1.sourceEventIds.length === 2 && sp1.sourceEventIds[0] === 'evt:a' && sp1.sourceEventIds[1] === 'evt:b';
    var at2 = compileCore({ candidate: scCandidate('cand-at2', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:c', hitCheckApplicability: 'NOT_APPLICABLE' }] }, freshMetrics());
    var sp2 = findFeature(at2, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.allNotApplicableNa = sp2 !== null && sp2.status === 'NOT_APPLICABLE' && sp2.reasonCode === 'NO_HIT_AXIS';
    var at3 = compileCore({ candidate: scCandidate('cand-at3', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:d', outcomeKind: 'HP_DELTA', hitCheckApplicability: 'UNKNOWN' }] }, freshMetrics());
    var sp3b = findFeature(at3, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.unknownApplicabilityUnknown = sp3b !== null && sp3b.status === 'UNKNOWN' && sp3b.reasonCode === 'CONDITIONAL_PROBABILITY_UNRESOLVED';
    var at4 = compileCore({ candidate: scCandidate('cand-at4', 'actor-1', 'side-blue', ['actor-1'], 'DEFEND'), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100) }, { 'actor-1': 'side-blue' }) }, freshMetrics());
    var sp4 = findFeature(at4, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.noActionKindSpecialCase = sp4 !== null && sp4.status === 'NOT_APPLICABLE' && sp4.reasonCode === 'NO_HIT_AXIS';
    var at5 = compileCore({ candidate: scCandidate('cand-at5', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [dmgFact('evt:e', 'fx:a', 'enemy-1', 0.8), dmgFact('evt:f', 'fx:b', 'enemy-1', 0.9)] }, freshMetrics());
    var sp5 = findFeature(at5, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.sameTargetMean = sp5 !== null && sp5.status === 'KNOWN' && Math.abs(sp5.value - 0.85) <= 1e-9;
    var at6 = compileCore({ candidate: scCandidate('cand-at6', 'actor-1', 'side-blue', ['enemy-1', 'enemy-2']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100), 'enemy-2': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red', 'enemy-2': 'side-red' }), atomicFacts: [dmgFact('evt:g', 'fx:a', 'enemy-1', 0.6), dmgFact('evt:h', 'fx:b', 'enemy-2', 0.9)] }, freshMetrics());
    var sp6 = findFeature(at6, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.multiTargetMean = sp6 !== null && sp6.status === 'KNOWN' && sp6.value === 0.75;
    var at7 = compileCore({ candidate: scCandidate('cand-at7', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [dmgFact('evt:i', 'fx:a', 'enemy-1', 0.8), dmgFact('evt:j', 'fx:a', 'enemy-1', 0.9)] }, freshMetrics());
    var sp7 = findFeature(at7, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.conflictingDeliveries = sp7 !== null && sp7.status === 'UNKNOWN' && sp7.reasonCode === 'CONFLICTING_DELIVERIES';
    var at8 = compileCore({ candidate: scCandidate('cand-at8', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:k', outcomeKind: 'HP_DELTA', effectInstanceId: 'fx:a', targetId: 'enemy-1', hitCheckApplicability: 'APPLICABLE', evidence: { deliveryStatus: 'MISSING' } }] }, freshMetrics());
    var sp8 = findFeature(at8, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.deliveryMissingFailClosed = sp8 !== null && sp8.status === 'UNKNOWN' && sp8.reasonCode === 'MISSING_SOURCE_FACT';
    var at9 = compileCore({ candidate: scCandidate('cand-at9', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [{ eventId: 'evt:l', outcomeKind: 'HP_DELTA', effectInstanceId: 'fx:a', targetId: 'enemy-1', hitCheckApplicability: 'APPLICABLE', evidence: { deliveryStatus: 'NON_FINITE' } }] }, freshMetrics());
    var sp9 = findFeature(at9, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.deliveryNonFiniteFailClosed = sp9 !== null && sp9.status === 'UNKNOWN' && sp9.reasonCode === 'NON_FINITE_DELIVERY';
    var at10 = compileCore({ candidate: scCandidate('cand-at10', 'actor-1', 'side-blue', ['enemy-1']), publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }), atomicFacts: [dmgFact('evt:m', 'fx:a', 'enemy-1', 0.8), dmgFact('evt:n', 'fx:a', 'enemy-1', 0.8)] }, freshMetrics());
    var sp10 = findFeature(at10, 'SUCCESS_PROBABILITY');
    probe.atomicProbes.dedupeSameIdentitySameProbability = sp10 !== null && sp10.status === 'KNOWN' && sp10.value === 0.8 && sp10.sourceEventIds.length === 2;
    add('behaviorProbes', probe.featureCount23 && probe.always17Candidate && probe.settlementAlwaysUnknown && probe.rollAlwaysUnknown && probe.noUnknownValue && probe.zeroNormalized && probe.deterministic && probe.deepFrozen && probe.frozenArraysRejectMutation && probe.stableOrder && probe.costActorOnly && probe.resourceInsufficientDerivation && probe.resourceInsufficientEquality && probe.resourceInsufficientAffordable && probe.resourceInsufficientNoCost && probe.resourceInsufficientHiddenAxis && probe.sideRules.self && probe.sideRules.ally && probe.sideRules.enemy && probe.sideRules.mixed && probe.sideRules.unobserved && probe.statePresence.positiveOverflowClampedTo1 && probe.statePresence.negativeRemovalTo0 && probe.statePresence.zeroDurationNa && probe.statePresence.countUnmapped && probe.statePresence.countDurationKept && probe.scheduledCounted && probe.atomicProbes.equalApplicableKnown && probe.atomicProbes.allNotApplicableNa && probe.atomicProbes.unknownApplicabilityUnknown && probe.atomicProbes.noActionKindSpecialCase && probe.atomicProbes.sameTargetMean && probe.atomicProbes.multiTargetMean && probe.atomicProbes.conflictingDeliveries && probe.atomicProbes.deliveryMissingFailClosed && probe.atomicProbes.deliveryNonFiniteFailClosed && probe.atomicProbes.dedupeSameIdentitySameProbability, probe);

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

    // ---- revision 3 batch-2 probes (raw codes 23-27, audit bridges, summon family) ----
    function scProtoReg() {
      var names = ['状态施加', '召唤生成', '结算修正', '未来原型A'].sort();
      return {
        registryId: 'RC6-M2-PROTOTYPE-DIRECT-ADAPTER-2026-08-14',
        prototypeNames: names,
        prototypeRegistryHash: fnv1a32Hex(names),
        sourceContractHash: CONTRACT_HASHES.governed.adapterContract
      };
    }
    function b2In(rows, extra) {
      var input = {
        candidate: scCandidate('cand-b2', 'actor-1', 'side-blue', ['actor-1']),
        publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100) }, { 'actor-1': 'side-blue' }),
        directFacts: rows || [],
        prototypeRegistry: scProtoReg()
      };
      if (extra) for (var k in extra) if (hasOwn(extra, k)) input[k] = extra[k];
      return input;
    }
    var b2 = {};
    var f1 = compileCore(b2In([scRow('STATE_DELTA', 'state.primary', -5, 'PERCENT', 2, 'effect:b2s:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2s:0', prototype: '状态施加' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:b2s:0', 生效方式: '独立生效' }] }), freshMetrics());
    var f1d = findFeature(f1, 'STATE_DELTA_PERCENT');
    var f1dur = findFeature(f1, 'STATE_DURATION');
    var f1o = findFeature(f1, 'OUTSIDE_BATCH1_ROW_COUNT');
    b2.statePrimary = f1d !== null && f1d.status === 'KNOWN' && f1d.value === -5 && f1d.sourceFactIds.length === 1 && f1dur !== null && f1dur.status === 'KNOWN' && f1dur.value === 2 && f1o !== null && f1o.value === 0;
    var f2 = compileCore(b2In([scRow('STATE_DELTA', 'state.secondary', 10, 'PERCENT', 1, 'effect:b2s:1')], { projectionFamilies: [{ sourceEffectId: 'effect:b2s:1', prototype: '状态施加' }] }), freshMetrics());
    var f2d = findFeature(f2, 'STATE_DELTA_PERCENT');
    b2.stateSecondary = f2d !== null && f2d.status === 'KNOWN' && f2d.value === 10;
    var f3 = compileCore(b2In([scRow('STATE_DELTA', 'settlement.primary', 10, 'PERCENT', 1, 'effect:b2m:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2m:0', prototype: '结算修正' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:b2m:0', 结算: '造成伤害' }] }), freshMetrics());
    var f3s = findFeature(f3, 'SETTLEMENT_MODIFIER_PERCENT');
    var f3dur = findFeature(f3, 'STATE_DURATION');
    b2.settlement = f3s !== null && f3s.status === 'KNOWN' && f3s.value === 10 && f3dur === null && findFeature(f3, 'OUTSIDE_BATCH1_ROW_COUNT').value === 0;
    var f4 = compileCore(b2In([scRow('SUMMON_WINDOW', 'summon.count', 2, 'COUNT', 0, 'effect:b2f:0'), scRow('SUMMON_WINDOW', 'summon.strength', 0.8, 'RATIO', 0, 'effect:b2f:0'), scRow('SUMMON_WINDOW', 'summon.duration', 3, 'TURNS', 0, 'effect:b2f:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2f:0', prototype: '召唤生成' }], scheduledFacts: [{ entryId: 'sf:1', grantType: 'SUMMON_WINDOW', 召唤单位类型: '魂兽', 召唤物名称: '审计召唤物', 行动模式: '协同攻击', durationTurns: 3 }] }), freshMetrics());
    var f4c = findFeature(f4, 'SUMMON_COUNT');
    var f4s = findFeature(f4, 'SUMMON_STRENGTH');
    var f4d = findFeature(f4, 'SUMMON_DURATION');
    var f4o = findFeature(f4, 'OUTSIDE_BATCH1_ROW_COUNT');
    b2.summonFull = f4c !== null && f4c.status === 'KNOWN' && f4c.value === 2 && f4s !== null && f4s.status === 'KNOWN' && f4s.value === 0.8 && f4d !== null && f4d.status === 'KNOWN' && f4d.value === 3 && f4o !== null && f4o.value === 1 && f4o.sourceEventIds.length === 1 && f4o.sourceEventIds[0] === 'sf:1';
    var f5 = compileCore(b2In([scRow('SUMMON_WINDOW', 'summon.count', 1, 'COUNT', 0, 'effect:b2m2:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2m2:0', prototype: '召唤生成' }] }), freshMetrics());
    var f5s = findFeature(f5, 'SUMMON_STRENGTH');
    var f5d = findFeature(f5, 'SUMMON_DURATION');
    b2.summonMissingRowsUnknown = f5s !== null && f5s.status === 'UNKNOWN' && f5s.reasonCode === 'MISSING_SOURCE_FACT' && f5s.sourceFactIds.length === 0 && !hasOwn(f5s, 'value') && f5d !== null && f5d.status === 'UNKNOWN' && f5d.reasonCode === 'MISSING_SOURCE_FACT';
    var f6 = compileCore(b2In([scRow('SUMMON_WINDOW', 'summon.count', 1, 'ABS', 0, 'effect:b2w:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2w:0', prototype: '召唤生成' }] }), freshMetrics());
    var f6c = findFeature(f6, 'SUMMON_COUNT');
    b2.summonWrongUnitUnknown = f6c !== null && f6c.status === 'UNKNOWN' && f6c.reasonCode === 'MISSING_SOURCE_FACT' && f6c.sourceFactIds.length === 1 && f6c.sourceFactIds[0] === 'effect:b2w:0::summon.count' && findFeature(f6, 'OUTSIDE_BATCH1_ROW_COUNT').value === 0;
    var f7 = compileCore(b2In([scRow('SUMMON_WINDOW', 'summon.inheritRatio', 0.15, 'RATIO', 0, 'effect:b2i:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2i:0', prototype: '召唤生成' }] }), freshMetrics());
    var f7o = findFeature(f7, 'OUTSIDE_BATCH1_ROW_COUNT');
    var f7s = findFeature(f7, 'SUMMON_STRENGTH');
    b2.inheritRatioOutside = f7s !== null && f7s.status === 'UNKNOWN' && f7s.reasonCode === 'MISSING_SOURCE_FACT' && f7s.sourceFactIds.length === 0 && f7o !== null && f7o.value === 1 && f7o.sourceFactIds.length === 1 && f7o.sourceFactIds[0] === 'effect:b2i:0::summon.inheritRatio';
    var f8 = compileCore(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:b2sf:0', prototype: '召唤生成' }], scheduledFacts: [{ entryId: 'sf:8', grantType: 'SUMMON_WINDOW', 召唤单位类型: '魂兽', 召唤物名称: '审计召唤物', 行动模式: '协同攻击', durationTurns: 3 }] }), freshMetrics());
    var f8c = findFeature(f8, 'SUMMON_COUNT');
    var f8d = findFeature(f8, 'SUMMON_DURATION');
    var f8o = findFeature(f8, 'OUTSIDE_BATCH1_ROW_COUNT');
    b2.scheduledWindowNeverKnownDuration = f8c !== null && f8c.status === 'UNKNOWN' && f8c.reasonCode === 'MISSING_SOURCE_FACT' && f8d !== null && f8d.status === 'UNKNOWN' && f8d.reasonCode === 'MISSING_SOURCE_FACT' && f8o !== null && f8o.value === 1 && f8o.sourceEventIds.length === 1 && f8o.sourceEventIds[0] === 'sf:8';
    var f9 = compileCore(b2In([scRow('STATE_DELTA', '中毒', -5, 'PERCENT', 1, 'effect:b2wk:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2wk:0', prototype: '状态施加' }] }), freshMetrics());
    var f9d = findFeature(f9, 'STATE_DELTA_PERCENT');
    var f9dur = findFeature(f9, 'STATE_DURATION');
    b2.stateWrongKeyPercentUnknown = f9d !== null && f9d.status === 'UNKNOWN' && f9d.reasonCode === 'MISSING_SOURCE_FACT' && f9d.sourceFactIds.length === 1 && f9dur !== null && f9dur.status === 'KNOWN' && f9dur.value === 1 && findFeature(f9, 'OUTSIDE_BATCH1_ROW_COUNT').value === 0;
    var metaBad = expectReject(b2In([], { mechanicMetadataEntries: [{ sourceEffectId: 'effect:x:0', 未知键: 1 }] }), 'INVALID_OPTION_VALUE');
    var metaBadPf = expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:x:0', prototype: '状态施加' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:x:0', 结算: '造成伤害' }] }), 'INVALID_OPTION_VALUE');
    var metaBadProto = expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:x:0', prototype: '不存在的原型' }] }), 'INVALID_OPTION_VALUE');
    b2.metadataStrictValidation = metaBad && metaBadPf && metaBadProto;
    var f10 = compileCore(b2In([scRow('STATE_DELTA', 'settlement.primary', 10, 'PERCENT', 1, 'effect:b2nv:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2nv:0', prototype: '结算修正' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:b2nv:0', 生效方式: '跟随主原型', 结算: '造成伤害' }] }), freshMetrics());
    var f10s = findFeature(f10, 'SETTLEMENT_MODIFIER_PERCENT');
    b2.metadataNeverValue = f10s !== null && f10s.status === 'KNOWN' && f10s.value === 10 && findFeature(f10, 'OUTSIDE_BATCH1_ROW_COUNT').value === 0;
    b2.prototypeNameWeightingRejected = expectReject(b2In([], { prototypeNameWeighting: { 状态施加: 2 } }), 'PROTOTYPE_NAME_WEIGHTING_REJECTED');
    var f11 = compileCore(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:b2tl:0', prototype: '召唤生成' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:b2tl:0', 生效方式: '独立生效', 触发限制: '仅触发一次' }] }), freshMetrics());
    var f11c = findFeature(f11, 'SUMMON_COUNT');
    b2.triggerLimitMetadataAccepted = f11c !== null && f11c.status === 'UNKNOWN' && f11c.reasonCode === 'MISSING_SOURCE_FACT' && findFeature(f11, 'OUTSIDE_BATCH1_ROW_COUNT').value === 0;
    var f12 = compileCore(b2In([scRow('STATE_DELTA', 'settlement.primary', 10, 'PERCENT', 1, 'effect:b2sc:0')], { projectionFamilies: [{ sourceEffectId: 'effect:b2sc:0', prototype: '结算修正' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:b2sc:0' }] }), freshMetrics());
    b2.settlementMetadataAbsent = findFeature(f12, 'SETTLEMENT_MODIFIER_PERCENT') !== null && findFeature(f12, 'SETTLEMENT_MODIFIER_PERCENT').status === 'KNOWN' && findFeature(f12, 'SETTLEMENT_MODIFIER_PERCENT').value === 10;
    // Revision 4: 触发限制 is closed as a non-empty string OR a closed object
    // {周期: string, 次数: integer >= 1}; unknown keys / zero count / missing 周期
    // are rejected; values stay audit-only (never enter feature values).
    var f13 = compileCore(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:b2tl2:0', prototype: '召唤生成' }], mechanicMetadataEntries: [{ sourceEffectId: 'effect:b2tl2:0', 触发限制: { 周期: '每战', 次数: 1 } }] }), freshMetrics());
    b2.triggerLimitObjectAccepted = findFeature(f13, 'SUMMON_COUNT') !== null && findFeature(f13, 'SUMMON_COUNT').status === 'UNKNOWN';
    b2.triggerLimitObjectUnknownKey = expectReject(b2In([], { mechanicMetadataEntries: [{ sourceEffectId: 'effect:x:0', 触发限制: { 周期: '每战', 次数: 1, 未知键: 1 } }] }), 'INVALID_OPTION_VALUE');
    b2.triggerLimitZeroCount = expectReject(b2In([], { mechanicMetadataEntries: [{ sourceEffectId: 'effect:x:0', 触发限制: { 周期: '每战', 次数: 0 } }] }), 'INVALID_OPTION_VALUE');
    b2.triggerLimitMissingPeriod = expectReject(b2In([], { mechanicMetadataEntries: [{ sourceEffectId: 'effect:x:0', 触发限制: { 次数: 1 } }] }), 'INVALID_OPTION_VALUE');
    var f14 = compileCore(b2In([scRow('RESOURCE_OPTION_CHANGED', '魂力', 25, 'PERCENT', 0, 'effect:b2r:0')]), freshMetrics());
    var f14p = findFeature(f14, 'RESOURCE_DELTA_PERCENT');
    b2.resourcePercentRecover = f14p !== null && f14p.status === 'KNOWN' && f14p.value === 25 && f14p.unitFamily === 'PERCENT' && findFeature(f14, 'RESOURCE_DELTA') === null;
    var f15 = compileCore(b2In([scRow('RESOURCE_OPTION_CHANGED', '体力', -10, 'PERCENT', 0, 'effect:b2r:1')]), freshMetrics());
    var f15p = findFeature(f15, 'RESOURCE_DELTA_PERCENT');
    b2.resourcePercentDrain = f15p !== null && f15p.status === 'KNOWN' && f15p.value === -10;
    var f16 = compileCore(b2In([scRow('RESOURCE_OPTION_CHANGED', '魂力', 10, 'ABS', 0, 'effect:b2r:2')]), freshMetrics());
    var f16d = findFeature(f16, 'RESOURCE_DELTA');
    b2.resourceAbsKeepsDelta = f16d !== null && f16d.status === 'KNOWN' && f16d.value === 10 && findFeature(f16, 'RESOURCE_DELTA_PERCENT') === null;
    var capIn = {
      candidate: scCandidate('cand-cap', 'actor-1', 'side-blue', ['enemy-1']),
      publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }),
      directFacts: [scRow('HP_DELTA', 'damage.power', 60, 'POWER', 0, 'effect:b2cap:0')],
      legalityModifiers: { hardExclusions: [] },
      atomicFacts: [{ eventId: 'evt:cap', hitCheckApplicability: 'APPLICABLE', evidence: { hitProbability: 0.8 } }],
      publicCost: [{ resource: '魂力', amount: 20 }],
      publicProbability: { hitProbability: 0.8 }
    };
    for (var ci = 0; ci < 64; ci += 1) capIn.legalityModifiers.hardExclusions.push('ACTOR_DISABLED');
    var capDoc = compileCore(capIn, freshMetrics());
    b2.capWithinBounds = capDoc.featureCount === 20;
    var capBad = {
      candidate: scCandidate('cand-capb', 'actor-1', 'side-blue', ['enemy-1']),
      publicSnapshot: scSnapshot({ 'actor-1': scUnit(100, 100), 'enemy-1': scUnit(100, 100) }, { 'actor-1': 'side-blue', 'enemy-1': 'side-red' }),
      legalityModifiers: { hardExclusions: [] }
    };
    for (var cj = 0; cj < 65; cj += 1) capBad.legalityModifiers.hardExclusions.push('ACTOR_DISABLED');
    b2.capModifiersExceeded = expectReject(capBad, 'CAP_EXCEEDED');
    add('batch2FeatureProbes', b2.statePrimary && b2.stateSecondary && b2.settlement && b2.summonFull && b2.summonMissingRowsUnknown && b2.summonWrongUnitUnknown && b2.inheritRatioOutside && b2.scheduledWindowNeverKnownDuration && b2.stateWrongKeyPercentUnknown && b2.metadataStrictValidation && b2.metadataNeverValue && b2.prototypeNameWeightingRejected && b2.triggerLimitMetadataAccepted && b2.settlementMetadataAbsent && b2.triggerLimitObjectAccepted && b2.triggerLimitObjectUnknownKey && b2.triggerLimitZeroCount && b2.triggerLimitMissingPeriod && b2.resourcePercentRecover && b2.resourcePercentDrain && b2.resourceAbsKeepsDelta && b2.capWithinBounds && b2.capModifiersExceeded, b2);

    var protoAtt = true;
    var prAuto = null;
    try {
      prAuto = compileCore(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:prauto:0', prototype: '未来原型A' }] }), freshMetrics());
    } catch (e) { prAuto = null; }
    protoAtt = protoAtt && prAuto !== null && prAuto.featureCount >= 13;
    protoAtt = protoAtt && expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:prx:0', prototype: '不存在的原型' }] }), 'INVALID_OPTION_VALUE');
    protoAtt = protoAtt && expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:prm:0', prototype: '状态施加' }], prototypeRegistry: undefined }), 'MISSING_SOURCE_REFERENCE');
    var prValid = scProtoReg();
    var prHashBad = { registryId: prValid.registryId, prototypeNames: prValid.prototypeNames.slice(), prototypeRegistryHash: '00000000', sourceContractHash: prValid.sourceContractHash };
    protoAtt = protoAtt && expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:prh:0', prototype: '状态施加' }], prototypeRegistry: prHashBad }), 'INVALID_OPTION_VALUE');
    var prSourceBad = { registryId: prValid.registryId, prototypeNames: prValid.prototypeNames.slice(), prototypeRegistryHash: prValid.prototypeRegistryHash, sourceContractHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' };
    protoAtt = protoAtt && expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:prs:0', prototype: '状态施加' }], prototypeRegistry: prSourceBad }), 'INVALID_OPTION_VALUE');
    var prUnsort = { registryId: prValid.registryId, prototypeNames: ['状态施加', '召唤生成'], prototypeRegistryHash: '00000000', sourceContractHash: prValid.sourceContractHash };
    protoAtt = protoAtt && expectReject(b2In([], { projectionFamilies: [{ sourceEffectId: 'effect:pru:0', prototype: '状态施加' }], prototypeRegistry: prUnsort }), 'INVALID_OPTION_VALUE');
    add('prototypeRegistryAttestation', protoAtt, { autoAdoptFeatureCount: prAuto !== null ? prAuto.featureCount : -1 });

    var passed = true;
    for (var c = 0; c < checks.length; c += 1) if (checks[c].counted && !checks[c].passed) passed = false;
    return { schemaVersion: SCHEMA_VERSION, role: ROLE, revision: REVISION, passed: passed, sourceSelfCheckable: sourceSelfCheckable, checks: checks };
  }

  var api = {
    compileCandidate: compileCandidate,
    inputSchema: function () { return freezeDeep(buildInputSchema()); },
    registry: function () { return freezeDeep(buildRegistry()); },
    readMetrics: readMetrics,
    selfCheck: function (sourceText, loadedHashes) { return runSelfCheck(sourceText, loadedHashes); }
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

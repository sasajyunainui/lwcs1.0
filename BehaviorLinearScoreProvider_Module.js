/* BehaviorLinearScoreProvider_Module.js
 * Task 6 core batch A: online lightweight LINEAR_SCORE_V1 provider (r9v2).
 * Pure candidate-only selection: frozen candidates -> public immediate features
 * -> frozen 31-code scalarization + embedded two-code reaction head ->
 * total linear score -> hard-exclusion removal ->
 * deterministic ordering (score desc, exact-tie candidateId UTF-16 asc) ->
 * structural alternative -> same-source structured reason factors.
 * The sealed model whitelist constants are embedded (never read from
 * gitignored artifacts at runtime): normalization, linear, featureAggregation,
 * modelHash, weightsHash, featureSchemaHash. Old Kernel/direct/future-route/S4
 * traversal has zero calls and zero fallback here.
 */
(function (root) {
  'use strict';

  const PROVIDER_ID = 'r9v2';
  const ENGINE = 'R9V2_LINEAR';
  const SCHEMA_VERSION = 'BehaviorLinearScoreProviderV1';
  const MOUNT_NAME = '__LWCS_BEHAVIOR_LINEAR_PROVIDER__';

  // Sealed model whitelist (artifacts/rc6/distilled-linear-score-v1.json raw
  // 432b82e0...; sealed binding m2-linear-score-v1-rev9-binding.json).
  const MODEL_HASH = '5308f3bcbb60413e6161089397d59224ec3a7d92c60c58062067df19f9024ced';
  const WEIGHTS_HASH = '2daa34c9aa8e340efa83d6caee433d19dc204ac9b52e0ea48d55591192a67550';
  const FEATURE_SCHEMA_HASH = '9d083542dff4609b7ca7d55fdf3b204bc62fc2f40e350298f46db00d2ab5a121';
  const DBP_REVISION = 15;
  const DBP_CONTRACT_HASH = '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8';
  const DBP_SCHEMA_HASH = '3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e';
  const BIF_CONTRACT_HASH = '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76';
  const BIF_SCHEMA_HASH = 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49';
  const BASE_SECTION_HASH = '1a6ba7bbf8543221f9620b29a6884d723a35b1eedc64ac9b508418e242f3fa0d';
  const REACTION_HEAD_HASH = 'b08565ade014bed633f5917aaa3891ba2730a18f8c9885c1c9c983db5c8f4a62';
  const MODEL_COMPOSITE_HASH = '1571f142a29ad9e6faef6644533a632942dbd57867a5aa00c2ca76b685a2dd8c';
  const REACTION_ALGORITHM_HASH = '5ddd1dff3f07d3aa7c1b48f627cd5a3c64de9025941fab25923b52851b8a1852';
  const OP_DAMAGE_POWER = 'NEUMAIER\u005fSUM';
  const OP_DAMAGE_SEGMENTS = 'INTEGER\u005fSUM';

  // 35-code catalog: 31 scoreable + 2 exclusion-only + 2 catalog-only.
  const SCOREABLE_CODES = Object.freeze([
    'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE', 'SUCCESS_PROBABILITY',
    'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY',
    'REVEAL_STRENGTH', 'OVERKILL_AVAILABILITY', 'OUTSIDE_BATCH1_ROW_COUNT',
    'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE',
    'RESOURCE_DELTA', 'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA',
    'STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT',
    'SETTLEMENT_MODIFIER_PERCENT', 'SUMMON_COUNT', 'SUMMON_STRENGTH',
    'SUMMON_DURATION', 'RESOURCE_DELTA_PERCENT',
    'TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO',
    'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE',
    'PUBLIC_RECIPIENT_NEED_MATCH',
  ]);
  const RELATIONAL_CODES = Object.freeze([
    'TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO',
    'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE',
  ]);
  const EXCLUSION_ONLY = Object.freeze(['HARD_EXCLUSION', 'HARD_EXCLUSION_REASON']);
  const CATALOG_ONLY = Object.freeze(['SETTLEMENT_DAMAGE', 'ROLL_REALIZATION']);
  const ENUM_CODES = new Set(['RELATION_TARGET_SIDE']);
  const HARD_EXCLUSION_CODES = Object.freeze([
    'ACTOR_DISABLED', 'ACTOR_TERMINAL', 'TARGET_EMPTY', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_STATE', 'UNKNOWN_RULE',
    'AMBIGUOUS_TAUNT_TARGET', 'ILLEGAL_TARGET', 'RESOURCE_INSUFFICIENT',
  ]);

  // DistilledBehaviorPolicyV1 rev15 missingPolicyV1 (scoreable codes only).
  const MISSING_POLICY = deepFreeze({
    RELATION_TARGET_COUNT: { unknown: 'REQUIRE_KNOWN', na: 'REQUIRE_KNOWN' },
    RELATION_TARGET_SIDE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUCCESS_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'UNKNOWN_TO_TRAIN_MEAN' },
    PUBLIC_HP_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    PUBLIC_RESOURCE_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    COST_AFFORDABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'UNKNOWN_TO_TRAIN_MEAN' },
    REVEAL_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    OVERKILL_AVAILABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    OUTSIDE_BATCH1_ROW_COUNT: { unknown: 'REQUIRE_KNOWN', na: 'REQUIRE_KNOWN' },
    DAMAGE_POWER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    DAMAGE_SEGMENTS: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    DAMAGE_PENETRATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    DAMAGE_TYPE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SHIELD_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    ATTRIBUTE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    JUDGMENT_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    STATE_PRESENCE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    STATE_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_DURATION'] },
    STATE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SETTLEMENT_MODIFIER_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUMMON_COUNT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUMMON_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUMMON_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    TEAM_EFFECT_MARGINAL_GAIN: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    TEAM_EFFECT_REDUNDANCY_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    RESOURCE_DEFICIT_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_RESOURCE_DEFICIT', 'NO_RESOURCE_SUPPLY'] },
    RESOURCE_CONSUMER_FIT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_RESOURCE_CONSUMER'] },
    TEAM_FOLLOWUP_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_FOLLOW_UP_GRANT'] },
    PUBLIC_RECIPIENT_NEED_MATCH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
  });

  // Per-code duplicate-row aggregation, exactly the frozen DBP rev14 table.
  const AGGREGATION = Object.freeze({
    JUDGMENT_DELTA: 'SUM',
    STATE_DURATION: 'MAX',
    STATE_DELTA_PERCENT: 'SUM',
    SETTLEMENT_MODIFIER_PERCENT: 'SUM',
    RESOURCE_DELTA_PERCENT: 'MAX',
    DAMAGE_POWER: OP_DAMAGE_POWER,
    DAMAGE_SEGMENTS: OP_DAMAGE_SEGMENTS,
    DAMAGE_TYPE: 'MAX',
  });

  // Multi-row closure inventory (AGGREGATION_CLOSURE_V2): the 31 scoreable
  // codes are partitioned into contract-adjudicated multi-row codes with a
  // frozen operator (multiRowCodes, 8), fail-closed multi-row-capable codes
  // (7), and single-row codes (16).
  // (singleRowCodes, 16: candidate-scope BIF codes + five relational codes +
  // ATTRIBUTE_DELTA, which is collapsed inside BIF). Codes outside
  // multiRowCodes keep the fatal as a source-drift safety net.
  const AGGREGATION_CLOSURE = Object.freeze({
    version: 'AGGREGATION_CLOSURE_V2',
    multiRowCodes: Object.freeze([
      'JUDGMENT_DELTA', 'STATE_DURATION', 'STATE_DELTA_PERCENT',
      'SETTLEMENT_MODIFIER_PERCENT', 'RESOURCE_DELTA_PERCENT',
      'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_TYPE',
    ]),
    failClosedMultiRowCodes: Object.freeze([
      'DAMAGE_PENETRATION',
      'RESOURCE_DELTA', 'SHIELD_DELTA', 'STATE_PRESENCE', 'SUMMON_COUNT',
      'SUMMON_STRENGTH', 'SUMMON_DURATION',
    ]),
    singleRowCodes: Object.freeze([
      'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE', 'SUCCESS_PROBABILITY',
      'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY',
      'REVEAL_STRENGTH', 'OVERKILL_AVAILABILITY', 'OUTSIDE_BATCH1_ROW_COUNT',
      'PUBLIC_RECIPIENT_NEED_MATCH',
      'TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO',
      'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT',
      'TEAM_FOLLOWUP_COVERAGE',
      'ATTRIBUTE_DELTA',
    ]),
    collapsedInBif: Object.freeze(['ATTRIBUTE_DELTA']),
  });

  // Sealed normalization (training KNOWN rows only; scales = std + 1e-6).
  const NORMALIZATION = Object.freeze({
    means: Object.freeze({
      ATTRIBUTE_DELTA: 14.5, COST_AFFORDABILITY: 1, DAMAGE_PENETRATION: 14.225806451612904,
      DAMAGE_POWER: 23.38761904761905, DAMAGE_SEGMENTS: 2.142857142857143, DAMAGE_TYPE: 1,
      JUDGMENT_DELTA: -2.609375, OUTSIDE_BATCH1_ROW_COUNT: 0.10471204188481675,
      OVERKILL_AVAILABILITY: 0, PUBLIC_HP_RATIO: 0.9090386642361269,
      PUBLIC_RECIPIENT_NEED_MATCH: 0.0002879581151832461, PUBLIC_RESOURCE_RATIO: 0.6952879581151833,
      RELATION_TARGET_COUNT: 1.1151832460732984, RELATION_TARGET_SIDE: 0,
      RESOURCE_CONSUMER_FIT: 0, RESOURCE_DEFICIT_COVERAGE: 0, RESOURCE_DELTA: 0,
      RESOURCE_DELTA_PERCENT: 15.344, REVEAL_STRENGTH: 0, SETTLEMENT_MODIFIER_PERCENT: 4,
      SHIELD_DELTA: 0, STATE_DELTA_PERCENT: -11.5, STATE_DURATION: 1.0441176470588236,
      STATE_PRESENCE: 1, SUCCESS_PROBABILITY: 0.6946307757209801, SUMMON_COUNT: 1,
      SUMMON_DURATION: 1, SUMMON_STRENGTH: 0.11, TEAM_EFFECT_MARGINAL_GAIN: 1,
      TEAM_EFFECT_REDUNDANCY_RATIO: 0, TEAM_FOLLOWUP_COVERAGE: 0,
    }),
    scales: Object.freeze({
      ATTRIBUTE_DELTA: 1, COST_AFFORDABILITY: 1, DAMAGE_PENETRATION: 8.43842952446704,
      DAMAGE_POWER: 27.46451106988264, DAMAGE_SEGMENTS: 2.5501777312373113, DAMAGE_TYPE: 1,
      JUDGMENT_DELTA: 5.167106051126307, OUTSIDE_BATCH1_ROW_COUNT: 0.42132873903100887,
      OVERKILL_AVAILABILITY: 1, PUBLIC_HP_RATIO: 0.22487126666354648,
      PUBLIC_RECIPIENT_NEED_MATCH: 0.003970228698245883, PUBLIC_RESOURCE_RATIO: 0.24281348191416682,
      RELATION_TARGET_COUNT: 0.4659401719641251, RELATION_TARGET_SIDE: 1,
      RESOURCE_CONSUMER_FIT: 1, RESOURCE_DEFICIT_COVERAGE: 1, RESOURCE_DELTA: 1,
      RESOURCE_DELTA_PERCENT: 4.10187179269935, REVEAL_STRENGTH: 1,
      SETTLEMENT_MODIFIER_PERCENT: 3.714836124201342, SHIELD_DELTA: 1,
      STATE_DELTA_PERCENT: 5.286365740907786, STATE_DURATION: 0.20535747123189627,
      STATE_PRESENCE: 1, SUCCESS_PROBABILITY: 0.09415521560514117, SUMMON_COUNT: 1,
      SUMMON_DURATION: 1, SUMMON_STRENGTH: 1, TEAM_EFFECT_MARGINAL_GAIN: 1,
      TEAM_EFFECT_REDUNDANCY_RATIO: 1, TEAM_FOLLOWUP_COVERAGE: 1,
    }),
    missingMask: Object.freeze(['HARD_EXCLUSION', 'HARD_EXCLUSION_REASON']),
  });

  const LINEAR = Object.freeze({
    intercept: 0,
    coefficients: Object.freeze({
      ATTRIBUTE_DELTA: 0, COST_AFFORDABILITY: 0, DAMAGE_PENETRATION: 0.27101009737338333,
      DAMAGE_POWER: 0.9005159950810252, DAMAGE_SEGMENTS: -0.10897479287395434, DAMAGE_TYPE: 0,
      JUDGMENT_DELTA: -0.1589984264724439, OUTSIDE_BATCH1_ROW_COUNT: -1.1292992745534087,
      OVERKILL_AVAILABILITY: 0, PUBLIC_HP_RATIO: -0.19953006499152975,
      PUBLIC_RECIPIENT_NEED_MATCH: 0.45252268447270233, PUBLIC_RESOURCE_RATIO: -1.2035997079030496,
      RELATION_TARGET_COUNT: 0.799682677937762, RELATION_TARGET_SIDE: 0,
      RESOURCE_CONSUMER_FIT: 0, RESOURCE_DEFICIT_COVERAGE: 0, RESOURCE_DELTA: 0,
      RESOURCE_DELTA_PERCENT: -0.3984230873845778, REVEAL_STRENGTH: 0,
      SETTLEMENT_MODIFIER_PERCENT: -0.029061184033559898, SHIELD_DELTA: 0,
      STATE_DELTA_PERCENT: 0.18441615865944933, STATE_DURATION: 0.0019588051160184944,
      STATE_PRESENCE: 0, SUCCESS_PROBABILITY: 0.8567163732632611, SUMMON_COUNT: 0,
      SUMMON_DURATION: 0, SUMMON_STRENGTH: 0, TEAM_EFFECT_MARGINAL_GAIN: 0,
      TEAM_EFFECT_REDUNDANCY_RATIO: 0, TEAM_FOLLOWUP_COVERAGE: 0,
    }),
  });

  // R4B1 constrained head. These constants are embedded for runtime binding;
  // the Provider never reads the offline artifact.
  const REACTION_CODES = Object.freeze([
    'REACTION_DAMAGE_MULTIPLIER', 'REACTION_DODGE_PROBABILITY',
  ]);
  const SCOREABLE_INVENTORY = Object.freeze(SCOREABLE_CODES.concat(REACTION_CODES));
  const REACTION_NORMALIZATION = Object.freeze({
    means: Object.freeze({
      REACTION_DAMAGE_MULTIPLIER: 0.820427777816285,
      REACTION_DODGE_PROBABILITY: 0.1576148028913787,
    }),
    scales: Object.freeze({
      REACTION_DAMAGE_MULTIPLIER: 0.2541751975645827,
      REACTION_DODGE_PROBABILITY: 0.2268679023040783,
    }),
  });
  const REACTION_LINEAR = Object.freeze({
    k: 2.4687377286545256,
    intercept: 0,
    coefficients: Object.freeze({
      REACTION_DAMAGE_MULTIPLIER: -0.6274918999159032,
      REACTION_DODGE_PROBABILITY: 0.5600773498387871,
    }),
  });
  const REACTION_MISSING_POLICY = deepFreeze({
    REACTION_DAMAGE_MULTIPLIER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    REACTION_DODGE_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
  });
  const SCOREABLE_MISSING_POLICY = deepFreeze({ ...MISSING_POLICY, ...REACTION_MISSING_POLICY });

  const metrics = { selectCalls: 0, fatalCount: 0, lastWorkUnits: 0, totalWorkUnits: 0 };

  function fail(code, detail) {
    const error = new Error(detail || code);
    error.code = code;
    throw error;
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
      return out;
    }
    return value;
  }
  function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }
  function sha256Utf8(value) {
    const cryptoApi = root && root.crypto;
    if (cryptoApi && typeof cryptoApi.createHash === 'function') {
      return cryptoApi.createHash('sha256').update(Buffer.from(String(value), 'utf8')).digest('hex');
    }
    fail('CANONICAL_HASH_UNAVAILABLE');
  }
  function canonicalHash(value) { return sha256Utf8(canonicalJson(value)); }
  function compareUtf16(a, b) { return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }
  function orderedValues(values, codes) {
    const out = {};
    for (const code of codes) out[code] = values[code];
    return out;
  }
  function computedBaseSectionHash() {
    return canonicalHash({
      scoreableCodes31: SCOREABLE_CODES.slice(),
      normalization31: {
        means: orderedValues(NORMALIZATION.means, SCOREABLE_CODES),
        scales: orderedValues(NORMALIZATION.scales, SCOREABLE_CODES),
      },
      coefficients31: orderedValues(LINEAR.coefficients, SCOREABLE_CODES),
      intercept: LINEAR.intercept,
      modelHash: MODEL_HASH,
      weightsHash: WEIGHTS_HASH,
    });
  }
  function computedReactionHeadHash() {
    return canonicalHash({
      scope: 'PURE_IMMEDIATE_HP',
      parameterName: 'k',
      k: REACTION_LINEAR.k,
      intercept: REACTION_LINEAR.intercept,
      normalization: REACTION_NORMALIZATION,
      coefficients: REACTION_LINEAR.coefficients,
      trainingAlgorithmHash: REACTION_ALGORITHM_HASH,
    });
  }

  function assertWeightsHash() {
    const actual = canonicalHash({ normalization: NORMALIZATION, linear: LINEAR });
    if (actual !== WEIGHTS_HASH) fail('WEIGHTS_HASH_MISMATCH', actual + ':expected=' + WEIGHTS_HASH);
    return actual;
  }

  const DAMAGE_AGGREGATION_CODES = new Set(['DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_TYPE']);
  function aggregationRowsOf(rows, code) {
    const seen = new Set();
    const prepared = rows.map((row, index) => {
      const refs = row && row.sourceFactIds;
      const ref = Array.isArray(refs) && refs.length === 1 ? refs[0] : null;
      const split = typeof ref === 'string' ? ref.lastIndexOf('::') : -1;
      const sourceEffectId = split > 0 ? ref.slice(0, split) : '';
      const key = split >= 0 ? ref.slice(split + 2) : null;
      if (!/^[^\u0000-\u001f\u007f]{1,512}$/.test(sourceEffectId) || typeof key !== 'string' || key.length > 512 || /[\u0000-\u001f\u007f]/.test(key)) {
        fail('AGGREGATION_MISSING_EFFECT_ID', code + ':' + index);
      }
      if (typeof row.value !== 'number' || !Number.isFinite(row.value)) fail('AGGREGATION_NON_FINITE_VALUE', code + ':' + index);
      if (seen.has(sourceEffectId)) fail('AGGREGATION_DUPLICATE_SOURCE_EFFECT', code + ':' + sourceEffectId);
      seen.add(sourceEffectId);
      const value = Object.is(row.value, -0) ? 0 : row.value;
      if (code === 'DAMAGE_SEGMENTS' && !Number.isSafeInteger(value)) fail('AGGREGATION_INVALID_SEGMENT_DOMAIN', code + ':' + value);
      if (code === 'DAMAGE_TYPE' && value !== 0 && value !== 1) fail('AGGREGATION_INVALID_TYPE_DOMAIN', code + ':' + value);
      return { sourceEffectId, value };
    });
    prepared.sort((left, right) => compareUtf16(left.sourceEffectId, right.sourceEffectId));
    return prepared;
  }
  function neumaierSum(values) {
    let sum = 0;
    let correction = 0;
    for (const value of values) {
      const next = sum + value;
      correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum;
      sum = next;
    }
    const result = sum + correction;
    if (!Number.isFinite(result)) fail('AGGREGATION_NON_FINITE_RESULT');
    return Object.is(result, -0) ? 0 : result;
  }

  // Per-candidate 35-code scalarization, isomorphic to the trainer's
  // scalarizeCode (single-instance identity; duplicate rows via frozen perCode
  // SUM/MAX; ENUM identity; missing rows become UNKNOWN:NOT_EMITTED).
  function scalarizeCode(doc, code, aggregation) {
    const sourceRows = RELATIONAL_CODES.indexOf(code) >= 0
      ? (doc.document.relational.features || []).filter(f => f.featureCode === code)
      : (doc.document.immediate.features || []).filter(f => f.featureCode === code);
    if (sourceRows.length === 0) return { status: 'UNKNOWN', value: null, reasonCode: 'NOT_EMITTED', rowCount: 0, kind: 'NONE' };
    const knownRows = sourceRows.filter(r => r.status === 'KNOWN');
    if (knownRows.length > 0) {
      if (ENUM_CODES.has(code)) {
        if (typeof knownRows[0].value !== 'string') fail('ENUM_EXPECTS_STRING_VALUE', code + ':' + String(knownRows[0].value));
        const allSame = knownRows.every(r => String(r.value) === String(knownRows[0].value));
        if (!allSame) fail('ENUM_VALUE_MIXED_WITHIN_CANDIDATE_NO_FIRST', code + ':' + knownRows.map(r => r.value).join(','));
        return { status: 'KNOWN', value: String(knownRows[0].value), reasonCode: 'OK', rowCount: knownRows.length, kind: 'ENUM' };
      }
      const aggregationRows = DAMAGE_AGGREGATION_CODES.has(code) ? aggregationRowsOf(knownRows, code) : null;
      const numeric = aggregationRows ? aggregationRows.map(row => row.value) : knownRows.map(r => Number(r.value)).filter(Number.isFinite);
      if (numeric.length !== knownRows.length) fail('NON_NUMERIC_KNOWN_VALUE', code + ':' + knownRows.map(r => String(r.value)).join(','));
      let value;
      if (knownRows.length === 1) {
        value = numeric[0];
      } else {
        const op = aggregation && aggregation[code];
        if (!op) fail('AGGREGATION_MISSING_IN_CONTRACT', code + ':rows=' + knownRows.length);
        if (op === 'MAX') value = Math.max(...numeric);
        else if (op === 'SUM') value = numeric.reduce((sum, v) => sum + v, 0);
        else if (op === OP_DAMAGE_POWER) value = neumaierSum(aggregationRows.map(row => row.value));
        else if (op === OP_DAMAGE_SEGMENTS) {
          value = numeric.reduce((sum, v) => {
            const next = sum + v;
            if (!Number.isSafeInteger(next)) fail('AGGREGATION_NON_FINITE_RESULT', code + ':' + next);
            return next;
          }, 0);
        }
        else fail('AGGREGATION_OPERATOR_UNKNOWN_OR_NOT_ADJUDICATED', code + ':' + op);
      }
      if (Object.is(value, -0)) value = 0;
      return { status: 'KNOWN', value, reasonCode: 'OK', rowCount: knownRows.length, kind: 'NUMERIC' };
    }
    const na = sourceRows.find(r => r.status === 'NOT_APPLICABLE');
    if (na) return { status: 'NOT_APPLICABLE', value: null, reasonCode: na.reasonCode || 'NA', rowCount: 1, kind: 'NONE' };
    const unk = sourceRows.find(r => r.status === 'UNKNOWN');
    if (unk) return { status: 'UNKNOWN', value: null, reasonCode: unk.reasonCode || 'UNKNOWN', rowCount: 1, kind: 'NONE' };
    return { status: 'UNKNOWN', value: null, reasonCode: sourceRows[0].reasonCode || 'UNKNOWN', rowCount: sourceRows.length, kind: 'NONE' };
  }

  function assertScorable(cells) {
    for (const code of SCOREABLE_CODES) {
      const cell = cells[code];
      if (!cell || cell.status === 'KNOWN') continue;
      const policy = MISSING_POLICY[code];
      if (cell.status === 'NOT_APPLICABLE') {
        if (policy.na === 'REQUIRE_KNOWN') fail('NOT_SCORABLE_INPUT', code + ':NA:' + cell.reasonCode);
      } else if (policy.unknown === 'REQUIRE_KNOWN') {
        fail('NOT_SCORABLE_INPUT', code + ':' + cell.reasonCode);
      }
    }
    for (const code of REACTION_CODES) {
      const cell = cells[code];
      if (!cell || cell.status === 'KNOWN') continue;
      const policy = REACTION_MISSING_POLICY[code];
      if (cell.status === 'NOT_APPLICABLE') {
        if (policy.na === 'REQUIRE_KNOWN') fail('NOT_SCORABLE_INPUT', code + ':NA:' + cell.reasonCode);
      } else if (policy.unknown === 'REQUIRE_KNOWN') {
        fail('NOT_SCORABLE_INPUT', code + ':' + cell.reasonCode);
      }
    }
  }

  function zOf(cells, code) {
    const cell = cells[code];
    const policy = MISSING_POLICY[code];
    const scale = NORMALIZATION.scales[code];
    const mean = NORMALIZATION.means[code];
    if (cell.status === 'KNOWN') {
      if (ENUM_CODES.has(code)) return 0;
      return (cell.value - mean) / scale;
    }
    if (cell.status === 'NOT_APPLICABLE') {
      if (policy.na === 'NOT_APPLICABLE_TO_SEMANTIC_ZERO') {
        if ((policy.zeroReasons || []).indexOf(cell.reasonCode) >= 0) return (0 - mean) / scale;
        return 0;
      }
      return 0;
    }
    return 0;
  }

  function contributionOf(cells, code) {
    const z = zOf(cells, code);
    const coefficient = LINEAR.coefficients[code];
    return {
      code, raw: cells[code].value, mean: NORMALIZATION.means[code], scale: NORMALIZATION.scales[code],
      z, coefficient, contribution: coefficient * z, status: cells[code].status,
      reasonCode: cells[code].reasonCode, rowCount: cells[code].rowCount,
    };
  }

  function reactionZOf(cells, code) {
    const cell = cells[code];
    if (cell.status === 'KNOWN') {
      if (typeof cell.value !== 'number' || !Number.isFinite(cell.value)) fail('NON_FINITE_REACTION_VALUE', code);
      return (cell.value - REACTION_NORMALIZATION.means[code]) / REACTION_NORMALIZATION.scales[code];
    }
    return 0;
  }

  function reactionContributionOf(cells, code) {
    const cell = cells[code];
    const z = reactionZOf(cells, code);
    const factor = {
      code,
      mean: REACTION_NORMALIZATION.means[code],
      scale: REACTION_NORMALIZATION.scales[code],
      z,
      coefficient: REACTION_LINEAR.coefficients[code],
      contribution: REACTION_LINEAR.coefficients[code] * z,
      status: cell.status,
      reasonCode: cell.reasonCode,
      rowCount: cell.rowCount,
    };
    if (cell.status === 'KNOWN') factor.raw = cell.value;
    return factor;
  }

  function baseScoreOf(cells) {
    let score = LINEAR.intercept;
    for (const code of SCOREABLE_CODES) score += LINEAR.coefficients[code] * zOf(cells, code);
    return score;
  }

  function reactionScoreOf(cells) {
    let score = REACTION_LINEAR.intercept;
    for (const code of REACTION_CODES) score += REACTION_LINEAR.coefficients[code] * reactionZOf(cells, code);
    return score;
  }

  function scoreOf(cells) {
    const score = baseScoreOf(cells) + reactionScoreOf(cells);
    if (!Number.isFinite(score)) fail('NON_FINITE_SCORE');
    return score;
  }

  // Exclusion-surface reader (closed 10-code set). HARD_EXCLUSION is a BOOL
  // row and HARD_EXCLUSION_REASON an ENUM row; they are read verbatim for the
  // exclusion judgement only and never scalarized into the 31-code cells.
  function readExclusion(doc) {
    const features = doc && doc.document && doc.document.immediate && Array.isArray(doc.document.immediate.features) ? doc.document.immediate.features : [];
    const hardRow = features.find(f => f && f.featureCode === 'HARD_EXCLUSION');
    const reasonRow = features.find(f => f && f.featureCode === 'HARD_EXCLUSION_REASON');
    const hard = !!(hardRow && hardRow.status === 'KNOWN' && Number(hardRow.value) === 1);
    const reason = reasonRow && reasonRow.status === 'KNOWN' ? String(reasonRow.value).trim() : '';
    return { hard, reason };
  }

  // ---------------------------------------------------------------------------
  // Online public-feature document construction (request mode). Uses PDA ->
  // Bridge -> BIF and FeatureSource -> Relational exactly like the frozen
  // compiler, but without preview projection: contributions stay empty and
  // publicProbability stays null, so preview-dependent features fall back per
  // missingPolicyV1. Preview/future-route/route-catalog are never called.
  // ---------------------------------------------------------------------------
  function resolveApis() {
    return {
      pda: root.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__,
      bridge: root.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__,
      bif: root.__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__,
      source: root.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__,
      relational: root.__LWCS_BEHAVIOR_RELATIONAL_FEATURE__,
      decision: root.__LWCS_BATTLE_DECISION__,
      preview: root.__LWCS_BATTLE_PREVIEW__,
    };
  }

  function buildPublicSnapshot(visibleWorld, actorId) {
    const units = {};
    const sides = {};
    const participants = visibleWorld && visibleWorld['参战者'] ? visibleWorld['参战者'] : {};
    for (const [side, list] of Object.entries(participants)) {
      for (const unit of Array.isArray(list) ? list : []) {
        const id = String(unit && (unit.id || unit.name) || '').trim();
        if (!id) continue;
        units[id] = {
          hp: Number(unit.hp), hp_max: Number(unit.hp_max), sp: Number(unit.sp), sp_max: Number(unit.sp_max),
          men: Number(unit.men), men_max: Number(unit.men_max), vit: Number(unit.vit), vit_max: Number(unit.vit_max),
          def: Number(unit.def), agi: Number(unit.agi), shield: Number(unit.shield || 0),
          ['状态效果']: unit['状态效果'] || {},
        };
        // M3 R4b6 charge transport: mirror BattleDecision r9v2LinearPublicSnapshot
        // (L58002-58008). Copy the decision-visible 蓄力技能 own property verbatim
        // (object or null) only when present; never read Runtime internals and
        // never fabricate the field. BIF maps absence/null to observable no-charge
        // (KNOWN 0/0) and a missing target unit to UNKNOWN.
        if (Object.prototype.hasOwnProperty.call(unit, '蓄力技能')) {
          units[id]['蓄力技能'] = unit['蓄力技能'];
        }
        sides[id] = side;
      }
    }
    const all = [
      ...(participants.team_player || []),
      ...(participants.team_enemy || []),
    ];
    const actor = all.find(unit => String(unit && (unit.id || unit.name) || '') === actorId);
    return { units, sides, actorStatus: actor && actor['状态'] && actor['状态']['存活'] === false ? 'TERMINAL' : 'NORMAL' };
  }

  function publicCostFromDeclaration(declaration) {
    const result = [];
    for (const [resource, amount] of Object.entries((declaration && declaration.resourceCosts) || {})) {
      if (['魂力', '精神力', '体力', '生命'].indexOf(resource) >= 0 && Number.isFinite(Number(amount))) {
        result.push({ resource, amount: Number(amount) });
      }
    }
    return result;
  }

  function pdaProjectionsOf(declaration, candidateId, actorId, pdaApi) {
    const effects = declaration && declaration.actionKind === 'RELEASE_SKILL' && Array.isArray(declaration.skill && declaration.skill['_效果数组'])
      ? declaration.skill['_效果数组']
      : [];
    const projections = [];
    for (let index = 0; index < effects.length; index += 1) {
      const sourceEffectId = (declaration.actionId || candidateId) + ':effect:' + index;
      const context = {
        sourceActionId: declaration.actionId || candidateId,
        sourceActorId: actorId,
        sourceEffectId,
        candidateTargetIds: Array.isArray(declaration.targetIds) ? declaration.targetIds.slice() : [],
      };
      const admitted = pdaApi.admit(effects[index], context);
      const projection = pdaApi.project(effects[index], context);
      projections.push({ sourceEffectId, projection, admitted: admitted && admitted.admitted === true });
    }
    return projections;
  }

  function creationProfileOf(candidate) {
    const creation = candidate && candidate.creation;
    if (!creation || typeof creation !== 'object' || Array.isArray(creation)) return undefined;
    const recipientId = String(creation.recipientId || '').trim();
    if (!recipientId) return undefined;
    const useEffects = (Array.isArray(creation.useEffects) ? creation.useEffects : []).filter(row =>
      row && typeof row === 'object' && !Array.isArray(row) &&
      typeof row['原型'] === 'string' && row['原型'].length > 0 &&
      typeof row['目标'] === 'string' && row['目标'].length > 0 &&
      row['资源'] !== undefined &&
      typeof row['数值'] === 'string' && row['数值'].length > 0
    );
    return { recipientId, useEffects };
  }

  function buildDocumentForCandidate(request, candidate, apis) {
    if (!apis.bridge || !apis.bif || !apis.pda) fail('BRIDGE_INPUT_GAP', 'required modules: pda/bridge/bif');
    if (!request || !request.visibleWorld) fail('BRIDGE_INPUT_GAP', 'request.visibleWorld');
    if (!request.actorId) fail('BRIDGE_INPUT_GAP', 'request.actorId');
    const declaration = candidate && candidate.declaration ? candidate.declaration : {};
    const publicSnapshot = buildPublicSnapshot(request.visibleWorld, request.actorId);
    const pdaProjections = pdaProjectionsOf(declaration, candidate.candidateId, request.actorId, apis.pda);
    const bridgeInput = {
      frozenCandidate: {
        candidateId: candidate.candidateId,
        actorId: request.actorId,
        actorSide: publicSnapshot.sides[request.actorId] || 'team_player',
        actionKind: declaration.actionKind || '',
        targetSet: Array.isArray(declaration.targetIds) ? declaration.targetIds.slice() : [],
      },
      visibleWorld: publicSnapshot,
      contributions: [],
      pdaProjections,
      declaration: {
        publicCost: publicCostFromDeclaration(declaration),
        publicProbability: null,
      },
    };
    const creationProfile = creationProfileOf(candidate);
    if (creationProfile !== undefined) bridgeInput.creationProfile = creationProfile;
    const bridged = apis.bridge.bridgeCandidates([bridgeInput]);
    const perCandidate = bridged && bridged.perCandidate && bridged.perCandidate[0];
    if (!perCandidate || !perCandidate.bifInput) fail('BRIDGE_INPUT_GAP', 'bifInput');
    const immediate = apis.bif.compileCandidate(perCandidate.bifInput);
    return { candidateId: candidate.candidateId, document: { immediate, relational: null } };
  }

  function buildRelationalDocuments(request, apis) {
    if (!apis.source || !apis.relational) fail('BRIDGE_INPUT_GAP', 'relational modules: featureSource/relational');
    if (!apis.decision || !apis.preview) fail('BRIDGE_INPUT_GAP', 'relational context: decisionApi/previewApi');
    const sourceInput = apis.source.compilePreparedRequest({ request, decisionApi: apis.decision, previewApi: apis.preview, pdaApi: apis.pda });
    const relationalDoc = apis.relational.compileDecision(sourceInput);
    const byCandidate = new Map((relationalDoc && relationalDoc.perCandidate || []).map(item => [item && item.candidateId, item]));
    return byCandidate;
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------
  function selectPreparedRequest(input) {
    metrics.selectCalls += 1;
    const request = input && input.request ? input.request : {};
    const featureInputs = input && input.featureInputs;
    const frozenCandidates = Array.isArray(request.frozenCandidates) ? request.frozenCandidates : [];
    if (!frozenCandidates.length) fail('NO_LEGAL_CANDIDATES', 'frozenCandidates empty');
    const work = { candidates: frozenCandidates.length, scalarizeCalls: 0, sortComparisons: 0, reasonFactors: 0, documentBuilds: 0 };
    const candidateIds = frozenCandidates.map(candidate => String(candidate.candidateId || '').trim());
    if (candidateIds.some(id => !id) || new Set(candidateIds).size !== candidateIds.length) {
      fail('CANDIDATE_ID_UNIQUE', 'frozen candidates must be unique non-empty ids');
    }
    if (featureInputs === undefined || featureInputs === null) {
      fail('FEATURE_INPUTS_REQUIRED', 'featureInputs required');
    }
    if (!Array.isArray(featureInputs)) fail('FEATURE_INPUTS_SHAPE', 'featureInputs must be an array');
    const documents = featureInputs;
    work.documentBuilds = 0;
    const docByCandidate = new Map(documents.map(doc => [String(doc && doc.candidateId || '').trim(), doc]));
    if (docByCandidate.size !== candidateIds.length || candidateIds.some(id => !docByCandidate.has(id))) {
      fail('CANDIDATE_SET_CONSERVATION', 'featureInputs must cover frozenCandidates exactly, no re-enumeration');
    }
    const rows = [];
    const featureVector = [];
    const hardExclusionAudit = [];
    for (const candidateId of candidateIds) {
      const doc = docByCandidate.get(candidateId);
      const cells = {};
      for (const code of SCOREABLE_INVENTORY) {
        cells[code] = scalarizeCode(doc, code, AGGREGATION);
        work.scalarizeCalls += 1;
      }
      const exclusion = readExclusion(doc);
      const hardExcluded = exclusion.hard;
      work.exclusionRows = (work.exclusionRows || 0) + 2;
      let reasonCode = null;
      if (hardExcluded) {
        reasonCode = exclusion.reason;
        if (HARD_EXCLUSION_CODES.indexOf(reasonCode) < 0) fail('HARD_EXCLUSION_CODE_UNKNOWN', reasonCode);
        hardExclusionAudit.push({ candidateId, disposition: 'HARD_EXCLUDED_PREVIEW_SKIPPED', reasonCode, source: 'BIF_IMMEDIATE_PUBLIC' });
      }
      const row = { candidateId, cells, hardExcluded, eligible: !hardExcluded, baseScore: null, extensionScore: null, score: null };
      featureVector.push({
        candidateId,
        cells,
        hardExclusion: { hard: hardExcluded, reason: reasonCode },
      });
      if (!hardExcluded) {
        assertScorable(cells);
        row.baseScore = baseScoreOf(cells);
        row.extensionScore = reactionScoreOf(cells);
        row.score = row.baseScore + row.extensionScore;
        if (!Number.isFinite(row.score)) fail('NON_FINITE_SCORE');
      }
      rows.push(row);
    }
    const eligible = rows.filter(row => row.eligible);
    if (!eligible.length) fail('NO_ELIGIBLE_CANDIDATES');
    const ranked = eligible.slice().sort((a, b) => {
      work.sortComparisons += 1;
      return a.score !== b.score ? b.score - a.score : compareUtf16(a.candidateId, b.candidateId);
    });
    const selected = ranked[0];
    const selectedDeclaration = (frozenCandidates.find(c => c.candidateId === selected.candidateId) || {}).declaration || null;
    const alternative = selectAlternative(ranked, selected, frozenCandidates);
    const rankedSummary = ranked.map(row => ({
      candidateId: row.candidateId,
      score: row.score,
      baseScore: row.baseScore,
      extensionScore: row.extensionScore,
      tieGroup: ranked.filter(other => other.score === row.score).map(other => other.candidateId).sort(compareUtf16),
    }));
    const scoreContributions = {};
    for (const row of eligible) {
      const factors = [];
      for (const code of SCOREABLE_INVENTORY) {
        factors.push(REACTION_CODES.indexOf(code) >= 0 ? reactionContributionOf(row.cells, code) : contributionOf(row.cells, code));
        work.reasonFactors += 1;
      }
      scoreContributions[row.candidateId] = { score: row.score, baseScore: row.baseScore, extensionScore: row.extensionScore, factors };
    }
    metrics.lastWorkUnits = work.candidates * SCOREABLE_INVENTORY.length + work.scalarizeCalls;
    metrics.totalWorkUnits += metrics.lastWorkUnits;
    const result = {
      providerId: PROVIDER_ID,
      engine: ENGINE,
      schemaVersion: SCHEMA_VERSION,
      requestHash: String(request.requestHash || '').trim(),
      featureInputHash: canonicalHash(featureVector),
      selected: {
        candidateId: selected.candidateId,
        declaration: selectedDeclaration,
        playerLocked: false,
        selectionMode: 'R9V2_LINEAR',
      },
      ranked: rankedSummary,
      rankedCandidateIds: ranked.map(row => row.candidateId),
      hardExclusionAudit,
      hardExcludedCount: hardExclusionAudit.length,
      eligibleCount: eligible.length,
      candidateCount: rows.length,
      scoreContributions,
      alternative,
      workMetrics: {
        candidateCount: work.candidates,
        scalarizeCalls: work.scalarizeCalls,
        scalarizePerCandidate: work.candidates ? work.scalarizeCalls / work.candidates : 0,
        expectedCBy31: work.candidates * SCOREABLE_CODES.length,
        expectedCBy33: work.candidates * SCOREABLE_INVENTORY.length,
        sortComparisons: work.sortComparisons,
        reasonFactorCount: work.reasonFactors,
        documentBuilds: work.documentBuilds,
      },
    };
    result.providerResultHash = canonicalHash(result);
    return deepFreeze(result);
  }

  function selectAlternative(ranked, selected, frozenCandidates) {
    const selectedDeclaration = (frozenCandidates.find(c => c.candidateId === selected.candidateId) || {}).declaration || {};
    const keyOf = declaration => {
      const d = declaration || {};
      return {
        actionId: String(d.actionId || '').trim(),
        targetSet: (Array.isArray(d.targetIds) ? d.targetIds : []).map(String).sort(compareUtf16).join('\u0000'),
        paymentMode: String(d.paymentMode || 'FULL').trim(),
      };
    };
    const selectedKey = keyOf(selectedDeclaration);
    for (const row of ranked) {
      if (row.candidateId === selected.candidateId) continue;
      const candidate = frozenCandidates.find(c => c.candidateId === row.candidateId);
      const key = keyOf(candidate && candidate.declaration);
      if (key.actionId !== selectedKey.actionId || key.targetSet !== selectedKey.targetSet || key.paymentMode !== selectedKey.paymentMode) {
        const difference = ['actionId', 'targetSet', 'paymentMode'].filter(field => {
          const a = field === 'targetSet' ? selectedKey.targetSet : selectedKey[field];
          const b = field === 'targetSet' ? key.targetSet : key[field];
          return a !== b;
        });
        return { candidateId: row.candidateId, score: row.score, structuralDifference: difference };
      }
    }
    return { candidateId: null, alternativeReason: 'ALTERNATIVE_NOT_AVAILABLE', structuralDifference: [] };
  }

  function deepFreeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  }

  function isDeepFrozen(value) {
    if (value === null || typeof value !== 'object') return true;
    return Object.isFrozen(value) && Object.keys(value).every(key => isDeepFrozen(value[key]));
  }

  function missingPolicyMutationProbe() {
    const policy = SCOREABLE_MISSING_POLICY;
    const beforeNA = policy.PUBLIC_HP_RATIO.na;
    const beforeReasons = policy.STATE_DURATION.zeroReasons.slice();
    try { policy.PUBLIC_HP_RATIO.na = 'UNKNOWN_TO_TRAIN_MEAN'; } catch (_) { }
    try { policy.STATE_DURATION.zeroReasons.push('MUTATION_PROBE'); } catch (_) { }
    const cells = {};
    for (const code of SCOREABLE_CODES) cells[code] = { status: 'KNOWN', value: 0, reasonCode: 'OK', rowCount: 1 };
    for (const code of REACTION_CODES) cells[code] = { status: 'KNOWN', value: 0, reasonCode: 'OK', rowCount: 1 };
    cells.PUBLIC_HP_RATIO = { status: 'NOT_APPLICABLE', value: null, reasonCode: 'MUTATION_PROBE_NA', rowCount: 1 };
    let failClosed = false;
    try { assertScorable(cells); } catch (error) { failClosed = error.code === 'NOT_SCORABLE_INPUT'; }
    return policy.PUBLIC_HP_RATIO.na === beforeNA && JSON.stringify(policy.STATE_DURATION.zeroReasons) === JSON.stringify(beforeReasons) && failClosed;
  }

  function selfCheck() {
    const checks = {};
    checks.baseScoreableCount = SCOREABLE_CODES.length === 31 && new Set(SCOREABLE_CODES).size === 31;
    checks.scoreableCount = SCOREABLE_INVENTORY.length === 33 && new Set(SCOREABLE_INVENTORY).size === 33;
    checks.reactionScoreableCount = REACTION_CODES.length === 2 && REACTION_CODES.every(code => SCOREABLE_INVENTORY.indexOf(code) >= 0);
    checks.relationalCount = RELATIONAL_CODES.length === 5 && RELATIONAL_CODES.every(code => SCOREABLE_CODES.indexOf(code) >= 0);
    checks.exclusionCount = EXCLUSION_ONLY.length === 2;
    checks.catalogOnlyCount = CATALOG_ONLY.length === 2;
    checks.hardExclusionClosed = HARD_EXCLUSION_CODES.length === 10 && new Set(HARD_EXCLUSION_CODES).size === 10;
    checks.missingPolicyCoverage = SCOREABLE_CODES.every(code => MISSING_POLICY[code] && typeof MISSING_POLICY[code] === 'object') && REACTION_CODES.every(code => REACTION_MISSING_POLICY[code] && typeof REACTION_MISSING_POLICY[code] === 'object');
    checks.missingPolicyDeepFreeze = isDeepFrozen(SCOREABLE_MISSING_POLICY) && SCOREABLE_INVENTORY.every(code => isDeepFrozen(SCOREABLE_MISSING_POLICY[code]));
    checks.missingPolicyMutationNAFailClosed = missingPolicyMutationProbe();
    checks.statisticsCoverage = SCOREABLE_CODES.every(code => NORMALIZATION.means[code] !== undefined && NORMALIZATION.scales[code] !== undefined && LINEAR.coefficients[code] !== undefined) && REACTION_CODES.every(code => REACTION_NORMALIZATION.means[code] !== undefined && REACTION_NORMALIZATION.scales[code] > 0 && Number.isFinite(REACTION_LINEAR.coefficients[code]));
    checks.aggregationOperators = Object.values(AGGREGATION).every(op => ['SUM', 'MAX', OP_DAMAGE_POWER, OP_DAMAGE_SEGMENTS].indexOf(op) >= 0) && Object.keys(AGGREGATION).length === 8;
    checks.aggregationFrozenTable = canonicalJson(AGGREGATION) === canonicalJson({
      JUDGMENT_DELTA: 'SUM', STATE_DURATION: 'MAX', STATE_DELTA_PERCENT: 'SUM',
      SETTLEMENT_MODIFIER_PERCENT: 'SUM', RESOURCE_DELTA_PERCENT: 'MAX',
      DAMAGE_POWER: OP_DAMAGE_POWER, DAMAGE_SEGMENTS: OP_DAMAGE_SEGMENTS, DAMAGE_TYPE: 'MAX',
    });
    checks.aggregationClosureCoverage = AGGREGATION_CLOSURE.multiRowCodes.length === 8 &&
      AGGREGATION_CLOSURE.failClosedMultiRowCodes.length === 7 &&
      AGGREGATION_CLOSURE.singleRowCodes.length === 16 &&
      AGGREGATION_CLOSURE.multiRowCodes.every(code => AGGREGATION[code] !== undefined) &&
      AGGREGATION_CLOSURE.failClosedMultiRowCodes.every(code => AGGREGATION[code] === undefined) &&
      AGGREGATION_CLOSURE.singleRowCodes.every(code => AGGREGATION[code] === undefined) &&
      new Set([...AGGREGATION_CLOSURE.multiRowCodes, ...AGGREGATION_CLOSURE.failClosedMultiRowCodes, ...AGGREGATION_CLOSURE.singleRowCodes]).size === 31 &&
      SCOREABLE_CODES.every(code => AGGREGATION_CLOSURE.multiRowCodes.indexOf(code) >= 0 || AGGREGATION_CLOSURE.failClosedMultiRowCodes.indexOf(code) >= 0 || AGGREGATION_CLOSURE.singleRowCodes.indexOf(code) >= 0);
    checks.aggregationNoImplicitMerge = Object.keys(AGGREGATION).every(code => AGGREGATION_CLOSURE.multiRowCodes.indexOf(code) >= 0) &&
      AGGREGATION_CLOSURE.multiRowCodes.every(code => Object.keys(AGGREGATION).indexOf(code) >= 0);
    checks.aggregationClosureVersion = AGGREGATION_CLOSURE.version === 'AGGREGATION_CLOSURE_V2';
    checks.contractPins = DBP_REVISION === 15 && DBP_CONTRACT_HASH === '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8' && DBP_SCHEMA_HASH === '3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e' && BIF_CONTRACT_HASH === '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76' && BIF_SCHEMA_HASH === 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49';
    checks.weightsHash = assertWeightsHash() === WEIGHTS_HASH;
    checks.modelHash = MODEL_HASH === '5308f3bcbb60413e6161089397d59224ec3a7d92c60c58062067df19f9024ced';
    checks.baseSectionHash = computedBaseSectionHash() === BASE_SECTION_HASH;
    checks.reactionHeadHash = computedReactionHeadHash() === REACTION_HEAD_HASH;
    checks.reactionKPositive = REACTION_LINEAR.k > 0 && REACTION_LINEAR.intercept === 0;
    checks.reactionCoefficientDerivation = REACTION_LINEAR.coefficients.REACTION_DAMAGE_MULTIPLIER === -REACTION_LINEAR.k * REACTION_NORMALIZATION.scales.REACTION_DAMAGE_MULTIPLIER && REACTION_LINEAR.coefficients.REACTION_DODGE_PROBABILITY === REACTION_LINEAR.k * REACTION_NORMALIZATION.scales.REACTION_DODGE_PROBABILITY;
    checks.reactionAlgorithmHash = REACTION_ALGORITHM_HASH === '5ddd1dff3f07d3aa7c1b48f627cd5a3c64de9025941fab25923b52851b8a1852';
    checks.modelCompositeHash = MODEL_COMPOSITE_HASH === '1571f142a29ad9e6faef6644533a632942dbd57867a5aa00c2ca76b685a2dd8c';
    checks.noForbiddenSource = ['r9v2TargetKernelProvider', 'runR9v2TargetProvider', 'futureRoute', 'routeCatalog', 'previewAction'].every(token => String(selectPreparedRequest).indexOf(token) < 0 && String(buildDocumentForCandidate).indexOf(token) < 0);
    checks.noWallClock = String(selectPreparedRequest).indexOf('Date.now') < 0 && String(selectPreparedRequest).indexOf('performance.now') < 0 && String(selectPreparedRequest).indexOf('Math.random') < 0;
    checks.reactionCounterNonScoreable = SCOREABLE_INVENTORY.indexOf('REACTION_COUNTER_WINDOW_OPEN') < 0;
    checks.catalogExclusionOutside = EXCLUSION_ONLY.every(code => SCOREABLE_INVENTORY.indexOf(code) < 0) && CATALOG_ONLY.every(code => SCOREABLE_INVENTORY.indexOf(code) < 0);
    return { ok: Object.values(checks).every(Boolean), checks, providerId: PROVIDER_ID, engine: ENGINE, modelHash: MODEL_HASH, weightsHash: WEIGHTS_HASH, featureSchemaHash: FEATURE_SCHEMA_HASH };
  }

  const readMetrics = () => Object.freeze({ ...metrics });
  const testAccessorsEnabled =
    (typeof globalThis !== 'undefined' && globalThis['__LWCS_RC6_TEST_ACCESSORS__'] === true) ||
    (typeof self !== 'undefined' && self['__LWCS_RC6_TEST_ACCESSORS__'] === true) ||
    (typeof window !== 'undefined' && window['__LWCS_RC6_TEST_ACCESSORS__'] === true);
  const api = Object.freeze({
    providerId: PROVIDER_ID,
    engine: ENGINE,
    schemaVersion: SCHEMA_VERSION,
    modelHash: MODEL_HASH,
    weightsHash: WEIGHTS_HASH,
    featureSchemaHash: FEATURE_SCHEMA_HASH,
    dbpRevision: DBP_REVISION,
    dbpContractHash: DBP_CONTRACT_HASH,
    bifContractHash: BIF_CONTRACT_HASH,
    baseSectionHash: BASE_SECTION_HASH,
    reactionHeadHash: REACTION_HEAD_HASH,
    modelCompositeHash: MODEL_COMPOSITE_HASH,
    intercept: LINEAR.intercept,
    constants: Object.freeze({
      scoreableCodes: SCOREABLE_INVENTORY.slice(),
      baseScoreableCodes: SCOREABLE_CODES.slice(),
      reactionCodes: REACTION_CODES.slice(),
      relationalCodes: RELATIONAL_CODES.slice(),
      exclusionOnly: EXCLUSION_ONLY.slice(),
      catalogOnly: CATALOG_ONLY.slice(),
      hardExclusionCodes: HARD_EXCLUSION_CODES.slice(),
      missingPolicy: SCOREABLE_MISSING_POLICY,
      aggregation: AGGREGATION,
      aggregationClosure: AGGREGATION_CLOSURE,
      reaction: Object.freeze({
        k: REACTION_LINEAR.k,
        intercept: REACTION_LINEAR.intercept,
        normalization: REACTION_NORMALIZATION,
        coefficients: REACTION_LINEAR.coefficients,
        algorithmHash: REACTION_ALGORITHM_HASH,
      }),
    }),
    selectPreparedRequest,
    selfCheck,
    readMetrics,
    // M3 R4b6 dual-path probe accessor, test-only: exposed only when the
    // explicit __LWCS_RC6_TEST_ACCESSORS__ === true mount flag is set before
    // module load; absent on production mounts. No scoring mutation, no hidden
    // inputs, not consumed by any runtime path and not a Registry/API dependency.
    ...(testAccessorsEnabled ? { testAccessors: Object.freeze({ buildPublicSnapshot }) } : {}),
  });

  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

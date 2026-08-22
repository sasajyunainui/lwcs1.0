// BehaviorContributionTrace_Module.js
// M3/R4B1 contribution trace builder: turns frozen per-candidate Provider
// feature rows plus the accepted LINEAR_SCORE_V1 model into a
// DecisionContributionTraceV1 revision 10 document (score conservation
// <= 1e-12, selection deltas, top positive/negative, missingMask,
// hardExclusions) plus a separate sourceClosure. Pure function; never reads
// teacher/route/future/hidden fields; never writes files.
(function () {
  'use strict';

  var SCHEMA_VERSION = 'DecisionContributionTraceV1';
  var TOLERANCE = 1e-12;
  var MOUNT_NAME = '__LWCS_BEHAVIOR_CONTRIBUTION_TRACE__';

  // Frozen from DecisionContributionTraceV1 revision 10. Trace admits exactly
  // the 32 numeric Provider factors; RELATION_TARGET_SIDE is evidence-only.
  var TACTICAL_CONCEPT = {
    RELATION_TARGET_COUNT: '目标推进',
    RELATION_TARGET_SIDE: '目标推进',
    SUCCESS_PROBABILITY: '风险',
    PUBLIC_HP_RATIO: '生存',
    PUBLIC_RESOURCE_RATIO: '资源',
    COST_AFFORDABILITY: '代价',
    REVEAL_STRENGTH: '信息',
    OVERKILL_AVAILABILITY: '机会',
    HARD_EXCLUSION: '风险',
    HARD_EXCLUSION_REASON: '风险',
    SETTLEMENT_DAMAGE: '风险',
    ROLL_REALIZATION: '风险',
    OUTSIDE_BATCH1_ROW_COUNT: '机会',
    DAMAGE_POWER: '伤害压力',
    DAMAGE_SEGMENTS: '伤害压力',
    DAMAGE_PENETRATION: '伤害压力',
    DAMAGE_TYPE: '伤害压力',
    RESOURCE_DELTA: '资源',
    SHIELD_DELTA: '防御',
    ATTRIBUTE_DELTA: '防御',
    JUDGMENT_DELTA: '风险',
    STATE_PRESENCE: '控制',
    STATE_DURATION: '控制',
    STATE_DELTA_PERCENT: '控制',
    SETTLEMENT_MODIFIER_PERCENT: '风险',
    SUMMON_COUNT: '机会',
    SUMMON_STRENGTH: '机会',
    SUMMON_DURATION: '机会',
    RESOURCE_DELTA_PERCENT: '资源',
    TEAM_EFFECT_MARGINAL_GAIN: '控制',
    TEAM_EFFECT_REDUNDANCY_RATIO: '控制',
    RESOURCE_DEFICIT_COVERAGE: '资源',
    RESOURCE_CONSUMER_FIT: '资源',
    TEAM_FOLLOWUP_COVERAGE: '机会',
    PUBLIC_RECIPIENT_NEED_MATCH: '资源',
    REACTION_DAMAGE_MULTIPLIER: '伤害压力',
    REACTION_DODGE_PROBABILITY: '生存',
  };

  // Fallback unit families; caller rows usually carry their own unitFamily.
  var UNIT_FAMILY = {
    RELATION_TARGET_COUNT: 'COUNT',
    RELATION_TARGET_SIDE: 'ENUM',
    SUCCESS_PROBABILITY: 'PROBABILITY_0_1',
    PUBLIC_HP_RATIO: 'RATIO_0_1',
    PUBLIC_RESOURCE_RATIO: 'RATIO_0_1',
    COST_AFFORDABILITY: 'RATIO_0_1',
    REVEAL_STRENGTH: 'RATIO_0_1',
    OVERKILL_AVAILABILITY: 'BOOL',
    HARD_EXCLUSION: 'BOOL',
    HARD_EXCLUSION_REASON: 'ENUM',
    SETTLEMENT_DAMAGE: 'ABS',
    ROLL_REALIZATION: 'BOOL',
    OUTSIDE_BATCH1_ROW_COUNT: 'COUNT',
    DAMAGE_POWER: 'POWER',
    DAMAGE_SEGMENTS: 'COUNT',
    DAMAGE_PENETRATION: 'PERCENT',
    DAMAGE_TYPE: 'ENUM',
    RESOURCE_DELTA: 'ABS',
    SHIELD_DELTA: 'ABS',
    ATTRIBUTE_DELTA: 'ABS',
    JUDGMENT_DELTA: 'ABS',
    STATE_PRESENCE: 'BOOL',
    STATE_DURATION: 'TURNS',
    STATE_DELTA_PERCENT: 'PERCENT',
    SETTLEMENT_MODIFIER_PERCENT: 'PERCENT',
    SUMMON_COUNT: 'COUNT',
    SUMMON_STRENGTH: 'POWER',
    SUMMON_DURATION: 'TURNS',
    RESOURCE_DELTA_PERCENT: 'PERCENT',
    TEAM_EFFECT_MARGINAL_GAIN: 'RATIO_0_1',
    TEAM_EFFECT_REDUNDANCY_RATIO: 'RATIO_0_1',
    RESOURCE_DEFICIT_COVERAGE: 'RATIO_0_1',
    RESOURCE_CONSUMER_FIT: 'RATIO_0_1',
    TEAM_FOLLOWUP_COVERAGE: 'RATIO_0_1',
    PUBLIC_RECIPIENT_NEED_MATCH: 'RATIO_0_1',
    REACTION_DAMAGE_MULTIPLIER: 'RATIO_0_1',
    REACTION_DODGE_PROBABILITY: 'PROBABILITY_0_1',
  };

  var NUMERIC_CODES = Object.freeze([
    'RELATION_TARGET_COUNT', 'SUCCESS_PROBABILITY', 'PUBLIC_HP_RATIO',
    'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY', 'REVEAL_STRENGTH',
    'OVERKILL_AVAILABILITY', 'OUTSIDE_BATCH1_ROW_COUNT', 'DAMAGE_POWER',
    'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE', 'RESOURCE_DELTA',
    'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'STATE_PRESENCE',
    'STATE_DURATION', 'STATE_DELTA_PERCENT', 'SETTLEMENT_MODIFIER_PERCENT',
    'SUMMON_COUNT', 'SUMMON_STRENGTH', 'SUMMON_DURATION',
    'RESOURCE_DELTA_PERCENT', 'TEAM_EFFECT_MARGINAL_GAIN',
    'TEAM_EFFECT_REDUNDANCY_RATIO', 'RESOURCE_DEFICIT_COVERAGE',
    'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE',
    'PUBLIC_RECIPIENT_NEED_MATCH', 'REACTION_DAMAGE_MULTIPLIER',
    'REACTION_DODGE_PROBABILITY',
  ]);
  var NUMERIC_CODE_SET = new Set(NUMERIC_CODES);
  var ENUM_CODES = new Set(['RELATION_TARGET_SIDE']);
  var REACTION_CODES = new Set(['REACTION_DAMAGE_MULTIPLIER', 'REACTION_DODGE_PROBABILITY']);
  var CATALOG_ONLY = new Set(['SETTLEMENT_DAMAGE', 'ROLL_REALIZATION']);
  var EXCLUSION_ONLY = new Set(['HARD_EXCLUSION', 'HARD_EXCLUSION_REASON']);
  var EXCLUDED_INPUT_CODES = new Set([
    'REACTION_COUNTER_WINDOW_OPEN', 'TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME',
  ].concat(Array.from(EXCLUSION_ONLY), Array.from(CATALOG_ONLY)));
  // failClosedV1 SOURCE_MISSING scope: KNOWN EFFECT_ROW contributions must be
  // traceable to row facts; candidate-scope (publicSnapshot-derived) rows are
  // exempt.
  var EFFECT_ROW_CODES = new Set([
    'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE',
    'STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT', 'RESOURCE_DELTA',
    'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'SUMMON_COUNT',
    'SUMMON_STRENGTH', 'SUMMON_DURATION', 'SETTLEMENT_MODIFIER_PERCENT',
    'OUTSIDE_BATCH1_ROW_COUNT',
  ]);
  // absence-proven zero exemption: only count rows whose KNOWN 0 value means
  // "the closed input scope was fully enumerated and the thing really does not
  // exist" may skip the SOURCE_MISSING gate. Never generalize to any empty-
  // source KNOWN row; other codes must carry real source refs even when 0.
  var ABSENCE_PROVEN_ZERO_CODES = new Set(['OUTSIDE_BATCH1_ROW_COUNT']);

  // Frozen from DistilledBehaviorPolicyV1 missingPolicyV1.scoreable (rev13).
  var MISSING_POLICY = {
    RELATION_TARGET_COUNT: { unknown: 'REQUIRE_KNOWN', notApplicable: 'REQUIRE_KNOWN' },
    RELATION_TARGET_SIDE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUCCESS_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'UNKNOWN_TO_TRAIN_MEAN' },
    PUBLIC_HP_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    PUBLIC_RESOURCE_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    COST_AFFORDABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'UNKNOWN_TO_TRAIN_MEAN' },
    REVEAL_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    OVERKILL_AVAILABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    OUTSIDE_BATCH1_ROW_COUNT: { unknown: 'REQUIRE_KNOWN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_POWER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_SEGMENTS: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_PENETRATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_TYPE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SHIELD_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    ATTRIBUTE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    JUDGMENT_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    STATE_PRESENCE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    STATE_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_DURATION'] },
    STATE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SETTLEMENT_MODIFIER_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUMMON_COUNT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUMMON_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUMMON_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    TEAM_EFFECT_MARGINAL_GAIN: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    TEAM_EFFECT_REDUNDANCY_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    RESOURCE_DEFICIT_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_RESOURCE_DEFICIT', 'NO_RESOURCE_SUPPLY'] },
    RESOURCE_CONSUMER_FIT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_RESOURCE_CONSUMER'] },
    TEAM_FOLLOWUP_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_FOLLOW_UP_GRANT'] },
    PUBLIC_RECIPIENT_NEED_MATCH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    REACTION_DAMAGE_MULTIPLIER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    REACTION_DODGE_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
  };

  var HARD_EXCLUSION_TEXT = {
    ACTOR_DISABLED: '行动者无法行动',
    ACTOR_TERMINAL: '行动者已退场',
    TARGET_EMPTY: '目标为空',
    INVALID_OPTION_VALUE: '选项值不合法',
    MISSING_REQUIRED_FIELD: '缺少必需字段',
    UNKNOWN_STATE: '状态未知',
    UNKNOWN_RULE: '规则未知',
    AMBIGUOUS_TAUNT_TARGET: '嘲讽目标不明确',
    ILLEGAL_TARGET: '目标不合法',
    RESOURCE_INSUFFICIENT: '资源不足',
  };

  function cmpUtf16(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function unique(values) {
    var seen = new Set();
    (Array.isArray(values) ? values : []).forEach(function (v) { if (v !== undefined && v !== null && v !== '') seen.add(String(v)); });
    return Array.from(seen).sort(cmpUtf16);
  }
  function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
  function text(v) { return v === undefined || v === null ? '' : String(v); }

  function recordFactorAudit(audit, code, status, reasonCode, contribution) {
    if (!audit) return;
    audit.factors.push({
      featureCode: code,
      unitFamily: UNIT_FAMILY[code],
      tacticalConcept: TACTICAL_CONCEPT[code],
      status: status,
      reasonCode: text(reasonCode) || 'UNKNOWN',
      contribution: isFiniteNumber(contribution) ? contribution : 0,
    });
  }

  function recordIgnoredCode(audit, code) {
    if (!audit || !code || audit.ignoredCodes.indexOf(code) >= 0) return;
    audit.ignoredCodes.push(code);
  }

  function maskedRow(base, status, audit, code, reasonCode) {
    recordFactorAudit(audit, code, status, reasonCode, 0);
    return { ...base, status: status, missingMasked: true };
  }

  // A row is "real" only when it is an admitted Provider factor (KNOWN or an
  // exact semantic-zero NA). Raw BIF/catalog/exclusion rows never reach this
  // function's output carriers.
  function contributionOf(feature, model, audit) {
    var code = text(feature && feature.featureCode);
    if (ENUM_CODES.has(code)) return null;
    if (!NUMERIC_CODE_SET.has(code)) {
      recordIgnoredCode(audit, code);
      return null;
    }
    var status = text(feature && feature.status).toUpperCase() || 'UNKNOWN';
    if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(status) < 0) {
      throw new Error('TRACE_STATUS_INVALID:' + code + ':' + status);
    }
    var reasonCode = text(feature && feature.reasonCode);
    if (status === 'NOT_APPLICABLE' && REACTION_CODES.has(code)) {
      throw new Error('TRACE_REACTION_NOT_APPLICABLE:' + code + ':' + reasonCode);
    }
    if (status === 'NOT_APPLICABLE' && code === 'PUBLIC_RECIPIENT_NEED_MATCH') {
      throw new Error('TRACE_PROVIDER_REQUIRED_KNOWN:' + code + ':' + reasonCode);
    }
    var unitFamily = UNIT_FAMILY[code];
    var concept = TACTICAL_CONCEPT[code];
    var base = {
      featureId: 'c::' + code,
      featureCode: code,
      unitFamily: unitFamily,
      tacticalConcept: concept,
      sourceFactIds: unique(feature.sourceFactIds),
      sourceEventIds: unique(feature.sourceEventIds),
    };
    var coefficients = model.linear.coefficients || {};
    var means = model.normalization.means || {};
    var scales = model.normalization.scales || {};
    var weight = coefficients[code];
    var mean = means[code];
    var scale = scales[code];
    if (status === 'KNOWN' || status === 'NOT_APPLICABLE') {
      if (!isFiniteNumber(weight)) throw new Error('TRACE_PROVIDER_COEFFICIENT_MISSING:' + code);
      if (!isFiniteNumber(mean) || !isFiniteNumber(scale) || scale <= 0) {
        throw new Error('TRACE_PROVIDER_NORMALIZATION_MISSING:' + code);
      }
    }

    if (status !== 'KNOWN' && status !== 'NOT_APPLICABLE') {
      // UNKNOWN reaction factors retain their Provider status/reason in the
      // returned audit, while the schema-closed row stays masked and numeric-free.
      return maskedRow(base, status, audit, code, reasonCode);
    }
    if (status === 'KNOWN') {
      var value = feature.value;
      if (!isFiniteNumber(value)) return maskedRow(base, 'UNKNOWN', audit, code, reasonCode || 'NON_FINITE_VALUE');
      var normalized = (value - mean) / scale;
      var contribution = weight * normalized;
      if (!isFiniteNumber(normalized) || !isFiniteNumber(contribution)) {
        throw new Error('TRACE_NON_FINITE_CONTRIBUTION:' + code);
      }
      recordFactorAudit(audit, code, 'KNOWN', reasonCode, contribution);
      return {
        ...base,
        status: 'KNOWN',
        missingMasked: false,
        rawValue: value,
        mean: mean,
        scale: scale,
        normalized: normalized,
        weight: weight,
        contribution: contribution,
      };
    }
    var policy = MISSING_POLICY[code] || { semanticZeroReasons: [] };
    if ((policy.semanticZeroReasons || []).indexOf(reasonCode) !== -1) {
      var z = (0 - mean) / scale;
      var semanticContribution = weight * z;
      if (!isFiniteNumber(z) || !isFiniteNumber(semanticContribution)) {
        throw new Error('TRACE_NON_FINITE_SEMANTIC_ZERO:' + code);
      }
      recordFactorAudit(audit, code, 'NOT_APPLICABLE', reasonCode, semanticContribution);
      return {
        ...base,
        featureId: 'sz::' + code + '::' + reasonCode,
        status: 'NOT_APPLICABLE',
        semanticZero: true,
        missingMasked: false,
        mean: mean,
        scale: scale,
        normalized: z,
        weight: weight,
        contribution: semanticContribution,
      };
    }
    return maskedRow(base, 'NOT_APPLICABLE', audit, code, reasonCode);
  }

  function buildCandidateCore(candidateId, features, model, inputScore) {
    var contributions = [];
    var missingMask = [];
    var seenCodes = new Set();
    var factorAudit = { candidateId: candidateId, factors: [], ignoredCodes: [] };
    (Array.isArray(features) ? features : []).forEach(function (feature) {
      var code = text(feature && feature.featureCode);
      if (NUMERIC_CODE_SET.has(code)) {
        if (seenCodes.has(code)) throw new Error('TRACE_DUPLICATE_PROVIDER_FACTOR:' + candidateId + ':' + code);
        seenCodes.add(code);
      }
      var row = contributionOf(feature, model, factorAudit);
      if (!row) return;
      contributions.push(row);
      if (row.missingMasked === true) missingMask.push(row.featureCode);
    });
    contributions.sort(function (a, b) { return cmpUtf16(a.featureCode, b.featureCode); });
    var score = model.linear.intercept;
    contributions.forEach(function (row) {
      if (row.missingMasked !== true) score += row.contribution;
    });
    var conservationError = 0;
    if (isFiniteNumber(inputScore)) conservationError = Math.abs(inputScore - score);
    var topPositive = contributions
      .filter(function (row) { return row.missingMasked !== true && row.contribution > 0; })
      .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution) || cmpUtf16(a.featureCode, b.featureCode); })
      .map(function (row) { return row.featureId; });
    var topNegative = contributions
      .filter(function (row) { return row.missingMasked !== true && row.contribution < 0; })
      .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution) || cmpUtf16(a.featureCode, b.featureCode); })
      .map(function (row) { return row.featureId; });
    return {
      candidateId: candidateId,
      score: inputScore === undefined ? score : inputScore,
      intercept: model.linear.intercept,
      conservationError: conservationError,
      contributions: contributions,
      missingMask: unique(missingMask),
      topPositive: topPositive,
      topNegative: topNegative,
      _computedScore: score,
      _factorAudit: factorAudit,
    };
  }

  function buildPublicEvidence(features) {
    // ENUM public facts (RELATION_TARGET_SIDE) are carried as non-numeric
    // public evidence only: never a contribution row, never missingMask,
    // never scored, never part of deltas or conservation. UNKNOWN status is
    // carried verbatim so the reason layer can stay honest without guessing.
    var out = [];
    var seen = new Set();
    (Array.isArray(features) ? features : []).forEach(function (feature) {
      if (!ENUM_CODES.has(text(feature.featureCode))) return;
      if (seen.has(text(feature.featureCode))) throw new Error('TRACE_DUPLICATE_PUBLIC_EVIDENCE:' + text(feature.featureCode));
      seen.add(text(feature.featureCode));
      var evidenceStatus = statusOf(feature);
      if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(evidenceStatus) < 0) {
        throw new Error('TRACE_PUBLIC_EVIDENCE_STATUS_INVALID:' + evidenceStatus);
      }
      var entry = {
        featureCode: text(feature.featureCode),
        unitFamily: UNIT_FAMILY[feature.featureCode] || 'ENUM',
        status: evidenceStatus,
      };
      if (entry.status === 'KNOWN' && feature.value !== undefined && feature.value !== null) {
        if (['SELF', 'ALLY', 'ENEMY', 'MIXED'].indexOf(String(feature.value)) < 0) {
          throw new Error('TRACE_PUBLIC_EVIDENCE_VALUE_INVALID:' + String(feature.value));
        }
        entry.rawValue = feature.value;
      }
      out.push(entry);
    });
    out.sort(function (a, b) { return cmpUtf16(a.featureCode, b.featureCode); });
    return out;
  }

  function statusOf(row) {
    if (!row) return 'UNKNOWN';
    return text(row.status).toUpperCase() === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : text(row.status).toUpperCase();
  }
  function realContribution(row) {
    if (!row || row.missingMasked === true) return 0;
    return isFiniteNumber(row.contribution) ? row.contribution : 0;
  }
  function rowByCode(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) { if (row) map[row.featureCode] = row; });
    return map;
  }

  function buildSelection(selectedCore, alternativeCore) {
    if (!alternativeCore) {
      return {
        selectedCandidateId: selectedCore.candidateId,
        reason: 'NO_REAL_ALTERNATIVE',
      };
    }
    var selMap = rowByCode(selectedCore.contributions);
    var altMap = rowByCode(alternativeCore.contributions);
    var union = new Set(Object.keys(selMap).concat(Object.keys(altMap)));
    var deltas = [];
    Array.from(union).sort(cmpUtf16).forEach(function (code) {
      var sel = selMap[code];
      var alt = altMap[code];
      var selContrib = realContribution(sel);
      var altContrib = realContribution(alt);
      var zeroByMask = !sel || !alt || sel.missingMasked === true || alt.missingMasked === true;
      deltas.push({
        featureId: (sel || alt).featureId,
        featureCode: code,
        tacticalConcept: (sel || alt).tacticalConcept,
        deltaContribution: selContrib - altContrib,
        zeroByMask: zeroByMask,
        statusOfSelected: statusOf(sel),
        statusOfAlternative: statusOf(alt),
      });
    });
    var scoreDelta = selectedCore._computedScore - alternativeCore._computedScore;
    var deltaSum = deltas.reduce(function (sum, row) { return sum + row.deltaContribution; }, 0);
    if (Math.abs(scoreDelta - deltaSum) > TOLERANCE) {
      throw new Error('CONSERVATION_FAILED:' + selectedCore.candidateId + ':scoreDelta=' + scoreDelta + ':deltaSum=' + deltaSum);
    }
    return {
      selectedCandidateId: selectedCore.candidateId,
      alternativeCandidateId: alternativeCore.candidateId,
      scoreDelta: scoreDelta,
      deltas: deltas,
      topPositive: deltas.filter(function (row) { return row.deltaContribution > 0; })
        .sort(function (a, b) { return Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution) || cmpUtf16(a.featureCode, b.featureCode); })
        .map(function (row) { return row.featureId; }),
      // failClosed/topByDelta rule: topNegative additionally includes
      // masked-loss zero rows (selected side UNKNOWN, alternative KNOWN).
      topNegative: deltas.filter(function (row) {
        return row.deltaContribution < 0
          || (row.deltaContribution === 0 && row.zeroByMask === true
            && row.statusOfSelected === 'UNKNOWN' && row.statusOfAlternative === 'KNOWN');
      })
        .sort(function (a, b) { return Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution) || cmpUtf16(a.featureCode, b.featureCode); })
        .map(function (row) { return row.featureId; }),
      tieBreak: 'DELTA_ABS_DESC_FEATURECODE_UTF16_ASC',
    };
  }

  function buildHardExclusions(audit) {
    var seen = {};
    var out = [];
    (Array.isArray(audit) ? audit : []).forEach(function (entry) {
      var code = text(entry.code);
      if (!code || seen[code]) return;
      seen[code] = true;
      out.push({
        code: code,
        reasonText: text(entry.reasonText) || HARD_EXCLUSION_TEXT[code] || '不合法',
      });
    });
    return out;
  }

  function buildSourceClosure(selectedCore, alternativeCore) {
    var factIds = [];
    var eventIds = [];
    var realRows = (selectedCore.contributions || []).filter(function (row) { return row.missingMasked !== true; });
    if (alternativeCore) {
      realRows = realRows.concat((alternativeCore.contributions || []).filter(function (row) { return row.missingMasked !== true; }));
    }
    realRows.forEach(function (row) {
      factIds = factIds.concat(row.sourceFactIds || []);
      eventIds = eventIds.concat(row.sourceEventIds || []);
    });
    factIds = unique(factIds);
    eventIds = unique(eventIds);
    var complete = realRows.every(function (row) {
      if (!EFFECT_ROW_CODES.has(row.featureCode)) return true; // candidate-scope rows are exempt
      if (ABSENCE_PROVEN_ZERO_CODES.has(row.featureCode) &&
        row.status === 'KNOWN' && row.rawValue === 0) return true;
      return (row.sourceFactIds && row.sourceFactIds.length > 0) || (row.sourceEventIds && row.sourceEventIds.length > 0);
    });
    return {
      status: complete ? 'COMPLETE' : 'PARTIAL',
      fields: ['status', 'factIds', 'eventIds', 'closureHash'],
      factIds: factIds,
      eventIds: eventIds,
      closureHash: '',
    };
  }

  function canonicalString(value) {
    if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalString).join(',') + ']';
    var keys = Object.keys(value).sort(cmpUtf16);
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalString(value[k]); }).join(',') + '}';
  }
  // Dependency-free synchronous SHA-256 (FIPS 180-4) for sourceClosure hashes.
  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var low = str.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          var cp = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i += 1;
        } else out.push(0xef, 0xbf, 0xbd);
      } else if (code >= 0xd800 && code <= 0xdfff) out.push(0xef, 0xbf, 0xbd);
      else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return out;
  }
  function sha256Hex(input) {
    var cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (cryptoApi && typeof cryptoApi.createHash === 'function') {
      return cryptoApi.createHash('sha256').update(String(input), 'utf8').digest('hex');
    }
    var bytes = utf8Bytes(String(input));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var b = 7; b >= 0; b--) bytes.push((bitLen / Math.pow(2, b * 8)) & 0xff);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64);
      for (var t = 0; t < 16; t++) {
        w[t] = ((bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3]) >>> 0;
      }
      for (var tt = 16; tt < 64; tt++) {
        var s0 = rotr(w[tt - 15], 7) ^ rotr(w[tt - 15], 18) ^ (w[tt - 15] >>> 3);
        var s1 = rotr(w[tt - 2], 17) ^ rotr(w[tt - 2], 19) ^ (w[tt - 2] >>> 10);
        w[tt] = (w[tt - 16] + s0 + w[tt - 7] + s1) >>> 0;
      }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & bb) ^ (a & c) ^ (bb & c);
        var temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = bb; bb = a;
        a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + bb) >>> 0; h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var out = '';
    for (var k = 0; k < 8; k++) out += ('00000000' + h[k].toString(16)).slice(-8);
    return out;
  }

  function hashDocument(document) {
    return sha256Hex(canonicalString(document));
  }

  function buildScoreDecomposition(input) {
    if (!input || !input.model || !input.model.linear || !input.model.normalization) {
      throw new Error('TRACE_MODEL_MISSING');
    }
    var selectedId = text(input.selectedCandidateId);
    if (!selectedId) throw new Error('TRACE_SELECTED_MISSING');
    var featuresByCandidate = input.featuresByCandidate || {};
    var selectedFeatures = featuresByCandidate[selectedId] || [];
    var selectedCore = buildCandidateCore(selectedId, selectedFeatures, input.model, input.score);
    var alternativeId = text(input.alternativeCandidateId);
    var alternativeCore = null;
    if (alternativeId) {
      alternativeCore = buildCandidateCore(alternativeId, featuresByCandidate[alternativeId] || [], input.model, undefined);
    }
    var selection = buildSelection(selectedCore, alternativeCore);
    var topContributions = {
      topPositive: selectedCore.topPositive,
      topNegative: selectedCore.topNegative,
      tieBreak: 'CONTRIBUTION_ABS_DESC_FEATURECODE_UTF16_ASC',
      noneOmitted: true,
    };
    var document = {
      schemaVersion: SCHEMA_VERSION,
      candidateId: selectedId,
      score: selectedCore.score,
      intercept: selectedCore.intercept,
      conservationError: selectedCore.conservationError,
      contributions: selectedCore.contributions,
      missingMask: selectedCore.missingMask,
      selection: selection,
      topContributions: topContributions,
      publicEvidence: buildPublicEvidence(selectedFeatures),
    };
    var hardExclusions = buildHardExclusions(input.hardExclusionAudit);
    if (hardExclusions.length) document.hardExclusions = hardExclusions;
    var sourceClosure = buildSourceClosure(selectedCore, alternativeCore);
    if (sourceClosure.factIds.length || sourceClosure.eventIds.length) {
      sourceClosure.closureHash = sha256Hex(canonicalString({ factIds: sourceClosure.factIds, eventIds: sourceClosure.eventIds }));
    }
    return {
      document: document,
      documentHash: hashDocument(document),
      sourceClosure: sourceClosure,
      factorAudit: {
        selected: selectedCore._factorAudit,
        alternative: alternativeCore ? alternativeCore._factorAudit : null,
      },
      _alternativeCore: alternativeCore,
    };
  }

  function assembleDocument(decomposition, player, review) {
    var doc = JSON.parse(JSON.stringify(decomposition));
    if (player) doc.player = player;
    if (review) doc.review = review;
    return doc;
  }

  function auditConservation(decomposition) {
    var errors = [];
    var computed = decomposition.intercept;
    (decomposition.contributions || []).forEach(function (row) {
      if (row.missingMasked !== true) computed += row.contribution;
    });
    if (Math.abs(decomposition.score - computed) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    if (decomposition.selection && decomposition.selection.deltas) {
      var sum = decomposition.selection.deltas.reduce(function (s, row) { return s + row.deltaContribution; }, 0);
      if (Math.abs(decomposition.selection.scoreDelta - sum) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    }
    return { ok: errors.length === 0, errors: errors, computedScore: computed };
  }

  function validateStructure(decomposition) {
    var errors = [];
    if (!decomposition || typeof decomposition !== 'object' || Array.isArray(decomposition)) return ['DOCUMENT_TYPE'];
    if (decomposition.schemaVersion !== SCHEMA_VERSION) errors.push('SCHEMA_VERSION');
    ['candidateId', 'score', 'intercept', 'conservationError', 'contributions', 'missingMask', 'selection', 'topContributions', 'publicEvidence'].forEach(function (key) {
      if (!(key in decomposition)) errors.push('MISSING_FIELD:' + key);
    });
    var topKeys = new Set(['schemaVersion', 'candidateId', 'score', 'intercept', 'conservationError', 'contributions', 'missingMask', 'hardExclusions', 'selection', 'topContributions', 'player', 'review', 'realizedOutcome', 'publicEvidence']);
    Object.keys(decomposition).forEach(function (key) { if (!topKeys.has(key)) errors.push('TOP_LEVEL_CLOSED:' + key); });
    if (!isFiniteNumber(decomposition.score) || !isFiniteNumber(decomposition.intercept) || !isFiniteNumber(decomposition.conservationError) || decomposition.conservationError < 0 || decomposition.conservationError > TOLERANCE) {
      errors.push('SCORE_SHAPE');
    }
    if (!Array.isArray(decomposition.contributions) || decomposition.contributions.length === 0) errors.push('CONTRIBUTIONS_SHAPE');
    var contributionKeys = new Set(['featureId', 'featureCode', 'unitFamily', 'status', 'tacticalConcept', 'missingMasked', 'sourceFactIds', 'sourceEventIds', 'rawValue', 'mean', 'scale', 'normalized', 'weight', 'contribution', 'semanticZero']);
    var seenCodes = new Set();
    (decomposition.contributions || []).forEach(function (row) {
      if (!row.featureCode || !row.featureId || !row.unitFamily || !row.tacticalConcept) errors.push('CONTRIBUTION_FIELD_MISSING:' + row.featureCode);
      if (!NUMERIC_CODE_SET.has(row.featureCode)) errors.push('CONTRIBUTION_CODE_CLOSED:' + row.featureCode);
      if (seenCodes.has(row.featureCode)) errors.push('CONTRIBUTION_DUPLICATE:' + row.featureCode);
      seenCodes.add(row.featureCode);
      if (row.unitFamily !== UNIT_FAMILY[row.featureCode]) errors.push('CONTRIBUTION_UNIT:' + row.featureCode);
      if (row.tacticalConcept !== TACTICAL_CONCEPT[row.featureCode]) errors.push('CONTRIBUTION_CONCEPT:' + row.featureCode);
      if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(row.status) < 0) errors.push('CONTRIBUTION_STATUS:' + row.featureCode);
      if (row.status === 'NOT_APPLICABLE' && (REACTION_CODES.has(row.featureCode) || row.featureCode === 'PUBLIC_RECIPIENT_NEED_MATCH')) errors.push('PROVIDER_REQUIRED_KNOWN:' + row.featureCode);
      if (typeof row.missingMasked !== 'boolean') errors.push('CONTRIBUTION_MASK:' + row.featureCode);
      Object.keys(row).forEach(function (key) { if (!contributionKeys.has(key)) errors.push('CONTRIBUTION_CLOSED:' + row.featureCode + ':' + key); });
      if (!Array.isArray(row.sourceFactIds) || !Array.isArray(row.sourceEventIds)) errors.push('CONTRIBUTION_SOURCE:' + row.featureCode);
      if (row.status === 'KNOWN') {
        ['rawValue', 'mean', 'scale', 'normalized', 'weight', 'contribution'].forEach(function (key) { if (!isFiniteNumber(row[key])) errors.push('KNOWN_NUMERIC:' + row.featureCode + ':' + key); });
        if (row.missingMasked !== false || row.semanticZero === true) errors.push('KNOWN_MASK:' + row.featureCode);
      } else if (row.status === 'NOT_APPLICABLE' && row.semanticZero === true) {
        if (row.missingMasked !== false || row.featureId.indexOf('sz::' + row.featureCode + '::') !== 0) errors.push('SEMANTIC_ZERO_SHAPE:' + row.featureCode);
        if ('rawValue' in row) errors.push('SEMANTIC_ZERO_RAWVALUE:' + row.featureCode);
        ['mean', 'scale', 'normalized', 'weight', 'contribution'].forEach(function (key) { if (!isFiniteNumber(row[key])) errors.push('SEMANTIC_ZERO_NUMERIC:' + row.featureCode + ':' + key); });
      } else {
        if (row.missingMasked !== true) errors.push('MASKED_STATUS:' + row.featureCode);
        ['rawValue', 'mean', 'scale', 'normalized', 'weight', 'contribution', 'semanticZero'].forEach(function (key) { if (key in row) errors.push('MASKED_NUMERIC:' + row.featureCode + ':' + key); });
      }
    });
    if (!Array.isArray(decomposition.missingMask)) errors.push('MISSING_MASK_SHAPE');
    var maskCodes = new Set();
    (decomposition.missingMask || []).forEach(function (code) {
      if (!NUMERIC_CODE_SET.has(code)) errors.push('MISSING_MASK_CODE:' + code);
      if (maskCodes.has(code)) errors.push('MISSING_MASK_DUPLICATE:' + code);
      maskCodes.add(code);
      var row = (decomposition.contributions || []).find(function (item) { return item.featureCode === code; });
      if (!row || row.missingMasked !== true) errors.push('MISSING_MASK_NOT_MASKED:' + code);
    });
    if (!Array.isArray(decomposition.publicEvidence)) errors.push('PUBLIC_EVIDENCE_SHAPE');
    var publicSeen = new Set();
    (decomposition.publicEvidence || []).forEach(function (entry) {
      if (publicSeen.has(entry.featureCode)) errors.push('PUBLIC_EVIDENCE_DUPLICATE:' + entry.featureCode);
      publicSeen.add(entry.featureCode);
      if (entry.featureCode !== 'RELATION_TARGET_SIDE' || entry.unitFamily !== 'ENUM') errors.push('PUBLIC_EVIDENCE_CODE:' + entry.featureCode);
      if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(entry.status) < 0) errors.push('PUBLIC_EVIDENCE_STATUS:' + entry.featureCode);
      if (entry.status === 'KNOWN' && ['SELF', 'ALLY', 'ENEMY', 'MIXED'].indexOf(entry.rawValue) < 0) errors.push('PUBLIC_EVIDENCE_VALUE:' + entry.featureCode);
      if (entry.status !== 'KNOWN' && 'rawValue' in entry) errors.push('PUBLIC_EVIDENCE_MASKED_RAW:' + entry.featureCode);
    });
    var deltaKeys = new Set(['featureId', 'featureCode', 'tacticalConcept', 'deltaContribution', 'zeroByMask', 'statusOfSelected', 'statusOfAlternative']);
    if (decomposition.selection && Array.isArray(decomposition.selection.deltas)) {
      var deltaCodes = new Set();
      decomposition.selection.deltas.forEach(function (delta) {
        Object.keys(delta).forEach(function (key) { if (!deltaKeys.has(key)) errors.push('DELTA_CLOSED:' + key); });
        if (!NUMERIC_CODE_SET.has(delta.featureCode)) errors.push('DELTA_CODE_CLOSED:' + delta.featureCode);
        if (deltaCodes.has(delta.featureCode)) errors.push('DELTA_DUPLICATE:' + delta.featureCode);
        deltaCodes.add(delta.featureCode);
        if (!isFiniteNumber(delta.deltaContribution) || typeof delta.zeroByMask !== 'boolean') errors.push('DELTA_SHAPE:' + delta.featureCode);
        if (delta.tacticalConcept !== TACTICAL_CONCEPT[delta.featureCode]) errors.push('DELTA_CONCEPT:' + delta.featureCode);
      });
    }
    return errors;
  }

  function runSelfCheck() {
    var checks = [];
    function check(name, passed, detail) { checks.push({ name: name, passed: !!passed, detail: detail || '' }); }
    var model = {
      normalization: {
        means: { DAMAGE_POWER: 3, PUBLIC_HP_RATIO: 0.5, STATE_DURATION: 0, REACTION_DAMAGE_MULTIPLIER: 0.8, REACTION_DODGE_PROBABILITY: 0.1 },
        scales: { DAMAGE_POWER: 4, PUBLIC_HP_RATIO: 0.25, STATE_DURATION: 1, REACTION_DAMAGE_MULTIPLIER: 0.2, REACTION_DODGE_PROBABILITY: 0.1 },
      },
      linear: { coefficients: { DAMAGE_POWER: 0.4, PUBLIC_HP_RATIO: 0.5, STATE_DURATION: 0.2, REACTION_DAMAGE_MULTIPLIER: 0.3, REACTION_DODGE_PROBABILITY: -0.4 }, intercept: 0.1 },
    };
    var features = {
      'a': [
        { featureCode: 'DAMAGE_POWER', status: 'KNOWN', value: 12, unitFamily: 'POWER', sourceFactIds: ['effect:a:0'] },
        { featureCode: 'PUBLIC_HP_RATIO', status: 'KNOWN', value: 0.3, unitFamily: 'RATIO_0_1', sourceFactIds: ['visible:hp'] },
        { featureCode: 'STATE_DURATION', status: 'NOT_APPLICABLE', reasonCode: 'NO_DURATION', unitFamily: 'TURNS', sourceEventIds: ['evt:0'] },
        { featureCode: 'RELATION_TARGET_SIDE', status: 'KNOWN', value: 'ENEMY', unitFamily: 'ENUM' },
        { featureCode: 'SETTLEMENT_DAMAGE', status: 'UNKNOWN', reasonCode: 'FINAL_SETTLEMENT_UNKNOWN', unitFamily: 'ABS' },
        { featureCode: 'TARGET_CHARGE_ACTIVE', status: 'KNOWN', value: 1, unitFamily: 'BOOL' },
        { featureCode: 'REACTION_DAMAGE_MULTIPLIER', status: 'KNOWN', value: 0.9, unitFamily: 'RATIO_0_1', sourceEventIds: ['reaction:evt'] },
        { featureCode: 'REACTION_DODGE_PROBABILITY', status: 'KNOWN', value: 0.2, unitFamily: 'PROBABILITY_0_1', sourceEventIds: ['reaction:evt'] },
      ],
      'b': [
        { featureCode: 'DAMAGE_POWER', status: 'KNOWN', value: 4, unitFamily: 'POWER', sourceFactIds: ['effect:b:0'] },
        { featureCode: 'PUBLIC_HP_RATIO', status: 'UNKNOWN', unitFamily: 'RATIO_0_1' },
        { featureCode: 'REACTION_DAMAGE_MULTIPLIER', status: 'UNKNOWN', reasonCode: 'SOURCE_PROVENANCE_INCOMPLETE', unitFamily: 'RATIO_0_1' },
        { featureCode: 'REACTION_DODGE_PROBABILITY', status: 'UNKNOWN', reasonCode: 'SOURCE_PROVENANCE_INCOMPLETE', unitFamily: 'PROBABILITY_0_1' },
      ],
    };
    var built = buildScoreDecomposition({ model: model, selectedCandidateId: 'a', alternativeCandidateId: 'b', featuresByCandidate: features });
    var doc = built.document;
    var expectedScore = 0.1 + 0.4 * ((12 - 3) / 4) + 0.5 * ((0.3 - 0.5) / 0.25) + 0.2 * ((0 - 0) / 1)
      + 0.3 * ((0.9 - 0.8) / 0.2) - 0.4 * ((0.2 - 0.1) / 0.1);
    check('score_conserved', Math.abs(doc.score - expectedScore) <= TOLERANCE, 'score=' + doc.score);
    check('numeric_whitelist_exact_32', NUMERIC_CODES.length === 32 && new Set(NUMERIC_CODES).size === 32 && NUMERIC_CODES.every(function (code) { return NUMERIC_CODE_SET.has(code) && !ENUM_CODES.has(code); }));
    check('enum_row_omitted', doc.contributions.every(function (row) { return row.featureCode !== 'RELATION_TARGET_SIDE'; }));
    check('public_evidence_required', Array.isArray(doc.publicEvidence));
    check('enum_only_in_public_evidence', (doc.publicEvidence || []).some(function (e) { return e.featureCode === 'RELATION_TARGET_SIDE' && e.status === 'KNOWN' && e.rawValue === 'ENEMY'; }));
    check('enum_never_in_mask_or_delta', doc.missingMask.indexOf('RELATION_TARGET_SIDE') === -1 && (doc.selection.deltas || []).every(function (d) { return d.featureCode !== 'RELATION_TARGET_SIDE'; }));
    check('catalog_and_transport_excluded', doc.contributions.every(function (row) { return !EXCLUDED_INPUT_CODES.has(row.featureCode); })
      && doc.missingMask.every(function (code) { return !EXCLUDED_INPUT_CODES.has(code); })
      && (doc.selection.deltas || []).every(function (row) { return !EXCLUDED_INPUT_CODES.has(row.featureCode); }));
    check('reaction_units_concepts', doc.contributions.filter(function (row) { return REACTION_CODES.has(row.featureCode); }).every(function (row) {
      return row.unitFamily === UNIT_FAMILY[row.featureCode] && row.tacticalConcept === TACTICAL_CONCEPT[row.featureCode];
    }));
    check('unknown_reaction_zero_status_reason', built.factorAudit.alternative.factors.filter(function (row) { return REACTION_CODES.has(row.featureCode); }).every(function (row) {
      return row.status === 'UNKNOWN' && row.reasonCode === 'SOURCE_PROVENANCE_INCOMPLETE' && row.contribution === 0;
    }));
    var naRejected = false;
    try {
      buildScoreDecomposition({ model: model, selectedCandidateId: 'na', featuresByCandidate: { na: [{ featureCode: 'REACTION_DAMAGE_MULTIPLIER', status: 'NOT_APPLICABLE', reasonCode: 'NO_HIT_AXIS' }] } });
    } catch (error) { naRejected = String(error && error.message || error).indexOf('TRACE_REACTION_NOT_APPLICABLE') === 0; }
    check('reaction_na_fail_closed', naRejected);
    check('semantic_zero_present', doc.contributions.some(function (row) { return row.featureCode === 'STATE_DURATION' && row.semanticZero === true && row.missingMasked === false && row.featureId === 'sz::STATE_DURATION::NO_DURATION'; }));
    check('delta_zero_by_mask', doc.selection.deltas.some(function (row) { return row.featureCode === 'PUBLIC_HP_RATIO' && row.zeroByMask === true; }));
    check('conservation_audit', auditConservation(doc).ok);
    check('structure_closed', validateStructure(doc).length === 0, validateStructure(doc).join(','));
    check('top_positive_first', doc.topContributions.topPositive[0] === 'c::DAMAGE_POWER');
    check('no_alternative_branch', buildScoreDecomposition({ model: model, selectedCandidateId: 'a', featuresByCandidate: features }).document.selection.reason === 'NO_REAL_ALTERNATIVE');
    check('hard_exclusions', buildScoreDecomposition({
      model: model, selectedCandidateId: 'a', featuresByCandidate: features,
      hardExclusionAudit: [{ candidateId: 'c', code: 'RESOURCE_INSUFFICIENT' }],
    }).document.hardExclusions[0].reasonText === '资源不足');
    var passed = checks.every(function (c) { return c.passed; });
    return { schemaVersion: SCHEMA_VERSION, role: 'CONTRIBUTION_TRACE', passed: passed, checks: checks };
  }

  var api = {
    buildScoreDecomposition: buildScoreDecomposition,
    assembleDocument: assembleDocument,
    auditConservation: auditConservation,
    validateStructure: validateStructure,
    hashDocument: hashDocument,
    numericCodes: NUMERIC_CODES.slice(),
    publicEvidenceCodes: ['RELATION_TARGET_SIDE'],
    excludedInputCodes: Array.from(EXCLUDED_INPUT_CODES).sort(cmpUtf16),
    missingPolicy: JSON.parse(JSON.stringify(MISSING_POLICY)),
    tolerance: TOLERANCE,
    selfCheck: runSelfCheck,
  };
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

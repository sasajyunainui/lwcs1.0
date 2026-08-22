// BehaviorChineseReason_Module.js
// M2/Task6 Chinese reason renderer: turns a DecisionContributionTraceV1
// decomposition into 1..8 player-facing Chinese sentences (SITUATION -> FACTS
// -> SUPPORT -> DIFFERENTIATION -> RISK_COST -> CONCLUSION) with traceRefs,
// spoken numbers with units, and a report mapping (selectionReason,
// tradeoffs, alternatives, narrowing, predictedNumbers; futurePoolTradeoffs
// is always empty). UNKNOWN is never spoken as zero; no hidden information,
// no teacher/route/future fields, no post-hoc rationalization.
(function () {
  'use strict';

  var SCHEMA_VERSION = 'DecisionContributionTraceV1';
  var SKELETON = ['SITUATION', 'FACTS', 'SUPPORT', 'DIFFERENTIATION', 'RISK_COST'];
  var MOUNT_NAME = '__LWCS_BEHAVIOR_CHINESE_REASON__';
  var TOLERANCE = 1e-12;

  var FORBIDDEN_TOKENS = [
    'weight', '权重', 'score', '分数', 'featureCode', 'HEPP', 'Pareto', '帕累托',
    'candidateId', 'sourceEffectId', 'seed', 'actualValue', 'normalized', 'mean',
    'scale', 'intercept', 'contribution', 'tacticalConcept', 'alpha', 'lambda',
    'margin', 'frontier', 'band', '线性', '系数', 'z-score', 'zscore', 'rank',
    'coefficient', '依赖键', 'routeKey', 'dependencyKey', '候选编号', '评分',
    '觉得', '想要', '看穿', '预判', '赌一把', '谨慎', '试探', '破绽', '内心',
  ];
  var EFFECT_ROW_CODES = new Set([
    'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE',
    'STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT', 'RESOURCE_DELTA',
    'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'SUMMON_COUNT',
    'SUMMON_STRENGTH', 'SUMMON_DURATION', 'SETTLEMENT_MODIFIER_PERCENT',
    'OUTSIDE_BATCH1_ROW_COUNT',
  ]);
  // Mirrors BehaviorContributionTrace_Module: only count rows whose KNOWN 0 is
  // an absence proven by full enumeration of the closed input scope may skip
  // SOURCE_MISSING; empty-source KNOWN rows for other codes stay fail-closed.
  var ABSENCE_PROVEN_ZERO_CODES = new Set(['OUTSIDE_BATCH1_ROW_COUNT']);
  var RISK_COST_ALLOW = new Set(['SUCCESS_PROBABILITY', 'COST_AFFORDABILITY', 'RESOURCE_DELTA',
    'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE']);
  var SUPPORT_DENY = new Set(['SUCCESS_PROBABILITY', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE']);
  // R2/R3: observed ratios describe the current public state (target or
  // declaration), not an effect of this hand; they never ground a
  // benefit/advantage claim and keep a neutral subject without KNOWN side.
  var OBSERVED_RATIO_CODES = new Set(['PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'REVEAL_STRENGTH']);

  var RATIO_WORDS = ['零', '半成', '一成', '一成半', '两成', '两成半', '三成', '三成半', '四成', '四成半',
    '五成', '五成半', '六成', '六成半', '七成', '七成半', '八成', '八成半', '九成', '九成半', '满'];
  var CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  function cmpUtf16(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function text(v) { return v === undefined || v === null ? '' : String(v); }
  function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }

  function stableVariant(key, variants) {
    var hash = 2166136261;
    var source = text(key);
    for (var i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0;
    return variants[hash % variants.length];
  }

  function cnInt(n) {
    n = Math.round(n);
    if (!isFiniteNumber(n)) return String(n);
    if (n < 0) return '负' + cnInt(-n);
    if (n < 10) return CN_DIGITS[n];
    if (n < 100) {
      var tens = Math.floor(n / 10);
      var ones = n % 10;
      return (tens === 1 ? '' : CN_DIGITS[tens]) + '十' + (ones === 0 ? '' : CN_DIGITS[ones]);
    }
    if (n < 1000) {
      var h = Math.floor(n / 100);
      var rest = n % 100;
      return CN_DIGITS[h] + '百' + (rest === 0 ? '' : rest < 10 ? '零' + CN_DIGITS[rest] : cnInt(rest));
    }
    return String(n);
  }

  function cnDecimal(v) {
    var rounded = Math.round(v * 10) / 10;
    var whole = Math.floor(Math.abs(rounded));
    var frac = Math.round((Math.abs(rounded) - whole) * 10);
    var prefix = v < 0 ? '负' : '';
    if (frac === 0) return prefix + cnInt(whole);
    return prefix + cnInt(whole) + '点' + CN_DIGITS[frac];
  }

  function spoken(value, unitFamily) {
    if (!isFiniteNumber(value)) return '';
    if (unitFamily === 'RATIO_0_1' || unitFamily === 'PROBABILITY_0_1') {
      var idx = Math.max(0, Math.min(20, Math.round(value * 20)));
      return RATIO_WORDS[idx];
    }
    if (unitFamily === 'PERCENT') {
      var pct = Math.abs(value) <= 1 ? value : value / 100;
      var neg = pct < 0 ? '负' : '';
      var pidx = Math.max(0, Math.min(20, Math.round(Math.abs(pct) * 20)));
      return neg + RATIO_WORDS[pidx];
    }
    if (unitFamily === 'POWER') {
      var powerIndex = Math.max(0, Math.min(20, Math.round(value / 5)));
      return RATIO_WORDS[powerIndex];
    }
    if (unitFamily === 'COUNT') return cnInt(value) + '段';
    if (unitFamily === 'TURNS') return cnInt(value) + '回合';
    if (unitFamily === 'ABS') return cnInt(value) + '点';
    if (unitFamily === 'BOOL') return value ? '有' : '无';
    return cnDecimal(value);
  }

  function unitWords(unitFamily) {
    if (unitFamily === 'RATIO_0_1' || unitFamily === 'PROBABILITY_0_1' || unitFamily === 'PERCENT') return ['成', '半', '满'];
    if (unitFamily === 'POWER') return ['成', '半', '满'];
    if (unitFamily === 'COUNT') return ['段', '次', '个', '点', '层'];
    if (unitFamily === 'TURNS') return ['回合'];
    if (unitFamily === 'ABS') return ['点', '血', '魂力', '资源', '精力'];
    if (unitFamily === 'BOOL') return ['有', '无', '层'];
    return [];
  }

  var CONCEPT_BY_CODE = {
    RELATION_TARGET_COUNT: '目标推进', RELATION_TARGET_SIDE: '目标推进',
    SUCCESS_PROBABILITY: '风险', PUBLIC_HP_RATIO: '生存', PUBLIC_RESOURCE_RATIO: '资源',
    COST_AFFORDABILITY: '代价', REVEAL_STRENGTH: '信息', OVERKILL_AVAILABILITY: '机会',
    HARD_EXCLUSION: '风险', HARD_EXCLUSION_REASON: '风险', SETTLEMENT_DAMAGE: '风险',
    ROLL_REALIZATION: '风险', OUTSIDE_BATCH1_ROW_COUNT: '机会',
    DAMAGE_POWER: '伤害压力', DAMAGE_SEGMENTS: '伤害压力', DAMAGE_PENETRATION: '伤害压力',
    DAMAGE_TYPE: '伤害压力', RESOURCE_DELTA: '资源', SHIELD_DELTA: '防御',
    ATTRIBUTE_DELTA: '防御', JUDGMENT_DELTA: '风险', STATE_PRESENCE: '控制',
    STATE_DURATION: '控制', STATE_DELTA_PERCENT: '控制', SETTLEMENT_MODIFIER_PERCENT: '风险',
    SUMMON_COUNT: '机会', SUMMON_STRENGTH: '机会', SUMMON_DURATION: '机会',
    RESOURCE_DELTA_PERCENT: '资源', TEAM_EFFECT_MARGINAL_GAIN: '控制',
    TEAM_EFFECT_REDUNDANCY_RATIO: '控制', RESOURCE_DEFICIT_COVERAGE: '资源',
    RESOURCE_CONSUMER_FIT: '资源', TEAM_FOLLOWUP_COVERAGE: '机会',
    PUBLIC_RECIPIENT_NEED_MATCH: '资源',
  };
  var DISPLAY_NAME = {
    SUCCESS_PROBABILITY: '命中把握', DAMAGE_POWER: '威力', DAMAGE_SEGMENTS: '段数',
    DAMAGE_PENETRATION: '穿透', PUBLIC_HP_RATIO: '当前目标血线', PUBLIC_RESOURCE_RATIO: '当前目标资源余量',
    COST_AFFORDABILITY: '消耗承受度', RESOURCE_DELTA: '资源变化', RESOURCE_DELTA_PERCENT: '资源变化比例',
    STATE_DURATION: '控制持续', STATE_PRESENCE: '控制状态', STATE_DELTA_PERCENT: '状态变化',
    JUDGMENT_DELTA: '判定修正', SETTLEMENT_MODIFIER_PERCENT: '结算修正',
    REVEAL_STRENGTH: '暴露强度', OVERKILL_AVAILABILITY: '过量击杀空间',
    SUMMON_COUNT: '召唤数量', SUMMON_STRENGTH: '召唤强度', SUMMON_DURATION: '召唤持续',
    OUTSIDE_BATCH1_ROW_COUNT: '额外行动行数', RELATION_TARGET_COUNT: '可推进目标数',
    RELATION_TARGET_SIDE: '目标方', PUBLIC_RECIPIENT_NEED_MATCH: '恢复匹配度',
    TEAM_EFFECT_MARGINAL_GAIN: '团队边际收益', TEAM_EFFECT_REDUNDANCY_RATIO: '团队效果重叠',
    RESOURCE_DEFICIT_COVERAGE: '资源缺口覆盖', RESOURCE_CONSUMER_FIT: '资源消费匹配',
    TEAM_FOLLOWUP_COVERAGE: '后续跟进覆盖',
    REACTION_DAMAGE_MULTIPLIER: '预计承伤比例', REACTION_DODGE_PROBABILITY: '预计闪避把握',
  };
  var PLAYER_CONCEPT = {
    目标推进: '目标推进', 伤害压力: '伤害', 控制: '控制', 防御: '防御',
    资源: '资源', 代价: '消耗', 风险: '风险', 生存: '生存', 机会: '行动机会', 信息: '公开信息',
  };
  var UNKNOWN_LABEL = {
    SUCCESS_PROBABILITY: '命中把握', COST_AFFORDABILITY: '具体消耗', RESOURCE_DELTA: '资源变化',
    PUBLIC_RESOURCE_RATIO: '目标资源余量', PUBLIC_HP_RATIO: '目标血线',
  };

  function reasonKey(decomposition, context, featureCode, slot) {
    return [context.decisionKey, decomposition.candidateId, context.selectedName,
      context.alternativeName, featureCode, slot].map(text).join('|');
  }

  function conceptReason(concept, key, comparison) {
    if (comparison && !PLAYER_CONCEPT[concept]) return stableVariant(key, [
      '综合现有公开信息，这一手更合适。',
      '相比另一手，当前公开比较更支持这一手。',
      '两者相比，这一步的整体取舍更占优。',
      '这一手在当前公开比较中更占优。',
    ]);
    var label = PLAYER_CONCEPT[concept] || '当前取舍';
    return stableVariant(key, comparison ? [
      '这一手在' + label + '上更合适。',
      '相比另一手，当前公开比较在' + label + '方面更支持这一手。',
      '两者相比，这一步在' + label + '上更占优。',
      '这一手的主要优势体现在' + label + '上。',
    ] : [
      '这一手的主要价值在' + label + '上。',
      '当前公开信息里，这一步的' + label + '收益更突出。',
      '这一手的优势主要体现在' + label + '上。',
      '按当前公开信息，这一步在' + label + '上更合适。',
    ]);
  }

  function unknownReason(featureCode, key, selectedName) {
    var label = UNKNOWN_LABEL[featureCode] || (PLAYER_CONCEPT[CONCEPT_BY_CODE[featureCode]] || '具体情况');
    var action = text(selectedName);
    if (!action || action.length > 36) action = '这一手';
    return stableVariant(key, [
      '当时公开信息不足以判断这一手的' + label + '。',
      action + '的' + label + '，当时还无法确认。',
      '现有公开信息无法确定这一步的' + label + '。',
      '关于' + action + '的' + label + '，当时还没有足够公开信息。',
      '公开信息没有给出足以确定' + label + '的依据。',
      '就当时已知内容而言，这一步的' + label + '仍不确定。',
    ]);
  }

  function rowByCode(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) { if (row && row.featureCode) map[row.featureCode] = row; });
    return map;
  }
  function rowById(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) { if (row && row.featureId) map[row.featureId] = row; });
    return map;
  }

  // R1: a delta row may ground a concrete DIFFERENTIATION only when both
  // sides are KNOWN and the delta is not a mask artifact. UNKNOWN/PARTIAL/
  // NOT_APPLICABLE sides and zeroByMask rows never become a definite
  // selected-vs-alternative advantage claim.
  function isReliableDelta(d) {
    return !!d && d.zeroByMask !== true
      && text(d.statusOfSelected) === "KNOWN"
      && text(d.statusOfAlternative) === "KNOWN"
      && isFiniteNumber(d.deltaContribution);
  }

  // R2/R4b3: RELATION_TARGET_SIDE is carried by the DCT publicEvidence
  // container (non-numeric public evidence), never by contribution rows.
  // SELF/ALLY/ENEMY/MIXED map to honest labels; UNKNOWN/absent stays neutral
  // and is never guessed.
  function sideEvidenceEntry(decomposition) {
    var ev = decomposition && Array.isArray(decomposition.publicEvidence) ? decomposition.publicEvidence : [];
    var row = null;
    ev.forEach(function (e) { if (e && text(e.featureCode) === 'RELATION_TARGET_SIDE') row = e; });
    return row;
  }
  function sidePhrase(row, neutral) {
    if (!row || text(row.status) !== 'KNOWN') return neutral;
    var side = text(row.rawValue).toUpperCase();
    if (side === 'ENEMY') return '对方主力';
    if (side === 'ALLY' || side === 'SELF') return '我方单位';
    if (side === 'MIXED') return '当前目标';
    return neutral;
  }

  function buildPlayerReasons(decomposition, context) {
    if (!decomposition || decomposition.schemaVersion !== SCHEMA_VERSION) throw new Error('REASON_TRACE_VERSION');
    context = context || {};
    var selectedName = text(context.selectedName);
    var alternativeName = text(context.alternativeName);
    var rows = (decomposition.contributions || []).slice();
    var byCode = rowByCode(rows);
    var real = rows.filter(function (row) { return row.missingMasked !== true; });
    var pos = real.filter(function (row) { return row.contribution > 0; })
      .sort(function (a, b) { return b.contribution - a.contribution || cmpUtf16(a.featureCode, b.featureCode); });
    var neg = real.filter(function (row) { return row.contribution < 0; })
      .sort(function (a, b) { return a.contribution - b.contribution || cmpUtf16(a.featureCode, b.featureCode); });
    var masked = rows.filter(function (row) { return row.missingMasked === true; });
    var sentences = [];

    function push(kind, textLine, refs, connective) {
      var s = { kind: kind, text: textLine, traceRefs: refs };
      if (connective) s.connective = connective;
      sentences.push(s);
    }

    // SITUATION: public, observable, decision-time only.
    var sideRow = sideEvidenceEntry(decomposition);
    var hp = byCode.PUBLIC_HP_RATIO;
    if (hp && hp.status === 'KNOWN' && isFiniteNumber(hp.rawValue) && hp.rawValue <= 0.4) {
      var hpPhrase = sidePhrase(sideRow, '当前目标') + '血线只剩';
      push('SITUATION', hpPhrase + spoken(hp.rawValue, 'RATIO_0_1') + '。', ['c::PUBLIC_HP_RATIO']);
    } else if (byCode.PUBLIC_RESOURCE_RATIO && byCode.PUBLIC_RESOURCE_RATIO.status === 'KNOWN'
      && isFiniteNumber(byCode.PUBLIC_RESOURCE_RATIO.rawValue) && byCode.PUBLIC_RESOURCE_RATIO.rawValue <= 0.4) {
      var resourcePhrase = sidePhrase(sideRow, '当前目标') + '资源余量只剩';
      push('SITUATION', resourcePhrase + spoken(byCode.PUBLIC_RESOURCE_RATIO.rawValue, 'RATIO_0_1') + '。', ['c::PUBLIC_RESOURCE_RATIO']);
    }

    // FACTS / SUPPORT: concrete public facts and the main gains of this hand.
    var factsDone = false;
    var supportDone = false;
    for (var i = 0; i < pos.length && !supportDone; i++) {
      var row = pos[i];
      var code = row.featureCode;
      var factLine = '';
      if (code === 'DAMAGE_SEGMENTS' && isFiniteNumber(row.rawValue) && row.rawValue > 1) {
        var pen = byCode.DAMAGE_PENETRATION;
        factLine = '这一手' + spoken(row.rawValue, 'COUNT') + '攻击' + (pen && pen.status === 'KNOWN' && isFiniteNumber(pen.rawValue)
          ? '、每段' + spoken(pen.rawValue, 'PERCENT') + '穿透' : '') + '。';
        push('SUPPORT', factLine, ['c::' + code].concat(pen ? ['c::DAMAGE_PENETRATION'] : []));
        supportDone = true;
      } else if (code === 'DAMAGE_POWER' && isFiniteNumber(row.rawValue)) {
        var power = spoken(row.rawValue, 'POWER');
        var powerLevel = power === '满' ? '满档' : power;
        factLine = stableVariant(reasonKey(decomposition, context, code, 'support'), [
          '这一手的公开威力约为' + powerLevel + '。',
          '按当时公开数据，这一手的威力约为' + powerLevel + '。',
          '这一手的公开威力处在' + powerLevel + '左右。',
          '就当时可见的数据而言，这一手约有' + powerLevel + '的威力。',
        ]);
        push('SUPPORT', factLine, ['c::DAMAGE_POWER']);
        supportDone = true;
      } else if (code === 'STATE_DURATION' && isFiniteNumber(row.rawValue) && row.rawValue > 0) {
        factLine = '这一手能压住对方' + spoken(row.rawValue, 'TURNS') + '。';
        push('SUPPORT', factLine, ['c::STATE_DURATION']);
        supportDone = true;
      } else if (code === 'SUMMON_COUNT' && isFiniteNumber(row.rawValue) && row.rawValue > 0) {
        factLine = '这一手会召出' + cnInt(row.rawValue) + '个召唤物。';
        push('SUPPORT', factLine, ['c::SUMMON_COUNT']);
        supportDone = true;
      } else if (code === 'PUBLIC_RECIPIENT_NEED_MATCH' && isFiniteNumber(row.rawValue) && row.rawValue > 0) {
        factLine = '这一手正好补上目标的恢复缺口。';
        push('SUPPORT', factLine, ['c::PUBLIC_RECIPIENT_NEED_MATCH']);
        supportDone = true;
      }
      if (factLine && !factsDone && i === 0) {
        // First positive fact doubles as the FACTS frame when no situation was emitted.
        factsDone = true;
      }
    }
    if (sentences.length === 0 || sentences.every(function (s) { return s.kind === 'SITUATION'; })) {
      var top = pos.find(function (row) { return !SUPPORT_DENY.has(row.featureCode) && !OBSERVED_RATIO_CODES.has(row.featureCode); }) || null;
      // R3: a KNOWN 0 OUTSIDE_BATCH1_ROW_COUNT is absence evidence, not an
      // opportunity gain; never phrase it as a positive benefit.
      while (top && top.featureCode === 'OUTSIDE_BATCH1_ROW_COUNT'
        && text(top.status) === 'KNOWN' && Number(top.rawValue) === 0) {
        var idx = pos.indexOf(top);
        top = pos.slice(idx + 1).find(function (row) { return !SUPPORT_DENY.has(row.featureCode) && !OBSERVED_RATIO_CODES.has(row.featureCode); }) || null;
      }
      if (top) {
        var concept = CONCEPT_BY_CODE[top.featureCode] || '目标推进';
        push('SUPPORT', conceptReason(concept,
          reasonKey(decomposition, context, top.featureCode, 'support'), false), [top.featureId]);
      }
    }

    // DIFFERENTIATION: concrete selected-vs-alternative advantage only.
    var selection = decomposition.selection || {};
    var deltaRefs = new Set((selection.deltas || []).map(function (d) { return d.featureId; }));
    var scoreDelta = Number(selection.scoreDelta);
    var isTie = !!selection.alternativeCandidateId && isFiniteNumber(scoreDelta)
      && Math.abs(scoreDelta) <= TOLERANCE;
    if (selection.deltas && selection.deltas.length && selection.alternativeCandidateId) {
      // R1: only reliable deltas (both sides KNOWN, not zeroByMask) may ground
      // a definite advantage claim.
      var positiveDelta = (selection.deltas || []).filter(function (d) { return isReliableDelta(d) && d.deltaContribution > 0 && !OBSERVED_RATIO_CODES.has(d.featureCode); })
        .sort(function (a, b) { return b.deltaContribution - a.deltaContribution || cmpUtf16(a.featureCode, b.featureCode); });
      var neutralRef = (selection.deltas || []).length ? 'DELTA:' + selection.deltas[0].featureId : null;
      // R4: a formal tie (scoreDelta ~= 0) is disclosed honestly even when
      // reliable positive deltas exist; a tie never grounds a one-sided
      // "另一手没这么足/这手更划算" edge claim.
      if (isTie) {
        var tieText = stableVariant(reasonKey(decomposition, context, 'FORMAL_TIE', 'comparison'), selectedName ? [
          '公开信息下两手差异不明显，实际选择' + selectedName + '。',
          '按当时公开比较，两手接近，本次选择' + selectedName + '。',
          '两项方案在公开比较中没有拉开差距，实际选择' + selectedName + '。',
          '当时公开信息无法分出明显高下，本次选择' + selectedName + '。',
        ] : [
          '公开信息下两手差异不明显。',
          '按当时公开比较，两手较为接近。',
          '两项方案在公开比较中没有拉开差距。',
          '当时公开信息无法分出明显高下。',
        ]);
        push('DIFFERENTIATION', tieText, neutralRef ? [neutralRef] : []);
      } else if (positiveDelta.length) {
        var dRow = positiveDelta[0];
        var dText = '';
        if (dRow.featureCode === 'DAMAGE_POWER') dText = stableVariant(
          reasonKey(decomposition, context, dRow.featureCode, 'comparison'), [
            '另一手伤害没这么足。',
            '相比另一手，这一步的伤害更占优。',
            '两者相比，这一手的伤害优势更明显。',
            '当前公开的伤害差异更支持这一手。',
          ]);
        else if (dRow.featureCode === 'SUCCESS_PROBABILITY') dText = '另一手要赌命中，这手不用。';
        else if (dRow.featureCode === 'COST_AFFORDABILITY') dText = '另一手消耗更紧。';
        else if (dRow.featureCode === 'STATE_DURATION') dText = '另一手控不了这么久。';
        else if (dRow.featureCode === 'PUBLIC_RECIPIENT_NEED_MATCH') dText = '另一手补不上这个缺口。';
        else dText = conceptReason(CONCEPT_BY_CODE[dRow.featureCode] || '当前取舍',
          reasonKey(decomposition, context, dRow.featureCode, 'comparison'), true);
        push('DIFFERENTIATION', dText, ['DELTA:' + dRow.featureId]);
      } else {
        // R1: no reliable delta and no formal tie; stay neutral, never claim
        // a definite edge from masked/one-sided rows.
        push('DIFFERENTIATION', stableVariant(
          reasonKey(decomposition, context, 'NO_RELIABLE_DELTA', 'comparison'), [
            '公开信息下，两手没有拉开明显差距。',
            '现有公开信息不足以确认两手高下。',
            '就当时已知内容看，两手都没有明确优势。',
            '当前没有足够公开依据判断两手谁更占优。',
          ]), neutralRef ? [neutralRef] : []);
      }
    }

    // RISK_COST: real uncertainty or resource cost; UNKNOWN never becomes zero.
    var riskDone = false;
    var success = byCode.SUCCESS_PROBABILITY;
    if (success && success.status === 'KNOWN' && isFiniteNumber(success.rawValue) && success.rawValue < 0.6) {
      push('RISK_COST', '要赌的是命中，' + spoken(success.rawValue, 'PROBABILITY_0_1') + '把握。', ['c::SUCCESS_PROBABILITY']);
      riskDone = true;
    }
    var resourceDelta = byCode.RESOURCE_DELTA;
    if (!riskDone && resourceDelta && resourceDelta.status === 'KNOWN' && isFiniteNumber(resourceDelta.rawValue) && resourceDelta.rawValue < 0) {
      push('RISK_COST', '代价是' + cnInt(Math.abs(resourceDelta.rawValue)) + '点魂力。', ['c::RESOURCE_DELTA']);
      riskDone = true;
    }
    var affordability = byCode.COST_AFFORDABILITY;
    if (!riskDone && affordability && affordability.status === 'KNOWN' && isFiniteNumber(affordability.rawValue) && affordability.rawValue < 0.5) {
      push('RISK_COST', '这一手消耗不小。', ['c::COST_AFFORDABILITY']);
      riskDone = true;
    }
    var unknownConcept = masked.find(function (row) {
      return row.featureCode !== 'SETTLEMENT_DAMAGE' && row.featureCode !== 'ROLL_REALIZATION'
        && row.featureCode !== 'HARD_EXCLUSION' && row.featureCode !== 'HARD_EXCLUSION_REASON'
        && RISK_COST_ALLOW.has(row.featureCode);
    });
    if (unknownConcept) {
      push('RISK_COST', unknownReason(unknownConcept.featureCode,
        reasonKey(decomposition, context, unknownConcept.featureCode, 'unknown'), selectedName),
        [unknownConcept.featureId], '不过');
    }

    // CONCLUSION: short, concrete, tied to the hand.
    var topConceptRow = pos.find(function (row) { return !OBSERVED_RATIO_CODES.has(row.featureCode); }) || null;
    var topConcept = topConceptRow ? (CONCEPT_BY_CODE[topConceptRow.featureCode] || '') : '';
    var conclusion = '就这手。';
    // R4: a tied decision must not fabricate a tactical edge in the
    // conclusion either; stay with the neutral form.
    if (!isTie && topConcept === '生存') conclusion = '先保他。';
    else if (!isTie && topConcept === '控制') conclusion = '压住这一手。';
    else if (!isTie && topConcept === '资源') conclusion = '把资源喂给这一手。';
    var fallbackRow = pos[0] || real[0] || (decomposition.contributions || [])[0] || null;
    var conclusionRef = fallbackRow ? [fallbackRow.featureId] : [];
    push('CONCLUSION', selectedName ? selectedName + '：' + conclusion : conclusion, conclusionRef);

    if (sentences.length > 8) sentences = sentences.slice(0, 8);
    return { skeleton: SKELETON.slice(), sentences: sentences };
  }

  function auditReason(decomposition, player, review) {
    var errors = [];
    if (!player || !Array.isArray(player.sentences) || player.sentences.length === 0) return { ok: false, errors: ['UNBOUND_SENTENCE'] };
    if (JSON.stringify(player.skeleton) !== JSON.stringify(SKELETON)) errors.push('ORDER_VIOLATION');
    var byId = rowById(decomposition.contributions);
    var deltaIds = new Set((decomposition.selection && decomposition.selection.deltas || []).map(function (d) { return d.featureId; }));
    // R4b3: RELATION_TARGET_SIDE is public evidence only; a contribution row
    // carrying it violates the contract and must fail closed.
    (decomposition.contributions || []).forEach(function (row) {
      if (row && text(row.featureCode) === 'RELATION_TARGET_SIDE') errors.push('ENUM_IN_CONTRIBUTION:' + row.featureCode);
    });
    var orderIndex = { SITUATION: 0, FACTS: 1, SUPPORT: 2, DIFFERENTIATION: 3, RISK_COST: 4, CONCLUSION: 5 };
    var lastIndex = -1;
    player.sentences.forEach(function (s) {
      var refs = Array.isArray(s.traceRefs) ? s.traceRefs : [];
      if (refs.length === 0) errors.push('UNBOUND_SENTENCE');
      refs.forEach(function (ref) {
        var rawRef = text(ref);
        var key = rawRef.replace(/^DELTA:/, '');
        var ok = byId[key] !== undefined || deltaIds.has(key);
        if (!ok && rawRef.indexOf('HARD_EXCLUSION:') === 0) {
          ok = (decomposition.hardExclusions || []).some(function (ex) { return text(ex.code) === rawRef.slice('HARD_EXCLUSION:'.length); });
        }
        if (!ok) errors.push('CAUSAL_CHAIN_BROKEN');
      });
      var joined = text(s.text) + ' ' + text(s.connective);
      FORBIDDEN_TOKENS.forEach(function (token) {
        if (joined.indexOf(token) !== -1) errors.push('FORBIDDEN_TOKEN');
      });
      if (/隐藏|机密|secret/i.test(joined)) errors.push('HIDDEN_INPUT');
      if (/实际结算|结果证明|事后|果然|最后证明/.test(joined)) errors.push('RESULT_BACKWARD_RATIONALIZATION');
      if (/是零|为零|没有影响|没影响|无影响|没有效果|没有变化|没风险/.test(joined)) errors.push('UNKNOWN_AS_ZERO');
      // A number claim is an arabic digit or a Chinese numeral followed by a
      // unit word (成/半/倍/点/段/次/个/层/回合/魂力/血); 这一手/另一手 never counts.
      var numberClaim = /[0-9]/.test(s.text)
        || /[零一二三四五六七八九十两]+(?:成|半|倍|点|段|次|个|层|回合|魂力|血)/.test(s.text);
      if (numberClaim) {
        var hasUnit = false;
        refs.forEach(function (ref) {
          var rawRef = text(ref);
          var row = byId[rawRef.replace(/^DELTA:/, '')];
          if (row && row.unitFamily) {
            var words = unitWords(row.unitFamily);
            if (words.some(function (w) { return s.text.indexOf(w) !== -1; })) hasUnit = true;
          }
        });
        if (!hasUnit) errors.push('NUMBER_WITHOUT_UNIT');
      }
      var kindIndex = orderIndex[s.kind];
      if (kindIndex === undefined) errors.push('ORDER_VIOLATION');
      else if (kindIndex < lastIndex) errors.push('ORDER_VIOLATION');
      else lastIndex = kindIndex;
    });
    var computed = decomposition.intercept;
    (decomposition.contributions || []).forEach(function (row) {
      if (row.missingMasked !== true) computed += row.contribution;
    });
    if (Math.abs(decomposition.score - computed) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    if (decomposition.selection && decomposition.selection.deltas) {
      var sum = decomposition.selection.deltas.reduce(function (s, d) { return s + d.deltaContribution; }, 0);
      if (Math.abs(decomposition.selection.scoreDelta - sum) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    }
    (decomposition.contributions || []).forEach(function (row) {
      if (row.missingMasked !== true && EFFECT_ROW_CODES.has(row.featureCode)
        && !(ABSENCE_PROVEN_ZERO_CODES.has(row.featureCode) &&
          row.status === 'KNOWN' && row.rawValue === 0)
        && !row.sourceFactIds.length && !row.sourceEventIds.length) errors.push('SOURCE_MISSING');
    });
    if (review && review.realizedOutcome) errors.push('RESULT_BACKWARD_RATIONALIZATION');
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)).sort(cmpUtf16) };
  }

  function mapToReport(decomposition, player, context) {
    context = context || {};
    var selectedName = text(context.selectedName);
    var alternativeName = text(context.alternativeName);
    var sentences = player && Array.isArray(player.sentences) ? player.sentences : [];
    var byKind = {};
    sentences.forEach(function (s) { (byKind[s.kind] = byKind[s.kind] || []).push(s.text); });
    var diff = (byKind.DIFFERENTIATION || [])[0] || '';
    var support = (byKind.SUPPORT || [])[0] || '';
    var selectionReason = '选择' + selectedName + (diff ? '；' + diff : support ? '；' + support : '。');
    var objective = [];
    var risk = [];
    var resource = [];
    sentences.forEach(function (s) {
      var refs = Array.isArray(s.traceRefs) ? s.traceRefs : [];
      var concept = '目标推进';
      refs.some(function (ref) {
        var row = (decomposition.contributions || []).find(function (r) { return r.featureId === text(ref).replace(/^DELTA:/, ''); });
        if (row) { concept = row.tacticalConcept; return true; }
        return false;
      });
      if (s.kind === 'DIFFERENTIATION') objective.push(s.text);
      else if (s.kind === 'RISK_COST') {
        if (concept === '资源' || concept === '代价' || concept === '防御') resource.push(s.text);
        else risk.push(s.text);
      } else if (s.kind === 'SUPPORT' || s.kind === 'FACTS') {
        var playerConcept = PLAYER_CONCEPT[concept] || '';
        var genericSupport = /^(?:这一手的主要价值在.+上。|当前公开信息里，这一步的.+收益更突出。|这一手的优势主要体现在.+上。|按当前公开信息，这一步在.+上更合适。)$/.test(s.text);
        if (genericSupport && playerConcept && diff.indexOf(playerConcept) >= 0) return;
        if (concept === '资源' || concept === '代价') resource.push(s.text);
        else objective.push(s.text);
      }
    });
    var predictedNumbers = (decomposition.contributions || [])
      .filter(function (row) { return row.missingMasked !== true && row.status === 'KNOWN' && isFiniteNumber(row.rawValue); })
      .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution) || cmpUtf16(a.featureCode, b.featureCode); })
      .slice(0, 6)
      .map(function (row) {
        // Player-facing tokens expose display names and public values only.
        // Raw sourceFactIds/sourceEventIds stay internal for the DCT source
        // closure audit; no synthetic source id is fabricated here.
        return {
          displayName: DISPLAY_NAME[row.featureCode] || row.featureCode,
          value: row.rawValue,
          unit: row.unitFamily,
          derivationRule: '决策时公开特征',
          tacticalConsequence: row.tacticalConcept,
          operands: [{ name: '公开值', value: row.rawValue, unit: row.unitFamily }],
        };
      });
    var narrowing = [];
    var hardExclusions = Array.isArray(decomposition.hardExclusions) ? decomposition.hardExclusions : [];
    if (hardExclusions.length) {
      narrowing.push({
        stage: '硬排除',
        before: Math.max(0, Number(context.candidateCount || 0)),
        after: Math.max(0, Number(context.candidateCount || 0) - hardExclusions.length),
        droppedReasons: hardExclusions.map(function (ex) { return { reason: ex.reasonText, count: 1 }; }),
      });
    }
    return {
      selectionReason: selectionReason,
      objectiveTradeoffs: Array.from(new Set(objective)),
      riskTradeoffs: Array.from(new Set(risk)),
      resourceTradeoffs: Array.from(new Set(resource)),
      alternatives: alternativeName ? [{ name: alternativeName, status: 'CONSIDERED', reason: diff || '公开信息下取舍相同' }] : [],
      comparisonEvidence: {
        explanation: selectionReason,
        alternativeSummary: diff ? '主要替代项：' + alternativeName : '无主要替代项',
      },
      narrowing: narrowing,
      predictedNumbers: predictedNumbers,
      futurePoolTradeoffs: [],
    };
  }

  function runSelfCheck() {
    var checks = [];
    function check(name, passed, detail) { checks.push({ name: name, passed: !!passed, detail: detail || '' }); }
    var decomposition = {
      schemaVersion: 'DecisionContributionTraceV1',
      candidateId: 'a',
      score: 0.475,
      intercept: 0.1,
      conservationError: 0,
      contributions: [
        { featureId: 'c::DAMAGE_POWER', featureCode: 'DAMAGE_POWER', unitFamily: 'POWER', status: 'KNOWN', rawValue: 12, mean: 3, scale: 4, normalized: 2.25, weight: 0.4, contribution: 0.9, missingMasked: false, tacticalConcept: '伤害压力', sourceFactIds: ['effect:a:0'], sourceEventIds: [] },
        { featureId: 'c::PUBLIC_HP_RATIO', featureCode: 'PUBLIC_HP_RATIO', unitFamily: 'RATIO_0_1', status: 'KNOWN', rawValue: 0.3, mean: 0.5, scale: 0.25, normalized: -0.8, weight: 0.5, contribution: -0.4, missingMasked: false, tacticalConcept: '生存', sourceFactIds: ['visible:hp'], sourceEventIds: [] },
        { featureId: 'c::SUCCESS_PROBABILITY', featureCode: 'SUCCESS_PROBABILITY', unitFamily: 'PROBABILITY_0_1', status: 'KNOWN', rawValue: 0.6, mean: 0.7, scale: 0.2, normalized: -0.5, weight: 0.25, contribution: -0.125, missingMasked: false, tacticalConcept: '风险', sourceFactIds: [], sourceEventIds: ['evt:0'] },
        { featureId: 'c::REVEAL_STRENGTH', featureCode: 'REVEAL_STRENGTH', unitFamily: 'RATIO_0_1', status: 'UNKNOWN', missingMasked: true, tacticalConcept: '信息', sourceFactIds: [], sourceEventIds: [] },
        { featureId: 'c::SETTLEMENT_DAMAGE', featureCode: 'SETTLEMENT_DAMAGE', unitFamily: 'ABS', status: 'UNKNOWN', missingMasked: true, tacticalConcept: '风险', sourceFactIds: [], sourceEventIds: [] },
      ],
      missingMask: ['REVEAL_STRENGTH', 'SETTLEMENT_DAMAGE'],
      selection: {
        selectedCandidateId: 'a', alternativeCandidateId: 'b', scoreDelta: -0.05,
        deltas: [
          { featureId: 'c::DAMAGE_POWER', featureCode: 'DAMAGE_POWER', tacticalConcept: '伤害压力', deltaContribution: 0.45, zeroByMask: false, statusOfSelected: 'KNOWN', statusOfAlternative: 'KNOWN' },
          { featureId: 'c::SUCCESS_PROBABILITY', featureCode: 'SUCCESS_PROBABILITY', tacticalConcept: '风险', deltaContribution: -0.5, zeroByMask: false, statusOfSelected: 'KNOWN', statusOfAlternative: 'KNOWN' },
        ],
        topPositive: ['c::DAMAGE_POWER'], topNegative: ['c::SUCCESS_PROBABILITY'],
        tieBreak: 'DELTA_ABS_DESC_FEATURECODE_UTF16_ASC',
      },
      topContributions: { topPositive: ['c::DAMAGE_POWER'], topNegative: ['c::PUBLIC_HP_RATIO'], tieBreak: 'CONTRIBUTION_ABS_DESC_FEATURECODE_UTF16_ASC', noneOmitted: true },
    };
    var player = buildPlayerReasons(decomposition, { selectedName: '天霜斩', alternativeName: '吸血爪' });
    check('sentences_1_to_8', player.sentences.length >= 1 && player.sentences.length <= 8, 'count=' + player.sentences.length);
    check('skeleton_const', JSON.stringify(player.skeleton) === JSON.stringify(SKELETON));
    var audit = auditReason(decomposition, player, {});
    check('audit_clean', audit.ok, JSON.stringify(audit.errors));
    var report = mapToReport(decomposition, player, { selectedName: '天霜斩', alternativeName: '吸血爪', candidateCount: 3 });
    check('future_pool_empty', Array.isArray(report.futurePoolTradeoffs) && report.futurePoolTradeoffs.length === 0);
    check('predicted_numbers', report.predictedNumbers.length >= 1 && report.predictedNumbers[0].unit === 'POWER');
    check('selection_reason', report.selectionReason.indexOf('选择天霜斩') === 0, report.selectionReason);
    var tieDoc = {
      schemaVersion: 'DecisionContributionTraceV1',
      candidateId: 'a', score: 0.1, intercept: 0.1, conservationError: 0,
      contributions: [
        { featureId: 'c::DAMAGE_POWER', featureCode: 'DAMAGE_POWER', unitFamily: 'POWER', tacticalConcept: '伤害压力', status: 'KNOWN', rawValue: 12, mean: 3, scale: 4, normalized: 2.25, weight: 0.4, contribution: 0.9, missingMasked: false, sourceFactIds: ['effect:a:0'], sourceEventIds: [] },
        { featureId: 'c::SUCCESS_PROBABILITY', featureCode: 'SUCCESS_PROBABILITY', unitFamily: 'PROBABILITY_0_1', tacticalConcept: '风险', status: 'KNOWN', rawValue: 0.9, mean: 0.5, scale: 0.2, normalized: 2, weight: -0.45, contribution: -0.9, missingMasked: false, sourceFactIds: [], sourceEventIds: ['evt:0'] },
      ],
      missingMask: [],
      selection: {
        selectedCandidateId: 'a', alternativeCandidateId: 'b', scoreDelta: 0,
        deltas: [
          { featureId: 'c::DAMAGE_POWER', featureCode: 'DAMAGE_POWER', tacticalConcept: '伤害压力', deltaContribution: 0.45, zeroByMask: false, statusOfSelected: 'KNOWN', statusOfAlternative: 'KNOWN' },
          { featureId: 'c::SUCCESS_PROBABILITY', featureCode: 'SUCCESS_PROBABILITY', tacticalConcept: '风险', deltaContribution: -0.45, zeroByMask: false, statusOfSelected: 'KNOWN', statusOfAlternative: 'KNOWN' },
        ],
        topPositive: [], topNegative: [], tieBreak: 'DELTA_ABS_DESC_FEATURECODE_UTF16_ASC',
      },
      topContributions: { topPositive: [], topNegative: [], tieBreak: 'CONTRIBUTION_ABS_DESC_FEATURECODE_UTF16_ASC', noneOmitted: true },
    };
    var tiePlayer = buildPlayerReasons(tieDoc, { selectedName: '甲', alternativeName: '乙' });
    var tieText = tiePlayer.sentences.map(function (s) { return s.text; }).join(' ');
    check('tie_positive_delta_honest', tieText.indexOf('差异不明显') !== -1 && tieText.indexOf('没这么足') === -1 && tieText.indexOf('更划算') === -1, tieText);
    var tieReport = mapToReport(tieDoc, tiePlayer, { selectedName: '甲', alternativeName: '乙', candidateCount: 2 });
    check('report_no_raw_source_ids', tieReport.predictedNumbers.every(function (t) { return t.sourceEventId === undefined && t.sourceFactId === undefined; }), JSON.stringify(tieReport.predictedNumbers));
    var badPlayer = { skeleton: SKELETON.slice(), sentences: [{ kind: 'SUPPORT', text: '这一手有十三点威力。', traceRefs: ['c::DAMAGE_POWER'] }] };
    var badAudit = auditReason(decomposition, badPlayer, {});
    check('number_without_unit_detected', badAudit.errors.indexOf('NUMBER_WITHOUT_UNIT') !== -1, JSON.stringify(badAudit.errors));
    var badOrder = { skeleton: SKELETON.slice(), sentences: [{ kind: 'CONCLUSION', text: '就这手。', traceRefs: ['c::DAMAGE_POWER'] }, { kind: 'SITUATION', text: '对面血线只剩三成。', traceRefs: ['c::PUBLIC_HP_RATIO'] }] };
    check('order_violation_detected', auditReason(decomposition, badOrder, {}).errors.indexOf('ORDER_VIOLATION') !== -1);
    var badToken = { skeleton: SKELETON.slice(), sentences: [{ kind: 'SUPPORT', text: '这手很稳。', connective: '权重', traceRefs: ['c::DAMAGE_POWER'] }] };
    check('forbidden_token_detected', auditReason(decomposition, badToken, {}).errors.indexOf('FORBIDDEN_TOKEN') !== -1);
    var badUnbound = { skeleton: SKELETON.slice(), sentences: [{ kind: 'SUPPORT', text: '这手很有机会。', traceRefs: [] }] };
    check('unbound_detected', auditReason(decomposition, badUnbound, {}).errors.indexOf('UNBOUND_SENTENCE') !== -1);
    var badBackward = { skeleton: SKELETON.slice(), sentences: [{ kind: 'SUPPORT', text: '果然打中了。', traceRefs: ['c::DAMAGE_POWER'] }] };
    check('result_backward_detected', auditReason(decomposition, badBackward, {}).errors.indexOf('RESULT_BACKWARD_RATIONALIZATION') !== -1);
    var passed = checks.every(function (c) { return c.passed; });
    return { schemaVersion: SCHEMA_VERSION, role: 'CHINESE_REASON', passed: passed, checks: checks };
  }

  var api = {
    buildPlayerReasons: buildPlayerReasons,
    auditReason: auditReason,
    mapToReport: mapToReport,
    skeleton: SKELETON.slice(),
    selfCheck: runSelfCheck,
  };
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

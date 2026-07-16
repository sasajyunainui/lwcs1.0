/* BattleDecision_Module.js - Battle decisions over immutable previews. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const preview = root.__LWCS_BATTLE_PREVIEW__;
  if (!preview || typeof preview.previewAction !== 'function') throw new Error('battle_decision_preview_runtime_missing');
  if (preview.version !== '7.3-R6.3-preview-2') throw new Error(`battle_decision_preview_version_mismatch:${preview.version || 'missing'}`);

  const VERSION = '7.3-R6.3-decision-2';
  const skillRootCache = new WeakMap();
  const effectFingerprintCache = new WeakMap();
  const skillCostCache = new WeakMap();
  const targetProfileCache = new WeakMap();
  let baseActionValueCache = new WeakMap();
  let unitSkillCache = new WeakMap();
  let stateEntriesCache = new WeakMap();
  let actionCancellationCache = new WeakMap();
  let actionQualityCache = new WeakMap();
  let effectiveShieldCache = new WeakMap();
  let bestAgainstCache = new WeakMap();
  let bestActionCache = new WeakMap();
  let experienceCache = new WeakMap();
  let relevantStateFingerprintCache = new WeakMap();
  let worldEntriesCache = new WeakMap();
  let aliveEntriesCache = new WeakMap();
  let sideCache = new WeakMap();
  let nextValueContextCache = new WeakMap();
  let shieldThreatProfileCache = new WeakMap();
  let nextUtilityCache = new WeakMap();
  let nextTeamCapacityCache = new WeakMap();
  let decisionWorldRevisionCache = new WeakMap();
  let responseThreatSnapshotCache = new WeakMap();
  let unitCapacitySignatureCache = new WeakMap();
  let sequenceProfileSemanticCache = new WeakMap();
  const decisionMetrics = {
    stateUtilityNextCalls: 0,
    stateUtilityNextCacheHits: 0,
    stateUtilityNextTimeMs: 0,
    nextValueContextBuilds: 0,
    worldRevisionCacheHits: 0,
    worldRevisionAssignments: 0,
    teamCapacityProfileCalls: 0,
    teamCapacityProfileCacheHits: 0,
    teamCapacityFullBuilds: 0,
    teamCapacityIncrementalBuilds: 0,
    teamCapacityUnitsRecomputed: 0,
    sequenceProfileCalls: 0,
    sequenceProfileCacheHits: 0,
  };
  let decisionWorldRevisionSequence = 0;

  function now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function worldRevisionFor(worldSnapshot = {}) {
    if (!worldSnapshot || typeof worldSnapshot !== 'object') return preview.stableHash(worldSnapshot);
    const cached = decisionWorldRevisionCache.get(worldSnapshot);
    if (cached) {
      decisionMetrics.worldRevisionCacheHits += 1;
      return cached;
    }
    decisionMetrics.worldRevisionAssignments += 1;
    const revision = `decision-world:${decisionRevisionSequence}:${++decisionWorldRevisionSequence}`;
    decisionWorldRevisionCache.set(worldSnapshot, revision);
    return revision;
  }

  function resetDecisionMetrics() {
    Object.keys(decisionMetrics).forEach(key => { decisionMetrics[key] = 0; });
  }
  let decisionRevisionSequence = 0;
  const actionKinds = Object.freeze([
    'BASIC_ATTACK', 'DEFEND', 'EVADE', 'COUNTER', 'OBSERVE',
    'GUARD', 'WITHDRAW', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP',
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function cloneValue(value) {
    if (typeof root.structuredClone === 'function') return root.structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function median(values = []) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function stableRoll(seedText = '') {
    const hash = preview.stableHash(String(seedText || 'battle-decision'));
    return Number.parseInt(hash, 36) % 1000000 / 1000000;
  }

  function unitLevel(unit = {}) {
    const values = [unit?.level, unit?.等级, unit?.修为等级, unit?.属性?.等级, unit?.final?.level].map(Number).filter(Number.isFinite);
    return Math.max(1, values[0] || 1);
  }

  function ratio(unit = {}, resource = 'sp') {
    if (resource === 'men') return preview.readResource(unit, '精神力') / preview.readResourceMax(unit, '精神力');
    if (resource === 'vit') return preview.readResource(unit, '体力') / preview.readResourceMax(unit, '体力');
    return preview.readResource(unit, '魂力') / preview.readResourceMax(unit, '魂力');
  }

  function experienceOf(unit = {}) {
    if (experienceCache.has(unit)) return experienceCache.get(unit);
    const explicit = Number(unit?.战斗经验 ?? unit?.battleExperience ?? unit?.经验稳定度);
    const result = Number.isFinite(explicit)
      ? clamp(explicit > 1 ? explicit / 100 : explicit, 0, 1)
      : clamp(0.25 + unitLevel(unit) / 120 * 0.7 + (stableRoll(`experience:${preview.unitId(unit) || preview.unitName(unit)}`) * 0.12 - 0.06), 0.2, 0.96);
    experienceCache.set(unit, result);
    return result;
  }

  function visibleStates(unit = {}) {
    return Object.values(unit?.状态效果 || {}).filter(state => state && typeof state === 'object' && state?.隐藏 !== true && state?.hidden !== true).map(state => ({
      name: String(state?.状态 || state?.状态名称 || '').trim(),
      duration: Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 0)),
      type: String(state?.类型 || state?.正负面 || '').trim(),
      combatEffect: cloneValue(state?.战斗效果 || {}),
      applicationProbability: clamp(Number(state?.__previewApplicationProbability ?? 1), 0, 1),
    }));
  }

  function decisionRuntimeState(worldSnapshot = {}) {
    const source = worldSnapshot?.__battleRuntime;
    if (!source || typeof source !== 'object') return null;
    return {
      unitReactionCount: { ...(source.unitReactionCount || {}) },
      factionReactionCount: { ...(source.factionReactionCount || {}) },
      withdrawalSuccess: source.withdrawalSuccess === true,
      withdrawalSuccessSides: Array.isArray(source.withdrawalSuccessSides)
        ? [...source.withdrawalSuccessSides]
        : [],
    };
  }

  function attachDecisionRuntimeState(worldSnapshot = {}, sourceWorld = {}, runtimeOverride = null) {
    const runtime = runtimeOverride || decisionRuntimeState(sourceWorld);
    if (!runtime) return worldSnapshot;
    Object.defineProperty(worldSnapshot, '__battleRuntime', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: runtime,
    });
    return worldSnapshot;
  }

  function snapshotWithConsumedReaction(worldSnapshot = {}, target = {}) {
    const runtime = decisionRuntimeState(worldSnapshot) || {
      unitReactionCount: {},
      factionReactionCount: {},
      withdrawalSuccess: false,
      withdrawalSuccessSides: [],
    };
    const unitReactionCount = { ...(runtime.unitReactionCount || {}) };
    [
      preview.unitId(target),
      preview.unitName(target),
      target?.charKey,
      target?.char_key,
      target?.key,
    ].map(value => String(value || '').trim()).filter(Boolean).forEach(key => {
      unitReactionCount[key] = Math.max(1, Number(unitReactionCount[key] || 0));
    });
    return markCapacityDeltaSnapshot(attachDecisionRuntimeState({ ...worldSnapshot }, worldSnapshot, {
      ...runtime,
      unitReactionCount,
    }), worldSnapshot, []);
  }

  function buildInitialBelief(worldSnapshot = {}, actorId = '', existing = {}) {
    const actor = preview.findUnit(worldSnapshot, actorId);
    if (!actor) throw new Error('battle_decision_belief_actor_missing');
    const actorSide = sideOf(worldSnapshot, actor);
    const experience = experienceOf(actor);
    const strengthHalfWidth = Math.ceil(2 + 8 * (1 - experience));
    const existingUnits = existing?.units && typeof existing.units === 'object' ? existing.units : {};
    const units = Object.fromEntries(worldEntries(worldSnapshot).map(entry => {
      const unit = entry.unit;
      const id = preview.unitId(unit);
      const allied = entry.side === actorSide;
      const level = unitLevel(unit);
      const prior = existingUnits[id] && typeof existingUnits[id] === 'object' ? existingUnits[id] : {};
      return [id, {
        ...prior,
        id,
        side: entry.side,
        allied,
        alive: preview.isAlive(unit),
        hpRatio: preview.readHp(unit) / preview.readHpMax(unit),
        strengthRange: allied ? [level, level] : prior.strengthRange || [Math.max(1, level - strengthHalfWidth), level + strengthHalfWidth],
        visibleSystem: String(unit?.系别 || unit?.type || unit?.第1武魂?.系别 || unit?.属性?.系别 || prior.visibleSystem || '').trim(),
        visibleStates: visibleStates(unit),
        resources: allied ? {
          soul: ratio(unit, 'sp'),
          spirit: ratio(unit, 'men'),
          stamina: ratio(unit, 'vit'),
        } : prior.resources,
      }];
    }));
    const confidence = clamp(existing?.confidence ?? experience, 0, 1);
    const mechanics = existing?.mechanics && typeof existing.mechanics === 'object' ? existing.mechanics : {};
    const publicResponses = existing?.publicResponses && typeof existing.publicResponses === 'object' ? existing.publicResponses : {};
    const targetRealization = existing?.targetRealization && typeof existing.targetRealization === 'object'
      ? existing.targetRealization
      : {};
    const visibleRevision = Object.values(units).map(unit => [
      unit.id,
      unit.side,
      unit.allied,
      unit.alive,
      unit.hpRatio,
      unit.strengthRange,
      unit.visibleSystem,
      unit.visibleStates,
      unit.resources,
    ]);
    return {
      ...existing,
      revision: preview.stableHash([
        String(existing?.revision || ''),
        actorId,
        confidence,
        visibleRevision,
      ]),
      confidence,
      units,
      mechanics,
      publicResponses,
      targetRealization,
    };
  }

  function nextBeliefRevision(beliefState = {}, eventType = '', payload = null) {
    return preview.stableHash([
      String(beliefState?.revision || ''),
      String(eventType || '').trim(),
      payload,
    ]);
  }

  function buildDecisionWorld(worldSnapshot = {}, actorId = '', beliefState = {}) {
    const sourceActor = preview.findUnit(worldSnapshot, actorId);
    if (!sourceActor) throw new Error('battle_decision_projection_actor_missing');
    const actorSide = sideOf(worldSnapshot, sourceActor);
    const actorLevel = unitLevel(sourceActor);
    const actorStats = {
      hp: preview.readHpMax(sourceActor),
      soul: preview.readResourceMax(sourceActor, '魂力'),
      spirit: preview.readResourceMax(sourceActor, '精神力'),
      stamina: preview.readResourceMax(sourceActor, '体力'),
      str: preview.readCombatStat(sourceActor, 'str'),
      def: preview.readCombatStat(sourceActor, 'def'),
      agi: preview.readCombatStat(sourceActor, 'agi'),
    };
    actorStats.combatBase = Math.cbrt(actorStats.str * actorStats.def * actorStats.agi);
    const projectUnit = sourceUnit => {
      if (sideOf(worldSnapshot, sourceUnit) === actorSide) {
        return sourceUnit;
      }
      const id = preview.unitId(sourceUnit);
      const beliefUnit = beliefState?.units?.[id] || {};
      const strengthRange = Array.isArray(beliefUnit.strengthRange) ? beliefUnit.strengthRange.map(Number) : [actorLevel, actorLevel];
      const lower = Math.max(1, Number(strengthRange[0] || actorLevel));
      const upper = Math.max(lower, Number(strengthRange[1] || lower));
      const confidence = clamp(beliefState?.confidence ?? 0.5, 0, 1);
      const perceivedLevel = lower + (upper - lower) * (0.75 - 0.25 * confidence);
      const scale = clamp(Math.pow(perceivedLevel / Math.max(1, actorLevel), 1.45), 0.12, 8);
      const system = String(beliefUnit.visibleSystem || '').trim();
      const systemScale = /敏攻/.test(system)
        ? { str: 0.95, def: 0.82, agi: 1.28 }
        : /防御/.test(system)
          ? { str: 0.9, def: 1.3, agi: 0.78 }
          : /辅助|治疗|食物/.test(system)
            ? { str: 0.78, def: 0.9, agi: 0.95 }
            : { str: 1.08, def: 1, agi: 0.96 };
      const hpMax = Math.max(1, actorStats.hp * scale);
      const hp = hpMax * clamp(beliefUnit.hpRatio ?? 1, 0, 1);
      const resourceRatios = beliefUnit.resources || {};
      const soulMax = Math.max(1, actorStats.soul * scale);
      const spiritMax = Math.max(1, actorStats.spirit * scale);
      const staminaMax = Math.max(1, actorStats.stamina * scale);
      const states = Object.fromEntries((beliefUnit.visibleStates || []).map((state, index) => [`visible:${id}:${index}`, {
        状态: String(state?.name || '').trim(),
        duration: Math.max(0, Number(state?.duration || 0)),
        类型: String(state?.type || '').trim(),
        战斗效果: cloneValue(state?.combatEffect || {}),
        __previewApplicationProbability: clamp(Number(state?.applicationProbability ?? 1), 0, 1),
      }]));
      const projected = {
        id,
        name: preview.unitName(sourceUnit),
        名称: preview.unitName(sourceUnit),
        level: perceivedLevel,
        等级: perceivedLevel,
        系别: system,
        type: system,
        hp,
        HP: hp,
        hp_max: hpMax,
        sp: soulMax * clamp(resourceRatios.soul ?? 0.5, 0, 1),
        sp_max: soulMax,
        men: spiritMax * clamp(resourceRatios.spirit ?? 0.5, 0, 1),
        men_max: spiritMax,
        vit: staminaMax * clamp(resourceRatios.stamina ?? 0.5, 0, 1),
        vit_max: staminaMax,
        str: Math.max(1, actorStats.combatBase * scale * systemScale.str),
        def: Math.max(1, actorStats.combatBase * scale * systemScale.def),
        agi: Math.max(1, actorStats.combatBase * scale * systemScale.agi),
        状态: { 存活: beliefUnit.alive !== false, 行动: String(sourceUnit?.状态?.行动 || '').trim() },
        状态效果: states,
        技能列表: [],
      };
      projected.属性 = {
        等级: perceivedLevel,
        系别: system,
        HP: hp,
        HP上限: hpMax,
        魂力: projected.sp,
        魂力上限: soulMax,
        精神力: projected.men,
        精神力上限: spiritMax,
        体力: projected.vit,
        体力上限: staminaMax,
        力量: projected.str,
        防御: projected.def,
        敏捷: projected.agi,
      };
      if (sourceUnit?.蓄力技能) projected.蓄力技能 = cloneValue(sourceUnit.蓄力技能);
      return projected;
    };
    const participants = worldSnapshot?.参战者 || {};
    const projectedParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
      if (Array.isArray(value)) return [side, value.map(projectUnit)];
      if (value && typeof value === 'object') {
        return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, projectUnit(unit)]))];
      }
      return [side, value];
    }));
    const decisionWorld = attachDecisionRuntimeState(
      { ...worldSnapshot, 参战者: projectedParticipants },
      worldSnapshot,
    );
    const summons = worldSnapshot?.召唤单位表;
    if (summons && typeof summons === 'object' && Object.keys(summons).length) {
      Object.defineProperty(decisionWorld, '召唤单位表', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Object.fromEntries(Object.entries(summons).map(([key, unit]) => [key, projectUnit(unit)])),
      });
    }
    return decisionWorld;
  }

  function mapWorldUnits(worldSnapshot = {}, mapper = unit => unit) {
    const participants = worldSnapshot?.参战者 || {};
    const nextParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
      if (Array.isArray(value)) return [side, value.map(unit => mapper(unit, side))];
      if (value && typeof value === 'object') return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, mapper(unit, side)]))];
      return [side, value];
    }));
    const nextWorld = attachDecisionRuntimeState(
      { ...worldSnapshot, 参战者: nextParticipants },
      worldSnapshot,
    );
    const summons = worldSnapshot?.召唤单位表;
    if (summons && typeof summons === 'object' && Object.keys(summons).length) {
      Object.defineProperty(nextWorld, '召唤单位表', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Object.fromEntries(Object.entries(summons).map(([key, unit]) => [
          key,
          mapper(unit, /^(enemy|敌方|对方)$/i.test(String(unit?.阵营 || '').trim()) ? 'team_enemy' : 'team_player'),
        ])),
      });
    }
    return nextWorld;
  }

  function markCapacityDeltaSnapshot(snapshot = {}, parentSnapshot = {}, changedUnitIds = []) {
    const ids = [...new Set((Array.isArray(changedUnitIds) ? changedUnitIds : [changedUnitIds])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
    Object.defineProperties(snapshot, {
      __decisionCapacityParent: {
        configurable: true,
        enumerable: false,
        value: parentSnapshot,
      },
      __decisionCapacityChangedUnitIds: {
        configurable: true,
        enumerable: false,
        value: Object.freeze(ids),
      },
    });
    return snapshot;
  }

  function relevantStateFingerprint(beliefState = {}, targetId = '') {
    let targetCache = relevantStateFingerprintCache.get(beliefState);
    if (!targetCache) {
      targetCache = new Map();
      relevantStateFingerprintCache.set(beliefState, targetCache);
    }
    if (targetCache.has(targetId)) return targetCache.get(targetId);
    const states = beliefState?.units?.[targetId]?.visibleStates || [];
    const result = preview.stableHash(states.map(state => [state.name, state.duration, state.type]));
    targetCache.set(targetId, result);
    return result;
  }

  function mechanicKey(input = {}) {
    return [
      input.sourceActionId || '',
      input.effectPrototype || '',
      input.targetId || '',
      input.relevantStateFingerprint || relevantStateFingerprint(input.beliefState, input.targetId),
    ].join('|');
  }

  function betaPrior(estimatedProbability = 0.65, experience = 0.5) {
    const priorStrength = 2 + 6 * clamp(experience, 0, 1);
    const probability = clamp(estimatedProbability, 0, 1);
    return { alpha: probability * priorStrength, beta: (1 - probability) * priorStrength };
  }

  function mechanicPosterior(beliefState = {}, key = '', estimatedProbability = 0.65, experience = 0.5) {
    const record = beliefState?.mechanics?.[key];
    const prior = record && Number(record.alpha) >= 0 && Number(record.beta) >= 0 ? record : betaPrior(estimatedProbability, experience);
    return Number(prior.alpha) / Math.max(0.0001, Number(prior.alpha) + Number(prior.beta));
  }

  function updateMechanicBelief(beliefState = {}, observation = {}) {
    const next = {
      ...(beliefState || {}),
      mechanics: {
        ...(beliefState?.mechanics && typeof beliefState.mechanics === 'object' ? beliefState.mechanics : {}),
      },
    };
    const key = mechanicKey({ ...observation, beliefState: next });
    const prior = next.mechanics[key] || betaPrior(observation.estimatedProbability, observation.experience);
    next.mechanics[key] = {
      alpha: Number(prior.alpha) + (observation.success === true ? 1 : 0),
      beta: Number(prior.beta) + (observation.success === true ? 0 : 1),
      observations: Math.max(0, Number(prior.observations || 0)) + 1,
    };
    next.revision = nextBeliefRevision(beliefState, 'MECHANIC', [key, next.mechanics[key]]);
    return next;
  }

  function damageClass(value = '') {
    const text = String(value || '').trim();
    if (/真实/.test(text)) return 'TRUE';
    if (/精神/.test(text)) return 'MENTAL';
    if (/远程/.test(text)) return 'RANGED';
    return 'MELEE';
  }

  function targetRealizationKey(targetId = '', className = 'MELEE') {
    return `${String(targetId || '').trim()}|${String(className || 'MELEE').trim().toUpperCase()}`;
  }

  function updateTargetRealizationBelief(beliefState = {}, observation = {}) {
    const targetId = String(observation?.targetId || '').trim();
    const className = String(observation?.damageClass || damageClass(observation?.damageType)).trim().toUpperCase();
    const predictedValue = Math.max(0, Number(observation?.predictedValuePercent || 0));
    const actualValue = Math.max(0, Number(observation?.actualValuePercent || 0));
    if (!targetId || !(predictedValue > 0) || !Number.isFinite(actualValue)) return beliefState;
    const next = {
      ...(beliefState || {}),
      targetRealization: {
        ...(beliefState?.targetRealization && typeof beliefState.targetRealization === 'object'
          ? beliefState.targetRealization
          : {}),
      },
    };
    const key = targetRealizationKey(targetId, className);
    const current = next.targetRealization[key] && typeof next.targetRealization[key] === 'object'
      ? next.targetRealization[key]
      : {};
    const observations = Math.max(0, Number(current.observations || 0));
    const observedRatio = clamp(actualValue / predictedValue, 0.02, 4);
    next.targetRealization[key] = {
      targetId,
      damageClass: className,
      meanRatio: (Math.max(0, Number(current.meanRatio || 0)) * observations + observedRatio) / (observations + 1),
      observations: observations + 1,
      lastPredictedValuePercent: predictedValue,
      lastActualValuePercent: actualValue,
      sourceEventId: String(observation?.sourceEventId || '').trim(),
    };
    next.revision = nextBeliefRevision(beliefState, 'TARGET_REALIZATION', [key, next.targetRealization[key]]);
    return next;
  }

  function targetRealizationFactor(beliefState = {}, actor = {}, targetId = '', effects = []) {
    const damageEffects = effects.filter(effect => String(effect?.原型 || '').trim() === '伤害结算');
    if (!damageEffects.length) return 1;
    const records = damageEffects.map(effect =>
      beliefState?.targetRealization?.[targetRealizationKey(targetId, damageClass(effect?.伤害类型))]
    ).filter(record => record && Number(record.observations || 0) > 0);
    if (!records.length) return 1;
    const meanRatio = records.reduce((sum, record) =>
      sum + clamp(Number(record.meanRatio || 1), 0.02, 4)
    , 0) / records.length;
    const observations = Math.max(...records.map(record => Math.max(1, Number(record.observations || 1))));
    const firstEvidenceWeight = 0.6 + 0.3 * experienceOf(actor);
    const evidenceWeight = 1 - Math.pow(1 - firstEvidenceWeight, observations);
    return clamp(1 + (meanRatio - 1) * evidenceWeight, 0.05, 4);
  }

  function updatePublicObservation(beliefState = {}, observation = {}) {
    const next = {
      ...(beliefState || {}),
      units: {
        ...(beliefState?.units && typeof beliefState.units === 'object' ? beliefState.units : {}),
      },
      publicResponses: {
        ...(beliefState?.publicResponses && typeof beliefState.publicResponses === 'object'
          ? beliefState.publicResponses
          : {}),
      },
    };
    const sourceActorId = String(observation?.sourceActorId || '').trim();
    const responseId = String(observation?.responseId || observation?.sourceActionId || observation?.actionName || '').trim();
    if (!sourceActorId || !responseId) return next;
    const currentResponses = Array.isArray(next.publicResponses[sourceActorId]) ? next.publicResponses[sourceActorId] : [];
    const existing = currentResponses.find(response => String(response?.responseId || '').trim() === responseId);
    const observedValue = Math.max(0, Number(observation?.baseActionValue || 0));
    const observedHpDamageValue = Math.max(0, Number(observation?.hpDamageValue || 0));
    const observedDamageMultiplier = Number(observation?.damageMultiplier);
    const observedDodgeProbability = Number(observation?.dodgeProbability);
    const observedShieldRatio = Number(observation?.shieldRatio);
    const responseRole = String(observation?.responseRole || existing?.responseRole || '').trim().toUpperCase();
    const responseRoles = [...new Set([
      ...(Array.isArray(existing?.responseRoles) ? existing.responseRoles : []),
      String(existing?.responseRole || '').trim().toUpperCase(),
      responseRole,
    ].filter(Boolean))];
    const response = {
      ...(existing || {}),
      responseId,
      actionName: String(observation?.actionName || existing?.actionName || responseId).trim(),
      responseRole,
      responseRoles,
      sourceActionId: String(observation?.sourceActionId || existing?.sourceActionId || '').trim(),
      incomingSourceActorId: String(observation?.incomingSourceActorId || existing?.incomingSourceActorId || '').trim(),
      declaration: observation?.declaration && typeof observation.declaration === 'object'
        ? cloneValue(observation.declaration)
        : existing?.declaration,
      utility: Math.max(Number(existing?.utility || 0), observedValue),
      baseActionValue: Math.max(Number(existing?.baseActionValue || 0), observedValue),
      hpDamageValue: Math.max(Number(existing?.hpDamageValue || 0), observedHpDamageValue),
      damageMultiplier: Number.isFinite(observedDamageMultiplier)
        ? clamp(observedDamageMultiplier, 0, 1)
        : existing?.damageMultiplier,
      dodgeProbability: Number.isFinite(observedDodgeProbability)
        ? clamp(observedDodgeProbability, 0, 1)
        : existing?.dodgeProbability,
      shieldRatio: Number.isFinite(observedShieldRatio)
        ? Math.max(0, observedShieldRatio)
        : existing?.shieldRatio,
      opensCounterCheck: observation?.opensCounterCheck === undefined
        ? existing?.opensCounterCheck === true
        : observation.opensCounterCheck === true,
      preparedDefense: observation?.preparedDefense === undefined
        ? existing?.preparedDefense === true
        : observation.preparedDefense === true,
      observations: Math.max(0, Number(existing?.observations || 0)) + 1,
      lastResult: String(observation?.result || '').trim(),
    };
    next.publicResponses[sourceActorId] = existing
      ? currentResponses.map(item => item === existing ? response : item)
      : [...currentResponses, response];
    const unitBelief = next.units[sourceActorId] && typeof next.units[sourceActorId] === 'object' ? next.units[sourceActorId] : { id: sourceActorId };
    next.units[sourceActorId] = { ...unitBelief, knownResponses: next.publicResponses[sourceActorId] };
    const currentConfidence = clamp(Number(next.confidence || 0), 0, 1);
    const learningRate = existing
      ? 0.08 / Math.max(1, Number(existing.observations || 1))
      : 0.15;
    next.confidence = clamp(currentConfidence + (1 - currentConfidence) * learningRate, 0, 1);
    next.revision = nextBeliefRevision(beliefState, 'PUBLIC_RESPONSE', [
      sourceActorId,
      responseId,
      response,
      next.confidence,
    ]);
    return next;
  }

  function unknownResponseMass(beliefConfidence = 0) {
    return clamp(0.35 * (1 - clamp(beliefConfidence, 0, 1)), 0, 0.35);
  }

  function estimateInformationValue(context = {}) {
    const uncertainty = unknownResponseMass(context?.beliefState?.confidence);
    if (!(uncertainty > 0)) return 0;
    const actor = preview.findUnit(context.worldSnapshot || {}, context.actorId);
    if (!actor) return 0;
    const actorSide = sideOf(context.worldSnapshot, actor);
    const threatPairs = aliveEntries(context.worldSnapshot)
      .filter(entry => entry.side !== actorSide)
      .map(entry => {
        const beliefUnit = context?.beliefState?.units?.[preview.unitId(entry.unit)] || {};
        const knownThreat = Math.max(0, ...(beliefUnit?.knownResponses || []).map(response => Number(response?.baseActionValue || 0)));
        return { knownThreat, worstThreat: perceivedEnemyBaseValue(beliefUnit, actor) };
      });
    if (!threatPairs.length) return 0;
    const worstRegretBefore = Math.max(...threatPairs.map(pair => pair.worstThreat));
    const expectedRegretAfterReveal = Math.max(...threatPairs.map(pair => (pair.knownThreat + pair.worstThreat) / 2));
    return clamp(uncertainty * Math.max(0, worstRegretBefore - expectedRegretAfterReveal), 0, 20);
  }

  function probabilityValue(value, fallback = 0.65) {
    const text = String(value ?? '').trim();
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return clamp(fallback, 0, 1);
    return clamp(text.includes('%') || numeric > 1 ? numeric / 100 : numeric, 0, 1);
  }

  function skillId(skill = {}, index = 0) {
    return String(skill?.id || skill?.技能ID || skill?.魂技ID || skill?.name || skill?.魂技名 || skill?.技能名称 || `skill:${index}`).trim();
  }

  function skillName(skill = {}, index = 0) {
    return String(skill?.name || skill?.魂技名 || skill?.技能名称 || skill?.名称 || skillId(skill, index)).trim();
  }

  function candidateActionName(candidate = {}) {
    const declaration = candidate?.declaration || {};
    if (declaration?.skill && typeof declaration.skill === 'object') return skillName(declaration.skill);
    return ({
      BASIC_ATTACK: '普通攻击',
      DEFEND: '防御',
      EVADE: '闪避',
      COUNTER: '反击',
      OBSERVE: '观察',
      GUARD: '护卫',
      WITHDRAW: '撤退',
      RELEASE_SKILL: '魂技',
      USE_ITEM: '使用物品',
      EQUIP: '装备',
    })[String(declaration?.actionKind || '').trim()] || String(declaration?.actionKind || '行动').trim();
  }

  function predictedOutcomeEvidence(result = null) {
    if (!result || !Array.isArray(result?.contributions)) return Object.freeze([]);
    return Object.freeze(result.contributions.flatMap(entry => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const targetId = String(entry?.targetId || '').trim();
      const windowId = String(entry?.windowId || '').trim();
      const evidence = entry?.evidence && typeof entry.evidence === 'object' ? entry.evidence : {};
      let expectedDelta = Number.NaN;
      if (outcomeKind === 'HP_DELTA') {
        const expectedDamage = Number(evidence?.expectedDamage);
        expectedDelta = Number.isFinite(expectedDamage) && expectedDamage > 0
          ? -expectedDamage
          : Number(evidence?.delta);
      } else if (outcomeKind === 'SHIELD_DELTA') {
        const delta = Number(evidence?.delta);
        const current = Number(evidence?.current);
        const next = Number(evidence?.next);
        expectedDelta = Number.isFinite(delta)
          ? delta
          : Number.isFinite(current) && Number.isFinite(next)
            ? next - current
            : Number.NaN;
      }
      if (!targetId || !Number.isFinite(expectedDelta) || Math.abs(expectedDelta) <= 0.0001) return [];
      return [{
        outcomeKind,
        targetId,
        windowId,
        expectedDelta,
        expectedValuePercent: Math.max(0, Number(entry?.threatValue || 0)),
        hitProbability: clamp(Number(evidence?.hitProbability ?? 1), 0, 1),
        reactionDamageMultiplier: clamp(Number(evidence?.reactionDamageMultiplier ?? 1), 0, 1),
        damageType: String(evidence?.damageType || '').trim(),
        sourceEffectId: String(entry?.effectInstanceId || '').trim(),
      }];
    }));
  }

  function isPassiveSkill(skill = {}) {
    return String(skill?.承载方式 || skill?.类型 || skill?.技能类型 || '').includes('被动');
  }

  function collectSkills(unit = {}) {
    const cachedUnitSkills = unitSkillCache.get(unit);
    if (cachedUnitSkills) return cachedUnitSkills;
    const roots = [
      ...(Array.isArray(unit?.技能列表) && unit.技能列表.length ? [unit.技能列表] : []),
      ...Object.entries(unit).filter(([key, value]) => /^(?:第\d+)?武魂|血脉之力|魂骨|装备|自创魂技|技能/.test(key) && value && typeof value === 'object').map(([, value]) => value),
    ];
    const collectRoot = skillRoot => {
      const cached = skillRootCache.get(skillRoot);
      if (cached) return cached;
      const entries = [];
      const seenObjects = new Set();
      const visit = value => {
        if (!value || typeof value !== 'object' || seenObjects.has(value)) return;
        seenObjects.add(value);
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (Number(value?.炸环恢复tick || 0) > 0 || value?.__战斗禁用 === true) return;
        if (Array.isArray(value._效果数组) && value._效果数组.length && !isPassiveSkill(value)) {
          let effectFingerprint = effectFingerprintCache.get(value._效果数组);
          if (!effectFingerprint) {
            effectFingerprint = preview.stableHash(value._效果数组);
            effectFingerprintCache.set(value._效果数组, effectFingerprint);
          }
          entries.push({ skill: value, effectFingerprint });
          return;
        }
        Object.entries(value).forEach(([key, child]) => {
          if (/状态效果|战斗历史|历史快照|参战者|复制效果/.test(key)) return;
          visit(child);
        });
      };
      visit(skillRoot);
      const result = Object.freeze(entries);
      skillRootCache.set(skillRoot, result);
      return result;
    };
    const output = [];
    const seenSkills = new Set();
    roots.forEach(skillRoot => {
      collectRoot(skillRoot).forEach(({ skill, effectFingerprint }) => {
        const key = `${skillId(skill, output.length)}|${effectFingerprint}`;
        if (!seenSkills.has(key)) {
          seenSkills.add(key);
          output.push(skill);
        }
      });
    });
    const result = Object.freeze(output);
    unitSkillCache.set(unit, result);
    return result;
  }

  function collectAvailableRings(unit = {}, currentTick = 0) {
    const rings = [];
    const visitRings = (container, path = []) => {
      Object.entries(container || {}).forEach(([key, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        const nextPath = [...path, key];
        if (/^第\d+魂环$/.test(String(key || '').trim())) {
          const recoveryTick = Math.max(0, Number(value?.炸环恢复tick || 0));
          if (!(recoveryTick > Math.max(0, Number(currentTick || 0))) && value?.__战斗禁用 !== true) {
            const age = Math.max(1, Number(value?.年限 || 1));
            const skillCount = Object.entries(value).filter(([childKey, child]) =>
              /^第\d+魂技(?:_2)?$/.test(String(childKey || '').trim()) &&
              child && typeof child === 'object' && !Array.isArray(child)
            ).length;
            const ringId = nextPath.join('/');
            rings.push(Object.freeze({
              ringId,
              ringPath: Object.freeze(nextPath),
              label: `${key}·${Math.round(age)}年`,
              age,
              cost: clamp(8 + 6 * Math.log10(Math.max(10, age)) + Math.max(0, skillCount - 1) * 3, 12, 55),
            }));
          }
          return;
        }
        if (/^第\d+(?:武魂|魂灵)$/.test(String(key || '').trim())) visitRings(value, nextPath);
      });
    };
    visitRings(unit);
    return Object.freeze(rings);
  }

  function cachedBaseActionValue(actor, target, actionKind, skill = null) {
    let targetCache = baseActionValueCache.get(actor);
    if (!targetCache) {
      targetCache = new WeakMap();
      baseActionValueCache.set(actor, targetCache);
    }
    let actionCache = targetCache.get(target);
    if (!actionCache) {
      actionCache = new Map();
      targetCache.set(target, actionCache);
    }
    const key = skill || actionKind;
    if (!actionCache.has(key)) {
      actionCache.set(key, preview.calculateBaseActionValue(actor, target, { actionKind, skill, capacityMode: true }));
    }
    return actionCache.get(key);
  }

  function collectInventory(unit = {}) {
    const output = [];
    const seen = new Set();
    const visit = (value, key = '') => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${key}:${index}`));
        return;
      }
      if (key && (value?.数量 !== undefined || value?.quantity !== undefined)) {
        const id = String(value?.id || value?.物品ID || value?.名称 || value?.name || key).trim();
        if (id && !seen.has(id)) {
          seen.add(id);
          output.push({ id, item: value, quantity: Math.max(0, Number(value?.数量 ?? value?.quantity ?? 0)) });
        }
        return;
      }
      if (Array.isArray(value._效果数组) || value.装备属性 || value.属性加成 || /装备|消耗品|药|食物/.test(String(value?.类型 || value?.分类 || ''))) {
        const id = String(value?.id || value?.物品ID || value?.名称 || value?.name || key).trim();
        if (id && !seen.has(id)) {
          seen.add(id);
          output.push({ id, item: value, quantity: Math.max(0, Number(value?.数量 ?? value?.quantity ?? 1)) });
        }
        return;
      }
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    ['背包', '库存', '物品', '战斗物品', '可用装备'].forEach(key => visit(unit?.[key], key));
    return output;
  }

  function irreversibleAssetOptionValue(effects, target, assumeCrisis = false) {
    return effects.reduce((sum, effect) => {
      const prototype = String(effect?.原型 || '').trim();
      if (prototype === '资源变化' && !/生命|HP/i.test(String(effect?.资源 || '')) && Number.parseFloat(String(effect?.数值 || '0')) > 0) {
        const resource = String(effect?.资源 || '').trim();
        return assumeCrisis || preview.readResource(target, resource) < preview.readResourceMax(target, resource) ? sum + 8 : sum;
      }
      if (prototype === '状态移除') {
        const hasRemovableState = Object.keys(target?.状态效果 || {}).length > 0 || Object.keys(target?.持续效果 || {}).length > 0;
        return assumeCrisis || hasRemovableState ? sum + 6 : sum;
      }
      if (['属性修正', '判定修正', '结算修正', '规则防御', '机制授予'].includes(prototype)) return sum + 6;
      return sum;
    }, 0);
  }

  function irreversibleAssetFutureMaximum(item, actor, worldSnapshot) {
    const effects = Array.isArray(item?._效果数组) ? item._效果数组 : [];
    return Math.max(0, ...aliveEntries(worldSnapshot).map(({ unit }) => {
      const futureCrisisUnit = {
        ...unit,
        hp: 0,
        HP: 0,
        属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性, HP: 0 } : unit?.属性,
      };
      const directValue = preview.calculateBaseActionValue(actor, futureCrisisUnit, { actionKind: 'RELEASE_SKILL', skill: item, capacityMode: true });
      return Math.min(100, Math.max(0, directValue + irreversibleAssetOptionValue(effects, futureCrisisUnit, true)));
    }));
  }

  function estimateIrreversibleAssetCost(item, actor, quantity, currentTarget, futureMaximumValue) {
    const effects = Array.isArray(item?._效果数组) ? item._效果数组 : [];
    if (!effects.length) return 0;
    const currentValue = currentTarget
      ? Math.max(0, preview.calculateBaseActionValue(actor, currentTarget, { actionKind: 'RELEASE_SKILL', skill: item, capacityMode: true }) + irreversibleAssetOptionValue(effects, currentTarget))
      : 0;
    const scarcity = 1 + 1 / Math.max(1, Number(quantity || 1));
    return Math.max(0, futureMaximumValue - currentValue) * scarcity * 0.35;
  }

  function isEquipment(item = {}) {
    const modifiers = item?.装备属性 && typeof item.装备属性 === 'object'
      ? item.装备属性
      : item?.属性加成 && typeof item.属性加成 === 'object' ? item.属性加成 : null;
    return !!(modifiers && Object.keys(modifiers).length) || /装备|武器|护甲|饰品/.test(String(item?.类型 || item?.分类 || ''));
  }

  function equipmentEffects(item = {}) {
    const modifiers = item?.装备属性 || item?.属性加成 || {};
    const effects = Object.entries(modifiers).map(([attribute, value]) => ({ 原型: '属性修正', 目标: '自身', 属性: attribute, 数值: value, 持续回合: 99 }));
    return effects.length ? effects : Array.isArray(item?._效果数组) ? item._效果数组 : [];
  }

  function creationProfile(skill = {}, actor = {}, worldSnapshot = {}) {
    const product = skill?.生成物 || skill?.产物 || skill?.制作产物 || (String(skill?.承载方式 || '').trim() === '造物承载'
      ? skillName(skill)
      : null);
    if (!product) return null;
    const productId = String(product?.id || product?.物品ID || product?.名称 || product?.name || product).trim();
    const stock = collectInventory(actor).filter(entry => entry.id === productId).reduce((sum, entry) => sum + entry.quantity, 0);
    const actorSide = sideOf(worldSnapshot, actor);
    const useEffects = (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).flatMap(effect =>
      Array.isArray(effect?.使用效果) ? effect.使用效果 : [],
    );
    const hasResourceGap = unit => useEffects.some(effect => {
      if (String(effect?.原型 || '').trim() !== '资源变化') return false;
      const resource = String(effect?.资源 || '').trim();
      if (/魂力/.test(resource)) return preview.readResource(unit, '魂力') < preview.readResourceMax(unit, '魂力');
      if (/精神/.test(resource)) return preview.readResource(unit, '精神力') < preview.readResourceMax(unit, '精神力');
      if (/体力/.test(resource)) return preview.readResource(unit, '体力') < preview.readResourceMax(unit, '体力');
      return preview.readHp(unit) < preview.readHpMax(unit);
    });
    const consumers = aliveEntries(worldSnapshot).filter(entry =>
      entry.side === actorSide && (hasResourceGap(entry.unit) || (!useEffects.length && preview.readHp(entry.unit) < preview.readHpMax(entry.unit))),
    );
    const inferredProductionWindow = Math.max(1, Math.ceil(Math.max(0, Number(skill?.前摇 || 0)) / 40));
    const productionWindow = Math.max(1, Number(skill?.生产窗口 ?? skill?.生效回合 ?? inferredProductionWindow));
    return {
      productId,
      stock,
      useEffects,
      consumerIds: consumers.map(entry => preview.unitId(entry.unit)),
      productionWindow,
      useful: !!productId && stock <= 0 && consumers.length > 0 && productionWindow <= Math.max(1, Number(worldSnapshot?.剩余回合 || 20)),
    };
  }

  function creationProductSkill(creation = null) {
    if (!creation?.productId || !Array.isArray(creation?.useEffects) || !creation.useEffects.length) return null;
    return {
      id: `created-item:${creation.productId}`,
      name: creation.productId,
      魂技名: creation.productId,
      承载方式: '物品使用',
      _效果数组: creation.useEffects.map(effect => String(effect?.目标 || '').trim() === '自身'
        ? { ...cloneValue(effect), 目标: '单体' }
        : cloneValue(effect)),
    };
  }

  function replacementCreationProfile(item = {}, actor = {}, worldSnapshot = {}, inventoryId = '') {
    if (!Array.isArray(item?.使用效果) || !item.使用效果.length) return null;
    const itemIds = new Set([
      inventoryId,
      item?.id,
      item?.物品ID,
      item?.名称,
      item?.name,
      item?.物品名,
      item?.来源,
    ].map(value => String(value || '').trim()).filter(Boolean));
    for (const skill of collectSkills(actor)) {
      const creation = creationProfile(skill, actor, worldSnapshot);
      if (!creation?.productId || !creation.useEffects?.length) continue;
      const skillIds = [
        creation.productId,
        skillId(skill),
        skillName(skill),
      ].map(value => String(value || '').trim()).filter(Boolean);
      if (skillIds.some(value => itemIds.has(value))) return creation;
    }
    return null;
  }

  function strategicSignature(worldSnapshot = {}, beliefState = {}) {
    const hpBand = unit => Math.max(0, Math.min(4, Math.floor(preview.readHp(unit) / preview.readHpMax(unit) * 5)));
    return preview.stableHash({
      alive: aliveEntries(worldSnapshot).map(entry => preview.unitId(entry.unit)).sort(),
      units: worldEntries(worldSnapshot).map(entry => ({
        id: preview.unitId(entry.unit),
        hpBand: hpBand(entry.unit),
        shieldBand: Math.max(0, Math.min(4, Math.floor(preview.readShield(entry.unit) / preview.readHpMax(entry.unit) * 5))),
        canPayEffectiveAction: preview.readResource(entry.unit, '魂力') > 0,
        controlled: hasActionCancellation(entry.unit),
        visibleStates: beliefState?.units?.[preview.unitId(entry.unit)]?.visibleStates?.map(state => [state.name, state.duration]) || [],
      })),
      intentProgress: worldSnapshot?.战斗意图进度 || null,
    });
  }

  function detectStalemate(history = [], currentSignature = '') {
    const rows = Array.isArray(history) ? history : [];
    if (rows.length < 2 || !currentSignature) return false;
    const latest = rows.slice(-2);
    return latest.every(row => String(row?.signature || row) === currentSignature && Number(row?.capacityChangePercent ?? 0) < 1 && row?.newInformation !== true && row?.pendingEffect !== true);
  }

  function parseSkillCosts(skill = {}) {
    const cached = skillCostCache.get(skill);
    if (cached) return cached;
    const costs = {};
    const add = (resource, value) => {
      const numeric = Number.parseFloat(String(value ?? '').replace('%', ''));
      if (!Number.isFinite(numeric)) return;
      costs[resource] = String(value).includes('%') ? `${Math.max(0, numeric)}%` : Math.max(0, numeric);
    };
    const raw = skill?.消耗 ?? skill?.cost ?? skill?.技能消耗 ?? {};
    if (typeof raw === 'string') {
      for (const match of raw.matchAll(/(魂力|精神力|体力)\s*[:：]\s*([+-]?\d+(?:\.\d+)?%?)/g)) add(match[1], match[2]);
    } else if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([resource, value]) => add(resource, value));
    }
    [['魂力', skill?.魂力消耗], ['精神力', skill?.精神力消耗], ['体力', skill?.体力消耗]].forEach(([resource, value]) => {
      if (value !== undefined) add(resource, value);
    });
    const result = Object.freeze(costs);
    skillCostCache.set(skill, result);
    return result;
  }

  function costAffordable(unit = {}, skill = {}) {
    return Object.entries(parseSkillCosts(skill)).every(([resource, cost]) => {
      const available = preview.readResource(unit, resource);
      const maximum = preview.readResourceMax(unit, resource);
      const text = String(cost ?? '').trim();
      const amount = text.includes('%') ? maximum * Math.max(0, Number.parseFloat(text) || 0) / 100 : Math.max(0, Number(cost || 0));
      return available + 1e-9 >= amount;
    });
  }

  function snapshotAfterResourceCosts(worldSnapshot = {}, actorId = '', costs = {}) {
    return mapWorldUnits(worldSnapshot, unit => {
      if (preview.unitId(unit) !== actorId) return unit;
      return unitAfterResourceCosts(unit, costs);
    });
  }

  function unitAfterResourceCosts(unit = {}, costs = {}) {
    const actor = {
      ...unit,
      属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : unit?.属性,
      final: unit?.final && typeof unit.final === 'object' ? { ...unit.final } : unit?.final,
    };
    Object.entries(costs || {}).forEach(([resource, cost]) => {
      const maximum = preview.readResourceMax(actor, resource);
      const text = String(cost ?? '').trim();
      const amount = text.includes('%')
        ? maximum * Math.max(0, Number.parseFloat(text) || 0) / 100
        : Math.max(0, Number(cost || 0));
      const remaining = Math.max(0, preview.readResource(actor, resource) - amount);
      if (/精神/.test(resource)) {
        actor.men = remaining;
        if (actor.属性 && typeof actor.属性 === 'object') actor.属性.精神力 = remaining;
      } else if (/体力/.test(resource)) {
        actor.vit = remaining;
        actor.sta = remaining;
        if (actor.属性 && typeof actor.属性 === 'object') actor.属性.体力 = remaining;
        preview.refreshStaminaAdjustedFinal(actor);
      } else {
        actor.sp = remaining;
        if (actor.属性 && typeof actor.属性 === 'object') actor.属性.魂力 = remaining;
      }
    });
    return actor;
  }

  function unitAfterInventoryConsumption(unit = {}, inventoryId = '') {
    if (!inventoryId) return unit;
    const next = {
      ...unit,
      背包: unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : unit?.背包,
      库存: unit?.库存 && typeof unit.库存 === 'object' ? cloneValue(unit.库存) : unit?.库存,
      物品: unit?.物品 && typeof unit.物品 === 'object' ? cloneValue(unit.物品) : unit?.物品,
      战斗物品: unit?.战斗物品 && typeof unit.战斗物品 === 'object' ? cloneValue(unit.战斗物品) : unit?.战斗物品,
    };
    const entry = collectInventory(next).find(item => item.id === inventoryId && item.quantity > 0);
    if (!entry) return next;
    const remaining = entry.quantity - 1;
    if (entry.item.数量 !== undefined || entry.item.quantity === undefined) entry.item.数量 = remaining;
    if (entry.item.quantity !== undefined) entry.item.quantity = remaining;
    return next;
  }

  function unitAfterCreation(unit = {}, creation = null) {
    if (!creation?.productId || !Array.isArray(creation?.useEffects) || !creation.useEffects.length) return unit;
    const next = {
      ...unit,
      背包: unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : {},
    };
    const existing = next.背包[creation.productId] && typeof next.背包[creation.productId] === 'object'
      ? next.背包[creation.productId]
      : {};
    next.背包[creation.productId] = {
      ...existing,
      id: String(existing.id || creation.productId).trim() || creation.productId,
      name: String(existing.name || creation.productId).trim() || creation.productId,
      名称: String(existing.名称 || creation.productId).trim() || creation.productId,
      物品名: String(existing.物品名 || creation.productId).trim() || creation.productId,
      数量: Math.max(0, Number(existing.数量 || 0)) + 1,
      使用效果: cloneValue(creation.useEffects),
    };
    return next;
  }

  function unitAfterDeterministicRecovery(unit = {}) {
    const next = {
      ...unit,
      属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : unit?.属性,
      final: unit?.final && typeof unit.final === 'object' ? { ...unit.final } : unit?.final,
    };
    const coreCount = Math.max(0, Math.floor(Number(unit?.魂核?.核心?.数量 || 0)));
    [
      { resource: '魂力', key: 'sp', attributeKey: '魂力', ratio: 0.005 + (coreCount >= 1 ? 0.01 : 0) + (coreCount >= 3 ? 0.01 : 0) },
      { resource: '精神力', key: 'men', attributeKey: '精神力', ratio: 0.005 + (coreCount >= 2 ? 0.01 : 0) },
    ].forEach(entry => {
      const maximum = preview.readResourceMax(next, entry.resource);
      const current = preview.readResource(next, entry.resource);
      const recovery = Math.floor(maximum * entry.ratio * (1 - recoveryLockRatio(next, entry.resource)));
      const value = Math.min(maximum, current + Math.max(0, recovery));
      next[entry.key] = value;
      if (next.属性 && typeof next.属性 === 'object') next.属性[entry.attributeKey] = value;
    });
    return next;
  }

  function targetProfile(skill = {}) {
    const cached = targetProfileCache.get(skill);
    if (cached) return cached;
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    const targets = effects.map(effect => String(effect?.目标 || '').trim()).filter(Boolean);
    if (!targets.length || targets.every(target => target === '自身')) {
      targetProfileCache.set(skill, 'SELF');
      return 'SELF';
    }
    const targetableEffects = effects.filter(effect => String(effect?.目标 || '').trim() !== '自身');
    const hostile = targetableEffects.some(effect => {
      const prototype = String(effect?.原型 || '').trim();
      if (prototype === '伤害结算' || prototype === '资源锁定' || prototype === '机制抹消') return true;
      if (prototype === '护盾变化') return String(effect?.护盾模式 || '').trim() !== '正向护盾';
      if (prototype === '资源变化') return Number.parseFloat(String(effect?.数值 || '0')) < 0;
      if (prototype === '状态施加' || prototype === '属性修正' || prototype === '判定修正' || prototype === '结算修正') return Number.parseFloat(String(effect?.数值 || '-1')) < 0 || /眩晕|沉默|中毒|流血|灼烧|禁疗|迟缓|致盲|混乱|嘲讽/.test(String(effect?.状态 || ''));
      return false;
    });
    const friendly = targetableEffects.some(effect => {
      const prototype = String(effect?.原型 || '').trim();
      const target = String(effect?.目标 || '').trim();
      if (['状态移除', '规则防御', '机制授予'].includes(prototype)) return true;
      if (/友方|己方|队友|自身/.test(target)) return true;
      if (prototype === '资源变化') return Number.parseFloat(String(effect?.数值 || '0')) > 0 && !hostile;
      if (prototype === '护盾变化') return String(effect?.护盾模式 || '').trim() === '正向护盾' && !hostile;
      return false;
    });
    const profile = targets.some(target => /全场|群体/.test(target))
      ? hostile || !friendly ? 'HOSTILE_GROUP' : 'FRIENDLY_GROUP'
      : targets.some(target => /友方/.test(target))
        ? 'FRIENDLY_SINGLE'
        : hostile
          ? 'HOSTILE_SINGLE'
          : friendly ? 'FRIENDLY_SINGLE' : 'HOSTILE_SINGLE';
    targetProfileCache.set(skill, profile);
    return profile;
  }

  function isImmediateReactionSkill(skill = {}, immediateBudget = 0) {
    const castTime = Math.max(0, Number(skill?.前摇 ?? skill?.cast_time ?? 10));
    if (castTime > immediateBudget) return false;
    const text = `${skillName(skill)} ${skill?.技能分类 || ''} ${skill?.触发方式 || ''} ${skill?.反应类型 || ''}`;
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    const hasHostileDamage = effects.some(effect => String(effect?.原型 || '').trim() === '伤害结算' && !/自身|己方|友方/.test(String(effect?.目标 || '').trim()));
    const hasImmediateDefense = effects.some(effect => {
      const prototype = String(effect?.原型 || '').trim();
      const target = String(effect?.目标 || '').trim();
      const value = Number.parseFloat(String(effect?.数值 || '0'));
      if (!/自身|己方|友方/.test(target)) return false;
      if (prototype === '规则防御') return true;
      if (prototype === '护盾变化') return String(effect?.护盾模式 || '正向护盾').trim() === '正向护盾';
      return prototype === '判定修正' && /闪避|格挡|反应/.test(String(effect?.判定 || '').trim()) && value > 0;
    });
    const explicitDefensiveReaction = /格挡|招架|闪避|应激|受击触发|即时护盾/.test(text) ||
      effects.some(effect => effect?.即时反应 === true && /自身|己方|友方/.test(String(effect?.目标 || '').trim()));
    return hasImmediateDefense || (!hasHostileDamage && (skill?.即时反应 === true || explicitDefensiveReaction));
  }

  function isExplicitCounterSkill(skill = {}, immediateBudget = 0) {
    const castTime = Math.max(0, Number(skill?.前摇 ?? skill?.cast_time ?? 10));
    if (castTime > immediateBudget) return false;
    const text = `${skillName(skill)} ${skill?.技能分类 || ''} ${skill?.触发方式 || ''} ${skill?.反应类型 || ''}`;
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    return skill?.反击技能 === true || skill?.即时反击 === true || /反击|反打|防反|闪反|受击触发|格挡反击|招架反击/.test(text) ||
      effects.some(effect => effect?.即时反击 === true || /反击|反伤/.test(String(effect?.结算 || effect?.触发方式 || '').trim()));
  }

  function worldEntries(worldSnapshot = {}) {
    let entries = worldEntriesCache.get(worldSnapshot);
    if (!entries) {
      entries = Object.freeze(preview.listUnits(worldSnapshot));
      worldEntriesCache.set(worldSnapshot, entries);
    }
    return entries;
  }

  function aliveEntries(worldSnapshot = {}) {
    let entries = aliveEntriesCache.get(worldSnapshot);
    if (!entries) {
      entries = Object.freeze(worldEntries(worldSnapshot).filter(entry => preview.isAlive(entry.unit)));
      aliveEntriesCache.set(worldSnapshot, entries);
    }
    return entries;
  }

  function sideOf(worldSnapshot = {}, unit = {}) {
    let units = sideCache.get(worldSnapshot);
    if (!units) {
      units = new WeakMap();
      sideCache.set(worldSnapshot, units);
    }
    if (!units.has(unit)) {
      const id = preview.unitId(unit);
      units.set(unit, worldEntries(worldSnapshot).find(entry => entry.unit === unit || preview.unitId(entry.unit) === id)?.side || '');
    }
    return units.get(unit);
  }

  function enumerateTargetSets(worldSnapshot, actor, profile, beliefState = {}) {
    const actorSide = sideOf(worldSnapshot, actor);
    const entries = aliveEntries(worldSnapshot);
    const friendly = entries.filter(entry => entry.side === actorSide).map(entry => entry.unit);
    const hostile = entries.filter(entry => entry.side !== actorSide).map(entry => entry.unit);
    if (profile === 'SELF') return [[preview.unitId(actor)]];
    if (profile === 'FRIENDLY_GROUP') return [friendly.map(preview.unitId)];
    if (profile === 'HOSTILE_GROUP') return [hostile.map(preview.unitId)];
    if (profile === 'FRIENDLY_SINGLE') return friendly.map(unit => [preview.unitId(unit)]);
    if (profile === 'ANY_SINGLE') return entries.map(entry => [preview.unitId(entry.unit)]);
    const interferencePossible = beliefState?.targetInterferencePossible === true || beliefState?.confused === true;
    const targets = interferencePossible ? entries.map(entry => entry.unit) : hostile;
    return targets.map(unit => [preview.unitId(unit)]);
  }

  function defensiveDeclaration(actorId, actionKind) {
    return { actionId: `${actorId}:${actionKind}`, actorId, actionKind, targetIds: [actorId] };
  }

  function enumerateCandidates(input = {}) {
    const worldSnapshot = input.worldSnapshot || {};
    const actor = preview.findUnit(worldSnapshot, input.actorId);
    if (!actor || !preview.isAlive(actor)) return [];
    const actorId = preview.unitId(actor);
    const opportunityRole = String(input.actionOpportunity?.role || '').trim();
    const reactionOnly = opportunityRole === 'REACTION';
    const counterOnly = opportunityRole === 'COUNTER';
    const forcedSkill = input.actionOpportunity?.forcedSkill && typeof input.actionOpportunity.forcedSkill === 'object'
      ? input.actionOpportunity.forcedSkill
      : null;
    const forcedTargetIds = Array.isArray(input.actionOpportunity?.forcedTargetIds)
      ? input.actionOpportunity.forcedTargetIds.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    const immediateBudget = Math.max(0, Number(input.actionOpportunity?.immediateBudget ?? 10));
    const hostile = aliveEntries(worldSnapshot).filter(entry => entry.side !== sideOf(worldSnapshot, actor)).map(entry => entry.unit);
    const counterSourceId = String(input.actionOpportunity?.sourceActorId || '').trim();
    const directHostile = counterOnly && counterSourceId
      ? hostile.filter(target => preview.unitId(target) === counterSourceId)
      : hostile;
    const candidates = reactionOnly || forcedSkill ? [] : directHostile.map(target => {
      const targetId = preview.unitId(target);
      return { candidateId: `${actorId}:basic:${targetId}`, declaration: { actionId: `${actorId}:basic:${targetId}`, actorId, actionKind: 'BASIC_ATTACK', targetIds: [targetId] } };
    });
    if (counterOnly && !forcedSkill) candidates.push({
      candidateId: `${actorId}:COUNTER_DECLINE`,
      declaration: defensiveDeclaration(actorId, 'DEFEND'),
      counterDeclineFallback: true,
    });
    if (!counterOnly && !forcedSkill) ['DEFEND', 'EVADE'].forEach(actionKind => candidates.push({ candidateId: `${actorId}:${actionKind}`, declaration: defensiveDeclaration(actorId, actionKind) }));
    if (!counterOnly && !forcedSkill && input.actionOpportunity?.counterWindow === true && input.actionOpportunity?.counterActionAvailable === true) {
      candidates.push({ candidateId: `${actorId}:COUNTER`, declaration: defensiveDeclaration(actorId, 'COUNTER') });
    }
    const allies = aliveEntries(worldSnapshot).filter(entry => entry.side === sideOf(worldSnapshot, actor) && preview.unitId(entry.unit) !== actorId);
    if (!forcedSkill && !reactionOnly && !counterOnly && allies.length && input.actionOpportunity?.interceptThreat === true) {
      allies.forEach(entry => candidates.push({ candidateId: `${actorId}:GUARD:${preview.unitId(entry.unit)}`, declaration: { actionId: `${actorId}:GUARD:${preview.unitId(entry.unit)}`, actorId, actionKind: 'GUARD', targetIds: [preview.unitId(entry.unit)] } }));
    }
    if (!forcedSkill && !reactionOnly && !counterOnly && input.beliefState?.observationGranted === true && Number(input.beliefState?.confidence || 0) < 1) {
      candidates.push({ candidateId: `${actorId}:OBSERVE`, declaration: defensiveDeclaration(actorId, 'OBSERVE') });
    }
    if (!forcedSkill && !reactionOnly && !counterOnly && withdrawalAllowed(worldSnapshot, actor, input.battleIntent)) {
      candidates.push({ candidateId: `${actorId}:WITHDRAW`, declaration: defensiveDeclaration(actorId, 'WITHDRAW') });
    }
    (forcedSkill ? [forcedSkill] : collectSkills(actor)).forEach((skill, index) => {
      const costs = parseSkillCosts(skill);
      if (!costAffordable(actor, skill)) return;
      const fusion = preview.resolveFusionAction(worldSnapshot, actor, skill, {
        resourceCosts: costs,
        requirePendingOpportunity: true,
      });
      if (fusion.required && (!fusion.valid || reactionOnly || counterOnly)) return;
      if (counterOnly && !isExplicitCounterSkill(skill, immediateBudget)) return;
      if (!forcedSkill && !counterOnly && input.actionOpportunity?.enforceImmediateBudget === true && !isImmediateReactionSkill(skill, immediateBudget)) return;
      if (reactionOnly && !isImmediateReactionSkill(skill, immediateBudget)) return;
      const profile = targetProfile(skill);
      if (counterOnly && !['HOSTILE_SINGLE', 'HOSTILE_GROUP', 'ANY_SINGLE'].includes(profile)) return;
      const counterSkill = counterOnly
        ? { ...skill, 消耗: '无', 魂力消耗: 0, 精神力消耗: 0, 体力消耗: 0, 前摇: 0, cast_time: 0 }
        : skill;
      const declarationCosts = counterOnly ? parseSkillCosts(counterSkill) : costs;
      const creation = creationProfile(counterSkill, actor, worldSnapshot);
      const reactionSourceId = String(input.actionOpportunity?.sourceActorId || '').trim();
      const legalTargetSets = enumerateTargetSets(worldSnapshot, actor, profile, input.beliefState);
      const legalForcedTargetSet = legalTargetSets.find(targetSet =>
        targetSet.length === forcedTargetIds.length &&
        targetSet.every(targetId => forcedTargetIds.includes(targetId))
      );
      const targetSets = legalForcedTargetSet
        ? [legalForcedTargetSet]
        : (reactionOnly || counterOnly) && reactionSourceId && ['HOSTILE_SINGLE', 'ANY_SINGLE'].includes(profile)
        ? [[reactionSourceId]]
        : legalTargetSets;
      const ringBurst = (Array.isArray(counterSkill?._效果数组) ? counterSkill._效果数组 : [])
        .some(effect => String(effect?.原型 || '').trim() === '炸环');
      const ringOptions = ringBurst
        ? collectAvailableRings(actor, worldSnapshot?.当前世界tick)
        : [null];
      targetSets.forEach((targetIds, targetIndex) => {
        ringOptions.forEach(ringOption => {
        const id = `${actorId}:${forcedSkill ? 'forced-skill' : 'skill'}:${skillId(skill, index)}:${targetIndex}${ringOption ? `:ring:${ringOption.ringId}` : ''}`;
        const declaration = {
          actionId: id,
          actorId,
          actionKind: 'RELEASE_SKILL',
          targetIds,
          skill: counterSkill,
          resourceCosts: declarationCosts,
        };
        if (fusion.required) {
          declaration.fusionKey = fusion.fusionKey;
          declaration.fusionParticipantIds = [...fusion.participantIds];
          declaration.fusionPartnerIds = [...fusion.partnerIds];
          declaration.fusionUsageMode = fusion.usageMode;
        }
        const explicitRingId = String(counterSkill?.ringId || counterSkill?.魂环ID || '').trim();
        if (ringOption) {
          declaration.ringId = ringOption.ringId;
          declaration.ringPath = [...ringOption.ringPath];
          declaration.ringLabel = ringOption.label;
          declaration.ringCost = ringOption.cost;
        } else if (explicitRingId) {
          declaration.ringId = explicitRingId;
        }
        if (counterSkill?.historySnapshot !== undefined) {
          declaration.historySnapshot = cloneValue(worldSnapshot?.回合开始快照 || worldSnapshot);
        }
        candidates.push({
          candidateId: id,
          declaration,
          skill: counterSkill,
          costs: declarationCosts,
          creation,
        });
        });
      });
    });
    if (forcedSkill) return candidates;
    if (reactionOnly || counterOnly) return candidates;
    const currentEquipmentIds = new Set(Object.values(actor?.装备 || {}).map(item => String(item?.id || item?.物品ID || item?.名称 || item?.name || '')).filter(Boolean));
    const runtimeEquipmentId = String(actor?.__battleRuntime?.equippedDecisionItem?.id || '').trim();
    if (runtimeEquipmentId) currentEquipmentIds.add(runtimeEquipmentId);
    const equipmentHistory = new Set(Array.isArray(actor?.__battleRuntime?.equipmentDecisionSignatures) ? actor.__battleRuntime.equipmentDecisionSignatures.map(String) : []);
    collectInventory(actor).filter(entry => entry.quantity > 0).forEach((entry, index) => {
      const item = entry.item;
      if (isEquipment(item)) {
        const signature = preview.stableHash({ itemId: entry.id, effects: equipmentEffects(item) });
        if (currentEquipmentIds.has(entry.id) || equipmentHistory.has(signature)) return;
        const id = `${actorId}:equip:${entry.id}:${index}`;
        candidates.push({
          candidateId: id,
          declaration: {
            actionId: id,
            actorId,
            actionKind: 'EQUIP',
            targetIds: [actorId],
            equipmentSignature: signature,
            skill: { ...item, id: entry.id, name: skillName(item, index), _效果数组: equipmentEffects(item) },
          },
          equipment: item,
          equipmentSignature: signature,
        });
        return;
      }
      const usableEffects = Array.isArray(item?._效果数组) && item._效果数组.length
        ? item._效果数组
        : Array.isArray(item?.使用效果) ? item.使用效果 : [];
      if (!usableEffects.length) return;
      const itemName = String(item?.name || item?.名称 || item?.物品名 || entry.id).trim() || entry.id;
      const usableItem = {
        ...item,
        name: itemName,
        __物品名: String(item?.__物品名 || itemName).trim(),
        承载方式: String(item?.承载方式 || '物品使用').trim() || '物品使用',
        _效果数组: usableEffects.map(effect => String(effect?.目标 || '').trim() === '自身'
          ? { ...effect, 目标: '单体' }
          : effect),
      };
      const renewableCreation = replacementCreationProfile(item, actor, worldSnapshot, entry.id);
      const futureMaximumValue = renewableCreation
        ? 0
        : irreversibleAssetFutureMaximum(usableItem, actor, worldSnapshot);
      enumerateTargetSets(worldSnapshot, actor, targetProfile(usableItem), input.beliefState).forEach((targetIds, targetIndex) => {
        const id = `${actorId}:item:${entry.id}:${targetIndex}`;
        const currentTarget = preview.findUnit(worldSnapshot, targetIds[0]);
        const assetCost = renewableCreation ? 0 : estimateIrreversibleAssetCost(usableItem, actor, entry.quantity, currentTarget, futureMaximumValue);
        candidates.push({
          candidateId: id,
          declaration: {
            actionId: id,
            actorId,
            actionKind: 'USE_ITEM',
            targetIds,
            skill: usableItem,
            irreversibleAsset: { assetId: entry.id, quantityBefore: entry.quantity, cost: assetCost },
          },
          item: usableItem,
          assetCost,
        });
      });
    });
    return candidates;
  }

  function isHardControlStateName(name = '') {
    return ['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞'].includes(String(name || '').trim());
  }

  function hasActionCancellation(unit = {}) {
    if (actionCancellationCache.has(unit)) return actionCancellationCache.get(unit);
    const result = stateEntries(unit).some(state =>
      Number(state?.__previewApplicationProbability ?? 1) >= 1 - 1e-9 && (
        isHardControlStateName(state?.状态 || state?.状态名称) ||
        state?.cannot_act === true || state?.skip_turn === true || state?.战斗效果?.cannot_act === true || state?.战斗效果?.skip_turn === true
      )
    );
    actionCancellationCache.set(unit, result);
    return result;
  }

  function actionCancellationProbability(unit = {}) {
    return 1 - stateEntries(unit).reduce((remaining, state) => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      const effects = state?.战斗效果 || {};
      const cancels = isHardControlStateName(name) ||
        state?.cannot_act === true || state?.skip_turn === true ||
        effects?.cannot_act === true || effects?.skip_turn === true;
      if (!cancels) return remaining;
      return remaining * (1 - clamp(Number(state?.__previewApplicationProbability ?? 1), 0, 1));
    }, 1);
  }

  function stateEntries(unit = {}) {
    const cached = stateEntriesCache.get(unit);
    if (cached) return cached;
    const states = unit?.状态效果;
    const result = Object.freeze(Array.isArray(states)
      ? states.filter(Boolean)
      : states && typeof states === 'object' ? Object.values(states).filter(Boolean) : []);
    stateEntriesCache.set(unit, result);
    return result;
  }

  function hasStateFlag(unit = {}, flag = '') {
    return stateEntries(unit).some(state => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      const effects = state?.战斗效果 || {};
      return effects?.[flag] === true || (flag === 'silence' && /沉默|封技/.test(name)) || (flag === 'disarm' && /缴械/.test(name));
    });
  }

  function actionQualityMultiplier(unit = {}, options = {}) {
    const cacheKey = options.ignoreActionCancellation ? 'ignoreCancellation' : 'normal';
    let cached = actionQualityCache.get(unit);
    if (cached?.has(cacheKey)) return cached.get(cacheKey);
    if (!cached) {
      cached = new Map();
      actionQualityCache.set(unit, cached);
    }
    if (!options.ignoreActionCancellation && hasActionCancellation(unit)) {
      cached.set(cacheKey, 0);
      return 0;
    }
    let multiplier = 1;
    stateEntries(unit).forEach(state => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      if (options.ignoreActionCancellation && isHardControlStateName(name)) return;
      const effects = state?.战斗效果 || {};
      const applicationProbability = clamp(Number(state?.__previewApplicationProbability ?? 1), 0, 1);
      const reactionPenalty = clamp(Number(effects?.reaction_penalty || 0), 0, 0.9);
      const castPenalty = clamp(Number(effects?.cast_speed_penalty || 0), 0, 0.9);
      multiplier *= 1 - Math.max(
        reactionPenalty * 0.55,
        castPenalty * 0.35,
      ) * applicationProbability;
    });
    const result = clamp(multiplier, 0.1, 1);
    cached.set(cacheKey, result);
    return result;
  }

  function effectiveShieldValue(unit = {}) {
    if (effectiveShieldCache.has(unit)) return effectiveShieldCache.get(unit);
    const stateShield = stateEntries(unit).reduce((maximum, state) => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      if (!/护盾/.test(name) || /破盾|护盾削减/.test(name)) return maximum;
      const raw = String(state?.数值 ?? state?.强度 ?? '').trim();
      const numeric = Math.abs(Number.parseFloat(raw));
      if (!Number.isFinite(numeric) || numeric <= 0) return maximum;
      const ratio = raw.includes('%') ? numeric / 100 : numeric <= 1 ? numeric : 0;
      return Math.max(maximum, preview.readHpMax(unit) * ratio);
    }, 0);
    const result = Math.max(preview.readShield(unit), stateShield);
    effectiveShieldCache.set(unit, result);
    return result;
  }

  function pendingHpLossBeforeNextAction(unit = {}) {
    return stateEntries(unit).reduce((total, state) => {
      const effects = state?.战斗效果 || {};
      const fixed = Math.max(0, Number(effects?.dot_damage || state?.dot_damage || 0));
      const ratio = Math.max(0, Number(effects?.dot_damage_ratio || state?.dot_damage_ratio || state?.计算层效果?.dot_damage_ratio || 0));
      return total + fixed + preview.readHpMax(unit) * ratio;
    }, 0);
  }

  function bestBaseActionValue(worldSnapshot, unit, options = {}) {
    if (!preview.isAlive(unit) || (!options.ignoreActionCancellation && hasActionCancellation(unit))) return 0;
    const cacheKey = options.ignoreActionCancellation ? 'ignoreCancellation' : 'normal';
    let cachedByOption = bestActionCache.get(unit);
    if (!cachedByOption) {
      cachedByOption = new Map();
      bestActionCache.set(unit, cachedByOption);
    }
    if (cachedByOption.has(cacheKey)) return cachedByOption.get(cacheKey);
    const side = sideOf(worldSnapshot, unit);
    const enemies = worldEntries(worldSnapshot).filter(entry => entry.side !== side).map(entry => entry.unit);
    if (!enemies.length) {
      cachedByOption.set(cacheKey, 100);
      return 100;
    }
    let best = hasStateFlag(unit, 'disarm') ? 0 : Math.max(...enemies.map(target => cachedBaseActionValue(unit, target, 'BASIC_ATTACK')), 0);
    const allies = aliveEntries(worldSnapshot).filter(entry => entry.side === side).map(entry => entry.unit);
    if (hasStateFlag(unit, 'silence')) {
      cachedByOption.set(cacheKey, best);
      return best;
    }
    collectSkills(unit).filter(skill => costAffordable(unit, skill)).forEach(skill => {
      const profile = targetProfile(skill);
      const targets = profile === 'SELF' ? [unit] : profile.startsWith('FRIENDLY') ? allies : profile === 'ANY_SINGLE' ? [...allies, ...enemies] : enemies;
      const values = targets.map(target => cachedBaseActionValue(unit, target, 'RELEASE_SKILL', skill));
      const actionValue = profile.endsWith('GROUP') ? values.reduce((sum, value) => sum + value, 0) : Math.max(0, ...values);
      best = Math.max(best, actionValue);
    });
    cachedByOption.set(cacheKey, best);
    return best;
  }

  function bestBaseActionValueAgainst(worldSnapshot, unit, target) {
    if (!preview.isAlive(unit) || !preview.isAlive(target) || hasActionCancellation(unit)) return 0;
    let targetCache = bestAgainstCache.get(unit);
    if (!targetCache) {
      targetCache = new WeakMap();
      bestAgainstCache.set(unit, targetCache);
    }
    if (targetCache.has(target)) return targetCache.get(target);
    let best = hasStateFlag(unit, 'disarm')
      ? 0
      : cachedBaseActionValue(unit, target, 'BASIC_ATTACK');
    if (hasStateFlag(unit, 'silence')) return Math.max(0, best);
    collectSkills(unit).filter(skill =>
      costAffordable(unit, skill) &&
      preview.resolveFusionAction(worldSnapshot, unit, skill, {
        resourceCosts: parseSkillCosts(skill),
        requirePendingOpportunity: true,
      }).valid
    ).forEach(skill => {
      const profile = targetProfile(skill);
      if (!profile.startsWith('HOSTILE') && profile !== 'ANY_SINGLE') return;
      best = Math.max(best, cachedBaseActionValue(unit, target, 'RELEASE_SKILL', skill));
    });
    const result = Math.max(0, best);
    targetCache.set(target, result);
    return result;
  }

  function perceivedEnemyBaseValue(beliefUnit = {}, target = null) {
    const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
    const upper = Math.max(1, Number(range[1] || range[0] || 1));
    const targetLevel = target ? unitLevel(target) : upper;
    const relativeThreat = 10 * Math.pow(upper / Math.max(1, targetLevel), 2);
    const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
    return Math.max(8, Math.min(100, relativeThreat), ...knownResponses.map(response => Math.max(0, Number(response?.baseActionValue || 0))));
  }

  function perceivedEnemyDamageValue(beliefUnit = {}, target = null) {
    const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
    const upper = Math.max(1, Number(range[1] || range[0] || 1));
    const targetLevel = target ? unitLevel(target) : upper;
    const relativeThreat = 10 * Math.pow(upper / Math.max(1, targetLevel), 2);
    const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
    return Math.max(
      8,
      Math.min(100, relativeThreat),
      ...knownResponses.map(response => Math.max(0, Number(response?.hpDamageValue || 0))),
    );
  }

  function responseHasGroupDamage(response = {}) {
    const declaration = response?.declaration || response?.incomingAction || {};
    if ((declaration?.targetIds || []).length > 1) return true;
    const skill = declaration?.skill || response?.skill || response?.incomingAction?.skill || {};
    return preview.collectEffects(skill).some(effect =>
      String(effect?.原型 || '').trim() === '伤害结算' &&
      /群体|全体|全场|范围/.test(String(effect?.目标 || '').trim())
    );
  }

  function shieldThreatProfile(worldSnapshot = {}, perspectiveSide = '', beliefState = {}) {
    let byPerspective = shieldThreatProfileCache.get(worldSnapshot);
    const cacheKey = `${perspectiveSide}|${String(beliefState?.revision || '')}`;
    if (byPerspective?.has(cacheKey)) return byPerspective.get(cacheKey);
    if (!byPerspective) {
      byPerspective = new Map();
      shieldThreatProfileCache.set(worldSnapshot, byPerspective);
    }
    const objectives = preview.normalizeBattleObjectives(worldSnapshot?.胜负条件 || {}, worldSnapshot);
    const entries = aliveEntries(worldSnapshot);
    const focusTypes = new Set([
      'HP_RATIO_AT_OR_BELOW',
      'UNIT_DAMAGED',
      'UNIT_INCAPACITATED',
      'UNIT_DEAD',
    ]);
    const focusIdsFor = targetSide => {
      const targetIsPlayer = /player|玩家|我方|己方|友方/i.test(String(targetSide || ''));
      const conditions = targetIsPlayer
        ? objectives?.defeat?.conditions || []
        : objectives?.victory?.conditions || [];
      return new Set(conditions
        .filter(condition => focusTypes.has(String(condition?.type || '').trim()))
        .flatMap(condition => condition?.targetIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean));
    };
    const profile = Object.fromEntries(entries.map(entry => {
      const target = entry.unit;
      const targetId = preview.unitId(target);
      const targetName = preview.unitName(target);
      const focusIds = focusIdsFor(entry.side);
      const singleTargetPressure = !focusIds.size || focusIds.has(targetId) || focusIds.has(targetName) ? 1 : 0;
      let singleThreatPercent = 0;
      let groupThreatPercent = 0;
      entries.filter(opposingEntry => opposingEntry.side !== entry.side).forEach(opposingEntry => {
        const beliefUnit = beliefState?.units?.[preview.unitId(opposingEntry.unit)] || {};
        singleThreatPercent = Math.max(
          singleThreatPercent,
          perceivedEnemyDamageValue(beliefUnit, target) * actionQualityMultiplier(opposingEntry.unit),
        );
        const knownGroupThreat = (beliefUnit?.knownResponses || [])
          .filter(responseHasGroupDamage)
          .reduce((maximum, response) =>
            Math.max(maximum, Math.max(0, Number(response?.hpDamageValue || 0))), 0);
        groupThreatPercent = Math.max(
          groupThreatPercent,
          knownGroupThreat * actionQualityMultiplier(opposingEntry.unit),
        );
      });
      const incomingDamage = preview.readHpMax(target) *
        Math.max(groupThreatPercent, singleThreatPercent * singleTargetPressure) / 100;
      return [targetId, Math.max(0, incomingDamage + pendingHpLossBeforeNextAction(target))];
    }));
    const frozen = Object.freeze(profile);
    byPerspective.set(cacheKey, frozen);
    return frozen;
  }

  function expectedIncomingShieldDamage(worldSnapshot = {}, target = {}, perspectiveSide = '', beliefState = {}) {
    return Math.max(
      0,
      Number(shieldThreatProfile(worldSnapshot, perspectiveSide, beliefState)?.[preview.unitId(target)] || 0),
    );
  }

  function availableShieldAbsorptionCap(worldSnapshot = {}, target = {}, perspectiveSide = '', beliefState = {}) {
    return Math.max(
      0,
      expectedIncomingShieldDamage(worldSnapshot, target, perspectiveSide, beliefState) -
      effectiveShieldValue(target),
    );
  }

  function effectiveShieldCapacityValue(worldSnapshot = {}, target = {}, perspectiveSide = '', beliefState = {}) {
    return Math.min(
      effectiveShieldValue(target),
      expectedIncomingShieldDamage(worldSnapshot, target, perspectiveSide, beliefState) * 2,
    );
  }

  function normalizedCost(unit = {}, costs = {}) {
    return Object.entries(costs || {}).reduce((sum, [resource, cost]) => {
      const maximum = Math.max(1, preview.readResourceMax(unit, resource));
      const text = String(cost ?? '').trim();
      const amount = text.includes('%')
        ? maximum * Math.max(0, Number.parseFloat(text) || 0) / 100
        : Math.max(0, Number(cost || 0));
      return sum + amount / maximum;
    }, 0);
  }

  function frozenActionCatalog(worldSnapshot = {}, unit = {}, perspectiveSide = '', beliefState = {}) {
    const unitId = preview.unitId(unit);
    const unitSide = sideOf(worldSnapshot, unit);
    if (unitSide !== perspectiveSide) {
      const beliefUnit = beliefState?.units?.[unitId] || {};
      const perceivedTargets = aliveEntries(worldSnapshot)
        .filter(entry => entry.side === perspectiveSide)
        .map(entry => entry.unit);
      const potential = Math.max(
        perceivedEnemyBaseValue(beliefUnit),
        ...perceivedTargets.map(target => perceivedEnemyBaseValue(beliefUnit, target)),
      );
      const damagePotential = Math.max(
        perceivedEnemyDamageValue(beliefUnit),
        ...perceivedTargets.map(target => perceivedEnemyDamageValue(beliefUnit, target)),
      );
      return [{
        actionKey: `${unitId}:perceived`,
        actionKind: 'PERCEIVED_ACTION',
        targetIds: [],
        potential,
        damagePotential,
        costs: {},
        costRatio: 0,
      }];
    }
    const enemies = aliveEntries(worldSnapshot).filter(entry => entry.side !== unitSide).map(entry => entry.unit);
    const allies = aliveEntries(worldSnapshot).filter(entry => entry.side === unitSide).map(entry => entry.unit);
    const actions = [];
    const targetAction = ({
      actionKey,
      actionKind,
      skill = null,
      targets = [],
      targetMode = 'SINGLE',
      costs = {},
      costRatio = 0,
      inventoryId = '',
      requiresInventoryId = '',
      creation = null,
      fusionRequired = false,
      fusionParticipantIds = [],
    }) => {
      const targetPoolIds = targets.map(preview.unitId);
      const effects = preview.collectEffects(
        actionKind === 'BASIC_ATTACK'
          ? { _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }] }
          : skill || {},
      );
      const damageEffects = effects.filter(effect => String(effect?.原型 || '').trim() === '伤害结算');
      const damagePotentialByTarget = {};
      const shieldAbsorptionCapByTarget = {};
      const potentialByTarget = Object.fromEntries(targets.map(target => {
        const targetId = preview.unitId(target);
        const shieldAbsorptionCap = availableShieldAbsorptionCap(
          worldSnapshot,
          target,
          perspectiveSide,
          beliefState,
        );
        shieldAbsorptionCapByTarget[targetId] = shieldAbsorptionCap;
        const totalPotential = preview.calculateDirectPotential(unit, target, {
          actionKind,
          skill,
          shieldAbsorptionCap,
        });
        const damagePotential = damageEffects.reduce((sum, effect) =>
          sum + preview.calculateDirectPotential(unit, target, {
            actionKind: 'RELEASE_SKILL',
            skill: { _效果数组: [effect] },
          })
        , 0);
        const realizationFactor = targetRealizationFactor(beliefState, unit, targetId, damageEffects);
        const realizedDamagePotential = damagePotential * realizationFactor;
        damagePotentialByTarget[targetId] = realizedDamagePotential;
        return [targetId, realizedDamagePotential + Math.max(0, totalPotential - damagePotential)];
      }));
      const targetPotentials = Object.values(potentialByTarget);
      const damageTargetPotentials = Object.values(damagePotentialByTarget);
      return {
        actionKey,
        ownerId: unitId,
        actionKind,
        skill,
        targetIds: targetMode === 'SELF' ? targetPoolIds : [],
        targetPoolIds,
        targetMode,
        potentialByTarget,
        damagePotentialByTarget,
        shieldAbsorptionCapByTarget,
        potential: targetMode === 'GROUP'
          ? targetPotentials.reduce((sum, value) => sum + value, 0)
          : Math.max(0, ...targetPotentials),
        damagePotential: targetMode === 'GROUP'
          ? damageTargetPotentials.reduce((sum, value) => sum + value, 0)
          : Math.max(0, ...damageTargetPotentials),
        costs,
        costRatio,
        inventoryId,
        requiresInventoryId,
        creation,
        fusionRequired,
        fusionParticipantIds,
        referenceStaminaScale: preview.staminaScaleForUnit(unit),
      };
    };
    if (!hasStateFlag(unit, 'disarm')) {
      if (enemies.length) actions.push(targetAction({
        actionKey: `${unitId}:basic`,
        actionKind: 'BASIC_ATTACK',
        targets: enemies,
        costs: {},
        costRatio: 0,
      }));
    }
    if (!hasStateFlag(unit, 'silence')) {
      collectSkills(unit).forEach((skill, index) => {
        const costs = parseSkillCosts(skill);
        const fusion = preview.resolveFusionAction(worldSnapshot, unit, skill, {
          resourceCosts: costs,
          requirePendingOpportunity: true,
        });
        if (fusion.required && !fusion.valid) return;
        const creation = creationProfile(skill, unit, worldSnapshot);
        const profile = targetProfile(skill);
        const targets = profile === 'SELF'
          ? [unit]
          : profile.startsWith('FRIENDLY')
            ? allies
            : profile === 'ANY_SINGLE'
              ? [...allies, ...enemies]
              : enemies;
        if (targets.length) {
          actions.push(targetAction({
            actionKey: `${unitId}:skill:${skillId(skill, index)}`,
            actionKind: 'RELEASE_SKILL',
            skill,
            targets,
            targetMode: profile === 'SELF' ? 'SELF' : profile.endsWith('GROUP') ? 'GROUP' : 'SINGLE',
            costs,
            costRatio: normalizedCost(unit, costs),
            creation,
            fusionRequired: fusion.required,
            fusionParticipantIds: fusion.participantIds || [],
          }));
        }
        const productSkill = creationProductSkill(creation);
        if (!productSkill) return;
        const productProfile = targetProfile(productSkill);
        const productTargets = productProfile === 'SELF'
          ? [unit]
          : productProfile.startsWith('FRIENDLY')
            ? allies
            : productProfile === 'ANY_SINGLE'
              ? [...allies, ...enemies]
              : enemies;
        if (productTargets.length) {
          actions.push(targetAction({
            actionKey: `${unitId}:created-item:${creation.productId}`,
            actionKind: 'USE_ITEM',
            skill: productSkill,
            targets: productTargets,
            targetMode: productProfile === 'SELF' ? 'SELF' : productProfile.endsWith('GROUP') ? 'GROUP' : 'SINGLE',
            costs: {},
            costRatio: 0,
            inventoryId: creation.productId,
            requiresInventoryId: creation.productId,
          }));
        }
      });
    }
    return actions;
  }

  function recoveryLockRatio(unit = {}, resource = '') {
    return Math.min(1, stateEntries(unit).reduce((maximum, state) => {
      const rules = Array.isArray(state?.资源锁定规则) ? state.资源锁定规则 : [];
      return Math.max(maximum, ...rules.map(rule => {
        const resources = Array.isArray(rule?.资源) ? rule.资源 : [];
        return resources.includes(resource) && String(rule?.锁定类型 || '').trim() === '回复锁定'
          ? Math.max(0, Number(rule?.比例 || 0))
          : 0;
      }));
    }, 0));
  }

  function snapshotAfterDeterministicRecovery(worldSnapshot = {}, actorId = '') {
    return mapWorldUnits(worldSnapshot, unit => {
      if (preview.unitId(unit) !== actorId) return unit;
      const next = {
        ...unit,
        属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : unit?.属性,
      };
      const coreCount = Math.max(0, Math.floor(Number(unit?.魂核?.核心?.数量 || 0)));
      [
        { resource: '魂力', key: 'sp', attributeKey: '魂力', ratio: 0.005 + (coreCount >= 1 ? 0.01 : 0) + (coreCount >= 3 ? 0.01 : 0) },
        { resource: '精神力', key: 'men', attributeKey: '精神力', ratio: 0.005 + (coreCount >= 2 ? 0.01 : 0) },
      ].forEach(entry => {
        const maximum = preview.readResourceMax(next, entry.resource);
        const current = preview.readResource(next, entry.resource);
        const recovery = Math.floor(maximum * entry.ratio * (1 - recoveryLockRatio(next, entry.resource)));
        const value = Math.min(maximum, current + Math.max(0, recovery));
        next[entry.key] = value;
        if (next.属性 && typeof next.属性 === 'object') next.属性[entry.attributeKey] = value;
      });
      return next;
    });
  }

  function actionLegalFromFrozen(worldSnapshot = {}, unit = {}, action = {}) {
    if (!preview.isAlive(unit)) return false;
    if (action.actionKind === 'BASIC_ATTACK' && hasStateFlag(unit, 'disarm')) return false;
    if (
      action.actionKind === 'RELEASE_SKILL' &&
      (
        hasStateFlag(unit, 'silence') ||
        !costAffordable(unit, action.skill) ||
        !preview.resolveFusionAction(worldSnapshot, unit, action.skill, {
          resourceCosts: action.costs || parseSkillCosts(action.skill),
          requirePendingOpportunity: true,
        }).valid
      )
    ) return false;
    if (
      action.creation?.productId &&
      collectInventory(unit).some(entry =>
        entry.id === action.creation.productId && entry.quantity > 0
      )
    ) return false;
    if (action.requiresInventoryId && !collectInventory(unit).some(entry =>
      entry.id === action.requiresInventoryId && entry.quantity > 0
    )) return false;
    const targetIds = action.targetPoolIds || action.targetIds || [];
    if (!targetIds.length) return true;
    return targetIds.some(targetId => {
      const target = preview.findUnit(worldSnapshot, targetId);
      return target && preview.isAlive(target);
    });
  }

  function actionPotentialFromFrozen(worldSnapshot = {}, action = {}, options = {}) {
    const potentialByTarget = action?.potentialByTarget && typeof action.potentialByTarget === 'object'
      ? action.potentialByTarget
      : null;
    const owner = options?.ownerOverride || preview.findUnit(worldSnapshot, action?.ownerId || '');
    const ownerId = preview.unitId(owner);
    const opportunityIndex = Math.max(1, Math.min(2, Number(options?.opportunityIndex || 1)));
    const targetAvailabilityById = options?.targetAvailabilityById && typeof options.targetAvailabilityById === 'object'
      ? options.targetAvailabilityById
      : {};
    const referenceStaminaScale = clamp(Number(action?.referenceStaminaScale ?? 1), 0.01, 1);
    const currentStaminaScale = owner ? preview.staminaScaleForUnit(owner) : referenceStaminaScale;
    const stateQuality = owner ? actionQualityMultiplier(owner) : 1;
    const qualityFactor = currentStaminaScale / referenceStaminaScale * stateQuality;
    if (!potentialByTarget) return Math.max(0, Number(action?.potential || 0)) * qualityFactor;
    const availableTargets = (action.targetPoolIds || action.targetIds || [])
      .filter(targetId => {
        const target = preview.findUnit(worldSnapshot, targetId);
        return target && preview.isAlive(target);
      });
    const available = availableTargets.map(targetId => {
      const target = preview.findUnit(worldSnapshot, targetId);
      const supportsOtherUnit = owner &&
        target &&
        targetId !== ownerId &&
        sideOf(worldSnapshot, owner) === sideOf(worldSnapshot, target);
      const targetAvailability = supportsOtherUnit
        ? clamp(Number(targetAvailabilityById[targetId] ?? 1), 0, 1) ** opportunityIndex
        : 1;
      if (action.actionKind !== 'USE_ITEM' || !owner) {
        return Math.max(0, Number(potentialByTarget[targetId] || 0)) * targetAvailability;
      }
      const potential = Math.max(0, preview.calculateDirectPotential(owner, target, {
        actionKind: 'USE_ITEM',
        skill: action.skill,
        shieldAbsorptionCap: Math.max(0, Number(action?.shieldAbsorptionCapByTarget?.[targetId] || 0)),
      }));
      return potential * targetAvailability;
    });
    if (!available.length) return 0;
    const potential = action.targetMode === 'GROUP'
      ? action.actionKind === 'USE_ITEM'
        ? available.reduce((sum, value) => sum + value, 0)
        : Math.max(0, Number(action?.potential || 0))
      : Math.max(...available);
    if (action.actionKind === 'USE_ITEM') return potential;
    return potential * qualityFactor;
  }

  function snapshotAfterInventoryConsumption(worldSnapshot = {}, actorId = '', inventoryId = '') {
    if (!inventoryId) return worldSnapshot;
    return mapWorldUnits(worldSnapshot, unit => {
      if (preview.unitId(unit) !== actorId) return unit;
      const next = {
        ...unit,
        背包: unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : unit?.背包,
        库存: unit?.库存 && typeof unit.库存 === 'object' ? cloneValue(unit.库存) : unit?.库存,
        物品: unit?.物品 && typeof unit.物品 === 'object' ? cloneValue(unit.物品) : unit?.物品,
        战斗物品: unit?.战斗物品 && typeof unit.战斗物品 === 'object' ? cloneValue(unit.战斗物品) : unit?.战斗物品,
      };
      const entry = collectInventory(next).find(item => item.id === inventoryId && item.quantity > 0);
      if (!entry) return next;
      const remaining = entry.quantity - 1;
      if (entry.item.数量 !== undefined || entry.item.quantity === undefined) entry.item.数量 = remaining;
      if (entry.item.quantity !== undefined) entry.item.quantity = remaining;
      return next;
    });
  }

  function snapshotWithInventoryQuantity(worldSnapshot = {}, actorId = '', inventoryId = '', quantity = 0) {
    if (!inventoryId) return worldSnapshot;
    return mapWorldUnits(worldSnapshot, unit => {
      if (preview.unitId(unit) !== actorId) return unit;
      const next = {
        ...unit,
        背包: unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : unit?.背包,
        库存: unit?.库存 && typeof unit.库存 === 'object' ? cloneValue(unit.库存) : unit?.库存,
        物品: unit?.物品 && typeof unit.物品 === 'object' ? cloneValue(unit.物品) : unit?.物品,
        战斗物品: unit?.战斗物品 && typeof unit.战斗物品 === 'object' ? cloneValue(unit.战斗物品) : unit?.战斗物品,
      };
      const entry = collectInventory(next).find(item => item.id === inventoryId);
      if (!entry) return next;
      const restoredQuantity = Math.max(0, Number(quantity || 0));
      if (entry.item.数量 !== undefined || entry.item.quantity === undefined) entry.item.数量 = restoredQuantity;
      if (entry.item.quantity !== undefined) entry.item.quantity = restoredQuantity;
      return next;
    });
  }

  function snapshotAfterCreation(worldSnapshot = {}, actorId = '', creation = null) {
    if (!creation?.productId || !Array.isArray(creation?.useEffects) || !creation.useEffects.length) return worldSnapshot;
    return mapWorldUnits(worldSnapshot, unit => {
      if (preview.unitId(unit) !== actorId) return unit;
      const next = {
        ...unit,
        背包: unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : {},
      };
      const existing = next.背包[creation.productId] && typeof next.背包[creation.productId] === 'object'
        ? next.背包[creation.productId]
        : {};
      next.背包[creation.productId] = {
        ...existing,
        id: String(existing.id || creation.productId).trim() || creation.productId,
        name: String(existing.name || creation.productId).trim() || creation.productId,
        名称: String(existing.名称 || creation.productId).trim() || creation.productId,
        物品名: String(existing.物品名 || creation.productId).trim() || creation.productId,
        数量: Math.max(0, Number(existing.数量 || 0)) + 1,
        使用效果: cloneValue(creation.useEffects),
      };
      return next;
    });
  }

  function cancellationProbabilityAtOpportunity(unit = {}, opportunityIndex = 1) {
    const naturalOpportunity = unit?.__battleRuntime?.naturalOpportunity;
    if (
      opportunityIndex === 1 &&
      String(naturalOpportunity?.status || '').trim() === 'CONSUMED_BY_FUSION'
    ) return 1;
    return 1 - stateEntries(unit).reduce((remaining, state) => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      const effects = state?.战斗效果 || {};
      const cancels = isHardControlStateName(name) ||
        state?.cannot_act === true || state?.skip_turn === true ||
        effects?.cannot_act === true || effects?.skip_turn === true;
      const duration = Math.max(1, Number(state?.duration ?? state?.持续回合 ?? 1));
      if (!cancels || duration < opportunityIndex) return remaining;
      return remaining * (1 - clamp(Number(state?.__previewApplicationProbability ?? 1), 0, 1));
    }, 1);
  }

  function availableNaturalOpportunityCount(worldSnapshot = {}, unit = {}, options = {}) {
    const objectives = preview.normalizeBattleObjectives(worldSnapshot?.胜负条件 || {}, worldSnapshot);
    const currentRound = Math.max(0, Number(worldSnapshot?.回合 || 0));
    const elapsedRounds = Math.max(0, currentRound - Number(objectives.startRound || 0));
    const futureRounds = Math.max(0, Number(objectives.maxRounds || 0) - elapsedRounds);
    const consumed = options?.currentOpportunityConsumedFor instanceof Set
      ? options.currentOpportunityConsumedFor
      : new Set(options?.currentOpportunityConsumedFor || []);
    const naturalOpportunity = unit?.__battleRuntime?.naturalOpportunity;
    const currentPending = naturalOpportunity &&
      Number(naturalOpportunity?.round || 0) === currentRound &&
      String(naturalOpportunity?.status || '').trim() === 'PENDING' &&
      !consumed.has(preview.unitId(unit))
      ? 1
      : 0;
    return currentPending + futureRounds;
  }

  function sequenceProfileFromFrozen(worldSnapshot = {}, unit = {}, catalog = [], options = {}) {
    const legalActions = catalog
      .filter(action => actionLegalFromFrozen(worldSnapshot, unit, action))
      .map(action => ({
        ...action,
        potential: actionPotentialFromFrozen(worldSnapshot, action, {
          ...options,
          opportunityIndex: 1,
        }),
      }))
      .sort((left, right) => right.potential - left.potential || left.costRatio - right.costRatio);
    const directActions = legalActions.filter(action => action.potential > 0);
    const creationActions = legalActions.filter(action =>
      action.creation?.productId &&
      Array.isArray(action.creation?.useEffects) &&
      action.creation.useEffects.length
    );
    const legalFirst = [
      ...directActions.filter(action => !action.requiresInventoryId).slice(0, 3),
      ...directActions.filter(action => action.requiresInventoryId),
      ...creationActions,
    ];
    if (!legalFirst.length) return { firstPotential: 0, secondPotential: 0, sequencePotential: 0, actionKeys: [] };
    return legalFirst.reduce((best, first) => {
      const resourcePaid = snapshotAfterResourceCosts(worldSnapshot, preview.unitId(unit), first.costs || {});
      const inventoryChanged = first.creation?.productId
        ? snapshotAfterCreation(resourcePaid, preview.unitId(unit), first.creation)
        : snapshotAfterInventoryConsumption(resourcePaid, preview.unitId(unit), first.inventoryId || '');
      const recovered = snapshotAfterDeterministicRecovery(inventoryChanged, preview.unitId(unit));
      const secondUnit = preview.findUnit(recovered, preview.unitId(unit));
      const second = catalog
        .filter(action => actionLegalFromFrozen(recovered, secondUnit, action))
        .map(action => ({
          ...action,
          potential: actionPotentialFromFrozen(recovered, action, {
            ...options,
            opportunityIndex: 2,
          }),
        }))
        .filter(action => action.potential > 0)
        .sort((left, right) => right.potential - left.potential || left.costRatio - right.costRatio)[0] || null;
      const sequencePotential = preview.calculateSequencePotential({
        firstOpportunityPotential: first.potential,
        secondOpportunityPotential: second?.potential || 0,
      });
      return sequencePotential > best.sequencePotential
        ? {
            firstPotential: first.potential,
            secondPotential: second?.potential || 0,
            sequencePotential,
            actionKeys: [first.actionKey, second?.actionKey || ''].filter(Boolean),
          }
        : best;
    }, { firstPotential: 0, secondPotential: 0, sequencePotential: 0, actionKeys: [] });
  }

  function buildNextValueContext(worldSnapshot = {}, perspectiveSide = '', beliefState = {}) {
    let byPerspective = nextValueContextCache.get(worldSnapshot);
    const beliefKey = String(beliefState?.revision || '');
    const cacheKey = `${perspectiveSide}|${beliefKey}`;
    if (byPerspective?.has(cacheKey)) return byPerspective.get(cacheKey);
    decisionMetrics.nextValueContextBuilds += 1;
    if (!byPerspective) {
      byPerspective = new Map();
      nextValueContextCache.set(worldSnapshot, byPerspective);
    }
    const rawCatalogs = {};
    const frozenDirectPotential = {};
    const frozenDamagePotential = {};
    worldEntries(worldSnapshot).forEach(entry => {
      const id = preview.unitId(entry.unit);
      const catalog = frozenActionCatalog(worldSnapshot, entry.unit, perspectiveSide, beliefState);
      rawCatalogs[id] = catalog;
      frozenDirectPotential[id] = Math.max(0, ...catalog.map(action => action.potential));
      frozenDamagePotential[id] = Math.max(0, ...catalog.map(action => action.damagePotential));
    });
    const catalogs = {};
    Object.entries(rawCatalogs).forEach(([id, catalog]) => {
      const nonDominated = catalog.filter(action => action.potential > 0).filter((action, index, all) =>
        action.requiresInventoryId || !all.some((other, otherIndex) =>
          otherIndex !== index &&
          !other.requiresInventoryId &&
          other.potential >= action.potential - 1e-9 &&
          other.costRatio <= action.costRatio + 1e-9 &&
          (other.potential > action.potential + 1e-9 || other.costRatio < action.costRatio - 1e-9)
        )
      ).sort((left, right) => right.potential - left.potential || left.costRatio - right.costRatio);
      const directActions = [
        ...nonDominated.filter(action => !action.requiresInventoryId).slice(0, 3),
        ...nonDominated.filter(action => action.requiresInventoryId),
      ];
      const directKeys = new Set(directActions.map(action => action.actionKey));
      catalogs[id] = [
        ...directActions,
        ...catalog.filter(action =>
          action.creation?.productId &&
          !directKeys.has(action.actionKey)
        ),
      ];
    });
    const result = Object.freeze({
      perspectiveSide,
      catalogs: Object.freeze(catalogs),
      frozenDirectPotential: Object.freeze(frozenDirectPotential),
      frozenDamagePotential: Object.freeze(frozenDamagePotential),
      worldSnapshot,
      beliefKey,
    });
    byPerspective.set(cacheKey, result);
    return result;
  }

  function teamCapacityProfileNext(worldSnapshot, side, perspectiveSide, beliefState = {}, nextValueContext = null, options = {}) {
    decisionMetrics.teamCapacityProfileCalls += 1;
    const valueContext = nextValueContext?.perspectiveSide === perspectiveSide
      ? nextValueContext
      : buildNextValueContext(worldSnapshot, perspectiveSide, beliefState);
    const restoredAvailability = options?.restoreActionAvailabilityFor instanceof Set
      ? options.restoreActionAvailabilityFor
      : new Set(options?.restoreActionAvailabilityFor || []);
    const cacheKey = `${side}|${perspectiveSide}|${[...restoredAvailability].map(String).sort().join(',')}`;
    let byValueContext = nextTeamCapacityCache.get(worldSnapshot);
    if (!byValueContext) {
      byValueContext = new WeakMap();
      nextTeamCapacityCache.set(worldSnapshot, byValueContext);
    }
    let byKey = byValueContext.get(valueContext);
    if (!byKey) {
      byKey = new Map();
      byValueContext.set(valueContext, byKey);
    }
    if (byKey.has(cacheKey)) {
      decisionMetrics.teamCapacityProfileCacheHits += 1;
      return byKey.get(cacheKey);
    }
    const entries = aliveEntries(worldSnapshot);
    const sideEntries = entries.filter(entry => entry.side === side);
    const dynamicCatalogs = new Map();
    const catalogFor = unit => {
      const id = preview.unitId(unit);
      if (valueContext.catalogs[id]) return valueContext.catalogs[id];
      if (!dynamicCatalogs.has(id)) {
        dynamicCatalogs.set(id, frozenActionCatalog(worldSnapshot, unit, perspectiveSide, beliefState));
      }
      return dynamicCatalogs.get(id);
    };
    const damagePotentialFor = unit => {
      const id = preview.unitId(unit);
      if (Number.isFinite(Number(valueContext.frozenDamagePotential?.[id]))) {
        return Math.max(0, Number(valueContext.frozenDamagePotential[id]));
      }
      return Math.max(0, ...catalogFor(unit).map(action => Number(action?.damagePotential || 0)));
    };
    const survivalProbabilityFor = unit => {
      const unitSide = sideOf(worldSnapshot, unit);
      const incomingThreatPercent = entries
        .filter(entry => entry.side !== unitSide)
        .reduce((maximum, opposingEntry) => {
          const threat = damagePotentialFor(opposingEntry.unit);
          return Math.max(maximum, threat * actionQualityMultiplier(opposingEntry.unit));
        }, 0);
      const shieldCapacity = effectiveShieldCapacityValue(worldSnapshot, unit, perspectiveSide, beliefState);
      const pendingHpLoss = pendingHpLossBeforeNextAction(unit);
      const effectiveHpRatio = clamp(
        (
          preview.readHp(unit) +
          shieldCapacity -
          pendingHpLoss
        ) / preview.readHpMax(unit),
        0,
        1,
      );
      const responseMargin = effectiveHpRatio - incomingThreatPercent / 100;
      const survivesNextResponse = clamp(1 / (1 + Math.exp(-32 * responseMargin)), 0.02, 0.98);
      return {
        incomingThreatPercent,
        shieldCapacity,
        pendingHpLoss,
        survivalProbability: clamp(0.35 * effectiveHpRatio + 0.65 * survivesNextResponse, 0, 1),
      };
    };
    const buildCapacity = (unit, targetAvailabilityById, survivalProbability) => {
      const id = preview.unitId(unit);
      const profile = sequenceProfileFromFrozen(worldSnapshot, unit, catalogFor(unit), {
        targetAvailabilityById,
      });
      const restoreAvailability = restoredAvailability.has(id);
      const summonWindows = String(unit?.单位性质 || '').trim() === '召唤物'
        ? Math.max(0, Math.floor(Number(
            unit?.__battleRuntime?.summonWindow?.remainingWindows ??
            unit?.__battleRuntime?.remainingWindows ??
            unit?.剩余窗口 ??
            0
          )))
        : null;
      const firstWindowAvailability = summonWindows === null || summonWindows >= 1 ? 1 : 0;
      const secondWindowAvailability = summonWindows === null || summonWindows >= 2 ? 1 : 0;
      return preview.calculateTwoOpportunityCapacity({
        unit,
        survivalProbability,
        firstOpportunityAvailability: firstWindowAvailability *
          (restoreAvailability ? 1 : 1 - cancellationProbabilityAtOpportunity(unit, 1)),
        secondOpportunityAvailability: secondWindowAvailability *
          (restoreAvailability ? 1 : 1 - cancellationProbabilityAtOpportunity(unit, 2)),
        firstOpportunityPotential: profile.firstPotential,
        secondOpportunityPotential: profile.secondPotential,
      });
    };
    const buildFullProfile = () => {
      decisionMetrics.teamCapacityFullBuilds += 1;
      decisionMetrics.teamCapacityUnitsRecomputed += sideEntries.length;
      const survivalInputsById = Object.fromEntries(entries.map(entry => [
        preview.unitId(entry.unit),
        survivalProbabilityFor(entry.unit),
      ]));
      const targetAvailabilityById = Object.fromEntries(Object.entries(survivalInputsById).map(([id, profile]) => [
        id,
        profile.survivalProbability,
      ]));
      const unitCapacities = Object.fromEntries(sideEntries.map(entry => {
        const id = preview.unitId(entry.unit);
        return [id, buildCapacity(entry.unit, targetAvailabilityById, targetAvailabilityById[id])];
      }));
      return Object.freeze({
        total: Object.values(unitCapacities).reduce((sum, value) => sum + Number(value || 0), 0),
        unitCapacities: Object.freeze(unitCapacities),
        targetAvailabilityById: Object.freeze(targetAvailabilityById),
        survivalInputsById: Object.freeze(survivalInputsById),
      });
    };
    const parentSnapshot = worldSnapshot?.__decisionCapacityParent;
    const changedUnitIds = Array.isArray(worldSnapshot?.__decisionCapacityChangedUnitIds)
      ? worldSnapshot.__decisionCapacityChangedUnitIds
      : [];
    if (parentSnapshot && Array.isArray(changedUnitIds)) {
      const parentEntries = aliveEntries(parentSnapshot);
      const sameCapableUnits =
        parentEntries.length === entries.length &&
        entries.every(entry => {
          const id = preview.unitId(entry.unit);
          const parentUnit = preview.findUnit(parentSnapshot, id);
          return parentUnit &&
            preview.isBattleCapable(parentUnit) &&
            sideOf(parentSnapshot, parentUnit) === entry.side;
        });
      if (sameCapableUnits) {
        const parentProfile = teamCapacityProfileNext(
          parentSnapshot,
          side,
          perspectiveSide,
          beliefState,
          valueContext,
          options,
        );
        if (!changedUnitIds.length) {
          byKey.set(cacheKey, parentProfile);
          return parentProfile;
        }
        const changedUnits = changedUnitIds.map(id => ({
          id,
          current: preview.findUnit(worldSnapshot, id),
          parent: preview.findUnit(parentSnapshot, id),
        })).filter(entry => entry.current && entry.parent);
        const opposingQualityChanged = changedUnits.some(entry =>
          sideOf(worldSnapshot, entry.current) !== side &&
          Math.abs(actionQualityMultiplier(entry.current) - actionQualityMultiplier(entry.parent)) > 1e-9
        );
        if (!opposingQualityChanged) {
          const targetAvailabilityById = { ...parentProfile.targetAvailabilityById };
          const survivalInputsById = { ...parentProfile.survivalInputsById };
          changedUnits.forEach(entry => {
            const survivalInput = survivalProbabilityFor(entry.current);
            survivalInputsById[entry.id] = survivalInput;
            targetAvailabilityById[entry.id] = survivalInput.survivalProbability;
          });
          const changedIds = new Set(changedUnits.map(entry => entry.id));
          const changedSides = new Map(changedUnits.map(entry => [entry.id, sideOf(worldSnapshot, entry.current)]));
          const affectedIds = new Set(sideEntries.filter(entry => {
            const unit = entry.unit;
            const id = preview.unitId(unit);
            if (changedIds.has(id)) return true;
            return catalogFor(unit).some(action => {
              const targets = action?.targetPoolIds || action?.targetIds || [];
              const targetDependency = targets.some(targetId =>
                changedIds.has(targetId) &&
                (
                  action?.actionKind === 'USE_ITEM' ||
                  sideOf(worldSnapshot, unit) === changedSides.get(targetId)
                )
              );
              if (targetDependency) return true;
              return action?.fusionRequired === true &&
                (action?.fusionParticipantIds || []).some(participantId => changedIds.has(String(participantId)));
            });
          }).map(entry => preview.unitId(entry.unit)));
          decisionMetrics.teamCapacityIncrementalBuilds += 1;
          decisionMetrics.teamCapacityUnitsRecomputed += affectedIds.size;
          const unitCapacities = { ...parentProfile.unitCapacities };
          sideEntries.forEach(entry => {
            const id = preview.unitId(entry.unit);
            if (!affectedIds.has(id)) return;
            unitCapacities[id] = buildCapacity(
              entry.unit,
              targetAvailabilityById,
              Number(targetAvailabilityById[id] || 0),
            );
          });
          const result = Object.freeze({
            total: Object.values(unitCapacities).reduce((sum, value) => sum + Number(value || 0), 0),
            unitCapacities: Object.freeze(unitCapacities),
            targetAvailabilityById: Object.freeze(targetAvailabilityById),
            survivalInputsById: Object.freeze(survivalInputsById),
          });
          byKey.set(cacheKey, result);
          return result;
        }
      }
    }
    const result = buildFullProfile();
    byKey.set(cacheKey, result);
    return result;
  }

  function teamCapacityNext(worldSnapshot, side, perspectiveSide, beliefState = {}, nextValueContext = null, options = {}) {
    return teamCapacityProfileNext(
      worldSnapshot,
      side,
      perspectiveSide,
      beliefState,
      nextValueContext,
      options,
    ).total;
  }

  function stateUtilityNext(worldSnapshot, actorSide, beliefState = {}, nextValueContext = null, options = {}) {
    decisionMetrics.stateUtilityNextCalls += 1;
    const valueContext = nextValueContext?.perspectiveSide === actorSide
      ? nextValueContext
      : buildNextValueContext(worldSnapshot, actorSide, beliefState);
    const restoreIds = options?.restoreActionAvailabilityFor instanceof Set
      ? [...options.restoreActionAvailabilityFor].map(String).sort().join(',')
      : '';
    const cacheKey = `${actorSide}|${restoreIds}`;
    let byValueContext = nextUtilityCache.get(worldSnapshot);
    if (!byValueContext) {
      byValueContext = new WeakMap();
      nextUtilityCache.set(worldSnapshot, byValueContext);
    }
    let byContext = byValueContext.get(valueContext);
    if (!byContext) {
      byContext = new Map();
      byValueContext.set(valueContext, byContext);
    }
    if (byContext.has(cacheKey)) {
      decisionMetrics.stateUtilityNextCacheHits += 1;
      return byContext.get(cacheKey);
    }
    const started = now();
    const sides = [...new Set(worldEntries(worldSnapshot).map(entry => entry.side))];
    const own = teamCapacityNext(worldSnapshot, actorSide, actorSide, beliefState, valueContext, options);
    const enemy = sides.filter(side => side !== actorSide).reduce((sum, side) =>
      sum + teamCapacityNext(worldSnapshot, side, actorSide, beliefState, valueContext, options), 0);
    const result = Object.freeze({ own, enemy, total: own + enemy, utility: own - enemy, nonDuplicatedGoalProgress: 0 });
    byContext.set(cacheKey, result);
    decisionMetrics.stateUtilityNextTimeMs += now() - started;
    return result;
  }

  function unitsBeforeTargetNextOpportunity(worldSnapshot = {}, actorId = '', targetId = '') {
    const ordered = aliveEntries(worldSnapshot)
      .map(entry => entry.unit)
      .sort(preview.compareNaturalActionOrder);
    const actorIndex = ordered.findIndex(unit => preview.unitId(unit) === actorId);
    const targetIndex = ordered.findIndex(unit => preview.unitId(unit) === targetId);
    if (actorIndex < 0 || targetIndex < 0 || actorIndex === targetIndex) return [];
    const between = [];
    for (let offset = 1; offset < ordered.length; offset += 1) {
      const unit = ordered[(actorIndex + offset) % ordered.length];
      if (preview.unitId(unit) === targetId) break;
      between.push(unit);
    }
    return between;
  }

  function deterministicRecoveryUnlocksAction(worldSnapshot = {}, actorId = '', valueContext = null) {
    const actor = preview.findUnit(worldSnapshot, actorId);
    const catalog = valueContext?.catalogs?.[actorId] || [];
    if (!actor || !catalog.length) return false;
    const bestCurrent = catalog
      .filter(action => actionLegalFromFrozen(worldSnapshot, actor, action))
      .reduce((best, action) => Math.max(best, Number(action?.potential || 0)), 0);
    const recovered = snapshotAfterDeterministicRecovery(worldSnapshot, actorId);
    const recoveredActor = preview.findUnit(recovered, actorId);
    const bestRecovered = recoveredActor
      ? catalog
          .filter(action => actionLegalFromFrozen(recovered, recoveredActor, action))
          .reduce((best, action) => Math.max(best, Number(action?.potential || 0)), 0)
      : 0;
    return bestRecovered > bestCurrent + 0.0001;
  }

  function controlWindowRealizability({
    beforeSnapshot,
    afterSnapshot,
    actor,
    actorSide,
    result,
    responseBranches: candidateResponseBranches = [],
    valueContext,
    battleIntent,
  }) {
    const cancelledContributions = (result?.contributions || [])
      .filter(entry =>
        entry?.outcomeKind === 'ACTION_CANCELLED' &&
        (
          entry?.evidence?.cancelsAction === true ||
          isHardControlStateName(entry?.evidence?.state)
        )
      );
    const targetIds = [...new Set(cancelledContributions.map(entry => String(entry?.targetId || '').trim()).filter(Boolean))];
    if (!targetIds.length) {
      return Object.freeze({
        hasCancellation: false,
        realizableTargetIds: Object.freeze([]),
        unrealizableTargetIds: Object.freeze([]),
        reasonsByTarget: Object.freeze({}),
      });
    }
    const actorId = preview.unitId(actor);
    const explicitFollowUp = (result?.contributions || []).some(entry =>
      ['ACTION_GRANTED', 'SUMMON_WINDOW'].includes(entry?.outcomeKind)) ||
      (result?.scheduledEvents || []).some(event => event?.type === 'SUMMON_CREATE');
    const survivalGoal = isSurvivalIntent({ worldSnapshot: beforeSnapshot, actorId, battleIntent });
    const actorHpRatio = preview.readHp(actor) / Math.max(1, preview.readHpMax(actor));
    const reasonsByTarget = {};
    const realizableTargetIds = [];
    const unrealizableTargetIds = [];
    targetIds.forEach(targetId => {
      const targetBefore = preview.findUnit(beforeSnapshot, targetId);
      const targetAfter = preview.findUnit(afterSnapshot, targetId);
      if (!targetBefore || !targetAfter) {
        unrealizableTargetIds.push(targetId);
        reasonsByTarget[targetId] = Object.freeze([]);
        return;
      }
      const beforeFirst = cancellationProbabilityAtOpportunity(targetBefore, 1);
      const beforeSecond = cancellationProbabilityAtOpportunity(targetBefore, 2);
      const afterFirst = cancellationProbabilityAtOpportunity(targetAfter, 1);
      const afterSecond = cancellationProbabilityAtOpportunity(targetAfter, 2);
      const addsCoverage = afterFirst > beforeFirst + 0.0001 || afterSecond > beforeSecond + 0.0001;
      const reasons = [];
      if (addsCoverage && targetBefore?.蓄力技能) reasons.push('VISIBLE_CHARGE_INTERRUPTED');
      if (addsCoverage && explicitFollowUp) reasons.push('EXPLICIT_FOLLOW_UP');
      const exploiter = unitsBeforeTargetNextOpportunity(beforeSnapshot, actorId, targetId)
        .find(unit =>
          sideOf(beforeSnapshot, unit) === actorSide &&
          !hasActionCancellation(unit) &&
          bestBaseActionValue(beforeSnapshot, unit) > 0.0001
        );
      if (addsCoverage && exploiter) reasons.push(`ALLY_WINDOW:${preview.unitId(exploiter)}`);
      if (addsCoverage && pendingHpLossBeforeNextAction(targetAfter) > 0.0001) reasons.push('PENDING_DAMAGE_WINDOW');
      if (addsCoverage && deterministicRecoveryUnlocksAction(afterSnapshot, actorId, valueContext)) reasons.push('RESOURCE_RECOVERY_UNLOCK');
      const threateningBranch = candidateResponseBranches.find(branch =>
        String(branch?.sourceActorId || '').trim() === targetId &&
        (
          branch?.lethal === true ||
          actorHpRatio <= 0.35
        )
      );
      const criticalAlly = aliveEntries(beforeSnapshot)
        .filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== actorId)
        .find(entry => {
          const hpRatio = preview.readHp(entry.unit) / Math.max(1, preview.readHpMax(entry.unit));
          return hpRatio <= 0.3 &&
            bestBaseActionValueAgainst(beforeSnapshot, targetBefore, entry.unit) >= hpRatio * 50;
        });
      if (addsCoverage && (survivalGoal || threateningBranch || criticalAlly)) reasons.push('SURVIVAL_WINDOW');
      if (addsCoverage && reasons.length) realizableTargetIds.push(targetId);
      else unrealizableTargetIds.push(targetId);
      reasonsByTarget[targetId] = Object.freeze(reasons);
    });
    return Object.freeze({
      hasCancellation: true,
      realizableTargetIds: Object.freeze(realizableTargetIds),
      unrealizableTargetIds: Object.freeze(unrealizableTargetIds),
      reasonsByTarget: Object.freeze(reasonsByTarget),
    });
  }

  function nextIntentTerminalUtility(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const objectives = preview.normalizeBattleObjectives(
      context?.battleIntent?.objectives ||
      context?.battleIntent?.胜负条件 ||
      afterSnapshot?.胜负条件 ||
      {},
      afterSnapshot,
    );
    const before = preview.evaluateBattleObjectives(beforeSnapshot, objectives, { roundCompleted: false });
    if (before.terminal) return 0;
    const after = preview.evaluateBattleObjectives(afterSnapshot, objectives, { roundCompleted: false });
    if (!after.terminal || after.winner === 'draw') return 0;
    const actorIsPlayer = /player|玩家|我方|己方|友方/i.test(String(actorSide || ''));
    return after.winner === (actorIsPlayer ? 'player' : 'enemy') ? 100 : -100;
  }

  function snapshotAfterWithdrawalSuccess(worldSnapshot = {}, actorSide = '') {
    const normalizedSide = /player|玩家|我方|己方|友方/i.test(String(actorSide || ''))
      ? 'PLAYER'
      : 'ENEMY';
    const runtime = worldSnapshot?.__battleRuntime && typeof worldSnapshot.__battleRuntime === 'object'
      ? worldSnapshot.__battleRuntime
      : {};
    return {
      ...worldSnapshot,
      __battleRuntime: {
        ...runtime,
        withdrawalSuccess: true,
        withdrawalSuccessSides: [...new Set([
          ...(Array.isArray(runtime.withdrawalSuccessSides) ? runtime.withdrawalSuccessSides : []),
          normalizedSide,
        ])],
      },
    };
  }

  function implicitIncapacitationProgressUtility(beforeSnapshot, afterSnapshot, actorSide) {
    const utility = worldEntries(beforeSnapshot)
      .filter(entry => entry.side !== actorSide && preview.isBattleCapable(entry.unit))
      .reduce((sum, entry) => {
        const targetAfter = preview.findUnit(afterSnapshot, preview.unitId(entry.unit));
        if (!targetAfter) return sum;
        const hpProgress = Math.max(
          0,
          (preview.readHp(entry.unit) - preview.readHp(targetAfter)) / Math.max(1, preview.readHpMax(entry.unit)),
        );
        if (!(hpProgress > 0)) return sum;
        const firstAvailability = 1 - cancellationProbabilityAtOpportunity(entry.unit, 1);
        const secondAvailability = 1 - cancellationProbabilityAtOpportunity(entry.unit, 2);
        const temporarilyUnrepresentedShare = clamp(
          1 - (firstAvailability + 0.5 * secondAvailability) / 1.5,
          0,
          1,
        );
        return sum + hpProgress * temporarilyUnrepresentedShare * 100;
      }, 0);
    return {
      utility,
      deadlineActive: false,
      progressGain: utility / 100,
      requiredProgress: 0,
      deadlineFeasible: true,
      source: utility > 0 ? 'IMPLICIT_INCAPACITATION_RESIDUAL' : '',
    };
  }

  function nextIntentProgressUtility(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const objectives = preview.normalizeBattleObjectives(
      context?.battleIntent?.objectives ||
      context?.battleIntent?.胜负条件 ||
      afterSnapshot?.胜负条件 ||
      {},
      afterSnapshot,
    );
    if (!objectives.explicit) {
      return implicitIncapacitationProgressUtility(beforeSnapshot, afterSnapshot, actorSide);
    }
    const hasRoundDeadline = [
      ...(objectives?.victory?.conditions || []),
      ...(objectives?.defeat?.conditions || []),
    ].some(condition => condition?.type === 'ROUND_REACHED');
    if (!hasRoundDeadline) {
      return {
        utility: 0,
        deadlineActive: false,
        progressGain: 0,
        requiredProgress: 0,
        deadlineFeasible: true,
        source: 'CAPACITY_ACCOUNTED_OBJECTIVE',
      };
    }
    return intentProgressUtility(beforeSnapshot, afterSnapshot, actorSide, {
      ...context,
      useJointIncapacitationProgress: true,
    });
  }

  function resourceRunway(unit = {}, costs = {}) {
    const entries = Object.entries(costs || {}).filter(([, rawCost]) =>
      Math.max(0, Number.parseFloat(String(rawCost ?? ''))) > 0);
    if (!entries.length) return null;
    return Math.max(0, Math.min(...entries.map(([resource, rawCost]) => {
      const maximum = Math.max(1, preview.readResourceMax(unit, resource));
      const text = String(rawCost ?? '').trim();
      const cost = text.includes('%')
        ? maximum * Math.max(0, Number.parseFloat(text) || 0) / 100
        : Math.max(0, Number(rawCost || 0));
      return cost > 0 ? Math.floor((preview.readResource(unit, resource) + 1e-9) / cost) : 20;
    })));
  }

  function meaningfulPreviewEffect(result = null, stateEffects = [], targets = []) {
    const stateHasMarginalValue = stateEffects.some(effect =>
      targets.some(target => stateEffectHasMarginalValue(effect, target)));
    const nonStateMarginalValue = (result?.contributions || []).some(entry => {
      const evidence = entry?.evidence || {};
      if (entry.outcomeKind === 'HP_DELTA') {
        return Math.abs(Number(evidence.delta ?? evidence.expectedDamage ?? entry.threatValue ?? 0)) > 0.0001;
      }
      if (entry.outcomeKind === 'SHIELD_DELTA') {
        return Math.abs(Number(
          evidence.delta ??
          (Number(evidence.next || 0) - Number(evidence.current || 0)) ??
          entry.threatValue ??
          0,
        )) > 0.0001;
      }
      if (entry.outcomeKind === 'RESOURCE_OPTION_CHANGED') {
        return Math.abs(Number(evidence.delta || 0)) > 0.0001 && evidence.windowId !== 'ACTION_COST';
      }
      if (entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
        return Math.abs(Number(evidence.delta || 0)) > 0.0001 || Number(evidence.multiplier || 0) > 0;
      }
      return [
        'ACTION_CANCELLED',
        'ACTION_GRANTED',
        'BELIEF_CHANGED',
        'RULE_CHANGED',
        'SUMMON_WINDOW',
        'IRREVERSIBLE_ASSET_LOST',
      ].includes(entry.outcomeKind);
    });
    return {
      stateHasMarginalValue,
      nonStateMarginalValue,
      hasMeaningfulEffect: (result?.scheduledEvents || []).length > 0 ||
        stateHasMarginalValue ||
        nonStateMarginalValue,
    };
  }

  function stateEffectWindowProfile(effect = {}, targetIds = [], input = {}, worldSnapshot = {}, actorSide = '') {
    const stateName = String(effect?.状态 || effect?.状态名称 || '').trim();
    const duration = Math.max(1, Number(effect?.持续回合 || 1));
    const combatEffect = preview.deriveStateCombatEffect(effect);
    const pendingNaturalActorIds = new Set(
      (input?.actionOpportunity?.pendingNaturalActorIds || []).map(value => String(value || '').trim()).filter(Boolean),
    );
    const pendingHostileActorIds = new Set(
      (input?.actionOpportunity?.pendingHostileActorIds || []).map(value => String(value || '').trim()).filter(Boolean),
    );
    const normalizedTargetIds = [...new Set((targetIds || []).map(value => String(value || '').trim()).filter(Boolean))];
    const reasons = [];
    if (
      Math.max(0, Number(combatEffect?.dot_damage || 0)) > 0 ||
      Math.max(0, Number(combatEffect?.dot_damage_ratio || 0)) > 0
    ) reasons.push('SAME_ROUND_TICK');
    if (normalizedTargetIds.some(targetId => pendingNaturalActorIds.has(targetId))) {
      reasons.push('TARGET_CURRENT_ROUND_ACTION');
    }
    const protectsFriendlyTarget = normalizedTargetIds.some(targetId => {
      const target = preview.findUnit(worldSnapshot, targetId);
      return target && sideOf(worldSnapshot, target) === actorSide;
    }) && pendingHostileActorIds.size > 0 && (
      combatEffect?.invincible === true ||
      combatEffect?.super_armor === true ||
      Number(combatEffect?.dodge_bonus || 0) > 0 ||
      Number(combatEffect?.damage_reduction || 0) > 0 ||
      Number(combatEffect?.received_damage_mult || 1) < 1
    );
    if (protectsFriendlyTarget) reasons.push('CURRENT_ROUND_RESPONSE');
    if (duration > 1) reasons.push('FUTURE_ROUND');
    return Object.freeze({
      stateName,
      duration,
      targetIds: Object.freeze(normalizedTargetIds),
      reasons: Object.freeze([...new Set(reasons)]),
      realizable: reasons.length > 0,
    });
  }

  function reactionOpportunityConsumed(worldSnapshot = {}, target = {}) {
    const counts = worldSnapshot?.__battleRuntime?.unitReactionCount || {};
    return [
      preview.unitId(target),
      preview.unitName(target),
      target?.charKey,
      target?.char_key,
      target?.key,
    ].filter(Boolean).some(key => Number(counts[key] || 0) >= 1);
  }

  function knownReactionResponses(beliefState = {}, targetId = '') {
    return (Array.isArray(beliefState?.publicResponses?.[targetId])
      ? beliefState.publicResponses[targetId]
      : []
    ).filter(response =>
      [
        String(response?.responseRole || '').trim().toUpperCase(),
        ...(Array.isArray(response?.responseRoles) ? response.responseRoles.map(role => String(role || '').trim().toUpperCase()) : []),
      ].includes('REACTION') &&
      response?.declaration &&
      typeof response.declaration === 'object'
    );
  }

  function responseHasRole(response = {}, role = '') {
    const expected = String(role || '').trim().toUpperCase();
    return [
      String(response?.responseRole || '').trim().toUpperCase(),
      ...(Array.isArray(response?.responseRoles) ? response.responseRoles.map(value => String(value || '').trim().toUpperCase()) : []),
    ].includes(expected);
  }

  function knownCounterThreat(beliefState = {}, targetId = '') {
    const responses = Array.isArray(beliefState?.publicResponses?.[targetId])
      ? beliefState.publicResponses[targetId]
      : [];
    return Math.max(0, ...responses
      .filter(response => responseHasRole(response, 'COUNTER'))
      .map(response => Math.max(0, Number(response?.baseActionValue ?? response?.utility ?? 0))));
  }

  function estimateImmediateCounterRisk({
    decisionWorld,
    actor,
    beliefState,
    result,
    reactionAudit = [],
  }) {
    if (!result || !reactionAudit.length) {
      return Object.freeze({
        entries: Object.freeze([]),
        totalExpectedThreat: 0,
        totalWorstTailThreat: 0,
      });
    }
    const actorId = preview.unitId(actor);
    const actorAfter = preview.findUnit(result.afterSnapshot, actorId);
    if (!actorAfter || !preview.isAlive(actorAfter)) {
      return Object.freeze({
        entries: Object.freeze([]),
        totalExpectedThreat: 0,
        totalWorstTailThreat: 0,
      });
    }
    const entries = reactionAudit.map(reaction => {
      const targetId = String(reaction?.targetId || '').trim();
      const targetBefore = preview.findUnit(decisionWorld, targetId);
      const targetAfter = preview.findUnit(result.afterSnapshot, targetId);
      if (
        !targetBefore ||
        !targetAfter ||
        !preview.isBattleCapable(targetAfter) ||
        hasActionCancellation(targetAfter)
      ) {
        return Object.freeze({
          ...reaction,
          counterProbability: 0,
          counterThreat: 0,
          expectedCounterThreat: 0,
          counterRiskReason: 'COUNTER_ACTOR_UNAVAILABLE',
        });
      }
      const damageContributions = (result?.contributions || []).filter(entry =>
        entry?.outcomeKind === 'HP_DELTA' &&
        String(entry?.targetId || '').trim() === targetId &&
        Math.max(0, Number(entry?.evidence?.expectedDamage || 0)) > 0
      );
      const hitProbability = 1 - damageContributions.reduce((missProbability, contribution) => {
        const evidence = contribution?.evidence || {};
        const probability = clamp(
          Number(evidence.hitProbability ?? 1) * Number(evidence.applicationProbability ?? 1),
          0,
          1,
        );
        return missProbability * (1 - probability);
      }, 1);
      const actionKind = String(reaction?.actionKind || '').trim().toUpperCase();
      const contest = preview.calculateReactionContest(targetBefore, actor);
      const baseProbability = actionKind === 'EVADE' ? 0.45 : 0.24;
      const conditionalProbability = clamp(
        baseProbability + (Number(contest?.probability || 0) - 0.25) * 0.5,
        0.08,
        0.72,
      );
      const dodgeProbability = clamp(
        Number.isFinite(Number(reaction?.dodgeProbability))
          ? Number(reaction.dodgeProbability)
          : preview.calculateDodgeProbability(targetBefore, actor, false),
        0,
        1,
      );
      const counterProbability = reaction?.opensCounterCheck === true
        ? ['DEFEND', 'GUARD'].includes(actionKind)
          ? hitProbability * conditionalProbability
          : actionKind === 'EVADE'
            ? dodgeProbability * conditionalProbability
            : actionKind === 'RELEASE_SKILL'
              ? conditionalProbability
              : 0
        : 0;
      const projectedThreat = bestBaseActionValueAgainst(decisionWorld, targetBefore, actor);
      const observedThreat = knownCounterThreat(beliefState, targetId);
      const counterThreat = Math.max(projectedThreat, observedThreat);
      return Object.freeze({
        ...reaction,
        hitProbability,
        counterProbability,
        counterThreat,
        expectedCounterThreat: counterProbability * counterThreat,
        counterRiskReason: counterProbability > 0 && counterThreat > 0
          ? observedThreat > projectedThreat + 1e-9
            ? 'OBSERVED_COUNTER_THREAT'
            : 'PROJECTED_COUNTER_THREAT'
          : 'NO_COUNTER_THREAT',
      });
    });
    return Object.freeze({
      entries: Object.freeze(entries),
      totalExpectedThreat: entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.expectedCounterThreat || 0)), 0),
      totalWorstTailThreat: entries.reduce((sum, entry) =>
        sum + (Number(entry?.counterProbability || 0) > 0 ? Math.max(0, Number(entry?.counterThreat || 0)) : 0)
      , 0),
    });
  }

  function previewCandidateWithKnownReactions({
    candidate,
    decisionWorld,
    actor,
    actorSide,
    beliefState,
    valueContext,
    input,
  }) {
    const damageEffects = preview.collectEffects(
      candidate?.declaration?.actionKind === 'BASIC_ATTACK'
        ? { _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }] }
        : candidate?.declaration?.skill || {}
    ).filter(effect => String(effect?.原型 || '').trim() === '伤害结算');
    const realizationMultiplierByTarget = Object.fromEntries(
      (candidate?.declaration?.targetIds || []).map(targetId => [
        targetId,
        targetRealizationFactor(beliefState, actor, targetId, damageEffects),
      ]),
    );
    const basePreview = (worldSnapshot, damageMultiplierByTarget = {}, suffix = 'base') => {
      const result = preview.previewAction({
        worldSnapshot,
        worldRevision: `next:${worldRevisionFor(worldSnapshot)}`,
        beliefSnapshot: beliefState,
        actorId: preview.unitId(actor),
        declaration: candidate.declaration,
        actionFingerprint: `next:${candidate.candidateId}:${suffix}`,
        damageMultiplierByTarget: Object.fromEntries(
          (candidate?.declaration?.targetIds || []).map(targetId => [
            targetId,
            clamp(
              Number(realizationMultiplierByTarget[targetId] ?? 1) *
              Number(damageMultiplierByTarget[targetId] ?? 1),
              0,
              4,
            ),
          ]),
        ),
        battleIntent: input?.battleIntent,
        horizon: 'SHALLOW',
        previewBudget: { maxNodes: 12 },
      });
      const afterSnapshot = attachDecisionRuntimeState(result.afterSnapshot, worldSnapshot);
      const hasStructuralChange =
        Object.keys(result?.changedRules || {}).length > 0 ||
        (result?.scheduledEvents || []).some(event =>
          ['SUMMON_CREATE', 'summon_create'].includes(String(event?.type || event?.eventKind || '').trim())
        );
      if (!hasStructuralChange) {
        markCapacityDeltaSnapshot(afterSnapshot, worldSnapshot, result?.changedUnitIds || []);
      }
      return Object.freeze({
        ...result,
        afterSnapshot,
      });
    };
    if (!damageEffects.length) return basePreview(decisionWorld);
    const hostileTargets = (candidate?.declaration?.targetIds || [])
      .map(targetId => preview.findUnit(decisionWorld, targetId))
      .filter(target =>
        target &&
        sideOf(decisionWorld, target) !== actorSide &&
        !reactionOpportunityConsumed(decisionWorld, target)
      );
    if (!hostileTargets.length) return basePreview(decisionWorld);
    let reactionWorld = decisionWorld;
    const damageMultiplierByTarget = {};
    const reactionAudit = [];
    hostileTargets.forEach(targetBefore => {
      const targetId = preview.unitId(targetBefore);
      const responses = knownReactionResponses(beliefState, targetId);
      if (!responses.length) return;
      const target = preview.findUnit(reactionWorld, targetId);
      if (!target || !preview.isBattleCapable(target)) return;
      let preparedResponses = responses.map(response => {
        const declaration = cloneValue(response.declaration);
        declaration.actorId = targetId;
        const previousSourceActorId = String(response?.incomingSourceActorId || '').trim();
        declaration.targetIds = (Array.isArray(declaration.targetIds) ? declaration.targetIds : [targetId])
          .map(value => String(value || '').trim() === previousSourceActorId ? preview.unitId(actor) : String(value || '').trim())
          .filter(Boolean);
        const actionKind = String(declaration?.actionKind || '').trim().toUpperCase();
        const dodgeProbability = actionKind === 'EVADE'
          ? Number.isFinite(Number(response?.dodgeProbability))
            ? clamp(response.dodgeProbability, 0, 1)
            : preview.calculateDodgeProbability(target, actor, false)
          : 0;
        const multiplier = ['DEFEND', 'GUARD'].includes(actionKind)
          ? Number.isFinite(Number(response?.damageMultiplier))
            ? clamp(response.damageMultiplier, 0, 1)
            : preview.calculateDefenseDamageMultiplier(target, actor, false)
          : actionKind === 'EVADE'
            ? 1 - dodgeProbability
            : 1;
        return { response, declaration, actionKind, multiplier, dodgeProbability, inferred: false };
      }).filter(plan => ['RELEASE_SKILL', 'DEFEND', 'GUARD', 'EVADE'].includes(plan.actionKind));
      if (!preparedResponses.length) {
        const dodgeProbability = preview.calculateDodgeProbability(target, actor, false);
        preparedResponses = [
          {
            response: { responseId: 'RULE_KNOWN:DEFEND' },
            declaration: { actorId: targetId, actionKind: 'DEFEND', targetIds: [targetId] },
            actionKind: 'DEFEND',
            multiplier: preview.calculateDefenseDamageMultiplier(target, actor, false),
            dodgeProbability: 0,
            inferred: true,
          },
          {
            response: { responseId: 'RULE_KNOWN:EVADE' },
            declaration: { actorId: targetId, actionKind: 'EVADE', targetIds: [targetId] },
            actionKind: 'EVADE',
            multiplier: 1 - dodgeProbability,
            dodgeProbability,
            inferred: true,
          },
        ];
      }
      if (preparedResponses.every(plan => plan.actionKind !== 'RELEASE_SKILL')) {
        const selectedPlan = preparedResponses.reduce((best, plan) =>
          !best || plan.multiplier < best.multiplier ? plan : best
        , null);
        damageMultiplierByTarget[targetId] = selectedPlan.multiplier;
        reactionWorld = snapshotWithConsumedReaction(reactionWorld, target);
        reactionAudit.push(Object.freeze({
          targetId,
          responseId: String(selectedPlan.response?.responseId || '').trim(),
          actionKind: selectedPlan.actionKind,
          actionName: candidateActionName({ declaration: selectedPlan.declaration }),
          damageMultiplier: selectedPlan.multiplier,
          dodgeProbability: selectedPlan.dodgeProbability,
          counterGranted: preview.declarationGrantsCounter(selectedPlan.declaration),
          opensCounterCheck: selectedPlan.actionKind === 'EVADE'
            ? selectedPlan.dodgeProbability > 0
            : ['DEFEND', 'GUARD'].includes(selectedPlan.actionKind)
              ? selectedPlan.response?.preparedDefense !== true
              : preview.declarationGrantsCounter(selectedPlan.declaration),
          preparedDefense: selectedPlan.response?.preparedDefense === true,
          replayedSkill: false,
          inferred: selectedPlan.inferred === true,
        }));
        return;
      }
      let selectedPlan = null;
      preparedResponses.forEach(plan => {
        const { response, declaration, actionKind } = plan;
        let planWorld = reactionWorld;
        let multiplier = plan.multiplier;
        let reactionPreview = null;
        try {
          if (actionKind === 'RELEASE_SKILL') {
            const reactionActor = preview.findUnit(planWorld, targetId);
            if (!reactionActor || !declaration.skill || !costAffordable(reactionActor, declaration.skill)) return;
            reactionPreview = preview.previewAction({
              worldSnapshot: planWorld,
              worldRevision: `reaction:${worldRevisionFor(planWorld)}`,
              beliefSnapshot: beliefState,
              actorId: targetId,
              declaration,
              actionFingerprint: `reaction:${candidate.candidateId}:${targetId}:${response.responseId}`,
              battleIntent: input?.battleIntent,
              horizon: 'SHALLOW',
              previewBudget: { maxNodes: 12 },
            });
            planWorld = reactionPreview.afterSnapshot;
          }
          const multipliers = { ...damageMultiplierByTarget, [targetId]: multiplier };
          const attackPreview = basePreview(
            planWorld,
            multipliers,
            `reaction:${targetId}:${response.responseId}`,
          );
          const attackerUtility = stateUtilityNext(
            attackPreview.afterSnapshot,
            actorSide,
            beliefState,
            valueContext,
          ).utility;
          if (!selectedPlan ||
            attackerUtility < selectedPlan.attackerUtility - 1e-9 ||
            Math.abs(attackerUtility - selectedPlan.attackerUtility) <= 1e-9 && multiplier < selectedPlan.multiplier
          ) {
            selectedPlan = {
              response,
              declaration,
              reactionWorld: planWorld,
              multiplier,
              attackerUtility,
              reactionPreview,
              dodgeProbability: plan.dodgeProbability,
              inferred: plan.inferred === true,
            };
          }
        } catch {
          // A previously observed response can become illegal after resource or state changes.
        }
      });
      if (!selectedPlan) return;
      reactionWorld = snapshotWithConsumedReaction(selectedPlan.reactionWorld, target);
      damageMultiplierByTarget[targetId] = selectedPlan.multiplier;
      reactionAudit.push(Object.freeze({
        targetId,
        responseId: String(selectedPlan.response?.responseId || '').trim(),
        actionKind: String(selectedPlan.declaration?.actionKind || '').trim(),
        actionName: candidateActionName({ declaration: selectedPlan.declaration }),
        damageMultiplier: selectedPlan.multiplier,
        dodgeProbability: selectedPlan.dodgeProbability,
        counterGranted: preview.declarationGrantsCounter(selectedPlan.declaration),
        opensCounterCheck: String(selectedPlan.declaration?.actionKind || '').trim().toUpperCase() === 'EVADE'
          ? selectedPlan.dodgeProbability > 0 && selectedPlan.response?.preparedDefense !== true
          : ['DEFEND', 'GUARD'].includes(String(selectedPlan.declaration?.actionKind || '').trim().toUpperCase())
            ? selectedPlan.response?.preparedDefense !== true
            : preview.declarationGrantsCounter(selectedPlan.declaration),
        preparedDefense: selectedPlan.response?.preparedDefense === true,
        replayedSkill: selectedPlan.reactionPreview !== null,
        inferred: selectedPlan.inferred === true,
      }));
    });
    const result = basePreview(
      reactionWorld,
      damageMultiplierByTarget,
      `known-reactions:${preview.stableHash(reactionAudit)}`,
    );
    const immediateCounterRisk = estimateImmediateCounterRisk({
      decisionWorld,
      actor,
      beliefState,
      result,
      reactionAudit,
    });
    return Object.freeze({
      ...result,
      immediateReactionAudit: immediateCounterRisk.entries,
      immediateCounterRisk,
    });
  }

  function previewTeamReactionSequence({
    decisionWorld,
    candidateSnapshot,
    result,
    actor,
    actorSide,
    beliefState,
    valueContext,
    input,
  }) {
    if (String(input?.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase() !== 'ACTIVE') return null;
    const reactionTargets = [...new Set((result?.immediateReactionAudit || [])
      .map(entry => String(entry?.targetId || '').trim())
      .filter(Boolean))];
    if (!reactionTargets.length) return null;
    const focusTargetId = reactionTargets
      .map(targetId => preview.findUnit(candidateSnapshot, targetId))
      .filter(target => target && preview.isBattleCapable(target))
      .sort((left, right) =>
        (preview.readHp(left) + effectiveShieldValue(left)) / Math.max(1, preview.readHpMax(left)) -
        (preview.readHp(right) + effectiveShieldValue(right)) / Math.max(1, preview.readHpMax(right)) ||
        preview.unitId(left).localeCompare(preview.unitId(right))
      )[0];
    if (!focusTargetId) return null;
    const targetId = preview.unitId(focusTargetId);
    const ordered = aliveEntries(decisionWorld)
      .map(entry => entry.unit)
      .sort(preview.compareNaturalActionOrder);
    const actorIndex = ordered.findIndex(unit => preview.unitId(unit) === preview.unitId(actor));
    if (actorIndex < 0) return null;
    const exploiters = ordered.slice(actorIndex + 1)
      .filter(unit =>
        sideOf(decisionWorld, unit) === actorSide &&
        preview.isBattleCapable(unit)
      )
      .map(unit => {
        const action = (valueContext?.catalogs?.[preview.unitId(unit)] || [])
          .filter(entry =>
            entry?.actionKind === 'BASIC_ATTACK' &&
            (entry?.targetPoolIds || []).includes(targetId) &&
            actionLegalFromFrozen(decisionWorld, unit, entry)
          )
          .sort((left, right) =>
            Number(right?.potentialByTarget?.[targetId] || 0) -
            Number(left?.potentialByTarget?.[targetId] || 0)
          )[0];
        return action ? { unit, action } : null;
      })
      .filter(Boolean)
      .slice(0, 3);
    if (!exploiters.length) return null;
    let candidateWorld = candidateSnapshot;
    let noOpWorld = decisionWorld;
    const actions = [];
    exploiters.forEach(({ unit, action }, index) => {
      const candidateTarget = preview.findUnit(candidateWorld, targetId);
      if (!candidateTarget || !preview.isBattleCapable(candidateTarget)) return;
      const actorId = preview.unitId(unit);
      const declaration = {
        actorId,
        actionKind: action.actionKind,
        targetIds: [targetId],
      };
      const branchCandidate = {
        candidateId: `team-reaction:${preview.unitId(actor)}:${actorId}:${targetId}:${index + 1}`,
        declaration,
      };
      const previewBranch = worldSnapshot => {
        const branchActor = preview.findUnit(worldSnapshot, actorId);
        if (!branchActor || !preview.isBattleCapable(branchActor)) return null;
        const branch = previewCandidateWithKnownReactions({
          candidate: branchCandidate,
          decisionWorld: worldSnapshot,
          actor: branchActor,
          actorSide,
          beliefState,
          valueContext,
          input,
        });
        return Number(branch?.immediateCounterRisk?.totalExpectedThreat || 0) > 0
          ? snapshotAfterResponseThreat(
              branch.afterSnapshot,
              actorId,
              branch.immediateCounterRisk.totalExpectedThreat,
            )
          : branch.afterSnapshot;
      };
      const nextCandidateWorld = previewBranch(candidateWorld);
      const nextNoOpWorld = previewBranch(noOpWorld);
      if (!nextCandidateWorld || !nextNoOpWorld) return;
      candidateWorld = nextCandidateWorld;
      noOpWorld = nextNoOpWorld;
      actions.push(Object.freeze({
        actorId,
        actionKind: action.actionKind,
        targetId,
        directPotential: Math.max(0, Number(action?.potentialByTarget?.[targetId] || 0)),
      }));
    });
    if (!actions.length) return null;
    return Object.freeze({
      candidateSnapshot: candidateWorld,
      noOpSnapshot: noOpWorld,
      audit: Object.freeze({
        targetId,
        exploitActionCount: actions.length,
        actions: Object.freeze(actions),
      }),
    });
  }

  function projectFutureAction({
    candidate,
    futureWorld,
    actor,
    actorSide,
    beliefState,
    input,
  }) {
    const valueContext = buildNextValueContext(futureWorld, actorSide, beliefState);
    const before = stateUtilityNext(futureWorld, actorSide, beliefState, valueContext);
    const futureInput = {
      ...input,
      worldSnapshot: futureWorld,
      actorId: preview.unitId(actor),
      beliefState,
      actionOpportunity: {
        role: 'ACTIVE',
        sequence: Math.max(0, Number(input?.actionOpportunity?.sequence || 0)) + 1,
        futureHostileResponseAllowed: false,
      },
    };
    const result = ['RELEASE_SKILL', 'BASIC_ATTACK', 'USE_ITEM', 'EQUIP'].includes(
      String(candidate?.declaration?.actionKind || '').trim(),
    )
      ? previewCandidateWithKnownReactions({
          candidate,
          decisionWorld: futureWorld,
          actor,
          actorSide,
          beliefState,
          valueContext,
          input: futureInput,
        })
      : null;
    const immediateRisk = result?.immediateCounterRisk || {
      totalExpectedThreat: 0,
      totalWorstTailThreat: 0,
    };
    // A renewable item has no irreversible asset cost, but using it still consumes
    // the current stock. The next opportunity may recreate another one; it must
    // not receive both the use effect and the pre-use inventory capacity.
    const settledSnapshot = result?.afterSnapshot || futureWorld;
    const afterSnapshot = immediateRisk.totalExpectedThreat > 0
      ? snapshotAfterResponseThreat(settledSnapshot, preview.unitId(actor), immediateRisk.totalExpectedThreat)
      : settledSnapshot;
    const after = stateUtilityNext(afterSnapshot, actorSide, beliefState, valueContext);
    const terminalDelta = nextIntentTerminalUtility(futureWorld, afterSnapshot, actorSide, futureInput) -
      nextIntentTerminalUtility(futureWorld, futureWorld, actorSide, futureInput);
    const progressDelta = nextIntentProgressUtility(futureWorld, afterSnapshot, actorSide, futureInput).utility -
      nextIntentProgressUtility(futureWorld, futureWorld, actorSide, futureInput).utility;
    const irreversibleCost = (result?.contributions || [])
      .filter(entry => entry?.outcomeKind === 'IRREVERSIBLE_ASSET_LOST')
      .reduce((sum, entry) => sum + Math.max(0, Number(entry?.threatValue || entry?.evidence?.cost || 0)), 0);
    const utility = clamp(
      100 * (after.utility - before.utility) / Math.max(1, before.total) +
        terminalDelta +
        progressDelta -
        irreversibleCost,
      -200,
      200,
    );
    return Object.freeze({
      candidateId: String(candidate?.candidateId || '').trim(),
      actionKind: String(candidate?.declaration?.actionKind || '').trim(),
      utility,
      worstTailCapacityLoss: Math.max(0, Number(immediateRisk.totalWorstTailThreat || 0)),
      hasMeaningfulEffect: !!result && meaningfulPreviewEffect(
        result,
        preview.collectEffects(candidate.skill || candidate.declaration?.skill || {})
          .filter(effect => String(effect?.原型 || '').trim() === '状态施加'),
        (candidate?.declaration?.targetIds || [])
          .map(targetId => preview.findUnit(futureWorld, targetId))
          .filter(Boolean),
      ).hasMeaningfulEffect,
    });
  }

  function creationFutureUseAudit({
    candidate,
    decisionWorld,
    afterSnapshot,
    actor,
    actorSide,
    beliefState,
    input,
  }) {
    if (!candidate?.creation?.useful) return null;
    const actorId = preview.unitId(actor);
    const remainingOpportunities = availableNaturalOpportunityCount(decisionWorld, actor, {
      currentOpportunityConsumedFor: new Set([actorId]),
    });
    const futureRound = Math.max(0, Number(decisionWorld?.回合 || 0)) +
      Math.max(1, Number(candidate.creation.productionWindow || 1));
    if (remainingOpportunities < Math.max(1, Number(candidate.creation.productionWindow || 1))) {
      return Object.freeze({
        realizable: false,
        reason: 'NO_REMAINING_NATURAL_OPPORTUNITY',
        remainingOpportunities,
        futureRound,
        itemCandidateId: '',
        itemUtility: 0,
        bestAlternativeUtility: 0,
        dominatedBy: '',
      });
    }
    const futureWorld = mapWorldUnits(
      { ...afterSnapshot, 回合: futureRound },
      unit => {
        if (preview.unitId(unit) !== actorId) return unit;
        return {
          ...unit,
          __battleRuntime: {
            ...(unit?.__battleRuntime || {}),
            naturalOpportunity: {
              round: futureRound,
              opportunityId: `preview-natural:${futureRound}:${actorId}`,
              status: 'PENDING',
              consumedByActionId: '',
              fusionKey: '',
            },
          },
        };
      },
    );
    const futureCandidates = enumerateCandidates({
      ...input,
      worldSnapshot: futureWorld,
      actorId,
      beliefState,
      actionOpportunity: {
        role: 'ACTIVE',
        sequence: Math.max(0, Number(input?.actionOpportunity?.sequence || 0)) + 1,
        futureHostileResponseAllowed: false,
      },
    }).filter(futureCandidate => !futureCandidate.creation);
    const futureActor = preview.findUnit(futureWorld, actorId);
    const futureScores = futureCandidates.map(futureCandidate => projectFutureAction({
      candidate: futureCandidate,
      futureWorld,
      actor: futureActor,
      actorSide,
      beliefState,
      input,
    }));
    const productId = String(candidate.creation.productId || '').trim();
    const itemScores = futureScores.filter(score =>
      score.actionKind === 'USE_ITEM' &&
      String(futureCandidates.find(item => item.candidateId === score.candidateId)?.declaration?.irreversibleAsset?.assetId || '').trim() === productId
    );
    const itemScore = itemScores
      .filter(score => score.hasMeaningfulEffect && score.utility > 0.0001)
      .sort((left, right) => right.utility - left.utility)[0] ||
      itemScores.sort((left, right) => right.utility - left.utility)[0] ||
      null;
    const dominator = itemScore
      ? futureScores.find(score =>
          score !== itemScore &&
          score.hasMeaningfulEffect &&
          score.utility >= itemScore.utility - 1e-9 &&
          score.worstTailCapacityLoss <= itemScore.worstTailCapacityLoss + 1e-9 &&
          (
            score.utility > itemScore.utility + 1e-9 ||
            score.worstTailCapacityLoss < itemScore.worstTailCapacityLoss - 1e-9
          )
        )
      : null;
    const bestAlternative = futureScores
      .filter(score => score !== itemScore && score.hasMeaningfulEffect)
      .sort((left, right) => right.utility - left.utility)[0] ||
      null;
    const realizable = !!itemScore && itemScore.hasMeaningfulEffect && itemScore.utility > 0.0001 && !dominator;
    return Object.freeze({
      realizable,
      reason: realizable
        ? 'NON_DOMINATED_FUTURE_USE'
        : dominator ? 'FUTURE_USE_DOMINATED' : 'FUTURE_USE_UNAVAILABLE',
      remainingOpportunities,
      futureRound,
      itemCandidateId: String(itemScore?.candidateId || '').trim(),
      itemUtility: Number(itemScore?.utility || 0),
      bestAlternativeUtility: Number(bestAlternative?.utility || 0),
      dominatedBy: String(dominator?.candidateId || '').trim(),
    });
  }

  function scoreCandidatesNext(input = {}) {
    if (input?.__preparedDecisionWorld !== true) resetDecisionCaches();
    const worldSnapshot = input?.worldSnapshot;
    const sourceActor = preview.findUnit(worldSnapshot, input?.actorId || '');
    if (!worldSnapshot || !sourceActor || !preview.isAlive(sourceActor)) throw new Error('battle_next_value_context_invalid');
    const beliefState = input?.__preparedBeliefState || buildInitialBelief(worldSnapshot, preview.unitId(sourceActor), input?.beliefState || {});
    const decisionWorld = input?.__preparedDecisionWorld === true
      ? worldSnapshot
      : buildDecisionWorld(worldSnapshot, preview.unitId(sourceActor), beliefState);
    const actor = preview.findUnit(decisionWorld, preview.unitId(sourceActor));
    const actorSide = sideOf(decisionWorld, actor);
    const valueContext = buildNextValueContext(decisionWorld, actorSide, beliefState);
    const before = stateUtilityNext(decisionWorld, actorSide, beliefState, valueContext);
    const actorObjectives = objectiveActorContext(decisionWorld, actorSide, input?.battleIntent || {});
    const withdrawalIsSuccessGoal = actorObjectives.successConditions
      .some(condition => condition.type === 'WITHDRAW_SUCCESS');
    const actorId = preview.unitId(actor);
    const noDamageFailureActive = actorObjectives.failureConditions.some(condition =>
      condition.type === 'UNIT_DAMAGED' &&
      condition.side === actorObjectives.ownSide &&
      (
        !condition.targetIds?.length ||
        condition.targetIds.includes(actorId) ||
        condition.targetIds.includes(preview.unitName(actor))
      )
    );
    const responseContext = {
      ...input,
      worldSnapshot: decisionWorld,
      actorId: preview.unitId(actor),
      beliefState,
    };
    const sharedResponseBranches = responseContext.actionOpportunity?.role === 'COUNTER'
      ? []
      : responseBranches(responseContext);
    const candidates = Array.isArray(input?.__frozenCandidates) ? input.__frozenCandidates : enumerateCandidates({
      ...input,
      worldSnapshot: decisionWorld,
      actorId: preview.unitId(actor),
      beliefState,
    });
    const scored = candidates.map(candidate => {
      const candidateDamageEffects = preview.collectEffects(
        candidate?.declaration?.actionKind === 'BASIC_ATTACK'
          ? { _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }] }
          : candidate?.declaration?.skill || {},
      ).filter(effect => String(effect?.原型 || '').trim() === '伤害结算');
      const result = ['RELEASE_SKILL', 'BASIC_ATTACK', 'USE_ITEM', 'EQUIP'].includes(candidate?.declaration?.actionKind)
        ? previewCandidateWithKnownReactions({
            candidate,
            decisionWorld,
            actor,
            actorSide,
            beliefState,
            valueContext,
            input,
          })
        : null;
      const afterSnapshot = result?.afterSnapshot || decisionWorld;
      const immediateCounterRisk = result?.immediateCounterRisk || {
        entries: Object.freeze([]),
        totalExpectedThreat: 0,
        totalWorstTailThreat: 0,
      };
      const creationUseAudit = result ? creationFutureUseAudit({
        candidate,
        decisionWorld,
        afterSnapshot,
        actor,
        actorSide,
        beliefState,
        input,
      }) : null;
      let candidateSnapshot = immediateCounterRisk.totalExpectedThreat > 0
        ? snapshotAfterResponseThreat(afterSnapshot, preview.unitId(actor), immediateCounterRisk.totalExpectedThreat)
        : afterSnapshot;
      if (creationUseAudit && !creationUseAudit.realizable) {
        candidateSnapshot = snapshotWithInventoryQuantity(
          candidateSnapshot,
          preview.unitId(actor),
          candidate.creation.productId,
          candidate.creation.stock,
        );
      }
      let noOpSnapshot = decisionWorld;
      const immediateCounterTailSnapshot = immediateCounterRisk.totalWorstTailThreat > 0
        ? snapshotAfterResponseThreat(afterSnapshot, preview.unitId(actor), immediateCounterRisk.totalWorstTailThreat)
        : candidateSnapshot;
      const teamReactionSequence = result ? previewTeamReactionSequence({
        decisionWorld,
        candidateSnapshot,
        result,
        actor,
        actorSide,
        beliefState,
        valueContext,
        input,
      }) : null;
      if (teamReactionSequence) {
        candidateSnapshot = teamReactionSequence.candidateSnapshot;
        noOpSnapshot = teamReactionSequence.noOpSnapshot;
      }
      const controlWindowAudit = controlWindowRealizability({
        beforeSnapshot: decisionWorld,
        afterSnapshot,
        actor,
        actorSide,
        result,
        responseBranches: sharedResponseBranches,
        valueContext,
        battleIntent: input?.battleIntent,
      });
      const unrealizableControlTargets = new Set(controlWindowAudit.unrealizableTargetIds);
      const controlCapacityOptions = unrealizableControlTargets.size
        ? { restoreActionAvailabilityFor: unrealizableControlTargets }
        : {};
      const after = stateUtilityNext(candidateSnapshot, actorSide, beliefState, valueContext, controlCapacityOptions);
      const noOp = stateUtilityNext(noOpSnapshot, actorSide, beliefState, valueContext);
      const immediateCounterTail = stateUtilityNext(
        immediateCounterTailSnapshot,
        actorSide,
        beliefState,
        valueContext,
        controlCapacityOptions,
      );
      const actionKind = String(candidate?.declaration?.actionKind || '').trim();
      const withdrawalProfile = actionKind === 'WITHDRAW'
        ? aliveEntries(decisionWorld)
            .filter(entry => entry.side !== actorSide)
            .map(entry => ({
              targetId: preview.unitId(entry.unit),
              estimate: preview.estimateWithdrawal(actor, entry.unit),
            }))
            .sort((left, right) =>
              left.estimate.successProbability - right.estimate.successProbability ||
              left.targetId.localeCompare(right.targetId)
            )[0] || null
        : null;
      const withdrawalEstimate = withdrawalProfile?.estimate || null;
      const withdrawalObservation = withdrawalProfile
        ? (() => {
            const relevantFingerprint = relevantStateFingerprint(beliefState, withdrawalProfile.targetId);
            const key = mechanicKey({
              sourceActionId: 'WITHDRAW',
              effectPrototype: '撤离判定',
              targetId: withdrawalProfile.targetId,
              relevantStateFingerprint: relevantFingerprint,
            });
            return Object.freeze({
              mechanicKey: key,
              sourceActionId: 'WITHDRAW',
              effectPrototype: '撤离判定',
              targetId: withdrawalProfile.targetId,
              stateName: '撤离',
              relevantStateFingerprint: relevantFingerprint,
              estimatedProbability: withdrawalEstimate.successProbability,
              experience: experienceOf(actor),
              posterior: mechanicPosterior(
                beliefState,
                key,
                withdrawalEstimate.successProbability,
                experienceOf(actor),
              ),
            });
          })()
        : null;
      const withdrawalProbability = clamp(
        Number(withdrawalObservation?.posterior ?? withdrawalEstimate?.successProbability ?? 0),
        0,
        1,
      );
      const existingDefenseKind = String(
        actor?.__battleRuntime?.activeDefenseStance?.type ||
        actor?.__battleRuntime?.activeDefenseStance?.actionKind ||
        '',
      ).trim().toUpperCase();
      const candidateDefenseKind = ['DEFEND', 'EVADE', 'GUARD'].includes(actionKind) ? actionKind : '';
      const branchMass = clamp(sharedResponseBranches.reduce((sum, branch) => sum + Number(branch?.probability || 0), 0), 0, 1);
      const afterTerminalUtility = nextIntentTerminalUtility(decisionWorld, candidateSnapshot, actorSide, responseContext);
      const afterProgress = nextIntentProgressUtility(decisionWorld, candidateSnapshot, actorSide, responseContext);
      const beforeTerminalUtility = nextIntentTerminalUtility(decisionWorld, noOpSnapshot, actorSide, responseContext);
      const beforeProgress = nextIntentProgressUtility(decisionWorld, noOpSnapshot, actorSide, responseContext);
      let responseComparison = sharedResponseBranches.reduce((totals, branch) => {
        const probability = Math.max(0, Number(branch?.probability || 0));
        const sourceBefore = preview.findUnit(decisionWorld, branch?.sourceActorId || '');
        const sourceAfter = preview.findUnit(candidateSnapshot, branch?.sourceActorId || '');
        const sourceNoOp = preview.findUnit(noOpSnapshot, branch?.sourceActorId || '');
        const ordinaryReactionMultiplier = sourceBefore
          ? Math.min(
              preview.calculateDefenseDamageMultiplier(actor, sourceBefore, false),
              1 - preview.calculateDodgeProbability(actor, sourceBefore, false),
            )
          : 1;
        const preparedMultiplier = kind => {
          if (!sourceBefore) return 1;
          if (['DEFEND', 'GUARD'].includes(kind)) {
            return preview.calculateDefenseDamageMultiplier(actor, sourceBefore, true);
          }
          if (kind === 'EVADE') return 1 - preview.calculateDodgeProbability(actor, sourceBefore, true);
          return ordinaryReactionMultiplier;
        };
        const baselineDefenseMultiplier = existingDefenseKind
          ? preparedMultiplier(existingDefenseKind)
          : ordinaryReactionMultiplier;
        const candidateDefenseMultiplier = candidateDefenseKind
          ? preparedMultiplier(candidateDefenseKind)
          : baselineDefenseMultiplier;
        const sourceId = String(branch?.sourceActorId || '').trim();
        const responsePrevented = !!sourceBefore && (
          !sourceAfter ||
          !preview.isBattleCapable(sourceAfter) ||
          (!unrealizableControlTargets.has(sourceId) && hasActionCancellation(sourceAfter))
        );
        const baselineResponsePrevented = !!sourceBefore &&
          (!sourceNoOp || !preview.isBattleCapable(sourceNoOp) || hasActionCancellation(sourceNoOp));
        const candidateResponseQuality = sourceAfter ? actionQualityMultiplier(sourceAfter) : 0;
        const baselineResponseQuality = sourceNoOp ? actionQualityMultiplier(sourceNoOp) : 0;
        const candidateThreat = responsePrevented
          ? 0
          : Math.max(0, Number(branch?.rawThreat || 0)) *
            candidateDefenseMultiplier *
            candidateResponseQuality;
        const baselineThreat = baselineResponsePrevented
          ? 0
          : Math.max(0, Number(branch?.rawThreat || 0)) *
            baselineDefenseMultiplier *
            baselineResponseQuality;
        const candidateResponseSnapshot = snapshotAfterResponseThreat(candidateSnapshot, preview.unitId(actor), candidateThreat);
        const candidateTailResponseSnapshot = snapshotAfterResponseThreat(
          immediateCounterTailSnapshot,
          preview.unitId(actor),
          candidateThreat,
        );
        const baselineResponseSnapshot = snapshotAfterResponseThreat(noOpSnapshot, preview.unitId(actor), baselineThreat);
        const candidateResponse = stateUtilityNext(
          candidateResponseSnapshot,
          actorSide,
          beliefState,
          valueContext,
          controlCapacityOptions,
        );
        const candidateTailResponse = stateUtilityNext(
          candidateTailResponseSnapshot,
          actorSide,
          beliefState,
          valueContext,
          controlCapacityOptions,
        );
        const baselineResponse = stateUtilityNext(
          baselineResponseSnapshot,
          actorSide,
          beliefState,
          valueContext,
        );
        const candidateCatastrophicRisk = catastrophicResponseRisk(actor, branch?.rawThreat, candidateDefenseMultiplier);
        const baselineCatastrophicRisk = catastrophicResponseRisk(actor, branch?.rawThreat, baselineDefenseMultiplier);
        let candidateTerminalUtility = nextIntentTerminalUtility(
          decisionWorld,
          candidateResponseSnapshot,
          actorSide,
          responseContext,
        );
        let baselineTerminalUtility = nextIntentTerminalUtility(
          decisionWorld,
          baselineResponseSnapshot,
          actorSide,
          responseContext,
        );
        if (noDamageFailureActive && sourceBefore && Math.max(0, Number(branch?.rawThreat || 0)) > 0) {
          const ordinaryAvoidance = preview.calculateDodgeProbability(actor, sourceBefore, false);
          const preparedAvoidance = preview.calculateDodgeProbability(actor, sourceBefore, true);
          const baselineAvoidance = existingDefenseKind === 'EVADE'
            ? preparedAvoidance
            : ordinaryAvoidance;
          const candidateAvoidance = candidateDefenseKind === 'EVADE'
            ? preparedAvoidance
            : candidateDefenseKind
              ? 0
              : baselineAvoidance;
          candidateTerminalUtility = -100 * (
            responsePrevented ? 0 : clamp(1 - candidateAvoidance, 0, 1)
          );
          baselineTerminalUtility = -100 * (
            baselineResponsePrevented ? 0 : clamp(1 - baselineAvoidance, 0, 1)
          );
        }
        const candidateProgress = nextIntentProgressUtility(
          decisionWorld,
          candidateResponseSnapshot,
          actorSide,
          responseContext,
        ).utility;
        const baselineProgress = nextIntentProgressUtility(
          decisionWorld,
          baselineResponseSnapshot,
          actorSide,
          responseContext,
        ).utility;
        return {
          candidateUtility: totals.candidateUtility + probability * candidateResponse.utility,
          noOpUtility: totals.noOpUtility + probability * baselineResponse.utility,
          terminalUtility: totals.terminalUtility + probability * (candidateTerminalUtility - baselineTerminalUtility),
          objectiveProgress: totals.objectiveProgress + probability * (candidateProgress - baselineProgress),
          survivalLowerBound: Math.min(totals.survivalLowerBound, candidateResponse.own, candidateTailResponse.own),
          worstTailCapacityLoss: Math.max(
            totals.worstTailCapacityLoss,
            Math.max(0, before.own - candidateResponse.own),
            Math.max(0, before.own - candidateTailResponse.own),
          ),
          catastrophicRisk: totals.catastrophicRisk + probability * candidateCatastrophicRisk,
          catastrophicRiskReduction: totals.catastrophicRiskReduction +
            probability * Math.max(0, baselineCatastrophicRisk - candidateCatastrophicRisk),
        };
      }, {
        candidateUtility: (1 - branchMass) * after.utility,
          noOpUtility: (1 - branchMass) * noOp.utility,
        terminalUtility: (1 - branchMass) * (afterTerminalUtility - beforeTerminalUtility),
        objectiveProgress: (1 - branchMass) * (afterProgress.utility - beforeProgress.utility),
        survivalLowerBound: Math.min(after.own, immediateCounterTail.own),
        worstTailCapacityLoss: Math.max(
          0,
          before.own - after.own,
          before.own - immediateCounterTail.own,
        ),
        catastrophicRisk: 0,
        catastrophicRiskReduction: 0,
      });
      if (withdrawalEstimate) {
        const successfulSnapshot = snapshotAfterWithdrawalSuccess(decisionWorld, actorSide);
        const explicitTerminalUtility = nextIntentTerminalUtility(
          decisionWorld,
          successfulSnapshot,
          actorSide,
          responseContext,
        );
        const objectiveSuccessUtility = withdrawalIsSuccessGoal
          ? (explicitTerminalUtility > 0
              ? explicitTerminalUtility
              : 100 / Math.max(1, actorObjectives.successConditions.length))
          : 0;
        const successUtility = objectiveSuccessUtility > 0
          ? objectiveSuccessUtility
          : isSurvivalIntent(responseContext)
            ? 35
            : 0;
        const failedProbability = 1 - withdrawalProbability;
        responseComparison = {
          ...responseComparison,
          candidateUtility:
            withdrawalProbability * after.utility +
            failedProbability * responseComparison.noOpUtility,
          terminalUtility: withdrawalProbability * successUtility,
          objectiveProgress: 0,
          catastrophicRisk: failedProbability * responseComparison.catastrophicRisk,
          catastrophicRiskReduction:
            responseComparison.catastrophicRiskReduction +
            withdrawalProbability * responseComparison.catastrophicRisk,
        };
      }
      const directPotential = (candidate?.declaration?.targetIds || []).reduce((sum, targetId) => {
        const target = preview.findUnit(decisionWorld, targetId);
        if (!target) return sum;
        const totalPotential = preview.calculateDirectPotential(actor, target, {
          ...candidate.declaration,
          shieldAbsorptionCap: availableShieldAbsorptionCap(
            decisionWorld,
            target,
            actorSide,
            beliefState,
          ),
        });
        const damagePotential = candidateDamageEffects.reduce((damageSum, effect) =>
          damageSum + preview.calculateDirectPotential(actor, target, {
            actionKind: 'RELEASE_SKILL',
            skill: { _效果数组: [effect] },
          })
        , 0);
        const realizationFactor = targetRealizationFactor(beliefState, actor, targetId, candidateDamageEffects);
        return sum + damagePotential * realizationFactor + Math.max(0, totalPotential - damagePotential);
      }, 0);
      const valueContributions = (result?.contributions || []).filter(entry =>
        entry?.outcomeKind !== 'ACTION_CANCELLED' ||
        !unrealizableControlTargets.has(String(entry?.targetId || '').trim())
      );
      const atomicActionPotential = preview.calculateAtomicActionPotential({
        directPotential,
        contributions: valueContributions,
        frozenDirectPotential: valueContext.frozenDirectPotential,
      });
      const informationValue = candidate?.declaration?.actionKind === 'OBSERVE' ? estimateInformationValue({
        worldSnapshot: decisionWorld,
        actorId: preview.unitId(actor),
        beliefState,
      }) : 0;
      const irreversibleAssetCost = (result?.contributions || [])
        .filter(entry => entry?.outcomeKind === 'IRREVERSIBLE_ASSET_LOST')
        .reduce((sum, entry) => sum + Math.max(0, Number(entry?.threatValue || entry?.evidence?.cost || 0)), 0);
      const expectedStateGain = 100 *
        (responseComparison.candidateUtility - responseComparison.noOpUtility) /
        Math.max(1, before.total);
      const candidateEffects = preview.collectEffects(candidate.skill || candidate.declaration?.skill || {});
      const stateEffects = candidateEffects.filter(effect => String(effect?.原型 || '').trim() === '状态施加');
      const targets = (candidate?.declaration?.targetIds || [])
        .map(targetId => preview.findUnit(decisionWorld, targetId))
        .filter(Boolean);
      const stateWindowProfiles = stateEffects.map(effect => stateEffectWindowProfile(
        effect,
        candidate?.declaration?.targetIds || [],
        input,
        decisionWorld,
        actorSide,
      ));
      const realizableStateNames = new Set(
        stateWindowProfiles.filter(profile => profile.realizable).map(profile => profile.stateName).filter(Boolean),
      );
      const realizableStateWindowContributions = valueContributions.filter(entry =>
        entry?.outcomeKind === 'STATE_CHANGED' &&
        entry?.evidence?.marginal !== false &&
        realizableStateNames.has(String(entry?.evidence?.state || '').trim())
      );
      const marginalProfile = meaningfulPreviewEffect(
        result ? { ...result, contributions: valueContributions } : result,
        stateEffects,
        targets,
      );
      const costs = candidate.costs || candidate.declaration?.resourceCosts || {};
      const actorAfter = preview.findUnit(candidateSnapshot, preview.unitId(actor));
      const resourceRunwayBefore = resourceRunway(actor, costs);
      const resourceRunwayAfter = actorAfter ? resourceRunway(actorAfter, costs) : 0;
      const actorCatalog = valueContext.catalogs[preview.unitId(actor)] || [];
      const affordableBefore = actorCatalog
        .filter(action => Object.keys(action.costs || {}).length > 0 && actionLegalFromFrozen(decisionWorld, actor, action))
        .map(action => action.actionKey);
      const affordableAfter = actorAfter
        ? actorCatalog
            .filter(action => Object.keys(action.costs || {}).length > 0 && actionLegalFromFrozen(afterSnapshot, actorAfter, action))
            .map(action => action.actionKey)
        : [];
      const lostAffordableActions = affordableBefore.filter(actionKey => !affordableAfter.includes(actionKey));
      const affordableNoCostAlternative = actorAfter
        ? actorCatalog.some(action =>
            Object.keys(action.costs || {}).length === 0 &&
            Number(action.potential || 0) > 0 &&
            actionLegalFromFrozen(afterSnapshot, actorAfter, action)
          )
        : false;
      const rawObjectiveUtility = clamp(
        expectedStateGain +
        responseComparison.terminalUtility +
        responseComparison.objectiveProgress +
        informationValue -
        irreversibleAssetCost -
        responseComparison.catastrophicRisk,
        -200,
        200,
      );
      const hasCost = Object.keys(costs).length > 0 ||
        irreversibleAssetCost > 0 ||
        ['EQUIP', 'USE_ITEM'].includes(actionKind);
      const terminalCompensation = responseComparison.terminalUtility > 0;
      const resourceSupportOnly = candidateEffects.length > 0 && candidateEffects.every(effect =>
        String(effect?.原型 || '').trim() === '资源变化' &&
        !/生命|HP/i.test(String(effect?.资源 || '')) &&
        Number.parseFloat(String(effect?.数值 || '0')) > 0);
      const resourceUnlockMissing = resourceSupportOnly && after.own <= noOp.own + 1e-9;
      const creationUseMissing = !!candidate.creation && creationUseAudit?.realizable !== true;
      const zeroEffectCostly = hasCost &&
        (!marginalProfile.hasMeaningfulEffect || resourceUnlockMissing || creationUseMissing) &&
        informationValue <= 0;
      const targetRemoved = targets.some(target => {
        const afterTarget = preview.findUnit(afterSnapshot, preview.unitId(target));
        return afterTarget && !preview.isBattleCapable(afterTarget);
      });
      const hasImmediateGrantedWindow = valueContributions.some(entry =>
        ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW'].includes(entry?.outcomeKind));
      const lifecycleWindowReasons = [
        ...stateWindowProfiles.flatMap(profile => profile.reasons),
        hasImmediateGrantedWindow ? 'IMMEDIATE_WINDOW' : '',
      ].filter(Boolean);
      const futureWindowCompensation = expectedStateGain > 0.0001 &&
        lifecycleWindowReasons.length > 0;
      const resourceBankruptcyCompensation = terminalCompensation ||
        responseComparison.objectiveProgress > 0.0001 ||
        targetRemoved ||
        informationValue > 0 ||
        futureWindowCompensation;
      const uncompensatedResourceBankruptcy = hasCost &&
        resourceRunwayBefore !== null &&
        resourceRunwayBefore > 0 &&
        resourceRunwayAfter === 0 &&
        (lostAffordableActions.length > 0 || affordableNoCostAlternative) &&
        !resourceBankruptcyCompensation;
      const hasProgress = expectedStateGain > 0.0001 ||
        responseComparison.objectiveProgress > 0.0001 ||
        informationValue > 0 ||
        terminalCompensation ||
        responseComparison.catastrophicRiskReduction > 0.0001;
      const rejectionCode = zeroEffectCostly
        ? 'ZERO_EFFECT_COSTLY'
        : uncompensatedResourceBankruptcy
          ? 'UNCOMPENSATED_RESOURCE_BANKRUPTCY'
          : !hasProgress && !candidate.counterDeclineFallback
            ? 'ZERO_PROGRESS'
            : '';
      return Object.freeze({
        ...candidate,
        preview: result,
        predictedOutcomeEvidence: predictedOutcomeEvidence(result),
        utilityBefore: before.utility,
        utilityAfter: after.utility,
        rawObjectiveUtility,
        objectiveUtility: rawObjectiveUtility,
        rejectionCode,
        atomicActionPotential,
          immediateReactionAudit: result?.immediateReactionAudit || Object.freeze([]),
        withdrawalEstimate,
        mechanicObservations: Object.freeze(withdrawalObservation ? [withdrawalObservation] : []),
        vector: Object.freeze({
          rawObjectiveUtility,
          informationValue,
          resourceContinuity: after.own - noOp.own,
          survivalLowerBound: Math.max(0, responseComparison.survivalLowerBound),
          irreversibleAssetCost,
          worstTailCapacityLoss: responseComparison.worstTailCapacityLoss,
          expectedStateGain,
          terminalUtility: responseComparison.terminalUtility,
          objectiveProgress: responseComparison.objectiveProgress,
          resourcePreservation: after.own - noOp.own,
          irreversibleCost: irreversibleAssetCost,
          catastrophicRisk: responseComparison.catastrophicRisk,
          catastrophicRiskReduction: responseComparison.catastrophicRiskReduction,
        }),
        repeatedActionAudit: Object.freeze({
          repeatedActionDelta: 0,
          extendedWindowIds: Object.freeze(realizableStateWindowContributions
            .map(entry => String(entry?.windowId || '').trim())
            .filter(Boolean)),
          newlyDeniedOpportunityIds: Object.freeze(valueContributions
            .filter(entry => entry?.outcomeKind === 'ACTION_CANCELLED')
            .map(entry => String(entry?.windowId || '').trim())
            .filter(Boolean)),
          unrealizableDeniedOpportunityIds: Object.freeze((result?.contributions || [])
            .filter(entry =>
              entry?.outcomeKind === 'ACTION_CANCELLED' &&
              unrealizableControlTargets.has(String(entry?.targetId || '').trim())
            )
            .map(entry => String(entry?.windowId || '').trim())
            .filter(Boolean)),
          controlWindowRealizability: controlWindowAudit,
          resourceRunwayBefore,
          resourceRunwayAfter,
          lostAffordableActions: Object.freeze(lostAffordableActions),
          lifecycleWindowRealizable: lifecycleWindowReasons.length > 0,
          lifecycleWindowReasons: Object.freeze([...new Set(lifecycleWindowReasons)]),
          stateWindowProfiles: Object.freeze(stateWindowProfiles),
        }),
        nextValueAudit: Object.freeze({
          before: Object.freeze(before),
          noOp: Object.freeze(noOp),
          after: Object.freeze(after),
          expectedAfterResponseUtility: responseComparison.candidateUtility,
          expectedNoOpResponseUtility: responseComparison.noOpUtility,
          responseBranchCount: sharedResponseBranches.length,
          survivalLowerBound: responseComparison.survivalLowerBound,
          worstTailCapacityLoss: responseComparison.worstTailCapacityLoss,
          catastrophicRisk: responseComparison.catastrophicRisk,
          catastrophicRiskReduction: responseComparison.catastrophicRiskReduction,
          frozenDirectPotential: valueContext.frozenDirectPotential,
          atomicActionPotential,
          immediateCounterExpectedThreat: Math.max(0, Number(immediateCounterRisk.totalExpectedThreat || 0)),
          immediateCounterWorstTailThreat: Math.max(0, Number(immediateCounterRisk.totalWorstTailThreat || 0)),
          immediateCounterAudit: immediateCounterRisk.entries,
          teamReactionSequence: teamReactionSequence?.audit || null,
          creationFutureUse: creationUseAudit,
          valueAddedOutsideStateDelta: responseComparison.terminalUtility +
            responseComparison.objectiveProgress +
            informationValue -
            irreversibleAssetCost -
            responseComparison.catastrophicRisk,
        }),
      });
    });
    return scored.map(candidate => {
      const bestAlternative = scored
        .filter(other => other.candidateId !== candidate.candidateId && !other.rejectionCode)
        .reduce((best, other) => Math.max(best, Number(other.objectiveUtility || 0)), -Infinity);
      return Object.freeze({
        ...candidate,
        repeatedActionAudit: Object.freeze({
          ...candidate.repeatedActionAudit,
          repeatedActionDelta: Number.isFinite(bestAlternative)
            ? Number(candidate.objectiveUtility || 0) - bestAlternative
            : Number(candidate.objectiveUtility || 0),
        }),
      });
    });
  }

  function resetDecisionCaches() {
    preview.clearCache();
    baseActionValueCache = new WeakMap();
    unitSkillCache = new WeakMap();
    stateEntriesCache = new WeakMap();
    actionCancellationCache = new WeakMap();
    actionQualityCache = new WeakMap();
    effectiveShieldCache = new WeakMap();
    bestAgainstCache = new WeakMap();
    bestActionCache = new WeakMap();
    experienceCache = new WeakMap();
    relevantStateFingerprintCache = new WeakMap();
    worldEntriesCache = new WeakMap();
    aliveEntriesCache = new WeakMap();
    sideCache = new WeakMap();
    nextValueContextCache = new WeakMap();
    shieldThreatProfileCache = new WeakMap();
    nextUtilityCache = new WeakMap();
    nextTeamCapacityCache = new WeakMap();
    decisionWorldRevisionCache = new WeakMap();
    responseThreatSnapshotCache = new WeakMap();
    unitCapacitySignatureCache = new WeakMap();
    sequenceProfileSemanticCache = new WeakMap();
    decisionWorldRevisionSequence = 0;
    decisionRevisionSequence += 1;
  }

  function teamCapacity(worldSnapshot, side, perspectiveSide, beliefState = {}, options = {}) {
    const entries = aliveEntries(worldSnapshot);
    const sideEntries = entries.filter(entry => entry.side === side);
    const opposingEntries = entries.filter(entry => entry.side !== side);
    return sideEntries.reduce((sum, entry) => {
      const unit = entry.unit;
      const allied = side === perspectiveSide;
      const beliefUnit = beliefState?.units?.[preview.unitId(unit)] || {};
      const actionUnavailable = hasActionCancellation(unit);
      const cancellationProbability = actionCancellationProbability(unit);
      const restoreActionAvailability = options.restoreActionAvailabilityFor?.has(preview.unitId(unit)) === true;
      const incomingThreatPercent = opposingEntries.reduce((threat, opposingEntry) => {
        const opposingUnit = opposingEntry.unit;
        const opposingBelief = beliefState?.units?.[preview.unitId(opposingUnit)] || {};
        const baseThreat = allied
          ? perceivedEnemyBaseValue(opposingBelief, unit)
          : bestBaseActionValueAgainst(worldSnapshot, opposingUnit, unit);
        return Math.max(threat, baseThreat * actionQualityMultiplier(opposingUnit));
      }, 0);
      const effectiveHpRatio = clamp(
        (
          preview.readHp(unit) +
          effectiveShieldCapacityValue(worldSnapshot, unit, perspectiveSide, beliefState) -
          pendingHpLossBeforeNextAction(unit)
        ) / preview.readHpMax(unit),
        0,
        1,
      );
      const responseMargin = effectiveHpRatio - incomingThreatPercent / 100;
      const survivesNextResponse = clamp(1 / (1 + Math.exp(-32 * responseMargin)), 0.02, 0.98);
      const survivalProbability = clamp(0.35 * effectiveHpRatio + 0.65 * survivesNextResponse, 0, 1);
      return sum + preview.calculateUnitCapacity({
        unit,
        survivalProbability,
        actionAvailability: actionUnavailable && !restoreActionAvailability
          ? 0
          : (restoreActionAvailability ? 1 : 1 - cancellationProbability) * actionQualityMultiplier(unit, { ignoreActionCancellation: restoreActionAvailability }),
        bestLegalBaseActionValue: allied
          ? bestBaseActionValue(worldSnapshot, unit, { ignoreActionCancellation: restoreActionAvailability || cancellationProbability > 0 })
          : perceivedEnemyBaseValue(beliefUnit),
      });
    }, 0);
  }

  function stateUtility(worldSnapshot, actorSide, beliefState = {}, options = {}) {
    const sides = [...new Set(worldEntries(worldSnapshot).map(entry => entry.side))];
    const own = teamCapacity(worldSnapshot, actorSide, actorSide, beliefState, options);
    const enemy = sides.filter(side => side !== actorSide).reduce((sum, side) => sum + teamCapacity(worldSnapshot, side, actorSide, beliefState, options), 0);
    return { own, enemy, total: own + enemy, utility: own - enemy };
  }

  function bestImmediateRealizableAction(worldSnapshot, actorId, beliefState = {}, revision = '') {
    const actor = preview.findUnit(worldSnapshot, actorId);
    if (!actor || !preview.isAlive(actor) || hasActionCancellation(actor)) return { gain: 0, actionKind: '', candidateId: '' };
    const actorSide = sideOf(worldSnapshot, actor);
    const before = stateUtility(worldSnapshot, actorSide, beliefState);
    return enumerateCandidates({
      worldSnapshot,
      actorId,
      actionOpportunity: { role: 'ACTIVE', sequence: 1 },
      beliefState,
    }).filter(entry => {
      if (!['BASIC_ATTACK', 'RELEASE_SKILL'].includes(entry?.declaration?.actionKind)) return false;
      if (entry.declaration.actionKind === 'BASIC_ATTACK') return true;
      const effects = entry?.declaration?.skill?._效果数组;
      return Array.isArray(effects) && effects.length > 0 && effects.every(effect => String(effect?.原型 || '').trim());
    }).reduce((best, entry) => {
      const result = preview.previewAction({
        worldSnapshot,
        worldRevision: `${revision}:realizable:${actorId}`,
        beliefSnapshot: beliefState,
        actorId,
        declaration: entry.declaration,
        actionFingerprint: `realizable:${entry.candidateId}`,
        horizon: 'SHALLOW',
        previewBudget: { maxNodes: 12 },
      });
      const after = stateUtility(result.afterSnapshot, actorSide, beliefState);
      const gain = 100 * (after.utility - before.utility) / Math.max(1, before.total);
      return gain > best.gain ? { gain, actionKind: entry.declaration.actionKind, candidateId: entry.candidateId } : best;
    }, { gain: 0, actionKind: '', candidateId: '' });
  }

  function realizableResourceSupportGain(context, result) {
    const recipients = new Set((result?.contributions || [])
      .filter(entry => entry?.outcomeKind === 'RESOURCE_OPTION_CHANGED' && Number(entry?.evidence?.delta || 0) > 0)
      .map(entry => String(entry?.targetId || '').trim()).filter(Boolean));
    return [...recipients].reduce((sum, targetId) => {
      const beforeAction = bestImmediateRealizableAction(context.worldSnapshot, targetId, context.beliefState, `${context.worldRevision}:before-support`);
      const afterAction = bestImmediateRealizableAction(result.afterSnapshot, targetId, context.beliefState, `${context.worldRevision}:after-support`);
      if (afterAction.actionKind !== 'RELEASE_SKILL') return sum;
      return sum + Math.max(0, afterAction.gain - beforeAction.gain);
    }, 0);
  }

  function visibleActionThreat(source, target, action = {}) {
    if (!source || !target) return 0;
    const skill = action?.skill || action?.raw_skill || action;
    const actionKind = Array.isArray(skill?._效果数组) && skill._效果数组.length ? 'RELEASE_SKILL' : 'BASIC_ATTACK';
    const effects = actionKind === 'BASIC_ATTACK'
      ? [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }]
      : preview.collectEffects(skill);
    const uncappedDamageThreat = effects.reduce((sum, effect) => {
      if (String(effect?.原型 || '').trim() !== '伤害结算') return sum;
      const expectedDamage = preview.calculateBaseDamage(effect, source, target) *
        preview.estimateHitProbability(source, target, effect);
      return sum + 100 * expectedDamage / Math.max(1, preview.readHpMax(target));
    }, 0);
    const directThreat = Math.max(
      preview.calculateBaseActionValue(source, target, { actionKind, skill }),
      uncappedDamageThreat,
    );
    const stateThreat = effects.reduce((sum, effect) => {
      if (String(effect?.原型 || '').trim() !== '状态施加') return sum;
      const targetMode = String(effect?.目标 || skill?.目标 || '').trim();
      if (/自身|友方|己方/.test(targetMode) && !/敌方|对手/.test(targetMode)) return sum;
      const probability = probabilityValue(effect?.成功率 ?? effect?.触发概率, 0.65);
      const duration = Math.max(1, Number(effect?.持续回合 || 1));
      const mechanics = {
        ...preview.deriveStateCombatEffect(effect),
        ...(effect?.计算层效果 && typeof effect.计算层效果 === 'object' ? effect.计算层效果 : {}),
      };
      const cancelsAction = Object.entries(mechanics).some(([key, value]) => value === true && /skip|stun|freeze|sleep|silence|seal|disarm|disable|forbid/i.test(key));
      const changesActionQuality = Object.entries(mechanics).some(([key, value]) =>
        value !== false && Number(value || 0) !== 0 && /hit|dodge|speed|agi|cast|damage|def|resist|lock|limit/i.test(key),
      );
      const capacityThreat = cancelsAction ? 32 : changesActionQuality ? 18 : 10;
      return sum + capacityThreat * Math.min(2, duration) * probability;
    }, 0);
    return Math.max(directThreat, Math.min(100, stateThreat));
  }

  function catastrophicResponseRisk(actor = {}, rawThreat = 0, responseMultiplier = 1) {
    const hpRatio = clamp(preview.readHp(actor) / Math.max(1, preview.readHpMax(actor)), 0, 1);
    const expectedDamageRatio = Math.max(0, Number(rawThreat || 0)) *
      clamp(Number(responseMultiplier || 0), 0, 1) / 100;
    const excessLethalDamage = Math.max(0, expectedDamageRatio - hpRatio);
    if (!(excessLethalDamage > 0)) return 0;
    const survivalPriority = hpRatio <= 0.2 ? 2 : hpRatio <= 0.35 ? 1.5 : 1;
    return clamp(excessLethalDamage * survivalPriority, 0, 60);
  }

  function estimatedHostileTargetProbability(context = {}, actor = null, actorSide = '') {
    const worldSnapshot = context.worldSnapshot || {};
    const currentActor = actor || preview.findUnit(worldSnapshot, context.actorId);
    if (!currentActor) return 0;
    const currentActorSide = actorSide || sideOf(worldSnapshot, currentActor);
    const allyCount = Math.max(1, aliveEntries(worldSnapshot).filter(entry => entry.side === currentActorSide).length);
    if (allyCount === 1) return 1;
    const actorName = preview.unitName(currentActor);
    const currentRound = Math.max(0, Number(worldSnapshot?.回合 || 0));
    const recentTargetCount = (Array.isArray(worldSnapshot?.__battleEventLedger) ? worldSnapshot.__battleEventLedger : []).filter(event => {
      const round = Number(event?.round || 0);
      if (round < Math.max(0, currentRound - 1) || round > currentRound) return false;
      if (!['action_start', 'hit_result', 'state_apply'].includes(String(event?.eventKind || '').trim())) return false;
      if (String(event?.targetName || '').trim() !== actorName) return false;
      const sourceSide = String(event?.actorSide || '').trim();
      return !sourceSide || sourceSide !== currentActorSide;
    }).length;
    const hpRatio = preview.readHp(currentActor) / preview.readHpMax(currentActor);
    return recentTargetCount > 0
      ? Math.min(1, 0.45 + recentTargetCount * 0.2)
      : Math.min(1, (hpRatio <= 0.3 ? 0.6 : 0.25) / allyCount);
  }

  function estimateIncomingThreat(context = {}) {
    const worldSnapshot = context.worldSnapshot || {};
    const actor = preview.findUnit(worldSnapshot, context.actorId);
    if (!actor) return { value: 0, explicit: false, sourceId: '', arrivesBeforeNextOpportunity: false };
    const actorSide = sideOf(worldSnapshot, actor);
    const allyCount = Math.max(1, aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide).length);
    const targetProbability = estimatedHostileTargetProbability(context, actor, actorSide);
    const sourceId = String(context.actionOpportunity?.sourceActorId || '').trim();
    const source = sourceId ? preview.findUnit(worldSnapshot, sourceId) : null;
    const incomingAction = context.actionOpportunity?.incomingAction;
    if (source && incomingAction) {
      return { value: visibleActionThreat(source, actor, incomingAction), explicit: true, sourceId, arrivesBeforeNextOpportunity: true };
    }
    let best = { value: 0, explicit: false, sourceId: '', arrivesBeforeNextOpportunity: false };
    aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide).forEach(entry => {
      const enemy = entry.unit;
      const enemyId = preview.unitId(enemy);
      if (hasActionCancellation(enemy)) return;
      const charging = enemy?.蓄力技能;
      if (charging) {
        const namedTarget = String(charging?.target_id || charging?.targetId || charging?.target_name || '').trim();
        const targetProbability = namedTarget ? (namedTarget === preview.unitId(actor) || namedTarget === preview.unitName(actor) ? 1 : 0) : 1 / allyCount;
        const value = visibleActionThreat(enemy, actor, charging) * targetProbability;
        const remainingCastTime = Math.max(0, Number(charging?.cast_time ?? charging?.skill?.前摇 ?? charging?.前摇 ?? 0));
        if (value > best.value) best = { value, explicit: true, sourceId: enemyId, arrivesBeforeNextOpportunity: remainingCastTime <= 40 };
        return;
      }
      const beliefUnit = context.beliefState?.units?.[enemyId] || {};
      const value = perceivedEnemyBaseValue(beliefUnit) * targetProbability;
      if (value > best.value) best = { value, explicit: false, sourceId: enemyId, arrivesBeforeNextOpportunity: true };
    });
    return best;
  }

  function directDefensiveUtility(actionKind, context = {}) {
    const actor = preview.findUnit(context.worldSnapshot || {}, context.actorId);
    if (!actor || !preview.isAlive(actor)) return 0;
    if (['DEFEND', 'EVADE'].includes(actionKind) && actor?.__battleRuntime?.activeDefenseStance) return 0;
    const threat = estimateIncomingThreat(context);
    const explicitThreat = threat.explicit || context.actionOpportunity?.imminentThreat === true || context.actionOpportunity?.counterWindow === true;
    if (['DEFEND', 'EVADE'].includes(actionKind) && threat.explicit && threat.arrivesBeforeNextOpportunity === false) return 0;
    if (context.stalemate && !explicitThreat) return 0;
    if (!(threat.value > 0)) return 0;

    const hpRatio = clamp(preview.readHp(actor) / Math.max(1, preview.readHpMax(actor)), 0, 1);
    const incomingPressure = clamp(Number(threat.value || 0) / 100, 0, 1.5);
    const lethalPressure = clamp(incomingPressure - hpRatio * 0.65, 0, 1);
    const protectionFactor = {
      DEFEND: 0.20,
      EVADE: 0.32,
      COUNTER: 0.38,
      GUARD: 0.24,
      WITHDRAW: 0.45,
    }[actionKind] || 0;
    if (!(protectionFactor > 0)) {
      return actionKind === 'OBSERVE' && context.beliefState?.observationGranted === true
        ? clamp(1 - Number(context.beliefState?.confidence || 0), 0, 1) * 2
        : 0;
    }
    if (actionKind === 'COUNTER' && context.actionOpportunity?.counterWindow !== true) return 0;
    if (actionKind === 'GUARD' && context.actionOpportunity?.interceptThreat !== true) return 0;
    if (actionKind === 'WITHDRAW' && !withdrawalAllowed(context.worldSnapshot || {}, actor, context.battleIntent || {})) return 0;

    const side = sideOf(context.worldSnapshot || {}, actor);
    const objectiveContext = objectiveActorContext(context.worldSnapshot || {}, side, context.battleIntent || {});
    const noDamageFailure = objectiveContext.failureConditions.some(condition =>
      condition.type === 'UNIT_DAMAGED' &&
      condition.side === objectiveContext.ownSide &&
      (!condition.targetIds?.length || condition.targetIds.includes(preview.unitId(actor)) || condition.targetIds.includes(preview.unitName(actor)))
    );
    const before = stateUtility(context.worldSnapshot || {}, side, context.beliefState || {});
    const alliedUnitCount = Math.max(1, aliveEntries(context.worldSnapshot || {}).filter(entry => entry.side === side).length);
    const urgency = explicitThreat
      ? Math.max(0.35, lethalPressure)
      : clamp(incomingPressure, 0.02, 0.35);
    const avoidedThreat = Math.min(1.5, incomingPressure) * protectionFactor * Math.max(0.35, urgency);
    const survivalPriority = hpRatio <= 0.2 ? 1.8 : hpRatio <= 0.35 ? 1.35 : 1;
    const preservedCapacity = Math.max(0, Number(before.own || 0)) / alliedUnitCount * avoidedThreat * survivalPriority;
    const terminalPressure = explicitThreat && hpRatio <= 0.4 && incomingPressure >= hpRatio
      ? 18 + 12 * clamp(incomingPressure - hpRatio, 0, 1)
      : 0;
    const objectiveProtection = noDamageFailure ? 100 * clamp(incomingPressure, 0, 1) * protectionFactor : 0;
    const utility = clamp(100 * preservedCapacity / Math.max(1, before.total) + terminalPressure + objectiveProtection, 0, 120);
    const activeNaturalOpportunity = String(context.actionOpportunity?.role || '').trim().toUpperCase() === 'ACTIVE' &&
      context.actionOpportunity?.counterWindow !== true &&
      context.actionOpportunity?.imminentThreat !== true;
    const lowMarginalDefense = activeNaturalOpportunity &&
      !explicitThreat &&
      !noDamageFailure &&
      !isSurvivalIntent(context) &&
      hpRatio > 0.3 &&
      utility < 0.1;
    return lowMarginalDefense ? 0 : utility;
  }

  function isSurvivalIntent(context = {}) {
    return /求生|撤退|脱离|逃生/.test(battleIntentMode(context));
  }

  function estimateEphemeralStateWindowGain(stateEffects = [], result = null, context = {}) {
    if (!result || !stateEffects.length) return 0;
    const actorBefore = preview.findUnit(context.worldSnapshot, context.actorId);
    if (!actorBefore) return 0;
    const actorSide = sideOf(context.worldSnapshot, actorBefore);
    const nextAlly = aliveEntries(context.worldSnapshot)
      .filter(entry =>
        entry.side === actorSide &&
        preview.unitId(entry.unit) !== context.actorId &&
        preview.compareNaturalActionOrder(actorBefore, entry.unit) < 0
      )
      .sort((left, right) => preview.compareNaturalActionOrder(left.unit, right.unit))[0]?.unit;
    if (!nextAlly) return 0;
    return (context?.candidateTargetIds || []).reduce((best, targetId) => {
      const targetBefore = preview.findUnit(context.worldSnapshot, targetId);
      const targetAfter = preview.findUnit(result.afterSnapshot, targetId);
      if (!targetBefore || !targetAfter) return best;
      return Math.max(
        best,
        bestBaseActionValueAgainst(result.afterSnapshot, nextAlly, targetAfter) -
        bestBaseActionValueAgainst(context.worldSnapshot, nextAlly, targetBefore),
      );
    }, 0);
  }

  function stateEffectHasMarginalValue(effect = {}, target = {}) {
    const name = String(effect?.状态 || effect?.状态名称 || '').trim();
    if (!name) return true;
    const existing = stateEntries(target).find(state => String(state?.状态 || state?.状态名称 || '').trim() === name);
    if (!existing) return true;
    if (effect?.可叠加 === true || /叠加|层数/.test(String(effect?.叠加规则 || effect?.层数规则 || ''))) return true;
    if (effect?.刷新 === true || effect?.可刷新 === true) return true;
    const requestedDuration = Math.max(0, Number(effect?.持续回合 || 0));
    const existingDuration = Math.max(0, Number(existing?.duration ?? existing?.持续回合 ?? 0));
    return requestedDuration > existingDuration;
  }

  function withoutCandidateStateEffects(snapshot = {}, stateEffects = []) {
    const names = new Set(stateEffects.map(effect => String(effect?.状态 || effect?.状态名称 || '').trim()).filter(Boolean));
    if (!names.size) return snapshot;
    return mapWorldUnits(snapshot, unit => {
      if (!unit?.状态效果 || Array.isArray(unit.状态效果) || typeof unit.状态效果 !== 'object') return unit;
      const nextStates = { ...unit.状态效果 };
      let changed = false;
      Object.entries(nextStates).forEach(([key, state]) => {
        const name = String(state?.状态 || state?.状态名称 || state?.名称 || '').trim();
        if (key.startsWith('preview:') && names.has(name)) {
          delete nextStates[key];
          changed = true;
        }
      });
      return changed ? { ...unit, 状态效果: nextStates } : unit;
    });
  }

  function objectiveActorContext(worldSnapshot = {}, actorSide = '', battleIntent = {}) {
    const objectives = preview.normalizeBattleObjectives(battleIntent?.objectives || battleIntent?.胜负条件 || worldSnapshot?.胜负条件 || {}, worldSnapshot);
    const actorIsPlayer = /player|玩家|我方|己方|友方/i.test(String(actorSide || ''));
    const successConditions = actorIsPlayer ? objectives.victory.conditions : objectives.defeat.conditions;
    const failureConditions = actorIsPlayer ? objectives.defeat.conditions : objectives.victory.conditions;
    const successLogic = actorIsPlayer ? objectives.victory.logic : objectives.defeat.logic;
    const ownSide = actorIsPlayer ? 'PLAYER' : 'ENEMY';
    return { objectives, actorIsPlayer, ownSide, successConditions, failureConditions, successLogic };
  }

  function buildTeamIntent(worldSnapshot, actorId, beliefState = {}, battleIntent = {}) {
    const actor = preview.findUnit(worldSnapshot, actorId);
    const actorSide = sideOf(worldSnapshot, actor);
    const entries = aliveEntries(worldSnapshot);
    const enemies = entries.filter(entry => entry.side !== actorSide).map(entry => entry.unit);
    const allies = entries.filter(entry => entry.side === actorSide).map(entry => entry.unit);
    const objectiveContext = objectiveActorContext(worldSnapshot, actorSide, battleIntent);
    const protectionConditions = [
      ...objectiveContext.failureConditions,
      ...objectiveContext.successConditions.filter(condition => condition.type === 'ROUND_REACHED'),
    ];
    const protectedIds = new Set(protectionConditions
      .filter(condition => condition.side === objectiveContext.ownSide && ['UNIT_DAMAGED', 'UNIT_INCAPACITATED', 'HP_RATIO_AT_OR_BELOW', 'ROUND_REACHED'].includes(condition.type))
      .flatMap(condition => condition.targetIds?.length ? condition.targetIds : allies.map(preview.unitId)));
    const recentEvents = (Array.isArray(worldSnapshot?.__battleEventLedger) ? worldSnapshot.__battleEventLedger : []).filter(event => {
      const round = Number(event?.round || 0);
      return round >= Math.max(0, Number(worldSnapshot?.回合 || 0) - 1);
    });
    const focusProfiles = enemies.map(unit => {
      const unitId = preview.unitId(unit);
      const unitName = preview.unitName(unit);
      const beliefUnit = beliefState?.units?.[unitId] || {};
      const responses = Array.isArray(beliefState?.publicResponses?.[unitId])
        ? beliefState.publicResponses[unitId]
        : [];
      const publicThreat = Math.max(0, ...responses
        .filter(response =>
          !responseHasRole(response, 'REACTION') &&
          ['ACTIVE', 'COUNTER', 'ASSIST'].some(role => responseHasRole(response, role))
        )
        .map(response => Math.max(0, Number(response?.baseActionValue ?? response?.utility ?? 0))));
      const recentCapacityLoss = recentEvents.reduce((sum, event) => {
        const eventActor = String(event?.actorId || event?.actorName || '').trim();
        if (eventActor !== unitId && eventActor !== unitName) return sum;
        const target = preview.findUnit(worldSnapshot, event?.targetId || event?.targetName || '');
        if (!target || sideOf(worldSnapshot, target) !== actorSide) return sum;
        if (String(event?.eventKind || '').trim() === 'hit_result') {
          const damage = Math.max(0, Number(event?.appliedDamage || event?.meta?.appliedDamage || 0));
          return sum + 100 * damage / Math.max(1, preview.readHpMax(target));
        }
        if (
          ['state_apply', 'blocked_action', 'lost_opportunity'].includes(String(event?.eventKind || '').trim()) &&
          (event?.result === 'applied' || event?.resultState === 'SUCCESS' || event?.resultState === 'CANCELLED')
        ) return sum + 25;
        return sum;
      }, 0);
      const pendingDamage = stateEntries(unit).reduce((sum, state) => {
        const name = String(state?.状态 || state?.状态名称 || '').trim();
        const type = String(state?.类型 || state?.正负面 || '').trim();
        if (!/中毒|流血|灼烧|持续伤害|DOT/i.test(`${name} ${type}`)) return sum;
        const combatEffect = preview.deriveStateCombatEffect(state);
        const damage = Math.max(
          0,
          Number(combatEffect?.dot_damage || 0) +
          preview.readHpMax(unit) * Math.max(0, Number(combatEffect?.dot_damage_ratio || 0)),
        );
        return sum + damage * Math.max(1, Number(state?.duration ?? state?.持续回合 ?? 1));
      }, 0);
      const hpRatio = Number(beliefUnit.hpRatio ?? preview.readHp(unit) / preview.readHpMax(unit));
      const remainingCapacity = Math.max(
        0,
        hpRatio * perceivedEnemyBaseValue(beliefUnit) -
        100 * pendingDamage / Math.max(1, preview.readHpMax(unit)),
      );
      const pendingLethal = pendingDamage >= preview.readHp(unit) - 1e-9;
      const actionFit = bestBaseActionValueAgainst(worldSnapshot, actor, unit);
      const finishPressure = clamp((1 - hpRatio) * 40, 0, 40);
      return {
        unit,
        unitId,
        actionFit,
        canAffect: actionFit > 0.0001,
        publicThreat,
        recentCapacityLoss,
        remainingCapacity,
        pendingLethal,
        priority:
          publicThreat +
          recentCapacityLoss +
          finishPressure -
          (pendingLethal ? 120 : 0),
      };
    });
    const realizableFocusProfiles = focusProfiles.some(profile => profile.canAffect)
      ? focusProfiles.filter(profile => profile.canAffect)
      : focusProfiles;
    const focusProfile = [...realizableFocusProfiles].sort((left, right) =>
      right.priority - left.priority ||
      left.remainingCapacity - right.remainingCapacity ||
      left.unitId.localeCompare(right.unitId)
    )[0];
    const focus = focusProfile?.unit || null;
    const protect = [...allies].sort((left, right) => {
      const pressure = unit => recentEvents.filter(event => String(event?.targetName || '').trim() === preview.unitName(unit) && String(event?.actorSide || '').trim() !== actorSide).length;
      const objectiveWeight = unit => protectedIds.has(preview.unitId(unit)) || protectedIds.has(preview.unitName(unit)) ? 80 : 0;
      const leftLoss = (1 - preview.readHp(left) / preview.readHpMax(left)) * 100 + pressure(left) * 12 + objectiveWeight(left);
      const rightLoss = (1 - preview.readHp(right) / preview.readHpMax(right)) * 100 + pressure(right) * 12 + objectiveWeight(right);
      return rightLoss - leftLoss || preview.unitId(left).localeCompare(preview.unitId(right));
    })[0];
    const protectedCrisis = protect &&
      (protectedIds.has(preview.unitId(protect)) || protectedIds.has(preview.unitName(protect))) &&
      preview.readHp(protect) < preview.readHpMax(protect) * 0.5;
    const threatFocus = protectedCrisis
      ? [...realizableFocusProfiles]
          .filter(profile => !hasActionCancellation(profile.unit))
          .sort((left, right) =>
            bestBaseActionValueAgainst(worldSnapshot, right.unit, protect) +
              right.publicThreat +
              right.recentCapacityLoss -
            bestBaseActionValueAgainst(worldSnapshot, left.unit, protect) -
              left.publicThreat -
              left.recentCapacityLoss ||
            left.unitId.localeCompare(right.unitId)
          )[0]?.unit
      : null;
    const exploitable = enemies.find(unit => hasActionCancellation(unit) || unit?.蓄力技能);
    const focusId = threatFocus ? preview.unitId(threatFocus) : focus ? preview.unitId(focus) : '';
    const protectId = protect && (preview.readHp(protect) < preview.readHpMax(protect) * 0.5 || protectedIds.has(preview.unitId(protect)) || protectedIds.has(preview.unitName(protect))) ? preview.unitId(protect) : '';
    const evidenceEventIds = recentEvents.filter(event => {
      const actors = [String(event?.actorName || '').trim(), String(event?.targetName || '').trim()];
      return [focusId, protectId].filter(Boolean).some(id => {
        const unit = preview.findUnit(worldSnapshot, id);
        return unit && actors.includes(preview.unitName(unit));
      });
    }).map(event => String(event?.eventId || '').trim()).filter(Boolean);
    return {
      focusTarget: focusId,
      protectTarget: protectId,
      exploitableWindow: exploitable ? `${hasActionCancellation(exploitable) ? 'ACTION_DENIED' : 'CHARGING'}:${preview.unitId(exploitable)}` : '',
      evidenceEventIds: [...new Set(evidenceEventIds)],
    };
  }

  function identifyProblems(worldSnapshot, actorId, beliefState = {}, options = {}) {
    const actor = preview.findUnit(worldSnapshot, actorId);
    const actorSide = sideOf(worldSnapshot, actor);
    const problems = [];
    const capacity = stateUtility(worldSnapshot, actorSide, beliefState);
    const normalizedLoss = value => clamp(100 * Math.max(0, Number(value || 0)) / Math.max(1, capacity.total), 0, 100);
    const actorCapacity = preview.calculateUnitCapacity({
      unit: actor,
      survivalProbability: preview.readHp(actor) / preview.readHpMax(actor),
      actionAvailability: hasActionCancellation(actor) ? 0 : actionQualityMultiplier(actor),
      bestLegalBaseActionValue: bestBaseActionValue(worldSnapshot, actor),
    });
    const hpRatio = preview.readHp(actor) / preview.readHpMax(actor);
    const objectiveContext = objectiveActorContext(worldSnapshot, actorSide, options.battleIntent || {});
    const protectionConditions = [
      ...objectiveContext.failureConditions,
      ...objectiveContext.successConditions.filter(condition => condition.type === 'ROUND_REACHED'),
    ];
    const actorProtected = protectionConditions.some(condition =>
      condition.side === objectiveContext.ownSide &&
      ['UNIT_DAMAGED', 'UNIT_INCAPACITATED', 'ROUND_REACHED'].includes(condition.type) &&
      (!condition.targetIds?.length || condition.targetIds.includes(actorId) || condition.targetIds.includes(preview.unitName(actor)))
    );
    if (hpRatio <= 0.3) problems.push({ problemId: 'SURVIVAL_CRISIS', severity: normalizedLoss(actorCapacity * (1 - hpRatio)) });
    else if (actorProtected) problems.push({ problemId: 'SURVIVAL_CRISIS', targetIds: [actorId], severity: normalizedLoss(actorCapacity * 0.25) });
    const criticalAlly = aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== actorId).find(entry => preview.readHp(entry.unit) / preview.readHpMax(entry.unit) <= 0.3);
    if (criticalAlly) {
      const allyCapacity = preview.calculateUnitCapacity({
        unit: criticalAlly.unit,
        survivalProbability: preview.readHp(criticalAlly.unit) / preview.readHpMax(criticalAlly.unit),
        actionAvailability: hasActionCancellation(criticalAlly.unit) ? 0 : actionQualityMultiplier(criticalAlly.unit),
        bestLegalBaseActionValue: bestBaseActionValue(worldSnapshot, criticalAlly.unit),
      });
      problems.push({ problemId: 'ALLY_CRISIS', targetIds: [preview.unitId(criticalAlly.unit)], severity: normalizedLoss(allyCapacity * (1 - preview.readHp(criticalAlly.unit) / preview.readHpMax(criticalAlly.unit))) });
    }
    const protectedAlly = aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== actorId).find(entry =>
      protectionConditions.some(condition =>
        condition.side === objectiveContext.ownSide &&
        ['UNIT_DAMAGED', 'UNIT_INCAPACITATED', 'ROUND_REACHED'].includes(condition.type) &&
        (!condition.targetIds?.length || condition.targetIds.includes(preview.unitId(entry.unit)) || condition.targetIds.includes(preview.unitName(entry.unit)))
      )
    );
    if (protectedAlly && (!criticalAlly || preview.unitId(criticalAlly.unit) !== preview.unitId(protectedAlly.unit))) {
      problems.push({ problemId: 'ALLY_CRISIS', targetIds: [preview.unitId(protectedAlly.unit)], severity: normalizedLoss(capacity.own * 0.2) });
    }
    aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide && entry.unit?.蓄力技能).forEach(entry => {
      const charge = entry.unit.蓄力技能;
      const threat = visibleActionThreat(entry.unit, actor, charge);
      problems.push({
        problemId: 'IMMINENT_DENIAL',
        targetIds: [preview.unitId(entry.unit)],
        severity: normalizedLoss(actorCapacity * threat / 100),
        evidence: { actionName: skillName(charge), castTime: Number(charge?.cast_time || charge?.前摇 || 0), threat },
      });
    });
    const terminalEnemy = aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide).find(entry => Number(beliefState?.units?.[preview.unitId(entry.unit)]?.hpRatio ?? 1) <= 0.2);
    if (terminalEnemy) problems.push({ problemId: 'TERMINAL_OPPORTUNITY', targetIds: [preview.unitId(terminalEnemy.unit)], severity: normalizedLoss(perceivedEnemyBaseValue(beliefState?.units?.[preview.unitId(terminalEnemy.unit)] || {})) });
    objectiveContext.successConditions.filter(condition => condition.type === 'HP_RATIO_AT_OR_BELOW').forEach(condition => {
      aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide).filter(entry =>
        !condition.targetIds?.length || condition.targetIds.includes(preview.unitId(entry.unit)) || condition.targetIds.includes(preview.unitName(entry.unit))
      ).forEach(entry => {
        const ratio = preview.readHp(entry.unit) / preview.readHpMax(entry.unit);
        const remaining = Math.max(0, ratio - condition.threshold);
        if (remaining <= 0.35) problems.push({ problemId: 'TERMINAL_OPPORTUNITY', targetIds: [preview.unitId(entry.unit)], severity: normalizedLoss(capacity.total * (0.35 - remaining + 0.05)) });
      });
    });
    const unavailable = options.forceCapabilityShortage === true || hasActionCancellation(actor) || bestBaseActionValue(worldSnapshot, actor) <= 0.0001;
    if (unavailable) problems.push({ problemId: 'CAPABILITY_SHORTAGE', targetIds: [actorId], severity: normalizedLoss(actorCapacity || capacity.own) });
    const advantageTarget = aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide).find(entry => hasActionCancellation(entry.unit));
    if (advantageTarget) problems.push({ problemId: 'ADVANTAGE_WINDOW', targetIds: [preview.unitId(advantageTarget.unit)], severity: normalizedLoss(perceivedEnemyBaseValue(beliefState?.units?.[preview.unitId(advantageTarget.unit)] || {}) * 0.5) });
    if (Number(beliefState?.confidence || 0) < 0.45) problems.push({ problemId: 'INFORMATION_DEFICIT', severity: normalizedLoss(capacity.own * (0.45 - Number(beliefState?.confidence || 0))) });
    if (withdrawalAllowed(worldSnapshot, actor, options.battleIntent || {})) problems.push({ problemId: 'DISENGAGE_PRESSURE', targetIds: [actorId], severity: normalizedLoss(actorCapacity) });
    if (options.stalemate === true) problems.push({ problemId: 'STALEMATE', severity: normalizedLoss(Math.max(1, capacity.total * 0.01)) });
    if (!problems.length) problems.push({ problemId: 'NEUTRAL_PROGRESS', severity: 1 });
    return problems.sort((left, right) => right.severity - left.severity);
  }

  function responseBranches(context) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    const actorSide = sideOf(context.worldSnapshot, actor);
    const immediateSourceId = String(context.actionOpportunity?.sourceActorId || '').trim();
    const immediateAction = context.actionOpportunity?.incomingAction;
    const immediateSource = immediateSourceId ? preview.findUnit(context.worldSnapshot, immediateSourceId) : null;
    if (immediateSource && immediateAction) {
      const rawThreat = visibleActionThreat(immediateSource, actor, immediateAction);
      return rawThreat > 0 ? [{
        responseId: `IMMEDIATE_ACTION:${immediateSourceId}`,
        sourceActorId: immediateSourceId,
        incomingAction: immediateAction,
        probability: 1,
        utility: -rawThreat,
        rawThreat,
        lethal: rawThreat >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
        unknown: false,
        explicit: true,
      }] : [];
    }
    if (context.actionOpportunity?.futureHostileResponseAllowed === false) return [];
    const visibleCharge = aliveEntries(context.worldSnapshot)
      .filter(entry => entry.side !== actorSide && entry.unit?.蓄力技能)
      .map(entry => {
        const charge = entry.unit.蓄力技能;
        const remainingCastTime = Math.max(0, Number(charge?.cast_time ?? charge?.skill?.前摇 ?? charge?.前摇 ?? 0));
        const namedTarget = String(charge?.target_id || charge?.targetId || charge?.target_name || charge?.targetIds?.[0] || '').trim();
        const targetsActor = !namedTarget || namedTarget === preview.unitId(actor) || namedTarget === preview.unitName(actor);
        return {
          sourceActorId: preview.unitId(entry.unit),
          incomingAction: charge,
          remainingCastTime,
          targetsActor,
          rawThreat: targetsActor ? visibleActionThreat(entry.unit, actor, charge) : 0,
        };
      })
      .filter(item => item.targetsActor && item.remainingCastTime <= 40 && item.rawThreat > 0)
      .sort((left, right) => right.rawThreat - left.rawThreat)[0];
    if (visibleCharge) {
      return [{
        responseId: `VISIBLE_CHARGE:${visibleCharge.sourceActorId}`,
        sourceActorId: visibleCharge.sourceActorId,
        incomingAction: visibleCharge.incomingAction,
        probability: 1,
        utility: -visibleCharge.rawThreat,
        rawThreat: visibleCharge.rawThreat,
        lethal: visibleCharge.rawThreat >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
        unknown: false,
        explicit: true,
      }];
    }
    const targetId = aliveEntries(context.worldSnapshot)
      .filter(entry => entry.side !== actorSide)
      .map(entry => {
        const unitId = preview.unitId(entry.unit);
        const responses = Array.isArray(context.beliefState?.publicResponses?.[unitId])
          ? context.beliefState.publicResponses[unitId]
          : [];
        return {
          targetId: unitId,
          threat: Math.max(0, ...responses.map(response => Number(response?.baseActionValue ?? response?.utility ?? 0))),
        };
      })
      .sort((left, right) => right.threat - left.threat || left.targetId.localeCompare(right.targetId))[0]?.targetId || '';
    const known = Array.isArray(context.beliefState?.publicResponses?.[targetId]) ? context.beliefState.publicResponses[targetId] : [];
    const unknownMass = unknownResponseMass(context.beliefState?.confidence);
    const knownMass = 1 - unknownMass;
    const targetProbability = estimatedHostileTargetProbability(context, actor, actorSide);
    const before = context.beforeUtility || stateUtility(context.worldSnapshot, actorSide, context.beliefState || {});
    const responseCapacityScale = Math.max(0, Number(before.own || 0)) / Math.max(1, Number(before.total || 0));
    const utilities = known.map(response => Number(response?.baseActionValue ?? response?.utility ?? 0));
    const center = median(utilities);
    const mad = Math.max(1, median(utilities.map(value => Math.abs(value - center))));
    const temperature = 1 + 3 * (1 - clamp(context.beliefState?.confidence || 0, 0, 1));
    const weighted = known.map(response => ({
      ...response,
      weight: Math.exp(((Number(response?.baseActionValue ?? response?.utility ?? 0) - center) / mad) / temperature),
    })).sort((left, right) => right.weight - left.weight);
    const totalWeight = weighted.reduce((sum, response) => sum + response.weight, 0) || 1;
    const normalizedKnown = weighted.map(response => ({
      responseId: String(response.responseId || ''),
      sourceActorId: targetId,
      probability: knownMass * response.weight / totalWeight,
      utility: -Math.max(0, Number(response.baseActionValue ?? response.utility ?? 0)) * responseCapacityScale * targetProbability,
      rawThreat: Math.max(0, Number(response.baseActionValue ?? response.utility ?? 0)),
      lethal: Math.max(0, Number(response.baseActionValue ?? response.utility ?? 0)) * targetProbability >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
      unknown: false,
    }));
    const knownSlots = Math.max(1, 3 - (unknownMass > 0 ? 1 : 0));
    const prioritizedKnown = [...normalizedKnown].sort((left, right) => Number(right.lethal) - Number(left.lethal) || right.probability - left.probability);
    const directKnownCount = prioritizedKnown.length <= knownSlots ? prioritizedKnown.length : Math.max(0, knownSlots - 1);
    const branches = prioritizedKnown.slice(0, directKnownCount);
    if (prioritizedKnown.length > directKnownCount) {
      const remainder = prioritizedKnown.slice(directKnownCount);
      const probability = remainder.reduce((sum, response) => sum + response.probability, 0);
      branches.push({
        responseId: 'KNOWN_RESPONSE_ENVELOPE',
        probability,
        utility: remainder.reduce((sum, response) => sum + response.utility * response.probability, 0) / Math.max(0.0001, probability),
        unknown: false,
        mergedCount: remainder.length,
      });
    }
    if (unknownMass > 0) {
      const targetBelief = context.beliefState?.units?.[targetId] || {};
      const threatEnvelope = Math.max(0, perceivedEnemyBaseValue(targetBelief)) * responseCapacityScale;
      branches.unshift({
        responseId: 'UNKNOWN_RESPONSE_ENVELOPE',
        sourceActorId: targetId,
        probability: unknownMass,
        utility: -threatEnvelope * targetProbability,
        rawThreat: Math.max(0, perceivedEnemyBaseValue(targetBelief, actor)),
        lethal: Math.max(0, perceivedEnemyBaseValue(targetBelief, actor)) * targetProbability >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
        unknown: true,
      });
    }
    return branches.slice(0, 3);
  }

  function activeStrategyMemory(memory = {}, worldSnapshot = {}, opportunity = {}, candidates = []) {
    if (!memory || typeof memory !== 'object') return {};
    const sequence = Math.max(0, Number(opportunity?.sequence || 0));
    if (Number(memory?.expiresAtOpportunity || 0) < sequence) return {};
    const targets = Array.isArray(memory?.targetIds) ? memory.targetIds.map(String).filter(Boolean) : [];
    if (targets.some(targetId => !preview.isAlive(preview.findUnit(worldSnapshot, targetId) || {}))) return {};
    const expected = new Set(Array.isArray(memory?.expectedOutcomeKinds) ? memory.expectedOutcomeKinds.map(String) : []);
    if (expected.has('ACTION_CANCELLED') && !targets.some(targetId => hasActionCancellation(preview.findUnit(worldSnapshot, targetId) || {}))) return {};
    if (expected.has('SUMMON_WINDOW')) {
      const summonExists = worldEntries(worldSnapshot).some(entry => {
        const runtime = entry.unit?.__battleRuntime || {};
        return runtime?.windowId || entry.unit?.召唤键 || entry.unit?.召唤来源;
      });
      if (!summonExists) return {};
    }
    const expectedWindows = Array.isArray(memory?.expectedWindowIds) ? memory.expectedWindowIds.map(String).filter(Boolean) : [];
    if (expectedWindows.length) {
      const activeWindows = new Set(worldEntries(worldSnapshot).flatMap(entry => {
        const runtime = entry.unit?.__battleRuntime || {};
        return [runtime.windowId, ...(Array.isArray(runtime.activeWindowIds) ? runtime.activeWindowIds : [])].map(String).filter(Boolean);
      }));
      if (expectedWindows.some(windowId => /summon|grant|window/i.test(windowId)) && !expectedWindows.some(windowId => activeWindows.has(windowId))) return {};
    }
    const stillNonDominated = candidates.some(candidate => !candidate.rejectionCode && (candidate.declaration.targetIds || []).some(targetId => targets.includes(String(targetId))));
    return stillNonDominated ? memory : {};
  }

  function snapshotAfterResponseThreat(worldSnapshot = {}, targetId = '', rawThreat = 0) {
    let cachedByThreat = responseThreatSnapshotCache.get(worldSnapshot);
    if (!cachedByThreat) {
      cachedByThreat = new Map();
      responseThreatSnapshotCache.set(worldSnapshot, cachedByThreat);
    }
    const cacheKey = `${String(targetId || '').trim()}|${Number(clamp(rawThreat, 0, 100)).toPrecision(15)}`;
    if (cachedByThreat.has(cacheKey)) return cachedByThreat.get(cacheKey);
    const participants = worldSnapshot?.参战者 || {};
    const nextParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
      const update = unit => {
        if (preview.unitId(unit) !== targetId) return unit;
        const next = { ...unit, 属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : unit?.属性, 状态: unit?.状态 && typeof unit.状态 === 'object' ? { ...unit.状态 } : unit?.状态 };
        const hp = Math.max(0, preview.readHp(unit) - preview.readHpMax(unit) * clamp(rawThreat, 0, 100) / 100);
        next.hp = hp;
        next.HP = hp;
        if (next.属性 && typeof next.属性 === 'object') next.属性.HP = hp;
        if (hp <= 0 && next.状态 && typeof next.状态 === 'object') next.状态.存活 = false;
        else {
          const damage = Math.max(0, preview.readHp(unit) - hp);
          if (preview.shouldTriggerTraumaUnconscious(damage, hp, preview.readHpMax(unit))) {
            next.状态 = { ...(next.状态 || {}), 行动: '昏迷' };
          }
        }
        return next;
      };
      if (Array.isArray(value)) return [side, value.map(update)];
      if (value && typeof value === 'object') return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, update(unit)]))];
      return [side, value];
    }));
    const result = markCapacityDeltaSnapshot(attachDecisionRuntimeState(
      { ...worldSnapshot, 参战者: nextParticipants },
      worldSnapshot,
    ), worldSnapshot, [targetId]);
    cachedByThreat.set(cacheKey, result);
    return result;
  }

  function needsDeepPreview(candidate, result, before, after, beliefState = {}) {
    const outcomes = new Set((result?.contributions || []).map(entry => entry.outcomeKind));
    const beforeAlive = aliveEntries(before).length;
    const afterAlive = aliveEntries(after).length;
    return beforeAlive !== afterAlive ||
      ['ACTION_CANCELLED', 'ACTION_GRANTED', 'IRREVERSIBLE_ASSET_LOST', 'SUMMON_WINDOW', 'STATE_SCHEDULED'].some(kind => outcomes.has(kind)) ||
      (result?.scheduledEvents || []).length > 0 ||
      Array.isArray(beliefState?.publicResponses?.[candidate.declaration.targetIds?.[0]]);
  }

  function battleIntentMode(context = {}) {
    const intent = context?.battleIntent;
    if (typeof intent === 'string') return intent.trim();
    return String(intent?.mode || intent?.intent || intent?.name || '').trim();
  }

  function withdrawalAllowed(worldSnapshot = {}, actor = {}, battleIntent = {}) {
    const objectiveContext = objectiveActorContext(worldSnapshot, sideOf(worldSnapshot, actor), battleIntent || {});
    if (objectiveContext.objectives.explicit) {
      return objectiveContext.successConditions.some(condition => condition.type === 'WITHDRAW_SUCCESS');
    }
    return battleIntent?.withdrawAllowed === true || /求生|撤退|脱离|逃生/.test(battleIntentMode({ battleIntent }));
  }

  function actorBattleIntent(worldSnapshot = {}, actorSide = '', inputIntent = null) {
    const supplied = inputIntent && (typeof inputIntent === 'string' || typeof inputIntent === 'object') ? inputIntent : null;
    const source = typeof supplied === 'string'
      ? { mode: supplied.trim(), objectives: worldSnapshot?.胜负条件 || {} }
      : {
          ...(supplied || {}),
          mode: String(supplied?.mode || supplied?.intent || supplied?.name || worldSnapshot?.战斗意图 || '').trim(),
          objectives: supplied?.objectives || supplied?.胜负条件 || worldSnapshot?.胜负条件 || {},
        };
    const mode = String(source.mode || '').trim();
    if (!/enemy|敌方/i.test(String(actorSide || '')) || !/求生|撤退|脱离|逃生/.test(mode)) return source;
    return { ...source, mode: '阻止撤离', opposingIntent: mode };
  }

  function intentTerminalUtility(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const objectives = preview.normalizeBattleObjectives(context?.battleIntent?.objectives || context?.battleIntent?.胜负条件 || afterSnapshot?.胜负条件 || {}, afterSnapshot);
    if (!objectives.explicit && !/点到为止|切磋|训练|非致命/.test(battleIntentMode(context))) return 0;
    const before = preview.evaluateBattleObjectives(beforeSnapshot, objectives, { roundCompleted: false });
    if (before.terminal) return 0;
    const after = preview.evaluateBattleObjectives(afterSnapshot, objectives, { roundCompleted: false });
    if (!after.terminal || after.winner === 'draw') return 0;
    const actorIsPlayer = /player|玩家|我方|己方|友方/i.test(String(actorSide || ''));
    const actorWon = after.winner === (actorIsPlayer ? 'player' : 'enemy');
    return actorWon ? 100 : -100;
  }

  function immediateActionCancellationProfile(unit = {}) {
    return collectSkills(unit).reduce((best, skill) => {
      if (!costAffordable(unit, skill) || Math.max(0, Number(skill?.前摇 ?? skill?.cast_time ?? 0)) > 40) return best;
      const profile = targetProfile(skill);
      if (!['HOSTILE_SINGLE', 'HOSTILE_GROUP', 'ANY_SINGLE'].includes(profile)) return best;
      const probability = preview.collectEffects(skill).reduce((highest, effect) => {
        if (String(effect?.原型 || '').trim() !== '状态施加') return highest;
        const stateName = String(effect?.状态 || effect?.状态名称 || '').trim();
        const mechanics = preview.deriveStateCombatEffect(effect);
        const cancelsAction = isHardControlStateName(stateName) || mechanics?.skip_turn === true || mechanics?.cannot_act === true;
        return cancelsAction ? Math.max(highest, probabilityValue(effect?.成功率 ?? effect?.触发概率, 0.65)) : highest;
      }, 0);
      if (!(probability > best.probability)) return best;
      return { probability, group: profile === 'HOSTILE_GROUP' };
    }, { probability: 0, group: false });
  }

  function remainingEnemyThreatAfterAlliedDenial(snapshot, actorSide, actorId, protectedUnit, enemies) {
    const orderedUnits = aliveEntries(snapshot).map(entry => entry.unit).sort(preview.compareNaturalActionOrder);
    const turnIndex = new Map(orderedUnits.map((unit, index) => [preview.unitId(unit), index]));
    const threats = enemies
      .filter(enemy => !hasActionCancellation(enemy))
      .map(enemy => ({ enemy, value: bestBaseActionValueAgainst(snapshot, enemy, protectedUnit) / 100 }))
      .filter(entry => entry.value > 0);
    const controllers = aliveEntries(snapshot)
      .filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== actorId && !hasActionCancellation(entry.unit))
      .map(entry => ({ unit: entry.unit, profile: immediateActionCancellationProfile(entry.unit) }))
      .filter(entry => entry.profile.probability > 0)
      .sort((left, right) => preview.compareNaturalActionOrder(left.unit, right.unit));
    controllers.forEach(controller => {
      const controllerIndex = Number(turnIndex.get(preview.unitId(controller.unit)) ?? Number.MAX_SAFE_INTEGER);
      const reachable = threats
        .filter(entry => controllerIndex < Number(turnIndex.get(preview.unitId(entry.enemy)) ?? -1) && entry.value > 0)
        .sort((left, right) => right.value - left.value);
      const affected = controller.profile.group ? reachable : reachable.slice(0, 1);
      affected.forEach(entry => { entry.value *= 1 - controller.profile.probability; });
    });
    return threats.reduce((sum, entry) => sum + entry.value, 0);
  }

  function intentProgressUtility(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const objectiveContext = objectiveActorContext(afterSnapshot, actorSide, context?.battleIntent || {});
    if (!objectiveContext.objectives.explicit) {
      return { utility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true };
    }
    const progressConditions = objectiveContext.successConditions.filter(condition =>
      ['HP_RATIO_AT_OR_BELOW', 'TEAM_INCAPACITATED', 'UNIT_INCAPACITATED', 'TEAM_DEAD', 'UNIT_DEAD'].includes(condition.type)
    );
    const conditionTargets = (snapshot, condition) => {
      const targetIds = new Set((condition.targetIds || []).map(String));
      return worldEntries(snapshot)
        .filter(entry => {
          const side = /player|玩家|我方|己方|友方/i.test(String(entry.side || '')) ? 'PLAYER' : 'ENEMY';
          return (!condition.side || side === condition.side) &&
            (!targetIds.size || targetIds.has(preview.unitId(entry.unit)) || targetIds.has(preview.unitName(entry.unit)));
        })
        .map(entry => entry.unit);
    };
    const conditionProgress = (snapshot, condition) => {
      const targets = conditionTargets(snapshot, condition);
      if (!targets.length) return 0;
      const values = targets.map(unit => {
        if (condition.type === 'HP_RATIO_AT_OR_BELOW') {
          return clamp(
            (1 - preview.readHp(unit) / preview.readHpMax(unit)) / Math.max(0.01, 1 - condition.threshold),
            0,
            1,
          );
        }
        if (['TEAM_DEAD', 'UNIT_DEAD'].includes(condition.type)) {
          return preview.isDead(unit)
            ? 1
            : clamp(1 - preview.readHp(unit) / Math.max(1, preview.readHpMax(unit)), 0, 1);
        }
        if (!preview.isBattleCapable(unit)) return 1;
        const hpProgress = clamp(
          1 - preview.readHp(unit) / Math.max(1, preview.readHpMax(unit)),
          0,
          1,
        );
        const staminaProgress = clamp(
          1 - preview.readResource(unit, '体力') / Math.max(1, preview.readResourceMax(unit, '体力')),
          0,
          1,
        );
        return context?.useJointIncapacitationProgress === true
          ? clamp(1 - (1 - hpProgress) * (1 - staminaProgress), 0, 1)
          : Math.max(hpProgress, staminaProgress);
      });
      if (condition.scope !== 'ALL') return Math.max(...values);
      if (['TEAM_INCAPACITATED', 'UNIT_INCAPACITATED', 'TEAM_DEAD', 'UNIT_DEAD'].includes(condition.type)) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      }
      return Math.min(...values);
    };
    const elapsedRounds = Math.max(0, Number(afterSnapshot?.回合 || 0) - objectiveContext.objectives.startRound);
    const remainingActionsIncludingCurrent = Math.max(1, objectiveContext.objectives.maxRounds - elapsedRounds + 1);
    const urgency = clamp(
      objectiveContext.objectives.maxRounds / remainingActionsIncludingCurrent,
      1,
      context?.useJointIncapacitationProgress === true
        ? Math.max(1, objectiveContext.objectives.maxRounds)
        : 2,
    );
    const profiles = progressConditions.map(condition => {
      const beforeProgress = conditionProgress(beforeSnapshot, condition);
      const afterProgress = conditionProgress(afterSnapshot, condition);
      const progressGain = Math.max(0, afterProgress - beforeProgress);
      const requiredProgress = Math.max(0, 1 - beforeProgress) / remainingActionsIncludingCurrent;
      const deadlineShortfall = Math.max(0, requiredProgress - progressGain);
      const utility = 100 * (progressGain - deadlineShortfall) * urgency;
      return { utility, deadlineActive: true, progressGain, requiredProgress, deadlineFeasible: progressGain + 1e-9 >= requiredProgress };
    });
    const goalProfile = objectiveContext.successLogic === 'ALL' && profiles.length > 1
      ? {
          utility: profiles.reduce((sum, profile) => sum + profile.utility, 0) / profiles.length,
          deadlineActive: true,
          progressGain: profiles.reduce((sum, profile) => sum + profile.progressGain, 0) / profiles.length,
          requiredProgress: profiles.reduce((sum, profile) => sum + profile.requiredProgress, 0) / profiles.length,
          deadlineFeasible: profiles.every(profile => profile.deadlineFeasible),
        }
      : profiles.reduce((best, profile) => !best || profile.utility > best.utility ? profile : best, null);
    const survivalConditions = objectiveContext.failureConditions
      .filter(condition => condition.type === 'UNIT_INCAPACITATED')
      .filter(condition => condition.side === objectiveContext.ownSide);
    const futureFailureRisk = (snapshot, condition) => {
      const targets = aliveEntries(snapshot)
        .filter(entry => entry.side === actorSide)
        .map(entry => entry.unit)
        .filter(unit =>
          !condition.targetIds?.length ||
          condition.targetIds.includes(preview.unitId(unit)) ||
          condition.targetIds.includes(preview.unitName(unit))
        );
      if (!targets.length) return 1;
      const enemies = aliveEntries(snapshot).filter(entry => entry.side !== actorSide).map(entry => entry.unit);
      const risks = targets.map(unit => {
        if (!preview.isAlive(unit)) return 1;
        const hpRatio = preview.readHp(unit) / Math.max(1, preview.readHpMax(unit));
        const responseThreat = remainingEnemyThreatAfterAlliedDenial(snapshot, actorSide, context.actorId, unit, enemies);
        return responseThreat > 0
          ? clamp(responseThreat / Math.max(0.0001, responseThreat + hpRatio), 0, 1)
          : 0;
      });
      return condition.scope === 'ALL' ? Math.max(...risks) : Math.min(...risks);
    };
    const survivalRiskReduction = survivalConditions.reduce((best, condition) => Math.max(
      best,
      futureFailureRisk(beforeSnapshot, condition) - futureFailureRisk(afterSnapshot, condition),
    ), 0);
    const survivalUtility = 100 * survivalRiskReduction * urgency;
    if (!goalProfile) {
      return { utility: Math.min(100, survivalUtility), deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true };
    }
    return {
      ...goalProfile,
      utility: clamp(
        survivalRiskReduction > 1e-9 ? Math.max(goalProfile.utility, survivalUtility) : goalProfile.utility,
        context?.useJointIncapacitationProgress === true ? -100 * urgency : -100,
        context?.useJointIncapacitationProgress === true ? 100 * urgency : 100,
      ),
    };
  }

  function scoreCandidate(candidate, context) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    const actorSide = sideOf(context.worldSnapshot, actor);
    const before = context.beforeUtility;
    let result;
    if (!candidate.creation && ['RELEASE_SKILL', 'BASIC_ATTACK', 'USE_ITEM', 'EQUIP'].includes(candidate.declaration.actionKind)) {
      result = preview.previewAction({
        worldSnapshot: context.worldSnapshot,
        worldRevision: context.worldRevision,
        beliefSnapshot: context.beliefState,
        beliefRevision: context.beliefRevision,
        actorId: context.actorId,
        declaration: candidate.declaration,
        actionFingerprint: candidate.candidateId,
        battleIntent: context.battleIntent,
        horizon: 'SHALLOW',
        previewBudget: { maxNodes: 12 },
      });
    }
    const candidateEffects = preview.collectEffects(candidate.skill || candidate.declaration?.skill || {});
    const stateEffects = candidateEffects.filter(effect => String(effect?.原型 || '').trim() === '状态施加');
    const ephemeralAvoidanceEffects = stateEffects.filter(effect => {
      if (Math.max(1, Number(effect?.持续回合 || 1)) > 1) return false;
      const combatEffect = preview.deriveStateCombatEffect(effect);
      if (combatEffect?.skip_turn === true || combatEffect?.cannot_act === true) return false;
      return Number(combatEffect?.dodge_penalty || 0) > 0 || Number(combatEffect?.lock_level || 0) > 0;
    });
    const capacitySnapshot = result
      ? withoutCandidateStateEffects(result.afterSnapshot, ephemeralAvoidanceEffects)
      : context.worldSnapshot;
    const after = result ? stateUtility(capacitySnapshot, actorSide, context.beliefState) : before;
    const resourceSupportOnly = candidateEffects.length > 0 && candidateEffects.every(effect => {
      if (String(effect?.原型 || '').trim() !== '资源变化') return false;
      if (/生命|HP/i.test(String(effect?.资源 || ''))) return false;
      return Number.parseFloat(String(effect?.数值 || '0')) > 0;
    });
    const mechanicObservations = stateEffects.flatMap(effect => (candidate.declaration.targetIds || []).map(targetId => {
      const estimatedProbability = probabilityValue(effect?.成功率 ?? effect?.触发概率, 0.65);
      const relevantFingerprint = relevantStateFingerprint(context.beliefState, targetId);
      const key = mechanicKey({
        sourceActionId: candidate.candidateId,
        effectPrototype: '状态施加',
        targetId,
        relevantStateFingerprint: relevantFingerprint,
      });
      return {
        mechanicKey: key,
        sourceActionId: candidate.candidateId,
        effectPrototype: '状态施加',
        targetId,
        stateName: String(effect?.状态 || effect?.状态名称 || '').trim(),
        relevantStateFingerprint: relevantFingerprint,
        estimatedProbability,
        experience: experienceOf(actor),
        posterior: mechanicPosterior(context.beliefState, key, estimatedProbability, experienceOf(actor)),
      };
    }));
    const withdrawalProfile = candidate.declaration.actionKind === 'WITHDRAW'
      ? aliveEntries(context.worldSnapshot)
          .filter(entry => entry.side !== actorSide)
          .map(entry => ({ targetId: preview.unitId(entry.unit), estimate: preview.estimateWithdrawal(actor, entry.unit) }))
          .sort((left, right) => left.estimate.successProbability - right.estimate.successProbability)[0] || null
      : null;
    const withdrawalEstimate = withdrawalProfile?.estimate || null;
    if (withdrawalProfile) {
      const relevantFingerprint = relevantStateFingerprint(context.beliefState, withdrawalProfile.targetId);
      const key = mechanicKey({
        sourceActionId: 'WITHDRAW',
        effectPrototype: '撤离判定',
        targetId: withdrawalProfile.targetId,
        relevantStateFingerprint: relevantFingerprint,
      });
      mechanicObservations.push({
        mechanicKey: key,
        sourceActionId: 'WITHDRAW',
        effectPrototype: '撤离判定',
        targetId: withdrawalProfile.targetId,
        stateName: '撤离',
        relevantStateFingerprint: relevantFingerprint,
        estimatedProbability: withdrawalEstimate.successProbability,
        experience: experienceOf(actor),
        posterior: mechanicPosterior(context.beliefState, key, withdrawalEstimate.successProbability, experienceOf(actor)),
      });
    }
    const stateMechanicObservations = mechanicObservations.filter(observation => observation.effectPrototype === '状态施加');
    const mechanicProbability = stateMechanicObservations.length
      ? stateMechanicObservations.reduce((sum, observation) => sum + observation.posterior, 0) / stateMechanicObservations.length
      : 1;
    const withdrawalProbability = mechanicObservations.find(observation => observation.effectPrototype === '撤离判定')?.posterior
      ?? withdrawalEstimate?.successProbability
      ?? 0;
    let expectedStateGain = candidate.counterDeclineFallback
      ? 0
      : result
      ? 100 * (after.utility - before.utility) / Math.max(1, before.total)
      : directDefensiveUtility(candidate.declaration.actionKind, context);
    const materialResourceUnlock = resourceSupportOnly && result
      ? realizableResourceSupportGain(context, result)
      : 0;
    if (resourceSupportOnly) expectedStateGain = materialResourceUnlock;
    if (result) {
      const controlledDamagedTargets = new Set((candidate.declaration.targetIds || []).filter(targetId => {
        const targetBefore = preview.findUnit(context.worldSnapshot, targetId);
        const targetAfter = preview.findUnit(result.afterSnapshot, targetId);
        return targetBefore && targetAfter && sideOf(context.worldSnapshot, targetBefore) !== actorSide &&
          hasActionCancellation(targetBefore) && preview.readHp(targetAfter) < preview.readHp(targetBefore);
      }));
      if (controlledDamagedTargets.size) {
        const horizonOptions = { restoreActionAvailabilityFor: controlledDamagedTargets };
        const beforeNextWindow = stateUtility(context.worldSnapshot, actorSide, context.beliefState, horizonOptions);
        const afterNextWindow = stateUtility(result.afterSnapshot, actorSide, context.beliefState, horizonOptions);
        const nextWindowGain = 100 * (afterNextWindow.utility - beforeNextWindow.utility) / Math.max(1, beforeNextWindow.total);
        expectedStateGain = Math.max(expectedStateGain, nextWindowGain);
      }
    }
    if (candidate.creation?.useful) {
      const paidSnapshot = snapshotAfterResourceCosts(context.worldSnapshot, context.actorId, candidate.costs || {});
      const futureUseWorld = snapshotAfterCreation(paidSnapshot, context.actorId, candidate.creation);
      const paidUtility = stateUtility(paidSnapshot, actorSide, context.beliefState);
      expectedStateGain = 100 * (paidUtility.utility - before.utility) / Math.max(1, before.total);
      const futureUseEffects = (candidate.creation.useEffects || []).map(effect => ({
        ...cloneValue(effect),
        目标: String(effect?.目标 || '').trim() === '自身' ? '单体' : effect?.目标,
      }));
      const futureUseGain = (candidate.creation.consumerIds || []).reduce((bestGain, targetId) => {
        const futureUse = preview.previewAction({
          worldSnapshot: futureUseWorld,
          worldRevision: `${context.worldRevision}:paid:${candidate.candidateId}`,
          beliefSnapshot: context.beliefState,
          beliefRevision: context.beliefRevision,
          actorId: context.actorId,
          declaration: {
            actionId: `${candidate.candidateId}:future-use:${targetId}`,
            actorId: context.actorId,
            actionKind: 'USE_ITEM',
            targetIds: [targetId],
            skill: { id: `${candidate.candidateId}:product`, name: candidate.creation.productId, _效果数组: futureUseEffects },
          },
          actionFingerprint: `${candidate.candidateId}:future-use:${targetId}`,
          battleIntent: context.battleIntent,
          horizon: 'SHALLOW',
          previewBudget: { maxNodes: 12 },
        });
        const futureUtility = stateUtility(futureUse.afterSnapshot, actorSide, context.beliefState);
        return Math.max(bestGain, 100 * (futureUtility.utility - paidUtility.utility) / Math.max(1, before.total));
      }, 0);
      expectedStateGain += Math.max(0, futureUseGain) * 0.65;
    }
    if (withdrawalEstimate) {
      expectedStateGain = expectedStateGain * withdrawalProbability -
        100 * withdrawalEstimate.expectedPursuitDamage / Math.max(1, preview.readHpMax(actor));
    }
    if (result && stateEffects.length) {
      const scoredStateEffects = stateEffects.filter(effect => !ephemeralAvoidanceEffects.includes(effect));
      const withoutStates = stateUtility(withoutCandidateStateEffects(capacitySnapshot, scoredStateEffects), actorSide, context.beliefState);
      const stateGain = 100 * (after.utility - withoutStates.utility) / Math.max(1, before.total);
      expectedStateGain -= stateGain * (1 - mechanicProbability);
    }
    const withdrawalTerminalUtility = !result && withdrawalEstimate && isSurvivalIntent(context)
      ? (directDefensiveUtility('WITHDRAW', context) > 0 ? 35 * withdrawalProbability : 0)
      : 0;
    const terminalUtility = result
      ? intentTerminalUtility(context.worldSnapshot, result.afterSnapshot, actorSide, context)
      : withdrawalTerminalUtility;
    const objectivePace = candidate.counterDeclineFallback
      ? { utility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true }
      : terminalUtility === 0
      ? intentProgressUtility(context.worldSnapshot, result?.afterSnapshot || context.worldSnapshot, actorSide, context)
      : { utility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true };
    const objectiveProgress = objectivePace.utility;
    const actionCancelled = (result?.contributions || []).some(entry => entry.outcomeKind === 'ACTION_CANCELLED');
    let controlOverlap = false;
    if (actionCancelled) {
      const targetId = candidate.declaration.targetIds?.[0] || '';
      const target = preview.findUnit(context.worldSnapshot, targetId);
      controlOverlap = !!target && hasActionCancellation(target);
    }
    const ephemeralWindowGain = estimateEphemeralStateWindowGain(
      ephemeralAvoidanceEffects,
      result,
      { ...context, candidateTargetIds: candidate.declaration.targetIds || [] },
    );
    expectedStateGain += 100 * Math.max(0, ephemeralWindowGain) / Math.max(1, before.total);
    const directStateGain = expectedStateGain;
    const informationValue = candidate.declaration.actionKind === 'OBSERVE' ? estimateInformationValue(context) : 0;
    const irreversibleContributions = (result?.contributions || []).filter(entry => entry.outcomeKind === 'IRREVERSIBLE_ASSET_LOST');
    const irreversibleCost = irreversibleContributions.reduce((sum, entry) => {
      const evidenceCost = entry?.evidence && Object.prototype.hasOwnProperty.call(entry.evidence, 'cost')
        ? Number(entry.evidence.cost)
        : Number.NaN;
      if (Number.isFinite(evidenceCost)) return sum + Math.max(0, evidenceCost);
      return sum + (Number(entry.threatValue) > 0 ? Number(entry.threatValue) : 20);
    }, 0);
    const sharedLethalResponse = context.sharedResponseBranches.some(branch => branch?.lethal === true);
    const deepRequired = sharedLethalResponse || needsDeepPreview(
      candidate,
      result || {},
      context.worldSnapshot,
      result?.afterSnapshot || context.worldSnapshot,
      context.beliefState,
    );
    const branches = deepRequired && terminalUtility === 0 ? context.sharedResponseBranches.map(branch => {
      const actionKind = String(candidate?.declaration?.actionKind || '').trim();
      const source = preview.findUnit(context.worldSnapshot, branch?.sourceActorId || '');
      const sourceAfter = preview.findUnit(result?.afterSnapshot || context.worldSnapshot, branch?.sourceActorId || '');
      const incomingSkill = branch?.incomingAction?.skill || branch?.incomingAction || null;
      const hitProbability = source && incomingSkill
        ? (preview.collectEffects(incomingSkill).filter(effect => String(effect?.原型 || '').trim() === '伤害结算')
            .map(effect => preview.estimateHitProbability(source, actor, effect))[0] ?? 1)
        : 1;
      const existingDefenseKind = String(actor?.__battleRuntime?.activeDefenseStance?.type || actor?.__battleRuntime?.activeDefenseStance?.actionKind || '').trim().toUpperCase();
      const candidateDefenseKind = ['DEFEND', 'EVADE', 'GUARD'].includes(actionKind) ? actionKind : '';
      const preparedDefenseKind = candidateDefenseKind || existingDefenseKind;
      const preparedDefenseMultiplier = ['DEFEND', 'GUARD'].includes(preparedDefenseKind)
        ? 0.65
        : preparedDefenseKind === 'EVADE' ? hitProbability : 1;
      const responseMultiplier = preparedDefenseKind
        ? preparedDefenseMultiplier
        : actionKind === 'DEFEND' ? 0.65 : actionKind === 'EVADE' ? hitProbability : 1;
      const responsePrevented = !!source && (!sourceAfter || !preview.isBattleCapable(sourceAfter) || hasActionCancellation(sourceAfter));
      const effectiveRawThreat = responsePrevented
        ? 0
        : Math.max(0, Number(branch.rawThreat || 0)) * responseMultiplier;
      const responseSnapshot = snapshotAfterResponseThreat(result?.afterSnapshot || context.worldSnapshot, context.actorId, effectiveRawThreat);
      const responseState = stateUtility(responseSnapshot, actorSide, context.beliefState);
      const responseTerminalUtility = intentTerminalUtility(
        result?.afterSnapshot || context.worldSnapshot,
        responseSnapshot,
        actorSide,
        context,
      );
      const baselineSource = preview.findUnit(context.worldSnapshot, branch?.sourceActorId || '');
      const baselineResponsePrevented = !!baselineSource &&
        (!preview.isBattleCapable(baselineSource) || hasActionCancellation(baselineSource));
      const baselineRawThreat = baselineResponsePrevented
        ? 0
        : Math.max(0, Number(branch.rawThreat || 0)) * preparedDefenseMultiplier;
      const baselineResponseSnapshot = snapshotAfterResponseThreat(context.worldSnapshot, context.actorId, baselineRawThreat);
      const baselineResponseState = stateUtility(baselineResponseSnapshot, actorSide, context.beliefState);
      const baselineResponseTerminalUtility = intentTerminalUtility(
        context.worldSnapshot,
        baselineResponseSnapshot,
        actorSide,
        context,
      );
      const responseDeltaUtility =
        100 * (
          (responseState.utility - after.utility) -
          (baselineResponseState.utility - before.utility)
        ) / Math.max(1, before.total) +
        responseTerminalUtility -
        baselineResponseTerminalUtility;
      return {
        ...branch,
        effectiveRawThreat,
        responseTerminalUtility,
        stateUtilityAfterResponse: responseState.utility,
        capacityLoss: Math.max(0, after.own - responseState.own),
        baselineRawThreat,
        baselineResponseTerminalUtility,
        baselineStateUtilityAfterResponse: baselineResponseState.utility,
        responseDeltaUtility,
      };
    }) : [];
    const expectedResponseUtility = branches.reduce((sum, branch) => sum + Number(branch?.probability || 0) * Number(branch?.utility || 0), 0);
    const expectedResponseDeltaUtility = branches.reduce((sum, branch) =>
      sum + Number(branch?.probability || 0) * Number(branch?.responseDeltaUtility || 0), 0);
    expectedStateGain += expectedResponseDeltaUtility;
    const catastrophicRisk = (result?.contributions || []).filter(entry => entry.outcomeKind === 'TAIL_FAILURE').reduce((sum, entry) => sum + Math.abs(entry.threatValue), 0) +
      branches.reduce((sum, branch) => {
        const probability = Number(branch?.probability || 0);
        const catastrophic = branch?.lethal === true || Number(branch?.responseTerminalUtility || 0) < 0;
        if (!catastrophic) return sum;
        const normalizedCapacityLoss = 100 * Math.max(0, Number(branch?.capacityLoss || 0)) / Math.max(1, before.total);
        const terminalLoss = Math.max(0, -Number(branch?.responseTerminalUtility || 0));
        return sum + probability * Math.max(normalizedCapacityLoss, terminalLoss);
      }, 0);
    const resultTimeline = deepRequired && mechanicObservations.length
      ? [
          { nodeType: 'RESULT_SUCCESS', probability: mechanicProbability },
          { nodeType: 'RESULT_RESISTED', probability: 1 - mechanicProbability },
        ]
      : deepRequired ? [{ nodeType: 'RESULT_RESOLVED', probability: 1 }] : [];
    const opensAllyWindow = (result?.contributions || []).some(entry => ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW', 'STATE_CHANGED', 'STATE_SCHEDULED'].includes(entry.outcomeKind));
    const firstAlly = aliveEntries(result?.afterSnapshot || context.worldSnapshot)
      .filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== context.actorId)
      .sort((left, right) => bestBaseActionValue(result?.afterSnapshot || context.worldSnapshot, right.unit) - bestBaseActionValue(result?.afterSnapshot || context.worldSnapshot, left.unit))[0];
    const actorAfter = result ? preview.findUnit(result.afterSnapshot, preview.unitId(actor)) : null;
    const deepTimeline = deepRequired ? [
      { nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId },
      ...resultTimeline,
      ...branches.map(branch => ({ nodeType: branch.unknown ? 'UNKNOWN_RESPONSE' : 'KNOWN_RESPONSE', ...branch })),
      ...(opensAllyWindow
        ? [{ nodeType: 'FIRST_ALLY_WINDOW', actorId: firstAlly ? preview.unitId(firstAlly.unit) : '', baseActionValue: firstAlly ? bestBaseActionValue(result?.afterSnapshot || context.worldSnapshot, firstAlly.unit) : 0 }]
        : []),
      { nodeType: 'ACTOR_NEXT_OPPORTUNITY', baseActionValue: bestBaseActionValue(result?.afterSnapshot || context.worldSnapshot, actorAfter || actor) },
    ].slice(0, 12) : [{ nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId }];
    const objectiveStateGainWeight = objectivePace.deadlineActive &&
      objectivePace.requiredProgress > 1e-9 &&
      !context.problems?.some(problem => ['SURVIVAL_CRISIS', 'IMMINENT_DENIAL', 'ALLY_CRISIS'].includes(problem?.problemId))
      ? clamp(objectivePace.progressGain / objectivePace.requiredProgress, 0.1, 1)
      : 1;
    expectedStateGain = clamp(expectedStateGain, -100, 100);
    const objectiveRelevantStateGain = expectedStateGain * objectiveStateGainWeight;
    const objectiveUtility = clamp(objectiveRelevantStateGain + terminalUtility + objectiveProgress + informationValue - irreversibleCost - catastrophicRisk, -200, 200);
    const hasProgress = expectedStateGain > 0.0001 || terminalUtility > 0 || objectiveProgress > 0 || informationValue > 0;
    const hasCost = Object.keys(candidate.costs || {}).length > 0 || irreversibleCost > 0 || ['EQUIP', 'USE_ITEM'].includes(candidate.declaration.actionKind);
    const hasMeaningfulPreviewEffect = candidate.creation?.useful === true || !!result && (
      (result.scheduledEvents || []).length > 0 ||
      (result.contributions || []).some(entry => {
        const evidence = entry?.evidence || {};
        if (entry.outcomeKind === 'HP_DELTA') return Number(evidence.delta ?? evidence.expectedDamage ?? 0) > 0 || Number(entry.threatValue || 0) > 0;
        if (entry.outcomeKind === 'SHIELD_DELTA') {
          return Math.abs(Number(evidence.delta ?? (Number(evidence.next || 0) - Number(evidence.current || 0)) ?? entry.threatValue ?? 0)) > 0.0001;
        }
        if (entry.outcomeKind === 'RESOURCE_OPTION_CHANGED') return Number(evidence.delta || 0) > 0 && evidence.windowId !== 'ACTION_COST';
        if (entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
          return Math.abs(Number(evidence.delta || 0)) > 0.0001 || Number(evidence.multiplier || 0) > 0;
        }
        if (entry.outcomeKind === 'STATE_CHANGED') return evidence.marginal !== false;
        return ['ACTION_CANCELLED', 'ACTION_GRANTED', 'BELIEF_CHANGED', 'RULE_CHANGED', 'SUMMON_WINDOW', 'IRREVERSIBLE_ASSET_LOST'].includes(entry.outcomeKind);
      })
    );
    const stateHasMarginalValue = stateEffects.some(effect => (candidate.declaration.targetIds || [])
      .map(targetId => preview.findUnit(context.worldSnapshot, targetId))
      .filter(Boolean)
      .some(target => stateEffectHasMarginalValue(effect, target)));
    const summonEvents = (result?.scheduledEvents || []).filter(event => event?.type === 'SUMMON_CREATE');
    const hasNonStateMarginalValue = (result?.contributions || []).some(entry => {
      const evidence = entry?.evidence || {};
      if (entry.outcomeKind === 'HP_DELTA') {
        return Math.abs(Number(evidence.delta ?? evidence.expectedDamage ?? entry.threatValue ?? 0)) > 0.0001;
      }
      if (entry.outcomeKind === 'SHIELD_DELTA') {
        return Math.abs(Number(evidence.delta ?? (Number(evidence.next || 0) - Number(evidence.current || 0)) ?? entry.threatValue ?? 0)) > 0.0001;
      }
      if (entry.outcomeKind === 'RESOURCE_OPTION_CHANGED') {
        return Math.abs(Number(evidence.delta || 0)) > 0.0001 && evidence.windowId !== 'ACTION_COST';
      }
      if (entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
        return Math.abs(Number(evidence.delta || 0)) > 0.0001 || Number(evidence.multiplier || 0) > 0;
      }
      return ['ACTION_CANCELLED', 'ACTION_GRANTED', 'BELIEF_CHANGED', 'RULE_CHANGED', 'SUMMON_WINDOW', 'IRREVERSIBLE_ASSET_LOST'].includes(entry.outcomeKind);
    });
    const hasOnlyRedundantStates = stateEffects.length > 0 && !stateHasMarginalValue && !summonEvents.length &&
      !hasNonStateMarginalValue;
    const resourceUnlockMissing = resourceSupportOnly && materialResourceUnlock <= 0.0001;
    const zeroEffectCostly = hasCost && (!hasMeaningfulPreviewEffect || hasOnlyRedundantStates || resourceUnlockMissing) && informationValue <= 0 && directDefensiveUtility(candidate.declaration.actionKind, context) <= 0;
    const selfDefeating = !!actorAfter && !preview.isAlive(actorAfter) && expectedStateGain <= 0.0001 && terminalUtility <= 0 && informationValue <= 0;
    const summonWindowMissing = summonEvents.some(event => !event.actionMode || Number(event.duration || 0) <= 0);
    const lifecycleReject = candidate.creation && !candidate.creation.useful ? 'ZERO_EFFECT_COSTLY' : summonWindowMissing ? 'SUMMON_NO_ACTION_WINDOW' : resourceUnlockMissing ? (hasCost ? 'ZERO_EFFECT_COSTLY' : 'ZERO_PROGRESS') : '';
    const intentReject = terminalUtility < 0 ? 'INTENT_TERMINAL_CONFLICT' : '';
    return {
      ...candidate,
      preview: result || null,
      predictedOutcomeEvidence: predictedOutcomeEvidence(result),
      utilityBefore: before.utility,
      utilityAfter: after.utility,
      objectiveUtility,
      objectivePace,
      withdrawalEstimate,
      mechanicObservations: Object.freeze(mechanicObservations),
      deepAnalysis: Object.freeze({
        required: deepRequired,
        nodeCount: deepTimeline.length,
        timeline: Object.freeze(deepTimeline),
        responseBranches: Object.freeze(branches),
        expectedResponseUtility,
        expectedResponseDeltaUtility,
        mechanicProbability,
        controlOverlap,
      }),
      vector: {
        expectedStateGain,
        objectiveRelevantStateGain,
        objectiveStateGainWeight,
        terminalUtility,
        objectiveProgress,
        informationValue,
        resourcePreservation: -Object.entries(candidate.costs || {}).reduce((sum, [resource, value]) => {
          const text = String(value ?? '').trim();
          const amount = text.includes('%')
            ? preview.readResourceMax(actor, resource) * Math.max(0, Number.parseFloat(text) || 0) / 100
            : Math.max(0, Number(value || 0));
          return sum + amount;
        }, 0),
        survivalLowerBound: after.own,
        irreversibleCost,
        catastrophicRisk,
      },
       rejectionCode: intentReject || lifecycleReject || (selfDefeating ? 'SELF_DEFEATING' : zeroEffectCostly ? 'ZERO_EFFECT_COSTLY' : !hasProgress && !candidate.counterDeclineFallback ? 'ZERO_PROGRESS' : ''),
    };
  }

  function dominates(left, right) {
    const gains = ['expectedStateGain', 'terminalUtility', 'objectiveProgress', 'informationValue', 'resourcePreservation', 'survivalLowerBound'];
    const costs = ['irreversibleCost', 'catastrophicRisk'];
    const noWorse = gains.every(key => left.vector[key] >= right.vector[key] - 1e-9) && costs.every(key => left.vector[key] <= right.vector[key] + 1e-9);
    const better = gains.some(key => left.vector[key] > right.vector[key] + 1e-9) || costs.some(key => left.vector[key] < right.vector[key] - 1e-9);
    return noWorse && better;
  }

  function paretoFilter(candidates = []) {
    return candidates.map(candidate => {
      if (candidate.rejectionCode) return candidate;
      const dominator = candidates.find(other => other !== candidate && !other.rejectionCode && dominates(other, candidate));
      return dominator ? { ...candidate, rejectionCode: 'DOMINATED', dominatedBy: dominator.candidateId } : candidate;
    });
  }

  function normalizeUtilities(candidates = []) {
    const eligible = candidates.filter(candidate => !candidate.rejectionCode);
    const center = median(eligible.map(candidate => candidate.objectiveUtility));
    const mad = Math.max(1, median(eligible.map(candidate => Math.abs(candidate.objectiveUtility - center))));
    return candidates.map(candidate => ({ ...candidate, normalizedUtility: (candidate.objectiveUtility - center) / mad }));
  }

  function classifyCandidateEvidence(candidates = []) {
    const eligible = candidates.filter(candidate => !candidate.rejectionCode);
    const best = eligible.reduce((current, candidate) => !current || candidate.objectiveUtility > current.objectiveUtility ? candidate : current, null);
    const hardInvalidCodes = new Set(['ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'ZERO_PROGRESS', 'INTENT_TERMINAL_CONFLICT']);
    return candidates.map(candidate => {
      const alternativeGap = best ? Math.max(0, Number(best.objectiveUtility || 0) - Number(candidate.objectiveUtility || 0)) : 0;
      let classification = 'VIABLE';
      if (candidate.rejectionCode === 'DOMINATED') classification = 'DOMINATED';
      else if (hardInvalidCodes.has(candidate.rejectionCode)) classification = 'HARD_INVALID';
      else if (Number(candidate.vector?.catastrophicRisk || 0) > 0 || Number(candidate.vector?.irreversibleCost || 0) > 0 || Number(candidate.objectiveUtility || 0) < 0) classification = 'CONTEXT_RISK';
      else if (best && Number(best.normalizedUtility || 0) - Number(candidate.normalizedUtility || 0) > 0.35) classification = 'TACTICAL_ERROR';
      return { ...candidate, classification, alternativeGap };
    });
  }

  function selectCandidate(candidates, actor, seed, context = {}) {
    const preferredTargets = new Set([
      ...(Array.isArray(context.strategyMemory?.targetIds) ? context.strategyMemory.targetIds : []),
      context.teamIntent?.focusTarget,
      context.teamIntent?.protectTarget,
    ].map(String).filter(Boolean));
    const tiePreference = candidate => (candidate.declaration.targetIds || []).some(targetId => preferredTargets.has(String(targetId))) ? 1 : 0;
    const initiallyEligible = candidates.filter(candidate => !candidate.rejectionCode);
    const hasNonnegativeAlternative = initiallyEligible.some(candidate => candidate.objectiveUtility >= -1e-9);
    const eligible = initiallyEligible.filter(candidate =>
      !hasNonnegativeAlternative || candidate.objectiveUtility >= -1e-9 || Number(candidate.vector?.terminalUtility || 0) > 0,
    ).sort((left, right) => {
      const utilityGap = right.normalizedUtility - left.normalizedUtility;
      if (Math.abs(utilityGap) > 0.05) return utilityGap;
      return tiePreference(right) - tiePreference(left) || left.candidateId.localeCompare(right.candidateId);
    });
    if (!eligible.length) {
      const defend = candidates.find(candidate => candidate.declaration.actionKind === 'DEFEND');
      if (!defend) throw new Error('battle_decision_no_legal_fallback');
      return {
        selected: { ...defend, rejectionCode: '', classification: 'VIABLE', alternativeGap: 0, forcedFallback: true, fallbackReason: 'NO_ELIGIBLE_CANDIDATE' },
        confidence: 1,
        temperature: 0,
        maxNormalizedRegret: 0,
      };
    }
    const confidence = 0.5 * experienceOf(actor) + 0.3 * ratio(actor, 'men') + 0.2 * ratio(actor, 'vit');
    const temperature = 0.8 + (1 - confidence) * 1.8;
    const maxNormalizedRegret = 0.35 + (1 - confidence) * 0.9;
    if (eligible.length === 1 || eligible[0].normalizedUtility - eligible[1].normalizedUtility >= 2 * temperature) {
      return { selected: eligible[0], confidence, temperature, maxNormalizedRegret };
    }
    const regretPool = eligible.filter(candidate => eligible[0].normalizedUtility - candidate.normalizedUtility <= maxNormalizedRegret + 1e-9);
    const actionIdentity = candidate => [
      candidate?.declaration?.actionKind || '',
      skillId(candidate?.declaration?.skill || candidate?.skill || {}, 0),
    ].join('|');
    const representativeOf = candidate => {
      if (tiePreference(candidate)) return candidate;
      return regretPool.find(preferred =>
        tiePreference(preferred) &&
        actionIdentity(preferred) === actionIdentity(candidate) &&
        Math.abs(Number(preferred.normalizedUtility || 0) - Number(candidate.normalizedUtility || 0)) <= 0.05
      ) || candidate;
    };
    const weightedByRepresentative = new Map();
    regretPool.forEach(candidate => {
      const representative = representativeOf(candidate);
      const weight = Math.exp((candidate.normalizedUtility - eligible[0].normalizedUtility) / Math.max(0.01, temperature));
      const current = weightedByRepresentative.get(representative.candidateId);
      weightedByRepresentative.set(representative.candidateId, {
        candidate: representative,
        weight: Number(current?.weight || 0) + weight,
      });
    });
    const weighted = [...weightedByRepresentative.values()];
    let roll = stableRoll(`${seed}|${preview.unitId(actor)}|${regretPool.map(candidate => candidate.candidateId).join('|')}`) * weighted.reduce((sum, item) => sum + item.weight, 0);
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) return { selected: item.candidate, confidence, temperature, maxNormalizedRegret };
    }
    return { selected: weighted[0].candidate, confidence, temperature, maxNormalizedRegret };
  }

  function prepareKernelContext(input = {}) {
    const worldSnapshot = input?.worldSnapshot;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_decision_world_missing');
    const sourceActor = preview.findUnit(worldSnapshot, input?.actorId);
    if (!sourceActor || !preview.isAlive(sourceActor)) throw new Error('battle_decision_actor_unavailable');
    const beliefState = buildInitialBelief(worldSnapshot, preview.unitId(sourceActor), input?.beliefState || {});
    const decisionWorld = buildDecisionWorld(worldSnapshot, preview.unitId(sourceActor), beliefState);
    const actor = preview.findUnit(decisionWorld, preview.unitId(sourceActor));
    const actorSide = sideOf(decisionWorld, actor);
    const battleIntent = actorBattleIntent(decisionWorld, actorSide, input?.battleIntent);
    const strategicSignatureValue = strategicSignature(decisionWorld, beliefState);
    const stalemate = detectStalemate(input?.strategicHistory, strategicSignatureValue);
    const teamIntent = buildTeamIntent(decisionWorld, preview.unitId(actor), beliefState, battleIntent);
    const problems = identifyProblems(decisionWorld, preview.unitId(actor), beliefState, { battleIntent, stalemate });
    const beforeUtility = stateUtility(decisionWorld, actorSide, beliefState);
    const context = {
      ...input,
      worldSnapshot: decisionWorld,
      actorId: preview.unitId(actor),
      battleIntent,
      beliefState,
      teamIntent,
      problems,
      strategicSignature: strategicSignatureValue,
      stalemate,
      worldRevision: String(input?.worldRevision || `decision:${decisionRevisionSequence}`),
      beliefRevision: String(beliefState.revision || preview.stableHash(beliefState)),
      beforeUtility,
    };
    return {
      actor,
      actorSide,
      beliefState,
      decisionWorld,
      battleIntent,
      strategicSignature: strategicSignatureValue,
      stalemate,
      teamIntent,
      problems,
      beforeUtility,
      context,
      scoringContext: {
        ...context,
        sharedResponseBranches: Object.freeze(
          context.actionOpportunity?.role === 'COUNTER' ? [] : responseBranches(context),
        ),
      },
    };
  }

  function dominatesNext(left, right) {
    const gains = ['rawObjectiveUtility', 'informationValue', 'resourceContinuity', 'survivalLowerBound'];
    const costs = ['irreversibleAssetCost', 'worstTailCapacityLoss'];
    const noWorse = gains.every(key => Number(left?.vector?.[key] || 0) >= Number(right?.vector?.[key] || 0) - 1e-9) &&
      costs.every(key => Number(left?.vector?.[key] || 0) <= Number(right?.vector?.[key] || 0) + 1e-9);
    const better = gains.some(key => Number(left?.vector?.[key] || 0) > Number(right?.vector?.[key] || 0) + 1e-9) ||
      costs.some(key => Number(left?.vector?.[key] || 0) < Number(right?.vector?.[key] || 0) - 1e-9);
    return noWorse && better;
  }

  function paretoFilterNext(candidates = []) {
    return candidates.map(candidate => {
      if (candidate.rejectionCode) return candidate;
      const dominator = candidates.find(other => other !== candidate && !other.rejectionCode && dominatesNext(other, candidate));
      return dominator ? { ...candidate, rejectionCode: 'DOMINATED', dominatedBy: dominator.candidateId } : candidate;
    });
  }

  function classifyNextCandidates(candidates = []) {
    const eligible = candidates.filter(candidate => !candidate.rejectionCode);
    const best = eligible.reduce((current, candidate) => !current || candidate.objectiveUtility > current.objectiveUtility ? candidate : current, null);
    return candidates.map(candidate => {
      const alternativeGap = best ? Math.max(0, Number(best.objectiveUtility || 0) - Number(candidate.objectiveUtility || 0)) : 0;
      let classification = 'VIABLE';
      if (candidate.rejectionCode === 'DOMINATED') classification = 'DOMINATED';
      else if (candidate.rejectionCode) classification = 'HARD_INVALID';
      else if (Number(candidate.objectiveUtility || 0) < 0 || Number(candidate.vector?.worstTailCapacityLoss || 0) > 0) classification = 'CONTEXT_RISK';
      else if (best && Number(best.normalizedUtility || 0) - Number(candidate.normalizedUtility || 0) > 0.35) classification = 'TACTICAL_ERROR';
      return { ...candidate, classification, alternativeGap };
    });
  }

  function compareDecisionKernels(input = {}) {
    resetDecisionCaches();
    const prepared = prepareKernelContext(input);
    const frozenCandidates = enumerateCandidates(prepared.scoringContext);
    if (!frozenCandidates.length) throw new Error('battle_decision_candidate_pool_empty');
    const legacy = frozenCandidates.map(candidate => scoreCandidate(candidate, prepared.scoringContext));
    const next = scoreCandidatesNext({
      ...input,
      worldSnapshot: prepared.decisionWorld,
      actorId: preview.unitId(prepared.actor),
      __preparedDecisionWorld: true,
      __preparedBeliefState: prepared.beliefState,
      __frozenCandidates: frozenCandidates,
    });
    const legacyIds = legacy.map(candidate => candidate.candidateId);
    const nextIds = next.map(candidate => candidate.candidateId);
    const nextById = new Map(next.map(candidate => [candidate.candidateId, candidate]));
    const previewMismatches = legacy.map(candidate => {
      const nextCandidate = nextById.get(candidate.candidateId);
      if (!candidate?.preview && !nextCandidate?.preview) return '';
      const legacyHash = preview.stableHash({
        afterSnapshot: candidate?.preview?.afterSnapshot || null,
        contributions: candidate?.preview?.contributions || [],
        scheduledEvents: candidate?.preview?.scheduledEvents || [],
      });
      const nextHash = preview.stableHash({
        afterSnapshot: nextCandidate?.preview?.afterSnapshot || null,
        contributions: nextCandidate?.preview?.contributions || [],
        scheduledEvents: nextCandidate?.preview?.scheduledEvents || [],
      });
      return legacyHash === nextHash ? '' : candidate.candidateId;
    }).filter(Boolean);
    return Object.freeze({
      actorId: preview.unitId(prepared.actor),
      candidateIds: Object.freeze([...legacyIds]),
      candidateSetMatches: legacyIds.length === nextIds.length && legacyIds.every((candidateId, index) => candidateId === nextIds[index]),
      previewMismatches: Object.freeze(previewMismatches),
      legacy: Object.freeze(legacy),
      next: Object.freeze(next),
    });
  }

  function decideNext(input = {}) {
    const scored = scoreCandidatesNext(input);
    let normalized = classifyNextCandidates(normalizeUtilities(paretoFilterNext(scored)));
    if (!normalized.some(candidate => !candidate.rejectionCode)) {
      const role = String(input?.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase();
      const fallback = (input?.actionOpportunity?.forcedSkill ? normalized[0] : null) ||
        normalized.find(candidate => role === 'COUNTER' && candidate?.counterDeclineFallback === true) ||
        normalized.find(candidate =>
          Object.keys(candidate?.costs || {}).length === 0 &&
          (role === 'REACTION'
            ? ['DEFEND', 'EVADE'].includes(String(candidate?.declaration?.actionKind || '').trim())
            : String(candidate?.declaration?.actionKind || '').trim() === 'DEFEND')
        );
      if (fallback) {
        const forcedDeclaration = !!input?.actionOpportunity?.forcedSkill;
        normalized = normalized.map(candidate => candidate.candidateId === fallback.candidateId
          ? {
              ...candidate,
              rejectionCode: '',
              classification: 'VIABLE',
              alternativeGap: 0,
              forcedFallback: !forcedDeclaration,
              fallbackReason: forcedDeclaration ? '' : 'NO_ELIGIBLE_CANDIDATE',
            }
          : candidate);
      }
    }
    if (typeof input?.inspectCandidates === 'function') input.inspectCandidates(normalized);
    const sourceActor = preview.findUnit(input?.worldSnapshot, input?.actorId);
    const beliefState = buildInitialBelief(input?.worldSnapshot, preview.unitId(sourceActor), input?.beliefState || {});
    const decisionWorld = buildDecisionWorld(input?.worldSnapshot, preview.unitId(sourceActor), beliefState);
    const actor = preview.findUnit(decisionWorld, preview.unitId(sourceActor));
    const actorSide = sideOf(decisionWorld, actor);
    const battleIntent = actorBattleIntent(decisionWorld, actorSide, input?.battleIntent);
    const teamIntent = buildTeamIntent(decisionWorld, preview.unitId(actor), beliefState, battleIntent);
    const signature = strategicSignature(decisionWorld, beliefState);
    const stalemate = detectStalemate(input?.strategicHistory, signature);
    const problems = identifyProblems(decisionWorld, preview.unitId(actor), beliefState, { battleIntent, stalemate });
    const choice = selectCandidate(normalized, actor, input?.seed || 1, {
      ...input,
      worldSnapshot: decisionWorld,
      actorId: preview.unitId(actor),
      beliefState,
      teamIntent,
      battleIntent,
      strategyMemory: input?.strategyMemory || {},
    });
    const selected = { ...choice.selected, selected: true };
    const alternatives = normalized.filter(candidate => candidate.candidateId !== selected.candidateId)
      .sort((left, right) => right.objectiveUtility - left.objectiveUtility)
      .slice(0, 2);
    const selectedRecord = Object.freeze({
      candidateId: selected.candidateId,
      declaration: selected.declaration,
      utilityBefore: selected.utilityBefore,
      utilityAfter: selected.utilityAfter,
      objectiveUtility: selected.objectiveUtility,
      normalizedUtility: selected.normalizedUtility,
      vector: Object.freeze({ ...selected.vector }),
      rejectionCode: selected.rejectionCode || '',
      classification: selected.classification || 'VIABLE',
      alternativeGap: Number(selected.alternativeGap || 0),
      counterDeclineFallback: selected.counterDeclineFallback === true,
      forcedFallback: selected.forcedFallback === true,
      forcedAction: !!input?.actionOpportunity?.forcedSkill,
      fallbackReason: String(selected.fallbackReason || '').trim(),
      repeatedActionAudit: selected.repeatedActionAudit || null,
      nextValueAudit: selected.nextValueAudit || null,
      immediateReactionAudit: selected.immediateReactionAudit || Object.freeze([]),
      predictedOutcomeEvidence: selected.predictedOutcomeEvidence || Object.freeze([]),
      mechanicObservations: Object.freeze([...(selected.mechanicObservations || [])]),
    });
    return Object.freeze({
      version: `${VERSION}-next-1`,
      decisionEngine: 'NEXT',
      actorId: preview.unitId(actor),
      candidateCount: normalized.length,
      paretoCount: normalized.filter(candidate => !candidate.rejectionCode).length,
      selected: selectedRecord,
      beliefState: Object.freeze(beliefState),
      teamIntent: Object.freeze(teamIntent),
      problems: Object.freeze(problems),
      strategicSignature: signature,
      stalemate,
      stateCapacityTotal: Number(selected?.nextValueAudit?.before?.total || 0),
      beliefRevision: String(beliefState.revision || preview.stableHash(beliefState)),
      pendingStrategicEffect: worldEntries(decisionWorld).some(entry =>
        entry.unit?.蓄力技能 || stateEntries(entry.unit).some(state => Number(state?.duration ?? state?.持续回合 ?? 0) > 0)),
      strategyMemory: Object.freeze({
        problemId: problems[0]?.problemId || 'NEUTRAL_PROGRESS',
        targetIds: Object.freeze([...(selected.declaration.targetIds || [])]),
        expectedOutcomeKinds: Object.freeze((selected.preview?.contributions || []).map(entry => entry.outcomeKind)),
        expectedWindowIds: Object.freeze((selected.preview?.contributions || []).map(entry => entry.windowId).filter(Boolean)),
        expiresAtOpportunity: Math.max(1, Number(input?.actionOpportunity?.sequence || 0) + 1),
      }),
      scoreAudit: Object.freeze([selected, ...alternatives].map(candidate => Object.freeze({
        candidateId: candidate.candidateId,
        actionName: candidateActionName(candidate),
        actionKind: candidate.declaration.actionKind,
        actionRole: String(input?.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase() || 'ACTIVE',
        actorId: preview.unitId(actor),
        targetIds: Object.freeze([...(candidate.declaration.targetIds || [])]),
        utilityBefore: candidate.utilityBefore,
        utilityAfter: candidate.utilityAfter,
        objectiveUtility: candidate.objectiveUtility,
        normalizedUtility: candidate.normalizedUtility,
        vector: Object.freeze({ ...candidate.vector }),
        deepAnalysis: Object.freeze({ required: false, nodeCount: 1, timeline: Object.freeze([{ nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId }]) }),
        rejectionCode: candidate.rejectionCode || '',
        classification: candidate.classification || 'VIABLE',
        alternativeGap: Number(candidate.alternativeGap || 0),
        counterDeclineFallback: candidate.counterDeclineFallback === true,
        forcedFallback: candidate.forcedFallback === true,
        forcedAction: !!input?.actionOpportunity?.forcedSkill && candidate.candidateId === selected.candidateId,
        fallbackReason: String(candidate.fallbackReason || '').trim(),
        repeatedActionAudit: candidate.repeatedActionAudit || null,
        nextValueAudit: candidate.nextValueAudit || null,
        immediateReactionAudit: candidate.immediateReactionAudit || Object.freeze([]),
        predictedOutcomeEvidence: candidate.predictedOutcomeEvidence || Object.freeze([]),
        selected: candidate.candidateId === selected.candidateId,
      }))),
      decisionProfile: Object.freeze({
        confidence: choice.confidence,
        temperature: choice.temperature,
        maxNormalizedRegret: choice.maxNormalizedRegret,
      }),
    });
  }

  function decide(input = {}) {
    const worldSnapshot = input.worldSnapshot;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_decision_world_missing');
    resetDecisionCaches();
    const actor = preview.findUnit(worldSnapshot, input.actorId);
    if (!actor || !preview.isAlive(actor)) throw new Error('battle_decision_actor_unavailable');
    const beliefState = buildInitialBelief(worldSnapshot, preview.unitId(actor), input.beliefState || {});
    const decisionWorld = buildDecisionWorld(worldSnapshot, preview.unitId(actor), beliefState);
    const decisionActor = preview.findUnit(decisionWorld, preview.unitId(actor));
    const actorSide = sideOf(decisionWorld, decisionActor);
    const battleIntent = actorBattleIntent(decisionWorld, actorSide, input.battleIntent);
    const signature = strategicSignature(decisionWorld, beliefState);
    const stalemate = detectStalemate(input.strategicHistory, signature);
    const teamIntent = buildTeamIntent(decisionWorld, preview.unitId(actor), beliefState, battleIntent);
    const problems = identifyProblems(decisionWorld, preview.unitId(actor), beliefState, { battleIntent, stalemate });
    const beforeUtility = stateUtility(decisionWorld, actorSide, beliefState);
    const beliefRevision = String(beliefState.revision || preview.stableHash(beliefState));
    const pendingStrategicEffect = worldEntries(decisionWorld).some(entry => entry.unit?.蓄力技能 || stateEntries(entry.unit).some(state => Number(state?.duration ?? state?.持续回合 ?? 0) > 0));
    const context = {
      ...input,
      worldSnapshot: decisionWorld,
      actorId: preview.unitId(actor),
      battleIntent,
      beliefState,
      teamIntent,
      problems,
      strategicSignature: signature,
      stalemate,
      worldRevision: String(input.worldRevision || `decision:${decisionRevisionSequence}`),
      beliefRevision,
      beforeUtility,
    };
    const scoringContext = {
      ...context,
      sharedResponseBranches: Object.freeze(
        context.actionOpportunity?.role === 'COUNTER' ? [] : responseBranches(context),
      ),
    };
    const generated = enumerateCandidates(scoringContext);
    if (!generated.length) throw new Error('battle_decision_candidate_pool_empty');
    const scored = generated.map(candidate => scoreCandidate(candidate, scoringContext));
    const normalized = classifyCandidateEvidence(normalizeUtilities(paretoFilter(scored)));
    if (typeof input.inspectCandidates === 'function') input.inspectCandidates(normalized);
    const strategyMemory = activeStrategyMemory(input.strategyMemory, decisionWorld, input.actionOpportunity, normalized);
    const choice = selectCandidate(normalized, decisionActor, input.seed || 1, { ...context, strategyMemory });
    const selected = { ...choice.selected, selected: true };
    const alternatives = normalized.filter(candidate => candidate.candidateId !== selected.candidateId).sort((a, b) => b.objectiveUtility - a.objectiveUtility).slice(0, 2);
    const selectedRecord = Object.freeze({
      candidateId: selected.candidateId,
      declaration: selected.declaration,
      utilityBefore: selected.utilityBefore,
      utilityAfter: selected.utilityAfter,
      objectiveUtility: selected.objectiveUtility,
      normalizedUtility: selected.normalizedUtility,
      vector: Object.freeze({ ...selected.vector }),
      rejectionCode: selected.rejectionCode || '',
      classification: selected.classification || 'VIABLE',
      alternativeGap: Number(selected.alternativeGap || 0),
      counterDeclineFallback: selected.counterDeclineFallback === true,
      forcedFallback: selected.forcedFallback === true,
      fallbackReason: String(selected.fallbackReason || '').trim(),
      predictedOutcomeEvidence: selected.predictedOutcomeEvidence || Object.freeze([]),
      mechanicObservations: Object.freeze([...(selected.mechanicObservations || [])]),
    });
    return Object.freeze({
      version: VERSION,
      actorId: preview.unitId(actor),
      candidateCount: normalized.length,
      paretoCount: normalized.filter(candidate => !candidate.rejectionCode).length,
      selected: selectedRecord,
      beliefState: Object.freeze(beliefState),
      teamIntent: Object.freeze(teamIntent),
      problems: Object.freeze(problems),
      strategicSignature: signature,
      stalemate,
      stateCapacityTotal: beforeUtility.total,
      beliefRevision,
      pendingStrategicEffect,
      strategyMemory: Object.freeze({
        problemId: problems[0]?.problemId || 'NEUTRAL_PROGRESS',
        targetIds: Object.freeze([...(selected.declaration.targetIds || [])]),
        expectedOutcomeKinds: Object.freeze((selected.preview?.contributions || []).map(entry => entry.outcomeKind)),
        expectedWindowIds: Object.freeze((selected.preview?.contributions || []).map(entry => entry.windowId).filter(Boolean)),
        expiresAtOpportunity: Math.max(1, Number(input.actionOpportunity?.sequence || 0) + 1),
      }),
      scoreAudit: Object.freeze([selected, ...alternatives].map(candidate => Object.freeze({
        candidateId: candidate.candidateId,
        actionName: candidateActionName(candidate),
        actionKind: candidate.declaration.actionKind,
        actionRole: String(input.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase() || 'ACTIVE',
        actorId: preview.unitId(actor),
        targetIds: Object.freeze([...(candidate.declaration.targetIds || [])]),
        utilityBefore: candidate.utilityBefore,
        utilityAfter: candidate.utilityAfter,
        objectiveUtility: candidate.objectiveUtility,
        normalizedUtility: candidate.normalizedUtility,
        vector: Object.freeze({ ...candidate.vector }),
        deepAnalysis: candidate.deepAnalysis,
        rejectionCode: candidate.rejectionCode || '',
        classification: candidate.classification || 'VIABLE',
        alternativeGap: Number(candidate.alternativeGap || 0),
        counterDeclineFallback: candidate.counterDeclineFallback === true,
        forcedFallback: candidate.forcedFallback === true,
        fallbackReason: String(candidate.fallbackReason || '').trim(),
        predictedOutcomeEvidence: candidate.predictedOutcomeEvidence || Object.freeze([]),
        selected: candidate.candidateId === selected.candidateId,
      }))),
      decisionProfile: Object.freeze({ confidence: choice.confidence, temperature: choice.temperature, maxNormalizedRegret: choice.maxNormalizedRegret }),
    });
  }

  root.__LWCS_BATTLE_DECISION__ = Object.freeze({
    version: VERSION,
    actionKinds,
    collectSkills,
    collectAvailableRings,
    parseSkillCosts,
    costAffordable,
    enumerateCandidates,
    buildInitialBelief,
    buildDecisionWorld,
    mechanicKey,
    relevantStateFingerprint,
    betaPrior,
    mechanicPosterior,
    updateMechanicBelief,
    updatePublicObservation,
    updateTargetRealizationBelief,
    unknownResponseMass,
    buildTeamIntent,
    identifyProblems,
    activeStrategyMemory,
    collectInventory,
    creationProfile,
    strategicSignature,
    detectStalemate,
    stateUtility,
    buildNextValueContext,
    stateUtilityNext,
    scoreCandidatesNext,
    compareDecisionKernels,
    decideNext,
    readMetrics: () => Object.freeze({ ...decisionMetrics }),
    resetMetrics: resetDecisionMetrics,
    dominates,
    paretoFilter,
    normalizeUtilities,
    classifyCandidateEvidence,
    decide,
  });
})();

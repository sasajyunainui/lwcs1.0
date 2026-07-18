/* BattleDecision_Module.js - Battle decisions over immutable previews. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const preview = root.__LWCS_BATTLE_PREVIEW__;
  if (!preview || typeof preview.previewAction !== 'function') throw new Error('battle_decision_preview_runtime_missing');
  if (preview.version !== '7.3-R6.3-preview-2') throw new Error(`battle_decision_preview_version_mismatch:${preview.version || 'missing'}`);

  const VERSION = '7.3-R6.3-decision-2';
  const R8_REQUEST_SCHEMA = '8.3-decision-request-1';
  const R8_RESULT_SCHEMA = '8.3-decision-result-1';
  const MAX_SEQUENCE_PROFILE_CATALOGS = 2048;
  const MAX_SEQUENCE_PROFILES_PER_CATALOG = 256;
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
  let unitLevelCache = new WeakMap();
  let perceivedEnemyBaseCache = new WeakMap();
  let perceivedEnemyDamageCache = new WeakMap();
  let relevantStateFingerprintCache = new WeakMap();
  let worldEntriesCache = new WeakMap();
  let worldUnitLookupCache = new WeakMap();
  let aliveEntriesCache = new WeakMap();
  let livingEntriesCache = new WeakMap();
  let sideCache = new WeakMap();
  let nextValueContextCache = new WeakMap();
  let shieldThreatProfileCache = new WeakMap();
  let resourceThreatProfileCache = new WeakMap();
  let nextUtilityCache = new WeakMap();
  let nextTeamCapacityCache = new WeakMap();
  let decisionWorldRevisionCache = new WeakMap();
  let decisionBeliefRevisionCache = new WeakMap();
  let responseThreatSnapshotCache = new WeakMap();
  let objectiveEvaluationCache = new WeakMap();
  let unitCapacitySignatureCache = new WeakMap();
  let sequenceProfileSignatureCache = new WeakMap();
  let sequenceProfileSemanticCache = new Map();
  let sequenceCatalogMetaCache = new WeakMap();
  let sequenceCatalogFingerprintCache = new WeakMap();
  const resourceThreatProfileKeyCache = new WeakMap();
  const decisionMetrics = {
    stateUtilityNextCalls: 0,
    stateUtilityNextCacheHits: 0,
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
    sequenceProfileMisses: 0,
    resourceThreatDiagnostics: null,
  };
  let decisionWorldRevisionSequence = 0;
  let providerExecutionDepth = 0;

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

  function beliefRevisionFor(beliefState = {}) {
    const explicit = String(beliefState?.revision || '').trim();
    if (explicit) return explicit;
    if (!beliefState || typeof beliefState !== 'object') return `belief:${preview.stableHash(beliefState)}`;
    const cached = decisionBeliefRevisionCache.get(beliefState);
    if (cached) return cached;
    const revision = `belief:${preview.stableHash(beliefState)}`;
    decisionBeliefRevisionCache.set(beliefState, revision);
    return revision;
  }

  function resetDecisionMetrics() {
    Object.keys(decisionMetrics).forEach(key => { decisionMetrics[key] = 0; });
    sequenceProfileSignatureCache = new WeakMap();
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

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.values(value).forEach(child => deepFreeze(child, seen));
    return Object.freeze(value);
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
    if (unitLevelCache.has(unit)) return unitLevelCache.get(unit);
    const values = [unit?.level, unit?.等级, unit?.修为等级, unit?.属性?.等级, unit?.final?.level].map(Number).filter(Number.isFinite);
    const result = Math.max(1, values[0] || 1);
    unitLevelCache.set(unit, result);
    return result;
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
      : clamp(0.25 + unitLevel(unit) / 120 * 0.7, 0.2, 0.90);
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
      reactionGrantIds: { ...(source.reactionGrantIds || {}) },
      reactionResponseUses: cloneValue(source.reactionResponseUses || {}),
      unitReactionCount: { ...(source.unitReactionCount || {}) },
      withdrawalSuccess: source.withdrawalSuccess === true,
      withdrawalSuccessSides: Array.isArray(source.withdrawalSuccessSides)
        ? [...source.withdrawalSuccessSides]
        : [],
      activeDefenseStance: source.activeDefenseStance && typeof source.activeDefenseStance === 'object'
        ? cloneValue(source.activeDefenseStance)
        : null,
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

  function buildInitialBelief(worldSnapshot = {}, actorId = '', existing = {}) {
    const actor = findUnitInWorld(worldSnapshot, actorId);
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
      const publicUnitRole = preview.isSummonUnit(unit) ? 'SUMMON' : 'PRIMARY';
      return [id, {
        ...prior,
        id,
        side: entry.side,
        allied,
        alive: preview.isAlive(unit),
        hpRatio: preview.readHp(unit) / preview.readHpMax(unit),
        publicUnitRole,
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
      unit.publicUnitRole,
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
    const sourceActor = findUnitInWorld(worldSnapshot, actorId);
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
      const publicUnitRole = String(beliefUnit.publicUnitRole || '').trim().toUpperCase();
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
      if (publicUnitRole === 'SUMMON') projected.单位性质 = '召唤物';
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
    if (Array.isArray(worldSnapshot?.__battleEventLedger)) {
      Object.defineProperty(decisionWorld, '__battleEventLedger', {
        configurable: true,
        enumerable: false,
        writable: false,
        value: [...worldSnapshot.__battleEventLedger],
      });
    }
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

  function replaceWorldUnit(worldSnapshot = {}, unitId = '', replacement = null) {
    const wantedId = String(unitId || '').trim();
    if (!wantedId || !replacement) return worldSnapshot;
    const participants = worldSnapshot?.参战者 || {};
    const nextParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
      const replace = unit => preview.unitId(unit) === wantedId ? replacement : unit;
      if (Array.isArray(value)) return [side, value.map(replace)];
      if (value && typeof value === 'object') {
        return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, replace(unit)]))];
      }
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
          preview.unitId(unit) === wantedId ? replacement : unit,
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

  function mechanicAdaptationKey({
    actionKind = '',
    effectPrototype = '',
    targetId = '',
    damageClassName = '',
    stateName = '',
    relevantStateFingerprint: stateFingerprint = '',
  } = {}) {
    const purpose = effectPrototype === '命中判定'
      ? `HIT:${String(damageClassName || 'MELEE').trim().toUpperCase()}`
      : effectPrototype === '状态施加'
        ? `STATE:${String(stateName || 'CONTROL').trim()}`
        : String(effectPrototype || 'GENERAL').trim();
    return mechanicKey({
      sourceActionId: `FAMILY:${String(actionKind || 'UNKNOWN').trim().toUpperCase()}:${purpose}`,
      effectPrototype: '行为族兑现',
      targetId,
      relevantStateFingerprint: stateFingerprint,
    });
  }

  function mechanicPosteriorWithAdaptation({
    beliefState = {},
    mechanicKey: exactKey = '',
    adaptationKey = '',
    estimatedProbability = 0.65,
    experience = 0.5,
  } = {}) {
    const records = [...new Set([exactKey, adaptationKey].filter(Boolean))]
      .map(key => ({ key, record: beliefState?.mechanics?.[key] }))
      .filter(entry => Number(entry.record?.observations || 0) > 0);
    if (!records.length) return mechanicPosterior(
      beliefState,
      exactKey,
      estimatedProbability,
      experience,
    );
    const weighted = records.reduce((result, entry) => {
      const observations = Math.max(1, Number(entry.record.observations || 1));
      return {
        total: result.total + observations,
        value: result.value +
          mechanicPosterior(
            beliefState,
            entry.key,
            estimatedProbability,
            experience,
          ) * observations,
      };
    }, { total: 0, value: 0 });
    return clamp(weighted.value / Math.max(1, weighted.total), 0, 1);
  }

  function updateMechanicBelief(beliefState = {}, observation = {}) {
    const next = {
      ...(beliefState || {}),
      mechanics: {
        ...(beliefState?.mechanics && typeof beliefState.mechanics === 'object' ? beliefState.mechanics : {}),
      },
    };
    const explicitKey = String(observation?.mechanicKey || '').trim();
    const keys = [...new Set([
      explicitKey || mechanicKey({ ...observation, beliefState: next }),
      String(observation?.adaptationKey || '').trim(),
    ].filter(Boolean))];
    keys.forEach(key => {
      const prior = next.mechanics[key] ||
        betaPrior(observation.estimatedProbability, observation.experience);
      next.mechanics[key] = {
        alpha: Number(prior.alpha) + (observation.success === true ? 1 : 0),
        beta: Number(prior.beta) + (observation.success === true ? 0 : 1),
        observations: Math.max(0, Number(prior.observations || 0)) + 1,
      };
    });
    next.revision = nextBeliefRevision(
      beliefState,
      'MECHANIC',
      keys.map(key => [key, next.mechanics[key]]),
    );
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

  function hitMechanicKey({
    sourceActionId = '',
    targetId = '',
    effectIndex = 0,
    effect = {},
    beliefState = {},
  } = {}) {
    const className = damageClass(effect?.伤害类型);
    return mechanicKey({
      sourceActionId,
      effectPrototype: `命中判定:${Math.max(0, Number(effectIndex || 0))}:${className}`,
      targetId,
      beliefState,
    });
  }

  function hitMechanicFactor(
    beliefState = {},
    actor = {},
    target = {},
    effect = {},
    sourceActionId = '',
    effectIndex = 0,
    actionKind = 'RELEASE_SKILL',
  ) {
    const targetId = preview.unitId(target);
    const baseProbability = preview.estimateHitProbability(actor, target, effect);
    if (baseProbability <= 0 || baseProbability >= 1) return 1;
    const key = hitMechanicKey({
      sourceActionId,
      targetId,
      effectIndex,
      effect,
      beliefState,
    });
    const adaptationKey = mechanicAdaptationKey({
      actionKind,
      effectPrototype: '命中判定',
      targetId,
      damageClassName: damageClass(effect?.伤害类型),
      relevantStateFingerprint: relevantStateFingerprint(beliefState, targetId),
    });
    const observations = [...new Set([key, adaptationKey])]
      .reduce((sum, recordKey) =>
        sum + Math.max(0, Number(beliefState?.mechanics?.[recordKey]?.observations || 0))
      , 0);
    if (!observations) return 1;
    const posterior = mechanicPosteriorWithAdaptation({
      beliefState,
      mechanicKey: key,
      adaptationKey,
      estimatedProbability: baseProbability,
      experience: experienceOf(actor),
    });
    const firstEvidenceWeight = 0.6 + 0.3 * experienceOf(actor);
    const evidenceWeight = 1 - Math.pow(1 - firstEvidenceWeight, observations);
    const adaptedProbability = clamp(
      baseProbability + (posterior - baseProbability) * evidenceWeight,
      0.05,
      0.99,
    );
    return clamp(adaptedProbability / Math.max(0.05, baseProbability), 0.05, 1.5);
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
    const actor = findUnitInWorld(context.worldSnapshot || {}, context.actorId);
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
    const candidate = context?.candidate || {};
    const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
    const targetIds = (candidate?.declaration?.targetIds || [])
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const mechanicObservations = Array.isArray(context?.mechanicObservations)
      ? context.mechanicObservations
      : [];
    const observationStrengths = mechanicObservations.map(observation => {
      const probability = clamp(
        Number(observation?.posterior ?? observation?.estimatedProbability ?? 0.5),
        0,
        1,
      );
      if (probability <= 0.001 || probability >= 0.999) return 0;
      const keys = [
        String(observation?.mechanicKey || '').trim(),
        String(observation?.adaptationKey || '').trim(),
      ].filter(Boolean);
      const priorObservations = keys.reduce((maximum, key) =>
        Math.max(maximum, Number(context?.beliefState?.mechanics?.[key]?.observations || 0))
      , 0);
      return 1 / (1 + priorObservations);
    });
    const explicitReveal = actionKind === 'OBSERVE' &&
      context?.beliefState?.observationGranted === true;
    const hostileTargetProbe = targetIds.some(targetId => {
      const target = findUnitInWorld(context.worldSnapshot || {}, targetId);
      return target && sideOf(context.worldSnapshot || {}, target) !== actorSide;
    });
    const publicProbe = hostileTargetProbe &&
      ['BASIC_ATTACK', 'RELEASE_SKILL', 'COUNTER', 'WITHDRAW'].includes(actionKind);
    const structuralReveal = (Array.isArray(context?.predictedContributions)
      ? context.predictedContributions
      : []
    ).some(entry =>
      ['INFORMATION_REVEALED', 'BELIEF_CHANGED'].includes(
        String(entry?.outcomeKind || '').trim().toUpperCase(),
      )
    );
    const combinedObservationStrength = observationStrengths.length
      ? 1 - observationStrengths.reduce((remaining, value) =>
          remaining * (1 - clamp(value, 0, 1))
        , 1)
      : 0;
    const revealStrength = structuralReveal || explicitReveal
      ? 1
      : publicProbe
        ? Math.max(0.25, combinedObservationStrength)
        : combinedObservationStrength;
    if (!(revealStrength > 0)) return 0;
    return clamp(
      uncertainty *
        Math.max(0, worstRegretBefore - expectedRegretAfterReveal) *
        revealStrength,
      0,
      20,
    );
  }

  function catalogActionForCandidate(candidate = {}, catalog = []) {
    const declaration = candidate?.declaration || {};
    const actionKind = String(declaration?.actionKind || '').trim().toUpperCase();
    if (!actionKind) return null;
    if (actionKind === 'BASIC_ATTACK') {
      return catalog.find(action =>
        String(action?.actionKind || '').trim().toUpperCase() === 'BASIC_ATTACK'
      ) || null;
    }
    const candidateSkillId = skillId(declaration?.skill || {});
    return catalog.find(action =>
      String(action?.actionKind || '').trim().toUpperCase() === actionKind &&
      skillId(action?.skill || {}) === candidateSkillId
    ) || null;
  }

  function catalogPotentialForTargets(action = {}, targetIds = []) {
    const normalizedTargetIds = [...new Set((Array.isArray(targetIds) ? targetIds : [targetIds])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
    const targetValues = normalizedTargetIds
      .map(targetId => Number(action?.potentialByTarget?.[targetId]))
      .filter(Number.isFinite);
    if (!targetValues.length) return Math.max(0, Number(action?.potential || 0));
    return String(action?.targetMode || '').trim().toUpperCase() === 'GROUP'
      ? targetValues.reduce((sum, value) => sum + Math.max(0, value), 0)
      : Math.max(0, ...targetValues);
  }

  function candidateInformationValue(context = {}) {
    const beliefState = context?.beliefState || {};
    const confidence = clamp(Number(beliefState?.confidence ?? 1), 0, 1);
    if (confidence >= 0.999999) {
      return Object.freeze({
        value: 0,
        reason: 'BELIEF_ALREADY_PUBLIC',
        observations: Object.freeze([]),
      });
    }
    const actor = findUnitInWorld(context?.worldSnapshot || {}, context.actorId);
    if (!actor) {
      return Object.freeze({
        value: 0,
        reason: 'ACTOR_MISSING',
        observations: Object.freeze([]),
      });
    }
    const actorSide = sideOf(context.worldSnapshot, actor);
    const candidate = context?.candidate || {};
    const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
    const catalog = Array.isArray(context?.catalog) ? context.catalog : [];
    const selectedCatalogAction = catalogActionForCandidate(candidate, catalog);
    const structuralReveal = (Array.isArray(context?.predictedContributions)
      ? context.predictedContributions
      : []
    ).some(entry =>
      ['INFORMATION_REVEALED', 'BELIEF_CHANGED'].includes(
        String(entry?.outcomeKind || '').trim().toUpperCase(),
      )
    );
    const explicitReveal = actionKind === 'OBSERVE' &&
      beliefState?.observationGranted === true;
    if (!selectedCatalogAction && !structuralReveal && !explicitReveal) {
      return Object.freeze({
        value: 0,
        reason: 'NO_REALIZABLE_PROBE_ROUTE',
        observations: Object.freeze([]),
      });
    }
    const declaredTargetIds = [...new Set((candidate?.declaration?.targetIds || [])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
    const mechanicObservations = Array.isArray(context?.mechanicObservations)
      ? context.mechanicObservations
      : [];
    const observationInputs = mechanicObservations.length
      ? mechanicObservations
      : (structuralReveal || explicitReveal)
        ? declaredTargetIds.map(targetId => ({
            mechanicKey: `${candidate?.candidateId || actionKind}|PUBLIC_REVEAL|${targetId}`,
            adaptationKey: '',
            effectPrototype: '公开信息',
            targetId,
            estimatedProbability: 0.5,
            experience: experienceOf(actor),
          }))
        : [];
    const observations = [];
    const seenObservationKeys = new Set();
    observationInputs.forEach(observation => {
      const targetId = String(observation?.targetId || '').trim();
      const target = findUnitInWorld(context.worldSnapshot, targetId);
      if (!target || sideOf(context.worldSnapshot, target) === actorSide) return;
      const observationKey = [
        String(observation?.effectPrototype || '').trim(),
        targetId,
        String(observation?.adaptationKey || observation?.mechanicKey || '').trim(),
      ].join('|');
      if (seenObservationKeys.has(observationKey)) return;
      seenObservationKeys.add(observationKey);
      const estimatedProbability = clamp(
        Number(observation?.estimatedProbability ?? observation?.posterior ?? 0.5),
        0,
        1,
      );
      if (
        !structuralReveal &&
        !explicitReveal &&
        (estimatedProbability <= 0.001 || estimatedProbability >= 0.999)
      ) return;
      const exactRecord = beliefState?.mechanics?.[String(observation?.mechanicKey || '').trim()];
      const adaptationRecord = beliefState?.mechanics?.[String(observation?.adaptationKey || '').trim()];
      const observationCount = Math.max(
        0,
        Number(exactRecord?.observations || 0),
        Number(adaptationRecord?.observations || 0),
      );
      const alternatives = catalog.filter(action => {
        if (action === selectedCatalogAction) return false;
        const targets = action?.targetPoolIds || action?.targetIds || [];
        return targets.map(value => String(value || '').trim()).includes(targetId) &&
          Number(action?.potential || 0) > 0;
      });
      const sortedAlternatives = alternatives
        .map(action => ({
          actionKey: String(action?.actionKey || '').trim(),
          potential: catalogPotentialForTargets(action, [targetId]),
        }))
        .filter(entry => entry.potential > 0)
        .sort((left, right) =>
          right.potential - left.potential ||
          left.actionKey.localeCompare(right.actionKey)
        );
      const selectedPotential = selectedCatalogAction
        ? catalogPotentialForTargets(selectedCatalogAction, [targetId])
        : Number(sortedAlternatives[0]?.potential || 0);
      const bestAlternative = selectedCatalogAction
        ? sortedAlternatives[0] || null
        : sortedAlternatives[1] || null;
      if (!(selectedPotential > 0) || !bestAlternative) return;
      const epistemicUncertainty = (1 - confidence) / (1 + observationCount);
      const routeGap = Math.abs(selectedPotential - bestAlternative.potential);
      const rankingScale = Math.max(selectedPotential, bestAlternative.potential, 0.0001);
      const rankingSensitivity = 1 / (1 + routeGap / rankingScale);
      const regretBefore = selectedPotential * epistemicUncertainty * rankingSensitivity;
      if (!(regretBefore > 0)) return;
      const priorStrength = 2 + 6 * clamp(
        Number(observation?.experience ?? experienceOf(actor)),
        0,
        1,
      );
      const learningShare = 1 / Math.max(1, priorStrength + observationCount + 1);
      const revealWeight = structuralReveal || explicitReveal ? 1 : 0.75;
      const expectedRegretAfter = regretBefore * (1 - learningShare * revealWeight);
      const value = Math.max(0, regretBefore - expectedRegretAfter);
      if (!(value > 0)) return;
      const rawMechanicKey = String(
        observation?.adaptationKey || observation?.mechanicKey || '',
      ).trim();
      const mechanicParts = rawMechanicKey.split('|');
      const correlatedMechanicKey = mechanicParts.length >= 4
        ? [mechanicParts[0], mechanicParts[1], mechanicParts.slice(3).join('|')].join('|')
        : rawMechanicKey.replace(targetId, '{TARGET}');
      const groupKey = [
        String(observation?.effectPrototype || '').trim() || 'GENERAL',
        correlatedMechanicKey || 'PUBLIC_REVEAL',
        String(selectedCatalogAction?.actionKey || 'OBSERVE').trim(),
        bestAlternative.actionKey,
      ].join('|');
      observations.push(Object.freeze({
        observationKey,
        groupKey,
        targetId,
        selectedActionKey: String(selectedCatalogAction?.actionKey || 'OBSERVE').trim(),
        alternativeActionKey: bestAlternative.actionKey,
        selectedPotential,
        alternativePotential: bestAlternative.potential,
        observationCount,
        epistemicUncertainty,
        rankingSensitivity,
        regretBefore,
        expectedRegretAfter,
        value,
      }));
    });
    const grouped = new Map();
    observations.forEach(observation => {
      if (!grouped.has(observation.groupKey)) grouped.set(observation.groupKey, []);
      grouped.get(observation.groupKey).push(observation);
    });
    const groups = [...grouped.entries()].map(([groupKey, entries]) => {
      const ordered = [...entries].sort((left, right) =>
        Number(right.value || 0) - Number(left.value || 0) ||
        String(left.observationKey || '').localeCompare(String(right.observationKey || ''))
      );
      const value = Math.min(
        Math.max(...ordered.map(entry => Number(entry.value || 0)), 0),
        Math.max(
          0,
          Number(ordered[0]?.regretBefore || 0) -
            Number(ordered[0]?.expectedRegretAfter || 0),
        ),
      );
      const regretBefore = Math.max(...ordered.map(entry => Number(entry.regretBefore || 0)));
      const expectedRegretAfter = Math.max(
        ...ordered.map(entry => Number(entry.expectedRegretAfter || 0)),
      );
      const rankingChanged = ordered.some(entry => {
        const selectedPotential = Number(entry.selectedPotential || 0);
        const alternativePotential = Number(entry.alternativePotential || 0);
        const uncertaintySpan = selectedPotential * Number(entry.epistemicUncertainty || 0);
        return alternativePotential >= selectedPotential - uncertaintySpan - 1e-9 &&
          alternativePotential <= selectedPotential + uncertaintySpan + 1e-9;
      });
      const rankingScale = Math.max(
        0.0001,
        ...ordered.flatMap(entry => [
          Number(entry.selectedPotential || 0),
          Number(entry.alternativePotential || 0),
        ]),
      );
      const regretBoundary = rankingScale * 0.1;
      const regretBoundaryChanged =
        regretBefore >= regretBoundary &&
        expectedRegretAfter < regretBoundary;
      return Object.freeze({
        groupKey,
        observationKeys: Object.freeze(ordered.map(entry => entry.observationKey)),
        targetIds: Object.freeze([...new Set(ordered.map(entry => entry.targetId))]),
        value,
        regretBefore,
        expectedRegretAfter,
        rankingChanged,
        regretBoundaryChanged,
      });
    });
    const rankingChanged = groups.some(group => group.rankingChanged);
    const regretBoundaryChanged = groups.some(group => group.regretBoundaryChanged);
    const primaryReasonEligible = rankingChanged || regretBoundaryChanged;
    return Object.freeze({
      value: clamp(
        groups.reduce((sum, group) => sum + Number(group.value || 0), 0),
        0,
        20,
      ),
      reason: primaryReasonEligible
        ? 'DECISION_BOUNDARY_CHANGED'
        : observations.length
          ? 'REGRET_REDUCED_WITHOUT_CHOICE_BOUNDARY_CHANGE'
          : 'NO_DECISION_RANKING_CHANGE',
      observations: Object.freeze(observations),
      groups: Object.freeze(groups),
      rankingChanged,
      regretBoundaryChanged,
      primaryReasonEligible,
    });
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

  function candidateEffectTargetAudit(candidate = {}, worldSnapshot = {}, actor = {}) {
    const declaration = candidate?.declaration || {};
    const actionKind = String(declaration?.actionKind || '').trim().toUpperCase();
    const skill = declaration?.skill && typeof declaration.skill === 'object'
      ? declaration.skill
      : {};
    const explicitEffects = Array.isArray(skill?._效果数组)
      ? skill._效果数组.filter(effect => effect && typeof effect === 'object')
      : [];
    const equipmentModifiers = skill?.装备属性 && typeof skill.装备属性 === 'object'
      ? skill.装备属性
      : skill?.属性加成 && typeof skill.属性加成 === 'object'
        ? skill.属性加成
        : {};
    const effects = actionKind === 'BASIC_ATTACK'
      ? [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 攻击段数: 1 }]
      : actionKind === 'EQUIP' && !explicitEffects.length
        ? Object.entries(equipmentModifiers).map(([attribute, value]) => ({
            原型: '属性修正',
            目标: '自身',
            生效方式: '独立生效',
            属性: attribute,
            数值: value,
            持续回合: 99,
          }))
        : explicitEffects;
    return Object.freeze(effects.map((effect, effectIndex) => {
      const prototype = String(effect?.原型 || '').trim();
      const creationCarrier = !prototype && Array.isArray(effect?.使用效果);
      const targets = creationCarrier
        ? [actor]
        : preview.resolveTargets(worldSnapshot, actor, declaration, effect);
      const targetText = String(effect?.目标 || declaration?.targetKind || '').trim();
      const actionId = String(
        declaration?.actionId ||
        candidate?.candidateId ||
        `${preview.unitId(actor)}:preview`,
      ).trim();
      const createdSummonIds = effects
        .slice(0, effectIndex)
        .flatMap((priorEffect, priorIndex) => {
          if (String(priorEffect?.原型 || '').trim() !== '召唤生成') return [];
          const count = Math.max(1, Math.floor(Number(priorEffect?.数量 || 1)) || 1);
          const effectInstanceId = String(
            priorEffect?.effectId ||
            priorEffect?.效果ID ||
            `${actionId}:effect:${priorIndex}`,
          ).trim();
          return Array.from({ length: count }, (_, index) => [
            'preview-summon',
            preview.unitId(actor),
            actionId,
            effectInstanceId,
            index + 1,
          ].join(':'));
        });
      const includeCreatedSummons =
        createdSummonIds.length > 0 &&
        (
          /全场/.test(targetText) ||
          /群体|全体|范围/.test(targetText) && preview.effectTargetsAllies(effect)
        );
      const previewTargetIds = [
        ...new Set([
          ...targets.map(preview.unitId).map(String).filter(Boolean),
          ...(includeCreatedSummons ? createdSummonIds : []),
        ]),
      ];
      return Object.freeze({
        effectIndex,
        prototype,
        target: targetText,
        followsPrimary:
          effectIndex > 0 &&
          String(effect?.生效方式 || '').trim() === '跟随主原型',
        previewTargetIds: Object.freeze(previewTargetIds),
      });
    }));
  }

  function actionRouteKey(actionKind = '', actionName = '') {
    const kind = String(actionKind || '').trim().toUpperCase();
    const name = String(actionName || '').trim();
    if (kind === 'BASIC_ATTACK' || /普通攻击|基础攻击/.test(name)) return 'BASIC_ATTACK';
    if (kind && kind !== 'RELEASE_SKILL') return kind;
    return `RELEASE_SKILL:${name || 'UNKNOWN'}`;
  }

  function predictedOutcomeEvidence(result = null, visibleWorldSnapshot = null) {
    if (!result || !Array.isArray(result?.contributions)) return Object.freeze([]);
    const remainingHpByTarget = new Map();
    const remainingMissingHpByTarget = new Map();
    const visibleTargetFor = targetId => {
      if (!visibleWorldSnapshot || typeof visibleWorldSnapshot !== 'object') return null;
      return findUnitInWorld(visibleWorldSnapshot, targetId);
    };
    return Object.freeze(result.contributions.flatMap(entry => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const targetId = String(entry?.targetId || '').trim();
      const windowId = String(entry?.windowId || '').trim();
      const evidence = entry?.evidence && typeof entry.evidence === 'object' ? entry.evidence : {};
      const structuralOutcomeKinds = new Set([
        'ACTION_CANCELLED',
        'ACTION_GRANTED',
        'STATE_CHANGED',
        'RESOURCE_OPTION_CHANGED',
        'SUMMON_WINDOW',
        'BELIEF_CHANGED',
        'NEXT_ACTION_QUALITY_CHANGED',
        'RULE_CHANGED',
        'IRREVERSIBLE_ASSET_LOST',
      ]);
      let expectedDelta = Number.NaN;
      if (outcomeKind === 'HP_DELTA') {
        const canonicalDelta = Number(entry?.expectedDelta);
        const expectedDamage = Number(evidence?.expectedDamage);
        const rawDelta = Number.isFinite(canonicalDelta)
          ? canonicalDelta
          : Number.isFinite(expectedDamage) && expectedDamage > 0
            ? -expectedDamage
            : Number(evidence?.delta);
        const visibleTarget = visibleTargetFor(targetId);
        if (visibleTarget) {
          if (rawDelta < 0) {
            const remainingHp = remainingHpByTarget.has(targetId)
              ? remainingHpByTarget.get(targetId)
              : preview.readHp(visibleTarget);
            expectedDelta = -Math.min(Math.abs(rawDelta), Math.max(0, remainingHp));
            remainingHpByTarget.set(targetId, Math.max(0, remainingHp + expectedDelta));
          } else if (rawDelta > 0) {
            const remainingMissingHp = remainingMissingHpByTarget.has(targetId)
              ? remainingMissingHpByTarget.get(targetId)
              : Math.max(0, preview.readHpMax(visibleTarget) - preview.readHp(visibleTarget));
            expectedDelta = Math.min(rawDelta, remainingMissingHp);
            remainingMissingHpByTarget.set(targetId, Math.max(0, remainingMissingHp - expectedDelta));
          } else {
            expectedDelta = 0;
          }
        } else {
          expectedDelta = rawDelta;
        }
      } else if (outcomeKind === 'SHIELD_DELTA') {
        const canonicalDelta = Number(entry?.expectedDelta);
        const delta = Number(evidence?.delta);
        const current = Number(evidence?.current);
        const next = Number(evidence?.next);
        expectedDelta = Number.isFinite(canonicalDelta)
          ? canonicalDelta
          : Number.isFinite(delta)
            ? delta
          : Number.isFinite(current) && Number.isFinite(next)
            ? next - current
            : Number.NaN;
      }
      const numericOutcome = Number.isFinite(expectedDelta) && Math.abs(expectedDelta) > 0.0001;
      const structuralOutcome = structuralOutcomeKinds.has(outcomeKind) &&
        (outcomeKind !== 'RESOURCE_OPTION_CHANGED' || windowId !== 'ACTION_COST') &&
        (evidence?.marginal !== false || ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW'].includes(outcomeKind));
      if (!targetId || (!numericOutcome && !structuralOutcome)) return [];
      const publicEvidence = {};
      [
        'state',
        'stateName',
        'attribute',
        'check',
        'settlement',
        'prototype',
        'value',
        'element',
        'current',
        'next',
        'duration',
        'remainingWindows',
        'trigger',
        'count',
        'resource',
        'delta',
        'expectedDamage',
        'adjustment',
        'multiplier',
        'interference',
        'cost',
        'marginal',
        'combatEffect',
        'positionType',
        'positionObject',
        'distance',
        'projection',
        'modelApplied',
        'modelReason',
        'resourceLock',
        'lockedResource',
        'lockedRatio',
        'productId',
        'quantity',
        'useEffectCount',
      ].forEach(key => {
        if (evidence[key] !== undefined && evidence[key] !== null) publicEvidence[key] = evidence[key];
      });
      if (outcomeKind === 'HP_DELTA' && Number.isFinite(expectedDelta)) {
        if (expectedDelta < 0) publicEvidence.expectedDamage = Math.abs(expectedDelta);
        if (expectedDelta > 0) publicEvidence.delta = expectedDelta;
      }
      return [{
        outcomeKind,
        targetId,
        windowId,
        ...(Number.isFinite(expectedDelta) ? { expectedDelta } : {}),
        expectedValuePercent: outcomeKind === 'HP_DELTA' && visibleTargetFor(targetId)
          ? Math.abs(expectedDelta) / Math.max(1, preview.readHpMax(visibleTargetFor(targetId))) * 100
          : Math.max(0, Number(entry?.threatValue || 0)),
        hitProbability: clamp(Number(evidence?.hitProbability ?? 1), 0, 1),
        reactionDamageMultiplier: clamp(Number(evidence?.reactionDamageMultiplier ?? 1), 0, 1),
        damageType: String(evidence?.damageType || '').trim(),
        sourceEffectId: String(entry?.effectInstanceId || '').trim(),
        evidence: Object.freeze(publicEvidence),
        executionRole: /:summon-assist(?::|$)/i.test(String(entry?.effectInstanceId || '').trim())
          ? 'ASSIST'
          : 'PRIMARY',
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
            effectFingerprint = typeof preview.effectArrayHash === 'function'
              ? preview.effectArrayHash(value._效果数组)
              : preview.stableHash(value._效果数组);
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
    const consumers = livingEntries(worldSnapshot).filter(entry =>
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

  function actionFamilyOf(value = {}) {
    const declaration = value?.declaration && typeof value.declaration === 'object'
      ? value.declaration
      : value;
    const actionKind = String(declaration?.actionKind || '').trim().toUpperCase();
    if (actionKind !== 'RELEASE_SKILL') return actionKind || 'UNKNOWN';
    const prototypes = new Set(
      preview.collectEffects(declaration?.skill || value?.skill || {})
        .map(effect => String(effect?.原型 || '').trim())
        .filter(Boolean),
    );
    const families = [];
    if (prototypes.has('伤害结算') || prototypes.has('炸环')) families.push('DAMAGE');
    if (
      prototypes.has('状态施加') ||
      prototypes.has('状态移除') ||
      prototypes.has('资源锁定') ||
      prototypes.has('机制抹消')
    ) families.push('CONTROL');
    if (
      prototypes.has('护盾变化') ||
      prototypes.has('规则防御') ||
      prototypes.has('状态转移') ||
      prototypes.has('状态交换')
    ) families.push('PROTECTION');
    if (prototypes.has('资源变化') || prototypes.has('资源转移')) families.push('RESOURCE');
    if (prototypes.has('召唤生成') || prototypes.has('机制授予')) families.push('SUMMON');
    if (
      prototypes.has('属性修正') ||
      prototypes.has('判定修正') ||
      prototypes.has('结算修正') ||
      prototypes.has('规则改写')
    ) families.push('AMPLIFY');
    return `RELEASE_SKILL:${families.length ? [...new Set(families)].sort().join('+') : 'UTILITY'}`;
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

  function detectStrategyDegeneration(history = []) {
    const rows = Array.isArray(history) ? history.slice(-8) : [];
    if (rows.length < 4) return null;
    const routeKey = row => {
      const actionFamily = String(row?.actionFamily || '').trim();
      const targetKey = JSON.stringify(
        [...new Set((row?.targetIds || []).map(String))].sort(),
      );
      return actionFamily ? `${actionFamily}|${targetKey}` : '';
    };
    const stalledRows = rows.filter(row =>
      Number(row?.capacityChangePercent ?? 100) < 1 &&
      row?.pendingEffect !== true
    );
    if (stalledRows.length < 4) return null;
    const counts = new Map();
    stalledRows.forEach(row => {
      const key = routeKey(row);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const dominant = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || null;
    const recentKeys = stalledRows.slice(-4).map(routeKey);
    const repeatingCycle = recentKeys.length === 4 &&
      recentKeys[0] &&
      recentKeys[0] === recentKeys[2] &&
      recentKeys[1] &&
      recentKeys[1] === recentKeys[3];
    const dominantPattern = dominant &&
      dominant[1] >= Math.max(3, Math.ceil(stalledRows.length * 0.6));
    if (!dominantPattern && !repeatingCycle) return null;
    const ignoredEvidence = stalledRows.some(row =>
      row?.newInformation === true ||
      row?.failureAdaptationApplied === true ||
      Number(row?.resourceRunwayAfter ?? 2) <= 1
    );
    if (!ignoredEvidence) return null;
    const routeKeys = repeatingCycle
      ? [...new Set(recentKeys)]
      : [dominant[0]];
    const [actionFamily, targetKey = '[]'] = String(routeKeys[0] || '').split('|');
    return Object.freeze({
      actionFamily,
      targetIds: Object.freeze(JSON.parse(targetKey || '[]')),
      routeKeys: Object.freeze(routeKeys),
      patternType: repeatingCycle ? 'REPEATING_CYCLE' : 'DOMINANT_ROUTE',
      evidenceIgnored: true,
      historyLength: stalledRows.length,
    });
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

  function snapshotWithUnitResourcesFrom(targetSnapshot = {}, sourceSnapshot = {}, actorId = '') {
    const sourceUnit = findUnitInWorld(sourceSnapshot, actorId);
    if (!sourceUnit) return targetSnapshot;
    const restored = mapWorldUnits(targetSnapshot, unit => {
      if (preview.unitId(unit) !== actorId) return unit;
      const next = {
        ...unit,
        属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : {},
        final: unit?.final && typeof unit.final === 'object' ? { ...unit.final } : unit?.final,
      };
      const soul = preview.readResource(sourceUnit, '魂力');
      const spirit = preview.readResource(sourceUnit, '精神力');
      const stamina = preview.readResource(sourceUnit, '体力');
      next.sp = soul;
      next.men = spirit;
      next.vit = stamina;
      next.sta = stamina;
      next.属性.魂力 = soul;
      next.属性.精神力 = spirit;
      next.属性.体力 = stamina;
      preview.refreshStaminaAdjustedFinal(next);
      return next;
    });
    return markCapacityDeltaSnapshot(restored, targetSnapshot, [actorId]);
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
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    const triggerText = [
      skill?.技能分类,
      skill?.触发方式,
      skill?.触发条件,
      skill?.反应类型,
      skill?.描述,
      skill?.效果描述,
    ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
    const explicitReactionAuthorization =
      skill?.即时反应 === true ||
      /即时反应|受击触发|被攻击时|遭受攻击时|命中前|结算前触发/.test(triggerText) ||
      effects.some(effect => {
        if (effect?.即时反应 === true) return true;
        const effectTriggerText = [
          effect?.触发方式,
          effect?.触发条件,
          effect?.反应类型,
        ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
        return /即时反应|受击触发|被攻击时|遭受攻击时|命中前|结算前触发/.test(effectTriggerText);
      });
    const isImmediateDefensiveEffect = effect => {
      const prototype = String(effect?.原型 || '').trim();
      const target = String(effect?.目标 || '').trim();
      const value = Number.parseFloat(String(effect?.数值 || '0'));
      if (!/自身|己方|友方/.test(target)) return false;
      if (prototype === '规则防御') return true;
      if (prototype === '护盾变化') return String(effect?.护盾模式 || '正向护盾').trim() === '正向护盾';
      if (
        prototype === '判定修正' &&
        /闪避|格挡|反应/.test(String(effect?.判定 || '').trim()) &&
        value > 0
      ) return true;
      const combatEffect = preview.deriveStateCombatEffect(effect);
      return combatEffect?.invincible === true ||
        combatEffect?.super_armor === true ||
        Number(combatEffect?.dodge_bonus || 0) > 0 ||
        Number(combatEffect?.reaction_bonus || 0) > 0 ||
        Number(combatEffect?.damage_reduction || 0) > 0 ||
        (
          Number.isFinite(Number(combatEffect?.received_damage_mult)) &&
          Number(combatEffect.received_damage_mult) < 1
        ) ||
        (
          Number.isFinite(Number(combatEffect?.damage_taken_mult)) &&
          Number(combatEffect.damage_taken_mult) < 1
        );
    };
    if (explicitReactionAuthorization) return effects.length > 0;
    return effects.length > 0 && effects.every(isImmediateDefensiveEffect);
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

  function findUnitInWorld(worldSnapshot = {}, id = '') {
    const wanted = String(id || '').trim();
    if (!wanted) return null;
    let lookup = worldUnitLookupCache.get(worldSnapshot);
    if (!lookup) {
      lookup = new Map();
      worldEntries(worldSnapshot).forEach(entry => {
        const idKey = preview.unitId(entry.unit);
        const nameKey = preview.unitName(entry.unit);
        if (idKey && !lookup.has(idKey)) lookup.set(idKey, entry.unit);
        if (nameKey && !lookup.has(nameKey)) lookup.set(nameKey, entry.unit);
      });
      worldUnitLookupCache.set(worldSnapshot, lookup);
    }
    return lookup.get(wanted) || null;
  }

  function aliveEntries(worldSnapshot = {}) {
    let entries = aliveEntriesCache.get(worldSnapshot);
    if (!entries) {
      entries = Object.freeze(worldEntries(worldSnapshot).filter(entry => preview.isAlive(entry.unit)));
      aliveEntriesCache.set(worldSnapshot, entries);
    }
    return entries;
  }

  function primaryCombatantEntries(worldSnapshot = {}) {
    return aliveEntries(worldSnapshot).filter(entry => !preview.isSummonUnit(entry.unit));
  }

  function livingEntries(worldSnapshot = {}) {
    let entries = livingEntriesCache.get(worldSnapshot);
    if (!entries) {
      entries = Object.freeze(worldEntries(worldSnapshot).filter(entry => preview.isPhysicallyAlive(entry.unit)));
      livingEntriesCache.set(worldSnapshot, entries);
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
    const entries = profile === 'FRIENDLY_SINGLE' || profile === 'FRIENDLY_GROUP'
      ? livingEntries(worldSnapshot)
      : aliveEntries(worldSnapshot);
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

  function battleHorizonProfile(input = {}, worldSnapshot = {}) {
    const explicit = input?.actionOpportunity?.battleHorizon || {};
    const currentRound = Math.max(
      0,
      Number(explicit.currentRound ?? worldSnapshot?.回合 ?? 0),
    );
    const objectiveStartRound = Math.max(
      0,
      Number(worldSnapshot?.胜负条件?.startRound ?? worldSnapshot?.胜负条件?.起始回合 ?? 0),
    );
    const objectiveRoundCount = Math.max(
      0,
      Number(worldSnapshot?.胜负条件?.maxRounds ?? worldSnapshot?.胜负条件?.回合上限 ?? 0),
    );
    const derivedFinalRound = objectiveRoundCount > 0
      ? objectiveStartRound + objectiveRoundCount
      : 0;
    const finalRound = Math.max(
      0,
      Number(explicit.finalRound ?? explicit.roundLimit ?? derivedFinalRound),
    );
    const remainingRounds = finalRound > 0
      ? Math.max(0, finalRound - currentRound)
      : Number.POSITIVE_INFINITY;
    const naturalActionBudget = Math.max(
      1,
      Number(explicit.naturalActionBudget ?? input?.actionOpportunity?.naturalActionBudget ?? 40),
    );
    return Object.freeze({
      currentRound,
      finalRound,
      remainingRounds,
      naturalActionBudget,
      remainingNaturalActionBudget: Number.isFinite(remainingRounds)
        ? (remainingRounds + 1) * naturalActionBudget
        : Number.POSITIVE_INFINITY,
    });
  }

  function actionCompletesWithinBattleHorizon(skill = {}, input = {}, worldSnapshot = {}) {
    const castTime = Math.max(0, Number(skill?.前摇 ?? skill?.cast_time ?? 0));
    if (!(castTime > 0)) return true;
    return castTime <= battleHorizonProfile(input, worldSnapshot).remainingNaturalActionBudget;
  }

  function enumerateCandidates(input = {}) {
    if (providerExecutionDepth > 0) throw new Error('PROVIDER_REENUMERATED_CANDIDATES');
    const worldSnapshot = input.worldSnapshot || {};
    const actor = findUnitInWorld(worldSnapshot, input.actorId);
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
    const playerLockedSkillId = String(input?.playerLockedDeclaration?.actionKind || '').trim() === 'RELEASE_SKILL'
      ? skillId(input.playerLockedDeclaration?.skill || {})
      : '';
    const immediateBudget = Math.max(0, Number(input.actionOpportunity?.immediateBudget ?? 10));
    const basicAttackAllowed = !hasStateFlag(actor, 'disarm');
    const skillReleaseAllowed = !hasStateFlag(actor, 'silence');
    const hostile = aliveEntries(worldSnapshot).filter(entry => entry.side !== sideOf(worldSnapshot, actor)).map(entry => entry.unit);
    const counterSourceId = String(input.actionOpportunity?.sourceActorId || '').trim();
    const directHostile = counterOnly && counterSourceId
      ? hostile.filter(target => preview.unitId(target) === counterSourceId)
      : hostile;
    const candidates = reactionOnly || forcedSkill || !basicAttackAllowed ? [] : directHostile.map(target => {
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
    (forcedSkill ? [forcedSkill] : skillReleaseAllowed ? collectSkills(actor) : []).forEach((skill, index) => {
      const costs = parseSkillCosts(skill);
      if (!costAffordable(actor, skill)) return;
      const isPlayerLockedSkill = playerLockedSkillId && skillId(skill, index) === playerLockedSkillId;
      if (!forcedSkill && !isPlayerLockedSkill && !actionCompletesWithinBattleHorizon(skill, input, worldSnapshot)) return;
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
        const currentTarget = findUnitInWorld(worldSnapshot, targetIds[0]);
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

  function resourceKeyFor(value = '') {
    const text = String(value || '').trim();
    if (/体力|vit|sta|stamina/i.test(text)) return 'vit';
    if (/精神|men|spirit/i.test(text)) return 'men';
    if (/魂力|sp|soul/i.test(text)) return 'sp';
    return '';
  }

  function resourceLabelForKey(resourceKey = '') {
    return {
      vit: '体力',
      men: '精神力',
      sp: '魂力',
    }[String(resourceKey || '').trim()] || '';
  }

  function resolveWorldUnitReference(worldSnapshot = {}, rawIdentity = '') {
    const reference = String(rawIdentity || '').trim();
    const unit = reference ? findUnitInWorld(worldSnapshot, reference) : null;
    const sideText = value => {
      const text = String(value || '').trim().toLowerCase();
      if (/^(player|玩家|我方|己方)$/.test(text)) return 'player';
      if (/^(enemy|敌方|对方|敌对)$/.test(text)) return 'enemy';
      return '';
    };
    return {
      unit,
      id: unit ? preview.unitId(unit) : reference,
      side: unit ? sideOf(worldSnapshot, unit) : '',
      fallbackSide: sideText(reference),
    };
  }

  function resourceThreatProfileFor(worldSnapshot = {}) {
    if (!worldSnapshot || typeof worldSnapshot !== 'object') return Object.freeze({});
    if (resourceThreatProfileCache.has(worldSnapshot)) return resourceThreatProfileCache.get(worldSnapshot);
    const currentRound = Math.max(0, Number(worldSnapshot?.回合 || 0));
    const recentEvents = Array.isArray(worldSnapshot?.__battleEventLedger)
      ? worldSnapshot.__battleEventLedger.filter(event => {
          if (String(event?.eventKind || '').trim() !== 'resource_change') return false;
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          return currentRound <= 0 || round >= Math.max(0, currentRound - 2);
        })
      : [];
    const diagnostics = {
      ledgerEventCount: Array.isArray(worldSnapshot?.__battleEventLedger)
        ? worldSnapshot.__battleEventLedger.length
        : 0,
      recentEventCount: recentEvents.length,
      resourceChangeCount: 0,
      negativeResourceCount: 0,
      recognizedResourceCount: 0,
      resolvedTargetCount: 0,
      resolvedSourceCount: 0,
      crossSideCount: 0,
      groupedThreatCount: 0,
    };
    const grouped = new Map();
    recentEvents.forEach((event, eventIndex) => {
      diagnostics.resourceChangeCount += 1;
      const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
      const resourceKey = resourceKeyFor(meta?.resourceKey || event?.resourceKey || meta?.resource || event?.resource);
      const delta = Number(meta?.delta ?? event?.delta ?? 0);
      if (!resourceKey || !(delta < -0.0001)) return;
      diagnostics.negativeResourceCount += 1;
      diagnostics.recognizedResourceCount += 1;
      const targetRef = resolveWorldUnitReference(
        worldSnapshot,
        event?.targetId || event?.targetName,
      );
      const actorRef = resolveWorldUnitReference(
        worldSnapshot,
        event?.actorId || event?.actorName,
      );
      const targetId = targetRef.id;
      const actorId = actorRef.id;
      if (!targetId || !actorId || targetId === actorId) return;
      const target = targetRef.unit;
      const source = actorRef.unit;
      if (target) diagnostics.resolvedTargetCount += 1;
      if (source) diagnostics.resolvedSourceCount += 1;
      const targetSide = targetRef.side ||
        String(event?.targetSide || meta?.targetSide || '').trim().toLowerCase() ||
        targetRef.fallbackSide;
      const actorSide = actorRef.side ||
        String(event?.actorSide || meta?.actorSide || '').trim().toLowerCase() ||
        actorRef.fallbackSide;
      if (!targetSide || !actorSide || targetSide === actorSide) return;
      diagnostics.crossSideCount += 1;
      const key = `${targetId}|${resourceKey}`;
      const existing = grouped.get(key) || {
        targetId,
        resourceKey,
        losses: [],
        sourceIds: new Set(),
        eventIds: [],
      };
      existing.losses.push({
          amount: Math.abs(delta),
          round: Math.max(0, Number(event?.round || event?.sourceRound || 0)),
          actionId: String(event?.sourceActionId || event?.actionId || '').trim(),
          eventIndex,
      });
      existing.sourceIds.add(actorId);
      existing.eventIds.push(String(event?.eventId || '').trim());
      grouped.set(key, existing);
    });
    diagnostics.groupedThreatCount = grouped.size;
    const result = {};
    grouped.forEach(entry => {
      const target = findUnitInWorld(worldSnapshot, entry.targetId);
      if (!target) return;
      const label = resourceLabelForKey(entry.resourceKey);
      const current = preview.readResource(target, label);
      const maximum = preview.readResourceMax(target, label);
      const losses = [...entry.losses].sort((left, right) =>
        left.round - right.round ||
        left.eventIndex - right.eventIndex
      );
      const recentActionIds = new Set(
        losses
          .slice(-4)
          .map(item => item.actionId)
          .filter(Boolean),
      );
      const persistent = losses.length >= 2 || recentActionIds.size >= 2;
      const latestLoss = Number(losses.at(-1)?.amount || 0);
      const maximumLoss = Math.max(0, ...losses.map(item => Number(item.amount || 0)));
      const nextLoss = Math.min(
        current,
        Math.max(
          latestLoss,
          persistent ? maximumLoss : maximumLoss * 0.5,
        ),
      );
      if (!(nextLoss > 0)) return;
      const projected = Math.max(0, current - nextLoss);
      const activeSourceIds = [...entry.sourceIds].filter(sourceId => {
        const source = findUnitInWorld(worldSnapshot, sourceId);
        return source && preview.isBattleCapable(source) && !hasActionCancellation(source);
      });
      result[entry.targetId] = result[entry.targetId] || {};
      result[entry.targetId][entry.resourceKey] = Object.freeze({
        targetId: entry.targetId,
        resourceKey: entry.resourceKey,
        current,
        maximum,
        latestLoss,
        maximumLoss,
        nextLoss,
        projected,
        pressureRatio: clamp(nextLoss / Math.max(1, current), 0, 1),
        persistent,
        sourceIds: Object.freeze([...entry.sourceIds]),
        activeSourceIds: Object.freeze(activeSourceIds),
        eventIds: Object.freeze(entry.eventIds.filter(Boolean)),
      });
    });
    aliveEntries(worldSnapshot)
      .filter(entry => String(entry?.unit?.单位性质 || '').trim() !== '召唤物')
      .forEach(entry => {
        const target = entry.unit;
        const targetId = preview.unitId(target);
        const side = sideOf(worldSnapshot, target);
        if (!targetId || !side) return;
        const catalog = frozenActionCatalog(worldSnapshot, target, side, {});
        ['vit', 'sp', 'men'].forEach(resourceKey => {
          const resourceName = resourceLabelForKey(resourceKey);
          const costedActions = catalog.filter(action => {
            const cost = action?.costs?.[resourceKey] ?? action?.costs?.[resourceName];
            return Number.parseFloat(String(cost ?? 0)) > 0;
          });
          if (!costedActions.length) return;
          const affordableActions = costedActions.filter(action =>
            actionLegalFromFrozen(worldSnapshot, target, action)
          );
          const current = preview.readResource(target, resourceName);
          const maximum = preview.readResourceMax(target, resourceName);
          const lowReserve = current / Math.max(1, maximum) <= 0.15 &&
            affordableActions.length <= Math.max(1, Math.floor(costedActions.length * 0.25));
          const absoluteShortage = affordableActions.length === 0;
          if (!lowReserve && !absoluteShortage) return;
          const existing = result[targetId]?.[resourceKey] || {};
          result[targetId] = result[targetId] || {};
          result[targetId][resourceKey] = Object.freeze({
            ...existing,
            targetId,
            resourceKey,
            current,
            maximum,
            latestLoss: Number(existing.latestLoss || 0),
            maximumLoss: Number(existing.maximumLoss || 0),
            nextLoss: Math.max(Number(existing.nextLoss || 0), 0),
            projected: Math.max(Number(existing.projected ?? current), 0),
            pressureRatio: Math.max(
              Number(existing.pressureRatio || 0),
              clamp(1 - current / Math.max(1, maximum), 0, 1),
            ),
            persistent: existing.persistent === true,
            sourceIds: Object.freeze([...(existing.sourceIds || [])]),
            activeSourceIds: Object.freeze([...(existing.activeSourceIds || [])]),
            eventIds: Object.freeze([...(existing.eventIds || [])]),
            absoluteShortage,
            lowReserve,
            costedActionCount: costedActions.length,
            affordableActionCount: affordableActions.length,
          });
        });
      });
    const frozen = Object.freeze(Object.fromEntries(Object.entries(result).map(([targetId, resources]) => [
      targetId,
      Object.freeze({ ...resources }),
    ])));
    decisionMetrics.resourceThreatDiagnostics = Object.freeze(diagnostics);
    resourceThreatProfileCache.set(worldSnapshot, frozen);
    return frozen;
  }

  function isPositiveResourceSupportEffect(effect = {}) {
    const prototype = String(effect?.原型 || '').trim();
    if (!['资源变化', '资源转移'].includes(prototype)) return false;
    if (/生命|HP/i.test(String(effect?.资源 || effect?.目标资源 || '').trim())) return false;
    const value = preview.parseSignedValue(
      effect?.数值 ??
      effect?.转移数值 ??
      effect?.数量 ??
      effect?.值 ??
      0,
      0,
    );
    return value > 0;
  }

  function snapshotAfterResourceThreat(worldSnapshot = {}, resourceThreatProfile = {}) {
    const threatenedIds = new Set(
      Object.entries(resourceThreatProfile || {})
        .filter(([, resources]) => Object.values(resources || {}).some(profile =>
          Array.isArray(profile?.activeSourceIds) && profile.activeSourceIds.length && Number(profile?.nextLoss || 0) > 0
        ))
        .map(([targetId]) => String(targetId || '').trim())
        .filter(Boolean),
    );
    if (!threatenedIds.size) return worldSnapshot;
    return mapWorldUnits(worldSnapshot, unit => {
      const targetId = preview.unitId(unit);
      if (!threatenedIds.has(targetId)) return unit;
      const profiles = resourceThreatProfile[targetId] || {};
      const costs = {};
      Object.values(profiles).forEach(profile => {
        if (!profile || !(Number(profile?.nextLoss || 0) > 0)) return;
        const sourceIds = Array.isArray(profile?.sourceIds) && profile.sourceIds.length
          ? profile.sourceIds
          : profile.activeSourceIds;
        const activeSourceIds = (Array.isArray(sourceIds) ? sourceIds : []).filter(sourceId => {
          const source = findUnitInWorld(worldSnapshot, sourceId);
          return source && preview.isBattleCapable(source) && !hasActionCancellation(source);
        });
        if (!activeSourceIds.length) return;
        const label = resourceLabelForKey(profile.resourceKey);
        if (label) costs[label] = Number(profile.nextLoss || 0);
      });
      return Object.keys(costs).length ? unitAfterResourceCosts(unit, costs) : unit;
    });
  }

  function resourceThreatProfileKey(resourceThreatProfile = {}) {
    if (!resourceThreatProfile || typeof resourceThreatProfile !== 'object') return '';
    const entries = Object.entries(resourceThreatProfile);
    if (!entries.length) return '';
    if (Object.isFrozen(resourceThreatProfile)) {
      const cached = resourceThreatProfileKeyCache.get(resourceThreatProfile);
      if (cached) return cached;
      const result = preview.stableHash(
        Object.fromEntries(
          entries
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([targetId, resources]) => [
              targetId,
              Object.fromEntries(
                Object.entries(resources || {})
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([resourceKey, profile]) => [
                    resourceKey,
                    {
                      nextLoss: Number(profile?.nextLoss || 0),
                      sourceIds: [...new Set((profile?.sourceIds || profile?.activeSourceIds || []).map(String))].sort(),
                    },
                  ]),
              ),
            ]),
        ),
      );
      resourceThreatProfileKeyCache.set(resourceThreatProfile, result);
      return result;
    }
    return preview.stableHash(
      Object.fromEntries(
        entries
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([targetId, resources]) => [
            targetId,
            Object.fromEntries(
              Object.entries(resources || {})
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([resourceKey, profile]) => [
                  resourceKey,
                  {
                    nextLoss: Number(profile?.nextLoss || 0),
                    sourceIds: [...new Set((profile?.sourceIds || profile?.activeSourceIds || []).map(String))].sort(),
                  },
                ]),
            ),
          ]),
      ),
    );
  }

  function resourceThreatResolutionAudit({
    worldSnapshot = {},
    afterSnapshot = {},
    candidate = {},
    result = null,
    actorSide = '',
    beliefState = {},
    valueContext = {},
    beforeUtility = {},
  } = {}) {
    const resourceThreatProfile = valueContext?.resourceThreatProfile || {};
    const targetIds = new Set(
      (Array.isArray(candidate?.declaration?.targetIds) ? candidate.declaration.targetIds : [])
        .map(targetId => {
          const target = findUnitInWorld(worldSnapshot, targetId);
          return target ? preview.unitId(target) : String(targetId || '').trim();
        })
        .filter(Boolean),
    );
    const contributions = Array.isArray(result?.contributions) ? result.contributions : [];
    const threatEntries = [];
    Object.entries(resourceThreatProfile).forEach(([targetId, resources]) => {
      if (!targetIds.has(targetId)) return;
      Object.values(resources || {}).forEach(profile => {
        if (!profile || !(Number(profile?.nextLoss || 0) > 0)) return;
        const restored = contributions.some(entry => {
          if (String(entry?.outcomeKind || '').trim() !== 'RESOURCE_OPTION_CHANGED') return false;
          const entryTarget = findUnitInWorld(worldSnapshot, entry?.targetId || entry?.evidence?.targetId);
          const entryTargetId = entryTarget ? preview.unitId(entryTarget) : String(entry?.targetId || '').trim();
          const entryResource = resourceKeyFor(entry?.evidence?.resourceKey || entry?.evidence?.resource || '');
          return entryTargetId === targetId &&
            entryResource === profile.resourceKey &&
            contributionExpectedDelta(entry) > 0;
        });
        const sourceIds = Array.isArray(profile?.sourceIds) && profile.sourceIds.length
          ? profile.sourceIds
          : profile.activeSourceIds;
        const sourceStillActive = (Array.isArray(sourceIds) ? sourceIds : []).some(sourceId => {
          const source = findUnitInWorld(afterSnapshot, sourceId);
          return source && preview.isBattleCapable(source) && !hasActionCancellation(source);
        });
        threatEntries.push({
          targetId,
          resourceKey: profile.resourceKey,
          pressureRatio: Number(profile.pressureRatio || 0),
          persistent: profile.persistent === true,
          projected: Number(profile.projected || 0),
          nextLoss: Number(profile.nextLoss || 0),
          restored,
          sourceSuppressed: !sourceStillActive,
        });
      });
    });
    const hasPositiveSupportEffect = contributions.some(entry => {
      const kind = String(entry?.outcomeKind || '').trim();
      const evidence = entry?.evidence || {};
      const delta = contributionExpectedDelta(entry);
      return (kind === 'HP_DELTA' || kind === 'SHIELD_DELTA') && delta > 0;
    });
    const unresolved = threatEntries.filter(entry => !entry.restored && !entry.sourceSuppressed);
    const unresolvedResourceThreatProfile = {};
    unresolved.forEach(entry => {
      const sourceProfile = resourceThreatProfile?.[entry.targetId]?.[entry.resourceKey];
      if (!sourceProfile) return;
      unresolvedResourceThreatProfile[entry.targetId] = unresolvedResourceThreatProfile[entry.targetId] || {};
      unresolvedResourceThreatProfile[entry.targetId][entry.resourceKey] = sourceProfile;
    });
    if (!unresolved.length) {
      return Object.freeze({
        observedThreatCount: threatEntries.length,
        threatenedTargetCount: 0,
        resolvedThreats: Object.freeze(threatEntries.map(entry => Object.freeze({ ...entry }))),
        unresolvedThreats: Object.freeze([]),
        capacityLoss: 0,
        normalizedCapacityLoss: 0,
        hasPositiveSupportEffect,
      });
    }
    const threatenedAfter = snapshotAfterResourceThreat(afterSnapshot, unresolvedResourceThreatProfile);
    const noThreatAfter = stateUtilityNext(
      afterSnapshot,
      actorSide,
      beliefState,
      valueContext,
      { resourceThreatProfile: {} },
    );
    const threatenedAfterUtility = stateUtilityNext(
      threatenedAfter,
      actorSide,
      beliefState,
      valueContext,
      { resourceThreatProfile: unresolvedResourceThreatProfile },
    );
    const capacityLoss = Math.max(
      0,
      Number(noThreatAfter?.utility || 0) - Number(threatenedAfterUtility?.utility || 0),
    );
    return Object.freeze({
      observedThreatCount: threatEntries.length,
      threatenedTargetCount: unresolved.length,
      resolvedThreats: Object.freeze(threatEntries
        .filter(entry => entry.restored || entry.sourceSuppressed)
        .map(entry => Object.freeze({ ...entry }))),
      unresolvedThreats: Object.freeze(unresolved.map(entry => Object.freeze({ ...entry }))),
      capacityLoss,
      normalizedCapacityLoss: 100 * capacityLoss / Math.max(1, Number(beforeUtility?.total || 0)),
      hasPositiveSupportEffect,
    });
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
    if (beliefUnit && typeof beliefUnit === 'object') {
      let byTarget = perceivedEnemyBaseCache.get(beliefUnit);
      if (!byTarget) {
        byTarget = new Map();
        perceivedEnemyBaseCache.set(beliefUnit, byTarget);
      }
      if (byTarget.has(target)) return byTarget.get(target);
      const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
      const upper = Math.max(1, Number(range[1] || range[0] || 1));
      const targetLevel = target ? unitLevel(target) : upper;
      const relativeThreat = 10 * Math.pow(upper / Math.max(1, targetLevel), 2);
      const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
      const result = Math.max(8, Math.min(100, relativeThreat), ...knownResponses.map(response => Math.max(0, Number(response?.baseActionValue || 0))));
      byTarget.set(target, result);
      return result;
    }
    const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
    const upper = Math.max(1, Number(range[1] || range[0] || 1));
    const targetLevel = target ? unitLevel(target) : upper;
    const relativeThreat = 10 * Math.pow(upper / Math.max(1, targetLevel), 2);
    const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
    return Math.max(8, Math.min(100, relativeThreat), ...knownResponses.map(response => Math.max(0, Number(response?.baseActionValue || 0))));
  }

  function perceivedEnemyDamageValue(beliefUnit = {}, target = null) {
    if (beliefUnit && typeof beliefUnit === 'object') {
      let byTarget = perceivedEnemyDamageCache.get(beliefUnit);
      if (!byTarget) {
        byTarget = new Map();
        perceivedEnemyDamageCache.set(beliefUnit, byTarget);
      }
      if (byTarget.has(target)) return byTarget.get(target);
      const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
      const upper = Math.max(1, Number(range[1] || range[0] || 1));
      const targetLevel = target ? unitLevel(target) : upper;
      const relativeThreat = 10 * Math.pow(upper / Math.max(1, targetLevel), 2);
      const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
      const result = Math.max(
        8,
        Math.min(100, relativeThreat),
        ...knownResponses.map(response => Math.max(0, Number(response?.hpDamageValue || 0))),
      );
      byTarget.set(target, result);
      return result;
    }
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
    const focusIdsFrom = conditions => new Set((conditions || [])
        .filter(condition => focusTypes.has(String(condition?.type || '').trim()))
        .flatMap(condition => condition?.targetIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean));
    const playerFocusIds = focusIdsFrom(objectives?.defeat?.conditions);
    const enemyFocusIds = focusIdsFrom(objectives?.victory?.conditions);
    const threatSources = entries.map(opposingEntry => {
      const beliefUnit = beliefState?.units?.[preview.unitId(opposingEntry.unit)] || {};
      const knownGroupThreat = (beliefUnit?.knownResponses || [])
        .filter(responseHasGroupDamage)
        .reduce((maximum, response) =>
          Math.max(maximum, Math.max(0, Number(response?.hpDamageValue || 0))), 0);
      return {
        ...opposingEntry,
        beliefUnit,
        quality: actionQualityMultiplier(opposingEntry.unit),
        knownGroupThreat,
      };
    });
    const profile = Object.fromEntries(entries.map(entry => {
      const target = entry.unit;
      const targetId = preview.unitId(target);
      const targetName = preview.unitName(target);
      const focusIds = /player|玩家|我方|己方|友方/i.test(String(entry.side || ''))
        ? playerFocusIds
        : enemyFocusIds;
      const sameSideTargetCount = Math.max(
        1,
        entries.filter(candidate => candidate.side === entry.side).length,
      );
      const singleTargetPressure = focusIds.size
        ? focusIds.has(targetId) || focusIds.has(targetName) ? 1 : 0
        : 1 / sameSideTargetCount;
      let singleThreatPercent = 0;
      let groupThreatPercent = 0;
      threatSources.filter(opposingEntry => opposingEntry.side !== entry.side).forEach(opposingEntry => {
        singleThreatPercent += Math.max(
          perceivedEnemyDamageValue(opposingEntry.beliefUnit, target),
          bestBaseActionValueAgainst(worldSnapshot, opposingEntry.unit, target),
        ) * opposingEntry.quality * singleTargetPressure;
        groupThreatPercent += opposingEntry.knownGroupThreat * opposingEntry.quality;
      });
      const incomingDamage = preview.readHpMax(target) *
        Math.max(groupThreatPercent, singleThreatPercent) / 100;
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
      expectedIncomingShieldDamage(worldSnapshot, target, perspectiveSide, beliefState),
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
        const livingAllies = livingEntries(worldSnapshot)
          .filter(entry => entry.side === unitSide)
          .map(entry => entry.unit);
        const productTargets = productProfile === 'SELF'
          ? [unit]
          : productProfile.startsWith('FRIENDLY')
            ? livingAllies
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
        (
          action.fusionRequired === true &&
          !preview.resolveFusionAction(worldSnapshot, unit, action.skill, {
            resourceCosts: action.costs || parseSkillCosts(action.skill),
            requirePendingOpportunity: true,
          }).valid
        )
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
      const target = findUnitInWorld(worldSnapshot, targetId);
      return target && (action.actionKind === 'USE_ITEM'
        ? preview.isPhysicallyAlive(target)
        : preview.isAlive(target));
    });
  }

  function actionPotentialFromFrozen(worldSnapshot = {}, action = {}, options = {}) {
    const potentialByTarget = action?.potentialByTarget && typeof action.potentialByTarget === 'object'
      ? action.potentialByTarget
      : null;
    const owner = options?.ownerOverride || findUnitInWorld(worldSnapshot, action?.ownerId || '');
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
        const target = findUnitInWorld(worldSnapshot, targetId);
        return target && (action.actionKind === 'USE_ITEM'
          ? preview.isPhysicallyAlive(target)
          : preview.isAlive(target));
      });
    const available = availableTargets.map(targetId => {
      const target = findUnitInWorld(worldSnapshot, targetId);
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

  function capacityUnitSignature(unit = {}, mode = 'sequence') {
    let byMode = unitCapacitySignatureCache.get(unit);
    if (!byMode) {
      byMode = new Map();
      unitCapacitySignatureCache.set(unit, byMode);
    }
    if (byMode.has(mode)) return byMode.get(mode);
    const runtime = unit?.__battleRuntime || {};
    const naturalOpportunity = runtime?.naturalOpportunity || {};
    const base = [
      preview.unitId(unit),
      preview.isBattleCapable(unit),
      preview.readHp(unit),
      preview.readHpMax(unit),
      preview.readShield(unit),
      preview.readResource(unit, '魂力'),
      preview.readResourceMax(unit, '魂力'),
      preview.readResource(unit, '精神力'),
      preview.readResourceMax(unit, '精神力'),
      preview.readResource(unit, '体力'),
      preview.readResourceMax(unit, '体力'),
      preview.readCombatStat(unit, 'str'),
      preview.readCombatStat(unit, 'def'),
      preview.readCombatStat(unit, 'agi'),
      preview.readCombatStat(unit, 'men'),
      preview.staminaScaleForUnit(unit),
      actionQualityMultiplier(unit),
      cancellationProbabilityAtOpportunity(unit, 1),
      cancellationProbabilityAtOpportunity(unit, 2),
      hasStateFlag(unit, 'silence'),
      hasStateFlag(unit, 'disarm'),
      recoveryLockRatio(unit, '魂力'),
      recoveryLockRatio(unit, '精神力'),
      Math.max(0, Math.floor(Number(unit?.魂核?.核心?.数量 || 0))),
      String(unit?.状态?.行动 || '').trim(),
      unit?.状态?.存活 !== false,
      String(unit?.时间段 || unit?.时间 || '').trim(),
      Number(unit?.final?.__体力衰减系数 ?? 1),
      Number(unit?.final?.str ?? NaN),
      Number(unit?.final?.def ?? NaN),
      Number(unit?.final?.agi ?? NaN),
      Number(unit?.final?.sp_max ?? NaN),
      Number(unit?.final?.vit_max ?? NaN),
      Number(unit?.final?.men_max ?? NaN),
    ];
    if (mode === 'fusion' || mode === 'sequence') {
      base.push(
        Number(naturalOpportunity?.round || 0),
        String(naturalOpportunity?.status || '').trim(),
        String(naturalOpportunity?.consumedByActionId || '').trim(),
        [...new Set((Array.isArray(runtime?.fusionUsageKeys) ? runtime.fusionUsageKeys : []).map(String))].sort(),
      );
    }
    if (mode === 'sequence') {
      base.push(
        collectInventory(unit)
          .map(entry => [String(entry.id || ''), Math.max(0, Number(entry.quantity || 0))])
          .sort((left, right) => left[0].localeCompare(right[0])),
      );
    }
    const signature = JSON.stringify(base);
    byMode.set(mode, signature);
    return signature;
  }

  function sequenceCatalogMeta(catalog = []) {
    const cached = sequenceCatalogMetaCache.get(catalog);
    if (cached) return cached;
    const targetIds = [...new Set(catalog.flatMap(action =>
      action?.targetPoolIds || action?.targetIds || []
    ).map(value => String(value || '').trim()).filter(Boolean))].sort();
    const itemTargetIds = new Set(catalog
      .filter(action => action?.actionKind === 'USE_ITEM')
      .flatMap(action => action?.targetPoolIds || action?.targetIds || [])
      .map(value => String(value || '').trim())
      .filter(Boolean));
    const fusionParticipantIds = [...new Set(catalog
      .filter(action => action?.fusionRequired === true)
      .flatMap(action => action?.fusionParticipantIds || [])
      .map(value => String(value || '').trim())
      .filter(Boolean))].sort();
    const inventorySensitive = catalog.some(action =>
      action?.actionKind === 'USE_ITEM' ||
      !!action?.inventoryId ||
      !!action?.requiresInventoryId ||
      !!action?.creation?.productId
    );
    const result = Object.freeze({
      targetIds: Object.freeze(targetIds),
      itemTargetIds,
      fusionParticipantIds: Object.freeze(fusionParticipantIds),
      inventorySensitive,
    });
    sequenceCatalogMetaCache.set(catalog, result);
    return result;
  }

  function sequenceCatalogFingerprint(catalog = []) {
    const cached = sequenceCatalogFingerprintCache.get(catalog);
    if (cached) return cached;
    const meta = sequenceCatalogMeta(catalog);
    const rows = catalog.map(action => [
      String(action?.actionKey || ''),
      String(action?.ownerId || ''),
      String(action?.actionKind || ''),
      String(action?.targetMode || ''),
      [...new Set((action?.targetPoolIds || action?.targetIds || []).map(String))].sort(),
      Object.entries(action?.potentialByTarget || {}).sort(([left], [right]) => left.localeCompare(right)),
      Object.entries(action?.damagePotentialByTarget || {}).sort(([left], [right]) => left.localeCompare(right)),
      Number(action?.potential || 0),
      Number(action?.damagePotential || 0),
      Object.entries(action?.costs || {}).sort(([left], [right]) => left.localeCompare(right)),
      Number(action?.costRatio || 0),
      String(action?.inventoryId || ''),
      String(action?.requiresInventoryId || ''),
      action?.creation ? [
        String(action.creation.productId || ''),
        action.creation.useful === true,
        JSON.stringify(action.creation.useEffects || []),
      ] : '',
      action?.fusionRequired === true,
      [...new Set((action?.fusionParticipantIds || []).map(String))].sort(),
      String(action?.skill?.id || action?.skill?.技能ID || ''),
      String(action?.skill?.name || action?.skill?.魂技名 || action?.skill?.技能名称 || ''),
      typeof preview.effectArrayHash === 'function'
        ? preview.effectArrayHash(action?.skill?._效果数组)
        : preview.stableHash(action?.skill?._效果数组 || []),
    ]);
    const fingerprint = JSON.stringify([meta.targetIds, [...meta.fusionParticipantIds], rows]);
    sequenceCatalogFingerprintCache.set(catalog, fingerprint);
    return fingerprint;
  }

  function sequenceOwnerSignature(unit = {}, catalogMeta = {}) {
    const runtime = unit?.__battleRuntime || {};
    const naturalOpportunity = runtime?.naturalOpportunity || {};
    const signature = [
      preview.unitId(unit),
      preview.isAlive(unit),
      preview.readResource(unit, '魂力'),
      preview.readResourceMax(unit, '魂力'),
      preview.readResource(unit, '精神力'),
      preview.readResourceMax(unit, '精神力'),
      preview.readResource(unit, '体力'),
      preview.readResourceMax(unit, '体力'),
      preview.staminaScaleForUnit(unit),
      actionQualityMultiplier(unit),
      hasStateFlag(unit, 'silence'),
      hasStateFlag(unit, 'disarm'),
      recoveryLockRatio(unit, '魂力'),
      recoveryLockRatio(unit, '精神力'),
      Math.max(0, Math.floor(Number(unit?.魂核?.核心?.数量 || 0))),
      String(unit?.状态?.行动 || '').trim(),
      unit?.状态?.存活 !== false,
    ];
    if (catalogMeta.inventorySensitive) {
      signature.push(
        preview.readCombatStat(unit, 'str'),
        preview.readCombatStat(unit, 'def'),
        preview.readCombatStat(unit, 'agi'),
        preview.readCombatStat(unit, 'men'),
        collectInventory(unit)
          .map(entry => [String(entry.id || ''), Math.max(0, Number(entry.quantity || 0))])
          .sort((left, right) => left[0].localeCompare(right[0])),
      );
    }
    if (catalogMeta.fusionParticipantIds?.length) {
      signature.push(
        Number(naturalOpportunity?.round || 0),
        String(naturalOpportunity?.status || '').trim(),
        String(naturalOpportunity?.consumedByActionId || '').trim(),
        [...new Set((Array.isArray(runtime?.fusionUsageKeys) ? runtime.fusionUsageKeys : []).map(String))].sort(),
      );
    }
    return JSON.stringify(signature);
  }

  function sequenceProfileSignature(worldSnapshot = {}, unit = {}, catalog = [], options = {}) {
    const catalogMeta = sequenceCatalogMeta(catalog);
    const hasTargetAvailability = options?.targetAvailabilityById && typeof options.targetAvailabilityById === 'object';
    const targetAvailabilityById = hasTargetAvailability
      ? options.targetAvailabilityById
      : {};
    const targetAvailabilityKey = hasTargetAvailability ? targetAvailabilityById : null;
    const ownerOverride = options?.ownerOverride && typeof options.ownerOverride === 'object'
      ? options.ownerOverride
      : null;
    const catalogFingerprint = sequenceCatalogFingerprint(catalog);
    let byUnit = sequenceProfileSignatureCache.get(worldSnapshot);
    if (!byUnit) {
      byUnit = new WeakMap();
      sequenceProfileSignatureCache.set(worldSnapshot, byUnit);
    }
    let byCatalog = byUnit.get(unit);
    if (!byCatalog) {
      byCatalog = new Map();
      byUnit.set(unit, byCatalog);
    }
    let byAvailability = byCatalog.get(catalogFingerprint);
    if (!byAvailability) {
      byAvailability = new Map();
      byCatalog.set(catalogFingerprint, byAvailability);
    }
    let byOwner = byAvailability.get(targetAvailabilityKey);
    if (!byOwner) {
      byOwner = new Map();
      byAvailability.set(targetAvailabilityKey, byOwner);
    }
    if (byOwner.has(ownerOverride)) return byOwner.get(ownerOverride);
    const ownerSide = sideOf(worldSnapshot, unit);
    const parts = [
      sequenceOwnerSignature(unit, catalogMeta),
    ];
    parts.push(ownerOverride && ownerOverride !== unit ? capacityUnitSignature(ownerOverride, 'target') : '');
    catalogMeta.targetIds.forEach(targetId => {
      const target = findUnitInWorld(worldSnapshot, targetId);
      const isFriendlyTarget = target && targetId !== preview.unitId(unit) &&
        sideOf(worldSnapshot, target) === ownerSide;
      parts.push(
        targetId,
        target ? sideOf(worldSnapshot, target) : '',
        target ? preview.isBattleCapable(target) : false,
        target ? capacityUnitSignature(target, 'target') : '',
        isFriendlyTarget ? Number(targetAvailabilityById[targetId] ?? 1) : 1,
      );
    });
    catalogMeta.fusionParticipantIds.forEach(participantId => {
      const participant = findUnitInWorld(worldSnapshot, participantId);
      parts.push(
        participantId,
        participant ? sideOf(worldSnapshot, participant) : '',
        participant ? capacityUnitSignature(participant, 'fusion') : '',
      );
    });
    const signature = parts.map(value => {
      const text = String(value ?? '');
      return `${text.length}:${text}`;
    }).join('');
    byOwner.set(ownerOverride, signature);
    return signature;
  }

  function sequenceProfileFromFrozen(worldSnapshot = {}, unit = {}, catalog = [], options = {}) {
    decisionMetrics.sequenceProfileCalls += 1;
    const catalogFingerprint = sequenceCatalogFingerprint(catalog);
    const semanticSignature = sequenceProfileSignature(worldSnapshot, unit, catalog, options);
    let bySignature = sequenceProfileSemanticCache.get(catalogFingerprint);
    if (!bySignature) {
      if (sequenceProfileSemanticCache.size >= MAX_SEQUENCE_PROFILE_CATALOGS) {
        sequenceProfileSemanticCache.clear();
      }
      bySignature = new Map();
      sequenceProfileSemanticCache.set(catalogFingerprint, bySignature);
    }
    if (bySignature.has(semanticSignature)) {
      decisionMetrics.sequenceProfileCacheHits += 1;
      return bySignature.get(semanticSignature);
    }
    decisionMetrics.sequenceProfileMisses += 1;
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
      ...directActions.filter(action => !action.requiresInventoryId),
      ...directActions.filter(action => action.requiresInventoryId),
      ...creationActions,
    ];
    if (!legalFirst.length) {
      const empty = Object.freeze({
        firstPotential: 0,
        secondPotential: 0,
        sequencePotential: 0,
        backupPotential: 0,
        actionKeys: Object.freeze([]),
        affordableActionKeys: Object.freeze([]),
        routes: Object.freeze([]),
      });
      if (bySignature.size >= MAX_SEQUENCE_PROFILES_PER_CATALOG) bySignature.clear();
      bySignature.set(semanticSignature, empty);
      return empty;
    }
    const routeCandidates = legalFirst.map(first => {
      let secondUnit = unitAfterResourceCosts(unit, first.costs || {});
      secondUnit = first.creation?.productId
        ? unitAfterCreation(secondUnit, first.creation)
        : unitAfterInventoryConsumption(secondUnit, first.inventoryId || '');
      secondUnit = unitAfterDeterministicRecovery(secondUnit);
      const recovered = replaceWorldUnit(worldSnapshot, preview.unitId(unit), secondUnit);
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
      return {
        firstPotential: first.potential,
        secondPotential: second?.potential || 0,
        sequencePotential,
        totalCostRatio: Math.max(0, Number(first?.costRatio || 0)) +
          0.5 * Math.max(0, Number(second?.costRatio || 0)),
        actionKeys: [first.actionKey, second?.actionKey || ''].filter(Boolean),
      };
    });
    const routes = routeCandidates
      .filter(route => !routeCandidates.some(other =>
        other !== route &&
        Number(other.sequencePotential || 0) >= Number(route.sequencePotential || 0) - 1e-9 &&
        Number(other.totalCostRatio || 0) <= Number(route.totalCostRatio || 0) + 1e-9 &&
        (
          Number(other.sequencePotential || 0) > Number(route.sequencePotential || 0) + 1e-9 ||
          Number(other.totalCostRatio || 0) < Number(route.totalCostRatio || 0) - 1e-9
        )
      ))
      .sort((left, right) =>
        Number(right.sequencePotential || 0) - Number(left.sequencePotential || 0) ||
        Number(left.totalCostRatio || 0) - Number(right.totalCostRatio || 0) ||
        String(left.actionKeys?.[0] || '').localeCompare(String(right.actionKeys?.[0] || ''))
      )
      .slice(0, 3);
    const result = routes[0] || {
      firstPotential: 0,
      secondPotential: 0,
      sequencePotential: 0,
      actionKeys: [],
    };
    const backupPotential =
      0.5 * Number(routes[1]?.sequencePotential || 0) +
      0.25 * Number(routes[2]?.sequencePotential || 0);
    const frozen = Object.freeze({
      ...result,
      backupPotential,
      actionKeys: Object.freeze([...result.actionKeys]),
      affordableActionKeys: Object.freeze([
        ...new Set(legalFirst.map(action => String(action?.actionKey || '').trim()).filter(Boolean)),
      ]),
      routes: Object.freeze(routes.map(route => Object.freeze({
        ...route,
        actionKeys: Object.freeze([...route.actionKeys]),
      }))),
    });
    if (bySignature.size >= MAX_SEQUENCE_PROFILES_PER_CATALOG) bySignature.clear();
    bySignature.set(semanticSignature, frozen);
    return frozen;
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
        ...nonDominated.filter(action => !action.requiresInventoryId),
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
    const sideById = Object.fromEntries(worldEntries(worldSnapshot).map(entry => [
      preview.unitId(entry.unit),
      entry.side,
    ]));
    const capacityDependencyIds = Object.fromEntries(Object.entries(catalogs).map(([id, catalog]) => {
      const unitSide = sideById[id] || '';
      const dependencies = new Set();
      catalog.forEach(action => {
        const targets = action?.targetPoolIds || action?.targetIds || [];
        targets.forEach(targetId => {
          const normalizedTargetId = String(targetId || '').trim();
          if (!normalizedTargetId) return;
          if (
            action?.actionKind === 'USE_ITEM' ||
            normalizedTargetId === id ||
            sideById[normalizedTargetId] === unitSide
          ) dependencies.add(normalizedTargetId);
        });
        (action?.fusionParticipantIds || []).forEach(participantId => {
          const normalizedParticipantId = String(participantId || '').trim();
          if (normalizedParticipantId) dependencies.add(normalizedParticipantId);
        });
      });
      return [id, Object.freeze([...dependencies])];
    }));
    const resourceThreatProfile = resourceThreatProfileFor(worldSnapshot);
    const result = Object.freeze({
      perspectiveSide,
      catalogs: Object.freeze(catalogs),
      informationCatalogs: Object.freeze(rawCatalogs),
      capacityDependencyIds: Object.freeze(capacityDependencyIds),
      frozenDirectPotential: Object.freeze(frozenDirectPotential),
      frozenDamagePotential: Object.freeze(frozenDamagePotential),
      resourceThreatProfile,
      resourceThreatDiagnostics: decisionMetrics.resourceThreatDiagnostics || null,
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
    const resourceThreatProfile = options?.resourceThreatProfile ||
      valueContext?.resourceThreatProfile ||
      resourceThreatProfileFor(worldSnapshot);
    const restoredAvailability = options?.restoreActionAvailabilityFor instanceof Set
      ? options.restoreActionAvailabilityFor
      : new Set(options?.restoreActionAvailabilityFor || []);
    const cacheKey = [
      side,
      perspectiveSide,
      [...restoredAvailability].map(String).sort().join(','),
      resourceThreatProfileKey(resourceThreatProfile),
    ].join('|');
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
    const sideEntries = entries.filter(entry =>
      entry.side === side &&
      !preview.isSummonUnit(entry.unit)
    );
    const summonEntries = entries.filter(entry =>
      entry.side === side &&
      preview.isSummonUnit(entry.unit)
    );
    const allSideEntries = [...sideEntries, ...summonEntries];
    const primaryIds = new Set(sideEntries.map(entry => preview.unitId(entry.unit)));
    const auxiliaryIds = new Set(summonEntries.map(entry => preview.unitId(entry.unit)));
    const threatenedSnapshot = snapshotAfterResourceThreat(worldSnapshot, resourceThreatProfile);
    const capacityTotals = unitCapacities => {
      const totalFor = ids => [...ids].reduce(
        (sum, id) => sum + Number(unitCapacities[id] || 0),
        0,
      );
      const primaryTotal = totalFor(primaryIds);
      const auxiliaryTotal = totalFor(auxiliaryIds);
      return { primaryTotal, auxiliaryTotal, total: primaryTotal + auxiliaryTotal };
    };
    const dynamicCatalogs = new Map();
    const catalogFor = unit => {
      const id = preview.unitId(unit);
      const frozenCatalog = valueContext.catalogs[id];
      const baseUnit = findUnitInWorld(valueContext.worldSnapshot, id);
      const inventoryFingerprint = value => collectInventory(value)
        .map(entry => [String(entry.id || ''), Math.max(0, Number(entry.quantity || 0))])
        .sort((left, right) => left[0].localeCompare(right[0]));
      const inventoryChanged = frozenCatalog &&
        sequenceCatalogMeta(frozenCatalog).inventorySensitive &&
        JSON.stringify(inventoryFingerprint(unit)) !== JSON.stringify(inventoryFingerprint(baseUnit));
      if (frozenCatalog && !inventoryChanged) return frozenCatalog;
      if (!dynamicCatalogs.has(id)) {
        dynamicCatalogs.set(id, frozenActionCatalog(worldSnapshot, unit, perspectiveSide, beliefState));
      }
      return dynamicCatalogs.get(id);
    };
    const damagePotentialFor = unit => {
      const id = preview.unitId(unit);
      if (dynamicDamagePotential.has(id)) return dynamicDamagePotential.get(id);
      if (Number.isFinite(Number(valueContext.frozenDamagePotential?.[id]))) {
        const value = Math.max(0, Number(valueContext.frozenDamagePotential[id]));
        dynamicDamagePotential.set(id, value);
        return value;
      }
      const value = Math.max(0, ...catalogFor(unit).map(action => Number(action?.damagePotential || 0)));
      dynamicDamagePotential.set(id, value);
      return value;
    };
    const dynamicDamagePotential = new Map();
    const incomingThreatBySide = new Map();
    [...new Set(entries.map(entry => entry.side))].forEach(targetSide => {
      incomingThreatBySide.set(targetSide, entries
        .filter(entry => entry.side !== targetSide)
        .reduce((maximum, opposingEntry) =>
          Math.max(maximum, damagePotentialFor(opposingEntry.unit) * actionQualityMultiplier(opposingEntry.unit))
        , 0));
    });
    const survivalProbabilityFor = unit => {
      const unitSide = sideOf(worldSnapshot, unit);
      const incomingThreatPercent = Math.max(0, Number(incomingThreatBySide.get(unitSide) || 0));
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
      const threatenedUnit = findUnitInWorld(threatenedSnapshot, id) || unit;
      const profile = sequenceProfileFromFrozen(threatenedSnapshot, threatenedUnit, catalogFor(unit), {
        targetAvailabilityById,
      });
      const restoreAvailability = restoredAvailability.has(id);
      const summonWindows = preview.isSummonUnit(threatenedUnit)
        ? Math.max(0, Math.floor(Number(
            threatenedUnit?.__battleRuntime?.summonWindow?.remainingWindows ??
            threatenedUnit?.__battleRuntime?.remainingWindows ??
            threatenedUnit?.剩余窗口 ??
            0
          )))
        : null;
      if (summonWindows !== null) {
        const usableWindows = Math.min(2, summonWindows);
        return survivalProbability * (
          (usableWindows >= 1 ? profile.firstPotential : 0) +
          (usableWindows >= 2 ? 0.5 * profile.secondPotential : 0)
        );
      }
      const firstWindowAvailability = summonWindows === null || summonWindows >= 1 ? 1 : 0;
      const secondWindowAvailability = summonWindows === null || summonWindows >= 2 ? 1 : 0;
      return preview.calculateTwoOpportunityCapacity({
        unit: threatenedUnit,
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
      decisionMetrics.teamCapacityUnitsRecomputed += allSideEntries.length;
      const survivalInputsById = Object.fromEntries(entries.map(entry => [
        preview.unitId(entry.unit),
        survivalProbabilityFor(entry.unit),
      ]));
      const targetAvailabilityById = Object.fromEntries(Object.entries(survivalInputsById).map(([id, profile]) => [
        id,
        profile.survivalProbability,
      ]));
      const unitCapacities = Object.fromEntries(allSideEntries.map(entry => {
        const id = preview.unitId(entry.unit);
        return [id, buildCapacity(entry.unit, targetAvailabilityById, targetAvailabilityById[id])];
      }));
      const totals = capacityTotals(unitCapacities);
      return Object.freeze({
        ...totals,
        unitCapacities: Object.freeze(unitCapacities),
        targetAvailabilityById: Object.freeze(targetAvailabilityById),
        survivalInputsById: Object.freeze(survivalInputsById),
        resourceThreatProfile,
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
          const parentUnit = findUnitInWorld(parentSnapshot, id);
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
          current: findUnitInWorld(worldSnapshot, id),
          parent: findUnitInWorld(parentSnapshot, id),
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
          const affectedIds = new Set(allSideEntries.filter(entry => {
            const unit = entry.unit;
            const id = preview.unitId(unit);
            if (changedIds.has(id)) return true;
            const dependencies = valueContext.capacityDependencyIds?.[id] || [];
            return dependencies.some(dependencyId => changedIds.has(String(dependencyId)));
          }).map(entry => preview.unitId(entry.unit)));
          decisionMetrics.teamCapacityIncrementalBuilds += 1;
          decisionMetrics.teamCapacityUnitsRecomputed += affectedIds.size;
          const unitCapacities = { ...parentProfile.unitCapacities };
          allSideEntries.forEach(entry => {
            const id = preview.unitId(entry.unit);
            if (!affectedIds.has(id)) return;
            unitCapacities[id] = buildCapacity(
              entry.unit,
              targetAvailabilityById,
              Number(targetAvailabilityById[id] || 0),
            );
          });
          const totals = capacityTotals(unitCapacities);
          const result = Object.freeze({
            ...totals,
            unitCapacities: Object.freeze(unitCapacities),
            targetAvailabilityById: Object.freeze(targetAvailabilityById),
            survivalInputsById: Object.freeze(survivalInputsById),
            resourceThreatProfile,
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
    const resourceThreatProfile = options?.resourceThreatProfile ||
      valueContext?.resourceThreatProfile ||
      resourceThreatProfileFor(worldSnapshot);
    const restoreIds = options?.restoreActionAvailabilityFor instanceof Set
      ? [...options.restoreActionAvailabilityFor].map(String).sort().join(',')
      : '';
    const cacheKey = `${actorSide}|${restoreIds}|${resourceThreatProfileKey(resourceThreatProfile)}`;
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
    const sides = [...new Set(worldEntries(worldSnapshot).map(entry => entry.side))];
    const capacityOptions = {
      ...options,
      resourceThreatProfile,
    };
    const own = teamCapacityNext(worldSnapshot, actorSide, actorSide, beliefState, valueContext, capacityOptions);
    const enemy = sides.filter(side => side !== actorSide).reduce((sum, side) =>
      sum + teamCapacityNext(worldSnapshot, side, actorSide, beliefState, valueContext, capacityOptions), 0);
    const result = Object.freeze({
      own,
      enemy,
      total: own + enemy,
      utility: own - enemy,
      nonDuplicatedGoalProgress: 0,
      resourceThreatProfile,
    });
    byContext.set(cacheKey, result);
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

  function firstAllyBeforeActorNextOpportunity(worldSnapshot = {}, actor = null, actorSide = '') {
    const actorId = preview.unitId(actor);
    const ordered = aliveEntries(worldSnapshot)
      .map(entry => entry.unit)
      .sort(preview.compareNaturalActionOrder);
    const actorIndex = ordered.findIndex(unit => preview.unitId(unit) === actorId);
    if (actorIndex < 0) return null;
    for (let offset = 1; offset < ordered.length; offset += 1) {
      const unit = ordered[(actorIndex + offset) % ordered.length];
      if (
        sideOf(worldSnapshot, unit) === actorSide &&
        preview.isBattleCapable(unit)
      ) return unit;
    }
    return null;
  }

  function deterministicRecoveryUnlocksAction(worldSnapshot = {}, actorId = '', valueContext = null) {
    const actor = findUnitInWorld(worldSnapshot, actorId);
    const catalog = valueContext?.catalogs?.[actorId] || [];
    if (!actor || !catalog.length) return false;
    const bestCurrent = catalog
      .filter(action => actionLegalFromFrozen(worldSnapshot, actor, action))
      .reduce((best, action) => Math.max(best, Number(action?.potential || 0)), 0);
    const recovered = snapshotAfterDeterministicRecovery(worldSnapshot, actorId);
    const recoveredActor = findUnitInWorld(recovered, actorId);
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
        opportunityIdsByTarget: Object.freeze({}),
        exploiterIdsByTarget: Object.freeze({}),
      });
    }
    const actorId = preview.unitId(actor);
    const explicitFollowUp = (result?.contributions || []).some(entry =>
      ['ACTION_GRANTED', 'SUMMON_WINDOW'].includes(entry?.outcomeKind)) ||
      (result?.scheduledEvents || []).some(event => event?.type === 'SUMMON_CREATE');
    const survivalGoal = isSurvivalIntent({ worldSnapshot: beforeSnapshot, actorId, battleIntent });
    const actorHpRatio = preview.readHp(actor) / Math.max(1, preview.readHpMax(actor));
    const reasonsByTarget = {};
    const opportunityIdsByTarget = {};
    const exploiterIdsByTarget = {};
    const realizableTargetIds = [];
    const unrealizableTargetIds = [];
    targetIds.forEach(targetId => {
      const targetBefore = findUnitInWorld(beforeSnapshot, targetId);
      const targetAfter = findUnitInWorld(afterSnapshot, targetId);
      if (!targetBefore || !targetAfter) {
        unrealizableTargetIds.push(targetId);
        reasonsByTarget[targetId] = Object.freeze([]);
        opportunityIdsByTarget[targetId] = Object.freeze([]);
        exploiterIdsByTarget[targetId] = Object.freeze([]);
        return;
      }
      const opportunityIds = [...new Set(cancelledContributions
        .filter(entry => String(entry?.targetId || '').trim() === targetId)
        .map(entry => String(entry?.windowId || '').trim())
        .filter(Boolean))];
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
        (Array.isArray(branch?.responseSequence) ? branch.responseSequence : [branch]).some(response =>
          String(response?.sourceActorId || '').trim() === targetId &&
          (
            response?.lethal === true ||
            actorHpRatio <= 0.35
          )
        )
      );
      const currentRoundResponse = candidateResponseBranches.some(branch =>
        (Array.isArray(branch?.responseSequence) ? branch.responseSequence : [branch]).some(response =>
          String(response?.sourceActorId || '').trim() === targetId
        )
      );
      if (addsCoverage && currentRoundResponse) reasons.push('CURRENT_ROUND_RESPONSE');
      const criticalAlly = aliveEntries(beforeSnapshot)
        .filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== actorId)
        .find(entry => {
          const hpRatio = preview.readHp(entry.unit) / Math.max(1, preview.readHpMax(entry.unit));
          return hpRatio <= 0.3 &&
            bestBaseActionValueAgainst(beforeSnapshot, targetBefore, entry.unit) >= hpRatio * 50;
        });
      if (addsCoverage && (survivalGoal || threateningBranch || criticalAlly)) reasons.push('SURVIVAL_WINDOW');
      const exactOpportunityDenied = opportunityIds.length > 0;
      if (addsCoverage && exactOpportunityDenied && reasons.length) realizableTargetIds.push(targetId);
      else unrealizableTargetIds.push(targetId);
      reasonsByTarget[targetId] = Object.freeze(reasons);
      opportunityIdsByTarget[targetId] = Object.freeze(opportunityIds);
      exploiterIdsByTarget[targetId] = Object.freeze(
        exploiter ? [preview.unitId(exploiter)] : [],
      );
    });
    return Object.freeze({
      hasCancellation: realizableTargetIds.length > 0,
      realizableTargetIds: Object.freeze(realizableTargetIds),
      unrealizableTargetIds: Object.freeze(unrealizableTargetIds),
      reasonsByTarget: Object.freeze(reasonsByTarget),
      opportunityIdsByTarget: Object.freeze(opportunityIdsByTarget),
      exploiterIdsByTarget: Object.freeze(exploiterIdsByTarget),
    });
  }

  function nextIntentTerminalEvaluation(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const objectives = preview.normalizeBattleObjectives(
      context?.battleIntent?.objectives ||
      context?.battleIntent?.胜负条件 ||
      afterSnapshot?.胜负条件 ||
      {},
      afterSnapshot,
    );
    const evaluate = snapshot => {
      let byObjectives = objectiveEvaluationCache.get(snapshot);
      if (!byObjectives) {
        byObjectives = new WeakMap();
        objectiveEvaluationCache.set(snapshot, byObjectives);
      }
      if (!byObjectives.has(objectives)) {
        byObjectives.set(
          objectives,
          preview.evaluateBattleObjectives(snapshot, objectives, { roundCompleted: false }),
        );
      }
      return byObjectives.get(objectives);
    };
    const before = evaluate(beforeSnapshot);
    const after = evaluate(afterSnapshot);
    const actorIsPlayer = /player|玩家|我方|己方|友方/i.test(String(actorSide || ''));
    const actorWinner = actorIsPlayer ? 'player' : 'enemy';
    const directTerminal = !before.terminal &&
      after.terminal &&
      after.winner !== 'draw' &&
      after.winner === actorWinner;
    const directFailure = !before.terminal &&
      after.terminal &&
      after.winner !== 'draw' &&
      after.winner !== actorWinner;
    return Object.freeze({
      beforeTerminal: before.terminal === true,
      afterTerminal: after.terminal === true,
      directTerminal,
      directFailure,
      winner: String(after?.winner || 'unfinished').trim(),
      terminalReason: String(after?.terminalReason || '').trim(),
      matchedConditionTypes: Object.freeze(
        (Array.isArray(after?.matchedDetails) ? after.matchedDetails : [])
          .map(detail => String(detail?.condition?.type || '').trim())
          .filter(Boolean),
      ),
    });
  }

  function nextIntentTerminalUtility(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const evaluation = nextIntentTerminalEvaluation(beforeSnapshot, afterSnapshot, actorSide, context);
    if (evaluation.directTerminal) return 100;
    if (evaluation.directFailure) return -100;
    return 0;
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
      .filter(entry => entry.side !== actorSide && preview.isPhysicallyAlive(entry.unit))
      .reduce((sum, entry) => {
        const targetAfter = findUnitInWorld(afterSnapshot, preview.unitId(entry.unit));
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
    return intentProgressUtility(beforeSnapshot, afterSnapshot, actorSide, {
      ...context,
      useJointIncapacitationProgress: true,
      includeFailureRisk: false,
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

  function resourceContinuityAudit({
    beforeSnapshot = {},
    noOpSnapshot = {},
    afterSnapshot = {},
    actorId = '',
    catalog = [],
  } = {}) {
    const profileAt = snapshot => {
      const unit = findUnitInWorld(snapshot, actorId);
      if (!unit || !preview.isBattleCapable(unit)) {
        return Object.freeze({
          firstPotential: 0,
          secondPotential: 0,
          sequencePotential: 0,
          backupPotential: 0,
          actionKeys: Object.freeze([]),
          affordableActionKeys: Object.freeze([]),
          routes: Object.freeze([]),
        });
      }
      return sequenceProfileFromFrozen(snapshot, unit, catalog);
    };
    const before = profileAt(beforeSnapshot);
    const noOp = profileAt(noOpSnapshot);
    const after = profileAt(afterSnapshot);
    const noOpAffordable = Array.isArray(noOp.affordableActionKeys)
      ? noOp.affordableActionKeys
      : noOp.actionKeys;
    const afterAffordable = Array.isArray(after.affordableActionKeys)
      ? after.affordableActionKeys
      : after.actionKeys;
    const lostActionKeys = noOpAffordable.filter(actionKey => !afterAffordable.includes(actionKey));
    const routeKey = route => JSON.stringify(
      Array.isArray(route?.actionKeys) ? route.actionKeys.map(String) : [],
    );
    const noOpRouteKeys = new Set((noOp.routes || []).map(routeKey));
    const afterRouteKeys = (after.routes || []).map(routeKey);
    const newNonDominatedRouteKeys = afterRouteKeys.filter(key => !noOpRouteKeys.has(key));
    const sequencePotentialDelta =
      Number(after.sequencePotential || 0) - Number(noOp.sequencePotential || 0);
    const backupPotentialDelta =
      Number(after.backupPotential || 0) - Number(noOp.backupPotential || 0);
    return Object.freeze({
      before,
      noOp,
      after,
      sequencePotentialDelta,
      backupPotentialDelta,
      // Capacity uses the two-opportunity sequence only. Backup routes remain
      // diagnostic and must not create a second resource value stream.
      resourceContinuityDelta: sequencePotentialDelta,
      firstOpportunityDelta:
        Number(after.firstPotential || 0) - Number(noOp.firstPotential || 0),
      secondOpportunityDelta:
        Number(after.secondPotential || 0) - Number(noOp.secondPotential || 0),
      lostActionKeys: Object.freeze(lostActionKeys),
      unlockedActionKeys: Object.freeze(
        afterAffordable.filter(actionKey => !noOpAffordable.includes(actionKey)),
      ),
      newNonDominatedRouteKeys: Object.freeze(newNonDominatedRouteKeys),
      supportRealized:
        sequencePotentialDelta > 0.0001 ||
        backupPotentialDelta > 0.0001 ||
        afterAffordable.some(actionKey => !noOpAffordable.includes(actionKey)) ||
        newNonDominatedRouteKeys.length > 0,
    });
  }

  function crisisResponseAudit({
    problems = [],
    actorId = '',
    candidate = {},
    beforeSnapshot = {},
    noOpSnapshot = {},
    afterSnapshot = {},
    responseComparison = {},
    contributions = [],
    teamIntent = {},
  } = {}) {
    const crisisIds = new Set(['SURVIVAL_CRISIS', 'ALLY_CRISIS', 'IMMINENT_DENIAL']);
    const crisisProblems = problems.filter(problem =>
      crisisIds.has(String(problem?.problemId || '').trim())
    );
    const crisis = crisisProblems[0] || null;
    if (!crisis) {
      return Object.freeze({
        required: false,
        applicable: false,
        responsibleForCrisis: false,
        reasonCode: 'NO_CRISIS',
        problemId: '',
        targetIds: Object.freeze([]),
        responseUtilityDelta: 0,
        targetCapacityDelta: 0,
        catastrophicRiskReduction: 0,
        terminalCompensation: false,
        objectiveCompensation: false,
        realized: false,
        evidenceOutcomeKinds: Object.freeze([]),
      });
    }
    const problemId = String(crisis.problemId || '').trim();
    const targetIds = [...new Set([
      ...crisisProblems.flatMap(problem =>
        Array.isArray(problem?.targetIds) ? problem.targetIds : []
      ),
      ...(
        problemId === 'SURVIVAL_CRISIS' && !crisis?.targetIds?.length
          ? [actorId]
          : []
      ),
    ].map(value => String(value || '').trim()).filter(Boolean))];
    const threatSourceIds = new Set(
      crisisProblems.flatMap(problem =>
        Array.isArray(problem?.evidence?.threatSourceIds)
          ? problem.evidence.threatSourceIds
          : []
      )
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const candidateActionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
    const protectedTargetId = String(teamIntent?.protectTarget || '').trim();
    const candidateTargetIds = new Set(
      (candidate?.declaration?.targetIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const targetMatch = targetIds.some(targetId => candidateTargetIds.has(targetId));
    const threatMatch = [...threatSourceIds].some(targetId => candidateTargetIds.has(targetId));
    const capacityDeltaForTarget = targetId => {
      const noOpTarget = findUnitInWorld(noOpSnapshot, targetId);
      const afterTarget = findUnitInWorld(afterSnapshot, targetId);
      if (!noOpTarget || !afterTarget) {
        return noOpTarget && !afterTarget && problemId === 'IMMINENT_DENIAL' ? 100 : 0;
      }
      if (problemId === 'IMMINENT_DENIAL') {
        const noOpThreat =
          preview.readHp(noOpTarget) / Math.max(1, preview.readHpMax(noOpTarget)) *
          actionQualityMultiplier(noOpTarget) *
          (1 - cancellationProbabilityAtOpportunity(noOpTarget, 1));
        const afterThreat =
          preview.readHp(afterTarget) / Math.max(1, preview.readHpMax(afterTarget)) *
          actionQualityMultiplier(afterTarget) *
          (1 - cancellationProbabilityAtOpportunity(afterTarget, 1));
        return 100 * Math.max(0, noOpThreat - afterThreat);
      }
      const effectiveRatio = unit =>
        (
          preview.readHp(unit) +
          preview.readShield(unit)
        ) / Math.max(1, preview.readHpMax(unit)) +
          0.25 * (1 - cancellationProbabilityAtOpportunity(unit, 1));
      return 100 * Math.max(0, effectiveRatio(afterTarget) - effectiveRatio(noOpTarget));
    };
    const targetCapacityDelta = targetIds.reduce(
      (sum, targetId) => sum + capacityDeltaForTarget(targetId),
      0,
    );
    const protectedTargetCapacityDelta = protectedTargetId
      ? capacityDeltaForTarget(protectedTargetId)
      : 0;
    const threatCapacityDelta = [...threatSourceIds].reduce((sum, targetId) => {
      const noOpTarget = findUnitInWorld(noOpSnapshot, targetId);
      const afterTarget = findUnitInWorld(afterSnapshot, targetId);
      if (!noOpTarget) return sum;
      if (!afterTarget || !preview.isBattleCapable(afterTarget)) {
        return sum + 100 * actionQualityMultiplier(noOpTarget);
      }
      const noOpThreat =
        preview.readHp(noOpTarget) / Math.max(1, preview.readHpMax(noOpTarget)) *
        actionQualityMultiplier(noOpTarget) *
        (1 - cancellationProbabilityAtOpportunity(noOpTarget, 1));
      const afterThreat =
        preview.readHp(afterTarget) / Math.max(1, preview.readHpMax(afterTarget)) *
        actionQualityMultiplier(afterTarget) *
        (1 - cancellationProbabilityAtOpportunity(afterTarget, 1));
      return sum + 100 * Math.max(0, noOpThreat - afterThreat);
    }, 0);
    const evidenceOutcomeKinds = [...new Set(contributions.filter(entry => {
      const targetId = String(entry?.targetId || '').trim();
      if (!targetIds.includes(targetId) && !threatSourceIds.has(targetId)) return false;
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const delta = contributionExpectedDelta(entry);
      if (problemId === 'IMMINENT_DENIAL') {
        return (
          outcomeKind === 'ACTION_CANCELLED' &&
          Boolean(String(entry?.windowId || '').trim())
        ) ||
          (outcomeKind === 'HP_DELTA' && delta < 0) ||
          outcomeKind === 'ACTION_GRANTED';
      }
      return (
        ['HP_DELTA', 'SHIELD_DELTA', 'RESOURCE_OPTION_CHANGED'].includes(outcomeKind) &&
        delta > 0
      ) || outcomeKind === 'ACTION_GRANTED';
    }).map(entry => String(entry?.outcomeKind || '').trim().toUpperCase()))];
    const responseUtilityDelta =
      Number(responseComparison?.candidateUtility || 0) -
      Number(responseComparison?.noOpUtility || 0);
    const catastrophicRiskReduction = Math.max(
      0,
      Number(responseComparison?.catastrophicRiskReduction || 0),
    );
    const terminalCompensation = Number(responseComparison?.terminalUtility || 0) > 0.0001;
    const objectiveCompensation = Number(responseComparison?.objectiveProgress || 0) > 0.0001;
    const threatSuppressed = contributions.some(entry => {
      const targetId = String(entry?.targetId || '').trim();
      if (!threatSourceIds.has(targetId)) return false;
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      return outcomeKind === 'ACTION_CANCELLED' &&
        Boolean(String(entry?.windowId || '').trim());
    });
    const materialityThreshold = Math.max(
      0.5,
      Number(crisis?.severity || 0) * 0.2,
    );
    const actionGranted = evidenceOutcomeKinds.includes('ACTION_GRANTED');
    const protectedThreatResolved = !!protectedTargetId &&
      threatSourceIds.size > 0 &&
      [...threatSourceIds].every(targetId => {
        const targetBefore = findUnitInWorld(noOpSnapshot, targetId);
        const targetAfter = findUnitInWorld(afterSnapshot, targetId);
        return !targetBefore ||
          !targetAfter ||
          !preview.isBattleCapable(targetAfter) ||
          hasActionCancellation(targetAfter);
      });
    const protectionRequired = !!protectedTargetId &&
      ['SURVIVAL_CRISIS', 'ALLY_CRISIS'].includes(problemId);
    const protectedTargetImproved =
      protectedTargetCapacityDelta + 0.0001 >= materialityThreshold;
    const protectedCrisisResolved = !protectionRequired ||
      protectedTargetImproved ||
      protectedThreatResolved ||
      terminalCompensation ||
      objectiveCompensation;
    const materialRealizedDelta = Math.max(
      targetCapacityDelta,
      threatCapacityDelta,
      catastrophicRiskReduction,
      Math.max(0, responseUtilityDelta),
      terminalCompensation ? 100 : 0,
      objectiveCompensation ? 100 : 0,
      threatSuppressed ? materialityThreshold : 0,
      actionGranted ? materialityThreshold : 0,
    );
    const materialCrisisDelta =
      (targetMatch || threatMatch) &&
      (problemId !== 'IMMINENT_DENIAL' || threatMatch || targetIds.includes(actorId)) &&
      protectedCrisisResolved &&
      materialRealizedDelta + 0.0001 >= materialityThreshold;
    const responsibilityEvidence = [
      protectedTargetImproved ? 'PROTECTED_CAPACITY_IMPROVED' : '',
      !protectionRequired && threatCapacityDelta + 0.0001 >= materialityThreshold
        ? 'THREAT_CAPACITY_REDUCED'
        : '',
      protectedThreatResolved ? 'ALL_PROTECTED_THREATS_RESOLVED' : '',
      catastrophicRiskReduction + 0.0001 >= materialityThreshold ? 'CATASTROPHIC_RISK_REDUCED' : '',
      threatSuppressed ? 'EXACT_THREAT_OPPORTUNITY_DENIED' : '',
      actionGranted ? 'PROTECTION_WINDOW_GRANTED' : '',
      terminalCompensation ? 'TERMINAL_COMPENSATION' : '',
      objectiveCompensation ? 'OBJECTIVE_COMPENSATION' : '',
    ].filter(Boolean);
    const responsibilityReason = materialCrisisDelta
      ? responsibilityEvidence[0] || 'CRISIS_DELTA_REALIZED'
      : targetMatch || threatMatch
        ? 'TARGET_MATCH_WITHOUT_CRISIS_REDUCTION'
        : 'NO_MATERIAL_CRISIS_REDUCTION';
    return Object.freeze({
      required: true,
      applicable: true,
      responsibleForCrisis: materialCrisisDelta,
      reasonCode: responsibilityReason,
      responsibilityEvidence: Object.freeze(responsibilityEvidence),
      problemId,
      targetIds: Object.freeze(targetIds),
      threatSourceIds: Object.freeze([...threatSourceIds]),
      responseUtilityDelta,
      targetCapacityDelta,
      protectedTargetId,
      protectedTargetCapacityDelta,
      protectedTargetImproved,
      protectedThreatResolved,
      protectedCrisisResolved,
      threatCapacityDelta,
      catastrophicRiskReduction,
      terminalCompensation,
      objectiveCompensation,
      materialityThreshold,
      materialRealizedDelta,
      threatSuppressed,
      actionGranted,
      realized: materialCrisisDelta,
      evidenceOutcomeKinds: Object.freeze(evidenceOutcomeKinds),
      actionKind: candidateActionKind,
      beforeWorldRevision: worldRevisionFor(beforeSnapshot),
    });
  }

  function hasMaterialCrisisCompensation(crisis = {}) {
    if (
      String(crisis?.protectedTargetId || '').trim() &&
      crisis?.protectedCrisisResolved === false
    ) return false;
    return Number(crisis?.targetCapacityDelta || 0) > 0.01 ||
      Number(crisis?.threatCapacityDelta || 0) > 0.01 ||
      Number(crisis?.catastrophicRiskReduction || 0) > 0.01 ||
      crisis?.threatSuppressed === true ||
      crisis?.actionGranted === true;
  }

  function crisisAlternativeAudit(candidate = {}, candidates = []) {
    const crisis = candidate?.crisisResponseAudit || {};
    if (crisis.required !== true) {
      return Object.freeze({
        applicable: false,
        status: 'NO_CRISIS',
        alternativeCandidateId: '',
        alternativeUtility: 0,
        utilityGap: 0,
        reasonCode: 'NOT_APPLICABLE',
        reasonEvidence: Object.freeze([]),
      });
    }
    if (crisis.realized === true) {
      return Object.freeze({
        applicable: true,
        status: 'SELECTED_CRISIS_REALIZED',
        alternativeCandidateId: '',
        alternativeUtility: 0,
        utilityGap: 0,
        reasonCode: 'CRISIS_RESPONSE_REALIZED',
        reasonEvidence: Object.freeze([{
          kind: 'CRISIS_RESPONSE',
          value: String(crisis.problemId || '').trim(),
        }]),
      });
    }
    const alternative = candidates
      .filter(other =>
        other !== candidate &&
        !other?.rejectionCode &&
        other?.crisisResponseAudit?.required === true &&
        other?.crisisResponseAudit?.realized === true
      )
      .sort((left, right) =>
        Number(right?.objectiveUtility || 0) - Number(left?.objectiveUtility || 0) ||
        String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
      )[0] || null;
    if (!alternative) {
      return Object.freeze({
        applicable: true,
        status: 'NO_REALIZABLE_ALTERNATIVE',
        alternativeCandidateId: '',
        alternativeUtility: 0,
        utilityGap: 0,
        reasonCode: 'NO_REALIZABLE_ALTERNATIVE',
        reasonEvidence: Object.freeze([]),
      });
    }
    const candidateVector = candidate?.vector || {};
    const alternativeVector = alternative?.vector || {};
    const evidence = [];
    const candidateTerminal = Number(candidateVector?.terminalUtility || 0);
    const alternativeTerminal = Number(alternativeVector?.terminalUtility || 0);
    const candidateProgress = Number(candidateVector?.objectiveProgress || 0);
    const alternativeProgress = Number(alternativeVector?.objectiveProgress || 0);
    const candidateRiskReduction = Number(candidateVector?.catastrophicRiskReduction || 0);
    const alternativeRiskReduction = Number(alternativeVector?.catastrophicRiskReduction || 0);
    const candidateSurvival = Number(candidateVector?.survivalLowerBound || 0);
    const alternativeSurvival = Number(alternativeVector?.survivalLowerBound || 0);
    const candidateResource = Number(candidateVector?.resourceContinuity || 0);
    const alternativeResource = Number(alternativeVector?.resourceContinuity || 0);
    const protectedTargetPriorityRequired =
      String(crisis?.protectedTargetId || '').trim() &&
      crisis?.protectedCrisisResolved === false;
    let reasonCode = 'NO_STRUCTURED_REASON';
    if (candidate?.playerLocked === true || candidate?.selectionMode === 'PLAYER_LOCKED') {
      reasonCode = 'PLAYER_LOCKED';
      evidence.push({ kind: 'SELECTION_MODE', value: 'PLAYER_LOCKED' });
    } else if (
      candidateTerminal > alternativeTerminal + 0.0001 ||
      candidateProgress > alternativeProgress + 0.0001
    ) {
      reasonCode = 'TERMINAL_OR_DEADLINE_PRIORITY';
      evidence.push({
        kind: 'TERMINAL_UTILITY',
        value: candidateTerminal,
        alternativeValue: alternativeTerminal,
      });
      evidence.push({
        kind: 'OBJECTIVE_PROGRESS',
        value: candidateProgress,
        alternativeValue: alternativeProgress,
      });
    } else if (candidateRiskReduction > alternativeRiskReduction + 0.0001) {
      reasonCode = 'RISK_REDUCTION_PRIORITY';
      evidence.push({
        kind: 'CATASTROPHIC_RISK_REDUCTION',
        value: candidateRiskReduction,
        alternativeValue: alternativeRiskReduction,
      });
    } else if (candidateSurvival > alternativeSurvival + 0.0001) {
      reasonCode = 'SURVIVAL_PRIORITY';
      evidence.push({
        kind: 'SURVIVAL_LOWER_BOUND',
        value: candidateSurvival,
        alternativeValue: alternativeSurvival,
      });
    } else if (candidateResource > alternativeResource + 0.0001) {
      reasonCode = 'RESOURCE_CONTINUITY_PRIORITY';
      evidence.push({
        kind: 'RESOURCE_CONTINUITY',
        value: candidateResource,
        alternativeValue: alternativeResource,
      });
    } else if (protectedTargetPriorityRequired) {
      reasonCode = 'PROTECTED_TARGET_PRIORITY';
      evidence.push({
        kind: 'PROTECTED_TARGET',
        value: String(crisis.protectedTargetId || '').trim(),
        alternativeValue: String(alternative?.candidateId || '').trim(),
      });
    } else if (Number(candidate?.objectiveUtility || 0) >= Number(alternative?.objectiveUtility || 0) - 0.05) {
      reasonCode = 'OBJECTIVE_UTILITY_PRIORITY';
      evidence.push({
        kind: 'OBJECTIVE_UTILITY',
        value: Number(candidate?.objectiveUtility || 0),
        alternativeValue: Number(alternative?.objectiveUtility || 0),
      });
    }
    const unjustified =
      reasonCode === 'NO_STRUCTURED_REASON' ||
      (
        protectedTargetPriorityRequired &&
        reasonCode === 'PROTECTED_TARGET_PRIORITY'
      );
    return Object.freeze({
      applicable: true,
      status: unjustified ? 'UNJUSTIFIED' : 'JUSTIFIED_TRADEOFF',
      alternativeCandidateId: String(alternative?.candidateId || '').trim(),
      alternativeUtility: Number(alternative?.objectiveUtility || 0),
      utilityGap:
        Number(candidate?.objectiveUtility || 0) -
        Number(alternative?.objectiveUtility || 0),
      reasonCode,
      reasonEvidence: Object.freeze(evidence.map(item => Object.freeze({ ...item }))),
    });
  }

  function riskCompensationAudit(candidate = {}) {
    const vector = candidate?.vector || {};
    const terminalEvidence = candidate?.terminalEvidence || {};
    const crisis = candidate?.crisisResponseAudit || {};
    const repeated = candidate?.repeatedActionAudit || {};
    const costs = candidate?.declaration?.resourceCosts || candidate?.costs || {};
    const riskEvidence = [];
    if (Number(vector?.catastrophicRisk || 0) > 0.0001) {
      riskEvidence.push({
        kind: 'CATASTROPHIC_RISK',
        value: Number(vector.catastrophicRisk),
      });
    }
    if (Number(vector?.irreversibleAssetCost || 0) > 0.0001) {
      riskEvidence.push({
        kind: 'IRREVERSIBLE_ASSET_COST',
        value: Number(vector.irreversibleAssetCost),
      });
    }
    const paidResources = Object.entries(costs)
      .filter(([, value]) => Number.parseFloat(String(value ?? 0)) > 0)
      .map(([resource, value]) => ({
        resource: String(resource || '').trim(),
        value: String(value ?? '').trim(),
      }))
      .filter(entry => entry.resource);
    if (paidResources.length > 0) {
      riskEvidence.push({
        kind: 'RESOURCE_COST',
        resources: Object.freeze(paidResources.map(entry => Object.freeze(entry))),
      });
    }
    const compensationEvidence = [];
    if (terminalEvidence?.direct?.achieved === true || terminalEvidence?.response?.preventsFailure === true) {
      compensationEvidence.push({ kind: 'TERMINAL_OR_FAILURE_PREVENTION', value: true });
    }
    if (Number(vector?.terminalUtility || 0) > 0.0001) {
      compensationEvidence.push({ kind: 'TERMINAL_UTILITY', value: Number(vector.terminalUtility) });
    }
    if (Number(vector?.objectiveProgress || 0) > 0.0001) {
      compensationEvidence.push({ kind: 'OBJECTIVE_PROGRESS', value: Number(vector.objectiveProgress) });
    }
    if (Number(vector?.catastrophicRiskReduction || 0) > 0.0001) {
      compensationEvidence.push({
        kind: 'CATASTROPHIC_RISK_REDUCTION',
        value: Number(vector.catastrophicRiskReduction),
      });
    }
    if (hasMaterialCrisisCompensation(crisis)) {
      compensationEvidence.push({
        kind: 'CRISIS_RESPONSE',
        value: Math.max(
          Number(crisis.targetCapacityDelta || 0),
          Number(crisis.threatCapacityDelta || 0),
          Number(crisis.catastrophicRiskReduction || 0),
        ),
      });
    }
    if (
      repeated?.lifecycleWindowRealizable === true &&
      (
        Number(vector?.terminalUtility || 0) > 0.0001 ||
        Number(vector?.objectiveProgress || 0) > 0.0001 ||
        Number(vector?.catastrophicRiskReduction || 0) > 0.0001
      )
    ) {
      compensationEvidence.push({ kind: 'REALIZED_ACTION_WINDOW_WITH_OUTCOME', value: true });
    }
    if (crisis?.required === true && hasMaterialCrisisCompensation(crisis) && !compensationEvidence.some(
      evidence => evidence.kind === 'CRISIS_RESPONSE',
    )) {
      compensationEvidence.push({
        kind: 'CRISIS_RESPONSE_REALIZED',
        problemId: String(crisis.problemId || '').trim(),
        targetIds: Object.freeze([...(crisis.targetIds || [])]),
      });
    }
    const riskDetected = riskEvidence.length > 0;
    const compensated = compensationEvidence.length > 0;
    return Object.freeze({
      riskDetected,
      compensated,
      reasonCode: !riskDetected
        ? 'NO_COSTLY_TAIL'
        : compensated
          ? 'STRUCTURED_COMPENSATION_PRESENT'
          : 'NO_STRUCTURED_COMPENSATION',
      riskEvidence: Object.freeze(riskEvidence.map(item => Object.freeze({ ...item }))),
      compensationEvidence: Object.freeze(compensationEvidence.map(item => Object.freeze({ ...item }))),
    });
  }

  function publicFailureEvidence(worldSnapshot = {}, actor = {}, candidate = {}) {
    const actorIds = new Set([
      preview.unitId(actor),
      preview.unitName(actor),
      actor?.charKey,
      actor?.char_key,
    ].map(value => String(value || '').trim()).filter(Boolean));
    const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
    const routeName = String(candidateActionName(candidate) || '').trim();
    const routeKey = actionRouteKey(actionKind, routeName);
    const candidateTargets = new Set(
      (candidate?.declaration?.targetIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    if (!actorIds.size || !candidateTargets.size) return null;
    const events = (Array.isArray(worldSnapshot?.__battleEventLedger)
      ? worldSnapshot.__battleEventLedger
      : []
    ).filter(event => {
      const eventKind = String(event?.eventKind || '').trim();
      const eventActor = [
        event?.actorId,
        event?.actorName,
        event?.actor,
      ].map(value => String(value || '').trim()).filter(Boolean);
      if (!eventActor.some(value => actorIds.has(value))) return false;
      const eventTargets = [
        ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
        event?.targetId,
        event?.targetName,
      ].map(value => String(value || '').trim()).filter(Boolean);
      if (!eventTargets.some(value => candidateTargets.has(value))) return false;
      const result = String(
        event?.result ||
        event?.resultState ||
        event?.primaryOutcome ||
        event?.meta?.primaryOutcome ||
        event?.meta?.reasonCode ||
        '',
      ).trim().toLowerCase();
      const failedPublicResult =
        /miss|dodg|resist|immune|no[_ -]?effect|failed|blocked|invalid|未命中|闪避|抵抗|免疫|无效|失败/.test(result) ||
        ['failed_action', 'target_fail'].includes(eventKind) ||
        (
          ['state_apply', 'withdrawal_result'].includes(eventKind) &&
          !/success|applied|completed|成功|生效/.test(result)
        );
      if (!failedPublicResult) return false;
      const eventActionKind = String(event?.actionKind || event?.actionType || '').trim().toUpperCase();
      const eventActionName = String(
        event?.actionName ||
        event?.finalActionName ||
        event?.meta?.actionName ||
        '',
      ).trim();
      return actionRouteKey(eventActionKind, eventActionName) === routeKey;
    });
    if (events.length < 2) return null;
    const lastEvents = events.slice(-6);
    const failureSignal = clamp(
      0.35 + Math.max(0, lastEvents.length - 2) * 0.15,
      0,
      1,
    );
    return {
      source: 'PUBLIC_LEDGER_FAILURE',
      observations: lastEvents.length,
      baseProbability: 0.65,
      posterior: clamp(0.65 * (1 - failureSignal), 0.05, 0.65),
      failureSignal,
      eventIds: Object.freeze(lastEvents.map(event => String(event?.eventId || '').trim()).filter(Boolean)),
      targetIds: Object.freeze([...candidateTargets]),
      actionKind,
      actionName: routeName,
    };
  }

  function repeatedFailureResourceOpportunity(
    candidate = {},
    actor = {},
    beliefState = {},
    alternatives = [],
    decisionProblems = [],
    worldSnapshot = {},
  ) {
    const audit = candidate?.repeatedActionAudit || {};
    const failureObservations = (candidate?.mechanicObservations || [])
      .filter(observation =>
        ['命中判定', '状态施加', '撤离判定'].includes(
          String(observation?.effectPrototype || '').trim(),
        )
      );
    const mechanicFailureEvidence = failureObservations.reduce((best, observation) => {
      const exactKey = String(observation?.mechanicKey || '').trim();
      const adaptationKey = String(observation?.adaptationKey || '').trim();
      const observations = [...new Set([exactKey, adaptationKey].filter(Boolean))]
        .reduce((sum, key) =>
          sum + Math.max(0, Number(beliefState?.mechanics?.[key]?.observations || 0))
        , 0);
      const baseProbability = clamp(Number(observation?.estimatedProbability ?? 0), 0.05, 0.99);
      const posterior = clamp(mechanicPosteriorWithAdaptation({
        beliefState,
        mechanicKey: exactKey,
        adaptationKey,
        estimatedProbability: baseProbability,
        experience: observation?.experience,
      }), 0.05, 0.99);
      const failureSignal = observations >= 2 && posterior < baseProbability - 0.02
        ? clamp(
            (baseProbability - posterior) / Math.max(0.05, baseProbability) *
              clamp(observations / 2, 0, 1),
            0,
            1,
          )
        : 0;
      return failureSignal > Number(best?.failureSignal || 0)
        ? {
            mechanicKey: exactKey,
            adaptationKey,
            observations,
            baseProbability,
            posterior,
            failureSignal,
          }
        : best;
    }, null);
    const ledgerFailureEvidence = publicFailureEvidence(worldSnapshot, actor, candidate);
    const failureEvidence = mechanicFailureEvidence && ledgerFailureEvidence
      ? {
          ...mechanicFailureEvidence,
          source: 'MECHANIC_AND_PUBLIC_LEDGER',
          failureSignal: Math.max(
            Number(mechanicFailureEvidence.failureSignal || 0),
            Number(ledgerFailureEvidence.failureSignal || 0),
          ),
          eventIds: ledgerFailureEvidence.eventIds,
        }
      : mechanicFailureEvidence || ledgerFailureEvidence;
    if (!failureEvidence || !(failureEvidence.failureSignal > 0)) {
      return Object.freeze({
        applied: false,
        reason: 'NO_PUBLIC_FAILURE_ADAPTATION',
        penalty: 0,
        alternativeCandidateId: '',
        failureEvidence: failureEvidence || null,
      });
    }
    const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
    const targetIds = new Set(
      (candidate?.declaration?.targetIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const candidateCostRatio = normalizedCost(
      actor,
      candidate?.costs || candidate?.declaration?.resourceCosts || {},
    );
    if (![
      'BASIC_ATTACK',
      'RELEASE_SKILL',
      'USE_ITEM',
      'EQUIP',
      'DEFEND',
      'EVADE',
      'GUARD',
      'COUNTER',
      'OBSERVE',
      'WITHDRAW',
    ].includes(actionKind)) {
      return Object.freeze({
        applied: false,
        reason: 'ACTION_KIND_NOT_ADAPTABLE',
        penalty: 0,
        alternativeCandidateId: '',
        failureEvidence,
      });
    }
    const candidateRouteName = String(candidateActionName(candidate) || '').trim();
    const substitutes = alternatives
      .filter(other =>
        other &&
        other !== candidate &&
        !other.rejectionCode &&
        [
          'BASIC_ATTACK',
          'RELEASE_SKILL',
          'USE_ITEM',
          'EQUIP',
          'DEFEND',
          'EVADE',
          'GUARD',
          'COUNTER',
          'OBSERVE',
          'WITHDRAW',
        ].includes(
          String(other?.declaration?.actionKind || '').trim(),
        ) &&
        !(
          failureEvidence.source === 'PUBLIC_LEDGER_FAILURE' &&
          String(other?.declaration?.actionKind || '').trim().toUpperCase() === actionKind &&
          String(candidateActionName(other) || '').trim() === candidateRouteName &&
          JSON.stringify(
            [...new Set((other?.declaration?.targetIds || []).map(String).sort())],
          ) === JSON.stringify([...targetIds].sort())
        ) &&
        (
          Number(other?.atomicActionPotential || 0) > 0 ||
          [
            'DEFEND',
            'EVADE',
            'GUARD',
            'COUNTER',
            'OBSERVE',
            'WITHDRAW',
          ].includes(String(other?.declaration?.actionKind || '').trim())
        )
      )
      .sort((left, right) =>
        Number(right?.objectiveUtility || 0) - Number(left?.objectiveUtility || 0) ||
        normalizedCost(actor, left?.costs || left?.declaration?.resourceCosts || {}) -
          normalizedCost(actor, right?.costs || right?.declaration?.resourceCosts || {}) ||
        String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
      );
    const alternative = substitutes[0] || null;
    if (!alternative) {
      return Object.freeze({
        applied: false,
        reason: 'NO_FEASIBLE_ALTERNATIVE',
        penalty: 0,
        alternativeCandidateId: '',
        failureEvidence,
      });
    }
    const lifecycleReasons = new Set(audit.lifecycleWindowReasons || []);
    const controlReasons = Object.values(
      audit.controlWindowRealizability?.reasonsByTarget || {},
    ).flatMap(value => Array.isArray(value) ? value : []);
    const hasUrgentRealWindow =
      controlReasons.some(reason =>
        ['VISIBLE_CHARGE_INTERRUPTED', 'SURVIVAL_WINDOW'].includes(String(reason || '').trim())
      ) ||
      decisionProblems.some(problem =>
        ['TERMINAL_OPPORTUNITY', 'SURVIVAL_CRISIS', 'ALLY_CRISIS', 'IMMINENT_DENIAL'].includes(
          String(problem?.problemId || '').trim(),
        ) &&
        (
          Number(candidate?.terminalEvidence?.response?.utilityDelta || 0) > 0.0001 ||
          Number(candidate?.objectiveProgressAudit?.progressGain || 0) > 0.0001 ||
          (candidate?.predictedOutcomeEvidence || []).some(evidence =>
            ['HP_DELTA', 'SHIELD_DELTA', 'ACTION_CANCELLED'].includes(
              String(evidence?.outcomeKind || '').trim(),
            ) &&
            Math.abs(Number(evidence?.expectedDelta ?? evidence?.expectedValuePercent ?? 0)) > 0.0001 &&
            (
              !problem?.targetIds?.length ||
              problem.targetIds.includes(String(evidence?.targetId || '').trim())
            )
          )
        )
      );
    const makesDeadlineFeasible =
      candidate?.vector?.objectiveProgressAudit?.makesDeadlineFeasible === true ||
      candidate?.nextValueAudit?.objectiveProgressAudit?.makesDeadlineFeasible === true;
    const hasTerminalCompensation =
      candidate?.terminalEvidence?.direct?.achieved === true ||
      Number(candidate?.vector?.terminalUtility || 0) > 0 ||
      makesDeadlineFeasible;
    if (hasUrgentRealWindow || hasTerminalCompensation) {
      return Object.freeze({
        applied: false,
        reason: hasUrgentRealWindow ? 'URGENT_REALIZABLE_WINDOW' : 'TERMINAL_OR_DEADLINE_COMPENSATION',
        penalty: 0,
        alternativeCandidateId: String(alternative?.candidateId || '').trim(),
        alternativeUtility: Number(alternative?.objectiveUtility || 0),
        failureEvidence,
      });
    }
    const runwayAfter = Number(audit.resourceRunwayAfter);
    const runwayPressure = Number.isFinite(runwayAfter) && runwayAfter > 0
      ? 1 + 1 / Math.max(1, runwayAfter)
      : 1;
    const candidatePotential = Math.max(0, Number(candidate?.atomicActionPotential || 0));
    const alternativePotential = Math.max(1, Number(alternative?.atomicActionPotential || 0));
    const potentialRatio = candidatePotential / alternativePotential;
    const potentialProtection = potentialRatio >= 3
      ? 0.25
      : potentialRatio >= 2
        ? 0.65
        : 1;
    const utilityLead = Math.max(
      0,
      Number(candidate?.objectiveUtility || 0) - Number(alternative?.objectiveUtility || 0),
    );
    const evidencePenalty = failureEvidence.source === 'PUBLIC_LEDGER_FAILURE'
      ? clamp(
          1.5 +
          Math.max(0, Number(failureEvidence.observations || 2) - 2) * 1.25 +
          Math.min(4, utilityLead),
          0,
          12,
        )
      : 8 *
        candidateCostRatio *
        failureEvidence.failureSignal *
        runwayPressure *
        potentialProtection;
    const penalty = clamp(
      Math.max(
        evidencePenalty,
        Math.min(
          8,
          utilityLead + (
            potentialRatio >= 3 && candidateCostRatio <= 0.05
              ? 0
              : 0.02
          ),
        ),
      ),
      0,
      25,
    );
    return Object.freeze({
      applied: penalty > 0,
      reason: 'PUBLIC_FAILURE_WITH_FEASIBLE_TACTICAL_ALTERNATIVE',
      penalty,
      alternativeCandidateId: String(alternative?.candidateId || '').trim(),
      alternativeUtility: Number(alternative?.objectiveUtility || 0),
      candidateTargetIds: Object.freeze([...targetIds]),
      alternativeActionKind: String(alternative?.declaration?.actionKind || '').trim(),
      candidateCostRatio,
      runwayAfter: Number.isFinite(runwayAfter) ? runwayAfter : null,
      potentialRatio,
      failureEvidence,
    });
  }

  function explicitFiniteNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function contributionExpectedDelta(entry = {}) {
    const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
    const evidence = entry?.evidence || {};
    const canonicalDelta = explicitFiniteNumber(entry?.expectedDelta);
    if (canonicalDelta !== null) return canonicalDelta;
    const directDelta = explicitFiniteNumber(evidence?.delta);
    if (directDelta !== null) return directDelta;
    if (['HP_DELTA', 'SCHEDULED_HP_DELTA'].includes(outcomeKind)) {
      const expectedDamage = explicitFiniteNumber(evidence?.expectedDamage);
      if (expectedDamage !== null) return -Math.abs(expectedDamage);
    }
    if (['SHIELD_DELTA', 'RESOURCE_OPTION_CHANGED'].includes(outcomeKind)) {
      const current = explicitFiniteNumber(evidence?.current);
      const next = explicitFiniteNumber(evidence?.next);
      if (current !== null && next !== null) return next - current;
    }
    const changes = Array.isArray(evidence?.changes) ? evidence.changes : [];
    const changeDelta = changes.reduce((sum, change) => {
      const delta = explicitFiniteNumber(change?.delta);
      if (delta !== null) return sum + delta;
      const current = explicitFiniteNumber(change?.current);
      const next = explicitFiniteNumber(change?.next);
      return current !== null && next !== null ? sum + next - current : sum;
    }, 0);
    if (Math.abs(changeDelta) > 0.0001) return changeDelta;
    const entryDelta = explicitFiniteNumber(entry?.expectedDelta);
    return entryDelta !== null ? entryDelta : 0;
  }

  function hasMaterialStateMechanics(entry = {}) {
    const combatEffect = entry?.evidence?.combatEffect &&
      typeof entry.evidence.combatEffect === 'object'
      ? entry.evidence.combatEffect
      : {};
    const booleanKeys = [
      'skip_turn',
      'cannot_act',
      'cannot_react',
      'silence',
      'disarm',
      'blind',
      'resource_lock',
      'invincible',
      'super_armor',
    ];
    if (booleanKeys.some(key => combatEffect?.[key] === true)) return true;
    const additiveKeys = [
      'dot_damage',
      'dot_damage_ratio',
      'hit_bonus',
      'hit_penalty',
      'dodge_bonus',
      'dodge_penalty',
      'reaction_bonus',
      'reaction_penalty',
      'accuracy_bonus',
      'accuracy_penalty',
      'speed_bonus',
      'speed_penalty',
      'cast_speed_bonus',
      'cast_speed_penalty',
      'damage_bonus',
      'damage_reduction',
      'armor_pen',
      'heal_bonus',
      'heal_reduction',
      'cost_delta_ratio',
      'counter_attack_ratio',
      'lock_level',
      'locked_ratio',
    ];
    if (additiveKeys.some(key => Math.abs(Number(combatEffect?.[key] || 0)) > 0.0001)) return true;
    return ['received_damage_mult', 'damage_taken_mult'].some(key => {
      const value = explicitFiniteNumber(combatEffect?.[key]);
      return value !== null && Math.abs(value - 1) > 0.0001;
    });
  }

  function meaningfulPreviewEffect(result = null, stateEffects = [], targets = []) {
    const stateHasMarginalValue = stateEffects.some(effect =>
      targets.some(target => stateEffectHasMarginalValue(effect, target)));
    const nonStateMarginalValue = (result?.contributions || []).some(entry => {
      const evidence = entry?.evidence || {};
      if (['HP_DELTA', 'SCHEDULED_HP_DELTA'].includes(entry.outcomeKind)) {
        return Math.abs(contributionExpectedDelta(entry)) > 0.0001;
      }
      if (entry.outcomeKind === 'SHIELD_DELTA') {
        return Math.abs(contributionExpectedDelta(entry)) > 0.0001;
      }
      if (entry.outcomeKind === 'RESOURCE_OPTION_CHANGED') {
        return Math.abs(contributionExpectedDelta(entry)) > 0.0001 &&
          String(entry?.windowId || '').trim() !== 'ACTION_COST';
      }
      if (entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
        return Math.abs(contributionExpectedDelta(entry)) > 0.0001 ||
          Math.abs(Number(evidence.multiplier || 0)) > 0.0001 ||
          hasMaterialStateMechanics(entry);
      }
      if (entry.outcomeKind === 'STATE_CHANGED') {
        return evidence?.marginal !== false && hasMaterialStateMechanics(entry);
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
    const horizon = battleHorizonProfile(input, worldSnapshot);
    const futureRoundAvailable = duration > 1 && horizon.remainingRounds > 0;
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
      const target = findUnitInWorld(worldSnapshot, targetId);
      return target && sideOf(worldSnapshot, target) === actorSide;
    }) && pendingHostileActorIds.size > 0 && (
      combatEffect?.invincible === true ||
      combatEffect?.super_armor === true ||
      Number(combatEffect?.dodge_bonus || 0) > 0 ||
      Number(combatEffect?.damage_reduction || 0) > 0 ||
      Number(combatEffect?.received_damage_mult || 1) < 1
    );
    if (protectsFriendlyTarget) reasons.push('CURRENT_ROUND_RESPONSE');
    const hasDotTick = Math.max(0, Number(combatEffect?.dot_damage || 0)) > 0 ||
      Math.max(0, Number(combatEffect?.dot_damage_ratio || 0)) > 0;
    const hasActionQualityEffect = combatEffect?.skip_turn === true ||
      combatEffect?.cannot_act === true ||
      combatEffect?.super_armor === true ||
      combatEffect?.invincible === true ||
      [
        'dodge_bonus',
        'dodge_penalty',
        'lock_level',
        'damage_reduction',
        'received_damage_mult',
        'damage_taken_mult',
        'accuracy_bonus',
        'accuracy_penalty',
        'speed_bonus',
        'speed_penalty',
      ].some(key => Math.abs(Number(combatEffect?.[key] || 0)) > 0.0001);
    const futureTargetIds = normalizedTargetIds.filter(targetId => {
      const target = findUnitInWorld(worldSnapshot, targetId);
      return target && preview.isBattleCapable(target) && futureRoundAvailable;
    });
    if (futureTargetIds.length && hasDotTick) reasons.push('FUTURE_DOT_TICK');
    if (futureTargetIds.length && hasActionQualityEffect) reasons.push('FUTURE_NATURAL_OPPORTUNITY');
    return Object.freeze({
      stateName,
      duration,
      effectiveRounds: Number.isFinite(horizon.remainingRounds)
        ? Math.min(duration, horizon.remainingRounds + 1)
        : duration,
      targetIds: Object.freeze(normalizedTargetIds),
      reasons: Object.freeze([...new Set(reasons)]),
      realizable: reasons.length > 0,
    });
  }

  function temporalEffectWindowProfile(effect = {}, targetIds = [], input = {}, worldSnapshot = {}, actorSide = '') {
    const prototype = String(effect?.原型 || '').trim();
    const temporalPrototypes = new Set([
      '状态施加',
      '属性修正',
      '判定修正',
      '结算修正',
      '时窗修正',
      '位移执行',
    ]);
    if (!temporalPrototypes.has(prototype)) {
      return Object.freeze({
        prototype,
        stateName: '',
        targetIds: Object.freeze([]),
        reasons: Object.freeze([]),
        realizable: true,
        temporal: false,
      });
    }
    const explicitStateName = String(effect?.状态 || effect?.状态名称 || '').trim();
    const stateName = explicitStateName ||
      (prototype === '属性修正'
        ? `${(Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性])
            .map(value => String(value || '').trim())
            .filter(Boolean)
            .join('、') || '属性'}修正`
        : prototype === '判定修正'
          ? `${String(effect?.判定 || '判定').trim() || '判定'}判定修正`
          : String(effect?.判定 || prototype).trim());
    const duration = Math.max(1, Number(effect?.持续回合 || 1));
    const combatEffect = preview.deriveStateCombatEffect(effect);
    const horizon = battleHorizonProfile(input, worldSnapshot);
    const pendingNaturalActorIds = new Set(
      (input?.actionOpportunity?.pendingNaturalActorIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const pendingHostileActorIds = new Set(
      (input?.actionOpportunity?.pendingHostileActorIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const normalizedTargetIds = [...new Set(
      (targetIds || []).map(value => String(value || '').trim()).filter(Boolean),
    )];
    const reasons = [];
    const hasDotTick =
      Math.max(0, Number(combatEffect?.dot_damage || 0)) > 0 ||
      Math.max(0, Number(combatEffect?.dot_damage_ratio || 0)) > 0;
    const hasQualityEffect = prototype !== '状态施加' || Object.keys(combatEffect || {}).length > 0;
    const hasCurrentActionWindow = normalizedTargetIds.some(targetId =>
      pendingNaturalActorIds.has(targetId) &&
      (() => {
        const target = findUnitInWorld(worldSnapshot, targetId);
        return target && sideOf(worldSnapshot, target) !== actorSide;
      })(),
    );
    if (hasCurrentActionWindow && hasQualityEffect) reasons.push('TARGET_CURRENT_ROUND_ACTION');
    const hasControlEffect = combatEffect?.skip_turn === true ||
      combatEffect?.cannot_act === true ||
      combatEffect?.silence === true ||
      combatEffect?.disarm === true;
    if (
      hasControlEffect &&
      input?.actionOpportunity?.futureHostileResponseAllowed !== false &&
      normalizedTargetIds.some(targetId => {
        const target = findUnitInWorld(worldSnapshot, targetId);
        return target && sideOf(worldSnapshot, target) !== actorSide && preview.isBattleCapable(target);
      })
    ) reasons.push('CONTROL_RESPONSE_WINDOW');
    if (hasDotTick) reasons.push('SAME_ROUND_TICK');
    const protectsFriendlyTarget = normalizedTargetIds.some(targetId => {
      const target = findUnitInWorld(worldSnapshot, targetId);
      return target && sideOf(worldSnapshot, target) === actorSide;
    }) && pendingHostileActorIds.size > 0 && (
      combatEffect?.invincible === true ||
      combatEffect?.super_armor === true ||
      Number(combatEffect?.dodge_bonus || 0) > 0 ||
      Number(combatEffect?.damage_reduction || 0) > 0 ||
      Number(combatEffect?.received_damage_mult || 1) < 1 ||
      /闪避|防御|反应|受到伤害|伤害减免|霸体|无敌/.test(
        `${String(effect?.判定 || '').trim()} ${String(effect?.结算 || '').trim()} ${stateName}`,
      )
    );
    if (protectsFriendlyTarget) reasons.push('CURRENT_ROUND_RESPONSE');
    const futureRoundAvailable = duration > 1 && horizon.remainingRounds > 0;
    const futureTargetIds = normalizedTargetIds.filter(targetId => {
      const target = findUnitInWorld(worldSnapshot, targetId);
      return target && preview.isBattleCapable(target) && futureRoundAvailable;
    });
    if (futureTargetIds.length && hasQualityEffect) reasons.push('FUTURE_NATURAL_OPPORTUNITY');
    return Object.freeze({
      prototype,
      stateName,
      attribute: Array.isArray(effect?.属性)
        ? effect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、')
        : String(effect?.属性 || '').trim(),
      check: String(effect?.判定 || '').trim(),
      settlement: String(effect?.结算 || '').trim(),
      duration,
      effectiveRounds: Number.isFinite(horizon.remainingRounds)
        ? Math.min(duration, horizon.remainingRounds + 1)
        : duration,
      targetIds: Object.freeze(normalizedTargetIds),
      reasons: Object.freeze([...new Set(reasons)]),
      realizable: reasons.length > 0,
      temporal: true,
    });
  }

  function temporalProfileMatchesContribution(profile = {}, entry = {}) {
    if (!profile?.temporal) return false;
    const evidence = entry?.evidence || {};
    const targetId = String(entry?.targetId || '').trim();
    if (!targetId || !profile.targetIds.includes(targetId)) return false;
    if (String(evidence?.prototype || '').trim() !== profile.prototype) return false;
    const evidenceState = String(evidence?.state || evidence?.stateName || '').trim();
    if (profile.stateName && evidenceState && profile.stateName !== evidenceState) return false;
    if (profile.attribute && evidence.attribute && profile.attribute !== String(evidence.attribute).trim()) return false;
    if (profile.check && evidence.check && profile.check !== String(evidence.check).trim()) return false;
    if (profile.settlement && evidence.settlement && profile.settlement !== String(evidence.settlement).trim()) return false;
    return true;
  }

  function temporalAuditForCandidate(candidateEffects = [], targetIds = [], input = {}, worldSnapshot = {}, actorSide = '', contributions = []) {
    const profiles = candidateEffects
      .map(effect => temporalEffectWindowProfile(effect, targetIds, input, worldSnapshot, actorSide))
      .filter(profile => profile.temporal);
    const invalidProfiles = profiles.filter(profile => !profile.realizable);
    const invalidContributions = contributions.filter(entry =>
      invalidProfiles.some(profile => temporalProfileMatchesContribution(profile, entry)),
    );
    const validProfiles = profiles.filter(profile => profile.realizable);
    return Object.freeze({
      profiles: Object.freeze(profiles),
      invalidProfiles: Object.freeze(invalidProfiles),
      validProfiles: Object.freeze(validProfiles),
      invalidContributions: Object.freeze(invalidContributions),
      invalidContributionSet: new Set(invalidContributions),
      invalidTargetIds: new Set(invalidProfiles.flatMap(profile => profile.targetIds)),
    });
  }

  function writeAttributeValue(unit = {}, attribute = '', value = 0) {
    const aliases = {
      力量: ['str', '力量'],
      防御: ['def', '防御'],
      敏捷: ['agi', '敏捷'],
      魂力上限: ['sp_max', '魂力上限'],
      精神力上限: ['men_max', '精神力上限'],
      体力上限: ['vit_max', '体力上限'],
    };
    const keys = aliases[attribute] || [attribute];
    const next = Math.max(0, Number(value || 0));
    if (keys[0]) unit[keys[0]] = next;
    if (unit.属性 && typeof unit.属性 === 'object' && keys[1]) unit.属性[keys[1]] = next;
    if (unit.final && typeof unit.final === 'object' && keys[0] in unit.final) unit.final[keys[0]] = next;
  }

  function readAttributeValue(unit = {}, attribute = '') {
    const aliases = {
      力量: ['str', '力量'],
      防御: ['def', '防御'],
      敏捷: ['agi', '敏捷'],
      魂力上限: ['sp_max', '魂力上限'],
      精神力上限: ['men_max', '精神力上限'],
      体力上限: ['vit_max', '体力上限'],
    };
    const keys = aliases[attribute] || [attribute];
    return Number(
      unit?.[keys[0]] ??
      unit?.属性?.[keys[1]] ??
      unit?.属性?.[keys[0]] ??
      0,
    ) || 0;
  }

  function stateKeyEntries(unit = {}) {
    const states = unit?.状态效果;
    if (Array.isArray(states)) {
      return states.map((state, index) => [String(index), state]).filter(([, state]) => state && typeof state === 'object');
    }
    if (states && typeof states === 'object') {
      return Object.entries(states).filter(([, state]) => state && typeof state === 'object');
    }
    return [];
  }

  function removeUnrealizableTemporalEffects(snapshot = {}, baselineSnapshot = {}, temporalAudit = {}) {
    const invalidProfiles = Array.isArray(temporalAudit?.invalidProfiles)
      ? temporalAudit.invalidProfiles
      : [];
    if (!invalidProfiles.length) return snapshot;
    const validProfilesByTarget = new Map();
    (temporalAudit?.validProfiles || []).forEach(profile => {
      profile.targetIds.forEach(targetId => {
        const list = validProfilesByTarget.get(targetId) || [];
        list.push(profile);
        validProfilesByTarget.set(targetId, list);
      });
    });
    const invalidEntries = Array.isArray(temporalAudit?.invalidContributions)
      ? temporalAudit.invalidContributions
      : [];
    return mapWorldUnits(snapshot, (unit, side) => {
      const targetId = preview.unitId(unit);
      const targetProfiles = invalidProfiles.filter(profile => profile.targetIds.includes(targetId));
      if (!targetProfiles.length) return unit;
      const baselineUnit = findUnitInWorld(baselineSnapshot, targetId);
      const nextUnit = cloneValue(unit);
      const validForTarget = validProfilesByTarget.get(targetId) || [];
      const validNames = new Set(validForTarget.map(profile => profile.stateName).filter(Boolean));
      targetProfiles.forEach(profile => {
        if (profile.prototype === '属性修正') {
          invalidEntries
            .filter(entry => temporalProfileMatchesContribution(profile, entry) && entry.targetId === targetId)
            .flatMap(entry => Array.isArray(entry?.evidence?.changes) ? entry.evidence.changes : [entry?.evidence])
            .forEach(change => {
              const attribute = String(change?.attribute || profile.attribute || '').trim();
              const delta = Number(change?.delta || 0);
              if (!attribute || !Number.isFinite(delta)) return;
              const current = readAttributeValue(nextUnit, attribute);
              writeAttributeValue(nextUnit, attribute, current - delta);
            });
          return;
        }
        if (profile.prototype === '时窗修正') {
          if (baselineUnit) nextUnit.状态效果 = cloneValue(baselineUnit.状态效果 || {});
          return;
        }
        if (!profile.stateName || validNames.has(profile.stateName)) return;
        const baselineEntries = stateKeyEntries(baselineUnit || {});
        const baselineMatch = baselineEntries.find(([, state]) =>
          String(state?.状态 || state?.状态名称 || state?.名称 || '').trim() === profile.stateName,
        );
        const currentStates = stateKeyEntries(nextUnit);
        const replacementKey = currentStates.find(([key, state]) =>
          key.includes('preview:') &&
          String(state?.状态 || state?.状态名称 || state?.名称 || '').trim() === profile.stateName,
        )?.[0];
        if (baselineMatch) {
          nextUnit.状态效果 = {
            ...(nextUnit.状态效果 || {}),
            [baselineMatch[0]]: cloneValue(baselineMatch[1]),
          };
          if (replacementKey && replacementKey !== baselineMatch[0]) delete nextUnit.状态效果[replacementKey];
        } else if (replacementKey) {
          delete nextUnit.状态效果[replacementKey];
        }
      });
      return nextUnit;
    });
  }

  function reactionResponseAlreadyConsumed(worldSnapshot = {}, targetId = '', responseId = '') {
    const runtime = worldSnapshot?.__battleRuntime || {};
    if (Math.max(0, Number(runtime?.unitReactionCount?.[targetId] || 0)) > 0) return true;
    return runtime?.reactionResponseUses?.[targetId]?.[responseId] === true;
  }

  function markReactionResponseConsumed(worldSnapshot = {}, targetId = '', responseId = '') {
    if (!worldSnapshot || typeof worldSnapshot !== 'object' || !targetId || !responseId) return worldSnapshot;
    if (!worldSnapshot.__battleRuntime || typeof worldSnapshot.__battleRuntime !== 'object') {
      Object.defineProperty(worldSnapshot, '__battleRuntime', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: {},
      });
    }
    const runtime = worldSnapshot.__battleRuntime;
    runtime.reactionResponseUses = runtime.reactionResponseUses && typeof runtime.reactionResponseUses === 'object'
      ? runtime.reactionResponseUses
      : {};
    runtime.reactionResponseUses[targetId] = runtime.reactionResponseUses[targetId] &&
      typeof runtime.reactionResponseUses[targetId] === 'object'
      ? runtime.reactionResponseUses[targetId]
      : {};
    runtime.reactionResponseUses[targetId][responseId] = true;
    return worldSnapshot;
  }

  function knownReactionResponses(beliefState = {}, targetId = '', worldSnapshot = {}) {
    return (Array.isArray(beliefState?.publicResponses?.[targetId])
      ? beliefState.publicResponses[targetId]
      : []
    ).filter(response =>
      [
        String(response?.responseRole || '').trim().toUpperCase(),
        ...(Array.isArray(response?.responseRoles) ? response.responseRoles.map(role => String(role || '').trim().toUpperCase()) : []),
      ].includes('REACTION') &&
      response?.declaration &&
      typeof response.declaration === 'object' &&
      !reactionResponseAlreadyConsumed(
        worldSnapshot,
        targetId,
        String(response?.responseId || '').trim(),
      )
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
    const actorAfter = findUnitInWorld(result.afterSnapshot, actorId);
    if (!actorAfter || !preview.isAlive(actorAfter)) {
      return Object.freeze({
        entries: Object.freeze([]),
        totalExpectedThreat: 0,
        totalWorstTailThreat: 0,
      });
    }
    const entries = reactionAudit.map(reaction => {
      const targetId = String(reaction?.targetId || '').trim();
      const targetBefore = findUnitInWorld(decisionWorld, targetId);
      const targetAfter = findUnitInWorld(result.afterSnapshot, targetId);
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

  function candidateHitProbabilityResolver({
    beliefState,
    actor,
    candidate,
    worldSnapshot,
  }) {
    return ({ targetId, actor: damageActor, effect, effectInstanceId, baseHitProbability }) => {
      if (/:summon-assist(?::|$)/i.test(String(effectInstanceId || '').trim())) {
        return baseHitProbability;
      }
      const target = findUnitInWorld(worldSnapshot, targetId);
      if (!target) return baseHitProbability;
      const effectIndex = Number(
        String(effectInstanceId || '').match(/:effect:(\d+)$/)?.[1] || 0,
      );
      const factor = hitMechanicFactor(
        beliefState,
        damageActor || actor,
        target,
        effect,
        candidate.candidateId,
        effectIndex,
        candidate?.declaration?.actionKind || 'RELEASE_SKILL',
      );
      const resolvedProbability = Number(baseHitProbability || 0) * factor;
      if (resolvedProbability <= 0 || resolvedProbability >= 1) {
        return clamp(resolvedProbability, 0, 1);
      }
      return clamp(resolvedProbability, 0.05, 0.99);
    };
  }

  function candidateApplicationProbabilityResolver({
    beliefState,
    actor,
    candidate,
  }) {
    return ({ targetId, actor: stateActor, effect, effectInstanceId, baseApplicationProbability }) => {
      if (/:summon-assist(?::|$)/i.test(String(effectInstanceId || '').trim())) {
        return baseApplicationProbability;
      }
      const relevantFingerprint = relevantStateFingerprint(beliefState, targetId);
      const key = mechanicKey({
        sourceActionId: candidate.candidateId,
        effectPrototype: '状态施加',
        targetId,
        relevantStateFingerprint: relevantFingerprint,
        beliefState,
      });
      const adaptationKey = mechanicAdaptationKey({
        actionKind: candidate?.declaration?.actionKind || 'RELEASE_SKILL',
        effectPrototype: '状态施加',
        targetId,
        stateName: String(effect?.状态 || effect?.状态名称 || '').trim(),
        relevantStateFingerprint: relevantFingerprint,
      });
      const observations = [...new Set([key, adaptationKey])]
        .reduce((sum, recordKey) =>
          sum + Math.max(0, Number(beliefState?.mechanics?.[recordKey]?.observations || 0))
        , 0);
      if (!observations) return baseApplicationProbability;
      const posterior = mechanicPosteriorWithAdaptation({
        beliefState,
        mechanicKey: key,
        adaptationKey,
        estimatedProbability: baseApplicationProbability,
        experience: experienceOf(stateActor || actor),
      });
      const firstEvidenceWeight = 0.6 + 0.3 * experienceOf(stateActor || actor);
      const evidenceWeight = 1 - Math.pow(1 - firstEvidenceWeight, observations);
      return clamp(
        Number(baseApplicationProbability || 0) +
          (posterior - Number(baseApplicationProbability || 0)) * evidenceWeight,
        0,
        1,
      );
    };
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
    const basePreview = (worldSnapshot, damageMultiplierByTarget = {}) => {
      const result = preview.previewAction({
        worldSnapshot,
        worldRevision: `next:${worldRevisionFor(worldSnapshot)}`,
        beliefSnapshot: beliefState,
        beliefRevision: beliefRevisionFor(beliefState),
        actorId: preview.unitId(actor),
        declaration: candidate.declaration,
        actionFingerprint: `next:${candidate.candidateId}`,
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
        hitProbabilityResolver: candidateHitProbabilityResolver({
          beliefState,
          actor,
          candidate,
          worldSnapshot,
        }),
        applicationProbabilityResolver: candidateApplicationProbabilityResolver({
          beliefState,
          actor,
          candidate,
        }),
        damageMultiplierResolver: ({ targetId, actor: damageActor, effect, effectInstanceId }) => {
          const explicitMultiplier = Number(damageMultiplierByTarget[targetId] ?? 1);
          const isDeferredAssist = /:summon-assist(?::|$)/i.test(String(effectInstanceId || '').trim());
          const realizationMultiplier = isDeferredAssist
            ? targetRealizationFactor(beliefState, damageActor, targetId, [effect])
            : Number(realizationMultiplierByTarget[targetId] ?? 1);
          return clamp(explicitMultiplier * realizationMultiplier, 0, 4);
        },
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
      .map(targetId => findUnitInWorld(decisionWorld, targetId))
      .filter(target =>
      target &&
        sideOf(decisionWorld, target) !== actorSide
      );
    if (!hostileTargets.length) return basePreview(decisionWorld);
    let reactionWorld = decisionWorld;
    const damageMultiplierByTarget = {};
    const reactionAudit = [];
    hostileTargets.forEach(targetBefore => {
      const targetId = preview.unitId(targetBefore);
      const responses = knownReactionResponses(beliefState, targetId, reactionWorld);
      if (!responses.length) return;
      const target = findUnitInWorld(reactionWorld, targetId);
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
            const reactionActor = findUnitInWorld(planWorld, targetId);
            if (!reactionActor || !declaration.skill || !costAffordable(reactionActor, declaration.skill)) return;
            reactionPreview = preview.previewAction({
              worldSnapshot: planWorld,
              worldRevision: `reaction:${worldRevisionFor(planWorld)}`,
              beliefSnapshot: beliefState,
              beliefRevision: beliefRevisionFor(beliefState),
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
          const attackPreview = basePreview(planWorld, multipliers);
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
      reactionWorld = selectedPlan.reactionWorld;
      if (String(selectedPlan.declaration?.actionKind || '').trim().toUpperCase() === 'RELEASE_SKILL') {
        markReactionResponseConsumed(
          reactionWorld,
          targetId,
          String(selectedPlan.response?.responseId || '').trim(),
        );
      }
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
    const result = basePreview(reactionWorld, damageMultiplierByTarget);
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
      .map(targetId => findUnitInWorld(candidateSnapshot, targetId))
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
      ;
    if (!exploiters.length) return null;
    let candidateWorld = candidateSnapshot;
    let noOpWorld = decisionWorld;
    const actions = [];
    exploiters.forEach(({ unit, action }, index) => {
      const candidateTarget = findUnitInWorld(candidateWorld, targetId);
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
        const branchActor = findUnitInWorld(worldSnapshot, actorId);
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
    // A multi-actor reaction sequence has two independent counterfactual
    // branches. Flatten both branches back to the same decision root so the
    // incremental capacity cache cannot compare one branch against the other.
    const sequenceChangedUnitIds = [
      preview.unitId(actor),
      targetId,
      ...actions.map(action => action.actorId),
    ];
    markCapacityDeltaSnapshot(candidateWorld, decisionWorld, sequenceChangedUnitIds);
    markCapacityDeltaSnapshot(noOpWorld, decisionWorld, sequenceChangedUnitIds);
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
        ...input?.actionOpportunity,
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
          .map(targetId => findUnitInWorld(futureWorld, targetId))
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
    const futureActor = findUnitInWorld(futureWorld, actorId);
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
    const visibleWorldSnapshot = input?.visibleWorldSnapshot || worldSnapshot;
    const sourceActor = findUnitInWorld(worldSnapshot, input?.actorId || '');
    if (!worldSnapshot || !sourceActor || !preview.isAlive(sourceActor)) throw new Error('battle_next_value_context_invalid');
    const beliefState = input?.__preparedBeliefState || buildInitialBelief(worldSnapshot, preview.unitId(sourceActor), input?.beliefState || {});
    const decisionWorld = input?.__preparedDecisionWorld === true
      ? worldSnapshot
      : buildDecisionWorld(worldSnapshot, preview.unitId(sourceActor), beliefState);
    const actor = findUnitInWorld(decisionWorld, preview.unitId(sourceActor));
    const actorSide = sideOf(decisionWorld, actor);
    input = {
      ...input,
      battleIntent: actorBattleIntent(decisionWorld, actorSide, input?.battleIntent),
    };
    const valueContext = buildNextValueContext(decisionWorld, actorSide, beliefState);
    const before = stateUtilityNext(decisionWorld, actorSide, beliefState, valueContext);
    const actorObjectives = objectiveActorContext(decisionWorld, actorSide, input?.battleIntent || {});
    const offensiveGoalConditions = actorObjectives.successConditions.filter(condition =>
      ['HP_RATIO_AT_OR_BELOW', 'TEAM_INCAPACITATED', 'UNIT_INCAPACITATED', 'TEAM_DEAD', 'UNIT_DEAD'].includes(condition.type)
    );
    const decisionProblems = [
      ...(Array.isArray(input?.problems)
        ? input.problems
        : identifyProblems(decisionWorld, preview.unitId(actor), beliefState, {
            battleIntent: input?.battleIntent || {},
          })),
    ];
    const strategyDegeneration = detectStrategyDegeneration(input?.strategicHistory);
    if (strategyDegeneration) {
      decisionProblems.push({
        problemId: 'STALEMATE',
        severity: 1,
        evidence: strategyDegeneration,
      });
    }
    const teamIntent = input?.teamIntent && Object.keys(input.teamIntent).length
      ? input.teamIntent
      : buildTeamIntent(
          decisionWorld,
          preview.unitId(actor),
          beliefState,
          input?.battleIntent || {},
        );
    const hasExplicitCounterPlan = collectSkills(actor).some(skill => isExplicitCounterSkill(skill, 40));
    const activeNaturalOpportunity =
      String(input?.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase() === 'ACTIVE' &&
      input?.actionOpportunity?.counterWindow !== true;
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
    const baselineResponseOutcomeCache = new WeakMap();
    const candidates = Array.isArray(input?.__frozenCandidates) ? input.__frozenCandidates : enumerateCandidates({
      ...input,
      worldSnapshot: decisionWorld,
      actorId: preview.unitId(actor),
      beliefState,
    });
    const scored = candidates.map(candidate => {
      const effectTargetAudit = candidateEffectTargetAudit(candidate, decisionWorld, actor);
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
      const candidateRootActionId = String(
        candidate?.declaration?.actionId ||
        candidate?.candidateId ||
        '',
      ).trim();
      const candidateContributions = (result?.contributions || []).filter(entry => {
        const rootCauseId = String(entry?.rootCauseId || '').trim();
        const sourceActionId = String(entry?.sourceActionId || '').trim();
        const rootOwned = rootCauseId === candidateRootActionId ||
          rootCauseId.startsWith(`${candidateRootActionId}:`);
        const sourceOwned = !sourceActionId ||
          sourceActionId === candidateRootActionId ||
          sourceActionId.startsWith(`${candidateRootActionId}:`);
        return rootOwned && sourceOwned;
      });
      const candidateEffects = preview.collectEffects(
        candidate?.skill || candidate?.declaration?.skill || {},
      );
      const candidateTargetIds = candidate?.declaration?.targetIds || [];
      const temporalAudit = temporalAuditForCandidate(
        candidateEffects,
        candidateTargetIds,
        input,
        decisionWorld,
        actorSide,
        candidateContributions,
      );
      const temporalValueContributions = candidateContributions.filter(entry =>
        !temporalAudit.invalidContributionSet.has(entry),
      );
      const candidatePreview = result
        ? Object.freeze({
            ...result,
            contributions: Object.freeze(candidateContributions),
          })
        : result;
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
      candidateSnapshot = removeUnrealizableTemporalEffects(
        candidateSnapshot,
        decisionWorld,
        temporalAudit,
      );
      let noOpSnapshot = decisionWorld;
      let immediateCounterTailSnapshot = immediateCounterRisk.totalWorstTailThreat > 0
        ? snapshotAfterResponseThreat(afterSnapshot, preview.unitId(actor), immediateCounterRisk.totalWorstTailThreat)
        : candidateSnapshot;
      immediateCounterTailSnapshot = removeUnrealizableTemporalEffects(
        immediateCounterTailSnapshot,
        decisionWorld,
        temporalAudit,
      );
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
        result: candidatePreview,
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
      const resourceOnlySnapshot = snapshotWithUnitResourcesFrom(
        noOpSnapshot,
        candidateSnapshot,
        actorId,
      );
      const resourceContinuityCapacityOptions = {
        ...controlCapacityOptions,
        // Isolate the action's own resource runway from previously observed
        // enemy resource pressure, which can otherwise drive both branches to
        // the same post-threat resource floor.
        resourceThreatProfile: {},
      };
      const resourceCandidateCapacity = stateUtilityNext(
        resourceOnlySnapshot,
        actorSide,
        beliefState,
        valueContext,
        resourceContinuityCapacityOptions,
      );
      const resourceBaselineCapacity = stateUtilityNext(
        noOpSnapshot,
        actorSide,
        beliefState,
        valueContext,
        resourceContinuityCapacityOptions,
      );
      const resourceContinuityCapacityDelta =
        Number(resourceCandidateCapacity.own || 0) - Number(resourceBaselineCapacity.own || 0);
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
      const mechanicObservations = buildMechanicObservations(
        candidate,
        actor,
        decisionWorld,
        beliefState,
        withdrawalEstimate,
        withdrawalProfile?.targetId || '',
      );
      const withdrawalProbability = clamp(
        Number(
          mechanicObservations.find(observation => observation?.effectPrototype === '撤离判定')?.posterior ??
          withdrawalEstimate?.successProbability ??
          0,
        ),
        0,
        1,
      );
      const activeDefenseStance = actor?.__battleRuntime?.activeDefenseStance;
      const existingDefenseKind = String(
        activeDefenseStance?.type ||
        activeDefenseStance?.actionKind ||
        '',
      ).trim().toUpperCase();
      const candidateDefenseKind = ['DEFEND', 'EVADE', 'GUARD'].includes(actionKind) ? actionKind : '';
      const defenseRefreshBlocked =
        ['DEFEND', 'EVADE'].includes(actionKind) &&
        !!existingDefenseKind &&
        activeDefenseStance?.consumed !== true;
      const effectiveCandidateDefenseKind = defenseRefreshBlocked ? '' : candidateDefenseKind;
      const branchMass = clamp(sharedResponseBranches.reduce((sum, branch) => sum + Number(branch?.probability || 0), 0), 0, 1);
      const afterTerminalUtility = nextIntentTerminalUtility(decisionWorld, candidateSnapshot, actorSide, responseContext);
      const afterProgress = nextIntentProgressUtility(decisionWorld, candidateSnapshot, actorSide, responseContext);
      const beforeTerminalUtility = nextIntentTerminalUtility(decisionWorld, noOpSnapshot, actorSide, responseContext);
      const beforeProgress = nextIntentProgressUtility(decisionWorld, noOpSnapshot, actorSide, responseContext);
      const progressValue = profile => Number(
        profile?.goalUtility ?? profile?.utility ?? 0,
      );
      const candidateProgressValue = progressValue(afterProgress);
      const noOpProgressValue = progressValue(beforeProgress);
      const representedCapacityGain = 100 *
        (after.utility - noOp.utility) /
        Math.max(1, before.total);
      const objectiveProgressAudit = Object.freeze({
        candidateUtility: candidateProgressValue,
        noOpUtility: noOpProgressValue,
        progressGain: Math.max(0, candidateProgressValue - noOpProgressValue),
        requiredProgress: Number(afterProgress.requiredProgress || beforeProgress.requiredProgress || 0),
        deadlineActive: afterProgress.deadlineActive === true,
        deadlineFeasible: afterProgress.deadlineFeasible !== false,
        noOpDeadlineFeasible: beforeProgress.deadlineFeasible !== false,
        makesDeadlineFeasible:
          afterProgress.deadlineActive === true &&
          afterProgress.deadlineFeasible !== false &&
          beforeProgress.deadlineFeasible === false,
        nonDuplicatedProgressGain: nonDuplicatedObjectiveProgressValue(
          beforeProgress,
          afterProgress,
          representedCapacityGain,
        ),
        source: String(afterProgress.source || 'OBJECTIVE_PROGRESS_AUDIT').trim(),
      });
      const nonDuplicatedObjectiveProgress = nonDuplicatedObjectiveProgressValue(
        beforeProgress,
        afterProgress,
        representedCapacityGain,
      );
      let responseComparison = sharedResponseBranches.reduce((totals, branch, branchIndex) => {
        const probability = Math.max(0, Number(branch?.probability || 0));
        const sourceBefore = findUnitInWorld(decisionWorld, branch?.sourceActorId || '');
        const sourceAfter = findUnitInWorld(candidateSnapshot, branch?.sourceActorId || '');
        const sourceNoOp = findUnitInWorld(noOpSnapshot, branch?.sourceActorId || '');
        const sourceId = String(branch?.sourceActorId || '').trim();
        const responsePrevented = !!sourceBefore && (
          !sourceAfter ||
          !preview.isBattleCapable(sourceAfter) ||
          (!unrealizableControlTargets.has(sourceId) && hasActionCancellation(sourceAfter))
        );
        const baselineResponsePrevented = !!sourceBefore &&
          (!sourceNoOp || !preview.isBattleCapable(sourceNoOp) || hasActionCancellation(sourceNoOp));
        const ordinaryDefenseMultiplier = sourceBefore
          ? preview.calculateDefenseDamageMultiplier(actor, sourceBefore, false)
          : 1;
        const ordinaryDodgeProbability = sourceBefore
          ? preview.calculateDodgeProbability(actor, sourceBefore, false)
          : 0;
        const ordinaryDodgeMultiplier = 1 - ordinaryDodgeProbability;
        const ordinaryReactionKind = ordinaryDodgeMultiplier < ordinaryDefenseMultiplier
          ? 'EVADE'
          : 'DEFEND';
        const preparedMultiplier = kind => {
          if (!sourceBefore) return 1;
          if (['DEFEND', 'GUARD'].includes(kind)) {
            return preview.calculateDefenseDamageMultiplier(actor, sourceBefore, true);
          }
          if (kind === 'EVADE') return 1 - preview.calculateDodgeProbability(actor, sourceBefore, true);
          return Math.min(ordinaryDefenseMultiplier, ordinaryDodgeMultiplier);
        };
        const baselineStanceAvailable =
          !!existingDefenseKind &&
          totals.baselinePreparedConsumed !== true &&
          !baselineResponsePrevented &&
          probability > 0;
        const baselineDefenseKind = baselineStanceAvailable ? existingDefenseKind : ordinaryReactionKind;
        const baselinePrepared = baselineStanceAvailable;
        const baselineDefenseMultiplier = baselinePrepared
          ? preparedMultiplier(baselineDefenseKind)
          : Math.min(ordinaryDefenseMultiplier, ordinaryDodgeMultiplier);
        const candidateStanceAvailable =
          !!effectiveCandidateDefenseKind &&
          totals.candidatePreparedConsumed !== true &&
          !responsePrevented &&
          probability > 0;
        const candidateEffectiveDefenseKind = candidateStanceAvailable
          ? effectiveCandidateDefenseKind
          : baselineDefenseKind;
        const candidatePrepared = candidateStanceAvailable || baselinePrepared;
        const candidateDefenseMultiplier = candidatePrepared
          ? preparedMultiplier(candidateEffectiveDefenseKind)
          : baselineDefenseMultiplier;
        const candidateResponseQuality = sourceAfter ? actionQualityMultiplier(sourceAfter) : 0;
        const baselineResponseQuality = sourceNoOp ? actionQualityMultiplier(sourceNoOp) : 0;
        const weightedUtility = (success, failure, successProbability) => {
          const probability = clamp(successProbability, 0, 1);
          const failureProbability = 1 - probability;
          return Object.freeze({
            own: probability * success.own + failureProbability * failure.own,
            enemy: probability * success.enemy + failureProbability * failure.enemy,
            total: probability * success.total + failureProbability * failure.total,
            utility: probability * success.utility + failureProbability * failure.utility,
            nonDuplicatedGoalProgress:
              probability * Number(success.nonDuplicatedGoalProgress || 0) +
              failureProbability * Number(failure.nonDuplicatedGoalProgress || 0),
          });
        };
        const evaluateResponseOutcome = ({
          baseSnapshot,
          tailSnapshot = null,
          defenseKind,
          prepared,
          prevented,
          responseQuality,
          defenseMultiplier,
          capacityOptions = {},
        }) => {
          const rawThreat = prevented
            ? 0
            : Math.max(0, Number(branch?.rawThreat || 0)) * Math.max(0, Number(responseQuality || 0));
          const dodgeProbability = defenseKind === 'EVADE' && sourceBefore && !prevented
            ? preview.calculateDodgeProbability(actor, sourceBefore, prepared)
            : 0;
          if (dodgeProbability > 0) {
            const hitSnapshot = snapshotAfterResponseThreat(baseSnapshot, preview.unitId(actor), rawThreat);
            const successUtility = stateUtilityNext(
              baseSnapshot,
              actorSide,
              beliefState,
              valueContext,
              capacityOptions,
            );
            const failureUtility = stateUtilityNext(
              hitSnapshot,
              actorSide,
              beliefState,
              valueContext,
              capacityOptions,
            );
            const responseUtility = weightedUtility(successUtility, failureUtility, dodgeProbability);
            const tailHitSnapshot = tailSnapshot
              ? snapshotAfterResponseThreat(tailSnapshot, preview.unitId(actor), rawThreat)
              : hitSnapshot;
            const tailSuccessUtility = tailSnapshot
              ? stateUtilityNext(tailSnapshot, actorSide, beliefState, valueContext, capacityOptions)
              : successUtility;
            const tailFailureUtility = tailSnapshot
              ? stateUtilityNext(tailHitSnapshot, actorSide, beliefState, valueContext, capacityOptions)
              : failureUtility;
            const tailUtility = weightedUtility(tailSuccessUtility, tailFailureUtility, dodgeProbability);
            const terminalUtility =
              dodgeProbability * nextIntentTerminalUtility(decisionWorld, baseSnapshot, actorSide, responseContext) +
              (1 - dodgeProbability) * nextIntentTerminalUtility(decisionWorld, hitSnapshot, actorSide, responseContext);
            const progress =
              dodgeProbability * nextIntentProgressUtility(decisionWorld, baseSnapshot, actorSide, responseContext).utility +
              (1 - dodgeProbability) * nextIntentProgressUtility(decisionWorld, hitSnapshot, actorSide, responseContext).utility;
            return {
              responseUtility,
              tailUtility,
              terminalUtility,
              progress,
              survivalLowerBound: Math.min(failureUtility.own, tailFailureUtility.own),
              worstTailCapacityLoss: Math.max(
                0,
                before.own - failureUtility.own,
                before.own - tailFailureUtility.own,
              ),
              catastrophicRisk:
                (1 - dodgeProbability) * catastrophicResponseRisk(actor, rawThreat, 1),
              avoidanceProbability: dodgeProbability,
            };
          }
          const threat = rawThreat * clamp(Number(defenseMultiplier || 0), 0, 1);
          const responseSnapshot = snapshotAfterResponseThreat(baseSnapshot, preview.unitId(actor), threat);
          const tailResponseSnapshot = tailSnapshot
            ? snapshotAfterResponseThreat(tailSnapshot, preview.unitId(actor), threat)
            : responseSnapshot;
          const responseUtility = stateUtilityNext(
            responseSnapshot,
            actorSide,
            beliefState,
            valueContext,
            capacityOptions,
          );
          const tailUtility = tailSnapshot
            ? stateUtilityNext(tailResponseSnapshot, actorSide, beliefState, valueContext, capacityOptions)
            : responseUtility;
          return {
            responseUtility,
            tailUtility,
            terminalUtility: nextIntentTerminalUtility(
              decisionWorld,
              responseSnapshot,
              actorSide,
              responseContext,
            ),
            progress: nextIntentProgressUtility(
              decisionWorld,
              responseSnapshot,
              actorSide,
              responseContext,
            ).utility,
            survivalLowerBound: Math.min(responseUtility.own, tailUtility.own),
            worstTailCapacityLoss: Math.max(
              0,
              before.own - responseUtility.own,
              before.own - tailUtility.own,
            ),
            catastrophicRisk: catastrophicResponseRisk(actor, rawThreat, defenseMultiplier),
            avoidanceProbability: 0,
          };
        };
        const candidateOutcome = evaluateResponseOutcome({
          baseSnapshot: candidateSnapshot,
          tailSnapshot: immediateCounterTailSnapshot,
          defenseKind: candidateEffectiveDefenseKind,
          prepared: candidatePrepared,
          prevented: responsePrevented,
          responseQuality: candidateResponseQuality,
          defenseMultiplier: candidateDefenseMultiplier,
          capacityOptions: controlCapacityOptions,
        });
        let baselineOutcomes = baselineResponseOutcomeCache.get(noOpSnapshot);
        if (!baselineOutcomes) {
          baselineOutcomes = new Map();
          baselineResponseOutcomeCache.set(noOpSnapshot, baselineOutcomes);
        }
        const baselineKey = [
          branchIndex,
          baselineDefenseKind,
          baselinePrepared,
          baselineResponsePrevented,
          baselineResponseQuality,
          baselineDefenseMultiplier,
        ].join('|');
        let baselineOutcome = baselineOutcomes.get(baselineKey);
        if (!baselineOutcome) {
          baselineOutcome = evaluateResponseOutcome({
            baseSnapshot: noOpSnapshot,
            defenseKind: baselineDefenseKind,
            prepared: baselinePrepared,
            prevented: baselineResponsePrevented,
            responseQuality: baselineResponseQuality,
            defenseMultiplier: baselineDefenseMultiplier,
          });
          baselineOutcomes.set(baselineKey, baselineOutcome);
        }
        let candidateTerminalUtility = candidateOutcome.terminalUtility;
        let baselineTerminalUtility = baselineOutcome.terminalUtility;
        if (noDamageFailureActive && sourceBefore && Math.max(0, Number(branch?.rawThreat || 0)) > 0) {
          candidateTerminalUtility = -100 * (
            responsePrevented ? 0 : clamp(1 - candidateOutcome.avoidanceProbability, 0, 1)
          );
          baselineTerminalUtility = -100 * (
            baselineResponsePrevented ? 0 : clamp(1 - baselineOutcome.avoidanceProbability, 0, 1)
          );
        }
        return {
          candidateUtility: totals.candidateUtility +
            probability * (candidateOutcome.responseUtility.utility - after.utility),
          noOpUtility: totals.noOpUtility +
            probability * (baselineOutcome.responseUtility.utility - noOp.utility),
          terminalUtility: totals.terminalUtility + probability * (candidateTerminalUtility - baselineTerminalUtility),
          objectiveProgress: totals.objectiveProgress,
          survivalLowerBound: Math.min(totals.survivalLowerBound, candidateOutcome.survivalLowerBound),
          worstTailCapacityLoss: Math.max(
            totals.worstTailCapacityLoss,
            candidateOutcome.worstTailCapacityLoss,
          ),
          catastrophicRisk: totals.catastrophicRisk + probability * candidateOutcome.catastrophicRisk,
          catastrophicRiskReduction: totals.catastrophicRiskReduction +
            probability * Math.max(0, baselineOutcome.catastrophicRisk - candidateOutcome.catastrophicRisk),
          candidatePreparedConsumed:
            totals.candidatePreparedConsumed === true || candidateStanceAvailable,
          baselinePreparedConsumed:
            totals.baselinePreparedConsumed === true || baselineStanceAvailable,
          preparedDefenseConsumedCount:
            Number(totals.preparedDefenseConsumedCount || 0) +
            (candidateStanceAvailable ? 1 : 0),
          candidateDefenseAudit: [
            ...(totals.candidateDefenseAudit || []),
            {
              sourceActorId: sourceId,
              probability,
              responsePrevented,
              candidateStanceAvailable,
              sourceAfterExists: !!sourceAfter,
              sourceAfterBattleCapable: !!sourceAfter && preview.isBattleCapable(sourceAfter),
              sourceAfterActionCancelled: !!sourceAfter && hasActionCancellation(sourceAfter),
            },
          ],
        };
      }, {
        candidateUtility: after.utility,
        noOpUtility: noOp.utility,
        terminalUtility: afterTerminalUtility - beforeTerminalUtility,
        objectiveProgress: nonDuplicatedObjectiveProgress,
        survivalLowerBound: Math.min(after.own, immediateCounterTail.own),
        worstTailCapacityLoss: Math.max(
          0,
          before.own - after.own,
          before.own - immediateCounterTail.own,
        ),
        catastrophicRisk: 0,
        catastrophicRiskReduction: 0,
        candidatePreparedConsumed: false,
        baselinePreparedConsumed: false,
        preparedDefenseConsumedCount: 0,
        candidateDefenseAudit: [],
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
      const actionRole = String(input?.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase() || 'ACTIVE';
      const directTerminalEvaluation = nextIntentTerminalEvaluation(
        decisionWorld,
        afterSnapshot,
        actorSide,
        responseContext,
      );
      const withdrawalSuccessEvaluation = withdrawalEstimate
        ? nextIntentTerminalEvaluation(
            decisionWorld,
            snapshotAfterWithdrawalSuccess(decisionWorld, actorSide),
            actorSide,
            responseContext,
          )
        : null;
      const terminalDelta = Number(responseComparison.terminalUtility || 0);
      const preventsFailure = !directTerminalEvaluation.directTerminal &&
        ['REACTION', 'COUNTER'].includes(actionRole) &&
        terminalDelta > 0.0001;
      const terminalEvidence = Object.freeze({
        kind: directTerminalEvaluation.directTerminal
          ? 'DIRECT_TERMINAL'
          : directTerminalEvaluation.directFailure
            ? 'DIRECT_TERMINAL_FAILURE'
            : withdrawalEstimate
              ? withdrawalSuccessEvaluation?.directTerminal
                ? 'WITHDRAWAL_TERMINAL'
                : 'WITHDRAWAL_SURVIVAL'
              : preventsFailure
                ? 'FAILURE_PREVENTION'
                : terminalDelta > 0.0001
                  ? 'TERMINAL_PROBABILITY_GAIN'
                  : terminalDelta < -0.0001
                    ? 'TERMINAL_RISK'
                    : 'NONE',
        direct: Object.freeze({
          achieved: directTerminalEvaluation.directTerminal,
          failure: directTerminalEvaluation.directFailure,
          winner: directTerminalEvaluation.winner,
          terminalReason: directTerminalEvaluation.terminalReason,
          matchedConditionTypes: directTerminalEvaluation.matchedConditionTypes,
        }),
        response: Object.freeze({
          utilityDelta: terminalDelta,
          preventsFailure,
          improvesSuccessProbability: !directTerminalEvaluation.directTerminal && terminalDelta > 0.0001,
          increasesFailureRisk: terminalDelta < -0.0001,
        }),
        withdrawal: withdrawalEstimate
          ? Object.freeze({
              probability: withdrawalProbability,
              achievesTerminal: withdrawalSuccessEvaluation?.directTerminal === true,
              terminalReason: withdrawalSuccessEvaluation?.terminalReason || '',
            })
          : null,
      });
      const directPotential = (candidate?.declaration?.targetIds || []).reduce((sum, targetId) => {
        const target = findUnitInWorld(decisionWorld, targetId);
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
      const valueContributions = temporalValueContributions.filter(entry =>
        entry?.outcomeKind !== 'ACTION_CANCELLED' ||
        !unrealizableControlTargets.has(String(entry?.targetId || '').trim())
      ).filter(entry => {
        if (String(entry?.outcomeKind || '').trim().toUpperCase() !== 'SUMMON_WINDOW') return true;
        const remainingWindows = Math.max(0, Number(entry?.evidence?.remainingWindows || 0));
        return remainingWindows > 0 &&
          battleHorizonProfile(input, decisionWorld).remainingRounds > 0;
      });
      const currentOpportunitySequence = Math.max(
        0,
        Number(input?.actionOpportunity?.sequence || 0),
      );
      const currentRound = Math.max(0, Number(decisionWorld?.回合 || 0));
      const actorKeys = new Set([
        preview.unitId(actor),
        preview.unitName(actor),
        actor?.charKey,
        actor?.char_key,
      ].map(value => String(value || '').trim()).filter(Boolean));
      const repeatedCandidateTargetIds = [...new Set(
        (candidate?.declaration?.targetIds || [])
          .map(value => String(value || '').trim())
          .filter(Boolean),
      )].sort();
      const repeatedCandidateTargetKey = JSON.stringify(repeatedCandidateTargetIds);
      const compatibleTargetSet = values => {
        const normalized = [...new Set((values || [])
          .map(value => String(value || '').trim())
          .filter(Boolean))].sort();
        return repeatedCandidateTargetIds.length === 0 ||
          normalized.length === 0 ||
          JSON.stringify(normalized) === repeatedCandidateTargetKey;
      };
      const candidateRoute = actionRouteKey(
        candidate?.declaration?.actionKind,
        candidateActionName(candidate),
      );
      const lastActorAction = [...(Array.isArray(decisionWorld?.__battleEventLedger)
        ? decisionWorld.__battleEventLedger
        : [])]
        .reverse()
        .find(event => {
          const eventKind = String(event?.eventKind || '').trim();
          if (!['action_start', 'charge_start'].includes(eventKind)) return false;
          if (String(event?.actionRole || '').trim().toUpperCase() !== actionRole) return false;
          const eventActorKeys = [
            event?.actorId,
            event?.actorName,
            event?.actor,
          ].map(value => String(value || '').trim()).filter(Boolean);
          if (!eventActorKeys.some(value => actorKeys.has(value))) return false;
          const eventRoute = actionRouteKey(
            event?.actionKind || event?.actionType,
            event?.finalActionName ||
              event?.actionName ||
              event?.skillName ||
              event?.meta?.finalActionName ||
              event?.meta?.actionName,
          );
          if (eventRoute !== candidateRoute) return false;
          if (!compatibleTargetSet([
            ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
            event?.targetId,
            event?.targetName,
          ])) return false;
          const eventOpportunitySequence = Math.max(
            0,
            Number(event?.opportunitySequence ?? event?.meta?.opportunitySequence ?? 0),
          );
          const eventRound = Math.max(0, Number(event?.round || 0));
          return eventRound < currentRound ||
            (eventRound === currentRound && (
              !currentOpportunitySequence ||
              !eventOpportunitySequence ||
              eventOpportunitySequence < currentOpportunitySequence
            ));
        }) || null;
      const lastHistory = Array.isArray(input?.strategicHistory)
        ? [...input.strategicHistory].reverse().find(history => {
            if (String(history?.actionRole || '').trim().toUpperCase() !== actionRole) return false;
            if (String(history?.actionFamily || '').trim() !== actionFamilyOf(candidate)) return false;
            if (!compatibleTargetSet(history?.targetIds || [])) return false;
            return !currentOpportunitySequence ||
              !Number(history?.opportunitySequence || 0) ||
              Number(history.opportunitySequence) < currentOpportunitySequence;
          })
        : null;
      const historyPriorAction =
        lastHistory
          ? {
              actionId: '',
              opportunitySequence: Math.max(0, Number(lastHistory?.opportunitySequence || 0)),
              fromStrategyHistory: true,
            }
          : null;
      const priorAction = lastActorAction || historyPriorAction;
      const previousOpportunitySequence = Math.max(
        0,
        Number(priorAction?.opportunitySequence ?? priorAction?.meta?.opportunitySequence ?? 0),
      );
      const repeatedValueEvidence = valueContributions
        .filter(entry => {
        const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
        const evidence = entry?.evidence || {};
        if (['HP_DELTA', 'SCHEDULED_HP_DELTA'].includes(outcomeKind)) {
          return Math.abs(contributionExpectedDelta(entry)) > 0.0001;
        }
        if (outcomeKind === 'SHIELD_DELTA') {
          const shieldDelta = contributionExpectedDelta(entry);
          const target = findUnitInWorld(decisionWorld, entry?.targetId);
          const targetSide = target ? sideOf(decisionWorld, target) : '';
          const hostileTarget = !!targetSide && targetSide !== actorSide;
          if (hostileTarget) {
            return shieldDelta < -0.0001 ||
              Number(evidence?.absorbedDamage || 0) > 0.0001;
          }
          return shieldDelta > 0.0001 &&
            Math.abs(Number(evidence?.absorbedDamage || 0)) <= 0.0001;
        }
        if (outcomeKind === 'RESOURCE_OPTION_CHANGED') {
          return String(entry?.windowId || '').trim() !== 'ACTION_COST' &&
            Math.abs(contributionExpectedDelta(entry)) > 0.0001;
        }
        if (outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
          return Math.abs(contributionExpectedDelta(entry)) > 0.0001 ||
            Math.abs(Number(evidence?.multiplier || 0)) > 0.0001 ||
            hasMaterialStateMechanics(entry);
        }
        if (outcomeKind === 'STATE_CHANGED') {
          return evidence?.marginal !== false && hasMaterialStateMechanics(entry);
        }
        return ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW', 'BELIEF_CHANGED', 'RULE_CHANGED']
          .includes(outcomeKind);
        });
      const defensiveRepeatEvidence = ['DEFEND', 'EVADE', 'GUARD', 'WITHDRAW'].includes(actionKind) && (
        Number(responseComparison?.catastrophicRiskReduction || 0) > 0.0001 ||
        Number(responseComparison?.candidateUtility || 0) >
          Number(responseComparison?.noOpUtility || 0) + 0.0001
      );
      const atomicActionPotential = preview.calculateAtomicActionPotential({
        directPotential,
        contributions: valueContributions,
        frozenDirectPotential: valueContext.frozenDirectPotential,
      });
      const summonWindowValue = valueContributions
        .filter(entry => String(entry?.outcomeKind || '').trim().toUpperCase() === 'SUMMON_WINDOW')
        .reduce((sum, entry) => {
          const remainingWindows = Math.max(0, Number(entry?.evidence?.remainingWindows || 0));
          if (!(remainingWindows > 0)) return sum;
          return sum + Math.max(0, Number(entry?.evidence?.actionPotential || 0));
        }, 0);
      const actorCatalog = valueContext.catalogs[preview.unitId(actor)] || [];
      const informationAudit = candidateInformationValue({
        worldSnapshot: decisionWorld,
        actorId: preview.unitId(actor),
        beliefState,
        candidate,
        mechanicObservations,
        predictedContributions: candidatePreview?.contributions || [],
        catalog: valueContext.informationCatalogs?.[preview.unitId(actor)] || actorCatalog,
      });
      const informationValue = Number(informationAudit.value || 0);
      const irreversibleAssetCost = candidateContributions
        .filter(entry => entry?.outcomeKind === 'IRREVERSIBLE_ASSET_LOST')
        .reduce((sum, entry) => sum + Math.max(0, Number(entry?.threatValue || entry?.evidence?.cost || 0)), 0);
      const expectedStateGain = 100 *
        (responseComparison.candidateUtility - responseComparison.noOpUtility) /
        Math.max(1, before.total) +
        summonWindowValue;
      const repeatedInformationMarginal = priorAction ? informationValue : 0;
      const repeatedActionDelta = priorAction && (
        repeatedValueEvidence.length ||
        defensiveRepeatEvidence ||
        repeatedInformationMarginal > 0.01
      )
        ? Math.max(
            0,
            expectedStateGain,
            repeatedInformationMarginal,
            100 * Number(responseComparison?.catastrophicRiskReduction || 0) /
              Math.max(1, Number(before?.total || 0)),
          )
        : 0;
      const resourceThreatAudit = resourceThreatResolutionAudit({
        worldSnapshot: decisionWorld,
        afterSnapshot: resourceOnlySnapshot,
        candidate,
        result: candidatePreview,
        actorSide,
        beliefState,
        valueContext,
        beforeUtility: before,
      });
      const resourceThreatResolutionPenalty = resourceThreatAudit.hasPositiveSupportEffect
        ? Math.max(0, Number(resourceThreatAudit.normalizedCapacityLoss || 0))
        : 0;
      const stateEffects = candidateEffects.filter(effect => String(effect?.原型 || '').trim() === '状态施加');
      const targets = (candidate?.declaration?.targetIds || [])
        .map(targetId => findUnitInWorld(decisionWorld, targetId))
        .filter(Boolean);
      const stateWindowProfiles = temporalAudit.profiles.filter(profile =>
        profile.prototype === '状态施加',
      );
      const realizableStateNames = new Set(
        stateWindowProfiles.filter(profile => profile.realizable).map(profile => profile.stateName).filter(Boolean),
      );
      const hasMaterialWindowDelta = entry =>
        Math.abs(contributionExpectedDelta(entry)) > 0.0001;
      const materialStateWindowContributions = valueContributions.filter(entry =>
        entry?.outcomeKind === 'STATE_CHANGED' &&
        entry?.evidence?.marginal !== false &&
        realizableStateNames.has(String(entry?.evidence?.state || '').trim()) &&
        (
          hasMaterialWindowDelta(entry) ||
          hasMaterialStateMechanics(entry)
        )
      );
      const marginalProfile = meaningfulPreviewEffect(
        candidatePreview ? { ...candidatePreview, contributions: valueContributions } : candidatePreview,
        stateEffects.filter(effect => {
          const stateName = String(effect?.状态 || effect?.状态名称 || '').trim() ||
            (Array.isArray(effect?.属性)
              ? `${effect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、') || '属性'}修正`
              : '');
          return stateWindowProfiles.some(profile =>
            profile.realizable && (!stateName || profile.stateName === stateName),
          );
        }),
        targets,
      );
      const costs = candidate.costs || candidate.declaration?.resourceCosts || {};
      const actorAfter = findUnitInWorld(candidateSnapshot, preview.unitId(actor));
      const resourceRunwayBefore = resourceRunway(actor, costs);
      const resourceRunwayAfter = actorAfter ? resourceRunway(actorAfter, costs) : 0;
      const continuityAudit = resourceContinuityAudit({
        beforeSnapshot: decisionWorld,
        noOpSnapshot,
        afterSnapshot: resourceOnlySnapshot,
        actorId: preview.unitId(actor),
        catalog: actorCatalog,
      });
      const affordableBefore = actorCatalog
        .filter(action => Object.keys(action.costs || {}).length > 0 && actionLegalFromFrozen(decisionWorld, actor, action))
        .map(action => action.actionKey);
      const resourceOnlyActorAfter = findUnitInWorld(resourceOnlySnapshot, preview.unitId(actor));
      const affordableAfter = resourceOnlyActorAfter
        ? actorCatalog
            .filter(action => Object.keys(action.costs || {}).length > 0 && actionLegalFromFrozen(resourceOnlySnapshot, resourceOnlyActorAfter, action))
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
      const sequencePotentialLoss = Math.max(
        0,
        -Number(continuityAudit.resourceContinuityDelta || 0),
      );
      const positiveProgressEpsilon = 0.0001;
      const meaningfulProgressFloor = 0.05;
      const directValueCompensation =
        lostAffordableActions.length > 0 &&
        directPotential > Math.max(1, sequencePotentialLoss * 1.25) &&
        expectedStateGain > meaningfulProgressFloor;
      const unclampedObjectiveUtility =
        expectedStateGain +
        responseComparison.terminalUtility +
        responseComparison.objectiveProgress +
        informationValue -
        irreversibleAssetCost -
        resourceThreatResolutionPenalty;
      const rawObjectiveUtility = clamp(unclampedObjectiveUtility, -200, 200);
      const hasCost = Object.keys(costs).length > 0 ||
        irreversibleAssetCost > 0 ||
        ['EQUIP', 'USE_ITEM'].includes(actionKind);
      const terminalCompensation = responseComparison.terminalUtility > 0;
      const resourceSupportOnly = candidateEffects.length > 0 &&
        candidateEffects.every(isPositiveResourceSupportEffect);
      const resourceUnlockMissing = resourceSupportOnly &&
        continuityAudit.supportRealized !== true;
      const creationUseMissing = !!candidate.creation && creationUseAudit?.realizable !== true;
      const zeroEffectCostly = hasCost &&
        (!marginalProfile.hasMeaningfulEffect || resourceUnlockMissing || creationUseMissing) &&
        informationValue <= 0;
      const targetRemoved = targets.some(target => {
        const afterTarget = findUnitInWorld(afterSnapshot, preview.unitId(target));
        return afterTarget && !preview.isBattleCapable(afterTarget);
      });
      const hasImmediateGrantedWindow = valueContributions.some(entry =>
        ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW'].includes(entry?.outcomeKind));
      const lifecycleWindowReasons = [
        ...temporalAudit.validProfiles.flatMap(profile => profile.reasons),
        hasImmediateGrantedWindow ? 'IMMEDIATE_WINDOW' : '',
      ].filter(Boolean);
      const materialWindowContributions = valueContributions.filter(entry => {
        const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
        const windowId = String(entry?.windowId || '').trim();
        if (!windowId) return false;
        if (outcomeKind === 'ACTION_CANCELLED') {
          return !unrealizableControlTargets.has(String(entry?.targetId || '').trim());
        }
        if (['ACTION_GRANTED', 'SUMMON_WINDOW'].includes(outcomeKind)) return true;
        if (!['STATE_CHANGED', 'STATE_SCHEDULED', 'SCHEDULED_HP_DELTA'].includes(outcomeKind)) {
          return false;
        }
        return hasMaterialWindowDelta(entry) || hasMaterialStateMechanics(entry);
      });
      const futureWindowCompensation =
        materialWindowContributions.length > 0 &&
        expectedStateGain > meaningfulProgressFloor;
      const deadlineCompensation =
        objectiveProgressAudit.makesDeadlineFeasible === true &&
        responseComparison.objectiveProgress > 0.0001;
      const resourceBankruptcyCompensation = terminalCompensation ||
        deadlineCompensation ||
        targetRemoved ||
        futureWindowCompensation ||
        continuityAudit.resourceContinuityDelta > 0.0001 ||
        directValueCompensation;
      const resourceBankruptcyCompensationAudit = Object.freeze({
        compensated: resourceBankruptcyCompensation,
        reason: terminalCompensation
          ? 'TERMINAL'
          : deadlineCompensation
            ? 'OBJECTIVE_PROGRESS'
            : targetRemoved
              ? 'TARGET_REMOVED'
              : futureWindowCompensation
                ? 'FUTURE_WINDOW'
                : continuityAudit.sequencePotentialDelta > 0.0001
                  ? 'SEQUENCE_UNLOCK'
                  : directValueCompensation
                    ? 'DIRECT_VALUE_COVERS_RUNWAY_LOSS'
                    : 'NONE',
        directPotential,
        expectedStateGain,
        meaningfulProgressFloor,
        sequencePotentialLoss,
        lostAffordableActions: Object.freeze([...lostAffordableActions]),
        materialWindowIds: Object.freeze(materialWindowContributions
          .map(entry => String(entry?.windowId || '').trim())
          .filter(Boolean)),
      });
      const uncompensatedResourceBankruptcy = hasCost &&
        resourceRunwayBefore !== null &&
        resourceRunwayBefore > 0 &&
        resourceRunwayAfter === 0 &&
        (
          lostAffordableActions.length > 0 ||
          affordableNoCostAlternative ||
          continuityAudit.resourceContinuityDelta < -0.0001 ||
          continuityAudit.secondOpportunityDelta < -0.0001
        ) &&
        !resourceBankruptcyCompensation;
      const hasProgress = expectedStateGain > positiveProgressEpsilon ||
        responseComparison.objectiveProgress > positiveProgressEpsilon ||
        informationValue > positiveProgressEpsilon ||
        (
          valueContributions.some(entry =>
            String(entry?.outcomeKind || '').trim().toUpperCase() === 'SUMMON_WINDOW'
          ) &&
          atomicActionPotential > positiveProgressEpsilon
        ) ||
        terminalCompensation ||
        responseComparison.catastrophicRiskReduction > positiveProgressEpsilon ||
        (
          actionRole === 'REACTION' &&
          responseComparison.candidateUtility >
            responseComparison.noOpUtility + positiveProgressEpsilon
        );
      const crisisAudit = crisisResponseAudit({
        problems: decisionProblems,
        actorId: preview.unitId(actor),
        candidate,
        beforeSnapshot: decisionWorld,
        noOpSnapshot,
        afterSnapshot: candidateSnapshot,
        responseComparison,
        contributions: candidateContributions,
        teamIntent,
      });
      const repeatedActionHasEvidence =
        repeatedValueEvidence.length > 0 ||
        defensiveRepeatEvidence ||
        repeatedInformationMarginal > 0.01 ||
        materialWindowContributions.length > 0 ||
        hasMaterialCrisisCompensation(crisisAudit) ||
        terminalCompensation ||
        deadlineCompensation;
      const repeatedActionNoProgress =
        priorAction &&
        !candidate.counterDeclineFallback &&
        !repeatedActionHasEvidence &&
        !hasExplicitCounterPlan &&
        !terminalCompensation &&
        responseComparison.objectiveProgress <= 0.0001;
      const teamIntentAudit = teamIntentRealizationAudit({
        teamIntent,
        candidate,
        contributions: candidateContributions,
        crisisAudit,
      });
      const uncompensatedRisk =
        rawObjectiveUtility < -0.0001 &&
        (
          responseComparison.catastrophicRisk > 0.0001 ||
          irreversibleAssetCost > 0.0001 ||
          hasCost
        ) &&
        !terminalCompensation &&
        responseComparison.objectiveProgress <= 0.0001 &&
        informationValue <= 0 &&
        !futureWindowCompensation &&
        !hasMaterialCrisisCompensation(crisisAudit);
      const rejectionCode = defenseRefreshBlocked
        ? 'ZERO_PROGRESS'
        : zeroEffectCostly
          ? 'ZERO_EFFECT_COSTLY'
          : uncompensatedResourceBankruptcy
          ? 'UNCOMPENSATED_RESOURCE_BANKRUPTCY'
          : uncompensatedRisk
            ? 'UNCOMPENSATED_RISK'
          : repeatedActionNoProgress
            ? 'ZERO_PROGRESS'
          : !hasProgress && !candidate.counterDeclineFallback
            ? 'ZERO_PROGRESS'
            : '';
      const deepRequired = sharedResponseBranches.some(branch =>
        branch?.lethal === true ||
        branch?.unknown === true ||
        branch?.explicit === true
      ) || needsDeepPreview(candidate, candidatePreview, decisionWorld, candidateSnapshot, beliefState);
      const opensAllyWindow = valueContributions.some(entry =>
        ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW', 'STATE_CHANGED', 'STATE_SCHEDULED']
          .includes(String(entry?.outcomeKind || '').trim())
      );
      const firstAlly = opensAllyWindow
        ? firstAllyBeforeActorNextOpportunity(afterSnapshot, actorAfter || actor, actorSide)
        : null;
      const deepTimeline = [
        Object.freeze({ nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId }),
        Object.freeze({ nodeType: 'RESULT_RESOLVED', probability: 1 }),
        ...sharedResponseBranches.map(branch => Object.freeze({
          nodeType: branch?.unknown === true ? 'UNKNOWN_RESPONSE' : 'KNOWN_RESPONSE',
          responseId: String(branch?.responseId || '').trim(),
          sourceActorId: String(branch?.sourceActorId || '').trim(),
          probability: Math.max(0, Number(branch?.probability || 0)),
          rawThreat: Math.max(0, Number(branch?.rawThreat || 0)),
          lethal: branch?.lethal === true,
          unknown: branch?.unknown === true,
          explicit: branch?.explicit === true,
        })),
        ...(firstAlly ? [Object.freeze({
          nodeType: 'FIRST_ALLY_WINDOW',
          actorId: preview.unitId(firstAlly),
          baseActionValue: Math.max(
            0,
            Number(valueContext.frozenDirectPotential?.[preview.unitId(firstAlly)] || 0),
          ),
        })] : []),
        Object.freeze({
          nodeType: 'ACTOR_NEXT_OPPORTUNITY',
          baseActionValue: Math.max(0, Number(valueContext.frozenDirectPotential?.[preview.unitId(actor)] || 0)),
        }),
      ].slice(0, 12);
      const deepAnalysis = Object.freeze({
        required: deepRequired,
        nodeCount: deepTimeline.length,
        timeline: Object.freeze(deepTimeline),
        responseBranches: Object.freeze(sharedResponseBranches.map(branch => Object.freeze({ ...branch }))),
        noResponseProbability: Math.max(0, 1 - branchMass),
        expectedResponseUtility: responseComparison.candidateUtility,
        expectedResponseDeltaUtility:
          responseComparison.candidateUtility - responseComparison.noOpUtility,
      });
      return Object.freeze({
        ...candidate,
        actionFamily: actionFamilyOf(candidate),
        effectTargetAudit,
        preview: candidatePreview,
        predictedOutcomeEvidence: predictedOutcomeEvidence(
          candidatePreview
            ? { ...candidatePreview, contributions: valueContributions }
            : candidatePreview,
          visibleWorldSnapshot,
        ),
        utilityBefore: before.utility,
        utilityAfter: after.utility,
        rawObjectiveUtility,
        objectiveUtility: rawObjectiveUtility,
        rejectionCode,
        objectiveProgressAudit,
        atomicActionPotential,
          immediateReactionAudit: result?.immediateReactionAudit || Object.freeze([]),
        withdrawalEstimate,
        mechanicObservations,
        deepAnalysis,
        vector: Object.freeze({
          rawObjectiveUtility,
          unclampedObjectiveUtility,
          informationValue,
          resourceContinuity: continuityAudit.resourceContinuityDelta,
          survivalLowerBound: Math.max(0, responseComparison.survivalLowerBound),
          irreversibleAssetCost,
          worstTailCapacityLoss: responseComparison.worstTailCapacityLoss,
          expectedStateGain,
          terminalUtility: responseComparison.terminalUtility,
          objectiveProgress: responseComparison.objectiveProgress,
          objectiveProgressAudit,
          resourcePreservation: continuityAudit.resourceContinuityDelta,
          irreversibleCost: irreversibleAssetCost,
          catastrophicRisk: responseComparison.catastrophicRisk,
          catastrophicRiskReduction: responseComparison.catastrophicRiskReduction,
          preparedDefenseConsumedCount: Math.max(
            0,
            Number(responseComparison.preparedDefenseConsumedCount || 0),
          ),
          resourceOpportunityCost: resourceThreatResolutionPenalty,
          resourceThreatResolutionPenalty,
        }),
        terminalEvidence,
        crisisResponseAudit: crisisAudit,
        teamIntentAudit,
        repeatedActionAudit: Object.freeze({
          repeatedActionDelta,
          informationMarginal: repeatedInformationMarginal,
          isRepeatedAction: !!priorAction,
          previousActionId: String(priorAction?.actionId || '').trim(),
          currentOpportunitySequence,
          previousOpportunitySequence,
          opportunityDistance: currentOpportunitySequence > 0 && previousOpportunitySequence > 0
            ? Math.max(0, currentOpportunitySequence - previousOpportunitySequence)
            : null,
          defensiveRepeatEvidence,
          zeroProgressReason: repeatedActionNoProgress
            ? 'NO_REALIZED_MARGINAL_OR_WINDOW'
            : '',
          addedValueEvidence: Object.freeze(repeatedValueEvidence.map(entry => ({
            outcomeKind: String(entry?.outcomeKind || '').trim().toUpperCase(),
            targetId: String(entry?.targetId || '').trim(),
            windowId: String(entry?.windowId || '').trim(),
            sourceEffectId: String(entry?.effectInstanceId || '').trim(),
            causalOwner: 'PRIMARY_ACTION',
            expectedDelta: contributionExpectedDelta(entry),
          }))),
          extendedWindowIds: Object.freeze(materialStateWindowContributions
            .map(entry => String(entry?.windowId || '').trim())
            .filter(Boolean)),
          newlyDeniedOpportunityIds: Object.freeze(materialWindowContributions
            .filter(entry => entry?.outcomeKind === 'ACTION_CANCELLED')
            .map(entry => String(entry?.windowId || '').trim())
            .filter(Boolean)),
          unrealizableDeniedOpportunityIds: Object.freeze(candidateContributions
            .filter(entry =>
              entry?.outcomeKind === 'ACTION_CANCELLED' &&
              unrealizableControlTargets.has(String(entry?.targetId || '').trim())
            )
            .map(entry => String(entry?.windowId || '').trim())
            .filter(Boolean)),
          controlWindowRealizability: controlWindowAudit,
          resourceRunwayBefore,
          resourceRunwayAfter,
          resourceContinuityAudit: continuityAudit,
          resourceBankruptcyCompensationAudit,
          lostAffordableActions: Object.freeze(lostAffordableActions),
          lifecycleWindowRealizable: materialWindowContributions.length > 0,
          lifecycleWindowReasons: Object.freeze([...new Set(lifecycleWindowReasons)]),
          stateWindowProfiles: Object.freeze(stateWindowProfiles),
          temporalWindowProfiles: Object.freeze(temporalAudit.profiles),
          unrealizableTemporalContributionKinds: Object.freeze([
            ...new Set(temporalAudit.invalidContributions.map(entry =>
              String(entry?.outcomeKind || '').trim().toUpperCase(),
            ).filter(Boolean)),
          ]),
        }),
        nextValueAudit: Object.freeze({
          before: Object.freeze({
            ...before,
            nonDuplicatedGoalProgress: 0,
          }),
          noOp: Object.freeze({
            ...noOp,
            nonDuplicatedGoalProgress: 0,
          }),
          after: Object.freeze({
            ...after,
            nonDuplicatedGoalProgress: nonDuplicatedObjectiveProgress,
          }),
          expectedAfterResponseUtility: responseComparison.candidateUtility,
          expectedNoOpResponseUtility: responseComparison.noOpUtility,
          objectiveProgressAudit,
          responseBranchCount: sharedResponseBranches.length,
          survivalLowerBound: responseComparison.survivalLowerBound,
          worstTailCapacityLoss: responseComparison.worstTailCapacityLoss,
          catastrophicRisk: responseComparison.catastrophicRisk,
          catastrophicRiskReduction: responseComparison.catastrophicRiskReduction,
          preparedDefenseConsumedCount: Math.max(
            0,
            Number(responseComparison.preparedDefenseConsumedCount || 0),
          ),
          resourceOpportunityCost: resourceThreatResolutionPenalty,
          resourceThreatResolutionPenalty,
          crisisResponseAudit: crisisAudit,
          teamIntentAudit,
          resourceContinuityAudit: continuityAudit,
          resourceContinuityCapacityDelta,
          resourceContinuityCapacityAudit: Object.freeze({
            candidateOwnCapacity: Number(resourceCandidateCapacity.own || 0),
            resourceRestoredOwnCapacity: Number(resourceBaselineCapacity.own || 0),
            noOpOwnCapacity: Number(resourceBaselineCapacity.own || 0),
            resourceThreatProfileIsolated: true,
          }),
          resourceThreatResolutionAudit: resourceThreatAudit,
          resourceBankruptcyCompensationAudit,
          informationAudit,
          frozenDirectPotential: valueContext.frozenDirectPotential,
          resourceThreatProfile: valueContext.resourceThreatProfile,
          resourceThreatDiagnostics: valueContext.resourceThreatDiagnostics,
          atomicActionPotential,
          summonWindowValue,
          candidateDefenseKind,
          effectiveCandidateDefenseKind,
          existingDefenseKind,
          defenseRefreshBlocked,
          responseBranchProbabilities: Object.freeze(sharedResponseBranches.map(branch => ({
            responseId: String(branch?.responseId || '').trim(),
            sourceActorId: String(branch?.sourceActorId || '').trim(),
            probability: Math.max(0, Number(branch?.probability || 0)),
          }))),
          candidateDefenseAudit: Object.freeze((responseComparison.candidateDefenseAudit || []).map(entry => Object.freeze({ ...entry }))),
          immediateCounterExpectedThreat: Math.max(0, Number(immediateCounterRisk.totalExpectedThreat || 0)),
          immediateCounterWorstTailThreat: Math.max(0, Number(immediateCounterRisk.totalWorstTailThreat || 0)),
          immediateCounterAudit: immediateCounterRisk.entries,
          teamReactionSequence: teamReactionSequence?.audit || null,
          creationFutureUse: creationUseAudit,
          valueAddedOutsideStateDelta: responseComparison.terminalUtility +
            responseComparison.objectiveProgress +
            informationValue -
            irreversibleAssetCost -
            resourceThreatResolutionPenalty,
        }),
      });
    });
    const resourceAdaptedCandidates = scored.map(candidate => {
      const adaptation = input?.playerLockedDeclaration
        ? Object.freeze({
            applied: false,
            reason: 'PLAYER_LOCKED_DECLARATION',
            penalty: 0,
            alternativeCandidateId: '',
            failureEvidence: null,
          })
        : activeNaturalOpportunity
        ? repeatedFailureResourceOpportunity(
            candidate,
            actor,
            beliefState,
            scored,
            decisionProblems,
            decisionWorld,
          )
        : Object.freeze({
            applied: false,
            reason: 'NO_NATURAL_ACTION_OPPORTUNITY',
            penalty: 0,
            alternativeCandidateId: '',
            failureEvidence: null,
          });
      if (!adaptation.applied) {
        return {
          ...candidate,
          repeatedActionAudit: Object.freeze({
            ...candidate.repeatedActionAudit,
            failureAdaptation: adaptation,
            resourceOpportunityCost: 0,
          }),
        };
      }
      const adjustedUnclampedObjectiveUtility =
        Number(candidate?.vector?.unclampedObjectiveUtility ?? candidate.objectiveUtility ?? 0) -
        Number(adaptation.penalty || 0);
      const adjustedObjectiveUtility = clamp(
        adjustedUnclampedObjectiveUtility,
        -200,
        200,
      );
      const resourceOpportunityCost =
        Number(candidate?.vector?.resourceOpportunityCost || 0) +
        Number(adaptation.penalty || 0);
      const vector = {
        ...candidate.vector,
        rawObjectiveUtility: adjustedObjectiveUtility,
        unclampedObjectiveUtility: adjustedUnclampedObjectiveUtility,
        resourceOpportunityCost,
        failureAdaptationPenalty: Number(adaptation.penalty || 0),
      };
      return {
        ...candidate,
        rawObjectiveUtility: adjustedObjectiveUtility,
        objectiveUtility: adjustedObjectiveUtility,
        vector: Object.freeze(vector),
        repeatedActionAudit: Object.freeze({
          ...candidate.repeatedActionAudit,
          failureAdaptation: Object.freeze({
            ...adaptation,
            scoreStage: 'FINAL_FROZEN',
            baseObjectiveUtility: Number(candidate?.objectiveUtility || 0),
            finalObjectiveUtility: adjustedObjectiveUtility,
          }),
          resourceOpportunityCost: Number(adaptation.penalty || 0),
        }),
        nextValueAudit: Object.freeze({
          ...candidate.nextValueAudit,
          resourceOpportunityCost,
          failureAdaptation: Object.freeze({
            ...adaptation,
            scoreStage: 'FINAL_FROZEN',
            baseObjectiveUtility: Number(candidate?.objectiveUtility || 0),
            finalObjectiveUtility: adjustedObjectiveUtility,
          }),
        }),
      };
    });
    const progressAlternatives = resourceAdaptedCandidates
      .filter(candidate =>
        !candidate.rejectionCode &&
        !['DEFEND', 'EVADE', 'GUARD'].includes(String(candidate?.declaration?.actionKind || '').trim()) &&
        Number(candidate?.objectiveProgressAudit?.progressGain || 0) > 1e-9
      )
      .sort((left, right) =>
        Number(right.objectiveUtility || 0) - Number(left.objectiveUtility || 0) ||
        String(left.candidateId || '').localeCompare(String(right.candidateId || ''))
      );
    const bestProgressAlternative = progressAlternatives[0] || null;
    const offensiveAlternatives = resourceAdaptedCandidates
      .filter(candidate => {
        const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
        const directKinds = new Set(['BASIC_ATTACK', 'RELEASE_SKILL', 'USE_ITEM']);
        if (candidate?.rejectionCode || !directKinds.has(actionKind)) return false;
        if (Number(candidate?.atomicActionPotential || 0) <= 0.0001) return false;
        return (Array.isArray(candidate?.predictedOutcomeEvidence)
          ? candidate.predictedOutcomeEvidence.some(evidence =>
              String(evidence?.outcomeKind || '').trim().toUpperCase() === 'HP_DELTA' &&
              Number(evidence?.expectedDelta || 0) < -0.0001
            )
          : false) || actionKind === 'BASIC_ATTACK';
      })
      .sort((left, right) =>
        Number(right?.objectiveUtility || 0) - Number(left?.objectiveUtility || 0) ||
        Number(right?.atomicActionPotential || 0) - Number(left?.atomicActionPotential || 0) ||
        String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
      );
    const bestOffensiveAlternative = offensiveAlternatives[0] || null;
    const urgentProblemIds = new Set([
      'SURVIVAL_CRISIS',
      'ALLY_CRISIS',
      'IMMINENT_DENIAL',
      'RESOURCE_SURVIVAL_CRISIS',
      'RESOURCE_ACTION_CRISIS',
    ]);
    const hasUrgentProblem = decisionProblems.some(problem => urgentProblemIds.has(String(problem?.problemId || '').trim()));
    const objectiveStallCandidates = resourceAdaptedCandidates.map(candidate => {
      const actionKind = String(candidate?.declaration?.actionKind || '').trim();
      const defensiveAction = ['DEFEND', 'EVADE', 'GUARD'].includes(actionKind);
      const progressGain = Number(candidate?.objectiveProgressAudit?.progressGain || 0);
      const clearProgressAlternative = bestProgressAlternative &&
        Number(bestProgressAlternative.objectiveUtility || 0) > Number(candidate.objectiveUtility || 0) + 1e-9;
      const preservesCriticalOutcome =
        Number(candidate?.vector?.terminalUtility || 0) > 0 ||
        Number(candidate?.vector?.catastrophicRiskReduction || 0) > 1e-9;
      const hasRealizableOffensiveEdge = !!bestOffensiveAlternative &&
        Number(bestOffensiveAlternative?.atomicActionPotential || 0) > 0.0001;
      const defensiveThreatEvidence =
        hasUrgentProblem ||
        hasExplicitCounterPlan ||
        preservesCriticalOutcome ||
        candidate?.crisisResponseAudit?.realized === true ||
        Number(candidate?.nextValueAudit?.catastrophicRiskReduction || 0) > 0.0001;
      const shouldRejectStall =
        offensiveGoalConditions.length > 0 &&
        activeNaturalOpportunity &&
        !candidate.rejectionCode &&
        defensiveAction &&
        progressGain <= 1e-9 &&
        !!clearProgressAlternative &&
        !defensiveThreatEvidence;
      const shouldRejectOpportunityCost =
        offensiveGoalConditions.length > 0 &&
        activeNaturalOpportunity &&
        !candidate.rejectionCode &&
        defensiveAction &&
        hasRealizableOffensiveEdge &&
        !defensiveThreatEvidence &&
        !candidate?.counterDeclineFallback;
      return shouldRejectStall
        ? {
            ...candidate,
            rejectionCode: 'OBJECTIVE_STALL',
            objectiveStallAudit: Object.freeze({
              applied: true,
              reason: 'OFFENSIVE_GOAL_WITHOUT_PROGRESS',
              bestAlternativeId: bestProgressAlternative.candidateId,
              bestAlternativeUtility: Number(bestProgressAlternative.objectiveUtility || 0),
              selectedUtilityBeforeStall: Number(candidate.objectiveUtility || 0),
              urgentProblems: Object.freeze(
                decisionProblems
                  .filter(problem => urgentProblemIds.has(String(problem?.problemId || '').trim()))
                  .map(problem => String(problem.problemId || '').trim()),
              ),
              explicitCounterPlan: hasExplicitCounterPlan,
            }),
          }
        : shouldRejectOpportunityCost
          ? {
              ...candidate,
              rejectionCode: 'ACTION_OPPORTUNITY_COST',
              objectiveStallAudit: Object.freeze({
                applied: true,
                reason: 'DEFENSIVE_ACTION_ABANDONS_REALIZABLE_OFFENSE',
                bestAlternativeId: bestOffensiveAlternative.candidateId,
                bestAlternativeUtility: Number(bestOffensiveAlternative.objectiveUtility || 0),
                bestAlternativePotential: Number(bestOffensiveAlternative.atomicActionPotential || 0),
                selectedUtilityBeforeStall: Number(candidate.objectiveUtility || 0),
                urgentProblems: Object.freeze([]),
                explicitCounterPlan: hasExplicitCounterPlan,
              }),
            }
        : {
            ...candidate,
            objectiveStallAudit: Object.freeze({
              applied: false,
              reason: offensiveGoalConditions.length
                ? (hasRealizableOffensiveEdge ? 'DEFENSIVE_VALUE_PROTECTED' : 'NO_REALIZABLE_OFFENSE')
                : 'NO_OFFENSIVE_GOAL',
              bestAlternativeId: bestProgressAlternative?.candidateId || '',
              bestAlternativeUtility: Number(bestProgressAlternative?.objectiveUtility || 0),
              bestOffensiveAlternativeId: bestOffensiveAlternative?.candidateId || '',
              bestOffensivePotential: Number(bestOffensiveAlternative?.atomicActionPotential || 0),
              selectedUtilityBeforeStall: Number(candidate.objectiveUtility || 0),
              urgentProblems: Object.freeze([]),
              explicitCounterPlan: hasExplicitCounterPlan,
            }),
          };
    });
    const continuityCandidates = objectiveStallCandidates.map(candidate => {
      const candidateRouteKey = `${actionFamilyOf(candidate)}|${JSON.stringify(
        [...new Set((candidate?.declaration?.targetIds || []).map(String))].sort(),
      )}`;
      const sameStalledPattern =
        !!strategyDegeneration &&
        (
          (strategyDegeneration.routeKeys || []).includes(candidateRouteKey) ||
          (
            actionFamilyOf(candidate) === strategyDegeneration.actionFamily &&
            JSON.stringify(
              [...new Set((candidate?.declaration?.targetIds || []).map(String))].sort(),
            ) === JSON.stringify([...strategyDegeneration.targetIds].sort())
          )
        );
      const pivotAlternative = objectiveStallCandidates
        .filter(other =>
          other.candidateId !== candidate.candidateId &&
          !other.rejectionCode &&
          actionFamilyOf(other) !== strategyDegeneration?.actionFamily &&
          Number(other.objectiveUtility || 0) >= Number(candidate.objectiveUtility || 0) - 0.5
        )
        .sort((left, right) =>
          Number(right.objectiveUtility || 0) - Number(left.objectiveUtility || 0) ||
          String(left.candidateId || '').localeCompare(String(right.candidateId || ''))
        )[0] || null;
      const protectedContinuity =
        Number(candidate?.terminalEvidence?.response?.utilityDelta || 0) > 0.0001 ||
        Number(candidate?.objectiveProgressAudit?.progressGain || 0) > 0.05 ||
        Number(candidate?.crisisResponseAudit?.targetCapacityDelta || 0) > 0.05 ||
        Number(candidate?.crisisResponseAudit?.threatCapacityDelta || 0) > 0.05 ||
        (candidate?.repeatedActionAudit?.newlyDeniedOpportunityIds || []).length > 0 ||
        (candidate?.repeatedActionAudit?.extendedWindowIds || []).length > 0 ||
        Number(candidate?.repeatedActionAudit?.repeatedActionDelta || 0) > 0.05 ||
        Number(candidate?.vector?.expectedStateGain || 0) > 0.5;
      if (sameStalledPattern && pivotAlternative && !protectedContinuity && !candidate.rejectionCode) {
        return {
          ...candidate,
          rejectionCode: 'ZERO_PROGRESS',
          strategyContinuityAudit: Object.freeze({
            applied: true,
            reason: 'REPEATED_PATTERN_WITH_IGNORED_EVIDENCE',
            actionFamily: strategyDegeneration.actionFamily,
            pivotAlternativeId: pivotAlternative.candidateId,
            pivotAlternativeUtility: Number(pivotAlternative.objectiveUtility || 0),
          }),
        };
      }
      return {
        ...candidate,
        strategyContinuityAudit: Object.freeze({
          applied: false,
          reason: strategyDegeneration ? 'PROTECTED_OR_NO_PIVOT' : 'NO_DEGENERATED_PATTERN',
          actionFamily: actionFamilyOf(candidate),
          pivotAlternativeId: pivotAlternative?.candidateId || '',
          pivotAlternativeUtility: Number(pivotAlternative?.objectiveUtility || 0),
        }),
      };
    });
    const finalCandidates = continuityCandidates.map(candidate => {
      const bestAlternative = resourceAdaptedCandidates
        .filter(other => other.candidateId !== candidate.candidateId && !other.rejectionCode)
        .sort((left, right) =>
          Number(right?.objectiveUtility || 0) - Number(left?.objectiveUtility || 0) ||
          String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
        )[0] || null;
      const currentAlternativeGap = bestAlternative
        ? Math.max(0, Number(bestAlternative.objectiveUtility || 0) - Number(candidate.objectiveUtility || 0))
        : 0;
      return Object.freeze({
        ...candidate,
        repeatedActionAudit: Object.freeze({
          ...candidate.repeatedActionAudit,
          currentAlternativeGap,
          bestAlternativeCandidateId: String(bestAlternative?.candidateId || '').trim(),
          strategyContinuityAudit: candidate.strategyContinuityAudit || null,
        }),
      });
    });
    return finalCandidates.map(candidate => {
      const alternativeAudit = crisisAlternativeAudit(candidate, finalCandidates);
      const riskAudit = riskCompensationAudit(candidate);
      const rejectionCode =
        !candidate.rejectionCode &&
        alternativeAudit.status === 'UNJUSTIFIED'
          ? 'CRISIS_ALTERNATIVE_UNJUSTIFIED'
          : !candidate.rejectionCode &&
            Number(candidate?.objectiveUtility || 0) < -0.0001 &&
            riskAudit.riskDetected &&
            !riskAudit.compensated
            ? 'UNCOMPENSATED_RISK'
            : candidate.rejectionCode || '';
      return Object.freeze({
        ...candidate,
        rejectionCode,
        crisisAlternativeAudit: alternativeAudit,
        riskCompensationAudit: riskAudit,
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
    unitLevelCache = new WeakMap();
    perceivedEnemyBaseCache = new WeakMap();
    perceivedEnemyDamageCache = new WeakMap();
    relevantStateFingerprintCache = new WeakMap();
    worldEntriesCache = new WeakMap();
    worldUnitLookupCache = new WeakMap();
    aliveEntriesCache = new WeakMap();
    livingEntriesCache = new WeakMap();
    sideCache = new WeakMap();
    nextValueContextCache = new WeakMap();
    shieldThreatProfileCache = new WeakMap();
    resourceThreatProfileCache = new WeakMap();
    nextUtilityCache = new WeakMap();
    nextTeamCapacityCache = new WeakMap();
    decisionWorldRevisionCache = new WeakMap();
    decisionBeliefRevisionCache = new WeakMap();
    responseThreatSnapshotCache = new WeakMap();
    objectiveEvaluationCache = new WeakMap();
    unitCapacitySignatureCache = new WeakMap();
    sequenceCatalogMetaCache = new WeakMap();
    sequenceCatalogFingerprintCache = new WeakMap();
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
    const actor = findUnitInWorld(worldSnapshot, actorId);
    if (!actor || !preview.isAlive(actor) || hasActionCancellation(actor)) return { gain: 0, actionKind: '', candidateId: '' };
    const actorSide = sideOf(worldSnapshot, actor);
    const before = stateUtility(worldSnapshot, actorSide, beliefState);
    return enumerateCandidates({
      worldSnapshot,
      actorId,
      actionOpportunity: { role: 'ACTIVE', sequence: 1 },
      beliefState,
    }).filter(entry => {
      if (!['BASIC_ATTACK', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP'].includes(entry?.declaration?.actionKind)) return false;
      if (['BASIC_ATTACK', 'USE_ITEM', 'EQUIP'].includes(entry.declaration.actionKind)) return true;
      const effects = entry?.declaration?.skill?._效果数组;
      return Array.isArray(effects) && effects.length > 0 && effects.every(effect => String(effect?.原型 || '').trim());
    }).reduce((best, entry) => {
      const result = preview.previewAction({
        worldSnapshot,
        worldRevision: `${revision}:realizable:${actorId}`,
        beliefSnapshot: beliefState,
        beliefRevision: beliefRevisionFor(beliefState),
        actorId,
        declaration: entry.declaration,
        actionFingerprint: `realizable:${entry.candidateId}`,
        horizon: 'SHALLOW',
        previewBudget: { maxNodes: 12 },
      });
      const after = stateUtility(result.afterSnapshot, actorSide, beliefState);
      const gain = 100 * (after.utility - before.utility) / Math.max(1, before.total);
      return gain > best.gain
        ? {
            gain,
            actionKind: entry.declaration.actionKind,
            candidateId: entry.candidateId,
            targetIds: Object.freeze([...(entry.declaration.targetIds || [])]),
          }
        : best;
    }, { gain: 0, actionKind: '', candidateId: '' });
  }

  function realizableResourceSupportGain(context, result) {
    const recipients = new Set((result?.contributions || [])
      .filter(entry => entry?.outcomeKind === 'RESOURCE_OPTION_CHANGED' && Number(entry?.evidence?.delta || 0) > 0)
      .map(entry => String(entry?.targetId || '').trim()).filter(Boolean));
    return [...recipients].reduce((sum, targetId) => {
      const beforeAction = bestImmediateRealizableAction(context.worldSnapshot, targetId, context.beliefState, `${context.worldRevision}:before-support`);
      const afterAction = bestImmediateRealizableAction(result.afterSnapshot, targetId, context.beliefState, `${context.worldRevision}:after-support`);
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
    if (expectedDamageRatio < hpRatio - 1e-9) return 0;
    const survivalPriority = hpRatio <= 0.2 ? 2 : hpRatio <= 0.35 ? 1.5 : 1;
    return clamp(expectedDamageRatio * 100 * survivalPriority, 0, 60);
  }

  function estimatedHostileTargetProbability(context = {}, actor = null, actorSide = '') {
    const worldSnapshot = context.worldSnapshot || {};
    const currentActor = actor || findUnitInWorld(worldSnapshot, context.actorId);
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
    const actor = findUnitInWorld(worldSnapshot, context.actorId);
    if (!actor) return { value: 0, explicit: false, sourceId: '', arrivesBeforeNextOpportunity: false };
    const actorSide = sideOf(worldSnapshot, actor);
    const allyCount = Math.max(1, aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide).length);
    const targetProbability = estimatedHostileTargetProbability(context, actor, actorSide);
    const sourceId = String(context.actionOpportunity?.sourceActorId || '').trim();
    const source = sourceId ? findUnitInWorld(worldSnapshot, sourceId) : null;
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
    const actor = findUnitInWorld(context.worldSnapshot || {}, context.actorId);
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
    const actorBefore = findUnitInWorld(context.worldSnapshot, context.actorId);
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
      const targetBefore = findUnitInWorld(context.worldSnapshot, targetId);
      const targetAfter = findUnitInWorld(result.afterSnapshot, targetId);
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
    const actor = findUnitInWorld(worldSnapshot, actorId);
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
        const target = findUnitInWorld(worldSnapshot, event?.targetId || event?.targetName || '');
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
        const applicationProbability = clamp(
          Number(state?.__previewApplicationProbability ?? 1),
          0,
          1,
        );
        return sum +
          damage *
          Math.max(1, Number(state?.duration ?? state?.持续回合 ?? 1)) *
          applicationProbability;
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
    const threatSourceIds = protectId
      ? enemies
          .map(unit => ({
            id: preview.unitId(unit),
            threat: bestBaseActionValueAgainst(worldSnapshot, unit, protect),
          }))
          .filter(entry => entry.threat > 0.0001)
           .sort((left, right) =>
             right.threat - left.threat ||
             left.id.localeCompare(right.id)
           )
           .map(entry => entry.id)
      : [];
    const exploitableTargetId = exploitable ? preview.unitId(exploitable) : '';
    const exploiterIds = exploitableTargetId
      ? unitsBeforeTargetNextOpportunity(worldSnapshot, actorId, exploitableTargetId)
          .filter(unit =>
            sideOf(worldSnapshot, unit) === actorSide &&
            preview.isBattleCapable(unit) &&
            bestBaseActionValueAgainst(worldSnapshot, unit, exploitable) > 0.0001
          )
          .map(preview.unitId)
      : [];
    const evidenceEventIds = recentEvents.filter(event => {
      const actors = [String(event?.actorName || '').trim(), String(event?.targetName || '').trim()];
      return [focusId, protectId].filter(Boolean).some(id => {
        const unit = findUnitInWorld(worldSnapshot, id);
        return unit && actors.includes(preview.unitName(unit));
      });
    }).map(event => String(event?.eventId || '').trim()).filter(Boolean);
    return {
      focusTarget: focusId,
      protectTarget: protectId,
      exploitableWindow: exploitable ? `${hasActionCancellation(exploitable) ? 'ACTION_DENIED' : 'CHARGING'}:${preview.unitId(exploitable)}` : '',
      threatSourceIds,
      exploiterIds,
      protectedCrisis: protectedCrisis === true,
      evidenceEventIds: [...new Set(evidenceEventIds)],
    };
  }

  function teamIntentRealizationAudit({
    teamIntent = {},
    candidate = {},
    contributions = [],
    crisisAudit = null,
  } = {}) {
    const targetIds = new Set(
      (candidate?.declaration?.targetIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const focusTarget = String(teamIntent?.focusTarget || '').trim();
    const protectTarget = String(teamIntent?.protectTarget || '').trim();
    const candidateActorId = String(
      candidate?.declaration?.actorId ||
      candidate?.actorId ||
      '',
    ).trim();
    const threatSourceIds = new Set(
      (teamIntent?.threatSourceIds || []).map(value => String(value || '').trim()).filter(Boolean),
    );
    const exploitableTarget = String(teamIntent?.exploitableWindow || '').split(':').slice(1).join(':').trim();
    const exploiterIds = new Set(
      (teamIntent?.exploiterIds || []).map(value => String(value || '').trim()).filter(Boolean),
    );
    const outcomeKinds = new Set(contributions.map(entry =>
      String(entry?.outcomeKind || '').trim().toUpperCase()
    ));
    const focusMatched = !!focusTarget &&
      targetIds.has(focusTarget) &&
      contributions.some(entry => {
        if (String(entry?.targetId || '').trim() !== focusTarget) return false;
        const kind = String(entry?.outcomeKind || '').trim().toUpperCase();
        const delta = contributionExpectedDelta(entry);
        return (
          (kind === 'HP_DELTA' && delta < 0) ||
          (
            kind === 'ACTION_CANCELLED' &&
            Boolean(String(entry?.windowId || '').trim())
          ) ||
          kind === 'STATE_CHANGED'
        );
      });
    const protectMatched = !!protectTarget && contributions.some(entry => {
      if (String(entry?.targetId || '').trim() !== protectTarget) return false;
      const kind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const delta = contributionExpectedDelta(entry);
      return (
        ['HP_DELTA', 'SHIELD_DELTA', 'RESOURCE_OPTION_CHANGED'].includes(kind) &&
        delta > 0
      ) || kind === 'ACTION_GRANTED';
    });
    const threatSuppressed = contributions.some(entry => {
      const targetId = String(entry?.targetId || '').trim();
      if (!threatSourceIds.has(targetId)) return false;
      const kind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const delta = contributionExpectedDelta(entry);
      return (
        kind === 'ACTION_CANCELLED' &&
        Boolean(String(entry?.windowId || '').trim())
      ) ||
        (kind === 'HP_DELTA' && delta < 0) ||
        kind === 'STATE_CHANGED';
    });
    const exploitableWindowUsed = !!exploitableTarget &&
      targetIds.has(exploitableTarget) &&
      (exploiterIds.size === 0 || exploiterIds.has(candidateActorId)) &&
      (
        outcomeKinds.has('HP_DELTA') ||
        contributions.some(entry =>
          String(entry?.outcomeKind || '').trim().toUpperCase() === 'ACTION_CANCELLED' &&
          Boolean(String(entry?.windowId || '').trim())
        ) ||
        outcomeKinds.has('STATE_CHANGED')
      );
    const crisisChainRealized =
      crisisAudit?.required === true &&
      crisisAudit?.realized === true &&
      (
        !protectTarget ||
        (crisisAudit?.targetIds || []).includes(protectTarget) ||
        (crisisAudit?.threatSourceIds || []).some(targetId => threatSourceIds.has(targetId))
      );
    const protectionRequired = !!protectTarget &&
      ['SURVIVAL_CRISIS', 'ALLY_CRISIS'].includes(String(crisisAudit?.problemId || '').trim());
    const intentThreatSuppressed = threatSuppressed &&
      (!protectionRequired || crisisChainRealized);
    const applicable = !!(
      focusTarget ||
      protectTarget ||
      exploitableTarget ||
      threatSourceIds.size
    );
    return Object.freeze({
      applicable,
      focusTarget,
      protectTarget,
      threatSourceIds: Object.freeze([...threatSourceIds]),
      exploitableTarget,
      exploiterIds: Object.freeze([...exploiterIds]),
      candidateActorId,
      focusMatched,
      protectMatched,
      threatSuppressed: intentThreatSuppressed,
      exploitableWindowUsed,
      crisisRealized: crisisChainRealized,
      realizationEvidence: Object.freeze([
        focusMatched ? 'FOCUS_TARGET_PROGRESS' : '',
        protectMatched ? 'PROTECT_TARGET_PROGRESS' : '',
        intentThreatSuppressed ? 'THREAT_SOURCE_SUPPRESSED' : '',
        exploitableWindowUsed ? 'ELIGIBLE_EXPLOITER_USED_WINDOW' : '',
        crisisChainRealized ? 'CRISIS_CHAIN_REALIZED' : '',
      ].filter(Boolean)),
      realized: !applicable ||
        focusMatched ||
        protectMatched ||
        intentThreatSuppressed ||
        exploitableWindowUsed ||
        crisisChainRealized,
    });
  }

  function crisisThreatSourceIds(worldSnapshot = {}, actorSide = '', protectedUnit = {}) {
    return aliveEntries(worldSnapshot)
      .filter(entry => entry.side !== actorSide)
      .map(entry => ({
        id: preview.unitId(entry.unit),
        threat: bestBaseActionValueAgainst(worldSnapshot, entry.unit, protectedUnit),
      }))
      .filter(entry => entry.id && entry.threat > 0.0001)
      .sort((left, right) => right.threat - left.threat || left.id.localeCompare(right.id))
      .map(entry => entry.id);
  }

  function identifyProblems(worldSnapshot, actorId, beliefState = {}, options = {}) {
    const actor = findUnitInWorld(worldSnapshot, actorId);
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
    const resourceThreatProfile = resourceThreatProfileFor(worldSnapshot);
    Object.entries(resourceThreatProfile).forEach(([targetId, resources]) => {
      const target = findUnitInWorld(worldSnapshot, targetId);
      if (!target || sideOf(worldSnapshot, target) !== actorSide) return;
      const targetCapacity = preview.calculateUnitCapacity({
        unit: target,
        survivalProbability: preview.readHp(target) / preview.readHpMax(target),
        actionAvailability: hasActionCancellation(target) ? 0 : actionQualityMultiplier(target),
        bestLegalBaseActionValue: bestBaseActionValue(worldSnapshot, target),
      });
      Object.values(resources || {}).forEach(profile => {
        if (!profile || (
          (!Array.isArray(profile.activeSourceIds) || !profile.activeSourceIds.length) &&
          profile.absoluteShortage !== true &&
          profile.lowReserve !== true
        )) return;
        const projected = Number(profile.projected || 0);
        const pressureRatio = clamp(Number(profile.pressureRatio || 0), 0, 1);
        if (!(
          profile.persistent === true ||
          profile.absoluteShortage === true ||
          profile.lowReserve === true ||
          projected <= 0 ||
          pressureRatio >= 0.5
        )) return;
        problems.push({
          problemId: profile.resourceKey === 'vit'
            ? 'RESOURCE_SURVIVAL_CRISIS'
            : 'RESOURCE_ACTION_CRISIS',
          targetIds: [targetId],
          severity: normalizedLoss(targetCapacity * Math.max(
            projected <= 0 ? 1 : 0.25,
            pressureRatio,
          )),
          evidence: {
            resourceKey: profile.resourceKey,
            current: Number(profile.current || 0),
            nextLoss: Number(profile.nextLoss || 0),
            projected,
            persistent: profile.persistent === true,
            absoluteShortage: profile.absoluteShortage === true,
            lowReserve: profile.lowReserve === true,
            costedActionCount: Number(profile.costedActionCount || 0),
            affordableActionCount: Number(profile.affordableActionCount || 0),
            sourceIds: profile.sourceIds,
            eventIds: profile.eventIds,
          },
        });
      });
    });
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
    const criticalAllies = aliveEntries(worldSnapshot)
      .filter(entry =>
        entry.side === actorSide &&
        preview.unitId(entry.unit) !== actorId &&
        preview.readHp(entry.unit) / preview.readHpMax(entry.unit) <= 0.3
      )
      .sort((left, right) =>
        preview.readHp(left.unit) / preview.readHpMax(left.unit) -
        preview.readHp(right.unit) / preview.readHpMax(right.unit)
      );
    criticalAllies.forEach(criticalAlly => {
      const allyCapacity = preview.calculateUnitCapacity({
        unit: criticalAlly.unit,
        survivalProbability: preview.readHp(criticalAlly.unit) / preview.readHpMax(criticalAlly.unit),
        actionAvailability: hasActionCancellation(criticalAlly.unit) ? 0 : actionQualityMultiplier(criticalAlly.unit),
        bestLegalBaseActionValue: bestBaseActionValue(worldSnapshot, criticalAlly.unit),
      });
      problems.push({
        problemId: 'ALLY_CRISIS',
        targetIds: [preview.unitId(criticalAlly.unit)],
        severity: normalizedLoss(allyCapacity * (1 - preview.readHp(criticalAlly.unit) / preview.readHpMax(criticalAlly.unit))),
        evidence: {
          threatSourceIds: crisisThreatSourceIds(worldSnapshot, actorSide, criticalAlly.unit),
        },
      });
    });
    const protectedAllies = aliveEntries(worldSnapshot).filter(entry =>
      entry.side === actorSide &&
      preview.unitId(entry.unit) !== actorId &&
      protectionConditions.some(condition =>
        condition.side === objectiveContext.ownSide &&
        ['UNIT_DAMAGED', 'UNIT_INCAPACITATED', 'ROUND_REACHED'].includes(condition.type) &&
        (!condition.targetIds?.length || condition.targetIds.includes(preview.unitId(entry.unit)) || condition.targetIds.includes(preview.unitName(entry.unit)))
      )
    );
    protectedAllies
      .filter(protectedAlly => !criticalAllies.some(criticalAlly =>
        preview.unitId(criticalAlly.unit) === preview.unitId(protectedAlly.unit)
      ))
      .forEach(protectedAlly => {
      problems.push({
        problemId: 'ALLY_CRISIS',
        targetIds: [preview.unitId(protectedAlly.unit)],
        severity: normalizedLoss(capacity.own * 0.2),
        evidence: {
          threatSourceIds: crisisThreatSourceIds(worldSnapshot, actorSide, protectedAlly.unit),
        },
      });
      });
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
    const terminalEnemy = primaryCombatantEntries(worldSnapshot)
      .filter(entry => entry.side !== actorSide)
      .find(entry => Number(beliefState?.units?.[preview.unitId(entry.unit)]?.hpRatio ?? 1) <= 0.2);
    if (terminalEnemy) problems.push({ problemId: 'TERMINAL_OPPORTUNITY', targetIds: [preview.unitId(terminalEnemy.unit)], severity: normalizedLoss(perceivedEnemyBaseValue(beliefState?.units?.[preview.unitId(terminalEnemy.unit)] || {})) });
    objectiveContext.successConditions.filter(condition => condition.type === 'HP_RATIO_AT_OR_BELOW').forEach(condition => {
      primaryCombatantEntries(worldSnapshot).filter(entry => entry.side !== actorSide).filter(entry =>
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
    const actor = findUnitInWorld(context.worldSnapshot, context.actorId);
    const actorSide = sideOf(context.worldSnapshot, actor);
    const immediateSourceId = String(context.actionOpportunity?.sourceActorId || '').trim();
    const immediateAction = context.actionOpportunity?.incomingAction;
    const immediateSource = immediateSourceId ? findUnitInWorld(context.worldSnapshot, immediateSourceId) : null;
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
    const pendingHostileIds = (context.actionOpportunity?.pendingHostileActorIds || [])
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const pendingOrder = new Map(pendingHostileIds.map((unitId, index) => [unitId, index]));
    const responders = aliveEntries(context.worldSnapshot)
      .filter(entry => entry.side !== actorSide && preview.isBattleCapable(entry.unit))
      .filter(entry => !pendingHostileIds.length || pendingOrder.has(preview.unitId(entry.unit)))
      .filter(entry => {
        const charge = entry.unit?.蓄力技能;
        if (!charge) return true;
        const remainingCastTime = Math.max(0, Number(
          charge?.cast_time ?? charge?.skill?.前摇 ?? charge?.前摇 ?? 0
        ));
        return remainingCastTime <= 40;
      })
      .sort((left, right) => {
        const leftId = preview.unitId(left.unit);
        const rightId = preview.unitId(right.unit);
        if (pendingHostileIds.length) {
          return Number(pendingOrder.get(leftId)) - Number(pendingOrder.get(rightId));
        }
        return preview.compareNaturalActionOrder(left.unit, right.unit);
      });
    const targetProbability = estimatedHostileTargetProbability(context, actor, actorSide);
    const before = context.beforeUtility || stateUtility(context.worldSnapshot, actorSide, context.beliefState || {});
    const responseCapacityScale = Math.max(0, Number(before.own || 0)) / Math.max(1, Number(before.total || 0));
    const unknownMass = unknownResponseMass(context.beliefState?.confidence);
    const knownMass = 1 - unknownMass;
    const temperature = 1 + 3 * (1 - clamp(context.beliefState?.confidence || 0, 0, 1));
    return responders.map((entry, sequenceIndex) => {
      const sourceActorId = preview.unitId(entry.unit);
      const known = Array.isArray(context.beliefState?.publicResponses?.[sourceActorId])
        ? context.beliefState.publicResponses[sourceActorId]
        : [];
      const utilities = known.map(response =>
        Math.max(0, Number(response?.baseActionValue ?? response?.utility ?? 0)));
      const center = median(utilities);
      const deviations = utilities.map(value => Math.abs(value - center));
      const rawMad = median(deviations);
      const meanDeviation = deviations.length
        ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length
        : 0;
      const scale = rawMad > 1e-9 ? rawMad : meanDeviation > 1e-9 ? meanDeviation : 1;
      const weighted = known.map(response => {
        const rawThreat = Math.max(0, Number(response?.baseActionValue ?? response?.utility ?? 0));
        return {
          response,
          rawThreat,
          weight: Math.exp(((rawThreat - center) / scale) / temperature),
        };
      });
      const totalWeight = weighted.reduce((sum, response) => sum + response.weight, 0) || 1;
      const expectedKnownThreat = weighted.reduce(
        (sum, response) => sum + response.rawThreat * response.weight / totalWeight,
        0,
      );
      const targetBelief = context.beliefState?.units?.[sourceActorId] || {};
      const unknownThreat = Math.max(0, perceivedEnemyBaseValue(targetBelief, actor));
      const fallbackThreat = known.length
        ? 0
        : Math.max(
            unknownThreat,
            bestBaseActionValueAgainst(context.worldSnapshot, entry.unit, actor),
          );
      const rawThreat = known.length
        ? knownMass * expectedKnownThreat + unknownMass * unknownThreat
        : fallbackThreat;
      const response = Object.freeze({
        responseId: `HOSTILE_RESPONSE:${sourceActorId}:${sequenceIndex + 1}`,
        sourceActorId,
        probability: targetProbability,
        utility: -rawThreat * responseCapacityScale,
        rawThreat,
        lethal: rawThreat >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
        unknown: unknownMass > 0,
        explicit: false,
        sequenceIndex,
        knownResponseCount: known.length,
      });
      return Object.freeze({
        ...response,
        responseSequence: Object.freeze([response]),
      });
    }).filter(branch => branch.rawThreat > 0 && branch.probability > 0);
  }

  function activeStrategyMemory(memory = {}, worldSnapshot = {}, opportunity = {}, candidates = []) {
    if (!memory || typeof memory !== 'object') return {};
    const sequence = Math.max(0, Number(opportunity?.sequence || 0));
    if (Number(memory?.expiresAtOpportunity || 0) < sequence) return {};
    const targets = Array.isArray(memory?.targetIds) ? memory.targetIds.map(String).filter(Boolean) : [];
    if (targets.some(targetId => !preview.isAlive(findUnitInWorld(worldSnapshot, targetId) || {}))) return {};
    const expected = new Set(Array.isArray(memory?.expectedOutcomeKinds) ? memory.expectedOutcomeKinds.map(String) : []);
    if (expected.has('ACTION_CANCELLED') && !targets.some(targetId => hasActionCancellation(findUnitInWorld(worldSnapshot, targetId) || {}))) return {};
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
    const evaluate = snapshot => {
      let byObjectives = objectiveEvaluationCache.get(snapshot);
      if (!byObjectives) {
        byObjectives = new WeakMap();
        objectiveEvaluationCache.set(snapshot, byObjectives);
      }
      if (!byObjectives.has(objectives)) {
        byObjectives.set(
          objectives,
          preview.evaluateBattleObjectives(snapshot, objectives, { roundCompleted: false }),
        );
      }
      return byObjectives.get(objectives);
    };
    const before = evaluate(beforeSnapshot);
    if (before.terminal) return 0;
    const after = evaluate(afterSnapshot);
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
      .filter(condition => [
        'UNIT_DAMAGED',
        'UNIT_INCAPACITATED',
        'UNIT_DEAD',
        'HP_RATIO_AT_OR_BELOW',
      ].includes(condition.type))
      .filter(condition => Array.isArray(condition.targetIds) && condition.targetIds.length > 0)
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
        if (condition.type === 'UNIT_DAMAGED') {
          return responseThreat > 0 ? clamp(responseThreat, 0, 1) : 0;
        }
        if (condition.type === 'HP_RATIO_AT_OR_BELOW') {
          const threshold = clamp(Number(condition.threshold || 0), 0, 1);
          const margin = Math.max(0, hpRatio - threshold);
          return responseThreat > 0
            ? clamp(responseThreat / Math.max(0.0001, responseThreat + margin), 0, 1)
            : 0;
        }
        return responseThreat > 0
          ? clamp(responseThreat / Math.max(0.0001, responseThreat + hpRatio), 0, 1)
          : 0;
      });
      if (condition.type === 'TEAM_INCAPACITATED' || condition.type === 'TEAM_DEAD') {
        return condition.scope === 'ALL' ? Math.min(...risks) : Math.max(...risks);
      }
      return condition.scope === 'ALL' ? Math.max(...risks) : Math.min(...risks);
    };
    const includeFailureRisk = context?.includeFailureRisk !== false;
    const survivalRiskReduction = includeFailureRisk
      ? survivalConditions.reduce((best, condition) => Math.max(
          best,
          futureFailureRisk(beforeSnapshot, condition) - futureFailureRisk(afterSnapshot, condition),
        ), 0)
      : 0;
    const failureRiskReduction = survivalRiskReduction;
    const failureRiskUtility = 100 * survivalRiskReduction * urgency;
    if (!goalProfile) {
      return {
        utility: includeFailureRisk ? Math.min(100, failureRiskUtility) : 0,
        goalUtility: 0,
        failureRiskReduction,
        failureRiskUtility,
        deadlineActive: false,
        progressGain: 0,
        requiredProgress: 0,
        deadlineFeasible: true,
      };
    }
    const goalUtility = clamp(
      goalProfile.utility,
      context?.useJointIncapacitationProgress === true ? -100 * urgency : -100,
      context?.useJointIncapacitationProgress === true ? 100 * urgency : 100,
    );
    return {
      ...goalProfile,
      utility: includeFailureRisk && survivalRiskReduction > 1e-9
        ? Math.max(goalUtility, failureRiskUtility)
        : goalUtility,
      goalUtility,
      failureRiskReduction,
      failureRiskUtility,
    };
  }

  function nonDuplicatedObjectiveProgressValue(
    beforeProfile = {},
    afterProfile = {},
    representedCapacityGain = 0,
  ) {
    const newlyFeasible =
      afterProfile?.deadlineActive === true &&
      afterProfile?.deadlineFeasible !== false &&
      beforeProfile?.deadlineFeasible === false;
    const progressGain = Math.max(
      0,
      Number(afterProfile?.goalUtility ?? afterProfile?.utility ?? 0) -
      Number(beforeProfile?.goalUtility ?? beforeProfile?.utility ?? 0),
    );
    if (!(progressGain > 0)) return 0;
    if (Math.max(0, Number(representedCapacityGain || 0)) > 0.0001) return 0;
    if (!newlyFeasible && String(afterProfile?.source || '').trim() !== 'IMPLICIT_INCAPACITATION_RESIDUAL') {
      return 0;
    }
    return Math.max(
      0,
      progressGain,
    );
  }

  function buildMechanicObservations(candidate, actor, worldSnapshot, beliefState, withdrawalEstimate = null, withdrawalTargetId = '') {
    const observations = [];
    const candidateId = String(candidate?.candidateId || '').trim();
    const actionKind = String(candidate?.declaration?.actionKind || 'RELEASE_SKILL').trim().toUpperCase();
    const targetIds = Array.isArray(candidate?.declaration?.targetIds)
      ? candidate.declaration.targetIds
      : [];
    const candidateEffects = preview.collectEffects(
      candidate?.declaration?.actionKind === 'BASIC_ATTACK'
        ? { _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }] }
        : candidate?.declaration?.skill || {},
    );
    const experience = experienceOf(actor);
    candidateEffects
      .filter(effect => String(effect?.原型 || '').trim() === '状态施加')
      .forEach(effect => targetIds.forEach(targetId => {
        const estimatedProbability = probabilityValue(effect?.成功率 ?? effect?.触发概率, 0.65);
        const relevantFingerprint = relevantStateFingerprint(beliefState, targetId);
        const key = mechanicKey({
          sourceActionId: candidateId,
          effectPrototype: '状态施加',
          targetId,
          relevantStateFingerprint: relevantFingerprint,
        });
        const stateName = String(effect?.状态 || effect?.状态名称 || '').trim();
        const adaptationKey = mechanicAdaptationKey({
          actionKind,
          effectPrototype: '状态施加',
          targetId,
          stateName,
          relevantStateFingerprint: relevantFingerprint,
        });
        observations.push({
          mechanicKey: key,
          adaptationKey,
          sourceActionId: candidateId,
          effectPrototype: '状态施加',
          targetId,
          stateName,
          relevantStateFingerprint: relevantFingerprint,
          estimatedProbability,
          experience,
          posterior: mechanicPosteriorWithAdaptation({
            beliefState,
            mechanicKey: key,
            adaptationKey,
            estimatedProbability,
            experience,
          }),
        });
      }));
    candidateEffects
      .map((effect, effectIndex) => ({ effect, effectIndex }))
      .filter(({ effect }) => String(effect?.原型 || '').trim() === '伤害结算')
      .forEach(({ effect, effectIndex }) => targetIds.forEach(targetId => {
        const target = findUnitInWorld(worldSnapshot, targetId);
        if (!target) return;
        const estimatedProbability = preview.estimateHitProbability(actor, target, effect);
        const relevantFingerprint = relevantStateFingerprint(beliefState, targetId);
        const key = hitMechanicKey({
          sourceActionId: candidateId,
          targetId,
          effectIndex,
          effect,
          beliefState,
        });
        const adaptationKey = mechanicAdaptationKey({
          actionKind,
          effectPrototype: '命中判定',
          targetId,
          damageClassName: damageClass(effect?.伤害类型),
          relevantStateFingerprint: relevantFingerprint,
        });
        observations.push({
          mechanicKey: key,
          adaptationKey,
          sourceActionId: candidateId,
          effectPrototype: '命中判定',
          effectIndex,
          targetId,
          damageClass: damageClass(effect?.伤害类型),
          relevantStateFingerprint: relevantFingerprint,
          estimatedProbability,
          experience,
          posterior: mechanicPosteriorWithAdaptation({
            beliefState,
            mechanicKey: key,
            adaptationKey,
            estimatedProbability,
            experience,
          }),
        });
      }));
    if (withdrawalEstimate && withdrawalTargetId) {
      const relevantFingerprint = relevantStateFingerprint(beliefState, withdrawalTargetId);
      const key = mechanicKey({
        sourceActionId: 'WITHDRAW',
        effectPrototype: '撤离判定',
        targetId: withdrawalTargetId,
        relevantStateFingerprint: relevantFingerprint,
      });
      const adaptationKey = mechanicAdaptationKey({
        actionKind: 'WITHDRAW',
        effectPrototype: '撤离判定',
        targetId: withdrawalTargetId,
        relevantStateFingerprint: relevantFingerprint,
      });
      observations.push({
        mechanicKey: key,
        adaptationKey,
        sourceActionId: 'WITHDRAW',
        effectPrototype: '撤离判定',
        targetId: withdrawalTargetId,
        stateName: '撤离',
        relevantStateFingerprint: relevantFingerprint,
        estimatedProbability: withdrawalEstimate.successProbability,
        experience,
        posterior: mechanicPosteriorWithAdaptation({
          beliefState,
          mechanicKey: key,
          adaptationKey,
          estimatedProbability: withdrawalEstimate.successProbability,
          experience,
        }),
      });
    }
    return Object.freeze(observations);
  }

  function scoreCandidate(candidate, context) {
    const actor = findUnitInWorld(context.worldSnapshot, context.actorId);
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
        hitProbabilityResolver: candidateHitProbabilityResolver({
          beliefState: context.beliefState,
          actor,
          candidate,
          worldSnapshot: context.worldSnapshot,
        }),
        applicationProbabilityResolver: candidateApplicationProbabilityResolver({
          beliefState: context.beliefState,
          actor,
          candidate,
        }),
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
    const resourceSupportOnly = candidateEffects.length > 0 &&
      candidateEffects.every(isPositiveResourceSupportEffect);
    const damageEffects = candidate.declaration.actionKind === 'BASIC_ATTACK'
      ? [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }]
      : candidateEffects;
    const withdrawalProfile = candidate.declaration.actionKind === 'WITHDRAW'
      ? aliveEntries(context.worldSnapshot)
          .filter(entry => entry.side !== actorSide)
          .map(entry => ({ targetId: preview.unitId(entry.unit), estimate: preview.estimateWithdrawal(actor, entry.unit) }))
          .sort((left, right) => left.estimate.successProbability - right.estimate.successProbability)[0] || null
      : null;
    const withdrawalEstimate = withdrawalProfile?.estimate || null;
    const mechanicObservations = buildMechanicObservations(
      candidate,
      actor,
      context.worldSnapshot,
      context.beliefState,
      withdrawalEstimate,
      withdrawalProfile?.targetId || '',
    );
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
        const targetBefore = findUnitInWorld(context.worldSnapshot, targetId);
        const targetAfter = findUnitInWorld(result.afterSnapshot, targetId);
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
    const objectivePaceBefore = candidate.counterDeclineFallback
      ? { utility: 0, goalUtility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true }
      : terminalUtility === 0
        ? intentProgressUtility(context.worldSnapshot, context.worldSnapshot, actorSide, context)
        : { utility: 0, goalUtility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true };
    const objectivePace = candidate.counterDeclineFallback
      ? { utility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true }
      : terminalUtility === 0
      ? intentProgressUtility(context.worldSnapshot, result?.afterSnapshot || context.worldSnapshot, actorSide, context)
      : { utility: 0, deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true };
    const objectiveProgress = nonDuplicatedObjectiveProgressValue(
      objectivePaceBefore,
      objectivePace,
      expectedStateGain,
    );
    const actionCancelled = (result?.contributions || []).some(entry => entry.outcomeKind === 'ACTION_CANCELLED');
    let controlOverlap = false;
    if (actionCancelled) {
      const targetId = candidate.declaration.targetIds?.[0] || '';
      const target = findUnitInWorld(context.worldSnapshot, targetId);
      controlOverlap = !!target && hasActionCancellation(target);
    }
    const ephemeralWindowGain = estimateEphemeralStateWindowGain(
      ephemeralAvoidanceEffects,
      result,
      { ...context, candidateTargetIds: candidate.declaration.targetIds || [] },
    );
    expectedStateGain += 100 * Math.max(0, ephemeralWindowGain) / Math.max(1, before.total);
    const directStateGain = expectedStateGain;
    const informationValue = estimateInformationValue({
      ...context,
      candidate,
      predictedContributions: result?.contributions || [],
    });
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
      const source = findUnitInWorld(context.worldSnapshot, branch?.sourceActorId || '');
      const sourceAfter = findUnitInWorld(result?.afterSnapshot || context.worldSnapshot, branch?.sourceActorId || '');
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
      const baselineSource = findUnitInWorld(context.worldSnapshot, branch?.sourceActorId || '');
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
    const actorAfter = result ? findUnitInWorld(result.afterSnapshot, preview.unitId(actor)) : null;
    const firstAlly = opensAllyWindow
      ? firstAllyBeforeActorNextOpportunity(
          result?.afterSnapshot || context.worldSnapshot,
          actorAfter || actor,
          actorSide,
        )
      : null;
    const deepTimeline = deepRequired ? [
      { nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId },
      ...resultTimeline,
      ...branches.map(branch => ({ nodeType: branch.unknown ? 'UNKNOWN_RESPONSE' : 'KNOWN_RESPONSE', ...branch })),
      ...(opensAllyWindow
        ? [{ nodeType: 'FIRST_ALLY_WINDOW', actorId: firstAlly ? preview.unitId(firstAlly) : '', baseActionValue: firstAlly ? bestBaseActionValue(result?.afterSnapshot || context.worldSnapshot, firstAlly) : 0 }]
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
        if (entry.outcomeKind === 'RESOURCE_OPTION_CHANGED') {
          return Number(evidence.delta || 0) > 0 &&
            String(entry?.windowId || '').trim() !== 'ACTION_COST';
        }
        if (entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
          return Math.abs(Number(evidence.delta || 0)) > 0.0001 || Number(evidence.multiplier || 0) > 0;
        }
        if (entry.outcomeKind === 'STATE_CHANGED') return evidence.marginal !== false;
        return ['ACTION_CANCELLED', 'ACTION_GRANTED', 'BELIEF_CHANGED', 'RULE_CHANGED', 'SUMMON_WINDOW', 'IRREVERSIBLE_ASSET_LOST'].includes(entry.outcomeKind);
      })
    );
    const stateHasMarginalValue = stateEffects.some(effect => (candidate.declaration.targetIds || [])
      .map(targetId => findUnitInWorld(context.worldSnapshot, targetId))
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
        return Math.abs(Number(evidence.delta || 0)) > 0.0001 &&
          String(entry?.windowId || '').trim() !== 'ACTION_COST';
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
      predictedOutcomeEvidence: predictedOutcomeEvidence(
        result,
        context?.visibleWorldSnapshot,
      ),
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
        noResponseProbability: Math.max(
          0,
          1 - clamp(branches.reduce((sum, branch) => sum + Number(branch?.probability || 0), 0), 0, 1),
        ),
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
        resourceOpportunityCost: 0,
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
    const deviations = eligible.map(candidate => Math.abs(candidate.objectiveUtility - center));
    const rawMad = median(deviations);
    const meanDeviation = deviations.length
      ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length
      : 0;
    const scale = rawMad > 1e-9 ? rawMad : meanDeviation > 1e-9 ? meanDeviation : 1;
    return candidates.map(candidate => ({
      ...candidate,
      normalizedUtility: (candidate.objectiveUtility - center) / scale,
    }));
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
    const tiePreference = candidate => {
      if (candidate?.teamIntentAudit?.realized === true) return 2;
      return (candidate.declaration.targetIds || []).some(targetId => preferredTargets.has(String(targetId))) ? 1 : 0;
    };
    const initiallyEligible = candidates.filter(candidate => !candidate.rejectionCode);
    const bestCandidate = [...initiallyEligible].sort((left, right) =>
      Number(right?.objectiveUtility || 0) - Number(left?.objectiveUtility || 0) ||
      String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
    )[0] || null;
    const interferenceSource = String(
      context?.beliefState?.interferenceSource ||
      context?.beliefState?.decisionInterference?.sourceActionId ||
      context?.beliefState?.decisionInterference?.sourceEventId ||
      (context?.beliefState?.confused === true || context?.beliefState?.targetInterferencePossible === true
        ? 'PUBLIC_BELIEF_INTERFERENCE'
        : ''),
    ).trim();
    const selectionResult = (selected, selectionPath, {
      confidence = 1,
      temperature = 0,
      maxNormalizedRegret = 0,
      seedRoll = null,
    } = {}) => ({
      selected,
      confidence,
      temperature,
      maxNormalizedRegret,
      selectionPath,
      bestCandidateId: String(bestCandidate?.candidateId || selected?.candidateId || '').trim(),
      selectedCandidateId: String(selected?.candidateId || '').trim(),
      normalizedRegret: Math.max(
        0,
        Number(bestCandidate?.normalizedUtility || 0) -
          Number(selected?.normalizedUtility || 0),
      ),
      interferenceSource,
      seedRoll,
    });
    const hasNonnegativeAlternative = initiallyEligible.some(candidate => candidate.objectiveUtility >= -1e-9);
    const bestPositiveUtility = initiallyEligible.reduce(
      (best, candidate) => Math.max(best, Number(candidate?.objectiveUtility || 0)),
      0,
    );
    const meaningfulPositiveFloor = bestPositiveUtility >= 0.05
      ? Math.max(0.001, bestPositiveUtility * 0.02)
      : 0;
    const eligible = initiallyEligible.filter(candidate =>
      !hasNonnegativeAlternative || candidate.objectiveUtility >= -1e-9 || Number(candidate.vector?.terminalUtility || 0) > 0,
    ).filter(candidate =>
      meaningfulPositiveFloor <= 0 ||
      Number(candidate?.objectiveUtility || 0) >= meaningfulPositiveFloor ||
      Number(candidate?.vector?.terminalUtility || 0) > 0,
    ).sort((left, right) => {
      const utilityGap = right.normalizedUtility - left.normalizedUtility;
      if (Math.abs(utilityGap) > 0.05) return utilityGap;
      return tiePreference(right) - tiePreference(left) || left.candidateId.localeCompare(right.candidateId);
    });
    if (!eligible.length) {
      const defend = candidates.find(candidate => candidate.declaration.actionKind === 'DEFEND');
      if (!defend) throw new Error('battle_decision_no_legal_fallback');
      return selectionResult(
        { ...defend, rejectionCode: '', classification: 'VIABLE', alternativeGap: 0, forcedFallback: true, fallbackReason: 'NO_ELIGIBLE_CANDIDATE' },
        'FORCED_FALLBACK',
      );
    }
    const confidence = 0.5 * experienceOf(actor) + 0.3 * ratio(actor, 'men') + 0.2 * ratio(actor, 'vit');
    const temperature = 0.8 + (1 - confidence) * 1.8;
    const maxNormalizedRegret = 0.35 + (1 - confidence) * 0.9;
    if (eligible.every(candidate => Number(candidate?.objectiveUtility || 0) < 0)) {
      return selectionResult(bestCandidate || eligible[0], 'ALL_OPTIONS_NEGATIVE', {
        confidence,
        temperature,
        maxNormalizedRegret,
      });
    }
    if (context?.actionOpportunity?.forcedSkill) {
      return selectionResult(eligible[0], 'FORCED_ACTION', {
        confidence,
        temperature,
        maxNormalizedRegret,
      });
    }
    if (eligible[0]?.forcedFallback === true) {
      return selectionResult(eligible[0], 'FORCED_FALLBACK', {
        confidence,
        temperature,
        maxNormalizedRegret,
      });
    }
    if (eligible.length === 1 || eligible[0].normalizedUtility - eligible[1].normalizedUtility >= 2 * temperature) {
      return selectionResult(eligible[0], 'DIRECT_BEST', {
        confidence,
        temperature,
        maxNormalizedRegret,
      });
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
    const seedRoll = stableRoll(`${seed}|${preview.unitId(actor)}|${regretPool.map(candidate => candidate.candidateId).join('|')}`);
    let roll = seedRoll * weighted.reduce((sum, item) => sum + item.weight, 0);
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return selectionResult(item.candidate, 'SEEDED_SOFTMAX', {
          confidence,
          temperature,
          maxNormalizedRegret,
          seedRoll,
        });
      }
    }
    return selectionResult(weighted[0].candidate, 'SEEDED_SOFTMAX', {
      confidence,
      temperature,
      maxNormalizedRegret,
      seedRoll,
    });
  }

  function normalizedTargetIds(worldSnapshot, declaration = {}) {
    return (Array.isArray(declaration?.targetIds) ? declaration.targetIds : [])
      .map(targetId => {
        const unit = findUnitInWorld(worldSnapshot, targetId);
        return unit ? preview.unitId(unit) : String(targetId || '').trim();
      })
      .filter(Boolean);
  }

  function matchesPlayerLockedDeclaration(candidate = {}, declaration = {}, worldSnapshot = {}) {
    const candidateDeclaration = candidate?.declaration || {};
    if (String(candidateDeclaration.actionKind || '').trim() !== String(declaration.actionKind || '').trim()) return false;
    const candidateTargets = normalizedTargetIds(worldSnapshot, candidateDeclaration);
    const lockedTargets = normalizedTargetIds(worldSnapshot, declaration);
    if (candidateTargets.length !== lockedTargets.length || candidateTargets.some((id, index) => id !== lockedTargets[index])) return false;
    const lockedFusionKey = String(declaration?.fusionKey || '').trim();
    const candidateFusionKey = String(candidateDeclaration?.fusionKey || '').trim();
    if (lockedFusionKey && candidateFusionKey !== lockedFusionKey) return false;
    const lockedSkill = declaration?.skill && typeof declaration.skill === 'object' ? declaration.skill : null;
    const candidateSkill = candidateDeclaration?.skill && typeof candidateDeclaration.skill === 'object'
      ? candidateDeclaration.skill
      : null;
    if (lockedSkill || candidateSkill) {
      if (skillId(lockedSkill || {}) !== skillId(candidateSkill || {})) return false;
    }
    const lockedEquipmentSignature = String(declaration?.equipmentSignature || '').trim();
    const candidateEquipmentSignature = String(candidateDeclaration?.equipmentSignature || candidate?.equipmentSignature || '').trim();
    if (lockedEquipmentSignature && candidateEquipmentSignature !== lockedEquipmentSignature) return false;
    return true;
  }

  function selectPlayerLockedCandidate(candidates = [], declaration = {}, worldSnapshot = {}) {
    const selected = candidates.find(candidate => matchesPlayerLockedDeclaration(candidate, declaration, worldSnapshot));
    if (!selected) throw new Error('battle_player_locked_declaration_mechanically_illegal');
    return {
      selected: {
        ...selected,
        selected: true,
        playerLocked: true,
        selectionMode: 'PLAYER_LOCKED',
      },
      confidence: 1,
      temperature: 0,
      maxNormalizedRegret: 0,
      selectionPath: 'PLAYER_LOCKED',
      bestCandidateId: String(selected?.candidateId || '').trim(),
      selectedCandidateId: String(selected?.candidateId || '').trim(),
      normalizedRegret: 0,
      interferenceSource: '',
      seedRoll: null,
    };
  }

  function prepareKernelContext(input = {}) {
    const worldSnapshot = input?.worldSnapshot;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_decision_world_missing');
    const sourceActor = findUnitInWorld(worldSnapshot, input?.actorId);
    if (!sourceActor || !preview.isAlive(sourceActor)) throw new Error('battle_decision_actor_unavailable');
    const beliefState = buildInitialBelief(worldSnapshot, preview.unitId(sourceActor), input?.beliefState || {});
    const decisionWorld = buildDecisionWorld(worldSnapshot, preview.unitId(sourceActor), beliefState);
    const actor = findUnitInWorld(decisionWorld, preview.unitId(sourceActor));
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
      visibleWorldSnapshot: worldSnapshot,
      actorId: preview.unitId(actor),
      battleIntent,
      beliefState,
      teamIntent,
      problems,
      strategicSignature: strategicSignatureValue,
      stalemate,
      worldRevision: String(input?.worldRevision || `decision:${decisionRevisionSequence}`),
      beliefRevision: beliefRevisionFor(beliefState),
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
      visibleWorldSnapshot: input?.worldSnapshot,
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

  function candidateAuditRecord(candidate = {}) {
    const declaration = candidate?.declaration || {};
    const skill = declaration?.skill || {};
    return Object.freeze({
      candidateId: String(candidate?.candidateId || '').trim(),
      actionName: candidateActionName(candidate),
      actionKind: String(declaration?.actionKind || '').trim(),
      targetIds: Object.freeze([...(declaration?.targetIds || [])]),
      declaration: Object.freeze({
        actionKind: String(declaration?.actionKind || '').trim(),
        targetIds: Object.freeze([...(declaration?.targetIds || [])]),
        resourceCosts: Object.freeze({ ...(declaration?.resourceCosts || candidate?.costs || {}) }),
        skill: skill && typeof skill === 'object'
          ? Object.freeze({
              id: String(skill?.id || skill?.技能ID || skill?.物品ID || '').trim(),
              name: String(skill?.name || skill?.魂技名 || skill?.技能名称 || skill?.名称 || '').trim(),
            })
          : null,
      }),
      utilityBefore: Number(candidate?.utilityBefore || 0),
      utilityAfter: Number(candidate?.utilityAfter || 0),
      objectiveUtility: Number(candidate?.objectiveUtility || 0),
      normalizedUtility: Number(candidate?.normalizedUtility || 0),
      vector: Object.freeze({ ...(candidate?.vector || {}) }),
      rejectionCode: String(candidate?.rejectionCode || '').trim(),
      classification: String(candidate?.classification || 'VIABLE').trim() || 'VIABLE',
      alternativeGap: Number(candidate?.alternativeGap || 0),
      counterDeclineFallback: candidate?.counterDeclineFallback === true,
      playerLocked: candidate?.playerLocked === true,
      selectionMode: String(candidate?.selectionMode || '').trim(),
      forcedFallback: candidate?.forcedFallback === true,
      forcedAction: candidate?.forcedAction === true,
      repeatedActionAudit: candidate?.repeatedActionAudit || null,
      nextValueAudit: candidate?.nextValueAudit || null,
      crisisResponseAudit: candidate?.crisisResponseAudit || null,
      crisisAlternativeAudit: candidate?.crisisAlternativeAudit || null,
      riskCompensationAudit: candidate?.riskCompensationAudit || null,
      teamIntentAudit: candidate?.teamIntentAudit || null,
      effectTargetAudit: Object.freeze([...(candidate?.effectTargetAudit || [])]),
      predictedOutcomeEvidence: Object.freeze([...(candidate?.predictedOutcomeEvidence || [])]),
      selected: candidate?.selected === true,
    });
  }

  function decideNext(input = {}) {
    const scored = scoreCandidatesNext(input);
    let normalized = classifyNextCandidates(normalizeUtilities(paretoFilterNext(scored)));
    const sourceActor = findUnitInWorld(input?.worldSnapshot, input?.actorId);
    const adaptationConfidence = sourceActor
      ? 0.5 * experienceOf(sourceActor) + 0.3 * ratio(sourceActor, 'men') + 0.2 * ratio(sourceActor, 'vit')
      : 1;
    const limitedMisjudgmentCount = (Array.isArray(input?.strategicHistory) ? input.strategicHistory : [])
      .filter(row => String(row?.adaptationSelectionStatus || '').trim() === 'LIMITED_MISJUDGMENT')
      .length;
    const misjudgmentBudgetBefore = Math.max(
      0,
      Math.ceil((1 - adaptationConfidence) * 2) - limitedMisjudgmentCount,
    );
    const hasRealizedRepeatEvidence = candidate => {
      const repeated = candidate?.repeatedActionAudit || {};
      return (
        (Array.isArray(repeated?.addedValueEvidence) && repeated.addedValueEvidence.length > 0) ||
        (Array.isArray(repeated?.extendedWindowIds) && repeated.extendedWindowIds.length > 0) ||
        (Array.isArray(repeated?.newlyDeniedOpportunityIds) && repeated.newlyDeniedOpportunityIds.length > 0) ||
        Number(repeated?.repeatedActionDelta || 0) > 0.05 ||
        candidate?.objectiveProgressAudit?.makesDeadlineFeasible === true ||
        Number(candidate?.vector?.terminalUtility || 0) > 0.0001 ||
        (
          candidate?.crisisResponseAudit?.realized === true &&
          (
            Number(candidate.crisisResponseAudit?.targetCapacityDelta || 0) > 0.05 ||
            Number(candidate.crisisResponseAudit?.threatCapacityDelta || 0) > 0.05
          )
        )
      );
    };
    const adaptedCandidateIds = new Set(
      input?.playerLockedDeclaration
        ? []
        : normalized
            .filter(candidate => candidate?.repeatedActionAudit?.failureAdaptation?.applied === true)
            .map(candidate => String(candidate?.candidateId || '').trim())
            .filter(Boolean),
    );
    if (
      !input?.playerLockedDeclaration &&
      adaptedCandidateIds.size > 0
    ) {
      normalized = normalized.map(candidate =>
        adaptedCandidateIds.has(String(candidate?.candidateId || '').trim()) &&
        !hasRealizedRepeatEvidence(candidate) &&
        !candidate?.rejectionCode
          ? {
              ...candidate,
              rejectionCode: misjudgmentBudgetBefore > 0
                ? 'PUBLIC_FAILURE_REQUIRES_TACTICAL_PIVOT'
                : 'ADAPTATION_BUDGET_EXHAUSTED',
              classification: 'HARD_INVALID',
            }
          : candidate
      );
    }
    const auditCandidates = normalized;
    if (typeof input?.inspectCandidates === 'function') input.inspectCandidates(auditCandidates);
    const actionRole = String(input?.actionOpportunity?.role || 'ACTIVE').trim().toUpperCase();
    const sourceActorUnavailable = !sourceActor ||
      !preview.isBattleCapable(sourceActor) ||
      hasActionCancellation(sourceActor);
    const unavailableStateName = stateEntries(sourceActor || {})
      .map(state => String(state?.状态 || state?.状态名称 || '').trim())
      .find(Boolean) || '';
    const activeDefenseStance = sourceActor?.__battleRuntime?.activeDefenseStance || null;
    const defenseWindowAlreadyActive =
      actionRole === 'ACTIVE' &&
      activeDefenseStance &&
      activeDefenseStance.consumed !== true;
    const lockedChoice = input?.playerLockedDeclaration
      ? selectPlayerLockedCandidate(normalized, input.playerLockedDeclaration, input.worldSnapshot)
      : null;
    let lostOpportunity = null;
    if (
      !lockedChoice &&
      !normalized.some(candidate => !candidate.rejectionCode) &&
      !defenseWindowAlreadyActive &&
      !sourceActorUnavailable
    ) {
      const fallback = (input?.actionOpportunity?.forcedSkill ? normalized[0] : null) ||
        normalized.find(candidate => actionRole === 'COUNTER' && candidate?.counterDeclineFallback === true) ||
        (actionRole === 'ACTIVE'
          ? normalized.find(candidate =>
              Object.keys(candidate?.costs || {}).length === 0 &&
              String(candidate?.declaration?.actionKind || '').trim() === 'DEFEND'
            )
          : null);
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
              fallbackSourceRejectionCode: String(candidate?.rejectionCode || '').trim(),
            }
          : candidate);
      }
    }
    if (
      !lockedChoice &&
      !lostOpportunity &&
      actionRole === 'REACTION' &&
      !sourceActorUnavailable &&
      !normalized.some(candidate => !candidate.rejectionCode)
    ) {
      lostOpportunity = Object.freeze({
        reasonCode: 'REACTION_NO_EFFECTIVE_ACTION',
        reasonText: '当前没有能够真实改变本次结算的即时应对动作，本次反应窗口按失去机会记录',
        actionRole,
        opportunityId: String(input?.actionOpportunity?.opportunityId || '').trim(),
        grantId: String(input?.actionOpportunity?.grantId || '').trim(),
        sourceActorId: String(input?.actionOpportunity?.sourceActorId || '').trim(),
      });
    }
    if (!lockedChoice && !lostOpportunity && sourceActorUnavailable) {
      const reasonCode = unavailableStateName === '昏迷'
        ? 'UNCONSCIOUS'
        : !sourceActor || !preview.isBattleCapable(sourceActor)
          ? 'INCAPACITATED'
          : 'CONTROLLED_BEFORE_OPPORTUNITY';
      lostOpportunity = Object.freeze({
        reasonCode,
        reasonText: reasonCode === 'UNCONSCIOUS'
          ? '因昏迷失去本次行动机会'
          : reasonCode === 'INCAPACITATED'
            ? '因失去战斗能力失去本次行动机会'
            : '受控制影响失去本次行动机会',
        actionRole,
        opportunityId: String(input?.actionOpportunity?.opportunityId || '').trim(),
        grantId: String(input?.actionOpportunity?.grantId || '').trim(),
      });
    }
    if (!lockedChoice && !normalized.some(candidate => !candidate.rejectionCode) && defenseWindowAlreadyActive) {
      const stanceName = String(
        activeDefenseStance?.stateName ||
        activeDefenseStance?.actionName ||
        activeDefenseStance?.type ||
        activeDefenseStance?.actionKind ||
        '防守姿态',
      ).trim();
      lostOpportunity = Object.freeze({
        reasonCode: 'DEFENSE_WINDOW_ALREADY_ACTIVE',
        reasonText: `已有【${stanceName}】防守窗口尚未消费，重复防守不会产生新的行动收益`,
        actionRole,
        opportunityId: String(input?.actionOpportunity?.opportunityId || '').trim(),
        grantId: String(input?.actionOpportunity?.grantId || '').trim(),
        stanceType: String(activeDefenseStance?.type || activeDefenseStance?.actionKind || '').trim(),
      });
    }
    const beliefState = buildInitialBelief(input?.worldSnapshot, preview.unitId(sourceActor), input?.beliefState || {});
    const decisionWorld = buildDecisionWorld(input?.worldSnapshot, preview.unitId(sourceActor), beliefState);
    const actor = findUnitInWorld(decisionWorld, preview.unitId(sourceActor));
    const actorSide = sideOf(decisionWorld, actor);
    const battleIntent = actorBattleIntent(decisionWorld, actorSide, input?.battleIntent);
    const teamIntent = buildTeamIntent(decisionWorld, preview.unitId(actor), beliefState, battleIntent);
    const nextValueContext = buildNextValueContext(decisionWorld, actorSide, beliefState);
    const signature = strategicSignature(decisionWorld, beliefState);
    const stalemate = detectStalemate(input?.strategicHistory, signature);
    const problems = identifyProblems(decisionWorld, preview.unitId(actor), beliefState, { battleIntent, stalemate });
    const strategyDegeneration = detectStrategyDegeneration(input?.strategicHistory);
    if (strategyDegeneration) {
      problems.push({
        problemId: 'STALEMATE',
        severity: 1,
        evidence: strategyDegeneration,
      });
      problems.sort((left, right) => Number(right?.severity || 0) - Number(left?.severity || 0));
    }
    const choice = lockedChoice || (
      lostOpportunity
        ? {
            selected: null,
            confidence: 1,
            temperature: 0,
            maxNormalizedRegret: 0,
            selectionPath: 'FORCED_FALLBACK',
            bestCandidateId: '',
            selectedCandidateId: '',
            normalizedRegret: 0,
            interferenceSource: '',
            seedRoll: null,
          }
        : selectCandidate(normalized, actor, input?.seed || 1, {
            ...input,
            worldSnapshot: decisionWorld,
            actorId: preview.unitId(actor),
            beliefState,
            teamIntent,
            battleIntent,
            strategyMemory: input?.strategyMemory || {},
          })
    );
    const selectedAdapted = adaptedCandidateIds.has(String(choice?.selected?.candidateId || '').trim());
    const adaptationSelectionStatus = adaptedCandidateIds.size === 0 || lockedChoice
      ? ''
      : !selectedAdapted
        ? 'PIVOTED'
        : Number(choice?.normalizedRegret || 0) <= 0.000001 &&
          hasRealizedRepeatEvidence(choice.selected)
          ? 'ORIGINAL_REMAINS_BEST'
          : choice?.selectionPath === 'SEEDED_SOFTMAX' && misjudgmentBudgetBefore > 0
            ? 'LIMITED_MISJUDGMENT'
            : 'PIVOTED';
    const misjudgmentBudgetAfter = adaptationSelectionStatus === 'LIMITED_MISJUDGMENT'
      ? Math.max(0, misjudgmentBudgetBefore - 1)
      : misjudgmentBudgetBefore;
    const selectedBase = choice.selected ? { ...choice.selected, selected: true } : null;
    const feasibleCrisisCandidates = normalized.filter(candidate =>
      !candidate?.rejectionCode &&
      candidate?.crisisResponseAudit?.required === true &&
      candidate?.crisisResponseAudit?.realized === true
    );
    const crisisSelectionStatus = selectedBase?.crisisResponseAudit?.required === true
      ? selectedBase.crisisResponseAudit.realized === true
        ? 'FEASIBLE_AND_REALIZED'
        : feasibleCrisisCandidates.length
          ? 'FEASIBLE_BUT_NOT_SELECTED'
          : 'NO_FEASIBLE_CRISIS_RESPONSE'
      : '';
    const selected = selectedBase && selectedBase?.crisisResponseAudit?.required === true
      ? {
          ...selectedBase,
          crisisResponseAudit: Object.freeze({
            ...selectedBase.crisisResponseAudit,
            selectionStatus: crisisSelectionStatus,
            feasibleCandidateIds: Object.freeze(
              feasibleCrisisCandidates.map(candidate => String(candidate?.candidateId || '').trim()),
            ),
          }),
        }
      : selectedBase;
    const alternatives = normalized.filter(candidate => candidate.candidateId !== selected?.candidateId)
      .sort((left, right) => right.objectiveUtility - left.objectiveUtility)
      .slice(0, 2);
    const selectedRecord = selected
      ? Object.freeze({
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
          playerLocked: selected.playerLocked === true,
          selectionMode: String(selected.selectionMode || '').trim(),
          forcedFallback: selected.forcedFallback === true,
          forcedAction: !!input?.actionOpportunity?.forcedSkill,
          fallbackReason: String(selected.fallbackReason || '').trim(),
          fallbackSourceRejectionCode: String(selected.fallbackSourceRejectionCode || '').trim(),
          actionFamily: String(selected.actionFamily || actionFamilyOf(selected)).trim(),
          repeatedActionAudit: selected.repeatedActionAudit || null,
          nextValueAudit: selected.nextValueAudit || null,
          terminalEvidence: selected.terminalEvidence || null,
          crisisResponseAudit: selected.crisisResponseAudit || null,
          crisisAlternativeAudit: selected.crisisAlternativeAudit || null,
          riskCompensationAudit: selected.riskCompensationAudit || null,
          teamIntentAudit: selected.teamIntentAudit || null,
          effectTargetAudit: selected.effectTargetAudit || Object.freeze([]),
          immediateReactionAudit: selected.immediateReactionAudit || Object.freeze([]),
          predictedOutcomeEvidence: selected.predictedOutcomeEvidence || Object.freeze([]),
          mechanicObservations: Object.freeze([...(selected.mechanicObservations || [])]),
        })
      : null;
    return Object.freeze({
      version: `${VERSION}-next-1`,
      decisionEngine: 'NEXT',
      actorId: preview.unitId(actor),
      candidateCount: normalized.length,
      paretoCount: normalized.filter(candidate => !candidate.rejectionCode).length,
      candidateAudit: Object.freeze(normalized.map(candidateAuditRecord)),
      selected: selectedRecord,
      lostOpportunity,
      beliefState: Object.freeze(beliefState),
      teamIntent: Object.freeze(teamIntent),
      problems: Object.freeze(problems),
      strategicSignature: signature,
      stalemate,
      stateCapacityTotal: Number(selected?.nextValueAudit?.before?.total || 0),
      resourceThreatProfile: nextValueContext.resourceThreatProfile,
      resourceThreatDiagnostics: nextValueContext.resourceThreatDiagnostics,
      resourceThreatLedgerEventCount: Array.isArray(decisionWorld?.__battleEventLedger)
        ? decisionWorld.__battleEventLedger.length
        : -1,
      beliefRevision: beliefRevisionFor(beliefState),
      pendingStrategicEffect: worldEntries(decisionWorld).some(entry =>
        entry.unit?.蓄力技能 || stateEntries(entry.unit).some(state => Number(state?.duration ?? state?.持续回合 ?? 0) > 0)),
      strategyMemory: Object.freeze({
        problemId: lostOpportunity?.reasonCode || problems[0]?.problemId || 'NEUTRAL_PROGRESS',
        targetIds: Object.freeze([...(selected?.declaration?.targetIds || [])]),
        expectedOutcomeKinds: Object.freeze((selected?.preview?.contributions || []).map(entry => entry.outcomeKind)),
        expectedWindowIds: Object.freeze((selected?.preview?.contributions || []).map(entry => entry.windowId).filter(Boolean)),
        expiresAtOpportunity: Math.max(1, Number(input?.actionOpportunity?.sequence || 0) + 1),
      }),
      scoreAudit: Object.freeze([...(selected ? [selected] : []), ...alternatives].map(candidate => Object.freeze({
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
        deepAnalysis: Object.freeze({
          required: false,
          nodeCount: 1,
          timeline: Object.freeze([{ nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId }]),
          responseBranches: Object.freeze([]),
          noResponseProbability: 1,
        }),
        rejectionCode: candidate.rejectionCode || '',
        classification: candidate.classification || 'VIABLE',
        alternativeGap: Number(candidate.alternativeGap || 0),
        counterDeclineFallback: candidate.counterDeclineFallback === true,
        playerLocked: candidate.playerLocked === true,
        selectionMode: String(candidate.selectionMode || '').trim(),
        forcedFallback: candidate.forcedFallback === true,
        forcedAction: !!input?.actionOpportunity?.forcedSkill && !!selected && candidate.candidateId === selected.candidateId,
        fallbackReason: String(candidate.fallbackReason || '').trim(),
        fallbackSourceRejectionCode: String(candidate.fallbackSourceRejectionCode || '').trim(),
        actionFamily: String(candidate.actionFamily || actionFamilyOf(candidate)).trim(),
        repeatedActionAudit: candidate.repeatedActionAudit || null,
        nextValueAudit: candidate.nextValueAudit || null,
        terminalEvidence: candidate.terminalEvidence || null,
        crisisResponseAudit: candidate.crisisResponseAudit || null,
        crisisAlternativeAudit: candidate.crisisAlternativeAudit || null,
        riskCompensationAudit: candidate.riskCompensationAudit || null,
        teamIntentAudit: candidate.teamIntentAudit || null,
        effectTargetAudit: candidate.effectTargetAudit || Object.freeze([]),
        immediateReactionAudit: candidate.immediateReactionAudit || Object.freeze([]),
        predictedOutcomeEvidence: candidate.predictedOutcomeEvidence || Object.freeze([]),
        selected: !!selected && candidate.candidateId === selected.candidateId,
      }))),
      decisionProfile: Object.freeze({
        confidence: choice.confidence,
        temperature: choice.temperature,
        maxNormalizedRegret: choice.maxNormalizedRegret,
        selectionPath: choice.selectionPath,
        bestCandidateId: choice.bestCandidateId,
        selectedCandidateId: choice.selectedCandidateId,
        normalizedRegret: choice.normalizedRegret,
        interferenceSource: choice.interferenceSource,
        seedRoll: choice.seedRoll,
        adaptationSelectionStatus,
        adaptedCandidateIds: Object.freeze([...adaptedCandidateIds]),
        misjudgmentBudgetBefore,
        misjudgmentBudgetAfter,
      }),
    });
  }

  function decide(input = {}) {
    const worldSnapshot = input.worldSnapshot;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_decision_world_missing');
    resetDecisionCaches();
    const actor = findUnitInWorld(worldSnapshot, input.actorId);
    if (!actor || !preview.isAlive(actor)) throw new Error('battle_decision_actor_unavailable');
    const beliefState = input?.__preparedBeliefState ||
      buildInitialBelief(worldSnapshot, preview.unitId(actor), input.beliefState || {});
    const decisionWorld = input?.__preparedDecisionWorld === true
      ? worldSnapshot
      : buildDecisionWorld(worldSnapshot, preview.unitId(actor), beliefState);
    const decisionActor = findUnitInWorld(decisionWorld, preview.unitId(actor));
    const actorSide = sideOf(decisionWorld, decisionActor);
    const battleIntent = actorBattleIntent(decisionWorld, actorSide, input.battleIntent);
    const signature = strategicSignature(decisionWorld, beliefState);
    const stalemate = detectStalemate(input.strategicHistory, signature);
    const teamIntent = buildTeamIntent(decisionWorld, preview.unitId(actor), beliefState, battleIntent);
    const problems = identifyProblems(decisionWorld, preview.unitId(actor), beliefState, { battleIntent, stalemate });
    const beforeUtility = stateUtility(decisionWorld, actorSide, beliefState);
    const beliefRevision = beliefRevisionFor(beliefState);
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
    const generated = Array.isArray(input?.__frozenCandidates)
      ? input.__frozenCandidates
      : enumerateCandidates(scoringContext);
    if (!generated.length) throw new Error('battle_decision_candidate_pool_empty');
    const scored = generated.map(candidate => scoreCandidate(candidate, scoringContext));
    const normalized = classifyCandidateEvidence(normalizeUtilities(paretoFilter(scored)));
    if (typeof input.inspectCandidates === 'function') input.inspectCandidates(normalized);
    const strategyMemory = activeStrategyMemory(input.strategyMemory, decisionWorld, input.actionOpportunity, normalized);
    const choice = input?.playerLockedDeclaration
      ? selectPlayerLockedCandidate(normalized, input.playerLockedDeclaration, worldSnapshot)
      : selectCandidate(normalized, decisionActor, input.seed || 1, { ...context, strategyMemory });
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
      playerLocked: selected.playerLocked === true,
      selectionMode: String(selected.selectionMode || '').trim(),
      forcedFallback: selected.forcedFallback === true,
      fallbackReason: String(selected.fallbackReason || '').trim(),
      predictedOutcomeEvidence: selected.predictedOutcomeEvidence || Object.freeze([]),
      terminalEvidence: selected.terminalEvidence || null,
      mechanicObservations: Object.freeze([...(selected.mechanicObservations || [])]),
    });
    return Object.freeze({
      version: VERSION,
      actorId: preview.unitId(actor),
      candidateCount: normalized.length,
      paretoCount: normalized.filter(candidate => !candidate.rejectionCode).length,
      candidateAudit: Object.freeze(normalized.map(candidateAuditRecord)),
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
        playerLocked: candidate.playerLocked === true,
        selectionMode: String(candidate.selectionMode || '').trim(),
        forcedFallback: candidate.forcedFallback === true,
        fallbackReason: String(candidate.fallbackReason || '').trim(),
        predictedOutcomeEvidence: candidate.predictedOutcomeEvidence || Object.freeze([]),
        terminalEvidence: candidate.terminalEvidence || null,
        selected: candidate.candidateId === selected.candidateId,
      }))),
      decisionProfile: Object.freeze({ confidence: choice.confidence, temperature: choice.temperature, maxNormalizedRegret: choice.maxNormalizedRegret }),
    });
  }

  function declarationFingerprint(declaration = {}) {
    return `declaration:${preview.stableHash(declaration && typeof declaration === 'object' ? declaration : {})}`;
  }

  function decisionRequestHash(request = {}) {
    const payload = { ...request };
    delete payload.requestHash;
    return `request:${preview.stableHash(payload)}`;
  }

  function createDependencyView(input = {}) {
    const worldSnapshot = input.worldSnapshot || {};
    const objectiveContract = input.objectiveContract || {};
    const opportunitySnapshot = input.opportunitySnapshot || {};
    const scheduledEvents = Array.isArray(input.scheduledEvents) ? input.scheduledEvents : [];
    const beliefState = input.beliefState || {};
    const values = new Map();
    const record = (key, value) => {
      values.set(key, cloneValue(value));
      return value;
    };
    const unit = unitId => {
      const found = findUnitInWorld(worldSnapshot, unitId);
      if (!found) throw new Error(`battle_decision_dependency_unit_missing:${unitId}`);
      return found;
    };
    const state = (entry, stateKey) => stateEntries(entry)
      .find(candidate => String(candidate?.[0] || candidate?.[1]?.状态 || candidate?.[1]?.状态名称 || '').trim() === String(stateKey || '').trim())
      ?.[1] || null;
    return Object.freeze({
      readUnitHp(unitId) {
        return record(`unit:${unitId}:hp`, preview.readHp(unit(unitId)));
      },
      readUnitBaseMaxHp(unitId) {
        return record(`unit:${unitId}:baseMaxHp`, preview.readHpMax(unit(unitId)));
      },
      readResource(unitId, resource) {
        return record(`unit:${unitId}:resource:${resource}`, preview.readResource(unit(unitId), resource));
      },
      readState(unitId, stateKey) {
        return record(`unit:${unitId}:state:${stateKey}`, state(unit(unitId), stateKey));
      },
      readDefenseProfile(unitId) {
        const target = unit(unitId);
        return record(`target:${unitId}:defense`, {
          defense: preview.readCombatStat(target, 'def'),
          mental: preview.readCombatStat(target, 'men'),
          agility: preview.readCombatStat(target, 'agi'),
          shield: preview.readShield(target),
        });
      },
      readOpportunity(opportunityId) {
        const opportunities = Array.isArray(opportunitySnapshot)
          ? opportunitySnapshot
          : Array.isArray(opportunitySnapshot?.opportunities)
            ? opportunitySnapshot.opportunities
            : [opportunitySnapshot];
        return record(
          `opportunity:${opportunityId}`,
          opportunities.find(entry =>
            String(entry?.opportunityId || entry?.grantId || '').trim() === String(opportunityId || '').trim()
          ) || null,
        );
      },
      readSchedule(descriptorId) {
        return record(
          `schedule:${descriptorId}`,
          scheduledEvents.find(entry =>
            String(entry?.descriptorId || entry?.scheduleId || '').trim() === String(descriptorId || '').trim()
          ) || null,
        );
      },
      readObjective(conditionId) {
        const conditions = [
          ...(objectiveContract?.victory?.conditions || []),
          ...(objectiveContract?.defeat?.conditions || []),
        ];
        return record(
          `objective:${conditionId}`,
          conditions.find((entry, index) =>
            String(entry?.conditionId || entry?.id || index).trim() === String(conditionId || '').trim()
          ) || null,
        );
      },
      readRule(ruleKey) {
        return record(`rule:${ruleKey}`, worldSnapshot?.规则?.[ruleKey] ?? worldSnapshot?.battleRules?.[ruleKey] ?? null);
      },
      readBelief(mechanicKey) {
        return record(
          `belief:${mechanicKey}`,
          beliefState?.mechanics?.[mechanicKey] ??
            beliefState?.mechanicPosteriors?.[mechanicKey] ??
            beliefState?.[mechanicKey] ??
            null,
        );
      },
      dependencyKeys() {
        return Object.freeze([...values.keys()].sort());
      },
      dependencyValueHash(keys = [...values.keys()]) {
        return `dependency:${preview.stableHash(
          [...keys].sort().map(key => [key, values.has(key) ? values.get(key) : null]),
        )}`;
      },
    });
  }

  function r8PreviewCacheKey(context = {}, candidate = {}, dependencyValueHash = '') {
    return [
      context.worldRevision,
      context.visibleWorldRevision,
      context.beliefRevision,
      context.objectiveHash,
      context.opportunityRevision,
      context.resourceTimelineRevision,
      context.scheduleRevision,
      candidate.declarationFingerprint || declarationFingerprint(candidate.declaration),
      preview.stableHash(candidate.declaration?.targetIds || []),
      preview.stableHash(context.horizon || {}),
      dependencyValueHash,
    ].join('|');
  }

  function actionRouteFromPreview(input = {}) {
    const candidate = input.candidate || {};
    const previewResult = input.previewResult || {};
    const worldSnapshot = input.worldSnapshot || {};
    const actorSide = String(input.actorSide || '').trim();
    const targetIds = Object.freeze([...(candidate?.declaration?.targetIds || [])]);
    const trajectories = [];
    const outcomeKinds = new Set();
    const realizationWindows = new Set();
    const paymentDependencies = [];
    const opportunityDependencies = [];
    const actionPoolEffects = [];
    for (const entry of previewResult?.contributions || []) {
      const outcomeKind = String(entry?.outcomeKind || '').trim();
      if (outcomeKind) outcomeKinds.add(outcomeKind);
      if (entry?.windowId) realizationWindows.add(String(entry.windowId));
      if (entry?.outcomeKind === 'RESOURCE_OPTION_CHANGED' && entry?.windowId === 'ACTION_COST') {
        paymentDependencies.push({
          unitId: entry.targetId,
          resource: entry?.evidence?.resource || '',
          amount: Math.abs(Number(entry?.evidence?.delta || 0)),
        });
      }
      if (['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW'].includes(outcomeKind)) {
        opportunityDependencies.push({
          targetId: entry.targetId,
          outcomeKind,
          windowId: entry.windowId || '',
        });
      }
      if (!['HP_DELTA', 'SCHEDULED_HP_DELTA'].includes(outcomeKind)) {
        actionPoolEffects.push({
          rootActionId: String(entry?.rootCauseId || entry?.sourceActionId || candidate?.candidateId || '').trim(),
          effectInstanceId: String(entry?.effectInstanceId || '').trim(),
          targetId: String(entry?.targetId || '').trim(),
          outcomeKind,
          windowId: String(entry?.windowId || ''),
          expectedDelta: Number(entry?.expectedDelta || 0),
          threatValue: Number(entry?.threatValue || 0),
          evidence: cloneValue(entry?.evidence || {}),
        });
        continue;
      }
      const target = findUnitInWorld(worldSnapshot, entry.targetId);
      if (!target) continue;
      const baseMaxHp = Math.max(1, preview.readHpMax(target));
      const rawDelta = Number(entry?.evidence?.delta ?? entry?.expectedDelta ?? 0);
      const targetSide = sideOf(worldSnapshot, target);
      const beneficialDelta = targetSide === actorSide ? rawDelta : -rawDelta;
      trajectories.push({
        targetId: entry.targetId,
        outcomeKind,
        windowId: String(entry?.windowId || ''),
        healthDeltaPP: 100 * rawDelta / baseMaxHp,
        actorBenefitPP: 100 * beneficialDelta / baseMaxHp,
        rootActionId: String(entry?.rootCauseId || entry?.sourceActionId || candidate?.candidateId || '').trim(),
        sourceEffectInstanceId: String(entry?.effectInstanceId || ''),
      });
    }
    const routeShape = {
      targetIds,
      outcomeKinds: [...outcomeKinds].sort(),
      healthPath: trajectories.map(entry => [
        entry.targetId,
        entry.outcomeKind,
        Number(entry.healthDeltaPP.toFixed(8)),
        entry.windowId,
      ]),
      paymentDependencies,
      opportunityDependencies,
      realizationWindows: [...realizationWindows].sort(),
      actionPoolEffects: actionPoolEffects.map(entry => [
        entry.targetId,
        entry.outcomeKind,
        entry.windowId,
        entry.effectInstanceId,
      ]),
    };
    return Object.freeze({
      routeKey: `route:${preview.stableHash(routeShape)}`,
      candidateId: String(candidate?.candidateId || '').trim(),
      declarationFingerprint: candidate.declarationFingerprint || declarationFingerprint(candidate.declaration),
      targetIds,
      outcomeKinds: Object.freeze([...outcomeKinds].sort()),
      paymentDependencies: deepFreeze(paymentDependencies),
      opportunityDependencies: deepFreeze(opportunityDependencies),
      realizationWindows: Object.freeze([...realizationWindows].sort()),
      healthTrajectoryByTarget: deepFreeze(trajectories),
      actionPoolEffects: deepFreeze(actionPoolEffects),
      terminalPathId: '',
      probabilityBounds: Object.freeze({ lower: 0, upper: 1 }),
      dependencyKeys: Object.freeze([...(input.dependencyKeys || [])].sort()),
      routeBenefitPP: trajectories.reduce((sum, entry) => sum + Number(entry.actorBenefitPP || 0), 0),
    });
  }

  function routeDominates(left = {}, right = {}) {
    const leftBenefit = Number(left.routeBenefitPP || 0);
    const rightBenefit = Number(right.routeBenefitPP || 0);
    const leftCost = (left.paymentDependencies || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const rightCost = (right.paymentDependencies || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    return leftBenefit >= rightBenefit - 1e-9 &&
      leftCost <= rightCost + 1e-9 &&
      (leftBenefit > rightBenefit + 1e-9 || leftCost < rightCost - 1e-9);
  }

  function selectPrimaryBackupRoutes(routes = []) {
    const nonDominated = routes.filter(route =>
      !routes.some(other => other !== route && routeDominates(other, route))
    ).sort((left, right) =>
      Number(right.routeBenefitPP || 0) - Number(left.routeBenefitPP || 0) ||
      String(left.routeKey || '').localeCompare(String(right.routeKey || ''))
    );
    const primaryRoute = nonDominated[0] || routes[0] || null;
    const backupRoute = nonDominated.find(route => route.routeKey !== primaryRoute?.routeKey) ||
      routes.find(route => route.routeKey !== primaryRoute?.routeKey) ||
      null;
    return Object.freeze({
      searchedRouteCount: routes.length,
      nonDominatedRouteCount: nonDominated.length,
      primaryRoute,
      backupRoute,
    });
  }

  function buildR8RouteCatalog(input = {}) {
    const worldSnapshot = input.worldSnapshot || {};
    const dependencyView = input.dependencyView;
    const evaluationContext = input.evaluationContext || {};
    const actorId = String(input.actorId || '').trim();
    const actorCandidates = Array.isArray(input.actorCandidates) ? input.actorCandidates : [];
    const cache = new Map();
    const catalog = {};
    const actorCandidateRoutes = {};
    const actorProjectedWorlds = {};
    const previousCatalog = input.previousCatalog && typeof input.previousCatalog === 'object'
      ? input.previousCatalog
      : null;
    const affectedUnitIds = new Set((input.affectedUnitIds || []).map(value => String(value || '').trim()).filter(Boolean));
    if (previousCatalog && affectedUnitIds.size) {
      Object.entries(previousCatalog).forEach(([unitId, envelope]) => {
        const routes = [envelope?.primaryRoute, envelope?.backupRoute].filter(Boolean);
        if (routes.some(route =>
          (route.targetIds || []).some(targetId => affectedUnitIds.has(String(targetId || '').trim()))
        )) {
          affectedUnitIds.add(unitId);
        }
      });
    }
    const entries = worldEntries(worldSnapshot)
      .filter(entry => preview.isAlive(entry.unit) && preview.isBattleCapable(entry.unit))
      .sort((left, right) => String(preview.unitId(left.unit)).localeCompare(String(preview.unitId(right.unit))));
    for (const entry of entries) {
      const currentUnitId = preview.unitId(entry.unit);
      if (previousCatalog && affectedUnitIds.size && !affectedUnitIds.has(currentUnitId)) {
        catalog[currentUnitId] = previousCatalog[currentUnitId];
        continue;
      }
      const candidates = currentUnitId === actorId
        ? actorCandidates
        : enumerateCandidates({
            worldSnapshot,
            actorId: currentUnitId,
            actorSide: entry.side,
            beliefState: input.beliefState,
            battleIntent: input.battleIntent,
            actionOpportunity: {
              role: 'ACTIVE',
              grantType: 'NATURAL_ACTION',
              sequence: Number(input.actionOpportunity?.sequence || 0) + 1,
            },
          }).map(candidate => ({
            ...candidate,
            declarationFingerprint: declarationFingerprint(candidate.declaration),
          }));
      const routes = candidates.map(candidate => {
        dependencyView.readUnitHp(currentUnitId);
        dependencyView.readUnitBaseMaxHp(currentUnitId);
        for (const targetId of candidate?.declaration?.targetIds || []) {
          if (!findUnitInWorld(worldSnapshot, targetId)) continue;
          dependencyView.readUnitHp(targetId);
          dependencyView.readUnitBaseMaxHp(targetId);
          dependencyView.readDefenseProfile(targetId);
        }
        const dependencyKeys = dependencyView.dependencyKeys();
        const dependencyValueHash = dependencyView.dependencyValueHash(dependencyKeys);
        const cacheKey = r8PreviewCacheKey(evaluationContext, candidate, dependencyValueHash);
        let previewResult = cache.get(cacheKey);
        if (!previewResult) {
          previewResult = preview.previewAction({
            worldSnapshot,
            worldRevision: evaluationContext.visibleWorldRevision,
            beliefRevision: evaluationContext.beliefRevision,
            actorId: currentUnitId,
            declaration: candidate.declaration,
            actionFingerprint: candidate.declarationFingerprint,
            horizon: 'SHALLOW',
            previewBudget: { maxNodes: 12 },
            battleIntent: input.battleIntent,
          });
          cache.set(cacheKey, previewResult);
        }
        if (currentUnitId === actorId) {
          actorProjectedWorlds[candidate.candidateId] = previewResult.afterSnapshot;
        }
        return actionRouteFromPreview({
          candidate,
          previewResult,
          worldSnapshot,
          actorSide: entry.side,
          dependencyKeys,
        });
      });
      if (currentUnitId === actorId) {
        routes.forEach(route => {
          actorCandidateRoutes[route.candidateId] = route;
        });
      }
      catalog[currentUnitId] = selectPrimaryBackupRoutes(routes);
    }
    return {
      routeCatalog: deepFreeze(catalog),
      actorCandidateRoutes: deepFreeze(actorCandidateRoutes),
      actorProjectedWorlds,
      cacheMetrics: Object.freeze({
        cacheSize: cache.size,
        previewCalls: cache.size,
        searchedUnitCount: entries.length,
        recomputedUnitCount: previousCatalog && affectedUnitIds.size
          ? entries.filter(entry => affectedUnitIds.has(preview.unitId(entry.unit))).length
          : entries.length,
        searchedRouteCount: Object.values(catalog).reduce(
          (sum, envelope) => sum + Number(envelope?.searchedRouteCount || 0),
          0,
        ),
      }),
    };
  }

  function buildTeamMarginalPlan(routeCatalog = {}, worldSnapshot = {}, actorId = '') {
    const rows = Object.entries(routeCatalog)
      .filter(([unitId]) => unitId !== actorId)
      .map(([unitId, envelope]) => ({ unitId, route: envelope?.primaryRoute }))
      .filter(entry => entry.route)
      .sort((left, right) => {
        const leftUnit = findUnitInWorld(worldSnapshot, left.unitId);
        const rightUnit = findUnitInWorld(worldSnapshot, right.unitId);
        return String(sideOf(worldSnapshot, leftUnit)).localeCompare(String(sideOf(worldSnapshot, rightUnit))) ||
          left.unitId.localeCompare(right.unitId);
      });
    return deepFreeze(rows.flatMap(({ unitId, route }, index) =>
      (route.healthTrajectoryByTarget || []).map(trajectory => ({
        targetId: trajectory.targetId,
        outcomeKind: trajectory.outcomeKind,
        realizationWindow: trajectory.windowId,
        sourceOpportunityId: `projected-natural:${index + 1}:${unitId}`,
        expectedRangePP: Object.freeze({
          lower: Number(trajectory.actorBenefitPP || 0),
          upper: Number(trajectory.actorBenefitPP || 0),
        }),
        expiresAtSequence: index + 1,
      }))
    ));
  }

  function buildR8CandidateEnvelopeDeltas(input = {}) {
    const worldSnapshot = input.worldSnapshot || {};
    const actorSide = String(input.actorSide || '').trim();
    const routeCatalog = input.routeCatalog || {};
    const projectedWorlds = input.projectedWorlds || {};
    const candidateRoutes = input.candidateRoutes || {};
    const actionOpportunity = input.actionOpportunity || {};
    const result = {};
    const rebuildEnvelope = (projectedWorld, targetId) => {
      const target = findUnitInWorld(projectedWorld, targetId);
      if (!target || !preview.isAlive(target) || !preview.isBattleCapable(target)) {
        return Object.freeze({ primaryRoute: null, backupRoute: null, searchedRouteCount: 0 });
      }
      const targetSide = sideOf(projectedWorld, target);
      const candidates = enumerateCandidates({
        worldSnapshot: projectedWorld,
        actorId: targetId,
        actorSide: targetSide,
        beliefState: input.beliefState,
        battleIntent: input.battleIntent,
        actionOpportunity: {
          role: 'ACTIVE',
          grantType: 'NATURAL_ACTION',
          sequence: Number(actionOpportunity?.sequence || 0) + 1,
        },
      }).map(candidate => ({
        ...candidate,
        declarationFingerprint: declarationFingerprint(candidate.declaration),
      }));
      const routes = candidates.map(candidate => actionRouteFromPreview({
        candidate,
        previewResult: preview.previewAction({
          worldSnapshot: projectedWorld,
          actorId: targetId,
          declaration: candidate.declaration,
          actionFingerprint: candidate.declarationFingerprint,
          horizon: 'SHALLOW',
          previewBudget: { maxNodes: 12 },
          battleIntent: input.battleIntent,
        }),
        worldSnapshot: projectedWorld,
        actorSide: targetSide,
        dependencyKeys: [],
      }));
      return selectPrimaryBackupRoutes(routes);
    };
    for (const [candidateId, route] of Object.entries(candidateRoutes)) {
      const projectedWorld = projectedWorlds[candidateId];
      if (!projectedWorld) {
        result[candidateId] = Object.freeze([]);
        continue;
      }
      const allUnitIds = worldEntries(worldSnapshot).map(entry => preview.unitId(entry.unit)).filter(Boolean);
      const affectedIds = new Set();
      for (const effect of route?.actionPoolEffects || []) {
        const targetId = String(effect?.targetId || '').trim();
        if (['RESOURCE_OPTION_CHANGED', 'ACTION_CANCELLED'].includes(effect?.outcomeKind)) {
          if (targetId) affectedIds.add(targetId);
        } else {
          allUnitIds.forEach(unitIdValue => affectedIds.add(unitIdValue));
        }
      }
      result[candidateId] = Object.freeze([...affectedIds].map(targetId => {
        const target = findUnitInWorld(worldSnapshot, targetId);
        const targetSide = target ? sideOf(worldSnapshot, target) : '';
        const beforeEnvelope = routeCatalog[targetId] || {};
        const afterEnvelope = rebuildEnvelope(projectedWorld, targetId);
        const beforePP = Math.max(0, Number(beforeEnvelope?.primaryRoute?.routeBenefitPP || 0));
        const afterPP = Math.max(0, Number(afterEnvelope?.primaryRoute?.routeBenefitPP || 0));
        const ownTarget = String(targetSide) === actorSide;
        return Object.freeze({
          targetId,
          beforeRouteKey: String(beforeEnvelope?.primaryRoute?.routeKey || ''),
          afterRouteKey: String(afterEnvelope?.primaryRoute?.routeKey || ''),
          beforePP,
          afterPP,
          healthTrajectoryDeltaPP: ownTarget ? afterPP - beforePP : beforePP - afterPP,
          searchedRouteCount: Number(afterEnvelope?.searchedRouteCount || 0),
        });
      }));
    }
    return deepFreeze(result);
  }

  function buildR8ResponseModel(request = {}, candidateId = '') {
    if (request?.actionOpportunity?.futureHostileResponseAllowed === false) {
      return Object.freeze({ mainBranches: Object.freeze([]), disasterTail: null, noResponseProbability: 1 });
    }
    const confidence = clamp(request?.beliefState?.confidence ?? 0.5, 0, 1);
    const unknownMass = clamp(0.35 * (1 - confidence), 0, 0.35);
    const actorSide = String(request?.actorSide || '').trim();
    const publicResponses = request?.beliefState?.publicResponses || {};
    const known = Object.entries(publicResponses).flatMap(([sourceActorId, responses]) =>
      (Array.isArray(responses) ? responses : []).map(response => ({
        sourceActorId,
        responseId: String(response?.responseId || response?.actionName || 'public-response').trim(),
        threat: Math.max(0, Number(response?.baseActionValue ?? response?.utility ?? 0)),
        catastrophic: response?.lethal === true ||
          response?.incapacitating === true ||
          response?.cancelsOpportunity === true ||
          response?.breaksObjective === true,
        evidenceEventIds: Object.freeze([...(response?.evidenceEventIds || [])]),
      }))
    ).filter(response => response.threat > 0);
    const center = median(known.map(response => response.threat));
    const deviations = known.map(response => Math.abs(response.threat - center));
    const scale = Math.max(1, median(deviations));
    const temperature = 1 + 3 * (1 - confidence);
    const weighted = known.map(response => ({
      ...response,
      weight: Math.exp(((response.threat - center) / scale) / temperature),
    })).sort((left, right) => right.weight - left.weight || left.responseId.localeCompare(right.responseId));
    const disaster = weighted.find(response => response.catastrophic);
    const selected = weighted.filter(response => response !== disaster).slice(0, 2);
    const weightTotal = selected.reduce((sum, response) => sum + response.weight, 0) || 1;
    const knownMass = known.length ? 1 - unknownMass : 0;
    const mainBranches = selected.map(response => Object.freeze({
      projectionId: `response:${candidateId}:${response.sourceActorId}:${response.responseId}`,
      sourceActorId: response.sourceActorId,
      probability: knownMass * response.weight / weightTotal,
      threatEnvelope: Object.freeze({ lower: response.threat, upper: response.threat }),
      evidenceEventIds: response.evidenceEventIds,
      publicEvidence: true,
    }));
    const disasterTail = disaster ? Object.freeze({
      projectionId: `disaster:${candidateId}:${disaster.sourceActorId}:${disaster.responseId}`,
      sourceActorId: disaster.sourceActorId,
      probability: Math.min(unknownMass || 0.05, 0.35),
      threatEnvelope: Object.freeze({ lower: disaster.threat, upper: disaster.threat }),
      evidenceEventIds: disaster.evidenceEventIds,
      publicEvidence: true,
    }) : null;
    const usedMass = mainBranches.reduce((sum, branch) => sum + branch.probability, 0) +
      Number(disasterTail?.probability || 0);
    return Object.freeze({
      actorSide,
      mainBranches: Object.freeze(mainBranches),
      disasterTail,
      unknownMass,
      noResponseProbability: clamp(1 - usedMass, 0, 1),
    });
  }

  function r8InformationValue(request = {}, candidateId = '') {
    const opportunity = request?.actionOpportunity || {};
    if (opportunity.futureHostileResponseAllowed === false || opportunity.noFutureOpportunity === true) return 0;
    const envelope = request?.actionRouteCatalog?.[request?.actorId];
    const primary = envelope?.primaryRoute;
    const backup = envelope?.backupRoute;
    if (!primary || !backup || primary.routeKey === backup.routeKey) return 0;
    const candidate = request?.frozenCandidates?.find(entry => entry.candidateId === candidateId);
    const observable = (candidate?.declaration?.skill?._效果数组 || []).some(effect =>
      String(effect?.原型 || '').trim() === '决策干扰' ||
      /观察|侦察|探测|揭示/.test(String(effect?.信息类型 || effect?.效果 || effect?.状态 || ''))
    ) || String(candidate?.declaration?.actionKind || '').trim() === 'OBSERVE';
    if (!observable) return 0;
    const regretBefore = Math.abs(Number(primary.routeBenefitPP || 0) - Number(backup.routeBenefitPP || 0));
    return Math.max(0, regretBefore * (1 - clamp(request?.beliefState?.confidence ?? 0.5, 0, 1)));
  }

  function r8ObjectiveGroups(request = {}) {
    const normalized = preview.normalizeBattleObjectives(
      request?.objectiveContract || {},
      request?.visibleWorld || {},
    );
    const actorIsPlayer = /player|玩家|我方|己方|友方/i.test(String(request?.actorSide || ''));
    return Object.freeze({
      normalized,
      actorIsPlayer,
      victory: actorIsPlayer ? normalized.victory : normalized.defeat,
      defeat: actorIsPlayer ? normalized.defeat : normalized.victory,
    });
  }

  function r8ConditionMatchesUnit(request = {}, condition = {}, unitIdValue = '') {
    const unit = findUnitInWorld(request?.visibleWorld || {}, unitIdValue);
    if (!unit) return false;
    const targetIds = new Set((condition?.targetIds || []).map(value => String(value || '').trim()));
    if (targetIds.size && !targetIds.has(preview.unitId(unit)) && !targetIds.has(preview.unitName(unit))) return false;
    const expectedSide = String(condition?.side || '').trim().toUpperCase();
    if (!expectedSide) return true;
    const actualPlayer = /player|玩家|我方|己方|友方/i.test(String(sideOf(request.visibleWorld, unit)));
    return expectedSide === (actualPlayer ? 'PLAYER' : 'ENEMY');
  }

  function r8ConditionTrajectoryValue(request = {}, condition = {}, trajectory = {}, groupRole = 'VICTORY') {
    if (!r8ConditionMatchesUnit(request, condition, trajectory.targetId)) return 0;
    const target = findUnitInWorld(request.visibleWorld, trajectory.targetId);
    if (!target) return 0;
    const targetSide = String(sideOf(request.visibleWorld, target));
    const actorSide = String(request.actorSide || '');
    const ownTarget = targetSide === actorSide;
    const deltaPP = Number(trajectory.healthDeltaPP || 0);
    const damagePP = Math.max(0, -deltaPP);
    const sustainPP = Math.max(0, deltaPP);
    const type = String(condition?.type || '').trim().toUpperCase();
    if (groupRole === 'DEFEAT') {
      if (!ownTarget) return 0;
      if (['TEAM_DEAD', 'UNIT_DEAD', 'TEAM_INCAPACITATED', 'UNIT_INCAPACITATED', 'ROUND_REACHED', 'WITHDRAW_SUCCESS', 'UNIT_DAMAGED'].includes(type)) {
        return sustainPP;
      }
      if (type === 'HP_RATIO_AT_OR_BELOW') {
        const currentPP = 100 * preview.readHp(target) / Math.max(1, preview.readHpMax(target));
        const thresholdPP = 100 * Number(condition?.threshold || 0);
        return Math.min(sustainPP, Math.max(0, thresholdPP - currentPP));
      }
      return 0;
    }
    if (type === 'ROUND_REACHED' || type === 'WITHDRAW_SUCCESS') return ownTarget ? sustainPP : 0;
    if (ownTarget) return 0;
    if (['TEAM_DEAD', 'UNIT_DEAD', 'TEAM_INCAPACITATED', 'UNIT_INCAPACITATED'].includes(type)) {
      const currentPP = 100 * preview.readHp(target) / Math.max(1, preview.readHpMax(target));
      return Math.min(damagePP, currentPP);
    }
    if (type === 'UNIT_DAMAGED') return damagePP;
    if (type === 'HP_RATIO_AT_OR_BELOW') {
      const currentPP = 100 * preview.readHp(target) / Math.max(1, preview.readHpMax(target));
      const thresholdPP = 100 * Number(condition?.threshold || 0);
      return Math.min(damagePP, Math.max(0, currentPP - thresholdPP));
    }
    return 0;
  }

  function r8GroupTrajectoryValue(request = {}, group = {}, trajectory = {}, groupRole = 'VICTORY') {
    const values = (group?.conditions || []).map(condition =>
      r8ConditionTrajectoryValue(request, condition, trajectory, groupRole)
    );
    if (!values.length) return 0;
    return String(group?.logic || 'ANY').toUpperCase() === 'ALL'
      ? Math.min(...values)
      : Math.max(...values);
  }

  function r8ThresholdOverkill(request = {}, route = {}) {
    const groups = r8ObjectiveGroups(request);
    let discardedOverkillPP = 0;
    for (const trajectory of route?.healthTrajectoryByTarget || []) {
      const damagePP = Math.max(0, -Number(trajectory?.healthDeltaPP || 0));
      if (!(damagePP > 0)) continue;
      const target = findUnitInWorld(request.visibleWorld, trajectory.targetId);
      if (!target) continue;
      const thresholdConditions = (groups.victory?.conditions || []).filter(condition =>
        condition.type === 'HP_RATIO_AT_OR_BELOW' &&
        r8ConditionMatchesUnit(request, condition, trajectory.targetId)
      );
      if (!thresholdConditions.length) continue;
      const killAlsoRequired = (groups.victory?.conditions || []).some(condition =>
        ['TEAM_DEAD', 'UNIT_DEAD'].includes(condition.type) &&
        r8ConditionMatchesUnit(request, condition, trajectory.targetId)
      );
      if (killAlsoRequired) continue;
      const currentPP = 100 * preview.readHp(target) / Math.max(1, preview.readHpMax(target));
      const countablePP = Math.max(...thresholdConditions.map(condition =>
        Math.max(0, currentPP - 100 * Number(condition.threshold || 0))
      ));
      discardedOverkillPP += Math.max(0, damagePP - Math.min(damagePP, countablePP));
    }
    return discardedOverkillPP;
  }

  function r8SetProjectedHp(unit = {}, nextHp = 0) {
    const value = Math.max(0, nextHp);
    unit.hp = value;
    unit.HP = value;
    unit.生命 = value;
    if (unit.属性 && typeof unit.属性 === 'object') {
      unit.属性.HP = value;
      unit.属性.生命 = value;
    }
    if (value <= 0) {
      unit.状态 = { ...(unit.状态 || {}), 存活: false, 行动: '死亡' };
    }
  }

  function r8TerminalUtility(request = {}, route = {}) {
    const projected = cloneValue(request?.visibleWorld || {});
    const objectives = preview.normalizeBattleObjectives(request?.objectiveContract || {}, projected);
    for (const trajectory of route?.healthTrajectoryByTarget || []) {
      const target = findUnitInWorld(projected, trajectory.targetId);
      if (!target) continue;
      const delta = Number(trajectory.healthDeltaPP || 0) * Math.max(1, preview.readHpMax(target)) / 100;
      r8SetProjectedHp(target, preview.readHp(target) + delta);
      const resolution = preview.evaluateBattleObjectives(projected, objectives, {
        round: Number(projected?.回合 || 0),
        roundCompleted: false,
      });
      if (!resolution.terminal) continue;
      const actorIsPlayer = r8ObjectiveGroups(request).actorIsPlayer;
      const won = resolution.status === (actorIsPlayer ? 'PLAYER_WIN' : 'ENEMY_WIN');
      const lost = resolution.status === (actorIsPlayer ? 'ENEMY_WIN' : 'PLAYER_WIN');
      return Object.freeze({
        terminal: true,
        status: resolution.status,
        utility: won ? 100 : lost ? -100 : 0,
        terminalAfterEffectInstanceId: String(trajectory.sourceEffectInstanceId || ''),
      });
    }
    return Object.freeze({ terminal: false, status: 'ONGOING', utility: null, terminalAfterEffectInstanceId: '' });
  }

  function r8OpportunityList(request = {}) {
    const snapshot = request?.evaluationContext?.opportunitySnapshot;
    if (Array.isArray(snapshot)) return snapshot;
    if (Array.isArray(snapshot?.opportunities)) return snapshot.opportunities;
    return snapshot && typeof snapshot === 'object' ? [snapshot] : [];
  }

  function r8ActionPoolDeltas(request = {}, route = {}) {
    const deltas = [];
    const consumedEnvelopeTargets = new Set();
    const opportunities = r8OpportunityList(request);
    const schedules = request?.evaluationContext?.scheduledEvents || [];
    for (const effect of route?.actionPoolEffects || []) {
      const target = findUnitInWorld(request.visibleWorld, effect.targetId);
      const targetEnvelope = request?.actionRouteCatalog?.[effect.targetId];
      const targetRouteValue = Math.max(0, Number(targetEnvelope?.primaryRoute?.routeBenefitPP || 0));
      const targetOwnSide = target && String(sideOf(request.visibleWorld, target)) === String(request.actorSide);
      const probability = clamp(
        effect?.evidence?.applicationProbability ??
        effect?.evidence?.probability ??
        1,
        0,
        1,
      );
      let deltaPP = Number(effect?.evidence?.r8HealthTrajectoryDeltaPP || 0);
      const envelopeDeltas = request?.candidateEnvelopeDeltas?.[route?.candidateId] || [];
      const takeEnvelopeDelta = (allAffected = false) => {
        const entries = envelopeDeltas.filter(entry =>
          !consumedEnvelopeTargets.has(entry.targetId) &&
          (allAffected || String(entry?.targetId || '').trim() === String(effect?.targetId || '').trim())
        );
        entries.forEach(entry => consumedEnvelopeTargets.add(entry.targetId));
        return entries.reduce((sum, entry) => sum + Number(entry.healthTrajectoryDeltaPP || 0), 0);
      };
      let realizable = true;
      if (effect.outcomeKind === 'ACTION_CANCELLED') {
        const opportunity = opportunities.find(entry =>
          String(entry?.ownerId || '').trim() === String(effect.targetId || '').trim() &&
          !['CONSUMED', 'EXPIRED', 'LOST'].includes(String(entry?.status || '').trim().toUpperCase())
        );
        const descriptor = schedules.find(entry =>
          String(entry?.ownerId || entry?.targetId || '').trim() === String(effect.targetId || '').trim()
        );
        realizable = !!opportunity || !!descriptor;
        deltaPP = realizable ? targetRouteValue * probability * (targetOwnSide ? -1 : 1) : 0;
      } else if (effect.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
        const multiplier = Number(effect?.evidence?.multiplier || 1);
        const explicitFactor = Number(effect?.evidence?.qualityFactor);
        const factor = Number.isFinite(explicitFactor)
          ? explicitFactor
          : Number.isFinite(multiplier) && multiplier !== 1
            ? multiplier - 1
            : 0;
        deltaPP = deltaPP || takeEnvelopeDelta(true) ||
          targetRouteValue * factor * probability * (targetOwnSide ? 1 : -1);
      } else if (['ACTION_GRANTED', 'SUMMON_WINDOW'].includes(effect.outcomeKind)) {
        const scheduled = schedules.some(entry =>
          String(entry?.sourceEventId || entry?.effectInstanceId || '').includes(String(effect.effectInstanceId || ''))
        );
        realizable = scheduled || effect.outcomeKind === 'ACTION_GRANTED';
        deltaPP = deltaPP || (realizable ? targetRouteValue * probability * (targetOwnSide ? 1 : -1) : 0);
      } else if (effect.outcomeKind === 'RESOURCE_OPTION_CHANGED') {
        const hasNonResourceEffect = (route?.actionPoolEffects || []).some(entry =>
          entry !== effect && entry.outcomeKind !== 'RESOURCE_OPTION_CHANGED'
        );
        deltaPP = Number(effect?.evidence?.routeDeltaPP || 0) ||
          (hasNonResourceEffect ? 0 : takeEnvelopeDelta());
      } else if (['STATE_CHANGED', 'RULE_CHANGED'].includes(effect.outcomeKind)) {
        deltaPP = takeEnvelopeDelta(true);
      }
      if (!deltaPP && !['ACTION_CANCELLED', 'NEXT_ACTION_QUALITY_CHANGED', 'ACTION_GRANTED', 'SUMMON_WINDOW', 'RESOURCE_OPTION_CHANGED'].includes(effect.outcomeKind)) {
        continue;
      }
      deltas.push(Object.freeze({
        ...effect,
        ownerType: 'ACTION_POOL_DELTA',
        realizable,
        healthTrajectoryDeltaPP: Number(deltaPP || 0),
      }));
    }
    return Object.freeze(deltas);
  }

  function projectR8GoalUtility(request = {}, candidate = {}, route = {}) {
    const groups = r8ObjectiveGroups(request);
    const directTrajectoryHEPP = (route?.healthTrajectoryByTarget || []).reduce((sum, trajectory) => {
      const victoryValue = r8GroupTrajectoryValue(request, groups.victory, trajectory, 'VICTORY');
      const defeatReduction = r8GroupTrajectoryValue(request, groups.defeat, trajectory, 'DEFEAT');
      return sum + Math.max(victoryValue, defeatReduction);
    }, 0);
    const actionPoolDeltas = r8ActionPoolDeltas(request, route);
    const actionPoolHEPP = actionPoolDeltas.reduce(
      (sum, delta) => sum + Number(delta.healthTrajectoryDeltaPP || 0),
      0,
    );
    const terminal = r8TerminalUtility(request, route);
    const nonTerminalUtility = clamp(directTrajectoryHEPP + actionPoolHEPP, -99, 99);
    const baseUtility = terminal.terminal ? terminal.utility : nonTerminalUtility;
    const responseModel = request?.responseModelByCandidate?.[candidate?.candidateId] ||
      buildR8ResponseModel(request, candidate?.candidateId);
    const responseBranches = [
      ...(responseModel?.mainBranches || []),
      ...(responseModel?.disasterTail ? [responseModel.disasterTail] : []),
    ];
    let expectedCandidateUtility = baseUtility * Number(responseModel?.noResponseProbability ?? 1);
    let expectedNoOpUtility = 0 * Number(responseModel?.noResponseProbability ?? 1);
    if (terminal.terminal) {
      expectedCandidateUtility = baseUtility;
      expectedNoOpUtility = 0;
    } else {
      for (const branch of responseBranches) {
        const probability = clamp(branch?.probability || 0, 0, 1);
        const threat = median([
          Number(branch?.threatEnvelope?.lower || 0),
          Number(branch?.threatEnvelope?.upper || 0),
        ]);
        const catastrophic = String(branch?.projectionId || '').startsWith('disaster:');
        expectedCandidateUtility += probability * (catastrophic ? -100 : clamp(baseUtility - threat, -99, 99));
        expectedNoOpUtility += probability * (catastrophic ? -100 : clamp(-threat, -99, 99));
      }
    }
    const informationValueHEPP = Number(request?.informationValueByCandidate?.[candidate?.candidateId] || 0);
    const objectiveUtilityHEPP = expectedCandidateUtility - expectedNoOpUtility + informationValueHEPP;
    const disasterThreat = responseModel?.disasterTail
      ? Number(responseModel.disasterTail?.threatEnvelope?.upper || 0)
      : 0;
    return Object.freeze({
      candidateId: String(candidate?.candidateId || ''),
      directTrajectoryHEPP,
      actionPoolHEPP,
      actionPoolDeltas,
      terminal,
      expectedCandidateUtility,
      expectedNoOpUtility,
      informationValueHEPP,
      objectiveUtilityHEPP,
      discardedOverkillPP: r8ThresholdOverkill(request, route),
      worstTailLossHEPP: Math.max(0, disasterThreat),
      healthTrajectory: route?.healthTrajectoryByTarget || Object.freeze([]),
      responseModel,
    });
  }

  function buildR8CausalValueFacts(request = {}, candidate = {}, route = {}, projection = {}) {
    const facts = [];
    const currentHpByTarget = new Map();
    for (const trajectory of route?.healthTrajectoryByTarget || []) {
      const target = findUnitInWorld(request.visibleWorld, trajectory.targetId);
      if (!target) continue;
      const before = currentHpByTarget.has(trajectory.targetId)
        ? currentHpByTarget.get(trajectory.targetId)
        : 100 * preview.readHp(target) / Math.max(1, preview.readHpMax(target));
      const after = clamp(before + Number(trajectory.healthDeltaPP || 0), 0, 100);
      currentHpByTarget.set(trajectory.targetId, after);
      facts.push({
        valueKey: [
          trajectory.rootActionId || candidate.candidateId,
          trajectory.sourceEffectInstanceId,
          trajectory.targetId,
          trajectory.outcomeKind,
          trajectory.windowId || 'NOW',
        ].join('|'),
        ownerType: 'STATE_DELTA',
        rootActionId: trajectory.rootActionId || candidate.candidateId,
        effectInstanceId: trajectory.sourceEffectInstanceId,
        targetId: trajectory.targetId,
        outcomeKind: trajectory.outcomeKind,
        windowId: trajectory.windowId || 'NOW',
        healthRangePP: Object.freeze({ lower: Math.min(before, after), upper: Math.max(before, after) }),
        sourceFactIds: Object.freeze([]),
        consumedRanges: Object.freeze([]),
      });
    }
    for (const delta of projection?.actionPoolDeltas || []) {
      if (!Number(delta.healthTrajectoryDeltaPP || 0)) continue;
      facts.push({
        valueKey: [
          delta.rootActionId || candidate.candidateId,
          delta.effectInstanceId,
          delta.targetId,
          delta.outcomeKind,
          delta.windowId || 'NOW',
        ].join('|'),
        ownerType: 'ACTION_POOL_DELTA',
        rootActionId: delta.rootActionId || candidate.candidateId,
        effectInstanceId: delta.effectInstanceId,
        targetId: delta.targetId,
        outcomeKind: delta.outcomeKind,
        windowId: delta.windowId || 'NOW',
        healthRangePP: Object.freeze({
          lower: Math.min(0, Number(delta.healthTrajectoryDeltaPP || 0)),
          upper: Math.max(0, Number(delta.healthTrajectoryDeltaPP || 0)),
        }),
        sourceFactIds: Object.freeze([]),
        consumedRanges: Object.freeze([]),
      });
    }
    if (projection?.terminal?.terminal) {
      facts.push({
        valueKey: [
          candidate.candidateId,
          projection.terminal.terminalAfterEffectInstanceId || 'terminal',
          request.actorId,
          'FIRST_TERMINAL',
          'FIRST_TERMINAL',
        ].join('|'),
        ownerType: 'TERMINAL_DELTA',
        rootActionId: candidate.candidateId,
        effectInstanceId: projection.terminal.terminalAfterEffectInstanceId || 'terminal',
        targetId: request.actorId,
        outcomeKind: 'FIRST_TERMINAL',
        windowId: 'FIRST_TERMINAL',
        healthRangePP: Object.freeze({ lower: 0, upper: 0 }),
        sourceFactIds: Object.freeze(facts.map(fact => fact.valueKey)),
        consumedRanges: Object.freeze([]),
      });
    }
    validateR8CausalOwnership(facts);
    return deepFreeze(facts);
  }

  function validateR8CausalOwnership(facts = []) {
    const keys = new Set();
    const ownedIntervals = new Map();
    for (const fact of facts) {
      const key = String(fact?.valueKey || '').trim();
      if (!key || keys.has(key)) throw new Error(`DUPLICATE_CAUSAL_VALUE:${key || 'missing'}`);
      keys.add(key);
      const lower = Number(fact?.healthRangePP?.lower || 0);
      const upper = Number(fact?.healthRangePP?.upper || 0);
      if (upper < lower) throw new Error(`CAUSAL_RANGE_OWNER_CONFLICT:${key}`);
      if (fact?.ownerType === 'TERMINAL_DELTA') continue;
      const intervalKey = [
        fact?.targetId,
        fact?.windowId,
        fact?.outcomeKind,
      ].join('|');
      const intervals = ownedIntervals.get(intervalKey) || [];
      if (upper > lower && intervals.some(interval =>
        Math.max(lower, interval.lower) < Math.min(upper, interval.upper) - 1e-9
      )) {
        throw new Error(`CAUSAL_RANGE_OWNER_CONFLICT:${key}`);
      }
      intervals.push({ lower, upper, key });
      ownedIntervals.set(intervalKey, intervals);
    }
    return true;
  }

  function r8HasDefenseWindow(request = {}) {
    const opportunity = request?.actionOpportunity || {};
    if (
      opportunity.imminentThreat === true ||
      opportunity.counterWindow === true ||
      opportunity.interceptThreat === true ||
      opportunity.incomingAction
    ) return true;
    if (r8OpportunityList(request).some(entry =>
      ['DODGE_WINDOW', 'DEFEND_WINDOW', 'GUARD_INTERCEPT', 'COUNTER_WINDOW'].includes(
        String(entry?.grantType || '').trim().toUpperCase(),
      ) && !['CONSUMED', 'EXPIRED', 'LOST'].includes(String(entry?.status || '').trim().toUpperCase())
    )) return true;
    return (request?.evaluationContext?.scheduledEvents || []).some(entry =>
      entry?.incomingAction || entry?.threat === true ||
      /INCOMING|CHARGE|ATTACK/.test(String(entry?.type || entry?.eventKind || '').toUpperCase())
    );
  }

  function r8AssetReserve(request = {}, candidate = {}) {
    const actor = findUnitInWorld(request.visibleWorld, request.actorId);
    if (!actor) return 0;
    const costs = candidate?.costs || {};
    const resources = [['魂力', '魂力'], ['精神力', '精神力'], ['体力', '体力']];
    return median(resources.map(([key, label]) => {
      const maximum = Math.max(1, preview.readResourceMax(actor, label));
      return clamp((preview.readResource(actor, label) - Math.max(0, Number(costs?.[key] || 0))) / maximum, 0, 1);
    })) * 100;
  }

  function r8CandidateExclusion(request = {}, candidate = {}, route = {}, projection = {}) {
    const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
    const hasCost = Object.values(candidate?.costs || {}).some(value => Number(value || 0) > 0) ||
      (route?.actionPoolEffects || []).some(effect => effect.outcomeKind === 'IRREVERSIBLE_ASSET_LOST');
    if (['DEFEND', 'EVADE'].includes(actionKind) && !r8HasDefenseWindow(request)) {
      return 'ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED';
    }
    if (
      (route?.actionPoolEffects || []).some(effect => effect.outcomeKind === 'ACTION_CANCELLED') &&
      !(projection?.actionPoolDeltas || []).some(delta =>
        delta.outcomeKind === 'ACTION_CANCELLED' && delta.realizable && Number(delta.healthTrajectoryDeltaPP || 0) !== 0
      ) &&
      !Number(projection?.directTrajectoryHEPP || 0)
    ) return 'CONTROL_WINDOW_NOT_REALIZABLE';
    if (
      (route?.actionPoolEffects || []).some(effect => effect.outcomeKind === 'SUMMON_WINDOW') &&
      !(projection?.actionPoolDeltas || []).some(delta =>
        delta.outcomeKind === 'SUMMON_WINDOW' && delta.realizable && Number(delta.healthTrajectoryDeltaPP || 0) !== 0
      )
    ) return 'SUMMON_WINDOW_NOT_REALIZABLE';
    if (Number(projection?.objectiveUtilityHEPP || 0) <= 1e-9 && hasCost) return 'ZERO_MARGINAL_WITH_COST';
    const actor = findUnitInWorld(request.visibleWorld, request.actorId);
    if (actor && (route?.healthTrajectoryByTarget || []).some(trajectory =>
      trajectory.targetId === request.actorId &&
      preview.readHp(actor) + Number(trajectory.healthDeltaPP || 0) * preview.readHpMax(actor) / 100 <= 0
    ) && !projection?.terminal?.terminal) return 'UNCOMPENSATED_SELF_DESTRUCTION';
    if (Number(projection?.discardedOverkillPP || 0) > 0) {
      const killsTarget = (route?.healthTrajectoryByTarget || []).some(trajectory => {
        const target = findUnitInWorld(request.visibleWorld, trajectory.targetId);
        return target &&
          preview.readHp(target) + Number(trajectory.healthDeltaPP || 0) * preview.readHpMax(target) / 100 <= 0;
      });
      if (killsTarget) return 'AVOIDABLE_IRREVERSIBLE_OVERREACH_SELECTED';
    }
    return '';
  }

  function r8Dominates(left = {}, right = {}) {
    const benefits = ['objectiveUtilityHEPP', 'informationValueHEPP', 'assetReserve', 'survivalLowerBound'];
    const costs = ['worstTailLossHEPP', 'discardedOverkillPP'];
    const benefitOk = benefits.every(key => Number(left[key] || 0) >= Number(right[key] || 0) - 1e-9);
    const costOk = costs.every(key => Number(left[key] || 0) <= Number(right[key] || 0) + 1e-9);
    const strict = benefits.some(key => Number(left[key] || 0) > Number(right[key] || 0) + 1e-9) ||
      costs.some(key => Number(left[key] || 0) < Number(right[key] || 0) - 1e-9);
    return benefitOk && costOk && strict;
  }

  function r8ParetoFilter(candidates = []) {
    const viable = candidates.filter(candidate => !candidate.rejectionCode);
    return Object.freeze(viable.filter(candidate =>
      !viable.some(other => other !== candidate && r8Dominates(other, candidate))
    ));
  }

  function r8NormalizeUtilities(candidates = []) {
    const center = median(candidates.map(candidate => candidate.objectiveUtilityHEPP));
    const mad = Math.max(1, median(candidates.map(candidate =>
      Math.abs(Number(candidate.objectiveUtilityHEPP || 0) - center)
    )));
    return candidates.map(candidate => ({
      ...candidate,
      normalizedUtility: (Number(candidate.objectiveUtilityHEPP || 0) - center) / mad,
    }));
  }

  function selectR8Candidate(request = {}, candidates = []) {
    const actor = findUnitInWorld(request.visibleWorld, request.actorId);
    const experience = experienceOf(actor || {});
    const spiritualRatio = ratio(actor || {}, 'men');
    const staminaRatio = ratio(actor || {}, 'vit');
    const confidence = clamp(0.50 * experience + 0.30 * spiritualRatio + 0.20 * staminaRatio, 0, 1);
    const temperature = 0.8 + 1.8 * (1 - confidence);
    const maxRegret = 0.35 + 0.9 * (1 - confidence);
    const normalized = r8NormalizeUtilities(candidates);
    const paretoIds = new Set(r8ParetoFilter(normalized).map(candidate => candidate.candidateId));
    const eligible = normalized.filter(candidate => !candidate.rejectionCode && paretoIds.has(candidate.candidateId))
      .sort((left, right) =>
        Number(right.normalizedUtility || 0) - Number(left.normalizedUtility || 0) ||
        String(left.candidateId).localeCompare(String(right.candidateId))
      );
    if (!eligible.length) {
      const fallback = normalized.find(candidate =>
        String(candidate?.declaration?.actionKind || '').trim().toUpperCase() === 'DEFEND' &&
        !Object.values(candidate?.costs || {}).some(value => Number(value || 0) > 0)
      );
      if (!fallback) throw new Error('R8_NO_LEGAL_FALLBACK');
      return Object.freeze({
        selected: fallback,
        normalized,
        paretoIds,
        confidence,
        temperature,
        maxRegret,
        selectionMode: 'FORCED_DEFEND_FALLBACK',
      });
    }
    const best = eligible[0];
    const second = eligible[1];
    if (!second || Number(best.normalizedUtility || 0) - Number(second.normalizedUtility || 0) >= 2 * temperature) {
      return Object.freeze({
        selected: best,
        normalized,
        paretoIds,
        confidence,
        temperature,
        maxRegret,
        selectionMode: 'DIRECT_BEST',
      });
    }
    const pool = eligible.filter(candidate =>
      Number(best.normalizedUtility || 0) - Number(candidate.normalizedUtility || 0) <= maxRegret + 1e-9
    );
    const weights = pool.map(candidate => Math.exp(Number(candidate.normalizedUtility || 0) / Math.max(0.0001, temperature)));
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    let roll = stableRoll(`${request.seed}:${request.requestHash}:r8-softmax`) * total;
    let selected = pool[pool.length - 1];
    for (let index = 0; index < pool.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        selected = pool[index];
        break;
      }
    }
    return Object.freeze({
      selected,
      normalized,
      paretoIds,
      confidence,
      temperature,
      maxRegret,
      selectionMode: 'SEEDED_SOFTMAX',
    });
  }

  function runR8Provider(request = {}) {
    const actorRoutes = request?.actorCandidateRoutes || {};
    const evaluated = request.frozenCandidates.map(candidate => {
      const route = actorRoutes[candidate.candidateId];
      if (!route) throw new Error(`ACTION_ROUTE_INCOMPLETE:${candidate.candidateId}`);
      const goalProjection = projectR8GoalUtility(request, candidate, route);
      const causalValueFacts = buildR8CausalValueFacts(request, candidate, route, goalProjection);
      const actor = findUnitInWorld(request.visibleWorld, request.actorId);
      const survivalPP = actor
        ? 100 * preview.readHp(actor) / Math.max(1, preview.readHpMax(actor))
        : 0;
      const record = {
        candidateId: candidate.candidateId,
        declaration: candidate.declaration,
        actionName: candidateActionName(candidate),
        costs: candidate.costs || {},
        route,
        goalProjection,
        causalValueFacts,
        objectiveUtilityHEPP: goalProjection.objectiveUtilityHEPP,
        informationValueHEPP: goalProjection.informationValueHEPP,
        assetReserve: r8AssetReserve(request, candidate),
        survivalLowerBound: survivalPP - goalProjection.worstTailLossHEPP,
        worstTailLossHEPP: goalProjection.worstTailLossHEPP,
        discardedOverkillPP: goalProjection.discardedOverkillPP,
      };
      record.rejectionCode = r8CandidateExclusion(request, candidate, route, goalProjection);
      return record;
    });
    const choice = selectR8Candidate(request, evaluated);
    const selected = choice.normalized.find(candidate => candidate.candidateId === choice.selected.candidateId);
    const alternatives = choice.normalized
      .filter(candidate => candidate.candidateId !== selected.candidateId)
      .sort((left, right) =>
        Number(right.objectiveUtilityHEPP || 0) - Number(left.objectiveUtilityHEPP || 0) ||
        String(left.candidateId).localeCompare(String(right.candidateId))
      )
      .slice(0, 2);
    const scoreRecord = candidate => Object.freeze({
      candidateId: candidate.candidateId,
      actionName: candidate.actionName,
      actionKind: candidate.declaration.actionKind,
      actorId: request.actorId,
      targetIds: Object.freeze([...(candidate.declaration.targetIds || [])]),
      declaration: candidate.declaration,
      objectiveUtility: candidate.objectiveUtilityHEPP,
      objectiveUtilityHEPP: candidate.objectiveUtilityHEPP,
      normalizedUtility: candidate.normalizedUtility,
      vector: Object.freeze({
        objectiveUtilityHEPP: candidate.objectiveUtilityHEPP,
        informationValueHEPP: candidate.informationValueHEPP,
        assetReserve: candidate.assetReserve,
        survivalLowerBound: candidate.survivalLowerBound,
        worstTailLossHEPP: candidate.worstTailLossHEPP,
        discardedOverkillPP: candidate.discardedOverkillPP,
      }),
      goalProjection: candidate.goalProjection,
      primaryRoute: candidate.route,
      backupRoute: request?.actionRouteCatalog?.[request.actorId]?.backupRoute || null,
      causalValueFacts: candidate.causalValueFacts,
      rejectionCode: candidate.rejectionCode || '',
      classification: candidate.rejectionCode ? 'HARD_INVALID' : 'VIABLE',
      selected: candidate.candidateId === selected.candidateId,
    });
    return deepFreeze({
      schemaVersion: '8.3-decision-audit-2',
      version: '8.3-decision-audit-2',
      decisionEngine: 'R8',
      actorId: request.actorId,
      opportunityId: String(request?.actionOpportunity?.opportunityId || ''),
      candidateCount: evaluated.length,
      paretoCount: choice.paretoIds.size,
      selected: {
        ...scoreRecord(selected),
        selectionMode: choice.selectionMode,
      },
      alternatives: alternatives.map(scoreRecord),
      candidateAudit: choice.normalized.map(scoreRecord),
      scoreAudit: [selected, ...alternatives].map(scoreRecord),
      beliefState: request.beliefState,
      teamIntent: request.teamPublicFacts,
      strategyMemory: {
        targetIds: Object.freeze([...(selected.declaration.targetIds || [])]),
        primaryRouteKey: selected.route.routeKey,
        backupRouteKey: request?.actionRouteCatalog?.[request.actorId]?.backupRoute?.routeKey || '',
      },
      strategicSignature: `r8:${preview.stableHash({
        selectedCandidateId: selected.candidateId,
        primaryRouteKey: selected.route.routeKey,
        objectiveHash: request.evaluationContext.objectiveHash,
      })}`,
      stateCapacityTotal: Math.max(0, Number(selected.objectiveUtilityHEPP || 0)),
      beliefRevision: request.evaluationContext.beliefRevision,
      pendingStrategicEffect: selected.route.realizationWindows.some(windowId => windowId && windowId !== 'NOW'),
      decisionProfile: Object.freeze({
        confidence: choice.confidence,
        temperature: choice.temperature,
        maxRegret: choice.maxRegret,
        selectionMode: choice.selectionMode,
      }),
    });
  }

  function prepareDecisionRequest(input = {}) {
    const worldSnapshot = input?.worldSnapshot;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_decision_world_missing');
    const sourceWorldHash = preview.stableHash(worldSnapshot);
    const actor = findUnitInWorld(worldSnapshot, input?.actorId || '');
    if (!actor || !preview.isAlive(actor)) throw new Error('battle_decision_actor_unavailable');
    const actorId = preview.unitId(actor);
    const beliefState = buildInitialBelief(worldSnapshot, actorId, input?.beliefState || {});
    const visibleWorld = buildDecisionWorld(worldSnapshot, actorId, beliefState);
    const visibleActor = findUnitInWorld(visibleWorld, actorId);
    const actorSide = sideOf(visibleWorld, visibleActor);
    const battleIntent = actorBattleIntent(visibleWorld, actorSide, input?.battleIntent);
    const actionOpportunity = cloneValue(input?.actionOpportunity || {});
    const candidates = enumerateCandidates({
      ...input,
      worldSnapshot: visibleWorld,
      actorId,
      actorSide,
      battleIntent,
      beliefState,
      actionOpportunity,
    });
    if (!candidates.length) throw new Error('battle_decision_candidate_pool_empty');
    const candidateIds = new Set();
    const candidateFingerprintMap = {};
    const frozenCandidates = candidates.map(candidate => {
      const candidateId = String(candidate?.candidateId || '').trim();
      if (!candidateId || candidateIds.has(candidateId)) {
        throw new Error(`battle_decision_candidate_identity_invalid:${candidateId || 'missing'}`);
      }
      candidateIds.add(candidateId);
      const declaration = cloneValue(candidate?.declaration || {});
      const fingerprint = declarationFingerprint(declaration);
      candidateFingerprintMap[candidateId] = fingerprint;
      return {
        ...cloneValue(candidate),
        candidateId,
        declaration,
        declarationFingerprint: fingerprint,
      };
    });
    const objectiveContract = cloneValue(
      input?.objectiveContract ||
      battleIntent?.objectives ||
      visibleWorld?.胜负条件 ||
      {},
    );
    const runtimeSnapshot = input?.runtimeSnapshot && typeof input.runtimeSnapshot === 'object'
      ? cloneValue(input.runtimeSnapshot)
      : {};
    const opportunitySnapshot = cloneValue(
      runtimeSnapshot.opportunitySnapshot ||
      input?.opportunitySnapshot ||
      actionOpportunity,
    );
    const resourceTimeline = cloneValue(
      runtimeSnapshot.resourceTimeline ||
      input?.resourceTimeline ||
      [],
    );
    const scheduledEvents = cloneValue(
      runtimeSnapshot.scheduledEvents ||
      input?.scheduledEvents ||
      [],
    );
    const dependencyView = createDependencyView({
      worldSnapshot: visibleWorld,
      objectiveContract,
      opportunitySnapshot,
      scheduledEvents,
      beliefState,
    });
    const evaluationContext = {
      schemaVersion: '8.3-evaluation-context-1',
      worldRevision: String(input?.worldRevision || worldRevisionFor(worldSnapshot)),
      visibleWorldRevision: `visible:${preview.stableHash(visibleWorld)}`,
      beliefRevision: beliefRevisionFor(beliefState),
      objectiveHash: `objective:${preview.stableHash(objectiveContract)}`,
      opportunityRevision: `opportunity:${preview.stableHash(opportunitySnapshot)}`,
      resourceTimelineRevision: `resource:${preview.stableHash(resourceTimeline)}`,
      scheduleRevision: `schedule:${preview.stableHash(scheduledEvents)}`,
      opportunitySnapshot,
      resourceTimeline,
      scheduledEvents,
      horizon: cloneValue(input?.horizon || battleHorizonProfile(input, visibleWorld)),
      dependencyView,
    };
    const routeAnalysis = buildR8RouteCatalog({
      worldSnapshot: visibleWorld,
      actorId,
      actorCandidates: frozenCandidates,
      beliefState,
      battleIntent,
      actionOpportunity,
      dependencyView,
      evaluationContext,
    });
    const teamMarginalPlan = buildTeamMarginalPlan(routeAnalysis.routeCatalog, visibleWorld, actorId);
    const candidateEnvelopeDeltas = buildR8CandidateEnvelopeDeltas({
      worldSnapshot: visibleWorld,
      actorSide,
      routeCatalog: routeAnalysis.routeCatalog,
      projectedWorlds: routeAnalysis.actorProjectedWorlds,
      candidateRoutes: routeAnalysis.actorCandidateRoutes,
      beliefState,
      battleIntent,
      actionOpportunity,
    });
    const requestPayload = {
      schemaVersion: R8_REQUEST_SCHEMA,
      actorId,
      actorSide,
      actionOpportunity,
      objectiveContract,
      visibleWorld,
      beliefState,
      teamPublicFacts: worldEntries(visibleWorld).map(entry => ({
        unitId: preview.unitId(entry.unit),
        side: entry.side,
        alive: preview.isAlive(entry.unit),
        hpRatio: preview.readHp(entry.unit) / Math.max(1, preview.readHpMax(entry.unit)),
        visibleStates: visibleStates(entry.unit),
      })),
      frozenCandidates,
      candidateFingerprintMap,
      evaluationContext,
      actionRouteCatalog: routeAnalysis.routeCatalog,
      actorCandidateRoutes: routeAnalysis.actorCandidateRoutes,
      candidateEnvelopeDeltas,
      teamMarginalPlan,
      routeCacheMetrics: routeAnalysis.cacheMetrics,
      battleIntent: cloneValue(battleIntent),
      strategyMemory: cloneValue(input?.strategyMemory || {}),
      seed: input?.seed ?? 1,
    };
    requestPayload.responseModelByCandidate = Object.fromEntries(
      frozenCandidates.map(candidate => [
        candidate.candidateId,
        buildR8ResponseModel(requestPayload, candidate.candidateId),
      ]),
    );
    requestPayload.informationValueByCandidate = Object.fromEntries(
      frozenCandidates.map(candidate => [
        candidate.candidateId,
        r8InformationValue(requestPayload, candidate.candidateId),
      ]),
    );
    if (preview.stableHash(worldSnapshot) !== sourceWorldHash) {
      throw new Error('PROVIDER_MUTATED_STATE:prepare');
    }
    const request = {
      ...requestPayload,
      requestHash: decisionRequestHash(requestPayload),
    };
    return deepFreeze(request);
  }

  function providerInput(request = {}) {
    return {
      worldSnapshot: request.visibleWorld,
      visibleWorldSnapshot: request.visibleWorld,
      actorId: request.actorId,
      battleIntent: request.battleIntent,
      beliefState: request.beliefState,
      actionOpportunity: request.actionOpportunity,
      strategyMemory: request.strategyMemory,
      seed: request.seed,
      __preparedDecisionWorld: true,
      __preparedBeliefState: request.beliefState,
      __frozenCandidates: request.frozenCandidates,
    };
  }

  const providerRegistry = Object.freeze({
    'legacy-baseline': request => decide(providerInput(request)),
    'r74-next-baseline': request => decideNext(providerInput(request)),
    'r8-shadow': request => runR8Provider(request),
    r8: request => runR8Provider(request),
  });

  function runProvider(input = {}) {
    const providerId = String(input?.providerId || '').trim();
    const request = input?.request;
    if (!Object.hasOwn(providerRegistry, providerId)) {
      throw new Error(`battle_decision_provider_unknown:${providerId || 'missing'}`);
    }
    if (!request || request.schemaVersion !== R8_REQUEST_SCHEMA) {
      throw new Error('DECISION_SCHEMA_MISMATCH:request');
    }
    const beforeHash = decisionRequestHash(request);
    if (beforeHash !== request.requestHash) throw new Error('PROVIDER_MUTATED_STATE:request_hash');
    let decision;
    providerExecutionDepth += 1;
    try {
      decision = providerRegistry[providerId](request);
    } finally {
      providerExecutionDepth -= 1;
    }
    if (decisionRequestHash(request) !== beforeHash) throw new Error('PROVIDER_MUTATED_STATE:provider');
    const selectedCandidateId = String(decision?.selected?.candidateId || '').trim();
    const selectedCandidate = request.frozenCandidates.find(
      candidate => candidate.candidateId === selectedCandidateId,
    );
    if (!selectedCandidate) throw new Error('PROVIDER_UNKNOWN_CANDIDATE');
    const selectedDeclaration = cloneValue(decision?.selected?.declaration || {});
    const expectedFingerprint = request.candidateFingerprintMap[selectedCandidateId];
    if (declarationFingerprint(selectedDeclaration) !== expectedFingerprint) {
      throw new Error('DECLARATION_FINGERPRINT_MISMATCH');
    }
    return deepFreeze({
      schemaVersion: R8_RESULT_SCHEMA,
      providerId,
      requestHash: request.requestHash,
      selectedCandidateId,
      selectedDeclaration,
      decisionAudit: cloneValue(decision),
      beliefState: cloneValue(decision?.beliefState || request.beliefState),
      teamIntent: cloneValue(decision?.teamIntent || {}),
      strategyMemory: cloneValue(decision?.strategyMemory || request.strategyMemory),
      strategicSignature: String(decision?.strategicSignature || '').trim(),
      stateCapacityTotal: Math.max(0, Number(decision?.stateCapacityTotal || 0)),
      beliefRevision: String(decision?.beliefRevision || beliefRevisionFor(request.beliefState)),
      pendingStrategicEffect: decision?.pendingStrategicEffect === true,
      decisionProfile: cloneValue(decision?.decisionProfile || {}),
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
    hitMechanicKey,
    hitMechanicFactor,
    updatePublicObservation,
    updateTargetRealizationBelief,
    unknownResponseMass,
    mechanicAdaptationKey,
    mechanicPosteriorWithAdaptation,
    buildTeamIntent,
    identifyProblems,
    activeStrategyMemory,
    collectInventory,
    creationProfile,
    strategicSignature,
    detectStalemate,
    actionFamilyOf,
    detectStrategyDegeneration,
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
    declarationFingerprint,
    createDependencyView,
    r8PreviewCacheKey,
    actionRouteFromPreview,
    selectPrimaryBackupRoutes,
    buildR8RouteCatalog,
    buildTeamMarginalPlan,
    buildR8CandidateEnvelopeDeltas,
    buildR8ResponseModel,
    r8InformationValue,
    r8ObjectiveGroups,
    r8ThresholdOverkill,
    r8TerminalUtility,
    r8ActionPoolDeltas,
    projectR8GoalUtility,
    buildR8CausalValueFacts,
    validateR8CausalOwnership,
    r8HasDefenseWindow,
    r8CandidateExclusion,
    r8Dominates,
    r8ParetoFilter,
    r8NormalizeUtilities,
    selectR8Candidate,
    runR8Provider,
    prepareDecisionRequest,
    runProvider,
    providerIds: Object.freeze(Object.keys(providerRegistry)),
  });
})();

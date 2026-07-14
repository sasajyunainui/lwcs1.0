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
    }));
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
    return {
      ...existing,
      revision: preview.stableHash({ actorId, units, confidence, mechanics, publicResponses }),
      confidence,
      units,
      mechanics,
      publicResponses,
    };
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
    const decisionWorld = { ...worldSnapshot, 参战者: projectedParticipants };
    const summons = worldSnapshot?.召唤单位表;
    if (summons && typeof summons === 'object') {
      Object.defineProperty(decisionWorld, '召唤单位表', {
        configurable: true,
        enumerable: false,
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
    const nextWorld = { ...worldSnapshot, 参战者: nextParticipants };
    const summons = worldSnapshot?.召唤单位表;
    if (summons && typeof summons === 'object') {
      Object.defineProperty(nextWorld, '召唤单位表', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: Object.fromEntries(Object.entries(summons).map(([key, unit]) => [
          key,
          mapper(unit, /^(enemy|敌方|对方)$/i.test(String(unit?.阵营 || '').trim()) ? 'team_enemy' : 'team_player'),
        ])),
      });
    }
    return nextWorld;
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
    const next = cloneValue(beliefState || {});
    next.mechanics = next.mechanics && typeof next.mechanics === 'object' ? next.mechanics : {};
    const key = mechanicKey({ ...observation, beliefState: next });
    const prior = next.mechanics[key] || betaPrior(observation.estimatedProbability, observation.experience);
    next.mechanics[key] = {
      alpha: Number(prior.alpha) + (observation.success === true ? 1 : 0),
      beta: Number(prior.beta) + (observation.success === true ? 0 : 1),
      observations: Math.max(0, Number(prior.observations || 0)) + 1,
    };
    next.revision = preview.stableHash({ units: next.units, mechanics: next.mechanics, publicResponses: next.publicResponses });
    return next;
  }

  function updatePublicObservation(beliefState = {}, observation = {}) {
    const next = cloneValue(beliefState || {});
    const sourceActorId = String(observation?.sourceActorId || '').trim();
    const responseId = String(observation?.responseId || observation?.sourceActionId || observation?.actionName || '').trim();
    if (!sourceActorId || !responseId) return next;
    next.units = next.units && typeof next.units === 'object' ? next.units : {};
    next.publicResponses = next.publicResponses && typeof next.publicResponses === 'object' ? next.publicResponses : {};
    const currentResponses = Array.isArray(next.publicResponses[sourceActorId]) ? next.publicResponses[sourceActorId] : [];
    const existing = currentResponses.find(response => String(response?.responseId || '').trim() === responseId);
    const observedValue = Math.max(0, Number(observation?.baseActionValue || 0));
    const response = {
      ...(existing || {}),
      responseId,
      actionName: String(observation?.actionName || existing?.actionName || responseId).trim(),
      utility: Math.max(Number(existing?.utility || 0), observedValue),
      baseActionValue: Math.max(Number(existing?.baseActionValue || 0), observedValue),
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
    next.revision = preview.stableHash({ units: next.units, mechanics: next.mechanics, publicResponses: next.publicResponses, confidence: next.confidence });
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
      const actor = {
        ...unit,
        属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : unit?.属性,
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
      } else {
        actor.sp = remaining;
        if (actor.属性 && typeof actor.属性 === 'object') actor.属性.魂力 = remaining;
      }
      });
      return actor;
    });
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
      if (!costAffordable(actor, skill)) return;
      if (counterOnly && !isExplicitCounterSkill(skill, immediateBudget)) return;
      if (!forcedSkill && !counterOnly && input.actionOpportunity?.enforceImmediateBudget === true && !isImmediateReactionSkill(skill, immediateBudget)) return;
      if (reactionOnly && !isImmediateReactionSkill(skill, immediateBudget)) return;
      const profile = targetProfile(skill);
      if (counterOnly && !['HOSTILE_SINGLE', 'HOSTILE_GROUP', 'ANY_SINGLE'].includes(profile)) return;
      const counterSkill = counterOnly
        ? { ...skill, 消耗: '无', 魂力消耗: 0, 精神力消耗: 0, 体力消耗: 0, 前摇: 0, cast_time: 0 }
        : skill;
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
      targetSets.forEach((targetIds, targetIndex) => {
        const id = `${actorId}:${forcedSkill ? 'forced-skill' : 'skill'}:${skillId(skill, index)}:${targetIndex}`;
        const declaration = {
          actionId: id,
          actorId,
          actionKind: 'RELEASE_SKILL',
          targetIds,
          skill: counterSkill,
          resourceCosts: parseSkillCosts(counterSkill),
        };
        const ringId = String(counterSkill?.ringId || counterSkill?.魂环ID || '').trim();
        if (ringId) declaration.ringId = ringId;
        if (counterSkill?.historySnapshot !== undefined) {
          declaration.historySnapshot = cloneValue(worldSnapshot?.回合开始快照 || worldSnapshot);
        }
        candidates.push({
          candidateId: id,
          declaration,
          skill: counterSkill,
          costs: parseSkillCosts(counterSkill),
          creation,
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
      const renewableCreation = !!String(item?.来源 || '').trim() && Array.isArray(item?.使用效果);
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
      isHardControlStateName(state?.状态 || state?.状态名称) ||
      state?.cannot_act === true || state?.skip_turn === true || state?.战斗效果?.cannot_act === true || state?.战斗效果?.skip_turn === true
    );
    actionCancellationCache.set(unit, result);
    return result;
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
      const reactionPenalty = clamp(Number(effects?.reaction_penalty || 0), 0, 0.9);
      const castPenalty = clamp(Number(effects?.cast_speed_penalty || 0), 0, 0.9);
      multiplier *= 1 - Math.max(
        reactionPenalty * 0.55,
        castPenalty * 0.35,
        /迟缓|僵直/.test(name) ? 0.1 : 0,
      );
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
    collectSkills(unit).filter(skill => costAffordable(unit, skill)).forEach(skill => {
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

  function teamCapacity(worldSnapshot, side, perspectiveSide, beliefState = {}, options = {}) {
    const entries = aliveEntries(worldSnapshot);
    const sideEntries = entries.filter(entry => entry.side === side);
    const opposingEntries = entries.filter(entry => entry.side !== side);
    return sideEntries.reduce((sum, entry) => {
      const unit = entry.unit;
      const allied = side === perspectiveSide;
      const beliefUnit = beliefState?.units?.[preview.unitId(unit)] || {};
      const actionUnavailable = hasActionCancellation(unit);
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
        (preview.readHp(unit) + effectiveShieldValue(unit) - pendingHpLossBeforeNextAction(unit)) / preview.readHpMax(unit),
        0,
        1,
      );
      const responseMargin = effectiveHpRatio - incomingThreatPercent / 100;
      const survivesNextResponse = clamp(1 / (1 + Math.exp(-32 * responseMargin)), 0.02, 0.98);
      const survivalProbability = clamp(0.35 * effectiveHpRatio + 0.65 * survivesNextResponse, 0, 1);
      return sum + preview.calculateUnitCapacity({
        unit,
        survivalProbability,
        actionAvailability: actionUnavailable && !restoreActionAvailability ? 0 : actionQualityMultiplier(unit, { ignoreActionCancellation: restoreActionAvailability }),
        bestLegalBaseActionValue: allied ? bestBaseActionValue(worldSnapshot, unit, { ignoreActionCancellation: restoreActionAvailability }) : perceivedEnemyBaseValue(beliefUnit),
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
    const directThreat = preview.calculateBaseActionValue(source, target, { actionKind, skill });
    const stateThreat = (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).reduce((sum, effect) => {
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
    return clamp(100 * preservedCapacity / Math.max(1, before.total) + terminalPressure + objectiveProtection, 0, 120);
  }

  function isSurvivalIntent(context = {}) {
    return /求生|撤退|脱离|逃生/.test(battleIntentMode(context));
  }

  function estimateSummonActionValue(event = {}, context = {}, worldSnapshot = context.worldSnapshot) {
    const actor = preview.findUnit(worldSnapshot, context.actorId);
    if (!actor || !preview.isAlive(actor)) return 0;
    const mode = String(event?.actionMode || '').trim();
    if (mode === '护卫') return 0;
    const targets = aliveEntries(worldSnapshot)
      .filter(entry => entry.side !== sideOf(worldSnapshot, actor))
      .map(entry => entry.unit);
    if (!targets.length) return 0;
    const strength = Math.max(0.05, Number(event?.strength || 0.35));
    const inheritRatio = clamp(Number(event?.inheritRatio || 0), 0, 2);
    const attributeScale = clamp(inheritRatio > 0 ? inheritRatio : strength, 0.05, 2);
    const summon = {
      ...actor,
      str: Math.max(1, Math.round(preview.readCombatStat(actor, 'str') * attributeScale)),
      def: Math.max(1, Math.round(preview.readCombatStat(actor, 'def') * attributeScale)),
      agi: Math.max(1, Math.round(preview.readCombatStat(actor, 'agi') * attributeScale)),
      sp: Math.max(1, Math.round(preview.readResourceMax(actor, '魂力') * attributeScale)),
      sp_max: Math.max(1, Math.round(preview.readResourceMax(actor, '魂力') * attributeScale)),
    };
    const summonSkill = {
      id: `preview-summon:${event?.summonName || 'summon'}`,
      _效果数组: [{
        原型: '伤害结算',
        目标: '单体',
        威力倍率: Math.max(25, Math.round(50 * attributeScale)),
        伤害类型: '近身攻击',
      }],
    };
    const bestTargetValue = Math.max(...targets.map(target => preview.calculateBaseActionValue(
      summon,
      target,
      { actionKind: 'RELEASE_SKILL', skill: summonSkill },
    )), 0);
    const windows = mode === '协同攻击' ? 1 : Math.max(1, Number(event?.duration || 1));
    const count = Math.max(1, Number(event?.count || 1));
    return bestTargetValue * windows * count * 0.85;
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
    const ownSide = actorIsPlayer ? 'PLAYER' : 'ENEMY';
    return { objectives, actorIsPlayer, ownSide, successConditions, failureConditions };
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
    const focus = [...enemies].sort((left, right) => {
      const leftBelief = beliefState?.units?.[preview.unitId(left)] || {};
      const rightBelief = beliefState?.units?.[preview.unitId(right)] || {};
      const remainingCapacity = (unit, beliefUnit) => {
        const pendingDamage = stateEntries(unit).reduce((sum, state) => {
          const name = String(state?.状态 || state?.状态名称 || '').trim();
          const type = String(state?.类型 || state?.正负面 || '').trim();
          if (!/中毒|流血|灼烧|持续伤害|DOT/i.test(`${name} ${type}`)) return sum;
          return sum + Math.max(1, Number(state?.duration ?? state?.持续回合 ?? 1)) * 4;
        }, 0);
        const hpCapacity = Number(beliefUnit.hpRatio ?? preview.readHp(unit) / preview.readHpMax(unit)) * perceivedEnemyBaseValue(beliefUnit);
        const actionFit = bestBaseActionValueAgainst(worldSnapshot, actor, unit);
        return hpCapacity - pendingDamage + (actionFit > 0 ? 0 : 1000);
      };
      const leftRemaining = remainingCapacity(left, leftBelief);
      const rightRemaining = remainingCapacity(right, rightBelief);
      return leftRemaining - rightRemaining || preview.unitId(left).localeCompare(preview.unitId(right));
    })[0];
    const recentEvents = (Array.isArray(worldSnapshot?.__battleEventLedger) ? worldSnapshot.__battleEventLedger : []).filter(event => {
      const round = Number(event?.round || 0);
      return round >= Math.max(0, Number(worldSnapshot?.回合 || 0) - 1);
    });
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
      ? [...enemies]
          .filter(unit => !hasActionCancellation(unit))
          .sort((left, right) =>
            bestBaseActionValueAgainst(worldSnapshot, right, protect) - bestBaseActionValueAgainst(worldSnapshot, left, protect) ||
            preview.unitId(left).localeCompare(preview.unitId(right))
          )[0]
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
    return { ...worldSnapshot, 参战者: nextParticipants };
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
    const thresholdConditions = objectiveContext.successConditions.filter(condition => condition.type === 'HP_RATIO_AT_OR_BELOW');
    const conditionProgress = (snapshot, condition) => {
      const targetIds = new Set((condition.targetIds || []).map(String));
      const targets = aliveEntries(snapshot).filter(entry => {
        const side = /player|玩家|我方|己方|友方/i.test(String(entry.side || '')) ? 'PLAYER' : 'ENEMY';
        return (!condition.side || side === condition.side) &&
          (!targetIds.size || targetIds.has(preview.unitId(entry.unit)) || targetIds.has(preview.unitName(entry.unit)));
      });
      if (!targets.length) return 0;
      const values = targets.map(entry => clamp((1 - preview.readHp(entry.unit) / preview.readHpMax(entry.unit)) / Math.max(0.01, 1 - condition.threshold), 0, 1));
      return condition.scope === 'ALL' ? Math.min(...values) : Math.max(...values);
    };
    const elapsedRounds = Math.max(0, Number(afterSnapshot?.回合 || 0) - objectiveContext.objectives.startRound);
    const remainingActionsIncludingCurrent = Math.max(1, objectiveContext.objectives.maxRounds - elapsedRounds + 1);
    const urgency = clamp(objectiveContext.objectives.maxRounds / remainingActionsIncludingCurrent, 1, 2);
    const thresholdProfile = thresholdConditions.reduce((best, condition) => {
      const beforeProgress = conditionProgress(beforeSnapshot, condition);
      const afterProgress = conditionProgress(afterSnapshot, condition);
      const progressGain = Math.max(0, afterProgress - beforeProgress);
      const requiredProgress = Math.max(0, 1 - beforeProgress) / remainingActionsIncludingCurrent;
      const deadlineShortfall = Math.max(0, requiredProgress - progressGain);
      const utility = 100 * (progressGain - deadlineShortfall) * urgency;
      return !best || utility > best.utility
        ? { utility, deadlineActive: true, progressGain, requiredProgress, deadlineFeasible: progressGain + 1e-9 >= requiredProgress }
        : best;
    }, null);
    const survivalConditions = [
      ...objectiveContext.failureConditions.filter(condition => condition.type === 'UNIT_INCAPACITATED'),
      ...objectiveContext.successConditions.filter(condition => condition.type === 'ROUND_REACHED'),
    ].filter(condition => condition.side === objectiveContext.ownSide);
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
    if (!thresholdProfile) {
      return { utility: Math.min(100, survivalUtility), deadlineActive: false, progressGain: 0, requiredProgress: 0, deadlineFeasible: true };
    }
    return {
      ...thresholdProfile,
      utility: clamp(
        survivalRiskReduction > 1e-9 ? Math.max(thresholdProfile.utility, survivalUtility) : thresholdProfile.utility,
        -100,
        100,
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
      const paidUtility = stateUtility(paidSnapshot, actorSide, context.beliefState);
      expectedStateGain = 100 * (paidUtility.utility - before.utility) / Math.max(1, before.total);
      const futureUseEffects = (candidate.creation.useEffects || []).map(effect => ({
        ...cloneValue(effect),
        目标: String(effect?.目标 || '').trim() === '自身' ? '单体' : effect?.目标,
      }));
      const futureUseGain = (candidate.creation.consumerIds || []).reduce((bestGain, targetId) => {
        const futureUse = preview.previewAction({
          worldSnapshot: paidSnapshot,
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
    const objectivePace = terminalUtility === 0
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
    const summonEvents = (result?.scheduledEvents || []).filter(event => event.type === 'SUMMON_CREATE');
    summonEvents.forEach(event => {
      const summonValue = estimateSummonActionValue(event, context, result.afterSnapshot);
      expectedStateGain += 100 * summonValue / Math.max(1, before.total);
    });
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

  function decide(input = {}) {
    const worldSnapshot = input.worldSnapshot;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_decision_world_missing');
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
    decisionRevisionSequence += 1;
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
        selected: candidate.candidateId === selected.candidateId,
      }))),
      decisionProfile: Object.freeze({ confidence: choice.confidence, temperature: choice.temperature, maxNormalizedRegret: choice.maxNormalizedRegret }),
    });
  }

  root.__LWCS_BATTLE_DECISION__ = Object.freeze({
    version: VERSION,
    actionKinds,
    collectSkills,
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
    unknownResponseMass,
    buildTeamIntent,
    identifyProblems,
    activeStrategyMemory,
    collectInventory,
    creationProfile,
    strategicSignature,
    detectStalemate,
    stateUtility,
    dominates,
    paretoFilter,
    normalizeUtilities,
    classifyCandidateEvidence,
    decide,
  });
})();

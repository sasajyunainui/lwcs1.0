/* BattleDecision_Module.js - Battle decisions over immutable previews. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const preview = root.__LWCS_BATTLE_PREVIEW__;
  if (!preview || typeof preview.previewAction !== 'function') throw new Error('battle_decision_preview_runtime_missing');
  if (preview.version !== '7.3-R6.3-preview-2') throw new Error(`battle_decision_preview_version_mismatch:${preview.version || 'missing'}`);

  const VERSION = '7.3-R6.3-decision-2';
  const skillLibraryCache = new WeakMap();
  const effectFingerprintCache = new WeakMap();
  const baseActionValueCache = new WeakMap();
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
    const explicit = Number(unit?.战斗经验 ?? unit?.battleExperience ?? unit?.经验稳定度);
    if (Number.isFinite(explicit)) return clamp(explicit > 1 ? explicit / 100 : explicit, 0, 1);
    const identity = preview.unitId(unit) || preview.unitName(unit);
    const stableOffset = stableRoll(`experience:${identity}`) * 0.12 - 0.06;
    return clamp(0.25 + unitLevel(unit) / 120 * 0.7 + stableOffset, 0.2, 0.96);
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
    const actorSide = preview.sideOf(worldSnapshot, actor);
    const experience = experienceOf(actor);
    const strengthHalfWidth = Math.ceil(2 + 8 * (1 - experience));
    const existingUnits = existing?.units && typeof existing.units === 'object' ? existing.units : {};
    const units = Object.fromEntries(preview.listUnits(worldSnapshot).map(entry => {
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
        visibleStates: visibleStates(unit),
        resources: allied ? {
          soul: ratio(unit, 'sp'),
          spirit: ratio(unit, 'men'),
          stamina: ratio(unit, 'vit'),
        } : prior.resources,
      }];
    }));
    return {
      ...existing,
      revision: String(existing?.revision || preview.stableHash({ actorId, units })),
      confidence: clamp(existing?.confidence ?? experience, 0, 1),
      units,
      mechanics: existing?.mechanics && typeof existing.mechanics === 'object' ? existing.mechanics : {},
      publicResponses: existing?.publicResponses && typeof existing.publicResponses === 'object' ? existing.publicResponses : {},
    };
  }

  function buildDecisionWorld(worldSnapshot = {}, actorId = '', beliefState = {}) {
    const sourceActor = preview.findUnit(worldSnapshot, actorId);
    if (!sourceActor) throw new Error('battle_decision_projection_actor_missing');
    const actorSide = preview.sideOf(worldSnapshot, sourceActor);
    const projectUnit = sourceUnit => {
      const unit = cloneValue(sourceUnit);
      if (preview.sideOf(worldSnapshot, sourceUnit) === actorSide) return unit;
      unit.技能列表 = [];
      Object.keys(unit).forEach(key => {
        if (key === '蓄力技能') return;
        if (/^(?:第\d+)?武魂|血脉之力|魂骨|自创魂技|技能/.test(key)) delete unit[key];
      });
      const beliefResources = beliefState?.units?.[preview.unitId(unit)]?.resources || {};
      const resources = [
        { ratio: beliefResources.soul, current: 'sp', currentCn: '魂力', maximum: 'sp_max', maximumCn: '魂力上限' },
        { ratio: beliefResources.spirit, current: 'men', currentCn: '精神力', maximum: 'men_max', maximumCn: '精神力上限' },
        { ratio: beliefResources.stamina, current: 'vit', currentCn: '体力', maximum: 'vit_max', maximumCn: '体力上限' },
      ];
      resources.forEach(resource => {
        const maximum = Math.max(1, Number(unit?.[resource.maximum] ?? unit?.属性?.[resource.maximumCn] ?? 1));
        const estimatedRatio = clamp(resource.ratio ?? 0.5, 0, 1);
        const estimated = maximum * estimatedRatio;
        unit[resource.current] = estimated;
        unit[resource.currentCn] = estimated;
        if (unit?.属性 && typeof unit.属性 === 'object') unit.属性[resource.currentCn] = estimated;
      });
      return unit;
    };
    const participants = worldSnapshot?.参战者 || {};
    const projectedParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
      if (Array.isArray(value)) return [side, value.map(projectUnit)];
      if (value && typeof value === 'object') {
        return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, projectUnit(unit)]))];
      }
      return [side, value];
    }));
    return { ...worldSnapshot, 参战者: projectedParticipants };
  }

  function relevantStateFingerprint(beliefState = {}, targetId = '') {
    const states = beliefState?.units?.[targetId]?.visibleStates || [];
    return preview.stableHash(states.map(state => [state.name, state.duration, state.type]));
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
    const learningRate = existing ? 0.01 : 0.04;
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
    const actorSide = preview.sideOf(context.worldSnapshot, actor);
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
    const roots = [
      ...(Array.isArray(unit?.技能列表) && unit.技能列表.length ? [unit.技能列表] : []),
      ...Object.entries(unit).filter(([key, value]) => /^(?:第\d+)?武魂|血脉之力|魂骨|装备|自创魂技|技能/.test(key) && value && typeof value === 'object').map(([, value]) => value),
    ];
    const cacheKey = roots.length === 1 ? roots[0] : unit;
    const cached = skillLibraryCache.get(cacheKey);
    if (cached) return cached;
    const output = [];
    const seenObjects = new Set();
    const seenSkills = new Set();
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
        const key = `${skillId(value, output.length)}|${effectFingerprint}`;
        if (!seenSkills.has(key)) {
          seenSkills.add(key);
          output.push(value);
        }
        return;
      }
      Object.entries(value).forEach(([key, child]) => {
        if (/状态效果|战斗历史|历史快照|参战者|复制效果/.test(key)) return;
        visit(child);
      });
    };
    if (Array.isArray(unit?.技能列表)) unit.技能列表.forEach(visit);
    Object.entries(unit).forEach(([key, value]) => {
      if (/^(?:第\d+)?武魂|血脉之力|魂骨|装备|自创魂技|技能/.test(key)) visit(value, key);
    });
    const result = Object.freeze(output);
    skillLibraryCache.set(cacheKey, result);
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
    const actorSide = preview.sideOf(worldSnapshot, actor);
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
      alive: preview.listUnits(worldSnapshot).filter(entry => preview.isAlive(entry.unit)).map(entry => preview.unitId(entry.unit)).sort(),
      units: preview.listUnits(worldSnapshot).map(entry => ({
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
    return costs;
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
    const next = cloneValue(worldSnapshot);
    const actor = preview.findUnit(next, actorId);
    if (!actor) return next;
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
    return next;
  }

  function targetProfile(skill = {}) {
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    const targets = effects.map(effect => String(effect?.目标 || '').trim()).filter(Boolean);
    if (!targets.length || targets.every(target => target === '自身')) return 'SELF';
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
    if (targets.some(target => /全场|群体/.test(target))) return hostile || !friendly ? 'HOSTILE_GROUP' : 'FRIENDLY_GROUP';
    if (targets.some(target => /友方/.test(target))) return 'FRIENDLY_SINGLE';
    if (hostile) return 'HOSTILE_SINGLE';
    return friendly ? 'FRIENDLY_SINGLE' : 'HOSTILE_SINGLE';
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

  function aliveEntries(worldSnapshot = {}) {
    return preview.listUnits(worldSnapshot).filter(entry => preview.isAlive(entry.unit));
  }

  function enumerateTargetSets(worldSnapshot, actor, profile, beliefState = {}) {
    const actorSide = preview.sideOf(worldSnapshot, actor);
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
    const immediateBudget = Math.max(0, Number(input.actionOpportunity?.immediateBudget ?? 10));
    const hostile = aliveEntries(worldSnapshot).filter(entry => entry.side !== preview.sideOf(worldSnapshot, actor)).map(entry => entry.unit);
    const counterSourceId = String(input.actionOpportunity?.sourceActorId || '').trim();
    const directHostile = counterOnly && counterSourceId
      ? hostile.filter(target => preview.unitId(target) === counterSourceId)
      : hostile;
    const candidates = reactionOnly ? [] : directHostile.map(target => {
      const targetId = preview.unitId(target);
      return { candidateId: `${actorId}:basic:${targetId}`, declaration: { actionId: `${actorId}:basic:${targetId}`, actorId, actionKind: 'BASIC_ATTACK', targetIds: [targetId] } };
    });
    if (counterOnly) candidates.push({
      candidateId: `${actorId}:COUNTER_DECLINE`,
      declaration: defensiveDeclaration(actorId, 'DEFEND'),
      counterDeclineFallback: true,
    });
    if (!counterOnly) ['DEFEND', 'EVADE'].forEach(actionKind => candidates.push({ candidateId: `${actorId}:${actionKind}`, declaration: defensiveDeclaration(actorId, actionKind) }));
    if (!counterOnly && input.actionOpportunity?.counterWindow === true && input.actionOpportunity?.counterActionAvailable === true) {
      candidates.push({ candidateId: `${actorId}:COUNTER`, declaration: defensiveDeclaration(actorId, 'COUNTER') });
    }
    const allies = aliveEntries(worldSnapshot).filter(entry => entry.side === preview.sideOf(worldSnapshot, actor) && preview.unitId(entry.unit) !== actorId);
    if (!reactionOnly && !counterOnly && allies.length && input.actionOpportunity?.interceptThreat === true) {
      allies.forEach(entry => candidates.push({ candidateId: `${actorId}:GUARD:${preview.unitId(entry.unit)}`, declaration: { actionId: `${actorId}:GUARD:${preview.unitId(entry.unit)}`, actorId, actionKind: 'GUARD', targetIds: [preview.unitId(entry.unit)] } }));
    }
    if (!reactionOnly && !counterOnly && input.beliefState?.observationGranted === true && Number(input.beliefState?.confidence || 0) < 1) {
      candidates.push({ candidateId: `${actorId}:OBSERVE`, declaration: defensiveDeclaration(actorId, 'OBSERVE') });
    }
    if (!reactionOnly && !counterOnly && (input.battleIntent?.withdrawAllowed === true || /求生|撤退|脱离/.test(battleIntentMode(input)))) {
      candidates.push({ candidateId: `${actorId}:WITHDRAW`, declaration: defensiveDeclaration(actorId, 'WITHDRAW') });
    }
    collectSkills(actor).forEach((skill, index) => {
      if (!costAffordable(actor, skill)) return;
      if (counterOnly && !isExplicitCounterSkill(skill, immediateBudget)) return;
      if (!counterOnly && input.actionOpportunity?.enforceImmediateBudget === true && !isImmediateReactionSkill(skill, immediateBudget)) return;
      if (reactionOnly && !isImmediateReactionSkill(skill, immediateBudget)) return;
      const profile = targetProfile(skill);
      if (counterOnly && !['HOSTILE_SINGLE', 'HOSTILE_GROUP', 'ANY_SINGLE'].includes(profile)) return;
      const counterSkill = counterOnly
        ? { ...skill, 消耗: '无', 魂力消耗: 0, 精神力消耗: 0, 体力消耗: 0, 前摇: 0, cast_time: 0 }
        : skill;
      const creation = creationProfile(counterSkill, actor, worldSnapshot);
      const reactionSourceId = String(input.actionOpportunity?.sourceActorId || '').trim();
      const targetSets = (reactionOnly || counterOnly) && reactionSourceId && ['HOSTILE_SINGLE', 'ANY_SINGLE'].includes(profile)
        ? [[reactionSourceId]]
        : enumerateTargetSets(worldSnapshot, actor, profile, input.beliefState);
      targetSets.forEach((targetIds, targetIndex) => {
        const id = `${actorId}:skill:${skillId(skill, index)}:${targetIndex}`;
        candidates.push({
          candidateId: id,
          declaration: { actionId: id, actorId, actionKind: 'RELEASE_SKILL', targetIds, skill: counterSkill, resourceCosts: parseSkillCosts(counterSkill) },
          skill: counterSkill,
          costs: parseSkillCosts(counterSkill),
          creation,
        });
      });
    });
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

  function hasActionCancellation(unit = {}) {
    return Object.values(unit?.状态效果 || {}).some(state => /眩晕/.test(String(state?.状态 || state?.状态名称 || '')) || state?.战斗效果?.cannot_act === true || state?.战斗效果?.skip_turn === true);
  }

  function stateEntries(unit = {}) {
    const states = unit?.状态效果;
    if (Array.isArray(states)) return states.filter(Boolean);
    return states && typeof states === 'object' ? Object.values(states).filter(Boolean) : [];
  }

  function hasStateFlag(unit = {}, flag = '') {
    return stateEntries(unit).some(state => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      const effects = state?.战斗效果 || {};
      return effects?.[flag] === true || (flag === 'silence' && /沉默|封技/.test(name)) || (flag === 'disarm' && /缴械/.test(name));
    });
  }

  function actionQualityMultiplier(unit = {}) {
    if (hasActionCancellation(unit)) return 0;
    let multiplier = 1;
    stateEntries(unit).forEach(state => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      const effects = state?.战斗效果 || {};
      const reactionPenalty = clamp(Number(effects?.reaction_penalty || 0), 0, 0.9);
      const dodgePenalty = clamp(Number(effects?.dodge_penalty || 0), 0, 0.9);
      const castPenalty = clamp(Number(effects?.cast_speed_penalty || 0), 0, 0.9);
      const lockPenalty = clamp(Number(effects?.lock_level || 0), 0, 0.9);
      multiplier *= 1 - Math.max(
        reactionPenalty * 0.55,
        dodgePenalty * 0.45,
        castPenalty * 0.35,
        lockPenalty * 0.4,
        /迟缓|位移限制|僵直/.test(name) ? 0.1 : 0,
      );
    });
    return clamp(multiplier, 0.1, 1);
  }

  function effectiveShieldValue(unit = {}) {
    const stateShield = stateEntries(unit).reduce((maximum, state) => {
      const name = String(state?.状态 || state?.状态名称 || '').trim();
      if (!/护盾/.test(name) || /破盾|护盾削减/.test(name)) return maximum;
      const raw = String(state?.数值 ?? state?.强度 ?? '').trim();
      const numeric = Math.abs(Number.parseFloat(raw));
      if (!Number.isFinite(numeric) || numeric <= 0) return maximum;
      const ratio = raw.includes('%') ? numeric / 100 : numeric <= 1 ? numeric : 0;
      return Math.max(maximum, preview.readHpMax(unit) * ratio);
    }, 0);
    return Math.max(preview.readShield(unit), stateShield);
  }

  function bestBaseActionValue(worldSnapshot, unit) {
    if (!preview.isAlive(unit) || hasActionCancellation(unit)) return 0;
    const side = preview.sideOf(worldSnapshot, unit);
    const enemies = preview.listUnits(worldSnapshot).filter(entry => entry.side !== side).map(entry => entry.unit);
    if (!enemies.length) return 100;
    let best = hasStateFlag(unit, 'disarm') ? 0 : Math.max(...enemies.map(target => cachedBaseActionValue(unit, target, 'BASIC_ATTACK')), 0);
    const allies = aliveEntries(worldSnapshot).filter(entry => entry.side === side).map(entry => entry.unit);
    if (hasStateFlag(unit, 'silence')) return best;
    collectSkills(unit).filter(skill => costAffordable(unit, skill)).forEach(skill => {
      const profile = targetProfile(skill);
      const targets = profile === 'SELF' ? [unit] : profile.startsWith('FRIENDLY') ? allies : profile === 'ANY_SINGLE' ? [...allies, ...enemies] : enemies;
      const values = targets.map(target => cachedBaseActionValue(unit, target, 'RELEASE_SKILL', skill));
      const actionValue = profile.endsWith('GROUP') ? values.reduce((sum, value) => sum + value, 0) : Math.max(0, ...values);
      best = Math.max(best, actionValue);
    });
    return best;
  }

  function bestBaseActionValueAgainst(worldSnapshot, unit, target) {
    if (!preview.isAlive(unit) || !preview.isAlive(target) || hasActionCancellation(unit)) return 0;
    let best = hasStateFlag(unit, 'disarm')
      ? 0
      : cachedBaseActionValue(unit, target, 'BASIC_ATTACK');
    if (hasStateFlag(unit, 'silence')) return Math.max(0, best);
    collectSkills(unit).filter(skill => costAffordable(unit, skill)).forEach(skill => {
      const profile = targetProfile(skill);
      if (!profile.startsWith('HOSTILE') && profile !== 'ANY_SINGLE') return;
      best = Math.max(best, cachedBaseActionValue(unit, target, 'RELEASE_SKILL', skill));
    });
    return Math.max(0, best);
  }

  function perceivedEnemyBaseValue(beliefUnit = {}, target = null) {
    const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
    const upper = Math.max(1, Number(range[1] || range[0] || 1));
    const targetLevel = target ? unitLevel(target) : upper;
    const relativeThreat = 10 * Math.pow(upper / Math.max(1, targetLevel), 2);
    const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
    return Math.max(8, Math.min(100, relativeThreat), ...knownResponses.map(response => Math.max(0, Number(response?.baseActionValue || 0))));
  }

  function teamCapacity(worldSnapshot, side, perspectiveSide, beliefState = {}) {
    const entries = aliveEntries(worldSnapshot);
    const sideEntries = entries.filter(entry => entry.side === side);
    const opposingEntries = entries.filter(entry => entry.side !== side);
    return sideEntries.reduce((sum, entry) => {
      const unit = entry.unit;
      const allied = side === perspectiveSide;
      const beliefUnit = beliefState?.units?.[preview.unitId(unit)] || {};
      const actionUnavailable = hasActionCancellation(unit);
      const incomingThreatPercent = opposingEntries.reduce((threat, opposingEntry) => {
        const opposingUnit = opposingEntry.unit;
        const opposingBelief = beliefState?.units?.[preview.unitId(opposingUnit)] || {};
        const baseThreat = allied
          ? perceivedEnemyBaseValue(opposingBelief, unit)
          : bestBaseActionValueAgainst(worldSnapshot, opposingUnit, unit);
        return Math.max(threat, baseThreat * actionQualityMultiplier(opposingUnit));
      }, 0);
      const effectiveHpRatio = clamp((preview.readHp(unit) + effectiveShieldValue(unit)) / preview.readHpMax(unit), 0, 1);
      const responseMargin = effectiveHpRatio - incomingThreatPercent / 100;
      const survivesNextResponse = clamp(1 / (1 + Math.exp(-32 * responseMargin)), 0.02, 0.98);
      const survivalProbability = clamp(0.35 * effectiveHpRatio + 0.65 * survivesNextResponse, 0, 1);
      return sum + preview.calculateUnitCapacity({
        unit,
        survivalProbability,
        actionAvailability: actionUnavailable ? 0 : actionQualityMultiplier(unit),
        bestLegalBaseActionValue: allied ? bestBaseActionValue(worldSnapshot, unit) : perceivedEnemyBaseValue(beliefUnit),
      });
    }, 0);
  }

  function stateUtility(worldSnapshot, actorSide, beliefState = {}) {
    const sides = [...new Set(preview.listUnits(worldSnapshot).map(entry => entry.side))];
    const own = teamCapacity(worldSnapshot, actorSide, actorSide, beliefState);
    const enemy = sides.filter(side => side !== actorSide).reduce((sum, side) => sum + teamCapacity(worldSnapshot, side, actorSide, beliefState), 0);
    return { own, enemy, total: own + enemy, utility: own - enemy };
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
      const mechanics = effect?.计算层效果 && typeof effect.计算层效果 === 'object' ? effect.计算层效果 : {};
      const cancelsAction = Object.entries(mechanics).some(([key, value]) => value === true && /skip|stun|freeze|sleep|silence|seal|disarm|disable|forbid/i.test(key));
      const changesActionQuality = Object.entries(mechanics).some(([key, value]) =>
        value !== false && Number(value || 0) !== 0 && /hit|dodge|speed|agi|cast|damage|def|resist|lock|limit/i.test(key),
      );
      const capacityThreat = cancelsAction ? 32 : changesActionQuality ? 18 : 10;
      return sum + capacityThreat * Math.min(2, duration) * probability;
    }, 0);
    return Math.max(directThreat, Math.min(100, stateThreat));
  }

  function estimateIncomingThreat(context = {}) {
    const worldSnapshot = context.worldSnapshot || {};
    const actor = preview.findUnit(worldSnapshot, context.actorId);
    if (!actor) return { value: 0, explicit: false, sourceId: '', arrivesBeforeNextOpportunity: false };
    const actorSide = preview.sideOf(worldSnapshot, actor);
    const allyCount = Math.max(1, aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide).length);
    const actorName = preview.unitName(actor);
    const currentRound = Math.max(0, Number(worldSnapshot?.回合 || 0));
    const recentTargetCount = (Array.isArray(worldSnapshot?.__battleEventLedger) ? worldSnapshot.__battleEventLedger : []).filter(event => {
      const round = Number(event?.round || 0);
      if (round < Math.max(0, currentRound - 1) || round > currentRound) return false;
      if (!['action_start', 'hit_result', 'state_apply'].includes(String(event?.eventKind || '').trim())) return false;
      if (String(event?.targetName || '').trim() !== actorName) return false;
      const sourceSide = String(event?.actorSide || '').trim();
      return !sourceSide || sourceSide !== actorSide;
    }).length;
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
      const hpRatio = preview.readHp(actor) / preview.readHpMax(actor);
      const targetProbability = allyCount === 1
        ? 1
        : recentTargetCount > 0
          ? Math.min(1, 0.45 + recentTargetCount * 0.2)
          : Math.min(1, (hpRatio <= 0.3 ? 0.6 : 0.25) / allyCount);
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
    if (actionKind === 'WITHDRAW' && context.battleIntent?.withdrawAllowed !== true && !/求生|撤退|脱离/.test(battleIntentMode(context))) return 0;

    const side = preview.sideOf(context.worldSnapshot || {}, actor);
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
    return clamp(100 * preservedCapacity / Math.max(1, before.total) + terminalPressure, 0, 120);
  }

  function isSurvivalIntent(context = {}) {
    return /求生|撤退|脱离|逃生/.test(battleIntentMode(context));
  }

  function estimateSummonActionValue(event = {}, context = {}) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    if (!actor || !preview.isAlive(actor)) return 0;
    const mode = String(event?.actionMode || '').trim();
    if (mode === '护卫') return 0;
    const targets = aliveEntries(context.worldSnapshot)
      .filter(entry => entry.side !== preview.sideOf(context.worldSnapshot, actor))
      .map(entry => entry.unit);
    if (!targets.length) return 0;
    const strength = Math.max(0.01, Number(event?.strength || 1));
    const inheritRatio = clamp(Number(event?.inheritRatio || 0), 0, 1);
    const attributeScale = inheritRatio > 0 ? inheritRatio : clamp(0.35 + strength * 0.18, 0.12, 1.4);
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
      _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 135, 伤害类型: '远程攻击' }],
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
    const next = cloneValue(snapshot);
    preview.listUnits(next).forEach(({ unit }) => {
      if (!unit?.状态效果 || Array.isArray(unit.状态效果) || typeof unit.状态效果 !== 'object') return;
      Object.entries(unit.状态效果).forEach(([key, state]) => {
        const name = String(state?.状态 || state?.状态名称 || state?.名称 || '').trim();
        if (key.startsWith('preview:') && names.has(name)) delete unit.状态效果[key];
      });
    });
    return next;
  }

  function buildTeamIntent(worldSnapshot, actorId, beliefState = {}) {
    const actor = preview.findUnit(worldSnapshot, actorId);
    const actorSide = preview.sideOf(worldSnapshot, actor);
    const entries = aliveEntries(worldSnapshot);
    const enemies = entries.filter(entry => entry.side !== actorSide).map(entry => entry.unit);
    const allies = entries.filter(entry => entry.side === actorSide).map(entry => entry.unit);
    const focus = [...enemies].sort((left, right) => {
      const leftBelief = beliefState?.units?.[preview.unitId(left)] || {};
      const rightBelief = beliefState?.units?.[preview.unitId(right)] || {};
      const leftRemaining = Number(leftBelief.hpRatio ?? preview.readHp(left) / preview.readHpMax(left)) * perceivedEnemyBaseValue(leftBelief);
      const rightRemaining = Number(rightBelief.hpRatio ?? preview.readHp(right) / preview.readHpMax(right)) * perceivedEnemyBaseValue(rightBelief);
      return leftRemaining - rightRemaining || preview.unitId(left).localeCompare(preview.unitId(right));
    })[0];
    const protect = [...allies].sort((left, right) => preview.readHp(left) / preview.readHpMax(left) - preview.readHp(right) / preview.readHpMax(right) || preview.unitId(left).localeCompare(preview.unitId(right)))[0];
    return {
      focusTarget: focus ? preview.unitId(focus) : '',
      protectTarget: protect && preview.readHp(protect) < preview.readHpMax(protect) * 0.5 ? preview.unitId(protect) : '',
      exploitableWindow: '',
      evidenceEventIds: [],
    };
  }

  function identifyProblems(worldSnapshot, actorId, beliefState = {}) {
    const actor = preview.findUnit(worldSnapshot, actorId);
    const actorSide = preview.sideOf(worldSnapshot, actor);
    const problems = [];
    const hpRatio = preview.readHp(actor) / preview.readHpMax(actor);
    if (hpRatio <= 0.3) problems.push({ problemId: 'SURVIVAL_CRISIS', severity: (0.3 - hpRatio) * 100 + 20 });
    const criticalAlly = aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide && preview.unitId(entry.unit) !== actorId).find(entry => preview.readHp(entry.unit) / preview.readHpMax(entry.unit) <= 0.3);
    if (criticalAlly) problems.push({ problemId: 'ALLY_CRISIS', targetIds: [preview.unitId(criticalAlly.unit)], severity: 30 - preview.readHp(criticalAlly.unit) / preview.readHpMax(criticalAlly.unit) * 30 });
    aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide && entry.unit?.蓄力技能).forEach(entry => {
      const charge = entry.unit.蓄力技能;
      const threat = visibleActionThreat(entry.unit, actor, charge);
      problems.push({
        problemId: 'IMMINENT_DENIAL',
        targetIds: [preview.unitId(entry.unit)],
        severity: clamp(20 + threat / 2, 20, 100),
        evidence: { actionName: skillName(charge), castTime: Number(charge?.cast_time || charge?.前摇 || 0), threat },
      });
    });
    const terminalEnemy = aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide).find(entry => Number(beliefState?.units?.[preview.unitId(entry.unit)]?.hpRatio ?? 1) <= 0.2);
    if (terminalEnemy) problems.push({ problemId: 'TERMINAL_OPPORTUNITY', targetIds: [preview.unitId(terminalEnemy.unit)], severity: 20 });
    if (Number(beliefState?.confidence || 0) < 0.45) problems.push({ problemId: 'INFORMATION_DEFICIT', severity: (0.45 - Number(beliefState?.confidence || 0)) * 40 });
    if (!problems.length) problems.push({ problemId: 'NEUTRAL_PROGRESS', severity: 1 });
    return problems.sort((left, right) => right.severity - left.severity);
  }

  function responseBranches(context) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    const actorSide = preview.sideOf(context.worldSnapshot, actor);
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
    const allyCount = Math.max(1, aliveEntries(context.worldSnapshot).filter(entry => entry.side === actorSide).length);
    const before = context.beforeUtility || stateUtility(context.worldSnapshot, actorSide, context.beliefState || {});
    const responseCapacityScale = Math.max(0, Number(before.own || 0)) / Math.max(1, allyCount * Number(before.total || 0));
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
      probability: knownMass * response.weight / totalWeight,
      utility: -Math.max(0, Number(response.baseActionValue ?? response.utility ?? 0)) * responseCapacityScale,
      rawThreat: Math.max(0, Number(response.baseActionValue ?? response.utility ?? 0)),
      lethal: Math.max(0, Number(response.baseActionValue ?? response.utility ?? 0)) >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
      unknown: false,
    }));
    const branches = normalizedKnown.length <= 3 ? normalizedKnown : normalizedKnown.slice(0, 2);
    if (normalizedKnown.length > 3) {
      const remainder = normalizedKnown.slice(2);
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
      const rawThreat = Math.max(0, perceivedEnemyBaseValue(targetBelief, actor));
      branches.unshift({
        responseId: 'UNKNOWN_RESPONSE_ENVELOPE',
        probability: unknownMass,
        utility: -threatEnvelope,
        rawThreat,
        lethal: rawThreat >= preview.readHp(actor) / preview.readHpMax(actor) * 100,
        unknown: true,
      });
    }
    return branches.slice(0, 4);
  }

  function activeStrategyMemory(memory = {}, worldSnapshot = {}, opportunity = {}, candidates = []) {
    if (!memory || typeof memory !== 'object') return {};
    const sequence = Math.max(0, Number(opportunity?.sequence || 0));
    if (Number(memory?.expiresAtOpportunity || 0) < sequence) return {};
    const targets = Array.isArray(memory?.targetIds) ? memory.targetIds.map(String).filter(Boolean) : [];
    if (targets.some(targetId => !preview.isAlive(preview.findUnit(worldSnapshot, targetId) || {}))) return {};
    const stillNonDominated = candidates.some(candidate => !candidate.rejectionCode && (candidate.declaration.targetIds || []).some(targetId => targets.includes(String(targetId))));
    return stillNonDominated ? memory : {};
  }

  function needsDeepPreview(candidate, result, before, after, beliefState = {}) {
    const outcomes = new Set((result?.contributions || []).map(entry => entry.outcomeKind));
    const beforeAlive = preview.listUnits(before).filter(entry => preview.isAlive(entry.unit)).length;
    const afterAlive = preview.listUnits(after).filter(entry => preview.isAlive(entry.unit)).length;
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

  function actorBattleIntent(worldSnapshot = {}, actorSide = '', inputIntent = null) {
    const source = inputIntent && (typeof inputIntent === 'string' || typeof inputIntent === 'object')
      ? inputIntent
      : { mode: String(worldSnapshot?.战斗意图 || '').trim() };
    const mode = typeof source === 'string' ? source.trim() : String(source?.mode || source?.intent || source?.name || '').trim();
    if (!/enemy|敌方/i.test(String(actorSide || '')) || !/求生|撤退|脱离|逃生/.test(mode)) return source;
    return { ...(typeof source === 'object' ? source : {}), mode: '阻止撤离', opposingIntent: mode };
  }

  function intentTerminalUtility(beforeSnapshot, afterSnapshot, actorSide, context = {}) {
    const mode = battleIntentMode(context);
    if (!/点到为止|切磋|训练|非致命/.test(mode)) return 0;
    const beforeHostiles = aliveEntries(beforeSnapshot)
      .filter(entry => entry.side !== actorSide)
      .map(entry => preview.unitId(entry.unit));
    const afterHostiles = beforeHostiles.map(unitId => preview.findUnit(afterSnapshot, unitId));
    const killedHostile = afterHostiles.some(unit => !unit || unit?.状态?.存活 === false || preview.readHp(unit) <= 0);
    if (killedHostile) return -100;
    const allIncapacitated = afterHostiles.length > 0 && afterHostiles.every(unit =>
      preview.readHp(unit) <= 1 || /失去战斗力|昏迷|投降|制服/.test(String(unit?.状态?.行动 || '').trim()),
    );
    return allIncapacitated ? 100 : 0;
  }

  function scoreCandidate(candidate, context) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    const actorSide = preview.sideOf(context.worldSnapshot, actor);
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
    const after = result ? stateUtility(result.afterSnapshot, actorSide, context.beliefState) : before;
    const stateEffects = (candidate.skill?._效果数组 || []).filter(effect => String(effect?.原型 || '').trim() === '状态施加');
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
    const mechanicProbability = mechanicObservations.length
      ? mechanicObservations.reduce((sum, observation) => sum + observation.posterior, 0) / mechanicObservations.length
      : 1;
    const withdrawalEstimate = candidate.declaration.actionKind === 'WITHDRAW'
      ? aliveEntries(context.worldSnapshot)
          .filter(entry => entry.side !== actorSide)
          .map(entry => preview.estimateWithdrawal(actor, entry.unit))
          .sort((left, right) => left.successProbability - right.successProbability)[0] || null
      : null;
    let expectedStateGain = candidate.counterDeclineFallback
      ? 0
      : result
      ? 100 * (after.utility - before.utility) / Math.max(1, before.total)
      : directDefensiveUtility(candidate.declaration.actionKind, context);
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
      expectedStateGain = expectedStateGain * withdrawalEstimate.successProbability -
        100 * withdrawalEstimate.expectedPursuitDamage / Math.max(1, preview.readHpMax(actor));
    }
    if (result && stateEffects.length) {
      const withoutStates = stateUtility(withoutCandidateStateEffects(result.afterSnapshot, stateEffects), actorSide, context.beliefState);
      const stateGain = 100 * (after.utility - withoutStates.utility) / Math.max(1, before.total);
      expectedStateGain -= stateGain * (1 - mechanicProbability);
    }
    const withdrawalTerminalUtility = !result && withdrawalEstimate && isSurvivalIntent(context)
      ? (directDefensiveUtility('WITHDRAW', context) > 0 ? 35 * withdrawalEstimate.successProbability : 0)
      : 0;
    const terminalUtility = result
      ? intentTerminalUtility(context.worldSnapshot, result.afterSnapshot, actorSide, context)
      : withdrawalTerminalUtility;
    const actionCancelled = (result?.contributions || []).some(entry => entry.outcomeKind === 'ACTION_CANCELLED');
    let controlOverlap = false;
    if (actionCancelled) {
      const targetId = candidate.declaration.targetIds?.[0] || '';
      const target = preview.findUnit(context.worldSnapshot, targetId);
      controlOverlap = !!target && hasActionCancellation(target);
    }
    const summonEvents = (result?.scheduledEvents || []).filter(event => event.type === 'SUMMON_CREATE');
    summonEvents.forEach(event => {
      const summonValue = estimateSummonActionValue(event, context);
      expectedStateGain += 100 * summonValue / Math.max(1, before.total);
    });
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
    const branches = deepRequired && terminalUtility === 0 ? context.sharedResponseBranches : [];
    const expectedResponseUtility = branches.reduce((sum, branch) => sum + Number(branch?.probability || 0) * Number(branch?.utility || 0), 0);
    const catastrophicRisk = (result?.contributions || []).filter(entry => entry.outcomeKind === 'TAIL_FAILURE').reduce((sum, entry) => sum + Math.abs(entry.threatValue), 0) +
      branches.filter(branch => branch?.lethal === true).reduce((sum, branch) => sum + Number(branch?.probability || 0) * Math.abs(Number(branch?.utility || 0)), 0);
    const deepTimeline = deepRequired ? [
      { nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId },
      ...branches.map(branch => ({ nodeType: branch.unknown ? 'UNKNOWN_RESPONSE' : 'KNOWN_RESPONSE', ...branch })),
      ...((result?.contributions || []).some(entry => ['ACTION_GRANTED', 'SUMMON_WINDOW', 'STATE_CHANGED', 'STATE_SCHEDULED'].includes(entry.outcomeKind))
        ? [{ nodeType: 'FIRST_ALLY_WINDOW' }]
        : []),
      { nodeType: 'ACTOR_NEXT_OPPORTUNITY' },
    ].slice(0, 12) : [{ nodeType: 'CURRENT_ACTION', candidateId: candidate.candidateId }];
    const objectiveUtility = clamp(expectedStateGain + terminalUtility + informationValue - irreversibleCost - catastrophicRisk, -200, 200);
    const hasProgress = directStateGain > 0.0001 || terminalUtility > 0 || informationValue > 0;
    const hasCost = Object.keys(candidate.costs || {}).length > 0 || irreversibleCost > 0 || ['EQUIP', 'USE_ITEM'].includes(candidate.declaration.actionKind);
    const hasMeaningfulPreviewEffect = candidate.creation?.useful === true || !!result && (
      (result.scheduledEvents || []).length > 0 ||
      (result.contributions || []).some(entry => {
        const evidence = entry?.evidence || {};
        if (entry.outcomeKind === 'HP_DELTA') return Number(evidence.delta ?? evidence.expectedDamage ?? 0) > 0 || Number(entry.threatValue || 0) > 0;
        if (entry.outcomeKind === 'SHIELD_DELTA') return Number(evidence.delta || 0) > 0;
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
    const hasOnlyRedundantStates = stateEffects.length > 0 && !stateHasMarginalValue && !summonEvents.length &&
      !(result?.contributions || []).some(entry => entry.outcomeKind === 'HP_DELTA' && Number(entry?.evidence?.expectedDamage || 0) > 0);
    const candidateEffects = preview.collectEffects(candidate.skill || candidate.declaration?.skill || {});
    const resourceSupportOnly = candidateEffects.length > 0 && candidateEffects.every(effect => {
      if (String(effect?.原型 || '').trim() !== '资源变化') return false;
      if (/生命|HP/i.test(String(effect?.资源 || ''))) return false;
      return Number.parseFloat(String(effect?.数值 || '0')) > 0;
    });
    const materialResourceUnlock = !resourceSupportOnly || !result || (candidate.declaration.targetIds || []).some(targetId => {
      const beforeTarget = preview.findUnit(context.worldSnapshot, targetId);
      const afterTarget = preview.findUnit(result.afterSnapshot, targetId);
      if (!beforeTarget || !afterTarget) return false;
      const affordableBefore = new Set(collectSkills(beforeTarget)
        .filter(skill => costAffordable(beforeTarget, skill))
        .map((skill, index) => skillId(skill, index)));
      return collectSkills(afterTarget).some((skill, index) =>
        !affordableBefore.has(skillId(skill, index)) &&
        costAffordable(afterTarget, skill),
      );
    });
    const zeroEffectCostly = hasCost && (!hasMeaningfulPreviewEffect || hasOnlyRedundantStates || !materialResourceUnlock) && informationValue <= 0 && directDefensiveUtility(candidate.declaration.actionKind, context) <= 0;
    const actorAfter = result ? preview.findUnit(result.afterSnapshot, preview.unitId(actor)) : null;
    const selfDefeating = !!actorAfter && !preview.isAlive(actorAfter) && expectedStateGain <= 0.0001 && terminalUtility <= 0 && informationValue <= 0;
    const summonWindowMissing = summonEvents.some(event => !event.actionMode || Number(event.duration || 0) <= 0);
    const lifecycleReject = candidate.creation && !candidate.creation.useful ? 'ZERO_EFFECT_COSTLY' : summonWindowMissing ? 'SUMMON_NO_ACTION_WINDOW' : '';
    const intentReject = terminalUtility < 0 ? 'INTENT_TERMINAL_CONFLICT' : '';
    return {
      ...candidate,
      preview: result || null,
      utilityBefore: before.utility,
      utilityAfter: after.utility,
      objectiveUtility,
      withdrawalEstimate,
      mechanicObservations: Object.freeze(mechanicObservations),
      deepAnalysis: Object.freeze({ required: deepRequired, nodeCount: deepTimeline.length, timeline: Object.freeze(deepTimeline), responseBranches: Object.freeze(branches), expectedResponseUtility, mechanicProbability, controlOverlap }),
      vector: {
        expectedStateGain,
        terminalUtility,
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
      rejectionCode: intentReject || lifecycleReject || (selfDefeating ? 'SELF_DEFEATING' : zeroEffectCostly ? 'ZERO_EFFECT_COSTLY' : !hasProgress ? 'ZERO_PROGRESS' : ''),
    };
  }

  function dominates(left, right) {
    const gains = ['expectedStateGain', 'terminalUtility', 'informationValue', 'resourcePreservation', 'survivalLowerBound'];
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
    const pool = eligible.filter(candidate => eligible[0].normalizedUtility - candidate.normalizedUtility <= maxNormalizedRegret + 1e-9);
    const weighted = pool.map(candidate => ({ candidate, weight: Math.exp((candidate.normalizedUtility - eligible[0].normalizedUtility) / Math.max(0.01, temperature)) }));
    let roll = stableRoll(`${seed}|${preview.unitId(actor)}|${weighted.map(item => item.candidate.candidateId).join('|')}`) * weighted.reduce((sum, item) => sum + item.weight, 0);
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
    decisionRevisionSequence += 1;
    const actor = preview.findUnit(worldSnapshot, input.actorId);
    if (!actor || !preview.isAlive(actor)) throw new Error('battle_decision_actor_unavailable');
    const beliefState = buildInitialBelief(worldSnapshot, preview.unitId(actor), input.beliefState || {});
    const decisionWorld = buildDecisionWorld(worldSnapshot, preview.unitId(actor), beliefState);
    const decisionActor = preview.findUnit(decisionWorld, preview.unitId(actor));
    const actorSide = preview.sideOf(decisionWorld, decisionActor);
    const battleIntent = actorBattleIntent(decisionWorld, actorSide, input.battleIntent);
    const teamIntent = buildTeamIntent(decisionWorld, preview.unitId(actor), beliefState);
    const problems = identifyProblems(decisionWorld, preview.unitId(actor), beliefState);
    const signature = strategicSignature(decisionWorld, beliefState);
    const stalemate = detectStalemate(input.strategicHistory, signature);
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
      beliefRevision: String(beliefState.revision || preview.stableHash(beliefState)),
      beforeUtility: stateUtility(decisionWorld, actorSide, beliefState),
    };
    const scoringContext = { ...context, sharedResponseBranches: Object.freeze(responseBranches(context)) };
    const generated = enumerateCandidates(scoringContext);
    if (!generated.length) throw new Error('battle_decision_candidate_pool_empty');
    const scored = generated.map(candidate => scoreCandidate(candidate, scoringContext));
    const normalized = classifyCandidateEvidence(normalizeUtilities(paretoFilter(scored)));
    const strategyMemory = activeStrategyMemory(input.strategyMemory, decisionWorld, input.actionOpportunity, normalized);
    const choice = selectCandidate(normalized, decisionActor, input.seed || 1, { ...context, strategyMemory });
    const selected = { ...choice.selected, selected: true };
    const alternatives = normalized.filter(candidate => candidate.candidateId !== selected.candidateId).sort((a, b) => b.objectiveUtility - a.objectiveUtility).slice(0, 2);
    return Object.freeze({
      version: VERSION,
      actorId: preview.unitId(actor),
      candidateCount: normalized.length,
      paretoCount: normalized.filter(candidate => !candidate.rejectionCode).length,
      candidates: Object.freeze(normalized),
      selected: Object.freeze(selected),
      beliefState: Object.freeze(beliefState),
      teamIntent: Object.freeze(teamIntent),
      problems: Object.freeze(problems),
      strategicSignature: signature,
      stalemate,
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
    decide,
  });
})();

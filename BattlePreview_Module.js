/* BattlePreview_Module.js - Pure battle preview and capacity model. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_preview_shared_prototype_registry_missing');
  }

  const VERSION = '7.3-R6.3-preview-1';
  const MAX_PREVIEW_NODES = 12;
  const MAX_RECURSION_DEPTH = 4;
  const supportedPrototypes = new Set(['伤害结算', '资源变化', '资源转移', '护盾变化']);
  const outcomeComponents = Object.freeze({
    HP_DELTA: 'IMMEDIATE_STATE',
    SHIELD_DELTA: 'IMMEDIATE_STATE',
    SCHEDULED_HP_DELTA: 'SCHEDULED_STATE',
    ACTION_GRANTED: 'ACTION_ECONOMY',
    ACTION_CANCELLED: 'ACTION_ECONOMY',
    NEXT_ACTION_QUALITY_CHANGED: 'FUTURE_OPTION',
    RESOURCE_OPTION_CHANGED: 'RESOURCE_OPTION',
    INFORMATION_REVEALED: 'INFORMATION',
    IRREVERSIBLE_ASSET_LOST: 'IRREVERSIBLE_COST',
    TAIL_FAILURE: 'TAIL_RISK',
    CHAIN_CONFLICT: 'CHAIN_CONFLICT',
    STATE_CHANGED: 'STATE_DELTA',
    RULE_CHANGED: 'RULE_DELTA',
    SUMMON_WINDOW: 'SCHEDULED_STATE',
  });
  const effectArrayFields = Object.freeze([
    '_效果数组',
    ...(Array.isArray(sharedRegistry?.嵌套效果数组字段) ? sharedRegistry.嵌套效果数组字段 : []),
    ...(Array.isArray(sharedRegistry?.条件分支效果数组字段) ? sharedRegistry.条件分支效果数组字段 : []),
  ]);

  const metrics = {
    previewCalls: 0,
    cacheHits: 0,
    overlayWrites: 0,
    fullCloneCalls: 0,
    maxNodesObserved: 0,
  };
  const previewCache = new Map();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function stableHash(value) {
    const text = typeof value === 'string' ? value : stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function unitId(unit = {}) {
    return String(unit?.id || unit?.角色ID || unit?.uid || unit?.name || unit?.名称 || '').trim();
  }

  function unitName(unit = {}) {
    return String(unit?.name || unit?.名称 || unitId(unit) || '未知单位').trim();
  }

  function unitStats(unit = {}) {
    return unit?.final && typeof unit.final === 'object'
      ? unit.final
      : unit?.属性 && typeof unit.属性 === 'object'
        ? unit.属性
        : unit;
  }

  function readNumber(unit = {}, keys = [], fallback = 0) {
    const stats = unitStats(unit);
    for (const key of keys) {
      const direct = Number(unit?.[key]);
      if (Number.isFinite(direct)) return direct;
      const fromStats = Number(stats?.[key]);
      if (Number.isFinite(fromStats)) return fromStats;
    }
    return Number(fallback) || 0;
  }

  function readHpMax(unit = {}) {
    return Math.max(1, readNumber(unit, ['hp_max', 'HP上限', '生命上限', 'vit_max', '体力上限'], 1));
  }

  function readHp(unit = {}) {
    return clamp(readNumber(unit, ['hp', 'HP', '生命', 'vit', '体力'], readHpMax(unit)), 0, readHpMax(unit));
  }

  function readShield(unit = {}) {
    return Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0));
  }

  function readResourceMax(unit = {}, resource = '') {
    if (/精神/.test(resource)) return Math.max(1, readNumber(unit, ['men_max', '精神力上限'], 1));
    if (/体力/.test(resource)) return Math.max(1, readNumber(unit, ['vit_max', 'sta_max', '体力上限'], 1));
    if (/生命|HP/i.test(resource)) return readHpMax(unit);
    return Math.max(1, readNumber(unit, ['sp_max', '魂力上限'], 1));
  }

  function readResource(unit = {}, resource = '') {
    if (/精神/.test(resource)) return clamp(readNumber(unit, ['men', '精神力'], 0), 0, readResourceMax(unit, resource));
    if (/体力/.test(resource)) return clamp(readNumber(unit, ['vit', 'sta', '体力'], 0), 0, readResourceMax(unit, resource));
    if (/生命|HP/i.test(resource)) return readHp(unit);
    return clamp(readNumber(unit, ['sp', '魂力'], 0), 0, readResourceMax(unit, resource));
  }

  function readCombatStat(unit = {}, key = '') {
    const aliases = {
      str: ['str', '力量', '攻击'],
      def: ['def', '防御'],
      agi: ['agi', '敏捷'],
      men: ['men_max', '精神力上限', '精神力'],
    };
    return Math.max(1, readNumber(unit, aliases[key] || [key], 1));
  }

  function listUnits(worldSnapshot = {}) {
    const participants = worldSnapshot?.参战者 && typeof worldSnapshot.参战者 === 'object' ? worldSnapshot.参战者 : {};
    return Object.entries(participants).flatMap(([side, value]) => {
      const units = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
      return units.filter(Boolean).map(unit => ({ unit, side }));
    });
  }

  function findUnit(worldSnapshot = {}, id = '') {
    const wanted = String(id || '').trim();
    if (!wanted) return null;
    return listUnits(worldSnapshot).find(entry => unitId(entry.unit) === wanted || unitName(entry.unit) === wanted)?.unit || null;
  }

  function sideOf(worldSnapshot = {}, unit = {}) {
    const id = unitId(unit);
    return listUnits(worldSnapshot).find(entry => unitId(entry.unit) === id)?.side || '';
  }

  function isAlive(unit = {}) {
    return unit?.状态?.存活 !== false && readHp(unit) > 0;
  }

  function parseSignedValue(value, base = 0) {
    if (typeof value === 'number') return Number(value) || 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const numeric = Number.parseFloat(text.replace('%', ''));
    if (!Number.isFinite(numeric)) return 0;
    return text.includes('%') ? Number(base || 0) * numeric / 100 : numeric;
  }

  function classifyDamageType(value = '') {
    const text = String(value || '').trim();
    if (/真实/.test(text)) return 'TRUE';
    if (/精神/.test(text)) return 'MENTAL';
    if (/远程/.test(text)) return 'RANGED';
    return 'MELEE';
  }

  function calculateBaseDamage(effect = {}, actor = {}, target = {}) {
    const damageClass = classifyDamageType(effect?.伤害类型);
    const power = Math.max(0, Number(effect?.威力倍率 ?? effect?.数值 ?? 0));
    const penetration = clamp(Number(effect?.防御穿透 || 0) / 100, 0, 0.95);
    const attack = damageClass === 'MENTAL' ? readCombatStat(actor, 'men') : readCombatStat(actor, 'str');
    const defense = damageClass === 'MENTAL'
      ? Math.max(1, readCombatStat(target, 'men') * (1 - penetration))
      : Math.max(1, readCombatStat(target, 'def') * (1 - penetration));
    const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 ?? effect?.段数 ?? 1)));
    let perSegment = 0;
    if (damageClass === 'TRUE') perSegment = power * Math.max(1, Math.sqrt(attack)) * 0.12;
    else perSegment = power * (attack / defense) * (damageClass === 'MELEE' ? 1.04 : 1);
    return Math.max(0, perSegment * segments);
  }

  function estimateHitProbability(actor = {}, target = {}, effect = {}) {
    const explicit = Number(effect?.命中概率 ?? effect?.触发概率);
    if (Number.isFinite(explicit)) return clamp(explicit > 1 ? explicit / 100 : explicit, 0, 1);
    const attackAgility = readCombatStat(actor, 'agi');
    const targetAgility = readCombatStat(target, 'agi');
    return clamp(0.78 + (attackAgility - targetAgility) / Math.max(100, attackAgility + targetAgility) * 0.35, 0.05, 0.99);
  }

  function collectEffects(skill = {}) {
    const output = [];
    const seen = new Set();
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);
      if (String(value?.原型 || '').trim()) output.push(value);
      effectArrayFields.forEach(field => {
        const nested = value?.[field];
        if (Array.isArray(nested)) nested.forEach(visit);
      });
    };
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    effects.forEach(visit);
    return output;
  }

  class PreviewOverlay {
    constructor(baseWorld = {}, baseRevision = '') {
      this.baseWorld = baseWorld;
      this.baseRevision = String(baseRevision || stableHash(baseWorld));
      this.changedUnits = new Map();
      this.changedStates = new Map();
      this.changedResources = new Map();
      this.changedRules = new Map();
      this.scheduledEvents = [];
    }

    readUnit(id) {
      const key = String(id || '').trim();
      return this.changedUnits.get(key) || findUnit(this.baseWorld, key);
    }

    writeUnit(unit) {
      const id = unitId(unit);
      if (!id) throw new Error('battle_preview_overlay_unit_id_missing');
      this.changedUnits.set(id, unit);
      metrics.overlayWrites += 1;
      return unit;
    }

    changeUnit(id, mutator) {
      const current = this.readUnit(id);
      if (!current) throw new Error(`battle_preview_overlay_unit_missing:${id}`);
      const next = cloneValue(current);
      mutator(next);
      return this.writeUnit(next);
    }

    schedule(event) {
      this.scheduledEvents.push(Object.freeze({ ...event }));
      metrics.overlayWrites += 1;
    }

    snapshot() {
      const participants = this.baseWorld?.参战者 || {};
      const nextParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
        if (Array.isArray(value)) {
          return [side, value.map(unit => this.changedUnits.get(unitId(unit)) || unit)];
        }
        if (value && typeof value === 'object') {
          return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, this.changedUnits.get(unitId(unit)) || unit]))];
        }
        return [side, value];
      }));
      return { ...this.baseWorld, 参战者: nextParticipants };
    }
  }

  class ContributionLedger {
    constructor() {
      this.entries = [];
      this.semanticKeys = new Set();
      this.actionCancelledWindows = new Set();
    }

    addOutcome(input = {}) {
      const outcomeKind = String(input?.outcomeKind || '').trim();
      if (!outcomeComponents[outcomeKind]) throw new Error(`battle_preview_outcome_kind_unsupported:${outcomeKind}`);
      const semanticKey = [input.rootActionId, input.effectInstanceId, input.targetId, outcomeKind, input.windowId || 'NOW']
        .map(value => String(value || '').trim() || 'NONE').join('|');
      if (this.semanticKeys.has(semanticKey)) throw new Error(`battle_preview_duplicate_causal_value:${semanticKey}`);
      const windowKey = `${String(input.rootActionId || '')}|${String(input.targetId || '')}|${String(input.windowId || 'NOW')}`;
      if (outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED' && this.actionCancelledWindows.has(windowKey)) {
        throw new Error(`battle_preview_mutually_exclusive_causal_value:${windowKey}`);
      }
      if (outcomeKind === 'ACTION_CANCELLED') {
        if (this.entries.some(entry => entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED' && entry.windowKey === windowKey)) {
          throw new Error(`battle_preview_mutually_exclusive_causal_value:${windowKey}`);
        }
        this.actionCancelledWindows.add(windowKey);
      }
      this.semanticKeys.add(semanticKey);
      const entry = Object.freeze({
        semanticKey,
        rootCauseId: String(input.rootActionId || '').trim(),
        effectInstanceId: String(input.effectInstanceId || '').trim(),
        targetId: String(input.targetId || '').trim(),
        windowId: String(input.windowId || 'NOW').trim(),
        windowKey,
        outcomeKind,
        component: outcomeComponents[outcomeKind],
        threatValue: Number(input.threatValue || 0),
        evidence: input.evidence && typeof input.evidence === 'object' ? Object.freeze({ ...input.evidence }) : Object.freeze({}),
      });
      this.entries.push(entry);
      return entry;
    }
  }

  function resolveTargets(worldSnapshot = {}, actor = {}, declaration = {}, effect = {}) {
    const all = listUnits(worldSnapshot);
    const actorSide = sideOf(worldSnapshot, actor);
    const targetText = String(effect?.目标 || declaration?.targetKind || '').trim();
    const declaredIds = Array.isArray(declaration?.targetIds) ? declaration.targetIds.map(String) : [];
    if (declaredIds.length) return declaredIds.map(id => findUnit(worldSnapshot, id)).filter(Boolean);
    if (/自身/.test(targetText)) return [actor];
    const friendly = all.filter(entry => entry.side === actorSide && isAlive(entry.unit)).map(entry => entry.unit);
    const hostile = all.filter(entry => entry.side !== actorSide && isAlive(entry.unit)).map(entry => entry.unit);
    if (/友方.*群体|己方.*群体/.test(targetText)) return friendly;
    if (/群体|全场/.test(targetText)) return /友方|己方/.test(targetText) ? friendly : hostile;
    if (/友方|己方/.test(targetText)) return friendly.slice(0, 1);
    return hostile.slice(0, 1);
  }

  function setHp(unit, hp) {
    const next = clamp(hp, 0, readHpMax(unit));
    if ('hp' in unit || !('HP' in unit)) unit.hp = next;
    if ('HP' in unit) unit.HP = next;
    if (unit.属性 && typeof unit.属性 === 'object') {
      if ('HP' in unit.属性) unit.属性.HP = next;
      else if ('生命' in unit.属性) unit.属性.生命 = next;
      else if ('体力' in unit.属性 && !('hp' in unit)) unit.属性.体力 = next;
    }
    if (next <= 0 && unit.状态 && typeof unit.状态 === 'object') unit.状态.存活 = false;
  }

  function setResource(unit, resource, value) {
    const next = clamp(value, 0, readResourceMax(unit, resource));
    const mapping = /精神/.test(resource) ? ['men', '精神力'] : /体力/.test(resource) ? ['vit', '体力'] : ['sp', '魂力'];
    if (mapping[0] in unit || !(mapping[1] in unit)) unit[mapping[0]] = next;
    if (unit.属性 && typeof unit.属性 === 'object') unit.属性[mapping[1]] = next;
  }

  function addState(unit, effect, effectId) {
    const stateName = String(effect?.状态 || effect?.状态名称 || effect?.判定 || effect?.原型 || '').trim();
    if (!stateName) return;
    unit.状态效果 = unit.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : {};
    unit.状态效果[`preview:${effectId}:${stateName}`] = {
      状态: stateName,
      状态名称: stateName,
      类型: effect?.类型 || '',
      duration: Math.max(1, Number(effect?.持续回合 || 1)),
      战斗效果: cloneValue(effect?.计算层效果 || effect?.战斗效果 || {}),
      面板修改比例: cloneValue(effect?.面板修改比例 || {}),
      面板固定修正: cloneValue(effect?.面板固定修正 || {}),
    };
  }

  function resourceOutcome(effect, target, overlay, ledger, context) {
    const currentTarget = overlay.readUnit(unitId(target));
    const resource = String(effect?.资源 || '魂力').trim();
    const current = /生命|HP/i.test(resource) ? readHp(currentTarget) : readResource(currentTarget, resource);
    const maximum = readResourceMax(currentTarget, resource);
    const delta = parseSignedValue(effect?.数值, maximum);
    const next = clamp(current + delta, 0, maximum);
    overlay.changeUnit(unitId(target), unit => {
      if (/生命|HP/i.test(resource)) setHp(unit, next);
      else setResource(unit, resource, next);
    });
    ledger.addOutcome({
      ...context,
      targetId: unitId(target),
      outcomeKind: /生命|HP/i.test(resource) ? 'HP_DELTA' : 'RESOURCE_OPTION_CHANGED',
      threatValue: /生命|HP/i.test(resource) ? (next - current) / readHpMax(currentTarget) * 100 : 0,
      evidence: { resource, current, next, delta: next - current },
    });
  }

  function applyEffect(effect, targets, overlay, ledger, context, depth) {
    const prototype = String(effect?.原型 || '').trim();
    if (!prototypeRegistry[prototype]) throw new Error(`battle_preview_unknown_prototype:${prototype}`);
    if (depth > MAX_RECURSION_DEPTH) throw new Error('battle_preview_recursion_depth_exceeded');
    if (!supportedPrototypes.has(prototype)) throw new Error(`battle_preview_prototype_not_implemented:${prototype}`);
    if (prototype === '伤害结算') {
      targets.forEach(target => {
        const currentTarget = overlay.readUnit(unitId(target));
        const rawDamage = calculateBaseDamage(effect, context.actor, currentTarget);
        const hitProbability = estimateHitProbability(context.actor, currentTarget, effect);
        const expectedDamage = Math.min(readHp(currentTarget), rawDamage * hitProbability);
        overlay.changeUnit(unitId(target), unit => setHp(unit, readHp(unit) - expectedDamage));
        ledger.addOutcome({
          ...context,
          targetId: unitId(target),
          outcomeKind: 'HP_DELTA',
          threatValue: expectedDamage / readHpMax(currentTarget) * 100,
          evidence: { rawDamage, hitProbability, expectedDamage, damageType: effect?.伤害类型 || '' },
        });
      });
      return;
    }
    if (prototype === '资源变化') {
      targets.forEach(target => resourceOutcome(effect, target, overlay, ledger, context));
      return;
    }
    if (prototype === '资源转移') {
      const amountTarget = targets[0];
      if (!amountTarget) return;
      const currentActor = overlay.readUnit(unitId(context.actor));
      const currentTarget = overlay.readUnit(unitId(amountTarget));
      const resource = String(effect?.资源 || '魂力').trim();
      const amount = Math.abs(parseSignedValue(effect?.数值, readResourceMax(currentTarget, resource)));
      const actorCurrent = readResource(currentActor, resource);
      const targetCurrent = readResource(currentTarget, resource);
      const moved = Math.min(amount, actorCurrent, readResourceMax(currentTarget, resource) - targetCurrent);
      overlay.changeUnit(unitId(context.actor), unit => setResource(unit, resource, actorCurrent - moved));
      overlay.changeUnit(unitId(amountTarget), unit => setResource(unit, resource, targetCurrent + moved));
      [context.actor, amountTarget].forEach((unit, index) => ledger.addOutcome({
        ...context,
        targetId: unitId(unit),
        effectInstanceId: `${context.effectInstanceId}:${index}`,
        outcomeKind: 'RESOURCE_OPTION_CHANGED',
        threatValue: 0,
        evidence: { resource, delta: index === 0 ? -moved : moved },
      }));
      return;
    }
    if (prototype === '护盾变化') {
      targets.forEach(target => {
        const currentTarget = overlay.readUnit(unitId(target));
        const current = readShield(currentTarget);
        const delta = parseSignedValue(effect?.数值, readHpMax(currentTarget));
        const next = Math.max(0, current + delta);
        overlay.changeUnit(unitId(target), unit => {
          unit.shield = next;
          unit.护盾 = next;
        });
        ledger.addOutcome({
          ...context,
          targetId: unitId(target),
          outcomeKind: 'SHIELD_DELTA',
          threatValue: (next - current) / readHpMax(currentTarget) * 100,
          evidence: { current, next, duration: Math.max(1, Number(effect?.持续回合 || 1)) },
        });
      });
      return;
    }
  }

  function basicAttackEffect() {
    return { 原型: '伤害结算', 目标: '敌方单体', 威力倍率: 50, 伤害类型: '近身攻击', 生效方式: '独立生效' };
  }

  function calculateBaseActionValue(actor = {}, target = {}, declaration = {}) {
    const effects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : collectEffects(declaration?.skill || {});
    return effects.reduce((sum, effect) => {
      if (String(effect?.原型 || '').trim() === '伤害结算' && target) {
        const expectedDamage = calculateBaseDamage(effect, actor, target) * estimateHitProbability(actor, target, effect);
        return sum + Math.min(readHp(target), expectedDamage) / readHpMax(target) * 100;
      }
      if (String(effect?.原型 || '').trim() === '资源变化' && /生命|HP/i.test(String(effect?.资源 || ''))) {
        const base = readHpMax(target || actor);
        const missing = base - readHp(target || actor);
        return sum + Math.min(missing, Math.max(0, parseSignedValue(effect?.数值, base))) / base * 100;
      }
      if (String(effect?.原型 || '').trim() === '护盾变化') {
        const base = readHpMax(target || actor);
        return sum + Math.max(0, parseSignedValue(effect?.数值, base)) / base * 100;
      }
      return sum;
    }, 0);
  }

  function calculateUnitCapacity(input = {}) {
    const unit = input?.unit || {};
    if (!isAlive(unit)) return 0;
    const survivalFactor = clamp(input?.survivalProbability ?? readHp(unit) / readHpMax(unit), 0, 1);
    const actionAvailability = clamp(input?.actionAvailability ?? 1, 0, 1);
    const bestLegalBaseActionValue = Math.max(0, Number(input?.bestLegalBaseActionValue || 0));
    return survivalFactor * actionAvailability * bestLegalBaseActionValue;
  }

  function buildCacheKey(input = {}) {
    return [
      input.worldRevision || stableHash(input.worldSnapshot || {}),
      input.beliefRevision || stableHash(input.beliefSnapshot || {}),
      input.actorId || '',
      stableHash(input.declaration || {}),
      (input.declaration?.targetIds || []).join(','),
      input.horizon || 'SHALLOW',
    ].join('|');
  }

  function previewAction(input = {}) {
    const worldSnapshot = input?.worldSnapshot;
    const declaration = input?.declaration;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_preview_world_missing');
    if (!declaration || typeof declaration !== 'object') throw new TypeError('battle_preview_declaration_missing');
    const actor = findUnit(worldSnapshot, input?.actorId || declaration?.actorId);
    if (!actor) throw new Error('battle_preview_actor_missing');
    if (!isAlive(actor)) throw new Error('battle_preview_actor_unavailable');
    const budgetLimit = Math.max(1, Math.min(MAX_PREVIEW_NODES, Number(input?.previewBudget?.maxNodes || MAX_PREVIEW_NODES)));
    const cacheKey = buildCacheKey(input);
    if (previewCache.has(cacheKey)) {
      metrics.cacheHits += 1;
      return previewCache.get(cacheKey);
    }
    metrics.previewCalls += 1;
    const rootActionId = String(declaration?.actionId || declaration?.candidateId || `preview:${cacheKey}`).trim();
    const overlay = new PreviewOverlay(worldSnapshot, input?.worldRevision);
    const ledger = new ContributionLedger();
    const effects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : collectEffects(declaration?.skill || {});
    if (!effects.length && !['DEFEND', 'EVADE', 'WITHDRAW', 'EQUIP', 'OBSERVE'].includes(String(declaration?.actionKind || '').trim())) {
      throw new Error('battle_preview_action_effects_missing');
    }
    let nodes = 0;
    effects.forEach((effect, index) => {
      nodes += 1;
      if (nodes > budgetLimit) throw new Error('DECISION_PREVIEW_BUDGET_EXCEEDED');
      const targets = resolveTargets(worldSnapshot, actor, declaration, effect);
      const context = {
        actor,
        rootActionId,
        effectInstanceId: String(effect?.effectId || effect?.效果ID || `${rootActionId}:effect:${index}`).trim(),
        windowId: `round:${Number(worldSnapshot?.回合 || 0)}:effect:${index}`,
      };
      applyEffect(effect, targets, overlay, ledger, context, 0);
    });
    metrics.maxNodesObserved = Math.max(metrics.maxNodesObserved, nodes);
    const result = Object.freeze({
      version: VERSION,
      cacheKey,
      actorId: unitId(actor),
      actionId: rootActionId,
      actionKind: String(declaration?.actionKind || '').trim(),
      nodeCount: nodes,
      contributions: Object.freeze([...ledger.entries]),
      scheduledEvents: Object.freeze([...overlay.scheduledEvents]),
      changedUnitIds: Object.freeze([...overlay.changedUnits.keys()]),
      afterSnapshot: overlay.snapshot(),
      metrics: Object.freeze({ overlayWrites: metrics.overlayWrites, fullCloneCalls: 0 }),
    });
    previewCache.set(cacheKey, result);
    return result;
  }

  function clearCache() {
    previewCache.clear();
  }

  function readMetrics() {
    return Object.freeze({ ...metrics, cacheSize: previewCache.size });
  }

  const api = Object.freeze({
    version: VERSION,
    outcomeComponents,
    supportedPrototypes: Object.freeze([...supportedPrototypes]),
    PreviewOverlay,
    ContributionLedger,
    stableHash,
    unitId,
    unitName,
    listUnits,
    findUnit,
    sideOf,
    isAlive,
    readHp,
    readHpMax,
    readShield,
    readResource,
    readResourceMax,
    readCombatStat,
    parseSignedValue,
    collectEffects,
    calculateBaseDamage,
    estimateHitProbability,
    calculateBaseActionValue,
    calculateUnitCapacity,
    previewAction,
    clearCache,
    readMetrics,
  });

  root.__LWCS_BATTLE_PREVIEW__ = api;
})();

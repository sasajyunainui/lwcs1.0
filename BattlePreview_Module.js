/* BattlePreview_Module.js - Pure battle preview and capacity model. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_preview_shared_prototype_registry_missing');
  }
  const battleEventContract = root.__LWCS_BATTLE_EVENT_CONTRACT__;
  if (
    !battleEventContract ||
    battleEventContract.schemaVersion !== '8.3-battle-event-contract-1'
  ) {
    throw new Error('battle_preview_event_contract_missing');
  }

  const VERSION = '7.3-R6.3-preview-2';
  const MAX_PREVIEW_NODES = 12;
  const MAX_RECURSION_DEPTH = 4;
  const effectHashCache = new WeakMap();
  const effectArrayHashCache = new WeakMap();
  const fusionMetadataCache = new WeakMap();
  const stableHashCache = new WeakMap();
  const stableHashImmutableCache = new WeakMap();
  let normalizedObjectivesCache = new WeakMap();
  const battlePrototypes = new Set([
    '伤害结算', '资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '结算修正',
    '炸环', '状态施加', '时窗修正', '状态移除', '规则防御', '状态转移', '状态交换',
    '资源锁定', '规则改写', '机制抹消', '机制授予', '复制执行', '时光回溯', '位移执行',
    '决策干扰', '召唤生成',
  ]);
  const nonBattlePrototypes = new Set(['修炼增益', '战斗外复活']);
  const BASIC_ATTACK_EFFECT = Object.freeze({
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 50,
    伤害类型: '近身攻击',
    生效方式: '独立生效',
  });
  const outcomeComponents = Object.freeze({
    HP_DELTA: 'IMMEDIATE_STATE',
    SHIELD_DELTA: 'IMMEDIATE_STATE',
    SCHEDULED_HP_DELTA: 'SCHEDULED_STATE',
    ACTION_GRANTED: 'ACTION_ECONOMY',
    ACTION_CANCELLED: 'ACTION_ECONOMY',
    NEXT_ACTION_QUALITY_CHANGED: 'FUTURE_OPTION',
    RESOURCE_OPTION_CHANGED: 'RESOURCE_OPTION',
    INFORMATION_REVEALED: 'INFORMATION',
    BELIEF_CHANGED: 'BELIEF_STATE',
    IRREVERSIBLE_ASSET_LOST: 'IRREVERSIBLE_COST',
    TAIL_FAILURE: 'TAIL_RISK',
    CHAIN_CONFLICT: 'CHAIN_CONFLICT',
    STATE_CHANGED: 'STATE_DELTA',
    STATE_SCHEDULED: 'SCHEDULED_STATE',
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
    stableHashCalls: 0,
    stableHashChars: 0,
    stableHashCacheHits: 0,
    stableHashImmutableCacheHits: 0,
  };
  const previewCache = new Map();
  const unitIdCache = new WeakMap();
  const unitNameCache = new WeakMap();
  const dependencyCaptureStack = [];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function recordPreviewDependency(key = '', value = null) {
    const capture = dependencyCaptureStack[dependencyCaptureStack.length - 1];
    const normalizedKey = String(key || '').trim();
    if (!capture || !normalizedKey) return;
    if (!capture.reads.has(normalizedKey)) {
      capture.reads.set(normalizedKey, cloneValue(value));
    }
    if (typeof capture.recorder === 'function') {
      capture.recorder(normalizedKey, value);
    }
  }

  function cloneUnitForOverlay(unit = {}) {
    const cloneStates = states => {
      if (Array.isArray(states)) return states.map(state => state && typeof state === 'object' ? cloneValue(state) : state);
      if (states && typeof states === 'object') return Object.fromEntries(Object.entries(states).map(([key, state]) => [key, cloneValue(state)]));
      return states;
    };
    return {
      ...unit,
      属性: unit?.属性 && typeof unit.属性 === 'object' ? { ...unit.属性 } : unit?.属性,
      状态: unit?.状态 && typeof unit.状态 === 'object' ? { ...unit.状态 } : unit?.状态,
      final: unit?.final && typeof unit.final === 'object' ? { ...unit.final } : unit?.final,
      __battleRuntime: unit?.__battleRuntime && typeof unit.__battleRuntime === 'object'
        ? cloneValue(unit.__battleRuntime)
        : unit?.__battleRuntime,
      状态效果: cloneStates(unit?.状态效果),
      背包: unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : unit?.背包,
      库存: unit?.库存 && typeof unit.库存 === 'object' ? cloneValue(unit.库存) : unit?.库存,
      物品: unit?.物品 && typeof unit.物品 === 'object' ? cloneValue(unit.物品) : unit?.物品,
      战斗物品: unit?.战斗物品 && typeof unit.战斗物品 === 'object' ? cloneValue(unit.战斗物品) : unit?.战斗物品,
    };
  }

  function stableHash(value) {
    const cacheable = Array.isArray(value);
    if (cacheable) {
      const cached = stableHashCache.get(value);
      if (cached) {
        metrics.stableHashCacheHits += 1;
        return cached;
      }
    }
    if (value && typeof value === 'object') {
      const immutableCached = stableHashImmutableCache.get(value);
      if (immutableCached) {
        metrics.stableHashImmutableCacheHits += 1;
        return immutableCached;
      }
    }
    metrics.stableHashCalls += 1;
    let hash = 2166136261;
    let characterCount = 0;
    let fullyFrozen = true;
    const update = text => {
      characterCount += text.length;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
    };
    const visit = (item, undefinedText) => {
      if (Array.isArray(item)) {
        if (!Object.isFrozen(item)) fullyFrozen = false;
        update('[');
        for (let index = 0; index < item.length; index += 1) {
          if (index > 0) update(',');
          if (Object.hasOwn(item, index)) visit(item[index], '');
        }
        update(']');
        return;
      }
      if (item && typeof item === 'object') {
        if (!Object.isFrozen(item)) fullyFrozen = false;
        update('{');
        Object.keys(item).sort().forEach((key, index) => {
          if (index > 0) update(',');
          update(JSON.stringify(key));
          update(':');
          visit(item[key], 'undefined');
        });
        update('}');
        return;
      }
      const serialized = JSON.stringify(item);
      if (serialized === undefined && undefinedText === null) {
        throw new TypeError('battle_preview_stable_hash_value_not_serializable');
      }
      update(serialized === undefined ? undefinedText : serialized);
    };
    if (typeof value === 'string') update(value);
    else visit(value, null);
    metrics.stableHashChars += characterCount;
    const result = (hash >>> 0).toString(36);
    if (cacheable) stableHashCache.set(value, result);
    if (fullyFrozen && value && typeof value === 'object') {
      stableHashImmutableCache.set(value, result);
    }
    return result;
  }

  function effectArrayHash(effects) {
    if (!Array.isArray(effects)) return '';
    const cached = effectArrayHashCache.get(effects);
    if (cached) return cached;
    const result = stableHash(effects);
    effectArrayHashCache.set(effects, result);
    return result;
  }

  function unitId(unit = {}) {
    if (unit && typeof unit === 'object') {
      const cached = unitIdCache.get(unit);
      if (cached) return cached;
      const result = String(unit?.召唤键 || unit?.id || unit?.角色ID || unit?.uid || unit?.name || unit?.名称 || '').trim();
      if (result) unitIdCache.set(unit, result);
      return result;
    }
    return '';
  }

  function unitName(unit = {}) {
    if (unit && typeof unit === 'object') {
      const cached = unitNameCache.get(unit);
      if (cached) return cached;
      const result = String(unit?.name || unit?.名称 || unitId(unit) || '未知单位').trim();
      if (result) unitNameCache.set(unit, result);
      return result;
    }
    return '未知单位';
  }

  function readNumber(unit = {}, keys = [], fallback = 0) {
    const finalStats = unit?.final && typeof unit.final === 'object' ? unit.final : {};
    const sourceStats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {};
    for (const key of keys) {
      const direct = Number(unit?.[key]);
      if (Number.isFinite(direct)) return direct;
      const fromFinal = Number(finalStats?.[key]);
      if (Number.isFinite(fromFinal)) return fromFinal;
      const fromSource = Number(sourceStats?.[key]);
      if (Number.isFinite(fromSource)) return fromSource;
    }
    return Number(fallback) || 0;
  }

  function defenseDependencyValue(unit = {}) {
    const states = unit?.状态效果;
    const stateValues = Array.isArray(states)
      ? states
      : states && typeof states === 'object'
        ? Object.values(states)
        : [];
    return {
      defense: Math.max(1, readNumber(unit, ['def', '防御'], 1)),
      mental: Math.max(1, readNumber(unit, ['men_max', '精神力上限', '精神力'], 1)),
      agility: Math.max(1, readNumber(unit, ['agi', '敏捷'], 1)),
      shield: stateValues.reduce(
        (sum, state) => sum + Math.max(0, Number(state?.shield_value || 0)),
        Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0)),
      ),
    };
  }

  function readHpMax(unit = {}) {
    const direct = Number(unit?.hp_max);
    const value = Number.isFinite(direct)
      ? Math.max(1, direct)
      : Math.max(1, readNumber(unit, ['hp_max', 'HP上限', '生命上限', 'vit_max', '体力上限'], 1));
    recordPreviewDependency(`unit:${unitId(unit)}:baseMaxHp`, value);
    return value;
  }

  function readHp(unit = {}) {
    const maximum = readHpMax(unit);
    const direct = Number(unit?.hp);
    const value = Number.isFinite(direct)
      ? clamp(direct, 0, maximum)
      : clamp(readNumber(unit, ['hp', 'HP', '生命', 'vit', '体力'], maximum), 0, maximum);
    recordPreviewDependency(`unit:${unitId(unit)}:hp`, value);
    return value;
  }

  function readShield(unit = {}) {
    const direct = Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0));
    const stateTotal = Object.values(unit?.状态效果 || {}).reduce(
      (total, condition) => total + Math.max(0, Number(condition?.shield_value || 0)),
      0,
    );
    // Runtime stores active shields as state entries; direct fields are only the
    // fallback for snapshots that have not been materialized into states yet.
    const value = stateTotal > 0 ? stateTotal : direct;
    recordPreviewDependency(
      `target:${unitId(unit)}:defense`,
      defenseDependencyValue(unit),
    );
    return value;
  }

  function calculateShieldGain(unit = {}, shieldAmount = 0) {
    const requested = Math.max(0, Math.floor(Number(shieldAmount || 0)));
    if (!(requested > 0)) return 0;
    const current = readShield(unit);
    const softCap = Math.max(300, Math.floor(readHpMax(unit) * 1.2 + readResourceMax(unit, '魂力') * 0.35));
    const normal = Math.min(requested, Math.max(0, softCap - current));
    return Math.max(0, Math.floor(normal + Math.max(0, requested - normal) * 0.35));
  }

  function applyPreviewShield(unit = {}, shieldAmount = 0, duration = 1, effectId = '', stateName = '护盾', rawValue = '') {
    const amount = calculateShieldGain(unit, shieldAmount);
    if (!(amount > 0)) return 0;
    unit.状态效果 = unit.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : {};
    const key = `preview:${effectId}:${stateName || '护盾'}`;
    unit.状态效果[key] = {
      类型: 'buff',
      状态: stateName || '护盾',
      状态名称: stateName || '护盾',
      duration: Math.max(1, Number(duration || 1)),
      数值: rawValue,
      shield_value: amount,
      战斗效果: {},
    };
    return amount;
  }

  function absorbPreviewShield(unit = {}, incomingDamage = 0) {
    let remaining = Math.max(0, Number(incomingDamage || 0));
    if (!(remaining > 0)) return 0;
    const entries = Object.entries(unit?.状态效果 || {})
      .map(([key, condition]) => ({
        key,
        condition,
        duration: Math.max(0, Number(condition?.duration ?? condition?.持续回合 ?? 0)),
        value: Math.max(0, Number(condition?.shield_value || 0)),
      }))
      .filter(entry => entry.value > 0)
      .sort((left, right) => left.duration - right.duration || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    let absorbed = 0;
    entries.forEach(entry => {
      if (!(remaining > 0)) return;
      const amount = Math.min(entry.value, remaining);
      entry.condition.shield_value = Math.max(0, entry.value - amount);
      remaining -= amount;
      absorbed += amount;
      if (entry.condition.shield_value <= 0) delete unit.状态效果[entry.key];
    });
    if (!entries.length) {
      const direct = Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0));
      const amount = Math.min(direct, remaining);
      absorbed += amount;
      const next = Math.max(0, direct - amount);
      unit.shield = next;
      unit.护盾 = next;
    } else {
      const next = Object.values(unit?.状态效果 || {}).reduce(
        (total, condition) => total + Math.max(0, Number(condition?.shield_value || 0)),
        0,
      );
      if ('shield' in unit) unit.shield = next;
      if ('护盾' in unit) unit.护盾 = next;
    }
    return absorbed;
  }

  function readResourceMax(unit = {}, resource = '') {
    let value;
    if (/精神/.test(resource)) {
      const direct = Number(unit?.men_max);
      value = Math.max(1, Number.isFinite(direct) ? direct : readNumber(unit, ['men_max', '精神力上限'], 1));
    } else if (/体力/.test(resource)) {
      const direct = Number(unit?.vit_max);
      value = Math.max(1, Number.isFinite(direct) ? direct : readNumber(unit, ['vit_max', 'sta_max', '体力上限'], 1));
    } else if (/生命|HP/i.test(resource)) {
      value = readHpMax(unit);
    } else {
      const direct = Number(unit?.sp_max);
      value = Math.max(1, Number.isFinite(direct) ? direct : readNumber(unit, ['sp_max', '魂力上限'], 1));
    }
    recordPreviewDependency(`unit:${unitId(unit)}:resourceMax:${resource}`, value);
    return value;
  }

  function readResource(unit = {}, resource = '') {
    let value;
    if (/精神/.test(resource)) {
      const maximum = readResourceMax(unit, resource);
      const direct = Number(unit?.men);
      value = Number.isFinite(direct)
        ? clamp(direct, 0, maximum)
        : clamp(readNumber(unit, ['men', '精神力'], 0), 0, maximum);
    } else if (/体力/.test(resource)) {
      const maximum = readResourceMax(unit, resource);
      const direct = Number(unit?.vit);
      value = Number.isFinite(direct)
        ? clamp(direct, 0, maximum)
        : clamp(readNumber(unit, ['vit', 'sta', '体力'], 0), 0, maximum);
    } else if (/生命|HP/i.test(resource)) {
      value = readHp(unit);
    } else {
      const maximum = readResourceMax(unit, resource);
      const direct = Number(unit?.sp);
      value = Number.isFinite(direct)
        ? clamp(direct, 0, maximum)
        : clamp(readNumber(unit, ['sp', '魂力'], 0), 0, maximum);
    }
    recordPreviewDependency(`unit:${unitId(unit)}:resource:${resource}`, value);
    return value;
  }

  function staminaScaleForUnit(unit = {}) {
    const sources = [
      unit,
      unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {},
      unit?.final && typeof unit.final === 'object' ? unit.final : {},
    ];
    const hasStaminaField = sources.some(source =>
      ['vit', 'sta', '体力', 'vit_max', 'sta_max', '体力上限'].some(key =>
        Number.isFinite(Number(source?.[key]))
      )
    );
    if (!hasStaminaField) return 1;
    const ratio = clamp(readResource(unit, '体力') / Math.max(1, readResourceMax(unit, '体力')), 0, 1);
    if (ratio >= 0.5) return 1;
    if (ratio >= 0.3) return 0.9 + (ratio - 0.3) * 0.5;
    if (ratio >= 0.15) return 0.75 + (ratio - 0.15);
    return 0.5 + ratio * (5 / 3);
  }

  function refreshStaminaAdjustedFinal(unit = {}) {
    if (!unit || typeof unit !== 'object') return unit;
    const finalStats = unit.final && typeof unit.final === 'object' ? unit.final : null;
    if (!finalStats) return unit;
    const previousScale = clamp(Number(finalStats.__体力衰减系数 ?? 1), 0.01, 1);
    const nextScale = staminaScaleForUnit(unit);
    ['str', 'def', 'agi', 'sp_max', 'vit_max', 'men_max'].forEach(key => {
      const current = Number(finalStats[key]);
      if (!Number.isFinite(current)) return;
      finalStats[key] = Math.max(1, Math.round(current / previousScale * nextScale));
    });
    if (nextScale < 1) finalStats.__体力衰减系数 = nextScale;
    else delete finalStats.__体力衰减系数;
    return unit;
  }

  function readCombatStat(unit = {}, key = '') {
    const aliases = {
      str: ['str', '力量', '攻击'],
      def: ['def', '防御'],
      agi: ['agi', '敏捷'],
      men: ['men_max', '精神力上限', '精神力'],
    };
    const keys = aliases[key] || [key];
    const finalStats = unit?.final && typeof unit.final === 'object' ? unit.final : null;
    if (finalStats) {
      for (const alias of keys) {
        const value = Number(finalStats[alias]);
        if (Number.isFinite(value)) {
          const result = Math.max(1, value);
          recordPreviewDependency(`unit:${unitId(unit)}:stat:${key}`, result);
          if (key === 'def' || key === 'men' || key === 'agi') {
            recordPreviewDependency(
              `target:${unitId(unit)}:defense`,
              defenseDependencyValue(unit),
            );
          }
          return result;
        }
      }
    }
    const direct = Number(unit?.[keys[0]]);
    const result = Number.isFinite(direct)
      ? Math.max(1, direct)
      : readCombatStatBreakdown(unit, key).value;
    recordPreviewDependency(`unit:${unitId(unit)}:stat:${key}`, result);
    if (key === 'def' || key === 'men' || key === 'agi') {
      recordPreviewDependency(
        `target:${unitId(unit)}:defense`,
        defenseDependencyValue(unit),
      );
    }
    return result;
  }

  function readCombatStatBreakdown(unit = {}, key = '') {
    const aliases = {
      str: ['str', '力量', '攻击'],
      def: ['def', '防御'],
      agi: ['agi', '敏捷'],
      men: ['men_max', '精神力上限', '精神力'],
    };
    const keys = aliases[key] || [key];
    const sourceStats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {};
    const finalStats = unit?.final && typeof unit.final === 'object' ? unit.final : {};
    const directValue = Number(unit?.[keys[0]]);
    const readFirstFinite = sources => {
      for (const source of sources) {
        for (const alias of keys) {
          const value = Number(source?.[alias]);
          if (Number.isFinite(value)) return value;
        }
      }
      return NaN;
    };
    const base = Math.max(
      1,
      (Number.isFinite(directValue) ? directValue : readFirstFinite([unit, sourceStats])) || 1,
    );
    const modifiers = [];
    let calculated = base;
    stateEntries(unit, `STAT:${key}`).forEach(([stateKey, state]) => {
      const source = stateName(state) || String(stateKey || '状态修正').trim();
      const ratio = Number(state?.面板修改比例?.[key] ?? 1);
      const fixed = Number(state?.面板固定修正?.[key] ?? 0);
      if (Number.isFinite(ratio) && Math.abs(ratio - 1) > 1e-9) {
        modifiers.push({ kind: 'multiply', value: ratio, source });
        calculated *= ratio;
      }
      if (Number.isFinite(fixed) && Math.abs(fixed) > 1e-9) {
        modifiers.push({ kind: 'add', value: fixed, source });
        calculated += fixed;
      }
    });
    const staminaScale = Number(
      Object.prototype.hasOwnProperty.call(finalStats, '__体力衰减系数')
        ? finalStats.__体力衰减系数
        : staminaScaleForUnit(unit)
    );
    if (Number.isFinite(staminaScale) && Math.abs(staminaScale - 1) > 1e-9) {
      modifiers.push({ kind: 'multiply', value: staminaScale, source: '低体力衰减' });
      calculated *= staminaScale;
    }
    const finalValue = readFirstFinite([finalStats]);
    const value = Math.max(1, Number.isFinite(finalValue) ? finalValue : calculated);
    if (Math.abs(value - calculated) > 0.51) {
      modifiers.push({ kind: 'override', value, source: '属性快照或运行时规则' });
    }
    return Object.freeze({
      key,
      base,
      value,
      modifiers: Object.freeze(modifiers.map(item => Object.freeze({ ...item }))),
    });
  }

  function listUnits(worldSnapshot = {}) {
    const participants = worldSnapshot?.参战者 && typeof worldSnapshot.参战者 === 'object' ? worldSnapshot.参战者 : {};
    const primary = Object.entries(participants).flatMap(([side, value]) => {
      const units = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
      return units.filter(Boolean).map(unit => ({ unit, side }));
    });
    const summons = worldSnapshot?.召唤单位表 && typeof worldSnapshot.召唤单位表 === 'object'
      ? Object.values(worldSnapshot.召唤单位表).filter(unit => unit && unit.已消散 !== true).map(unit => ({
          unit,
          side: /^(enemy|敌方|对方)$/i.test(String(unit?.阵营 || '').trim()) ? 'team_enemy' : 'team_player',
        }))
      : [];
    const seen = new Set();
    return [...primary, ...summons].filter(entry => {
      const key = unitId(entry.unit) || unitName(entry.unit);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
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

  function isDead(unit = {}) {
    const directHp = Number(unit?.hp);
    return unit?.状态?.存活 === false || (Number.isFinite(directHp) ? directHp <= 0 : readHp(unit) <= 0);
  }

  function isPhysicallyAlive(unit = {}) {
    return !isDead(unit);
  }

  function isBattleCapable(unit = {}) {
    const actionState = String(unit?.状态?.行动 || '').trim();
    const directStamina = Number(unit?.vit);
    const stamina = Number.isFinite(directStamina) ? directStamina : readResource(unit, '体力');
    const capable = !isDead(unit) && stamina > 0 && !/失去战斗力|昏迷|投降|制服/.test(actionState);
    recordPreviewDependency(`unit:${unitId(unit)}:state:__action`, {
      alive: !isDead(unit),
      stamina,
      actionState,
      capable,
    });
    return capable;
  }

  function isSummonUnit(unit = {}) {
    return String(unit?.单位性质 || unit?.类型 || '').trim() === '召唤物' ||
      Boolean(unit?.召唤键 || unit?.__battleRuntime?.summonWindow);
  }

  function isAlive(unit = {}) {
    return isBattleCapable(unit);
  }

  function fusionSkillMetadata(unit = {}, skill = {}) {
    if (unit && typeof unit === 'object' && skill && typeof skill === 'object') {
      let bySkill = fusionMetadataCache.get(unit);
      if (!bySkill) {
        bySkill = new WeakMap();
        fusionMetadataCache.set(unit, bySkill);
      }
      if (bySkill.has(skill)) return bySkill.get(skill);
      const result = readFusionSkillMetadata(unit, skill);
      bySkill.set(skill, result);
      return result;
    }
    return readFusionSkillMetadata(unit, skill);
  }

  function readFusionSkillMetadata(unit = {}, skill = {}) {
    const wantedName = String(skill?.name || skill?.魂技名 || skill?.技能名称 || skill?.名称 || '').trim();
    const wantedEffects = effectArrayHash(skill?._效果数组);
    const seen = new Set();
    let found = null;
    const visit = value => {
      if (found || !value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
        const skillData = value?.技能数据;
      if (
        skillData && typeof skillData === 'object' &&
        (value?.融合模式 !== undefined || value?.融合对象 !== undefined || Array.isArray(value?.融合参与者))
      ) {
        const candidateName = String(skillData?.name || skillData?.魂技名 || skillData?.技能名称 || skillData?.名称 || '').trim();
        const candidateEffects = effectArrayHash(skillData?._效果数组);
        if (
          skillData === skill ||
          (
            wantedName && candidateName === wantedName &&
            (!wantedEffects || !candidateEffects || wantedEffects === candidateEffects)
          )
        ) {
          found = {
            name: candidateName || wantedName,
            mode: String(value?.融合模式 || 'partner').trim().toLowerCase(),
            usageMode: String(value?.用法模式 || value?.融合用法 || '').trim(),
            partnerName: String(value?.融合对象 || '').trim(),
            participants: cloneValue(Array.isArray(value?.融合参与者) ? value.融合参与者 : []),
          };
          return;
        }
      }
      Object.entries(value).forEach(([key, child]) => {
        if (/状态效果|战斗历史|历史快照|参战者|复制效果|__battleRuntime|__行动闭环诊断/.test(key)) return;
        visit(child);
      });
    };
    visit(unit);
    return found;
  }

  function fusionParticipantIdentifiers(participant = {}) {
    if (typeof participant === 'string') return [participant.trim()].filter(Boolean);
    return [
      participant?.角色键,
      participant?.角色名,
      participant?.id,
      participant?.name,
      participant?.名称,
    ].map(value => String(value || '').trim()).filter(Boolean);
  }

  function resolveFusionAction(worldSnapshot = {}, actor = {}, skill = {}, options = {}) {
    const metadata = fusionSkillMetadata(actor, skill);
    if (!metadata) {
      return Object.freeze({
        required: false,
        valid: true,
        reason: '',
        fusionKey: '',
        participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
        partnerIds: Object.freeze([]),
        participants: Object.freeze([actor].filter(Boolean)),
        partners: Object.freeze([]),
        usageMode: '',
      });
    }
    const actorSide = sideOf(worldSnapshot, actor);
    const actorIdentity = new Set([unitId(actor), unitName(actor)].filter(Boolean));
    const participantRefs = metadata.participants.length
      ? metadata.participants
      : (metadata.partnerName ? [{ 类型: '搭档', 角色名: metadata.partnerName }] : []);
    const partnerRefs = participantRefs.filter(participant => {
      const role = String(participant?.类型 || '').trim();
      const identifiers = fusionParticipantIdentifiers(participant);
      return !/自身|self/i.test(role) && !identifiers.some(identifier => actorIdentity.has(identifier));
    });
    if (!partnerRefs.length && metadata.mode !== 'self') {
      return Object.freeze({
        required: true,
        valid: false,
        reason: 'FUSION_PARTNER_UNDECLARED',
        fusionKey: '',
        participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
        partnerIds: Object.freeze([]),
        participants: Object.freeze([actor].filter(Boolean)),
        partners: Object.freeze([]),
        usageMode: metadata.usageMode,
      });
    }
    const partners = [];
    for (const participant of partnerRefs) {
      const identifiers = fusionParticipantIdentifiers(participant);
      const partner = listUnits(worldSnapshot).find(entry => {
        const ids = [unitId(entry.unit), unitName(entry.unit)].filter(Boolean);
        return identifiers.some(identifier => ids.includes(identifier));
      })?.unit || null;
      if (!partner) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_MISSING',
          fusionKey: '',
          participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
          partnerIds: Object.freeze([]),
          participants: Object.freeze([actor].filter(Boolean)),
          partners: Object.freeze([]),
          usageMode: metadata.usageMode,
        });
      }
      if (sideOf(worldSnapshot, partner) !== actorSide) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_HOSTILE',
          fusionKey: '',
          participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
          partnerIds: Object.freeze([]),
          participants: Object.freeze([actor].filter(Boolean)),
          partners: Object.freeze([]),
          usageMode: metadata.usageMode,
        });
      }
      if (!isBattleCapable(partner)) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_UNAVAILABLE',
          fusionKey: '',
          participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
          partnerIds: Object.freeze([]),
          participants: Object.freeze([actor].filter(Boolean)),
          partners: Object.freeze([]),
          usageMode: metadata.usageMode,
        });
      }
      if (!partners.some(existing => unitId(existing) === unitId(partner))) partners.push(partner);
    }
    const participantIds = [...new Set([unitId(actor), ...partners.map(unitId)].filter(Boolean))];
    const fusionKey = `${metadata.name || 'fusion'}:${[...participantIds].sort().join('+')}`;
    const oneUse = /一次|single|once/i.test(metadata.usageMode);
    if (oneUse && [actor, ...partners].some(participant =>
      (Array.isArray(participant?.__battleRuntime?.fusionUsageKeys)
        ? participant.__battleRuntime.fusionUsageKeys
        : []
      ).map(String).includes(fusionKey)
    )) {
      return Object.freeze({
        required: true,
        valid: false,
        reason: 'FUSION_ALREADY_USED',
        fusionKey,
        participantIds: Object.freeze(participantIds),
        partnerIds: Object.freeze(partners.map(unitId)),
        participants: Object.freeze([actor, ...partners]),
        partners: Object.freeze(partners),
        usageMode: metadata.usageMode,
      });
    }
    if (options?.requirePendingOpportunity !== false) {
      const round = Math.max(0, Number(worldSnapshot?.回合 || 0));
      const unavailable = partners.find(partner => {
        const opportunity = partner?.__battleRuntime?.naturalOpportunity;
        return !opportunity ||
          Number(opportunity?.round || 0) !== round ||
          String(opportunity?.status || '').trim() !== 'PENDING';
      });
      if (unavailable) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_OPPORTUNITY_UNAVAILABLE',
          fusionKey,
          participantIds: Object.freeze(participantIds),
          partnerIds: Object.freeze(partners.map(unitId)),
          participants: Object.freeze([actor, ...partners]),
          partners: Object.freeze(partners),
          usageMode: metadata.usageMode,
        });
      }
    }
    if (options?.ignoreResourceAvailability !== true) {
      const resourceCosts = options?.resourceCosts && typeof options.resourceCosts === 'object'
        ? options.resourceCosts
        : {};
      for (const participant of [actor, ...partners]) {
        for (const [resource, rawCost] of Object.entries(resourceCosts)) {
          const maximum = readResourceMax(participant, resource);
          const text = String(rawCost ?? '').trim();
          const numeric = Math.max(0, Number.parseFloat(text) || 0);
          const cost = text.includes('%') ? maximum * numeric / 100 : numeric;
          if (readResource(participant, resource) + 1e-9 < cost) {
            return Object.freeze({
              required: true,
              valid: false,
              reason: 'FUSION_PARTNER_RESOURCE_INSUFFICIENT',
              fusionKey,
              participantIds: Object.freeze(participantIds),
              partnerIds: Object.freeze(partners.map(unitId)),
              participants: Object.freeze([actor, ...partners]),
              partners: Object.freeze(partners),
              usageMode: metadata.usageMode,
            });
          }
        }
      }
    }
    return Object.freeze({
      required: true,
      valid: true,
      reason: '',
      fusionKey,
      participantIds: Object.freeze(participantIds),
      partnerIds: Object.freeze(partners.map(unitId)),
      participants: Object.freeze([actor, ...partners]),
      partners: Object.freeze(partners),
      usageMode: metadata.usageMode,
    });
  }

  function shouldTriggerTraumaUnconscious(damage = 0, hpAfter = 0, hpMax = 1) {
    const safeMax = Math.max(1, Number(hpMax || 1));
    return Number(hpAfter || 0) > 0 && Number(damage || 0) / safeMax >= 0.5 - 1e-9 && Number(hpAfter || 0) / safeMax < 0.2 - 1e-9;
  }

  function naturalActionOrderProfile(unit = {}) {
    const typePriority = { 辅助系: 1, 控制系: 2, 敏攻系: 2, 强攻系: 2, 精神系: 2, 元素系: 2, 防御系: 3, 治疗系: 3, 食物系: 3 };
    const type = String(unit?.type || unit?.系别 || unit?.属性?.系别 || '').trim();
    const baseAgility = Math.max(0, readCombatStat(unit, 'agi'));
    const speedModifier = stateEntries(unit, 'ACTION_ORDER').reduce((total, [, state]) => {
      const effects = state?.战斗效果 || state?.计算层效果 || {};
      const probability = clamp(Number(state?.__previewApplicationProbability ?? 1), 0, 1);
      return total +
        Number(effects?.cast_speed_bonus || 0) * probability -
        Number(effects?.cast_speed_penalty || 0) * probability;
    }, 0);
    return Object.freeze({
      type,
      typePriority: Number(typePriority[type] || 4),
      baseAgility,
      speedModifier,
      effectiveAgility: baseAgility * clamp(1 + speedModifier, 0.1, 2),
    });
  }

  function compareNaturalActionOrder(left = {}, right = {}) {
    const leftProfile = naturalActionOrderProfile(left);
    const rightProfile = naturalActionOrderProfile(right);
    const priorityDelta = leftProfile.typePriority - rightProfile.typePriority;
    if (priorityDelta) return priorityDelta;
    const agilityDelta = rightProfile.effectiveAgility - leftProfile.effectiveAgility;
    if (agilityDelta) return agilityDelta;
    return 0;
  }

  function normalizeObjectiveSide(value = '') {
    const text = String(value || '').trim().toUpperCase();
    if (/^(PLAYER|ALLY|OWN|我方|己方|友方)$/.test(text)) return 'PLAYER';
    if (/^(ENEMY|HOSTILE|敌方|对方)$/.test(text)) return 'ENEMY';
    return '';
  }

  function objectiveSideOfEntry(entry = {}) {
    return /player|玩家|我方|己方|友方/i.test(String(entry?.side || '')) ? 'PLAYER' : 'ENEMY';
  }

  function normalizeObjectiveCondition(condition = {}) {
    if (!condition || typeof condition !== 'object') return null;
    const typeAliases = {
      敌方全员失能: 'TEAM_INCAPACITATED',
      我方全员失能: 'TEAM_INCAPACITATED',
      全员失能: 'TEAM_INCAPACITATED',
      生命阈值: 'HP_RATIO_AT_OR_BELOW',
      坚持回合: 'ROUND_REACHED',
      指定单位受伤: 'UNIT_DAMAGED',
      指定单位失能: 'UNIT_INCAPACITATED',
      指定单位死亡: 'UNIT_DEAD',
      全员死亡: 'TEAM_DEAD',
      敌方全员死亡: 'TEAM_DEAD',
      我方全员死亡: 'TEAM_DEAD',
      成功撤离: 'WITHDRAW_SUCCESS',
    };
    const rawType = String(condition.type || condition.类型 || '').trim();
    const type = String(typeAliases[rawType] || rawType).trim().toUpperCase();
    if (!['TEAM_INCAPACITATED', 'TEAM_DEAD', 'HP_RATIO_AT_OR_BELOW', 'ROUND_REACHED', 'UNIT_DAMAGED', 'UNIT_INCAPACITATED', 'UNIT_DEAD', 'WITHDRAW_SUCCESS'].includes(type)) return null;
    const inferredSide = rawType.startsWith('我方') ? 'PLAYER' : rawType.startsWith('敌方') ? 'ENEMY' : '';
    const side = normalizeObjectiveSide(condition.side || condition.阵营 || inferredSide);
    const targetSource = condition.targetIds || condition.目标 || condition.targets || [];
    const targetIds = (Array.isArray(targetSource) ? targetSource : String(targetSource || '').split(/[、,，]/u))
      .map(item => String(item || '').trim())
      .filter(item => item && !/^(全体|全员|ALL)$/i.test(item));
    const thresholdRaw = condition.threshold ?? condition.thresholdRatio ?? condition.阈值 ?? 0;
    const thresholdNumber = Number.parseFloat(String(thresholdRaw).replace('%', ''));
    const threshold = Number.isFinite(thresholdNumber)
      ? clamp(String(thresholdRaw).includes('%') || thresholdNumber > 1 ? thresholdNumber / 100 : thresholdNumber, 0, 1)
      : 0;
    const round = Math.max(0, Math.floor(Number(condition.round ?? condition.rounds ?? condition.回合 ?? condition.回合数 ?? 0)));
    const baselineHp = condition.baselineHp && typeof condition.baselineHp === 'object'
      ? Object.fromEntries(Object.entries(condition.baselineHp).map(([key, value]) => [String(key), Math.max(0, Number(value) || 0)]))
      : {};
    return Object.freeze({
      type,
      side,
      targetIds: Object.freeze(targetIds),
      scope: /^(ALL|全部|全体)$/i.test(String(condition.scope || condition.判定 || (['TEAM_INCAPACITATED', 'TEAM_DEAD'].includes(type) ? 'ALL' : 'ANY')).trim()) ? 'ALL' : 'ANY',
      threshold,
      round,
      requireActive: condition.requireActive !== false && condition.存活要求 !== false,
      baselineHp: Object.freeze(baselineHp),
    });
  }

  function normalizeObjectiveGroup(group = {}, fallbackConditions = []) {
    const source = Array.isArray(group) ? group : Array.isArray(group?.conditions) ? group.conditions : Array.isArray(group?.条件) ? group.条件 : fallbackConditions;
    const conditions = source.map(normalizeObjectiveCondition).filter(Boolean);
    return Object.freeze({
      logic: /^(AND|ALL|全部|同时)$/i.test(String(group?.logic || group?.逻辑 || 'ANY').trim()) ? 'ALL' : 'ANY',
      conditions: Object.freeze(conditions),
    });
  }

  function freezeObjectiveTargetIds(group = {}, worldSnapshot = {}) {
    return Object.freeze({
      ...group,
      conditions: Object.freeze((group.conditions || []).map(condition => {
        if (
          (condition.targetIds || []).length ||
          condition.type === 'WITHDRAW_SUCCESS'
        ) {
          return condition;
        }
        const targetIds = listUnits(worldSnapshot)
          .filter(entry =>
            !condition.side ||
            objectiveSideOfEntry(entry) === condition.side
          )
          .map(entry => entry.unit)
          .filter(unit => !isSummonUnit(unit))
          .map(unit => unitId(unit))
          .filter(Boolean);
        return Object.freeze({
          ...condition,
          targetIds: Object.freeze(targetIds),
        });
      })),
    });
  }

  function normalizeBattleObjectives(raw = {}, worldSnapshot = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const currentRound = Math.max(0, Math.floor(Number(worldSnapshot?.回合 || 0)));
    let byRound = normalizedObjectivesCache.get(source);
    if (byRound?.has(currentRound)) return byRound.get(currentRound);
    if (!byRound) {
      byRound = new Map();
      normalizedObjectivesCache.set(source, byRound);
    }
    const explicit = source.explicit === true || source.explicit !== false && Object.keys(source).some(key => !['version', 'explicit'].includes(key));
    const victorySource = source.victory || source.胜利 || {};
    const defeatSource = source.defeat || source.失败 || {};
    const victory = freezeObjectiveTargetIds(
      normalizeObjectiveGroup(victorySource, [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }]),
      worldSnapshot,
    );
    const defeat = freezeObjectiveTargetIds(
      normalizeObjectiveGroup(defeatSource, [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }]),
      worldSnapshot,
    );
    const result = Object.freeze({
      version: 1,
      explicit,
      startRound: Math.max(0, Math.floor(Number(source.startRound ?? source.起始回合 ?? currentRound))),
      maxRounds: Math.max(1, Math.min(20, Math.floor(Number(source.maxRounds ?? source.回合上限 ?? 20) || 20))),
      resolutionPriority: /^(DRAW_ON_CONFLICT|平局)$/i.test(String(source.resolutionPriority || source.冲突处理 || 'DEFEAT_FIRST').trim()) ? 'DRAW_ON_CONFLICT' : 'DEFEAT_FIRST',
      victory,
      defeat,
    });
    byRound.set(currentRound, result);
    return result;
  }

  function buildObjectiveUnitIndex(worldSnapshot = {}) {
    const entries = listUnits(worldSnapshot);
    const byId = new Map();
    const byName = new Map();
    entries.forEach(entry => {
      const id = unitId(entry.unit);
      const name = unitName(entry.unit);
      if (id) byId.set(id, entry);
      if (name) byName.set(name, entry);
    });
    return {
      entries,
      byId,
      byName,
      playerUnits: entries
        .filter(entry =>
          objectiveSideOfEntry(entry) === 'PLAYER' &&
          !isSummonUnit(entry.unit)
        )
        .map(entry => entry.unit),
      enemyUnits: entries
        .filter(entry =>
          objectiveSideOfEntry(entry) === 'ENEMY' &&
          !isSummonUnit(entry.unit)
        )
        .map(entry => entry.unit),
      conditionUnits: new WeakMap(),
    };
  }

  function objectiveUnits(worldSnapshot = {}, condition = {}, unitIndex = null) {
    const targetIds = new Set(condition.targetIds || []);
    const index = unitIndex || buildObjectiveUnitIndex(worldSnapshot);
    const cached = index.conditionUnits?.get(condition);
    if (cached) return cached;
    const entries = targetIds.size
      ? [...new Set([...targetIds].map(targetId =>
          index.byId.get(targetId) || index.byName.get(targetId)
        ).filter(Boolean))]
      : index.entries;
    const units = entries
      .filter(entry =>
        !condition.side ||
        objectiveSideOfEntry(entry) === condition.side
      )
      .map(entry => entry.unit);
    index.conditionUnits?.set(condition, units);
    return units;
  }

  function objectiveUnitState(unit = {}, options = {}) {
    const unitIdValue = unitId(unit);
    const overrides = options?.objectiveStateByUnitId;
    const override = overrides instanceof Map
      ? overrides.get(unitIdValue)
      : overrides && typeof overrides === 'object'
        ? overrides[unitIdValue]
        : null;
    const initialStates = options?.initialObjectiveStateByUnitId;
    const initial = initialStates instanceof Map
      ? initialStates.get(unitIdValue)
      : initialStates && typeof initialStates === 'object'
        ? initialStates[unitIdValue]
        : null;
    const hp = Number.isFinite(Number(override?.hp))
      ? Number(override.hp)
      : Number.isFinite(Number(initial?.hp))
        ? Number(initial.hp)
        : readHp(unit);
    const alive = override?.alive === true
      ? true
      : override?.alive === false
        ? false
        : initial?.alive === true
          ? true
          : initial?.alive === false
            ? false
            : !isDead(unit);
    const capable = override?.capable === true
      ? true
      : override?.capable === false
        ? false
        : initial?.capable === true
          ? true
          : initial?.capable === false
            ? false
            : isBattleCapable(unit);
    return { hp, alive, capable };
  }

  function calculateNonlethalHpFloor(worldSnapshot = {}, target = {}, battleIntent = {}) {
    const mode = String(
      battleIntent?.mode ||
      battleIntent?.intent ||
      battleIntent ||
      worldSnapshot?.战斗意图 ||
      '',
    ).trim();
    if (!/点到为止|切磋|训练|非致命/.test(mode)) return 0;
    const objectives = normalizeBattleObjectives(
      battleIntent?.objectives ||
      battleIntent?.胜负条件 ||
      worldSnapshot?.胜负条件 ||
      {},
      worldSnapshot,
    );
    const thresholds = [
      ...objectives.victory.conditions,
      ...objectives.defeat.conditions,
    ].filter(condition =>
      condition.type === 'HP_RATIO_AT_OR_BELOW' &&
      condition.threshold > 0 &&
      objectiveUnits(worldSnapshot, condition).some(unit => unitId(unit) === unitId(target)),
    ).map(condition => condition.threshold);
    const threshold = thresholds.length ? Math.max(...thresholds) : 0;
    return Math.max(1, Math.floor(readHpMax(target) * threshold));
  }

  function readIncapacityReason(unit = {}) {
    if (isDead(unit)) return 'DEAD';
    if (String(unit?.__战斗失能原因 || '').trim()) return String(unit.__战斗失能原因).trim();
    if (readResource(unit, '体力') <= 0) return 'STAMINA_EXHAUSTED';
    const actionState = String(unit?.状态?.行动 || '').trim();
    if (/昏迷/.test(actionState)) return 'UNCONSCIOUS';
    if (/投降/.test(actionState)) return 'SURRENDERED';
    if (/制服/.test(actionState)) return 'SUBDUED';
    if (/失去战斗力/.test(actionState)) return 'INCAPACITATED';
    return '';
  }

  function evaluateObjectiveConditionCore(
    worldSnapshot = {},
    condition = {},
    options = {},
    includeDetails = false,
  ) {
    if (condition.type === 'WITHDRAW_SUCCESS') {
      const successfulSides = new Set(
        Array.isArray(worldSnapshot?.__battleRuntime?.withdrawalSuccessSides)
          ? worldSnapshot.__battleRuntime.withdrawalSuccessSides.map(value => String(value || '').trim().toUpperCase()).filter(Boolean)
          : [],
      );
      const conditionSide = String(condition.side || '').trim().toUpperCase();
      const matched = conditionSide
        ? successfulSides.has(conditionSide)
        : worldSnapshot?.__battleRuntime?.withdrawalSuccess === true;
      return includeDetails
        ? Object.freeze({
            condition,
            matched,
            unitResults: Object.freeze([]),
            reason: matched ? 'WITHDRAW_SUCCESS' : '',
          })
        : matched;
    }
    if (condition.type === 'ROUND_REACHED') {
      if (options.roundCompleted !== true) {
        return includeDetails
          ? Object.freeze({
              condition,
              matched: false,
              unitResults: Object.freeze([]),
              reason: '',
            })
          : false;
      }
      const elapsedRounds = Math.max(0, Number(options.round ?? worldSnapshot?.回合 ?? 0) - Number(options.startRound || 0));
      if (elapsedRounds < condition.round) {
        return includeDetails
          ? Object.freeze({
              condition,
              matched: false,
              unitResults: Object.freeze([]),
              reason: '',
            })
          : false;
      }
      if (!condition.requireActive) {
        return includeDetails
          ? Object.freeze({
              condition,
              matched: true,
              unitResults: Object.freeze([]),
              reason: 'ROUND_REACHED',
            })
          : true;
      }
      const units = objectiveUnits(
        worldSnapshot,
        condition,
        options.unitIndex,
      );
      if (!includeDetails) {
        return units.length > 0 &&
          units.some(unit => objectiveUnitState(unit, options).capable);
      }
      const unitResults = units.map(unit => {
        const state = objectiveUnitState(unit, options);
        return Object.freeze({
          unitId: unitId(unit),
          unitName: unitName(unit),
          matched: state.capable,
          reason: state.capable ? 'ACTIVE' : readIncapacityReason(unit),
        });
      });
      const matched = unitResults.length > 0 && unitResults.some(result => result.matched);
      return Object.freeze({ condition, matched, unitResults: Object.freeze(unitResults), reason: matched ? 'ROUND_REACHED' : '' });
    }
    const units = objectiveUnits(
      worldSnapshot,
      condition,
      options.unitIndex,
    );
    if (!units.length) {
      return includeDetails
        ? Object.freeze({
            condition,
            matched: false,
            unitResults: Object.freeze([]),
            reason: 'NO_TARGET',
          })
        : false;
    }
    const matchReason = unit => {
      const state = objectiveUnitState(unit, options);
      if (condition.type === 'TEAM_INCAPACITATED' || condition.type === 'UNIT_INCAPACITATED') {
        return !state.capable
          ? !state.alive || state.hp <= 0
            ? 'DEAD'
            : readIncapacityReason(unit) || 'INCAPACITATED'
          : '';
      }
      if (condition.type === 'TEAM_DEAD' || condition.type === 'UNIT_DEAD') {
        return !state.alive || state.hp <= 0 ? 'DEAD' : '';
      }
      if (condition.type === 'HP_RATIO_AT_OR_BELOW') {
        return state.hp / Math.max(1, readHpMax(unit)) <=
          condition.threshold + 1e-9
          ? 'HP_THRESHOLD_REACHED'
          : '';
      }
      if (condition.type === 'UNIT_DAMAGED') {
        const baseline = Number(condition.baselineHp?.[unitId(unit)] ?? condition.baselineHp?.[unitName(unit)] ?? readHpMax(unit));
        return state.hp < Math.max(0, baseline) - 1e-9
          ? 'UNIT_DAMAGED'
          : '';
      }
      return '';
    };
    if (!includeDetails) {
      return condition.scope === 'ALL'
        ? units.every(unit => !!matchReason(unit))
        : units.some(unit => !!matchReason(unit));
    }
    const unitResults = units.map(unit => {
      const reason = matchReason(unit);
      return Object.freeze({
        unitId: unitId(unit),
        unitName: unitName(unit),
        matched: !!reason,
        reason,
      });
    });
    const matched = condition.scope === 'ALL' ? unitResults.every(result => result.matched) : unitResults.some(result => result.matched);
    const reason = matched ? unitResults.find(result => result.matched)?.reason || condition.type : '';
    return Object.freeze({ condition, matched, unitResults: Object.freeze(unitResults), reason });
  }

  function evaluateObjectiveConditionDetail(worldSnapshot = {}, condition = {}, options = {}) {
    return evaluateObjectiveConditionCore(
      worldSnapshot,
      condition,
      options,
      true,
    );
  }

  function evaluateObjectiveCondition(worldSnapshot = {}, condition = {}, options = {}) {
    return evaluateObjectiveConditionCore(
      worldSnapshot,
      condition,
      options,
      false,
    );
  }

  function evaluateBattleObjectivesCore(
    worldSnapshot = {},
    rawObjectives = {},
    options = {},
    includeDetails = true,
  ) {
    const objectives = options?.objectivesAlreadyNormalized === true
      ? rawObjectives
      : normalizeBattleObjectives(rawObjectives, worldSnapshot);
    const unitIndex = options?.unitIndex || buildObjectiveUnitIndex(worldSnapshot);
    const evaluateGroup = group => {
      const conditionOptions = {
        ...options,
        startRound: objectives.startRound,
        unitIndex,
      };
      const details = includeDetails
        ? group.conditions.map(condition =>
            evaluateObjectiveConditionDetail(
              worldSnapshot,
              condition,
              conditionOptions,
            )
          )
        : [];
      const matches = includeDetails
        ? details.map(detail => detail.matched)
        : group.conditions.map(condition =>
            evaluateObjectiveCondition(
              worldSnapshot,
              condition,
              conditionOptions,
            )
          );
      return {
        matched: matches.length > 0 && (group.logic === 'ALL' ? matches.every(Boolean) : matches.some(Boolean)),
        matches,
        details,
      };
    };
    const victory = evaluateGroup(objectives.victory);
    const defeat = evaluateGroup(objectives.defeat);
    const playerExhausted = includeDetails &&
      unitIndex.playerUnits.length > 0 &&
      unitIndex.playerUnits.every(unit => !objectiveUnitState(unit, options).capable);
    const enemyExhausted = includeDetails &&
      unitIndex.enemyUnits.length > 0 &&
      unitIndex.enemyUnits.every(unit => !objectiveUnitState(unit, options).capable);
    const exhaustionDetail = (side, matched) => Object.freeze({
      condition: Object.freeze({
        type: 'TEAM_INCAPACITATED',
        side,
        targetIds: Object.freeze([]),
        scope: 'ALL',
        implicit: true,
      }),
      matched,
      unitResults: Object.freeze([]),
      reason: matched ? 'BATTLEFIELD_EXHAUSTION' : '',
    });
    const elapsedRounds = Math.max(0, Number(options.round ?? worldSnapshot?.回合 ?? 0) - objectives.startRound);
    const timeLimitReached = options.roundCompleted === true && elapsedRounds >= objectives.maxRounds;
    const implicitVictory = includeDetails
      ? exhaustionDetail('ENEMY', enemyExhausted)
      : null;
    const implicitDefeat = includeDetails
      ? exhaustionDetail('PLAYER', playerExhausted)
      : null;
    const effectiveVictoryMatched = victory.matched;
    const effectiveDefeatMatched = defeat.matched;
    const victoryObjectiveMatched = victory.matched;
    const defeatObjectiveMatched = defeat.matched;
    let status = 'ONGOING';
    if (effectiveVictoryMatched && effectiveDefeatMatched) status = objectives.resolutionPriority === 'DRAW_ON_CONFLICT' ? 'DRAW' : 'ENEMY_WIN';
    else if (effectiveVictoryMatched) status = 'PLAYER_WIN';
    else if (effectiveDefeatMatched) status = 'ENEMY_WIN';
    else if (timeLimitReached) status = 'DRAW';
    const exhaustionResolution = includeDetails && (enemyExhausted || playerExhausted)
      ? Object.freeze({
          playerExhausted,
          enemyExhausted,
          victory: implicitVictory,
          defeat: implicitDefeat,
        })
      : null;
    const resolvedVictoryDetails = victory.details;
    const resolvedDefeatDetails = defeat.details;
    const result = {
      status,
      winner: status === 'PLAYER_WIN' ? 'player' : status === 'ENEMY_WIN' ? 'enemy' : status === 'DRAW' ? 'draw' : 'unfinished',
      terminal: status !== 'ONGOING',
      victoryMatches: Object.freeze(victory.matches),
      defeatMatches: Object.freeze(defeat.matches),
      victoryDetails: Object.freeze(resolvedVictoryDetails),
      defeatDetails: Object.freeze(resolvedDefeatDetails),
      matchedDetails: Object.freeze((status === 'PLAYER_WIN' ? resolvedVictoryDetails : status === 'ENEMY_WIN' ? resolvedDefeatDetails : [...resolvedVictoryDetails, ...resolvedDefeatDetails]).filter(detail => detail.matched)),
      timeLimitReached,
      terminalReason: victoryObjectiveMatched && defeatObjectiveMatched
        ? 'OBJECTIVE_CONFLICT'
        : victoryObjectiveMatched
          ? 'OBJECTIVE_VICTORY'
          : defeatObjectiveMatched
            ? 'OBJECTIVE_DEFEAT'
            : timeLimitReached ? 'ROUND_LIMIT_REACHED' : '',
      exhaustionResolution,
      objectives,
    };
    return Object.freeze(includeDetails
      ? result
      : {
          status: result.status,
          winner: result.winner,
          terminal: result.terminal,
          timeLimitReached: result.timeLimitReached,
          terminalReason: result.terminalReason,
          objectives,
        });
  }

  function evaluateBattleObjectives(worldSnapshot = {}, rawObjectives = {}, options = {}) {
    return evaluateBattleObjectivesCore(
      worldSnapshot,
      rawObjectives,
      options,
      true,
    );
  }

  function evaluateBattleObjectivesCompact(worldSnapshot = {}, rawObjectives = {}, options = {}) {
    return evaluateBattleObjectivesCore(
      worldSnapshot,
      rawObjectives,
      options,
      false,
    );
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

  function resourceDriveScale(actor = {}, target = {}, resource = '魂力') {
    const actorMax = readResourceMax(actor, resource);
    const targetMax = readResourceMax(target, resource);
    return clamp(Math.pow(Math.max(0.01, actorMax / Math.max(1, targetMax)), 0.45), 0.35, 1.85);
  }

  function calculateBaseDamage(effect = {}, actor = {}, target = {}) {
    const damageClass = classifyDamageType(effect?.伤害类型);
    const power = Math.max(0, Number(effect?.威力倍率 ?? effect?.数值 ?? 0));
    const attack = damageClass === 'MENTAL' ? readCombatStat(actor, 'men') : readCombatStat(actor, 'str');
    const rawDefense = damageClass === 'MENTAL'
      ? Math.max(1, readCombatStat(target, 'men'))
      : Math.max(1, readCombatStat(target, 'def'));
    const penetration = Math.max(0, Number(effect?.防穿 ?? effect?.穿透 ?? effect?.防御穿透 ?? 0));
    const defense = Math.max(1, rawDefense - penetration);
    const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 ?? effect?.段数 ?? 1)));
    const powerRatio = power / 100;
    let total = 0;
    if (damageClass === 'TRUE') {
      total = attack * powerRatio * 0.4;
    } else {
      const mitigation = attack / Math.max(1, attack + defense);
      total = attack * powerRatio * mitigation * 0.4 *
        resourceDriveScale(actor, target, damageClass === 'MENTAL' ? '精神力' : '魂力');
    }
    const actorMultiplier = stateEntries(actor, 'OUTGOING_DAMAGE').reduce((multiplier, [, state]) => {
      const combatEffect = state?.战斗效果 || {};
      return multiplier *
        Math.max(0, Number(combatEffect?.final_damage_mult ?? 1)) *
        Math.max(0, 1 + Number(combatEffect?.damage_bonus || combatEffect?.final_damage_bonus || 0));
    }, 1);
    const targetMultiplier = stateEntries(target, 'INCOMING_DAMAGE').reduce((multiplier, [, state]) => {
      const combatEffect = state?.战斗效果 || {};
      return multiplier *
        Math.max(0, Number(combatEffect?.received_damage_mult ?? 1)) *
        Math.max(0, 1 - clamp(Number(combatEffect?.damage_reduction || 0), 0, 1));
    }, 1);
    const perSegment = total * actorMultiplier * targetMultiplier / segments;
    return Math.max(0, perSegment * segments);
  }

  function calculateSettledSegmentDamage(totalDamage = 0, segments = 1, damageMultiplier = 1) {
    const segmentCount = Math.max(1, Math.floor(Number(segments || 1)));
    const multiplier = clamp(Number(damageMultiplier ?? 1), 0, 1);
    return Math.max(0, Math.round(Math.max(0, Number(totalDamage || 0)) / segmentCount * multiplier));
  }

  function expectedSegmentedDamageOutcome(input = {}) {
    const segmentCount = Math.max(1, Math.floor(Number(input.segments || 1)));
    const hitProbability = clamp(Number(input.hitProbability ?? 1), 0, 1);
    const applicationProbability = clamp(Number(input.applicationProbability ?? 1), 0, 1);
    const perSegmentDamage = Math.max(0, Number(input.perSegmentDamage || 0));
    const shieldBefore = Math.max(0, Number(input.shieldBefore || 0));
    const hpDamageLimit = Math.max(0, Number(input.hpDamageLimit || 0));
    const incomingLimit = shieldBefore + hpDamageLimit;
    const outcomeForHits = hitCount => {
      const incoming = Math.min(incomingLimit, perSegmentDamage * hitCount);
      const shieldAbsorb = Math.min(shieldBefore, incoming);
      return {
        incoming,
        shieldAbsorb,
        hpDamage: Math.min(hpDamageLimit, Math.max(0, incoming - shieldAbsorb)),
      };
    };
    const branchByOutcome = new Map();
    const addBranch = (probability, hitCount, outcome) => {
      if (!(probability > 1e-15)) return;
      const key = [
        Number(outcome.incoming.toFixed(10)),
        Number(outcome.shieldAbsorb.toFixed(10)),
        Number(outcome.hpDamage.toFixed(10)),
      ].join('|');
      const current = branchByOutcome.get(key);
      if (current) {
        current.probability += probability;
        current.hitCounts.push(hitCount);
        return;
      }
      branchByOutcome.set(key, {
        probability,
        hitCounts: [hitCount],
        incoming: outcome.incoming,
        shieldAbsorb: outcome.shieldAbsorb,
        hpDamage: outcome.hpDamage,
      });
    };
    if (applicationProbability < 1 - 1e-12) {
      addBranch(1 - applicationProbability, 0, outcomeForHits(0));
    }
    if (applicationProbability > 1e-12) {
      if (hitProbability >= 1 - 1e-12) {
        addBranch(applicationProbability, segmentCount, outcomeForHits(segmentCount));
      } else if (hitProbability <= 1e-12) {
        addBranch(applicationProbability, 0, outcomeForHits(0));
      } else {
        let probability = Math.pow(1 - hitProbability, segmentCount);
        for (let hitCount = 0; hitCount <= segmentCount; hitCount += 1) {
          if (hitCount > 0) {
            probability *=
              (segmentCount - hitCount + 1) / hitCount *
              hitProbability / (1 - hitProbability);
          }
          addBranch(applicationProbability * probability, hitCount, outcomeForHits(hitCount));
        }
      }
    }
    const outcomeDistribution = [...branchByOutcome.values()]
      .sort((left, right) =>
        left.hpDamage - right.hpDamage ||
        left.shieldAbsorb - right.shieldAbsorb ||
        left.incoming - right.incoming
      )
      .map((branch, index) => Object.freeze({
        branchKey: `damage:${index}:${branch.hitCounts.join(',')}`,
        probability: branch.probability,
        hitCounts: Object.freeze([...branch.hitCounts]),
        incoming: branch.incoming,
        shieldAbsorb: branch.shieldAbsorb,
        hpDamage: branch.hpDamage,
        delta: -branch.hpDamage,
      }));
    const probabilityTotal = outcomeDistribution.reduce(
      (sum, branch) => sum + Number(branch.probability || 0),
      0,
    );
    if (Math.abs(probabilityTotal - 1) > 1e-9) {
      throw new Error(`battle_preview_damage_distribution_invalid:${probabilityTotal}`);
    }
    const expectedIncoming = outcomeDistribution.reduce(
      (sum, branch) => sum + branch.probability * branch.incoming,
      0,
    );
    const expectedShieldAbsorb = outcomeDistribution.reduce(
      (sum, branch) => sum + branch.probability * branch.shieldAbsorb,
      0,
    );
    const expectedHpDamage = outcomeDistribution.reduce(
      (sum, branch) => sum + branch.probability * branch.hpDamage,
      0,
    );
    const fullHit = outcomeForHits(segmentCount);
    return Object.freeze({
      expectedIncoming,
      expectedShieldAbsorb,
      expectedHpDamage,
      fullHitIncoming: fullHit.incoming,
      fullHitShieldAbsorb: fullHit.shieldAbsorb,
      fullHitHpDamage: fullHit.hpDamage,
      outcomeDistribution: Object.freeze(outcomeDistribution),
    });
  }

  function normalizeEffectProbability(value, fallback = 1) {
    const text = String(value ?? '').trim();
    if (!text) return clamp(Number(fallback || 0), 0, 1);
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return clamp(Number(fallback || 0), 0, 1);
    return clamp(text.includes('%') || Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
  }

  function estimateHitProbability(actor = {}, target = {}, effect = {}) {
    const explicitValue = effect?.命中概率 ?? effect?.触发概率;
    const attackAgility = readCombatStat(actor, 'agi');
    const targetAgility = readCombatStat(target, 'agi');
    const actorEffects = stateEntries(actor, 'OUTGOING_HIT').map(([, state]) => state?.战斗效果 || {});
    const targetEffects = stateEntries(target, 'INCOMING_HIT').map(([, state]) => state?.战斗效果 || {});
    const hitAdjustment = actorEffects.reduce((sum, stateEffect) =>
      sum + Number(stateEffect?.hit_bonus || 0) - Number(stateEffect?.hit_penalty || 0), 0);
    const targetAvoidanceAdjustment = targetEffects.reduce((sum, stateEffect) =>
      sum + Number(stateEffect?.dodge_bonus || 0) -
      Math.max(Number(stateEffect?.dodge_penalty || 0), Number(stateEffect?.lock_level || 0)), 0);
    const hasExplicitProbability = String(explicitValue ?? '').trim() !== '';
    const baseProbability = hasExplicitProbability
      ? normalizeEffectProbability(explicitValue, 1)
      : clamp(
          0.78 +
          (attackAgility - targetAgility) / Math.max(100, attackAgility + targetAgility) * 0.35,
          0.05,
          0.99,
        );
    if (hasExplicitProbability && (baseProbability <= 0 || baseProbability >= 1)) return baseProbability;
    return clamp(
      baseProbability +
      hitAdjustment -
      targetAvoidanceAdjustment,
      hasExplicitProbability ? 0 : 0.05,
      hasExplicitProbability ? 1 : 0.99,
    );
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

  function declarationGrantsCounter(declaration = {}) {
    const skill = declaration?.skill && typeof declaration.skill === 'object'
      ? declaration.skill
      : declaration && typeof declaration === 'object'
        ? declaration
        : {};
    if ([
      skill?.反击授权,
      skill?.授予反击,
      skill?.受击反击,
      skill?.counterGrant,
      skill?.grantsCounter,
    ].some(value => value === true || Number(value) > 0)) return true;
    return collectEffects(skill).some(effect =>
      String(effect?.原型 || '').trim() === '结算修正' &&
      String(effect?.结算 || effect?.结算类型 || '').trim() === '反击'
    );
  }

  function normalizeConditionToken(value = '') {
    const text = String(value ?? '').trim();
    const aliases = {
      玩家: 'PLAYER',
      我方: 'ALLY',
      己方: 'ALLY',
      友方: 'ALLY',
      友军: 'ALLY',
      敌方: 'ENEMY',
      敌对: 'ENEMY',
      敌军: 'ENEMY',
      自身: 'SELF',
      自己: 'SELF',
      常规攻击: 'BASIC_ATTACK',
      普通攻击: 'BASIC_ATTACK',
      基础攻击: 'BASIC_ATTACK',
      魂技: 'RELEASE_SKILL',
      技能: 'RELEASE_SKILL',
      使用物品: 'USE_ITEM',
      物品: 'USE_ITEM',
      防御: 'DEFEND',
      闪避: 'EVADE',
      撤离: 'WITHDRAW',
      换装: 'EQUIP',
      观察: 'OBSERVE',
    };
    return aliases[text] || text.toUpperCase();
  }

  function parseConditionNumber(value, ratio = false) {
    const text = String(value ?? '').trim();
    if (!text) return Number.NaN;
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return Number.NaN;
    if (ratio && text.includes('%')) return numeric / 100;
    return numeric;
  }

  function compareCondition(actual, expected, comparison = '==', options = {}) {
    const operator = String(comparison || '==').trim();
    const numericActual = Number(actual);
    const numericExpected = Number(expected);
    if (options.numeric === true &&
      Number.isFinite(numericActual) &&
      Number.isFinite(numericExpected)) {
      if (operator === '>') return numericActual > numericExpected;
      if (operator === '>=') return numericActual >= numericExpected;
      if (operator === '<') return numericActual < numericExpected;
      if (operator === '<=') return numericActual <= numericExpected;
      if (operator === '!=') return Math.abs(numericActual - numericExpected) > 1e-9;
      return Math.abs(numericActual - numericExpected) <= 1e-9;
    }
    const left = normalizeConditionToken(actual);
    const right = normalizeConditionToken(expected);
    if (operator === '有') return right ? left.includes(right) : options.present === true;
    if (operator === '无') return right ? !left.includes(right) : options.present === false;
    if (operator === '包含') return left.includes(right);
    if (operator === '不包含') return !left.includes(right);
    if (operator === '!=') return left !== right;
    return left === right;
  }

  function conditionSubject(condition = {}, actor = {}, target = {}, context = {}) {
    const subject = String(condition?.对象 || '目标').trim();
    if (['自身', '施术者', '使用者'].includes(subject)) return actor;
    if (subject === '制作者') {
      const creatorId = String(
        context?.declaration?.creatorId ||
        context?.declaration?.producerId ||
        context?.declaration?.skill?.制作者ID ||
        context?.declaration?.skill?.制作者 ||
        ''
      ).trim();
      return creatorId ? findUnit(context?.worldSnapshot || {}, creatorId) : null;
    }
    if (subject === '召唤物') {
      if (isSummonUnit(target)) return target;
      if (isSummonUnit(actor)) return actor;
      return null;
    }
    return target;
  }

  function unitConditionText(unit = {}) {
    return [
      unitId(unit),
      unitName(unit),
      unit?.类型,
      unit?.单位类型,
      unit?.种族,
      unit?.阵营,
      unit?.系别,
      unit?.武魂类型,
      unit?.描述,
      unit?.摘要,
    ].map(value => String(value || '').trim()).filter(Boolean).join('|');
  }

  function equipmentConditionText(unit = {}) {
    const equipment = [
      unit?.装备,
      unit?.已装备,
      unit?.装备栏,
      unit?.__battleRuntime?.equippedDecisionItem,
    ];
    return JSON.stringify(equipment);
  }

  function conditionMatches(
    condition = {},
    worldSnapshot = {},
    actor = {},
    target = {},
    context = {},
  ) {
    const type = String(condition?.类型 || '').trim();
    const comparison = String(condition?.比较 || '==').trim();
    const expected = condition?.值 ?? condition?.状态 ?? '';
    const subject = conditionSubject(
      condition,
      actor,
      target,
      { ...context, worldSnapshot },
    );
    if (type === '时间') {
      const actual = String(
        worldSnapshot?.时间段 ||
        worldSnapshot?.时间 ||
        worldSnapshot?.环境?.时间段 ||
        actor?.时间段 ||
        actor?.时间 ||
        '白天'
      ).trim();
      return compareCondition(actual, expected, comparison);
    }
    if (type === '目标') {
      if (!subject) return comparison === '无' || comparison === '!=';
      const actorId = unitId(actor);
      const subjectId = unitId(subject);
      const relation = actorId && subjectId && actorId === subjectId
        ? 'SELF|ALLY'
        : sideOf(worldSnapshot, subject) === sideOf(worldSnapshot, actor)
          ? 'ALLY'
          : 'ENEMY';
      return compareCondition(relation, expected, comparison, { present: true });
    }
    if (type === '当前行动') {
      const actionKind = String(context?.declaration?.actionKind || '').trim();
      const actionName = String(
        context?.declaration?.skill?.魂技名 ||
        context?.declaration?.skill?.name ||
        context?.declaration?.actionName ||
        ''
      ).trim();
      return compareCondition(
        `${normalizeConditionToken(actionKind)}|${normalizeConditionToken(actionName)}`,
        expected,
        comparison === '==' ? '包含' : comparison === '!=' ? '不包含' : comparison,
      );
    }
    if (type === '命中' || type === '被闪避') {
      const outcome = String(context?.primaryOutcome || '').trim().toUpperCase();
      const probability = Number(
        type === '命中'
          ? context?.primarySuccessProbability
          : context?.primaryEvadeProbability
      );
      if (
        !outcome &&
        Number.isFinite(probability) &&
        probability > 1e-9 &&
        probability < 1 - 1e-9
      ) {
        throw new Error(`battle_preview_conditional_probability_unresolved:${type}`);
      }
      const present = type === '命中'
        ? outcome === 'HIT' ||
          context?.primarySucceeded === true ||
          probability >= 1 - 1e-9
        : outcome === 'EVADED' ||
          context?.primaryEvaded === true ||
          probability >= 1 - 1e-9;
      return compareCondition(present ? type : '', type, comparison, { present });
    }
    if (!subject) return comparison === '无' || comparison === '!=';
    if (type === '状态存在') {
      const state = String(condition?.状态 || expected || '').trim();
      const present = stateEntries(subject, 'CONDITION').some(([key, entry]) =>
        [key, stateName(entry)].some(value =>
          normalizeConditionToken(value) === normalizeConditionToken(state)
        )
      );
      return compareCondition(present ? state : '', state, comparison, { present });
    }
    if (type === '护盾') {
      const present = readShield(subject) > 1e-9;
      return compareCondition(present ? '护盾' : '', '护盾', comparison, { present });
    }
    const resourceMatch = /^(生命|体力|魂力|精神力)(比例|数值)$/.exec(type);
    if (resourceMatch) {
      const resource = resourceMatch[1];
      const ratio = resourceMatch[2] === '比例';
      const current = resource === '生命'
        ? readHp(subject)
        : readResource(subject, resource);
      const maximum = resource === '生命'
        ? readHpMax(subject)
        : readResourceMax(subject, resource);
      const actual = ratio ? current / Math.max(1, maximum) : current;
      return compareCondition(
        actual,
        parseConditionNumber(expected, ratio),
        comparison,
        { numeric: true },
      );
    }
    if (type === '环境满足') {
      const environment = JSON.stringify(
        worldSnapshot?.环境 ||
        worldSnapshot?.战斗环境 ||
        worldSnapshot?.场地 ||
        ''
      );
      return compareCondition(environment, expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '装备状态') {
      const equipment = equipmentConditionText(subject);
      return compareCondition(equipment, expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '自身状态') {
      const actionState = String(subject?.状态?.行动 || subject?.状态 || '').trim();
      const present = normalizeConditionToken(actionState).includes(normalizeConditionToken(expected)) ||
        stateEntries(subject, 'CONDITION').some(([key, entry]) =>
          [key, stateName(entry)].some(value =>
            normalizeConditionToken(value).includes(normalizeConditionToken(expected))
          )
        );
      return compareCondition(present ? expected : '', expected, comparison, { present });
    }
    if (type === '使用者') {
      const creatorId = String(
        context?.declaration?.creatorId ||
        context?.declaration?.producerId ||
        context?.declaration?.skill?.制作者ID ||
        context?.declaration?.skill?.制作者 ||
        ''
      ).trim();
      const expectedToken = normalizeConditionToken(expected);
      const actual = expectedToken === '制作者'.toUpperCase()
        ? unitId(actor) === creatorId || unitName(actor) === creatorId
          ? '制作者'
          : '其他使用者'
        : unitConditionText(subject);
      return compareCondition(actual, expected, comparison);
    }
    if (type === '连携前提') {
      const fusion = [
        context?.declaration?.fusionKey,
        ...(context?.declaration?.fusionParticipantIds || []),
        context?.declaration?.skill?.连携前提,
      ].map(value => String(value || '').trim()).filter(Boolean).join('|');
      return compareCondition(fusion, expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '单位文本') {
      return compareCondition(
        unitConditionText(subject),
        expected,
        comparison === '==' ? '包含' : comparison,
      );
    }
    return compareCondition(
      unitConditionText(subject),
      type || expected,
      comparison,
      {
        present: normalizeConditionToken(unitConditionText(subject))
          .includes(normalizeConditionToken(type || expected)),
      },
    );
  }

  function effectConditionEnabled(
    effect = {},
    worldSnapshot = {},
    actor = {},
    target = {},
    context = {},
  ) {
    return resolveConditionalEffectPlan(
      effect,
      worldSnapshot,
      actor,
      target,
      context,
    ).length > 0;
  }

  function resolveConditionalEffectPlan(
    effect = {},
    worldSnapshot = {},
    actor = {},
    target = {},
    context = {},
  ) {
    const branches = Array.isArray(effect?.条件分支) ? effect.条件分支 : [];
    if (!branches.length) {
      return Object.freeze([Object.freeze({
        effect,
        mode: 'ORIGINAL',
        branchIndex: -1,
        nestedIndex: 0,
      })]);
    }
    const branchMatches = branch => {
      const conditions = Array.isArray(branch?.条件) ? branch.条件 : [];
      return conditions.length > 0 && conditions.every(condition =>
        conditionMatches(condition, worldSnapshot, actor, target, context)
      );
    };
    const matched = branches
      .map((branch, branchIndex) => ({ branch, branchIndex }))
      .filter(({ branch }) => branchMatches(branch));
    if (matched.some(({ branch }) => String(branch?.处理 || '').trim() === '禁用')) {
      return Object.freeze([]);
    }
    const enablingBranches = branches.filter(branch =>
      String(branch?.处理 || '').trim() === '生效'
    );
    if (
      enablingBranches.length &&
      !matched.some(({ branch }) => String(branch?.处理 || '').trim() === '生效')
    ) {
      return Object.freeze([]);
    }
    const replacement = matched.find(({ branch }) =>
      String(branch?.处理 || '').trim() === '替换效果'
    );
    const parentEffect = { ...effect };
    delete parentEffect.条件分支;
    const plan = replacement
      ? (Array.isArray(replacement.branch?.替换效果)
          ? replacement.branch.替换效果
          : [])
          .map((nested, nestedIndex) => ({
            effect: nested,
            mode: 'REPLACE',
            branchIndex: replacement.branchIndex,
            nestedIndex,
          }))
      : [{
          effect: parentEffect,
          mode: 'ORIGINAL',
          branchIndex: -1,
          nestedIndex: 0,
        }];
    matched
      .filter(({ branch }) => String(branch?.处理 || '').trim() === '追加效果')
      .forEach(({ branch, branchIndex }) => {
        (Array.isArray(branch?.追加效果) ? branch.追加效果 : []).forEach(
          (nested, nestedIndex) => {
            plan.push({
              effect: nested,
              mode: 'APPEND',
              branchIndex,
              nestedIndex,
            });
          },
        );
      });
    return Object.freeze(plan.map(entry => Object.freeze(entry)));
  }

  function validateEffect(effect = {}) {
    const prototype = String(effect?.原型 || '').trim();
    const definition = prototypeRegistry[prototype];
    if (!definition) throw new Error(`battle_preview_unknown_prototype:${prototype}`);
    if (nonBattlePrototypes.has(prototype)) throw new Error(`battle_preview_non_battle_prototype:${prototype}`);
    if (!battlePrototypes.has(prototype)) throw new Error(`battle_preview_prototype_not_implemented:${prototype}`);
    (definition?.必填字段 || []).forEach(field => {
      const value = effect[field];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
        throw new Error(`battle_preview_required_field_missing:${prototype}:${field}`);
      }
    });
    Object.entries(definition?.字段定义 || {}).forEach(([field, fieldDefinition]) => {
      if (effect[field] === undefined || !Array.isArray(fieldDefinition?.选项) || !fieldDefinition.选项.length) return;
      const values = Array.isArray(effect[field]) ? effect[field] : [effect[field]];
      values.forEach(value => {
        const normalized = String(value ?? '').trim();
        if (normalized && !fieldDefinition.选项.includes(normalized)) {
          throw new Error(`battle_preview_unknown_enum:${prototype}:${field}:${normalized}`);
        }
      });
    });
    return definition;
  }

  class PreviewOverlay {
    constructor(baseWorld = {}, baseRevision = '') {
      this.baseWorld = baseWorld;
      this.baseRevision = String(baseRevision || stableHash(baseWorld));
      this.changedUnits = new Map();
      this.changedStates = new Map();
      this.changedResources = new Map();
      this.changedRules = new Map();
      this.createdSummons = new Map();
      this.summonDefinitionHashes = new Map();
      this.scheduledEvents = [];
    }

    readUnit(id) {
      const key = String(id || '').trim();
      return this.changedUnits.get(key) || this.createdSummons.get(key) || findUnit(this.baseWorld, key);
    }

    writeUnit(unit) {
      const id = unitId(unit);
      if (!id) throw new Error('battle_preview_overlay_unit_id_missing');
      this.changedUnits.set(id, unit);
      metrics.overlayWrites += 1;
      return unit;
    }

    writeSummon(unit, definitionHash = '') {
      const id = unitId(unit);
      if (!id) throw new Error('battle_preview_overlay_summon_id_missing');
      const normalizedDefinitionHash = String(definitionHash || stableHash(unit)).trim();
      if (this.createdSummons.has(id)) {
        if (this.summonDefinitionHashes.get(id) !== normalizedDefinitionHash) {
          throw new Error(`SUMMON_PREVIEW_INSTANCE_CONFLICT:${id}`);
        }
        return this.createdSummons.get(id);
      }
      const existing = findUnit(this.baseWorld, id);
      if (existing) {
        if (String(existing?.__definitionHash || '').trim() !== normalizedDefinitionHash) {
          throw new Error(`SUMMON_PREVIEW_INSTANCE_CONFLICT:${id}`);
        }
        return existing;
      }
      this.createdSummons.set(id, unit);
      this.summonDefinitionHashes.set(id, normalizedDefinitionHash);
      metrics.overlayWrites += 1;
      return unit;
    }

    changeSummon(id, mutator) {
      const key = String(id || '').trim();
      const current = this.createdSummons.get(key);
      if (!current) throw new Error(`battle_preview_overlay_created_summon_missing:${key}`);
      const next = cloneUnitForOverlay(current);
      mutator(next);
      this.createdSummons.set(key, next);
      metrics.overlayWrites += 1;
      return next;
    }

    removeSummon(id) {
      const key = String(id || '').trim();
      if (!this.createdSummons.delete(key)) throw new Error(`battle_preview_overlay_created_summon_missing:${key}`);
      this.summonDefinitionHashes.delete(key);
      metrics.overlayWrites += 1;
    }

    changeUnit(id, mutator) {
      const current = this.readUnit(id);
      if (!current) throw new Error(`battle_preview_overlay_unit_missing:${id}`);
      const next = cloneUnitForOverlay(current);
      mutator(next);
      return this.writeUnit(next);
    }

    schedule(event) {
      this.scheduledEvents.push(Object.freeze({ ...event }));
      metrics.overlayWrites += 1;
    }

    writeRule(key, value) {
      const normalized = String(key || '').trim();
      if (!normalized) throw new Error('battle_preview_overlay_rule_key_missing');
      this.changedRules.set(normalized, cloneValue(value));
      metrics.overlayWrites += 1;
    }

    fork() {
      const child = new PreviewOverlay(this.baseWorld, this.baseRevision);
      child.changedUnits = new Map(this.changedUnits);
      child.changedStates = new Map(this.changedStates);
      child.changedResources = new Map(this.changedResources);
      child.changedRules = new Map(this.changedRules);
      child.createdSummons = new Map(this.createdSummons);
      child.summonDefinitionHashes = new Map(this.summonDefinitionHashes);
      child.scheduledEvents = [...this.scheduledEvents];
      return child;
    }

    commitFrom(child) {
      if (!(child instanceof PreviewOverlay) || child.baseWorld !== this.baseWorld) {
        throw new Error('battle_preview_overlay_transaction_mismatch');
      }
      this.changedUnits = child.changedUnits;
      this.changedStates = child.changedStates;
      this.changedResources = child.changedResources;
      this.changedRules = child.changedRules;
      this.createdSummons = child.createdSummons;
      this.summonDefinitionHashes = child.summonDefinitionHashes;
      this.scheduledEvents = child.scheduledEvents;
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
      const snapshot = { ...this.baseWorld, 参战者: nextParticipants };
      const summons = this.baseWorld?.召唤单位表;
      if ((summons && typeof summons === 'object' && Object.keys(summons).length) || this.createdSummons.size) {
        Object.defineProperty(snapshot, '召唤单位表', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: {
            ...Object.fromEntries(Object.entries(summons || {}).map(([key, unit]) => [
              key,
              this.changedUnits.get(unitId(unit)) || unit,
            ])),
            ...Object.fromEntries(this.createdSummons),
          },
        });
      }
      if (this.changedRules.size) {
        Object.defineProperty(snapshot, '__battlePreviewRuleOverlay', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: Object.fromEntries(this.changedRules),
        });
      }
      if (this.scheduledEvents.length) {
        Object.defineProperty(snapshot, '__battlePreviewScheduledEvents', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: [...this.scheduledEvents],
        });
      }
      return snapshot;
    }
  }

  function summonInstanceId(rootActionFingerprint = '', effectInstanceId = '', summonOrdinal = 1) {
    const rootFingerprint = String(rootActionFingerprint || '').trim();
    const effectId = String(effectInstanceId || '').trim();
    const ordinal = Math.max(1, Math.floor(Number(summonOrdinal || 1)));
    if (!rootFingerprint || !effectId) throw new Error('battle_preview_summon_identity_missing');
    return `${rootFingerprint}:${effectId}:${ordinal}`;
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
      const evidence = input.evidence && typeof input.evidence === 'object'
        ? Object.freeze({ ...input.evidence })
        : Object.freeze({});
      const explicitDelta = Number(evidence?.delta);
      const expectedDamage = Number(evidence?.expectedDamage);
      const expectedDelta = Number.isFinite(explicitDelta)
        ? explicitDelta
        : ['HP_DELTA', 'SCHEDULED_HP_DELTA'].includes(outcomeKind) &&
            Number.isFinite(expectedDamage)
          ? -Math.abs(expectedDamage)
          : null;
      const entry = Object.freeze({
        semanticKey,
        rootCauseId: String(input.rootActionId || '').trim(),
        sourceActionId: String(
          input.sourceActionId ||
          input.declaration?.actionId ||
          input.rootActionId ||
          '',
        ).trim(),
        actorId: input.actor ? unitId(input.actor) : String(input.actorId || '').trim(),
        actionRole: String(
          input.actionRole ||
          input.declaration?.actionRole ||
          '',
        ).trim().toUpperCase(),
        effectInstanceId: String(input.effectInstanceId || '').trim(),
        targetId: String(input.targetId || '').trim(),
        windowId: String(input.windowId || 'NOW').trim(),
        windowKey,
        outcomeKind,
        component: outcomeComponents[outcomeKind],
        threatValue: Number(input.threatValue || 0),
        ...(expectedDelta === null ? {} : { expectedDelta }),
        evidence,
      });
      this.entries.push(entry);
      return entry;
    }

    fork() {
      const child = new ContributionLedger();
      child.entries = [...this.entries];
      child.semanticKeys = new Set(this.semanticKeys);
      child.actionCancelledWindows = new Set(this.actionCancelledWindows);
      return child;
    }

    commitFrom(child) {
      if (!(child instanceof ContributionLedger)) throw new Error('battle_preview_contribution_transaction_mismatch');
      this.entries = child.entries;
      this.semanticKeys = child.semanticKeys;
      this.actionCancelledWindows = child.actionCancelledWindows;
    }
  }

  function effectTargetsAllies(effect = {}) {
    const targetText = String(effect?.目标 || '').trim();
    if (/自身|友方|己方/.test(targetText)) return true;
    if (/敌方|对方/.test(targetText)) return false;
    const prototype = String(effect?.原型 || '').trim();
    if (prototype === '伤害结算' || prototype === '机制抹消') return false;
    if (prototype === '召唤生成' || prototype === '机制授予' || prototype === '规则防御') return true;
    if (prototype === '护盾变化') {
      return !/负向|削减|移除|破盾/.test(String(effect?.护盾模式 || '')) &&
        parseSignedValue(effect?.数值, 1) >= 0;
    }
    if (prototype === '资源变化') return parseSignedValue(effect?.数值, 1) >= 0;
    if (['属性修正', '判定修正', '结算修正', '时窗修正'].includes(prototype)) {
      return parseSignedValue(effect?.数值 ?? effect?.副数值, 1) >= 0;
    }
    if (prototype === '状态移除') return /负面|减益|控制|异常/.test(String(effect?.状态 || effect?.状态名称 || ''));
    if (prototype === '状态施加') {
      const type = String(effect?.类型 || '').trim().toLowerCase();
      if (type === 'buff') return true;
      if (type === 'debuff') return false;
      const state = String(effect?.状态 || effect?.状态名称 || '').trim();
      if (/迟缓|僵直|眩晕|昏迷|中毒|灼烧|虚弱|禁锢|束缚|沉默|缴械|致盲|标记|减速|索敌干扰/.test(state)) return false;
      if (/护盾|恢复|治疗|增幅|强化|免疫|霸体|加速/.test(state)) return true;
      const combatEffect = deriveStateCombatEffect(effect);
      if (combatEffect.skip_turn === true || combatEffect.cannot_act === true ||
        Number(combatEffect.dodge_penalty || 0) > 0 || Number(combatEffect.reaction_penalty || 0) > 0 ||
        Number(combatEffect.lock_level || 0) > 0 || Number(combatEffect.dot_damage || 0) > 0) return false;
      const rawValue = effect?.数值 ?? effect?.副数值;
      return String(rawValue ?? '').trim() ? parseSignedValue(rawValue, 1) >= 0 : false;
    }
    return false;
  }

  function resolveTargets(worldSnapshot = {}, actor = {}, declaration = {}, effect = {}) {
    const all = listUnits(worldSnapshot);
    const actorSide = sideOf(worldSnapshot, actor);
    const targetText = String(effect?.目标 || declaration?.targetKind || '').trim();
    const declaredIds = Array.isArray(declaration?.targetIds) ? declaration.targetIds.map(String) : [];
    const targetIsEligible = target => effectTargetsAllies(effect)
      ? isPhysicallyAlive(target)
      : isBattleCapable(target);
    if (/自身/.test(targetText)) return [actor];
    if (/友方.*群体|己方.*群体|全场|群体/.test(targetText)) {
      const friendly = all.filter(entry =>
        entry.side === actorSide && targetIsEligible(entry.unit)
      ).map(entry => entry.unit);
      const hostile = all.filter(entry =>
        entry.side !== actorSide && isBattleCapable(entry.unit)
      ).map(entry => entry.unit);
      if (/友方.*群体|己方.*群体/.test(targetText)) return friendly;
      if (/全场/.test(targetText)) return [...friendly, ...hostile];
      return effectTargetsAllies(effect) ? friendly : hostile;
    }
    if (declaredIds.length) {
      return declaredIds
        .map(id => findUnit(worldSnapshot, id))
        .filter(target => target && targetIsEligible(target));
    }
    const friendly = all.filter(entry => entry.side === actorSide && targetIsEligible(entry.unit)).map(entry => entry.unit);
    const hostile = all.filter(entry => entry.side !== actorSide && isBattleCapable(entry.unit)).map(entry => entry.unit);
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
    if (/体力/.test(resource) && 'sta' in unit) unit.sta = next;
    if (unit.属性 && typeof unit.属性 === 'object') unit.属性[mapping[1]] = next;
    if (/体力/.test(resource)) refreshStaminaAdjustedFinal(unit);
  }

  function setResourceValue(unit, resource, value) {
    if (/生命|HP/i.test(resource)) setHp(unit, value);
    else setResource(unit, resource, value);
  }

  function deriveStateCombatEffect(effect = {}) {
    const state = String(effect?.状态 || effect?.状态名称 || '').trim();
    const prototype = String(effect?.原型 || '').trim();
    const combatEffect = cloneValue(effect?.计算层效果 || effect?.战斗效果 || {});
    const signedValue = clamp(parseSignedValue(effect?.数值, 1), -1, 1);
    const magnitude = Math.abs(signedValue);
    const secondaryMagnitude = Math.abs(parseSignedValue(effect?.副数值, 0));
    if (prototype === '判定修正' && magnitude > 0) {
      const check = String(effect?.判定 || '').trim();
      const mapping = check === '命中'
        ? ['hit_bonus', 'hit_penalty']
        : check === '闪避'
          ? ['dodge_bonus', 'dodge_penalty']
          : check === '反应'
            ? ['reaction_bonus', 'reaction_penalty']
            : null;
      if (mapping) {
        const key = signedValue >= 0 ? mapping[0] : mapping[1];
        combatEffect[key] = Math.max(Number(combatEffect[key] || 0), magnitude);
      }
    }
    if (prototype === '结算修正' && magnitude > 0) {
      const settlement = String(effect?.结算 || '').trim();
      if (settlement === '造成伤害') {
        if (signedValue >= 0) combatEffect.damage_bonus = Math.max(Number(combatEffect.damage_bonus || 0), magnitude);
        else combatEffect.damage_reduction = Math.max(Number(combatEffect.damage_reduction || 0), magnitude);
      } else if (settlement === '受到伤害') {
        if (signedValue >= 0) combatEffect.damage_bonus = Math.max(Number(combatEffect.damage_bonus || 0), magnitude);
        else combatEffect.damage_reduction = Math.max(Number(combatEffect.damage_reduction || 0), magnitude);
      } else if (settlement === '防御剥夺' || settlement === '防御穿透') {
        if (signedValue >= 0) combatEffect.armor_pen = Math.max(Number(combatEffect.armor_pen || 0), magnitude);
      } else if (settlement === '治疗') {
        if (signedValue >= 0) combatEffect.heal_bonus = Math.max(Number(combatEffect.heal_bonus || 0), magnitude);
        else combatEffect.heal_reduction = Math.max(Number(combatEffect.heal_reduction || 0), magnitude);
      } else if (settlement === '消耗') {
        combatEffect.cost_delta_ratio = Math.max(Number(combatEffect.cost_delta_ratio || 0), magnitude) * (signedValue >= 0 ? 1 : -1);
      } else if (settlement === '蓄力') {
        const key = signedValue >= 0 ? 'cast_speed_bonus' : 'cast_speed_penalty';
        combatEffect[key] = Math.max(Number(combatEffect[key] || 0), magnitude);
      } else if (settlement === '反伤') {
        combatEffect.counter_attack_ratio = Math.max(Number(combatEffect.counter_attack_ratio || 0), magnitude);
      }
    }
    if (prototype === '资源锁定') {
      combatEffect.resource_lock = true;
      combatEffect.locked_resource = String(effect?.资源 || '魂力').trim() || '魂力';
      combatEffect.locked_ratio = magnitude;
    }
    if (prototype === '位移执行') {
      const positionType = String(effect?.位移类型 || '').trim();
      const distanceFactor = clamp(Math.max(0, Number(effect?.距离 || 0)) / 100, 0.05, 0.25);
      combatEffect.position_type = positionType;
      combatEffect.position_object = String(effect?.位移对象 || '').trim();
      combatEffect.position_distance = Math.max(0, Number(effect?.距离 || 0));
      combatEffect.position_projection = '命中、闪避、索敌、反应和姿态窗口';
      if (/拉近|突进|追击/.test(positionType)) {
        combatEffect.hit_bonus = Math.max(Number(combatEffect.hit_bonus || 0), distanceFactor);
        combatEffect.reaction_bonus = Math.max(Number(combatEffect.reaction_bonus || 0), distanceFactor * 0.5);
      } else if (/击退|击飞/.test(positionType)) {
        combatEffect.hit_penalty = Math.max(Number(combatEffect.hit_penalty || 0), distanceFactor);
        combatEffect.reaction_penalty = Math.max(Number(combatEffect.reaction_penalty || 0), distanceFactor * 0.5);
      } else if (/脱离|瞬移|换位/.test(positionType)) {
        combatEffect.dodge_bonus = Math.max(Number(combatEffect.dodge_bonus || 0), distanceFactor);
        combatEffect.reaction_bonus = Math.max(Number(combatEffect.reaction_bonus || 0), distanceFactor * 0.5);
      }
    }
    if (prototype === '决策干扰') {
      const interference = String(effect?.干扰 || '').trim();
      const interferenceMagnitude = Math.abs(parseSignedValue(effect?.数值 || '-15%', 1)) || 0.15;
      combatEffect.hit_penalty = Math.max(
        Number(combatEffect.hit_penalty || 0),
        interferenceMagnitude * (/索敌/.test(interference) ? 1 : 0.5),
      );
      combatEffect.reaction_penalty = Math.max(
        Number(combatEffect.reaction_penalty || 0),
        interferenceMagnitude * (/判断/.test(interference) ? 1 : 0.5),
      );
      combatEffect.random_target_rate = Math.max(
        Number(combatEffect.random_target_rate || 0),
        /索敌/.test(interference) ? interferenceMagnitude : 0,
      );
    }
    if (/中毒|流血|灼烧|冻伤|持续创伤/.test(state)) {
      combatEffect.dot_damage_ratio = Math.max(Number(combatEffect.dot_damage_ratio || 0), magnitude);
    }
    if (/持续恢复|再生|愈合|生命恢复/.test(state)) {
      combatEffect.hot_heal_ratio = Math.max(Number(combatEffect.hot_heal_ratio || 0), magnitude);
    }
    if (['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞'].includes(state)) {
      combatEffect.skip_turn = true;
      combatEffect.cannot_act = true;
      combatEffect.cannot_react = true;
    }
    if (/僵直/.test(state)) {
      combatEffect.cannot_react = true;
      combatEffect.reaction_penalty = Math.max(Number(combatEffect.reaction_penalty || 0), magnitude || 0.25);
      combatEffect.cast_speed_penalty = Math.max(Number(combatEffect.cast_speed_penalty || 0), 0.35);
    }
    if (/迟缓|减速/.test(state)) {
      delete combatEffect.skip_turn;
      delete combatEffect.cannot_act;
      delete combatEffect.cannot_react;
      delete combatEffect.lock_level;
      combatEffect.cast_speed_penalty = Math.max(
        Number(combatEffect.cast_speed_penalty || 0),
        magnitude || secondaryMagnitude || 0.15,
      );
      combatEffect.reaction_penalty = Math.max(
        Number(combatEffect.reaction_penalty || 0),
        secondaryMagnitude || magnitude || 0.15,
      );
      combatEffect.dodge_penalty = Math.max(
        Number(combatEffect.dodge_penalty || 0),
        magnitude || secondaryMagnitude || 0.15,
      );
    }
    if (/定身|束缚|禁锢/.test(state)) {
      combatEffect.dodge_penalty = Math.max(Number(combatEffect.dodge_penalty || 0), magnitude || 0.2);
    }
    if (/沉默|封技/.test(state)) combatEffect.silence = true;
    if (/缴械/.test(state)) combatEffect.disarm = true;
    if (/致盲/.test(state)) combatEffect.blind = true;
    return combatEffect;
  }

  function effectStateName(effect = {}) {
    const explicit = String(effect?.状态 || effect?.状态名称 || '').trim();
    if (explicit) return explicit;
    const prototype = String(effect?.原型 || '').trim();
    if (prototype === '属性修正') {
      const attributes = (Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性]).map(value => String(value || '').trim()).filter(Boolean);
      return `${attributes.join('、') || '属性'}修正`;
    }
    if (prototype === '判定修正') return `${String(effect?.判定 || '判定').trim() || '判定'}判定修正`;
    return String(effect?.判定 || prototype).trim();
  }

  function findStateEntry(unit = {}, effect = {}) {
    const wanted = effectStateName(effect);
    return stateEntries(unit).find(([, state]) => stateName(state) === wanted) || null;
  }

  function addState(unit, effect, effectId) {
    const stateName = effectStateName(effect);
    if (!stateName) return false;
    if (
      Number(effect?.__previewApplicationProbability ?? 1) <= 1e-12
    ) return false;
    unit.状态效果 = unit.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : {};
    const existingEntry = findStateEntry(unit, effect);
    const stackable = effect?.可叠加 === true || /叠加|层数/.test(String(effect?.叠加规则 || effect?.层数规则 || ''));
    const requestedDuration = Math.max(1, Number(effect?.持续回合 || 1));
    if (existingEntry && !stackable) {
      const [key, existing] = existingEntry;
      const existingDuration = Math.max(0, Number(existing?.duration ?? existing?.持续回合 ?? 0));
      const refreshable = effect?.刷新 === true || effect?.可刷新 === true || requestedDuration > existingDuration;
      if (!refreshable) return false;
      unit.状态效果[key] = {
        ...existing,
        duration: Math.max(existingDuration, requestedDuration),
        数值: effect?.数值 ?? existing?.数值,
        强度: effect?.强度 ?? existing?.强度,
        战斗效果: { ...(existing?.战斗效果 || {}), ...deriveStateCombatEffect(effect) },
      };
      return true;
    }
    unit.状态效果[`preview:${effectId}:${stateName}`] = {
      状态: stateName,
      状态名称: stateName,
      类型: effect?.类型 || '',
      duration: requestedDuration,
      数值: effect?.数值 ?? '',
      强度: effect?.强度 ?? '',
      __previewApplicationProbability: clamp(Number(effect?.__previewApplicationProbability ?? 1), 0, 1),
      战斗效果: deriveStateCombatEffect(effect),
      面板修改比例: cloneValue(effect?.面板修改比例 || {}),
      面板固定修正: cloneValue(effect?.面板固定修正 || {}),
    };
    return true;
  }

  function collectStateEntries(unit = {}) {
    const states = unit?.状态效果;
    return Array.isArray(states)
      ? states.map((state, index) => [String(index), state]).filter(([, state]) => state && typeof state === 'object')
      : states && typeof states === 'object'
        ? Object.entries(states).filter(([, state]) => state && typeof state === 'object')
        : [];
  }

  function stateDependencyProjection(entries = [], scope = 'COLLECTION') {
    const normalizedScope = String(scope || 'COLLECTION').trim().toUpperCase();
    if (normalizedScope === 'COLLECTION' || normalizedScope === 'FULL') {
      return entries;
    }
    const hasMechanicalValue = value => {
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'number') return Math.abs(value) > 1e-12;
      if (typeof value === 'boolean') return value;
      return true;
    };
    const pick = (key, state, fields) => {
      const effects = state?.战斗效果 ||
        state?.计算层效果 ||
        state?.battleEffects ||
        {};
      return [
        key,
        String(state?.状态 || state?.状态名称 || '').trim(),
        Number(state?.__previewApplicationProbability ?? 1),
        ...fields.map(field => [field, effects?.[field] ?? null]),
      ];
    };
    if (normalizedScope.startsWith('STAT:')) {
      const statKey = normalizedScope.slice('STAT:'.length);
      return entries
        .filter(([, state]) =>
          hasMechanicalValue(state?.面板修改比例?.[statKey]) &&
          Number(state?.面板修改比例?.[statKey] ?? 1) !== 1 ||
          hasMechanicalValue(state?.面板固定修正?.[statKey]) &&
          Number(state?.面板固定修正?.[statKey] ?? 0) !== 0
        )
        .map(([key, state]) => [
        key,
        String(state?.状态 || state?.状态名称 || '').trim(),
        Number(state?.__previewApplicationProbability ?? 1),
        state?.面板修改比例?.[statKey] ?? null,
        state?.面板固定修正?.[statKey] ?? null,
        ]);
    }
    const fieldsByScope = {
      ACTION_ORDER: [
        'cast_speed_bonus',
        'cast_speed_penalty',
        'skip_turn',
        'cannot_act',
      ],
      OUTGOING_DAMAGE: [
        'damage_bonus',
        'final_damage_bonus',
        'final_damage_mult',
        'armor_pen',
      ],
      INCOMING_DAMAGE: [
        'received_damage_mult',
        'damage_taken_mult',
        'damage_reduction',
        'death_save_count',
        'revive_count',
        'revive_heal_ratio',
      ],
      OUTGOING_HIT: [
        'hit_bonus',
        'hit_penalty',
      ],
      INCOMING_HIT: [
        'dodge_bonus',
        'dodge_penalty',
        'lock_level',
      ],
      WITHDRAWAL: [
        'dodge_bonus',
        'dodge_penalty',
        'reaction_bonus',
        'reaction_penalty',
        'cannot_react',
        'skip_turn',
      ],
      SCHEDULE: [
        'dot_damage',
        'dot_damage_ratio',
        'hot_heal_ratio',
      ],
    };
    const fields = fieldsByScope[normalizedScope];
    if (fields) {
      return entries
        .filter(([, state]) => {
          const effects = state?.战斗效果 ||
            state?.计算层效果 ||
            state?.battleEffects ||
            {};
          return fields.some(field => hasMechanicalValue(effects?.[field]));
        })
        .map(([key, state]) => pick(key, state, fields));
    }
    if (normalizedScope === 'CONDITION') {
      return entries.map(([key, state]) => [
        key,
        String(state?.状态 || state?.状态名称 || '').trim(),
        String(state?.类型 || state?.正负面 || state?.性质 || '').trim(),
      ]);
    }
    if (normalizedScope === 'SUPPRESSION') {
      return entries
        .filter(([, state]) =>
          Array.isArray(state?.抹消规则) &&
          state.抹消规则.length > 0
        )
        .map(([key, state]) => [
          key,
          String(state?.状态 || state?.状态名称 || '').trim(),
          cloneValue(state.抹消规则),
        ]);
    }
    if (normalizedScope === 'GRANTED_EFFECTS') {
      return entries
        .filter(([, state]) =>
          /下次行动/.test(String(state?.授予触发条件 || '').trim()) &&
          Array.isArray(state?.授予效果) &&
          state.授予效果.length > 0
        )
        .map(([key, state]) => [
          key,
          String(state?.授予触发条件 || '').trim(),
          cloneValue(state.授予效果),
        ]);
    }
    return entries;
  }

  function stateEntries(unit = {}, scope = 'COLLECTION') {
    const entries = collectStateEntries(unit);
    const normalizedScope = String(scope || 'COLLECTION').trim().toUpperCase();
    const dependencyScope =
      normalizedScope === 'COLLECTION' ? 'collection' : normalizedScope;
    recordPreviewDependency(
      `unit:${unitId(unit)}:state:__${dependencyScope}`,
      stateDependencyProjection(entries, normalizedScope),
    );
    if (normalizedScope === 'COLLECTION' || normalizedScope === 'FULL') {
      entries.forEach(([key, state]) => {
        const dependencyKey = String(
          state?.状态 || state?.状态名称 || key
        ).trim() || String(key);
        recordPreviewDependency(
          `unit:${unitId(unit)}:state:${dependencyKey}`,
          state,
        );
      });
    }
    return entries;
  }

  function dependencyValueForKey(worldSnapshot = {}, key = '') {
    const dependencyKey = String(key || '').trim();
    const unitMatch = dependencyKey.match(
      /^unit:(.+):(hp|baseMaxHp|resource:[^:]+|resourceMax:[^:]+|stat:[^:]+|state:.+)$/,
    );
    if (unitMatch) {
      const unit = findUnit(worldSnapshot, unitMatch[1]);
      if (!unit) return null;
      const kind = unitMatch[2];
      if (kind === 'hp') return readHp(unit);
      if (kind === 'baseMaxHp') return readHpMax(unit);
      if (kind.startsWith('resource:')) {
        return readResource(unit, kind.slice('resource:'.length));
      }
      if (kind.startsWith('resourceMax:')) {
        return readResourceMax(unit, kind.slice('resourceMax:'.length));
      }
      if (kind.startsWith('stat:')) {
        return readCombatStat(unit, kind.slice('stat:'.length));
      }
      const stateKey = kind.slice('state:'.length);
      if (stateKey === '__action') {
        const directStamina = Number(unit?.vit);
        const stamina = Number.isFinite(directStamina)
          ? directStamina
          : readResource(unit, '体力');
        return {
          alive: !isDead(unit),
          stamina,
          actionState: String(unit?.状态?.行动 || '').trim(),
          capable: isBattleCapable(unit),
        };
      }
      if (stateKey.startsWith('__')) {
        const scope = stateKey.slice('__'.length) || 'COLLECTION';
        return stateDependencyProjection(
          collectStateEntries(unit),
          scope,
        );
      }
      return collectStateEntries(unit).find(([entryKey, state]) =>
        String(state?.状态 || state?.状态名称 || entryKey).trim() === stateKey
      )?.[1] || null;
    }
    const defenseMatch = dependencyKey.match(/^target:(.+):defense$/);
    if (defenseMatch) {
      const unit = findUnit(worldSnapshot, defenseMatch[1]);
      return unit ? defenseDependencyValue(unit) : null;
    }
    const ruleMatch = dependencyKey.match(/^rule:(.+)$/);
    if (ruleMatch) {
      return cloneValue(
        worldSnapshot?.规则?.[ruleMatch[1]] ??
        worldSnapshot?.battleRules?.[ruleMatch[1]] ??
        null,
      );
    }
    return undefined;
  }

  function stateName(state = {}) {
    return String(state?.状态 || state?.状态名称 || state?.名称 || '').trim();
  }

  function stateScheduledHpDelta(unit = {}, state = {}, durationOverride = null) {
    const combatEffect = state?.战斗效果 || state?.计算层效果 || {};
    const duration = durationOverride === null
      ? Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 0))
      : Math.max(0, Number(durationOverride || 0));
    const damagePerTick = Math.max(
      0,
      Number(combatEffect?.dot_damage || state?.dot_damage || 0) +
      readHpMax(unit) * Math.max(
        0,
        Number(combatEffect?.dot_damage_ratio || state?.dot_damage_ratio || 0),
      ),
    );
    const healingPerTick = readHpMax(unit) *
      Math.max(0, Number(combatEffect?.hot_heal_ratio || state?.hot_heal_ratio || 0));
    return duration * (healingPerTick - damagePerTick);
  }

  function isNegativeState(state = {}) {
    const type = String(state?.类型 || state?.正负面 || state?.性质 || '').trim();
    if (/负|减益|异常|控制/.test(type) || state?.debuff === true) return true;
    return /中毒|流血|灼烧|眩晕|沉默|禁疗|迟缓|致盲|混乱|嘲讽|精神紊乱/.test(stateName(state));
  }

  function replaceStates(unit, entries) {
    unit.状态效果 = Object.fromEntries(entries.map(([key, state]) => [key, cloneValue(state)]));
  }

  function matchingStates(unit, selector = '任意状态') {
    const wanted = String(selector || '任意状态').trim();
    return stateEntries(unit).filter(([, state]) => {
      if (!wanted || wanted === '任意状态') return true;
      if (wanted === '任意负面') return isNegativeState(state);
      if (wanted === '任意增益') return !isNegativeState(state);
      return stateName(state) === wanted;
    });
  }

  function effectMatchesMechanismMatcher(effect = {}, matcher = {}) {
    const normalizedMatcher = matcher && typeof matcher === 'object' && !Array.isArray(matcher)
      ? matcher
      : { 原型: String(matcher || '').trim() };
    const expectedPrototype = String(normalizedMatcher?.原型 || '').trim();
    const statePrototype = String(effect?.状态 || effect?.状态名称 || '').trim().split(':')[0];
    const actualPrototype = String(
      effect?.来源原型摘要 ||
      effect?.原型 ||
      statePrototype ||
      '',
    ).trim();
    const expectedStateNames = (Array.isArray(normalizedMatcher?.状态)
      ? normalizedMatcher.状态
      : String(normalizedMatcher?.状态 ?? '').split(/[、,，|/]/))
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const publicStateMatch = expectedPrototype === '状态施加' &&
      expectedStateNames.length > 0 &&
      expectedStateNames.includes(String(effect?.状态 || effect?.状态名称 || '').trim());
    if (expectedPrototype && !['全部', '抹消全部', '全部原型'].includes(expectedPrototype) &&
      expectedPrototype !== actualPrototype && !publicStateMatch) return false;
    return Object.entries(normalizedMatcher).every(([field, rawExpected]) => {
      if (field === '原型') return true;
      const expected = (Array.isArray(rawExpected) ? rawExpected : String(rawExpected ?? '').split(/[、,，|/]/))
        .map(value => String(value || '').trim())
        .filter(Boolean);
      if (!expected.length || expected.some(value => /^全部/.test(value) || value === '抹消全部')) return true;
      const actual = Array.isArray(effect?.[field])
        ? effect[field].map(value => String(value || '').trim())
        : [String(effect?.[field] ?? '').trim()];
      return expected.some(value => actual.includes(value));
    });
  }

  function actorSuppressesEffect(actor = {}, effect = {}) {
    return stateEntries(actor, 'SUPPRESSION').some(([, state]) =>
      (Array.isArray(state?.抹消规则) ? state.抹消规则 : []).some(rule =>
        effectMatchesMechanismMatcher(effect, rule?.抹消对象)
      )
    );
  }

  function pendingGrantedEffects(unit = {}) {
    return stateEntries(unit, 'GRANTED_EFFECTS').flatMap(([key, state]) => {
      const trigger = String(state?.授予触发条件 || '').trim();
      if (!/下次行动/.test(trigger) || !Array.isArray(state?.授予效果)) return [];
      return state.授予效果.map((effect, index) => ({
        stateKey: key,
        effect: cloneValue(effect),
        effectId: String(effect?.effectId || effect?.效果ID || `${key}:grant:${index}`).trim(),
      }));
    });
  }

  function rulePrototypeState(effect = {}, prototype = '', context = {}) {
    const duration = Math.max(1, Number(effect?.持续回合 || 1));
    const rule = String(effect?.规则 || effect?.防御对象 || '').trim();
    const rawValue = effect?.数值 ?? effect?.强度;
    const magnitude = Math.abs(parseSignedValue(
      rawValue === undefined || rawValue === '' ? (prototype === '规则防御' ? '50%' : '25%') : rawValue,
      1,
    ));
    const combatEffect = {};
    if (prototype === '规则防御') {
      if (rule === '免死') combatEffect.death_save_count = Math.max(1, Number(effect?.次数 || 1));
      else combatEffect.damage_reduction = clamp(magnitude || 0.5, 0, 0.95);
    } else if (prototype === '规则改写') {
      if (rule === '缴械') combatEffect.disarm = true;
      if (rule === '死亡转存活') {
        combatEffect.revive_count = 1;
        combatEffect.revive_heal_ratio = clamp(magnitude || 0.25, 0.05, 1);
      }
    }
    return {
      状态: `${prototype}:${rule || '规则'}`,
      状态名称: `${prototype}:${rule || '规则'}`,
      类型: prototype === '规则防御' ? 'buff' : 'debuff',
      duration,
      来源原型摘要: prototype,
      来源动作ID: String(context?.rootActionId || '').trim(),
      规则: rule,
      防御对象: String(effect?.防御对象 || '').trim(),
      战斗效果: combatEffect,
      面板修改比例: {},
      面板固定修正: {},
    };
  }

  function nestedEffects(effect = {}) {
    return effectArrayFields.flatMap(field => Array.isArray(effect?.[field]) ? effect[field] : []);
  }

  function consumePreviewNode(context, effect) {
    context.nodeBudget.count += 1;
    if (context.nodeBudget.count > context.nodeBudget.limit) throw new Error('DECISION_PREVIEW_BUDGET_EXCEEDED');
    let effectHash = effectHashCache.get(effect);
    if (!effectHash) {
      effectHash = stableHash(effect);
      effectHashCache.set(effect, effectHash);
    }
    const fingerprint = `${context.depth}|${effectHash}|${context.effectPath.join('>')}`;
    if (context.nodeBudget.activeFingerprints.has(fingerprint)) throw new Error('battle_preview_recursive_effect_cycle');
    context.nodeBudget.activeFingerprints.add(fingerprint);
    return fingerprint;
  }

  function applyStatModifier(unit, effect) {
    const aliases = {
      力量: ['str', '力量'],
      防御: ['def', '防御'],
      敏捷: ['agi', '敏捷'],
      魂力上限: ['sp_max', '魂力上限'],
      精神力上限: ['men_max', '精神力上限'],
      体力上限: ['vit_max', '体力上限'],
    };
    const attributes = (Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性])
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const changes = attributes.map(attribute => {
      const keys = aliases[attribute] || [attribute];
      const current = readNumber(unit, keys, 0);
      const delta = parseSignedValue(effect?.数值, current);
      const next = Math.max(0, current + delta);
      if (keys[0]) unit[keys[0]] = next;
      if (unit.属性 && typeof unit.属性 === 'object' && keys[1]) unit.属性[keys[1]] = next;
      if (unit.final && typeof unit.final === 'object') {
        keys.forEach((key, index) => {
          if (index === 0 || Object.prototype.hasOwnProperty.call(unit.final, key)) unit.final[key] = next;
        });
      }
      return { attribute, current, next, delta: next - current };
    });
    const first = changes[0] || { attribute: '', current: 0, next: 0, delta: 0 };
    return {
      attribute: attributes.length === 1 ? first.attribute : attributes.join('、'),
      current: attributes.length === 1 ? first.current : undefined,
      next: attributes.length === 1 ? first.next : undefined,
      delta: attributes.length === 1 ? first.delta : undefined,
      changes,
    };
  }

  function buildPositionEvidence(effect = {}, combatEffect = {}) {
    const positionType = String(effect?.位移类型 || '').trim();
    const positionObject = String(effect?.位移对象 || '').trim();
    const distance = Math.max(0, Number(effect?.距离 || 0));
    return {
      prototype: '位移执行',
      positionType,
      positionObject,
      distance,
      projection: String(combatEffect?.position_projection || '命中、闪避、索敌、反应和姿态窗口'),
      modelApplied: true,
      combatEffect: cloneValue(combatEffect),
      modelReason: '位移幅度已转换为命中、闪避与反应行为池差量',
    };
  }

  function buildEffectEvidence(effect = {}, prototype = '', combatEffect = {}, extra = {}) {
    return {
      prototype,
      state: String(effect?.状态 || '').trim(),
      check: String(effect?.判定 || '').trim(),
      settlement: String(effect?.结算 || '').trim(),
      attribute: Array.isArray(effect?.属性) ? effect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、') : String(effect?.属性 || '').trim(),
      value: String(effect?.数值 ?? '').trim(),
      element: String(effect?.限定元素 || '').trim(),
      duration: Math.max(1, Number(effect?.持续回合 || 1)),
      combatEffect: cloneValue(combatEffect),
      ...extra,
    };
  }

  function resourceOutcome(effect, target, overlay, ledger, context) {
    const currentTarget = overlay.readUnit(unitId(target));
    const resource = String(effect?.资源 || '魂力').trim();
    const current = /生命|HP/i.test(resource) ? readHp(currentTarget) : readResource(currentTarget, resource);
    const maximum = readResourceMax(currentTarget, resource);
    const probabilityProfile = effectProbabilityProfile(
      context,
      unitId(target),
    );
    const applicationProbability =
      probabilityProfile.applicationProbability;
    const realizedNext = clamp(current + parseSignedValue(effect?.数值, maximum), 0, maximum);
    const realizedDelta = realizedNext - current;
    const delta = realizedDelta * applicationProbability;
    const next = clamp(current + delta, 0, maximum);
    overlay.changeUnit(unitId(target), unit => {
      setResourceValue(unit, resource, next);
    });
    const outcomeDistribution = conditionalDeterministicOutcomeDistribution(
      context,
      unitId(target),
      realizedDelta,
    );
    ledger.addOutcome({
      ...context,
      targetId: unitId(target),
      outcomeKind: /生命|HP/i.test(resource) ? 'HP_DELTA' : 'RESOURCE_OPTION_CHANGED',
      threatValue: /生命|HP/i.test(resource) ? (next - current) / readHpMax(currentTarget) * 100 : 0,
      evidence: {
        resource,
        current,
        next,
        delta: next - current,
        realizedDelta,
        applicationProbability,
        ownApplicationProbability:
          probabilityProfile.ownApplicationProbability,
        ...outcomeDependencyEvidence(context, unitId(target)),
        probabilityGroupKey: [
          context.rootActionId,
          context.effectInstanceId,
          context.windowId,
          unitId(target),
        ].join('|'),
        ...(outcomeDistribution.length
          ? {
              outcomeDistribution,
              distributionGroupKey: String(
                context?.outcomeAssignmentKeyByTarget?.get?.(unitId(target)) ||
                [
                  context.rootActionId,
                  context.effectInstanceId,
                  context.windowId,
                  unitId(target),
                ].join('|')
              ).trim(),
            }
          : {}),
      },
    });
  }

  function requiredOutcomeProfile(context = {}, targetId = '') {
    const key = String(
      context?.requiredOutcomeKeyByTarget?.get?.(targetId) || ''
    ).trim();
    const values = [...new Set(
      context?.requiredOutcomeValuesByTarget?.get?.(targetId) || []
    )].map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
    const universe = [...new Set(
      context?.requiredOutcomeUniverseByTarget?.get?.(targetId) || values
    )].map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
    return { key, values, universe };
  }

  function outcomeDependencyEvidence(context = {}, targetId = '') {
    const required = requiredOutcomeProfile(context, targetId);
    return required.key
      ? {
          requiredOutcomeKey: required.key,
          requiredOutcomeValues: Object.freeze([...required.values]),
          requiredOutcomeUniverse: Object.freeze([...required.universe]),
        }
      : {};
  }

  function effectProbabilityProfile(context = {}, targetId = '') {
    const required = requiredOutcomeProfile(context, targetId);
    const inheritedProbability = clamp(Number(
      context?.applicationProbabilityByTarget?.get?.(targetId) ??
      context?.applicationProbability ??
      1
    ), 0, 1);
    const ownApplicationProbability = clamp(Number(
      context?.ownApplicationProbabilityByTarget?.get?.(targetId) ??
      (required.key ? 1 : inheritedProbability)
    ), 0, 1);
    return {
      required,
      inheritedProbability,
      ownApplicationProbability,
      applicationProbability: required.key
        ? inheritedProbability * ownApplicationProbability
        : inheritedProbability,
    };
  }

  function conditionalDeterministicOutcomeDistribution(
    context = {},
    targetId = '',
    realizedDelta = 0,
  ) {
    const required = requiredOutcomeProfile(context, targetId);
    if (!required.key || !required.values.length || !required.universe.length) {
      return Object.freeze([]);
    }
    return Object.freeze([
      ...required.universe
        .filter(value => !required.values.includes(value))
        .map(value => Object.freeze({
          branchKey: `required:${value.toLowerCase()}:inactive`,
          probability: 1,
          conditionalOn: { [required.key]: value },
          delta: 0,
        })),
      ...required.values.map(value => Object.freeze({
        branchKey: `required:${value.toLowerCase()}:active`,
        probability: 1,
        conditionalOn: { [required.key]: value },
        delta: realizedDelta,
      })),
    ]);
  }

  function applyEffect(effect, targets, overlay, ledger, context, depth) {
    if (
      context?.conditionalPlanResolved !== true &&
      Array.isArray(effect?.条件分支) &&
      effect.条件分支.length
    ) {
      const actor = overlay.readUnit(unitId(context.actor)) || context.actor;
      const worldSnapshot = overlay.snapshot();
      const groups = new Map();
      targets.forEach(target => {
        const targetId = unitId(target);
        const primaryOutcomes = context?.primaryOutcomeDistributionByTarget?.get?.(targetId) || [];
        const hasOutcomeCondition = effect.条件分支.some(branch =>
          (Array.isArray(branch?.条件) ? branch.条件 : []).some(condition =>
            ['命中', '被闪避'].includes(String(condition?.类型 || '').trim())
          )
        );
        if (hasOutcomeCondition && primaryOutcomes.length) {
          const outcomeKey = String(
            context?.primaryOutcomeKeyByTarget?.get?.(targetId) || ''
          ).trim();
          const universe = [...new Set(
            primaryOutcomes
              .map(row => String(row?.outcome || '').trim().toUpperCase())
              .filter(Boolean)
          )];
          const aggregated = new Map();
          primaryOutcomes.forEach(row => {
            const outcome = String(row?.outcome || '').trim().toUpperCase();
            const probability = clamp(Number(row?.probability || 0), 0, 1);
            if (!outcome || !(probability > 1e-12)) return;
            const plan = resolveConditionalEffectPlan(
              effect,
              worldSnapshot,
              actor,
              target,
              {
                ...context,
                primaryOutcome: outcome,
                primarySucceeded: outcome === 'HIT',
                primaryEvaded: outcome === 'EVADED',
              },
            );
            plan.forEach(entry => {
              const key = stableHash({
                mode: entry.mode,
                branchIndex: entry.branchIndex,
                nestedIndex: entry.nestedIndex,
                effect: entry.effect,
              });
              const current = aggregated.get(key) || {
                entry,
                outcomes: new Set(),
                probability: 0,
              };
              current.outcomes.add(outcome);
              current.probability += probability;
              aggregated.set(key, current);
            });
          });
          aggregated.forEach(({ entry, outcomes, probability }) => {
            const inheritedProbability = clamp(Number(
              context?.applicationProbabilityByTarget?.get?.(targetId) ??
              context?.applicationProbability ??
              1
            ), 0, 1);
            const requiredValues = [...outcomes].sort();
            const appliesToAllOutcomes =
              requiredValues.length === universe.length &&
              universe.every(value => outcomes.has(value));
            const suffix = entry.mode === 'ORIGINAL'
              ? ''
              : `:conditional:${entry.mode.toLowerCase()}:${entry.branchIndex}:${entry.nestedIndex}`;
            applyEffect(
              entry.effect,
              [target],
              overlay,
              ledger,
              {
                ...context,
                conditionalPlanResolved: true,
                effectInstanceId: `${context.effectInstanceId}${suffix}`,
                applicationProbabilityByTarget: new Map([[
                  targetId,
                  inheritedProbability * clamp(probability, 0, 1),
                ]]),
                ...(appliesToAllOutcomes || !outcomeKey
                  ? {}
                  : {
                      requiredOutcomeKeyByTarget: new Map([[targetId, outcomeKey]]),
                      requiredOutcomeValuesByTarget: new Map([[targetId, requiredValues]]),
                      requiredOutcomeUniverseByTarget: new Map([[targetId, universe]]),
                    }),
              },
              depth,
            );
          });
          return;
        }
        const conditionalContext = {
          ...context,
          primarySucceeded:
            context?.primarySucceededByTarget?.get?.(targetId) ??
            context?.primarySucceeded,
          primarySuccessProbability:
            context?.primarySuccessProbabilityByTarget?.get?.(targetId) ??
            context?.primarySuccessProbability,
          primaryEvaded:
            context?.primaryEvadedByTarget?.get?.(targetId) ??
            context?.primaryEvaded,
          primaryEvadeProbability:
            context?.primaryEvadeProbabilityByTarget?.get?.(targetId) ??
            context?.primaryEvadeProbability,
          primaryOutcome:
            context?.primaryOutcomeByTarget?.get?.(targetId) ??
            context?.primaryOutcome,
        };
        const plan = resolveConditionalEffectPlan(
          effect,
          worldSnapshot,
          actor,
          target,
          conditionalContext,
        );
        if (!plan.length) return;
        const key = stableHash(plan.map(entry => ({
          mode: entry.mode,
          branchIndex: entry.branchIndex,
          nestedIndex: entry.nestedIndex,
          effect: entry.effect,
        })));
        const group = groups.get(key) || { plan, targets: [] };
        group.targets.push(target);
        groups.set(key, group);
      });
      groups.forEach(group => {
        group.plan.forEach(entry => {
          const suffix = entry.mode === 'ORIGINAL'
            ? ''
            : `:conditional:${entry.mode.toLowerCase()}:${entry.branchIndex}:${entry.nestedIndex}`;
          applyEffect(
            entry.effect,
            group.targets,
            overlay,
            ledger,
            {
              ...context,
              conditionalPlanResolved: true,
              effectInstanceId: `${context.effectInstanceId}${suffix}`,
            },
            depth,
          );
        });
      });
      return;
    }
    const prototype = String(effect?.原型 || '').trim();
    validateEffect(effect);
    if (depth > MAX_RECURSION_DEPTH) throw new Error('battle_preview_recursion_depth_exceeded');
    const effectContext = { ...context, depth, effectPath: [...context.effectPath, context.effectInstanceId] };
    const activeFingerprint = consumePreviewNode(effectContext, effect);
    try {
      const actor = overlay.readUnit(unitId(context.actor));
      if (prototype !== '机制抹消' && actorSuppressesEffect(actor, effect)) {
        ledger.addOutcome({
          ...context,
          targetId: unitId(actor),
          outcomeKind: 'RULE_CHANGED',
          threatValue: 0,
          evidence: { prototype, suppressed: true, marginal: false },
        });
        return;
      }
      if (prototype === '伤害结算') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const rawDamage = calculateBaseDamage(effect, actor, currentTarget) *
            Math.max(0, Number(context?.actionDamageMultiplier || 1));
          const baseHitProbability = estimateHitProbability(actor, currentTarget, effect);
          const resolvedHitProbability = typeof context?.hitProbabilityResolver === 'function'
            ? context.hitProbabilityResolver({
                targetId: unitId(target),
                actor,
                effect,
                effectInstanceId: context.effectInstanceId,
                baseHitProbability,
                recordDependency: recordPreviewDependency,
              })
            : null;
          const hitProbability = clamp(
            resolvedHitProbability !== null &&
              resolvedHitProbability !== undefined &&
              Number.isFinite(Number(resolvedHitProbability))
              ? Number(resolvedHitProbability)
              : baseHitProbability,
            0,
            1,
          );
          const applicationProbability = clamp(Number(
            context?.applicationProbabilityByTarget?.get(unitId(target)) ??
            context?.applicationProbability ??
            1
          ), 0, 1);
          const evadeProbability = clamp(Number(
            context?.evadeProbabilityByTarget?.get?.(unitId(target)) ??
            context?.evadeProbabilityByTarget?.[unitId(target)] ??
            context?.evadeProbability ??
            0
          ), 0, 1);
          const resolvedDamageMultiplier = typeof context?.damageMultiplierResolver === 'function'
            ? context.damageMultiplierResolver({
                targetId: unitId(target),
                actor,
                effect,
                effectInstanceId: context.effectInstanceId,
              })
            : null;
          const reactionDamageMultiplier = clamp(Number(
            resolvedDamageMultiplier ??
            context?.damageMultiplierByTarget?.[unitId(target)] ??
            context?.damageMultiplierByTarget?.get?.(unitId(target)) ??
            1
          ), 0, 1);
          const nonlethalIntent = /点到为止|切磋|训练|非致命/.test(String(context?.battleIntent?.mode || context?.battleIntent || '').trim());
          const nonlethalHpFloor = nonlethalIntent
            ? calculateNonlethalHpFloor(overlay.snapshot(), currentTarget, context?.battleIntent || {})
            : 0;
          const hpDamageLimit = nonlethalIntent ? Math.max(0, readHp(currentTarget) - nonlethalHpFloor) : readHp(currentTarget);
          const shieldBefore = readShield(currentTarget);
          const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 ?? effect?.段数 ?? 1)) || 1);
          const perSegmentDamage = calculateSettledSegmentDamage(
            rawDamage,
            segments,
            reactionDamageMultiplier,
          );
          const requiredOutcomeKey = String(
            context?.requiredOutcomeKeyByTarget?.get(unitId(target)) || ''
          ).trim();
          const required = requiredOutcomeProfile(context, unitId(target));
          const outcomeAssignmentKey = String(
            context?.outcomeAssignmentKeyByTarget?.get(unitId(target)) || ''
          ).trim();
          const damageExpectation = expectedSegmentedDamageOutcome({
            segments,
            perSegmentDamage,
            hitProbability,
            applicationProbability: applicationProbability * (1 - evadeProbability),
            shieldBefore,
            hpDamageLimit,
          });
          const conditionalDamageExpectation = expectedSegmentedDamageOutcome({
            segments,
            perSegmentDamage,
            hitProbability,
            applicationProbability: 1,
            shieldBefore,
            hpDamageLimit,
          });
          const incomingDamage = damageExpectation.expectedIncoming;
          const fullHitIncoming = damageExpectation.fullHitIncoming;
          let shieldAbsorb = 0;
          const expectedDamage = damageExpectation.expectedHpDamage;
          overlay.changeUnit(unitId(target), unit => {
            shieldAbsorb = absorbPreviewShield(unit, damageExpectation.expectedShieldAbsorb);
            setHp(unit, readHp(unit) - expectedDamage);
          });
          const fullHitDamage = damageExpectation.fullHitHpDamage;
          const traumaUnconscious = shouldTriggerTraumaUnconscious(fullHitDamage, readHp(currentTarget) - fullHitDamage, readHpMax(currentTarget));
          const nonlethalIncapacitated = nonlethalIntent && nonlethalHpFloor <= 1 && hpDamageLimit > 0 && expectedDamage >= hpDamageLimit - 1e-9;
          const activeRequiredValues = required.key && required.values.length
            ? required.values
            : [''];
          const activeProbabilityScale = required.key ? 1 : applicationProbability;
          const outcomeDistribution = [
            ...(required.key ? required.universe
              .filter(value => !required.values.includes(value))
              .map(value => ({
                branchKey: `required:${value.toLowerCase()}:inactive`,
                probability: 1,
                conditionalOn: { [required.key]: value },
                incoming: 0,
                shieldAbsorb: 0,
                hpDamage: 0,
                delta: 0,
                actionState: '',
              })) : []),
            ...(!required.key && applicationProbability < 1 - 1e-12 ? [{
              branchKey: 'application:inactive',
              probability: 1 - applicationProbability,
              incoming: 0,
              shieldAbsorb: 0,
              hpDamage: 0,
              delta: 0,
              ...(outcomeAssignmentKey
                ? { assignments: { [outcomeAssignmentKey]: 'MISS' } }
                : {}),
              actionState: '',
            }] : []),
            ...activeRequiredValues.flatMap(requiredValue => [
              ...(evadeProbability > 1e-12 ? [{
                branchKey: `damage:evaded${requiredValue ? `:${requiredValue}` : ''}`,
                probability: activeProbabilityScale * evadeProbability,
                ...(required.key
                  ? { conditionalOn: { [required.key]: requiredValue } }
                  : {}),
                incoming: 0,
                shieldAbsorb: 0,
                hpDamage: 0,
                delta: 0,
                ...(outcomeAssignmentKey
                  ? { assignments: { [outcomeAssignmentKey]: 'EVADED' } }
                  : {}),
                actionState: '',
              }] : []),
              ...conditionalDamageExpectation.outcomeDistribution.map(branch => {
              const branchNonlethalIncapacitated =
                nonlethalIntent &&
                nonlethalHpFloor <= 1 &&
                hpDamageLimit > 0 &&
                Number(branch.hpDamage || 0) >= hpDamageLimit - 1e-9;
              const branchTraumaUnconscious = shouldTriggerTraumaUnconscious(
                Number(branch.hpDamage || 0),
                readHp(currentTarget) - Number(branch.hpDamage || 0),
                readHpMax(currentTarget),
              );
              const branchSucceeded = (branch.hitCounts || []).some(hitCount => Number(hitCount) > 0);
              return {
                ...branch,
                probability:
                  activeProbabilityScale *
                  Number(branch.probability || 0) *
                  (1 - evadeProbability),
                ...(required.key
                  ? { conditionalOn: { [required.key]: requiredValue } }
                  : {}),
                ...(outcomeAssignmentKey
                  ? {
                      assignments: {
                        [outcomeAssignmentKey]: branchSucceeded ? 'HIT' : 'MISS',
                      },
                    }
                  : {}),
                actionState: branchNonlethalIncapacitated
                  ? '失去战斗力'
                  : branchTraumaUnconscious
                    ? '昏迷'
                    : '',
              };
              }),
            ]),
          ];
          if (nonlethalIncapacitated || traumaUnconscious && hitProbability >= 1 - 1e-9) {
            overlay.changeUnit(unitId(target), unit => {
              if (nonlethalIncapacitated) unit.状态 = { ...(unit.状态 || {}), 行动: '失去战斗力' };
              if (traumaUnconscious && hitProbability >= 1 - 1e-9) unit.状态 = { ...(unit.状态 || {}), 行动: '昏迷' };
            });
          }
          if (shieldAbsorb > 0) {
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'SHIELD_DELTA',
            threatValue: shieldAbsorb / readHpMax(currentTarget) * 100,
            evidence: {
              current: shieldBefore,
              next: Math.max(0, shieldBefore - shieldAbsorb),
              delta: -shieldAbsorb,
              absorbedDamage: shieldAbsorb,
            },
          });
          }
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'HP_DELTA',
            threatValue: expectedDamage / readHpMax(currentTarget) * 100,
            evidence: {
              rawDamage,
              hitProbability,
              applicationProbability,
              evadeProbability,
              reactionDamageMultiplier,
              perSegmentDamage,
              incomingDamage,
              shieldAbsorb,
              expectedDamage,
              fullHitIncoming: damageExpectation.fullHitIncoming,
              fullHitShieldAbsorb: damageExpectation.fullHitShieldAbsorb,
              fullHitDamage,
              outcomeDistribution: Object.freeze(outcomeDistribution.map(Object.freeze)),
              distributionGroupKey: String(
                outcomeAssignmentKey ||
                [
                  context.rootActionId,
                  context.effectInstanceId,
                  context.windowId,
                  unitId(target),
                ].join('|')
              ).trim(),
              delta: -expectedDamage,
              current: readHp(currentTarget),
              next: Math.max(0, readHp(currentTarget) - expectedDamage),
              damageType: effect?.伤害类型 || '',
            },
          });
          if (nonlethalIncapacitated) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'NONLETHAL_INCAPACITATION',
              threatValue: 0,
              evidence: { reason: 'NONLETHAL_INCAPACITATION', hpFloor: nonlethalHpFloor },
            });
          }
          if (traumaUnconscious) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'TRAUMA_UNCONSCIOUS',
              threatValue: hitProbability * 100,
              evidence: { reason: 'TRAUMA_UNCONSCIOUS', probability: hitProbability, fullHitDamage, hpAfter: readHp(currentTarget) - fullHitDamage, hpMax: readHpMax(currentTarget) },
            });
          }
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
        const currentTarget = overlay.readUnit(unitId(amountTarget));
        const resource = String(effect?.资源 || '魂力').trim();
        const probabilityProfile = effectProbabilityProfile(
          context,
          unitId(amountTarget),
        );
        const applicationProbability =
          probabilityProfile.applicationProbability;
        const realizedAmount = Math.abs(
          parseSignedValue(effect?.数值, readResourceMax(currentTarget, resource))
        );
        const actorCurrent = readResource(actor, resource);
        const targetCurrent = readResource(currentTarget, resource);
        const mode = String(effect?.资源转移方式 || '转移').trim();
        let realizedActorNext = actorCurrent;
        let realizedTargetNext = targetCurrent;
        if (mode === '吞噬') {
          const moved = Math.min(
            realizedAmount,
            targetCurrent,
            readResourceMax(actor, resource) - actorCurrent,
          );
          realizedActorNext += moved;
          realizedTargetNext -= moved;
        } else if (mode === '共享' || mode === '均分') {
          const shared = (actorCurrent + targetCurrent) / 2;
          realizedActorNext = clamp(
            shared,
            0,
            readResourceMax(actor, resource),
          );
          realizedTargetNext = clamp(
            shared,
            0,
            readResourceMax(currentTarget, resource),
          );
        } else {
          const moved = Math.min(
            realizedAmount,
            actorCurrent,
            readResourceMax(currentTarget, resource) - targetCurrent,
          );
          realizedActorNext -= moved;
          realizedTargetNext += moved;
        }
        const actorRealizedDelta = realizedActorNext - actorCurrent;
        const targetRealizedDelta = realizedTargetNext - targetCurrent;
        const actorNext = actorCurrent +
          actorRealizedDelta * applicationProbability;
        const targetNext = targetCurrent +
          targetRealizedDelta * applicationProbability;
        overlay.changeUnit(unitId(actor), unit => setResourceValue(unit, resource, actorNext));
        overlay.changeUnit(unitId(currentTarget), unit => setResourceValue(unit, resource, targetNext));
        [actor, currentTarget].forEach((unit, index) => ledger.addOutcome({
          ...context,
          targetId: unitId(unit),
          effectInstanceId: `${context.effectInstanceId}:${index}`,
          outcomeKind: 'RESOURCE_OPTION_CHANGED',
          threatValue: 0,
          evidence: {
            resource,
            mode,
            delta: index === 0 ? actorNext - actorCurrent : targetNext - targetCurrent,
            realizedDelta:
              index === 0 ? actorRealizedDelta : targetRealizedDelta,
            applicationProbability,
            ownApplicationProbability:
              probabilityProfile.ownApplicationProbability,
            ...outcomeDependencyEvidence(
              context,
              unitId(amountTarget),
            ),
            probabilityGroupKey: [
              context.rootActionId,
              context.effectInstanceId,
              context.windowId,
              unitId(amountTarget),
            ].join('|'),
            distributionGroupKey: String(
              context?.outcomeAssignmentKeyByTarget?.get?.(
                unitId(amountTarget)
              ) ||
              [
                context.rootActionId,
                context.effectInstanceId,
                context.windowId,
                unitId(amountTarget),
              ].join('|')
            ).trim(),
          },
        }));
        return;
      }
      if (prototype === '护盾变化') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const current = readShield(currentTarget);
          const mode = String(effect?.护盾模式 || '正向护盾').trim();
          const probabilityProfile = effectProbabilityProfile(
            context,
            unitId(target),
          );
          const applicationProbability =
            probabilityProfile.applicationProbability;
          const realizedRequested = Math.abs(
            parseSignedValue(effect?.数值, readHpMax(currentTarget))
          );
          const realizedDelta = mode === '正向护盾'
            ? realizedRequested
            : -Math.min(current, realizedRequested);
          const delta = realizedDelta * applicationProbability;
          const next = Math.max(0, current + delta);
          overlay.changeUnit(unitId(target), unit => {
            unit.shield = next;
            unit.护盾 = next;
          });
          if (
            mode === '窃盾' &&
            unitId(currentTarget) !== unitId(actor) &&
            realizedDelta < -1e-12
          ) {
            const actorShieldBefore = readShield(actor);
            const realizedStolen = -realizedDelta;
            const stolen = realizedStolen * applicationProbability;
            overlay.changeUnit(unitId(actor), unit => {
              unit.shield = readShield(unit) + stolen;
              unit.护盾 = readShield(unit);
            });
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:stolen`,
              targetId: unitId(actor),
              outcomeKind: 'SHIELD_DELTA',
              threatValue: stolen / readHpMax(actor) * 100,
              evidence: {
                mode,
                current: actorShieldBefore,
                next: actorShieldBefore + stolen,
                delta: stolen,
                realizedDelta: realizedStolen,
                stolenFrom: unitId(currentTarget),
                applicationProbability,
                ownApplicationProbability:
                  probabilityProfile.ownApplicationProbability,
                ...outcomeDependencyEvidence(context, unitId(target)),
                probabilityGroupKey: [
                  context.rootActionId,
                  context.effectInstanceId,
                  context.windowId,
                  unitId(target),
                ].join('|'),
              },
            });
          }
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'SHIELD_DELTA',
            threatValue: delta / readHpMax(currentTarget) * 100,
            evidence: {
              mode,
              current,
              next,
              delta,
              realizedDelta,
              duration: Math.max(1, Number(effect?.持续回合 || 1)),
              applicationProbability,
              ownApplicationProbability:
                probabilityProfile.ownApplicationProbability,
              ...outcomeDependencyEvidence(context, unitId(target)),
              probabilityGroupKey: [
                context.rootActionId,
                context.effectInstanceId,
                context.windowId,
                unitId(target),
              ].join('|'),
            },
          });
        });
        return;
      }
      if (prototype === '属性修正') {
        targets.forEach(target => {
          const probabilityProfile = effectProbabilityProfile(
            context,
            unitId(target),
          );
          const applicationProbability =
            probabilityProfile.applicationProbability;
          const scaledEffect = applicationProbability >= 1 - 1e-12
            ? effect
            : {
                ...effect,
                数值: typeof effect?.数值 === 'string' && effect.数值.includes('%')
                  ? `${(Number.parseFloat(effect.数值) || 0) * applicationProbability}%`
                  : (Number(effect?.数值 || 0) * applicationProbability),
                __previewApplicationProbability: applicationProbability,
              };
          let evidence;
          overlay.changeUnit(unitId(target), unit => {
            const existing = findStateEntry(unit, scaledEffect);
            const marginal = addState(unit, scaledEffect, context.effectInstanceId);
            evidence = existing
              ? {
                  ...buildEffectEvidence(scaledEffect, prototype, deriveStateCombatEffect(scaledEffect), {
                    attribute: Array.isArray(scaledEffect?.属性)
                      ? scaledEffect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、')
                      : String(scaledEffect?.属性 || '').trim(),
                    applicationProbability,
                    ownApplicationProbability:
                      probabilityProfile.ownApplicationProbability,
                    ...outcomeDependencyEvidence(context, unitId(target)),
                    projectedEffect: cloneValue(effect),
                    marginal,
                    refreshed: marginal,
                    changes: [],
                  }),
                }
              : {
                  ...applyStatModifier(unit, scaledEffect),
                  applicationProbability,
                  ownApplicationProbability:
                    probabilityProfile.ownApplicationProbability,
                  ...outcomeDependencyEvidence(context, unitId(target)),
                  projectedEffect: cloneValue(effect),
                  marginal,
                };
          });
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED', threatValue: 0, evidence });
        });
        return;
      }
      if (prototype === '决策干扰') {
        targets.forEach(target => {
          const targetId = unitId(target);
          const combatEffect = deriveStateCombatEffect(effect);
          let marginal = false;
          overlay.changeUnit(targetId, unit => {
            marginal = addState(unit, effect, context.effectInstanceId);
          });
          const duration = Math.max(1, Number(effect?.持续回合 || 1));
          overlay.schedule({
            type: 'BELIEF_INTERFERENCE',
            targetId,
            interference: effect?.干扰 || '',
            value: effect?.数值 || '',
            duration,
          });
          ledger.addOutcome({
            ...context,
            targetId,
            outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED',
            threatValue: 0,
            evidence: {
              ...buildEffectEvidence(effect, prototype, combatEffect, { marginal }),
              interference: effect?.干扰 || '',
              duration,
            },
          });
        });
        return;
      }
      if (['判定修正', '结算修正', '状态施加', '资源锁定', '位移执行'].includes(prototype)) {
        targets.forEach(target => {
          const delay = Math.max(0, Number(effect?.延迟回合 || 0));
          if (prototype === '状态施加' && delay > 0) {
            const scheduledRound = Math.max(0, Number(context?.worldSnapshot?.回合 || 0)) + delay;
            overlay.schedule({
              type: 'DELAYED_STATE',
              actorId: unitId(actor),
              targetId: unitId(target),
              sourceActionId: String(context?.rootActionId || '').trim(),
              effectInstanceId: String(context?.effectInstanceId || '').trim(),
              effect: cloneValue(effect),
              delay,
              scheduledRound,
            });
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'STATE_SCHEDULED',
              threatValue: 0,
              evidence: {
                state: effect?.状态 || '',
                delay,
                scheduledRound,
              },
            });
            return;
          }
          const inheritedApplicationProbability = Number(
            context?.applicationProbabilityByTarget?.get(unitId(target)) ??
            context?.applicationProbability ??
            1
          );
          const baseApplicationProbability = prototype === '状态施加'
            ? normalizeEffectProbability(effect?.成功率 ?? effect?.触发概率, 1)
            : 1;
          const resolvedApplicationProbability = prototype === '状态施加' &&
            typeof context?.applicationProbabilityResolver === 'function'
            ? context.applicationProbabilityResolver({
                targetId: unitId(target),
                actor,
                effect,
                effectInstanceId: context.effectInstanceId,
                baseApplicationProbability,
                recordDependency: recordPreviewDependency,
              })
            : baseApplicationProbability;
          const applicationProbability = clamp(
            inheritedApplicationProbability * (
              Number.isFinite(Number(resolvedApplicationProbability))
                ? Number(resolvedApplicationProbability)
                : baseApplicationProbability
            ),
            0,
            1,
          );
          const ownApplicationProbability = clamp(
            Number.isFinite(Number(resolvedApplicationProbability))
              ? Number(resolvedApplicationProbability)
              : baseApplicationProbability,
            0,
            1,
          );
          const forcedProbability = forcedApplicationProbability(
            context,
            context.effectInstanceId,
            unitId(target),
          );
          const effectiveApplicationProbability =
            forcedProbability === null
              ? applicationProbability
              : forcedProbability;
          const effectiveOwnApplicationProbability =
            forcedProbability === null
              ? ownApplicationProbability
              : forcedProbability;
          const required = requiredOutcomeProfile(context, unitId(target));
          const stateApplicationOutcomeKey = String(
            context?.outcomeAssignmentKeyByTarget?.get(unitId(target)) ||
            [
              context.rootActionId,
              context.effectInstanceId,
              unitId(target),
              'state-application',
            ].join('|')
          ).trim();
          const stateOutcomeDistribution = Object.freeze([
            ...(required.key ? required.universe
              .filter(value => !required.values.includes(value))
              .map(value => Object.freeze({
                branchKey: `required:${value.toLowerCase()}:inactive`,
                probability: 1,
                conditionalOn: { [required.key]: value },
                assignments: { [stateApplicationOutcomeKey]: 'RESISTED' },
              })) : []),
            ...(required.key && required.values.length ? required.values : [''])
              .flatMap(requiredValue => [
                ...(effectiveOwnApplicationProbability < 1 - 1e-12 ? [Object.freeze({
                  branchKey: `state:resisted${requiredValue ? `:${requiredValue}` : ''}`,
                  probability: 1 - effectiveOwnApplicationProbability,
                  ...(required.key
                    ? { conditionalOn: { [required.key]: requiredValue } }
                    : {}),
                  assignments: { [stateApplicationOutcomeKey]: 'RESISTED' },
                })] : []),
                ...(effectiveOwnApplicationProbability > 1e-12 ? [Object.freeze({
                  branchKey: `state:hit${requiredValue ? `:${requiredValue}` : ''}`,
                  probability: effectiveOwnApplicationProbability,
                  ...(required.key
                    ? { conditionalOn: { [required.key]: requiredValue } }
                    : {}),
                  assignments: { [stateApplicationOutcomeKey]: 'HIT' },
                })] : []),
              ]),
          ]);
          const state = String(effect?.状态 || '').trim();
          if (prototype === '状态施加' && /护盾|屏障|结界/.test(state)) {
            const currentTarget = overlay.readUnit(unitId(target));
            const current = readShield(currentTarget);
            let delta = 0;
            overlay.changeUnit(unitId(target), unit => {
              delta = applyPreviewShield(
                unit,
                Math.max(0, parseSignedValue(effect?.数值, readHpMax(unit))) * effectiveApplicationProbability,
                Math.max(1, Number(effect?.持续回合 || 1)),
                context.effectInstanceId,
                state,
                effect?.数值 ?? '',
              );
            });
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'SHIELD_DELTA',
              threatValue: delta / readHpMax(currentTarget) * 100,
              evidence: {
                prototype,
                state,
                current,
                next: current + delta,
                delta,
                duration: Math.max(1, Number(effect?.持续回合 || 1)),
                applicationProbability: effectiveApplicationProbability,
              },
            });
            return;
          }
          const currentTarget = overlay.readUnit(unitId(target));
          const existingStateEntry = findStateEntry(currentTarget, effect);
          const existingState = existingStateEntry?.[1] || null;
          const requestedDuration = Math.max(1, Number(effect?.持续回合 || 1));
          const existingDuration = existingState
            ? Math.max(
                0,
                Number(
                  existingState?.duration ??
                  existingState?.持续回合 ??
                  existingState?.剩余回合 ??
                  0,
                ),
              )
            : 0;
          const stackable = effect?.可叠加 === true ||
            /叠加|层数/.test(
              String(effect?.叠加规则 || effect?.层数规则 || ''),
            );
          const refreshable = effect?.刷新 === true ||
            effect?.可刷新 === true ||
            requestedDuration > existingDuration;
          let marginal = false;
          overlay.changeUnit(unitId(target), unit => {
            marginal = addState(unit, {
              ...effect,
              __previewApplicationProbability: effectiveApplicationProbability,
            }, context.effectInstanceId);
          });
          const combatEffect = deriveStateCombatEffect(effect);
          const cancelsAction = marginal && (combatEffect?.skip_turn === true || combatEffect?.cannot_act === true);
          const outcomeKind = cancelsAction ? 'ACTION_CANCELLED' : prototype === '状态施加' ? 'STATE_CHANGED' : 'NEXT_ACTION_QUALITY_CHANGED';
          const effectEvidence = prototype === '位移执行'
            ? buildPositionEvidence(effect, combatEffect)
            : buildEffectEvidence(effect, prototype, combatEffect, {
                applicationProbability: effectiveApplicationProbability,
                ownApplicationProbability: effectiveOwnApplicationProbability,
                ...outcomeDependencyEvidence(context, unitId(target)),
                cancelsAction,
                marginal,
                outcomeDistribution: stateOutcomeDistribution,
                distributionGroupKey: stateApplicationOutcomeKey,
              });
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind,
            threatValue: 0,
            evidence: effectEvidence,
          });
          const damagePerTick = prototype === '状态施加'
            ? Math.max(
                0,
                Number(combatEffect?.dot_damage || 0) +
                readHpMax(currentTarget) * Math.max(0, Number(combatEffect?.dot_damage_ratio || 0)),
              )
            : 0;
          const healingPerTick = prototype === '状态施加'
            ? readHpMax(currentTarget) * Math.max(0, Number(combatEffect?.hot_heal_ratio || 0))
            : 0;
          if (marginal && (damagePerTick > 0 || healingPerTick > 0) && effectiveApplicationProbability > 0) {
            const tickCount = existingState && !stackable && refreshable
              ? Math.max(0, requestedDuration - existingDuration)
              : existingState && !stackable
                ? 0
                : requestedDuration;
            if (!(tickCount > 0)) return;
            const expectedDamage = damagePerTick > 0
              ? Math.min(readHp(currentTarget), damagePerTick * tickCount) * effectiveApplicationProbability
              : 0;
            const expectedHealing = healingPerTick > 0
              ? Math.min(
                  Math.max(0, readHpMax(currentTarget) - readHp(currentTarget)),
                  healingPerTick * tickCount,
                ) * effectiveApplicationProbability
              : 0;
            const expectedDelta = expectedHealing - expectedDamage;
            const realizedDamage = damagePerTick > 0
              ? Math.min(readHp(currentTarget), damagePerTick * tickCount)
              : 0;
            const realizedHealing = healingPerTick > 0
              ? Math.min(
                  Math.max(0, readHpMax(currentTarget) - readHp(currentTarget)),
                  healingPerTick * tickCount,
                )
              : 0;
            const realizedDelta = realizedHealing - realizedDamage;
            const outcomeDistribution = Object.freeze([
              Object.freeze({
                branchKey: 'state:resisted',
                probability: 1,
                conditionalOn: { [stateApplicationOutcomeKey]: 'RESISTED' },
                delta: 0,
              }),
              Object.freeze({
                branchKey: 'state:hit',
                probability: 1,
                conditionalOn: { [stateApplicationOutcomeKey]: 'HIT' },
                delta: realizedDelta,
              }),
            ]);
            const dotEffectInstanceId = `${context.effectInstanceId}:scheduled-dot`;
            const dotWindowId = `${dotEffectInstanceId}:${unitId(target)}:${tickCount}`;
            overlay.schedule({
              type: 'SCHEDULED_HP_DELTA',
              actorId: unitId(actor),
              targetId: unitId(target),
              sourceActionId: String(context?.rootActionId || '').trim(),
              effectInstanceId: dotEffectInstanceId,
              windowId: dotWindowId,
              damagePerTick,
              healingPerTick,
              tickCount,
              applicationProbability: effectiveApplicationProbability,
              expectedDamage,
              expectedHealing,
              expectedDelta,
            });
            ledger.addOutcome({
              ...context,
              effectInstanceId: dotEffectInstanceId,
              targetId: unitId(target),
              windowId: dotWindowId,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(expectedDelta) / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                prototype,
                state,
                delta: expectedDelta,
                expectedDamage,
                expectedHealing,
                damagePerTick,
                healingPerTick,
                tickCount,
                duration: tickCount,
                applicationProbability: effectiveApplicationProbability,
                ownApplicationProbability: effectiveOwnApplicationProbability,
                ...outcomeDependencyEvidence(context, unitId(target)),
                outcomeDistribution,
                distributionGroupKey: stateApplicationOutcomeKey,
              },
            });
          }
        });
        return;
      }
      if (prototype === '炸环') {
        const ringId = String(context.declaration?.ringId || effect?.魂环ID || '').trim();
        if (!ringId) throw new Error('battle_preview_ring_selection_missing');
        overlay.schedule({ type: 'RING_DESTROY', actorId: unitId(actor), ringId, multiplier: Number(effect?.强化倍率 || 1) });
        const cost = Math.max(0, Number(context.declaration?.ringCost || 20));
        ledger.addOutcome({ ...context, targetId: unitId(actor), outcomeKind: 'IRREVERSIBLE_ASSET_LOST', threatValue: cost, evidence: { ringId, cost } });
        ledger.addOutcome({ ...context, effectInstanceId: `${context.effectInstanceId}:boost`, targetId: unitId(actor), outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED', threatValue: 0, evidence: { multiplier: Number(effect?.强化倍率 || 1) } });
        return;
      }
      if (prototype === '时窗修正') {
        targets.forEach(target => {
          const adjustment = Number(effect?.调整回合 ?? effect?.调整次数 ?? 0);
          const currentTarget = overlay.readUnit(unitId(target));
          let scheduledHealthDelta = 0;
          let scheduledTickDelta = 0;
          overlay.changeUnit(unitId(target), unit => {
            const entries = stateEntries(unit).map(([key, state]) => {
              const next = cloneValue(state);
              const current = Math.max(0, Number(next?.duration ?? next?.持续回合 ?? 0));
              const mode = String(effect?.调整方式 || '').trim();
              const duration = /压缩|减少|缩短/.test(mode) ? Math.max(0, current - Math.abs(adjustment)) : current + Math.abs(adjustment);
              const tickDelta = duration - current;
              scheduledHealthDelta +=
                stateScheduledHpDelta(currentTarget, state, duration) -
                stateScheduledHpDelta(currentTarget, state, current);
              scheduledTickDelta += tickDelta;
              next.duration = duration;
              return [key, next];
            });
            replaceStates(unit, entries);
          });
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { adjustment } });
          if (Math.abs(scheduledHealthDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:window-health`,
              targetId: unitId(target),
              windowId: `${context.effectInstanceId}:window:${scheduledTickDelta}`,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(scheduledHealthDelta) / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                delta: scheduledHealthDelta,
                tickDelta: scheduledTickDelta,
                adjustment,
                tickCount: Math.max(1, Math.abs(scheduledTickDelta)),
              },
            });
          }
        });
        return;
      }
      if (prototype === '状态移除') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const matches = new Set(matchingStates(currentTarget, effect?.状态 || '任意状态').map(([key]) => key));
          const limit = Math.max(0, Number(effect?.数量 || matches.size));
          const removedKeys = [...matches].slice(0, limit || matches.size);
          const removedScheduledDelta = stateEntries(currentTarget)
            .filter(([key]) => removedKeys.includes(key))
            .reduce((sum, [, state]) => sum + stateScheduledHpDelta(currentTarget, state), 0);
          overlay.changeUnit(unitId(target), unit => replaceStates(unit, stateEntries(unit).filter(([key]) => !removedKeys.includes(key))));
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { removedKeys } });
          if (Math.abs(removedScheduledDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:removed-health`,
              targetId: unitId(target),
              windowId: `${context.effectInstanceId}:removed-state-window`,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(removedScheduledDelta) / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                delta: -removedScheduledDelta,
                removedScheduledDelta,
                removedKeys,
                tickCount: Math.max(
                  1,
                  ...stateEntries(currentTarget)
                    .filter(([key]) => removedKeys.includes(key))
                    .map(([, state]) =>
                      Math.max(
                        0,
                        Number(
                          state?.duration ??
                          state?.持续回合 ??
                          state?.剩余回合 ??
                          0,
                        ),
                      ),
                    ),
                ),
              },
            });
          }
        });
        return;
      }
      if (['规则防御', '规则改写', '机制抹消'].includes(prototype)) {
        targets.forEach(target => {
          const targetId = unitId(target);
          const matcher = effect?.抹消对象 && typeof effect.抹消对象 === 'object'
            ? cloneValue(effect.抹消对象)
            : { 原型: String(effect?.抹消对象 || '').trim() };
          let removedKeys = [];
          let removedScheduledDelta = 0;
          let removedTickCount = 0;
          const currentTarget = overlay.readUnit(targetId);
          overlay.changeUnit(targetId, unit => {
            if (prototype === '机制抹消') {
              removedKeys = stateEntries(unit)
                .filter(([, state]) => effectMatchesMechanismMatcher(state, matcher))
                .map(([key]) => key);
              removedScheduledDelta = stateEntries(unit)
                .filter(([key]) => removedKeys.includes(key))
                .reduce((sum, [, state]) => sum + stateScheduledHpDelta(currentTarget, state), 0);
              removedTickCount = Math.max(
                0,
                ...stateEntries(unit)
                  .filter(([key]) => removedKeys.includes(key))
                  .map(([, state]) => Math.max(
                    0,
                    Number(
                      state?.duration ??
                      state?.持续回合 ??
                      state?.剩余回合 ??
                      0,
                    ),
                  )),
              );
              if (removedKeys.length) {
                replaceStates(unit, stateEntries(unit).filter(([key]) => !removedKeys.includes(key)));
              }
              const stateKey = `preview:${context.effectInstanceId}:机制抹消`;
              unit.状态效果 ||= {};
              unit.状态效果[stateKey] = {
                状态: '机制抹消',
                状态名称: '机制抹消',
                类型: 'debuff',
                duration: Math.max(1, Number(effect?.持续回合 || 1)),
                来源原型摘要: prototype,
                抹消规则: [{ 抹消对象: matcher, 抹消方式: '持续阻断' }],
                战斗效果: {},
                面板修改比例: {},
                面板固定修正: {},
              };
            } else {
              const state = rulePrototypeState(effect, prototype, context);
              unit.状态效果 ||= {};
              unit.状态效果[`preview:${context.effectInstanceId}:${prototype}`] = state;
            }
          });
          const rule = prototype === '机制抹消'
            ? JSON.stringify(matcher)
            : String(effect?.规则 || effect?.防御对象 || prototype).trim();
          overlay.writeRule(`${targetId}:${prototype}:${rule}`, {
            ...cloneValue(effect),
            targetId,
            removedKeys,
          });
          ledger.addOutcome({
            ...context,
            targetId,
            outcomeKind: 'RULE_CHANGED',
            threatValue: 0,
            evidence: { prototype, rule, removedKeys, marginal: prototype !== '机制抹消' || removedKeys.length > 0 },
          });
          if (prototype === '机制抹消' && Math.abs(removedScheduledDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:removed-health`,
              targetId,
              windowId: `${context.effectInstanceId}:removed-state-window`,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(removedScheduledDelta) / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                delta: -removedScheduledDelta,
                removedScheduledDelta,
                removedKeys,
                tickCount: Math.max(1, removedTickCount),
                sourcePrototype: prototype,
                matcher,
              },
            });
          }
        });
        return;
      }
      if (prototype === '状态转移' || prototype === '状态交换') {
        const target = targets[0];
        if (!target) return;
        const currentTarget = overlay.readUnit(unitId(target));
        const transactionOverlay = overlay.fork();
        const transactionLedger = ledger.fork();
        if (prototype === '状态转移') {
          const source = String(effect?.来源 || '自身') === '自身' ? actor : currentTarget;
          const destination = unitId(source) === unitId(actor) ? currentTarget : actor;
          const matches = matchingStates(source, effect?.状态 || '任意状态');
          const selected = matches.slice(0, Math.max(1, Number(effect?.数量 || 1)));
          if (!selected.length) return;
          const selectedKeys = new Set(selected.map(([key]) => key));
          transactionOverlay.changeUnit(unitId(source), unit => replaceStates(unit, stateEntries(unit).filter(([key]) => !selectedKeys.has(key))));
          transactionOverlay.changeUnit(unitId(destination), unit => replaceStates(unit, [...stateEntries(unit), ...selected.map(([key, state]) => [`transferred:${context.effectInstanceId}:${key}`, state])]));
        } else {
          const actorNegative = matchingStates(actor, '任意负面');
          const targetPositive = matchingStates(currentTarget, '任意增益');
          if (!actorNegative.length || !targetPositive.length) return;
          const actorKey = actorNegative[0][0];
          const targetKey = targetPositive[0][0];
          transactionOverlay.changeUnit(unitId(actor), unit => replaceStates(unit, [...stateEntries(unit).filter(([key]) => key !== actorKey), [`exchange:${context.effectInstanceId}:gain`, targetPositive[0][1]]]));
          transactionOverlay.changeUnit(unitId(currentTarget), unit => replaceStates(unit, [...stateEntries(unit).filter(([key]) => key !== targetKey), [`exchange:${context.effectInstanceId}:loss`, actorNegative[0][1]]]));
        }
        transactionLedger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { prototype, atomic: true } });
        overlay.commitFrom(transactionOverlay);
        ledger.commitFrom(transactionLedger);
        return;
      }
      if (prototype === '机制授予') {
        const granted = nestedEffects(effect);
        if (!granted.length) throw new Error('battle_preview_granted_effect_missing');
        const trigger = String(effect?.触发条件 || '主动触发').trim();
        targets.forEach(target => {
          const targetId = unitId(target);
          if (/下次行动/.test(trigger)) {
            overlay.changeUnit(targetId, unit => {
              unit.状态效果 ||= {};
              unit.状态效果[`preview:${context.effectInstanceId}:机制授予`] = {
                状态: '机制授予',
                状态名称: '机制授予',
                类型: 'buff',
                duration: Math.max(1, Number(effect?.持续回合 || 1)),
                来源原型摘要: prototype,
                授予触发条件: trigger,
                授予效果: cloneValue(granted),
                可用次数: Math.max(1, Number(effect?.可用次数 || 1)),
                战斗效果: {},
                面板修改比例: {},
                面板固定修正: {},
              };
            });
          } else {
            granted.forEach((nested, index) => {
              const grantedActor = overlay.readUnit(targetId);
              const nestedContext = {
                ...context,
                actor: grantedActor,
                effectInstanceId: `${context.effectInstanceId}:grant:${index}`,
                depth: depth + 1,
                effectPath: effectContext.effectPath,
              };
              applyEffect(
                nested,
                resolveTargets(overlay.snapshot(), grantedActor, {
                  ...context.declaration,
                  actorId: targetId,
                  targetIds: [targetId],
                }, nested),
                overlay,
                ledger,
                nestedContext,
                depth + 1,
              );
            });
          }
          ledger.addOutcome({
            ...context,
            targetId,
            outcomeKind: 'STATE_CHANGED',
            threatValue: 0,
            evidence: { prototype, trigger, count: granted.length, marginal: true },
          });
        });
        overlay.schedule({
          type: 'MECHANISM_GRANT',
          actorId: unitId(actor),
          targetIds: targets.map(unitId),
          effects: cloneValue(granted),
          trigger,
        });
        return;
      }
      if (prototype === '复制执行') {
        const copied = nestedEffects(effect);
        if (!copied.length) throw new Error('battle_preview_copy_source_missing');
        copied.forEach((nested, index) => {
          const nestedContext = {
            ...context,
            effectInstanceId: `${context.effectInstanceId}:copy:${index}`,
            depth: depth + 1,
            effectPath: effectContext.effectPath,
          };
          applyEffect(nested, resolveTargets(overlay.snapshot(), actor, context.declaration, nested), overlay, ledger, nestedContext, depth + 1);
        });
        return;
      }
      if (prototype === '时光回溯') {
        const history = context.declaration?.historySnapshot || context.worldSnapshot?.回合开始快照;
        if (!history || typeof history !== 'object') throw new Error('battle_preview_rewind_history_missing');
        targets.forEach(target => {
          const currentUnit = overlay.readUnit(unitId(target));
          const historicUnit = findUnit(history, unitId(target));
          if (!historicUnit) throw new Error(`battle_preview_rewind_target_missing:${unitId(target)}`);
          overlay.writeUnit(cloneValue(historicUnit));
          const hpDelta = readHp(historicUnit) - readHp(currentUnit);
          if (Math.abs(hpDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'HP_DELTA',
              threatValue: Math.abs(hpDelta) / Math.max(1, readHpMax(currentUnit)) * 100,
              evidence: {
                rewind: true,
                current: readHp(currentUnit),
                next: readHp(historicUnit),
                delta: hpDelta,
              },
            });
          }
          ['魂力', '精神力', '体力'].forEach((resource, index) => {
            const current = readResource(currentUnit, resource);
            const next = readResource(historicUnit, resource);
            if (Math.abs(next - current) <= 1e-9) return;
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:resource:${index}`,
              targetId: unitId(target),
              outcomeKind: 'RESOURCE_OPTION_CHANGED',
              threatValue: 0,
              evidence: { rewind: true, resource, current, next, delta: next - current },
            });
          });
          ledger.addOutcome({
            ...context,
            effectInstanceId: `${context.effectInstanceId}:state`,
            targetId: unitId(target),
            outcomeKind: 'STATE_CHANGED',
            threatValue: 0,
            evidence: { rewind: true },
          });
        });
        return;
      }
      if (prototype === '召唤生成') {
        const summonName = String(effect?.召唤物名称 || '').trim();
        if (!summonName) throw new Error('battle_preview_summon_name_missing');
        const count = Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
        const duration = Math.max(1, Math.floor(Number(effect?.持续回合 || 1)) || 1);
        const actionMode = String(effect?.行动模式 || '协同攻击').trim() || '协同攻击';
        const summonType = String(effect?.召唤单位类型 || effect?.召唤类型 || '魂兽').trim() || '魂兽';
        const inheritRatio = clamp(Number(
          effect?.继承属性比例 || effect?.强度 || effect?.召唤强度 || 0.35,
        ), 0.05, 2);
        const actorSide = sideOf(context.worldSnapshot, actor);
        const summonIds = [];
        const summonProbabilityProfile = effectProbabilityProfile(
          context,
          unitId(targets[0]),
        );
        const applicationProbability =
          summonProbabilityProfile.applicationProbability;
        const summonOutcomeDependency = outcomeDependencyEvidence(
          context,
          unitId(targets[0]),
        );
        const probabilityGroupKey = [
          context.rootActionId,
          context.effectInstanceId,
          context.windowId,
          unitId(actor),
        ].join('|');
        const summonDefinitions = [];
        for (let index = 0; index < count; index += 1) {
          const displayName = count > 1 ? `${summonName}#${index + 1}` : summonName;
          const summonId = summonInstanceId(
            context.rootActionId,
            context.effectInstanceId,
            index + 1,
          );
          summonIds.push(summonId);
          const hpMax = Math.max(1, Math.floor(readHpMax(actor) * inheritRatio));
          const staminaMax = Math.max(1, Math.floor(readResourceMax(actor, '体力') * inheritRatio));
          const soulMax = Math.max(1, Math.floor(readResourceMax(actor, '魂力') * inheritRatio));
          const mentalMax = Math.max(1, Math.floor(readResourceMax(actor, '精神力') * inheritRatio));
          const summonUnit = {
            id: summonId,
            name: displayName,
            名称: displayName,
            召唤键: summonId,
            类型: summonType,
            召唤单位类型: summonType,
            单位性质: '召唤物',
            行动模式: actionMode,
            宿主名: unitName(actor),
            阵营: /enemy|敌方|对方/i.test(actorSide) ? '敌方' : '玩家',
            已消散: false,
            剩余窗口: duration,
            __battleRuntime: {
              summonWindow: {
                windowId: `${summonId}:window`,
                remainingWindows: duration,
              },
            },
            hp: hpMax,
            hp_max: hpMax,
            HP: hpMax,
            HP上限: hpMax,
            vit: staminaMax,
            vit_max: staminaMax,
            sta: staminaMax,
            sta_max: staminaMax,
            体力: staminaMax,
            体力上限: staminaMax,
            sp: soulMax,
            sp_max: soulMax,
            魂力: soulMax,
            魂力上限: soulMax,
            men: mentalMax,
            men_max: mentalMax,
            精神力: mentalMax,
            精神力上限: mentalMax,
            str: Math.max(1, Math.floor(readCombatStat(actor, 'str') * inheritRatio)),
            def: Math.max(1, Math.floor(readCombatStat(actor, 'def') * inheritRatio)),
            agi: Math.max(1, Math.floor(readCombatStat(actor, 'agi') * inheritRatio)),
            状态: { 存活: true, 行动: '战斗' },
            状态效果: {},
            持续效果: {},
            技能列表: Array.isArray(effect?.技能列表) && effect.技能列表.length
              ? cloneValue(effect.技能列表)
              : [{
                  name: '普通攻击',
                  魂技名: '普通攻击',
                  消耗: '无',
                  前摇: 10,
                  _效果数组: [{
                    原型: '伤害结算',
                    目标: '单体',
                    威力倍率: Math.max(25, Math.round(50 * inheritRatio)),
                    伤害类型: '近身攻击',
                  }],
                }],
          };
          const summonDefinitionHash = stableHash({
            summonName: displayName,
            summonType,
            mode: actionMode,
            duration,
            inheritRatio,
            skills: Array.isArray(effect?.技能列表) ? effect.技能列表 : [],
          });
          summonUnit.__definitionHash = summonDefinitionHash;
          summonDefinitions.push(cloneValue(summonUnit));
          overlay.writeSummon(summonUnit, summonDefinitionHash);
          const summonWorld = overlay.snapshot();
          const summonSkill = summonUnit.技能列表[0] || null;
          const summonEffects = Array.isArray(summonSkill?._效果数组)
            ? summonSkill._效果数组.filter(item => item && typeof item === 'object')
            : [];
          const primarySummonEffect = summonEffects[0] || {};
          const summonTargets = summonSkill
            ? resolveTargets(
                summonWorld,
                overlay.readUnit(summonId) || summonUnit,
                {
                  actorId: summonId,
                  actionKind: 'RELEASE_SKILL',
                  skill: summonSkill,
                },
                primarySummonEffect,
              )
            : [];
          const summonTargetPotentials = summonTargets.map(target =>
            calculateDirectPotential(
              overlay.readUnit(summonId) || summonUnit,
              target,
              {
                actionKind: 'RELEASE_SKILL',
                skill: summonSkill,
                worldSnapshot: summonWorld,
              },
            )
          );
          const summonActionPotential = /群体|全场/.test(String(primarySummonEffect?.目标 || '').trim())
            ? summonTargetPotentials.reduce((sum, value) => sum + value, 0)
            : Math.max(0, ...summonTargetPotentials);
          ledger.addOutcome({
            ...context,
            effectInstanceId: `${context.effectInstanceId}:summon:${index + 1}`,
            targetId: summonId,
            windowId: `${summonId}:window`,
            outcomeKind: 'SUMMON_WINDOW',
            threatValue: 0,
            evidence: {
              summonName: displayName,
              actionMode,
              duration,
              immediateWindowConsumed: actionMode === '协同攻击',
              remainingWindows: actionMode === '协同攻击' ? Math.max(0, duration - 1) : duration,
              actionPotential: summonActionPotential,
              applicationProbability,
              ownApplicationProbability:
                summonProbabilityProfile.ownApplicationProbability,
              ...summonOutcomeDependency,
              probabilityGroupKey,
              instanceId: summonId,
              definitionHash: summonDefinitionHash,
            },
          });
        }
        overlay.schedule({
          type: 'SUMMON_CREATE',
          actorId: unitId(actor),
          effectInstanceId: context.effectInstanceId,
          summonIds,
          summonName,
          summonType,
          count,
          actionMode,
          duration,
          strength: Math.max(0.01, Number(effect?.强度 || effect?.召唤强度 || 1)),
          inheritRatio: Math.max(0, Number(effect?.继承属性比例 || 0)),
          applicationProbability,
          ownApplicationProbability:
            summonProbabilityProfile.ownApplicationProbability,
          ...summonOutcomeDependency,
          probabilityGroupKey,
          summonDefinitions,
        });
      }
    } finally {
      context.nodeBudget.activeFingerprints.delete(activeFingerprint);
    }
  }

  function settleImmediateCooperativeSummons({
    overlay,
    ledger,
    rootActionId,
    declaration,
    worldSnapshot,
    nodeBudget,
    battleIntent,
    damageMultiplierByTarget,
    damageMultiplierResolver,
    hitProbabilityResolver,
  }) {
    const summonEvents = overlay.scheduledEvents.filter(event =>
      event?.type === 'SUMMON_CREATE' &&
      String(event?.actionMode || '').trim() === '协同攻击'
    );
    if (!summonEvents.length) return;
    const hostHitTargetIds = [...new Set(ledger.entries
      .filter(entry =>
        entry?.rootCauseId === rootActionId &&
        entry?.outcomeKind === 'HP_DELTA' &&
        !String(entry?.effectInstanceId || '').includes(':summon-assist:') &&
        Number(entry?.evidence?.expectedDamage || 0) > 0
      )
      .map(entry => String(entry?.targetId || '').trim())
      .filter(Boolean))];
    summonEvents.forEach(event => {
      (event.summonIds || []).forEach((summonId, summonIndex) => {
        const summon = overlay.createdSummons.get(summonId);
        if (!summon) throw new Error(`battle_preview_cooperative_summon_missing:${summonId}`);
        const snapshot = overlay.snapshot();
        const summonSide = sideOf(snapshot, summon);
        const hostileUnits = listUnits(snapshot)
          .filter(entry => entry.side !== summonSide && isBattleCapable(entry.unit))
          .map(entry => entry.unit);
        const preferredTarget = hostHitTargetIds
          .map(targetId => hostileUnits.find(unit => unitId(unit) === targetId))
          .find(Boolean);
        const target = preferredTarget || hostileUnits[0] || null;
        const skill = Array.isArray(summon?.技能列表) ? summon.技能列表[0] : null;
        const damageEffects = Array.isArray(skill?._效果数组)
          ? skill._效果数组.filter(effect => String(effect?.原型 || '').trim() === '伤害结算')
          : [];
        if (target && damageEffects.length) {
          const assistDeclaration = {
            actionId: `${rootActionId}:summon-assist:${summonIndex + 1}`,
            actorId: summonId,
            actionKind: 'RELEASE_SKILL',
            targetIds: [unitId(target)],
            skill,
          };
          damageEffects.forEach((damageEffect, effectIndex) => {
            const assistSnapshot = overlay.snapshot();
            const assistActor = overlay.readUnit(summonId);
            const targets = resolveTargets(assistSnapshot, assistActor, assistDeclaration, damageEffect);
            if (!targets.length) return;
            applyEffect(damageEffect, targets, overlay, ledger, {
              actor: assistActor,
              declaration: assistDeclaration,
              worldSnapshot,
              nodeBudget,
              depth: 1,
              effectPath: [],
              rootActionId,
              effectInstanceId: `${rootActionId}:summon-assist:${summonIndex + 1}:effect:${effectIndex}`,
              windowId: `${summonId}:window:1`,
              battleIntent,
              damageMultiplierByTarget,
              damageMultiplierResolver,
              hitProbabilityResolver,
            }, 1);
          });
        }
        const remainingWindows = Math.max(0, Number(summon?.剩余窗口 || event?.duration || 1) - 1);
        if (remainingWindows <= 0) {
          overlay.removeSummon(summonId);
          return;
        }
        overlay.changeSummon(summonId, unit => {
          unit.剩余窗口 = remainingWindows;
          unit.__battleRuntime = {
            ...(unit.__battleRuntime || {}),
            summonWindow: {
              ...(unit.__battleRuntime?.summonWindow || {}),
              remainingWindows,
            },
          };
        });
      });
    });
  }

  function basicAttackEffect() {
    return BASIC_ATTACK_EFFECT;
  }

  function calculateBaseActionValue(actor = {}, target = {}, declaration = {}) {
    const effects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object') : [];
    let remainingShieldAbsorptionCap = Number.isFinite(Number(declaration?.shieldAbsorptionCap))
      ? Math.max(0, Number(declaration.shieldAbsorptionCap))
      : Number.POSITIVE_INFINITY;
    return effects.filter(effect => effectConditionEnabled(effect, declaration?.worldSnapshot || {}, actor, target)).reduce((sum, effect) => {
      if (String(effect?.原型 || '').trim() === '伤害结算' && target) {
        const expectedDamage = calculateBaseDamage(effect, actor, target) * estimateHitProbability(actor, target, effect);
        const availableHp = declaration?.capacityMode === true ? readHpMax(target) : readHp(target);
        return sum + Math.min(availableHp, expectedDamage) / readHpMax(target) * 100;
      }
      if (String(effect?.原型 || '').trim() === '资源变化' && /生命|HP/i.test(String(effect?.资源 || ''))) {
        const base = readHpMax(target || actor);
        const missing = base - readHp(target || actor);
        return sum + Math.min(missing, Math.max(0, parseSignedValue(effect?.数值, base))) / base * 100;
      }
      if (String(effect?.原型 || '').trim() === '护盾变化') {
        const base = readHpMax(target || actor);
        const realizedShield = Math.min(
          calculateShieldGain(target || actor, parseSignedValue(effect?.数值, base)),
          remainingShieldAbsorptionCap,
        );
        remainingShieldAbsorptionCap = Math.max(0, remainingShieldAbsorptionCap - realizedShield);
        return sum + realizedShield / base * 100;
      }
      if (
        String(effect?.原型 || '').trim() === '状态施加' &&
        /护盾|屏障|结界/.test(String(effect?.状态 || '').trim())
      ) {
        const base = readHpMax(target || actor);
        const realizedShield = Math.min(
          calculateShieldGain(target || actor, parseSignedValue(effect?.数值, base)),
          remainingShieldAbsorptionCap,
        );
        remainingShieldAbsorptionCap = Math.max(0, remainingShieldAbsorptionCap - realizedShield);
        return sum + realizedShield / base * 100;
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

  function calculateDirectPotential(actor = {}, target = {}, declaration = {}) {
    return Math.max(0, calculateBaseActionValue(actor, target, { ...declaration, capacityMode: true }));
  }

  function calculateAtomicActionPotential(input = {}) {
    const frozenDirectPotential = input?.frozenDirectPotential && typeof input.frozenDirectPotential === 'object'
      ? input.frozenDirectPotential
      : {};
    const readFrozen = targetId => Math.max(0, Number(frozenDirectPotential[String(targetId || '').trim()] || 0));
    const contributions = Array.isArray(input?.contributions) ? input.contributions : [];
    const directPotential = Math.max(0, Number(input?.directPotential || 0));
    const denied = new Set();
    const granted = new Set();
    contributions.forEach(entry => {
      const outcomeKind = String(entry?.outcomeKind || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      if (!targetId) return;
      if (outcomeKind === 'ACTION_CANCELLED') denied.add(targetId);
      if (
        outcomeKind === 'ACTION_GRANTED' ||
        outcomeKind === 'SUMMON_WINDOW' ||
        (
          outcomeKind === 'RESOURCE_OPTION_CHANGED' &&
          Number(entry?.evidence?.delta || 0) > 0
        )
      ) granted.add(targetId);
    });
    const grantedPotential = [...granted].reduce((sum, targetId) => {
      const contribution = contributions.find(entry =>
        String(entry?.targetId || '').trim() === targetId &&
        String(entry?.outcomeKind || '').trim() === 'SUMMON_WINDOW'
      );
      return sum + (
        contribution
          ? Math.max(0, Number(contribution?.evidence?.actionPotential || 0))
          : readFrozen(targetId)
      );
    }, 0);
    return directPotential +
      [...denied].reduce((sum, targetId) => sum + readFrozen(targetId), 0) +
      grantedPotential;
  }

  function calculateSequencePotential(input = {}) {
    return Math.max(0, Number(input?.firstOpportunityPotential || 0)) +
      0.5 * Math.max(0, Number(input?.secondOpportunityPotential || 0));
  }

  function calculateTwoOpportunityCapacity(input = {}) {
    const unit = input?.unit || {};
    if (!isAlive(unit)) return 0;
    const survivalProbability = clamp(input?.survivalProbability ?? readHp(unit) / readHpMax(unit), 0, 1);
    const firstAvailability = clamp(input?.firstOpportunityAvailability ?? 1, 0, 1);
    const secondAvailability = clamp(input?.secondOpportunityAvailability ?? 1, 0, 1);
    return survivalProbability * (
      firstAvailability * Math.max(0, Number(input?.firstOpportunityPotential || 0)) +
      0.5 * secondAvailability * Math.max(0, Number(input?.secondOpportunityPotential || 0))
    );
  }

  function findInventoryEntry(unit = {}, declaration = {}) {
    const wanted = new Set([
      declaration?.irreversibleAsset?.assetId,
      declaration?.skill?.id,
      declaration?.skill?.物品ID,
      declaration?.skill?.__物品名,
      declaration?.skill?.物品名,
      declaration?.skill?.名称,
      declaration?.skill?.name,
    ].map(value => String(value || '').trim()).filter(Boolean));
    const visited = new Set();
    let found = null;
    const visit = (value, key = '') => {
      if (found || !value || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value);
      if (!Array.isArray(value)) {
        const identifiers = [
          key,
          value?.id,
          value?.物品ID,
          value?.__物品名,
          value?.物品名,
          value?.名称,
          value?.name,
        ].map(item => String(item || '').trim()).filter(Boolean);
        if (identifiers.some(identifier => wanted.has(identifier)) && (value?.数量 !== undefined || value?.quantity !== undefined)) {
          found = value;
          return;
        }
      }
      if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${key}:${index}`));
      else Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    ['背包', '库存', '物品', '战斗物品'].forEach(key => visit(unit?.[key], key));
    return found;
  }

  function previewCreationCarrier(effect, overlay, ledger, context) {
    const useEffects = Array.isArray(effect?.使用效果) ? effect.使用效果 : [];
    if (!useEffects.length) throw new Error('battle_preview_creation_effects_missing');
    collectEffects(effect).forEach(validateEffect);
    const activeFingerprint = consumePreviewNode(context, effect);
    try {
      const skill = context.declaration?.skill || {};
      const product = skill?.生成物 || skill?.产物 || skill?.制作产物 || null;
      const productId = String(
        product?.id ||
        product?.物品ID ||
        product?.名称 ||
        product?.name ||
        (typeof product === 'string' || typeof product === 'number' ? product : '') ||
        skill?.魂技名 ||
        skill?.name ||
        '未命名造物'
      ).trim();
      const quantity = Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
      const actorId = unitId(context.actor);
      const recipientId = String(
        context?.declaration?.creationRecipientId ||
        actorId,
      ).trim();
      const recipient = overlay.readUnit(recipientId);
      if (
        !recipient ||
        sideOf(context.worldSnapshot, recipient) !==
          sideOf(context.worldSnapshot, context.actor) ||
        !isPhysicallyAlive(recipient)
      ) {
        throw new Error(`battle_preview_creation_recipient_invalid:${recipientId || 'missing'}`);
      }
      overlay.changeUnit(recipientId, unit => {
        if (!unit.背包 || typeof unit.背包 !== 'object' || Array.isArray(unit.背包)) unit.背包 = {};
        const existing = unit.背包[productId] && typeof unit.背包[productId] === 'object'
          ? unit.背包[productId]
          : {};
        unit.背包[productId] = {
          ...existing,
          id: String(existing.id || productId).trim() || productId,
          name: String(existing.name || productId).trim() || productId,
          名称: String(existing.名称 || productId).trim() || productId,
          物品名: String(existing.物品名 || productId).trim() || productId,
          类型: String(existing.类型 || effect?.物品类型 || '物品').trim() || '物品',
          数量: Math.max(0, Number(existing.数量 || 0)) + quantity,
          有效期tick: Math.max(Number(existing.有效期tick || 0), Math.max(0, Number(effect?.有效期tick || 0))),
          来源: String(existing.来源 || skill?.魂技名 || skill?.name || context.rootActionId || '').trim(),
          使用效果: cloneValue(useEffects),
        };
      });
      overlay.schedule({
        eventKind: 'item_created',
        rootActionId: context.rootActionId,
        effectInstanceId: context.effectInstanceId,
        actorId,
        recipientId,
        productId,
        quantity,
      });
      ledger.addOutcome({
        ...context,
        targetId: recipientId,
        outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED',
        threatValue: 0,
        evidence: {
          delta: 1,
          productId,
          quantity,
          recipientId,
          useEffectCount: useEffects.length,
        },
      });
    } finally {
      context.nodeBudget.activeFingerprints.delete(activeFingerprint);
    }
  }

  function buildCacheKey(input = {}) {
    const damageMultiplierKey = Object.entries(input.damageMultiplierByTarget || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([targetId, multiplier]) => `${JSON.stringify(targetId)}:${JSON.stringify(Number(multiplier) || 0)}`)
      .join(',');
    const evadeProbabilityKey = Object.entries(input.evadeProbabilityByTarget || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([targetId, probability]) =>
        `${JSON.stringify(targetId)}:${JSON.stringify(Number(probability) || 0)}`
      )
      .join(',');
    return [
      input.worldRevision || stableHash(input.worldSnapshot || {}),
      input.beliefRevision || stableHash(input.beliefSnapshot || {}),
      input.actorId || '',
      input.actionFingerprint || stableHash(input.declaration || {}),
      (input.declaration?.targetIds || []).join(','),
      damageMultiplierKey,
      evadeProbabilityKey,
      stableHash(input.forcedApplicationProbabilityByEffect || {}),
      input.collectProbabilityBranches === true ? 'collect-probability-branches' : '',
      String(input.paymentMode || 'FORMAL').trim().toUpperCase(),
      input.horizon || 'SHALLOW',
    ].join('|');
  }

  function forcedApplicationProbability(input = {}, effectInstanceId = '', targetId = '') {
    const overrides = input?.forcedApplicationProbabilityByEffect;
    if (!overrides || typeof overrides !== 'object') return null;
    const effectKey = [
      String(effectInstanceId || '').trim(),
      String(targetId || '').trim(),
    ].join('|');
    if (!Object.prototype.hasOwnProperty.call(overrides, effectKey)) return null;
    const value = Number(overrides[effectKey]);
    return Number.isFinite(value) ? clamp(value, 0, 1) : null;
  }

  function previewAction(input = {}) {
    const worldSnapshot = input?.worldSnapshot;
    const declaration = input?.declaration;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_preview_world_missing');
    if (!declaration || typeof declaration !== 'object') throw new TypeError('battle_preview_declaration_missing');
    const dependencyCapture = {
      recorder: input?.dependencyRecorder,
      reads: new Map(),
    };
    dependencyCaptureStack.push(dependencyCapture);
    try {
    const actor = findUnit(worldSnapshot, input?.actorId || declaration?.actorId);
    if (!actor) throw new Error('battle_preview_actor_missing');
    if (!isAlive(actor)) throw new Error('battle_preview_actor_unavailable');
    const paymentMode = String(input?.paymentMode || 'FORMAL').trim().toUpperCase();
    if (!['FORMAL', 'EXTERNAL_TIMELINE'].includes(paymentMode)) {
      throw new Error(`BATTLE_PREVIEW_PAYMENT_MODE_INVALID:${paymentMode || 'missing'}`);
    }
    const budgetLimit = Math.max(1, Math.min(MAX_PREVIEW_NODES, Number(input?.previewBudget?.maxNodes || MAX_PREVIEW_NODES)));
    const cacheKey = buildCacheKey(input);
    if (previewCache.has(cacheKey)) {
      metrics.cacheHits += 1;
      const cached = previewCache.get(cacheKey);
      (cached?.dependencyReads || []).forEach(([key, value]) => {
        recordPreviewDependency(key, value);
      });
      return cached;
    }
    metrics.previewCalls += 1;
    const rootActionId = String(declaration?.actionId || declaration?.candidateId || `preview:${cacheKey}`).trim();
    const overlay = new PreviewOverlay(worldSnapshot, input?.worldRevision);
    const ledger = new ContributionLedger();
    const fusion = resolveFusionAction(worldSnapshot, actor, declaration?.skill || {}, {
      resourceCosts: declaration?.resourceCosts || {},
      requirePendingOpportunity: input?.allowProjectedFusion !== true,
      ignoreResourceAvailability: input?.allowProjectedFusion === true,
    });
    if (fusion.required && !fusion.valid) throw new Error(`battle_preview_${fusion.reason.toLowerCase()}`);
    const costPayers = fusion.required ? fusion.participants : [actor];
    if (fusion.required && paymentMode === 'FORMAL') {
      costPayers.forEach(participant => {
        overlay.changeUnit(unitId(participant), unit => {
          unit.__battleRuntime = unit?.__battleRuntime && typeof unit.__battleRuntime === 'object'
            ? unit.__battleRuntime
            : {};
          unit.__battleRuntime.fusionUsageKeys = [...new Set([
            ...(Array.isArray(unit.__battleRuntime.fusionUsageKeys) ? unit.__battleRuntime.fusionUsageKeys : []),
            fusion.fusionKey,
          ].filter(Boolean))];
          if (fusion.partnerIds.includes(unitId(unit))) {
            const opportunity = unit.__battleRuntime.naturalOpportunity && typeof unit.__battleRuntime.naturalOpportunity === 'object'
              ? unit.__battleRuntime.naturalOpportunity
              : {};
            unit.__battleRuntime.naturalOpportunity = {
              ...opportunity,
              status: 'CONSUMED_BY_FUSION',
              consumedByActionId: rootActionId,
              fusionKey: fusion.fusionKey,
            };
          }
        });
      });
    }
    if (declaration?.irreversibleAsset && typeof declaration.irreversibleAsset === 'object') {
      ledger.addOutcome({
        rootActionId,
        effectInstanceId: `${rootActionId}:asset`,
        targetId: unitId(actor),
        windowId: 'ACTION_COST',
        outcomeKind: 'IRREVERSIBLE_ASSET_LOST',
        threatValue: Math.max(0, Number(declaration.irreversibleAsset.cost || 0)),
        evidence: cloneValue(declaration.irreversibleAsset),
      });
    }
    if (paymentMode === 'FORMAL') {
      costPayers.forEach((payer, payerIndex) => {
        Object.entries(declaration?.resourceCosts || {}).forEach(([resource, rawCost], index) => {
          const costText = String(rawCost ?? '').trim();
          const numericCost = Math.max(0, Number.parseFloat(costText) || 0);
          if (!(numericCost > 1e-9)) return;
          const currentPayer = overlay.readUnit(unitId(payer));
          const cost = costText.includes('%')
            ? readResourceMax(currentPayer, resource) * numericCost / 100
            : numericCost;
          const before = readResource(currentPayer, resource);
          if (before + 1e-9 < cost) throw new Error(`battle_preview_resource_insufficient:${resource}`);
          overlay.changeUnit(unitId(payer), unit => setResourceValue(unit, resource, before - cost));
          ledger.addOutcome({
            rootActionId,
            effectInstanceId: `${rootActionId}:cost:${payerIndex}:${index}`,
            targetId: unitId(payer),
            windowId: 'ACTION_COST',
            outcomeKind: 'RESOURCE_OPTION_CHANGED',
            threatValue: 0,
            evidence: { resource, before, next: before - cost, delta: -cost, fusionKey: fusion.fusionKey || '' },
          });
        });
      });
    }
    if (String(declaration?.actionKind || '').trim() === 'USE_ITEM') {
      overlay.changeUnit(unitId(actor), unit => {
        const inventoryItem = findInventoryEntry(unit, declaration);
        const quantityBefore = Math.max(0, Number(inventoryItem?.数量 ?? inventoryItem?.quantity ?? 0));
        if (!inventoryItem || quantityBefore < 1) {
          throw new Error(`battle_preview_item_unavailable:${String(declaration?.irreversibleAsset?.assetId || declaration?.skill?.name || '').trim()}`);
        }
        const remainingQuantity = quantityBefore - 1;
        if (inventoryItem.数量 !== undefined || inventoryItem.quantity === undefined) inventoryItem.数量 = remainingQuantity;
        if (inventoryItem.quantity !== undefined) inventoryItem.quantity = remainingQuantity;
      });
    }
    const baseEffects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object') : [];
    const grants = declaration?.__includeGrantedEffects === false ? [] : pendingGrantedEffects(actor);
    const effects = [
      ...grants.map(entry => ({ ...entry.effect, effectId: entry.effectId })),
      ...baseEffects,
    ];
    if (!effects.length && !['DEFEND', 'EVADE', 'WITHDRAW', 'EQUIP', 'OBSERVE'].includes(String(declaration?.actionKind || '').trim())) {
      throw new Error('battle_preview_action_effects_missing');
    }
    if (grants.length) {
      const consumedKeys = new Set(grants.map(entry => entry.stateKey));
      overlay.changeUnit(unitId(actor), unit => {
        replaceStates(unit, stateEntries(unit).filter(([key]) => !consumedKeys.has(key)));
      });
    }
    const nodeBudget = { count: 0, limit: budgetLimit, activeFingerprints: new Set() };
    const primarySuccessProbability = new Map();
    const primaryOutcomeKeyByTarget = new Map();
    const primaryOutcomeDistributionByTarget = new Map();
    let actionDamageMultiplier = 1;
    effects.forEach((effect, index) => {
      const effectWorldSnapshot = overlay.snapshot();
      const effectActor = overlay.readUnit(unitId(actor)) || actor;
      const targets = resolveTargets(effectWorldSnapshot, effectActor, declaration, effect);
      if (!targets.length) return;
      const followsPrimary = index > 0 && String(effect?.生效方式 || '').trim() === '跟随主原型';
      const context = {
        actor: effectActor,
        declaration,
        worldSnapshot: effectWorldSnapshot,
        nodeBudget,
        depth: 0,
        effectPath: [],
        rootActionId,
        effectInstanceId: String(effect?.effectId || effect?.效果ID || `${rootActionId}:effect:${index}`).trim(),
        windowId: `round:${Number(worldSnapshot?.回合 || 0)}:effect:${index}`,
        battleIntent: input?.battleIntent || {},
        damageMultiplierByTarget: input?.damageMultiplierByTarget || {},
        evadeProbabilityByTarget: input?.evadeProbabilityByTarget || {},
        damageMultiplierResolver: input?.damageMultiplierResolver,
        hitProbabilityResolver: input?.hitProbabilityResolver,
        applicationProbabilityResolver: input?.applicationProbabilityResolver,
        forcedApplicationProbabilityByEffect:
          input?.forcedApplicationProbabilityByEffect || {},
        actionDamageMultiplier,
        primarySucceeded: false,
        primaryOutcomeKeyByTarget,
        primaryOutcomeDistributionByTarget,
      };
      context.primarySucceededByTarget = new Map(
        targets.map(target => [
          unitId(target),
          primarySuccessProbability.get(unitId(target)) >= 1 - 1e-9,
        ]),
      );
      context.primarySuccessProbabilityByTarget = new Map(
        targets.map(target => [
          unitId(target),
          primarySuccessProbability.get(unitId(target)),
        ]),
      );
      context.primaryOutcomeByTarget = new Map(
        targets.map(target => {
          const distribution = primaryOutcomeDistributionByTarget.get(unitId(target)) || [];
          return [
            unitId(target),
            distribution.length === 1
              ? String(distribution[0]?.outcome || '').trim().toUpperCase()
              : '',
          ];
        }),
      );
      const prototype = String(effect?.原型 || '').trim();
      const hasOwnApplicationProbability =
        effect?.成功率 !== undefined ||
        effect?.触发概率 !== undefined;
      const ownApplicationProbabilityByTarget = new Map(
        targets.map(target => {
          const targetId = unitId(target);
          const baseApplicationProbability = hasOwnApplicationProbability
            ? normalizeEffectProbability(
                effect?.成功率 ?? effect?.触发概率,
                1,
              )
            : 1;
          const resolvedApplicationProbability =
            typeof input?.applicationProbabilityResolver === 'function'
              ? input.applicationProbabilityResolver({
                  targetId,
                  actor: effectActor,
                  effect,
                  effectInstanceId: context.effectInstanceId,
                  baseApplicationProbability,
                  recordDependency: recordPreviewDependency,
                })
              : baseApplicationProbability;
          const forcedProbability = forcedApplicationProbability(
            input,
            context.effectInstanceId,
            targetId,
          );
          return [
            targetId,
            forcedProbability === null
              ? clamp(
                  Number.isFinite(Number(resolvedApplicationProbability))
                    ? Number(resolvedApplicationProbability)
                    : baseApplicationProbability,
                  0,
                  1,
                )
              : forcedProbability,
          ];
        }),
      );
      if (!String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果)) {
        previewCreationCarrier(effect, overlay, ledger, context);
        return;
      }
      context.ownApplicationProbabilityByTarget =
        ownApplicationProbabilityByTarget;
      if (followsPrimary) {
        context.applicationProbabilityByTarget = new Map(
          targets.map(target => {
            const targetId = unitId(target);
            return [
              targetId,
              clamp(
                Number(primarySuccessProbability.get(targetId) ?? 0),
                0,
                1,
              ),
            ];
          })
        );
        context.requiredOutcomeKeyByTarget = new Map(
          targets.map(target => [unitId(target), primaryOutcomeKeyByTarget.get(unitId(target)) || ''])
        );
        context.requiredOutcomeValuesByTarget = new Map(
          targets.map(target => [unitId(target), ['HIT']])
        );
        context.requiredOutcomeUniverseByTarget = new Map(
          targets.map(target => [
            unitId(target),
            (primaryOutcomeDistributionByTarget.get(unitId(target)) || [])
              .map(row => String(row?.outcome || '').trim().toUpperCase())
              .filter(Boolean),
          ])
        );
      } else if (index === 0) {
        context.outcomeAssignmentKeyByTarget = new Map(
          targets.map(target => {
            const key = [
              rootActionId,
              context.effectInstanceId,
              context.windowId,
              unitId(target),
              'primary-resolution',
            ].join('|');
            primaryOutcomeKeyByTarget.set(unitId(target), key);
            return [unitId(target), key];
          })
        );
      }
      if (
        !followsPrimary &&
        !['伤害结算', '状态施加'].includes(prototype)
      ) {
        context.applicationProbabilityByTarget =
          ownApplicationProbabilityByTarget;
      }
      applyEffect(effect, targets, overlay, ledger, context, 0);
      if (String(effect?.原型 || '').trim() === '炸环') {
        actionDamageMultiplier *= Math.max(0, Number(effect?.强化倍率 || 1));
      }
      if (index === 0) {
        targets.forEach(target => {
          const targetId = unitId(target);
          if (prototype === '伤害结算') {
            const baseHitProbability = estimateHitProbability(effectActor, target, effect);
            const resolvedHitProbability = typeof input?.hitProbabilityResolver === 'function'
              ? input.hitProbabilityResolver({
                  targetId: unitId(target),
                  actor: effectActor,
                  effect,
                  effectInstanceId: context.effectInstanceId,
                  baseHitProbability,
                  recordDependency: recordPreviewDependency,
                })
              : null;
            const perSegment = clamp(
              Number.isFinite(Number(resolvedHitProbability))
                ? Number(resolvedHitProbability)
                : baseHitProbability,
              0,
              1,
            );
            const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 || effect?.段数 || 1)) || 1);
            const hitProbability = 1 - Math.pow(1 - perSegment, segments);
            const evadeProbability = clamp(Number(
              input?.evadeProbabilityByTarget?.[targetId] ??
              input?.evadeProbabilityByTarget?.get?.(targetId) ??
              0
            ), 0, 1);
            const distribution = [
              ...(evadeProbability > 1e-12
                ? [{ outcome: 'EVADED', probability: evadeProbability }]
                : []),
              ...((1 - evadeProbability) * (1 - hitProbability) > 1e-12
                ? [{
                    outcome: 'MISS',
                    probability: (1 - evadeProbability) * (1 - hitProbability),
                  }]
                : []),
              ...((1 - evadeProbability) * hitProbability > 1e-12
                ? [{
                    outcome: 'HIT',
                    probability: (1 - evadeProbability) * hitProbability,
                  }]
                : []),
            ];
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze(
              distribution.map(row => Object.freeze(row))
            ));
            primarySuccessProbability.set(
              targetId,
              distribution
                .filter(row => row.outcome === 'HIT')
                .reduce((sum, row) => sum + row.probability, 0),
            );
          } else if (prototype === '状态施加') {
            const baseApplicationProbability = normalizeEffectProbability(
              effect?.成功率 ?? effect?.触发概率,
              1,
            );
            const resolvedApplicationProbability = typeof input?.applicationProbabilityResolver === 'function'
              ? input.applicationProbabilityResolver({
                  targetId: unitId(target),
                  actor: effectActor,
                  effect,
                  effectInstanceId: context.effectInstanceId,
                  baseApplicationProbability,
                  recordDependency: recordPreviewDependency,
                })
              : baseApplicationProbability;
          const applicationProbability = clamp(
            Number.isFinite(Number(resolvedApplicationProbability))
              ? Number(resolvedApplicationProbability)
              : baseApplicationProbability,
            0,
            1,
          );
            const forcedProbability = forcedApplicationProbability(
              input,
              context.effectInstanceId,
              unitId(target),
            );
            const primaryProbability = forcedProbability === null
              ? applicationProbability
              : forcedProbability;
            primarySuccessProbability.set(targetId, primaryProbability);
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([
              ...(primaryProbability > 1e-12
                ? [Object.freeze({ outcome: 'HIT', probability: primaryProbability })]
                : []),
              ...(primaryProbability < 1 - 1e-12
                ? [Object.freeze({
                    outcome: 'RESISTED',
                    probability: 1 - primaryProbability,
                  })]
                : []),
            ]));
          } else {
            primarySuccessProbability.set(targetId, 1);
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([
              Object.freeze({ outcome: 'HIT', probability: 1 }),
            ]));
          }
        });
      }
    });
    settleImmediateCooperativeSummons({
      overlay,
      ledger,
      rootActionId,
      declaration,
      worldSnapshot,
      nodeBudget,
      battleIntent: input?.battleIntent || {},
      damageMultiplierByTarget: input?.damageMultiplierByTarget || {},
      damageMultiplierResolver: input?.damageMultiplierResolver,
      hitProbabilityResolver: input?.hitProbabilityResolver,
    });
    metrics.maxNodesObserved = Math.max(metrics.maxNodesObserved, nodeBudget.count);
    const resultValue = {
      version: VERSION,
      cacheKey,
      actorId: unitId(actor),
      actionId: rootActionId,
      actionKind: String(declaration?.actionKind || '').trim(),
      nodeCount: nodeBudget.count,
      contributions: Object.freeze([...ledger.entries]),
      scheduledEvents: Object.freeze([...overlay.scheduledEvents]),
      changedRules: Object.freeze(Object.fromEntries(overlay.changedRules)),
      changedUnitIds: Object.freeze([...overlay.changedUnits.keys()]),
      afterSnapshot: overlay.snapshot(),
      metrics: Object.freeze({ overlayWrites: metrics.overlayWrites, fullCloneCalls: 0 }),
    };
    const operationGraph = buildActionOperationGraph({
      previewResult: resultValue,
      worldSnapshot,
      actionFingerprint: input.actionFingerprint || cacheKey,
      rootActionId,
      round: Number(worldSnapshot?.回合 || 0),
      opportunitySequence: Number(
        input?.actionOpportunity?.sequence ||
        input?.actionOpportunity?.createdAtSequence ||
        0
      ),
      actionSequence: Number(input?.actionSequence || 0),
    });
    Object.defineProperty(resultValue, 'dependencyReads', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze([...dependencyCapture.reads.entries()].map(([key, value]) =>
        Object.freeze([key, cloneValue(value)])
      )),
    });
    Object.defineProperty(resultValue, 'operationGraph', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: operationGraph,
    });
    const result = Object.freeze(resultValue);
    previewCache.set(cacheKey, result);
    return result;
    } finally {
      const popped = dependencyCaptureStack.pop();
      if (popped !== dependencyCapture) {
        dependencyCaptureStack.length = 0;
        throw new Error('battle_preview_dependency_capture_stack_corrupted');
      }
    }
  }

  function buildActionOperationGraph(input = {}) {
    const previewResult = input?.previewResult || input;
    if (!previewResult || typeof previewResult !== 'object') {
      throw new TypeError('BATTLE_PREVIEW_OPERATION_GRAPH_RESULT_MISSING');
    }
    const rootActionId = String(
      input?.rootActionId ||
      previewResult?.actionId ||
      previewResult?.cacheKey ||
      ''
    ).trim();
    const round = Math.max(
      0,
      Number(input?.round ?? input?.worldSnapshot?.回合 ?? 0),
    );
    const opportunitySequence = Math.max(
      0,
      Number(input?.opportunitySequence || 0),
    );
    const actionSequence = Math.max(0, Number(input?.actionSequence || 0));
    const outcomeGroups = new Map();
    const deterministicEvents = [];
    const conditionalEvents = [];
    let effectSequence = 0;
    const registerGroup = ({
      groupKey,
      rootActionId: sourceRootActionId = rootActionId,
      effectInstanceIds = [],
      probability,
      probabilitySources = [],
      successAssignments = {},
      failureAssignments = {},
      outcomes = null,
    }) => {
      const normalizedGroupKey = String(groupKey || '').trim();
      const successProbability = clamp(Number(probability), 0, 1);
      const explicitOutcomes = Array.isArray(outcomes)
        ? outcomes
            .map((outcome, index) => Object.freeze({
              outcomeId: String(
                outcome?.outcomeId ||
                outcome?.branchKey ||
                `OUTCOME_${index + 1}`
              ).trim().toUpperCase(),
              probability: clamp(Number(outcome?.probability || 0), 0, 1),
              assignments: Object.freeze({
                [normalizedGroupKey]: String(
                  outcome?.outcomeId ||
                  outcome?.branchKey ||
                  `OUTCOME_${index + 1}`
                ).trim().toUpperCase(),
                ...cloneValue(outcome?.assignments || {}),
              }),
            }))
            .filter(outcome => outcome.probability > 1e-15)
        : [];
      if (
        !normalizedGroupKey ||
        (
          explicitOutcomes.length
            ? explicitOutcomes.length <= 1
            : successProbability <= 1e-12 ||
              successProbability >= 1 - 1e-12
        )
      ) {
        return '';
      }
      const normalizedOutcomes = explicitOutcomes.length
        ? explicitOutcomes
        : [
            Object.freeze({
              outcomeId: 'SUCCESS',
              probability: successProbability,
              assignments: Object.freeze({
                [normalizedGroupKey]: 'SUCCESS',
                ...cloneValue(successAssignments),
              }),
            }),
            Object.freeze({
              outcomeId: 'FAILURE',
              probability: 1 - successProbability,
              assignments: Object.freeze({
                [normalizedGroupKey]: 'FAILURE',
                ...cloneValue(failureAssignments),
              }),
            }),
          ];
      const group = Object.freeze({
        schemaVersion: '8.3-outcome-group-1',
        groupKey: normalizedGroupKey,
        rootActionId: String(sourceRootActionId || rootActionId).trim(),
        effectInstanceIds: Object.freeze([
          ...new Set(effectInstanceIds.map(value => String(value || '').trim()).filter(Boolean)),
        ].sort()),
        probabilitySources: Object.freeze(cloneValue(probabilitySources)),
        outcomes: Object.freeze(normalizedOutcomes),
      });
      battleEventContract.validateOutcomeGroup(group);
      const existing = outcomeGroups.get(normalizedGroupKey);
      if (existing) {
        const comparable = value => ({
          schemaVersion: value.schemaVersion,
          groupKey: value.groupKey,
          rootActionId: value.rootActionId,
          probabilitySources: value.probabilitySources,
          outcomes: value.outcomes,
        });
        if (
          stableHash(comparable(existing)) !== stableHash(comparable(group))
        ) {
          throw new Error(
            `BATTLE_OUTCOME_GROUP_CONFLICT:${normalizedGroupKey}`,
          );
        }
        const mergedGroup = Object.freeze({
          ...existing,
          effectInstanceIds: Object.freeze([
            ...new Set([
              ...(existing.effectInstanceIds || []),
              ...(group.effectInstanceIds || []),
            ]),
          ].sort()),
        });
        outcomeGroups.set(normalizedGroupKey, mergedGroup);
        return normalizedGroupKey;
      }
      outcomeGroups.set(normalizedGroupKey, group);
      return normalizedGroupKey;
    };
    const attachEffectToGroup = (groupKey, effectInstanceId) => {
      const normalizedGroupKey = String(groupKey || '').trim();
      const normalizedEffectInstanceId = String(
        effectInstanceId || ''
      ).trim();
      if (!normalizedGroupKey || !normalizedEffectInstanceId) return;
      const existing = outcomeGroups.get(normalizedGroupKey);
      if (!existing) return;
      outcomeGroups.set(normalizedGroupKey, Object.freeze({
        ...existing,
        effectInstanceIds: Object.freeze([
          ...new Set([
            ...(existing.effectInstanceIds || []),
            normalizedEffectInstanceId,
          ]),
        ].sort()),
      }));
    };
    const registerEvent = ({
      eventId,
      effectInstanceId = '',
      sourceActorId = previewResult?.actorId || '',
      targetId = '',
      operation,
      conditionalOn = null,
      payload = {},
      dependencyKeys = [],
      scheduledRound = round,
      scheduledOpportunitySequence = opportunitySequence,
      scheduledActionSequence = actionSequence,
      phasePriority,
      scheduledEffectSequence,
    }) => {
      const normalizedOperation = String(operation || '').trim().toUpperCase();
      const event = Object.freeze({
        schemaVersion: '8.3-projected-event-1',
        eventId: String(eventId || '').trim(),
        rootActionId,
        effectInstanceId: String(effectInstanceId || '').trim(),
        sourceActorId: String(sourceActorId || '').trim(),
        targetId: String(targetId || '').trim(),
        operation: normalizedOperation,
        round: Math.max(0, Number(scheduledRound || 0)),
        opportunitySequence: Math.max(
          0,
          Number(scheduledOpportunitySequence || 0),
        ),
        actionSequence: Math.max(0, Number(scheduledActionSequence || 0)),
        phasePriority: Math.max(
          0,
          Number(
            phasePriority ??
            battleEventContract.phasePriority[normalizedOperation] ??
            50
          ),
        ),
        effectSequence: Math.max(
          0,
          Number(scheduledEffectSequence ?? ++effectSequence),
        ),
        conditionalOn:
          conditionalOn && Object.keys(conditionalOn).length
            ? Object.freeze(cloneValue(conditionalOn))
            : null,
        payload: Object.freeze(cloneValue(payload)),
        dependencyKeys: Object.freeze([
          ...new Set(
            dependencyKeys
              .map(value => String(value || '').trim())
              .filter(Boolean),
          ),
        ].sort()),
      });
      battleEventContract.validateProjectedEvent(event);
      (event.conditionalOn ? conditionalEvents : deterministicEvents).push(event);
      return event;
    };
    const resourceLockProfiles = new Map(
      (previewResult?.contributions || [])
        .filter(entry =>
          String(entry?.evidence?.prototype || '').trim() === '资源锁定'
        )
        .map(entry => {
          const effectInstanceId = String(entry?.effectInstanceId || '').trim();
          const targetId = String(entry?.targetId || '').trim();
          const evidence = entry?.evidence || {};
          return [[effectInstanceId, targetId].join('|'), Object.freeze({
            effectInstanceId,
            targetId,
            resource: String(
              evidence?.combatEffect?.locked_resource ||
              evidence?.resource ||
              '魂力'
            ).trim() || '魂力',
            duration: Math.max(1, Number(evidence?.duration || 1)),
            applicationProbability: clamp(
              Number(evidence?.applicationProbability ?? 1),
              0,
              1,
            ),
          })];
        }),
    );
    const applicationGroupByEffectTarget = new Map();
    const applicationConditionsByEffectTarget = new Map();
    const requiredOutcomeGroupKeys = new Set(
      (previewResult?.contributions || [])
        .map(entry => String(
          entry?.evidence?.requiredOutcomeKey || ''
        ).trim())
        .filter(Boolean),
    );
    (previewResult?.contributions || []).forEach(entry => {
      const evidence = entry?.evidence || {};
      const groupKey = String(
        evidence?.distributionGroupKey ||
        evidence?.probabilityGroupKey ||
        ''
      ).trim();
      if (!groupKey || !requiredOutcomeGroupKeys.has(groupKey)) return;
      const groupedOutcomes = new Map();
      (evidence?.outcomeDistribution || []).forEach((outcome, index) => {
        if (Object.keys(outcome?.conditionalOn || {}).length) return;
        const assignmentValue = String(
          outcome?.assignments?.[groupKey] ||
          outcome?.outcomeId ||
          outcome?.outcome ||
          ''
        ).trim().toUpperCase();
        if (!assignmentValue) return;
        const probability = clamp(Number(outcome?.probability || 0), 0, 1);
        if (!(probability > 1e-15)) return;
        const current = groupedOutcomes.get(assignmentValue) || {
          outcomeId: assignmentValue,
          probability: 0,
          assignments: {
            [groupKey]: assignmentValue,
          },
        };
        current.probability += probability;
        Object.assign(current.assignments, cloneValue(outcome?.assignments || {}));
        groupedOutcomes.set(assignmentValue, current);
      });
      registerGroup({
        groupKey,
        effectInstanceIds: [String(entry?.effectInstanceId || '').trim()],
        probabilitySources: [{
          sourceType: 'PRIMARY_RESOLUTION',
          baseProbability: Number(
            evidence?.hitProbability ??
            evidence?.applicationProbability ??
            1
          ),
          finalProbability: Number(
            evidence?.hitProbability ??
            evidence?.applicationProbability ??
            1
          ),
          dependencyKeys: [],
        }],
        outcomes: [...groupedOutcomes.values()],
      });
    });
    (previewResult?.contributions || []).forEach((entry, index) => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      if (
        ![
          'STATE_CHANGED',
          'STATE_SCHEDULED',
          'ACTION_CANCELLED',
          'NEXT_ACTION_QUALITY_CHANGED',
          'RULE_CHANGED',
        ].includes(outcomeKind)
      ) {
        return;
      }
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const evidence = entry?.evidence || {};
      if (!effectInstanceId || !targetId || evidence?.marginal === false) return;
      const applicationProbability = clamp(
        Number(evidence?.applicationProbability ?? 1),
        0,
        1,
      );
      if (applicationProbability <= 1e-12) return;
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const assignmentKey = `${effectInstanceId}|${targetId}`;
      const groupKey =
        ownApplicationProbability > 1e-12 &&
        ownApplicationProbability < 1 - 1e-12
          ? registerGroup({
              groupKey:
                evidence?.distributionGroupKey ||
                evidence?.probabilityGroupKey ||
                `${rootActionId}|${effectInstanceId}|${targetId}|state`,
              effectInstanceIds: [effectInstanceId],
              probability: ownApplicationProbability,
              probabilitySources: [{
                sourceType: 'EFFECT_APPLICATION',
                baseProbability: ownApplicationProbability,
                finalProbability: ownApplicationProbability,
                dependencyKeys: [],
              }],
              successAssignments: { [assignmentKey]: 'HIT' },
              failureAssignments: { [assignmentKey]: 'RESISTED' },
            })
          : '';
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: 'SUCCESS' } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      if (groupKey) {
        applicationGroupByEffectTarget.set(
          `${effectInstanceId}|${targetId}`,
          groupKey,
        );
      }
      applicationConditionsByEffectTarget.set(
        `${effectInstanceId}|${targetId}`,
        Object.freeze(applicationConditions),
      );
      const stateEffect =
        evidence?.projectedEffect &&
        typeof evidence.projectedEffect === 'object'
          ? cloneValue(evidence.projectedEffect)
          : {
              原型:
                String(evidence?.prototype || '状态施加').trim() ||
                '状态施加',
              状态: String(evidence?.state || '').trim(),
              判定: String(evidence?.check || '').trim(),
              结算: String(evidence?.settlement || '').trim(),
              属性: String(evidence?.attribute || '').trim(),
              数值: evidence?.value ?? '',
              持续回合: Math.max(1, Number(evidence?.duration || 1)),
              战斗效果: cloneValue(
                evidence?.combatEffect ||
                evidence?.计算层效果 ||
                {},
              ),
            };
      registerEvent({
        eventId: String(
          entry?.eventId ||
          entry?.semanticKey ||
          `${rootActionId}:${effectInstanceId}:${targetId}:state:${index}`
        ).trim(),
        effectInstanceId,
        targetId,
        operation:
          outcomeKind === 'RULE_CHANGED'
            ? 'STATE_REPLACE'
            : 'STATE_APPLY',
        conditionalOn: Object.keys(applicationConditions).length
          ? applicationConditions
          : null,
        payload: { effect: stateEffect },
        dependencyKeys: [`unit:${targetId}:state:${stateEffect.状态 || effectInstanceId}`],
      });
    });
    (previewResult?.contributions || []).forEach((entry, index) => {
      if (
        String(entry?.outcomeKind || '').trim().toUpperCase() !==
        'SHIELD_DELTA'
      ) {
        return;
      }
      const evidence = entry?.evidence || {};
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const realizedDelta = Number(
        evidence?.realizedDelta ?? evidence?.delta ?? 0
      );
      if (
        !effectInstanceId ||
        !targetId ||
        !Number.isFinite(realizedDelta) ||
        Math.abs(realizedDelta) <= 1e-12
      ) {
        return;
      }
      const applicationProbability = clamp(
        Number(evidence?.applicationProbability ?? 1),
        0,
        1,
      );
      if (applicationProbability <= 1e-12) return;
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const groupKey =
        ownApplicationProbability > 1e-12 &&
        ownApplicationProbability < 1 - 1e-12
          ? registerGroup({
              groupKey:
                evidence?.probabilityGroupKey ||
                evidence?.distributionGroupKey ||
                `${rootActionId}|${effectInstanceId}|${targetId}|shield`,
              effectInstanceIds: [effectInstanceId],
              probability: ownApplicationProbability,
              probabilitySources: [{
                sourceType: 'EFFECT_APPLICATION',
                baseProbability: ownApplicationProbability,
                finalProbability: ownApplicationProbability,
                dependencyKeys: [],
              }],
              successAssignments: {
                [`${effectInstanceId}|${targetId}`]: 'HIT',
              },
              failureAssignments: {
                [`${effectInstanceId}|${targetId}`]: 'MISS',
              },
            })
          : '';
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: 'SUCCESS' } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      registerEvent({
        eventId: String(
          entry?.eventId ||
          entry?.semanticKey ||
          `${rootActionId}:${effectInstanceId}:${targetId}:shield:${index}`
        ).trim(),
        effectInstanceId,
        targetId,
        operation: 'SHIELD_DELTA',
        conditionalOn: Object.keys(applicationConditions).length
          ? applicationConditions
          : null,
        payload: {
          delta: realizedDelta,
          mode: String(evidence?.mode || '').trim(),
          stolenFrom: String(evidence?.stolenFrom || '').trim(),
        },
        dependencyKeys: [`unit:${targetId}:shield`],
      });
    });
    (previewResult?.contributions || []).forEach((entry, index) => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const evidence = entry?.evidence || {};
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const eventId = String(
        entry?.eventId ||
        entry?.semanticKey ||
        `${rootActionId}:${effectInstanceId || index}:operation`
      ).trim();
      if (outcomeKind !== 'RESOURCE_OPTION_CHANGED') return;
      const resource = String(evidence?.resource || '').trim();
      if (!resource || /生命|HP/i.test(resource)) return;
      const applicationProbability = clamp(
        Number(evidence?.applicationProbability ?? 1),
        0,
        1,
      );
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const realizedDelta = Number(
        evidence?.realizedDelta ??
        (
          applicationProbability > 1e-12
            ? Number(evidence?.delta || 0) / applicationProbability
            : 0
        ),
      );
      if (!Number.isFinite(realizedDelta) || Math.abs(realizedDelta) <= 1e-12) {
        return;
      }
      const groupKey =
        ownApplicationProbability > 1e-12 &&
        ownApplicationProbability < 1 - 1e-12
          ? registerGroup({
              groupKey:
                evidence?.probabilityGroupKey ||
                evidence?.distributionGroupKey ||
                `${rootActionId}|${effectInstanceId}|${targetId}|resource`,
              effectInstanceIds: [effectInstanceId],
              probability: ownApplicationProbability,
              probabilitySources: [{
                sourceType: 'EFFECT_APPLICATION',
                baseProbability: ownApplicationProbability,
                finalProbability: ownApplicationProbability,
                dependencyKeys: [],
              }],
              successAssignments: {
                [`${effectInstanceId}|${targetId}`]: 'HIT',
              },
              failureAssignments: {
                [`${effectInstanceId}|${targetId}`]: 'MISS',
              },
            })
          : '';
      if (applicationProbability <= 1e-12) return;
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: 'SUCCESS' } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      registerEvent({
        eventId,
        effectInstanceId,
        targetId,
        operation:
          realizedDelta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE',
        conditionalOn: Object.keys(applicationConditions).length
          ? applicationConditions
          : null,
        payload: {
          resource,
          delta: realizedDelta,
          current: Number(evidence?.current || 0),
          maximum: Number(evidence?.maximum || 0),
          mode: String(evidence?.mode || '').trim(),
        },
        dependencyKeys: [`unit:${targetId}:resource:${resource}`],
      });
    });
    resourceLockProfiles.forEach(profile => {
      if (profile.applicationProbability <= 1e-12) return;
      const effectTargetKey = [
        profile.effectInstanceId,
        profile.targetId,
      ].join('|');
      const groupKey =
        applicationGroupByEffectTarget.get(effectTargetKey) ||
        registerGroup({
          groupKey: [
            rootActionId,
            profile.effectInstanceId,
            profile.targetId,
            'resource-lock',
          ].join('|'),
          effectInstanceIds: [profile.effectInstanceId],
          probability: profile.applicationProbability,
          probabilitySources: [{
            sourceType: 'EFFECT_APPLICATION',
            baseProbability: profile.applicationProbability,
            finalProbability: profile.applicationProbability,
            dependencyKeys: [],
          }],
          successAssignments: {
            [effectTargetKey]: 'HIT',
          },
          failureAssignments: {
            [effectTargetKey]: 'RESISTED',
          },
          });
      const applicationConditions =
        applicationConditionsByEffectTarget.get(effectTargetKey) ||
        (groupKey ? { [groupKey]: 'SUCCESS' } : {});
      registerEvent({
        eventId: `${rootActionId}:${profile.effectInstanceId}:resource-lock`,
        effectInstanceId: profile.effectInstanceId,
        targetId: profile.targetId,
        operation: 'RESOURCE_LOCK',
        conditionalOn: Object.keys(applicationConditions).length
          ? applicationConditions
          : null,
        payload: {
          resource: profile.resource,
          duration: profile.duration,
        },
        dependencyKeys: [
          `unit:${profile.targetId}:resource:${profile.resource}`,
        ],
      });
    });
    (previewResult?.scheduledEvents || []).forEach((scheduled, index) => {
      if (String(scheduled?.type || '').trim().toUpperCase() !== 'SUMMON_CREATE') {
        return;
      }
      const effectInstanceId = String(scheduled?.effectInstanceId || '').trim();
      const applicationProbability = clamp(
        Number(scheduled?.applicationProbability ?? 1),
        0,
        1,
      );
      if (applicationProbability <= 1e-12) return;
      const requiredOutcomeKey = String(
        scheduled?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        scheduled?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          scheduled?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const groupKey =
        ownApplicationProbability > 1e-12 &&
        ownApplicationProbability < 1 - 1e-12
          ? registerGroup({
              groupKey:
                scheduled?.probabilityGroupKey ||
                `${rootActionId}|${effectInstanceId}|summon`,
              effectInstanceIds: [effectInstanceId],
              probability: ownApplicationProbability,
              probabilitySources: [{
                sourceType: 'EFFECT_APPLICATION',
                baseProbability: ownApplicationProbability,
                finalProbability: ownApplicationProbability,
                dependencyKeys: [],
              }],
              successAssignments: Object.fromEntries(
                (scheduled?.summonDefinitions || []).map(summon => [
                  `${effectInstanceId}|${unitId(summon)}`,
                  'HIT',
                ]),
              ),
              failureAssignments: Object.fromEntries(
                (scheduled?.summonDefinitions || []).map(summon => [
                  `${effectInstanceId}|${unitId(summon)}`,
                  'MISS',
                ]),
              ),
            })
          : '';
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: 'SUCCESS' } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      (scheduled?.summonDefinitions || []).forEach((summon, summonIndex) => {
        const summonId = unitId(summon);
        const hostId = String(
          scheduled?.actorId || previewResult?.actorId || ''
        ).trim();
        const duration = Math.max(1, Number(scheduled?.duration || 1));
        const createRound = Math.max(0, Number(round || 0));
        registerEvent({
          eventId: `${rootActionId}:${effectInstanceId}:summon:${summonIndex + 1}`,
          effectInstanceId,
          sourceActorId: scheduled?.actorId || previewResult?.actorId,
          targetId: summonId,
          operation: 'SUMMON_CREATE',
          conditionalOn: Object.keys(applicationConditions).length
            ? applicationConditions
            : null,
          payload: {
            summon: cloneValue(summon),
            definitionHash: String(summon?.__definitionHash || '').trim(),
            hostId,
            duration,
            actionMode: String(scheduled?.actionMode || '').trim(),
          },
          dependencyKeys: [
            `unit:${hostId}:hp`,
          ],
        });
        registerEvent({
          eventId: `${rootActionId}:${effectInstanceId}:summon-window:${summonIndex + 1}`,
          effectInstanceId,
          sourceActorId: hostId,
          targetId: summonId,
          operation: 'SUMMON_WINDOW',
          conditionalOn: Object.keys(applicationConditions).length
            ? applicationConditions
            : null,
          payload: {
            instanceId: summonId,
            hostId,
            duration,
            actionMode: String(scheduled?.actionMode || '').trim(),
            deadlineRound: createRound + duration,
          },
          scheduledRound:
            createRound +
            (String(scheduled?.actionMode || '').trim() === '协同攻击' ? 0 : 1),
          scheduledOpportunitySequence: opportunitySequence + 1,
          dependencyKeys: [
            `unit:${hostId}:hp`,
            `schedule:${rootActionId}:${effectInstanceId}:summon-window:${summonIndex + 1}`,
          ],
        });
      });
    });
    deterministicEvents.sort(battleEventContract.compareBattleEventPosition);
    conditionalEvents.sort(battleEventContract.compareBattleEventPosition);
    const graphValue = {
      schemaVersion: '8.3-preview-operation-graph-1',
      actionFingerprint: String(
        input?.actionFingerprint ||
        previewResult?.cacheKey ||
        rootActionId
      ).trim(),
      deterministicEvents: Object.freeze(deterministicEvents),
      outcomeGroups: Object.freeze([...outcomeGroups.values()]),
      conditionalEvents: Object.freeze(conditionalEvents),
      dependencyReads: Object.freeze(
        cloneValue(previewResult?.dependencyReads || input?.dependencyReads || []),
      ),
    };
    return Object.freeze({
      ...graphValue,
      graphHash: stableHash(graphValue),
    });
  }

  function operationGraphMatches(conditionalOn, branchAssignments) {
    return !conditionalOn ||
      Object.entries(conditionalOn).every(([key, value]) =>
        String(branchAssignments?.[key] || '') === String(value || '')
      );
  }

  function applyOperationGraphEvent(overlay, locks, opportunityState, event) {
    const targetId = String(event?.targetId || '').trim();
    const payload = event?.payload || {};
    if (
      [
        'RESOURCE_RESTORE',
        'RESOURCE_REDUCE',
        'RESOURCE_REFUND',
        'NATURAL_RECOVERY',
        'SUSTAIN_COST',
        'RESOURCE_PAY',
      ].includes(event.operation)
    ) {
      const target = overlay.readUnit(targetId);
      if (!target) return false;
      const resource = String(payload?.resource || '').trim();
      const delta = Number(payload?.delta || 0);
      overlay.changeUnit(targetId, unit => {
        const current = readResource(unit, resource);
        const maximum = readResourceMax(unit, resource);
        setResourceValue(unit, resource, clamp(current + delta, 0, maximum));
      });
      return true;
    }
    if (event.operation === 'SHIELD_DELTA') {
      const target = overlay.readUnit(targetId);
      if (!target) return false;
      const delta = Number(payload?.delta || 0);
      overlay.changeUnit(targetId, unit => {
        const next = Math.max(0, readShield(unit) + delta);
        unit.shield = next;
        unit.护盾 = next;
      });
      return true;
    }
    if (event.operation === 'RESOURCE_LOCK') {
      locks.add(`${targetId}\u0000${String(payload?.resource || '').trim()}`);
      return true;
    }
    if (event.operation === 'RESOURCE_UNLOCK') {
      locks.delete(`${targetId}\u0000${String(payload?.resource || '').trim()}`);
      return true;
    }
    if (
      ['STATE_APPLY', 'STATE_REFRESH', 'STATE_REPLACE', 'STATE_REMOVE'].includes(
        event.operation,
      )
    ) {
      const target = overlay.readUnit(targetId);
      if (!target) return false;
      overlay.changeUnit(targetId, unit => {
        if (payload?.effect && typeof payload.effect === 'object') {
          if (
            String(payload.effect?.原型 || '').trim() === '属性修正'
          ) {
            applyStatModifier(unit, cloneValue(payload.effect));
            return;
          }
          addState(
            unit,
            {
              ...cloneValue(payload.effect),
              __previewApplicationProbability: 1,
            },
            String(event?.effectInstanceId || event?.eventId || '').trim(),
          );
          return;
        }
        const nextStates = { ...(unit?.状态效果 || {}) };
        (payload?.removedStateKeys || []).forEach(key => {
          delete nextStates[String(key || '').trim()];
        });
        Object.assign(nextStates, cloneValue(payload?.stateEntries || {}));
        unit.状态效果 = nextStates;
      });
      return true;
    }
    if (event.operation === 'SUMMON_CREATE') {
      const hostId = String(
        payload?.hostId || event?.sourceActorId || ''
      ).trim();
      const host = overlay.readUnit(hostId);
      const hostControlled = host && stateEntries(host).some(([, state]) => {
        const effects = state?.战斗效果 || state?.计算层效果 || {};
        const name = stateName(state);
        return effects?.skip_turn === true ||
          effects?.cannot_act === true ||
          [
            '眩晕', '麻痹', '僵直', '束缚', '禁锢',
            '定身', '冻结', '冻结束缚', '星光停滞',
          ].includes(name);
      });
      if (!host || !isBattleCapable(host) || hostControlled) return false;
      const summon = cloneValue(payload?.summon || {});
      if (!unitId(summon)) return false;
      overlay.writeSummon(
        summon,
        String(payload?.definitionHash || summon?.__definitionHash || '').trim(),
      );
      return true;
    }
    if (event.operation === 'SUMMON_WINDOW') {
      const instanceId = String(payload?.instanceId || targetId).trim();
      const summon = overlay.createdSummons.get(instanceId);
      const hostId = String(
        payload?.hostId || event?.sourceActorId || ''
      ).trim();
      const host = overlay.readUnit(hostId);
      const deadlineRound = Math.max(
        0,
        Number(payload?.deadlineRound ?? Number.MAX_SAFE_INTEGER),
      );
      if (
        !summon ||
        !host ||
        !isBattleCapable(host) ||
        Number(event?.round || 0) > deadlineRound
      ) {
        return false;
      }
      const snapshot = overlay.snapshot();
      const hostSide = sideOf(snapshot, host);
      const validTargetIds = listUnits(snapshot)
        .filter(entry =>
          entry.side !== hostSide &&
          isBattleCapable(entry.unit)
        )
        .map(entry => unitId(entry.unit))
        .filter(Boolean);
      if (!validTargetIds.length) return false;
      opportunityState.set(event.eventId, Object.freeze({
        opportunityId: event.eventId,
        ownerId: instanceId,
        role: 'ACTIVE',
        grantType: 'NATURAL_ACTION',
        validTargetIds: Object.freeze(validTargetIds),
        status: 'PENDING',
        createdAtSequence: Number(event?.opportunitySequence || 0),
        expiresAtSequence:
          Number(event?.opportunitySequence || 0) +
          Math.max(1, Number(payload?.duration || 1)),
      }));
      return true;
    }
    return false;
  }

  function operationGraphResourceRows(world, dependencyKeys = []) {
    const explicit = dependencyKeys
      .map(key => {
        const match = String(key || '').match(
          /^unit:([^:]+):resource:(.+)$/,
        );
        return match
          ? { unitId: match[1], resource: match[2] }
          : null;
      })
      .filter(Boolean);
    const rows = explicit.length
      ? explicit
      : listUnits(world).flatMap(entry =>
          ['魂力', '精神力', '体力'].map(resource => ({
            unitId: unitId(entry.unit),
            resource,
          }))
        );
    return rows
      .map(row => {
        const target = findUnit(world, row.unitId);
        return [
          row.unitId,
          row.resource,
          target ? readResource(target, row.resource) : null,
        ];
      })
      .sort(([leftUnit, leftResource], [rightUnit, rightResource]) =>
        String(leftUnit).localeCompare(String(rightUnit)) ||
        String(leftResource).localeCompare(String(rightResource))
      );
  }

  function operationGraphSufficientStateKey(
    state,
    projectionContract = {},
    pendingEvents = [],
  ) {
    const mergeKey = String(
      projectionContract?.mergeKey || 'FULL',
    ).trim().toUpperCase();
    const resources = operationGraphResourceRows(
      state.world,
      projectionContract?.dependencyKeys || [],
    );
    const resourceState = mergeKey === 'RESOURCE_ZERO_OR_NONZERO'
      ? resources.map(([unitIdValue, resource, value]) => [
          unitIdValue,
          resource,
          Number(value || 0) > 1e-12 ? 'NONZERO' : 'ZERO',
        ])
      : resources;
    const pendingAssignments = Object.fromEntries(
      pendingEvents.flatMap(event =>
        Object.keys(event?.conditionalOn || {})
          .filter(key => Object.hasOwn(state.assignments, key))
          .map(key => [key, state.assignments[key]])
      ),
    );
    const retainedAssignments = Object.fromEntries(
      (projectionContract?.assignmentKeys || [])
        .map(value => String(value || '').trim())
        .filter(key => key && Object.hasOwn(state.assignments, key))
        .map(key => [key, state.assignments[key]]),
    );
    if (
      mergeKey === 'RESOURCE_ZERO_OR_NONZERO' ||
      mergeKey === 'EXACT_RESOURCE_BALANCE'
    ) {
      return stableHash({
        resourceState,
        locks: [...state.locks].sort(),
        pendingAssignments,
        retainedAssignments,
      });
    }
    return stableHash({
      world: state.world,
      locks: [...state.locks].sort(),
      opportunityState: [...state.opportunityState.entries()]
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
      pendingAssignments,
      retainedAssignments,
    });
  }

  function evaluateOperationGraph(input = {}) {
    const graph = input?.graph;
    const baseWorld = input?.baseState?.world || input?.baseWorld;
    if (
      !graph ||
      graph.schemaVersion !== '8.3-preview-operation-graph-1'
    ) {
      throw new Error('BATTLE_PREVIEW_OPERATION_GRAPH_INVALID');
    }
    if (!baseWorld || typeof baseWorld !== 'object') {
      throw new TypeError('BATTLE_PREVIEW_BRANCH_BASE_WORLD_MISSING');
    }
    const projectionContract = input?.projectionContract || {};
    const operationFilter = new Set(
      (projectionContract?.operations || [])
        .map(value => String(value || '').trim().toUpperCase())
        .filter(Boolean),
    );
    const includesEvent = event =>
      !operationFilter.size ||
      operationFilter.has(String(event?.operation || '').trim().toUpperCase());
    const orderedEvents = [
      ...(graph.deterministicEvents || []),
      ...(graph.conditionalEvents || []),
    ]
      .filter(includesEvent)
      .sort(battleEventContract.compareBattleEventPosition);
    const referencedGroupKeys = new Set(
      orderedEvents.flatMap(event => Object.keys(event?.conditionalOn || {})),
    );
    const groups = (graph.outcomeGroups || [])
      .filter(group => referencedGroupKeys.has(String(group?.groupKey || '')))
      .sort((left, right) => {
        const firstEvent = group => orderedEvents.find(event =>
          Object.hasOwn(
            event?.conditionalOn || {},
            String(group?.groupKey || ''),
          )
        );
        const position = battleEventContract.compareBattleEventPosition(
          firstEvent(left) || {},
          firstEvent(right) || {},
        );
        return position ||
          String(left?.groupKey || '').localeCompare(String(right?.groupKey || ''));
      });
    const maxActiveStates = Math.max(
      1,
      Math.floor(Number(input?.maxActiveStates || 64)),
    );
    const rawCartesianUpperBound = groups.reduce(
      (product, group) =>
        product * Math.max(1, group?.outcomes?.length || 1),
      1,
    );
    const initialOverlay = new PreviewOverlay(
      baseWorld,
      `${graph.graphHash}:factorized:initial`,
    );
    const initialLocks = new Set(input?.baseState?.locks || []);
    const initialOpportunityState = new Map(
      input?.baseState?.opportunityState || [],
    );
    const initialAppliedEventIds = [];
    const initialSkippedEventIds = [];
    const initialConsumedEventIds = new Set();
    orderedEvents
      .filter(event => !event?.conditionalOn)
      .forEach(event => {
        initialConsumedEventIds.add(event.eventId);
        if (
          applyOperationGraphEvent(
            initialOverlay,
            initialLocks,
            initialOpportunityState,
            event,
          )
        ) {
          initialAppliedEventIds.push(event.eventId);
        } else {
          initialSkippedEventIds.push(event.eventId);
        }
      });
    let states = [{
      probability: 1,
      assignments: {},
      outcomeIds: {},
      world: initialOverlay.snapshot(),
      locks: initialLocks,
      opportunityState: initialOpportunityState,
      consumedEventIds: initialConsumedEventIds,
      appliedEventIds: initialAppliedEventIds,
      skippedEventIds: initialSkippedEventIds,
      mergedPathCount: 1,
    }];
    let peakActiveSufficientStates = states.length;
    let mergedEquivalentStateCount = 0;
    for (const group of groups) {
      battleEventContract.validateOutcomeGroup(group);
      const expanded = [];
      states.forEach((state, stateIndex) => {
        group.outcomes.forEach((outcome, outcomeIndex) => {
          const probability =
            Number(state.probability || 0) *
            Number(outcome.probability || 0);
          if (!(probability > 1e-15)) return;
          const assignments = {
            ...state.assignments,
            ...(outcome.assignments || {}),
          };
          const outcomeIds = {
            ...state.outcomeIds,
            [group.groupKey]: outcome.outcomeId,
          };
          const overlay = new PreviewOverlay(
            state.world,
            `${graph.graphHash}:factorized:${group.groupKey}:${stateIndex}:${outcomeIndex}`,
          );
          const locks = new Set(state.locks);
          const opportunityState = new Map(state.opportunityState);
          const consumedEventIds = new Set(state.consumedEventIds);
          const appliedEventIds = [...state.appliedEventIds];
          const skippedEventIds = [...state.skippedEventIds];
          orderedEvents.forEach(event => {
            if (consumedEventIds.has(event.eventId)) return;
            const requiredKeys = Object.keys(event?.conditionalOn || {});
            if (!requiredKeys.every(key => Object.hasOwn(assignments, key))) {
              return;
            }
            consumedEventIds.add(event.eventId);
            if (!operationGraphMatches(event.conditionalOn, assignments)) {
              skippedEventIds.push(event.eventId);
              return;
            }
            if (
              applyOperationGraphEvent(
                overlay,
                locks,
                opportunityState,
                event,
              )
            ) {
              appliedEventIds.push(event.eventId);
            } else {
              skippedEventIds.push(event.eventId);
            }
          });
          expanded.push({
            probability,
            assignments,
            outcomeIds,
            world: overlay.snapshot(),
            locks,
            opportunityState,
            consumedEventIds,
            appliedEventIds,
            skippedEventIds,
            mergedPathCount: state.mergedPathCount,
          });
        });
      });
      const merged = new Map();
      expanded.forEach(state => {
        const pendingEvents = orderedEvents.filter(
          event => !state.consumedEventIds.has(event.eventId),
        );
        const key = operationGraphSufficientStateKey(
          state,
          projectionContract,
          pendingEvents,
        );
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, state);
          return;
        }
        existing.probability += state.probability;
        existing.mergedPathCount += state.mergedPathCount;
        existing.appliedEventIds = [
          ...new Set([...existing.appliedEventIds, ...state.appliedEventIds]),
        ].sort();
        existing.skippedEventIds = [
          ...new Set([...existing.skippedEventIds, ...state.skippedEventIds]),
        ].sort();
        mergedEquivalentStateCount += 1;
      });
      states = [...merged.values()];
      peakActiveSufficientStates = Math.max(
        peakActiveSufficientStates,
        states.length,
      );
      if (states.length > maxActiveStates) {
        throw new Error(
          `BATTLE_PREVIEW_PROBABILITY_BRANCH_BUDGET_EXCEEDED:${states.length}:${maxActiveStates}`,
        );
      }
    }
    const finalStates = states.map(state => Object.freeze({
      schemaVersion: '8.3-branch-state-1',
      probability: state.probability,
      assignments: Object.freeze({ ...state.assignments }),
      outcomeIds: Object.freeze({ ...state.outcomeIds }),
      world: state.world,
      balances: Object.freeze(Object.fromEntries(
        operationGraphResourceRows(state.world).map(
          ([unitIdValue, resource, value]) => [
            `${unitIdValue}\u0000${resource}`,
            value,
          ],
        ),
      )),
      locks: Object.freeze([...state.locks].sort()),
      opportunityState: Object.freeze(
        [...state.opportunityState.values()].map(Object.freeze),
      ),
      appliedEventIds: Object.freeze([...state.appliedEventIds]),
      skippedEventIds: Object.freeze([...state.skippedEventIds]),
      mergedPathCount: state.mergedPathCount,
    }));
    return Object.freeze({
      schemaVersion: '8.3-factorized-branch-result-1',
      rawCartesianUpperBound,
      primitiveOutcomeGroupCount: groups.length,
      peakActiveSufficientStates,
      mergedEquivalentStateCount,
      operationEventCount: orderedEvents.length,
      finalStates: Object.freeze(finalStates),
    });
  }

  function expandOperationGraphBranches(input = {}) {
    const graph = input?.graph;
    const baseWorld = input?.baseWorld;
    if (
      !graph ||
      graph.schemaVersion !== '8.3-preview-operation-graph-1'
    ) {
      throw new Error('BATTLE_PREVIEW_OPERATION_GRAPH_INVALID');
    }
    if (!baseWorld || typeof baseWorld !== 'object') {
      throw new TypeError('BATTLE_PREVIEW_BRANCH_BASE_WORLD_MISSING');
    }
    const maxBranches = Math.max(1, Number(input?.maxBranches || 64));
    let assignments = [{
      probability: 1,
      assignments: {},
      outcomeIds: {},
    }];
    (graph.outcomeGroups || []).forEach(group => {
      battleEventContract.validateOutcomeGroup(group);
      assignments = assignments.flatMap(branch =>
        group.outcomes.map(outcome => ({
          probability:
            Number(branch.probability || 0) *
            Number(outcome.probability || 0),
          assignments: {
            ...branch.assignments,
            ...(outcome.assignments || {}),
          },
          outcomeIds: {
            ...branch.outcomeIds,
            [group.groupKey]: outcome.outcomeId,
          },
        }))
      ).filter(branch => branch.probability > 1e-15);
      if (assignments.length > maxBranches) {
        throw new Error(
          `BATTLE_PREVIEW_PROBABILITY_BRANCH_BUDGET_EXCEEDED:${assignments.length}:${maxBranches}`,
        );
      }
    });
    const orderedEvents = [
      ...(graph.deterministicEvents || []),
      ...(graph.conditionalEvents || []),
    ].sort(battleEventContract.compareBattleEventPosition);
    return Object.freeze(assignments.map((branch, branchIndex) => {
      const overlay = new PreviewOverlay(
        baseWorld,
        `${graph.graphHash}:branch:${branchIndex}`,
      );
      const locks = new Set();
      const opportunityState = new Map();
      const appliedEventIds = [];
      const skippedEventIds = [];
      orderedEvents.forEach(event => {
        if (!operationGraphMatches(event.conditionalOn, branch.assignments)) {
          skippedEventIds.push(event.eventId);
          return;
        }
        if (
          applyOperationGraphEvent(
            overlay,
            locks,
            opportunityState,
            event,
          )
        ) {
          appliedEventIds.push(event.eventId);
        } else {
          skippedEventIds.push(event.eventId);
        }
      });
      const world = overlay.snapshot();
      const balances = Object.fromEntries(
        listUnits(world).flatMap(entry => {
          const id = unitId(entry.unit);
          return ['魂力', '精神力', '体力'].map(resource => [
            `${id}\u0000${resource}`,
            readResource(entry.unit, resource),
          ]);
        }),
      );
      return Object.freeze({
        schemaVersion: '8.3-branch-state-1',
        probability: Number(branch.probability || 0),
        assignments: Object.freeze(cloneValue(branch.assignments)),
        outcomeIds: Object.freeze(cloneValue(branch.outcomeIds)),
        world,
        balances: Object.freeze(balances),
        locks: Object.freeze([...locks].sort()),
        opportunityState: Object.freeze(
          Object.fromEntries(opportunityState),
        ),
        summonState: Object.freeze(
          Object.fromEntries(
            [...overlay.createdSummons].map(([id, summon]) => [
              id,
              cloneValue(summon),
            ]),
          ),
        ),
        consumedEventIds: Object.freeze(appliedEventIds),
        skippedEventIds: Object.freeze(skippedEventIds),
        consumedBehaviorKeys: Object.freeze([]),
        terminalResult: null,
        firstTerminalEventId: '',
      });
    }));
  }

  function buildLifecycleEventSet(previewResult = {}, input = {}) {
    const rootActionId = String(
      input?.rootActionId ||
      previewResult?.actionId ||
      previewResult?.cacheKey ||
      ''
    ).trim();
    const worldSnapshot =
      input?.worldSnapshot ||
      previewResult?.afterSnapshot ||
      {};
    const eventsById = new Map();
    const register = event => {
      const eventId = String(event?.eventId || '').trim();
      if (!eventId) throw new Error('BATTLE_LIFECYCLE_EVENT_ID_MISSING');
      const normalized = Object.freeze({
        eventId,
        rootActionId: String(event?.rootActionId || rootActionId).trim(),
        effectInstanceId: String(event?.effectInstanceId || '').trim(),
        sourceActionId: String(event?.sourceActionId || rootActionId).trim(),
        targetId: String(event?.targetId || '').trim(),
        kind: String(event?.kind || '').trim().toUpperCase(),
        scheduledRound: Math.max(0, Number(event?.scheduledRound || 0)),
        opportunitySequence: Math.max(
          0,
          Number(event?.opportunitySequence || 0),
        ),
        actionSequence: Math.max(0, Number(event?.actionSequence || 0)),
        phasePriority: Math.max(
          0,
          Number(
            event?.phasePriority ??
            battleEventContract.phasePriority[
              String(event?.kind || '').trim().toUpperCase()
            ] ??
            50
          ),
        ),
        effectSequence: Math.max(0, Number(event?.effectSequence || 0)),
        probabilityGroupKey: String(
          event?.probabilityGroupKey || ''
        ).trim(),
        conditionalOn:
          event?.conditionalOn && typeof event.conditionalOn === 'object'
            ? Object.freeze(cloneValue(event.conditionalOn))
            : null,
        healthDeltaPP: Number(event?.healthDeltaPP || 0),
        resourceDelta:
          event?.resourceDelta && typeof event.resourceDelta === 'object'
            ? Object.freeze(cloneValue(event.resourceDelta))
            : null,
        stateDelta: event?.stateDelta && typeof event.stateDelta === 'object'
          ? Object.freeze(cloneValue(event.stateDelta))
          : null,
        consumed: event?.consumed === true,
      });
      const existing = eventsById.get(eventId);
      if (
        existing &&
        stableHash(existing) !== stableHash(normalized)
      ) {
        throw new Error(`BATTLE_LIFECYCLE_EVENT_CONFLICT:${eventId}`);
      }
      if (!existing) eventsById.set(eventId, normalized);
    };
    const targetBaseMaxHp = targetId => {
      const target = findUnit(worldSnapshot, targetId);
      return Math.max(1, target ? readHpMax(target) : 1);
    };
    (previewResult?.contributions || []).forEach((entry, index) => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const evidence = entry?.evidence || {};
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const baseEventId = String(
        entry?.eventId ||
        entry?.semanticKey ||
        `${rootActionId}:${effectInstanceId || index}`
      ).trim();
      const probabilityGroupKey = String(
        evidence?.distributionGroupKey ||
        evidence?.probabilityGroupKey ||
        ''
      ).trim();
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey
            ? 1
            : evidence?.applicationProbability ?? 1)
        ),
        0,
        1,
      );
      const ownProbabilityGroupKey = String(
        evidence?.probabilityGroupKey ||
        probabilityGroupKey ||
        `${rootActionId}|${effectInstanceId}|${targetId}|application`
      ).trim();
      const lifecycleConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(
          ownApplicationProbability > 1e-12 &&
          ownApplicationProbability < 1 - 1e-12
            ? { [ownProbabilityGroupKey]: 'SUCCESS' }
            : {}
        ),
      };
      if (outcomeKind === 'RESOURCE_OPTION_CHANGED') {
        const resource = String(evidence?.resource || '').trim();
        const delta = Number(
          evidence?.realizedDelta ?? evidence?.delta ?? 0
        );
        if (resource && Number.isFinite(delta) && Math.abs(delta) > 1e-12) {
          register({
            eventId: baseEventId,
            effectInstanceId,
            sourceActionId: entry?.sourceActionId,
            targetId,
            kind: delta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE',
            scheduledRound: evidence?.scheduledRound || evidence?.round,
            opportunitySequence: evidence?.opportunitySequence,
            actionSequence: evidence?.actionSequence,
            phasePriority:
              battleEventContract.phasePriority[
                delta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE'
              ],
            effectSequence: evidence?.effectSequence || index,
            probabilityGroupKey:
              requiredOutcomeKey ||
              evidence?.probabilityGroupKey ||
              probabilityGroupKey,
            conditionalOn: Object.keys(lifecycleConditions).length
              ? lifecycleConditions
              : null,
            resourceDelta: {
              resource,
              delta,
              operation:
                delta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE',
            },
          });
        }
        return;
      }
      if (outcomeKind === 'SCHEDULED_HP_DELTA') {
        const tickCount = Math.max(
          1,
          Math.floor(Number(evidence?.tickCount || evidence?.duration || 1)),
        );
        const delta = Number(evidence?.delta ?? entry?.expectedDelta ?? 0);
        const perTickDelta = delta / tickCount;
        for (let tickIndex = 0; tickIndex < tickCount; tickIndex += 1) {
          register({
            eventId: `${baseEventId}:tick:${tickIndex + 1}`,
            effectInstanceId,
            sourceActionId: entry?.sourceActionId,
            targetId,
            kind: perTickDelta < 0 ? 'DOT_TICK' : 'HOT_TICK',
            scheduledRound: Number(
              evidence?.scheduledRound ||
              evidence?.round ||
              0
            ) + tickIndex,
            opportunitySequence: evidence?.opportunitySequence,
            actionSequence: evidence?.actionSequence,
            phasePriority:
              battleEventContract.phasePriority[
                perTickDelta < 0 ? 'DOT_TICK' : 'HOT_TICK'
              ],
            effectSequence: tickIndex,
            probabilityGroupKey,
            healthDeltaPP:
              100 * perTickDelta / targetBaseMaxHp(targetId),
          });
        }
        return;
      }
      if (['STATE_CHANGED', 'STATE_SCHEDULED'].includes(outcomeKind)) {
        const stackMode = String(
          evidence?.stackMode ||
          evidence?.overlapMode ||
          ''
        ).trim().toUpperCase();
        const removedKeys = Array.isArray(evidence?.removedKeys)
          ? evidence.removedKeys
          : [];
        const kind = removedKeys.length
          ? 'STATE_REMOVE'
          : stackMode === 'REFRESH'
            ? 'STATE_REFRESH'
            : stackMode === 'REPLACE'
              ? 'STATE_REPLACE'
              : 'STATE_APPLY';
        register({
          eventId: baseEventId,
          effectInstanceId,
          sourceActionId: entry?.sourceActionId,
          targetId,
          kind,
          scheduledRound: evidence?.scheduledRound || evidence?.round,
          opportunitySequence: evidence?.opportunitySequence,
          actionSequence: evidence?.actionSequence,
          phasePriority: battleEventContract.phasePriority[kind],
          effectSequence: index,
          probabilityGroupKey:
            requiredOutcomeKey || probabilityGroupKey,
          conditionalOn: Object.keys(lifecycleConditions).length
            ? lifecycleConditions
            : null,
          stateDelta: {
            stateKey: String(
              evidence?.stateKey ||
              evidence?.stateName ||
              ''
            ).trim(),
            removedKeys: [...removedKeys],
            stackMode,
          },
        });
        return;
      }
      if (outcomeKind === 'SUMMON_WINDOW') {
        register({
          eventId: baseEventId,
          effectInstanceId,
          sourceActionId: entry?.sourceActionId,
          targetId,
          kind: 'SUMMON_WINDOW',
          scheduledRound: evidence?.scheduledRound || evidence?.round,
          opportunitySequence: evidence?.opportunitySequence,
          actionSequence: evidence?.actionSequence,
          phasePriority: battleEventContract.phasePriority.SUMMON_WINDOW,
          effectSequence: index,
          probabilityGroupKey,
        });
      }
    });
    (previewResult?.scheduledEvents || []).forEach((event, index) => {
      const effectInstanceId = String(event?.effectInstanceId || '').trim();
      const eventType = String(
        event?.eventType ||
        event?.kind ||
        event?.outcomeKind ||
        ''
      ).trim().toUpperCase();
      let kind = '';
      if (/DOT|DAMAGE_TICK/.test(eventType)) kind = 'DOT_TICK';
      else if (/HOT|HEAL_TICK/.test(eventType)) kind = 'HOT_TICK';
      else if (/SUMMON.*EXPIRE/.test(eventType)) kind = 'SUMMON_EXPIRE';
      else if (/HOST.*INVALID/.test(eventType)) kind = 'HOST_INVALID';
      else if (/SUMMON/.test(eventType)) kind = 'SUMMON_WINDOW';
      else if (/REMOVE|DISPEL|EXPIRE/.test(eventType)) kind = 'STATE_REMOVE';
      else if (/REFRESH/.test(eventType)) kind = 'STATE_REFRESH';
      else if (/REPLACE/.test(eventType)) kind = 'STATE_REPLACE';
      else if (/STATE|STATUS/.test(eventType)) kind = 'STATE_APPLY';
      if (!kind) return;
      register({
        eventId: String(
          event?.eventId ||
          event?.descriptorId ||
          `${rootActionId}:${effectInstanceId || 'scheduled'}:${index}`
        ).trim(),
        effectInstanceId,
        sourceActionId: event?.sourceActionId || event?.sourceEventId,
        targetId: event?.targetId || event?.ownerId,
        kind,
        scheduledRound:
          event?.scheduledRound ||
          event?.round ||
          event?.createdAtRound,
        opportunitySequence:
          event?.opportunitySequence ||
          event?.creationSequence,
        actionSequence: event?.actionSequence,
        phasePriority:
          event?.phasePriority ||
          battleEventContract.phasePriority[kind],
        effectSequence: event?.effectSequence || index,
        probabilityGroupKey:
          event?.probabilityGroupKey ||
          event?.distributionGroupKey,
        healthDeltaPP: Number(event?.healthDeltaPP || 0),
        stateDelta: event?.stateDelta || null,
      });
    });
    const events = Object.freeze(
      [...eventsById.values()].sort((left, right) =>
        battleEventContract.compareBattleEventPosition(
          {
            ...left,
            round: left.scheduledRound,
          },
          {
            ...right,
            round: right.scheduledRound,
          },
        )
      ),
    );
    return Object.freeze({
      schemaVersion: '8.3-lifecycle-event-set-1',
      events,
      lifecycleHash: `lifecycle:${stableHash(events)}`,
    });
  }

  function calculateWithdrawalPressureDetails(unit = {}, opponent = {}, stance = 'WITHDRAW') {
    const agilityBreakdown = readCombatStatBreakdown(unit, 'agi');
    const agility = agilityBreakdown.value;
    const spirit = readResource(unit, '精神力');
    const spiritMax = readResourceMax(unit, '精神力');
    const stamina = readResource(unit, '体力');
    const staminaMax = readResourceMax(unit, '体力');
    const spiritRatio = clamp(spirit / Math.max(1, spiritMax), 0, 1);
    const staminaRatio = clamp(stamina / Math.max(1, staminaMax), 0, 1);
    const stateEffects = stateEntries(unit, 'WITHDRAWAL').map(([stateKey, state]) => ({
      source: stateName(state) || String(stateKey || '状态效果').trim(),
      effect: state?.战斗效果 || {},
    }));
    const effectContributions = [];
    const dodgeModifier = stateEffects.reduce((sum, entry) => {
      const value = Number(entry.effect?.dodge_bonus || 0) * 100 - Number(entry.effect?.dodge_penalty || 0) * 100;
      if (value) effectContributions.push({ kind: 'add', value, source: `${entry.source}·闪避修正` });
      return sum + value;
    }, 0);
    const reactionModifier = stateEffects.reduce((sum, entry) => {
      const value = Number(entry.effect?.reaction_bonus || 0) * 80 - Number(entry.effect?.reaction_penalty || 0) * 80;
      if (value) effectContributions.push({ kind: 'add', value, source: `${entry.source}·反应修正` });
      return sum + value;
    }, 0);
    const hardControlSource = stateEffects.find(entry => entry.effect?.skip_turn === true || entry.effect?.cannot_react === true);
    const hardControlPenalty = hardControlSource ? 999999 : 0;
    if (hardControlSource) effectContributions.push({ kind: 'subtract', value: hardControlPenalty, source: `${hardControlSource.source}·无法反应` });
    const opposingSpirit = readResource(opponent, '精神力');
    const resourcePressure = clamp(
      Math.pow(Math.max(0.01, spirit / Math.max(1, opposingSpirit)), 0.35) * (0.45 + 0.55 * spiritRatio),
      0.35,
      1.65,
    );
    const base = agility * 0.72 + spirit * 0.012 + spiritMax * 0.025;
    const conditionFactor = 0.35 + spiritRatio * 0.4 + staminaRatio * 0.25;
    const stanceMultiplier = stance === 'PURSUIT' ? 1.08 : 1;
    const value = Math.max(0, base * conditionFactor * resourcePressure * stanceMultiplier + dodgeModifier + reactionModifier - hardControlPenalty);
    return Object.freeze({
      value,
      stance,
      agility: agilityBreakdown,
      spirit,
      spiritMax,
      stamina,
      staminaMax,
      opposingSpirit,
      spiritRatio,
      staminaRatio,
      base,
      conditionFactor,
      resourcePressure,
      stanceMultiplier,
      effectContributions: Object.freeze(effectContributions.map(item => Object.freeze({ ...item }))),
    });
  }

  function calculateWithdrawalPressure(unit = {}, opponent = {}, stance = 'WITHDRAW') {
    return calculateWithdrawalPressureDetails(unit, opponent, stance).value;
  }

  function estimateWithdrawal(actor = {}, pursuer = {}) {
    const withdrawalScore = calculateWithdrawalPressure(actor, pursuer, 'WITHDRAW');
    const pursuitScore = calculateWithdrawalPressure(pursuer, actor, 'PURSUIT');
    const ratio = withdrawalScore / Math.max(1, pursuitScore);
    const successProbability = ratio >= 1.18 ? 1 : clamp((ratio - 0.72) * 0.55, 0.03, 0.92);
    const partialThreshold = ratio >= 0.9 ? 1 : Math.max(successProbability, Math.min(0.96, successProbability + 0.24));
    const partialProbability = Math.max(0, partialThreshold - successProbability);
    const failureProbability = Math.max(0, 1 - successProbability - partialProbability);
    const hpMax = readHpMax(actor);
    return Object.freeze({
      withdrawalScore,
      pursuitScore,
      ratio,
      successProbability,
      partialProbability,
      failureProbability,
      expectedPursuitDamage: partialProbability * hpMax * 0.04 + failureProbability * hpMax * 0.08,
    });
  }

  function calculateReactionContest(reactor = {}, sourceActor = {}) {
    const reactionDetails = calculateWithdrawalPressureDetails(reactor, sourceActor, 'WITHDRAW');
    const attackDetails = calculateWithdrawalPressureDetails(sourceActor, reactor, 'PURSUIT');
    const reactionPressure = reactionDetails.value;
    const attackPressure = attackDetails.value;
    const share = reactionPressure / Math.max(1, reactionPressure + attackPressure);
    return Object.freeze({
      probability: clamp(0.18 + (share - 0.5) * 1.1, 0.03, 0.78),
      reactionPressure,
      attackPressure,
      share,
      reactionAgility: reactionDetails.agility.value,
      sourceAgility: attackDetails.agility.value,
      reactionPressureBreakdown: reactionDetails,
      attackPressureBreakdown: attackDetails,
      reactionAgilityBreakdown: reactionDetails.agility,
      sourceAgilityBreakdown: attackDetails.agility,
    });
  }

  function calculateDefenseDamageMultiplier(reactor = {}, sourceActor = {}, prepared = false) {
    const defense = Math.max(1, readCombatStat(reactor, 'def'));
    const attack = Math.max(1, readCombatStat(sourceActor, 'str'));
    const staminaRatio = readResource(reactor, '体力') / Math.max(1, readResourceMax(reactor, '体力'));
    const ordinary = clamp(
      0.78 -
      Math.min(0.2, defense / (defense + attack) * 0.24) -
      Math.min(0.08, staminaRatio * 0.08),
      0.45,
      0.82,
    );
    return prepared ? Math.max(0.35, ordinary * 0.8) : ordinary;
  }

  function calculateDodgeProbability(reactor = {}, sourceActor = {}, prepared = false) {
    const ordinary = calculateReactionContest(reactor, sourceActor).probability;
    return prepared ? clamp(ordinary + (1 - ordinary) * 0.25, 0.03, 0.92) : ordinary;
  }

  function clearCache() {
    previewCache.clear();
    normalizedObjectivesCache = new WeakMap();
  }

  function readMetrics() {
    return Object.freeze({ ...metrics, cacheSize: previewCache.size });
  }

  const api = Object.freeze({
    version: VERSION,
    outcomeComponents,
    battlePrototypes: Object.freeze([...battlePrototypes]),
    nonBattlePrototypes: Object.freeze([...nonBattlePrototypes]),
    PreviewOverlay,
    ContributionLedger,
    stableHash,
    summonInstanceId,
    unitId,
    unitName,
    listUnits,
    findUnit,
    sideOf,
    isAlive,
    isDead,
    isPhysicallyAlive,
    isBattleCapable,
    isSummonUnit,
    shouldTriggerTraumaUnconscious,
    naturalActionOrderProfile,
    compareNaturalActionOrder,
    readIncapacityReason,
    evaluateObjectiveConditionDetail,
    readHp,
    readHpMax,
    readShield,
    calculateShieldGain,
    readResource,
    readResourceMax,
    staminaScaleForUnit,
    refreshStaminaAdjustedFinal,
    readCombatStat,
    readCombatStatBreakdown,
    dependencyValueForKey,
    parseSignedValue,
    calculateSettledSegmentDamage,
    normalizeEffectProbability,
    effectTargetsAllies,
    resolveTargets,
    collectEffects,
    effectArrayHash,
    declarationGrantsCounter,
    fusionSkillMetadata,
    resolveFusionAction,
    effectConditionEnabled,
    resolveConditionalEffectPlan,
    calculateBaseDamage,
    estimateHitProbability,
    expectedSegmentedDamageOutcome,
    calculateBaseActionValue,
    calculateDirectPotential,
    calculateAtomicActionPotential,
    calculateSequencePotential,
    calculateUnitCapacity,
    calculateTwoOpportunityCapacity,
    calculateWithdrawalPressure,
    calculateWithdrawalPressureDetails,
    estimateWithdrawal,
    calculateReactionContest,
    calculateDefenseDamageMultiplier,
    calculateDodgeProbability,
    deriveStateCombatEffect,
    actorSuppressesEffect,
    pendingGrantedEffects,
    normalizeBattleObjectives,
    buildObjectiveUnitIndex,
    evaluateBattleObjectives,
    evaluateBattleObjectivesCompact,
    calculateNonlethalHpFloor,
    previewAction,
    buildActionOperationGraph,
    evaluateOperationGraph,
    expandOperationGraphBranches,
    buildLifecycleEventSet,
    clearCache,
    readMetrics,
  });

  root.__LWCS_BATTLE_PREVIEW__ = api;
})();

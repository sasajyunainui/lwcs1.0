/* BattlePreview_Module.js - Pure battle preview and capacity model. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_preview_shared_prototype_registry_missing');
  }

  const VERSION = '7.3-R6.3-preview-2';
  const MAX_PREVIEW_NODES = 12;
  const MAX_RECURSION_DEPTH = 4;
  const effectHashCache = new WeakMap();
  const battlePrototypes = new Set([
    '伤害结算', '资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '结算修正',
    '炸环', '状态施加', '时窗修正', '状态移除', '规则防御', '状态转移', '状态交换',
    '资源锁定', '规则改写', '机制抹消', '机制授予', '复制执行', '时光回溯', '位移执行',
    '决策干扰', '召唤生成',
  ]);
  const nonBattlePrototypes = new Set(['修炼增益', '战斗外复活']);
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
  };
  const previewCache = new Map();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
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
      状态效果: cloneStates(unit?.状态效果),
    };
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
    metrics.stableHashCalls += 1;
    metrics.stableHashChars += text.length;
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

  function readHpMax(unit = {}) {
    return Math.max(1, readNumber(unit, ['hp_max', 'HP上限', '生命上限', 'vit_max', '体力上限'], 1));
  }

  function readHp(unit = {}) {
    const maximum = readHpMax(unit);
    return clamp(readNumber(unit, ['hp', 'HP', '生命', 'vit', '体力'], maximum), 0, maximum);
  }

  function readShield(unit = {}) {
    const direct = Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0));
    const stateTotal = Object.values(unit?.状态效果 || {}).reduce(
      (total, condition) => total + Math.max(0, Number(condition?.shield_value || 0)),
      0,
    );
    return Math.max(direct, stateTotal);
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
    if (/精神/.test(resource)) return Math.max(1, readNumber(unit, ['men_max', '精神力上限'], 1));
    if (/体力/.test(resource)) return Math.max(1, readNumber(unit, ['vit_max', 'sta_max', '体力上限'], 1));
    if (/生命|HP/i.test(resource)) return readHpMax(unit);
    return Math.max(1, readNumber(unit, ['sp_max', '魂力上限'], 1));
  }

  function readResource(unit = {}, resource = '') {
    if (/精神/.test(resource)) {
      const maximum = readResourceMax(unit, resource);
      return clamp(readNumber(unit, ['men', '精神力'], 0), 0, maximum);
    }
    if (/体力/.test(resource)) {
      const maximum = readResourceMax(unit, resource);
      return clamp(readNumber(unit, ['vit', 'sta', '体力'], 0), 0, maximum);
    }
    if (/生命|HP/i.test(resource)) return readHp(unit);
    const maximum = readResourceMax(unit, resource);
    return clamp(readNumber(unit, ['sp', '魂力'], 0), 0, maximum);
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
    return unit?.状态?.存活 === false || readHp(unit) <= 0;
  }

  function isBattleCapable(unit = {}) {
    const actionState = String(unit?.状态?.行动 || '').trim();
    return !isDead(unit) && readResource(unit, '体力') > 0 && !/失去战斗力|昏迷|投降|制服/.test(actionState);
  }

  function isAlive(unit = {}) {
    return isBattleCapable(unit);
  }

  function shouldTriggerTraumaUnconscious(damage = 0, hpAfter = 0, hpMax = 1) {
    const safeMax = Math.max(1, Number(hpMax || 1));
    return Number(hpAfter || 0) > 0 && Number(damage || 0) / safeMax >= 0.5 - 1e-9 && Number(hpAfter || 0) / safeMax < 0.2 - 1e-9;
  }

  function compareNaturalActionOrder(left = {}, right = {}) {
    const typePriority = { 辅助系: 1, 控制系: 2, 敏攻系: 2, 强攻系: 2, 精神系: 2, 元素系: 2, 防御系: 3, 治疗系: 3, 食物系: 3 };
    const leftType = String(left?.type || left?.系别 || left?.属性?.系别 || '').trim();
    const rightType = String(right?.type || right?.系别 || right?.属性?.系别 || '').trim();
    const priorityDelta = Number(typePriority[leftType] || 4) - Number(typePriority[rightType] || 4);
    if (priorityDelta) return priorityDelta;
    const agilityDelta = readCombatStat(right, 'agi') - readCombatStat(left, 'agi');
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

  function normalizeBattleObjectives(raw = {}, worldSnapshot = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const explicit = source.explicit === true || source.explicit !== false && Object.keys(source).some(key => !['version', 'explicit'].includes(key));
    const victorySource = source.victory || source.胜利 || {};
    const defeatSource = source.defeat || source.失败 || {};
    const victory = normalizeObjectiveGroup(victorySource, [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }]);
    const defeat = normalizeObjectiveGroup(defeatSource, [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }]);
    const currentRound = Math.max(0, Math.floor(Number(worldSnapshot?.回合 || 0)));
    return Object.freeze({
      version: 1,
      explicit,
      startRound: Math.max(0, Math.floor(Number(source.startRound ?? source.起始回合 ?? currentRound))),
      maxRounds: Math.max(1, Math.min(20, Math.floor(Number(source.maxRounds ?? source.回合上限 ?? 20) || 20))),
      resolutionPriority: /^(DRAW_ON_CONFLICT|平局)$/i.test(String(source.resolutionPriority || source.冲突处理 || 'DEFEAT_FIRST').trim()) ? 'DRAW_ON_CONFLICT' : 'DEFEAT_FIRST',
      victory,
      defeat,
    });
  }

  function objectiveUnits(worldSnapshot = {}, condition = {}) {
    const targetIds = new Set(condition.targetIds || []);
    return listUnits(worldSnapshot)
      .filter(entry => !condition.side || objectiveSideOfEntry(entry) === condition.side)
      .map(entry => entry.unit)
      .filter(unit => !targetIds.size || targetIds.has(unitId(unit)) || targetIds.has(unitName(unit)));
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

  function evaluateObjectiveConditionDetail(worldSnapshot = {}, condition = {}, options = {}) {
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
      return Object.freeze({ condition, matched, unitResults: Object.freeze([]), reason: matched ? 'WITHDRAW_SUCCESS' : '' });
    }
    if (condition.type === 'ROUND_REACHED') {
      if (options.roundCompleted !== true) return Object.freeze({ condition, matched: false, unitResults: Object.freeze([]), reason: '' });
      const elapsedRounds = Math.max(0, Number(options.round ?? worldSnapshot?.回合 ?? 0) - Number(options.startRound || 0));
      if (elapsedRounds < condition.round) return Object.freeze({ condition, matched: false, unitResults: Object.freeze([]), reason: '' });
      if (!condition.requireActive) return Object.freeze({ condition, matched: true, unitResults: Object.freeze([]), reason: 'ROUND_REACHED' });
      const units = objectiveUnits(worldSnapshot, condition);
      const unitResults = units.map(unit => Object.freeze({ unitId: unitId(unit), unitName: unitName(unit), matched: isBattleCapable(unit), reason: isBattleCapable(unit) ? 'ACTIVE' : readIncapacityReason(unit) }));
      const matched = unitResults.length > 0 && unitResults.some(result => result.matched);
      return Object.freeze({ condition, matched, unitResults: Object.freeze(unitResults), reason: matched ? 'ROUND_REACHED' : '' });
    }
    const units = objectiveUnits(worldSnapshot, condition);
    if (!units.length) return Object.freeze({ condition, matched: false, unitResults: Object.freeze([]), reason: 'NO_TARGET' });
    const unitResults = units.map(unit => {
      let matched = false;
      let reason = '';
      if (condition.type === 'TEAM_INCAPACITATED' || condition.type === 'UNIT_INCAPACITATED') {
        matched = !isBattleCapable(unit);
        reason = matched ? readIncapacityReason(unit) : '';
      } else if (condition.type === 'TEAM_DEAD' || condition.type === 'UNIT_DEAD') {
        matched = isDead(unit);
        reason = matched ? 'DEAD' : '';
      } else if (condition.type === 'HP_RATIO_AT_OR_BELOW') {
        matched = readHp(unit) / Math.max(1, readHpMax(unit)) <= condition.threshold + 1e-9;
        reason = matched ? 'HP_THRESHOLD_REACHED' : '';
      }
      if (condition.type === 'UNIT_DAMAGED') {
        const baseline = Number(condition.baselineHp?.[unitId(unit)] ?? condition.baselineHp?.[unitName(unit)] ?? readHpMax(unit));
        matched = readHp(unit) < Math.max(0, baseline) - 1e-9;
        reason = matched ? 'UNIT_DAMAGED' : '';
      }
      return Object.freeze({ unitId: unitId(unit), unitName: unitName(unit), matched, reason });
    });
    const matched = condition.scope === 'ALL' ? unitResults.every(result => result.matched) : unitResults.some(result => result.matched);
    const reason = matched ? unitResults.find(result => result.matched)?.reason || condition.type : '';
    return Object.freeze({ condition, matched, unitResults: Object.freeze(unitResults), reason });
  }

  function evaluateObjectiveCondition(worldSnapshot = {}, condition = {}, options = {}) {
    return evaluateObjectiveConditionDetail(worldSnapshot, condition, options).matched;
  }

  function evaluateBattleObjectives(worldSnapshot = {}, rawObjectives = {}, options = {}) {
    const objectives = normalizeBattleObjectives(rawObjectives, worldSnapshot);
    const evaluateGroup = group => {
      const details = group.conditions.map(condition => evaluateObjectiveConditionDetail(worldSnapshot, condition, {
        ...options,
        startRound: objectives.startRound,
      }));
      const matches = details.map(detail => detail.matched);
      return {
        matched: matches.length > 0 && (group.logic === 'ALL' ? matches.every(Boolean) : matches.some(Boolean)),
        matches,
        details,
      };
    };
    const victory = evaluateGroup(objectives.victory);
    const defeat = evaluateGroup(objectives.defeat);
    const units = listUnits(worldSnapshot);
    const playerUnits = units.filter(entry => objectiveSideOfEntry(entry) === 'PLAYER').map(entry => entry.unit);
    const enemyUnits = units.filter(entry => objectiveSideOfEntry(entry) === 'ENEMY').map(entry => entry.unit);
    const playerExhausted = playerUnits.length > 0 && playerUnits.every(unit => !isBattleCapable(unit));
    const enemyExhausted = enemyUnits.length > 0 && enemyUnits.every(unit => !isBattleCapable(unit));
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
    const implicitVictory = exhaustionDetail('ENEMY', enemyExhausted);
    const implicitDefeat = exhaustionDetail('PLAYER', playerExhausted);
    const effectiveVictoryMatched = victory.matched || enemyExhausted;
    const effectiveDefeatMatched = defeat.matched || playerExhausted;
    let status = 'ONGOING';
    if (effectiveVictoryMatched && effectiveDefeatMatched) status = objectives.resolutionPriority === 'DRAW_ON_CONFLICT' ? 'DRAW' : 'ENEMY_WIN';
    else if (effectiveVictoryMatched) status = 'PLAYER_WIN';
    else if (effectiveDefeatMatched) status = 'ENEMY_WIN';
    else if (timeLimitReached) status = 'DRAW';
    const exhaustionResolution = enemyExhausted || playerExhausted
      ? Object.freeze({
          playerExhausted,
          enemyExhausted,
          victory: implicitVictory,
          defeat: implicitDefeat,
        })
      : null;
    const resolvedVictoryDetails = !victory.matched && enemyExhausted
      ? [...victory.details, implicitVictory]
      : victory.details;
    const resolvedDefeatDetails = !defeat.matched && playerExhausted
      ? [...defeat.details, implicitDefeat]
      : defeat.details;
    return Object.freeze({
      status,
      winner: status === 'PLAYER_WIN' ? 'player' : status === 'ENEMY_WIN' ? 'enemy' : status === 'DRAW' ? 'draw' : 'unfinished',
      terminal: status !== 'ONGOING',
      victoryMatches: Object.freeze(victory.matches),
      defeatMatches: Object.freeze(defeat.matches),
      victoryDetails: Object.freeze(resolvedVictoryDetails),
      defeatDetails: Object.freeze(resolvedDefeatDetails),
      matchedDetails: Object.freeze((status === 'PLAYER_WIN' ? resolvedVictoryDetails : status === 'ENEMY_WIN' ? resolvedDefeatDetails : [...resolvedVictoryDetails, ...resolvedDefeatDetails]).filter(detail => detail.matched)),
      timeLimitReached,
      terminalReason: enemyExhausted && playerExhausted
        ? 'BATTLEFIELD_BOTH_EXHAUSTED'
        : effectiveVictoryMatched && effectiveDefeatMatched
          ? 'OBJECTIVE_CONFLICT'
          : status === 'PLAYER_WIN' && !victory.matched && enemyExhausted
            ? 'BATTLEFIELD_ENEMY_EXHAUSTED'
            : status === 'ENEMY_WIN' && !defeat.matched && playerExhausted
              ? 'BATTLEFIELD_PLAYER_EXHAUSTED'
              : timeLimitReached ? 'ROUND_LIMIT_REACHED' : '',
      exhaustionResolution,
      objectives,
    });
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
    const perSegment = total / segments;
    return Math.max(0, perSegment * segments);
  }

  function estimateHitProbability(actor = {}, target = {}, effect = {}) {
    const explicit = Number(effect?.命中概率 ?? effect?.触发概率);
    if (Number.isFinite(explicit)) return clamp(explicit > 1 ? explicit / 100 : explicit, 0, 1);
    const attackAgility = readCombatStat(actor, 'agi');
    const targetAgility = readCombatStat(target, 'agi');
    const actorEffects = stateEntries(actor).map(([, state]) => state?.战斗效果 || {});
    const targetEffects = stateEntries(target).map(([, state]) => state?.战斗效果 || {});
    const hitAdjustment = actorEffects.reduce((sum, stateEffect) =>
      sum + Number(stateEffect?.hit_bonus || 0) - Number(stateEffect?.hit_penalty || 0), 0);
    const targetAvoidanceAdjustment = targetEffects.reduce((sum, stateEffect) =>
      sum + Number(stateEffect?.dodge_bonus || 0) -
      Math.max(Number(stateEffect?.dodge_penalty || 0), Number(stateEffect?.lock_level || 0)), 0);
    return clamp(
      0.78 +
      (attackAgility - targetAgility) / Math.max(100, attackAgility + targetAgility) * 0.35 +
      hitAdjustment -
      targetAvoidanceAdjustment,
      0.05,
      0.99,
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

  function effectConditionEnabled(effect = {}, worldSnapshot = {}, actor = {}, target = {}) {
    const branches = Array.isArray(effect?.条件分支) ? effect.条件分支 : [];
    if (!branches.length) return true;
    const timeLabel = String(
      worldSnapshot?.时间段 ||
      worldSnapshot?.时间 ||
      worldSnapshot?.环境?.时间段 ||
      actor?.时间段 ||
      actor?.时间 ||
      '白天'
    ).trim();
    const conditionMatches = condition => {
      const type = String(condition?.类型 || '').trim();
      const comparison = String(condition?.比较 || '==').trim().toLowerCase();
      const expected = String(condition?.值 ?? '').trim();
      let actual = '';
      if (type === '时间') actual = timeLabel;
      else if (type === '目标') actual = sideOf(worldSnapshot, target) === sideOf(worldSnapshot, actor) ? '己方' : '敌方';
      else return false;
      if (comparison === '!=' || comparison === '!==') return actual.toLowerCase() !== expected.toLowerCase();
      if (comparison === '包含') return actual.includes(expected);
      return actual.toLowerCase() === expected.toLowerCase();
    };
    const branchMatches = branch => {
      const conditions = Array.isArray(branch?.条件) ? branch.条件 : [];
      return conditions.length > 0 && conditions.every(conditionMatches);
    };
    if (branches.some(branch => String(branch?.处理 || '').trim() === '禁用' && branchMatches(branch))) return false;
    const enablingBranches = branches.filter(branch => String(branch?.处理 || '').trim() === '生效');
    return !enablingBranches.length || enablingBranches.some(branchMatches);
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
      if (summons && typeof summons === 'object') {
        Object.defineProperty(snapshot, '召唤单位表', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: Object.fromEntries(Object.entries(summons).map(([key, unit]) => [
            key,
            this.changedUnits.get(unitId(unit)) || unit,
          ])),
        });
      }
      return snapshot;
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
      if (/迟缓|僵直|眩晕|昏迷|中毒|灼烧|虚弱|禁锢|束缚|沉默|缴械|致盲|标记|减速|位移限制|索敌干扰/.test(state)) return false;
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
    if (/自身/.test(targetText)) return [actor];
    const friendly = all.filter(entry => entry.side === actorSide && isAlive(entry.unit)).map(entry => entry.unit);
    const hostile = all.filter(entry => entry.side !== actorSide && isAlive(entry.unit)).map(entry => entry.unit);
    if (/友方.*群体|己方.*群体/.test(targetText)) return friendly;
    if (/全场/.test(targetText)) return [...friendly, ...hostile];
    if (/群体/.test(targetText)) return effectTargetsAllies(effect) ? friendly : hostile;
    if (declaredIds.length) return declaredIds.map(id => findUnit(worldSnapshot, id)).filter(Boolean);
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

  function setResourceValue(unit, resource, value) {
    if (/生命|HP/i.test(resource)) setHp(unit, value);
    else setResource(unit, resource, value);
  }

  function deriveStateCombatEffect(effect = {}) {
    const state = String(effect?.状态 || effect?.状态名称 || '').trim();
    const combatEffect = cloneValue(effect?.计算层效果 || effect?.战斗效果 || {});
    const magnitude = clamp(Math.abs(parseSignedValue(effect?.数值, 1)), 0, 1);
    if (/中毒|流血|灼烧|冻伤|持续创伤/.test(state)) {
      combatEffect.dot_damage_ratio = Math.max(Number(combatEffect.dot_damage_ratio || 0), magnitude);
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
      combatEffect.reaction_penalty = Math.max(Number(combatEffect.reaction_penalty || 0), magnitude || 0.15);
      combatEffect.dodge_penalty = Math.max(Number(combatEffect.dodge_penalty || 0), magnitude || 0.15);
    }
    if (/位移限制|定身|束缚|禁锢/.test(state)) {
      combatEffect.dodge_penalty = Math.max(Number(combatEffect.dodge_penalty || 0), magnitude || 0.2);
      combatEffect.lock_level = Math.max(Number(combatEffect.lock_level || 0), magnitude || 0.2);
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

  function stateEntries(unit = {}) {
    const states = unit?.状态效果;
    if (Array.isArray(states)) return states.map((state, index) => [String(index), state]).filter(([, state]) => state && typeof state === 'object');
    if (states && typeof states === 'object') return Object.entries(states).filter(([, state]) => state && typeof state === 'object');
    return [];
  }

  function stateName(state = {}) {
    return String(state?.状态 || state?.状态名称 || state?.名称 || '').trim();
  }

  function isNegativeState(state = {}) {
    const type = String(state?.类型 || state?.正负面 || state?.性质 || '').trim();
    if (/负|减益|异常|控制/.test(type) || state?.debuff === true) return true;
    return /中毒|流血|灼烧|眩晕|沉默|禁疗|迟缓|致盲|混乱|嘲讽|位移限制|精神紊乱/.test(stateName(state));
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
    const attribute = String(effect?.属性 || '').trim();
    const aliases = {
      力量: ['str', '力量'],
      防御: ['def', '防御'],
      敏捷: ['agi', '敏捷'],
      魂力上限: ['sp_max', '魂力上限'],
      精神力上限: ['men_max', '精神力上限'],
      体力上限: ['vit_max', '体力上限'],
    };
    const keys = aliases[attribute] || [attribute];
    const current = readNumber(unit, keys, 0);
    const delta = parseSignedValue(effect?.数值, current);
    const next = Math.max(0, current + delta);
    if (keys[0]) unit[keys[0]] = next;
    if (unit.属性 && typeof unit.属性 === 'object' && keys[1]) unit.属性[keys[1]] = next;
    return { attribute, current, next, delta: next - current };
  }

  function resourceOutcome(effect, target, overlay, ledger, context) {
    const currentTarget = overlay.readUnit(unitId(target));
    const resource = String(effect?.资源 || '魂力').trim();
    const current = /生命|HP/i.test(resource) ? readHp(currentTarget) : readResource(currentTarget, resource);
    const maximum = readResourceMax(currentTarget, resource);
    const delta = parseSignedValue(effect?.数值, maximum);
    const next = clamp(current + delta, 0, maximum);
    overlay.changeUnit(unitId(target), unit => {
      setResourceValue(unit, resource, next);
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
    validateEffect(effect);
    if (depth > MAX_RECURSION_DEPTH) throw new Error('battle_preview_recursion_depth_exceeded');
    const effectContext = { ...context, depth, effectPath: [...context.effectPath, context.effectInstanceId] };
    const activeFingerprint = consumePreviewNode(effectContext, effect);
    try {
      const actor = overlay.readUnit(unitId(context.actor));
      if (prototype === '伤害结算') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const rawDamage = calculateBaseDamage(effect, actor, currentTarget);
          const hitProbability = estimateHitProbability(actor, currentTarget, effect);
          const applicationProbability = clamp(Number(
            context?.applicationProbabilityByTarget?.get(unitId(target)) ??
            context?.applicationProbability ??
            1
          ), 0, 1);
          const nonlethalIntent = /点到为止|切磋|训练|非致命/.test(String(context?.battleIntent?.mode || context?.battleIntent || '').trim());
          const hpDamageLimit = nonlethalIntent ? Math.max(0, readHp(currentTarget) - 1) : readHp(currentTarget);
          const shieldBefore = readShield(currentTarget);
          const incomingDamage = Math.min(shieldBefore + hpDamageLimit, rawDamage * hitProbability * applicationProbability);
          const fullHitIncoming = Math.min(shieldBefore + hpDamageLimit, rawDamage);
          let shieldAbsorb = 0;
          let expectedDamage = 0;
          overlay.changeUnit(unitId(target), unit => {
            shieldAbsorb = absorbPreviewShield(unit, incomingDamage);
            expectedDamage = Math.min(hpDamageLimit, Math.max(0, incomingDamage - shieldAbsorb));
            setHp(unit, readHp(unit) - expectedDamage);
          });
          const fullHitDamage = Math.min(hpDamageLimit, Math.max(0, fullHitIncoming - shieldBefore));
          const traumaUnconscious = shouldTriggerTraumaUnconscious(fullHitDamage, readHp(currentTarget) - fullHitDamage, readHpMax(currentTarget));
          const nonlethalIncapacitated = nonlethalIntent && hpDamageLimit > 0 && expectedDamage >= hpDamageLimit - 1e-9;
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
              evidence: { current: shieldBefore, next: Math.max(0, shieldBefore - shieldAbsorb), delta: -shieldAbsorb, absorbedDamage: shieldAbsorb },
            });
          }
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'HP_DELTA',
            threatValue: expectedDamage / readHpMax(currentTarget) * 100,
            evidence: { rawDamage, hitProbability, applicationProbability, incomingDamage, shieldAbsorb, expectedDamage, damageType: effect?.伤害类型 || '' },
          });
          if (nonlethalIncapacitated) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'NONLETHAL_INCAPACITATION',
              threatValue: 0,
              evidence: { reason: 'NONLETHAL_INCAPACITATION', hpFloor: 1 },
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
        const amount = Math.abs(parseSignedValue(effect?.数值, readResourceMax(currentTarget, resource)));
        const actorCurrent = readResource(actor, resource);
        const targetCurrent = readResource(currentTarget, resource);
        const mode = String(effect?.资源转移方式 || '转移').trim();
        let actorNext = actorCurrent;
        let targetNext = targetCurrent;
        if (mode === '吞噬') {
          const moved = Math.min(amount, targetCurrent, readResourceMax(actor, resource) - actorCurrent);
          actorNext += moved;
          targetNext -= moved;
        } else if (mode === '共享' || mode === '均分') {
          const shared = (actorCurrent + targetCurrent) / 2;
          actorNext = clamp(shared, 0, readResourceMax(actor, resource));
          targetNext = clamp(shared, 0, readResourceMax(currentTarget, resource));
        } else {
          const moved = Math.min(amount, actorCurrent, readResourceMax(currentTarget, resource) - targetCurrent);
          actorNext -= moved;
          targetNext += moved;
        }
        overlay.changeUnit(unitId(actor), unit => setResourceValue(unit, resource, actorNext));
        overlay.changeUnit(unitId(currentTarget), unit => setResourceValue(unit, resource, targetNext));
        [actor, currentTarget].forEach((unit, index) => ledger.addOutcome({
          ...context,
          targetId: unitId(unit),
          effectInstanceId: `${context.effectInstanceId}:${index}`,
          outcomeKind: 'RESOURCE_OPTION_CHANGED',
          threatValue: 0,
          evidence: { resource, mode, delta: index === 0 ? actorNext - actorCurrent : targetNext - targetCurrent },
        }));
        return;
      }
      if (prototype === '护盾变化') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const current = readShield(currentTarget);
          const mode = String(effect?.护盾模式 || '正向护盾').trim();
          const requested = Math.abs(parseSignedValue(effect?.数值, readHpMax(currentTarget)));
          const delta = mode === '正向护盾' ? requested : -Math.min(current, requested);
          const next = Math.max(0, current + delta);
          overlay.changeUnit(unitId(target), unit => {
            unit.shield = next;
            unit.护盾 = next;
          });
          if (mode === '窃盾' && unitId(currentTarget) !== unitId(actor) && current > next) {
            const actorShieldBefore = readShield(actor);
            const stolen = current - next;
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
              evidence: { mode, current: actorShieldBefore, next: actorShieldBefore + stolen, stolenFrom: unitId(currentTarget) },
            });
          }
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'SHIELD_DELTA',
            threatValue: delta / readHpMax(currentTarget) * 100,
            evidence: { mode, current, next, duration: Math.max(1, Number(effect?.持续回合 || 1)) },
          });
        });
        return;
      }
      if (prototype === '属性修正') {
        targets.forEach(target => {
          let evidence;
          overlay.changeUnit(unitId(target), unit => {
            const existing = findStateEntry(unit, effect);
            const marginal = addState(unit, effect, context.effectInstanceId);
            evidence = existing
              ? { attribute: String(effect?.属性 || '').trim(), current: readNumber(unit, [String(effect?.属性 || '').trim()], 0), next: readNumber(unit, [String(effect?.属性 || '').trim()], 0), delta: 0, marginal, refreshed: marginal }
              : { ...applyStatModifier(unit, effect), marginal };
          });
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED', threatValue: 0, evidence });
        });
        return;
      }
      if (prototype === '决策干扰') {
        targets.forEach(target => {
          overlay.schedule({ type: 'BELIEF_INTERFERENCE', targetId: unitId(target), interference: effect?.干扰 || '', value: effect?.数值 || '', duration: Math.max(1, Number(effect?.持续回合 || 1)) });
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'BELIEF_CHANGED', threatValue: 0, evidence: { interference: effect?.干扰 || '', duration: Math.max(1, Number(effect?.持续回合 || 1)) } });
        });
        return;
      }
      if (['判定修正', '结算修正', '状态施加', '资源锁定', '位移执行'].includes(prototype)) {
        targets.forEach(target => {
          const delay = Math.max(0, Number(effect?.延迟回合 || 0));
          if (prototype === '状态施加' && delay > 0) {
            overlay.schedule({ type: 'DELAYED_STATE', targetId: unitId(target), effect: cloneValue(effect), delay });
            ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_SCHEDULED', threatValue: 0, evidence: { state: effect?.状态 || '', delay } });
            return;
          }
          let marginal = false;
          const applicationProbability = clamp(Number(
            context?.applicationProbabilityByTarget?.get(unitId(target)) ??
            context?.applicationProbability ??
            1
          ), 0, 1);
          overlay.changeUnit(unitId(target), unit => {
            marginal = addState(unit, { ...effect, __previewApplicationProbability: applicationProbability }, context.effectInstanceId);
          });
          const state = String(effect?.状态 || '').trim();
          const combatEffect = deriveStateCombatEffect(effect);
          const cancelsAction = marginal && (combatEffect?.skip_turn === true || combatEffect?.cannot_act === true);
          const outcomeKind = cancelsAction ? 'ACTION_CANCELLED' : prototype === '状态施加' ? 'STATE_CHANGED' : 'NEXT_ACTION_QUALITY_CHANGED';
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind,
            threatValue: 0,
            evidence: { prototype, state, duration: Math.max(1, Number(effect?.持续回合 || 1)), applicationProbability, cancelsAction, marginal },
          });
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
          overlay.changeUnit(unitId(target), unit => {
            const entries = stateEntries(unit).map(([key, state]) => {
              const next = cloneValue(state);
              const current = Math.max(0, Number(next?.duration ?? next?.持续回合 ?? 0));
              const mode = String(effect?.调整方式 || '').trim();
              const duration = /压缩|减少|缩短/.test(mode) ? Math.max(0, current - Math.abs(adjustment)) : current + Math.abs(adjustment);
              next.duration = duration;
              return [key, next];
            });
            replaceStates(unit, entries);
          });
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { adjustment } });
        });
        return;
      }
      if (prototype === '状态移除') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const matches = new Set(matchingStates(currentTarget, effect?.状态 || '任意状态').map(([key]) => key));
          const limit = Math.max(0, Number(effect?.数量 || matches.size));
          const removedKeys = [...matches].slice(0, limit || matches.size);
          overlay.changeUnit(unitId(target), unit => replaceStates(unit, stateEntries(unit).filter(([key]) => !removedKeys.includes(key))));
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { removedKeys } });
        });
        return;
      }
      if (['规则防御', '规则改写', '机制抹消'].includes(prototype)) {
        targets.forEach(target => {
          const rule = String(effect?.规则 || effect?.抹消对象 || prototype).trim();
          overlay.writeRule(`${unitId(target)}:${prototype}:${rule}`, { ...effect, targetId: unitId(target) });
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'RULE_CHANGED', threatValue: 0, evidence: { prototype, rule } });
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
        overlay.schedule({ type: 'MECHANISM_GRANT', actorId: unitId(actor), targetIds: targets.map(unitId), effects: cloneValue(granted), trigger: effect?.触发条件 || '主动触发' });
        targets.forEach(target => ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'ACTION_GRANTED', threatValue: 0, evidence: { trigger: effect?.触发条件 || '主动触发', count: granted.length } }));
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
          const historicUnit = findUnit(history, unitId(target));
          if (!historicUnit) throw new Error(`battle_preview_rewind_target_missing:${unitId(target)}`);
          overlay.writeUnit(cloneValue(historicUnit));
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { rewind: true } });
        });
        return;
      }
      if (prototype === '召唤生成') {
        const summonName = String(effect?.召唤物名称 || '').trim();
        if (!summonName) throw new Error('battle_preview_summon_name_missing');
        overlay.schedule({
          type: 'SUMMON_CREATE',
          actorId: unitId(actor),
          effectInstanceId: context.effectInstanceId,
          summonName,
          summonType: String(effect?.召唤单位类型 || effect?.召唤类型 || '').trim(),
          count: Math.max(1, Number(effect?.数量 || 1)),
          actionMode: effect?.行动模式 || '',
          duration: Math.max(1, Number(effect?.持续回合 || 1)),
          strength: Math.max(0.01, Number(effect?.强度 || effect?.召唤强度 || 1)),
          inheritRatio: Math.max(0, Number(effect?.继承属性比例 || 0)),
        });
        ledger.addOutcome({ ...context, targetId: unitId(actor), outcomeKind: 'SUMMON_WINDOW', threatValue: 0, evidence: { summonName, duration: Math.max(1, Number(effect?.持续回合 || 1)) } });
      }
    } finally {
      context.nodeBudget.activeFingerprints.delete(activeFingerprint);
    }
  }

  function basicAttackEffect() {
    return { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 生效方式: '独立生效' };
  }

  function calculateBaseActionValue(actor = {}, target = {}, declaration = {}) {
    const effects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object') : [];
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
      input.actionFingerprint || stableHash(input.declaration || {}),
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
    Object.entries(declaration?.resourceCosts || {}).forEach(([resource, rawCost], index) => {
      const currentActor = overlay.readUnit(unitId(actor));
      const maximum = readResourceMax(currentActor, resource);
      const costText = String(rawCost ?? '').trim();
      const numericCost = Math.max(0, Number.parseFloat(costText) || 0);
      const cost = costText.includes('%') ? maximum * numericCost / 100 : numericCost;
      const before = readResource(currentActor, resource);
      if (before + 1e-9 < cost) throw new Error(`battle_preview_resource_insufficient:${resource}`);
      overlay.changeUnit(unitId(actor), unit => setResourceValue(unit, resource, before - cost));
      ledger.addOutcome({
        rootActionId,
        effectInstanceId: `${rootActionId}:cost:${index}`,
        targetId: unitId(actor),
        windowId: 'ACTION_COST',
        outcomeKind: 'RESOURCE_OPTION_CHANGED',
        threatValue: 0,
        evidence: { resource, before, next: before - cost, delta: -cost },
      });
    });
    const effects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object') : [];
    if (!effects.length && !['DEFEND', 'EVADE', 'WITHDRAW', 'EQUIP', 'OBSERVE'].includes(String(declaration?.actionKind || '').trim())) {
      throw new Error('battle_preview_action_effects_missing');
    }
    const nodeBudget = { count: 0, limit: budgetLimit, activeFingerprints: new Set() };
    const primarySuccessProbability = new Map();
    effects.forEach((effect, index) => {
      const targets = resolveTargets(worldSnapshot, actor, declaration, effect);
      if (!effectConditionEnabled(effect, worldSnapshot, actor, targets[0])) return;
      const followsPrimary = index > 0 && String(effect?.生效方式 || '').trim() === '跟随主原型';
      const context = {
        actor,
        declaration,
        worldSnapshot,
        nodeBudget,
        depth: 0,
        effectPath: [],
        rootActionId,
        effectInstanceId: String(effect?.effectId || effect?.效果ID || `${rootActionId}:effect:${index}`).trim(),
        windowId: `round:${Number(worldSnapshot?.回合 || 0)}:effect:${index}`,
        battleIntent: input?.battleIntent || {},
      };
      if (followsPrimary) {
        context.applicationProbabilityByTarget = new Map(
          targets.map(target => [unitId(target), primarySuccessProbability.get(unitId(target)) ?? 0])
        );
      }
      applyEffect(effect, targets, overlay, ledger, context, 0);
      if (index === 0) {
        targets.forEach(target => {
          const prototype = String(effect?.原型 || '').trim();
          if (prototype === '伤害结算') {
            const perSegment = estimateHitProbability(actor, target, effect);
            const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 || effect?.段数 || 1)) || 1);
            primarySuccessProbability.set(unitId(target), 1 - Math.pow(1 - perSegment, segments));
          } else if (prototype === '状态施加') {
            primarySuccessProbability.set(unitId(target), clamp(Number(effect?.成功率 ?? effect?.触发概率 ?? 1), 0, 1));
          } else {
            primarySuccessProbability.set(unitId(target), 1);
          }
        });
      }
    });
    metrics.maxNodesObserved = Math.max(metrics.maxNodesObserved, nodeBudget.count);
    const result = Object.freeze({
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
    });
    previewCache.set(cacheKey, result);
    return result;
  }

  function calculateWithdrawalPressure(unit = {}, opponent = {}, stance = 'WITHDRAW') {
    const agility = readCombatStat(unit, 'agi');
    const spirit = readResource(unit, '精神力');
    const spiritMax = readResourceMax(unit, '精神力');
    const stamina = readResource(unit, '体力');
    const staminaMax = readResourceMax(unit, '体力');
    const spiritRatio = clamp(spirit / Math.max(1, spiritMax), 0, 1);
    const staminaRatio = clamp(stamina / Math.max(1, staminaMax), 0, 1);
    const effects = stateEntries(unit).map(([, state]) => state?.战斗效果 || {});
    const lockPressure = effects.reduce((sum, effect) => sum + Number(effect?.lock_level || 0) * 18, 0);
    const dodgeModifier = effects.reduce((sum, effect) => sum + Number(effect?.dodge_bonus || 0) * 100 - Number(effect?.dodge_penalty || 0) * 100, 0);
    const reactionModifier = effects.reduce((sum, effect) => sum + Number(effect?.reaction_bonus || 0) * 80 - Number(effect?.reaction_penalty || 0) * 80, 0);
    const hardControlPenalty = effects.some(effect => effect?.skip_turn === true || effect?.cannot_react === true) ? 999999 : 0;
    const opposingSpirit = readResource(opponent, '精神力');
    const resourcePressure = clamp(
      Math.pow(Math.max(0.01, spirit / Math.max(1, opposingSpirit)), 0.35) * (0.45 + 0.55 * spiritRatio),
      0.35,
      1.65,
    );
    const base = agility * 0.72 + spirit * 0.012 + spiritMax * 0.025;
    const stanceMultiplier = stance === 'PURSUIT' ? 1.08 : 1;
    return Math.max(0, base * (0.35 + spiritRatio * 0.4 + staminaRatio * 0.25) * resourcePressure * stanceMultiplier + dodgeModifier + reactionModifier - lockPressure - hardControlPenalty);
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

  function clearCache() {
    previewCache.clear();
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
    unitId,
    unitName,
    listUnits,
    findUnit,
    sideOf,
    isAlive,
    isDead,
    isBattleCapable,
    shouldTriggerTraumaUnconscious,
    compareNaturalActionOrder,
    readIncapacityReason,
    evaluateObjectiveConditionDetail,
    readHp,
    readHpMax,
    readShield,
    readResource,
    readResourceMax,
    readCombatStat,
    parseSignedValue,
    effectTargetsAllies,
    collectEffects,
    effectConditionEnabled,
    calculateBaseDamage,
    estimateHitProbability,
    calculateBaseActionValue,
    calculateUnitCapacity,
    calculateWithdrawalPressure,
    estimateWithdrawal,
    deriveStateCombatEffect,
    normalizeBattleObjectives,
    evaluateBattleObjectives,
    previewAction,
    clearCache,
    readMetrics,
  });

  root.__LWCS_BATTLE_PREVIEW__ = api;
})();

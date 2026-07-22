/* BattleReport_Module.js - Structured battle fact projection and narration. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const runtime = root.__LWCS_BATTLE_RUNTIME__;
  if (!runtime || runtime.version !== '7.3-R6.3') {
    throw new Error(`battle_report_runtime_version_mismatch:${runtime?.version || 'missing'}`);
  }

  const visibilityModes = Object.freeze(['PLAYER', 'DEVELOPER']);
  const reportSchemaVersion = '8.3-report-1';
  const internalSummonPattern = /(?:structured-summon|battle-summon|summon-instance|preview-summon):[^\s,，。；;|]+/gi;
  const internalSummonIdPattern = /^(?:structured-summon|battle-summon|summon-instance|preview-summon):/i;
  const passiveEventKinds = new Set([
    'state_tick',
    'round_recover',
    'state_expire',
    'state_remove',
    'summon_end',
    'lost_opportunity',
    'action_cancelled',
    'blocked_action',
  ]);
  const responseEventKinds = new Set([
    'reaction_window',
    'dodge',
    'defend',
    'guard',
    'counter_window',
    'counter',
    'reflect_damage',
  ]);
  const resultLabels = Object.freeze({
    DECLARED: '已声明',
    PENDING: '蓄力中',
    SUCCESS: '成功',
    FAILURE: '失败',
    FAILED: '失败',
    ABORTED: '已中止',
    BLOCKED: '已阻断',
    LOST: '未执行',
    COMPLETED: '已完成',
    NO_EFFECT: '未产生效果',
    RESISTED: '被抵抗',
    IMMUNE: '免疫',
    APPLIED: '已生效',
    GAIN: '获得',
    LOSS: '失去',
    CANCELLED: '已取消',
    EXPIRED: '已到期',
    HIT: '命中',
    MISS: '未命中',
    DRAW: '平局',
  });
  const problemLabels = Object.freeze({
    TERMINAL_OPPORTUNITY: '终结机会',
    SURVIVAL_CRISIS: '生存危机',
    IMMINENT_DENIAL: '即将到来的关键威胁',
    ALLY_CRISIS: '队友危机',
    CAPABILITY_SHORTAGE: '有效行为不足',
    ADVANTAGE_WINDOW: '优势窗口',
    INFORMATION_DEFICIT: '情报不足',
    DISENGAGE_PRESSURE: '脱离压力',
    NEUTRAL_PROGRESS: '推进战果',
    STALEMATE: '打破僵局',
  });
  const classificationLabels = Object.freeze({
    HARD_INVALID: '机械不可行',
    DOMINATED: '被更优方案严格支配',
    TACTICAL_ERROR: '存在战术失误风险',
    CONTEXT_RISK: '具有情境风险',
    SELF_DEFEATING: '可能导致自毁',
    ZERO_PROGRESS: '无法推进局面',
    VIABLE: '可行',
  });
  const rejectionLabels = Object.freeze({
    HARD_INVALID: '机械条件不成立',
    DOMINATED: '同用途下收益更低且代价不低',
    ZERO_PROGRESS: '不会改变当前局面',
    ZERO_EFFECT_COSTLY: '没有有效边际且需要付出代价',
    CONTROL_WINDOW_NOT_REALIZABLE: '控制无法覆盖真实行动机会',
    UNCOMPENSATED_RESOURCE_BANKRUPTCY: '会造成无补偿的资源破产',
    UNCOMPENSATED_SELF_DEFEAT: '会造成无补偿的自毁',
    TERMINAL_OBJECTIVE_CONFLICT: '与当前战斗目标冲突',
    SUMMON_WINDOW_MISSING: '召唤物没有可兑现的行动窗口',
  });
  const resourceLabels = Object.freeze({
    hp: '生命',
    HP: '生命',
    shield: '护盾',
    sp: '魂力',
    soul: '魂力',
    men: '精神力',
    spirit: '精神力',
    vit: '体力',
    sta: '体力',
    stamina: '体力',
  });
  const actionKindLabels = Object.freeze({
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
  });

  function cloneValue(value) {
    return runtime.cloneValue(value);
  }

  function text(value = '') {
    return String(value ?? '').trim();
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function displayNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0';
    if (Number.isInteger(numeric)) return String(numeric);
    const precision = Math.abs(numeric) >= 100 ? 1 : 2;
    return String(Number(numeric.toFixed(precision)));
  }

  function unique(values = []) {
    return [...new Set(values.map(value => text(value)).filter(Boolean))];
  }

  function uniqueBy(values = [], keyOf = value => value) {
    const seen = new Set();
    return values.filter(value => {
      const key = keyOf(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeVisibilityMode(value = 'PLAYER') {
    const mode = text(value).toUpperCase();
    if (!visibilityModes.includes(mode)) throw new Error(`battle_report_visibility_mode_invalid:${mode || 'missing'}`);
    return mode;
  }

  function eventFactType(event = {}) {
    const kind = text(event?.eventKind);
    if (kind === 'state_tick') return 'STATE_TICK';
    if (kind === 'round_summary') return 'ROUND_SUMMARY';
    return text(event?.factType || runtime.inferFactType(kind, event) || 'EVENT');
  }

  function structuredResultCategory(event = {}) {
    if (text(event?.eventKind) !== 'hit_result') return '';
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const primaryOutcome = text(event?.primaryOutcome || meta?.primaryOutcome).toLowerCase();
    const rawResult = text(event?.result || meta?.result).toLowerCase();
    if (['dodged', 'attack_missed', 'miss'].includes(primaryOutcome) || rawResult === 'miss') return 'MISS';
    if (Number(event?.appliedDamage ?? meta?.appliedDamage ?? event?.damage ?? meta?.damage ?? 0) > 0) return 'DAMAGE';
    if (Number(meta?.shieldAbsorb ?? 0) > 0 || primaryOutcome === 'shield_absorbed') return 'SHIELD';
    if (['hit', 'no_effect', 'full_hit', 'shield_absorbed'].includes(rawResult || primaryOutcome)) {
      return 'HIT_NO_DAMAGE';
    }
    return '';
  }

  function snapshotTeam(snapshot = {}, side = 'player') {
    const projected = side === 'player' ? snapshot?.team_player : snapshot?.team_enemy;
    if (Array.isArray(projected)) return projected;
    const formal = snapshot?.参战者?.[side === 'player' ? 'team_player' : 'team_enemy'];
    return Array.isArray(formal) ? formal : Object.values(formal || {});
  }

  function snapshotSummons(snapshot = {}) {
    if (Array.isArray(snapshot?.summons)) return snapshot.summons;
    return Object.values(snapshot?.召唤单位表 || {});
  }

  function snapshotUnits(snapshot = {}) {
    return [
      ...snapshotTeam(snapshot, 'player').map(unit => ({ unit, side: 'player' })),
      ...snapshotTeam(snapshot, 'enemy').map(unit => ({ unit, side: 'enemy' })),
      ...snapshotSummons(snapshot).map(unit => ({
        unit,
        side: text(unit?.side || unit?.阵营).toLowerCase().includes('enemy') ? 'enemy' : 'player',
      })),
    ];
  }

  function buildEntityDirectory(draft = {}, ledger = []) {
    const aliases = new Map();
    let summonSequence = 0;
    const register = (rawId, name, side = '', hostName = '') => {
      const id = text(rawId);
      if (!id) return null;
      const current = aliases.get(id);
      const internalSummon = internalSummonIdPattern.test(id);
      if (current) {
        if (!current.name && name) current.name = text(name);
        if (!current.side && side) current.side = text(side);
        if (!current.hostName && hostName) current.hostName = text(hostName);
        return current;
      }
      const entry = {
        rawId: id,
        publicId: internalSummon ? `summon-ref-${++summonSequence}` : id,
        name: text(name || id),
        side: text(side),
        hostName: text(hostName),
        internalSummon,
      };
      aliases.set(id, entry);
      if (entry.publicId && entry.publicId !== id) aliases.set(entry.publicId, entry);
      return entry;
    };
    [draft?.initialSnapshot, draft?.finalSnapshot].forEach(snapshot => {
      snapshotUnits(snapshot).forEach(({ unit, side }) => {
        const id = text(unit?.id || unit?.召唤键 || unit?.name || unit?.名称);
        const name = text(unit?.name || unit?.名称 || unit?.召唤名称 || id);
        const entry = register(id, name, side, unit?.宿主名);
        if (unit?.召唤键) register(unit.召唤键, name, side, unit?.宿主名);
        if (entry && name && !aliases.has(name)) aliases.set(name, entry);
      });
    });
    ledger.forEach(event => {
      const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
      if (text(event?.eventKind) === 'summon_create') {
        const summonId = text(meta?.summonKey || event?.summonKey || event?.targetId);
        const summonName = text(meta?.summonName || event?.summonName || event?.createdName || event?.targetName || '召唤物');
        const entry = register(summonId, summonName, event?.targetSide, event?.actorName);
        if (entry && summonName && !aliases.has(summonName)) aliases.set(summonName, entry);
      }
      const actorId = text(event?.actorId);
      const actorName = text(event?.actorName);
      if (actorId) {
        const entry = register(actorId, actorName || actorId, event?.actorSide);
        if (entry && actorName && !aliases.has(actorName)) aliases.set(actorName, entry);
      }
      const targetId = text(event?.targetId);
      const targetName = text(event?.targetName);
      if (targetId) {
        const entry = register(targetId, targetName || targetId, event?.targetSide);
        if (entry && targetName && !aliases.has(targetName)) aliases.set(targetName, entry);
      }
    });
    const internalEntries = [...new Set(aliases.values())].filter(entry => entry?.internalSummon);
    const duplicateSummons = new Map();
    internalEntries.forEach(entry => {
      const baseName = text(entry?.name || '召唤物');
      if (!duplicateSummons.has(baseName)) duplicateSummons.set(baseName, []);
      duplicateSummons.get(baseName).push(entry);
    });
    duplicateSummons.forEach(entries => {
      if (entries.length <= 1) return;
      const usedNames = new Map();
      entries.forEach(entry => {
        const baseName = text(entry?.name || '召唤物');
        const ownedName = entry?.hostName ? `${entry.hostName}的${baseName}` : baseName;
        const sequence = (usedNames.get(ownedName) || 0) + 1;
        usedNames.set(ownedName, sequence);
        entry.name = sequence > 1 ? `${ownedName}（${sequence}）` : ownedName;
      });
    });
    return aliases;
  }

  function entityEntry(directory, value = '') {
    const key = text(value);
    return directory.get(key) || null;
  }

  function entityReferenceKeys(directory, value = '', fallback = '') {
    const keys = new Set([text(value), text(fallback)].filter(Boolean));
    [value, fallback].map(text).filter(Boolean).forEach(name => {
      const hostPrefix = name.match(/^(.+?)的.+/u)?.[1];
      if (hostPrefix) keys.add(hostPrefix);
    });
    const entry = entityEntry(directory, value) || entityEntry(directory, fallback);
    if (!entry) return keys;
    [
      entry.rawId,
      entry.publicId,
      entry.name,
      entry.hostName,
    ].map(text).filter(Boolean).forEach(key => keys.add(key));
    return keys;
  }

  function sameEntityReference(directory, leftId = '', leftName = '', rightId = '', rightName = '') {
    const leftKeys = entityReferenceKeys(directory, leftId, leftName);
    const rightKeys = entityReferenceKeys(directory, rightId, rightName);
    for (const key of leftKeys) {
      if (rightKeys.has(key)) return true;
    }
    return false;
  }

  function factReferenceMatchesTarget(
    directory,
    factId = '',
    factName = '',
    targetId = '',
    targetName = '',
    explicitFactHostName = '',
  ) {
    if (directEntityReferenceMatch(factId, factName, targetId, targetName)) return true;
    const factEntry = entityEntry(directory, factId) || entityEntry(directory, factName);
    const targetKeys = new Set([text(targetId), text(targetName)].filter(Boolean));
    const factHostName = text(explicitFactHostName) ||
      text(factEntry?.hostName) ||
      text(factName).match(/^(.+?)的.+/u)?.[1] ||
      '';
    return !!factHostName && targetKeys.has(factHostName);
  }

  function directEntityReferenceMatch(factId = '', factName = '', targetId = '', targetName = '') {
    const factKeys = new Set([text(factId), text(factName)].filter(Boolean));
    const targetKeys = new Set([text(targetId), text(targetName)].filter(Boolean));
    for (const key of factKeys) {
      if (targetKeys.has(key)) return true;
    }
    return false;
  }

  function factDirectlyBelongsToTarget(fact = {}, target = {}) {
    const targetIds = unique(fact?.targetIds || []);
    if (targetIds.length > 1) return false;
    return directEntityReferenceMatch(
      targetIds[0] || fact?.targetId,
      fact?.targetName,
      target?.targetId,
      target?.targetName,
    );
  }

  function factBelongsToTarget(directory, fact = {}, target = {}) {
    const targetId = text(target?.targetId);
    const targetName = text(target?.targetName);
    const factTargetIds = unique(fact?.targetIds || []);
    const factTargetNames = unique([
      fact?.targetName,
      fact?.targetId,
    ]);
    const factHostNames = Array.isArray(fact?.targetHostNames)
      ? fact.targetHostNames.map(text).filter(Boolean)
      : [];
    if (factTargetIds.length > 1) return false;
    if (factTargetIds.length === 1) {
      return factReferenceMatchesTarget(
        directory,
        factTargetIds[0],
        fact?.targetName,
        targetId,
        targetName,
        factHostNames[0] || '',
      );
    }
    return factTargetNames.some(targetValue =>
      factReferenceMatchesTarget(directory, targetValue, fact?.targetName, targetId, targetName)
    );
  }

  function factActorBelongsToTarget(directory, fact = {}, target = {}) {
    return factReferenceMatchesTarget(
      directory,
      fact?.actorId,
      fact?.actorName,
      target?.targetId,
      target?.targetName,
      fact?.actorHostName,
    );
  }

  function publicEntityId(directory, value = '') {
    const key = text(value);
    const entry = entityEntry(directory, key);
    if (entry?.publicId) return entry.publicId;
    return internalSummonIdPattern.test(key) ? 'summon-ref-unknown' : key;
  }

  function publicEntityName(directory, value = '', fallback = '') {
    const key = text(value);
    const entry = entityEntry(directory, key);
    if (entry?.name) return entry.name;
    return internalSummonIdPattern.test(key) ? '召唤物' : text(fallback || key);
  }

  function buildActionReferenceMap(ledger = []) {
    const references = new Map();
    ledger.forEach(event => {
      if (!['action_start', 'charge_start'].includes(text(event?.eventKind))) return;
      const actionId = text(event?.actionId);
      const eventId = text(event?.eventId);
      if (actionId && eventId) references.set(actionId, eventId);
    });
    return references;
  }

  function publicActionReference(actionId = '', actionReferences = new Map(), visibilityMode = 'PLAYER') {
    const rawId = text(actionId);
    if (!rawId) return '';
    if (visibilityMode === 'DEVELOPER') return rawId;
    return text(actionReferences.get(rawId));
  }

  function playerSafeText(value = '', directory = new Map()) {
    let result = text(value);
    if (!result) return '';
    const entries = [...new Set([...directory.values()])].filter(entry => entry?.internalSummon);
    entries.forEach(entry => {
      result = result.split(entry.rawId).join(entry.name || '召唤物');
    });
    return result.replace(internalSummonPattern, '召唤物');
  }

  function resourceName(event = {}) {
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const raw = text(event?.resource || meta?.resource || meta?.resourceKey);
    return resourceLabels[raw] || raw || '资源';
  }

  function resultLabel(event = {}) {
    const raw = text(event?.resultState || event?.result).toUpperCase();
    return resultLabels[raw] || text(event?.resultState || event?.result || '已记录');
  }

  function eventNumberToken(event, label, value, unit, sourceType, operation, visibilityMode, extra = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return {
      tokenId: `${text(event?.eventId)}:number:${text(label)}:${text(unit)}`,
      label: text(label),
      value: numeric,
      unit: text(unit),
      sourceName: text(event?.actionName || event?.finalActionName || event?.eventKind || '战斗结算'),
      sourceType: text(sourceType),
      operation: text(operation),
      sourceEventId: text(event?.eventId),
      sourceFactId: text(event?.eventId),
      visibility: visibilityMode,
      ...extra,
    };
  }

  function numericTokens(event = {}, visibilityMode = 'PLAYER') {
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const kind = text(event?.eventKind);
    const tokens = [];
    const push = token => {
      if (!token) return;
      if (tokens.some(item => item.label === token.label && item.unit === token.unit && item.value === token.value)) return;
      tokens.push({ ...token, tokenId: `${text(event?.eventId)}:number:${tokens.length + 1}` });
    };
    const appliedDamage = number(event?.appliedDamage ?? meta?.appliedDamage ?? event?.damage ?? meta?.damage, NaN);
    if (Number.isFinite(appliedDamage) && appliedDamage > 0 && ['hit_result', 'state_tick', 'reflect_damage', 'self_damage'].includes(kind)) {
      push(eventNumberToken(event, '最终伤害', appliedDamage, 'HP', 'SETTLEMENT', 'SET', visibilityMode));
    }
    const delta = number(event?.delta ?? meta?.delta, NaN);
    if (Number.isFinite(delta) && delta !== 0 && kind !== 'action_cost') {
      push(eventNumberToken(event, '资源变化', delta, resourceName(event), 'RESOURCE', 'ADD', visibilityMode));
    }
    const shieldAmount = number(meta?.amount ?? event?.amount, NaN);
    if (kind === 'shield_create' && Number.isFinite(shieldAmount) && shieldAmount > 0) {
      push(eventNumberToken(event, '护盾增加', shieldAmount, '护盾', 'SHIELD', 'ADD', visibilityMode));
    }
    if (kind === 'shield_break' && Number.isFinite(shieldAmount) && shieldAmount > 0) {
      push(eventNumberToken(event, '护盾损耗', shieldAmount, '护盾', 'SHIELD', 'SUBTRACT', visibilityMode));
      const remainingShield = number(meta?.remainingShield, NaN);
      if (Number.isFinite(remainingShield) && remainingShield >= 0) {
        push(eventNumberToken(event, '剩余护盾', remainingShield, '护盾', 'SHIELD', 'SET', visibilityMode));
      }
    }
    const shieldAbsorb = number(meta?.shieldAbsorb, NaN);
    if (Number.isFinite(shieldAbsorb) && shieldAbsorb > 0) {
      push(eventNumberToken(event, '护盾吸收', shieldAbsorb, '护盾', 'SHIELD', 'SUBTRACT', visibilityMode));
    }
    const damageMultiplier = number(meta?.damageMultiplier, NaN);
    if (Number.isFinite(damageMultiplier) && damageMultiplier >= 0 && damageMultiplier <= 1 && ['defend', 'guard'].includes(kind)) {
      push(eventNumberToken(event, '承伤比例', damageMultiplier * 100, '%', 'REACTION', 'MULTIPLY', visibilityMode));
    }
    const probability = number(
      event?.probability ??
      meta?.probability ??
      meta?.hitProbability ??
      meta?.dodgeRate ??
      meta?.successRate ??
      (visibilityMode === 'DEVELOPER' ? meta?.successProbability : undefined),
      NaN,
    );
    if (Number.isFinite(probability) && probability >= 0 && probability <= 1) {
      push(eventNumberToken(event, '成功率', probability * 100, '%', 'PROBABILITY', 'SET', visibilityMode));
    }
    const roll = number(event?.roll ?? meta?.roll ?? meta?.dodgeRoll, NaN);
    if (Number.isFinite(roll) && roll >= 0 && roll <= 1) {
      push(eventNumberToken(event, '随机值', roll * 100, '%', 'RANDOM', 'SET', visibilityMode));
    }
    const duration = number(event?.duration ?? meta?.duration, NaN);
    if (Number.isFinite(duration) && duration > 0 && /state|summon|shield|effect/.test(kind)) {
      push(eventNumberToken(event, '持续时间', duration, '回合', 'WINDOW', 'SET', visibilityMode));
    }
    const quantity = number(event?.quantity ?? event?.count ?? meta?.quantity ?? meta?.count, NaN);
    if (Number.isFinite(quantity) && quantity > 0 && /item|creation|summon/.test(kind)) {
      push(eventNumberToken(event, '数量', quantity, '个', 'QUANTITY', 'SET', visibilityMode));
    }
    if (kind === 'create' && Number.isFinite(quantity) && quantity > 0) {
      push(eventNumberToken(event, '制作数量', quantity, '份', 'INVENTORY', 'ADD', visibilityMode));
    }
    if (kind === 'effect_resolved' && text(event?.effectPrototype) === '属性修正') {
      const evidence = meta?.evidence && typeof meta.evidence === 'object' ? meta.evidence : {};
      const attribute = text(meta?.effectDetail?.attribute || evidence?.attribute || '属性');
      const current = number(evidence?.current, NaN);
      const next = number(evidence?.next, NaN);
      const statDelta = number(evidence?.delta, NaN);
      if (Number.isFinite(current)) push(eventNumberToken(event, `${attribute}原值`, current, '', 'ATTRIBUTE', 'READ', visibilityMode));
      if (Number.isFinite(statDelta)) push(eventNumberToken(event, `${attribute}变化`, statDelta, '', 'ATTRIBUTE', 'ADD', visibilityMode));
      if (Number.isFinite(next)) push(eventNumberToken(event, `${attribute}结果`, next, '', 'ATTRIBUTE', 'SET', visibilityMode));
    }
    if (visibilityMode === 'DEVELOPER' && kind === 'action_cost') {
      const cost = number(meta?.amount, NaN);
      if (Number.isFinite(cost) && cost > 0) {
        push(eventNumberToken(event, '审计成本', cost, resourceName(event), 'COST_AUDIT', 'SET', visibilityMode));
      }
    }
    return tokens;
  }

  function stateName(event = {}) {
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    return text(
      event?.stateName ||
      meta?.stateName ||
      meta?.state ||
      meta?.evidence?.state ||
      meta?.effectDetail?.state ||
      meta?.effectDetail?.attribute ||
      meta?.effectDetail?.check ||
      meta?.effectDetail?.settlement,
    );
  }

  function percentText(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    const percent = Math.abs(numeric) <= 1.000001 ? numeric * 100 : numeric;
    return `${displayNumber(percent)}%`;
  }

  function signedValueText(value) {
    const raw = text(value);
    if (raw) return raw;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return numeric > 0 ? `+${displayNumber(numeric)}` : displayNumber(numeric);
  }

  function describeEffectResolved(event = {}, actor = '行动者', target = '目标', action = '行动', directory = new Map()) {
    if (text(event?.eventKind) !== 'effect_resolved') return '';
    if (text(event?.result).toLowerCase() === 'no_effect' || text(event?.resultState).toUpperCase() === 'NO_EFFECT') return '';
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const evidence = meta?.evidence && typeof meta.evidence === 'object' ? meta.evidence : {};
    const detail = meta?.effectDetail && typeof meta.effectDetail === 'object' ? meta.effectDetail : {};
    if (evidence?.marginal === false) return '';

    const safeTarget = target || actor;
    const state = playerSafeText(evidence?.state || evidence?.stateName || detail?.state, directory);
    const duration = Math.max(0, number(evidence?.duration ?? detail?.duration ?? event?.duration, 0));
    const durationText = duration > 0 ? `，持续${duration}回合` : '';
    const current = number(evidence?.current, NaN);
    const next = number(evidence?.next, NaN);
    const delta = number(evidence?.delta, NaN);
    const attribute = playerSafeText(evidence?.attribute || detail?.attribute, directory);
    if (attribute && Number.isFinite(current) && Number.isFinite(next) && Math.abs(next - current) > 0.0001) {
      return `使${safeTarget}的${attribute}由${displayNumber(current)}变为${displayNumber(next)}`;
    }
    if (attribute && Number.isFinite(delta) && Math.abs(delta) > 0.0001) {
      return `使${safeTarget}的${attribute}${delta > 0 ? '提升' : '降低'}${displayNumber(Math.abs(delta))}`;
    }
    if (attribute && evidence?.refreshed === true) {
      const duration = Math.max(0, number(evidence?.duration ?? detail?.duration ?? event?.duration, 0));
      return `刷新${safeTarget}的${attribute}修正${duration > 0 ? `，持续${duration}回合` : ''}`;
    }
    if (attribute && Array.isArray(evidence?.changes) && evidence.changes.length) {
      const changed = evidence.changes
        .map(change => {
          const changeAttribute = playerSafeText(change?.attribute, directory);
          const changeCurrent = number(change?.current, NaN);
          const changeNext = number(change?.next, NaN);
          if (!changeAttribute || !Number.isFinite(changeCurrent) || !Number.isFinite(changeNext)) return '';
          return `${changeAttribute}由${displayNumber(changeCurrent)}变为${displayNumber(changeNext)}`;
        })
        .filter(Boolean);
      if (changed.length) return `预计使${safeTarget}的${changed.join('、')}`;
    }

    const combatEffect = evidence?.combatEffect && typeof evidence.combatEffect === 'object'
      ? evidence.combatEffect
      : {};
      const positionType = playerSafeText(evidence?.positionType || combatEffect?.position_type, directory);
      const positionObject = playerSafeText(evidence?.positionObject || combatEffect?.position_object, directory);
      if (positionType || positionObject || Number.isFinite(number(evidence?.distance ?? combatEffect?.position_distance, NaN))) {
        const subject = positionObject === '自身' ? '自身' : positionObject === '目标' ? safeTarget : positionObject || safeTarget;
        return `记录${subject}${positionType ? positionType : '位移'}${durationText}`;
    }
    if (combatEffect?.resource_lock === true) {
      const lockedResource = playerSafeText(combatEffect?.locked_resource || '资源', directory);
      const lockedRatio = percentText(combatEffect?.locked_ratio);
      return `锁定${safeTarget}的${lockedResource}${lockedRatio ? `（${lockedRatio}）` : ''}${durationText}`;
    }
    const combatParts = [];
    const appendRate = (positiveKey, negativeKey, label) => {
      const positive = Number(combatEffect?.[positiveKey] || 0);
      const negative = Number(combatEffect?.[negativeKey] || 0);
      if (positive > 0) combatParts.push(`${label}提高${percentText(positive)}`);
      if (negative > 0) combatParts.push(`${label}降低${percentText(negative)}`);
    };
    appendRate('hit_bonus', 'hit_penalty', '命中率');
    appendRate('dodge_bonus', 'dodge_penalty', '闪避率');
    appendRate('reaction_bonus', 'reaction_penalty', '即时反应成功率');
    appendRate('damage_bonus', '', '造成的伤害');
    appendRate('', 'damage_reduction', '受到的伤害');
    appendRate('armor_pen', '', '防御剥夺');
    if (Number(combatEffect?.lock_level || 0) > 0) combatParts.push(`目标锁定强度${percentText(combatEffect.lock_level)}`);
    if (Number(combatEffect?.cast_speed_penalty || 0) > 0) combatParts.push(`蓄力速度降低${percentText(combatEffect.cast_speed_penalty)}`);
    if (Number(combatEffect?.dot_damage_ratio || 0) > 0) combatParts.push(`持续伤害提高${percentText(combatEffect.dot_damage_ratio)}`);
    if (combatEffect?.skip_turn === true || combatEffect?.cannot_act === true) combatParts.push('取消下一次行动机会');
    if (combatEffect?.cannot_react === true) combatParts.push('无法进行即时反应');
    if (combatEffect?.silence === true) combatParts.push('无法释放受限技能');
    if (combatEffect?.disarm === true) combatParts.push('无法进行武器攻击');
    if (combatEffect?.blind === true) combatParts.push('命中判断受致盲影响');
    if (combatParts.length) return `使${safeTarget}${combatParts.join('，')}${durationText}`;

    const settlement = playerSafeText(detail?.settlement, directory);
    const check = playerSafeText(detail?.check, directory);
    const value = signedValueText(detail?.value);
    if (settlement || check) {
      const subject = settlement || check;
      if (value) {
        const verb = /^[-−]/.test(value) ? '降低' : '提高';
        const normalizedValue = value.replace(/^[-−+]/, '');
        const label = settlement === '受到伤害'
          ? `${safeTarget}后续受到伤害`
          : settlement === '造成伤害'
            ? `${actor}对${safeTarget}造成的伤害`
            : `${safeTarget}的${subject}`;
        return `使${label}${verb}${normalizedValue}${durationText}`;
      }
      return `使${safeTarget}的${subject}规则已生效${durationText}`;
    }
    if (state) return `使${safeTarget}获得【${state}】${durationText}`;
    if (Array.isArray(evidence?.removedKeys) && evidence.removedKeys.length) {
      return `使${safeTarget}移除${evidence.removedKeys.length}项状态`;
    }
    if (evidence?.rewind === true) return `使${safeTarget}的战斗状态回溯至记录节点`;
    if (Number.isFinite(Number(evidence?.adjustment)) && Number(evidence.adjustment) !== 0) {
      const adjustment = Number(evidence.adjustment);
      return `使${safeTarget}的持续窗口${adjustment > 0 ? '延长' : '缩短'}${Math.abs(adjustment)}回合`;
    }
    if (Number.isFinite(Number(evidence?.multiplier)) && Number(evidence.multiplier) > 0) {
      return `使${safeTarget}获得${displayNumber(evidence.multiplier)}倍后续强化${durationText}`;
    }
    if (evidence?.rule) return `使${safeTarget}相关规则【${playerSafeText(evidence.rule, directory)}】已生效`;
    if (evidence?.trigger && Number(evidence?.count || 0) > 0) {
      return `使${safeTarget}获得${Math.max(1, Math.round(Number(evidence.count)))}项可在【${playerSafeText(evidence.trigger, directory)}】触发的机制`;
    }
    if (text(event?.primaryOutcome).toUpperCase() === 'BELIEF_CHANGED' && evidence?.interference) {
      return `使${safeTarget}的判断受到【${playerSafeText(evidence.interference, directory)}】干扰${durationText}`;
    }
    return '';
  }

  function summarizeEvent(event = {}, directory = new Map()) {
    const kind = text(event?.eventKind);
    const actor = publicEntityName(directory, event?.actorId || event?.actorName, event?.actorName) || '系统';
    const target = publicEntityName(directory, event?.targetId || event?.targetName, event?.targetName);
    const targets = unique([
      ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
      event?.targetId,
    ]).map(value => publicEntityName(directory, value, value));
    const action = playerSafeText(event?.actionName || event?.finalActionName || kind, directory) || '行动';
    const result = resultLabel(event);
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const damage = number(event?.appliedDamage ?? meta?.appliedDamage ?? event?.damage ?? meta?.damage, 0);
    const delta = number(event?.delta ?? meta?.delta, 0);
    const shield = number(meta?.amount ?? event?.amount, 0);
    const duration = number(event?.duration ?? meta?.duration, 0);
    const namedState = playerSafeText(stateName(event), directory);
    if (kind === 'action_start') {
      const actionType = text(event?.actionType).toUpperCase();
      if (actionType === 'WITHDRAW') return `${actor}尝试撤离战场`;
      if (target === actor && ['DEFEND', 'EVADE', 'OBSERVE'].includes(actionType)) return `${actor}采取【${action}】`;
      if (targets.length > 1) {
        const targetEntries = targets.map(name => entityEntry(directory, name)).filter(Boolean);
        const sameSide = targetEntries.length === targets.length && targetEntries.every(entry => text(entry?.side) === text(event?.actorSide));
        return `${actor}使用【${action}】作用于${sameSide ? '己方' : '敌方'}${targets.length}个目标`;
      }
      return `${actor}使用【${action}】${target ? `指向${target}` : ''}`;
    }
    if (kind === 'charge_start') {
      const remainingCastTime = Math.max(0, number(meta?.remainingCastTime, 0));
      const remainingOpportunities = number(meta?.remainingOpportunityCount, NaN);
      const remainingText = Number.isFinite(remainingOpportunities) && remainingOpportunities > 0
        ? `，还需${remainingOpportunities}个自然行动机会`
        : remainingCastTime > 0 ? '，蓄力仍在进行' : '';
      return `${actor}开始为【${action}】蓄力${target ? `，目标为${target}` : ''}${remainingText}`;
    }
    if (kind === 'charge_progress') {
      const remaining = Math.max(0, number(meta?.remainingCastTime, 0));
      const remainingOpportunities = number(meta?.remainingOpportunityCount, NaN);
      const remainingText = Number.isFinite(remainingOpportunities) && remainingOpportunities > 0
        ? `，还需${remainingOpportunities}个自然行动机会`
        : remaining > 0 ? '，蓄力仍在进行' : '';
      return `${actor}继续为【${action}】蓄力${remainingText}`;
    }
    if (kind === 'dodge') {
      const succeeded = /SUCCESS|evaded|dodge_success/i.test(text(event?.resultState || event?.result));
      return target && target !== actor
        ? succeeded
          ? `${actor}成功闪开${target}的攻势`
          : `${actor}尝试闪避${target}的攻势，但未能直接避开`
        : succeeded
          ? `${actor}的闪避姿态生效`
          : `${actor}进入闪避姿态，但未能直接避开攻势`;
    }
    if (kind === 'defend' || kind === 'guard') {
      const damageMultiplier = number(meta?.damageMultiplier, NaN);
      const mitigation = Number.isFinite(damageMultiplier) && damageMultiplier >= 0 && damageMultiplier <= 1
        ? `，将本次伤害压至${Math.round(damageMultiplier * 1000) / 10}%`
        : '';
      return target && target !== actor
        ? `${actor}以【${action}】应对${target}的攻势${mitigation || '，防御已生效'}`
        : `${actor}进入【${action}】姿态`;
    }
    if (kind === 'reaction_window') return `${actor}的即时反应窗口${/FAILURE|unavailable/i.test(text(event?.resultState || event?.result)) ? '不可用' : '已建立'}`;
    if (kind === 'counter_window') return `${actor}的反击窗口${/FAILURE|missed/i.test(text(event?.resultState || event?.result)) ? '未能成立' : '已成立'}`;
    if (kind === 'counter') return /declined|放弃/i.test(`${event?.result} ${action}`)
      ? `${actor}放弃对${target || '来源攻击者'}的反击`
      : `${actor}以【${action}】反击${target || '来源攻击者'}`;
    if (kind === 'hit_result') {
      if (damage > 0) return `${actor}以【${action}】命中${target || '目标'}，造成${damage}点伤害`;
      if (/miss/i.test(text(event?.result))) return `${actor}的【${action}】落点偏离，未命中${target || '目标'}`;
      if (number(meta?.shieldAbsorb, 0) > 0) return `${actor}的【${action}】命中${target || '目标'}，伤害被护盾吸收`;
      return `${actor}的【${action}】命中${target || '目标'}，但未造成有效伤害`;
    }
    if (kind === 'state_tick') return damage > 0
      ? `${target || actor}受到【${namedState || action}】的持续影响，损失${damage}点生命`
      : `${target || actor}结算【${namedState || action}】的持续效果`;
    if (kind === 'resource_change' || kind === 'round_recover') {
      const absolute = Math.abs(delta || number(meta?.amount, 0));
      const verb = (delta || number(meta?.amount, 0)) >= 0 ? '恢复' : '消耗';
      return `${target || actor}${verb}${absolute}${resourceName(event)}`;
    }
    if (kind === 'action_cost') return `${actor}为【${action}】支付资源`;
    if (kind === 'shield_create') return `${actor}通过【${action}】为${target || actor}建立${shield}点护盾`;
    if (kind === 'shield_absorb') return `${target || actor}的护盾吸收${Math.abs(delta || shield)}点伤害`;
    if (kind === 'shield_break') {
      const amount = Math.max(0, number(meta?.amount ?? event?.amount ?? -delta, 0));
      const remaining = Math.max(0, number(meta?.remainingShield, 0));
      const shieldName = playerSafeText(meta?.stateName || action || '护盾', directory);
      if (text(meta?.source) === 'shield_window_expiry' || /expired/i.test(text(event?.result))) {
        return `${target || actor}的【${shieldName}】到期，${amount}点剩余护盾消散`;
      }
      return remaining > 0
        ? `${target || actor}的护盾吸收${amount}点伤害，剩余${remaining}点`
        : `${target || actor}的护盾吸收${amount}点伤害后破裂`;
    }
    if (kind === 'state_apply') {
      const outcome = resultLabel(event);
      if (['失败', '被抵抗', '免疫', '已阻断'].includes(outcome)) {
        return `${actor}通过【${action}】尝试使${target || actor}获得【${namedState || '状态'}】，结果为${outcome}`;
      }
      return `${actor}通过【${action}】使${target || actor}获得【${namedState || '状态'}】${duration > 0 ? `，持续${duration}回合` : ''}`;
    }
    if (kind === 'state_remove') return `${target || actor}移除【${namedState || action}】`;
    if (kind === 'state_expire') return `${target || actor}的【${namedState || action}】到期`;
    if (kind === 'charge_interrupt') return `${actor}的【${action}】被中止`;
    if (kind === 'summon_create') {
      const summonName = publicEntityName(directory, meta?.summonKey || event?.targetId, meta?.summonName || event?.targetName || '召唤物');
      return `${actor}通过【${action}】召唤${summonName}`;
    }
    if (kind === 'summon_end') return `${actor}离场${meta?.reasonText ? `：${playerSafeText(meta.reasonText, directory)}` : ''}`;
    if (kind === 'create' || kind === 'item_created') {
      const itemName = playerSafeText(event?.createdName || meta?.createdName || meta?.productId || event?.itemName || action || '物品', directory);
      const count = Math.max(1, number(event?.count ?? event?.quantity ?? meta?.count ?? meta?.quantity, 1));
      return `${actor}制作${count}份【${itemName}】并收入库存`;
    }
    if (kind === 'item_consume' || kind === 'item_used') {
      const itemName = playerSafeText(event?.itemName || meta?.itemName || action, directory);
      return `${actor}使用【${itemName}】${target && target !== actor ? `作用于${target}` : ''}`;
    }
    if (kind === 'pass' && text(event?.actionType).toUpperCase() === 'WITHDRAW') {
      return text(event?.result) === 'withdrawn'
        ? `${actor}成功撤离战场`
        : `${actor}尝试撤离，但未能摆脱追击`;
    }
    if (kind === 'lost_opportunity') {
      const reasonCode = text(event?.reasonCode || event?.ruleCode || meta?.reasonCode).toUpperCase();
      const reason = /UNCONSCIOUS/.test(reasonCode) || stateName(event) === '昏迷'
        ? '昏迷'
        : /INCAPACITATED|DEAD/.test(reasonCode)
          ? '失去战斗能力'
          : playerSafeText(meta?.reasonText, directory) || (stateName(event) ? `受【${playerSafeText(stateName(event), directory)}】影响` : '受当前状态影响');
      return `${actor}因${reason}失去本次行动机会`;
    }
    if (kind === 'action_cancelled' || kind === 'blocked_action') {
      const reasonCode = text(event?.reasonCode || event?.ruleCode || meta?.reasonCode).toUpperCase();
      if (/UNCONSCIOUS/.test(reasonCode) || stateName(event) === '昏迷') {
        return `${actor}因昏迷失去本回合行动机会`;
      }
      if (/INCAPACITATED|DEAD/.test(reasonCode)) {
        return `${actor}因失去战斗能力失去本回合行动机会`;
      }
      if (text(event?.ruleCode || meta?.reasonCode) === 'FUSION_PARTICIPATION_CONSUMED') {
        const fusionActionName = playerSafeText(meta?.fusionActionName || action || '融合技', directory);
        return `${actor}参与【${fusionActionName}】完成融合，本轮自然行动机会随之消耗`;
      }
      if (text(event?.actionType) === 'opportunity_cancelled' && text(meta?.reasonText)) {
        return `${actor}因${playerSafeText(meta.reasonText, directory)}失去本次行动机会`;
      }
      return `${actor}的【${action}】${result === '已中止' || result === '已阻断' ? result : '未能执行'}`;
    }
    if (kind === 'effect_resolved') {
      const effectSummary = describeEffectResolved(event, actor, target || actor, action, directory);
      return effectSummary ? `${actor}通过【${action}】${effectSummary}` : '';
    }
    if (kind === 'round_summary') return `第${number(event?.round, 0)}回合完成`;
    if (kind === 'battle_objective_resolved') {
      const winner = text(meta?.winner || event?.result);
      return winner === 'player' ? '我方达成战斗目标'
        : winner === 'enemy' ? '敌方达成战斗目标'
          : winner === 'draw' ? '达到回合上限，双方未分胜负'
            : '战斗目标完成裁断';
    }
    return `${actor}${target && target !== actor ? `对${target}` : ''}完成【${action}】结算，结果为${result}`;
  }

  function buildFact(
    event = {},
    visibilityMode = 'PLAYER',
    directory = new Map(),
    actionReferences = new Map(),
  ) {
    const rawActorId = event?.actorId || event?.actorName;
    const actorEntry = entityEntry(directory, rawActorId);
    const actorId = publicEntityId(directory, rawActorId);
    const rawTargetIds = unique([
      ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
      event?.targetId,
    ]);
    const targetIds = unique(
      rawTargetIds
        .map(value => publicEntityId(directory, value))
        .filter(Boolean),
    );
    const targetHostNames = unique(
      rawTargetIds
        .map(value => entityEntry(directory, value)?.hostName)
        .map(text)
        .filter(Boolean),
    );
    const actorName = publicEntityName(directory, rawActorId, event?.actorName);
    const targetName = publicEntityName(directory, event?.targetId || event?.targetName, event?.targetName);
    const fact = {
      factId: text(event?.eventId),
      round: Math.max(0, number(event?.round, 0)),
      actionId: publicActionReference(event?.actionId, actionReferences, visibilityMode),
      sourceActionId: publicActionReference(event?.sourceActionId, actionReferences, visibilityMode),
      eventKind: text(event?.eventKind),
      factType: eventFactType(event),
      actorId,
      actorName,
      actorHostName: text(actorEntry?.hostName),
      actorSide: text(event?.actorSide),
      targetIds,
      targetHostNames,
      targetName,
      targetSide: text(event?.targetSide),
      actorControl: text(event?.actorControl),
      actionRole: text(event?.actionRole),
      actionName: playerSafeText(event?.actionName || event?.finalActionName, directory),
      resultState: resultLabel(event),
      resultCategory: structuredResultCategory(event),
      stateName: playerSafeText(stateName(event), directory),
      summary: summarizeEvent(event, directory),
      numericTokens: numericTokens(event, visibilityMode),
      castTimePoints: ['charge_start', 'charge_progress'].includes(text(event?.eventKind))
        ? Math.max(0, number(event?.meta?.remainingCastTime, 0))
        : null,
      remainingOpportunityCount: Number.isFinite(Number(event?.meta?.remainingOpportunityCount))
        ? Math.max(0, Number(event.meta.remainingOpportunityCount))
        : null,
      canonicalFactOwner: '',
      projectionRefs: [],
    };
    if (visibilityMode === 'DEVELOPER') {
      fact.parentNodeId = text(event?.parentNodeId);
      fact.reactionNodeId = text(event?.reactionNodeId);
      fact.developerDetail = {
        rawActorId: text(event?.actorId),
        rawTargetIds: unique([...(Array.isArray(event?.targetIds) ? event.targetIds : []), event?.targetId]),
        ruleCode: text(event?.ruleCode),
        result: text(event?.result),
        meta: cloneValue(event?.meta || {}),
      };
    }
    return fact;
  }

  function resolveRootActionId(event = {}, actionStarts = new Map()) {
    if (
      (passiveEventKinds.has(text(event?.eventKind)) && !isActionScopedOpportunityFact(event)) ||
      text(event?.actionRole) === 'STATE_TICK'
    ) return '';
    let actionId = text(event?.sourceActionId || event?.actionId);
    if (!actionId && text(event?.eventKind) === 'action_start') actionId = text(event?.actionId);
    const visited = new Set();
    for (let depth = 0; actionId && depth < 16 && !visited.has(actionId); depth += 1) {
      visited.add(actionId);
      const start = actionStarts.get(actionId);
      const sourceActionId = text(start?.sourceActionId);
      if (!sourceActionId || !actionStarts.has(sourceActionId)) break;
      actionId = sourceActionId;
    }
    return actionId;
  }

  function isActionScopedOpportunityFact(event = {}) {
    const kind = text(event?.eventKind);
    if (!['lost_opportunity', 'action_cancelled', 'blocked_action'].includes(kind)) return false;
    return Boolean(
      text(event?.sourceActionId) ||
      text(event?.actionId) ||
      text(event?.parentNodeId) ||
      text(event?.opportunityId) ||
      text(event?.grantId) ||
      text(event?.meta?.opportunityId) ||
      text(event?.meta?.grantId),
    );
  }

  function factBelongsToDirectAction(fact = {}, actionId = '') {
    const directActionId = text(actionId);
    if (!directActionId) return false;
    return text(fact?.actionId) === directActionId ||
      text(fact?.sourceActionId) === directActionId;
  }

  function decisionActionName(decision = {}) {
    if (decision?.selected?.counterDeclineFallback === true) return '放弃反击';
    if (decision?.lostOpportunity?.reasonCode) return '失去行动';
    return text(decision?.selected?.selectedActionName || decision?.selected?.actionName || decision?.selected?.declaration?.actionKind);
  }

  function decisionCounterSourceActionId(decision = {}) {
    const explicit = text(
      decision?.sourceActionId ||
      decision?.selected?.declaration?.sourceActionId,
    );
    if (explicit) return explicit;
    const grantId = text(decision?.grantId || decision?.opportunityId);
    const actorId = text(decision?.actorId);
    if (!grantId.startsWith('counter:') || !actorId) return '';
    const actorMarker = `:${actorId}:`;
    const markerIndex = grantId.lastIndexOf(actorMarker);
    return markerIndex > 'counter:'.length
      ? grantId.slice('counter:'.length, markerIndex)
      : '';
  }

  function rawFactFor(fact = {}, sourceEventsByFactId = new Map()) {
    return sourceEventsByFactId.get(text(fact?.factId)) || fact;
  }

  function findDecisionAnchor(
    decision = {},
    exchanges = [],
    factsById = new Map(),
    directory = new Map(),
    claimedFactIds = new Set(),
    sourceEventsByFactId = new Map(),
  ) {
    const actorId = publicEntityId(directory, decision?.actorId);
    const actionName = playerSafeText(decisionActionName(decision), directory);
    const actionRole = text(decision?.actionRole || 'ACTIVE').toUpperCase();
    const actionKind = text(decision?.selected?.declaration?.actionKind).toUpperCase();
    const round = number(decision?.round, 0);
    const counterDecline = decision?.selected?.counterDeclineFallback === true;
    const counterSourceActionId = counterDecline ? decisionCounterSourceActionId(decision) : '';
    const decisionOpportunityId = text(
      decision?.opportunityId ||
      decision?.actionOpportunity?.opportunityId ||
      decision?.selected?.opportunityId ||
      decision?.selected?.declaration?.opportunityId,
    );
    const decisionGrantId = text(
      decision?.grantId ||
      decision?.actionOpportunity?.grantId ||
      decision?.selected?.grantId ||
      decision?.selected?.declaration?.grantId,
    );
    const preferredKinds = decision?.lostOpportunity?.reasonCode
      ? ['lost_opportunity', 'blocked_action', 'action_cancelled']
      : counterDecline
      ? ['counter_window', 'counter']
      : actionRole === 'COUNTER'
      ? ['action_start', 'counter', 'counter_window']
      : actionKind === 'DEFEND'
        ? ['action_start', 'defend']
        : actionKind === 'EVADE'
          ? ['action_start', 'dodge']
          : ['action_start', 'charge_start', 'pass'];
    for (const eventKind of preferredKinds) {
      for (const exchange of exchanges) {
        if (number(exchange?.round, 0) !== round) continue;
        const anchor = exchange.factIds
          .map(factId => factsById.get(factId))
          .find(fact =>
            (() => {
              if (
                !fact ||
                claimedFactIds.has(fact.factId) ||
                text(fact.eventKind) !== eventKind ||
                text(fact.actorId) !== actorId
              ) return false;
              const rawFact = rawFactFor(fact, sourceEventsByFactId);
              if (
                text(fact.actionRole || 'ACTIVE').toUpperCase() !== actionRole &&
                !(actionRole === 'COUNTER' && eventKind === 'counter_window')
              ) return false;
              if (
                actionName &&
                text(fact.actionName) !== actionName &&
                !(actionRole === 'COUNTER' && eventKind === 'counter_window') &&
                !(decision?.lostOpportunity?.reasonCode && eventKind !== 'action_start')
              ) return false;
              const rawOpportunityId = text(rawFact?.opportunityId || rawFact?.meta?.opportunityId);
              const rawGrantId = text(rawFact?.grantId || rawFact?.meta?.grantId);
              if (decisionOpportunityId && rawOpportunityId !== decisionOpportunityId) return false;
              if (decisionGrantId && rawGrantId !== decisionGrantId) return false;
              if (!counterDecline) return true;
              const rawSourceActionId = text(rawFact?.sourceActionId);
              if (counterSourceActionId && rawSourceActionId !== counterSourceActionId) return false;
              if (eventKind === 'counter_window') {
                return text(rawFact?.result).toLowerCase() === 'opened';
              }
              return !decisionGrantId || rawGrantId === decisionGrantId;
            })()
          );
        if (!anchor) continue;
        claimedFactIds.add(anchor.factId);
        return { exchange, anchor };
      }
    }
    return null;
  }

  function factTargetsActor(fact = {}, actorId = '', actorName = '') {
    return (Array.isArray(fact?.targetIds) && fact.targetIds.includes(actorId)) ||
      text(fact?.targetName) === actorName;
  }

  function collectDecisionActualFacts(
    exchange = {},
    anchor = {},
    factsById = new Map(),
    sourceEventsByFactId = new Map(),
    decision = {},
  ) {
    const allFacts = [...factsById.values()];
    const exchangeFactIds = new Set(exchange.factIds || []);
    const exchangeFacts = allFacts.filter(fact => exchangeFactIds.has(fact.factId));
    const rawAnchor = rawFactFor(anchor, sourceEventsByFactId);
    const rawEvent = fact => rawFactFor(fact, sourceEventsByFactId);
    const rawActionId = fact => text(rawEvent(fact)?.actionId);
    const rawSourceActionId = fact => text(rawEvent(fact)?.sourceActionId);
    const rawActorId = text(rawAnchor?.actorId || decision?.actorId);
    const actorId = text(anchor?.actorId);
    const actorName = text(anchor?.actorName);
    const isRootAction = ['action_start', 'charge_start'].includes(text(anchor?.eventKind)) &&
      !!anchor?.actionId &&
      text(anchor.actionId) === text(exchange?.rootActionId);
    const causalFollowUpKinds = new Set([
      'state_tick',
      'lost_opportunity',
      'blocked_action',
      'charge_interrupt',
      'summon_assist',
      'summon_end',
    ]);
    if (isRootAction) {
      const rootActionId = text(rawAnchor?.actionId);
      const followUps = allFacts.filter(fact =>
        !exchangeFactIds.has(fact.factId) &&
        causalFollowUpKinds.has(text(fact?.eventKind)) &&
        (
          rawActionId(fact) === rootActionId ||
          rawSourceActionId(fact) === rootActionId
        ) &&
        number(fact?.round, 0) >= number(exchange?.round, 0)
      );
      return uniqueBy([...exchangeFacts, ...followUps], fact => fact.factId);
    }
    const sameActor = fact => {
      const rawFact = rawEvent(fact);
      return (
        rawActorId && text(rawFact?.actorId) === rawActorId
      ) || (
        actorId && text(fact?.actorId) === actorId
      ) || (
        actorName && text(fact?.actorName) === actorName
      );
    };
    const linkageIds = new Set([
      decision?.opportunityId,
      decision?.grantId,
      rawAnchor?.opportunityId,
      rawAnchor?.grantId,
      rawAnchor?.meta?.opportunityId,
      rawAnchor?.meta?.grantId,
    ].map(text).filter(Boolean));
    const sharesOpportunity = fact => {
      const rawFact = rawEvent(fact);
      return [
        rawFact?.opportunityId,
        rawFact?.grantId,
        rawFact?.meta?.opportunityId,
        rawFact?.meta?.grantId,
      ].map(text).some(value => value && linkageIds.has(value));
    };
    const ownActionIds = new Set();
    if (['action_start', 'charge_start'].includes(text(anchor?.eventKind))) {
      const anchorActionId = text(rawAnchor?.actionId);
      if (anchorActionId) ownActionIds.add(anchorActionId);
    }
    allFacts.forEach(fact => {
      if (
        sharesOpportunity(fact) &&
        sameActor(fact) &&
        ['action_start', 'charge_start'].includes(text(fact?.eventKind))
      ) {
        const actionId = rawActionId(fact);
        if (actionId) ownActionIds.add(actionId);
      }
    });
    for (let depth = 0; depth < 16; depth += 1) {
      let changed = false;
      allFacts.forEach(fact => {
        if (!['action_start', 'charge_start'].includes(text(fact?.eventKind))) return;
        const actionId = rawActionId(fact);
        if (
          actionId &&
          ownActionIds.has(rawSourceActionId(fact)) &&
          !ownActionIds.has(actionId)
        ) {
          ownActionIds.add(actionId);
          changed = true;
        }
      });
      if (!changed) break;
    }

    const threatActionIds = new Set([
      rawAnchor?.sourceActionId,
      !['action_start', 'charge_start'].includes(text(anchor?.eventKind))
        ? rawAnchor?.actionId
        : '',
      decision?.sourceActionId,
      decision?.selected?.declaration?.sourceActionId,
    ].map(text).filter(actionId => actionId && !ownActionIds.has(actionId)));
    const sourceOutcomeKinds = new Set([
      'hit_result',
      'effect_resolved',
      'shield_break',
      'state_apply',
      'state_remove',
      'lost_opportunity',
      'blocked_action',
      'action_cancelled',
      'charge_interrupt',
    ]);
    const relatedFactIds = new Set([text(anchor?.factId)]);
    allFacts.forEach(fact => {
      const factActionId = rawActionId(fact);
      const factSourceActionId = rawSourceActionId(fact);
      if (
        sharesOpportunity(fact) &&
        sameActor(fact) &&
        number(fact?.round, 0) === number(exchange?.round, 0)
      ) {
        relatedFactIds.add(text(fact?.factId));
      }
      if (
        ownActionIds.has(factActionId) ||
        ownActionIds.has(factSourceActionId)
      ) {
        relatedFactIds.add(text(fact?.factId));
      }
      if (
        number(fact?.round, 0) === number(exchange?.round, 0) &&
        sourceOutcomeKinds.has(text(fact?.eventKind)) &&
        (
          threatActionIds.has(factActionId) ||
          threatActionIds.has(factSourceActionId)
        ) &&
        factTargetsActor(fact, actorId, actorName)
      ) {
        relatedFactIds.add(text(fact?.factId));
      }
    });
    return allFacts.filter(fact => relatedFactIds.has(text(fact?.factId)));
  }

  function summarizeDecisionActual(exchange = {}, anchor = {}, actualFacts = []) {
    if (
      ['action_start', 'charge_start'].includes(text(anchor?.eventKind)) &&
      anchor?.actionId &&
      text(anchor.actionId) === text(exchange?.rootActionId)
    ) {
      return unique([
        exchange?.resultSummary,
        exchange?.continuationSummary,
        ...actualFacts
          .filter(fact => !exchange.factIds.includes(fact.factId))
          .map(fact => fact.summary),
      ]).map(text).filter(Boolean).join('；');
    }
    const responses = actualFacts.filter(fact => responseEventKinds.has(text(fact?.eventKind)));
    const actionStartsById = new Map(actualFacts
      .filter(fact => ['action_start', 'charge_start'].includes(text(fact?.eventKind)) && fact?.actionId)
      .map(fact => [fact.actionId, fact]));
    const continuationFacts = actualFacts.filter(fact =>
      ['state_apply', 'state_remove', 'state_expire', 'summon_create', 'summon_end', 'lost_opportunity', 'action_cancelled', 'charge_interrupt']
        .includes(text(fact?.eventKind))
    );
    const immediateFacts = actualFacts.filter(fact =>
      !['action_start', 'charge_start', 'action_cost'].includes(text(fact?.eventKind)) &&
      !responseEventKinds.has(text(fact?.eventKind)) &&
      !continuationFacts.includes(fact)
    );
    const activeHitFacts = actualFacts.filter(fact =>
      text(fact?.eventKind) === 'hit_result' &&
      text(fact?.actionRole).toUpperCase() === 'ACTIVE' &&
      factBelongsToDirectAction(fact, anchor?.actionId)
    );
    const allActiveHitsMissed = activeHitFacts.length > 0 &&
      activeHitFacts.every(fact => /未命中|落点偏离/.test(text(fact?.summary)));
    let responseSummary = summarizeResponseFacts(responses, actionStartsById, anchor?.actionId);
    const counterDeclineFact = text(anchor?.eventKind) === 'counter_window'
      ? responses.find(fact =>
          text(fact?.eventKind) === 'counter' &&
          /declined|放弃/i.test(`${fact?.resultState} ${fact?.result} ${fact?.summary}`)
        )
      : null;
    if (counterDeclineFact && !/放弃.*反击/.test(responseSummary)) {
      responseSummary = unique([
        counterDeclineFact.summary,
        responseSummary,
      ]).map(text).filter(Boolean).join('；');
    }
    if (allActiveHitsMissed) {
      responseSummary = responseSummary.replace(
        /，将本次伤害压至\d+(?:\.\d+)?%/g,
        '，防御姿态已建立但未参与伤害结算',
      );
      if (/尝试闪避.+未能直接避开/.test(responseSummary)) {
        responseSummary = `${responseSummary}；闪避检定未成功，但随后攻击命中检定仍未通过，攻击本身仍未命中`;
      }
    }
    const continuationSummary = qualifyIndependentEffectSummary(
      activeHitFacts,
      continuationFacts,
      unique(continuationFacts.map(fact => fact.summary)).join('；'),
    );
    return unique([
      responseSummary,
      summarizeImmediateResultFacts(immediateFacts),
      continuationSummary,
    ]).map(text).filter(Boolean).join('；');
  }

  function publicCandidate(candidate = {}, directory = new Map()) {
    const declaration = candidate?.declaration || {};
    const isCounterDecline = candidate?.counterDeclineFallback === true;
    const rawActionName = text(
      candidate?.actionName ||
      candidate?.sourceActionName ||
      declaration?.skill?.name ||
      declaration?.skill?.魂技名 ||
      '',
    );
    const actionName = rawActionName && rawActionName !== text(candidate?.actionKind)
      ? rawActionName
      : actionKindLabels[text(candidate?.actionKind)] || rawActionName || '未命名行动';
    return {
      actionName: playerSafeText(isCounterDecline ? '放弃反击' : actionName, directory),
      actionKind: isCounterDecline ? 'COUNTER_DECLINE' : text(candidate?.actionKind || declaration?.actionKind),
      targetIds: isCounterDecline
        ? []
        : unique(
            unique(candidate?.targetIds || declaration?.targetIds || [])
              .map(value => publicEntityId(directory, value))
              .filter(Boolean),
          ),
      targetNames: isCounterDecline
        ? []
        : unique(
            unique(candidate?.targetIds || declaration?.targetIds || [])
              .map(value => publicEntityName(directory, value, value))
              .filter(Boolean),
          ),
      classification: classificationLabels[text(candidate?.classification)] || classificationLabels.VIABLE,
      rejectionReason: rejectionLabels[text(candidate?.rejectionCode)] || '',
    };
  }

  function adjudicationNumberToken(
    adjudicationId,
    sourceEventId,
    label,
    value,
    unit,
    sourceName,
    visibility = 'PLAYER',
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return {
      tokenId: `${adjudicationId}:number:${text(label)}`,
      label: text(label),
      value: numeric,
      unit: text(unit),
      sourceName: text(sourceName),
      sourceType: 'DECISION_PREVIEW',
      operation: 'COMPARE',
      sourceEventId: text(sourceEventId),
      sourceFactId: text(sourceEventId),
      visibility: text(visibility) || 'PLAYER',
    };
  }

  function candidateDisplayLabel(candidate = {}) {
    const actionKind = text(candidate?.actionKind).toUpperCase();
    const action = actionKind === 'WITHDRAW' ? '撤离' : text(candidate?.actionName || '行动');
    const targets = unique(candidate?.targetNames || []);
    const omitSelfTarget = ['DEFEND', 'EVADE', 'OBSERVE', 'WITHDRAW'].includes(actionKind);
    return targets.length && !omitSelfTarget ? `【${action}】（目标：${targets.join('、')}）` : `【${action}】`;
  }

  function predictedOutcomeDescription(evidence = {}, targetName = '目标', directory = new Map()) {
    const outcomeKind = text(evidence?.outcomeKind).toUpperCase();
    const detail = evidence?.evidence && typeof evidence.evidence === 'object' ? evidence.evidence : {};
    if (outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED') {
      const attribute = playerSafeText(detail?.attribute, directory);
      const current = number(detail?.current, NaN);
      const next = number(detail?.next, NaN);
      if (attribute && Number.isFinite(current) && Number.isFinite(next) && Math.abs(next - current) > 0.0001) {
        return `预计使${targetName}的${attribute}由${displayNumber(current)}变为${displayNumber(next)}`;
      }
      const settlement = playerSafeText(detail?.settlement, directory);
      const check = playerSafeText(detail?.check, directory);
      const value = signedValueText(detail?.value);
      const duration = Math.max(0, number(detail?.duration, 0));
      if ((settlement || check) && value) {
        const subject = settlement || check;
        const normalizedValue = value.replace(/^[-−+]/, '');
        const verb = /^[-−]/.test(value) ? '降低' : '提高';
        const label = settlement === '防御剥夺'
          ? `${targetName}后续防御被剥夺`
          : settlement === '受到伤害'
            ? `${targetName}后续受到伤害`
            : settlement === '造成伤害'
              ? `${targetName}后续造成伤害`
              : check === '反应'
                ? `${targetName}后续即时反应成功率`
                : check === '闪避'
                  ? `${targetName}后续闪避率`
                  : check === '命中'
                    ? `${targetName}后续命中率`
              : `${targetName}的${subject}`;
        return `预计使${label}${verb}${normalizedValue}${duration > 0 ? `，持续${duration}回合` : ''}`;
      }
      const combatEffect = detail?.combatEffect && typeof detail.combatEffect === 'object'
        ? detail.combatEffect
        : {};
      const positionType = playerSafeText(detail?.positionType || combatEffect?.position_type, directory);
      const positionObject = playerSafeText(detail?.positionObject || combatEffect?.position_object, directory);
      if (positionType || positionObject || Number.isFinite(number(detail?.distance ?? combatEffect?.position_distance, NaN))) {
        const subject = positionObject === '自身' ? '自身' : positionObject === '目标' ? targetName : positionObject || targetName;
        return `记录${subject}${positionType ? positionType : '位移'}`;
      }
      if (detail?.resourceLock === true || combatEffect?.resource_lock === true) {
        const resource = playerSafeText(detail?.lockedResource || combatEffect?.locked_resource || '资源', directory);
        const ratio = percentText(detail?.lockedRatio ?? combatEffect?.locked_ratio);
        return `预计锁定${targetName}的${resource}${ratio ? `（${ratio}）` : ''}，使其无法支付对应动作`;
      }
      const settlementLabel = settlement === '造成伤害'
        ? '造成的伤害'
        : settlement === '受到伤害'
          ? '受到的伤害'
          : settlement === '防御剥夺' || settlement === '防御穿透'
            ? '防御'
            : settlement === '治疗'
              ? '治疗量'
              : settlement === '消耗'
                ? '技能消耗'
                : '';
      const settlementParts = [];
      if (settlementLabel && Number(combatEffect?.damage_bonus || 0) > 0 && /伤害/.test(settlementLabel)) {
        settlementParts.push(`${settlementLabel}提高${percentText(combatEffect.damage_bonus)}`);
      }
      if (settlementLabel && Number(combatEffect?.damage_reduction || 0) > 0 && /伤害/.test(settlementLabel)) {
        settlementParts.push(`${settlementLabel}降低${percentText(combatEffect.damage_reduction)}`);
      }
      if (settlementLabel === '防御' && Number(combatEffect?.armor_pen || 0) > 0) {
        settlementParts.push(`防御剥夺${percentText(combatEffect.armor_pen)}`);
      }
      if (settlementLabel === '治疗量') {
        if (Number(combatEffect?.heal_bonus || 0) > 0) settlementParts.push(`治疗量提高${percentText(combatEffect.heal_bonus)}`);
        if (Number(combatEffect?.heal_reduction || 0) > 0) settlementParts.push(`治疗量降低${percentText(combatEffect.heal_reduction)}`);
      }
      if (settlementLabel === '技能消耗' && Number.isFinite(Number(combatEffect?.cost_delta_ratio))) {
        const costRatio = Number(combatEffect.cost_delta_ratio);
        settlementParts.push(`技能消耗${costRatio < 0 ? '降低' : '提高'}${percentText(Math.abs(costRatio))}`);
      }
      if (settlementParts.length) return `预计使${targetName}${settlementParts.join('，')}${duration > 0 ? `，持续${duration}回合` : ''}`;
      const qualityParts = [];
      if (Number(combatEffect?.skip_turn || 0) > 0 || combatEffect?.cannot_act === true) qualityParts.push('行动能力');
      if (Number(combatEffect?.hit_bonus || 0) !== 0 || Number(combatEffect?.hit_penalty || 0) !== 0) qualityParts.push('命中');
      if (Number(combatEffect?.dodge_bonus || 0) !== 0 || Number(combatEffect?.dodge_penalty || 0) !== 0) qualityParts.push('闪避');
      if (Number(combatEffect?.lock_level || 0) !== 0) qualityParts.push('目标锁定');
      if (Number(combatEffect?.damage_bonus || 0) !== 0 || Number(combatEffect?.damage_reduction || 0) !== 0) qualityParts.push('伤害结算');
      if (qualityParts.length) return `预计改变${targetName}后续的${unique(qualityParts).join('、')}条件`;
      if (Number.isFinite(Number(detail?.multiplier)) && Math.abs(Number(detail.multiplier) - 1) > 0.0001) {
        return `预计使${targetName}后续结算变为${displayNumber(detail.multiplier)}倍`;
      }
      if (detail?.productId) {
        return `预计生成${playerSafeText(detail.productId, directory)}，增加${Math.max(1, number(detail?.quantity, 1))}份可用库存`;
      }
      return '';
    }
    if (outcomeKind === 'RESOURCE_OPTION_CHANGED') {
      const resource = playerSafeText(detail?.resource, directory);
      const delta = number(detail?.delta, NaN);
      if (resource && Number.isFinite(delta) && Math.abs(delta) > 0.0001) {
        return `预计使${targetName}的${resource}${delta > 0 ? '增加' : '减少'}${displayNumber(Math.abs(delta))}，从而改变后续可支付动作`;
      }
      return `预计改变${targetName}后续可支付动作`;
    }
    if (outcomeKind === 'BELIEF_CHANGED') {
      const interference = playerSafeText(detail?.interference, directory);
      return interference
        ? `预计使${targetName}的公开判断受到${interference}干扰`
        : `预计增加对${targetName}的可用公开信息`;
    }
    return '';
  }

  function candidateEvidenceTotals(candidate = {}) {
    const totals = { damage: 0, healing: 0, cancelled: 0, granted: 0, shield: 0, shieldBreak: 0 };
    (Array.isArray(candidate?.predictedOutcomeEvidence) ? candidate.predictedOutcomeEvidence : []).forEach(evidence => {
      const delta = number(evidence?.expectedDelta, 0);
      const kind = text(evidence?.outcomeKind).toUpperCase();
      if (kind === 'HP_DELTA') {
        if (delta < 0) totals.damage += Math.abs(delta);
        if (delta > 0) totals.healing += delta;
      } else if (kind === 'SHIELD_DELTA' && delta > 0) {
        totals.shield += delta;
      } else if (kind === 'SHIELD_DELTA' && delta < 0) {
        totals.shieldBreak += Math.abs(delta);
      } else if (kind === 'ACTION_CANCELLED') {
        totals.cancelled += 1;
      } else if (kind === 'ACTION_GRANTED') {
        totals.granted += 1;
      }
    });
    return totals;
  }

  function candidateComparisonEvidence(selected = {}, alternative = {}, directory = new Map()) {
    const selectedProjection = selected?.goalProjection || {};
    const alternativeProjection = alternative?.goalProjection || {};
    const selectedVector = selected?.vector || {};
    const alternativeVector = alternative?.vector || {};
    const selectedRoute = selected?.primaryRoute || {};
    const alternativeRoute = alternative?.primaryRoute || {};
    const difference = (left, right) => number(left, 0) - number(right, 0);
    const publicWindow = value => {
      const raw = text(value);
      if (!raw) return '';
      if (raw === 'ACTION_COST') return '支付时';
      if (/summon|召唤/i.test(raw)) return '召唤物行动窗口';
      if (/effect|round|NOW/i.test(raw)) return '本次效果兑现窗口';
      return '后续兑现窗口';
    };
    const selectedAction = candidateDisplayLabel(publicCandidate({
      ...selected,
      actionName: selected?.actionName || selected?.selectedActionName,
    }, directory));
    const alternativeAction = candidateDisplayLabel(publicCandidate({
      ...alternative,
      actionName: alternative?.actionName || alternative?.selectedActionName,
    }, directory));
    const components = [
      {
        key: 'directTrajectoryHEPP',
        label: '直接生命轨迹',
        unit: 'HEPP',
        selected: number(selectedProjection?.directTrajectoryHEPP, 0),
        alternative: number(alternativeProjection?.directTrajectoryHEPP, 0),
      },
      {
        key: 'actionPoolHEPP',
        label: '行为池兑现',
        unit: 'HEPP',
        selected: number(selectedProjection?.actionPoolHEPP, 0),
        alternative: number(alternativeProjection?.actionPoolHEPP, 0),
      },
      {
        key: 'informationValueHEPP',
        label: '信息后悔减少',
        unit: 'HEPP',
        selected: number(selectedVector?.informationValueHEPP, number(selectedProjection?.informationValueHEPP, 0)),
        alternative: number(alternativeVector?.informationValueHEPP, number(alternativeProjection?.informationValueHEPP, 0)),
      },
      {
        key: 'survivalLowerBound',
        label: '生存下界',
        unit: 'HEPP',
        selected: number(selectedVector?.survivalLowerBound, 0),
        alternative: number(alternativeVector?.survivalLowerBound, 0),
      },
      {
        key: 'worstTailLossHEPP',
        label: '最坏回应损失',
        unit: 'HEPP',
        selected: number(selectedVector?.worstTailLossHEPP, number(selectedProjection?.worstTailLossHEPP, 0)),
        alternative: number(alternativeVector?.worstTailLossHEPP, number(alternativeProjection?.worstTailLossHEPP, 0)),
      },
      {
        key: 'discardedOverkillPP',
        label: '阈值后过量',
        unit: 'PP',
        selected: number(selectedVector?.discardedOverkillPP, number(selectedProjection?.discardedOverkillPP, 0)),
        alternative: number(alternativeVector?.discardedOverkillPP, number(alternativeProjection?.discardedOverkillPP, 0)),
      },
    ];
    const changedComponents = components
      .filter(component => Math.abs(component.selected - component.alternative) > 0.01)
      .map(component => ({
        key: component.key,
        label: component.label,
        unit: component.unit,
        selected: component.selected,
        alternative: component.alternative,
        delta: component.selected - component.alternative,
      }));
    const selectedWindows = unique(selectedRoute?.realizationWindows || [])
      .map(publicWindow)
      .filter(Boolean);
    const alternativeWindows = unique(alternativeRoute?.realizationWindows || [])
      .map(publicWindow)
      .filter(Boolean);
    const selectedTargets = unique(selected?.declaration?.targetIds || selected?.targetIds || [])
      .map(targetId => publicEntityName(directory, targetId, targetId));
    const alternativeTargets = unique(alternative?.declaration?.targetIds || alternative?.targetIds || [])
      .map(targetId => publicEntityName(directory, targetId, targetId));
    const summary = changedComponents.map(component =>
      `${component.label}：${selectedAction}${displayNumber(component.selected)}${component.unit}，` +
      `${alternativeAction}${displayNumber(component.alternative)}${component.unit}`,
    );
    if (!summary.length) {
      summary.push('已公开的生命轨迹、行为池、风险和资源保留投影没有形成可区分差异');
    }
    return {
      comparisonType: 'CANDIDATE_DELTA',
      selectedAction,
      alternativeAction,
      selectedTargets,
      alternativeTargets,
      selectedObjectiveUtilityHEPP: number(
        selectedVector?.objectiveUtilityHEPP,
        number(selected?.objectiveUtilityHEPP, 0),
      ),
      alternativeObjectiveUtilityHEPP: number(
        alternativeVector?.objectiveUtilityHEPP,
        number(alternative?.objectiveUtilityHEPP, 0),
      ),
      objectiveUtilityDeltaHEPP: difference(
        selectedVector?.objectiveUtilityHEPP,
        alternativeVector?.objectiveUtilityHEPP,
      ),
      changedComponents,
      selectedWindows,
      alternativeWindows,
      summary,
      explanation: `比较${selectedAction}与${alternativeAction}的公开预估：${summary.join('；')}` +
        `。兑现窗口：${selectedWindows.length ? selectedWindows.join('、') : '无'}；替代方案：${alternativeWindows.length ? alternativeWindows.join('、') : '无'}`,
    };
  }

  function candidateDifferenceSummaries(selected = {}, alternative = {}) {
    const selectedTotals = candidateEvidenceTotals(selected);
    const alternativeTotals = candidateEvidenceTotals(alternative);
    const selectedVector = selected?.vector || {};
    const alternativeVector = alternative?.vector || {};
    const differences = [];
    const r8Comparison =
      selectedVector?.objectiveUtilityHEPP !== undefined ||
      alternativeVector?.objectiveUtilityHEPP !== undefined;
    if (r8Comparison) {
      const utilityDelta =
        number(selectedVector?.objectiveUtilityHEPP, number(selected?.objectiveUtilityHEPP, 0)) -
        number(alternativeVector?.objectiveUtilityHEPP, number(alternative?.objectiveUtilityHEPP, 0));
      const informationDelta =
        number(selectedVector?.informationValueHEPP, 0) -
        number(alternativeVector?.informationValueHEPP, 0);
      const survivalDelta =
        number(selectedVector?.survivalLowerBound, 0) -
        number(alternativeVector?.survivalLowerBound, 0);
      const tailDelta =
        number(alternativeVector?.worstTailLossHEPP, 0) -
        number(selectedVector?.worstTailLossHEPP, 0);
      const overkillDelta =
        number(alternativeVector?.discardedOverkillPP, 0) -
        number(selectedVector?.discardedOverkillPP, 0);
      const comparison = candidateComparisonEvidence(selected, alternative);
      if (Math.abs(utilityDelta) > 0.01) {
        differences.push(
          comparison.changedComponents.length
            ? comparison.changedComponents
              .slice(0, 3)
              .map(component =>
                `${component.label}相差${displayNumber(Math.abs(component.delta))}${component.unit}`
              )
              .join('；')
            : `公开预估总效用相差${displayNumber(Math.abs(utilityDelta))}HEPP`,
        );
      }
      if (informationDelta > 0.01) differences.push(`所选方案多减少${displayNumber(informationDelta)}HEPP的后续选择后悔`);
      if (survivalDelta > 0.01) differences.push(`所选方案的生存下界高${displayNumber(survivalDelta)}HEPP`);
      if (tailDelta > 0.01) differences.push(`所选方案的最坏回应损失少${displayNumber(tailDelta)}HEPP`);
      if (overkillDelta > 0.01) differences.push(`所选方案少产生${displayNumber(overkillDelta)}PP阈值后过量`);
      if (differences.length) return unique(differences);
      return ['两者的目标生命轨迹、最坏回应和资源保留投影相同，本次选择处于允许后悔范围内'];
    }
    if (alternative?.repeatedActionAudit?.failureAdaptation?.applied === true) {
      differences.push('该替代方案根据此前公开的命中或抵抗结果降低了预期兑现率');
    }
    if (selectedTotals.damage > alternativeTotals.damage + 0.01) {
      differences.push(`所选方案预计多造成${displayNumber(selectedTotals.damage - alternativeTotals.damage)}点有效伤害`);
    }
    if (selectedTotals.cancelled > alternativeTotals.cancelled) {
      differences.push(`所选方案预计多取消${selectedTotals.cancelled - alternativeTotals.cancelled}次真实行动机会`);
    }
    if (selectedTotals.granted > alternativeTotals.granted) {
      differences.push(`所选方案预计多建立${selectedTotals.granted - alternativeTotals.granted}个追加行动窗口`);
    }
    if (selectedTotals.healing > alternativeTotals.healing + 0.01) {
      differences.push(`所选方案预计多恢复${displayNumber(selectedTotals.healing - alternativeTotals.healing)}点生命`);
    }
    if (selectedTotals.shield > alternativeTotals.shield + 0.01) {
      differences.push(`所选方案预计多建立${displayNumber(selectedTotals.shield - alternativeTotals.shield)}点有效护盾`);
    }
    if (number(selectedVector?.objectiveProgress, 0) > number(alternativeVector?.objectiveProgress, 0) + 0.0001) {
      differences.push('所选方案推进当前战斗目标更多');
    }
    if (number(selectedVector?.informationValue, 0) > number(alternativeVector?.informationValue, 0) + 0.01) {
      differences.push('所选方案提供更多可兑现情报价值');
    }
    if (number(selectedVector?.survivalLowerBound, 0) > number(alternativeVector?.survivalLowerBound, 0) + 0.01) {
      differences.push('所选方案的生存下界更高');
    }
    if (number(selectedVector?.resourceContinuity, 0) > number(alternativeVector?.resourceContinuity, 0) + 0.01) {
      differences.push('所选方案保留的后续资源连续性更好');
    }
    if (number(selectedVector?.worstTailCapacityLoss, 0) + 0.01 < number(alternativeVector?.worstTailCapacityLoss, 0)) {
      differences.push('所选方案面对最坏回应时预计损失更低');
    }
    if (number(selectedVector?.irreversibleAssetCost, 0) + 0.01 < number(alternativeVector?.irreversibleAssetCost, 0)) {
      differences.push('所选方案消耗的不可逆资产更少');
    }
    if (differences.length) return unique(differences);
    const utilityDelta = number(selected?.objectiveUtility, 0) - number(alternative?.objectiveUtility, 0);
    if (utilityDelta < -0.01) {
      return ['该替代方案的客观预估略高，但差距仍处于当前角色可接受的主观后悔边界内'];
    }
    if (utilityDelta > 0.01) {
      return ['所选方案在当前目标、风险与后续能力的合并比较中更优'];
    }
    return ['两者可兑现战果接近，本次选择处于允许的主观选择边界内'];
  }

  function buildR8DecisionReason(decision = {}, selected = {}, selectedPublic = {}, alternatives = [], directory = new Map()) {
    const projection = selected?.goalProjection || decision?.goalProjection || {};
    const route = selected?.primaryRoute || {};
    const parts = [];
    if (projection?.terminal?.terminal === true) {
      parts.push(`该路线首先到达${text(projection.terminal.status || '终局')}条件`);
    }
    const trajectories = Array.isArray(projection?.healthTrajectory)
      ? projection.healthTrajectory
      : Array.isArray(route?.healthTrajectoryByTarget)
        ? route.healthTrajectoryByTarget
        : [];
    trajectories.slice(0, 2).forEach(trajectory => {
      const targetName = publicEntityName(directory, trajectory?.targetId, trajectory?.targetId || '目标');
      const benefit = number(trajectory?.actorBenefitPP, 0);
      if (Math.abs(benefit) > 0.01) {
        parts.push(`${targetName}的目标生命轨迹改变${displayNumber(Math.abs(benefit))}PP`);
      }
    });
    const poolDeltas = Array.isArray(projection?.actionPoolDeltas)
      ? projection.actionPoolDeltas
      : [];
    poolDeltas
      .filter(delta => Math.abs(number(delta?.healthTrajectoryDeltaPP, 0)) > 0.01)
      .slice(0, 2)
      .forEach(delta => {
        const targetName = publicEntityName(directory, delta?.targetId, delta?.targetId || '目标');
        parts.push(`${targetName}的后续行为池改变${displayNumber(Math.abs(number(delta.healthTrajectoryDeltaPP, 0)))}HEPP`);
      });
    const payments = Array.isArray(route?.paymentDependencies) ? route.paymentDependencies : [];
    if (payments.length) {
      parts.push(`支付顺序为${payments.map(entry =>
        `${playerSafeText(entry?.resource || '资源', directory)}${displayNumber(entry?.amount)}`
      ).join('、')}`);
    }
    if (number(selected?.vector?.discardedOverkillPP, 0) > 0) {
      parts.push(`其中${displayNumber(selected.vector.discardedOverkillPP)}PP属于阈值后过量，不计入目标收益`);
    }
    if (alternatives[0]?.differenceSummary) {
      parts.push(`相对${candidateDisplayLabel(alternatives[0])}：${alternatives[0].differenceSummary}`);
    }
    return parts.length
      ? parts.join('；')
      : `${candidateDisplayLabel(selectedPublic)}没有产生可单独计入的悬空分值，选择仅依据其目标生命轨迹投影`;
  }

  function publicR8DecisionEvidence(decision = {}, selected = {}, directory = new Map(), visibilityMode = 'PLAYER') {
    const projection = decision?.goalProjection || selected?.goalProjection || {};
    const projectWindowId = value => {
      const raw = text(value);
      if (!raw || visibilityMode === 'DEVELOPER') return raw;
      if (internalSummonIdPattern.test(raw)) {
        const publicName = playerSafeText(raw, directory);
        return publicName === raw ? '召唤窗口' : `${publicName}的召唤窗口`;
      }
      return playerSafeText(raw, directory);
    };
    const healthTrajectory = (Array.isArray(decision?.healthTrajectory) ? decision.healthTrajectory : [])
      .map(entry => ({
        targetId: publicEntityId(directory, entry?.targetId),
        targetName: publicEntityName(directory, entry?.targetId, entry?.targetId),
        outcomeKind: text(entry?.outcomeKind),
        windowId: projectWindowId(entry?.windowId),
        healthDeltaPP: number(entry?.healthDeltaPP, 0),
        actorBenefitPP: number(entry?.actorBenefitPP, 0),
      }));
    const actionRouteDeltas = (Array.isArray(decision?.actionRouteDeltas) ? decision.actionRouteDeltas : [])
      .map(entry => ({
        targetId: publicEntityId(directory, entry?.targetId),
        targetName: publicEntityName(directory, entry?.targetId, entry?.targetId),
        outcomeKind: text(entry?.outcomeKind),
        windowId: projectWindowId(entry?.windowId),
        healthTrajectoryDeltaPP: number(entry?.healthTrajectoryDeltaPP, 0),
        realizable: entry?.realizable !== false,
      }));
    const payments = (Array.isArray(decision?.resourceTimelineSummary?.payments)
      ? decision.resourceTimelineSummary.payments
      : []
    ).map(entry => ({
      unitId: publicEntityId(directory, entry?.unitId),
      unitName: publicEntityName(directory, entry?.unitId, entry?.unitId),
      resource: playerSafeText(entry?.resource, directory),
      amount: number(entry?.amount, 0),
    }));
    const observations = (Array.isArray(decision?.probabilitySources?.mechanicObservations)
      ? decision.probabilitySources.mechanicObservations
      : []
    ).map(entry => ({
      mechanic: playerSafeText(entry?.stateName || entry?.effectPrototype || '机制', directory),
      estimatedProbability: number(entry?.estimatedProbability, NaN),
      posterior: number(entry?.posterior, NaN),
      result: playerSafeText(entry?.result, directory),
    }));
    const responseModel = decision?.probabilitySources?.responseModel || {};
    return {
      goalProjection: {
        directTrajectoryHEPP: number(projection?.directTrajectoryHEPP, 0),
        actionPoolHEPP: number(projection?.actionPoolHEPP, 0),
        informationValueHEPP: number(projection?.informationValueHEPP, 0),
        objectiveUtilityHEPP: number(projection?.objectiveUtilityHEPP, 0),
        discardedOverkillPP: number(projection?.discardedOverkillPP, 0),
        worstTailLossHEPP: number(projection?.worstTailLossHEPP, 0),
        terminal: {
          terminal: projection?.terminal?.terminal === true,
          status: text(projection?.terminal?.status),
        },
      },
      healthTrajectory,
      actionRouteDeltas,
      realizationWindows: unique(decision?.realizationWindows || []).map(projectWindowId),
      resourceTimelineSummary: { payments },
      probabilitySources: {
        unknownMass: number(responseModel?.unknownMass, 0),
        noResponseProbability: number(responseModel?.noResponseProbability, 0),
        observations,
      },
      causalValueFacts: visibilityMode === 'DEVELOPER'
        ? cloneValue(decision?.causalValueFacts || [])
        : [],
      uncertaintyBounds: {
        lower: number(decision?.uncertaintyBounds?.lower, 0),
        upper: number(decision?.uncertaintyBounds?.upper, 1),
      },
    };
  }

  function decisionReasonCategory(decision = {}, selected = {}, options = {}) {
    if (decision?.lostOpportunity?.reasonCode) return 'LOST_OPPORTUNITY';
    if (selected?.playerLocked === true || text(selected?.selectionMode).toUpperCase() === 'PLAYER_LOCKED') {
      return 'PLAYER_LOCKED';
    }
    if (selected?.forcedAction === true) return 'FORCED_ACTION';
    if (selected?.counterDeclineFallback === true) return 'COUNTER_DECLINE';
    if (selected?.terminalEvidence?.direct?.achieved === true) return 'TERMINAL_PROGRESS';
    if (selected?.crisisResponseAudit?.realized === true) return 'CRISIS_RESPONSE';
    if (selected?.teamIntentAudit?.realized === true) return 'TEAM_INTENT';
    if (text(options?.actionRole).toUpperCase() === 'COUNTER') return 'COUNTER_WINDOW';
    if (text(options?.actionRole).toUpperCase() === 'REACTION') return 'IMMEDIATE_RESPONSE';
    if (selected?.repeatedActionAudit?.isRepeatedAction === true) return 'REPEATABLE_MARGIN';
    if (selected?.repeatedActionAudit?.lifecycleWindowRealizable === true) return 'WINDOW_VALUE';
    if (number(selected?.vector?.resourceContinuity, 0) > 0) return 'RESOURCE_CONTINUITY';
    if (number(selected?.vector?.survivalLowerBound, 0) > 0) return 'SURVIVAL';
    if (Array.isArray(selected?.predictedOutcomeEvidence) &&
      selected.predictedOutcomeEvidence.some(evidence =>
        ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW'].includes(
          text(evidence?.outcomeKind).toUpperCase(),
        )
      )) {
      return 'ACTION_WINDOW';
    }
    if (Array.isArray(selected?.predictedOutcomeEvidence) &&
      selected.predictedOutcomeEvidence.some(evidence =>
        text(evidence?.outcomeKind).toUpperCase() === 'INFORMATION_REVEALED'
      )) {
      return 'INFORMATION';
    }
    if (text(decision?.problems?.[0]?.problemId) === 'STALEMATE') return 'STALEMATE_BREAK';
    return 'TACTICAL_PROGRESS';
  }

  function buildDecisionReason(decision = {}, selectedPublic = {}, alternatives = [], options = {}) {
    const selected = decision?.selected || {};
    const predictedOutcomeEvidence = Array.isArray(selected?.predictedOutcomeEvidence)
      ? selected.predictedOutcomeEvidence
      : [];
    const expectedAlliedIncrease = outcomeKind => predictedOutcomeEvidence.some(evidence => {
      if (
        text(evidence?.outcomeKind).toUpperCase() !== outcomeKind ||
        number(evidence?.expectedDelta, 0) <= 0
      ) return false;
      return text(entityEntry(options?.directory, evidence?.targetId)?.side) === text(options?.actorSide);
    });
    const hasHealing = expectedAlliedIncrease('HP_DELTA');
    const hasShield = expectedAlliedIncrease('SHIELD_DELTA');
    const supportAction = hasHealing || hasShield;
    const addressesInformation = number(selected?.vector?.informationValue, 0) > 0 ||
      predictedOutcomeEvidence.some(evidence =>
        ['INFORMATION_REVEALED', 'BELIEF_CHANGED'].includes(
          text(evidence?.outcomeKind).toUpperCase(),
        )
      );
    const primaryProblemId = text(decision?.problems?.[0]?.problemId);
    const actionRole = text(options?.actionRole || decision?.actionRole || 'ACTIVE').toUpperCase();
    const sourceThreatName = text(options?.sourceThreatName) || publicEntityName(
      options?.directory,
      decision?.sourceActorId,
      decision?.sourceActorId,
    );
    const selectedEvidenceTotals = candidateEvidenceTotals(selected);
    const selectedShieldTargets = unique(
      predictedOutcomeEvidence
        .filter(evidence =>
          text(evidence?.outcomeKind).toUpperCase() === 'SHIELD_DELTA' &&
          number(evidence?.expectedDelta, 0) > 0,
        )
        .map(evidence => publicEntityName(
          options?.directory,
          evidence?.targetId,
          evidence?.targetId || '目标',
        )),
    );
    const selectedHealingTargets = unique(
      predictedOutcomeEvidence
        .filter(evidence =>
          text(evidence?.outcomeKind).toUpperCase() === 'HP_DELTA' &&
          number(evidence?.expectedDelta, 0) > 0,
        )
        .map(evidence => publicEntityName(
          options?.directory,
          evidence?.targetId,
          evidence?.targetId || '目标',
        )),
    );
    const problem = actionRole === 'REACTION'
      ? '应对当前攻势'
      : actionRole === 'COUNTER'
        ? '利用反击窗口'
        : supportAction
          ? '队伍续航'
          : primaryProblemId === 'INFORMATION_DEFICIT' && !addressesInformation
            ? '推进战果'
            : problemLabels[primaryProblemId] || '当前局势';
    const selectedLabel = candidateDisplayLabel(selectedPublic);
    const selectedTargetNames = unique(selectedPublic?.targetNames || []);
    const teamIntent = decision?.teamIntent || {};
    const focusTargetName = publicEntityName(
      options?.directory,
      teamIntent?.focusTarget,
      teamIntent?.focusTarget,
    );
    const protectTargetName = publicEntityName(
      options?.directory,
      teamIntent?.protectTarget,
      teamIntent?.protectTarget,
    );
    const crisisAudit = selected?.crisisResponseAudit || {};
    const teamIntentAudit = selected?.teamIntentAudit || {};
    const failureAdaptation = selected?.repeatedActionAudit?.failureAdaptation || {};
    const realizableWindowTargets = unique(
      Object.entries(selected?.repeatedActionAudit?.controlWindowRealizability?.reasonsByTarget || {})
        .filter(([, reasons]) => Array.isArray(reasons) && reasons.length > 0)
        .map(([targetId]) => publicEntityName(options?.directory, targetId, targetId)),
    );
    if (selected?.playerLocked === true || text(selected?.selectionMode).toUpperCase() === 'PLAYER_LOCKED') {
      return `玩家已锁定${selectedLabel}；本次只校验机械合法性，AI不替换该声明`;
    }
    if (decision?.lostOpportunity?.reasonCode) {
      const lost = decision.lostOpportunity;
      const reason = playerSafeText(
        lost?.reasonText || lost?.reasonCode || '当前状态无法行动',
        options?.directory,
      );
      if (actionRole === 'REACTION') {
        const sourceThreatName = playerSafeText(
          options?.sourceThreatName || '来源动作',
          options?.directory,
        );
        return `针对${sourceThreatName}的攻势，当前即时应对没有能够改变本次结算的有效动作，记录为失去反应机会：${reason}`;
      }
      return `本次行动机会未执行：${reason}`;
    }
    if (selected?.forcedAction === true) {
      return `${selectedLabel}已在前一行动窗口完成声明与蓄力，本次按既定动作兑现，不重新替换为其他主动方案`;
    }
    if (selected?.counterDeclineFallback === true) {
      return '反击窗口已成立，但当前没有值得承担成本的有效反制动作，本次选择放弃反击并结束该窗口';
    }
    const selectableAlternatives = (Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [])
      .filter(candidate =>
        candidate?.selected !== true &&
        !text(candidate?.rejectionCode)
      )
      .sort((left, right) =>
        number(right?.objectiveUtility, -Infinity) - number(left?.objectiveUtility, -Infinity)
      );
    let negativeOnlyReason = '';
    if (
      actionRole === 'ACTIVE' &&
      number(selected?.objectiveUtility, 0) < 0 &&
      selectableAlternatives.every(candidate => number(candidate?.objectiveUtility, 0) < 0)
    ) {
      const bestAlternative = selectableAlternatives[0] || null;
      const concretePurpose = selected?.terminalEvidence?.response?.preventsFailure === true
        ? '保留终局条件仍可挽回的机会'
        : selected?.crisisResponseAudit?.realized === true
          ? '减少当前危机在下一次关键回应中的损失'
          : number(selected?.vector?.catastrophicRiskReduction, 0) > 0
            ? '降低最坏回应造成的容量损失'
            : '保留仍能兑现的行动能力';
      negativeOnlyReason = `当前所有可执行方案都预计承受损失，本次选择是为了${concretePurpose}` +
        (bestAlternative
          ? `，且替代方案${candidateDisplayLabel(bestAlternative)}的预计损失不更低`
          : '');
    }
    const scoreAlternatives = (Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [])
      .filter(candidate => candidate?.selected !== true && text(candidate?.candidateId) !== text(selected?.candidateId));
    const repeated = selected?.repeatedActionAudit || {};
    const reasons = [];
    if (negativeOnlyReason) reasons.push(negativeOnlyReason);
    const selectedVector = selected?.vector || {};
    const predictedOutcomeDescriptions = predictedOutcomeEvidence.flatMap(evidence => {
      const targetName = publicEntityName(options?.directory, evidence?.targetId, evidence?.targetId || '目标');
      const outcomeKind = text(evidence?.outcomeKind).toUpperCase();
      if (outcomeKind === 'HP_DELTA' && number(evidence?.expectedDelta, 0) < 0) {
        return [`预计对${targetName}造成约${Math.round(Math.abs(number(evidence.expectedDelta, 0)))}点伤害`];
      }
      if (outcomeKind === 'HP_DELTA' && number(evidence?.expectedDelta, 0) > 0) {
        return hasHealing
          ? []
          : [`预计为${targetName}恢复约${Math.round(number(evidence.expectedDelta, 0))}点生命`];
      }
      if (outcomeKind === 'SHIELD_DELTA' && number(evidence?.expectedDelta, 0) > 0) {
        return hasShield
          ? []
          : [`预计为${targetName}建立约${Math.round(number(evidence.expectedDelta, 0))}点护盾`];
      }
      if (outcomeKind === 'SHIELD_DELTA' && number(evidence?.expectedDelta, 0) < 0) {
        return [`预计先消耗${targetName}约${Math.round(Math.abs(number(evidence.expectedDelta, 0)))}点护盾`];
      }
      if (outcomeKind === 'ACTION_CANCELLED') return [`预计取消${targetName}的行动机会`];
      if (outcomeKind === 'ACTION_GRANTED') return [`预计为${targetName}建立追加行动窗口`];
      if (outcomeKind === 'SUMMON_WINDOW') {
        const duration = number(evidence?.evidence?.remainingWindows ?? evidence?.evidence?.duration, 0);
        return [duration > 0 ? `预计建立${targetName}的召唤行动窗口（剩余${duration}次）` : `预计建立${targetName}的召唤行动窗口`];
      }
      if (outcomeKind === 'STATE_CHANGED') {
        const stateName = text(evidence?.evidence?.stateName || evidence?.evidence?.state);
        return [stateName ? `预计使${targetName}进入${stateName}状态窗口` : `预计改变${targetName}的状态窗口`];
      }
      const structuralDescription = predictedOutcomeDescription(evidence, targetName, options?.directory);
      if (structuralDescription) return [structuralDescription];
      return [];
    });
    const bestAlternativeResource = Math.max(
      -Infinity,
      ...scoreAlternatives.map(candidate => number(candidate?.vector?.resourceContinuity, -Infinity)),
    );
    const bestAlternativeTailLoss = Math.min(
      Infinity,
      ...scoreAlternatives.map(candidate => number(candidate?.vector?.worstTailCapacityLoss, Infinity)),
    );
    const terminalEvidence = selected?.terminalEvidence || {};
    const directTerminal = terminalEvidence?.direct?.achieved === true;
    const preventsFailure = terminalEvidence?.response?.preventsFailure === true;
    const improvesTerminalProbability = terminalEvidence?.response?.improvesSuccessProbability === true;
    const withdrawalOutcome = terminalEvidence?.withdrawal || null;
    const objectiveProgress = number(selectedVector?.objectiveProgress, 0);
    if (directTerminal) {
      reasons.push('按当前公开局势，本次动作预计可直接满足当前终局条件');
    } else if (objectiveProgress > 0) {
      const progressAudit = selectedVector?.objectiveProgressAudit || {};
      const progressGain = number(progressAudit?.progressGain, 0);
      const requiredProgress = number(progressAudit?.requiredProgress, 0);
      reasons.push(
        progressGain > 0
          ? `预计使当前目标进度增加${displayNumber(progressGain * 100)}%${requiredProgress > 0 ? `（本次回应所需${displayNumber(requiredProgress * 100)}%）` : ''}`
          : '当前动作的主要价值来自终局概率变化',
      );
    } else if (preventsFailure) {
      reasons.push('本次应对主要用于降低立即失败风险，保留后续行动机会');
    } else if (withdrawalOutcome?.achievesTerminal === true) {
      reasons.push('预计通过撤离直接满足当前终局条件');
    } else if (withdrawalOutcome) {
      reasons.push(withdrawalOutcome.probability > 0
        ? '预计尝试脱离当前追击，争取保留继续行动的机会'
        : '当前撤离成功机会不足，仍需承担继续交战的风险');
    } else if (improvesTerminalProbability) {
      reasons.push('预计提高当前战斗目标的达成概率，但本次动作本身不会立即结束战斗');
    }
    if (selectedTargetNames.length) reasons.push(`目标为${selectedTargetNames.join('、')}`);
    if (focusTargetName && selectedTargetNames.includes(focusTargetName)) {
      reasons.push(`与当前集火目标${focusTargetName}一致`);
    }
    if (protectTargetName && selectedTargetNames.includes(protectTargetName)) {
      reasons.push(`覆盖当前需要保护的${protectTargetName}`);
    }
    if (text(teamIntent?.exploitableWindow) && teamIntentAudit?.realized === true) {
      reasons.push(`兑现当前可利用窗口：${playerSafeText(teamIntent.exploitableWindow, options?.directory)}`);
    }
    if (crisisAudit?.realized === true) {
      reasons.push(
        crisisAudit?.problemId === 'ALLY_CRISIS'
          ? '直接回应队友当前危机，减少下一次关键回应前的损失'
          : crisisAudit?.problemId === 'IMMINENT_DENIAL'
            ? '直接处理即将发生的打断、失能或终局风险'
            : '直接回应当前生存危机，保留后续行动机会',
      );
    }
    if (realizableWindowTargets.length) {
      reasons.push(`效果能够在${realizableWindowTargets.join('、')}的真实行动窗口兑现`);
    }
    if (failureAdaptation?.applied === true) {
      reasons.push('根据此前公开的命中或抵抗结果，已降低同类失败方案的优先级');
    }
    const informationAudit = selected?.nextValueAudit?.informationAudit || {};
    const publicInformationObservations = Array.isArray(informationAudit?.observations)
      ? informationAudit.observations.filter(observation =>
          text(observation?.targetId) &&
          number(observation?.value, 0) > 0
        )
      : [];
    if (
      number(selectedVector?.informationValue, 0) > 0 &&
      publicInformationObservations.length > 0 &&
      informationAudit?.primaryReasonEligible === true
    ) {
      reasons.push(
        selected?.declaration?.actionKind === 'OBSERVE'
          ? '本次公开观察可减少后续同类选择的不确定性'
          : '本次命中或抵抗结果可用于校准同类攻击的实际兑现率',
      );
    }
    if (hasHealing && hasShield) {
      reasons.push(
        `预计为${selectedHealingTargets.join('、') || '受损成员'}恢复约${displayNumber(selectedEvidenceTotals.healing)}点生命，` +
        `并为${selectedShieldTargets.join('、') || '队伍'}建立约${displayNumber(selectedEvidenceTotals.shield)}点有效护盾`,
      );
    } else if (hasHealing) {
      reasons.push(
        `预计为${selectedHealingTargets.join('、') || '受损成员'}恢复约${displayNumber(selectedEvidenceTotals.healing)}点生命`,
      );
    } else if (hasShield) {
      reasons.push(
        `预计为${selectedShieldTargets.join('、') || '队伍'}建立约${displayNumber(selectedEvidenceTotals.shield)}点有效护盾`,
      );
    }
    const resourceRunwayAfter = Math.max(0, Math.floor(number(selected?.repeatedActionAudit?.resourceRunwayAfter, 0)));
    if (resourceRunwayAfter > 0 && !(selected?.repeatedActionAudit?.lostAffordableActions || []).length) {
      reasons.push(`按当前资源仍可支付${resourceRunwayAfter}次同等消耗`);
    } else if ((selected?.repeatedActionAudit?.lostAffordableActions || []).length) {
      reasons.push('本次消耗会减少后续可支付的动作，只有当前窗口收益足以补偿时才成立');
    } else if (
      Object.keys(selected?.declaration?.resourceCosts || {}).length > 0 &&
      Number.isFinite(Number(selected?.repeatedActionAudit?.resourceRunwayAfter))
    ) {
      reasons.push('本次动作后已无法继续支付同等消耗，后续只能改用低耗或无耗行为');
    }
    const hasSummonWindow = predictedOutcomeEvidence.some(evidence =>
      ['SUMMON_WINDOW', 'ACTION_GRANTED'].includes(text(evidence?.outcomeKind).toUpperCase())
    );
    const improvesReactionWindow = predictedOutcomeEvidence.some(evidence =>
      text(evidence?.outcomeKind).toUpperCase() === 'NEXT_ACTION_QUALITY_CHANGED' &&
      text(entityEntry(options?.directory, evidence?.targetId)?.side) === text(options?.actorSide)
    );
    const damagesOpponent = predictedOutcomeEvidence.some(evidence =>
      text(evidence?.outcomeKind).toUpperCase() === 'HP_DELTA' &&
      number(evidence?.expectedDelta, 0) < 0 &&
      text(entityEntry(options?.directory, evidence?.targetId)?.side) !== text(options?.actorSide)
    );
    if (actionRole === 'REACTION') {
      const threat = sourceThreatName || selectedPublic.targetNames?.[0] || '来源攻势';
      reasons.push(
        improvesReactionWindow
          ? `针对${threat}的当前攻势，选择该应对以降低本次承伤或命中风险`
          : `针对${threat}的当前攻势，选择该应对以改变本次结算结果`,
      );
      if (damagesOpponent) reasons.push('预计在完成应对的同时造成有效反击伤害');
    }
    if (actionRole === 'COUNTER' && sourceThreatName) {
      reasons.push(`利用${sourceThreatName}留下的反击窗口兑现一次反制`);
    }
    if (repeated?.isRepeatedAction === true && number(repeated?.repeatedActionDelta, 0) > 0) {
      const repeatEvidence = Array.isArray(repeated?.addedValueEvidence)
        ? repeated.addedValueEvidence
        : [];
      const repeatTargets = unique(
        repeatEvidence
          .map(item => publicEntityName(
            options?.directory,
            item?.targetId,
            item?.targetId || '目标',
          ))
          .filter(Boolean),
      );
      const repeatKinds = new Set(
        repeatEvidence.map(item => text(item?.outcomeKind).toUpperCase()).filter(Boolean),
      );
      const lifecycleReasons = new Set(
        Array.isArray(repeated?.lifecycleWindowReasons)
          ? repeated.lifecycleWindowReasons.map(value => text(value).toUpperCase())
          : [],
      );
      const repeatBenefits = [];
      if (lifecycleReasons.has('TARGET_CURRENT_ROUND_ACTION')) {
        repeatBenefits.push('目标本回合仍有行动机会，当前限制仍能在本回合兑现');
      }
      if (lifecycleReasons.has('SAME_ROUND_TICK')) {
        repeatBenefits.push('本次仍会产生本回合即时结算');
      }
      if (repeatKinds.has('HP_DELTA')) repeatBenefits.push('带来新的有效伤害');
      if (repeatKinds.has('SHIELD_DELTA')) {
        const shieldGain = repeatEvidence.some(item =>
          text(item?.outcomeKind).toUpperCase() === 'SHIELD_DELTA' &&
          number(item?.expectedDelta, 0) > 0,
        );
        const shieldBreak = repeatEvidence.some(item =>
          text(item?.outcomeKind).toUpperCase() === 'SHIELD_DELTA' &&
          number(item?.expectedDelta, 0) < 0,
        );
        if (shieldGain) repeatBenefits.push('带来新的有效护盾');
        if (shieldBreak) repeatBenefits.push('继续消耗目标护盾');
      }
      if (repeatKinds.has('ACTION_CANCELLED')) repeatBenefits.push('取消真实行动机会');
      if (repeatKinds.has('ACTION_GRANTED')) repeatBenefits.push('建立追加行动窗口');
      if (repeatKinds.has('RESOURCE_OPTION_CHANGED')) repeatBenefits.push('改变后续可支付动作');
      if (unique(repeated?.extendedWindowIds || []).length) {
        repeatBenefits.push(`延续${unique(repeated.extendedWindowIds).length}个可兑现窗口`);
      }
      reasons.push(
        `本次重复释放仍有可兑现边际${repeatTargets.length ? `（作用于${repeatTargets.join('、')}）` : ''}` +
        `${repeatBenefits.length ? `：${unique(repeatBenefits).join('、')}` : ''}`,
      );
    }
    if (hasSummonWindow) reasons.push('预计建立可立即兑现的召唤行动窗口');
    if (predictedOutcomeDescriptions.length) reasons.push(...predictedOutcomeDescriptions.slice(0, 2));
    const deniedOpportunityCount = unique(repeated?.newlyDeniedOpportunityIds || []).length;
    if (deniedOpportunityCount > 0) {
      const targets = unique(selectedPublic?.targetNames || []).join('、') || '目标';
      reasons.push(`预计取消${targets}的${deniedOpportunityCount}次行动机会`);
    }
    if (
      Number.isFinite(bestAlternativeTailLoss) &&
      number(selectedVector?.worstTailCapacityLoss, 0) + 0.01 < bestAlternativeTailLoss
    ) reasons.push('相较最强替代，面对最不利回应时预计损失更低');
    if (
      Number.isFinite(bestAlternativeResource) &&
      number(selectedVector?.resourceContinuity, 0) > bestAlternativeResource + 0.01
    ) reasons.push('相较最强替代，保留了更多下一行动可用能力');
    if (number(repeated?.repeatedActionDelta, 0) > 0 && (repeated?.extendedWindowIds || []).length) {
      const windowCount = unique(repeated.extendedWindowIds).length;
      reasons.push(options?.repeatedSelection === true
        ? `本次重复释放仍新增或延续${windowCount}个可兑现的效果窗口`
        : `预计建立或延续${windowCount}个可兑现的效果窗口`);
    }
    const strongestAlternative = scoreAlternatives
      .slice()
      .sort((left, right) =>
        number(right?.objectiveUtility, -Infinity) - number(left?.objectiveUtility, -Infinity) ||
        text(left?.candidateId).localeCompare(text(right?.candidateId))
      )[0] || null;
    let alternativeReason = '';
    if (strongestAlternative) {
      const strongestAlternativePublic = publicCandidate(strongestAlternative, options?.directory);
      const alternativeLabel = candidateDisplayLabel(strongestAlternativePublic);
      const alternativeDiff = candidateDifferenceSummaries(selected, strongestAlternative);
      if (strongestAlternativePublic.rejectionReason) {
        alternativeDiff.push(`该替代方案因“${strongestAlternativePublic.rejectionReason}”被排除`);
      }
      alternativeReason = `未选择${alternativeLabel}：${unique(alternativeDiff).slice(0, 2).join('；')}`;
    }
    if (selected?.forcedFallback === true) reasons.push('其他主动方案当前均不可兑现');
    if (!reasons.length && alternatives.length) {
      reasons.push(`该动作直接处理${problem}；替代方案没有提供同等的可兑现窗口`);
    }
    if (!reasons.length) {
      reasons.push(`该动作占用当前行动机会推进${problem}`);
    }
    const readableReasons = unique(reasons);
    const priorityReasons = readableReasons.filter(reason =>
      /终局|危机|行动机会|真实行动窗口|资源|同等消耗|低耗|无法继续支付|风险|蓄力|打断|反击|攻势|承伤|命中|公开|失败|抵抗/.test(reason),
    );
    const remainingReasons = readableReasons.filter(reason => !priorityReasons.includes(reason));
    return [
      `局势问题为“${problem}”；选择${selectedLabel}：${[...priorityReasons, ...remainingReasons].slice(0, 5).join('；')}`,
      alternativeReason,
    ].filter(Boolean).join('。');
  }

  function publicRepeatedActionAudit(repeated = null, directory = new Map(), visibilityMode = 'PLAYER') {
    if (!repeated || typeof repeated !== 'object') return null;
    const safe = value => visibilityMode === 'DEVELOPER'
      ? text(value)
      : playerSafeText(value, directory);
    const publicWindowId = value => {
      const raw = text(value);
      if (!raw) return '';
      if (visibilityMode === 'DEVELOPER') return raw;
      if (internalSummonIdPattern.test(raw)) {
        const publicName = playerSafeText(raw, directory);
        return publicName === raw ? '召唤窗口' : `${publicName}的召唤窗口`;
      }
      return playerSafeText(raw, directory);
    };
    return {
      repeatedActionDelta: number(repeated.repeatedActionDelta, 0),
      isRepeatedAction: repeated.isRepeatedAction === true,
      previousActionId: safe(repeated.previousActionId),
      currentAlternativeGap: number(repeated.currentAlternativeGap, 0),
      bestAlternativeCandidateId: safe(repeated.bestAlternativeCandidateId),
      addedValueEvidence: Array.isArray(repeated.addedValueEvidence)
        ? repeated.addedValueEvidence.map(item => ({
            outcomeKind: text(item?.outcomeKind),
            targetId: visibilityMode === 'DEVELOPER'
              ? text(item?.targetId)
              : publicEntityId(directory, item?.targetId),
            windowId: publicWindowId(item?.windowId),
          }))
        : [],
      extendedWindowCount: unique(repeated.extendedWindowIds || []).length,
      newlyDeniedOpportunityCount: unique(repeated.newlyDeniedOpportunityIds || []).length,
      unrealizableDeniedOpportunityCount: unique(repeated.unrealizableDeniedOpportunityIds || []).length,
      resourceRunwayBefore: Number.isFinite(Number(repeated.resourceRunwayBefore))
        ? Math.max(0, Math.floor(Number(repeated.resourceRunwayBefore)))
        : null,
      resourceRunwayAfter: Number.isFinite(Number(repeated.resourceRunwayAfter))
        ? Math.max(0, Math.floor(Number(repeated.resourceRunwayAfter)))
        : null,
      lostAffordableActionCount: unique(repeated.lostAffordableActions || []).length,
      lifecycleWindowRealizable: repeated.lifecycleWindowRealizable === true,
    };
  }

  function buildAdjudications(
    draft = {},
    exchanges = [],
    factsById = new Map(),
    directory = new Map(),
    visibilityMode = 'PLAYER',
    sourceEventsByFactId = new Map(),
  ) {
    const decisions = Array.isArray(draft?.decisionAudit) ? draft.decisionAudit : [];
    const claimedFactIds = new Set();
    return decisions.map((decision, decisionIndex) => {
      const matched = findDecisionAnchor(
        decision,
        exchanges,
        factsById,
        directory,
        claimedFactIds,
        sourceEventsByFactId,
      );
      if (!matched) return null;
      const exchange = matched.exchange;
      const anchor = matched.anchor;
      const selected = decision?.selected && typeof decision.selected === 'object'
        ? decision.selected
        : null;
      const r8Decision = text(decision?.decisionEngine).toUpperCase() === 'R8';
      const lostOpportunity = decision?.lostOpportunity?.reasonCode
        ? decision.lostOpportunity
        : null;
      const playerLocked =
        selected?.playerLocked === true ||
        text(selected?.selectionMode).toUpperCase() === 'PLAYER_LOCKED' ||
        text(decision?.actorControl).toUpperCase() === 'PLAYER_LOCKED' ||
        text(decision?.selectionMode).toUpperCase() === 'PLAYER_LOCKED';
      const nonChoiceDecision = Boolean(
        lostOpportunity ||
        playerLocked ||
        selected?.forcedAction === true ||
        selected?.counterDeclineFallback === true,
      );
      const scoreAudit = Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [];
      const alternatives = nonChoiceDecision
        ? []
        : scoreAudit
          .filter(candidate => candidate?.selected !== true && text(candidate?.candidateId) !== text(selected?.candidateId))
          .sort((left, right) => number(right?.objectiveUtility, -Infinity) - number(left?.objectiveUtility, -Infinity))
          .slice(0, 2);
      const selectedPublic = lostOpportunity
        ? {
            actionName: '失去行动机会',
            actionKind: 'LOST_OPPORTUNITY',
            targetIds: [],
            targetNames: [],
            classification: '不可用',
            rejectionReason: playerSafeText(
              lostOpportunity.reasonText || lostOpportunity.reasonCode,
              directory,
            ),
          }
        : publicCandidate({
        ...selected,
        actionName: selected?.selectedActionName,
        actionKind: selected?.declaration?.actionKind,
        targetIds: selected?.declaration?.targetIds,
      }, directory);
      const actorSide = text(entityEntry(directory, decision?.actorId)?.side);
      const repeatedSelection = decisions.slice(0, decisionIndex).some(prior => {
        if (text(prior?.actorId) !== text(decision?.actorId)) return false;
        const priorSelected = prior?.selected || {};
        const priorActionName = text(
          priorSelected?.selectedActionName ||
          priorSelected?.declaration?.skill?.name ||
          priorSelected?.declaration?.skill?.魂技名 ||
          actionKindLabels[text(priorSelected?.declaration?.actionKind).toUpperCase()],
        );
        return priorActionName && priorActionName === selectedPublic.actionName;
      });
      const addressesInformation = number(selected?.vector?.informationValue, 0) > 0 ||
        (Array.isArray(selected?.predictedOutcomeEvidence)
          ? selected.predictedOutcomeEvidence
          : []
        ).some(evidence =>
          ['INFORMATION_REVEALED', 'BELIEF_CHANGED'].includes(
            text(evidence?.outcomeKind).toUpperCase(),
          )
        );
      const primaryProblemId = text(decision?.problems?.[0]?.problemId);
      const actionRole = text(decision?.actionRole || 'ACTIVE').toUpperCase();
      const predictedProblem = actionRole === 'REACTION'
        ? '应对当前攻势'
        : actionRole === 'COUNTER'
          ? '利用反击窗口'
          : primaryProblemId === 'INFORMATION_DEFICIT' && !addressesInformation
            ? '推进战果'
            : problemLabels[primaryProblemId] || '当前局势';
      const alternativePublic = alternatives.map(candidate => {
        const item = publicCandidate(candidate, directory);
        const differences = candidateDifferenceSummaries(selected, candidate);
        if (item.rejectionReason) differences.push(`该替代方案因“${item.rejectionReason}”被排除`);
        return {
          ...item,
          differenceFromSelected: number(selected?.objectiveUtility, 0) - number(candidate?.objectiveUtility, 0),
          differenceSummary: unique(differences).slice(0, 3).join('；'),
          comparisonEvidence: r8Decision
            ? candidateComparisonEvidence(selected, candidate, directory)
            : null,
        };
      });
      const sourceActionFact = exchange.factIds
        .map(factId => factsById.get(factId))
        .find(fact =>
          ['action_start', 'charge_start'].includes(text(fact?.eventKind)) &&
          text(fact?.actionId) === text(anchor?.sourceActionId),
        );
      const sourceThreatName = publicEntityName(
        directory,
        sourceActionFact?.actorId || anchor?.targetId || decision?.sourceActorId,
        sourceActionFact?.actorName || anchor?.targetName || decision?.sourceActorId,
      );
      const adjudicationId = `adjudication:${number(decision?.round, 0)}:${publicEntityId(directory, decision?.actorId)}:${decisionIndex + 1}`;
      const sourceEventId = text(anchor?.factId);
      const r8Evidence = r8Decision
        ? publicR8DecisionEvidence(decision, selected, directory, visibilityMode)
        : null;
      const primaryComparison = r8Decision && alternativePublic[0]?.comparisonEvidence
        ? {
            ...alternativePublic[0].comparisonEvidence,
            comparisonId: `${adjudicationId}:comparison:0`,
          }
        : null;
      const developerDecisionNumbers = [
        adjudicationNumberToken(adjudicationId, sourceEventId, r8Decision ? '目标生命轨迹效用' : '预估局面收益', r8Decision ? selected?.vector?.objectiveUtilityHEPP : selected?.objectiveUtility, r8Decision ? 'HEPP' : '效用', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, r8Decision ? '直接生命轨迹' : '动作链预期战果', r8Decision ? selected?.goalProjection?.directTrajectoryHEPP : selected?.vector?.expectedStateGain, r8Decision ? 'HEPP' : '效用', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, r8Decision ? '行为池生命轨迹' : '资源连续性', r8Decision ? selected?.goalProjection?.actionPoolHEPP : selected?.vector?.resourceContinuity, r8Decision ? 'HEPP' : '容量', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, '生存下界', selected?.vector?.survivalLowerBound, '容量', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, '最坏回应损失', r8Decision ? selected?.vector?.worstTailLossHEPP : selected?.vector?.worstTailCapacityLoss, r8Decision ? 'HEPP' : '容量', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, '阈值后过量', r8Decision ? selected?.vector?.discardedOverkillPP : NaN, 'PP', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, '信息后悔减少', r8Decision ? selected?.vector?.informationValueHEPP : NaN, 'HEPP', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, '重复动作边际', r8Decision ? NaN : selected?.repeatedActionAudit?.repeatedActionDelta, '效用', selectedPublic.actionName, 'DEVELOPER'),
        adjudicationNumberToken(adjudicationId, sourceEventId, '相对最佳替代差距', r8Decision ? NaN : selected?.repeatedActionAudit?.currentAlternativeGap, '效用', selectedPublic.actionName, 'DEVELOPER'),
      ].filter(Boolean);
      const visibleDecisionNumbers = [
        adjudicationNumberToken(adjudicationId, sourceEventId, '剩余同等消耗次数', selected?.repeatedActionAudit?.resourceRunwayAfter, '次', selectedPublic.actionName),
        adjudicationNumberToken(
          adjudicationId,
          sourceEventId,
          '覆盖行动机会',
          unique(selected?.repeatedActionAudit?.newlyDeniedOpportunityIds || []).length,
          '次',
          selectedPublic.actionName,
        ),
        ...(Array.isArray(selected?.mechanicObservations) ? selected.mechanicObservations : []).map(observation =>
          adjudicationNumberToken(
            adjudicationId,
            sourceEventId,
            `${playerSafeText(observation?.stateName || observation?.effectPrototype || '机制', directory)}预计成功率`,
            number(observation?.posterior ?? observation?.estimatedProbability, NaN) * 100,
            '%',
            selectedPublic.actionName,
          )
        ),
      ].filter(Boolean);
      const decisionNumbers = [
        ...(visibilityMode === 'DEVELOPER' ? developerDecisionNumbers : []),
        ...visibleDecisionNumbers,
      ].map(token => primaryComparison
        ? {
            ...token,
            sourceDetail: primaryComparison.explanation,
            comparisonId: primaryComparison.comparisonId,
          }
        : token);
      const actualFacts = collectDecisionActualFacts(
        exchange,
        anchor,
        factsById,
        sourceEventsByFactId,
        decision,
      );
      const checks = actualFacts
        .filter(fact => fact.numericTokens.some(token => ['成功率', '随机值'].includes(token.label)))
        .map(fact => ({
          factId: fact.factId,
          actionName: fact.actionName,
          targetName: fact.targetName,
          result: fact.resultState,
          probability: fact.numericTokens.find(token => token.label === '成功率') || null,
          roll: fact.numericTokens.find(token => token.label === '随机值') || null,
        }));
      const adjudication = {
        adjudicationId,
        exchangeId: exchange.exchangeId,
        round: number(decision?.round, 0),
        actorId: publicEntityId(directory, decision?.actorId),
        actorName: publicEntityName(directory, decision?.actorId, decision?.actorId),
        actionRole: text(decision?.actionRole || 'ACTIVE'),
        sourceEventId,
        sourceActionId: text(anchor?.actionId || anchor?.sourceActionId),
        opportunityId: text(anchor?.opportunityId || anchor?.developerDetail?.meta?.opportunityId),
        grantId: text(anchor?.grantId || anchor?.developerDetail?.meta?.grantId),
        selected: selectedPublic,
        alternatives: alternativePublic,
        comparisonEvidence: primaryComparison,
        goalProjection: r8Evidence?.goalProjection || null,
        healthTrajectory: r8Evidence?.healthTrajectory || null,
        actionRouteDeltas: r8Evidence?.actionRouteDeltas || null,
        realizationWindows: r8Evidence?.realizationWindows || null,
        resourceTimelineSummary: r8Evidence?.resourceTimelineSummary || null,
        probabilitySources: r8Evidence?.probabilitySources || null,
        causalValueFacts: r8Evidence?.causalValueFacts || null,
        uncertaintyBounds: r8Evidence?.uncertaintyBounds || null,
        intentSummary: (() => {
          const targets = selectedPublic.targetNames.length
            ? selectedPublic.targetNames.join('、')
            : '';
          if (lostOpportunity) return '';
          if (actionRole === 'REACTION') {
            return sourceThreatName
              ? `应对${sourceThreatName}当前发起的攻势`
              : '应对当前攻势';
          }
          if (actionRole === 'COUNTER') {
            return sourceThreatName
              ? `利用针对${sourceThreatName}的反击窗口`
              : '利用当前反击窗口';
          }
          if (
            selected?.crisisResponseAudit?.required === true &&
            selected?.crisisResponseAudit?.realized === true
          ) {
            return targets ? `优先处理${targets}面临的危机` : '优先处理当前危机';
          }
          if (
            (selected?.repeatedActionAudit?.newlyDeniedOpportunityIds || []).length > 0
          ) {
            return targets ? `压制${targets}的后续行动` : '压制对方的后续行动';
          }
          if (
            (selected?.predictedOutcomeEvidence || []).some(evidence =>
              String(evidence?.outcomeKind || '').trim().toUpperCase() === 'SHIELD_DELTA' &&
              Number(evidence?.expectedDelta || 0) > 0
            )
          ) {
            return targets ? `保护${targets}` : '保护己方战线';
          }
          if (
            (selected?.predictedOutcomeEvidence || []).some(evidence =>
              String(evidence?.outcomeKind || '').trim().toUpperCase() === 'HP_DELTA' &&
              Number(evidence?.expectedDelta || 0) > 0
            )
          ) {
            return targets ? `救援${targets}` : '处理己方生命危机';
          }
          if (addressesInformation) return targets ? `试探${targets}的公开反应` : '补充当前未知信息';
          return targets
            ? `${predictedProblem}，目标为${targets}`
            : `推进${predictedProblem}`;
        })(),
        reasonSummary: playerLocked
          ? `玩家已锁定${selectedPublic.actionName}；本次只校验机械合法性，AI不替换该声明`
          : r8Decision
            ? buildR8DecisionReason(decision, selected, selectedPublic, alternativePublic, directory)
            : buildDecisionReason(decision, selectedPublic, alternativePublic, {
              actorSide,
              directory,
              repeatedSelection,
              actionRole,
              sourceThreatName,
            }),
        reasonCategory: playerLocked
          ? 'PLAYER_LOCKED'
          : decisionReasonCategory(decision, selected, {
              actorSide,
              actionRole,
            }),
        reasonText: '',
        reasonEvidence: {
          problem: predictedProblem,
          targetNames: [...selectedPublic.targetNames],
          focusTarget: publicEntityName(directory, decision?.teamIntent?.focusTarget, decision?.teamIntent?.focusTarget),
          protectTarget: publicEntityName(directory, decision?.teamIntent?.protectTarget, decision?.teamIntent?.protectTarget),
          exploitableWindow: playerSafeText(decision?.teamIntent?.exploitableWindow, directory),
          crisisRequired: selected?.crisisResponseAudit?.required === true,
          crisisStatus: text(selected?.crisisResponseAudit?.selectionStatus),
          crisisRealized: selected?.crisisResponseAudit?.realized === true,
          teamIntentRealized: selected?.teamIntentAudit?.realized === true,
          selectionPath: text(decision?.decisionProfile?.selectionPath),
          ...(visibilityMode === 'DEVELOPER'
            ? {
                bestCandidateId: text(decision?.decisionProfile?.bestCandidateId),
                selectedCandidateId: text(decision?.decisionProfile?.selectedCandidateId),
              }
            : {}),
          normalizedRegret: number(decision?.decisionProfile?.normalizedRegret, 0),
          interferenceSource: text(decision?.decisionProfile?.interferenceSource),
          seedRoll: Number.isFinite(Number(decision?.decisionProfile?.seedRoll))
            ? Number(decision.decisionProfile.seedRoll)
            : null,
          controlWindowTargets: unique(
            Object.entries(selected?.repeatedActionAudit?.controlWindowRealizability?.reasonsByTarget || {})
              .filter(([, reasons]) => Array.isArray(reasons) && reasons.length > 0)
              .map(([targetId]) => publicEntityName(directory, targetId, targetId)),
          ),
          resourceRunwayBefore: Number.isFinite(Number(selected?.repeatedActionAudit?.resourceRunwayBefore))
            ? Math.max(0, Math.floor(Number(selected.repeatedActionAudit.resourceRunwayBefore)))
            : null,
          resourceRunwayAfter: Number.isFinite(Number(selected?.repeatedActionAudit?.resourceRunwayAfter))
            ? Math.max(0, Math.floor(Number(selected.repeatedActionAudit.resourceRunwayAfter)))
            : null,
          lostAffordableActionCount: unique(selected?.repeatedActionAudit?.lostAffordableActions || []).length,
          failureAdaptationApplied: selected?.repeatedActionAudit?.failureAdaptation?.applied === true,
          hasRiskCompensation: Boolean(
            selected?.terminalEvidence?.direct?.achieved === true ||
            selected?.terminalEvidence?.response?.preventsFailure === true ||
            selected?.terminalEvidence?.response?.improvesSuccessProbability === true ||
            selected?.crisisResponseAudit?.realized === true ||
            selected?.repeatedActionAudit?.lifecycleWindowRealizable === true,
          ),
        },
        predicted: {
          problem: predictedProblem,
          teamFocusTarget: publicEntityName(directory, decision?.teamIntent?.focusTarget, decision?.teamIntent?.focusTarget),
          protectTarget: publicEntityName(directory, decision?.teamIntent?.protectTarget, decision?.teamIntent?.protectTarget),
          exploitableWindow: playerSafeText(decision?.teamIntent?.exploitableWindow, directory),
          numbers: decisionNumbers,
          repeatedAction: publicRepeatedActionAudit(selected?.repeatedActionAudit, directory, visibilityMode),
        },
        actual: {
          resultSummary: summarizeDecisionActual(exchange, anchor, actualFacts),
          factIds: unique(actualFacts.map(fact => fact.factId)),
          checks,
          numericTokens: actualFacts.flatMap(fact => fact.numericTokens),
        },
      };
      adjudication.reasonText = adjudication.reasonSummary;
      if (visibilityMode === 'DEVELOPER') {
        adjudication.developerDetail = {
          decisionIndex,
          selectedCandidateId: text(selected?.candidateId),
          rawDecision: cloneValue(decision),
        };
      }
      return adjudication;
    }).filter(Boolean);
  }

  function compactEntityNames(values = []) {
    const names = unique(values);
    if (names.length <= 3) return names.join('、');
    return `${names.slice(0, 3).join('、')}等${names.length}人`;
  }

  function summarizeResponseFactGroup(responses = []) {
    const consumed = new Set();
    const summaries = [];
    const group = (eventKinds, keyOf, summarize) => {
      const grouped = new Map();
      responses.filter(fact => eventKinds.includes(fact.eventKind)).forEach(fact => {
        const key = keyOf(fact);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(fact);
      });
      grouped.forEach(facts => {
        facts.forEach(fact => consumed.add(fact.factId));
        summaries.push(facts.length === 1 ? facts[0].summary : summarize(facts));
      });
    };
    group(['reaction_window'], fact => /不可用/.test(fact.summary) ? 'UNAVAILABLE' : 'AVAILABLE', facts => {
      const names = compactEntityNames(facts.map(fact => fact.actorName));
      return `${names}的即时反应窗口${/不可用/.test(facts[0].summary) ? '不可用' : '已建立'}`;
    });
    group(['dodge'], fact => `${fact.targetName}|${fact.resultState}`, facts => {
      const names = compactEntityNames(facts.map(fact => fact.actorName));
      return `${names}尝试闪避${facts[0].targetName || '来源攻击者'}的攻势，结果为${facts[0].resultState}`;
    });
    group(['defend', 'guard'], fact => {
      const ratio = fact.numericTokens.find(token => token.label === '承伤比例');
      return `${fact.eventKind}|${fact.actionName}|${fact.targetName}|${number(ratio?.value, -1)}`;
    }, facts => {
      const names = compactEntityNames(facts.map(fact => fact.actorName));
      const ratio = facts[0].numericTokens.find(token => token.label === '承伤比例');
      const mitigation = ratio ? `，将本次伤害压至${Math.round(number(ratio.value, 0) * 10) / 10}%` : '，防御已生效';
      return `${names}分别以【${facts[0].actionName}】应对${facts[0].targetName || '来源攻击者'}的攻势${mitigation}`;
    });
    group(['counter_window'], fact => /未能成立/.test(fact.summary) ? 'MISSED' : 'OPENED', facts => {
      const names = compactEntityNames(facts.map(fact => fact.actorName));
      return `${names}的反击窗口${/未能成立/.test(facts[0].summary) ? '未能成立' : '已成立'}`;
    });
    group(['counter'], fact => `${fact.actionName}|${fact.targetName}|${/放弃/.test(fact.summary)}`, facts => {
      const names = compactEntityNames(facts.map(fact => fact.actorName));
      return /放弃/.test(facts[0].summary)
        ? `${names}放弃对${facts[0].targetName || '来源攻击者'}的反击`
        : `${names}分别以【${facts[0].actionName}】反击${facts[0].targetName || '来源攻击者'}`;
    });
    responses.forEach(fact => {
      if (!consumed.has(fact.factId)) summaries.push(fact.summary);
    });
    return unique(summaries).join('；');
  }

  function nestedResponseLead(actionStart = {}) {
    const actorName = text(actionStart?.actorName) || '后续行动者';
    const actionName = text(actionStart?.actionName) || '后续行动';
    const actionRole = text(actionStart?.actionRole).toUpperCase();
    if (actionRole === 'ASSIST') return `${actorName}以【${actionName}】追击时`;
    if (actionRole === 'COUNTER') return `${actorName}以【${actionName}】反击时`;
    if (actionRole === 'REACTION') return `${actorName}以【${actionName}】应对时`;
    return `${actorName}执行【${actionName}】时`;
  }

  function summarizeResponseFacts(responses = [], actionStartsById = new Map(), rootActionId = '') {
    const groups = new Map();
    responses.forEach(fact => {
      const directActionId = text(fact?.sourceActionId || rootActionId);
      if (!groups.has(directActionId)) groups.set(directActionId, []);
      groups.get(directActionId).push(fact);
    });
    return [...groups.entries()].map(([directActionId, facts]) => {
      const summary = summarizeResponseFactGroup(facts);
      const actionStart = directActionId && directActionId !== rootActionId
        ? actionStartsById.get(directActionId)
        : null;
      if (!actionStart || !summary) return summary;
      if (facts.every(fact => fact.eventKind === 'reaction_window')) {
        const names = compactEntityNames(facts.map(fact => fact.actorName));
        const unavailable = facts.every(fact => /不可用/.test(fact.summary));
        return `${nestedResponseLead(actionStart)}，${names}${unavailable ? '未能再次即时应对' : '获得即时应对窗口'}`;
      }
      return `${nestedResponseLead(actionStart)}，${summary}`;
    }).filter(Boolean).join('；');
  }

  function summarizeNestedReactionAction(actionStart = {}, supportingFacts = [], declaration = {}) {
    const actorName = text(actionStart?.actorName) || '应对者';
    const actionName = text(actionStart?.actionName) || '应对动作';
    const sourceActorName = text(declaration?.actorName) || '来源攻击者';
    const summonNames = unique(supportingFacts
      .filter(fact => fact.eventKind === 'summon_create')
      .map(fact => fact.targetName)
      .filter(Boolean));
    const resultSummaries = unique(supportingFacts
      .filter(fact => fact.eventKind !== 'summon_create')
      .map(fact => text(fact.summary))
      .filter(Boolean))
      .slice(0, 2);
    const base = summonNames.length
      ? `${actorName}以【${actionName}】应对${sourceActorName}的攻势并召唤${compactEntityNames(summonNames)}`
      : `${actorName}以【${actionName}】应对${sourceActorName}的攻势`;
    return resultSummaries.length ? `${base}，${resultSummaries.join('；')}` : base;
  }

  function summarizeImmediateResultFacts(facts = []) {
    const shieldGroups = new Map();
    const hitGroups = new Map();
    facts.filter(fact => fact.eventKind === 'shield_break').forEach(fact => {
      const key = `${fact.targetName}|${fact.actionName}`;
      if (!shieldGroups.has(key)) shieldGroups.set(key, []);
      shieldGroups.get(key).push(fact);
    });
    facts.filter(fact => fact.eventKind === 'hit_result').forEach(fact => {
      const key = `${fact.actorName}|${fact.actionName}|${fact.targetName}`;
      if (!hitGroups.has(key)) hitGroups.set(key, []);
      hitGroups.get(key).push(fact);
    });
    const emittedShieldGroups = new Set();
    const emittedHitGroups = new Set();
    const summaries = [];
    facts.forEach(fact => {
      if (fact.eventKind === 'hit_result') {
        const key = `${fact.actorName}|${fact.actionName}|${fact.targetName}`;
        if (emittedHitGroups.has(key)) return;
        emittedHitGroups.add(key);
        const grouped = hitGroups.get(key) || [fact];
        if (grouped.length === 1) {
          summaries.push(fact.summary);
          return;
        }
        const totalDamage = grouped.reduce((sum, item) => {
          const token = item.numericTokens.find(entry => entry.label === '最终伤害');
          return sum + Math.max(0, number(token?.value, 0));
        }, 0);
        const outcomeCounts = grouped.reduce((counts, item) => {
          const kind = hitOutcomeKind(item);
          counts[kind] = (counts[kind] || 0) + 1;
          return counts;
        }, {});
        const missed = Number(outcomeCounts.MISS || 0);
        const resisted = Number(outcomeCounts.RESISTED || 0);
        const landed = grouped.length - missed - resisted;
        if (totalDamage > 0) {
          summaries.push(`${fact.actorName}以【${fact.actionName}】的${grouped.length}段攻势中${landed}段命中${fact.targetName}，共造成${totalDamage}点伤害${missed ? `，${missed}段落空` : ''}${resisted ? `，${resisted}段被抵抗` : ''}`);
        } else if (landed > 0) {
          summaries.push(`${fact.actorName}以【${fact.actionName}】的${grouped.length}段攻势中${landed}段命中${fact.targetName}的护盾${missed ? `，${missed}段落空` : ''}${resisted ? `，${resisted}段被抵抗` : ''}`);
        } else if (resisted > 0) {
          summaries.push(`${fact.actorName}以【${fact.actionName}】的${grouped.length}段攻势中${resisted}段被${fact.targetName}抵抗${missed ? `，${missed}段落空` : ''}`);
        } else {
          summaries.push(`${fact.actorName}以【${fact.actionName}】攻击${fact.targetName}，${grouped.length}段攻势全部落空`);
        }
        return;
      }
      if (fact.eventKind !== 'shield_break') {
        summaries.push(fact.summary);
        return;
      }
      const key = `${fact.targetName}|${fact.actionName}`;
      if (emittedShieldGroups.has(key)) return;
      emittedShieldGroups.add(key);
      const grouped = shieldGroups.get(key) || [fact];
      const absorbed = grouped.reduce((sum, item) => {
        const token = item.numericTokens.find(entry => entry.label === '护盾损耗');
        return sum + Math.max(0, number(token?.value, 0));
      }, 0);
      const finalRemaining = grouped.reduce((remaining, item) => {
        const token = item.numericTokens.find(entry => entry.label === '剩余护盾');
        return token ? Math.max(0, number(token.value, 0)) : remaining;
      }, 0);
      summaries.push(finalRemaining > 0
        ? `${fact.targetName || fact.actorName}的护盾累计吸收${absorbed}点伤害，剩余${finalRemaining}点`
        : `${fact.targetName || fact.actorName}的护盾累计吸收${absorbed}点伤害后破裂`);
    });
    return unique(summaries).join('；');
  }

  function hitOutcomeKind(fact = {}) {
    if (text(fact?.resultCategory)) return text(fact.resultCategory).toUpperCase();
    const result = text(fact?.resultState).toUpperCase();
    if (/MISS|未命中/.test(result)) return 'MISS';
    if (/抵抗|免疫|RESIST|IMMUNE/.test(result)) return 'RESISTED';
    const damage = number(
      fact?.numericTokens?.find(token => token.label === '最终伤害')?.value,
      NaN,
    );
    const shieldAbsorb = number(
      fact?.numericTokens?.find(token => token.label === '护盾吸收')?.value,
      NaN,
    );
    if (Number.isFinite(damage) && damage > 0) return 'DAMAGE';
    if (Number.isFinite(shieldAbsorb) && shieldAbsorb > 0) return 'SHIELD';
    return 'HIT_NO_DAMAGE';
  }

  function qualifyIndependentEffectSummary(hitFacts = [], continuationFacts = [], summary = '') {
    const normalizedSummary = text(summary);
    if (!normalizedSummary) return '';
    const activeHits = hitFacts.filter(fact => text(fact?.eventKind) === 'hit_result');
    if (!activeHits.length) return normalizedSummary;
    const hitActionIds = new Set(activeHits.flatMap(fact => [
      text(fact?.actionId),
      text(fact?.sourceActionId),
    ]).filter(Boolean));
    const hasIndependentEffect = continuationFacts.some(fact =>
      fact?.eventKind === 'state_apply' &&
      (
        hitActionIds.has(text(fact?.actionId)) ||
        hitActionIds.has(text(fact?.sourceActionId))
      )
    );
    if (!hasIndependentEffect) return normalizedSummary;
    const missedCount = activeHits.filter(fact => hitOutcomeKind(fact) === 'MISS').length;
    if (missedCount === activeHits.length) {
      return `伤害均未命中，独立效果另行判定：${normalizedSummary}`;
    }
    if (missedCount > 0) {
      return `部分段数或目标未命中，独立效果分别判定：${normalizedSummary}`;
    }
    return `伤害已命中，附带效果仍按独立检定结算：${normalizedSummary}`;
  }

  function buildExchangeTargetGroups({
    declaration = null,
    facts = [],
    responses = [],
    immediateResults = [],
    continuationFacts = [],
    nestedReactionSupportingFacts = [],
    actionStartsById = new Map(),
    directory = new Map(),
  } = {}) {
    const declaredTargetIds = unique(declaration?.targetIds || []);
    const targetEntries = new Map();
    const registerTarget = (targetId, targetName, allowActor = false) => {
      const normalizedId = text(targetId);
      const normalizedName = text(targetName);
      const key = normalizedId || normalizedName;
      if (!key || (!allowActor && key === text(declaration?.actorId)) || targetEntries.has(key)) return;
      const existing = [...targetEntries.values()].find(target =>
        sameEntityReference(
          directory,
          normalizedId,
          normalizedName,
          target.targetId,
          target.targetName,
        )
      );
      if (existing) return;
      targetEntries.set(key, {
        targetId: normalizedId,
        targetName: normalizedName || normalizedId,
      });
    };
    declaredTargetIds.forEach(targetId => {
      const exactTargetFact = facts.find(fact =>
        unique(fact?.targetIds || []).length === 1 &&
        unique(fact?.targetIds || [])[0] === targetId &&
        text(fact?.targetName)
      );
      const actorFact = facts.find(fact =>
        text(fact?.actorId) === text(targetId) &&
        text(fact?.actorName)
      );
      registerTarget(
        targetId,
        exactTargetFact?.targetName || actorFact?.actorName || targetId,
        true,
      );
    });
    facts.forEach(fact => {
      const factTargetIds = unique(fact?.targetIds || []);
      const eventKind = text(fact?.eventKind);
      const actionRole = text(fact?.actionRole).toUpperCase();
      const responseOwnedByActor =
        responseEventKinds.has(eventKind) ||
        ['REACTION', 'COUNTER'].includes(actionRole) ||
        ['summon_create', 'summon_end'].includes(eventKind) &&
        targetEntries.has(text(fact?.actorId)) &&
        text(fact?.actorId) !== text(declaration?.actorId);
      const targetFact =
        factTargetIds.length === 1 &&
        !responseOwnedByActor &&
        [
          'effect_resolved',
          'hit_result',
          'resource_change',
          'shield_create',
          'state_apply',
        ].includes(eventKind);
      if (declaredTargetIds.length && !targetFact) return;
      factTargetIds.forEach(targetId => {
        registerTarget(
          targetId,
          text(fact?.targetName) || (
            text(fact?.actorId) === text(targetId) ? fact?.actorName : targetId
          ),
        );
      });
    });
    if (targetEntries.size <= 1) return [];
    const targetOwnerForFact = fact => {
      const eventKind = text(fact?.eventKind);
      const actionRole = text(fact?.actionRole).toUpperCase();
      const actorIsTarget = [...targetEntries.values()].some(targetEntry =>
        factActorBelongsToTarget(directory, fact, targetEntry)
      );
      const responseOwnedByActor =
        responseEventKinds.has(eventKind) && (eventKind !== 'reaction_window' || actorIsTarget) ||
        ['REACTION', 'COUNTER'].includes(actionRole) &&
          (eventKind !== 'reaction_window' || actorIsTarget) ||
        ['summon_create', 'summon_end'].includes(eventKind) &&
        [...targetEntries.values()].some(targetEntry =>
          factReferenceMatchesTarget(
            directory,
            fact?.actorId,
            fact?.actorName,
            targetEntry.targetId,
            targetEntry.targetName,
          )
        ) &&
        text(fact?.actorId) !== text(declaration?.actorId);
      const directOwners = [...targetEntries.values()].filter(targetEntry =>
        responseOwnedByActor
          ? factActorBelongsToTarget(directory, fact, targetEntry)
          : factDirectlyBelongsToTarget(fact, targetEntry)
      );
      const fallbackOwners = responseOwnedByActor
        ? [...targetEntries.values()].filter(targetEntry =>
            factActorBelongsToTarget(directory, fact, targetEntry)
          )
        : [...targetEntries.values()].filter(targetEntry =>
            factBelongsToTarget(directory, fact, targetEntry)
          );
      const owners = directOwners.length ? directOwners : fallbackOwners;
      return owners.length === 1 ? owners[0] : null;
    };

    return [...targetEntries.values()].map(target => {
      const targetResponses = responses.filter(fact => targetOwnerForFact(fact) === target);
      const targetResults = immediateResults.filter(fact => targetOwnerForFact(fact) === target);
      const targetContinuations = uniqueBy(
        [...continuationFacts, ...nestedReactionSupportingFacts]
          .filter(fact => targetOwnerForFact(fact) === target),
        fact => fact.factId,
      );
      const targetHitFacts = targetResults.filter(fact =>
        fact?.eventKind === 'hit_result' &&
        text(fact?.actionRole).toUpperCase() === 'ACTIVE' &&
        factBelongsToDirectAction(fact, declaration?.actionId)
      );
      const responseSummary = summarizeResponseFacts(
        targetResponses,
        actionStartsById,
        declaration?.actionId,
      );
      const resultSummary = summarizeImmediateResultFacts(targetResults);
      const continuationSummary = qualifyIndependentEffectSummary(
        targetHitFacts,
        targetContinuations,
        unique(targetContinuations.map(fact => fact.summary)).join('；'),
      );
      const factIds = unique([
        ...targetResponses.map(fact => fact.factId),
        ...targetResults.map(fact => fact.factId),
        ...targetContinuations.map(fact => fact.factId),
      ]);
      return {
        targetId: target.targetId,
        targetName: target.targetName,
        factIds,
        responseFactIds: unique(targetResponses.map(fact => fact.factId)),
        resultFactIds: unique(targetResults.map(fact => fact.factId)),
        continuationFactIds: unique(targetContinuations.map(fact => fact.factId)),
        responseSummary,
        resultSummary,
        continuationSummary,
        text: [
          responseSummary ? `应对：${responseSummary}` : '',
          resultSummary ? `结果：${resultSummary}` : '',
          continuationSummary ? `后续：${continuationSummary}` : '',
        ].filter(Boolean).join('。'),
      };
    }).filter(group =>
      Array.isArray(group?.factIds) &&
      group.factIds.length > 0 &&
      text(group?.text),
    );
  }

  function exchangePresentation(exchange = {}, factsById = new Map(), directory = new Map()) {
    const facts = exchange.factIds.map(factId => factsById.get(factId)).filter(Boolean);
    const declaration = facts.find(fact => ['action_start', 'charge_start'].includes(fact.eventKind)) || facts[0] || null;
    const actionStartsById = new Map(facts
      .filter(fact => ['action_start', 'charge_start'].includes(fact.eventKind) && fact.actionId)
      .map(fact => [fact.actionId, fact]));
    const nestedReactionStarts = facts.filter(fact =>
      ['action_start', 'charge_start'].includes(fact.eventKind) &&
      fact.factId !== declaration?.factId &&
      text(fact.actionRole).toUpperCase() === 'REACTION'
    );
    const nestedReactionSupportingFactIds = new Set();
    const nestedReactionSummaries = nestedReactionStarts.map(actionStart => {
      const supportingFacts = facts.filter(fact =>
        fact.sourceActionId === actionStart.actionId &&
        [
          'summon_create',
          'hit_result',
          'shield_create',
          'resource_change',
          'state_apply',
          'state_remove',
          'state_expire',
        ].includes(fact.eventKind)
      );
      supportingFacts.forEach(fact => nestedReactionSupportingFactIds.add(fact.factId));
      return summarizeNestedReactionAction(actionStart, supportingFacts, declaration);
    });
    const responses = facts.filter(fact => responseEventKinds.has(fact.eventKind));
    const rawResultFacts = facts.filter(fact =>
      fact.factId !== declaration?.factId &&
      !['action_start', 'charge_start', 'round_summary'].includes(fact.eventKind) &&
      !responseEventKinds.has(fact.eventKind) &&
      !nestedReactionSupportingFactIds.has(fact.factId) &&
      fact.eventKind !== 'action_cost'
    );
    const resultFacts = rawResultFacts.filter(fact => !(
      ['lost_opportunity', 'action_cancelled', 'blocked_action'].includes(text(fact?.eventKind)) &&
      text(fact?.actionRole).toUpperCase() === 'REACTION'
    ));
    const continuationFacts = resultFacts.filter(fact =>
      ['state_apply', 'state_remove', 'state_expire', 'summon_create', 'summon_end', 'lost_opportunity', 'action_cancelled', 'charge_interrupt'].includes(fact.eventKind)
    );
    const immediateResults = resultFacts.filter(fact => !continuationFacts.includes(fact));
    const creationFact = facts.find(fact => ['create', 'item_created'].includes(fact.eventKind));
    const consumptionFact = facts.find(fact => ['item_consume', 'item_used'].includes(fact.eventKind));
    const actionSummary = creationFact
      ? `${declaration?.actorName || creationFact.actorName}制作【${creationFact.actionName || creationFact.meta?.createdName || '物品'}】`
      : consumptionFact
        ? `${declaration?.actorName || consumptionFact.actorName}使用【${consumptionFact.actionName || consumptionFact.meta?.itemName || '物品'}】${consumptionFact.targetName && consumptionFact.targetName !== consumptionFact.actorName ? `指向${consumptionFact.targetName}` : ''}`
        : declaration?.summary || facts[0]?.summary || '行动已记录';
    let responseSummary = unique([
      ...nestedReactionSummaries,
      summarizeResponseFacts(responses, actionStartsById, declaration?.actionId),
    ]).filter(Boolean).join('；');
    const resultSummary = summarizeImmediateResultFacts(immediateResults);
    const rootHitFacts = facts.filter(fact =>
      fact.eventKind === 'hit_result' &&
      text(fact.actionRole).toUpperCase() === 'ACTIVE' &&
      factBelongsToDirectAction(fact, declaration?.actionId)
    );
    const allRootHitsMissed = rootHitFacts.length > 0 &&
      rootHitFacts.every(fact => /未命中|落点偏离/.test(text(fact.summary)));
    if (allRootHitsMissed) {
      responseSummary = responseSummary.replace(
        /，将本次伤害压至\d+(?:\.\d+)?%/g,
        '，防御姿态已建立但未参与伤害结算',
      );
      if (/尝试闪避.+未能直接避开/.test(responseSummary)) {
        responseSummary = `${responseSummary}；闪避检定未成功，但随后攻击命中检定仍未通过，攻击本身仍未命中`;
      }
    }
    const continuationSummary = qualifyIndependentEffectSummary(
      rootHitFacts,
      continuationFacts,
      unique(continuationFacts.map(fact => fact.summary)).join('；'),
    );
    const targetGroups = buildExchangeTargetGroups({
      declaration,
      facts,
      responses,
      immediateResults,
      continuationFacts,
      nestedReactionSupportingFacts: facts.filter(fact => nestedReactionSupportingFactIds.has(fact.factId)),
      actionStartsById,
      directory,
    });
    const targetGroupFactIds = unique(targetGroups.flatMap(group => group.factIds || []));
    const sharedFactIds = unique(
      facts
        .filter(fact =>
          !['action_start', 'charge_start', 'round_summary', 'action_cost'].includes(text(fact?.eventKind)) &&
          !targetGroupFactIds.includes(fact.factId) &&
          (
            (Array.isArray(fact?.targetIds) && fact.targetIds.length > 1) ||
            targetGroups.length > 1
          ),
        )
        .map(fact => fact.factId),
    );
    const declaredTargetNames = declaration?.targetIds?.length
      ? declaration.targetIds.map(targetId => publicEntityName(directory, targetId, targetId))
      : [declaration?.targetName];
    return {
      ...exchange,
      actorId: declaration?.actorId || exchange.actorId,
      actorName: declaration?.actorName || exchange.actorName,
      targetIds: declaration?.targetIds?.length ? [...declaration.targetIds] : [...exchange.targetIds],
      targetNames: unique(declaredTargetNames),
      action: {
        name: declaration?.actionName || exchange.action?.name || '行动',
        role: declaration?.actionRole || exchange.action?.role || 'ACTIVE',
        summary: actionSummary,
      },
      responseFactIds: unique([
        ...nestedReactionStarts.map(fact => fact.factId),
        ...nestedReactionSupportingFactIds,
        ...responses.map(fact => fact.factId),
      ]),
      resultFactIds: immediateResults.map(fact => fact.factId),
      continuationFactIds: continuationFacts.map(fact => fact.factId),
      targetGroups,
      targetGroupFactIds,
      sharedFactIds,
      responseSummary,
      resultSummary,
      continuationSummary,
      text: [
        actionSummary,
        responseSummary ? `应对：${responseSummary}` : '',
        resultSummary ? `结果：${resultSummary}` : '',
        continuationSummary ? `后续：${continuationSummary}` : '',
      ].filter(Boolean).join('。'),
    };
  }

  function buildClashGroups(exchanges = [], factsById = new Map()) {
    const ordered = [...exchanges].sort((left, right) =>
      number(left?.round, 0) - number(right?.round, 0) ||
      number(left?.sequence, 0) - number(right?.sequence, 0)
    );
    const groups = [];
    const participantsOf = exchange => unique([
      exchange?.actorId,
      ...(Array.isArray(exchange?.targetIds) ? exchange.targetIds : []),
    ].map(text).filter(Boolean));
    const targetIdsOf = exchange => unique(
      (Array.isArray(exchange?.targetIds) ? exchange.targetIds : [])
        .map(text)
        .filter(Boolean),
    );
    const createGroup = exchange => ({
      clashId: `clash:${number(exchange?.round, 0)}:${groups.length + 1}`,
      round: number(exchange?.round, 0),
      exchangeIds: [],
      factIds: [],
      participantIds: [],
      targetIds: [],
      intents: [],
      actions: [],
      responses: [],
      results: [],
      continuations: [],
    });
    const summarizeRepeatedClauses = values => {
      const clauses = values
        .flatMap(value => text(value).split('；'))
        .map(text)
        .filter(Boolean);
      const counts = new Map();
      clauses.forEach(clause => counts.set(clause, (counts.get(clause) || 0) + 1));
      return [...counts.entries()]
        .map(([clause, count]) => count > 1 ? `${clause}（共${count}次）` : clause)
        .join('；');
    };
    const actionIdsOf = exchange => new Set(
      (exchange?.factIds || [])
        .map(factId => factsById.get(text(factId)))
        .filter(fact => ['action_start', 'charge_start'].includes(text(fact?.eventKind)))
        .flatMap(fact => [fact?.actionId, fact?.sourceActionId])
        .map(text)
        .filter(Boolean),
    );
    const directlyCausedBy = (rootActionIds, exchange) =>
      (exchange?.factIds || [])
        .map(factId => factsById.get(text(factId)))
        .filter(Boolean)
        .some(fact =>
          rootActionIds.has(text(fact?.sourceActionId)) ||
          rootActionIds.has(text(fact?.parentActionId))
        );
    const assignedExchangeIds = new Set();
    ordered.forEach((exchange, exchangeIndex) => {
      const exchangeId = text(exchange?.exchangeId);
      if (assignedExchangeIds.has(exchangeId)) return;
      const current = createGroup(exchange);
      groups.push(current);
      const rootActionIds = actionIdsOf(exchange);
      const sameRoundLater = ordered.slice(exchangeIndex + 1).filter(candidate =>
        number(candidate?.round, 0) === number(exchange?.round, 0) &&
        !assignedExchangeIds.has(text(candidate?.exchangeId))
      );
      const members = [exchange];
      sameRoundLater
        .filter(candidate => directlyCausedBy(rootActionIds, candidate))
        .slice(0, 1)
        .forEach(candidate => members.push(candidate));
      members
        .sort((left, right) => ordered.indexOf(left) - ordered.indexOf(right))
        .forEach(member => {
          assignedExchangeIds.add(text(member?.exchangeId));
          const participants = participantsOf(member);
          const targets = targetIdsOf(member);
          current.exchangeIds.push(text(member?.exchangeId));
          current.factIds.push(...(Array.isArray(member?.factIds) ? member.factIds.map(text) : []));
          current.participantIds.push(...participants);
          current.targetIds.push(...targets);
          if (text(member?.intentSummary)) current.intents.push(text(member.intentSummary));
          if (text(member?.action?.summary)) current.actions.push(text(member.action.summary));
          if (text(member?.responseSummary)) current.responses.push(text(member.responseSummary));
          if (text(member?.resultSummary)) current.results.push(text(member.resultSummary));
          if (text(member?.continuationSummary)) current.continuations.push(text(member.continuationSummary));
        });
      current.participantIds = unique(current.participantIds);
      current.targetIds = unique(current.targetIds);
    });
    return groups.map(group => {
      const intents = unique(group.intents);
      const actions = unique(group.actions);
      const responses = unique(group.responses);
      const results = unique(group.results);
      const continuations = unique(group.continuations);
      const intentSummary = intents.join('；');
      const actionSummary = actions.join('；');
      const responseSummary = summarizeRepeatedClauses(responses);
      const resultSummary = summarizeRepeatedClauses(results);
      const continuationSummary = summarizeRepeatedClauses(continuations);
      return {
        clashId: group.clashId,
        round: group.round,
        exchangeIds: unique(group.exchangeIds),
        factIds: unique(group.factIds),
        participantIds: unique(group.participantIds),
        targetIds: unique(group.targetIds),
        intentSummary,
        actionSummary,
        responseSummary,
        resultSummary,
        continuationSummary,
        text: [
          intentSummary ? `意图：${intentSummary}` : '',
          actionSummary ? `行动：${actionSummary}` : '',
          responseSummary ? `应对：${responseSummary}` : '',
          resultSummary ? `结果：${resultSummary}` : '',
          continuationSummary ? `后续：${continuationSummary}` : '',
        ].filter(Boolean).join('。'),
      };
    });
  }

  function unitStateFromSnapshot(unit = {}, side = '', directory = new Map()) {
    const id = publicEntityId(directory, unit?.id || unit?.召唤键 || unit?.name || unit?.名称);
    const name = publicEntityName(directory, unit?.id || unit?.召唤键 || unit?.name || unit?.名称, unit?.name || unit?.名称);
    const states = Array.isArray(unit?.状态效果)
      ? unit.状态效果.map(state => text(state?.name || state?.状态 || state?.状态名称)).filter(Boolean)
      : Object.entries(unit?.状态效果 || {}).map(([stateKey, state]) =>
          text(state?.name || state?.状态 || state?.状态名称 || stateKey)
        ).filter(Boolean);
    return {
      id,
      name,
      side,
      hp: number(unit?.hp ?? unit?.HP ?? unit?.属性?.HP, 0),
      hpMax: Math.max(1, number(unit?.hp_max ?? unit?.HP上限 ?? unit?.属性?.HP上限, 1)),
      shield: Math.max(0, number(unit?.shield ?? unit?.护盾, 0)),
      resources: {
        soul: number(unit?.sp ?? unit?.魂力 ?? unit?.属性?.魂力, 0),
        soulMax: Math.max(0, number(unit?.sp_max ?? unit?.魂力上限 ?? unit?.属性?.魂力上限, 0)),
        spirit: number(unit?.men ?? unit?.精神力 ?? unit?.属性?.精神力, 0),
        spiritMax: Math.max(0, number(unit?.men_max ?? unit?.精神力上限 ?? unit?.属性?.精神力上限, 0)),
        stamina: number(unit?.vit ?? unit?.sta ?? unit?.体力 ?? unit?.属性?.体力, 0),
        staminaMax: Math.max(0, number(unit?.vit_max ?? unit?.sta_max ?? unit?.体力上限 ?? unit?.属性?.体力上限, 0)),
      },
      actionState: text(unit?.actionState || unit?.状态?.行动 || unit?.行动状态 || '战斗'),
      states: unique(states),
      summon: !!text(unit?.召唤键 || unit?.单位性质),
      hostName: playerSafeText(unit?.宿主名, directory),
      remainingWindows: Math.max(0, number(unit?.剩余窗口, 0)),
    };
  }

  function initialUnitStates(draft = {}, directory = new Map()) {
    const snapshot = draft?.initialSnapshot || draft?.finalSnapshot || {};
    const states = new Map();
    snapshotUnits(snapshot).forEach(({ unit, side }) => {
      const state = unitStateFromSnapshot(unit, side, directory);
      states.set(state.id, state);
      if (state.name && !states.has(state.name)) states.set(state.name, state);
    });
    return states;
  }

  function findUnitState(states = new Map(), directory = new Map(), rawId = '', rawName = '') {
    const publicId = publicEntityId(directory, rawId || rawName);
    const publicName = publicEntityName(directory, rawId || rawName, rawName || rawId);
    return states.get(publicId) || states.get(publicName) || null;
  }

  function applyFactToRoundState(states = new Map(), fact = {}, rawEvent = {}, directory = new Map()) {
    const meta = rawEvent?.meta && typeof rawEvent.meta === 'object' ? rawEvent.meta : {};
    const target = findUnitState(states, directory, rawEvent?.targetId, rawEvent?.targetName);
    const actor = findUnitState(states, directory, rawEvent?.actorId, rawEvent?.actorName);
    const kind = fact.eventKind;
    const damage = number(rawEvent?.appliedDamage ?? meta?.appliedDamage ?? rawEvent?.damage ?? meta?.damage, 0);
    if (target && damage > 0 && ['hit_result', 'state_tick', 'reflect_damage', 'self_damage'].includes(kind)) {
      target.hp = Math.max(0, target.hp - damage);
    }
    const delta = number(rawEvent?.delta ?? meta?.delta, 0);
    if ((kind === 'resource_change' || kind === 'round_recover') && delta !== 0) {
      const resource = text(rawEvent?.resource || meta?.resourceKey || meta?.resource);
      const unit = target || actor;
      if (unit) {
        if (/生命|hp/i.test(resource)) unit.hp = Math.max(0, Math.min(unit.hpMax, unit.hp + delta));
        else if (/护盾|shield/i.test(resource)) unit.shield = Math.max(0, unit.shield + delta);
        else if (/魂力|sp|soul/i.test(resource)) unit.resources.soul += delta;
        else if (/精神|men|spirit/i.test(resource)) unit.resources.spirit += delta;
        else if (/体力|vit|sta|stamina/i.test(resource)) unit.resources.stamina += delta;
      }
    }
    if (kind === 'shield_create' && target) target.shield += Math.max(0, number(meta?.amount ?? rawEvent?.amount, 0));
    if (kind === 'state_apply' && target && fact.stateName) target.states = unique([...target.states, fact.stateName]);
    if (['state_remove', 'state_expire'].includes(kind) && target && fact.stateName) {
      target.states = target.states.filter(name => name !== fact.stateName);
    }
  }

  function cloneSideUnits(states = new Map()) {
    const uniqueStates = [...new Set([...states.values()])];
    return {
      player: uniqueStates.filter(unit => unit.side === 'player').map(cloneValue),
      enemy: uniqueStates.filter(unit => unit.side === 'enemy').map(cloneValue),
    };
  }

  function opportunityFactKey(event = {}, fact = {}) {
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const opportunityId = text(
      event?.opportunityId ||
      event?.grantId ||
      meta?.opportunityId ||
      meta?.grantId,
    );
    if (!opportunityId) return '';
    return `${text(fact?.actorId || event?.actorId || event?.actorName)}|${opportunityId}`;
  }

  function executedRoundNumbers(draft = {}, ledger = []) {
    const explicit = Array.isArray(draft?.executedRoundNumbers)
      ? draft.executedRoundNumbers.map(value => Math.max(0, number(value, 0))).filter(value => value > 0)
      : [];
    const fromLedger = ledger
      .map(event => Math.max(0, number(event?.round ?? event?.absoluteRound, 0)))
      .filter(value => value > 0);
    const rounds = [...new Set(explicit.length ? explicit : fromLedger)].sort((left, right) => left - right);
    if (rounds.length) return rounds;
    const count = Math.max(0, number(draft?.actualRoundCount, 0));
    const start = Math.max(1, number(draft?.roundStart, 1));
    return Array.from({ length: count }, (_, index) => start + index);
  }

  function buildRoundOverview(draft = {}, ledger = [], factsById = new Map(), exchanges = [], directory = new Map()) {
    const states = initialUnitStates(draft, directory);
    const exchangeByRound = new Map();
    exchanges.forEach(exchange => {
      if (!exchangeByRound.has(exchange.round)) exchangeByRound.set(exchange.round, []);
      exchangeByRound.get(exchange.round).push(exchange.exchangeId);
    });
    const rawEventsByRound = new Map();
    ledger.forEach(event => {
      const round = Math.max(0, number(event?.round, 0));
      if (!rawEventsByRound.has(round)) rawEventsByRound.set(round, []);
      rawEventsByRound.get(round).push(event);
    });
    const rows = [];
    for (const round of executedRoundNumbers(draft, ledger)) {
      const events = rawEventsByRound.get(round) || [];
      const factIds = events.map(event => text(event?.eventId)).filter(Boolean);
      events.forEach(event => {
        const fact = factsById.get(text(event?.eventId));
        if (fact) applyFactToRoundState(states, fact, event, directory);
      });
      const roundFacts = factIds.map(factId => factsById.get(factId)).filter(Boolean);
      const damageBySide = { player: 0, enemy: 0 };
      roundFacts.forEach(fact => {
        const token = fact.numericTokens.find(item => item.label === '最终伤害');
        if (token && ['player', 'enemy'].includes(fact.actorSide)) damageBySide[fact.actorSide] += Math.max(0, number(token.value, 0));
      });
      const resourceEvents = roundFacts
        .filter(fact => fact.numericTokens.some(token => token.label === '资源变化'))
        .map(fact => ({
          factId: fact.factId,
          actorId: fact.actorId,
          actorName: fact.actorName,
          targetName: fact.targetName,
          token: fact.numericTokens.find(token => token.label === '资源变化'),
        }));
      const rawEventsById = new Map(events.map(event => [text(event?.eventId), event]));
      const shieldBySide = {
        player: { gained: 0, absorbed: 0, lost: 0 },
        enemy: { gained: 0, absorbed: 0, lost: 0 },
      };
      roundFacts.forEach(fact => {
        const side = ['player', 'enemy'].includes(fact.targetSide)
          ? fact.targetSide
          : fact.actorSide;
        if (!shieldBySide[side]) return;
        fact.numericTokens.forEach(token => {
          const amount = Math.max(0, Math.abs(number(token.value, 0)));
          if (token.label === '护盾增加') shieldBySide[side].gained += amount;
          if (token.label === '护盾吸收') shieldBySide[side].absorbed += amount;
          if (token.label === '护盾损耗') shieldBySide[side].lost += amount;
        });
      });
      const resourceDeltaBySide = { player: 0, enemy: 0 };
      resourceEvents.forEach(event => {
        const fact = factsById.get(event.factId);
        const side = ['player', 'enemy'].includes(fact?.targetSide)
          ? fact.targetSide
          : fact?.actorSide;
        if (side) resourceDeltaBySide[side] += number(event.token?.value, 0);
      });
      const assetEvents = roundFacts.filter(fact => ['create', 'item_consume'].includes(fact.eventKind));
      const createdItemCount = assetEvents
        .filter(fact => fact.eventKind === 'create')
        .reduce((sum, fact) => sum + Math.max(1, number(rawEventsById.get(fact.factId)?.count, 1)), 0);
      const consumedItemCount = assetEvents
        .filter(fact => fact.eventKind === 'item_consume')
        .reduce((sum, fact) => sum + Math.max(1, number(rawEventsById.get(fact.factId)?.count, 1)), 0);
      const stateEvents = roundFacts.filter(fact => /state_/.test(fact.eventKind)).map(fact => fact.factId);
      const summonEvents = roundFacts.filter(fact => /summon_/.test(fact.eventKind)).map(fact => fact.factId);
      const attributeEvents = roundFacts.filter(fact =>
        fact.eventKind === 'effect_resolved' &&
        fact.numericTokens.some(token => token.sourceType === 'ATTRIBUTE')
      );
      const opportunityFacts = roundFacts.filter(fact => {
        if (!['lost_opportunity', 'action_cancelled', 'blocked_action'].includes(fact.eventKind)) return false;
        const rawEvent = rawEventsById.get(fact.factId);
        return text(rawEvent?.ruleCode || rawEvent?.meta?.reasonCode) !== 'BATTLE_TERMINAL';
      });
      const opportunityFactByKey = new Map();
      opportunityFacts.forEach(fact => {
        const key = opportunityFactKey(rawEventsById.get(fact.factId), fact) || `fact:${fact.factId}`;
        const current = opportunityFactByKey.get(key);
        if (!current || (fact.eventKind === 'lost_opportunity' && current.eventKind !== 'lost_opportunity')) {
          opportunityFactByKey.set(key, fact);
        }
      });
      const canonicalOpportunityFacts = [...opportunityFactByKey.values()];
      const lostOpportunityFactIds = canonicalOpportunityFacts.map(fact => fact.factId);
      const lostOpportunityCount = canonicalOpportunityFacts.length;
      const summaryFactIds = roundFacts.filter(fact => fact.eventKind === 'round_summary').map(fact => fact.factId);
      const passiveFacts = roundFacts.filter(fact =>
        fact.canonicalFactOwner === `round:${round}` && fact.eventKind !== 'round_summary'
      );
      const lostOpportunityKeys = new Set(passiveFacts
        .filter(fact => fact.eventKind === 'lost_opportunity')
        .map(fact => opportunityFactKey(rawEventsById.get(fact.factId), fact))
        .filter(Boolean));
      const passiveSummaryFacts = passiveFacts.filter(fact => {
        const rawEvent = rawEventsById.get(fact.factId);
        if (text(rawEvent?.ruleCode || rawEvent?.meta?.reasonCode) === 'BATTLE_TERMINAL') return false;
        if (!['action_cancelled', 'blocked_action'].includes(fact.eventKind)) return true;
        const key = opportunityFactKey(rawEventsById.get(fact.factId), fact);
        return !key || !lostOpportunityKeys.has(key);
      });
      const summaryParts = [];
      if (damageBySide.player > 0 || damageBySide.enemy > 0) {
        summaryParts.push(`我方造成${damageBySide.player}点伤害，敌方造成${damageBySide.enemy}点伤害`);
      }
      const shieldParts = [
        ['我方', shieldBySide.player],
        ['敌方', shieldBySide.enemy],
      ].flatMap(([label, values]) => [
        values.gained > 0 ? `${label}护盾增加${values.gained}点` : '',
        values.absorbed > 0 ? `${label}护盾吸收${values.absorbed}点伤害` : '',
        values.lost > values.absorbed ? `${label}另有${values.lost - values.absorbed}点护盾消散` : '',
      ]).filter(Boolean);
      if (shieldParts.length) summaryParts.push(shieldParts.join('，'));
      const resourceParts = [
        resourceDeltaBySide.player ? `我方资源净变化${resourceDeltaBySide.player > 0 ? '+' : ''}${resourceDeltaBySide.player}` : '',
        resourceDeltaBySide.enemy ? `敌方资源净变化${resourceDeltaBySide.enemy > 0 ? '+' : ''}${resourceDeltaBySide.enemy}` : '',
      ].filter(Boolean);
      if (resourceEvents.length) {
        summaryParts.push(resourceParts.length ? resourceParts.join('，') : `发生${resourceEvents.length}项资源变化`);
      }
      if (createdItemCount || consumedItemCount) {
        summaryParts.push([
          createdItemCount ? `制作${createdItemCount}件物品` : '',
          consumedItemCount ? `消耗${consumedItemCount}件物品` : '',
        ].filter(Boolean).join('，'));
      }
      if (stateEvents.length) summaryParts.push(`发生${stateEvents.length}项状态变化`);
      if (summonEvents.length) summaryParts.push(`发生${summonEvents.length}项召唤变化`);
      if (attributeEvents.length) {
        summaryParts.push(unique(attributeEvents.map(fact => fact.summary)).join('；'));
      }
      if (lostOpportunityCount) summaryParts.push(`${lostOpportunityCount}次行动机会未能执行`);
      if (!summaryParts.length) summaryParts.push('本回合未产生生命、护盾、资源或物品变化，行动与窗口事实已完整记录');
      const passiveSummary = unique(passiveSummaryFacts.map(fact => fact.summary)).join('；');
      rows.push({
        round,
        factIds,
        canonicalFactIds: summaryFactIds,
        passiveFactIds: passiveFacts.map(fact => fact.factId),
        passiveSummary,
        exchangeIds: exchangeByRound.get(round) || [],
        summary: summaryParts.join('；'),
        damageBySide,
        shieldBySide,
        resourceEvents,
        resourceDeltaBySide,
        assetEventFactIds: assetEvents.map(fact => fact.factId),
        stateEventFactIds: stateEvents,
        summonEventFactIds: summonEvents,
        attributeEventFactIds: attributeEvents.map(fact => fact.factId),
        lostOpportunityFactIds,
        lostOpportunityCount,
        units: cloneSideUnits(states),
      });
    }
    return rows;
  }

  function finalSide(snapshot = {}, side = 'player', directory = new Map()) {
    return snapshotTeam(snapshot, side).map(unit => unitStateFromSnapshot(unit, side, directory));
  }

  function projectPlayerValue(value, directory = new Map(), key = '') {
    if (typeof value === 'string') return playerSafeText(value, directory);
    if (Array.isArray(value)) return value.map(item => projectPlayerValue(item, directory, key));
    if (!value || typeof value !== 'object') return value;
    const result = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      if (childKey.endsWith('Id') && typeof childValue === 'string' && childValue) {
        const entityReferenceKeys = new Set(['unitId', 'actorId', 'targetId', 'sourceActorId', 'hostId']);
        if (entityReferenceKeys.has(childKey)) {
          result[childKey] = publicEntityId(directory, childValue);
        } else if (childKey === 'sourceEventId' || childKey === 'eventId') {
          result[childKey] = text(childValue);
        } else {
          result[childKey] = '';
        }
        return;
      }
      result[childKey] = projectPlayerValue(childValue, directory, childKey);
    });
    return result;
  }

  function projectTerminalResult(terminal = {}, visibilityMode = 'PLAYER', directory = new Map()) {
    if (visibilityMode === 'DEVELOPER') return cloneValue(terminal || {});
    return projectPlayerValue(terminal || {}, directory, 'terminalResult');
  }

  function sideMetric(units = []) {
    const alive = units.filter(unit => unit.hp > 0 && !/死亡|失去战斗力|昏迷/.test(unit.actionState)).length;
    const hpRatio = units.length
      ? units.reduce((sum, unit) => sum + unit.hp / Math.max(1, unit.hpMax), 0) / units.length
      : 0;
    const resourceRatio = units.length
      ? units.reduce((sum, unit) => {
          const soul = unit.resources.soulMax > 0 ? unit.resources.soul / unit.resources.soulMax : 1;
          const spirit = unit.resources.spiritMax > 0 ? unit.resources.spirit / unit.resources.spiritMax : 1;
          const stamina = unit.resources.staminaMax > 0 ? unit.resources.stamina / unit.resources.staminaMax : 1;
          return sum + (soul + spirit + stamina) / 3;
        }, 0) / units.length
      : 0;
    return { alive, total: units.length, hpRatio, resourceRatio, score: alive * 100 + hpRatio * 60 + resourceRatio * 20 };
  }

  function terminalText(terminal = {}) {
    const winner = text(terminal?.winner);
    if (winner === 'player') return '我方获胜';
    if (winner === 'enemy') return '敌方获胜';
    if (winner === 'draw') return '双方未分胜负';
    return terminal?.terminal === true ? '战斗已结束' : '战斗仍在继续';
  }

  function terminalConditionText(terminal = {}) {
    const detail = (Array.isArray(terminal?.matchedDetails) ? terminal.matchedDetails : [])
      .find(item => item?.matched === true && item?.condition);
    const condition = detail?.condition || null;
    if (!condition) {
      return terminal?.timeLimitReached === true ? '达到回合上限' : '';
    }
    const sideLabel = text(condition?.side).toUpperCase() === 'PLAYER' ? '我方' : '敌方';
    const unitNames = unique(
      (Array.isArray(detail?.unitResults) ? detail.unitResults : [])
        .filter(item => item?.matched === true)
        .map(item => text(item?.unitName || item?.unitId))
        .filter(Boolean),
    );
    const targetLabel = unitNames.length
      ? compactEntityNames(unitNames)
      : text(condition?.scope).toUpperCase() === 'ALL'
        ? `${sideLabel}全体`
        : sideLabel;
    const type = text(condition?.type).toUpperCase();
    if (type === 'HP_RATIO_AT_OR_BELOW') {
      return `${targetLabel}生命降至${displayNumber(number(condition?.threshold, 0) * 100)}%或以下`;
    }
    if (type === 'ROUND_REACHED') {
      return `${sideLabel}坚持至第${Math.max(1, number(condition?.round, 1))}回合`;
    }
    if (type === 'TEAM_INCAPACITATED') return `${sideLabel}全员失去战斗能力`;
    if (type === 'UNIT_INCAPACITATED') return `${targetLabel}失去战斗能力`;
    if (type === 'TEAM_DEAD') return `${sideLabel}全员死亡`;
    if (type === 'UNIT_DEAD') return `${targetLabel}死亡`;
    if (type === 'UNIT_DAMAGED') return `${targetLabel}受到伤害`;
    if (type === 'WITHDRAW_SUCCESS') return `${sideLabel}成功撤离`;
    return '';
  }

  function latestSideIntent(decisions = [], sideUnits = [], directory = new Map(), terminal = {}, side = '') {
    if (terminal?.terminal === true) {
      const winner = text(terminal?.winner);
      const terminalReason = text(terminal?.terminalReason || terminal?.status);
      if (winner === 'draw') {
        return terminal?.timeLimitReached === true || /TIME_LIMIT|回合上限/i.test(terminalReason)
          ? '达到回合上限，本次交锋停止，保留当前战况等待后续裁断'
          : '双方终止条件同时成立，本次交锋停止并等待裁断';
      }
      if (winner && side) {
        return winner === side
          ? '已达成战斗目标，转入收势与战后确认'
          : '未能达成战斗目标，停止继续行动';
      }
      return '战斗已经结束，转入战后处置';
    }
    const names = new Set(sideUnits.map(unit => unit.name));
    const latest = [...decisions].reverse().find(decision => names.has(publicEntityName(directory, decision?.actorId, decision?.actorId)));
    if (!latest) return '保留当前战术，等待下一次自然行动';
    const focus = publicEntityName(directory, latest?.teamIntent?.focusTarget, latest?.teamIntent?.focusTarget);
    const protect = publicEntityName(directory, latest?.teamIntent?.protectTarget, latest?.teamIntent?.protectTarget);
    if (protect) return `优先保护${protect}并降低下一次回应风险`;
    if (focus) return `继续围绕${focus}寻找有效推进`;
    return `延续“${problemLabels[text(latest?.problems?.[0]?.problemId)] || '当前局势'}”策略`;
  }

  function buildFinalSummary(draft = {}, roundOverview = [], directory = new Map()) {
    const snapshot = draft?.finalSnapshot || {};
    const terminal = projectTerminalResult(draft?.terminalResult || {}, 'PLAYER', directory);
    const playerUnits = finalSide(snapshot, 'player', directory);
    const enemyUnits = finalSide(snapshot, 'enemy', directory);
    const summons = snapshotSummons(snapshot).map(unit => unitStateFromSnapshot(
      unit,
      text(unit?.side || unit?.阵营).toLowerCase().includes('enemy') ? 'enemy' : 'player',
      directory,
    ));
    const playerMetric = sideMetric(playerUnits);
    const enemyMetric = sideMetric(enemyUnits);
    const advantageDelta = playerMetric.score - enemyMetric.score;
    const advantage = Math.abs(advantageDelta) < 8 ? '双方总体容量接近'
      : advantageDelta > 0 ? '我方保有更高的当前战斗容量' : '敌方保有更高的当前战斗容量';
    const recent = roundOverview.slice(-2);
    const recentPlayerDamage = recent.reduce((sum, row) => sum + number(row?.damageBySide?.player, 0), 0);
    const recentEnemyDamage = recent.reduce((sum, row) => sum + number(row?.damageBySide?.enemy, 0), 0);
    const trend = recentPlayerDamage === recentEnemyDamage
      ? '最近交锋的伤害交换接近'
      : recentPlayerDamage > recentEnemyDamage ? '最近交锋由我方取得更多有效伤害' : '最近交锋由敌方取得更多有效伤害';
    const risks = [];
    playerUnits.forEach(unit => {
      if (/死亡|失去战斗力|昏迷/.test(unit.actionState)) {
        risks.push(`${unit.name}已${unit.actionState}`);
      } else if (unit.hp / Math.max(1, unit.hpMax) <= 0.2 && unit.hp > 0) {
        risks.push(`${unit.name}生命已低于20%`);
      } else if (
        unit.resources.soulMax > 0 &&
        unit.resources.soul / unit.resources.soulMax <= 0.1
      ) {
        risks.push(`${unit.name}魂力接近耗尽`);
      }
    });
    enemyUnits
      .filter(unit => !/死亡|失去战斗力|昏迷/.test(unit.actionState))
      .filter(unit => unit.hp > 0)
      .forEach(unit => {
        risks.push(`敌方仍有可行动威胁：${unit.name}`);
      });
    if (!risks.length) risks.push('当前没有单位进入明确生命或魂力危机');
    const tacticalWindows = [];
    [...playerUnits, ...enemyUnits].forEach(unit => {
      if (unit.states.length) tacticalWindows.push(`${unit.name}仍受${unit.states.join('、')}影响`);
    });
    summons.filter(unit => unit.remainingWindows > 0).forEach(unit => tacticalWindows.push(`${unit.name}仍有${unit.remainingWindows}个召唤窗口`));
    if (!tacticalWindows.length) tacticalWindows.push('当前没有已公开的持续状态或召唤窗口');
    const decisions = Array.isArray(draft?.decisionAudit) ? draft.decisionAudit : [];
    const nextIntents = {
      player: latestSideIntent(decisions, playerUnits, directory, terminal, 'player'),
      enemy: latestSideIntent(decisions, enemyUnits, directory, terminal, 'enemy'),
    };
    const terminalDetail = terminalConditionText(terminal);
    const formatUnit = unit => `${unit.name} HP ${unit.hp}/${unit.hpMax}，魂力 ${unit.resources.soul}/${unit.resources.soulMax}，体力 ${unit.resources.stamina}/${unit.resources.staminaMax}，精神力 ${unit.resources.spirit}/${unit.resources.spiritMax}${unit.actionState && unit.actionState !== '战斗' ? `，行动状态：${unit.actionState}` : ''}${unit.states.length ? `，状态：${unit.states.join('、')}` : ''}`;
    const textSummary = [
      `战至第${number(draft?.actualRoundCount, 0)}回合，${terminalText(terminal)}${terminalDetail ? `，终局条件：${terminalDetail}` : ''}。`,
      `我方：${playerUnits.map(formatUnit).join('；') || '无可用单位'}。`,
      `敌方：${enemyUnits.map(formatUnit).join('；') || '无可用单位'}。`,
      `战局：${advantage}；${trend}。`,
      `下一意图：我方${nextIntents.player}；敌方${nextIntents.enemy}。`,
      `最大风险：${risks[0]}。`,
    ].join('\n');
    return {
      terminalResult: terminal,
      headline: terminalText(terminal),
      terminalDetail,
      roundCount: number(draft?.actualRoundCount, 0),
      sides: {
        player: { units: playerUnits, metric: playerMetric },
        enemy: { units: enemyUnits, metric: enemyMetric },
      },
      summons,
      advantage,
      trend,
      risks,
      tacticalWindows,
      nextIntents,
      text: textSummary,
    };
  }

  function buildAiSummaryInput(finalSummary = {}, roundOverview = []) {
    const compactUnit = unit => ({
      name: unit.name,
      hp: unit.hp,
      hpMax: unit.hpMax,
      shield: unit.shield,
      resources: cloneValue(unit.resources),
      states: [...unit.states],
      actionState: unit.actionState,
    });
    return {
      terminalResult: cloneValue(finalSummary?.terminalResult || {}),
      actualRoundCount: number(finalSummary?.roundCount, 0),
      sides: {
        player: (finalSummary?.sides?.player?.units || []).map(compactUnit),
        enemy: (finalSummary?.sides?.enemy?.units || []).map(compactUnit),
      },
      summons: (finalSummary?.summons || []).map(unit => ({
        name: unit.name,
        side: unit.side,
        hostName: unit.hostName,
        remainingWindows: unit.remainingWindows,
      })),
      advantage: text(finalSummary?.advantage),
      trend: text(finalSummary?.trend),
      risks: [...(finalSummary?.risks || [])],
      tacticalWindows: [...(finalSummary?.tacticalWindows || [])],
      nextIntents: cloneValue(finalSummary?.nextIntents || {}),
      recentRoundSummaries: roundOverview.slice(-3).map(row => ({ round: row.round, summary: row.summary })),
    };
  }

  function build(input = {}) {
    const sourceDraft = input?.draft && typeof input.draft === 'object' ? input.draft : null;
    if (!sourceDraft || text(sourceDraft?.status) !== 'DRAFT') throw new Error('battle_report_draft_invalid');
    const draftHash = text(sourceDraft?.draftHash);
    const draft = { ...sourceDraft };
    delete draft.draftHash;
    if (!draftHash || runtime.hashBattleValue(draft) !== draftHash) throw new Error('BATTLE_COMMIT_HASH_MISMATCH:draft');
    const visibilityMode = normalizeVisibilityMode(input?.visibilityMode || 'PLAYER');
    const ledger = Array.isArray(draft?.ledger) ? draft.ledger.filter(Boolean) : [];
    const ledgerOrderByFactId = new Map(
      ledger.map((event, index) => [text(event?.eventId), index]),
    );
    const directory = buildEntityDirectory(draft, ledger);
    const actionReferences = buildActionReferenceMap(ledger);
    const factRegistry = ledger.map(event => buildFact(event, visibilityMode, directory, actionReferences));
    const factsById = new Map(factRegistry.map(fact => [fact.factId, fact]));
    const sourceEventsByFactId = new Map(ledger.map(event => [text(event?.eventId), event]));
    const actionStarts = new Map(ledger
      .filter(event => ['action_start', 'charge_start'].includes(text(event?.eventKind)))
      .map(event => [text(event?.actionId), event])
      .filter(([actionId]) => !!actionId));
    const exchangeMap = new Map();
    const roundCanonicalFactIds = new Map();
    const finalCanonicalFactIds = [];
    ledger.forEach(event => {
      const factId = text(event?.eventId);
      const fact = factsById.get(factId);
      if (!fact) return;
      const round = Math.max(0, number(event?.round, 0));
      const kind = text(event?.eventKind);
      if (kind === 'round_summary') {
        const ownerId = `round:${round}`;
        fact.canonicalFactOwner = ownerId;
        if (!roundCanonicalFactIds.has(round)) roundCanonicalFactIds.set(round, []);
        roundCanonicalFactIds.get(round).push(factId);
        return;
      }
      if (kind === 'battle_objective_resolved') {
        fact.canonicalFactOwner = 'final-summary';
        finalCanonicalFactIds.push(factId);
        return;
      }
      if (
        (passiveEventKinds.has(kind) && !isActionScopedOpportunityFact(event)) ||
        text(event?.actionRole) === 'STATE_TICK'
      ) {
        const ownerId = `round:${round}`;
        fact.canonicalFactOwner = ownerId;
        if (!roundCanonicalFactIds.has(round)) roundCanonicalFactIds.set(round, []);
        roundCanonicalFactIds.get(round).push(factId);
        return;
      }
      const eventActionRole = text(event?.actionRole).toUpperCase();
      const rootActionId = eventActionRole === 'ASSIST' && text(event?.actionId)
        ? text(event.actionId)
        : resolveRootActionId(event, actionStarts);
      const publicRootActionId = publicActionReference(rootActionId, actionReferences, visibilityMode);
      const exchangeId = rootActionId
        ? `exchange:${publicRootActionId || `${round}:${exchangeMap.size + 1}`}`
        : `exchange:${kind || 'event'}:${round}:${factId}`;
      if (!exchangeMap.has(exchangeId)) {
        exchangeMap.set(exchangeId, {
          exchangeId,
          round,
          rootActionId: visibilityMode === 'DEVELOPER' ? rootActionId : publicRootActionId,
          actorId: fact.actorId,
          actorName: fact.actorName,
          targetIds: [...fact.targetIds],
          factIds: [],
          action: { name: fact.actionName, role: fact.actionRole },
        });
      }
      exchangeMap.get(exchangeId).factIds.push(factId);
      fact.canonicalFactOwner = exchangeId;
    });
    const exchanges = [...exchangeMap.values()]
      .map(exchange => exchangePresentation(exchange, factsById, directory))
      .sort((left, right) =>
        left.round - right.round ||
        number(ledgerOrderByFactId.get(text(left.factIds[0])), Number.MAX_SAFE_INTEGER) -
          number(ledgerOrderByFactId.get(text(right.factIds[0])), Number.MAX_SAFE_INTEGER)
      );
    const roundOverview = buildRoundOverview(draft, ledger, factsById, exchanges, directory);
    roundOverview.forEach(row => {
      row.canonicalFactIds = roundCanonicalFactIds.get(row.round) || [];
    });
    const adjudications = buildAdjudications(
      draft,
      exchanges,
      factsById,
      directory,
      visibilityMode,
      sourceEventsByFactId,
    );
    const sourceDecisionCount = Array.isArray(draft?.decisionAudit) ? draft.decisionAudit.length : 0;
    const projectedDecisionCount = adjudications.length;
    const adjudicationsByExchange = new Map();
    adjudications.forEach(item => {
      if (!adjudicationsByExchange.has(item.exchangeId)) adjudicationsByExchange.set(item.exchangeId, []);
      adjudicationsByExchange.get(item.exchangeId).push(item);
    });
    exchanges.forEach(exchange => {
      const related = adjudicationsByExchange.get(exchange.exchangeId) || [];
      const primary = related.find(item =>
        text(item.actionRole).toUpperCase() === 'ACTIVE' &&
        text(item.actorId) === text(exchange.actorId)
      ) || related[0] || null;
      exchange.adjudicationIds = related.map(item => item.adjudicationId);
      exchange.adjudicationId = primary?.adjudicationId || '';
      exchange.intentSummary = primary?.intentSummary || '';
    });
    const clashGroups = buildClashGroups(exchanges, factsById);
    const finalSummary = buildFinalSummary(draft, roundOverview, directory);
    finalSummary.canonicalFactIds = finalCanonicalFactIds;
    const aiSummaryInput = buildAiSummaryInput(finalSummary, roundOverview);
    factRegistry.forEach(fact => {
      fact.projectionRefs.push({ ownerId: fact.canonicalFactOwner, projection: 'DETAIL' });
      const roundId = `round:${fact.round}`;
      if (fact.canonicalFactOwner !== roundId) fact.projectionRefs.push({ ownerId: roundId, projection: 'ROUND_REFERENCE' });
      if (fact.canonicalFactOwner !== 'final-summary') fact.projectionRefs.push({ ownerId: 'final-summary', projection: 'SUMMARY_REFERENCE' });
    });
    clashGroups.forEach(clash => {
      clash.factIds.forEach(factId => {
        const fact = factsById.get(factId);
        if (fact) fact.projectionRefs.push({ ownerId: clash.clashId, projection: 'CLASH_REFERENCE' });
      });
    });
    return {
      schemaVersion: reportSchemaVersion,
      visibilityMode,
      actualRoundCount: Math.max(0, number(draft?.actualRoundCount, 0)),
      terminalResult: projectTerminalResult(draft?.terminalResult || {}, visibilityMode, directory),
      projectionStatus: 'PENDING',
      sourceDecisionCount,
      projectedDecisionCount,
      sourceDraftHash: draftHash,
      sourceLedgerCount: ledger.length,
      factRegistry,
      roundOverview,
      exchanges,
      clashGroups,
      adjudications,
      finalSummary,
      aiSummaryInput,
    };
  }

  function auditProjection(reportDto = {}) {
    const report = reportDto && typeof reportDto === 'object' ? { ...reportDto } : {};
    const fatals = [];
    const pushFatal = (code, detail = {}) => fatals.push({ code, ...detail });
    const projectionDirectory = new Map();
    const registry = Array.isArray(report?.factRegistry) ? report.factRegistry : [];
    const factsById = new Map();
    registry.forEach((fact, index) => {
      const factId = text(fact?.factId);
      if (!factId) {
        pushFatal('REPORT_FACT_MISSING', { index, reason: 'FACT_ID_MISSING' });
        return;
      }
      if (factsById.has(factId)) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', { factId, reason: 'FACT_REGISTERED_TWICE' });
        return;
      }
      factsById.set(factId, fact);
      (Array.isArray(fact?.numericTokens) ? fact.numericTokens : []).forEach((token, tokenIndex) => {
        if (
          !Number.isFinite(Number(token?.value)) ||
          text(token?.sourceEventId) !== factId ||
          text(token?.sourceFactId) !== factId
        ) {
          pushFatal('REPORT_NUMBER_SOURCE_MISSING', { factId, tokenIndex });
        }
      });
      if (report?.visibilityMode === 'PLAYER' && fact?.developerDetail !== undefined) {
        pushFatal('REPORT_VISIBILITY_LEAK', { factId, reason: 'DEVELOPER_DETAIL_IN_PLAYER_REPORT' });
      }
    });
    if (number(report?.sourceLedgerCount, registry.length) !== registry.length) {
      pushFatal('REPORT_FACT_MISSING', {
        reason: 'LEDGER_FACT_COUNT_MISMATCH',
        sourceLedgerCount: number(report?.sourceLedgerCount, 0),
        factCount: registry.length,
      });
    }
    if (
      Number.isFinite(Number(report?.sourceDecisionCount)) &&
      Number.isFinite(Number(report?.projectedDecisionCount)) &&
      Number(report.sourceDecisionCount) !== Number(report.projectedDecisionCount)
    ) {
      pushFatal('DECISION_ADJUDICATION_MISSING', {
        sourceDecisionCount: Number(report.sourceDecisionCount),
        projectedDecisionCount: Number(report.projectedDecisionCount),
      });
    }
    const actualRounds = (Array.isArray(report?.roundOverview) ? report.roundOverview : []).map(row => number(row?.round, 0));
    const registryRounds = [...new Set(
      registry
        .map(fact => Math.max(0, number(fact?.round, 0)))
        .filter(round => round > 0),
    )].sort((left, right) => left - right);
    const expectedRounds = registryRounds.length
      ? registryRounds
      : Array.from({ length: Math.max(0, number(report?.actualRoundCount, 0)) }, (_, index) => index + 1);
    const expectedCount = Math.max(0, number(report?.actualRoundCount, 0));
    const contiguousRounds = expectedRounds.length === 0 ||
      expectedRounds.every((round, index) => index === 0 || round === expectedRounds[index - 1] + 1);
    if (
      JSON.stringify(expectedRounds) !== JSON.stringify(actualRounds) ||
      actualRounds.length !== expectedCount ||
      !contiguousRounds
    ) {
      pushFatal('ROUND_SUMMARY_MISSING', { expectedRounds, actualRounds });
    }
    const ownerRefs = new Map();
    const registerOwner = (ownerId, factId) => {
      const normalizedOwnerId = text(ownerId);
      const normalizedFactId = text(factId);
      if (!factsById.has(normalizedFactId)) {
        pushFatal('REPORT_FACT_INVENTED', { ownerId: normalizedOwnerId, factId: normalizedFactId });
        return;
      }
      if (!ownerRefs.has(normalizedFactId)) ownerRefs.set(normalizedFactId, []);
      ownerRefs.get(normalizedFactId).push(normalizedOwnerId);
    };
    (Array.isArray(report?.exchanges) ? report.exchanges : []).forEach(exchange => {
      (Array.isArray(exchange?.factIds) ? exchange.factIds : []).forEach(factId => registerOwner(exchange?.exchangeId, factId));
      const exchangeFactIds = new Set(Array.isArray(exchange?.factIds) ? exchange.factIds.map(text) : []);
      const targetGroups = Array.isArray(exchange?.targetGroups) ? exchange.targetGroups : [];
      const sharedFactIds = new Set(
        (Array.isArray(exchange?.sharedFactIds) ? exchange.sharedFactIds : []).map(text).filter(Boolean),
      );
      const targetGroupIds = new Set();
      const targetGroupFactOwners = new Map();
      targetGroups.forEach((group, groupIndex) => {
        const targetId = text(group?.targetId);
        const targetName = text(group?.targetName);
        const targetKey = targetId || targetName;
        if (!targetKey || targetGroupIds.has(targetKey)) {
          pushFatal('REPORT_FACT_OWNER_CONFLICT', {
            exchangeId: exchange?.exchangeId,
            reason: 'TARGET_GROUP_DUPLICATE',
            groupIndex,
            targetId,
            targetName,
          });
        } else {
          targetGroupIds.add(targetKey);
        }
        const groupFactIds = Array.isArray(group?.factIds) ? group.factIds.map(text).filter(Boolean) : [];
        const seenInGroup = new Set();
        groupFactIds.forEach(factId => {
          if (!exchangeFactIds.has(factId)) {
            pushFatal('REPORT_FACT_INVENTED', {
              exchangeId: exchange?.exchangeId,
              reason: 'TARGET_GROUP_FACT_OUTSIDE_EXCHANGE',
              factId,
            });
            return;
          }
          if (seenInGroup.has(factId)) {
            pushFatal('REPORT_FACT_OWNER_CONFLICT', {
              exchangeId: exchange?.exchangeId,
              reason: 'TARGET_GROUP_FACT_DUPLICATE',
              factId,
            });
            return;
          }
          seenInGroup.add(factId);
          const owners = targetGroupFactOwners.get(factId) || [];
          owners.push(targetKey);
          targetGroupFactOwners.set(factId, owners);
          const fact = factsById.get(factId);
          const actorIsTarget = targetGroups.some(targetGroup =>
            factActorBelongsToTarget(projectionDirectory, fact, targetGroup)
          );
          const responseOwnedByActor =
            responseEventKinds.has(text(fact?.eventKind)) &&
              (text(fact?.eventKind) !== 'reaction_window' || actorIsTarget) ||
            ['REACTION', 'COUNTER'].includes(text(fact?.actionRole).toUpperCase()) &&
              (text(fact?.eventKind) !== 'reaction_window' || actorIsTarget) ||
            ['summon_create', 'summon_end'].includes(text(fact?.eventKind)) &&
              text(fact?.actorId) !== text(exchange?.actorId);
          if (Array.isArray(fact?.targetIds) && fact.targetIds.length > 1 && !responseOwnedByActor) {
            if (!sharedFactIds.has(factId)) {
              pushFatal('REPORT_FACT_MISSING', {
                exchangeId: exchange?.exchangeId,
                reason: 'MULTI_TARGET_SHARED_FACT_NOT_REGISTERED',
                factId,
              });
            } else {
              pushFatal('REPORT_FACT_OWNER_CONFLICT', {
                exchangeId: exchange?.exchangeId,
                reason: 'MULTI_TARGET_SHARED_FACT_IN_TARGET_GROUP',
                factId,
              });
            }
            return;
          }
          const directOwners = targetGroups.filter(targetGroup =>
            responseOwnedByActor
              ? factActorBelongsToTarget(projectionDirectory, fact, targetGroup)
              : factDirectlyBelongsToTarget(fact, targetGroup)
          );
          const targetMatches = directOwners.length
            ? directOwners.some(targetGroup =>
                text(targetGroup?.targetId) === targetId &&
                text(targetGroup?.targetName) === targetName
              )
            : responseOwnedByActor
            ? factActorBelongsToTarget(
                projectionDirectory,
                fact,
                { targetId, targetName },
              )
            : factBelongsToTarget(
                projectionDirectory,
                fact,
                { targetId, targetName },
              );
          if (!targetMatches) {
            pushFatal('REPORT_FACT_OWNER_CONFLICT', {
              exchangeId: exchange?.exchangeId,
              reason: 'TARGET_GROUP_TARGET_MISMATCH',
              factId,
              targetId,
              targetName,
              factTargetIds: unique(fact?.targetIds || []),
              factTargetName: text(fact?.targetName),
            });
          }
        });
      });
      targetGroupFactOwners.forEach((owners, factId) => {
        if (owners.length > 1) {
          pushFatal('REPORT_FACT_OWNER_CONFLICT', {
            exchangeId: exchange?.exchangeId,
            reason: 'TARGET_GROUP_FACT_CROSS_CONTAMINATION',
            factId,
            owners,
          });
        }
      });
      if (targetGroups.length > 1) {
        const groupedFactIds = new Set(targetGroupFactOwners.keys());
        [...exchangeFactIds]
          .map(factId => factsById.get(factId))
          .filter(fact =>
            fact &&
            !['action_start', 'charge_start'].includes(text(fact?.eventKind)) &&
            Array.isArray(fact?.targetIds) &&
            fact.targetIds.length === 1 &&
            fact.targetIds[0] !== text(exchange?.actorId) &&
            !sharedFactIds.has(fact.factId) &&
            !['round_summary', 'resource_change', 'round_recover', 'action_cost'].includes(text(fact?.eventKind)),
          )
          .forEach(fact => {
            if (!groupedFactIds.has(fact.factId)) {
              pushFatal('REPORT_FACT_MISSING', {
                exchangeId: exchange?.exchangeId,
                reason: 'TARGET_GROUP_FACT_UNGROUPED',
                factId: fact.factId,
                targetId: fact.targetIds[0],
              });
            }
        });
      }
    });
    const exchangeById = new Map(
      (Array.isArray(report?.exchanges) ? report.exchanges : [])
        .map(exchange => [text(exchange?.exchangeId), exchange])
        .filter(([exchangeId]) => !!exchangeId),
    );
    const clashCountByExchange = new Map();
    (Array.isArray(report?.clashGroups) ? report.clashGroups : []).forEach((clash, clashIndex) => {
      const clashId = text(clash?.clashId);
      const clashRound = number(clash?.round, 0);
      const exchangeIds = unique(
        (Array.isArray(clash?.exchangeIds) ? clash.exchangeIds : [])
          .map(text)
          .filter(Boolean),
      );
      if (!clashId || !exchangeIds.length || !text(clash?.text)) {
        pushFatal('REPORT_FACT_MISSING', {
          reason: 'CLASH_GROUP_INCOMPLETE',
          clashIndex,
          clashId,
        });
      }
      const allowedFactIds = new Set();
      exchangeIds.forEach(exchangeId => {
        const exchange = exchangeById.get(exchangeId);
        if (!exchange) {
          pushFatal('REPORT_FACT_INVENTED', {
            reason: 'CLASH_EXCHANGE_MISSING',
            clashId,
            exchangeId,
          });
          return;
        }
        if (number(exchange?.round, 0) !== clashRound) {
          pushFatal('REPORT_FACT_OWNER_CONFLICT', {
            reason: 'CLASH_CROSSES_ROUND',
            clashId,
            exchangeId,
            clashRound,
            exchangeRound: number(exchange?.round, 0),
          });
        }
        clashCountByExchange.set(exchangeId, (clashCountByExchange.get(exchangeId) || 0) + 1);
        (Array.isArray(exchange?.factIds) ? exchange.factIds : []).forEach(factId =>
          allowedFactIds.add(text(factId))
        );
      });
      (Array.isArray(clash?.factIds) ? clash.factIds : []).map(text).filter(Boolean).forEach(factId => {
        if (!factsById.has(factId) || !allowedFactIds.has(factId)) {
          pushFatal('REPORT_FACT_INVENTED', {
            reason: 'CLASH_FACT_OUTSIDE_EXCHANGE',
            clashId,
            factId,
          });
        }
      });
    });
    exchangeById.forEach((exchange, exchangeId) => {
      if (clashCountByExchange.get(exchangeId) !== 1) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', {
          reason: 'EXCHANGE_CLASH_MEMBERSHIP_INVALID',
          exchangeId,
          count: clashCountByExchange.get(exchangeId) || 0,
        });
      }
    });
    (Array.isArray(report?.roundOverview) ? report.roundOverview : []).forEach(round => {
      (Array.isArray(round?.canonicalFactIds) ? round.canonicalFactIds : []).forEach(factId => registerOwner(`round:${number(round?.round, 0)}`, factId));
      (Array.isArray(round?.factIds) ? round.factIds : []).forEach(factId => {
        if (!factsById.has(text(factId))) pushFatal('REPORT_FACT_INVENTED', { ownerId: `round:${round?.round}`, factId });
      });
    });
    (Array.isArray(report?.finalSummary?.canonicalFactIds) ? report.finalSummary.canonicalFactIds : [])
      .forEach(factId => registerOwner('final-summary', factId));
    factsById.forEach((fact, factId) => {
      const owners = ownerRefs.get(factId) || [];
      const canonicalOwner = text(fact?.canonicalFactOwner);
      if (owners.length === 0) {
        pushFatal('REPORT_FACT_MISSING', { factId, reason: 'DETAILED_OWNER_MISSING' });
      } else if (owners.length !== 1 || owners[0] !== canonicalOwner) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', { factId, canonicalOwner, owners });
      }
      const detailRefs = (Array.isArray(fact?.projectionRefs) ? fact.projectionRefs : [])
        .filter(ref => text(ref?.projection) === 'DETAIL');
      if (detailRefs.length !== 1 || text(detailRefs[0]?.ownerId) !== canonicalOwner) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', { factId, reason: 'DETAIL_REFERENCE_INVALID' });
      }
    });
    if (report?.visibilityMode === 'PLAYER') {
      const serialized = JSON.stringify(report);
      if (internalSummonIdPattern.test(serialized)) {
        pushFatal('REPORT_VISIBILITY_LEAK', { reason: 'INTERNAL_SUMMON_ID' });
      }
      if (/"ruleCode"|"developerDetail"|"rawDecision"|"candidateId"/.test(serialized)) {
        pushFatal('PLAYER_INTERNAL_RESULT_LEAK', { reason: 'INTERNAL_DECISION_OR_RULE_DATA' });
      }
      const projectedText = [
        ...(Array.isArray(report?.clashGroups) ? report.clashGroups : []).flatMap(clash => [
          clash?.text,
          clash?.intentSummary,
          clash?.actionSummary,
          clash?.responseSummary,
          clash?.resultSummary,
          clash?.continuationSummary,
        ]),
        ...(Array.isArray(report?.exchanges) ? report.exchanges : []).flatMap(exchange => [
          exchange?.text,
          exchange?.responseSummary,
          exchange?.resultSummary,
          exchange?.continuationSummary,
        ]),
        ...(Array.isArray(report?.adjudications) ? report.adjudications : []).flatMap(adjudication => [
          adjudication?.reasonSummary,
          adjudication?.actual?.resultSummary,
        ]),
      ].map(text).join('\n');
      if (/\b(?:PENDING|DECLARED|SUCCESS|FAILURE|FAILED|ABORTED|BLOCKED|LOST|COMPLETED|NO_EFFECT|RESISTED|IMMUNE)\b/.test(projectedText)) {
        pushFatal('PLAYER_INTERNAL_RESULT_LEAK', { reason: 'UNRESOLVED_RESULT_STATE' });
      }
      if (/\b(?:CONTROLLED|INCAPACITATED|UNAVAILABLE):/i.test(projectedText)) {
        pushFatal('PLAYER_INTERNAL_RESULT_LEAK', { reason: 'RAW_INCAPACITY_REASON' });
      }
    }
    const aiSerialized = JSON.stringify(report?.aiSummaryInput || {});
    if (/scoreAudit|candidateId|ruleCode|formulaTrace|normalizedUtility|objectiveUtility|rawDecision/i.test(aiSerialized)) {
      pushFatal('AI_SUMMARY_INTERNAL_DATA_LEAK');
    }
    report.projectionStatus = fatals.length ? 'FAILED' : 'PASSED';
    const reportHash = runtime.hashBattleValue(report);
    return {
      passed: fatals.length === 0,
      fatalCount: fatals.length,
      fatals,
      reportHash,
      reportDto: report,
    };
  }

  function serializeFullText(reportDto = {}) {
    const lines = ['回合速览'];
    (Array.isArray(reportDto?.roundOverview) ? reportDto.roundOverview : []).forEach(round => {
      lines.push(`回合 ${number(round?.round, 0)}：${text(round?.summary) || '已完成'}`);
      if (text(round?.passiveSummary)) lines.push(`回合 ${number(round?.round, 0)} 收束：${round.passiveSummary}`);
    });
    lines.push('', '动作组战报');
    const clashGroups = Array.isArray(reportDto?.clashGroups) ? reportDto.clashGroups : [];
    if (clashGroups.length) {
      const clashIndexByRound = new Map();
      clashGroups.forEach(clash => {
        const round = number(clash?.round, 0);
        const index = (clashIndexByRound.get(round) || 0) + 1;
        clashIndexByRound.set(round, index);
        lines.push(`第${round}回合 · 交锋${index}：${text(clash?.text) || '交锋已记录'}`);
      });
    } else {
      (Array.isArray(reportDto?.exchanges) ? reportDto.exchanges : []).forEach(exchange => {
        const targetGroups = Array.isArray(exchange?.targetGroups) ? exchange.targetGroups : [];
        if (targetGroups.length > 1) {
          lines.push(`第${number(exchange?.round, 0)}回合 · ${text(exchange?.action?.summary) || '交锋已记录'}`);
          targetGroups.forEach(group => {
            lines.push(`  ${text(group?.targetName) || '目标'}：${text(group?.text) || '未产生可见结果'}`);
          });
        } else {
          lines.push(`第${number(exchange?.round, 0)}回合 · ${text(exchange?.text) || '交锋已记录'}`);
        }
      });
    }
    lines.push('', '判定明细');
    (Array.isArray(reportDto?.adjudications) ? reportDto.adjudications : []).forEach(item => {
      const alternatives = (Array.isArray(item?.alternatives) ? item.alternatives : []).map(candidateDisplayLabel).join('、') || '无';
      lines.push(`第${number(item?.round, 0)}回合 · ${item.actorName}选择${candidateDisplayLabel(item?.selected)}；替代：${alternatives}。${item.reasonSummary}`);
      if (item?.actual?.resultSummary) lines.push(`实际结果：${item.actual.resultSummary}`);
    });
    lines.push('', '总结型战报', text(reportDto?.finalSummary?.text));
    return lines.filter((line, index, all) => line || (index > 0 && all[index - 1])).join('\n').trim();
  }

  root.__LWCS_BATTLE_REPORT__ = Object.freeze({
    version: reportSchemaVersion,
    visibilityModes,
    build,
    auditProjection,
    candidateDisplayLabel,
    serializeFullText,
  });
})();

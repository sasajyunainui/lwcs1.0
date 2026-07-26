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
    PASS_OPPORTUNITY: '让过行动',
    FUSION_SKILL: '武魂融合技',
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
    /* 运行时会把 PASS_OPPORTUNITY 这类动作枚举原样写进 actionName。
       映射只能做在叙述层：fact.actionName 是 findDecisionAnchor 的匹配键，改动它会破坏决策匹配。 */
    const rawActionName = text(event?.actionName || event?.finalActionName || kind);
    const action = playerSafeText(actionKindLabels[rawActionName] || rawActionName, directory) || '行动';
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
      /* 目标即自己的动作（让过、防御、观察等）不能写成"指向自己"，那是逻辑错误。 */
      return target && target !== actor
        ? `${actor}使用【${action}】指向${target}`
        : `${actor}采取【${action}】`;
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
      /* 原文"将本次伤害压至X%"有三重歧义：压到还是压掉、基数是什么、是系数还是实际结果。
         防御事件写在伤害结算之前，这里的倍率是姿态系数（后续若命中才会应用），
         必须把"减免比例"和"这是姿态而非已结算"都说清楚。 */
      const mitigation = Number.isFinite(damageMultiplier) && damageMultiplier >= 0 && damageMultiplier <= 1
        ? `，姿态可将后续承受的伤害减免${Math.round((1 - damageMultiplier) * 1000) / 10}%`
        : '，防御姿态已建立';
      return target && target !== actor
        ? `${actor}以【${action}】应对${target}的攻势${mitigation}`
        : `${actor}进入【${action}】姿态${mitigation}`;
    }
    if (kind === 'reaction_window') return `${actor}的即时反应机会${/FAILURE|unavailable/i.test(text(event?.resultState || event?.result)) ? '不可用' : '已建立'}`;
    if (kind === 'counter_window') {
      const opened = !/FAILURE|missed/i.test(text(event?.resultState || event?.result));
      /* "未能成立"不说原因，AI 与玩家都无法理解。反击窗口是概率判定，
         probability/roll 都在 meta 里，如实给出成功率与判定结果即可，不需要编原因。 */
      const probability = number(meta?.probability, NaN);
      const chance = Number.isFinite(probability) && probability > 0 && probability <= 1
        ? `（触发概率${Math.round(probability * 1000) / 10}%）`
        : '';
      const source = target && target !== actor ? `对${target}的` : '';
      return opened
        ? `${actor}${source ? `获得${source}反击机会` : '获得反击机会'}${chance}`
        : `${actor}未能抓住${source || ''}反击机会${chance}，判定未通过`;
    }
    if (kind === 'counter') return /declined|放弃/i.test(`${event?.result} ${action}`)
      ? `${actor}放弃对${target || '来源攻击者'}的反击`
      : `${actor}以【${action}】反击${target || '来源攻击者'}`;
    if (kind === 'hit_result') {
      if (damage > 0) {
        /* "造成N点伤害"没说 N 是最终扣血还是原始伤害。运行时会经
           防御倍率 → 护盾吸收 → 非致命钳制 三级折减，折减量必须一并交代，
           否则 AI 无法判断这一击到底打得重不重。 */
        const rawDamage = number(meta?.rawDamage, NaN);
        const shieldAbsorb = number(meta?.shieldAbsorb, 0);
        const reductions = [];
        if (Number.isFinite(rawDamage) && rawDamage > damage + shieldAbsorb + 0.5) {
          reductions.push(`原始伤害${Math.round(rawDamage)}点经防御与减伤后落到${damage}点`);
        }
        if (shieldAbsorb > 0) reductions.push(`护盾另吸收${Math.round(shieldAbsorb)}点`);
        if (meta?.intentLethalPrevented === true) reductions.push('因非致命意图未击杀目标');
        return `${actor}以【${action}】命中${target || '目标'}，实际扣减${damage}点生命`
          + (reductions.length ? `（${reductions.join('；')}）` : '');
      }
      if (/miss/i.test(text(event?.result))) {
        /* 未命中事件的 meta 不带 damageType（只有命中分支才写），
           所以无法判断是近身还是远程——不能沿用"落点偏离"这种暗示投射物的措辞，
           那会让 AI 把近身攻击写成投掷。改用不预设攻击方式的中性表述。
           primaryOutcome 能区分"被闪避"与"单纯没打中"，这一点是可靠的。 */
        const dodged = text(meta?.primaryOutcome) === 'dodged' ||
          text(event?.primaryOutcome) === 'dodged';
        return dodged
          ? `${actor}的【${action}】被${target || '目标'}闪开`
          : `${actor}的【${action}】未能命中${target || '目标'}`;
      }
      if (number(meta?.shieldAbsorb, 0) > 0) {
        return `${actor}的【${action}】命中${target || '目标'}，伤害被护盾完全吸收${Math.round(number(meta.shieldAbsorb, 0))}点`;
      }
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
      const receiver = target || actor;
      /* "获得【失去战斗力】"是自相矛盾的措辞。状态有正负之分，
         对己方增益用"获得"，对敌方减益用"陷入"，都由施加方与承受方是否同阵营决定。 */
      const selfBuff = receiver === actor;
      const verb = selfBuff ? '获得' : '陷入';
      if (['失败', '被抵抗', '免疫', '已阻断'].includes(outcome)) {
        return `${actor}试图用【${action}】让${receiver}${verb}【${namedState || '状态'}】，但${outcome}`;
      }
      return `${actor}用【${action}】让${receiver}${verb}【${namedState || '状态'}】${duration > 0 ? `，持续${duration}回合` : ''}`;
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
    /* 兜底句原本是"完成【X】结算，结果为成功"这种纯日志腔，
       而且对"让过行动"这类不存在失败的动作，"结果为成功"会让人以为它可能失败。
       成功时直接陈述动作本身，只有非成功结果才需要点出结果。 */
    const 指向 = target && target !== actor ? `对${target}` : '';
    return ['成功', '已完成', '已生效'].includes(result)
      ? `${actor}${指向}使出【${action}】`
      : `${actor}${指向}使出【${action}】，${result}`;
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

  /*
   * 预测/实际对账层（链路无关）
   *
   * 预测侧来自决策阶段的机械预演（BattlePreview 经 BattleDecision 投影进 draft.decisionAudit），
   * 实际侧来自 Runtime 写出的 ledger 事实。两者是各自独立实现的结算代码，中间还隔着随机数，
   * 因此"对不上"有三种性质完全不同的原因，必须分开表达：
   *   CONFIRMED   预测的效果有对应成功事实           → 战报可写成已发生
   *   MISSED      有对应的失败事实（未命中/被抵抗）   → 战报可写成明确没发生
   *   PREEMPTED   行动本身没执行（失机/被阻断）       → 战报可写成没来得及
   *   UNCONFIRMED 既无成功事实也无失败事实，查无此事  → 战报一个字都不能写
   * 前三种都是有据可依的结果；只有 UNCONFIRMED 是真问题，它同时也是
   * "预演与运行时两套结算代码分叉"的检出信号。
   */
  const reconciliationResourceNames = Object.freeze({
    sp: '魂力',
    men: '精神力',
    vit: '体力',
    hp: '生命',
  });
  const preemptionEventKinds = Object.freeze(['lost_opportunity', 'blocked_action', 'target_fail']);
  const controlDenialReasonPattern = /^(?:CONTROLLED|UNCONSCIOUS|INCAPACITATED|SUBDUED|DEAD)/i;

  function rawMeta(event = {}) {
    return event && typeof event.meta === 'object' && event.meta ? event.meta : {};
  }

  function rawEventTargets(event = {}) {
    return unique([
      ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
      event?.targetId,
    ]).map(text).filter(Boolean);
  }

  function rawEventHitsTarget(event = {}, targetId = '') {
    const wanted = text(targetId);
    if (!wanted) return true;
    const ids = rawEventTargets(event);
    if (ids.includes(wanted)) return true;
    return text(event?.targetName) === wanted;
  }

  function rawEventKindIs(event = {}, ...kinds) {
    return kinds.includes(text(event?.eventKind));
  }

  /* 黄金锚点：effect_resolved 原样携带预演 contribution 的 effectInstanceId + windowId + outcomeKind，
     与预测项可精确 1:1 join；其余事件类型退化为 targetId 匹配。 */
  function matchesEffectInstance(event = {}, effectInstanceId = '') {
    const wanted = text(effectInstanceId);
    if (!wanted) return false;
    return text(rawMeta(event).effectInstanceId) === wanted;
  }

  function collectPredictedOutcomes(decision = {}) {
    const selected = decision?.selected || {};
    const predictions = [];
    const push = entry => {
      if (!entry) return;
      predictions.push({
        ...entry,
        predictionId: `prediction:${predictions.length + 1}:${entry.kind}`,
      });
    };

    (Array.isArray(selected?.predictedOutcomeEvidence) ? selected.predictedOutcomeEvidence : [])
      .forEach(evidence => {
        const kind = text(evidence?.outcomeKind).toUpperCase();
        const targetId = text(evidence?.targetId);
        if (!kind || !targetId) return;
        const delta = Number(evidence?.expectedDelta);
        push({
          kind,
          source: 'PREDICTED_OUTCOME',
          targetId,
          effectInstanceId: text(evidence?.sourceEffectId),
          windowId: text(evidence?.windowId),
          expected: {
            delta: Number.isFinite(delta) ? delta : null,
            stateName: text(evidence?.evidence?.stateName || evidence?.evidence?.state),
            duration: Number.isFinite(Number(evidence?.evidence?.duration))
              ? Number(evidence.evidence.duration)
              : null,
            hitProbability: Number.isFinite(Number(evidence?.hitProbability))
              ? Number(evidence.hitProbability)
              : null,
          },
        });
      });

    /* healthTrajectory 是唯一带 SCHEDULED_HP_DELTA（持续伤害/治疗）的预测源，
       predictedOutcomeEvidence 的白名单会把这类整条丢弃，所以必须单独收。 */
    (Array.isArray(decision?.healthTrajectory) ? decision.healthTrajectory : [])
      .filter(row => text(row?.outcomeKind).toUpperCase() === 'SCHEDULED_HP_DELTA')
      .forEach(row => {
        const targetId = text(row?.targetId);
        if (!targetId) return;
        push({
          kind: 'SCHEDULED_HP_DELTA',
          source: 'HEALTH_TRAJECTORY',
          targetId,
          effectInstanceId: text(row?.sourceEffectInstanceId),
          windowId: text(row?.windowId),
          expected: {
            healthDeltaPP: Number.isFinite(Number(row?.healthDeltaPP)) ? Number(row.healthDeltaPP) : null,
            tickIndex: Number.isFinite(Number(row?.tickIndex)) ? Number(row.tickIndex) : null,
            tickCount: Number.isFinite(Number(row?.tickCount)) ? Number(row.tickCount) : null,
          },
        });
      });

    (Array.isArray(decision?.resourceTimelineSummary?.payments)
      ? decision.resourceTimelineSummary.payments
      : []).forEach(payment => {
        const resource = text(payment?.resource);
        const amount = Number(payment?.amount);
        if (!resource || !Number.isFinite(amount) || amount <= 0) return;
        push({
          kind: 'PAYMENT',
          source: 'RESOURCE_TIMELINE',
          targetId: text(payment?.unitId),
          expected: { resource, amount },
        });
      });

    const terminal = decision?.goalProjection?.terminal || {};
    if (terminal?.terminal === true) {
      push({
        kind: 'TERMINAL',
        source: 'GOAL_PROJECTION',
        targetId: '',
        expected: { status: text(terminal?.status) },
      });
    }

    return predictions;
  }

  /*
   * 数值吻合度与效果确认是两件事，必须分开。
   *
   * "命中并造成 160 伤害"是可以写进正文的确认事实（status=CONFIRMED）；
   * "预测 327 实际 160"是必须暴露给开发者的链路偏差（aligned=false）。
   * 混在一起会导致：要么把偏差当正常放过，要么因为数值不准就不敢叙述已经发生的事。
   *
   * 实测发现运行时会在 rawDamage → incomingDamage → appliedDamage 之间做多级折减，
   * 其中防御倍率、护盾吸收、非致命意图钳制都会造成合理差异。这类差异要标注成因，
   * 而不是笼统算作"预测不准"。
   */
  const magnitudeTolerance = 0.25;

  function compareMagnitude(predicted = 0, actual = {}, context = {}) {
    const expectedValue = Math.abs(Number(predicted) || 0);
    const appliedValue = Math.abs(Number(actual?.appliedDamage) || 0);
    if (expectedValue <= 0 && appliedValue <= 0) return null;
    const denominator = Math.max(expectedValue, appliedValue, 1);
    const deviation = Math.abs(expectedValue - appliedValue) / denominator;
    const explanations = [];
    if (actual?.intentLethalPrevented === true) explanations.push('NONLETHAL_INTENT_CLAMP');
    if (Number(actual?.shieldAbsorb || 0) > 0) explanations.push('SHIELD_ABSORB');
    if (Number(actual?.defenseMultiplier ?? 1) < 1) explanations.push('DEFENSE_REDUCTION');

    /* 预演自洽性：伤害预测不可能超过目标当时的剩余生命，超过说明预演侧的生命裁剪没有生效。
       这条检查不依赖运行时结果，是对预演单独成立的硬约束——即使运行时数值恰好吻合，
       预测值本身越界也必须报出来。 */
    const remainingHp = Number(context?.targetRemainingHp);
    const exceedsTargetHp = Number.isFinite(remainingHp) &&
      remainingHp >= 0 &&
      expectedValue > remainingHp + 1e-9;

    /* 预演与运行时的未折减伤害是否同一个模型。两者都是"未经防御/护盾/钳制处理"的量，
       量级差超过一个数量级，说明两套伤害公式已经分叉，钳制类成因解释不了这种差距。 */
    const rawValue = Math.abs(Number(actual?.rawDamage) || 0);
    const rawModelDiverged = expectedValue > 0 && rawValue > 0 &&
      (rawValue / expectedValue > 10 || expectedValue / rawValue > 10);

    return {
      predicted: Number(expectedValue.toFixed(2)),
      applied: Number(appliedValue.toFixed(2)),
      raw: Number(rawValue.toFixed(2)),
      incoming: Number((Number(actual?.incomingDamage) || 0).toFixed(2)),
      targetRemainingHp: Number.isFinite(remainingHp) ? remainingHp : null,
      deviation: Number(deviation.toFixed(4)),
      aligned: deviation <= magnitudeTolerance,
      /* 有成因的差异仍然算偏差，但可解释；无成因的偏差才是预演与运行时分叉的强信号。 */
      explanations,
      exceedsTargetHp,
      rawModelDiverged,
      /* 只要预测越界或未折减模型分叉，无论运行时侧有没有钳制成因，都算未解释——
         钳制能解释"实际为什么变小"，解释不了"预测值本身从哪来"。 */
      unexplained: exceedsTargetHp ||
        rawModelDiverged ||
        (deviation > magnitudeTolerance && explanations.length === 0),
    };
  }

  function judgePrediction(prediction = {}, events = [], context = {}) {
    const kind = text(prediction?.kind).toUpperCase();
    const targetId = text(prediction?.targetId);
    const effectInstanceId = text(prediction?.effectInstanceId);
    const expected = prediction?.expected || {};
    const verdict = (status, factIds = [], actual = null, searched = [], magnitude = null) => ({
      status,
      factIds: unique(factIds.map(text).filter(Boolean)),
      actual,
      searchedEventKinds: searched,
      magnitude,
    });
    const scoped = kinds => events.filter(event =>
      rawEventKindIs(event, ...kinds) &&
      (rawEventHitsTarget(event, targetId) || matchesEffectInstance(event, effectInstanceId))
    );
    const anchored = kinds => {
      const byInstance = events.filter(event =>
        rawEventKindIs(event, ...kinds) && matchesEffectInstance(event, effectInstanceId)
      );
      return byInstance.length ? byInstance : scoped(kinds);
    };
    const preempted = searched => context?.preemptionEvent
      ? verdict('PREEMPTED', [context.preemptionEvent.eventId], {
          reasonCode: text(rawMeta(context.preemptionEvent).reasonCode || context.preemptionEvent?.ruleCode),
        }, searched)
      : verdict('UNCONFIRMED', [], null, searched);

    if (kind === 'HP_DELTA' || kind === 'SCHEDULED_HP_DELTA') {
      const searched = ['hit_result', 'effect_resolved', 'resource_change'];
      const isHealing = Number(expected?.delta) > 0 || Number(expected?.healthDeltaPP) > 0;
      if (isHealing) {
        const heals = scoped(['resource_change', 'effect_resolved']).filter(event =>
          Number(rawMeta(event).delta || 0) > 0 || text(event?.result) === 'resolved'
        );
        if (heals.length) {
          return verdict('CONFIRMED', heals.map(event => event.eventId), {
            delta: heals.reduce((sum, event) => sum + Number(rawMeta(event).delta || 0), 0),
          }, searched);
        }
        return preempted(searched);
      }
      const hits = anchored(['hit_result']);
      /* 一次伤害效果按 segments 拆成多条 hit_result，必须聚合求和后再比，不能逐条比。 */
      const landed = hits.filter(event => Number(rawMeta(event).appliedDamage || 0) > 0);
      if (landed.length) {
        const sumOf = key => landed.reduce((sum, event) => sum + Number(rawMeta(event)[key] || 0), 0);
        const actual = {
          appliedDamage: sumOf('appliedDamage'),
          rawDamage: sumOf('rawDamage'),
          incomingDamage: sumOf('incomingDamage'),
          shieldAbsorb: sumOf('shieldAbsorb'),
          segments: landed.length,
          defenseMultiplier: Number(rawMeta(landed[0]).defenseMultiplier ?? 1),
          intentLethalPrevented: landed.some(event => rawMeta(event).intentLethalPrevented === true),
        };
        return verdict(
          'CONFIRMED',
          landed.map(event => event.eventId),
          actual,
          searched,
          compareMagnitude(Math.abs(Number(expected?.delta || 0)), actual, {
            targetRemainingHp: context?.remainingHpOf ? context.remainingHpOf(targetId) : null,
          }),
        );
      }
      const failed = hits.filter(event => ['miss', 'no_effect'].includes(text(event?.result)));
      if (failed.length) {
        return verdict('MISSED', failed.map(event => event.eventId), {
          primaryOutcome: text(failed[0]?.primaryOutcome),
        }, searched);
      }
      return preempted(searched);
    }

    if (kind === 'SHIELD_DELTA') {
      const searched = ['shield_create', 'shield_break', 'hit_result'];
      const gaining = Number(expected?.delta) > 0;
      if (gaining) {
        const created = scoped(['shield_create']);
        if (created.length) {
          return verdict('CONFIRMED', created.map(event => event.eventId), {
            amount: created.reduce((sum, event) => sum + Number(event?.amount ?? rawMeta(event).amount ?? 0), 0),
          }, searched);
        }
        return preempted(searched);
      }
      const absorbed = events.filter(event =>
        rawEventKindIs(event, 'hit_result') &&
        rawEventHitsTarget(event, targetId) &&
        Number(rawMeta(event).shieldAbsorb || 0) > 0
      );
      const broken = scoped(['shield_break']);
      if (absorbed.length || broken.length) {
        return verdict('CONFIRMED', [...absorbed, ...broken].map(event => event.eventId), {
          shieldAbsorb: absorbed.reduce((sum, event) => sum + Number(rawMeta(event).shieldAbsorb || 0), 0),
        }, searched);
      }
      return preempted(searched);
    }

    if (kind === 'STATE_CHANGED') {
      const searched = ['state_apply'];
      const applies = scoped(['state_apply']).filter(event => {
        const wanted = text(expected?.stateName);
        if (!wanted) return true;
        return text(rawMeta(event).stateName) === wanted;
      });
      const applied = applies.filter(event => text(event?.result) === 'applied');
      if (applied.length) {
        return verdict('CONFIRMED', applied.map(event => event.eventId), {
          stateName: text(rawMeta(applied[0]).stateName),
          duration: Number(rawMeta(applied[0]).duration || 0),
        }, searched);
      }
      const rejected = applies.filter(event =>
        ['resisted', 'immune', 'evaded', 'no_effect'].includes(text(event?.result))
      );
      if (rejected.length) {
        return verdict('MISSED', rejected.map(event => event.eventId), {
          result: text(rejected[0]?.result),
          stateName: text(rawMeta(rejected[0]).stateName),
        }, searched);
      }
      return preempted(searched);
    }

    if (kind === 'ACTION_CANCELLED') {
      const searched = ['charge_interrupt', 'blocked_action', 'lost_opportunity', 'state_apply'];
      /* 取消的是"对方的下一个行动机会"，兑现事实可能落在本次行动之后，
         所以这里接受同一动作树内任何一条取消类事实。 */
      const cancels = events.filter(event =>
        (rawEventKindIs(event, 'charge_interrupt') && rawEventHitsTarget(event, targetId)) ||
        (rawEventKindIs(event, 'blocked_action', 'lost_opportunity') &&
          (rawEventHitsTarget(event, targetId) || text(event?.actorId) === targetId) &&
          controlDenialReasonPattern.test(text(rawMeta(event).reasonCode || event?.ruleCode)))
      );
      if (cancels.length) {
        return verdict('CONFIRMED', cancels.map(event => event.eventId), {
          eventKind: text(cancels[0]?.eventKind),
          ruleCode: text(cancels[0]?.ruleCode),
        }, searched);
      }
      /* 控制没能施加成功 → 取消自然不会发生，这是有据可依的否定而不是查无此事。 */
      const controlRejected = events.filter(event =>
        rawEventKindIs(event, 'state_apply') &&
        rawEventHitsTarget(event, targetId) &&
        ['resisted', 'immune', 'evaded'].includes(text(event?.result))
      );
      if (controlRejected.length) {
        return verdict('MISSED', controlRejected.map(event => event.eventId), {
          result: text(controlRejected[0]?.result),
        }, searched);
      }
      return preempted(searched);
    }

    if (kind === 'SUMMON_WINDOW') {
      const searched = ['summon_create'];
      const created = scoped(['summon_create']);
      if (created.length) {
        return verdict('CONFIRMED', created.map(event => event.eventId), {
          summonName: text(rawMeta(created[0]).summonName),
        }, searched);
      }
      return preempted(searched);
    }

    if (kind === 'RESOURCE_OPTION_CHANGED') {
      const searched = ['resource_change', 'effect_resolved'];
      /* action_cost 是 auditOnly 审计事件，真正扣减在同 actionId 的 resource_change(PAY)，
         这里必须排除它，否则资源变化被双计。 */
      const changes = anchored(['resource_change', 'effect_resolved'])
        .filter(event => rawMeta(event).auditOnly !== true);
      if (changes.length) {
        return verdict('CONFIRMED', changes.map(event => event.eventId), {
          resource: text(rawMeta(changes[0]).resource),
          delta: Number(rawMeta(changes[0]).delta || 0),
        }, searched);
      }
      return preempted(searched);
    }

    if (kind === 'PAYMENT') {
      const searched = ['action_cost'];
      const costs = events.filter(event =>
        rawEventKindIs(event, 'action_cost') &&
        (text(rawMeta(event).resource) === text(expected?.resource) ||
          text(reconciliationResourceNames[text(rawMeta(event).resourceKey)]) === text(expected?.resource))
      );
      if (costs.length) {
        return verdict('CONFIRMED', costs.map(event => event.eventId), {
          resource: text(rawMeta(costs[0]).resource),
          amount: costs.reduce((sum, event) => sum + Number(rawMeta(event).amount || 0), 0),
        }, searched);
      }
      return context?.actionExecuted
        ? verdict('UNCONFIRMED', [], null, searched)
        : preempted(searched);
    }

    if (kind === 'TERMINAL') {
      const searched = ['battle_objective_resolved'];
      const resolved = events.filter(event => rawEventKindIs(event, 'battle_objective_resolved'));
      if (!resolved.length) return verdict('UNCONFIRMED', [], null, searched);
      const actualStatus = text(rawMeta(resolved[0]).status);
      return text(expected?.status) && actualStatus && actualStatus !== text(expected.status)
        ? verdict('MISSED', resolved.map(event => event.eventId), { status: actualStatus }, searched)
        : verdict('CONFIRMED', resolved.map(event => event.eventId), { status: actualStatus }, searched);
    }

    /* 决策内部估值（INCOMING_HEALTH_DELTA / COUNTER_AUTHORIZATION / HEALTH_ROUTE_CHANGED /
       RESPONSE_CONSUMPTION_ACTION_POOL 等）是反事实差分，基线世界从未发生，物理上无法验证，
       不参与对账，也不进战报的事实陈述。 */
    return verdict('UNVERIFIABLE', [], null, []);
  }

  function reconcileDecision(decision = {}, events = [], options = {}) {
    const predictions = collectPredictedOutcomes(decision);
    if (!predictions.length) return [];
    const directory = options?.directory instanceof Map ? options.directory : new Map();
    const remainingHpById = options?.remainingHpById instanceof Map ? options.remainingHpById : null;
    const scopedEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    const context = {
      actionExecuted: scopedEvents.some(event => rawEventKindIs(event, 'action_start')),
      preemptionEvent: scopedEvents.find(event => rawEventKindIs(event, ...preemptionEventKinds)) || null,
      remainingHpOf: unitId => {
        if (!remainingHpById) return null;
        const found = remainingHpById.get(text(unitId));
        return Number.isFinite(Number(found)) ? Number(found) : null;
      },
    };
    return predictions
      .map(prediction => {
        const judged = judgePrediction(prediction, scopedEvents, context);
        if (judged.status === 'UNVERIFIABLE') return null;
        return {
          predictionId: prediction.predictionId,
          kind: prediction.kind,
          source: prediction.source,
          targetId: publicEntityId(directory, prediction.targetId),
          targetName: prediction.targetId
            ? publicEntityName(directory, prediction.targetId, prediction.targetId)
            : '',
          status: judged.status,
          expected: cloneValue(prediction.expected || {}),
          actual: judged.actual ? cloneValue(judged.actual) : null,
          magnitude: judged.magnitude ? cloneValue(judged.magnitude) : null,
          actualFactIds: judged.factIds,
          searchedEventKinds: judged.searchedEventKinds,
        };
      })
      .filter(Boolean);
  }

  function summarizeReconciliation(reconciliation = []) {
    const rows = Array.isArray(reconciliation) ? reconciliation : [];
    const countOf = status => rows.filter(row => text(row?.status) === status).length;
    return {
      total: rows.length,
      confirmed: countOf('CONFIRMED'),
      missed: countOf('MISSED'),
      preempted: countOf('PREEMPTED'),
      unconfirmed: countOf('UNCONFIRMED'),
      /* 效果确认了但数值对不上、且找不到折减成因——预演与运行时结算分叉的检出计数。 */
      magnitudeUnexplained: rows.filter(row => row?.magnitude?.unexplained === true).length,
      predictionExceedsTargetHp: rows.filter(row => row?.magnitude?.exceedsTargetHp === true).length,
      rawDamageModelDiverged: rows.filter(row => row?.magnitude?.rawModelDiverged === true).length,
    };
  }

  /* 从战斗初始快照建立"单位→剩余生命"索引，供对账做预演自洽性检查。
     这是决策发生前的可见生命，与预演侧裁剪所用的基线同源。 */
  function buildRemainingHpIndex(draft = {}) {
    const index = new Map();
    snapshotUnits(draft?.initialSnapshot || {}).forEach(entry => {
      const unit = entry?.unit || {};
      const hp = Number(unit?.hp ?? unit?.HP ?? unit?.属性?.HP);
      if (!Number.isFinite(hp)) return;
      unique([unit?.id, unit?.name, unit?.名称, unit?.unitId])
        .map(text)
        .filter(Boolean)
        .forEach(key => {
          if (!index.has(key)) index.set(key, Math.max(0, hp));
        });
    });
    return index;
  }

  /*
   * 威胁快照（链路无关）
   *
   * "某单位正在蓄力"必须来自真实的 charge_start/charge_progress 事实，不能从决策问题标签反推。
   * naturalActionBudget = 40 是运行时的自然行动预算；剩余前摇 <= 40 表示该蓄力会在下一个
   * 自然行动窗口内打出——这是运行时判定"可见蓄力威胁"和"防守姿态是否值得保留"时用的同一个阈值
   * （BattleRuntime_Module.js:1374-1392 与 :5094-5110），战报沿用它以保证口径一致。
   */
  const naturalActionBudget = 40;
  const chargeOpenEventKinds = Object.freeze(['charge_start', 'charge_progress']);

  function chargeRemainingCastTime(event = {}) {
    const meta = rawMeta(event);
    const candidates = [
      meta.remainingCastTime,
      meta.cast_time,
      meta.castTime,
      event?.castTimePoints,
    ];
    const found = candidates.find(value => Number.isFinite(Number(value)));
    return Number.isFinite(Number(found)) ? Math.max(0, Number(found)) : null;
  }

  function buildThreatContext(events = [], options = {}) {
    const directory = options?.directory || new Map();
    const upToSequence = Number.isFinite(Number(options?.upToSequence))
      ? Number(options.upToSequence)
      : Number.MAX_SAFE_INTEGER;
    const observerId = text(options?.observerId);
    const ordered = (Array.isArray(events) ? events.filter(Boolean) : [])
      .filter(event => number(event?.sequence, 0) < upToSequence)
      .sort((left, right) => number(left?.sequence, 0) - number(right?.sequence, 0));

    /* 蓄力链按 actorId 归并，不按 actionId。
       运行时的蓄力状态存在 unit.蓄力技能 这个单值字段上，所以一个单位同时最多只有一个
       未结算蓄力；而 charge_progress 实测写出的 actionId 是空串（只有 opportunityId 有值），
       按 actionId 归并会整条漏掉。actorId 是这条链上唯一可靠的键。
       charge_start/charge_progress 开链或续链，charge_interrupt 作废，
       同一单位出现 action_start 表示蓄力已兑现。 */
    const chargeByActor = new Map();
    ordered.forEach(event => {
      const kind = text(event?.eventKind);
      const chargeActorId = text(event?.actorId);
      if (!chargeActorId) return;
      if (chargeOpenEventKinds.includes(kind)) {
        chargeByActor.set(chargeActorId, event);
        return;
      }
      if (kind === 'charge_interrupt' || kind === 'action_start') chargeByActor.delete(chargeActorId);
    });

    const pendingCharges = [...chargeByActor.values()].map(event => {
      const remainingCastTime = chargeRemainingCastTime(event);
      const remainingOpportunityCount = Number.isFinite(Number(rawMeta(event).remainingOpportunityCount))
        ? Math.max(0, Number(rawMeta(event).remainingOpportunityCount))
        : null;
      const targetIds = rawEventTargets(event);
      return {
        sourceFactId: text(event?.eventId),
        actorId: publicEntityId(directory, event?.actorId),
        actorName: publicEntityName(directory, event?.actorId, event?.actorName),
        actionName: playerSafeText(event?.actionName || event?.finalActionName, directory),
        remainingCastTime,
        remainingOpportunityCount,
        /* 只有剩余前摇 <= 自然行动预算时，这次蓄力才会在下一个窗口内兑现，
           此前它对当前决策不构成即时威胁。 */
        imminent: Number.isFinite(remainingCastTime) && remainingCastTime <= naturalActionBudget,
        targetIds: targetIds.map(value => publicEntityId(directory, value)).filter(Boolean),
        targetNames: targetIds.map(value => publicEntityName(directory, value, value)).filter(Boolean),
        /* 目标为空的蓄力在运行时语义里等于"威胁全体"，不能当成无目标略过。 */
        targetsObserver: !targetIds.length ||
          (!!observerId && targetIds.includes(observerId)),
      };
    });

    /* 反应/反击窗口：开窗事件出现后，若同 opportunityId 已有 action_start 消费，
       或已出现 lost_opportunity/blocked_action，则该窗口不再开放。 */
    const consumedOpportunityIds = new Set(
      ordered
        .filter(event => rawEventKindIs(event, 'action_start', 'lost_opportunity', 'blocked_action'))
        .map(event => text(event?.opportunityId))
        .filter(Boolean),
    );
    const openWindows = ordered
      .filter(event => rawEventKindIs(event, 'reaction_window', 'counter_window'))
      .filter(event => {
        const opportunityId = text(event?.opportunityId);
        return !opportunityId || !consumedOpportunityIds.has(opportunityId);
      })
      .map(event => ({
        sourceFactId: text(event?.eventId),
        kind: text(event?.eventKind),
        ownerId: publicEntityId(directory, event?.actorId),
        ownerName: publicEntityName(directory, event?.actorId, event?.actorName),
        sourceActorName: publicEntityName(
          directory,
          rawMeta(event).sourceActorId || event?.sourceActorId,
          text(rawMeta(event).sourceActorId || event?.sourceActorId),
        ),
      }));

    return {
      pendingCharges: pendingCharges.filter(charge => charge.imminent || charge.remainingCastTime === null),
      deferredCharges: pendingCharges.filter(charge => !charge.imminent && charge.remainingCastTime !== null),
      openWindows,
    };
  }

  /*
   * 决策链中立契约（B 层）
   *
   * 战报只认这份契约，不认任何具体决策引擎的词汇。契约刻意不含 HEPP/Pareto/temperature 这类
   * 引擎专有概念：narrowing 的阶段名由适配器提供，selectionLabel 是不透明字符串，
   * 战报层不解释它们的语义，只负责如实转述。换引擎时只需新写一个适配器。
   *
   * wasOptimal 是契约里最关键的字段：它把"引擎明知有更高排名的候选却选了别的"
   * （R8 的 SEEDED_SOFTMAX）表达成任何引擎都能回答的布尔量。没有它，战报会把随机抽样
   * 说成"因为它更好"，这是对实际链路最严重的失真。
   */
  /*
   * 排除码说明表。
   *
   * 必须明确：下面三个字段全部是对引擎判定条件的**静态转述**，不是逐次决策的证据提取。
   * draft 里每个候选只带一个 rejectionCode 字符串，判定当时的机会对象、机会列表、
   * 排期事件、资源消耗都没有随之落盘，所以这里不可能给出"这一次为什么"的实证。
   *
   * 由此产生一条硬约束：**转述不得引入判定条件之外的事实断言**。
   * 反例（已修正）：把 ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED 写成"这一刻没有人在攻击他"——
   * 该码判的是本次行动机会的授权类型不属于防御类，实测同一回合对手确实在攻击，
   * 这句转述凭空断言了一个 draft 无法支持、且被 ledger 证伪的世界状态。
   *
   * text    给 AI 与开发者：贴近判定条件本身
   * player  给玩家：只换措辞，不加信息
   * checked 折叠区展开：引擎实际检查了什么，供追查
   */
  const r8RejectionChecks = Object.freeze({
    ACTIVE_DEFENSE_WITHOUT_WINDOW_VALUED: {
      text: '没有可用的防御窗口',
      /* 这里曾经写成"这一刻没有人在攻击他"——那是错的。
         r8HasDefenseWindow 判的是"本次行动机会的授权类型是否属于防御类"，
         与"有没有人在攻击他"是两回事：实测同一回合里对手确实在攻击，
         但行动者自己那次机会的 grantType 是 natural，防御依然无从生效。
         而 grantType 不在 draft 里（只有 opportunityId 字符串），无法据此断言世界状态，
         所以玩家版只陈述可确证的部分，不补一个查不到的原因。 */
      player: '防御和闪避在这次出手机会上无法生效',
      checked: '本次机会是否为防御授权、是否存在来袭动作、是否为反击窗口、机会列表与排期事件中是否存在防御授权',
    },
    CONTROL_WINDOW_NOT_REALIZABLE: {
      text: '控制效果落不到目标的真实行动窗口上',
      player: '就算控制住对方，对方本来也没有会被打断的行动',
      checked: '路线含行动取消效果，但行动池投影里没有可兑现的取消项，且直接生命轨迹为零',
    },
    SUMMON_WINDOW_NOT_REALIZABLE: {
      text: '召唤物没有可兑现的行动窗口',
      player: '召唤出来也来不及行动',
      checked: '路线含召唤窗口效果，但行动池投影里没有可兑现的召唤项，且无终局、无直接生命轨迹、无其他行动池收益',
    },
    ZERO_MARGINAL_WITH_COST: {
      text: '要付出代价但没有收益',
      /* 代价可能是行动机会、反应机会、资源或不可逆资产四者之一，
         但 declaration 在 draft 里只留了 actionId/actorId/actionKind/targetIds，
         没有 resourceCosts，无法判断是哪一种——所以不能写死成"占掉出手机会"。 */
      player: '要付出代价，却换不到任何好处',
      checked: '目标效用不大于零，同时该动作会消耗行动机会、反应机会或资源',
    },
    UNCOMPENSATED_SELF_DESTRUCTION: {
      text: '会让自己倒下且换不来终局',
      player: '这么打自己会先倒下，而且换不来胜负',
      checked: '生命轨迹显示行动者自身生命归零，且该路线不满足终局条件',
    },
    AVOIDABLE_IRREVERSIBLE_OVERREACH_SELECTED: {
      text: '存在同等收益但浪费更少的替代方案',
      player: '有别的打法效果一样，但不会白白浪费伤害',
      checked: '该路线造成阈值后溢出击杀，而另有候选收益不更低、最坏损失不更高、溢出更少且不产生同样的击杀',
    },
  });

  function rejectionReasonText(reasonCode = '') {
    const code = text(reasonCode);
    if (!code) return '';
    return text(r8RejectionChecks[code]?.text) || text(rejectionLabels[code]) || code;
  }

  function rejectionReasonChecked(reasonCode = '') {
    return text(r8RejectionChecks[text(reasonCode)]?.checked);
  }

  /* 玩家版排除原因：必须自带"为什么"，不能只是把内部码换个说法。
     没有玩家版模板时回落到 AI 版，宁可生硬也不编。 */
  function rejectionReasonPlayerText(reasonCode = '') {
    const code = text(reasonCode);
    if (!code) return '';
    return text(r8RejectionChecks[code]?.player) || rejectionReasonText(code);
  }

  function adaptR8DecisionTrace(decision = {}, directory = new Map()) {
    const auditRows = Array.isArray(decision?.candidateAudit) && decision.candidateAudit.length
      ? decision.candidateAudit
      : Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [];
    const selectedId = text(decision?.selected?.candidateId);
    const rows = auditRows.map(candidate => {
      const reasonCode = text(candidate?.rejectionCode);
      const isSelected = candidate?.selected === true ||
        (!!selectedId && text(candidate?.candidateId) === selectedId);
      return {
        name: candidateDisplayLabel(publicCandidate(candidate, directory)),
        targetNames: unique((Array.isArray(candidate?.targetIds) ? candidate.targetIds : [])
          .map(targetId => publicEntityName(directory, targetId, targetId))
          .filter(Boolean)),
        status: isSelected ? 'SELECTED' : reasonCode ? 'EXCLUDED' : 'CONSIDERED',
        reasonCode,
        reasonText: rejectionReasonText(reasonCode),
        reasonPlayerText: rejectionReasonPlayerText(reasonCode),
        reasonChecked: rejectionReasonChecked(reasonCode),
        rank: Number.isFinite(Number(candidate?.normalizedUtility))
          ? Number(candidate.normalizedUtility)
          : null,
      };
    });

    const viable = rows.filter(row => row.status !== 'EXCLUDED');
    const ranked = viable
      .filter(row => Number.isFinite(row.rank))
      .sort((left, right) => right.rank - left.rank);
    const topRanked = ranked[0] || null;
    const selectedRow = rows.find(row => row.status === 'SELECTED') || null;
    const candidateCount = Math.max(rows.length, number(decision?.candidateCount, 0));
    const paretoCount = Math.max(0, number(decision?.paretoCount, 0));

    /* 收敛过程：阶段名在这里落地，战报层拿到的只是"阶段标签 + 前后数量 + 淘汰原因分布"。 */
    const droppedReasons = [...rows
      .filter(row => row.status === 'EXCLUDED')
      .reduce((counts, row) => {
        const key = row.reasonCode || 'UNSPECIFIED';
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
      }, new Map())
      .entries()]
      .map(([reasonCode, count]) => ({ reasonCode, reasonText: rejectionReasonText(reasonCode), count }))
      .sort((left, right) => right.count - left.count || left.reasonCode.localeCompare(right.reasonCode));

    const narrowing = [
      { stage: '候选生成', before: 0, after: candidateCount, droppedReasons: [] },
      { stage: '硬排除', before: candidateCount, after: viable.length, droppedReasons },
    ];
    if (paretoCount > 0 && paretoCount < viable.length) {
      narrowing.push({ stage: '非支配筛选', before: viable.length, after: paretoCount, droppedReasons: [] });
    }
    narrowing.push({
      stage: '选择',
      before: paretoCount > 0 ? paretoCount : viable.length,
      after: selectedRow ? 1 : 0,
      droppedReasons: [],
    });

    const selectionLabel = text(decision?.decisionProfile?.selectionMode);
    const wasOptimal = !selectedRow || !topRanked
      ? null
      : selectedRow.name === topRanked.name ||
        Math.abs(number(selectedRow.rank, 0) - number(topRanked.rank, 0)) <= 1e-9;

    return {
      engineLabel: text(decision?.decisionEngine) || 'UNKNOWN',
      candidateCount,
      candidates: rows,
      narrowing,
      selectionLabel,
      /* 引擎选中的是不是它自己排第一的候选。false 表示引擎明知有更高排名者，
         战报必须如实说明这是在可接受范围内的取舍，不能说成"因为它更好"。 */
      wasOptimal,
      topRankedName: wasOptimal === false ? text(topRanked?.name) : '',
      rankGap: wasOptimal === false && selectedRow && topRanked
        ? Number((number(topRanked.rank, 0) - number(selectedRow.rank, 0)).toFixed(4))
        : null,
    };
  }

  function adaptDecisionTrace(decision = {}, directory = new Map()) {
    /* 目前只有 R8 一个适配器。换引擎时在这里按 decisionEngine 增派新适配器，
       战报层与 UI 层不需要任何改动。 */
    return adaptR8DecisionTrace(decision, directory);
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
    /* 原文"附带效果仍按独立检定结算"在讲机制却不给结论，是误导性废话——
       后半句已经写明了效果是否生效，前缀只需交代"附带效果与伤害各自判定"这个前提，
       不能让读者以为检定结果还未知。 */
    const missedCount = activeHits.filter(fact => hitOutcomeKind(fact) === 'MISS').length;
    if (missedCount === activeHits.length) {
      return `伤害未命中，但附带效果与伤害各自判定，因此仍有结果：${normalizedSummary}`;
    }
    if (missedCount > 0) {
      return `部分段数未命中，附带效果与伤害各自判定：${normalizedSummary}`;
    }
    return `附带效果与伤害各自判定：${normalizedSummary}`;
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

  /*
   * 因果链（A 层主轴）
   *
   * 一个链节点 = 一次行动的完整因果：
   *   局面(context) → 决策(decision) → 机制结算(settlement) → 对账(reconciliation)
   * 交锋分组沿用 build() 已有并已被 auditProjection 校验过的 exchange 划分，不重造；
   * 决策匹配沿用 findDecisionAnchor。本函数只负责把这些既有部件按因果顺序串成一条链，
   * 并补上原先完全缺失的两块：决策发生时的局面，和事后的预测/实际对账。
   */
  /*
   * 结算步骤：把一次行动内部的事实还原成有序因果序列。
   *
   * 原先 responseSummary / resultSummary / continuationSummary 三个字符串各自用 `；` 把事实拼平，
   * 时序与因果全部丢失——"王金玺命中谢邂160点；谢邂命中王金玺275点"读起来像对攻，
   * 实际是「王金玺攻击 → 谢邂防御 → 反击机会成立 → 谢邂反击」。
   * ledger 里有 sequence 全序和 sourceActionId 因果边，这里按它们重建顺序，
   * 并标出每一步由谁做出，让"谁在回应谁"从结构上就能读出来。
   */
  const settlementStepRoles = Object.freeze({
    action_start: 'DECLARE',
    charge_start: 'DECLARE',
    charge_progress: 'DECLARE',
    action_cost: 'COST',
    reaction_window: 'WINDOW',
    counter_window: 'WINDOW',
    defend: 'RESPOND',
    dodge: 'RESPOND',
    guard: 'RESPOND',
    counter: 'COUNTER',
    hit_result: 'HIT',
    state_apply: 'EFFECT',
    shield_create: 'EFFECT',
    shield_break: 'EFFECT',
    summon_create: 'EFFECT',
    resource_change: 'EFFECT',
    effect_resolved: 'EFFECT',
    item_consume: 'EFFECT',
    create: 'EFFECT',
    charge_interrupt: 'CONTINUE',
    blocked_action: 'CONTINUE',
    lost_opportunity: 'CONTINUE',
    state_remove: 'CONTINUE',
    state_expire: 'CONTINUE',
    summon_end: 'CONTINUE',
    target_fail: 'CONTINUE',
  });

  /*
   * 玩家版措辞。
   *
   * 与 AI 版的取舍方向相反：AI 版要精确到基数、概率、折减分解，越无歧义越好；
   * 玩家版要回答"这对我意味着什么"，术语（窗口、判定、姿态系数）一律不出现，
   * 比例换成能直接感知的说法，并且只保留玩家关心的量。
   * 任何一句玩家版都必须能对回同一条事实，不允许为了顺口而增删事实。
   */
  function ratioWords(ratio) {
    const percent = Math.round(number(ratio, 0) * 100);
    if (percent >= 70) return '大部分';
    if (percent >= 45) return '大约一半';
    if (percent >= 25) return '一部分';
    if (percent > 0) return '一小部分';
    return '';
  }

  function playerStepText(rawEvent = {}, fact = {}) {
    const kind = text(rawEvent?.eventKind);
    const meta = rawMeta(rawEvent);
    const actor = text(fact?.actorName);
    const target = text(fact?.targetName);
    const action = text(fact?.actionName);

    if (kind === 'defend' || kind === 'guard') {
      const multiplier = number(meta?.damageMultiplier, NaN);
      const words = Number.isFinite(multiplier) ? ratioWords(1 - multiplier) : '';
      return target && target !== actor
        ? `${actor}架住了${target}的攻击${words ? `，能挡下${words}伤害` : ''}`
        : `${actor}摆出防御架势${words ? `，能挡下${words}伤害` : ''}`;
    }
    if (kind === 'counter_window') {
      const opened = !/FAILURE|missed/i.test(text(rawEvent?.resultState || rawEvent?.result));
      return opened ? `${actor}抓住了反击的机会` : `${actor}没能抓住反击机会`;
    }
    if (kind === 'reaction_window') {
      return /FAILURE|unavailable/i.test(text(rawEvent?.resultState || rawEvent?.result))
        ? `${actor}来不及做出反应`
        : `${actor}还来得及做出反应`;
    }
    if (kind === 'hit_result') {
      const applied = number(rawEvent?.appliedDamage ?? meta?.appliedDamage, 0);
      if (applied > 0) {
        const raw = number(meta?.rawDamage, NaN);
        const absorbed = number(meta?.shieldAbsorb, 0);
        const 备注 = [];
        /* 只在折减确实发生、且幅度值得一提时才说，避免每一击都拖一句解释。 */
        if (Number.isFinite(raw) && raw > applied + absorbed + 0.5) {
          备注.push(`对方的防御卸掉了不少力道`);
        }
        if (absorbed > 0) 备注.push(`护盾替他挡下${Math.round(absorbed)}点`);
        if (meta?.intentLethalPrevented === true) 备注.push('手下留情没有取其性命');
        return `${actor}打中${target}，扣掉${applied}点生命`
          + (备注.length ? `（${备注.join('，')}）` : '');
      }
      if (/miss/i.test(text(rawEvent?.result))) {
        return text(meta?.primaryOutcome) === 'dodged'
          ? `${target}闪开了${actor}的攻击`
          : `${actor}没有打中${target}`;
      }
      if (absorbedShieldOnly(meta)) return `${actor}打中了${target}，但被护盾全部挡下`;
      return `${actor}打中了${target}，却没造成实质伤害`;
    }
    if (kind === 'action_cost' || kind === 'resource_change') {
      const amount = Math.abs(number(meta?.amount ?? meta?.delta, 0));
      const resource = text(meta?.resource) || '资源';
      if (!amount) return '';
      return number(meta?.delta, 0) > 0
        ? `${actor}恢复了${amount}点${resource}`
        : `${actor}消耗${amount}点${resource}`;
    }
    if (kind === 'charge_start' || kind === 'charge_progress') {
      const remaining = number(meta?.remainingOpportunityCount, NaN);
      return Number.isFinite(remaining) && remaining > 0
        ? `${actor}正在蓄力【${action}】，还要等${remaining}次行动机会`
        : `${actor}正在蓄力【${action}】`;
    }
    if (kind === 'charge_interrupt') return `${actor}的蓄力被打断了`;
    if (kind === 'lost_opportunity' || kind === 'blocked_action') return `${actor}这次没能行动`;
    return '';
  }

  function absorbedShieldOnly(meta = {}) {
    return number(meta?.shieldAbsorb, 0) > 0;
  }

  function buildSettlementSteps(exchange = {}, factsById = new Map(), rawEventOf = () => null) {
    const declarationFactIds = new Set();
    const rows = (Array.isArray(exchange?.factIds) ? exchange.factIds : [])
      .map(factId => ({ fact: factsById.get(text(factId)), raw: rawEventOf(factId) }))
      .filter(entry => entry.fact && entry.raw);

    rows.forEach(entry => {
      if (['action_start', 'charge_start'].includes(text(entry.raw?.eventKind))) {
        declarationFactIds.add(text(entry.raw?.actionId));
      }
    });

    return rows
      .filter(entry => {
        const kind = text(entry.raw?.eventKind);
        /* action_cost 是 auditOnly 审计事件，真正扣减写在同 actionId 的 resource_change，
           两条都叙述会变成同一笔消耗说两遍。 */
        if (kind === 'action_cost') return false;
        /* complete 只是动作收尾标记，同一动作已有声明步骤时它不带新信息，
           留着会出现"采取【让过行动】"后面紧跟"使出【让过行动】"的重复叙述。 */
        if (kind === 'complete' && declarationFactIds.has(text(entry.raw?.actionId))) return false;
        if (kind === 'round_summary') return false;
        /* 反击动作本身已经由它自己的 action_start + hit_result 完整叙述，
           counter 事件再说一遍"以【X】反击Y"就成了重复。
           但"放弃反击"没有其他事实承载，必须保留。 */
        if (kind === 'counter' && !/declined|放弃/i.test(`${entry.raw?.result} ${entry.fact?.summary}`)) return false;
        return true;
      })
      .sort((left, right) =>
        number(left.raw?.sequence, 0) - number(right.raw?.sequence, 0) ||
        text(left.fact?.factId).localeCompare(text(right.fact?.factId))
      )
      .map(entry => ({
        factId: text(entry.fact.factId),
        sequence: number(entry.raw?.sequence, 0),
        eventKind: text(entry.raw?.eventKind),
        stepRole: settlementStepRoles[text(entry.raw?.eventKind)] || 'OTHER',
        actorName: text(entry.fact.actorName),
        targetName: text(entry.fact.targetName),
        /* 这一步是不是由交锋发起者以外的人做出的——反击、格挡、闪避都靠它识别，
           渲染时据此加"对此"之类的回应连接词，而不是让读者自己猜谁在回应谁。 */
        byResponder: text(entry.fact.actorName) !== text(exchange?.actorName),
        text: text(entry.fact.summary),
        /* 玩家版没有覆盖到的事件类型回落到 AI 版，宁可稍显生硬也不能凭空造句。 */
        playerText: playerStepText(entry.raw, entry.fact) || text(entry.fact.summary),
        numericTokens: Array.isArray(entry.fact.numericTokens) ? entry.fact.numericTokens : [],
      }))
      .filter(step => step.text);
  }

  function decisionKindOf(decision = {}) {
    const selected = decision?.selected || {};
    if (decision?.lostOpportunity?.reasonCode) return 'LOST_OPPORTUNITY';
    if (selected?.playerLocked === true ||
      text(selected?.selectionMode).toUpperCase() === 'PLAYER_LOCKED') return 'PLAYER_LOCKED';
    if (selected?.forcedAction === true) return 'FORCED';
    if (selected?.counterDeclineFallback === true) return 'DECLINED';
    return 'CHOICE';
  }

  function buildNarrativeChain(input = {}) {
    const {
      draft = {},
      exchanges = [],
      factsById = new Map(),
      directory = new Map(),
      sourceEventsByFactId = new Map(),
      ledger = [],
      remainingHpById = new Map(),
    } = input;

    const decisions = Array.isArray(draft?.decisionAudit) ? draft.decisionAudit : [];
    const claimedFactIds = new Set();
    const matchedByExchangeId = new Map();
    decisions.forEach(decision => {
      const matched = findDecisionAnchor(
        decision,
        exchanges,
        factsById,
        directory,
        claimedFactIds,
        sourceEventsByFactId,
      );
      if (!matched?.exchange) return;
      const key = text(matched.exchange.exchangeId);
      if (!matchedByExchangeId.has(key)) matchedByExchangeId.set(key, []);
      matchedByExchangeId.get(key).push({ decision, anchor: matched.anchor });
    });

    const rawEventOf = factId => sourceEventsByFactId.get(text(factId)) || null;

    return exchanges.map(exchange => {
      const exchangeFactIds = Array.isArray(exchange?.factIds) ? exchange.factIds : [];
      const rawEvents = exchangeFactIds.map(rawEventOf).filter(Boolean);
      const anchorSequence = rawEvents.reduce(
        (lowest, event) => Math.min(lowest, number(event?.sequence, Number.MAX_SAFE_INTEGER)),
        Number.MAX_SAFE_INTEGER,
      );

      const attached = matchedByExchangeId.get(text(exchange.exchangeId)) || [];
      /* 一次交锋内可能挂多个决策（主动 + 对方的反应/反击）。主决策是与交锋行动者一致的那个，
         但其余决策同样是真实发生过的判断，不能丢——反应窗口放弃、反击拒绝这类决策
         恰恰是链路诊断里最值得看的部分。 */
      const orderedDecisions = [...attached].sort((left, right) => {
        const leftPrimary = text(left.decision?.actorId) === text(exchange?.actorId) ? 0 : 1;
        const rightPrimary = text(right.decision?.actorId) === text(exchange?.actorId) ? 0 : 1;
        return leftPrimary - rightPrimary;
      });
      const primary = orderedDecisions[0] || null;

      const decisions = orderedDecisions.map(item => ({
        actorId: publicEntityId(directory, item.decision?.actorId),
        actorName: publicEntityName(directory, item.decision?.actorId, item.decision?.actorId),
        isPrimary: item === primary,
        kind: decisionKindOf(item.decision),
        trace: adaptDecisionTrace(item.decision, directory),
        lostOpportunityReason: item.decision?.lostOpportunity?.reasonCode
          ? playerSafeText(
              item.decision.lostOpportunity.reasonText || item.decision.lostOpportunity.reasonCode,
              directory,
            )
          : '',
      }));

      const decisionTrace = decisions[0]?.trace || null;

      /* 局面必须是"决策发生之前"的世界，所以以本次交锋最早一条事实的 sequence 为界。 */
      const context = buildThreatContext(ledger, {
        directory,
        upToSequence: anchorSequence,
        observerId: text(primary?.decision?.actorId || exchange?.actorId),
      });

      const reconciliation = primary?.decision
        ? reconcileDecision(primary.decision, rawEvents, { directory, remainingHpById })
        : [];

      return {
        chainId: text(exchange.exchangeId),
        round: number(exchange?.round, 0),
        sequence: anchorSequence === Number.MAX_SAFE_INTEGER ? 0 : anchorSequence,
        actorId: text(exchange?.actorId),
        actorName: text(exchange?.actorName),
        action: {
          /* 动作名可能是 PASS_OPPORTUNITY 这类原始枚举，必须映射成中文再出现在战报里。 */
          name: text(actionKindLabels[text(exchange?.action?.name)] || exchange?.action?.name),
          role: text(exchange?.action?.role),
        },
        targetNames: unique(exchange?.targetNames || []),
        context,
        decisionKind: decisions[0]?.kind || 'NONE',
        decision: decisionTrace,
        decisions,
        lostOpportunityReason: text(decisions[0]?.lostOpportunityReason),
        settlement: {
          declarationSummary: text(exchange?.action?.summary),
          /* 有序因果步骤取代原先三条 `；` 拼接的摘要串。 */
          steps: buildSettlementSteps(exchange, factsById, rawEventOf),
        },
        targetGroups: Array.isArray(exchange?.targetGroups) ? exchange.targetGroups : [],
        reconciliation,
        reconciliationSummary: summarizeReconciliation(reconciliation),
        factIds: [...exchangeFactIds],
      };
    }).sort((left, right) =>
      left.round - right.round ||
      left.sequence - right.sequence ||
      text(left.chainId).localeCompare(text(right.chainId))
    );
  }

  /*
   * AI 战报文本投影
   *
   * 这份文本是 AI 扩写自然战斗叙述的唯一依据，因此每一行都必须是事实，不能是解释。
   * 三条硬规则：
   *   1 只用离散事实做主干（谁对谁、用什么、命中没命中、状态上没上、被什么码排除）。
   *     PP/HEPP 这类连续量一律不出现——它们翻成人话必然失真，而离散量天然就是人话。
   *   2 不反推意图。引擎没有"意图"这个概念，它只算标量；写"意图：打断蓄力"是编的。
   *     能写的是"这条路线含行动取消效果"这类事实性因果。
   *   3 只有对账为 CONFIRMED 的效果才由 settlement 如实叙述；MISSED/PREEMPTED 写成明确否定；
   *     UNCONFIRMED 完全不出现在文本里——AI 看不到就不会写，这是杜绝误写战况的根本手段。
   */
  const aiReconciliationDenials = Object.freeze({
    HP_DELTA: { MISSED: '攻击未命中，未造成伤害', PREEMPTED: '攻击未能打出' },
    SCHEDULED_HP_DELTA: { MISSED: '持续伤害未生效', PREEMPTED: '持续伤害未能挂上' },
    SHIELD_DELTA: { MISSED: '护盾未建立', PREEMPTED: '护盾未能建立' },
    STATE_CHANGED: { MISSED: '状态被抵抗，未生效', PREEMPTED: '状态未能施加' },
    ACTION_CANCELLED: { MISSED: '未能打断对方行动', PREEMPTED: '打断未能生效' },
    SUMMON_WINDOW: { MISSED: '召唤未成立', PREEMPTED: '召唤未能建立' },
    RESOURCE_OPTION_CHANGED: { MISSED: '资源变化未发生', PREEMPTED: '资源变化未发生' },
    PAYMENT: { MISSED: '消耗未支付', PREEMPTED: '消耗未支付' },
    TERMINAL: { MISSED: '未达成预期的终局条件', PREEMPTED: '终局未达成' },
  });

  function aiDenialLine(row = {}) {
    const status = text(row?.status);
    if (status !== 'MISSED' && status !== 'PREEMPTED') return '';
    const template = aiReconciliationDenials[text(row?.kind)];
    const base = text(template?.[status]);
    if (!base) return '';
    const stateName = text(row?.expected?.stateName);
    const target = text(row?.targetName);
    const subject = stateName ? `${stateName}` : '';
    return [
      target ? `对${target}` : '',
      subject ? `${subject}：` : '',
      base,
    ].filter(Boolean).join('');
  }

  /* 一行战果：同时用于楼层留存（玩家可读、不污染上下文）与 AI 战报的抬头。
     终局必须用人话，不能把 winner 的原始枚举值直接抛出去。 */
  function buildBattleHeadline(input = {}) {
    const sides = input?.sides || {};
    const playerNames = (Array.isArray(sides?.player) ? sides.player : []).map(unit => text(unit?.name)).filter(Boolean);
    const enemyNames = (Array.isArray(sides?.enemy) ? sides.enemy : []).map(unit => text(unit?.name)).filter(Boolean);
    const outcome = [terminalText(input?.terminalResult || {}), terminalConditionText(input?.terminalResult || {})]
      .map(text)
      .filter(Boolean)
      .join('：');
    return [
      playerNames.length && enemyNames.length ? `${playerNames.join('、')} vs ${enemyNames.join('、')}` : '',
      `${Math.max(0, number(input?.roundCount, 0))}回合`,
      outcome,
    ].filter(Boolean).join(' · ');
  }

  function renderChainForAI(input = {}) {
    const chain = Array.isArray(input?.chain) ? input.chain : [];
    const sides = input?.sides || {};
    const lines = [];

    lines.push(buildBattleHeadline(input));

    let currentRound = null;
    chain.forEach(node => {
      if (node.round !== currentRound) {
        currentRound = node.round;
        lines.push('', `[第${currentRound}回合]`);
      }

      /* 局面：只报会在下一个窗口兑现、且不是行动者自己的蓄力，其余属于噪音。 */
      (node?.context?.pendingCharges || [])
        .filter(charge => charge.imminent && text(charge.actorId) !== text(node.actorId))
        .forEach(charge => {
          lines.push(`  ! ${charge.actorName}蓄力中【${charge.actionName}】，下个行动窗口即可打出`);
        });

      if (node.decisionKind === 'LOST_OPPORTUNITY') {
        lines.push(`${node.actorName} 失去行动：${node.lostOpportunityReason || '无法行动'}`);
        lines.push('');
        return;
      }

      const targets = node.targetNames.filter(name => name && name !== node.actorName);
      lines.push([
        node.actorName,
        targets.length ? `→ ${targets.join('、')}` : '',
        `· ${node.action.name}`,
      ].filter(Boolean).join(' '));

      if (node.decisionKind === 'PLAYER_LOCKED') lines.push('  玩家指定动作');
      if (node.decisionKind === 'FORCED') lines.push('  前一窗口已声明，本次按既定动作兑现');

      /* 被排除的候选：只取真正携带排除码的，最多两条，避免刷屏。 */
      (node?.decision?.candidates || [])
        .filter(candidate => candidate.status === 'EXCLUDED' && candidate.reasonText)
        .slice(0, 2)
        .forEach(candidate => {
          lines.push(`  未选${candidate.name}：${candidate.reasonText}`);
        });

      /* 引擎明知有更高排名却选了别的，必须如实说明，不能包装成"因为它更好"。 */
      if (node?.decision?.wasOptimal === false && node.decision.topRankedName) {
        lines.push(`  注：引擎评分更高的是${node.decision.topRankedName}，本次在可接受范围内选了当前动作`);
      }

      /* 按真实时序逐步输出，一步一行。回应方的步骤加"对此"前缀，
         让"谁在回应谁"从文本上直接可读，而不是靠 AI 猜并列分句的关系。 */
      const steps = Array.isArray(node?.settlement?.steps) ? node.settlement.steps : [];
      let 上一步是发起方 = true;
      steps.forEach(step => {
        if (step.stepRole === 'DECLARE' && step.actorName === node.actorName) return;
        const 回应前缀 = step.byResponder && 上一步是发起方 ? '对此，' : '';
        lines.push(`  ${回应前缀}${step.text}`);
        上一步是发起方 = !step.byResponder;
      });
      if (!steps.length && text(node?.settlement?.declarationSummary)) {
        lines.push(`  ${text(node.settlement.declarationSummary)}`);
      }

      /* 对账否定行只在结算步骤没覆盖到时才补。
         若判定 MISSED 所依据的事实已经被某个步骤叙述过（例如"未能命中X"），
         再输出一句"攻击未命中，未造成伤害"就是同一件事说两遍。 */
      const 已叙述事实 = new Set(steps.map(step => step.factId));
      (node?.reconciliation || [])
        .filter(row => !(Array.isArray(row?.actualFactIds) ? row.actualFactIds : [])
          .some(factId => 已叙述事实.has(text(factId))))
        .map(aiDenialLine)
        .filter(Boolean)
        .forEach(line => lines.push(`  ${line}`));

      /* 同一次交锋里对方做出的反应/反击决策也是真实发生的判断，必须一并交代，
         否则 AI 会以为对方毫无反应。 */
      (node?.decisions || []).slice(1).forEach(entry => {
        if (entry.kind === 'LOST_OPPORTUNITY') {
          lines.push(`  ${entry.actorName}未能应对：${entry.lostOpportunityReason || '没有可用的应对动作'}`);
          return;
        }
        if (entry.kind === 'DECLINED') {
          lines.push(`  ${entry.actorName}放弃了本次反击机会`);
          return;
        }
        if (text(entry.trace?.selectionLabel) === 'REACTION_DECLINED') {
          lines.push(`  ${entry.actorName}没有能改变本次结算的应对动作`);
        }
      });

      /* 节点之间留空行，否则局面提示会看起来像挂在上一个单位身上。 */
      lines.push('');
    });

    const finalState = [...(Array.isArray(sides?.player) ? sides.player : []), ...(Array.isArray(sides?.enemy) ? sides.enemy : [])]
      .map(unit => {
        const hp = Number(unit?.hp);
        const hpMax = Number(unit?.hpMax);
        return Number.isFinite(hp) && Number.isFinite(hpMax)
          ? `${text(unit?.name)} ${hp}/${hpMax}`
          : text(unit?.name);
      })
      .filter(Boolean);
    if (finalState.length) lines.push('', `[终态] ${finalState.join(' | ')}`);

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /*
   * 链路收敛统计（B 层）
   *
   * 用途不是给玩家看，是回答"当前决策链里哪些阶段真的在改变结果、哪些只是在烧 CPU"。
   * 例如：非支配筛选后前沿恒为 1，说明多维支配机制没有实际参与选择；
   *       SEEDED_SOFTMAX 触发率为 0，说明随机温度那套可以整体去掉；
   *       某个排除码从不触发，它的判定开销是白花的；
   *       硬排除后候选归零的比例高，说明候选生成在大量产出必然被排除的候选。
   * 这些数字全部来自既有投影，不进决策热路径，也不需要引擎改动。
   */
  function buildPipelineStats(chain = []) {
    /* 统计以"决策"为单位而不是"链节点"，因为一次交锋里可能挂着主动方与应对方两个决策，
       只数节点会漏掉反应侧的判断。 */
    const nodes = (Array.isArray(chain) ? chain : [])
      .flatMap(node => (Array.isArray(node?.decisions) ? node.decisions : []))
      .filter(entry => entry?.trace)
      .map(entry => ({ decision: entry.trace, kind: entry.kind }));
    const tally = (values) => {
      const counts = new Map();
      values.forEach(value => {
        const key = text(value) || '(未标注)';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return [...counts.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
    };

    const candidateCounts = nodes.map(node => number(node.decision.candidateCount, 0));
    const stageRows = new Map();
    nodes.forEach(node => {
      (node.decision.narrowing || []).forEach(step => {
        const stage = text(step?.stage);
        if (!stage) return;
        if (!stageRows.has(stage)) {
          stageRows.set(stage, { stage, occurrences: 0, totalBefore: 0, totalAfter: 0, emptied: 0 });
        }
        const row = stageRows.get(stage);
        row.occurrences += 1;
        row.totalBefore += number(step?.before, 0);
        row.totalAfter += number(step?.after, 0);
        if (number(step?.before, 0) > 0 && number(step?.after, 0) === 0) row.emptied += 1;
      });
    });

    const reconciliationTotals = (Array.isArray(chain) ? chain : []).reduce((totals, node) => {
      const summary = node?.reconciliationSummary || {};
      Object.keys(totals).forEach(key => {
        totals[key] += Math.max(0, number(summary?.[key], 0));
      });
      return totals;
    }, {
      total: 0,
      confirmed: 0,
      missed: 0,
      preempted: 0,
      unconfirmed: 0,
      magnitudeUnexplained: 0,
      predictionExceedsTargetHp: 0,
      rawDamageModelDiverged: 0,
    });

    return {
      decisionCount: nodes.length,
      candidateCount: {
        min: candidateCounts.length ? Math.min(...candidateCounts) : 0,
        max: candidateCounts.length ? Math.max(...candidateCounts) : 0,
        mean: candidateCounts.length
          ? Number((candidateCounts.reduce((sum, value) => sum + value, 0) / candidateCounts.length).toFixed(2))
          : 0,
      },
      selectionLabels: tally(nodes.map(node => node.decision.selectionLabel)),
      /* wasOptimal=false 的占比就是"随机取舍实际改变了多少次决策"。
         为 0 说明温度机制从未真正生效。 */
      optimality: {
        optimal: nodes.filter(node => node.decision.wasOptimal === true).length,
        suboptimal: nodes.filter(node => node.decision.wasOptimal === false).length,
        notApplicable: nodes.filter(node => node.decision.wasOptimal === null).length,
      },
      rejectionCodes: tally(nodes.flatMap(node =>
        (node.decision.candidates || [])
          .filter(candidate => candidate.status === 'EXCLUDED')
          .map(candidate => candidate.reasonCode)
      )),
      /* emptied：该阶段把候选清空的次数。硬排除阶段频繁清空 = 候选生成在做无用功。 */
      narrowingStages: [...stageRows.values()].map(row => ({
        ...row,
        meanBefore: row.occurrences ? Number((row.totalBefore / row.occurrences).toFixed(2)) : 0,
        meanAfter: row.occurrences ? Number((row.totalAfter / row.occurrences).toFixed(2)) : 0,
      })),
      decisionKinds: tally(nodes.map(node => node.kind)),
      reconciliation: reconciliationTotals,
    };
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

    /* 因果链主轴：局面 → 决策 → 机制结算 → 对账。
       它复用上面已经算好并会被 auditProjection 校验的 exchange 分组，
       只负责按因果顺序重新串联，并补上原先缺失的局面与对账两块。 */
    const narrativeChain = buildNarrativeChain({
      draft,
      exchanges,
      factsById,
      directory,
      sourceEventsByFactId,
      ledger,
      remainingHpById: buildRemainingHpIndex(draft),
    });
    const pipelineStats = buildPipelineStats(narrativeChain);
    const projectedTerminal = projectTerminalResult(draft?.terminalResult || {}, visibilityMode, directory);
    const chainRenderInput = {
      chain: narrativeChain,
      terminalResult: projectedTerminal,
      roundCount: Math.max(0, number(draft?.actualRoundCount, 0)),
      sides: {
        player: finalSummary?.sides?.player?.units || [],
        enemy: finalSummary?.sides?.enemy?.units || [],
      },
    };
    const aiReport = renderChainForAI(chainRenderInput);
    const battleHeadline = buildBattleHeadline(chainRenderInput);
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
      terminalResult: projectedTerminal,
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
      narrativeChain,
      pipelineStats,
      aiReport,
      battleHeadline,
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


  root.__LWCS_BATTLE_REPORT__ = Object.freeze({
    version: reportSchemaVersion,
    visibilityModes,
    build,
    auditProjection,
    candidateDisplayLabel,
    reconcileDecision,
    summarizeReconciliation,
    buildThreatContext,
    buildRemainingHpIndex,
    buildNarrativeChain,
    renderChainForAI,
    buildPipelineStats,
    buildBattleHeadline,
    adaptDecisionTrace,
  });
})();

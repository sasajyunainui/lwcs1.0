/* BattleReport_Module.js - Structured battle fact projection and narration. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const runtime = root.__LWCS_BATTLE_RUNTIME__;
  if (!runtime || runtime.version !== '7.3-R6.3') {
    throw new Error(`battle_report_runtime_version_mismatch:${runtime?.version || 'missing'}`);
  }

  const visibilityModes = Object.freeze(['PLAYER', 'DEVELOPER']);
  const reportSchemaVersion = '7.3-R7.4-report-2';
  const internalSummonPattern = /(?:structured-summon|battle-summon|summon-instance):[^\s,，。；;|]+/gi;
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

  function unique(values = []) {
    return [...new Set(values.map(value => text(value)).filter(Boolean))];
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

  function snapshotUnits(snapshot = {}) {
    return [
      ...(Array.isArray(snapshot?.team_player) ? snapshot.team_player.map(unit => ({ unit, side: 'player' })) : []),
      ...(Array.isArray(snapshot?.team_enemy) ? snapshot.team_enemy.map(unit => ({ unit, side: 'enemy' })) : []),
      ...(Array.isArray(snapshot?.summons) ? snapshot.summons.map(unit => ({
        unit,
        side: text(unit?.side || unit?.阵营).toLowerCase().includes('enemy') ? 'enemy' : 'player',
      })) : []),
    ];
  }

  function buildEntityDirectory(draft = {}, ledger = []) {
    const aliases = new Map();
    let summonSequence = 0;
    const register = (rawId, name, side = '', hostName = '') => {
      const id = text(rawId);
      if (!id) return null;
      const current = aliases.get(id);
      const internalSummon = /^(?:structured-summon|battle-summon|summon-instance):/i.test(id);
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
    return aliases;
  }

  function entityEntry(directory, value = '') {
    const key = text(value);
    return directory.get(key) || null;
  }

  function publicEntityId(directory, value = '') {
    const key = text(value);
    return entityEntry(directory, key)?.publicId || key;
  }

  function publicEntityName(directory, value = '', fallback = '') {
    const key = text(value);
    return entityEntry(directory, key)?.name || text(fallback || key);
  }

  function buildActionReferenceMap(ledger = []) {
    const references = new Map();
    ledger.forEach(event => {
      if (text(event?.eventKind) !== 'action_start') return;
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
    const shieldAbsorb = number(meta?.shieldAbsorb, NaN);
    if (Number.isFinite(shieldAbsorb) && shieldAbsorb > 0) {
      push(eventNumberToken(event, '护盾吸收', shieldAbsorb, '护盾', 'SHIELD', 'SUBTRACT', visibilityMode));
    }
    const probability = number(event?.probability ?? meta?.probability ?? meta?.hitProbability ?? meta?.dodgeRate ?? meta?.successRate, NaN);
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

  function summarizeEvent(event = {}, directory = new Map()) {
    const kind = text(event?.eventKind);
    const actor = publicEntityName(directory, event?.actorId || event?.actorName, event?.actorName) || '系统';
    const target = publicEntityName(directory, event?.targetId || event?.targetName, event?.targetName);
    const action = playerSafeText(event?.actionName || event?.finalActionName || kind, directory) || '行动';
    const result = resultLabel(event);
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const damage = number(event?.appliedDamage ?? meta?.appliedDamage ?? event?.damage ?? meta?.damage, 0);
    const delta = number(event?.delta ?? meta?.delta, 0);
    const shield = number(meta?.amount ?? event?.amount, 0);
    const duration = number(event?.duration ?? meta?.duration, 0);
    const namedState = playerSafeText(stateName(event), directory);
    if (kind === 'action_start') return `${actor}使用【${action}】${target ? `指向${target}` : ''}`;
    if (kind === 'dodge') {
      return target && target !== actor
        ? `${actor}尝试闪避${target}的攻势，结果为${result}`
        : `${actor}进入闪避姿态，结果为${result}`;
    }
    if (kind === 'defend' || kind === 'guard') {
      return target && target !== actor
        ? `${actor}以【${action}】应对${target}的攻势，结果为${result}`
        : `${actor}进入【${action}】姿态，结果为${result}`;
    }
    if (kind === 'reaction_window') return `${actor}的即时反应窗口${/FAILURE|unavailable/i.test(text(event?.resultState || event?.result)) ? '不可用' : '已建立'}`;
    if (kind === 'counter_window') return `${actor}的反击窗口${/FAILURE|missed/i.test(text(event?.resultState || event?.result)) ? '未能成立' : '已成立'}`;
    if (kind === 'counter') return /declined|放弃/i.test(`${event?.result} ${action}`)
      ? `${actor}放弃对${target || '来源攻击者'}的反击`
      : `${actor}以【${action}】反击${target || '来源攻击者'}，结果为${result}`;
    if (kind === 'hit_result') return damage > 0
      ? `${actor}以【${action}】命中${target || '目标'}，造成${damage}点伤害`
      : `${actor}的【${action}】未对${target || '目标'}造成伤害`;
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
    if (kind === 'state_apply') {
      const outcome = resultLabel(event);
      if (['失败', '被抵抗', '免疫', '已阻断'].includes(outcome)) {
        return `${actor}通过【${action}】尝试使${target || actor}获得【${namedState || '状态'}】，结果为${outcome}`;
      }
      return `${actor}通过【${action}】使${target || actor}获得【${namedState || '状态'}】${duration > 0 ? `，持续${duration}回合` : ''}`;
    }
    if (kind === 'state_remove') return `${target || actor}移除【${namedState || action}】`;
    if (kind === 'state_expire') return `${target || actor}的【${namedState || action}】到期`;
    if (kind === 'summon_create') {
      const summonName = publicEntityName(directory, meta?.summonKey || event?.targetId, meta?.summonName || event?.targetName || '召唤物');
      return `${actor}通过【${action}】召唤${summonName}`;
    }
    if (kind === 'summon_end') return `${actor}离场${meta?.reasonText ? `：${playerSafeText(meta.reasonText, directory)}` : ''}`;
    if (kind === 'item_created') return `${actor}通过【${action}】制作${playerSafeText(meta?.productId || event?.itemName || '物品', directory)}`;
    if (kind === 'item_used') return `${actor}使用${playerSafeText(event?.itemName || action, directory)}${target ? `作用于${target}` : ''}`;
    if (kind === 'lost_opportunity') return `${actor}失去本次行动机会${meta?.reason ? `：${playerSafeText(meta.reason, directory)}` : ''}`;
    if (kind === 'action_cancelled' || kind === 'blocked_action') {
      return `${actor}的【${action}】${result === '已中止' || result === '已阻断' ? result : '未能执行'}`;
    }
    if (kind === 'effect_resolved') {
      const detail = meta?.effectDetail && typeof meta.effectDetail === 'object' ? meta.effectDetail : {};
      const subject = playerSafeText(detail?.attribute || detail?.check || detail?.settlement || namedState || '效果', directory);
      return `${actor}的【${action}】使${target || actor}的${subject}发生变化`;
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
    const actorId = publicEntityId(directory, event?.actorId || event?.actorName);
    const targetIds = unique([
      ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
      event?.targetId,
    ]).map(value => publicEntityId(directory, value));
    const actorName = publicEntityName(directory, event?.actorId || event?.actorName, event?.actorName);
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
      actorSide: text(event?.actorSide),
      targetIds,
      targetName,
      targetSide: text(event?.targetSide),
      actorControl: text(event?.actorControl),
      actionRole: text(event?.actionRole),
      actionName: playerSafeText(event?.actionName || event?.finalActionName, directory),
      resultState: resultLabel(event),
      stateName: playerSafeText(stateName(event), directory),
      summary: summarizeEvent(event, directory),
      numericTokens: numericTokens(event, visibilityMode),
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
    if (passiveEventKinds.has(text(event?.eventKind)) || text(event?.actionRole) === 'STATE_TICK') return '';
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

  function decisionActionName(decision = {}) {
    return text(decision?.selected?.selectedActionName || decision?.selected?.actionName || decision?.selected?.declaration?.actionKind);
  }

  function findDecisionForExchange(exchange = {}, decisions = [], claimed = new Set()) {
    const actorId = text(exchange?.actorId);
    const actionName = text(exchange?.action?.name);
    const round = number(exchange?.round, 0);
    const matchIndex = decisions.findIndex((decision, index) => {
      if (claimed.has(index)) return false;
      return number(decision?.round, 0) === round &&
        text(decision?.actorId) === actorId &&
        (!actionName || decisionActionName(decision) === actionName);
    });
    if (matchIndex < 0) return null;
    claimed.add(matchIndex);
    return { decision: decisions[matchIndex], index: matchIndex };
  }

  function publicCandidate(candidate = {}, directory = new Map()) {
    const declaration = candidate?.declaration || {};
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
      actionName: playerSafeText(actionName, directory),
      actionKind: text(candidate?.actionKind || declaration?.actionKind),
      targetIds: unique(candidate?.targetIds || declaration?.targetIds || []).map(value => publicEntityId(directory, value)),
      targetNames: unique(candidate?.targetIds || declaration?.targetIds || []).map(value => publicEntityName(directory, value, value)),
      classification: classificationLabels[text(candidate?.classification)] || classificationLabels.VIABLE,
      rejectionReason: rejectionLabels[text(candidate?.rejectionCode)] || '',
    };
  }

  function adjudicationNumberToken(adjudicationId, sourceEventId, label, value, unit, sourceName) {
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
      visibility: 'PLAYER',
    };
  }

  function candidateDisplayLabel(candidate = {}) {
    const action = text(candidate?.actionName || '行动');
    const targets = unique(candidate?.targetNames || []);
    return targets.length ? `【${action}】（目标：${targets.join('、')}）` : `【${action}】`;
  }

  function buildDecisionReason(decision = {}, selectedPublic = {}, alternatives = []) {
    const selected = decision?.selected || {};
    const problem = problemLabels[text(decision?.problems?.[0]?.problemId)] || '当前局势';
    const selectedLabel = candidateDisplayLabel(selectedPublic);
    const alternativeLabels = alternatives.map(candidateDisplayLabel);
    const repeated = selected?.repeatedActionAudit || {};
    const reasons = [];
    if (alternativeLabels.length) reasons.push(`相较${alternativeLabels.join('、')}，当前局面改善更大`);
    if (number(selected?.vector?.resourceContinuity, 0) > 0) reasons.push('能保留或解锁后续有效行为');
    if (number(selected?.vector?.survivalLowerBound, 0) > 0) reasons.push('承受主要回应后的生存下界仍为正');
    if (number(repeated?.repeatedActionDelta, 0) > 0 && (repeated?.extendedWindowIds || []).length) reasons.push('重复使用仍延长了真实生效窗口');
    if (number(repeated?.resourceRunwayAfter, 0) > 0 && !(repeated?.lostAffordableActions || []).length) reasons.push('执行后仍保有可支付的后续动作');
    if (selected?.forcedFallback === true) reasons.push('其他主动方案当前均不可兑现');
    if (!reasons.length) reasons.push('该方案处于当前非支配候选集合');
    return `局势问题为“${problem}”；选择${selectedLabel}，${reasons.join('，')}`;
  }

  function buildAdjudications(draft = {}, exchanges = [], factsById = new Map(), directory = new Map(), visibilityMode = 'PLAYER') {
    const decisions = Array.isArray(draft?.decisionAudit) ? draft.decisionAudit : [];
    const claimed = new Set();
    return exchanges.map((exchange, exchangeIndex) => {
      const matched = findDecisionForExchange(exchange, decisions, claimed);
      if (!matched) return null;
      const decision = matched.decision;
      const selected = decision?.selected || {};
      const scoreAudit = Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [];
      const alternatives = scoreAudit
        .filter(candidate => candidate?.selected !== true && text(candidate?.candidateId) !== text(selected?.candidateId))
        .sort((left, right) => number(right?.objectiveUtility, -Infinity) - number(left?.objectiveUtility, -Infinity))
        .slice(0, 2);
      const selectedPublic = publicCandidate({
        ...selected,
        actionName: selected?.selectedActionName,
        actionKind: selected?.declaration?.actionKind,
        targetIds: selected?.declaration?.targetIds,
      }, directory);
      const alternativePublic = alternatives.map(candidate => {
        const item = publicCandidate(candidate, directory);
        return {
          ...item,
          differenceFromSelected: number(selected?.objectiveUtility, 0) - number(candidate?.objectiveUtility, 0),
        };
      });
      const adjudicationId = `adjudication:${number(decision?.round, 0)}:${publicEntityId(directory, decision?.actorId)}:${exchangeIndex + 1}`;
      const sourceEventId = text(exchange?.factIds?.[0]);
      const decisionNumbers = [
        adjudicationNumberToken(adjudicationId, sourceEventId, '预估局面收益', selected?.objectiveUtility, '效用', selectedPublic.actionName),
        adjudicationNumberToken(adjudicationId, sourceEventId, '资源连续性', selected?.vector?.resourceContinuity, '容量', selectedPublic.actionName),
        adjudicationNumberToken(adjudicationId, sourceEventId, '生存下界', selected?.vector?.survivalLowerBound, '容量', selectedPublic.actionName),
        adjudicationNumberToken(adjudicationId, sourceEventId, '重复动作边际', selected?.repeatedActionAudit?.repeatedActionDelta, '效用', selectedPublic.actionName),
      ].filter(Boolean);
      const actualFacts = exchange.factIds.map(factId => factsById.get(factId)).filter(Boolean);
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
        selected: selectedPublic,
        alternatives: alternativePublic,
        reasonSummary: buildDecisionReason(decision, selectedPublic, alternativePublic),
        predicted: {
          problem: problemLabels[text(decision?.problems?.[0]?.problemId)] || '当前局势',
          teamFocusTarget: publicEntityName(directory, decision?.teamIntent?.focusTarget, decision?.teamIntent?.focusTarget),
          protectTarget: publicEntityName(directory, decision?.teamIntent?.protectTarget, decision?.teamIntent?.protectTarget),
          exploitableWindow: playerSafeText(decision?.teamIntent?.exploitableWindow, directory),
          numbers: decisionNumbers,
          repeatedAction: cloneValue(selected?.repeatedActionAudit || null),
        },
        actual: {
          resultSummary: text(exchange?.resultSummary),
          factIds: [...exchange.factIds],
          checks,
          numericTokens: actualFacts.flatMap(fact => fact.numericTokens),
        },
      };
      if (visibilityMode === 'DEVELOPER') {
        adjudication.developerDetail = {
          decisionIndex: matched.index,
          selectedCandidateId: text(selected?.candidateId),
          rawDecision: cloneValue(decision),
        };
      }
      return adjudication;
    }).filter(Boolean);
  }

  function exchangePresentation(exchange = {}, factsById = new Map()) {
    const facts = exchange.factIds.map(factId => factsById.get(factId)).filter(Boolean);
    const declaration = facts.find(fact => fact.eventKind === 'action_start') || facts[0] || null;
    const responses = facts.filter(fact => responseEventKinds.has(fact.eventKind));
    const rawResultFacts = facts.filter(fact =>
      !['action_start', 'round_summary'].includes(fact.eventKind) &&
      !responseEventKinds.has(fact.eventKind) &&
      fact.eventKind !== 'action_cost'
    );
    const positiveHitKeys = new Set(rawResultFacts
      .filter(fact => fact.eventKind === 'hit_result' && fact.numericTokens.some(token => token.label === '最终伤害' && number(token.value, 0) > 0))
      .map(fact => `${fact.actorId}|${fact.actionName}|${fact.targetName}`));
    const resultFacts = rawResultFacts.filter(fact => {
      if (fact.eventKind !== 'hit_result') return true;
      const hasPositiveHit = positiveHitKeys.has(`${fact.actorId}|${fact.actionName}|${fact.targetName}`);
      const hasDamage = fact.numericTokens.some(token => token.label === '最终伤害' && number(token.value, 0) > 0);
      return hasDamage || !hasPositiveHit;
    });
    const continuationFacts = resultFacts.filter(fact =>
      ['state_apply', 'state_remove', 'state_expire', 'summon_create', 'summon_end', 'lost_opportunity', 'action_cancelled'].includes(fact.eventKind)
    );
    const immediateResults = resultFacts.filter(fact => !continuationFacts.includes(fact));
    const actionSummary = declaration?.summary || facts[0]?.summary || '行动已记录';
    const responseSummary = unique(responses.map(fact => fact.summary)).join('；');
    const resultSummary = unique(immediateResults.map(fact => fact.summary)).join('；') || '未产生额外数值结果';
    const continuationSummary = unique(continuationFacts.map(fact => fact.summary)).join('；');
    return {
      ...exchange,
      actorId: declaration?.actorId || exchange.actorId,
      actorName: declaration?.actorName || exchange.actorName,
      targetIds: declaration?.targetIds?.length ? [...declaration.targetIds] : [...exchange.targetIds],
      targetNames: unique([
        declaration?.targetName,
        ...facts.map(fact => fact.targetName),
      ]),
      action: {
        name: declaration?.actionName || exchange.action?.name || '行动',
        role: declaration?.actionRole || exchange.action?.role || 'ACTIVE',
        summary: actionSummary,
      },
      responseFactIds: responses.map(fact => fact.factId),
      resultFactIds: immediateResults.map(fact => fact.factId),
      continuationFactIds: continuationFacts.map(fact => fact.factId),
      responseSummary,
      resultSummary,
      continuationSummary,
      text: [
        actionSummary,
        responseSummary ? `应对：${responseSummary}` : '',
        `结果：${resultSummary}`,
        continuationSummary ? `后续：${continuationSummary}` : '',
      ].filter(Boolean).join('。'),
    };
  }

  function unitStateFromSnapshot(unit = {}, side = '', directory = new Map()) {
    const id = publicEntityId(directory, unit?.id || unit?.召唤键 || unit?.name || unit?.名称);
    const name = publicEntityName(directory, unit?.id || unit?.召唤键 || unit?.name || unit?.名称, unit?.name || unit?.名称);
    const states = Array.isArray(unit?.状态效果)
      ? unit.状态效果.map(state => text(state?.name || state?.状态 || state?.状态名称)).filter(Boolean)
      : Object.values(unit?.状态效果 || {}).map(state => text(state?.name || state?.状态 || state?.状态名称)).filter(Boolean);
    return {
      id,
      name,
      side,
      hp: number(unit?.hp ?? unit?.HP, 0),
      hpMax: Math.max(1, number(unit?.hp_max ?? unit?.HP上限, 1)),
      shield: Math.max(0, number(unit?.shield ?? unit?.护盾, 0)),
      resources: {
        soul: number(unit?.sp ?? unit?.魂力, 0),
        soulMax: Math.max(0, number(unit?.sp_max ?? unit?.魂力上限, 0)),
        spirit: number(unit?.men ?? unit?.精神力, 0),
        spiritMax: Math.max(0, number(unit?.men_max ?? unit?.精神力上限, 0)),
        stamina: number(unit?.vit ?? unit?.sta ?? unit?.体力, 0),
        staminaMax: Math.max(0, number(unit?.vit_max ?? unit?.sta_max ?? unit?.体力上限, 0)),
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
    for (let round = 1; round <= Math.max(0, number(draft?.actualRoundCount, 0)); round += 1) {
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
      const stateEvents = roundFacts.filter(fact => /state_/.test(fact.eventKind)).map(fact => fact.factId);
      const summonEvents = roundFacts.filter(fact => /summon_/.test(fact.eventKind)).map(fact => fact.factId);
      const lostOpportunityFactIds = roundFacts.filter(fact => ['lost_opportunity', 'action_cancelled', 'blocked_action'].includes(fact.eventKind)).map(fact => fact.factId);
      const summaryFactIds = roundFacts.filter(fact => fact.eventKind === 'round_summary').map(fact => fact.factId);
      const passiveFacts = roundFacts.filter(fact =>
        fact.canonicalFactOwner === `round:${round}` && fact.eventKind !== 'round_summary'
      );
      const summaryParts = [];
      if (damageBySide.player > 0 || damageBySide.enemy > 0) {
        summaryParts.push(`我方造成${damageBySide.player}点伤害，敌方造成${damageBySide.enemy}点伤害`);
      }
      if (stateEvents.length) summaryParts.push(`发生${stateEvents.length}项状态变化`);
      if (summonEvents.length) summaryParts.push(`发生${summonEvents.length}项召唤变化`);
      if (lostOpportunityFactIds.length) summaryParts.push(`${lostOpportunityFactIds.length}次行动机会未能执行`);
      if (!summaryParts.length) summaryParts.push('本回合没有数值战果，但行动与窗口事实已完整记录');
      const passiveSummary = unique(passiveFacts.map(fact => fact.summary)).join('；');
      rows.push({
        round,
        factIds,
        canonicalFactIds: summaryFactIds,
        passiveFactIds: passiveFacts.map(fact => fact.factId),
        passiveSummary,
        exchangeIds: exchangeByRound.get(round) || [],
        summary: summaryParts.join('；'),
        damageBySide,
        resourceEvents,
        stateEventFactIds: stateEvents,
        summonEventFactIds: summonEvents,
        lostOpportunityFactIds,
        units: cloneSideUnits(states),
      });
    }
    return rows;
  }

  function finalSide(snapshot = {}, side = 'player', directory = new Map()) {
    const list = side === 'player' ? snapshot?.team_player : snapshot?.team_enemy;
    return (Array.isArray(list) ? list : []).map(unit => unitStateFromSnapshot(unit, side, directory));
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

  function latestSideIntent(decisions = [], sideUnits = [], directory = new Map(), terminal = {}) {
    if (terminal?.terminal === true) return '战斗已经结束，转入战后处置';
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
    const summons = (Array.isArray(snapshot?.summons) ? snapshot.summons : []).map(unit => unitStateFromSnapshot(
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
    [...playerUnits, ...enemyUnits].forEach(unit => {
      if (unit.hp / Math.max(1, unit.hpMax) <= 0.2 && unit.hp > 0) risks.push(`${unit.name}生命已低于20%`);
      if (unit.resources.soulMax > 0 && unit.resources.soul / unit.resources.soulMax <= 0.1) risks.push(`${unit.name}魂力接近耗尽`);
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
      player: latestSideIntent(decisions, playerUnits, directory, terminal),
      enemy: latestSideIntent(decisions, enemyUnits, directory, terminal),
    };
    const formatUnit = unit => `${unit.name} HP ${unit.hp}/${unit.hpMax}，魂力 ${unit.resources.soul}/${unit.resources.soulMax}，体力 ${unit.resources.stamina}/${unit.resources.staminaMax}，精神力 ${unit.resources.spirit}/${unit.resources.spiritMax}${unit.states.length ? `，状态：${unit.states.join('、')}` : ''}`;
    const textSummary = [
      `战至第${number(draft?.actualRoundCount, 0)}回合，${terminalText(terminal)}。`,
      `我方：${playerUnits.map(formatUnit).join('；') || '无可用单位'}。`,
      `敌方：${enemyUnits.map(formatUnit).join('；') || '无可用单位'}。`,
      `战局：${advantage}；${trend}。`,
      `下一意图：我方${nextIntents.player}；敌方${nextIntents.enemy}。`,
      `最大风险：${risks[0]}。`,
    ].join('\n');
    return {
      terminalResult: terminal,
      headline: terminalText(terminal),
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
    const draft = input?.draft && typeof input.draft === 'object' ? cloneValue(input.draft) : null;
    if (!draft || text(draft?.status) !== 'DRAFT') throw new Error('battle_report_draft_invalid');
    const draftHash = text(draft?.draftHash);
    delete draft.draftHash;
    if (!draftHash || runtime.hashBattleValue(draft) !== draftHash) throw new Error('BATTLE_COMMIT_HASH_MISMATCH:draft');
    const visibilityMode = normalizeVisibilityMode(input?.visibilityMode || 'PLAYER');
    const ledger = Array.isArray(draft?.ledger) ? draft.ledger.filter(Boolean) : [];
    const directory = buildEntityDirectory(draft, ledger);
    const actionReferences = buildActionReferenceMap(ledger);
    const factRegistry = ledger.map(event => buildFact(event, visibilityMode, directory, actionReferences));
    const factsById = new Map(factRegistry.map(fact => [fact.factId, fact]));
    const actionStarts = new Map(ledger
      .filter(event => text(event?.eventKind) === 'action_start')
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
      if (passiveEventKinds.has(kind) || text(event?.actionRole) === 'STATE_TICK') {
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
      const rootActionId = resolveRootActionId(event, actionStarts);
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
      .map(exchange => exchangePresentation(exchange, factsById))
      .sort((left, right) => left.round - right.round || ledger.findIndex(event => text(event?.eventId) === left.factIds[0]) - ledger.findIndex(event => text(event?.eventId) === right.factIds[0]));
    const roundOverview = buildRoundOverview(draft, ledger, factsById, exchanges, directory);
    roundOverview.forEach(row => {
      row.canonicalFactIds = roundCanonicalFactIds.get(row.round) || [];
    });
    const adjudications = buildAdjudications(draft, exchanges, factsById, directory, visibilityMode);
    const adjudicationByExchange = new Map(adjudications.map(item => [item.exchangeId, item.adjudicationId]));
    exchanges.forEach(exchange => {
      exchange.adjudicationId = adjudicationByExchange.get(exchange.exchangeId) || '';
      exchange.intentSummary = adjudications.find(item => item.exchangeId === exchange.exchangeId)?.reasonSummary || '';
    });
    const finalSummary = buildFinalSummary(draft, roundOverview, directory);
    finalSummary.canonicalFactIds = finalCanonicalFactIds;
    const aiSummaryInput = buildAiSummaryInput(finalSummary, roundOverview);
    factRegistry.forEach(fact => {
      fact.projectionRefs.push({ ownerId: fact.canonicalFactOwner, projection: 'DETAIL' });
      const roundId = `round:${fact.round}`;
      if (fact.canonicalFactOwner !== roundId) fact.projectionRefs.push({ ownerId: roundId, projection: 'ROUND_REFERENCE' });
      if (fact.canonicalFactOwner !== 'final-summary') fact.projectionRefs.push({ ownerId: 'final-summary', projection: 'SUMMARY_REFERENCE' });
    });
    return {
      schemaVersion: reportSchemaVersion,
      visibilityMode,
      actualRoundCount: Math.max(0, number(draft?.actualRoundCount, 0)),
      terminalResult: projectTerminalResult(draft?.terminalResult || {}, visibilityMode, directory),
      projectionStatus: 'PENDING',
      sourceDraftHash: draftHash,
      sourceLedgerCount: ledger.length,
      factRegistry,
      roundOverview,
      exchanges,
      adjudications,
      finalSummary,
      aiSummaryInput,
    };
  }

  function auditProjection(reportDto = {}) {
    const report = reportDto && typeof reportDto === 'object' ? cloneValue(reportDto) : {};
    const fatals = [];
    const pushFatal = (code, detail = {}) => fatals.push({ code, ...detail });
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
        if (!Number.isFinite(Number(token?.value)) || text(token?.sourceEventId) !== factId) {
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
    const expectedRounds = Array.from({ length: Math.max(0, number(report?.actualRoundCount, 0)) }, (_, index) => index + 1);
    const actualRounds = (Array.isArray(report?.roundOverview) ? report.roundOverview : []).map(row => number(row?.round, 0));
    if (JSON.stringify(expectedRounds) !== JSON.stringify(actualRounds)) {
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
      if (/structured-summon:|battle-summon:|summon-instance:/i.test(serialized)) {
        pushFatal('REPORT_VISIBILITY_LEAK', { reason: 'INTERNAL_SUMMON_ID' });
      }
      if (/"ruleCode"|"developerDetail"|"rawDecision"|"candidateId"/.test(serialized)) {
        pushFatal('PLAYER_INTERNAL_RESULT_LEAK', { reason: 'INTERNAL_DECISION_OR_RULE_DATA' });
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
    (Array.isArray(reportDto?.exchanges) ? reportDto.exchanges : []).forEach(exchange => {
      lines.push(`第${number(exchange?.round, 0)}回合 · ${text(exchange?.text) || '交锋已记录'}`);
    });
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
    serializeFullText,
  });
})();

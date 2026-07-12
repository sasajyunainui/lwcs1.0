/* BattleDecision_Module.js - Shadow battle decisions over immutable previews. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const preview = root.__LWCS_BATTLE_PREVIEW__;
  if (!preview || typeof preview.previewAction !== 'function') throw new Error('battle_decision_preview_runtime_missing');

  const VERSION = '7.3-R6.3-decision-2';
  const actionKinds = Object.freeze([
    'BASIC_ATTACK', 'DEFEND', 'EVADE', 'COUNTER', 'OBSERVE',
    'GUARD', 'WITHDRAW', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP',
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
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
        } : undefined,
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
    const next = structuredClone(beliefState || {});
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

  function unknownResponseMass(beliefConfidence = 0) {
    return clamp(0.35 * (1 - clamp(beliefConfidence, 0, 1)), 0, 0.35);
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
        const key = `${skillId(value, output.length)}|${preview.stableHash(value._效果数组)}`;
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
    ['武魂', '武魂列表', '血脉之力', '魂骨', '装备', '自创魂技', '技能'].forEach(key => visit(unit?.[key]));
    return output;
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

  function isEquipment(item = {}) {
    return !!(item?.装备属性 || item?.属性加成 || /装备|武器|护甲|饰品/.test(String(item?.类型 || item?.分类 || '')));
  }

  function equipmentEffects(item = {}) {
    const modifiers = item?.装备属性 || item?.属性加成 || {};
    const effects = Object.entries(modifiers).map(([attribute, value]) => ({ 原型: '属性修正', 目标: '自身', 属性: attribute, 数值: value, 持续回合: 99 }));
    return effects.length ? effects : Array.isArray(item?._效果数组) ? item._效果数组 : [];
  }

  function creationProfile(skill = {}, actor = {}, worldSnapshot = {}) {
    const product = skill?.生成物 || skill?.产物 || skill?.制作产物;
    if (!product) return null;
    const productId = String(product?.id || product?.物品ID || product?.名称 || product?.name || product).trim();
    const stock = collectInventory(actor).filter(entry => entry.id === productId).reduce((sum, entry) => sum + entry.quantity, 0);
    const actorSide = preview.sideOf(worldSnapshot, actor);
    const consumers = aliveEntries(worldSnapshot).filter(entry => entry.side === actorSide && preview.readHp(entry.unit) < preview.readHpMax(entry.unit));
    const productionWindow = Math.max(0, Number(skill?.生产窗口 ?? skill?.生效回合 ?? 1));
    return {
      productId,
      stock,
      consumerIds: consumers.map(entry => preview.unitId(entry.unit)),
      productionWindow,
      useful: !!productId && stock < Math.max(1, consumers.length) && consumers.length > 0 && productionWindow <= Math.max(1, Number(worldSnapshot?.剩余回合 || 20)),
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
      costs[resource] = Math.max(0, String(value).includes('%') ? numeric / 100 : numeric);
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
      return available + 1e-9 >= (cost <= 1 ? maximum * cost : cost);
    });
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
    const friendly = targetableEffects.some(effect => ['状态移除', '规则防御', '机制授予', '召唤生成'].includes(String(effect?.原型 || '').trim()) || Number.parseFloat(String(effect?.数值 || '0')) > 0);
    if (targets.some(target => /全场|群体/.test(target))) return hostile || !friendly ? 'HOSTILE_GROUP' : 'FRIENDLY_GROUP';
    if (targets.some(target => /友方/.test(target))) return 'FRIENDLY_SINGLE';
    if (hostile && friendly) return 'ANY_SINGLE';
    return hostile || !friendly ? 'HOSTILE_SINGLE' : 'FRIENDLY_SINGLE';
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
    const hostile = aliveEntries(worldSnapshot).filter(entry => entry.side !== preview.sideOf(worldSnapshot, actor)).map(entry => entry.unit);
    const candidates = hostile.map(target => {
      const targetId = preview.unitId(target);
      return { candidateId: `${actorId}:basic:${targetId}`, declaration: { actionId: `${actorId}:basic:${targetId}`, actorId, actionKind: 'BASIC_ATTACK', targetIds: [targetId] } };
    });
    ['DEFEND', 'EVADE'].forEach(actionKind => candidates.push({ candidateId: `${actorId}:${actionKind}`, declaration: defensiveDeclaration(actorId, actionKind) }));
    if (input.actionOpportunity?.counterWindow === true) candidates.push({ candidateId: `${actorId}:COUNTER`, declaration: defensiveDeclaration(actorId, 'COUNTER') });
    const allies = aliveEntries(worldSnapshot).filter(entry => entry.side === preview.sideOf(worldSnapshot, actor) && preview.unitId(entry.unit) !== actorId);
    if (allies.length && input.actionOpportunity?.interceptThreat === true) {
      allies.forEach(entry => candidates.push({ candidateId: `${actorId}:GUARD:${preview.unitId(entry.unit)}`, declaration: { actionId: `${actorId}:GUARD:${preview.unitId(entry.unit)}`, actorId, actionKind: 'GUARD', targetIds: [preview.unitId(entry.unit)] } }));
    }
    if (input.beliefState?.observationGranted === true && Number(input.beliefState?.confidence || 0) < 1) {
      candidates.push({ candidateId: `${actorId}:OBSERVE`, declaration: defensiveDeclaration(actorId, 'OBSERVE') });
    }
    if (input.battleIntent?.withdrawAllowed === true) candidates.push({ candidateId: `${actorId}:WITHDRAW`, declaration: defensiveDeclaration(actorId, 'WITHDRAW') });
    collectSkills(actor).forEach((skill, index) => {
      if (!costAffordable(actor, skill)) return;
      const creation = creationProfile(skill, actor, worldSnapshot);
      enumerateTargetSets(worldSnapshot, actor, targetProfile(skill), input.beliefState).forEach((targetIds, targetIndex) => {
        const id = `${actorId}:skill:${skillId(skill, index)}:${targetIndex}`;
        candidates.push({
          candidateId: id,
          declaration: { actionId: id, actorId, actionKind: 'RELEASE_SKILL', targetIds, skill, resourceCosts: parseSkillCosts(skill) },
          skill,
          costs: parseSkillCosts(skill),
          creation,
        });
      });
    });
    const currentEquipmentIds = new Set(Object.values(actor?.装备 || {}).map(item => String(item?.id || item?.物品ID || item?.名称 || item?.name || '')).filter(Boolean));
    const equipmentHistory = new Set(Array.isArray(input?.strategyMemory?.equipmentSignatures) ? input.strategyMemory.equipmentSignatures.map(String) : []);
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
            skill: { id: entry.id, name: skillName(item, index), _效果数组: equipmentEffects(item) },
          },
          equipment: item,
          equipmentSignature: signature,
        });
        return;
      }
      if (!Array.isArray(item?._效果数组) || !item._效果数组.length) return;
      enumerateTargetSets(worldSnapshot, actor, targetProfile(item), input.beliefState).forEach((targetIds, targetIndex) => {
        const id = `${actorId}:item:${entry.id}:${targetIndex}`;
        const scarcity = 1 + 1 / Math.max(1, entry.quantity);
        candidates.push({
          candidateId: id,
          declaration: {
            actionId: id,
            actorId,
            actionKind: 'USE_ITEM',
            targetIds,
            skill: item,
            irreversibleAsset: { assetId: entry.id, quantityBefore: entry.quantity, cost: 6 * scarcity },
          },
          item,
          assetCost: 6 * scarcity,
        });
      });
    });
    return candidates;
  }

  function hasActionCancellation(unit = {}) {
    return Object.values(unit?.状态效果 || {}).some(state => /眩晕|睡眠|冻结|石化/.test(String(state?.状态 || state?.状态名称 || '')) || state?.战斗效果?.cannot_act === true || state?.战斗效果?.skip_turn === true);
  }

  function bestBaseActionValue(worldSnapshot, unit) {
    if (!preview.isAlive(unit) || hasActionCancellation(unit)) return 0;
    const side = preview.sideOf(worldSnapshot, unit);
    const enemies = aliveEntries(worldSnapshot).filter(entry => entry.side !== side).map(entry => entry.unit);
    if (!enemies.length) return 0;
    let best = Math.max(...enemies.map(target => preview.calculateBaseActionValue(unit, target, { actionKind: 'BASIC_ATTACK' })), 0);
    collectSkills(unit).filter(skill => costAffordable(unit, skill)).forEach(skill => {
      const profile = targetProfile(skill);
      const targets = profile === 'SELF' || profile === 'FRIENDLY_SINGLE' || profile === 'FRIENDLY_GROUP' ? [unit] : enemies;
      targets.forEach(target => { best = Math.max(best, preview.calculateBaseActionValue(unit, target, { actionKind: 'RELEASE_SKILL', skill })); });
    });
    return best;
  }

  function perceivedEnemyBaseValue(beliefUnit = {}) {
    const range = Array.isArray(beliefUnit?.strengthRange) ? beliefUnit.strengthRange.map(Number) : [1, 1];
    const upper = Math.max(1, Number(range[1] || range[0] || 1));
    const knownResponses = Array.isArray(beliefUnit?.knownResponses) ? beliefUnit.knownResponses : [];
    return Math.max(8, Math.min(100, 12 + upper * 0.65), ...knownResponses.map(response => Math.max(0, Number(response?.baseActionValue || 0))));
  }

  function teamCapacity(worldSnapshot, side, perspectiveSide, beliefState = {}) {
    return aliveEntries(worldSnapshot).filter(entry => entry.side === side).reduce((sum, entry) => {
      const unit = entry.unit;
      const allied = side === perspectiveSide;
      const beliefUnit = beliefState?.units?.[preview.unitId(unit)] || {};
      const actionUnavailable = allied ? hasActionCancellation(unit) : (beliefUnit.visibleStates || []).some(state => /眩晕|睡眠|冻结|石化/.test(String(state?.name || '')));
      return sum + preview.calculateUnitCapacity({
        unit,
        survivalProbability: preview.readHp(unit) / preview.readHpMax(unit),
        actionAvailability: actionUnavailable ? 0 : 1,
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

  function directDefensiveUtility(actionKind, context = {}) {
    if (context.stalemate && context.actionOpportunity?.imminentThreat !== true && context.actionOpportunity?.counterWindow !== true) return 0;
    if (actionKind === 'DEFEND') return 1.5;
    if (actionKind === 'EVADE') return 1.25;
    if (actionKind === 'COUNTER') return 1.75;
    if (actionKind === 'GUARD') return 1.5;
    if (actionKind === 'OBSERVE') return 1;
    if (actionKind === 'WITHDRAW') return 0.5;
    return 0;
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
    const terminalEnemy = aliveEntries(worldSnapshot).filter(entry => entry.side !== actorSide).find(entry => Number(beliefState?.units?.[preview.unitId(entry.unit)]?.hpRatio ?? 1) <= 0.2);
    if (terminalEnemy) problems.push({ problemId: 'TERMINAL_OPPORTUNITY', targetIds: [preview.unitId(terminalEnemy.unit)], severity: 20 });
    if (Number(beliefState?.confidence || 0) < 0.45) problems.push({ problemId: 'INFORMATION_DEFICIT', severity: (0.45 - Number(beliefState?.confidence || 0)) * 40 });
    if (!problems.length) problems.push({ problemId: 'NEUTRAL_PROGRESS', severity: 1 });
    return problems.sort((left, right) => right.severity - left.severity);
  }

  function responseBranches(candidate, context, afterUtility) {
    const targetId = candidate.declaration.targetIds?.[0] || '';
    const known = Array.isArray(context.beliefState?.publicResponses?.[targetId]) ? context.beliefState.publicResponses[targetId] : [];
    const unknownMass = unknownResponseMass(context.beliefState?.confidence);
    const knownMass = 1 - unknownMass;
    const utilities = known.map(response => Number(response?.utility || 0));
    const center = median(utilities);
    const mad = Math.max(1, median(utilities.map(value => Math.abs(value - center))));
    const temperature = 1 + 3 * (1 - clamp(context.beliefState?.confidence || 0, 0, 1));
    const weighted = known.map(response => ({
      ...response,
      weight: Math.exp(((Number(response?.utility || 0) - center) / mad) / temperature),
    })).sort((left, right) => right.weight - left.weight);
    const totalWeight = weighted.reduce((sum, response) => sum + response.weight, 0) || 1;
    const normalizedKnown = weighted.map(response => ({
      responseId: String(response.responseId || ''),
      probability: knownMass * response.weight / totalWeight,
      utility: Number(response.utility || 0),
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
      const threatEnvelope = Math.max(0, perceivedEnemyBaseValue(targetBelief), Math.abs(afterUtility.enemy || 0));
      branches.unshift({ responseId: 'UNKNOWN_RESPONSE_ENVELOPE', probability: unknownMass, utility: -threatEnvelope, unknown: true });
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

  function scoreCandidate(candidate, context) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    const actorSide = preview.sideOf(context.worldSnapshot, actor);
    const before = context.beforeUtility;
    let result;
    if (['RELEASE_SKILL', 'BASIC_ATTACK', 'USE_ITEM', 'EQUIP'].includes(candidate.declaration.actionKind)) {
      result = preview.previewAction({
        worldSnapshot: context.worldSnapshot,
        beliefSnapshot: context.beliefState,
        actorId: context.actorId,
        declaration: candidate.declaration,
        horizon: 'SHALLOW',
        previewBudget: { maxNodes: 12 },
      });
    }
    const after = result ? stateUtility(result.afterSnapshot, actorSide, context.beliefState) : before;
    let expectedStateGain = result
      ? 100 * (after.utility - before.utility) / Math.max(1, before.total)
      : directDefensiveUtility(candidate.declaration.actionKind, context);
    const actionCancelled = (result?.contributions || []).some(entry => entry.outcomeKind === 'ACTION_CANCELLED');
    let mechanicProbability = 1;
    if (actionCancelled) {
      const controlEffect = (candidate.skill?._效果数组 || []).find(effect => String(effect?.原型 || '') === '状态施加');
      const targetId = candidate.declaration.targetIds?.[0] || '';
      const key = mechanicKey({ sourceActionId: candidate.candidateId, effectPrototype: controlEffect?.原型 || '状态施加', targetId, beliefState: context.beliefState });
      mechanicProbability = mechanicPosterior(context.beliefState, key, probabilityValue(controlEffect?.成功率, 0.65), experienceOf(actor));
      const target = preview.findUnit(context.worldSnapshot, targetId);
      const targetBelief = context.beliefState?.units?.[targetId] || {};
      const cancelledCapacity = Number(targetBelief.hpRatio ?? (target ? preview.readHp(target) / preview.readHpMax(target) : 0)) * perceivedEnemyBaseValue(targetBelief);
      const direction = target && preview.sideOf(context.worldSnapshot, target) === actorSide ? -1 : 1;
      expectedStateGain += direction * 100 * cancelledCapacity / Math.max(1, before.total) * mechanicProbability;
    }
    const summonEvents = (result?.scheduledEvents || []).filter(event => event.type === 'SUMMON_CREATE');
    summonEvents.forEach(event => {
      const modeFactor = event.actionMode === '护卫' ? 0.8 : event.actionMode === '协同攻击' ? 0.9 : event.actionMode === '自主行动' ? 1 : 0;
      const actionWindows = Math.max(0, Number(event.duration || 0));
      expectedStateGain += 100 * bestBaseActionValue(context.worldSnapshot, actor) * modeFactor * actionWindows * Math.max(1, Number(event.count || 1)) / Math.max(1, before.total);
    });
    if (candidate.creation?.useful) {
      expectedStateGain += 100 * Math.min(20, candidate.creation.consumerIds.length * 6) / Math.max(1, before.total);
    }
    const informationValue = candidate.declaration.actionKind === 'OBSERVE' ? clamp(1 - Number(context.beliefState?.confidence || 0), 0, 1) * 8 : 0;
    const irreversibleContributions = (result?.contributions || []).filter(entry => entry.outcomeKind === 'IRREVERSIBLE_ASSET_LOST');
    const irreversibleCost = irreversibleContributions.reduce((sum, entry) => sum + (Number(entry.threatValue) > 0 ? Number(entry.threatValue) : 20), 0);
    const deepRequired = result ? needsDeepPreview(candidate, result, context.worldSnapshot, result.afterSnapshot, context.beliefState) : false;
    const branches = deepRequired ? responseBranches(candidate, context, after) : [];
    const responseRisk = branches.reduce((sum, branch) => sum + (branch.utility < 0 ? Math.abs(branch.utility) * branch.probability : 0), 0);
    const catastrophicRisk = (result?.contributions || []).filter(entry => entry.outcomeKind === 'TAIL_FAILURE').reduce((sum, entry) => sum + Math.abs(entry.threatValue), 0) + responseRisk;
    const objectiveUtility = clamp(expectedStateGain + informationValue - irreversibleCost - catastrophicRisk, -200, 200);
    const hasProgress = Math.abs(expectedStateGain) > 0.0001 || informationValue > 0 || directDefensiveUtility(candidate.declaration.actionKind, context) > 0;
    const hasCost = Object.keys(candidate.costs || {}).length > 0 || irreversibleCost > 0 || ['EQUIP', 'USE_ITEM'].includes(candidate.declaration.actionKind);
    const summonWindowMissing = summonEvents.some(event => !event.actionMode || Number(event.duration || 0) <= 0);
    const lifecycleReject = candidate.creation && !candidate.creation.useful ? 'ZERO_EFFECT_COSTLY' : summonWindowMissing ? 'SUMMON_NO_ACTION_WINDOW' : '';
    return {
      ...candidate,
      preview: result || null,
      objectiveUtility,
      deepAnalysis: Object.freeze({ required: deepRequired, nodeCount: deepRequired ? 1 + branches.length : 1, responseBranches: Object.freeze(branches), mechanicProbability }),
      vector: {
        expectedStateGain,
        informationValue,
        resourcePreservation: -Object.values(candidate.costs || {}).reduce((sum, value) => sum + Number(value || 0), 0),
        survivalLowerBound: after.own,
        irreversibleCost,
        catastrophicRisk,
      },
      rejectionCode: lifecycleReject || (!hasProgress && hasCost ? 'ZERO_EFFECT_COSTLY' : !hasProgress ? 'ZERO_PROGRESS' : ''),
    };
  }

  function dominates(left, right) {
    const gains = ['expectedStateGain', 'informationValue', 'resourcePreservation', 'survivalLowerBound'];
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

  function selectCandidate(candidates, actor, seed, context = {}) {
    const preferredTargets = new Set([
      ...(Array.isArray(context.strategyMemory?.targetIds) ? context.strategyMemory.targetIds : []),
      context.teamIntent?.focusTarget,
      context.teamIntent?.protectTarget,
    ].map(String).filter(Boolean));
    const tiePreference = candidate => (candidate.declaration.targetIds || []).some(targetId => preferredTargets.has(String(targetId))) ? 1 : 0;
    const eligible = candidates.filter(candidate => !candidate.rejectionCode).sort((left, right) => {
      const utilityGap = right.normalizedUtility - left.normalizedUtility;
      if (Math.abs(utilityGap) > 0.05) return utilityGap;
      return tiePreference(right) - tiePreference(left) || left.candidateId.localeCompare(right.candidateId);
    });
    if (!eligible.length) {
      const defend = candidates.find(candidate => candidate.declaration.actionKind === 'DEFEND');
      if (!defend) throw new Error('battle_decision_no_legal_fallback');
      return { selected: defend, confidence: 1, temperature: 0, maxNormalizedRegret: 0 };
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
    const actor = preview.findUnit(worldSnapshot, input.actorId);
    if (!actor || !preview.isAlive(actor)) throw new Error('battle_decision_actor_unavailable');
    const actorSide = preview.sideOf(worldSnapshot, actor);
    const beliefState = buildInitialBelief(worldSnapshot, preview.unitId(actor), input.beliefState || {});
    const teamIntent = buildTeamIntent(worldSnapshot, preview.unitId(actor), beliefState);
    const problems = identifyProblems(worldSnapshot, preview.unitId(actor), beliefState);
    const signature = strategicSignature(worldSnapshot, beliefState);
    const stalemate = detectStalemate(input.strategicHistory, signature);
    const context = {
      ...input,
      actorId: preview.unitId(actor),
      beliefState,
      teamIntent,
      problems,
      strategicSignature: signature,
      stalemate,
      beforeUtility: stateUtility(worldSnapshot, actorSide, beliefState),
    };
    const generated = enumerateCandidates(context);
    if (!generated.length) throw new Error('battle_decision_candidate_pool_empty');
    const scored = generated.map(candidate => scoreCandidate(candidate, context));
    const normalized = normalizeUtilities(paretoFilter(scored));
    const strategyMemory = activeStrategyMemory(input.strategyMemory, worldSnapshot, input.actionOpportunity, normalized);
    const choice = selectCandidate(normalized, actor, input.seed || 1, { ...context, strategyMemory });
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
        equipmentSignatures: Object.freeze(selected.equipmentSignature ? [...new Set([...(input.strategyMemory?.equipmentSignatures || []), selected.equipmentSignature])] : [...(input.strategyMemory?.equipmentSignatures || [])]),
      }),
      scoreAudit: Object.freeze([selected, ...alternatives].map(candidate => Object.freeze({
        candidateId: candidate.candidateId,
        actionKind: candidate.declaration.actionKind,
        actorId: preview.unitId(actor),
        targetIds: Object.freeze([...(candidate.declaration.targetIds || [])]),
        objectiveUtility: candidate.objectiveUtility,
        normalizedUtility: candidate.normalizedUtility,
        vector: Object.freeze({ ...candidate.vector }),
        deepAnalysis: candidate.deepAnalysis,
        rejectionCode: candidate.rejectionCode || '',
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

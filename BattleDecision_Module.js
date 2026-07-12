/* BattleDecision_Module.js - Shadow battle decisions over immutable previews. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const preview = root.__LWCS_BATTLE_PREVIEW__;
  if (!preview || typeof preview.previewAction !== 'function') throw new Error('battle_decision_preview_runtime_missing');

  const VERSION = '7.3-R6.3-decision-1';
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
      enumerateTargetSets(worldSnapshot, actor, targetProfile(skill), input.beliefState).forEach((targetIds, targetIndex) => {
        const id = `${actorId}:skill:${skillId(skill, index)}:${targetIndex}`;
        candidates.push({
          candidateId: id,
          declaration: { actionId: id, actorId, actionKind: 'RELEASE_SKILL', targetIds, skill, resourceCosts: parseSkillCosts(skill) },
          skill,
          costs: parseSkillCosts(skill),
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

  function teamCapacity(worldSnapshot, side) {
    return aliveEntries(worldSnapshot).filter(entry => entry.side === side).reduce((sum, entry) => {
      const unit = entry.unit;
      return sum + preview.calculateUnitCapacity({
        unit,
        survivalProbability: preview.readHp(unit) / preview.readHpMax(unit),
        actionAvailability: hasActionCancellation(unit) ? 0 : 1,
        bestLegalBaseActionValue: bestBaseActionValue(worldSnapshot, unit),
      });
    }, 0);
  }

  function stateUtility(worldSnapshot, actorSide) {
    const sides = [...new Set(preview.listUnits(worldSnapshot).map(entry => entry.side))];
    const own = teamCapacity(worldSnapshot, actorSide);
    const enemy = sides.filter(side => side !== actorSide).reduce((sum, side) => sum + teamCapacity(worldSnapshot, side), 0);
    return { own, enemy, total: own + enemy, utility: own - enemy };
  }

  function directDefensiveUtility(actionKind) {
    if (actionKind === 'DEFEND') return 1.5;
    if (actionKind === 'EVADE') return 1.25;
    if (actionKind === 'COUNTER') return 1.75;
    if (actionKind === 'GUARD') return 1.5;
    if (actionKind === 'OBSERVE') return 1;
    if (actionKind === 'WITHDRAW') return 0.5;
    return 0;
  }

  function scoreCandidate(candidate, context) {
    const actor = preview.findUnit(context.worldSnapshot, context.actorId);
    const actorSide = preview.sideOf(context.worldSnapshot, actor);
    const before = context.beforeUtility;
    let result;
    if (candidate.declaration.actionKind === 'RELEASE_SKILL' || candidate.declaration.actionKind === 'BASIC_ATTACK') {
      result = preview.previewAction({
        worldSnapshot: context.worldSnapshot,
        beliefSnapshot: context.beliefState,
        actorId: context.actorId,
        declaration: candidate.declaration,
        horizon: 'SHALLOW',
        previewBudget: { maxNodes: 12 },
      });
    }
    const after = result ? stateUtility(result.afterSnapshot, actorSide) : before;
    const expectedStateGain = result
      ? 100 * (after.utility - before.utility) / Math.max(1, before.total)
      : directDefensiveUtility(candidate.declaration.actionKind);
    const informationValue = candidate.declaration.actionKind === 'OBSERVE' ? clamp(1 - Number(context.beliefState?.confidence || 0), 0, 1) * 8 : 0;
    const irreversibleCost = (result?.contributions || []).filter(entry => entry.outcomeKind === 'IRREVERSIBLE_ASSET_LOST').length * 20;
    const catastrophicRisk = (result?.contributions || []).filter(entry => entry.outcomeKind === 'TAIL_FAILURE').reduce((sum, entry) => sum + Math.abs(entry.threatValue), 0);
    const objectiveUtility = clamp(expectedStateGain + informationValue - irreversibleCost - catastrophicRisk, -200, 200);
    const hasProgress = Math.abs(expectedStateGain) > 0.0001 || informationValue > 0 || directDefensiveUtility(candidate.declaration.actionKind) > 0;
    const hasCost = Object.keys(candidate.costs || {}).length > 0 || irreversibleCost > 0;
    return {
      ...candidate,
      preview: result || null,
      objectiveUtility,
      vector: {
        expectedStateGain,
        informationValue,
        resourcePreservation: -Object.values(candidate.costs || {}).reduce((sum, value) => sum + Number(value || 0), 0),
        survivalLowerBound: after.own,
        irreversibleCost,
        catastrophicRisk,
      },
      rejectionCode: !hasProgress && hasCost ? 'ZERO_EFFECT_COSTLY' : !hasProgress ? 'ZERO_PROGRESS' : '',
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

  function selectCandidate(candidates, actor, seed) {
    const eligible = candidates.filter(candidate => !candidate.rejectionCode).sort((left, right) => right.normalizedUtility - left.normalizedUtility || left.candidateId.localeCompare(right.candidateId));
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
    const context = {
      ...input,
      actorId: preview.unitId(actor),
      beliefState: input.beliefState && typeof input.beliefState === 'object' ? input.beliefState : {},
      beforeUtility: stateUtility(worldSnapshot, actorSide),
    };
    const generated = enumerateCandidates(context);
    if (!generated.length) throw new Error('battle_decision_candidate_pool_empty');
    const scored = generated.map(candidate => scoreCandidate(candidate, context));
    const normalized = normalizeUtilities(paretoFilter(scored));
    const choice = selectCandidate(normalized, actor, input.seed || 1);
    const selected = { ...choice.selected, selected: true };
    const alternatives = normalized.filter(candidate => candidate.candidateId !== selected.candidateId).sort((a, b) => b.objectiveUtility - a.objectiveUtility).slice(0, 2);
    return Object.freeze({
      version: VERSION,
      actorId: preview.unitId(actor),
      candidateCount: normalized.length,
      paretoCount: normalized.filter(candidate => !candidate.rejectionCode).length,
      candidates: Object.freeze(normalized),
      selected: Object.freeze(selected),
      scoreAudit: Object.freeze([selected, ...alternatives].map(candidate => Object.freeze({
        candidateId: candidate.candidateId,
        actionKind: candidate.declaration.actionKind,
        actorId: preview.unitId(actor),
        targetIds: Object.freeze([...(candidate.declaration.targetIds || [])]),
        objectiveUtility: candidate.objectiveUtility,
        normalizedUtility: candidate.normalizedUtility,
        vector: Object.freeze({ ...candidate.vector }),
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
    stateUtility,
    dominates,
    paretoFilter,
    normalizeUtilities,
    decide,
  });
})();

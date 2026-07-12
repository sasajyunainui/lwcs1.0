/* BattleRuntime_Module.js - Battle runtime boundary and shared contracts. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_runtime_shared_prototype_registry_missing');
  }

  const actionKinds = Object.freeze([
    'BASIC_ATTACK', 'DEFEND', 'EVADE', 'COUNTER', 'OBSERVE',
    'GUARD', 'WITHDRAW', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP',
  ]);
  const actionRoles = Object.freeze(['ACTIVE', 'REACTION', 'COUNTER', 'ASSIST', 'STATE_TICK']);
  const reportBlockTypes = Object.freeze([
    'ACTION_DECLARED', 'ACTION_RESOLVED', 'REACTION_RESOLVED', 'STATE_TICK',
    'SUMMON_ACTION', 'RESOURCE_CHANGE', 'ROUND_SUMMARY', 'FINAL_SUMMARY',
  ]);
  const positiveScoreParts = Object.freeze([
    'effectiveDeltaEV', 'futureUnlockEV', 'enemyDeniedEV', 'teamIntentEV', 'sustainEV',
  ]);
  const costScoreParts = Object.freeze([
    'resourceCostEV', 'failureRiskEV', 'exposureRiskEV', 'chainConflictEV',
  ]);
  const scorePartKeys = Object.freeze([...positiveScoreParts, ...costScoreParts]);
  const prototypeRuntimeContract = Object.freeze({
    伤害结算: Object.freeze({ component: 'effectiveDeltaEV', settlementConsumers: Object.freeze(['direct_damage', 'multi_damage', 'delay_burst']), factTypes: Object.freeze(['DAMAGE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    资源变化: Object.freeze({ component: 'sustainEV', settlementConsumers: Object.freeze(['recover_sp', 'recover_men', 'recover_vit', 'delay_burst']), factTypes: Object.freeze(['RESOURCE']), reportBlockTypes: Object.freeze(['RESOURCE_CHANGE']) }),
    资源转移: Object.freeze({ component: 'sustainEV', settlementConsumers: Object.freeze(['resource_refeed', 'resource_drain']), factTypes: Object.freeze(['RESOURCE']), reportBlockTypes: Object.freeze(['RESOURCE_CHANGE']) }),
    护盾变化: Object.freeze({ component: 'effectiveDeltaEV', settlementConsumers: Object.freeze(['shield', 'shield_break', 'delay_burst']), factTypes: Object.freeze(['SHIELD']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    属性修正: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['attribute_buff', 'attribute_debuff', 'delay_burst']), factTypes: Object.freeze(['ATTRIBUTE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    判定修正: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['judge_effect']), factTypes: Object.freeze(['CHECK_MODIFIER']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    结算修正: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['skill_effect_amplify', 'damage_reflect', 'damage_transfer', 'damage_absorb', 'damage_to_heal', 'heal_to_damage', 'damage_share', 'cost_share', 'armor_penetration', 'counter', 'dot_detonate', 'power_amplify', 'damage_reduce', 'expose_weakness', 'heal_amplify', 'cost_reduce', 'cost_increase', 'windup_reduce', 'windup_increase']), factTypes: Object.freeze(['SETTLEMENT_MODIFIER']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    炸环: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['ring_burst_gain']), factTypes: Object.freeze(['RING_BURST']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    状态施加: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['dot_damage', 'hard_control', 'position_lock', 'skill_seal', 'silence', 'disarm', 'blind', 'anti_heal', 'heal_inversion', 'stealth', 'sense_block', 'shield', 'super_armor', 'resource_burn', 'recover_over_time', 'shared_vision', 'target_lock', 'guard', 'taunt', 'judge_effect']), factTypes: Object.freeze(['STATE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED', 'STATE_TICK']) }),
    时窗修正: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['time_window', 'dot_detonate']), factTypes: Object.freeze(['WINDOW']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    状态移除: Object.freeze({ component: 'effectiveDeltaEV', settlementConsumers: Object.freeze(['reveal', 'cleanse']), factTypes: Object.freeze(['STATE_REMOVE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    规则防御: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['block', 'death_save']), factTypes: Object.freeze(['RULE_DEFENSE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    状态转移: Object.freeze({ component: 'effectiveDeltaEV', settlementConsumers: Object.freeze(['status_transfer']), factTypes: Object.freeze(['STATE_TRANSFER']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    状态交换: Object.freeze({ component: 'effectiveDeltaEV', settlementConsumers: Object.freeze(['status_exchange']), factTypes: Object.freeze(['STATE_EXCHANGE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    资源锁定: Object.freeze({ component: 'enemyDeniedEV', settlementConsumers: Object.freeze(['resource_lock']), factTypes: Object.freeze(['RESOURCE_LOCK']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    规则改写: Object.freeze({ component: 'enemyDeniedEV', settlementConsumers: Object.freeze(['disarm', 'rule_rewrite']), factTypes: Object.freeze(['RULE_REWRITE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    机制抹消: Object.freeze({ component: 'enemyDeniedEV', settlementConsumers: Object.freeze(['mechanism_suppress']), factTypes: Object.freeze(['MECHANISM_SUPPRESS']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    机制授予: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['mechanism_grant']), factTypes: Object.freeze(['MECHANISM_GRANT']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    复制执行: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['copy']), factTypes: Object.freeze(['COPY']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    时光回溯: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['time_rewind']), factTypes: Object.freeze(['TIME_REWIND']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED', 'REACTION_RESOLVED']) }),
    位移执行: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['position_exchange', 'self_shift', 'disengage_shift', 'pursuit_shift', 'hostile_shift']), factTypes: Object.freeze(['POSITION']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    决策干扰: Object.freeze({ component: 'enemyDeniedEV', settlementConsumers: Object.freeze(['judge_effect']), factTypes: Object.freeze(['DECISION_INTERFERENCE']), reportBlockTypes: Object.freeze(['ACTION_RESOLVED']) }),
    召唤生成: Object.freeze({ component: 'futureUnlockEV', settlementConsumers: Object.freeze(['summon']), factTypes: Object.freeze(['SUMMON']), reportBlockTypes: Object.freeze(['SUMMON_ACTION']) }),
  });
  const prototypeManifest = Object.freeze(
    Object.values(prototypeRegistry)
      .filter(definition => String(definition?.类别 || '').trim() !== '战斗外')
      .map(definition => Object.freeze({
        name: String(definition?.原型 || '').trim(),
        runtimeScope: 'BATTLE',
        fields: Object.freeze([...(definition?.允许字段 || [])]),
        requiredFields: Object.freeze([...(definition?.必填字段 || [])]),
        fieldOptions: Object.freeze(Object.fromEntries(
          Object.entries(definition?.字段定义 || {})
            .filter(([, field]) => Array.isArray(field?.选项))
            .map(([fieldName, field]) => [fieldName, Object.freeze([...field.选项])]),
        )),
      }))
      .filter(entry => entry.name),
  );
  const prototypeOptionMatrix = Object.freeze(
    prototypeManifest.flatMap(entry => Object.entries(entry.fieldOptions).flatMap(([field, options]) =>
      options
        .filter(option => field !== '原型' || option === entry.name)
        .map(option => Object.freeze({
        prototype: entry.name,
        field,
        option,
        optionKey: `${entry.name}:${field}:${String(option)}`,
        })),
    )),
  );
  const nestedEffectFields = Object.freeze([...(sharedRegistry?.嵌套效果数组字段 || [])]);
  const conditionalEffectFields = Object.freeze([...(sharedRegistry?.条件分支效果数组字段 || [])]);
  const engineState = { implementation: null };
  let runtimeIdSequence = 0;

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function nextRuntimeId(prefix = 'battle-event') {
    runtimeIdSequence = (runtimeIdSequence + 1) % 1000000;
    return `${String(prefix || 'battle-event')}-${Date.now().toString(36)}-${runtimeIdSequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ensureLedger(combatData = {}) {
    if (!combatData || typeof combatData !== 'object') return [];
    if (!Object.prototype.hasOwnProperty.call(combatData, '__battleEventLedger')) {
      Object.defineProperty(combatData, '__battleEventLedger', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: [],
      });
    }
    if (!Array.isArray(combatData.__battleEventLedger)) combatData.__battleEventLedger = [];
    return combatData.__battleEventLedger;
  }

  function attachLedger(combatData = {}, ledger = []) {
    if (!combatData || typeof combatData !== 'object') return [];
    const value = Array.isArray(ledger) ? ledger : [];
    Object.defineProperty(combatData, '__battleEventLedger', {
      enumerable: false,
      configurable: true,
      writable: true,
      value,
    });
    return value;
  }

  function ensureTrace(combatData = {}) {
    const rootData = combatData?.__父级战斗数据 || combatData;
    if (!rootData || typeof rootData !== 'object') return [];
    if (!Object.prototype.hasOwnProperty.call(rootData, '__battleResolutionTrace')) {
      Object.defineProperty(rootData, '__battleResolutionTrace', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: [],
      });
    }
    if (!Array.isArray(rootData.__battleResolutionTrace)) rootData.__battleResolutionTrace = [];
    return rootData.__battleResolutionTrace;
  }

  function probabilitySucceeds(probability, roll = Math.random()) {
    const normalizedProbability = Math.max(0, Math.min(1, Number(probability) || 0));
    if (normalizedProbability <= 0) return false;
    if (normalizedProbability >= 1) return true;
    const normalizedRoll = Math.max(0, Math.min(1, Number(roll) || 0));
    return normalizedRoll < normalizedProbability;
  }

  function stableUnitRoll(seedText = '') {
    const text = String(seedText || 'battle-decision');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  }

  function buildDecisionProfile(input = {}) {
    const clampRatio = value => Math.max(0, Math.min(1, Number(value) || 0));
    const experienceStability = clampRatio(input?.experienceStability);
    const spiritualPowerRatio = clampRatio(input?.spiritualPowerRatio);
    const staminaRatio = clampRatio(input?.staminaRatio);
    const bestObjectiveScore = Number(input?.bestObjectiveScore || 0);
    const decisionConfidence = 0.5 * experienceStability + 0.3 * spiritualPowerRatio + 0.2 * staminaRatio;
    const temperature = 4 + (1 - decisionConfidence) * 10;
    const maxRegret = Math.max(5, Math.abs(bestObjectiveScore) * (0.05 + 0.2 * (1 - decisionConfidence)));
    return { decisionConfidence, temperature, maxRegret };
  }

  function normalizeDecisionScores(scores = []) {
    const values = (Array.isArray(scores) ? scores : []).map(value => Number(value) || 0);
    const sorted = [...values].sort((left, right) => left - right);
    const medianAt = list => {
      if (!list.length) return 0;
      const middle = Math.floor(list.length / 2);
      return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
    };
    const median = medianAt(sorted);
    const deviations = values.map(value => Math.abs(value - median)).sort((left, right) => left - right);
    const mad = medianAt(deviations);
    const robustScale = Math.max(1, mad * 1.4826);
    return values.map(value => (value - median) / robustScale * 10);
  }

  function createActionQueue(options = {}) {
    const round = Math.max(0, Number(options?.round || 0));
    const pending = [];
    const granted = new Set();
    const normalizeRole = typeof options?.normalizeRole === 'function'
      ? options.normalizeRole
      : value => String(value || 'ACTIVE').trim().toUpperCase();
    const normalizeActionName = typeof options?.normalizeActionName === 'function'
      ? options.normalizeActionName
      : value => String(value || '').trim();
    const describeActor = typeof options?.describeActor === 'function'
      ? options.describeActor
      : entry => String(entry?.char?.name || entry?.char?.名称 || '').trim();
    const onTrace = typeof options?.onTrace === 'function' ? options.onTrace : () => {};
    const onFatal = typeof options?.onFatal === 'function' ? options.onFatal : () => {};
    let insertionSequence = 0;
    let actionSequence = 0;
    let fatal = null;
    const compareNodes = (left, right) =>
      Number(left.round || 0) - Number(right.round || 0) ||
      Number(left.actorTurnSequence || 0) - Number(right.actorTurnSequence || 0) ||
      Number(left.parentActionSequence || 0) - Number(right.parentActionSequence || 0) ||
      Number(left.phasePriority || 0) - Number(right.phasePriority || 0) ||
      Number(left.insertionSequence || 0) - Number(right.insertionSequence || 0);
    const recordTrace = (state, node, detail = {}) => {
      onTrace({
        state,
        round: Number(node?.round || round || 0),
        actionSequence: Number(node?.actionSequence || 0),
        parentActionSequence: Number(node?.parentActionSequence || 0),
        actorTurnSequence: Number(node?.actorTurnSequence || 0),
        phasePriority: Number(node?.phasePriority || 0),
        insertionSequence: Number(node?.insertionSequence || 0),
        grantId: String(node?.grantId || '').trim(),
        actorName: describeActor(node?.actorEntry),
        nodeKind: String(node?.nodeKind || 'ACTIVE').trim(),
        actionRole: normalizeRole(node?.actionRole || 'ACTIVE'),
        sourceActionId: String(node?.sourceActionId || '').trim(),
        ...detail,
      });
    };
    const fail = (code, node = null, detail = {}) => {
      if (fatal) return false;
      fatal = { code, ...detail };
      recordTrace('FATAL', node, { code, ...detail });
      onFatal(fatal, node);
      return false;
    };
    const enqueue = (input = {}) => {
      if (fatal) return false;
      const actorName = describeActor(input?.actorEntry);
      const grantId = String(input.grantId || `natural:${round}:${actorName}:${insertionSequence + 1}`).trim();
      if (granted.has(grantId)) return fail('ACTION_GRANT_DUPLICATE', input, { grantId });
      if (actionSequence >= 64) return fail('ACTION_QUEUE_NODE_LIMIT_EXCEEDED', input, { maxNodes: 64 });
      granted.add(grantId);
      const node = {
        round: Number(input.round || round || 0),
        actorEntry: input.actorEntry,
        state: input.state && typeof input.state === 'object' ? input.state : {},
        actorTurnSequence: Math.max(0, Number(input.actorTurnSequence || 0)),
        parentActionSequence: Math.max(0, Number(input.parentActionSequence || 0)),
        phasePriority: Math.max(0, Number(input.phasePriority || 40)),
        insertionSequence: ++insertionSequence,
        actionSequence: ++actionSequence,
        grantId,
        nodeKind: String(input.nodeKind || 'ACTIVE').trim(),
        actionRole: normalizeRole(input.actionRole || 'ACTIVE'),
        sourceActionId: String(input.sourceActionId || '').trim(),
        actionName: normalizeActionName(input.actionName || ''),
        execute: typeof input.execute === 'function' ? input.execute : null,
      };
      pending.push(node);
      recordTrace('ENQUEUED', node);
      return true;
    };
    (Array.isArray(options?.initialEntries) ? options.initialEntries : []).forEach((actorEntry, index) => {
      enqueue({
        actorEntry,
        actorTurnSequence: index + 1,
        parentActionSequence: 0,
        phasePriority: 40,
        grantId: `natural:${round}:${actorEntry?.side || ''}:${describeActor(actorEntry) || 'unit'}:${index + 1}`,
      });
    });
    return {
      enqueue,
      dequeue() {
        pending.sort(compareNodes);
        return pending.shift() || null;
      },
      recordTrace,
      fail,
      get fatal() { return fatal; },
      get pendingCount() { return pending.length; },
    };
  }

  function runTeamBattle(options = {}) {
    const combatData = options?.combatData;
    const adapters = options?.adapters;
    if (!combatData || typeof combatData !== 'object' || !adapters) throw new TypeError('battle_team_runner_contract_invalid');
    const mode = options?.mode === 'multi_round' ? 'multi_round' : 'single_round';
    const roundLimit = mode === 'multi_round' ? Math.max(1, Number(options?.maxRounds || 1)) : 1;
    adapters.prepare?.(combatData);
    const rejected = adapters.validate?.(combatData);
    if (rejected) return rejected;
    const logs = [];
    const extraPatchOps = [];
    const startingRound = Number(combatData.回合 || 0);
    let rounds = 0;
    let lastAlive = adapters.readAlive(combatData);
    while (rounds < roundLimit) {
      rounds += 1;
      const currentRound = startingRound + rounds;
      combatData.回合 = currentRound;
      const beginLogs = adapters.beginRound?.(combatData, currentRound);
      if (Array.isArray(beginLogs)) logs.push(...beginLogs.filter(Boolean));
      const queue = adapters.buildQueue(combatData);
      adapters.recordQueue?.(queue, combatData, logs);
      const queueResult = adapters.executeQueue(queue, combatData, currentRound, logs, extraPatchOps);
      if (queueResult?.fatal) {
        logs.push(`[行动队列中止] ${queueResult.fatal.code}`);
      } else {
        adapters.settleRoundEnd?.(combatData, logs);
      }
      lastAlive = adapters.readAlive(combatData);
      logs.push(`[团战回合总结] 我方存活:${lastAlive.playerAlive} 敌方存活:${lastAlive.enemyAlive}`);
      if (queueResult?.fatal || lastAlive.playerAlive <= 0 || lastAlive.enemyAlive <= 0) break;
    }
    const winner = lastAlive.enemyAlive <= 0 ? 'player' : lastAlive.playerAlive <= 0 ? 'enemy' : 'unfinished';
    adapters.finalize?.({ combatData, mode, winner, logs, alive: lastAlive });
    return {
      rounds,
      roundStart: startingRound + 1,
      roundEnd: Number(combatData.回合 || startingRound),
      winner,
      playerAlive: lastAlive.playerAlive,
      enemyAlive: lastAlive.enemyAlive,
      logs,
      extraPatchOps,
    };
  }

  function calculateObjectiveScore(scoreParts = {}) {
    const source = scoreParts && typeof scoreParts === 'object' ? scoreParts : {};
    return Math.round(
      positiveScoreParts.reduce((sum, key) => sum + Number(source[key] || 0), 0) -
      costScoreParts.reduce((sum, key) => sum + Number(source[key] || 0), 0),
    );
  }

  function calculateBaseDamage(options = {}) {
    const damageClass = String(options?.damageClass || '').trim().toUpperCase();
    const damageType = String(options?.damageType || '').trim();
    const power = Math.max(0, Number(options?.power || 0));
    const attack = Math.max(1, Number(options?.attack || 1));
    const defense = Math.max(1, Number(options?.defense || 1));
    const soulScale = Math.max(0, Number(options?.soulScale ?? 1));
    const spiritScale = Math.max(0, Number(options?.spiritScale ?? 1));
    const positionScale = Math.max(0, Number(options?.positionScale ?? 1));
    const costScale = Math.max(0, Number(options?.costScale ?? 1));
    const contactScale = Math.max(0, Number(options?.contactScale ?? 1.04));
    let damage = 0;
    let formula = '';
    if (damageClass === 'TRUE') {
      damage = power * Math.max(1, Math.sqrt(attack)) * 0.12 * costScale;
      formula = '威力×√真实驱动×0.12×消耗加成';
    } else if (damageClass === 'MELEE') {
      damage = power * (attack / defense) * soulScale * positionScale * contactScale * costScale;
      formula = '威力×(力量/有效防御)×魂力驱动×定位×近身系数×消耗加成';
    } else if (damageClass === 'RANGED') {
      damage = power * (attack / defense) * soulScale * positionScale * costScale;
      formula = '威力×(远程物理攻势/有效防御)×魂力驱动×定位×消耗加成';
    } else if (damageClass === 'MENTAL') {
      damage = power * (attack / defense) * spiritScale * positionScale * costScale;
      formula = '威力×(精神攻势/精神防守)×精神驱动×定位×消耗加成';
    }
    return {
      damage: Math.max(0, Number(damage || 0)),
      damageType,
      formula,
      attackValue: attack,
      defenseValue: defense,
    };
  }

  function summarizeScoreContributions(contributions = []) {
    const scoreParts = Object.fromEntries(scorePartKeys.map(component => [component, 0]));
    const factorKeys = [];
    const seen = new Set();
    (Array.isArray(contributions) ? contributions : []).forEach((contribution, index) => {
      const valueKey = String(contribution?.valueKey || '').trim();
      const component = String(contribution?.component || '').trim();
      const expectedValue = Number(contribution?.expectedValue || 0);
      if (!valueKey) throw new Error(`battle_scoring_value_key_missing:${index}`);
      if (seen.has(valueKey)) throw new Error(`battle_scoring_value_key_duplicated:${valueKey}`);
      if (!scorePartKeys.includes(component)) throw new Error(`battle_scoring_component_unsupported:${component || index}`);
      if (!Number.isFinite(expectedValue)) throw new Error(`battle_scoring_value_invalid:${valueKey}`);
      seen.add(valueKey);
      factorKeys.push(valueKey);
      scoreParts[component] += expectedValue;
    });
    scorePartKeys.forEach(component => { scoreParts[component] = Math.round(scoreParts[component]); });
    return { scoreParts, rawObjectiveScore: calculateObjectiveScore(scoreParts), factorKeys };
  }

  function finalizeCandidates(candidates = [], options = {}) {
    const list = Array.isArray(candidates) ? candidates : [];
    const castTimeOf = typeof options?.castTimeOf === 'function' ? options.castTimeOf : () => 0;
    const finalized = list.map((candidate, index) => {
      const currentScore = Number(candidate?.scoringSummary?.rawObjectiveScore || 0);
      const bestOtherScore = list.reduce((best, other, otherIndex) =>
        otherIndex === index ? best : Math.max(best, Number(other?.scoringSummary?.rawObjectiveScore || 0)), -Infinity);
      const alternativeGap = Number.isFinite(bestOtherScore) ? Math.max(0, Math.round(bestOtherScore - currentScore)) : 0;
      const tags = new Set(Array.isArray(candidate?.scoringSummary?.tags) ? candidate.scoringSummary.tags : []);
      const currentParts = candidate?.scoringSummary?.scoreParts || {};
      const strictlyDominated = list.some((other, otherIndex) => {
        if (otherIndex === index || String(other?.scoringSummary?.rejectionCode || '').trim()) return false;
        const otherScore = Number(other?.scoringSummary?.rawObjectiveScore || 0);
        if (!(otherScore > currentScore) || !(Number(other?.weight || 0) > Number(candidate?.weight || 0))) return false;
        const otherParts = other?.scoringSummary?.scoreParts || {};
        const allBenefitsNoLower = positiveScoreParts.every(key => Number(otherParts[key] || 0) >= Number(currentParts[key] || 0));
        const allCostsNoHigher = costScoreParts.every(key => Number(otherParts[key] || 0) <= Number(currentParts[key] || 0));
        const atLeastOneBetter = positiveScoreParts.some(key => Number(otherParts[key] || 0) > Number(currentParts[key] || 0)) ||
          costScoreParts.some(key => Number(otherParts[key] || 0) < Number(currentParts[key] || 0));
        return allBenefitsNoLower && allCostsNoHigher && atLeastOneBetter;
      });
      if (strictlyDominated) tags.add('STRICTLY_DOMINATED');
      const rejectionCode = String(candidate?.scoringSummary?.rejectionCode || '').trim() || (strictlyDominated ? 'STRICTLY_DOMINATED' : '');
      const finalScore = rejectionCode ? 0 : Math.max(0, Number(candidate?.scoringSummary?.finalScore ?? candidate?.weight ?? 0));
      return {
        ...candidate,
        weight: finalScore,
        scoringSummary: {
          ...(candidate?.scoringSummary || {}),
          tags: [...tags],
          alternativeGap,
          rejectionCode,
          finalScore,
          selectedReason: rejectionCode || String(candidate?.scoringSummary?.selectedReason || 'OBJECTIVE_SCORE'),
        },
        __候选排序审计: {
          ...(candidate?.__候选排序审计 || {}),
          tags: [...tags],
          alternativeGap,
        },
      };
    });
    return finalized.sort((left, right) => {
      const leftSummary = left?.scoringSummary || {};
      const rightSummary = right?.scoringSummary || {};
      return Number(right.weight || 0) - Number(left.weight || 0) ||
        Number(leftSummary.resourceCostEV || 0) - Number(rightSummary.resourceCostEV || 0) ||
        Number(castTimeOf(left)) - Number(castTimeOf(right)) ||
        String(leftSummary.candidateId || '').localeCompare(String(rightSummary.candidateId || ''), 'zh-Hans-CN');
    });
  }

  function selectCandidate(options = {}) {
    const bannedTags = new Set(['DEAD_TARGET_SELECTED', 'ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'CATASTROPHIC', 'STRICTLY_DOMINATED']);
    const candidates = Array.isArray(options?.candidates) ? options.candidates : [];
    const castTimeOf = typeof options?.castTimeOf === 'function' ? options.castTimeOf : () => 0;
    const pool = candidates.filter(candidate => {
      if (!candidate || !(Number(candidate.weight || 0) > 0) || String(candidate?.scoringSummary?.rejectionCode || '').trim()) return false;
      return !(Array.isArray(candidate?.scoringSummary?.tags) ? candidate.scoringSummary.tags : []).some(tag => bannedTags.has(tag));
    });
    if (!pool.length) return { option: null, trace: '当前未形成有效出手机会', decisionConfidence: 1, temperature: 4 };
    const objectiveSorted = [...pool].sort((left, right) => {
      const leftSummary = left?.scoringSummary || {};
      const rightSummary = right?.scoringSummary || {};
      return Number(right.weight || 0) - Number(left.weight || 0) ||
        Number(leftSummary.resourceCostEV || 0) - Number(rightSummary.resourceCostEV || 0) ||
        Number(castTimeOf(left)) - Number(castTimeOf(right)) ||
        String(leftSummary.candidateId || '').localeCompare(String(rightSummary.candidateId || ''), 'zh-Hans-CN');
    });
    const objectiveBest = objectiveSorted[0];
    const bestObjectiveScore = Number(objectiveBest?.weight || 0);
    const { decisionConfidence, temperature, maxRegret } = buildDecisionProfile({
      experienceStability: options?.experienceStability,
      spiritualPowerRatio: options?.spiritualPowerRatio,
      staminaRatio: options?.staminaRatio,
      bestObjectiveScore,
    });
    const regretPool = objectiveSorted.filter(candidate => bestObjectiveScore - Number(candidate.weight || 0) <= maxRegret + 1e-9);
    const normalizedScores = normalizeDecisionScores(regretPool.map(candidate => Number(candidate.weight || 0)));
    const normalizedMean = normalizedScores.reduce((sum, score) => sum + score, 0) / Math.max(1, normalizedScores.length);
    const interferenceStrength = Math.max(0, Math.min(1, Number(options?.interference) || 0));
    const scored = regretPool.map((candidate, index) => {
      const objectiveScore = Number(candidate.weight || 0);
      const normalizedObjectiveScore = normalizedScores[index];
      const subjectiveScore = normalizedObjectiveScore * (1 - interferenceStrength) + normalizedMean * interferenceStrength;
      candidate.scoringSummary = {
        ...(candidate.scoringSummary || {}),
        normalizedObjectiveScore: Number(normalizedObjectiveScore.toFixed(3)),
        subjectiveScore: Number(subjectiveScore.toFixed(3)),
      };
      return { candidate, objectiveScore, normalizedObjectiveScore, subjectiveScore };
    }).sort((left, right) => {
      const leftSummary = left.candidate?.scoringSummary || {};
      const rightSummary = right.candidate?.scoringSummary || {};
      return right.subjectiveScore - left.subjectiveScore ||
        Number(leftSummary.resourceCostEV || 0) - Number(rightSummary.resourceCostEV || 0) ||
        Number(castTimeOf(left.candidate)) - Number(castTimeOf(right.candidate)) ||
        String(leftSummary.candidateId || '').localeCompare(String(rightSummary.candidateId || ''), 'zh-Hans-CN');
    });
    const top = scored[0];
    const second = scored[1] || null;
    let selected = top;
    let reason = 'OBJECTIVE_GAP_LOCK';
    if (second && top.subjectiveScore - second.subjectiveScore < 2 * temperature) {
      const maxScore = top.subjectiveScore;
      const weighted = scored.map(item => ({ ...item, probabilityWeight: Math.exp((item.subjectiveScore - maxScore) / Math.max(0.1, temperature)) }));
      const total = weighted.reduce((sum, item) => sum + item.probabilityWeight, 0);
      const candidateSignature = weighted.map(item =>
        `${item.candidate?.scoringSummary?.candidateId || item.candidate?.name || ''}:${item.subjectiveScore.toFixed(3)}`
      ).join('|');
      let roll = stableUnitRoll(`${String(options?.seedText || 'battle-decision')}|${candidateSignature}`) * total;
      selected = weighted[weighted.length - 1];
      for (const item of weighted) {
        roll -= item.probabilityWeight;
        if (roll <= 0) {
          selected = item;
          break;
        }
      }
      reason = interferenceStrength > 0 ? 'DECISION_INTERFERENCE_SOFTMAX' : 'SUBJECTIVE_SOFTMAX';
    }
    selected.candidate.scoringSummary = {
      ...(selected.candidate.scoringSummary || {}),
      selectedReason: reason,
      decisionConfidence: Number(decisionConfidence.toFixed(3)),
      temperature: Number(temperature.toFixed(3)),
      maxRegret: Number(maxRegret.toFixed(3)),
    };
    selected.candidate.__subjectiveDecision = {
      decisionConfidence: Number(decisionConfidence.toFixed(3)),
      temperature: Number(temperature.toFixed(3)),
      maxRegret: Number(maxRegret.toFixed(3)),
      reason,
      originalBestCandidateId: objectiveBest?.scoringSummary?.candidateId || '',
    };
    return {
      option: selected.candidate,
      trace: reason === 'OBJECTIVE_GAP_LOCK'
        ? '主观置信度锁定最高合法净收益'
        : reason === 'DECISION_INTERFERENCE_SOFTMAX'
          ? '决策干扰改变主观判断'
          : '经验与当前精力共同影响临场选择',
      decisionConfidence,
      temperature,
      maxRegret,
      originalBest: objectiveBest,
    };
  }

  function findFirstDifference(before, after, path = '$') {
    if (Object.is(before, after)) return '';
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return path;
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(before, key) || !Object.prototype.hasOwnProperty.call(after, key)) return `${path}.${key}`;
      const difference = findFirstDifference(before[key], after[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return path;
  }

  function assertEffectList(effectList, path = '_效果数组') {
    if (!Array.isArray(effectList)) throw new TypeError(`battle_effect_list_invalid:${path}`);
    effectList.forEach((effect, index) => {
      const effectPath = `${path}[${index}]`;
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
        throw new TypeError(`battle_effect_invalid:${effectPath}`);
      }
      const prototype = String(effect.原型 || '').trim();
      if (!prototype) {
        const creationEffects = Array.isArray(effect.使用效果) ? effect.使用效果 : [];
        if (!creationEffects.length) throw new Error(`battle_effect_prototype_missing:${effectPath}`);
        assertEffectList(creationEffects, `${effectPath}.使用效果`);
        return;
      }
      const definition = prototypeRegistry[prototype];
      if (!definition) throw new Error(`battle_effect_prototype_unknown:${effectPath}:${prototype}`);
      (definition.必填字段 || []).forEach(field => {
        const value = effect[field];
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) {
          throw new Error(`battle_effect_required_field_missing:${effectPath}:${field}`);
        }
      });
      Object.entries(definition.字段定义 || {}).forEach(([field, fieldDefinition]) => {
        const options = Array.isArray(fieldDefinition?.选项) ? fieldDefinition.选项 : [];
        if (!options.length || effect[field] === undefined || effect[field] === null) return;
        const values = Array.isArray(effect[field]) ? effect[field] : [effect[field]];
        values.forEach(value => {
          if (!options.includes(String(value).trim())) {
            throw new Error(`battle_effect_enum_unknown:${effectPath}:${field}:${String(value)}`);
          }
        });
      });
      nestedEffectFields.forEach(field => {
        if (effect[field] !== undefined) assertEffectList(effect[field], `${effectPath}.${field}`);
      });
      (Array.isArray(effect.条件分支) ? effect.条件分支 : []).forEach((branch, branchIndex) => {
        conditionalEffectFields.forEach(field => {
          if (branch?.[field] !== undefined) assertEffectList(branch[field], `${effectPath}.条件分支[${branchIndex}].${field}`);
        });
      });
    });
    return true;
  }

  function assertSkillEffects(skill = {}) {
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    return assertEffectList(effects, '_效果数组');
  }

  function bindEngine(implementation) {
    if (
      !implementation ||
      typeof implementation.runBattleCase !== 'function' ||
      typeof implementation.auditFacts !== 'function' ||
      !implementation.previewDomain ||
      typeof implementation.previewDomain.getEffects !== 'function' ||
      typeof implementation.previewDomain.evaluateEffect !== 'function' ||
      typeof implementation.previewDomain.evaluateSkill !== 'function' ||
      typeof implementation.previewDomain.resolveTargets !== 'function' ||
      typeof implementation.previewDomain.resolveComponent !== 'function'
    ) {
      throw new TypeError('battle_runtime_engine_contract_invalid');
    }
    engineState.implementation = implementation;
  }

  function requireEngine() {
    if (!engineState.implementation) throw new Error('battle_runtime_engine_not_bound');
    return engineState.implementation;
  }

  function runBattleCase(options = {}) {
    const input = options && typeof options === 'object' ? cloneValue(options) : {};
    return requireEngine().runBattleCase(input);
  }

  function auditFacts(payload = {}) {
    const input = payload && typeof payload === 'object' ? cloneValue(payload) : {};
    return requireEngine().auditFacts(input);
  }

  function previewSkill(payload = {}) {
    const input = payload && typeof payload === 'object' ? cloneValue(payload) : {};
    if (!input.skill || typeof input.skill !== 'object') throw new TypeError('battle_preview_skill_missing');
    assertSkillEffects(input.skill);
    const before = cloneValue(input);
    const domain = requireEngine().previewDomain;
    const skill = input.skill;
    const actor = input?.actor && typeof input.actor === 'object' ? input.actor : {};
    const target = input?.target && typeof input.target === 'object' ? input.target : null;
    const combatData = input?.combatData && typeof input.combatData === 'object' ? input.combatData : {};
    const behaviorState = { ...(input?.behaviorState || {}), combatData, primaryTarget: target, target };
    const effects = domain.getEffects({ skill, actor, target, combatData, behaviorState });
    const mainTriggerProbability = Number(domain.estimateMainProbability?.({ skill, actor, target, combatData, behaviorState, effects }) ?? 1);
    const contributions = effects.map((effect, effectIndex) => {
      const prototype = String(effect?.原型 || '').trim();
      if (!prototypeRuntimeContract[prototype]) throw new Error(`battle_preview_prototype_unsupported:${prototype || effectIndex}`);
      const targets = domain.resolveTargets({ effect, skill, actor, target, combatData, behaviorState });
      const targetIds = (Array.isArray(targets) ? targets : [])
        .map(unit => String(unit?.id || unit?.角色ID || unit?.name || unit?.名称 || '').trim())
        .filter(Boolean);
      const evaluation = domain.evaluateEffect({ effect, skill, actor, target, combatData, behaviorState });
      const component = String(domain.resolveComponent(effect) || '').trim();
      if (!component) throw new Error(`battle_preview_component_missing:${prototype}`);
      const sourceEffectId = String(domain.resolveEffectId?.(effect, effectIndex) || `effect-${effectIndex}`).trim();
      const window = Math.max(1, Number(effect?.持续回合 || effect?.调整回合 || 1));
      const conditionalOnMain = String(effect?.生效方式 || '').trim() === '跟随主原型';
      const triggerProbability = conditionalOnMain ? mainTriggerProbability : 1;
      return {
        valueKey: `${sourceEffectId}:${targetIds.join(',') || 'NO_TARGET'}:${window}`,
        component,
        sourceEffectId,
        targetIds,
        window,
        expectedValue: Number((Number(evaluation?.净收益 || 0) * triggerProbability).toFixed(4)),
        evidence: {
          prototype,
          runtimeConsumer: String(domain.resolveRuntimeConsumer?.(effect) || effect?.运行时消费器 || '').trim(),
          targetCount: Number(evaluation?.目标数量 || 0),
          marginal: evaluation?.弱参与 !== true,
          conditionalOnMain,
          triggerProbability,
        },
      };
    });
    const score = domain.evaluateSkill({ skill, actor, target, combatData, behaviorState });
    const scoreParts = score?.scoreParts && typeof score.scoreParts === 'object' ? { ...score.scoreParts } : {};
    const result = {
      skillId: String(skill?.id || skill?.技能ID || skill?.name || skill?.魂技名 || '').trim(),
      actorId: String(actor?.id || actor?.角色ID || actor?.name || actor?.名称 || '').trim(),
      targetId: String(target?.id || target?.角色ID || target?.name || target?.名称 || '').trim(),
      effects: effects.map(effect => cloneValue(effect)),
      contributions,
      scoreParts,
      rawObjectiveScore: calculateObjectiveScore(scoreParts),
    };
    if (JSON.stringify(input) !== JSON.stringify(before)) {
      throw new Error(`battle_preview_mutated_input:${findFirstDifference(before, input)}`);
    }
    const valueKeys = result.contributions.map(item => String(item?.valueKey || '').trim()).filter(Boolean);
    if (valueKeys.length !== result.contributions.length || new Set(valueKeys).size !== valueKeys.length) {
      throw new Error('battle_preview_value_key_invalid');
    }
    return cloneValue(result);
  }

  function auditPrototypeCoverage() {
    const rows = prototypeManifest.map(entry => {
      const contract = prototypeRuntimeContract[entry.name];
      return {
        prototype: entry.name,
        component: String(contract?.component || '').trim(),
        settlementConsumers: [...(contract?.settlementConsumers || [])],
        factTypes: [...(contract?.factTypes || [])],
        reportBlockTypes: [...(contract?.reportBlockTypes || [])],
        stages: {
          legality: typeof assertEffectList === 'function',
          preview: !!contract?.component,
          scoring: !!contract?.component,
          settlement: (contract?.settlementConsumers || []).length > 0,
          ledger: (contract?.factTypes || []).length > 0,
          report: (contract?.reportBlockTypes || []).length > 0,
        },
      };
    });
    const expected = new Set(prototypeManifest.map(entry => entry.name));
    const actual = new Set(rows.map(row => String(row?.prototype || '').trim()).filter(Boolean));
    const missing = [...expected].filter(name => !actual.has(name));
    const unknown = [...actual].filter(name => !expected.has(name));
    if (missing.length || unknown.length) {
      throw new Error(`battle_prototype_coverage_mismatch:missing=${missing.join(',')}:unknown=${unknown.join(',')}`);
    }
    const requiredStages = ['legality', 'preview', 'scoring', 'settlement', 'ledger', 'report'];
    rows.forEach(row => {
      const incomplete = requiredStages.filter(stage => row?.stages?.[stage] !== true);
      if (incomplete.length) throw new Error(`battle_prototype_stage_missing:${row.prototype}:${incomplete.join(',')}`);
    });
    const coveredPrototypes = new Set(rows.filter(row => Object.values(row.stages).every(Boolean)).map(row => row.prototype));
    const coveredOptionKeys = new Set(prototypeOptionMatrix
      .filter(entry => coveredPrototypes.has(entry.prototype))
      .map(entry => entry.optionKey));
    const missingOptionKeys = prototypeOptionMatrix
      .map(entry => entry.optionKey)
      .filter(optionKey => !coveredOptionKeys.has(optionKey));
    if (missingOptionKeys.length) throw new Error(`battle_prototype_option_coverage_missing:${missingOptionKeys.join(',')}`);
    return cloneValue({ prototypes: rows, coveredOptionKeys: [...coveredOptionKeys], prototypeCount: rows.length, optionCount: coveredOptionKeys.size });
  }

  const api = Object.freeze({
    version: '7.3-R5',
    actionKinds,
    actionRoles,
    reportBlockTypes,
    positiveScoreParts,
    costScoreParts,
    scorePartKeys,
    prototypeRegistry,
    prototypeRuntimeContract,
    prototypeManifest,
    prototypeOptionMatrix,
    cloneValue,
    nextRuntimeId,
    ensureLedger,
    attachLedger,
    ensureTrace,
    probabilitySucceeds,
    stableUnitRoll,
    buildDecisionProfile,
    normalizeDecisionScores,
    createActionQueue,
    runTeamBattle,
    calculateObjectiveScore,
    calculateBaseDamage,
    summarizeScoreContributions,
    finalizeCandidates,
    selectCandidate,
    assertEffectList,
    assertSkillEffects,
    bindEngine,
    runBattleCase,
    auditFacts,
    previewSkill,
    auditPrototypeCoverage,
  });

  root.__LWCS_BATTLE_RUNTIME__ = api;
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SOURCE__ = 'shared';
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SIZE__ = prototypeManifest.length;
})();

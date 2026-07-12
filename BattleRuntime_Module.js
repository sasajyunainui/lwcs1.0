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
    let insertionSequence = Math.max(0, Number(options?.initialInsertionSequence || 0));
    let actionSequence = Math.max(0, Number(options?.initialActionSequence || 0));
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

  function runDuelRounds(options = {}) {
    const maxRounds = Math.max(1, Number(options?.maxRounds || 1));
    const canContinue = typeof options?.canContinue === 'function' ? options.canContinue : () => true;
    const executeRound = typeof options?.executeRound === 'function' ? options.executeRound : null;
    if (!executeRound) throw new TypeError('battle_duel_round_runner_contract_invalid');
    let rounds = 0;
    let lastResult = null;
    while (rounds < maxRounds && canContinue()) {
      rounds += 1;
      lastResult = executeRound(rounds) || null;
      if (lastResult?.continueSimulation === false) break;
    }
    return { rounds, lastResult };
  }

  function decideDuelContinuation(options = {}) {
    const mode = options?.mode === 'multi_round' ? 'multi_round' : 'single_round';
    if (options?.actorsAble !== true) return { continueSimulation: false, intensity: 0, log: '' };
    if (options?.isCharging === true) return { continueSimulation: true, intensity: 0, log: '' };
    if (mode === 'single_round') {
      return {
        continueSimulation: false,
        intensity: 0,
        log: '[单回合仲裁] 当前模式为单回合，本次暗箱演算到此结束。',
      };
    }
    const activeRatio = Math.max(0, Number(options?.activeDamage || 0)) / Math.max(1, Number(options?.passiveHpMax || 1));
    const passiveRatio = Math.max(0, Number(options?.passiveDamage || 0)) / Math.max(1, Number(options?.activeHpMax || 1));
    const intensity = Math.max(activeRatio, passiveRatio);
    const stopDamageRatio = Math.max(0, Number(options?.settings?.stopDamageRatio || 0));
    const stopDamagePercent = Math.max(0, Number(options?.settings?.stopDamagePercent || stopDamageRatio * 100));
    if (intensity >= stopDamageRatio) {
      return {
        continueSimulation: false,
        intensity,
        log: `[续推终止] 本回合伤害已达生命占比${Math.round(stopDamagePercent)}%，暗箱续推停止。`,
      };
    }
    const chance = Math.max(0, Math.min(1, Number(options?.settings?.continueChance || 0)));
    const chancePercent = Math.max(0, Number(options?.settings?.continueChancePercent || chance * 100));
    const rollValue = typeof options?.roll === 'function' ? options.roll() : options?.roll;
    const roll = Math.max(0, Math.min(1, Number(rollValue) || 0));
    const continueSimulation = probabilitySucceeds(chance, roll);
    return {
      continueSimulation,
      intensity,
      log: `[续推判定] 本回合伤害约为生命占比${Math.round(intensity * 100)}%，未达到${Math.round(stopDamagePercent)}%，按${Math.round(chancePercent)}%概率续推。Roll:${roll.toFixed(2)} 判定:${continueSimulation ? '继续' : '停止'}。`,
    };
  }

  function executeActionNodes(options = {}) {
    const nodes = Array.isArray(options?.nodes) ? options.nodes : [];
    const queue = createActionQueue({
      round: options?.round,
      initialEntries: [],
      normalizeRole: options?.normalizeRole,
      normalizeActionName: options?.normalizeActionName,
      describeActor: options?.describeActor,
      onTrace: options?.onTrace,
      onFatal: options?.onFatal,
      initialInsertionSequence: options?.initialInsertionSequence,
      initialActionSequence: options?.initialActionSequence,
    });
    nodes.forEach(node => queue.enqueue(node));
    const results = [];
    while (queue.pendingCount > 0 && !queue.fatal) {
      const node = queue.dequeue();
      if (!node) break;
      queue.recordTrace('EXECUTING', node);
      try {
        const result = node.execute ? node.execute(node) : null;
        results.push({ node, result });
        queue.recordTrace('COMPLETED', node);
      } catch (error) {
        queue.fail('ACTION_QUEUE_NODE_EXECUTION_FAILED', node, { message: String(error?.message || error) });
      }
    }
    return { results, fatal: queue.fatal };
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

  function normalizeReportNameForMatch(value = '') {
    return String(value || '')
      .replace(/[【】\[\]\s]/g, '')
      .replace(/^(我方|敌方|玩家|NPC|同窗|目标)/, '')
      .trim();
  }

  function isSameReportName(left = '', right = '') {
    const normalizedLeft = normalizeReportNameForMatch(left);
    const normalizedRight = normalizeReportNameForMatch(right);
    return !!normalizedLeft && !!normalizedRight && normalizedLeft === normalizedRight;
  }

  function normalizeActionDisplayName(value = '') {
    const text = String(value || '').replace(/^【|】$/g, '').trim();
    if (!text) return '';
    if (text === '常规攻击' || text === '主动压迫') return '普通攻击';
    if (text === '肉体兜底' || text === '硬抗') return '承伤硬抗';
    if (text === '系统反击') return '借势反打';
    return /系统反击$/.test(text) ? text.replace(/系统反击$/, '借势反打') : text;
  }

  function normalizeActionRole(value = '', fallback = 'ACTIVE') {
    const normalized = String(value || '').trim().toUpperCase();
    return actionRoles.includes(normalized) ? normalized : fallback;
  }

  function normalizeBattleSide(value = '') {
    const side = String(value || '').trim();
    if (/^(player|玩家|我方)$/i.test(side)) return 'player';
    if (/^(enemy|敌方|对方)$/i.test(side)) return 'enemy';
    return '';
  }

  function inferActionRole(event = {}) {
    const explicit = event?.actionRole || event?.meta?.actionRole;
    if (explicit) return normalizeActionRole(explicit);
    const kind = String(event?.eventKind || event?.nodeKind || '').trim();
    const actionType = String(event?.actionType || event?.source || '').trim();
    if (kind === 'state_tick' || event?.phase === 'round_end') return 'STATE_TICK';
    if (kind === 'summon_assist' || /summon_assist|协同追击/.test(actionType)) return 'ASSIST';
    if (kind === 'counter' || kind === 'counter_window' || /counter|行为防反|反防反/.test(actionType)) return 'COUNTER';
    if (['dodge', 'defend', 'pass', 'reaction_window', 'reaction_decision'].includes(kind) || /reaction|应招/.test(actionType)) return 'REACTION';
    return 'ACTIVE';
  }

  function inferFactType(eventKind = '', event = {}) {
    const kind = String(eventKind || event?.eventKind || '').trim();
    if (kind === 'action_start') return 'ACTION_DECLARED';
    if (kind === 'hit_result' || kind === 'counter') return 'DAMAGE';
    if (kind === 'state_tick') return 'STATE_TICK';
    if (['state_apply', 'state_replace', 'state_remove'].includes(kind)) return 'STATE_CHANGE';
    if (kind === 'resource_change' || kind === 'round_recover') return 'RESOURCE_CHANGE';
    if (kind === 'shield_create' || kind === 'shield_break') return 'SHIELD_CHANGE';
    if (/^summon_/.test(kind)) return 'SUMMON';
    if (kind === 'create') return 'CREATION';
    if (['dodge', 'defend', 'pass', 'reaction_window', 'counter_window'].includes(kind)) return 'REACTION';
    if (kind === 'effect_resolved') return String(event?.factType || event?.meta?.factType || 'EFFECT').trim() || 'EFFECT';
    if (/round/.test(kind)) return 'ROUND';
    if (['blocked_action', 'blocked_settlement', 'failed_action', 'target_fail'].includes(kind)) return 'ACTION_RESULT';
    return 'EVENT';
  }

  function normalizeTargetIds(...values) {
    return [...new Set(values
      .flatMap(value => Array.isArray(value) ? value : [value])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
  }

  function normalizeActorControl(value = '', fallback = 'AI') {
    const normalized = String(value || '').trim().toUpperCase();
    return ['PLAYER_LOCKED', 'PLAYER', 'AI', 'SYSTEM'].includes(normalized) ? normalized : fallback;
  }

  function normalizeCausalNode(node = {}) {
    if (!node || typeof node !== 'object') return node;
    const actionRole = inferActionRole(node);
    const defaultControl = actionRole === 'STATE_TICK' || String(node.nodeLayer || '').trim() === 'presentation' ? 'SYSTEM' : 'AI';
    return {
      ...node,
      actorControl: normalizeActorControl(node.actorControl || node.meta?.actorControl, defaultControl),
      actionRole,
      sourceActionId: String(node.sourceActionId || '').trim(),
      parentNodeId: String(node.parentNodeId || '').trim(),
      reactionNodeId: String(node.reactionNodeId || node.meta?.reactionNodeId || (node.nodeKind === 'reaction_window' ? node.nodeId : '') || '').trim(),
      ruleCode: String(node.ruleCode || node.reasonCode || '').trim().toUpperCase(),
      resultState: String(node.resultState || node.result || node.primaryOutcome || node.nodeKind || '').trim(),
      factType: String(node.factType || inferFactType(node.eventKind || node.nodeKind, node)).trim(),
      effectPrototype: String(node.effectPrototype || node.meta?.effectPrototype || '').trim(),
      sourceEffectId: String(node.sourceEffectId || node.meta?.sourceEffectId || '').trim(),
      targetIds: normalizeTargetIds(node.targetIds, node.targetId, node.targetName),
    };
  }

  function cloneAuditSnapshot(value, depth = 0) {
    if (value == null || typeof value !== 'object') return value;
    if (depth >= 6) return '[snapshot-depth-truncated]';
    if (Array.isArray(value)) return value.slice(0, 120).map(item => cloneAuditSnapshot(item, depth + 1));
    const blockedKeys = new Set([
      'combatData', '__父级战斗数据', '__battleEventLedger', '__battleResolutionTrace',
      '参战者', '完整战斗数据', '完整角色', '角色对象', 'actor', 'target', 'sourceActor', 'sourceTarget',
      'sourceSkill', 'originalSkill', '_效果数组', '效果数组', '完整效果数组',
    ]);
    const result = {};
    Object.entries(value).slice(0, 120).forEach(([key, item]) => {
      if (blockedKeys.has(key) || typeof item === 'function' || typeof item === 'undefined') return;
      if ((key === 'skill' || key === '技能') && item && typeof item === 'object') return;
      result[key] = cloneAuditSnapshot(item, depth + 1);
    });
    return result;
  }

  function collectDecisionTrace(combatData = {}) {
    const trace = combatData?.__行动闭环诊断?.审计轨迹;
    return Array.isArray(trace) ? trace.slice(-160).map(item => cloneAuditSnapshot(item)) : [];
  }

  function collectResolutionTrace(combatData = {}) {
    const trace = combatData?.__battleResolutionTrace;
    return Array.isArray(trace) ? trace.slice(-240).map(item => cloneAuditSnapshot(normalizeCausalNode(item))) : [];
  }

  function readLedgerStateName(event = {}) {
    return String(event?.stateName || event?.meta?.stateName || '').trim();
  }

  function readLedgerNumber(event = {}, key = '') {
    if (['damage', 'finalDamage', 'appliedDamage'].includes(String(key || '').trim())) {
      const value = Number(event?.appliedDamage ?? event?.meta?.appliedDamage ?? event?.[key] ?? event?.meta?.[key] ?? 0);
      return Number.isFinite(value) ? value : 0;
    }
    return Number(event?.[key] ?? event?.meta?.[key] ?? 0);
  }

  function stateWasApplied(event = {}) {
    const result = String(event?.result || event?.meta?.result || '').trim();
    return !result || /applied|success|生效|附着|施加/.test(result);
  }

  function stateWasResisted(event = {}) {
    return /resist|resisted|抵抗|豁免|未附着/.test(String(event?.result || event?.meta?.result || '').trim());
  }

  function stateWasImmune(event = {}) {
    return /immune|immunity|免疫|无视异常/.test(String(event?.result || event?.meta?.result || '').trim());
  }

  function readEventOutcome(event = {}) {
    const explicit = String(event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim();
    if (explicit) return explicit;
    const kind = String(event?.eventKind || '').trim();
    const result = String(event?.result || event?.meta?.result || '').trim();
    if (kind === 'hit_result') {
      if (/graze|chip|擦伤/.test(result)) return 'graze';
      if (/critical|暴击/.test(result)) return 'critical';
      if (/miss|evade|dodge|未命中|闪避/.test(result)) return 'dodged';
      return readLedgerNumber(event, 'damage') > 0 ? 'full_hit' : 'no_effect';
    }
    if (kind === 'state_apply') {
      if (stateWasImmune(event)) return 'state_immune';
      if (stateWasResisted(event)) return 'state_resisted';
      return 'state_applied';
    }
    if (kind === 'state_tick') return 'state_tick';
    if (kind === 'summon_assist') return 'summon_action';
    if (kind === 'create') return 'item_created';
    if (kind === 'summon_create') return 'summon_created';
    if (kind === 'resource_change' || kind === 'round_recover') return 'resource_recovered';
    if (kind === 'blocked_action') return 'interrupted';
    if (kind === 'failed_action' || kind === 'target_fail') {
      return /CAP_REACHED|达到上限|造物已达上限|场面已满/.test(`${event?.reasonCode || ''} ${event?.failReason || ''}`) ? 'cap_reached' : 'interrupted';
    }
    return 'no_effect';
  }

  function isInternalFallbackEvent(event = {}) {
    const kind = String(event?.eventKind || '').trim();
    const action = normalizeActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '');
    const actionType = String(event?.actionType || event?.type || '').trim();
    const reason = String(event?.failReason || event?.failureReason || event?.reasonText || event?.meta?.reasonText || event?.meta?.failureReason || '').trim();
    const source = String(event?.meta?.source || event?.source || '').trim();
    if (event?.playerAction === true || event?.meta?.playerAction === true || event?.meta?.source === 'player') return false;
    if (String(event?.actorSide || event?.meta?.actorSide || '').trim() === 'player') return false;
    if (kind === 'pass' && /observe|stance_hold/.test(String(event?.result || ''))) return false;
    if (['blocked_action', 'failed_action', 'target_fail'].includes(kind)) {
      if (/CAP_REACHED|达到上限|造物已达上限|场面已满/.test(`${reason} ${event?.reasonCode || event?.meta?.reasonCode || ''}`)) return false;
      if (/战术待机|待机|观察|守势维持|守势对峙|收招转防|防御/.test(action) && /未形成主动结算效果|NO_EFFECTIVE_OPENING|no_effective_opening|没有形成主动结算效果|缺少可结算效果|稳住身位/.test(reason)) return false;
      if (/auto_actor|ai_fallback|internal|system/i.test(source)) return true;
      if (/缺少可结算效果/.test(reason) && /auto|fallback|战术待机|观察|收招转防/.test(`${source} ${actionType} ${action}`)) return true;
    }
    return false;
  }

  function buildActionChains(eventLedger = [], resolutionTrace = []) {
    const ledger = (Array.isArray(eventLedger) ? eventLedger : []).filter(event => event && typeof event === 'object');
    const trace = (Array.isArray(resolutionTrace) ? resolutionTrace : []).filter(node => node && typeof node === 'object');
    const starts = ledger
      .filter(event => String(event?.eventKind || '').trim() === 'action_start')
      .sort((left, right) => Number(left?.round || 0) - Number(right?.round || 0) || String(left?.eventId || '').localeCompare(String(right?.eventId || '')));
    const seen = new Set();
    return starts.map((start, index) => {
      const rootActionId = String(start?.actionId || start?.sourceActionId || start?.eventId || `action_${index + 1}`).trim();
      if (seen.has(rootActionId)) return null;
      seen.add(rootActionId);
      const actionIds = new Set([rootActionId]);
      let changed = true;
      while (changed) {
        changed = false;
        ledger.forEach(event => {
          const parentActionId = String(event?.sourceActionId || '').trim();
          const actionId = String(event?.actionId || '').trim();
          if (!actionId || actionIds.has(actionId) || !actionIds.has(parentActionId)) return;
          actionIds.add(actionId);
          changed = true;
        });
      }
      const relatedEvents = ledger.filter(event => {
        const actionId = String(event?.actionId || '').trim();
        const sourceActionId = String(event?.sourceActionId || '').trim();
        return actionIds.has(actionId) || actionIds.has(sourceActionId) || String(event?.eventId || '').trim() === String(start?.eventId || '').trim();
      });
      const nodeIds = trace
        .filter(node => actionIds.has(String(node?.sourceActionId || '').trim()) || actionIds.has(String(node?.actionId || '').trim()))
        .map(node => String(node?.nodeId || '').trim())
        .filter(Boolean);
      const terminal = [...relatedEvents].reverse().find(event => !['action_start', 'reaction_window'].includes(String(event?.eventKind || '').trim())) || start;
      return {
        actionGroupId: rootActionId,
        round: Number(start?.round || 0),
        actorId: String(start?.actorId || start?.actorName || '').trim(),
        targetIds: [String(start?.targetId || start?.targetName || '').trim()].filter(Boolean),
        actionName: normalizeActionDisplayName(start?.finalActionName || start?.actionName || ''),
        actionRole: normalizeActionRole(start?.actionRole || 'ACTIVE'),
        sourceActionId: String(start?.sourceActionId || '').trim(),
        eventIds: relatedEvents.map(event => String(event?.eventId || '').trim()).filter(Boolean),
        nodeIds: [...new Set(nodeIds)],
        resultState: String(terminal?.result || terminal?.actionStatus || '').trim(),
      };
    }).filter(Boolean);
  }

  function buildReportBlocks(eventLedger = [], decisionTrace = [], publicEntries = []) {
    const ledger = (Array.isArray(eventLedger) ? eventLedger : []).filter(event => event && typeof event === 'object');
    const eventById = new Map(ledger.map(event => [String(event?.eventId || '').trim(), event]).filter(([id]) => id));
    const decisions = (Array.isArray(decisionTrace) ? decisionTrace : []).filter(item => item && typeof item === 'object');
    const normalizePublicEntry = requireEngine().caseDomain.normalizePublicEntry;
    const entries = (Array.isArray(publicEntries) ? publicEntries : []).map(normalizePublicEntry).filter(Boolean);
    const readSourceIds = entry => [...new Set((Array.isArray(entry?.blocks) ? entry.blocks : []).flatMap(block => [
      ...(Array.isArray(block?.sourceEventIds) ? block.sourceEventIds : []),
      block?.sourceEventId,
    ]).map(id => String(id || '').trim()).filter(Boolean))];
    const readIntent = (round, actorName, actionName) => {
      const decision = [...decisions].reverse().find(item =>
        Number(item?.回合 || item?.round || 0) === Number(round || 0) &&
        isSameReportName(item?.行动者 || item?.actor || '', actorName || '') &&
        (!actionName || normalizeActionDisplayName(item?.finalResolvedActionName || item?.技能 || item?.skill || '') === actionName)
      ) || [...decisions].reverse().find(item =>
        Number(item?.回合 || item?.round || 0) === Number(round || 0) &&
        isSameReportName(item?.行动者 || item?.actor || '', actorName || '')
      );
      if (!decision) return '';
      const selected = (Array.isArray(decision?.候选排序结果) ? decision.候选排序结果 : []).find(candidate =>
        ['EXECUTED', 'LOCKED', 'SELECTED'].includes(String(candidate?.candidateStatus || '').trim().toUpperCase())
      ) || null;
      const parts = selected?.scoreParts || selected?.审计?.scoreParts || decision?.scoringSummary?.scoreParts || {};
      const reasons = [
        ['effectiveDeltaEV', '兑现当前有效战果'],
        ['futureUnlockEV', '打开后续连招窗口'],
        ['enemyDeniedEV', '压缩对手下一次行动'],
        ['teamIntentEV', '延续当前集火或保护意图'],
        ['sustainEV', '维持后续行动资源'],
      ].sort((left, right) => Number(parts?.[right[0]] || 0) - Number(parts?.[left[0]] || 0));
      const reason = Number(parts?.[reasons[0]?.[0]] || 0) > 0 ? reasons[0][1] : '维持当前战术节奏';
      return `${String(actorName || '行动者').trim()}选择【${actionName || normalizeActionDisplayName(decision?.技能 || '行动')}】，主要为了${reason}`;
    };
    const projectFact = event => {
      const kind = String(event?.eventKind || '').trim();
      const damage = Math.max(0, Math.round(Number(readLedgerNumber(event, 'damage') || 0)));
      const amount = Math.round(Number(event?.meta?.delta ?? readLedgerNumber(event, 'amount') ?? 0));
      return {
        factId: String(event?.eventId || '').trim(),
        factType: kind === 'hit_result' || kind === 'counter' ? 'DAMAGE' :
          kind === 'state_tick' ? 'STATE_TICK' :
            ['state_apply', 'state_replace', 'state_remove'].includes(kind) ? 'STATE_CHANGE' :
              kind === 'resource_change' || kind === 'round_recover' ? 'RESOURCE_CHANGE' :
                kind === 'summon_create' || kind === 'summon_assist' ? 'SUMMON' : 'ACTION',
        eventKind: kind,
        actorId: String(event?.actorId || event?.actorName || '').trim(),
        actorName: String(event?.actorName || '').trim(),
        targetId: String(event?.targetId || event?.targetName || '').trim(),
        targetName: String(event?.targetName || '').trim(),
        actionName: normalizeActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || ''),
        actionRole: normalizeActionRole(event?.actionRole || inferActionRole(event)),
        resultState: String(event?.result || event?.actionStatus || '').trim(),
        value: damage > 0 ? damage : amount,
        resource: String(event?.meta?.resource || '').trim(),
        stateName: ['state_apply', 'state_replace', 'state_remove', 'state_tick'].includes(kind) ? readLedgerStateName(event) : '',
        duration: Math.max(0, Number(event?.duration || event?.meta?.duration || 0)),
        sourceActionId: String(event?.sourceActionId || event?.actionId || '').trim(),
        sourceNodeId: String(event?.chainNodeId || '').trim(),
      };
    };
    const summarizeFacts = (facts = []) => {
      const lines = [];
      const push = text => {
        const clean = String(text || '').trim();
        if (clean && !lines.includes(clean)) lines.push(clean);
      };
      facts.forEach(fact => {
        const actor = fact.actorName || '行动者';
        const target = fact.targetName || '目标';
        const action = fact.actionName || '行动';
        const value = Math.abs(Math.round(Number(fact.value || 0)));
        if (fact.factType === 'DAMAGE') {
          if (value > 0) {
            push(fact.actionRole === 'COUNTER'
              ? `${actor}以【${action}】完成反击，对${target}造成 ${value} 点伤害`
              : `${actor}以【${action}】命中${target}，造成 ${value} 点伤害`);
          } else if (/miss|dodge|evade|未命中|闪避|规避/i.test(String(fact.resultState || ''))) {
            push(`${actor}施展【${action}】指向${target}，但未能命中`);
          } else {
            push(`${actor}施展【${action}】指向${target}，但未造成实质伤害`);
          }
          return;
        }
        if (fact.factType === 'STATE_TICK') {
          push(value > 0
            ? `${target}受【${fact.stateName || action}】持续影响，损失 ${value} 点生命值`
            : `${target}结算【${fact.stateName || action}】的持续效果`);
          return;
        }
        if (fact.factType === 'RESOURCE_CHANGE' && value > 0) {
          const sign = Number(fact.value || 0) > 0 ? '恢复' : '消耗';
          push(`${target || actor}${sign} ${value} 点${fact.resource || '资源'}`);
          return;
        }
        if (fact.factType === 'STATE_CHANGE') {
          if (fact.eventKind === 'state_remove') push(`${target}的【${fact.stateName || '状态'}】被移除`);
          else push(`${target}受到【${fact.stateName || action}】影响${fact.duration > 0 ? `，剩余 ${fact.duration} 个有效窗口` : ''}`);
          return;
        }
        if (fact.factType === 'SUMMON') {
          push(fact.eventKind === 'summon_assist'
            ? `${actor}执行召唤协同${target ? `，目标为${target}` : ''}`
            : `${actor}生成召唤物${target ? `【${target}】` : ''}`);
          return;
        }
        if (['failed_action', 'blocked_action', 'target_fail'].includes(fact.eventKind)) {
          push(`${actor}的【${action}】未能生效`);
          return;
        }
        if (fact.eventKind === 'shield_create' && value > 0) {
          push(`${target}获得 ${value} 点护盾`);
          return;
        }
        if (fact.eventKind === 'create') {
          push(`${actor}通过【${action}】完成造物`);
        }
      });
      if (!lines.length) {
        const declared = facts.find(fact => fact.eventKind === 'action_start' || fact.eventKind === 'pass');
        if (declared) push(`${declared.actorName || '行动者'}执行【${declared.actionName || '行动'}】${declared.targetName ? `，目标为${declared.targetName}` : ''}`);
      }
      return lines.join('；');
    };
    const actionBlocks = entries.map((entry, index) => {
      const sourceIds = readSourceIds(entry);
      const events = sourceIds.map(id => eventById.get(id)).filter(Boolean);
      const primary = events[0] || null;
      const kinds = new Set(events.map(event => String(event?.eventKind || '').trim()));
      const roles = new Set(events.map(event => normalizeActionRole(event?.actionRole || inferActionRole(event))));
      const round = Number(entry?.round || primary?.round || primary?.sourceRound || 0);
      const actorName = String(primary?.actorName || '').trim();
      const actionName = normalizeActionDisplayName(primary?.finalActionName || primary?.actionName || '');
      const actionGroupId = String(primary?.actionId || primary?.sourceActionId || sourceIds[0] || `report_${round}_${index + 1}`).trim();
      const blockType = kinds.has('state_tick') ? 'STATE_TICK' :
        kinds.has('summon_create') || kinds.has('summon_assist') ? 'SUMMON_ACTION' :
          kinds.size > 0 && [...kinds].every(kind => ['resource_change', 'round_recover'].includes(kind)) ? 'RESOURCE_CHANGE' :
            roles.has('COUNTER') || kinds.has('counter') ? 'REACTION_RESOLVED' :
              'ACTION_RESOLVED';
      const facts = events.map(projectFact);
      const badges = (Array.isArray(entry?.blocks) ? entry.blocks : [])
        .filter(block => block?.type === 'badge')
        .map(block => ({
          kind: String(block?.kind || '').trim(),
          name: String(block?.name || '').trim(),
          value: Number(block?.value || 0),
          unit: String(block?.unit || '').trim(),
          targetId: String(block?.targetId || '').trim(),
          targetName: String(block?.targetName || '').trim(),
          sourceEventId: String(block?.sourceEventId || '').trim(),
          sourceNodeId: String(block?.sourceNodeId || '').trim(),
        }));
      const stateWindow = facts.find(fact => fact.duration > 0);
      const summonWindow = events.find(event => ['summon_create', 'summon_assist'].includes(String(event?.eventKind || '').trim()));
      const nextWindow = summonWindow
        ? String(summonWindow?.meta?.summonMode || summonWindow?.summonMode || '召唤物已进入可用行动窗口').trim()
        : stateWindow
          ? `【${stateWindow.stateName || '状态'}】还剩 ${stateWindow.duration} 个有效窗口`
          : '';
      return {
        blockId: `report_block_${String(actionGroupId || index + 1).replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_${index + 1}`,
        round,
        actionGroupId,
        actorId: String(primary?.actorId || actorName || '').trim(),
        targetIds: [...new Set(events.map(event => String(event?.targetId || event?.targetName || '').trim()).filter(Boolean))],
        blockType,
        facts,
        badges,
        intentSummary: readIntent(round, actorName, actionName),
        outcomeSummary: summarizeFacts(facts),
        nextWindow,
      };
    }).filter(block => block.facts.length > 0 && block.outcomeSummary);
    const maxRound = Math.max(
      0,
      ...ledger.map(event => Number(event?.round || event?.sourceRound || 0)),
      ...entries.map(entry => Number(entry?.round || 0)),
      ...decisions.map(item => Number(item?.回合 || item?.round || 0)),
    );
    const roundSummaries = Array.from({ length: maxRound }, (_, index) => index + 1).map(round => {
      const roundEvents = ledger.filter(event => Number(event?.round || event?.sourceRound || 0) === round);
      const facts = roundEvents.map(projectFact);
      const badges = actionBlocks
        .filter(block => Number(block?.round || 0) === round)
        .flatMap(block => Array.isArray(block?.badges) ? block.badges : [])
        .filter((badge, index, list) => list.findIndex(item =>
          String(item?.sourceEventId || '').trim() === String(badge?.sourceEventId || '').trim() &&
          String(item?.kind || '').trim() === String(badge?.kind || '').trim() &&
          String(item?.targetId || item?.targetName || '').trim() === String(badge?.targetId || badge?.targetName || '').trim()
        ) === index);
      const damageCount = facts.filter(fact => fact.factType === 'DAMAGE' || fact.factType === 'STATE_TICK' && fact.value > 0).length;
      const resourceCount = facts.filter(fact => fact.factType === 'RESOURCE_CHANGE').length;
      const stateCount = facts.filter(fact => fact.factType === 'STATE_CHANGE').length;
      const summonCount = facts.filter(fact => fact.factType === 'SUMMON').length;
      const roundDecisions = decisions.filter(item => Number(item?.回合 || item?.round || 0) === round);
      const intentSummary = roundDecisions.map(item => {
        const actor = String(item?.行动者 || item?.actor || '').trim();
        const action = normalizeActionDisplayName(item?.finalResolvedActionName || item?.技能 || item?.skill || '');
        return actor && action ? readIntent(round, actor, action) : '';
      }).filter(Boolean).join('；');
      const activeState = facts.find(fact => fact.duration > 0 && fact.stateName);
      return {
        blockId: `round_summary_${round}`,
        round,
        actionGroupId: `round_summary_${round}`,
        actorId: 'SYSTEM',
        targetIds: [...new Set(facts.map(fact => fact.targetId).filter(Boolean))],
        blockType: 'ROUND_SUMMARY',
        facts,
        badges,
        intentSummary,
        outcomeSummary: `第${round}回合记录${damageCount}项伤害、${resourceCount}项资源、${stateCount}项状态、${summonCount}项召唤事实`,
        nextWindow: activeState ? `【${activeState.stateName}】还剩 ${activeState.duration} 个有效窗口` : '',
      };
    });
    return [...actionBlocks, ...roundSummaries].sort((left, right) =>
      Number(left?.round || 0) - Number(right?.round || 0) ||
      (left?.blockType === 'ROUND_SUMMARY' ? 1 : 0) - (right?.blockType === 'ROUND_SUMMARY' ? 1 : 0)
    );
  }

  function buildRoundOverview(result = null, context = {}) {
    const resolveUnitSide = requireEngine().caseDomain.resolveReportUnitSide;
    const ledger = Array.isArray(result?.eventLedger) ? result.eventLedger : (Array.isArray(result?.combatData?.__battleEventLedger) ? result.combatData.__battleEventLedger : []);
    const rounds = new Map();
    const pushRound = round => {
      const key = Math.max(0, Number(round || 0));
      if (!rounds.has(key)) rounds.set(key, { round: key, playerHpDelta: 0, enemyHpDelta: 0, playerHpSourceEventIds: [], enemyHpSourceEventIds: [], resourceDeltas: [], highlights: [] });
      return rounds.get(key);
    };
    const actualRoundCount = Math.max(
      0,
      Number(result?.roundsExecuted || result?.roundCount || 0),
      ...ledger.map(event => Number(event?.round || event?.sourceRound || 0)),
    );
    for (let round = 1; round <= actualRoundCount; round += 1) pushRound(round);
    const pushHighlight = (round, text, weight = 1, source = {}) => {
      const clean = String(text || '').trim();
      if (!clean) return;
      const item = pushRound(round);
      const sourceEventId = String(source?.eventId || source?.sourceEventId || '').trim();
      const sourceNodeId = String(source?.chainNodeId || source?.nodeId || source?.sourceNodeId || '').trim();
      if (!item.highlights.some(entry => entry.text === clean)) {
        item.highlights.push({ text: clean, weight: Number(weight || 1), sourceEventId, sourceNodeId });
      }
    };
    const pushSourceId = (list = [], source = {}) => {
      const sourceEventId = String(source?.eventId || source?.sourceEventId || '').trim();
      if (sourceEventId && !list.includes(sourceEventId)) list.push(sourceEventId);
    };
    const pushHpDelta = (row, side = '', value = 0, source = {}) => {
      const amount = Math.round(Number(value || 0));
      if (!row || !amount) return;
      if (side === 'player') {
        row.playerHpDelta += amount;
        pushSourceId(row.playerHpSourceEventIds, source);
      } else if (side === 'enemy') {
        row.enemyHpDelta += amount;
        pushSourceId(row.enemyHpSourceEventIds, source);
      }
    };
    const pushResourceDelta = (round, actorName = '', resourceName = '', value = 0, source = {}) => {
      const actorText = String(actorName || '').trim();
      const resourceText = String(resourceName || '').trim();
      const amount = Math.round(Number(value || 0));
      if (!actorText || !resourceText || !amount) return;
      const item = pushRound(round);
      const key = `${actorText}|${resourceText}`;
      const existing = item.resourceDeltas.find(entry => entry.key === key);
      if (existing) {
        existing.value += amount;
        pushSourceId(existing.sourceEventIds, source);
      } else {
        const sourceEventIds = [];
        pushSourceId(sourceEventIds, source);
        item.resourceDeltas.push({ key, actorName: actorText, resourceName: resourceText, value: amount, sourceEventIds });
      }
    };
    ledger.forEach(event => {
      const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
      const kind = String(event?.eventKind || '').trim();
      const actor = String(event?.actorName || '').trim();
      const target = String(event?.targetName || '').trim();
      const action = normalizeActionDisplayName(event?.finalActionName || event?.actionName || '');
      const result = String(event?.result || event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim();
      const reason = String(event?.failReason || event?.failureReason || event?.meta?.failureReason || event?.reasonCode || event?.meta?.reasonCode || '').trim();
      if (isInternalFallbackEvent(event) && !/战术待机|待机|观察|防御|收招转防|守势|pass|observe|defend|stance/i.test(`${action} ${result} ${reason}`)) return;
      const targetSide = resolveUnitSide(context, target);
      const row = pushRound(round);
      const damage = Math.max(0, readLedgerNumber(event, 'damage') || readLedgerNumber(event, 'amount'));
      if ((kind === 'hit_result' || kind === 'counter' || kind === 'state_tick') && damage > 0) {
        const linkedCounterSettlement = kind === 'counter' && String(event?.meta?.settlementEventId || '').trim();
        const hpRecovery = kind === 'state_tick' && /恢复|heal|hot|recover/i.test(result) && /生命|HP|血/i.test(String(event?.meta?.resource || '生命值'));
        if (!linkedCounterSettlement && targetSide === 'player') pushHpDelta(row, 'player', hpRecovery ? damage : -damage, event);
        else if (!linkedCounterSettlement && targetSide === 'enemy') pushHpDelta(row, 'enemy', hpRecovery ? damage : -damage, event);
        if (kind === 'counter') pushHighlight(round, `${actor}防反命中${target}${damage ? `，${damage}伤害` : ''}`, 8, event);
        else if (damage >= 100 || /魂技|真身|融合|爆发/.test(action)) pushHighlight(round, `${actor}以【${action || '行动'}】重创${target}${damage ? `，${damage}伤害` : ''}`, /魂技|真身|融合|爆发/.test(action) || damage >= 160 ? 9 : 8, event);
      }            if (kind === 'action_cost') {
        const reqSp = Math.max(0, Number(event?.meta?.reqSp || 0));
        const reqVit = Math.max(0, Number(event?.meta?.reqVit || 0));
        const reqMen = Math.max(0, Number(event?.meta?.reqMen || 0));
        if (reqSp) pushResourceDelta(round, actor, '魂力', -reqSp, event);
        if (reqVit) pushResourceDelta(round, actor, '体力', -reqVit, event);
        if (reqMen) pushResourceDelta(round, actor, '精神力', -reqMen, event);
      } else if (kind === 'round_recover') {
        const resource = String(event?.meta?.resource || '').trim();
        const amount = Math.max(0, readLedgerNumber(event, 'amount'));
        if (amount && resource) pushResourceDelta(round, actor, resource, amount, event);
      } else if (kind === 'state_tick') {
        const resource = String(event?.meta?.resource || '').trim();
        if (damage > 0 && resource && !/生命|HP|血/i.test(resource)) {
          const isHeal = /恢复|heal|hot/i.test(String(event?.result || ''));
          pushResourceDelta(round, target || actor, resource, isHeal ? damage : -damage, event);
        }
      } else if (kind === 'resource_change') {
        const resource = String(event?.meta?.resource || '').trim();
        const delta = Number(event?.meta?.delta || 0);
        if (/生命|HP|血/i.test(resource)) pushHpDelta(row, targetSide, delta, event);
        else if (resource && delta) pushResourceDelta(round, target || actor, resource, delta, event);
      }
    if (kind === 'state_apply' && stateWasApplied(event)) {
        const stateName = readLedgerStateName(event);
        if (stateName) pushHighlight(round, `${target || actor}陷入【${stateName}】`, /控制|眩晕|禁锢|位移限制|迟缓|减速/.test(stateName) ? 7 : 4, event);
      } else if (kind === 'state_apply' && stateWasImmune(event)) {
        const stateName = readLedgerStateName(event);
        if (stateName) pushHighlight(round, `${target || actor}免疫【${stateName}】`, /控制|眩晕|禁锢|位移限制|迟缓|减速/.test(stateName) ? 6 : 3, event);
      } else if (kind === 'state_apply' && stateWasResisted(event)) {
        const stateName = readLedgerStateName(event);
        if (stateName) pushHighlight(round, `${target || actor}抵住【${stateName}】`, /控制|眩晕|禁锢|位移限制|迟缓|减速/.test(stateName) ? 6 : 3, event);
      } else if (kind === 'summon_create') {
        const summonName = String(event?.summonName || event?.createdName || '').trim();
        pushHighlight(round, `${actor}召出${summonName ? `【${summonName}】` : '召唤物'}`, 7, event);
      } else if (kind === 'blocked_action' || kind === 'failed_action') {
        if (readEventOutcome(event) === 'cap_reached') pushHighlight(round, `${actor}造物已达上限`, 5, event);
        else pushHighlight(round, `${actor}动作受阻`, 5, event);
      } else if (kind === 'defend') {
        pushHighlight(round, `${actor}转入防御`, 3, event);
      } else if (kind === 'dodge' && /evaded|dodged|闪避|规避/i.test(result)) {
        pushHighlight(round, `${actor}规避成功`, 4, event);
      }
    });
    return [...rounds.values()]
      .filter(item => item.round > 0 && item.round <= actualRoundCount)
      .sort((a, b) => a.round - b.round)
      .map(item => ({
        ...item,
        resourceDeltas: item.resourceDeltas
          .filter(entry => Math.round(Number(entry.value || 0)) !== 0)
          .slice(0, 4)
          .map(entry => ({ ...entry, value: Math.round(Number(entry.value || 0)), sourceEventIds: Array.isArray(entry.sourceEventIds) ? entry.sourceEventIds.slice(0, 8) : [] })),
        playerHpSourceEventIds: Array.isArray(item.playerHpSourceEventIds) ? item.playerHpSourceEventIds.slice(0, 12) : [],
        enemyHpSourceEventIds: Array.isArray(item.enemyHpSourceEventIds) ? item.enemyHpSourceEventIds.slice(0, 12) : [],
        highlights: item.highlights.sort((a, b) => b.weight - a.weight).slice(0, 1),
      }));
  }

  function buildFinalSummary(eventLedger = [], decisionTrace = [], finalSnapshot = {}, combatData = null) {
    const ledger = (Array.isArray(eventLedger) ? eventLedger : []).filter(event => event && typeof event === 'object');
    const snapshot = finalSnapshot && typeof finalSnapshot === 'object' ? finalSnapshot : {};
    const playerUnits = Array.isArray(snapshot.team_player) ? snapshot.team_player : [];
    const enemyUnits = Array.isArray(snapshot.team_enemy) ? snapshot.team_enemy : [];
    const summons = Array.isArray(snapshot.summons) ? snapshot.summons : [];
    const summarizeUnit = unit => ({
      name: String(unit?.name || '单位').trim(),
      hp: Math.max(0, Math.round(Number(unit?.hp || 0))),
      hpMax: Math.max(1, Math.round(Number(unit?.hp_max || 1))),
      sp: Math.max(0, Math.round(Number(unit?.sp || 0))),
      spMax: Math.max(1, Math.round(Number(unit?.sp_max || 1))),
      vit: Math.max(0, Math.round(Number(unit?.vit || 0))),
      vitMax: Math.max(1, Math.round(Number(unit?.vit_max || 1))),
      men: Math.max(0, Math.round(Number(unit?.men || 0))),
      menMax: Math.max(1, Math.round(Number(unit?.men_max || 1))),
      states: (Array.isArray(unit?.状态效果) ? unit.状态效果 : [])
        .filter(state => Number(state?.duration || 0) > 0)
        .map(state => ({ name: String(state?.name || '状态').trim(), duration: Math.max(0, Math.round(Number(state?.duration || 0))), skipTurn: state?.skip_turn === true, dot: Math.max(0, Number(state?.dot || 0)) })),
    });
    const playerSummary = playerUnits.map(summarizeUnit);
    const enemySummary = enemyUnits.map(summarizeUnit);
    const summonSummary = summons.map(unit => ({
      ...summarizeUnit(unit),
      host: String(unit?.宿主名 || '').trim(),
      mode: String(unit?.行动模式 || '').trim(),
      remainingWindows: Math.max(0, Math.round(Number(unit?.剩余窗口 || 0))),
      stability: String(unit?.稳定状态 || '').trim(),
    }));
    const teamMetric = (units, sideSummons = []) => {
      const totalHp = units.reduce((sum, unit) => sum + unit.hp, 0);
      const totalHpMax = units.reduce((sum, unit) => sum + unit.hpMax, 0);
      const resourceCurrent = units.reduce((sum, unit) => sum + unit.sp + unit.vit + unit.men, 0);
      const resourceMax = units.reduce((sum, unit) => sum + unit.spMax + unit.vitMax + unit.menMax, 0);
      const alive = units.filter(unit => unit.hp > 0).length;
      const controlBurden = units.reduce((sum, unit) => sum + unit.states.filter(state => state.skipTurn).length, 0);
      const hpRatio = totalHp / Math.max(1, totalHpMax);
      const resourceRatio = resourceCurrent / Math.max(1, resourceMax);
      const aliveRatio = alive / Math.max(1, units.length);
      return {
        alive,
        total: units.length,
        hpRatio,
        resourceRatio,
        score: hpRatio * 65 + aliveRatio * 20 + resourceRatio * 10 + sideSummons.filter(unit => unit.hp > 0 && unit.remainingWindows > 0).length * 3 - controlBurden * 4,
      };
    };
    const playerNames = new Set(playerSummary.map(unit => unit.name));
    const enemyNames = new Set(enemySummary.map(unit => unit.name));
    const playerSummons = summonSummary.filter(unit => playerNames.has(unit.host));
    const enemySummons = summonSummary.filter(unit => enemyNames.has(unit.host));
    const playerMetric = teamMetric(playerSummary, playerSummons);
    const enemyMetric = teamMetric(enemySummary, enemySummons);
    const scoreGap = Number((playerMetric.score - enemyMetric.score).toFixed(2));
    const advantage = scoreGap >= 8 ? 'PLAYER' : scoreGap >= 2 ? 'PLAYER_EDGE' : scoreGap <= -8 ? 'ENEMY' : scoreGap <= -2 ? 'ENEMY_EDGE' : 'EVEN';
    const advantageText = advantage === 'PLAYER' ? '我方占优' :
      advantage === 'PLAYER_EDGE' ? '我方略占上风' :
        advantage === 'ENEMY' ? '敌方占优' :
          advantage === 'ENEMY_EDGE' ? '敌方略占上风' : '战况胶着';
    const readCurrentTargets = () => {
      const pairs = [];
      const actors = new Set();
      for (let index = ledger.length - 1; index >= 0 && pairs.length < 6; index -= 1) {
        const event = ledger[index];
        const actor = String(event?.actorName || '').trim();
        const target = String(event?.targetName || '').trim();
        if (!actor || !target || actor === target || actors.has(actor)) continue;
        if (!['action_start', 'hit_result', 'counter', 'state_apply', 'summon_assist'].includes(String(event?.eventKind || '').trim())) continue;
        actors.add(actor);
        pairs.push({ actor, target });
      }
      return pairs;
    };
    const { playerIntent, enemyIntent } = requireEngine().caseDomain.resolveNextIntents({
      combatData, decisionTrace, playerSummary, enemySummary, currentTargets: readCurrentTargets(),
    });
    const tacticalWindows = [];
    const risks = [];
    [...playerSummary, ...enemySummary].forEach(unit => {
      const hpRatio = unit.hp / Math.max(1, unit.hpMax);
      const resourceRatio = (unit.sp + unit.vit + unit.men) / Math.max(1, unit.spMax + unit.vitMax + unit.menMax);
      if (unit.hp > 0 && hpRatio <= 0.25) tacticalWindows.push(`${unit.name}生命低于25%，进入斩杀窗口`);
      if (unit.hp > 0 && resourceRatio <= 0.2) risks.push(`${unit.name}可用资源接近枯竭`);
      unit.states.forEach(state => {
        if (state.skipTurn) tacticalWindows.push(`${unit.name}被【${state.name}】限制行动${state.duration}回合`);
        if (state.dot > 0) risks.push(`${unit.name}仍承受【${state.name}】持续伤害${state.duration}回合`);
      });
    });
    summonSummary.forEach(unit => {
      if (unit.hp > 0 && unit.remainingWindows > 0) tacticalWindows.push(`${unit.name}尚有${unit.remainingWindows}个${unit.mode || '行动'}窗口`);
      if (unit.hp <= 0 || unit.remainingWindows <= 0) risks.push(`${unit.name}已无可兑现行动窗口`);
    });
    const hpRatioGap = playerMetric.hpRatio - enemyMetric.hpRatio;
    if (hpRatioGap <= -0.03) {
      tacticalWindows.push('敌方尚未承受同等生命损失，我方需要先建立有效命中或控制窗口');
      risks.push('我方换血落后，继续空耗会让敌方把轻微优势滚大');
    } else if (hpRatioGap >= 0.03) {
      tacticalWindows.push('我方已建立生命优势，可以围绕集火或资源压制继续扩大差距');
      risks.push('若在优势期转入无效辅助，可能错失继续压制的窗口');
    } else if (!tacticalWindows.length) {
      tacticalWindows.push('双方均无硬控制，下一次有效命中或截断将重新分配主动权');
    }
    const currentTargets = readCurrentTargets();
    const round = Math.max(0, Number(snapshot?.round || ledger[ledger.length - 1]?.round || 0));
    const formatTeam = units => units.length ? units.map(unit => `${unit.name} HP ${unit.hp}/${unit.hpMax}，魂力 ${unit.sp}/${unit.spMax}，体力 ${unit.vit}/${unit.vitMax}，精神力 ${unit.men}/${unit.menMax}${unit.states.length ? `，状态 ${unit.states.map(state => `${state.name}(${state.duration})`).join('、')}` : ''}`).join('；') : '无可行动单位';
    const text = [
      `战至第${round}回合，${advantageText}。`,
      `我方：${formatTeam(playerSummary)}。敌方：${formatTeam(enemySummary)}。`,
      `接下来我方${playerIntent.replace(/^我方/, '')}；敌方${enemyIntent.replace(/^敌方/, '')}。`,
      `可利用窗口：${tacticalWindows.slice(0, 5).join('；') || '暂时没有明确窗口'}。最大风险：${risks.slice(0, 4).join('；') || '双方暂无迫近的资源或状态风险'}。`,
    ].join('\n');
    const finalBattleReport = {
      blockId: `final_summary_${round}`,
      round,
      actionGroupId: `final_summary_${round}`,
      actorId: 'SYSTEM',
      targetIds: [],
      blockType: 'FINAL_SUMMARY',
      facts: [
        { factType: 'BATTLE_STATE', round, advantage, scoreGap },
        { factType: 'TEAM_STATE', side: 'PLAYER', units: playerSummary },
        { factType: 'TEAM_STATE', side: 'ENEMY', units: enemySummary },
        { factType: 'SUMMON_STATE', units: summonSummary },
      ],
      badges: [],
      intentSummary: `我方：${playerIntent}；敌方：${enemyIntent}`,
      outcomeSummary: advantageText,
      nextWindow: tacticalWindows.slice(0, 5).join('；'),
      headline: advantageText,
      advantage,
      scoreGap,
      sides: { player: { units: playerSummary, metric: playerMetric }, enemy: { units: enemySummary, metric: enemyMetric } },
      summons: summonSummary,
      currentTargets,
      nextIntents: { player: playerIntent, enemy: enemyIntent },
      tacticalWindows: [...new Set(tacticalWindows)].slice(0, 8),
      risks: [...new Set(risks)].slice(0, 8),
      text,
    };
    const aiSummaryInput = {
      round,
      advantage,
      sides: {
        player: playerSummary,
        enemy: enemySummary,
      },
      summons: summonSummary,
      currentTargets,
      nextIntents: { player: playerIntent, enemy: enemyIntent },
      tacticalWindows: finalBattleReport.tacticalWindows,
      risks: finalBattleReport.risks,
      recentFacts: ledger
        .filter(event => ['action_start', 'hit_result', 'counter', 'state_apply', 'state_tick', 'resource_change', 'summon_create', 'summon_assist', 'failed_action', 'blocked_action'].includes(String(event?.eventKind || '').trim()))
        .slice(-24)
        .map(event => ({
          round: Math.max(0, Number(event?.round || event?.sourceRound || 0)),
          factType: String(event?.eventKind || '').trim(),
          actor: String(event?.actorName || '').trim(),
          target: String(event?.targetName || '').trim(),
          action: normalizeActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || ''),
          result: String(event?.result || event?.actionStatus || '').trim(),
          value: Math.round(Number(readLedgerNumber(event, 'damage') || event?.meta?.delta || readLedgerNumber(event, 'amount') || 0)),
          state: ['state_apply', 'state_tick'].includes(String(event?.eventKind || '').trim()) ? readLedgerStateName(event) : '',
        })),
    };
    return { finalBattleReport, aiSummaryInput };
  }

  function buildAiNarrativeSummary(aiSummaryInput = {}, options = {}) {
    const input = aiSummaryInput && typeof aiSummaryInput === 'object' ? aiSummaryInput : {};
    const tokenBudget = Math.max(240, Number(options?.tokenBudget || 1400));
    const maxRounds = Math.max(1, Number(options?.maxRounds || 3));
    const playerUnits = Array.isArray(input?.sides?.player) ? input.sides.player : [];
    const enemyUnits = Array.isArray(input?.sides?.enemy) ? input.sides.enemy : [];
    const summons = Array.isArray(input?.summons) ? input.summons : [];
    const formatUnit = unit => {
      const states = (Array.isArray(unit?.states) ? unit.states : [])
        .filter(state => Number(state?.duration || 0) > 0)
        .slice(0, 5)
        .map(state => `${String(state?.name || '状态').trim()}(${Math.max(0, Math.round(Number(state?.duration || 0)))}回合)`);
      return [
        `${String(unit?.name || '单位').trim()} HP${Math.max(0, Math.round(Number(unit?.hp || 0)))}`,
        `魂力${Math.max(0, Math.round(Number(unit?.sp || 0)))}`,
        `体力${Math.max(0, Math.round(Number(unit?.vit || 0)))}`,
        `精神力${Math.max(0, Math.round(Number(unit?.men || 0)))}`,
        states.length ? `状态:${states.join('、')}` : '状态:无',
      ].join('；');
    };
    const lines = [`[战斗终态][回合${Math.max(0, Number(input?.round || 0))}]`];
    if (playerUnits.length) lines.push(`[我方] ${playerUnits.map(formatUnit).join(' | ')}`);
    if (enemyUnits.length) lines.push(`[敌方] ${enemyUnits.map(formatUnit).join(' | ')}`);
    if (summons.length) {
      lines.push(`[召唤物] ${summons.slice(0, 8).map(unit => [
        formatUnit(unit),
        unit?.host ? `宿主:${unit.host}` : '',
        unit?.mode ? `模式:${unit.mode}` : '',
        `剩余窗口:${Math.max(0, Math.round(Number(unit?.remainingWindows || 0)))}`,
        unit?.stability ? `稳定:${unit.stability}` : '',
      ].filter(Boolean).join('；')).join(' | ')}`);
    }
    const currentTargets = (Array.isArray(input?.currentTargets) ? input.currentTargets : [])
      .map(pair => `${String(pair?.actor || '').trim()}->${String(pair?.target || '').trim()}`)
      .filter(pair => !/^->|->$/.test(pair));
    lines.push(`[当前目标] ${currentTargets.join('；') || '无明确目标'}`);
    lines.push(`[下一步意图] 我方:${String(input?.nextIntents?.player || '无明确行动').trim()}；敌方:${String(input?.nextIntents?.enemy || '无明确行动').trim()}`);
    lines.push(`[战术窗口] ${(Array.isArray(input?.tacticalWindows) ? input.tacticalWindows : []).slice(0, 8).join('；') || '暂无明确窗口'}`);
    lines.push(`[风险] ${(Array.isArray(input?.risks) ? input.risks : []).slice(0, 8).join('；') || '暂无迫近风险'}`);
    const terminalLineCount = lines.length;
    lines.push('[近期事实]');
    const recentFacts = Array.isArray(input?.recentFacts) ? input.recentFacts : [];
    const latestRound = Math.max(0, ...recentFacts.map(fact => Number(fact?.round || 0)));
    recentFacts
      .filter(fact => Number(fact?.round || 0) >= Math.max(1, latestRound - maxRounds + 1))
      .forEach(fact => {
        const round = Math.max(0, Number(fact?.round || 0));
        const actor = String(fact?.actor || '行动者').trim();
        const target = String(fact?.target || actor || '目标').trim();
        const action = normalizeActionDisplayName(fact?.action || '行动');
        const value = Math.round(Number(fact?.value || 0));
        const state = String(fact?.state || '').trim();
        const factType = String(fact?.factType || '').trim();
        const detail = value
          ? `数值${value > 0 ? '+' : ''}${value}`
          : state
            ? `状态:${state}`
            : factType === 'action_start'
              ? '动作已宣告'
              : ['failed_action', 'blocked_action'].includes(factType)
                ? '动作未完成'
                : '事实已结算';
        lines.push(`[回合${round}][${actor}] 使用【${action}】 -> [${target}]。[${detail}]`);
      });
    let text = lines.join('\n');
    if (text.length > tokenBudget) {
      const terminalLines = lines.slice(0, terminalLineCount);
      const retained = [];
      for (let index = lines.length - 1; index > terminalLineCount; index -= 1) {
        const next = [...terminalLines, '[近期事实]', '[更早事实已折叠]', lines[index], ...retained].join('\n');
        if (next.length <= tokenBudget) retained.unshift(lines[index]);
      }
      text = [...terminalLines, '[近期事实]', '[更早事实已折叠]', ...retained].join('\n');
    }
    return text;
  }

  function auditFacts(payload = {}) {
    payload = payload && typeof payload === 'object' ? cloneValue(payload) : {};
    const eventLedger = Array.isArray(payload.eventLedger) ? payload.eventLedger.filter(Boolean) : [];
    const resolutionTrace = Array.isArray(payload.resolutionTrace) ? payload.resolutionTrace.filter(Boolean) : [];
    const publicReportBlocks = Array.isArray(payload.publicReportBlocks) ? payload.publicReportBlocks.filter(Boolean) : [];
    const scoringAudit = Array.isArray(payload.scoringAudit) ? payload.scoringAudit.filter(Boolean) : [];
    const initialSnapshot = payload.initialSnapshot && typeof payload.initialSnapshot === 'object' ? payload.initialSnapshot : null;
    const finalSnapshot = payload.finalSnapshot && typeof payload.finalSnapshot === 'object' ? payload.finalSnapshot : null;
    const fatals = [];
    const warnings = [];
    const pushFatal = (code, detail = {}) => fatals.push({ code, ...detail });
    const readDamage = event => Math.max(0, Math.round(Number(event?.appliedDamage ?? event?.meta?.appliedDamage ?? event?.meta?.damage ?? event?.damage ?? 0)));
    const readProbability = value => {
      if (typeof value === 'string' && /%/.test(value)) return Number.parseFloat(value) / 100;
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      return number > 1 ? number / 100 : number;
    };
    const isSuccess = event => /success|succeeded|evaded|guarded|hit|成功|命中/.test(String(event?.result || event?.primaryOutcome || '').trim());
    const sourceProjectionMap = new Map();
    const collectBlockSources = (value, inheritedProjection = '') => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(item => collectBlockSources(item, inheritedProjection));
        return;
      }
      const projection = String(value.projectionSource || inheritedProjection || '').trim();
      const ids = [value.sourceEventId, ...(Array.isArray(value.sourceEventIds) ? value.sourceEventIds : [])]
        .map(item => String(item || '').trim())
        .filter(Boolean);
      ids.forEach(id => {
        if (!sourceProjectionMap.has(id)) sourceProjectionMap.set(id, new Set());
        if (projection) sourceProjectionMap.get(id).add(projection);
      });
      Object.values(value).forEach(item => collectBlockSources(item, projection));
    };
    collectBlockSources(publicReportBlocks);

    const normalizeBalanceResourceKey = value => {
      const text = String(value || '').trim();
      if (/护盾|shield/i.test(text)) return 'shield';
      if (/生命|HP|hp/i.test(text)) return 'hp';
      if (/体力|vit|sta/i.test(text)) return 'vit';
      if (/精神|men/i.test(text)) return 'men';
      if (/魂力|sp/i.test(text)) return 'sp';
      return '';
    };
    const collectSnapshotUnits = snapshot => {
      const units = [];
      const append = (items, side) => (Array.isArray(items) ? items : []).forEach(unit => {
        const name = String(unit?.name || unit?.名称 || '').trim();
        if (!name) return;
        units.push({
          key: `${side}|${name}`,
          side,
          name,
          values: {
            hp: Math.round(Number(unit?.hp ?? unit?.HP ?? 0)),
            vit: Math.round(Number(unit?.vit ?? unit?.sta ?? unit?.体力 ?? 0)),
            sp: Math.round(Number(unit?.sp ?? unit?.魂力 ?? 0)),
            men: Math.round(Number(unit?.men ?? unit?.精神力 ?? 0)),
            shield: Math.round(Number(unit?.shield ?? unit?.护盾 ?? 0)),
          },
        });
      });
      append(snapshot?.team_player, 'player');
      append(snapshot?.team_enemy, 'enemy');
      append(snapshot?.summons, 'summon');
      return units;
    };
    const initialUnits = collectSnapshotUnits(initialSnapshot);
    const finalUnits = collectSnapshotUnits(finalSnapshot);
    const findBalanceUnit = (name = '', side = '') => {
      const normalizedName = String(name || '').trim();
      const normalizedSide = normalizeBattleSide(side);
      const allUnits = [...initialUnits, ...finalUnits];
      const bySide = normalizedSide
        ? allUnits.find(unit => unit.side === normalizedSide && isSameReportName(unit.name, normalizedName))
        : null;
      if (bySide) return bySide;
      const matches = allUnits.filter(unit => isSameReportName(unit.name, normalizedName));
      return matches.length === 1 ? matches[0] : null;
    };
    const balanceDeltas = new Map();
    const addBalanceDelta = (name, side, resource, delta, eventId) => {
      const normalizedResource = normalizeBalanceResourceKey(resource);
      const amount = Math.round(Number(delta || 0));
      const unit = findBalanceUnit(name, side);
      if (!unit || !normalizedResource || !amount) return;
      const key = `${unit.key}|${normalizedResource}`;
      const entry = balanceDeltas.get(key) || { delta: 0, eventIds: [] };
      entry.delta += amount;
      if (eventId) entry.eventIds.push(String(eventId));
      balanceDeltas.set(key, entry);
    };
    eventLedger.forEach(event => {
      const kind = String(event?.eventKind || '').trim();
      const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
      const eventId = String(event?.eventId || '').trim();
      const targetName = String(event?.targetName || event?.actorName || '').trim();
      const targetSide = String(event?.targetSide || event?.actorSide || '').trim();
      if (kind === 'action_cost') {
        addBalanceDelta(event?.actorName, event?.actorSide, 'sp', -Math.max(0, Number(meta.reqSp || 0)), eventId);
        addBalanceDelta(event?.actorName, event?.actorSide, 'vit', -Math.max(0, Number(meta.reqVit || 0)), eventId);
        addBalanceDelta(event?.actorName, event?.actorSide, 'men', -Math.max(0, Number(meta.reqMen || 0)), eventId);
        return;
      }
      if (kind === 'resource_change') {
        const rawDelta = Number(meta.delta ?? event?.delta ?? 0);
        const amount = Math.max(0, Number(meta.amount ?? event?.amount ?? Math.abs(rawDelta) ?? 0));
        const result = String(event?.result || '').trim();
        const delta = Number.isFinite(rawDelta) && rawDelta !== 0
          ? rawDelta
          : (/loss|cost|drain|损失|消耗|扣除/.test(result) ? -amount : amount);
        addBalanceDelta(targetName, targetSide, meta.resourceKey || meta.resource || event?.resource, delta, eventId);
        return;
      }
      if (kind === 'state_tick') {
        const resource = normalizeBalanceResourceKey(meta.resource || event?.resource);
        const amount = Math.max(0, Number(meta.amount ?? event?.amount ?? event?.appliedDamage ?? 0));
        const result = String(event?.result || '').trim();
        const delta = /恢复|gain|heal|recover/.test(result) ? amount : -amount;
        addBalanceDelta(targetName, targetSide, resource, delta, eventId);
        return;
      }
      if (kind === 'hit_result') {
        addBalanceDelta(targetName, targetSide, 'hp', -readDamage(event), eventId);
        return;
      }
      if (kind === 'counter') {
        const settlementEventId = String(meta.settlementEventId || '').trim();
        if (!settlementEventId) addBalanceDelta(targetName, targetSide, 'hp', -readDamage(event), eventId);
        return;
      }
      if (kind === 'shield_create' || kind === 'shield_break') {
        const amount = Math.max(0, Number(meta.amount ?? meta.shieldAmount ?? meta.shieldValue ?? event?.amount ?? 0));
        addBalanceDelta(targetName, targetSide, 'shield', kind === 'shield_break' ? -amount : amount, eventId);
      }
    });
    if (initialUnits.length && finalUnits.length) {
      initialUnits.forEach(initialUnit => {
        const finalUnit = finalUnits.find(unit => unit.key === initialUnit.key);
        if (!finalUnit) return;
        Object.keys(initialUnit.values).forEach(resource => {
          const initialValue = initialUnit.values[resource];
          const finalValue = finalUnit.values[resource];
          const balance = balanceDeltas.get(`${initialUnit.key}|${resource}`) || { delta: 0, eventIds: [] };
          const expectedFinalValue = initialValue + balance.delta;
          if (finalValue !== expectedFinalValue) {
            pushFatal('LEDGER_CONSERVATION_MISMATCH', {
              unit: initialUnit.name,
              side: initialUnit.side,
              resource,
              initialValue,
              finalValue,
              ledgerDelta: balance.delta,
              expectedFinalValue,
              eventIds: balance.eventIds,
            });
          }
        });
      });
    }

    const actionQueueTrace = Array.isArray(payload.actionQueueTrace)
      ? payload.actionQueueTrace.filter(Boolean)
      : Array.isArray(payload?.combatData?.__battleRuntime?.actionQueueTrace)
        ? payload.combatData.__battleRuntime.actionQueueTrace.filter(Boolean)
        : [];
    const actionQueueFatal = payload?.combatData?.__battleRuntime?.actionQueueFatal;
    if (actionQueueFatal?.code) pushFatal('ACTION_QUEUE_FATAL', { ...actionQueueFatal });
    const consumedGrants = new Map();
    const executedNodes = new Map();
    actionQueueTrace.forEach((entry, index) => {
      if (String(entry?.state || '').trim() !== 'EXECUTED') return;
      const round = Number(entry?.round || 0);
      const actionSequence = Number(entry?.actionSequence || 0);
      const parentActionSequence = Number(entry?.parentActionSequence || 0);
      const grantId = String(entry?.grantId || '').trim();
      const grantKey = `${round}|${grantId}`;
      if (!grantId) {
        pushFatal('ACTION_GRANT_MISSING', { index, round, actionSequence });
        return;
      }
      if (consumedGrants.has(grantKey)) {
        pushFatal('ACTION_GRANT_CONSUMED_TWICE', { index, round, grantId, duplicateOf: consumedGrants.get(grantKey) });
      } else {
        consumedGrants.set(grantKey, index);
      }
      const nodeKey = `${round}|${actionSequence}`;
      if (executedNodes.has(nodeKey)) {
        pushFatal('ACTION_QUEUE_SEQUENCE_DUPLICATED', { index, round, actionSequence, duplicateOf: executedNodes.get(nodeKey).index });
      } else {
        executedNodes.set(nodeKey, { index, parentActionSequence });
      }
      if (parentActionSequence > 0) {
        const parent = executedNodes.get(`${round}|${parentActionSequence}`);
        if (!parent || parent.index >= index) {
          pushFatal('ACTION_QUEUE_PARENT_ORDER_INVALID', { index, round, actionSequence, parentActionSequence });
        }
      }
    });

    if (payload.roundsRequested > 0 && eventLedger.length === 0) {
      pushFatal('BATTLE_REQUEST_WITHOUT_FACTS', { roundsRequested: Number(payload.roundsRequested || 0) });
    }
    const creationKeys = new Map();
    eventLedger.filter(event => String(event?.eventKind || '').trim() === 'create').forEach(event => {
      const createdName = String(event?.createdName || event?.meta?.createdName || '').trim();
      const ownerName = String(event?.meta?.ownerName || event?.targetName || '').trim();
      const count = Math.max(0, Number(event?.count ?? event?.meta?.count ?? 0));
      if (!createdName || !ownerName || !(count > 0)) {
        pushFatal('CREATION_FACT_INCOMPLETE', { eventId: event?.eventId || '', createdName, ownerName, count });
        return;
      }
      const key = [
        Number(event?.round || 0),
        String(event?.sourceActionId || event?.actionId || '').trim(),
        String(event?.actorName || '').trim(),
        ownerName,
        normalizeActionDisplayName(event?.actionName || event?.sourceActionName || ''),
        createdName,
      ].join('|');
      if (creationKeys.has(key)) {
        pushFatal('DUPLICATE_CREATION_FACT', { eventId: event.eventId, duplicateOf: creationKeys.get(key), key });
      } else {
        creationKeys.set(key, String(event?.eventId || '').trim());
      }
    });

    const settlementEvents = eventLedger.filter(event => {
      const kind = String(event?.eventKind || '').trim();
      if (kind === 'hit_result') return readDamage(event) > 0;
      if (kind !== 'state_tick') return false;
      return readDamage(event) > 0 && !/魂力|精神力|体力|资源/.test(String(event?.meta?.resource || '').trim());
    });
    const settlementKeys = new Map();
    settlementEvents.forEach(event => {
      const applicationId = String(event?.applicationId || event?.meta?.applicationId || '').trim();
      const key = applicationId || [
        Number(event?.round || 0),
        String(event?.actionId || event?.sourceActionId || '').trim(),
        String(event?.actorName || '').trim(),
        String(event?.targetName || '').trim(),
        normalizeActionDisplayName(event?.actionName || event?.sourceActionName || ''),
        String(event?.eventKind || '').trim(),
        Number(event?.meta?.segmentIndex || 0),
      ].join('|');
      if (settlementKeys.has(key)) {
        pushFatal('DUPLICATE_DAMAGE_SETTLEMENT', { eventId: event.eventId, duplicateOf: settlementKeys.get(key), key });
      } else {
        settlementKeys.set(key, String(event?.eventId || '').trim());
      }
      if (event?.effectCapability?.hasDamageEffect === false) {
        pushFatal('NON_DAMAGE_SKILL_DAMAGE', { eventId: event.eventId, actionName: event.actionName, damage: readDamage(event) });
      }
      const eventId = String(event?.eventId || '').trim();
      if (eventId && !sourceProjectionMap.has(eventId)) {
        pushFatal('REPORT_NUMERIC_FACT_MISSING', { eventId, eventKind: event.eventKind, damage: readDamage(event) });
      }
    });

    eventLedger.filter(event => String(event?.eventKind || '').trim() === 'counter' && readDamage(event) > 0).forEach(counter => {
      const matchingHit = settlementEvents.find(event =>
        String(event?.eventKind || '').trim() === 'hit_result' &&
        Number(event?.round || 0) === Number(counter?.round || 0) &&
        isSameReportName(event?.actorName || '', counter?.actorName || '') &&
        isSameReportName(event?.targetName || '', counter?.targetName || '') &&
        normalizeActionDisplayName(event?.actionName || '') === normalizeActionDisplayName(counter?.actionName || '') &&
        readDamage(event) === readDamage(counter)
      );
      if (matchingHit && String(counter?.meta?.settlementEventId || '').trim() !== String(matchingHit?.eventId || '').trim()) {
        pushFatal('DUPLICATE_DAMAGE_FACT', { eventId: counter.eventId, settlementEventId: matchingHit.eventId, damage: readDamage(counter) });
      }
    });

    eventLedger.forEach(event => {
      const kind = String(event?.eventKind || '').trim();
      const rate = readProbability(event?.meta?.dodgeRate ?? event?.meta?.probability ?? event?.probability);
      if (rate !== null && rate <= 0 && isSuccess(event) && ['dodge', 'counter'].includes(kind)) {
        pushFatal('ZERO_PROBABILITY_SUCCESS', { eventId: event.eventId, eventKind: kind, probability: rate, result: event.result });
      }
      if (kind === 'state_tick') {
        const eventId = String(event?.eventId || '').trim();
        const projections = eventId ? [...(sourceProjectionMap.get(eventId) || [])] : [];
        if (projections.some(source => !/state_tick|state_aggregation/.test(source))) {
          pushFatal('DOT_SOURCE_MISPROJECTED', { eventId, projections });
        }
      }
    });

    const summonActionGroups = new Map();
    eventLedger.filter(event => {
      const kind = String(event?.eventKind || '').trim();
      const actionType = String(event?.actionType || '').trim();
      return kind === 'action_start' && /summon_assist|召唤自主行动/.test(actionType);
    }).forEach(event => {
      const key = [Number(event?.round || 0), String(event?.actorName || '').trim()].join('|');
      if (!summonActionGroups.has(key)) summonActionGroups.set(key, []);
      summonActionGroups.get(key).push(String(event?.eventId || '').trim());
    });
    summonActionGroups.forEach((eventIds, key) => {
      if (eventIds.length > 1) pushFatal('SUMMON_DUPLICATE_ACTION', { key, eventIds });
    });
    eventLedger.filter(event => String(event?.eventKind || '').trim() === 'summon_end' && String(event?.ruleCode || event?.reasonCode || '').trim() === 'SUMMON_WINDOW_EXHAUSTED').forEach(endEvent => {
      const summonName = String(endEvent?.actorName || endEvent?.meta?.summonName || '').trim();
      const endRound = Number(endEvent?.round || 0);
      const createEvent = [...eventLedger].reverse().find(event =>
        String(event?.eventKind || '').trim() === 'summon_create' &&
        String(event?.meta?.summonName || '').trim() === summonName &&
        Number(event?.round || 0) <= endRound
      );
      const createRound = Number(createEvent?.round || 0);
      const actionEvent = eventLedger.find(event => {
        if (String(event?.actorName || event?.meta?.summonName || '').trim() !== summonName) return false;
        const round = Number(event?.round || 0);
        if (round < createRound || round > endRound) return false;
        const kind = String(event?.eventKind || '').trim();
        const actionType = String(event?.actionType || '').trim();
        return (kind === 'action_start' && /summon_assist|召唤自主行动/.test(actionType)) ||
          kind === 'summon_guard' ||
          (kind === 'failed_action' && /summon/.test(actionType));
      });
      if (!actionEvent) pushFatal('SUMMON_WINDOW_MISSING', { summonName, createEventId: createEvent?.eventId || '', endEventId: endEvent?.eventId || '' });
    });

    const terminalByAction = new Map();
    eventLedger.forEach(event => {
      const actionId = String(event?.sourceActionId || event?.actionId || '').trim();
      if (!actionId) return;
      if (!terminalByAction.has(actionId)) terminalByAction.set(actionId, { dodgeSuccess: [], damage: [] });
      const item = terminalByAction.get(actionId);
      if (String(event?.eventKind || '').trim() === 'dodge' && isSuccess(event)) item.dodgeSuccess.push(event.eventId);
      if (String(event?.eventKind || '').trim() === 'hit_result' && readDamage(event) > 0) item.damage.push(event.eventId);
    });
    terminalByAction.forEach((item, actionId) => {
      if (item.dodgeSuccess.length && item.damage.length) pushFatal('ACTION_TERMINAL_CONFLICT', { actionId, ...item });
    });

    resolutionTrace.forEach(node => {
      const missing = ['targetIds', 'actorControl', 'actionRole', 'sourceActionId', 'parentNodeId', 'reactionNodeId', 'ruleCode', 'resultState', 'factType']
        .filter(key => node?.[key] === undefined || node?.[key] === null);
      if (missing.length) warnings.push({ code: 'TRACE_CONTRACT_INCOMPLETE', nodeId: node?.nodeId || '', missing });
    });
    eventLedger.forEach(event => {
      const missing = ['targetIds', 'actorControl', 'actionRole', 'sourceActionId', 'parentNodeId', 'reactionNodeId', 'ruleCode', 'resultState', 'factType']
        .filter(key => event?.[key] === undefined || event?.[key] === null);
      if (missing.length) pushFatal('LEDGER_CONTRACT_INCOMPLETE', { eventId: event?.eventId || '', missing });
    });

    const scoreFields = ['candidateId', 'actionKind', 'actionRole', 'actorId', 'targetIds', 'rawObjectiveScore', 'subjectiveScore', 'scoreParts', 'factorKeys', 'scoreContributions', 'tags', 'alternativeGap', 'selectedReason', 'finalScore', 'rejectionCode'];
    const positiveScoreKeys = positiveScoreParts;
    const costScoreKeys = costScoreParts;
    const zeroScoreTags = new Set(['DEAD_TARGET_SELECTED', 'ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'STRICTLY_DOMINATED']);
    scoringAudit.forEach((actionAudit, actionIndex) => {
      const candidates = Array.isArray(actionAudit?.candidates) ? actionAudit.candidates.filter(Boolean) : [];
      if (candidates.length > 3) pushFatal('SCORING_AUDIT_OVERSIZED', { actionIndex, candidateCount: candidates.length });
      candidates.forEach((candidate, candidateIndex) => {
        const missing = scoreFields.filter(key => candidate?.[key] === undefined || candidate?.[key] === null);
        if (missing.length) {
          pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate?.candidateId || '', missing });
          return;
        }
        const scoreParts = candidate.scoreParts && typeof candidate.scoreParts === 'object' ? candidate.scoreParts : {};
        const declaredFactorKeys = Array.isArray(candidate?.factorKeys) ? candidate.factorKeys.map(item => String(item || '').trim()).filter(Boolean) : [];
        const scoreContributions = Array.isArray(candidate?.scoreContributions) ? candidate.scoreContributions : [];
        const contributionKeys = scoreContributions.map(item => String(item?.valueKey || '').trim()).filter(Boolean);
        if (!declaredFactorKeys.length || new Set(declaredFactorKeys).size !== declaredFactorKeys.length ||
          contributionKeys.length !== scoreContributions.length || new Set(contributionKeys).size !== contributionKeys.length ||
          declaredFactorKeys.length !== contributionKeys.length || declaredFactorKeys.some((key, index) => key !== contributionKeys[index])) {
          pushFatal('SCORING_COMPONENT_DUPLICATED', { actionIndex, candidateIndex, candidateId: candidate.candidateId, factorKeys: declaredFactorKeys });
        }
        const contributionParts = Object.fromEntries([...positiveScoreKeys, ...costScoreKeys].map(component => [component, 0]));
        scoreContributions.forEach(contribution => {
          const component = String(contribution?.component || '').trim();
          if (!Object.prototype.hasOwnProperty.call(contributionParts, component)) {
            pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate.candidateId, component });
            return;
          }
          contributionParts[component] += Number(contribution?.expectedValue || 0);
        });
        Object.keys(contributionParts).forEach(component => { contributionParts[component] = Math.round(contributionParts[component]); });
        if (Object.keys(contributionParts).some(component => Number(scoreParts[component] || 0) !== contributionParts[component])) {
          pushFatal('SCORING_COMPONENT_TOTAL_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId: candidate.candidateId,
            scoreParts,
            contributionParts,
          });
        }
        const rawScore = Math.round(
          positiveScoreKeys.reduce((sum, key) => sum + Number(scoreParts[key] || 0), 0) -
          costScoreKeys.reduce((sum, key) => sum + Number(scoreParts[key] || 0), 0),
        );
        if (Number(candidate.rawObjectiveScore) !== rawScore) {
          pushFatal('SCORING_COMPONENT_TOTAL_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId: candidate.candidateId,
            expectedRawScore: rawScore,
            actualRawScore: Number(candidate.rawObjectiveScore),
          });
        }
        const tags = new Set(Array.isArray(candidate.tags) ? candidate.tags : []);
        const hardRejected = new Set(['RESOURCE_INSUFFICIENT', 'DEAD_TARGET_SELECTED', 'ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'STRICTLY_DOMINATED']).has(String(candidate.rejectionCode || '').trim()) ||
          [...tags].some(tag => zeroScoreTags.has(tag));
        const expectedScore = hardRejected
          ? 0
          : Math.max(0, Math.round(rawScore));
        if (Number(candidate.finalScore) !== expectedScore) {
          pushFatal('SCORING_FORMULA_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId: candidate.candidateId,
            expectedScore,
            actualScore: Number(candidate.finalScore),
          });
        }
      });
      const selected = candidates.find(candidate => ['EXECUTED', 'LOCKED', 'SELECTED'].includes(String(candidate?.candidateStatus || '').trim().toUpperCase())) ||
        candidates.find(candidate => String(candidate?.candidateId || '') === String(actionAudit?.selectedCandidateId || ''));
      if (!selected && candidates.length) {
        pushFatal('SCORING_SELECTED_MISSING', { actionIndex, selectedCandidateId: actionAudit?.selectedCandidateId || '' });
      } else if (selected) {
        const selectedTags = new Set(Array.isArray(selected.tags) ? selected.tags : []);
        const selectedRejected = String(selected.rejectionCode || '').trim();
        const forbidden = ['DEAD_TARGET_SELECTED', 'ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'CATASTROPHIC', 'STRICTLY_DOMINATED'];
        if (forbidden.includes(selectedRejected) || forbidden.some(code => selectedTags.has(code))) {
          pushFatal('BANNED_SUBJECTIVE_CANDIDATE_SELECTED', { actionIndex, selectedCandidateId: selected.candidateId, rejectionCode: selectedRejected, tags: [...selectedTags] });
        }
        const selectedReason = String(selected.selectedReason || '').trim();
        if (selectedReason === 'SUBJECTIVE_SOFTMAX' || selectedReason === 'DECISION_INTERFERENCE_SOFTMAX' || String(actionAudit?.ruleCode || '').trim() === 'DECISION_INTERFERENCE') {
          const highestObjectiveScore = Math.max(...candidates.map(candidate => Number(candidate?.rawObjectiveScore || 0)));
          const objectiveRegret = highestObjectiveScore - Number(selected.rawObjectiveScore || 0);
          const maxRegret = Math.max(0, Number(actionAudit?.maxRegret || 0));
          if (objectiveRegret > maxRegret + 1e-6) {
            pushFatal('SUBJECTIVE_REGRET_EXCEEDED', {
              actionIndex,
              selectedCandidateId: selected.candidateId,
              objectiveRegret,
              maxRegret,
            });
          }
          return;
        }
        const highestScore = Math.max(...candidates.map(candidate => Number(candidate?.finalScore || 0)));
        if (Number(selected.finalScore || 0) < highestScore) {
          pushFatal('SCORING_SELECTED_NOT_HIGHEST', {
            actionIndex,
            selectedCandidateId: selected.candidateId,
            selectedScore: Number(selected.finalScore || 0),
            highestScore,
          });
        }
      }
    });

    const activeStarts = eventLedger.filter(event =>
      String(event?.eventKind || '').trim() === 'action_start' &&
      normalizeActionRole(event?.actionRole || 'ACTIVE') === 'ACTIVE'
    );
    const terminalKinds = new Set(['hit_result', 'state_apply', 'resource_change', 'create', 'summon_create', 'shield_create', 'support', 'defend', 'dodge', 'pass', 'blocked_action', 'failed_action', 'target_fail']);
    activeStarts.forEach(start => {
      const terminal = eventLedger.find(event =>
        event !== start &&
        terminalKinds.has(String(event?.eventKind || '').trim()) &&
        String(event?.sourceActionId || event?.actionId || '').trim() === String(start?.actionId || '').trim()
      );
      if (!terminal) {
        pushFatal('ACTIVE_ACTION_TERMINAL_MISSING', {
          round: Number(start?.round || 0),
          actorName: start?.actorName || '',
          actionName: start?.actionName || '',
          actionId: start?.actionId || '',
        });
      }
    });

    scoringAudit.forEach((actionAudit, actionIndex) => {
      const selectedActionName = normalizeActionDisplayName(actionAudit?.selectedActionName || '');
      const selectedCandidate = (Array.isArray(actionAudit?.candidates) ? actionAudit.candidates : []).find(candidate =>
        ['EXECUTED', 'LOCKED', 'SELECTED'].includes(String(candidate?.candidateStatus || '').trim().toUpperCase()) ||
        String(candidate?.candidateId || '') === String(actionAudit?.selectedCandidateId || '')
      );
      if (
        !selectedActionName ||
        normalizeActionRole(selectedCandidate?.actionRole || 'ACTIVE') !== 'ACTIVE' ||
        String(actionAudit?.ruleCode || '').trim() === 'DECISION_INTERFERENCE'
      ) return;
      const matchingStart = activeStarts.find(start =>
        Number(start?.round || 0) === Number(actionAudit?.round || 0) &&
        isSameReportName(start?.actorName || '', actionAudit?.actor || '')
      );
      if (!matchingStart) {
        pushFatal('SCORING_EXECUTION_ACTION_MISSING', { actionIndex, round: actionAudit?.round || 0, actor: actionAudit?.actor || '', selectedActionName });
        return;
      }
      const executedName = normalizeActionDisplayName(matchingStart?.finalActionName || matchingStart?.actionName || '');
      if (executedName && executedName !== selectedActionName) {
        pushFatal('SCORING_EXECUTION_MISMATCH', {
          actionIndex,
          round: actionAudit?.round || 0,
          actor: actionAudit?.actor || '',
          selectedActionName,
          executedName,
        });
      }
    });
    if (payload.scoringMutationDetected === true) pushFatal('SCORING_PREVIEW_MUTATED_STATE');

    return {
      fatalCount: fatals.length,
      warningCount: warnings.length,
      fatals,
      warnings,
    };
  }

  function bindEngine(implementation) {
    if (
      !implementation ||
      !implementation.caseDomain ||
      typeof implementation.caseDomain.ensureRuntime !== 'function' ||
      typeof implementation.caseDomain.getSnapshot !== 'function' ||
      typeof implementation.caseDomain.getScoringMutationCount !== 'function' ||
      typeof implementation.caseDomain.executeTeam !== 'function' ||
      typeof implementation.caseDomain.executeDuel !== 'function' ||
      typeof implementation.caseDomain.buildPublicReportBlocks !== 'function' ||
      typeof implementation.caseDomain.normalizePublicEntry !== 'function' ||
      typeof implementation.caseDomain.resolveNextIntents !== 'function' ||
      typeof implementation.caseDomain.resolveReportUnitSide !== 'function' ||
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
    const domain = requireEngine().caseDomain;
    const input = options && typeof options === 'object' ? options : {};
    const caseId = String(input.caseId || 'ad_hoc').trim() || 'ad_hoc';
    const seed = Math.max(1, Math.floor(Number(input.seed || 1)));
    const rounds = Math.max(1, Math.min(20, Math.floor(Number(input.rounds || input.settings?.maxRounds || 1))));
    const mode = String(input.mode || 'single_preview').trim();
    const sourceCombatData = input.combatData && typeof input.combatData === 'object' ? input.combatData : {};
    const sourceSnapshot = JSON.stringify(sourceCombatData);
    const combatData = cloneValue(sourceCombatData);
    const debugRuntime = domain.ensureRuntime(combatData);
    debugRuntime.decisionSeed = seed;
    const initialSnapshot = domain.getSnapshot(combatData);
    const scoringMutationCountBefore = Number(domain.getScoringMutationCount() || 0);
    const originalRandom = Math.random;
    let randomState = seed % 2147483647;
    if (randomState <= 0) randomState += 2147483646;
    Math.random = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };
    try {
      const isTeam = /team|团战/i.test(mode) || (combatData?.参战者?.team_player?.length || 0) > 1 || (combatData?.参战者?.team_enemy?.length || 0) > 1;
      let result;
      if (isTeam) {
        const simulation = domain.executeTeam(combatData, rounds);
        const eventLedger = Array.isArray(combatData.__battleEventLedger) ? combatData.__battleEventLedger : [];
          const publicReportBlocks = domain.buildPublicReportBlocks(eventLedger, Math.max(8, rounds * 6), { combatData });
        result = {
          preview: /preview/i.test(mode),
          battleMode: rounds > 1 ? 'multi_round' : 'single_round',
          roundsExecuted: Number(simulation?.rounds || 0),
          logs: Array.isArray(simulation?.logs) ? simulation.logs : [],
          combatData,
            eventLedger: eventLedger.map(item => cloneAuditSnapshot(item)),
            resolutionTrace: collectResolutionTrace(combatData),
            decisionTrace: collectDecisionTrace(combatData),
            publicReportBlocks: publicReportBlocks.map(item => cloneAuditSnapshot(item)),
          snapshot: domain.getSnapshot(combatData),
        };
      } else {
        const selectedAction = input.selectedAction;
        const actionText = typeof selectedAction === 'string'
          ? selectedAction
          : String(selectedAction?.label || selectedAction?.skill?.name || selectedAction?.skill?.魂技名 || selectedAction?.action_type || '普通攻击').trim();
        const actionDeclaration = selectedAction && typeof selectedAction === 'object'
          ? {
              actorName: String(selectedAction.actor_name || combatData?.参战者?.team_player?.[0]?.name || '').trim(),
              actions: [cloneValue(selectedAction)],
              primaryTargetName: String(selectedAction.target_name || '').trim(),
            }
          : null;
        result = domain.executeDuel(actionText, {
          dryRun: true,
          mode: rounds > 1 ? 'multi_round' : 'single_round',
          combatData,
          actionDeclaration,
          intentMode: input.settings?.intentMode || combatData?.战斗意图 || '点到为止',
          autoContinueConfig: {
            ...(input.settings || {}),
            maxRounds: rounds,
            continueChancePercent: input.settings?.continueChancePercent ?? 100,
            stopDamagePercent: input.settings?.stopDamagePercent ?? 100,
          },
        });
      }
      const eventLedger = Array.isArray(result?.eventLedger) ? result.eventLedger : [];
      const resolutionTrace = Array.isArray(result?.resolutionTrace) ? result.resolutionTrace.map(normalizeCausalNode) : [];
      const decisionTrace = Array.isArray(result?.decisionTrace) ? result.decisionTrace.map(item => cloneAuditSnapshot(item)) : [];
      const publicReportBlocks = Array.isArray(result?.publicReportBlocks) ? result.publicReportBlocks : [];
      const runtimeCombatData = result?.combatData || combatData;
      const finalSnapshot = result?.snapshot || domain.getSnapshot(runtimeCombatData);
        const actionQueueTrace = Array.isArray(runtimeCombatData?.__battleRuntime?.actionQueueTrace)
          ? runtimeCombatData.__battleRuntime.actionQueueTrace.map(item => cloneAuditSnapshot(item))
        : [];
      const actionChains = buildActionChains(eventLedger, resolutionTrace);
      const reportBlocks = buildReportBlocks(eventLedger, decisionTrace, publicReportBlocks);
      const { finalBattleReport, aiSummaryInput } = buildFinalSummary(eventLedger, decisionTrace, finalSnapshot, runtimeCombatData);
      const scoringAudit = decisionTrace
        .filter(item => /主动规划|应招审计|技能选择/.test(String(item?.类型 || item?.type || '')))
        .map(item => ({
          round: Number(item?.回合 || item?.round || 0),
          actor: String(item?.行动者 || item?.actor || '').trim(),
          selectedCandidateId: String(item?.scoringSummary?.candidateId || '').trim(),
          selectedActionName: normalizeActionDisplayName(item?.finalResolvedActionName || item?.技能 || item?.hitCandidateName || ''),
          decisionConfidence: Number(item?.decisionConfidence ?? item?.scoringSummary?.decisionConfidence ?? 1),
          temperature: Number(item?.temperature ?? item?.scoringSummary?.temperature ?? 4),
          maxRegret: Number(item?.maxRegret ?? item?.scoringSummary?.maxRegret ?? 0),
          selectedReason: String(item?.选择原因 || item?.scoringSummary?.selectedReason || '').trim(),
          ruleCode: String(item?.ruleCode || '').trim(),
          originalBestCandidateId: String(item?.originalBestCandidateId || '').trim(),
          candidates: (Array.isArray(item?.候选排序结果) ? item.候选排序结果 : []).slice(0, 3).map(candidate => {
            const audit = candidate?.审计 && typeof candidate.审计 === 'object' ? candidate.审计 : {};
            const scoreParts = candidate?.scoreParts && typeof candidate.scoreParts === 'object'
              ? candidate.scoreParts
              : audit?.scoreParts && typeof audit.scoreParts === 'object'
                ? audit.scoreParts
                : {
                    effectiveDeltaEV: Number(candidate?.effectEV || 0),
                    futureUnlockEV: Number(candidate?.comboEV || 0),
                    enemyDeniedEV: Number(candidate?.timingEV || 0),
                    teamIntentEV: Number(candidate?.targetEV || 0),
                    sustainEV: Number(candidate?.roleEV || 0),
                    resourceCostEV: Number(candidate?.resourceCostEV || 0),
                    failureRiskEV: Number(candidate?.riskEV || 0),
                    exposureRiskEV: 0,
                    chainConflictEV: 0,
                  };
            const tags = [...new Set([
              ...(Array.isArray(candidate?.tags) ? candidate.tags : []),
              ...(Array.isArray(candidate?.effectTags) ? candidate.effectTags : []),
              ...(Array.isArray(audit?.tags) ? audit.tags : []),
            ])];
            const candidateName = normalizeActionDisplayName(candidate?.candidateName || candidate?.名称 || candidate?.技能 || '');
            const rawObjectiveScore = Number(candidate?.rawObjectiveScore ?? audit?.rawObjectiveScore ?? candidate?.score ?? candidate?.权重 ?? 0);
            return {
              candidateId: String(candidate?.candidateId || '').trim(),
              actionKind: String(candidate?.actionKind || audit?.actionKind || (candidate?.技能 ? 'RELEASE_SKILL' : 'BASIC_ATTACK')).trim(),
              candidateName,
              actionRole: normalizeActionRole(candidate?.actionRole || audit?.actionRole || item?.scoringSummary?.actionRole || 'ACTIVE'),
              actorId: String(candidate?.actorId || audit?.actorId || item?.行动者 || item?.actor || '').trim(),
              targetIds: Array.isArray(candidate?.targetIds) ? candidate.targetIds : (candidate?.目标 ? [String(candidate.目标).trim()].filter(Boolean) : []),
              rawObjectiveScore,
              subjectiveScore: Number(candidate?.subjectiveScore ?? audit?.subjectiveScore ?? rawObjectiveScore),
              scoreParts,
              factorKeys: Array.isArray(candidate?.factorKeys) ? [...candidate.factorKeys] : (Array.isArray(audit?.factorKeys) ? [...audit.factorKeys] : []),
              scoreContributions: Array.isArray(candidate?.scoreContributions) ? candidate.scoreContributions.map(item => ({ ...item })) : (Array.isArray(audit?.scoreContributions) ? audit.scoreContributions.map(item => ({ ...item })) : []),
              tags,
              alternativeGap: Number(candidate?.alternativeGap ?? audit?.alternativeGap ?? 0),
              selectedReason: String(candidate?.selectedReason || audit?.selectedReason || '').trim(),
              effectEV: Number(scoreParts.effectiveDeltaEV || 0),
              targetEV: Number(scoreParts.teamIntentEV || 0),
              timingEV: Number(scoreParts.enemyDeniedEV || 0),
              roleEV: Number(scoreParts.sustainEV || 0),
              comboEV: Number(scoreParts.futureUnlockEV || 0),
              resourceCostEV: Number(scoreParts.resourceCostEV || 0),
              riskEV: Number(scoreParts.failureRiskEV || 0) + Number(scoreParts.exposureRiskEV || 0) + Number(scoreParts.chainConflictEV || 0),
              finalScore: Number(candidate?.finalScore ?? candidate?.权重 ?? candidate?.score ?? 0),
              rejectionCode: String(candidate?.rejectionCode || '').trim(),
              candidateStatus: String(candidate?.candidateStatus || '').trim(),
            };
          }),
        }))
        .filter(item => item.candidates.length)
        .filter(item => {
          const selected = item.candidates.find(candidate =>
            ['EXECUTED', 'LOCKED', 'SELECTED'].includes(String(candidate?.candidateStatus || '').trim().toUpperCase()) ||
            String(candidate?.candidateId || '').trim() === String(item.selectedCandidateId || '').trim()
          );
          const selectedRole = normalizeActionRole(selected?.actionRole || 'ACTIVE');
          if (selectedRole !== 'ACTIVE') return true;
          const actionName = normalizeActionDisplayName(item.selectedActionName || selected?.candidateName || '');
          return eventLedger.some(event =>
            String(event?.eventKind || '').trim() === 'action_start' &&
            normalizeActionRole(event?.actionRole || 'ACTIVE') === 'ACTIVE' &&
            Number(event?.round || 0) === Number(item.round || 0) &&
            isSameReportName(event?.actorName || '', item.actor || '') &&
            (!actionName || normalizeActionDisplayName(event?.finalActionName || event?.actionName || '') === actionName)
          );
        })
        .slice(-Math.max(3, rounds * 6));
      const scoringMutationDetected = Number(domain.getScoringMutationCount() || 0) > scoringMutationCountBefore;
      const audit = auditFacts({
        eventLedger,
        resolutionTrace,
        publicReportBlocks,
        scoringAudit,
        scoringMutationDetected,
        combatData: runtimeCombatData,
        initialSnapshot,
        finalSnapshot,
        actionQueueTrace,
        roundsRequested: rounds,
        roundsExecuted: Number(result?.roundsExecuted || 0),
      });
      return {
        caseId,
        seed,
        mode,
        roundsRequested: rounds,
        roundsExecuted: Number(result?.roundsExecuted || 0),
        inputUnchanged: sourceSnapshot === JSON.stringify(sourceCombatData),
        scoringMutationDetected,
        eventLedger,
        ledger: eventLedger,
        resolutionTrace,
        trace: resolutionTrace,
        decisionTrace,
        scoringAudit,
        actionChains,
        actionQueueTrace,
        reportBlocks,
        publicReportBlocks,
        roundOverview: buildRoundOverview(result, { combatData: result?.combatData || combatData }),
        finalBattleReport,
        aiSummaryInput,
        finalSnapshot,
        llmBattleSummary: String(result?.llmBattleSummary || buildAiNarrativeSummary(aiSummaryInput, { maxRounds: rounds }) || ''),
        logs: Array.isArray(result?.logs) ? result.logs : [],
        initialSnapshot,
        audit,
      };
    } finally {
      Math.random = originalRandom;
    }
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
    runDuelRounds,
    decideDuelContinuation,
    executeActionNodes,
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
    normalizeCausalNode,
    cloneAuditSnapshot,
    collectDecisionTrace,
    collectResolutionTrace,
    buildActionChains,
    buildReportBlocks,
    buildRoundOverview,
    buildFinalSummary,
    buildAiNarrativeSummary,
    previewSkill,
    auditPrototypeCoverage,
  });

  root.__LWCS_BATTLE_RUNTIME__ = api;
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SOURCE__ = 'shared';
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SIZE__ = prototypeManifest.length;
})();

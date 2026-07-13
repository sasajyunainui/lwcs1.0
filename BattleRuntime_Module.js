/* BattleRuntime_Module.js - Battle runtime boundary and shared contracts. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const previewRuntime = root.__LWCS_BATTLE_PREVIEW__;
  const decisionRuntime = root.__LWCS_BATTLE_DECISION__;
  if (!previewRuntime || previewRuntime.version !== '7.3-R6.3-preview-2') {
    throw new Error(`battle_runtime_preview_version_mismatch:${previewRuntime?.version || 'missing'}`);
  }
  if (!decisionRuntime || decisionRuntime.version !== '7.3-R6.3-decision-2') {
    throw new Error(`battle_runtime_decision_version_mismatch:${decisionRuntime?.version || 'missing'}`);
  }
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_runtime_shared_prototype_registry_missing');
  }
  const SOUL_TOWER_MAX_AGE = 30;
  const SOUL_TOWER_TEAM_LIMIT = 7;
  const SOUL_TOWER_MAX_AGE_GAP = 3;

  const actionKinds = Object.freeze([
    'BASIC_ATTACK', 'DEFEND', 'EVADE', 'COUNTER', 'OBSERVE',
    'GUARD', 'WITHDRAW', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP',
  ]);
  const actionRoles = Object.freeze(['ACTIVE', 'REACTION', 'COUNTER', 'ASSIST', 'STATE_TICK']);
  const reportBlockTypes = Object.freeze([
    'ACTION_DECLARED', 'ACTION_RESOLVED', 'REACTION_RESOLVED', 'STATE_TICK',
    'SUMMON_ACTION', 'RESOURCE_CHANGE', 'ROUND_SUMMARY', 'FINAL_SUMMARY',
  ]);
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
  const settlementState = { primitives: null };
  let runtimeIdSequence = 0;
  let runtimeIdContext = 'runtime';

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function nextRuntimeId(prefix = 'battle-event') {
    runtimeIdSequence = (runtimeIdSequence + 1) % 1000000;
    return `${String(prefix || 'battle-event')}-${runtimeIdContext}-${runtimeIdSequence.toString(36)}`;
  }

  function ensureCombatRuntime(combatData = {}) {
    const rootData = combatData?.__父级战斗数据 || combatData;
    if (!rootData || typeof rootData !== 'object') return {};
    if (!rootData.__battleRuntime || typeof rootData.__battleRuntime !== 'object') {
      Object.defineProperty(rootData, '__battleRuntime', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: {},
      });
    }
    const runtime = rootData.__battleRuntime;
    if (!runtime.unitReactionCount || typeof runtime.unitReactionCount !== 'object') runtime.unitReactionCount = {};
    if (!runtime.factionReactionCount || typeof runtime.factionReactionCount !== 'object') runtime.factionReactionCount = {};
    if (!runtime.counterCount || typeof runtime.counterCount !== 'object') runtime.counterCount = {};
    if (!runtime.reactionFatigue || typeof runtime.reactionFatigue !== 'object') runtime.reactionFatigue = {};
    return runtime;
  }

  function getBattleSnapshot(combatData = {}) {
    if (!combatData || typeof combatData !== 'object') return null;
    const buildUnit = unit => {
      if (!unit || typeof unit !== 'object') return null;
      const level = Math.max(1, Number(unit?.lv ?? unit?.level ?? unit?.等级 ?? unit?.属性?.等级 ?? 1));
      const states = unit?.状态效果 && typeof unit.状态效果 === 'object' ? Object.entries(unit.状态效果) : [];
      const summonRuntime = unit?.__battleRuntime || {};
      const explicitActionState = String(unit?.状态?.行动 || '').trim();
      const actionState = previewRuntime.isDead(unit)
        ? '失去战斗力'
        : /失去战斗力|昏迷|投降|制服|撤离/.test(explicitActionState)
          ? explicitActionState
          : previewRuntime.isBattleCapable(unit) ? explicitActionState : '失去战斗力';
      return {
        name: previewRuntime.unitName(unit),
        lv: level,
        lv_label: String(level),
        type: String(unit?.type || unit?.系别 || unit?.属性?.系别 || '未知系').trim() || '未知系',
        hp: previewRuntime.readHp(unit),
        hp_max: previewRuntime.readHpMax(unit),
        HP: previewRuntime.readHp(unit),
        HP上限: previewRuntime.readHpMax(unit),
        vit: previewRuntime.readResource(unit, '体力'),
        vit_max: previewRuntime.readResourceMax(unit, '体力'),
        sta: previewRuntime.readResource(unit, '体力'),
        sta_max: previewRuntime.readResourceMax(unit, '体力'),
        体力: previewRuntime.readResource(unit, '体力'),
        体力上限: previewRuntime.readResourceMax(unit, '体力'),
        sp: previewRuntime.readResource(unit, '魂力'),
        sp_max: previewRuntime.readResourceMax(unit, '魂力'),
        魂力: previewRuntime.readResource(unit, '魂力'),
        魂力上限: previewRuntime.readResourceMax(unit, '魂力'),
        men: previewRuntime.readResource(unit, '精神力'),
        men_max: previewRuntime.readResourceMax(unit, '精神力'),
        精神力: previewRuntime.readResource(unit, '精神力'),
        精神力上限: previewRuntime.readResourceMax(unit, '精神力'),
        shield: previewRuntime.readShield(unit),
        护盾: previewRuntime.readShield(unit),
        召唤键: String(unit?.召唤键 || '').trim(),
        单位性质: String(unit?.单位性质 || '').trim(),
        类型: String(unit?.类型 || unit?.type || '').trim(),
        年限: Math.max(0, Number(unit?.年限 || 0)),
        标准物种: String(unit?.标准物种 || '').trim(),
        具体物种: String(unit?.具体物种 || '').trim(),
        行动模式: String(unit?.行动模式 || '').trim(),
        宿主名: String(unit?.宿主名 || '').trim(),
        精神负载: Math.max(0, Number(unit?.精神负载 || 0)),
        剩余窗口: Math.max(0, Number(summonRuntime?.remainingWindows ?? summonRuntime?.windowCount ?? unit?.剩余窗口 ?? 0)),
        稳定状态: String(unit?.稳定状态 || summonRuntime?.stability || '').trim(),
        actionState,
        当前领域: String(unit?.当前领域 || '无').trim(),
        状态效果: states.filter(([, state]) => state?.__equipmentState !== true).map(([name, state]) => ({
          name,
          type: String(state?.类型 || 'buff').trim(),
          duration: Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 0)),
          desc: String(state?.描述 || '').trim(),
          skip_turn: state?.战斗效果?.skip_turn === true || state?.skip_turn === true,
          dot: Math.max(0, Number(state?.战斗效果?.dot_damage ?? state?.dot ?? 0)),
        })),
        sustains: Object.keys(unit?.持续效果 || {}),
        isCharging: !!unit?.蓄力技能,
        chargingCastTime: Math.max(0, Number(unit?.蓄力技能?.cast_time || 0)),
      };
    };
    const participants = combatData?.参战者 || {};
    const readTeam = key => (Array.isArray(participants?.[key]) ? participants[key] : Object.values(participants?.[key] || {})).map(buildUnit).filter(Boolean);
    const summons = Object.values(combatData?.召唤单位表 || {}).filter(unit => !/分身/.test(String(unit?.类型 || unit?.召唤单位类型 || ''))).map(buildUnit).filter(Boolean);
    return {
      round: Number(combatData?.回合 || 0),
      战斗类型: String(combatData?.战斗类型 || '突发遭遇').trim(),
      floor: Number(combatData?.floor || 0),
      大关卡: Number(combatData?.大关卡 || 0),
      大关标签: String(combatData?.大关标签 || '').trim(),
      先攻: String(combatData?.先攻 || '无').trim(),
      team_player: readTeam('team_player'),
      team_enemy: readTeam('team_enemy'),
      summons,
    };
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
        actorControl: String(node?.actorControl || 'AI').trim() || 'AI',
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
        actorControl: String(input.actorControl || input?.actorEntry?.__actorControl || 'AI').trim() || 'AI',
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
        actorControl: String(actorEntry?.__actorControl || 'AI').trim() || 'AI',
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
    let objectiveResolution = adapters.evaluateTerminal?.({ combatData, currentRound: startingRound, rounds, roundCompleted: false }) || null;
    while (rounds < roundLimit && objectiveResolution?.terminal !== true) {
      rounds += 1;
      const currentRound = startingRound + rounds;
      combatData.回合 = currentRound;
      const beginLogs = adapters.beginRound?.(combatData, currentRound);
      if (Array.isArray(beginLogs)) logs.push(...beginLogs.filter(Boolean));
      const queue = buildActionQueue(combatData);
      adapters.recordQueue?.(queue, combatData, logs);
      const queueResult = adapters.executeQueue(queue, combatData, currentRound, logs, extraPatchOps);
      if (queueResult?.fatal) {
        logs.push(`[行动队列中止] ${queueResult.fatal.code}`);
      } else {
        const terminalAlive = adapters.readAlive(combatData);
        if (terminalAlive.playerAlive > 0 && terminalAlive.enemyAlive > 0) {
          adapters.settleRoundEnd?.(combatData, logs);
        }
      }
      lastAlive = adapters.readAlive(combatData);
      logs.push(`[团战回合总结] 我方可行动单位:${lastAlive.playerAlive} 敌方可行动单位:${lastAlive.enemyAlive}`);
      if (queueResult?.fatal || lastAlive.playerAlive <= 0 || lastAlive.enemyAlive <= 0) break;
      objectiveResolution = adapters.evaluateTerminal?.({ combatData, currentRound, rounds, alive: lastAlive, roundCompleted: true }) || objectiveResolution;
      if (objectiveResolution?.terminal === true) break;
      const continuation = adapters.shouldContinue?.({ combatData, mode, currentRound, rounds, alive: lastAlive });
      if (continuation?.log) logs.push(continuation.log);
      if (continuation?.continueSimulation === false) break;
    }
    objectiveResolution = adapters.evaluateTerminal?.({
      combatData,
      currentRound: Number(combatData.回合 || startingRound),
      rounds,
      alive: lastAlive,
      roundCompleted: rounds > 0,
    }) || objectiveResolution;
    const winner = objectiveResolution?.terminal === true
      ? objectiveResolution.winner
      : lastAlive.enemyAlive <= 0 ? 'player' : lastAlive.playerAlive <= 0 ? 'enemy' : 'unfinished';
    adapters.finalize?.({ combatData, mode, winner, logs, alive: lastAlive, objectiveResolution });
    return {
      rounds,
      roundStart: startingRound + 1,
      roundEnd: Number(combatData.回合 || startingRound),
      winner,
      playerAlive: lastAlive.playerAlive,
      enemyAlive: lastAlive.enemyAlive,
      objectiveResolution,
      logs,
      extraPatchOps,
    };
  }

  function listPrimaryCombatUnits(combatData = {}) {
    const participants = combatData?.参战者 && typeof combatData.参战者 === 'object' ? combatData.参战者 : {};
    return [...(Array.isArray(participants.team_player) ? participants.team_player : []), ...(Array.isArray(participants.team_enemy) ? participants.team_enemy : [])].filter(Boolean);
  }

  function listSummonCombatUnits(combatData = {}) {
    const table = combatData?.召唤单位表 && typeof combatData.召唤单位表 === 'object' ? combatData.召唤单位表 : {};
    return Object.values(table).filter(unit => unit && unit.已消散 !== true);
  }

  function buildActionQueue(combatData = {}) {
    const fighters = [];
    const playerUnits = Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player : [];
    const enemyUnits = Array.isArray(combatData?.参战者?.team_enemy) ? combatData.参战者.team_enemy : [];
    playerUnits.filter(Boolean).forEach(unit => { if (isUnitAbleToFight(unit)) fighters.push({ char: unit, side: 'player' }); });
    enemyUnits.filter(Boolean).forEach(unit => { if (isUnitAbleToFight(unit)) fighters.push({ char: unit, side: 'enemy' }); });
    listSummonCombatUnits(combatData)
      .filter(unit => String(unit?.行动模式 || '').trim() === '自主行动' && isUnitAbleToFight(unit))
      .forEach(unit => fighters.push({ char: unit, side: normalizeBattleSide(unit?.阵营) === 'enemy' ? 'enemy' : 'player' }));
    const typePriority = { 辅助系: 1, 控制系: 2, 敏攻系: 2, 强攻系: 2, 精神系: 2, 元素系: 2, 防御系: 3, 治疗系: 3, 食物系: 3 };
    fighters.sort((left, right) => {
      const priorityDelta = Number(typePriority[String(left?.char?.type || left?.char?.系别 || '').trim()] || 4)
        - Number(typePriority[String(right?.char?.type || right?.char?.系别 || '').trim()] || 4);
      if (priorityDelta) return priorityDelta;
      return previewRuntime.readCombatStat(right.char, 'agi') - previewRuntime.readCombatStat(left.char, 'agi');
    });
    return fighters;
  }

  function createEmptyCombatEffectMap() {
    return {
      skip_turn: false, cannot_react: false, invincible: false, 无视异常: false, skill_seal: false, 探查屏蔽: false,
      dot_damage: 0, dot_damage_ratio: 0, armor_pen: 0, reaction_bonus: 0, reaction_penalty: 0,
      attacker_speed_bonus: 0, cast_speed_bonus: 0, cast_speed_penalty: 0, hit_bonus: 0, hit_penalty: 0,
      dodge_bonus: 0, dodge_penalty: 0, lock_level: 0, interrupt_bonus: 0, final_damage_mult: 1,
      received_damage_mult: 1, defense_strip: 0, spirit_resist_strip: 0, final_damage_bonus: 0,
      final_heal_mult: 1, final_heal_bonus: 0, shield_gain_mult: 1, shield_gain_bonus: 0, skill_effect_mult: 1,
      vit_gain_ratio: 0, sp_gain_ratio: 0, men_gain_ratio: 0, heal_block_ratio: 0, hot_heal_ratio: 0,
      cost_ratio: 1, cost_delta: 0, cost_delta_ratio: 0, windup_ratio: 1, windup_delta: 0,
      random_target_rate: 0, 判断干扰强度: 0, 索敌干扰强度: 0, stealth_level: 0, min_hp_floor: 0,
      death_save_count: 0, revive_count: 0, revive_heal_ratio: 0, damage_reflect_ratio: 0,
      damage_transfer_ratio: 0, damage_transfer_target: '', 吸收来源: '', 吸收资源: '', 吸收转化效果: '',
      伤害吸收增幅上限: 0, damage_share_ratio: 0, damage_share_count: 0, cost_share_ratio: 0,
      cost_share_count: 0, damage_to_heal_ratio: 0, heal_to_damage_ratio: 0, heal_inversion_ratio: 0,
      invincible_tier_threshold: 0, 每日触发次数上限: 0, bonus_true_damage_ratio: 0, element_seal_ratio: 0,
      misfortune_check_rate: 0, misfortune_backlash_ratio: 0, silence: false, disarm: false, blind: false,
      counter_attack_ratio: 0, damage_reduction: 0, block_count: 0, super_armor: false, action_lock_rounds: 0,
      interrupt_window: 0, multi_hit_count: 0, segment_damage_ratio: 0,
    };
  }

  function mergeCombatEffectMaps(base = createEmptyCombatEffectMap(), incoming = {}) {
    const seed = createEmptyCombatEffectMap();
    const result = { ...seed, ...(base || {}) };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (!(key in seed) || value === undefined) return;
      if (['skip_turn', 'cannot_react', 'silence', 'disarm', 'blind', 'super_armor', 'invincible', '无视异常', 'skill_seal', '探查屏蔽'].includes(key)) {
        result[key] = !!result[key] || !!value;
      } else if (['final_damage_mult', 'received_damage_mult', 'final_heal_mult', 'shield_gain_mult', 'skill_effect_mult', 'cost_ratio', 'windup_ratio'].includes(key)) {
        result[key] = Number(result[key] ?? 1) * Number(value ?? 1);
      } else if (['defense_strip', 'spirit_resist_strip', 'cost_delta_ratio'].includes(key)) {
        result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
      } else if (['damage_transfer_target', '吸收来源', '吸收资源', '吸收转化效果'].includes(key)) {
        result[key] = String(value || result[key] || '').trim();
      } else if (['lock_level', 'death_save_count', 'revive_count', 'block_count', 'min_hp_floor', 'damage_share_count', 'cost_share_count', 'invincible_tier_threshold', '每日触发次数上限', 'action_lock_rounds', 'multi_hit_count'].includes(key)) {
        result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
      } else {
        result[key] = Number(result[key] ?? 0) + Number(value ?? 0);
      }
    });
    return result;
  }

  function buildCombatFinalStats(unit = {}) {
    const source = unit && typeof unit === 'object' ? { ...unit } : {};
    delete source.final;
    const final = JSON.parse(JSON.stringify(source));
    final.状态效果 = JSON.parse(JSON.stringify(unit?.状态效果 || {}));
    final.战斗效果 = createEmptyCombatEffectMap();
    const currentTick = Math.max(0, Number(root.BattleUIBridge?.getMVU?.('world.时间.tick') || 0));
    const applyCopiedStats = snapshot => {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return;
      [['力量', 'str'], ['防御', 'def'], ['敏捷', 'agi'], ['体力上限', 'vit_max'], ['魂力上限', 'sp_max'], ['精神力上限', 'men_max']]
        .forEach(([sourceKey, runtimeKey]) => {
          const value = Number(snapshot[sourceKey] ?? snapshot[runtimeKey]);
          if (Number.isFinite(value) && value > 0) final[runtimeKey] = value;
        });
    };
    const copiedSnapshots = [];
    Object.values(final.状态效果 || {}).forEach(condition => {
      const ratios = condition?.面板修改比例 || {};
      const deltas = condition?.面板固定修正 || {};
      ['str', 'def', 'agi'].forEach(key => { final[key] = Number(final[key] || 0) * Number(ratios[key] ?? 1) + Number(deltas[key] || 0); });
      ['sp_max', 'vit_max', 'men_max'].forEach(key => {
        if (final[key] !== undefined) final[key] = Number(final[key] || 0) * Number(ratios[key] ?? 1) + Number(deltas[key] || 0);
      });
      final.战斗效果 = mergeCombatEffectMaps(final.战斗效果, condition?.战斗效果 || {});
      if (condition?.属性快照) copiedSnapshots.push(condition.属性快照);
    });
    copiedSnapshots.forEach(applyCopiedStats);
    Object.values(unit?.复制效果 || {}).forEach(record => {
      if (!record || typeof record !== 'object') return;
      const expiresAt = Math.max(0, Number(record.到期tick || 0));
      if (!(expiresAt > 0 && currentTick >= expiresAt)) applyCopiedStats(record.属性快照);
    });
    if (final.sp_max !== undefined && final.sp !== undefined) final.sp = Math.min(final.sp, final.sp_max);
    if (final.vit_max !== undefined && final.vit !== undefined) final.vit = Math.min(final.vit, final.vit_max);
    if (final.men_max !== undefined && final.men !== undefined) final.men = Math.min(final.men, final.men_max);
    const stats = unit?.属性 || unit || {};
    const staminaRatio = Math.max(0, Number(stats.体力 ?? stats.vit ?? 0)) / Math.max(1, Number(stats.体力上限 ?? stats.vit_max ?? 1));
    const staminaScale = staminaRatio >= 0.5 ? 1 : staminaRatio >= 0.3 ? 0.9 : staminaRatio >= 0.15 ? 0.75 : 0.5;
    if (staminaScale < 1) {
      ['str', 'def', 'agi', 'sp_max', 'vit_max', 'men_max'].forEach(key => {
        if (final[key] !== undefined) final[key] = Number(final[key] || 0) * staminaScale;
      });
      final.__体力衰减系数 = staminaScale;
    }
    ['str', 'def', 'agi', 'sp_max', 'vit_max', 'men_max'].forEach(key => {
      if (final[key] !== undefined) final[key] = Math.round(Number(final[key] || 0));
    });
    return final;
  }

  function syncSummonUnitMirror(summon = {}) {
    if (!summon?.__来源状态?.召唤物) return;
    const mirror = summon.__来源状态.召唤物;
    mirror.召唤键 = summon.召唤键;
    mirror.召唤单位类型 = summon.类型;
    mirror.召唤物名称 = summon.name || summon.名称 || '召唤物';
    mirror.行动模式 = summon.行动模式;
    mirror.生命 = previewRuntime.readHp(summon);
    mirror.生命上限 = previewRuntime.readHpMax(summon);
    mirror.精神负载 = Math.max(0, Number(summon.精神负载 || 0));
    mirror.生成回合 = Math.max(0, Number(summon.生成回合 || 0));
    mirror.已消散 = summon.已消散 === true;
  }

  function writeCombatResource(unit = {}, resourceKey = 'sp', value = 0) {
    if (!unit || typeof unit !== 'object') return 0;
    const stats = unit.属性 && typeof unit.属性 === 'object' ? unit.属性 : unit;
    const config = {
      hp: { runtimeKeys: ['hp', 'HP'], valueKeys: ['hp', 'HP'], maxKeys: ['hp_max', 'HP上限'], statKey: 'HP', statMaxKey: 'HP上限' },
      vit: { runtimeKeys: ['sta', 'vit', '体力'], valueKeys: ['体力', 'sta', 'vit'], maxKeys: ['体力上限', 'sta_max', 'vit_max'], statKey: '体力', statMaxKey: '体力上限' },
      sp: { runtimeKeys: ['sp', '魂力'], valueKeys: ['sp', '魂力'], maxKeys: ['sp_max', '魂力上限'], statKey: '魂力', statMaxKey: '魂力上限' },
      men: { runtimeKeys: ['men', '精神力'], valueKeys: ['men', '精神力'], maxKeys: ['men_max', '精神力上限'], statKey: '精神力', statMaxKey: '精神力上限' },
    }[resourceKey] || null;
    if (!config) return 0;
    const maxValue = Math.max(1, Number(config.maxKeys.map(key => unit[key] ?? stats?.[key]).find(entry => entry !== undefined) ?? 1));
    const nextValue = Math.max(0, Math.min(maxValue, Number(value || 0)));
    if (resourceKey === 'hp') {
      if (Object.prototype.hasOwnProperty.call(unit, 'hp')) unit.hp = nextValue;
      else unit.HP = nextValue;
    } else if (resourceKey === 'vit') {
      if (Object.prototype.hasOwnProperty.call(unit, 'sta')) unit.sta = nextValue;
      else unit.体力 = nextValue;
    } else {
      unit[resourceKey] = nextValue;
    }
    if (stats && typeof stats === 'object') stats[config.statKey] = nextValue;
    if (resourceKey !== 'hp' && resourceKey !== 'vit') unit[config.statKey] = nextValue;
    if (unit.召唤键) syncSummonUnitMirror(unit);
    return nextValue;
  }

  function ensureActionDiagnostic(combatData = {}) {
    if (!combatData || typeof combatData !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(combatData, '__行动闭环诊断')) {
      Object.defineProperty(combatData, '__行动闭环诊断', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: {
          主动规划次数: 0, 索敌规划次数: 0, 辅助目标规划次数: 0,
          应招审计次数: 0, 再判定审计次数: 0, 换招审计次数: 0,
          目标闭环缺失: 0, 团队意图未消费: 0, 规划旁路残留: 0,
          审计轨迹: [], 真实样本轨迹: [], 事实账本: null,
        },
      });
    }
    const diagnostic = combatData.__行动闭环诊断;
    diagnostic.审计轨迹 ||= [];
    diagnostic.真实样本轨迹 ||= [];
    diagnostic.状态来源登记 ||= [];
    diagnostic.目标权重探针 ||= [];
    return diagnostic;
  }

  function registerStateSource(combatData = {}, payload = {}) {
    const diagnostic = ensureActionDiagnostic(combatData?.__父级战斗数据 || combatData);
    if (!diagnostic) return '';
    const entry = {
      applicationId: String(payload.applicationId || nextRuntimeId('state-src')).trim(),
      stateName: String(payload.stateName || '').trim(),
      targetName: String(payload.targetName || '').trim(),
      sourceActorName: String(payload.sourceActorName || '').trim(),
      sourceActionName: String(payload.sourceActionName || '').trim(),
      sourceActionType: String(payload.sourceActionType || '').trim(),
      sourceRound: Number(payload.sourceRound || combatData?.回合 || 0),
      duration: Math.max(0, Number(payload.duration || 0)),
      effectSummary: String(payload.effectSummary || '').trim(),
      driverAttr: String(payload.driverAttr || '').trim(),
      round: Number(payload.round || combatData?.回合 || 0),
      eventKind: 'state_apply',
    };
    if (!entry.stateName || !entry.targetName) return '';
    diagnostic.状态来源登记.push(entry);
    if (diagnostic.状态来源登记.length > 400) diagnostic.状态来源登记.splice(0, diagnostic.状态来源登记.length - 400);
    return entry.applicationId;
  }

  function findStateSource(combatData = {}, criteria = {}) {
    const diagnostic = ensureActionDiagnostic(combatData?.__父级战斗数据 || combatData);
    if (!diagnostic) return null;
    const applicationId = String(criteria.applicationId || '').trim();
    const stateName = String(criteria.stateName || '').trim();
    const targetName = String(criteria.targetName || '').trim();
    const maxRound = Number(criteria.maxRound || combatData?.回合 || 0);
    const entries = Array.isArray(diagnostic.状态来源登记) ? diagnostic.状态来源登记 : [];
    if (applicationId) return [...entries].reverse().find(item => String(item?.applicationId || '').trim() === applicationId) || null;
    return [...entries].reverse().find(item => {
      if (stateName && String(item?.stateName || '').trim() !== stateName) return false;
      if (targetName && !isSameReportName(item?.targetName || '', targetName)) return false;
      return Number(item?.sourceRound || item?.round || 0) <= maxRound;
    }) || null;
  }

  function listCombatUnits(combatData = {}) {
    const seen = new Set();
    return [...listPrimaryCombatUnits(combatData), ...listSummonCombatUnits(combatData)].filter(unit => {
      const key = previewRuntime.unitId(unit) || previewRuntime.unitName(unit);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isUnitIdentityMatch(unit, rawIdentity = '') {
    if (unit && rawIdentity && unit === rawIdentity) return true;
    const wanted = rawIdentity && typeof rawIdentity === 'object'
      ? String(rawIdentity.id || rawIdentity.角色ID || rawIdentity.name || rawIdentity.名称 || rawIdentity.charKey || rawIdentity.char_key || rawIdentity.key || '').trim()
      : String(rawIdentity || '').trim();
    if (!unit || !wanted) return false;
    return [unit.id, unit.角色ID, unit.uid, unit.name, unit.名称, unit.charKey, unit.char_key, unit.key]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .includes(wanted);
  }

  function inferUnitSide(combatData = {}, rawIdentity = '', fallback = '') {
    const normalizedFallback = normalizeBattleSide(fallback);
    const player = Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player : [];
    const enemy = Array.isArray(combatData?.参战者?.team_enemy) ? combatData.参战者.team_enemy : [];
    if (player.some(unit => isUnitIdentityMatch(unit, rawIdentity))) return 'player';
    if (enemy.some(unit => isUnitIdentityMatch(unit, rawIdentity))) return 'enemy';
    const summon = listSummonCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, rawIdentity));
    if (/^(player|玩家|我方)$/i.test(String(summon?.阵营 || ''))) return 'player';
    if (/^(enemy|敌方|对方)$/i.test(String(summon?.阵营 || ''))) return 'enemy';
    return normalizedFallback;
  }

  function inferEventSides(combatData = {}, event = {}) {
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const actorName = String(event?.actorName || '').trim();
    const targetName = String(event?.targetName || '').trim();
    const targetScope = String(event?.targetScope || meta.targetScope || '').trim();
    const actorSide = normalizeBattleSide(event?.actorSide || event?.side || meta.actorSide || meta.side || '')
      || inferUnitSide(combatData, actorName);
    const targetPoolSide = String(event?.targetPoolSide || meta.targetPoolSide || '').trim();
    const relativeTargetSide = actorSide && /^(hostile|enemy|敌对|敌方)$/i.test(targetPoolSide)
      ? actorSide === 'player' ? 'enemy' : 'player'
      : actorSide && /^(allied|ally|self|友方|己方)$/i.test(targetPoolSide)
        ? actorSide
        : '';
    const targetSide = normalizeBattleSide(event?.targetSide || meta.targetSide || '')
      || inferUnitSide(combatData, targetName)
      || relativeTargetSide
      || (['ally_group', 'self'].includes(targetScope) ? actorSide : '')
      || (['enemy_group', 'area'].includes(targetScope) && actorSide ? actorSide === 'player' ? 'enemy' : 'player' : '')
      || (targetName && actorName && isSameReportName(targetName, actorName) ? actorSide : '');
    return { actorSide, targetSide };
  }

  function isUnitAbleToFight(unit = {}) {
    return previewRuntime.isBattleCapable(unit);
  }

  function buildDeclarationAction(declaration = {}, actor = {}, combatData = {}) {
    const actionKind = String(declaration?.actionKind || '').trim();
    const targetId = String(declaration?.targetIds?.[0] || '').trim();
    const target = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetId));
    const targetName = target ? previewRuntime.unitName(target) : '';
    if (actionKind === 'RELEASE_SKILL') {
      const skill = cloneValue(declaration.skill || {});
      skill.name = String(skill.name || skill.魂技名 || skill.技能名称 || skill.名称 || '魂技').trim();
      return { id: declaration.actionId, type: 'skill', action_type: '释放魂技', name: skill.name || skill.魂技名 || '魂技', skill, target_name: targetName, cast_time: Number(skill?.前摇 ?? skill?.cast_time ?? 10) || 10 };
    }
    if (actionKind === 'USE_ITEM') {
      const item = cloneValue(declaration.skill || {});
      const itemName = String(item?.name || item?.名称 || item?.物品名 || '').trim();
      return { id: declaration.actionId, type: 'item', action_type: '使用物品', name: itemName, skill: { ...item, __物品名: itemName }, 物品名: itemName, target_name: targetName, cast_time: 10 };
    }
    if (actionKind === 'EQUIP') {
      const equipment = cloneValue(declaration.skill || {});
      return { id: declaration.actionId, type: 'equipment', action_type: '穿戴装备', name: equipment.name || equipment.名称 || '装备', skill: equipment, target_name: targetName || actor.name || actor.名称 || '', cast_time: 10, __equipmentSignature: String(declaration?.equipmentSignature || '').trim() };
    }
    const actionType = {
      BASIC_ATTACK: '常规攻击', DEFEND: '防御', EVADE: '闪避', COUNTER: '反击',
      OBSERVE: '观察', GUARD: '保护队友', WITHDRAW: '撤退',
    }[actionKind] || '防御';
    const actionName = actionKind === 'BASIC_ATTACK' ? '普通攻击' : actionType;
    const skill = { name: actionName, 目标: actionKind === 'GUARD' ? '友方单体' : actionKind === 'BASIC_ATTACK' ? '单体' : '自身', 消耗: '无', 前摇: 10 };
    if (actionKind === 'BASIC_ATTACK') skill._效果数组 = [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 防御穿透: 0, 生效方式: '独立生效' }];
    return {
      id: declaration.actionId,
      type: 'tactical',
      action_type: actionType,
      name: actionName,
      target_name: targetName,
      cast_time: 10,
      cost_text: '无',
      skill,
      __基础防守姿态: actionKind === 'EVADE' ? 'EVADE' : actionKind === 'DEFEND' ? 'DEFEND' : '',
    };
  }

  function inferActionTargetScope(action = null, targetName = '') {
    const rawTarget = String(action?.skill?.目标 || action?.skill?.target || '').trim();
    if (/全场/.test(rawTarget)) return 'all_units';
    if (/友方.*群体|己方.*群体/.test(rawTarget)) return 'ally_group';
    if (/敌方.*群体|群体|范围/.test(rawTarget)) return 'enemy_group';
    if (/自身/.test(rawTarget)) return 'self';
    return targetName ? 'single' : 'self';
  }

  function writeInitialIntent(combatData = {}, entry = {}, target = null, action = null, timingBucket = '') {
    const actor = entry?.char || null;
    const actorName = String(actor?.name || actor?.名称 || '').trim();
    const actionName = normalizeActionDisplayName(action?.skill?.name || action?.skill?.魂技名 || action?.action_type || action?.type || '行动');
    if (!actorName || !actionName) return null;
    const trace = ensureTrace(combatData);
    const round = Number(combatData?.回合 || 0);
    const targetName = String(target?.name || target?.名称 || action?.target_name || '').trim();
    const actorSide = normalizeBattleSide(entry?.side) || inferUnitSide(combatData, actorName);
    const targetSide = targetName ? inferUnitSide(combatData, targetName, actorSide) : actorSide;
    const existing = trace.find(node =>
      String(node?.nodeKind || '').trim() === 'initial_intent' &&
      Number(node?.round || 0) === round &&
      String(node?.actorName || '').trim() === actorName &&
      normalizeActionDisplayName(node?.initialActionName || '') === actionName &&
      String(node?.targetName || '').trim() === targetName
    );
    if (existing) return existing;
    const node = {
      nodeId: String(nextRuntimeId('battle-trace-initial-intent')).trim(),
      parentNodeId: '',
      round,
      phase: 'action_planning',
      nodeKind: 'initial_intent',
      nodeLayer: 'intent',
      actorName,
      actorSide,
      targetName,
      targetSide,
      targetId: String(target?.id || target?.key || '').trim(),
      targetScope: inferActionTargetScope(action, targetName),
      initialActionName: actionName,
      finalActionName: '',
      discardedActionName: '',
      source: 'action_queue',
      result: 'planned',
      primaryOutcome: 'action_planned',
      failureReason: '',
      reasonCode: 'ACTION_COMMITTED',
      reasonText: '行动轴初始意图声明',
      replanReasonCode: '',
      replanReasonText: '',
      ledgerEventIds: [],
      calculationTrace: [
        { key: 'actorSide', label: '阵营', value: String(entry?.side || '').trim() },
        { key: 'targetName', label: '目标', value: targetName },
        { key: 'plannedAction', label: '初始意图', value: actionName },
        { key: 'castTime', label: '前摇', value: Math.max(0, Number(action?.cast_time ?? action?.skill?.前摇 ?? 0)) },
        { key: 'timingBucket', label: '行动窗口', value: String(timingBucket || '').trim() },
      ].filter(item => String(item.value ?? '').trim()),
      counterDepth: 0,
      counterRootNodeId: '',
    };
    trace.push(node);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function createCounterAction(counterActor = {}, candidate = {}) {
    const counterType = candidate.以命换伤 === true ? '以命换伤' : String(candidate.防反类型 || '行为防反').trim();
    const commitment = Number(candidate.出手承诺 || 0);
    const triggerProbability = Number(candidate.触发概率 || 0);
    const counterDepth = Math.max(1, Math.min(2, Math.floor(Number(candidate.counterDepth || candidate.__counterDepth || 1))));
    const archetype = String(counterActor?.type || counterActor?.系别 || '').trim();
    const fallbackName = counterType === '完美闪避' ? '闪避反击' : counterType === '硬抗换伤' ? '防守反击' : counterType === '以命换伤' ? '绝地反扑' : '借势反打';
    const actionName = String(candidate.sourceActionName || '').trim() || fallbackName;
    const sourceSkill = candidate.sourceSkill && typeof candidate.sourceSkill === 'object' ? cloneValue(candidate.sourceSkill) : null;
    if (sourceSkill) {
      sourceSkill.name = String(sourceSkill.name || sourceSkill.魂技名 || actionName).trim() || actionName;
      sourceSkill.魂技名 = String(sourceSkill.魂技名 || sourceSkill.name || actionName).trim() || actionName;
      sourceSkill.消耗 = '无';
      sourceSkill.前摇 = 0;
      delete sourceSkill.cast_time;
      return {
        action_type: '行为防反', type: '行为防反', cast_time: 0,
        __行为防反: true, __counterDepth: counterDepth, counterDepth,
        sourceActionName: sourceSkill.name,
        sourceActionType: String(candidate.sourceActionType || 'skill_counter').trim(),
        skill: sourceSkill,
      };
    }
    const basePower = counterType === '完美闪避' ? 55 : counterType === '以命换伤' ? 92 : 70;
    const archetypeScale = counterType === '完美闪避'
      ? archetype === '敏攻系' ? 1.18 : archetype === '精神系' ? 1.08 : 1
      : archetype === '防御系' ? 1.2 : archetype === '强攻系' ? 1.15 : 1;
    const power = Math.max(35, Math.floor(basePower * archetypeScale * (1 + commitment * 0.65 + Math.max(0, triggerProbability - 0.25))));
    const damageType = archetype === '精神系' ? '精神攻击' : archetype === '元素系' ? '远程攻击' : '近身攻击';
    return {
      action_type: '行为防反', type: '行为防反', cast_time: 0,
      __行为防反: true, __counterDepth: counterDepth, counterDepth,
      sourceActionName: actionName,
      sourceActionType: String(candidate.sourceActionType || 'counter').trim(),
      skill: {
        name: actionName,
        魂技名: actionName,
        技能分类: '输出',
        消耗: '无',
        前摇: 0,
        _效果数组: [{ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: power, 伤害类型: damageType, 防御穿透: 0 }],
      },
    };
  }

  function fillObjectiveDamageBaselines(combatData = {}) {
    const objectives = combatData?.胜负条件;
    if (!objectives || typeof objectives !== 'object') return;
    const entries = [
      ...(Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player : []).filter(Boolean).map(unit => ({ unit, side: 'PLAYER' })),
      ...(Array.isArray(combatData?.参战者?.team_enemy) ? combatData.参战者.team_enemy : []).filter(Boolean).map(unit => ({ unit, side: 'ENEMY' })),
    ];
    ['victory', 'defeat'].forEach(groupKey => {
      const conditions = objectives?.[groupKey]?.conditions;
      if (!Array.isArray(conditions)) return;
      conditions.forEach(condition => {
        if (String(condition?.type || '').trim() !== 'UNIT_DAMAGED') return;
        if (!condition.baselineHp || typeof condition.baselineHp !== 'object') condition.baselineHp = {};
        const targetIds = new Set((Array.isArray(condition.targetIds) ? condition.targetIds : []).map(String));
        entries.filter(entry => !condition.side || entry.side === condition.side).forEach(({ unit }) => {
          const id = previewRuntime.unitId(unit);
          const name = previewRuntime.unitName(unit);
          if (targetIds.size && !targetIds.has(id) && !targetIds.has(name)) return;
          if (!Object.prototype.hasOwnProperty.call(condition.baselineHp, id)) condition.baselineHp[id] = previewRuntime.readHp(unit);
          if (name && !Object.prototype.hasOwnProperty.call(condition.baselineHp, name)) condition.baselineHp[name] = previewRuntime.readHp(unit);
        });
      });
    });
  }

  function isSameLedgerName(left = '', right = '') {
    const normalize = value => String(value || '')
      .replace(/[【】\[\]\s]/g, '')
      .replace(/^(我方|敌方|玩家|NPC|同窗|目标)/, '')
      .trim();
    const leftName = normalize(left);
    const rightName = normalize(right);
    return !!leftName && !!rightName && leftName === rightName;
  }

  function readLedgerStateName(event = {}) {
    return String(event?.stateName || event?.meta?.stateName || '').trim();
  }

  function readLedgerNumber(event = {}, key = '') {
    if (['damage', 'finalDamage', 'appliedDamage'].includes(String(key || '').trim())) {
      const value = Number(event?.appliedDamage ?? event?.meta?.appliedDamage ?? event?.[key] ?? event?.meta?.[key] ?? 0);
      return Number.isFinite(value) ? value : 0;
    }
    const value = Number(event?.[key] ?? event?.meta?.[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function ledgerStateImmune(event = {}) {
    return /immune|immunity|免疫|无视异常/.test(String(event?.result || event?.meta?.result || '').trim());
  }

  function ledgerStateResisted(event = {}) {
    return /resist|resisted|抵抗|豁免|未附着/.test(String(event?.result || event?.meta?.result || '').trim());
  }

  function readLedgerOutcome(event = {}) {
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
      if (ledgerStateImmune(event)) return 'state_immune';
      if (ledgerStateResisted(event)) return 'state_resisted';
      return 'state_applied';
    }
    if (kind === 'state_tick') return 'state_tick';
    if (kind === 'summon_assist') return 'summon_action';
    if (kind === 'create') return 'item_created';
    if (kind === 'summon_create') return 'summon_created';
    if (kind === 'resource_change' || kind === 'round_recover') return 'resource_recovered';
    if (kind === 'blocked_action') return 'interrupted';
    if (kind === 'failed_action' || kind === 'target_fail') {
      return /CAP_REACHED|达到上限|造物已达上限|场面已满/.test(
        String(event?.reasonCode || '') + ' ' + String(event?.failReason || ''),
      ) ? 'cap_reached' : 'interrupted';
    }
    return 'no_effect';
  }

  function readTraceValue(traceRows = [], key = '') {
    const row = (Array.isArray(traceRows) ? traceRows : []).find(item => String(item?.key || '').trim() === String(key || '').trim());
    return row?.value;
  }

  function 推断战斗因果节点配置(event = {}) {
    const kind = String(event?.eventKind || '').trim();
    const result = String(event?.result || '').trim();
    if (kind === 'action_start') return { nodeKind: 'action_decision', nodeLayer: 'intent', primaryOutcome: 'action_committed' };
    if (kind === 'reaction_window') return { nodeKind: 'reaction_window', nodeLayer: 'system_check', primaryOutcome: 'reaction_window_opened' };
    if (['dodge', 'defend', 'pass'].includes(kind)) return { nodeKind: 'reaction_decision', nodeLayer: 'system_check', primaryOutcome: kind === 'dodge' ? (/evaded|miss|dodge_success|闪避成功|未命中/.test(result) ? 'dodged' : 'reaction_failed') : (kind === 'defend' ? 'guarded' : 'reaction_failed') };
    if (kind === 'hit_result') return { nodeKind: 'damage_settlement', nodeLayer: 'settlement', primaryOutcome: readLedgerOutcome(event) };
    if (kind === 'state_apply') {
      const stateName = readLedgerStateName(event);
      const isControl = /控制|眩晕|沉默|封技|定身|束缚|禁锢|僵直|击退|减速|迟缓|位移限制|skip_turn|cannot_react|silence/i.test(stateName);
      const immune = /immune|immunity|免疫|无视异常/.test(result);
      const resisted = /resist|resisted|抵抗|豁免|未附着/.test(result);
      return {
        nodeKind: 'state_settlement',
        nodeLayer: 'settlement',
        primaryOutcome: immune ? (isControl ? 'control_immune' : 'state_immune') : (isControl ? (resisted ? 'control_resisted' : 'control_applied') : (resisted ? 'state_resisted' : 'state_applied')),
      };
    }
    if (kind === 'state_tick') return { nodeKind: 'state_settlement', nodeLayer: 'settlement', primaryOutcome: 'state_tick' };
    if (kind === 'state_replace' || kind === 'state_remove') return { nodeKind: 'state_settlement', nodeLayer: 'settlement', primaryOutcome: kind };
    if (kind === 'blocked_settlement') return { nodeKind: 'final_result', nodeLayer: 'settlement', primaryOutcome: 'interrupted' };
    if (kind === 'resource_change') return { nodeKind: 'final_result', nodeLayer: 'settlement', primaryOutcome: 'resource_recovered' };
    if (kind === 'counter_window') return { nodeKind: 'counter_window', nodeLayer: 'system_check', primaryOutcome: result === 'opened' ? 'counter_window_opened' : 'no_valid_window' };
    if (kind === 'counter') return { nodeKind: result === 'fail' ? 'counter_window' : 'counter_action', nodeLayer: result === 'fail' ? 'system_check' : 'settlement', primaryOutcome: result === 'fail' ? 'no_valid_window' : 'full_hit' };
    if (kind === 'summon_assist') return { nodeKind: 'summon_assist', nodeLayer: 'settlement', primaryOutcome: 'summon_action' };
    if (kind === 'summon_create') return { nodeKind: 'final_result', nodeLayer: 'settlement', primaryOutcome: 'summon_created' };
    if (kind === 'create' || kind === 'shield_create') return { nodeKind: 'final_result', nodeLayer: 'settlement', primaryOutcome: kind === 'create' ? 'item_created' : 'guarded' };
    if (['blocked_action', 'failed_action', 'target_fail'].includes(kind)) return { nodeKind: 'final_result', nodeLayer: 'settlement', primaryOutcome: 'interrupted' };
    return { nodeKind: kind || 'event', nodeLayer: 'settlement', primaryOutcome: String(event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim() || 'no_effect' };
  }

  function 标准化战斗ReasonCode(code = '', fallback = 'UNKNOWN_REASON') {
    const value = String(code || '').trim().toUpperCase();
    const allowed = new Set([
      'INTERRUPTED_BY_SPEED', 'TARGET_REPOSITIONED', 'RESOURCE_INSUFFICIENT', 'CONTROLLED',
      'OUT_OF_RANGE', 'TACTICAL_DISADVANTAGE', 'COUNTER_WINDOW_OPENED', 'COUNTER_WINDOW_MISSED',
      'SUMMON_CONTROL_OVERLOAD', 'NO_VALID_TARGET', 'TARGET_LOST', 'REACTION_FAILED',
      'REACTION_SUCCEEDED', 'ACTION_COMMITTED', 'NO_EFFECTIVE_OPENING', 'NO_STRUCTURED_SETTLEMENT', 'UNKNOWN_REASON',
      'DECISION_INTERFERENCE', 'LEGACY_CUSTOM_REASON',
    ]);
    return allowed.has(value) ? value : fallback;
  }

  function 推断战斗默认ReasonCode(event = {}, primaryOutcome = '') {
    const kind = String(event?.eventKind || '').trim();
    const result = String(event?.result || '').trim();
    const outcome = String(primaryOutcome || event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim();
    if (kind === 'counter_window') return result === 'opened' ? 'COUNTER_WINDOW_OPENED' : 'COUNTER_WINDOW_MISSED';
    if (kind === 'counter') return result === 'fail' ? 'COUNTER_WINDOW_MISSED' : 'COUNTER_WINDOW_OPENED';
    if (['dodge', 'defend', 'pass'].includes(kind)) {
      return /failed|fail|失败|未能/.test(result) || outcome === 'reaction_failed' ? 'REACTION_FAILED' : 'REACTION_SUCCEEDED';
    }
    if (['blocked_action', 'failed_action', 'target_fail'].includes(kind)) {
      if (/资源|魂力|精神力|体力|resource/i.test(String(event?.failReason || event?.failureReason || event?.result || ''))) return 'RESOURCE_INSUFFICIENT';
      if (/目标|target/i.test(String(event?.failReason || event?.failureReason || event?.result || ''))) return 'NO_VALID_TARGET';
      return 'ACTION_COMMITTED';
    }
    if (outcome === 'no_valid_window') return 'NO_EFFECTIVE_OPENING';
    if (outcome === 'miss' || outcome === 'dodged' || /miss|evade|dodge|未命中|闪避/.test(result)) return 'REACTION_SUCCEEDED';
    if (outcome === 'reaction_failed') return 'REACTION_FAILED';
    if (outcome === 'interrupted') return 'INTERRUPTED_BY_SPEED';
    return 'ACTION_COMMITTED';
  }

  function 事件目标分支名称(event = {}) {
    const kind = String(event?.eventKind || '').trim();
    if (['dodge', 'defend', 'pass'].includes(kind)) return String(event.actorName || '').trim();
    return String(event.targetName || '').trim();
  }

  function 需要目标分支(scope = '') {
    return ['enemy_group', 'ally_group', 'all_units', 'area'].includes(String(scope || '').trim());
  }

  function 写入战斗目标分支节点(combatData = {}, event = {}, sourceNodeId = '') {
    const trace = ensureTrace(combatData);
    const parentNodeId = String(sourceNodeId || '').trim();
    const targetName = 事件目标分支名称(event);
    const targetScope = String(event.targetScope || event.meta?.targetScope || '').trim();
    if (!trace || !parentNodeId || !targetName || !需要目标分支(targetScope)) return null;
    const branchKey = [parentNodeId, targetName].join('|');
    const existing = trace.find(node => node?.nodeKind === 'target_branch' && String(node?.parentNodeId || '').trim() === parentNodeId && String(node?.targetName || '').trim() === targetName);
    if (existing) return existing;
    const eventSides = inferEventSides(combatData, event);
    const branchActorSide = inferUnitSide(combatData, String(event.actorName || '').trim()) || eventSides.actorSide;
    const branchTargetSide = inferUnitSide(combatData, targetName) || eventSides.targetSide;
    const node = {
      nodeId: String(nextRuntimeId('battle-trace-target-branch')).trim(),
      parentNodeId,
      round: Number(event.round || event.sourceRound || 0),
      phase: 'action',
      nodeKind: 'target_branch',
      nodeLayer: 'system_check',
      actorName: String(event.actorName || '').trim(),
      actorSide: branchActorSide,
      targetName,
      targetSide: branchTargetSide,
      targetId: String(event.targetId || '').trim(),
      targetScope: 'single',
      initialActionName: normalizeActionDisplayName(event.initialActionName || event.actionName || event.sourceActionName || ''),
      finalActionName: normalizeActionDisplayName(event.finalActionName || event.actionName || event.sourceActionName || ''),
      discardedActionName: '',
      source: 'target_branch',
      result: 'branched',
      primaryOutcome: 'target_branch',
      failureReason: '',
      reasonCode: '',
      reasonText: '',
      replanReasonCode: '',
      replanReasonText: '',
      ledgerEventIds: [],
      calculationTrace: [{ key: 'targetName', label: '目标', value: targetName }, { key: 'sourceScope', label: '来源范围', value: targetScope }],
      counterDepth: 0,
      counterRootNodeId: parentNodeId,
      branchKey,
    };
    trace.push(node);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function 写入战斗反应窗口节点(combatData = {}, event = {}, parentNodeId = '') {
    const kind = String(event?.eventKind || '').trim();
    if (!['dodge', 'defend', 'pass'].includes(kind)) return null;
    const trace = ensureTrace(combatData);
    const parent = String(parentNodeId || event.parentNodeId || event.sourceNodeId || '').trim();
    const actorName = String(event.actorName || '').trim();
    if (!trace || !parent || !actorName) return null;
    const actionName = normalizeActionDisplayName(event.finalActionName || event.actionName || event.meta?.finalActionName || event.meta?.actionName || '应招');
    const existing = trace.find(node =>
      String(node?.nodeKind || '').trim() === 'reaction_window' &&
      String(node?.parentNodeId || '').trim() === parent &&
      String(node?.actorName || '').trim() === actorName &&
      normalizeActionDisplayName(node?.finalActionName || '') === actionName
    );
    if (existing) return existing;
    const { actorSide, targetSide } = inferEventSides(combatData, event);
    const node = {
      nodeId: String(nextRuntimeId('battle-trace-reaction-window')).trim(),
      parentNodeId: parent,
      round: Number(event.round || event.sourceRound || 0),
      phase: 'action',
      nodeKind: 'reaction_window',
      nodeLayer: 'system_check',
      actorName,
      actorSide,
      targetName: String(event.targetName || '').trim(),
      targetSide,
      targetId: String(event.targetId || '').trim(),
      targetIds: normalizeTargetIds(event.targetIds, event.targetId, event.targetName),
      targetScope: 'single',
      initialActionName: actionName,
      finalActionName: actionName,
      discardedActionName: '',
      source: 'reaction_window',
      result: 'opened',
      primaryOutcome: 'reaction_window_opened',
      failureReason: '',
      reasonCode: 'REACTION_SUCCEEDED',
      reasonText: '察觉到当前攻势，获得应招窗口',
      replanReasonCode: '',
      replanReasonText: '',
      ledgerEventIds: [],
      calculationTrace: [
        { key: 'reactor', label: '应招方', value: actorName },
        { key: 'sourceAction', label: '来源动作', value: normalizeActionDisplayName(event.sourceActionName || '') },
        { key: 'sourceActor', label: '攻势来源', value: String(event.targetName || '').trim() },
      ],
      counterDepth: 0,
      counterRootNodeId: parent,
    };
    trace.push(node);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function 写入战斗变招决策节点(combatData = {}, event = {}, parentNode = null) {
    if (String(event?.eventKind || '').trim() !== 'action_start') return null;
    const parentNodeId = String(parentNode?.nodeId || event.parentNodeId || event.chainNodeId || '').trim();
    if (!parentNodeId) return null;
    const trace = ensureTrace(combatData);
    const initialActionName = normalizeActionDisplayName(event.initialActionName || event.meta?.initialActionName || event.actionName || '');
    const finalActionName = normalizeActionDisplayName(event.finalActionName || event.meta?.finalActionName || event.actionName || '');
    const discardedActionName = normalizeActionDisplayName(event.discardedActionName || event.meta?.discardedActionName || (initialActionName && finalActionName && initialActionName !== finalActionName ? initialActionName : ''));
    if (!trace || !finalActionName || !discardedActionName || discardedActionName === finalActionName) return null;
    const existing = trace.find(node =>
      String(node?.nodeKind || '').trim() === 'replan_decision' &&
      String(node?.parentNodeId || '').trim() === parentNodeId &&
      normalizeActionDisplayName(node?.discardedActionName || '') === discardedActionName &&
      normalizeActionDisplayName(node?.finalActionName || '') === finalActionName
    );
    if (existing) return existing;
    const reasonCode = 标准化战斗ReasonCode(event.replanReasonCode || event.meta?.replanReasonCode || 'TACTICAL_DISADVANTAGE', 'TACTICAL_DISADVANTAGE');
    const replanReasonText = String(event.replanReasonText || event.meta?.replanReasonText || event.reasonText || event.meta?.reasonText || '').trim();
    const { actorSide, targetSide } = inferEventSides(combatData, event);
    const node = {
      nodeId: String(nextRuntimeId('battle-trace-replan-decision')).trim(),
      parentNodeId,
      round: Number(event.round || event.sourceRound || 0),
      phase: 'action',
      nodeKind: 'replan_decision',
      nodeLayer: 'intent',
      actorName: String(event.actorName || '').trim(),
      actorSide,
      targetName: String(event.targetName || '').trim(),
      targetSide,
      targetId: String(event.targetId || '').trim(),
      targetScope: String(event.targetScope || event.meta?.targetScope || '').trim() || (event.targetName ? 'single' : ''),
      initialActionName: discardedActionName,
      finalActionName,
      discardedActionName,
      source: 'replan_decision',
      result: 'replanned',
      primaryOutcome: 'action_committed',
      failureReason: '',
      reasonCode,
      reasonText: replanReasonText,
      replanReasonCode: reasonCode,
      replanReasonText,
      ledgerEventIds: [String(event.eventId || '').trim()].filter(Boolean),
      calculationTrace: [
        { key: 'discardedAction', label: '废弃动作', value: discardedActionName },
        { key: 'finalAction', label: '最终动作', value: finalActionName },
        { key: 'reasonCode', label: '变招原因', value: reasonCode },
      ],
      counterDepth: Math.max(0, Number(event.meta?.counterDepth || 0)),
      counterRootNodeId: parentNodeId,
    };
    trace.push(node);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function 写入战斗命中检定节点(combatData = {}, event = {}, parentNodeId = '') {
    if (String(event?.eventKind || '').trim() !== 'hit_result') return null;
    const parent = String(parentNodeId || event.parentNodeId || event.sourceNodeId || '').trim();
    if (!parent) return null;
    const trace = ensureTrace(combatData);
    const result = String(event.result || '').trim();
    const actorName = String(event.actorName || '').trim();
    const targetName = String(event.targetName || '').trim();
    const actionName = normalizeActionDisplayName(event.finalActionName || event.actionName || event.meta?.finalActionName || event.meta?.actionName || '');
    const existing = trace.find(node =>
      String(node?.nodeKind || '').trim() === 'hit_check' &&
      String(node?.parentNodeId || '').trim() === parent &&
      String(node?.actorName || '').trim() === actorName &&
      String(node?.targetName || '').trim() === targetName &&
      normalizeActionDisplayName(node?.finalActionName || '') === actionName
    );
    if (existing) return existing;
    const missed = /miss|evade|dodge|未命中|闪避/.test(result);
    const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
    const { actorSide, targetSide } = inferEventSides(combatData, event);
    const node = {
      nodeId: String(nextRuntimeId('battle-trace-hit-check')).trim(),
      parentNodeId: parent,
      round: Number(event.round || event.sourceRound || 0),
      phase: 'action',
      nodeKind: 'hit_check',
      nodeLayer: 'system_check',
      actorName,
      actorSide,
      targetName,
      targetSide,
      targetId: String(event.targetId || '').trim(),
      targetScope: String(event.targetScope || meta.targetScope || '').trim() || (targetName ? 'single' : ''),
      initialActionName: actionName,
      finalActionName: actionName,
      discardedActionName: '',
      source: 'hit_check',
      result: result || (missed ? 'miss' : 'hit'),
      primaryOutcome: missed ? 'miss' : 'damage',
      failureReason: missed ? String(event.failureReason || event.failReason || meta.failureReason || 'dodged').trim() : '',
      reasonCode: missed ? 标准化战斗ReasonCode(event.reasonCode || meta.reasonCode || 'REACTION_SUCCEEDED', 'REACTION_SUCCEEDED') : 'ACTION_COMMITTED',
      reasonText: missed ? String(event.reasonText || meta.reasonText || '目标成功规避本次落点').trim() : '落点检定通过，进入伤害结算',
      replanReasonCode: '',
      replanReasonText: '',
      ledgerEventIds: [String(event.eventId || '').trim()].filter(Boolean),
      calculationTrace: [
        { key: 'sourceAction', label: '来源动作', value: actionName },
        { key: 'attacker', label: '攻方', value: actorName },
        { key: 'target', label: '守方', value: targetName },
        { key: 'result', label: '命中结果', value: result || (missed ? 'miss' : 'hit') },
        { key: 'failureReason', label: '失败原因', value: missed ? String(event.failureReason || event.failReason || meta.failureReason || 'dodged').trim() : '' },
        { key: 'dodgeRate', label: '闪避率', value: meta.dodgeRate },
        { key: 'dodgeRoll', label: '闪避投点', value: meta.dodgeRoll },
        { key: 'grazeMultiplier', label: '擦伤倍率', value: meta.grazeMultiplier },
      ].filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== ''),
      counterDepth: Math.max(0, Number(meta.counterDepth || 0)),
      counterRootNodeId: parent,
    };
    trace.push(node);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function 写入战斗状态检定节点(combatData = {}, event = {}, parentNodeId = '') {
    if (String(event?.eventKind || '').trim() !== 'state_apply') return null;
    const parent = String(parentNodeId || event.parentNodeId || event.sourceNodeId || '').trim();
    if (!parent) return null;
    const trace = ensureTrace(combatData);
    const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
    const stateName = readLedgerStateName(event);
    const actorName = String(event.actorName || '').trim();
    const targetName = String(event.targetName || '').trim();
    const actionName = normalizeActionDisplayName(event.finalActionName || event.actionName || event.meta?.finalActionName || event.meta?.actionName || '');
    if (!trace || !stateName || !targetName) return null;
    const existing = trace.find(node =>
      String(node?.nodeKind || '').trim() === 'state_check' &&
      String(node?.parentNodeId || '').trim() === parent &&
      String(node?.targetName || '').trim() === targetName &&
      String(readTraceValue(node?.calculationTrace, 'stateName') || '').trim() === stateName
    );
    if (existing) return existing;
    const result = String(event.result || '').trim();
    const immune = /immune|immunity|免疫|无视异常/.test(result);
    const resisted = /resist|resisted|抵抗|豁免|未附着/.test(result);
    const isControl = /控制|眩晕|沉默|封技|定身|束缚|禁锢|僵直|击退|减速|迟缓|位移限制|skip_turn|cannot_react|silence/i.test(stateName);
    const failed = immune || resisted;
    const { actorSide, targetSide } = inferEventSides(combatData, event);
    const successRateValue = Number(meta.successRate);
    const rollValue = Number(meta.roll);
    const driverAttrText = String(event.driverAttr || meta.driverAttr || '').trim();
    const successRateBreakdown = (() => {
      if (!Number.isFinite(successRateValue) || successRateValue <= 0) return '';
      const ratePct = Math.round(successRateValue <= 1 ? successRateValue * 100 : successRateValue);
      const rollPct = Number.isFinite(rollValue) && rollValue > 0 ? Math.round(rollValue <= 1 ? rollValue * 100 : rollValue) : null;
      const source = String(meta.successRateReason || meta.stateSuccessRateReason || '').trim();
      if (ratePct >= 100) return `附着成功率：100%，${source || (targetSide === actorSide ? '友方或非负面状态默认生效' : '必中/无法抵抗/非负面默认生效')}`;
      const driverPart = driverAttrText ? `，驱动属性${driverAttrText}` : '';
      const rollPart = rollPct !== null ? `，检定${rollPct}${failed ? ' > ' : ' <= '}${ratePct}${failed ? '，未通过' : '，通过'}` : '';
      return `附着成功率：最终${ratePct}%${driverPart}${source ? `，${source}` : '，基础拆分未记录'}${rollPart}`;
    })();
    if (successRateBreakdown && !meta.successRateBreakdown) meta.successRateBreakdown = successRateBreakdown;
    const node = {
      nodeId: String(nextRuntimeId('battle-trace-state-check')).trim(),
      parentNodeId: parent,
      round: Number(event.round || event.sourceRound || 0),
      phase: 'action',
      nodeKind: 'state_check',
      nodeLayer: 'system_check',
      actorName,
      actorSide,
      targetName,
      targetSide,
      targetId: String(event.targetId || '').trim(),
      targetScope: String(event.targetScope || meta.targetScope || '').trim() || 'single',
      initialActionName: actionName,
      finalActionName: actionName,
      discardedActionName: '',
      source: 'state_check',
      result: result || (immune ? 'immune' : (resisted ? 'resisted' : 'applied')),
      primaryOutcome: immune ? (isControl ? 'control_immune' : 'state_immune') : (isControl ? (resisted ? 'control_resisted' : 'control_applied') : (resisted ? 'state_resisted' : 'state_applied')),
      failureReason: failed ? String(event.failureReason || event.failReason || meta.failureReason || meta.reason || (immune ? 'state_immune' : 'state_resisted')).trim() : '',
      reasonCode: failed ? 标准化战斗ReasonCode(event.reasonCode || meta.reasonCode || 'REACTION_SUCCEEDED', 'REACTION_SUCCEEDED') : 'ACTION_COMMITTED',
      reasonText: failed ? String(event.reasonText || meta.reasonText || (immune ? '目标免疫本次状态附着' : '目标抵住本次状态附着')).trim() : '状态附着检定通过，进入状态结算',
      replanReasonCode: '',
      replanReasonText: '',
      ledgerEventIds: [String(event.eventId || '').trim()].filter(Boolean),
      calculationTrace: [
        { key: 'sourceAction', label: '来源动作', value: actionName },
        { key: 'attacker', label: '施加方', value: actorName },
        { key: 'target', label: '目标', value: targetName },
        { key: 'stateName', label: '状态', value: stateName },
        { key: 'result', label: '附着结果', value: result || (immune ? 'immune' : (resisted ? 'resisted' : 'applied')) },
        { key: 'successRate', label: '附着成功率', value: meta.successRate },
        { key: 'roll', label: '附着投点', value: meta.roll },
        { key: 'driverAttr', label: '驱动属性', value: driverAttrText },
        { key: 'successRateBreakdown', label: '成功率来源', value: successRateBreakdown },
      ].filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== ''),
      counterDepth: Math.max(0, Number(meta.counterDepth || 0)),
      counterRootNodeId: parent,
    };
    trace.push(node);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function 构建事件最小结算轨迹(event = {}) {
    const kind = String(event?.eventKind || '').trim();
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const 事件自身动作名 = normalizeActionDisplayName(
      event.finalActionName || event.actionName || meta.finalActionName || meta.actionName || event.skillName || meta.skillName || '',
    );
    const 事件来源动作名 = normalizeActionDisplayName(event.sourceActionName || meta.sourceActionName || '');
    const 结算来源动作名 = ['state_tick', 'state_replace', 'state_remove'].includes(kind)
      ? (事件自身动作名 || 事件来源动作名)
      : 事件自身动作名;
    if (['dodge', 'defend', 'pass'].includes(kind)) {
      const actionName = 事件自身动作名 || '应招';
      const sourceAction = 事件来源动作名;
      const reactionTrace = meta.reactionTrace && typeof meta.reactionTrace === 'object' ? meta.reactionTrace : {};
      const trace = [
        { key: 'reactor', label: '应招方', value: String(event.actorName || '').trim() },
        { key: 'sourceActor', label: '攻势来源', value: String(event.targetName || '').trim() },
        { key: 'sourceAction', label: '来源动作', value: sourceAction },
        { key: 'reactionActorName', label: '反应方', value: String(reactionTrace.reactionActorName || event.actorName || '').trim() },
        { key: 'sourceActorName', label: '攻方', value: String(reactionTrace.sourceActorName || event.targetName || '').trim() },
        { key: 'reactionRole', label: '反应职责', value: String(reactionTrace.reactionRole || '').trim() },
        { key: 'reactionOutcome', label: '反应结果', value: String(reactionTrace.reactionOutcome || event.result || '').trim() },
        { key: 'initialReaction', label: '初始反应', value: normalizeActionDisplayName(event.initialActionName || meta.initialActionName || actionName) },
        { key: 'finalReaction', label: '最终反应', value: normalizeActionDisplayName(event.finalActionName || meta.finalActionName || actionName) },
        { key: 'reactionKind', label: '反应类型', value: String(meta.reactionType || event.actionType || kind).trim() },
        { key: 'result', label: '反应结果', value: String(event.result || '').trim() || (kind === 'pass' ? 'reaction_failed' : 'attempted') },
        { key: 'reasonCode', label: '原因枚举', value: 标准化战斗ReasonCode(event.reasonCode || meta.reasonCode || '', 推断战斗默认ReasonCode(event, kind === 'pass' ? 'reaction_failed' : '')) },
      ];
      [
        ['reactionRatio', '反应比值'],
        ['reactionValue', '反应值'],
        ['sourceActionSpeed', '攻方速度'],
        ['castTimeGap', '前摇差'],
        ['attackerCastTime', '攻方前摇'],
        ['reactorCastTime', '应招前摇'],
        ['threatScore', '威胁评分'],
        ['attackerSpeed', '攻方出手速度'],
        ['defenderReaction', '防守反应值'],
        ['reactionAgility', '应招敏捷'],
        ['reactionMental', '应招精神'],
        ['sourceAgility', '攻方敏捷'],
        ['castPenalty', '前摇速度惩罚'],
        ['attackerAgility', '攻方敏捷'],
        ['defenderAgility', '防守方敏捷'],
        ['defenderMentalMax', '防守方精神上限'],
        ['attackerSpeedBonus', '攻方速度加值'],
        ['castSpeedBonus', '前摇加速'],
        ['castSpeedPenalty', '前摇减速'],
        ['defenderReactionBonus', '防守反应加值'],
        ['defenderReactionPenalty', '防守反应惩罚'],
        ['defenderAgilityMult', '敏捷倍率'],
        ['maintainReactionPenalty', '维持惩罚'],
        ['reactionBudget', '反应预算'],
        ['dodgeRate', '闪避率'],
        ['dodgeRoll', '闪避投点'],
        ['actualDefense', '有效防御'],
        ['defenseThreshold', '破防阈值'],
      ].forEach(([key, label]) => {
        const raw = reactionTrace[key] ?? meta[key];
        if (raw !== undefined) trace.push({ key, label, value: Number(raw || 0) });
      });
      if (String(meta.replanReasonCode || '').trim()) trace.push({ key: 'replanReasonCode', label: '变招原因', value: 标准化战斗ReasonCode(meta.replanReasonCode, 'TACTICAL_DISADVANTAGE') });
      if (String(meta.reactionLog || '').trim()) trace.push({ key: 'reactionLog', label: '反应记录', value: String(meta.reactionLog || '').trim() });
      return trace.filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');
    }
    if (kind === 'hit_result') {
      const finalDamage = Math.max(0, readLedgerNumber(event, 'damage'));
      const incomingDamage = Math.max(0, Number(meta.incomingDamage || finalDamage || 0));
      const defenseThreshold = Math.max(0, Number(meta.defenseThreshold || 0));
      const formulaTrace = meta.formulaTrace && typeof meta.formulaTrace === 'object' ? meta.formulaTrace : meta;
      const trace = [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'attacker', label: '攻方', value: String(event.actorName || '').trim() },
        { key: 'target', label: '守方', value: String(event.targetName || '').trim() },
        { key: 'result', label: '命中结果', value: String(event.result || '').trim() || 'hit' },
        { key: 'failureReason', label: '失败原因', value: String(event.failureReason || event.failReason || meta.failureReason || '').trim() },
        { key: 'incomingDamage', label: '基础/入参伤害', value: Math.round(incomingDamage) },
        { key: 'defenseThreshold', label: '防御/破防阈值', value: Math.round(defenseThreshold) },
        { key: 'shieldAbsorb', label: '护盾吸收', value: Math.max(0, Number(meta.shieldAbsorb || 0)) },
        { key: 'finalDamage', label: '最终伤害', value: Math.round(finalDamage) },
      ];
      if (meta.reactiveDamage !== undefined) trace.push({ key: 'reactiveDamage', label: '反应后伤害', value: Math.max(0, Math.round(Number(meta.reactiveDamage || 0))) });
      if (String(meta.breakType || '').trim()) trace.push({ key: 'breakType', label: '破防结果', value: String(meta.breakType || '').trim() });
      if (meta.dodgeRate !== undefined) trace.push({ key: 'dodgeRate', label: '闪避率', value: Math.round(Number(meta.dodgeRate || 0)) });
      if (meta.dodgeRoll !== undefined) trace.push({ key: 'dodgeRoll', label: '闪避投点', value: Math.round(Number(meta.dodgeRoll || 0)) });
      [
        ['segmentIndex', '伤害段序号'],
        ['segmentCount', '伤害段数'],
        ['actualDefense', '有效防御'],
        ['defenseStrip', '防御剥夺'],
        ['spiritResistStrip', '精神抗性剥夺'],
        ['soulDriveScale', '魂力驱动倍率'],
        ['spiritDriveScale', '精神驱动倍率'],
        ['positionDamageScale', '定位倍率'],
        ['costDamageScale', '消耗加成'],
        ['fluctuation', '波动倍率'],
        ['grazeMultiplier', '擦伤倍率'],
        ['damageReduction', '减伤倍率'],
        ['jadeHandReduction', '玄玉手减免'],
        ['receivedDamageMult', '承伤倍率'],
        ['elementDamageMult', '元素承伤倍率'],
        ['finalDamageMult', '最终伤害倍率'],
        ['finalDamageBonus', '最终伤害加值'],
        ['activeReactionShield', '主动反应护盾'],
      ].forEach(([key, label]) => {
        if (meta[key] !== undefined) trace.push({ key, label, value: Number(meta[key] || 0) });
      });
      [
        ['skillPower', '威力倍率'],
        ['attackValue', '公式攻势值'],
        ['defenseValue', '公式防守值'],
        ['baseDamage', '基础公式伤害'],
        ['meleeContactScale', '近身接战系数'],
        ['fusionDamageMult', '融合技伤害倍率'],
      ].forEach(([key, label]) => {
        if (formulaTrace[key] !== undefined) trace.push({ key, label, value: Number(formulaTrace[key] || 0) });
      });
      if (String(formulaTrace.damageType || '').trim()) trace.push({ key: 'damageType', label: '伤害类型', value: String(formulaTrace.damageType || '').trim() });
      if (String(formulaTrace.formulaText || '').trim()) trace.push({ key: 'baseFormulaText', label: '基础公式', value: String(formulaTrace.formulaText || '').trim() });
      return trace;
    }
    if (kind === 'state_apply') {
      const trace = [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'attacker', label: '施加方', value: String(event.actorName || '').trim() },
        { key: 'target', label: '目标', value: String(event.targetName || '').trim() },
        { key: 'stateName', label: '状态', value: readLedgerStateName(event) },
        { key: 'result', label: '附着结果', value: String(event.result || '').trim() || 'applied' },
        { key: 'duration', label: '持续回合', value: Math.max(0, Number(event.duration || 0)) },
      ];
      if (meta.successRate !== undefined) trace.push({ key: 'successRate', label: '附着成功率', value: Math.round(Number(meta.successRate || 0) * 100) });
      if (meta.roll !== undefined) trace.push({ key: 'roll', label: '附着投点', value: Math.round(Number(meta.roll || 0) * 100) });
      const driverAttr = String(event.driverAttr || meta.driverAttr || '').trim();
      if (driverAttr) trace.push({ key: 'driverAttr', label: '驱动属性', value: driverAttr });
      return trace;
    }
    if (kind === 'state_tick') {
      return [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'target', label: '目标', value: String(event.targetName || '').trim() },
        { key: 'stateName', label: '状态', value: readLedgerStateName(event) },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || 'tick' },
        { key: 'amount', label: '结算数值', value: Math.max(0, Number(event?.meta?.amount ?? event?.amount ?? 0)) },
        { key: 'resource', label: '结算资源', value: String(event?.meta?.resource || '生命值').trim() },
      ];
    }
    if (kind === 'state_replace' || kind === 'state_remove') {
      const trace = [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'actor', label: '来源方', value: String(event.actorName || '').trim() },
        { key: 'target', label: '目标', value: String(event.targetName || '').trim() },
        { key: 'stateName', label: '状态', value: String(meta.stateName || event.stateName || readLedgerStateName(event) || '').trim() },
        { key: 'stackMode', label: '叠加规则', value: String(meta.stackMode || '').trim() },
        { key: 'previousDuration', label: '原持续', value: Math.max(0, Number(meta.previousDuration || 0)) },
        { key: 'nextDuration', label: '新持续', value: Math.max(0, Number(meta.nextDuration ?? event.duration ?? 0)) },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || kind },
      ];
      if (String(meta.replaceReason || '').trim()) trace.push({ key: 'replaceReason', label: '变更原因', value: String(meta.replaceReason || '').trim() });
      return trace.filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');
    }
    if (kind === 'counter') {
      const damage = Math.max(0, Math.round(readLedgerNumber(event, 'damage')));
      return [
        { key: 'sourceAction', label: '来源动作', value: 事件自身动作名 },
        { key: 'counteredAction', label: '被反制动作', value: 事件来源动作名 },
        { key: 'attacker', label: '反击方', value: String(event.actorName || '').trim() },
        { key: 'target', label: '目标', value: String(event.targetName || '').trim() },
        { key: 'result', label: '反击结果', value: String(event.result || '').trim() || (damage > 0 ? 'hit' : 'no_effect') },
        { key: 'failureReason', label: '失败原因', value: String(event.failureReason || event.failReason || meta.failureReason || '').trim() },
        { key: 'counterDepth', label: '防反层级', value: Math.max(0, Number(meta.counterDepth || 0)) },
        { key: 'finalDamage', label: '最终伤害', value: damage },
      ];
    }
    if (kind === 'resource_change') {
      const delta = Number(meta.delta ?? meta.amount ?? event.delta ?? event.amount ?? 0);
      return [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'actor', label: '来源方', value: String(event.actorName || '').trim() },
        { key: 'target', label: '目标', value: String(event.targetName || event.actorName || '').trim() },
        { key: 'resource', label: '资源', value: String(meta.resource || event.resource || '').trim() },
        { key: 'delta', label: '变化量', value: Math.round(delta) },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || (delta >= 0 ? 'gain' : 'loss') },
      ];
    }
    if (kind === 'shield_create') {
      return [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'actor', label: '来源方', value: String(event.actorName || '').trim() },
        { key: 'target', label: '目标', value: String(event.targetName || event.actorName || '').trim() },
        { key: 'shieldValue', label: '护盾值', value: Math.max(0, Math.round(Number(meta.shieldValue ?? meta.amount ?? event.amount ?? event.damage ?? 0))) },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || 'created' },
      ];
    }
    if (kind === 'summon_create') {
      return [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'actor', label: '召唤者', value: String(event.actorName || '').trim() },
        { key: 'summonName', label: '召唤物', value: String(event.summonName || event.createdName || meta.summonName || '').trim() },
        { key: 'summonType', label: '召唤类型', value: String(event.summonType || meta.summonType || '').trim() },
        { key: 'summonMode', label: '行动模式', value: String(event.summonMode || meta.summonMode || '').trim() },
        { key: 'mentalLoad', label: '精神负载', value: Math.max(0, Math.round(Number(event.mentalLoad ?? meta.mentalLoad ?? 0))) },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || 'created' },
      ];
    }
    if (kind === 'create') {
      return [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'actor', label: '来源方', value: String(event.actorName || '').trim() },
        { key: 'createdName', label: '造物', value: String(event.createdName || meta.createdName || event.targetName || '').trim() },
        { key: 'createdType', label: '造物类型', value: String(event.createdType || meta.createdType || event.actionType || '').trim() },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || 'created' },
      ];
    }
    if (['blocked_action', 'failed_action', 'target_fail'].includes(kind)) {
      const trace = [
        { key: 'sourceAction', label: '来源动作', value: 结算来源动作名 },
        { key: 'actor', label: '行动者', value: String(event.actorName || '').trim() },
        { key: 'target', label: '目标', value: String(event.targetName || '').trim() },
        { key: 'result', label: '结算结果', value: String(event.result || '').trim() || 'failed' },
        { key: 'failureReason', label: '失败原因', value: String(event.failureReason || event.failReason || meta.failureReason || '').trim() },
        { key: 'reasonCode', label: '原因枚举', value: 标准化战斗ReasonCode(event.reasonCode || meta.reasonCode || '', 推断战斗默认ReasonCode(event, 'interrupted')) },
      ];
      if (String(event.actionType || '').trim() === 'summon_control') {
        [
          ['summonName', '召唤物', String(meta.summonName || event.actorName || '').trim()],
          ['summonType', '召唤类型', String(meta.summonType || '').trim()],
          ['summonMode', '行动模式', String(meta.summonMode || '').trim()],
          ['summonHostName', '宿主', String(meta.summonHostName || event.targetName || '').trim()],
          ['mentalLoad', '精神负载', Math.max(0, Math.round(Number(meta.mentalLoad || 0)))],
          ['totalMentalLoad', '总精神负载', Math.max(0, Math.round(Number(meta.totalMentalLoad || 0)))],
          ['mentalLimit', '精神控制上限', Math.max(0, Math.round(Number(meta.mentalLimit || 0)))],
          ['maintainRatio', '精神维持率', Number(Number(meta.maintainRatio || 0).toFixed(3))],
          ['compression', '超载压缩', Number(Number(meta.compression || 0).toFixed(3))],
          ['restriction', '限制结果', String(meta.restriction || event.result || '').trim()],
        ].forEach(([key, label, value]) => {
          if (value === '' || value === null || value === undefined) return;
          trace.push({ key, label, value });
        });
      }
      return trace;
    }
    return [];
  }

  function 写入战斗因果链节点(combatData = {}, event = {}, refs = {}) {
    const trace = ensureTrace(combatData);
    if (!trace) return null;
    const config = 推断战斗因果节点配置(event);
    const sourceNodeId = String(event.sourceNodeId || refs.matchedSourceAction?.chainNodeId || refs.matchedAction?.chainNodeId || '').trim();
    const parentNodeId = String(event.parentNodeId || sourceNodeId || '').trim();
    const nodeId = String(event.chainNodeId || nextRuntimeId(`battle-trace-${config.nodeKind || 'node'}`)).trim();
    const finalActionName = normalizeActionDisplayName(event.finalActionName || event.actionName || event.meta?.finalActionName || event.meta?.actionName || '');
    const initialActionName = normalizeActionDisplayName(event.initialActionName || event.meta?.initialActionName || event.actionName || event.meta?.actionName || finalActionName);
    const calculationTrace = Array.isArray(event.meta?.settlementTrace)
      ? event.meta.settlementTrace
      : 构建事件最小结算轨迹(event);
    const primaryOutcome = String(event.primaryOutcome || event.meta?.primaryOutcome || config.primaryOutcome || '').trim();
    const defaultReasonCode = 推断战斗默认ReasonCode(event, primaryOutcome);
    const { actorSide, targetSide } = inferEventSides(combatData, event);
    const node = {
      nodeId,
      parentNodeId,
      round: Number(event.round || event.sourceRound || 0),
      phase: ['state_tick', 'round_recover'].includes(String(event.eventKind || '').trim()) ? 'round_end' : 'action',
      nodeKind: config.nodeKind,
      nodeLayer: config.nodeLayer,
      actorName: String(event.actorName || '').trim(),
      actorSide,
      actorControl: normalizeActorControl(event.actorControl || event.meta?.actorControl, event.actionRole === 'STATE_TICK' ? 'SYSTEM' : 'AI'),
      actionRole: normalizeActionRole(event.actionRole || event.meta?.actionRole || inferActionRole(event)),
      targetName: String(event.targetName || '').trim(),
      targetSide,
      targetId: String(event.targetId || '').trim(),
      targetScope: String(event.targetScope || event.meta?.targetScope || '').trim() || (event.targetName ? 'single' : ''),
      initialActionName,
      finalActionName,
      discardedActionName: normalizeActionDisplayName(event.discardedActionName || event.meta?.discardedActionName || ''),
      source: String(event.meta?.source || event.actionType || event.eventKind || '').trim(),
      result: String(event.result || '').trim(),
      primaryOutcome,
      failureReason: String(event.failureReason || event.failReason || event.meta?.failureReason || '').trim(),
      reasonCode: 标准化战斗ReasonCode(event.reasonCode || event.meta?.reasonCode || '', defaultReasonCode || (event.failReason ? 'LEGACY_CUSTOM_REASON' : '')),
      reasonText: String(event.reasonText || event.meta?.reasonText || '').trim(),
      replanReasonCode: 标准化战斗ReasonCode(event.replanReasonCode || event.meta?.replanReasonCode || '', ''),
      replanReasonText: String(event.replanReasonText || event.meta?.replanReasonText || '').trim(),
      ledgerEventIds: [String(event.eventId || '').trim()].filter(Boolean),
      calculationTrace,
      counterDepth: Math.max(0, Number(event.meta?.counterDepth || 0)),
      counterRootNodeId: String(event.meta?.counterRootNodeId || parentNodeId || '').trim(),
      sourceActionId: String(event.sourceActionId || '').trim(),
      reactionNodeId: String(event.reactionNodeId || event.meta?.reactionWindowNodeId || '').trim(),
      ruleCode: 标准化战斗ReasonCode(event.ruleCode || event.reasonCode || event.meta?.ruleCode || event.meta?.reasonCode || '', defaultReasonCode || ''),
      resultState: String(event.resultState || event.result || primaryOutcome || event.eventKind || '').trim(),
      factType: String(event.factType || inferFactType(event.eventKind, event)).trim(),
      effectPrototype: String(event.effectPrototype || event.meta?.effectPrototype || '').trim(),
      sourceEffectId: String(event.sourceEffectId || event.meta?.sourceEffectId || '').trim(),
    };
    trace.push(normalizeCausalNode(node));
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return node;
  }

  function 读取状态Tick聚合种类(event = {}) {
    const result = String(event?.result || '').trim();
    const resource = String(event?.meta?.resource || '生命值').trim();
    if (/魂力|精神力|体力|资源/.test(resource)) return 'resource_tick';
    if (/恢复|heal|hot/i.test(result)) return 'heal_tick';
    return 'state_tick';
  }

  function 同步回合末状态聚合节点(combatData = {}, event = {}, traceNode = null) {
    const kind = String(event?.eventKind || '').trim();
    if (kind !== 'state_tick') return null;
    const trace = ensureTrace(combatData?.__父级战斗数据 || combatData);
    if (!Array.isArray(trace) || !traceNode?.nodeId) return null;
    const round = Number(event.round || event.sourceRound || 0);
    const stateName = readLedgerStateName(event);
    const aggregateKind = 读取状态Tick聚合种类(event);
    if (!(round > 0) || !stateName) return null;
    const tickNodes = trace.filter(node =>
      node &&
      String(node.nodeKind || '').trim() === 'state_settlement' &&
      String(node.primaryOutcome || '').trim() === 'state_tick' &&
      Number(node.round || 0) === round &&
      String(readTraceValue(node.calculationTrace, 'stateName') || '').trim() === stateName &&
      读取状态Tick聚合种类({ result: node.result, meta: { resource: readTraceValue(node.calculationTrace, 'resource') || '生命值' } }) === aggregateKind
    );
    if (tickNodes.length < 2) return null;
    const nodeId = `battle-trace-aggregation-${round}-${aggregateKind}-${stateName}`.replace(/\s+/g, '-');
    const childNodeIds = tickNodes.map(node => String(node.nodeId || '').trim()).filter(Boolean);
    const ledgerEventIds = tickNodes.flatMap(node => Array.isArray(node.ledgerEventIds) ? node.ledgerEventIds : []).filter(Boolean);
    const totalAmount = tickNodes.reduce((sum, node) => sum + Math.max(0, Number(readTraceValue(node.calculationTrace, 'amount') || 0)), 0);
    const existing = trace.find(node => String(node?.nodeId || '').trim() === nodeId);
    const payload = {
      nodeId,
      parentNodeId: '',
      round,
      phase: 'round_end',
      nodeKind: 'aggregation',
      nodeLayer: 'presentation',
      actorName: '',
      actorSide: '',
      targetName: '',
      targetSide: '',
      targetId: '',
      targetScope: 'all_units',
      initialActionName: '',
      finalActionName: '',
      discardedActionName: '',
      source: 'trace_projection',
      result: 'aggregated',
      primaryOutcome: aggregateKind,
      failureReason: '',
      reasonCode: '',
      reasonText: '',
      replanReasonCode: '',
      replanReasonText: '',
      aggregateKind,
      stateName,
      childNodeIds,
      ledgerEventIds,
      calculationTrace: [
        { key: 'aggregateKind', label: '聚合类型', value: aggregateKind },
        { key: 'stateName', label: '状态', value: stateName },
        { key: 'childCount', label: '子结算数', value: childNodeIds.length },
        { key: 'totalAmount', label: '合计数值', value: Math.round(totalAmount) },
      ],
      counterDepth: 0,
      counterRootNodeId: '',
    };
    if (existing) Object.assign(existing, payload);
    else trace.push(payload);
    if (trace.length > 1000) trace.splice(0, trace.length - 1000);
    return existing || payload;
  }
  function writeLedgerEvent(combatData = {}, payload = {}) {
    let rootData = combatData || {};
    const visited = new Set();
    while (rootData?.__父级战斗数据 && rootData.__父级战斗数据 !== rootData && !visited.has(rootData)) {
      visited.add(rootData);
      rootData = rootData.__父级战斗数据;
    }
    const ledger = ensureLedger(rootData);
    if (combatData && rootData !== combatData) {
      const childLedger = Array.isArray(combatData.__battleEventLedger) ? combatData.__battleEventLedger : [];
      const existingEventIds = new Set(ledger.map(item => String(item?.eventId || '').trim()).filter(Boolean));
      childLedger.forEach(item => {
        const eventId = String(item?.eventId || '').trim();
        if (eventId && !existingEventIds.has(eventId)) {
          ledger.push(item);
          existingEventIds.add(eventId);
        }
      });
      attachLedger(combatData, ledger);
    }
    const eventKind = String(payload.eventKind || '').trim();
    const round = Number(payload.round || combatData?.回合 || 0);
    const actorName = String(payload.actorName || '').trim();
    const targetName = String(payload.targetName || '').trim();
    const targetIds = normalizeTargetIds(
      payload.targetIds,
      payload.targetId || payload.targetKey || payload.target_id,
      targetName,
    );
    const actionName = normalizeActionDisplayName(payload.actionName || '');
    const sourceActionName = normalizeActionDisplayName(payload.sourceActionName || '');
    const sourceRound = Number(payload.sourceRound || round || 0);
    const matchedAction = eventKind === 'action_start' || eventKind === 'counter' || !actionName
      ? null
      : findRecentLedgerAction(ledger, { round, actorName, actionName });
    const matchedCounterStart = eventKind === 'hit_result' && actionName
      ? findRecentLedgerAction(ledger, { round, actorName, actionName })
      : null;
    const closedActionKinds = new Set(['hit_result', 'state_apply', 'resource_change', 'create', 'summon_create', 'summon_assist', 'shield_create', 'blocked_action', 'failed_action', 'target_fail', 'blocked_settlement', 'counter_window']);
    const sourceActorName = eventKind === 'counter' || eventKind === 'counter_window'
      ? targetName
      : (['defend', 'dodge', 'pass'].includes(eventKind) ? targetName : actorName);
    const matchedSourceAction = sourceActionName
      ? findRecentLedgerAction(ledger, {
          round: sourceRound,
          actorName: sourceActorName,
          actionName: sourceActionName,
        })
      : null;
    const matchedInitialIntent = eventKind === 'action_start'
      ? findInitialIntentNode(combatData?.__父级战斗数据 || combatData, { ...payload, round, actorName, targetName, actionName })
      : null;
    const actionId = String(
      payload.actionId ||
      matchedAction?.actionId ||
      matchedCounterStart?.actionId ||
      (eventKind === 'action_start' || eventKind === 'counter' || closedActionKinds.has(eventKind)
        ? nextRuntimeId(eventKind === 'counter' ? 'battle-counter-action' : 'battle-action')
        : '')
    ).trim();
    const sourceActionId = String(
      payload.sourceActionId ||
      matchedSourceAction?.actionId ||
      (eventKind !== 'action_start' && eventKind !== 'counter' ? (matchedAction?.actionId || matchedCounterStart?.actionId) : '') ||
      ''
    ).trim();
    const eventMeta = payload.meta && typeof payload.meta === 'object' ? { ...payload.meta } : {};
    const actionRole = inferActionRole({ ...payload, eventKind, meta: eventMeta });
    const actorControl = normalizeActorControl(
      payload.actorControl || eventMeta.actorControl,
      actionRole === 'STATE_TICK' || ['counter_window', 'reaction_window'].includes(eventKind) ? 'SYSTEM' : 'AI',
    );
    const inferredPrimaryOutcome = String(payload.primaryOutcome || eventMeta.primaryOutcome || readLedgerOutcome({ ...payload, meta: eventMeta }) || '').trim();
    const inferredAppliedDamage = (() => {
      const raw = Number(payload.appliedDamage ?? payload.damage ?? eventMeta.appliedDamage ?? eventMeta.damage ?? (eventKind === 'state_tick' ? eventMeta.amount : 0) ?? 0);
      return Number.isFinite(raw) ? Math.max(0, Math.round(Math.abs(raw))) : 0;
    })();
    if (inferredPrimaryOutcome) eventMeta.primaryOutcome = inferredPrimaryOutcome;
    if (eventKind === 'hit_result' || eventKind === 'counter' || eventKind === 'state_tick') {
      eventMeta.appliedDamage = inferredAppliedDamage;
      if (eventMeta.damage === undefined && inferredAppliedDamage > 0) eventMeta.damage = inferredAppliedDamage;
    }
    if (eventKind === 'hit_result' && inferredAppliedDamage > 0) {
      const formula = eventMeta.formulaTrace && typeof eventMeta.formulaTrace === 'object' ? eventMeta.formulaTrace : eventMeta;
      const attackValue = Number(formula.attackValue || eventMeta.formulaAttackValue || 0);
      const defenseValue = Number(formula.defenseValue || eventMeta.formulaDefenseValue || eventMeta.actualDefense || 0);
      const missingRatioOperand = !(attackValue > 0) || !(defenseValue > 0);
      if (missingRatioOperand) {
        const runtime = ensureCombatRuntime(rootData);
        runtime.attackDefenseRatioMissingOperandCount = Number(runtime.attackDefenseRatioMissingOperandCount || 0) + 1;
        eventMeta.attackDefenseRatioAudit = {
          missingOperand: true,
          attackValue: Number.isFinite(attackValue) ? attackValue : 0,
          defenseValue: Number.isFinite(defenseValue) ? defenseValue : 0,
          ratio: null,
        };
      } else {
        const ratio = attackValue / defenseValue;
        if (!Number.isFinite(ratio) || ratio > 5 || ratio < 0.1) {
        const runtime = ensureCombatRuntime(rootData);
        runtime.attackDefenseRatioOutOfRangeCount = Number(runtime.attackDefenseRatioOutOfRangeCount || 0) + 1;
        eventMeta.attackDefenseRatioAudit = {
          outOfRange: true,
          attackValue: Number.isFinite(attackValue) ? attackValue : 0,
          defenseValue: Number.isFinite(defenseValue) ? defenseValue : 0,
          ratio: Number.isFinite(ratio) ? ratio : null,
        };
        }
      }
    }
    const inferredActionStatus = (() => {
      const explicit = String(payload.actionStatus || eventMeta.actionStatus || '').trim().toUpperCase();
      if (['DECLARED', 'SELECTED', 'LOCKED', 'EXECUTING', 'COMPLETED', 'ABORTED', 'FAILED_PRECHECK'].includes(explicit)) return explicit;
      const resultText = String(payload.result || eventMeta.result || payload.failReason || eventMeta.failureReason || '').trim();
      if (eventKind === 'action_start') return 'DECLARED';
      if (eventKind === 'target_fail' || /PRECHECK|资源不足|冷却|沉默|缴械|达到上限|CAP_REACHED/.test(`${resultText} ${payload.reasonCode || eventMeta.reasonCode || ''}`)) return 'FAILED_PRECHECK';
      if (eventKind === 'blocked_settlement' || /打断|截断|中断|动作流产|target_lost|目标丢失|死亡|DEAD|INTERRUPT|ABORT/i.test(resultText)) return 'ABORTED';
      if (['hit_result', 'state_apply', 'state_tick', 'resource_change', 'create', 'summon_create', 'summon_assist', 'shield_create', 'blocked_action', 'failed_action'].includes(eventKind)) return 'COMPLETED';
      return '';
    })();
    if (inferredActionStatus) eventMeta.actionStatus = inferredActionStatus;
    const explicitActorSide = normalizeBattleSide(payload.actorSide || eventMeta.actorSide || '');
    const explicitTargetSide = normalizeBattleSide(payload.targetSide || eventMeta.targetSide || '');
    const matchedActorSide = normalizeBattleSide(
      matchedAction?.actorSide || matchedCounterStart?.actorSide || matchedSourceAction?.actorSide || '',
    );
    const matchedTargetSide = [matchedAction, matchedCounterStart, matchedSourceAction]
      .find(action => action && targetName && isSameLedgerName(action?.targetName || '', targetName))?.targetSide || '';
    const eventSides = inferEventSides(rootData, {
      ...payload,
      actorName,
      actorSide: explicitActorSide || matchedActorSide,
      targetName,
      targetSide: explicitTargetSide || matchedTargetSide,
      targetPoolSide: String(payload.targetPoolSide || eventMeta.targetPoolSide || '').trim(),
      meta: eventMeta,
    });
    const factType = inferFactType(eventKind, { ...payload, meta: eventMeta });
    const effectPrototype = inferEffectPrototype(eventKind, { ...payload, meta: eventMeta });
    const event = {
      eventId: String(payload.eventId || nextRuntimeId('battle-ledger')).trim(),
      eventKind,
      round,
      actorName,
      actorSide: eventSides.actorSide,
      targetName,
      targetSide: eventSides.targetSide,
      targetId: targetIds[0] || '',
      targetIds,
      targetScope: String(payload.targetScope || eventMeta.targetScope || matchedSourceAction?.targetScope || matchedAction?.targetScope || matchedCounterStart?.targetScope || '').trim() || (targetName ? 'single' : 'self'),
      actionName,
      initialActionName: normalizeActionDisplayName(payload.initialActionName || eventMeta.initialActionName || actionName),
      finalActionName: normalizeActionDisplayName(payload.finalActionName || eventMeta.finalActionName || actionName),
      discardedActionName: normalizeActionDisplayName(payload.discardedActionName || eventMeta.discardedActionName || ''),
      actionType: String(payload.actionType || '').trim(),
      actorControl,
      actionRole,
      actionId,
      sourceActionName,
      sourceActionId,
      sourceRound: Number(payload.sourceRound || (sourceActionId ? sourceRound : 0)),
      chainNodeId: String(payload.chainNodeId || '').trim(),
      parentNodeId: String(payload.parentNodeId || matchedInitialIntent?.nodeId || matchedSourceAction?.chainNodeId || matchedAction?.chainNodeId || matchedCounterStart?.chainNodeId || '').trim(),
      sourceNodeId: String(payload.sourceNodeId || matchedInitialIntent?.nodeId || matchedSourceAction?.chainNodeId || matchedAction?.chainNodeId || matchedCounterStart?.chainNodeId || '').trim(),
      reactionNodeId: String(payload.reactionNodeId || eventMeta.reactionNodeId || eventMeta.reactionWindowNodeId || '').trim(),
      ruleCode: String(payload.ruleCode || payload.reasonCode || eventMeta.ruleCode || eventMeta.reasonCode || '').trim().toUpperCase(),
      result: String(payload.result || '').trim(),
      resultState: String(payload.resultState || payload.result || inferredActionStatus || inferredPrimaryOutcome || eventKind).trim(),
      factType,
      effectPrototype,
      sourceEffectId: String(payload.sourceEffectId || eventMeta.sourceEffectId || '').trim(),
      actionStatus: inferredActionStatus,
      failReason: String(payload.failReason || '').trim(),
      primaryOutcome: inferredPrimaryOutcome,
      appliedDamage: inferredAppliedDamage,
      effectCapability: payload.effectCapability && typeof payload.effectCapability === 'object'
        ? {
            hasDamageEffect: payload.effectCapability.hasDamageEffect === true,
            effectKinds: Array.isArray(payload.effectCapability.effectKinds)
              ? payload.effectCapability.effectKinds.map(kind => String(kind || '').trim()).filter(Boolean).slice(0, 12)
              : [],
          }
        : null,
      targetPoolSide: String(payload.targetPoolSide || '').trim(),
      applicationId: String(payload.applicationId || '').trim(),
      duration: Math.max(0, Number(payload.duration || 0)),
      effectSummary: String(payload.effectSummary || '').trim(),
      driverAttr: String(payload.driverAttr || '').trim(),
      meta: eventMeta,
    };
    if (event.eventKind === 'counter' && String(eventMeta.counterWindowNodeId || '').trim()) {
      event.parentNodeId = String(eventMeta.counterWindowNodeId || '').trim();
    }
    if (event.eventKind === 'counter') {
      const counterActionName = normalizeActionDisplayName(event.actionName || '');
      const counteredActionName = normalizeActionDisplayName(event.sourceActionName || '');
      const trace = Array.isArray(event.meta.settlementTrace) && event.meta.settlementTrace.length
        ? event.meta.settlementTrace
            .map(item => item && typeof item === 'object' ? { ...item } : null)
            .filter(Boolean)
        : 构建事件最小结算轨迹(event);
      const upsertTraceItem = (key, label, value) => {
        const existing = trace.find(item => String(item?.key || '').trim() === key);
        if (existing) {
          existing.label = label;
          existing.value = value;
        } else {
          trace.push({ key, label, value });
        }
      };
      upsertTraceItem('sourceAction', '来源动作', counterActionName);
      if (counteredActionName) upsertTraceItem('counteredAction', '被反制动作', counteredActionName);
      upsertTraceItem('attacker', '反击方', actorName);
      upsertTraceItem('target', '目标', targetName);
      upsertTraceItem('finalDamage', '最终伤害', inferredAppliedDamage);
      if (trace.length > 40) {
        const redundantIndex = trace.findIndex(item => String(item?.key || '').trim() === 'counterProbability');
        if (redundantIndex >= 0) trace.splice(redundantIndex, 1);
      }
      event.meta.settlementTrace = trace;
      if (event.chainNodeId) {
        const counterNode = ensureTrace(combatData?.__父级战斗数据 || combatData)
          .find(node => String(node?.nodeId || '').trim() === String(event.chainNodeId || '').trim());
        if (counterNode) {
          counterNode.nodeKind = 'counter_action';
          counterNode.nodeLayer = 'settlement';
          counterNode.result = event.result;
          counterNode.primaryOutcome = event.primaryOutcome;
          counterNode.sourceActionId = event.sourceActionId;
          counterNode.reactionNodeId = event.reactionNodeId;
          counterNode.calculationTrace = trace.map(item => ({ ...item }));
          counterNode.ledgerEventIds = [...new Set([...(counterNode.ledgerEventIds || []), event.eventId].filter(Boolean))];
        }
      }
    }
    const settlementTraceKinds = new Set(['hit_result', 'state_apply', 'state_tick', 'resource_change', 'shield_create', 'summon_create', 'create', 'blocked_action', 'failed_action', 'target_fail', 'blocked_settlement']);
    if (settlementTraceKinds.has(event.eventKind) && !Array.isArray(event.meta.settlementTrace)) {
      event.meta.settlementTrace = 构建事件最小结算轨迹(event);
    }
    if (!event.eventKind) return null;
    const sourceRootNodeId = String(event.sourceNodeId || matchedSourceAction?.chainNodeId || matchedAction?.chainNodeId || matchedCounterStart?.chainNodeId || '').trim();
    const branchNode = eventMeta.skipResolutionTrace !== true && event.eventKind !== 'action_start' && !(event.eventKind === 'counter' && String(eventMeta.counterWindowNodeId || '').trim())
      ? 写入战斗目标分支节点(combatData?.__父级战斗数据 || combatData, event, sourceRootNodeId)
      : null;
    if (branchNode) {
      event.parentNodeId = branchNode.nodeId;
      event.sourceNodeId = sourceRootNodeId;
      event.meta.targetBranchNodeId = branchNode.nodeId;
    }
    const reactionWindowNode = ['dodge', 'defend', 'pass'].includes(event.eventKind)
      ? 写入战斗反应窗口节点(combatData?.__父级战斗数据 || combatData, event, event.parentNodeId || sourceRootNodeId)
      : null;
    if (reactionWindowNode) {
      event.parentNodeId = reactionWindowNode.nodeId;
      event.sourceNodeId = sourceRootNodeId || reactionWindowNode.parentNodeId || event.sourceNodeId;
      event.reactionNodeId = reactionWindowNode.nodeId;
      event.meta.reactionWindowNodeId = reactionWindowNode.nodeId;
    }
    const hitCheckNode = event.eventKind === 'hit_result'
      ? 写入战斗命中检定节点(combatData?.__父级战斗数据 || combatData, event, event.parentNodeId || sourceRootNodeId)
      : null;
    if (hitCheckNode) {
      event.parentNodeId = hitCheckNode.nodeId;
      event.sourceNodeId = sourceRootNodeId || hitCheckNode.parentNodeId || event.sourceNodeId;
      event.meta.hitCheckNodeId = hitCheckNode.nodeId;
    }
    const stateCheckNode = event.eventKind === 'state_apply'
      ? 写入战斗状态检定节点(combatData?.__父级战斗数据 || combatData, event, event.parentNodeId || sourceRootNodeId)
      : null;
    if (stateCheckNode) {
      event.parentNodeId = stateCheckNode.nodeId;
      event.sourceNodeId = sourceRootNodeId || stateCheckNode.parentNodeId || event.sourceNodeId;
      event.meta.stateCheckNodeId = stateCheckNode.nodeId;
    }
    const traceNode = eventMeta.skipResolutionTrace === true
      ? null
      : 写入战斗因果链节点(combatData?.__父级战斗数据 || combatData, event, { matchedAction: matchedAction || matchedCounterStart, matchedSourceAction });
    if (traceNode) {
      event.chainNodeId = traceNode.nodeId;
      event.parentNodeId = traceNode.parentNodeId || event.parentNodeId;
      event.sourceNodeId = event.sourceNodeId || traceNode.parentNodeId || '';
      写入战斗变招决策节点(combatData?.__父级战斗数据 || combatData, event, traceNode);
      同步回合末状态聚合节点(combatData?.__父级战斗数据 || combatData, event, traceNode);
    }
    ledger.push(event);
    if (ledger.length > 800) ledger.splice(0, ledger.length - 800);
    return event;
  }

  function writeRoundEndResourceEvent(combatData = {}, unit = {}, label = '', resourceKey = '', delta = 0, meta = {}) {
    const amount = Math.round(Number(delta || 0));
    const resource = { hp: '生命', vit: '体力', sp: '魂力', men: '精神力' }[resourceKey];
    if (!combatData || !unit || !amount || !resource) return null;
    return writeLedgerEvent(combatData, {
      eventKind: 'resource_change',
      round: Number(combatData?.回合 || 0),
      actorName: String(meta.sourceActorName || unit?.name || unit?.名称 || label || '').trim(),
      targetName: unit?.name || unit?.名称 || label || '',
      actionName: String(meta.sourceActionName || meta.stateName || '回合末资源变化').trim(),
      actionType: 'state_tick',
      actionRole: 'STATE_TICK',
      sourceActionName: String(meta.sourceActionName || '').trim(),
      sourceActionId: String(meta.sourceActionId || '').trim(),
      sourceRound: Number(meta.sourceRound || 0),
      parentNodeId: String(meta.parentNodeId || '').trim(),
      sourceNodeId: String(meta.sourceNodeId || '').trim(),
      result: amount > 0 ? 'gain' : 'loss',
      primaryOutcome: amount > 0 ? 'resource_recovered' : 'resource_lost',
      applicationId: String(meta.applicationId || '').trim(),
      duration: Math.max(0, Number(meta.duration || 0)),
      effectSummary: String(meta.effectSummary || '').trim(),
      driverAttr: String(meta.driverAttr || '').trim(),
      meta: { ...meta, resourceKey, resource, amount: Math.abs(amount), delta: amount },
    });
  }


  function prepareBattleRuntime(combatData = {}, settlement, adapterOptions = {}) {
    settlement.prepare(combatData, adapterOptions);
    fillObjectiveDamageBaselines(combatData);
    combatData.胜负条件 = cloneValue(previewRuntime.normalizeBattleObjectives(combatData?.胜负条件 || {}, combatData));
    const runtime = ensureCombatRuntime(combatData);
    runtime.actionQueueTrace = [];
    delete runtime.actionQueueFatal;
    delete runtime.withdrawalSuccess;
  }

  function evaluateBattleTerminal(context = {}, settlement = requireSettlementPrimitives(), adapterOptions = {}) {
    const combatData = context?.combatData || {};
    const objectives = previewRuntime.normalizeBattleObjectives(combatData?.胜负条件 || {}, combatData);
    combatData.胜负条件 = cloneValue(objectives);
    const resolution = previewRuntime.evaluateBattleObjectives(combatData, objectives, {
      round: Number(context?.currentRound ?? combatData?.回合 ?? 0),
      roundCompleted: context?.roundCompleted === true,
    });
    const runtime = ensureCombatRuntime(combatData);
    runtime.objectiveResolution = cloneValue(resolution);
    if (resolution.terminal && !runtime.objectiveResolutionEventId) {
      const event = writeLedgerEvent(combatData, {
        eventKind: 'battle_objective_resolved',
        round: Number(combatData?.回合 || 0),
        actorName: 'SYSTEM',
        actionName: '胜负条件',
        actionType: 'battle_objective',
        actorControl: 'SYSTEM',
        actionRole: 'STATE_TICK',
        result: resolution.winner,
        resultState: 'COMPLETED',
        ruleCode: `BATTLE_OBJECTIVE_${resolution.status}`,
        meta: {
          status: resolution.status,
          winner: resolution.winner,
          victoryMatches: resolution.victoryMatches,
          defeatMatches: resolution.defeatMatches,
          matchedDetails: resolution.matchedDetails,
          timeLimitReached: resolution.timeLimitReached,
          objectives,
        },
      }, adapterOptions);
      runtime.objectiveResolutionEventId = String(event?.eventId || '').trim();
    }
    return resolution;
  }

  function decideTeamContinuation(context = {}, adapterOptions = {}) {
    const combatData = context?.combatData || {};
    const runtime = ensureCombatRuntime(combatData);
    if (adapterOptions.stopOnWithdrawal === true && runtime.withdrawalSuccess) return { continueSimulation: false, log: '' };
    const settings = adapterOptions.autoContinueSettings;
    if (!settings) return { continueSimulation: true, log: '' };
    const currentRound = Number(context?.currentRound || 0);
    const damageRatios = ensureLedger(combatData)
      .filter(event => String(event?.eventKind || '').trim() === 'hit_result' && Number(event?.round || 0) === currentRound)
      .map(event => {
        const target = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, event?.targetName || ''));
        const damage = Math.max(0, Number(event?.appliedDamage ?? event?.meta?.damage ?? 0));
        return damage / Math.max(1, previewRuntime.readHpMax(target || {}));
      });
    const maxDamageRatio = damageRatios.length ? Math.max(...damageRatios) : 0;
    return decideDuelContinuation({
      mode: context?.mode,
      actorsAble: true,
      activeDamage: maxDamageRatio,
      passiveHpMax: 1,
      passiveDamage: 0,
      activeHpMax: 1,
      settings,
      roll: Math.random,
    });
  }

  function readTeamAlive(combatData = {}) {
    const player = Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player : [];
    const enemy = Array.isArray(combatData?.参战者?.team_enemy) ? combatData.参战者.team_enemy : [];
    return {
      playerAlive: player.filter(unit => unit && isUnitAbleToFight(unit)).length,
      enemyAlive: enemy.filter(unit => unit && isUnitAbleToFight(unit)).length,
    };
  }

  function readCombatUnitAge(unit = {}) {
    const rawAge = unit?.属性?.年龄 ?? unit?.年龄 ?? unit?.age;
    if (typeof rawAge === 'number') return Number.isFinite(rawAge) ? rawAge : NaN;
    const text = String(rawAge == null ? '' : rawAge).trim();
    if (!text) return NaN;
    const direct = Number(text);
    if (Number.isFinite(direct)) return direct;
    const numericText = text.match(/-?\d+(?:\.\d+)?/);
    return numericText ? Number(numericText[0]) : NaN;
  }

  function validateSoulTowerRoster(combatData = {}) {
    if (String(combatData?.战斗类型 || '').trim() !== '魂灵塔冲塔') return { ok: true, skipped: true };
    const roster = (Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player : []).filter(Boolean);
    if (!roster.length) return { ok: false, message: '魂灵塔队伍为空。' };
    if (roster.length > SOUL_TOWER_TEAM_LIMIT) return { ok: false, message: `魂灵塔队伍最多 ${SOUL_TOWER_TEAM_LIMIT} 人。` };
    const invalidMember = roster.find(unit => {
      const age = readCombatUnitAge(unit);
      return !Number.isFinite(age) || age <= 0 || age > SOUL_TOWER_MAX_AGE;
    });
    if (invalidMember) {
      return {
        ok: false,
        message: `${previewRuntime.unitName(invalidMember) || '队员'} 已超过 ${SOUL_TOWER_MAX_AGE} 岁，无法参与魂灵塔试炼。`,
      };
    }
    const ages = roster.map(readCombatUnitAge).filter(age => Number.isFinite(age) && age > 0);
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    if (maxAge - minAge > SOUL_TOWER_MAX_AGE_GAP) {
      return { ok: false, message: `魂灵塔队伍成员年龄差不能超过 ${SOUL_TOWER_MAX_AGE_GAP} 岁。` };
    }
    return { ok: true, rosterCount: roster.length, minAge, maxAge };
  }

  function validateBattleRuntime(combatData = {}) {
    const rosterCheck = validateSoulTowerRoster(combatData);
    if (rosterCheck.ok) return null;
    const alive = readTeamAlive(combatData);
    return {
      rounds: 0,
      roundStart: Number(combatData?.回合 || 0),
      roundEnd: Number(combatData?.回合 || 0),
      winner: 'unfinished',
      ...alive,
      logs: [`[魂灵塔资格驳回] ${String(rosterCheck.message || '魂灵塔队伍不符合资格')}`],
      extraPatchOps: [],
    };
  }

  function setUnitHp(unit = {}, value = 0) {
    if (!unit || typeof unit !== 'object') return 0;
    const stats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : unit;
    const nextValue = Math.max(0, Math.min(previewRuntime.readHpMax(unit), Number(value || 0)));
    if ('hp' in unit || Object.prototype.hasOwnProperty.call(unit, 'hp')) unit.hp = nextValue;
    else unit.HP = nextValue;
    if (stats && typeof stats === 'object') stats.HP = nextValue;
    return nextValue;
  }

  function finalizeTeamBattle(context = {}) {
    const combatData = context?.combatData || {};
    if (context?.mode !== 'multi_round' || context?.winner !== 'enemy') return;
    if (!['升灵台虚拟战斗', '魂灵塔冲塔'].includes(String(combatData?.战斗类型 || '突发遭遇'))) return;
    (Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player : []).filter(Boolean).forEach(unit => {
      if (previewRuntime.readHp(unit) <= 0) setUnitHp(unit, 1);
    });
    if (Array.isArray(context?.logs)) context.logs.push('[虚拟战败保护] 玩家方全员战败，触发安全协议，强制弹出并锁定HP为 1！');
  }

  function buildRewindRoundSnapshot(unit = {}) {
    if (!unit || typeof unit !== 'object') return null;
    return {
      HP: previewRuntime.readHp(unit),
      体力: previewRuntime.readResource(unit, '体力'),
      魂力: previewRuntime.readResource(unit, '魂力'),
      精神力: previewRuntime.readResource(unit, '精神力'),
      蓄力技能: unit.蓄力技能 ? cloneValue(unit.蓄力技能) : null,
      cast_time: Number(unit.cast_time || 0),
      cast_time_left: Number(unit.cast_time_left || 0),
      蓄力剩余: Number(unit.蓄力剩余 || 0),
      _current_cast_time: Number(unit._current_cast_time || 0),
      action_declared: unit.action_declared === true,
      is_controlled: unit.is_controlled === true,
      __技能限制运行态: cloneValue(unit.__技能限制运行态 || {}),
    };
  }

  function ensureSummonWindowRuntime(summon = {}) {
    if (!summon || typeof summon !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(summon, '召唤窗口运行态')) {
      Object.defineProperty(summon, '召唤窗口运行态', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: {
          windowId: `summon:${String(summon.召唤键 || summon.name || 'unit').trim()}:${Math.max(0, Number(summon.生成回合 || 0))}`,
          consumedActionGrantIds: new Set(),
          consumedWindowGrantIds: new Set(),
        },
      });
    }
    return summon.召唤窗口运行态;
  }

  function syncSummonMirror(summon = {}) {
    const mirror = summon?.__来源状态?.召唤物;
    if (!mirror || typeof mirror !== 'object') return;
    mirror.召唤键 = summon.召唤键;
    mirror.召唤单位类型 = summon.类型;
    mirror.召唤物名称 = previewRuntime.unitName(summon) || '召唤物';
    mirror.行动模式 = summon.行动模式;
    mirror.生命 = previewRuntime.readHp(summon);
    mirror.生命上限 = previewRuntime.readHpMax(summon);
    mirror.精神负载 = Math.max(0, Number(summon.精神负载 || 0));
    mirror.生成回合 = Math.max(0, Number(summon.生成回合 || 0));
    mirror.已消散 = summon.已消散 === true;
  }

  function syncRoundEndUnit(unit = {}) {
    if (!unit || typeof unit !== 'object') return;
    const stats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : unit;
    const syncValue = (runtimeKeys, chineseKey, maxRuntimeKeys, maxChineseKey) => {
      const runtimeKey = runtimeKeys.find(key => Object.prototype.hasOwnProperty.call(unit, key) && unit[key] !== undefined) || runtimeKeys[0];
      const rawValue = unit[runtimeKey] ?? unit[chineseKey] ?? stats[runtimeKey] ?? stats[chineseKey] ?? 0;
      const rawMax = maxRuntimeKeys.map(key => unit[key] ?? stats[key]).find(value => value !== undefined)
        ?? unit[maxChineseKey] ?? stats[maxChineseKey] ?? rawValue ?? 1;
      const maxValue = Math.max(1, Number(rawMax || 1));
      const nextValue = Math.max(0, Math.min(maxValue, Number(rawValue || 0)));
      runtimeKeys.forEach(key => { unit[key] = nextValue; });
      maxRuntimeKeys.forEach(key => { unit[key] = maxValue; });
      unit[chineseKey] = nextValue;
      unit[maxChineseKey] = maxValue;
      if (stats !== unit) {
        stats[chineseKey] = nextValue;
        stats[maxChineseKey] = maxValue;
      }
    };
    syncValue(['sp'], '魂力', ['sp_max'], '魂力上限');
    syncValue(['men'], '精神力', ['men_max'], '精神力上限');
    syncValue(['sta', 'vit'], '体力', ['sta_max', 'vit_max'], '体力上限');
    if (unit.召唤键) syncSummonMirror(unit);
  }

  function removeSummonUnit(combatData = {}, summon = {}, reason = '消散') {
    if (!summon || summon.已消散 === true) return '';
    const host = summon.__宿主;
    writeLedgerEvent(combatData, {
      eventKind: 'summon_end',
      round: Number(combatData?.回合 || 0),
      actorName: previewRuntime.unitName(summon),
      targetName: previewRuntime.unitName(host) || String(summon?.宿主名 || '').trim(),
      actionName: '召唤离场',
      actionType: 'summon_end',
      actionRole: summon?.行动模式 === '协同攻击' || summon?.行动模式 === '护卫' ? 'ASSIST' : 'ACTIVE',
      result: 'ended',
      reasonCode: /窗口|持续|结束/.test(String(reason || '')) ? 'SUMMON_WINDOW_EXHAUSTED' : 'SUMMON_REMOVED',
      meta: {
        source: 'summon',
        reasonText: String(reason || '消散'),
        summonName: previewRuntime.unitName(summon),
        summonHostName: previewRuntime.unitName(host) || String(summon?.宿主名 || '').trim(),
        summonMode: String(summon?.行动模式 || '').trim(),
      },
    });
    summon.已消散 = true;
    syncSummonMirror(summon);
    if (combatData?.召唤单位表 && summon.召唤键) delete combatData.召唤单位表[summon.召唤键];
    if (host?.状态效果 && summon.来源状态键 && host.状态效果[summon.来源状态键]) delete host.状态效果[summon.来源状态键];
    return `[召唤消散] ${previewRuntime.unitName(summon) || '召唤物'}因${reason}离场。`;
  }

  function consumeSummonWindow(combatData = {}, summon = {}, reason = '完成行动窗口', grantId = '') {
    const sourceState = summon?.__来源状态;
    if (!sourceState || typeof sourceState.duration !== 'number' || summon.已消散 === true) return '';
    const runtime = ensureSummonWindowRuntime(summon);
    const windowGrantId = String(grantId || `${runtime?.windowId || 'summon'}:${Math.max(0, Number(combatData?.回合 || 0))}:window`).trim();
    if (runtime?.consumedWindowGrantIds.has(windowGrantId)) return '';
    runtime?.consumedWindowGrantIds.add(windowGrantId);
    sourceState.duration = Math.max(0, Number(sourceState.duration || 0) - 1);
    return sourceState.duration > 0 ? '' : removeSummonUnit(combatData, summon, reason);
  }

  function writeSummonMentalControlEvent(combatData = {}, host = {}, summon = {}, result = '', detail = {}, settlement = requireSettlementPrimitives(), adapterOptions = {}) {
    const summonName = previewRuntime.unitName(summon) || '召唤物';
    if (!combatData || !summonName) return null;
    const hostName = previewRuntime.unitName(host) || previewRuntime.unitName(summon?.__宿主);
    const failReason = String(detail.failReason || detail.failureReason || '召唤控制链受限').trim();
    return writeLedgerEvent(combatData, {
      eventKind: 'blocked_action',
      round: Number(combatData?.回合 || 0),
      actorName: summonName,
      targetName: hostName,
      actionName: '召唤控制',
      actionType: 'summon_control',
      result: String(result || 'limited').trim(),
      failReason,
      targetPoolSide: 'ally',
      meta: {
        source: 'summon',
        primaryOutcome: 'blocked',
        reasonCode: 'SUMMON_CONTROL_OVERLOAD',
        reasonText: String(detail.reasonText || '宿主精神负载不足以稳定控制召唤物').trim(),
        summonName,
        summonType: String(summon?.类型 || '').trim(),
        summonMode: String(summon?.行动模式 || '').trim(),
        summonHostName: hostName,
        summonKey: String(summon?.召唤键 || '').trim(),
        mentalLoad: Math.max(0, Number(summon?.精神负载 || 0)),
        totalMentalLoad: Math.max(0, Number(detail.totalMentalLoad || 0)),
        mentalLimit: Math.max(0, Number(detail.mentalLimit || 0)),
        maintainRatio: Math.max(0, Number(detail.maintainRatio || 0)),
        compression: Math.max(0, Number(detail.compression || 0)),
        restriction: String(detail.restriction || result || '').trim(),
      },
    }, adapterOptions);
  }

  function refreshSummonMentalLoad(combatData = {}, host = {}, settlement = requireSettlementPrimitives(), adapterOptions = {}) {
    const summons = listSummonCombatUnits(combatData).filter(unit => isUnitIdentityMatch(unit?.__宿主, host));
    if (!summons.length) return '';
    if (!isUnitAbleToFight(host)) {
      return summons.map(unit => removeSummonUnit(combatData, unit, '宿主失去战斗能力')).filter(Boolean).join(' ');
    }
    const mentalMax = Math.max(1, Number(host.men_max || host?.属性?.精神力上限 || 1));
    const mental = Math.max(0, Number(host.men ?? host?.属性?.精神力 ?? mentalMax));
    const totalLoad = summons.reduce((sum, unit) => sum + Math.max(0, Number(unit.精神负载 || 0)), 0);
    const mentalLimit = Math.max(20, mentalMax * 0.75);
    const logs = [];
    if (totalLoad > mentalLimit) {
      const compression = Math.max(0.35, mentalLimit / Math.max(1, totalLoad));
      summons.forEach(unit => {
        unit.final = buildCombatFinalStats(unit);
        ['str', 'def', 'agi', 'sp_max', 'men_max'].forEach(key => {
          unit.final[key] = Math.max(1, Math.round(Number(unit.final[key] || unit[key] || 1) * compression));
        });
        unit.__精神压缩 = compression;
        writeSummonMentalControlEvent(combatData, host, unit, 'overload_compressed', {
          failReason: '宿主精神负载过高，召唤物属性被压缩',
          reasonText: '宿主精神负载过高，召唤物属性被压缩',
          restriction: 'compressed',
          totalMentalLoad: totalLoad,
          mentalLimit,
          maintainRatio: mental / mentalMax,
          compression,
        }, settlement, adapterOptions);
      });
      logs.push(`[召唤超载] ${previewRuntime.unitName(host) || '宿主'}召唤负载过高，召唤物属性压缩至${Math.round(compression * 100)}%。`);
    }
    const maintainRatio = mental / mentalMax;
    summons.forEach(unit => {
      unit.__精神维持率 = maintainRatio;
      if (maintainRatio <= 0) {
        writeSummonMentalControlEvent(combatData, host, unit, 'dissipated', {
          failReason: '宿主精神力枯竭，召唤物被强制消散',
          reasonText: '宿主精神力枯竭，召唤物被强制消散',
          restriction: 'dissipated',
          totalMentalLoad: totalLoad,
          mentalLimit,
          maintainRatio,
        }, settlement, adapterOptions);
        logs.push(removeSummonUnit(combatData, unit, '精神力枯竭'));
      } else if (unit.类型 === '深渊生物' && maintainRatio < 0.25) {
        writeSummonMentalControlEvent(combatData, host, unit, 'recalled', {
          failReason: '宿主精神维持不足，召唤物被强制离场',
          reasonText: '宿主精神维持不足，召唤物被强制离场',
          restriction: 'recalled',
          totalMentalLoad: totalLoad,
          mentalLimit,
          maintainRatio,
        }, settlement, adapterOptions);
        logs.push(removeSummonUnit(combatData, unit, '精神维持不足'));
      } else if (maintainRatio < 0.25) {
        unit.__禁用召唤技能 = true;
        writeSummonMentalControlEvent(combatData, host, unit, 'skill_limited', {
          failReason: '宿主精神不足，召唤物技能被禁用',
          reasonText: '宿主精神不足，召唤物只能进行基础行动',
          restriction: 'skill_disabled',
          totalMentalLoad: totalLoad,
          mentalLimit,
          maintainRatio,
        }, settlement, adapterOptions);
        logs.push(`[召唤受限] ${previewRuntime.unitName(unit) || '召唤物'}受宿主精神不足影响，只能进行基础行动。`);
      } else {
        unit.__禁用召唤技能 = false;
      }
    });
    return logs.filter(Boolean).join(' ');
  }

  function beginBattleRound(combatData = {}, currentRound = 0, settlement = requireSettlementPrimitives(), adapterOptions = {}) {
    const runtime = ensureCombatRuntime(combatData);
    runtime.unitReactionCount = {};
    runtime.factionReactionCount = {};
    runtime.counterCount = {};
    listCombatUnits(combatData).forEach(unit => {
      const unitKey = String(unit?.charKey || unit?.char_key || unit?.key || previewRuntime.unitName(unit)).trim();
      if (unit.__battleRuntime && typeof unit.__battleRuntime === 'object') {
        if (unit.__battleRuntime.reactionFatigue) {
          writeLedgerEvent(combatData, {
            eventKind: 'runtime_trace',
            round: Number(combatData?.回合 || 0),
            actorName: previewRuntime.unitName(unit),
            actionName: 'clear_fatigue',
            result: 'cleared',
            primaryOutcome: 'no_effect',
            meta: { traceType: 'clear_fatigue', unitKey },
          }, adapterOptions);
        }
        delete unit.__battleRuntime.reactedCount;
        delete unit.__battleRuntime.counterCount;
        delete unit.__battleRuntime.reactionFatigue;
      }
      delete unit.__本回合闪避成功次数;
      delete unit.__本回合反应预算;
      delete unit.__本回合对轰次数;
      delete unit.__本回合防御承压池;
      delete unit.__本回合对轰覆盖池;
      delete unit.__本回合防御池剩余;
    });
    runtime.reactionFatigue = {};
    runtime.lastRoundStart = Number(combatData?.回合 || 0);
    if (combatData && typeof combatData === 'object') delete combatData.__队伍临时意图;
    listPrimaryCombatUnits(combatData).forEach(unit => { unit.__时光回溯回合快照 = buildRewindRoundSnapshot(unit); });
    const summons = listSummonCombatUnits(combatData);
    summons.forEach(ensureSummonWindowRuntime);
    const hosts = [...new Set(summons.map(unit => unit.__宿主).filter(Boolean))];
    const summonLog = hosts.map(host => refreshSummonMentalLoad(combatData, host, settlement, adapterOptions)).filter(Boolean).join(' ');
    return [`[团战第${currentRound}回合开始]`, summonLog].filter(Boolean);
  }

  function settleBattleRoundEnd(combatData = {}, logs = [], settlement, adapterOptions = {}) {
    listCombatUnits(combatData).forEach(unit => {
      syncRoundEndUnit(unit);
      if (previewRuntime.readHp(unit) <= 0) return;
      const name = previewRuntime.unitName(unit);
      const sustainResult = settlement.settleSustain(unit, name, combatData, adapterOptions) || {};
      const conditionResult = settlement.settleConditions(unit, name, combatData, adapterOptions) || {};
      syncRoundEndUnit(unit);
      if (sustainResult.log) logs.push(`[团战回合尾] ${sustainResult.log}`);
      if (conditionResult.log) logs.push(`[团战回合尾] ${conditionResult.log}`);
    });
    const guardLog = settleGuardSummonWindows(combatData, settlement, adapterOptions);
    if (guardLog) logs.push(`[团战回合尾] ${guardLog}`);
    const rewriteLog = settleRuleRewrite(combatData);
    if (rewriteLog) logs.push(`[团战回合尾] ${rewriteLog}`);
  }

  function settleRuleRewrite(combatData = {}) {
    if (!combatData || !Array.isArray(combatData.__规则改写运行态)) return '';
    const currentRound = Math.max(0, Number(combatData?.回合 || 0));
    const retained = [];
    let expired = 0;
    combatData.__规则改写运行态.forEach(rule => {
      if (!rule || typeof rule !== 'object') return;
      if (Number(rule?.创建回合 || 0) === currentRound && rule.__创建回合已保留 !== true) {
        rule.__创建回合已保留 = true;
        retained.push(rule);
        return;
      }
      rule.剩余回合 = Math.max(0, Number(rule?.剩余回合 || 0) - 1);
      if (rule.剩余回合 > 0) retained.push(rule);
      else expired += 1;
    });
    combatData.__规则改写运行态 = retained;
    return expired > 0 ? `[规则改写] ${expired}条临时规则改写已结束。` : '';
  }

  function settleGuardSummonWindows(combatData = {}, settlement = requireSettlementPrimitives(), adapterOptions = {}) {
    const logs = [];
    const currentRound = Math.max(0, Number(combatData?.回合 || 0));
    listSummonCombatUnits(combatData)
      .filter(unit => String(unit?.行动模式 || '').trim() === '护卫')
      .forEach(unit => {
        const createdRound = Math.max(0, Number(unit?.生成回合 || 0));
        if (currentRound > 0 && createdRound > 0 && currentRound <= createdRound) return;
        const grantId = `${ensureSummonWindowRuntime(unit)?.windowId || 'summon'}:${currentRound}:guard-window`;
        const expiredLog = consumeSummonWindow(combatData, unit, '护卫保护窗口耗尽', grantId);
        if (expiredLog) logs.push(expiredLog);
      });
    return logs.join(' ');
  }

  function createSettlementAdapters(settlement, adapterOptions = {}) {
    return {
      prepare: combatData => prepareBattleRuntime(combatData, settlement, adapterOptions),
      validate: combatData => validateBattleRuntime(combatData),
      beginRound: (combatData, currentRound) => beginBattleRound(combatData, currentRound, settlement, adapterOptions),
      buildQueue: combatData => buildActionQueue(combatData),
      recordQueue() { throw new Error('battle_decision_record_queue_required'); },
      executeQueue: (queue, combatData, currentRound, logs, extraPatchOps) => settlement.executeQueue(queue, combatData, currentRound, logs, extraPatchOps, adapterOptions),
      settleRoundEnd: (combatData, logs) => settleBattleRoundEnd(combatData, logs, settlement, adapterOptions),
      readAlive: combatData => readTeamAlive(combatData),
      evaluateTerminal: context => evaluateBattleTerminal(context, settlement, adapterOptions),
      shouldContinue: context => decideTeamContinuation(context, adapterOptions),
      finalize: context => finalizeTeamBattle(context),
    };
  }

  function runDecisionTeamBattle(options = {}) {
    const combatData = options?.combatData;
    const decide = options?.decide;
    const updateBelief = options?.updateBelief;
    const updatePublicBelief = options?.updatePublicBelief;
    if (!combatData || typeof combatData !== 'object') throw new TypeError('battle_decision_combat_data_missing');
    if (typeof decide !== 'function') throw new TypeError('battle_decide_missing');
    if (typeof updateBelief !== 'function') throw new TypeError('battle_belief_updater_missing');
    if (typeof updatePublicBelief !== 'function') throw new TypeError('battle_public_belief_updater_missing');
    const settlement = options?.settlement || requireSettlementPrimitives();
    const baseAdapters = createSettlementAdapters(settlement, options?.adapterOptions || {});
    const runtime = ensureCombatRuntime(combatData);
    runtime.decisionSimulation = true;
    const decisions = [];
    const beliefObservations = [];
    const pendingBeliefObservations = [];
    const beliefByActor = new Map();
    const strategyByActor = new Map();
    const strategicHistoryByActor = new Map();
    const unitId = unit => String(unit?.id || unit?.角色ID || unit?.name || unit?.名称 || '').trim();
    const unitName = unit => String(unit?.name || unit?.名称 || unitId(unit)).trim();
    const listUnits = currentCombatData => listCombatUnits(currentCombatData);
    const findUnit = (currentCombatData, targetId) => listUnits(currentCombatData).find(unit => isUnitIdentityMatch(unit, targetId));

    const recordMechanicObservations = (actor, decision, currentCombatData, actionRole = 'ACTIVE') => {
      const selected = decision?.selected;
      const observations = Array.isArray(selected?.mechanicObservations) ? selected.mechanicObservations : [];
      if (!observations.length) return;
      const actorId = unitId(actor);
      const actorName = unitName(actor);
      const actionName = normalizeActionDisplayName(selected?.declaration?.skill?.name || selected?.declaration?.skill?.魂技名 || selected?.declaration?.actionKind || '行动');
      const ledgerStart = ensureLedger(currentCombatData).length;
      observations.forEach(observation => {
        const target = findUnit(currentCombatData, observation?.targetId);
        pendingBeliefObservations.push({
          ...observation,
          actorId,
          actorName,
          targetName: unitName(target) || String(observation?.targetId || '').trim(),
          actionName,
          actionRole,
          round: Number(currentCombatData?.回合 || 0),
          ledgerStart,
        });
      });
    };

    const settleMechanicObservations = currentCombatData => {
      const ledger = ensureLedger(currentCombatData);
      const currentRound = Number(currentCombatData?.回合 || 0);
      pendingBeliefObservations.splice(0).forEach(observation => {
        if (Number(observation.round || 0) > currentRound || !observation.stateName) return;
        const event = ledger.slice(Math.max(0, Number(observation.ledgerStart || 0))).find(item =>
          String(item?.eventKind || '').trim() === 'state_apply' &&
          Number(item?.round || 0) === Number(observation.round || 0) &&
          isSameReportName(item?.actorName || '', observation.actorName) &&
          isSameReportName(item?.targetName || '', observation.targetName) &&
          normalizeActionDisplayName(item?.actionName || '') === observation.actionName &&
          String(item?.meta?.stateName || item?.stateName || item?.effectSummary || '').trim() === observation.stateName
        );
        if (!event) return;
        const result = String(event?.result || event?.resultState || event?.meta?.result || '').trim();
        const success = /applied|success|生效|附着/i.test(result) && !/resist|immune|blocked|no_effect|抵抗|免疫|无效/i.test(result);
        const previous = beliefByActor.get(observation.actorId) || {};
        const next = updateBelief(previous, { ...observation, success });
        beliefByActor.set(observation.actorId, next);
        const record = next?.mechanics?.[observation.mechanicKey] || {};
        const posterior = Number(record.alpha || 0) / Math.max(0.0001, Number(record.alpha || 0) + Number(record.beta || 0));
        beliefObservations.push({
          observationType: 'MECHANIC_RESULT',
          round: observation.round,
          actorId: observation.actorId,
          actionRole: observation.actionRole,
          candidateId: observation.sourceActionId,
          mechanicKey: observation.mechanicKey,
          targetId: observation.targetId,
          stateName: observation.stateName,
          success,
          posterior,
          sourceEventId: String(event?.eventId || '').trim(),
        });
        const history = strategicHistoryByActor.get(observation.actorId) || [];
        if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
        strategicHistoryByActor.set(observation.actorId, history);
      });
    };

    const settlePublicObservations = currentCombatData => {
      const ledger = ensureLedger(currentCombatData);
      const currentRound = Number(currentCombatData?.回合 || 0);
      const units = listPrimaryCombatUnits(currentCombatData);
      ledger.filter(event =>
        String(event?.eventKind || '').trim() === 'action_start' &&
        Number(event?.round || 0) === currentRound &&
        normalizeActionRole(event?.actionRole || '') !== 'STATE_TICK'
      ).forEach(actionEvent => {
        const sourceActor = units.find(unit => isUnitIdentityMatch(unit, actionEvent?.actorName || ''));
        if (!sourceActor) return;
        const sourceActorId = unitId(sourceActor);
        const sourceSide = String(actionEvent?.actorSide || '').trim();
        const outcomeEvents = ledger.filter(event =>
          Number(event?.round || 0) === currentRound &&
          String(event?.sourceActionId || event?.actionId || '').trim() === String(actionEvent?.actionId || '').trim() &&
          event !== actionEvent
        );
        const appliedDamage = outcomeEvents.reduce((sum, event) => sum + Math.max(0, Number(event?.appliedDamage || event?.meta?.appliedDamage || event?.meta?.damage || 0)), 0);
        const target = units.find(unit => isUnitIdentityMatch(unit, actionEvent?.targetName || ''));
        const baseActionValue = 100 * appliedDamage / Math.max(1, previewRuntime.readHpMax(target || {}));
        const result = outcomeEvents.map(event => String(event?.result || event?.resultState || '').trim()).filter(Boolean).join('|') || 'declared';
        units.forEach(observer => {
          const observerSide = inferUnitSide(currentCombatData, unitName(observer));
          if (!observerSide || observerSide === sourceSide) return;
          const observerId = unitId(observer);
          const previous = beliefByActor.get(observerId) || {};
          const next = updatePublicBelief(previous, {
            sourceActorId,
            sourceActionId: String(actionEvent?.actionId || '').trim(),
            responseId: normalizeActionDisplayName(actionEvent?.actionName || actionEvent?.actionType || '行动'),
            actionName: normalizeActionDisplayName(actionEvent?.actionName || actionEvent?.actionType || '行动'),
            baseActionValue,
            result,
          });
          beliefByActor.set(observerId, next);
          beliefObservations.push({
            observationType: 'PUBLIC_ACTION',
            round: currentRound,
            actorId: observerId,
            sourceActorId,
            actionName: normalizeActionDisplayName(actionEvent?.actionName || actionEvent?.actionType || '行动'),
            baseActionValue,
            result,
            confidence: Number(next?.confidence || 0),
            sourceEventId: String(actionEvent?.eventId || '').trim(),
          });
          const history = strategicHistoryByActor.get(observerId) || [];
          if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
          strategicHistoryByActor.set(observerId, history);
        });
      });
    };

    const adapters = {
      ...baseAdapters,
      recordQueue(queue = [], currentCombatData = {}, logs = []) {
        const decisionRuntimeState = ensureCombatRuntime(currentCombatData);
        const runDecisionOpportunity = ({ reactor, sourceActor, incomingAction, ratio, actionRole }) => {
          const actorId = unitId(reactor);
          const sourceId = unitId(sourceActor);
          const decision = decide({
            worldSnapshot: currentCombatData,
            actorId,
            actionOpportunity: {
              role: actionRole,
              sequence: Number(currentCombatData?.回合 || 0),
              counterWindow: actionRole === 'COUNTER',
              counterActionAvailable: actionRole === 'COUNTER',
              imminentThreat: actionRole === 'REACTION',
              sourceActorId: sourceId,
              immediateBudget: Math.max(0, Math.floor(Number(ratio || 0) * 40)),
              incomingAction,
            },
            beliefState: beliefByActor.get(actorId) || {},
            strategyMemory: strategyByActor.get(actorId) || {},
            strategicHistory: strategicHistoryByActor.get(actorId) || [],
            seedOffset: decisions.length,
          });
          if (!decision?.selected?.declaration) throw new Error(`battle_decision_${String(actionRole || '').toLowerCase()}_decision_missing:${actorId}`);
          beliefByActor.set(actorId, decision.beliefState || {});
          strategyByActor.set(actorId, decision.strategyMemory || {});
          decisions.push({ round: Number(currentCombatData?.回合 || 0), actorId, actionRole, sourceActorId: sourceId, ...decision });
          recordMechanicObservations(reactor, decision, currentCombatData, actionRole);
          return { actorId, sourceId, decision };
        };
        decisionRuntimeState.decisionReactionDecider = ({ reactor, sourceActor, incomingAction, ratio }) => {
          const cannotReact = reactor?.temp_cannot_react === true || Object.values(reactor?.状态效果 || {}).some(state => {
            const effects = state?.战斗效果 || state?.计算层效果 || {};
            return effects.cannot_react === true || effects.skip_turn === true;
          });
          if (cannotReact) return {
            type: '无法反应', action_type: '无法反应',
            log: `${unitName(reactor) || '目标'}受控制影响，无法应对这次攻击。`,
            skill: null, def_mult: 1.0,
          };
          const { actorId, sourceId, decision } = runDecisionOpportunity({ reactor, sourceActor, incomingAction, ratio, actionRole: 'REACTION' });
          const action = buildDeclarationAction({ ...decision.selected.declaration, targetIds: [sourceId] }, reactor, currentCombatData);
          const reactionKind = String(decision.selected?.declaration?.actionKind || '').trim();
          const reactionType = reactionKind === 'EVADE' ? '伺机闪避' : reactionKind === 'DEFEND' ? '肉体兜底' : action.action_type || action.type || '防御';
          action.type = reactionType;
          action.action_type = reactionType;
          action.log = `[应招决策] ${unitName(reactor) || actorId}选择【${action.skill?.name || action.action_type || '防御'}】应对${unitName(sourceActor) || sourceId}。`;
          return action;
        };
        decisionRuntimeState.decisionCounterDecider = ({ reactor, sourceActor, incomingAction, ratio, counterDepth, counterType, triggerProbability }) => {
          const { actorId, sourceId, decision } = runDecisionOpportunity({ reactor, sourceActor, incomingAction, ratio, actionRole: 'COUNTER' });
          const declaration = { ...decision.selected.declaration };
          if (decision.selected.counterDeclineFallback === true) return {
            type: '防反放弃', action_type: '防反放弃',
            skill: { name: '放弃无效反击', 魂技名: '放弃无效反击', 消耗: '无', 前摇: 0, _效果数组: [] },
            __行为防反: true, __counterDeclined: true, __counterDepth: counterDepth,
            __decisionCandidateId: String(decision.selected.candidateId || '').trim(), __decisionActorId: actorId,
          };
          if (declaration.targetIds?.length === 1) declaration.targetIds = [sourceId];
          const selectedAction = buildDeclarationAction(declaration, reactor, currentCombatData);
          const counterAction = createCounterAction(reactor, {
            防反类型: counterType,
            sourceActionName: String(selectedAction?.skill?.name || selectedAction?.skill?.魂技名 || selectedAction?.name || selectedAction?.action_type || '反击').trim(),
            sourceActionType: String(declaration.actionKind || 'COUNTER').trim(),
            sourceSkill: selectedAction.skill,
            counterDepth,
            触发概率: triggerProbability,
          });
          counterAction.__decisionCandidateId = String(decision.selected.candidateId || '').trim();
          counterAction.__decisionActorId = actorId;
          return counterAction;
        };
        decisionRuntimeState.decisionContinuationDecider = ({ actorEntry, remainingTime }) => {
          const actor = actorEntry?.char;
          const actorId = unitId(actor);
          if (!actorId) throw new Error('battle_decision_continuation_actor_missing');
          const decision = decide({
            worldSnapshot: currentCombatData,
            actorId,
            actionOpportunity: { role: 'ACTIVE', sequence: Number(currentCombatData?.回合 || 0), continuationGrant: true, immediateBudget: Math.max(0, Number(remainingTime || 0)), enforceImmediateBudget: true },
            beliefState: beliefByActor.get(actorId) || {},
            strategyMemory: strategyByActor.get(actorId) || {},
            strategicHistory: strategicHistoryByActor.get(actorId) || [],
            seedOffset: decisions.length,
          });
          if (!decision?.selected?.declaration) throw new Error(`battle_decision_continuation_missing:${actorId}`);
          beliefByActor.set(actorId, decision.beliefState || {});
          strategyByActor.set(actorId, decision.strategyMemory || {});
          decisions.push({ round: Number(currentCombatData?.回合 || 0), actorId, actionRole: 'ACTIVE', continuation: true, ...decision });
          recordMechanicObservations(actor, decision, currentCombatData, 'ACTIVE');
          const action = buildDeclarationAction(decision.selected.declaration, actor, currentCombatData);
          action.source = 'explicit_follow_up';
          action.__chainType = 'FOLLOW_UP';
          action.__followUpParentActionId = '';
          action.__followUpRemainingBudget = Math.max(0, Number(remainingTime || 0));
          return action;
        };
        queue.filter(entry => entry?.char && isUnitAbleToFight(entry.char)).forEach(entry => {
          const lockedAction = decisionRuntimeState.playerLockedNaturalAction;
          const useLockedAction = !!lockedAction && lockedAction.consumed !== true &&
            Number(lockedAction.round || 0) === Number(currentCombatData?.回合 || 0) &&
            isUnitIdentityMatch(entry.char, lockedAction.actorName || '');
          if (useLockedAction) {
            const declaredAction = lockedAction.action || buildDeclarationAction(lockedAction.declaration || {}, entry.char, currentCombatData);
            lockedAction.consumed = true;
            entry.__actorControl = 'PLAYER_LOCKED';
            entry.__declaredRound = Number(currentCombatData?.回合 || 0);
            entry.__declaredAction = declaredAction;
            entry.__declaredActionName = normalizeActionDisplayName(declaredAction?.skill?.name || declaredAction?.skill?.魂技名 || declaredAction?.action_type || '行动');
            entry.__declaredTargetName = String(lockedAction.targetName || declaredAction?.target_name || '').trim();
            entry.__declaredTimingBucket = '10-19';
            const target = findUnit(currentCombatData, entry.__declaredTargetName);
            writeInitialIntent(currentCombatData, entry, target, declaredAction, '10-19');
            logs.push(`[玩家声明] ${unitName(entry.char) || '玩家'}选择【${entry.__declaredActionName}】指向${unitName(target) || entry.__declaredTargetName || '自身'}。`);
            return;
          }
          entry.__actorControl = 'AI_NEXT';
          delete entry.__declaredAction;
          delete entry.__declaredActionName;
          delete entry.__declaredTargetName;
          entry.__declaredRound = 0;
          entry.__decisionResolver = ({ actorEntry, battleState }) => {
            const actor = actorEntry.char;
            const actorId = unitId(actor);
            const decision = decide({
              worldSnapshot: battleState.combatData,
              actorId,
              actionOpportunity: { sequence: Number(battleState.combatData?.回合 || 0) },
              beliefState: beliefByActor.get(actorId) || {},
              strategyMemory: strategyByActor.get(actorId) || {},
              strategicHistory: strategicHistoryByActor.get(actorId) || [],
              seedOffset: decisions.length,
            });
            const declaration = decision?.selected?.declaration;
            if (!declaration) throw new Error(`battle_declaration_missing:${actorId}`);
            const action = buildDeclarationAction(declaration, actor, battleState.combatData);
            const target = findUnit(battleState.combatData, String(declaration?.targetIds?.[0] || '').trim());
            beliefByActor.set(actorId, decision.beliefState || {});
            strategyByActor.set(actorId, decision.strategyMemory || {});
            const history = strategicHistoryByActor.get(actorId) || [];
            const previousCapacity = Number(history.at(-1)?.capacityTotal);
            const previousBeliefRevision = String(history.at(-1)?.beliefRevision || '').trim();
            const currentCapacity = Math.max(0, Number(decision?.stateCapacityTotal || 0));
            const currentBeliefRevision = String(decision?.beliefRevision || '').trim();
            history.push({
              signature: decision.strategicSignature,
              capacityTotal: currentCapacity,
              capacityChangePercent: Number.isFinite(previousCapacity) ? 100 * Math.abs(currentCapacity - previousCapacity) / Math.max(1, previousCapacity) : 100,
              beliefRevision: currentBeliefRevision,
              newInformation: !!previousBeliefRevision && previousBeliefRevision !== currentBeliefRevision,
              pendingEffect: decision?.pendingStrategicEffect === true,
            });
            strategicHistoryByActor.set(actorId, history.slice(-2));
            decisions.push({ round: Number(battleState.combatData?.回合 || 0), actorId, actionRole: 'ACTIVE', ...decision });
            recordMechanicObservations(actor, decision, battleState.combatData, 'ACTIVE');
            writeInitialIntent(battleState.combatData, actorEntry, target, action, '10-19');
            logs.push(`[行动声明] ${unitName(actor) || actorId}选择【${normalizeActionDisplayName(action?.skill?.name || action?.skill?.魂技名 || action?.action_type || '行动')}】指向${unitName(target) || '自身'}。`);
            return { action, targetName: unitName(target) };
          };
        });
      },
      settleRoundEnd(currentCombatData, logs) {
        baseAdapters.settleRoundEnd?.(currentCombatData, logs);
        settleMechanicObservations(currentCombatData);
        settlePublicObservations(currentCombatData);
      },
    };
    const simulation = runTeamBattle({
      combatData,
      mode: options?.mode,
      maxRounds: options?.maxRounds,
      adapters,
    });
    return { ...simulation, decisions, beliefObservations };
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

  function executeDeclaration(input = {}) {
    const combatData = input?.combatData;
    const declaration = input?.declaration;
    if (!combatData || typeof combatData !== 'object') throw new TypeError('battle_declaration_combat_data_missing');
    if (!declaration || typeof declaration !== 'object') throw new TypeError('battle_declaration_missing');
    const actorId = String(declaration?.actorId || '').trim();
    if (!actorId) throw new TypeError('battle_declaration_actor_missing');
    const targetIds = Array.isArray(declaration?.targetIds) ? declaration.targetIds.map(String) : [];
    const skillId = value => String(value?.id || value?.技能ID || value?.魂技ID || value?.name || value?.魂技名 || '').trim();
    const legalCandidate = decisionRuntime.enumerateCandidates({
      worldSnapshot: combatData,
      actorId,
      actionOpportunity: input?.actionOpportunity || { role: 'ACTIVE' },
      beliefState: input?.beliefState || {},
      battleIntent: input?.battleIntent || { mode: String(combatData?.战斗意图 || '').trim() },
    }).find(candidate => {
      const candidateDeclaration = candidate?.declaration || {};
      if (String(candidateDeclaration.actionKind || '').trim() !== String(declaration.actionKind || '').trim()) return false;
      if (skillId(candidateDeclaration.skill) !== skillId(declaration.skill)) return false;
      const candidateTargets = Array.isArray(candidateDeclaration.targetIds) ? candidateDeclaration.targetIds.map(String) : [];
      return candidateTargets.length === targetIds.length && candidateTargets.every((targetId, index) => targetId === targetIds[index]);
    });
    if (!legalCandidate) throw new Error('battle_declaration_mechanically_illegal');
    const seed = Math.max(1, Math.floor(Number(input?.seed || 1)));
    const originalRandom = Math.random;
    let randomState = seed % 2147483647;
    if (randomState <= 0) randomState += 2147483646;
    Math.random = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };
    const runtime = ensureCombatRuntime(combatData);
    runtime.decisionSeed = seed;
    runtime.playerLockedNaturalAction = {
      round: Number(combatData?.回合 || 0) + 1,
      actorName: actorId,
      targetName: String(targetIds[0] || '').trim(),
      declaration: cloneValue(legalCandidate.declaration),
      consumed: false,
    };
    let decisionIndex = 0;
    const decide = payload => decisionRuntime.decide({
      ...payload,
      battleIntent: payload?.battleIntent || input?.battleIntent || {
        mode: String(payload?.worldSnapshot?.战斗意图 || combatData?.战斗意图 || '').trim(),
        objectives: payload?.worldSnapshot?.胜负条件 || combatData?.胜负条件 || {},
      },
      seed: `${seed}:${Number(payload?.worldSnapshot?.回合 || 0)}:${decisionIndex++}:${payload?.seedOffset || 0}`,
    });
    try {
      return runDecisionTeamBattle({
        combatData,
        maxRounds: 1,
        decide,
        updateBelief: decisionRuntime.updateMechanicBelief,
        updatePublicBelief: decisionRuntime.updatePublicObservation,
        mode: 'single_round',
      });
    } finally {
      delete runtime.playerLockedNaturalAction;
      Math.random = originalRandom;
    }
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
    const actionKindNames = {
      BASIC_ATTACK: '普通攻击',
      DEFEND: '防御',
      EVADE: '闪避',
      COUNTER: '反击',
      OBSERVE: '观察',
      GUARD: '保护队友',
      WITHDRAW: '撤退',
      USE_ITEM: '使用物品',
      EQUIP: '穿戴装备',
    };
    if (actionKindNames[text]) return actionKindNames[text];
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
    if (kind === 'action_start') return inferActionRole(event) === 'STATE_TICK' ? 'STATE_TICK' : 'ACTION_DECLARED';
    if (kind === 'charge_start') return 'ACTION_DECLARED';
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

  function inferEffectPrototype(eventKind = '', event = {}) {
    const explicit = String(event?.effectPrototype || event?.meta?.effectPrototype || '').trim();
    if (explicit) return explicit;
    const kind = String(eventKind || event?.eventKind || '').trim();
    if (kind === 'hit_result') return '伤害结算';
    if (kind === 'state_apply') return '状态施加';
    if (kind === 'state_remove') return '状态移除';
    if (kind === 'resource_change') return '资源变化';
    if (kind === 'shield_create' || kind === 'shield_break') return '护盾变化';
    if (kind === 'summon_create') return '召唤生成';
    return '';
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

  function findRecentLedgerAction(ledger = [], criteria = {}) {
    const round = Number(criteria.round || 0);
    const actorName = String(criteria.actorName || '').trim();
    const actionName = normalizeActionDisplayName(criteria.actionName || '');
    if (!(round > 0) || !actorName) return null;
    for (let index = (Array.isArray(ledger) ? ledger.length : 0) - 1; index >= 0; index -= 1) {
      const event = ledger[index];
      if (!event || String(event.eventKind || '').trim() !== 'action_start') continue;
      if (Number(event.round || 0) !== round) continue;
      if (!isSameReportName(String(event.actorName || '').trim(), actorName)) continue;
      if (actionName && normalizeActionDisplayName(event.actionName || '') !== actionName) continue;
      return event;
    }
    return null;
  }

  function findInitialIntentNode(combatData = {}, event = {}) {
    const trace = ensureTrace(combatData?.__父级战斗数据 || combatData);
    const round = Number(event?.round || 0);
    const actorName = String(event?.actorName || '').trim();
    if (!(round > 0) || !actorName) return null;
    const actionName = normalizeActionDisplayName(event?.initialActionName || event?.actionName || event?.sourceActionName || '');
    const targetName = String(event?.targetName || '').trim();
    const candidates = trace.filter(node =>
      String(node?.nodeKind || '').trim() === 'initial_intent' &&
      Number(node?.round || 0) === round &&
      String(node?.actorName || '').trim() === actorName
    );
    if (!candidates.length) return null;
    return candidates.find(node =>
      (!actionName || normalizeActionDisplayName(node?.initialActionName || '') === actionName) &&
      (!targetName || !String(node?.targetName || '').trim() || String(node?.targetName || '').trim() === targetName)
    ) || candidates.find(node =>
      !targetName || !String(node?.targetName || '').trim() || String(node?.targetName || '').trim() === targetName
    ) || candidates[0];
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

  function normalizeStateDisplayName(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const removedMatch = raw.match(/^移除[:：](.+)$/);
    if (removedMatch) return `移除：${normalizeStateDisplayName(removedMatch[1])}`;
    const statLabels = {
      str: '力量',
      def: '防御',
      agi: '敏捷',
      vit: '体力',
      sp: '魂力',
      men: '精神力',
      hp: '生命',
    };
    const statMatch = raw.match(/^(str|def|agi|vit|sp|men|hp)修正$/i);
    if (statMatch) return `${statLabels[statMatch[1].toLowerCase()] || '属性'}调整`;
    if (raw === '反应判定修正') return '反应能力调整';
    if (raw === '结算修正') return '结算效果调整';
    return raw;
  }

  function readLedgerStateName(event = {}) {
    return normalizeStateDisplayName(event?.stateName || event?.meta?.stateName || '');
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
      .filter(event =>
        ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
        normalizeActionRole(event?.actionRole || inferActionRole(event)) !== 'STATE_TICK'
      )
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
      const terminal = [...relatedEvents].reverse().find(event => !['action_start', 'charge_start', 'reaction_window'].includes(String(event?.eventKind || '').trim())) || start;
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

  function serializePublicBlocks(blocks = []) {
    return (Array.isArray(blocks) ? blocks : []).map(block => {
      if (!block || typeof block !== 'object') return '';
      if (block.type === 'text') return String(block.content || '').trim();
      if (block.type !== 'badge') return '';
      const value = Number(block.value || 0);
      if (block.kind === 'damage') return `${value} ${block.unit || 'HP'}`;
      if (block.kind === 'heal') return `+${Math.max(0, value)} ${block.unit || 'HP'}`;
      if (block.kind === 'resource') return `${value > 0 ? '+' : ''}${Math.round(value)} ${block.unit || block.name || '资源'}`;
      if (['item_created', 'summon_created', 'creation', 'cap_reached'].includes(block.kind)) {
        const name = String(block.name || (block.kind === 'cap_reached' ? '上限' : '造物生成')).trim();
        return block.kind === 'cap_reached' ? `【${name}】` : `${value > 0 ? `+${Math.round(value)} ` : ''}${name}`;
      }
      return block.name ? `【${block.name}】` : '';
    }).filter(Boolean).join(' ').trim();
  }

  function normalizePublicEntry(item = {}) {
    const blocks = Array.isArray(item?.blocks) ? item.blocks : (Array.isArray(item) ? item : []);
    if (!blocks.length) return null;
    const text = serializePublicBlocks(blocks);
    return text ? { ...item, blocks, text } : null;
  }

  function projectPublicReportBlocks(eventLedger = []) {
    const supportedKinds = new Set([
      'action_start', 'hit_result', 'state_tick', 'resource_change', 'round_recover', 'state_apply', 'state_remove',
      'summon_create', 'summon_assist', 'shield_create', 'shield_break', 'blocked_action', 'failed_action',
      'battle_objective_resolved', 'create', 'item_consume', 'complete', 'counter', 'dodge', 'defend',
    ]);
    return (Array.isArray(eventLedger) ? eventLedger : []).filter(event => supportedKinds.has(String(event?.eventKind || '').trim())).map(event => {
      const kind = String(event?.eventKind || '').trim();
      const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
      const actor = String(event?.actorName || '行动者').trim();
      const target = String(event?.targetName || '').trim();
      const action = normalizeActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '行动');
      const result = String(event?.resultState || event?.result || event?.actionStatus || '').trim();
      const prefix = round > 0 ? `第${round}回合：` : '';
      const sourceEventId = String(event?.eventId || '').trim();
      const sourceNodeId = String(event?.chainNodeId || event?.nodeId || '').trim();
      const source = { sourceEventId, sourceNodeId, sourceEventIds: sourceEventId ? [sourceEventId] : [], sourceNodeIds: sourceNodeId ? [sourceNodeId] : [] };
      const badges = [];
      let content = '';
      if (kind === 'action_start') content = `${prefix}${actor}对${target || '当前目标'}使出【${action}】。`;
      else if (kind === 'hit_result') {
        const damage = Math.max(0, readLedgerNumber(event, 'damage'));
        content = damage > 0 ? `${prefix}${actor}的【${action}】命中${target || '目标'}，造成${damage}点伤害。` : `${prefix}${actor}的【${action}】未对${target || '目标'}造成伤害（${result || '未命中'}）。`;
        badges.push({ type: 'badge', kind: 'damage', name: '伤害', value: damage, unit: 'HP', targetId: String(event?.targetId || target).trim(), targetName: target, ...source });
      } else if (kind === 'state_tick') {
        const amount = Math.max(0, readLedgerNumber(event, 'amount') || readLedgerNumber(event, 'damage'));
        const stateName = readLedgerStateName(event) || '持续状态';
        const healing = /恢复|heal/i.test(result);
        content = `${prefix}${target || actor}受【${stateName}】结算，${healing ? '恢复' : '损失'}${amount}点${String(event?.meta?.resource || '生命').trim()}。`;
        badges.push({ type: 'badge', kind: healing ? 'heal' : 'damage', name: stateName, value: amount, unit: String(event?.meta?.resource || 'HP').trim(), targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'resource_change' || kind === 'round_recover') {
        const delta = Number(event?.delta ?? event?.meta?.delta ?? event?.meta?.amount ?? event?.amount ?? 0);
        const resource = String(event?.resource || event?.meta?.resource || '资源').trim();
        content = `${prefix}${target || actor}的${resource}${delta >= 0 ? '恢复' : '消耗'}${Math.abs(delta)}点。`;
        badges.push({ type: 'badge', kind: 'resource', name: resource, value: delta, unit: resource, targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'state_apply' || kind === 'state_remove') {
        const stateName = readLedgerStateName(event) || '状态';
        const applied = kind === 'state_apply' && stateWasApplied(event);
        content = `${prefix}${target || actor}${kind === 'state_remove' ? '移除' : applied ? '获得' : '未能获得'}【${stateName}】${result ? `（${result}）` : ''}。`;
        badges.push({ type: 'badge', kind: 'state', name: stateName, value: Number(event?.duration || event?.meta?.duration || 0), unit: '回合', targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'summon_create' || kind === 'summon_assist') {
        const summonName = String(event?.summonName || event?.createdName || actor).trim();
        content = kind === 'summon_create' ? `${prefix}${actor}召出【${summonName}】。` : `${prefix}${summonName}协同攻击${target || '目标'}。`;
        badges.push({ type: 'badge', kind: 'summon_created', name: summonName, value: 1, targetId: String(event?.targetId || target).trim(), targetName: target, ...source });
      } else if (kind === 'shield_create' || kind === 'shield_break') {
        const amount = Math.max(0, Number(event?.amount ?? event?.meta?.amount ?? event?.meta?.shield ?? 0));
        content = `${prefix}${target || actor}的护盾${kind === 'shield_break' ? '破裂' : `增加${amount}点`}。`;
        badges.push({ type: 'badge', kind: 'shield', name: '护盾', value: kind === 'shield_break' ? -amount : amount, unit: '护盾', targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'create' || kind === 'item_consume' || kind === 'complete') {
        const itemName = String(event?.createdName || event?.itemName || event?.meta?.itemName || action).trim();
        content = `${prefix}${actor}${kind === 'item_consume' ? '使用' : kind === 'complete' ? '完成' : '生成'}【${itemName}】。`;
        badges.push({ type: 'badge', kind: kind === 'create' ? 'item_created' : 'state', name: itemName, value: Number(event?.quantity || event?.meta?.quantity || 1), targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'battle_objective_resolved') content = `${prefix}战斗条件已结算：${result || '战斗结束'}。`;
      else if (kind === 'counter') content = `${prefix}${actor}对${target || '目标'}完成反击（${result || '已结算'}）。`;
      else if (kind === 'dodge') content = `${prefix}${actor}${/success|evaded|dodged|成功|闪避/.test(result) ? '成功闪避' : '未能闪避'}${target ? `${target}的攻击` : ''}。`;
      else if (kind === 'defend') content = `${prefix}${actor}完成防御结算（${result || '已防御'}）。`;
      else content = `${prefix}${actor}的【${action}】未能执行（${result || event?.failReason || '动作受阻'}）。`;
      const textBlock = { type: 'text', content, ...source };
      return normalizePublicEntry({ round, blocks: [textBlock, ...badges], projectionSource: 'runtime_ledger_projection' });
    }).filter(Boolean);
  }

  function resolveReportUnitSide(context = {}, unitName = '') {
    const name = String(unitName || '').trim();
    if (!name) return '';
    const participants = context?.combatData?.参战者 || context?.参战者 || {};
    const collect = (sideKey, extras = []) => [
      ...extras,
      ...(Array.isArray(participants?.[sideKey]) ? participants[sideKey] : Object.values(participants?.[sideKey] || {})),
    ].filter(Boolean);
    const playerUnits = collect('team_player', [context?.player, context?.attacker]);
    const enemyUnits = collect('team_enemy', [context?.enemy, context?.defender, context?.target]);
    const matches = unit => isSameReportName(unit?.id || unit?.角色ID || unit?.name || unit?.名称 || '', name);
    if (playerUnits.some(matches)) return 'player';
    if (enemyUnits.some(matches)) return 'enemy';
    return '';
  }

  function resolveNextIntents(input = {}) {
    const combatData = input?.combatData && typeof input.combatData === 'object' ? cloneValue(input.combatData) : null;
    const currentTargets = Array.isArray(input?.currentTargets) ? input.currentTargets : [];
    const describeSide = (sideKey, hostileSideKey, summaries, label) => {
      const team = Array.isArray(combatData?.参战者?.[sideKey]) ? combatData.参战者[sideKey].filter(unit => previewRuntime.isAlive(unit)) : [];
      const opponents = Array.isArray(combatData?.参战者?.[hostileSideKey]) ? combatData.参战者[hostileSideKey].filter(unit => previewRuntime.isAlive(unit)) : [];
      const summaryNames = new Set((Array.isArray(summaries) ? summaries : []).map(unit => String(unit?.name || '').trim()).filter(Boolean));
      const recentDecision = [...(Array.isArray(input?.decisionTrace) ? input.decisionTrace : [])].reverse().find(item => summaryNames.has(String(item?.actorId || item?.actor || item?.行动者 || '').trim()));
      const preferredActorId = String(recentDecision?.actorId || recentDecision?.actor || team[0]?.id || team[0]?.name || '').trim();
      const actor = team.find(unit => previewRuntime.unitId(unit) === preferredActorId || previewRuntime.unitName(unit) === preferredActorId) || team[0] || null;
      const actorName = String(actor?.name || actor?.名称 || summaries?.[0]?.name || label).trim();
      if (!actor) return `${actorName}已失去战斗能力，无法继续行动`;
      if (!opponents.length) return `${actorName}已结束交锋，转入收势与战后确认`;
      const focus = currentTargets.find(pair => isSameReportName(pair?.actor, actorName));
      const before = JSON.stringify(combatData);
      const decision = decisionRuntime.decide({
        worldSnapshot: combatData,
        actorId: previewRuntime.unitId(actor),
        actionOpportunity: { role: 'ACTIVE', sequence: Number(combatData?.回合 || 0) + 1 },
        strategyMemory: focus?.target ? { targetIds: [String(focus.target)] } : {},
        beliefState: {},
        seed: `summary:${Number(combatData?.回合 || 0)}:${label}`,
      });
      if (JSON.stringify(combatData) !== before) throw new Error('battle_summary_preview_mutated_state');
      const selected = decision?.selected;
      if (!selected || selected.rejectionCode) return `${actorName}倾向防守并等待新的有效窗口`;
      const declaration = selected.declaration || {};
      const actionName = normalizeActionDisplayName(declaration?.skill?.name || declaration?.skill?.魂技名 || declaration?.actionKind || '行动');
      const targetId = String(declaration?.targetIds?.[0] || '').trim();
      const target = [...team, ...opponents].find(unit => previewRuntime.unitId(unit) === targetId || previewRuntime.unitName(unit) === targetId);
      const targetText = target ? `针对${previewRuntime.unitName(target)}` : '处理当前战局';
      const effects = Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组 : [];
      if (effects.some(effect => String(effect?.原型 || '').trim() === '召唤生成')) return `${actorName}倾向以【${actionName}】${targetText}，扩大后续行动窗口`;
      if (effects.some(effect => String(effect?.原型 || '').trim() === '状态施加')) return `${actorName}倾向以【${actionName}】${targetText}，压缩对手下一次行动`;
      if (effects.some(effect => ['资源变化', '资源转移'].includes(String(effect?.原型 || '').trim()))) return `${actorName}倾向以【${actionName}】恢复后续有效行动所需资源`;
      if (declaration.actionKind === 'BASIC_ATTACK' || effects.some(effect => String(effect?.原型 || '').trim() === '伤害结算')) return `${actorName}倾向以【${actionName}】${targetText}，兑现当前伤害收益`;
      return `${actorName}倾向以【${actionName}】${targetText}，打开下一行动窗口`;
    };
    return {
      playerIntent: describeSide('team_player', 'team_enemy', input?.playerSummary, '我方'),
      enemyIntent: describeSide('team_enemy', 'team_player', input?.enemySummary, '敌方'),
    };
  }

  function buildReportBlocks(eventLedger = [], decisionTrace = [], publicEntries = []) {
    const ledger = (Array.isArray(eventLedger) ? eventLedger : []).filter(event => event && typeof event === 'object');
    const eventById = new Map(ledger.map(event => [String(event?.eventId || '').trim(), event]).filter(([id]) => id));
    const eventIndexById = new Map(ledger.map((event, index) => [String(event?.eventId || '').trim(), index]).filter(([id]) => id));
    const decisions = (Array.isArray(decisionTrace) ? decisionTrace : []).filter(item => item && typeof item === 'object');
    const entries = (Array.isArray(publicEntries) ? publicEntries : []).map(normalizePublicEntry).filter(Boolean);
    const parentActionByActionId = new Map();
    ledger.forEach(event => {
      if (String(event?.eventKind || '').trim() !== 'action_start') return;
      if (normalizeActionRole(event?.actionRole || inferActionRole(event)) === 'STATE_TICK') return;
      if (normalizeActionRole(event?.actionRole || inferActionRole(event)) === 'ACTIVE') return;
      const actionId = String(event?.actionId || '').trim();
      const sourceActionId = String(event?.sourceActionId || '').trim();
      if (actionId && sourceActionId && actionId !== sourceActionId && !parentActionByActionId.has(actionId)) {
        parentActionByActionId.set(actionId, sourceActionId);
      }
    });
    const resolveRootActionId = (event, fallback = '') => {
      let actionId = String(event?.sourceActionId || event?.actionId || fallback || '').trim();
      const visited = new Set();
      while (actionId && parentActionByActionId.has(actionId) && !visited.has(actionId)) {
        visited.add(actionId);
        actionId = parentActionByActionId.get(actionId);
      }
      return actionId || fallback;
    };
    const factDomainOf = event => {
      const eventKind = String(event?.eventKind || '').trim();
      const actionRole = normalizeActionRole(event?.actionRole || inferActionRole(event));
      if (eventKind === 'state_tick' || eventKind === 'action_start' && actionRole === 'STATE_TICK') return 'state_tick';
      if (actionRole === 'STATE_TICK' || eventKind === 'round_recover') return 'resource_tick';
      if (eventKind === 'resource_change' && !String(event?.sourceActionId || event?.actionId || '').trim()) return 'resource_tick';
      return 'action';
    };
    const readSourceIds = entry => [...new Set((Array.isArray(entry?.blocks) ? entry.blocks : []).flatMap(block => [
      ...(Array.isArray(block?.sourceEventIds) ? block.sourceEventIds : []),
      block?.sourceEventId,
    ]).map(id => String(id || '').trim()).filter(Boolean))];
    const readIntent = (round, actorName, actionName) => {
      const readDecisionActor = item => String(item?.actorId || item?.行动者 || item?.actor || '').trim();
      const readSelected = item => item?.selected || (Array.isArray(item?.候选排序结果) ? item.候选排序结果 : []).find(candidate =>
        ['EXECUTED', 'LOCKED', 'SELECTED'].includes(String(candidate?.candidateStatus || '').trim().toUpperCase())
      ) || null;
      const readSelectedActionName = selected => normalizeActionDisplayName(
        selected?.skill?.name || selected?.skill?.魂技名 || selected?.declaration?.skill?.name || selected?.declaration?.skill?.魂技名 ||
        ({ BASIC_ATTACK: '普通攻击', DEFEND: '防御', EVADE: '闪避', COUNTER: '反击', GUARD: '护卫', WITHDRAW: '撤退', USE_ITEM: '使用物品', EQUIP: '更换装备' })[selected?.declaration?.actionKind || selected?.actionKind] || ''
      );
      const exactDecision = [...decisions].reverse().find(item =>
        Number(item?.回合 || item?.round || 0) === Number(round || 0) &&
        isSameReportName(readDecisionActor(item), actorName || '') &&
        (!actionName || readSelectedActionName(readSelected(item)) === actionName)
      );
      const decision = exactDecision || (!actionName ? [...decisions].reverse().find(item =>
        Number(item?.回合 || item?.round || 0) === Number(round || 0) &&
        isSameReportName(readDecisionActor(item), actorName || '')
      ) : null);
      if (!decision) return '';
      const selected = readSelected(decision);
      const actionKind = String(selected?.declaration?.actionKind || selected?.actionKind || '').trim();
      const problemIds = new Set((Array.isArray(decision?.problems) ? decision.problems : []).map(problem => String(problem?.problemId || '').trim()).filter(Boolean));
      const problemId = String(decision?.problems?.[0]?.problemId || '').trim();
      const problemReason = ({
        TERMINAL_OPPORTUNITY: '把握当前终结窗口',
        SURVIVAL_CRISIS: '降低下一次回应造成的失能风险',
        IMMINENT_DENIAL: '处理即将兑现的蓄力或行动威胁',
        ALLY_CRISIS: '保护当前最危急的队友',
        CAPABILITY_SHORTAGE: '在可用手段受限时保住行动能力',
        ADVANTAGE_WINDOW: '继续扩大已经建立的优势',
        INFORMATION_DEFICIT: '试探尚未确认的敌方回应',
        DISENGAGE_PRESSURE: '避免在不利交换中继续暴露',
        STALEMATE: '打破没有实质进展的僵局',
      })[problemId] || '';
      const alternatives = (Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : []).filter(candidate => candidate?.selected !== true);
      let reason = problemReason;
      if (['BASIC_ATTACK', 'RELEASE_SKILL'].includes(actionKind) && problemIds.has('IMMINENT_DENIAL')) {
        reason = '已评估敌方蓄力风险，当前动作在整体威胁交换中收益更高';
      } else if (actionKind === 'BASIC_ATTACK' && alternatives.some(candidate => candidate?.actionKind === 'RELEASE_SKILL' || candidate?.declaration?.actionKind === 'RELEASE_SKILL')) {
        reason = `${problemReason ? `${problemReason}；` : ''}普通攻击当前能稳定推进，魂技替代的额外收益不足以覆盖代价`;
      } else if (actionKind === 'DEFEND') {
        reason = '承受迫近攻击并保留后续资源';
      } else if (actionKind === 'EVADE') {
        reason = '规避迫近攻击并等待更好的反击窗口';
      } else if (actionKind === 'RELEASE_SKILL') {
        reason = problemReason || '该技能仍能兑现有效伤害、控制或支援窗口，且替代方案更弱';
      } else if (!reason) {
        reason = '在当前可用方案中取得更稳定的有效进展';
      }
      return `${String(actorName || '行动者').trim()}选择【${actionName || readSelectedActionName(selected) || '行动'}】，因为${reason}`;
    };
    const projectFact = event => {
      const kind = String(event?.eventKind || '').trim();
      const actionRole = normalizeActionRole(event?.actionRole || inferActionRole(event));
      const damage = Math.max(0, Math.round(Number(readLedgerNumber(event, 'damage') || 0)));
      const amount = Math.round(Number(event?.meta?.delta ?? readLedgerNumber(event, 'amount') ?? 0));
      const summonName = kind === 'summon_create' ? String(event?.meta?.summonName || event?.summonName || '').trim() : '';
      const targetName = String(event?.targetName || summonName || '').trim();
      return {
        factId: String(event?.eventId || '').trim(),
        factType: kind === 'hit_result' || (kind === 'counter' && damage > 0) ? 'DAMAGE' :
          kind === 'battle_objective_resolved' ? 'BATTLE_OBJECTIVE' :
          kind === 'state_tick' || kind === 'action_start' && actionRole === 'STATE_TICK' ? 'STATE_TICK' :
            ['state_apply', 'state_replace', 'state_remove'].includes(kind) ? 'STATE_CHANGE' :
              kind === 'resource_change' || kind === 'round_recover' ? 'RESOURCE_CHANGE' :
                kind === 'summon_create' || kind === 'summon_assist' ? 'SUMMON' : 'ACTION',
        eventKind: kind,
        actorId: String(event?.actorId || event?.actorName || '').trim(),
        actorName: String(event?.actorName || '').trim(),
        targetId: String(event?.targetId || targetName || '').trim(),
        targetName,
        actionName: normalizeStateDisplayName(normalizeActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '')),
        actionRole,
        resultState: String(event?.result || event?.actionStatus || '').trim(),
        value: damage > 0 ? damage : amount,
        resource: String(event?.meta?.resource || '').trim(),
        stateName: ['state_apply', 'state_replace', 'state_remove', 'state_tick'].includes(kind) ? readLedgerStateName(event) : '',
        duration: Math.max(0, Number(event?.duration || event?.meta?.duration || 0)),
        reasonCode: String(event?.ruleCode || event?.failReason || event?.meta?.reasonCode || '').trim(),
        reasonText: String(event?.meta?.reasonText || '').trim(),
        remainingCastTime: Math.max(0, Number(event?.meta?.remainingCastTime || 0)),
        objectiveReason: kind === 'battle_objective_resolved'
          ? String(event?.meta?.winner || event?.result || '').trim() === 'draw' && event?.meta?.timeLimitReached === true ? 'TIME_LIMIT'
            : Array.isArray(event?.meta?.victoryMatches) && event.meta.victoryMatches.some(Boolean) &&
              Array.isArray(event?.meta?.defeatMatches) && event.meta.defeatMatches.some(Boolean) ? 'CONFLICT'
              : 'CONDITION'
          : '',
        sourceActionId: String(event?.sourceActionId || event?.actionId || '').trim(),
        sourceNodeId: String(event?.chainNodeId || '').trim(),
        segmentIndex: Number(event?.meta?.segmentIndex ?? event?.segmentIndex ?? 0),
      };
    };
    const dedupeFacts = facts => {
      const seen = new Set();
      return (Array.isArray(facts) ? facts : []).filter(fact => {
        const key = String(fact?.factId || '').trim();
        if (!key) throw new Error('battle_report_fact_id_missing');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const summarizeFacts = (facts = []) => {
      const lines = [];
      const push = text => {
        const clean = String(text || '').trim();
        if (clean && !lines.includes(clean)) lines.push(clean);
      };
      const damageGroups = new Map();
      facts.filter(fact => fact?.factType === 'DAMAGE').forEach(fact => {
        const key = [fact.actorName, fact.targetName, fact.actionName, fact.actionRole].map(value => String(value || '').trim()).join('|');
        if (!damageGroups.has(key)) damageGroups.set(key, []);
        damageGroups.get(key).push(fact);
      });
      damageGroups.forEach(group => {
        const first = group[0] || {};
        const actor = first.actorName || '行动者';
        const target = first.targetName || '目标';
        const action = first.actionName || '行动';
        const positive = group.filter(fact => Math.abs(Math.round(Number(fact.value || 0))) > 0);
        const missed = group.filter(fact => /miss|dodge|evade|未命中|闪避|规避/i.test(String(fact.resultState || ''))).length;
        if (positive.length) {
          const values = positive.map(fact => Math.abs(Math.round(Number(fact.value || 0))));
          const total = values.reduce((sum, value) => sum + value, 0);
          const segmentText = positive.length > 1 ? `，共命中 ${positive.length} 段，造成 ${total} 点伤害（分段 ${values.join('、')}）` : `，造成 ${total} 点伤害`;
          if (actor === target && /反噬|自损|代价/.test(action)) push(`${actor}因【${action}】反噬损失 ${total} 点生命值`);
          else if (first.actionRole === 'COUNTER') push(`${actor}以【${action}】完成反击，对${target}${segmentText.replace(/^，/, '')}`);
          else push(`${actor}以【${action}】命中${target}${segmentText}`);
          if (missed > 0) push(`${actor}的【${action}】另有 ${missed} 段未能命中${target}`);
        } else if (missed > 0) {
          push(`${actor}施展【${action}】指向${target}，但未能命中`);
        } else {
          push(`${actor}施展【${action}】指向${target}，但未造成实质伤害`);
        }
      });
      const stateGroups = new Map();
      facts.filter(fact => fact?.factType === 'STATE_CHANGE').forEach(fact => {
        const key = [fact.actorName, fact.targetName, fact.actionName, fact.stateName, fact.sourceActionId]
          .map(value => String(value || '').trim()).join('|');
        if (!stateGroups.has(key)) stateGroups.set(key, []);
        stateGroups.get(key).push(fact);
      });
      stateGroups.forEach(group => {
        const first = group[0] || {};
        const target = first.targetName || '目标';
        const stateName = first.stateName || first.actionName || '状态';
        if (group.some(fact => fact.eventKind === 'state_remove')) {
          push(`${target}的【${stateName}】被移除`);
          return;
        }
        const applied = group.filter(fact => !/resist|抵抗|抵住|immune|免疫/i.test(String(fact.resultState || '')));
        if (applied.length) {
          const duration = Math.max(0, ...applied.map(fact => Number(fact.duration || 0)));
          push(`${target}受到【${stateName}】影响${duration > 0 ? `，剩余 ${duration} 个有效窗口` : ''}`);
          return;
        }
        if (group.some(fact => /immune|免疫/i.test(String(fact.resultState || '')))) push(`${target}免疫【${stateName}】`);
        else push(`${target}抵住了【${stateName}】`);
      });
      facts.forEach(fact => {
        const actor = fact.actorName || '行动者';
        const target = fact.targetName || '目标';
        const action = fact.actionName || '行动';
        const value = Math.abs(Math.round(Number(fact.value || 0)));
        if (fact.factType === 'DAMAGE') return;
        if (fact.factType === 'BATTLE_OBJECTIVE') {
          const winner = String(fact.resultState || '').trim();
          push(winner === 'player' ? '我方胜利条件已经成立，战斗结束' : winner === 'enemy' ? '我方失败条件已经成立，战斗结束' : fact.objectiveReason === 'TIME_LIMIT' ? '达到回合上限，双方未分胜负' : '双方终止条件同时成立，战斗结束');
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
        if (fact.factType === 'STATE_CHANGE') return;
        if (fact.factType === 'SUMMON') {
          push(fact.eventKind === 'summon_assist'
            ? `${actor}执行召唤协同${target ? `，目标为${target}` : ''}`
            : `${actor}生成召唤物${target ? `【${target}】` : ''}`);
          return;
        }
        if (fact.eventKind === 'charge_start') {
          push(`${actor}开始为【${action}】蓄力`);
          return;
        }
        if (fact.eventKind === 'charge_progress') {
          push(`${actor}继续为【${action}】蓄力${fact.remainingCastTime > 0 ? `，剩余前摇 ${fact.remainingCastTime}` : ''}`);
          return;
        }
        if (fact.eventKind === 'lost_opportunity') {
          const reason = fact.reasonCode === 'CONTROLLED_BEFORE_OPPORTUNITY' ? '受控制影响' : (fact.reasonText || '当前状态限制');
          push(`${actor}因${reason}失去本回合行动机会`);
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
      const declared = facts.find(fact => ['action_start', 'charge_start', 'pass'].includes(fact.eventKind));
      if (lines.length && declared?.actionName && !lines.some(line => line.includes(`【${declared.actionName}】`))) {
        lines.unshift(`${declared.actorName || '行动者'}施展【${declared.actionName}】`);
      }
      if (!lines.length) {
        const evaded = facts.find(fact => fact.eventKind === 'dodge' && /evaded|dodge|闪避成功|规避成功/i.test(String(fact.resultState || '')));
        if (declared && evaded) push(`${declared.actorName || '行动者'}的【${declared.actionName || '行动'}】被${evaded.actorName || '目标'}闪避`);
        else if (declared) push(`${declared.actorName || '行动者'}执行【${declared.actionName || '行动'}】${declared.targetName ? `，目标为${declared.targetName}` : ''}`);
      }
      return lines.join('；');
    };
    const groupedEntries = new Map();
    entries.forEach((entry, entryIndex) => {
      const sourceIds = readSourceIds(entry);
      const events = sourceIds.map(id => eventById.get(id)).filter(Boolean);
      const fallbackGroupId = `report_${Number(entry?.round || 0)}_${entryIndex + 1}`;
      const eventsByGroup = new Map();
      events.forEach(event => {
        const rootActionId = resolveRootActionId(event, fallbackGroupId);
        const factDomain = factDomainOf(event);
        const eventRound = Number(event?.round || event?.sourceRound || entry?.round || 0);
        const groupKey = `${eventRound}::${factDomain}::${rootActionId}`;
        if (!eventsByGroup.has(groupKey)) eventsByGroup.set(groupKey, { actionGroupId: factDomain === 'action' ? rootActionId : `${rootActionId}:${factDomain}:${eventRound}`, events: [] });
        eventsByGroup.get(groupKey).events.push(event);
      });
      eventsByGroup.forEach((partition, groupKey) => {
        const groupEvents = partition.events;
        if (!groupedEntries.has(groupKey)) groupedEntries.set(groupKey, { actionGroupId: partition.actionGroupId, events: [], badges: [], firstIndex: entryIndex });
        const group = groupedEntries.get(groupKey);
        group.events.push(...groupEvents);
        const groupEventIds = new Set(groupEvents.map(event => String(event?.eventId || '').trim()).filter(Boolean));
        group.badges.push(...(Array.isArray(entry?.blocks) ? entry.blocks : []).filter(block =>
          block?.type === 'badge' && (!String(block?.sourceEventId || '').trim() || groupEventIds.has(String(block.sourceEventId).trim()))
        ));
      });
    });
    ledger.forEach((event, index) => {
      if (!String(event?.eventKind || '').trim()) return;
      const round = Number(event?.round || event?.sourceRound || 0);
      const factDomain = factDomainOf(event);
      const rootActionId = resolveRootActionId(event, `ledger_${round}_${index + 1}`);
      const actionGroupId = factDomain === 'action' ? rootActionId : `${rootActionId}:${factDomain}:${round}`;
      const groupKey = `${round}::${factDomain}::${rootActionId}`;
      if (!groupedEntries.has(groupKey)) groupedEntries.set(groupKey, { actionGroupId, events: [], badges: [], firstIndex: entries.length + index });
      groupedEntries.get(groupKey).events.push(event);
    });
    const actionBlocks = [...groupedEntries.values()].map((group, index) => {
      const actionGroupId = group.actionGroupId;
      const events = group.events.filter((event, eventIndex, list) => list.findIndex(item =>
        String(item?.eventId || '').trim() === String(event?.eventId || '').trim()
      ) === eventIndex).sort((left, right) =>
        Number(eventIndexById.get(String(left?.eventId || '').trim()) ?? Number.MAX_SAFE_INTEGER) -
        Number(eventIndexById.get(String(right?.eventId || '').trim()) ?? Number.MAX_SAFE_INTEGER)
      );
      const activeDeclarations = events.filter(event =>
        ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) && normalizeActionRole(event?.actionRole || inferActionRole(event)) === 'ACTIVE'
      );
      const primary = activeDeclarations.find(event => readIntent(
        Number(event?.round || 0),
        String(event?.actorName || '').trim(),
        normalizeActionDisplayName(event?.finalActionName || event?.actionName || ''),
      )) || activeDeclarations[0] || events.find(event =>
        ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) && normalizeActionRole(event?.actionRole || inferActionRole(event)) !== 'STATE_TICK'
      ) || events[0] || null;
      const kinds = new Set(events.map(event => String(event?.eventKind || '').trim()));
      const roles = new Set(events.map(event => normalizeActionRole(event?.actionRole || inferActionRole(event))));
      const round = Number(primary?.round || primary?.sourceRound || 0);
      const actorName = String(primary?.actorName || '').trim();
      const actionName = normalizeStateDisplayName(normalizeActionDisplayName(primary?.finalActionName || primary?.actionName || ''));
      const blockType = kinds.has('charge_start') || kinds.has('charge_progress') ? 'ACTION_DECLARED' :
        kinds.has('state_tick') ? 'STATE_TICK' :
        kinds.has('summon_create') || kinds.has('summon_assist') ? 'SUMMON_ACTION' :
          roles.size > 0 && [...roles].every(role => role === 'STATE_TICK') ? 'RESOURCE_CHANGE' :
            roles.has('COUNTER') || kinds.has('counter') ? 'REACTION_RESOLVED' :
              'ACTION_RESOLVED';
      const facts = dedupeFacts(events.map(projectFact));
      const firstEventIndex = Math.min(
        ...events.map(event => eventIndexById.get(String(event?.eventId || '').trim())).filter(Number.isFinite),
        Number.MAX_SAFE_INTEGER,
      );
      const projectedBadges = group.badges
        .map(block => ({
          kind: String(block?.kind || '').trim(),
          name: normalizeStateDisplayName(block?.name || ''),
          value: Number(block?.value || 0),
          unit: String(block?.unit || '').trim(),
          targetId: String(block?.targetId || '').trim(),
          targetName: String(block?.targetName || '').trim(),
          sourceEventId: String(block?.sourceEventId || '').trim(),
          sourceNodeId: String(block?.sourceNodeId || '').trim(),
        }))
        .filter(badge => badge.kind !== 'shield' || badge.value > 0)
        .filter((badge, badgeIndex, list) => list.findIndex(item => [
          item?.kind,
          item?.name,
          item?.value,
          item?.unit,
          item?.targetId || item?.targetName,
        ].map(value => String(value ?? '')).join('|') === [
          badge?.kind,
          badge?.name,
          badge?.value,
          badge?.unit,
          badge?.targetId || badge?.targetName,
        ].map(value => String(value ?? '')).join('|')) === badgeIndex);
      const badges = [...projectedBadges];
      const badgeEventIds = new Set(badges.map(badge => String(badge?.sourceEventId || '').trim()).filter(Boolean));
      facts.forEach(fact => {
        const sourceEventId = String(fact?.factId || '').trim();
        if (!sourceEventId || badgeEventIds.has(sourceEventId)) return;
        const value = Number(fact?.value || 0);
        let badge = null;
        if (fact?.factType === 'DAMAGE' && value > 0) {
          badge = { kind: 'damage', name: '', value: -Math.abs(value), unit: 'HP' };
        } else if (fact?.factType === 'STATE_TICK' && value > 0) {
          badge = { kind: 'damage', name: fact?.stateName || '', value: -Math.abs(value), unit: 'HP' };
        } else if (fact?.factType === 'RESOURCE_CHANGE' && value !== 0) {
          badge = { kind: 'resource', name: fact?.resource || '资源', value, unit: fact?.resource || '资源' };
        } else if (fact?.eventKind === 'shield_create' && value > 0) {
          badge = { kind: 'shield', name: '', value: Math.abs(value), unit: '护盾' };
        }
        if (!badge) return;
        badges.push({
          ...badge,
          targetId: String(fact?.targetId || '').trim(),
          targetName: String(fact?.targetName || '').trim(),
          sourceEventId,
          sourceNodeId: String(fact?.sourceNodeId || '').trim(),
        });
        badgeEventIds.add(sourceEventId);
      });
      const stateWindow = facts.find(fact =>
        fact.duration > 0 && !/resist|抵抗|抵住|immune|免疫/i.test(String(fact?.resultState || ''))
      );
      const summonWindow = events.find(event => ['summon_create', 'summon_assist'].includes(String(event?.eventKind || '').trim()));
      const hasActiveDeclaration = events.some(event =>
        ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) && normalizeActionRole(event?.actionRole || inferActionRole(event)) === 'ACTIVE'
      );
      const nextWindow = summonWindow
        ? String(summonWindow?.meta?.summonMode || summonWindow?.summonMode || '召唤物已进入可用行动窗口').trim()
        : stateWindow
          ? `【${stateWindow.stateName || '状态'}】还剩 ${stateWindow.duration} 个有效窗口`
          : '';
      return {
        __firstEventIndex: firstEventIndex,
        blockId: `report_block_${String(actionGroupId || index + 1).replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_${index + 1}`,
        round,
        actionGroupId,
        actorId: String(primary?.actorId || actorName || '').trim(),
        targetIds: [...new Set(events.map(event => String(event?.targetId || event?.targetName || '').trim()).filter(Boolean))],
        blockType,
        facts,
        badges,
        intentSummary: blockType === 'RESOURCE_CHANGE' || blockType === 'STATE_TICK' || !hasActiveDeclaration
          ? ''
          : readIntent(round, actorName, actionName),
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
      const facts = dedupeFacts(roundEvents.map(projectFact));
      const badges = actionBlocks
        .filter(block => Number(block?.round || 0) === round)
        .flatMap(block => Array.isArray(block?.badges) ? block.badges : [])
        .filter((badge, index, list) => list.findIndex(item =>
          String(item?.sourceEventId || '').trim() === String(badge?.sourceEventId || '').trim() &&
          String(item?.kind || '').trim() === String(badge?.kind || '').trim() &&
          String(item?.targetId || item?.targetName || '').trim() === String(badge?.targetId || badge?.targetName || '').trim()
        ) === index);
      const damageCount = facts.filter(fact => (fact.factType === 'DAMAGE' || fact.factType === 'STATE_TICK') && fact.value > 0).length;
      const resourceCount = facts.filter(fact => fact.factType === 'RESOURCE_CHANGE').length;
      const stateCount = facts.filter(fact => fact.factType === 'STATE_CHANGE').length;
      const summonCount = facts.filter(fact => fact.factType === 'SUMMON').length;
      const intentSummary = actionBlocks
        .filter(block => Number(block?.round || 0) === round && ['ACTION_RESOLVED', 'REACTION_RESOLVED', 'SUMMON_ACTION'].includes(block?.blockType))
        .map(block => String(block?.intentSummary || '').trim())
        .filter(Boolean)
        .join('；');
      const activeState = facts.find(fact =>
        fact.duration > 0 && fact.stateName && !/resist|抵抗|抵住|immune|免疫/i.test(String(fact?.resultState || ''))
      );
      return {
        __firstEventIndex: Number.MAX_SAFE_INTEGER,
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
    return [...actionBlocks, ...roundSummaries]
      .sort((left, right) =>
        Number(left?.round || 0) - Number(right?.round || 0) ||
        (left?.blockType === 'ROUND_SUMMARY' ? 1 : 0) - (right?.blockType === 'ROUND_SUMMARY' ? 1 : 0) ||
        Number(left?.__firstEventIndex ?? Number.MAX_SAFE_INTEGER) - Number(right?.__firstEventIndex ?? Number.MAX_SAFE_INTEGER)
      )
      .map(({ __firstEventIndex, ...block }) => block);
  }

  function buildRoundOverview(result = null, context = {}) {
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
      const targetSide = resolveReportUnitSide(context, target);
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
    const objectives = previewRuntime.normalizeBattleObjectives(combatData?.胜负条件 || {}, combatData || {});
    const describeCondition = condition => {
      const side = condition.side === 'PLAYER' ? '我方' : condition.side === 'ENEMY' ? '敌方' : '';
      const targets = condition.targetIds?.length ? condition.targetIds.join('、') : `${side}全体`;
      if (condition.type === 'TEAM_INCAPACITATED') return `${side}全员失去战斗能力`;
      if (condition.type === 'HP_RATIO_AT_OR_BELOW') return `${targets}生命降至${Math.round(condition.threshold * 100)}%及以下`;
      if (condition.type === 'ROUND_REACHED') return `${side}坚持完成${condition.round}回合`;
      if (condition.type === 'UNIT_DAMAGED') return `${targets}在本场受到伤害`;
      if (condition.type === 'UNIT_INCAPACITATED') return `${targets}失去战斗能力`;
      if (condition.type === 'WITHDRAW_SUCCESS') return `${side}成功撤离`;
      return '条件未识别';
    };
    const objectiveText = {
      victory: objectives.victory.conditions.map(describeCondition).join(objectives.victory.logic === 'ALL' ? '且' : '或'),
      defeat: objectives.defeat.conditions.map(describeCondition).join(objectives.defeat.logic === 'ALL' ? '且' : '或'),
      maxRounds: objectives.maxRounds,
    };
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
      actionState: Math.max(0, Math.round(Number(unit?.hp || 0))) <= 0 ? '失去战斗力' : String(unit?.actionState || unit?.行动状态 || '').trim(),
      states: (Array.isArray(unit?.状态效果) ? unit.状态效果 : [])
        .filter(state => Number(state?.duration || 0) > 0)
        .map(state => ({ name: normalizeStateDisplayName(state?.name || '状态'), duration: Math.max(0, Math.round(Number(state?.duration || 0))), skipTurn: state?.skip_turn === true, dot: Math.max(0, Number(state?.dot || 0)) })),
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
      const alive = units.filter(unit => unit.hp > 0 && !/失去战斗力|昏迷|投降|制服|撤离/.test(unit.actionState)).length;
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
    const playerDefeated = playerMetric.alive <= 0 && playerMetric.total > 0;
    const enemyDefeated = enemyMetric.alive <= 0 && enemyMetric.total > 0;
    const objectiveEvent = [...ledger].reverse().find(event => String(event?.eventKind || '').trim() === 'battle_objective_resolved');
    const objectiveWinner = String(objectiveEvent?.meta?.winner || objectiveEvent?.result || '').trim();
    const objectiveTimedOut = objectiveWinner === 'draw' && objectiveEvent?.meta?.timeLimitReached === true;
    const objectiveConflict = !objectiveTimedOut && objectiveWinner === 'draw' &&
      Array.isArray(objectiveEvent?.meta?.victoryMatches) && objectiveEvent.meta.victoryMatches.some(Boolean) &&
      Array.isArray(objectiveEvent?.meta?.defeatMatches) && objectiveEvent.meta.defeatMatches.some(Boolean);
    const objectiveStatusText = objectiveWinner === 'player' ? '我方胜利' : objectiveWinner === 'enemy' ? '敌方胜利' : objectiveWinner === 'draw' ? '平局' : '';
    const battleEnded = !!objectiveEvent || playerDefeated || enemyDefeated;
    const scoreGap = Number((playerMetric.score - enemyMetric.score).toFixed(2));
    const advantage = objectiveWinner === 'player' || (!objectiveWinner && enemyDefeated) ? 'PLAYER_VICTORY' :
      objectiveWinner === 'enemy' || (!objectiveWinner && playerDefeated) ? 'ENEMY_VICTORY' :
        objectiveWinner === 'draw' ? 'DRAW' :
      scoreGap >= 8 ? 'PLAYER' : scoreGap >= 2 ? 'PLAYER_EDGE' : scoreGap <= -8 ? 'ENEMY' : scoreGap <= -2 ? 'ENEMY_EDGE' : 'EVEN';
    const advantageText = advantage === 'PLAYER_VICTORY' ? '我方获胜' :
      advantage === 'ENEMY_VICTORY' ? '敌方获胜' :
      advantage === 'DRAW' ? objectiveTimedOut ? '达到回合上限，双方未分胜负' : objectiveConflict ? '双方终止条件同时成立，战斗以平局结束' : '战斗以平局结束' :
      advantage === 'PLAYER' ? '我方占优' :
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
        if (!['action_start', 'charge_start', 'hit_result', 'counter', 'state_apply', 'summon_assist'].includes(String(event?.eventKind || '').trim())) continue;
        actors.add(actor);
        pairs.push({ actor, target });
      }
      return pairs;
    };
    const resolvedIntents = battleEnded
      ? advantage === 'DRAW' ? {
          playerIntent: objectiveTimedOut ? '我方未能在回合上限前达成胜利条件，停止交锋' : '我方与敌方同时触发终止条件，停止交锋',
          enemyIntent: objectiveTimedOut ? '敌方同样未在回合上限前终结战斗，停止交锋' : '敌方与我方同时触发终止条件，停止交锋',
        } : {
          playerIntent: advantage === 'ENEMY_VICTORY' ? '我方未能满足战斗目标，转入战后处置' : '我方已满足战斗目标，转入收势与战后确认',
          enemyIntent: advantage === 'PLAYER_VICTORY' ? '敌方已触发我方胜利条件，停止继续行动' : '敌方已满足其阻止条件，转入战后处置',
        }
      : resolveNextIntents({
          combatData, decisionTrace, playerSummary, enemySummary, currentTargets: readCurrentTargets(),
        });
    const { playerIntent, enemyIntent } = resolvedIntents;
    const tacticalWindows = [];
    const risks = [];
    [...playerSummary, ...enemySummary].forEach(unit => {
      const hpRatio = unit.hp / Math.max(1, unit.hpMax);
      const resourceRatio = (unit.sp + unit.vit + unit.men) / Math.max(1, unit.spMax + unit.vitMax + unit.menMax);
      const canAct = unit.hp > 0 && !/失去战斗力|昏迷|投降|制服|撤离/.test(unit.actionState);
      if (canAct && hpRatio <= 0.25) tacticalWindows.push(`${unit.name}生命低于25%，进入斩杀窗口`);
      if (canAct && resourceRatio <= 0.2) risks.push(`${unit.name}可用资源接近枯竭`);
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
    if (battleEnded) {
      tacticalWindows.push(objectiveTimedOut ? '本场已达到回合上限，双方停止交锋' : objectiveEvent ? `胜负条件已成立（${objectiveStatusText}），本场交锋已经结束` : enemyDefeated ? '敌方已失去战斗能力，本场交锋已经结束' : '我方已失去战斗能力，本场交锋已经结束');
      const survivingSide = advantage === 'DRAW' ? [...playerSummary, ...enemySummary] : advantage === 'PLAYER_VICTORY' ? playerSummary : enemySummary;
      const damagedSurvivors = survivingSide.filter(unit => unit.hp > 0 && unit.hp < unit.hpMax);
      if (damagedSurvivors.length) risks.push(`${damagedSurvivors.map(unit => unit.name).join('、')}仍有战损，需要进行战后恢复`);
    } else if (hpRatioGap <= -0.03) {
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
    const formatTeam = units => units.length ? units.map(unit => `${unit.name} HP ${unit.hp}/${unit.hpMax}，魂力 ${unit.sp}/${unit.spMax}，体力 ${unit.vit}/${unit.vitMax}，精神力 ${unit.men}/${unit.menMax}${unit.actionState && unit.actionState !== '战斗' ? `，行动状态 ${unit.actionState}` : ''}${unit.states.length ? `，状态 ${unit.states.map(state => `${state.name}(${state.duration})`).join('、')}` : ''}`).join('；') : '无可行动单位';
    const text = [
      `战至第${round}回合，${advantageText}。`,
      `胜利条件：${objectiveText.victory || '未设置'}；失败条件：${objectiveText.defeat || '未设置'}；回合上限：${objectiveText.maxRounds}。`,
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
        { factType: 'BATTLE_STATE', round, advantage, scoreGap, objectiveStatus: objectiveStatusText, objectiveWinner },
        { factType: 'BATTLE_OBJECTIVES', victory: objectiveText.victory, defeat: objectiveText.defeat, maxRounds: objectiveText.maxRounds },
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
      objectiveStatus: objectiveStatusText,
      objectiveWinner,
      objectives: objectiveText,
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
      objectiveStatus: objectiveStatusText,
      objectiveWinner,
      objectives: objectiveText,
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
        .filter(event => ['action_start', 'charge_start', 'hit_result', 'counter', 'state_apply', 'state_tick', 'resource_change', 'summon_create', 'summon_assist', 'failed_action', 'blocked_action', 'battle_objective_resolved'].includes(String(event?.eventKind || '').trim()))
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
            : ['action_start', 'charge_start'].includes(factType)
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
    const reportBlocks = Array.isArray(payload.reportBlocks) ? payload.reportBlocks.filter(Boolean) : [];
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
      const ids = [value.factId, value.sourceEventId, ...(Array.isArray(value.sourceEventIds) ? value.sourceEventIds : [])]
        .map(item => String(item || '').trim())
        .filter(Boolean);
      ids.forEach(id => {
        if (!sourceProjectionMap.has(id)) sourceProjectionMap.set(id, new Set());
        if (projection) sourceProjectionMap.get(id).add(projection);
      });
      Object.values(value).forEach(item => collectBlockSources(item, projection));
    };
    collectBlockSources(publicReportBlocks);
    collectBlockSources(reportBlocks);

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
    const naturalGrants = new Map();
    actionQueueTrace.forEach((entry, index) => {
      const grantId = String(entry?.grantId || '').trim();
      if (!grantId.startsWith('natural:')) return;
      const key = `${Number(entry?.round || 0)}|${grantId}`;
      if (!naturalGrants.has(key)) naturalGrants.set(key, { enqueued: [], terminal: [] });
      const state = String(entry?.state || '').trim();
      const item = naturalGrants.get(key);
      if (state === 'ENQUEUED') item.enqueued.push(index);
      if (['EXECUTED', 'CANCELLED', 'FATAL'].includes(state)) item.terminal.push({ index, state, reason: String(entry?.reason || '').trim() });
    });
    naturalGrants.forEach((item, key) => {
      if (item.enqueued.length !== 1 || item.terminal.length !== 1) {
        pushFatal('NATURAL_ACTION_OPPORTUNITY_MISSING', {
          grantKey: key,
          enqueuedCount: item.enqueued.length,
          terminalCount: item.terminal.length,
          terminals: item.terminal,
        });
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

    const terminalByActionTarget = new Map();
    eventLedger.forEach(event => {
      const actionId = String(event?.sourceActionId || event?.actionId || '').trim();
      if (!actionId) return;
      const targetId = String(event?.targetId || event?.targetName || '').trim();
      const branchKey = `${actionId}|${targetId || 'NO_TARGET'}`;
      if (!terminalByActionTarget.has(branchKey)) terminalByActionTarget.set(branchKey, { actionId, targetId, dodgeSuccess: [], damage: [] });
      const item = terminalByActionTarget.get(branchKey);
      if (String(event?.eventKind || '').trim() === 'dodge' && isSuccess(event)) item.dodgeSuccess.push(event.eventId);
      if (String(event?.eventKind || '').trim() === 'hit_result' && readDamage(event) > 0) item.damage.push(event.eventId);
    });
    terminalByActionTarget.forEach(item => {
      if (item.dodgeSuccess.length && item.damage.length) pushFatal('ACTION_TERMINAL_CONFLICT', item);
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

    const scoreFields = ['candidateId', 'actionKind', 'actionRole', 'actorId', 'targetIds', 'utilityBefore', 'utilityAfter', 'objectiveUtility', 'normalizedUtility', 'vector', 'rejectionCode', 'classification', 'alternativeGap', 'selected'];
    const vectorFields = ['expectedStateGain', 'terminalUtility', 'objectiveProgress', 'informationValue', 'resourcePreservation', 'survivalLowerBound', 'irreversibleCost', 'catastrophicRisk'];
    const forbiddenSelections = new Set(['ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'DOMINATED', 'ZERO_PROGRESS']);
    scoringAudit.forEach((actionAudit, actionIndex) => {
      const candidates = Array.isArray(actionAudit?.candidates) ? actionAudit.candidates.filter(Boolean) : [];
      if (candidates.length > 3) pushFatal('SCORING_AUDIT_OVERSIZED', { actionIndex, candidateCount: candidates.length });
      candidates.forEach((candidate, candidateIndex) => {
        const missing = scoreFields.filter(key => candidate?.[key] === undefined || candidate?.[key] === null);
        const vector = candidate?.vector && typeof candidate.vector === 'object' ? candidate.vector : null;
        if (vector) missing.push(...vectorFields.filter(key => vector[key] === undefined || vector[key] === null).map(key => `vector.${key}`));
        if (missing.length) {
          pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate?.candidateId || '', missing });
          return;
        }
        const targetIds = Array.isArray(candidate.targetIds) ? candidate.targetIds.map(value => String(value || '').trim()).filter(Boolean) : [];
        if (targetIds.length !== new Set(targetIds).size) {
          pushFatal('SCORING_COMPONENT_DUPLICATED', { actionIndex, candidateIndex, candidateId: candidate.candidateId, targetIds });
        }
        const finiteFields = ['utilityBefore', 'utilityAfter', 'objectiveUtility', 'normalizedUtility'];
        finiteFields.push('alternativeGap');
        const invalidNumbers = finiteFields.filter(key => !Number.isFinite(Number(candidate[key])))
          .concat(vectorFields.filter(key => !Number.isFinite(Number(vector[key]))).map(key => `vector.${key}`));
        if (invalidNumbers.length) {
          pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate.candidateId, invalidNumbers });
          return;
        }
        const expectedUtility = Math.max(-200, Math.min(200,
          Number(vector.expectedStateGain) +
          Number(vector.terminalUtility) +
          Number(vector.objectiveProgress) +
          Number(vector.informationValue) -
          Number(vector.irreversibleCost) -
          Number(vector.catastrophicRisk)
        ));
        if (Math.abs(Number(candidate.objectiveUtility) - expectedUtility) > 1e-6) {
          pushFatal('SCORING_FORMULA_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId: candidate.candidateId,
            expectedUtility,
            actualUtility: Number(candidate.objectiveUtility),
          });
        }
      });
      const selectedCandidates = candidates.filter(candidate => candidate?.selected === true);
      if (selectedCandidates.length !== 1) {
        pushFatal('SCORING_SELECTED_MISSING', { actionIndex, selectedCandidateId: actionAudit?.selectedCandidateId || '', selectedCount: selectedCandidates.length });
      }
      const selected = selectedCandidates[0];
      if (selected) {
        const selectedRejected = String(selected.rejectionCode || '').trim();
        const selectedClassification = String(selected.classification || '').trim();
        if (forbiddenSelections.has(selectedRejected) || ['HARD_INVALID', 'DOMINATED'].includes(selectedClassification)) {
          pushFatal('BANNED_SUBJECTIVE_CANDIDATE_SELECTED', { actionIndex, selectedCandidateId: selected.candidateId, rejectionCode: selectedRejected });
        }
        if (selected?.forcedFallback === true && (
          String(selected?.actionKind || '').trim() !== 'DEFEND' ||
          String(selected?.fallbackReason || '').trim() !== 'NO_ELIGIBLE_CANDIDATE'
        )) {
          pushFatal('BANNED_SUBJECTIVE_CANDIDATE_SELECTED', {
            actionIndex,
            selectedCandidateId: selected.candidateId,
            rejectionCode: 'INVALID_FORCED_FALLBACK',
          });
        }
      }
    });

    const activeStarts = eventLedger.filter(event =>
      ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
      normalizeActionRole(event?.actionRole || 'ACTIVE') === 'ACTIVE'
    );
    const terminalKinds = new Set(['hit_result', 'state_apply', 'resource_change', 'item_consume', 'create', 'summon_create', 'shield_create', 'support', 'defend', 'dodge', 'pass', 'complete', 'blocked_action', 'failed_action', 'target_fail']);
    activeStarts.forEach(start => {
      if (String(start?.eventKind || '').trim() === 'charge_start') return;
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
      const selectedCandidate = (Array.isArray(actionAudit?.candidates) ? actionAudit.candidates : []).find(candidate => candidate?.selected === true);
      if (
        !selectedActionName ||
        normalizeActionRole(selectedCandidate?.actionRole || 'ACTIVE') !== 'ACTIVE' ||
        String(actionAudit?.ruleCode || '').trim() === 'DECISION_INTERFERENCE'
      ) return;
      const matchingStart = activeStarts.find(start =>
        Number(start?.round || 0) === Number(actionAudit?.round || 0) &&
        isSameReportName(start?.actorName || '', actionAudit?.actor || '') &&
        (actionAudit?.continuation === true
          ? String(start?.meta?.chainType || '').trim() === 'FOLLOW_UP'
          : String(start?.meta?.chainType || '').trim() !== 'FOLLOW_UP')
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

  function bindSettlementPrimitives(primitives) {
    const required = [
      'prepare', 'executeQueue',
      'settleSustain', 'settleConditions',
    ];
    if (!primitives || required.some(name => typeof primitives[name] !== 'function')) {
      throw new TypeError('battle_runtime_settlement_primitives_invalid');
    }
    settlementState.primitives = Object.freeze({ ...primitives });
  }

  function requireSettlementPrimitives() {
    if (!settlementState.primitives) throw new Error('battle_runtime_settlement_primitives_missing');
    return settlementState.primitives;
  }

  function buildDecisionAuditRecord(decision = {}) {
    const selected = decision?.selected || {};
    return cloneValue({
      version: decision?.version || '',
      round: Number(decision?.round || 0),
      actorId: String(decision?.actorId || '').trim(),
      actionRole: normalizeActionRole(decision?.actionRole || 'ACTIVE'),
      sourceActorId: String(decision?.sourceActorId || '').trim(),
      continuation: decision?.continuation === true,
      candidateCount: Math.max(0, Number(decision?.candidateCount || 0)),
      paretoCount: Math.max(0, Number(decision?.paretoCount || 0)),
      selected: {
        candidateId: String(selected?.candidateId || '').trim(),
        declaration: selected?.declaration || null,
        utilityBefore: Number(selected?.utilityBefore || 0),
        utilityAfter: Number(selected?.utilityAfter || 0),
        objectiveUtility: Number(selected?.objectiveUtility || 0),
        normalizedUtility: Number(selected?.normalizedUtility || 0),
        vector: selected?.vector || {},
        rejectionCode: String(selected?.rejectionCode || '').trim(),
        classification: String(selected?.classification || 'VIABLE').trim() || 'VIABLE',
        counterDeclineFallback: selected?.counterDeclineFallback === true,
        forcedFallback: selected?.forcedFallback === true,
        fallbackReason: String(selected?.fallbackReason || '').trim(),
      },
      beliefState: decision?.beliefState || {},
      teamIntent: decision?.teamIntent || {},
      problems: Array.isArray(decision?.problems) ? decision.problems : [],
      strategicSignature: String(decision?.strategicSignature || '').trim(),
      stalemate: decision?.stalemate || null,
      stateCapacityTotal: Math.max(0, Number(decision?.stateCapacityTotal || 0)),
      beliefRevision: String(decision?.beliefRevision || '').trim(),
      pendingStrategicEffect: decision?.pendingStrategicEffect === true,
      strategyMemory: decision?.strategyMemory || {},
      scoreAudit: Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [],
      decisionProfile: decision?.decisionProfile || {},
    });
  }

  function runDecisionCase(input = {}) {
    const decision = root.__LWCS_BATTLE_DECISION__;
    const preview = root.__LWCS_BATTLE_PREVIEW__;
    if (!decision || typeof decision.decide !== 'function' || !preview || typeof preview.listUnits !== 'function') {
      throw new Error('battle_runtime_decision_runtime_missing');
    }
    const sourceCombatData = input.combatData && typeof input.combatData === 'object' ? input.combatData : {};
    const sourceSnapshot = JSON.stringify(sourceCombatData);
    const worldSnapshot = cloneValue(sourceCombatData);
    const caseId = String(input.caseId || 'ad_hoc').trim() || 'ad_hoc';
    const mode = String(input.mode || 'single_preview').trim();
    const seed = Math.max(1, Math.floor(Number(input.seed || 1)));
    const decideOnce = (payload, index = 0) => decision.decide({
      ...payload,
      battleIntent: input.battleIntent || payload?.battleIntent || {
        mode: String(payload?.worldSnapshot?.战斗意图 || worldSnapshot?.战斗意图 || '').trim(),
        objectives: payload?.worldSnapshot?.胜负条件 || worldSnapshot?.胜负条件 || {},
      },
      beliefState: payload?.beliefState && Object.keys(payload.beliefState).length
        ? payload.beliefState
        : input.initialBelief?.[payload?.actorId] || input.initialBelief || {},
      seed: `${seed}:${Number(payload?.worldSnapshot?.回合 || 0)}:${index}:${payload?.seedOffset || 0}`,
    });
    if (input.settings?.decisionOnly === true) {
      const decisions = preview.listUnits(worldSnapshot)
        .filter(entry => preview.isAlive(entry.unit))
        .map((entry, index) => decideOnce({
          worldSnapshot,
          actorId: preview.unitId(entry.unit),
          actionOpportunity: input.actionOpportunity || {},
          strategyMemory: input.strategyMemory || {},
        }, index));
      if (JSON.stringify(sourceCombatData) !== sourceSnapshot) throw new Error('PREVIEW_MUTATED_STATE');
      const decisionAudits = decisions.map(buildDecisionAuditRecord);
      return {
        caseId,
        seed,
        mode,
        ledger: [],
        trace: [],
        scoreAudit: decisionAudits.flatMap(item => item.scoreAudit),
        actionChains: [],
        reportBlocks: [],
        roundOverview: [],
        finalBattleReport: null,
        aiSummaryInput: null,
        finalSnapshot: worldSnapshot,
        decisions: decisionAudits,
      };
    }
    const rounds = Math.max(1, Math.min(20, Math.floor(Number(input.rounds || input.settings?.maxRounds || 1))));
    const debugRuntime = ensureCombatRuntime(worldSnapshot);
    debugRuntime.decisionSeed = seed;
    if (input.selectedAction && typeof input.selectedAction === 'object') {
      const selectedAction = cloneValue(input.selectedAction);
      debugRuntime.playerLockedNaturalAction = {
        round: Number(worldSnapshot?.回合 || 0) + 1,
        actorName: String(selectedAction.actor_name || worldSnapshot?.参战者?.team_player?.[0]?.name || '').trim(),
        targetName: String(selectedAction.target_name || '').trim(),
        action: selectedAction,
        consumed: false,
      };
    }
    const initialSnapshot = getBattleSnapshot(worldSnapshot);
    const originalRandom = Math.random;
    const previousIdContext = runtimeIdContext;
    const previousIdSequence = runtimeIdSequence;
    runtimeIdContext = `decision-${seed.toString(36)}`;
    runtimeIdSequence = 0;
    let randomState = seed % 2147483647;
    if (randomState <= 0) randomState += 2147483646;
    Math.random = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };
    try {
      const simulation = runDecisionTeamBattle({
        combatData: worldSnapshot,
        maxRounds: rounds,
        decide: decideOnce,
        updateBelief: decision.updateMechanicBelief,
        updatePublicBelief: decision.updatePublicObservation,
        mode: rounds > 1 ? 'multi_round' : 'single_round',
      });
      const eventLedger = Array.isArray(worldSnapshot.__battleEventLedger) ? worldSnapshot.__battleEventLedger.map(item => cloneAuditSnapshot(item)) : [];
      const resolutionTrace = collectResolutionTrace(worldSnapshot).map(normalizeCausalNode);
      const actionQueueTrace = Array.isArray(worldSnapshot?.__battleRuntime?.actionQueueTrace) ? worldSnapshot.__battleRuntime.actionQueueTrace.map(item => cloneAuditSnapshot(item)) : [];
      const publicReportBlocks = projectPublicReportBlocks(eventLedger).map(item => cloneAuditSnapshot(item));
      const result = {
        preview: true,
        battleMode: rounds > 1 ? 'multi_round' : 'single_round',
        roundsExecuted: Number(simulation?.rounds || 0),
        logs: Array.isArray(simulation?.logs) ? simulation.logs : [],
        combatData: worldSnapshot,
        eventLedger,
        resolutionTrace,
        decisionTrace: [],
        publicReportBlocks,
        snapshot: getBattleSnapshot(worldSnapshot),
      };
      const finalSnapshot = result.snapshot;
      const decisions = Array.isArray(simulation?.decisions) ? simulation.decisions : [];
      const decisionAudits = decisions.map(buildDecisionAuditRecord);
      const beliefObservations = Array.isArray(simulation?.beliefObservations) ? simulation.beliefObservations.map(item => cloneAuditSnapshot(item)) : [];
      const scoreAudit = decisions.flatMap(item => item.scoreAudit || []);
      const scoringAudit = decisions.map(item => ({
        round: Number(item?.round || 0),
        actor: String(item?.actorId || '').trim(),
        actionRole: normalizeActionRole(item?.actionRole || 'ACTIVE'),
        continuation: item?.continuation === true,
        selectedCandidateId: String(item?.selected?.candidateId || '').trim(),
        selectedActionName: normalizeActionDisplayName(
          item?.selected?.declaration?.skill?.name ||
          item?.selected?.declaration?.skill?.魂技名 ||
          item?.selected?.declaration?.actionKind || '',
        ),
        candidates: (Array.isArray(item?.scoreAudit) ? item.scoreAudit : []).map(candidate => cloneAuditSnapshot(candidate)),
      }));
      const actionChains = buildActionChains(eventLedger, resolutionTrace);
      const reportBlocks = buildReportBlocks(eventLedger, decisionAudits, publicReportBlocks);
      const { finalBattleReport, aiSummaryInput } = buildFinalSummary(eventLedger, decisionAudits, finalSnapshot, worldSnapshot);
      const audit = auditFacts({
        eventLedger,
        resolutionTrace,
        publicReportBlocks,
        reportBlocks,
        scoringAudit,
        scoringMutationDetected: false,
        combatData: worldSnapshot,
        initialSnapshot,
        finalSnapshot,
        actionQueueTrace,
        roundsRequested: rounds,
        roundsExecuted: result.roundsExecuted,
      });
      if (JSON.stringify(sourceCombatData) !== sourceSnapshot) throw new Error('PREVIEW_MUTATED_STATE');
      return {
        caseId,
        seed,
        mode,
        roundsRequested: rounds,
        roundsExecuted: result.roundsExecuted,
        inputUnchanged: true,
        scoringMutationDetected: false,
        ledger: eventLedger,
        eventLedger,
        trace: resolutionTrace,
        resolutionTrace,
        scoreAudit,
        scoringAudit,
        decisionTrace: decisionAudits,
        decisions: decisionAudits,
        actionChains,
        actionQueueTrace,
        reportBlocks,
        publicReportBlocks,
        roundOverview: buildRoundOverview(result, { combatData: worldSnapshot }),
        finalBattleReport,
        aiSummaryInput,
        finalSnapshot,
        logs: result.logs,
        initialSnapshot,
        audit,
        beliefObservations,
      };
    } finally {
      Math.random = originalRandom;
      runtimeIdContext = previousIdContext;
      runtimeIdSequence = previousIdSequence;
    }
  }

  function runBattleCase(options = {}) {
    return runDecisionCase(options && typeof options === 'object' ? options : {});
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
    version: '7.3-R6.3',
    actionKinds,
    actionRoles,
    reportBlockTypes,
    prototypeRegistry,
    prototypeRuntimeContract,
    prototypeManifest,
    prototypeOptionMatrix,
    cloneValue,
    nextRuntimeId,
    ensureCombatRuntime,
    getBattleSnapshot,
    ensureLedger,
    attachLedger,
    ensureTrace,
    probabilitySucceeds,
    createActionQueue,
    buildActionQueue,
    buildCombatFinalStats,
    syncSummonUnitMirror,
    writeCombatResource,
    ensureActionDiagnostic,
    registerStateSource,
    findStateSource,
    runTeamBattle,
    runDecisionTeamBattle,
    decideDuelContinuation,
    executeActionNodes,
    executeDeclaration,
    calculateBaseDamage,
    assertEffectList,
    assertSkillEffects,
    bindSettlementPrimitives,
    runDecisionCase,
    runBattleCase,
    auditFacts,
    normalizeActionDisplayName,
    normalizeActionRole,
    normalizeBattleSide,
    inferUnitSide,
    inferEventSides,
    inferActionRole,
    inferFactType,
    inferEffectPrototype,
    inferActionTargetScope,
    normalizeTargetIds,
    normalizeActorControl,
    findRecentLedgerAction,
    findInitialIntentNode,
    normalizeCausalNode,
    writeLedgerEvent,
    writeRoundEndResourceEvent,
    buildMinimalSettlementTrace: 构建事件最小结算轨迹,
    inferStateTickAggregateKind: 读取状态Tick聚合种类,
    cloneAuditSnapshot,
    collectDecisionTrace,
    collectResolutionTrace,
    buildActionChains,
    buildReportBlocks,
    buildRoundOverview,
    buildFinalSummary,
    buildAiNarrativeSummary,
    auditPrototypeCoverage,
    evaluateBattleTerminal,
    readTeamAlive,
    validateSoulTowerRoster,
    ensureSummonWindowRuntime,
    removeSummonUnit,
    consumeSummonWindow,
    refreshSummonMentalLoad,
    beginBattleRound,
    settleGuardSummonWindows,
  });

  root.__LWCS_BATTLE_RUNTIME__ = api;
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SOURCE__ = 'shared';
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SIZE__ = prototypeManifest.length;
})();

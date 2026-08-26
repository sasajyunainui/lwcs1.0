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
  const battleEventContract = root.__LWCS_BATTLE_EVENT_CONTRACT__;
  if (
    !battleEventContract ||
    battleEventContract.schemaVersion !== '8.3-battle-event-contract-1'
  ) {
    throw new Error('battle_runtime_event_contract_missing');
  }
  const SOUL_TOWER_MAX_AGE = 30;
  const SOUL_TOWER_TEAM_LIMIT = 7;
  const SOUL_TOWER_MAX_AGE_GAP = 3;

  const actionKinds = Object.freeze([
    'BASIC_ATTACK', 'PASS_OPPORTUNITY', 'DEFEND', 'EVADE', 'COUNTER', 'OBSERVE',
    'GUARD', 'WITHDRAW', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP',
  ]);
  const actionRoles = Object.freeze(['ACTIVE', 'REACTION', 'COUNTER', 'ASSIST', 'STATE_TICK']);
  const opportunityGrantTypes = Object.freeze([
    'NATURAL_ACTION', 'COUNTER_WINDOW', 'DODGE_WINDOW', 'DEFEND_WINDOW',
    'GUARD_INTERCEPT', 'FOLLOW_UP', 'EXTRA_ACTION', 'ASSIST_WINDOW', 'SELF_TRIGGER',
  ]);
  const resourceTimelineOperations = Object.freeze([
    'PAY', 'RESTORE', 'REDUCE', 'LOCK', 'UNLOCK', 'REFUND',
    'NATURAL_RECOVERY', 'SUSTAIN_COST', 'ITEM_CONSUME',
  ]);
  const resourcePhasePriority = Object.freeze({
    RESTORE: battleEventContract.phasePriority.RESOURCE_RESTORE,
    NATURAL_RECOVERY: battleEventContract.phasePriority.NATURAL_RECOVERY,
    REFUND: battleEventContract.phasePriority.RESOURCE_REFUND,
    UNLOCK: battleEventContract.phasePriority.RESOURCE_UNLOCK,
    REDUCE: battleEventContract.phasePriority.RESOURCE_REDUCE,
    LOCK: battleEventContract.phasePriority.RESOURCE_LOCK,
    PAY: battleEventContract.phasePriority.RESOURCE_PAY,
    SUSTAIN_COST: battleEventContract.phasePriority.SUSTAIN_COST,
    ITEM_CONSUME: 50,
  });
  const sideEffectTriggerSet = new Set(['效果生效后', '命中后', '回合结束时', '效果结束后']);
  const sideEffectTargetSet = new Set(['技能释放者', '效果承受者', '双方']);
  const sideEffectStatusMap = Object.freeze({
    全属性降低: '虚弱', 自损反噬: '反噬', 精神紊乱: '精神紊乱', 魂力反噬: '魂力枯竭',
    命中下降: '精神紊乱', 动作迟缓: '迟缓', 目标错乱: '混乱', 施法僵直: '僵直',
  });
  const sideEffectTypeSet = new Set([
    '全属性降低', '自损反噬', '致死献祭', '精神紊乱', '魂力反噬',
    '命中下降', '动作迟缓', '目标错乱', '施法僵直',
  ]);
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
  let runtimeIdSequence = 0;
  let runtimeIdContext = 'runtime';
  const battleDraftAttestations = new WeakMap();
  const sealedBattlePackageAttestations = new WeakSet();

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function freezeBattleValue(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    if (
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) !== '[object Object]'
    ) {
      throw new Error('BATTLE_COMMIT_HASH_MISMATCH:non_plain_value');
    }
    seen.add(value);
    Object.getOwnPropertyNames(value).forEach(key => {
      freezeBattleValue(value[key], seen);
    });
    return Object.freeze(value);
  }

  function attestBattleDraft(draft) {
    const frozenDraft = freezeBattleValue(draft);
    battleDraftAttestations.set(frozenDraft, Object.freeze({
      schemaVersion: String(frozenDraft?.schemaVersion || '').trim(),
      draftHash: String(frozenDraft?.draftHash || '').trim(),
    }));
    return frozenDraft;
  }

  function verifyBattleDraftAttestation(draft) {
    const attestation = draft && typeof draft === 'object'
      ? battleDraftAttestations.get(draft)
      : null;
    return Boolean(
      attestation &&
      Object.isFrozen(draft) &&
      attestation.schemaVersion === String(draft?.schemaVersion || '').trim() &&
      attestation.draftHash === String(draft?.draftHash || '').trim(),
    );
  }

  function stableSerialize(value, seen = new WeakSet()) {
    if (value === null) return 'null';
    const type = typeof value;
    if (type === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    if (type === 'boolean' || type === 'string') return JSON.stringify(value);
    if (type === 'undefined' || type === 'function' || type === 'symbol') return '';
    if (Array.isArray(value)) {
      if (seen.has(value)) throw new Error('battle_hash_circular_value');
      seen.add(value);
      const serialized = `[${value.map(item => stableSerialize(item, seen)).join(',')}]`;
      seen.delete(value);
      return serialized;
    }
    if (type !== 'object') return JSON.stringify(String(value));
    if (seen.has(value)) throw new Error('battle_hash_circular_value');
    seen.add(value);
    const body = Object.keys(value)
      .filter(key => value[key] !== undefined && typeof value[key] !== 'function' && typeof value[key] !== 'symbol')
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableSerialize(value[key], seen)}`)
      .join(',');
    seen.delete(value);
    return `{${body}}`;
  }

  function hashBattleValue(value) {
    let primary = 0x811c9dc5;
    let secondary = 0x9e3779b9;
    const serialized = stableSerialize(value);
    for (let index = 0; index < serialized.length; index += 1) {
      const code = serialized.charCodeAt(index);
      primary = Math.imul(primary ^ code, 0x01000193);
      secondary = Math.imul(secondary ^ (code + index), 0x85ebca6b);
    }
    return `r74-${(primary >>> 0).toString(16).padStart(8, '0')}${(secondary >>> 0).toString(16).padStart(8, '0')}`;
  }

  function normalizeSideEffectEntry(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const type = String(value.副作用类型 || '').trim();
    if (!sideEffectTypeSet.has(type)) return null;
    const rawTrigger = String(value.触发时机 || '效果生效后').trim();
    const trigger = sideEffectTriggerSet.has(rawTrigger) ? rawTrigger : '效果生效后';
    const rawTarget = String(value.生效对象 || '技能释放者').trim();
    const target = sideEffectTargetSet.has(rawTarget) ? rawTarget : '技能释放者';
    const duration = Math.max(0, Math.round(Number(value.持续回合 || 0)));
    const rawChance = Number(value.触发概率 ?? 1);
    const chance = Number.isFinite(rawChance) ? Math.max(0, Math.min(1, Number(rawChance.toFixed(4)))) : 1;
    const normalized = { 副作用类型: type, 触发时机: trigger, 生效对象: target, 触发概率: chance };
    if (type !== '致死献祭') {
      normalized.持续回合 = duration || 1;
      normalized.副作用状态 = String(value.副作用状态 || sideEffectStatusMap[type] || type).trim();
      if (String(value.数值 ?? '').trim()) normalized.数值 = String(value.数值 ?? '').trim();
      if (String(value.副数值 ?? '').trim()) normalized.副数值 = String(value.副数值 ?? '').trim();
    }
    if (trigger === '效果结束后') {
      const boundState = String(value.关联状态 || '').trim();
      if (boundState) normalized.关联状态 = boundState;
    }
    return normalized;
  }

  function normalizeSideEffectList(value = []) {
    return (Array.isArray(value) ? value : []).map(normalizeSideEffectEntry).filter(Boolean);
  }

  function buildSideEffectPayload(effect = {}) {
    const type = String(effect?.副作用类型 || '').trim();
    const value = Math.abs(readSignedBattleValue(effect?.数值 || '0'));
    const secondaryValue = Math.abs(readSignedBattleValue(effect?.副数值 || '0'));
    const statRatios = {};
    const combatEffects = createEmptyCombatEffectMap();
    if (type === '致死献祭') combatEffects.致死 = true;
    if (type === '全属性降低') {
      const ratio = Math.max(0.01, 1 - (value || 0.1));
      ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => { statRatios[key] = ratio; });
    }
    if (type === '自损反噬') {
      combatEffects.misfortune_backlash_ratio = value || 0.03;
      combatEffects.hit_penalty = Math.max(0.03, (value || 0.03) * 0.5);
    }
    if (type === '精神紊乱') {
      combatEffects.random_target_rate = value || 0.25;
      combatEffects.reaction_penalty = secondaryValue || 0.08;
    }
    if (type === '命中下降') combatEffects.hit_penalty = value || 0.1;
    if (type === '魂力反噬') {
      combatEffects.sp_gain_ratio = -(value || 0.05);
      combatEffects.cost_delta_ratio = secondaryValue || Math.max(0.05, value || 0.05);
    }
    if (type === '动作迟缓') {
      combatEffects.reaction_penalty = value || 0.15;
      combatEffects.dodge_penalty = secondaryValue || 0.1;
      combatEffects.cast_speed_penalty = value || 0.15;
    }
    if (type === '施法僵直') combatEffects.cast_speed_penalty = value || 0.2;
    if (type === '目标错乱') combatEffects.random_target_rate = value || 0.3;
    return { statRatios, combatEffects };
  }

  function negativeEffectIsImmune(unit = {}, entry = {}) {
    const hasImmunity = Object.values(unit?.状态效果 || {}).some(condition => condition?.战斗效果?.无视异常 === true);
    if (!hasImmunity) return false;
    if (String(entry?.类型 || '').trim() === 'debuff') return true;
    return false;
  }

  function findPersistentStateRemoval(unit = {}, stateName = '', stateEntry = {}) {
    return Object.entries(unit?.状态效果 || {}).find(([, condition]) => {
      if (String(condition?.特殊机制标识 || '').trim() !== '持续状态移除') return false;
      const effect = condition?.持续原型效果;
      if (!effect || String(effect?.原型 || '').trim() !== '状态移除') return false;
      const filter = String(effect?.状态 || '').trim();
      if (!filter || filter === '任意状态') return true;
      if (filter === '任意负面') return String(stateEntry?.类型 || '') === 'debuff';
      if (filter === '任意增益') return String(stateEntry?.类型 || '') === 'buff';
      return filter === stateName;
    }) || null;
  }

  function applyRoundEndSideEffect(unit = {}, effect = {}, sourceName = '', combatData = {}) {
    if (!unit || !probabilitySucceeds(Number(effect?.触发概率 ?? 1))) return '';
    const { statRatios, combatEffects } = buildSideEffectPayload(effect);
    const type = String(effect?.副作用类型 || '').trim();
    const timing = String(effect?.触发时机 || '效果生效后').trim();
    if (combatEffects.致死 === true) {
      writeCombatResource(unit, 'hp', 0);
      const reviveLog = previewRuntime.readHp(unit) <= 0 ? triggerRevive(unit, previewRuntime.unitName(unit) || '目标') || '' : '';
      return [
        `[副作用] ${previewRuntime.unitName(unit) || '目标'}触发[${type || '未知副作用'}](${timing})`,
        reviveLog || `[副作用致死] ${previewRuntime.unitName(unit) || '目标'}受到致死反噬，生命归零。`,
      ].filter(Boolean).join(' ');
    }
    const duration = Math.max(1, Number(effect?.持续回合 || 0));
    const stateName = String(effect?.副作用状态 || sideEffectStatusMap[type] || type || '反噬').trim();
    if (!unit.状态效果) unit.状态效果 = {};
    const nextEffects = mergeCombatEffectMaps(createEmptyCombatEffectMap(), combatEffects);
    if (nonDamageConditionNames.has(stateName)) {
      nextEffects.dot_damage = 0;
      nextEffects.dot_damage_ratio = 0;
    }
    const stateEntry = {
      类型: 'debuff', 状态: stateName, 状态名称: stateName, __本回合新附加: true,
      层数: 1, 描述: `由[${sourceName || '技能'}]触发`, duration,
      面板修改比例: statRatios, 面板固定修正: {}, 战斗效果: nextEffects,
    };
    if (negativeEffectIsImmune(unit, stateEntry)) return `[无视异常] ${previewRuntime.unitName(unit) || '目标'}免疫了[${stateName}]副作用。`;
    const persistentRemoval = findPersistentStateRemoval(unit, stateName, stateEntry);
    if (persistentRemoval) return `[持续状态移除] ${previewRuntime.unitName(unit) || '目标'}的[${stateName}]被[${persistentRemoval[0]}]拦截。`;
    unit.状态效果[stateName] = stateEntry;
    if (unit.召唤键) syncSummonMirror(unit);
    return `[副作用] ${previewRuntime.unitName(unit) || '目标'}触发[${type || '未知副作用'}](${timing})`;
  }

  function settleConditionSideEffects(unit = {}, key = '', condition = {}, timing = '', label = '', combatData = {}) {
    const logs = normalizeSideEffectList(condition?.副作用列表 || [])
      .filter(effect => String(effect?.触发时机 || '').trim() === timing)
      .filter(effect => !String(effect?.关联状态 || '').trim() || String(effect?.关联状态 || '').trim() === key)
      .map(effect => applyRoundEndSideEffect(unit, effect, key || label, combatData))
      .filter(Boolean);
    return logs.join(' ');
  }

  function findPrototypeSuppression(unit = {}, prototype = '', field = '', value = '') {
    return field ? findRuleSuppression(unit, prototype, field, value) : findRuleSuppression(unit, prototype, '__none__', '');
  }

  function shieldGateAllowsIncoming(state = {}, incomingEffect = {}, sourceActor = {}) {
    const gate = Math.max(0, Number(state?.对应等级 ?? state?.equivalentLevel ?? 0));
    if (!(gate > 0)) return true;
    const incomingLevel = Math.max(0, Number(
      incomingEffect?.对应等级 ??
      incomingEffect?.等级 ??
      sourceActor?.属性?.等级 ??
      sourceActor?.等级 ??
      sourceActor?.level ??
      0,
    ));
    return !(incomingLevel > 0 && incomingLevel > gate);
  }

  function currentShieldTotal(unit = {}, incomingEffect = {}, sourceActor = {}) {
    const stateTotal = Object.values(unit?.状态效果 || {}).reduce(
      (total, condition) => total + (
        shieldGateAllowsIncoming(condition, incomingEffect, sourceActor)
          ? Math.max(0, Number(condition?.shield_value || 0))
          : 0
      ),
      0,
    );
    if (stateTotal > 0 || Object.values(unit?.状态效果 || {}).some(condition => Number(condition?.shield_value || 0) > 0)) return stateTotal;
    return Math.max(0, Number(unit?.shield ?? unit?.护盾 ?? unit?.护盾值 ?? 0));
  }

  function applyRuntimeShield(unit = {}, shieldAmount = 0, duration = 1, sourceName = '护盾', effect = {}) {
    const amount = previewRuntime.calculateShieldGain(unit, shieldAmount);
    if (!(amount > 0)) return 0;
    if (!unit.状态效果) unit.状态效果 = {};
    const stateName = /护盾|屏障|结界/.test(String(sourceName || '')) ? String(sourceName || '护盾') : `${sourceName || '护盾'}护盾`;
    const existing = unit.状态效果[stateName];
    if (existing) {
      existing.状态 = String(existing.状态 || stateName).trim() || stateName;
      existing.状态名称 = String(existing.状态名称 || stateName).trim() || stateName;
      existing.duration = Math.max(Number(existing.duration || 0), Number(duration || 0));
      existing.shield_value = Math.max(0, Number(existing.shield_value || 0)) + amount;
      if (effect?.对应等级 !== undefined) existing.对应等级 = Math.max(0, Number(effect.对应等级 || 0));
    } else {
      unit.状态效果[stateName] = {
        类型: 'buff', 状态: stateName, 状态名称: stateName, 层数: 1,
        描述: `由[${sourceName || stateName}]附加`, 来源原型摘要: '护盾变化',
        duration: Number(duration || 0), 面板修改比例: { str: 1, def: 1, agi: 1, sp_max: 1 },
        战斗效果: createEmptyCombatEffectMap(), shield_value: amount,
        ...(effect?.对应等级 !== undefined ? { 对应等级: Math.max(0, Number(effect.对应等级 || 0)) } : {}),
      };
    }
    if (unit.召唤键) syncSummonMirror(unit);
    return amount;
  }

  function removeRuntimeShield(unit = {}, rawValue = '-100%') {
    const entries = Object.entries(unit?.状态效果 || {})
      .map(([key, condition]) => ({ key, condition, value: Math.max(0, Number(condition?.shield_value || 0)) }))
      .filter(entry => entry.value > 0)
      .sort((left, right) => right.value - left.value);
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (!(total > 0)) return 0;
    const parsed = readSignedBattleValue(rawValue);
    let remaining = Math.max(0, Math.min(total, /%$/.test(String(rawValue ?? '').trim()) || Math.abs(parsed) <= 1
      ? Math.floor(total * Math.abs(parsed || 1))
      : Math.floor(Math.abs(parsed))));
    let removed = 0;
    entries.forEach(entry => {
      if (!(remaining > 0)) return;
      const amount = Math.min(entry.value, remaining);
      entry.condition.shield_value = Math.max(0, entry.value - amount);
      remaining -= amount;
      removed += amount;
      if (entry.condition.shield_value <= 0) delete unit.状态效果[entry.key];
    });
    if (unit.召唤键) syncSummonMirror(unit);
    return Math.max(0, Math.floor(removed));
  }

  function absorbRuntimeShield(unit = {}, incomingDamage = 0, incomingEffect = {}, sourceActor = {}) {
    let remaining = Math.max(0, Math.floor(Number(incomingDamage || 0)));
    if (!(remaining > 0)) return { absorbed: 0, remainingDamage: 0, depletedStates: [] };
    const entries = Object.entries(unit?.状态效果 || {})
      .map(([key, condition]) => ({
        key,
        condition,
        duration: Math.max(0, Number(condition?.duration ?? condition?.持续回合 ?? 0)),
        value: Math.max(0, Number(condition?.shield_value || 0)),
      }))
      .filter(entry => entry.value > 0 && shieldGateAllowsIncoming(entry.condition, incomingEffect, sourceActor))
      .sort((left, right) => left.duration - right.duration || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    const depletedStates = [];
    let absorbed = 0;
    entries.forEach(entry => {
      if (!(remaining > 0)) return;
      const amount = Math.min(entry.value, remaining);
      entry.condition.shield_value = Math.max(0, entry.value - amount);
      remaining -= amount;
      absorbed += amount;
      if (entry.condition.shield_value <= 0) {
        depletedStates.push(entry.key);
        delete unit.状态效果[entry.key];
      }
    });
    if (!entries.length) {
      const direct = Math.max(0, Number(unit?.shield ?? unit?.护盾 ?? unit?.护盾值 ?? 0));
      const directAbsorbed = Math.min(direct, remaining);
      absorbed += directAbsorbed;
      const next = Math.max(0, direct - directAbsorbed);
      unit.shield = next;
      unit.护盾 = next;
      remaining -= directAbsorbed;
    }
    if (unit.召唤键) syncSummonMirror(unit);
    return { absorbed, remainingDamage: remaining, depletedStates };
  }

  function mergeRuntimeCondition(existing = null, next = {}, effect = {}) {
    if (!existing || typeof existing !== 'object') {
      return { applied: true, mergeKind: 'NEW', oldDuration: 0, newDuration: Math.max(0, Number(next?.duration ?? next?.持续回合 ?? 0)), state: next };
    }
    const rule = String(effect?.覆盖规则 || '').trim();
    const refreshAllowed = !/(?:不可|禁止|不允许|无法|不再)\s*刷新|不刷新|维持原(?:持续|时长)/.test(rule);
    const stackingAllowed = !/(?:不可|禁止|不允许|无法)\s*(?:叠加|累加)|(?:叠加|累加)\s*(?:不可|禁止)/.test(rule) && /叠加|累加|层数/.test(rule);
    const layerMatch = rule.match(/(?:上限|最多|最高)?\s*(\d+)\s*层/);
    const rawLayerLimit = Number(effect?.叠加上限 ?? effect?.最大层数 ?? layerMatch?.[1]);
    const layerLimit = Number.isFinite(rawLayerLimit) && rawLayerLimit > 0 ? Math.max(1, Math.floor(rawLayerLimit)) : Infinity;
    const oldDuration = Math.max(0, Number(existing?.duration ?? existing?.持续回合 ?? 0));
    const newDuration = Math.max(0, Number(effect?.持续回合 ?? next?.duration ?? 0));
    const oldLayers = Math.max(1, Number(existing?.层数 || 1));
    const oldTier = Number(existing?.状态位阶 ?? existing?.位阶 ?? existing?.强度 ?? 0);
    const newTier = Number(effect?.状态位阶 ?? effect?.位阶 ?? effect?.强度 ?? 0);
    if (Number.isFinite(newTier) && Number.isFinite(oldTier) && newTier > oldTier) {
      return { applied: true, mergeKind: 'REPLACE', oldDuration, newDuration, state: next };
    }
    if (stackingAllowed && oldLayers < layerLimit) {
      const ratios = { ...(existing?.面板修改比例 || {}) };
      Object.entries(next?.面板修改比例 || {}).forEach(([key, value]) => { ratios[key] = Number(ratios[key] ?? 1) * Number(value ?? 1); });
      const fixed = { ...(existing?.面板固定修正 || {}) };
      Object.entries(next?.面板固定修正 || {}).forEach(([key, value]) => { fixed[key] = Number(fixed[key] || 0) + Number(value || 0); });
      const duration = refreshAllowed ? Math.max(oldDuration, newDuration) : oldDuration;
      return { applied: true, mergeKind: 'STACK', oldDuration, newDuration: duration, state: {
        ...existing, ...next, 层数: oldLayers + 1, duration,
        __本回合新附加: existing?.__本回合新附加 === true,
        shield_value: Math.max(0, Number(existing?.shield_value || 0)) + Math.max(0, Number(next?.shield_value || 0)),
        面板修改比例: ratios, 面板固定修正: fixed,
        战斗效果: mergeCombatEffectMaps(existing?.战斗效果 || createEmptyCombatEffectMap(), next?.战斗效果 || {}),
      } };
    }
    const duration = refreshAllowed ? Math.max(oldDuration, newDuration) : oldDuration;
    if (duration <= oldDuration) {
      return { applied: false, mergeKind: 'NO_EFFECT', oldDuration, newDuration: oldDuration, state: existing };
    }
    return { applied: true, mergeKind: 'REFRESH_EXTENSION', oldDuration, newDuration: duration, state: {
      ...existing,
      来源技能: next?.来源技能 || existing?.来源技能 || '', 来源角色: next?.来源角色 || existing?.来源角色 || '',
      描述: next?.描述 || existing?.描述 || '', duration,
      __本回合新附加: existing?.__本回合新附加 === true,
    } };
  }

  function settleDelayedEffect(
    unit = {},
    effect = {},
    label = '目标',
    combatData = null,
    sourceContext = {},
  ) {
    if (!unit || !effect || typeof effect !== 'object') return '';
    if (!unit.状态效果) unit.状态效果 = {};
    const prototype = String(effect?.原型 || '').trim();
    const valueText = String(effect?.数值 ?? '').trim();
    const value = readSignedBattleValue(valueText || effect?.威力倍率 || 0);
    const formalCombatData =
      combatData &&
      typeof combatData === 'object' &&
      (combatData.参战者 || combatData.__父级战斗数据 || combatData.__battleEventLedger)
        ? combatData
        : null;
    const sourceCondition = sourceContext?.condition && typeof sourceContext.condition === 'object'
      ? sourceContext.condition
      : {};
    const sourceActionId = String(
      sourceContext?.sourceActionId ||
      sourceCondition?.来源动作ID ||
      sourceCondition?.sourceActionId ||
      '',
    ).trim();
    const sourceEffectId = String(
      sourceContext?.sourceEffectId ||
      sourceCondition?.来源效果ID ||
      sourceCondition?.sourceEffectId ||
      '',
    ).trim();
    const sourceActorName = String(
      sourceContext?.actorName ||
      sourceCondition?.来源角色 ||
      effect?.来源角色 ||
      '',
    ).trim();
    const actionName = String(
      sourceContext?.actionName ||
      sourceCondition?.来源技能 ||
      effect?.来源技能 ||
      sourceContext?.stateName ||
      '延迟效果',
    ).trim();
    const childFacts = [];
    const factBase = {
      round: Number(formalCombatData?.回合 || 0),
      actorId: String(sourceContext?.actorId || sourceActorName).trim(),
      actorName: sourceActorName,
      targetId: previewRuntime.unitId(unit),
      targetName: previewRuntime.unitName(unit) || label,
      actionName,
      actionType: 'DELAYED_EFFECT',
      actorControl: 'SYSTEM',
      actionRole: 'STATE_TICK',
      actionId: sourceActionId,
      sourceActionId,
      sourceEffectId,
      effectPrototype: prototype,
    };
    const writeFact = payload => {
      if (!formalCombatData) return null;
      const fact = writeLedgerEvent(formalCombatData, { ...factBase, ...payload });
      if (fact) childFacts.push(fact);
      return fact;
    };
    const finish = log => {
      if (formalCombatData) {
        writeLedgerEvent(formalCombatData, {
          ...factBase,
          eventKind: 'effect_resolved',
          result: childFacts.length ? 'resolved' : 'no_effect',
          resultState: childFacts.length ? 'SUCCESS' : 'NO_EFFECT',
          factType: prototypeRuntimeContract[prototype]?.factTypes?.[0] || 'EFFECT',
          primaryOutcome: childFacts.length ? 'delayed_effect_resolved' : 'no_effect',
          operation: 'WRAP',
          meta: {
            source: 'delayed_effect_settlement',
            wrapperOnly: true,
            childEventIds: childFacts.map(fact => fact.eventId),
            stateName: String(sourceContext?.stateName || '').trim(),
            operation: 'WRAP',
          },
        });
      }
      return log;
    };

    if (prototype === '伤害结算') {
      const damageType = String(effect?.伤害类型 || '近身攻击').trim() || '近身攻击';
      const multiplier = Math.max(1, Number(effect?.威力倍率 || 100));
      const requestedDamage = /真实/.test(damageType)
        ? Math.max(1, Math.floor(previewRuntime.readHpMax(unit) * Math.min(1, multiplier / 1000)))
        : Math.max(1, Math.floor(previewRuntime.readHpMax(unit) * Math.min(1, multiplier / 1800)));
      const before = previewRuntime.readHp(unit);
      writeCombatResource(unit, 'hp', before - requestedDamage);
      const after = previewRuntime.readHp(unit);
      const appliedDamage = Math.max(0, before - after);
      if (appliedDamage > 0) {
        writeFact({
          eventKind: 'state_tick',
          result: 'dot',
          resultState: 'SUCCESS',
          factType: 'STATE_TICK',
          primaryOutcome: 'delayed_damage',
          appliedDamage,
          operation: 'DAMAGE',
          meta: {
            source: 'delayed_effect_settlement',
            stateName: String(sourceContext?.stateName || actionName).trim(),
            damageType,
            before,
            after,
            delta: -appliedDamage,
            amount: appliedDamage,
            appliedDamage,
            operation: 'DAMAGE',
          },
        });
      }
      return finish(appliedDamage > 0 ? `[延迟效果] ${label}受到${appliedDamage}点${damageType}。` : '');
    }
    if (prototype === '资源变化') {
      const resourceText = Array.isArray(effect?.资源)
        ? effect.资源.map(value => String(value || '').trim()).filter(Boolean).join('、')
        : String(effect?.资源 || '').trim();
      const resourceKeys = persistentResourceKeys(effect?.资源 || '');
      const logs = [];
      resourceKeys.forEach(resourceKey => {
        const resourceLabel = persistentResourceLabel(resourceKey);
        const current = resourceKey === 'hp'
          ? previewRuntime.readHp(unit)
          : previewRuntime.readResource(unit, resourceLabel);
        const maximum = resourceKey === 'hp'
          ? previewRuntime.readHpMax(unit)
          : previewRuntime.readResourceMax(unit, resourceLabel);
        const delta = /%$/.test(valueText) || Math.abs(value) <= 1
          ? Math.floor(maximum * value)
          : Math.floor(value);
        const next = Math.max(0, Math.min(maximum, current + delta));
        const actual = next - current;
        if (!actual) return;
        if (findResourceSuppression(unit, resourceLabel)) {
          logs.push(`[机制抹消] ${label}对【资源变化 资源:${resourceLabel}】存在封锁，延迟资源变化未能落地。`);
          return;
        }
        writeCombatResource(unit, resourceKey, next);
        writeFact({
          eventKind: 'resource_change',
          result: actual > 0 ? 'gain' : 'loss',
          resultState: actual > 0 ? 'GAIN' : 'LOSS',
          factType: 'RESOURCE',
          primaryOutcome: actual > 0 ? 'resource_restored' : 'resource_reduced',
          operation: actual > 0 ? 'RESTORE' : 'REDUCE',
          meta: {
            source: 'delayed_effect_settlement',
            resource: resourceLabel,
            resourceKey,
            before: current,
            after: next,
            delta: actual,
            amount: Math.abs(actual),
            operation: actual > 0 ? 'RESTORE' : 'REDUCE',
          },
        });
        logs.push(`[延迟效果] ${label}${actual >= 0 ? '恢复' : '损失'}${Math.abs(actual)}点${resourceLabel}。`);
      });
      return finish(logs.join(' ') || (resourceText ? '' : ''));
    }
    if (prototype === '护盾变化') {
      if (findPrototypeSuppression(unit, prototype)) {
        return finish(`[机制抹消] ${label}对【护盾变化】存在封锁，延迟护盾变化未能落地。`);
      }
      const before = currentShieldTotal(unit);
      if (value >= 0) {
        const amount = /%$/.test(valueText) || Math.abs(value) <= 1 ? Math.floor(previewRuntime.readHpMax(unit) * Math.abs(value)) : Math.floor(Math.abs(value));
        const applied = applyRuntimeShield(unit, amount, Math.max(1, Number(effect?.持续回合 || 1)), '延迟护盾', effect);
        const after = currentShieldTotal(unit);
        if (applied > 0) {
          writeFact({
            eventKind: 'shield_create',
            result: 'created',
            resultState: 'GAIN',
            factType: 'SHIELD',
            primaryOutcome: 'shield_created',
            operation: 'CREATE',
            meta: {
              source: 'delayed_effect_settlement',
              stateName: '延迟护盾',
              before,
              after,
              amount: applied,
              delta: applied,
              operation: 'CREATE',
            },
          });
        }
        return finish(applied > 0 ? `[延迟效果] ${label}获得${applied}点护盾。` : '');
      }
      if (!(before > 0)) return finish('');
      const removed = removeRuntimeShield(unit, valueText || effect?.数值 || '-100%');
      const after = currentShieldTotal(unit);
      if (removed > 0) {
        writeFact({
          eventKind: 'shield_break',
          result: 'reduced',
          resultState: 'LOSS',
          factType: 'SHIELD',
          primaryOutcome: 'shield_reduced',
          operation: 'REDUCE',
          meta: {
            source: 'delayed_effect_settlement',
            before,
            after,
            amount: removed,
            delta: -removed,
            remainingShield: after,
            operation: 'REDUCE',
          },
        });
      }
      return finish(removed > 0 ? `[延迟效果] ${label}被削减${removed}点护盾。` : '');
    }
    if (prototype === '属性修正') {
      const attribute = String(effect?.属性 || '').trim();
      if (!attribute || !value) return finish('');
      if (findPrototypeSuppression(unit, prototype, '属性', attribute)) {
        return finish(`[机制抹消] ${label}对【属性修正 属性:${attribute}】存在封锁，延迟属性修正未能落地。`);
      }
      const runtimeKey = { 力量: 'str', 防御: 'def', 敏捷: 'agi', 体力上限: 'vit_max', 魂力上限: 'sp_max', 精神力上限: 'men_max' }[attribute] || attribute;
      const percentage = /%$/.test(valueText);
      const stateName = `延迟属性:${attribute || runtimeKey}`;
      const before = unit.状态效果[stateName] ? cloneValue(unit.状态效果[stateName]) : null;
      const after = {
        类型: value >= 0 ? 'buff' : 'debuff',
        状态: stateName,
        状态名称: stateName,
        层数: 1,
        描述: '延迟效果属性修正',
        来源原型摘要: '属性修正',
        属性: runtimeKey,
        duration: Math.max(1, Number(effect?.持续回合 || 1)),
        面板修改比例: percentage ? { [runtimeKey]: Math.max(0.1, 1 + value) } : {},
        面板固定修正: percentage ? {} : { [runtimeKey]: value },
        战斗效果: createEmptyCombatEffectMap(),
      };
      unit.状态效果[stateName] = after;
      writeFact({
        eventKind: before ? 'state_replace' : 'state_apply',
        result: before ? 'replaced' : 'applied',
        resultState: 'SUCCESS',
        factType: 'ATTRIBUTE',
        primaryOutcome: before ? 'state_replace' : 'state_apply',
        operation: 'ATTRIBUTE_MODIFY',
        duration: after.duration,
        meta: {
          source: 'delayed_effect_settlement',
          stateName,
          before,
          after: cloneValue(after),
          operation: 'ATTRIBUTE_MODIFY',
        },
      });
      return finish(`[延迟效果] ${label}获得${attribute || runtimeKey}修正。`);
    }
    if (prototype === '状态施加') {
      const stateName = String(effect?.状态 || '').trim();
      if (!stateName) return finish('');
      if (findPrototypeSuppression(unit, prototype, '状态', stateName)) {
        return finish(`[机制抹消] ${label}对【状态施加 状态:${stateName}】存在封锁，延迟状态施加未能落地。`);
      }
      const state = {
        类型: ['自身', '友方', '友方单体', '友方群体', '召唤物', '分身'].includes(String(effect?.目标 || '').trim()) ? 'buff' : 'debuff',
        状态: stateName,
        状态名称: stateName,
        层数: 1,
        来源原型摘要: '状态施加',
        描述: '延迟效果状态施加',
        duration: Math.max(0, Number(effect?.持续回合 || 0)),
        面板修改比例: { ...(effect?.面板修改比例 || {}) },
        战斗效果: { ...createEmptyCombatEffectMap(), ...(effect?.计算层效果 || {}) },
      };
      if (negativeEffectIsImmune(unit, state)) return finish(`[无视异常] ${label}免疫了[${stateName}]延迟状态。`);
      const removal = findPersistentStateRemoval(unit, stateName, state);
      if (removal) return finish(`[持续状态移除] ${label}的[${stateName}]被[${removal[0]}]拦截。`);
      const before = unit.状态效果[stateName] ? cloneValue(unit.状态效果[stateName]) : null;
      const merged = mergeRuntimeCondition(unit.状态效果[stateName], state, effect);
      if (!merged.applied) return finish(`[延迟效果] ${label}的[${stateName}]已存在，本次未形成新的刷新或叠加。`);
      unit.状态效果[stateName] = merged.state;
      unit.final = buildCombatFinalStats(unit);
      writeFact({
        eventKind: before ? 'state_replace' : 'state_apply',
        result: before ? 'replaced' : 'applied',
        resultState: 'SUCCESS',
        factType: 'STATE',
        primaryOutcome: before ? 'state_replace' : 'state_apply',
        operation: before ? 'STATE_REPLACE' : 'STATE_APPLY',
        duration: Math.max(0, Number(merged.state?.duration || 0)),
        meta: {
          source: 'delayed_effect_settlement',
          stateName,
          before,
          after: cloneValue(merged.state),
          mergeKind: merged.mergeKind,
          operation: before ? 'STATE_REPLACE' : 'STATE_APPLY',
        },
      });
      return finish(`[延迟效果] ${label}获得[${stateName}]。`);
    }
    throw new Error(`battle_delayed_effect_unsupported:${prototype || 'missing'}`);
  }

  function findCombatUnit(combatData = {}, rawName = '') {
    const name = String(rawName || '').trim();
    if (!name) return null;
    return listPrimaryCombatUnits(combatData).find(unit => previewRuntime.unitName(unit) === name || String(unit?.id || unit?.charKey || '').trim() === name) || null;
  }

  function persistentResourceKeys(resource = '') {
    const textValue = (Array.isArray(resource) ? resource : String(resource || '').split(/[、,，/|｜；;\s]+/g))
      .map(value => String(value || '').trim()).filter(Boolean).join('、');
    const keys = [];
    if (/生命|HP|hp/i.test(textValue)) keys.push('hp');
    if (/体力|vit|sta/i.test(textValue)) keys.push('vit');
    if (/魂力|sp/i.test(textValue) || /双|混合|全部/.test(textValue)) keys.push('sp');
    if (/精神|men/i.test(textValue) || /双|混合|全部/.test(textValue)) keys.push('men');
    return keys.length ? [...new Set(keys)] : ['sp'];
  }

  function persistentResourceLabel(key = '') {
    return { hp: '生命', vit: '体力', sp: '魂力', men: '精神力' }[key] || '魂力';
  }

  function persistentResourceValue(unit = {}, key = '') {
    return key === 'hp' ? previewRuntime.readHp(unit) : previewRuntime.readResource(unit, persistentResourceLabel(key));
  }

  function persistentResourceMax(unit = {}, key = '') {
    return key === 'hp' ? previewRuntime.readHpMax(unit) : previewRuntime.readResourceMax(unit, persistentResourceLabel(key));
  }

  function persistentResourceAmount(rawValue, maximum = 0) {
    const textValue = String(rawValue ?? '').trim();
    const parsed = readSignedBattleValue(textValue);
    if (!Number.isFinite(parsed) || parsed === 0) return 0;
    return /%$/.test(textValue) || Math.abs(parsed) <= 1
      ? Math.max(1, Math.floor(Math.max(1, Number(maximum || 0)) * Math.abs(parsed)))
      : Math.floor(Math.abs(parsed));
  }

  function conditionMatchesFilter(key = '', condition = {}, effect = {}) {
    if (String(key || '').startsWith('__auto__:')) return false;
    const state = String(effect?.状态 || '').trim();
    if (state === '任意负面' && String(condition?.类型 || '') !== 'debuff') return false;
    if (state === '任意增益' && String(condition?.类型 || '') !== 'buff') return false;
    if (state && !['任意状态', '任意负面', '任意增益'].includes(state) && key !== state && String(condition?.状态 || '').trim() !== state) return false;
    const matchedPrototype = String(effect?.匹配原型 || '').trim();
    if (!matchedPrototype || matchedPrototype === '无') return true;
    const combatEffects = condition?.战斗效果 || {};
    if (matchedPrototype === '资源变化' && persistentResourceKeys(effect?.资源 || '').includes('hp')) {
      const hasDamage = Number(combatEffects.dot_damage || 0) > 0 || Number(combatEffects.dot_damage_ratio || 0) > 0;
      const hasHealing = Number(combatEffects.hot_heal_ratio || 0) > 0;
      const direction = String(effect?.数值方向 || '任意').trim() || '任意';
      return direction === '负向' ? hasDamage : direction === '正向' ? hasHealing : hasDamage || hasHealing;
    }
    if (matchedPrototype === '护盾变化') return Number(condition?.shield_value || 0) > 0 || Number(combatEffects.shield_gain_bonus || 0) > 0;
    return false;
  }

  function transferableCondition(key = '', condition = {}) {
    const textValue = `${String(key || '')} ${String(condition?.状态 || '')} ${String(condition?.状态名称 || '')} ${String(condition?.描述 || '')}`;
    if (/护盾|屏障|结界|领域|场地|召唤|真身|炸环|免死|复活|回溯/.test(textValue)) return false;
    const effects = condition?.战斗效果 || {};
    return !(Number(effects.death_save_count || 0) > 0 || Number(effects.revive_count || 0) > 0 || effects.invincible === true || String(condition?.特殊机制标识 || '').includes('时光回溯'));
  }

  function conditionTransferValue(key = '', condition = {}) {
    const name = String(key || condition?.状态 || '').trim();
    const effects = condition?.战斗效果 || {};
    if (/眩晕|麻痹|僵直|混乱|沉默|封技/.test(name)) return 90;
    if (/缴械|致盲|迟缓/.test(name)) return 65;
    if (/禁疗|治疗反转/.test(name)) return 60;
    if (/隐匿|隐身|潜行/.test(name) || Number(effects.stealth_level || 0) > 0) return 72;
    if (/中毒|流血|灼烧|冻伤|持续创伤|资源燃烧/.test(name) || Number(effects.dot_damage || 0) > 0 || Number(effects.dot_damage_ratio || 0) > 0) return 45 + Math.min(18, Math.max(0, Number(condition?.duration || 0)) * 3);
    if (/无敌|霸体|护盾|真身/.test(name) || effects.invincible === true || effects.super_armor === true || Number(condition?.shield_value || 0) > 0) return 85;
    return 25;
  }

  function chooseTransferableCondition(unit = {}, effect = {}, preferredTypes = ['any'], expectedState = '') {
    if (!unit?.状态效果) return null;
    for (const expectedType of preferredTypes) {
      const candidates = Object.entries(unit.状态效果)
        .filter(([key, condition]) => conditionMatchesFilter(key, condition, effect) && transferableCondition(key, condition))
        .filter(([, condition]) => expectedType === 'any' || String(condition?.类型 || '').trim() === expectedType)
        .filter(([key, condition]) => {
          const state = String(expectedState || '').trim();
          return !state || ['任意状态', '任意增益', '任意负面'].includes(state) || `${key} ${condition?.状态 || ''} ${condition?.状态名称 || ''} ${condition?.描述 || ''}`.includes(state);
        })
        .sort((left, right) => conditionTransferValue(right[0], right[1]) - conditionTransferValue(left[0], left[1]));
      if (candidates.length) return { key: candidates[0][0], condition: candidates[0][1] };
    }
    return null;
  }

  function removePersistentCondition(unit = {}, key = '') {
    if (!unit?.状态效果?.[key]) return null;
    const snapshot = cloneValue(unit.状态效果[key]);
    delete unit.状态效果[key];
    Object.keys(unit?.持续效果 || {}).forEach(sustainKey => {
      if (unit.持续效果[sustainKey]?.related_condition === key) delete unit.持续效果[sustainKey];
    });
    refreshSustainRuntimeLoad(unit);
    if (unit.召唤键) syncSummonMirror(unit);
    return snapshot;
  }

  function insertPersistentCondition(unit = {}, baseKey = '状态', condition = {}) {
    if (!unit.状态效果 || typeof unit.状态效果 !== 'object') unit.状态效果 = {};
    let key = String(baseKey || '状态').trim() || '状态';
    if (unit.状态效果[key]) {
      let index = 1;
      while (unit.状态效果[`${key}·${index}`]) index += 1;
      key = `${key}·${index}`;
    }
    unit.状态效果[key] = condition;
    if (unit.召唤键) syncSummonMirror(unit);
    return key;
  }

  function persistentEndpointCandidates(endpoint = '', caster = {}, target = {}, combatData = {}, expandTargetSide = false) {
    const player = Array.isArray(combatData?.参战者?.team_player) ? combatData.参战者.team_player.filter(Boolean) : [];
    const enemy = Array.isArray(combatData?.参战者?.team_enemy) ? combatData.参战者.team_enemy.filter(Boolean) : [];
    const casterInPlayer = player.includes(caster) || player.some(unit => previewRuntime.unitName(unit) === previewRuntime.unitName(caster));
    if (endpoint === '自身') return [caster].filter(Boolean);
    if (endpoint === '目标') {
      if (expandTargetSide) {
        if (player.includes(target) || player.some(unit => previewRuntime.unitName(unit) === previewRuntime.unitName(target))) return player;
        if (enemy.includes(target) || enemy.some(unit => previewRuntime.unitName(unit) === previewRuntime.unitName(target))) return enemy;
      }
      return [target].filter(Boolean);
    }
    if (endpoint === '友方') return casterInPlayer ? player : enemy;
    if (endpoint === '敌方') return casterInPlayer ? enemy : player;
    return [];
  }

  function persistentSide(unit = {}, caster = {}, combatData = {}) {
    const allies = persistentEndpointCandidates('友方', caster, unit, combatData);
    return allies.includes(unit) || previewRuntime.unitName(unit) === previewRuntime.unitName(caster) ? '己方' : '敌方';
  }

  function settlePersistentResourceTransfer(unit = {}, condition = {}, effect = {}, label = '', combatData = {}) {
    const mode = String(effect?.资源转移方式 || '').trim();
    if (!['吞噬', '共享', '均分', '转移'].includes(mode)) return '';
    const caster = findCombatUnit(combatData, condition.来源角色) || unit;
    const keys = persistentResourceKeys(effect?.资源 || '');
    const conversion = Math.max(0, Math.min(2, Number(effect?.转化比例 ?? 1) || 1));
    const logs = [];
    if (mode === '均分') {
      const namedTargets = (Array.isArray(condition.持续目标列表) ? condition.持续目标列表 : []).map(name => findCombatUnit(combatData, name)).filter(Boolean);
      const units = [...new Set((namedTargets.length ? namedTargets : [unit, caster]).filter(entry => entry && previewRuntime.isAlive(entry)))];
      if (units.length < 2) return '';
      const strength = Math.max(0, Math.min(1, Math.abs(readSignedBattleValue(effect?.数值 || '100%')) || 1));
      keys.forEach(key => {
        const average = units.reduce((sum, entry) => sum + persistentResourceValue(entry, key), 0) / units.length;
        units.forEach(entry => {
          const before = persistentResourceValue(entry, key);
          const next = Math.max(0, Math.min(persistentResourceMax(entry, key), Math.round(before + (average - before) * strength)));
          const delta = next - before;
          if (!delta || findResourceSuppression(entry, persistentResourceLabel(key))) return;
          writeCombatResource(entry, key, next);
          logs.push(`${entry === caster ? '自身' : previewRuntime.unitName(entry) || '目标'}${persistentResourceLabel(key)}${delta > 0 ? '+' : ''}${delta}`);
        });
      });
    } else {
      keys.forEach(key => {
        const maximum = persistentResourceMax(unit, key);
        const amount = Math.min(persistentResourceValue(unit, key), persistentResourceAmount(effect?.数值, maximum));
        if (!(amount > 0)) return;
        if (mode === '共享') {
          if (!caster || caster === unit) return;
          const casterCurrent = persistentResourceValue(caster, key);
          const paid = Math.min(casterCurrent, amount);
          if (!(paid > 0) || findResourceSuppression(caster, persistentResourceLabel(key)) || findResourceSuppression(unit, persistentResourceLabel(key))) return;
          const gain = Math.max(1, Math.floor(paid * conversion));
          writeCombatResource(caster, key, casterCurrent - paid);
          writeCombatResource(unit, key, Math.min(maximum, persistentResourceValue(unit, key) + gain));
          logs.push(`自身共享${paid}点${persistentResourceLabel(key)}给${label}`);
          return;
        }
        if (findResourceSuppression(unit, persistentResourceLabel(key))) return;
        writeCombatResource(unit, key, persistentResourceValue(unit, key) - amount);
        logs.push(`${label}损失${amount}点${persistentResourceLabel(key)}`);
        if (mode === '吞噬' && caster) {
          const recovered = Math.max(0, Math.floor(amount * conversion));
          if (recovered > 0 && !findResourceSuppression(caster, persistentResourceLabel(key))) {
            writeCombatResource(caster, key, Math.min(persistentResourceMax(caster, key), persistentResourceValue(caster, key) + recovered));
            logs.push(`自身回补${recovered}点${persistentResourceLabel(key)}`);
          }
        }
      });
    }
    return logs.length ? `[持续资源转移] ${logs.join('，')}。` : '';
  }

  function settlePersistentStateRemoval(unit = {}, key = '', effect = {}, label = '') {
    const maxCount = String(effect?.数量 || '').trim() === '全部' ? Infinity : Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
    const removed = [];
    for (const [stateKey, state] of Object.entries(unit?.状态效果 || {})) {
      if (stateKey === key || removed.length >= maxCount || !conditionMatchesFilter(stateKey, state, effect)) continue;
      removePersistentCondition(unit, stateKey);
      removed.push(stateKey);
    }
    return removed.length ? `[持续状态移除] ${label}移除了[${removed.join('/')}].` : '';
  }

  function settlePersistentStateTransfer(unit = {}, condition = {}, effect = {}, label = '', combatData = {}) {
    const caster = findCombatUnit(combatData, condition.来源角色) || unit;
    const target = findCombatUnit(combatData, condition.目标角色) || unit;
    const sourceEndpoint = String(effect?.来源 || '自身').trim();
    const targetEndpoint = String(effect?.去向 || '目标').trim();
    if (!['自身', '目标', '友方', '敌方'].includes(sourceEndpoint) || !['自身', '目标', '友方', '敌方'].includes(targetEndpoint)) return '';
    const count = String(effect?.数量 || '').trim() === '全部' ? 99 : Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
    const logs = [];
    const expand = sourceEndpoint === '目标' && targetEndpoint === '目标';
    for (let index = 0; index < count; index += 1) {
      let moved = false;
      const sources = persistentEndpointCandidates(sourceEndpoint, caster, target, combatData, expand);
      const receivers = persistentEndpointCandidates(targetEndpoint, caster, target, combatData, expand);
      if (expand && new Set([...sources, ...receivers]).size < 2) return '';
      for (const source of sources) {
        for (const receiver of receivers) {
          if (!source || !receiver || source === receiver || previewRuntime.unitName(source) === previewRuntime.unitName(receiver)) continue;
          const sourceSide = persistentSide(source, caster, combatData);
          const receiverSide = persistentSide(receiver, caster, combatData);
          const preferred = sourceSide === '己方' ? (receiverSide === '敌方' ? ['debuff', 'buff'] : ['debuff']) : (receiverSide === '己方' ? ['buff', 'debuff'] : ['buff']);
          const candidate = chooseTransferableCondition(source, effect, preferred, effect?.状态 || '任意状态');
          if (!candidate) continue;
          const snapshot = removePersistentCondition(source, candidate.key);
          if (!snapshot) continue;
          snapshot.描述 = `由[${condition.来源技能 || '持续效果'}]持续转移`;
          const nextKey = insertPersistentCondition(receiver, candidate.key, snapshot);
          logs.push(`${source === caster ? '自身' : previewRuntime.unitName(source) || '来源'}的[${candidate.key}]转移到${receiver === caster ? '自身' : previewRuntime.unitName(receiver) || '目标'}为[${nextKey}]`);
          moved = true;
          break;
        }
        if (moved) break;
      }
      if (!moved) break;
    }
    return logs.length ? `[持续状态转移] ${logs.join('；')}。` : '';
  }

  function settlePersistentStateExchange(unit = {}, condition = {}, effect = {}, label = '', combatData = {}) {
    const caster = findCombatUnit(combatData, condition.来源角色);
    const target = findCombatUnit(combatData, condition.目标角色) || unit;
    if (!caster || !target || caster === target) return '';
    const own = chooseTransferableCondition(caster, { 状态: effect?.状态 || '任意负面' }, ['debuff'], effect?.状态 || '任意负面');
    const other = chooseTransferableCondition(target, { 状态: '任意增益' }, ['buff'], '任意增益');
    if (!own || !other) return '';
    const ownSnapshot = removePersistentCondition(caster, own.key);
    const otherSnapshot = removePersistentCondition(target, other.key);
    if (!ownSnapshot || !otherSnapshot) return '';
    ownSnapshot.描述 = `由[${condition.来源技能 || '持续效果'}]持续交换至${previewRuntime.unitName(target) || '目标'}`;
    otherSnapshot.描述 = `由[${condition.来源技能 || '持续效果'}]持续交换至${previewRuntime.unitName(caster) || '自身'}`;
    const ownNewKey = insertPersistentCondition(target, own.key, ownSnapshot);
    const otherNewKey = insertPersistentCondition(caster, other.key, otherSnapshot);
    return `[持续状态交换] 自身的[${own.key}]与${previewRuntime.unitName(target) || label}的[${other.key}]交换为[${otherNewKey}]/[${ownNewKey}]。`;
  }

  function settlePersistentPrototype(unit = {}, key = '', condition = {}, label = '', combatData = {}) {
    const effect = condition?.持续原型效果;
    if (!effect || typeof effect !== 'object') return '';
    const prototype = String(effect?.原型 || '').trim();
    if (prototype === '资源转移') return settlePersistentResourceTransfer(unit, condition, effect, label, combatData);
    if (prototype === '状态移除') return settlePersistentStateRemoval(unit, key, effect, label);
    if (prototype === '状态转移') return settlePersistentStateTransfer(unit, condition, effect, label, combatData);
    if (prototype === '状态交换') return settlePersistentStateExchange(unit, condition, effect, label, combatData);
    throw new Error(`battle_persistent_prototype_unsupported:${prototype || 'missing'}`);
  }

  function settleConditionsAtRoundEnd(unit = {}, label = '', combatData = {}) {
    if (!unit) return { log: '', totalDot: 0, expired: [] };
    let totalDot = 0;
    const expired = [];
    const logs = [];
    const conditions = unit.状态效果 && typeof unit.状态效果 === 'object' && !Array.isArray(unit.状态效果) ? unit.状态效果 : {};
    const ringRecoveryLog = settleRingRecoveryAtRoundEnd(unit, label);
    if (ringRecoveryLog) logs.push(ringRecoveryLog);
    Object.keys(conditions).forEach(key => {
      const condition = conditions[key];
      if (!condition) return;
      if (condition.__本回合新附加 === true) {
        delete condition.__本回合新附加;
        return;
      }
      if (condition?.召唤物) return;
      const tickResult = settleConditionResourceTick(unit, key, condition, label, combatData);
      if (tickResult.log) logs.push(tickResult.log);
      totalDot += Math.max(0, Number(tickResult.totalDot || 0));
      if (tickResult.stopCondition === true) return;
      if (previewRuntime.readHp(unit) <= 0) {
        const reviveLog = triggerRevive(unit, label);
        if (reviveLog) logs.push(reviveLog);
      }
      const sideEffectLog = settleConditionSideEffects(unit, key, condition, '回合结束时', label, combatData);
      if (sideEffectLog) logs.push(sideEffectLog);
      const prototypeLog = settlePersistentPrototype(unit, key, condition, label, combatData);
      if (prototypeLog) logs.push(prototypeLog);
      if (typeof condition.duration === 'number') {
        if (structuredControlConsumesActiveOpportunity(condition)) return;
        if (Array.isArray(condition.__状态来源窗口)) {
          condition.__状态来源窗口.shift();
          condition.__状态来源键 = String(condition.__状态来源窗口[0] || '').trim();
        }
        condition.duration -= 1;
        if (condition.duration <= 0) expired.push(key);
      }
    });
    const expiryOrder = [
      ...expired.filter(key => conditions[key]?.延迟效果 === true),
      ...expired.filter(key => conditions[key]?.延迟效果 !== true),
    ];
    expiryOrder.forEach(key => {
      const condition = conditions[key];
      if (!condition) return;
      if (condition.延迟效果 === true && Array.isArray(condition?.结算效果)) {
        condition.结算效果.forEach(effect => {
          const delayedLog = settleDelayedEffect(unit, effect, label, combatData, {
            stateName: key,
            condition,
          });
          if (delayedLog) logs.push(delayedLog);
        });
      }
      const sideEffectLog = settleConditionSideEffects(unit, key, condition, '效果结束后', label, combatData);
      if (sideEffectLog) logs.push(sideEffectLog);
      const expiryLog = settleExpiredConditionBase(unit, key, condition, label, combatData);
      if (expiryLog) logs.push(expiryLog);
    });
    const recoveryLog = settleNaturalRecoveryAtRoundEnd(unit, label, combatData);
    if (recoveryLog) logs.push(recoveryLog);
    if (unit.召唤键) syncSummonMirror(unit);
    return { log: logs.join(' '), totalDot, expired };
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
    if (!runtime.reactionGrantIds || typeof runtime.reactionGrantIds !== 'object') runtime.reactionGrantIds = {};
    if (!runtime.counterCount || typeof runtime.counterCount !== 'object') runtime.counterCount = {};
    if (!runtime.reactionFatigue || typeof runtime.reactionFatigue !== 'object') runtime.reactionFatigue = {};
    if (!runtime.opportunityGraph || typeof runtime.opportunityGraph !== 'object') runtime.opportunityGraph = {};
    if (!Array.isArray(runtime.resourceTimeline)) runtime.resourceTimeline = [];
    if (!runtime.scheduleDescriptors || typeof runtime.scheduleDescriptors !== 'object') runtime.scheduleDescriptors = {};
    if (!runtime.routeUnitHashCache || typeof runtime.routeUnitHashCache !== 'object') runtime.routeUnitHashCache = {};
    if (!(runtime.damageAbsorptionConsumedEventIds instanceof Set)) runtime.damageAbsorptionConsumedEventIds = new Set();
    runtime.itemPassiveBattleStarted = runtime.itemPassiveBattleStarted === true;
    runtime.ledgerSequence = Math.max(0, Number(runtime.ledgerSequence || 0));
    runtime.resourceEffectSequence = Math.max(0, Number(runtime.resourceEffectSequence || 0));
    return runtime;
  }

  function createRuntimeFactJournal() {
    return {
      sequence: 0,
      sourceEventIds: [],
      changedFactKeys: new Set(),
      opportunityChanges: new Map(),
      resourceTimelineChanges: new Map(),
      scheduleChanges: new Map(),
      visibleBeliefChanges: new Map(),
      viewScheduleRecords: new Map(),
      viewScheduleInitialized: false,
      revisions: {
        visibleWorld: 0,
        opportunity: 0,
        resourceTimeline: 0,
        schedule: 0,
        belief: 0,
      },
    };
  }

  function resetRuntimeFactJournal(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    runtime.evaluationFactJournal = createRuntimeFactJournal();
    return runtime.evaluationFactJournal;
  }

  function ensureRuntimeFactJournal(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    if (
      !runtime.evaluationFactJournal ||
      typeof runtime.evaluationFactJournal !== 'object'
    ) {
      runtime.evaluationFactJournal = createRuntimeFactJournal();
    }
    return runtime.evaluationFactJournal;
  }

  function coalesceRuntimeRecordChange(
    records,
    id,
    previousRecord,
    currentRecord,
  ) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;
    const existing = records.get(normalizedId);
    const beforeHash = existing
      ? String(existing.beforeHash || '')
      : previousRecord === undefined
        ? ''
        : previewRuntime.stableHash(previousRecord);
    const afterHash = currentRecord === undefined
      ? ''
      : previewRuntime.stableHash(currentRecord);
    if (beforeHash === afterHash) {
      records.delete(normalizedId);
      return;
    }
    records.set(normalizedId, {
      id: normalizedId,
      changeType: !beforeHash
        ? 'CREATED'
        : !afterHash
          ? 'REMOVED'
          : 'CHANGED',
      beforeHash,
      afterHash,
    });
  }

  function recordRuntimeFactKey(combatData = {}, factKey = '') {
    const normalized = String(factKey || '').trim();
    if (!normalized) return;
    const journal = ensureRuntimeFactJournal(combatData);
    journal.changedFactKeys.add(normalized);
    journal.revisions.visibleWorld += 1;
  }

  function recordRuntimeOpportunityChange(
    combatData = {},
    previousRecord,
    currentRecord,
  ) {
    const record = currentRecord || previousRecord || {};
    const opportunityId = String(
      record?.opportunityId || record?.grantId || '',
    ).trim();
    if (!opportunityId) return;
    const journal = ensureRuntimeFactJournal(combatData);
    coalesceRuntimeRecordChange(
      journal.opportunityChanges,
      opportunityId,
      previousRecord,
      currentRecord,
    );
    journal.changedFactKeys.add(`opportunity:${opportunityId}`);
    journal.revisions.opportunity += 1;
  }

  function recordRuntimeTimelineChange(
    combatData = {},
    collectionName = '',
    id = '',
    previousRecord,
    currentRecord,
  ) {
    const journal = ensureRuntimeFactJournal(combatData);
    const table =
      collectionName === 'resource'
        ? journal.resourceTimelineChanges
        : journal.scheduleChanges;
    const normalizedPrevious =
      collectionName === 'schedule' && previousRecord !== undefined
        ? semanticScheduleRecord(
            previousRecord,
            String(id || '').trim(),
          )
        : previousRecord;
    const normalizedCurrent =
      collectionName === 'schedule' && currentRecord !== undefined
        ? semanticScheduleRecord(
            currentRecord,
            String(id || '').trim(),
          )
        : currentRecord;
    coalesceRuntimeRecordChange(
      table,
      id,
      normalizedPrevious,
      normalizedCurrent,
    );
    if (collectionName === 'resource') {
      journal.revisions.resourceTimeline += 1;
    } else {
      journal.revisions.schedule += 1;
      const scheduleFactKey = `schedule:${String(id || '').trim()}`;
      if (table.has(String(id || '').trim())) {
        journal.changedFactKeys.add(scheduleFactKey);
      } else {
        journal.changedFactKeys.delete(scheduleFactKey);
      }
    }
  }

  function recordRuntimeViewScheduleSnapshot(
    combatData = {},
    scheduledEvents = [],
  ) {
    const journal = ensureRuntimeFactJournal(combatData);
    const current = new Map(
      (Array.isArray(scheduledEvents) ? scheduledEvents : [])
        .map(record => [
          String(
            record?.descriptorId || record?.scheduleId || '',
          ).trim(),
          record,
        ])
        .filter(([id]) => id),
    );
    if (!journal.viewScheduleInitialized) {
      journal.viewScheduleRecords = current;
      journal.viewScheduleInitialized = true;
      return;
    }
    const ids = new Set([
      ...journal.viewScheduleRecords.keys(),
      ...current.keys(),
    ]);
    [...ids].sort().forEach(descriptorId => {
      const previousRecord =
        journal.viewScheduleRecords.get(descriptorId);
      const currentRecord = current.get(descriptorId);
      if (
        previousRecord !== undefined &&
        currentRecord !== undefined &&
        previewRuntime.stableHash(
          semanticScheduleRecord(previousRecord, descriptorId),
        ) ===
          previewRuntime.stableHash(
            semanticScheduleRecord(currentRecord, descriptorId),
          )
      ) {
        return;
      }
      recordRuntimeTimelineChange(
        combatData,
        'schedule',
        descriptorId,
        previousRecord,
        currentRecord,
      );
    });
    journal.viewScheduleRecords = current;
  }

  function recordRuntimeVisibleBeliefChange(
    combatData = {},
    actorId = '',
    previousBelief,
    currentBelief,
    existedBefore = false,
  ) {
    const normalizedActorId = String(actorId || '').trim();
    if (!normalizedActorId) return;
    const journal = ensureRuntimeFactJournal(combatData);
    const previousIdentity = existedBefore
      ? String(
          previousBelief?.revision ||
          previewRuntime.stableHash(previousBelief || {}),
        ).trim()
      : '';
    const currentIdentity = String(
      currentBelief?.revision ||
      previewRuntime.stableHash(currentBelief || {}),
    ).trim();
    const existing = journal.visibleBeliefChanges.get(normalizedActorId);
    const beforeHash = existing
      ? String(existing.beforeHash || '')
      : previousIdentity;
    if (beforeHash === currentIdentity) {
      journal.visibleBeliefChanges.delete(normalizedActorId);
      journal.changedFactKeys.delete(`belief:${normalizedActorId}`);
      return;
    }
    journal.visibleBeliefChanges.set(normalizedActorId, {
      id: normalizedActorId,
      changeType: !beforeHash ? 'CREATED' : 'CHANGED',
      beforeHash,
      afterHash: currentIdentity,
    });
    journal.changedFactKeys.add(`belief:${normalizedActorId}`);
    journal.revisions.belief += 1;
  }

  function ledgerEventChangedFactKeys(event = {}) {
    const keys = new Set();
    const eventKind = String(event?.eventKind || '').trim();
    const operation = String(
      event?.operation || event?.meta?.operation || '',
    ).trim().toUpperCase();
    const targetId = String(
      event?.targetId ||
      event?.targetIds?.[0] ||
      event?.actorId ||
      '',
    ).trim();
    if (!targetId) return keys;
    const before = event?.meta?.before;
    const after = event?.meta?.after;
    const changed =
      before !== undefined &&
      after !== undefined &&
      previewRuntime.stableHash(before) !== previewRuntime.stableHash(after);
    if (
      changed &&
      (
        eventKind === 'hit_result' ||
        eventKind === 'state_tick' &&
          String(event?.meta?.resourceKey || '').trim() === 'hp'
      )
    ) {
      keys.add(`unit:${targetId}:hp`);
    }
    if (
      changed &&
      ['shield_create', 'shield_break'].includes(eventKind)
    ) {
      keys.add(`unit:${targetId}:state:__SHIELD`);
    }
    const resourceDelta = Number(
      event?.meta?.delta ?? event?.delta ?? 0,
    );
    const resourceChanged =
      changed ||
      (
        eventKind === 'resource_change' &&
        Math.abs(resourceDelta) > 1e-9 &&
        !['FAILURE', 'NO_EFFECT'].includes(
          String(event?.resultState || '').trim().toUpperCase(),
        )
      );
    if (resourceChanged && eventKind === 'resource_change') {
      const resourceKey = String(
        event?.meta?.resourceKey || '',
      ).trim();
      const resource = String(
        event?.meta?.resource || '',
      ).trim();
      if (resourceKey === 'hp' || resource === '生命') {
        keys.add(`unit:${targetId}:hp`);
      } else if (resourceKey === 'shield' || resource === '护盾') {
        keys.add(`unit:${targetId}:state:__SHIELD`);
      } else {
        const label = {
          sp: '魂力',
          men: '精神力',
          vit: '体力',
        }[resourceKey] || resource;
        if (label) keys.add(`unit:${targetId}:resource:${label}`);
      }
    }
    if (
      changed &&
      [
        'state_apply',
        'state_replace',
        'state_remove',
      ].includes(eventKind)
    ) {
      const beforeAction = before && typeof before === 'object'
        ? before.行动
        : undefined;
      const afterAction = after && typeof after === 'object'
        ? after.行动
        : undefined;
      if (beforeAction !== undefined || afterAction !== undefined) {
        keys.add(`unit:${targetId}:state:__ACTION`);
      } else {
        const stateKey = String(
          event?.meta?.stateKey ||
          event?.meta?.stateName ||
          event?.stateName ||
          '',
        ).trim();
        if (stateKey) keys.add(`unit:${targetId}:state:${stateKey}`);
      }
    }
    if (
      [
        'state_expire',
        'state_remove',
      ].includes(eventKind) ||
      [
        'STATE_EXPIRE',
        'STATE_REMOVE',
      ].includes(operation)
    ) {
      const stateKey = String(
        event?.meta?.stateKey ||
        event?.meta?.stateName ||
        event?.stateName ||
        '',
      ).trim();
      if (stateKey) keys.add(`unit:${targetId}:state:${stateKey}`);
    }
    if (operation === 'SNAPSHOT_RESTORE') {
      (event?.meta?.changedFields || []).forEach(field => {
        const normalized = String(field || '').trim();
        if (/^(hp|HP)$/.test(normalized)) {
          keys.add(`unit:${targetId}:hp`);
        } else if (/^(sp|魂力)$/.test(normalized)) {
          keys.add(`unit:${targetId}:resource:魂力`);
        } else if (/^(men|精神力)$/.test(normalized)) {
          keys.add(`unit:${targetId}:resource:精神力`);
        } else if (/^(vit|体力)$/.test(normalized)) {
          keys.add(`unit:${targetId}:resource:体力`);
        }
      });
    }
    return keys;
  }

  function recordRuntimeLedgerEvent(combatData = {}, event = {}) {
    const eventId = String(event?.eventId || '').trim();
    if (!eventId) return;
    const journal = ensureRuntimeFactJournal(combatData);
    journal.sourceEventIds.push(eventId);
    ledgerEventChangedFactKeys(event).forEach(key =>
      recordRuntimeFactKey(combatData, key)
    );
  }

  function drainRuntimeFactDeltaBatch(
    combatData = {},
    {
      sequence = 0,
      terminalReached = false,
      runtimeSnapshot = {},
    } = {},
  ) {
    const journal = ensureRuntimeFactJournal(combatData);
    const mapChanges = (records, idKey) =>
      [...records.values()]
        .sort((left, right) =>
          String(left?.id || '').localeCompare(String(right?.id || ''))
        )
        .map(change => ({
          [idKey]: String(change?.id || '').trim(),
          changeType: String(change?.changeType || '').trim(),
          beforeHash: String(change?.beforeHash || ''),
          afterHash: String(change?.afterHash || ''),
        }));
    const batch = {
      sequence: Math.max(0, Number(sequence || 0)),
      sourceEventIds: [...journal.sourceEventIds],
      changedFactKeys: [...journal.changedFactKeys].sort(),
      opportunityChanges: mapChanges(
        journal.opportunityChanges,
        'opportunityId',
      ),
      resourceTimelineChanges: mapChanges(
        journal.resourceTimelineChanges,
        'eventId',
      ),
      scheduleChanges: mapChanges(
        journal.scheduleChanges,
        'descriptorId',
      ),
      visibleBeliefChanges: mapChanges(
        journal.visibleBeliefChanges,
        'actorId',
      ),
      terminalReached: terminalReached === true,
      revisions: {
        visibleWorldRevision:
          `visible-journal:${journal.revisions.visibleWorld}`,
        beliefRevision:
          `belief-journal:${journal.revisions.belief}`,
        opportunityRevision:
          String(runtimeSnapshot?.opportunityRevision || '').trim() ||
          `opportunity-journal:${journal.revisions.opportunity}`,
        resourceTimelineRevision:
          String(runtimeSnapshot?.resourceTimelineRevision || '').trim() ||
          `resource-journal:${journal.revisions.resourceTimeline}`,
        scheduleRevision:
          String(runtimeSnapshot?.scheduleRevision || '').trim() ||
          `schedule-journal:${journal.revisions.schedule}`,
      },
      deltaSource: 'EVENT_JOURNAL',
    };
    journal.sequence += 1;
    journal.sourceEventIds.length = 0;
    journal.changedFactKeys.clear();
    journal.opportunityChanges.clear();
    journal.resourceTimelineChanges.clear();
    journal.scheduleChanges.clear();
    journal.visibleBeliefChanges.clear();
    return batch;
  }

  function invalidateRouteUnitHashes(combatData = {}, unitIds = []) {
    const runtime = ensureCombatRuntime(combatData);
    const ids = [...new Set((Array.isArray(unitIds) ? unitIds : [unitIds])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
    if (!ids.length) {
      runtime.routeUnitHashCache = {};
      return;
    }
    ids.forEach(unitId => { delete runtime.routeUnitHashCache[unitId]; });
  }

  function routeUnitHash(combatData = {}, unit = {}) {
    const runtime = ensureCombatRuntime(combatData);
    const unitId = previewRuntime.unitId(unit);
    if (!unitId) return '';
    const cached = runtime.routeUnitHashCache[unitId]?.routeHash;
    if (cached) return cached;
    const snapshot = cloneValue(unit);
    if (snapshot && typeof snapshot === 'object') {
      delete snapshot.__宿主;
      if (snapshot.__battleRuntime && typeof snapshot.__battleRuntime === 'object') {
        delete snapshot.__battleRuntime.naturalOpportunity;
      }
    }
    const hash = previewRuntime.stableHash(snapshot);
    runtime.routeUnitHashCache[unitId] = {
      ...(runtime.routeUnitHashCache[unitId] || {}),
      routeHash: hash,
    };
    return hash;
  }

  function fullRouteUnitHash(combatData = {}, unit = {}) {
    const runtime = ensureCombatRuntime(combatData);
    const unitId = previewRuntime.unitId(unit);
    if (!unitId) return '';
    const cached = runtime.routeUnitHashCache[unitId]?.fullHash;
    if (cached) return cached;
    const hash = previewRuntime.stableHash(unit);
    runtime.routeUnitHashCache[unitId] = {
      ...(runtime.routeUnitHashCache[unitId] || {}),
      fullHash: hash,
    };
    return hash;
  }

  function buildRouteDependencyReverseIndex(catalog = {}, fullRoutesByUnit = {}) {
    const exact = {};
    const routes = {};
    const unitIds = new Set([
      ...Object.keys(catalog || {}),
      ...Object.keys(fullRoutesByUnit || {}),
    ]);
    [...unitIds].sort().forEach(unitId => {
      const envelope = catalog?.[unitId] || {};
      const routeRows = Array.isArray(fullRoutesByUnit?.[unitId])
        ? fullRoutesByUnit[unitId]
        : [];
      const routeDependencies = new Map(
        routeRows.map(route => [
          String(route?.candidateId || '').trim(),
          new Set(Array.isArray(route?.dependencyKeys) ? route.dependencyKeys : []),
        ]).filter(([candidateId]) => candidateId),
      );
      if (Array.isArray(envelope?.dependencyKeys)) {
        const envelopeKeys = new Set(
          envelope.dependencyKeys.map(key => String(key || '').trim()).filter(Boolean),
        );
        const primaryCandidateIds = new Set([
          envelope?.primaryRoute?.candidateId,
          envelope?.backupRoute?.candidateId,
        ].map(value => String(value || '').trim()).filter(Boolean));
        primaryCandidateIds.forEach(candidateId => {
          const dependencySet = routeDependencies.get(candidateId) || new Set();
          envelopeKeys.forEach(key => dependencySet.add(key));
          routeDependencies.set(candidateId, dependencySet);
        });
      }
      routeDependencies.forEach((dependencyKeys, candidateId) => {
        const route = routeRows.find(row =>
          String(row?.candidateId || '').trim() === candidateId
        ) || (
          envelope?.primaryRoute?.candidateId === candidateId
            ? envelope.primaryRoute
            : envelope?.backupRoute?.candidateId === candidateId
              ? envelope.backupRoute
              : {}
        );
        const routeRef = Object.freeze({
          unitId,
          candidateId,
          routeKey: String(route?.routeKey || '').trim(),
          actionRole: normalizeActionRole(
            route?.actionRole ||
            route?.declaration?.actionRole ||
            route?.declaration?.actionKind ||
            'ACTIVE',
          ),
          targetIds: Object.freeze(
            (Array.isArray(route?.targetIds)
              ? route.targetIds
              : route?.declaration?.targetIds || []
            ).map(value => String(value || '').trim()).filter(Boolean).sort(),
          ),
        });
        [...dependencyKeys].forEach(key => {
          const dependencyKey = String(key || '').trim();
          if (!dependencyKey) return;
          if (!exact[dependencyKey]) exact[dependencyKey] = [];
          if (!exact[dependencyKey].includes(unitId)) exact[dependencyKey].push(unitId);
          if (!routes[dependencyKey]) routes[dependencyKey] = [];
          if (!routes[dependencyKey].some(entry =>
            entry.unitId === routeRef.unitId &&
            entry.candidateId === routeRef.candidateId
          )) {
            routes[dependencyKey].push(routeRef);
          }
        });
      });
    });
    Object.values(exact).forEach(unitIds => unitIds.sort());
    Object.values(routes).forEach(routeRefs => routeRefs.sort((left, right) =>
      String(left?.unitId || '').localeCompare(String(right?.unitId || '')) ||
      String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
    ));
    return Object.freeze({
      exact: Object.freeze(exact),
      routes: Object.freeze(routes),
    });
  }

  function buildRouteDependencyValueHashes(
    combatData = {},
    dependencyReverseIndex = {},
  ) {
    const dependencyKeys = Object.keys(
      dependencyReverseIndex?.exact || {},
    ).sort();
    return Object.freeze(Object.fromEntries(
      dependencyKeys
        .filter(key =>
          /^(unit:|target:|rule:)/.test(String(key || '').trim()),
        )
        .map(key => [
          key,
          previewRuntime.stableHash(
            previewRuntime.dependencyValueForKey(combatData, key),
          ),
        ]),
    ));
  }

  function keyedRecordHashes(records = [], idOf = () => '') {
    return Object.fromEntries((Array.isArray(records) ? records : [])
      .map(record => [String(idOf(record) || '').trim(), record])
      .filter(([id]) => id)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, record]) => [id, previewRuntime.stableHash(record)]));
  }

  function resourceDependencyHashes(events = []) {
    const grouped = new Map();
    (Array.isArray(events) ? events : []).forEach(event => {
      const unitId = String(
        event?.actorId || event?.unitId || event?.targetId || event?.ownerId || ''
      ).trim();
      const resource = String(event?.resource || '').trim();
      if (!unitId || !resource) return;
      const key = `${unitId}\u0000${resource}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    });
    return Object.fromEntries([...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => [
        key,
        previewRuntime.stableHash([...rows].sort((left, right) =>
          Number(left?.round || 0) - Number(right?.round || 0) ||
          Number(left?.opportunitySequence || 0) - Number(right?.opportunitySequence || 0) ||
          Number(left?.actionSequence || 0) - Number(right?.actionSequence || 0) ||
          Number(left?.phasePriority || 0) - Number(right?.phasePriority || 0) ||
          Number(left?.effectSequence || 0) - Number(right?.effectSequence || 0) ||
          String(left?.eventId || '').localeCompare(String(right?.eventId || ''))
        )),
      ]));
  }

  function scheduleDependencyHashes(events = []) {
    return Object.fromEntries(
      (Array.isArray(events) ? events : [])
        .map(record => [
          String(record?.descriptorId || record?.scheduleId || '').trim(),
          record,
        ])
        .filter(([id]) => id)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, record]) => [
          id,
          previewRuntime.stableHash(
            semanticScheduleRecord(record, id),
          ),
        ]),
    );
  }

  function semanticScheduleRecord(record = {}, descriptorId = '') {
    return String(record?.eventType || '').trim() ===
        'FUTURE_NATURAL_ACTION'
      ? {
          descriptorId: String(
            descriptorId ||
            record?.descriptorId ||
            record?.scheduleId ||
            '',
          ).trim(),
          ownerId: String(record?.ownerId || '').trim(),
          expectedGrantType: String(
            record?.expectedGrantType || '',
          ).trim(),
          round: Number(
            record?.round ?? record?.scheduledRound ?? 0,
          ),
          eventType: 'FUTURE_NATURAL_ACTION',
        }
      : record;
  }

  function changedHashKeys(previous = {}, current = {}) {
    return [...new Set([
      ...Object.keys(previous || {}),
      ...Object.keys(current || {}),
    ])].filter(key => previous?.[key] !== current?.[key]);
  }

  function beliefDependencyHashes(
    beliefState = {},
    dependencyReverseIndex = {},
  ) {
    return Object.fromEntries(
      Object.keys(dependencyReverseIndex?.exact || {})
        .filter(key => String(key || '').startsWith('belief:'))
        .sort()
        .map(key => {
          const mechanicKey = key.slice('belief:'.length);
          const value =
            beliefState?.mechanics?.[mechanicKey] ??
            beliefState?.mechanicPosteriors?.[mechanicKey] ??
            beliefState?.[mechanicKey] ??
            null;
          return [key, previewRuntime.stableHash(value)];
        }),
    );
  }

  function invalidateRouteHashesFromFacts(combatData = {}, actorId = '', facts = []) {
    const ids = new Set([String(actorId || '').trim()].filter(Boolean));
    (Array.isArray(facts) ? facts : []).forEach(fact => {
      [fact?.actorId, fact?.targetId, fact?.sourceActorId, fact?.meta?.actorId, fact?.meta?.targetId]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .forEach(id => ids.add(id));
    });
    invalidateRouteUnitHashes(combatData, [...ids]);
  }

  function inferOpportunityGrantType(input = {}) {
    const explicit = String(input?.grantType || '').trim().toUpperCase();
    if (opportunityGrantTypes.includes(explicit)) return explicit;
    const nodeKind = String(input?.nodeKind || 'ACTIVE').trim().toUpperCase();
    const actionRole = normalizeActionRole(input?.actionRole || 'ACTIVE');
    if (nodeKind === 'COUNTER' || actionRole === 'COUNTER') return 'COUNTER_WINDOW';
    if (nodeKind === 'REACTION' || actionRole === 'REACTION') return 'DEFEND_WINDOW';
    if (nodeKind === 'ASSIST' || actionRole === 'ASSIST') return 'ASSIST_WINDOW';
    if (nodeKind === 'CONTINUATION') return 'FOLLOW_UP';
    return 'NATURAL_ACTION';
  }

  function normalizeOpportunityRecord(input = {}) {
    const opportunityId = String(input?.opportunityId || input?.grantId || '').trim();
    const ownerId = String(input?.ownerId || '').trim();
    if (!opportunityId || !ownerId) throw new Error('OPPORTUNITY_SNAPSHOT_INCONSISTENT');
    const grantType = inferOpportunityGrantType(input);
    const sourceActorId = String(input?.sourceActorId || '').trim();
    if (sourceActorId === ownerId && grantType !== 'SELF_TRIGGER') {
      throw new Error('REACTION_SELF_SOURCE_INVALID');
    }
    return {
      opportunityId,
      ownerId,
      role: normalizeActionRole(input?.role || input?.actionRole || 'ACTIVE'),
      sourceActorId,
      sourceActionId: String(input?.sourceActionId || '').trim(),
      grantType,
      validTargetIds: [...new Set((Array.isArray(input?.validTargetIds) ? input.validTargetIds : [])
        .map(value => String(value || '').trim())
        .filter(Boolean))],
      createdAtSequence: Math.max(0, Number(input?.createdAtSequence || input?.actionSequence || 0)),
      expiresAtSequence: Math.max(0, Number(input?.expiresAtSequence || 0)),
      status: String(input?.status || 'PENDING').trim().toUpperCase() || 'PENDING',
      consumedByActionId: String(input?.consumedByActionId || '').trim(),
      lostReason: String(input?.lostReason || '').trim(),
    };
  }

  function opportunitySnapshotFromRuntime(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    return Object.values(runtime.opportunityGraph || {})
      .map(record => cloneValue(record))
      .sort((left, right) =>
        Number(left?.createdAtSequence || 0) - Number(right?.createdAtSequence || 0) ||
        String(left?.opportunityId || '').localeCompare(String(right?.opportunityId || ''))
      );
  }

  function resourceTimelineFromRuntime(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    return (Array.isArray(runtime.resourceTimeline) ? runtime.resourceTimeline : [])
      .map(event => cloneValue(event))
      .sort((left, right) =>
        Number(left?.round || 0) - Number(right?.round || 0) ||
        Number(left?.opportunitySequence || 0) - Number(right?.opportunitySequence || 0) ||
        Number(left?.actionSequence || 0) - Number(right?.actionSequence || 0) ||
        Number(left?.phasePriority || 0) - Number(right?.phasePriority || 0) ||
        Number(left?.effectSequence || 0) - Number(right?.effectSequence || 0) ||
        String(left?.eventId || '').localeCompare(String(right?.eventId || ''))
      );
  }

  function scheduledEventsFromRuntime(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    return Object.values(runtime.scheduleDescriptors || {})
      .map(event => cloneValue(event))
      .sort((left, right) =>
        Number(left?.creationSequence || 0) - Number(right?.creationSequence || 0) ||
        String(left?.descriptorId || '').localeCompare(String(right?.descriptorId || ''))
      );
  }

  function buildRuntimeDecisionSnapshot(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    const opportunitySnapshot = Object.freeze(opportunitySnapshotFromRuntime(combatData));
    const resourceTimeline = Object.freeze(resourceTimelineFromRuntime(combatData));
    const scheduledEvents = Object.freeze(scheduledEventsFromRuntime(combatData));
    const opportunityRevision = `opportunity:${previewRuntime.stableHash(opportunitySnapshot)}`;
    const resourceTimelineRevision = `resource:${previewRuntime.stableHash(resourceTimeline)}`;
    const scheduleRevision = `schedule:${previewRuntime.stableHash(scheduledEvents)}`;
    const evaluationRevision = `runtime-evaluation:${previewRuntime.stableHash({
      opportunityRevision,
      resourceTimelineRevision,
      scheduleRevision,
      firstTerminalSequence: runtime.firstTerminalSequence || null,
    })}`;
    return Object.freeze({
      schemaVersion: '8.3-runtime-snapshot-1',
      opportunitySnapshot,
      resourceTimeline,
      scheduledEvents,
      opportunityRevision,
      resourceTimelineRevision,
      scheduleRevision,
      evaluationRevision,
      firstTerminalSequence: runtime.firstTerminalSequence ? cloneValue(runtime.firstTerminalSequence) : null,
    });
  }

  function buildEventOwnedRuntimeSnapshot(combatData = {}) {
    const runtime = ensureCombatRuntime(combatData);
    const journal = ensureRuntimeFactJournal(combatData);
    const opportunityJournalRevision = Number(journal?.revisions?.opportunity);
    if (!Number.isSafeInteger(opportunityJournalRevision) || opportunityJournalRevision < 0) {
      throw new Error('RUNTIME_OPPORTUNITY_JOURNAL_REVISION_INVALID');
    }
    const scheduledEvents = scheduledEventsFromRuntime(combatData);
    recordRuntimeViewScheduleSnapshot(combatData, scheduledEvents);
    return {
      schemaVersion: '8.3-runtime-snapshot-1',
      opportunitySnapshot: opportunitySnapshotFromRuntime(combatData),
      resourceTimeline: resourceTimelineFromRuntime(combatData),
      scheduledEvents,
      opportunityRevision:
        `opportunity-journal:${opportunityJournalRevision}`,
      opportunityJournalRevision,
      resourceTimelineRevision:
        `resource-journal:${journal.revisions.resourceTimeline}`,
      scheduleRevision:
        `schedule-journal:${journal.revisions.schedule}`,
      evaluationRevision: [
        'runtime-evaluation-journal',
        journal.revisions.visibleWorld,
        journal.revisions.belief,
        journal.revisions.opportunity,
        journal.revisions.resourceTimeline,
        journal.revisions.schedule,
      ].join(':'),
      firstTerminalSequence: runtime.firstTerminalSequence
        ? cloneValue(runtime.firstTerminalSequence)
        : null,
    };
  }

  function buildDecisionRuntimeSnapshot(combatData = {}, actorId = '', actionOpportunity = {}, options = {}) {
    const runtime = ensureCombatRuntime(combatData);
    const eventOwned = options?.eventOwned === true;
    const snapshot = eventOwned
      ? buildEventOwnedRuntimeSnapshot(combatData)
      : cloneValue(buildRuntimeDecisionSnapshot(combatData));
    const opportunityId = String(
      actionOpportunity?.opportunityId ||
      actionOpportunity?.grantId ||
      `decision:${Number(combatData?.回合 || 0)}:${actorId}`,
    ).trim();
    if (!snapshot.opportunitySnapshot.some(record => String(record?.opportunityId || '').trim() === opportunityId)) {
      snapshot.opportunitySnapshot.push(normalizeOpportunityRecord({
        ...actionOpportunity,
        opportunityId,
        ownerId: actorId,
        role: actionOpportunity?.role || 'ACTIVE',
        sourceActorId: String(actionOpportunity?.sourceActorId || '').trim(),
        sourceActionId: actionOpportunity?.sourceActionId || '',
        grantType: actionOpportunity?.grantType,
        status: 'PENDING',
      }));
    }
    const battleHorizon = actionOpportunity?.battleHorizon || {};
    const currentRound = Math.max(0, Number(battleHorizon.currentRound ?? combatData?.回合 ?? 0));
    const finalRound = Math.max(0, Number(battleHorizon.finalRound ?? battleHorizon.roundLimit ?? 0));
    if (finalRound > currentRound) {
      const existingDescriptorIds = new Set(
        snapshot.scheduledEvents.map(record => String(record?.descriptorId || '').trim()),
      );
      const creationBase = Math.max(
        0,
        ...snapshot.opportunitySnapshot.map(record => Number(record?.createdAtSequence || 0)),
        ...snapshot.scheduledEvents.map(record => Number(record?.creationSequence || 0)),
      );
      const cachedQueue = runtime.r8NaturalScheduleCache;
      const currentQueue = Array.isArray(cachedQueue?.queue) ? cachedQueue.queue : null;
      const queue = currentQueue || buildActionQueue(combatData).map(entry => ({
        ownerId: previewRuntime.unitId(entry?.char),
        side: entry?.side || '',
      })).filter(entry => entry.ownerId);
      const queueSignature = eventOwned
        ? queue
            .map(entry => `${entry.ownerId}:${entry.side}`)
            .join('|')
        : previewRuntime.stableHash(queue);
      const cacheKey = `${currentRound}:${finalRound}:${queueSignature}`;
      const cachedDescriptors = cachedQueue?.key === cacheKey
        ? cachedQueue.descriptors
        : null;
      const descriptors = cachedDescriptors || Array.from(
        { length: finalRound - currentRound },
        (_, roundOffset) => currentRound + roundOffset + 1,
      ).flatMap((round, roundIndex) => queue.map((entry, index) => {
        const sequenceOffset = roundIndex * queue.length + index + 1;
        return {
          descriptorId: `future-natural:${round}:${entry.ownerId}`,
          ownerId: entry.ownerId,
          expectedGrantType: 'NATURAL_ACTION',
          round,
          creationOffset: sequenceOffset,
          expiryOffset: sequenceOffset,
          eventType: 'FUTURE_NATURAL_ACTION',
        };
      }));
      const futureSequenceBase = Math.max(creationBase, queue.length);
      if (!cachedDescriptors) {
        runtime.r8NaturalScheduleCache = {
          key: cacheKey,
          queue,
          descriptors,
        };
      }
      descriptors.forEach(descriptor => {
        const descriptorId = String(descriptor?.descriptorId || '').trim();
        if (!descriptorId || existingDescriptorIds.has(descriptorId)) return;
        snapshot.scheduledEvents.push({
          descriptorId,
          ownerId: descriptor.ownerId,
          expectedGrantType: descriptor.expectedGrantType,
          round: Number(descriptor.round || 0),
          scheduledRound: Number(descriptor.round || 0),
          creationSequence:
            futureSequenceBase + Number(descriptor.creationOffset || 0),
          expirySequence:
            futureSequenceBase + Number(descriptor.expiryOffset || 0),
          sourceEventId: opportunityId,
          eventType: descriptor.eventType,
        });
        existingDescriptorIds.add(descriptorId);
      });
      snapshot.scheduledEvents.sort((left, right) =>
        Number(left?.creationSequence || 0) - Number(right?.creationSequence || 0) ||
        String(left?.descriptorId || '').localeCompare(String(right?.descriptorId || ''))
      );
    }
    const decisionActor = listCombatUnits(combatData).find(unit =>
      previewRuntime.unitId(unit) === String(actorId || '').trim()
    );
    const decisionSide = decisionActor ? inferUnitSide(combatData, previewRuntime.unitName(decisionActor)) : '';
    const hostileEntries = listPrimaryCombatUnits(combatData)
      .filter(unit => inferUnitSide(combatData, previewRuntime.unitName(unit)) !== decisionSide);
    const alliedTargets = listPrimaryCombatUnits(combatData)
      .filter(unit => inferUnitSide(combatData, previewRuntime.unitName(unit)) === decisionSide)
      .filter(unit => previewRuntime.isBattleCapable(unit));
    hostileEntries.forEach(source => {
      const charge = source?.蓄力技能;
      if (!charge || !previewRuntime.isBattleCapable(source)) return;
      const remainingCastTime = Math.max(0, Number(
        charge?.cast_time ?? charge?.skill?.前摇 ?? charge?.前摇 ?? 0
      ));
      if (remainingCastTime > 40) return;
      const namedTarget = String(
        charge?.target_id ||
        charge?.targetId ||
        charge?.target_name ||
        charge?.targetIds?.[0] ||
        ''
      ).trim();
      const target = namedTarget
        ? alliedTargets.find(unit => isUnitIdentityMatch(unit, namedTarget))
        : alliedTargets.length === 1 ? alliedTargets[0] : null;
      if (!target || previewRuntime.unitId(target) !== String(actorId || '').trim()) return;
      const sourceActorId = previewRuntime.unitId(source);
      const descriptorId = `visible-charge:${currentRound + 1}:${sourceActorId}:${actorId}`;
      if (snapshot.scheduledEvents.some(record =>
        String(record?.descriptorId || '').trim() === descriptorId
      )) return;
      const creationSequence = Math.max(
        0,
        ...snapshot.opportunitySnapshot.map(record => Number(record?.createdAtSequence || 0)),
        ...snapshot.scheduledEvents.map(record => Number(record?.creationSequence || 0)),
      ) + 1;
      snapshot.scheduledEvents.push({
        descriptorId,
        ownerId: String(actorId || '').trim(),
        sourceActorId,
        targetId: String(actorId || '').trim(),
        targetIds: [String(actorId || '').trim()],
        expectedGrantType: 'DEFEND_WINDOW',
        creationSequence,
        expirySequence: creationSequence,
        sourceEventId: opportunityId,
        eventType: 'VISIBLE_CHARGE_RELEASE',
        incomingAction: {
          ...cloneValue(charge),
          targetId: String(actorId || '').trim(),
          targetIds: [String(actorId || '').trim()],
        },
        threat: true,
      });
    });
    snapshot.scheduledEvents.sort((left, right) =>
      Number(left?.creationSequence || 0) - Number(right?.creationSequence || 0) ||
      String(left?.descriptorId || '').localeCompare(String(right?.descriptorId || ''))
    );
    if (eventOwned) {
      recordRuntimeViewScheduleSnapshot(
        combatData,
        snapshot.scheduledEvents,
      );
      const journal = ensureRuntimeFactJournal(combatData);
      const opportunityJournalRevision = Number(journal?.revisions?.opportunity);
      if (!Number.isSafeInteger(opportunityJournalRevision) || opportunityJournalRevision < 0) {
        throw new Error('RUNTIME_OPPORTUNITY_JOURNAL_REVISION_INVALID');
      }
      snapshot.opportunitySnapshotHash = '';
      snapshot.opportunityCacheHash = '';
      snapshot.resourceTimelineHash = '';
      snapshot.scheduledEventsHash = '';
      snapshot.opportunityRevision = [
        'opportunity-journal',
        opportunityJournalRevision,
        snapshot.opportunitySnapshot.length,
        String(actionOpportunity?.opportunityId || ''),
      ].join(':');
      snapshot.opportunityJournalRevision = opportunityJournalRevision;
      snapshot.resourceTimelineRevision = [
        'resource-journal',
        journal.revisions.resourceTimeline,
        snapshot.resourceTimeline.length,
      ].join(':');
      snapshot.scheduleRevision = [
        'schedule-journal',
        journal.revisions.schedule,
        snapshot.scheduledEvents.length,
      ].join(':');
      snapshot.evaluationRevision = [
        'runtime-evaluation-journal',
        Number(combatData?.回合 || 0),
        journal.revisions.visibleWorld,
        journal.revisions.belief,
        journal.revisions.opportunity,
        journal.revisions.resourceTimeline,
        journal.revisions.schedule,
      ].join(':');
      return Object.freeze(snapshot);
    }
    if (options?.identityLite === true) {
      // 轻身份：这些哈希/Revision 只服务于 r8 系的 session、fact-delta 与
      // 路线目录失效索引；r9 两者皆无（:7826/:8892 门已排除），
      // 却要为它们付出每决策十余次集合级 stableHash。
      snapshot.opportunitySnapshotHash = '';
      snapshot.opportunityCacheHash = '';
      snapshot.resourceTimelineHash = '';
      snapshot.scheduledEventsHash = '';
      snapshot.opportunityRevision =
        `opportunity:lite:${snapshot.opportunitySnapshot.length}:${String(actionOpportunity?.opportunityId || '')}`;
      snapshot.resourceTimelineRevision = `resource:lite:${snapshot.resourceTimeline.length}`;
      snapshot.scheduleRevision = `schedule:lite:${snapshot.scheduledEvents.length}`;
      snapshot.evaluationRevision =
        `runtime-evaluation:lite:${Number(combatData?.回合 || 0)}:${snapshot.firstTerminalSequence || 0}`;
      return Object.freeze(snapshot);
    }
    snapshot.opportunitySnapshotHash = previewRuntime.stableHash(snapshot.opportunitySnapshot);
    snapshot.opportunityCacheHash = previewRuntime.stableHash({
      opportunitySnapshot: snapshot.opportunitySnapshot,
      actionOpportunity,
    });
    snapshot.resourceTimelineHash = previewRuntime.stableHash(snapshot.resourceTimeline);
    snapshot.scheduledEventsHash = previewRuntime.stableHash(snapshot.scheduledEvents);
    snapshot.opportunityRevision = `opportunity:${snapshot.opportunitySnapshotHash}`;
    snapshot.resourceTimelineRevision = `resource:${snapshot.resourceTimelineHash}`;
    snapshot.scheduleRevision = `schedule:${snapshot.scheduledEventsHash}`;
    snapshot.evaluationRevision = `runtime-evaluation:${previewRuntime.stableHash({
      opportunityRevision: snapshot.opportunityRevision,
      resourceTimelineRevision: snapshot.resourceTimelineRevision,
      scheduleRevision: snapshot.scheduleRevision,
      firstTerminalSequence: snapshot.firstTerminalSequence || null,
    })}`;
    return Object.freeze(snapshot);
  }

  function evaluationUnitFactHashes(combatData = {}) {
    const factHashes = {};
    const resources = ['魂力', '精神力', '体力'];
    listCombatUnits(combatData)
      .slice()
      .sort((left, right) =>
        previewRuntime.unitId(left).localeCompare(previewRuntime.unitId(right))
      )
      .forEach(unit => {
        const unitId = previewRuntime.unitId(unit);
        if (!unitId) return;
        factHashes[`unit:${unitId}:hp`] = previewRuntime.stableHash(
          previewRuntime.readHp(unit),
        );
        factHashes[`unit:${unitId}:baseMaxHp`] = previewRuntime.stableHash(
          previewRuntime.readHpMax(unit),
        );
        factHashes[`target:${unitId}:defense`] = previewRuntime.stableHash(
          previewRuntime.readCombatStat(unit, 'def'),
        );
        factHashes[`unit:${unitId}:state:__ACTION`] =
          previewRuntime.stableHash(unit?.__战斗失能原因 || '');
        factHashes[`unit:${unitId}:state:__SHIELD`] =
          previewRuntime.stableHash(previewRuntime.readShield(unit));
        resources.forEach(resource => {
          factHashes[`unit:${unitId}:resource:${resource}`] =
            previewRuntime.stableHash(
              previewRuntime.readResource(unit, resource),
            );
        });
        const stateRows = new Map();
        for (const source of [
          unit?.状态效果,
          unit?.持续效果,
          unit?.属性?.状态效果,
        ]) {
          if (!source || typeof source !== 'object') continue;
          Object.entries(source).forEach(([stateKey, value]) => {
            const normalized = String(stateKey || '').trim();
            if (normalized) stateRows.set(normalized, value);
          });
        }
        stateRows.forEach((value, stateKey) => {
          factHashes[`unit:${unitId}:state:${stateKey}`] =
            previewRuntime.stableHash(value);
        });
      });
    return factHashes;
  }

  function evaluationRecordChanges(
    previous = {},
    current = {},
    idKey = 'id',
  ) {
    return changedHashKeys(previous, current)
      .sort()
      .map(id => ({
        [idKey]: id,
        changeType: previous?.[id] === undefined
          ? 'CREATED'
          : current?.[id] === undefined
            ? 'REMOVED'
            : 'CHANGED',
        beforeHash: String(previous?.[id] || ''),
        afterHash: String(current?.[id] || ''),
      }));
  }

  function captureEvaluationFactState(
    combatData = {},
    runtimeSnapshot = {},
    beliefByActor = new Map(),
  ) {
    const ledger = ensureLedger(combatData);
    const factHashes = evaluationUnitFactHashes(combatData);
    const opportunityHashes = keyedRecordHashes(
      runtimeSnapshot?.opportunitySnapshot,
      record => record?.opportunityId || record?.grantId,
    );
    const resourceTimelineHashes = keyedRecordHashes(
      runtimeSnapshot?.resourceTimeline,
      record => record?.eventId,
    );
    const scheduleHashes = scheduleDependencyHashes(
      runtimeSnapshot?.scheduledEvents,
    );
    const beliefHashes = Object.fromEntries(
      [...beliefByActor.entries()]
        .map(([actorId, belief]) => [
          String(actorId || '').trim(),
          previewRuntime.stableHash(belief || {}),
        ])
        .filter(([actorId]) => actorId)
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    return {
      factHashes,
      opportunityHashes,
      resourceTimelineHashes,
      scheduleHashes,
      beliefHashes,
      ledgerEventIds: ledger.map(event =>
        String(event?.eventId || event?.actionId || '').trim()
      ),
      revisions: {
        visibleWorldRevision:
          `visible-facts:${previewRuntime.stableHash(factHashes)}`,
        beliefRevision:
          `belief:${previewRuntime.stableHash(beliefHashes)}`,
        opportunityRevision: String(
          runtimeSnapshot?.opportunityRevision || '',
        ).trim(),
        resourceTimelineRevision: String(
          runtimeSnapshot?.resourceTimelineRevision || '',
        ).trim(),
        scheduleRevision: String(
          runtimeSnapshot?.scheduleRevision || '',
        ).trim(),
      },
    };
  }

  function buildEvaluationFactDeltaBatch({
    previous = {},
    current = {},
    sequence = 0,
    terminalReached = false,
  } = {}) {
    const opportunityChanges = evaluationRecordChanges(
      previous?.opportunityHashes,
      current?.opportunityHashes,
      'opportunityId',
    );
    const resourceTimelineChanges = evaluationRecordChanges(
      previous?.resourceTimelineHashes,
      current?.resourceTimelineHashes,
      'eventId',
    );
    const scheduleChanges = evaluationRecordChanges(
      previous?.scheduleHashes,
      current?.scheduleHashes,
      'descriptorId',
    );
    const visibleBeliefChanges = evaluationRecordChanges(
      previous?.beliefHashes,
      current?.beliefHashes,
      'actorId',
    );
    const changedFactKeys = new Set(
      changedHashKeys(previous?.factHashes, current?.factHashes),
    );
    opportunityChanges.forEach(change =>
      changedFactKeys.add(`opportunity:${change.opportunityId}`)
    );
    scheduleChanges.forEach(change =>
      changedFactKeys.add(`schedule:${change.descriptorId}`)
    );
    visibleBeliefChanges.forEach(change =>
      changedFactKeys.add(`belief:${change.actorId}`)
    );
    const currentEventById = new Map(
      (current?.runtimeSnapshot?.resourceTimeline || []).map(event => [
        String(event?.eventId || '').trim(),
        event,
      ]),
    );
    resourceTimelineChanges.forEach(change => {
      const event = currentEventById.get(change.eventId);
      const actorId = String(
        event?.actorId ||
        event?.unitId ||
        event?.targetId ||
        event?.ownerId ||
        '',
      ).trim();
      const resource = String(event?.resource || '').trim();
      if (actorId && resource) {
        changedFactKeys.add(`unit:${actorId}:resource:${resource}`);
      }
    });
    const previousEventCount = Math.max(
      0,
      Number(previous?.ledgerEventIds?.length || 0),
    );
    return {
      sequence: Math.max(0, Number(sequence || 0)),
      sourceEventIds: (current?.ledgerEventIds || [])
        .slice(previousEventCount)
        .filter(Boolean),
      changedFactKeys: [...changedFactKeys].sort(),
      opportunityChanges,
      resourceTimelineChanges,
      scheduleChanges,
      visibleBeliefChanges,
      terminalReached: terminalReached === true,
      revisions: cloneValue(current?.revisions || {}),
    };
  }

  function buildNoOpRuntimeSnapshot(runtimeSnapshot = {}, opportunityId = '') {
    const source = cloneValue(runtimeSnapshot && typeof runtimeSnapshot === 'object' ? runtimeSnapshot : {});
    const wantedId = String(opportunityId || '').trim();
    const opportunities = Array.isArray(source.opportunitySnapshot) ? source.opportunitySnapshot : [];
    let matched = false;
    source.opportunitySnapshot = opportunities.map(record => {
      if (String(record?.opportunityId || '').trim() !== wantedId) return record;
      if (!['PENDING', 'EXECUTING'].includes(String(record?.status || '').trim().toUpperCase())) {
        throw new Error('OPPORTUNITY_SNAPSHOT_INCONSISTENT');
      }
      matched = true;
      return {
        ...record,
        status: 'CONSUMED',
        consumedByActionId: `NO_OP:${wantedId}`,
        lostReason: '',
      };
    });
    if (!matched) throw new Error('OPPORTUNITY_SNAPSHOT_INCONSISTENT');
    source.noOp = {
      opportunityId: wantedId,
      consumesOpportunity: true,
      paysResources: false,
      establishesStance: false,
      triggersActionReaction: false,
    };
    return Object.freeze(source);
  }

  function getBattleSnapshot(combatData = {}) {
    if (!combatData || typeof combatData !== 'object') return null;
    const buildUnit = unit => {
      if (!unit || typeof unit !== 'object') return null;
      const level = Math.max(1, Number(unit?.lv ?? unit?.level ?? unit?.等级 ?? unit?.属性?.等级 ?? 1));
      const states = unit?.状态效果 && typeof unit.状态效果 === 'object' ? Object.entries(unit.状态效果) : [];
      const summonRuntime = unit?.__battleRuntime || {};
      const actionState = previewRuntime.isDead(unit)
        ? 'DEAD'
        : String(unit?.__战斗失能原因 || '').trim() ||
          (previewRuntime.isBattleCapable(unit) ? '' : 'INCAPACITATED');
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
        shield: Math.max(previewRuntime.readShield(unit), currentShieldTotal(unit)),
        护盾: Math.max(previewRuntime.readShield(unit), currentShieldTotal(unit)),
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
    const actionGroupNodeCounts = new Map();
    const normalizeRole = typeof options?.normalizeRole === 'function'
      ? options.normalizeRole
      : value => String(value || 'ACTIVE').trim().toUpperCase();
    const normalizeActionName = typeof options?.normalizeActionName === 'function'
      ? options.normalizeActionName
      : value => String(value || '').trim();
    const isRegisteredActor = typeof options?.isRegisteredActor === 'function'
      ? options.isRegisteredActor
      : () => true;
    const describeActor = typeof options?.describeActor === 'function'
      ? options.describeActor
      : entry => String(entry?.char?.name || entry?.char?.名称 || '').trim();
    const describeActorId = typeof options?.describeActorId === 'function'
      ? options.describeActorId
      : entry => String(
        entry?.char?.id ||
        entry?.char?.name ||
        entry?.char?.名称 ||
        entry?.id ||
        entry?.name ||
        entry?.名称 ||
        '',
      ).trim();
    const onTrace = typeof options?.onTrace === 'function' ? options.onTrace : () => {};
    const onFatal = typeof options?.onFatal === 'function' ? options.onFatal : () => {};
    const onOpportunityChange = typeof options?.onOpportunityChange === 'function'
      ? options.onOpportunityChange
      : () => {};
    const opportunities = new Map();
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
      const opportunity = opportunities.get(String(node?.opportunityId || '').trim());
      if (opportunity) {
        let opportunityChanged = false;
        if (state === 'EXECUTING' && opportunity.status !== 'EXECUTING') {
          opportunity.status = 'EXECUTING';
          opportunityChanged = true;
        }
        if (['EXECUTED', 'COMPLETED'].includes(state)) {
          opportunity.status = 'CONSUMED';
          opportunity.consumedByActionId = String(
            detail?.actionId ||
            detail?.reactionEventId ||
            node?.sourceActionId ||
            `grant:${node?.grantId || node?.opportunityId || ''}`,
          ).trim();
          opportunity.lostReason = '';
          opportunityChanged = true;
        }
        if (state === 'CANCELLED') {
          opportunity.status = 'LOST';
          opportunity.lostReason = String(detail?.reason || 'CANCELLED').trim();
          opportunityChanged = true;
        }
        if (state === 'FATAL') {
          opportunity.status = 'FATAL';
          opportunity.lostReason = String(detail?.code || 'FATAL').trim();
          opportunityChanged = true;
        }
        if (opportunityChanged) onOpportunityChange(cloneValue(opportunity));
      }
      onTrace({
        state,
        round: Number(node?.round || round || 0),
        actionSequence: Number(node?.actionSequence || 0),
        parentActionSequence: Number(node?.parentActionSequence || 0),
        actorTurnSequence: Number(node?.actorTurnSequence || 0),
        phasePriority: Number(node?.phasePriority || 0),
        insertionSequence: Number(node?.insertionSequence || 0),
        grantId: String(node?.grantId || '').trim(),
        actorId: describeActorId(node?.actorEntry),
        actorName: describeActor(node?.actorEntry),
        nodeKind: String(node?.nodeKind || 'ACTIVE').trim(),
        actionRole: normalizeRole(node?.actionRole || 'ACTIVE'),
        actorControl: String(node?.actorControl || 'AI').trim() || 'AI',
        sourceActionId: String(node?.sourceActionId || '').trim(),
        opportunityId: String(node?.opportunityId || '').trim(),
        opportunitySequence: Math.max(0, Number(node?.opportunitySequence || 0)),
        grantType: String(node?.grantType || '').trim(),
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
      const actorTurnSequence = Math.max(0, Number(input.actorTurnSequence || 0));
      const actionGroupId = String(
        input.actionGroupId ||
        `${round}:${actorTurnSequence || Math.max(1, Number(input.parentActionSequence || 0))}`,
      ).trim();
      const actionGroupNodeCount = Math.max(0, Number(actionGroupNodeCounts.get(actionGroupId) || 0));
      if (actionGroupNodeCount >= 64) {
        return fail('ACTION_QUEUE_NODE_LIMIT_EXCEEDED', input, {
          actionGroupId,
          actionGroupNodeCount,
          maxNodes: 64,
        });
      }
      granted.add(grantId);
      actionGroupNodeCounts.set(actionGroupId, actionGroupNodeCount + 1);
      const node = {
        round: Number(input.round || round || 0),
        actorEntry: input.actorEntry,
        state: input.state && typeof input.state === 'object' ? input.state : {},
        actorTurnSequence,
        actionGroupId,
        parentActionSequence: Math.max(0, Number(input.parentActionSequence || 0)),
        phasePriority: Math.max(0, Number(input.phasePriority || 40)),
        insertionSequence: ++insertionSequence,
        actionSequence: ++actionSequence,
        grantId,
        opportunityId: String(input.opportunityId || grantId).trim(),
        opportunitySequence: Math.max(0, Number(input.opportunitySequence || actionSequence)),
        nodeKind: String(input.nodeKind || 'ACTIVE').trim(),
        actionRole: normalizeRole(input.actionRole || 'ACTIVE'),
        actorControl: String(input.actorControl || input?.actorEntry?.__actorControl || 'AI').trim() || 'AI',
        sourceActionId: String(input.sourceActionId || '').trim(),
        sourceActorId: String(input.sourceActorId || '').trim(),
        grantType: inferOpportunityGrantType(input),
        validTargetIds: [...new Set((Array.isArray(input.validTargetIds) ? input.validTargetIds : [])
          .map(value => String(value || '').trim())
          .filter(Boolean))],
        expiresAtSequence: Math.max(0, Number(input.expiresAtSequence || 0)),
        actionName: normalizeActionName(input.actionName || ''),
        execute: typeof input.execute === 'function' ? input.execute : null,
      };
      const actorId = describeActorId(node.actorEntry);
      if (!actorId || !isRegisteredActor(actorId, node.actorEntry, node)) {
        return fail('OPPORTUNITY_OWNER_NOT_REGISTERED_UNIT', input, {
          actorId,
          nodeKind: node.nodeKind,
          grantId,
          opportunityId: node.opportunityId,
        });
      }
      if (node.nodeKind !== 'PRIMARY_SETTLEMENT') {
        const opportunity = normalizeOpportunityRecord({
          ...node,
          ownerId: actorId,
          role: node.actionRole,
          createdAtSequence: node.actionSequence,
        });
        if (opportunities.has(opportunity.opportunityId)) {
          return fail('ACTION_GRANT_DUPLICATE', input, { grantId, opportunityId: opportunity.opportunityId });
        }
        opportunities.set(opportunity.opportunityId, opportunity);
        onOpportunityChange(cloneValue(opportunity));
      }
      pending.push(node);
      recordTrace('ENQUEUED', node);
      return true;
    };
    (Array.isArray(options?.initialEntries) ? options.initialEntries : []).forEach((actorEntry, index) => {
      const naturalOpportunity = actorEntry?.char?.__battleRuntime?.naturalOpportunity;
      const opportunityId = String(
        naturalOpportunity?.opportunityId ||
        `natural:${round}:${actorEntry?.side || ''}:${describeActor(actorEntry) || 'unit'}:${index + 1}`,
      ).trim();
      enqueue({
        actorEntry,
        actorControl: String(actorEntry?.__actorControl || 'AI').trim() || 'AI',
        actorTurnSequence: index + 1,
        parentActionSequence: 0,
        phasePriority: 40,
        grantId: String(naturalOpportunity?.grantId || opportunityId).trim(),
        opportunityId,
        opportunitySequence: Math.max(1, Number(naturalOpportunity?.sequence || index + 1)),
        grantType: 'NATURAL_ACTION',
        sourceActorId: '',
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
      cancelPending(reason = 'CANCELLED') {
        const cancelled = pending.splice(0).sort(compareNodes);
        cancelled.forEach(node => recordTrace('CANCELLED', node, { reason }));
        return cancelled;
      },
      hasPending(predicate) {
        return typeof predicate === 'function' && pending.some(predicate);
      },
      opportunitySnapshot() {
        return [...opportunities.values()]
          .map(record => cloneValue(record))
          .sort((left, right) =>
            Number(left?.createdAtSequence || 0) - Number(right?.createdAtSequence || 0) ||
            String(left?.opportunityId || '').localeCompare(String(right?.opportunityId || ''))
          );
      },
      get fatal() { return fatal; },
      get pendingCount() { return pending.length; },
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
    fighters.sort((left, right) => previewRuntime.compareNaturalActionOrder(left.char, right.char));
    return fighters;
  }

  function initializeNaturalOpportunityStates(entries = [], round = 0) {
    entries.forEach((entry, index) => {
      const unit = entry?.char;
      if (!unit || typeof unit !== 'object') return;
      unit.__battleRuntime = unit.__battleRuntime && typeof unit.__battleRuntime === 'object'
        ? unit.__battleRuntime
        : {};
      unit.__battleRuntime.naturalOpportunity = {
        round: Number(round || 0),
        opportunityId: `natural:${Number(round || 0)}:${entry?.side || ''}:${previewRuntime.unitName(unit) || 'unit'}:${index + 1}`,
        grantId: `natural:${Number(round || 0)}:${entry?.side || ''}:${previewRuntime.unitName(unit) || 'unit'}:${index + 1}`,
        sequence: index + 1,
        ownerId: previewRuntime.unitId(unit),
        role: 'ACTIVE',
        sourceActorId: '',
        sourceActionId: '',
        grantType: 'NATURAL_ACTION',
        validTargetIds: [],
        createdAtSequence: index + 1,
        expiresAtSequence: 0,
        status: 'PENDING',
        consumedByActionId: '',
        fusionKey: '',
      };
    });
  }

  function createEmptyCombatEffectMap() {
    return {
      skip_turn: false, cannot_react: false, invincible: false, 无视异常: false, skill_seal: false, 探查屏蔽: false,
      dot_damage: 0, dot_damage_ratio: 0, armor_pen: 0, reaction_bonus: 0, reaction_penalty: 0,
      attacker_speed_bonus: 0, cast_speed_bonus: 0, cast_speed_penalty: 0, hit_bonus: 0, hit_penalty: 0,
      dodge_bonus: 0, dodge_penalty: 0, lock_level: 0, interrupt_bonus: 0, final_damage_mult: 1,
      received_damage_mult: 1, defense_strip: 0, spirit_resist_strip: 0, final_damage_bonus: 0,
      final_heal_mult: 1, final_heal_bonus: 0, final_heal_limited: [], shield_gain_mult: 1, shield_gain_bonus: 0, skill_effect_mult: 1,
      vit_gain_ratio: 0, sp_gain_ratio: 0, men_gain_ratio: 0, heal_block_ratio: 0, hot_heal_ratio: 0,
      cost_ratio: 1, cost_delta: 0, cost_delta_ratio: 0, windup_ratio: 1, windup_delta: 0,
      random_target_rate: 0, 判断干扰强度: 0, 索敌干扰强度: 0, stealth_level: 0, 探查反制: false, sense_pierce: false, abnormal_resistance: 0, min_hp_floor: 0,
      death_save_count: 0, revive_count: 0, revive_heal_ratio: 0, damage_reflect_ratio: 0,
      damage_transfer_ratio: 0, damage_transfer_target: '', 吸收来源: '', 吸收资源: '', 吸收转化效果: '',
      伤害吸收增幅上限: 0, damage_share_ratio: 0, damage_share_count: 0, cost_share_ratio: 0,
      cost_share_count: 0, damage_to_heal_ratio: 0, heal_to_damage_ratio: 0, heal_inversion_ratio: 0,
      invincible_tier_threshold: 0, 每日触发次数上限: 0, bonus_true_damage_ratio: 0, element_seal_ratio: 0,
      misfortune_check_rate: 0, misfortune_backlash_ratio: 0, silence: false, disarm: false, blind: false,
      counter_attack_ratio: 0, damage_reduction: 0, damage_bonus_limited: [], damage_reduction_limited: [], block_count: 0, super_armor: false, action_lock_rounds: 0,
      interrupt_window: 0, multi_hit_count: 0, segment_damage_ratio: 0,
      resource_tick_resource: '', resource_tick_ratio: 0, resource_tick_amount: 0,
    };
  }

  function mergeCombatEffectMaps(base = createEmptyCombatEffectMap(), incoming = {}) {
    const seed = createEmptyCombatEffectMap();
    const result = { ...seed, ...(base || {}) };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (!(key in seed) || value === undefined) return;
      if (['skip_turn', 'cannot_react', 'silence', 'disarm', 'blind', 'super_armor', 'invincible', '无视异常', 'skill_seal', '探查屏蔽', '探查反制', 'sense_pierce'].includes(key)) {
        result[key] = !!result[key] || !!value;
      } else if (['damage_bonus_limited', 'damage_reduction_limited', 'final_heal_limited'].includes(key)) {
        result[key] = [
          ...(Array.isArray(result[key]) ? result[key] : []),
          ...(Array.isArray(value) ? cloneValue(value) : []),
        ];
      } else if (key === 'abnormal_resistance') {
        result[key] = Math.max(Number(result[key] || 0), Math.min(1, Math.max(0, Number(value || 0))));
      } else if (['final_damage_mult', 'received_damage_mult', 'final_heal_mult', 'shield_gain_mult', 'skill_effect_mult', 'cost_ratio', 'windup_ratio'].includes(key)) {
        result[key] = Number(result[key] ?? 1) * Number(value ?? 1);
      } else if (['defense_strip', 'spirit_resist_strip', 'cost_delta_ratio'].includes(key)) {
        result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
      } else if (['damage_transfer_target', '吸收来源', '吸收资源', '吸收转化效果', 'resource_tick_resource'].includes(key)) {
        result[key] = String(value || result[key] || '').trim();
      } else if (['lock_level', 'death_save_count', 'revive_count', 'block_count', 'min_hp_floor', 'damage_share_count', 'cost_share_count', 'invincible_tier_threshold', '每日触发次数上限', 'action_lock_rounds', 'multi_hit_count'].includes(key)) {
        result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
      } else {
        result[key] = Number(result[key] ?? 0) + Number(value ?? 0);
      }
    });
    return result;
  }

  function buildCombatFinalStats(unit = {}, currentTick = 0) {
    const source = unit && typeof unit === 'object' ? { ...unit } : {};
    delete source.final;
    const final = JSON.parse(JSON.stringify(source));
    final.状态效果 = JSON.parse(JSON.stringify(unit?.状态效果 || {}));
    final.战斗效果 = createEmptyCombatEffectMap();
    const normalizedTick = Math.max(0, Number(currentTick || 0));
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
      if (!(expiresAt > 0 && normalizedTick >= expiresAt)) applyCopiedStats(record.属性快照);
    });
    if (final.sp_max !== undefined && final.sp !== undefined) final.sp = Math.min(final.sp, final.sp_max);
    if (final.vit_max !== undefined && final.vit !== undefined) final.vit = Math.min(final.vit, final.vit_max);
    if (final.men_max !== undefined && final.men !== undefined) final.men = Math.min(final.men, final.men_max);
    const staminaScale = previewRuntime.staminaScaleForUnit(unit);
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

  function itemPassiveConsumer() {
    const candidates = [root];
    try { if (root.parent && root.parent !== root) candidates.push(root.parent); } catch (_error) {}
    try { if (root.top && root.top !== root) candidates.push(root.top); } catch (_error) {}
    return candidates
      .map(candidate => candidate && candidate.__LWCS_ITEM_PASSIVE_CONSUMER_V1__)
      .find(consumer => consumer && typeof consumer.编译角色装备被动消费者_V1 === 'function') || null;
  }

  function applySkillEquipmentRequirements(actor = {}, skill = {}) {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) return skill;
    const requirements = itemPassiveConsumer();
    const checker = requirements?.装备要求满足_V1;
    if (skill.装备要求 !== undefined && (typeof checker !== 'function' || !checker(actor, skill.装备要求))) {
      throw new Error(`battle_skill_equipment_requirement_unmet:${String(skill?.魂技名 || skill?.name || '技能').trim()}`);
    }
    const effects = Array.isArray(skill._效果数组) ? skill._效果数组 : [];
    const gatedEffects = effects.filter(effect =>
      effect?.装备要求 === undefined || (typeof checker === 'function' && checker(actor, effect.装备要求)),
    );
    return gatedEffects.length === effects.length ? skill : { ...skill, _效果数组: gatedEffects };
  }

  function equipmentPassivePanel(effect = {}) {
    const ratio = {};
    const fixed = {};
    const aliases = {
      力量: 'str', 防御: 'def', 敏捷: 'agi',
      体力上限: 'vit_max', 生命上限: 'vit_max',
      魂力上限: 'sp_max', 精神力上限: 'men_max',
    };
    const attributes = (Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性])
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const raw = String(effect?.数值 ?? '').trim();
    const numeric = Number(raw.replace('%', ''));
    if (!Number.isFinite(numeric)) return { ratio, fixed };
    attributes.forEach(attribute => {
      const key = aliases[attribute] || attribute;
      if (!key) return;
      if (/%$/.test(raw)) ratio[key] = 1 + numeric / 100;
      else fixed[key] = numeric;
    });
    return { ratio, fixed };
  }

  function syncEquipmentPassiveRuntime(unit = {}, currentTick = 0, options = {}) {
    if (!unit || typeof unit !== 'object') return null;
    unit.__battleRuntime = unit.__battleRuntime && typeof unit.__battleRuntime === 'object' ? unit.__battleRuntime : {};
    const consumer = itemPassiveConsumer();
    const packageValue = options.packageValue && typeof options.packageValue === 'object'
      ? options.packageValue
      : consumer
        ? consumer.编译角色装备被动消费者_V1(unit)
      : { 版本: 'item-passive-consumer-v1', 有效: false, 来源物品列表: [], 技能条目: [], 常驻效果: [], 动作效果: [], 非战斗路由: [], 未支持路由: [] };
    const signature = previewRuntime.stableHash({
      来源物品列表: packageValue.来源物品列表 || [],
      常驻效果: packageValue.常驻效果 || [],
      动作效果: packageValue.动作效果 || [],
      阶段技能: (packageValue.技能条目 || []).map(entry => ({
        技能名: entry?.技能名 || '',
        技能: entry?.技能 || {},
      })),
      非战斗路由: packageValue.非战斗路由 || [],
      未支持路由: packageValue.未支持路由 || [],
    });
    if (unit.__battleRuntime.__itemPassiveSignature === signature && unit.__battleRuntime.itemPassivePackage) {
      return unit.__battleRuntime.itemPassivePackage;
    }
    unit.__battleRuntime.__itemPassiveSignature = signature;
    unit.__battleRuntime.itemPassivePackage = packageValue;
    unit.__battleRuntime.itemPassiveTriggeredSkills = (Array.isArray(packageValue.技能条目) ? packageValue.技能条目 : [])
      .flatMap(entry => {
        const skill = entry?.技能 && typeof entry.技能 === 'object' ? cloneValue(entry.技能) : null;
        if (!skill) return [];
        const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
        const triggered = effects.filter(effect => ['战斗开始', '回合开始', '受击前', '受击后', '濒死时', '被控制时', '命中后']
          .includes(String(effect?.触发方式 || skill?.触发方式 || '').trim()));
        if (!triggered.length) return [];
        return [{
          ...skill,
          承载方式: '被动',
          __equipmentPassiveTriggered: true,
          魂技名: String(skill.魂技名 || entry?.技能名 || '装备阶段被动').trim(),
          _效果数组: triggered,
        }];
      });
    unit.__battleRuntime.itemPassiveRoutes = Array.isArray(packageValue.非战斗路由) ? packageValue.非战斗路由 : [];
    unit.状态效果 = unit.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : {};
    const activeStateKeys = new Set();
    (Array.isArray(packageValue.常驻效果) ? packageValue.常驻效果 : []).forEach(entry => {
      const effect = entry?.效果 && typeof entry.效果 === 'object' ? entry.效果 : {};
      const source = entry?.来源 && typeof entry.来源 === 'object' ? entry.来源 : {};
      const stateKey = `__equipment_passive__${previewRuntime.stableHash({ source, effect })}`;
      const stateName = `装备被动:${String(source.来源物品 || '').trim()}:${String(source.技能名 || '被动技能').trim()}`;
      const panel = equipmentPassivePanel(effect);
      activeStateKeys.add(stateKey);
      unit.状态效果[stateKey] = {
        ...effect,
        状态: String(effect.状态 || stateName).trim() || stateName,
        状态名称: String(effect.状态名称 || effect.状态 || stateName).trim() || stateName,
        类型: String(effect.类型 || 'buff').trim() || 'buff',
        duration: 1000000,
        持续回合: 1000000,
        战斗效果: equipmentPassiveCombatEffect(effect, source),
        面板修改比例: panel.ratio,
        面板固定修正: panel.fixed,
        __equipmentSourceItem: String(source.来源物品 || '').trim(),
        __equipmentSkillName: String(source.技能名 || '').trim(),
        __equipmentState: true,
        __equipmentPassiveState: true,
      };
    });
    Object.entries(unit.状态效果).forEach(([key, state]) => {
      if (state?.__equipmentPassiveState === true && !activeStateKeys.has(key)) delete unit.状态效果[key];
    });
    if (unit.__battleRuntime.damageAbsorptionStorageByState && typeof unit.__battleRuntime.damageAbsorptionStorageByState === 'object') {
      Object.keys(unit.__battleRuntime.damageAbsorptionStorageByState).forEach(key => {
        if (!activeStateKeys.has(key)) delete unit.__battleRuntime.damageAbsorptionStorageByState[key];
      });
    }
    if (options.rebuildFinal === true) unit.final = buildCombatFinalStats(unit, currentTick);
    return packageValue;
  }

  function equipmentPassiveActionEffects(unit = {}) {
    const packageValue = unit?.__battleRuntime?.itemPassivePackage || syncEquipmentPassiveRuntime(unit, 0, { rebuildFinal: false });
    return (Array.isArray(packageValue?.动作效果) ? packageValue.动作效果 : [])
      .filter(entry => !['战斗开始', '回合开始', '受击前', '受击后', '濒死时', '被控制时', '命中后']
        .includes(String(entry?.触发方式 || entry?.效果?.触发方式 || '').trim()))
      .filter(entry => !equipmentPassiveImplicitStagePhase(entry?.效果 || {}))
      .map(entry => entry?.效果)
      .filter(effect => effect && typeof effect === 'object' && !Array.isArray(effect));
  }

  function equipmentPassiveEffectKey(effect = {}) {
    const value = cloneValue(effect);
    if (value && typeof value === 'object') delete value.条件分支;
    return previewRuntime.stableHash(value);
  }

  function equipmentPassiveTriggerAllowed(unit = {}, effect = {}, combatData = {}, actionEvent = {}, commit = false) {
    const limit = effect?.触发限制 && typeof effect.触发限制 === 'object' && !Array.isArray(effect.触发限制)
      ? effect.触发限制
      : null;
    const period = String(limit?.周期 || '').trim();
    const allowedCount = Math.max(0, Math.floor(Number(limit?.次数 || 0)));
    if (!limit || !(allowedCount > 0) || !['每日', '每战', '每回合', '每次满足', '每次行动', '每次施放', '主动使用'].includes(period)) return true;
    const runtime = unit.__技能限制运行态 && typeof unit.__技能限制运行态 === 'object'
      ? unit.__技能限制运行态
      : (unit.__技能限制运行态 = {});
    const battleRuntime = ensureCombatRuntime(combatData);
    if (!battleRuntime.itemPassiveBattleId) battleRuntime.itemPassiveBattleId = nextRuntimeId('item-passive-battle');
    const currentTick = Math.max(0, Math.floor(Number(combatData?.当前世界tick || combatData?.当前tick || 0)));
    const periodKey = period === '每战'
      ? battleRuntime.itemPassiveBattleId
      : period === '每日'
        ? Math.floor(currentTick / 144)
        : period === '每回合'
          ? Math.max(0, Math.floor(Number(combatData?.回合 || 0)))
          : String(actionEvent?.actionId || `${currentTick}:${Number(combatData?.回合 || 0)}`).trim();
    const stateKey = `装备被动:${previewRuntime.stableHash(effect)}:${period}`;
    const state = runtime[stateKey] && typeof runtime[stateKey] === 'object'
      ? runtime[stateKey]
      : (runtime[stateKey] = { 周期标记: periodKey, 已用次数: 0 });
    if (String(state.周期标记) !== String(periodKey)) {
      state.周期标记 = periodKey;
      state.已用次数 = 0;
    }
    if (Number(state.已用次数 || 0) >= allowedCount) return false;
    if (commit) state.已用次数 = Math.max(0, Number(state.已用次数 || 0)) + 1;
    return true;
  }

  function settleEquipmentPassiveTriggerCost({
    combatData = {},
    actor = {},
    effect = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
  } = {}) {
    const raw = effect?.触发消耗;
    if (raw === undefined || raw === null || raw === '' || raw === '无') return [];
    let costMap = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw.启动 && typeof raw.启动 === 'object' ? raw.启动 : raw)
      : {};
    if (typeof raw === 'string') {
      costMap = Object.fromEntries(
        raw.split(/[;；,，、]+/)
          .map(part => part.match(/^\s*([^:：]+)\s*[:：]\s*(.+?)\s*$/))
          .filter(Boolean)
          .map(match => [String(match[1] || '').trim(), String(match[2] || '').trim()]),
      );
    }
    const normalized = previewRuntime.normalizeSkillCostMap(costMap, 'absolute', '触发');
    if (normalized.非法项.length) {
      writeLedgerEvent(combatData, {
        eventKind: 'action_cost',
        round: Number(combatData?.回合 || 0),
        actorId: previewRuntime.unitId(actor),
        actorName: previewRuntime.unitName(actor),
        targetId: previewRuntime.unitId(actor),
        targetName: previewRuntime.unitName(actor),
        actionName: action.actionName,
        actionType: action.actionKind,
        actionRole,
        actionId: actionEvent?.actionId || '',
        sourceActionId: actionEvent?.actionId || '',
        result: 'invalid',
        resultState: 'FAILURE',
        ruleCode: 'PASSIVE_TRIGGER_COST_INVALID',
        meta: { source: 'equipment_passive_trigger', raw: cloneValue(raw), errors: [...normalized.非法项] },
      });
      return [];
    }
    const paymentPlan = previewRuntime.assessResourcePayment([actor], normalized.values);
    if (!paymentPlan.valid || !paymentPlan.ok) {
      writeLedgerEvent(combatData, {
        eventKind: 'action_cost',
        round: Number(combatData?.回合 || 0),
        actorId: previewRuntime.unitId(actor),
        actorName: previewRuntime.unitName(actor),
        targetId: previewRuntime.unitId(actor),
        targetName: previewRuntime.unitName(actor),
        actionName: action.actionName,
        actionType: action.actionKind,
        actionRole,
        actionId: actionEvent?.actionId || '',
        sourceActionId: actionEvent?.actionId || '',
        result: 'insufficient',
        resultState: 'FAILURE',
        ruleCode: 'PASSIVE_TRIGGER_COST_INSUFFICIENT',
        meta: { source: 'equipment_passive_trigger', reason: paymentPlan.reason, costs: cloneValue(normalized.values) },
      });
      return [];
    }
    const facts = [];
    paymentPlan.payments.forEach(payment => {
      const before = persistentResourceValue(actor, payment.key);
      const after = before - payment.amount;
      writeCombatResource(actor, payment.key, after);
      facts.push(writeStructuredResourceFact(
        combatData,
        actor,
        actor,
        action,
        actionEvent,
        payment.key,
        -payment.amount,
        actionRole,
        'PAY',
        {
          before,
          after,
          source: 'equipment_passive_trigger',
          factType: 'RESOURCE',
          effectPrototype: String(effect?.原型 || '').trim(),
          sourceEffectId: String(effect?.effectId || effect?.效果ID || '').trim(),
          meta: { triggerCost: true, resource: payment.resource, amount: payment.amount },
        },
      ));
    });
    return facts.filter(Boolean);
  }

  function appendEquipmentPassiveActionEffects(unit = {}, effects = []) {
    const current = Array.isArray(effects) ? effects.filter(effect => effect && typeof effect === 'object') : [];
    const seen = new Set(current.map(effect => previewRuntime.stableHash(effect)));
    equipmentPassiveActionEffects(unit).forEach(effect => {
      const fingerprint = previewRuntime.stableHash(effect);
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      current.push(cloneValue(effect));
    });
    return current;
  }

  function mergeEquipmentPassiveActionSkill(unit = {}, skill = {}) {
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    const nextEffects = appendEquipmentPassiveActionEffects(unit, effects);
    if (nextEffects.length === effects.length) return skill;
    return { ...skill, _效果数组: nextEffects };
  }

  function prepareCombatData(combatData = {}, resolveCharacter = null) {
    if (!combatData?.参战者 || typeof combatData.参战者 !== 'object') return combatData;
    const statFields = ['等级', 'HP', 'HP上限', '体力', '体力上限', '魂力', '魂力上限', '精神力', '精神力上限', '力量', '防御', '敏捷', '幸运'];
    const statusFields = ['存活', '位置', '行动'];
    const readCharacter = typeof resolveCharacter === 'function' ? resolveCharacter : () => null;
    const mergeParticipant = participant => {
      if (!participant || typeof participant !== 'object' || Array.isArray(participant)) return participant;
      const name = String(participant.name || participant.名称 || '').trim();
      const sourceCharacter = !participant.召唤键 && name ? readCharacter(name) : null;
      const merged = sourceCharacter && typeof sourceCharacter === 'object' && !Array.isArray(sourceCharacter)
        ? { ...cloneValue(sourceCharacter), ...cloneValue(participant) }
        : cloneValue(participant);
      merged.name = name || String(merged.name || merged.名称 || '').trim();
      merged.名称 = String(merged.名称 || merged.name || '').trim();
      const sourceStats = sourceCharacter?.属性 && typeof sourceCharacter.属性 === 'object' ? sourceCharacter.属性 : {};
      const participantStats = participant?.属性 && typeof participant.属性 === 'object' ? participant.属性 : {};
      merged.属性 = { ...cloneValue(sourceStats), ...cloneValue(participantStats) };
      statFields.forEach(field => {
        if (participant[field] !== undefined) merged.属性[field] = cloneValue(participant[field]);
      });
      const sourceStatus = sourceCharacter?.状态 && typeof sourceCharacter.状态 === 'object' ? sourceCharacter.状态 : {};
      const participantStatus = participant?.状态 && typeof participant.状态 === 'object' ? participant.状态 : {};
      merged.状态 = { ...cloneValue(sourceStatus), ...cloneValue(participantStatus) };
      statusFields.forEach(field => {
        if (participant[field] !== undefined) merged.状态[field] = cloneValue(participant[field]);
      });
      const sourceAttributeStates = sourceCharacter?.属性?.状态效果 && typeof sourceCharacter.属性.状态效果 === 'object' && !Array.isArray(sourceCharacter.属性.状态效果)
        ? sourceCharacter.属性.状态效果
        : {};
      const participantAttributeStates = participant?.属性?.状态效果 && typeof participant.属性.状态效果 === 'object' && !Array.isArray(participant.属性.状态效果)
        ? participant.属性.状态效果
        : {};
      const participantDirectStates = participant?.状态效果 && typeof participant.状态效果 === 'object' && !Array.isArray(participant.状态效果)
        ? participant.状态效果
        : {};
      const sourceDirectStates = sourceCharacter?.状态效果 && typeof sourceCharacter.状态效果 === 'object' && !Array.isArray(sourceCharacter.状态效果)
        ? sourceCharacter.状态效果
        : {};
      merged.状态效果 = {
        ...cloneValue(sourceAttributeStates),
        ...cloneValue(sourceDirectStates),
        ...cloneValue(participantAttributeStates),
        ...cloneValue(participantDirectStates),
      };
      if (participant.持续效果 && typeof participant.持续效果 === 'object' && !Array.isArray(participant.持续效果)) {
        merged.持续效果 = cloneValue(participant.持续效果);
      } else if (!merged.持续效果 || typeof merged.持续效果 !== 'object') {
        merged.持续效果 = {};
      }
      syncC2FoodMaintenanceRuntime(merged, merged.持续效果?.['c2:坚挺金苍蝇:武魂真身维持']?.技能快照 || {});
      [
        ['hp', 'HP', 'HP'], ['hp_max', 'HP上限', 'HP上限'],
        ['vit', '体力', '体力'], ['vit_max', '体力上限', '体力上限'],
        ['sta', '体力', '体力'], ['sta_max', '体力上限', '体力上限'],
        ['sp', '魂力', '魂力'], ['sp_max', '魂力上限', '魂力上限'],
        ['men', '精神力', '精神力'], ['men_max', '精神力上限', '精神力上限'],
        ['str', '力量', '力量'], ['def', '防御', '防御'], ['agi', '敏捷', '敏捷'],
      ].forEach(([alias, flatField, statField]) => {
        const value = participant[alias] ?? participant[flatField] ?? merged.属性?.[statField];
        if (value !== undefined) merged[alias] = Number(value);
      });
      merged.存活 = merged.状态?.存活 !== false && previewRuntime.readHp(merged) > 0;
      syncEquipmentPassiveRuntime(merged, Number(combatData?.当前世界tick || combatData?.当前tick || 0), { rebuildFinal: false });
      merged.final = buildCombatFinalStats(merged);
      return merged;
    };
    combatData.参战者.team_player = (Array.isArray(combatData.参战者.team_player) ? combatData.参战者.team_player : []).map(mergeParticipant);
    combatData.参战者.team_enemy = (Array.isArray(combatData.参战者.team_enemy) ? combatData.参战者.team_enemy : []).map(mergeParticipant);
    hydrateRuntimeSummons(combatData);
    return combatData;
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
    const nextValue = Math.round(Math.max(0, Math.min(maxValue, Number(value || 0))));
    config.runtimeKeys.forEach(key => { unit[key] = nextValue; });
    unit[config.statKey] = nextValue;
    if (stats && typeof stats === 'object') stats[config.statKey] = nextValue;
    if (resourceKey === 'vit') previewRuntime.refreshStaminaAdjustedFinal(unit);
    if (resourceKey === 'hp' && nextValue <= 0) clearC2FoodMaintenanceRuntime(unit);
    if (unit.召唤键) syncSummonMirror(unit);
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
    const applicationId = String(payload.applicationId || nextRuntimeId('state-src')).trim();
    const entry = {
      applicationId,
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
    [['sourceActionId', payload.sourceActionId], ['sourceEventId', payload.sourceEventId],
      ['sourceFactId', payload.sourceFactId], ['sourceNodeId', payload.sourceNodeId],
      ['provenanceClass', payload.provenanceClass]].forEach(([key, value]) => {
      const normalized = String(value || '').trim();
      if (normalized) entry[key] = normalized;
    });
    diagnostic.状态来源登记.push(entry);
    if (diagnostic.状态来源登记.length > 400) diagnostic.状态来源登记.splice(0, diagnostic.状态来源登记.length - 400);
    return entry.applicationId;
  }

  function findStateSource(combatData = {}, criteria = {}) {
    const diagnostic = ensureActionDiagnostic(combatData?.__父级战斗数据 || combatData);
    if (!diagnostic) return null;
    const applicationId = String(criteria.applicationId || '').trim();
    const sourceFactId = String(criteria.sourceFactId || '').trim();
    const entries = Array.isArray(diagnostic.状态来源登记) ? diagnostic.状态来源登记 : [];
    if (!applicationId && !sourceFactId) return null;
    return [...entries].reverse().find(item =>
      (!applicationId || String(item?.applicationId || '').trim() === applicationId) &&
      (!sourceFactId || String(item?.sourceFactId || '').trim() === sourceFactId)
    ) || null;
  }

  function bindStateSourceProvenance(combatData = {}, target = {}, stateName = '', applicationId = '', event = {}, provenanceClass = 'ACTION_APPLIED') {
    const sourceActionId = String(event?.sourceActionId || event?.actionId || '').trim();
    const sourceEventId = String(event?.eventId || '').trim();
    if (!sourceActionId || !sourceEventId) return null;
    const mappingId = String(applicationId || nextRuntimeId('state-src')).trim();
    let source = findStateSource(combatData, { applicationId: mappingId });
    if (!source) {
      registerStateSource(combatData, {
        applicationId: mappingId,
        stateName,
        targetName: previewRuntime.unitName(target),
        sourceActorName: String(event?.actorName || '').trim(),
        sourceActionName: String(event?.actionName || '').trim(),
        sourceActionId,
        sourceEventId,
        sourceActionType: String(event?.actionType || '').trim(),
        sourceRound: Number(event?.round || combatData?.回合 || 0),
        sourceNodeId: String(event?.sourceNodeId || '').trim(),
        provenanceClass,
      });
      source = findStateSource(combatData, { applicationId: mappingId });
    }
    if (!source) return null;
    source.sourceActionId = sourceActionId;
    source.sourceEventId = sourceEventId;
    source.provenanceClass = provenanceClass;
    const state = target?.状态效果?.[stateName];
    const sourceWindow = Array.isArray(state?.__状态来源窗口)
      ? state.__状态来源窗口.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    if (!sourceWindow.length) sourceWindow.push(mappingId);
    const activeApplicationId = sourceWindow[0];
    const activeSource = findStateSource(combatData, { applicationId: activeApplicationId }) || source;
    if (state && typeof state === 'object') {
      delete state.sourceFactId;
      state.sourceActionId = String(activeSource?.sourceActionId || sourceActionId).trim();
      state.sourceEventId = String(activeSource?.sourceEventId || sourceEventId).trim();
      Object.defineProperties(state, {
        __状态来源键: { configurable: true, enumerable: false, writable: true, value: activeApplicationId },
        __状态来源窗口: { configurable: true, enumerable: false, writable: true, value: sourceWindow },
      });
    }
    event.applicationId = mappingId;
    event.sourceEventId = sourceEventId;
    event.meta = { ...(event.meta || {}), applicationId: mappingId, sourceActionId, sourceEventId, provenanceClass };
    if (state && event.meta.after) event.meta.after = cloneValue(state);
    return source;
  }

  function rehydrateStateSourceMemory(sourceCombatData = {}, combatData = {}) {
    const sourceRoot = sourceCombatData?.__父级战斗数据 || sourceCombatData;
    const sourceDiagnostic = sourceRoot?.__行动闭环诊断;
    const sourceMappings = sourceDiagnostic && Array.isArray(sourceDiagnostic.状态来源登记)
      ? sourceDiagnostic.状态来源登记
      : [];
    if (sourceMappings.length) ensureActionDiagnostic(combatData).状态来源登记 = cloneValue(sourceMappings);
    const targetById = new Map(listCombatUnits(combatData).map(unit => [previewRuntime.unitId(unit), unit]));
    listCombatUnits(sourceCombatData).forEach(sourceUnit => {
      const targetUnit = targetById.get(previewRuntime.unitId(sourceUnit));
      if (!targetUnit?.状态效果 || !sourceUnit?.状态效果) return;
      Object.entries(sourceUnit.状态效果).forEach(([stateName, sourceState]) => {
        const targetState = targetUnit.状态效果[stateName];
        const sourceWindow = Array.isArray(sourceState?.__状态来源窗口)
          ? sourceState.__状态来源窗口.map(value => String(value || '').trim()).filter(Boolean)
          : [];
        const sourceActionId = String(sourceState?.sourceActionId || '').trim();
        const sourceEventId = String(sourceState?.sourceEventId || '').trim();
        const sourceMapping = sourceActionId && sourceEventId
          ? [...sourceMappings].reverse().find(item =>
              String(item?.sourceActionId || '').trim() === sourceActionId &&
              String(item?.sourceEventId || '').trim() === sourceEventId,
            )
          : null;
        const sourceKey = String(sourceState?.__状态来源键 || sourceWindow[0] || sourceMapping?.applicationId || '').trim();
        if (!targetState || (!sourceKey && !sourceWindow.length)) return;
        if (!sourceWindow.length && sourceKey) sourceWindow.push(sourceKey);
        Object.defineProperties(targetState, {
          __状态来源键: { configurable: true, enumerable: false, writable: true, value: sourceWindow[0] },
          __状态来源窗口: { configurable: true, enumerable: false, writable: true, value: sourceWindow },
        });
      });
    });
    listCombatUnits(combatData).forEach(unit => {
      Object.entries(unit?.状态效果 || {}).forEach(([, state]) => {
        if (!state || (Array.isArray(state.__状态来源窗口) && state.__状态来源窗口.length)) return;
        const sourceActionId = String(state?.sourceActionId || '').trim();
        const sourceEventId = String(state?.sourceEventId || '').trim();
        if (!sourceActionId || !sourceEventId) return;
        const source = [...sourceMappings].reverse().find(item =>
          String(item?.sourceActionId || '').trim() === sourceActionId &&
          String(item?.sourceEventId || '').trim() === sourceEventId,
        );
        const applicationId = String(source?.applicationId || '').trim();
        if (!applicationId) return;
        const duration = Math.max(1, Math.floor(Number(state?.duration || 1)));
        Object.defineProperties(state, {
          __状态来源键: { configurable: true, enumerable: false, writable: true, value: applicationId },
          __状态来源窗口: { configurable: true, enumerable: false, writable: true, value: Array.from({ length: duration }, () => applicationId) },
        });
      });
    });
    return combatData;
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
      ? String(rawIdentity.召唤键 || rawIdentity.id || rawIdentity.角色ID || rawIdentity.name || rawIdentity.名称 || rawIdentity.charKey || rawIdentity.char_key || rawIdentity.key || '').trim()
      : String(rawIdentity || '').trim();
    if (!unit || !wanted) return false;
    return [unit.召唤键, unit.id, unit.角色ID, unit.uid, unit.name, unit.名称, unit.charKey, unit.char_key, unit.key]
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

  function resolveDeclaredSkill(declaration = {}, actor = {}) {
    if (String(declaration?.actionKind || '').trim() !== 'RELEASE_SKILL') return declaration;
    const rawSkill = declaration?.skill;
    const skills = decisionRuntime.collectSkills(actor)
      .filter(skill => skill && typeof skill === 'object');
    const rawSkillKeys = new Set(
      (typeof rawSkill === 'string'
        ? [rawSkill]
        : [
            rawSkill?.id,
            rawSkill?.技能ID,
            rawSkill?.name,
            rawSkill?.技能名称,
            rawSkill?.技能名,
            rawSkill?.魂技名,
            rawSkill?.名称,
          ])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const skill = skills.find(candidate => {
      const candidateKeys = [
        candidate?.id,
        candidate?.技能ID,
        candidate?.name,
        candidate?.技能名称,
        candidate?.技能名,
        candidate?.魂技名,
        candidate?.名称,
      ].map(value => String(value || '').trim()).filter(Boolean);
      return candidateKeys.some(key => rawSkillKeys.has(key));
    });
    const declaredSkill = skill ||
      (rawSkill && typeof rawSkill === 'object' ? rawSkill : null);
    if (!declaredSkill) return declaration;
    const effectiveSkill = typeof previewRuntime.applySkillSettlementModifiers === 'function'
      ? previewRuntime.applySkillSettlementModifiers(actor, declaredSkill).skill
      : declaredSkill;
    const resolvedSkill = cloneValue(effectiveSkill);
    const displayName = String(
      resolvedSkill?.name ||
      resolvedSkill?.技能名称 ||
      resolvedSkill?.技能名 ||
      resolvedSkill?.魂技名 ||
      resolvedSkill?.名称 ||
      '',
    ).trim();
    if (displayName) resolvedSkill.name = displayName;
    return { ...declaration, skill: resolvedSkill };
  }

  function prepareStructuredFusion(combatData = {}, actor = {}, declaration = {}) {
    if (String(declaration?.actionKind || '').trim() !== 'RELEASE_SKILL') return null;
    const resourceCosts = Object.prototype.hasOwnProperty.call(declaration, 'resourceCosts')
      ? declaration.resourceCosts || {}
      : null;
    const costStages = previewRuntime.readSkillCostStages(declaration?.skill || {}, { 来源模块: 'BattleRuntime_Module', ...declaration });
    if (costStages.非法项?.length) throw new Error(`battle_structured_cost_invalid:${costStages.非法项.join('|')}`);
    const resolvedResourceCosts = Object.prototype.hasOwnProperty.call(declaration, 'resourceCosts')
      ? resourceCosts
      : costStages.启动;
    const fusion = previewRuntime.resolveFusionAction(combatData, actor, declaration?.skill || {}, {
      resourceCosts: resolvedResourceCosts,
      requirePendingOpportunity: true,
    });
    if (!fusion.required) return null;
    if (!fusion.valid) throw new Error(`battle_structured_${String(fusion.reason || 'fusion_invalid').toLowerCase()}`);
    declaration.fusionKey = fusion.fusionKey;
    declaration.fusionParticipantIds = [...fusion.participantIds];
    declaration.fusionPartnerIds = [...fusion.partnerIds];
    declaration.fusionUsageMode = fusion.usageMode;
    declaration.resourceCosts = resolvedResourceCosts;
    fusion.participants.forEach(participant => {
      participant.__battleRuntime = participant.__battleRuntime && typeof participant.__battleRuntime === 'object'
        ? participant.__battleRuntime
        : {};
      participant.__battleRuntime.fusionUsageKeys = [...new Set([
        ...(Array.isArray(participant.__battleRuntime.fusionUsageKeys) ? participant.__battleRuntime.fusionUsageKeys : []),
        fusion.fusionKey,
      ].filter(Boolean))];
      if (!fusion.partnerIds.includes(previewRuntime.unitId(participant))) return;
      const opportunity = participant.__battleRuntime.naturalOpportunity && typeof participant.__battleRuntime.naturalOpportunity === 'object'
        ? participant.__battleRuntime.naturalOpportunity
        : {};
      participant.__battleRuntime.naturalOpportunity = {
        ...opportunity,
        status: 'CONSUMED_BY_FUSION',
        fusionKey: fusion.fusionKey,
        consumedByActionId: '',
        actionName: normalizeActionDisplayName(declaration?.skill?.name || declaration?.skill?.魂技名 || '武魂融合技'),
      };
    });
    return fusion;
  }

  function bindStructuredFusionSource(fusion = null, actionId = '', actionName = '') {
    if (!fusion?.required) return;
    fusion.partners.forEach(partner => {
      const opportunity = partner?.__battleRuntime?.naturalOpportunity;
      if (!opportunity || typeof opportunity !== 'object') return;
      opportunity.consumedByActionId = String(actionId || '').trim();
      opportunity.actionName = normalizeActionDisplayName(actionName || opportunity.actionName || '武魂融合技');
    });
  }

  function resolveDecisionActionName(decision = {}, combatData = {}) {
    const selected = decision?.selected || {};
    if (selected?.counterDeclineFallback === true) return '放弃反击';
    const declaration = selected?.declaration || {};
    const directName = selected?.selectedActionName ||
      declaration?.skill?.name ||
      declaration?.skill?.魂技名 ||
      declaration?.skillName ||
      '';
    if (directName) return normalizeActionDisplayName(directName);
    const candidateSkillName = String(selected?.candidateId || '').match(/:(?:skill|forced-skill):(.+):\d+$/)?.[1] || '';
    if (candidateSkillName) return normalizeActionDisplayName(candidateSkillName);
    const actor = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, decision?.actorId || ''));
    const skillId = String(selected?.candidateId || '').match(/:skill:(.+):\d+$/)?.[1] || '';
    if (actor && skillId) {
      const resolved = resolveDeclaredSkill(
        { actionKind: 'RELEASE_SKILL', skill: skillId },
        actor,
      ).skill;
      const resolvedName = resolved?.name || resolved?.技能名称 || resolved?.技能名 || resolved?.魂技名 || resolved?.名称 || '';
      if (resolvedName) return normalizeActionDisplayName(resolvedName);
    }
    return normalizeActionDisplayName(declaration?.actionKind || selected?.candidateId || '');
  }

  function buildDeclarationAction(declaration = {}, actor = {}, combatData = {}) {
    declaration = resolveDeclaredSkill(declaration, actor);
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
      OBSERVE: '观察', GUARD: '保护队友', WITHDRAW: '撤退', PASS_OPPORTUNITY: '让过行动',
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
      const isControl = /眩晕|麻痹|沉默|封技|定身|束缚|禁锢|僵直|冻结|冻结束缚|星光停滞|skip_turn|cannot_react|silence/i.test(stateName);
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
    return node;
  }

  function 写入战斗反应窗口节点(combatData = {}, event = {}, parentNodeId = '') {
    const kind = String(event?.eventKind || '').trim();
    if (!['dodge', 'defend', 'pass'].includes(kind)) return null;
    if (normalizeActionRole(event?.actionRole || event?.meta?.actionRole || 'ACTIVE') !== 'REACTION') return null;
    const trace = ensureTrace(combatData);
    const parent = String(parentNodeId || event.parentNodeId || event.sourceNodeId || '').trim();
    const actorName = String(event.actorName || '').trim();
    const sourceActorName = String(event.targetName || '').trim();
    const sourceActionId = String(event.sourceActionId || '').trim();
    if (!trace || !parent || !actorName || !sourceActorName || !sourceActionId || isSameReportName(actorName, sourceActorName)) return null;
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
      targetIds: normalizeIdentityTargetIds(event.targetIds, event.targetId, event.targetName),
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
        { key: 'sourceActor', label: '攻势来源', value: sourceActorName },
      ],
      counterDepth: 0,
      counterRootNodeId: parent,
    };
    trace.push(node);
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
        { key: 'reactionAgility', label: '应招速度', value: meta.reactionAgility },
        { key: 'sourceAgility', label: '攻方速度', value: meta.sourceAgility },
        { key: 'reactionPressure', label: '应招压力', value: meta.reactionPressure },
        { key: 'attackPressure', label: '攻势压力', value: meta.attackPressure },
        { key: 'reactionShare', label: '反应占比', value: meta.reactionShare },
        { key: 'reactionPressureBreakdown', label: '应招压力组成', value: meta.reactionPressureBreakdown },
        { key: 'attackPressureBreakdown', label: '攻势压力组成', value: meta.attackPressureBreakdown },
        { key: 'reactionAgilityBreakdown', label: '应招速度组成', value: meta.reactionAgilityBreakdown },
        { key: 'sourceAgilityBreakdown', label: '攻方速度组成', value: meta.sourceAgilityBreakdown },
        { key: 'dodgeRate', label: '闪避率', value: meta.dodgeRate },
        { key: 'dodgeRoll', label: '闪避投点', value: meta.dodgeRoll },
        { key: 'grazeMultiplier', label: '擦伤倍率', value: meta.grazeMultiplier },
      ].filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== ''),
      counterDepth: Math.max(0, Number(meta.counterDepth || 0)),
      counterRootNodeId: parent,
    };
    trace.push(node);
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
    const isControl = /眩晕|麻痹|沉默|封技|定身|束缚|禁锢|僵直|冻结|冻结束缚|星光停滞|skip_turn|cannot_react|silence/i.test(stateName);
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
        ['reactionPressure', '应招压力'],
        ['attackPressure', '攻势压力'],
        ['reactionShare', '反应占比'],
        ['dodgeRate', '闪避率'],
        ['dodgeRoll', '闪避投点'],
        ['actualDefense', '有效防御'],
        ['defenseThreshold', '破防阈值'],
      ].forEach(([key, label]) => {
        const raw = reactionTrace[key] ?? meta[key];
        if (raw !== undefined) trace.push({ key, label, value: Number(raw || 0) });
      });
      [
        ['reactionPressureBreakdown', '应招压力组成'],
        ['attackPressureBreakdown', '攻势压力组成'],
        ['reactionAgilityBreakdown', '应招速度组成'],
        ['sourceAgilityBreakdown', '攻方速度组成'],
      ].forEach(([key, label]) => {
        const raw = reactionTrace[key] ?? meta[key];
        if (raw && typeof raw === 'object') trace.push({ key, label, value: cloneValue(raw) });
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
    return existing || payload;
  }
  function inferResourceTimelineOperation(event = {}) {
    const kind = String(event?.eventKind || '').trim();
    const ruleCode = String(event?.ruleCode || event?.meta?.reasonCode || '').trim().toUpperCase();
    const explicit = String(event?.operation || event?.meta?.operation || '').trim().toUpperCase();
    if (resourceTimelineOperations.includes(explicit)) return explicit;
    if (event?.meta?.auditOnly === true) return '';
    if (kind === 'action_cost') return 'PAY';
    if (kind === 'item_consume') return 'ITEM_CONSUME';
    if (/RESOURCE_UNLOCK/.test(ruleCode)) return 'UNLOCK';
    if (
      event?.effectPrototype === '资源锁定' ||
      /RESOURCE_LOCK/.test(ruleCode)
    ) {
      return /UNLOCK|EXPIRE|REMOVE/.test(ruleCode) ? 'UNLOCK' : 'LOCK';
    }
    if (kind !== 'resource_change' && kind !== 'round_recover') return '';
    if (/SUSTAIN_RESOURCE_COST/.test(ruleCode)) return 'SUSTAIN_COST';
    if (/ROUND_END_NATURAL_RECOVERY/.test(ruleCode)) return 'NATURAL_RECOVERY';
    if (/REFUND|RETURN/.test(ruleCode)) return 'REFUND';
    return '';
  }

  function appendRuntimeEventContracts(combatData = {}, event = {}) {
    const runtime = ensureCombatRuntime(combatData);
    const operation = inferResourceTimelineOperation(event);
    if (operation && resourceTimelineOperations.includes(operation)) {
      const rawDelta = Number(event?.meta?.delta ?? event?.delta);
      const amount = Math.max(0, Number(event?.meta?.amount ?? event?.amount ?? event?.count ?? 0));
      const delta = Number.isFinite(rawDelta)
        ? rawDelta
        : ['PAY', 'REDUCE', 'SUSTAIN_COST', 'ITEM_CONSUME'].includes(operation)
          ? -amount
          : ['RESTORE', 'REFUND', 'NATURAL_RECOVERY'].includes(operation)
            ? amount
            : 0;
      const resource = String(
        event?.meta?.resource ||
        event?.resource ||
        persistentResourceLabel(event?.meta?.resourceKey || event?.resourceKey || '') ||
        (operation === 'ITEM_CONSUME' ? 'ITEM' : ''),
      ).trim();
      const timelineEvent = {
        eventId: String(event?.eventId || '').trim(),
        actorId: String(event?.targetId || event?.actorId || '').trim(),
        resource,
        delta,
        operation,
        sourceEventId: String(event?.sourceActionId || event?.eventId || '').trim(),
        round: Math.max(0, Number(event?.round || 0)),
        opportunitySequence: Math.max(0, Number(event?.opportunitySequence || event?.meta?.opportunitySequence || 0)),
        actionSequence: Math.max(0, Number(event?.meta?.actionSequence || event?.sequence || 0)),
        phasePriority: Math.max(0, Number(event?.meta?.phasePriority || resourcePhasePriority[operation] || 40)),
        effectSequence: ++runtime.resourceEffectSequence,
      };
      runtime.resourceTimeline.push(timelineEvent);
      recordRuntimeTimelineChange(
        combatData,
        'resource',
        timelineEvent.eventId,
        undefined,
        timelineEvent,
      );
    }
    const scheduled = event?.meta?.scheduled;
    const eventKind = String(event?.eventKind || '').trim();
    if ((scheduled && typeof scheduled === 'object') || ['charge_start', 'charge_progress'].includes(eventKind)) {
      const descriptorId = String(
        scheduled?.descriptorId ||
        `${event?.eventId || 'schedule'}:${event?.meta?.scheduledIndex ?? 0}`,
      ).trim();
      const previousDescriptor = runtime.scheduleDescriptors[descriptorId];
      const descriptor = {
        descriptorId,
        ownerId: String(scheduled?.targetId || scheduled?.actorId || event?.targetId || event?.actorId || '').trim(),
        expectedGrantType: String(
          scheduled?.expectedGrantType ||
          (scheduled?.type === 'SUMMON_CREATE' ? 'ASSIST_WINDOW' : eventKind.startsWith('charge_') ? 'NATURAL_ACTION' : ''),
        ).trim(),
        creationSequence: Math.max(0, Number(event?.sequence || 0)),
        expirySequence: Math.max(
          0,
          Number(scheduled?.expirySequence || 0),
          Number(event?.sequence || 0) + Math.max(0, Number(scheduled?.delay || scheduled?.duration || 0)),
        ),
        sourceEventId: String(event?.eventId || '').trim(),
        eventType: String(scheduled?.type || eventKind).trim(),
      };
      runtime.scheduleDescriptors[descriptorId] = descriptor;
      recordRuntimeTimelineChange(
        combatData,
        'schedule',
        descriptorId,
        previousDescriptor,
        descriptor,
      );
    }
  }

  function writeLedgerEvent(combatData = {}, payload = {}) {
    let rootData = combatData || {};
    const visited = new Set();
    while (rootData?.__父级战斗数据 && rootData.__父级战斗数据 !== rootData && !visited.has(rootData)) {
      visited.add(rootData);
      rootData = rootData.__父级战斗数据;
    }
    const ledger = ensureLedger(rootData);
    const runtimeState = ensureCombatRuntime(rootData);
    const ledgerSequence = ++runtimeState.ledgerSequence;
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
    const targetIds = normalizeIdentityTargetIds(
      payload.targetIds,
      payload.targetId || payload.targetKey || payload.target_id,
      targetName,
    );
    const actionName = normalizeActionDisplayName(payload.actionName || '');
    const sourceActionName = normalizeActionDisplayName(payload.sourceActionName || '');
    const sourceRound = Number(payload.sourceRound || round || 0);
    const matchedAction = payload.allowImplicitActionSource === false || eventKind === 'action_start' || eventKind === 'counter' || !actionName
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
    const sourceEventId = String(payload.sourceEventId || eventMeta.sourceEventId || '').trim();
    const sourceFactId = String(payload.sourceFactId || eventMeta.sourceFactId || '').trim();
    const provenanceClass = String(payload.provenanceClass || eventMeta.provenanceClass || '').trim();
    const opportunityId = String(payload.opportunityId || eventMeta.opportunityId || '').trim();
    const opportunitySequence = Math.max(0, Number(payload.opportunitySequence || eventMeta.opportunitySequence || 0));
    const grantId = String(payload.grantId || eventMeta.grantId || '').trim();
    if (opportunityId) eventMeta.opportunityId = opportunityId;
    if (opportunitySequence > 0) eventMeta.opportunitySequence = opportunitySequence;
    if (grantId) eventMeta.grantId = grantId;
    const actionRole = inferActionRole({ ...payload, eventKind, meta: eventMeta });
    const actorControl = normalizeActorControl(
      payload.actorControl || eventMeta.actorControl,
      actionRole === 'STATE_TICK' || ['counter_window', 'reaction_window'].includes(eventKind) ? 'SYSTEM' : 'AI',
    );
    const inferredPrimaryOutcome = String(payload.primaryOutcome || eventMeta.primaryOutcome || readLedgerOutcome({ ...payload, meta: eventMeta }) || '').trim();
    const inferredAppliedDamage = (() => {
      const stateTickHealing = eventKind === 'state_tick' && Number(payload.delta ?? eventMeta.delta ?? 0) > 0;
      const raw = Number(stateTickHealing
        ? 0
        : payload.appliedDamage ?? payload.damage ?? eventMeta.appliedDamage ?? eventMeta.damage ?? (eventKind === 'state_tick' ? eventMeta.amount : 0) ?? 0);
      return Number.isFinite(raw) ? Math.max(0, Math.round(Math.abs(raw))) : 0;
    })();
    if (inferredPrimaryOutcome) eventMeta.primaryOutcome = inferredPrimaryOutcome;
    if (eventKind === 'hit_result' || eventKind === 'counter' || eventKind === 'state_tick') {
      eventMeta.appliedDamage = inferredAppliedDamage;
      if (eventMeta.damage === undefined && inferredAppliedDamage > 0) eventMeta.damage = inferredAppliedDamage;
    }
    if (
      eventKind === 'hit_result' &&
      inferredAppliedDamage > 0 &&
      eventMeta.directHpDamage !== true
    ) {
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
      matchedAction?.actorSide ||
      matchedCounterStart?.actorSide ||
      (!['counter', 'counter_window'].includes(eventKind) ? matchedSourceAction?.actorSide : '') ||
      '',
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
    const actorUnit = listCombatUnits(rootData).find(unit => isUnitIdentityMatch(unit, payload.actorId || actorName));
    const actorId = String(payload.actorId || previewRuntime.unitId(actorUnit) || actorName).trim();
    const event = {
      eventId: String(payload.eventId || nextRuntimeId('battle-ledger')).trim(),
      sequence: ledgerSequence,
      eventKind,
      round,
      actorId,
      actorName,
      actorSide: eventSides.actorSide,
      targetName,
      targetSide: eventSides.targetSide,
      targetId: targetIds[0] || '',
      targetIds,
      declaredTargetId: String(
        payload.declaredTargetId ||
        eventMeta.declaredTargetId ||
        '',
      ).trim(),
      resolvedTargetId: String(
        payload.resolvedTargetId ||
        eventMeta.resolvedTargetId ||
        '',
      ).trim(),
      targetSetHash: String(
        payload.targetSetHash ||
        eventMeta.targetSetHash ||
        '',
      ).trim(),
      resolutionEventId: String(
        payload.resolutionEventId ||
        eventMeta.resolutionEventId ||
        '',
      ).trim(),
      targetScope: String(payload.targetScope || eventMeta.targetScope || matchedSourceAction?.targetScope || matchedAction?.targetScope || matchedCounterStart?.targetScope || '').trim() || (targetName ? 'single' : 'self'),
      actionName,
      initialActionName: normalizeActionDisplayName(payload.initialActionName || eventMeta.initialActionName || actionName),
      finalActionName: normalizeActionDisplayName(payload.finalActionName || eventMeta.finalActionName || actionName),
      discardedActionName: normalizeActionDisplayName(payload.discardedActionName || eventMeta.discardedActionName || ''),
      actionType: String(payload.actionType || '').trim(),
      actorControl,
      actionRole,
      actionId,
      opportunityId,
      opportunitySequence,
      grantId,
      sourceActionName,
      sourceActionId,
      ...(sourceEventId ? { sourceEventId } : {}),
      ...(sourceFactId ? { sourceFactId } : {}),
      ...(provenanceClass ? { provenanceClass } : {}),
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
      createdName: String(payload.createdName || eventMeta.createdName || '').trim(),
      createdType: String(payload.createdType || eventMeta.createdType || '').trim(),
      itemName: String(payload.itemName || eventMeta.itemName || '').trim(),
      count: Math.max(0, Number(payload.count ?? eventMeta.count ?? 0)),
      quantity: Math.max(0, Number(payload.quantity ?? eventMeta.quantity ?? 0)),
      groupKey: String(payload.groupKey || eventMeta.groupKey || '').trim(),
      outcomeId: String(payload.outcomeId || eventMeta.outcomeId || '').trim(),
      probability:
        (payload.probability ?? eventMeta.probability) !== null &&
        (payload.probability ?? eventMeta.probability) !== undefined &&
        (payload.probability ?? eventMeta.probability) !== '' &&
        Number.isFinite(Number(payload.probability ?? eventMeta.probability))
        ? Number(payload.probability ?? eventMeta.probability)
        : null,
      roll:
        (payload.roll ?? eventMeta.roll) !== null &&
        (payload.roll ?? eventMeta.roll) !== undefined &&
        (payload.roll ?? eventMeta.roll) !== '' &&
        Number.isFinite(Number(payload.roll ?? eventMeta.roll))
        ? Number(payload.roll ?? eventMeta.roll)
        : null,
      operation: String(payload.operation || eventMeta.operation || '').trim().toUpperCase(),
      position:
        payload.position && typeof payload.position === 'object'
          ? { ...payload.position }
          : eventMeta.position && typeof eventMeta.position === 'object'
            ? { ...eventMeta.position }
            : null,
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
    appendRuntimeEventContracts(rootData, event);
    recordRuntimeLedgerEvent(rootData, event);
    return event;
  }

  function writeRoundEndResourceEvent(combatData = {}, unit = {}, label = '', resourceKey = '', delta = 0, meta = {}) {
    const amount = Math.round(Number(delta || 0));
    const resource = { hp: '生命', vit: '体力', sp: '魂力', men: '精神力' }[resourceKey];
    if (!combatData || !unit || !amount || !resource) return null;
    const ruleCode = String(meta.reasonCode || '').trim().toUpperCase();
    const operation = String(
      meta.operation ||
      (/SUSTAIN_RESOURCE_COST/.test(ruleCode)
        ? 'SUSTAIN_COST'
        : /ROUND_END_NATURAL_RECOVERY/.test(ruleCode)
          ? 'NATURAL_RECOVERY'
          : amount > 0
            ? 'RESTORE'
            : 'REDUCE'),
    ).trim().toUpperCase();
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
      operation,
      meta: { ...meta, resourceKey, resource, amount: Math.abs(amount), delta: amount },
    });
  }

  function settleNaturalRecoveryAtRoundEnd(unit = {}, label = '', combatData = {}) {
    const disabled = unit.__禁用本回合自然恢复 === true;
    if (unit.__禁用本回合自然恢复 !== undefined) delete unit.__禁用本回合自然恢复;
    if (disabled) return '';
    const conditions = unit.状态效果 && typeof unit.状态效果 === 'object' && !Array.isArray(unit.状态效果)
      ? unit.状态效果
      : {};
    const readRecoveryLock = resource => Math.min(1, Object.values(conditions).reduce((maximum, condition) => {
      const rules = Array.isArray(condition?.资源锁定规则) ? condition.资源锁定规则 : [];
      return Math.max(maximum, rules.reduce((ruleMaximum, rule) => {
        const resourceMatches = Array.isArray(rule?.资源) && rule.资源.includes(resource);
        const typeMatches = String(rule?.锁定类型 || '').trim() === '回复锁定';
        return resourceMatches && typeMatches ? Math.max(ruleMaximum, Number(rule?.比例 || 0)) : ruleMaximum;
      }, 0));
    }, 0));
    const coreCount = Math.max(0, Math.floor(Number(unit?.魂核?.核心?.数量 || 0)));
    const soulRatio = 0.005 + (coreCount >= 1 ? 0.01 : 0) + (coreCount >= 3 ? 0.01 : 0);
    const mentalRatio = 0.005 + (coreCount >= 2 ? 0.01 : 0);
    const logs = [];
    [
      { key: 'sp', label: '魂力', ratio: soulRatio, max: Math.max(0, Number(unit.sp_max || 0)), current: Math.max(0, Number(unit.sp || 0)) },
      { key: 'men', label: '精神力', ratio: mentalRatio, max: Math.max(0, Number(unit.men_max || 0)), current: Math.max(0, Number(unit.men || 0)) },
    ].forEach(resource => {
      const lockRatio = readRecoveryLock(resource.label);
      if (!(resource.max > 0 && resource.ratio > 0 && lockRatio < 1)) return;
      const recovery = Math.max(0, Math.floor(resource.max * resource.ratio * (1 - lockRatio)));
      writeCombatResource(unit, resource.key, Math.min(resource.max, resource.current + recovery));
      const actual = Math.max(0, Number(unit[resource.key] || 0) - resource.current);
      if (!(actual > 0)) return;
      writeRoundEndResourceEvent(combatData, unit, label, resource.key, actual, {
        source: 'natural_recovery',
        stateName: '自然恢复',
        reasonCode: 'ROUND_END_NATURAL_RECOVERY',
        reasonText: `回合末自然恢复${resource.label}`,
      });
      logs.push(`[自然恢复] ${label}回合末恢复 ${actual} 点${resource.label}`);
    });
    return logs.join(' ');
  }

  function settleRingRecoveryAtRoundEnd(unit = {}, label = '', currentTick = null) {
    const tick = Math.max(0, Number(currentTick || 0));
    const logs = [];
    const settleRing = (ringKey, ring) => {
      if (!ring || typeof ring !== 'object' || Array.isArray(ring)) return;
      const recoveryTick = Math.max(0, Number(ring?.炸环恢复tick || 0));
      if (!(recoveryTick > 0 && recoveryTick <= tick)) return;
      delete ring.炸环恢复tick;
      if (Object.prototype.hasOwnProperty.call(ring, '炸环恢复时间')) delete ring.炸环恢复时间;
      logs.push(`[炸环恢复] ${label}第${ringKey}魂环已恢复。`);
    };
    Object.entries(unit || {})
      .filter(([key, value]) => /^第\d+武魂$/.test(String(key || '').trim()) && value && typeof value === 'object' && !Array.isArray(value))
      .forEach(([, spirit]) => {
        Object.entries(spirit)
          .filter(([key, value]) => /^第\d+魂灵$/.test(String(key || '').trim()) && value && typeof value === 'object' && !Array.isArray(value))
          .forEach(([, soulSpirit]) => {
            Object.entries(soulSpirit)
              .filter(([key, value]) => /^第\d+魂环$/.test(String(key || '').trim()) && value && typeof value === 'object' && !Array.isArray(value))
              .forEach(([ringKey, ring]) => settleRing(ringKey, ring));
          });
        Object.entries(spirit)
          .filter(([key, value]) => /^第\d+魂环$/.test(String(key || '').trim()) && value && typeof value === 'object' && !Array.isArray(value))
          .forEach(([ringKey, ring]) => settleRing(ringKey, ring));
      });
    return logs.join(' ');
  }

  const nonDamageConditionNames = new Set([
    '迟缓', '眩晕', '沉默', '致盲', '封技', '禁疗', '防御剥夺',
    '精神抗性剥夺', '标记', '嘲讽', '护卫', '僵直', '失控', '精神紊乱', '虚弱',
  ]);

  function readSignedBattleValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (/%$/.test(text)) {
      const percent = Number(text.replace('%', ''));
      return Number.isFinite(percent) ? percent / 100 : 0;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
  }

  function findResourceSuppression(unit = {}, resource = '') {
    const allValues = new Set(['全部', '抹消全部', '全部资源']);
    for (const condition of Object.values(unit?.状态效果 || {})) {
      const rules = Array.isArray(condition?.抹消规则) ? condition.抹消规则 : [];
      for (let index = 0; index < rules.length; index += 1) {
        const object = rules[index]?.抹消对象;
        const matcher = object && typeof object === 'object' && !Array.isArray(object) ? object : { 原型: String(object || '').trim() };
        if (String(matcher?.原型 || '机制授予').trim() !== '资源变化') continue;
        const values = (Array.isArray(matcher?.资源) ? matcher.资源 : String(matcher?.资源 ?? '').split(/[、,，|/]/))
          .map(value => String(value || '').trim())
          .filter(Boolean);
        if (values.length && !values.some(value => allValues.has(value) || value === resource)) continue;
        const hit = { 状态: condition, 规则索引: index, 抹消对象: matcher };
        if (String(rules[index]?.抹消方式 || '').trim() === '阻断本次') rules.splice(index, 1);
        return hit;
      }
    }
    return null;
  }

  function findRuleSuppression(unit = {}, prototype = '', field = '', value = '') {
    const allValues = new Set(['全部', '抹消全部', '全部状态', '全部规则', '全部资源', '全部结算', '全部属性', '全部原型']);
    for (const condition of Object.values(unit?.状态效果 || {})) {
      const rules = Array.isArray(condition?.抹消规则) ? condition.抹消规则 : [];
      for (let index = 0; index < rules.length; index += 1) {
        const object = rules[index]?.抹消对象;
        const matcher = object && typeof object === 'object' && !Array.isArray(object) ? object : { 原型: String(object || '').trim() };
        if (String(matcher?.原型 || '机制授予').trim() !== prototype) continue;
        const values = (Array.isArray(matcher?.[field]) ? matcher[field] : String(matcher?.[field] ?? '').split(/[、,，|/]/))
          .map(entry => String(entry || '').trim())
          .filter(Boolean);
        if (values.length && !values.some(entry => allValues.has(entry) || entry === value)) continue;
        const hit = { 状态: condition, 规则索引: index, 抹消对象: matcher };
        if (String(rules[index]?.抹消方式 || '').trim() === '阻断本次') rules.splice(index, 1);
        return hit;
      }
    }
    return null;
  }

  function triggerStateRevive(unit = {}, label = '目标') {
    if (!unit || typeof unit !== 'object' || unit.__本阶段已触发复活) return null;
    if (!unit.状态效果 || typeof unit.状态效果 !== 'object') unit.状态效果 = {};
    const candidate = Object.entries(unit.状态效果)
      .map(([key, condition]) => ({ key, condition, effects: condition?.战斗效果 || {} }))
      .filter(entry => Number(entry.effects.revive_count || 0) > 0)
      .sort((left, right) => Number(right.effects.revive_count || 0) - Number(left.effects.revive_count || 0))[0];
    if (!candidate) return null;
    if (findRuleSuppression(unit, '规则防御', '规则', '复活')) {
      return { handled: true, revived: false, log: `[复活受阻] ${label}的复活机制已被机制抹消封锁，无法触发！` };
    }
    const nextCount = Math.max(0, Number(candidate.effects.revive_count || 0) - 1);
    candidate.effects.revive_count = nextCount;
    const healRatio = Math.max(0.05, Number(candidate.effects.revive_heal_ratio || 0.25));
    const maxHp = previewRuntime.readHpMax(unit);
    const restoreAmount = Math.max(1, Math.floor(maxHp * healRatio));
    writeCombatResource(unit, 'hp', Math.min(maxHp, Math.max(restoreAmount, previewRuntime.readHp(unit) + restoreAmount)));
    unit.__本阶段已触发复活 = true;
    return {
      handled: true,
      revived: true,
      restoreAmount,
      remainingCount: nextCount,
      log: `[复活触发] ${label}借[${candidate.key}]重燃战意，恢复 ${restoreAmount} 点HP！剩余复活次数:${nextCount}`,
    };
  }

  function findPassiveReviveCandidate(unit = {}) {
    const roots = Object.entries(unit || {})
      .filter(([key, value]) => /^(?:第\d+)?武魂|血脉之力|魂骨|装备|自创魂技|技能/.test(key) && value && typeof value === 'object')
      .map(([, value]) => value);
    if (Array.isArray(unit?.技能列表) && unit.技能列表.length) roots.unshift(unit.技能列表);
    const seen = new Set();
    let found = null;
    const visit = value => {
      if (found || !value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const effect = (Array.isArray(value?._效果数组) ? value._效果数组 : []).find(entry =>
        String(entry?.原型 || '').trim() === '规则改写' &&
        String(entry?.规则 || '').trim() === '死亡转存活' &&
        String(entry?.目标 || '自身').trim() === '自身'
      );
      if (effect) {
        found = { skill: value, effect };
        return;
      }
      Object.entries(value).forEach(([key, child]) => {
        if (/状态效果|战斗历史|历史快照|参战者|复制效果|__battleRuntime|__行动闭环诊断/.test(key)) return;
        visit(child);
      });
    };
    roots.forEach(visit);
    return found;
  }

  function triggerRevive(unit = {}, label = '目标') {
    const stateResult = triggerStateRevive(unit, label);
    if (stateResult?.handled === true) return stateResult.log || null;
    if (!unit || typeof unit !== 'object' || unit.__本阶段已触发复活) return null;
    const candidate = findPassiveReviveCandidate(unit);
    if (!candidate) return null;
    const limit = candidate.effect?.触发限制 && typeof candidate.effect.触发限制 === 'object' && !Array.isArray(candidate.effect.触发限制)
      ? candidate.effect.触发限制
      : null;
    const period = String(limit?.周期 || '').trim();
    const allowedCount = Math.max(0, Math.floor(Number(limit?.次数 || 0)));
    const skillName = String(candidate.skill?.name || candidate.skill?.魂技名 || '被动技能').trim() || '被动技能';
    const limitState = unit.__技能限制运行态 ||= {};
    const skillLimit = limitState[`被动:${skillName}:死亡转存活`] ||= { 已用次数: 0 };
    if (allowedCount > 0 && ['每日', '每战', '每回合', '每次满足'].includes(period) && Number(skillLimit.已用次数 || 0) >= allowedCount) return null;
    if (findRuleSuppression(unit, '规则改写', '规则', '死亡转存活')) {
      return `[复活受阻] ${label}的死亡转存活规则已被机制抹消封锁，无法触发！`;
    }
    if (allowedCount > 0) skillLimit.已用次数 = Math.max(0, Number(skillLimit.已用次数 || 0)) + 1;
    const healRatio = Math.max(0.05, Math.abs(Number(readSignedBattleValue(candidate.effect?.数值 ?? candidate.effect?.强度 ?? '+25%')) || 0.25));
    const maxHp = previewRuntime.readHpMax(unit);
    const restoreAmount = Math.max(1, Math.floor(maxHp * Math.min(1, healRatio)));
    writeCombatResource(unit, 'hp', Math.min(maxHp, Math.max(restoreAmount, previewRuntime.readHp(unit) + restoreAmount)));
    unit.__本阶段已触发复活 = true;
    const sourceName = candidate.skill?.name || candidate.skill?.魂技名 || '死亡转存活';
    return `[复活触发] ${label}触发[${sourceName}]，按死亡转存活规则恢复 ${restoreAmount} 点HP！`;
  }

  function writeStateHpTick(combatData = {}, unit = {}, label = '', source = {}, condition = {}, stateName = '', amount = 0, result = '') {
    if (!(amount > 0)) return null;
    const delta = result === '恢复' ? amount : -amount;
    return writeLedgerEvent(combatData, {
      eventKind: 'state_tick',
      round: Number(combatData?.回合 || 0),
      actorName: String(source?.sourceActorName || '').trim(),
      // N-14：tick 事实必须带 targetId——召唤物 id≠name，只写 name 会让对账
      // 全部 TARGET_MATCH_FAILED。
      targetId: previewRuntime.unitId(unit) || '',
      targetName: unit?.name || unit?.名称 || label,
      actionName: String(source?.sourceActionName || '').trim(),
      actionType: 'state_tick',
      sourceActionId: String(source?.sourceActionId || '').trim(),
      sourceActionName: String(source?.sourceActionName || '').trim(),
      sourceRound: Number(source?.sourceRound || source?.round || 0),
      result,
      delta,
      operation: delta > 0 ? 'RESTORE' : 'DAMAGE',
      applicationId: String(source?.applicationId || condition?.__状态来源键 || '').trim(),
      duration: Math.max(0, Number(condition?.duration || source?.duration || 0)),
      effectSummary: String(condition?.效果摘要 || source?.effectSummary || '').trim(),
      driverAttr: String(condition?.驱动属性 || source?.driverAttr || '').trim(),
      meta: {
        stateName,
        amount,
        delta,
        operation: delta > 0 ? 'RESTORE' : 'DAMAGE',
        resource: '生命值',
        sourceActorName: String(source?.sourceActorName || '').trim(),
        sourceActionName: String(source?.sourceActionName || '').trim(),
        sourceActionId: String(source?.sourceActionId || '').trim(),
        sourceRound: Number(source?.sourceRound || source?.round || 0),
        applicationId: String(source?.applicationId || condition?.__状态来源键 || '').trim(),
      },
    });
  }

  function settleConditionResourceTick(unit = {}, key = '', condition = {}, label = '', combatData = {}) {
    const effects = condition?.战斗效果 || {};
    const stateName = String(condition?.状态名称 || condition?.状态 || key || '').trim();
    const activeSourceId = Array.isArray(condition?.__状态来源窗口)
      ? String(condition.__状态来源窗口[0] || condition?.__状态来源键 || '').trim()
      : String(condition?.__状态来源键 || '').trim();
    const source = findStateSource(combatData, {
      applicationId: activeSourceId,
      stateName,
      targetName: unit?.name || unit?.名称 || label,
      maxRound: Number(combatData?.回合 || 0),
    });
    const sourceText = source?.sourceActorName && source?.sourceActionName
      ? `（该状态由第${Number(source.sourceRound || source.round || 0)}回合${source.sourceActorName}施展【${source.sourceActionName}】附加）`
      : '';
    const resourceMeta = {
      source: 'state_tick', stateName,
      sourceActorName: String(source?.sourceActorName || '').trim(),
      sourceActionName: String(source?.sourceActionName || '').trim(),
      sourceActionId: String(source?.sourceActionId || '').trim(),
      sourceRound: Number(source?.sourceRound || source?.round || 0),
      applicationId: String(source?.applicationId || activeSourceId).trim(),
      duration: Math.max(0, Number(condition?.duration || source?.duration || 0)),
      effectSummary: String(condition?.效果摘要 || source?.effectSummary || '').trim(),
      driverAttr: String(condition?.驱动属性 || source?.driverAttr || '').trim(),
    };
    const logs = [];
    let totalDot = 0;
    let fixedDot = Math.max(0, Number(effects?.dot_damage || condition?.dot_damage || 0));
    let ratioDot = Math.max(0, Number(effects?.dot_damage_ratio || condition?.dot_damage_ratio || condition?.计算层效果?.dot_damage_ratio || 0));
    if (String(condition?.原型 || '').trim() === '资源变化' && String(condition?.资源 || '').trim() === '生命' && Number(condition?.持续回合 || condition?.duration || 0) > 0 && !condition?.资源) {
      const value = readSignedBattleValue(condition?.数值);
      if (/%$/.test(String(condition?.数值 ?? '').trim())) ratioDot = Math.max(ratioDot, -value);
      else fixedDot = Math.max(fixedDot, -value);
    }
    const dot = nonDamageConditionNames.has(stateName) ? 0 : Math.max(0, fixedDot + (ratioDot > 0 ? Math.floor(previewRuntime.readHpMax(unit) * ratioDot) : 0));
    if (dot > 0) {
      if (findResourceSuppression(unit, '生命')) logs.push(`[机制抹消] ${label}的生命变化被封锁，[${key}]未能造成持续损失。`);
      else {
        const before = previewRuntime.readHp(unit);
        const after = writeCombatResource(unit, 'hp', before - dot);
        const actual = Math.max(0, before - after);
        totalDot += actual;
        writeStateHpTick(combatData, unit, label, source, condition, stateName, actual, '损失');
        if (actual > 0) logs.push(`[状态结算] ${label}受[${key}]影响，额外损失 ${actual} 点HP${sourceText}`);
      }
    }
    const hotRatio = Math.max(0, Number(effects.hot_heal_ratio || 0));
    if (hotRatio > 0) {
      const maxHp = previewRuntime.readHpMax(unit);
      const hot = Math.floor(maxHp * hotRatio);
      const inversion = Math.max(0, Number(effects.heal_inversion_ratio || 0));
      if (inversion > 0) {
        const damage = Math.max(1, Math.floor(hot * Math.max(1, inversion)));
        const before = previewRuntime.readHp(unit);
        const after = writeCombatResource(unit, 'hp', before - damage);
        const actual = Math.max(0, before - after);
        writeStateHpTick(combatData, unit, label, source, condition, stateName, actual, '损失');
        if (actual > 0) logs.push(`[状态结算] ${label}的[${key}]治疗被反转，反而损失 ${actual} 点HP${sourceText}`);
      } else {
        const before = previewRuntime.readHp(unit);
        const next = Math.min(maxHp, before + hot);
        const actual = Math.max(0, next - before);
        if (actual > 0 && findResourceSuppression(unit, '生命')) {
          logs.push(`[机制抹消] ${label}的回复回路被封锁，[${key}]未能提供恢复。`);
          return { log: logs.join(' '), totalDot, stopCondition: true };
        }
        writeCombatResource(unit, 'hp', next);
        writeStateHpTick(combatData, unit, label, source, condition, stateName, actual, '恢复');
        if (actual > 0) logs.push(`[状态结算] ${label}受[${key}]影响，额外恢复 ${actual} 点HP${sourceText}`);
      }
    }
    const resources = [
      { key: 'vit', label: '体力', ratio: Number(effects.vit_gain_ratio || 0) },
      { key: 'sp', label: '魂力', ratio: Number(effects.sp_gain_ratio || 0) },
      { key: 'men', label: '精神力', ratio: Number(effects.men_gain_ratio || 0) },
    ];
    resources.forEach(resource => {
      if (!resource.ratio) return;
      const max = previewRuntime.readResourceMax(unit, resource.label);
      const before = previewRuntime.readResource(unit, resource.label);
      const amount = resource.ratio > 0
        ? Math.max(1, Math.floor(max * resource.ratio))
        : Math.min(before, Math.max(1, Math.floor(max * Math.min(0.03, Math.abs(resource.ratio)))));
      const next = resource.ratio > 0 ? Math.min(max, before + amount) : Math.max(0, before - amount);
      const actual = resource.ratio > 0 ? Math.max(0, next - before) : Math.max(0, before - next);
      if (!(actual > 0)) return;
      if (findResourceSuppression(unit, resource.label)) {
        logs.push(`[机制抹消] ${label}的${resource.label}变化被封锁，[${key}]未能${resource.ratio > 0 ? '提供恢复' : '造成流失'}。`);
        return;
      }
      writeCombatResource(unit, resource.key, next);
      writeRoundEndResourceEvent(combatData, unit, label, resource.key, resource.ratio > 0 ? actual : -actual, resourceMeta);
        logs.push(`[状态结算] ${label}受[${key}]影响，${resource.ratio > 0 ? '恢复' : '流失'} ${actual} 点${resource.label}${sourceText}`);
    });
    const tickResource = String(effects?.resource_tick_resource || '').trim();
    const tickResourceKey = { 体力: 'vit', 魂力: 'sp', 精神力: 'men' }[tickResource];
    const tickRatio = Number(effects?.resource_tick_ratio || 0);
    const tickAmount = Number(effects?.resource_tick_amount || 0);
    if (tickResourceKey && (Math.abs(tickRatio) > 1e-12 || Math.abs(tickAmount) > 1e-12)) {
      const maximum = previewRuntime.readResourceMax(unit, tickResource);
      const before = previewRuntime.readResource(unit, tickResource);
      const requested = Math.abs(tickRatio) > 1e-12
        ? Math.floor(maximum * Math.abs(tickRatio))
        : Math.floor(Math.abs(tickAmount));
      const next = Math.max(0, Math.min(maximum, before + (tickRatio < 0 || tickAmount < 0 ? -requested : requested)));
      const actual = Math.abs(next - before);
      if (actual > 0) {
        if (findResourceSuppression(unit, tickResource)) {
          logs.push(`[机制抹消] ${label}的${tickResource}变化被封锁，[${key}]未能结算。`);
        } else {
          writeCombatResource(unit, tickResourceKey, next);
          writeRoundEndResourceEvent(
            combatData,
            unit,
            label,
            tickResourceKey,
            tickRatio < 0 || tickAmount < 0 ? -actual : actual,
            { ...resourceMeta, stateName, operation: 'STATE_RESOURCE_TICK', resourceName: tickResource },
          );
          logs.push(`[状态结算] ${label}受[${key}]影响，${tickRatio < 0 || tickAmount < 0 ? '流失' : '恢复'} ${actual} 点${tickResource}${sourceText}`);
        }
      }
    }
    if (String(condition?.原型 || '').trim() === '资源变化' && Number(condition?.持续回合 || condition?.duration || 0) > 0) {
      const resourceNames = (Array.isArray(condition?.资源) ? condition.资源 : [condition?.资源])
        .map(value => String(value || '').trim()).filter(Boolean);
      const resourceMap = { 生命: 'hp', 体力: 'vit', 魂力: 'sp', 精神力: 'men' };
      const signedValue = readSignedBattleValue(condition?.数值);
      resourceNames.forEach(resourceName => {
        const resourceKey = resourceMap[resourceName];
        if (!resourceKey || !Number.isFinite(signedValue) || Math.abs(signedValue) <= 1e-12) return;
        if (findResourceSuppression(unit, resourceName)) {
          logs.push(`[机制抹消] ${label}的${resourceName}变化被封锁，[${key}]未能结算。`);
          return;
        }
        const maximum = resourceKey === 'hp'
          ? previewRuntime.readHpMax(unit)
          : previewRuntime.readResourceMax(unit, resourceName);
        const amount = String(condition?.数值 ?? '').trim().endsWith('%')
          ? Math.floor(maximum * Math.abs(signedValue))
          : Math.floor(Math.abs(signedValue));
        if (!(amount > 0)) return;
        const before = resourceKey === 'hp' ? previewRuntime.readHp(unit) : previewRuntime.readResource(unit, resourceName);
        const next = resourceKey === 'hp'
          ? Math.max(0, Math.min(maximum, before + (signedValue > 0 ? amount : -amount)))
          : Math.max(0, Math.min(maximum, before + (signedValue > 0 ? amount : -amount)));
        if (resourceKey === 'hp') writeCombatResource(unit, resourceKey, next);
        else writeCombatResource(unit, resourceKey, next);
        const actual = signedValue > 0 ? next - before : before - next;
        if (!(actual > 0)) return;
        writeRoundEndResourceEvent(combatData, unit, label, resourceKey, signedValue > 0 ? actual : -actual, {
          ...resourceMeta,
          source: 'state_tick',
          stateName,
          operation: signedValue > 0 ? 'RESTORE' : 'REDUCE',
          reasonCode: 'STATE_RESOURCE_CHANGE',
          resourceName,
          requestedDelta: signedValue > 0 ? amount : -amount,
        });
        logs.push(`[状态结算] ${label}受[${key}]影响，${signedValue > 0 ? '恢复' : '流失'} ${actual} 点${resourceName}${sourceText}`);
      });
    }
    return { log: logs.join(' '), totalDot, stopCondition: false };
  }

  function refreshSustainRuntimeLoad(unit = {}) {
    const totalLoad = Math.max(0, Math.min(0.75,
      Object.values(unit?.持续效果 || {}).filter(Boolean)
        .reduce((total, effect) => total + Number(effect?.维持负荷 || 0), 0),
    ));
    if (totalLoad > 0) {
      unit.__维持负荷 = totalLoad;
      unit.__维持反应惩罚 = Math.min(0.25, totalLoad * 0.5);
      unit.__维持前摇系数 = 1 + totalLoad * 0.35;
    } else {
      delete unit.__维持负荷;
      delete unit.__维持反应惩罚;
      delete unit.__维持前摇系数;
    }
    return totalLoad;
  }

  function settleExpiredConditionBase(unit = {}, key = '', condition = {}, label = '', combatData = {}) {
    const stateName = String(condition?.状态名称 || condition?.状态 || key || '护盾').trim();
    const source = findStateSource(combatData, {
      applicationId: String(condition?.__状态来源窗口?.[0] || condition?.__状态来源键 || '').trim(),
    });
    const remainingShield = Math.max(0, Math.round(Number(condition?.shield_value || 0)));
    if (remainingShield > 0) {
      writeLedgerEvent(combatData, {
        eventKind: 'shield_break',
        round: Number(combatData?.回合 || 0),
        actorName: unit?.name || unit?.名称 || label,
        targetName: unit?.name || unit?.名称 || label,
        actionName: stateName,
        actionType: 'state_tick',
        actionRole: 'STATE_TICK',
        sourceActionName: String(source?.sourceActionName || '').trim(),
        sourceActionId: String(source?.sourceActionId || '').trim(),
        parentNodeId: String(source?.sourceNodeId || '').trim(),
        sourceNodeId: String(source?.sourceNodeId || '').trim(),
        result: 'expired',
        resultState: 'LOSS',
        ruleCode: 'SHIELD_WINDOW_EXPIRED',
        meta: {
          amount: remainingShield,
          shieldAmount: remainingShield,
          resource: '护盾',
          resourceKey: 'shield',
          stateName,
          source: 'shield_window_expiry',
        },
      });
    }
    if (unit?.状态效果 && typeof unit.状态效果 === 'object') delete unit.状态效果[key];
    if (String(unit?.当前领域 || '') === String(key)) unit.当前领域 = '无';
    const logs = [];
    if (condition?.召唤物 && combatData) {
      const summonLog = removeHostStateSummon(combatData, unit, key, '来源状态结束');
      if (summonLog) logs.push(summonLog);
    }
    if (condition?.召唤物 && Array.isArray(unit?.召唤行动队列)) {
      unit.召唤行动队列 = unit.召唤行动队列.filter(action => String(action?.来源状态 || '') !== key);
    }
    if (unit?.持续效果) {
      Object.keys(unit.持续效果).forEach(sustainKey => {
        if (unit.持续效果[sustainKey]?.related_condition === key) delete unit.持续效果[sustainKey];
      });
      refreshSustainRuntimeLoad(unit);
    }
    if (unit?.召唤键) syncSummonMirror(unit);
    logs.push(`[状态消散] ${label}的[${key}]已结束`);
    return logs.join(' ');
  }


  function ensureRuntimeSummonTable(combatData = {}) {
    if (!combatData.召唤单位表 || typeof combatData.召唤单位表 !== 'object' || Array.isArray(combatData.召唤单位表)) {
      Object.defineProperty(combatData, '召唤单位表', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: {},
      });
    }
    return combatData.召唤单位表;
  }

  function hydrateRuntimeSummons(combatData = {}) {
    const table = ensureRuntimeSummonTable(combatData);
    listPrimaryCombatUnits(combatData).forEach(host => {
      Object.entries(host?.状态效果 || {}).forEach(([stateKey, state]) => {
        const mirror = state?.召唤物;
        if (!mirror || mirror.已消散 === true) return;
        const hostId = previewRuntime.unitId(host) || previewRuntime.unitName(host);
        const name = String(mirror?.召唤物名称 || mirror?.name || '召唤物').trim() || '召唤物';
        // B1：兜底键（第三套 id 空间）只在旧存档缺 召唤键 时出现——补水时把派生键
        // 写回镜像，后续存取即收敛到单一键，不再漂移。
        const key = String(mirror?.召唤键 || `${hostId}:${stateKey}:${name}`).trim();
        if (!String(mirror?.召唤键 || '').trim()) mirror.召唤键 = key;
        const existing = table[key];
        if (existing) {
          existing.__宿主 = host;
          existing.__来源状态 = state;
          existing.来源状态键 = stateKey;
          ensureSummonWindowRuntime(existing);
          syncSummonMirror(existing);
          return;
        }
        const inherit = mirror?.属性继承比例 && typeof mirror.属性继承比例 === 'object'
          ? mirror.属性继承比例
          : {};
        const uniform = Math.max(0.1, Math.min(1, Number(mirror?.继承属性比例 || 0) || Math.min(0.9, 0.35 + Math.max(0, Number(mirror?.强度 || 1)) * 0.1)));
        const ratio = keyName => Math.max(0.1, Math.min(1, Number(inherit?.[keyName] || uniform)));
        const hpMax = Math.max(1, Number(mirror?.生命上限 || 0) || Math.floor(previewRuntime.readHpMax(host) * ratio('体力上限')));
        const hp = Math.max(0, Math.min(hpMax, Number(mirror?.生命 ?? hpMax)));
        const summon = {
          id: key,
          name,
          名称: name,
          召唤键: key,
          类型: String(mirror?.召唤单位类型 || '魂兽').trim() || '魂兽',
          召唤单位类型: String(mirror?.召唤单位类型 || '魂兽').trim() || '魂兽',
          单位性质: '召唤物',
          行动模式: String(mirror?.行动模式 || '协同攻击').trim() || '协同攻击',
          宿主名: previewRuntime.unitName(host),
          __宿主: host,
          __来源状态: state,
          来源状态键: stateKey,
          阵营: inferUnitSide(combatData, previewRuntime.unitName(host)) === 'enemy' ? '敌方' : '玩家',
          生成回合: Math.max(0, Number(mirror?.生成回合 || combatData?.回合 || 0)),
          精神负载: Math.max(0, Number(mirror?.精神负载 || 0)),
          已消散: false,
          hp,
          hp_max: hpMax,
          HP: hp,
          HP上限: hpMax,
          vit: Math.max(1, Math.floor(previewRuntime.readResourceMax(host, '体力') * ratio('体力上限'))),
          vit_max: Math.max(1, Math.floor(previewRuntime.readResourceMax(host, '体力') * ratio('体力上限'))),
          sp: Math.max(1, Math.floor(previewRuntime.readResourceMax(host, '魂力') * ratio('魂力上限'))),
          sp_max: Math.max(1, Math.floor(previewRuntime.readResourceMax(host, '魂力') * ratio('魂力上限'))),
          men: Math.max(1, Math.floor(previewRuntime.readResourceMax(host, '精神力') * ratio('精神力上限'))),
          men_max: Math.max(1, Math.floor(previewRuntime.readResourceMax(host, '精神力') * ratio('精神力上限'))),
          str: Math.max(1, Math.floor(previewRuntime.readCombatStat(host, 'str') * ratio('力量'))),
          def: Math.max(1, Math.floor(previewRuntime.readCombatStat(host, 'def') * ratio('防御'))),
          agi: Math.max(1, Math.floor(previewRuntime.readCombatStat(host, 'agi') * ratio('敏捷'))),
          状态: { 存活: hp > 0 },
          ...(hp > 0 ? {} : { __战斗失能原因: 'INCAPACITATED' }),
          状态效果: {},
          持续效果: {},
          技能列表: Array.isArray(mirror?.技能列表) && mirror.技能列表.length
            ? cloneValue(mirror.技能列表)
            : [{ name: '普通攻击', 魂技名: '普通攻击', 消耗: '无', 前摇: 10, _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' }] }],
        };
        summon.sta = summon.vit;
        summon.sta_max = summon.vit_max;
        summon.体力 = summon.vit;
        summon.体力上限 = summon.vit_max;
        summon.魂力 = summon.sp;
        summon.魂力上限 = summon.sp_max;
        summon.精神力 = summon.men;
        summon.精神力上限 = summon.men_max;
        summon.final = buildCombatFinalStats(summon);
        table[key] = summon;
        ensureSummonWindowRuntime(summon);
        syncSummonMirror(summon);
      });
    });
    if (Object.keys(table).length && Object.getOwnPropertyDescriptor(combatData, '召唤单位表')?.enumerable !== true) {
      Object.defineProperty(combatData, '召唤单位表', {
        enumerable: true,
        configurable: true,
        writable: true,
        value: table,
      });
    }
    return table;
  }

  function normalizeLatestBattleRuntime(combatData = {}) {
    if (!combatData?.参战者 || typeof combatData.参战者 !== 'object') throw new Error('battle_runtime_latest_participants_missing');
    ['team_player', 'team_enemy'].forEach(sideKey => {
      const roster = combatData.参战者[sideKey];
      if (!Array.isArray(roster)) throw new Error(`battle_runtime_latest_roster_invalid:${sideKey}`);
      roster.filter(Boolean).forEach(unit => {
        if (!unit?.属性 || typeof unit.属性 !== 'object' || !unit?.状态 || typeof unit.状态 !== 'object') {
          throw new Error(`battle_runtime_latest_unit_structure_invalid:${previewRuntime.unitName(unit) || sideKey}`);
        }
        if (!unit.状态效果 || typeof unit.状态效果 !== 'object' || Array.isArray(unit.状态效果)) unit.状态效果 = {};
        if (!unit.持续效果 || typeof unit.持续效果 !== 'object' || Array.isArray(unit.持续效果)) unit.持续效果 = {};
        syncRoundEndUnit(unit);
        unit.final = buildCombatFinalStats(unit);
      });
    });
    hydrateRuntimeSummons(combatData);
    return combatData;
  }

  function prepareBattleRuntime(combatData = {}) {
    normalizeLatestBattleRuntime(combatData);
    fillObjectiveDamageBaselines(combatData);
    combatData.胜负条件 = cloneValue(previewRuntime.normalizeBattleObjectives(combatData?.胜负条件 || {}, combatData));
    const runtime = ensureCombatRuntime(combatData);
    runtime.actionQueueTrace = [];
    delete runtime.actionQueueFatal;
    delete runtime.withdrawalSuccess;
    delete runtime.withdrawalSuccessSides;
  }

  function evaluateBattleTerminal(context = {}, adapterOptions = {}) {
    const combatData = context?.combatData || {};
    const objectives = previewRuntime.normalizeBattleObjectives(combatData?.胜负条件 || {}, combatData);
    combatData.胜负条件 = cloneValue(objectives);
    const resolution = previewRuntime.evaluateBattleObjectives(combatData, objectives, {
      round: Number(context?.currentRound ?? combatData?.回合 ?? 0),
      roundCompleted: context?.roundCompleted === true,
    });
    const runtime = ensureCombatRuntime(combatData);
    runtime.objectiveResolution = cloneValue(resolution);
    if (resolution.terminal) {
      listSummonCombatUnits(combatData).forEach(summon => {
        removeSummonUnit(
          combatData,
          summon,
          `战斗终局：${String(resolution.terminalReason || resolution.status || '目标已裁断').trim()}`,
        );
      });
    }
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
          terminalReason: resolution.terminalReason,
          exhaustionResolution: resolution.exhaustionResolution,
          objectives,
        },
      }, adapterOptions);
      runtime.objectiveResolutionEventId = String(event?.eventId || '').trim();
      runtime.firstTerminalSequence = {
        eventId: String(event?.eventId || '').trim(),
        sequence: Math.max(0, Number(event?.sequence || 0)),
        round: Math.max(0, Number(event?.round || combatData?.回合 || 0)),
        winner: String(resolution?.winner || 'unfinished').trim(),
        terminalReason: String(resolution?.terminalReason || '').trim(),
      };
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
      const remainingWindows = Math.max(0, Number(
        summon?.剩余窗口 ??
        summon?.__来源状态?.duration ??
        0
      ));
      Object.defineProperty(summon, '召唤窗口运行态', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: {
          windowId: `summon:${String(summon.召唤键 || summon.name || 'unit').trim()}:${Math.max(0, Number(summon.生成回合 || 0))}`,
          remainingWindows,
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
    if (summon.预演召唤键) mirror.预演召唤键 = summon.预演召唤键;
    mirror.召唤单位类型 = summon.类型;
    mirror.召唤物名称 = previewRuntime.unitName(summon) || '召唤物';
    mirror.行动模式 = summon.行动模式;
    mirror.生命 = previewRuntime.readHp(summon);
    mirror.生命上限 = previewRuntime.readHpMax(summon);
    mirror.精神负载 = Math.max(0, Number(summon.精神负载 || 0));
    mirror.生成回合 = Math.max(0, Number(summon.生成回合 || 0));
    const remainingWindows = Math.max(0, Number(
      summon?.召唤窗口运行态?.remainingWindows ??
      summon?.剩余窗口 ??
      summon?.__来源状态?.duration ??
      0
    ));
    summon.剩余窗口 = remainingWindows;
    mirror.剩余窗口 = remainingWindows;
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

  function removeHostStateSummon(combatData = {}, host = {}, sourceStateKey = '', reason = '来源状态结束') {
    const hostName = previewRuntime.unitName(host);
    const summon = listSummonCombatUnits(combatData).find(unit => {
      const sourceHost = unit?.__宿主;
      const sameHost = sourceHost === host || (hostName && previewRuntime.unitName(sourceHost) === hostName);
      return sameHost && String(unit?.来源状态键 || '').trim() === String(sourceStateKey || '').trim();
    });
    return summon ? removeSummonUnit(combatData, summon, reason) : '';
  }

  function consumeSummonWindow(combatData = {}, summon = {}, reason = '完成行动窗口', grantId = '') {
    const sourceState = summon?.__来源状态;
    if (!sourceState || summon.已消散 === true) return '';
    const runtime = ensureSummonWindowRuntime(summon);
    const windowGrantId = String(grantId || `${runtime?.windowId || 'summon'}:${Math.max(0, Number(combatData?.回合 || 0))}:window`).trim();
    if (runtime?.consumedWindowGrantIds.has(windowGrantId)) return '';
    runtime?.consumedWindowGrantIds.add(windowGrantId);
    const remainingWindows = Math.max(0, Number(
      runtime?.remainingWindows ??
      summon?.剩余窗口 ??
      sourceState?.duration ??
      0
    ) - 1);
    runtime.remainingWindows = remainingWindows;
    summon.剩余窗口 = remainingWindows;
    sourceState.duration = remainingWindows;
    syncSummonMirror(summon);
    return remainingWindows > 0 ? '' : removeSummonUnit(combatData, summon, reason);
  }

  function writeSummonMentalControlEvent(combatData = {}, host = {}, summon = {}, result = '', detail = {}, adapterOptions = {}) {
    const summonName = previewRuntime.unitName(summon) || '召唤物';
    if (!combatData || !summonName) return null;
    const hostName = previewRuntime.unitName(host) || previewRuntime.unitName(summon?.__宿主);
    const failReason = String(detail.failReason || detail.failureReason || '召唤控制链受限').trim();
    return writeLedgerEvent(combatData, {
      eventKind: 'blocked_action',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(summon) || '',
      actorName: summonName,
      targetId: previewRuntime.unitId(host) || previewRuntime.unitId(summon?.__宿主) || '',
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

  function refreshSummonMentalLoad(combatData = {}, host = {}, adapterOptions = {}) {
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
        }, adapterOptions);
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
        }, adapterOptions);
        logs.push(removeSummonUnit(combatData, unit, '精神力枯竭'));
      } else if (unit.类型 === '深渊生物' && maintainRatio < 0.25) {
        writeSummonMentalControlEvent(combatData, host, unit, 'recalled', {
          failReason: '宿主精神维持不足，召唤物被强制离场',
          reasonText: '宿主精神维持不足，召唤物被强制离场',
          restriction: 'recalled',
          totalMentalLoad: totalLoad,
          mentalLimit,
          maintainRatio,
        }, adapterOptions);
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
        }, adapterOptions);
        logs.push(`[召唤受限] ${previewRuntime.unitName(unit) || '召唤物'}受宿主精神不足影响，只能进行基础行动。`);
      } else {
        unit.__禁用召唤技能 = false;
      }
    });
    return logs.filter(Boolean).join(' ');
  }

  function passiveRuntimeMarker(unit = {}, evidence = {}, result = 'APPLIED') {
    const key = String(evidence?.applicationKey || '').trim();
    if (!key) return;
    unit.__battleRuntime = unit.__battleRuntime && typeof unit.__battleRuntime === 'object' ? unit.__battleRuntime : {};
    const previous = unit.__battleRuntime.passiveApplications && typeof unit.__battleRuntime.passiveApplications === 'object'
      ? unit.__battleRuntime.passiveApplications
      : {};
    const previousMarker = previous[key];
    const normalizedResult = String(result || 'APPLIED').trim().toUpperCase();
    unit.__battleRuntime.passiveApplications = {
      ...previous,
      [key]: {
        phase: String(evidence?.triggerPhase || '').trim().toUpperCase(),
        round: Math.max(0, Number(evidence?.currentRound || 0)),
        effectPrototype: String(evidence?.effectPrototype || '').trim(),
        effectIndex: String(evidence?.effectIndex || '').trim(),
        targetIds: [...(evidence?.targetIds || [])],
        count: Math.max(0, Number(previousMarker?.count || 0)) + (normalizedResult === 'APPLIED' ? 1 : 0),
        result: normalizedResult,
      },
    };
  }

  function removePassiveRuntimeMarker(unit = {}, evidence = {}) {
    const key = String(evidence?.applicationKey || '').trim();
    const markers = unit?.__battleRuntime?.passiveApplications;
    if (!key || !markers || typeof markers !== 'object') return;
    delete markers[key];
  }

  function passiveLedgerEvidence(row = {}) {
    return {
      source: String(row?.source || '_效果数组').trim(),
      consumer: String(row?.consumer || 'BattlePreview.buildPassiveConsumerEvidence').trim(),
      actorId: String(row?.actorId || '').trim(),
      skillId: String(row?.skillId || '').trim(),
      effectIndex: String(row?.effectIndex || '').trim(),
      effectPrototype: String(row?.effectPrototype || '').trim(),
      triggerPhase: String(row?.triggerPhase || '').trim().toUpperCase(),
      triggerText: String(row?.triggerText || '').trim(),
      applicationKey: String(row?.applicationKey || '').trim(),
      targetIds: [...(row?.targetIds || [])],
    };
  }

  function equipmentPassiveImplicitStagePhase(effect = {}) {
    if (String(effect?.触发方式 || '').trim()) return '';
    if (
      String(effect?.原型 || '').trim() === '结算修正' &&
      String(effect?.结算 || '').trim() === '受到伤害' &&
      String(effect?.目标 || '自身').trim() === '自身'
    ) return '受击前';
    return '';
  }

  function equipmentPassiveCombatEffect(effect = {}, source = {}) {
    const combatEffect = typeof previewRuntime.deriveStateCombatEffect === 'function'
      ? previewRuntime.deriveStateCombatEffect(effect)
      : {};
    const sourceText = [
      source?.来源物品,
      source?.技能名,
      effect?.状态,
      effect?.效果描述,
      effect?.描述,
    ].map(value => String(value || '').trim()).filter(Boolean).join('|');
    if (
      String(effect?.原型 || '').trim() === '结算修正' &&
      String(effect?.结算 || '').trim() === '受到伤害' &&
      /反弹|反射/.test(sourceText)
    ) {
      combatEffect.counter_attack_ratio = Math.max(
        Number(combatEffect.counter_attack_ratio || 0),
        Math.abs(Number(previewRuntime.parseSignedValue(effect?.数值, 1) || 0)),
      );
    }
    return combatEffect;
  }

  function settlePassiveStageEffect({
    combatData = {},
    unit = {},
    row = {},
    actionId = '',
    currentRound = 0,
  } = {}) {
    const prototype = String(row?.effectPrototype || row?.effect?.原型 || '').trim();
    if (!['判定修正', '结算修正', '属性修正'].includes(prototype)) return [];
    const effect = row?.effect && typeof row.effect === 'object' ? row.effect : {};
    const source = { 技能名: String(row?.skillName || row?.skillId || '').trim() };
    const stateName = String(
      effect?.状态 ||
      effect?.状态名称 ||
      `装备阶段:${source.技能名 || '被动'}:${String(effect?.结算 || effect?.判定 || prototype).trim()}`,
    ).trim();
    const duration = Math.max(1, Number(effect?.持续回合 || 1));
    const targets = (Array.isArray(row?.targetIds) ? row.targetIds : [])
      .map(targetId => listCombatUnits(combatData).find(target => isUnitIdentityMatch(target, targetId)))
      .filter(Boolean);
    return targets.map(target => {
      if (!target.状态效果 || typeof target.状态效果 !== 'object') target.状态效果 = {};
      const state = {
        ...cloneValue(effect),
        状态: stateName,
        状态名称: stateName,
        类型: String(effect?.类型 || 'buff').trim() || 'buff',
        duration,
        持续回合: duration,
        战斗效果: equipmentPassiveCombatEffect(effect, source),
        __equipmentPassiveStage: true,
        __equipmentStageOwnerId: previewRuntime.unitId(unit),
      };
      target.状态效果[stateName] = state;
      return writeLedgerEvent(combatData, {
        eventKind: 'state_apply',
        round: Number(currentRound || combatData?.回合 || 0),
        actorId: previewRuntime.unitId(unit),
        actorName: previewRuntime.unitName(unit),
        targetId: previewRuntime.unitId(target),
        targetName: previewRuntime.unitName(target),
        actionName: String(row?.skillName || row?.skillId || '装备阶段被动').trim(),
        actionType: 'RELEASE_SKILL',
        actorControl: 'SYSTEM',
        actionRole: 'STATE_TICK',
        actionId,
        sourceActionId: actionId,
        result: 'applied',
        resultState: 'SUCCESS',
        primaryOutcome: 'passive_stage_applied',
        ruleCode: prototype === '判定修正'
          ? 'PASSIVE_STAGE_CHECK_MODIFIER'
          : 'PASSIVE_STAGE_SETTLEMENT_MODIFIER',
        effectPrototype: prototype,
        factType: prototype === '判定修正' ? 'CHECK_MODIFIER' : 'SETTLEMENT_MODIFIER',
        sourceEffectId: String(row?.effectIndex || '').trim(),
        meta: {
          source: 'equipment_passive_stage_consumer_v1',
          triggerPhase: String(row?.triggerPhase || '').trim(),
          stateName,
          duration,
          effectIndex: String(row?.effectIndex || '').trim(),
        },
      });
    }).filter(Boolean);
  }

  function settlePassiveSkillConsumers(combatData = {}, currentRound = 0, options = {}) {
    if (typeof previewRuntime.buildPassiveConsumerEvidence !== 'function') return [];
    const runtime = ensureCombatRuntime(combatData);
    if (Number(runtime.passiveConsumerDepth || 0) > 0) return [];
    runtime.passiveConsumerDepth = Number(runtime.passiveConsumerDepth || 0) + 1;
    const round = Math.max(0, Number(currentRound || combatData?.回合 || 0));
    const phases = Array.isArray(options?.phases) && options.phases.length
      ? [...new Set(options.phases.map(value => String(value || '').trim()).filter(Boolean))]
      : round <= 1 ? ['战斗开始', '回合开始'] : ['回合开始'];
    if (phases.includes('战斗开始')) runtime.itemPassiveBattleStarted = true;
    const triggeredUnitIds = [...new Set((Array.isArray(options?.triggeredUnitIds) ? options.triggeredUnitIds : [])
      .map(value => String(value || '').trim()).filter(Boolean))];
    const logs = [];
    try {
      phases.forEach(phase => {
        listCombatUnits(combatData).forEach(unit => {
          if (!unit || !structuredActorPhysicallyAlive(unit)) return;
          const evidenceRows = previewRuntime.buildPassiveConsumerEvidence(combatData, unit, {
            phase,
            currentRound: round,
            triggeredUnitIds,
            triggerEventId: options?.triggerEventId,
            declaration: options?.declaration,
            action: options?.action,
            triggerTarget: options?.triggerTarget,
            conditionTarget: options?.conditionTarget,
            primaryTarget: options?.primaryTarget,
            conditionContext: options?.conditionContext,
          });
          evidenceRows.filter(row => row?.ready === true).forEach(row => {
            const actionId = `passive-consumer:${String(row.applicationKey || '').trim()}`;
            passiveRuntimeMarker(unit, row, 'PENDING');
            const stageFacts = settlePassiveStageEffect({
              combatData,
              unit,
              row,
              actionId,
              currentRound: round,
            });
            if (stageFacts.length) {
              passiveRuntimeMarker(unit, row, 'APPLIED');
              writeLedgerEvent(combatData, {
                eventKind: 'runtime_trace',
                round,
                actorId: previewRuntime.unitId(unit),
                actorName: previewRuntime.unitName(unit),
                targetIds: [...(row.targetIds || [])],
                actionName: String(row.skillName || row.skillId || '被动效果').trim(),
                actionType: 'RELEASE_SKILL',
                actorControl: 'SYSTEM',
                actionRole: 'STATE_TICK',
                actionId,
                result: 'passive_consumed',
                resultState: 'SUCCESS',
                ruleCode: 'PASSIVE_EFFECT_CONSUMED',
                effectPrototype: String(row.effectPrototype || '').trim(),
                sourceEffectId: String(row.effectIndex || '').trim(),
                meta: { passiveConsumerEvidence: passiveLedgerEvidence(row) },
              });
              logs.push(`[被动触发] ${String(row.skillName || row.skillId || '被动效果').trim()}（${String(row.triggerPhase || phase).trim()}）`);
              return;
            }
            const declaration = {
              actorId: previewRuntime.unitId(unit),
              actionKind: 'RELEASE_SKILL',
              targetIds: [...(row.targetIds || [])],
              skill: {
                ...cloneValue(row.skill || {}),
                消耗: '无',
                前摇: 0,
                _效果数组: [cloneValue(row.effect || {})],
              },
              resourceCosts: {},
            };
            try {
              const actionContext = beginStructuredDeclaration({
                combatData,
                declaration,
                actionRole: 'STATE_TICK',
                actorControl: 'SYSTEM',
                eventKind: 'state_tick',
                actionId,
                allowPreparedDefense: false,
                conditionContext: options?.conditionContext,
              });
              const settlementResult = executeStructuredDeclaration({
                combatData,
                declaration,
                actionContext,
                conditionContext: options?.conditionContext,
              });
              const passiveEffectTriggered = (Array.isArray(settlementResult?.facts) ? settlementResult.facts : []).some(fact =>
                String(fact?.sourceActionId || '').trim() === actionId &&
                String(fact?.effectPrototype || '').trim() === String(row.effectPrototype || '').trim() &&
                !['FAILURE', 'NO_EFFECT'].includes(String(fact?.resultState || '').trim())
              );
              if (passiveEffectTriggered) {
                settleEquipmentPassiveTriggerCost({
                  combatData,
                  actor: unit,
                  effect: row.effect,
                  action: { actionKind: 'RELEASE_SKILL', actionName: String(row.skillName || row.skillId || '被动效果').trim(), actorControl: 'SYSTEM' },
                  actionEvent: settlementResult?.actionEvent || actionContext?.actionEvent,
                  actionRole: 'STATE_TICK',
                });
              } else {
                removePassiveRuntimeMarker(unit, row);
                return;
              }
              passiveRuntimeMarker(unit, row, 'APPLIED');
              writeLedgerEvent(combatData, {
                eventKind: 'runtime_trace',
                round,
                actorId: previewRuntime.unitId(unit),
                actorName: previewRuntime.unitName(unit),
                targetIds: [...(row.targetIds || [])],
                actionName: String(row.skillName || row.skillId || '被动效果').trim(),
                actionType: 'RELEASE_SKILL',
                actorControl: 'SYSTEM',
                actionRole: 'STATE_TICK',
                actionId,
                result: 'passive_consumed',
                resultState: 'SUCCESS',
                ruleCode: 'PASSIVE_EFFECT_CONSUMED',
                effectPrototype: String(row.effectPrototype || '').trim(),
                sourceEffectId: String(row.effectIndex || '').trim(),
                meta: { passiveConsumerEvidence: passiveLedgerEvidence(row) },
              });
              logs.push(`[被动触发] ${String(row.skillName || row.skillId || '被动效果').trim()}（${String(row.triggerPhase || phase).trim()}）`);
            } catch (error) {
              removePassiveRuntimeMarker(unit, row);
              writeLedgerEvent(combatData, {
                eventKind: 'runtime_trace',
                round,
                actorId: previewRuntime.unitId(unit),
                actorName: previewRuntime.unitName(unit),
                targetIds: [...(row.targetIds || [])],
                actionName: String(row.skillName || row.skillId || '被动效果').trim(),
                actionType: 'RELEASE_SKILL',
                actorControl: 'SYSTEM',
                actionRole: 'STATE_TICK',
                actionId,
                result: 'passive_consumer_failed',
                resultState: 'FAILURE',
                ruleCode: 'PASSIVE_EFFECT_CONSUMER_FAILED',
                effectPrototype: String(row.effectPrototype || '').trim(),
                sourceEffectId: String(row.effectIndex || '').trim(),
                meta: {
                  passiveConsumerEvidence: passiveLedgerEvidence(row),
                  error: String(error?.message || error || '').trim(),
                },
              });
            }
          });
        });
      });
      return logs;
    } finally {
      runtime.passiveConsumerDepth = Math.max(0, Number(runtime.passiveConsumerDepth || 1) - 1);
    }
  }

  function beginBattleRound(combatData = {}, currentRound = 0, adapterOptions = {}) {
    const runtime = ensureCombatRuntime(combatData);
    runtime.reactionGrantIds = {};
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
    const summonLog = hosts.map(host => refreshSummonMentalLoad(combatData, host, adapterOptions)).filter(Boolean).join(' ');
    const passiveLogs = settlePassiveSkillConsumers(combatData, currentRound);
    return [`[团战第${currentRound}回合开始]`, summonLog, ...passiveLogs].filter(Boolean);
  }

  function sustainTargetIds(combatData = {}, actor = {}, effect = {}) {
    const targetKind = String(effect?.目标 || '').trim();
    const actorSide = inferUnitSide(combatData, previewRuntime.unitName(actor));
    const entries = listCombatUnits(combatData).filter(unit => structuredActorPhysicallyAlive(unit));
    const friendly = entries.filter(unit => inferUnitSide(combatData, previewRuntime.unitName(unit)) === actorSide);
    const hostile = entries.filter(unit => inferUnitSide(combatData, previewRuntime.unitName(unit)) !== actorSide);
    if (/自身/.test(targetKind)) return [previewRuntime.unitId(actor)];
    if (/融合伙伴/.test(targetKind)) {
      const refs = [
        ...(Array.isArray(actor?.融合伙伴) ? actor.融合伙伴 : [actor?.融合伙伴]),
        ...(Array.isArray(actor?.武魂融合伙伴) ? actor.武魂融合伙伴 : [actor?.武魂融合伙伴]),
        ...(Array.isArray(actor?.__battleRuntime?.fusionPartnerIds) ? actor.__battleRuntime.fusionPartnerIds : []),
      ].flatMap(value => value && typeof value === 'object'
        ? [value.id, value.角色键, value.角色名, value.name, value.名称]
        : [value])
        .map(value => String(value || '').trim())
        .filter(Boolean);
      if (!refs.length) return [];
      const wanted = new Set(refs);
      return friendly
        .filter(unit => previewRuntime.unitId(unit) !== previewRuntime.unitId(actor))
        .filter(unit => wanted.has(previewRuntime.unitId(unit)) || wanted.has(previewRuntime.unitName(unit)))
        .map(previewRuntime.unitId);
    }
    if (/全场/.test(targetKind)) return entries.map(previewRuntime.unitId);
    if (/友方群体/.test(targetKind)) return friendly.map(previewRuntime.unitId);
    if (/敌方群体|群体/.test(targetKind)) return hostile.map(previewRuntime.unitId);
    if (/友方|队友/.test(targetKind)) return [previewRuntime.unitId(friendly.find(unit => unit !== actor) || actor)];
    if (/敌方|单体/.test(targetKind)) return hostile.length ? [previewRuntime.unitId(hostile[0])] : [];
    return [previewRuntime.unitId(actor)];
  }

  function readSustainCosts(unit = {}, sustainCost = '无', context = {}) {
    const skillSnapshot = context?.技能 && typeof context.技能 === 'object' && Object.keys(context.技能).length
      ? context.技能
      : context?.skill && typeof context.skill === 'object' && Object.keys(context.skill).length
        ? context.skill
        : context?.技能快照 || {};
    const parsed = previewRuntime.readSkillSustainCosts(sustainCost || '无', {
      ...context,
      来源模块: 'BattleRuntime_Module',
      技能: skillSnapshot,
      技能类型: context?.技能类型 ?? skillSnapshot?.技能类型,
      技能分类: context?.技能分类 ?? skillSnapshot?.技能分类,
      承载方式: context?.承载方式 ?? skillSnapshot?.承载方式,
      来源类别: context?.来源类别 ?? context?.sourceCategory ?? context?.category ?? skillSnapshot?.来源类别 ?? skillSnapshot?.来源类型 ?? skillSnapshot?.内容类型 ?? skillSnapshot?.__战斗来源类别,
      sourceCategory: context?.sourceCategory ?? context?.来源类别 ?? context?.category ?? skillSnapshot?.来源类别 ?? skillSnapshot?.来源类型 ?? skillSnapshot?.内容类型 ?? skillSnapshot?.__战斗来源类别,
      来源明细: context?.来源明细 ?? context?.sourceDetail ?? context?.source_detail ?? skillSnapshot?.来源明细 ?? skillSnapshot?.__战斗来源明细,
      sourceDetail: context?.sourceDetail ?? context?.来源明细 ?? context?.source_detail ?? skillSnapshot?.来源明细 ?? skillSnapshot?.__战斗来源明细,
      forceTrueBody: context?.forceTrueBody ?? skillSnapshot?.forceTrueBody,
      强制真身: context?.强制真身 ?? skillSnapshot?.强制真身,
      魂环位: context?.魂环位 ?? context?.ringIndex ?? context?.ringSlot ?? skillSnapshot?.魂环位 ?? skillSnapshot?.ringIndex ?? skillSnapshot?.ringSlot ?? skillSnapshot?.__魂技槽位,
      ringIndex: context?.ringIndex ?? context?.魂环位 ?? skillSnapshot?.ringIndex ?? skillSnapshot?.魂环位,
      ringSlot: context?.ringSlot ?? context?.魂环位 ?? skillSnapshot?.ringSlot ?? skillSnapshot?.魂环位,
      魂技槽位: context?.魂技槽位 ?? context?.ringSlot ?? context?.魂环位 ?? skillSnapshot?.魂技槽位 ?? skillSnapshot?.__魂技槽位,
      融合参与者: context?.融合参与者 ?? context?.fusionParticipantIds ?? context?.fusionPartnerIds ?? skillSnapshot?.融合参与者 ?? skillSnapshot?.fusionParticipantIds ?? skillSnapshot?.fusionPartnerIds,
      fusionParticipantIds: context?.fusionParticipantIds ?? context?.融合参与者 ?? context?.fusionPartnerIds ?? skillSnapshot?.fusionParticipantIds ?? skillSnapshot?.融合参与者 ?? skillSnapshot?.fusionPartnerIds,
      融合模式: context?.融合模式 ?? context?.fusionMode ?? context?.fusionUsageMode ?? skillSnapshot?.融合模式 ?? skillSnapshot?.fusionMode,
      fusionMode: context?.fusionMode ?? context?.融合模式 ?? context?.fusionUsageMode ?? skillSnapshot?.fusionMode ?? skillSnapshot?.融合模式,
    });
    if (parsed.非法项?.length) return { invalid: true, reason: `COST_INVALID:${parsed.非法项.join('|')}`, costs: [] };
    const costs = Object.entries(parsed.costs || {}).map(([resource, rawCost]) => {
      const key = previewRuntime.skillCostResourceKey(resource);
      const maximum = persistentResourceMax(unit, key);
      const text = String(rawCost ?? '').trim();
      const numeric = Number(text.replace(/%$/, ''));
      const amount = text.endsWith('%') ? maximum * numeric / 100 : numeric;
      return { resource, key, amount: Math.max(0, Math.floor(amount)) };
    });
    return { invalid: false, reason: '', costs };
  }

  function breakSustainEffect(unit = {}, key = '', effect = {}) {
    if (effect.effect_type === 'domain') unit.当前领域 = '无';
    else if (effect.effect_type === 'life_fire' && unit.血脉之力) unit.血脉之力.生命之火 = false;
    else if (effect.effect_type === 'condition' && effect.related_condition && unit.状态效果) delete unit.状态效果[effect.related_condition];
    else if (effect.effect_type === 'c2_food_maintain') {
      if (unit.状态效果 && typeof unit.状态效果 === 'object') delete unit.状态效果['坚挺金苍蝇·武魂真身维持'];
      if (unit.属性?.状态效果 && typeof unit.属性.状态效果 === 'object') delete unit.属性.状态效果['坚挺金苍蝇·武魂真身维持'];
    }
    if (unit.持续效果) delete unit.持续效果[key];
    refreshSustainRuntimeLoad(unit);
  }

  function clearC2FoodMaintenanceRuntime(unit = {}) {
    if (!unit || typeof unit !== 'object') return false;
    const effectKey = 'c2:坚挺金苍蝇:武魂真身维持';
    const effects = unit.持续效果 && typeof unit.持续效果 === 'object' && !Array.isArray(unit.持续效果)
      ? unit.持续效果
      : {};
    const effectEntries = Object.entries(effects).filter(([key, effect]) =>
      key === effectKey || effect?.effect_type === 'c2_food_maintain',
    );
    effectEntries.forEach(([key, effect]) => {
      breakSustainEffect(unit, key, { ...(effect || {}), effect_type: 'c2_food_maintain' });
    });
    if (!effectEntries.length) {
      if (unit.状态效果 && typeof unit.状态效果 === 'object') delete unit.状态效果['坚挺金苍蝇·武魂真身维持'];
      if (unit.属性?.状态效果 && typeof unit.属性.状态效果 === 'object') delete unit.属性.状态效果['坚挺金苍蝇·武魂真身维持'];
      refreshSustainRuntimeLoad(unit);
    }
    return effectEntries.length > 0;
  }

  function syncC2FoodMaintenanceRuntime(unit = {}, skillSnapshot = {}) {
    if (!unit || typeof unit !== 'object') return false;
    const states = unit.状态效果 && typeof unit.状态效果 === 'object' && !Array.isArray(unit.状态效果)
      ? unit.状态效果
      : {};
    const marker = Object.values(states).find(state =>
      state && typeof state === 'object' && state.维持态 === true && String(state.来源技能 || '').trim() === '坚挺金苍蝇',
    );
    unit.持续效果 = unit.持续效果 && typeof unit.持续效果 === 'object' && !Array.isArray(unit.持续效果) ? unit.持续效果 : {};
    const key = 'c2:坚挺金苍蝇:武魂真身维持';
    if (!marker) {
      Object.entries(unit.持续效果).forEach(([effectKey, effect]) => {
        if (effect?.effect_type === 'c2_food_maintain') delete unit.持续效果[effectKey];
      });
      refreshSustainRuntimeLoad(unit);
      return false;
    }
    unit.持续效果[key] = {
      ...(unit.持续效果[key] || {}),
      effect_type: 'c2_food_maintain',
      name: '坚挺金苍蝇',
      来源技能: '坚挺金苍蝇',
      技能快照: cloneValue(skillSnapshot || unit.持续效果[key]?.技能快照 || {}),
      维持态: true,
      制造速度倍率: Number(marker.制造速度倍率 || 1.3),
      产物效果倍率: Number(marker.产物效果倍率 || 1.3),
      维持消耗: marker.维持消耗 || '魂力:8%',
      维持存在效果列表: [],
      维持释放效果列表: [],
    };
    refreshSustainRuntimeLoad(unit);
    return true;
  }

  function attachSkillSustainCost(combatData = {}, actor = {}, declaration = {}, actionName = '', sustainCosts = {}, beforeKeys = new Set(), actionEvent = {}) {
    const costs = sustainCosts && typeof sustainCosts === 'object' ? sustainCosts : {};
    if (!Object.keys(costs).length) return { attached: false, diagnostic: false };
    const effects = actor?.持续效果 && typeof actor.持续效果 === 'object' && !Array.isArray(actor.持续效果)
      ? actor.持续效果
      : {};
    const candidates = Object.entries(effects)
      .filter(([key, effect]) => {
        if (!effect || typeof effect !== 'object') return false;
        const source = String(effect.来源技能 || effect.技能快照?.name || effect.技能快照?.魂技名 || effect.name || '').trim();
        return !beforeKeys.has(key) || (source && (source === actionName || source.includes(actionName)));
      })
      .sort(([leftKey, left], [rightKey, right]) => {
        const duration = value => Math.max(0, Number(value?.剩余回合 ?? value?.duration ?? value?.持续回合 ?? value?.剩余窗口 ?? 0));
        return duration(right) - duration(left) || String(leftKey).localeCompare(String(rightKey));
      });
    if (!candidates.length) {
      writeLedgerEvent(combatData, {
        eventKind: 'state_tick',
        round: Number(combatData?.回合 || 0),
        actorName: previewRuntime.unitName(actor),
        targetName: previewRuntime.unitName(actor),
        actionName: String(actionName || declaration?.skill?.name || '技能').trim(),
        actionType: declaration?.actionKind || 'RELEASE_SKILL',
        actorControl: 'SYSTEM',
        actionRole: 'ACTIVE',
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        result: 'diagnostic',
        resultState: 'FAILURE',
        ruleCode: 'SUSTAIN_EFFECT_MISSING',
        meta: { source: 'structured_runtime', reason: '技能声明维持消耗，但本次释放没有可附着的持续效果' },
      });
      return { attached: false, diagnostic: true };
    }
    const [representativeKey, representative] = candidates[0];
    representative.维持消耗 = cloneValue(costs);
    writeLedgerEvent(combatData, {
      eventKind: 'state_tick',
      round: Number(combatData?.回合 || 0),
      actorName: previewRuntime.unitName(actor),
      targetName: previewRuntime.unitName(actor),
      actionName: String(actionName || declaration?.skill?.name || '技能').trim(),
      actionType: declaration?.actionKind || 'RELEASE_SKILL',
      actorControl: 'SYSTEM',
      actionRole: 'ACTIVE',
      actionId: actionEvent.actionId,
      sourceActionId: actionEvent.actionId,
      result: 'attached',
      resultState: 'SUCCESS',
      ruleCode: 'SUSTAIN_COST_ATTACHED',
      meta: {
        source: 'structured_runtime',
        representativeEffect: representativeKey,
        skippedEffects: candidates.slice(1).map(([key]) => key),
        costs: cloneValue(costs),
      },
    });
    return { attached: true, diagnostic: false, representativeEffect: representativeKey };
  }

  function settleSustainAtRoundEnd(unit = {}, label = '', combatData = {}) {
    const logs = [];
    const broken = [];
    const chargedSustainSources = new Set();
    if (!unit?.持续效果 || typeof unit.持续效果 !== 'object') return { log: '', broken };
    Object.entries({ ...unit.持续效果 }).forEach(([key, effect]) => {
      if (!effect) return;
      const inactive =
        (effect.effect_type === 'domain' && (!unit.当前领域 || unit.当前领域 === '无')) ||
        (effect.effect_type === 'life_fire' && !unit.血脉之力?.生命之火) ||
        (effect.effect_type === 'condition' && effect.related_condition && !unit.状态效果?.[effect.related_condition]) ||
        (effect.effect_type === 'c2_food_maintain' && unit.状态效果?.['坚挺金苍蝇·武魂真身维持']?.维持态 !== true);
      if (inactive) {
        delete unit.持续效果[key];
        refreshSustainRuntimeLoad(unit);
        return;
      }
      const sustainResolution = readSustainCosts(
        unit,
        effect.维持消耗 ?? effect.sustain_cost ?? '无',
        {
          ...effect,
          技能: effect.技能快照 || effect.技能 || {},
        },
      );
      if (sustainResolution.invalid) {
        breakSustainEffect(unit, key, effect);
        broken.push(effect.name || key);
        writeLedgerEvent(combatData, {
          eventKind: 'state_tick',
          round: Number(combatData?.回合 || 0),
          actorName: previewRuntime.unitName(unit),
          targetName: previewRuntime.unitName(unit),
          actionName: String(effect.name || key).trim(),
          actionType: 'sustain_break',
          actorControl: 'SYSTEM',
          actionRole: 'STATE_TICK',
          result: 'diagnostic',
          resultState: 'FAILURE',
          ruleCode: 'SUSTAIN_COST_INVALID',
          meta: { source: 'structured_runtime', stateName: String(effect.name || key).trim(), reason: sustainResolution.reason },
        });
        logs.push(`[维持中断] ${label}的[${effect.name || key}]维持消耗非法：${sustainResolution.reason}`);
        return;
      }
      const costs = sustainResolution.costs;
      const sustainSource = String(
        effect.来源技能 ||
        effect.技能快照?.name ||
        effect.技能快照?.魂技名 ||
        effect.name ||
        key,
      ).trim();
      const duplicateCost = sustainSource && chargedSustainSources.has(sustainSource);
      if (!duplicateCost) {
        const affordable = costs.every(cost => persistentResourceValue(unit, cost.key) + 1e-9 >= cost.amount);
        if (!affordable) {
        breakSustainEffect(unit, key, effect);
        broken.push(effect.name || key);
        writeLedgerEvent(combatData, {
          eventKind: 'state_tick',
          round: Number(combatData?.回合 || 0),
          actorName: previewRuntime.unitName(unit),
          targetName: previewRuntime.unitName(unit),
          actionName: String(effect.name || key).trim(),
          actionType: 'sustain_break',
          actorControl: 'SYSTEM',
          actionRole: 'STATE_TICK',
          result: 'broken',
          resultState: 'FAILURE',
          ruleCode: 'SUSTAIN_RESOURCE_INSUFFICIENT',
          meta: { source: 'structured_runtime', stateName: String(effect.name || key).trim() },
        });
        logs.push(`[维持中断] ${label}已无力维持[${effect.name || key}]，效果自动解除`);
        return;
        }
        costs.forEach(cost => {
          if (!(cost.amount > 0)) return;
          const before = persistentResourceValue(unit, cost.key);
          writeCombatResource(unit, cost.key, before - cost.amount);
          const actual = persistentResourceValue(unit, cost.key) - before;
          writeRoundEndResourceEvent(combatData, unit, label, cost.key, actual, {
            source: 'structured_sustain',
            stateName: String(effect.name || key).trim(),
            sourceActionName: String(effect.name || key).trim(),
            reasonCode: 'SUSTAIN_RESOURCE_COST',
            reasonText: `维持${effect.name || key}`,
          });
        });
        if (sustainSource) chargedSustainSources.add(sustainSource);
      }
      const releaseEffects = Array.isArray(effect?.维持释放效果列表) ? effect.维持释放效果列表.filter(Boolean) : [];
      if (!releaseEffects.length) {
        if (Array.isArray(effect?.维持存在效果列表) && effect.维持存在效果列表.length) {
          logs.push(`[维持状态] ${effect.name || key}维持中，未重复释放一次性效果。`);
        }
        return;
      }
      const baseSkill = cloneValue(effect?.技能快照 || {});
      const actionName = normalizeActionDisplayName(baseSkill?.name || baseSkill?.魂技名 || effect.name || key);
      let actionContext = null;
      let resolvedEffectCount = 0;
      releaseEffects.forEach(releaseEffect => {
        const targetIds = sustainTargetIds(combatData, unit, releaseEffect);
        if (!targetIds.length) return;
        const declaration = {
          actorId: previewRuntime.unitId(unit),
          actionKind: 'RELEASE_SKILL',
          targetIds,
          skill: {
            ...baseSkill,
            name: actionName,
            魂技名: actionName,
            消耗: '无',
            前摇: 0,
            _效果数组: [cloneValue(releaseEffect)],
          },
          resourceCosts: {},
        };
        if (!actionContext) {
          actionContext = beginStructuredDeclaration({
            combatData,
            declaration,
            actionRole: 'STATE_TICK',
            actorControl: 'SYSTEM',
            eventKind: 'state_tick',
          });
        } else {
          actionContext = {
            ...actionContext,
            declaration,
            primaryTarget: resolveStructuredTargets(combatData, unit, declaration, releaseEffect)[0] || unit,
          };
        }
        executeStructuredDeclaration({ combatData, declaration, actionContext });
        resolvedEffectCount += 1;
      });
      if (resolvedEffectCount > 0) logs.push(`[维持释放] ${effect.name || key}完成${resolvedEffectCount}项持续结算。`);
      else logs.push(`[维持释放] ${effect.name || key}重扫当前目标，但没有可作用目标。`);
    });
    refreshSustainRuntimeLoad(unit);
    return { log: logs.join(' '), broken };
  }

  function settleBattleRoundEnd(combatData = {}, logs = [], adapterOptions = {}) {
    listCombatUnits(combatData).forEach(unit => {
      syncRoundEndUnit(unit);
      if (previewRuntime.readHp(unit) <= 0) {
        clearC2FoodMaintenanceRuntime(unit);
        return;
      }
      const name = previewRuntime.unitName(unit);
      const sustainResult = settleSustainAtRoundEnd(unit, name, combatData) || {};
      const conditionResult = settleConditionsAtRoundEnd(unit, name, combatData) || {};
      syncRoundEndUnit(unit);
      if (sustainResult.log) logs.push(`[团战回合尾] ${sustainResult.log}`);
      if (conditionResult.log) logs.push(`[团战回合尾] ${conditionResult.log}`);
    });
    const currentRound = Math.max(0, Number(combatData?.回合 || 0));
    listCombatUnits(combatData).forEach(unit => {
      const stance = unit?.__battleRuntime?.activeDefenseStance;
      if (!stance || stance.consumed === true) return;
      if (Math.max(0, Number(stance.establishedRound || 0)) > currentRound) return;
      const unitSide = previewRuntime.sideOf(combatData, unit);
      const unitId = previewRuntime.unitId(unit);
      const unitName = previewRuntime.unitName(unit);
      const hasNextOpportunityThreat = listCombatUnits(combatData).some(source => {
        if (source === unit || previewRuntime.sideOf(combatData, source) === unitSide) return false;
        const charge = source?.蓄力技能;
        if (!charge || typeof charge !== 'object') return false;
        const remainingCastTime = Math.max(0, Number(
          charge.cast_time ??
          charge.remainingCastTime ??
          charge.skill?.前摇 ??
          charge.skill?.cast_time ??
          0,
        ));
        if (remainingCastTime > 40) return false;
        const targetIds = [
          ...(Array.isArray(charge.targetIds) ? charge.targetIds : []),
          charge.targetId,
          charge.target_name,
          charge.targetName,
        ].map(value => String(value || '').trim()).filter(Boolean);
        return !targetIds.length || targetIds.some(targetId =>
          targetId === unitId || targetId === unitName
        );
      });
      if (hasNextOpportunityThreat) return;
      delete unit.__battleRuntime.activeDefenseStance;
      const actionKind = String(stance.actionKind || stance.type || '').trim().toUpperCase();
      const stateName = actionKind === 'EVADE' ? '闪避姿态' : '防御姿态';
      writeLedgerEvent(combatData, {
        eventKind: 'state_expire',
        round: currentRound,
        actorName: previewRuntime.unitName(unit),
        targetName: previewRuntime.unitName(unit),
        actionName: stateName,
        actionType: 'defense_stance',
        actorControl: 'SYSTEM',
        actionRole: 'STATE_TICK',
        sourceActionId: String(stance.sourceActionId || '').trim(),
        parentNodeId: String(stance.sourceNodeId || '').trim(),
        sourceNodeId: String(stance.sourceNodeId || '').trim(),
        result: 'expired',
        resultState: 'EXPIRED',
        ruleCode: 'DEFENSE_WINDOW_EXPIRED',
        meta: {
          source: 'structured_runtime',
          actionKind,
          establishedRound: Math.max(0, Number(stance.establishedRound || 0)),
          stateName,
        },
      }, adapterOptions);
      logs.push(`[防守窗口] ${previewRuntime.unitName(unit)}的${stateName}已到期。`);
    });
    const guardLog = settleGuardSummonWindows(combatData, adapterOptions);
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

  function settleGuardSummonWindows(combatData = {}, adapterOptions = {}) {
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
      isRegisteredActor: options?.isRegisteredActor,
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
    const requestedRingId = String(declaration?.ringId || declaration?.skill?.ringId || '').trim();
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
      if (String(candidateDeclaration?.ringId || '').trim() !== requestedRingId) return false;
      const candidateTargets = Array.isArray(candidateDeclaration.targetIds) ? candidateDeclaration.targetIds.map(String) : [];
      return candidateTargets.length === targetIds.length && candidateTargets.every((targetId, index) => targetId === targetIds[index]);
    });
    if (!legalCandidate) throw new Error('battle_declaration_mechanically_illegal');
    const seed = Math.max(1, Math.floor(Number(input?.seed || 1)));
    const lockedDeclaration = cloneValue(legalCandidate.declaration);
    const requestedSkill = declaration?.skill && typeof declaration.skill === 'object' ? declaration.skill : {};
    if (declaration.historySnapshot !== undefined || requestedSkill.historySnapshot !== undefined) {
      lockedDeclaration.historySnapshot = cloneValue(
        declaration.historySnapshot && typeof declaration.historySnapshot === 'object'
          ? declaration.historySnapshot
          : combatData,
      );
    }
    const result = runStructuredBattle({
      ...input,
      combatData,
      caseId: input?.caseId || 'structured-declaration',
      seed,
      rounds: 1,
      settings: {
        ...input?.settings,
        providerId: '',
        decisionOnly: false,
        playerLockedSettlement: true,
      },
      selectedAction: {
        actorId,
        targetIds,
        actionKind: String(lockedDeclaration?.actionKind || declaration?.actionKind || '').trim(),
        declaration: lockedDeclaration,
      },
    });
    Object.assign(combatData, result.combatData || {});
    attachLedger(combatData, cloneValue(result.ledger || []));
    Object.defineProperty(combatData, '__battleResolutionTrace', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: cloneValue(result.trace || []),
    });
    return { ...result, rounds: Number(result?.roundsExecuted || 0), combatData };
  }

  function resolveStructuredTargets(combatData = {}, actor = {}, declaration = {}, effect = {}) {
    return previewRuntime.resolveTargets(combatData, actor, declaration, effect);
  }

  function structuredDeclarationEffectTargetAudit(combatData = {}, actor = {}, declaration = {}) {
    const actionKind = String(declaration?.actionKind || '').trim().toUpperCase();
    const skill = declaration?.skill && typeof declaration.skill === 'object'
      ? declaration.skill
      : {};
    const explicitEffects = Array.isArray(skill?._效果数组)
      ? skill._效果数组.filter(effect => effect && typeof effect === 'object')
      : [];
    const equipmentModifiers = skill?.装备属性 && typeof skill.装备属性 === 'object'
      ? skill.装备属性
      : skill?.属性加成 && typeof skill.属性加成 === 'object'
        ? skill.属性加成
        : {};
    const effects = actionKind === 'BASIC_ATTACK'
      ? [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 攻击段数: 1 }]
      : actionKind === 'EQUIP' && !explicitEffects.length
        ? Object.entries(equipmentModifiers).map(([attribute, value]) => ({
            原型: '属性修正',
            目标: '自身',
            生效方式: '独立生效',
            属性: attribute,
            数值: value,
            持续回合: 99,
          }))
        : explicitEffects;
    return effects.map((effect, effectIndex) => ({
      effectIndex,
      prototype: String(effect?.原型 || '').trim(),
      target: String(effect?.目标 || declaration?.targetKind || '').trim(),
      followsPrimary:
        effectIndex > 0 &&
        String(effect?.生效方式 || '').trim() === '跟随主原型',
      targetIds: [
        ...new Set(
          (!String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果)
            ? [actor]
            : resolveStructuredTargets(combatData, actor, declaration, effect)
          )
            .map(previewRuntime.unitId)
            .map(String)
            .filter(Boolean),
        ),
      ],
    }));
  }

  function writeStructuredResourceFact(
    combatData = {},
    actor = {},
    target = {},
    action = {},
    actionEvent = {},
    resourceKey = '',
    delta = 0,
    actionRole = 'ACTIVE',
    operation = '',
    details = {},
  ) {
    const amount = Number(delta || 0);
    if (!amount) return null;
    const resource = { hp: '生命', vit: '体力', sp: '魂力', men: '精神力', shield: '护盾' }[resourceKey] || resourceKey;
    const resourceOperation = resourceKey === 'shield'
      ? String(operation || (amount > 0 ? 'CREATE' : 'REDUCE')).trim().toUpperCase()
      : String(operation || (amount > 0 ? 'RESTORE' : 'REDUCE')).trim().toUpperCase();
    return writeLedgerEvent(combatData, {
      eventKind: resourceKey === 'shield' ? (amount > 0 ? 'shield_create' : 'shield_break') : 'resource_change',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(actor),
      actorName: previewRuntime.unitName(actor),
      targetId: previewRuntime.unitId(target),
      targetName: previewRuntime.unitName(target),
      actionName: action.actionName,
      actionType: action.actionKind,
      actorControl: action.actorControl,
      actionRole,
      actionId: actionEvent?.actionId || '',
      sourceActionId: actionEvent?.actionId || '',
      parentNodeId: actionEvent?.chainNodeId || '',
      sourceNodeId: actionEvent?.chainNodeId || '',
      result: amount > 0 ? 'gain' : 'loss',
      resultState: amount > 0 ? 'GAIN' : 'LOSS',
      primaryOutcome: resourceKey === 'shield'
        ? amount > 0 ? 'shield_created' : 'shield_reduced'
        : amount > 0 ? 'resource_restored' : 'resource_reduced',
      operation: resourceOperation,
      factType: String(details?.factType || '').trim(),
      effectPrototype: String(details?.effectPrototype || '').trim(),
      sourceEffectId: String(details?.sourceEffectId || '').trim(),
      meta: {
        resource,
        resourceKey,
        delta: amount,
        amount: Math.abs(amount),
        operation: resourceOperation,
        before: Number.isFinite(Number(details?.before)) ? Number(details.before) : null,
        after: Number.isFinite(Number(details?.after)) ? Number(details.after) : null,
        effectInstanceId: String(details?.sourceEffectId || '').trim(),
        source: String(details?.source || 'structured_runtime').trim(),
        ...(details?.meta && typeof details.meta === 'object' ? cloneValue(details.meta) : {}),
      },
    });
  }

  function readSoulPowerCapForEquivalentLevel(level = 0) {
    const equivalentLevel = Math.max(1, Number(level || 0));
    const candidates = [root];
    try { if (root.parent && root.parent !== root) candidates.push(root.parent); } catch (_error) {}
    try { if (root.top && root.top !== root && !candidates.includes(root.top)) candidates.push(root.top); } catch (_error) {}
    const calculator = candidates
      .map(candidate => candidate && candidate.__LWCS_CALC_SOUL_POWER_CAP__)
      .find(candidate => typeof candidate === 'function');
    if (!calculator) throw new Error('battle_runtime_soul_power_cap_interface_missing');
    const cap = Number(calculator(equivalentLevel));
    if (!Number.isFinite(cap) || cap <= 0) throw new Error(`battle_runtime_soul_power_cap_invalid:${equivalentLevel}`);
    return cap;
  }

  function ensureDamageAbsorptionStorage(unit = {}) {
    unit.__battleRuntime = unit.__battleRuntime && typeof unit.__battleRuntime === 'object'
      ? unit.__battleRuntime
      : {};
    unit.__battleRuntime.damageAbsorptionStorageByState =
      unit.__battleRuntime.damageAbsorptionStorageByState && typeof unit.__battleRuntime.damageAbsorptionStorageByState === 'object'
        ? unit.__battleRuntime.damageAbsorptionStorageByState
        : {};
    return unit.__battleRuntime.damageAbsorptionStorageByState;
  }

  function isActiveEquipmentAbsorptionState(state = {}) {
    return state && typeof state === 'object' &&
      String(state?.原型 || '').trim() === '结算修正' &&
      String(state?.结算 || '').trim() === '伤害吸收' &&
      Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 1)) > 0;
  }

  function writeDamageAbsorptionSettlementFact({
    combatData = {},
    actor = {},
    target = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    damageEvent = {},
    stateKey = '',
    state = {},
    outcome = '',
    storedDamage = 0,
    actualAdditionalDamage = 0,
    soulPowerCap = null,
    targetRemainingHpBefore = null,
  } = {}) {
    return writeLedgerEvent(combatData, {
      eventKind: 'effect_resolved',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(actor),
      actorName: previewRuntime.unitName(actor),
      targetId: previewRuntime.unitId(target),
      targetName: previewRuntime.unitName(target),
      actionName: action.actionName,
      actionType: action.actionKind,
      actorControl: action.actorControl,
      actionRole,
      actionId: actionEvent?.actionId || '',
      sourceActionId: actionEvent?.actionId || '',
      parentNodeId: damageEvent?.chainNodeId || actionEvent?.chainNodeId || '',
      sourceNodeId: damageEvent?.chainNodeId || actionEvent?.chainNodeId || '',
      result: 'applied',
      resultState: 'SUCCESS',
      primaryOutcome: outcome,
      effectPrototype: '结算修正',
      factType: 'SETTLEMENT_MODIFIER',
      sourceEffectId: String(state?.effectId || state?.效果ID || stateKey).trim(),
      operation: 'SETTLEMENT_MODIFY',
      meta: {
        source: 'equipment_passive_damage_absorption_v1',
        sourceName: [state?.__equipmentSourceItem, state?.__equipmentSkillName].filter(Boolean).join('·') || '装备被动·伤害吸收',
        sourceDamageEventId: String(damageEvent?.eventId || '').trim(),
        equipmentPassiveStateKey: stateKey,
        absorptionSource: String(state?.吸收来源 || '').trim(),
        absorptionResource: String(state?.吸收资源 || '').trim(),
        conversionEffect: String(state?.转化效果 || '').trim(),
        storedDamage: Math.max(0, Number(storedDamage || 0)),
        actualAdditionalDamage: Math.max(0, Number(actualAdditionalDamage || 0)),
        equivalentLevel: Math.max(0, Number(state?.对应等级 || 0)),
        soulPowerCap: soulPowerCap === null ? null : Math.max(0, Number(soulPowerCap || 0)),
        targetRemainingHpBefore: targetRemainingHpBefore === null ? null : Math.max(0, Number(targetRemainingHpBefore || 0)),
      },
    });
  }

  function writeDamageAbsorptionReleaseDamage({
    combatData = {},
    actor = {},
    target = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    damageEvent = {},
    stateKey = '',
    state = {},
    effectIndex = 100000,
    actualAdditionalDamage = 0,
    storedDamage = 0,
    soulPowerCap = null,
    targetBefore = 0,
    targetAfter = 0,
  } = {}) {
    const damage = Math.max(0, Math.round(Number(actualAdditionalDamage || 0)));
    if (!(damage > 0)) return null;
    return writeLedgerEvent(combatData, {
      eventKind: 'hit_result',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(actor),
      actorName: previewRuntime.unitName(actor),
      targetId: previewRuntime.unitId(target),
      targetName: previewRuntime.unitName(target),
      actionName: action.actionName,
      actionType: action.actionKind,
      actorControl: action.actorControl,
      actionRole,
      actionId: actionEvent?.actionId || '',
      sourceActionId: actionEvent?.actionId || '',
      parentNodeId: damageEvent?.chainNodeId || actionEvent?.chainNodeId || '',
      sourceNodeId: damageEvent?.chainNodeId || actionEvent?.chainNodeId || '',
      result: 'hit',
      resultState: 'SUCCESS',
      primaryOutcome: 'white_tiger_absorption_release',
      effectPrototype: '伤害结算',
      factType: 'DAMAGE',
      sourceEffectId: String(state?.effectId || state?.效果ID || stateKey).trim(),
      operation: 'DAMAGE',
      appliedDamage: damage,
      effectCapability: { hasDamageEffect: true, effectKinds: ['damage_absorption_release'] },
      meta: {
        source: 'equipment_passive_damage_absorption_v1',
        sourceName: [state?.__equipmentSourceItem, state?.__equipmentSkillName].filter(Boolean).join('·') || '装备被动·伤害吸收',
        damageKind: 'absorbed_release',
        sourceDamageEventId: String(damageEvent?.eventId || '').trim(),
        equipmentPassiveStateKey: stateKey,
        storedDamage: Math.max(0, Number(storedDamage || 0)),
        actualAdditionalDamage: damage,
        equivalentLevel: Math.max(0, Number(state?.对应等级 || 0)),
        soulPowerCap: soulPowerCap === null ? null : Math.max(0, Number(soulPowerCap || 0)),
        before: Math.max(0, Number(targetBefore || 0)),
        after: Math.max(0, Number(targetAfter || 0)),
        delta: -damage,
        directHpDamage: true,
        effectIndex,
        segmentIndex: 0,
        operation: 'DAMAGE',
      },
    });
  }

  function settleCounterDamage(input = {}) {
    const combatData = input?.combatData || {};
    const actor = input?.actor || {};
    const target = input?.target || {};
    const action = input?.action || {};
    const actionEvent = input?.actionEvent || {};
    const damageEvent = input?.damageEvent || {};
    const actualDamage = Math.max(0, Number(input?.actualDamage || 0));
    if (!previewRuntime.unitId(actor) || !previewRuntime.unitId(target) || actor === target || !(actualDamage > 0)) return [];
    const runtime = ensureCombatRuntime(combatData);
    if (Number(runtime.counterDamageDepth || 0) > 0) return [];
    const ratio = Object.values(target?.状态效果 || {}).reduce((total, state) => {
      const effects = state?.战斗效果 || {};
      const explicit = Math.max(0, Number(effects.counter_attack_ratio || effects.damage_reflect_ratio || 0));
      const sourceText = [state?.__equipmentSkillName, state?.来源技能, state?.状态, state?.状态名称]
        .map(value => String(value || '').trim()).filter(Boolean).join('|');
      const semantic = String(state?.结算 || '').trim() === '受到伤害' && /反弹|反射/.test(sourceText)
        ? Math.abs(Number(previewRuntime.parseSignedValue(state?.数值, 1) || 0))
        : 0;
      return total + Math.max(explicit, semantic);
    }, 0);
    if (!(ratio > 0)) return [];
    const reflected = Math.max(0, Math.min(previewRuntime.readHp(actor), Math.floor(actualDamage * ratio)));
    if (!(reflected > 0)) return [];
    runtime.counterDamageDepth = Number(runtime.counterDamageDepth || 0) + 1;
    try {
      const before = previewRuntime.readHp(actor);
      writeCombatResource(actor, 'hp', before - reflected);
      const after = previewRuntime.readHp(actor);
      return [writeLedgerEvent(combatData, {
        eventKind: 'hit_result',
        round: Number(combatData?.回合 || 0),
        actorId: previewRuntime.unitId(target),
        actorName: previewRuntime.unitName(target),
        targetId: previewRuntime.unitId(actor),
        targetName: previewRuntime.unitName(actor),
        actionName: action.actionName,
        actionType: action.actionKind,
        actorControl: action.actorControl,
        actionRole: String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE',
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '',
        sourceNodeId: actionEvent.chainNodeId || '',
        result: 'hit',
        resultState: 'SUCCESS',
        primaryOutcome: 'counter_damage',
        ruleCode: 'DAMAGE_REFLECTED',
        effectPrototype: '结算修正',
        factType: 'DAMAGE',
        sourceEffectId: String(damageEvent?.sourceEffectId || '').trim(),
        operation: 'DAMAGE',
        appliedDamage: reflected,
        meta: {
          source: 'equipment_passive_counter_v1',
          sourceDamageEventId: String(damageEvent?.eventId || '').trim(),
          counterRatio: ratio,
          reflectedDamage: reflected,
          before,
          after,
          delta: after - before,
          preventRecursiveCounter: true,
        },
      })].filter(Boolean);
    } finally {
      runtime.counterDamageDepth = Math.max(0, Number(runtime.counterDamageDepth || 1) - 1);
    }
  }

  function consumeRuleDefenseBlock(input = {}) {
    const combatData = input?.combatData || {};
    const actor = input?.actor || {};
    const target = input?.target || {};
    const action = input?.action || {};
    const actionEvent = input?.actionEvent || {};
    const actionRole = String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE';
    if (findRuleSuppression(target, '规则防御', '规则', '免伤')) return null;
    const entry = Object.entries(target?.状态效果 || {}).find(([, state]) => {
      const effects = state?.战斗效果 || {};
      return String(state?.规则 || state?.防御对象 || '').trim() === '免伤' && Number(effects.block_count || 0) > 0;
    });
    if (!entry) return null;
    const [stateKey, state] = entry;
    const remaining = Math.max(0, Number(state?.战斗效果?.block_count || 0) - 1);
    state.战斗效果.block_count = remaining;
    return writeLedgerEvent(combatData, {
      eventKind: 'hit_result',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(actor),
      actorName: previewRuntime.unitName(actor),
      targetId: previewRuntime.unitId(target),
      targetName: previewRuntime.unitName(target),
      actionName: action.actionName,
      actionType: action.actionKind,
      actorControl: action.actorControl,
      actionRole,
      actionId: actionEvent.actionId,
      sourceActionId: actionEvent.actionId,
      parentNodeId: actionEvent.chainNodeId || '',
      sourceNodeId: actionEvent.chainNodeId || '',
      result: 'blocked',
      resultState: 'SUCCESS',
      primaryOutcome: 'rule_defense_immune',
      ruleCode: 'RULE_DEFENSE_BLOCK_CONSUMED',
      effectPrototype: '规则防御',
      factType: 'RULE_DEFENSE',
      operation: 'DAMAGE_BLOCK',
      meta: {
        source: 'structured_runtime',
        rule: '免伤',
        stateKey,
        consumed: 1,
        remaining,
        noRefreshWithinBattle: true,
      },
    });
  }

  function consumeEquivalentLevelProtectionCheck(input = {}) {
    const combatData = input?.combatData || {};
    const actor = input?.actor || {};
    const target = input?.target || {};
    const effect = input?.effect || {};
    const action = input?.action || {};
    const actionEvent = input?.actionEvent || {};
    const actionRole = String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE';
    const incomingLevel = Math.max(0, Number(
      effect?.对应等级 ??
      effect?.等级 ??
      actor?.属性?.等级 ??
      actor?.等级 ??
      actor?.level ??
      0,
    ));
    return Object.entries(target?.状态效果 || {})
      .filter(([, state]) =>
        state?.__equipmentPassiveState === true &&
        String(state?.对应等级用途 || '').trim() === '受击门槛',
      )
      .map(([stateKey, state]) => {
        const equivalentLevel = Math.max(0, Number(state?.对应等级 || state?.equivalentLevel || 0));
        if (!(equivalentLevel > 0)) return null;
        const allowed = incomingLevel <= 0 || incomingLevel <= equivalentLevel;
        return writeLedgerEvent(combatData, {
          eventKind: 'hit_result',
          round: Number(combatData?.回合 || 0),
          actorId: previewRuntime.unitId(actor),
          actorName: previewRuntime.unitName(actor),
          targetId: previewRuntime.unitId(target),
          targetName: previewRuntime.unitName(target),
          actionName: action.actionName,
          actionType: action.actionKind,
          actorControl: action.actorControl,
          actionRole,
          actionId: actionEvent.actionId,
          sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '',
          sourceNodeId: actionEvent.chainNodeId || '',
          result: 'checked',
          resultState: allowed ? 'SUCCESS' : 'FAILURE',
          primaryOutcome: allowed ? 'equivalent_level_gate_passed' : 'equivalent_level_gate_exceeded',
          ruleCode: 'EQUIPMENT_EQUIVALENT_LEVEL_GATE_CHECK',
          effectPrototype: '结算修正',
          factType: 'RULE_DEFENSE',
          operation: 'CHECK',
          meta: {
            source: 'structured_runtime',
            stateKey,
            sourceName: [state?.__equipmentSourceItem, state?.__equipmentSkillName].filter(Boolean).join('·'),
            equivalentLevel,
            incomingLevel,
            allowed,
            consumed: true,
          },
        });
      })
      .filter(Boolean);
  }

  function settleDamageAbsorption(input = {}) {
    const combatData = input?.combatData || {};
    const actor = input?.actor || {};
    const target = input?.target || {};
    const declaration = input?.declaration || {};
    const action = input?.action || {};
    const actionEvent = input?.actionEvent || {};
    const damageEvent = input?.damageEvent || {};
    const damageEventId = String(damageEvent?.eventId || '').trim();
    const damageOutcome = [damageEvent?.result, damageEvent?.resultState, damageEvent?.primaryOutcome]
      .map(value => String(value || '').trim())
      .join(' ');
    const appliedDamage = Math.max(0, Number(damageEvent?.meta?.appliedDamage ?? damageEvent?.appliedDamage ?? 0));
    const incomingDamage = Math.max(0, Number(damageEvent?.meta?.incomingDamage ?? 0));
    const actualDamage = appliedDamage;
    const receivedDamage = appliedDamage > 0 ? appliedDamage : incomingDamage;
    if (/miss|failure|dodged|evaded|未命中|闪避/i.test(damageOutcome)) return [];
    if (!damageEventId || !(actualDamage > 0 || receivedDamage > 0)) return [];
    const runtime = ensureCombatRuntime(combatData);
    if (runtime.damageAbsorptionConsumedEventIds.has(damageEventId)) return [];
    runtime.damageAbsorptionConsumedEventIds.add(damageEventId);
    const skill = declaration?.skill && typeof declaration.skill === 'object' ? declaration.skill : {};
    const context = {
      declaration,
      action,
      actionKind: action?.actionKind,
      actionName: action?.actionName,
      primaryOutcome: 'HIT',
      primarySucceeded: true,
      damageEvent,
      actualDamage: receivedDamage,
    };
    const facts = [];
    const resourceKeyByName = { 生命: 'hp', 魂力: 'sp', 精神力: 'men', 体力: 'vit' };
    const actorStorage = ensureDamageAbsorptionStorage(actor);
    const targetStorage = ensureDamageAbsorptionStorage(target);
    const actorStates = Object.entries(actor?.状态效果 || {});
    const targetStates = Object.entries(target?.状态效果 || {});

    actorStates.forEach(([stateKey, state], stateIndex) => {
      if (!isActiveEquipmentAbsorptionState(state)) return;
      if (String(state?.吸收来源 || '').trim() !== '受到伤害') return;
      if (String(state?.转化效果 || '').trim() !== '下次造成伤害') return;
      const stored = Math.max(0, Number(actorStorage[stateKey]?.amount || 0));
      if (!(stored > 0)) return;
      if (!previewRuntime.skillMatchesLimitedElements(skill, state?.限定元素)) return;
      if (!previewRuntime.effectConditionEnabled(state, combatData, actor, target, context)) return;
      const equivalentLevel = Math.max(0, Number(state?.对应等级 || 0));
      const soulPowerCap = equivalentLevel > 0 ? readSoulPowerCapForEquivalentLevel(equivalentLevel) : null;
      const capRatio = state?.增幅上限 === undefined
        ? Infinity
        : Math.max(0, Number(previewRuntime.parseSignedValue(state?.增幅上限, 0) || 0));
      const releaseBeforeTargetLimit = Math.min(
        stored,
        Number.isFinite(capRatio) ? actualDamage * capRatio : stored,
      );
      const targetBefore = Math.max(0, Number(previewRuntime.readHp(target) || 0));
      const releaseAmount = Math.max(0, Math.min(targetBefore, releaseBeforeTargetLimit));
      delete actorStorage[stateKey];
      const settlementFact = writeDamageAbsorptionSettlementFact({
        combatData,
        actor,
        target,
        action,
        actionEvent,
        actionRole: String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE',
        damageEvent,
        stateKey,
        state,
        outcome: 'damage_absorption_consumed',
        storedDamage: stored,
        actualAdditionalDamage: releaseAmount,
        soulPowerCap,
        targetRemainingHpBefore: targetBefore,
      });
      if (settlementFact) facts.push(settlementFact);
      if (!(releaseAmount > 0)) return;
      writeCombatResource(target, 'hp', targetBefore - releaseAmount);
      const targetAfter = Math.max(0, Number(previewRuntime.readHp(target) || 0));
      const actualAdditionalDamage = Math.max(0, targetBefore - targetAfter);
      const damageFact = writeDamageAbsorptionReleaseDamage({
        combatData,
        actor,
        target,
        action,
        actionEvent,
        actionRole: String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE',
        damageEvent,
        stateKey,
        state,
        effectIndex: 100000 + stateIndex,
        actualAdditionalDamage,
        storedDamage: stored,
        soulPowerCap,
        targetBefore,
        targetAfter,
      });
      if (damageFact) facts.push(damageFact);
    });

    targetStates.forEach(([stateKey, state]) => {
      if (!isActiveEquipmentAbsorptionState(state)) return;
      if (String(state?.吸收来源 || '').trim() !== '受到伤害') return;
      if (!previewRuntime.skillMatchesLimitedElements(skill, state?.限定元素)) return;
      if (!previewRuntime.effectConditionEnabled(state, combatData, actor, target, context)) return;
      const ratio = Math.max(0, Number(previewRuntime.parseSignedValue(state?.数值, 1) || 0));
      if (!(ratio > 0)) return;
      const conversion = String(state?.转化效果 || '').trim();
      if (conversion === '立即恢复') {
        const resourceName = String(state?.吸收资源 || '').trim();
        const resourceKey = resourceKeyByName[resourceName];
        if (!resourceKey) return;
        const before = persistentResourceValue(target, resourceKey);
        writeCombatResource(target, resourceKey, before + receivedDamage * ratio);
        const after = persistentResourceValue(target, resourceKey);
        const delta = after - before;
        if (!(delta > 0)) return;
        const resourceFact = writeStructuredResourceFact(
          combatData,
          actor,
          target,
          action,
          actionEvent,
          resourceKey,
          delta,
          String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE',
          'RESTORE',
          {
            before,
            after,
            sourceEffectId: String(state?.effectId || state?.效果ID || stateKey).trim(),
            effectPrototype: '结算修正',
            factType: 'RESOURCE',
            source: 'equipment_passive_damage_absorption_v1',
            meta: {
              sourceDamageEventId: damageEventId,
              actualDamage: receivedDamage,
              absorptionRatio: ratio,
              absorptionResource: resourceName,
              conversionEffect: conversion,
              requestedDelta: receivedDamage * ratio,
              equipmentPassiveStateKey: stateKey,
            },
          },
        );
        if (resourceFact) {
          resourceFact.ruleCode = 'ITEM_PASSIVE_DAMAGE_ABSORPTION';
          resourceFact.primaryOutcome = 'damage_absorbed_to_resource';
          facts.push(resourceFact);
        }
        return;
      }
      if (conversion !== '下次造成伤害') return;
      const equivalentLevel = Math.max(0, Number(state?.对应等级 || 0));
      const soulPowerCap = equivalentLevel > 0 ? readSoulPowerCapForEquivalentLevel(equivalentLevel) : null;
      const current = Math.max(0, Number(targetStorage[stateKey]?.amount || 0));
      const requestedDelta = receivedDamage * ratio;
      const nextAmount = soulPowerCap === null
        ? current + requestedDelta
        : Math.min(soulPowerCap, current + requestedDelta);
      const storedDelta = Math.max(0, nextAmount - current);
      if (!(storedDelta > 0)) return;
      targetStorage[stateKey] = {
        amount: nextAmount,
        equivalentLevel,
        soulPowerCap,
        lastStoredDamageEventId: damageEventId,
      };
      const settlementFact = writeDamageAbsorptionSettlementFact({
        combatData,
        actor,
        target,
        action,
        actionEvent,
        actionRole: String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE',
        damageEvent,
        stateKey,
        state,
        outcome: 'damage_absorption_stored',
        storedDamage: nextAmount,
        actualAdditionalDamage: 0,
        soulPowerCap,
        targetRemainingHpBefore: null,
      });
      if (settlementFact) {
        settlementFact.meta.requestedStorageDelta = requestedDelta;
        settlementFact.meta.actualStorageDelta = storedDelta;
        facts.push(settlementFact);
      }
    });

    actorStates.forEach(([stateKey, state]) => {
      if (!isActiveEquipmentAbsorptionState(state)) return;
      if (String(state?.吸收来源 || '造成伤害').trim() !== '造成伤害') return;
      if (String(state?.转化效果 || '').trim() === '下次造成伤害') return;
      if (!previewRuntime.skillMatchesLimitedElements(skill, state?.限定元素)) return;
      if (!previewRuntime.effectConditionEnabled(state, combatData, actor, target, context)) return;
      const resourceName = String(state?.吸收资源 || '').trim();
      const resourceKey = resourceKeyByName[resourceName];
      const ratio = Math.max(0, Number(previewRuntime.parseSignedValue(state?.数值, 1) || 0));
      if (!resourceKey || !(ratio > 0)) return;
      const before = persistentResourceValue(actor, resourceKey);
      const requestedDelta = actualDamage * ratio;
      writeCombatResource(actor, resourceKey, before + requestedDelta);
      const after = persistentResourceValue(actor, resourceKey);
      const delta = after - before;
      if (!(delta > 0)) return;
      const sourceEffectId = String(state?.effectId || state?.效果ID || stateKey).trim();
      const resourceFact = writeStructuredResourceFact(
        combatData,
        actor,
        actor,
        action,
        actionEvent,
        resourceKey,
        delta,
        String(input?.actionRole || 'ACTIVE').trim() || 'ACTIVE',
        'RESTORE',
        {
          before,
          after,
          sourceEffectId,
          effectPrototype: '结算修正',
          factType: 'RESOURCE',
          source: 'equipment_passive_damage_absorption_v1',
          meta: {
            sourceDamageEventId: damageEventId,
            actualDamage,
            absorptionRatio: ratio,
            absorptionResource: resourceName,
            requestedDelta,
            equipmentPassiveStateKey: stateKey,
          },
        },
      );
      if (!resourceFact) return;
      resourceFact.ruleCode = 'ITEM_PASSIVE_DAMAGE_ABSORPTION';
      resourceFact.primaryOutcome = 'damage_absorbed_to_resource';
      facts.push(resourceFact);
    });
    return facts;
  }

  const structuredPrototypeOperations = Object.freeze({
    资源转移: 'RESOURCE_TRANSFER',
    属性修正: 'ATTRIBUTE_MODIFY',
    判定修正: 'CHECK_MODIFY',
    结算修正: 'SETTLEMENT_MODIFY',
    炸环: 'RING_BURST',
    时窗修正: 'WINDOW_MODIFY',
    状态移除: 'STATE_REMOVE',
    规则防御: 'RULE_DEFENSE',
    状态转移: 'STATE_TRANSFER',
    状态交换: 'STATE_EXCHANGE',
    资源锁定: 'LOCK',
    规则改写: 'RULE_REWRITE',
    机制抹消: 'MECHANISM_SUPPRESS',
    机制授予: 'OPPORTUNITY_GRANT',
    复制执行: 'COPY_EXECUTE',
    时光回溯: 'SNAPSHOT_RESTORE',
    位移执行: 'POSITION_SHIFT',
    决策干扰: 'STATE_APPLY',
  });
  const structuredFactResourceKeys = Object.freeze(['hp', 'vit', 'sp', 'men']);
  const structuredSnapshotIgnoredFields = new Set([
    'hp', 'HP', 'hp_max', 'HP上限', 'vit', '体力', 'vit_max', '体力上限',
    'sp', '魂力', 'sp_max', '魂力上限', 'men', '精神力', 'men_max', '精神力上限',
    '属性', '状态效果', 'final', '__battleRuntime', '__父级战斗数据', '__宿主', '__来源状态',
  ]);

  function structuredStateIdentity(key = '', state = {}) {
    return String(state?.状态 || state?.状态名称 || state?.名称 || key || '').trim();
  }

  function structuredResourceValue(unit = {}, key = '') {
    if (key === 'hp') return previewRuntime.readHp(unit);
    return previewRuntime.readResource(unit, { vit: '体力', sp: '魂力', men: '精神力' }[key] || key);
  }

  function structuredContributionForTarget(contributions = [], targetId = '', outcomeKinds = []) {
    const accepted = new Set(outcomeKinds.map(value => String(value || '').trim().toUpperCase()).filter(Boolean));
    return contributions.find(contribution =>
      String(contribution?.targetId || '').trim() === String(targetId || '').trim() &&
      (!accepted.size || accepted.has(String(contribution?.outcomeKind || '').trim().toUpperCase()))
    ) || null;
  }

  function structuredPreviewFactBase(
    combatData = {},
    actor = {},
    target = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    prototype = '',
    contribution = null,
  ) {
    return {
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(actor),
      actorName: previewRuntime.unitName(actor),
      targetId: previewRuntime.unitId(target),
      targetName: previewRuntime.unitName(target),
      actionName: action.actionName,
      actionType: action.actionKind,
      actorControl: action.actorControl,
      actionRole,
      actionId: actionEvent?.actionId || '',
      sourceActionId: actionEvent?.actionId || '',
      parentNodeId: actionEvent?.chainNodeId || '',
      sourceNodeId: actionEvent?.chainNodeId || '',
      effectPrototype: prototype,
      sourceEffectId: String(contribution?.effectInstanceId || '').trim(),
      factType: prototypeRuntimeContract[prototype]?.factTypes?.[0] || 'EFFECT',
      groupKey: String(contribution?.evidence?.probabilityGroupKey || contribution?.evidence?.distributionGroupKey || '').trim(),
      operation: structuredPrototypeOperations[prototype] || 'STATE_APPLY',
    };
  }

  function writeStructuredPreviewUnitFacts({
    combatData = {},
    actor = {},
    target = {},
    beforeUnit = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    prototype = '',
    contributions = [],
  } = {}) {
    const facts = [];
    const targetId = previewRuntime.unitId(target);
    const contribution = structuredContributionForTarget(contributions, targetId);
    const base = structuredPreviewFactBase(
      combatData,
      actor,
      target,
      action,
      actionEvent,
      actionRole,
      prototype,
      contribution,
    );
    const beforeResources = Object.fromEntries(
      structuredFactResourceKeys.map(key => [key, structuredResourceValue(beforeUnit, key)]),
    );
    const afterResources = Object.fromEntries(
      structuredFactResourceKeys.map(key => [key, structuredResourceValue(target, key)]),
    );
    structuredFactResourceKeys.forEach(key => {
      const before = Number(beforeResources[key] || 0);
      const after = Number(afterResources[key] || 0);
      const delta = after - before;
      if (Math.abs(delta) <= 1e-9) return;
      const healthContribution = key === 'hp'
        ? structuredContributionForTarget(contributions, targetId, ['HP_DELTA'])
        : null;
      const damageOwnedByHit =
        key === 'hp' &&
        delta < 0 &&
        !!healthContribution &&
        !['资源转移', '时光回溯'].includes(prototype);
      if (damageOwnedByHit) {
        facts.push(writeLedgerEvent(combatData, {
          ...structuredPreviewFactBase(
            combatData,
            actor,
            target,
            action,
            actionEvent,
            actionRole,
            prototype,
            healthContribution,
          ),
          eventKind: 'hit_result',
          result: 'hit',
          resultState: 'SUCCESS',
          primaryOutcome: 'full_hit',
          appliedDamage: Math.abs(delta),
          operation: 'DAMAGE',
          meta: {
            source: 'structured_preview_commit',
            effectInstanceId: String(healthContribution?.effectInstanceId || '').trim(),
            outcomeKind: 'HP_DELTA',
            before,
            after,
            delta,
            rawDamage: Math.abs(delta),
            appliedDamage: Math.abs(delta),
            evidence: cloneValue(healthContribution?.evidence || {}),
          },
        }));
        return;
      }
      facts.push(writeStructuredResourceFact(
        combatData,
        actor,
        target,
        action,
        actionEvent,
        key,
        delta,
        actionRole,
        delta > 0 ? 'RESTORE' : 'REDUCE',
        {
          before,
          after,
          source: 'structured_preview_commit',
          factType: prototypeRuntimeContract[prototype]?.factTypes?.[0] || 'RESOURCE',
          effectPrototype: prototype,
          sourceEffectId: String(contribution?.effectInstanceId || '').trim(),
          meta: {
            outcomeKind: String(contribution?.outcomeKind || 'RESOURCE_OPTION_CHANGED').trim(),
            evidence: cloneValue(contribution?.evidence || {}),
          },
        },
      ));
    });

    const beforeStates = beforeUnit?.状态效果 && typeof beforeUnit.状态效果 === 'object'
      ? beforeUnit.状态效果
      : {};
    const afterStates = target?.状态效果 && typeof target.状态效果 === 'object'
      ? target.状态效果
      : {};
    [...new Set([...Object.keys(beforeStates), ...Object.keys(afterStates)])].sort().forEach(stateKey => {
      const beforeState = beforeStates[stateKey];
      const afterState = afterStates[stateKey];
      if (beforeState !== undefined && afterState !== undefined &&
        stableSerialize(beforeState) === stableSerialize(afterState)) return;
      const eventKind = beforeState === undefined
        ? 'state_apply'
        : afterState === undefined
          ? 'state_remove'
          : 'state_replace';
      const state = afterState ?? beforeState ?? {};
      const stateName = structuredStateIdentity(stateKey, state);
      const stateContribution = structuredContributionForTarget(
        contributions,
        targetId,
        ['STATE_CHANGED', 'NEXT_ACTION_QUALITY_CHANGED', 'RULE_CHANGED', 'ACTION_CANCELLED'],
      ) || contribution;
      const operation = eventKind === 'state_remove'
        ? 'STATE_REMOVE'
        : eventKind === 'state_replace'
          ? 'STATE_REPLACE'
          : structuredPrototypeOperations[prototype] || 'STATE_APPLY';
      facts.push(writeLedgerEvent(combatData, {
        ...structuredPreviewFactBase(
          combatData,
          actor,
          target,
          action,
          actionEvent,
          actionRole,
          prototype,
          stateContribution,
        ),
        eventKind,
        result: eventKind === 'state_remove' ? 'removed' : eventKind === 'state_replace' ? 'replaced' : 'applied',
        resultState: 'SUCCESS',
        primaryOutcome: eventKind,
        operation,
        duration: Math.max(0, Number(afterState?.duration ?? afterState?.持续回合 ?? 0)),
        meta: {
          source: 'structured_runtime',
          effectInstanceId: String(stateContribution?.effectInstanceId || '').trim(),
          outcomeKind: String(stateContribution?.outcomeKind || 'STATE_CHANGED').trim(),
          stateKey,
          stateName,
          before: beforeState === undefined ? null : cloneValue(beforeState),
          after: afterState === undefined ? null : cloneValue(afterState),
          evidence: cloneValue(stateContribution?.evidence || {}),
          operation,
        },
      }));
    });

    if (prototype === '时光回溯') {
      const changedFields = [...new Set([...Object.keys(beforeUnit || {}), ...Object.keys(target || {})])]
        .filter(key => !structuredSnapshotIgnoredFields.has(key))
        .filter(key => stableSerialize(beforeUnit?.[key]) !== stableSerialize(target?.[key]))
        .sort();
      if (changedFields.length) {
        facts.push(writeLedgerEvent(combatData, {
          ...base,
          eventKind: 'snapshot_restore',
          result: 'restored',
          resultState: 'SUCCESS',
          primaryOutcome: 'snapshot_restored',
          operation: 'SNAPSHOT_RESTORE',
          meta: {
            source: 'structured_preview_commit',
            changedFields,
            before: Object.fromEntries(changedFields.map(key => [key, cloneValue(beforeUnit?.[key])])),
            after: Object.fromEntries(changedFields.map(key => [key, cloneValue(target?.[key])])),
          },
        }));
      }
    }
    return facts.filter(Boolean);
  }

  const previewCommittedPrototypes = new Set([
    '资源转移', '属性修正', '判定修正', '结算修正', '炸环', '时窗修正', '状态移除',
    '规则防御', '状态转移', '状态交换', '资源锁定', '规则改写', '机制抹消', '机制授予',
    '复制执行', '时光回溯', '位移执行', '决策干扰',
  ]);

  function applyPreviewUnitSnapshot(target = {}, snapshot = {}) {
    const sourceStateMemory = Object.fromEntries(
      Object.entries(target?.状态效果 || {}).map(([key, state]) => [key, {
        sourceActionId: String(state?.sourceActionId || '').trim(),
        sourceEventId: String(state?.sourceEventId || '').trim(),
        sourceWindow: Array.isArray(state?.__状态来源窗口) ? [...state.__状态来源窗口] : [],
      }]),
    );
    const preserved = {
      __battleRuntime: target.__battleRuntime,
      __父级战斗数据: target.__父级战斗数据,
      __宿主: target.__宿主,
      __来源状态: target.__来源状态,
    };
    Object.keys(target).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key) && !Object.prototype.hasOwnProperty.call(preserved, key)) delete target[key];
    });
    Object.entries(cloneValue(snapshot)).forEach(([key, value]) => { target[key] = value; });
    Object.entries(preserved).forEach(([key, value]) => {
      if (value !== undefined) target[key] = value;
    });
    Object.entries(target?.状态效果 || {}).forEach(([key, state]) => {
      const previous = sourceStateMemory[key];
      if (!previous?.sourceWindow?.length || !state?.sourceActionId || !state?.sourceEventId) return;
      if (String(state.sourceActionId).trim() !== previous.sourceActionId || String(state.sourceEventId).trim() !== previous.sourceEventId) return;
      const duration = Math.max(1, Math.floor(Number(state?.duration || previous.sourceWindow.length)));
      const sourceWindow = previous.sourceWindow.slice(0, duration);
      if (!sourceWindow.length) return;
      Object.defineProperties(state, {
        __状态来源键: { configurable: true, enumerable: false, writable: true, value: sourceWindow[0] },
        __状态来源窗口: { configurable: true, enumerable: false, writable: true, value: sourceWindow },
      });
    });
    if (target.召唤键) syncSummonMirror(target);
  }

  function commitRingBurst(actor = {}, declaration = {}, effect = {}, combatData = {}) {
    const ringPath = Array.isArray(declaration?.ringPath) && declaration.ringPath.length
      ? declaration.ringPath.map(String)
      : String(declaration?.ringId || '').split('/').map(value => String(value || '').trim()).filter(Boolean);
    if (!ringPath.length) throw new Error('battle_ring_burst_selection_missing');
    let ring = actor;
    for (const segment of ringPath) {
      ring = ring?.[segment];
      if (!ring || typeof ring !== 'object' || Array.isArray(ring)) throw new Error(`battle_ring_burst_target_missing:${ringPath.join('/')}`);
    }
    const currentTick = Math.max(0, Number(combatData?.当前世界tick || 0));
    const existingRecoveryTick = Math.max(0, Number(ring?.炸环恢复tick || 0));
    if (existingRecoveryTick > currentTick) throw new Error(`battle_ring_burst_target_recovering:${ringPath.join('/')}`);
    const age = Math.max(100, Number(ring?.年限 || 100));
    const recoveryDuration = Math.max(
      1440,
      Math.floor(Number(effect?.恢复tick || 0)) ||
        Math.round(4320 * Math.max(0.5, Math.min(3, Math.log10(age) - 1))),
    );
    ring.炸环恢复tick = currentTick + recoveryDuration;
    ring.炸环恢复时间 = `${recoveryDuration} tick`;
    return {
      ringId: ringPath.join('/'),
      ringPath,
      age,
      previousRecoveryTick: existingRecoveryTick,
      recoveryTick: ring.炸环恢复tick,
      recoveryDuration,
    };
  }

  function commitStructuredPreviewPrototype(
    combatData = {},
    actor = {},
    declaration = {},
    effect = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    effectIndex = 0,
    outcomeSample = null,
  ) {
    const committedEffect = cloneValue(effect);
    const committedEffectId = String(
      committedEffect?.effectId ||
      committedEffect?.效果ID ||
      `${actionEvent.actionId}:effect:${effectIndex}`,
    ).trim();
    if (!String(committedEffect?.effectId || '').trim() && !String(committedEffect?.效果ID || '').trim()) {
      committedEffect.effectId = committedEffectId;
    }
    ['数值', '副数值'].forEach(field => {
      if (committedEffect[field] === undefined) return;
      committedEffect[field] =
        previewRuntime.sampleSignedValueExpression(
          committedEffect[field],
          Math.random,
        );
    });
    const outcomeSamples = Array.isArray(outcomeSample)
      ? outcomeSample
      : outcomeSample
        ? [outcomeSample]
        : [];
    const primaryOutcomeSample =
      outcomeSamples.find(sample => sample?.succeeded === true) ||
      outcomeSamples[0] ||
      null;
    const previewDeclaration = {
      ...cloneValue(declaration),
      actionKind: String(effect?.原型 || '').trim() === '属性修正'
        ? 'RELEASE_SKILL'
        : declaration?.actionKind,
      actionId: `${actionEvent.actionId}:effect:${effectIndex}`,
      __includeGrantedEffects: false,
      // USE_ITEM 的数量扣减已在结构化结算入口完成（item_consume 事实），提交车道不得重复扣减
      __skipInventoryConsume: true,
      resourceCosts: {},
      skill: {
        ...(cloneValue(declaration?.skill || {})),
        消耗: '无',
        _效果数组: [committedEffect],
      },
    };
    const preview = previewRuntime.previewAction({
      worldSnapshot: combatData,
      worldRevision: `runtime:${String(actionEvent?.actionId || '').trim()}`,
      beliefRevision: 'runtime',
      snapshotRevision: `runtime:${String(actionEvent?.actionId || '').trim()}`,
      basisView: 'RUNTIME_ACTUAL',
      captureDamageBasisTrace: true,
      actorId: previewRuntime.unitId(actor),
      declaration: previewDeclaration,
      actionFingerprint: `runtime:${String(actionEvent?.actionId || '').trim()}:effect:${effectIndex}`,
      paymentMode: 'FORMAL',
      horizon: 'SHALLOW',
      previewBudget: { maxNodes: 12 },
      forcedApplicationProbabilityByEffect: Object.fromEntries(
        outcomeSamples.map(sample => [
          [
            String(
              committedEffect?.effectId ||
              committedEffect?.效果ID ||
              committedEffectId
            ).trim(),
            String(sample?.targetId || '').trim(),
          ].join('|'),
          sample?.succeeded === true ? 1 : 0,
        ]).filter(([key]) => key !== '|'),
      ),
      battleIntent: { mode: String(combatData?.战斗意图 || '').trim(), objectives: combatData?.胜负条件 || {} },
    });
    const prototype = String(effect?.原型 || '').trim();
    const beforeUnitsById = new Map();
    preview.changedUnitIds.forEach(unitId => {
      const actual = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, unitId));
      const snapshot = previewRuntime.findUnit(preview.afterSnapshot, unitId);
      if (!actual || !snapshot) throw new Error(`battle_structured_preview_commit_target_missing:${unitId}`);
      beforeUnitsById.set(unitId, cloneValue(actual));
      const stateKeysBefore = new Set(Object.keys(actual?.状态效果 || {}));
      const committedStateNames = [];
      applyPreviewUnitSnapshot(actual, snapshot);
      Object.entries(actual?.状态效果 || {}).forEach(([key, condition]) => {
        if (stateKeysBefore.has(key) || !String(key).startsWith('preview:') || !condition || typeof condition !== 'object') return;
        const stateName = String(condition?.状态 || condition?.状态名称 || condition?.名称 || '').trim();
        if (!stateName) throw new Error(`battle_structured_state_name_missing:${key}`);
        if (Object.prototype.hasOwnProperty.call(actual.状态效果, stateName)) {
          throw new Error(`battle_structured_state_identity_conflict:${stateName}`);
        }
        delete actual.状态效果[key];
        actual.状态效果[stateName] = condition;
        committedStateNames.push(stateName);
      });
      if (prototype === '属性修正' && committedStateNames.length) {
        const panel = equipmentPassivePanel(committedEffect);
        committedStateNames.forEach(stateName => {
          const condition = actual.状态效果[stateName];
          condition.面板修改比例 = panel.ratio;
          condition.面板固定修正 = panel.fixed;
        });
        const aliases = {
          力量: ['str', '力量'], 防御: ['def', '防御'], 敏捷: ['agi', '敏捷'],
          体力上限: ['vit_max', '体力上限'], 生命上限: ['vit_max', '体力上限'],
          魂力上限: ['sp_max', '魂力上限'], 精神力上限: ['men_max', '精神力上限'],
        };
        (Array.isArray(committedEffect?.属性) ? committedEffect.属性 : [committedEffect?.属性])
          .map(value => String(value || '').trim()).filter(Boolean).forEach(attribute => {
            const keys = aliases[attribute] || [attribute, attribute];
            if (Object.prototype.hasOwnProperty.call(beforeUnitsById.get(unitId), keys[0])) actual[keys[0]] = beforeUnitsById.get(unitId)[keys[0]];
            else delete actual[keys[0]];
            if (actual.属性 && beforeUnitsById.get(unitId)?.属性) actual.属性[keys[1]] = beforeUnitsById.get(unitId).属性[keys[1]];
          });
        actual.final = buildCombatFinalStats(actual, Number(combatData?.当前世界tick || combatData?.当前tick || 0));
      }
      if (
        prototype === '结算修正' &&
        String(committedEffect?.结算 || '').trim() === '受到伤害'
      ) {
        const sourceSkillText = [
          declaration?.skill?.name,
          declaration?.skill?.技能名,
          declaration?.skill?.魂技名,
          declaration?.skill?.效果描述,
          declaration?.skill?.画面描述,
        ].map(value => String(value || '').trim()).filter(Boolean).join('|');
        Object.entries(actual?.状态效果 || {}).forEach(([key, condition]) => {
          if (stateKeysBefore.has(key) || !condition || typeof condition !== 'object') return;
          if (String(condition?.结算 || '').trim() !== '受到伤害') return;
          condition.来源技能 = sourceSkillText;
          condition.__equipmentSkillName = sourceSkillText;
          condition.战斗效果 = {
            ...(condition?.战斗效果 || {}),
            ...equipmentPassiveCombatEffect(
              committedEffect,
              { 技能名: sourceSkillText },
            ),
          };
          if (/反弹|反射/.test(sourceSkillText)) {
            condition.战斗效果.counter_attack_ratio = Math.max(
              Number(condition.战斗效果.counter_attack_ratio || 0),
              Math.abs(Number(previewRuntime.parseSignedValue(committedEffect?.数值, 1) || 0)),
            );
          }
        });
      }
      if (declaration?.actionKind === 'EQUIP') {
        Object.entries(actual?.状态效果 || {}).forEach(([key, condition]) => {
          if (stateKeysBefore.has(key) || !condition || typeof condition !== 'object') return;
          condition.__equipmentState = true;
          condition.__equipmentName = String(action?.actionName || declaration?.skill?.name || declaration?.skill?.魂技名 || '装备').trim();
        });
      }
    });
    const ringBurst = prototype === '炸环'
      ? commitRingBurst(actor, declaration, effect, combatData)
      : null;
    const facts = [];
    beforeUnitsById.forEach((beforeUnit, unitId) => {
      const target = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, unitId));
      if (!target) throw new Error(`battle_structured_preview_commit_target_missing:${unitId}`);
      const unitFacts = writeStructuredPreviewUnitFacts({
        combatData,
        actor,
        target,
        beforeUnit,
        action,
        actionEvent,
        actionRole,
        prototype,
        contributions: preview.contributions,
      });
      unitFacts.filter(fact => ['state_apply', 'state_replace'].includes(fact?.eventKind) &&
        ['applied', 'replaced'].includes(String(fact?.result || '').trim())).forEach(stateFact => {
        const stateName = String(stateFact?.meta?.stateKey || stateFact?.meta?.stateName || '').trim();
        if (!stateName) return;
        bindStateSourceProvenance(combatData, target, stateName, nextRuntimeId('state-src'), stateFact);
      });
      facts.push(...unitFacts);
    });
    if (ringBurst) {
      facts.push(writeLedgerEvent(combatData, {
        eventKind: 'ring_burst',
        round: Number(combatData?.回合 || 0),
        actorId: previewRuntime.unitId(actor),
        actorName: previewRuntime.unitName(actor),
        targetId: previewRuntime.unitId(actor),
        targetName: previewRuntime.unitName(actor),
        actionName: action.actionName,
        actionType: action.actionKind,
        actorControl: action.actorControl,
        actionRole,
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '',
        sourceNodeId: actionEvent.chainNodeId || '',
        result: 'consumed',
        resultState: 'SUCCESS',
        effectPrototype: prototype,
        factType: 'RING_BURST',
        primaryOutcome: 'irreversible_asset_lost',
        operation: 'CONSUME',
        meta: {
          source: 'structured_preview_commit',
          effectIndex,
          ringBurst: cloneValue(ringBurst),
          before: { recoveryTick: Math.max(0, Number(ringBurst.previousRecoveryTick || 0)) },
          after: { recoveryTick: Math.max(0, Number(ringBurst.recoveryTick || 0)) },
        },
      }));
    }
    preview.scheduledEvents.forEach((scheduled, scheduledIndex) => {
      const targetId = String(scheduled?.targetId || previewRuntime.unitId(actor)).trim();
      const target = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetId));
      facts.push(writeLedgerEvent(combatData, {
        eventKind: 'schedule_descriptor', round: Number(combatData?.回合 || 0), actorName: previewRuntime.unitName(actor),
        targetId, targetName: target ? previewRuntime.unitName(target) : targetId, actionName: action.actionName,
        actionType: action.actionKind, actorControl: action.actorControl, actionRole, actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId, parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '',
        result: 'scheduled', resultState: 'GAIN', effectPrototype: prototype,
        factType: 'SCHEDULE',
        primaryOutcome: String(scheduled?.type || 'scheduled').toLowerCase(),
        operation: 'SCHEDULE_CREATE',
        meta: {
          source: 'structured_preview_commit',
          effectIndex,
          scheduledIndex,
          scheduled: cloneValue(scheduled),
          effectInstanceId: String(scheduled?.effectInstanceId || '').trim(),
          operation: 'SCHEDULE_CREATE',
        },
      }));
    });
    const declaredTargetIds = Array.isArray(previewDeclaration?.targetIds)
      ? previewDeclaration.targetIds.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    const wrapperTargetIds = [...new Set([
      ...declaredTargetIds,
      ...preview.changedUnitIds.map(String),
      ...preview.contributions.map(contribution => String(contribution?.targetId || '').trim()),
      ...preview.scheduledEvents.map(scheduled => String(scheduled?.targetId || '').trim()),
    ].filter(Boolean))];
    if (!wrapperTargetIds.length) wrapperTargetIds.push(previewRuntime.unitId(actor));
    const canonicalFacts = facts.filter(fact =>
      String(fact?.eventKind || '').trim() !== 'effect_resolved'
    );
    wrapperTargetIds.forEach(targetId => {
      const target = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetId));
      const childEventIds = canonicalFacts
        .filter(fact =>
          String(fact?.targetId || '').trim() === targetId ||
          (targetId === previewRuntime.unitId(actor) && String(fact?.actorId || '').trim() === targetId)
        )
        .map(fact => String(fact?.eventId || '').trim())
        .filter(Boolean);
      const contribution = structuredContributionForTarget(preview.contributions, targetId);
      const wrapperEffectId = String(
        contribution?.effectInstanceId || committedEffectId,
      ).trim();
      facts.push(writeLedgerEvent(combatData, {
        eventKind: 'effect_resolved',
        round: Number(combatData?.回合 || 0),
        actorId: previewRuntime.unitId(actor),
        actorName: previewRuntime.unitName(actor),
        targetId,
        targetName: target ? previewRuntime.unitName(target) : targetId,
        actionName: action.actionName,
        actionType: action.actionKind,
        actorControl: action.actorControl,
        actionRole,
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '',
        sourceNodeId: actionEvent.chainNodeId || '',
        result: childEventIds.length ? 'resolved' : 'no_effect',
        resultState: childEventIds.length ? 'SUCCESS' : 'NO_EFFECT',
        effectPrototype: prototype,
        sourceEffectId: wrapperEffectId,
        factType: prototypeRuntimeContract[prototype]?.factTypes?.[0] || 'EFFECT',
        primaryOutcome: childEventIds.length ? 'effect_resolved' : 'no_effect',
        groupKey: String(primaryOutcomeSample?.groupKey || '').trim(),
        outcomeId: String(primaryOutcomeSample?.outcomeId || '').trim(),
        probability: Number.isFinite(Number(primaryOutcomeSample?.probability))
          ? Number(primaryOutcomeSample.probability)
          : 1,
        roll: Number.isFinite(Number(primaryOutcomeSample?.roll))
          ? Number(primaryOutcomeSample.roll)
          : null,
        operation: 'WRAP',
        meta: {
          source: 'structured_preview_commit',
          wrapperOnly: true,
          effectIndex,
          childEventIds,
          effectInstanceId: wrapperEffectId,
          windowId: String(contribution?.windowId || '').trim(),
          outcomeKind: String(contribution?.outcomeKind || '').trim(),
          groupKey: String(primaryOutcomeSample?.groupKey || '').trim(),
          outcomeId: String(primaryOutcomeSample?.outcomeId || '').trim(),
          probability: Number.isFinite(Number(primaryOutcomeSample?.probability))
            ? Number(primaryOutcomeSample.probability)
            : 1,
          roll: Number.isFinite(Number(primaryOutcomeSample?.roll))
            ? Number(primaryOutcomeSample.roll)
            : null,
          operation: 'WRAP',
          effectDetail: {
            attribute: Array.isArray(effect?.属性)
              ? effect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、')
              : String(effect?.属性 || '').trim(),
            check: String(effect?.判定 || '').trim(),
            settlement: String(effect?.结算 || '').trim(),
            value: String(effect?.数值 || '').trim(),
            element: String(effect?.限定元素 || '').trim(),
            positionType: String(effect?.位移类型 || '').trim(),
            positionObject: String(effect?.位移对象 || '').trim(),
            distance: Math.max(0, Number(effect?.距离 || 0)),
            resource: String(effect?.资源 || '').trim(),
            duration: Math.max(0, Number(effect?.持续回合 || 0)),
          },
        },
      }));
    });
    return facts.filter(Boolean);
  }

  function ensureStructuredSummonTable(combatData = {}) {
    if (!combatData.召唤单位表 || typeof combatData.召唤单位表 !== 'object' || Array.isArray(combatData.召唤单位表)) {
      Object.defineProperty(combatData, '召唤单位表', { configurable: true, enumerable: true, writable: true, value: {} });
    }
    return combatData.召唤单位表;
  }

  function commitStructuredSummon(
    combatData = {},
    actor = {},
    declaration = {},
    effect = {},
    action = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    effectIndex = 0,
    outcomeSample = null,
  ) {
    const baseName = String(effect?.召唤物名称 || '').trim();
    if (!baseName) throw new Error('battle_structured_summon_name_missing');
    const count = Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
    const duration = Math.max(1, Math.floor(Number(effect?.持续回合 || 1)) || 1);
    const mode = String(effect?.行动模式 || '协同攻击').trim() || '协同攻击';
    const summonType = String(effect?.召唤单位类型 || effect?.召唤类型 || '魂兽').trim() || '魂兽';
    const inheritRatio = Math.max(0.05, Math.min(2, Number(effect?.继承属性比例 || effect?.强度 || effect?.召唤强度 || 0.35) || 0.35));
    const table = ensureStructuredSummonTable(combatData);
    const facts = [];
    const summons = [];
    for (let index = 0; index < count; index += 1) {
      const displayName = count > 1 ? `${baseName}#${index + 1}` : baseName;
      const effectInstanceId = String(
        effect?.effectId ||
        effect?.效果ID ||
        `${String(actionEvent?.actionId || 'action').trim()}:effect:${effectIndex}`,
      ).trim();
      const key = previewRuntime.summonInstanceId(
        String(actionEvent?.actionId || 'action').trim(),
        effectInstanceId,
        index + 1,
      );
      // B1-P1(b)：主键（runtime actionId 口径）不动，另按预演口径（决策候选 id）
      // 计算 previewSummonKey 别名，供战报目录/对账把预演证据与运行时实体接上。
      const decisionCandidateId = String(actionEvent?.meta?.decisionCandidateId || '').trim();
      const previewSummonKey = decisionCandidateId
        ? `preview-summon:${previewRuntime.summonInstanceId(
            decisionCandidateId,
            String(
              effect?.effectId ||
              effect?.效果ID ||
              `${decisionCandidateId}:effect:${effectIndex}`,
            ).trim(),
            index + 1,
          )}`
        : '';
      const definitionHash = previewRuntime.stableHash({
        summonName: displayName,
        summonType,
        mode,
        duration,
        inheritRatio,
        skills: Array.isArray(effect?.技能列表) ? effect.技能列表 : [],
      });
      if (table[key] && table[key].已消散 !== true) {
        if (String(table[key]?.__definitionHash || '').trim() !== definitionHash) {
          throw new Error(`SUMMON_PREVIEW_INSTANCE_CONFLICT:${key}`);
        }
        summons.push(table[key]);
        continue;
      }
      const stateKey = `召唤:${displayName}`;
      const hpMax = Math.max(1, Math.floor(previewRuntime.readHpMax(actor) * inheritRatio));
      const staminaMax = Math.max(1, Math.floor(previewRuntime.readResourceMax(actor, '体力') * inheritRatio));
      const soulMax = Math.max(1, Math.floor(previewRuntime.readResourceMax(actor, '魂力') * inheritRatio));
      const mentalMax = Math.max(1, Math.floor(previewRuntime.readResourceMax(actor, '精神力') * inheritRatio));
      const sourceState = {
        类型: 'buff', 状态: stateKey, 状态名称: stateKey, duration,
        描述: `由[${action.actionName}]生成`, 来源原型摘要: '召唤生成', 来源技能: action.actionName,
        召唤物: {
          召唤键: key, 预演召唤键: previewSummonKey, 召唤单位类型: summonType, 召唤物名称: displayName, 行动模式: mode,
          生命: hpMax, 生命上限: hpMax, 精神负载: Math.max(0, Number(effect?.精神负载 || 0)),
          生成回合: Number(combatData?.回合 || 0), 已消散: false,
        },
      };
      actor.状态效果 = actor.状态效果 && typeof actor.状态效果 === 'object' ? actor.状态效果 : {};
      actor.状态效果[stateKey] = sourceState;
      const summon = {
        id: key, name: displayName, 名称: displayName, 召唤键: key, 预演召唤键: previewSummonKey,
        类型: summonType, 召唤单位类型: summonType, 单位性质: '召唤物', 行动模式: mode,
        宿主名: previewRuntime.unitName(actor), __宿主: actor, __来源状态: sourceState, 来源状态键: stateKey,
        阵营: inferUnitSide(combatData, previewRuntime.unitName(actor)) === 'enemy' ? '敌方' : '玩家',
        生成回合: Number(combatData?.回合 || 0), 精神负载: Math.max(0, Number(effect?.精神负载 || 0)), 已消散: false,
        hp: hpMax, hp_max: hpMax, HP: hpMax, HP上限: hpMax,
        vit: staminaMax, vit_max: staminaMax, sta: staminaMax, sta_max: staminaMax, 体力: staminaMax, 体力上限: staminaMax,
        sp: soulMax, sp_max: soulMax, 魂力: soulMax, 魂力上限: soulMax,
        men: mentalMax, men_max: mentalMax, 精神力: mentalMax, 精神力上限: mentalMax,
        str: Math.max(1, Math.floor(previewRuntime.readCombatStat(actor, 'str') * inheritRatio)),
        def: Math.max(1, Math.floor(previewRuntime.readCombatStat(actor, 'def') * inheritRatio)),
        agi: Math.max(1, Math.floor(previewRuntime.readCombatStat(actor, 'agi') * inheritRatio)),
        状态: { 存活: true }, 状态效果: {}, 持续效果: {},
        __definitionHash: definitionHash,
        技能列表: Array.isArray(effect?.技能列表) && effect.技能列表.length
          ? cloneValue(effect.技能列表)
          : [{ name: '普通攻击', 魂技名: '普通攻击', 消耗: '无', 前摇: 10, _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: Math.max(25, Math.round(50 * inheritRatio)), 伤害类型: '近身攻击' }] }],
      };
      summon.final = buildCombatFinalStats(summon);
      table[key] = summon;
      const window = ensureSummonWindowRuntime(summon);
      window.remainingWindows = duration;
      summon.剩余窗口 = duration;
      syncSummonMirror(summon);
      summons.push(summon);
      facts.push(writeLedgerEvent(combatData, {
        eventKind: 'summon_create', round: Number(combatData?.回合 || 0), actorName: previewRuntime.unitName(actor), targetName: displayName,
        targetId: key, actionName: action.actionName, actionType: action.actionKind, actorControl: action.actorControl,
        actionRole, actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId, parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '',
        result: 'created', resultState: 'GAIN', effectPrototype: '召唤生成', factType: 'SUMMON', primaryOutcome: 'summon_created',
        sourceEffectId: effectInstanceId,
        groupKey: String(outcomeSample?.groupKey || '').trim(),
        outcomeId: String(outcomeSample?.outcomeId || '').trim(),
        probability: Number.isFinite(Number(outcomeSample?.probability))
          ? Number(outcomeSample.probability)
          : 1,
        roll: Number.isFinite(Number(outcomeSample?.roll))
          ? Number(outcomeSample.roll)
          : null,
        operation: 'SUMMON_CREATE',
        position: {
          round: Math.max(0, Number(combatData?.回合 || 0)),
          opportunitySequence: Math.max(
            0,
            Number(actionEvent?.opportunitySequence || 0),
          ),
          actionSequence: Math.max(0, Number(actionEvent?.sequence || 0)),
          phasePriority:
            battleEventContract.phasePriority.SUMMON_CREATE,
          effectSequence: Math.max(0, Number(effectIndex || 0)),
          eventId: '',
        },
        meta: {
          source: 'structured_runtime',
          effectIndex,
          summonKey: key,
          previewSummonKey,
          summonName: displayName,
          summonType,
          summonMode: mode,
          duration,
          windowId: window.windowId,
          grantAvailable: true,
          groupKey: String(outcomeSample?.groupKey || '').trim(),
          outcomeId: String(outcomeSample?.outcomeId || '').trim(),
          probability: Number.isFinite(Number(outcomeSample?.probability))
            ? Number(outcomeSample.probability)
            : 1,
          roll: Number.isFinite(Number(outcomeSample?.roll))
            ? Number(outcomeSample.roll)
            : null,
          operation: 'SUMMON_CREATE',
          before: null,
          after: {
            summonKey: key,
            summonName: displayName,
            summonType,
            summonMode: mode,
            duration,
            windowId: window.windowId,
            remainingWindows: window.remainingWindows,
          },
        },
      }));
    }
    return { summons, facts: facts.filter(Boolean) };
  }

  function resolveStructuredTargetInterference(input = {}) {
    const {
      combatData,
      actor,
      declaration,
      actionKind,
      actionRole,
      eventKind,
      actionId,
    } = input;
    const declaredTargetIds = Array.isArray(declaration?.targetIds)
      ? declaration.targetIds
          .map(value => String(value || '').trim())
          .filter(Boolean)
      : [];
    if (
      eventKind !== 'action_start' ||
      actionRole !== 'ACTIVE' ||
      declaredTargetIds.length !== 1
    ) {
      return null;
    }
    const profile = actionKind === 'BASIC_ATTACK'
      ? 'HOSTILE_SINGLE'
      : decisionRuntime.targetProfile(declaration?.skill || {});
    if (profile !== 'HOSTILE_SINGLE') return null;
    const actionIdentity = [
      'FORMAL',
      decisionRuntime.declarationFingerprint({
        ...declaration,
        actionId: '',
        targetIds: [],
      }),
    ].join('\u0000');
    const currentTick = Number(combatData?.当前世界tick);
    if (!Number.isFinite(currentTick) || currentTick < 0) return null;
    const rate = Math.max(
      0,
      Math.min(
        1,
        Number(
          buildCombatFinalStats(actor, Math.floor(currentTick))
            ?.战斗效果?.random_target_rate || 0,
        ),
      ),
    );
    if (!(rate > 1e-12)) return null;
    const eligibleTargets = previewRuntime.listUnits(combatData)
      .map(entry => entry?.unit)
      .filter(target =>
        target &&
        previewRuntime.isBattleCapable(target)
      )
      .sort((left, right) =>
        previewRuntime.unitId(left).localeCompare(
          previewRuntime.unitId(right),
        )
      );
    const eligibleTargetIds = [
      ...new Set(
        eligibleTargets
          .map(previewRuntime.unitId)
          .filter(Boolean),
      ),
    ];
    const declaredTargetId = declaredTargetIds[0];
    if (
      eligibleTargetIds.length < 2 ||
      !eligibleTargetIds.includes(declaredTargetId)
    ) {
      return null;
    }
    const targetSetHash =
      previewRuntime.stableHash(eligibleTargetIds);
    const runtimeSeed = Math.max(
      1,
      Math.floor(
        Number(
          ensureCombatRuntime(combatData)?.decisionSeed || 1,
        ),
      ),
    );
    const stableRoll = suffix => {
      const hash = hashBattleValue([
        runtimeSeed,
        String(input?.opportunityId || '').trim(),
        actionId,
        targetSetHash,
        rate,
        suffix,
      ]);
      return Number.parseInt(
        hash.replace(/^r74-/, '').slice(0, 8),
        16,
      ) / 0x100000000;
    };
    const gateRoll = stableRoll('target-resolution-gate');
    const triggered =
      rate >= 1 - 1e-12 || gateRoll < rate;
    const targetRoll = stableRoll('target-resolution-index');
    const targetIndex = Math.min(
      eligibleTargetIds.length - 1,
      Math.floor(targetRoll * eligibleTargetIds.length),
    );
    const resolvedTargetId = triggered
      ? eligibleTargetIds[targetIndex]
      : declaredTargetId;
    const sourceStates = Object.entries(actor?.状态效果 || {})
      .filter(([, state]) => Number(state?.战斗效果?.random_target_rate || 0) > 1e-12)
      .map(([stateKey, state]) => {
        const applicationId = String(state?.__状态来源键 || '').trim();
        const sourceFactId = String(state?.sourceFactId || state?.来源事实ID || '').trim();
        const source = findStateSource(combatData, { applicationId, sourceFactId });
        const provenance = source || (sourceFactId ? { sourceFactId, provenanceClass: 'INITIAL_SNAPSHOT' } : null);
        const result = {
          stateKey,
          stateName: String(state?.状态 || state?.状态名称 || stateKey).trim(),
        };
        if (provenance?.provenanceClass) result.provenanceClass = String(provenance.provenanceClass).trim();
        if (provenance?.sourceActionId) result.sourceActionId = String(provenance.sourceActionId).trim();
        if (provenance?.sourceEventId) result.sourceEventId = String(provenance.sourceEventId).trim();
        if (provenance?.sourceFactId) result.sourceFactId = String(provenance.sourceFactId).trim();
        return result;
      });
    return {
      rate,
      declaredTargetId,
      resolvedTargetId,
      eligibleTargetIds,
      targetSetHash,
      actionIdentity,
      gateRoll,
      targetRoll,
      triggered,
      redirected:
        triggered && resolvedTargetId !== declaredTargetId,
      sourceStates,
    };
  }

  function beginStructuredDeclaration(input = {}) {
    const combatData = input?.combatData;
    let declaration = input?.declaration;
    if (!combatData || typeof combatData !== 'object') throw new TypeError('battle_structured_combat_data_missing');
    if (!declaration || typeof declaration !== 'object') throw new TypeError('battle_structured_declaration_missing');
    const actorId = String(declaration?.actorId || '').trim();
    const actor = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, actorId));
    if (!actor || !previewRuntime.isBattleCapable(actor)) throw new Error('battle_structured_actor_unavailable');
    declaration = resolveDeclaredSkill(declaration, actor);
    if (declaration?.skill && typeof declaration.skill === 'object') {
      declaration = { ...declaration, skill: applySkillEquipmentRequirements(actor, declaration.skill) };
    }
    const actionKind = String(declaration?.actionKind || '').trim();
    if (!actionKinds.includes(actionKind)) throw new Error(`battle_structured_action_kind_invalid:${actionKind || 'missing'}`);
    const actionRole = normalizeActionRole(input?.actionRole || 'ACTIVE');
    const actorControl = normalizeActorControl(input?.actorControl || 'AI');
    const combatRuntime = ensureCombatRuntime(combatData);
    if (actionRole !== 'STATE_TICK' && !combatRuntime.itemPassiveBattleStarted) {
      settlePassiveSkillConsumers(combatData, Number(combatData?.回合 || 0), { phases: ['战斗开始'] });
    }
    if (actionRole === 'ACTIVE' && !structuredActorCanAct(actor, actionRole)) {
      throw new Error('battle_structured_actor_controlled');
    }
    const actionName = normalizeActionDisplayName(
      declaration?.skill?.name || declaration?.skill?.魂技名 || declaration?.skill?.技能名称 || actionKind,
    );
    const explicitEffects = Array.isArray(declaration?.skill?._效果数组)
      ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object')
      : [];
    const primaryEffect = actionKind === 'BASIC_ATTACK'
      ? { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 攻击段数: 1 }
      : explicitEffects[0] || { 目标: declaration?.targetKind || '' };
    const actionId = String(input?.actionId || nextRuntimeId('battle-action')).trim();
    const chainNodeId = String(input?.chainNodeId || actionId).trim();
    const eventKind = String(input?.eventKind || 'action_start').trim();
    const stateTick = eventKind === 'state_tick';
    const declaredTargetIds = Array.isArray(declaration?.targetIds)
      ? declaration.targetIds
          .map(value => String(value || '').trim())
          .filter(Boolean)
      : [];
    const targetInterference =
      resolveStructuredTargetInterference({
        combatData,
        actor,
        declaration,
        actionKind,
        actionRole,
        eventKind,
        actionId,
        opportunityId: input?.opportunityId,
      });
    if (targetInterference) {
      declaration = {
        ...declaration,
        targetIds: [targetInterference.resolvedTargetId],
      };
    }
    const resolvedPrimaryTargets = resolveStructuredTargets(
      combatData,
      actor,
      declaration,
      primaryEffect,
    );
    const declaredPrimaryTarget = declaredTargetIds
      .map(targetId => listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetId)))
      .find(Boolean) || null;
    const primaryTarget = resolvedPrimaryTargets[0] || declaredPrimaryTarget || (
      declaredTargetIds.length || /融合伙伴/.test(String(primaryEffect?.目标 || '').trim()) ? null : actor
    );
    const targetResolutionEvent = targetInterference
      ? writeLedgerEvent(combatData, {
          eventKind: 'target_resolution',
          round: Number(combatData?.回合 || 0),
          actorId: previewRuntime.unitId(actor),
          actorName: previewRuntime.unitName(actor),
          targetId: targetInterference.resolvedTargetId,
          targetName: previewRuntime.unitName(primaryTarget),
          targetIds: [targetInterference.resolvedTargetId],
          declaredTargetId:
            targetInterference.declaredTargetId,
          resolvedTargetId:
            targetInterference.resolvedTargetId,
          targetSetHash: targetInterference.targetSetHash,
          actionName,
          actionType: actionKind,
          actorControl,
          actionRole,
          actionId,
          sourceActionId: actionId,
          opportunityId:
            String(input?.opportunityId || '').trim(),
          opportunitySequence: Math.max(
            0,
            Number(input?.opportunitySequence || 0),
          ),
          grantId: String(input?.grantId || '').trim(),
          chainNodeId,
          parentNodeId:
            String(input?.parentNodeId || '').trim(),
          sourceNodeId:
            String(input?.parentNodeId || '').trim(),
          reactionNodeId:
            String(input?.reactionNodeId || '').trim(),
          result: targetInterference.redirected
            ? 'redirected'
            : 'kept',
          resultState: 'COMPLETED',
          ruleCode: 'TARGET_INTERFERENCE_RESOLVED',
          factType: 'TARGET_RESOLUTION',
          effectPrototype: '决策干扰',
          operation: 'TARGET_RESOLVE',
          probability: targetInterference.rate,
          roll: targetInterference.gateRoll,
          meta: {
            source: 'structured_runtime',
            declaredTargetId:
              targetInterference.declaredTargetId,
            resolvedTargetId:
              targetInterference.resolvedTargetId,
            eligibleTargetIds:
              targetInterference.eligibleTargetIds,
            targetSetHash:
              targetInterference.targetSetHash,
            actionIdentity:
              targetInterference.actionIdentity,
            randomTargetRate: targetInterference.rate,
            gateRoll: targetInterference.gateRoll,
            targetRoll: targetInterference.targetRoll,
            triggered: targetInterference.triggered,
            redirected: targetInterference.redirected,
            sourceStates: targetInterference.sourceStates,
            before: targetInterference.declaredTargetId,
            after: targetInterference.resolvedTargetId,
          },
        })
      : null;
    const actionEvent = writeLedgerEvent(combatData, {
      eventKind,
      round: Number(combatData?.回合 || 0),
      actorName: previewRuntime.unitName(actor),
      targetName: previewRuntime.unitName(primaryTarget),
      targetIds: declaration?.targetIds || [],
      declaredTargetId:
        targetInterference?.declaredTargetId ||
        declaredTargetIds[0] ||
        '',
      resolvedTargetId:
        targetInterference?.resolvedTargetId ||
        previewRuntime.unitId(resolvedPrimaryTargets[0]),
      targetSetHash:
        targetInterference?.targetSetHash || '',
      resolutionEventId:
        String(targetResolutionEvent?.eventId || '').trim(),
      actionName,
      actionType: actionKind,
      actorControl,
      actionRole,
      actionId,
      chainNodeId,
      sourceActionId: String(input?.sourceActionId || '').trim(),
      opportunityId: String(input?.opportunityId || '').trim(),
      opportunitySequence: Math.max(0, Number(input?.opportunitySequence || 0)),
      grantId: String(input?.grantId || '').trim(),
      parentNodeId: String(input?.parentNodeId || '').trim(),
      sourceNodeId: String(input?.parentNodeId || '').trim(),
      reactionNodeId: String(input?.reactionNodeId || '').trim(),
      result: stateTick ? 'tick' : 'declared',
      resultState: stateTick ? 'COMPLETED' : 'DECLARED',
      ruleCode: stateTick ? 'STRUCTURED_SUSTAIN_TICK' : 'STRUCTURED_DECLARATION_COMMITTED',
      meta: {
        source: 'structured_runtime',
        targetScope: String(declaration?.targetKind || '').trim(),
        chainType: String(input?.chainType || '').trim(),
        opportunityId: String(input?.opportunityId || '').trim(),
        opportunitySequence: Math.max(0, Number(input?.opportunitySequence || 0)),
        grantId: String(input?.grantId || '').trim(),
        decisionCandidateId: String(input?.decisionCandidateId || '').trim(),
        creationRecipientId: String(declaration?.creationRecipientId || '').trim(),
        declaredTargetIds,
        resolvedTargetIds: resolvedPrimaryTargets
          .map(target => previewRuntime.unitId(target))
          .filter(Boolean),
        targetResolutionEventId:
          String(targetResolutionEvent?.eventId || '').trim(),
        ...(targetInterference
          ? {
              targetResolution: {
                randomTargetRate: targetInterference.rate,
                targetSetHash:
                  targetInterference.targetSetHash,
                actionIdentity:
                  targetInterference.actionIdentity,
                triggered: targetInterference.triggered,
                redirected: targetInterference.redirected,
              },
            }
          : {}),
        effectTargetAudit: structuredDeclarationEffectTargetAudit(combatData, actor, declaration),
        fusionKey: String(declaration?.fusionKey || '').trim(),
        fusionParticipantIds: Array.isArray(declaration?.fusionParticipantIds)
          ? declaration.fusionParticipantIds.map(value => String(value || '').trim()).filter(Boolean)
          : [],
        fusionPartnerIds: Array.isArray(declaration?.fusionPartnerIds)
          ? declaration.fusionPartnerIds.map(value => String(value || '').trim()).filter(Boolean)
          : [],
      },
    });
    return {
      combatData,
      declaration,
      actor,
      actionKind,
      actionRole,
      actorControl,
      actionName,
      primaryTarget,
      targetResolutionEvent,
      actionEvent,
      allowPreparedDefense: input?.allowPreparedDefense !== false,
      action: { actionKind, actionName, actorControl },
    };
  }

  function findStructuredInventoryEntry(actor = {}, declaration = {}) {
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
          found = {
            item: value,
            itemName: String(value?.__物品名 || value?.物品名 || value?.名称 || value?.name || value?.id || key).trim(),
          };
          return;
        }
      }
      if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${key}:${index}`));
      else Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    ['背包', '库存', '物品', '战斗物品'].forEach(key => visit(actor?.[key], key));
    return found;
  }

  function executeStructuredDeclaration(input = {}) {
    const context = input?.actionContext && typeof input.actionContext === 'object'
      ? input.actionContext
      : beginStructuredDeclaration(input);
    let {
      combatData,
      declaration,
      actor,
      actionKind,
      actionRole,
      actorControl,
      actionName,
      primaryTarget,
      actionEvent,
      allowPreparedDefense,
    } = context;
    if (!combatData || !declaration || !actor || !actionEvent) throw new TypeError('battle_structured_action_context_invalid');
    syncEquipmentPassiveRuntime(actor, Number(combatData?.当前世界tick || combatData?.当前tick || 0), { rebuildFinal: true });
    if (actionKind === 'RELEASE_SKILL' && actionRole !== 'STATE_TICK' && declaration.skill && typeof declaration.skill === 'object') {
      declaration = { ...declaration, skill: mergeEquipmentPassiveActionSkill(actor, declaration.skill) };
    }
    const action = { actionKind, actionName, actorControl };
    const facts = [
      context?.targetResolutionEvent,
      actionEvent,
    ].filter(Boolean);
    const declaredResourceCosts = Object.prototype.hasOwnProperty.call(declaration, 'resourceCosts')
      ? declaration.resourceCosts || {}
      : null;
    const skillCostStages = actionKind === 'RELEASE_SKILL'
      ? previewRuntime.readSkillCostStages(declaration.skill || {}, { 来源模块: 'BattleRuntime_Module', ...declaration })
      : Object.freeze({ 启动: Object.freeze({}), 维持: Object.freeze({}), 形式: 'absolute', 非法项: Object.freeze([]) });
    if (skillCostStages.非法项?.length) throw new Error(`battle_structured_cost_invalid:${skillCostStages.非法项.join('|')}`);
    const resourceCosts = previewRuntime.normalizeSkillCostMap(
      declaredResourceCosts === null ? skillCostStages.启动 : declaredResourceCosts,
      skillCostStages.形式 === 'percentage' ? 'percentage' : 'absolute',
    );
    if (resourceCosts.非法项.length) throw new Error(`battle_structured_cost_invalid:${resourceCosts.非法项.join('|')}`);
    declaration.resourceCosts = resourceCosts.values;
    const costPayers = Array.isArray(declaration?.fusionParticipantIds) && declaration.fusionParticipantIds.length
      ? declaration.fusionParticipantIds
          .map(participantId => listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, participantId)))
          .filter(Boolean)
      : [actor];
    const paymentPlan = previewRuntime.assessResourcePayment(
      [...new Map(costPayers.map(unit => [previewRuntime.unitId(unit), unit])).values()],
      resourceCosts.values,
    );
    if (!paymentPlan.valid) throw new Error(`battle_structured_cost_invalid:${paymentPlan.reason}`);
    if (!paymentPlan.ok) throw new Error(`battle_structured_resource_insufficient:${paymentPlan.reason}`);
    const runtimeInsufficient = paymentPlan.payments.find(payment =>
      persistentResourceValue(payment.payer, payment.key) + 1e-9 < payment.amount,
    );
    if (runtimeInsufficient) throw new Error(`battle_structured_resource_insufficient:${runtimeInsufficient.resource}:${runtimeInsufficient.payerId}`);
    paymentPlan.payments.forEach(payment => {
        const costPayer = payment.payer;
        const key = payment.key;
        const resource = payment.resource;
        const label = persistentResourceLabel(key);
        const before = persistentResourceValue(costPayer, key);
        const cost = payment.amount;
        if (before + 1e-9 < cost) throw new Error(`battle_structured_resource_insufficient:${resource}`);
        writeCombatResource(costPayer, key, before - cost);
        facts.push(writeStructuredResourceFact(
          combatData,
          costPayer,
          costPayer,
          action,
          actionEvent,
          key,
          -cost,
          actionRole,
          'PAY',
        ));
        facts.push(writeLedgerEvent(combatData, {
          eventKind: 'action_cost',
          round: Number(combatData?.回合 || 0),
          actorName: previewRuntime.unitName(costPayer),
          targetName: previewRuntime.unitName(costPayer),
          actionName,
          actionType: actionKind,
          actorControl,
          actionRole,
          actionId: actionEvent.actionId,
          sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '',
          result: 'paid',
          resultState: 'SUCCESS',
          primaryOutcome: 'resource_cost',
          meta: {
            source: 'structured_runtime',
            resourceKey: key,
            resource,
            amount: cost,
            reqSp: key === 'sp' ? cost : 0,
            fusionKey: String(declaration?.fusionKey || '').trim(),
            auditOnly: true,
          },
        }));
        if (!label) void label;
    });
    if (['PASS_OPPORTUNITY', 'DEFEND', 'EVADE', 'OBSERVE', 'WITHDRAW', 'GUARD'].includes(actionKind)) {
      const eventKind = actionKind === 'DEFEND' || actionKind === 'GUARD' ? 'defend' : actionKind === 'EVADE' ? 'dodge' : 'pass';
      const preparedDefense = allowPreparedDefense !== false &&
        actionRole === 'ACTIVE' &&
        ['DEFEND', 'EVADE'].includes(actionKind);
      if (preparedDefense) {
        actor.__battleRuntime = actor.__battleRuntime && typeof actor.__battleRuntime === 'object' ? actor.__battleRuntime : {};
        actor.__battleRuntime.activeDefenseStance = {
          actionKind,
          establishedRound: Number(combatData?.回合 || 0),
          sourceActionId: actionEvent.actionId,
          sourceNodeId: actionEvent.chainNodeId || '',
          consumed: false,
        };
      }
      let result = 'complete';
      let primaryOutcome = actionKind === 'PASS_OPPORTUNITY'
        ? 'opportunity_passed'
        : actionKind === 'OBSERVE'
        ? 'information_gained'
        : 'stance_established';
      const meta = {
        source: 'structured_runtime',
        preparedDefense,
        voluntaryOpportunityPass: actionKind === 'PASS_OPPORTUNITY',
      };
      if (actionKind === 'WITHDRAW') {
        const actorSide = previewRuntime.sideOf(combatData, actor);
        const contest = previewRuntime.buildWithdrawalContest(
          combatData,
          actor,
        );
        const roll = Math.random();
        const successBoundary = Number(contest.successProbability || 0);
        const partialBoundary =
          successBoundary +
          Number(contest.partialProbability || 0);
        const outcome =
          roll < successBoundary
            ? 'SUCCESS'
            : roll < partialBoundary
              ? 'PARTIAL'
              : 'FAILURE';
        const result =
          outcome === 'SUCCESS'
            ? 'withdrawn'
            : outcome === 'PARTIAL'
              ? 'partial'
              : 'failed';
        const primaryOutcome =
          outcome === 'SUCCESS'
            ? 'withdrawal_success'
            : outcome === 'PARTIAL'
              ? 'withdrawal_partial'
              : 'withdrawal_failed';
        const pursuer = contest.pursuerId
          ? listCombatUnits(combatData).find(unit =>
              previewRuntime.unitId(unit) === contest.pursuerId
            )
          : null;
        const pursuitDamage =
          outcome === 'PARTIAL'
            ? Number(contest.partialPursuitDamage || 0)
            : outcome === 'FAILURE'
              ? Number(contest.failurePursuitDamage || 0)
              : 0;
        const beforeHp = previewRuntime.readHp(actor);
        const afterHp = writeCombatResource(
          actor,
          'hp',
          beforeHp - pursuitDamage,
        );
        const appliedDamage = Math.max(0, beforeHp - afterHp);
        const childEventIds = [];
        const withdrawalEvent = writeLedgerEvent(combatData, {
          eventKind,
          round: Number(combatData?.回合 || 0),
          actorId: previewRuntime.unitId(actor),
          actorName: previewRuntime.unitName(actor),
          targetId: previewRuntime.unitId(actor),
          targetName: previewRuntime.unitName(actor),
          targetIds: [previewRuntime.unitId(actor)],
          actionName,
          actionType: actionKind,
          actorControl,
          actionRole,
          actionId: actionEvent.actionId,
          sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '',
          sourceNodeId: actionEvent.chainNodeId || '',
          result,
          resultState:
            outcome === 'SUCCESS'
              ? 'SUCCESS'
              : outcome === 'PARTIAL'
                ? 'PARTIAL'
                : 'FAILED',
          actionStatus: 'COMPLETED',
          primaryOutcome,
          factType: 'WITHDRAWAL_CONTEST',
          operation: 'WITHDRAW_RESOLVE',
          groupKey: contest.probabilityGroupKey,
          meta: {
            ...meta,
            pursuerId: contest.pursuerId,
            visiblePursuerIds: contest.visiblePursuerIds,
            successProbability: contest.successProbability,
            partialProbability: contest.partialProbability,
            failureProbability: contest.failureProbability,
            partialPursuitDamage: contest.partialPursuitDamage,
            failurePursuitDamage: contest.failurePursuitDamage,
            expectedPursuitDamage: contest.expectedPursuitDamage,
            probabilityGroupKey: contest.probabilityGroupKey,
            outcomeDistribution: contest.outcomeDistribution,
            withdrawalOutcome: outcome,
            roll,
            successBoundary,
            partialBoundary,
            childEventIds,
          },
        });
        if (appliedDamage > 1e-9 && pursuer) {
          const pursuitEvent = writeLedgerEvent(combatData, {
            eventKind: 'hit_result',
            round: Number(combatData?.回合 || 0),
            actorId: previewRuntime.unitId(pursuer),
            actorName: previewRuntime.unitName(pursuer),
            targetId: previewRuntime.unitId(actor),
            targetName: previewRuntime.unitName(actor),
            targetIds: [previewRuntime.unitId(actor)],
            actionName: '撤离追击',
            sourceActionName: actionName,
            actionType: 'WITHDRAW_PURSUIT',
            actorControl: 'SYSTEM',
            actionRole: 'REACTION',
            actionId: actionEvent.actionId,
            sourceActionId: actionEvent.actionId,
            parentNodeId: actionEvent.chainNodeId || '',
            sourceNodeId: actionEvent.chainNodeId || '',
            result: 'hit',
            resultState: 'SUCCESS',
            actionStatus: 'COMPLETED',
            primaryOutcome: 'pursuit_damage',
            appliedDamage,
            factType: 'DAMAGE',
            effectPrototype: '撤离追击',
            sourceEffectId: `${actionEvent.actionId}:withdrawal-contest`,
            operation: 'DAMAGE',
            groupKey: contest.probabilityGroupKey,
            meta: {
              source: 'structured_runtime',
              withdrawalOutcome: outcome,
              probabilityGroupKey: contest.probabilityGroupKey,
              pursuerId: contest.pursuerId,
              before: beforeHp,
              after: afterHp,
              delta: -appliedDamage,
              damage: appliedDamage,
              appliedDamage,
              directHpDamage: true,
              sourceActionId: actionEvent.actionId,
            },
          });
          childEventIds.push(String(pursuitEvent?.eventId || '').trim());
          withdrawalEvent.meta.childEventIds = [...childEventIds];
          withdrawalEvent.childEventIds = [...childEventIds];
        } else {
          withdrawalEvent.meta.childEventIds = [];
          withdrawalEvent.childEventIds = [];
        }
        Object.assign(meta, {
          withdrawalOutcome: outcome,
          successProbability: contest.successProbability,
          partialProbability: contest.partialProbability,
          failureProbability: contest.failureProbability,
          partialPursuitDamage: contest.partialPursuitDamage,
          failurePursuitDamage: contest.failurePursuitDamage,
          expectedPursuitDamage: contest.expectedPursuitDamage,
          probabilityGroupKey: contest.probabilityGroupKey,
          roll,
        });
        if (outcome === 'SUCCESS') {
          const runtime = ensureCombatRuntime(combatData);
          runtime.withdrawalSuccess = true;
          runtime.withdrawalSuccessSides = Array.from(new Set([
            ...(Array.isArray(runtime.withdrawalSuccessSides) ? runtime.withdrawalSuccessSides : []),
            actorSide,
          ].filter(Boolean)));
        }
        facts.push(withdrawalEvent);
        if (childEventIds.length) {
          facts.push(
            ...ensureLedger(combatData).filter(event =>
              childEventIds.includes(String(event?.eventId || '').trim())
            ),
          );
        }
        return {
          actionEvent,
          facts: facts.filter(Boolean),
          actor,
          target: primaryTarget,
          terminal: 'SUCCESS',
        };
      }
      facts.push(writeLedgerEvent(combatData, {
        eventKind, round: Number(combatData?.回合 || 0), actorName: previewRuntime.unitName(actor), targetName: previewRuntime.unitName(primaryTarget),
        actionName, actionType: actionKind, actorControl, actionRole, actionId: actionEvent.actionId, sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '', result,
        resultState: result === 'failed' ? 'FAILED' : 'SUCCESS',
        primaryOutcome,
        meta,
      }));
      return { actionEvent, facts: facts.filter(Boolean), actor, target: primaryTarget, terminal: 'SUCCESS' };
    }
    const explicitEffects = Array.isArray(declaration?.skill?._效果数组)
      ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object')
      : [];
    const equipmentModifiers = declaration?.skill?.装备属性 && typeof declaration.skill.装备属性 === 'object'
      ? declaration.skill.装备属性
      : declaration?.skill?.属性加成 && typeof declaration.skill.属性加成 === 'object'
        ? declaration.skill.属性加成
        : {};
    const baseEffects = actionKind === 'BASIC_ATTACK'
      ? appendEquipmentPassiveActionEffects(actor, [
          { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 攻击段数: 1 },
          ...explicitEffects,
        ])
      : actionKind === 'EQUIP' && !explicitEffects.length
        ? Object.entries(equipmentModifiers).map(([attribute, value]) => ({
            原型: '属性修正',
            目标: '自身',
            生效方式: '独立生效',
            属性: attribute,
            数值: value,
            持续回合: 99,
          }))
        : explicitEffects;
    const equipmentPassiveEffectHashes = new Set(
      equipmentPassiveActionEffects(actor).map(effect => equipmentPassiveEffectKey(effect)),
    );
    const equipmentPassiveTriggerRows = [];
    const sustainEffectKeysBefore = new Set(Object.keys(actor?.持续效果 || {}));
    const grantedEffects = previewRuntime.pendingGrantedEffects(actor, actionKind);
    const effects = [
      ...grantedEffects.map(entry => ({ ...entry.effect, effectId: entry.effectId })),
      ...baseEffects,
    ];
    if (!effects.length && actionKind !== 'EQUIP') throw new Error('battle_structured_effects_missing');
    const itemConsumptionRule = typeof root.__LWCS_C2_CONSUMER_RULES_V1__?.读取正式物品消费规则_V1 === 'function'
      ? root.__LWCS_C2_CONSUMER_RULES_V1__.读取正式物品消费规则_V1(
        declaration?.skill?.使用效果 || declaration?.skill?._效果数组 || declaration?.skill || {},
      )
      : { consume: true };
    if (actionKind === 'USE_ITEM' && itemConsumptionRule.consume) {
      const inventory = findStructuredInventoryEntry(actor, declaration);
      const quantityBefore = Math.max(0, Number(inventory?.item?.数量 ?? inventory?.item?.quantity ?? 0));
      if (!inventory || quantityBefore < 1) {
        throw new Error(`battle_structured_item_unavailable:${String(declaration?.irreversibleAsset?.assetId || actionName || 'unknown_item').trim()}`);
      }
      const remainingQuantity = quantityBefore - 1;
      if (inventory.item.数量 !== undefined || inventory.item.quantity === undefined) inventory.item.数量 = remainingQuantity;
      if (inventory.item.quantity !== undefined) inventory.item.quantity = remainingQuantity;
      facts.push(writeLedgerEvent(combatData, {
        eventKind: 'item_consume',
        round: Number(combatData?.回合 || 0),
        actorName: previewRuntime.unitName(actor),
        targetName: previewRuntime.unitName(primaryTarget),
        targetId: previewRuntime.unitId(primaryTarget),
        actionName,
        actionType: actionKind,
        actorControl,
        actionRole,
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '',
        sourceNodeId: actionEvent.chainNodeId || '',
        result: 'consumed',
        resultState: 'SUCCESS',
        primaryOutcome: 'item_consumed',
        itemName: String(inventory.itemName || actionName).trim(),
        count: 1,
        quantity: 1,
        meta: {
          source: 'structured_runtime',
          itemName: String(inventory.itemName || actionName).trim(),
          assetId: String(declaration?.irreversibleAsset?.assetId || inventory.itemName || '').trim(),
          delta: -1,
          quantityBefore,
          remainingQuantity,
        },
      }));
    }
    const primaryResolutionByTarget = new Map();
    const primaryOutcomeByTarget = new Map();
    const primaryTerminatedByTarget = new Map();
    const outcomeSamples = new Map();
    const sampleEffectOutcome = ({
      effect = {},
      effectIndex = 0,
      targetId = '',
      operation = '',
    } = {}) => {
      const effectInstanceId = String(
        effect?.effectId ||
        effect?.效果ID ||
        `${actionEvent.actionId}:effect:${effectIndex}`
      ).trim();
      const groupKey = [
        actionEvent.actionId,
        effectInstanceId,
        `round:${Number(combatData?.回合 || 0)}:effect:${effectIndex}`,
        String(targetId || previewRuntime.unitId(actor)).trim(),
      ].join('|');
      const baseProbability = previewRuntime.normalizeEffectProbability(
        effect?.成功率 ?? effect?.触发概率,
        1,
      );
      const sampledTarget = listCombatUnits(combatData).find(unit =>
        previewRuntime.unitId(unit) === String(targetId || '').trim()
      );
      const probability = Math.max(0, Math.min(1,
        baseProbability * (typeof previewRuntime.stateApplicationProbabilityMultiplier === 'function'
          ? previewRuntime.stateApplicationProbabilityMultiplier(sampledTarget || {}, effect)
          : 1),
      ));
      if (!outcomeSamples.has(groupKey)) {
        const roll =
          probability <= 1e-12 || probability >= 1 - 1e-12
            ? null
            : Math.random();
        const succeeded =
          probability >= 1 - 1e-12 ||
          (
            probability > 1e-12 &&
            probabilitySucceeds(probability, roll)
          );
        outcomeSamples.set(groupKey, Object.freeze({
          groupKey,
          effectInstanceId,
          targetId: String(targetId || '').trim(),
          probability,
          roll,
          outcomeId: succeeded ? 'SUCCESS' : 'FAILURE',
          succeeded,
          operation: String(operation || '').trim().toUpperCase(),
        }));
      }
      const sample = outcomeSamples.get(groupKey);
      if (
        operation &&
        sample.operation &&
        sample.operation !== String(operation || '').trim().toUpperCase()
      ) {
        throw new Error(`BATTLE_OUTCOME_GROUP_OPERATION_CONFLICT:${groupKey}`);
      }
      return sample;
    };
    const writeShieldOutcomeFailure = ({
      target,
      effectIndex,
      sourceEffectId,
      effectPrototype,
      operation,
      shieldSample,
      before,
      stateName = '',
    } = {}) => {
      facts.push(writeLedgerEvent(combatData, {
        eventKind: operation === 'CREATE' ? 'shield_create' : 'shield_break',
        round: Number(combatData?.回合 || 0),
        actorId: previewRuntime.unitId(actor),
        actorName: previewRuntime.unitName(actor),
        targetId: previewRuntime.unitId(target),
        targetName: previewRuntime.unitName(target),
        actionName,
        actionType: actionKind,
        actorControl,
        actionRole,
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '',
        sourceNodeId: actionEvent.chainNodeId || '',
        reactionNodeId: String(input?.reactionByTarget?.[previewRuntime.unitId(target)]?.event?.chainNodeId || '').trim(),
        result: 'failed',
        resultState: 'FAILURE',
        primaryOutcome: 'SHIELD_EFFECT_OUTCOME_FAILED',
        ruleCode: 'SHIELD_EFFECT_OUTCOME_FAILED',
        effectPrototype,
        factType: 'SHIELD',
        sourceEffectId,
        groupKey: shieldSample.groupKey,
        outcomeId: shieldSample.outcomeId,
        probability: shieldSample.probability,
        roll: shieldSample.roll,
        operation,
        meta: {
          source: 'structured_runtime',
          effectIndex,
          effectInstanceId: sourceEffectId,
          groupKey: shieldSample.groupKey,
          outcomeId: shieldSample.outcomeId,
          probability: shieldSample.probability,
          roll: shieldSample.roll,
          before,
          after: before,
          delta: 0,
          amount: 0,
          shieldMutation: 'NONE',
          operation,
          reactionEventId: String(input?.reactionByTarget?.[previewRuntime.unitId(target)]?.event?.eventId || '').trim(),
          ...(stateName ? { stateName } : {}),
        },
      }));
    };
    const outcomePosition = (operation = '', effectIndex = 0) => {
      const normalizedEffectSequence = Number.parseInt(
        String(effectIndex ?? 0),
        10,
      );
      return {
      round: Math.max(0, Number(combatData?.回合 || 0)),
      opportunitySequence: Math.max(
        0,
        Number(input?.opportunitySequence || 0),
      ),
      actionSequence: Math.max(0, Number(actionEvent?.sequence || 0)),
      phasePriority: Math.max(
        0,
        Number(
          battleEventContract.phasePriority[
            String(operation || '').trim().toUpperCase()
          ] || 50
        ),
      ),
      effectSequence: Math.max(
        0,
        Number.isFinite(normalizedEffectSequence)
          ? normalizedEffectSequence
          : 0,
      ),
      eventId: '',
      };
    };
    let actionDamageMultiplier = 1;
    const executeResolvedEffect = (
      effect,
      sourceEffectIndex,
      conditionTargets,
      conditionalMeta = {},
    ) => {
      const planIndex = Math.max(0, Number(conditionalMeta?.planIndex || 0));
      const isPrimaryEffect = sourceEffectIndex === 0 && planIndex === 0;
      const effectIndex = conditionalMeta?.mode === 'ORIGINAL'
        ? sourceEffectIndex
        : `${sourceEffectIndex}:${String(conditionalMeta?.mode || '').toLowerCase()}:${
            Math.max(0, Number(conditionalMeta?.branchIndex || 0))
          }:${Math.max(0, Number(conditionalMeta?.nestedIndex || 0))}`;
      const prototype = String(effect?.原型 || '').trim();
      const sourceEffectId = String(
        effect?.effectId ||
        effect?.效果ID ||
        `${actionEvent.actionId}:effect:${effectIndex}`,
      ).trim();
      if (!conditionTargets.length) return;
      if (prototype !== '机制抹消' && previewRuntime.actorSuppressesEffect(actor, effect)) {
        facts.push(writeLedgerEvent(combatData, {
          eventKind: 'blocked_settlement',
          round: Number(combatData?.回合 || 0),
          actorId: previewRuntime.unitId(actor),
          actorName: previewRuntime.unitName(actor),
          targetId: previewRuntime.unitId(actor),
          targetName: previewRuntime.unitName(actor),
          actionName,
          actionType: actionKind,
          actorControl,
          actionRole,
          actionId: actionEvent.actionId,
          sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '',
          sourceNodeId: actionEvent.chainNodeId || '',
          result: 'suppressed',
          resultState: 'NO_EFFECT',
          primaryOutcome: 'mechanism_suppressed',
          effectPrototype: prototype,
          ruleCode: 'MECHANISM_SUPPRESSED',
          meta: { source: 'structured_runtime', effectIndex, prototype },
        }));
        return;
      }
      const isEquipmentPassiveTrigger = equipmentPassiveEffectHashes.has(equipmentPassiveEffectKey(effect));
      if (isEquipmentPassiveTrigger && !equipmentPassiveTriggerAllowed(actor, effect, combatData, actionEvent)) {
        facts.push(writeLedgerEvent(combatData, {
          eventKind: 'passive_trigger_blocked',
          round: Number(combatData?.回合 || 0),
          actorId: previewRuntime.unitId(actor),
          actorName: previewRuntime.unitName(actor),
          targetId: previewRuntime.unitId(actor),
          targetName: previewRuntime.unitName(actor),
          actionName,
          actionType: actionKind,
          actorControl,
          actionRole,
          actionId: actionEvent.actionId,
          sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '',
          sourceNodeId: actionEvent.chainNodeId || '',
          result: 'limited',
          resultState: 'NO_EFFECT',
          primaryOutcome: 'passive_trigger_limit',
          factType: 'PASSIVE_TRIGGER_LIMIT',
          effectPrototype: prototype,
          ruleCode: 'PASSIVE_TRIGGER_LIMIT',
          meta: {
            source: 'equipment_passive_consumer_v1',
            effectIndex,
            prototype,
            triggerLimit: effect?.触发限制,
          },
        }));
        return;
      }
      if (isEquipmentPassiveTrigger) {
        equipmentPassiveTriggerRows.push({
          effect,
          sourceEffectId,
          factStart: facts.length,
        });
      }
      if (!prototype && Array.isArray(effect?.使用效果)) {
        const createdName = String(
          declaration?.skill?.生成物?.名称 ||
          declaration?.skill?.生成物?.name ||
          declaration?.skill?.产物名称 ||
          declaration?.skill?.魂技名 ||
          declaration?.skill?.name ||
          actionName ||
          '未命名造物',
        ).trim();
        const quantity = Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
        const recipientId = String(
          declaration?.creationRecipientId ||
          previewRuntime.unitId(actor),
        ).trim();
        const recipient = listPrimaryCombatUnits(combatData).find(unit =>
          isUnitIdentityMatch(unit, recipientId)
        );
        if (
          !recipient ||
          previewRuntime.sideOf(combatData, recipient) !==
            previewRuntime.sideOf(combatData, actor) ||
          !previewRuntime.isPhysicallyAlive(recipient)
        ) {
          throw new Error(`battle_structured_creation_recipient_invalid:${recipientId || 'missing'}`);
        }
        if (!recipient.背包 || typeof recipient.背包 !== 'object' || Array.isArray(recipient.背包)) recipient.背包 = {};
        const existing = recipient.背包[createdName] && typeof recipient.背包[createdName] === 'object'
          ? recipient.背包[createdName]
          : {};
        recipient.背包[createdName] = {
          ...existing,
          id: String(existing.id || createdName).trim() || createdName,
          name: String(existing.name || createdName).trim() || createdName,
          名称: String(existing.名称 || createdName).trim() || createdName,
          物品名: String(existing.物品名 || createdName).trim() || createdName,
          类型: String(existing.类型 || effect?.物品类型 || '物品').trim() || '物品',
          数量: Math.max(0, Number(existing.数量 || 0)) + quantity,
          有效期tick: Math.max(Number(existing.有效期tick || 0), Math.max(0, Number(effect?.有效期tick || 0))),
          来源: String(existing.来源 || actionName || actionEvent.actionId || '').trim(),
          使用效果: cloneValue(effect.使用效果),
        };
        facts.push(writeLedgerEvent(combatData, {
          eventKind: 'create',
          round: Number(combatData?.回合 || 0),
          actorName: previewRuntime.unitName(actor),
          targetName: previewRuntime.unitName(recipient),
          targetId: previewRuntime.unitId(recipient),
          actionName,
          actionType: actionKind,
          actorControl,
          actionRole,
          actionId: actionEvent.actionId,
          sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '',
          sourceNodeId: actionEvent.chainNodeId || '',
          result: 'created',
          resultState: 'SUCCESS',
          primaryOutcome: 'item_created',
          createdName,
          createdType: String(effect?.物品类型 || '物品').trim() || '物品',
          count: quantity,
          quantity,
          meta: {
            source: 'structured_runtime',
            effectIndex,
            ownerId: previewRuntime.unitId(recipient),
            ownerName: previewRuntime.unitName(recipient),
            producerId: previewRuntime.unitId(actor),
            producerName: previewRuntime.unitName(actor),
            itemName: createdName,
            createdName,
            createdType: String(effect?.物品类型 || '物品').trim() || '物品',
            count: quantity,
            quantity,
            quantityAfter: recipient.背包[createdName].数量,
          },
        }));
        if (isPrimaryEffect) {
          primaryResolutionByTarget.set(previewRuntime.unitId(recipient), true);
          primaryOutcomeByTarget.set(previewRuntime.unitId(recipient), 'HIT');
        }
        return;
      }
      const targets = conditionTargets;
      const followsPrimary = !isPrimaryEffect &&
        String(effect?.生效方式 || '').trim() === '跟随主原型';
      const resolvedTargets = followsPrimary
        ? targets.filter(target => primaryResolutionByTarget.get(previewRuntime.unitId(target)) === true)
        : targets;
      if (followsPrimary && !resolvedTargets.length) return;
      if (previewCommittedPrototypes.has(prototype)) {
        const operationByPrototype = {
          资源转移: 'RESOURCE_REDUCE',
          资源锁定: 'RESOURCE_LOCK',
          状态移除: 'STATE_REMOVE',
          状态转移: 'STATE_REPLACE',
          状态交换: 'STATE_REPLACE',
          属性修正: 'STATE_APPLY',
          判定修正: 'STATE_APPLY',
          结算修正: 'STATE_APPLY',
          时窗修正: 'STATE_APPLY',
          规则防御: 'STATE_APPLY',
          规则改写: 'STATE_APPLY',
          机制抹消: 'STATE_APPLY',
          机制授予: 'OPPORTUNITY_GRANT',
          位移执行: 'STATE_APPLY',
          决策干扰: 'STATE_APPLY',
        };
        const operation = operationByPrototype[prototype] || 'STATE_APPLY';
        const hasOwnProbability =
          effect?.成功率 !== undefined ||
          effect?.触发概率 !== undefined;
        const previewCommitSamples = hasOwnProbability
          ? resolvedTargets.map(target => sampleEffectOutcome({
              effect,
              effectIndex,
              targetId: previewRuntime.unitId(target),
              operation,
            }))
          : [];
        const failedSamples = previewCommitSamples.filter(sample =>
          sample.succeeded !== true
        );
        failedSamples.forEach(sample => {
          const target = resolvedTargets.find(entry =>
            previewRuntime.unitId(entry) === sample.targetId
          );
          facts.push(writeLedgerEvent(combatData, {
            eventKind: 'effect_resolved',
            round: Number(combatData?.回合 || 0),
            actorId: previewRuntime.unitId(actor),
            actorName: previewRuntime.unitName(actor),
            targetId: sample.targetId,
            targetName: target ? previewRuntime.unitName(target) : '',
            actionName,
            actionType: actionKind,
            actorControl,
            actionRole,
            actionId: actionEvent.actionId,
            sourceActionId: actionEvent.actionId,
            parentNodeId: actionEvent.chainNodeId || '',
            sourceNodeId: actionEvent.chainNodeId || '',
            result: 'failed',
            resultState: 'FAILURE',
            primaryOutcome: 'effect_application_failed',
            effectPrototype: prototype,
            factType:
              prototypeRuntimeContract[prototype]?.factTypes?.[0] ||
              'EFFECT',
            groupKey: sample.groupKey,
            outcomeId: sample.outcomeId,
            probability: sample.probability,
            roll: sample.roll,
            operation,
            position: outcomePosition(operation, effectIndex),
            meta: {
              source: 'structured_runtime',
              effectIndex,
              groupKey: sample.groupKey,
              outcomeId: sample.outcomeId,
              probability: sample.probability,
              successRate: sample.probability,
              roll: sample.roll,
              operation,
              position: outcomePosition(operation, effectIndex),
            },
          }));
        });
        if (
          previewCommitSamples.length &&
          previewCommitSamples.every(sample => sample.succeeded !== true)
        ) {
          if (isPrimaryEffect) {
            resolvedTargets.forEach(target => {
              const targetId = previewRuntime.unitId(target);
              primaryResolutionByTarget.set(targetId, false);
              primaryOutcomeByTarget.set(targetId, 'MISS');
            });
          }
          return;
        }
        const committedFacts = commitStructuredPreviewPrototype(
          combatData,
          actor,
          { ...declaration, targetIds: resolvedTargets.map(previewRuntime.unitId) },
          effect,
          action,
          actionEvent,
          actionRole,
          effectIndex,
          previewCommitSamples,
        );
        facts.push(...committedFacts);
        if (prototype === '炸环') {
          actionDamageMultiplier *= Math.max(0, Number(effect?.强化倍率 || 1));
        }
        if (isPrimaryEffect) {
          resolvedTargets.forEach(target => {
            const targetId = previewRuntime.unitId(target);
            const targetFacts = committedFacts.filter(event =>
              String(event?.targetId || event?.targetName || '').trim() === targetId &&
              String(event?.resultState || '').trim()
            );
            const succeeded = targetFacts.some(event =>
              !['NO_EFFECT', 'FAILURE'].includes(String(event?.resultState || '').trim())
            );
            primaryResolutionByTarget.set(targetId, succeeded);
            primaryOutcomeByTarget.set(
              targetId,
              targetFacts.some(event =>
                /dodged|evaded/i.test(String(event?.primaryOutcome || event?.result || ''))
              )
                ? 'EVADED'
                : succeeded
                  ? 'HIT'
                  : targetFacts.some(event =>
                      /resist|immune/i.test(String(event?.primaryOutcome || event?.result || ''))
                    )
                    ? 'RESISTED'
                    : 'MISS',
            );
          });
        }
        return;
      }
      if (prototype === '召唤生成') {
        const summonSample = sampleEffectOutcome({
          effect,
          effectIndex,
          targetId: previewRuntime.unitId(actor),
          operation: 'SUMMON_CREATE',
        });
        if (!summonSample.succeeded) {
          const failedFact = writeLedgerEvent(combatData, {
            eventKind: 'summon_create',
            round: Number(combatData?.回合 || 0),
            actorId: previewRuntime.unitId(actor),
            actorName: previewRuntime.unitName(actor),
            targetId: '',
            targetName: '',
            actionName,
            actionType: actionKind,
            actorControl,
            actionRole,
            actionId: actionEvent.actionId,
            sourceActionId: actionEvent.actionId,
            parentNodeId: actionEvent.chainNodeId || '',
            sourceNodeId: actionEvent.chainNodeId || '',
            result: 'failed',
            resultState: 'FAILURE',
            primaryOutcome: 'summon_failed',
            effectPrototype: '召唤生成',
            factType: 'SUMMON',
            sourceEffectId,
            groupKey: summonSample.groupKey,
            outcomeId: summonSample.outcomeId,
            probability: summonSample.probability,
            roll: summonSample.roll,
            operation: 'SUMMON_CREATE',
            position: outcomePosition('SUMMON_CREATE', effectIndex),
            meta: {
              source: 'structured_runtime',
              effectIndex,
              groupKey: summonSample.groupKey,
              outcomeId: summonSample.outcomeId,
              probability: summonSample.probability,
              roll: summonSample.roll,
              operation: 'SUMMON_CREATE',
              position: outcomePosition('SUMMON_CREATE', effectIndex),
              before: null,
              after: null,
            },
          });
          if (failedFact) facts.push(failedFact);
          if (isPrimaryEffect) {
            resolvedTargets.forEach(target => {
              const targetId = previewRuntime.unitId(target);
              primaryResolutionByTarget.set(targetId, false);
              primaryOutcomeByTarget.set(targetId, 'MISS');
            });
          }
          return;
        }
        const summonFacts = commitStructuredSummon(
          combatData,
          actor,
          declaration,
          effect,
          action,
          actionEvent,
          actionRole,
          effectIndex,
          summonSample,
        ).facts;
        facts.push(...summonFacts);
        if (isPrimaryEffect) {
          resolvedTargets.forEach(target => {
            const targetId = previewRuntime.unitId(target);
            primaryResolutionByTarget.set(targetId, summonFacts.length > 0);
            primaryOutcomeByTarget.set(targetId, summonFacts.length > 0 ? 'HIT' : 'MISS');
          });
        }
        return;
      }
      if (!['伤害结算', '资源变化', '护盾变化', '状态施加'].includes(prototype)) {
        throw new Error([
          'battle_structured_prototype_unsupported',
          prototype || 'missing',
          previewRuntime.unitName(actor) || 'unknown_actor',
          actionName || 'unknown_action',
          `effect_${effectIndex}`,
        ].join(':'));
      }
      resolvedTargets.forEach(target => {
        const reaction = input?.reactionByTarget?.[previewRuntime.unitId(target)] || null;
        if (prototype === '伤害结算') {
          if (actionRole !== 'STATE_TICK') {
            settlePassiveSkillConsumers(combatData, Number(combatData?.回合 || 0), {
              phases: ['受击前'],
              triggeredUnitIds: [previewRuntime.unitId(target)],
              triggerEventId: actionEvent.actionId,
              declaration,
              triggerTarget: target,
              conditionTarget: actor,
              primaryTarget: target,
              conditionContext: {
                primaryTarget: target,
                conditionTarget: actor,
              },
            });
          }
          const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 || effect?.段数 || 1)) || 1);
          const reactionDamageMultiplier = Math.max(
            0,
            Math.min(1, Number(reaction?.damageMultiplier ?? 1)),
          );
          const actualSnapshotRevision = `runtime:${String(actionEvent?.actionId || '').trim()}`;
          const actualDamageBasis = previewRuntime.buildDamageBasis(
            declaration?.skill && typeof declaration.skill === 'object'
              ? { ...effect, 技能: declaration.skill }
              : effect,
            actor,
            target,
            null,
            {
              basisView: 'RUNTIME_ACTUAL',
              effectInstanceId: sourceEffectId,
              sourceEffectId,
              sourceActionId: actionEvent.actionId,
              snapshotRevision: actualSnapshotRevision,
              actionDamageMultiplier,
              reactionDamageMultiplier,
            },
          );
          previewRuntime.assertDamageBasis(actualDamageBasis, {
            basisView: 'RUNTIME_ACTUAL',
            actorId: previewRuntime.unitId(actor),
            targetId: previewRuntime.unitId(target),
            effectInstanceId: sourceEffectId,
            sourceEffectId,
            sourceActionId: actionEvent.actionId,
            snapshotRevision: actualSnapshotRevision,
          });
          const actualDamageBasisMetadata = previewRuntime.damageBasisMetadata(
            actualDamageBasis,
            { includeFormulaTrace: true },
          );
          const actualDamageBasisReference = Object.freeze({
            schemaVersion: actualDamageBasis.schemaVersion,
            basisView: actualDamageBasis.basisView,
            formulaVersion: actualDamageBasis.formulaVersion,
            basisHash: actualDamageBasis.basisHash,
            identity: actualDamageBasisMetadata.identity,
            publicOperands: actualDamageBasisMetadata.publicOperands,
          });
          const totalDamage = Math.max(
            0,
            Number(actualDamageBasis.operands.rawDamage || 0),
          );
          const segmentDamage = totalDamage / segments;
          const hitProbability = Math.max(0, Math.min(1, previewRuntime.estimateHitProbability(actor, target, effect)));
          let anySegmentHit = false;
          for (let segment = 0; segment < segments; segment += 1) {
            const damageBasisForFact = segment === 0
              ? actualDamageBasisMetadata
              : actualDamageBasisReference;
            if (reaction?.evaded === true) {
              facts.push(writeLedgerEvent(combatData, {
                eventKind: 'hit_result', round: Number(combatData?.回合 || 0),
                actorId: previewRuntime.unitId(actor), actorName: previewRuntime.unitName(actor),
                targetId: previewRuntime.unitId(target), targetName: previewRuntime.unitName(target),
                actionName, actionType: actionKind, actorControl, actionRole, actionId: actionEvent.actionId, sourceActionId: actionEvent.actionId,
                parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '', reactionNodeId: String(reaction?.event?.chainNodeId || '').trim(),
                result: 'miss', resultState: 'FAILURE', primaryOutcome: 'dodged', effectPrototype: prototype,
                factType: 'DAMAGE', sourceEffectId, operation: 'DAMAGE',
                meta: {
                  source: 'structured_runtime',
                  effectIndex,
                  segment: segment + 1,
                  segments,
                  hitProbability,
                  roll: null,
                  appliedDamage: 0,
                  basisHash: actualDamageBasis.basisHash,
                  damageBasis: damageBasisForFact,
                  reactionEventId: String(reaction?.event?.eventId || '').trim(),
                  dodgeRate: reaction?.event?.meta?.dodgeRate,
                  dodgeRoll: reaction?.event?.meta?.dodgeRoll,
                  reactionPressure: reaction?.event?.meta?.reactionPressure,
                  attackPressure: reaction?.event?.meta?.attackPressure,
                  reactionShare: reaction?.event?.meta?.reactionShare,
                  reactionAgility: reaction?.event?.meta?.reactionAgility,
                  sourceAgility: reaction?.event?.meta?.sourceAgility,
                  reactionPressureBreakdown: reaction?.event?.meta?.reactionPressureBreakdown,
                  attackPressureBreakdown: reaction?.event?.meta?.attackPressureBreakdown,
                  reactionAgilityBreakdown: reaction?.event?.meta?.reactionAgilityBreakdown,
                  sourceAgilityBreakdown: reaction?.event?.meta?.sourceAgilityBreakdown,
                  before: previewRuntime.readHp(target),
                  after: previewRuntime.readHp(target),
                  operation: 'DAMAGE',
                },
              }));
              continue;
            }
            const roll = Math.random();
            if (!probabilitySucceeds(hitProbability, roll)) {
              facts.push(writeLedgerEvent(combatData, {
                eventKind: 'hit_result', round: Number(combatData?.回合 || 0),
                actorId: previewRuntime.unitId(actor), actorName: previewRuntime.unitName(actor),
                targetId: previewRuntime.unitId(target), targetName: previewRuntime.unitName(target),
                actionName, actionType: actionKind, actorControl, actionRole, actionId: actionEvent.actionId, sourceActionId: actionEvent.actionId,
                parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '',
                reactionNodeId: String(reaction?.event?.chainNodeId || '').trim(),
                result: 'miss', resultState: 'FAILURE', primaryOutcome: 'attack_missed', effectPrototype: prototype,
                factType: 'DAMAGE', sourceEffectId, operation: 'DAMAGE',
                meta: {
                  source: 'structured_runtime',
                  effectIndex,
                  segment: segment + 1,
                  segments,
                  hitProbability,
                  roll,
                  appliedDamage: 0,
                  basisHash: actualDamageBasis.basisHash,
                  damageBasis: damageBasisForFact,
                  reactionEventId: String(reaction?.event?.eventId || '').trim(),
                  before: previewRuntime.readHp(target),
                  after: previewRuntime.readHp(target),
                  operation: 'DAMAGE',
                },
              }));
              continue;
            }
            const before = previewRuntime.readHp(target);
            const blockedByRule = consumeRuleDefenseBlock({
              combatData,
              actor,
              target,
              action,
              actionEvent,
              actionRole,
            });
            if (blockedByRule) {
              facts.push(blockedByRule);
              anySegmentHit = true;
              continue;
            }
            facts.push(...consumeEquivalentLevelProtectionCheck({
              combatData,
              actor,
              target,
              effect,
              action,
              actionEvent,
              actionRole,
            }));
            const nonlethal = /点到为止|切磋|训练|非致命/.test(String(combatData?.战斗意图 || '').trim());
            const shieldBefore = currentShieldTotal(target, effect, actor);
            const nonlethalHpFloor = nonlethal
              ? previewRuntime.calculateNonlethalHpFloor(combatData, target, {
                  mode: String(combatData?.战斗意图 || '').trim(),
                  objectives: combatData?.胜负条件 || {},
                })
              : 0;
            const hpDamageLimit = nonlethal ? Math.max(0, before - nonlethalHpFloor) : before;
            const incomingDamage = Math.max(0, Math.min(
              shieldBefore + hpDamageLimit,
              previewRuntime.calculateSettledSegmentDamage(totalDamage, segments, reactionDamageMultiplier),
            ));
            const shieldResult = absorbRuntimeShield(target, incomingDamage, effect, actor);
            const damage = Math.max(0, Math.min(hpDamageLimit, shieldResult.remainingDamage));
            if (incomingDamage > 0) anySegmentHit = true;
            if (shieldResult.absorbed > 0) {
              const shieldEvent = writeStructuredResourceFact(
                combatData,
                actor,
                target,
                action,
                actionEvent,
                'shield',
                -shieldResult.absorbed,
                actionRole,
                'REDUCE',
                {
                  before: shieldBefore,
                  after: currentShieldTotal(target, effect, actor),
                  sourceEffectId,
                  effectPrototype: prototype,
                  factType: 'SHIELD',
                },
              );
              if (shieldEvent) {
                shieldEvent.primaryOutcome = currentShieldTotal(target, effect, actor) > 0 ? 'shield_absorbed' : 'shield_depleted';
                shieldEvent.meta.remainingShield = currentShieldTotal(target, effect, actor);
                if (effect?.对应等级 !== undefined) {
                  shieldEvent.meta.对应等级 = Math.max(0, Number(effect.对应等级 || 0));
                  shieldEvent.meta.equivalentLevel = shieldEvent.meta.对应等级;
                }
                shieldEvent.meta.depletedStates = [...shieldResult.depletedStates];
                facts.push(shieldEvent);
              }
            }
            writeCombatResource(target, 'hp', before - damage);
            const hpAfter = previewRuntime.readHp(target);
            const traumaUnconscious = previewRuntime.shouldTriggerTraumaUnconscious(damage, hpAfter, previewRuntime.readHpMax(target));
            const nonlethalIncapacitated = nonlethal && nonlethalHpFloor <= 1 && before > 1 && damage >= before - 1 - 1e-9;
            const damageEvent = writeLedgerEvent(combatData, {
              eventKind: 'hit_result', round: Number(combatData?.回合 || 0),
              actorId: previewRuntime.unitId(actor), actorName: previewRuntime.unitName(actor),
              targetId: previewRuntime.unitId(target), targetName: previewRuntime.unitName(target),
              actionName, actionType: actionKind, actorControl, actionRole, actionId: actionEvent.actionId, sourceActionId: actionEvent.actionId,
              parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '', result: incomingDamage > 0 ? 'hit' : 'no_effect',
              resultState: incomingDamage > 0 ? 'SUCCESS' : 'NO_EFFECT',
              primaryOutcome: damage > 0 ? 'full_hit' : shieldResult.absorbed > 0 ? 'shield_absorbed' : 'no_effect',
              effectPrototype: prototype, factType: 'DAMAGE', sourceEffectId, operation: 'DAMAGE',
              reactionNodeId: String(reaction?.event?.chainNodeId || '').trim(),
              meta: {
                source: 'structured_runtime', effectIndex, segment: segment + 1, segments, hitProbability, roll,
                rawDamage: segmentDamage,
                rawDamageTotal: totalDamage,
                incomingDamage,
                defenseMultiplier: reactionDamageMultiplier,
                shieldAbsorb: shieldResult.absorbed,
                appliedDamage: damage,
                damageType: effect?.伤害类型 || '',
                basisHash: actualDamageBasis.basisHash,
                damageBasis: damageBasisForFact,
                formulaTrace: actualDamageBasis.formulaTrace,
                intentLethalPrevented: nonlethal && damage < previewRuntime.calculateSettledSegmentDamage(
                  totalDamage,
                  segments,
                  reactionDamageMultiplier,
                ),
                reactionEventId: String(reaction?.event?.eventId || '').trim(),
                before,
                after: hpAfter,
                delta: -damage,
                operation: 'DAMAGE',
              },
            });
            facts.push(damageEvent);
            facts.push(...settleCounterDamage({
              combatData,
              actor,
              target,
              action,
              actionEvent,
              damageEvent,
              actionRole,
              actualDamage: damage,
            }));
            facts.push(...settleDamageAbsorption({
              combatData,
              actor,
              target,
              declaration,
              action,
              actionEvent,
              damageEvent,
              actionRole,
            }));
            if (traumaUnconscious || nonlethalIncapacitated) {
              const actionState = traumaUnconscious ? '昏迷' : '失去战斗力';
              const hpMax = previewRuntime.readHpMax(target);
              const beforeActionState = cloneValue(target?.状态 || {});
              target.__战斗失能原因 = traumaUnconscious ? 'UNCONSCIOUS' : 'INCAPACITATED';
              facts.push(writeLedgerEvent(combatData, {
                eventKind: 'state_apply', round: Number(combatData?.回合 || 0),
                actorId: previewRuntime.unitId(actor), actorName: previewRuntime.unitName(actor),
                targetId: previewRuntime.unitId(target), targetName: previewRuntime.unitName(target),
                actionName, actionType: 'incapacitation', actorControl, actionRole, actionId: actionEvent.actionId,
                sourceActionId: actionEvent.actionId, parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '',
                ruleCode: traumaUnconscious ? 'TRAUMA_UNCONSCIOUS' : 'NONLETHAL_INTENT_DISABLE',
                result: 'applied', resultState: 'SUCCESS', primaryOutcome: traumaUnconscious ? 'trauma_unconscious' : 'nonlethal_incapacitation',
                effectPrototype: prototype, factType: 'STATE', sourceEffectId, operation: 'STATE_APPLY',
                meta: {
                  source: 'structured_runtime',
                  stateName: actionState,
                  hpAfter,
                  hpRatioAfter: hpAfter / Math.max(1, hpMax),
                  triggerDamage: damage,
                  singleHitRatio: damage / Math.max(1, hpMax),
                  nonlethalHpFloor,
                  nonlethalIncapacitated,
                  traumaUnconscious,
                  before: beforeActionState,
                  after: cloneValue(target.状态),
                  operation: 'STATE_APPLY',
                },
              }));
            }
          }
          if (isPrimaryEffect) {
            const targetId = previewRuntime.unitId(target);
            const terminated = anySegmentHit && previewRuntime.readHp(target) <= 0;
            primaryResolutionByTarget.set(targetId, anySegmentHit);
            primaryTerminatedByTarget.set(targetId, terminated);
            primaryOutcomeByTarget.set(
              targetId,
              reaction?.evaded === true ? 'EVADED' : terminated ? 'TERMINATED' : anySegmentHit ? 'HIT' : 'MISS',
            );
          }
          return;
        }
        if (prototype === '资源变化') {
          const resourceText = Array.isArray(effect?.资源)
            ? effect.资源.map(value => String(value || '').trim()).filter(Boolean).join('、')
            : String(effect?.资源 || '魂力').trim();
          const resourceKeys = persistentResourceKeys(effect?.资源 || '魂力');
          let primaryResolved = false;
          resourceKeys.forEach(key => {
            const before = persistentResourceValue(target, key);
            let delta = previewRuntime.sampleSignedValue(
              effect?.数值,
              persistentResourceMax(target, key),
              Math.random,
            );
            if (delta > 0 && typeof previewRuntime.healingMultiplierForUnit === 'function') {
              const resourceLabel = persistentResourceLabel(key);
              delta *= Math.max(0, Number(previewRuntime.healingMultiplierForUnit(target, resourceLabel) || 1));
            }
            // 一个效果的多资源维度共享同一 outcomeSamples 记录，保持相关概率不被拆散。
            const operation = delta >= 0 ? 'RESTORE' : 'REDUCE';
            const resourceSample = sampleEffectOutcome({
              effect,
              effectIndex,
              targetId: previewRuntime.unitId(target),
              operation,
            });
            if (resourceSample.succeeded) writeCombatResource(target, key, before + delta);
            const actual = persistentResourceValue(target, key) - before;
            const resourceFact = writeStructuredResourceFact(
              combatData,
              actor,
              target,
              action,
              actionEvent,
              key,
              actual,
              actionRole,
              actual > 0 ? 'RESTORE' : 'REDUCE',
              {
                before,
                after: before + actual,
                sourceEffectId,
                effectPrototype: prototype,
                factType: 'RESOURCE',
              },
            ) || (
              !resourceSample.succeeded
                ? writeLedgerEvent(combatData, {
                    eventKind: 'resource_change',
                    round: Number(combatData?.回合 || 0),
                    actorId: previewRuntime.unitId(actor),
                    actorName: previewRuntime.unitName(actor),
                    targetId: previewRuntime.unitId(target),
                    targetName: previewRuntime.unitName(target),
                    actionName,
                    actionType: actionKind,
                    actorControl,
                    actionRole,
                    actionId: actionEvent.actionId,
                    sourceActionId: actionEvent.actionId,
                    parentNodeId: actionEvent.chainNodeId || '',
                    sourceNodeId: actionEvent.chainNodeId || '',
                    result: 'failed',
                    resultState: 'FAILURE',
                    primaryOutcome: 'resource_effect_failed',
                    effectPrototype: prototype,
                    factType: 'RESOURCE',
                    sourceEffectId,
                    operation,
                    meta: {
                      source: 'structured_runtime',
                      resource: persistentResourceLabel(key),
                      resourceKey: key,
                      delta: 0,
                      amount: 0,
                      operation,
                      before,
                      after: before,
                      requestedDelta: delta,
                    },
                  })
                : null
            );
            if (resourceFact) {
              resourceFact.groupKey = resourceSample.groupKey;
              resourceFact.outcomeId = resourceSample.outcomeId;
              resourceFact.probability = resourceSample.probability;
              resourceFact.roll = resourceSample.roll;
              resourceFact.operation = operation;
              resourceFact.position = outcomePosition(operation, effectIndex);
              resourceFact.result = resourceSample.succeeded
                ? resourceFact.result
                : 'failed';
              resourceFact.resultState = resourceSample.succeeded
                ? resourceFact.resultState
                : 'FAILURE';
              resourceFact.primaryOutcome = resourceSample.succeeded
                ? resourceFact.primaryOutcome
                : 'resource_effect_failed';
              resourceFact.meta = {
                ...(resourceFact.meta || {}),
                resourceKey: key,
                resource: persistentResourceLabel(key),
                groupKey: resourceSample.groupKey,
                outcomeId: resourceSample.outcomeId,
                probability: resourceSample.probability,
                successRate: resourceSample.probability,
                roll: resourceSample.roll,
                operation,
                position: outcomePosition(operation, effectIndex),
                requestedDelta: delta,
                delta: actual,
              };
              facts.push(resourceFact);
            }
            primaryResolved = primaryResolved || (resourceSample.succeeded && Math.abs(actual) > 1e-9);
          });
          if (isPrimaryEffect) {
            const targetId = previewRuntime.unitId(target);
            primaryResolutionByTarget.set(targetId, primaryResolved);
            primaryOutcomeByTarget.set(targetId, primaryResolved ? 'HIT' : 'MISS');
          }
          return;
        }
        if (prototype === '护盾变化') {
          const before = currentShieldTotal(target);
          const requested = previewRuntime.sampleSignedValue(
            effect?.数值,
            previewRuntime.readHpMax(target),
            Math.random,
          );
          const shieldOperation = requested >= 0 ? 'CREATE' : 'REDUCE';
          const shieldSample = sampleEffectOutcome({
            effect,
            effectIndex,
            targetId: previewRuntime.unitId(target),
            operation: shieldOperation,
          });
          if (!shieldSample.succeeded) {
            writeShieldOutcomeFailure({
              target,
              effectIndex,
              sourceEffectId,
              effectPrototype: prototype,
              operation: shieldOperation,
              shieldSample,
              before,
            });
            if (isPrimaryEffect) {
              const targetId = previewRuntime.unitId(target);
              primaryResolutionByTarget.set(targetId, false);
              primaryOutcomeByTarget.set(targetId, 'MISS');
            }
            return;
          }
          if (requested >= 0) applyRuntimeShield(target, requested, Math.max(1, Number(effect?.持续回合 || 1)), actionName, effect);
          else removeRuntimeShield(target, effect?.数值 || requested);
          const after = currentShieldTotal(target);
          const actual = after - before;
          const shieldFact = writeStructuredResourceFact(
            combatData,
            actor,
            target,
            action,
            actionEvent,
            'shield',
            actual,
            actionRole,
            actual > 0 ? 'CREATE' : 'REDUCE',
            {
              before,
              after,
              sourceEffectId,
              effectPrototype: prototype,
              factType: 'SHIELD',
              meta: {
                effectIndex,
                effectInstanceId: sourceEffectId,
                groupKey: shieldSample.groupKey,
                outcomeId: shieldSample.outcomeId,
                probability: shieldSample.probability,
                roll: shieldSample.roll,
                operation: shieldOperation,
                position: outcomePosition(shieldOperation, effectIndex),
              },
            },
          );
          if (shieldFact) {
            shieldFact.groupKey = shieldSample.groupKey;
            shieldFact.outcomeId = shieldSample.outcomeId;
            shieldFact.probability = shieldSample.probability;
            shieldFact.roll = shieldSample.roll;
            shieldFact.operation = shieldOperation;
            shieldFact.position = outcomePosition(shieldOperation, effectIndex);
            if (effect?.对应等级 !== undefined) {
              shieldFact.meta.对应等级 = Math.max(0, Number(effect.对应等级 || 0));
              shieldFact.meta.equivalentLevel = shieldFact.meta.对应等级;
            }
            facts.push(shieldFact);
          }
          // N-06：窃盾的 actor 侧收益此前只存在于预演——运行时按实际移除量
          // 给施放者生成同额护盾并写 shield_create 事实，两侧记账对齐。
          if (
            String(effect?.护盾模式 || '').trim() === '窃盾' &&
            previewRuntime.unitId(target) !== previewRuntime.unitId(actor) &&
            actual < -1e-9
          ) {
            const actorBefore = currentShieldTotal(actor);
            applyRuntimeShield(actor, -actual, Math.max(1, Number(effect?.持续回合 || 1)), actionName, effect);
            const actorAfter = currentShieldTotal(actor);
            const stolenApplied = actorAfter - actorBefore;
            if (Math.abs(stolenApplied) > 1e-9) {
              facts.push(writeStructuredResourceFact(
                combatData,
                actor,
                actor,
                action,
                actionEvent,
                'shield',
                stolenApplied,
                actionRole,
                'CREATE',
                {
                  before: actorBefore,
                  after: actorAfter,
                  sourceEffectId,
                  effectPrototype: prototype,
                  factType: 'SHIELD',
                },
              ));
            }
          }
          if (isPrimaryEffect) {
            const targetId = previewRuntime.unitId(target);
            primaryResolutionByTarget.set(targetId, Math.abs(actual) > 1e-9);
            primaryOutcomeByTarget.set(targetId, Math.abs(actual) > 1e-9 ? 'HIT' : 'MISS');
          }
          return;
        }
        const stateName = String(effect?.状态 || '').trim();
        if (/护盾|屏障|结界/.test(stateName)) {
          const beforeShield = currentShieldTotal(target);
          const shieldSample = sampleEffectOutcome({
            effect,
            effectIndex,
            targetId: previewRuntime.unitId(target),
            operation: 'CREATE',
          });
          if (!shieldSample.succeeded) {
            writeShieldOutcomeFailure({
              target,
              effectIndex,
              sourceEffectId,
              effectPrototype: prototype,
              operation: 'CREATE',
              shieldSample,
              before: beforeShield,
              stateName,
            });
            if (isPrimaryEffect) {
              const targetId = previewRuntime.unitId(target);
              primaryResolutionByTarget.set(targetId, false);
              primaryOutcomeByTarget.set(targetId, 'MISS');
            }
            return;
          }
          const shieldAmount = Math.max(
            0,
            previewRuntime.sampleSignedValue(
              effect?.数值,
              previewRuntime.readHpMax(target),
              Math.random,
            ),
          );
          if (shieldAmount > 0) {
            applyRuntimeShield(target, shieldAmount, Math.max(1, Number(effect?.持续回合 || 1)), stateName, effect);
            const afterShield = currentShieldTotal(target);
            const actualShield = afterShield - beforeShield;
            const shieldFact = writeStructuredResourceFact(
              combatData,
              actor,
              target,
              action,
              actionEvent,
              'shield',
              actualShield,
              actionRole,
              'CREATE',
              {
                before: beforeShield,
                after: afterShield,
                sourceEffectId,
                effectPrototype: prototype,
                factType: 'SHIELD',
                meta: {
                  effectIndex,
                  effectInstanceId: sourceEffectId,
                  stateName,
                  groupKey: shieldSample.groupKey,
                  outcomeId: shieldSample.outcomeId,
                  probability: shieldSample.probability,
                  roll: shieldSample.roll,
                  operation: 'CREATE',
                  duration: Math.max(1, Number(effect?.持续回合 || 1)),
                },
              },
            );
            if (shieldFact) {
              shieldFact.groupKey = shieldSample.groupKey;
              shieldFact.outcomeId = shieldSample.outcomeId;
              shieldFact.probability = shieldSample.probability;
              shieldFact.roll = shieldSample.roll;
              shieldFact.operation = 'CREATE';
              shieldFact.position = outcomePosition('CREATE', effectIndex);
              if (effect?.对应等级 !== undefined) {
                shieldFact.meta.对应等级 = Math.max(0, Number(effect.对应等级 || 0));
                shieldFact.meta.equivalentLevel = shieldFact.meta.对应等级;
              }
              facts.push(shieldFact);
            }
          }
          if (isPrimaryEffect) {
            const targetId = previewRuntime.unitId(target);
            primaryResolutionByTarget.set(targetId, shieldAmount > 0);
            primaryOutcomeByTarget.set(targetId, shieldAmount > 0 ? 'HIT' : 'MISS');
          }
          return;
        }
        const stateBefore = target?.状态效果?.[stateName]
          ? cloneValue(target.状态效果[stateName])
          : null;
        if (!previewRuntime.isAlive(target) && previewRuntime.unitId(target) !== previewRuntime.unitId(actor)) {
          facts.push(writeLedgerEvent(combatData, {
            eventKind: 'state_apply', round: Number(combatData?.回合 || 0), actorName: previewRuntime.unitName(actor), targetName: previewRuntime.unitName(target),
            actionName, actionType: actionKind, actorControl, actionRole, actionId: actionEvent.actionId, sourceActionId: actionEvent.actionId,
            parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '',
            result: 'no_effect', resultState: 'NO_EFFECT', primaryOutcome: 'target_incapacitated',
            duration: Math.max(1, Number(effect?.持续回合 || 1)),
            effectPrototype: prototype, factType: 'STATE', sourceEffectId, operation: 'STATE_APPLY',
            meta: {
              source: 'structured_runtime',
              effectIndex,
              stateName,
              duration: Math.max(1, Number(effect?.持续回合 || 1)),
              successRate: 0,
              roll: null,
              reason: 'TARGET_INCAPACITATED',
              before: stateBefore,
              after: stateBefore,
              operation: 'STATE_APPLY',
            },
          }));
          if (isPrimaryEffect) {
            const targetId = previewRuntime.unitId(target);
            primaryResolutionByTarget.set(targetId, false);
            primaryOutcomeByTarget.set(targetId, 'EVADED');
          }
          return;
        }
        if (!target.状态效果 || typeof target.状态效果 !== 'object') target.状态效果 = {};
        const duration = Math.max(1, Number(effect?.持续回合 || 1));
        const state = {
          类型: String(effect?.类型 || '').trim() || (inferUnitSide(combatData, previewRuntime.unitName(target)) === inferUnitSide(combatData, previewRuntime.unitName(actor)) ? 'buff' : 'debuff'),
          状态: stateName, 状态名称: stateName, 层数: 1, duration,
          原型: prototype,
          判定: String(effect?.判定 || '').trim(),
          结算: String(effect?.结算 || '').trim(),
          规则: String(effect?.规则 || '').trim(),
          防御对象: String(effect?.防御对象 || '').trim(),
          次数: effect?.次数 !== undefined ? Number(effect.次数) : undefined,
          资源: cloneValue(effect?.资源 ?? effect?.限定资源 ?? ''),
          限定资源: String(effect?.限定资源 || '').trim(),
          限定元素: cloneValue(effect?.限定元素 ?? ''),
          限定探查者: String(effect?.限定探查者 || '').trim(),
          对应等级: effect?.对应等级 !== undefined ? Number(effect.对应等级) : undefined,
          触发消耗: cloneValue(effect?.触发消耗),
          __本回合新附加: true,
          描述: `由[${actionName}]附加`, 战斗效果: { ...createEmptyCombatEffectMap(), ...previewRuntime.deriveStateCombatEffect(effect) },
          面板修改比例: { ...(effect?.面板修改比例 || {}) }, 面板固定修正: { ...(effect?.面板固定修正 || {}) },
        };
        const applicationId = nextRuntimeId('state-src');
        const successProbability = previewRuntime.normalizeEffectProbability(
          effect?.成功率 ?? effect?.触发概率,
          1,
        );
        const stateSample = sampleEffectOutcome({
          effect,
          effectIndex,
          targetId: previewRuntime.unitId(target),
          operation: 'STATE_APPLY',
        });
        const roll = stateSample.roll;
        let result = 'applied';
        let mergeKind = 'NO_EFFECT';
        if (negativeEffectIsImmune(target, state)) result = 'immune';
        else if (!stateSample.succeeded) result = 'resisted';
        else if (!stateName) result = 'invalid';
        else {
          const existingState = target?.状态效果?.[stateName];
          const existingDuration = Math.max(0, Number(existingState?.duration ?? existingState?.持续回合 ?? 0));
          const existingSourceWindows = Array.isArray(existingState?.__状态来源窗口)
            ? existingState.__状态来源窗口.map(value => String(value || '').trim()).filter(Boolean).slice(0, existingDuration)
            : existingState?.__状态来源键
              ? Array.from({ length: existingDuration }, () => String(existingState.__状态来源键).trim())
              : [];
          const merged = mergeRuntimeCondition(existingState, state, effect);
          mergeKind = merged.mergeKind;
          if (merged.applied) {
            const sourceId = registerStateSource(combatData, {
              applicationId,
              stateName,
              targetName: previewRuntime.unitName(target),
              sourceActorName: previewRuntime.unitName(actor),
              sourceActionName: actionName,
              sourceActionId: actionEvent.actionId,
              sourceActionType: actionKind,
              sourceRound: Number(combatData?.回合 || 0),
              duration,
              effectSummary: String(effect?.效果摘要 || effect?.状态描述 || effect?.描述 || '').trim(),
              driverAttr: String(effect?.驱动属性 || '').trim(),
            });
            const mergedDuration = Math.max(0, Number(merged.state?.duration ?? merged.state?.持续回合 ?? duration));
            const sourceWindows = merged.mergeKind === 'NEW' || merged.mergeKind === 'REPLACE'
              ? Array.from({ length: mergedDuration }, () => sourceId)
              : [
                  ...existingSourceWindows.slice(0, Math.min(existingDuration, mergedDuration)),
                  ...Array.from(
                    { length: Math.max(0, mergedDuration - existingDuration) },
                    () => sourceId,
                  ),
                ];
            const appliedState = {
              ...merged.state,
              来源技能: actionName,
              来源角色: previewRuntime.unitName(actor),
            };
            Object.defineProperties(appliedState, {
              __状态来源键: {
                configurable: true,
                enumerable: false,
                writable: true,
                value: sourceWindows[0] || sourceId,
              },
              __状态来源窗口: {
                configurable: true,
                enumerable: false,
                writable: true,
                value: sourceWindows,
              },
            });
            target.状态效果[stateName] = appliedState;
            const chargeInterrupt = result === 'applied'
              ? interruptStoredChargeByControl({
                  combatData,
                  sourceActor: actor,
                  target,
                  actionEvent,
                  actionRole,
                  stateName,
                })
              : null;
            if (chargeInterrupt) facts.push(chargeInterrupt);
          }
          else result = 'no_effect';
        }
        const stateReplaced = result === 'applied' && stateBefore !== null;
        const stateEventKind = stateReplaced ? 'state_replace' : 'state_apply';
        const stateOperation = stateReplaced ? 'STATE_REPLACE' : 'STATE_APPLY';
        const stateResult = stateReplaced ? 'replaced' : result;
        const stateAfter = result === 'applied'
          ? cloneValue(target?.状态效果?.[stateName] || null)
          : cloneValue(stateBefore);
        const stateFact = writeLedgerEvent(combatData, {
          eventKind: stateEventKind, round: Number(combatData?.回合 || 0), actorName: previewRuntime.unitName(actor), targetName: previewRuntime.unitName(target),
          actionName, actionType: actionKind, actorControl, actionRole, actionId: actionEvent.actionId, sourceActionId: actionEvent.actionId,
          parentNodeId: actionEvent.chainNodeId || '', sourceNodeId: actionEvent.chainNodeId || '', result: stateResult,
          resultState: result === 'applied' ? 'SUCCESS' : result === 'no_effect' ? 'NO_EFFECT' : 'FAILURE',
          primaryOutcome: result === 'applied' ? stateReplaced ? 'state_replaced' : 'state_applied' : result === 'immune' ? 'state_immune' : 'state_resisted',
          duration, applicationId: result === 'applied' ? applicationId : '',
          effectPrototype: prototype,
          factType: 'STATE',
          sourceEffectId,
          groupKey: stateSample.groupKey,
          outcomeId: stateSample.outcomeId,
          probability: stateSample.probability,
          roll: stateSample.roll,
          operation: stateOperation,
          position: outcomePosition(stateOperation, effectIndex),
          meta: {
            source: 'structured_runtime',
            effectIndex,
            stateName,
            duration,
            successRate: successProbability,
            roll,
            applicationId: result === 'applied' ? applicationId : '',
            groupKey: stateSample.groupKey,
            outcomeId: stateSample.outcomeId,
            probability: stateSample.probability,
            before: stateBefore,
            after: stateAfter,
            mergeKind,
            operation: stateOperation,
            position: outcomePosition(stateOperation, effectIndex),
          },
        });
        if (stateFact && result === 'applied') bindStateSourceProvenance(combatData, target, stateName, applicationId, stateFact);
        facts.push(stateFact);
        const abnormalResistanceMultiplier = typeof previewRuntime.stateApplicationProbabilityMultiplier === 'function'
          ? previewRuntime.stateApplicationProbabilityMultiplier(target, effect)
          : 1;
        if (
          stateFact &&
          result === 'applied' &&
          abnormalResistanceMultiplier < 1 - 1e-12
        ) {
          facts.push(writeLedgerEvent(combatData, {
            eventKind: 'state_resistance_check',
            round: Number(combatData?.回合 || 0),
            actorId: previewRuntime.unitId(actor),
            actorName: previewRuntime.unitName(actor),
            targetId: previewRuntime.unitId(target),
            targetName: previewRuntime.unitName(target),
            actionName,
            actionType: actionKind,
            actorControl,
            actionRole,
            actionId: actionEvent.actionId,
            sourceActionId: actionEvent.actionId,
            parentNodeId: actionEvent.chainNodeId || '',
            sourceNodeId: actionEvent.chainNodeId || '',
            result: 'partially_resisted',
            resultState: 'RESISTED_PARTIAL',
            primaryOutcome: 'abnormal_resistance_applied',
            ruleCode: 'ABNORMAL_RESISTANCE_APPLIED',
            effectPrototype: prototype,
            factType: 'STATE',
            sourceEffectId,
            operation: 'STATE_RESISTANCE_CHECK',
            meta: {
              source: 'structured_runtime',
              stateName,
              stateApplied: true,
              resistanceMultiplier: abnormalResistanceMultiplier,
              applicationProbability: stateSample.probability,
              operation: 'STATE_RESISTANCE_CHECK',
            },
          }));
        }
        if (isPrimaryEffect) {
          const targetId = previewRuntime.unitId(target);
          primaryResolutionByTarget.set(targetId, result === 'applied');
          primaryOutcomeByTarget.set(
            targetId,
            result === 'applied'
              ? 'HIT'
              : result === 'resisted' || result === 'immune'
                ? 'RESISTED'
                : 'MISS',
          );
        }
      });
    };
    effects
      .map((effect, sourceEffectIndex) => ({ effect, sourceEffectIndex }))
      .sort((left, right) => {
        const isPreDamageSuppression = effect =>
          String(effect?.原型 || '').trim() === '机制抹消' &&
          String(effect?.抹消对象?.原型 || effect?.抹消对象 || '').trim() === '规则防御';
        const isPreDamageAttribute = effect =>
          equipmentPassiveEffectHashes.has(equipmentPassiveEffectKey(effect)) &&
          String(effect?.原型 || '').trim() === '属性修正' &&
          String(effect?.目标 || '').trim() === '自身' &&
          String(effect?.生效方式 || '独立生效').trim() !== '跟随主原型' &&
          (!Array.isArray(effect?.条件分支) || effect.条件分支.length === 0);
        const phase = effect => isPreDamageSuppression(effect) ? 0 : isPreDamageAttribute(effect) ? 1 : 2;
        return phase(left.effect) - phase(right.effect) || left.sourceEffectIndex - right.sourceEffectIndex;
      })
      .forEach(({ effect: sourceEffect, sourceEffectIndex }) => {
      const prototype = String(sourceEffect?.原型 || '').trim();
      const rawTargets = prototype
        ? resolveStructuredTargets(combatData, actor, declaration, sourceEffect)
        : [primaryTarget].filter(Boolean);
      const orderedTargets = [...rawTargets].sort((left, right) => {
        const leftId = String(previewRuntime.unitId(left) || '').trim();
        const rightId = String(previewRuntime.unitId(right) || '').trim();
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
      });
      const groups = new Map();
      orderedTargets.forEach(target => {
        const targetId = previewRuntime.unitId(target);
        const reaction = input?.reactionByTarget?.[targetId] || null;
        const conditionTarget = primaryTarget && previewRuntime.unitId(target) === previewRuntime.unitId(actor)
          ? primaryTarget
          : target;
        const primaryReferenceId = previewRuntime.unitId(conditionTarget) || targetId;
        const inheritedConditionContext = input?.conditionContext && typeof input.conditionContext === 'object'
          ? input.conditionContext
          : {};
        const hasPrimaryResolution = primaryResolutionByTarget.has(primaryReferenceId);
        const primarySucceeded = hasPrimaryResolution
          ? primaryResolutionByTarget.get(primaryReferenceId) === true
          : inheritedConditionContext.primarySucceeded === true;
        const primaryEvaded = reaction
          ? reaction.evaded === true
          : inheritedConditionContext.primaryEvaded === true;
        const primaryOutcome = primaryOutcomeByTarget.get(primaryReferenceId) || (
          reaction && primaryEvaded
            ? 'EVADED'
            : hasPrimaryResolution
              ? primarySucceeded ? 'HIT' : 'MISS'
              : String(inheritedConditionContext.primaryOutcome || '').trim().toUpperCase()
        );
        const plan = previewRuntime.resolveConditionalEffectPlan(
          sourceEffect,
          combatData,
          actor,
          target,
          {
            declaration,
            ...inheritedConditionContext,
            primarySucceeded,
            primaryEvaded,
            primaryOutcome,
            primaryTerminated: primaryTerminatedByTarget.has(primaryReferenceId)
              ? primaryTerminatedByTarget.get(primaryReferenceId) === true
              : inheritedConditionContext.primaryTerminated === true,
            primaryTarget,
            conditionTarget,
          },
        );
        if (!plan.length) return;
        const key = previewRuntime.stableHash(plan.map(entry => ({
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
        group.plan.forEach((entry, planIndex) => {
          executeResolvedEffect(
            entry.effect,
            sourceEffectIndex,
            group.targets,
            { ...entry, planIndex },
          );
        });
      });
    });
    const committedEquipmentPassiveTriggers = new Set();
    equipmentPassiveTriggerRows.forEach(row => {
      const rowKey = `${equipmentPassiveEffectKey(row.effect)}|${String(row.sourceEffectId || '').trim()}`;
      if (committedEquipmentPassiveTriggers.has(rowKey)) return;
      const sourceEffectId = String(row.sourceEffectId || '').trim();
      const effectFacts = facts.slice(Math.max(0, Number(row.factStart || 0))).filter(event =>
        (String(event?.sourceEffectId || '').trim() === sourceEffectId ||
          String(event?.sourceEffectId || '').trim().startsWith(`${sourceEffectId}:`)) &&
        !['FAILURE', 'NO_EFFECT'].includes(String(event?.resultState || '').trim()) &&
        event?.eventKind !== 'passive_trigger_blocked'
      );
      if (!effectFacts.length) return;
      if (!equipmentPassiveTriggerAllowed(actor, row.effect, combatData, actionEvent, true)) return;
      committedEquipmentPassiveTriggers.add(rowKey);
      facts.push(...settleEquipmentPassiveTriggerCost({
        combatData,
        actor,
        effect: row.effect,
        action,
        actionEvent,
        actionRole,
      }));
    });
    if (actionKind === 'EQUIP') {
      const consumer = itemPassiveConsumer();
      const equippedPackage = consumer && declaration?.skill && typeof declaration.skill === 'object'
        ? consumer.编译物品被动消费者_V1(declaration.skill, {
            来源物品: String(declaration.skill?.名称 || declaration.skill?.name || actionName).trim(),
            来源槽位: String(declaration.skill?.装备槽位 || '').trim(),
          })
        : null;
      if (equippedPackage) {
        syncEquipmentPassiveRuntime(actor, Number(combatData?.当前世界tick || combatData?.当前tick || 0), {
          packageValue: equippedPackage,
          rebuildFinal: true,
        });
      }
      actor.__battleRuntime = actor.__battleRuntime && typeof actor.__battleRuntime === 'object' ? actor.__battleRuntime : {};
      const equipmentId = String(declaration?.skill?.id || declaration?.skill?.物品ID || declaration?.skill?.名称 || declaration?.skill?.name || actionName).trim();
      const signature = String(declaration?.equipmentSignature || '').trim();
      actor.__battleRuntime.equippedDecisionItem = { id: equipmentId, name: actionName, signature };
      actor.__battleRuntime.equipmentDecisionSignatures = Array.from(new Set([
        ...(Array.isArray(actor.__battleRuntime.equipmentDecisionSignatures) ? actor.__battleRuntime.equipmentDecisionSignatures : []),
        signature,
      ].filter(Boolean)));
      facts.push(writeLedgerEvent(combatData, {
        eventKind: 'complete',
        round: Number(combatData?.回合 || 0),
        actorName: previewRuntime.unitName(actor),
        targetName: previewRuntime.unitName(actor),
        actionName,
        actionType: actionKind,
        actorControl,
        actionRole,
        actionId: actionEvent.actionId,
        sourceActionId: actionEvent.actionId,
        parentNodeId: actionEvent.chainNodeId || '',
        sourceNodeId: actionEvent.chainNodeId || '',
        result: 'equipped',
        resultState: 'SUCCESS',
        primaryOutcome: 'equipment_changed',
        meta: { source: 'structured_runtime', equipmentId, equipmentSignature: signature },
      }));
    }
    const grantedEffectIds = new Set(grantedEffects.map(entry => String(entry?.effectId || '').trim()).filter(Boolean));
    const isGrantedEffectEvent = event => {
      const sourceEffectId = String(event?.sourceEffectId || event?.meta?.effectInstanceId || '').trim();
      return Boolean(sourceEffectId) && [...grantedEffectIds].some(effectId => sourceEffectId === effectId || sourceEffectId.startsWith(`${effectId}:`));
    };
    const actionLedgerEffects = ensureLedger(combatData).filter(event =>
      String(event?.actionId || event?.sourceActionId || '').trim() === String(actionEvent.actionId || '').trim() &&
      String(event?.resultState || '').trim().toUpperCase() === 'SUCCESS' &&
      !['action_cost', 'action_start'].includes(String(event?.eventKind || '').trim()) &&
      !isGrantedEffectEvent(event) &&
      String(event?.effectPrototype || event?.prototype || '').trim(),
    );
    const releaseSucceeded = actionKind === 'RELEASE_SKILL' && (
      facts.some(event =>
        String(event?.actionId || event?.sourceActionId || '').trim() === String(actionEvent.actionId || '').trim() &&
        String(event?.resultState || '').trim().toUpperCase() === 'SUCCESS' &&
        !['action_cost', 'action_start'].includes(String(event?.eventKind || '').trim()) &&
        !isGrantedEffectEvent(event) &&
        String(event?.effectPrototype || event?.prototype || '').trim(),
      ) ||
      actionLedgerEffects.length > 0 ||
      (grantedEffects.length === 0 && [...primaryResolutionByTarget.values()].some(value => value === true))
    );
    if (actionKind === 'RELEASE_SKILL' && actionName === '坚挺金苍蝇' && Object.keys(skillCostStages.维持 || {}).length && releaseSucceeded) {
      actor.状态效果 = actor.状态效果 && typeof actor.状态效果 === 'object' && !Array.isArray(actor.状态效果) ? actor.状态效果 : {};
      const maintenanceState = {
        ...(actor.状态效果['坚挺金苍蝇·武魂真身维持'] || {}),
        类型: 'buff',
        状态: '坚挺金苍蝇·武魂真身维持',
        状态名称: '坚挺金苍蝇·武魂真身维持',
        描述: '第七魂技武魂真身维持态：香肠制造速度×1.3，香肠产物效果×1.3',
        来源技能: '坚挺金苍蝇',
        维持态: true,
        制造速度倍率: 1.3,
        产物效果倍率: 1.3,
        维持消耗: '魂力:8%',
      };
      ['duration', '持续回合', '剩余回合', '剩余tick', '持续tick', '结束tick', '有效期至tick', '剩余窗口'].forEach(field => delete maintenanceState[field]);
      actor.状态效果['坚挺金苍蝇·武魂真身维持'] = maintenanceState;
      syncC2FoodMaintenanceRuntime(actor, declaration.skill || {});
    }
    if (releaseSucceeded && typeof root.__LWCS_C2_CONSUMER_RULES_V1__?.消费坚挺金苍蝇成功魂技_V1 === 'function') {
      root.__LWCS_C2_CONSUMER_RULES_V1__.消费坚挺金苍蝇成功魂技_V1(actor, actionKind, true);
    }
    if (actionKind === 'RELEASE_SKILL' && Object.keys(skillCostStages.维持 || {}).length) {
      attachSkillSustainCost(
        combatData,
        actor,
        declaration,
        actionName,
        skillCostStages.维持,
        sustainEffectKeysBefore,
        actionEvent,
      );
    }
    const receivedDamageIds = [...new Set(facts
      .filter(event =>
        event?.eventKind === 'hit_result' &&
        Number(event?.meta?.incomingDamage ?? event?.meta?.appliedDamage ?? event?.appliedDamage ?? 0) > 0
      )
      .map(event => String(event?.targetId || '').trim())
      .filter(Boolean))];
    if (actionRole !== 'STATE_TICK' && receivedDamageIds.length) {
      settlePassiveSkillConsumers(combatData, Number(combatData?.回合 || 0), {
        phases: ['受击后'],
        triggeredUnitIds: receivedDamageIds,
        triggerEventId: actionEvent.actionId,
        declaration,
        primaryTarget,
        conditionTarget: primaryTarget,
        conditionContext: {
          primaryOutcome: 'HIT',
          primarySucceeded: true,
          primaryTarget,
          conditionTarget: primaryTarget,
        },
      });
    }
    if (actionRole !== 'STATE_TICK' && facts.some(event =>
      event?.eventKind === 'hit_result' &&
      String(event?.actorId || '').trim() === previewRuntime.unitId(actor) &&
      !/miss|failure|dodged|evaded/i.test(String(event?.result || event?.resultState || ''))
    )) {
      settlePassiveSkillConsumers(combatData, Number(combatData?.回合 || 0), {
        phases: ['命中后'],
        triggeredUnitIds: [previewRuntime.unitId(actor)],
        triggerEventId: actionEvent.actionId,
        declaration,
        primaryTarget,
        conditionTarget: primaryTarget,
        conditionContext: {
          primaryOutcome: 'HIT',
          primarySucceeded: true,
          primaryTarget,
          conditionTarget: primaryTarget,
        },
      });
    }
    return { actionEvent, facts: facts.filter(Boolean), actor, target: primaryTarget, terminal: 'RESOLVED' };
  }

  function auditStructuredCommitCoverage() {
    const sampled = new Set(['伤害结算', '资源变化', '护盾变化', '状态施加']);
    const summoned = new Set(['召唤生成']);
    const rows = prototypeManifest.map(entry => {
      const memberships = [sampled.has(entry.name), previewCommittedPrototypes.has(entry.name), summoned.has(entry.name)].filter(Boolean).length;
      if (memberships !== 1) throw new Error(`battle_structured_commit_ownership_invalid:${entry.name}:${memberships}`);
      return {
        prototype: entry.name,
        mode: sampled.has(entry.name) ? 'SAMPLED_DIRECT' : previewCommittedPrototypes.has(entry.name) ? 'PREVIEW_ATOMIC_COMMIT' : 'SUMMON_FSM',
      };
    });
    return cloneValue({
      rows,
      prototypeCount: rows.length,
      sampledCount: rows.filter(row => row.mode === 'SAMPLED_DIRECT').length,
      previewCommitCount: rows.filter(row => row.mode === 'PREVIEW_ATOMIC_COMMIT').length,
      pending: [],
    });
  }

  function structuredDamageEffects(declaration = {}) {
    if (String(declaration?.actionKind || '').trim() === 'BASIC_ATTACK') {
      return [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 攻击段数: 1 }];
    }
    return (Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组 : [])
      .filter(effect => String(effect?.原型 || '').trim() === '伤害结算');
  }

  function structuredActorCanAct(unit = {}, actionRole = 'ACTIVE') {
    if (
      previewRuntime.isSummonUnit(unit) &&
      (
        unit?.已消散 === true ||
        Math.max(
          0,
          Number(
            unit?.剩余窗口 ??
            unit?.召唤窗口运行态?.remainingWindows ??
            unit?.__battleRuntime?.summonWindow?.remainingWindows ??
            0
          ),
        ) <= 0
      )
    ) {
      return false;
    }
    if (!previewRuntime.isBattleCapable(unit)) return false;
    return !Object.values(unit?.状态效果 || {}).some(state => structuredControlPreventsOpportunity(state, actionRole));
  }

  function structuredControlConsumesActiveOpportunity(state = {}) {
    const effects = state?.战斗效果 || state?.计算层效果 || {};
    const stateName = String(state?.状态 || state?.状态名称 || state?.name || '').trim();
    const hardControl = ['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞'].includes(stateName);
    return hardControl || state?.skip_turn === true || state?.cannot_act === true ||
      effects.skip_turn === true || effects.cannot_act === true;
  }

  function structuredControlPreventsOpportunity(state = {}, actionRole = 'ACTIVE') {
    const effects = state?.战斗效果 || state?.计算层效果 || {};
    return structuredControlConsumesActiveOpportunity(state) ||
      (normalizeActionRole(actionRole) !== 'ACTIVE' && (state?.cannot_react === true || effects.cannot_react === true));
  }

  function consumeStructuredControlActiveBudget(combatData = {}, unit = {}, node = {}) {
    if (normalizeActionRole(node?.actionRole) !== 'ACTIVE') return;
    const states = unit?.状态效果 && typeof unit.状态效果 === 'object'
      ? unit.状态效果
      : {};
    const targetId = previewRuntime.unitId(unit) || '';
    const targetName = previewRuntime.unitName(unit) || '未知单位';
    Object.entries(states).forEach(([stateKey, state]) => {
      if (
        !structuredControlConsumesActiveOpportunity(state) ||
        !Number.isFinite(Number(state?.duration)) ||
        Number(state.duration) <= 0
      ) {
        return;
      }
      const stateName = String(
        state?.状态名称 || state?.状态 || stateKey || '控制状态',
      ).trim();
      const previousDuration = Math.max(0, Number(state.duration));
      let activeSourceId = String(state?.__状态来源窗口?.[0] || state?.__状态来源键 || '').trim();
      if (!activeSourceId && state?.sourceActionId && state?.sourceEventId) {
        activeSourceId = nextRuntimeId('state-src');
        registerStateSource(combatData, {
          applicationId: activeSourceId,
          stateName,
          targetName,
          sourceActionId: state.sourceActionId,
          sourceEventId: state.sourceEventId,
          provenanceClass: 'ACTION_APPLIED',
        });
        Object.defineProperties(state, {
          __状态来源键: { configurable: true, enumerable: false, writable: true, value: activeSourceId },
          __状态来源窗口: { configurable: true, enumerable: false, writable: true, value: [activeSourceId] },
        });
      }
      const source = findStateSource(combatData, { applicationId: activeSourceId });
      const nextDuration = Math.max(0, previousDuration - 1);
      state.duration = nextDuration;
      if (Array.isArray(state.__状态来源窗口)) {
        state.__状态来源窗口.shift();
        state.__状态来源键 = String(state.__状态来源窗口[0] || '').trim();
      }
      const expired = nextDuration <= 0;
      activeSourceId = String(state?.__状态来源窗口?.[0] || state?.__状态来源键 || '').trim();
      const activeSource = findStateSource(combatData, { applicationId: activeSourceId }) || source;
      const sourceActionId = String(activeSource?.sourceActionId || source?.sourceActionId || '').trim();
      const sourceEventId = String(activeSource?.sourceEventId || source?.sourceEventId || '').trim();
      const provenanceClass = String(activeSource?.provenanceClass || source?.provenanceClass || '').trim();
      const ledgerApplicationId = expired
        ? ''
        : String(activeSourceId || activeSource?.applicationId || source?.applicationId || '').trim();
      writeLedgerEvent(combatData, {
        eventKind: expired ? 'state_expire' : 'state_replace',
        round: Number(combatData?.回合 || 0),
        actorId: targetId,
        actorName: targetName,
        targetId,
        targetName,
        actionName: stateName,
        actionType: 'control_opportunity',
        actorControl: 'SYSTEM',
        actionRole: 'STATE_TICK',
        sourceActionName: String(source?.sourceActionName || '').trim(),
        sourceActionId,
        sourceEventId,
        ...(ledgerApplicationId ? { applicationId: ledgerApplicationId } : {}),
        parentNodeId: String(source?.sourceNodeId || '').trim(),
        sourceNodeId: String(source?.sourceNodeId || '').trim(),
        opportunityId: String(node?.opportunityId || node?.grantId || '').trim(),
        opportunitySequence: Math.max(0, Number(node?.opportunitySequence || 0)),
        result: expired ? 'expired' : 'consumed',
        resultState: expired ? 'EXPIRED' : 'SUCCESS',
        factType: 'STATE_CHANGE',
        operation: expired ? 'STATE_EXPIRE' : 'CONTROL_WINDOW_CONSUME',
        duration: nextDuration,
        meta: {
          source: 'structured_runtime',
          stateKey,
          stateName,
          previousDuration,
          nextDuration,
          opportunityId: String(node?.opportunityId || node?.grantId || '').trim(),
          operation: expired ? 'STATE_EXPIRE' : 'CONTROL_WINDOW_CONSUME',
          sourceActionId,
          sourceEventId,
          ...(provenanceClass ? { provenanceClass } : {}),
          ...(ledgerApplicationId ? { applicationId: ledgerApplicationId } : {}),
        },
      });
      if (expired) {
        settleExpiredConditionBase(unit, stateKey, state, targetName, combatData);
      }
    });
  }

  function structuredActorIncapacityReason(unit = {}, actionRole = 'ACTIVE') {
    if (
      previewRuntime.isSummonUnit(unit) &&
      (
        unit?.已消散 === true ||
        Math.max(
          0,
          Number(
            unit?.剩余窗口 ??
            unit?.召唤窗口运行态?.remainingWindows ??
            unit?.__battleRuntime?.summonWindow?.remainingWindows ??
            0
          ),
        ) <= 0
      )
    ) {
      return 'SUMMON_WINDOW_EXPIRED';
    }
    const baseReason = previewRuntime.readIncapacityReason(unit);
    if (baseReason) return baseReason;
    const controlled = Object.entries(unit?.状态效果 || {}).find(([, state]) =>
      structuredControlPreventsOpportunity(state, actionRole)
    );
    return controlled ? `CONTROLLED:${controlled[0]}` : '';
  }

  function structuredControlSource(combatData = {}, unit = {}, actionRole = 'ACTIVE') {
    const controlled = Object.entries(unit?.状态效果 || {}).find(([, state]) =>
      structuredControlPreventsOpportunity(state, actionRole)
    );
    if (!controlled) return null;
    const [stateName, state] = controlled;
    const applicationId = String(
      state?.__状态来源窗口?.[0] ||
      state?.__状态来源键 ||
      '',
    ).trim();
    return findStateSource(combatData, {
      applicationId,
      stateName,
      targetName: previewRuntime.unitName(unit),
      maxRound: Number(combatData?.回合 || 0),
    });
  }

  function interruptStoredChargeByControl({
    combatData = {},
    sourceActor = {},
    target = {},
    actionEvent = {},
    actionRole = 'ACTIVE',
    stateName = '',
  } = {}) {
    if (
      !target?.蓄力技能 ||
      !structuredControlPreventsOpportunity(target?.状态效果?.[stateName] || {}, actionRole)
    ) return null;
    const interruptedCharge = target.蓄力技能;
    target.蓄力技能 = null;
    return writeLedgerEvent(combatData, {
      eventKind: 'charge_interrupt',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(target),
      actorName: previewRuntime.unitName(target),
      targetId: previewRuntime.unitId(target),
      targetName: previewRuntime.unitName(target),
      actionName: normalizeActionDisplayName(
        interruptedCharge?.skill?.name ||
        interruptedCharge?.skill?.魂技名 ||
        interruptedCharge?.actionName ||
        '蓄力行动'
      ),
      actionType: 'charge_interrupt',
      actorControl: 'SYSTEM',
      actionRole: 'ACTIVE',
      actionId: String(interruptedCharge?.sourceActionId || '').trim(),
      sourceActionId: String(actionEvent?.actionId || '').trim(),
      parentNodeId: String(actionEvent?.chainNodeId || '').trim(),
      sourceNodeId: String(actionEvent?.chainNodeId || '').trim(),
      result: 'interrupted',
      resultState: 'ABORTED',
      ruleCode: 'CHARGE_INTERRUPTED_BY_CONTROL',
      meta: {
        source: 'structured_runtime',
        stateName: String(stateName || '').trim(),
        interruptedActionId: String(interruptedCharge?.sourceActionId || '').trim(),
        controlSourceActionId: String(actionEvent?.actionId || '').trim(),
        sourceActorId: previewRuntime.unitId(sourceActor),
        sourceActorName: previewRuntime.unitName(sourceActor),
        reasonCode: 'CONTROL_APPLIED',
        reasonText: `受【${String(stateName || '控制状态').trim()}】影响`,
      },
    });
  }

  function structuredActorPhysicallyAlive(unit = {}) {
    return unit?.状态?.存活 !== false && previewRuntime.readHp(unit) > 0;
  }

  function readStructuredContinuationGrant(declaration = {}) {
    const skill = declaration?.skill && typeof declaration.skill === 'object' ? declaration.skill : {};
    const direct = [
      skill?.再行动,
      skill?.追加行动,
      skill?.额外行动,
      skill?.命中后追击,
      skill?.控制后追击,
    ].some(value => value === true || Number(value) > 0);
    const grantEffect = (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).find(effect =>
      String(effect?.原型 || '').trim() === '机制授予' &&
      /再行动|追加行动|额外行动|追击|连击/.test(String(effect?.机制 || effect?.机制名称 || effect?.名称 || '').trim())
    );
    if (!direct && !grantEffect) return null;
    const trigger = String(
      grantEffect?.触发条件 || grantEffect?.触发 ||
      skill?.后继触发条件 || skill?.追击触发条件 ||
      (skill?.控制后追击 ? '控制命中' : skill?.命中后追击 ? '命中' : ''),
    ).trim();
    return {
      trigger,
      requiresHit: /命中|伤害/.test(trigger),
      requiresControl: /控制|状态附着/.test(trigger),
      maxActions: 1,
    };
  }

  function structuredReactionContest(reactor = {}, sourceActor = {}) {
    return previewRuntime.calculateReactionContest(reactor, sourceActor);
  }

  function consumeStructuredReactionOpportunity(combatData = {}, unit = {}, sourceActionId = '') {
    const runtime = ensureCombatRuntime(combatData);
    const unitKey = String(unit?.charKey || unit?.char_key || unit?.key || previewRuntime.unitId(unit) || previewRuntime.unitName(unit)).trim();
    const sourceId = String(sourceActionId || '').trim();
    const targetId = String(previewRuntime.unitId(unit) || unitKey).trim();
    if (!unitKey || !sourceId || !targetId) return { ok: false, reason: 'REACTION_GRANT_CONTEXT_MISSING' };
    const grantId = `reaction:${sourceId}:${targetId}`;
    if (runtime.reactionGrantIds[grantId] === true) {
      return { ok: false, reason: 'REACTION_GRANT_ALREADY_CONSUMED', grantId };
    }
    runtime.reactionGrantIds[grantId] = true;
    return {
      ok: true,
      unitKey,
      targetId,
      sourceActionId: sourceId,
      grantId,
      opportunityId: grantId,
    };
  }

  function settleStructuredReaction(input = {}) {
    const combatData = input?.combatData;
    const reactor = input?.reactor;
    const sourceActor = input?.sourceActor;
    const declaration = input?.declaration || {};
    const parentActionEvent = input?.parentActionEvent || {};
    const preparedDefense = input?.preparedDefense && typeof input.preparedDefense === 'object'
      ? input.preparedDefense
      : null;
    if (!combatData || !reactor || !sourceActor || !parentActionEvent?.actionId) {
      throw new TypeError('battle_structured_reaction_context_invalid');
    }
    const actionKind = String(declaration?.actionKind || '').trim();
    const actorName = previewRuntime.unitName(reactor);
    const sourceName = previewRuntime.unitName(sourceActor);
    const reactionMeta = {
      source: 'structured_runtime',
      decisionCandidateId: String(input?.decisionCandidateId || '').trim(),
      declaredTargetIds: Array.isArray(declaration?.targetIds)
        ? declaration.targetIds.map(value => String(value || '').trim()).filter(Boolean)
        : [],
    };
    const common = {
      round: Number(combatData?.回合 || 0),
      actorName,
      targetName: sourceName,
      actorControl: 'AI',
      actionRole: 'REACTION',
      actionId: parentActionEvent.actionId,
      sourceActionId: parentActionEvent.actionId,
      opportunityId: String(input?.opportunityId || parentActionEvent?.opportunityId || parentActionEvent?.meta?.opportunityId || '').trim(),
      opportunitySequence: Math.max(
        0,
        Number(
          input?.opportunitySequence ||
          parentActionEvent?.opportunitySequence ||
          parentActionEvent?.meta?.opportunitySequence ||
          0,
        ),
      ),
      grantId: String(input?.grantId || parentActionEvent?.grantId || parentActionEvent?.meta?.grantId || '').trim(),
      parentNodeId: parentActionEvent.chainNodeId || '',
      sourceNodeId: parentActionEvent.chainNodeId || '',
      actionType: actionKind,
    };
    if (actionKind === 'PASS_OPPORTUNITY') {
      const sourceActorId = previewRuntime.unitId(sourceActor);
      const event = writeLedgerEvent(combatData, {
        ...common,
        eventKind: 'pass',
        actorId: previewRuntime.unitId(reactor),
        targetId: sourceActorId,
        targetIds: [sourceActorId],
        actionId: nextRuntimeId('battle-reaction-pass'),
        actionName: '让过行动',
        result: 'complete',
        resultState: 'SUCCESS',
        actionStatus: 'COMPLETED',
        primaryOutcome: 'opportunity_passed',
        ruleCode: 'REACTION_OPPORTUNITY_PASSED',
        factType: 'REACTION',
        operation: 'OPPORTUNITY_PASS',
        meta: {
          ...reactionMeta,
          voluntaryOpportunityPass: true,
          preparedDefenseConsumed: !!preparedDefense,
        },
      });
      return {
        actionKind,
        event,
        evaded: false,
        damageMultiplier: 1,
        opensCounterCheck: false,
      };
    }
    if (actionKind === 'EVADE') {
      const contest = structuredReactionContest(reactor, sourceActor);
      const probability = previewRuntime.calculateDodgeProbability(reactor, sourceActor, !!preparedDefense);
      const roll = Math.random();
      const evaded = probabilitySucceeds(probability, roll);
      const event = writeLedgerEvent(combatData, {
        ...common,
        eventKind: 'dodge',
        actionName: '闪避',
        result: evaded ? 'evaded' : 'failed',
        resultState: evaded ? 'SUCCESS' : 'FAILURE',
        primaryOutcome: evaded ? 'dodged' : 'reaction_failed',
        ruleCode: evaded ? 'REACTION_SUCCEEDED' : 'REACTION_FAILED',
        meta: {
          ...reactionMeta,
          dodgeRate: probability,
          dodgeRoll: roll,
          probability,
          reactionPressure: contest.reactionPressure,
          attackPressure: contest.attackPressure,
          reactionShare: contest.share,
          reactionAgility: contest.reactionAgility,
          sourceAgility: contest.sourceAgility,
          reactionPressureBreakdown: contest.reactionPressureBreakdown,
          attackPressureBreakdown: contest.attackPressureBreakdown,
          reactionAgilityBreakdown: contest.reactionAgilityBreakdown,
          sourceAgilityBreakdown: contest.sourceAgilityBreakdown,
          preparedDefenseConsumed: !!preparedDefense,
        },
      });
      return {
        actionKind,
        event,
        evaded,
        damageMultiplier: 1,
        opensCounterCheck: !preparedDefense && evaded,
      };
    }
    if (actionKind === 'DEFEND' || actionKind === 'GUARD') {
      const damageMultiplier = previewRuntime.calculateDefenseDamageMultiplier(reactor, sourceActor, !!preparedDefense);
      const event = writeLedgerEvent(combatData, {
        ...common,
        eventKind: 'defend',
        actionName: actionKind === 'GUARD' ? '护卫' : '防御',
        result: 'guarded',
        resultState: 'SUCCESS',
        primaryOutcome: 'guarded',
        ruleCode: 'REACTION_SUCCEEDED',
        meta: { ...reactionMeta, damageMultiplier, preparedDefenseConsumed: !!preparedDefense },
      });
      return {
        actionKind,
        event,
        evaded: false,
        damageMultiplier,
        opensCounterCheck: !preparedDefense,
      };
    }
    const actionContext = beginStructuredDeclaration({
      combatData,
      declaration,
      actionRole: 'REACTION',
      actorControl: 'AI',
      sourceActionId: parentActionEvent.actionId,
      opportunityId: common.opportunityId,
      opportunitySequence: common.opportunitySequence,
      grantId: common.grantId,
      decisionCandidateId: reactionMeta.decisionCandidateId,
      parentNodeId: parentActionEvent.chainNodeId || '',
      reactionNodeId: parentActionEvent.chainNodeId || '',
    });
    const settlement = executeStructuredDeclaration({ combatData, declaration, actionContext });
    return {
      actionKind,
      event: settlement.actionEvent,
      facts: settlement.facts,
      evaded: false,
      damageMultiplier: 1,
      opensCounterCheck:
        previewRuntime.declarationGrantsCounter(declaration) &&
        settlement.facts.some(event => event?.resultState === 'SUCCESS'),
    };
  }

  function openStructuredCounterWindow(input = {}) {
    const { combatData, reactor, sourceActor, parentActionEvent, reaction, settlementFacts } = input;
    if (!combatData || !reactor || !sourceActor || !parentActionEvent?.actionId || !reaction?.opensCounterCheck) return null;
    if (!structuredActorCanAct(reactor, 'COUNTER') || !structuredActorPhysicallyAlive(sourceActor)) return null;
    const receivedDamage = (Array.isArray(settlementFacts) ? settlementFacts : []).reduce((sum, event) => {
      if (event?.eventKind !== 'hit_result' || !isUnitIdentityMatch(reactor, event?.targetName || event?.targetId || '')) return sum;
      return sum + Math.max(0, Number(event?.appliedDamage || event?.meta?.appliedDamage || 0));
    }, 0);
    if (reaction.actionKind === 'DEFEND' && !(receivedDamage > 0)) return null;
    const baseProbability = reaction.evaded === true ? 0.45 : 0.24;
    const contest = structuredReactionContest(reactor, sourceActor);
    const probability = Math.max(0.08, Math.min(0.72, baseProbability + (contest.probability - 0.25) * 0.5));
    const roll = Math.random();
    const opened = probabilitySucceeds(probability, roll);
    const event = writeLedgerEvent(combatData, {
      eventKind: 'counter_window',
      round: Number(combatData?.回合 || 0),
      actorId: previewRuntime.unitId(reactor),
      actorName: previewRuntime.unitName(reactor),
      targetId: previewRuntime.unitId(sourceActor),
      targetIds: [previewRuntime.unitId(sourceActor)].filter(Boolean),
      targetName: previewRuntime.unitName(sourceActor),
      actionName: '反击窗口',
      actionType: 'counter_window',
      actorControl: 'SYSTEM',
      actionRole: 'REACTION',
      sourceActionId: parentActionEvent.actionId,
      parentNodeId: reaction?.event?.chainNodeId || parentActionEvent.chainNodeId || '',
      sourceNodeId: parentActionEvent.chainNodeId || '',
      reactionNodeId: reaction?.event?.chainNodeId || '',
      result: opened ? 'opened' : 'missed',
      resultState: opened ? 'SUCCESS' : 'FAILURE',
      ruleCode: opened ? 'COUNTER_WINDOW_OPENED' : 'COUNTER_WINDOW_MISSED',
      meta: {
        source: 'structured_runtime',
        probability,
        roll,
        receivedDamage,
        reactionPressure: contest.reactionPressure,
        attackPressure: contest.attackPressure,
        reactionShare: contest.share,
        reactionAgility: contest.reactionAgility,
        sourceAgility: contest.sourceAgility,
        reactionPressureBreakdown: contest.reactionPressureBreakdown,
        attackPressureBreakdown: contest.attackPressureBreakdown,
        reactionAgilityBreakdown: contest.reactionAgilityBreakdown,
        sourceAgilityBreakdown: contest.sourceAgilityBreakdown,
      },
    });
    return { opened, event, probability, roll };
  }

  function runStructuredBattle(input = {}) {
    const performanceTraceEnabled =
      root?.process?.env?.BATTLE_R8_PERF_TRACE === '1';
    const performanceNow = () =>
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const performanceTrace = (stage, fields = {}) => {
      if (!performanceTraceEnabled) return;
      console.error(`[r8-runtime-perf] ${JSON.stringify({
        stage,
        ...fields,
      })}`);
    };
    const source = input?.combatData && typeof input.combatData === 'object' ? input.combatData : {};
    const sourceJson = JSON.stringify(source);
    const combatData = cloneValue(source);
    rehydrateStateSourceMemory(source, combatData);
    const caseId = String(input?.caseId || 'structured-shadow').trim() || 'structured-shadow';
    const seed = Math.max(1, Math.floor(Number(input?.seed || 1)));
    const roundLimit = Math.max(1, Math.min(20, Math.floor(Number(input?.rounds || input?.settings?.maxRounds || 1))));
    performanceTrace('battle-start', {
      caseId: String(input?.caseId || '').trim(),
      roundLimit,
      providerId: String(input?.settings?.providerId || '').trim(),
      sourceBytes: sourceJson.length,
    });
    const providerId = String(input?.settings?.providerId || '').trim();
    const playerLockedSettlement = input?.settings?.playerLockedSettlement === true;
    const testLinearProvider = input?.settings?.__r9v2LinearTest === true;
    const formalProviderIds = Array.isArray(decisionRuntime?.providerIds)
      ? decisionRuntime.providerIds
      : [];
    if (playerLockedSettlement && (providerId || testLinearProvider)) {
      throw new Error('BATTLE_PLAYER_LOCKED_PROVIDER_CONFLICT');
    }
    if (testLinearProvider && providerId) {
      throw new Error('BATTLE_TEST_PROVIDER_MODE_CONFLICT');
    }
    if (!playerLockedSettlement && !testLinearProvider) {
      if (!providerId) throw new Error('NO_FORMAL_PROVIDER');
      if (!formalProviderIds.includes(providerId)) {
        throw new Error('battle_decision_provider_unknown:' + providerId);
      }
    }
    if (input?.battleIntent && typeof input.battleIntent === 'object') {
      if (input.battleIntent.mode !== undefined) combatData.战斗意图 = cloneValue(input.battleIntent.mode);
      if (input.battleIntent.objectives !== undefined) combatData.胜负条件 = cloneValue(input.battleIntent.objectives);
    }
    normalizeLatestBattleRuntime(combatData);
    performanceTrace('runtime-normalized', {
      unitCount: listCombatUnits(combatData).length,
    });
    combatData.胜负条件 = cloneValue(previewRuntime.normalizeBattleObjectives(combatData?.胜负条件 || {}, combatData));
    const sourceRound = Math.max(0, Number(source?.回合 || 0));
    const objectiveFinalRound =
      Math.max(0, Number(combatData?.胜负条件?.startRound || 0)) +
      Math.max(1, Number(combatData?.胜负条件?.maxRounds || roundLimit));
    const battleFinalRound = objectiveFinalRound;
    fillObjectiveDamageBaselines(combatData);
    const runtime = ensureCombatRuntime(combatData);
    runtime.actionQueueTrace = [];
    runtime.opportunityGraph = {};
    runtime.resourceTimeline = [];
    runtime.scheduleDescriptors = {};
    runtime.routeUnitHashCache = {};
    runtime.ledgerSequence = 0;
    runtime.resourceEffectSequence = 0;
    resetRuntimeFactJournal(combatData);
    delete runtime.firstTerminalSequence;
    runtime.decisionSeed = seed;
    const invalidRuntime = validateBattleRuntime(combatData);
    if (invalidRuntime) {
      listCombatUnits(combatData).forEach(clearC2FoodMaintenanceRuntime);
      const finalSnapshot = getBattleSnapshot(combatData);
      return {
        caseId,
        seed,
        mode: 'structured',
        preview: true,
        inputUnchanged: true,
        roundsRequested: roundLimit,
        roundsExecuted: 0,
        ledger: [],
        eventLedger: [],
        trace: [],
        resolutionTrace: [],
        scoreAudit: [],
        scoringAudit: [],
        scoringMutationDetected: false,
        decisions: [],
        decisionTrace: [],
        actionChains: [],
        actionQueueTrace: [],
        reportBlocks: [],
        publicReportBlocks: [],
        roundOverview: [],
        finalBattleReport: null,
        aiSummaryInput: null,
        finalSnapshot,
        snapshot: finalSnapshot,
        combatData: cloneValue(combatData),
        logs: invalidRuntime.logs || [],
        initialSnapshot: finalSnapshot,
        terminal: null,
        objectiveResolution: null,
        winner: invalidRuntime.winner || 'unfinished',
        playerAlive: invalidRuntime.playerAlive,
        enemyAlive: invalidRuntime.enemyAlive,
        audit: { fatalCount: 0, warningCount: 0, fatals: [], warnings: [] },
        beliefObservations: [],
      };
    }
    const rawSelectedAction = input?.selectedAction && typeof input.selectedAction === 'object' ? input.selectedAction : null;
    const selectedActorId = String(
      rawSelectedAction?.actorId ||
      rawSelectedAction?.actor_id ||
      rawSelectedAction?.actor_name ||
      rawSelectedAction?.actorName ||
      '',
    ).trim();
    const selectedTargetNames = Array.isArray(rawSelectedAction?.targetIds) && rawSelectedAction.targetIds.length
      ? rawSelectedAction.targetIds.map(value => String(value || '').trim()).filter(Boolean)
      : [rawSelectedAction?.targetId, rawSelectedAction?.target_name, rawSelectedAction?.targetName]
        .map(value => String(value || '').trim())
        .filter(Boolean);
    const selectedActionType = String(rawSelectedAction?.actionKind || rawSelectedAction?.action_type || rawSelectedAction?.type || '').trim();
    const selectedActionKind = rawSelectedAction?.actionKind
      ? String(rawSelectedAction.actionKind).trim()
      : /防御|格挡|守势/.test(selectedActionType)
        ? 'DEFEND'
        : /闪避|躲避/.test(selectedActionType)
          ? 'EVADE'
          : /反击|防反|闪反/.test(selectedActionType)
            ? 'COUNTER'
            : /撤退|撤离/.test(selectedActionType)
              ? 'WITHDRAW'
              : /观察|试探/.test(selectedActionType)
                ? 'OBSERVE'
                : /保护|护卫/.test(selectedActionType)
                  ? 'GUARD'
                  : /物品|道具/.test(selectedActionType)
                    ? 'USE_ITEM'
                    : /装备|穿戴/.test(selectedActionType)
                      ? 'EQUIP'
                      : /普通攻击|常规攻击/.test(selectedActionType)
                        ? 'BASIC_ATTACK'
                        : 'RELEASE_SKILL';
    const selectedTargetIds = selectedTargetNames.map(targetName =>
      listPrimaryCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetName))
        ? previewRuntime.unitId(listPrimaryCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetName)))
        : targetName,
    ).filter(Boolean);
    const selectedDeclaration = rawSelectedAction?.declaration && typeof rawSelectedAction.declaration === 'object'
      ? cloneValue(rawSelectedAction.declaration)
      : rawSelectedAction && (selectedActorId || selectedActionKind)
        ? {
          actorId: selectedActorId,
          actionKind: selectedActionKind,
          targetIds: selectedTargetIds,
          skill: cloneValue(rawSelectedAction.skill || (selectedActionKind === 'RELEASE_SKILL' ? rawSelectedAction : {})),
        }
        : null;
    const originalRandom = Math.random;
    const previousIdContext = runtimeIdContext;
    const previousIdSequence = runtimeIdSequence;
    let randomState = seed % 2147483647;
    if (randomState <= 0) randomState += 2147483646;
    Math.random = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };
    runtimeIdContext = `structured-shadow-${seed.toString(36)}`;
    runtimeIdSequence = 0;
    const decisions = [];
    const decisionPerformanceDiagnostics = [];
    const recordDecisionPerformance = (decisionResult, fields = {}) => {
      const envelope = cloneValue(
        decisionResult?.candidateEnvelopeMetrics || {},
      );
      delete envelope.targetPressureAudits;
      delete envelope.resourceOpportunityAudits;
      const behaviorLayerSemanticHashes =
        fields?.behaviorLayerSemanticHashes &&
        Object.keys(fields.behaviorLayerSemanticHashes).length
          ? {
              ...cloneValue(fields.behaviorLayerSemanticHashes),
              paretoRelationsHash:
                `pareto:${previewRuntime.stableHash(
                  (
                    Array.isArray(decisionResult?.candidateAudit)
                      ? decisionResult.candidateAudit
                      : []
                  ).map(candidate => ({
                    candidateId: String(
                      candidate?.candidateId || '',
                    ).trim(),
                    classification: String(
                      candidate?.classification || '',
                    ).trim(),
                    dominatedBy: String(
                      candidate?.dominatedBy || '',
                    ).trim(),
                    rejectionCode: String(
                      candidate?.rejectionCode || '',
                    ).trim(),
                    vector: cloneValue(candidate?.vector || {}),
                  })),
                )}`,
            }
          : {};
      decisionPerformanceDiagnostics.push({
        index: decisionPerformanceDiagnostics.length,
        round: Number(fields?.round || 0),
        actorId: String(fields?.actorId || '').trim(),
        actionRole: normalizeActionRole(fields?.actionRole || 'ACTIVE'),
        nodeKind: String(fields?.nodeKind || '').trim(),
        opportunitySequence: Math.max(
          0,
          Number(fields?.opportunitySequence || 0),
        ),
        timing: cloneValue(fields?.timing || {}),
        candidateCount: Math.max(
          0,
          Number(decisionResult?.candidateCount || 0),
        ),
        routeCacheMetrics: cloneValue(
          decisionResult?.routeCacheMetrics || {},
        ),
        routeFactOwnershipSummary: cloneValue(
          fields?.routeFactOwnershipSummary || {},
        ),
        behaviorLayerSemanticHashes,
        evaluationSessionObservation: cloneValue(
          fields?.evaluationSessionObservation || {},
        ),
        candidateEnvelopeMetrics: envelope,
      });
    };
    const beliefObservations = [];
    const beliefByActor = new Map();
    const predictedEvidenceByActionId = new Map();
    const strategyByActor = new Map();
    const strategicHistoryByActor = new Map();
    const logs = [];
    const initialSnapshot = getBattleSnapshot(combatData);
    const eventOwnedEvaluationEnabled = false;
    const verifyEventOwnedFactDelta =
      eventOwnedEvaluationEnabled &&
      input?.settings?.verifyEventOwnedFactDelta === true;
    const setVisibleBelief = (actorId, nextBelief) => {
      const normalizedActorId = String(actorId || '').trim();
      const existedBefore = beliefByActor.has(normalizedActorId);
      const previousBelief = existedBefore
        ? beliefByActor.get(normalizedActorId)
        : undefined;
      beliefByActor.set(normalizedActorId, nextBelief);
      if (eventOwnedEvaluationEnabled) {
        recordRuntimeVisibleBeliefChange(
          combatData,
          normalizedActorId,
          previousBelief,
          nextBelief,
          existedBefore,
        );
      }
      return nextBelief;
    };
    const evaluationSessionEnabled = false;
    const initialEvaluationRuntimeSnapshot =
      evaluationSessionEnabled
        ? eventOwnedEvaluationEnabled
          ? buildEventOwnedRuntimeSnapshot(combatData)
          : buildRuntimeDecisionSnapshot(combatData)
        : null;
    const evaluationSession = evaluationSessionEnabled
      ? decisionRuntime.createEvaluationSession({
          objectiveHash: previewRuntime.stableHash(
            combatData?.胜负条件 || {},
          ),
          visibleWorldRevision:
            eventOwnedEvaluationEnabled
              ? 'visible-journal:0'
              : `visible:${previewRuntime.stableHash(combatData)}`,
          beliefRevision: 'belief:initial',
          opportunityRevision: String(
            initialEvaluationRuntimeSnapshot?.opportunityRevision || '',
          ).trim(),
          resourceTimelineRevision: String(
            initialEvaluationRuntimeSnapshot?.resourceTimelineRevision || '',
          ).trim(),
          scheduleRevision: String(
            initialEvaluationRuntimeSnapshot?.scheduleRevision || '',
          ).trim(),
        })
      : null;
    let evaluationFactDeltaSequence = 0;
    let lastEvaluationFactState =
      evaluationSession &&
      (!eventOwnedEvaluationEnabled || verifyEventOwnedFactDelta)
      ? {
          ...captureEvaluationFactState(
            combatData,
            initialEvaluationRuntimeSnapshot,
            beliefByActor,
          ),
          runtimeSnapshot: initialEvaluationRuntimeSnapshot,
        }
      : null;
    const comparableFactDelta = batch => ({
      sourceEventIds: [...(batch?.sourceEventIds || [])],
      changedFactKeys: [...(batch?.changedFactKeys || [])].sort(),
      opportunityChanges: (batch?.opportunityChanges || [])
        .map(change => ({
          opportunityId: String(change?.opportunityId || '').trim(),
          changeType: String(change?.changeType || '').trim(),
        }))
        .sort((left, right) =>
          left.opportunityId.localeCompare(right.opportunityId)
        ),
      resourceTimelineChanges: (batch?.resourceTimelineChanges || [])
        .map(change => ({
          eventId: String(change?.eventId || '').trim(),
          changeType: String(change?.changeType || '').trim(),
        }))
        .sort((left, right) => left.eventId.localeCompare(right.eventId)),
      scheduleChanges: (batch?.scheduleChanges || [])
        .map(change => ({
          descriptorId: String(change?.descriptorId || '').trim(),
          changeType: String(change?.changeType || '').trim(),
        }))
        .sort((left, right) =>
          left.descriptorId.localeCompare(right.descriptorId)
        ),
      visibleBeliefChanges: (batch?.visibleBeliefChanges || [])
        .map(change => ({
          actorId: String(change?.actorId || '').trim(),
          changeType: String(change?.changeType || '').trim(),
        }))
        .sort((left, right) => left.actorId.localeCompare(right.actorId)),
      terminalReached: batch?.terminalReached === true,
    });
    const advanceRuntimeEvaluationSession = (
      runtimeSnapshot,
      terminalReached = false,
    ) => {
      if (!evaluationSession) return null;
      const sequence = ++evaluationFactDeltaSequence;
      if (eventOwnedEvaluationEnabled) {
        const journalBatch = drainRuntimeFactDeltaBatch(combatData, {
          sequence,
          terminalReached,
          runtimeSnapshot,
        });
        if (verifyEventOwnedFactDelta) {
          const current = {
            ...captureEvaluationFactState(
              combatData,
              runtimeSnapshot,
              beliefByActor,
            ),
            runtimeSnapshot,
          };
          const scanBatch = buildEvaluationFactDeltaBatch({
            previous: lastEvaluationFactState,
            current,
            sequence,
            terminalReached,
          });
          lastEvaluationFactState = current;
          const journalComparable = comparableFactDelta(journalBatch);
          const scanComparable = comparableFactDelta(scanBatch);
          if (
            JSON.stringify(journalComparable) !==
              JSON.stringify(scanComparable)
          ) {
            throw new Error(
              `EVENT_OWNED_FACT_DELTA_MISMATCH:${JSON.stringify({
                sequence,
                journal: journalComparable,
                scan: scanComparable,
              })}`,
            );
          }
          journalBatch.verification = 'SCAN_EQUIVALENT';
        }
        return decisionRuntime.advanceEvaluationSession(
          evaluationSession,
          journalBatch,
        );
      }
      const current = {
        ...captureEvaluationFactState(
          combatData,
          runtimeSnapshot,
          beliefByActor,
        ),
        runtimeSnapshot,
      };
      const batch = buildEvaluationFactDeltaBatch({
        previous: lastEvaluationFactState,
        current,
        sequence,
        terminalReached,
      });
      lastEvaluationFactState = current;
      return decisionRuntime.advanceEvaluationSession(
        evaluationSession,
        batch,
      );
    };
    let playerLockedActionConsumed = false;
    let roundsExecuted = 0;
    const executedRoundNumbers = [];
    let terminal = null;
    const naturalActionBudget = 40;
    try {
      for (let roundOffset = 1; roundOffset <= roundLimit; roundOffset += 1) {
        combatData.回合 = Number(source?.回合 || 0) + roundOffset;
        roundsExecuted = roundOffset;
        executedRoundNumbers.push(Number(combatData?.回合 || 0));
        performanceTrace('round-start', {
          round: Number(combatData?.回合 || 0),
          roundOffset,
        });
        logs.push(...beginBattleRound(combatData, combatData.回合).filter(Boolean));
        invalidateRouteUnitHashes(combatData);
        const queueTrace = runtime.actionQueueTrace;
        const naturalEntries = buildActionQueue(combatData);
        performanceTrace('queue-built', {
          round: Number(combatData?.回合 || 0),
          naturalEntryCount: naturalEntries.length,
        });
        initializeNaturalOpportunityStates(naturalEntries, combatData.回合);
        const queue = createActionQueue({
          round: combatData.回合,
          initialEntries: naturalEntries,
          describeActor: entry => previewRuntime.unitName(entry?.char),
          describeActorId: entry => previewRuntime.unitId(entry?.char),
          isRegisteredActor: actorId => listCombatUnits(combatData).some(unit =>
            previewRuntime.unitId(unit) === String(actorId || '').trim()
          ),
          normalizeRole: normalizeActionRole,
          normalizeActionName: normalizeActionDisplayName,
          onTrace: event => queueTrace.push(cloneAuditSnapshot(event)),
          onFatal: fatal => { runtime.actionQueueFatal = cloneAuditSnapshot(fatal); },
          onOpportunityChange: opportunity => {
            const opportunityId = String(
              opportunity?.opportunityId || '',
            ).trim();
            const previousOpportunity =
              runtime.opportunityGraph[opportunityId];
            const nextOpportunity = cloneAuditSnapshot(opportunity);
            runtime.opportunityGraph[opportunityId] = nextOpportunity;
            if (eventOwnedEvaluationEnabled) {
              recordRuntimeOpportunityChange(
                combatData,
                previousOpportunity,
                nextOpportunity,
              );
            }
          },
        });
        const cancelQueueForTerminal = () => {
          queue.cancelPending('BATTLE_TERMINAL').forEach(cancelledNode => {
            if (cancelledNode.nodeKind === 'PRIMARY_SETTLEMENT') {
              const actionContext = cancelledNode?.state?.shared?.actionContext;
              if (!actionContext?.actionEvent?.actionId) return;
              writeLedgerEvent(combatData, {
                eventKind: 'blocked_action',
                round: Number(combatData.回合 || 0),
                actorId: previewRuntime.unitId(actionContext.actor) || '',
                actorName: previewRuntime.unitName(actionContext.actor) || '未知单位',
                targetId: previewRuntime.unitId(actionContext.primaryTarget) || '',
                targetName: previewRuntime.unitName(actionContext.primaryTarget) || '',
                actionName: actionContext.actionName || '行动取消',
                actionType: actionContext.actionKind || 'opportunity_cancelled',
                actorControl: cancelledNode.actorControl,
                actionRole: cancelledNode.actionRole,
                actionId: actionContext.actionEvent.actionId,
                sourceActionId: actionContext.actionEvent.actionId,
                parentNodeId: actionContext.actionEvent.chainNodeId || '',
                result: 'cancelled',
                resultState: 'ABORTED',
                ruleCode: 'BATTLE_TERMINAL',
                meta: { source: 'structured_shadow', grantId: cancelledNode.grantId, reason: 'BATTLE_TERMINAL' },
              });
              return;
            }
            const cancelledKind = String(cancelledNode?.nodeKind || '').trim();
            if (!['ACTIVE', 'CONTINUATION', 'COUNTER', 'ASSIST'].includes(cancelledKind)) return;
            const cancelledActor = cancelledNode?.actorEntry?.char;
            writeLedgerEvent(combatData, {
              eventKind: 'blocked_action',
              round: Number(combatData.回合 || 0),
              actorId: previewRuntime.unitId(cancelledActor) || '',
              actorName: previewRuntime.unitName(cancelledActor) || '未知单位',
              actionName: cancelledKind === 'ACTIVE'
                ? '自然行动取消'
                : cancelledKind === 'CONTINUATION'
                  ? '后继行动取消'
                  : cancelledKind === 'COUNTER'
                    ? '反击取消'
                    : '协同行动取消',
              actionType: 'opportunity_cancelled',
              actorControl: cancelledNode.actorControl,
              actionRole: cancelledNode.actionRole,
              sourceActionId: cancelledNode.sourceActionId,
              result: 'cancelled',
              resultState: 'ABORTED',
              ruleCode: 'BATTLE_TERMINAL',
              meta: {
                source: 'structured_runtime',
                grantId: cancelledNode.grantId,
                reason: 'BATTLE_TERMINAL',
                reasonText: '本回合在其他行动结算后已满足终局条件',
                cancelledNodeKind: cancelledKind,
              },
            });
          });
        };
        let opportunitySequence = 0;
        const initialBeliefFor = actorId => input?.initialBelief?.[actorId] || input?.initialBelief || {};
        const publicSettlementOutcomeSemantics = (facts = [], sourceSide = '') => {
          const rows = Array.isArray(facts) ? facts.filter(Boolean) : [];
          const targetFor = event => listCombatUnits(combatData).find(unit =>
            isUnitIdentityMatch(unit, event?.targetId || event?.targetName || '')
          );
          const hostileTarget = event => {
            const target = targetFor(event);
            const targetSide = target
              ? inferUnitSide(combatData, previewRuntime.unitName(target))
              : String(event?.targetSide || '').trim();
            return target && targetSide && targetSide !== sourceSide
              ? target
              : null;
          };
          const lethal = rows.some(event => {
            const target = hostileTarget(event);
            if (!target) return false;
            const outcome = [
              event?.result,
              event?.resultState,
              event?.primaryOutcome,
              event?.ruleCode,
            ].map(value => String(value || '').trim()).join('|');
            return !structuredActorPhysicallyAlive(target) ||
              /dead|death|killed|lethal|致死|死亡/i.test(outcome);
          });
          const incapacitating = rows.some(event => {
            const target = hostileTarget(event);
            if (!target || !structuredActorPhysicallyAlive(target)) return false;
            const outcome = [
              event?.eventKind,
              event?.operation,
              event?.result,
              event?.primaryOutcome,
              event?.ruleCode,
              event?.meta?.stateName,
            ].map(value => String(value || '').trim()).join('|');
            return !structuredActorCanAct(target, 'ACTIVE') ||
              /incapacitat|cannot_act|skip_turn|失能|昏迷|眩晕|麻痹|冻结|束缚|禁锢/i.test(
                outcome,
              );
          });
          const cancelsOpportunity = rows.some(event => {
            const signature = [
              event?.eventKind,
              event?.operation,
              event?.outcomeKind,
              event?.result,
              event?.primaryOutcome,
              event?.ruleCode,
            ].map(value => String(value || '').trim()).join('|');
            return /blocked_action|opportunity_cancel|action_cancel|取消机会|行动取消/i.test(
              signature,
            );
          });
          const objectiveResolution = previewRuntime.evaluateBattleObjectives(
            combatData,
            combatData?.胜负条件 || {},
            {
              round: Number(combatData?.回合 || 0),
              roundCompleted: false,
            },
          );
          return {
            lethal,
            incapacitating,
            cancelsOpportunity,
            breaksObjective: objectiveResolution?.terminal === true,
            evidenceEventIds: rows
              .map(event => String(event?.eventId || '').trim())
              .filter(Boolean),
          };
        };
        const recordPublicReactionObservation = ({
          reactor,
          incomingSource,
          declaration,
          reaction,
        }) => {
          if (!reactor || !incomingSource || !declaration || !reaction) return;
          const sourceActorId = previewRuntime.unitId(reactor);
          const incomingSourceActorId = previewRuntime.unitId(incomingSource);
          const sourceSide = inferUnitSide(combatData, previewRuntime.unitName(reactor));
          const actionEvent = reaction?.event || {};
          const actionKind = String(declaration?.actionKind || reaction?.actionKind || '').trim().toUpperCase();
          const actionName = normalizeActionDisplayName(
            actionEvent?.actionName ||
            declaration?.skill?.name ||
            declaration?.skill?.魂技名 ||
            actionKind ||
            '即时反应',
          );
          const facts = [
            actionEvent,
            ...(Array.isArray(reaction?.facts) ? reaction.facts : []),
          ].filter(Boolean);
          const shieldAmount = facts
            .filter(event => String(event?.eventKind || '').trim() === 'shield_create')
            .reduce((sum, event) => sum + Math.max(0, Number(event?.meta?.amount ?? event?.amount ?? 0)), 0);
          const dodgeProbability = actionKind === 'EVADE'
            ? Number(actionEvent?.meta?.probability ?? actionEvent?.meta?.dodgeRate)
            : Number.NaN;
          const damageMultiplier = actionKind === 'EVADE' && Number.isFinite(dodgeProbability)
            ? 1 - dodgeProbability
            : Number(reaction?.damageMultiplier);
          const publicOutcomes = publicSettlementOutcomeSemantics(
            facts,
            sourceSide,
          );
          listPrimaryCombatUnits(combatData).forEach(observer => {
            const observerSide = inferUnitSide(combatData, previewRuntime.unitName(observer));
            if (!observerSide || observerSide === sourceSide) return;
            const observerId = previewRuntime.unitId(observer);
            const previous = beliefByActor.get(observerId) || initialBeliefFor(observerId);
            const next = decisionRuntime.updatePublicObservation(previous, {
              sourceActorId,
              incomingSourceActorId,
              sourceActionId: String(actionEvent?.actionId || actionEvent?.eventId || '').trim(),
              responseId: `REACTION:${actionKind}:${actionName}`,
              responseRole: 'REACTION',
              actionName,
              declaration:
                decisionRuntime.projectPublicResponseDeclaration(declaration),
              baseActionValue: 0,
              damageMultiplier,
              dodgeProbability,
              shieldRatio: shieldAmount / Math.max(1, previewRuntime.readHpMax(reactor)),
              opensCounterCheck: reaction.opensCounterCheck === true,
              preparedDefense: reaction?.event?.meta?.preparedDefenseConsumed === true,
              lethal: publicOutcomes.lethal,
              incapacitating: publicOutcomes.incapacitating,
              cancelsOpportunity: publicOutcomes.cancelsOpportunity,
              breaksObjective: publicOutcomes.breaksObjective,
              evidenceEventIds: publicOutcomes.evidenceEventIds,
              result: facts.map(event => String(event?.result || '')).filter(Boolean).join('|') || 'declared',
            });
            setVisibleBelief(observerId, next);
            const history = strategicHistoryByActor.get(observerId) || [];
            if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
            strategicHistoryByActor.set(observerId, history);
            beliefObservations.push({
              observationType: 'PUBLIC_REACTION',
              round: Number(combatData?.回合 || 0),
              actorId: observerId,
              sourceActorId,
              incomingSourceActorId,
              actionName,
              actionKind,
              damageMultiplier: Number.isFinite(damageMultiplier) ? damageMultiplier : null,
              dodgeProbability: Number.isFinite(dodgeProbability) ? dodgeProbability : null,
              shieldRatio: shieldAmount / Math.max(1, previewRuntime.readHpMax(reactor)),
              confidence: Number(next?.confidence || 0),
              sourceEventId: String(actionEvent?.eventId || '').trim(),
            });
          });
        };
        const registerPredictedEvidence = (actionEvent, decisionResult) => {
          if (!actionEvent?.actionId || !Array.isArray(decisionResult?.selected?.predictedOutcomeEvidence)) return;
          predictedEvidenceByActionId.set(actionEvent.actionId, {
            decisionResult: {
              selected: {
                predictedOutcomeEvidence: decisionResult.selected.predictedOutcomeEvidence,
              },
            },
            sourceActionId: String(actionEvent.sourceActionId || '').trim(),
          });
        };
        const recordSettledBeliefs = (decisionResult, settlement) => {
          const actionEvent = settlement?.actionEvent;
          const settlementFacts = Array.isArray(settlement?.facts) ? settlement.facts : [];
          const settledActionRole = String(
            decisionResult?.actionRole ||
            actionEvent?.actionRole ||
            'ACTIVE',
          ).trim().toUpperCase() || 'ACTIVE';
          const matchesSettledAction = event => {
            if (!event || !actionEvent) return false;
            const actionIds = new Set([
              String(actionEvent?.actionId || '').trim(),
              String(actionEvent?.sourceActionId || '').trim(),
            ].filter(Boolean));
            const eventIds = [
              event?.actionId,
              event?.sourceActionId,
            ].map(value => String(value || '').trim()).filter(Boolean);
            if (eventIds.some(value => actionIds.has(value))) return true;
            return isUnitIdentityMatch(event?.actorName || event?.actorId || '', actionEvent?.actorName || '') &&
              normalizeActionDisplayName(event?.actionName || event?.actionType || '') ===
                normalizeActionDisplayName(actionEvent?.actionName || actionEvent?.actionType || '');
          };
          const actorId = String(decisionResult?.actorId || '').trim();
          if (actorId) {
            (decisionResult?.selected?.mechanicObservations || []).forEach(observation => {
              const withdrawalObservation = observation?.effectPrototype === '撤离判定';
              const hitObservation = observation?.effectPrototype === '命中判定';
              const events = hitObservation
                ? settlementFacts.filter(item =>
                    item?.eventKind === 'hit_result' &&
                    matchesSettledAction(item) &&
                    isUnitIdentityMatch(item?.targetName || item?.targetId || '', observation?.targetId || '') &&
                    Number(item?.meta?.effectIndex ?? item?.effectIndex ?? -1) === Number(observation?.effectIndex ?? -2)
                  )
                : [settlementFacts.find(item => withdrawalObservation
                    ? item?.actionType === 'WITHDRAW' &&
                      ['withdrawn', 'failed'].includes(String(item?.result || '').trim()) &&
                      matchesSettledAction(item)
                    : item?.eventKind === 'state_apply' &&
                      matchesSettledAction(item) &&
                      isUnitIdentityMatch(item?.targetName || item?.targetId || '', observation?.targetId || '') &&
                      String(item?.meta?.stateName || '').trim() === String(observation?.stateName || '').trim()
                )].filter(Boolean);
              events.forEach(event => {
                const success = hitObservation
                  ? String(event?.result || '').trim().toLowerCase() === 'hit'
                  : withdrawalObservation
                    ? String(event?.result || '').trim() === 'withdrawn'
                    : String(event?.result || '').trim() === 'applied';
                const previous = beliefByActor.get(actorId) || initialBeliefFor(actorId);
                const next = decisionRuntime.updateMechanicBelief(previous, { ...observation, success });
                setVisibleBelief(actorId, next);
                const history = strategicHistoryByActor.get(actorId) || [];
                if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
                strategicHistoryByActor.set(actorId, history);
                const record = next?.mechanics?.[observation.mechanicKey] || {};
                const posterior = Number(record.alpha || 0) / Math.max(0.0001, Number(record.alpha || 0) + Number(record.beta || 0));
                beliefObservations.push({
                  observationType: 'MECHANIC_RESULT',
                  round: Number(combatData?.回合 || 0),
                  actorId,
                  actionRole: settledActionRole,
                  candidateId: String(observation?.sourceActionId || '').trim(),
                  mechanicKey: observation.mechanicKey,
                  effectPrototype: String(observation?.effectPrototype || '').trim(),
                  effectIndex: Number.isFinite(Number(observation?.effectIndex)) ? Number(observation.effectIndex) : null,
                  damageClass: String(observation?.damageClass || '').trim(),
                  targetId: observation.targetId,
                  stateName: observation.stateName,
                  success,
                  posterior,
                  sourceEventId: String(event?.eventId || '').trim(),
                });
              });
            });
          }
          if (!actionEvent?.actionId) return;
          const parentPrediction = predictedEvidenceByActionId.get(
            String(actionEvent?.sourceActionId || '').trim(),
          );
          const evidenceSource = decisionResult?.selected?.predictedOutcomeEvidence
            ? decisionResult
            : parentPrediction?.decisionResult || null;
          const sourceActor = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, actionEvent.actorName));
          if (!sourceActor) return;
          const sourceActorId = previewRuntime.unitId(sourceActor);
          const sourceSide = inferUnitSide(combatData, previewRuntime.unitName(sourceActor));
          const settledActionName = normalizeActionDisplayName(actionEvent.actionName || actionEvent.actionType || '行动');
          if (settledActionRole === 'ASSIST' && !decisionResult?.selected?.predictedOutcomeEvidence) {
            const host = sourceActor?.__宿主 && previewRuntime.isBattleCapable(sourceActor.__宿主)
              ? sourceActor.__宿主
              : null;
            const hostId = previewRuntime.unitId(host);
            const assistPredictions = (evidenceSource?.selected?.predictedOutcomeEvidence || []).filter(evidence =>
              String(evidence?.executionRole || '').trim().toUpperCase() === 'ASSIST' &&
              String(evidence?.outcomeKind || '').trim() === 'HP_DELTA' &&
              Number(evidence?.expectedValuePercent || 0) > 0
            );
            if (hostId && assistPredictions.length) {
              settlementFacts
                .filter(event => String(event?.eventKind || '').trim() === 'hit_result')
                .forEach(event => {
                  const target = listCombatUnits(combatData).find(unit =>
                    isUnitIdentityMatch(unit, event?.targetId || event?.targetName)
                  );
                  if (!target) return;
                  const targetId = previewRuntime.unitId(target);
                  const damageType = String(event?.meta?.damageType || '').trim();
                  const className = /真实/.test(damageType)
                    ? 'TRUE'
                    : /精神/.test(damageType)
                      ? 'MENTAL'
                      : /远程/.test(damageType)
                        ? 'RANGED'
                        : 'MELEE';
                  const predicted = assistPredictions.find(evidence => {
                    const evidenceClass = /真实/.test(String(evidence?.damageType || ''))
                      ? 'TRUE'
                      : /精神/.test(String(evidence?.damageType || ''))
                        ? 'MENTAL'
                        : /远程/.test(String(evidence?.damageType || ''))
                          ? 'RANGED'
                          : 'MELEE';
                    return String(evidence?.targetId || '').trim() === targetId && evidenceClass === className;
                  });
                  if (!predicted) return;
                  const sourceEffectId = String(predicted?.sourceEffectId || '').trim();
                  const effectIndex = Number(sourceEffectId.match(/:effect:(\d+)$/)?.[1] || 0);
                  const mechanicSourceActionId = sourceEffectId.replace(/:effect:\d+$/, '') || String(actionEvent?.sourceActionId || actionEvent?.actionId || '').trim();
                  const previous = beliefByActor.get(hostId) || initialBeliefFor(hostId);
                  const mechanicKey = decisionRuntime.hitMechanicKey({
                    sourceActionId: mechanicSourceActionId,
                    effectIndex,
                    effect: { 伤害类型: predicted?.damageType || damageType },
                    targetId,
                    beliefState: previous,
                  });
                  const success = String(event?.result || '').trim().toLowerCase() === 'hit';
                  const next = decisionRuntime.updateMechanicBelief(previous, {
                    mechanicKey,
                    estimatedProbability: Number(predicted?.hitProbability ?? 0.65),
                    success,
                  });
                  setVisibleBelief(hostId, next);
                  const history = strategicHistoryByActor.get(hostId) || [];
                  if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
                  strategicHistoryByActor.set(hostId, history);
                  const record = next?.mechanics?.[mechanicKey] || {};
                  const posterior = Number(record.alpha || 0) / Math.max(0.0001, Number(record.alpha || 0) + Number(record.beta || 0));
                  beliefObservations.push({
                    observationType: 'MECHANIC_RESULT',
                    round: Number(combatData?.回合 || 0),
                    actorId: hostId,
                    actionRole: 'ASSIST',
                    candidateId: mechanicSourceActionId,
                    mechanicKey,
                    effectPrototype: '命中判定',
                    effectIndex,
                    damageClass: className,
                    targetId,
                    success,
                    posterior,
                    sourceEventId: String(event?.eventId || '').trim(),
                  });
                });
            }
          }
          const baseActionValue = (settlement?.facts || []).reduce((sum, event) => {
            const eventKind = String(event?.eventKind || '').trim();
            const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
            const target = listPrimaryCombatUnits(combatData).find(unit =>
              isUnitIdentityMatch(unit, event?.targetId || event?.targetName)
            );
            if (!target) return sum;
            const targetSide = inferUnitSide(combatData, previewRuntime.unitName(target));
            const hostileTarget = !!targetSide && targetSide !== sourceSide;
            if (eventKind === 'hit_result' && hostileTarget) {
              const appliedDamage = Math.max(0, Number(event?.appliedDamage || meta?.appliedDamage || 0));
              return sum + 100 * appliedDamage / Math.max(1, previewRuntime.readHpMax(target));
            }
            if (eventKind === 'resource_change') {
              const delta = Number(meta?.delta ?? event?.delta ?? 0);
              const resourceKey = String(meta?.resourceKey || event?.resourceKey || '').trim();
              const resource = String(meta?.resource || event?.resource || '').trim();
              if (!delta || !resourceKey) return sum;
              if (hostileTarget && delta < 0) {
                const maximum = Math.max(1, persistentResourceMax(target, resourceKey));
                const depleted = ['sp', 'men', 'vit'].includes(resourceKey) &&
                  persistentResourceValue(target, resourceKey) <= 0;
                return sum + 100 * Math.abs(delta) / maximum + (depleted ? 25 : 0);
              }
              if (!hostileTarget && delta > 0) {
                const maximum = /生命|HP/i.test(resource)
                  ? previewRuntime.readHpMax(target)
                  : Math.max(1, persistentResourceMax(target, resourceKey));
                return sum + 100 * delta / maximum;
              }
              return sum;
            }
            if (eventKind === 'shield_create' && !hostileTarget) {
              const amount = Math.max(0, Number(meta?.amount ?? event?.amount ?? 0));
              return sum + 100 * amount / Math.max(1, previewRuntime.readHpMax(target));
            }
            if (
              eventKind === 'state_apply' &&
              hostileTarget &&
              String(event?.result || '').trim() === 'applied'
            ) {
              const combatEffect = previewRuntime.deriveStateCombatEffect({
                状态: String(meta?.stateName || event?.stateName || '').trim(),
              });
              if (combatEffect?.skip_turn === true || combatEffect?.cannot_act === true) return sum + 50;
            }
            return sum;
          }, 0);
          const hpDamageValue = (settlement?.facts || []).reduce((sum, event) => {
            if (String(event?.eventKind || '').trim() !== 'hit_result') return sum;
            const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
            const target = listPrimaryCombatUnits(combatData).find(unit =>
              isUnitIdentityMatch(unit, event?.targetId || event?.targetName)
            );
            if (!target) return sum;
            const targetSide = inferUnitSide(combatData, previewRuntime.unitName(target));
            if (!targetSide || targetSide === sourceSide) return sum;
            const appliedDamage = Math.max(0, Number(event?.appliedDamage || meta?.appliedDamage || 0));
            return sum + 100 * appliedDamage / Math.max(1, previewRuntime.readHpMax(target));
          }, 0);
          const publicOutcomes = publicSettlementOutcomeSemantics(
            settlementFacts,
            sourceSide,
          );
          const publicDeclaration =
            decisionRuntime.projectPublicResponseDeclaration(
              decisionResult?.selected?.declaration || {},
            );
          const predictedDamageByTarget = new Map();
          const childSettlement = settledActionRole === 'ASSIST' && !decisionResult?.selected?.predictedOutcomeEvidence;
          (evidenceSource?.selected?.predictedOutcomeEvidence || []).filter(evidence => {
            const executionRole = String(evidence?.executionRole || 'PRIMARY').trim().toUpperCase();
            return childSettlement ? executionRole === 'ASSIST' : executionRole !== 'ASSIST';
          }).forEach(evidence => {
            if (String(evidence?.outcomeKind || '').trim() !== 'HP_DELTA') return;
            const targetId = String(evidence?.targetId || '').trim();
            const className = /真实/.test(String(evidence?.damageType || ''))
              ? 'TRUE'
              : /精神/.test(String(evidence?.damageType || ''))
                ? 'MENTAL'
                : /远程/.test(String(evidence?.damageType || ''))
                  ? 'RANGED'
                  : 'MELEE';
            const probabilityScale =
              Math.max(0.0001, Number(evidence?.hitProbability ?? 1)) *
              Math.max(0.0001, Number(evidence?.reactionDamageMultiplier ?? 1));
            const predictedRawPercent = Math.max(0, Number(evidence?.expectedValuePercent || 0)) / probabilityScale;
            if (!targetId || !(predictedRawPercent > 0)) return;
            const key = `${targetId}|${className}`;
            const current = predictedDamageByTarget.get(key) || {
              targetId,
              damageClass: className,
              predictedValuePercent: 0,
            };
            current.predictedValuePercent += predictedRawPercent;
            predictedDamageByTarget.set(key, current);
          });
          const actualDamageByTarget = new Map();
          (settlement?.facts || []).forEach(event => {
            if (String(event?.eventKind || '').trim() !== 'hit_result') return;
            // 必须用 appliedDamage（实际扣血）而不是 rawDamage。
            // rawDamage 是 :6726 写入的 segmentDamage —— 裁剪前、护盾前、减伤前的理论值；
            // 而预测侧的 expectedValuePercent 是按目标剩余生命裁剪过的 HP 损失。
            // 两者量纲不同：实测 duel_charge_defense_safer 中同一次命中
            // rawDamage 24449.7 对 appliedDamage 160，比值 152.8 倍，
            // 会让 TARGET_REALIZATION 信念系统性学到「此攻击者远低于预期」。
            const rawDamage = Math.max(
              0,
              Number(event?.meta?.appliedDamage ?? event?.meta?.rawDamage ?? 0),
            );
            const hitObservedDamage = Math.max(0, Number(event?.meta?.rawDamage || 0));
            const target = listCombatUnits(combatData).find(unit =>
              isUnitIdentityMatch(unit, event?.targetId || event?.targetName)
            );
            if (!target) return;
            const targetId = previewRuntime.unitId(target);
            const damageType = String(event?.meta?.damageType || '').trim();
            const className = /真实/.test(damageType)
              ? 'TRUE'
              : /精神/.test(damageType)
                ? 'MENTAL'
                : /远程/.test(damageType)
                  ? 'RANGED'
                  : 'MELEE';
            const key = `${targetId}|${className}`;
            const current = actualDamageByTarget.get(key) || {
              targetId,
              damageClass: className,
              actualValuePercent: 0,
              hitObserved: false,
              sourceEventId: String(event?.eventId || '').trim(),
            };
            // 命中判定仍用未裁剪值：护盾全吸或目标已见底时 appliedDamage 可能为 0，
            // 但那依然是一次命中，不能因此把观测丢掉。
            if (String(event?.result || '').trim() === 'hit' || hitObservedDamage > 0) {
              current.hitObserved = true;
            }
            if (rawDamage > 0) {
              current.actualValuePercent += 100 * rawDamage / Math.max(1, previewRuntime.readHpMax(target));
            }
            actualDamageByTarget.set(key, current);
          });
          predictedDamageByTarget.forEach((predicted, key) => {
            if (actualDamageByTarget.has(key)) return;
            actualDamageByTarget.set(key, {
              targetId: predicted.targetId,
              damageClass: predicted.damageClass,
              actualValuePercent: 0,
              hitObserved: false,
              sourceEventId: String(actionEvent?.eventId || '').trim(),
            });
          });
          actualDamageByTarget.forEach((actual, key) => {
            const predicted = predictedDamageByTarget.get(key);
            if (!predicted || !(predicted.predictedValuePercent > 0) || actual.hitObserved !== true) return;
            listPrimaryCombatUnits(combatData).forEach(observer => {
              const observerSide = inferUnitSide(combatData, previewRuntime.unitName(observer));
              if (!observerSide || observerSide !== sourceSide) return;
              const observerId = previewRuntime.unitId(observer);
              const previous = beliefByActor.get(observerId) || initialBeliefFor(observerId);
              const next = decisionRuntime.updateTargetRealizationBelief(previous, {
                targetId: actual.targetId,
                damageClass: actual.damageClass,
                predictedValuePercent: predicted.predictedValuePercent,
                actualValuePercent: actual.actualValuePercent,
                sourceEventId: actual.sourceEventId,
              });
              setVisibleBelief(observerId, next);
              const history = strategicHistoryByActor.get(observerId) || [];
              if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
              strategicHistoryByActor.set(observerId, history);
              const record = next?.targetRealization?.[key] || {};
              beliefObservations.push({
                observationType: 'TARGET_REALIZATION',
                round: Number(combatData?.回合 || 0),
                actorId: observerId,
                sourceActorId,
                targetId: actual.targetId,
                damageClass: actual.damageClass,
                predictedValuePercent: predicted.predictedValuePercent,
                actualValuePercent: actual.actualValuePercent,
                meanRatio: Number(record?.meanRatio || 0),
                observations: Number(record?.observations || 0),
                sourceEventId: actual.sourceEventId,
              });
            });
          });
          listPrimaryCombatUnits(combatData).forEach(observer => {
            const observerSide = inferUnitSide(combatData, previewRuntime.unitName(observer));
            if (!observerSide || observerSide === sourceSide) return;
            const observerId = previewRuntime.unitId(observer);
            const previous = beliefByActor.get(observerId) || initialBeliefFor(observerId);
            const next = decisionRuntime.updatePublicObservation(previous, {
              sourceActorId,
              sourceActionId: actionEvent.actionId,
              responseId: `${settledActionRole}:${settledActionName}`,
              responseRole: settledActionRole,
              actionName: settledActionName,
              declaration: publicDeclaration,
              baseActionValue,
              hpDamageValue,
              lethal: publicOutcomes.lethal,
              incapacitating: publicOutcomes.incapacitating,
              cancelsOpportunity: publicOutcomes.cancelsOpportunity,
              breaksObjective: publicOutcomes.breaksObjective,
              evidenceEventIds: publicOutcomes.evidenceEventIds,
              result: (settlement?.facts || []).map(event => String(event?.result || '')).filter(Boolean).join('|') || 'declared',
            });
            setVisibleBelief(observerId, next);
            const history = strategicHistoryByActor.get(observerId) || [];
            if (history.length) history[history.length - 1] = { ...history[history.length - 1], newInformation: true };
            strategicHistoryByActor.set(observerId, history);
            beliefObservations.push({
              observationType: 'PUBLIC_ACTION',
              round: Number(combatData?.回合 || 0),
              actorId: observerId,
              sourceActorId,
              actionName: settledActionName,
              actionRole: settledActionRole,
              baseActionValue,
              hpDamageValue,
              confidence: Number(next?.confidence || 0),
              sourceEventId: String(actionEvent?.eventId || '').trim(),
            });
          });
        };
        const decideForNode = (actor, node, extras = {}) => {
          const decisionStartedAt = performanceNow();
          let routeFactOwnershipSummary = {};
          let behaviorLayerSemanticHashes = {};
          let evaluationSessionObservation = {};
          const actorId = previewRuntime.unitId(actor);
          const actorSide = inferUnitSide(combatData, previewRuntime.unitName(actor));
          const pendingNaturalUnits = [...listPrimaryCombatUnits(combatData), ...listSummonCombatUnits(combatData)]
            .filter(unit => {
              const opportunity = unit?.__battleRuntime?.naturalOpportunity;
              return Number(opportunity?.round || 0) === Number(combatData?.回合 || 0) &&
                String(opportunity?.status || '').trim() === 'PENDING' &&
                structuredActorCanAct(unit, 'ACTIVE');
            });
          const pendingNaturalActorIds = [...new Set(pendingNaturalUnits.map(previewRuntime.unitId).filter(Boolean))];
          const pendingHostileActorIds = [...new Set(pendingNaturalUnits
            .filter(unit => inferUnitSide(combatData, previewRuntime.unitName(unit)) !== actorSide)
            .map(previewRuntime.unitId)
            .filter(Boolean))];
          const futureHostileResponseAllowed = roundOffset < roundLimit || queue.hasPending(pendingNode => {
            if (String(pendingNode?.nodeKind || 'ACTIVE').trim() !== 'ACTIVE') return false;
            const pendingActor = pendingNode?.actorEntry?.char;
            if (!pendingActor || !structuredActorCanAct(pendingActor, pendingNode.actionRole)) return false;
            const pendingSide = inferUnitSide(combatData, previewRuntime.unitName(pendingActor));
            return !!pendingSide && pendingSide !== actorSide;
          });
          const queuedOpportunitySequence = Math.max(0, Number(node?.opportunitySequence || 0));
          const decisionOpportunitySequence = queuedOpportunitySequence || ++opportunitySequence;
          opportunitySequence = Math.max(opportunitySequence, decisionOpportunitySequence);
          const decisionInput = {
            worldSnapshot: combatData,
            actorId,
            playerLockedDeclaration: extras.playerLockedDeclaration || null,
            actionOpportunity: {
              role: normalizeActionRole(extras.role || node.actionRole),
              sequence: decisionOpportunitySequence,
              opportunityId: String(node?.opportunityId || node?.grantId || '').trim(),
              grantId: node.grantId,
              futureHostileResponseAllowed,
              pendingNaturalActorIds,
              pendingHostileActorIds,
              naturalActionBudget,
              battleHorizon: {
                currentRound: Number(combatData?.回合 || 0),
                finalRound: battleFinalRound,
                remainingRounds: Math.max(0, battleFinalRound - Number(combatData?.回合 || 0)),
                naturalActionBudget,
              },
              ...extras,
            },
            battleIntent: { mode: String(combatData?.战斗意图 || '').trim(), objectives: combatData?.胜负条件 || {} },
            beliefState: beliefByActor.get(actorId) || initialBeliefFor(actorId),
            teamIntent: input?.teamIntent || {},
            strategyMemory: strategyByActor.get(actorId) || runtime.strategyMemory?.[actorId] || {},
            strategicHistory: strategicHistoryByActor.get(actorId) || [],
            seed: `${seed}:${combatData.回合}:${decisionOpportunitySequence}`,
          };
          performanceTrace('decision-start', {
            round: Number(combatData?.回合 || 0),
            actorId,
            actionRole: normalizeActionRole(extras.role || node.actionRole),
            opportunitySequence: decisionOpportunitySequence,
            nodeKind: String(node?.nodeKind || '').trim(),
            decisionIndex: decisionPerformanceDiagnostics.length,
          });
          const contextPreparedAt = performanceNow();
          let decisionResult;
          let decisionTiming = {};
          let decisionRuntimeSnapshot = null;
          if (playerLockedSettlement) {
            const lockedDeclaration = extras.playerLockedDeclaration && typeof extras.playerLockedDeclaration === 'object'
              ? cloneValue(extras.playerLockedDeclaration)
              : null;
            const actionRole = normalizeActionRole(extras.role || node.actionRole);
            const noFormalProviderPass = {
              candidateId: actorId + ':NO_FORMAL_PROVIDER_PASS',
              actionKind: 'PASS_OPPORTUNITY',
              actorId,
              targetIds: [],
              declaration: { actorId, actionKind: 'PASS_OPPORTUNITY', targetIds: [] },
              selected: true,
              playerLocked: false,
              selectionMode: 'NO_FORMAL_PROVIDER_PASS',
              passReason: 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
              reason: 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
              reasonCode: 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
            };
            // Without a formal provider the only synthetic result of a counter
            // window is an explicit counter decline; every other synthetic
            // pass is a plain pass. Both flags are explicit declarations and
            // are never derived from the generic actionRole expression.
            const selectedForAudit = lockedDeclaration
              ? {
                  candidateId: actorId + ':PLAYER_LOCKED:' + String(lockedDeclaration?.actionKind || 'ACTION').trim(),
                  actionKind: String(lockedDeclaration?.actionKind || '').trim(),
                  actorId,
                  targetIds: Array.isArray(lockedDeclaration?.targetIds)
                    ? cloneValue(lockedDeclaration.targetIds)
                    : [],
                  declaration: cloneValue(lockedDeclaration),
                  selected: true,
                  playerLocked: true,
                  selectionMode: 'PLAYER_LOCKED',
                }
              : actionRole === 'COUNTER'
                ? { ...noFormalProviderPass, counterDeclineFallback: true }
                : { ...noFormalProviderPass, counterDeclineFallback: false };
            decisionResult = {
              schemaVersion: 'NO_FORMAL_PROVIDER_PLAYER_LOCKED_DECISION_V1',
              decisionEngine: 'NO_FORMAL_PROVIDER',
              providerId: '',
              round: Number(combatData?.回合 || 0),
              actorId,
              actionRole,
              actorControl: lockedDeclaration ? 'PLAYER_LOCKED' : node.actorControl,
              opportunityId: String(node?.opportunityId || '').trim(),
              grantId: String(node?.grantId || '').trim(),
              opportunitySequence: decisionOpportunitySequence,
              candidateCount: 1,
              beliefState: decisionInput.beliefState || {},
              teamIntent: {},
              strategyMemory: strategyByActor.get(actorId) || runtime.strategyMemory?.[actorId] || {},
              candidateAudit: [cloneValue(selectedForAudit)],
              scoreAudit: [cloneValue(selectedForAudit)],
              selected: cloneValue(selectedForAudit),
              lostOpportunity: null,
              passReason: lockedDeclaration ? '' : 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
              reasonCode: lockedDeclaration ? '' : 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
              decisionProfile: {
                engine: 'NO_FORMAL_PROVIDER',
                selectionMode: lockedDeclaration ? 'PLAYER_LOCKED' : 'NO_FORMAL_PROVIDER_PASS',
                selectionPath: lockedDeclaration ? 'PLAYER_LOCKED' : 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
                passReason: lockedDeclaration ? '' : 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED',
              },
              alternatives: [],
            };
           decisionTiming = {
             totalMs: Number((performanceNow() - decisionStartedAt).toFixed(3)),
             neutralDecisionMs: Number((performanceNow() - contextPreparedAt).toFixed(3)),
             queueDecisionIndex: decisionPerformanceDiagnostics.length,
           };
          } else if (providerId) {
            const preparedRequest = decisionRuntime.prepareDecisionRequest({
              ...decisionInput,
              analysisDepth: 'CANDIDATES_ONLY',
            });
            decisionResult = decisionRuntime.runProvider({
              providerId,
              request: preparedRequest,
            }).decisionAudit;
          } else if (testLinearProvider) {
            decisionResult = decisionRuntime.runR9v2LinearProviderForTest({
              ...decisionInput,
              __r9v2LinearTest: true,
            });
          } else {
            throw new Error('NO_FORMAL_PROVIDER');
          }

          decisionResult = decisionResult && typeof decisionResult === 'object'
            ? {
                ...decisionResult,
                selected: decisionResult.selected && typeof decisionResult.selected === 'object'
                  ? { ...decisionResult.selected }
                  : decisionResult.selected,
              }
            : decisionResult;
          if (!decisionResult?.selected?.declaration) {
            const lostOpportunity = decisionResult?.lostOpportunity;
            if (!lostOpportunity?.reasonCode) {
              throw new Error(`battle_structured_decision_missing:${actorId}:${node.nodeKind}`);
            }
            const naturalOpportunity = actor?.__battleRuntime?.naturalOpportunity;
            if (
              naturalOpportunity &&
              String(naturalOpportunity?.status || '').trim() === 'PENDING'
            ) {
              naturalOpportunity.status = 'LOST';
              naturalOpportunity.reason = lostOpportunity.reasonCode;
            }
            setVisibleBelief(
              actorId,
              decisionResult.beliefState || beliefByActor.get(actorId) || initialBeliefFor(actorId),
            );
            strategyByActor.set(actorId, decisionResult.strategyMemory || {});
            const history = strategicHistoryByActor.get(actorId) || [];
            history.push({
              signature: String(decisionResult?.strategicSignature || '').trim(),
              actionFamily: 'LOST_OPPORTUNITY',
              actionRole: normalizeActionRole(extras.role || node.actionRole),
              targetIds: [],
              opportunitySequence: decisionOpportunitySequence,
              capacityTotal: Math.max(0, Number(decisionResult?.stateCapacityTotal || 0)),
              capacityChangePercent: 0,
              beliefRevision: String(decisionResult?.beliefRevision || '').trim(),
              newInformation: false,
              pendingEffect: decisionResult?.pendingStrategicEffect === true,
              lostOpportunityReason: lostOpportunity.reasonCode,
            });
            strategicHistoryByActor.set(actorId, history.slice(-4));
            writeLedgerEvent(combatData, {
              eventKind: 'lost_opportunity',
              round: Number(combatData?.回合 || 0),
              actorId,
              actorName: previewRuntime.unitName(actor),
              targetId: actorId,
              targetName: previewRuntime.unitName(actor),
              actorSide,
              targetSide: actorSide,
              actionName: '失去行动',
              actionType: 'opportunity_cancelled',
              actorControl: extras.playerLockedDeclaration ? 'PLAYER_LOCKED' : node.actorControl,
              actionRole: normalizeActionRole(extras.role || node.actionRole),
              sourceActionId: String(node?.sourceActionId || '').trim(),
              parentNodeId: String(node?.state?.shared?.actionContext?.actionEvent?.chainNodeId || '').trim(),
              result: 'cancelled',
              resultState: 'FAILURE',
              ruleCode: lostOpportunity.reasonCode,
              opportunityId: String(
                node?.opportunityId ||
                lostOpportunity?.opportunityId ||
                node?.grantId ||
                lostOpportunity?.grantId ||
                '',
              ).trim(),
              grantId: String(node?.grantId || lostOpportunity.grantId || '').trim(),
              meta: {
                source: 'structured_decision',
                reasonCode: lostOpportunity.reasonCode,
                reasonText: lostOpportunity.reasonText,
                opportunityId: String(
                  node?.opportunityId ||
                  lostOpportunity.opportunityId ||
                  node?.grantId ||
                  lostOpportunity.grantId ||
                  '',
                ).trim(),
                grantId: String(node?.grantId || lostOpportunity.grantId || '').trim(),
                stanceType: lostOpportunity.stanceType,
              },
            });
            const decisionAuditFields = {
              ...decisionResult,
              round: combatData.回合,
              actorId,
              actionRole: normalizeActionRole(extras.role || node.actionRole),
              continuation: node.nodeKind === 'CONTINUATION',
              sourceActorId: String(extras.sourceActorId || '').trim(),
              opportunityId: String(node?.opportunityId || node?.grantId || '').trim(),
              grantId: String(node?.grantId || '').trim(),
              opportunitySequence: decisionOpportunitySequence,
              actorControl: extras.playerLockedDeclaration ? 'PLAYER_LOCKED' : node.actorControl,
              nodeKind: String(node?.nodeKind || '').trim(),
              timing: decisionTiming,
              decisionTimePublicContext:
                buildDecisionTimePublicContext(
                  decisionRuntimeSnapshot,
                ),
            };
            recordDecisionPerformance(decisionResult, {
              ...decisionAuditFields,
              routeFactOwnershipSummary,
              behaviorLayerSemanticHashes,
              evaluationSessionObservation,
            });
            decisions.push(buildDecisionAuditRecord(decisionAuditFields));
            return decisionResult;
          }
          const selectedDeclaration = decisionResult.selected.declaration;
          const skillId = selectedDeclaration?.actionKind === 'RELEASE_SKILL' && !selectedDeclaration.skill
            ? String(decisionResult?.selected?.candidateId || '').match(/:(?:skill|forced-skill):(.+):\d+$/)?.[1] || ''
            : '';
          decisionResult.selected = {
            ...decisionResult.selected,
            declaration: resolveDeclaredSkill(
              skillId ? { ...selectedDeclaration, skill: skillId } : selectedDeclaration,
              actor,
            ),
          };
          setVisibleBelief(
            actorId,
            decisionResult.beliefState ||
              beliefByActor.get(actorId) ||
              initialBeliefFor(actorId),
          );
          strategyByActor.set(actorId, decisionResult.strategyMemory || {});
          const history = strategicHistoryByActor.get(actorId) || [];
          const previousCapacity = Number(history.at(-1)?.capacityTotal);
          const previousBeliefRevision = String(history.at(-1)?.beliefRevision || '').trim();
          const currentCapacity = Math.max(0, Number(decisionResult?.stateCapacityTotal || 0));
          const currentBeliefRevision = String(decisionResult?.beliefRevision || '').trim();
          history.push({
            signature: String(decisionResult?.strategicSignature || '').trim(),
            actionFamily: String(
              decisionResult?.selected?.actionFamily ||
              decisionResult?.selected?.declaration?.actionKind ||
              '',
            ).trim(),
            actionRole: normalizeActionRole(extras.role || node.actionRole),
            targetIds: Array.isArray(decisionResult?.selected?.declaration?.targetIds)
              ? decisionResult.selected.declaration.targetIds.map(value => String(value || '').trim()).filter(Boolean)
              : [],
            opportunitySequence: decisionOpportunitySequence,
            capacityTotal: currentCapacity,
            capacityChangePercent: Number.isFinite(previousCapacity)
              ? 100 * Math.abs(currentCapacity - previousCapacity) / Math.max(1, previousCapacity)
              : 100,
            beliefRevision: currentBeliefRevision,
            newInformation: !!previousBeliefRevision && previousBeliefRevision !== currentBeliefRevision,
            pendingEffect: decisionResult?.pendingStrategicEffect === true,
            resourceRunwayAfter: Number.isFinite(Number(decisionResult?.selected?.repeatedActionAudit?.resourceRunwayAfter))
              ? Math.max(0, Number(decisionResult.selected.repeatedActionAudit.resourceRunwayAfter))
              : null,
            failureAdaptationApplied: Number(decisionResult?.selected?.repeatedActionAudit?.failureAdaptation?.penalty || 0) > 0,
            adaptationSelectionStatus: String(
              decisionResult?.decisionProfile?.adaptationSelectionStatus || '',
            ).trim(),
            misjudgmentBudgetAfter: Number.isFinite(
              Number(decisionResult?.decisionProfile?.misjudgmentBudgetAfter),
            )
              ? Math.max(0, Number(decisionResult.decisionProfile.misjudgmentBudgetAfter))
              : null,
          });
          strategicHistoryByActor.set(actorId, history.slice(-8));
          const decisionAuditFields = {
            ...decisionResult,
            round: combatData.回合,
            actorId,
            actionRole: normalizeActionRole(extras.role || node.actionRole),
            continuation: node.nodeKind === 'CONTINUATION',
            sourceActorId: String(extras.sourceActorId || '').trim(),
            opportunityId: String(node?.opportunityId || node?.grantId || '').trim(),
            grantId: String(node?.grantId || '').trim(),
            opportunitySequence: decisionOpportunitySequence,
            actorControl: extras.playerLockedDeclaration ? 'PLAYER_LOCKED' : node.actorControl,
            nodeKind: String(node?.nodeKind || '').trim(),
            timing: decisionTiming,
            decisionTimePublicContext:
              buildDecisionTimePublicContext(
                decisionRuntimeSnapshot,
              ),
          };
          recordDecisionPerformance(decisionResult, {
            ...decisionAuditFields,
            routeFactOwnershipSummary:
              typeof routeFactOwnershipSummary === 'object'
                ? routeFactOwnershipSummary
                : {},
            behaviorLayerSemanticHashes,
            evaluationSessionObservation,
          });
          decisions.push(buildDecisionAuditRecord(decisionAuditFields));
          return decisionResult;
        };
        const cooperativeSummonsForHost = host => listSummonCombatUnits(combatData).filter(summon =>
          String(summon?.行动模式 || '').trim() === '协同攻击' &&
          isUnitIdentityMatch(summon?.__宿主, host)
        );
        const enqueueSummonAssists = ({
          facts = [],
          node = {},
          sourceActionId = '',
          host = null,
          decisionResult = null,
        } = {}) => {
          const createdSummonIds = new Set(facts
            .filter(event => event?.eventKind === 'summon_create')
            .map(event => String(event?.targetId || event?.meta?.summonKey || '').trim())
            .filter(Boolean));
          const hostCanGrantExistingWindow = !!host &&
            node?.actionRole === 'ACTIVE' &&
            !host?.召唤键;
          const candidates = listSummonCombatUnits(combatData).filter(summon => {
            if (String(summon?.行动模式 || '').trim() !== '协同攻击') return false;
            const summonId = String(summon?.召唤键 || '').trim();
            return createdSummonIds.has(summonId) ||
              (hostCanGrantExistingWindow && isUnitIdentityMatch(summon?.__宿主, host));
          });
          const preferredTargetIds = facts
            .filter(event =>
              String(event?.eventKind || '').trim() === 'hit_result' &&
              String(event?.result || '').trim() === 'hit' &&
              Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0
            )
            .flatMap(event => [
              ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
              event?.targetId,
              event?.targetName,
            ])
            .map(value => String(value || '').trim())
            .filter(Boolean);
          const focusTargetId = String(decisionResult?.teamIntent?.focusTarget || '').trim();
          candidates.forEach(summon => {
            const runtime = ensureSummonWindowRuntime(summon);
            if (!runtime || Math.max(0, Number(runtime.remainingWindows || 0)) <= 0) return;
            const summonSide = inferUnitSide(
              combatData,
              previewRuntime.unitName(summon),
            ) || node?.actorEntry?.side;
            const validTargetIds = listPrimaryCombatUnits(combatData)
              .filter(unit =>
                previewRuntime.isBattleCapable(unit) &&
                inferUnitSide(combatData, previewRuntime.unitName(unit)) !== summonSide
              )
              .map(previewRuntime.unitId)
              .filter(Boolean);
            const grantId = `${runtime.windowId}:${Number(combatData?.回合 || 0)}:assist-window`;
            if (runtime.consumedActionGrantIds.has(grantId)) return;
            runtime.consumedActionGrantIds.add(grantId);
            queue.enqueue({
              actorEntry: { char: summon, side: summonSide },
              actorControl: 'AI',
              actorTurnSequence: node.actorTurnSequence,
              parentActionSequence: node.parentActionSequence || node.actionSequence,
              phasePriority: 70,
              grantId,
              nodeKind: 'ASSIST',
              actionRole: 'ASSIST',
              sourceActionId: String(sourceActionId || '').trim(),
              sourceActorId: previewRuntime.unitId(summon?.__宿主 || host),
              grantType: 'ASSIST_WINDOW',
              validTargetIds: [...new Set(validTargetIds)],
              actionName: '召唤协同',
              state: {
                hostActorId: previewRuntime.unitId(summon?.__宿主 || host),
                preferredTargetIds: [...new Set([
                  ...preferredTargetIds,
                  focusTargetId,
                ].filter(Boolean))],
              },
            });
          });
        };
        const consumeUnavailableHostSummonWindows = (host = {}, node = {}, reasonCode = '', reasonText = '') => {
          if (node?.nodeKind !== 'ACTIVE') return;
          cooperativeSummonsForHost(host).forEach(summon => {
            const runtime = ensureSummonWindowRuntime(summon);
            if (!runtime || Math.max(0, Number(runtime.remainingWindows || 0)) <= 0) return;
            const grantId = `${runtime.windowId}:${Number(combatData?.回合 || 0)}:assist-window`;
            if (runtime.consumedActionGrantIds.has(grantId)) return;
            runtime.consumedActionGrantIds.add(grantId);
            writeLedgerEvent(combatData, {
              eventKind: 'blocked_action',
              round: Number(combatData?.回合 || 0),
              actorId: previewRuntime.unitId(summon) || '',
              actorName: previewRuntime.unitName(summon),
              targetId: previewRuntime.unitId(host) || '',
              targetName: previewRuntime.unitName(host),
              actionName: '召唤协同',
              actionType: 'summon_assist',
              actorControl: 'AI',
              actionRole: 'ASSIST',
              sourceActionId: String(node?.sourceActionId || '').trim(),
              result: 'cancelled',
              resultState: 'FAILURE',
              ruleCode: 'SUMMON_HOST_UNAVAILABLE',
              meta: {
                source: 'structured_runtime',
                grantId,
                reasonCode: String(reasonCode || 'SUMMON_HOST_UNAVAILABLE').trim(),
                reasonText: String(reasonText || '宿主无法维持本轮协同行动').trim(),
                summonName: previewRuntime.unitName(summon),
                summonHostName: previewRuntime.unitName(host),
                summonMode: '协同攻击',
              },
            });
            consumeSummonWindow(combatData, summon, reasonText || '宿主无法维持协同窗口', grantId);
          });
        };
        const handleLostDecisionNode = (decisionResult, currentNode) => {
          if (decisionResult?.selected?.declaration || !decisionResult?.lostOpportunity?.reasonCode) return false;
          queue.recordTrace('EXECUTED', currentNode, {
            result: 'lost_opportunity',
            reason: decisionResult.lostOpportunity.reasonCode,
          });
          return true;
        };
        while (queue.pendingCount > 0 && !queue.fatal) {
          terminal = evaluateBattleTerminal({ combatData, currentRound: combatData.回合, rounds: roundOffset, roundCompleted: false }, {});
          if (terminal?.terminal === true) {
            cancelQueueForTerminal();
            break;
          }
          const node = queue.dequeue();
          if (!node) break;
          queue.recordTrace('EXECUTING', node);
          const queuedActor = node?.actorEntry?.char;
          const actorId = previewRuntime.unitId(queuedActor);
          const formalActor = actorId
            ? [
                ...listPrimaryCombatUnits(combatData),
                ...listSummonCombatUnits(combatData),
              ].find(unit => previewRuntime.unitId(unit) === actorId) || null
            : null;
          const actor = formalActor || queuedActor;
          const actorPresentInBattle = !!formalActor;
          if (formalActor && formalActor !== queuedActor) {
            node.actorEntry = {
              ...(node.actorEntry || {}),
              char: formalActor,
              side: inferUnitSide(combatData, previewRuntime.unitName(formalActor)) || node?.actorEntry?.side,
            };
            queue.recordTrace('ACTOR_CANONICALIZED', node, {
              actorId,
              queuedActorHash: previewRuntime.stableHash(queuedActor || {}),
              formalActorHash: previewRuntime.stableHash(formalActor),
            });
          }
          const naturalOpportunity = node.nodeKind === 'ACTIVE'
            ? actor?.__battleRuntime?.naturalOpportunity
            : null;
          if (
            naturalOpportunity &&
            Number(naturalOpportunity?.round || 0) === Number(combatData?.回合 || 0) &&
            String(naturalOpportunity?.status || '').trim() === 'CONSUMED_BY_FUSION'
          ) {
            const actionName = normalizeActionDisplayName(naturalOpportunity?.actionName || '武魂融合技');
            writeLedgerEvent(combatData, {
              eventKind: 'blocked_action',
              round: Number(combatData.回合 || 0),
              actorId: previewRuntime.unitId(actor) || '',
              actorName: previewRuntime.unitName(actor),
              targetId: previewRuntime.unitId(actor) || '',
              targetName: previewRuntime.unitName(actor),
              actionName: '融合协同',
              actionType: 'opportunity_consumed',
              actorControl: node.actorControl,
              actionRole: node.actionRole,
              sourceActionId: String(naturalOpportunity?.consumedByActionId || '').trim(),
              result: 'consumed',
              resultState: 'COMPLETED',
              ruleCode: 'FUSION_PARTICIPATION_CONSUMED',
              meta: {
                source: 'structured_runtime',
                grantId: node.grantId,
                reasonCode: 'FUSION_PARTICIPATION_CONSUMED',
                reasonText: `本轮自然行动机会已用于参与【${actionName}】`,
                fusionKey: String(naturalOpportunity?.fusionKey || '').trim(),
                fusionActionName: actionName,
              },
            });
            naturalOpportunity.status = 'CONSUMED';
            queue.recordTrace('EXECUTED', node, {
              reason: 'FUSION_PARTICIPATION_CONSUMED',
              sourceActionId: String(naturalOpportunity?.consumedByActionId || '').trim(),
            });
            continue;
          }
          if (!actor || !actorPresentInBattle || !structuredActorCanAct(actor, node.actionRole)) {
            const actorName = previewRuntime.unitName(actor) || '未知单位';
            if (node.nodeKind === 'ACTIVE' && actor?.蓄力技能) {
              const interruptedCharge = actor.蓄力技能;
              const controlSource = structuredControlSource(combatData, actor, node.actionRole);
              actor.蓄力技能 = null;
              writeLedgerEvent(combatData, {
                eventKind: 'charge_interrupt', round: Number(combatData.回合 || 0), actorName, targetName: actorName,
                actionName: normalizeActionDisplayName(interruptedCharge?.skill?.name || interruptedCharge?.skill?.魂技名 || interruptedCharge?.actionName || '蓄力行动'),
                actionType: 'charge_interrupt', actorControl: node.actorControl, actionRole: node.actionRole,
                sourceActionId: String(controlSource?.sourceActionId || interruptedCharge?.sourceActionId || '').trim(),
                result: 'interrupted', resultState: 'ABORTED', ruleCode: 'CHARGE_ACTOR_UNAVAILABLE',
                meta: {
                  source: 'structured_shadow',
                  grantId: node.grantId,
                  reason: structuredActorIncapacityReason(actor, node.actionRole) || 'UNAVAILABLE',
                  interruptedActionId: String(interruptedCharge?.sourceActionId || '').trim(),
                  controlApplicationId: String(controlSource?.applicationId || '').trim(),
                },
              });
            }
            if (node.nodeKind === 'REACTION' && node?.state?.shared) {
              const targetId = String(node?.state?.targetId || previewRuntime.unitId(actor)).trim();
              node.state.shared.reactionByTarget[targetId] = {
                actionKind: 'UNAVAILABLE',
                evaded: false,
                damageMultiplier: 1,
                opensCounterCheck: false,
              };
            }
            const incapacityReason = !actorPresentInBattle && previewRuntime.isSummonUnit(actor)
              ? 'SUMMON_REMOVED'
              : structuredActorIncapacityReason(actor || {}, node.actionRole) || '';
            if (naturalOpportunity && String(naturalOpportunity?.status || '').trim() === 'PENDING') {
              naturalOpportunity.status = 'LOST';
              naturalOpportunity.reason = incapacityReason || 'UNAVAILABLE';
            }
            const controlledStateName = incapacityReason.startsWith('CONTROLLED:')
              ? incapacityReason.slice('CONTROLLED:'.length).trim()
              : '';
            const incapacityReasonText = controlledStateName
              ? `受【${controlledStateName}】影响`
              : ({
                  DEAD: '已经死亡',
                  STAMINA_EXHAUSTED: '体力已经耗尽',
                  UNCONSCIOUS: '处于昏迷状态',
                  SURRENDERED: '已经认输',
                  SUBDUED: '已经被制服',
                  INCAPACITATED: '已经失去战斗力',
                })[incapacityReason] || '当前状态无法行动';
            consumeUnavailableHostSummonWindows(
              actor,
              node,
              controlledStateName ? 'SUMMON_HOST_CONTROLLED' : (incapacityReason || 'SUMMON_HOST_UNAVAILABLE'),
              `宿主${incapacityReasonText}`,
            );
            writeLedgerEvent(combatData, {
              eventKind: 'blocked_action', round: Number(combatData.回合 || 0),
              actorId: previewRuntime.unitId(actor) || '', actorName,
              targetId: previewRuntime.unitId(actor) || '', targetName: actorName,
              actionName: '失去行动', actionType: 'opportunity_cancelled', actorControl: node.actorControl,
              actionRole: node.actionRole, sourceActionId: String(node?.state?.shared?.actionContext?.actionEvent?.actionId || node.sourceActionId || '').trim(),
              parentNodeId: String(node?.state?.shared?.actionContext?.actionEvent?.chainNodeId || '').trim(),
              opportunityId: String(node.opportunityId || node.grantId || '').trim(),
              opportunitySequence: Math.max(0, Number(node.opportunitySequence || 0)),
              grantId: String(node.grantId || '').trim(),
              result: 'cancelled', resultState: 'FAILURE',
              ruleCode: node.nodeKind === 'REACTION' ? 'REACTION_ACTOR_UNAVAILABLE' : node.nodeKind === 'CONTINUATION' ? 'CONTINUATION_ACTOR_UNAVAILABLE' : 'NATURAL_ACTION_OPPORTUNITY_CANCELLED',
              meta: {
                source: 'structured_shadow',
                grantId: node.grantId,
                opportunityId: String(node.opportunityId || node.grantId || '').trim(),
                reasonCode: controlledStateName ? 'CONTROLLED_BEFORE_OPPORTUNITY' : (incapacityReason || 'UNAVAILABLE'),
                reasonText: incapacityReasonText,
                stateName: controlledStateName,
              },
            });
            if (controlledStateName) {
              consumeStructuredControlActiveBudget(combatData, actor, node);
            }
            if (node.actionRole === 'ASSIST' && actor?.召唤键) {
              consumeSummonWindow(combatData, actor, incapacityReasonText, node.grantId);
            }
            queue.recordTrace('CANCELLED', node, { reason: incapacityReason || 'UNAVAILABLE' });
            continue;
          }
          if (naturalOpportunity && String(naturalOpportunity?.status || '').trim() === 'PENDING') {
            naturalOpportunity.status = 'EXECUTING';
            naturalOpportunity.consumedByActionId = '';
          }
          try {
            if (node.nodeKind === 'REACTION') {
              const shared = node?.state?.shared;
              const sourceActor = shared?.actionContext?.actor;
              if (!shared || !sourceActor || !previewRuntime.isBattleCapable(sourceActor)) {
                queue.recordTrace('CANCELLED', node, { reason: 'SOURCE_ACTOR_UNAVAILABLE' });
                continue;
              }
              const actorId = previewRuntime.unitId(actor);
              const sourceActorId = previewRuntime.unitId(sourceActor);
              const preparedDefense = actor?.__battleRuntime?.activeDefenseStance || null;
              const sourceActionEvent = shared?.actionContext?.actionEvent;
              const sourceActionId = String(sourceActionEvent?.actionId || '').trim();
              const sourceEventId = String(sourceActionEvent?.eventId || '').trim();
              if (!sourceActionId || !sourceEventId) throw new Error('REACTION_SOURCE_PROVENANCE_MISSING');
              const sourceFactIds = [sourceEventId];
              const sourceEventIds = [sourceEventId];
              const targetResolutionEventId = String(
                shared?.actionContext?.targetResolutionEvent?.eventId || '',
              ).trim();
              if (targetResolutionEventId && !sourceFactIds.includes(targetResolutionEventId)) {
                sourceFactIds.push(targetResolutionEventId);
                sourceEventIds.push(targetResolutionEventId);
              }
              const actionContext = {
                sourceActionId,
                sourceFactIds,
                sourceEventIds,
              };
              const incomingAction = {
                ...cloneValue(shared.declaration),
                sourceActionId,
                sourceFactIds: sourceFactIds.slice(),
                sourceEventIds: sourceEventIds.slice(),
              };
              const decisionResult = preparedDefense ? null : decideForNode(actor, node, {
                role: 'REACTION',
                imminentThreat: true,
                sourceActorId,
                immediateBudget: naturalActionBudget,
                actionContext,
                incomingAction,
              });
              if (handleLostDecisionNode(decisionResult, node)) {
                const targetId = String(node?.state?.targetId || previewRuntime.unitId(actor)).trim();
                shared.reactionByTarget[targetId] = {
                  actionKind: 'UNAVAILABLE',
                  evaded: false,
                  damageMultiplier: 1,
                  opensCounterCheck: false,
                };
                continue;
              }
              if (preparedDefense) {
                preparedDefense.consumed = true;
                delete actor.__battleRuntime.activeDefenseStance;
              }
              const reactionDeclaration = preparedDefense
                ? { actorId, actionKind: preparedDefense.actionKind, targetIds: [actorId] }
                : cloneValue(decisionResult.selected.declaration);
              const reaction = settleStructuredReaction({
                combatData,
                reactor: actor,
                sourceActor,
                declaration: reactionDeclaration,
                parentActionEvent: shared.actionContext.actionEvent,
                opportunityId: node.opportunityId,
                opportunitySequence: node.opportunitySequence,
                grantId: node.grantId,
                preparedDefense,
                decisionCandidateId: String(decisionResult?.selected?.candidateId || '').trim(),
              });
              invalidateRouteHashesFromFacts(combatData, actorId, [
                reaction?.event,
                ...(Array.isArray(reaction?.facts) ? reaction.facts : []),
              ]);
              registerPredictedEvidence(reaction?.event, decisionResult);
              if (reaction?.event && Array.isArray(reaction?.facts) && reaction.facts.length) {
                recordSettledBeliefs(decisionResult, {
                  actionEvent: reaction.event,
                  facts: reaction.facts,
                });
              }
              recordPublicReactionObservation({
                reactor: actor,
                incomingSource: sourceActor,
                declaration: reactionDeclaration,
                reaction,
              });
              shared.reactionByTarget[actorId] = reaction;
              enqueueSummonAssists({
                facts: reaction?.facts || [],
                node,
                sourceActionId: reaction?.event?.actionId || shared.actionContext.actionEvent.actionId,
                host: actor,
                decisionResult,
              });
              queue.recordTrace('EXECUTED', node, {
                actionId: shared.actionContext.actionEvent.actionId,
                reactionEventId: String(reaction?.event?.eventId || '').trim(),
                result: reaction.evaded ? 'evaded' : reaction.actionKind === 'DEFEND' ? 'guarded' : 'resolved',
              });
              continue;
            }

            if (node.nodeKind === 'PRIMARY_SETTLEMENT') {
              const shared = node?.state?.shared;
              if (!shared?.actionContext) throw new Error('battle_structured_primary_context_missing');
              const actionStart = shared.actionContext.actionEvent;
              const declarationTargetIds = Array.isArray(shared.declaration?.targetIds) ? shared.declaration.targetIds : [];
              const declaredTargetIds = Array.isArray(actionStart?.meta?.declaredTargetIds)
                ? actionStart.meta.declaredTargetIds.map(value => String(value || '').trim()).filter(Boolean)
                : [actionStart?.declaredTargetId].map(value => String(value || '').trim()).filter(Boolean);
              const attemptedTargetIds = Array.isArray(actionStart?.meta?.resolvedTargetIds)
                ? actionStart.meta.resolvedTargetIds.map(value => String(value || '').trim()).filter(Boolean)
                : declarationTargetIds.map(value => String(value || '').trim()).filter(Boolean);
              const hostilePrimaryEffect = structuredDamageEffects(shared.declaration)[0] || null;
              const legalTargets = hostilePrimaryEffect
                ? resolveStructuredTargets(combatData, actor, shared.declaration, hostilePrimaryEffect)
                : declarationTargetIds
                    .map(targetId => listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetId)))
                    .filter(unit => unit && previewRuntime.isBattleCapable(unit));
              if (hostilePrimaryEffect && !legalTargets.length) {
                const declaredTargetId = String(declaredTargetIds[0] || '').trim();
                const attemptedTargetId = String(actionStart?.resolvedTargetId || attemptedTargetIds[0] || '').trim();
                const attemptedTarget = listCombatUnits(combatData).find(unit =>
                  isUnitIdentityMatch(unit, attemptedTargetId)
                );
                const targetName = previewRuntime.unitName(attemptedTarget) || attemptedTargetId || declaredTargetId || '目标';
                const targetLost = Boolean(attemptedTargetId || declaredTargetId);
                writeLedgerEvent(combatData, {
                  eventKind: 'blocked_settlement',
                  round: Number(combatData.回合 || 0),
                  actorId: previewRuntime.unitId(actor),
                  actorName: previewRuntime.unitName(actor),
                  targetId: attemptedTargetId,
                  targetName,
                  targetIds: attemptedTargetIds,
                  declaredTargetId,
                  resolvedTargetId: '',
                  actionName: shared.actionContext.actionName,
                  actionType: shared.actionContext.actionKind,
                  actorControl: node.actorControl,
                  actionRole: node.actionRole,
                  actionId: shared.actionContext.actionEvent.actionId,
                  sourceActionId: shared.actionContext.actionEvent.actionId,
                  parentNodeId: shared.actionContext.actionEvent.chainNodeId || '',
                  result: targetLost ? 'target_lost' : 'no_valid_target',
                  resultState: 'ABORTED',
                  ruleCode: targetLost ? 'TARGET_LOST' : 'NO_VALID_TARGET',
                  meta: {
                    source: 'structured_shadow',
                    grantId: node.grantId,
                    declaredTargetIds,
                    resolvedTargetIds: [],
                    attemptedTargetIds,
                    reasonCode: targetLost ? 'TARGET_LOST' : 'NO_VALID_TARGET',
                    reasonText: targetLost
                      ? `${targetName}在结算前已不再是有效目标`
                      : '结算时没有可用目标',
                  },
                });
                queue.recordTrace('CANCELLED', node, {
                  reason: targetLost ? 'TARGET_LOST' : 'NO_VALID_TARGET',
                  actionId: shared.actionContext.actionEvent.actionId,
                });
                continue;
              }
              const settlement = executeStructuredDeclaration({
                combatData,
                declaration: shared.declaration,
                actionContext: shared.actionContext,
                reactionByTarget: shared.reactionByTarget,
              });
              invalidateRouteHashesFromFacts(combatData, previewRuntime.unitId(actor), settlement?.facts);
              recordSettledBeliefs(shared.decisionResult, settlement);
              if (node.actionRole === 'COUNTER') {
                const counterHit = settlement.facts.find(event => String(event?.eventKind || '').trim() === 'hit_result');
                const counterSourceAction = node?.state?.parentActionEvent || null;
                const counterSourceActionId = String(
                  shared.actionContext?.actionEvent?.sourceActionId ||
                  counterSourceAction?.actionId ||
                  node?.state?.counterWindowEvent?.sourceActionId ||
                  '',
                ).trim();
                const counterSourceActionLedger = ensureLedger(combatData).find(event =>
                  String(event?.eventKind || '').trim() === 'action_start' &&
                  String(event?.actionId || '').trim() === counterSourceActionId
                ) || null;
                const counterSourceActionName = normalizeActionDisplayName(
                  counterSourceAction?.finalActionName ||
                  counterSourceAction?.actionName ||
                  counterSourceAction?.actionType ||
                  counterSourceActionLedger?.finalActionName ||
                  counterSourceActionLedger?.actionName ||
                  counterSourceActionLedger?.actionType ||
                  '',
                );
                const counterTargetId = String(
                  node?.state?.sourceActorId ||
                  counterSourceActionLedger?.actorId ||
                  counterSourceActionLedger?.actorName ||
                  shared.actionContext?.actionEvent?.targetName ||
                  '',
                ).trim();
                const counterTargetName = String(
                  node?.state?.sourceActorName ||
                  counterSourceActionLedger?.actorName ||
                  shared.actionContext?.actionEvent?.targetName ||
                  '',
                ).trim();
                writeLedgerEvent(combatData, {
                  eventKind: 'counter',
                  round: Number(combatData.回合 || 0),
                  actorId: previewRuntime.unitId(actor),
                  actorName: previewRuntime.unitName(actor),
                  targetName: counterTargetName,
                  actorSide: inferUnitSide(combatData, previewRuntime.unitName(actor)),
                  targetSide: String(
                    node?.state?.sourceActorSide ||
                    inferUnitSide(combatData, counterTargetName),
                  ).trim(),
                  targetIds: [counterTargetId].filter(Boolean),
                  actionName: normalizeActionDisplayName(settlement?.actionEvent?.actionName || shared.declaration?.actionKind || '反击'),
                  actionType: 'counter',
                  actorControl: node.actorControl,
                  actionRole: 'COUNTER',
                  sourceActionId: counterSourceActionId,
                  parentNodeId: String(
                    node?.state?.counterWindowEvent?.chainNodeId ||
                    node?.state?.reactionEvent?.chainNodeId ||
                    node?.state?.parentActionEvent?.chainNodeId ||
                    node?.sourceActionId ||
                    '',
                  ).trim(),
                  reactionNodeId: String(
                    shared.actionContext?.actionEvent?.reactionNodeId ||
                    node?.state?.reactionEvent?.chainNodeId ||
                    '',
                  ).trim(),
                  sourceActionName: counterSourceActionName,
                  result: Number(counterHit?.appliedDamage || counterHit?.meta?.appliedDamage || 0) > 0
                    ? 'success'
                    : counterHit?.result || 'settled',
                  resultState: counterHit?.resultState || 'COMPLETED',
                  appliedDamage: 0,
                  meta: {
                    source: 'structured_shadow',
                    settlementEventId: String(counterHit?.eventId || '').trim(),
                    grantId: node.grantId,
                    sourceActorId: counterTargetId,
                    sourceActorName: counterTargetName,
                    sourceActionId: counterSourceActionId,
                    sourceActionName: counterSourceActionName,
                  },
                });
              }
              logs.push(`[结构化影子] ${previewRuntime.unitName(actor)}执行【${normalizeActionDisplayName(settlement?.actionEvent?.actionName || shared.declaration?.actionKind || '')}】。`);
              enqueueSummonAssists({
                facts: settlement.facts,
                node,
                sourceActionId: settlement.actionEvent?.actionId || '',
                host: actor,
                decisionResult: shared.decisionResult,
              });
              Object.entries(shared.reactionByTarget).forEach(([targetId, reaction]) => {
                const reactor = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, targetId));
                if (!reactor) return;
                const counterWindow = openStructuredCounterWindow({
                  combatData,
                  reactor,
                  sourceActor: actor,
                  parentActionEvent: settlement.actionEvent,
                  reaction,
                  settlementFacts: settlement.facts,
                });
                if (!counterWindow?.opened) return;
                queue.enqueue({
                  actorEntry: { char: reactor, side: inferUnitSide(combatData, previewRuntime.unitName(reactor)) },
                  actorControl: 'AI',
                  actorTurnSequence: node.actorTurnSequence,
                  parentActionSequence: node.parentActionSequence || node.actionSequence,
                  phasePriority: 60,
                  grantId: `counter:${settlement.actionEvent.actionId}:${targetId}:1`,
                  nodeKind: 'COUNTER',
                  actionRole: 'COUNTER',
                  sourceActionId: settlement.actionEvent.actionId,
                  sourceActorId: previewRuntime.unitId(actor),
                  grantType: 'COUNTER_WINDOW',
                  validTargetIds: [previewRuntime.unitId(actor)].filter(Boolean),
                  state: {
                    sourceActorId: previewRuntime.unitId(actor),
                    sourceActorName: previewRuntime.unitName(actor),
                    sourceActorSide: inferUnitSide(combatData, previewRuntime.unitName(actor)),
                    parentActionEvent: settlement.actionEvent,
                    reactionEvent: reaction?.event || null,
                    counterWindowEvent: counterWindow.event,
                  },
                });
              });
              const continuationGrant = node?.state?.continuationDepth > 0 ? null : readStructuredContinuationGrant(shared.declaration);
              const effectiveHit = settlement.facts.some(event => event?.eventKind === 'hit_result' && event?.result === 'hit' && Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0);
              const controlApplied = settlement.facts.some(event =>
                event?.eventKind === 'state_apply' && event?.result === 'applied' &&
                /控|晕|眠|定身|束缚|沉默|封禁|缴械|嘲讽|恐惧/.test(String(event?.meta?.stateName || event?.effectSummary || ''))
              );
              if (
                continuationGrant &&
                (!continuationGrant.requiresHit || effectiveHit) &&
                (!continuationGrant.requiresControl || controlApplied) &&
                structuredActorPhysicallyAlive(actor)
              ) {
                queue.enqueue({
                  actorEntry: node.actorEntry,
                  actorControl: node.actorControl,
                  actorTurnSequence: node.actorTurnSequence,
                  parentActionSequence: node.parentActionSequence || node.actionSequence,
                  phasePriority: 65,
                  grantId: `follow_up:${settlement.actionEvent.actionId}:1`,
                  nodeKind: 'CONTINUATION',
                  actionRole: 'ACTIVE',
                  sourceActionId: settlement.actionEvent.actionId,
                  grantType: 'FOLLOW_UP',
                  state: { continuationDepth: 1, parentActionEvent: settlement.actionEvent },
                });
              }
              if (node.actionRole === 'ASSIST' && actor.召唤键) consumeSummonWindow(combatData, actor, '协同行动窗口耗尽', node.grantId);
              queue.recordTrace('EXECUTED', node, { actionId: settlement.actionEvent.actionId });
              continue;
            }

            let declaration;
            let decisionResult = null;
            const storedCharge = node.nodeKind === 'ACTIVE' && actor?.蓄力技能 && typeof actor.蓄力技能 === 'object'
              ? actor.蓄力技能
              : null;
            if (storedCharge) {
              const remainingCastTime = Math.max(0, Number(storedCharge?.cast_time ?? storedCharge?.remainingCastTime ?? storedCharge?.skill?.前摇 ?? 0));
              if (remainingCastTime > naturalActionBudget) {
                storedCharge.cast_time = remainingCastTime - naturalActionBudget;
                const remainingOpportunityCount = Math.ceil(
                  storedCharge.cast_time / Math.max(1, naturalActionBudget),
                );
                writeLedgerEvent(combatData, {
                  eventKind: 'charge_progress', round: Number(combatData.回合 || 0), actorName: previewRuntime.unitName(actor),
                  targetName: String(storedCharge?.targetName || storedCharge?.target_name || storedCharge?.targetIds?.[0] || '').trim(),
                  targetIds: Array.isArray(storedCharge?.targetIds) ? storedCharge.targetIds : [],
                   actionName: normalizeActionDisplayName(storedCharge?.skill?.name || storedCharge?.skill?.魂技名 || storedCharge?.actionName || '蓄力行动'),
                   actionType: 'charge_progress', actorControl: node.actorControl, actionRole: node.actionRole,
                   sourceActionId: String(storedCharge?.sourceActionId || '').trim(),
                   opportunityId: node.opportunityId,
                   opportunitySequence: node.opportunitySequence,
                   grantId: node.grantId,
                   result: 'charging', resultState: 'PENDING', ruleCode: 'CHARGE_PROGRESS',
                   meta: {
                     source: 'structured_shadow',
                     remainingCastTime: storedCharge.cast_time,
                     remainingOpportunityCount,
                     opportunityId: node.opportunityId,
                     opportunitySequence: node.opportunitySequence,
                     grantId: node.grantId,
                   },
                });
                queue.recordTrace('EXECUTED', node, { result: 'charging', remainingCastTime: storedCharge.cast_time });
                continue;
              }
              const chargedSkill = cloneValue(storedCharge?.skill || storedCharge);
              decisionResult = decideForNode(actor, node, {
                role: node.actionRole,
                forcedSkill: chargedSkill,
                forcedTargetIds: Array.isArray(storedCharge?.targetIds) ? storedCharge.targetIds : [],
              });
              if (handleLostDecisionNode(decisionResult, node)) {
                actor.蓄力技能 = null;
                continue;
              }
              declaration = cloneValue(decisionResult?.selected?.declaration || {});
              actor.蓄力技能 = null;
            }
            const lockedDeclaration = selectedDeclaration;
            const lockedActorId = String(lockedDeclaration?.actorId || '').trim();
            const useLockedDeclaration = node.nodeKind === 'ACTIVE' && playerLockedActionConsumed !== true && lockedDeclaration &&
              (!lockedActorId || isUnitIdentityMatch(actor, lockedActorId));
            if (storedCharge) {
              // The stored charge owns this natural action and releases through the normal declaration path.
            } else if (useLockedDeclaration) {
              decisionResult = decideForNode(actor, node, {
                role: node.actionRole,
                playerLockedDeclaration: {
                  ...cloneValue(lockedDeclaration),
                  actorId: previewRuntime.unitId(actor),
                },
              });
              if (handleLostDecisionNode(decisionResult, node)) continue;
              declaration = cloneValue(decisionResult?.selected?.declaration || {});
              playerLockedActionConsumed = true;
              node.actorControl = 'PLAYER_LOCKED';
            } else if (node.actionRole === 'ASSIST' && actor.召唤键) {
              const actorSide = inferUnitSide(combatData, previewRuntime.unitName(actor));
              const host = listPrimaryCombatUnits(combatData).find(unit =>
                isUnitIdentityMatch(unit, node?.state?.hostActorId || actor?.__宿主)
              ) || actor?.__宿主;
              const hostIncapacityReason = host ? structuredActorIncapacityReason(host, 'ACTIVE') : 'INCAPACITATED';
              if (!host || hostIncapacityReason) {
                const reasonText = hostIncapacityReason === 'DEAD'
                  ? '宿主已经死亡'
                  : hostIncapacityReason.startsWith('CONTROLLED:')
                    ? `宿主受【${hostIncapacityReason.slice('CONTROLLED:'.length).trim()}】影响`
                    : '宿主已经失去战斗能力';
                writeLedgerEvent(combatData, {
                  eventKind: 'blocked_action', round: Number(combatData.回合 || 0),
                  actorId: previewRuntime.unitId(actor) || '', actorName: previewRuntime.unitName(actor),
                  targetId: previewRuntime.unitId(host) || '', targetName: previewRuntime.unitName(host),
                  actionName: '召唤协同', actionType: 'summon_assist',
                  actorControl: 'AI', actionRole: 'ASSIST', sourceActionId: String(node.sourceActionId || '').trim(),
                  result: 'cancelled', resultState: 'FAILURE', ruleCode: 'SUMMON_HOST_UNAVAILABLE',
                  meta: {
                    source: 'structured_runtime',
                    grantId: node.grantId,
                    reasonCode: hostIncapacityReason || 'SUMMON_HOST_UNAVAILABLE',
                    reasonText,
                    summonName: previewRuntime.unitName(actor),
                    summonHostName: previewRuntime.unitName(host),
                    summonMode: '协同攻击',
                  },
                });
                consumeSummonWindow(combatData, actor, reasonText, node.grantId);
                queue.recordTrace('EXECUTED', node, { result: 'host_unavailable', reason: hostIncapacityReason });
                continue;
              }
              const preferredTargetIds = Array.isArray(node?.state?.preferredTargetIds)
                ? node.state.preferredTargetIds
                : [];
              const grantedTargetIds = new Set(
                (Array.isArray(node?.validTargetIds) ? node.validTargetIds : [])
                  .map(value => String(value || '').trim())
                  .filter(Boolean),
              );
              const hostileTargets = listPrimaryCombatUnits(combatData).filter(unit =>
                previewRuntime.isBattleCapable(unit) &&
                inferUnitSide(combatData, previewRuntime.unitName(unit)) !== actorSide &&
                (
                  !grantedTargetIds.size ||
                  grantedTargetIds.has(previewRuntime.unitId(unit))
                )
              );
              if (!hostileTargets.length) {
                writeLedgerEvent(combatData, {
                  eventKind: 'target_fail', round: Number(combatData.回合 || 0), actorName: previewRuntime.unitName(actor),
                  actionName: '召唤协同', actionType: 'summon_assist', actorControl: 'AI', actionRole: 'ASSIST',
                  result: 'no_target', resultState: 'FAILURE', ruleCode: 'SUMMON_NO_LEGAL_TARGET',
                  meta: { source: 'structured_shadow', grantId: node.grantId },
                });
                consumeSummonWindow(combatData, actor, '无合法目标', node.grantId);
                queue.recordTrace('EXECUTED', node, { result: 'no_target' });
                continue;
              }
              decisionResult = decideForNode(actor, node, {
                role: 'ASSIST',
                validTargetIds: hostileTargets.map(previewRuntime.unitId).filter(Boolean),
                preferredTargetIds,
              });
              if (handleLostDecisionNode(decisionResult, node)) continue;
              declaration = cloneValue(decisionResult?.selected?.declaration || {});
            } else {
              const sourceActorId = String(node?.state?.sourceActorId || '').trim();
              if (node.nodeKind === 'COUNTER') {
                const sourceActor = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, sourceActorId));
                if (!sourceActor || !previewRuntime.isBattleCapable(sourceActor)) {
                  const sourceActorName = (sourceActor ? previewRuntime.unitName(sourceActor) : '') ||
                    String(node?.state?.sourceActorName || '').trim() ||
                    String(node?.state?.parentActionEvent?.actorName || '').trim() ||
                    '原行动者';
                  const reasonCode = sourceActor
                    ? structuredActorIncapacityReason(sourceActor, 'ACTIVE') || 'INCAPACITATED'
                    : 'SOURCE_REMOVED';
                  const blockedCounterEvent = writeLedgerEvent(combatData, {
                    eventKind: 'blocked_action',
                    round: Number(combatData.回合 || 0),
                    actionId: nextRuntimeId('battle-blocked-action'),
                    actorId: previewRuntime.unitId(actor),
                    actorName: previewRuntime.unitName(actor),
                    targetId: sourceActorId,
                    targetName: sourceActorName,
                    actionName: '反击',
                    actionType: 'counter',
                    actorControl: node.actorControl,
                    actionRole: 'COUNTER',
                    sourceActionId: String(node?.state?.parentActionEvent?.actionId || node.sourceActionId || '').trim(),
                    parentNodeId: String(node?.state?.counterWindowEvent?.chainNodeId || node?.state?.parentActionEvent?.chainNodeId || '').trim(),
                    reactionNodeId: String(node?.state?.reactionEvent?.chainNodeId || '').trim(),
                    opportunityId: String(node.opportunityId || node.grantId || '').trim(),
                    opportunitySequence: Math.max(0, Number(node.opportunitySequence || 0)),
                    grantId: String(node.grantId || '').trim(),
                    result: 'cancelled',
                    resultState: 'ABORTED',
                    ruleCode: 'COUNTER_SOURCE_UNAVAILABLE',
                    meta: {
                      source: 'structured_shadow',
                      sourceActorId,
                      sourceActorName,
                      reasonCode: 'COUNTER_SOURCE_UNAVAILABLE',
                      sourceIncapacityReason: reasonCode,
                      reasonText: `${sourceActorName}已经失去战斗能力，反击机会取消`,
                    },
                  });
                  queue.recordTrace('CANCELLED', node, {
                    reason: 'COUNTER_SOURCE_UNAVAILABLE',
                    actionId: blockedCounterEvent.actionId,
                  });
                  continue;
                }
              }
              decisionResult = decideForNode(actor, node, node.nodeKind === 'COUNTER'
                ? { role: 'COUNTER', counterWindow: true, counterActionAvailable: true, sourceActorId, immediateBudget: 40 }
                : node.nodeKind === 'CONTINUATION'
                  ? { role: 'ACTIVE', continuationGrant: true, immediateBudget: naturalActionBudget, enforceImmediateBudget: true }
                  : { role: node.actionRole });
              if (handleLostDecisionNode(decisionResult, node)) continue;
              declaration = cloneValue(decisionResult?.selected?.declaration || {});
              // The authoritative counterDeclineFallback flag is assembled by
              // the R9V2_LINEAR decision wrapper from the same prepared frozen
              // candidate (fail-closed when missing); the runtime only consumes
              // the certified boolean and never re-prepares or inspects
              // candidateId naming.
              if (node.nodeKind === 'COUNTER' && decisionResult?.selected?.counterDeclineFallback === true) {
                const sourceActor = listCombatUnits(combatData).find(unit => isUnitIdentityMatch(unit, sourceActorId));
                const sourceActorName = (sourceActor ? previewRuntime.unitName(sourceActor) : '') ||
                  String(node?.state?.counterWindowEvent?.targetName || '').trim() ||
                  String(node?.state?.sourceActorName || '').trim() ||
                  String(node?.state?.parentActionEvent?.actorName || '').trim() ||
                  '未知单位';
                const sourceActorSide = inferUnitSide(combatData, sourceActorName) ||
                  String(node?.state?.counterWindowEvent?.targetSide || '').trim() ||
                  String(node?.state?.sourceActorSide || '').trim() ||
                  String(node?.state?.parentActionEvent?.actorSide || '').trim();
                const counterDeclineEvent = writeLedgerEvent(combatData, {
                  eventKind: 'counter',
                  round: Number(combatData.回合 || 0),
                  actorId: previewRuntime.unitId(actor),
                  actorName: previewRuntime.unitName(actor),
                  targetName: sourceActorName,
                  actorSide: inferUnitSide(combatData, previewRuntime.unitName(actor)),
                  targetSide: sourceActorSide,
                  targetIds: [sourceActorId].filter(Boolean),
                  // The decline is the authoritative action name used by the
                  // scoring audit (resolveDecisionActionName maps
                  // counterDeclineFallback to 放弃反击), so the ledger event
                  // must carry the same name; the executed stance declaration
                  // (DEFEND) is preserved in meta.declaredActionKind and the
                  // decline semantics in result='declined' +
                  // ruleCode='COUNTER_NO_EFFECTIVE_ACTION'.
                  actionName: '放弃反击',
                  actionType: 'counter',
                  actorControl: 'AI',
                  actionRole: 'COUNTER',
                  sourceActionId: String(node?.state?.parentActionEvent?.actionId || node.sourceActionId || '').trim(),
                  parentNodeId: String(node?.state?.counterWindowEvent?.chainNodeId || node?.state?.reactionEvent?.chainNodeId || node?.state?.parentActionEvent?.chainNodeId || '').trim(),
                  reactionNodeId: String(node?.state?.reactionEvent?.chainNodeId || '').trim(),
                  opportunityId: String(node.opportunityId || node.grantId || '').trim(),
                  opportunitySequence: Math.max(0, Number(node.opportunitySequence || 0)),
                  grantId: String(node.grantId || '').trim(),
                  result: 'declined',
                  resultState: 'NO_EFFECT',
                  ruleCode: 'COUNTER_NO_EFFECTIVE_ACTION',
                  meta: {
                    source: 'structured_shadow',
                    opportunityId: String(node.opportunityId || node.grantId || '').trim(),
                    opportunitySequence: Math.max(0, Number(node.opportunitySequence || 0)),
                    grantId: String(node.grantId || '').trim(),
                    decisionCandidateId: String(decisionResult?.selected?.candidateId || '').trim(),
                    declaredActionKind: String(declaration?.actionKind || '').trim(),
                    declaredTargetIds: Array.isArray(declaration?.targetIds)
                      ? declaration.targetIds.map(value => String(value || '').trim()).filter(Boolean)
                      : [],
                  },
                });
                queue.recordTrace('EXECUTED', node, { actionId: counterDeclineEvent.actionId, result: 'declined' });
                continue;
              }
            }
            const declarationTargetIds = Array.isArray(declaration?.targetIds) ? declaration.targetIds : [];
            const hostilePrimaryEffect = structuredDamageEffects(declaration)[0] || null;
            const resolvedHostileTargets = hostilePrimaryEffect
              ? resolveStructuredTargets(combatData, actor, declaration, hostilePrimaryEffect)
              : [];
            if (hostilePrimaryEffect && !resolvedHostileTargets.length) {
              const declaredTargetId = String(declarationTargetIds[0] || '').trim();
              const declaredTarget = listCombatUnits(combatData).find(unit =>
                isUnitIdentityMatch(unit, declaredTargetId)
              );
              const targetName = previewRuntime.unitName(declaredTarget) || declaredTargetId || '目标';
              const targetLost = Boolean(declaredTargetId);
              const reasonCode = targetLost
                ? 'TARGET_UNAVAILABLE_BEFORE_DECLARATION'
                : 'NO_VALID_TARGET';
              const reasonText = targetLost
                ? `${targetName}当前无法被此行动锁定`
                : '当前没有可被此行动锁定的目标';
              const blockedActionEvent = writeLedgerEvent(combatData, {
                eventKind: 'blocked_action',
                round: Number(combatData.回合 || 0),
                actionId: nextRuntimeId('battle-blocked-action'),
                actorId: previewRuntime.unitId(actor),
                actorName: previewRuntime.unitName(actor),
                targetId: declaredTargetId,
                targetName,
                targetIds: declarationTargetIds,
                declaredTargetId,
                resolvedTargetId: '',
                actionName: normalizeActionDisplayName(
                  declaration?.skill?.name || declaration?.skill?.魂技名 || declaration?.actionKind || '行动',
                ),
                actionType: String(declaration?.actionKind || '').trim(),
                actorControl: node.actorControl,
                actionRole: node.actionRole,
                allowImplicitActionSource: false,
                sourceActionId: String(node.sourceActionId || '').trim(),
                parentNodeId: String(node.sourceActionId ? node?.state?.counterWindowEvent?.chainNodeId || node?.state?.parentActionEvent?.chainNodeId || '' : '').trim(),
                reactionNodeId: String(node.sourceActionId ? node?.state?.reactionEvent?.chainNodeId || '' : '').trim(),
                opportunityId: String(node.opportunityId || node.grantId || '').trim(),
                opportunitySequence: Math.max(0, Number(node.opportunitySequence || 0)),
                grantId: String(node.grantId || '').trim(),
                result: targetLost ? 'target_unavailable' : 'no_valid_target',
                resultState: 'ABORTED',
                ruleCode: targetLost ? 'TARGET_LOST' : 'NO_VALID_TARGET',
                meta: {
                  source: 'structured_shadow',
                  decisionCandidateId: String(decisionResult?.selected?.candidateId || '').trim(),
                  declaredTargetIds: declarationTargetIds,
                  resolvedTargetIds: [],
                  reasonCode,
                  reasonText,
                },
              });
              queue.recordTrace('CANCELLED', node, {
                reason: targetLost ? 'TARGET_LOST' : 'NO_VALID_TARGET',
                actionId: blockedActionEvent.actionId,
              });
              continue;
            }
            const castTime = Math.max(0, Number(declaration?.skill?.前摇 ?? declaration?.skill?.cast_time ?? 0));
            if (!storedCharge && node.nodeKind === 'ACTIVE' && castTime > naturalActionBudget) {
              const actionName = normalizeActionDisplayName(declaration?.skill?.name || declaration?.skill?.魂技名 || declaration?.actionKind || '蓄力行动');
              const remainingOpportunityCount = Math.ceil(
                (castTime - naturalActionBudget) / Math.max(1, naturalActionBudget),
              );
              const chargeStart = writeLedgerEvent(combatData, {
                eventKind: 'charge_start', round: Number(combatData.回合 || 0), actorName: previewRuntime.unitName(actor),
                targetName: String(declaration?.targetIds?.[0] || '').trim(), targetIds: declaration?.targetIds || [],
                actionName, actionType: 'charge_start', actorControl: node.actorControl, actionRole: node.actionRole,
                result: 'charging', resultState: 'PENDING', ruleCode: 'CHARGE_STARTED',
                 opportunityId: node.opportunityId,
                 opportunitySequence: node.opportunitySequence,
                 grantId: node.grantId,
                 meta: {
                   source: 'structured_shadow',
                   decisionCandidateId: String(decisionResult?.selected?.candidateId || '').trim(),
                   declaredTargetIds: declarationTargetIds,
                   resolvedTargetIds: resolvedHostileTargets.map(target => previewRuntime.unitId(target)).filter(Boolean),
                   remainingCastTime: castTime - naturalActionBudget,
                   remainingOpportunityCount,
                   opportunityId: node.opportunityId,
                   opportunitySequence: node.opportunitySequence,
                   grantId: node.grantId,
                 },
              });
              if (
                naturalOpportunity &&
                String(naturalOpportunity?.status || '').trim() === 'EXECUTING'
              ) {
                naturalOpportunity.status = 'CONSUMED';
                naturalOpportunity.consumedByActionId = String(chargeStart?.actionId || chargeStart?.eventId || '').trim();
              }
              // N-15：蓄力包在此归一化——威胁三路径（Decision 侧）只认 _效果数组；
              // 仅有 效果数组 的技能包若不补齐，蓄力威胁会静默降级为威力50普攻或空效果。
              const chargeSkillPackage = cloneValue(declaration.skill);
              if (
                chargeSkillPackage && typeof chargeSkillPackage === 'object' &&
                !Array.isArray(chargeSkillPackage._效果数组) &&
                Array.isArray(chargeSkillPackage.效果数组)
              ) {
                chargeSkillPackage._效果数组 = cloneValue(chargeSkillPackage.效果数组);
              }
              actor.蓄力技能 = {
                skill: chargeSkillPackage,
                cast_time: castTime - naturalActionBudget,
                targetIds: cloneValue(declaration.targetIds || []),
                actionName,
                sourceActionId: chargeStart.actionId || chargeStart.eventId || '',
              };
              queue.recordTrace('EXECUTED', node, {
                actionId: chargeStart.actionId,
                result: 'charging',
                remainingCastTime: actor.蓄力技能.cast_time,
              });
              continue;
            }
            const fusion = node.nodeKind === 'ACTIVE'
              ? prepareStructuredFusion(combatData, actor, declaration)
              : null;
            const parentActionEvent = node?.state?.parentActionEvent || null;
            const actionContext = beginStructuredDeclaration({
              combatData,
              declaration,
              actionRole: node.actionRole,
              actorControl: node.actorControl,
              sourceActionId: String(parentActionEvent?.actionId || node.sourceActionId || '').trim(),
              opportunityId: node.opportunityId,
              opportunitySequence: node.opportunitySequence,
              grantId: node.grantId,
              decisionCandidateId: String(decisionResult?.selected?.candidateId || '').trim(),
              parentNodeId: String(node?.state?.counterWindowEvent?.chainNodeId || node?.state?.reactionEvent?.chainNodeId || parentActionEvent?.chainNodeId || '').trim(),
              reactionNodeId: String(node?.state?.reactionEvent?.chainNodeId || '').trim(),
              chainType: node.nodeKind === 'CONTINUATION' ? 'FOLLOW_UP' : '',
            });
            if (
              naturalOpportunity &&
              String(naturalOpportunity?.status || '').trim() === 'EXECUTING'
            ) {
              naturalOpportunity.status = 'CONSUMED';
              naturalOpportunity.consumedByActionId = String(actionContext.actionEvent.actionId || '').trim();
            }
            bindStructuredFusionSource(fusion, actionContext.actionEvent.actionId, actionContext.actionName);
            registerPredictedEvidence(actionContext.actionEvent, decisionResult);
            const resolvedDeclaration = actionContext.declaration;
            const shared = { declaration: resolvedDeclaration, actionContext, reactionByTarget: {}, decisionResult };
            const hostileTargets = node.nodeKind === 'COUNTER' || structuredDamageEffects(resolvedDeclaration).length === 0
              ? []
              : resolveStructuredTargets(combatData, actor, resolvedDeclaration, structuredDamageEffects(resolvedDeclaration)[0])
                  .filter(target => inferUnitSide(combatData, previewRuntime.unitName(target)) !== inferUnitSide(combatData, previewRuntime.unitName(actor)));
            hostileTargets.forEach(target => {
              const reactionOpportunity = consumeStructuredReactionOpportunity(
                combatData,
                target,
                actionContext.actionEvent.actionId,
              );
              if (!reactionOpportunity.ok) {
                writeLedgerEvent(combatData, {
                  eventKind: 'reaction_window',
                  round: Number(combatData.回合 || 0),
                  actorName: previewRuntime.unitName(target),
                  targetName: previewRuntime.unitName(actor),
                  actionName: '即时反应窗口',
                  actionType: 'reaction_window',
                  actorControl: 'SYSTEM',
                  actionRole: 'REACTION',
                  sourceActionId: actionContext.actionEvent.actionId,
                  parentNodeId: actionContext.actionEvent.chainNodeId || '',
                  sourceNodeId: actionContext.actionEvent.chainNodeId || '',
                  result: 'unavailable',
                  resultState: 'FAILURE',
                  ruleCode: reactionOpportunity.reason,
                  opportunityId: reactionOpportunity.opportunityId || '',
                  grantId: reactionOpportunity.grantId || '',
                  meta: {
                    source: 'structured_shadow',
                    grantId: reactionOpportunity.grantId || '',
                    opportunityId: reactionOpportunity.opportunityId || '',
                    reason: reactionOpportunity.reason,
                  },
                });
                return;
              }
              queue.enqueue({
                actorEntry: { char: target, side: inferUnitSide(combatData, previewRuntime.unitName(target)) },
                actorControl: 'AI',
                actorTurnSequence: node.actorTurnSequence,
                parentActionSequence: node.actionSequence,
                phasePriority: 20,
                grantId: reactionOpportunity.grantId,
                opportunityId: reactionOpportunity.opportunityId,
                nodeKind: 'REACTION',
                actionRole: 'REACTION',
                sourceActionId: actionContext.actionEvent.actionId,
                sourceActorId: previewRuntime.unitId(actor),
                grantType: 'DEFEND_WINDOW',
                validTargetIds: [previewRuntime.unitId(actor)].filter(Boolean),
                state: { shared, targetId: previewRuntime.unitId(target) },
              });
            });
            queue.enqueue({
              actorEntry: node.actorEntry,
              actorControl: node.actorControl,
              actorTurnSequence: node.actorTurnSequence,
              parentActionSequence: node.actionSequence,
              phasePriority: 40,
              grantId: `settlement:${actionContext.actionEvent.actionId}`,
              nodeKind: 'PRIMARY_SETTLEMENT',
              actionRole: node.actionRole,
              sourceActionId: actionContext.actionEvent.actionId,
              state: { shared, continuationDepth: Number(node?.state?.continuationDepth || 0) },
            });
            queue.recordTrace('EXECUTED', node, { actionId: actionContext.actionEvent.actionId, result: 'declared' });
          } catch (error) {
            queue.fail('STRUCTURED_SHADOW_NODE_FAILED', node, { message: String(error?.message || error) });
          }
          terminal = evaluateBattleTerminal({ combatData, currentRound: combatData.回合, rounds: roundOffset, roundCompleted: false }, {});
          if (terminal?.terminal === true) {
            cancelQueueForTerminal();
            break;
          }
        }
        if (queue.fatal) throw new Error(`${queue.fatal.code}:${queue.fatal.message || ''}`);
        if (terminal?.terminal !== true) {
          settleBattleRoundEnd(combatData, logs);
        }
        terminal = evaluateBattleTerminal({ combatData, currentRound: combatData.回合, rounds: roundOffset, roundCompleted: true }, {});
        const alive = readTeamAlive(combatData);
        writeLedgerEvent(combatData, {
          eventKind: 'round_summary', round: Number(combatData.回合 || 0), actorName: 'SYSTEM', actionName: '回合总结',
          actionType: 'round_summary', actorControl: 'SYSTEM', actionRole: 'STATE_TICK', result: 'complete', resultState: 'COMPLETED',
          executionRound: roundOffset,
          meta: {
            source: 'structured_shadow',
            playerAlive: alive.playerAlive,
            enemyAlive: alive.enemyAlive,
            executionRound: roundOffset,
          },
        });
        if (terminal?.terminal === true) break;
      }
      if (evaluationSession) {
        advanceRuntimeEvaluationSession(
          eventOwnedEvaluationEnabled
            ? buildEventOwnedRuntimeSnapshot(combatData)
            : buildRuntimeDecisionSnapshot(combatData),
          terminal?.terminal === true,
        );
      }
      listCombatUnits(combatData).forEach(clearC2FoodMaintenanceRuntime);
      if (JSON.stringify(source) !== sourceJson) throw new Error('PREVIEW_MUTATED_STATE');
      const ledger = ensureLedger(combatData).map(item => cloneAuditSnapshot(item));
      const trace = collectResolutionTrace(combatData).map(normalizeCausalNode);
      const decisionAudits = decisions.map(item => cloneAuditSnapshot(item));
      const finalAlive = readTeamAlive(combatData);
      const winner = terminal?.terminal === true ? terminal.winner : 'unfinished';
      combatData.进行中 = winner === 'unfinished';
      combatData.裁断结果 = winner === 'player' ? '我方胜利' : winner === 'enemy' ? '敌方胜利' : winner === 'draw' ? '平局' : '未裁断';
      const scoringAudit = decisionAudits.map(item => ({
        round: Number(item?.round || 0),
        actor: String(item?.actorId || '').trim(),
        decisionEngine: String(item?.decisionEngine || 'LEGACY').trim().toUpperCase(),
        actionRole: normalizeActionRole(item?.actionRole || 'ACTIVE'),
        actorControl: normalizeActorControl(item?.actorControl || '', item?.selected?.playerLocked === true ? 'PLAYER_LOCKED' : 'AI'),
        opportunityId: String(item?.opportunityId || '').trim(),
        grantId: String(item?.grantId || '').trim(),
        opportunitySequence: Math.max(0, Number(item?.opportunitySequence || 0)),
        continuation: item?.continuation === true,
        selectedCandidateId: String(item?.selected?.candidateId || '').trim(),
        selectedActionName: resolveDecisionActionName(item, combatData),
        lostOpportunity: item?.lostOpportunity || null,
        candidates: (
          ['R9V2_TARGET'].includes(
            String(item?.decisionEngine || '').trim().toUpperCase(),
          ) && Array.isArray(item?.candidateAudit)
            ? item.candidateAudit
            : (Array.isArray(item?.scoreAudit) ? item.scoreAudit : [])
        ).map(candidate => cloneAuditSnapshot(candidate)),
        frozenCandidateIds: cloneAuditSnapshot(item?.frozenCandidateIds || []),
        preparedEntryCandidateIds: cloneAuditSnapshot(
          item?.preparedEntryCandidateIds || [],
        ),
        requiredProofCandidateIds: cloneAuditSnapshot(
          item?.requiredProofCandidateIds || [],
        ),
        materializedProofCandidateIds: cloneAuditSnapshot(
          item?.materializedProofCandidateIds || [],
        ),
        vectorCoverage: cloneAuditSnapshot(item?.vectorCoverage || null),
        proofCoverage: cloneAuditSnapshot(item?.proofCoverage || null),
        candidateCoverage: cloneAuditSnapshot(item?.candidateCoverage || null),
      }));
      const finalSnapshot = getBattleSnapshot(combatData);
      const publicReportBlocks = projectPublicReportBlocks(ledger).map(cloneAuditSnapshot);
      const reportBlocks = buildReportBlocks(ledger, decisionAudits, publicReportBlocks);
      const summary = buildFinalSummary(ledger, decisionAudits, finalSnapshot, combatData);
      const roundOverview = buildRoundOverview({ eventLedger: ledger, roundsExecuted, combatData }, { combatData });
      const audit = auditFacts({
        eventLedger: ledger,
        resolutionTrace: trace,
        publicReportBlocks,
        reportBlocks,
        scoringAudit,
        r9v2DecisionAudits: decisionAudits,
        scoringMutationDetected: false,
        combatData,
        initialSnapshot,
        finalSnapshot,
        actionQueueTrace: runtime.actionQueueTrace,
        roundsRequested: roundLimit,
        roundsExecuted,
      });
      return {
        caseId, seed, mode: 'structured', preview: true, inputUnchanged: true,
        providerId,
        roundsRequested: roundLimit,
        roundsExecuted,
        executedRoundNumbers: [...executedRoundNumbers],
        roundStart: executedRoundNumbers.length ? executedRoundNumbers[0] : null,
        roundEnd: executedRoundNumbers.length ? executedRoundNumbers[executedRoundNumbers.length - 1] : null,
        ledger, eventLedger: ledger, trace, resolutionTrace: trace,
        scoreAudit: decisionAudits.flatMap(entry => entry.scoreAudit || []), scoringAudit, scoringMutationDetected: false, decisions: decisionAudits,
        decisionPerformanceDiagnostics: decisionPerformanceDiagnostics.map(
          item => cloneAuditSnapshot(item),
        ),
        evaluationSessionMetrics: evaluationSession
          ? cloneAuditSnapshot(
              decisionRuntime.readEvaluationSessionMetrics(
                evaluationSession,
              ),
            )
          : null,
        decisionTrace: decisionAudits, actionChains: buildActionChains(ledger, trace), actionQueueTrace: runtime.actionQueueTrace.map(item => cloneAuditSnapshot(item)),
        reportBlocks, publicReportBlocks, roundOverview, finalBattleReport: summary.finalBattleReport,
        aiSummaryInput: summary.aiSummaryInput, finalSnapshot, snapshot: finalSnapshot, combatData: cloneValue(combatData),
        logs, initialSnapshot, terminal, objectiveResolution: terminal,
        winner,
        playerAlive: finalAlive.playerAlive,
        enemyAlive: finalAlive.enemyAlive,
        audit, beliefObservations,
      };
    } finally {
      listCombatUnits(combatData).forEach(clearC2FoodMaintenanceRuntime);
      if (evaluationSession) {
        decisionRuntime.disposeEvaluationSession(evaluationSession);
      }
      Math.random = originalRandom;
      runtimeIdContext = previousIdContext;
      runtimeIdSequence = previousIdSequence;
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
      PASS_OPPORTUNITY: '让过行动',
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
    const explicit = String(event?.factType || event?.meta?.factType || '').trim();
    if (explicit) return explicit;
    if (kind === 'action_start') return inferActionRole(event) === 'STATE_TICK' ? 'STATE_TICK' : 'ACTION_DECLARED';
    if (kind === 'target_resolution') return 'TARGET_RESOLUTION';
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

  function normalizeIdentityTargetIds(targetIds = [], targetId = '', targetName = '') {
    const explicitTargetIds = normalizeTargetIds(targetIds, targetId);
    return explicitTargetIds.length ? explicitTargetIds : normalizeTargetIds(targetName);
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
      targetIds: normalizeIdentityTargetIds(node.targetIds, node.targetId, node.targetName),
    };
  }

  function cloneAuditSnapshot(value, depth = 0) {
    if (value == null || typeof value !== 'object') return value;
    if (value.schemaVersion === 'DamageBasisV1') {
      const identity = value.identity && typeof value.identity === 'object'
        ? value.identity
        : {};
      const publicOperands = value.publicOperands &&
        typeof value.publicOperands === 'object'
        ? value.publicOperands
        : {};
      const operandKeys = [
        'damageClass',
        'damageType',
        'power',
        'powerRatio',
        'segments',
        'actionDamageMultiplier',
      ];
      return {
        schemaVersion: 'DamageBasisV1',
        basisView: String(value.basisView || '').trim().toUpperCase(),
        formulaVersion: String(value.formulaVersion || '').trim(),
        basisHash: String(value.basisHash || '').trim(),
        identity: {
          effectInstanceId: String(identity.effectInstanceId || '').trim(),
          sourceEffectId: String(identity.sourceEffectId || '').trim(),
          sourceActionId: String(identity.sourceActionId || '').trim(),
          actorId: String(identity.actorId || '').trim(),
          targetId: String(identity.targetId || '').trim(),
          snapshotRevision: String(identity.snapshotRevision || '').trim(),
        },
        publicOperands: Object.fromEntries(
          operandKeys
            .filter(key => Object.hasOwn(publicOperands, key))
            .map(key => [key, publicOperands[key]]),
        ),
      };
    }
    if (
      depth >= 6 &&
      Array.isArray(value) &&
      value.every(item => item == null || typeof item !== 'object')
    ) {
      return value.slice(0, 120);
    }
    if (depth >= 6) {
      if (
        Object.hasOwn(value, 'lower') &&
        Object.hasOwn(value, 'upper')
      ) {
        const lower = Number(value.lower);
        const upper = Number(value.upper);
        return {
          lower: Number.isFinite(lower) ? lower : 0,
          upper: Number.isFinite(upper) ? upper : 0,
        };
      }
      if (
        Object.hasOwn(value, 'actionId') &&
        Object.hasOwn(value, 'actorId') &&
        Object.hasOwn(value, 'actionKind') &&
        Array.isArray(value.targetIds)
      ) {
        return {
          actionId: String(value.actionId || '').trim(),
          actorId: String(value.actorId || '').trim(),
          actionKind: String(value.actionKind || '').trim(),
          targetIds: value.targetIds
            .slice(0, 120)
            .map(item => String(item || '').trim())
            .filter(Boolean),
        };
      }
      if (Object.hasOwn(value, 'groupKey')) {
        return {
          groupKey: String(value.groupKey || '').trim(),
          observationKeys: Array.isArray(value.observationKeys)
            ? value.observationKeys.slice(0, 120).map(item => String(item || '').trim())
            : [],
          targetIds: Array.isArray(value.targetIds)
            ? value.targetIds.slice(0, 120).map(item => String(item || '').trim())
            : [],
          value: Number(value.value || 0),
          regretBefore: Number(value.regretBefore || 0),
          expectedRegretAfter: Number(value.expectedRegretAfter || 0),
          rankingChanged: value.rankingChanged === true,
          regretBoundaryChanged: value.regretBoundaryChanged === true,
        };
      }
      if (Object.hasOwn(value, 'observationKey')) {
        return {
          observationKey: String(value.observationKey || '').trim(),
          groupKey: String(value.groupKey || '').trim(),
          targetId: String(value.targetId || '').trim(),
          selectedActionKey: String(value.selectedActionKey || '').trim(),
          alternativeActionKey: String(value.alternativeActionKey || '').trim(),
          observationCount: Math.max(0, Number(value.observationCount || 0)),
          regretBefore: Number(value.regretBefore || 0),
          expectedRegretAfter: Number(value.expectedRegretAfter || 0),
          value: Number(value.value || 0),
        };
      }
      return '[snapshot-depth-truncated]';
    }
    if (Array.isArray(value)) return value.slice(0, 120).map(item => cloneAuditSnapshot(item, depth + 1));
    const blockedKeys = new Set([
      'combatData', '__父级战斗数据', '__battleEventLedger', '__battleResolutionTrace',
      '参战者', '完整战斗数据', '完整角色', '角色对象', 'actor', 'target', 'sourceActor', 'sourceTarget',
      'sourceSkill', 'originalSkill', '_效果数组', '效果数组', '完整效果数组',
    ]);
    const result = {};
    Object.entries(value).slice(0, 120).forEach(([key, item]) => {
      if (blockedKeys.has(key) || typeof item === 'function' || typeof item === 'undefined') return;
      if (
        key === 'targetIds' &&
        Array.isArray(item) &&
        !Object.hasOwn(value, 'eventId') &&
        !Object.hasOwn(value, 'eventKind') &&
        String(value?.actionId || '').trim() &&
        String(value?.actorId || '').trim() &&
        String(value?.actionKind || '').trim()
      ) {
        result[key] = item
          .slice(0, 120)
          .map(targetId => String(targetId || '').trim())
          .filter(Boolean);
        return;
      }
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
    if (/^preview:/i.test(raw)) {
      const suffix = raw.split(':').map(part => String(part || '').trim()).filter(Boolean).at(-1) || '';
      const internalEffectNames = {
        防御修正: '防御调整',
        位移执行: '位移效果',
        伤害结算: '伤害效果',
        状态施加: '状态效果',
        状态移除: '状态移除效果',
        资源变化: '资源变化',
        资源转移: '资源转移',
        召唤生成: '召唤效果',
      };
      return internalEffectNames[suffix] || '特殊效果';
    }
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

  function isTerminalCancellationEvent(event = {}) {
    return String(event?.eventKind || '').trim() === 'blocked_action' &&
      String(event?.ruleCode || event?.meta?.reasonCode || '').trim() === 'BATTLE_TERMINAL' &&
      String(event?.meta?.reason || '').trim() === 'BATTLE_TERMINAL';
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
      'battle_objective_resolved', 'create', 'item_consume', 'complete', 'counter', 'dodge', 'defend', 'pass',
    ]);
    return (Array.isArray(eventLedger) ? eventLedger : [])
      .filter(event => supportedKinds.has(String(event?.eventKind || '').trim()))
      .filter(event => !isTerminalCancellationEvent(event))
      .map(event => {
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
        if (damage > 0) badges.push({ type: 'badge', kind: 'damage', name: '伤害', value: damage, unit: 'HP', targetId: String(event?.targetId || target).trim(), targetName: target, ...source });
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
        const expired = String(event?.ruleCode || '').trim() === 'SHIELD_WINDOW_EXPIRED' || String(event?.meta?.source || '').trim() === 'shield_window_expiry';
        content = kind === 'shield_break'
          ? expired
            ? `${prefix}${target || actor}的护盾持续时间结束，剩余${amount}点护盾消散。`
            : `${prefix}${target || actor}的护盾吸收${amount}点伤害${Number(event?.meta?.remainingShield || 0) > 0 ? '' : '后破裂'}。`
          : `${prefix}${target || actor}的护盾增加${amount}点。`;
        badges.push({ type: 'badge', kind: 'shield', name: '护盾', value: kind === 'shield_break' ? -amount : amount, unit: '护盾', targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'create' || kind === 'item_consume' || kind === 'complete') {
        const itemName = String(event?.createdName || event?.itemName || event?.meta?.itemName || action).trim();
        content = `${prefix}${actor}${kind === 'item_consume' ? '使用' : kind === 'complete' ? '完成' : '生成'}【${itemName}】。`;
        badges.push({ type: 'badge', kind: kind === 'create' ? 'item_created' : 'state', name: itemName, value: Number(event?.quantity || event?.meta?.quantity || 1), targetId: String(event?.targetId || target || actor).trim(), targetName: target || actor, ...source });
      } else if (kind === 'battle_objective_resolved') content = `${prefix}战斗条件已结算：${result || '战斗结束'}。`;
      else if (kind === 'counter') content = `${prefix}${actor}对${target || '目标'}完成反击（${result || '已结算'}）。`;
      else if (kind === 'dodge') content = `${prefix}${actor}${/success|evaded|dodged|成功|闪避/.test(result) ? '成功闪避' : '未能闪避'}${target ? `${target}的攻击` : ''}。`;
      else if (kind === 'defend') content = `${prefix}${actor}完成防御结算（${result || '已防御'}）。`;
      else if (kind === 'pass' && String(event?.actionType || '').trim().toUpperCase() === 'WITHDRAW') {
        const outcome = String(event?.primaryOutcome || '').trim();
        content = outcome === 'withdrawal_success'
          ? `${prefix}${actor}成功撤离战场。`
          : outcome === 'withdrawal_partial'
            ? `${prefix}${actor}未能完全撤离，并在追击中受伤。`
            : `${prefix}${actor}撤离失败并遭到追击。`;
      }
      else content = `${prefix}${actor}的【${action}】未能执行（${result || event?.failReason || '动作受阻'}）。`;
      const textBlock = { type: 'text', content, ...source };
      const projectionSource = kind === 'state_tick' ? 'state_tick' : 'runtime_ledger_projection';
      return normalizePublicEntry({ round, blocks: [textBlock, ...badges], projectionSource });
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
      const preferredActor = team.find(unit => previewRuntime.unitId(unit) === preferredActorId || previewRuntime.unitName(unit) === preferredActorId) || team[0] || null;
      const actionableTeam = team.filter(unit => structuredActorCanAct(unit, 'ACTIVE'));
      const actor = actionableTeam.find(unit => previewRuntime.unitId(unit) === preferredActorId || previewRuntime.unitName(unit) === preferredActorId) || actionableTeam[0] || null;
      if (!actor && preferredActor) {
        const actorName = String(preferredActor?.name || preferredActor?.名称 || summaries?.[0]?.name || label).trim();
        const reason = structuredActorIncapacityReason(preferredActor, 'ACTIVE');
        return `${actorName}当前无法取得主动行动机会${reason.startsWith('CONTROLLED:') ? `（受【${normalizeStateDisplayName(reason.slice('CONTROLLED:'.length))}】限制）` : ''}`;
      }
      const actorName = String(actor?.name || actor?.名称 || summaries?.[0]?.name || label).trim();
      if (!actor) return `${actorName}已失去战斗能力，无法继续行动`;
      if (!opponents.length) return `${actorName}已结束交锋，转入收势与战后确认`;
      const focus = currentTargets.find(pair => isSameReportName(pair?.actor, actorName));
      const selected = recentDecision?.selected && typeof recentDecision.selected === 'object'
        ? recentDecision.selected
        : null;
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
    const ledger = (Array.isArray(eventLedger) ? eventLedger : [])
      .filter(event => event && typeof event === 'object')
      .filter(event => !isTerminalCancellationEvent(event));
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
    const isOpportunityFact = event => [
      'lost_opportunity',
      'action_cancelled',
      'blocked_action',
    ].includes(String(event?.eventKind || '').trim());
    const opportunityGroupId = (event, fallback = '') => {
      if (!isOpportunityFact(event)) return '';
      const opportunityId = String(
        event?.opportunityId ||
        event?.grantId ||
        event?.meta?.opportunityId ||
        event?.meta?.grantId ||
        '',
      ).trim();
      return opportunityId ? `opportunity:${opportunityId}` : `opportunity:${String(event?.eventId || fallback).trim()}`;
    };
    const reportGroupRoot = (event, fallback = '') =>
      opportunityGroupId(event, fallback) || resolveRootActionId(event, fallback);
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
        selected?.selectedActionName ||
        selected?.skill?.name || selected?.skill?.魂技名 || selected?.declaration?.skill?.name || selected?.declaration?.skill?.魂技名 ||
        ({ BASIC_ATTACK: '普通攻击', DEFEND: '防御', EVADE: '闪避', COUNTER: '反击', GUARD: '护卫', WITHDRAW: '撤退', USE_ITEM: '使用物品', EQUIP: '更换装备' })[selected?.declaration?.actionKind || selected?.actionKind] || ''
      );
      const exactDecision = [...decisions].reverse().find(item =>
        Number(item?.回合 || item?.round || 0) === Number(round || 0) &&
        isSameReportName(readDecisionActor(item), actorName || '') &&
        (!actionName || isSameReportName(readSelectedActionName(readSelected(item)), actionName))
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
      const selectedUtility = Number(selected?.objectiveUtility || 0);
      const allAvailableChoicesNegative = selectedUtility < 0 &&
        alternatives.length > 0 &&
        alternatives.every(candidate => Number(candidate?.objectiveUtility || 0) < 0);
      let reason = problemReason;
      if (problemId === 'SURVIVAL_CRISIS' &&
        !['DEFEND', 'EVADE', 'WITHDRAW', 'COUNTER', 'GUARD'].includes(actionKind) &&
        allAvailableChoicesNegative) {
        reason = '防御与闪避都无法在当前回应中避免失能，保留最后的进攻机会';
      } else if (['BASIC_ATTACK', 'RELEASE_SKILL'].includes(actionKind) && problemIds.has('IMMINENT_DENIAL')) {
        reason = '已评估敌方蓄力风险，当前动作在整体威胁交换中收益更高';
      } else if (actionKind === 'BASIC_ATTACK' && alternatives.some(candidate => candidate?.actionKind === 'RELEASE_SKILL' || candidate?.declaration?.actionKind === 'RELEASE_SKILL')) {
        reason = `${problemReason ? `${problemReason}；` : ''}普通攻击当前能稳定推进，魂技替代的额外收益不足以覆盖代价`;
      } else if (actionKind === 'DEFEND') {
        reason = '承受迫近攻击并保留后续资源';
      } else if (actionKind === 'EVADE') {
        reason = '规避迫近攻击并等待更好的反击窗口';
      } else if (actionKind === 'RELEASE_SKILL') {
        const predictedKinds = new Set(
          (Array.isArray(selected?.predictedOutcomeEvidence) ? selected.predictedOutcomeEvidence : [])
            .map(evidence => String(evidence?.outcomeKind || '').trim().toUpperCase())
            .filter(Boolean),
        );
        const repeatedAudit = selected?.repeatedActionAudit || {};
        const crisisAudit = selected?.crisisResponseAudit || {};
        const terminalEvidence = selected?.terminalEvidence || {};
        const resourceRunwayAfter = Number(repeatedAudit?.resourceRunwayAfter);
        if (terminalEvidence?.direct?.achieved === true) {
          reason = '预计直接推进当前终局条件';
        } else if (crisisAudit?.realized === true) {
          reason = crisisAudit?.problemId === 'IMMINENT_DENIAL'
            ? '预计处理当前已公开的蓄力或行动威胁'
            : '预计降低当前危机在下一关键回应中的损失';
        } else if (repeatedAudit?.lifecycleWindowRealizable === true || Number(repeatedAudit?.repeatedActionDelta || 0) > 0) {
          reason = '重复或延续该动作仍有新的可兑现伤害、控制或持续窗口';
        } else if (predictedKinds.has('ACTION_CANCELLED') || predictedKinds.has('SUMMON_WINDOW')) {
          reason = predictedKinds.has('ACTION_CANCELLED')
            ? '预计取消真实行动机会'
            : '预计建立可在后续行动轴兑现的召唤窗口';
        } else if (predictedKinds.has('RESOURCE_OPTION_CHANGED')) {
          reason = '预计改变后续可支付动作库';
        } else if (Number.isFinite(resourceRunwayAfter) && resourceRunwayAfter > 0) {
          reason = `预计结算后仍保留${Math.floor(resourceRunwayAfter)}次同等消耗的支付能力`;
        } else if (alternatives.some(candidate =>
          Number(candidate?.objectiveUtility || 0) < Number(selectedUtility || 0) - 0.01
        )) {
          reason = '当前动作的可兑现结果高于已列出的替代方案';
        } else {
          reason = problemReason || '当前没有可验证的更高收益替代方案';
        }
      } else if (!reason) {
        reason = '在当前可用方案中取得更稳定的有效进展';
      }
      return `${String(actorName || '行动者').trim()}选择【${actionName || readSelectedActionName(selected) || '行动'}】，因为${reason}`;
    };
    const describeResolvedEffect = event => {
      if (String(event?.eventKind || '').trim() !== 'effect_resolved') return '';
      const target = String(event?.targetName || event?.targetId || event?.actorName || '目标').trim();
      const prototype = String(event?.effectPrototype || event?.meta?.effectPrototype || '').trim();
      const outcomeKind = String(event?.meta?.outcomeKind || event?.primaryOutcome || '').trim().toUpperCase();
      const evidence = event?.meta?.evidence && typeof event.meta.evidence === 'object' ? event.meta.evidence : {};
      const detail = event?.meta?.effectDetail && typeof event.meta.effectDetail === 'object' ? event.meta.effectDetail : {};
      if (String(event?.result || '').trim() === 'no_effect') return '';
      if (evidence.attribute) {
        const attribute = normalizeStateDisplayName(evidence.attribute);
        const current = Number(evidence.current);
        const next = Number(evidence.next);
        const delta = Number(evidence.delta);
        if (Number.isFinite(current) && Number.isFinite(next) && Math.abs(next - current) > 1e-9) {
          return `${target}的${attribute}${next > current ? '提升' : '降低'}至 ${Math.round(next)}（原 ${Math.round(current)}）`;
        }
        if (Number.isFinite(delta) && Math.abs(delta) > 1e-9) {
          return `${target}的${attribute}${delta > 0 ? '提升' : '降低'} ${Math.abs(Math.round(delta))}`;
        }
      }
      const state = normalizeStateDisplayName(evidence.state || evidence.interference || '');
      const duration = Math.max(0, Number(evidence.duration || 0));
      if (detail.settlement || detail.check) {
        const subject = normalizeStateDisplayName(detail.settlement || detail.check);
        const element = normalizeStateDisplayName(detail.element || '');
        const value = String(detail.value || '').trim();
        const window = Math.max(0, Number(detail.duration || 0));
        return `${target}的${element ? `${element}属性` : ''}${subject}${value ? `调整为 ${value}` : '得到调整'}${window > 0 ? `，持续 ${window} 个有效窗口` : ''}`;
      }
      if (state) return `${target}受到【${state}】影响${duration > 0 ? `，持续 ${duration} 个有效窗口` : ''}`;
      if (Array.isArray(evidence.removedKeys) && evidence.removedKeys.length) {
        return `${target}移除了 ${evidence.removedKeys.length} 项状态`;
      }
      if (evidence.rewind === true) return `${target}的战斗状态回溯至记录节点`;
      if (Number.isFinite(Number(evidence.adjustment)) && Number(evidence.adjustment) !== 0) {
        return `${target}的持续窗口${Number(evidence.adjustment) > 0 ? '延长' : '缩短'} ${Math.abs(Math.round(Number(evidence.adjustment)))} 回合`;
      }
      if (Number.isFinite(Number(evidence.multiplier)) && Number(evidence.multiplier) > 0) {
        return `${target}获得 ${Number(evidence.multiplier).toFixed(2).replace(/\.?0+$/, '')} 倍后续强化`;
      }
      if (evidence.rule) return `${target}相关规则【${normalizeStateDisplayName(evidence.rule)}】发生改变`;
      if (evidence.trigger && Number(evidence.count || 0) > 0) {
        return `${target}获得 ${Math.max(1, Math.round(Number(evidence.count)))} 项可在【${normalizeStateDisplayName(evidence.trigger)}】触发的机制`;
      }
      if (outcomeKind === 'BELIEF_CHANGED' && evidence.interference) {
        return `${target}的目标判断受到【${normalizeStateDisplayName(evidence.interference)}】干扰`;
      }
      return prototype ? `${target}的【${normalizeStateDisplayName(prototype)}】效果已经生效` : '';
    };
    const describeProjectedFact = event => {
      const resolvedEffect = describeResolvedEffect(event);
      if (resolvedEffect) return resolvedEffect;
      const kind = String(event?.eventKind || '').trim();
      const actor = String(event?.actorName || event?.actorId || '行动者').trim();
      const target = String(event?.targetName || event?.targetId || '').trim();
      const action = normalizeStateDisplayName(normalizeActionDisplayName(
        event?.finalActionName || event?.actionName || event?.sourceActionName || '行动',
      ));
      const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
      const reasonText = String(meta?.reasonText || event?.reasonText || '').trim();
      const reasonCode = String(meta?.reasonCode || event?.ruleCode || event?.failReason || '').trim();
      const state = normalizeStateDisplayName(meta?.stateName || '');
      if (kind === 'lost_opportunity' || (
        ['blocked_action', 'action_cancelled'].includes(kind) &&
        (
          String(event?.actionType || '').trim() === 'opportunity_cancelled' ||
          /失去行动|行动取消/.test(action)
        )
      )) {
        const reason = reasonText ||
          (state ? `受【${state}】影响` : '') ||
          (/UNCONSCIOUS/i.test(reasonCode) ? '处于昏迷状态' : '') ||
          (/DEAD|INCAPACITATED/i.test(reasonCode) ? '已经失去战斗能力' : '') ||
          (/CONTROLLED/i.test(reasonCode) ? '受控制影响' : '') ||
          '当前状态无法行动';
        return `${actor}${/^受【/.test(reason) ? reason : `因${reason}`}失去本次行动机会`;
      }
      if (kind === 'counter') {
        if (/declined|放弃/i.test(`${event?.result || ''} ${event?.resultState || ''} ${action}`)) {
          return `${actor}放弃${target ? `对${target}的` : ''}反击`;
        }
        return `${actor}${target ? `对${target}` : ''}执行【${action || '反击'}】`;
      }
      if (['blocked_action', 'failed_action', 'target_fail', 'action_cancelled'].includes(kind)) {
        return reasonText
          ? `${actor}的【${action}】未能执行：${reasonText}`
          : `${actor}的【${action}】未能执行`;
      }
      return String(event?.effectSummary || '').trim();
    };
    const projectFact = event => {
      const kind = String(event?.eventKind || '').trim();
      const actionRole = normalizeActionRole(event?.actionRole || inferActionRole(event));
      const damage = Math.max(0, Math.round(Number(readLedgerNumber(event, 'damage') || 0)));
      const amount = Math.round(Number(event?.meta?.delta ?? readLedgerNumber(event, 'amount') ?? 0));
      const summonName = kind === 'summon_create' ? String(event?.meta?.summonName || event?.summonName || '').trim() : '';
      const targetName = String(event?.targetName || summonName || '').trim();
      const summary = describeProjectedFact(event);
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
        actorSide: String(event?.actorSide || '').trim(),
        targetId: String(event?.targetId || targetName || '').trim(),
        targetName,
        targetSide: String(event?.targetSide || '').trim(),
        actionName: normalizeStateDisplayName(normalizeActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '')),
        actionRole,
        resultState: String(event?.result || event?.actionStatus || '').trim(),
        value: damage > 0 ? damage : amount,
        resource: String(event?.meta?.resource || '').trim(),
        stateName: ['state_apply', 'state_replace', 'state_remove', 'state_tick'].includes(kind) ? readLedgerStateName(event) : '',
        duration: Math.max(0, Number(event?.duration || event?.meta?.duration || 0)),
        reasonCode: String(event?.failReason || event?.meta?.reasonCode || event?.meta?.reason || event?.ruleCode || '').trim(),
        reasonText: String(event?.meta?.reasonText || '').trim(),
        effectPrototype: String(event?.effectPrototype || event?.meta?.effectPrototype || '').trim(),
        outcomeKind: String(event?.meta?.outcomeKind || event?.primaryOutcome || '').trim(),
        effectEvidence: cloneValue(event?.meta?.evidence || {}),
        effectDetail: cloneValue(event?.meta?.effectDetail || {}),
        effectSummary: describeResolvedEffect(event),
        summary,
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
    const summonWindowClosed = createEvent => {
      const createIndex = eventIndexById.get(String(createEvent?.eventId || '').trim());
      if (!Number.isFinite(createIndex)) return false;
      const summonKey = String(createEvent?.targetId || createEvent?.meta?.summonKey || '').trim();
      const summonName = String(createEvent?.meta?.summonName || createEvent?.targetName || '').trim();
      const windowId = String(createEvent?.meta?.windowId || '').trim();
      return ledger.slice(createIndex + 1).some(event => {
        const sameSummonKey = !!summonKey &&
          [event?.actorId, event?.targetId, event?.meta?.summonKey].some(value => String(value || '').trim() === summonKey);
        const sameSummonName = !!summonName &&
          [event?.actorName, event?.targetName, event?.meta?.summonName].some(value => String(value || '').trim() === summonName);
        if (!sameSummonKey && !sameSummonName) return false;
        const kind = String(event?.eventKind || '').trim();
        const role = normalizeActionRole(event?.actionRole || inferActionRole(event));
        const grantId = String(event?.meta?.grantId || '').trim();
        return (kind === 'action_start' && role === 'ASSIST') ||
          (['target_fail', 'blocked_action', 'failed_action'].includes(kind) && (role === 'ASSIST' || (windowId && grantId.includes(windowId)))) ||
          kind === 'summon_end';
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
          if (first.actionRole === 'COUNTER') push(`${actor}以【${action}】反击${target}，但未能命中`);
          else push(`${actor}对${target}使用【${action}】，但未能命中`);
        } else {
          if (first.actionRole === 'COUNTER') push(`${actor}以【${action}】反击${target}，但未造成实质伤害`);
          else push(`${actor}对${target}使用【${action}】，但未造成实质伤害`);
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
        if (fact.eventKind === 'pass' && (
          String(fact.actionName || '').trim() === '撤退' ||
          /^withdrawal_/.test(String(fact.outcomeKind || '').trim())
        )) {
          if (String(fact.outcomeKind || '').trim() === 'withdrawal_success' || /withdrawn|success/i.test(String(fact.resultState || '').trim())) {
            push(`${actor}成功撤离战场`);
          } else if (
            String(fact.outcomeKind || '').trim() === 'withdrawal_partial' ||
            /partial/i.test(String(fact.resultState || '').trim())
          ) {
            push(`${actor}未能完全撤离，并在追击中受伤`);
          } else {
            push(`${actor}撤离失败并遭到追击`);
          }
          return;
        }
        if (['failed_action', 'blocked_action', 'target_fail'].includes(fact.eventKind)) {
          if (fact.eventKind === 'blocked_action' && (
            /失去行动/.test(action) ||
            /UNCONSCIOUS|INCAPACITATED|CONTROLLED|DEAD/i.test(String(fact.reasonCode || ''))
          )) {
            const reason = /UNCONSCIOUS/i.test(String(fact.reasonCode || '')) ? '昏迷' :
              /DEAD|INCAPACITATED/i.test(String(fact.reasonCode || '')) ? '失去战斗能力' :
                /CONTROLLED/i.test(String(fact.reasonCode || '')) ? '受控制影响' : '当前状态限制';
            push(`${actor}因${reason}失去本回合行动机会`);
            return;
          }
          push(`${actor}的【${action}】未能生效`);
          return;
        }
        if (fact.eventKind === 'shield_create' && value > 0) {
          push(`${target}获得 ${value} 点护盾`);
          return;
        }
        if (fact.eventKind === 'shield_break' && value > 0) {
          if (String(fact.reasonCode || '').trim() === 'SHIELD_WINDOW_EXPIRED') {
            push(`${target}的护盾持续时间结束，剩余 ${value} 点护盾消散`);
          } else {
            push(Number(fact?.meta?.remainingShield || 0) > 0
              ? `${target}的护盾吸收 ${value} 点伤害`
              : `${target}的护盾吸收 ${value} 点伤害后破裂`);
          }
          return;
        }
        if (fact.eventKind === 'create') {
          push(`${actor}通过【${action}】完成造物`);
          return;
        }
        if (fact.eventKind === 'effect_resolved' && fact.effectSummary) {
          push(fact.effectSummary);
        }
      });
      const declarations = facts.filter(fact => ['action_start', 'charge_start', 'pass'].includes(fact.eventKind));
      const declared = declarations.find(fact => fact.actionRole === 'ACTIVE') || declarations[0];
      const reactionPhrases = declarations
        .filter(fact => fact.actionRole === 'REACTION' && fact.actionName)
        .filter(fact => !lines.some(line => line.includes(`【${fact.actionName}】`)))
        .map(fact => declared?.actionName
          ? `面对${declared.actorName || '对手'}的【${declared.actionName}】，${fact.actorName || '目标'}以【${fact.actionName}】应对`
          : `${fact.actorName || '目标'}以【${fact.actionName}】作出应对`
        );
      if (reactionPhrases.length) lines.unshift(...reactionPhrases);
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
    const claimedActionBlockEventIds = new Set();
    entries.forEach((entry, entryIndex) => {
      const sourceIds = readSourceIds(entry);
      const events = sourceIds
        .map(id => eventById.get(id))
        .filter(Boolean)
        .filter(event => String(event?.eventKind || '').trim() !== 'battle_objective_resolved')
        .filter(event => !claimedActionBlockEventIds.has(String(event?.eventId || '').trim()));
      const fallbackGroupId = `report_${Number(entry?.round || 0)}_${entryIndex + 1}`;
      const eventsByGroup = new Map();
      events.forEach(event => {
        const rootActionId = reportGroupRoot(event, fallbackGroupId);
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
        groupEventIds.forEach(eventId => claimedActionBlockEventIds.add(eventId));
        group.badges.push(...(Array.isArray(entry?.blocks) ? entry.blocks : []).filter(block =>
          block?.type === 'badge' && (!String(block?.sourceEventId || '').trim() || groupEventIds.has(String(block.sourceEventId).trim()))
        ));
      });
    });
    ledger.forEach((event, index) => {
      const eventKind = String(event?.eventKind || '').trim();
      const eventId = String(event?.eventId || '').trim();
      if (!eventKind || eventKind === 'battle_objective_resolved' || claimedActionBlockEventIds.has(eventId)) return;
      const round = Number(event?.round || event?.sourceRound || 0);
      const factDomain = factDomainOf(event);
      const rootActionId = reportGroupRoot(event, `ledger_${round}_${index + 1}`);
      const actionGroupId = factDomain === 'action' ? rootActionId : `${rootActionId}:${factDomain}:${round}`;
      const groupKey = `${round}::${factDomain}::${rootActionId}`;
      if (!groupedEntries.has(groupKey)) groupedEntries.set(groupKey, { actionGroupId, events: [], badges: [], firstIndex: entries.length + index });
      groupedEntries.get(groupKey).events.push(event);
      if (eventId) claimedActionBlockEventIds.add(eventId);
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
        .filter(badge => badge.kind !== 'shield' || badge.value !== 0)
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
      const nextWindow = summonWindow && !summonWindowClosed(summonWindow)
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
        targetIds: (() => {
          const declaredTargets = normalizeIdentityTargetIds(primary?.targetIds, primary?.targetId, primary?.targetName);
          if (declaredTargets.length) return declaredTargets;
          return [...new Set(events.flatMap(event =>
            normalizeIdentityTargetIds(event?.targetIds, event?.targetId, event?.targetName)
          ).filter(Boolean))];
        })(),
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
      const roundActionBlocks = actionBlocks.filter(block =>
        Number(block?.round || 0) === round &&
        ['ACTION_RESOLVED', 'REACTION_RESOLVED', 'SUMMON_ACTION'].includes(block?.blockType)
      );
      const describeSideActions = (side, label) => {
        const actions = roundActionBlocks
          .map(block => {
            const declared = (block?.facts || []).find(fact =>
              ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim()) &&
              String(fact?.actorSide || '').trim() === side &&
              normalizeActionRole(fact?.actionRole || 'ACTIVE') === 'ACTIVE'
            );
            if (!declared) return '';
            return `${declared.actorName || '行动者'}以【${declared.actionName || '行动'}】${declared.targetName ? `指向${declared.targetName}` : '展开行动'}`;
          })
          .filter((text, index, list) => text && list.indexOf(text) === index);
        if (!actions.length) return '';
        const remaining = actions.length - 2;
        return `${label}${actions.slice(0, 2).join('，')}${remaining > 0 ? `，另有 ${remaining} 次主动行动` : ''}`;
      };
      const intentSummary = [
        describeSideActions('player', '我方：'),
        describeSideActions('enemy', '敌方：'),
      ].filter(Boolean).join('；');
      const activeState = facts.find(fact =>
        fact.duration > 0 && fact.stateName && !/resist|抵抗|抵住|immune|免疫/i.test(String(fact?.resultState || ''))
      );
      const damageFacts = facts.filter(fact => fact.factType === 'DAMAGE' && Number(fact.value || 0) > 0);
      const largestDamage = [...damageFacts]
        .sort((left, right) => Number(right.value || 0) - Number(left.value || 0))[0];
      const appliedState = facts.find(fact =>
        fact.factType === 'STATE_CHANGE' &&
        fact.stateName &&
        !/resist|抵抗|抵住|immune|免疫/i.test(String(fact?.resultState || ''))
      );
      const summonFact = facts.find(fact => fact.factType === 'SUMMON');
      const resolvedEffect = facts.find(fact =>
        fact.eventKind === 'effect_resolved' &&
        fact.effectSummary &&
        !/已经生效$/.test(String(fact.effectSummary))
      );
      const inventoryFact = facts.find(fact => ['create', 'item_consume'].includes(String(fact?.eventKind || '').trim()));
      const equipmentFact = facts.find(fact =>
        fact.eventKind === 'complete' &&
        String(fact?.outcomeKind || '').trim() === 'equipment_changed'
      );
      const outcomeHighlights = [];
      const damageBySide = damageFacts.reduce((totals, fact) => {
        const side = String(fact?.actorSide || '').trim();
        if (side === 'player' || side === 'enemy') totals[side] += Math.round(Number(fact.value || 0));
        return totals;
      }, { player: 0, enemy: 0 });
      if (damageBySide.player > 0 && damageBySide.enemy > 0) {
        outcomeHighlights.push(`本回合交锋中，我方共造成 ${damageBySide.player} 点伤害，敌方共造成 ${damageBySide.enemy} 点伤害`);
      } else if (damageFacts.length > 1 && damageBySide.player > 0) {
        outcomeHighlights.push(`本回合我方共造成 ${damageBySide.player} 点伤害`);
      } else if (damageFacts.length > 1 && damageBySide.enemy > 0) {
        outcomeHighlights.push(`本回合敌方共造成 ${damageBySide.enemy} 点伤害`);
      } else if (largestDamage) {
        outcomeHighlights.push(`${largestDamage.actorName || '行动者'}以【${largestDamage.actionName || '行动'}】对${largestDamage.targetName || '目标'}造成 ${Math.round(Number(largestDamage.value || 0))} 点伤害`);
      }
      if (appliedState) outcomeHighlights.push(`${appliedState.targetName || '目标'}受到【${appliedState.stateName}】影响`);
      if (summonFact) outcomeHighlights.push(`${summonFact.actorName || '行动者'}生成或驱动召唤单位`);
      if (resolvedEffect) outcomeHighlights.push(resolvedEffect.effectSummary);
      if (inventoryFact) {
        outcomeHighlights.push(`${inventoryFact.actorName || '行动者'}通过【${inventoryFact.actionName || '物品行动'}】${inventoryFact.eventKind === 'create' ? '完成造物' : '消耗物品'}`);
      }
      if (equipmentFact) outcomeHighlights.push(`${equipmentFact.actorName || '行动者'}完成【${equipmentFact.actionName || '装备'}】的穿戴`);
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
        outcomeSummary: outcomeHighlights.length
          ? outcomeHighlights.slice(0, 3).join('；')
          : `第${round}回合完成 ${roundActionBlocks.length} 个动作组，没有出现伤害、状态或召唤变化`,
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
      }
      if (kind === 'action_cost' && event?.meta?.auditOnly !== true) {
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
        if (stateName) pushHighlight(round, `${target || actor}陷入【${stateName}】`, /眩晕|麻痹|僵直|沉默|封技|禁锢|束缚|定身|冻结/.test(stateName) ? 7 : 4, event);
      } else if (kind === 'state_apply' && stateWasImmune(event)) {
        const stateName = readLedgerStateName(event);
        if (stateName) pushHighlight(round, `${target || actor}免疫【${stateName}】`, /眩晕|麻痹|僵直|沉默|封技|禁锢|束缚|定身|冻结/.test(stateName) ? 6 : 3, event);
      } else if (kind === 'state_apply' && stateWasResisted(event)) {
        const stateName = readLedgerStateName(event);
        if (stateName) pushHighlight(round, `${target || actor}抵住【${stateName}】`, /眩晕|麻痹|僵直|沉默|封技|禁锢|束缚|定身|冻结/.test(stateName) ? 6 : 3, event);
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
    const combatData = payload.combatData && typeof payload.combatData === 'object' ? payload.combatData : {};
    const scoringAudit = Array.isArray(payload.scoringAudit) ? payload.scoringAudit.filter(Boolean) : [];
    const factRegistry = Array.isArray(payload.factRegistry) ? payload.factRegistry.filter(Boolean) : [];
    const r9v2DecisionAudits = Array.isArray(payload.r9v2DecisionAudits)
      ? payload.r9v2DecisionAudits.filter(Boolean)
      : [];
    const transactionAudit = payload.transactionAudit && typeof payload.transactionAudit === 'object' ? payload.transactionAudit : null;
    const visibilityAudit = payload.visibilityAudit && typeof payload.visibilityAudit === 'object' ? payload.visibilityAudit : null;
    const beliefAudit = payload.beliefAudit && typeof payload.beliefAudit === 'object' ? payload.beliefAudit : null;
    const initialSnapshot = payload.initialSnapshot && typeof payload.initialSnapshot === 'object' ? payload.initialSnapshot : null;
    const finalSnapshot = payload.finalSnapshot && typeof payload.finalSnapshot === 'object' ? payload.finalSnapshot : null;
    const fatals = [];
    const warnings = [];
    const pushFatal = (code, detail = {}) => fatals.push({ code, ...detail });
    const readDamage = event => Math.max(0, Math.round(Number(event?.appliedDamage ?? event?.meta?.appliedDamage ?? event?.meta?.damage ?? event?.damage ?? 0)));
    const resourceOperations = new Set([
      'PAY',
      'RESTORE',
      'REDUCE',
      'LOCK',
      'UNLOCK',
      'REFUND',
      'NATURAL_RECOVERY',
      'SUSTAIN_COST',
      'ITEM_CONSUME',
    ]);
    const readProbability = value => {
      if (value === null || value === undefined || value === '') return null;
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

    if (transactionAudit?.commitAttempted === true) {
      const sealStatus = String(transactionAudit?.sealStatus || '').trim().toUpperCase();
      if (sealStatus !== 'SEALED') {
        pushFatal('BATTLE_COMMIT_BEFORE_REPORT_SEAL', { sealStatus: sealStatus || 'MISSING' });
      } else {
        const draftHash = String(transactionAudit?.draftHash || '').trim();
        const reportHash = String(transactionAudit?.reportHash || '').trim();
        const committedDraftHash = String(transactionAudit?.committedDraftHash || '').trim();
        const committedReportHash = String(transactionAudit?.committedReportHash || '').trim();
        if (!draftHash || !reportHash || draftHash !== committedDraftHash || reportHash !== committedReportHash) {
          pushFatal('BATTLE_COMMIT_HASH_MISMATCH', {
            draftHash,
            reportHash,
            committedDraftHash,
            committedReportHash,
          });
        }
      }
    }
    const factOwners = new Map();
    factRegistry.forEach((fact, index) => {
      const factId = String(fact?.factId || fact?.sourceEventId || '').trim();
      const ownerId = String(fact?.canonicalFactOwner || fact?.ownerId || '').trim();
      if (!factId || !ownerId) return;
      if (factOwners.has(factId) && factOwners.get(factId) !== ownerId) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', {
          factId,
          ownerId,
          existingOwnerId: factOwners.get(factId),
          index,
        });
        return;
      }
      factOwners.set(factId, ownerId);
    });
    if (String(visibilityAudit?.mode || '').trim().toUpperCase() === 'PLAYER') {
      const hiddenFactIds = new Set((Array.isArray(visibilityAudit?.hiddenFactIds) ? visibilityAudit.hiddenFactIds : [])
        .map(value => String(value || '').trim())
        .filter(Boolean));
      const leakedFactIds = [
        ...(Array.isArray(visibilityAudit?.publicFactIds) ? visibilityAudit.publicFactIds : []),
        ...(Array.isArray(visibilityAudit?.aiFactIds) ? visibilityAudit.aiFactIds : []),
      ].map(value => String(value || '').trim()).filter(factId => hiddenFactIds.has(factId));
      if (leakedFactIds.length) {
        pushFatal('REPORT_VISIBILITY_LEAK', { factIds: [...new Set(leakedFactIds)] });
      }
    }
    const hiddenBeliefReads = (Array.isArray(beliefAudit?.hiddenStateReads) ? beliefAudit.hiddenStateReads : [])
      .map(value => String(value || '').trim())
      .filter(Boolean);
    if (hiddenBeliefReads.length) {
      pushFatal('BELIEF_HIDDEN_STATE_LEAK', { reads: [...new Set(hiddenBeliefReads)] });
    }

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
        const stateShield = Object.values(unit?.状态效果 || {}).reduce(
          (sum, condition) => sum + Math.max(0, Number(condition?.shield_value || 0)),
          0,
        );
        units.push({
          key: `${side}|${name}`,
          side,
          name,
          values: {
            hp: Math.round(Number(unit?.hp ?? unit?.HP ?? 0)),
            vit: Math.round(Number(unit?.vit ?? unit?.sta ?? unit?.体力 ?? 0)),
            sp: Math.round(Number(unit?.sp ?? unit?.魂力 ?? 0)),
            men: Math.round(Number(unit?.men ?? unit?.精神力 ?? 0)),
            shield: Math.round(Math.max(Number(unit?.shield ?? unit?.护盾 ?? 0), stateShield)),
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
      const uniqueMatches = [...new Map(matches.map(unit => [unit.key, unit])).values()];
      return uniqueMatches.length === 1 ? uniqueMatches[0] : null;
    };
    const balanceDeltas = new Map();
    const addBalanceDelta = (name, side, resource, delta, eventId) => {
      const normalizedResource = normalizeBalanceResourceKey(resource);
      const amount = Number(delta || 0);
      const unit = findBalanceUnit(name, side);
      if (!unit || !normalizedResource || !Number.isFinite(amount) || amount === 0) return;
      const key = `${unit.key}|${normalizedResource}`;
      const entry = balanceDeltas.get(key) || { delta: 0, eventIds: [] };
      entry.delta += amount;
      if (eventId) entry.eventIds.push(String(eventId));
      balanceDeltas.set(key, entry);
    };
    eventLedger.forEach(event => {
      const kind = String(event?.eventKind || '').trim();
      const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
      if (
        kind === 'resource_change' &&
        Math.abs(Number(meta.delta ?? event?.delta ?? 0)) > 1e-9 &&
        meta.auditOnly !== true &&
        !resourceOperations.has(String(event?.operation || meta.operation || '').trim().toUpperCase())
      ) {
        pushFatal('RESOURCE_TIMELINE_OPERATION_MISSING', {
          eventId: event?.eventId || '',
          operation: String(event?.operation || meta.operation || '').trim(),
        });
      }
      if (kind === 'counter') {
        const trace = Array.isArray(meta.settlementTrace) ? meta.settlementTrace : [];
        const mirroredDamage = Number(
          meta.resolvedDamage ??
          meta.damage ??
          trace.find(item => String(item?.key || '').trim() === 'finalDamage')?.value ??
          0,
        );
        if (
          readDamage(event) > 0 ||
          mirroredDamage > 0
        ) {
          pushFatal('COUNTER_WRAPPER_DAMAGE_OWNERSHIP', {
            eventId: event?.eventId || '',
            settlementEventId: String(meta.settlementEventId || '').trim(),
            mirroredDamage,
          });
        }
      }
    });

    eventLedger.forEach(event => {
      const kind = String(event?.eventKind || '').trim();
      const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
      const eventId = String(event?.eventId || '').trim();
      const targetName = String(event?.targetName || event?.actorName || '').trim();
      const targetSide = String(event?.targetSide || event?.actorSide || '').trim();
      if (kind === 'action_cost' && meta.auditOnly !== true) {
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
          const exactExpectedFinalValue = initialValue + balance.delta;
          const expectedFinalValue = Math.round(exactExpectedFinalValue);
          if (finalValue !== expectedFinalValue) {
            pushFatal('LEDGER_CONSERVATION_MISMATCH', {
              unit: initialUnit.name,
              side: initialUnit.side,
              resource,
              initialValue,
              finalValue,
              ledgerDelta: balance.delta,
              exactExpectedFinalValue,
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
      const key = applicationId ? [
        applicationId,
        Number(event?.round || event?.sourceRound || 0),
        String(event?.meta?.windowId || event?.windowId || '').trim(),
      ].join('|') : [
        Number(event?.round || 0),
        String(event?.actionId || event?.sourceActionId || '').trim(),
        String(event?.actorId || event?.actorName || '').trim(),
        String(event?.targetId || event?.targetName || '').trim(),
        normalizeActionDisplayName(event?.actionName || event?.sourceActionName || ''),
        String(event?.eventKind || '').trim(),
        String(event?.meta?.stateName || event?.stateName || '').trim(),
        String(event?.meta?.sourceActorName || '').trim(),
        String(event?.meta?.sourceActionName || '').trim(),
        Number(event?.meta?.sourceRound || 0),
        Number(event?.meta?.effectIndex ?? -1),
        Number(event?.meta?.segmentIndex ?? event?.meta?.segment ?? event?.segment ?? 0),
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
        if (readDamage(event) > 0) {
          const sourceActorName = String(event?.meta?.sourceActorName || event?.actorName || '').trim();
          const sourceActionName = normalizeActionDisplayName(event?.meta?.sourceActionName || event?.sourceActionName || event?.actionName || '');
          const sourceActionId = String(event?.meta?.sourceActionId || event?.sourceActionId || '').trim();
          const applicationId = String(event?.meta?.applicationId || event?.applicationId || '').trim();
          const sourceRound = Math.max(0, Number(event?.meta?.sourceRound || event?.sourceRound || 0));
          if (!sourceActorName || !sourceActionName || !sourceActionId || !applicationId || sourceRound <= 0) {
            pushFatal('DOT_SOURCE_MISSING', {
              eventId,
              sourceActorName,
              sourceActionName,
              sourceActionId,
              applicationId,
              sourceRound,
            });
          }
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
    eventLedger.filter(event =>
      String(event?.eventKind || '').trim() === 'summon_create' &&
      String(event?.meta?.summonMode || event?.summonMode || '').trim() === '协同攻击' &&
      event?.meta?.grantAvailable !== false
    ).forEach(createEvent => {
      const createIndex = eventLedger.indexOf(createEvent);
      const summonKey = String(createEvent?.targetId || createEvent?.meta?.summonKey || '').trim();
      const summonName = String(createEvent?.meta?.summonName || createEvent?.targetName || '').trim();
      const windowId = String(createEvent?.meta?.windowId || '').trim();
      const closed = eventLedger.slice(createIndex + 1).some(event => {
        const sameSummonKey = !!summonKey &&
          [event?.actorId, event?.targetId, event?.meta?.summonKey].some(value => String(value || '').trim() === summonKey);
        const sameSummonName = !!summonName &&
          [event?.actorName, event?.targetName, event?.meta?.summonName].some(value => String(value || '').trim() === summonName);
        const sameSummon = sameSummonKey || sameSummonName;
        if (!sameSummon) return false;
        const kind = String(event?.eventKind || '').trim();
        const role = String(event?.actionRole || '').trim();
        const grantId = String(event?.meta?.grantId || '').trim();
        return (kind === 'action_start' && role === 'ASSIST') ||
          (['target_fail', 'blocked_action', 'failed_action'].includes(kind) && (role === 'ASSIST' || (windowId && grantId.includes(windowId)))) ||
          (kind === 'summon_end' && ['SUMMON_WINDOW_EXHAUSTED', 'BATTLE_TERMINAL', 'SUMMON_REMOVED'].includes(String(event?.ruleCode || event?.reasonCode || '').trim()));
      });
      if (!closed) pushFatal('SUMMON_WINDOW_MISSING', {
        summonName,
        summonKey,
        windowId,
        createEventId: createEvent?.eventId || '',
      });
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
        return (kind === 'action_start' && (
          /summon_assist|召唤自主行动/.test(actionType) ||
          String(event?.actionRole || '').trim() === 'ASSIST'
        )) ||
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

    const actionStartsById = new Map(eventLedger
      .filter(event => ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()))
      .map(event => [String(event?.actionId || '').trim(), event])
      .filter(([actionId]) => !!actionId));
    eventLedger
      .filter(event =>
        String(event?.eventKind || '').trim() ===
          'target_resolution'
      )
      .forEach(event => {
        const actionId = String(
          event?.actionId || event?.sourceActionId || '',
        ).trim();
        const actionStart = actionStartsById.get(actionId);
        const declaredTargetId = String(
          event?.declaredTargetId ||
          event?.meta?.declaredTargetId ||
          '',
        ).trim();
        const resolvedTargetId = String(
          event?.resolvedTargetId ||
          event?.meta?.resolvedTargetId ||
          '',
        ).trim();
        const targetSetHash = String(
          event?.targetSetHash ||
          event?.meta?.targetSetHash ||
          '',
        ).trim();
        const eligibleTargetIds =
          Array.isArray(event?.meta?.eligibleTargetIds)
            ? event.meta.eligibleTargetIds
                .map(value => String(value || '').trim())
                .filter(Boolean)
            : [];
        if (
          !actionId ||
          !declaredTargetId ||
          !resolvedTargetId ||
          !targetSetHash ||
          !eligibleTargetIds.includes(resolvedTargetId)
        ) {
          pushFatal('TARGET_RESOLUTION_FACT_INCOMPLETE', {
            eventId: String(event?.eventId || '').trim(),
            actionId,
            declaredTargetId,
            resolvedTargetId,
            targetSetHash,
            eligibleTargetIds,
          });
          return;
        }
        if (
          !actionStart ||
          Number(event?.sequence || 0) >=
            Number(actionStart?.sequence || 0) ||
          String(
            actionStart?.resolvedTargetId ||
            actionStart?.meta?.resolvedTargetIds?.[0] ||
            actionStart?.targetId ||
            '',
          ).trim() !== resolvedTargetId ||
          String(
            actionStart?.resolutionEventId ||
            actionStart?.meta?.targetResolutionEventId ||
            '',
          ).trim() !== String(event?.eventId || '').trim()
        ) {
          pushFatal('TARGET_RESOLUTION_ACTION_MISMATCH', {
            eventId: String(event?.eventId || '').trim(),
            actionId,
            actionStartEventId:
              String(actionStart?.eventId || '').trim(),
            declaredTargetId,
            resolvedTargetId,
          });
        }
      });
    const combatUnitNameById = new Map(listCombatUnits(combatData).map(unit => [
      previewRuntime.unitId(unit),
      previewRuntime.unitName(unit),
    ]).filter(([unitId, name]) => unitId && name));
    eventLedger.forEach(event => {
      const actorId = String(event?.actorId || '').trim();
      const actorName = String(event?.actorName || '').trim();
      if (
        actorId &&
        actorName &&
        (!combatUnitNameById.has(actorId) || combatUnitNameById.get(actorId) === actorId)
      ) {
        combatUnitNameById.set(actorId, actorName);
      }
    });
    eventLedger.forEach(event => {
      const targetId = String(event?.targetId || '').trim();
      const targetName = String(event?.targetName || '').trim();
      if (targetId && targetName && (!combatUnitNameById.has(targetId) || combatUnitNameById.get(targetId) === targetId)) {
        combatUnitNameById.set(targetId, targetName);
      }
    });
    const sourceTargetsActor = (sourceAction, actorName) => [
      sourceAction?.targetName,
      ...(Array.isArray(sourceAction?.targetIds) ? sourceAction.targetIds : []),
    ].some(target =>
      isSameReportName(target || '', actorName || '') ||
      isSameReportName(
        combatUnitNameById.get(String(target || '').trim()) || '',
        actorName || '',
      )
    );
    eventLedger.forEach(event => {
      const kind = String(event?.eventKind || '').trim();
      const role = normalizeActionRole(event?.actionRole || 'ACTIVE');
      const actorName = String(event?.actorName || '').trim();
      const targetName = String(event?.targetName || '').trim();
      const sourceActionId = String(event?.sourceActionId || '').trim();
      const sourceAction = sourceActionId ? actionStartsById.get(sourceActionId) : null;
      const reactionNodeId = String(event?.reactionNodeId || event?.meta?.reactionWindowNodeId || '').trim();
      if (
        ['defend', 'dodge'].includes(kind) &&
        role === 'ACTIVE' &&
        event?.meta?.preparedDefense === true &&
        reactionNodeId
      ) {
        pushFatal('REACTION_SELF_SOURCE_INVALID', {
          eventId: event?.eventId || '',
          actorName,
          sourceActionId,
          reactionNodeId,
          reason: 'ACTIVE_STANCE_CREATED_REACTION_WINDOW',
        });
      }
      if (['dodge', 'defend', 'pass'].includes(kind) && role === 'REACTION') {
        const sourceActorName = String(sourceAction?.actorName || '').trim();
        if (
          !sourceAction ||
          !actorName ||
          !sourceActorName ||
          isSameReportName(actorName, sourceActorName) ||
          !isSameReportName(targetName, sourceActorName) ||
          !sourceTargetsActor(sourceAction, actorName)
        ) {
          pushFatal('REACTION_SELF_SOURCE_INVALID', {
            eventId: event?.eventId || '',
            actorName,
            targetName,
            sourceActionId,
            sourceActorName,
            reason: !sourceAction ? 'REACTION_SOURCE_ACTION_MISSING' : 'REACTION_SOURCE_CAUSAL_MISMATCH',
          });
        }
      }
      if (kind === 'counter_window') {
        const sourceActorName = String(sourceAction?.actorName || '').trim();
        if (
          !sourceAction ||
          !actorName ||
          !sourceActorName ||
          isSameReportName(actorName, sourceActorName) ||
          !isSameReportName(targetName, sourceActorName) ||
          !sourceTargetsActor(sourceAction, actorName)
        ) {
          pushFatal('COUNTER_ACTOR_SOURCE_INVALID', {
            eventId: event?.eventId || '',
            actorName,
            targetName,
            sourceActionId,
            sourceActorName,
            reason: !sourceAction ? 'COUNTER_SOURCE_ACTION_MISSING' : 'COUNTER_WINDOW_CAUSAL_MISMATCH',
          });
        }
      }
      if ((kind === 'action_start' && role === 'COUNTER') || kind === 'counter') {
        const sourceActorName = String(sourceAction?.actorName || '').trim();
        if (
          !sourceAction ||
          !actorName ||
          !sourceActorName ||
          isSameReportName(actorName, sourceActorName) ||
          !isSameReportName(targetName, sourceActorName) ||
          (kind === 'action_start' && !sourceTargetsActor(sourceAction, actorName))
        ) {
          pushFatal('COUNTER_ACTOR_SOURCE_INVALID', {
            eventId: event?.eventId || '',
            actorName,
            targetName,
            sourceActionId,
            sourceActorName,
            reason: !sourceAction ? 'COUNTER_SOURCE_ACTION_MISSING' : 'COUNTER_ACTION_CAUSAL_MISMATCH',
          });
        }
      }
    });
    const ledgerByEventId = new Map(eventLedger
      .map(event => [String(event?.eventId || '').trim(), event])
      .filter(([eventId]) => !!eventId));
    resolutionTrace.forEach(node => {
      (Array.isArray(node?.ledgerEventIds) ? node.ledgerEventIds : []).forEach(eventId => {
        const event = ledgerByEventId.get(String(eventId || '').trim());
        if (String(event?.eventKind || '').trim() !== 'counter') return;
        if (
          !isSameReportName(node?.actorName || '', event?.actorName || '') ||
          !isSameReportName(node?.targetName || '', event?.targetName || '')
        ) {
          pushFatal('COUNTER_ACTOR_SOURCE_INVALID', {
            eventId: event?.eventId || '',
            nodeId: node?.nodeId || '',
            ledgerActorName: event?.actorName || '',
            ledgerTargetName: event?.targetName || '',
            traceActorName: node?.actorName || '',
            traceTargetName: node?.targetName || '',
            reason: 'COUNTER_TRACE_LEDGER_MISMATCH',
          });
        }
      });
    });

    const scoreFields = ['candidateId', 'actionKind', 'actionRole', 'actorId', 'targetIds', 'utilityBefore', 'utilityAfter', 'objectiveUtility', 'normalizedUtility', 'vector', 'rejectionCode', 'classification', 'alternativeGap', 'selected'];
    const vectorFields = ['expectedStateGain', 'terminalUtility', 'objectiveProgress', 'informationValue', 'resourcePreservation', 'survivalLowerBound', 'irreversibleCost', 'catastrophicRisk', 'resourceOpportunityCost'];
    const forbiddenSelections = new Set([
      'ZERO_EFFECT_COSTLY',
      'SELF_DEFEATING',
      'SUMMON_NO_ACTION_WINDOW',
      'DOMINATED',
      'ZERO_PROGRESS',
      'ACTION_OPPORTUNITY_COST',
    ]);
    scoringAudit.forEach((actionAudit, actionIndex) => {
      const candidates = Array.isArray(actionAudit?.candidates) ? actionAudit.candidates.filter(Boolean) : [];
      const actionDecisionEngine = String(actionAudit?.decisionEngine || 'LEGACY').trim().toUpperCase();
      if (
        actionDecisionEngine !== 'R9V2_TARGET' &&
        candidates.length > 3
      ) {
        pushFatal('SCORING_AUDIT_OVERSIZED', {
          actionIndex,
          candidateCount: candidates.length,
          decisionEngine: actionDecisionEngine,
        });
      }
      candidates.forEach((candidate, candidateIndex) => {
        if (actionDecisionEngine === 'NO_FORMAL_PROVIDER') {
          const neutralFields = [
            'candidateId',
            'actionKind',
            'actorId',
            'targetIds',
            'selected',
          ];
          const missing = neutralFields
            .filter(key => candidate?.[key] === undefined || candidate?.[key] === null);
          if (missing.length) {
            pushFatal('SCORING_COMPONENT_MISSING', {
              actionIndex,
              candidateIndex,
              candidateId: candidate?.candidateId || '',
              missing,
            });
          }
          return;
        }
        if (actionDecisionEngine === 'R8') {
          const r8Fields = [
            'candidateId',
            'actionKind',
            'actorId',
            'targetIds',
            'objectiveUtilityHEPP',
            'normalizedUtility',
            'vector',
            'rejectionCode',
            'classification',
            'selected',
          ];
          const r8VectorFields = [
            'objectiveUtilityHEPP',
            'informationValueHEPP',
            'assetReserve',
            'survivalLowerBound',
            'worstTailLossHEPP',
            'discardedOverkillPP',
          ];
          const missing = r8Fields
            .filter(key => candidate?.[key] === undefined || candidate?.[key] === null);
          const vector = candidate?.vector && typeof candidate.vector === 'object'
            ? candidate.vector
            : null;
          if (vector) {
            missing.push(...r8VectorFields
              .filter(key => vector[key] === undefined || vector[key] === null)
              .map(key => `vector.${key}`));
          }
          if (missing.length) {
            pushFatal('SCORING_COMPONENT_MISSING', {
              actionIndex,
              candidateIndex,
              candidateId: candidate?.candidateId || '',
              missing,
            });
            return;
          }
          const invalidNumbers = ['objectiveUtilityHEPP', 'normalizedUtility']
            .filter(key => !Number.isFinite(Number(candidate[key])))
            .concat(r8VectorFields
              .filter(key => !Number.isFinite(Number(vector[key])))
              .map(key => `vector.${key}`));
          if (invalidNumbers.length) {
            pushFatal('SCORING_COMPONENT_MISSING', {
              actionIndex,
              candidateIndex,
              candidateId: candidate?.candidateId || '',
              invalidNumbers,
            });
            return;
          }
          if (
            Math.abs(
              Number(candidate.objectiveUtilityHEPP) -
              Number(vector.objectiveUtilityHEPP)
            ) > 1e-6
          ) {
            pushFatal('SCORING_FORMULA_MISMATCH', {
              actionIndex,
              candidateIndex,
              candidateId: candidate.candidateId,
              expectedUtility: Number(vector.objectiveUtilityHEPP),
              actualUtility: Number(candidate.objectiveUtilityHEPP),
            });
          }
          return;
        }
        if (actionDecisionEngine === 'R9') {
          // R9 Tier-1 合同：廉价分即效用，无 r8 向量分量；字段必须存在且为有限数。
          const r9Fields = ['candidateId', 'actionKind', 'targetIds', 'objectiveUtility', 'objectiveUtilityHEPP', 'selected'];
          const r9Missing = r9Fields.filter(key => candidate?.[key] === undefined || candidate?.[key] === null);
          if (r9Missing.length) {
            pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate?.candidateId || '', missing: r9Missing });
            return;
          }
          const r9Invalid = ['objectiveUtility', 'objectiveUtilityHEPP']
            .filter(key => !Number.isFinite(Number(candidate[key])));
          if (r9Invalid.length) {
            pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate.candidateId, invalidNumbers: r9Invalid });
          }
          return;
        }
        if (actionDecisionEngine === 'R9V2_LINEAR') {
          // 轻量线性评分合同：排名即模型分数，无 R8 vector/proof/pareto
          // 字段。审计只要求候选身份、有限分数、整数排名与选择标志完整。
          const linearFields = ['candidateId', 'actionKind', 'actorId', 'targetIds', 'score', 'rank', 'selected'];
          const linearMissing = linearFields.filter(key => candidate?.[key] === undefined || candidate?.[key] === null);
          if (linearMissing.length) {
            pushFatal('SCORING_COMPONENT_MISSING', { actionIndex, candidateIndex, candidateId: candidate?.candidateId || '', missing: linearMissing });
            return;
          }
          const rankInvalid = !Number.isInteger(Number(candidate.rank)) || Number(candidate.rank) < 0;
          const linearInvalid = ['score'].filter(key => !Number.isFinite(Number(candidate[key])));
          if (linearInvalid.length || rankInvalid) {
            pushFatal('SCORING_COMPONENT_MISSING', {
              actionIndex,
              candidateIndex,
              candidateId: candidate.candidateId,
              invalidNumbers: linearInvalid.concat(rankInvalid ? ['rank'] : []),
            });
          }
          return;
        }
        if (['R9V2_SHADOW', 'R9V2_TARGET'].includes(actionDecisionEngine)) {
          const targetAudit = actionDecisionEngine === 'R9V2_TARGET';
          const candidateId = String(candidate?.candidateId || '').trim();
          const requiredProofCandidateIds = new Set(
            targetAudit && Array.isArray(actionAudit?.requiredProofCandidateIds)
              ? actionAudit.requiredProofCandidateIds
                .map(value => String(value || '').trim())
                .filter(Boolean)
              : [],
          );
          const proofRequired = !targetAudit ||
            requiredProofCandidateIds.has(candidateId);
          const proof = candidate?.candidateValueProof;
          const r9v2Fields = [
            'candidateId',
            'actionKind',
            'actorId',
            'targetIds',
            'objectiveUtilityHEPP',
            'vector',
            'selected',
          ];
          const r9v2VectorFields = [
            'objectiveUtilityHEPP',
            'informationValueHEPP',
            'assetReserve',
            'survivalLowerBound',
            'worstTailLossHEPP',
            'discardedOverkillPP',
          ];
          const r9v2ProofFields = [
            'goalUtilityDeltaHEPP',
            'informationValueHEPP',
            'objectiveUtilityHEPP',
            'causalValueFacts',
            'reconciliationError',
          ];
          const missing = r9v2Fields
            .filter(key =>
              candidate?.[key] === undefined ||
              candidate?.[key] === null
            );
          const vector =
            candidate?.vector &&
            typeof candidate.vector === 'object'
              ? candidate.vector
              : null;
          if (vector) {
            missing.push(...r9v2VectorFields
              .filter(key =>
                vector[key] === undefined ||
                vector[key] === null
              )
              .map(key => `vector.${key}`));
          }
          if (proofRequired && (!proof || typeof proof !== 'object')) {
            missing.push('candidateValueProof');
          }
          if (proofRequired && proof && typeof proof === 'object') {
            missing.push(...r9v2ProofFields
              .filter(key =>
                proof[key] === undefined ||
                proof[key] === null
              )
              .map(key => `candidateValueProof.${key}`));
          }
          if (missing.length) {
            pushFatal('SCORING_COMPONENT_MISSING', {
              actionIndex,
              candidateIndex,
              candidateId: candidate?.candidateId || '',
              missing,
            });
            return;
          }
          if (!proofRequired) return;
          const invalidNumbers = [
            'objectiveUtilityHEPP',
          ].filter(key =>
            !Number.isFinite(Number(candidate[key]))
          ).concat(
            r9v2VectorFields
              .filter(key =>
                !Number.isFinite(Number(vector[key]))
              )
              .map(key => `vector.${key}`),
            [
              'goalUtilityDeltaHEPP',
              'informationValueHEPP',
              'objectiveUtilityHEPP',
              'reconciliationError',
            ]
              .filter(key =>
                !Number.isFinite(Number(proof[key]))
              )
              .map(key => `candidateValueProof.${key}`),
          );
          if (invalidNumbers.length) {
            pushFatal('SCORING_COMPONENT_MISSING', {
              actionIndex,
              candidateIndex,
              candidateId: candidate.candidateId,
              invalidNumbers,
            });
            return;
          }
          const causalTotal = proof.causalValueFacts.reduce(
            (sum, fact) =>
              sum + Number(fact?.valueHEPP || 0),
            0,
          );
          if (
            Math.abs(
              Number(proof.objectiveUtilityHEPP) -
              (
                Number(proof.goalUtilityDeltaHEPP) +
                Number(proof.informationValueHEPP)
              )
            ) > 1e-6 ||
            Math.abs(
              Number(candidate.objectiveUtilityHEPP) -
              Number(proof.objectiveUtilityHEPP)
            ) > 1e-6 ||
            Math.abs(
              Number(vector.objectiveUtilityHEPP) -
              Number(proof.objectiveUtilityHEPP)
            ) > 1e-6 ||
            Math.abs(
              causalTotal -
              Number(proof.goalUtilityDeltaHEPP)
            ) > 1e-6 ||
            Math.abs(Number(proof.reconciliationError)) > 1e-6
          ) {
            pushFatal('CAUSAL_RECONCILIATION_MISMATCH', {
              actionIndex,
              candidateIndex,
              candidateId: candidate.candidateId,
              causalTotal,
              goalUtilityDeltaHEPP:
                Number(proof.goalUtilityDeltaHEPP),
              informationValueHEPP:
                Number(proof.informationValueHEPP),
              objectiveUtilityHEPP:
                Number(proof.objectiveUtilityHEPP),
              reconciliationError:
                Number(proof.reconciliationError),
            });
          }
          return;
        }
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
        const expectedStateGain = Number.isFinite(Number(vector.objectiveRelevantStateGain))
          ? Number(vector.objectiveRelevantStateGain)
          : Number(vector.expectedStateGain);
        const absoluteCatastrophicRiskCost = actionDecisionEngine === 'NEXT'
          ? 0
          : Number(vector.catastrophicRisk);
        const expectedUnclampedUtility =
          expectedStateGain +
          Number(vector.terminalUtility) +
          Number(vector.objectiveProgress) +
          Number(vector.informationValue) -
          Number(vector.irreversibleCost) -
          absoluteCatastrophicRiskCost -
          Number(vector.resourceOpportunityCost || 0);
        const expectedUtility = Math.max(-200, Math.min(200, expectedUnclampedUtility));
        if (Math.abs(Number(candidate.objectiveUtility) - expectedUtility) > 1e-6) {
          pushFatal('SCORING_FORMULA_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId: candidate.candidateId,
            expectedUnclampedUtility,
            expectedUtility,
            actualUtility: Number(candidate.objectiveUtility),
          });
        }
        if (
          Number.isFinite(Number(vector.unclampedObjectiveUtility)) &&
          Math.abs(Number(vector.unclampedObjectiveUtility) - expectedUnclampedUtility) > 1e-6
        ) {
          pushFatal('SCORING_FORMULA_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId: candidate.candidateId,
            expectedUnclampedUtility,
            actualUnclampedUtility: Number(vector.unclampedObjectiveUtility),
          });
        }
      });
      const selectedCandidates = candidates.filter(candidate => candidate?.selected === true);
      const lostOpportunity = actionAudit?.lostOpportunity && typeof actionAudit.lostOpportunity === 'object'
        ? actionAudit.lostOpportunity
        : null;
      if (
        actionDecisionEngine !== 'NO_FORMAL_PROVIDER' &&
        selectedCandidates.length !== 1 &&
        !lostOpportunity?.reasonCode
      ) {
        pushFatal('SCORING_SELECTED_MISSING', { actionIndex, selectedCandidateId: actionAudit?.selectedCandidateId || '', selectedCount: selectedCandidates.length });
      }
      const selected = selectedCandidates[0];
      if (selected) {
        const selectedRejected = String(selected.rejectionCode || '').trim();
        const selectedClassification = String(selected.classification || '').trim();
        const playerLocked = selected?.playerLocked === true ||
          String(actionAudit?.actorControl || '').trim().toUpperCase() === 'PLAYER_LOCKED';
        if (
          !playerLocked &&
          selected?.forcedFallback !== true &&
          (
            forbiddenSelections.has(selectedRejected) ||
            ['HARD_INVALID', 'DOMINATED'].includes(selectedClassification)
          )
        ) {
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

    const r9v2OwnerTypes = new Set([
      'STATE_DELTA',
      'ACTION_POOL_DELTA',
      'TERMINAL_DELTA',
    ]);
    const normalizeCandidateIds = value =>
      Array.isArray(value)
        ? value.map(item => String(item || '').trim()).filter(Boolean).sort()
        : null;
    const sameCandidateIds = (left, right) =>
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((candidateId, index) => candidateId === right[index]);
    r9v2DecisionAudits.forEach((decisionAudit, actionIndex) => {
      if (![
        'R9V2_SHADOW',
        'R9V2_TARGET',
      ].includes(
        String(decisionAudit?.decisionEngine || '').trim().toUpperCase(),
      )) {
        return;
      }
      const targetAudit =
        String(decisionAudit?.decisionEngine || '').trim().toUpperCase() ===
        'R9V2_TARGET';
      const r9v2CausalFactIds = new Map();
      const rows = Array.isArray(decisionAudit?.candidateAudit)
        ? decisionAudit.candidateAudit.filter(Boolean)
        : [];
      const frozenCandidateIds = normalizeCandidateIds(
        decisionAudit?.frozenCandidateIds,
      );
      const preparedEntryCandidateIds = normalizeCandidateIds(
        decisionAudit?.preparedEntryCandidateIds,
      );
      const preparedProofCandidateIds = normalizeCandidateIds(
        decisionAudit?.preparedProofCandidateIds,
      );
      const requiredProofCandidateIds = normalizeCandidateIds(
        decisionAudit?.requiredProofCandidateIds,
      );
      const materializedProofCandidateIds = normalizeCandidateIds(
        decisionAudit?.materializedProofCandidateIds,
      );
      const observedCandidateIds = rows
        .map(row => String(row?.candidateId || '').trim())
        .filter(Boolean)
        .sort();
      const observedProofCandidateIds = rows
        .filter(row => row?.candidateValueProof && typeof row.candidateValueProof === 'object')
        .map(row => String(row?.candidateId || '').trim())
        .filter(Boolean)
        .sort();
      const vectorCoverage = decisionAudit?.vectorCoverage ||
        decisionAudit?.candidateCoverage || null;
      const proofCoverage = decisionAudit?.proofCoverage || null;
      const vectorCoverageClosed =
        String(vectorCoverage?.status || '').trim() === 'CLOSED';
      const proofCoverageClosed =
        String(proofCoverage?.status || '').trim() ===
        'REQUIRED_SUBSET_CLOSED';
      const hasValidParetoWitness = row => {
        const witness = row?.paretoWitness;
        const kind = String(witness?.kind || '').trim();
        if (row?.pareto === true) return kind === 'NON_DOMINATED';
        if (kind === 'HARD_EXCLUDED') {
          return Array.isArray(witness?.hardExclusionCodes) &&
            witness.hardExclusionCodes.length > 0;
        }
        return !!String(witness?.dominatorCandidateId || '').trim();
      };
      const requiredProofSubset =
        targetAudit &&
        Array.isArray(requiredProofCandidateIds) &&
        Array.isArray(frozenCandidateIds) &&
        requiredProofCandidateIds.every(candidateId =>
          frozenCandidateIds.includes(candidateId),
        );
      const coverageMismatch = targetAudit
        ? !sameCandidateIds(frozenCandidateIds, observedCandidateIds) ||
          !sameCandidateIds(frozenCandidateIds, preparedEntryCandidateIds) ||
          !vectorCoverageClosed ||
          !requiredProofSubset ||
          !sameCandidateIds(requiredProofCandidateIds, materializedProofCandidateIds) ||
          !sameCandidateIds(materializedProofCandidateIds, observedProofCandidateIds) ||
          !proofCoverageClosed
        : !sameCandidateIds(frozenCandidateIds, observedCandidateIds) ||
          !sameCandidateIds(frozenCandidateIds, preparedEntryCandidateIds) ||
          !sameCandidateIds(frozenCandidateIds, preparedProofCandidateIds) ||
          !vectorCoverageClosed;
      if (rows.length > 0 && coverageMismatch) {
        pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
          actionIndex,
          kind: 'R9V2_CANDIDATE_COVERAGE',
          targetAudit,
          frozenCandidateIds,
          observedCandidateIds,
          preparedEntryCandidateIds,
          preparedProofCandidateIds,
          requiredProofCandidateIds,
          materializedProofCandidateIds,
          observedProofCandidateIds,
          vectorCoverage,
          proofCoverage,
        });
      }
      rows.forEach((row, candidateIndex) => {
        const candidateId = String(row?.candidateId || '').trim();
        const proof = row?.candidateValueProof;
        const proofRequired = !targetAudit ||
          (Array.isArray(requiredProofCandidateIds) &&
            requiredProofCandidateIds.includes(candidateId));
        if (!candidateId) {
          pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
            actionIndex,
            candidateIndex,
            candidateId,
            kind: 'R9V2_CANDIDATE_ID_MISSING',
          });
          return;
        }
        if (!proof || typeof proof !== 'object') {
          if (proofRequired) {
            pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
              actionIndex,
              candidateIndex,
              candidateId,
              kind: 'R9V2_PROOF_MISSING',
            });
          }
          if (String(row?.rejectionCode || '').trim()) return;
          const witness = row?.paretoWitness;
          if (!hasValidParetoWitness(row)) {
            pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
              actionIndex,
              candidateIndex,
              candidateId,
              kind: row?.pareto === true
                ? 'R9V2_PARETO_WITNESS_MISSING'
                : String(witness?.kind || '').trim() === 'HARD_EXCLUDED'
                  ? 'R9V2_HARD_EXCLUSION_WITNESS_MISSING'
                : 'R9V2_DOMINATOR_WITNESS_MISSING',
            });
          }
          return;
        }
        const facts = Array.isArray(proof?.causalValueFacts)
          ? proof.causalValueFacts
          : [];
        let causalTotal = 0;
        facts.forEach((fact, factIndex) => {
          const factId = String(fact?.factId || '').trim();
          const ownerType = String(fact?.ownerType || '').trim();
          const valueHEPP = Number(fact?.valueHEPP);
          if (!factId || r9v2CausalFactIds.has(factId)) {
            pushFatal('DUPLICATE_CAUSAL_VALUE', {
              actionIndex,
              candidateIndex,
              factIndex,
              factId,
              duplicateOf: r9v2CausalFactIds.get(factId) || null,
            });
          } else {
            r9v2CausalFactIds.set(factId, {
              actionIndex,
              candidateIndex,
              candidateId,
            });
          }
          if (!r9v2OwnerTypes.has(ownerType) || !Number.isFinite(valueHEPP)) {
            pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
              actionIndex,
              candidateIndex,
              factIndex,
              candidateId,
              factId,
              ownerType,
              valueHEPP,
            });
          }
          causalTotal += Number.isFinite(valueHEPP) ? valueHEPP : 0;
          if (String(fact?.sourceOutcomeKind || '').trim() === 'INCOMING_HEALTH_DELTA') {
            const sourceActorId = String(fact?.sourceActorId || '').trim();
            const sourceActorIds = Array.isArray(fact?.sourceActorIds)
              ? fact.sourceActorIds.map(value => String(value || '').trim()).filter(Boolean)
              : [];
            const sourceDescriptorIds = Array.isArray(fact?.sourceDescriptorIds)
              ? fact.sourceDescriptorIds.map(value => String(value || '').trim()).filter(Boolean)
              : [];
            if (
              ownerType !== 'STATE_DELTA' ||
              (!sourceActorId && sourceActorIds.length === 0) ||
              sourceDescriptorIds.length === 0
            ) {
              pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
                actionIndex,
                candidateIndex,
                factIndex,
                candidateId,
                factId,
                ownerType,
                sourceActorId,
                sourceActorIds,
                sourceDescriptorIds,
              });
            }
          }
          if (ownerType === 'TERMINAL_DELTA') {
            const terminalProjection = proof?.terminalProjection || {};
            const terminalProbabilityValues = [
              fact?.terminalProbability,
              fact?.baselineTerminalProbability,
              fact?.candidateTerminalProbability,
              terminalProjection?.terminalProbability,
              terminalProjection?.baselineTerminalProbability,
              terminalProjection?.candidateTerminalProbability,
            ]
              .filter(value => value !== undefined && value !== null)
              .map(value => Number(value));
            const terminalProbability = terminalProbabilityValues.length
              ? Math.max(...terminalProbabilityValues)
              : 0;
            const terminalIdentities = [
              ...(Array.isArray(fact?.terminalAfterEffectInstanceIds)
                ? fact.terminalAfterEffectInstanceIds
                : []),
              fact?.terminalAfterEffectInstanceId,
              fact?.terminalEventId,
              ...(Array.isArray(fact?.terminalAtomicKeys)
                ? fact.terminalAtomicKeys
                : []),
              fact?.terminalAtomicKey,
              ...(Array.isArray(
                fact?.candidateTerminalAfterEffectInstanceIds,
              )
                ? fact.candidateTerminalAfterEffectInstanceIds
                : []),
              ...(Array.isArray(fact?.candidateTerminalAtomicKeys)
                ? fact.candidateTerminalAtomicKeys
                : []),
              ...(Array.isArray(
                terminalProjection?.terminalAfterEffectInstanceIds,
              )
                ? terminalProjection.terminalAfterEffectInstanceIds
                : []),
              terminalProjection?.terminalAfterEffectInstanceId,
              terminalProjection?.terminalEventId,
              ...(Array.isArray(terminalProjection?.terminalAtomicKeys)
                ? terminalProjection.terminalAtomicKeys
                : []),
              terminalProjection?.terminalAtomicKey,
            ]
              .map(value => String(value || '').trim())
              .filter((value, index, values) =>
                value && values.indexOf(value) === index
              );
            const terminalPaths = [
              ...(Array.isArray(fact?.candidateTerminalPaths)
                ? fact.candidateTerminalPaths
                : []),
              ...(Array.isArray(fact?.terminalPaths)
                ? fact.terminalPaths
                : []),
              ...(Array.isArray(terminalProjection?.terminalPaths)
                ? terminalProjection.terminalPaths
                : []),
            ];
            const invalidTerminalPath = terminalPaths.some(path =>
              !String(
                path?.terminalAfterEffectInstanceId ||
                path?.terminalEventId ||
                path?.terminalAtomicKey ||
                '',
              ).trim()
            );
            if (
              !(terminalProbability > 1e-12) ||
              !terminalIdentities.length ||
              invalidTerminalPath
            ) {
              pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
                actionIndex,
                candidateIndex,
                factIndex,
                candidateId,
                factId,
                kind: 'R9V2_TERMINAL_BINDING',
                terminalProbability,
                terminalIdentities,
                terminalPathCount: terminalPaths.length,
                invalidTerminalPath,
              });
            }
          }
        });
        if (
          Math.abs(
            Number(proof?.objectiveUtilityHEPP || 0) -
              Number(proof?.goalUtilityDeltaHEPP || 0) -
              Number(proof?.informationValueHEPP || 0)
          ) > 1e-6 ||
          Math.abs(causalTotal - Number(proof?.goalUtilityDeltaHEPP || 0)) > 1e-6 ||
          Math.abs(Number(proof?.reconciliationError || 0)) > 1e-6
        ) {
          pushFatal('CAUSAL_RECONCILIATION_MISMATCH', {
            actionIndex,
            candidateIndex,
            candidateId,
            causalTotal,
            goalUtilityDeltaHEPP: Number(proof?.goalUtilityDeltaHEPP || 0),
            informationValueHEPP: Number(proof?.informationValueHEPP || 0),
            objectiveUtilityHEPP: Number(proof?.objectiveUtilityHEPP || 0),
            reconciliationError: Number(proof?.reconciliationError || 0),
          });
        }
        if (String(row?.rejectionCode || '').trim()) return;
        if (!hasValidParetoWitness(row)) {
          const witness = row?.paretoWitness;
          pushFatal('CAUSAL_RANGE_OWNER_CONFLICT', {
            actionIndex,
            candidateIndex,
            candidateId,
            kind: row?.pareto === true
              ? 'R9V2_PARETO_WITNESS_MISSING'
              : String(witness?.kind || '').trim() === 'HARD_EXCLUDED'
                ? 'R9V2_HARD_EXCLUSION_WITNESS_MISSING'
                : 'R9V2_DOMINATOR_WITNESS_MISSING',
          });
        }
      });
    });

    const activeStarts = eventLedger.filter(event =>
      ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
      normalizeActionRole(event?.actionRole || 'ACTIVE') === 'ACTIVE'
    );
    const terminalKinds = new Set(['hit_result', 'state_apply', 'state_replace', 'resource_change', 'item_consume', 'create', 'summon_create', 'shield_create', 'support', 'defend', 'dodge', 'pass', 'complete', 'blocked_action', 'blocked_settlement', 'failed_action', 'target_fail']);
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
        actionAudit?.lostOpportunity?.reasonCode ||
        !selectedActionName ||
        normalizeActionRole(selectedCandidate?.actionRole || 'ACTIVE') !== 'ACTIVE' ||
        String(actionAudit?.ruleCode || '').trim() === 'DECISION_INTERFERENCE'
      ) return;
      const auditOpportunityId = String(actionAudit?.opportunityId || '').trim();
      const selectedRole = normalizeActionRole(
        actionAudit?.actionRole ||
        selectedCandidate?.actionRole ||
        'ACTIVE',
      );
      const executionKinds = new Set([
        'action_start',
        'charge_start',
        'defend',
        'dodge',
        'counter',
        'pass',
        'blocked_action',
        'failed_action',
      ]);
      const executionEvents = eventLedger.filter(event =>
        executionKinds.has(String(event?.eventKind || '').trim()) &&
        normalizeActionRole(event?.actionRole || 'ACTIVE') === selectedRole
      );
      const matchesActor = event =>
        isSameReportName(event?.actorName || '', actionAudit?.actor || '') ||
        String(event?.actorId || '').trim() === String(actionAudit?.actor || '').trim();
      const matchingStart = auditOpportunityId
        ? executionEvents.find(event =>
            matchesActor(event) &&
            [
              event?.opportunityId,
              event?.grantId,
              event?.meta?.opportunityId,
              event?.meta?.grantId,
            ].some(value => String(value || '').trim() === auditOpportunityId)
          )
        : executionEvents.find(event =>
            Number(event?.round || 0) === Number(actionAudit?.round || 0) &&
            matchesActor(event) &&
            (actionAudit?.continuation === true
              ? String(event?.meta?.chainType || '').trim() === 'FOLLOW_UP'
              : String(event?.meta?.chainType || '').trim() !== 'FOLLOW_UP')
          );
      if (!matchingStart) {
        pushFatal('SCORING_EXECUTION_ACTION_MISSING', {
          actionIndex,
          round: actionAudit?.round || 0,
          actor: actionAudit?.actor || '',
          selectedActionName,
          opportunityId: auditOpportunityId,
          grantId: String(actionAudit?.grantId || '').trim(),
          opportunitySequence: Math.max(0, Number(actionAudit?.opportunitySequence || 0)),
        });
        return;
      }
      const executedName = normalizeActionDisplayName(matchingStart?.finalActionName || matchingStart?.actionName || '');
      const selectedCandidateId = String(actionAudit?.selectedCandidateId || '').trim();
      const candidateSkillId = selectedCandidateId.match(/:(?:skill|forced-skill):(.+):\d+$/)?.[1] || '';
      const auditActor = listCombatUnits(payload?.combatData || {}).find(unit => isUnitIdentityMatch(unit, actionAudit?.actor || ''));
      const resolvedCandidateSkill = candidateSkillId
        ? resolveDeclaredSkill({ actionKind: 'RELEASE_SKILL', skill: candidateSkillId }, auditActor || {}).skill
        : null;
      const resolvedCandidateName = normalizeActionDisplayName(
        resolvedCandidateSkill?.name ||
        resolvedCandidateSkill?.技能名称 ||
        resolvedCandidateSkill?.技能名 ||
        resolvedCandidateSkill?.魂技名 ||
        resolvedCandidateSkill?.名称 ||
        '',
      );
      const releasedCharge = (Array.isArray(payload?.eventLedger) ? payload.eventLedger : []).some(event =>
        ['charge_start', 'charge_progress'].includes(String(event?.eventKind || '').trim()) &&
        Number(event?.round || 0) <= Number(actionAudit?.round || 0) &&
        normalizeActionDisplayName(event?.actionName || '') === executedName &&
        (!event?.actorName || isSameReportName(event.actorName, actionAudit?.actor || ''))
      );
      const namesMatch = executedName === selectedActionName ||
        (resolvedCandidateName && executedName === resolvedCandidateName) ||
        releasedCharge;
      if (executedName && !namesMatch) {
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

  function buildDecisionTimePublicContext(runtimeSnapshot = {}) {
    const scheduledEvents = (
      Array.isArray(runtimeSnapshot?.scheduledEvents)
        ? runtimeSnapshot.scheduledEvents
        : []
    )
      .filter(event =>
        ['FUTURE_NATURAL_ACTION', 'VISIBLE_CHARGE_RELEASE'].includes(
          String(event?.eventType || '').trim().toUpperCase(),
        )
      )
      .map(event => ({
        descriptorId: String(
          event?.descriptorId || event?.scheduleId || '',
        ).trim(),
        ownerId: String(event?.ownerId || '').trim(),
        sourceActorId: String(event?.sourceActorId || '').trim(),
        targetId: String(event?.targetId || '').trim(),
        expectedGrantType: String(
          event?.expectedGrantType || '',
        ).trim(),
        eventType: String(event?.eventType || '').trim(),
        round: Math.max(
          0,
          Number(event?.round ?? event?.scheduledRound ?? 0),
        ),
        creationSequence: Math.max(
          0,
          Number(event?.creationSequence || 0),
        ),
        expirySequence: Math.max(
          0,
          Number(event?.expirySequence || 0),
        ),
        threat: event?.threat === true,
      }))
      .filter(event => event.descriptorId)
      .sort((left, right) =>
        left.creationSequence - right.creationSequence ||
        left.descriptorId.localeCompare(right.descriptorId)
      );
    return {
      schemaVersion: 'DecisionTimePublicContextV1',
      scheduledEvents,
    };
  }

  function buildDecisionAuditRecord(decision = {}) {
    const selected = decision?.selected && typeof decision.selected === 'object'
      ? decision.selected
      : null;
    const normalizeCandidateIdList = value =>
      Array.isArray(value)
        ? value.map(item => String(item || '').trim()).filter(Boolean).sort()
        : [];
    const normalizeScoreCandidate = candidate => {
      const declaration = candidate?.declaration || {};
      const copied = cloneValue(candidate || {});
      if (decision?.decisionEngine === 'R9V2_LINEAR') delete copied.declaration;
      return {
        ...copied,
        actionId: String(candidate?.actionId || declaration?.actionId || candidate?.candidateId || '').trim(),
        actionName: normalizeActionDisplayName(
          candidate?.actionName ||
          declaration?.skill?.name ||
          declaration?.skill?.魂技名 ||
          declaration?.skill?.技能名称 ||
          declaration?.skill?.名称 ||
          candidate?.actionKind ||
          candidate?.candidateId ||
          '',
        ),
        targetIds: Array.isArray(candidate?.targetIds)
          ? candidate.targetIds.map(value => String(value || '').trim()).filter(Boolean)
          : Array.isArray(declaration?.targetIds)
            ? declaration.targetIds.map(value => String(value || '').trim()).filter(Boolean)
            : [],
      };
    };
    return cloneValue({
      version: decision?.version || '',
      schemaVersion: decision?.schemaVersion || '',
      decisionEngine: String(
        decision?.decisionEngine ||
        (/next/i.test(String(decision?.version || '')) ? 'NEXT' : 'LEGACY'),
      ).trim().toUpperCase(),
      providerId: String(decision?.providerId || '').trim(),
      round: Number(decision?.round || 0),
      actorId: String(decision?.actorId || '').trim(),
      actionRole: normalizeActionRole(decision?.actionRole || 'ACTIVE'),
      actorControl: normalizeActorControl(decision?.actorControl || '', decision?.selected?.playerLocked === true ? 'PLAYER_LOCKED' : 'AI'),
      sourceActorId: String(decision?.sourceActorId || '').trim(),
      opportunityId: String(decision?.opportunityId || '').trim(),
      grantId: String(decision?.grantId || '').trim(),
      opportunitySequence: Math.max(0, Number(decision?.opportunitySequence || 0)),
      continuation: decision?.continuation === true,
      candidateCount: Math.max(0, Number(decision?.candidateCount || 0)),
      // Frozen candidate order is part of the candidate-policy identity. Do not
      // sort this list while projecting the Decision record into the draft.
      frozenCandidateIds: Array.isArray(decision?.frozenCandidateIds)
        ? decision.frozenCandidateIds.map(item => String(item || '').trim()).filter(Boolean)
        : [],
      preparedEntryCandidateIds: normalizeCandidateIdList(
        decision?.preparedEntryCandidateIds,
      ),
      preparedProofCandidateIds: normalizeCandidateIdList(
        decision?.preparedProofCandidateIds,
      ),
      requiredProofCandidateIds: normalizeCandidateIdList(
        decision?.requiredProofCandidateIds,
      ),
      materializedProofCandidateIds: normalizeCandidateIdList(
        decision?.materializedProofCandidateIds,
      ),
      vectorCoverage: decision?.vectorCoverage || null,
      proofCoverage: decision?.proofCoverage || null,
      candidateCoverage: decision?.candidateCoverage || null,
      paretoCount: Math.max(0, Number(decision?.paretoCount || 0)),
      selected: selected
        ? {
            candidateId: String(selected?.candidateId || '').trim(),
            declaration: selected?.declaration || null,
            selectedActionName: normalizeActionDisplayName(
              selected?.selectedActionName ||
              selected?.declaration?.skill?.name ||
              selected?.declaration?.skill?.魂技名 ||
              selected?.declaration?.skill?.技能名称 ||
              selected?.declaration?.skill?.名称 ||
              selected?.declaration?.actionKind ||
              selected?.candidateId ||
              '',
            ),
            utilityBefore: Number(selected?.utilityBefore || 0),
            utilityAfter: Number(selected?.utilityAfter || 0),
            objectiveUtility: Number(selected?.objectiveUtility || 0),
            objectiveUtilityHEPP: Number(selected?.objectiveUtilityHEPP ?? selected?.objectiveUtility ?? 0),
            normalizedUtility: Number(selected?.normalizedUtility || 0),
            vector: selected?.vector || {},
            rejectionCode: String(selected?.rejectionCode || '').trim(),
            classification: String(selected?.classification || 'VIABLE').trim() || 'VIABLE',
            counterDeclineFallback: selected?.counterDeclineFallback === true,
            playerLocked: selected?.playerLocked === true,
            selectionMode: String(selected?.selectionMode || '').trim(),
            forcedAction: selected?.forcedAction === true,
            forcedFallback: selected?.forcedFallback === true,
            fallbackReason: String(selected?.fallbackReason || '').trim(),
            fallbackSourceRejectionCode: String(selected?.fallbackSourceRejectionCode || '').trim(),
            repeatedActionAudit: selected?.repeatedActionAudit || null,
            nextValueAudit: selected?.nextValueAudit || null,
            terminalEvidence: selected?.terminalEvidence || null,
            crisisResponseAudit: selected?.crisisResponseAudit || null,
            crisisAlternativeAudit: selected?.crisisAlternativeAudit || null,
            riskCompensationAudit: selected?.riskCompensationAudit || null,
            teamIntentAudit: selected?.teamIntentAudit || null,
            effectTargetAudit: Array.isArray(selected?.effectTargetAudit)
              ? selected.effectTargetAudit
              : [],
            immediateReactionAudit: selected?.immediateReactionAudit || [],
            predictedOutcomeEvidence: Array.isArray(selected?.predictedOutcomeEvidence)
              ? selected.predictedOutcomeEvidence
              : [],
            mechanicObservations: Array.isArray(selected?.mechanicObservations) ? selected.mechanicObservations : [],
            goalProjection: selected?.goalProjection || null,
            primaryRoute: selected?.primaryRoute || selected?.route || null,
            backupRoute: selected?.backupRoute || null,
            causalValueFacts: Array.isArray(selected?.causalValueFacts) ? selected.causalValueFacts : [],
            candidateValueProof:
              selected?.candidateValueProof &&
              typeof selected.candidateValueProof === 'object'
                ? selected.candidateValueProof
                : null,
            goalUtilityDeltaHEPP: Number(
              selected?.goalUtilityDeltaHEPP || 0,
            ),
            informationValueHEPP: Number(
              selected?.informationValueHEPP || 0,
            ),
          }
        : null,
      alternatives: Array.isArray(decision?.alternatives)
        ? decision.alternatives.slice(0, 2).map(normalizeScoreCandidate)
        : [],
      goalProjection: selected?.goalProjection || null,
      healthTrajectory: Array.isArray(selected?.goalProjection?.healthTrajectory)
        ? selected.goalProjection.healthTrajectory
        : [],
      actionRouteDeltas: Array.isArray(selected?.goalProjection?.actionPoolDeltas)
        ? selected.goalProjection.actionPoolDeltas
        : [],
      realizationWindows: Array.isArray(selected?.primaryRoute?.realizationWindows)
        ? selected.primaryRoute.realizationWindows
        : [],
      resourceTimelineSummary: {
        payments: Array.isArray(selected?.primaryRoute?.paymentDependencies)
          ? selected.primaryRoute.paymentDependencies
          : [],
        resourceDeltas: Array.isArray(selected?.goalProjection?.actionPoolDeltas)
          ? selected.goalProjection.actionPoolDeltas.filter(delta =>
              String(delta?.outcomeKind || '').trim() === 'RESOURCE_OPTION_CHANGED'
            )
          : [],
      },
      probabilitySources: {
        responseModel: selected?.goalProjection?.responseModel || null,
        mechanicObservations: Array.isArray(selected?.mechanicObservations)
          ? selected.mechanicObservations
          : [],
      },
      causalValueFacts: Array.isArray(selected?.causalValueFacts) ? selected.causalValueFacts : [],
      uncertaintyBounds: selected?.primaryRoute?.probabilityBounds || { lower: 0, upper: 1 },
      lostOpportunity: decision?.lostOpportunity || null,
      // The runtime consumes the full belief state before this audit projection.
      // R9V2 reports use the bound beliefRevision; duplicating the complete
      // per-unit belief snapshot into every decision makes long drafts grow
      // quadratically and has no report consumer.
      beliefState: decision?.decisionEngine === 'R9V2_LINEAR'
        ? {}
        : decision?.beliefState || {},
      teamIntent: decision?.teamIntent || {},
      decisionTimePublicContext:
        decision?.decisionTimePublicContext || {
          schemaVersion: 'DecisionTimePublicContextV1',
          scheduledEvents: [],
        },
      problems: Array.isArray(decision?.problems) ? decision.problems : [],
      strategicSignature: String(decision?.strategicSignature || '').trim(),
      stalemate: decision?.stalemate || null,
      stateCapacityTotal: Math.max(0, Number(decision?.stateCapacityTotal || 0)),
      resourceThreatProfile: decision?.resourceThreatProfile || {},
      resourceThreatDiagnostics: decision?.resourceThreatDiagnostics || null,
      resourceThreatLedgerEventCount: Math.max(0, Number(decision?.resourceThreatLedgerEventCount || 0)),
      beliefRevision: String(decision?.beliefRevision || '').trim(),
      pendingStrategicEffect: decision?.pendingStrategicEffect === true,
      strategyMemory: decision?.strategyMemory || {},
      candidateAudit: Array.isArray(decision?.candidateAudit)
        ? decision.candidateAudit.map(normalizeScoreCandidate)
        : [],
      scoreAudit: Array.isArray(decision?.scoreAudit) ? decision.scoreAudit.map(normalizeScoreCandidate) : [],
      eligibleCount: Math.max(0, Number(decision?.eligibleCount || 0)),
      hardExcludedCount: Math.max(0, Number(decision?.hardExcludedCount || 0)),
      hardExclusionAudit: Array.isArray(decision?.hardExclusionAudit)
        ? decision.hardExclusionAudit.map(entry => cloneValue(entry))
        : [],
      previewCalls: Math.max(0, Number(decision?.previewCalls || 0)),
      decomposition: decision?.decomposition || null,
      candidateBinding:
        decision?.candidateBinding && typeof decision.candidateBinding === 'object'
          ? decision.candidateBinding
          : null,
      // R9V2's selected-candidate DCT is the sealed diagnostic record. The full
      // all-candidate factor table is already bound by providerResultHash and is
      // intentionally not duplicated into every long-battle draft decision.
      reasonContributions: decision?.decisionEngine === 'R9V2_LINEAR'
        ? {}
        : decision?.reasonContributions || {},
      decisionProfile: decision?.decisionProfile || {},
    });
  }

  function resolveFormalProviderId(source = {}) {
    if (
      Object.hasOwn(source, '__r9v2LinearTest') ||
      Object.hasOwn(source?.settings || {}, '__r9v2LinearTest')
    ) {
      throw new Error('BATTLE_TEST_PROVIDER_FLAG_FORBIDDEN');
    }
    const topLevelProviderId = String(source?.providerId || '').trim();
    const settingsProviderId = String(source?.settings?.providerId || '').trim();
    if (topLevelProviderId && settingsProviderId && topLevelProviderId !== settingsProviderId) {
      throw new Error('BATTLE_PROVIDER_ID_CONFLICT');
    }
    const providerId = topLevelProviderId || settingsProviderId || 'r9v2';
    if (!Array.isArray(decisionRuntime?.providerIds) || !decisionRuntime.providerIds.includes(providerId)) {
      throw new Error('battle_decision_provider_unknown:' + providerId);
    }
    return providerId;
  }

  function runDecisionCase(input = {}) {
    const source = input && typeof input === 'object' ? cloneValue(input) : {};
    const combatData = source?.combatData && typeof source.combatData === 'object'
      ? source.combatData
      : null;
    if (!combatData) throw new Error('battle_declaration_combat_data_missing');
    const providerId = resolveFormalProviderId(source);
    return runStructuredBattle({
      ...source,
      combatData,
      caseId: String(source.caseId || 'r9v2-formal').trim(),
      seed: Math.max(1, Math.floor(Number(source.seed || 1))),
      rounds: Math.max(1, Math.min(20, Math.floor(Number(source.rounds || 1)))),
      mode: String(source.mode || 'single_round').trim() || 'single_round',
      settings: {
        ...(source.settings || {}),
        providerId,
        playerLockedSettlement: false,
      },
    });
  }

  function runBattleCase(options = {}) {
    return runDecisionCase(options && typeof options === 'object' ? options : {});
  }

  function executeBattleDraft(input = {}) {
    const source = input && typeof input === 'object' ? cloneValue(input) : {};
    const combatData = source?.combatData && typeof source.combatData === 'object'
      ? source.combatData
      : null;
    if (!combatData) throw new Error('battle_declaration_combat_data_missing');
    const result = runDecisionCase({
      ...source,
      combatData,
      settings: {
        ...(source.settings || {}),
        decisionOnly: false,
      },
    });
    const objectiveContract = source.objectiveContract ||
      source.battleIntent?.objectives || combatData?.胜负条件 || {};
    const draft = {
      schemaVersion: '8.3-draft-1',
      status: 'DRAFT',
      providerId: String(result?.providerId || 'r9v2').trim(),
      formalProviderState: String(decisionRuntime?.formalProviderState || '').trim(),
      selectionMode: 'AI',
      actorControl: 'AI',
      decisionEngine: 'R9V2_LINEAR',
      inputHash: hashBattleValue(source),
      objectiveHash: hashBattleValue(objectiveContract),
      caseId: String(result?.caseId || source?.caseId || '').trim(),
      seed: result?.seed ?? source?.seed ?? 1,
      mode: 'single_round',
      roundsRequested: Math.max(1, Number(result?.roundsRequested || source?.rounds || 1)),
      actualRoundCount: Math.max(0, Number(result?.roundsExecuted || 0)),
      executedRoundNumbers: cloneValue(result?.executedRoundNumbers || []),
      roundStart: result?.roundStart ?? null,
      roundEnd: result?.roundEnd ?? null,
      ledger: cloneValue(result?.ledger || []),
      trace: cloneValue(result?.trace || []),
      actionQueueTrace: cloneValue(result?.actionQueueTrace || []),
      decisionAudit: cloneValue(result?.decisions || []),
      runtimeAudit: cloneValue(result?.audit || { fatalCount: 0, warningCount: 0, fatals: [], warnings: [] }),
      terminalResult: cloneValue(result?.terminal || { terminal: false, winner: 'unfinished', reason: 'R9V2_LINEAR' }),
      initialSnapshot: cloneValue(result?.initialSnapshot || combatData),
      finalSnapshot: cloneValue(result?.combatData || result?.finalSnapshot || null),
    };
    return attestBattleDraft({ ...draft, draftHash: hashBattleValue(draft) });
  }

  function executePlayerLockedBattleSettlement(input = {}) {
    const source = input && typeof input === 'object' ? cloneValue(input) : {};
    const topLevelProviderId = String(source?.providerId ?? '').trim();
    const settingsProviderId = String(source?.settings?.providerId ?? '').trim();
    if (topLevelProviderId || settingsProviderId) {
      throw new Error('NO_FORMAL_PROVIDER_PROVIDER_ID_REJECTED:' + (topLevelProviderId || settingsProviderId));
    }
    const requestedAction = source?.actionDeclaration || source?.selectedAction;
    const actionDeclaration = requestedAction?.declaration && typeof requestedAction.declaration === 'object'
      ? requestedAction.declaration
      : requestedAction;
    if (!actionDeclaration || typeof actionDeclaration !== 'object') {
      throw new Error('battle_player_locked_declaration_missing');
    }
    const combatData = source?.combatData && typeof source.combatData === 'object'
      ? source.combatData
      : null;
    if (!combatData) throw new Error('battle_declaration_combat_data_missing');
    const actorId = String(actionDeclaration?.actorId || '').trim();
    if (!actorId) throw new Error('battle_declaration_actor_missing');
    const actionKind = String(actionDeclaration?.actionKind || '').trim();
    if (!actionKind) throw new Error('battle_player_locked_action_kind_missing');
    const targetIds = Array.isArray(actionDeclaration?.targetIds)
      ? actionDeclaration.targetIds.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    if (!targetIds.length) throw new Error('battle_player_locked_target_missing');
    const knownUnits = [...listPrimaryCombatUnits(combatData), ...listSummonCombatUnits(combatData)];
    if (!knownUnits.some(unit => isUnitIdentityMatch(unit, actorId))) {
      throw new Error('battle_player_locked_actor_unknown:' + actorId);
    }
    const illegalTargets = targetIds.filter(targetId =>
      !knownUnits.some(unit =>
        isUnitIdentityMatch(unit, targetId) && previewRuntime.isBattleCapable(unit),
      ),
    );
    if (illegalTargets.length) {
      throw new Error('battle_player_locked_target_illegal:' + illegalTargets.join(','));
    }
    // Mechanical legality gate before settlement: reuse Decision's PLAYER_LOCKED
    // validator; never rewrite the declaration and never fall back to a provider.
    // Trust boundary: the validator only sees the fixed ACTIVE opportunity and
    // the battle intent derived from combatData; caller-supplied
    // actionOpportunity/beliefState/battleIntent are never forwarded.
    decisionRuntime.validatePlayerLockedDeclaration({
      worldSnapshot: combatData,
      actorId,
      playerLockedDeclaration: actionDeclaration,
      actionOpportunity: { role: 'ACTIVE' },
      beliefState: {},
      battleIntent: { mode: String(combatData?.战斗意图 || '').trim() },
    });
    const result = runStructuredBattle({
      ...source,
      combatData,
      rounds: 1,
      mode: 'single_round',
      // The same fixed/derived values are written back after the source spread
      // so a direct API caller cannot alter the battle intent through
      // input.battleIntent after validation.
      actionOpportunity: { role: 'ACTIVE' },
      beliefState: {},
      battleIntent: { mode: String(combatData?.战斗意图 || '').trim() },
      // Player-locked settings are constructed, never spread from caller input:
      // test-only keys (__r9v2LinearTest etc.) must not reach the provider path.
      settings: {
        providerId: '',
        decisionOnly: false,
        playerLockedSettlement: true,
      },
      selectedAction: {
        ...cloneValue(requestedAction || {}),
        actorId,
        actionKind,
        targetIds,
        declaration: cloneValue(actionDeclaration),
      },
    });
    const objectiveContract = source.objectiveContract || source.battleIntent?.objectives || combatData?.胜负条件 || {};
    const draft = {
      schemaVersion: '8.3-draft-1',
      status: 'DRAFT',
      providerId: '',
      formalProviderState: 'NO_FORMAL_PROVIDER',
      selectionMode: 'PLAYER_LOCKED',
      actorControl: 'PLAYER_LOCKED',
      decisionEngine: 'NO_FORMAL_PROVIDER',
      inputHash: hashBattleValue(source),
      objectiveHash: hashBattleValue(objectiveContract),
      caseId: String(result?.caseId || source?.caseId || '').trim(),
      seed: result?.seed ?? source?.seed ?? 1,
      mode: 'single_round',
      roundsRequested: 1,
      actualRoundCount: Math.max(0, Number(result?.roundsExecuted || 0)),
      executedRoundNumbers: cloneValue(result?.executedRoundNumbers || []),
      roundStart: result?.roundStart ?? null,
      roundEnd: result?.roundEnd ?? null,
      ledger: cloneValue(result?.ledger || []),
      trace: cloneValue(result?.trace || []),
      actionQueueTrace: cloneValue(result?.actionQueueTrace || []),
      decisionAudit: cloneValue(result?.decisions || []),
      runtimeAudit: cloneValue(result?.audit || { fatalCount: 0, warningCount: 0, fatals: [], warnings: [] }),
      terminalResult: cloneValue(result?.terminal || { terminal: false, winner: 'unfinished', reason: 'PLAYER_LOCKED' }),
      initialSnapshot: cloneValue(source.combatData || result?.initialSnapshot || null),
      finalSnapshot: cloneValue(result?.combatData || result?.finalSnapshot || null),
    };
    return attestBattleDraft({ ...draft, draftHash: hashBattleValue(draft) });
  }
  function sealBattleResult(input = {}) {
    const draft = input?.draft && typeof input.draft === 'object' ? input.draft : null;
    const reportAudit = input?.reportAudit && typeof input.reportAudit === 'object' ? input.reportAudit : null;
    if (!draft || String(draft?.status || '').trim() !== 'DRAFT') throw new Error('battle_result_draft_invalid');
    const draftHash = String(draft?.draftHash || '').trim();
    if (!draftHash || verifyBattleDraftAttestation(draft) !== true) {
      throw new Error('BATTLE_COMMIT_HASH_MISMATCH:draft');
    }
    if (reportAudit?.passed !== true || Number(reportAudit?.fatalCount || 0) > 0) {
      throw new Error('battle_result_report_audit_failed');
    }
    const reportDto = reportAudit?.reportDto && typeof reportAudit.reportDto === 'object'
      ? reportAudit.reportDto
      : null;
    const reportHash = String(reportAudit?.reportHash || '').trim();
    const reportRuntime = root.__LWCS_BATTLE_REPORT__;
    if (
      !reportDto ||
      !reportHash ||
      !reportRuntime ||
      typeof reportRuntime.verifyProjectionAttestation !== 'function' ||
      reportRuntime.verifyProjectionAttestation(reportAudit, draftHash) !== true ||
      String(reportDto?.schemaVersion || '').trim() !== 'BattleReportDtoV2' ||
      String(reportDto?.visibilityMode || '').trim() !== 'PLAYER' ||
      String(reportDto?.projectionStatus || '').trim() !== 'PASSED'
    ) {
      throw new Error('BATTLE_REPORT_DTO_CONTRACT_MISMATCH');
    }
    const sealedPackage = Object.freeze({
      schemaVersion: '8.3-sealed-1',
      sealStatus: 'SEALED',
      draftHash,
      reportHash,
      terminalResult: draft.terminalResult,
      finalSnapshot: draft.finalSnapshot,
      reportDto,
    });
    sealedBattlePackageAttestations.add(sealedPackage);
    return sealedPackage;
  }

  function verifySealedBattlePackage(input = {}) {
    const sealedPackage = input && typeof input === 'object' ? input : null;
    if (!sealedPackage || String(sealedPackage?.sealStatus || '').trim() !== 'SEALED') {
      throw new Error('BATTLE_COMMIT_BEFORE_REPORT_SEAL');
    }
    if (String(sealedPackage?.schemaVersion || '').trim() !== '8.3-sealed-1') {
      throw new Error('BATTLE_COMMIT_HASH_MISMATCH:schema');
    }
    const draftHash = String(sealedPackage?.draftHash || '').trim();
    const reportHash = String(sealedPackage?.reportHash || '').trim();
    const reportDto = sealedPackage?.reportDto;
    if (
      !draftHash ||
      !reportHash ||
      !reportDto ||
      typeof reportDto !== 'object' ||
      !sealedBattlePackageAttestations.has(sealedPackage) ||
      !Object.isFrozen(sealedPackage) ||
      String(reportDto?.sourceDraftHash || '').trim() !== draftHash ||
      String(reportDto?.schemaVersion || '').trim() !== 'BattleReportDtoV2' ||
      String(reportDto?.visibilityMode || '').trim() !== 'PLAYER' ||
      String(reportDto?.projectionStatus || '').trim() !== 'PASSED'
    ) {
      throw new Error('BATTLE_COMMIT_HASH_MISMATCH:package');
    }
    if (!sealedPackage?.finalSnapshot || typeof sealedPackage.finalSnapshot !== 'object') {
      throw new Error('BATTLE_COMMIT_HASH_MISMATCH:final_snapshot');
    }
    return sealedPackage;
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
    opportunityGrantTypes,
    resourceTimelineOperations,
    sideEffectStatusMap,
    reportBlockTypes,
    prototypeRegistry,
    prototypeRuntimeContract,
    prototypeManifest,
    prototypeOptionMatrix,
    cloneValue,
    freezeBattleValue,
    stableSerialize,
    hashBattleValue,
    verifyBattleDraftAttestation,
    normalizeSideEffectList,
    settleConditionSideEffects,
    settleDelayedEffect,
    settlePersistentPrototype,
    settleConditionsAtRoundEnd,
    nextRuntimeId,
    ensureCombatRuntime,
    normalizeOpportunityRecord,
    opportunitySnapshotFromRuntime,
    resourceTimelineFromRuntime,
    scheduledEventsFromRuntime,
    buildRuntimeDecisionSnapshot,
    buildDecisionRuntimeSnapshot,
    buildNoOpRuntimeSnapshot,
    getBattleSnapshot,
    ensureLedger,
    attachLedger,
    ensureTrace,
    probabilitySucceeds,
    createActionQueue,
    buildActionQueue,
    createEmptyCombatEffectMap,
    buildCombatFinalStats,
    syncEquipmentPassiveRuntime,
    mergeEquipmentPassiveActionSkill,
    settleDamageAbsorption,
    prepareCombatData,
    evaluateBattleTerminal,
    syncSummonUnitMirror: syncSummonMirror,
    writeCombatResource,
    readCombatResource: persistentResourceValue,
    ensureActionDiagnostic,
    registerStateSource,
    findStateSource,
    decideDuelContinuation,
    executeActionNodes,
    executeDeclaration,
    beginStructuredDeclaration,
    executeStructuredDeclaration,
    settleStructuredReaction,
    openStructuredCounterWindow,
    auditStructuredCommitCoverage,
    runStructuredBattle,
    calculateBaseDamage,
    assertEffectList,
    assertSkillEffects,
   runDecisionCase,
   runBattleCase,
   executeBattleDraft,
   executePlayerLockedBattleSettlement,
    sealBattleResult,
    verifySealedBattlePackage,
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
    settleNaturalRecoveryAtRoundEnd,
    settleRingRecoveryAtRoundEnd,
    settleConditionResourceTick,
    readSustainCosts,
    syncC2FoodMaintenanceRuntime,
    settleSustainAtRoundEnd,
    attachSkillSustainCost,
    triggerStateRevive,
    triggerRevive,
    refreshSustainRuntimeLoad,
    settleExpiredConditionBase,
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
    removeHostStateSummon,
    consumeSummonWindow,
     refreshSummonMentalLoad,
     beginBattleRound,
     settlePassiveSkillConsumers,
     settleGuardSummonWindows,
  });

  root.__LWCS_BATTLE_RUNTIME__ = api;
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SOURCE__ = 'shared';
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SIZE__ = prototypeManifest.length;
})();

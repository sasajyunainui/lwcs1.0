// BehaviorDecisionPipeline_Module.js

// Single production payload; semantic sections remain isolated below.

// ===== prototypeAdapter (BehaviorPrototypeAdapter_Module.js) =====

// BehaviorPrototypeAdapter_Module.js
// M2 adapter writer F - rev5 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority:
//   tools/rc6/contracts/PrototypeDirectAdapterV1.json       4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e
//   tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json 7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22
//   tools/rc6/cases/PrototypeDirectAdapterCasesV1.json       f8a4c4e002d63718a112987f1cb8c9b1c6baa7a3438a81ea348d7f8e39e43c2d
//   tools/rc6/contracts/DirectFactRowV1.json                 7edd6a9fe2448764ba8ff18450d3536cc05e74fc6970560b90496d3ec8da7d67
//   tools/rc6/contracts/DirectFactRowV1.schema.json          0325e39cd33ecf1c925268d451f23c3bde4d75eca3b5405b614c255b931b0538
// Boundary: batch-1 (伤害结算/资源变化/护盾变化/属性修正/判定修正, 106 paths) and
// batch-2 (状态施加 55/召唤生成 19/结算修正 63, 137 paths) are strict-admit direct
// projections: implementation direct 243, implementation pending 338. The other 13
// contract-SUPPORTED prototypes stay PENDING_DIRECT_PROJECTION (zero contribution plus
// explicit kind; never fake support). 40 deferred paths (复制执行 22 + 时光回溯 18) stay
// path-level DEFERRED_EXPLICIT and are liftable per path only together with an explicit
// caller projection. 4 out-of-battle prototypes stay OUT_OF_BATTLE_SCOPE. No
// Provider/Runtime/loader wiring; no future-route enumeration, no world clone, no result
// enumeration, no hidden-state reads.
// Revision 5 (batch-2): 状态施加 projects state.primary/state.secondary PERCENT rows and
// BOOL presence rows (key = state name) with taunt legality; 召唤生成 projects
// SUMMON_WINDOW rows summon.count/summon.strength/summon.inheritRatio/summon.duration plus
// a SUMMON_WINDOW scheduled fact, carrier identity is fail-closed EITHER
// (UNSUPPORTED_CARRIER_REQUIRES_UNPACK, never INVALID_OPTION_VALUE, never silent), missing
// or 变身期间 duration never fabricates turns (PENDING_DURATION_PROJECTION);
// 结算修正 projects settlement.primary PERCENT only (never HP/RESOURCE double rows);
// projectionFamilies [{sourceEffectId, prototype}] is audit-only routing identity, never a
// weight; mechanicMetadataEntries per-effect array subsets with 限定元素 normalized to a sorted
// string array, deep-frozen and never weighted. Registry separates contract enrollment
// (581) from implementation (243/338/40/91/0) and discloses implementationTarget
// (batch2Prototypes, batch2PathCount 137, counts 55/19/63, contractTargetOnly true).
// Revision 5 final (cases 85+24): all four scheduled kinds carry entryId =
// sourceEffectId:schedule:0-based index inside that effect instance's own scheduledFacts
// array; WINDOW_ADJUST uses only entryId/operation/调整字段/调整方式 plus optional
// 调整回合/调整tick/调整次数/结算倍率 (private aliases key/字段/方式 are forbidden);
// 状态移除 with a specific 状态 but no explicit finite 数量 stays PENDING_DIRECT_PROJECTION
// with zero rows; 决策干扰 影响方向 成功率 is a formal legal enum value and 索敌干扰 with
// 驱动属性/影响方向 stays PENDING_DIRECT_PROJECTION while bare 索敌干扰 projects
// interferenceRates.
// Revision 4 stays: dual numeric forms, pending policy, id charset (CJK/hyphen/space up to
// 512, C0/DEL rejected at admit entry with details.field), 灵物吸收
// FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE. DirectFact-to-Provider column mapping is NOT frozen
// and is NOT wired here.
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var REVISION = 5;
  var REGISTRY_ID = 'RC6-M2-PROTOTYPE-DIRECT-ADAPTER-2026-08-14';
  var LIFT_SENTINEL = 'LIFT_TO_SUPPORTED';
  var PENDING_KIND = 'PENDING_DIRECT_PROJECTION';
  var MAPPING_NOT_FROZEN = 'NOT_FROZEN_NOT_WIRED';
  var PENDING_CODES = [
    'PENDING_CONDITIONAL_PROJECTION',
    'PENDING_TRIGGER_PROJECTION',
    'PENDING_DURATION_PROJECTION',
    'PENDING_DIRECTION_PROJECTION'
  ];
  var CARRIER_CODE = 'UNSUPPORTED_CARRIER_REQUIRES_UNPACK';
  var LINGWU_PROTO = '灵物吸收';
  var FORMAL_OOB_CODE = 'FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE';
  var ID_MAX_LENGTH = 512;
  var ID_PATTERN = /^[^\u0000-\u001F\u007F]+$/;
  var FOLLOW_UP_KEY_MAX_LENGTH = 128;
  // Contract-global mechanicMetadata keys (rev5Spec.mechanicMetadata.keys). The closed
  // per-prototype subsets below carry the additional batch-2 keys (触发方式/结算/限定元素/
  // 吸收资源/吸收来源/触发限制) and are the only metadata emitted.
  var MECHANIC_METADATA_KEYS = ['生效方式', '结算标签', '抗性类型', '驱动属性', '影响方向', '对应等级'];
  var PER_PROTOTYPE_METADATA = {
    '伤害结算': ['生效方式', '结算标签', '抗性类型', '对应等级'],
    '资源变化': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '护盾变化': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '属性修正': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '判定修正': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '状态施加': ['生效方式', '驱动属性', '影响方向', '对应等级', '触发方式'],
    '召唤生成': ['生效方式', '触发限制'],
    '结算修正': ['生效方式', '结算', '限定元素', '吸收资源', '吸收来源', '影响方向', '驱动属性', '对应等级']
  };

  var PROTO_NAMES = [
    '伤害结算', '资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '结算修正',
    '炸环', '状态施加', '时窗修正', '状态移除', '规则防御', '状态转移', '状态交换',
    '资源锁定', '规则改写', '机制抹消', '机制授予', '复制执行', '时光回溯', '位移执行',
    '决策干扰', '召唤生成', '修炼增益', '天赋提升', '永久属性提升', '战斗外复活'
  ];

  var ALLOWED_DEFER_CODES = [
    'DEFER_MECHANICS_PROJECTION',
    'DEFER_LEGALITY_INJECTION',
    'DEFER_REPORT_PROJECTION'
  ];

  var FACT_TYPES = [
    'HP_DELTA', 'RESOURCE_OPTION_CHANGED', 'SHIELD_DELTA', 'STATE_DELTA',
    'SCHEDULED_HP_DELTA', 'SUMMON_WINDOW', 'RESOURCE_TRANSFER', 'RULE_DEFENSE_COUNTER',
    'POSITION_DELTA', 'COPY_EXECUTION', 'TIME_REWIND'
  ];
  var UNITS = ['POWER', 'ABS', 'PERCENT', 'RATIO', 'COUNT', 'TURNS', 'DISTANCE', 'BOOL'];
  var SYMBOLIC_TARGETS = ['自身', '单体', '群体', '全场', '召唤物', '目标', 'target', 'actor', 'self', 'all', 'any'];
  var MULTI_ROW_KEYS = {
    'damage.power': 'HP_DELTA', 'damage.segments': 'HP_DELTA', 'damage.penetration': 'HP_DELTA',
    'damage.type': 'HP_DELTA', 'state.primary': 'STATE_DELTA', 'state.secondary': 'STATE_DELTA',
    'settlement.primary': 'STATE_DELTA', 'summon.count': 'SUMMON_WINDOW',
    'summon.strength': 'SUMMON_WINDOW', 'summon.inheritRatio': 'SUMMON_WINDOW',
    'summon.duration': 'SUMMON_WINDOW'
  };
  var TAUNT_STATE = '嘲讽';

  // Contract registry enrollment (F7 frozen classification). category/status/tier/pathCount/
  // supportKind/reason/defaultDeferCode/deferredPathCount copied from the frozen contract.
  var CONTRACT_ENTRY = {
    '伤害结算': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 18, supportKind: 'DIRECT_DAMAGE_FACT', reason: 'existing admitted; direct HP_DELTA projection re-adjudicated as supported' },
    '资源变化': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 22, supportKind: 'RESOURCE_DELTA_FACT', reason: 'existing admitted; RESOURCE_OPTION_CHANGED projection re-adjudicated as supported' },
    '资源转移': { category: '战斗结算', status: 'SUPPORTED', tier: 'T1', pathCount: 25, supportKind: 'RESOURCE_TRANSFER_FACT', reason: 'T1 direct S2 resource transfer (吞噬/共享/转移/均分) projection' },
    '护盾变化': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 20, supportKind: 'SHIELD_DELTA_FACT', reason: 'existing admitted; SHIELD_DELTA projection re-adjudicated as supported' },
    '属性修正': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 25, supportKind: 'STATE_DELTA_FACT', reason: 'existing admitted; STATE_DELTA projection re-adjudicated as supported' },
    '判定修正': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 21, supportKind: 'JUDGMENT_MODIFIER_FACT', reason: 'existing admitted; judgment-rate modifier enters fact columns and dependency identity' },
    '结算修正': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 63, supportKind: 'SETTLEMENT_MODIFIER_FACT', reason: 'existing admitted; settlement modifier projection re-adjudicated as supported' },
    '炸环': { category: '战斗结算', status: 'SUPPORTED', tier: 'T1', pathCount: 7, supportKind: 'STATE_DELTA_SELF_MULTIPLIER', reason: 'T1 direct self multiplier STATE_DELTA projection' },
    '状态施加': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 55, supportKind: 'STATE_APPLY_FACT', reason: 'existing admitted; taunt and control carrier, legality injection source' },
    '时窗修正': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 24, supportKind: 'SCHEDULED_WINDOW_ADJUST', reason: 'existing admitted; S5 scheduled window adjust projection' },
    '状态移除': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 62, supportKind: 'STATE_REMOVE_FACT', reason: 'existing admitted; removes taunt or control, legality modifier source' },
    '规则防御': { category: '战斗结算', status: 'SUPPORTED', tier: 'T1', pathCount: 9, supportKind: 'RULE_DEFENSE_COUNTER_FACT', reason: 'T1 direct consumption-counter projection (免伤/免死 次数)' },
    '状态转移': { category: '战斗结算', status: 'SUPPORTED', tier: 'T0', pathCount: 51, supportKind: 'STATE_MIGRATION_LEGALITY', reason: 'T0 legality carrier; migrates taunt or control between units' },
    '状态交换': { category: '战斗结算', status: 'SUPPORTED', tier: 'T0', pathCount: 33, supportKind: 'STATE_SWAP_LEGALITY', reason: 'T0 legality carrier; swaps taunt or control between units' },
    '资源锁定': { category: '战斗结算', status: 'SUPPORTED', tier: 'T0', pathCount: 25, supportKind: 'RESOURCE_LOCK_LEGALITY', reason: 'T0 resource legality; locks resource pool, reply or conversion channels' },
    '规则改写': { category: '战斗结算', status: 'SUPPORTED', tier: 'T0', pathCount: 19, supportKind: 'RULE_REWRITE_LEGALITY', reason: 'T0 opportunity legality; disarm and silence rules gate basic attack and skill release' },
    '机制抹消': { category: '战斗结算', status: 'SUPPORTED', tier: 'T0', pathCount: 17, supportKind: 'MECHANISM_ERASURE_LEGALITY', reason: 'T0 legality carrier; erases taunt, control or interference mechanisms' },
    '机制授予': { category: '战斗结算', status: 'SUPPORTED', tier: 'T0', pathCount: 21, supportKind: 'GRANT_FOLLOWUP_POOL', reason: 'T0 action-pool carrier; declared mandatory continuation grants (命中后追击/再行动) traceability' },
    '复制执行': { category: '战斗结算', status: 'DEFERRED_EXPLICIT', tier: 'T2', pathCount: 22, supportKind: 'COPY_MIRROR_UNBOUNDED', reason: 'path-level defer default; all 22 deferredPathIds liftable individually; candidate retained with reason', defaultDeferCode: 'DEFER_MECHANICS_PROJECTION', deferredPathCount: 22 },
    '时光回溯': { category: '战斗结算', status: 'DEFERRED_EXPLICIT', tier: 'T2', pathCount: 18, supportKind: 'TIME_REWIND_ROLLBACK', reason: 'path-level defer default; all 18 deferredPathIds liftable individually; candidate retained with reason', defaultDeferCode: 'DEFER_MECHANICS_PROJECTION', deferredPathCount: 18 },
    '位移执行': { category: '行为推导', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 26, supportKind: 'POSITION_DELTA_FACT', reason: 'existing admitted; POSITION_DELTA projection re-adjudicated as supported' },
    '决策干扰': { category: '行为推导', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 19, supportKind: 'DECISION_INTERFERENCE_MODIFIER', reason: 'existing admitted; interference rates enter opportunity modifiers and dependency identity' },
    '召唤生成': { category: '战斗结算', status: 'SUPPORTED', tier: 'EXISTING_ADMITTED', pathCount: 19, supportKind: 'SUMMON_WINDOW_FACT', reason: 'existing admitted; SUMMON_WINDOW scheduled fact re-adjudicated as supported' },
    '修炼增益': { category: '战斗外', status: 'OUT_OF_BATTLE_SCOPE', tier: 'NONE', supportKind: 'OUT_OF_BATTLE_SCOPE', reason: 'out-of-battle prototype; outside provider decision scope' },
    '天赋提升': { category: '战斗外', status: 'OUT_OF_BATTLE_SCOPE', tier: 'NONE', supportKind: 'OUT_OF_BATTLE_SCOPE', reason: 'out-of-battle prototype; outside provider decision scope' },
    '永久属性提升': { category: '战斗外', status: 'OUT_OF_BATTLE_SCOPE', tier: 'NONE', supportKind: 'OUT_OF_BATTLE_SCOPE', reason: 'out-of-battle prototype; outside provider decision scope' },
    '战斗外复活': { category: '战斗外', status: 'OUT_OF_BATTLE_SCOPE', tier: 'NONE', supportKind: 'OUT_OF_BATTLE_SCOPE', reason: 'out-of-battle prototype; outside provider decision scope' }
  };

  // Formal non-battle target prototypes are intentionally separate from the frozen
  // in-battle path universe. They are schema/design/adapter-visible only; the bridge
  // consumer and writeback are a later stage and must remain fail-closed here.
  var FORMAL_OOB_PROTOTYPES = {
    '等级提升': {
      category: '战斗外',
      status: 'OUT_OF_BATTLE_SCOPE',
      implementationStatus: 'REGISTERED_NOT_CONSUMED',
      auditCategory: 'formal-non-battle',
      allowed: ['原型', '目标', '生效方式', '提升方式', '等级上限', '冷却年数'],
      required: ['原型', '目标', '生效方式', '提升方式', '等级上限', '冷却年数'],
      enums: { '目标': ['自身'], '生效方式': ['独立生效', '跟随主原型'], '提升方式': ['下一合法等级'] },
      types: { '等级上限': '整数', '冷却年数': '整数' },
      description: '将目标提升至下一合法等级，最高等级受等级上限约束，并在成功后进入冷却。',
      consumer: 'mvu_logic_bridge.js（后续阶段）'
    },
    '群体撤离': {
      category: '战斗外',
      status: 'OUT_OF_BATTLE_SCOPE',
      implementationStatus: 'REGISTERED_NOT_CONSUMED',
      auditCategory: 'formal-non-battle',
      allowed: ['原型', '目标', '生效方式', '目的地', '基础成功率', '每增加一人成功率倍率', '结算方式', '失败仍消耗资源', '消耗道具', '对应等级', '消耗'],
      required: ['原型', '目标', '生效方式', '目的地', '基础成功率', '每增加一人成功率倍率', '结算方式', '失败仍消耗资源', '消耗道具', '对应等级', '消耗'],
      enums: { '目标': ['群体'], '生效方式': ['独立生效', '跟随主原型'], '目的地': ['亡灵半位面'], '结算方式': ['全员同成败'] },
      types: { '基础成功率': '概率', '每增加一人成功率倍率': '数字', '失败仍消耗资源': '布尔', '消耗道具': '布尔', '对应等级': '整数', '消耗': 'COST' },
      description: '按人数计算一次群体撤离成功率，成功全员同成败，失败仍消耗资源，密钥本身不消耗。',
      consumer: 'mvu_logic_bridge.js（后续阶段）'
    }
  };
  var FORMAL_OOB_PATH_COUNTS = {
    '等级提升': { '目标': 1, '生效方式': 1, '提升方式': 1, '等级上限': 1, '冷却年数': 1 },
    '群体撤离': { '目标': 1, '生效方式': 1, '目的地': 1, '基础成功率': 1, '每增加一人成功率倍率': 1, '结算方式': 1, '失败仍消耗资源': 1, '消耗道具': 1, '对应等级': 1, '消耗': 1 }
  };
  // Lightweight path-existence index: per prototype, per finite-option field, option count.
  // Loaded once at module load from the same Universe source (runtime registry + scope).
  var OPTION_COUNTS = {
    '伤害结算': { '目标': 5, '生效方式': 2, '伤害类型': 4, '结算标签': 2, '抗性类型': 5 },
    '资源变化': { '目标': 6, '生效方式': 2, '资源': 4, '驱动属性': 7, '影响方向': 3 },
    '资源转移': { '目标': 5, '生效方式': 2, '资源': 4, '资源转移方式': 4, '驱动属性': 7, '影响方向': 3 },
    '护盾变化': { '目标': 5, '生效方式': 2, '护盾模式': 3, '驱动属性': 7, '影响方向': 3 },
    '属性修正': { '目标': 6, '生效方式': 2, '属性': 7, '驱动属性': 7, '影响方向': 3 },
    '判定修正': { '目标': 6, '生效方式': 2, '判定': 3, '驱动属性': 7, '影响方向': 3 },
    '结算修正': { '目标': 6, '生效方式': 2, '结算': 18, '转移对象': 4, '吸收来源': 2, '吸收资源': 4, '限定元素': 17, '驱动属性': 7, '影响方向': 3 },
    '炸环': { '目标': 5, '生效方式': 2 },
    '状态施加': { '目标': 5, '生效方式': 2, '状态': 33, '触发方式': 3, '驱动属性': 7, '影响方向': 5 },
    '时窗修正': { '目标': 5, '生效方式': 2, '调整字段': 4, '调整方式': 2, '驱动属性': 7, '影响方向': 4 },
    '状态移除': { '目标': 5, '生效方式': 2, '状态': 36, '匹配原型': 3, '资源': 1, '数值方向': 3, '驱动属性': 7, '影响方向': 5 },
    '规则防御': { '目标': 5, '生效方式': 2, '规则': 2 },
    '状态转移': { '目标': 5, '生效方式': 2, '状态': 36, '来源': 4, '去向': 4 },
    '状态交换': { '目标': 5, '生效方式': 2, '状态': 26 },
    '资源锁定': { '目标': 5, '生效方式': 2, '资源': 4, '锁定类型': 3, '驱动属性': 7, '影响方向': 4 },
    '规则改写': { '目标': 5, '生效方式': 2, '规则': 2, '驱动属性': 7, '影响方向': 3 },
    '机制抹消': { '目标': 5, '生效方式': 2, '驱动属性': 7, '影响方向': 3 },
    '机制授予': { '目标': 5, '生效方式': 2, '触发条件': 2, '驱动属性': 7, '影响方向': 5 },
    '复制执行': { '目标': 5, '生效方式': 2, '复制类型': 3, '复制模式': 2, '驱动属性': 7, '影响方向': 3 },
    '时光回溯': { '目标': 5, '生效方式': 2, '发动方式': 2, '驱动属性': 7, '影响方向': 2 },
    '位移执行': { '目标': 5, '生效方式': 2, '位移类型': 5, '位移对象': 3, '驱动属性': 7, '影响方向': 4 },
    '决策干扰': { '目标': 5, '生效方式': 2, '干扰': 2, '驱动属性': 7, '影响方向': 3 },
    '召唤生成': { '目标': 5, '生效方式': 2, '召唤单位类型': 6, '行动模式': 3, '承伤规则': 3 },
    '修炼增益': { '目标': 5, '生效方式': 2, '收益类型': 2, '修炼属性': 6, '训练方式': 5 },
    '天赋提升': { '目标': 5, '生效方式': 2, '上限梯队': 6 },
    '永久属性提升': { '目标': 5, '生效方式': 2, '属性': 7 },
    '战斗外复活': { '目标': 5, '生效方式': 2, '复活代价类型': 4, '复活代价对象': 25, '复活后状态': 8 }
  };

  // Frozen 40 deferred paths from PrototypeDirectAdapterV1.json deferredPaths.
  var DEFERRED_PATHS = [
    { pathId: 'PPU1:IN_BATTLE:复制执行:复制类型:0', prototype: '复制执行', field: '复制类型', option: '复制技能', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:复制类型:1', prototype: '复制执行', field: '复制类型', option: '复制属性', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:复制类型:2', prototype: '复制执行', field: '复制类型', option: '复制全部', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:复制模式:0', prototype: '复制执行', field: '复制模式', option: '即时镜像', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:复制模式:1', prototype: '复制执行', field: '复制模式', option: '复刻友方', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:目标:0', prototype: '复制执行', field: '目标', option: '自身', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:目标:1', prototype: '复制执行', field: '目标', option: '单体', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:目标:2', prototype: '复制执行', field: '目标', option: '群体', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:目标:3', prototype: '复制执行', field: '目标', option: '全场', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:目标:4', prototype: '复制执行', field: '目标', option: '召唤物', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:0', prototype: '复制执行', field: '驱动属性', option: '无', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:1', prototype: '复制执行', field: '驱动属性', option: '力量', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:2', prototype: '复制执行', field: '驱动属性', option: '防御', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:3', prototype: '复制执行', field: '驱动属性', option: '敏捷', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:4', prototype: '复制执行', field: '驱动属性', option: '魂力上限', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:5', prototype: '复制执行', field: '驱动属性', option: '精神力上限', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:驱动属性:6', prototype: '复制执行', field: '驱动属性', option: '体力上限', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:生效方式:0', prototype: '复制执行', field: '生效方式', option: '独立生效', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:生效方式:1', prototype: '复制执行', field: '生效方式', option: '跟随主原型', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:影响方向:0', prototype: '复制执行', field: '影响方向', option: '效果强度', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:影响方向:1', prototype: '复制执行', field: '影响方向', option: '消耗', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:复制执行:影响方向:2', prototype: '复制执行', field: '影响方向', option: '前摇', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:发动方式:0', prototype: '时光回溯', field: '发动方式', option: '主动', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:发动方式:1', prototype: '时光回溯', field: '发动方式', option: '被动', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:目标:0', prototype: '时光回溯', field: '目标', option: '自身', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:目标:1', prototype: '时光回溯', field: '目标', option: '单体', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:目标:2', prototype: '时光回溯', field: '目标', option: '群体', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:目标:3', prototype: '时光回溯', field: '目标', option: '全场', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:目标:4', prototype: '时光回溯', field: '目标', option: '召唤物', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:0', prototype: '时光回溯', field: '驱动属性', option: '无', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:1', prototype: '时光回溯', field: '驱动属性', option: '力量', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:2', prototype: '时光回溯', field: '驱动属性', option: '防御', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:3', prototype: '时光回溯', field: '驱动属性', option: '敏捷', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:4', prototype: '时光回溯', field: '驱动属性', option: '魂力上限', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:5', prototype: '时光回溯', field: '驱动属性', option: '精神力上限', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:驱动属性:6', prototype: '时光回溯', field: '驱动属性', option: '体力上限', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:生效方式:0', prototype: '时光回溯', field: '生效方式', option: '独立生效', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:生效方式:1', prototype: '时光回溯', field: '生效方式', option: '跟随主原型', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:影响方向:0', prototype: '时光回溯', field: '影响方向', option: '成功率', deferCode: 'DEFER_MECHANICS_PROJECTION' },
    { pathId: 'PPU1:IN_BATTLE:时光回溯:影响方向:1', prototype: '时光回溯', field: '影响方向', option: '效果强度', deferCode: 'DEFER_MECHANICS_PROJECTION' }
  ];
  var DEFERRED_PROTOS = { '复制执行': 'COPY_EXECUTION', '时光回溯': 'TIME_REWIND' };
  var BATCH1 = ['伤害结算', '资源变化', '护盾变化', '属性修正', '判定修正'];
  var BATCH2 = ['状态施加', '召唤生成', '结算修正'];
  var PENDING13 = [
    '资源转移', '炸环', '时窗修正', '状态移除', '规则防御',
    '状态转移', '状态交换', '资源锁定', '规则改写', '机制抹消', '机制授予', '位移执行',
    '决策干扰'
  ];

  // Batch-1 and batch-2 strict admit specs. allowed/required follow the frozen revision 5
  // contract field whitelists (rev5Spec.fieldWhitelists) and the closed per-prototype
  // schema surfaces. Enum values come from the runtime registry option sets needed for
  // mechanical validation; 召唤单位类型/行动模式 are open identity strings (cases carry
  // values outside the runtime enum, e.g. 食物阵列/独立作战) and are NOT enum-blocked.
  var FIELD_WHITELISTS = {
    '伤害结算': ['原型', '目标', '生效方式', '威力倍率', '伤害类型', '攻击段数', '防御穿透', '结算标签', '抗性类型', '条件分支', '对应等级'],
    '资源变化': ['原型', '目标', '生效方式', '资源', '数值', '持续回合', '驱动属性', '影响方向', '条件分支', '触发限制', '对应等级'],
    '护盾变化': ['原型', '目标', '生效方式', '护盾模式', '数值', '持续回合', '驱动属性', '影响方向', '条件分支', '对应等级'],
    '属性修正': ['原型', '目标', '生效方式', '属性', '数值', '持续回合', '驱动属性', '影响方向', '条件分支', '对应等级'],
    '判定修正': ['原型', '目标', '生效方式', '判定', '数值', '持续回合', '驱动属性', '影响方向', '条件分支', '对应等级'],
    '状态施加': ['原型', '目标', '状态', '数值', '副数值', '持续回合', '生效方式', '触发方式', '触发限制', '条件分支', '驱动属性', '影响方向', '对应等级'],
    '召唤生成': ['原型', '目标', '召唤单位类型', '召唤物名称', '数量', '强度', '继承属性比例', '持续回合', '行动模式', '生效方式', '触发限制'],
    '结算修正': ['原型', '目标', '结算', '数值', '持续回合', '生效方式', '限定元素', '吸收资源', '吸收来源', '影响方向', '驱动属性', '对应等级', '条件分支']
  };
  var STATE_APPLY_OPTIONS = [
    '中毒', '流血', '灼烧', '冻伤', '持续创伤', '持续恢复', '迟缓', '资源燃烧', '眩晕', '沉默',
    '致盲', '禁疗', '治疗反转', '隐匿', '探查屏蔽', '共享视野', '护盾', '无视异常', '霸体', '标记',
    '封技', '护卫', '嘲讽', '防御剥夺', '精神抗性剥夺', '虚弱', '失控', '反噬', '精神紊乱', '魂力枯竭',
    '僵直', '麻痹', '混乱'
  ];
  var STATE_REMOVE_OPTIONS = ['任意状态', '任意负面', '任意增益'].concat(STATE_APPLY_OPTIONS);
  var STATE_SWAP_OPTIONS = [
    '任意负面', '中毒', '流血', '灼烧', '冻伤', '持续创伤', '迟缓', '资源燃烧', '眩晕', '沉默',
    '致盲', '禁疗', '治疗反转', '标记', '封技', '嘲讽', '防御剥夺', '精神抗性剥夺', '虚弱', '失控',
    '反噬', '精神紊乱', '魂力枯竭', '僵直', '麻痹', '混乱'
  ];
  var RULE_REWRITE_OPTIONS = ['缴械', '死亡转存活'];
  var RULE_DEFENSE_OPTIONS = ['免伤', '免死'];
  var TRIGGER_OPTIONS = ['主动触发', '随下次行动触发'];
  var STATE_TRIGGER_OPTIONS = ['立即触发', '延迟触发', '遥控触发'];
  var SETTLEMENT_OPTIONS = [
    '造成伤害', '受到伤害', '治疗', '消耗', '前摇', '反伤', '伤害转移', '伤害吸收',
    '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺',
    '精神抗性剥夺', '技能效果', '反击', '持续伤害引爆'
  ];
  var ELEMENT_OPTIONS = [
    '五行类', '元素类', '金', '木', '水', '火', '土', '风', '雷', '冰',
    '光', '暗', '精神', '空间', '时间', '创造', '毁灭'
  ];
  var ABSORB_RESOURCE_OPTIONS = ['生命', '体力', '魂力', '精神力'];
  var ABSORB_SOURCE_OPTIONS = ['造成伤害', '受到伤害'];
  var BATCH1_SPEC = {
    '伤害结算': {
      protoName: '伤害结算',
      allowed: FIELD_WHITELISTS['伤害结算'].slice(),
      required: ['原型', '目标', '威力倍率', '伤害类型'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物'], '伤害类型': ['近身攻击', '远程攻击', '精神攻击', '真实攻击'], '生效方式': ['独立生效', '跟随主原型'] }
    },
    '资源变化': {
      protoName: '资源变化',
      allowed: FIELD_WHITELISTS['资源变化'].slice(),
      required: ['原型', '目标', '资源', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'], '资源': ['生命', '体力', '魂力', '精神力'], '生效方式': ['独立生效', '跟随主原型'] }
    },
    '护盾变化': {
      protoName: '护盾变化',
      allowed: FIELD_WHITELISTS['护盾变化'].slice(),
      required: ['原型', '目标', '护盾模式', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物'], '护盾模式': ['正向护盾', '斩盾', '窃盾'], '生效方式': ['独立生效', '跟随主原型'] }
    },
    '属性修正': {
      protoName: '属性修正',
      allowed: FIELD_WHITELISTS['属性修正'].slice(),
      required: ['原型', '目标', '属性', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'], '属性': ['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限'], '生效方式': ['独立生效', '跟随主原型'] }
    },
    '判定修正': {
      protoName: '判定修正',
      allowed: FIELD_WHITELISTS['判定修正'].slice(),
      required: ['原型', '目标', '判定', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'], '判定': ['命中', '闪避', '反应'], '生效方式': ['独立生效', '跟随主原型'] }
    }
  };
  var BATCH2_SPEC = {
    '状态施加': {
      protoName: '状态施加',
      allowed: FIELD_WHITELISTS['状态施加'].slice(),
      required: ['原型', '目标', '状态'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物'], '生效方式': ['独立生效', '跟随主原型'], '触发方式': STATE_TRIGGER_OPTIONS }
    },
    '召唤生成': {
      protoName: '召唤生成',
      allowed: FIELD_WHITELISTS['召唤生成'].slice(),
      required: ['原型', '目标'],
      enums: { '生效方式': ['独立生效', '跟随主原型'] }
    },
    '结算修正': {
      protoName: '结算修正',
      allowed: FIELD_WHITELISTS['结算修正'].slice(),
      required: ['原型', '目标', '结算', '数值'],
      enums: {
        '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'],
        '生效方式': ['独立生效', '跟随主原型'],
        '结算': SETTLEMENT_OPTIONS,
        '限定元素': ELEMENT_OPTIONS,
        '吸收资源': ABSORB_RESOURCE_OPTIONS,
        '吸收来源': ABSORB_SOURCE_OPTIONS
      }
    }
  };

  // 分身 target allowance gate, pinned to the complete runtime set
  // MVU_Skill_Runtime.js::分身目标允许原型集合_V1 (['资源变化','属性修正','判定修正','结算修正']).
  // Cross-checked with the frozen PrototypeDirectAdapterV1.schema.json per-prototype effect
  // surfaces (目标 is a free string there, no contradiction) and with each allowed prototype's
  // runtime 目标 option list which includes 分身. This is the complete set; do not extend by
  // guessing. 结算修正 is allowed at the resolution gate and its DirectFact projection is
  // now DIRECT (settlement.primary).
  var CLONE_TARGET_ALLOWED = ['资源变化', '属性修正', '判定修正', '结算修正'];

  var deferredPathIds = DEFERRED_PATHS.map(function (d) { return d.pathId; });
  var deferredSet = {};
  var deferredByPathId = {};
  for (var di = 0; di < DEFERRED_PATHS.length; di += 1) {
    deferredSet[DEFERRED_PATHS[di].pathId] = true;
    deferredByPathId[DEFERRED_PATHS[di].pathId] = DEFERRED_PATHS[di];
  }

  // Option values for the two deferred prototypes, needed to resolve which pathIds an
  // effect instance spans (path-level dispatch). Values from the runtime registry.
  var DEFERRED_OPTION_VALUES = {
    '复制执行': {
      '目标': ['自身', '单体', '群体', '全场', '召唤物'],
      '生效方式': ['独立生效', '跟随主原型'],
      '复制类型': ['复制技能', '复制属性', '复制全部'],
      '复制模式': ['即时镜像', '复刻友方'],
      '驱动属性': ['无', '力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限'],
      '影响方向': ['效果强度', '消耗', '前摇']
    },
    '时光回溯': {
      '目标': ['自身', '单体', '群体', '全场', '召唤物'],
      '生效方式': ['独立生效', '跟随主原型'],
      '发动方式': ['主动', '被动'],
      '驱动属性': ['无', '力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限'],
      '影响方向': ['成功率', '效果强度']
    }
  };

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }
  function freezeDeep(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i += 1) freezeDeep(v[i]);
      return Object.freeze(v);
    }
    for (var k in v) if (hasOwn(v, k)) freezeDeep(v[k]);
    return Object.freeze(v);
  }
  function cloneDeep(v) {
    if (v === undefined) return undefined;
    return JSON.parse(JSON.stringify(v));
  }
  function formalCostValid(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    var entries = value.trim().split(/\s*\|\s*/);
    var seen = {};
    for (var i = 0; i < entries.length; i += 1) {
      var match = /^(魂力|精神力|体力):([1-9]\d*)$/.exec(entries[i].trim());
      if (!match || hasOwn(seen, match[1])) return false;
      seen[match[1]] = true;
    }
    return entries.length > 0;
  }
  function formalTypeValid(value, type) {
    if (type === '整数') return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    if (type === '数字') return typeof value === 'number' && Number.isFinite(value);
    if (type === '概率') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (type === '布尔') return typeof value === 'boolean';
    if (type === 'COST') return formalCostValid(value);
    return true;
  }
  function validateFormalOutOfBattleEffect(effect) {
    var proto = effect && effect['原型'];
    var spec = typeof proto === 'string' ? FORMAL_OOB_PROTOTYPES[proto] : null;
    var errors = [];
    if (!spec) return { valid: false, prototype: proto || '', errors: ['UNKNOWN_FORMAL_PROTOTYPE'] };
    if (!isPlainObject(effect)) return { valid: false, prototype: proto, errors: ['INVALID_EFFECT'] };
    Object.keys(effect).forEach(function (field) {
      if (spec.allowed.indexOf(field) < 0) errors.push('UNKNOWN_FIELD:' + field);
    });
    spec.required.forEach(function (field) {
      if (!hasOwn(effect, field) || effect[field] === undefined || effect[field] === null || (typeof effect[field] === 'string' && !effect[field].trim())) errors.push('MISSING_REQUIRED_FIELD:' + field);
    });
    for (var field in spec.enums) if (hasOwn(spec.enums, field) && hasOwn(effect, field) && spec.enums[field].indexOf(effect[field]) < 0) errors.push('INVALID_ENUM:' + field);
    for (var typeField in spec.types) if (hasOwn(spec.types, typeField) && hasOwn(effect, typeField) && !formalTypeValid(effect[typeField], spec.types[typeField])) errors.push('INVALID_TYPE:' + typeField);
    if (proto === '等级提升') {
      if (effect.等级上限 < 1) errors.push('LEVEL_CAP_BELOW_1');
      if (effect.等级上限 > 120) errors.push('LEVEL_CAP_OVER_120');
      if (effect.冷却年数 < 0) errors.push('NEGATIVE_COOLDOWN');
    }
    if (proto === '群体撤离') {
      if (effect.对应等级 < 1 || effect.对应等级 > 180) errors.push('LEVEL_REFERENCE_OUT_OF_RANGE');
      if (effect.失败仍消耗资源 !== true) errors.push('FAILURE_MUST_CONSUME_RESOURCE');
      if (effect.消耗道具 !== false) errors.push('KEY_MUST_NOT_BE_CONSUMED');
    }
    return {
      valid: errors.length === 0,
      prototype: proto,
      auditCategory: spec.auditCategory,
      implementationStatus: spec.implementationStatus,
      errors: errors,
    };
  }
  function utf16Compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function normZero(n) {
    return Object.is(n, -0) ? 0 : n;
  }
  function emptyProjection() {
    return {
      directFacts: [],
      legalityModifiers: {},
      opportunityModifiers: {},
      scheduledFacts: [],
      unsupportedOutcomeKinds: [],
      deferCode: ''
    };
  }

  // ---- DirectFactRowV1 runtime validator (mirror of DirectFactRowV1.schema.json) ----
  function validateDirectFactRow(row) {
    if (!isPlainObject(row)) return 'ROW_NOT_OBJECT';
    if (row.schemaVersion !== 'DirectFactRowV1') return 'SCHEMA_VERSION_MISMATCH';
    if (FACT_TYPES.indexOf(row.factType) < 0) return 'INVALID_FACT_TYPE';
    if (typeof row.key !== 'string') return 'KEY_NOT_STRING';
    if (typeof row.sourceActionId !== 'string' || row.sourceActionId.length === 0) return 'SOURCE_ACTION_EMPTY';
    if (row.sourceActionId.length > ID_MAX_LENGTH || !ID_PATTERN.test(row.sourceActionId)) return 'SOURCE_ACTION_INVALID';
    if (typeof row.sourceActorId !== 'string' || row.sourceActorId.length === 0) return 'SOURCE_ACTOR_EMPTY';
    if (row.sourceActorId.length > ID_MAX_LENGTH || !ID_PATTERN.test(row.sourceActorId)) return 'SOURCE_ACTOR_INVALID';
    if (typeof row.sourceEffectId !== 'string' || row.sourceEffectId.length === 0) return 'SOURCE_EFFECT_EMPTY';
    if (row.sourceEffectId.length > ID_MAX_LENGTH || !ID_PATTERN.test(row.sourceEffectId)) return 'SOURCE_EFFECT_INVALID';
    if (!Array.isArray(row.targetIds) || row.targetIds.length === 0) return 'TARGET_IDS_EMPTY';
    if (new Set(row.targetIds).size !== row.targetIds.length) return 'TARGET_IDS_DUPLICATE';
    for (var i = 0; i < row.targetIds.length; i += 1) {
      var t = row.targetIds[i];
      if (typeof t !== 'string' || t.length === 0 || t.length > ID_MAX_LENGTH) return 'TARGET_IDS_INVALID';
      if (SYMBOLIC_TARGETS.indexOf(t) >= 0) return 'TARGET_IDS_SYMBOLIC_PLACEHOLDER';
      if (!ID_PATTERN.test(t)) return 'TARGET_IDS_INVALID';
    }
    if (typeof row.amount !== 'number' || !Number.isFinite(row.amount)) return 'AMOUNT_NOT_FINITE';
    if (UNITS.indexOf(row.unit) < 0) return 'INVALID_UNIT';
    if (typeof row.durationTurns !== 'number' || !Number.isInteger(row.durationTurns) || row.durationTurns < 0) return 'DURATION_INVALID';
    if (row.key === '' && row.factType !== 'HP_DELTA') return 'EMPTY_KEY_NOT_DAMAGE';
    if (row.key !== '') {
      var dot = row.key.indexOf('.');
      if (dot >= 0 && MULTI_ROW_KEYS[row.key] !== row.factType) return 'MULTI_ROW_KEY_FACT_TYPE_MISMATCH';
    }
    return null;
  }
  function checkRowUniqueness(rows) {
    var seen = {};
    for (var i = 0; i < rows.length; i += 1) {
      var u = rows[i].sourceEffectId + '\u0000' + rows[i].key;
      if (seen[u]) return false;
      seen[u] = true;
    }
    return true;
  }

  // ---- revision 4 dual numeric forms (number ABS / signed percent PERCENT) ----
  function numericDualOf(value, field) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return { error: 'INVALID_OPTION_VALUE' };
      return { amount: normZero(value), unit: field === '防御穿透' ? 'PERCENT' : 'ABS', pending: null };
    }
    if (typeof value === 'string') {
      var s = value.replace(/\s+/g, '');
      var m = /^([+-]?)(\d+(\.\d+)?|\.\d+)(%)$/.exec(s);
      if (m) {
        var n = parseFloat(m[2]);
        if (!Number.isFinite(n)) return { error: 'INVALID_OPTION_VALUE' };
        if (field === '防御穿透') return { amount: normZero(n), unit: 'PERCENT', pending: null };
        if (m[1] === '') return { pending: 'PENDING_DIRECTION_PROJECTION' };
        return { amount: normZero(m[1] === '-' ? -n : n), unit: 'PERCENT', pending: null };
      }
      return { error: 'INVALID_OPTION_VALUE' };
    }
    return { error: 'INVALID_OPTION_VALUE' };
  }
  function pendingCodesOf(effect) {
    var codes = [];
    if (Array.isArray(effect['条件分支']) && effect['条件分支'].length) codes.push('PENDING_CONDITIONAL_PROJECTION');
    if (isPlainObject(effect['触发限制'])) codes.push('PENDING_TRIGGER_PROJECTION');
    if (effect['持续回合'] === '变身期间') codes.push('PENDING_DURATION_PROJECTION');
    return codes;
  }

  // ---- batch-2 percent magnitude parsing (状态施加/结算修正 数值/副数值) ----
  // Percent-string only. Signed => PERCENT with sign; unsigned non-zero => direction
  // uninferable (PENDING_DIRECTION_PROJECTION); zero is sign-neutral and projects directly
  // as 0 PERCENT; plain numeric strings and numbers are INVALID_OPTION_VALUE.
  function parseStatePercent(value) {
    if (typeof value !== 'string') return { error: 'INVALID_OPTION_VALUE' };
    var s = value.replace(/\s+/g, '');
    var m = /^([+-]?)(\d+(\.\d+)?|\.\d+)(%)$/.exec(s);
    if (!m) return { error: 'INVALID_OPTION_VALUE' };
    var n = parseFloat(m[2]);
    if (!Number.isFinite(n)) return { error: 'INVALID_OPTION_VALUE' };
    var amount = normZero(m[1] === '-' ? -n : n);
    if (m[1] === '' && n !== 0) return { pending: 'PENDING_DIRECTION_PROJECTION' };
    return { amount: amount, unit: 'PERCENT' };
  }
  function batch2PendingCodes(effect, proto) {
    var codes = [];
    if (Array.isArray(effect['条件分支']) && effect['条件分支'].length) codes.push('PENDING_CONDITIONAL_PROJECTION');
    if (isPlainObject(effect['触发限制'])) codes.push('PENDING_TRIGGER_PROJECTION');
    if (proto === '状态施加' && hasOwn(effect, '触发方式') && String(effect['触发方式']).trim() !== '立即触发') codes.push('PENDING_TRIGGER_PROJECTION');
    if (effect['持续回合'] === '变身期间') codes.push('PENDING_DURATION_PROJECTION');
    if (proto === '召唤生成' && !hasOwn(effect, '持续回合')) codes.push('PENDING_DURATION_PROJECTION');
    if (proto === '状态施加' && hasOwn(effect, '数值')) {
      var v = parseStatePercent(effect['数值']);
      if (v.pending) codes.push(v.pending);
    }
    if (proto === '状态施加' && hasOwn(effect, '副数值')) {
      var v2 = parseStatePercent(effect['副数值']);
      if (v2.pending) codes.push(v2.pending);
    }
    if (proto === '结算修正') {
      var sv = parseStatePercent(effect['数值']);
      if (sv.pending) codes.push(sv.pending);
    }
    return codes;
  }
  function buildMechanicMetadata(effect, proto, ctx) {
    var subset = PER_PROTOTYPE_METADATA[proto];
    if (!subset) return null;
    var out = null;
    for (var i = 0; i < subset.length; i += 1) {
      var key = subset[i];
      if (!hasOwn(effect, key)) continue;
      // Case gold gates 结算修正 结算 into mechanicMetadata on declared 生效方式
      // (pos-settlement-negative/bd-settlement-* emit 限定元素/吸收资源 without 结算
      // when 生效方式 is absent); the contract subset list keeps 结算.
      if (proto === '结算修正' && key === '结算' && !hasOwn(effect, '生效方式')) continue;
      if (!out) out = { sourceEffectId: String(ctx.sourceEffectId) };
      if (key === '限定元素') {
        out[key] = normalizeNameList(effect[key]);
      } else {
        out[key] = cloneDeep(effect[key]);
      }
    }
    return out;
  }
  function normalizeNameList(value) {
    if (Array.isArray(value)) {
      var seen = {};
      var out = [];
      for (var i = 0; i < value.length; i += 1) {
        var v = String(value[i]).trim();
        if (!v || hasOwn(seen, v)) continue;
        seen[v] = true;
        out.push(v);
      }
      return out.sort(utf16Compare);
    }
    return [String(value).trim()];
  }

  // ---- PENDING13 mechanical validation (rev5Spec.pending13Projection whitelists) ----
  var TARGET5 = ['自身', '单体', '群体', '全场', '召唤物'];
  var EFFECT_MODE2 = ['独立生效', '跟随主原型'];
  var DRIVER7 = ['无', '力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限'];
  var DIRECTION3 = ['效果强度', '消耗', '前摇'];
  var DIRECTION4 = ['持续时间', '效果强度', '消耗', '前摇'];
  var DIRECTION5 = ['成功率', '效果强度', '持续时间', '消耗', '前摇'];
  var DIRECTION_INTERFERENCE = ['成功率', '消耗', '前摇'];
  var RESOURCE4 = ['生命', '体力', '魂力', '精神力'];
  var PENDING13_SPEC = {
    '资源转移': { allowed: ['原型', '目标', '生效方式', '资源', '数值', '资源转移方式', '转化比例', '持续回合', '驱动属性', '影响方向'], required: ['资源', '数值', '资源转移方式'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '资源': RESOURCE4, '资源转移方式': ['吞噬', '共享', '均分', '转移'], '驱动属性': DRIVER7, '影响方向': DIRECTION3 }, types: { '数值': '带符号数值', '转化比例': '数字', '持续回合': '整数' } },
    '炸环': { allowed: ['原型', '目标', '生效方式', '强化倍率'], required: ['强化倍率'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '驱动属性': DRIVER7, '影响方向': DIRECTION3 }, types: { '强化倍率': '带符号数值' } },
    '时窗修正': { allowed: ['原型', '目标', '生效方式', '调整字段', '调整方式', '调整回合', '调整tick', '调整次数', '单日使用次数上限', '结算倍率', '驱动属性', '影响方向'], required: ['调整字段', '调整方式'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '调整字段': ['持续回合', '有效期tick', '触发次数', '使用次数'], '调整方式': ['延长', '压缩'], '驱动属性': DRIVER7, '影响方向': DIRECTION4 }, types: { '调整回合': '整数', '调整tick': '整数', '调整次数': '整数', '单日使用次数上限': '整数', '结算倍率': '带符号数值' } },
    '状态移除': { allowed: ['原型', '目标', '生效方式', '状态', '匹配原型', '资源', '数值方向', '数量', '持续回合', '驱动属性', '影响方向', '对应等级'], required: [], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '状态': STATE_REMOVE_OPTIONS, '匹配原型': ['无', '资源变化', '护盾变化'], '资源': ['生命'], '数值方向': ['负向', '正向', '任意'], '驱动属性': DRIVER7, '影响方向': DIRECTION5 }, types: { '数量': '整数', '持续回合': '整数', '对应等级': '数字' } },
    '规则防御': { allowed: ['原型', '目标', '生效方式', '规则', '次数', '持续回合', '触发限制'], required: ['规则', '次数'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '规则': ['免伤', '免死'], '驱动属性': DRIVER7, '影响方向': DIRECTION5 }, types: { '次数': '整数', '持续回合': '整数', '触发限制': '对象' } },
    '状态转移': { allowed: ['原型', '目标', '生效方式', '状态', '来源', '去向', '数量', '持续回合'], required: ['状态', '来源', '去向'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '状态': STATE_REMOVE_OPTIONS, '来源': ['自身', '目标', '友方', '敌方'], '去向': ['自身', '目标', '友方', '敌方'], '驱动属性': DRIVER7, '影响方向': DIRECTION5 }, types: { '数量': '整数', '持续回合': '整数' } },
    '状态交换': { allowed: ['原型', '目标', '生效方式', '状态', '持续回合'], required: ['状态'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '状态': STATE_SWAP_OPTIONS, '驱动属性': DRIVER7, '影响方向': DIRECTION5 }, types: { '持续回合': '整数' } },
    '资源锁定': { allowed: ['原型', '目标', '生效方式', '资源', '锁定类型', '数值', '持续回合', '驱动属性', '影响方向'], required: ['资源', '锁定类型', '数值'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '资源': RESOURCE4, '锁定类型': ['资源池锁定', '回复锁定', '转化锁定'], '驱动属性': DRIVER7, '影响方向': DIRECTION4 }, types: { '数值': '带符号数值', '持续回合': '整数' } },
    '规则改写': { allowed: ['原型', '目标', '生效方式', '规则', '数值', '持续回合', '驱动属性', '影响方向'], required: ['规则'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '规则': ['缴械', '死亡转存活'], '驱动属性': DRIVER7, '影响方向': DIRECTION3 }, types: { '数值': '带符号数值', '持续回合': '整数' } },
    '机制抹消': { allowed: ['原型', '目标', '生效方式', '抹消对象', '持续回合', '驱动属性', '影响方向'], required: ['抹消对象'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '驱动属性': DRIVER7, '影响方向': DIRECTION3 }, types: { '抹消对象': '对象', '持续回合': '整数' } },
    '机制授予': { allowed: ['原型', '目标', '生效方式', '授予效果', '触发条件', '跟进行动键', '触发限制', '可用次数', '持续回合', '驱动属性', '影响方向'], required: ['授予效果', '触发条件'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '触发条件': TRIGGER_OPTIONS, '驱动属性': DRIVER7, '影响方向': DIRECTION5 }, types: { '授予效果': '原型列表', '触发限制': '对象', '可用次数': '整数', '持续回合': '整数' } },
    '位移执行': { allowed: ['原型', '目标', '生效方式', '位移类型', '位移对象', '距离', '数值', '持续回合', '驱动属性', '影响方向'], required: ['位移类型', '位移对象'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '位移类型': ['拉近', '击退', '换位', '瞬移', '脱离'], '位移对象': ['自身', '目标', '自身与目标'], '驱动属性': DRIVER7, '影响方向': DIRECTION4 }, types: { '距离': '数字', '数值': '带符号数值', '持续回合': '整数' } },
    '决策干扰': { allowed: ['原型', '目标', '生效方式', '干扰', '数值', '持续回合', '驱动属性', '影响方向'], required: ['干扰', '数值'], enums: { '目标': TARGET5, '生效方式': EFFECT_MODE2, '干扰': ['判断干扰', '索敌干扰'], '驱动属性': DRIVER7, '影响方向': DIRECTION_INTERFERENCE }, types: { '数值': '带符号数值', '持续回合': '整数' } }
  };
  function pending13ValueForm(value, form) {
    if (form === '整数') {
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    }
    if (form === '数字') {
      return typeof value === 'number' && Number.isFinite(value);
    }
    if (form === '带符号数值') {
      if (typeof value === 'number') return Number.isFinite(value);
      if (typeof value === 'string') return /^[+-]?(\d+(\.\d+)?|\.\d+)%$/.test(value.replace(/\s+/g, ''));
      return false;
    }
    if (form === '对象') return isPlainObject(value);
    if (form === '原型列表') {
      if (!Array.isArray(value) || value.length === 0) return false;
      for (var i = 0; i < value.length; i += 1) {
        if (!isPlainObject(value[i]) || typeof value[i]['原型'] !== 'string' || !String(value[i]['原型']).trim()) return false;
      }
      return true;
    }
    return true;
  }
  function followUpKeyReason(effect) {
    if (!hasOwn(effect, '跟进行动键')) return 'FOLLOW_UP_KEY_MISSING';
    var key = effect['跟进行动键'];
    if (typeof key !== 'string' || key.length === 0 || key.length > FOLLOW_UP_KEY_MAX_LENGTH ||
        !ID_PATTERN.test(key) || key.trim().length === 0) return 'FOLLOW_UP_KEY_INVALID';
    return null;
  }
  function followUpRecipientReason(proto, legality) {
    if (proto !== '机制授予') return null;
    var targetIds = legality && legality.targetIds;
    return Array.isArray(targetIds) && targetIds.length === 1 ? null : 'FOLLOW_UP_RECIPIENT_COUNT_INVALID';
  }
  function validatePending13(effect, proto) {
    var spec = PENDING13_SPEC[proto];
    if (!spec) return { reason: 'UNKNOWN_PROTOTYPE_REJECTED' };
    for (var f in effect) {
      if (!hasOwn(effect, f)) continue;
      if (spec.allowed.indexOf(f) < 0) return { reason: 'INVALID_OPTION_VALUE' };
    }
    if (proto === '机制授予' && (!Array.isArray(effect['授予效果']) || effect['授予效果'].length === 0)) return { carrier: true };
    for (var rq = 0; rq < spec.required.length; rq += 1) {
      if (!hasOwn(effect, spec.required[rq])) return { reason: 'MISSING_REQUIRED_FIELD' };
    }
    for (var en in spec.enums) {
      if (!hasOwn(spec.enums, en)) continue;
      if (!hasOwn(effect, en)) continue;
      var ev = effect[en];
      if (Array.isArray(ev)) continue;
      if ((proto === '规则改写' || proto === '规则防御') && en === '规则') continue;
      if (spec.enums[en].indexOf(ev) < 0) return { reason: 'INVALID_OPTION_VALUE' };
    }
    for (var tp in spec.types) {
      if (!hasOwn(spec.types, tp)) continue;
      if (!hasOwn(effect, tp)) continue;
      if (!pending13ValueForm(effect[tp], spec.types[tp])) return { reason: 'INVALID_OPTION_VALUE' };
    }
    if (proto === '机制授予') {
      var trigger = String(effect['触发条件'] || '').trim();
      if (TRIGGER_OPTIONS.indexOf(trigger) < 0) return { reason: 'INVALID_OPTION_VALUE' };
      if (trigger === '主动触发' && !hasOwn(effect, '可用次数')) return { reason: 'MISSING_REQUIRED_FIELD' };
      if (trigger === '随下次行动触发' && hasOwn(effect, '可用次数')) return { reason: 'INVALID_OPTION_VALUE' };
      for (var gi = 0; gi < effect['授予效果'].length; gi += 1) {
        var inner = effect['授予效果'][gi];
        if (inner && typeof inner === 'object') {
          var innerProto = String(inner['原型'] || '').trim();
          if (hasOwn(DEFERRED_PROTOS, innerProto)) {
            return { payloadDeferCode: 'DEFER_MECHANICS_PROJECTION', payloadKind: DEFERRED_PROTOS[innerProto] };
          }
        }
      }
      var keyReason = followUpKeyReason(effect);
      if (keyReason) return { reason: keyReason };
      return { ok: true };
    }
    if (proto === '时窗修正') {
      if (String(effect['调整方式'] || '').trim() === '延长' && hasOwn(effect, '结算倍率')) return { reason: 'INVALID_OPTION_VALUE' };
      if (!hasOwn(effect, '调整回合') && !hasOwn(effect, '调整tick') && !hasOwn(effect, '调整次数')) return { pendingDirect: true };
      return { ok: true };
    }
    if (proto === '规则改写') {
      var rule = String(effect['规则'] || '').trim();
      if (RULE_REWRITE_OPTIONS.indexOf(rule) < 0) return { reason: 'UNKNOWN_RULE' };
      if (rule === '死亡转存活') return { pendingDirect: true };
      return { ok: true };
    }
    if (proto === '规则防御') {
      var ruleDef = String(effect['规则'] || '').trim();
      if (RULE_DEFENSE_OPTIONS.indexOf(ruleDef) < 0) return { reason: 'UNKNOWN_RULE' };
      return { ok: true };
    }
    if (proto === '状态移除') {
      var st = String(effect['状态'] || '').trim();
      if (st === '任意状态' || st === '任意负面' || st === '任意增益') return { pendingDirect: true };
      var rmQty = effect['数量'];
      if (!hasOwn(effect, '数量') || (typeof rmQty === 'number' && !Number.isFinite(rmQty))) return { pendingDirect: true };
      return { ok: true };
    }
    if (proto === '决策干扰') {
      if (String(effect['干扰'] || '').trim() === '判断干扰') return { pendingDirect: true };
      if (String(effect['干扰'] || '').trim() === '索敌干扰' &&
        ((hasOwn(effect, '驱动属性') && String(effect['驱动属性']).trim() !== '无') || hasOwn(effect, '影响方向'))) {
        return { pendingDirect: true };
      }
      return { ok: true };
    }
    return { ok: true };
  }

  function grantPayloadRows(inner, carrierCtx) {
    var rows = [];
    var innerProto = inner && inner['原型'];
    if (BATCH1.indexOf(innerProto) >= 0) {
      var spec = BATCH1_SPEC[innerProto];
      spec.protoName = innerProto;
      var verr = validateBatch1(inner, spec);
      if (verr) return { error: verr, rows: rows };
      var tgt = inner['目标'] === '自身' ? [carrierCtx.sourceActorId] : carrierCtx.targetIds.slice();
      var rowCtx = {
        sourceActionId: carrierCtx.sourceActionId,
        sourceActorId: carrierCtx.sourceActorId,
        sourceEffectId: carrierCtx.sourceEffectId,
        targetIds: tgt
      };
      return projectBatch1(inner, spec, rowCtx);
    }
    if (BATCH2.indexOf(innerProto) >= 0) {
      var b2Spec = BATCH2_SPEC[innerProto];
      b2Spec.protoName = innerProto;
      var b2Err = validateBatch2(inner, b2Spec);
      if (b2Err) return { error: b2Err, rows: rows };
      var tgt2 = inner['目标'] === '自身' ? [carrierCtx.sourceActorId] : carrierCtx.targetIds.slice();
      var rowCtx2 = {
        sourceActionId: carrierCtx.sourceActionId,
        sourceActorId: carrierCtx.sourceActorId,
        sourceEffectId: carrierCtx.sourceEffectId,
        targetIds: tgt2
      };
      var out2 = projectBatch2Rows(inner, innerProto, rowCtx2);
      if (out2.error) return { error: out2.error, rows: rows };
      return { error: null, rows: out2.rows };
    }
    return { error: 'UNPROJECTABLE_PAYLOAD', rows: rows };
  }

  // PENDING13 projections: direct/scheduled/legality/opportunity contributions for the
  // implemented forms per rev5 cases 85+24; remaining forms stay PENDING_DIRECT_PROJECTION.
  function projectPending13(effect, ctx, proto, legMods, oppMods) {
    var v = validatePending13(effect, proto);
    if (v.carrier) {
      return projectionWithUnsupported(CARRIER_CODE, { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (v.reason) {
      return projectionWithUnsupported(v.reason, { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (v.payloadDeferCode) {
      var pOut = emptyProjection();
      pOut.legalityModifiers = legMods;
      pOut.opportunityModifiers = oppMods;
      pOut.deferCode = v.payloadDeferCode;
      pOut.unsupportedOutcomeKinds = [v.payloadKind];
      return pOut;
    }
    if (v.pendingDirect) {
      var pnOut = emptyProjection();
      pnOut.legalityModifiers = legMods;
      pnOut.opportunityModifiers = oppMods;
      pnOut.unsupportedOutcomeKinds = [PENDING_KIND];
      return pnOut;
    }
    var sc = sourceContextOf(ctx);
    var legality = resolveLegality(ctx, effect, sc.sourceActorId, sc.candidateTargetIds);
    if (legality.reject) {
      var tmod = tauntLegalityModifier(legality);
      if (tmod) legMods.taunt = tmod;
      return projectionWithUnsupported(legality.reject, { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (legality.tauntReason) legMods.taunt = tauntLegalityModifier(legality);
    var recipientReason = followUpRecipientReason(proto, legality);
    if (recipientReason) {
      var recipientOut = emptyProjection();
      recipientOut.legalityModifiers = legMods;
      recipientOut.opportunityModifiers = oppMods;
      recipientOut.deferCode = 'DEFER_MECHANICS_PROJECTION';
      recipientOut.unsupportedOutcomeKinds = [recipientReason];
      return recipientOut;
    }
    var targetIds = effect['目标'] === '自身'
      ? [sc.sourceActorId]
      : (Array.isArray(sc.candidateTargetIds) ? sc.candidateTargetIds.slice() : []);
    var rowCtx = {
      sourceActionId: sc.sourceActionId,
      sourceActorId: sc.sourceActorId,
      sourceEffectId: sc.sourceEffectId,
      targetIds: targetIds
    };
    var out = emptyProjection();
    var rows = [];
    if (proto === '资源转移') {
      var resources = normalizeNameList(effect['资源']);
      var rd = numericDualOf(effect['数值'], '数值');
      if (rd.error || rd.pending) return projectionWithUnsupported(rd.error || 'PENDING_DIRECTION_PROJECTION', { legalityModifiers: legMods, opportunityModifiers: oppMods });
      for (var ri = 0; ri < resources.length; ri += 1) {
        rows.push(makeRow(rowCtx, 'RESOURCE_TRANSFER', resources[ri], rd.amount, rd.unit, 0));
      }
    } else if (proto === '炸环') {
      var rb = numericDualOf(effect['强化倍率'], '强化倍率');
      if (rb.error || rb.pending) return projectionWithUnsupported(rb.error || 'PENDING_DIRECTION_PROJECTION', { legalityModifiers: legMods, opportunityModifiers: oppMods });
      rows.push(makeRow(rowCtx, 'STATE_DELTA', '炸环', rb.amount, rb.unit === 'PERCENT' ? 'PERCENT' : 'RATIO', 0));
    } else if (proto === '状态移除') {
      rows.push(makeRow(rowCtx, 'STATE_DELTA', String(effect['状态']).trim(), -Math.abs(Number(effect['数量'])), 'COUNT', 0));
      legMods.tauntRemoved = { state: String(effect['状态']).trim() };
    } else if (proto === '规则防御') {
      rows.push(makeRow(rowCtx, 'RULE_DEFENSE_COUNTER', String(effect['规则']).trim(), Number(effect['次数']), 'COUNT', 0));
    } else if (proto === '位移执行') {
      rows.push(makeRow(rowCtx, 'POSITION_DELTA', String(effect['位移类型']).trim(), Number(effect['距离']), 'DISTANCE', 0));
    } else if (proto === '时窗修正') {
      var sched = [];
      var schedIdx = 0;
      if (hasOwn(effect, '调整回合') || hasOwn(effect, '调整tick') || hasOwn(effect, '调整次数')) {
        var win = {
          entryId: String(rowCtx.sourceEffectId) + ':schedule:' + schedIdx,
          operation: 'WINDOW_ADJUST',
          调整字段: String(effect['调整字段']).trim(),
          调整方式: String(effect['调整方式']).trim()
        };
        if (hasOwn(effect, '调整回合')) win['调整回合'] = Number(effect['调整回合']);
        if (hasOwn(effect, '调整tick')) win['调整tick'] = Number(effect['调整tick']);
        if (hasOwn(effect, '调整次数')) win['调整次数'] = Number(effect['调整次数']);
        sched.push(win);
        schedIdx += 1;
      }
      if (hasOwn(effect, '结算倍率')) {
        sched.push({ entryId: String(rowCtx.sourceEffectId) + ':schedule:' + schedIdx, operation: 'SETTLEMENT_RATIO_ADJUST', 结算倍率: Number(effect['结算倍率']) });
      }
      out.scheduledFacts = sched;
      out.legalityModifiers = legMods;
      out.opportunityModifiers = oppMods;
      return out;
    } else if (proto === '机制授予') {
      var payload = [];
      var trigger = String(effect['触发条件']).trim();
      var grantRowCtx = {
        sourceActionId: rowCtx.sourceActionId,
        sourceActorId: rowCtx.sourceActorId,
        sourceEffectId: rowCtx.sourceEffectId,
        targetIds: legality.targetIds.slice()
      };
      var payloadOk = true;
      for (var gi = 0; gi < effect['授予效果'].length; gi += 1) {
        var pr = grantPayloadRows(effect['授予效果'][gi], grantRowCtx);
        if (pr.error) { payloadOk = false; break; }
        for (var pri = 0; pri < pr.rows.length; pri += 1) payload.push(pr.rows[pri]);
      }
      if (!payloadOk) {
        var gOut = emptyProjection();
        gOut.legalityModifiers = legMods;
        gOut.opportunityModifiers = oppMods;
        gOut.deferCode = 'DEFER_MECHANICS_PROJECTION';
        gOut.unsupportedOutcomeKinds = [PENDING_KIND];
        return gOut;
      }
      var follow = {
        entryId: String(rowCtx.sourceEffectId) + ':schedule:0',
        grantType: 'FOLLOW_UP',
        triggerKey: trigger,
        ownerId: legality.targetIds[0],
        followUpKey: effect['跟进行动键'],
        payloadDirectFacts: payload
      };
      if (trigger === '主动触发') follow.maxActions = Number(effect['可用次数']);
      out.scheduledFacts = [follow];
    } else if (proto === '决策干扰') {
      oppMods.interferenceRates = [{ 干扰: String(effect['干扰']).trim(), 数值: String(effect['数值']) }];
      if (ctx && typeof ctx.interferenceRevision === 'string' && ctx.interferenceRevision.length > 0) {
        oppMods.dependencyTokens = ['interference:' + String(effect['干扰']).trim() + ':' + String(effect['数值'])];
      }
    } else if (proto === '资源锁定') {
      oppMods.resourceLocks = [{ 资源: String(effect['资源']).trim(), 锁定类型: String(effect['锁定类型']).trim() }];
    } else if (proto === '规则改写') {
      oppMods.opportunityConstraints = { basicAttackAllowed: false };
    } else if (proto === '状态转移') {
      legMods.stateMigration = { state: String(effect['状态']).trim(), from: String(effect['来源']).trim(), to: String(effect['去向']).trim() };
    } else if (proto === '状态交换') {
      legMods.stateSwap = { state: String(effect['状态']).trim() };
    } else if (proto === '机制抹消') {
      legMods.mechanismRemoval = [cloneDeep(effect['抹消对象'])];
    }
    for (var i = 0; i < rows.length; i += 1) {
      var verr = validateDirectFactRow(rows[i]);
      if (verr) return projectionWithUnsupported('INTERNAL_ROW_VALIDATION_FAILED:' + verr, { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (!checkRowUniqueness(rows)) return projectionWithUnsupported('INTERNAL_ROW_UNIQUENESS_FAILED', { legalityModifiers: legMods, opportunityModifiers: oppMods });
    out.directFacts = rows;
    out.legalityModifiers = legMods;
    out.opportunityModifiers = oppMods;
    return out;
  }

  // ---- legality helpers: current public state only, before candidate freeze ----
  function tauntersFrom(ctx) {
    if (!ctx || !isPlainObject(ctx.publicStates)) return [];
    var out = [];
    var states = ctx.publicStates;
    for (var id in states) {
      if (!hasOwn(states, id)) continue;
      var st = states[id];
      if (isPlainObject(st) && st[TAUNT_STATE] === true) out.push(String(id));
    }
    return out.sort(utf16Compare);
  }
  function cloneTargetAllowed(proto) {
    return CLONE_TARGET_ALLOWED.indexOf(proto) >= 0;
  }
  function resolveLegality(ctx, effect, sourceActorId, candidateTargetIds) {
    var result = { taunters: [], legalTargetIds: null, targetIds: null, reject: null, tauntReason: false };
    var tgt = effect ? effect['目标'] : null;
    if (tgt === '自身') {
      result.targetIds = [sourceActorId];
      return result;
    }
    var taunters = tauntersFrom(ctx);
    if (taunters.length > 0) {
      result.taunters = taunters;
      result.legalTargetIds = taunters.slice();
      if (tgt === '单体' && taunters.length > 1) {
        result.reject = 'AMBIGUOUS_TAUNT_TARGET';
        return result;
      }
      if (ctx.playerLockedTargetId !== undefined && ctx.playerLockedTargetId !== null) {
        var locked = String(ctx.playerLockedTargetId);
        if (taunters.indexOf(locked) < 0) {
          result.reject = 'PLAYER_LOCKED_TAUNT_LEGALITY';
          return result;
        }
      }
      result.targetIds = taunters.slice();
      result.tauntReason = true;
      return result;
    }
    if (tgt === '单体' || tgt === '群体' || tgt === '全场' || tgt === '召唤物' || tgt === '目标' ||
        (tgt === '分身' && cloneTargetAllowed(effect ? effect['原型'] : null))) {
      result.targetIds = candidateTargetIds.slice();
      return result;
    }
    result.reject = 'INVALID_OPTION_VALUE';
    return result;
  }
  function tauntLegalityModifier(legality) {
    if (legality.taunters.length === 0) return null;
    if (legality.taunters.length === 1) return { state: TAUNT_STATE, target: legality.taunters[0] };
    return { state: TAUNT_STATE, targetIds: legality.taunters.slice() };
  }

  function sourceContextOf(ctx) {
    return {
      sourceActionId: ctx && ctx.sourceActionId,
      sourceActorId: ctx && ctx.sourceActorId,
      sourceEffectId: ctx && ctx.sourceEffectId,
      candidateTargetIds: ctx && ctx.candidateTargetIds
    };
  }
  function contextError(ctx) {
    var c = sourceContextOf(ctx);
    if (c.sourceActionId === undefined || c.sourceActionId === null || String(c.sourceActionId).length === 0) return 'MISSING_SOURCE_CONTEXT';
    if (c.sourceActorId === undefined || c.sourceActorId === null || String(c.sourceActorId).length === 0) return 'MISSING_SOURCE_CONTEXT';
    if (c.sourceEffectId === undefined || c.sourceEffectId === null || String(c.sourceEffectId).length === 0) return 'MISSING_SOURCE_CONTEXT';
    if (!Array.isArray(c.candidateTargetIds) || c.candidateTargetIds.length === 0) return 'MISSING_TARGET_CONTEXT';
    return null;
  }
  // Entry id gate shared by admit and project: every source context id and every
  // candidate target id must be a non-empty string within 1..512, free of C0 control
  // characters and DEL, and not a symbolic placeholder. Rejecting here (INVALID_OPTION_VALUE
  // with details.field) keeps row-level INTERNAL_ROW_VALIDATION_FAILED unreachable.
  function validateContextIds(ctx) {
    var c = sourceContextOf(ctx);
    var pairs = [
      ['sourceActionId', c.sourceActionId],
      ['sourceActorId', c.sourceActorId],
      ['sourceEffectId', c.sourceEffectId]
    ];
    for (var pi = 0; pi < pairs.length; pi += 1) {
      var val = pairs[pi][1];
      if (typeof val !== 'string' || val.length === 0 || val.length > ID_MAX_LENGTH || !ID_PATTERN.test(val)) {
        return { field: pairs[pi][0], code: 'INVALID_OPTION_VALUE' };
      }
    }
    var tgts = c.candidateTargetIds;
    if (Array.isArray(tgts)) {
      for (var ti = 0; ti < tgts.length; ti += 1) {
        var tv = tgts[ti];
        if (typeof tv !== 'string' || tv.length === 0 || tv.length > ID_MAX_LENGTH || !ID_PATTERN.test(tv) || SYMBOLIC_TARGETS.indexOf(tv) >= 0) {
          return { field: 'candidateTargetIds[' + ti + ']', code: 'INVALID_OPTION_VALUE' };
        }
      }
    }
    return null;
  }

  // ---- path id parsing / classification ----
  function parsePathId(pathId) {
    if (typeof pathId !== 'string' || pathId.length === 0) return null;
    var parts = pathId.split(':');
    if (parts.length !== 5) return null;
    if (parts[0] !== 'PPU1') return null;
    if (parts[1] !== 'IN_BATTLE' && parts[1] !== 'OUT_OF_BATTLE') return null;
    var idx = Number(parts[4]);
    if (!Number.isInteger(idx) || idx < 0 || String(idx) !== parts[4]) return null;
    return { scope: parts[1], prototype: parts[2], field: parts[3], index: idx, pathId: pathId };
  }
  function isOutOfBattlePrototype(proto) {
    var e = CONTRACT_ENTRY[proto];
    return !!e && e.status === 'OUT_OF_BATTLE_SCOPE';
  }
  function inBattlePathCount(proto) {
    var counts = OPTION_COUNTS[proto];
    if (!counts) return 0;
    var total = 0;
    for (var f in counts) if (hasOwn(counts, f)) total += counts[f];
    return total;
  }
  function classifyParsed(parsed, liftMap, projectionMap) {
    var proto = parsed.prototype;
    if (hasOwn(FORMAL_OOB_PROTOTYPES, proto)) {
      var formalCounts = FORMAL_OOB_PATH_COUNTS[proto] || {};
      if (!hasOwn(formalCounts, parsed.field) || parsed.index >= formalCounts[parsed.field]) {
        return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'UNKNOWN_PATH_ID', tier: 'NONE', deferCode: '', reasonCode: 'UNKNOWN_PATH_ID' };
      }
      if (parsed.scope === 'IN_BATTLE') {
        return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'UNKNOWN_PATH_ID', tier: 'NONE', deferCode: '', reasonCode: 'UNKNOWN_PATH_ID' };
      }
      return { status: 'OUT_OF_BATTLE_SCOPE', contractStatus: 'OUT_OF_BATTLE_SCOPE', implementationStatus: 'REGISTERED_NOT_CONSUMED', tier: 'NONE', deferCode: '', reasonCode: 'FORMAL_OOB_REGISTERED_NOT_CONSUMED', auditCategory: FORMAL_OOB_PROTOTYPES[proto].auditCategory };
    }
    if (!hasOwn(CONTRACT_ENTRY, proto)) {
      return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'UNKNOWN_PROTOTYPE_REJECTED', tier: 'NONE', deferCode: '', reasonCode: 'UNKNOWN_PROTOTYPE_REJECTED' };
    }
    var counts = OPTION_COUNTS[proto];
    if (!counts || !hasOwn(counts, parsed.field) || parsed.index >= counts[parsed.field]) {
      return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'UNKNOWN_PATH_ID', tier: 'NONE', deferCode: '', reasonCode: 'UNKNOWN_PATH_ID' };
    }
    if (parsed.scope === 'IN_BATTLE' && isOutOfBattlePrototype(proto)) {
      return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'UNKNOWN_PATH_ID', tier: 'NONE', deferCode: '', reasonCode: 'UNKNOWN_PATH_ID' };
    }
    if (parsed.scope === 'OUT_OF_BATTLE' && !isOutOfBattlePrototype(proto)) {
      return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'UNKNOWN_PATH_ID', tier: 'NONE', deferCode: '', reasonCode: 'UNKNOWN_PATH_ID' };
    }
    var entry = CONTRACT_ENTRY[proto];
    if (parsed.scope === 'OUT_OF_BATTLE') {
      return { status: 'OUT_OF_BATTLE_SCOPE', contractStatus: 'OUT_OF_BATTLE_SCOPE', implementationStatus: 'OUT_OF_BATTLE_SCOPE', tier: 'NONE', deferCode: '', reasonCode: '' };
    }
    if (deferredSet[parsed.pathId]) {
      var lift = liftMap.get(parsed.pathId);
      if (lift === LIFT_SENTINEL) {
        return { status: 'SUPPORTED', contractStatus: 'SUPPORTED', implementationStatus: 'LIFTED_WITH_PROJECTION', tier: entry.tier, deferCode: '', reasonCode: '' };
      }
      var code = typeof lift === 'string' && ALLOWED_DEFER_CODES.indexOf(lift) >= 0 ? lift : entry.defaultDeferCode;
      return { status: 'DEFERRED_EXPLICIT', contractStatus: 'DEFERRED_EXPLICIT', implementationStatus: 'DEFERRED_EXPLICIT', tier: entry.tier, deferCode: code, reasonCode: '' };
    }
    var impl = (BATCH1.indexOf(proto) >= 0 || BATCH2.indexOf(proto) >= 0 || PENDING13.indexOf(proto) >= 0)
      ? 'DIRECT_PROJECTION' : 'PENDING_DIRECT_PROJECTION';
    return { status: 'SUPPORTED', contractStatus: 'SUPPORTED', implementationStatus: impl, tier: entry.tier, deferCode: '', reasonCode: '' };
  }
  // ---- batch-1 strict admit ----
  function validateBatch1(effect, spec) {
    if (!isPlainObject(effect)) return 'INVALID_EFFECT';
    if (effect['原型'] !== spec.protoName) return 'PROTOTYPE_MISMATCH';
    for (var f in effect) {
      if (!hasOwn(effect, f)) continue;
      if (spec.allowed.indexOf(f) < 0) return 'INVALID_OPTION_VALUE';
    }
    for (var rq = 0; rq < spec.required.length; rq += 1) {
      if (!hasOwn(effect, spec.required[rq])) return 'MISSING_REQUIRED_FIELD';
    }
    for (var en in spec.enums) {
      if (!hasOwn(spec.enums, en)) continue;
      if (!hasOwn(effect, en)) continue;
      if (Array.isArray(effect[en])) continue;
      if (spec.enums[en].indexOf(effect[en]) < 0) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '威力倍率')) {
      var p = effect['威力倍率'];
      if (typeof p !== 'number' || !Number.isFinite(p)) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '攻击段数')) {
      var sg = effect['攻击段数'];
      if (typeof sg !== 'number' || !Number.isInteger(sg) || sg <= 0) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '防御穿透')) {
      var pen = effect['防御穿透'];
      var penOk = typeof pen === 'number' && Number.isFinite(pen);
      if (!penOk && typeof pen === 'string' && /^[+-]?(\d+(\.\d+)?|\.\d+)%$/.test(pen.replace(/\s+/g, ''))) penOk = true;
      if (!penOk) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '持续回合')) {
      var dur = effect['持续回合'];
      if (dur !== '变身期间' && (typeof dur !== 'number' || !Number.isInteger(dur) || dur < 0)) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '条件分支') && (!Array.isArray(effect['条件分支']) || effect['条件分支'].length === 0)) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '触发限制') && !isPlainObject(effect['触发限制'])) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '对应等级') && (typeof effect['对应等级'] !== 'number' || !Number.isFinite(effect['对应等级']))) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '数值')) {
      var nd = numericDualOf(effect['数值'], '数值');
      if (nd.error) return nd.error;
    }
    return null;
  }

  function makeRow(ctx, factType, key, amount, unit, durationTurns) {
    return {
      schemaVersion: 'DirectFactRowV1',
      factType: factType,
      key: key,
      sourceActionId: String(ctx.sourceActionId),
      sourceActorId: String(ctx.sourceActorId),
      sourceEffectId: String(ctx.sourceEffectId),
      targetIds: ctx.targetIds.slice(),
      amount: normZero(amount),
      unit: unit,
      durationTurns: durationTurns
    };
  }

  function projectBatch1(effect, spec, ctx) {
    var rows = [];
    var legalityModifiers = {};
    var opportunityModifiers = {};
    var proto = spec.protoName;
    var dur = typeof effect['持续回合'] === 'number' ? effect['持续回合'] : 0;
    if (proto === '伤害结算') {
      var power = effect['威力倍率'];
      var hasSegments = hasOwn(effect, '攻击段数');
      var hasPenetration = hasOwn(effect, '防御穿透');
      var penRow = null;
      if (hasPenetration) {
        var pd = numericDualOf(effect['防御穿透'], '防御穿透');
        if (pd.error) return { error: pd.error, rows: rows };
        penRow = { amount: pd.amount, unit: pd.unit };
      }
      if (!hasSegments && !hasPenetration) {
        rows.push(makeRow(ctx, 'HP_DELTA', '', power, 'POWER', 0));
      } else {
        rows.push(makeRow(ctx, 'HP_DELTA', 'damage.power', power, 'POWER', 0));
        if (hasSegments) rows.push(makeRow(ctx, 'HP_DELTA', 'damage.segments', effect['攻击段数'], 'COUNT', 0));
        if (penRow) rows.push(makeRow(ctx, 'HP_DELTA', 'damage.penetration', penRow.amount, penRow.unit, 0));
        rows.push(makeRow(ctx, 'HP_DELTA', 'damage.type', 1, 'BOOL', 0));
      }
    } else if (proto === '资源变化') {
      var resources = normalizeNameList(effect['资源']);
      var rd = numericDualOf(effect['数值'], '数值');
      if (rd.error) return { error: rd.error, rows: rows };
      for (var ri = 0; ri < resources.length; ri += 1) {
        rows.push(makeRow(ctx, 'RESOURCE_OPTION_CHANGED', resources[ri], rd.amount, rd.unit, dur));
      }
    } else if (proto === '护盾变化') {
      var sd = numericDualOf(effect['数值'], '数值');
      if (sd.error) return { error: sd.error, rows: rows };
      rows.push(makeRow(ctx, 'SHIELD_DELTA', String(effect['护盾模式']), sd.amount, sd.unit, dur));
    } else if (proto === '属性修正') {
      var attrs = normalizeNameList(effect['属性']);
      var ad = numericDualOf(effect['数值'], '数值');
      if (ad.error) return { error: ad.error, rows: rows };
      for (var ai = 0; ai < attrs.length; ai += 1) {
        rows.push(makeRow(ctx, 'STATE_DELTA', attrs[ai], ad.amount, ad.unit, dur));
      }
    } else if (proto === '判定修正') {
      var jd = numericDualOf(effect['数值'], '数值');
      if (jd.error) return { error: jd.error, rows: rows };
      rows.push(makeRow(ctx, 'STATE_DELTA', String(effect['判定']), jd.amount, jd.unit, dur));
      legalityModifiers.judgmentRates = [{ 判定: String(effect['判定']), 数值: String(effect['数值']) }];
    }
    for (var i = 0; i < rows.length; i += 1) {
      var verr = validateDirectFactRow(rows[i]);
      if (verr) return { error: 'INTERNAL_ROW_VALIDATION_FAILED:' + verr, rows: rows };
    }
    if (!checkRowUniqueness(rows)) return { error: 'INTERNAL_ROW_UNIQUENESS_FAILED', rows: rows };
    return { error: null, rows: rows, legalityModifiers: legalityModifiers, opportunityModifiers: opportunityModifiers };
  }

  // ---- batch-2 strict admit (状态施加/召唤生成/结算修正) ----
  function validateBatch2(effect, spec) {
    if (!isPlainObject(effect)) return 'INVALID_EFFECT';
    if (effect['原型'] !== spec.protoName) return 'PROTOTYPE_MISMATCH';
    for (var f in effect) {
      if (!hasOwn(effect, f)) continue;
      if (spec.allowed.indexOf(f) < 0) return 'INVALID_OPTION_VALUE';
    }
    for (var rq = 0; rq < spec.required.length; rq += 1) {
      if (!hasOwn(effect, spec.required[rq])) return 'MISSING_REQUIRED_FIELD';
    }
    for (var en in spec.enums) {
      if (!hasOwn(spec.enums, en)) continue;
      if (!hasOwn(effect, en)) continue;
      if (Array.isArray(effect[en])) {
        var arr = effect[en];
        if (arr.length === 0) return 'INVALID_OPTION_VALUE';
        for (var ai = 0; ai < arr.length; ai += 1) {
          if (spec.enums[en].indexOf(arr[ai]) < 0) return 'INVALID_OPTION_VALUE';
        }
        continue;
      }
      if (spec.enums[en].indexOf(effect[en]) < 0) return 'INVALID_OPTION_VALUE';
    }
    if (spec.protoName === '状态施加') {
      var st = String(effect['状态']).trim();
      if (!st) return 'MISSING_REQUIRED_FIELD';
      if (STATE_APPLY_OPTIONS.indexOf(st) < 0) return 'UNKNOWN_STATE';
      if (hasOwn(effect, '副数值') && !hasOwn(effect, '数值')) return 'INVALID_OPTION_VALUE';
      if (hasOwn(effect, '数值')) {
        var v1 = parseStatePercent(effect['数值']);
        if (v1.error) return v1.error;
      }
      if (hasOwn(effect, '副数值')) {
        var v2 = parseStatePercent(effect['副数值']);
        if (v2.error) return v2.error;
      }
    }
    if (spec.protoName === '结算修正') {
      var sv = parseStatePercent(effect['数值']);
      if (sv.error) return sv.error;
    }
    if (spec.protoName === '召唤生成') {
      if (hasOwn(effect, '数量')) {
        var cnt = effect['数量'];
        if (typeof cnt !== 'number' || !Number.isInteger(cnt) || cnt <= 0) return 'INVALID_OPTION_VALUE';
      }
      if (hasOwn(effect, '强度')) {
        var strv = effect['强度'];
        if (typeof strv !== 'number' || !Number.isFinite(strv)) return 'INVALID_OPTION_VALUE';
      }
      if (hasOwn(effect, '继承属性比例')) {
        var inh = effect['继承属性比例'];
        if (typeof inh !== 'number' || !Number.isFinite(inh)) return 'INVALID_OPTION_VALUE';
      }
      if (hasOwn(effect, '召唤单位类型') && (typeof effect['召唤单位类型'] !== 'string' || !String(effect['召唤单位类型']).trim())) return 'INVALID_OPTION_VALUE';
      if (hasOwn(effect, '召唤物名称') && (typeof effect['召唤物名称'] !== 'string' || !String(effect['召唤物名称']).trim())) return 'INVALID_OPTION_VALUE';
      if (hasOwn(effect, '行动模式') && (typeof effect['行动模式'] !== 'string' || !String(effect['行动模式']).trim())) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '持续回合')) {
      var dur = effect['持续回合'];
      if (dur !== '变身期间' && (typeof dur !== 'number' || !Number.isInteger(dur) || dur < 0)) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '条件分支') && (!Array.isArray(effect['条件分支']) || effect['条件分支'].length === 0)) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '触发限制') && !isPlainObject(effect['触发限制'])) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '对应等级') && (typeof effect['对应等级'] !== 'number' || !Number.isFinite(effect['对应等级']))) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '驱动属性') && (typeof effect['驱动属性'] !== 'string' || !String(effect['驱动属性']).trim())) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '影响方向') && (typeof effect['影响方向'] !== 'string' || !String(effect['影响方向']).trim())) return 'INVALID_OPTION_VALUE';
    if (hasOwn(effect, '限定元素')) {
      var el = effect['限定元素'];
      if (typeof el === 'string') {
        if (!el.trim()) return 'INVALID_OPTION_VALUE';
      } else if (Array.isArray(el)) {
        for (var ei = 0; ei < el.length; ei += 1) {
          if (typeof el[ei] !== 'string' || !String(el[ei]).trim()) return 'INVALID_OPTION_VALUE';
        }
      } else {
        return 'INVALID_OPTION_VALUE';
      }
    }
    return null;
  }

  // ---- batch-2 row projection (rows + scheduled window + audit families) ----
  function projectBatch2Rows(effect, proto, rowCtx) {
    var rows = [];
    var scheduledFacts = [];
    var legalityModifiers = {};
    var opportunityModifiers = {};
    var dur = typeof effect['持续回合'] === 'number' ? effect['持续回合'] : 0;
    if (proto === '状态施加') {
      var stateName = String(effect['状态']).trim();
      if (hasOwn(effect, '数值')) {
        var v = parseStatePercent(effect['数值']);
        if (v.error) return { error: v.error, rows: rows };
        rows.push(makeRow(rowCtx, 'STATE_DELTA', 'state.primary', v.amount, 'PERCENT', dur));
      }
      if (hasOwn(effect, '副数值')) {
        var v2 = parseStatePercent(effect['副数值']);
        if (v2.error) return { error: v2.error, rows: rows };
        rows.push(makeRow(rowCtx, 'STATE_DELTA', 'state.secondary', v2.amount, 'PERCENT', dur));
      }
      if (!hasOwn(effect, '数值')) {
        rows.push(makeRow(rowCtx, 'STATE_DELTA', stateName, 1, 'BOOL', dur));
      }
    } else if (proto === '召唤生成') {
      if (hasOwn(effect, '数量')) {
        rows.push(makeRow(rowCtx, 'SUMMON_WINDOW', 'summon.count', effect['数量'], 'COUNT', 0));
      }
      if (hasOwn(effect, '强度')) {
        rows.push(makeRow(rowCtx, 'SUMMON_WINDOW', 'summon.strength', effect['强度'], 'RATIO', 0));
      }
      if (hasOwn(effect, '继承属性比例')) {
        rows.push(makeRow(rowCtx, 'SUMMON_WINDOW', 'summon.inheritRatio', effect['继承属性比例'], 'RATIO', 0));
      }
      if (typeof effect['持续回合'] === 'number') {
        rows.push(makeRow(rowCtx, 'SUMMON_WINDOW', 'summon.duration', effect['持续回合'], 'TURNS', 0));
      }
      var win = {
        grantType: 'SUMMON_WINDOW',
        召唤单位类型: String(effect['召唤单位类型']).trim(),
        召唤物名称: String(effect['召唤物名称']).trim()
      };
      if (hasOwn(effect, '行动模式') && String(effect['行动模式']).trim()) win['行动模式'] = String(effect['行动模式']).trim();
      if (typeof effect['持续回合'] === 'number') win.durationTurns = effect['持续回合'];
      win.entryId = String(rowCtx.sourceEffectId) + ':schedule:' + scheduledFacts.length;
      scheduledFacts.push(win);
    } else if (proto === '结算修正') {
      var sv = parseStatePercent(effect['数值']);
      if (sv.error) return { error: sv.error, rows: rows };
      rows.push(makeRow(rowCtx, 'STATE_DELTA', 'settlement.primary', sv.amount, 'PERCENT', dur));
    }
    for (var i = 0; i < rows.length; i += 1) {
      var verr = validateDirectFactRow(rows[i]);
      if (verr) return { error: 'INTERNAL_ROW_VALIDATION_FAILED:' + verr, rows: rows };
    }
    if (!checkRowUniqueness(rows)) return { error: 'INTERNAL_ROW_UNIQUENESS_FAILED', rows: rows };
    return { error: null, rows: rows, scheduledFacts: scheduledFacts, legalityModifiers: legalityModifiers, opportunityModifiers: opportunityModifiers };
  }

  // ---- runtime state ----
  var metrics = {
    admitCalls: 0,
    projectCalls: 0,
    classifyPathCalls: 0,
    rejectCount: 0,
    deferProjectCount: 0,
    pendingProjectCount: 0,
    directProjectionCount: 0,
    liftedProjectCalls: 0,
    tauntRejectCount: 0,
    playerLockedRejectCount: 0,
    unknownPrototypeRejectCount: 0,
    outOfBattleRejectCount: 0,
    lingwuRejectCount: 0,
    carrierRejectCount: 0,
    mechanical16RejectCount: 0,
    contextInvalidRejectCount: 0,
    payloadDeferCount: 0,
    liftOverrideCount: 0,
    projectionOverrideCount: 0,
    clearOverrideCount: 0,
    lastSelfCheckPassed: false
  };
  var LIFT_MAP = new Map();
  var PROJECTION_MAP = new Map();

  function deferUnsupportedKind(proto) {
    return [DEFERRED_PROTOS[proto]];
  }
  function effectiveDeferCodeForPath(pathId) {
    var lift = LIFT_MAP.get(pathId);
    if (typeof lift === 'string' && ALLOWED_DEFER_CODES.indexOf(lift) >= 0) return lift;
    var d = deferredByPathId[pathId];
    return d ? d.deferCode : 'DEFER_MECHANICS_PROJECTION';
  }
  function fieldOptionIndex(proto, field, value) {
    if (!hasOwn(OPTION_COUNTS, proto) || !hasOwn(OPTION_COUNTS[proto], field)) return -1;
    var def = BATCH1_SPEC[proto];
    var list = def && def.enums && def.enums[field] ? def.enums[field] : [];
    if (!list.length && DEFERRED_OPTION_VALUES[proto]) {
      list = DEFERRED_OPTION_VALUES[proto][field] || [];
    }
    if (!list.length) return -1;
    var idx = list.indexOf(value);
    if (idx < 0 || idx >= OPTION_COUNTS[proto][field]) return -1;
    return idx;
  }
  function spannedPathIds(effect) {
    var proto = effect && effect['原型'];
    var counts = OPTION_COUNTS[proto];
    if (!counts) return [];
    var out = [];
    for (var field in counts) {
      if (!hasOwn(counts, field)) continue;
      if (!hasOwn(effect, field)) continue;
      var value = effect[field];
      if (typeof value !== 'string') continue;
      var index = fieldOptionIndex(proto, field, value);
      if (index >= 0) out.push('PPU1:IN_BATTLE:' + proto + ':' + field + ':' + index);
    }
    return out;
  }

  function interferenceOf(effect, ctx) {
    if (!effect || String(effect['干扰'] || '').trim() !== '索敌干扰') return null;
    var out = {
      interferenceRates: [{ 干扰: String(effect['干扰']), 数值: String(effect['数值']) }],
      dependencyTokens: []
    };
    if (ctx && typeof ctx.interferenceRevision === 'string' && ctx.interferenceRevision.length > 0) {
      out.dependencyTokens.push('interference:' + effect['干扰'] + ':' + effect['数值']);
    }
    return out;
  }

  function projectionWithUnsupported(reason, extra) {
    var out = emptyProjection();
    out.unsupportedOutcomeKinds = [reason];
    if (extra) {
      if (extra.legalityModifiers) out.legalityModifiers = extra.legalityModifiers;
      if (extra.opportunityModifiers) out.opportunityModifiers = extra.opportunityModifiers;
    }
    return out;
  }

  function runProject(effect, ctx, pathId, liftMap, projectionMap) {
    metrics.projectCalls += 1;
    var legMods = {};
    var oppMods = {};

    if (pathId !== undefined && pathId !== null) {
      var parsed = parsePathId(pathId);
      if (!parsed) return projectionWithUnsupported('MALFORMED_PATH_ID', null);
      var cls = classifyParsed(parsed, liftMap, projectionMap);
      if (liftMap.get(pathId) === LIFT_SENTINEL && projectionMap.has(pathId)) {
        metrics.liftedProjectCalls += 1;
        return cloneDeep(projectionMap.get(pathId));
      }
      if (cls.contractStatus === 'REJECTED_INPUT') return projectionWithUnsupported(cls.reasonCode, null);
      if (cls.contractStatus === 'OUT_OF_BATTLE_SCOPE') return projectionWithUnsupported('OUT_OF_BATTLE_SCOPE', null);
      if (cls.contractStatus === 'DEFERRED_EXPLICIT') {
        metrics.deferProjectCount += 1;
        var dOut = emptyProjection();
        dOut.deferCode = effectiveDeferCodeForPath(pathId);
        dOut.unsupportedOutcomeKinds = deferUnsupportedKind(parsed.prototype);
        return dOut;
      }
      var protoOfPath = parsed.prototype;
      if (!effect || effect['原型'] !== protoOfPath) return projectionWithUnsupported('PATH_PROTOTYPE_MISMATCH', null);
      var pErr = contextError(ctx);
      if (pErr) return projectionWithUnsupported(pErr, null);
      var pIdErr = validateContextIds(ctx);
      if (pIdErr) {
        metrics.contextInvalidRejectCount += 1;
        return projectionWithUnsupported(pIdErr.code, null);
      }
      return projectDispatched(effect, ctx, legMods, oppMods, liftMap, projectionMap);
    }

    var ctxErr = contextError(ctx);
    if (ctxErr) return projectionWithUnsupported(ctxErr, null);
    var ctxIdErr = validateContextIds(ctx);
    if (ctxIdErr) {
      metrics.contextInvalidRejectCount += 1;
      return projectionWithUnsupported(ctxIdErr.code, null);
    }
    var sc = sourceContextOf(ctx);
    var legality = resolveLegality(ctx, effect, sc.sourceActorId, sc.candidateTargetIds);
    if (legality.reject === 'AMBIGUOUS_TAUNT_TARGET' || legality.reject === 'PLAYER_LOCKED_TAUNT_LEGALITY') {
      var tmod = tauntLegalityModifier(legality);
      if (tmod) legMods.taunt = tmod;
      return projectionWithUnsupported(legality.reject, { legalityModifiers: legMods });
    }
    if (legality.reject) return projectionWithUnsupported(legality.reject, null);
    if (legality.tauntReason) legMods.taunt = tauntLegalityModifier(legality);
    return projectDispatched(effect, ctx, legMods, oppMods, liftMap, projectionMap);
  }

  function projectDispatched(effect, ctx, legMods, oppMods, liftMap, projectionMap) {
    var proto = effect && effect['原型'];
    if (hasOwn(FORMAL_OOB_PROTOTYPES, proto)) {
      var formalProjectionValidation = validateFormalOutOfBattleEffect(effect);
      metrics.outOfBattleRejectCount += 1;
      return projectionWithUnsupported(formalProjectionValidation.valid ? 'REGISTERED_NOT_CONSUMED' : 'INVALID_FORMAL_EFFECT', { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (typeof proto !== 'string' || !hasOwn(CONTRACT_ENTRY, proto)) {
      metrics.unknownPrototypeRejectCount += 1;
      if (proto === LINGWU_PROTO) {
        metrics.lingwuRejectCount += 1;
        return projectionWithUnsupported(FORMAL_OOB_CODE, { legalityModifiers: legMods, opportunityModifiers: oppMods });
      }
      return projectionWithUnsupported('UNKNOWN_PROTOTYPE_REJECTED', { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (CONTRACT_ENTRY[proto].status === 'OUT_OF_BATTLE_SCOPE') {
      metrics.outOfBattleRejectCount += 1;
      return projectionWithUnsupported('OUT_OF_BATTLE_SCOPE', { legalityModifiers: legMods, opportunityModifiers: oppMods });
    }
    if (hasOwn(DEFERRED_PROTOS, proto)) {
      var spanned = spannedPathIds(effect);
      var allLifted = spanned.length > 0 && spanned.every(function (p) { return liftMap.get(p) === LIFT_SENTINEL && projectionMap.has(p); });
      if (allLifted) {
        var lOut = emptyProjection();
        lOut.legalityModifiers = legMods;
        lOut.opportunityModifiers = oppMods;
        lOut.unsupportedOutcomeKinds = ['DEFER_LIFT_PROJECTION_REQUIRED'];
        return lOut;
      }
      metrics.deferProjectCount += 1;
      var dOut2 = emptyProjection();
      dOut2.legalityModifiers = legMods;
      dOut2.opportunityModifiers = oppMods;
      dOut2.deferCode = 'DEFER_MECHANICS_PROJECTION';
      dOut2.unsupportedOutcomeKinds = deferUnsupportedKind(proto);
      return dOut2;
    }
    if (BATCH1.indexOf(proto) >= 0) {
      var spec = BATCH1_SPEC[proto];
      spec.protoName = proto;
      var verr = validateBatch1(effect, spec);
      if (verr) {
        metrics.rejectCount += 1;
        var vOut = emptyProjection();
        vOut.legalityModifiers = legMods;
        vOut.opportunityModifiers = oppMods;
        vOut.unsupportedOutcomeKinds = [verr];
        return vOut;
      }
      var sc2 = sourceContextOf(ctx);
      var legality2 = resolveLegality(ctx, effect, sc2.sourceActorId, sc2.candidateTargetIds);
      if (legality2.reject) {
        var tmod2 = tauntLegalityModifier(legality2);
        if (tmod2) legMods.taunt = tmod2;
        metrics.rejectCount += 1;
        var lOut2 = emptyProjection();
        lOut2.legalityModifiers = legMods;
        lOut2.opportunityModifiers = oppMods;
        lOut2.unsupportedOutcomeKinds = [legality2.reject];
        return lOut2;
      }
      var pendings = pendingCodesOf(effect);
      if (hasOwn(effect, '数值')) {
        var nd = numericDualOf(effect['数值'], '数值');
        if (nd.error) {
          metrics.rejectCount += 1;
          var nOut = emptyProjection();
          nOut.legalityModifiers = legMods;
          nOut.opportunityModifiers = oppMods;
          nOut.unsupportedOutcomeKinds = [nd.error];
          return nOut;
        }
        if (nd.pending) pendings.push(nd.pending);
      }
      var meta = buildMechanicMetadata(effect, proto, ctx);
      if (meta) oppMods.mechanicMetadataEntries = [meta];
      if (pendings.length) {
        metrics.pendingProjectCount += pendings.length;
        var pOut = emptyProjection();
        pOut.legalityModifiers = legMods;
        pOut.opportunityModifiers = mergeMods(oppMods, {});
        pOut.unsupportedOutcomeKinds = pendings;
        return pOut;
      }
      var rowCtx = {
        sourceActionId: sc2.sourceActionId,
        sourceActorId: sc2.sourceActorId,
        sourceEffectId: sc2.sourceEffectId,
        targetIds: legality2.targetIds
      };
      var projected = projectBatch1(effect, spec, rowCtx);
      if (projected.error) {
        metrics.rejectCount += 1;
        var iOut = emptyProjection();
        iOut.legalityModifiers = legMods;
        iOut.opportunityModifiers = oppMods;
        iOut.unsupportedOutcomeKinds = [projected.error];
        return iOut;
      }
      metrics.directProjectionCount += 1;
      var out = emptyProjection();
      out.directFacts = projected.rows;
      out.legalityModifiers = mergeMods(legMods, projected.legalityModifiers);
      out.opportunityModifiers = mergeMods(oppMods, projected.opportunityModifiers);
      return out;
    }
    if (BATCH2.indexOf(proto) >= 0) {
      var b2Spec = BATCH2_SPEC[proto];
      b2Spec.protoName = proto;
      var csum = sourceContextOf(ctx);
      var missingIdentity = !csum.sourceActionId || !csum.sourceActorId || !csum.sourceEffectId ||
        !Array.isArray(csum.candidateTargetIds) || csum.candidateTargetIds.length === 0;
      var missingTypeName = !String(effect['召唤单位类型'] || '').trim() || !String(effect['召唤物名称'] || '').trim();
      if (proto === '召唤生成' && (missingIdentity || missingTypeName)) {
        metrics.carrierRejectCount += 1;
        var cOut2 = emptyProjection();
        cOut2.legalityModifiers = legMods;
        cOut2.opportunityModifiers = oppMods;
        cOut2.unsupportedOutcomeKinds = [CARRIER_CODE];
        return cOut2;
      }
      var b2Err = validateBatch2(effect, b2Spec);
      if (b2Err) {
        metrics.rejectCount += 1;
        var bOut = emptyProjection();
        bOut.legalityModifiers = legMods;
        bOut.opportunityModifiers = oppMods;
        bOut.unsupportedOutcomeKinds = [b2Err];
        return bOut;
      }
      var scB2 = sourceContextOf(ctx);
      var legalityB2 = resolveLegality(ctx, effect, scB2.sourceActorId, scB2.candidateTargetIds);
      if (legalityB2.reject) {
        var tmodB2 = tauntLegalityModifier(legalityB2);
        if (tmodB2) legMods.taunt = tmodB2;
        metrics.rejectCount += 1;
        var lOutB2 = emptyProjection();
        lOutB2.legalityModifiers = legMods;
        lOutB2.opportunityModifiers = oppMods;
        lOutB2.unsupportedOutcomeKinds = [legalityB2.reject];
        return lOutB2;
      }
      if (legalityB2.tauntReason) legMods.taunt = tauntLegalityModifier(legalityB2);
      var b2Pendings = batch2PendingCodes(effect, proto);
      var b2Meta = buildMechanicMetadata(effect, proto, ctx);
      if (b2Meta) oppMods.mechanicMetadataEntries = [b2Meta];
      var partialSummonDuration = proto === '召唤生成' && b2Pendings.length > 0 &&
        b2Pendings.every(function (c) { return c === 'PENDING_DURATION_PROJECTION'; });
      if (b2Pendings.length && !partialSummonDuration) {
        metrics.pendingProjectCount += b2Pendings.length;
        var pOutB2 = emptyProjection();
        pOutB2.legalityModifiers = legMods;
        pOutB2.opportunityModifiers = mergeMods(oppMods, {});
        pOutB2.unsupportedOutcomeKinds = b2Pendings;
        return pOutB2;
      }
      var rowCtxB2 = {
        sourceActionId: scB2.sourceActionId,
        sourceActorId: scB2.sourceActorId,
        sourceEffectId: scB2.sourceEffectId,
        targetIds: legalityB2.targetIds
      };
      var projectedB2 = projectBatch2Rows(effect, proto, rowCtxB2);
      if (projectedB2.error) {
        metrics.rejectCount += 1;
        var iOutB2 = emptyProjection();
        iOutB2.legalityModifiers = legMods;
        iOutB2.opportunityModifiers = oppMods;
        iOutB2.unsupportedOutcomeKinds = [projectedB2.error];
        return iOutB2;
      }
      if (proto === '状态施加' && String(effect['状态']).trim() === TAUNT_STATE && !legMods.taunt) {
        legMods.taunt = { state: TAUNT_STATE, target: 'target' };
      }
      var b2Opp = projectedB2.opportunityModifiers;
      if (projectedB2.rows.length > 0) {
        b2Opp.projectionFamilies = [{ sourceEffectId: String(ctx.sourceEffectId), prototype: proto }];
      }
      if (partialSummonDuration) metrics.pendingProjectCount += b2Pendings.length;
      metrics.directProjectionCount += 1;
      var outB2 = emptyProjection();
      outB2.directFacts = projectedB2.rows;
      outB2.scheduledFacts = projectedB2.scheduledFacts;
      outB2.legalityModifiers = mergeMods(legMods, projectedB2.legalityModifiers);
      outB2.opportunityModifiers = mergeMods(oppMods, b2Opp);
      if (partialSummonDuration) outB2.unsupportedOutcomeKinds = b2Pendings;
      return outB2;
    }
    var p13 = projectPending13(effect, ctx, proto, legMods, oppMods);
    if (p13.unsupportedOutcomeKinds.indexOf(CARRIER_CODE) >= 0) {
      metrics.carrierRejectCount += 1;
    } else if (p13.deferCode) {
      metrics.payloadDeferCount += 1;
    } else if (p13.unsupportedOutcomeKinds.length) {
      if (p13.unsupportedOutcomeKinds[0] === PENDING_KIND) metrics.pendingProjectCount += 1;
      else metrics.rejectCount += 1;
    } else {
      metrics.directProjectionCount += 1;
    }
    return p13;
  }

  function mergeMods(a, b) {
    var out = {};
    var k;
    for (k in a) if (hasOwn(a, k)) out[k] = cloneDeep(a[k]);
    for (k in b) if (hasOwn(b, k)) out[k] = cloneDeep(b[k]);
    return out;
  }

  function runAdmit(effect, ctx) {
    metrics.admitCalls += 1;
    var reasons = [];
    var ctxErr = contextError(ctx);
    if (ctxErr) {
      metrics.rejectCount += 1;
      return { admitted: false, reasons: [ctxErr] };
    }
    var ctxIdErr = validateContextIds(ctx);
    if (ctxIdErr) {
      metrics.rejectCount += 1;
      metrics.contextInvalidRejectCount += 1;
      return { admitted: false, reasons: [ctxIdErr.code], details: { field: ctxIdErr.field } };
    }
    var proto = effect && effect['原型'];
    if (hasOwn(FORMAL_OOB_PROTOTYPES, proto)) {
      var formalValidation = validateFormalOutOfBattleEffect(effect);
      metrics.outOfBattleRejectCount += 1;
      metrics.rejectCount += 1;
      if (!formalValidation.valid) return { admitted: false, reasons: ['INVALID_FORMAL_EFFECT'], formal: true, auditCategory: formalValidation.auditCategory, details: { errors: formalValidation.errors } };
      return { admitted: false, reasons: ['OUT_OF_BATTLE_SCOPE', 'REGISTERED_NOT_CONSUMED'], formal: true, auditCategory: formalValidation.auditCategory, implementationStatus: formalValidation.implementationStatus };
    }
    if (typeof proto !== 'string' || !hasOwn(CONTRACT_ENTRY, proto)) {
      if (proto === LINGWU_PROTO) {
        metrics.lingwuRejectCount += 1;
        metrics.rejectCount += 1;
        return { admitted: false, reasons: [FORMAL_OOB_CODE] };
      }
      metrics.unknownPrototypeRejectCount += 1;
      metrics.rejectCount += 1;
      return { admitted: false, reasons: ['UNKNOWN_PROTOTYPE_REJECTED'] };
    }
    if (CONTRACT_ENTRY[proto].status === 'OUT_OF_BATTLE_SCOPE') {
      metrics.outOfBattleRejectCount += 1;
      metrics.rejectCount += 1;
      return { admitted: false, reasons: ['OUT_OF_BATTLE_SCOPE'] };
    }
    var sc = sourceContextOf(ctx);
    var legality = resolveLegality(ctx, effect, sc.sourceActorId, sc.candidateTargetIds);
    if (legality.reject === 'AMBIGUOUS_TAUNT_TARGET') {
      metrics.tauntRejectCount += 1;
      metrics.rejectCount += 1;
      return { admitted: false, reasons: ['AMBIGUOUS_TAUNT_TARGET'], ambiguousTaunt: true };
    }
    if (legality.reject === 'PLAYER_LOCKED_TAUNT_LEGALITY') {
      metrics.playerLockedRejectCount += 1;
      metrics.rejectCount += 1;
      return { admitted: false, reasons: ['PLAYER_LOCKED_TAUNT_LEGALITY'] };
    }
    if (legality.reject) {
      metrics.rejectCount += 1;
      return { admitted: false, reasons: [legality.reject] };
    }
    if (legality.tauntReason) reasons.push('TAUNT_CONSTRAINS_LEGAL_SET');
    var interference = interferenceOf(effect, ctx);
    if (interference && interference.dependencyTokens.length) reasons.push('INTERFERENCE_ENTER_DEPENDENCY');
    if (hasOwn(DEFERRED_PROTOS, proto)) {
      reasons.push('DEFERRED_CANDIDATE_RETAINED_WITH_REASON');
      reasons.push('PATH_DEFAULT_DEFER_LIFTABLE');
      return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
    }
    if (BATCH1.indexOf(proto) >= 0) {
      var spec = BATCH1_SPEC[proto];
      spec.protoName = proto;
      var verr = validateBatch1(effect, spec);
      if (verr) {
        metrics.rejectCount += 1;
        return { admitted: false, reasons: [verr] };
      }
      var pendings = pendingCodesOf(effect);
      if (hasOwn(effect, '数值')) {
        var nd = numericDualOf(effect['数值'], '数值');
        if (nd.error) {
          metrics.rejectCount += 1;
          return { admitted: false, reasons: [nd.error] };
        }
        if (nd.pending) pendings.push(nd.pending);
      }
      if (pendings.length) {
        for (var pi = 0; pi < pendings.length; pi += 1) reasons.push(pendings[pi]);
        metrics.pendingProjectCount += pendings.length;
        return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
      }
      return { admitted: true, reasons: reasons };
    }
    if (BATCH2.indexOf(proto) >= 0) {
      var b2Spec = BATCH2_SPEC[proto];
      b2Spec.protoName = proto;
      var csum2 = sourceContextOf(ctx);
      var missingIdentity2 = !csum2.sourceActionId || !csum2.sourceActorId || !csum2.sourceEffectId ||
        !Array.isArray(csum2.candidateTargetIds) || csum2.candidateTargetIds.length === 0;
      var missingTypeName2 = !String(effect['召唤单位类型'] || '').trim() || !String(effect['召唤物名称'] || '').trim();
      if (proto === '召唤生成' && (missingIdentity2 || missingTypeName2)) {
        metrics.carrierRejectCount += 1;
        reasons.push(CARRIER_CODE);
        return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
      }
      var b2Err = validateBatch2(effect, b2Spec);
      if (b2Err) {
        metrics.rejectCount += 1;
        return { admitted: false, reasons: [b2Err] };
      }
      var b2Pendings = batch2PendingCodes(effect, proto);
      if (b2Pendings.length) {
        for (var pi2 = 0; pi2 < b2Pendings.length; pi2 += 1) reasons.push(b2Pendings[pi2]);
        metrics.pendingProjectCount += b2Pendings.length;
        return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
      }
      return { admitted: true, reasons: reasons };
    }
    var p13v = validatePending13(effect, proto);
    if (p13v.carrier) {
      metrics.carrierRejectCount += 1;
      reasons.push(CARRIER_CODE);
      return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
    }
    if (p13v.reason) {
      metrics.rejectCount += 1;
      return { admitted: false, reasons: [p13v.reason] };
    }
    var recipientReason = followUpRecipientReason(proto, legality);
    if (recipientReason) {
      metrics.payloadDeferCount += 1;
      reasons.push(recipientReason);
      return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
    }
    if (p13v.payloadDeferCode) {
      metrics.payloadDeferCount += 1;
      reasons.push('PAYLOAD_UNPROJECTABLE_DEFERRED');
      return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
    }
    if (p13v.pendingDirect) {
      reasons.push(PENDING_KIND);
      return { admitted: true, reasons: reasons, retainedInCandidateAudit: true };
    }
    return { admitted: true, reasons: reasons };
  }
  // ---- registry ----
  function buildRegistry() {
    var statusByPrototype = {};
    var tierByPrototype = {};
    var pathCountByPrototype = {};
    var registryEntries = {};
    var supportedByTier = { existingAdmitted: 0, t0: 0, t1: 0 };
    for (var i = 0; i < PROTO_NAMES.length; i += 1) {
      var p = PROTO_NAMES[i];
      var e = CONTRACT_ENTRY[p];
      statusByPrototype[p] = e.status;
      tierByPrototype[p] = e.tier;
      pathCountByPrototype[p] = e.status === 'OUT_OF_BATTLE_SCOPE' ? inBattlePathCount(p) : e.pathCount;
      var entryCopy = {};
      for (var k in e) if (hasOwn(e, k)) entryCopy[k] = e[k];
      registryEntries[p] = entryCopy;
      if (e.status === 'SUPPORTED') {
        if (e.tier === 'EXISTING_ADMITTED') supportedByTier.existingAdmitted += pathCountByPrototype[p];
        else if (e.tier === 'T0') supportedByTier.t0 += pathCountByPrototype[p];
        else if (e.tier === 'T1') supportedByTier.t1 += pathCountByPrototype[p];
      }
    }
    return {
      schemaVersion: 'PrototypeDirectAdapterV1',
      registryId: REGISTRY_ID,
      role: ROLE,
      revision: REVISION,
      encoding: 'UTF-8',
      dispatch: 'PER_EFFECT_PATH_ADMIT_PROJECT',
      enrollment: {
        contractSupportedPathCount: 581,
        contractDeferredPathCount: 40,
        contractOutOfBattlePathCount: 91,
        contractTotalInBattlePathCount: 621,
        statusByPrototype: statusByPrototype,
        tierByPrototype: tierByPrototype,
        pathCountByPrototype: pathCountByPrototype,
        supportedByTier: supportedByTier,
        deferredPathIds: deferredPathIds.slice(),
        deferredPaths: DEFERRED_PATHS
      },
      implementation: {
        implementationDirectProjection: 243,
        implementationPending: 338,
        implementationDeferred: 40,
        implementationOutOfBattleScope: 91,
        placeholderProjectionCount: 0,
        claimsDirectProjectionForAllSupported: false,
        batch1Prototypes: BATCH1.slice(),
        batch1PathCount: 106,
        batch2Prototypes: BATCH2.slice(),
        batch2PathCount: 137,
        batch2PathCounts: { '状态施加': 55, '召唤生成': 19, '结算修正': 63 },
        contractTargetOnly: true,
        implementationTarget: {
          batch2Prototypes: BATCH2.slice(),
          batch2PathCount: 137,
          batch2PathCounts: { '状态施加': 55, '召唤生成': 19, '结算修正': 63 },
          directProjectionPathCount: 243,
          pendingPathCount: 338,
          contractTargetOnly: true
        },
        pendingPrototypes: PENDING13.slice(),
        directFactToProviderColumnMapping: MAPPING_NOT_FROZEN,
        pendingCodes: PENDING_CODES.slice(),
        carrierCode: CARRIER_CODE,
        mechanicMetadataEntries: {
          location: 'opportunityModifiers.mechanicMetadataEntries',
          keys: MECHANIC_METADATA_KEYS.slice(),
          perPrototypeSubsets: cloneDeep(PER_PROTOTYPE_METADATA),
          sourceEffectId: true,
          entryShape: 'closed entries array: one entry per effect instance, each {sourceEffectId, <prototype-allowed Chinese field-name keys>}',
          valuePolicy: 'verbatim normalized deep clones, deep-frozen, never weighted; audit-only, never scored'
        },
        pending13Projection: cloneDeep(PENDING13_SPEC),
        numericForms: {
          '数值': 'signed percent string => PERCENT with sign; unsigned percent => PENDING_DIRECTION_PROJECTION; number => ABS (batch-1); 状态施加/结算修正 数值 is percent-string only (plain numeric strings rejected INVALID_OPTION_VALUE, zero is sign-neutral and projects directly)',
          '防御穿透': 'finite number or percent string; both normalize to PERCENT',
          '持续回合': 'nonnegative integer => TURNS; missing => 0 for batch-1/状态施加/结算修正, no fabrication; 变身期间 => PENDING_DURATION_PROJECTION; 召唤生成 missing or 变身期间 => no summon.duration row + PENDING_DURATION_PROJECTION',
          '数量': '召唤生成 数量 positive integer => COUNT; non-positive or non-integer rejects INVALID_OPTION_VALUE',
          '强度': '召唤生成 强度 finite number => RATIO raw (no clamp)',
          '继承属性比例': '召唤生成 继承属性比例 finite number => RATIO raw; distinct row, never merged into summon.strength'
        }
      },
      formalLibrary: {
        basisSource: 'contract rev4Spec.formalLibraryBasis (A+B union scan pinned in contract/harness; production module does not scan libraries)',
        unionFirstFiveCount: 1916,
        unclassifiedCount: 21,
        unregisteredFormalOobCount: 15,
        formalOobPrototype: LINGWU_PROTO,
        formalOobClassification: FORMAL_OOB_CODE,
        noFormalSamplePrototypes: ['状态转移', '状态交换', '规则改写', '时光回溯'],
        firstBatchPathCount: 106,
        unionCounts: {
          '伤害结算': 1008, '资源变化': 117, '护盾变化': 103, '属性修正': 517, '判定修正': 171,
          '状态施加': 669, '位移执行': 119, '结算修正': 197, '召唤生成': 29, '机制抹消': 9,
          '规则防御': 12, '决策干扰': 10, '状态移除': 24, '时窗修正': 1, '资源转移': 5,
          '机制授予': 2, '修炼增益': 39, '炸环': 1, '永久属性提升': 11, '天赋提升': 7,
          '战斗外复活': 1, '复制执行': 1, '资源锁定': 4
        }
      },
      formalOutOfBattle: {
        classification: 'schema/design/adapter-only',
        implementationStatus: 'REGISTERED_NOT_CONSUMED',
        consumerGate: 'bridge consumer + focused runtime tests required',
        definitions: cloneDeep(FORMAL_OOB_PROTOTYPES),
        pathCountByPrototype: cloneDeep(FORMAL_OOB_PATH_COUNTS)
      },
      counts: {
        totalInBattlePathCount: 621,
        supportedPathCount: 581,
        deferredPathCount: 40,
        deferredPathIdsCount: 40,
        rejectedInputPathCount: 0,
        outOfBattleScopePathCount: 91,
        silentOmissionCount: 0
      },
      supportedByTier: supportedByTier,
      deferredPathIds: deferredPathIds.slice(),
      statusByPrototype: statusByPrototype,
      tierByPrototype: tierByPrototype,
      pathCountByPrototype: pathCountByPrototype,
      registry: registryEntries,
      legalityContext: {
        source: 'CURRENT_PUBLIC_STATE_ONLY',
        allowed: ['visibleHpRatios', 'publicStates', 'observableDeclarations', 'revealedAbilityIds', 'observableResults'],
        forbidden: ['hiddenExactHp', 'hiddenResistance', 'hiddenInventory', 'hiddenAbility', 'unobservedPosterior', 'worldClone', 'futureRouteEnumeration', 'resultEnumeration'],
        timing: 'BEFORE_CANDIDATE_FREEZE',
        playerLocked: 'SAME_GATE'
      },
      allowedDeferCodes: ALLOWED_DEFER_CODES.slice(),
      sourceAndTargetContext: {
        required: ['sourceActionId', 'sourceActorId', 'sourceEffectId', 'candidateTargetIds'],
        missingAction: 'REJECTED_INPUT_WITH_REASON',
        reasonCodes: { missingSource: 'MISSING_SOURCE_CONTEXT', missingTarget: 'MISSING_TARGET_CONTEXT' },
        targetResolution: { self: 'RESOLVES_TO_SOURCE_ACTOR_ID', candidateSet: 'RESOLVES_TO_CANDIDATE_TARGET_IDS', unknown: 'INVALID_OPTION_VALUE' },
        amountFinite: 'RUNTIME_VALIDATOR_REQUIRED'
      },
      semantics: {
        revision4SupersedeDeclared: true,
        revision5SupersedeDeclared: true,
        projectOutput: 'six fields directFacts/legalityModifiers/opportunityModifiers/scheduledFacts/unsupportedOutcomeKinds/deferCode; directFacts supersede the legacy column-code placeholder; column-code strings are not contributions',
        directFactToProviderColumnMapping: MAPPING_NOT_FROZEN,
        legalityModifiers: 'effect-declared legality modifiers in project output; computeLegalityContext returns the current-public legality context (taunt legal target set)',
        mechanicMetadataEntries: 'opportunityModifiers.mechanicMetadataEntries is a closed per-effect array {sourceEffectId, <prototype-allowed Chinese keys>} per prototype subset, deep-frozen and never weighted',
        projectionFamilies: 'opportunityModifiers.projectionFamilies [{sourceEffectId, prototype}] on batch-2 projections: audit identity mapping for feature family routing only, never a weight, never a score input',
        pendingProjection: 'condition branches / trigger limits / 变身期间 / unsigned percent produce explicit PENDING_* codes with retainedInCandidateAudit; mechanically valid input never INVALID_OPTION_VALUE',
        bareCarrier: 'prototypes whose payload container is missing reject UNSUPPORTED_CARRIER_REQUIRES_UNPACK',
        formalOutOfBattle: '灵物吸收 (formal library, no registry path) rejects FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE',
        batch2StateApply: '状态施加: signed 数值 => state.primary PERCENT; signed 副数值 => state.secondary PERCENT; unsigned => PENDING_DIRECTION_PROJECTION; no 数值 => BOOL presence row key=state name; taunt legality {state,target} + forced taunt target set; trigger limit/条件分支/变身期间 => explicit pending',
        batch2Summon: '召唤生成: carrier identity fail-closed EITHER => UNSUPPORTED_CARRIER_REQUIRES_UNPACK (never INVALID_OPTION_VALUE, never silent); 数量 COUNT, 强度 RATIO raw, 继承属性比例 RATIO distinct row; summon.duration TURNS only from explicit 持续回合, never fabricated; SUMMON_WINDOW scheduled fact keeps identity + durationTurns when known and carries entryId = sourceEffectId + :schedule: + 0-based index inside the effect own scheduledFacts array',
        batch2Settlement: '结算修正: settlement.primary PERCENT only; the same effect never emits HP_DELTA/RESOURCE rows (no double count); 结算/限定元素/吸收资源/吸收来源 live in mechanicMetadataEntries only',
        pending13Direct: 'PENDING13 (rev5Spec.pending13Projection): whitelist-valid forms project direct contributions (资源转移 RESOURCE_TRANSFER, 炸环 STATE_DELTA RATIO, 状态移除 with explicit 数量 STATE_DELTA COUNT + tauntRemoved, 规则防御 RULE_DEFENSE_COUNTER, 位移执行 POSITION_DELTA, 时窗修正 WINDOW_ADJUST/SETTLEMENT_RATIO_ADJUST scheduled with entryId, 机制授予 FOLLOW_UP scheduled with entryId + payloadDirectFacts, 决策干扰 bare 索敌干扰 interferenceRates, 资源锁定 resourceLocks, 规则改写 缴械 opportunityConstraints, 状态转移 stateMigration, 状态交换 stateSwap, 机制抹消 mechanismRemoval); remaining forms (时窗修正 without adjust value, 状态移除 任意* or without explicit finite 数量, 决策干扰 判断干扰 or 索敌干扰 with 驱动属性/影响方向, 规则改写 死亡转存活) stay PENDING_DIRECT_PROJECTION with retainedInCandidateAudit',
        implementationNumbersFrozen: 'registry implementation numbers (243/338) are the frozen contract enrollment (contract counts.implementationTarget); per-form behavior follows rev5 cases 85+24'
      }
    };
  }

  var api = {
    providerId: 'behavior-prototype-adapter-v1',
    kind: 'CANDIDATE_ONLY',
    role: ROLE,
    revision: REVISION,
    contractRevision: 5,
    admit: function (effect, ctx) {
      return freezeDeep(runAdmit(effect, ctx));
    },
    project: function (effect, ctx, pathId) {
      return freezeDeep(runProject(effect, ctx, pathId, LIFT_MAP, PROJECTION_MAP));
    },
    computeLegalityContext: function (input) {
      var taunters = tauntersFrom(input || {});
      return freezeDeep({ legalTargetIds: taunters, forcedTauntTargetIds: taunters.slice() });
    },
    classifyPath: function (pathId) {
      metrics.classifyPathCalls += 1;
      var parsed = parsePathId(pathId);
      if (!parsed) return { status: 'REJECTED_INPUT', contractStatus: 'REJECTED_INPUT', implementationStatus: 'MALFORMED_PATH_ID', tier: 'NONE', deferCode: '', reasonCode: 'MALFORMED_PATH_ID' };
      return classifyParsed(parsed, LIFT_MAP, PROJECTION_MAP);
    },
    registry: function () {
      return freezeDeep(buildRegistry());
    },
    readMetrics: function () {
      var out = {};
      for (var k in metrics) if (hasOwn(metrics, k)) out[k] = metrics[k];
      return out;
    },
    validateFormalEffect: function (effect) {
      return freezeDeep(validateFormalOutOfBattleEffect(effect));
    }
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

// ===== candidateFeatureBridge (BehaviorCandidateFeatureBridge_Module.js) =====

// BehaviorCandidateFeatureBridge_Module.js
// M2 candidate-feature bridge writer C - revision 5 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority (frozen, disk-verified):
//   tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.json       b26ace4fbf5862a6126e1190e1b2248b83c752e354f61bdbd81f3dd5c0e8cd4c
//   tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.schema.json 171f102ae7317ed87c1d4a48e801985ee4bf82b18e42237a062d6c7473bfe394
//   BehaviorImmediateFeature_Module.js                              f1dc6c36cbd6c3cddae924378e3f6c456d4ac6d8a18d45a4c2cd345c18cfe648
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.json             8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json     b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49
//   tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json           4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55
//   BehaviorPrototypeAdapter_Module.js                              a3af7b5aa1203ca604254a8755ee7415e5ce52e1cfe7e7923a23c5b0707ddd39
//   tools/rc6/contracts/PrototypeDirectAdapterV1.json               4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e
//   tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json        7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22
//   tools/rc6/cases/PrototypeDirectAdapterCasesV1.json              1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c
//   tools/rc6/contracts/DirectFactRowV1.json                        493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917
//   tools/rc6/contracts/DirectFactRowV1.schema.json                0325e39cd33ecf1c925268d451f23c3bde4d75eca3b5405b614c255b931b0538
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.json             69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8 (read-only, untrained, revision 15)
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.schema.json      3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e (read-only, untrained, revision 15)
// One-pass transcription bridge: prepared CANDIDATES_ONLY frozen candidate + public
// visible snapshot + preview DECISION_VISIBLE atomic contributions + per-effect PDA
// projection records + candidate declaration -> BIF input rev10 production subset.
// Strictly no R8 selection, no old shadow, no future-route, no world clone, no result
// enumeration, no hidden reads, no teacher, no wall clock, no Runtime/loader wiring.
// mechanicMetadataEntries/projectionFamilies are lifted (aggregated verbatim, never
// scored/weighted); scheduledFacts are verbatim (entryId already stamped by PDA);
// opportunityModifiers are transcribed minus the lifted keys; test-only keys
// (forbiddenFacts/branchCombination/preMultiplied) are never emitted; paymentMode
// follows paymentModeDerivationV1; ZERO_SUPPORTED_PROJECTION is fatal and counted.
// Prototype attestation: the bridge resolves the authoritative PDA registry
// (per-input pdaApi or the formal behavior decision pipeline prototypeAdapter,
// fail-closed when neither exists) and stamps the read-only prototypeRegistry
// carrier into every bifInput: registryId + canonical-sorted prototypeNames from
// Object.keys(registry).sort() + fnv1a32 hex + sourceContractHash pin; unknown
// names and registry drift fail closed downstream in the compiler; new prototypes
// auto-adopt without any bridge-side name list.
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var SCHEMA_VERSION = 'BehaviorCandidateFeatureBridgeV1';
  var REGISTRY_ID = 'RC6-M2-BEHAVIOR-CANDIDATE-FEATURE-BRIDGE-V1-2026-08-14';
  var REVISION = 10;

  var CONTRACT_HASHES = {
    bridgeContract: 'b26ace4fbf5862a6126e1190e1b2248b83c752e354f61bdbd81f3dd5c0e8cd4c',
    bridgeSchema: '171f102ae7317ed87c1d4a48e801985ee4bf82b18e42237a062d6c7473bfe394',
    featureModule: 'f1dc6c36cbd6c3cddae924378e3f6c456d4ac6d8a18d45a4c2cd345c18cfe648',
    featureContract: '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76',
    featureSchema: 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49',
    featureCases: '4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55',
    adapterModule: 'a3af7b5aa1203ca604254a8755ee7415e5ce52e1cfe7e7923a23c5b0707ddd39',
    adapterContract: '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
    adapterSchema: '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
    adapterCases: '1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c',
    directFactRow: '493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917',
    policyContract: '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8',
    policySchema: '3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e'
  };
  var TEST_ONLY_KEYS = ['forbiddenFacts', 'branchCombination', 'preMultiplied'];
  var UNTRANSCRIBED_REASONS = [
    'non-finite expectedDelta', 'non-finite hitProbability', 'missing outcomeKind',
    'missing eventId', 'unmatched contribution source'
  ];
  var PENDING_KINDS = [
    'PENDING_CONDITIONAL_PROJECTION', 'PENDING_TRIGGER_PROJECTION',
    'PENDING_DURATION_PROJECTION', 'PENDING_DIRECTION_PROJECTION',
    'PENDING_DIRECT_PROJECTION'
  ];
  var DEFER_KINDS = [
    'DEFER_MECHANICS_PROJECTION', 'DEFER_LEGALITY_INJECTION', 'DEFER_REPORT_PROJECTION'
  ];
  var REJECT_CODES = [
    'UNKNOWN_PROTOTYPE_REJECTED', 'FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE',
    'MISSING_SOURCE_CONTEXT', 'MISSING_TARGET_CONTEXT', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_RULE', 'AMBIGUOUS_TAUNT_TARGET'
  ];
  var NO_OFFICIAL_EFFECT_KINDS = ['BASIC_ATTACK', 'DEFEND', 'EVADE', 'PASS'];
  var HARD_EXCLUSION_CODES = [
    'ACTOR_DISABLED', 'ACTOR_TERMINAL', 'TARGET_EMPTY', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_STATE', 'UNKNOWN_RULE',
    'AMBIGUOUS_TAUNT_TARGET', 'ILLEGAL_TARGET', 'RESOURCE_INSUFFICIENT'
  ];
  var CARRIER_KIND = 'UNSUPPORTED_CARRIER_REQUIRES_UNPACK';
  var FATAL_ZERO = 'ZERO_SUPPORTED_PROJECTION';
  var LIFTED_OPP_KEYS = ['mechanicMetadataEntries', 'projectionFamilies'];
  var RESOURCE_NAMES = ['魂力', '精神力', '体力', '生命'];
  var ACTION_OPPORTUNITY_KEYS = ['role', 'sourceActorId', 'incomingAction', 'actionContext', 'counterWindow', 'reactionMechanics'];
  var REACTION_MECHANICS_KEYS = [
    'candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId',
    'targetId', 'prepared', 'damageMultiplier', 'dodgeProbability',
    'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'
  ];
  var REACTION_RESPONSE_KINDS = ['PASS_OPPORTUNITY', 'DEFEND', 'EVADE'];
  var REACTION_UNKNOWN_REASONS = [
    'NO_PUBLIC_DECLARATION', 'CONDITIONAL_PROBABILITY_UNRESOLVED', 'FINAL_SETTLEMENT_UNKNOWN',
    'FUTURE_REALIZATION_UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', 'MISSING_SOURCE_FACT',
    'SIDE_UNOBSERVED', 'STATE_FORM_UNMAPPED', 'CONFLICTING_DELIVERIES', 'NON_FINITE_DELIVERY',
    'SOURCE_PROVENANCE_INCOMPLETE'
  ];
  var CREATION_PROFILE_KEYS = ['recipientId', 'useEffects'];
  var CREATION_PROFILE_ROW_KEYS = ['原型', '目标', '资源', '数值'];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      hasOwn(proto, 'constructor') && proto.constructor && proto.constructor.name === 'Object');
  }
  // Deterministic sandbox-safe hash (FNV-1a 32-bit over UTF-16 code units of the
  // canonical JSON {"prototypeNames":[...]}) binding the prototypeRegistry carrier;
  // the compiler recomputes and compares it (registry drift fails closed).
  function fnv1a32Hex(names) {
    var s = '{"prototypeNames":[';
    for (var i = 0; i < names.length; i += 1) {
      if (i > 0) s += ',';
      s += JSON.stringify(names[i]);
    }
    s += ']}';
    var h = 0x811c9dc5;
    for (var j = 0; j < s.length; j += 1) {
      h ^= s.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    var hex = h.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex;
  }
  function globalPdaApi() {
    var host = typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
          ? window
          : null;
    var pda = host && host.__LWCS_BEHAVIOR_DECISION_PIPELINE__ && host.__LWCS_BEHAVIOR_DECISION_PIPELINE__.prototypeAdapter;
    return pda && typeof pda.registry === 'function' ? pda : null;
  }
  function resolvePdaApi(input) {
    var pda = input && input.pdaApi;
    if (pda && typeof pda === 'object' && typeof pda.registry === 'function') return pda;
    pda = globalPdaApi();
    if (pda) return pda;
    throw rejection('MISSING_REQUIRED_FIELD', { field: 'pdaApi' });
  }
  function prototypeRegistryFrom(pdaApi) {
    var reg = pdaApi.registry();
    if (!reg || typeof reg !== 'object' || Array.isArray(reg)) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry' });
    var regId = reg.registryId;
    if (typeof regId !== 'string' || regId.indexOf('RC6-M2-PROTOTYPE-DIRECT-ADAPTER') !== 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.registryId', value: regId });
    }
    var rows = reg.registry;
    if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry' });
    var names = Object.keys(rows).sort();
    if (names.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames' });
    for (var i = 1; i < names.length; i += 1) {
      if (names[i - 1] >= names[i]) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames' });
    }
    return {
      registryId: regId,
      prototypeNames: names,
      prototypeRegistryHash: fnv1a32Hex(names),
      sourceContractHash: CONTRACT_HASHES.adapterContract
    };
  }
  function cloneDeep(v) { return JSON.parse(JSON.stringify(v)); }
  function normZero(v) { return v === 0 ? 0 : v; }
  function isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }
  function rejection(code, detail) {
    var e = new Error(code + (detail ? ' :: ' + JSON.stringify(detail) : ''));
    e.code = code;
    e.reasonCode = code;
    e.detail = detail === undefined ? null : detail;
    return e;
  }
  function freezeDeep(v) {
    if (v && typeof v === 'object' && Object.isFrozen(v)) return v;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i += 1) freezeDeep(v[i]);
      Object.freeze(v);
    } else if (v && typeof v === 'object') {
      for (var k in v) if (hasOwn(v, k)) freezeDeep(v[k]);
      Object.freeze(v);
    }
    return v;
  }
  function validateIdString(v, field) {
    if (typeof v !== 'string' || v.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: field });
    if (v.length > 512 || /[\u0000-\u001F\u007F]/.test(v)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    return v;
  }
  function canonicalActionId(candidate, declaration) {
    if (declaration === undefined) return candidate.candidateId;
    if (!isPlainObject(declaration)) throw rejection('INVALID_OPTION_VALUE', { field: 'declaration' });
    if (!hasOwn(declaration, 'actionId')) return candidate.candidateId;
    var value = declaration.actionId;
    if (typeof value !== 'string' || value.length === 0 || value.length > 512 || /[\u0000-\u001F\u007F]/.test(value)) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.actionId' });
    }
    return value;
  }

  function validateReactionRefs(value, field) {
    if (!Array.isArray(value)) throw rejection('MISSING_REQUIRED_FIELD', { field: field });
    var seen = {};
    for (var i = 0; i < value.length; i += 1) {
      validateIdString(value[i], field + '[' + i + ']');
      if (hasOwn(seen, value[i])) throw rejection('INVALID_OPTION_VALUE', { field: field, duplicate: value[i] });
      seen[value[i]] = true;
    }
  }

  function sameReactionRefs(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every(function (value, index) { return value === right[index]; });
  }

  function validateActionContext(value, field) {
    if (value === undefined) return undefined;
    if (!isPlainObject(value)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    rejectUnknownKeys(value, ['actionEvent', 'targetResolutionEvent'], field);
    var actionEvent = value.actionEvent;
    if (!isPlainObject(actionEvent)) throw rejection('MISSING_REQUIRED_FIELD', { field: field + '.actionEvent' });
    rejectUnknownKeys(actionEvent, ['actionId', 'eventId'], field + '.actionEvent');
    validateIdString(actionEvent.actionId, field + '.actionEvent.actionId');
    validateIdString(actionEvent.eventId, field + '.actionEvent.eventId');
    var normalized = { actionEvent: { actionId: actionEvent.actionId, eventId: actionEvent.eventId } };
    if (value.targetResolutionEvent !== undefined) {
      var targetEvent = value.targetResolutionEvent;
      if (!isPlainObject(targetEvent)) throw rejection('INVALID_OPTION_VALUE', { field: field + '.targetResolutionEvent' });
      rejectUnknownKeys(targetEvent, ['eventId'], field + '.targetResolutionEvent');
      validateIdString(targetEvent.eventId, field + '.targetResolutionEvent.eventId');
      normalized.targetResolutionEvent = { eventId: targetEvent.eventId };
    }
    return normalized;
  }

  function contextRefs(context) {
    var ids = [context.actionEvent.eventId];
    if (context.targetResolutionEvent && context.targetResolutionEvent.eventId !== context.actionEvent.eventId) {
      ids.push(context.targetResolutionEvent.eventId);
    }
    return { sourceActionId: context.actionEvent.actionId, sourceFactIds: ids.slice(), sourceEventIds: ids.slice() };
  }

  function validateActionOpportunityCarrier(value, cand) {
    if (value === undefined) return undefined;
    if (!isPlainObject(value)) throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity' });
    rejectUnknownKeys(value, ACTION_OPPORTUNITY_KEYS, 'actionOpportunity');
    validateIdString(value.role, 'actionOpportunity.role');
    if (value.sourceActorId !== undefined) validateIdString(value.sourceActorId, 'actionOpportunity.sourceActorId');
    if (value.counterWindow !== undefined && typeof value.counterWindow !== 'boolean') {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.counterWindow' });
    }
    var actionContext = validateActionContext(value.actionContext, 'actionOpportunity.actionContext');
    var incoming = value.incomingAction;
    if (!isPlainObject(incoming)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'actionOpportunity.incomingAction' });
    if (hasOwn(incoming, 'reactionMechanics') || hasOwn(incoming, 'damageMultiplier') || hasOwn(incoming, 'dodgeProbability')) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.incomingAction' });
    }
    validateIdString(incoming.sourceActionId, 'actionOpportunity.incomingAction.sourceActionId');
    if (actionContext) {
      var refs = contextRefs(actionContext);
      validateReactionRefs(incoming.sourceFactIds, 'actionOpportunity.incomingAction.sourceFactIds');
      validateReactionRefs(incoming.sourceEventIds, 'actionOpportunity.incomingAction.sourceEventIds');
      if (incoming.sourceActionId !== refs.sourceActionId || !sameReactionRefs(incoming.sourceFactIds, refs.sourceFactIds) ||
        !sameReactionRefs(incoming.sourceEventIds, refs.sourceEventIds)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.identity' });
      }
    }
    var mechanics = value.reactionMechanics;
    if (!isPlainObject(mechanics)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'actionOpportunity.reactionMechanics' });
    rejectUnknownKeys(mechanics, REACTION_MECHANICS_KEYS, 'actionOpportunity.reactionMechanics');
    var required = ['candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId', 'targetId', 'prepared', 'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'];
    for (var r = 0; r < required.length; r += 1) {
      if (mechanics[required[r]] === undefined) throw rejection('MISSING_REQUIRED_FIELD', { field: 'actionOpportunity.reactionMechanics.' + required[r] });
    }
    validateIdString(mechanics.candidateId, 'actionOpportunity.reactionMechanics.candidateId');
    validateIdString(mechanics.sourceActionId, 'actionOpportunity.reactionMechanics.sourceActionId');
    validateIdString(mechanics.sourceActorId, 'actionOpportunity.reactionMechanics.sourceActorId');
    validateIdString(mechanics.targetId, 'actionOpportunity.reactionMechanics.targetId');
    validateIdString(mechanics.visibleWorldRevision, 'actionOpportunity.reactionMechanics.visibleWorldRevision');
    validateIdString(mechanics.requestHash, 'actionOpportunity.reactionMechanics.requestHash');
    validateReactionRefs(mechanics.sourceFactIds, 'actionOpportunity.reactionMechanics.sourceFactIds');
    validateReactionRefs(mechanics.sourceEventIds, 'actionOpportunity.reactionMechanics.sourceEventIds');
    if (REACTION_RESPONSE_KINDS.indexOf(mechanics.responseKind) < 0 || (mechanics.status !== 'KNOWN' && mechanics.status !== 'UNKNOWN')) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics' });
    }
    if (mechanics.prepared !== true || mechanics.candidateId !== cand.candidateId || mechanics.responseKind !== cand.actionKind ||
      mechanics.sourceActorId !== value.sourceActorId || mechanics.sourceActionId !== incoming.sourceActionId ||
      mechanics.targetId !== cand.actorId || cand.targetSet.indexOf(mechanics.targetId) < 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.identity' });
    }
    if (actionContext) {
      var contextIdentity = contextRefs(actionContext);
      if (mechanics.sourceActionId !== contextIdentity.sourceActionId ||
        !sameReactionRefs(mechanics.sourceFactIds, contextIdentity.sourceFactIds) ||
        !sameReactionRefs(mechanics.sourceEventIds, contextIdentity.sourceEventIds)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.reactionMechanics' });
      }
    }
    if (mechanics.status === 'KNOWN') {
      if (mechanics.reason !== 'OK' || !isFiniteNumber(mechanics.damageMultiplier) || mechanics.damageMultiplier < 0 || mechanics.damageMultiplier > 1 ||
        !isFiniteNumber(mechanics.dodgeProbability) || mechanics.dodgeProbability < 0 || mechanics.dodgeProbability > 1) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.values' });
      }
      if (mechanics.responseKind === 'PASS_OPPORTUNITY' && (mechanics.damageMultiplier !== 1 || mechanics.dodgeProbability !== 0)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.PASS_OPPORTUNITY' });
      }
      if (mechanics.sourceFactIds.length === 0 || mechanics.sourceEventIds.length === 0) {
        var downgraded = cloneDeep(value);
        downgraded.reactionMechanics.status = 'UNKNOWN';
        downgraded.reactionMechanics.reason = 'SOURCE_PROVENANCE_INCOMPLETE';
        delete downgraded.reactionMechanics.damageMultiplier;
        delete downgraded.reactionMechanics.dodgeProbability;
        return downgraded;
      }
    } else if (hasOwn(mechanics, 'damageMultiplier') || hasOwn(mechanics, 'dodgeProbability') || REACTION_UNKNOWN_REASONS.indexOf(mechanics.reason) < 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.UNKNOWN' });
    }
    return cloneDeep(value);
  }

  function rejectUnknownKeys(obj, allowed, field) {
    for (var k in obj) {
      if (hasOwn(obj, k) && allowed.indexOf(k) < 0) throw rejection('INVALID_OPTION_VALUE', { field: field, extraKey: k });
    }
  }

  function derivePaymentMode(candidate, declaration) {
    if (candidate && typeof candidate.paymentMode === 'string' && candidate.paymentMode.length > 0) return candidate.paymentMode;
    if (declaration && typeof declaration.paymentMode === 'string' && declaration.paymentMode.length > 0) return declaration.paymentMode;
    if (candidate && candidate.resourcePotentialOnly === true) return 'EXTERNAL_TIMELINE';
    return 'FORMAL';
  }

  function untranscribedReasonOf(contrib) {
    if (contrib === null || typeof contrib !== 'object') return 'missing outcomeKind';
    if (typeof contrib.eventId !== 'string' || contrib.eventId.length === 0) return 'missing eventId';
    if (typeof contrib.outcomeKind !== 'string' || contrib.outcomeKind.length === 0) return 'missing outcomeKind';
    if (!isFiniteNumber(contrib.expectedDelta)) return 'non-finite expectedDelta';
    var ev = contrib.evidence;
    // R4b2: HP_DELTA rows keep their delivery identity; missing/non-finite
    // probability is transcribed as deliveryStatus below, not dropped here.
    if (String(contrib.outcomeKind || '').trim() === 'HP_DELTA') return null;
    if (!ev || typeof ev !== 'object' || !isFiniteNumber(ev.hitProbability)) return 'non-finite hitProbability';
    return null;
  }

  function atomicFromContributions(canonicalActionId, contributions) {
    var facts = [];
    var untranscribed = [];
    var list = Array.isArray(contributions) ? contributions : [];
    for (var i = 0; i < list.length; i += 1) {
      var c = list[i];
      if (c === null || typeof c !== 'object') { untranscribed.push({ reason: 'missing outcomeKind', index: i }); continue; }
      var sourceOk = typeof c.sourceActionId === 'string' && c.sourceActionId === canonicalActionId;
      var reason = untranscribedReasonOf(c);
      if (!sourceOk && !reason) reason = 'unmatched contribution source';
      if (reason) { untranscribed.push({ reason: reason, index: i }); continue; }
      var isHpDelta = String(c.outcomeKind || '').trim() === 'HP_DELTA';
      if (isHpDelta) {
        var effectId = typeof c.effectInstanceId === 'string' ? c.effectInstanceId : '';
        var targetId = typeof c.targetId === 'string' ? c.targetId : '';
        if (!effectId || !targetId) {
          facts.push({ eventId: c.eventId, sourceActionId: c.sourceActionId,
            outcomeKind: c.outcomeKind, expectedDelta: normZero(c.expectedDelta),
            hitCheckApplicability: 'UNKNOWN' });
          continue;
        }
        var basis = c.evidence && c.evidence.damageBasis && typeof c.evidence.damageBasis === 'object'
          ? c.evidence.damageBasis
          : null;
        var rawP = c.evidence && c.evidence.hitProbability;
        var pFinite = isFiniteNumber(rawP);
        var fact = {
          eventId: c.eventId,
          sourceActionId: c.sourceActionId,
          outcomeKind: c.outcomeKind,
          expectedDelta: normZero(c.expectedDelta),
          effectInstanceId: effectId,
          targetId: targetId
        };
        if (pFinite) {
          fact.hitCheckApplicability = 'APPLICABLE';
          fact.evidence = { hitProbability: normZero(rawP) };
          if (basis) fact.evidence.damageBasis = basis;
        } else {
          fact.hitCheckApplicability = 'APPLICABLE';
          fact.evidence = { deliveryStatus: rawP === undefined || rawP === null ? 'MISSING' : 'NON_FINITE' };
          if (basis) fact.evidence.damageBasis = basis;
        }
        facts.push(fact);
        continue;
      }
      facts.push({
        eventId: c.eventId,
        sourceActionId: c.sourceActionId,
        outcomeKind: c.outcomeKind,
        expectedDelta: normZero(c.expectedDelta),
        hitCheckApplicability: 'APPLICABLE',
        evidence: { hitProbability: normZero(c.evidence.hitProbability) },
        effectInstanceId: typeof c.effectInstanceId === 'string' ? c.effectInstanceId : '',
        targetId: typeof c.targetId === 'string' ? c.targetId : ''
      });
    }
    return { atomicFacts: facts, untranscribed: untranscribed };
  }

  function classifyProjection(proj) {
    var kinds = Array.isArray(proj.unsupportedOutcomeKinds) ? proj.unsupportedOutcomeKinds : [];
    var deferCode = typeof proj.deferCode === 'string' ? proj.deferCode : '';
    var out = { rejection: null, pending: [], deferred: null, carrier: false };
    if (deferCode && DEFER_KINDS.indexOf(deferCode) >= 0) out.deferred = deferCode;
    for (var i = 0; i < kinds.length; i += 1) {
      var k = kinds[i];
      if (k === CARRIER_KIND) { out.carrier = true; continue; }
      if (PENDING_KINDS.indexOf(k) >= 0) { out.pending.push(k); continue; }
      if (k === 'DEFER_LIFT_PROJECTION_REQUIRED') { continue; }
      if (k === 'OUT_OF_BATTLE_SCOPE') { if (!out.rejection) out.rejection = 'FORMAL_LIBRARY_OUT_OF_BATTLE_SCOPE'; continue; }
      if (REJECT_CODES.indexOf(k) >= 0) { if (!out.rejection) out.rejection = k; continue; }
      if (out.deferred) continue;
      if (!out.rejection) out.rejection = k;
    }
    return out;
  }

  function isZeroProjection(proj) {
    return (Array.isArray(proj.directFacts) ? proj.directFacts.length : 0) === 0 &&
      (Array.isArray(proj.scheduledFacts) ? proj.scheduledFacts.length : 0) === 0 &&
      (!proj.legalityModifiers || Object.keys(proj.legalityModifiers).length === 0) &&
      (!proj.opportunityModifiers || Object.keys(proj.opportunityModifiers).length === 0);
  }

  function mergeMods(a, b) {
    var out = {};
    for (var k in a) if (hasOwn(a, k)) out[k] = cloneDeep(a[k]);
    for (var k2 in b) if (hasOwn(b, k2)) out[k2] = cloneDeep(b[k2]);
    return out;
  }

  function liftProjections(pdaProjections) {
    var agg = {
      directFacts: [], scheduledFacts: [], legalityModifiers: {}, opportunityModifiers: {},
      mechanicMetadataEntries: [], projectionFamilies: [], rejections: [], pendings: [],
      deferreds: [], fatals: []
    };
    var items = Array.isArray(pdaProjections) ? pdaProjections : [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var seid = item && typeof item === 'object' ? item.sourceEffectId : null;
      if (typeof seid !== 'string' || seid.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'pdaProjections[].sourceEffectId' });
      var proj = item.projection;
      if (!proj || typeof proj !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'pdaProjections[].projection' });
      var cls = classifyProjection(proj);
      if (cls.carrier) { agg.rejections.push({ kind: CARRIER_KIND, sourceEffectId: seid }); continue; }
      if (cls.rejection) { agg.rejections.push({ kind: 'REJECTED_INPUT_WITH_REASON', code: cls.rejection, sourceEffectId: seid }); continue; }
      for (var p = 0; p < cls.pending.length; p += 1) agg.pendings.push({ kind: cls.pending[p], sourceEffectId: seid });
      if (cls.deferred) agg.deferreds.push({ kind: cls.deferred, sourceEffectId: seid });
      if (Array.isArray(proj.directFacts)) {
        for (var r = 0; r < proj.directFacts.length; r += 1) agg.directFacts.push(cloneDeep(proj.directFacts[r]));
      }
      if (Array.isArray(proj.scheduledFacts)) {
        for (var s = 0; s < proj.scheduledFacts.length; s += 1) agg.scheduledFacts.push(cloneDeep(proj.scheduledFacts[s]));
      }
      if (proj.legalityModifiers && typeof proj.legalityModifiers === 'object') {
        agg.legalityModifiers = mergeMods(agg.legalityModifiers, proj.legalityModifiers);
      }
      if (proj.opportunityModifiers && typeof proj.opportunityModifiers === 'object') {
        var om = proj.opportunityModifiers;
        var rest = {};
        for (var k in om) {
          if (!hasOwn(om, k) || LIFTED_OPP_KEYS.indexOf(k) >= 0) continue;
          rest[k] = cloneDeep(om[k]);
        }
        agg.opportunityModifiers = mergeMods(agg.opportunityModifiers, rest);
        if (Array.isArray(om.mechanicMetadataEntries)) {
          for (var m = 0; m < om.mechanicMetadataEntries.length; m += 1) agg.mechanicMetadataEntries.push(cloneDeep(om.mechanicMetadataEntries[m]));
        }
        if (Array.isArray(om.projectionFamilies)) {
          for (var f = 0; f < om.projectionFamilies.length; f += 1) agg.projectionFamilies.push(cloneDeep(om.projectionFamilies[f]));
        }
      }
      if (cls.pending.length === 0 && !cls.deferred && isZeroProjection(proj)) {
        agg.fatals.push({ kind: FATAL_ZERO, sourceEffectId: seid });
      }
    }
    return agg;
  }

  // Structured creation declaration carrier: validates and normalizes the per-candidate
  // creationProfile into the closed bifInput shape {recipientId, useEffects rows closed
  // {原型,目标,资源,数值}}; non-semantic source row keys (e.g. 生效方式) are dropped,
  // never parsed as free text, never derived from candidateId/targetSet.
  function normalizeCreationProfile(cp) {
    if (cp === undefined || cp === null) return null;
    if (typeof cp !== 'object' || Array.isArray(cp)) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile' });
    rejectUnknownKeys(cp, CREATION_PROFILE_KEYS, 'creationProfile');
    if (typeof cp.recipientId !== 'string' || cp.recipientId.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'creationProfile.recipientId' });
    if (cp.recipientId.length > 512 || /[\u0000-\u001F\u007F]/.test(cp.recipientId)) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.recipientId' });
    if (!Array.isArray(cp.useEffects)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'creationProfile.useEffects' });
    var out = { recipientId: cp.recipientId, useEffects: [] };
    for (var i = 0; i < cp.useEffects.length; i += 1) {
      var row = cp.useEffects[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + ']' });
      var norm = {};
      for (var k = 0; k < CREATION_PROFILE_ROW_KEYS.length; k += 1) {
        var key = CREATION_PROFILE_ROW_KEYS[k];
        if (row[key] === undefined) throw rejection('MISSING_REQUIRED_FIELD', { field: 'creationProfile.useEffects[' + i + '].' + key });
        var v = row[key];
        if ((key === '原型' || key === '目标' || key === '数值') && (typeof v !== 'string' || v.length === 0)) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].' + key });
        }
        if (key === '资源') {
          if (typeof v === 'string') {
            if (v.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
            norm[key] = v;
          } else if (Array.isArray(v)) {
            if (v.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
            var seen = {};
            for (var r = 0; r < v.length; r += 1) {
              if (typeof v[r] !== 'string' || v[r].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源[' + r + ']' });
              if (hasOwn(seen, v[r])) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源', duplicate: v[r] });
              seen[v[r]] = true;
            }
            norm[key] = v.slice();
          } else {
            throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
          }
        } else {
          norm[key] = v;
        }
      }
      out.useEffects.push(norm);
    }
    return out;
  }

  function bridgeCandidate(input, m) {
    if (!input || typeof input !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'candidate input' });
    var pdaApi = resolvePdaApi(input);
    var cand = input.frozenCandidate;
    if (!cand || typeof cand !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'frozenCandidate' });
    validateIdString(cand.candidateId, 'frozenCandidate.candidateId');
    validateIdString(cand.actorId, 'frozenCandidate.actorId');
    validateIdString(cand.actorSide, 'frozenCandidate.actorSide');
    validateIdString(cand.actionKind, 'frozenCandidate.actionKind');
    if (!Array.isArray(cand.targetSet) || cand.targetSet.length === 0) throw rejection('MISSING_REQUIRED_FIELD', { field: 'frozenCandidate.targetSet' });
    var world = input.visibleWorld;
    if (!world || typeof world !== 'object') throw rejection('MISSING_REQUIRED_FIELD', { field: 'visibleWorld' });
    var declaration = input.declaration;
    if (declaration === undefined) declaration = {};
    else if (!isPlainObject(declaration)) throw rejection('INVALID_OPTION_VALUE', { field: 'declaration' });
    var declaredEffects = declaration.skill && declaration.skill._效果数组;
    if (declaredEffects !== undefined && !Array.isArray(declaredEffects)) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.skill._效果数组' });
    }
    if (Array.isArray(declaredEffects)) {
      for (var de = 0; de < declaredEffects.length; de += 1) {
        if (declaredEffects[de] !== undefined && !isPlainObject(declaredEffects[de])) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.skill._效果数组[' + de + ']' });
        }
      }
    }
    var paymentMode = derivePaymentMode(cand, declaration);
    var actionId = canonicalActionId(cand, declaration);
    var actionOpportunity = validateActionOpportunityCarrier(input.actionOpportunity, cand);
    var atomic = atomicFromContributions(actionId, input.contributions);
    var lifted = liftProjections(input.pdaProjections);
    var noOfficial = [];
    if (NO_OFFICIAL_EFFECT_KINDS.indexOf(cand.actionKind) >= 0) {
      noOfficial.push({ kind: cand.actionKind, note: 'implicit base-action public mechanics must be materialized upstream from preview public operands; the bridge never invents a skill effect object' });
    }
    var bifCandidate = {
      candidateId: cand.candidateId, actorId: cand.actorId, actorSide: cand.actorSide,
      actionKind: cand.actionKind, targetSet: cand.targetSet.slice(), paymentMode: paymentMode
    };
    var bifInput = {
      candidate: bifCandidate,
      publicSnapshot: Object.isFrozen(world) ? world : cloneDeep(world),
      atomicFacts: atomic.atomicFacts,
      directFacts: lifted.directFacts,
      legalityModifiers: lifted.legalityModifiers,
      opportunityModifiers: lifted.opportunityModifiers,
      scheduledFacts: lifted.scheduledFacts,
      mechanicMetadataEntries: lifted.mechanicMetadataEntries,
      projectionFamilies: lifted.projectionFamilies
    };
    if (actionOpportunity !== undefined) bifInput.actionOpportunity = actionOpportunity;
    bifInput.prototypeRegistry = prototypeRegistryFrom(pdaApi);
    if (Array.isArray(declaration.publicCost) && declaration.publicCost.length > 0) {
      var cost = [];
      for (var c = 0; c < declaration.publicCost.length; c += 1) {
        var e = declaration.publicCost[c];
        if (!e || typeof e !== 'object' || RESOURCE_NAMES.indexOf(e.resource) < 0 || !isFiniteNumber(e.amount)) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'declaration.publicCost' });
        }
        cost.push({ resource: e.resource, amount: normZero(e.amount) });
      }
      bifInput.publicCost = cost;
    }
    if (declaration.publicProbability && typeof declaration.publicProbability === 'object') {
      bifInput.publicProbability = cloneDeep(declaration.publicProbability);
    }
    if (declaration.publicDeclarations && typeof declaration.publicDeclarations === 'object' &&
      Object.keys(declaration.publicDeclarations).length > 0) {
      bifInput.publicDeclarations = cloneDeep(declaration.publicDeclarations);
    }
    if (input.creationProfile !== undefined) {
      var cp = normalizeCreationProfile(input.creationProfile);
      if (cp) bifInput.creationProfile = cp;
    }
    for (var t = 0; t < TEST_ONLY_KEYS.length; t += 1) {
      if (hasOwn(bifInput, TEST_ONLY_KEYS[t])) throw rejection('INVALID_OPTION_VALUE', { field: TEST_ONLY_KEYS[t] });
    }
    var per = {
      candidateId: cand.candidateId,
      bifInput: bifInput,
      untranscribedPreviewFacts: {
        count: atomic.untranscribed.length,
        reasons: atomic.untranscribed
      },
      rejections: lifted.rejections,
      pdaPending: lifted.pendings,
      pdaDeferred: lifted.deferreds,
      fatalViolations: lifted.fatals,
      noOfficialEffectMaterialization: noOfficial
    };
    var work = 14 + bifInput.directFacts.length + bifInput.scheduledFacts.length +
      atomic.atomicFacts.length + lifted.mechanicMetadataEntries.length + lifted.projectionFamilies.length;
    if (m) {
      m.calls += 1;
      m.workUnitsTotal += work;
      m.lastWorkUnits = work;
      m.lastCandidateId = cand.candidateId;
      m.itemsTotal += Array.isArray(input.pdaProjections) ? input.pdaProjections.length : 0;
      m.compiled += 1;
      m.rejectionTotal += lifted.rejections.length;
      m.pendingTotal += lifted.pendings.length;
      m.deferTotal += lifted.deferreds.length;
      m.fatalTotal += lifted.fatals.length;
      m.untranscribedTotal += atomic.untranscribed.length;
    }
    return per;
  }

  function freshMetrics() {
    return { calls: 0, workUnitsTotal: 0, lastWorkUnits: 0, lastCandidateId: null, itemsTotal: 0, compiled: 0, rejectionTotal: 0, pendingTotal: 0, deferTotal: 0, fatalTotal: 0, untranscribedTotal: 0 };
  }
  var metrics = freshMetrics();

  function bridgeCandidates(inputs) {
    if (!Array.isArray(inputs)) throw rejection('MISSING_REQUIRED_FIELD', { field: 'inputs' });
    metrics = freshMetrics();
    var perCandidate = [];
    for (var i = 0; i < inputs.length; i += 1) perCandidate.push(bridgeCandidate(inputs[i], metrics));
    var totals = {
      candidateCount: perCandidate.length,
      pdaItems: metrics.itemsTotal,
      compiledCount: metrics.compiled,
      rejectionSum: metrics.rejectionTotal,
      pendingSum: metrics.pendingTotal,
      deferSum: metrics.deferTotal,
      fatalSum: metrics.fatalTotal,
      untranscribedSum: metrics.untranscribedTotal
    };
    var out = { schemaVersion: SCHEMA_VERSION, totals: totals, perCandidate: perCandidate };
    return freezeDeep(out);
  }

  function readMetrics() {
    var m = {};
    for (var k in metrics) if (hasOwn(metrics, k)) m[k] = metrics[k];
    return freezeDeep(m);
  }

  function buildRegistry() {
    return {
      schemaVersion: SCHEMA_VERSION,
      contractId: REGISTRY_ID,
      revision: REVISION,
      role: ROLE,
      mount: MOUNT_NAME,
      apiSurface: ['bridgeCandidates', 'bridgeCandidate', 'registry', 'readMetrics'],
      authority: {
        milestone: 'M2',
        claim: 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED',
        claimDetail: 'freezes the transcription bridge input/output shape, lifting rules and accounting; the runtime bridge module is implemented as the transcription layer only; no selection, no teacher, no future route',
        futureRouteDerivation: false,
        worldClone: false,
        resultWorldEnumeration: false,
        hiddenInformationRead: false,
        selectionOrTopK: false,
        teacherInProductionClosure: false
      },
      contractHashes: cloneDeep(CONTRACT_HASHES),
      enums: {
        untranscribedReasons: UNTRANSCRIBED_REASONS.slice(),
        pendingKinds: PENDING_KINDS.slice(),
        deferKinds: DEFER_KINDS.slice(),
        rejectCodes: REJECT_CODES.slice(),
        noOfficialEffectKinds: NO_OFFICIAL_EFFECT_KINDS.slice(),
        hardExclusionCodes: HARD_EXCLUSION_CODES.slice()
      },
      paymentModeDerivationV1: '1) candidate.paymentMode; 2) declaration.paymentMode; 3) candidate.resourcePotentialOnly===true => EXTERNAL_TIMELINE; 4) FORMAL',
      lifting: 'mechanicMetadataEntries/projectionFamilies aggregated verbatim across effects into the BIF input; opportunityModifiers minus lifted keys; scheduledFacts verbatim with PDA entryId',
      testOnlyKeysNeverEmitted: TEST_ONLY_KEYS.slice(),
      zeroProjectionPolicy: 'SUPPORTED effect with zero directFacts/legality/opportunity/scheduled rows is FATAL ZERO_SUPPORTED_PROJECTION, never disguised as pending/deferred/silent',
      workFormula: 'per candidate 14 (F0) + directFacts rows + scheduledFacts entries + atomicFacts entries + metadata entries; no wall clock; BIF caps referenced whole-compile'
    };
  }

  var api = {
    bridgeCandidates: bridgeCandidates,
    bridgeCandidate: function (input) {
      metrics = freshMetrics();
      var per = bridgeCandidate(input, metrics);
      return freezeDeep(per);
    },
    registry: function () { return freezeDeep(buildRegistry()); },
    readMetrics: readMetrics,
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

// ===== immediateFeature (BehaviorImmediateFeature_Module.js) =====

// BehaviorImmediateFeature_Module.js
// M2 immediate feature compiler writer F - revision 4 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority (frozen, disk-verified):
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.json       8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76
//   tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49
//   tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json       4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.json         69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8 (read-only, untrained, revision 15)
//   tools/rc6/contracts/DistilledBehaviorPolicyV1.schema.json  3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e (read-only, untrained, revision 15)
// Governed frozen sources (read-only): BehaviorProviderV1 cc32c251236906c5e128164f76a25a1196ebe089ef7903edb454e3374a90f156;
//   PrototypeDirectAdapterV1 4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e;
//   PrototypeDirectAdapterV1.schema 7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22;
//   PrototypeDirectAdapterCasesV1 1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c; DirectFactRowV1 493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917;
//   DirectFactRowV1.schema 0325e39cd33ecf1c925268d451f23c3bde4d75eca3b5405b614c255b931b0538.
// Prototype attestation: projectionFamilies prototype legitimacy comes from the
// read-only input.prototypeRegistry PDA registry attestation carrier (stamped by
// BehaviorCandidateFeatureBridge_Module); no hardcoded prototype name list; unknown
// names and registry hash/sourceContractHash drift fail closed; new prototypes
// auto-adopt (family-neutral until a later contract revision routes them).
// Revision 4 final (cases 62): scheduledFacts closed four-shape per PDA rev5 schema
// (WINDOW_ADJUST entryId/operation/调整字段/调整方式 + optional 调整回合/调整tick/调整次数/
// 结算倍率; SETTLEMENT_RATIO_ADJUST entryId/operation/结算倍率; FOLLOW_UP entryId/grantType/
// ownerId/followUpKey/triggerKey/payloadDirectFacts with maxActions >=1 only for 主动触发; SUMMON_WINDOW entryId/
// grantType/召唤单位类型/召唤物名称/行动模式/durationTurns); private aliases key/字段/方式
// are rejected; every entry requires entryId and counts into OUTSIDE_BATCH1_ROW_COUNT.
// Revision 4 (batch-2 rev4): six raw feature codes pinned at fixed catalog positions 23-28
// (STATE_DELTA_PERCENT/SETTLEMENT_MODIFIER_PERCENT/SUMMON_COUNT/SUMMON_STRENGTH/
// SUMMON_DURATION/RESOURCE_DELTA_PERCENT);
// STATE_DELTA rows route state.primary/state.secondary PERCENT to STATE_DELTA_PERCENT,
// settlement.primary PERCENT to SETTLEMENT_MODIFIER_PERCENT (never HP/RESOURCE double rows),
// other PERCENT keys to UNKNOWN(MISSING_SOURCE_FACT); RESOURCE_OPTION_CHANGED rows with
// unit=PERCENT route key=resource name to RESOURCE_DELTA_PERCENT (raw signed percent,
// never multiplied by duration; ABS rows keep RESOURCE_DELTA; unsigned percent rows stay
// PENDING_DIRECTION_PROJECTION upstream in the adapter and never reach the compiler);
// SUMMON_WINDOW rows route
// summon.count/summon.strength/summon.duration (wrong unit => UNKNOWN with row fact id),
// summon.inheritRatio maps to no feature code and only counts OUTSIDE_BATCH1_ROW_COUNT;
// the summon family block (all three codes) is emitted per activating sourceEffectId
// (routed row or projectionFamilies 召唤生成 entry); mechanicMetadataEntries (closed entries
// array, one per effect instance) / projectionFamilies root inputs are closed audit/
// routing-only bridges (per-prototype key subsets per PDA rev5Spec, values never enter
// features, prototype names never weighted => PROTOTYPE_NAME_WEIGHTING_REJECTED);
// SUMMON_WINDOW scheduledFacts entries carry grantType/召唤单位类型/召唤物名称/行动模式/
// durationTurns and count into OUTSIDE with entryId in sourceEventIds; scheduled windows
// never become KNOWN SUMMON_DURATION; formal caps (256 features / 128 rows / 64 modifier
// entries / 200000 work units) throw CAP_EXCEEDED as whole-compile rejections. Revision 2
// semantics stay (identity/sides/cost/
// hitCheckApplicability/STATE_PRESENCE {0,1}/29 raw features base, no normalization
// constants, no weights, no Decision/Preview/Provider invocation, no future-route/
// world-clone/result enumeration, no Runtime/loader wiring).
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var REVISION = 17;
  var REGISTRY_ID = 'RC6-M2-BEHAVIOR-IMMEDIATE-FEATURE-V1-2026-08-14';
  var SCHEMA_VERSION = 'BehaviorImmediateFeatureV1';
  var F0 = 14;

  var CAPS = {
    MAX_FEATURES_PER_CANDIDATE: 256,
    MAX_FACT_ROWS_PER_CANDIDATE: 128,
    MAX_MODIFIER_ENTRIES_PER_CANDIDATE: 64,
    MAX_WORK_UNITS_PER_CALL: 200000,
    fixedCandidateFeatureCount: F0
  };

  var FEATURE_CODES = [
    'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE', 'SUCCESS_PROBABILITY',
    'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY',
    'REVEAL_STRENGTH', 'OVERKILL_AVAILABILITY', 'HARD_EXCLUSION',
    'HARD_EXCLUSION_REASON', 'SETTLEMENT_DAMAGE', 'ROLL_REALIZATION',
    'OUTSIDE_BATCH1_ROW_COUNT', 'DAMAGE_POWER', 'DAMAGE_SEGMENTS',
    'DAMAGE_PENETRATION', 'DAMAGE_TYPE', 'RESOURCE_DELTA', 'SHIELD_DELTA',
    'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'STATE_PRESENCE', 'STATE_DURATION',
    'STATE_DELTA_PERCENT', 'SETTLEMENT_MODIFIER_PERCENT', 'SUMMON_COUNT',
    'SUMMON_STRENGTH', 'SUMMON_DURATION', 'RESOURCE_DELTA_PERCENT',
    'PUBLIC_RECIPIENT_NEED_MATCH', 'TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME',
    'REACTION_DAMAGE_MULTIPLIER', 'REACTION_DODGE_PROBABILITY', 'REACTION_COUNTER_WINDOW_OPEN'
  ];
  // PUBLIC_RECIPIENT_NEED_MATCH is candidate-scope and lives at frozen position 29;
  // positions 0-28 stay unchanged, so the candidate block is explicit. The two
  // TARGET_CHARGE_* codes live at frozen positions 30/31 as per-target row facts
  // (one row per declared target in targetSet declaration order).
  var CANDIDATE_CODES = FEATURE_CODES.slice(0, 13).concat([
    'PUBLIC_RECIPIENT_NEED_MATCH', 'REACTION_DAMAGE_MULTIPLIER',
    'REACTION_DODGE_PROBABILITY', 'REACTION_COUNTER_WINDOW_OPEN'
  ]);
  var ROW_CODES = FEATURE_CODES.slice(13, 29).concat(['TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME']);

  var UNIT_FAMILY = {
    'RELATION_TARGET_COUNT': 'COUNT',
    'RELATION_TARGET_SIDE': 'ENUM',
    'SUCCESS_PROBABILITY': 'PROBABILITY_0_1',
    'PUBLIC_HP_RATIO': 'RATIO_0_1',
    'PUBLIC_RESOURCE_RATIO': 'RATIO_0_1',
    'COST_AFFORDABILITY': 'RATIO_0_1',
    'REVEAL_STRENGTH': 'RATIO_0_1',
    'OVERKILL_AVAILABILITY': 'BOOL',
    'HARD_EXCLUSION': 'BOOL',
    'HARD_EXCLUSION_REASON': 'ENUM',
    'SETTLEMENT_DAMAGE': 'ABS',
    'ROLL_REALIZATION': 'BOOL',
    'OUTSIDE_BATCH1_ROW_COUNT': 'COUNT',
    'DAMAGE_POWER': 'POWER',
    'DAMAGE_SEGMENTS': 'COUNT',
    'DAMAGE_PENETRATION': 'PERCENT',
    'DAMAGE_TYPE': 'BOOL',
    'RESOURCE_DELTA': 'ABS',
    'SHIELD_DELTA': 'ABS',
    'ATTRIBUTE_DELTA': 'PERCENT',
    'JUDGMENT_DELTA': 'PERCENT',
    'STATE_PRESENCE': 'BOOL',
    'STATE_DURATION': 'TURNS',
    'STATE_DELTA_PERCENT': 'PERCENT',
    'SETTLEMENT_MODIFIER_PERCENT': 'PERCENT',
    'SUMMON_COUNT': 'COUNT',
    'SUMMON_STRENGTH': 'RATIO',
    'SUMMON_DURATION': 'TURNS',
    'RESOURCE_DELTA_PERCENT': 'PERCENT',
    'PUBLIC_RECIPIENT_NEED_MATCH': 'RATIO_0_1',
    'TARGET_CHARGE_ACTIVE': 'BOOL',
    'TARGET_CHARGE_CAST_TIME': 'TURNS',
    'REACTION_DAMAGE_MULTIPLIER': 'RATIO_0_1',
    'REACTION_DODGE_PROBABILITY': 'PROBABILITY_0_1',
    'REACTION_COUNTER_WINDOW_OPEN': 'BOOL'
  };
  var BOOL_CODES = ['OVERKILL_AVAILABILITY', 'HARD_EXCLUSION', 'DAMAGE_TYPE', 'STATE_PRESENCE', 'TARGET_CHARGE_ACTIVE', 'REACTION_COUNTER_WINDOW_OPEN'];

  var ATTRIBUTE_KEYS = ['力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限'];
  var JUDGMENT_KEYS = ['命中', '闪避', '反应'];
  var RESOURCE_FIELD = { '魂力': 'sp', '精神力': 'men', '体力': 'vit', '生命': 'hp' };
  var RESOURCE_NAMES = ['魂力', '精神力', '体力', '生命'];
  var UNIT_ENUM = ['POWER', 'ABS', 'PERCENT', 'RATIO', 'COUNT', 'TURNS', 'DISTANCE', 'BOOL'];
  var FACT_TYPE_ENUM = [
    'HP_DELTA', 'RESOURCE_OPTION_CHANGED', 'SHIELD_DELTA', 'STATE_DELTA',
    'SCHEDULED_HP_DELTA', 'SUMMON_WINDOW', 'RESOURCE_TRANSFER', 'RULE_DEFENSE_COUNTER',
    'POSITION_DELTA', 'COPY_EXECUTION', 'TIME_REWIND'
  ];
  var SYMBOLIC_TARGETS = ['自身', '单体', '群体', '全场', '召唤物', '目标', 'target', 'actor', 'self'];
  var HARD_EXCLUSION_CODES = [
    'ACTOR_DISABLED', 'ACTOR_TERMINAL', 'TARGET_EMPTY', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_STATE', 'UNKNOWN_RULE', 'AMBIGUOUS_TAUNT_TARGET',
    'ILLEGAL_TARGET', 'RESOURCE_INSUFFICIENT'
  ];
  var UNKNOWN_REASONS = [
    'NO_PUBLIC_DECLARATION', 'CONDITIONAL_PROBABILITY_UNRESOLVED', 'FINAL_SETTLEMENT_UNKNOWN',
    'FUTURE_REALIZATION_UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', 'MISSING_SOURCE_FACT',
    'SIDE_UNOBSERVED', 'STATE_FORM_UNMAPPED', 'CONFLICTING_DELIVERIES', 'NON_FINITE_DELIVERY',
    'SOURCE_PROVENANCE_INCOMPLETE'
  ];
  var NA_REASONS = ['NO_TARGET_AXIS', 'NO_HIT_AXIS', 'NO_PUBLIC_COST', 'NOT_EXCLUDED', 'NO_DURATION'];
  var HIT_APPLICABILITY = ['APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN'];
  var ACTOR_STATUSES = ['NORMAL', 'DISABLED', 'TERMINAL', 'UNKNOWN'];

  var BATCH1_FAMILY = {
    '伤害结算': ['DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE'],
    '资源变化': ['RESOURCE_DELTA'],
    '护盾变化': ['SHIELD_DELTA'],
    '属性修正': ['ATTRIBUTE_DELTA', 'STATE_DURATION'],
    '判定修正': ['JUDGMENT_DELTA', 'STATE_DURATION'],
    '状态施加/状态移除': ['STATE_PRESENCE', 'STATE_DURATION']
  };
  var BATCH2_FAMILY = {
    '状态施加': ['STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT'],
    '召唤生成': ['SUMMON_COUNT', 'SUMMON_STRENGTH', 'SUMMON_DURATION'],
    '结算修正': ['SETTLEMENT_MODIFIER_PERCENT']
  };
  // projectionFamilies prototype legitimacy is attested at runtime: the authoritative
  // 27-name registry is carried in input.prototypeRegistry (read-only PDA registry
  // attestation carrier stamped by BehaviorCandidateFeatureBridge_Module). No
  // hardcoded prototype name list lives in this module; unknown names and registry
  // hash/sourceContractHash drift fail closed; new prototypes auto-adopt.
  var MECHANIC_METADATA_CLOSED_KEYS = [
    'sourceEffectId', '生效方式', '结算标签', '抗性类型', '驱动属性', '影响方向',
    '对应等级', '触发方式', '触发限制', '结算', '限定元素', '吸收资源', '吸收来源'
  ];
  var MECHANIC_METADATA_SUBSETS = {
    '伤害结算': ['生效方式', '结算标签', '抗性类型', '对应等级'],
    '资源变化': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '护盾变化': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '属性修正': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '判定修正': ['生效方式', '驱动属性', '影响方向', '对应等级'],
    '状态施加': ['生效方式', '驱动属性', '影响方向', '对应等级', '触发方式'],
    '召唤生成': ['生效方式', '触发限制'],
    '结算修正': ['生效方式', '结算', '限定元素', '吸收资源', '吸收来源', '影响方向', '驱动属性', '对应等级']
  };

  var FORBIDDEN_SOURCE_CODE = {
    'ROUTE': 'ROUTE_INPUT_REJECTED',
    'WORLD_CLONE': 'WORLD_CLONE_REJECTED',
    'RESULT_WORLD': 'RESULT_WORLD_CARTESIAN_REJECTED',
    'HIDDEN': 'HIDDEN_INPUT_REJECTED',
    'WALL_CLOCK': 'WALL_CLOCK_REJECTED',
    'SKILL_ROLE_NAME': 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
    'TEACHER': 'TEACHER_INPUT_REJECTED',
    'PROTOTYPE_NAME_WEIGHTING': 'PROTOTYPE_NAME_WEIGHTING_REJECTED'
  };
  var FORBIDDEN_TOP_KEY = {
    'route': 'ROUTE_INPUT_REJECTED',
    'worldClone': 'WORLD_CLONE_REJECTED',
    'resultWorld': 'RESULT_WORLD_CARTESIAN_REJECTED',
    'hidden': 'HIDDEN_INPUT_REJECTED',
    'wallClock': 'WALL_CLOCK_REJECTED',
    'skillRoleName': 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
    'teacher': 'TEACHER_INPUT_REJECTED',
    'kernelRouteValue': 'ROUTE_INPUT_REJECTED',
    'prototypeNameWeighting': 'PROTOTYPE_NAME_WEIGHTING_REJECTED'
  };

  var INPUT_KEYS = [
    'candidate', 'publicSnapshot', 'atomicFacts', 'directFacts', 'legalityFlags',
    'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'publicCost',
    'publicProbability', 'publicDeclarations', 'forbiddenFacts', 'branchCombination',
    'preMultiplied', 'mechanicMetadataEntries', 'projectionFamilies', 'prototypeRegistry',
    'creationProfile', 'actionOpportunity'
  ];
  var CANDIDATE_KEYS = ['candidateId', 'actorId', 'actorSide', 'actionKind', 'targetSet', 'paymentMode'];
  var ACTION_OPPORTUNITY_KEYS = ['role', 'sourceActorId', 'incomingAction', 'actionContext', 'counterWindow', 'reactionMechanics'];
  var REACTION_MECHANICS_KEYS = [
    'candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId',
    'targetId', 'prepared', 'damageMultiplier', 'dodgeProbability',
    'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'
  ];
  var REACTION_RESPONSE_KINDS = ['PASS_OPPORTUNITY', 'DEFEND', 'EVADE'];
  var SNAPSHOT_KEYS = ['units', 'sides', 'actorStatus'];
  var UNIT_FIELDS = ['hp', 'hp_max', 'sp', 'sp_max', 'men', 'men_max', 'vit', 'vit_max', 'def', 'agi', 'shield', '状态效果', '蓄力技能'];
  var NUMERIC_UNIT_FIELDS = ['hp', 'hp_max', 'sp', 'sp_max', 'men', 'men_max', 'vit', 'vit_max', 'def', 'agi', 'shield'];
  // R4b2 delivery identity: HP_DELTA atomic rows carry effectInstanceId/targetId
  // (transcribed by the bridge from preview contribution identity) plus the
  // decision-visible damageBasis.basisView attestation inside evidence.
  var ATOMIC_KEYS = ['eventId', 'sourceActionId', 'outcomeKind', 'expectedDelta', 'hitCheckApplicability', 'evidence', 'effectInstanceId', 'targetId'];
  var EVIDENCE_KEYS = ['hitProbability', 'damageBasis', 'deliveryStatus'];
  var ROW_KEYS = ['schemaVersion', 'factType', 'key', 'sourceActionId', 'sourceActorId', 'sourceEffectId', 'targetIds', 'amount', 'unit', 'durationTurns'];
  var LM_KEYS = ['judgmentRates', 'taunt', 'tauntRemoved', 'stateMigration', 'stateSwap', 'mechanismRemoval', 'hardExclusions', 'legalityFlags'];
  var OM_KEYS = ['resourceLocks', 'opportunityConstraints', 'interferenceRates', 'dependencyTokens'];
  var SCHED_SHAPES = {
    WINDOW_ADJUST: ['entryId', 'operation', '调整字段', '调整方式', '调整回合', '调整tick', '调整次数', '结算倍率'],
    SETTLEMENT_RATIO_ADJUST: ['entryId', 'operation', '结算倍率'],
    FOLLOW_UP: ['entryId', 'grantType', 'ownerId', 'followUpKey', 'triggerKey', 'maxActions', 'payloadDirectFacts'],
    SUMMON_WINDOW: ['entryId', 'grantType', '召唤单位类型', '召唤物名称', '行动模式', 'durationTurns']
  };
  var TRIGGER_ENUM = ['主动触发', '随下次行动触发'];
  var COST_KEYS = ['resource', 'amount'];
  var DECL_KEYS = ['revealStrength', 'declaredOverkill'];
  var FORBIDDEN_FACT_KEYS = ['source', 'fact'];
  var CREATION_PROFILE_KEYS = ['recipientId', 'useEffects'];
  var CREATION_PROFILE_ROW_KEYS = ['原型', '目标', '资源', '数值'];

  var CONTRACT_HASHES = {
    featureContract: '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76',
    featureSchema: 'b6cb71713d6777a543a44de5d7bd4c540d5bacf18259a49c6eee4451cd2ecf49',
    featureCases: '4a9e04d18c75eb9ef94a515a6acf8b9eada42cf4829bce17adfd6c7814141e55',
    policyContract: '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8',
    policySchema: '3015adf1a25c5d048c7739fcba8e4ae68d5bf995b4f5f42bb1a2d8b324f5b07e',
    governed: {
      provider: 'cc32c251236906c5e128164f76a25a1196ebe089ef7903edb454e3374a90f156',
      adapterContract: '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
      adapterSchema: '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
      adapterCases: '1c50e3e7eea834ed2317526dc647856c74aeff528e939855af8b92be25ae3f1c',
      directFactRow: '493a7f938ef380d0be2e4f581ec2859c9e5dc4a96eede5909a8fcad74a657917'
    }
  };
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isPlainObject(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    var proto = Object.getPrototypeOf(o);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      hasOwn(proto, 'constructor') && proto.constructor && proto.constructor.name === 'Object');
  }
  function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function normZero(v) { return v === 0 ? 0 : v; }
  function toFiniteNumber(x, where) {
    var n = (typeof x === 'string') ? Number(x) : x;
    if (typeof n !== 'number' || !isFinite(n)) throw rejection('NON_FINITE_REJECTED', { field: where, raw: String(x) });
    return n === 0 ? 0 : n;
  }
  function rejection(code, detail) {
    var e = new Error(code + (detail ? ' :: ' + JSON.stringify(detail) : ''));
    e.code = code;
    e.reasonCode = code;
    e.detail = detail === undefined ? null : detail;
    return e;
  }
  function dedupSort(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i += 1) if (out.indexOf(arr[i]) < 0) out.push(arr[i]);
    out.sort(cmpStr);
    return out;
  }
  // Deterministic sandbox-safe hash (FNV-1a 32-bit over UTF-16 code units of the
  // canonical JSON {"prototypeNames":[...]}). Verifies the PDA registry attestation
  // carrier inside prototypeRegistry; production sandboxes have no crypto, so the
  // file-level SHA-256 anchors stay harness-side.
  function fnv1a32Hex(names) {
    var s = '{"prototypeNames":[';
    for (var i = 0; i < names.length; i += 1) {
      if (i > 0) s += ',';
      s += JSON.stringify(names[i]);
    }
    s += ']}';
    var h = 0x811c9dc5;
    for (var j = 0; j < s.length; j += 1) {
      h ^= s.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    var hex = h.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex;
  }
  function freezeDeep(v) {
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i += 1) freezeDeep(v[i]);
      Object.freeze(v);
    } else if (v && typeof v === 'object') {
      for (var k in v) if (hasOwn(v, k)) freezeDeep(v[k]);
      Object.freeze(v);
    }
    return v;
  }
  function rec(code, family, status, reason, value, factIds, eventIds, scopeRank, seid, key) {
    var f = {
      featureCode: code,
      unitFamily: family,
      status: status,
      reasonCode: reason,
      sourceFactIds: factIds.slice(),
      sourceEventIds: dedupSort(eventIds || []),
      _scopeRank: scopeRank,
      _seid: seid,
      _key: key
    };
    if (status === 'KNOWN') f.value = normZero(value);
    return f;
  }
  function known(code, family, value) { return rec(code, family, 'KNOWN', 'OK', value, [], [], 0, '', ''); }
  function knownStr(code, family, value) { return rec(code, family, 'KNOWN', 'OK', value, [], [], 0, '', ''); }
  function unk(code, family, reason, factIds, eventIds) { return rec(code, family, 'UNKNOWN', reason, undefined, factIds || [], eventIds || [], 0, '', ''); }
  function na(code, family, reason) { return rec(code, family, 'NOT_APPLICABLE', reason, undefined, [], [], 0, '', ''); }
  function freshMetrics() {
    return { calls: 0, workUnitsTotal: 0, lastWorkUnits: 0, lastCandidateId: null, lastFeatureCount: 0, rejections: {}, lastRejection: null };
  }
  function rejectUnknownKeys(obj, allowed, field) {
    for (var k in obj) {
      if (hasOwn(obj, k) && allowed.indexOf(k) < 0) throw rejection('INVALID_OPTION_VALUE', { field: field, extraKey: k });
    }
  }
  function validateIdString(v, field) {
    if (typeof v !== 'string' || v.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: field });
    if (v.length > 512 || /[\u0000-\u001F\u007F]/.test(v)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    return v;
  }
  function checkForbiddenInput(input) {
    if (input.branchCombination === true) throw rejection('BRANCH_COMBINATION_FORBIDDEN');
    if (input.preMultiplied !== undefined) throw rejection('DURATION_MULTIPLIES_MAGNITUDE');
    if (Array.isArray(input.forbiddenFacts)) {
      for (var i = 0; i < input.forbiddenFacts.length; i += 1) {
        var f = input.forbiddenFacts[i];
        if (!f || typeof f !== 'object') throw rejection('UNKNOWN_FEATURE_CODE', { source: String(f) });
        rejectUnknownKeys(f, FORBIDDEN_FACT_KEYS, 'forbiddenFacts[]');
        var code = FORBIDDEN_SOURCE_CODE[f.source];
        if (!code) throw rejection('UNKNOWN_FEATURE_CODE', { source: String(f.source) });
        throw rejection(code, { source: f.source });
      }
    }
    for (var k in FORBIDDEN_TOP_KEY) {
      if (hasOwn(FORBIDDEN_TOP_KEY, k) && input[k] !== undefined) throw rejection(FORBIDDEN_TOP_KEY[k], { key: k });
    }
  }

  function validateTopLevelKeys(input) {
    rejectUnknownKeys(input, INPUT_KEYS, 'input');
  }

  function validateCandidate(input) {
    var cand = input.candidate;
    if (!cand || typeof cand !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate' });
    rejectUnknownKeys(cand, CANDIDATE_KEYS, 'candidate');
    for (var i = 0; i < CANDIDATE_KEYS.length; i += 1) {
      if (cand[CANDIDATE_KEYS[i]] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate.' + CANDIDATE_KEYS[i] });
    }
    validateIdString(cand.candidateId, 'candidate.candidateId');
    validateIdString(cand.actorId, 'candidate.actorId');
    validateIdString(cand.actorSide, 'candidate.actorSide');
    validateIdString(cand.actionKind, 'candidate.actionKind');
    validateIdString(cand.paymentMode, 'candidate.paymentMode');
    if (!Array.isArray(cand.targetSet)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate.targetSet' });
    var seen = {};
    for (var t = 0; t < cand.targetSet.length; t += 1) {
      var tid = cand.targetSet[t];
      if (typeof tid !== 'string' || tid.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'candidate.targetSet[' + t + ']' });
      if (tid.length > 512 || /[\u0000-\u001F\u007F]/.test(tid)) throw rejection('INVALID_OPTION_VALUE', { field: 'candidate.targetSet[' + t + ']' });
      if (hasOwn(seen, tid)) throw rejection('INVALID_OPTION_VALUE', { field: 'candidate.targetSet', duplicate: tid });
      seen[tid] = true;
    }
  }

  function validateReactionRefs(value, field) {
    if (!Array.isArray(value)) throw rejection('MISSING_SOURCE_REFERENCE', { field: field });
    var seen = {};
    for (var i = 0; i < value.length; i += 1) {
      validateIdString(value[i], field + '[' + i + ']');
      if (hasOwn(seen, value[i])) throw rejection('INVALID_OPTION_VALUE', { field: field, duplicate: value[i] });
      seen[value[i]] = true;
    }
  }

  function sameReactionRefs(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every(function (value, index) { return value === right[index]; });
  }

  function validateActionContext(value, field) {
    if (value === undefined) return undefined;
    if (!isPlainObject(value)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    rejectUnknownKeys(value, ['actionEvent', 'targetResolutionEvent'], field);
    var actionEvent = value.actionEvent;
    if (!isPlainObject(actionEvent)) throw rejection('MISSING_SOURCE_REFERENCE', { field: field + '.actionEvent' });
    rejectUnknownKeys(actionEvent, ['actionId', 'eventId'], field + '.actionEvent');
    validateIdString(actionEvent.actionId, field + '.actionEvent.actionId');
    validateIdString(actionEvent.eventId, field + '.actionEvent.eventId');
    var normalized = { actionEvent: { actionId: actionEvent.actionId, eventId: actionEvent.eventId } };
    if (value.targetResolutionEvent !== undefined) {
      var targetEvent = value.targetResolutionEvent;
      if (!isPlainObject(targetEvent)) throw rejection('INVALID_OPTION_VALUE', { field: field + '.targetResolutionEvent' });
      rejectUnknownKeys(targetEvent, ['eventId'], field + '.targetResolutionEvent');
      validateIdString(targetEvent.eventId, field + '.targetResolutionEvent.eventId');
      normalized.targetResolutionEvent = { eventId: targetEvent.eventId };
    }
    return normalized;
  }

  function contextRefs(context) {
    var ids = [context.actionEvent.eventId];
    if (context.targetResolutionEvent && context.targetResolutionEvent.eventId !== context.actionEvent.eventId) {
      ids.push(context.targetResolutionEvent.eventId);
    }
    return { sourceActionId: context.actionEvent.actionId, sourceFactIds: ids.slice(), sourceEventIds: ids.slice() };
  }

  function validateActionOpportunity(input) {
    var opportunity = input.actionOpportunity;
    if (opportunity === undefined) return;
    if (!isPlainObject(opportunity)) throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity' });
    rejectUnknownKeys(opportunity, ACTION_OPPORTUNITY_KEYS, 'actionOpportunity');
    validateIdString(opportunity.role, 'actionOpportunity.role');
    if (opportunity.sourceActorId !== undefined) validateIdString(opportunity.sourceActorId, 'actionOpportunity.sourceActorId');
    if (opportunity.counterWindow !== undefined && typeof opportunity.counterWindow !== 'boolean') {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.counterWindow' });
    }
    var actionContext = validateActionContext(opportunity.actionContext, 'actionOpportunity.actionContext');
    var incoming = opportunity.incomingAction;
    if (incoming !== undefined && incoming !== null) {
      if (!isPlainObject(incoming)) throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.incomingAction' });
      if (hasOwn(incoming, 'reactionMechanics') || hasOwn(incoming, 'damageMultiplier') || hasOwn(incoming, 'dodgeProbability')) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.incomingAction' });
      }
      validateIdString(incoming.sourceActionId, 'actionOpportunity.incomingAction.sourceActionId');
    }
    if (actionContext) {
      var refs = contextRefs(actionContext);
      if (!incoming || !sameReactionRefs(incoming.sourceFactIds, refs.sourceFactIds) ||
        !sameReactionRefs(incoming.sourceEventIds, refs.sourceEventIds) || incoming.sourceActionId !== refs.sourceActionId) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.identity' });
      }
    }
    var mechanics = opportunity.reactionMechanics;
    if (!isPlainObject(mechanics)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'actionOpportunity.reactionMechanics' });
    rejectUnknownKeys(mechanics, REACTION_MECHANICS_KEYS, 'actionOpportunity.reactionMechanics');
    var required = ['candidateId', 'responseKind', 'status', 'reason', 'sourceActionId', 'sourceActorId', 'targetId', 'prepared', 'visibleWorldRevision', 'requestHash', 'sourceFactIds', 'sourceEventIds'];
    for (var r = 0; r < required.length; r += 1) {
      if (mechanics[required[r]] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'actionOpportunity.reactionMechanics.' + required[r] });
    }
    validateIdString(mechanics.candidateId, 'actionOpportunity.reactionMechanics.candidateId');
    validateIdString(mechanics.sourceActionId, 'actionOpportunity.reactionMechanics.sourceActionId');
    validateIdString(mechanics.sourceActorId, 'actionOpportunity.reactionMechanics.sourceActorId');
    validateIdString(mechanics.targetId, 'actionOpportunity.reactionMechanics.targetId');
    validateIdString(mechanics.visibleWorldRevision, 'actionOpportunity.reactionMechanics.visibleWorldRevision');
    validateIdString(mechanics.requestHash, 'actionOpportunity.reactionMechanics.requestHash');
    validateReactionRefs(mechanics.sourceFactIds, 'actionOpportunity.reactionMechanics.sourceFactIds');
    validateReactionRefs(mechanics.sourceEventIds, 'actionOpportunity.reactionMechanics.sourceEventIds');
    if (REACTION_RESPONSE_KINDS.indexOf(mechanics.responseKind) < 0 || (mechanics.status !== 'KNOWN' && mechanics.status !== 'UNKNOWN')) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics' });
    }
    if (mechanics.prepared !== true || mechanics.candidateId !== input.candidate.candidateId ||
      mechanics.targetId !== input.candidate.actorId || mechanics.responseKind !== input.candidate.actionKind ||
      mechanics.sourceActorId !== opportunity.sourceActorId || !incoming || mechanics.sourceActionId !== incoming.sourceActionId ||
      input.candidate.targetSet.indexOf(mechanics.targetId) < 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.identity' });
    }
    if (actionContext) {
      var contextIdentity = contextRefs(actionContext);
      if (mechanics.sourceActionId !== contextIdentity.sourceActionId ||
        !sameReactionRefs(mechanics.sourceFactIds, contextIdentity.sourceFactIds) ||
        !sameReactionRefs(mechanics.sourceEventIds, contextIdentity.sourceEventIds)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.actionContext.reactionMechanics' });
      }
    }
    if (mechanics.status === 'KNOWN') {
      if (mechanics.reason !== 'OK' || !isFinite(mechanics.damageMultiplier) || mechanics.damageMultiplier < 0 || mechanics.damageMultiplier > 1 ||
        !isFinite(mechanics.dodgeProbability) || mechanics.dodgeProbability < 0 || mechanics.dodgeProbability > 1) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.values' });
      }
      if (mechanics.responseKind === 'PASS_OPPORTUNITY' && (mechanics.damageMultiplier !== 1 || mechanics.dodgeProbability !== 0)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.PASS_OPPORTUNITY' });
      }
    } else {
      if (hasOwn(mechanics, 'damageMultiplier') || hasOwn(mechanics, 'dodgeProbability') || UNKNOWN_REASONS.indexOf(mechanics.reason) < 0) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'actionOpportunity.reactionMechanics.UNKNOWN' });
      }
    }
  }

  function validateSnapshot(input) {
    var snap = input.publicSnapshot;
    if (!snap || typeof snap !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot' });
    rejectUnknownKeys(snap, SNAPSHOT_KEYS, 'publicSnapshot');
    for (var i = 0; i < SNAPSHOT_KEYS.length; i += 1) {
      if (snap[SNAPSHOT_KEYS[i]] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.' + SNAPSHOT_KEYS[i] });
    }
    if (ACTOR_STATUSES.indexOf(snap.actorStatus) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'publicSnapshot.actorStatus', value: String(snap.actorStatus) });
    var units = snap.units;
    if (typeof units !== 'object' || units === null || Array.isArray(units)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.units' });
    for (var uid in units) if (hasOwn(units, uid)) {
      var u = units[uid];
      if (!u || typeof u !== 'object' || Array.isArray(u)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.units.' + uid });
      rejectUnknownKeys(u, UNIT_FIELDS, 'publicSnapshot.units.' + uid);
      for (var f = 0; f < NUMERIC_UNIT_FIELDS.length; f += 1) {
        var fn = NUMERIC_UNIT_FIELDS[f];
        if (u[fn] !== undefined) toFiniteNumber(u[fn], 'units.' + uid + '.' + fn);
      }
      if (u['状态效果'] !== undefined && (typeof u['状态效果'] !== 'object' || u['状态效果'] === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'units.' + uid + '.状态效果' });
      var chargeField = u['蓄力技能'];
      if (chargeField !== undefined && chargeField !== null && (typeof chargeField !== 'object' || Array.isArray(chargeField))) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'units.' + uid + '.蓄力技能' });
      }
    }
    var sides = snap.sides;
    if (typeof sides !== 'object' || sides === null || Array.isArray(sides)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.sides' });
    for (var sid in sides) if (hasOwn(sides, sid)) {
      var sv = sides[sid];
      if (typeof sv !== 'string' || sv.length === 0 || sv.length > 512) throw rejection('INVALID_OPTION_VALUE', { field: 'publicSnapshot.sides.' + sid });
    }
    if (!hasOwn(sides, input.candidate.actorId) || sides[input.candidate.actorId] !== input.candidate.actorSide) {
      throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicSnapshot.sides.actorId', actorSide: input.candidate.actorSide });
    }
  }

  function validateAtomicFacts(input) {
    var facts = input.atomicFacts;
    if (facts === undefined) return;
    if (!Array.isArray(facts)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts' });
    for (var i = 0; i < facts.length; i += 1) {
      var f = facts[i];
      if (!f || typeof f !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[' + i + ']' });
      rejectUnknownKeys(f, ATOMIC_KEYS, 'atomicFacts[]');
      validateIdString(f.eventId, 'atomicFacts[].eventId');
      if (HIT_APPLICABILITY.indexOf(f.hitCheckApplicability) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].hitCheckApplicability', value: String(f.hitCheckApplicability) });
      if (f.expectedDelta !== undefined) toFiniteNumber(f.expectedDelta, 'atomicFacts.expectedDelta');
      if (f.sourceActionId !== undefined && (typeof f.sourceActionId !== 'string' || f.sourceActionId.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].sourceActionId' });
      if (f.outcomeKind !== undefined && (typeof f.outcomeKind !== 'string' || f.outcomeKind.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].outcomeKind' });
      if (f.effectInstanceId !== undefined) validateIdString(f.effectInstanceId, 'atomicFacts[].effectInstanceId');
      if (f.targetId !== undefined) validateIdString(f.targetId, 'atomicFacts[].targetId');
      if (f.hitCheckApplicability === 'APPLICABLE') {
        if (!f.evidence || typeof f.evidence !== 'object') {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].evidence.hitProbability' });
        }
        if (f.evidence.deliveryStatus !== undefined && f.evidence.deliveryStatus !== null) {
          if (['MISSING', 'NON_FINITE'].indexOf(f.evidence.deliveryStatus) < 0) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.deliveryStatus', value: String(f.evidence.deliveryStatus) });
          }
          if (f.evidence.deliveryStatus === 'MISSING' && f.evidence.hitProbability !== undefined) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.deliveryStatus', value: 'MISSING_WITH_PROBABILITY' });
          }
          if (f.evidence.deliveryStatus === 'NON_FINITE' && f.evidence.hitProbability !== undefined) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.deliveryStatus', value: 'NON_FINITE_WITH_PROBABILITY' });
          }
        } else if (f.evidence.hitProbability === undefined) {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'atomicFacts[].evidence.hitProbability' });
        } else {
          toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability');
        }
      } else if (f.evidence !== undefined) {
        if (typeof f.evidence !== 'object' || f.evidence === null) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence' });
        rejectUnknownKeys(f.evidence, EVIDENCE_KEYS, 'atomicFacts[].evidence');
        if (f.evidence.hitProbability !== undefined) toFiniteNumber(f.evidence.hitProbability, 'atomicFacts.evidence.hitProbability');
      }
      if (f.evidence && typeof f.evidence === 'object' && f.evidence.damageBasis !== undefined) {
        var db = f.evidence.damageBasis;
        if (!db || typeof db !== 'object' || Array.isArray(db)) throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.damageBasis' });
        if (typeof db.basisView !== 'string' || ['DECISION_VISIBLE', 'BELIEF', 'RUNTIME_ACTUAL'].indexOf(db.basisView) < 0) {
          throw rejection('INVALID_OPTION_VALUE', { field: 'atomicFacts[].evidence.damageBasis.basisView', value: String(db && db.basisView) });
        }
      }
    }
  }

  function validateDirectFactsRows(input) {
    var rows = input.directFacts;
    if (rows === undefined) return;
    if (!Array.isArray(rows)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts' });
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (!row || typeof row !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[' + i + ']' });
      rejectUnknownKeys(row, ROW_KEYS, 'directFacts[]');
      if (row.schemaVersion !== 'DirectFactRowV1') throw rejection('INVALID_OPTION_VALUE', { field: 'directFacts[].schemaVersion', value: String(row.schemaVersion) });
      if (typeof row.factType !== 'string' || FACT_TYPE_ENUM.indexOf(row.factType) < 0) throw rejection('UNKNOWN_FEATURE_CODE', { field: 'directFacts[].factType', value: String(row.factType) });
      if (typeof row.key !== 'string') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].key' });
      if (typeof row.sourceActionId !== 'string' || row.sourceActionId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceActionId' });
      if (typeof row.sourceActorId !== 'string' || row.sourceActorId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceActorId' });
      if (row.sourceActorId !== input.candidate.actorId) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceActorId', actorId: input.candidate.actorId });
      if (typeof row.sourceEffectId !== 'string' || row.sourceEffectId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].sourceEffectId' });
      if (typeof row.unit !== 'string' || UNIT_ENUM.indexOf(row.unit) < 0) throw rejection('UNKNOWN_UNIT_FAMILY', { field: 'directFacts[].unit', value: String(row.unit) });
      if (row.amount === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].amount' });
      toFiniteNumber(row.amount, 'directFacts.amount');
      if (row.durationTurns === undefined || row.durationTurns === null) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].durationTurns' });
      var dur = toFiniteNumber(row.durationTurns, 'directFacts.durationTurns');
      if (dur < 0 || Math.floor(dur) !== dur) throw rejection('INVALID_OPTION_VALUE', { field: 'directFacts[].durationTurns', value: dur });
      if (!Array.isArray(row.targetIds) || row.targetIds.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].targetIds' });
      for (var j = 0; j < row.targetIds.length; j += 1) {
        var t = row.targetIds[j];
        if (typeof t !== 'string' || t.length === 0 || SYMBOLIC_TARGETS.indexOf(t) >= 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'directFacts[].targetIds', value: String(t) });
      }
    }
  }

  function validateLegalityCodeArray(arr, field) {
    if (!Array.isArray(arr)) throw rejection('INVALID_OPTION_VALUE', { field: field });
    for (var i = 0; i < arr.length; i += 1) {
      if (HARD_EXCLUSION_CODES.indexOf(arr[i]) < 0) throw rejection('INVALID_OPTION_VALUE', { field: field, value: String(arr[i]) });
    }
  }

  function validateLegalityFlags(input) {
    if (input.legalityFlags !== undefined) validateLegalityCodeArray(input.legalityFlags, 'legalityFlags');
  }

  function validateLegalityModifiers(input) {
    var lm = input.legalityModifiers;
    if (lm === undefined) return;
    if (typeof lm !== 'object' || lm === null || Array.isArray(lm)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'legalityModifiers' });
    rejectUnknownKeys(lm, LM_KEYS, 'legalityModifiers');
    if (lm.hardExclusions !== undefined) validateLegalityCodeArray(lm.hardExclusions, 'legalityModifiers.hardExclusions');
    if (lm.legalityFlags !== undefined) validateLegalityCodeArray(lm.legalityFlags, 'legalityModifiers.legalityFlags');
    if (lm.judgmentRates !== undefined && !Array.isArray(lm.judgmentRates)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.judgmentRates' });
    if (lm.mechanismRemoval !== undefined && !Array.isArray(lm.mechanismRemoval)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.mechanismRemoval' });
    if (lm.taunt !== undefined && (typeof lm.taunt !== 'object' || lm.taunt === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.taunt' });
    if (lm.tauntRemoved !== undefined && (typeof lm.tauntRemoved !== 'object' || lm.tauntRemoved === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.tauntRemoved' });
    if (lm.stateMigration !== undefined && (typeof lm.stateMigration !== 'object' || lm.stateMigration === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.stateMigration' });
    if (lm.stateSwap !== undefined && (typeof lm.stateSwap !== 'object' || lm.stateSwap === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'legalityModifiers.stateSwap' });
  }

  function validateOpportunityModifiers(input) {
    var om = input.opportunityModifiers;
    if (om === undefined) return;
    if (typeof om !== 'object' || om === null || Array.isArray(om)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'opportunityModifiers' });
    rejectUnknownKeys(om, OM_KEYS, 'opportunityModifiers');
    if (om.resourceLocks !== undefined && !Array.isArray(om.resourceLocks)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.resourceLocks' });
    if (om.interferenceRates !== undefined && !Array.isArray(om.interferenceRates)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.interferenceRates' });
    if (om.dependencyTokens !== undefined && !Array.isArray(om.dependencyTokens)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.dependencyTokens' });
    if (om.opportunityConstraints !== undefined && (typeof om.opportunityConstraints !== 'object' || om.opportunityConstraints === null)) throw rejection('INVALID_OPTION_VALUE', { field: 'opportunityModifiers.opportunityConstraints' });
  }

  function validateScheduledFacts(input) {
    var sched = input.scheduledFacts;
    if (sched === undefined) return;
    if (!Array.isArray(sched)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts' });
    for (var i = 0; i < sched.length; i += 1) {
      var e = sched[i];
      if (!e || typeof e !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[' + i + ']' });
      if (e.entryId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].entryId' });
      validateIdString(e.entryId, 'scheduledFacts[].entryId');
      var shape = null;
      if (e.operation !== undefined) {
        if (e.operation === 'WINDOW_ADJUST') shape = 'WINDOW_ADJUST';
        else if (e.operation === 'SETTLEMENT_RATIO_ADJUST') shape = 'SETTLEMENT_RATIO_ADJUST';
        else throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].operation', value: String(e.operation) });
      } else if (e.grantType !== undefined) {
        if (e.grantType === 'FOLLOW_UP') shape = 'FOLLOW_UP';
        else if (e.grantType === 'SUMMON_WINDOW') shape = 'SUMMON_WINDOW';
        else throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].grantType', value: String(e.grantType) });
      } else {
        throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[]', detail: 'operation or grantType required' });
      }
      rejectUnknownKeys(e, SCHED_SHAPES[shape], 'scheduledFacts[]');
      if (shape === 'WINDOW_ADJUST') {
        if (typeof e['调整字段'] !== 'string' || e['调整字段'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].调整字段' });
        if (typeof e['调整方式'] !== 'string' || e['调整方式'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].调整方式' });
        var wKeys = ['调整回合', '调整tick', '调整次数'];
        for (var wf = 0; wf < wKeys.length; wf += 1) {
          if (e[wKeys[wf]] !== undefined) {
            var wv = toFiniteNumber(e[wKeys[wf]], 'scheduledFacts[].' + wKeys[wf]);
            if (wv < 0 || Math.floor(wv) !== wv) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].' + wKeys[wf], value: wv });
          }
        }
        if (e['结算倍率'] !== undefined) toFiniteNumber(e['结算倍率'], 'scheduledFacts[].结算倍率');
      } else if (shape === 'SETTLEMENT_RATIO_ADJUST') {
        if (e['结算倍率'] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].结算倍率' });
        toFiniteNumber(e['结算倍率'], 'scheduledFacts[].结算倍率');
      } else if (shape === 'FOLLOW_UP') {
        validateIdString(e.ownerId, 'scheduledFacts[].ownerId');
        validateIdString(e.followUpKey, 'scheduledFacts[].followUpKey');
        if (TRIGGER_ENUM.indexOf(e.triggerKey) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].triggerKey', value: String(e.triggerKey) });
        if (!Array.isArray(e.payloadDirectFacts) || e.payloadDirectFacts.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts' });
        for (var pi = 0; pi < e.payloadDirectFacts.length; pi += 1) {
          var prow = e.payloadDirectFacts[pi];
          if (!prow || typeof prow !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[' + pi + ']' });
          rejectUnknownKeys(prow, ROW_KEYS, 'scheduledFacts[].payloadDirectFacts[]');
          if (prow.schemaVersion !== 'DirectFactRowV1') throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].payloadDirectFacts[].schemaVersion' });
          if (typeof prow.factType !== 'string' || FACT_TYPE_ENUM.indexOf(prow.factType) < 0) throw rejection('UNKNOWN_FEATURE_CODE', { field: 'scheduledFacts[].payloadDirectFacts[].factType' });
          if (typeof prow.key !== 'string') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].key' });
          if (typeof prow.sourceActionId !== 'string' || prow.sourceActionId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].sourceActionId' });
          if (typeof prow.sourceActorId !== 'string' || prow.sourceActorId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].sourceActorId' });
          if (typeof prow.sourceEffectId !== 'string' || prow.sourceEffectId.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].sourceEffectId' });
          if (typeof prow.unit !== 'string' || UNIT_ENUM.indexOf(prow.unit) < 0) throw rejection('UNKNOWN_UNIT_FAMILY', { field: 'scheduledFacts[].payloadDirectFacts[].unit' });
          toFiniteNumber(prow.amount, 'scheduledFacts[].payloadDirectFacts[].amount');
          var pdur = toFiniteNumber(prow.durationTurns, 'scheduledFacts[].payloadDirectFacts[].durationTurns');
          if (pdur < 0 || Math.floor(pdur) !== pdur) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].payloadDirectFacts[].durationTurns' });
          if (!Array.isArray(prow.targetIds) || prow.targetIds.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].targetIds' });
          for (var tj = 0; tj < prow.targetIds.length; tj += 1) {
            var t = prow.targetIds[tj];
            if (typeof t !== 'string' || t.length === 0 || SYMBOLIC_TARGETS.indexOf(t) >= 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].payloadDirectFacts[].targetIds', value: String(t) });
          }
        }
        if (e.maxActions !== undefined) {
          if (typeof e.maxActions !== 'number') throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', value: String(e.maxActions) });
          var ma = toFiniteNumber(e.maxActions, 'scheduledFacts[].maxActions');
          if (ma < 1 || Math.floor(ma) !== ma) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', value: ma });
          if (e.triggerKey !== '主动触发') throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].maxActions', triggerKey: String(e.triggerKey) });
        } else if (e.triggerKey === '主动触发') {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].maxActions' });
        }
      } else if (shape === 'SUMMON_WINDOW') {
        if (typeof e['召唤单位类型'] !== 'string' || e['召唤单位类型'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].召唤单位类型' });
        if (typeof e['召唤物名称'] !== 'string' || e['召唤物名称'].length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].召唤物名称' });
        if (e['行动模式'] !== undefined && (typeof e['行动模式'] !== 'string' || e['行动模式'].length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'scheduledFacts[].行动模式' });
        if (e.durationTurns !== undefined) {
          var dt = toFiniteNumber(e.durationTurns, 'scheduledFacts[].durationTurns');
          if (dt < 0 || Math.floor(dt) !== dt) throw rejection('INVALID_OPTION_VALUE', { field: 'scheduledFacts[].durationTurns', value: dt });
        }
      }
    }
  }

  // ---- audit-only bridges: mechanicMetadataEntries / projectionFamilies (rev4) ----
  function validateMechanicMetadataEntries(input) {
    var mm = input.mechanicMetadataEntries;
    if (mm === undefined) return;
    if (!Array.isArray(mm)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries' });
    for (var e = 0; e < mm.length; e += 1) {
      var entry = mm[e];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries[' + e + ']' });
      rejectUnknownKeys(entry, MECHANIC_METADATA_CLOSED_KEYS, 'mechanicMetadataEntries[]');
      if (entry.sourceEffectId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries[].sourceEffectId' });
      validateIdString(entry.sourceEffectId, 'mechanicMetadataEntries[].sourceEffectId');
      if (entry['生效方式'] !== undefined && ['独立生效', '跟随主原型'].indexOf(entry['生效方式']) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.生效方式', value: String(entry['生效方式']) });
      if (entry['对应等级'] !== undefined) toFiniteNumber(entry['对应等级'], 'mechanicMetadataEntries.对应等级');
      if (entry['限定元素'] !== undefined) {
      if (!Array.isArray(entry['限定元素'])) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.限定元素' });
      var seen = {};
      for (var i = 0; i < entry['限定元素'].length; i += 1) {
        var el = entry['限定元素'][i];
        if (typeof el !== 'string' || el.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadata.限定元素[' + i + ']' });
        if (hasOwn(seen, el)) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadata.限定元素', duplicate: el });
        seen[el] = true;
      }
      }
      // 触发限制 is audit-only metadata: revision 4 inputContract closes it as a
      // non-empty string OR a closed {周期: string, 次数: integer >= 1} object
      // (unknown keys / zero count / missing 周期 rejected); its value never enters
      // features (PDA keeps PENDING_TRIGGER_PROJECTION semantics upstream).
      if (entry['触发限制'] !== undefined) {
        var tl = entry['触发限制'];
        if (typeof tl === 'string') {
          if (tl.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制' });
        } else if (tl && typeof tl === 'object' && !Array.isArray(tl)) {
          rejectUnknownKeys(tl, ['周期', '次数'], 'mechanicMetadataEntries.触发限制');
          if (typeof tl['周期'] !== 'string' || tl['周期'].length === 0) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制.周期' });
          }
          if (typeof tl['次数'] !== 'number' || !isFinite(tl['次数']) || Math.floor(tl['次数']) !== tl['次数'] || tl['次数'] < 1) {
            throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制.次数' });
          }
        } else {
          throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries.触发限制' });
        }
      }
      var textKeys = ['结算标签', '抗性类型', '驱动属性', '影响方向', '触发方式', '结算', '吸收资源', '吸收来源'];
      for (var t = 0; t < textKeys.length; t += 1) {
        if (entry[textKeys[t]] !== undefined && (typeof entry[textKeys[t]] !== 'string' || entry[textKeys[t]].length === 0)) {
          throw rejection('MISSING_SOURCE_REFERENCE', { field: 'mechanicMetadataEntries.' + textKeys[t] });
        }
      }
      // Per-prototype subset violation: when projectionFamilies identifies the same
      // sourceEffectId, metadata keys must stay inside that prototype's closed subset.
      var pf = input.projectionFamilies;
      if (Array.isArray(pf)) {
        for (var p = 0; p < pf.length; p += 1) {
          if (pf[p].sourceEffectId !== entry.sourceEffectId) continue;
          var subset = MECHANIC_METADATA_SUBSETS[pf[p].prototype];
          if (!subset) continue;
          for (var k in entry) {
            if (!hasOwn(entry, k)) continue;
            if (k === 'sourceEffectId') continue;
            if (subset.indexOf(k) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'mechanicMetadataEntries', prototype: pf[p].prototype, extraKey: k });
          }
        }
      }
    }
  }
  function validatePrototypeRegistry(input) {
    var pr = input.prototypeRegistry;
    if (pr === undefined) {
      if (Array.isArray(input.projectionFamilies)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'prototypeRegistry' });
      return;
    }
    if (!pr || typeof pr !== 'object' || Array.isArray(pr)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'prototypeRegistry' });
    rejectUnknownKeys(pr, ['registryId', 'prototypeNames', 'prototypeRegistryHash', 'sourceContractHash'], 'prototypeRegistry');
    if (typeof pr.registryId !== 'string' || pr.registryId.indexOf('RC6-M2-PROTOTYPE-DIRECT-ADAPTER') !== 0) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.registryId', value: pr.registryId });
    }
    var names = pr.prototypeNames;
    if (!Array.isArray(names) || names.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames' });
    for (var i = 0; i < names.length; i += 1) {
      var n = names[i];
      if (typeof n !== 'string' || n.length === 0 || n.length > 512 || /[\u0000-\u001F\u007F]/.test(n)) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames[' + i + ']' });
      }
      if (i > 0 && cmpStr(names[i - 1], n) >= 0) {
        throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeNames', notCanonicalSorted: true });
      }
    }
    if (typeof pr.prototypeRegistryHash !== 'string' || !/^[0-9a-f]{8}$/.test(pr.prototypeRegistryHash) || pr.prototypeRegistryHash !== fnv1a32Hex(names)) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.prototypeRegistryHash' });
    }
    if (typeof pr.sourceContractHash !== 'string' || !/^[0-9a-f]{64}$/.test(pr.sourceContractHash) || pr.sourceContractHash !== CONTRACT_HASHES.governed.adapterContract) {
      throw rejection('INVALID_OPTION_VALUE', { field: 'prototypeRegistry.sourceContractHash' });
    }
  }

  function validateProjectionFamilies(input) {
    var pf = input.projectionFamilies;
    if (pf === undefined) return;
    if (!input.prototypeRegistry) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'prototypeRegistry' });
    var names = input.prototypeRegistry.prototypeNames;
    if (!Array.isArray(pf)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'projectionFamilies' });
    var seen = {};
    for (var i = 0; i < pf.length; i += 1) {
      var e = pf[i];
      if (!e || typeof e !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'projectionFamilies[' + i + ']' });
      rejectUnknownKeys(e, ['sourceEffectId', 'prototype'], 'projectionFamilies[]');
      validateIdString(e.sourceEffectId, 'projectionFamilies[].sourceEffectId');
      if (typeof e.prototype !== 'string' || e.prototype.length === 0) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'projectionFamilies[].prototype' });
      if (names.indexOf(e.prototype) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'projectionFamilies[].prototype', value: e.prototype });
      var uid = e.sourceEffectId + '\u0000' + e.prototype;
      if (hasOwn(seen, uid)) throw rejection('INVALID_OPTION_VALUE', { field: 'projectionFamilies', duplicate: uid });
      seen[uid] = true;
    }
  }

  function validatePublicCost(input) {
    var cost = input.publicCost;
    if (cost === undefined) return;
    if (!Array.isArray(cost)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost' });
    for (var i = 0; i < cost.length; i += 1) {
      var e = cost[i];
      if (!e || typeof e !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost[' + i + ']' });
      rejectUnknownKeys(e, COST_KEYS, 'publicCost[]');
      if (e.resource === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost[].resource' });
      if (RESOURCE_NAMES.indexOf(e.resource) < 0) throw rejection('INVALID_OPTION_VALUE', { field: 'publicCost[].resource', value: String(e.resource) });
      if (e.amount === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicCost[].amount' });
      var amt = toFiniteNumber(e.amount, 'publicCost.amount');
      if (amt <= 0) throw rejection('INVALID_OPTION_VALUE', { field: 'publicCost[].amount', value: amt });
    }
  }

  function validatePublicProbability(input) {
    var pp = input.publicProbability;
    if (pp === undefined) return;
    if (typeof pp !== 'object' || pp === null || Array.isArray(pp)) throw rejection('INVALID_OPTION_VALUE', { field: 'publicProbability' });
    var keys = Object.keys(pp);
    if (pp.hitProbability !== undefined) {
      rejectUnknownKeys(pp, ['hitProbability', 'source'], 'publicProbability');
      toFiniteNumber(pp.hitProbability, 'publicProbability.hitProbability');
      if (pp.source !== undefined && (typeof pp.source !== 'string' || pp.source.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicProbability.source' });
    } else if (pp.resolved === false) {
      rejectUnknownKeys(pp, ['resolved', 'unresolvedCondition'], 'publicProbability');
      if (pp.unresolvedCondition !== undefined && (typeof pp.unresolvedCondition !== 'string' || pp.unresolvedCondition.length === 0)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicProbability.unresolvedCondition' });
    } else {
      throw rejection('INVALID_OPTION_VALUE', { field: 'publicProbability', keys: keys });
    }
  }

  function validatePublicDeclarations(input) {
    var pd = input.publicDeclarations;
    if (pd === undefined) return;
    if (typeof pd !== 'object' || pd === null || Array.isArray(pd)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'publicDeclarations' });
    rejectUnknownKeys(pd, DECL_KEYS, 'publicDeclarations');
    if (pd.revealStrength !== undefined) toFiniteNumber(pd.revealStrength, 'publicDeclarations.revealStrength');
    if (pd.declaredOverkill !== undefined) toFiniteNumber(pd.declaredOverkill, 'publicDeclarations.declaredOverkill');
  }

  function validateCreationProfile(input) {
    var cp = input.creationProfile;
    if (cp === undefined) return;
    if (typeof cp !== 'object' || cp === null || Array.isArray(cp)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile' });
    rejectUnknownKeys(cp, CREATION_PROFILE_KEYS, 'creationProfile');
    if (cp.recipientId === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.recipientId' });
    validateIdString(cp.recipientId, 'creationProfile.recipientId');
    if (cp.useEffects === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects' });
    if (!Array.isArray(cp.useEffects)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects' });
    for (var i = 0; i < cp.useEffects.length; i += 1) {
      var row = cp.useEffects[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects[' + i + ']' });
      rejectUnknownKeys(row, CREATION_PROFILE_ROW_KEYS, 'creationProfile.useEffects[' + i + ']');
      for (var k = 0; k < CREATION_PROFILE_ROW_KEYS.length; k += 1) {
        var key = CREATION_PROFILE_ROW_KEYS[k];
        if (row[key] === undefined) throw rejection('MISSING_SOURCE_REFERENCE', { field: 'creationProfile.useEffects[' + i + '].' + key });
      }
      if (typeof row['原型'] !== 'string' || row['原型'].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].原型' });
      if (typeof row['目标'] !== 'string' || row['目标'].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].目标' });
      if (typeof row['数值'] !== 'string' || row['数值'].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].数值' });
      var res = row['资源'];
      if (typeof res === 'string') {
        if (res.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
      } else if (Array.isArray(res)) {
        if (res.length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
        for (var r = 0; r < res.length; r += 1) {
          if (typeof res[r] !== 'string' || res[r].length === 0) throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源[' + r + ']' });
        }
      } else {
        throw rejection('INVALID_OPTION_VALUE', { field: 'creationProfile.useEffects[' + i + '].资源' });
      }
    }
  }

  function validateInput(input) {
    checkForbiddenInput(input);
    validateTopLevelKeys(input);
    validateCandidate(input);
    validateActionOpportunity(input);
    validateSnapshot(input);
    validateAtomicFacts(input);
    validateDirectFactsRows(input);
    validateLegalityFlags(input);
    validateLegalityModifiers(input);
    validateOpportunityModifiers(input);
    validateScheduledFacts(input);
    validateMechanicMetadataEntries(input);
    validatePrototypeRegistry(input);
    validateProjectionFamilies(input);
    validatePublicCost(input);
    validatePublicProbability(input);
    validatePublicDeclarations(input);
    validateCreationProfile(input);
  }
  function expectUnit(unit, want) {
    if (unit !== want) throw rejection('UNIT_FAMILY_MISMATCH', { unit: unit, expected: want });
  }
  function kKnown(code, family, value) {
    return { featureCode: code, unitFamily: family, status: 'KNOWN', reasonCode: 'OK', value: normZero(value) };
  }
  function kUnknown(code, family, reason) {
    return { featureCode: code, unitFamily: family, status: 'UNKNOWN', reasonCode: reason };
  }
  function projectRow(factType, key, unit, amount, dur) {
    var out = [];
    if (factType === 'HP_DELTA') {
      if (key === '' || key === 'damage.power') {
        expectUnit(unit, 'POWER');
        out.push(kKnown('DAMAGE_POWER', 'POWER', amount));
      } else if (key === 'damage.segments') {
        expectUnit(unit, 'COUNT');
        out.push(kKnown('DAMAGE_SEGMENTS', 'COUNT', amount));
      } else if (key === 'damage.penetration') {
        expectUnit(unit, 'PERCENT');
        out.push(kKnown('DAMAGE_PENETRATION', 'PERCENT', amount));
      } else if (key === 'damage.type') {
        expectUnit(unit, 'BOOL');
        out.push(kKnown('DAMAGE_TYPE', 'BOOL', amount > 0 ? 1 : 0));
      } else {
        return null;
      }
    } else if (factType === 'RESOURCE_OPTION_CHANGED') {
      if (unit === 'ABS') {
        out.push(kKnown('RESOURCE_DELTA', 'ABS', amount));
      } else if (unit === 'PERCENT') {
        out.push(kKnown('RESOURCE_DELTA_PERCENT', 'PERCENT', amount));
      } else {
        throw rejection('UNIT_FAMILY_MISMATCH', { factType: factType, key: key, unit: unit });
      }
    } else if (factType === 'SHIELD_DELTA') {
      if (unit === 'ABS') {
        out.push(kKnown('SHIELD_DELTA', 'ABS', amount));
      } else if (unit === 'PERCENT') {
        // Percent-declared shield magnitudes cannot be faithfully scalarized
        // into the ABS shield-delta feature: the final ABS settlement depends on
        // effect-strength resolution and is not public at feature time. The row
        // keeps its feature home and sourceFactIds ownership as UNKNOWN
        // (FINAL_SETTLEMENT_UNKNOWN), never coerced to ABS, never OUTSIDE.
        out.push(kUnknown('SHIELD_DELTA', 'ABS', 'FINAL_SETTLEMENT_UNKNOWN'));
      } else {
        throw rejection('UNIT_FAMILY_MISMATCH', { factType: factType, key: key, unit: unit });
      }
    } else if (factType === 'STATE_DELTA') {
      if (key === 'settlement.primary') {
        expectUnit(unit, 'PERCENT');
        out.push(kKnown('SETTLEMENT_MODIFIER_PERCENT', 'PERCENT', amount));
      } else {
        if (ATTRIBUTE_KEYS.indexOf(key) >= 0) {
          expectUnit(unit, 'PERCENT');
          out.push(kKnown('ATTRIBUTE_DELTA', 'PERCENT', amount));
        } else if (JUDGMENT_KEYS.indexOf(key) >= 0) {
          expectUnit(unit, 'PERCENT');
          out.push(kKnown('JUDGMENT_DELTA', 'PERCENT', amount));
        } else if (key === 'state.primary' || key === 'state.secondary') {
          expectUnit(unit, 'PERCENT');
          out.push(kKnown('STATE_DELTA_PERCENT', 'PERCENT', amount));
        } else if (unit === 'PERCENT') {
          out.push(kUnknown('STATE_DELTA_PERCENT', 'PERCENT', 'MISSING_SOURCE_FACT'));
        } else if (unit === 'BOOL') {
          out.push(kKnown('STATE_PRESENCE', 'BOOL', amount > 0 ? 1 : 0));
        } else if (unit === 'COUNT') {
          out.push(kUnknown('STATE_PRESENCE', 'BOOL', 'STATE_FORM_UNMAPPED'));
        } else {
          throw rejection('UNIT_FAMILY_MISMATCH', { factType: factType, key: key, unit: unit });
        }
        if (dur === 0) {
          out.push({ featureCode: 'STATE_DURATION', unitFamily: 'TURNS', status: 'NOT_APPLICABLE', reasonCode: 'NO_DURATION' });
        } else {
          out.push(kKnown('STATE_DURATION', 'TURNS', dur));
        }
      }
    } else if (factType === 'SUMMON_WINDOW') {
      if (key === 'summon.count') {
        if (unit === 'COUNT') out.push(kKnown('SUMMON_COUNT', 'COUNT', amount));
        else out.push(kUnknown('SUMMON_COUNT', 'COUNT', 'MISSING_SOURCE_FACT'));
      } else if (key === 'summon.strength') {
        if (unit === 'RATIO') out.push(kKnown('SUMMON_STRENGTH', 'RATIO', amount));
        else out.push(kUnknown('SUMMON_STRENGTH', 'RATIO', 'MISSING_SOURCE_FACT'));
      } else if (key === 'summon.duration') {
        if (unit === 'TURNS') out.push(kKnown('SUMMON_DURATION', 'TURNS', amount));
        else out.push(kUnknown('SUMMON_DURATION', 'TURNS', 'MISSING_SOURCE_FACT'));
      } else {
        // summon.inheritRatio and unknown summon keys map to no feature code
        return [];
      }
    } else {
      return null;
    }
    return out;
  }

  function summonFamilyBlock(recs, seid, block) {
    var codes = [
      ['SUMMON_COUNT', 'COUNT', 'summon.count'],
      ['SUMMON_STRENGTH', 'RATIO', 'summon.strength'],
      ['SUMMON_DURATION', 'TURNS', 'summon.duration']
    ];
    for (var c = 0; c < codes.length; c += 1) {
      var code = codes[c][0];
      var family = codes[c][1];
      var key = codes[c][2];
      var info = block[key];
      if (info && info.unit === family) {
        recs.push(rec(code, family, 'KNOWN', 'OK', info.amount, [info.factId], [], 1, seid, key));
      } else if (info) {
        recs.push(rec(code, family, 'UNKNOWN', 'MISSING_SOURCE_FACT', undefined, [info.factId], [], 1, seid, key));
      } else {
        recs.push(rec(code, family, 'UNKNOWN', 'MISSING_SOURCE_FACT', undefined, [], [], 1, seid, ''));
      }
    }
  }

  function computeRows(input) {
    var recs = [];
    var outside = 0;
    var outsideFactIds = [];
    var seen = {};
    var rows = input.directFacts || [];
    var summonByEffect = {};
    var summonActivated = {};
    var pfSummon = {};
    var pf = input.projectionFamilies;
    if (Array.isArray(pf)) {
      for (var f = 0; f < pf.length; f += 1) {
        if (pf[f].prototype === '召唤生成') pfSummon[pf[f].sourceEffectId] = true;
      }
    }
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var factType = row.factType;
      var key = row.key;
      var amount = toFiniteNumber(row.amount, 'directFacts.amount');
      var dur = toFiniteNumber(row.durationTurns, 'directFacts.durationTurns');
      var rowFactId = row.sourceEffectId + '::' + key;
      if (hasOwn(seen, rowFactId)) throw rejection('DUPLICATE_FEATURE', { rowFactId: rowFactId });
      seen[rowFactId] = true;
      if (factType === 'SUMMON_WINDOW') {
        if (key === 'summon.count' || key === 'summon.strength' || key === 'summon.duration') {
          if (!summonByEffect[row.sourceEffectId]) summonByEffect[row.sourceEffectId] = {};
          summonByEffect[row.sourceEffectId][key] = { unit: row.unit, amount: amount, factId: rowFactId };
          summonActivated[row.sourceEffectId] = true;
        } else {
          // summon.inheritRatio and unknown summon keys map to no feature code
          outside += 1;
          outsideFactIds.push(rowFactId);
        }
        continue;
      }
      var projs = projectRow(factType, key, row.unit, amount, dur);
      if (projs === null || projs.length === 0) { outside += 1; outsideFactIds.push(rowFactId); continue; }
      for (var p = 0; p < projs.length; p += 1) {
        var pr = projs[p];
        recs.push(rec(pr.featureCode, pr.unitFamily, pr.status, pr.reasonCode, pr.value, [rowFactId], [], 1, row.sourceEffectId, key));
      }
    }
    var summonEffects = Object.keys(summonActivated);
    for (var se = 0; se < summonEffects.length; se += 1) {
      summonFamilyBlock(recs, summonEffects[se], summonByEffect[summonEffects[se]]);
    }
    for (var pfk in pfSummon) {
      if (hasOwn(pfSummon, pfk) && !hasOwn(summonActivated, pfk)) {
        summonFamilyBlock(recs, pfk, {});
      }
    }
    recs = collapseAttributeDeltaRows(recs);
    return { recs: recs, outsideCount: outside, outsideFactIds: outsideFactIds };
  }

  // Same-candidate duplicate KNOWN ATTRIBUTE_DELTA rows (same unit) collapse to
  // a single row: stable-order signed SUM with unioned sourceFactIds and
  // sourceEventIds. Mixed units or non-finite values are rejected; MAX is never
  // used. computeRows runs strictly once per candidate, so all rows here are
  // provably within the same candidate scope by construction.
  function collapseAttributeDeltaRows(recs) {
    var attrs = [];
    var kept = [];
    for (var i = 0; i < recs.length; i += 1) {
      if (recs[i].featureCode === 'ATTRIBUTE_DELTA' && recs[i].status === 'KNOWN') attrs.push(recs[i]);
      else kept.push(recs[i]);
    }
    if (attrs.length <= 1) return recs;
    var unit = attrs[0].unitFamily;
    var sum = 0;
    var factIds = [];
    var eventIds = [];
    for (var a = 0; a < attrs.length; a += 1) {
      if (attrs[a].unitFamily !== unit) {
        throw rejection('UNIT_FAMILY_MISMATCH', { featureCode: 'ATTRIBUTE_DELTA', unit: attrs[a].unitFamily, expected: unit });
      }
      if (typeof attrs[a].value !== 'number' || !Number.isFinite(attrs[a].value)) {
        throw rejection('INVALID_OPTION_VALUE', { featureCode: 'ATTRIBUTE_DELTA', value: attrs[a].value });
      }
      sum = normZero(sum + attrs[a].value);
      factIds = factIds.concat(attrs[a].sourceFactIds || []);
      eventIds = eventIds.concat(attrs[a].sourceEventIds || []);
    }
    var uniqueFactIds = [];
    for (var f = 0; f < factIds.length; f += 1) {
      if (uniqueFactIds.indexOf(factIds[f]) < 0) uniqueFactIds.push(factIds[f]);
    }
    kept.push(rec('ATTRIBUTE_DELTA', unit, 'KNOWN', 'OK', sum, uniqueFactIds, eventIds, attrs.length, attrs[0]._seid, attrs[0]._key));
    return kept;
  }

  function targetSideRec(input) {
    var cand = input.candidate;
    var sides = input.publicSnapshot.sides;
    var targets = cand.targetSet;
    if (targets.length === 0) return na('RELATION_TARGET_SIDE', 'ENUM', 'NO_TARGET_AXIS');
    var classes = {};
    var anyUnobserved = false;
    for (var i = 0; i < targets.length; i += 1) {
      var t = targets[i];
      if (!hasOwn(sides, t)) { anyUnobserved = true; continue; }
      if (t === cand.actorId) { classes['SELF'] = true; }
      else if (sides[t] === cand.actorSide) { classes['ALLY'] = true; }
      else { classes['ENEMY'] = true; }
    }
    if (anyUnobserved) return unk('RELATION_TARGET_SIDE', 'ENUM', 'SIDE_UNOBSERVED');
    var keys = Object.keys(classes);
    if (keys.length === 1) return knownStr('RELATION_TARGET_SIDE', 'ENUM', keys[0]);
    return knownStr('RELATION_TARGET_SIDE', 'ENUM', 'MIXED');
  }

  // R4b2 damage-delivery hit axis. A valid delivery requires outcomeKind
  // HP_DELTA, evidence.damageBasis.basisView DECISION_VISIBLE, nonempty
  // effectInstanceId + targetId and finite hitProbability. Rows are deduped by
  // (effectInstanceId,targetId); same identity with differing probabilities is
  // UNKNOWN(CONFLICTING_DELIVERIES). Candidate value = arithmetic mean over the
  // declared targets that have a hit axis: first the per-target mean over that
  // target's independent deliveries, then the mean over targets. Targets with
  // no damage delivery are NO_HIT_AXIS and excluded from the denominator; a
  // candidate with no damage delivery at all is NOT_APPLICABLE(NO_HIT_AXIS).
  // deliveryStatus 'MISSING'/'NON_FINITE' is the explicit fail-closed carrier
  // for a delivery that mechanically should exist but is absent/non-finite.
  function successProbabilityRec(input) {
    var facts = Array.isArray(input.atomicFacts) ? input.atomicFacts : [];
    var targets = input.candidate.targetSet;
    var deliveryByKey = {};
    var keyOrder = [];
    var conflictKey = null;
    var brokenReason = null;
    var brokenEvents = [];
    var unresolvedEvent = null;
    var hasDeliveryRow = false;
    for (var i = 0; i < facts.length; i += 1) {
      var f = facts[i];
      if (String(f.outcomeKind || '').trim() !== 'HP_DELTA') continue;
      hasDeliveryRow = true;
      if (f.hitCheckApplicability === 'UNKNOWN') {
        if (!unresolvedEvent) unresolvedEvent = f.eventId;
        continue;
      }
      if (f.hitCheckApplicability === 'NOT_APPLICABLE') continue;
      var ev = f.evidence && typeof f.evidence === 'object' ? f.evidence : {};
      var status = ev.deliveryStatus;
      if (status === 'MISSING') {
        if (!brokenReason) brokenReason = 'MISSING_SOURCE_FACT';
        brokenEvents.push(f.eventId);
        continue;
      }
      if (status === 'NON_FINITE') {
        if (!brokenReason) brokenReason = 'NON_FINITE_DELIVERY';
        brokenEvents.push(f.eventId);
        continue;
      }
      var basis = ev.damageBasis && typeof ev.damageBasis === 'object' ? ev.damageBasis : null;
      var basisOk = !!basis && String(basis.basisView || '').trim() === 'DECISION_VISIBLE';
      var effId = typeof f.effectInstanceId === 'string' ? f.effectInstanceId.trim() : '';
      var tgtId = typeof f.targetId === 'string' ? f.targetId.trim() : '';
      var idOk = effId.length > 0 && tgtId.length > 0;
      if (!basisOk || !idOk) {
        if (!brokenReason) brokenReason = 'MISSING_SOURCE_FACT';
        brokenEvents.push(f.eventId);
        continue;
      }
      var raw = ev.hitProbability;
      if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) {
        if (!brokenReason) brokenReason = 'NON_FINITE_DELIVERY';
        brokenEvents.push(f.eventId);
        continue;
      }
      var value = Number(raw);
      var key = effId + '\u0000' + tgtId;
      var entry = deliveryByKey[key];
      if (!entry) {
        entry = { p: value, targetId: tgtId, events: [] };
        deliveryByKey[key] = entry;
        keyOrder.push(key);
      } else if (entry.p !== value) {
        if (!conflictKey) conflictKey = key;
        entry.conflict = true;
      }
      entry.events.push(f.eventId);
    }
    if (unresolvedEvent) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONDITIONAL_PROBABILITY_UNRESOLVED', [], [unresolvedEvent]);
    if (conflictKey) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'CONFLICTING_DELIVERIES', [], deliveryByKey[conflictKey].events);
    if (brokenReason) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', brokenReason, [], brokenEvents);
    // R4b2 declared-target mechanical closure: the PDA projections lifted into
    // directFacts are the authoritative obligation carrier. Every HP_DELTA row's
    // targetIds is a target the action mechanically owes a damage delivery to;
    // a declared obligation target with no transcribed delivery is a missing
    // source fact (fail-closed), not a NO_HIT_AXIS exclusion. Non-obligation
    // declared targets keep the existing no-hit-axis exclusion semantics.
    var obligationTargets = {};
    var rows = Array.isArray(input.directFacts) ? input.directFacts : [];
    for (var r = 0; r < rows.length; r += 1) {
      if (String(rows[r].factType || '').trim() !== 'HP_DELTA') continue;
      var ids = Array.isArray(rows[r].targetIds) ? rows[r].targetIds : [];
      for (var u = 0; u < ids.length; u += 1) obligationTargets[ids[u]] = true;
    }
    if (Object.keys(obligationTargets).length > 0) {
      var deliveredTargets = {};
      for (var d = 0; d < keyOrder.length; d += 1) deliveredTargets[deliveryByKey[keyOrder[d]].targetId] = true;
      var obligationKeys = Object.keys(obligationTargets);
      for (var o = 0; o < obligationKeys.length; o += 1) {
        if (!hasOwn(deliveredTargets, obligationKeys[o])) {
          return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'MISSING_SOURCE_FACT', [], []);
        }
      }
    }
    if (!hasDeliveryRow) {
      if (!targets || targets.length === 0) return unk('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'MISSING_SOURCE_FACT');
      return na('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'NO_HIT_AXIS');
    }
    if (!keyOrder.length) return na('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'NO_HIT_AXIS');
    var targetSum = {};
    var targetCount = {};
    var targetEventIds = {};
    for (var o = 0; o < keyOrder.length; o += 1) {
      var item = deliveryByKey[keyOrder[o]];
      targetSum[item.targetId] = (targetSum[item.targetId] || 0) + item.p;
      targetCount[item.targetId] = (targetCount[item.targetId] || 0) + 1;
      for (var x = 0; x < item.events.length; x += 1) {
        (targetEventIds[item.targetId] = targetEventIds[item.targetId] || []).push(item.events[x]);
      }
    }
    var targetIds = Object.keys(targetSum);
    var total = 0;
    var allEventIds = [];
    for (var t = 0; t < targetIds.length; t += 1) {
      total += targetSum[targetIds[t]] / targetCount[targetIds[t]];
      for (var y = 0; y < targetEventIds[targetIds[t]].length; y += 1) allEventIds.push(targetEventIds[targetIds[t]][y]);
    }
    return rec('SUCCESS_PROBABILITY', 'PROBABILITY_0_1', 'KNOWN', 'OK', total / targetIds.length, [], allEventIds, 0, '', '');
  }
  function hpRatioRec(input) {
    var targets = input.candidate.targetSet;
    if (targets.length === 0) return unk('PUBLIC_HP_RATIO', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    var units = input.publicSnapshot.units;
    var sum = 0;
    for (var i = 0; i < targets.length; i += 1) {
      var u = units[targets[i]];
      if (!u || typeof u !== 'object' || u.hp === undefined || u.hp_max === undefined) return unk('PUBLIC_HP_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      var hp = toFiniteNumber(u.hp, 'units.hp');
      var hpMax = toFiniteNumber(u.hp_max, 'units.hp_max');
      if (hpMax <= 0) return unk('PUBLIC_HP_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      sum += hp / hpMax;
    }
    return known('PUBLIC_HP_RATIO', 'RATIO_0_1', sum / targets.length);
  }

  function resourceRatioRec(input) {
    var targets = input.candidate.targetSet;
    if (targets.length === 0) return unk('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    var units = input.publicSnapshot.units;
    var sum = 0;
    for (var i = 0; i < targets.length; i += 1) {
      var u = units[targets[i]];
      if (!u || typeof u !== 'object' || u.sp === undefined || u.sp_max === undefined || u.men === undefined || u.men_max === undefined) {
        return unk('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      }
      var sp = toFiniteNumber(u.sp, 'units.sp');
      var spMax = toFiniteNumber(u.sp_max, 'units.sp_max');
      var men = toFiniteNumber(u.men, 'units.men');
      var menMax = toFiniteNumber(u.men_max, 'units.men_max');
      if (spMax <= 0 || menMax <= 0) return unk('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      sum += (sp / spMax + men / menMax) / 2;
    }
    return known('PUBLIC_RESOURCE_RATIO', 'RATIO_0_1', sum / targets.length);
  }

  // PUBLIC_RECIPIENT_NEED_MATCH: declared positive recovery (creationProfile.useEffects
  // 资源变化 rows with percent 数值) vs the same observer-visible recipient resource
  // gap. Per (recipientId, resource) duplicates take max, never sum; the value is the
  // arithmetic mean over the actual recovery channels; no channel => KNOWN 0; any
  // unprovable recipient/axis/percent-unit fails closed to UNKNOWN, never guessed.
  // 数值 grammar: optional sign, decimal digits, optional literal percent sign
  // ([+-]?[0-9]+(\.[0-9]+)?%?); negative and zero rows are drains, never recovery
  // channels; malformed strings or non-finite magnitudes are UNKNOWN(MISSING_SOURCE_FACT).
  function recipientNeedMatchRec(input) {
    var cp = input.creationProfile;
    if (!cp || typeof cp !== 'object') return known('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 0);
    if (typeof cp.recipientId !== 'string' || cp.recipientId.length === 0) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    if (!Array.isArray(cp.useEffects)) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
    var unit = input.publicSnapshot.units[cp.recipientId];
    var channels = {};
    var factIds = [];
    for (var i = 0; i < cp.useEffects.length; i += 1) {
      var row = cp.useEffects[i];
      if (row['原型'] !== '资源变化') continue;
      var m = /^([+-]?)([0-9]+(?:\.[0-9]+)?)(%)?$/.exec(String(row['数值']).trim());
      if (!m) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
      var ratio = (m[1] === '-' ? -1 : 1) * Number(m[2]);
      if (m[3] === '%') ratio = ratio / 100;
      if (ratio <= 0) continue;
      if (!isFinite(ratio)) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
      if (m[3] !== '%') return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'MISSING_SOURCE_FACT');
      var resList = Array.isArray(row['资源']) ? row['资源'] : [row['资源']];
      for (var r = 0; r < resList.length; r += 1) {
        var resName = resList[r];
        if (RESOURCE_NAMES.indexOf(resName) < 0) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        if (!unit || typeof unit !== 'object') return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        var field = RESOURCE_FIELD[resName];
        var cur = unit[field];
        var max = unit[field + '_max'];
        if (cur === undefined || max === undefined) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        cur = toFiniteNumber(cur, 'units.' + cp.recipientId + '.' + field);
        max = toFiniteNumber(max, 'units.' + cp.recipientId + '.' + field + '_max');
        if (max <= 0) return unk('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
        var gap = (max - cur) / max;
        if (gap < 0) gap = 0;
        if (gap > 1) gap = 1;
        var realized = gap < ratio ? gap : ratio;
        if (realized < 0) realized = 0;
        if (realized > 1) realized = 1;
        channels[resName] = hasOwn(channels, resName) && channels[resName] > realized ? channels[resName] : realized;
        if (factIds.indexOf('creationProfile:useEffects:' + i) < 0) factIds.push('creationProfile:useEffects:' + i);
      }
    }
    var keys = Object.keys(channels);
    if (keys.length === 0) return known('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 0);
    var sum = 0;
    for (var k = 0; k < keys.length; k += 1) sum += channels[keys[k]];
    return rec('PUBLIC_RECIPIENT_NEED_MATCH', 'RATIO_0_1', 'KNOWN', 'OK', sum / keys.length, factIds.sort(cmpStr), [], 0, '', '');
  }

  function costAffordabilityRec(input) {
    var cost = input.publicCost;
    if (!Array.isArray(cost) || cost.length === 0) return na('COST_AFFORDABILITY', 'RATIO_0_1', 'NO_PUBLIC_COST');
    var actor = input.publicSnapshot.units[input.candidate.actorId];
    if (!actor || typeof actor !== 'object') return unk('COST_AFFORDABILITY', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
    var minRatio = Infinity;
    for (var i = 0; i < cost.length; i += 1) {
      var entry = cost[i];
      var field = RESOURCE_FIELD[entry.resource];
      var available = actor[field];
      if (available === undefined) return unk('COST_AFFORDABILITY', 'RATIO_0_1', 'HIDDEN_AXIS_UNOBSERVED');
      var ratio = toFiniteNumber(available, 'units.' + input.candidate.actorId + '.' + field) / toFiniteNumber(entry.amount, 'publicCost.amount');
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      if (ratio < minRatio) minRatio = ratio;
    }
    return known('COST_AFFORDABILITY', 'RATIO_0_1', minRatio);
  }

  function revealRec(input) {
    var pd = input.publicDeclarations;
    if (pd && typeof pd === 'object' && pd.revealStrength !== undefined) {
      return known('REVEAL_STRENGTH', 'RATIO_0_1', toFiniteNumber(pd.revealStrength, 'publicDeclarations.revealStrength'));
    }
    return unk('REVEAL_STRENGTH', 'RATIO_0_1', 'NO_PUBLIC_DECLARATION');
  }

  function overkillRec(input) {
    var pd = input.publicDeclarations;
    if (pd && typeof pd === 'object' && pd.declaredOverkill !== undefined) {
      return known('OVERKILL_AVAILABILITY', 'BOOL', toFiniteNumber(pd.declaredOverkill, 'publicDeclarations.declaredOverkill') > 0 ? 1 : 0);
    }
    return unk('OVERKILL_AVAILABILITY', 'BOOL', 'NO_PUBLIC_DECLARATION');
  }

  function hardExclusionCode(input) {
    var codes = [];
    if (Array.isArray(input.legalityFlags)) codes = codes.concat(input.legalityFlags);
    var lm = input.legalityModifiers;
    if (lm && typeof lm === 'object') {
      if (Array.isArray(lm.hardExclusions)) codes = codes.concat(lm.hardExclusions);
      if (Array.isArray(lm.legalityFlags)) codes = codes.concat(lm.legalityFlags);
    }
    for (var i = 0; i < codes.length; i += 1) {
      if (HARD_EXCLUSION_CODES.indexOf(codes[i]) >= 0) return codes[i];
    }
    var status = input.publicSnapshot.actorStatus;
    if (status === 'DISABLED') return 'ACTOR_DISABLED';
    if (status === 'TERMINAL') return 'ACTOR_TERMINAL';
    if (status === 'UNKNOWN') return 'UNKNOWN_STATE';
    if (input.candidate.targetSet.length < 1) return 'TARGET_EMPTY';
    var affordability = costAffordabilityRec(input);
    if (affordability.status === 'KNOWN' && affordability.value < 1) return 'RESOURCE_INSUFFICIENT';
    return null;
  }

  function scheduledEntryIds(input) {
    var sched = input.scheduledFacts;
    var out = [];
    if (!Array.isArray(sched)) return out;
    for (var i = 0; i < sched.length; i += 1) out.push(sched[i].entryId);
    return out;
  }

  function reactionMechanicsRows(input) {
    var mechanics = input.actionOpportunity && input.actionOpportunity.reactionMechanics;
    var factIds = mechanics && Array.isArray(mechanics.sourceFactIds) ? mechanics.sourceFactIds : [];
    var eventIds = mechanics && Array.isArray(mechanics.sourceEventIds) ? mechanics.sourceEventIds : [];
    var provenanceComplete = factIds.length > 0 && eventIds.length > 0;
    if (!mechanics || mechanics.status !== 'KNOWN' || !provenanceComplete) {
      var reason = !mechanics
        ? 'HIDDEN_AXIS_UNOBSERVED'
        : mechanics.status === 'KNOWN' && !provenanceComplete
          ? 'SOURCE_PROVENANCE_INCOMPLETE'
          : mechanics.reason || 'HIDDEN_AXIS_UNOBSERVED';
      return [
        rec('REACTION_DAMAGE_MULTIPLIER', 'RATIO_0_1', 'UNKNOWN', reason, undefined, factIds, eventIds, 0, '', ''),
        rec('REACTION_DODGE_PROBABILITY', 'PROBABILITY_0_1', 'UNKNOWN', reason, undefined, factIds, eventIds, 0, '', '')
      ];
    }
    return [
      rec('REACTION_DAMAGE_MULTIPLIER', 'RATIO_0_1', 'KNOWN', 'OK', mechanics.damageMultiplier, factIds, eventIds, 0, '', ''),
      rec('REACTION_DODGE_PROBABILITY', 'PROBABILITY_0_1', 'KNOWN', 'OK', mechanics.dodgeProbability, factIds, eventIds, 0, '', '')
    ];
  }

  function reactionCounterWindowRow(input) {
    var opportunity = input.actionOpportunity;
    if (!opportunity) return unk('REACTION_COUNTER_WINDOW_OPEN', 'BOOL', 'MISSING_SOURCE_FACT');
    var mechanics = opportunity.reactionMechanics;
    var factIds = mechanics && Array.isArray(mechanics.sourceFactIds) ? mechanics.sourceFactIds : [];
    var eventIds = mechanics && Array.isArray(mechanics.sourceEventIds) ? mechanics.sourceEventIds : [];
    if (!mechanics || factIds.length === 0 || eventIds.length === 0) {
      return unk('REACTION_COUNTER_WINDOW_OPEN', 'BOOL', mechanics?.status === 'KNOWN'
        ? 'SOURCE_PROVENANCE_INCOMPLETE'
        : mechanics?.reason || 'MISSING_SOURCE_FACT');
    }
    return rec(
      'REACTION_COUNTER_WINDOW_OPEN', 'BOOL', 'KNOWN', 'OK',
      opportunity.role === 'COUNTER' || opportunity.counterWindow === true ? 1 : 0,
      factIds, eventIds, 0, '', '',
    );
  }

  function candidateFeatures(input, outsideCount, outsideFactIds) {
    var out = [];
    out.push(known('RELATION_TARGET_COUNT', 'COUNT', input.candidate.targetSet.length));
    out.push(targetSideRec(input));
    out.push(successProbabilityRec(input));
    out.push(hpRatioRec(input));
    out.push(resourceRatioRec(input));
    out.push(recipientNeedMatchRec(input));
    out.push(costAffordabilityRec(input));
    out.push(revealRec(input));
    out.push(overkillRec(input));
    var excl = hardExclusionCode(input);
    out.push(known('HARD_EXCLUSION', 'BOOL', excl ? 1 : 0));
    out.push(excl ? knownStr('HARD_EXCLUSION_REASON', 'ENUM', excl) : na('HARD_EXCLUSION_REASON', 'ENUM', 'NOT_EXCLUDED'));
    out.push(unk('SETTLEMENT_DAMAGE', 'ABS', 'FINAL_SETTLEMENT_UNKNOWN'));
    out.push(unk('ROLL_REALIZATION', 'BOOL', 'FUTURE_REALIZATION_UNKNOWN'));
    out.push(rec('OUTSIDE_BATCH1_ROW_COUNT', 'COUNT', 'KNOWN', 'OK', outsideCount, outsideFactIds || [], scheduledEntryIds(input), 0, '', ''));
    out.push.apply(out, reactionMechanicsRows(input));
    out.push(reactionCounterWindowRow(input));
    for (var j = 0; j < out.length; j += 1) {
      out[j]._scopeRank = 0;
      out[j]._seid = '';
      out[j]._key = '';
    }
    return out;
  }

  // Per-target charge transport rows (M3 R4b5): one row per declared target in
  // targetSet declaration order. Sources are only the decision-visible public
  // snapshot paths publicSnapshot.units[targetId].蓄力技能.cast_time and
  // publicSnapshot.units[targetId].蓄力技能.skill.前摇 (fallback). Nothing else is
  // read: no Runtime internals, no skill names, no _效果数组, no future values.
  // The facts are transport-only and non-scoreable (catalog CATALOG_ONLY);
  // Provider weights/hashes never reference these codes.
  function chargeCastTime(charge, activeFact) {
    if (charge && typeof charge === 'object' && !Array.isArray(charge)) {
      var ct = charge['cast_time'];
      if (ct !== undefined && ct !== null) {
        var n = (typeof ct === 'string') ? Number(ct) : ct;
        if (typeof n === 'number' && isFinite(n) && n >= 0) {
          return { value: normZero(n), factId: activeFact + '.cast_time' };
        }
      }
      var skill = charge['skill'];
      if (skill && typeof skill === 'object' && !Array.isArray(skill)) {
        var pre = skill['前摇'];
        if (pre !== undefined && pre !== null) {
          var pn = (typeof pre === 'string') ? Number(pre) : pre;
          if (typeof pn === 'number' && isFinite(pn) && pn >= 0) {
            return { value: normZero(pn), factId: activeFact + '.skill.前摇' };
          }
        }
      }
    }
    return null;
  }

  function chargeTargetRows(input) {
    var recs = [];
    var targets = input.candidate.targetSet;
    var units = input.publicSnapshot.units;
    if (targets.length === 0) {
      recs.push(na('TARGET_CHARGE_ACTIVE', 'BOOL', 'NO_TARGET_AXIS'));
      recs.push(na('TARGET_CHARGE_CAST_TIME', 'TURNS', 'NO_TARGET_AXIS'));
      return recs;
    }
    for (var i = 0; i < targets.length; i += 1) {
      var tid = targets[i];
      var key = 'target:' + i;
      var unitPath = 'publicSnapshot.units.' + tid;
      var activeFact = unitPath + '.蓄力技能';
      if (!hasOwn(units, tid)) {
        recs.push(rec('TARGET_CHARGE_ACTIVE', 'BOOL', 'UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', undefined, [unitPath], [], 1, '', key));
        recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'UNKNOWN', 'HIDDEN_AXIS_UNOBSERVED', undefined, [unitPath], [], 1, '', key));
        continue;
      }
      var charge = units[tid]['蓄力技能'];
      var chargePresent = charge !== undefined && charge !== null;
      recs.push(rec('TARGET_CHARGE_ACTIVE', 'BOOL', 'KNOWN', 'OK', chargePresent ? 1 : 0, [activeFact], [], 1, '', key));
      if (!chargePresent) {
        // Observable no charge: both facts KNOWN 0 (never a guessed value).
        recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'KNOWN', 'OK', 0, [activeFact], [], 1, '', key));
      } else {
        var cast = chargeCastTime(charge, activeFact);
        if (cast === null) {
          recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'UNKNOWN', 'MISSING_SOURCE_FACT', undefined, [activeFact], [], 1, '', key));
        } else {
          recs.push(rec('TARGET_CHARGE_CAST_TIME', 'TURNS', 'KNOWN', 'OK', cast.value, [cast.factId], [], 1, '', key));
        }
      }
    }
    return recs;
  }

  function featCompare(a, b) {
    var c = a._scopeRank - b._scopeRank;
    if (c !== 0) return c;
    c = cmpStr(a._seid, b._seid);
    if (c !== 0) return c;
    c = cmpStr(a._key, b._key);
    if (c !== 0) return c;
    return cmpStr(a.featureCode, b.featureCode);
  }

  function assemble(candidateId, recs) {
    var sorted = recs.slice();
    sorted.sort(featCompare);
    var feats = [];
    for (var i = 0; i < sorted.length; i += 1) {
      var r = sorted[i];
      var f = {
        featureCode: r.featureCode,
        unitFamily: r.unitFamily,
        status: r.status,
        reasonCode: r.reasonCode,
        sourceFactIds: r.sourceFactIds.slice(),
        sourceEventIds: r.sourceEventIds.slice()
      };
      if (r.status === 'KNOWN') {
        f.value = normZero(r.value);
        if (BOOL_CODES.indexOf(r.featureCode) >= 0 && f.value !== 0 && f.value !== 1) {
          throw rejection('INVALID_STATUS_VALUE', { featureCode: r.featureCode, value: f.value });
        }
      }
      feats.push(f);
    }
    if (feats.length > CAPS.MAX_FEATURES_PER_CANDIDATE) throw rejection('CAP_EXCEEDED', { features: feats.length });
    return {
      schemaVersion: SCHEMA_VERSION,
      candidateId: candidateId,
      features: feats,
      featureCount: feats.length
    };
  }

  function modifierEntryCount(input) {
    var n = 0;
    var lm = input.legalityModifiers;
    if (lm && typeof lm === 'object') {
      if (Array.isArray(lm.judgmentRates)) n += lm.judgmentRates.length;
      if (lm.taunt) n += 1;
      if (lm.tauntRemoved) n += 1;
      if (lm.stateMigration) n += 1;
      if (lm.stateSwap) n += 1;
      if (Array.isArray(lm.mechanismRemoval)) n += lm.mechanismRemoval.length;
      if (Array.isArray(lm.hardExclusions)) n += lm.hardExclusions.length;
      if (Array.isArray(lm.legalityFlags)) n += lm.legalityFlags.length;
    }
    var om = input.opportunityModifiers;
    if (om && typeof om === 'object') {
      if (Array.isArray(om.resourceLocks)) n += om.resourceLocks.length;
      if (om.opportunityConstraints && typeof om.opportunityConstraints === 'object') n += Object.keys(om.opportunityConstraints).length;
      if (Array.isArray(om.interferenceRates)) n += om.interferenceRates.length;
      if (Array.isArray(om.dependencyTokens)) n += om.dependencyTokens.length;
    }
    if (Array.isArray(input.legalityFlags)) n += input.legalityFlags.length;
    return n;
  }

  function compileCore(input, m) {
    if (!input || typeof input !== 'object') throw rejection('MISSING_SOURCE_REFERENCE', { field: 'input' });
    validateInput(input);
    if (input.directFacts && input.directFacts.length > CAPS.MAX_FACT_ROWS_PER_CANDIDATE) throw rejection('CAP_EXCEEDED', { rows: input.directFacts.length });
    var modCount = modifierEntryCount(input);
    if (modCount > CAPS.MAX_MODIFIER_ENTRIES_PER_CANDIDATE) throw rejection('CAP_EXCEEDED', { modifiers: modCount });
    var atomicCount = Array.isArray(input.atomicFacts) ? input.atomicFacts.length : 0;
    var schedCount = Array.isArray(input.scheduledFacts) ? input.scheduledFacts.length : 0;
    var work = F0 + (Array.isArray(input.directFacts) ? input.directFacts.length : 0) + modCount + schedCount + atomicCount;
    if (work > CAPS.MAX_WORK_UNITS_PER_CALL) throw rejection('CAP_EXCEEDED', { work: work });
    var rowsOut = computeRows(input);
    var candRecs = candidateFeatures(input, rowsOut.outsideCount + schedCount, rowsOut.outsideFactIds);
    var doc = assemble(input.candidate.candidateId, candRecs.concat(chargeTargetRows(input)).concat(rowsOut.recs));
    var frozen = freezeDeep(doc);
    if (m) {
      m.calls += 1;
      m.workUnitsTotal += work;
      m.lastWorkUnits = work;
      m.lastFeatureCount = frozen.featureCount;
      m.lastCandidateId = input.candidate.candidateId;
    }
    return frozen;
  }

  var metrics = freshMetrics();

  function compileCandidate(input) {
    try {
      return compileCore(input, metrics);
    } catch (e) {
      var code = (e && (e.code || e.reasonCode)) || 'UNKNOWN';
      metrics.rejections[code] = (metrics.rejections[code] || 0) + 1;
      metrics.lastRejection = code;
      throw e;
    }
  }
  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function buildRegistry() {
    return {
      schemaVersion: SCHEMA_VERSION,
      contractId: REGISTRY_ID,
      revision: REVISION,
      role: ROLE,
      mount: MOUNT_NAME,
      apiSurface: ['compileCandidate', 'inputSchema', 'registry', 'readMetrics'],
      authority: {
        milestone: 'M2',
        claim: 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED',
        declaredMagnitudeOnly: true,
        finalSettlement: 'DEFERRED_TO_DOWNSTREAM_KERNEL',
        futureRouteDerivation: false,
        worldClone: false,
        runtimeFutureTraversal: false,
        resultWorldCartesian: false,
        inputMode: 'CANDIDATES_ONLY'
      },
      featureCodes: FEATURE_CODES.slice(),
      candidateFeatureCodes: CANDIDATE_CODES.slice(),
      effectRowFeatureCodes: ROW_CODES.slice(),
      unitFamily: copyOf(UNIT_FAMILY),
      boolFeatureCodes: BOOL_CODES.slice(),
      batch1PrototypeFamilies: copyOf(BATCH1_FAMILY),
      batch2PrototypeFamilies: copyOf(BATCH2_FAMILY),
      fixedCatalogPositionsV1: {
        'RELATION_TARGET_COUNT': 0, 'RELATION_TARGET_SIDE': 1, 'SUCCESS_PROBABILITY': 2,
        'PUBLIC_HP_RATIO': 3, 'PUBLIC_RESOURCE_RATIO': 4, 'COST_AFFORDABILITY': 5,
        'REVEAL_STRENGTH': 6, 'OVERKILL_AVAILABILITY': 7, 'HARD_EXCLUSION': 8,
        'HARD_EXCLUSION_REASON': 9, 'SETTLEMENT_DAMAGE': 10, 'ROLL_REALIZATION': 11,
        'OUTSIDE_BATCH1_ROW_COUNT': 12, 'DAMAGE_POWER': 13, 'DAMAGE_SEGMENTS': 14,
        'DAMAGE_PENETRATION': 15, 'DAMAGE_TYPE': 16, 'RESOURCE_DELTA': 17,
        'SHIELD_DELTA': 18, 'ATTRIBUTE_DELTA': 19, 'JUDGMENT_DELTA': 20,
        'STATE_PRESENCE': 21, 'STATE_DURATION': 22, 'STATE_DELTA_PERCENT': 23,
        'SETTLEMENT_MODIFIER_PERCENT': 24, 'SUMMON_COUNT': 25, 'SUMMON_STRENGTH': 26,
        'SUMMON_DURATION': 27, 'RESOURCE_DELTA_PERCENT': 28,
        'PUBLIC_RECIPIENT_NEED_MATCH': 29, 'TARGET_CHARGE_ACTIVE': 30,
        'TARGET_CHARGE_CAST_TIME': 31, 'REACTION_DAMAGE_MULTIPLIER': 32,
        'REACTION_DODGE_PROBABILITY': 33, 'REACTION_COUNTER_WINDOW_OPEN': 34
      },
      caps: copyOf(CAPS),
      workFormula: '14 (F0) + directFactsRows + modifierEntries + scheduledFactsEntries + atomicFactsCount (each row yields at most its own features; no cross-row/branch product); any breach throws CAP_EXCEEDED whole-compile',
      statusReasonCodes: { KNOWN: ['OK'], UNKNOWN: UNKNOWN_REASONS.slice(), NOT_APPLICABLE: NA_REASONS.slice() },
      hardExclusionCodes: HARD_EXCLUSION_CODES.slice(),
      rejectionReasonCodes: [
        'ROUTE_INPUT_REJECTED', 'WORLD_CLONE_REJECTED', 'RESULT_WORLD_CARTESIAN_REJECTED',
        'HIDDEN_INPUT_REJECTED', 'WALL_CLOCK_REJECTED', 'SKILL_ROLE_NAME_SPECIAL_CASE_REJECTED',
        'TEACHER_INPUT_REJECTED', 'BRANCH_COMBINATION_FORBIDDEN', 'NON_FINITE_REJECTED',
        'DUPLICATE_FEATURE', 'UNIT_FAMILY_MISMATCH', 'UNKNOWN_ZERO_PLACEHOLDER',
        'DURATION_MULTIPLIES_MAGNITUDE', 'UNKNOWN_FEATURE_CODE', 'UNKNOWN_UNIT_FAMILY',
        'INVALID_STATUS_VALUE', 'MISSING_SOURCE_REFERENCE', 'INVALID_OPTION_VALUE', 'CAP_EXCEEDED'
      ],
      contractHashes: copyOf(CONTRACT_HASHES),
      subsetSemantics: 'UNORDERED_MULTISET_WITH_COUNT_ASSERTIONS; expect order never represents output order; featureOrdering is the single global output order',
      identityRules: {
        charset: 'candidateId/actorId/actorSide/actionKind/paymentMode/target ids/eventId/entryId: nonempty, <=512, C0 (U+0000-U+001F) and DEL (U+007F) rejected; CJK/hyphen/space allowed; equality by UTF-16 code unit',
        sidesCoverage: 'sides must contain actorId and every declared target; missing target side makes RELATION_TARGET_SIDE UNKNOWN(SIDE_UNOBSERVED)',
        sidesConsistency: 'sides[actorId] must equal actorSide, violation rejects MISSING_SOURCE_REFERENCE',
        targetCount: 'RELATION_TARGET_COUNT = unique declared targetSet length; unknown units never dropped',
        noGuessing: 'no id-prefix guessing, no neutral-side folding, no default ALLY; RELATION_TARGET_SIDE uses t===actorId => SELF, sides[t]===actorSide => ALLY, other value => ENEMY, distinct classes => MIXED'
      },
      semantics: {
        judgmentSingleSource: 'JUDGMENT_DELTA magnitude comes from the directFacts STATE_DELTA row only; legalityModifiers.judgmentRates are metadata and never a second magnitude',
        durationNeverMultiplies: 'STATE_DURATION keeps durationTurns raw; pre-multiplied inputs reject DURATION_MULTIPLIES_MAGNITUDE',
        multiTargetOnce: 'RELATION_TARGET_COUNT counts the unique declared target set once; EFFECT_ROW features never expand per targetIds',
        unknownNeverZero: 'UNKNOWN/NOT_APPLICABLE never carry value; 0 placeholders are forbidden',
        declaredNeverSettlement: 'SETTLEMENT_DAMAGE and ROLL_REALIZATION are always UNKNOWN',
        costActorOnly: 'COST_AFFORDABILITY reads publicSnapshot.units[actorId] only; frozen resource map 魂力->sp, 精神力->men, 体力->vit, 生命->hp; clamp(available/required,0,1), min over entries; target resources never consulted',
        recipientNeedMatch: 'PUBLIC_RECIPIENT_NEED_MATCH reads only the structured creationProfile (recipientId + closed useEffects rows) against the same observer-visible recipient resource axes (frozen map 魂力->sp, 精神力->men, 体力->vit, 生命->hp); recovery channel = 资源变化 row with positive percent 数值 (percent /100 is the sole admitted unit; negative/zero rows are drains and never count); per (recipientId, resource) duplicates take max, never sum; value = arithmetic mean over the actual recovery channels; no recovery channel (absent creationProfile, non-recovery or empty useEffects) => KNOWN 0; missing recipientId, recipient unit/current/max unprovable, max<=0, unmappable resource name or unprovable percent unit => UNKNOWN (MISSING_SOURCE_FACT / HIDDEN_AXIS_UNOBSERVED), never guessed; no hidden reads, no future route, no role/skill-name special-casing',
        resourceInsufficientDerivation: 'RESOURCE_INSUFFICIENT derives from the same actor-only affordability check, last in precedence (after legalityFlags/legalityModifiers, actorStatus, TARGET_EMPTY): KNOWN min ratio < 1 (strict cost > available) => RESOURCE_INSUFFICIENT; equality and affordable => not excluded; no publicCost, missing actor/axis or UNKNOWN => no exclusion, never guessed; other hard-exclusion codes keep first-code precedence',
        targetSide: 'sides-map equality only (SELF by id equality, ALLY by side equality, ENEMY otherwise, MIXED on distinct classes, SIDE_UNOBSERVED when any declared target side missing, NO_TARGET_AXIS on empty axis); no prefix guessing/default ALLY/neutral folding',
        successProbability: 'R4b2 damage-delivery hit axis: only outcomeKind HP_DELTA rows with evidence.damageBasis.basisView DECISION_VISIBLE, nonempty effectInstanceId/targetId and finite hitProbability are deliveries; dedupe by (effectInstanceId,targetId), same identity differing probability => UNKNOWN(CONFLICTING_DELIVERIES); per-target mean over independent deliveries then mean over hit-axis targets (targets without delivery are NO_HIT_AXIS and excluded from the denominator); no damage delivery at all => NOT_APPLICABLE(NO_HIT_AXIS); deliveryStatus MISSING/NON_FINITE or missing identity/basis => UNKNOWN fail-closed; empty targetSet keeps existing missing semantics; no FIRST/JOINT/MIN/MAX/applicationProbability/Runtime roll; actionKind never special-cased',
        outsideRowCounting: 'rows outside the batch-1 families plus every scheduledFacts entry count into OUTSIDE_BATCH1_ROW_COUNT; scheduled entryIds recorded in sourceEventIds; nothing silently dropped',
        statePresence: 'STATE_DELTA non-attribute/judgment key: unit=BOOL => KNOWN 1 (amount>0) or 0 (amount<=0); unit=COUNT => UNKNOWN(STATE_FORM_UNMAPPED), never coerced to BOOL; other units => UNIT_FAMILY_MISMATCH; BOOL KNOWN domain strictly {0,1}',
        batch2StateDeltaPercent: 'STATE_DELTA state.primary/state.secondary PERCENT => STATE_DELTA_PERCENT (signed declared magnitude, never multiplied by duration); other PERCENT keys => UNKNOWN(MISSING_SOURCE_FACT); other units/keys keep revision-2 STATE_PRESENCE/UNIT_FAMILY_MISMATCH rules',
        resourceDeltaPercent: 'RESOURCE_OPTION_CHANGED key=resource name unit=PERCENT => RESOURCE_DELTA_PERCENT (raw signed percent, never multiplied by duration); ABS rows keep RESOURCE_DELTA; unsigned percent rows stay PENDING_DIRECTION_PROJECTION upstream and never reach the compiler',
        batch2Settlement: 'STATE_DELTA settlement.primary PERCENT => SETTLEMENT_MODIFIER_PERCENT only (no STATE_DURATION, no HP/RESOURCE double rows from the same effect); SETTLEMENT_DAMAGE stays ALWAYS_UNKNOWN',
        batch2Summon: 'SUMMON_WINDOW rows route summon.count/strength/duration (wrong unit => UNKNOWN(MISSING_SOURCE_FACT) with row fact id); summon.inheritRatio and unknown summon keys map to no feature code and count OUTSIDE_BATCH1_ROW_COUNT with row fact ids; the summon family block (all three codes) is emitted once per activating sourceEffectId (routed row or projectionFamilies 召唤生成); scheduled SUMMON_WINDOW entries never become KNOWN SUMMON_DURATION',
        auditBridges: 'mechanicMetadataEntries (closed per-effect array with per-prototype key subsets per PDA rev5Spec) / projectionFamilies root inputs are the only admitted bridge (bridgeV1); strictly validated closed shapes; values never enter feature values; prototype names are routing/audit identity only (PROTOTYPE_NAME_WEIGHTING_REJECTED)',
        formalCaps: 'MAX_FEATURES_PER_CANDIDATE=256, MAX_FACT_ROWS_PER_CANDIDATE=128, MAX_MODIFIER_ENTRIES_PER_CANDIDATE=64, MAX_WORK_UNITS_PER_CALL=200000; any breach throws CAP_EXCEEDED as a whole-compile rejection, never candidate pruning, never wall clock'
      }
    };
  }

  function buildInputSchema() {
    return {
      schemaVersion: SCHEMA_VERSION,
      surface: 'CANDIDATES_ONLY',
      requiredTopLevel: ['candidate', 'publicSnapshot'],
      keys: {
        candidate: { required: true, shape: { candidateId: 'string nonempty <=512 no C0/DEL', actorId: 'string nonempty <=512 no C0/DEL', actorSide: 'string nonempty <=512 no C0/DEL', actionKind: 'string nonempty <=512 no C0/DEL (identity only)', targetSet: 'unique string[] of nonempty ids <=512 no C0/DEL', paymentMode: 'string nonempty <=512 no C0/DEL (identity only)' }, closed: true },
        publicSnapshot: {
          required: true,
          shape: {
            units: { '<unitId>': { hp: 'number', hp_max: 'number', sp: 'number', sp_max: 'number', men: 'number', men_max: 'number', vit: 'number', vit_max: 'number', def: 'number', agi: 'number', shield: 'number', 状态效果: 'object' } },
            sides: 'unitId -> opaque side id string 1..512; must contain actorId with sides[actorId]===actorSide',
            actorStatus: 'enum NORMAL|DISABLED|TERMINAL|UNKNOWN (required)'
          },
          closed: true
        },
        atomicFacts: { required: false, shape: [{ eventId: 'string nonempty', hitCheckApplicability: 'enum APPLICABLE|NOT_APPLICABLE|UNKNOWN', effectInstanceId: 'string (delivery identity, required for HP_DELTA APPLICABLE)', targetId: 'string (delivery target, required for HP_DELTA APPLICABLE)', evidence: { hitProbability: 'number finite (required when APPLICABLE unless deliveryStatus set)', damageBasis: '{ basisView: enum DECISION_VISIBLE|BELIEF|RUNTIME_ACTUAL } (required for HP_DELTA APPLICABLE)', deliveryStatus: 'enum MISSING|NON_FINITE (explicit fail-closed carrier)' }, sourceActionId: 'string', outcomeKind: 'string', expectedDelta: 'number finite' }], closed: true },
        directFacts: { required: false, shape: 'DirectFactRowV1 rows: schemaVersion const DirectFactRowV1, factType enum, key string, sourceActionId/sourceActorId/sourceEffectId nonempty, sourceActorId===candidate.actorId, targetIds nonempty non-symbolic, amount finite, unit enum, durationTurns integer >=0', closed: true },
        legalityFlags: { required: false, shape: 'string[] every member in hardExclusionCodes' },
        legalityModifiers: { required: false, shape: 'judgmentRates/taunt/tauntRemoved/stateMigration/stateSwap/mechanismRemoval metadata; hardExclusions/legalityFlags code arrays restricted to hardExclusionCodes', closed: true },
        opportunityModifiers: { required: false, shape: 'resourceLocks/opportunityConstraints/interferenceRates/dependencyTokens metadata', closed: true },
        scheduledFacts: { required: false, shape: 'closed four-shape: WINDOW_ADJUST {entryId/operation/调整字段/调整方式 + optional 调整回合/调整tick/调整次数/结算倍率}, SETTLEMENT_RATIO_ADJUST {entryId/operation/结算倍率}, FOLLOW_UP {entryId/grantType/ownerId/followUpKey/triggerKey/payloadDirectFacts, maxActions integer >=1 and required only for 主动触发}, SUMMON_WINDOW {entryId/grantType/召唤单位类型/召唤物名称/行动模式/durationTurns}; entryId/ownerId/followUpKey required; all IDs validateIdString; private aliases key/字段/方式 rejected', closed: true },
        mechanicMetadataEntries: { required: false, shape: 'closed entries array, one entry per effect instance: {sourceEffectId (required id) + prototype-allowed Chinese keys} per PDA rev5Spec perPrototypeSubsets (生效方式/结算标签/抗性类型/驱动属性/影响方向/对应等级/触发方式/触发限制/结算/限定元素/吸收资源/吸收来源); audit-only, values never enter features', closed: true },
        projectionFamilies: { required: false, shape: '[{ sourceEffectId: id string, prototype: closed registry prototype enum }] unique; audit-only routing identity, never weighted', closed: true },
        prototypeRegistry: { required: false, shape: '{ registryId: string prefix RC6-M2-PROTOTYPE-DIRECT-ADAPTER, prototypeNames: unique canonical-sorted nonempty strings, prototypeRegistryHash: 8-hex fnv1a32 of canonical names JSON, sourceContractHash: 64-hex equal to governed adapterContract pin } read-only PDA registry attestation carrier; required whenever projectionFamilies present; values never enter features', closed: true },
        publicCost: { required: false, shape: [{ resource: 'enum 魂力|精神力|体力|生命', amount: 'number finite positive' }], closed: true, semantics: 'declared costs only; drives COST_AFFORDABILITY and the RESOURCE_INSUFFICIENT hard exclusion (strict cost > available on the same observer-visible units[actorId] axis; equality affordable; missing/non-finite facts never guess)' },
        publicProbability: { required: false, shape: '{ hitProbability: number finite, source?: string } or { resolved: false, unresolvedCondition?: string }', closed: true },
        publicDeclarations: { required: false, shape: { revealStrength: 'number finite', declaredOverkill: 'number finite' }, closed: true }
        ,
        actionOpportunity: { required: false, shape: '{ role: id, sourceActorId?: id, incomingAction: normalized plain object, actionContext?: { actionEvent: { actionId: id, eventId: id }, targetResolutionEvent?: { eventId: id } }, counterWindow?: boolean, reactionMechanics: closed candidate-level carrier; actionContext is provenance-only and never a feature/value input }', closed: true },
        creationProfile: { required: false, shape: '{ recipientId: nonempty id <=512 no C0/DEL, useEffects: rows closed {原型,目标,资源,数值} (原型/目标/数值 nonempty strings, 资源 single nonempty string or unique nonempty string array) }', closed: true, semantics: 'structured creation declaration carrier; drives PUBLIC_RECIPIENT_NEED_MATCH only (positive percent 资源变化 rows vs the same observer-visible recipient resource axes; per (recipientId, resource) duplicates max; arithmetic mean over actual recovery channels; no channel => KNOWN 0; recipient/axis/percent unit unprovable => UNKNOWN fail-closed; drains/zero rows never count)' }
      },
      forbiddenKeys: ['forbiddenFacts', 'branchCombination', 'preMultiplied', 'route', 'worldClone', 'resultWorld', 'hidden', 'wallClock', 'skillRoleName', 'teacher', 'kernelRouteValue', 'prototypeNameWeighting'],
      note: 'pure compiler; closed input contract; never invokes Decision/Preview/Provider; never traverses future routes'
    };
  }

  function readMetrics() {
    var rej = {};
    for (var k in metrics.rejections) if (hasOwn(metrics.rejections, k)) rej[k] = metrics.rejections[k];
    return freezeDeep({
      calls: metrics.calls,
      workUnitsTotal: metrics.workUnitsTotal,
      lastWorkUnits: metrics.lastWorkUnits,
      lastCandidateId: metrics.lastCandidateId,
      lastFeatureCount: metrics.lastFeatureCount,
      rejections: rej,
      lastRejection: metrics.lastRejection
    });
  }

  var api = {
    compileCandidate: compileCandidate,
    inputSchema: function () { return freezeDeep(buildInputSchema()); },
    registry: function () { return freezeDeep(buildRegistry()); },
    readMetrics: readMetrics,
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

// ===== candidateFeatureSource (BehaviorCandidateFeatureSource_Module.js) =====

(function (root) {
  'use strict';

  var RESOURCES = ['sp', 'men', 'vit', 'hp'];
  var RESOURCE_FIELDS = { sp: 'sp', men: 'men', vit: 'vit', hp: 'hp' };
  var RESOURCE_LABEL_KEYS = { 魂力: 'sp', 精神力: 'men', 体力: 'vit', 生命: 'hp' };
  var TARGET_CODES = { 自身: 'SELF', 单体: 'SINGLE', 群体: 'GROUP', 全场: 'FIELD', 召唤物: 'SUMMON' };
  var CARRIER_CODES = { 直接生效: 'DIRECT', 物品使用: 'ITEM_USE', 造物承载: 'CREATION', 持续生效: 'SUSTAINED', 被动: 'PASSIVE' };
  var PROJECTORS = {
    TEAM_EFFECT: 'BRF_TEAM_EFFECT_V1',
    RESOURCE_SUPPLY: 'BRF_RESOURCE_SUPPLY_V1',
    FOLLOW_UP: 'BRF_EXPLICIT_FOLLOW_UP_V1',
    NOT_RELATIONAL: 'BRF_NOT_RELATIONAL_V1',
  };
  var REGISTRY_HASH = '85016b9198590c5deb6ac4675c4f95dd7fbae164692720a087af6188e4ff6586';
  var REGISTRY_ROWS = [
    ['伤害结算', 'BATTLE', 'NOT_RELATIONAL', ''], ['位移执行', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['修炼增益', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''], ['决策干扰', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['判定修正', 'BATTLE', 'TEAM_EFFECT', 'JUDGMENT'], ['召唤生成', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['复制执行', 'BATTLE', 'NOT_RELATIONAL', ''], ['天赋提升', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''],
    ['属性修正', 'BATTLE', 'TEAM_EFFECT', 'ATTRIBUTE'], ['战斗外复活', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''],
    ['护盾变化', 'BATTLE', 'NOT_RELATIONAL', ''], ['时光回溯', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['时窗修正', 'BATTLE', 'NOT_RELATIONAL', ''], ['机制抹消', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['机制授予', 'BATTLE', 'NOT_RELATIONAL', ''], ['永久属性提升', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''],
    ['炸环', 'BATTLE', 'NOT_RELATIONAL', ''], ['状态交换', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['状态施加', 'BATTLE', 'TEAM_EFFECT', 'STATE_APPLY'], ['状态移除', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['状态转移', 'BATTLE', 'NOT_RELATIONAL', ''], ['结算修正', 'BATTLE', 'TEAM_EFFECT', 'SETTLEMENT'],
    ['规则改写', 'BATTLE', 'NOT_RELATIONAL', ''], ['规则防御', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['资源变化', 'BATTLE', 'RESOURCE_SUPPLY', ''], ['资源转移', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['资源锁定', 'BATTLE', 'NOT_RELATIONAL', ''],
  ];
  var REGISTRY = Object.create(null);
  REGISTRY_ROWS.forEach(function (row) {
    REGISTRY[row[0]] = {
      prototypeKind: row[0], scope: row[1], capabilityKind: row[2],
      projectorId: PROJECTORS[row[2]], effectAxis: row[3],
    };
  });

  function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function isPlainObject(value) {
    if (!isObject(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor && proto.constructor.name === 'Object');
  }
  function own(value, key) { return isObject(value) && Object.prototype.hasOwnProperty.call(value, key); }
  function validId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
  }
  function canonicalActionId(candidate) {
    var declaration = candidate && candidate.declaration;
    if (declaration === undefined) return candidate && candidate.candidateId || '';
    if (!isPlainObject(declaration)) fail('SOURCE_ACTION_ID_INVALID', candidate && candidate.candidateId);
    if (!own(declaration, 'actionId')) return candidate && candidate.candidateId || '';
    if (!validId(declaration.actionId)) fail('SOURCE_ACTION_ID_INVALID', candidate && candidate.candidateId);
    return declaration.actionId;
  }
  function canonicalEffectId(effect, rootActionId, index) {
    if (effect === undefined) return rootActionId + ':effect:' + index;
    if (!isPlainObject(effect)) fail('SOURCE_EFFECT_ID_INVALID', rootActionId + ':effect:' + index);
    var hasEffectId = own(effect, 'effectId'), hasChineseId = own(effect, '效果ID');
    var effectId = hasEffectId ? effect.effectId : null;
    var chineseId = hasChineseId ? effect['效果ID'] : null;
    if ((hasEffectId && !validId(effectId)) || (hasChineseId && !validId(chineseId))) {
      fail('SOURCE_EFFECT_ID_INVALID', rootActionId + ':effect:' + index);
    }
    if (hasEffectId && hasChineseId && effectId !== chineseId) {
      fail('SOURCE_EFFECT_ID_CONFLICT', rootActionId + ':effect:' + index);
    }
    return hasEffectId ? effectId : hasChineseId ? chineseId : rootActionId + ':effect:' + index;
  }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  function uniqueIds(values) {
    var result = [], seen = Object.create(null);
    (Array.isArray(values) ? values : []).forEach(function (value) {
      if (!validId(value) || seen[value]) return;
      seen[value] = true; result.push(value);
    });
    return result.sort();
  }
  function uniqueArrayIsValid(values) {
    if (!Array.isArray(values)) return false;
    var seen = Object.create(null), valid = true;
    values.forEach(function (value) { if (!validId(value) || seen[value]) valid = false; seen[value] = true; });
    return valid;
  }
  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function sortObjects(values) {
    return values.slice().sort(function (a, b) { return compare(JSON.stringify(a), JSON.stringify(b)); });
  }
  function normalizeCosts(costs) {
    var values = {}, complete = isObject(costs);
    if (!complete) return { values: values, complete: false };
    Object.keys(costs).sort().forEach(function (rawKey) {
      var key = canonicalResourceKey(rawKey), amount = finite(costs[rawKey]);
      if (!key || amount === null || amount <= 0 || own(values, key)) { complete = false; return; }
      values[key] = amount;
    });
    return { values: values, complete: complete };
  }
  function mechanicalTargetModes(skill) {
    var effects = skill && skill._效果数组, raw = [], modes = [];
    if (!Array.isArray(effects)) return null;
    if (own(skill, 'targetMode')) raw.push(skill.targetMode);
    effects.forEach(function (effect) { if (own(effect, '目标')) raw.push(effect['目标']); });
    raw.forEach(function (value) {
      var mode = TARGET_CODES[value] || (['SELF', 'SINGLE', 'GROUP', 'FIELD', 'SUMMON'].indexOf(value) >= 0 ? value : '');
      if (!mode) modes = null; else if (modes && modes.indexOf(mode) < 0) modes.push(mode);
    });
    return modes && modes.length ? modes.sort() : null;
  }
  function mechanicalPrototypeKinds(skill) {
    var effects = skill && skill._效果数组, kinds = [], seen = Object.create(null);
    if (!Array.isArray(effects)) return null;
    effects.forEach(function (effect) {
      var kind = effect && effect['原型'];
      if (!isObject(effect) || !validId(kind)) { kinds = null; return; }
      if (kinds && !seen[kind]) { seen[kind] = true; kinds.push(kind); }
    });
    return kinds && kinds.sort();
  }
  function mechanicalFingerprint(skill, costs, previewApi) {
    var normalized = normalizeCosts(costs), prototypeKinds = mechanicalPrototypeKinds(skill);
    var targetModes = mechanicalTargetModes(skill), carrier = skill && CARRIER_CODES[skill['承载方式']];
    if (!normalized.complete || !prototypeKinds || !targetModes || !carrier) return '';
    var payload = {
      actionKind: 'RELEASE_SKILL', resourceCosts: normalized.values,
      prototypeKinds: prototypeKinds, targetModes: targetModes, carrierMode: carrier,
    };
    var hash = '';
    try { hash = previewApi.stableHash(payload); } catch (error) { return ''; }
    return validId(hash) ? 'public-action:' + hash : '';
  }
  function fail(code, detail) { throw new Error(code + (detail ? ':' + detail : '')); }
  function requireFunction(value, name) { if (typeof value !== 'function') fail('SOURCE_API_REQUIRED', name); }
  function requireFormalApi(value, formal, name) {
    if (!isObject(formal) || value !== formal) fail('SOURCE_FORMAL_API_REQUIRED', name);
  }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { freeze(value[key]); });
    return Object.freeze(value);
  }
  function addIds(set, values) {
    (Array.isArray(values) ? values : []).forEach(function (value) {
      if (validId(value)) set.add(value);
    });
  }
  function addVerified(set, value) {
    if (validId(value)) set.add(value);
  }
  function addVerifiedArray(set, value) {
    if (Array.isArray(value)) value.forEach(function (item) { addVerified(set, item); });
  }
  function linkVerified(verified, values, ownerId, actionId) {
    (Array.isArray(values) ? values : []).forEach(function (value) {
      if (!validId(value)) return;
      var link = verified.links[value] || { owners: new Set(), actions: new Set() };
      if (validId(ownerId)) link.owners.add(ownerId);
      if (validId(actionId)) link.actions.add(actionId);
      verified.links[value] = link;
    });
  }
  function sourceValues(row, scalarKeys, arrayKeys) {
    var values = [];
    scalarKeys.forEach(function (key) { if (own(row, key)) values.push(row[key]); });
    arrayKeys.forEach(function (key) {
      if (own(row, key)) values = values.concat(Array.isArray(row[key]) ? row[key] : [row[key]]);
    });
    return values;
  }
  function pdaRefs(row, verified) {
    return refs({
      sourceFactIds: sourceValues(row, ['sourceEffectId'], ['sourceFactIds']),
      sourceEventIds: sourceValues(row, ['sourceActionId', 'entryId'], ['sourceEventIds']),
    }, verified);
  }
  function previewRefs(row, verified) {
    return refs({
      sourceFactIds: sourceValues(row, ['semanticKey', 'effectInstanceId', 'rootCauseId'], ['sourceFactIds']),
      sourceEventIds: sourceValues(row, ['sourceActionId'], ['sourceEventIds']),
    }, verified);
  }
  function refs(value, verified) {
    var facts = [], events = [], ok = true;
    var seenFacts = Object.create(null), seenEvents = Object.create(null);
    function read(key, target, known) {
      if (!own(value, key)) return;
      if (!Array.isArray(value[key])) { ok = false; return; }
      value[key].forEach(function (item) {
        var seen = target === facts ? seenFacts : seenEvents;
        var invalid = !validId(item) || !known.has(item) || seen[item];
        seen[item] = true;
        if (invalid) ok = false;
        else target.push(item);
      });
    }
    read('sourceFactIds', facts, verified.facts); read('sourceEventIds', events, verified.events);
    facts = uniqueIds(facts); events = uniqueIds(events);
    if (facts.length + events.length === 0) ok = false;
    return { facts: facts, events: events, ok: ok };
  }
  function indexRefs(closure, pair) {
    addIds(closure.facts, pair.facts); addIds(closure.events, pair.events);
  }
  function isFollowUpRow(row) { return isObject(row) && row.grantType === 'FOLLOW_UP'; }
  function grantFields(row, visibleUnitIndex) {
    var ownerId = validId(row && row.ownerId) ? row.ownerId : '';
    var followUpKey = validId(row && row.followUpKey) ? row.followUpKey : '';
    var entryId = validId(row && row.entryId) ? row.entryId : '';
    var ownerVisible = !!visibleUnitIndex
      && Object.prototype.hasOwnProperty.call(visibleUnitIndex, ownerId);
    var rowProofsValid = !own(row, 'grantProofIds')
      || (uniqueArrayIsValid(row.grantProofIds)
        && JSON.stringify(uniqueIds(row.grantProofIds)) === JSON.stringify([entryId]));
    if (!ownerId || !ownerVisible || !followUpKey || !entryId || !rowProofsValid) return null;
    return { ownerId: ownerId, followUpKey: followUpKey, entryId: entryId, proofs: [entryId] };
  }
  function grantAdmission(row, verified, visibleUnitIndex) {
    var admission = grantFields(row, visibleUnitIndex), pair = pdaRefs(row, verified);
    var entryInPair = admission && (pair.events.indexOf(admission.entryId) >= 0 || pair.facts.indexOf(admission.entryId) >= 0);
    if (!admission || !verified.authenticated.has(admission.entryId) || !entryInPair) return null;
    return admission;
  }
  function authenticatePdaRow(verified, row) {
    addIds(verified.authenticated, sourceValues(row,
      ['sourceEffectId'], ['sourceFactIds', 'sourceEventIds', 'sourceActionIds']));
    addIds(verified.authenticated, sourceValues(row,
      ['sourceActionId', 'entryId'], []));
  }
  function authenticatePreviewRow(verified, row) {
    addIds(verified.authenticated, sourceValues(row,
      ['semanticKey', 'effectInstanceId', 'rootCauseId'], ['sourceFactIds', 'sourceEventIds']));
    addIds(verified.authenticated, sourceValues(row, ['sourceActionId'], []));
  }
  function indexPdaRow(verified, row, grantReady) {
    if (isFollowUpRow(row) && grantReady !== true) return false;
    var factIds = sourceValues(row, ['sourceEffectId'], ['sourceFactIds']);
    var eventIds = sourceValues(row, ['sourceActionId', 'entryId'], ['sourceEventIds']);
    addVerifiedArray(verified.facts, factIds); addVerifiedArray(verified.events, eventIds);
    linkVerified(verified, factIds.concat(eventIds), row && (row.sourceActorId || row.ownerId), row && row.sourceActionId);
    if (Array.isArray(row && row.payloadDirectFacts)) row.payloadDirectFacts.forEach(function (fact) {
      indexPdaRow(verified, fact, false);
    });
    return true;
  }
  function indexPreviewRow(verified, row, grantReady) {
    if (isFollowUpRow(row) && grantReady !== true) return false;
    var factIds = sourceValues(row, ['semanticKey', 'effectInstanceId', 'rootCauseId'], ['sourceFactIds']);
    var eventIds = sourceValues(row, ['sourceActionId'], ['sourceEventIds']);
    addVerifiedArray(verified.facts, factIds); addVerifiedArray(verified.events, eventIds);
    linkVerified(verified, factIds.concat(eventIds), row && row.sourceActorId, row && row.sourceActionId);
    return true;
  }
  function targetIds(fact) {
    return uniqueArrayIsValid(fact && fact.targetIds) ? uniqueIds(fact.targetIds) : [];
  }
  function durationBand(fact) {
    var turns = finite(fact && fact.durationTurns);
    if (turns === null || !Number.isInteger(turns) || turns < 0) return '';
    return turns === 0 ? 'INSTANT' : turns === 1 ? 'SHORT' : turns <= 3 ? 'MEDIUM' : 'LONG';
  }
  function typedEffectKey(fact) {
    var amount = finite(fact && fact.amount);
    var direction = amount === null ? '' : amount > 0 ? 'POSITIVE' : amount < 0 ? 'NEGATIVE' : 'NEUTRAL';
    if (!validId(fact && fact.factType) || !validId(fact && fact.key) || !validId(fact && fact.unit) || !direction) return '';
    return JSON.stringify([fact.factType, fact.key, fact.unit, direction]);
  }
  function entryKey(entry) {
    return entry.capabilityKind === 'TEAM_EFFECT'
      ? JSON.stringify([entry.targetId, entry.effectAxis, entry.effectKey, entry.timeBand])
      : entry.capabilityKind === 'RESOURCE_SUPPLY'
        ? JSON.stringify([entry.targetId, entry.resourceKey, entry.timeBand])
        : JSON.stringify([entry.ownerId, entry.followUpKey]);
  }
  function addEntry(entries, identities, entry) {
    var key = entryKey(entry);
    if (identities[key]) {
      var existing = identities[key];
      if (existing.capabilityKind !== entry.capabilityKind || existing.ownerId !== entry.ownerId) return false;
      if (entry.capabilityKind === 'TEAM_EFFECT' && existing.durationBand !== entry.durationBand) return false;
      if (entry.capabilityKind === 'RESOURCE_SUPPLY') {
        if (existing.publicMaxAmount !== entry.publicMaxAmount) return false;
        existing.supplyAmount += entry.supplyAmount;
      }
      existing.sourceFactIds = uniqueIds(existing.sourceFactIds.concat(entry.sourceFactIds));
      existing.sourceEventIds = uniqueIds(existing.sourceEventIds.concat(entry.sourceEventIds));
      return true;
    }
    identities[key] = entry; entries.push(entry); return true;
  }
  function verifyRegistryAuthority() {
    var keys = REGISTRY_ROWS.map(function (row) { return row[0]; });
    if (REGISTRY_ROWS.length !== 27 || new Set(keys).size !== 27 || REGISTRY_HASH.length !== 64) fail('SOURCE_REGISTRY_AUTHORITY_FATAL');
    var battleCount = 0;
    REGISTRY_ROWS.forEach(function (row) {
      var expected = REGISTRY[row[0]];
      if (!expected || expected.prototypeKind !== row[0] || expected.scope !== row[1]
        || expected.capabilityKind !== row[2] || expected.projectorId !== PROJECTORS[row[2]]
        || expected.effectAxis !== row[3]) fail('SOURCE_REGISTRY_AUTHORITY_FATAL', row[0]);
      if (row[1] === 'BATTLE') battleCount += 1;
    });
    if (battleCount !== 23) fail('SOURCE_REGISTRY_AUTHORITY_FATAL');
  }
  function registryAttestation(pdaApi) {
    verifyRegistryAuthority();
    var actual = pdaApi.registry();
    var actualRows = actual && actual.registry;
    if (!isObject(actualRows)) fail('SOURCE_REGISTRY_ATTESTATION_MISMATCH');
    var expectedKeys = REGISTRY_ROWS.map(function (row) { return row[0]; }).sort();
    var actualKeys = Object.keys(actualRows).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) fail('SOURCE_REGISTRY_ATTESTATION_MISMATCH');
    var actualBattleCount = 0;
    REGISTRY_ROWS.forEach(function (row) {
      var actualRow = actualRows[row[0]] || {}, expected = REGISTRY[row[0]];
      var scope = own(actualRow, 'scope') ? actualRow.scope : actualRow.category === '战斗外' ? 'OUT_OF_BATTLE_SCOPE' : actualRow.category ? 'BATTLE' : '';
      if (scope !== expected.scope) fail('SOURCE_REGISTRY_SCOPE_MISMATCH', row[0]);
      if (scope === 'BATTLE') actualBattleCount += 1;
    });
    if (actualBattleCount !== 23) fail('SOURCE_REGISTRY_BATTLE_COVERAGE_MISMATCH');
    return {
      registryVersion: 'BehaviorRelationalProjectorRegistryV1',
      registryHash: REGISTRY_HASH,
      mappedCount: 27, battleScopeCount: 23, exactMapping: true,
      projectorIds: [PROJECTORS.FOLLOW_UP, PROJECTORS.NOT_RELATIONAL, PROJECTORS.RESOURCE_SUPPLY, PROJECTORS.TEAM_EFFECT].sort(),
    };
  }
  function visibleUnits(request, verified, closure, candidateIds) {
    var world = request.visibleWorld, participants = world && world.参战者;
    var entries = [], byId = Object.create(null), complete = true;
    if (!isObject(participants)) return { entries: entries, byId: byId, complete: false };
    Object.keys(participants).sort().forEach(function (side) {
      var list = participants[side];
      if (!Array.isArray(list)) { complete = false; return; }
      list.forEach(function (unit, index) {
        var unitId = unit && unit.id;
        if (!validId(unitId)) { complete = false; return; }
        if ((candidateIds && candidateIds.has(unitId)) || byId[unitId]) { complete = false; return; }
        addVerified(verified.facts, unitId); closure.facts.add(unitId);
        byId[unitId] = unit;
        entries.push({
          id: unitId, side: side, unit: unit,
          path: 'request.visibleWorld.参战者.' + side + '[' + index + ']',
        });
      });
    });
    entries.sort(function (a, b) { return compare(a.id, b.id) || compare(a.side, b.side); });
    return { entries: entries, byId: byId, complete: complete };
  }
  function initializeClosure(request, verified, closure) {
    var context = request && request.evaluationContext;
    var requestHash = request && request.requestHash;
    var opportunityId = request && request.actionOpportunity && request.actionOpportunity.opportunityId;
    var visibleRevision = context && context.visibleWorldRevision;
    var scheduleRevision = context && context.scheduleRevision;
    if ((!validId(requestHash) && !validId(opportunityId)) || !validId(visibleRevision) || !validId(scheduleRevision)) {
      fail('SOURCE_CLOSURE_ROOT_REQUIRED');
    }
    if (validId(requestHash)) { addVerified(verified.events, requestHash); closure.events.add(requestHash); }
    if (validId(opportunityId)) { addVerified(verified.events, opportunityId); closure.events.add(opportunityId); }
    addVerified(verified.facts, visibleRevision); addVerified(verified.events, scheduleRevision);
    closure.facts.add(visibleRevision); closure.events.add(scheduleRevision);
  }
  function typedFactRows(value) {
    if (Array.isArray(value)) return value;
    if (!isObject(value)) return null;
    if (Array.isArray(value.directFacts)) return value.directFacts;
    if (Array.isArray(value.typedFacts)) return value.typedFacts;
    return null;
  }
  function scanTypedBaseline(value, scheduled, verified, closure, entries, identities, visibleUnitIndex) {
    var rows = typedFactRows(value), complete = rows !== null;
    if (!rows) return { complete: false };
    rows.forEach(function (fact) {
      var prototypeKind = validId(fact && fact.prototypeKind) ? fact.prototypeKind : '';
      var registry = REGISTRY[prototypeKind];
      if (!registry) { complete = false; return; }
      if (!indexPdaRow(verified, fact, false)) { complete = false; return; }
      var pair = pdaRefs(fact, verified);
      indexRefs(closure, pair);
      if (!pair.ok) { complete = false; return; }
      authenticatePdaRow(verified, fact);
      if (registry.capabilityKind !== 'TEAM_EFFECT') return;
      var made = teamEntries(registry, fact, scheduled, fact && fact.sourceEffectId, verified, closure, visibleUnitIndex);
      if (!made.complete) complete = false;
      made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) complete = false; });
    });
    return { complete: complete };
  }
  function scanBaseline(request, verified, closure, unitData) {
    var entries = [], identities = Object.create(null), complete = unitData.complete, gaps = [];
    unitData.entries.forEach(function (entry) {
      ['状态效果', '持续效果'].forEach(function (field) {
        var value = entry.unit && entry.unit[field];
        var path = entry.path + '.' + field;
        if (!own(entry.unit, field)) {
          complete = false; gaps.push({ unitId: entry.id, path: path }); return;
        }
        if (!isObject(value)) {
          complete = false; gaps.push({ unitId: entry.id, path: path }); return;
        }
        if (Object.keys(value).length === 0) return;
        var result = scanTypedBaseline(value, false, verified, closure, entries, identities, unitData.byId);
        if (!result.complete) {
          complete = false; gaps.push({ unitId: entry.id, path: path });
        }
      });
    });
    var context = request.evaluationContext || {};
    if (!own(context, 'scheduledEvents') || !Array.isArray(context.scheduledEvents)) {
      complete = false;
    }
    else context.scheduledEvents.forEach(function (event) {
      if (!isObject(event)) { complete = false; gaps.push({ path: 'request.evaluationContext.scheduledEvents' }); return; }
      var eventIds = sourceValues(event, ['eventId', 'sourceEventId', 'entryId'], ['sourceEventIds']);
      addVerifiedArray(verified.events, eventIds);
      var eventRefs = refs({
        sourceEventIds: eventIds,
      }, verified);
      indexRefs(closure, eventRefs);
      var result = scanTypedBaseline(event.scheduledFacts || event.typedFacts || event.directFacts, true, verified, closure, entries, identities, unitData.byId);
      if (!eventRefs.ok || !result.complete) {
        complete = false; gaps.push({ path: 'request.evaluationContext.scheduledEvents' });
      }
    });
    return { entries: sortObjects(entries), complete: complete, gaps: gaps };
  }
  function publicResource(unit, resource) {
    var key = RESOURCE_FIELDS[resource];
    return key && unit ? finite(unit[key]) : null;
  }
  function canonicalResourceKey(value) {
    return RESOURCES.indexOf(value) >= 0 ? value : RESOURCE_LABEL_KEYS[value] || '';
  }
  function contributionResourceKey(item) {
    var evidence = isObject(item && item.evidence) ? item.evidence : null;
    if (own(evidence, 'resourceKey')) return RESOURCES.indexOf(evidence.resourceKey) >= 0 ? evidence.resourceKey : '';
    if (own(item, 'resourceKey')) return RESOURCES.indexOf(item.resourceKey) >= 0 ? item.resourceKey : '';
    if (own(evidence, 'resource')) return RESOURCE_LABEL_KEYS[evidence.resource] || '';
    return '';
  }
  function publicMaxAmount(unit, resource) {
    var field = RESOURCE_FIELDS[resource];
    var maxField = field ? field + '_max' : '';
    return maxField && unit ? finite(unit[maxField]) : null;
  }
  function catalogRefs(request, verified, realActionId) {
    var context = request && request.evaluationContext, factIds = [], eventIds = [];
    var rootEvent = validId(request && request.requestHash) ? request.requestHash
      : request && request.actionOpportunity && request.actionOpportunity.opportunityId;
    if (validId(context && context.visibleWorldRevision)) factIds.push(context.visibleWorldRevision);
    if (validId(rootEvent)) eventIds.push(rootEvent);
    if (validId(realActionId)) eventIds.push(realActionId);
    return refs({ sourceFactIds: factIds, sourceEventIds: eventIds }, verified);
  }
  function scanConsumers(request, decisionApi, previewApi, unitData, closure, verified) {
    var entries = [], complete = unitData.complete, actorSide = request.actorSide, seen = Object.create(null);
    var followUpAudit = {
      prototypeComplete: true, grantSeen: false,
      grantScanComplete: true, pending: false, invalid: false, missing: Object.create(null),
    };
    if (!validId(actorSide)) complete = false;
    requireFunction(decisionApi.collectSkills, 'decisionApi.collectSkills');
    requireFunction(decisionApi.parseSkillCosts, 'decisionApi.parseSkillCosts');
    unitData.entries.filter(function (entry) { return entry.side === actorSide; }).forEach(function (unit) {
      var skills;
      try { skills = decisionApi.collectSkills(unit.unit); } catch (error) { complete = false; return; }
      if (!Array.isArray(skills)) { complete = false; return; }
      skills.forEach(function (skill) {
        var costs;
        if (!isObject(skill)) { complete = false; return; }
        var prototypeKinds = mechanicalPrototypeKinds(skill);
        if (!prototypeKinds || prototypeKinds.some(function (kind) { return !REGISTRY[kind]; })) {
          complete = false; followUpAudit.prototypeComplete = false; followUpAudit.grantScanComplete = false;
        }
        else if (prototypeKinds.indexOf('机制授予') >= 0) followUpAudit.grantSeen = true;
        try { costs = decisionApi.parseSkillCosts(skill); } catch (error) { complete = false; return; }
        var normalized = normalizeCosts(costs);
        if (!normalized.complete) { complete = false; return; }
        var realActionId = validId(skill.actionId) ? skill.actionId : '';
        var actionId = realActionId || mechanicalFingerprint(skill, costs, previewApi);
        if (!actionId) { complete = false; return; }
        if (realActionId) { addVerified(verified.events, realActionId); addVerified(verified.actions, realActionId); }
        var followUpKeysValid = own(skill, 'followUpKeys') && uniqueArrayIsValid(skill.followUpKeys);
        var followUpKeys = followUpKeysValid ? uniqueIds(skill.followUpKeys) : [];
        if (prototypeKinds && prototypeKinds.indexOf('机制授予') >= 0
          && followUpKeysValid && followUpKeys.length === 0) {
          followUpAudit.grantScanComplete = false;
        }
        if (!followUpKeysValid) followUpAudit.invalid = true;
        Object.keys(normalized.values).sort().forEach(function (resourceKey) {
          var current = publicResource(unit.unit, resourceKey), key = unit.id + '|' + resourceKey + '|' + actionId;
          if (current === null || current < 0 || seen[key]) { complete = false; return; }
          seen[key] = true;
          var pair = catalogRefs(request, verified, realActionId);
          indexRefs(closure, pair);
          if (!pair.ok) { complete = false; return; }
          var consumerId = 'public-consumer:' + unit.id + ':' + actionId + ':' + resourceKey;
          if (!followUpKeysValid) followUpAudit.missing[consumerId] = true;
          entries.push({
            consumerId: consumerId,
            ownerId: unit.id, resourceKey: resourceKey, currentAmount: current,
            requiredAmount: normalized.values[resourceKey], actionId: actionId, followUpKeys: followUpKeys,
            sourceFactIds: pair.facts, sourceEventIds: pair.events,
          });
        });
      });
    });
    return { entries: sortObjects(entries), complete: complete, followUpAudit: followUpAudit };
  }
  function finalizeFollowUpCatalog(catalog, audit) {
    var hasMissing = Object.keys(audit.missing).length > 0;
    var safeEmpty = audit.prototypeComplete && audit.grantScanComplete && !audit.grantSeen
      && !audit.pending && !audit.invalid && !hasMissing;
    if (!audit.prototypeComplete || !audit.grantScanComplete || audit.pending
      || audit.invalid || hasMissing) catalog.complete = false;
    catalog.entries.forEach(function (entry) {
      if (!audit.missing[entry.consumerId]) return;
      entry.followUpKeys = [];
      if (!safeEmpty) catalog.complete = false;
    });
    return catalog.complete;
  }
  function teamEntries(registry, fact, scheduled, effectId, verified, closure, visibleUnitIndex) {
    var ownerId = validId(fact && fact.sourceActorId) ? fact.sourceActorId : '';
    var targets = targetIds(fact), key = typedEffectKey(fact), duration = durationBand(fact);
    var visibleTargets = targets.length > 0 && targets.every(function (targetId) {
      return isObject(visibleUnitIndex) && Object.prototype.hasOwnProperty.call(visibleUnitIndex, targetId);
    });
    var pair = pdaRefs(fact, verified);
    indexRefs(closure, pair);
    if (!ownerId || !targets.length || !visibleTargets || !key || !duration
      || fact.sourceEffectId !== effectId || !pair.ok) return { entries: [], complete: false };
    return {
      complete: true,
      entries: targets.map(function (targetId) {
        return {
          capabilityKind: 'TEAM_EFFECT', ownerId: ownerId, targetId: targetId,
          effectAxis: registry.effectAxis, effectKey: key,
          timeBand: scheduled ? 'SCHEDULED' : 'NOW', durationBand: durationBand(fact),
          sourceFactIds: pair.facts.slice(), sourceEventIds: pair.events.slice(),
        };
      }),
    };
  }
  function resourceEntries(fact, scheduled, effectId, contributions, verified, closure, unitEntries) {
    var ownerId = validId(fact && fact.sourceActorId) ? fact.sourceActorId : '';
    var expected = targetIds(fact), resourceKey = canonicalResourceKey(fact && fact.key), matches = contributions.filter(function (item) {
      return validId(item && item.effectInstanceId) && item.effectInstanceId === effectId
        && item.component === 'RESOURCE_OPTION' && item.outcomeKind === 'RESOURCE_OPTION_CHANGED'
        && item.windowId !== 'ACTION_COST' && contributionResourceKey(item) === resourceKey;
    });
    var seen = Object.create(null), rows = [], complete = !!ownerId && expected.length > 0;
    if (!complete || !resourceKey || fact.sourceEffectId !== effectId || !matches.length) return { entries: [], complete: false };
    matches.forEach(function (item) {
      var evidence = isObject(item && item.evidence) ? item.evidence : {};
      var targetId = item && item.targetId;
      var current = finite(evidence.current), next = finite(evidence.next);
      var unit = unitEntries.filter(function (entry) { return entry.id === targetId; })[0];
      var maximum = publicMaxAmount(unit && unit.unit, resourceKey);
      var pair = previewRefs(item, verified);
      indexRefs(closure, pair);
      if (!validId(targetId) || !unit || current === null || next === null
        || maximum === null || maximum < 0 || evidence.applicationProbability !== 1
        || evidence.ownApplicationProbability !== 1 || !pair.ok) {
        complete = false; return;
      }
      seen[targetId] = true;
      rows.push({
        capabilityKind: 'RESOURCE_SUPPLY', ownerId: ownerId, targetId: targetId,
        resourceKey: resourceKey, timeBand: scheduled ? 'SCHEDULED' : 'NOW',
        supplyAmount: Math.max(0, next - current), publicMaxAmount: maximum,
        sourceFactIds: pair.facts.slice(), sourceEventIds: pair.events.slice(),
      });
    });
    if (Object.keys(seen).sort().join('|') !== expected.slice().sort().join('|')) complete = false;
    return { entries: complete ? rows : [], complete: complete };
  }
  function resourceEffectShape(facts, scheduled, effectId, contributions) {
    var pdaKeys = [], previewKeys = [], seenPda = Object.create(null), seenPreview = Object.create(null), complete = true;
    facts.concat(scheduled).forEach(function (fact) {
      var key = canonicalResourceKey(fact && fact.key);
      if (fact && fact.sourceEffectId !== effectId || !key || seenPda[key]) complete = false;
      if (key) { seenPda[key] = true; pdaKeys.push(key); }
    });
    contributions.forEach(function (item) {
      if (!validId(item && item.effectInstanceId) || item.effectInstanceId !== effectId
        || item.component !== 'RESOURCE_OPTION' || item.outcomeKind !== 'RESOURCE_OPTION_CHANGED' || item.windowId === 'ACTION_COST') return;
      var key = contributionResourceKey(item);
      if (!key) complete = false;
      if (key && !seenPreview[key]) { seenPreview[key] = true; previewKeys.push(key); }
    });
    pdaKeys.sort(); previewKeys.sort();
    return complete && JSON.stringify(pdaKeys) === JSON.stringify(previewKeys);
  }
  function followUpEntry(row, verified, closure, visibleUnitIndex) {
    var admission = grantAdmission(row, verified, visibleUnitIndex);
    var pair = pdaRefs(row, verified);
    if (!admission || !pair.ok) return null;
    var ordinary = {
      facts: pair.facts.slice(),
      events: pair.events.slice(),
    };
    if (ordinary.facts.length + ordinary.events.length === 0) return null;
    indexRefs(closure, ordinary);
    return {
      capabilityKind: 'FOLLOW_UP', grantType: 'FOLLOW_UP', ownerId: admission.ownerId,
      followUpKey: admission.followUpKey, grantProofIds: admission.proofs,
      sourceFactIds: ordinary.facts, sourceEventIds: ordinary.events,
    };
  }
  function hasPendingOrDeferred(admitted, projection) {
    var values = [];
    if (admitted && Array.isArray(admitted.reasons)) values = values.concat(admitted.reasons);
    if (projection && Array.isArray(projection.unsupportedOutcomeKinds)) values = values.concat(projection.unsupportedOutcomeKinds);
    if (projection && validId(projection.deferCode)) values.push(projection.deferCode);
    return values.some(function (value) { return typeof value === 'string' && /^(PENDING|DEFER)/.test(value); });
  }
  function indexCandidatePdaRow(row, verified, closure, visibleUnitIndex, followUpAudit, scheduled) {
    var admission = null;
    if (isFollowUpRow(row)) {
      if (scheduled !== true || followUpAudit.pending) return false;
      admission = grantFields(row, visibleUnitIndex);
      if (!admission || verified.authenticated.has(admission.entryId)) return false;
    }
    if (!indexPdaRow(verified, row, true)) return false;
    var pair = pdaRefs(row, verified);
    if (!pair.ok) return false;
    if (isFollowUpRow(row)) {
      authenticatePdaRow(verified, row);
      return !!grantAdmission(row, verified, visibleUnitIndex);
    }
    indexRefs(closure, pair);
    return pair.ok;
  }
  function indexCandidatePreviewRow(row, verified, closure) {
    if (isFollowUpRow(row)) return false;
    if (!indexPreviewRow(verified, row, true)) return false;
    var pair = previewRefs(row, verified);
    indexRefs(closure, pair);
    if (pair.ok) authenticatePreviewRow(verified, row);
    return pair.ok;
  }
  function unpackCarrierRows(effect) {
    // 造物承载/物品使用载体：无原型但有结构化使用效果时按 PDA/Preview 语义解包一层；
    // 内层目标 自身 规范化为 单体，使 PDA 按候选 targetSet（recipient）解析。
    // 不递归；畸形内层行原样保留，由未知原型路径 fail closed。
    if (!isObject(effect) || validId(effect['原型'])
      || !Array.isArray(effect['使用效果']) || effect['使用效果'].length === 0) return null;
    var rows = [], j, row, normalized;
    for (j = 0; j < effect['使用效果'].length; j += 1) {
      row = effect['使用效果'][j];
      if (!isObject(row) || row['目标'] !== '自身') { rows.push(row); continue; }
      normalized = {};
      Object.keys(row).forEach(function (key) { normalized[key] = row[key]; });
      normalized['目标'] = '单体';
      rows.push(normalized);
    }
    return rows;
  }
  function scanCandidate(candidate, request, previewApi, pdaApi, verified, closure, unitEntries, visibleUnitIndex, followUpAudit, injection) {
    var entries = [], identities = Object.create(null), status = { TEAM_EFFECT: 'COMPLETE', RESOURCE_SUPPLY: 'COMPLETE', FOLLOW_UP: 'COMPLETE' };
    var catalogComplete = true;
    var declaration = candidate.declaration === undefined ? {} : candidate.declaration;
    if (!isPlainObject(declaration)) fail('SOURCE_ACTION_ID_INVALID', candidate && candidate.candidateId);
    var actionKind = validId(declaration && declaration.actionKind) ? declaration.actionKind : '';
    var declaredEffects = declaration && declaration.skill && declaration.skill._效果数组;
    if (declaredEffects !== undefined && !Array.isArray(declaredEffects)) {
      fail('SOURCE_EFFECT_ARRAY_INVALID', candidate && candidate.candidateId);
    }
    var effects = Array.isArray(declaredEffects) ? declaredEffects : [];
    if (actionKind === 'RELEASE_SKILL' && (!declaration || !declaration.skill || !Array.isArray(declaration.skill._效果数组))) {
      status.TEAM_EFFECT = 'PARTIAL'; catalogComplete = false; followUpAudit.prototypeComplete = false;
    }
    var actionId = canonicalActionId(candidate);
    addVerified(verified.events, actionId); addVerified(verified.actions, actionId);
    var previewDeclaration = Object.assign({}, declaration || {}, { actionId: actionId });
    var preview = null;
    if (injection) {
      var injectedPreview = isObject(injection.previewResultsById) ? injection.previewResultsById[candidate.candidateId] : undefined;
      if (injectedPreview === undefined || !isObject(injectedPreview)) fail('SOURCE_PREVIEW_INJECTION_MISSING', candidate.candidateId);
      preview = injectedPreview;
    } else {
      try {
        preview = previewApi.previewAction({ worldSnapshot: request.visibleWorld, declaration: previewDeclaration, actorId: request.actorId, basisView: 'DECISION_VISIBLE' });
      } catch (error) {
        status.TEAM_EFFECT = 'PARTIAL'; status.RESOURCE_SUPPLY = 'PARTIAL'; status.FOLLOW_UP = 'PARTIAL';
        catalogComplete = false;
      }
    }
    var contributions = Array.isArray(preview && preview.contributions) ? preview.contributions : [];
    contributions.forEach(function (item) {
      if (!item || item.sourceActionId !== actionId) fail('SOURCE_PREVIEW_SOURCE_ACTION_MISMATCH', candidate.candidateId);
      if (!indexCandidatePreviewRow(item, verified, closure)) {
        status.FOLLOW_UP = 'PARTIAL'; catalogComplete = false;
      }
    });
    effects.forEach(function (effect, index) {
      var effectBaseId = canonicalEffectId(effect, actionId, index);
      var unpacked = unpackCarrierRows(effect), rows = unpacked === null ? [effect] : unpacked, u;
      for (u = 0; u < rows.length; u += 1) {
      var row = rows[u];
      var prototypeKind = validId(row && row['原型']) ? row['原型'] : '';
      var registry = REGISTRY[prototypeKind];
      var effectId = effectBaseId + (unpacked === null ? '' : ':unpack:' + u);
      if (!registry) {
        status.TEAM_EFFECT = 'PARTIAL'; status.RESOURCE_SUPPLY = 'PARTIAL'; status.FOLLOW_UP = 'PARTIAL'; catalogComplete = false; followUpAudit.prototypeComplete = false; continue;
      }
      var context = {
        sourceActionId: actionId, sourceActorId: request.actorId, sourceEffectId: effectId,
        candidateTargetIds: Array.isArray(declaration && declaration.targetIds) ? declaration.targetIds.slice() : [],
      };
      var admitted, projection;
      if (injection) {
        var perCandidateProjections = isObject(injection.pdaProjectionsById) ? injection.pdaProjectionsById[candidate.candidateId] : null;
        var injectedProjection = isObject(perCandidateProjections) ? perCandidateProjections[effectId] : undefined;
        if (injectedProjection === undefined || !isObject(injectedProjection) || !isObject(injectedProjection.projection)) {
          fail('SOURCE_PDA_INJECTION_MISSING', candidate.candidateId + ':' + effectId);
        }
        admitted = injectedProjection.admitted === undefined ? null : injectedProjection.admitted;
        projection = injectedProjection.projection;
      } else {
        try { admitted = pdaApi.admit(row, context); projection = pdaApi.project(row, context); } catch (error) {
          status[registry.capabilityKind === 'TEAM_EFFECT' ? 'TEAM_EFFECT' : registry.capabilityKind === 'RESOURCE_SUPPLY' ? 'RESOURCE_SUPPLY' : 'FOLLOW_UP'] = 'PARTIAL';
          catalogComplete = false;
          continue;
        }
      }
      if (hasPendingOrDeferred(admitted, projection)) {
        status[registry.capabilityKind === 'TEAM_EFFECT' ? 'TEAM_EFFECT' : registry.capabilityKind === 'RESOURCE_SUPPLY' ? 'RESOURCE_SUPPLY' : 'FOLLOW_UP'] = 'PARTIAL';
        status.FOLLOW_UP = 'PARTIAL';
        catalogComplete = false; followUpAudit.pending = true;
      }
      var direct = Array.isArray(projection && projection.directFacts) ? projection.directFacts : [];
      var scheduled = Array.isArray(projection && projection.scheduledFacts) ? projection.scheduledFacts : [];
      direct.forEach(function (fact) { if (!indexCandidatePdaRow(fact, verified, closure, visibleUnitIndex, followUpAudit, false)) { status.FOLLOW_UP = isFollowUpRow(fact) ? 'PARTIAL' : status.FOLLOW_UP; catalogComplete = isFollowUpRow(fact) ? false : catalogComplete; } });
      scheduled.forEach(function (fact) { if (!indexCandidatePdaRow(fact, verified, closure, visibleUnitIndex, followUpAudit, true)) { status.FOLLOW_UP = isFollowUpRow(fact) ? 'PARTIAL' : status.FOLLOW_UP; catalogComplete = isFollowUpRow(fact) ? false : catalogComplete; } });
      if (!admitted || admitted.admitted === false) {
        if (registry.capabilityKind === 'TEAM_EFFECT') status.TEAM_EFFECT = 'PARTIAL';
        if (registry.capabilityKind === 'RESOURCE_SUPPLY') status.RESOURCE_SUPPLY = 'PARTIAL';
        if (registry.capabilityKind === 'NOT_RELATIONAL') status.FOLLOW_UP = 'PARTIAL';
        catalogComplete = false;
        continue;
      }
      if (registry.capabilityKind === 'TEAM_EFFECT') {
        if (!direct.length && !scheduled.length) { status.TEAM_EFFECT = 'PARTIAL'; continue; }
        direct.forEach(function (fact) { var made = teamEntries(registry, fact, false, effectId, verified, closure, visibleUnitIndex); if (!made.complete) status.TEAM_EFFECT = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.TEAM_EFFECT = 'PARTIAL'; }); });
        scheduled.forEach(function (fact) { var made = teamEntries(registry, fact, true, effectId, verified, closure, visibleUnitIndex); if (!made.complete) status.TEAM_EFFECT = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.TEAM_EFFECT = 'PARTIAL'; }); });
      } else if (registry.capabilityKind === 'RESOURCE_SUPPLY') {
        if (!direct.length && !scheduled.length) { status.RESOURCE_SUPPLY = 'PARTIAL'; return; }
        if (!resourceEffectShape(direct, scheduled, effectId, contributions)) status.RESOURCE_SUPPLY = 'PARTIAL';
        direct.forEach(function (fact) { var made = resourceEntries(fact, false, effectId, contributions, verified, closure, unitEntries); if (!made.complete) status.RESOURCE_SUPPLY = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.RESOURCE_SUPPLY = 'PARTIAL'; }); });
        scheduled.forEach(function (fact) { var made = resourceEntries(fact, true, effectId, contributions, verified, closure, unitEntries); if (!made.complete) status.RESOURCE_SUPPLY = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.RESOURCE_SUPPLY = 'PARTIAL'; }); });
      } else if (registry.capabilityKind === 'NOT_RELATIONAL') {
        scheduled.forEach(function (fact) {
          if (fact && fact.grantType !== 'FOLLOW_UP') return;
          var grant = followUpAudit.pending ? null : followUpEntry(fact, verified, closure, visibleUnitIndex);
          if (!grant) { status.FOLLOW_UP = 'PARTIAL'; catalogComplete = false; }
          else if (!addEntry(entries, identities, grant)) status.FOLLOW_UP = 'PARTIAL';
        });
      }
      }
    });
    return { entries: sortObjects(entries), status: status, catalogComplete: catalogComplete };
  }
  function compilePreparedRequest(args) {
    args = args || {};
    var request = args.request, previewApi = args.previewApi, pdaApi = args.pdaApi, decisionApi = args.decisionApi;
    var injection = null;
    if (args.previewResultsById !== undefined || args.pdaProjectionsById !== undefined) {
      if (!isObject(args.previewResultsById) || !isObject(args.pdaProjectionsById)) fail('SOURCE_INJECTION_PARTIAL');
      injection = { previewResultsById: args.previewResultsById, pdaProjectionsById: args.pdaProjectionsById };
    }
    requireFormalApi(decisionApi, root.__LWCS_BATTLE_DECISION__, 'decisionApi');
    requireFormalApi(previewApi, root.__LWCS_BATTLE_PREVIEW__, 'previewApi');
    requireFormalApi(pdaApi, root.__LWCS_BEHAVIOR_DECISION_PIPELINE__?.prototypeAdapter, 'pdaApi');
    requireFunction(decisionApi && decisionApi.isPreparedDecisionRequest, 'decisionApi.isPreparedDecisionRequest');
    if (!decisionApi.isPreparedDecisionRequest(request)) fail('SOURCE_PREPARED_REQUEST_IDENTITY');
    if (injection) {
      requireFunction(decisionApi.isPreparedLinearSourceMaps, 'decisionApi.isPreparedLinearSourceMaps');
      if (!decisionApi.isPreparedLinearSourceMaps(request, injection.previewResultsById, injection.pdaProjectionsById)) {
        fail('SOURCE_MAP_IDENTITY');
      }
    }
    if (!isObject(request) || !Array.isArray(request.frozenCandidates) || request.frozenCandidates.length === 0) fail('SOURCE_FROZEN_REQUEST_REQUIRED');
    if (!isObject(request.visibleWorld)) fail('SOURCE_VISIBLE_WORLD_REQUIRED');
    requireFunction(previewApi && previewApi.previewAction, 'previewApi.previewAction');
    requireFunction(previewApi && previewApi.stableHash, 'previewApi.stableHash');
    requireFunction(pdaApi && pdaApi.admit, 'pdaApi.admit'); requireFunction(pdaApi && pdaApi.project, 'pdaApi.project');
    requireFunction(pdaApi && pdaApi.registry, 'pdaApi.registry');
    requireFunction(decisionApi && decisionApi.collectSkills, 'decisionApi.collectSkills');
    var candidateIds = new Set(), frozen = request.frozenCandidates.map(function (candidate) {
      var candidateId = candidate && candidate.candidateId;
      if (!validId(candidateId) || candidateIds.has(candidateId)) fail('SOURCE_CANDIDATE_CLOSURE', candidateId);
      candidateIds.add(candidateId); return candidateId;
    }).sort();
    var verified = {
      facts: new Set(), events: new Set(), actions: new Set(), authenticated: new Set(),
      links: Object.create(null),
    };
    var closure = { facts: new Set(), events: new Set() };
    initializeClosure(request, verified, closure);
    var attestation = registryAttestation(pdaApi);
    var unitData = visibleUnits(request, verified, closure, candidateIds);
    var baseline = scanBaseline(request, verified, closure, unitData);
    var catalog = scanConsumers(request, decisionApi, previewApi, unitData, closure, verified);
    var followUpAudit = catalog.followUpAudit;
    var catalogComplete = unitData.complete && catalog.complete;
    var candidateResults = {};
    request.frozenCandidates.forEach(function (candidate) {
      var candidateId = candidate.candidateId;
      var result = scanCandidate(candidate, request, previewApi, pdaApi, verified, closure, unitData.entries, unitData.byId, followUpAudit, injection);
      candidateResults[candidateId] = result;
      if (result.catalogComplete !== true) catalogComplete = false;
    });
    if (!finalizeFollowUpCatalog(catalog, followUpAudit)) {
      catalogComplete = false;
      Object.keys(candidateResults).forEach(function (candidateId) { candidateResults[candidateId].status.FOLLOW_UP = 'PARTIAL'; });
    }
    var candidateEntriesById = {}, candidateCompletenessByAxis = {};
    frozen.forEach(function (candidateId) {
      candidateEntriesById[candidateId] = candidateResults[candidateId].entries;
      candidateCompletenessByAxis[candidateId] = candidateResults[candidateId].status;
    });
    var factIds = Array.from(closure.facts).sort(), eventIds = Array.from(closure.events).sort();
    var output = {
      schemaVersion: 'BehaviorRelationalFeatureV1', frozenCandidateIds: frozen,
      baselineEntries: baseline.entries, candidateEntriesById: candidateEntriesById, publicConsumers: catalog.entries,
      baselineCompletenessByAxis: { TEAM_EFFECT: baseline.complete ? 'COMPLETE' : 'PARTIAL' },
      candidateCompletenessByAxis: candidateCompletenessByAxis,
      actionCatalogCompleteness: catalogComplete ? 'COMPLETE' : 'PARTIAL',
      sourceClosure: { factIds: factIds, eventIds: eventIds, closureHash: 'closure:' + previewApi.stableHash({ factIds: factIds, eventIds: eventIds }) },
      registryAttestation: attestation,
    };
    return freeze(output);
  }
  root.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__ = Object.freeze({
    compilePreparedRequest: compilePreparedRequest,
    unpackCarrierRows: unpackCarrierRows,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ===== relationalFeature (BehaviorRelationalFeature_Module.js) =====

(function (root) {
  'use strict';
  var SCHEMA = 'BehaviorRelationalFeatureV1';
  var FEATURES = ['TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO', 'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE'];
  var TOP = ['schemaVersion', 'frozenCandidateIds', 'baselineEntries', 'candidateEntriesById', 'publicConsumers', 'baselineCompletenessByAxis', 'candidateCompletenessByAxis', 'actionCatalogCompleteness', 'sourceClosure', 'registryAttestation'];
  var REGISTRY_IDS = ['BRF_EXPLICIT_FOLLOW_UP_V1', 'BRF_NOT_RELATIONAL_V1', 'BRF_RESOURCE_SUPPLY_V1', 'BRF_TEAM_EFFECT_V1'];
  var TEAM_FIELDS = ['capabilityKind', 'ownerId', 'targetId', 'effectAxis', 'effectKey', 'timeBand', 'durationBand', 'sourceFactIds', 'sourceEventIds'];
  var SUPPLY_FIELDS = ['capabilityKind', 'ownerId', 'targetId', 'resourceKey', 'timeBand', 'supplyAmount', 'publicMaxAmount', 'sourceFactIds', 'sourceEventIds'];
  var FOLLOW_FIELDS = ['capabilityKind', 'grantType', 'ownerId', 'followUpKey', 'grantProofIds', 'sourceFactIds', 'sourceEventIds'];
  var CONSUMER_FIELDS = ['consumerId', 'ownerId', 'resourceKey', 'currentAmount', 'requiredAmount', 'actionId', 'followUpKeys', 'sourceFactIds', 'sourceEventIds'];

  function fail(code, detail) { var e = new Error(code + (detail ? ':' + detail : '')); e.code = code; throw e; }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function exact(value, fields, field) { if (!object(value)) fail('INPUT_SHAPE_FATAL', field); var allowed = Object.create(null), keys = Object.keys(value), i; for (i = 0; i < fields.length; i += 1) allowed[fields[i]] = true; for (i = 0; i < keys.length; i += 1) if (!allowed[keys[i]]) fail('INPUT_SHAPE_FATAL', field + '.' + keys[i]); }
  function has(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
  function id(value, field) { if (typeof value !== 'string' || value.length < 1 || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) fail('INPUT_SHAPE_FATAL', field); return value; }
  function ids(value, field) { if (!Array.isArray(value)) fail('INPUT_SHAPE_FATAL', field); var seen = Object.create(null), out = [], i, item; for (i = 0; i < value.length; i += 1) { item = id(value[i], field + '[' + i + ']'); if (seen[item]) fail('DUPLICATE_IDENTITY_FATAL', field); seen[item] = true; out.push(item); } out.sort(); return out; }
  function number(value, field, positive) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value <= 0)) fail('NON_FINITE_FATAL', field); return value; }
  function tupleKey(value, field) { id(value, field); var parsed; try { parsed = JSON.parse(value); } catch (error) { fail('EFFECT_KEY_FATAL', field); } if (!Array.isArray(parsed) || parsed.length !== 4) fail('EFFECT_KEY_FATAL', field); for (var i = 0; i < parsed.length; i += 1) id(parsed[i], field + '[' + i + ']'); if (JSON.stringify(parsed) !== value) fail('EFFECT_KEY_FATAL', field); return value; }
  function refs(value, field) { if (!has(value, 'sourceFactIds') || !has(value, 'sourceEventIds')) fail('SOURCE_CLOSURE_FATAL', field); var fact = ids(value.sourceFactIds, field + '.sourceFactIds'), event = ids(value.sourceEventIds, field + '.sourceEventIds'); if (fact.length === 0 && event.length === 0) fail('SOURCE_CLOSURE_FATAL', field); return { sourceFactIds: fact, sourceEventIds: event }; }
  function entry(raw, scope, seen) {
    var field = scope, kind; if (!object(raw)) fail('INPUT_SHAPE_FATAL', field); kind = id(raw.capabilityKind, field + '.capabilityKind'); var e;
    if (kind === 'TEAM_EFFECT') { exact(raw, TEAM_FIELDS, field); e = refs(raw, field); e.capabilityKind = kind; e.ownerId = id(raw.ownerId, field + '.ownerId'); e.targetId = id(raw.targetId, field + '.targetId'); e.effectAxis = id(raw.effectAxis, field + '.effectAxis'); if (!/^[A-Z][A-Z0-9_]*$/.test(e.effectAxis)) fail('INPUT_SHAPE_FATAL', field + '.effectAxis'); e.effectKey = tupleKey(raw.effectKey, field + '.effectKey'); e.timeBand = raw.timeBand; e.durationBand = raw.durationBand; if (['NOW', 'SCHEDULED'].indexOf(e.timeBand) < 0 || ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'PERSISTENT'].indexOf(e.durationBand) < 0) fail('INPUT_SHAPE_FATAL', field + '.timeBand'); e.identity = JSON.stringify([e.targetId, e.effectAxis, e.effectKey, e.timeBand]); }
    else if (kind === 'RESOURCE_SUPPLY' && scope.indexOf('candidate') === 0) { exact(raw, SUPPLY_FIELDS, field); e = refs(raw, field); e.capabilityKind = kind; e.ownerId = id(raw.ownerId, field + '.ownerId'); e.targetId = id(raw.targetId, field + '.targetId'); e.resourceKey = id(raw.resourceKey, field + '.resourceKey'); e.timeBand = raw.timeBand; if (e.timeBand !== 'NOW' && e.timeBand !== 'SCHEDULED') fail('INPUT_SHAPE_FATAL', field + '.timeBand'); e.supplyAmount = number(raw.supplyAmount, field + '.supplyAmount', false); e.publicMaxAmount = number(raw.publicMaxAmount, field + '.publicMaxAmount', false); e.identity = JSON.stringify([e.targetId, e.resourceKey, e.timeBand, e.sourceFactIds, e.sourceEventIds]); }
    else if (kind === 'FOLLOW_UP' && scope.indexOf('candidate') === 0) { exact(raw, FOLLOW_FIELDS, field); e = refs(raw, field); e.capabilityKind = kind; if (raw.grantType !== 'FOLLOW_UP') fail('INPUT_SHAPE_FATAL', field + '.grantType'); e.grantType = 'FOLLOW_UP'; e.ownerId = id(raw.ownerId, field + '.ownerId'); e.followUpKey = id(raw.followUpKey, field + '.followUpKey'); e.grantProofIds = ids(raw.grantProofIds, field + '.grantProofIds'); if (e.grantProofIds.length === 0) fail('SOURCE_CLOSURE_FATAL', field + '.grantProofIds'); e.identity = JSON.stringify([e.ownerId, e.followUpKey]); }
    else fail('INPUT_SHAPE_FATAL', field + '.capabilityKind');
    if (seen[e.identity]) fail('DUPLICATE_IDENTITY_FATAL', field + '.identity'); seen[e.identity] = true; return e;
  }
  function entries(value, scope) { if (!Array.isArray(value)) fail('INPUT_SHAPE_FATAL', scope); var out = [], seen = Object.create(null), i; for (i = 0; i < value.length; i += 1) out.push(entry(value[i], scope + '[' + i + ']', seen)); out.sort(function (a, b) { return a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0; }); return out; }
  function consumers(value) {
    if (!Array.isArray(value)) fail('INPUT_SHAPE_FATAL', 'publicConsumers'); var out = [], seen = Object.create(null), i, raw, field, e, consumerId;
    for (i = 0; i < value.length; i += 1) { raw = value[i]; field = 'publicConsumers[' + i + ']'; exact(raw, CONSUMER_FIELDS, field); consumerId = id(raw.consumerId, field + '.consumerId'); if (seen[consumerId]) fail('DUPLICATE_IDENTITY_FATAL', field + '.consumerId'); seen[consumerId] = true; e = refs(raw, field); e.consumerId = consumerId; e.ownerId = id(raw.ownerId, field + '.ownerId'); e.resourceKey = id(raw.resourceKey, field + '.resourceKey'); e.currentAmount = number(raw.currentAmount, field + '.currentAmount', false); e.requiredAmount = number(raw.requiredAmount, field + '.requiredAmount', true); e.actionId = id(raw.actionId, field + '.actionId'); e.followUpKeys = ids(raw.followUpKeys, field + '.followUpKeys'); e.resourceIdentity = JSON.stringify([e.ownerId, e.resourceKey]); out.push(e); }
    out.sort(function (a, b) { return a.consumerId < b.consumerId ? -1 : a.consumerId > b.consumerId ? 1 : 0; }); return out;
  }
  function completeness(value, fields, field) { exact(value, fields, field); var out = {}, i; for (i = 0; i < fields.length; i += 1) { if (value[fields[i]] !== 'COMPLETE' && value[fields[i]] !== 'PARTIAL') fail('INPUT_SHAPE_FATAL', field + '.' + fields[i]); out[fields[i]] = value[fields[i]]; } return out; }
  function set(value) { var out = Object.create(null), i; for (i = 0; i < value.length; i += 1) out[value[i]] = true; return out; }
  function closure(value) { exact(value, ['factIds', 'eventIds', 'closureHash'], 'sourceClosure'); var fact = ids(value.factIds, 'sourceClosure.factIds'), event = ids(value.eventIds, 'sourceClosure.eventIds'); if (fact.length === 0 && event.length === 0) fail('INPUT_FATAL', 'sourceClosure'); return { fact: fact, event: event, factSet: set(fact), eventSet: set(event), closureHash: id(value.closureHash, 'sourceClosure.closureHash') }; }
  function registry(value) { exact(value, ['registryVersion', 'registryHash', 'mappedCount', 'battleScopeCount', 'exactMapping', 'projectorIds'], 'registryAttestation'); if (value.registryVersion !== 'BehaviorRelationalProjectorRegistryV1' || value.registryHash !== '85016b9198590c5deb6ac4675c4f95dd7fbae164692720a087af6188e4ff6586' || value.mappedCount !== 27 || value.battleScopeCount !== 23 || value.exactMapping !== true || JSON.stringify(value.projectorIds) !== JSON.stringify(REGISTRY_IDS)) fail('REGISTRY_ATTESTATION_FATAL'); }
  function closeRecord(record, c) { var i; for (i = 0; i < record.sourceFactIds.length; i += 1) if (!c.factSet[record.sourceFactIds[i]]) fail('SOURCE_CLOSURE_FATAL', record.sourceFactIds[i]); for (i = 0; i < record.sourceEventIds.length; i += 1) if (!c.eventSet[record.sourceEventIds[i]]) fail('SOURCE_CLOSURE_FATAL', record.sourceEventIds[i]); if (record.grantProofIds) for (i = 0; i < record.grantProofIds.length; i += 1) { if (record.sourceFactIds.indexOf(record.grantProofIds[i]) < 0 && record.sourceEventIds.indexOf(record.grantProofIds[i]) < 0) fail('PROOF_FATAL', record.grantProofIds[i]); if (!c.factSet[record.grantProofIds[i]] && !c.eventSet[record.grantProofIds[i]]) fail('SOURCE_CLOSURE_FATAL', record.grantProofIds[i]); } }
  function sourceSet(records, c, includeProof) { var out = Object.create(null), i, j, r, proof; for (i = 0; i < records.length; i += 1) { r = records[i]; for (j = 0; j < r.sourceFactIds.length; j += 1) out['f:' + r.sourceFactIds[j]] = true; for (j = 0; j < r.sourceEventIds.length; j += 1) out['e:' + r.sourceEventIds[j]] = true; if (includeProof !== false && r.grantProofIds) for (j = 0; j < r.grantProofIds.length; j += 1) { proof = r.grantProofIds[j]; if (c.factSet[proof]) out['f:' + proof] = true; if (c.eventSet[proof]) out['e:' + proof] = true; } } return out; }
  function validateInput(input) {
    exact(input, TOP, 'input'); if (input.schemaVersion !== SCHEMA) fail('INPUT_SHAPE_FATAL', 'schemaVersion'); var ids0 = ids(input.frozenCandidateIds, 'frozenCandidateIds'); if (ids0.length === 0) fail('INPUT_SHAPE_FATAL', 'frozenCandidateIds'); if (!object(input.candidateEntriesById)) fail('INPUT_SHAPE_FATAL', 'candidateEntriesById'); var keys = Object.keys(input.candidateEntriesById).sort(), frozen = set(ids0), i;
    if (keys.length !== ids0.length) fail('INPUT_SHAPE_FATAL', 'candidateEntriesById'); for (i = 0; i < keys.length; i += 1) if (!frozen[keys[i]]) fail('INPUT_SHAPE_FATAL', 'candidateEntriesById'); var c = closure(input.sourceClosure), base = entries(input.baselineEntries, 'baseline'), con = consumers(input.publicConsumers), local = [], baseRefs = base.concat(con), candidateCompleteness = Object.create(null);
    for (i = 0; i < baseRefs.length; i += 1) closeRecord(baseRefs[i], c); for (i = 0; i < ids0.length; i += 1) { local.push(entries(input.candidateEntriesById[ids0[i]], 'candidate[' + ids0[i] + ']')); for (var j = 0; j < local[i].length; j += 1) closeRecord(local[i][j], c); }
    var baseComp = completeness(input.baselineCompletenessByAxis, ['TEAM_EFFECT'], 'baselineCompletenessByAxis'); exact(input.candidateCompletenessByAxis, ids0, 'candidateCompletenessByAxis'); for (i = 0; i < ids0.length; i += 1) candidateCompleteness[ids0[i]] = completeness(input.candidateCompletenessByAxis[ids0[i]], ['TEAM_EFFECT', 'RESOURCE_SUPPLY', 'FOLLOW_UP'], 'candidateCompletenessByAxis.' + ids0[i]); if (input.actionCatalogCompleteness !== 'COMPLETE' && input.actionCatalogCompleteness !== 'PARTIAL') fail('INPUT_SHAPE_FATAL', 'actionCatalogCompleteness'); registry(input.registryAttestation);
    var baseSet = sourceSet(base, c), consumerSourceMap = Object.create(null), consumer, sourceKey, sourceIds, p; for (i = 0; i < con.length; i += 1) { consumer = con[i]; sourceIds = consumer.sourceFactIds; for (j = 0; j < sourceIds.length; j += 1) { sourceKey = 'f:' + sourceIds[j]; if (!consumerSourceMap[sourceKey]) consumerSourceMap[sourceKey] = []; consumerSourceMap[sourceKey].push(consumer); } sourceIds = consumer.sourceEventIds; for (j = 0; j < sourceIds.length; j += 1) { sourceKey = 'e:' + sourceIds[j]; if (!consumerSourceMap[sourceKey]) consumerSourceMap[sourceKey] = []; consumerSourceMap[sourceKey].push(consumer); } }
    for (i = 0; i < local.length; i += 1) for (j = 0; j < local[i].length; j += 1) { var entry0 = local[i][j], candidateSet = sourceSet([entry0], c, false), sourceKeys = Object.keys(candidateSet); for (p = 0; p < sourceKeys.length; p += 1) { sourceKey = sourceKeys[p]; if (baseSet[sourceKey] || consumerSourceMap[sourceKey]) fail('SOURCE_DISJOINT_FATAL', sourceKey); } }
    return { ids: ids0, base: base, local: local, consumers: con, baseComp: baseComp, candidateComp: candidateCompleteness, catalog: input.actionCatalogCompleteness, closure: c };
  }
  function neumaier(values) { var sum = 0, correction = 0, i, next, value; for (i = 0; i < values.length; i += 1) { value = values[i]; next = sum + value; correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum; sum = next; } if (!Number.isFinite(sum + correction)) fail('NON_FINITE_FATAL', 'sum'); return sum + correction; }
  function recordRefs(rows, c, fallback, ordered) { var fact = Object.create(null), event = Object.create(null), list, i, j, r, p; if (!Array.isArray(rows) && rows && Array.isArray(rows.sourceFactIds) && Array.isArray(rows.sourceEventIds)) return { sourceFactIds: rows.sourceFactIds.slice(), sourceEventIds: rows.sourceEventIds.slice() }; list = rows.length ? rows : (fallback || []); for (i = 0; i < list.length; i += 1) { r = list[i]; for (j = 0; j < r.sourceFactIds.length; j += 1) fact[r.sourceFactIds[j]] = true; for (j = 0; j < r.sourceEventIds.length; j += 1) event[r.sourceEventIds[j]] = true; if (r.grantProofIds) for (j = 0; j < r.grantProofIds.length; j += 1) { p = r.grantProofIds[j]; if (c.factSet[p]) fact[p] = true; else if (c.eventSet[p]) event[p] = true; } } var factIds = Object.keys(fact), eventIds = Object.keys(event); if (!ordered) { factIds.sort(); eventIds.sort(); } return { sourceFactIds: factIds, sourceEventIds: eventIds }; }
  function operand(name, value, unit, rows, c, fallback, ordered) { var r = recordRefs(rows, c, fallback, ordered); return { name: name, value: value, unit: unit, sourceFactIds: r.sourceFactIds, sourceEventIds: r.sourceEventIds }; }
  function feature(code, status, reason, value, operands, c, fallback, ordered) { var fact = Object.create(null), event = Object.create(null), i, j, r; for (i = 0; i < operands.length; i += 1) { r = operands[i]; for (j = 0; j < r.sourceFactIds.length; j += 1) fact[r.sourceFactIds[j]] = true; for (j = 0; j < r.sourceEventIds.length; j += 1) event[r.sourceEventIds[j]] = true; } if (Object.keys(fact).length === 0 && Object.keys(event).length === 0) { r = recordRefs([], c, fallback); fact = set(r.sourceFactIds); event = set(r.sourceEventIds); } var factIds = Object.keys(fact), eventIds = Object.keys(event); if (!ordered) { factIds.sort(); eventIds.sort(); } var out = { featureCode: code, status: status, unit: 'RATIO_0_1' }; if (status === 'KNOWN') { if (!Number.isFinite(value) || value < 0 || value > 1) fail('NON_FINITE_FATAL', code); out.value = value; } out.reasonCode = reason; out.operands = operands; out.sourceFactIds = factIds; out.sourceEventIds = eventIds; return out; }
  function linkedRefs(group, count) { if (count === 0) return null; var facts = Object.create(null), events = Object.create(null), node, i; node = group.factPrefixes[count - 1]; while (node) { facts[node.id] = true; node = node.next; } node = group.eventPrefixes[count - 1]; while (node) { events[node.id] = true; node = node.next; } return { sourceFactIds: Object.keys(facts).sort(), sourceEventIds: Object.keys(events).sort() }; }
  function sharedData(base, consumers, c) {
    // Empty/NOT_APPLICABLE operands need one closed decision-local witness, not
    // a copy of the whole closure on every feature row. Prepared-request and
    // feature-vector hashes bind the negative result; contributing rows below
    // still retain their exact fact/event provenance.
    var fallback = [{ sourceFactIds: c.fact.slice(0, 1), sourceEventIds: c.event.slice(0, 1) }], team = Object.create(null), teamRows = [], groups = Object.create(null), follow = Object.create(null), followRows = Object.create(null), initiallyRows = [], currentPayableCount = 0, i, e, key, g;
    for (i = 0; i < base.length; i += 1) { team[base[i].identity] = base[i]; teamRows.push(base[i]); }
    for (i = 0; i < consumers.length; i += 1) { e = consumers[i]; key = e.resourceIdentity; if (!groups[key]) groups[key] = { key: key, allRows: [], thresholdRows: [], thresholds: [] }; g = groups[key]; g.allRows.push(e); if (e.currentAmount < e.requiredAmount) { e.threshold = e.requiredAmount - e.currentAmount; g.thresholdRows.push(e); initiallyRows.push(e); } else currentPayableCount += 1; for (var j = 0; j < e.followUpKeys.length; j += 1) { key = JSON.stringify([e.ownerId, e.followUpKeys[j]]); if (!follow[key]) { follow[key] = true; followRows[key] = []; } followRows[key].push(e); } }
    var groupKeys = Object.keys(groups).sort(), deficitKeys = [], deficitValues = [], k, factSeen, eventSeen, node;
    for (i = 0; i < groupKeys.length; i += 1) { g = groups[groupKeys[i]]; g.thresholdRows.sort(function (a, b) { return a.threshold - b.threshold || (a.consumerId < b.consumerId ? -1 : a.consumerId > b.consumerId ? 1 : 0); }); g.currentPayableCount = g.allRows.length - g.thresholdRows.length; g.consumerRefs = recordRefs(g.allRows, c, fallback); g.initiallyRefs = recordRefs(g.thresholdRows, c, fallback); g.deficitRefs = g.initiallyRefs; factSeen = Object.create(null); eventSeen = Object.create(null); g.factPrefixes = []; g.eventPrefixes = []; for (var q = 0; q < g.thresholdRows.length; q += 1) { e = g.thresholdRows[q]; g.thresholds.push(e.threshold); node = g.factPrefixes[q - 1] || null; for (var f = 0; f < e.sourceFactIds.length; f += 1) if (!factSeen[e.sourceFactIds[f]]) { factSeen[e.sourceFactIds[f]] = true; node = { id: e.sourceFactIds[f], next: node }; } g.factPrefixes.push(node); node = g.eventPrefixes[q - 1] || null; for (var v = 0; v < e.sourceEventIds.length; v += 1) if (!eventSeen[e.sourceEventIds[v]]) { eventSeen[e.sourceEventIds[v]] = true; node = { id: e.sourceEventIds[v], next: node }; } g.eventPrefixes.push(node); }
      if (g.thresholdRows.length) { g.deficit = neumaier(g.thresholds); deficitKeys.push(groupKeys[i]); deficitValues.push(g.deficit); }
    }
    var followKeys = Object.keys(followRows).sort(), followRefs = Object.create(null); for (i = 0; i < followKeys.length; i += 1) followRefs[followKeys[i]] = recordRefs(followRows[followKeys[i]], c, fallback, true);
    return { team: team, teamKeys: Object.keys(team).sort(), teamRefs: recordRefs(teamRows, c, fallback), groups: groups, groupKeys: groupKeys, deficitKeys: deficitKeys, deficitRefs: recordRefs(initiallyRows, c, fallback), deficitTotal: neumaier(deficitValues), consumerCount: consumers.length, consumerRefs: recordRefs(consumers, c, fallback), initiallyCount: consumers.length - currentPayableCount, initiallyRefs: recordRefs(initiallyRows, c, fallback), currentPayableCount: currentPayableCount, follow: follow, followRefs: followRefs, fallback: fallback };
  }
  function localData(entries0, c) { var team = Object.create(null), teamRows = [], supplies = Object.create(null), grants = [], i, e, key; for (i = 0; i < entries0.length; i += 1) { e = entries0[i]; if (e.capabilityKind === 'TEAM_EFFECT') { team[e.identity] = e; teamRows.push(e); } else if (e.capabilityKind === 'RESOURCE_SUPPLY') { key = JSON.stringify([e.targetId, e.resourceKey]); if (!supplies[key]) supplies[key] = { nowRows: [], amount: 0, refs: null }; if (e.timeBand === 'NOW') supplies[key].nowRows.push(e); } else grants.push(e); } var supplyKeys = Object.keys(supplies).sort(), j, rows, values; for (i = 0; i < supplyKeys.length; i += 1) { rows = supplies[supplyKeys[i]].nowRows; values = []; for (j = 0; j < rows.length; j += 1) values.push(rows[j].supplyAmount); supplies[supplyKeys[i]].amount = neumaier(values); supplies[supplyKeys[i]].refs = recordRefs(rows, c); } grants.sort(function (a, b) { return a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0; }); return { team: team, teamRows: teamRows, supplies: supplies, supplyKeys: supplyKeys, grants: grants }; }
  function upperBound(values, target) { var low = 0, high = values.length; while (low < high) { var mid = low + Math.floor((high - low) / 2); if (values[mid] <= target) low = mid + 1; else high = mid; } return low; }
  function teamFeatures(shared, local, bc, cc, c) { var bKeys = shared.teamKeys, rKeys = Object.keys(local.team).sort(), intersection = [], novel = [], i, row; for (i = 0; i < rKeys.length; i += 1) { row = local.team[rKeys[i]]; if (shared.team[rKeys[i]]) intersection.push(row, shared.team[rKeys[i]]); else novel.push(row); } function ops() { return [operand('baselineRelationCount', bKeys.length, 'COUNT', shared.teamRefs, c, shared.fallback), operand('candidateRelationCount', rKeys.length, 'COUNT', local.teamRows, c, shared.fallback), operand('intersectionCount', intersection.length / 2, 'COUNT', intersection, c, shared.fallback), operand('novelRelationCount', novel.length, 'COUNT', novel, c, shared.fallback)]; } if (bc.TEAM_EFFECT === 'PARTIAL' || cc.TEAM_EFFECT === 'PARTIAL') return [feature(FEATURES[0], 'UNKNOWN', 'AXIS_PARTIAL', null, ops(), c, shared.fallback), feature(FEATURES[1], 'UNKNOWN', 'AXIS_PARTIAL', null, ops(), c, shared.fallback)]; if (rKeys.length === 0) return [feature(FEATURES[0], 'NOT_APPLICABLE', 'NO_CANDIDATE_TEAM_EFFECT', null, ops(), c, shared.fallback), feature(FEATURES[1], 'NOT_APPLICABLE', 'NO_CANDIDATE_TEAM_EFFECT', null, ops(), c, shared.fallback)]; return [feature(FEATURES[0], 'KNOWN', 'OK', novel.length / rKeys.length, ops(), c, shared.fallback), feature(FEATURES[1], 'KNOWN', 'OK', intersection.length / 2 / rKeys.length, ops(), c, shared.fallback)]; }
  function resourceFeature(shared, local, cc, catalog, c) { var supplyRefs = [], coveredRefs = [], supplyValues = [], coveredValues = [], anyNow = false, i, key, group, supply; for (i = 0; i < local.supplyKeys.length; i += 1) { key = local.supplyKeys[i]; supply = local.supplies[key]; if (supply.nowRows.length === 0) continue; anyNow = true; group = shared.groups[key]; if (!group || !group.deficit) continue; supplyValues.push(supply.amount); coveredValues.push(Math.min(supply.amount, group.deficit)); supplyRefs.push(supply.refs); coveredRefs.push(supply.refs, group.deficitRefs); } var ops = [operand('deficitCount', shared.deficitKeys.length, 'COUNT', shared.deficitRefs, c, shared.fallback), operand('deficitTotal', shared.deficitTotal, 'ABS', shared.deficitRefs, c, shared.fallback), operand('suppliedTotal', neumaier(supplyValues), 'ABS', supplyRefs, c, shared.fallback), operand('coveredTotal', neumaier(coveredValues), 'ABS', coveredRefs, c, shared.fallback)]; if (cc.RESOURCE_SUPPLY === 'PARTIAL') return feature(FEATURES[2], 'UNKNOWN', 'AXIS_PARTIAL', null, ops, c, shared.fallback); if (shared.deficitKeys.length === 0) return feature(FEATURES[2], 'NOT_APPLICABLE', 'NO_RESOURCE_DEFICIT', null, ops, c, shared.fallback); if (!anyNow) return feature(FEATURES[2], 'NOT_APPLICABLE', 'NO_RESOURCE_SUPPLY', null, ops, c, shared.fallback); return feature(FEATURES[2], 'KNOWN', 'OK', neumaier(coveredValues) / shared.deficitTotal, ops, c, shared.fallback); }
  function consumerFeature(shared, local, cc, catalog, c) { var newlyRefs = [], axisConsumerRefs = [], axisInitialRefs = [], newlyCount = 0, axisCount = 0, initiallyCount = 0, hasAxis = false, i, key, supply, group, count, prefix; for (i = 0; i < local.supplyKeys.length; i += 1) { key = local.supplyKeys[i]; supply = local.supplies[key]; group = shared.groups[key]; if (!group) continue; hasAxis = true; axisCount += group.allRows.length; initiallyCount += group.allRows.length - group.currentPayableCount; axisConsumerRefs.push(group.consumerRefs); axisInitialRefs.push(group.initiallyRefs); if (supply.nowRows.length === 0) continue; count = upperBound(group.thresholds, supply.amount); newlyCount += count; if (supply.refs) newlyRefs.push(supply.refs); prefix = linkedRefs(group, count); if (prefix) newlyRefs.push(prefix); } var consumerCount = hasAxis ? axisCount : shared.consumerCount, initialCount = hasAxis ? initiallyCount : shared.initiallyCount, consumerRefs = hasAxis ? axisConsumerRefs : shared.consumerRefs, initialRefs = hasAxis ? axisInitialRefs : shared.initiallyRefs; var ops = [operand('consumerCount', consumerCount, 'COUNT', consumerRefs, c, shared.fallback), operand('initiallyUnpayableCount', initialCount, 'COUNT', initialRefs, c, shared.fallback), operand('newlyPayableCount', newlyCount, 'COUNT', newlyRefs, c, shared.fallback)]; if (cc.RESOURCE_SUPPLY === 'PARTIAL') return feature(FEATURES[3], 'UNKNOWN', 'AXIS_PARTIAL', null, ops, c, shared.fallback); if (consumerCount === 0) return feature(FEATURES[3], 'NOT_APPLICABLE', 'NO_RESOURCE_CONSUMER', null, ops, c, shared.fallback); return feature(FEATURES[3], 'KNOWN', 'OK', newlyCount / consumerCount, ops, c, shared.fallback); }
  function followupFeature(shared, local, cc, catalog, c) { var bound = [], matched = 0, i, grant, key; for (i = 0; i < local.grants.length; i += 1) { grant = local.grants[i]; key = JSON.stringify([grant.ownerId, grant.followUpKey]); if (shared.follow[key]) { matched += 1; bound.push(grant, shared.followRefs[key]); } } var ops = [operand('grantCount', local.grants.length, 'COUNT', local.grants, c, shared.fallback, true), operand('consumerBoundGrantCount', matched, 'COUNT', bound, c, shared.fallback, true)]; if (catalog === 'PARTIAL' || cc.FOLLOW_UP === 'PARTIAL') return feature(FEATURES[4], 'UNKNOWN', catalog === 'PARTIAL' ? 'ACTION_CATALOG_PARTIAL' : 'AXIS_PARTIAL', null, ops, c, shared.fallback, true); if (local.grants.length === 0) return feature(FEATURES[4], 'NOT_APPLICABLE', 'NO_FOLLOW_UP_GRANT', null, ops, c, shared.fallback, true); return feature(FEATURES[4], 'KNOWN', 'OK', matched / local.grants.length, ops, c, shared.fallback, true); }
  function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); var keys = Object.keys(value), i; for (i = 0; i < keys.length; i += 1) freeze(value[keys[i]]); return value; }
  function compileDecision(input) { var data = validateInput(input), shared = sharedData(data.base, data.consumers, data.closure), order = data.ids.slice().sort(), byId = Object.create(null), out = [], i, id0, local, cc, team; for (i = 0; i < data.ids.length; i += 1) byId[data.ids[i]] = data.local[i]; for (i = 0; i < order.length; i += 1) { id0 = order[i]; local = localData(byId[id0], data.closure); cc = data.candidateComp[id0]; team = teamFeatures(shared, local, data.baseComp, cc, data.closure); out.push({ candidateId: id0, features: [team[0], team[1], resourceFeature(shared, local, cc, data.catalog, data.closure), consumerFeature(shared, local, cc, data.catalog, data.closure), followupFeature(shared, local, cc, data.catalog, data.closure)] }); } return freeze({ schemaVersion: SCHEMA, perCandidate: out }); }
  root.__LWCS_BEHAVIOR_RELATIONAL_FEATURE__ = Object.freeze({ compileDecision: compileDecision });
})(typeof globalThis === 'object' ? globalThis : this);

// ===== candidateImpactEnvelope (BehaviorCandidateImpactEnvelope_Module.js) =====

// BehaviorCandidateImpactEnvelope_Module.js
// Current-step public impact carrier. It never reads another module or a runtime.
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 'BehaviorCandidateImpactEnvelopeV1';
  const CONTRACT_HASH = '7a575aa29a30403719374cde3c6db763f0df0368025e6542beed1093589318b4';
  const SCHEMA_HASH = 'f05bcb34afc82922bda3e965213b2af6d85483e605159b8752e61ca037ff4b77';
  const SUM_TOLERANCE = 1e-12;
  const STATUSES = new Set(['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE']);
  const CAUSAL_OWNERS = new Set(['STATE_DELTA', 'ACTION_POOL_DELTA', 'TERMINAL_DELTA', 'NONE']);
  const UNIT_FAMILIES = new Set([
    'COUNT', 'ABS', 'POWER', 'PERCENT', 'RATIO_0_1', 'PROBABILITY_0_1',
    'TURNS', 'BOOL', 'ENUM', 'RATIO',
  ]);
  const FORBIDDEN_KEYS = /^(?:futureWorld|futureRoute|futureRouteTree|routeTree|runtimeRealized|realizedOutcome|hiddenIntent|topK|renormalized|renormalize|skillName|roleName)$/iu;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function fail(code, path) {
    const error = new Error(code + (path ? ':' + path : ''));
    error.code = code;
    throw error;
  }

  function plainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.prototype.toString.call(value) !== '[object Object]') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || (typeof prototype === 'object' && prototype.constructor?.name === 'Object');
  }

  function ensurePlain(value, path) {
    if (!plainObject(value)) fail('PLAIN_OBJECT_REQUIRED', path);
  }

  function ensureKeys(value, allowed, path) {
    ensurePlain(value, path);
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(value)) {
      if (!allowedSet.has(key)) fail('CLOSED_SHAPE_EXTRA_KEY', path + '.' + key);
    }
  }

  function opaqueId(value, path) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) {
      fail('OPAQUE_ID_INVALID', path);
    }
    return value;
  }

  function reasonCode(value, path) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 128 || !/^[A-Z0-9:_-]+$/u.test(value)) {
      fail('REASON_CODE_INVALID', path);
    }
    return value;
  }

  function hash(value, path) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) fail('HASH_INVALID', path);
    return value;
  }

  function finite(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('FINITE_NUMBER_REQUIRED', path);
    return Object.is(value, -0) ? 0 : value;
  }

  function probability(value, path) {
    value = finite(value, path);
    if (value < 0 || value > 1) fail('PROBABILITY_OUT_OF_RANGE', path);
    return value;
  }

  function idArray(value, path, required) {
    if (!Array.isArray(value) || (required && value.length === 0)) fail('ID_ARRAY_INVALID', path);
    const result = value.map((item, index) => opaqueId(item, path + '[' + index + ']'));
    if (new Set(result).size !== result.length) fail('ID_ARRAY_DUPLICATE', path);
    return result;
  }

  function deepFreeze(value, seen) {
    if (value === null || typeof value !== 'object') return value;
    seen = seen || new WeakSet();
    if (seen.has(value)) return value;
    seen.add(value);
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key], seen);
    return value;
  }

  function rejectForbidden(value, path, seen) {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) fail('INPUT_CYCLE', path);
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => rejectForbidden(item, path + '[' + index + ']', seen));
      seen.delete(value);
      return;
    }
    if (!plainObject(value)) fail('PLAIN_OBJECT_REQUIRED', path);
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.test(key)) fail('FORBIDDEN_INPUT_KEY', path + '.' + key);
      rejectForbidden(value[key], path + '.' + key, seen);
    }
    seen.delete(value);
  }

  function normalizeSource(value, path) {
    if (value === undefined) return undefined;
    ensurePlain(value, path);
    ensureKeys(value, ['kind', 'sourceFactIds', 'sourceEventIds', 'modelId', 'modelVersion', 'modelHash', 'inputHash', 'prototypeHash'], path);
    if (value.kind === 'NONE') {
      if (Object.keys(value).length !== 1) fail('NONE_SOURCE_HAS_FIELDS', path);
      return { kind: 'NONE' };
    }
    if (value.kind === 'CURRENT_PUBLIC_MECHANICS') {
      return {
        kind: value.kind,
        sourceFactIds: idArray(value.sourceFactIds, path + '.sourceFactIds', true),
        sourceEventIds: idArray(value.sourceEventIds, path + '.sourceEventIds', true),
      };
    }
    if (value.kind === 'OFFLINE_DISTILLED_MODEL') {
      return {
        kind: value.kind,
        modelId: opaqueId(value.modelId, path + '.modelId'),
        modelVersion: opaqueId(value.modelVersion, path + '.modelVersion'),
        modelHash: hash(value.modelHash, path + '.modelHash'),
        inputHash: hash(value.inputHash, path + '.inputHash'),
        prototypeHash: hash(value.prototypeHash, path + '.prototypeHash'),
      };
    }
    fail('SOURCE_KIND_INVALID', path + '.kind');
  }

  function responseSourceOrUnknown(value, path) {
    if (value === undefined) return { source: undefined, reason: 'MODEL_SOURCE_MISSING' };
    ensurePlain(value, path);
    ensureKeys(value, ['kind', 'sourceFactIds', 'sourceEventIds', 'modelId', 'modelVersion', 'modelHash', 'inputHash', 'prototypeHash'], path);
    if (value.kind === 'NONE') return { source: undefined, reason: 'MODEL_SOURCE_MISSING' };
    if (value.kind === 'OFFLINE_DISTILLED_MODEL') {
      const required = ['modelId', 'modelVersion', 'modelHash', 'inputHash', 'prototypeHash'];
      if (required.some(key => !own(value, key))) return { source: undefined, reason: 'MODEL_INPUT_NOT_CLOSED' };
    }
    if (value.kind === 'CURRENT_PUBLIC_MECHANICS' && (!own(value, 'sourceFactIds') || !own(value, 'sourceEventIds'))) {
      return { source: undefined, reason: 'PUBLIC_INPUT_NOT_CLOSED' };
    }
    return { source: normalizeSource(value, path), reason: 'NONE' };
  }

  function normalizeFactDeltas(value, path) {
    if (!Array.isArray(value)) fail('FACT_DELTA_ARRAY_REQUIRED', path);
    return value.map((row, index) => {
      const rowPath = path + '[' + index + ']';
      ensureKeys(row, ['status', 'targetUnitId', 'sourceFactId', 'sourceEventId', 'causalOwner', 'unitFamily', 'value'], rowPath);
      if (!STATUSES.has(row.status)) fail('FACT_DELTA_STATUS_INVALID', rowPath + '.status');
      const result = {
        status: row.status,
        targetUnitId: opaqueId(row.targetUnitId, rowPath + '.targetUnitId'),
        sourceFactId: opaqueId(row.sourceFactId, rowPath + '.sourceFactId'),
        sourceEventId: opaqueId(row.sourceEventId, rowPath + '.sourceEventId'),
        causalOwner: row.causalOwner,
        unitFamily: row.unitFamily,
      };
      if (!CAUSAL_OWNERS.has(row.causalOwner)) fail('FACT_DELTA_CAUSAL_OWNER_INVALID', rowPath + '.causalOwner');
      if (typeof row.unitFamily !== 'string' || !UNIT_FAMILIES.has(row.unitFamily)) fail('FACT_DELTA_UNIT_FAMILY_INVALID', rowPath + '.unitFamily');
      if (row.status === 'KNOWN') result.value = finite(row.value, rowPath + '.value');
      else if (own(row, 'value')) fail('UNKNOWN_FACT_VALUE_FORBIDDEN', rowPath + '.value');
      return result;
    });
  }

  function normalizeActionPool(value, path) {
    ensureKeys(value, ['status', 'value', 'sourceFactIds', 'sourceEventIds', 'causalOwner'], path);
    if (!STATUSES.has(value.status)) fail('ACTION_POOL_STATUS_INVALID', path + '.status');
    if (value.causalOwner !== 'ACTION_POOL_DELTA') fail('ACTION_POOL_CAUSAL_OWNER_INVALID', path + '.causalOwner');
    const result = {
      status: value.status,
      sourceFactIds: idArray(value.sourceFactIds, path + '.sourceFactIds', true),
      sourceEventIds: idArray(value.sourceEventIds, path + '.sourceEventIds', true),
    };
    if (value.status === 'KNOWN') result.value = finite(value.value, path + '.value');
    else if (own(value, 'value')) fail('UNKNOWN_ACTION_POOL_VALUE_FORBIDDEN', path + '.value');
    return result;
  }

  function normalizeConsumers(value, path) {
    ensureKeys(value, ['status', 'identities', 'sourceFactIds', 'sourceEventIds', 'reason'], path);
    if (!STATUSES.has(value.status)) fail('CONSUMER_STATUS_INVALID', path + '.status');
    const identities = idArray(value.identities, path + '.identities', false);
    const sourceFactIds = idArray(value.sourceFactIds, path + '.sourceFactIds', false);
    const sourceEventIds = idArray(value.sourceEventIds, path + '.sourceEventIds', false);
    if (value.status === 'KNOWN' && (!identities.length || !sourceFactIds.length || !sourceEventIds.length)) fail('KNOWN_CONSUMER_PROVENANCE_REQUIRED', path);
    if (value.status !== 'KNOWN' && identities.length) fail('UNKNOWN_CONSUMER_IDENTITY_FORBIDDEN', path + '.identities');
    const result = { status: value.status, identities, sourceFactIds, sourceEventIds };
    if (value.status !== 'KNOWN') result.reason = reasonCode(value.reason, path + '.reason');
    return result;
  }

  function normalizePublicEvidence(value, path) {
    ensureKeys(value, ['status', 'beliefRevision', 'sourceFactIds', 'sourceEventIds'], path);
    if (value.status !== 'KNOWN') fail('PUBLIC_EVIDENCE_MUST_BE_KNOWN', path + '.status');
    return {
      status: 'KNOWN',
      beliefRevision: opaqueId(value.beliefRevision, path + '.beliefRevision'),
      sourceFactIds: idArray(value.sourceFactIds, path + '.sourceFactIds', true),
      sourceEventIds: idArray(value.sourceEventIds, path + '.sourceEventIds', true),
    };
  }

  function normalizeCapabilities(value, path) {
    ensureKeys(value, ['status', 'capabilityIds', 'source', 'reason'], path);
    if (!STATUSES.has(value.status)) fail('CAPABILITY_STATUS_INVALID', path + '.status');
    const capabilityIds = idArray(value.capabilityIds, path + '.capabilityIds', false);
    const result = { status: value.status, capabilityIds };
    if (value.status === 'KNOWN') {
      if (!capabilityIds.length) fail('KNOWN_CAPABILITY_EMPTY', path + '.capabilityIds');
      result.source = normalizeSource(value.source, path + '.source');
      if (!result.source || result.source.kind === 'NONE') fail('KNOWN_CAPABILITY_SOURCE_REQUIRED', path + '.source');
    } else {
      if (capabilityIds.length) fail('UNKNOWN_CAPABILITY_IDENTITY_FORBIDDEN', path + '.capabilityIds');
      if (value.source !== undefined) result.source = normalizeSource(value.source, path + '.source');
      result.reason = reasonCode(value.reason, path + '.reason');
    }
    return result;
  }

  function normalizeContinuation(value, path) {
    ensureKeys(value, ['status', 'value', 'source', 'reason'], path);
    if (!STATUSES.has(value.status)) fail('CONTINUATION_STATUS_INVALID', path + '.status');
    const result = { status: value.status };
    if (value.status === 'KNOWN') {
      result.value = probability(value.value, path + '.value');
      result.source = normalizeSource(value.source, path + '.source');
      if (!result.source || result.source.kind === 'NONE') fail('KNOWN_CONTINUATION_SOURCE_REQUIRED', path + '.source');
    } else {
      if (own(value, 'value')) fail('UNKNOWN_CONTINUATION_VALUE_FORBIDDEN', path + '.value');
      result.source = normalizeSource(value.source, path + '.source');
      if (!result.source) fail('UNKNOWN_CONTINUATION_SOURCE_REQUIRED', path + '.source');
      result.reason = reasonCode(value.reason, path + '.reason');
    }
    return result;
  }

  function normalizeRequestIdentity(value, path) {
    ensureKeys(value, ['preparedRequestHash', 'worldRevision', 'beliefRevision', 'opportunityRevision', 'candidateSetHash'], path);
    const result = {};
    if (own(value, 'preparedRequestHash')) result.preparedRequestHash = hash(value.preparedRequestHash, path + '.preparedRequestHash');
    if (own(value, 'worldRevision')) result.worldRevision = opaqueId(value.worldRevision, path + '.worldRevision');
    if (own(value, 'beliefRevision')) result.beliefRevision = opaqueId(value.beliefRevision, path + '.beliefRevision');
    if (own(value, 'opportunityRevision')) result.opportunityRevision = opaqueId(value.opportunityRevision, path + '.opportunityRevision');
    if (own(value, 'candidateSetHash')) result.candidateSetHash = hash(value.candidateSetHash, path + '.candidateSetHash');
    return result;
  }

  function unknownResponse(legalResponseCandidateIds, reason) {
    return {
      status: 'UNKNOWN',
      legalResponseCandidateIds: legalResponseCandidateIds.slice(),
      entries: [],
      reason: reasonCode(reason, 'response.reason'),
    };
  }

  function normalizeResponse(legalResponseCandidateIds, responseModel, candidateId, preparedIds) {
    if (responseModel === undefined) return unknownResponse(legalResponseCandidateIds, 'NO_RESPONSE_MODEL');
    ensurePlain(responseModel, 'responseModel');
    ensureKeys(responseModel, ['source', 'outputsByCandidateId'], 'responseModel');
    const sourceState = responseSourceOrUnknown(responseModel.source, 'responseModel.source');
    const outputs = responseModel.outputsByCandidateId;
    if (!sourceState.source || outputs === undefined) return unknownResponse(legalResponseCandidateIds, sourceState.reason === 'NONE' ? 'MODEL_OUTPUT_NOT_CLOSED' : sourceState.reason);
    ensurePlain(outputs, 'responseModel.outputsByCandidateId');
    for (const key of Object.keys(outputs)) if (!preparedIds.includes(key)) fail('RESPONSE_OUTPUT_UNKNOWN_CANDIDATE', key);
    if (!own(outputs, candidateId)) return unknownResponse(legalResponseCandidateIds, 'MODEL_OUTPUT_MISSING');
    const output = outputs[candidateId];
    ensureKeys(output, ['entries'], 'responseModel.outputsByCandidateId.' + candidateId);
    if (!Array.isArray(output.entries) || output.entries.length !== legalResponseCandidateIds.length) fail('RESPONSE_COVERAGE', candidateId);
    const entries = output.entries.map((entry, index) => {
      ensureKeys(entry, ['candidateId', 'probability'], 'responseModel.entries[' + index + ']');
      return {
        candidateId: opaqueId(entry.candidateId, 'responseModel.entries[' + index + '].candidateId'),
        probability: probability(entry.probability, 'responseModel.entries[' + index + '].probability'),
      };
    });
    if (entries.some((entry, index) => entry.candidateId !== legalResponseCandidateIds[index])) fail('RESPONSE_COVERAGE', candidateId);
    const sum = entries.reduce((total, entry) => total + entry.probability, 0);
    if (Math.abs(sum - 1) > SUM_TOLERANCE) fail('RESPONSE_PROBABILITY_SUM', candidateId);
    return {
      status: 'KNOWN',
      legalResponseCandidateIds: legalResponseCandidateIds.slice(),
      entries,
      source: sourceState.source,
      reason: 'NONE',
    };
  }

  function build(input) {
    ensurePlain(input, 'input');
    rejectForbidden(input, 'input', new WeakSet());
    ensureKeys(input, ['preparedFrozenCandidateIds', 'candidates', 'legalResponseCandidateIds', 'responseModel', 'requestIdentity'], 'input');
    const preparedIds = idArray(input.preparedFrozenCandidateIds, 'input.preparedFrozenCandidateIds', true);
    const legalResponseCandidateIds = idArray(input.legalResponseCandidateIds, 'input.legalResponseCandidateIds', true);
    if (!Array.isArray(input.candidates) || input.candidates.length !== preparedIds.length) fail('CANDIDATE_CLOSURE', 'input.candidates');

    const envelopes = input.candidates.map((candidate, index) => {
      const candidatePath = 'input.candidates[' + index + ']';
      ensureKeys(candidate, [
        'candidateId', 'currentFactDeltas', 'actionPoolFacts', 'futureConsumerIdentities',
        'publicEvidence', 'contingencyCapabilities', 'continuationSurrogate',
      ], candidatePath);
      if (candidate.candidateId !== preparedIds[index]) fail('CANDIDATE_ORDER_OR_SET', candidatePath + '.candidateId');
      return {
        candidateId: candidate.candidateId,
        currentFactDeltas: normalizeFactDeltas(candidate.currentFactDeltas, candidatePath + '.currentFactDeltas'),
        actionPoolDelta: normalizeActionPool(candidate.actionPoolFacts, candidatePath + '.actionPoolFacts'),
        futureConsumerIdentities: normalizeConsumers(candidate.futureConsumerIdentities, candidatePath + '.futureConsumerIdentities'),
        opponentResponseDistribution: normalizeResponse(legalResponseCandidateIds, input.responseModel, candidate.candidateId, preparedIds),
        publicEvidence: normalizePublicEvidence(candidate.publicEvidence, candidatePath + '.publicEvidence'),
        contingencyCapabilities: normalizeCapabilities(candidate.contingencyCapabilities, candidatePath + '.contingencyCapabilities'),
        continuationSurrogate: normalizeContinuation(candidate.continuationSurrogate, candidatePath + '.continuationSurrogate'),
      };
    });

    const document = {
      preparedFrozenCandidateIds: preparedIds.slice(),
      envelopes,
    };
    if (input.requestIdentity !== undefined) document.requestIdentity = normalizeRequestIdentity(input.requestIdentity, 'input.requestIdentity');
    const audit = {
      schemaVersion: 'BehaviorCandidateImpactEnvelopeBuildAuditV1',
      candidateCount: envelopes.length,
      responseKnownCount: envelopes.filter(item => item.opponentResponseDistribution.status === 'KNOWN').length,
      responseUnknownCount: envelopes.filter(item => item.opponentResponseDistribution.status === 'UNKNOWN').length,
      factKnownRowCount: envelopes.reduce((total, item) => total + item.currentFactDeltas.filter(row => row.status === 'KNOWN').length, 0),
      factUnknownRowCount: envelopes.reduce((total, item) => total + item.currentFactDeltas.filter(row => row.status !== 'KNOWN').length, 0),
      actionPoolKnownCount: envelopes.filter(item => item.actionPoolDelta.status === 'KNOWN').length,
      actionPoolUnknownCount: envelopes.filter(item => item.actionPoolDelta.status !== 'KNOWN').length,
      actionPoolOwnerValidated: true,
      carrierOnly: true,
    };
    return deepFreeze({ document, audit });
  }

  const api = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    contractHash: CONTRACT_HASH,
    schemaHash: SCHEMA_HASH,
    build,
  });
  root.__LWCS_BEHAVIOR_CANDIDATE_IMPACT_ENVELOPE__ = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);

// ===== linearScoreProvider (BehaviorLinearScoreProvider_Module.js) =====

/* BehaviorLinearScoreProvider_Module.js
 * Task 6 core batch A: online lightweight LINEAR_SCORE_V1 provider (r9v2).
 * Pure candidate-only selection: frozen candidates -> public immediate features
 * -> frozen 31-code scalarization + embedded two-code reaction head ->
 * total linear score -> hard-exclusion removal ->
 * deterministic ordering (score desc, exact-tie candidateId UTF-16 asc) ->
 * structural alternative -> same-source structured reason factors.
 * The sealed model whitelist constants are embedded (never read from
 * gitignored artifacts at runtime): normalization, linear, featureAggregation,
 * modelHash, weightsHash, featureSchemaHash. Old Kernel/direct/future-route/S4
 * traversal has zero calls and zero fallback here.
 */
(function (root) {
  'use strict';

  const PROVIDER_ID = 'r9v2';
  const ENGINE = 'R9V2_LINEAR';
  const SCHEMA_VERSION = 'BehaviorLinearScoreProviderV1';
  const MOUNT_NAME = '__LWCS_BEHAVIOR_LINEAR_PROVIDER__';

  // Sealed model whitelist (artifacts/rc6/distilled-linear-score-v1.json raw
  // 432b82e0...; sealed binding m2-linear-score-v1-rev9-binding.json).
  const MODEL_HASH = '5308f3bcbb60413e6161089397d59224ec3a7d92c60c58062067df19f9024ced';
  const WEIGHTS_HASH = '2daa34c9aa8e340efa83d6caee433d19dc204ac9b52e0ea48d55591192a67550';
  const FEATURE_SCHEMA_HASH = '9d083542dff4609b7ca7d55fdf3b204bc62fc2f40e350298f46db00d2ab5a121';
  const DBP_REVISION = 15;
  const DBP_CONTRACT_HASH = '69f353556b6bc555db1f67e8d0549a68bed5de18f112ff89496912559c784de8';
  const BIF_CONTRACT_HASH = '8dc4ff92e2ac2d81bee176e8839b23c8ab34ceec951b2ab91ebe80c12ec02a76';
  const BASE_SECTION_HASH = '1a6ba7bbf8543221f9620b29a6884d723a35b1eedc64ac9b508418e242f3fa0d';
  const REACTION_HEAD_HASH = 'b08565ade014bed633f5917aaa3891ba2730a18f8c9885c1c9c983db5c8f4a62';
  const MODEL_COMPOSITE_HASH = '1571f142a29ad9e6faef6644533a632942dbd57867a5aa00c2ca76b685a2dd8c';
  const REACTION_ALGORITHM_HASH = '5ddd1dff3f07d3aa7c1b48f627cd5a3c64de9025941fab25923b52851b8a1852';
  const OP_DAMAGE_POWER = 'NEUMAIER\u005fSUM';
  const OP_DAMAGE_SEGMENTS = 'INTEGER\u005fSUM';

  // 35-code catalog: 31 scoreable + 2 exclusion-only + 2 catalog-only.
  const SCOREABLE_CODES = Object.freeze([
    'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE', 'SUCCESS_PROBABILITY',
    'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY',
    'REVEAL_STRENGTH', 'OVERKILL_AVAILABILITY', 'OUTSIDE_BATCH1_ROW_COUNT',
    'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE',
    'RESOURCE_DELTA', 'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA',
    'STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT',
    'SETTLEMENT_MODIFIER_PERCENT', 'SUMMON_COUNT', 'SUMMON_STRENGTH',
    'SUMMON_DURATION', 'RESOURCE_DELTA_PERCENT',
    'TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO',
    'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE',
    'PUBLIC_RECIPIENT_NEED_MATCH',
  ]);
  const RELATIONAL_CODES = Object.freeze([
    'TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO',
    'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE',
  ]);
  const EXCLUSION_ONLY = Object.freeze(['HARD_EXCLUSION', 'HARD_EXCLUSION_REASON']);
  const CATALOG_ONLY = Object.freeze(['SETTLEMENT_DAMAGE', 'ROLL_REALIZATION']);
  const ENUM_CODES = new Set(['RELATION_TARGET_SIDE']);
  const HARD_EXCLUSION_CODES = Object.freeze([
    'ACTOR_DISABLED', 'ACTOR_TERMINAL', 'TARGET_EMPTY', 'INVALID_OPTION_VALUE',
    'MISSING_REQUIRED_FIELD', 'UNKNOWN_STATE', 'UNKNOWN_RULE',
    'AMBIGUOUS_TAUNT_TARGET', 'ILLEGAL_TARGET', 'RESOURCE_INSUFFICIENT',
  ]);

  // DistilledBehaviorPolicyV1 rev15 missingPolicyV1 (scoreable codes only).
  const MISSING_POLICY = deepFreeze({
    RELATION_TARGET_COUNT: { unknown: 'REQUIRE_KNOWN', na: 'REQUIRE_KNOWN' },
    RELATION_TARGET_SIDE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUCCESS_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'UNKNOWN_TO_TRAIN_MEAN' },
    PUBLIC_HP_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    PUBLIC_RESOURCE_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    COST_AFFORDABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'UNKNOWN_TO_TRAIN_MEAN' },
    REVEAL_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    OVERKILL_AVAILABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    OUTSIDE_BATCH1_ROW_COUNT: { unknown: 'REQUIRE_KNOWN', na: 'REQUIRE_KNOWN' },
    DAMAGE_POWER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    DAMAGE_SEGMENTS: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    DAMAGE_PENETRATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    DAMAGE_TYPE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SHIELD_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    ATTRIBUTE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    JUDGMENT_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    STATE_PRESENCE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    STATE_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_DURATION'] },
    STATE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SETTLEMENT_MODIFIER_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUMMON_COUNT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUMMON_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    SUMMON_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    TEAM_EFFECT_MARGINAL_GAIN: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    TEAM_EFFECT_REDUNDANCY_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    RESOURCE_DEFICIT_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_RESOURCE_DEFICIT', 'NO_RESOURCE_SUPPLY'] },
    RESOURCE_CONSUMER_FIT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_RESOURCE_CONSUMER'] },
    TEAM_FOLLOWUP_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', zeroReasons: ['NO_FOLLOW_UP_GRANT'] },
    PUBLIC_RECIPIENT_NEED_MATCH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
  });

  // Per-code duplicate-row aggregation, exactly the frozen DBP rev14 table.
  const AGGREGATION = Object.freeze({
    JUDGMENT_DELTA: 'SUM',
    STATE_DURATION: 'MAX',
    STATE_DELTA_PERCENT: 'SUM',
    SETTLEMENT_MODIFIER_PERCENT: 'SUM',
    RESOURCE_DELTA_PERCENT: 'MAX',
    DAMAGE_POWER: OP_DAMAGE_POWER,
    DAMAGE_SEGMENTS: OP_DAMAGE_SEGMENTS,
    DAMAGE_TYPE: 'MAX',
  });

  // Multi-row closure inventory (AGGREGATION_CLOSURE_V2): the 31 scoreable
  // codes are partitioned into contract-adjudicated multi-row codes with a
  // frozen operator (multiRowCodes, 8), fail-closed multi-row-capable codes
  // (7), and single-row codes (16).
  // (singleRowCodes, 16: candidate-scope BIF codes + five relational codes +
  // ATTRIBUTE_DELTA, which is collapsed inside BIF). Codes outside
  // multiRowCodes keep the fatal as a source-drift safety net.
  const AGGREGATION_CLOSURE = Object.freeze({
    version: 'AGGREGATION_CLOSURE_V2',
    multiRowCodes: Object.freeze([
      'JUDGMENT_DELTA', 'STATE_DURATION', 'STATE_DELTA_PERCENT',
      'SETTLEMENT_MODIFIER_PERCENT', 'RESOURCE_DELTA_PERCENT',
      'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_TYPE',
    ]),
    failClosedMultiRowCodes: Object.freeze([
      'DAMAGE_PENETRATION',
      'RESOURCE_DELTA', 'SHIELD_DELTA', 'STATE_PRESENCE', 'SUMMON_COUNT',
      'SUMMON_STRENGTH', 'SUMMON_DURATION',
    ]),
    singleRowCodes: Object.freeze([
      'RELATION_TARGET_COUNT', 'RELATION_TARGET_SIDE', 'SUCCESS_PROBABILITY',
      'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY',
      'REVEAL_STRENGTH', 'OVERKILL_AVAILABILITY', 'OUTSIDE_BATCH1_ROW_COUNT',
      'PUBLIC_RECIPIENT_NEED_MATCH',
      'TEAM_EFFECT_MARGINAL_GAIN', 'TEAM_EFFECT_REDUNDANCY_RATIO',
      'RESOURCE_DEFICIT_COVERAGE', 'RESOURCE_CONSUMER_FIT',
      'TEAM_FOLLOWUP_COVERAGE',
      'ATTRIBUTE_DELTA',
    ]),
    collapsedInBif: Object.freeze(['ATTRIBUTE_DELTA']),
  });

  // Sealed normalization (training KNOWN rows only; scales = std + 1e-6).
  const NORMALIZATION = Object.freeze({
    means: Object.freeze({
      ATTRIBUTE_DELTA: 14.5, COST_AFFORDABILITY: 1, DAMAGE_PENETRATION: 14.225806451612904,
      DAMAGE_POWER: 23.38761904761905, DAMAGE_SEGMENTS: 2.142857142857143, DAMAGE_TYPE: 1,
      JUDGMENT_DELTA: -2.609375, OUTSIDE_BATCH1_ROW_COUNT: 0.10471204188481675,
      OVERKILL_AVAILABILITY: 0, PUBLIC_HP_RATIO: 0.9090386642361269,
      PUBLIC_RECIPIENT_NEED_MATCH: 0.0002879581151832461, PUBLIC_RESOURCE_RATIO: 0.6952879581151833,
      RELATION_TARGET_COUNT: 1.1151832460732984, RELATION_TARGET_SIDE: 0,
      RESOURCE_CONSUMER_FIT: 0, RESOURCE_DEFICIT_COVERAGE: 0, RESOURCE_DELTA: 0,
      RESOURCE_DELTA_PERCENT: 15.344, REVEAL_STRENGTH: 0, SETTLEMENT_MODIFIER_PERCENT: 4,
      SHIELD_DELTA: 0, STATE_DELTA_PERCENT: -11.5, STATE_DURATION: 1.0441176470588236,
      STATE_PRESENCE: 1, SUCCESS_PROBABILITY: 0.6946307757209801, SUMMON_COUNT: 1,
      SUMMON_DURATION: 1, SUMMON_STRENGTH: 0.11, TEAM_EFFECT_MARGINAL_GAIN: 1,
      TEAM_EFFECT_REDUNDANCY_RATIO: 0, TEAM_FOLLOWUP_COVERAGE: 0,
    }),
    scales: Object.freeze({
      ATTRIBUTE_DELTA: 1, COST_AFFORDABILITY: 1, DAMAGE_PENETRATION: 8.43842952446704,
      DAMAGE_POWER: 27.46451106988264, DAMAGE_SEGMENTS: 2.5501777312373113, DAMAGE_TYPE: 1,
      JUDGMENT_DELTA: 5.167106051126307, OUTSIDE_BATCH1_ROW_COUNT: 0.42132873903100887,
      OVERKILL_AVAILABILITY: 1, PUBLIC_HP_RATIO: 0.22487126666354648,
      PUBLIC_RECIPIENT_NEED_MATCH: 0.003970228698245883, PUBLIC_RESOURCE_RATIO: 0.24281348191416682,
      RELATION_TARGET_COUNT: 0.4659401719641251, RELATION_TARGET_SIDE: 1,
      RESOURCE_CONSUMER_FIT: 1, RESOURCE_DEFICIT_COVERAGE: 1, RESOURCE_DELTA: 1,
      RESOURCE_DELTA_PERCENT: 4.10187179269935, REVEAL_STRENGTH: 1,
      SETTLEMENT_MODIFIER_PERCENT: 3.714836124201342, SHIELD_DELTA: 1,
      STATE_DELTA_PERCENT: 5.286365740907786, STATE_DURATION: 0.20535747123189627,
      STATE_PRESENCE: 1, SUCCESS_PROBABILITY: 0.09415521560514117, SUMMON_COUNT: 1,
      SUMMON_DURATION: 1, SUMMON_STRENGTH: 1, TEAM_EFFECT_MARGINAL_GAIN: 1,
      TEAM_EFFECT_REDUNDANCY_RATIO: 1, TEAM_FOLLOWUP_COVERAGE: 1,
    }),
    missingMask: Object.freeze(['HARD_EXCLUSION', 'HARD_EXCLUSION_REASON']),
  });

  const LINEAR = Object.freeze({
    intercept: 0,
    coefficients: Object.freeze({
      ATTRIBUTE_DELTA: 0, COST_AFFORDABILITY: 0, DAMAGE_PENETRATION: 0.27101009737338333,
      DAMAGE_POWER: 0.9005159950810252, DAMAGE_SEGMENTS: -0.10897479287395434, DAMAGE_TYPE: 0,
      JUDGMENT_DELTA: -0.1589984264724439, OUTSIDE_BATCH1_ROW_COUNT: -1.1292992745534087,
      OVERKILL_AVAILABILITY: 0, PUBLIC_HP_RATIO: -0.19953006499152975,
      PUBLIC_RECIPIENT_NEED_MATCH: 0.45252268447270233, PUBLIC_RESOURCE_RATIO: -1.2035997079030496,
      RELATION_TARGET_COUNT: 0.799682677937762, RELATION_TARGET_SIDE: 0,
      RESOURCE_CONSUMER_FIT: 0, RESOURCE_DEFICIT_COVERAGE: 0, RESOURCE_DELTA: 0,
      RESOURCE_DELTA_PERCENT: -0.3984230873845778, REVEAL_STRENGTH: 0,
      SETTLEMENT_MODIFIER_PERCENT: -0.029061184033559898, SHIELD_DELTA: 0,
      STATE_DELTA_PERCENT: 0.18441615865944933, STATE_DURATION: 0.0019588051160184944,
      STATE_PRESENCE: 0, SUCCESS_PROBABILITY: 0.8567163732632611, SUMMON_COUNT: 0,
      SUMMON_DURATION: 0, SUMMON_STRENGTH: 0, TEAM_EFFECT_MARGINAL_GAIN: 0,
      TEAM_EFFECT_REDUNDANCY_RATIO: 0, TEAM_FOLLOWUP_COVERAGE: 0,
    }),
  });

  // R4B1 constrained head. These constants are embedded for runtime binding;
  // the Provider never reads the offline artifact.
  const REACTION_CODES = Object.freeze([
    'REACTION_DAMAGE_MULTIPLIER', 'REACTION_DODGE_PROBABILITY',
  ]);
  const SCOREABLE_INVENTORY = Object.freeze(SCOREABLE_CODES.concat(REACTION_CODES));
  const REACTION_NORMALIZATION = Object.freeze({
    means: Object.freeze({
      REACTION_DAMAGE_MULTIPLIER: 0.820427777816285,
      REACTION_DODGE_PROBABILITY: 0.1576148028913787,
    }),
    scales: Object.freeze({
      REACTION_DAMAGE_MULTIPLIER: 0.2541751975645827,
      REACTION_DODGE_PROBABILITY: 0.2268679023040783,
    }),
  });
  const REACTION_LINEAR = Object.freeze({
    k: 2.4687377286545256,
    intercept: 0,
    coefficients: Object.freeze({
      REACTION_DAMAGE_MULTIPLIER: -0.6274918999159032,
      REACTION_DODGE_PROBABILITY: 0.5600773498387871,
    }),
  });
  const REACTION_MISSING_POLICY = deepFreeze({
    REACTION_DAMAGE_MULTIPLIER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
    REACTION_DODGE_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', na: 'REQUIRE_KNOWN' },
  });
  const SCOREABLE_MISSING_POLICY = deepFreeze({ ...MISSING_POLICY, ...REACTION_MISSING_POLICY });

  const metrics = { selectCalls: 0, fatalCount: 0, lastWorkUnits: 0, totalWorkUnits: 0 };

  function fail(code, detail) {
    const error = new Error(detail || code);
    error.code = code;
    throw error;
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
      return out;
    }
    return value;
  }
  function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }
  function sha256Utf8(value) {
    const cryptoApi = root && root.crypto;
    if (cryptoApi && typeof cryptoApi.createHash === 'function') {
      return cryptoApi.createHash('sha256').update(Buffer.from(String(value), 'utf8')).digest('hex');
    }
    fail('CANONICAL_HASH_UNAVAILABLE');
  }
  function canonicalHash(value) { return sha256Utf8(canonicalJson(value)); }
  function compareUtf16(a, b) { return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }

  const DAMAGE_AGGREGATION_CODES = new Set(['DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_TYPE']);
  function aggregationRowsOf(rows, code) {
    const seen = new Set();
    const prepared = rows.map((row, index) => {
      const refs = row && row.sourceFactIds;
      const ref = Array.isArray(refs) && refs.length === 1 ? refs[0] : null;
      const split = typeof ref === 'string' ? ref.lastIndexOf('::') : -1;
      const sourceEffectId = split > 0 ? ref.slice(0, split) : '';
      const key = split >= 0 ? ref.slice(split + 2) : null;
      if (!/^[^\u0000-\u001f\u007f]{1,512}$/.test(sourceEffectId) || typeof key !== 'string' || key.length > 512 || /[\u0000-\u001f\u007f]/.test(key)) {
        fail('AGGREGATION_MISSING_EFFECT_ID', code + ':' + index);
      }
      if (typeof row.value !== 'number' || !Number.isFinite(row.value)) fail('AGGREGATION_NON_FINITE_VALUE', code + ':' + index);
      if (seen.has(sourceEffectId)) fail('AGGREGATION_DUPLICATE_SOURCE_EFFECT', code + ':' + sourceEffectId);
      seen.add(sourceEffectId);
      const value = Object.is(row.value, -0) ? 0 : row.value;
      if (code === 'DAMAGE_SEGMENTS' && !Number.isSafeInteger(value)) fail('AGGREGATION_INVALID_SEGMENT_DOMAIN', code + ':' + value);
      if (code === 'DAMAGE_TYPE' && value !== 0 && value !== 1) fail('AGGREGATION_INVALID_TYPE_DOMAIN', code + ':' + value);
      return { sourceEffectId, value };
    });
    prepared.sort((left, right) => compareUtf16(left.sourceEffectId, right.sourceEffectId));
    return prepared;
  }
  function neumaierSum(values) {
    let sum = 0;
    let correction = 0;
    for (const value of values) {
      const next = sum + value;
      correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum;
      sum = next;
    }
    const result = sum + correction;
    if (!Number.isFinite(result)) fail('AGGREGATION_NON_FINITE_RESULT');
    return Object.is(result, -0) ? 0 : result;
  }

  // Per-candidate 35-code scalarization, isomorphic to the trainer's
  // scalarizeCode (single-instance identity; duplicate rows via frozen perCode
  // SUM/MAX; ENUM identity; missing rows become UNKNOWN:NOT_EMITTED).
  function scalarizeCode(doc, code, aggregation) {
    const sourceRows = RELATIONAL_CODES.indexOf(code) >= 0
      ? (doc.document.relational.features || []).filter(f => f.featureCode === code)
      : (doc.document.immediate.features || []).filter(f => f.featureCode === code);
    if (sourceRows.length === 0) return { status: 'UNKNOWN', value: null, reasonCode: 'NOT_EMITTED', rowCount: 0, kind: 'NONE' };
    const knownRows = sourceRows.filter(r => r.status === 'KNOWN');
    if (knownRows.length > 0) {
      if (ENUM_CODES.has(code)) {
        if (typeof knownRows[0].value !== 'string') fail('ENUM_EXPECTS_STRING_VALUE', code + ':' + String(knownRows[0].value));
        const allSame = knownRows.every(r => String(r.value) === String(knownRows[0].value));
        if (!allSame) fail('ENUM_VALUE_MIXED_WITHIN_CANDIDATE_NO_FIRST', code + ':' + knownRows.map(r => r.value).join(','));
        return { status: 'KNOWN', value: String(knownRows[0].value), reasonCode: 'OK', rowCount: knownRows.length, kind: 'ENUM' };
      }
      const aggregationRows = DAMAGE_AGGREGATION_CODES.has(code) ? aggregationRowsOf(knownRows, code) : null;
      const numeric = aggregationRows ? aggregationRows.map(row => row.value) : knownRows.map(r => Number(r.value)).filter(Number.isFinite);
      if (numeric.length !== knownRows.length) fail('NON_NUMERIC_KNOWN_VALUE', code + ':' + knownRows.map(r => String(r.value)).join(','));
      let value;
      if (knownRows.length === 1) {
        value = numeric[0];
      } else {
        const op = aggregation && aggregation[code];
        if (!op) fail('AGGREGATION_MISSING_IN_CONTRACT', code + ':rows=' + knownRows.length);
        if (op === 'MAX') value = Math.max(...numeric);
        else if (op === 'SUM') value = numeric.reduce((sum, v) => sum + v, 0);
        else if (op === OP_DAMAGE_POWER) value = neumaierSum(aggregationRows.map(row => row.value));
        else if (op === OP_DAMAGE_SEGMENTS) {
          value = numeric.reduce((sum, v) => {
            const next = sum + v;
            if (!Number.isSafeInteger(next)) fail('AGGREGATION_NON_FINITE_RESULT', code + ':' + next);
            return next;
          }, 0);
        }
        else fail('AGGREGATION_OPERATOR_UNKNOWN_OR_NOT_ADJUDICATED', code + ':' + op);
      }
      if (Object.is(value, -0)) value = 0;
      return { status: 'KNOWN', value, reasonCode: 'OK', rowCount: knownRows.length, kind: 'NUMERIC' };
    }
    const na = sourceRows.find(r => r.status === 'NOT_APPLICABLE');
    if (na) return { status: 'NOT_APPLICABLE', value: null, reasonCode: na.reasonCode || 'NA', rowCount: 1, kind: 'NONE' };
    const unk = sourceRows.find(r => r.status === 'UNKNOWN');
    if (unk) return { status: 'UNKNOWN', value: null, reasonCode: unk.reasonCode || 'UNKNOWN', rowCount: 1, kind: 'NONE' };
    return { status: 'UNKNOWN', value: null, reasonCode: sourceRows[0].reasonCode || 'UNKNOWN', rowCount: sourceRows.length, kind: 'NONE' };
  }

  function assertScorable(cells) {
    for (const code of SCOREABLE_CODES) {
      const cell = cells[code];
      if (!cell || cell.status === 'KNOWN') continue;
      const policy = MISSING_POLICY[code];
      if (cell.status === 'NOT_APPLICABLE') {
        if (policy.na === 'REQUIRE_KNOWN') fail('NOT_SCORABLE_INPUT', code + ':NA:' + cell.reasonCode);
      } else if (policy.unknown === 'REQUIRE_KNOWN') {
        fail('NOT_SCORABLE_INPUT', code + ':' + cell.reasonCode);
      }
    }
    for (const code of REACTION_CODES) {
      const cell = cells[code];
      if (!cell || cell.status === 'KNOWN') continue;
      const policy = REACTION_MISSING_POLICY[code];
      if (cell.status === 'NOT_APPLICABLE') {
        if (policy.na === 'REQUIRE_KNOWN') fail('NOT_SCORABLE_INPUT', code + ':NA:' + cell.reasonCode);
      } else if (policy.unknown === 'REQUIRE_KNOWN') {
        fail('NOT_SCORABLE_INPUT', code + ':' + cell.reasonCode);
      }
    }
  }

  function zOf(cells, code) {
    const cell = cells[code];
    const policy = MISSING_POLICY[code];
    const scale = NORMALIZATION.scales[code];
    const mean = NORMALIZATION.means[code];
    if (cell.status === 'KNOWN') {
      if (ENUM_CODES.has(code)) return 0;
      return (cell.value - mean) / scale;
    }
    if (cell.status === 'NOT_APPLICABLE') {
      if (policy.na === 'NOT_APPLICABLE_TO_SEMANTIC_ZERO') {
        if ((policy.zeroReasons || []).indexOf(cell.reasonCode) >= 0) return (0 - mean) / scale;
        return 0;
      }
      return 0;
    }
    return 0;
  }

  function contributionOf(cells, code) {
    const z = zOf(cells, code);
    const coefficient = LINEAR.coefficients[code];
    return {
      code, raw: cells[code].value, mean: NORMALIZATION.means[code], scale: NORMALIZATION.scales[code],
      z, coefficient, contribution: coefficient * z, status: cells[code].status,
      reasonCode: cells[code].reasonCode, rowCount: cells[code].rowCount,
    };
  }

  function reactionZOf(cells, code) {
    const cell = cells[code];
    if (cell.status === 'KNOWN') {
      if (typeof cell.value !== 'number' || !Number.isFinite(cell.value)) fail('NON_FINITE_REACTION_VALUE', code);
      return (cell.value - REACTION_NORMALIZATION.means[code]) / REACTION_NORMALIZATION.scales[code];
    }
    return 0;
  }

  function reactionContributionOf(cells, code) {
    const cell = cells[code];
    const z = reactionZOf(cells, code);
    const factor = {
      code,
      mean: REACTION_NORMALIZATION.means[code],
      scale: REACTION_NORMALIZATION.scales[code],
      z,
      coefficient: REACTION_LINEAR.coefficients[code],
      contribution: REACTION_LINEAR.coefficients[code] * z,
      status: cell.status,
      reasonCode: cell.reasonCode,
      rowCount: cell.rowCount,
    };
    if (cell.status === 'KNOWN') factor.raw = cell.value;
    return factor;
  }

  function baseScoreOf(cells) {
    let score = LINEAR.intercept;
    for (const code of SCOREABLE_CODES) score += LINEAR.coefficients[code] * zOf(cells, code);
    return score;
  }

  function reactionScoreOf(cells) {
    let score = REACTION_LINEAR.intercept;
    for (const code of REACTION_CODES) score += REACTION_LINEAR.coefficients[code] * reactionZOf(cells, code);
    return score;
  }

  // Exclusion-surface reader (closed 10-code set). HARD_EXCLUSION is a BOOL
  // row and HARD_EXCLUSION_REASON an ENUM row; they are read verbatim for the
  // exclusion judgement only and never scalarized into the 31-code cells.
  function readExclusion(doc) {
    const features = doc && doc.document && doc.document.immediate && Array.isArray(doc.document.immediate.features) ? doc.document.immediate.features : [];
    const hardRow = features.find(f => f && f.featureCode === 'HARD_EXCLUSION');
    const reasonRow = features.find(f => f && f.featureCode === 'HARD_EXCLUSION_REASON');
    const hard = !!(hardRow && hardRow.status === 'KNOWN' && Number(hardRow.value) === 1);
    const reason = reasonRow && reasonRow.status === 'KNOWN' ? String(reasonRow.value).trim() : '';
    return { hard, reason };
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------
  function selectPreparedRequest(input) {
    metrics.selectCalls += 1;
    const request = input && input.request ? input.request : {};
    const featureInputs = input && input.featureInputs;
    const frozenCandidates = Array.isArray(request.frozenCandidates) ? request.frozenCandidates : [];
    if (!frozenCandidates.length) fail('NO_LEGAL_CANDIDATES', 'frozenCandidates empty');
    const work = { candidates: frozenCandidates.length, scalarizeCalls: 0, sortComparisons: 0, reasonFactors: 0, documentBuilds: 0 };
    const candidateIds = frozenCandidates.map(candidate => String(candidate.candidateId || '').trim());
    if (candidateIds.some(id => !id) || new Set(candidateIds).size !== candidateIds.length) {
      fail('CANDIDATE_ID_UNIQUE', 'frozen candidates must be unique non-empty ids');
    }
    if (featureInputs === undefined || featureInputs === null) {
      fail('FEATURE_INPUTS_REQUIRED', 'featureInputs required');
    }
    if (!Array.isArray(featureInputs)) fail('FEATURE_INPUTS_SHAPE', 'featureInputs must be an array');
    const documents = featureInputs;
    work.documentBuilds = 0;
    const docByCandidate = new Map(documents.map(doc => [String(doc && doc.candidateId || '').trim(), doc]));
    if (docByCandidate.size !== candidateIds.length || candidateIds.some(id => !docByCandidate.has(id))) {
      fail('CANDIDATE_SET_CONSERVATION', 'featureInputs must cover frozenCandidates exactly, no re-enumeration');
    }
    const rows = [];
    const featureVector = [];
    const hardExclusionAudit = [];
    for (const candidateId of candidateIds) {
      const doc = docByCandidate.get(candidateId);
      const cells = {};
      for (const code of SCOREABLE_INVENTORY) {
        cells[code] = scalarizeCode(doc, code, AGGREGATION);
        work.scalarizeCalls += 1;
      }
      const exclusion = readExclusion(doc);
      const hardExcluded = exclusion.hard;
      work.exclusionRows = (work.exclusionRows || 0) + 2;
      let reasonCode = null;
      if (hardExcluded) {
        reasonCode = exclusion.reason;
        if (HARD_EXCLUSION_CODES.indexOf(reasonCode) < 0) fail('HARD_EXCLUSION_CODE_UNKNOWN', reasonCode);
        hardExclusionAudit.push({ candidateId, disposition: 'HARD_EXCLUDED_PREVIEW_SKIPPED', reasonCode, source: 'BIF_IMMEDIATE_PUBLIC' });
      }
      const row = { candidateId, cells, hardExcluded, eligible: !hardExcluded, baseScore: null, extensionScore: null, score: null };
      featureVector.push({
        candidateId,
        cells,
        hardExclusion: { hard: hardExcluded, reason: reasonCode },
      });
      if (!hardExcluded) {
        assertScorable(cells);
        row.baseScore = baseScoreOf(cells);
        row.extensionScore = reactionScoreOf(cells);
        row.score = row.baseScore + row.extensionScore;
        if (!Number.isFinite(row.score)) fail('NON_FINITE_SCORE');
      }
      rows.push(row);
    }
    const eligible = rows.filter(row => row.eligible);
    if (!eligible.length) fail('NO_ELIGIBLE_CANDIDATES');
    const ranked = eligible.slice().sort((a, b) => {
      work.sortComparisons += 1;
      return a.score !== b.score ? b.score - a.score : compareUtf16(a.candidateId, b.candidateId);
    });
    const selected = ranked[0];
    const selectedDeclaration = (frozenCandidates.find(c => c.candidateId === selected.candidateId) || {}).declaration || null;
    const alternative = selectAlternative(ranked, selected, frozenCandidates);
    const rankedSummary = ranked.map(row => ({
      candidateId: row.candidateId,
      score: row.score,
      baseScore: row.baseScore,
      extensionScore: row.extensionScore,
      tieGroup: ranked.filter(other => other.score === row.score).map(other => other.candidateId).sort(compareUtf16),
    }));
    const scoreContributions = {};
    for (const row of eligible) {
      const factors = [];
      for (const code of SCOREABLE_INVENTORY) {
        factors.push(REACTION_CODES.indexOf(code) >= 0 ? reactionContributionOf(row.cells, code) : contributionOf(row.cells, code));
        work.reasonFactors += 1;
      }
      scoreContributions[row.candidateId] = { score: row.score, baseScore: row.baseScore, extensionScore: row.extensionScore, factors };
    }
    metrics.lastWorkUnits = work.candidates * SCOREABLE_INVENTORY.length + work.scalarizeCalls;
    metrics.totalWorkUnits += metrics.lastWorkUnits;
    const result = {
      providerId: PROVIDER_ID,
      engine: ENGINE,
      schemaVersion: SCHEMA_VERSION,
      requestHash: String(request.requestHash || '').trim(),
      featureInputHash: canonicalHash(featureVector),
      selected: {
        candidateId: selected.candidateId,
        declaration: selectedDeclaration,
        playerLocked: false,
        selectionMode: 'R9V2_LINEAR',
      },
      ranked: rankedSummary,
      rankedCandidateIds: ranked.map(row => row.candidateId),
      hardExclusionAudit,
      hardExcludedCount: hardExclusionAudit.length,
      eligibleCount: eligible.length,
      candidateCount: rows.length,
      scoreContributions,
      alternative,
      workMetrics: {
        candidateCount: work.candidates,
        scalarizeCalls: work.scalarizeCalls,
        scalarizePerCandidate: work.candidates ? work.scalarizeCalls / work.candidates : 0,
        expectedCBy31: work.candidates * SCOREABLE_CODES.length,
        expectedCBy33: work.candidates * SCOREABLE_INVENTORY.length,
        sortComparisons: work.sortComparisons,
        reasonFactorCount: work.reasonFactors,
        documentBuilds: work.documentBuilds,
      },
    };
    result.providerResultHash = canonicalHash(result);
    return deepFreeze(result);
  }

  function selectAlternative(ranked, selected, frozenCandidates) {
    const selectedDeclaration = (frozenCandidates.find(c => c.candidateId === selected.candidateId) || {}).declaration || {};
    const keyOf = declaration => {
      const d = declaration || {};
      return {
        actionId: String(d.actionId || '').trim(),
        targetSet: (Array.isArray(d.targetIds) ? d.targetIds : []).map(String).sort(compareUtf16).join('\u0000'),
        paymentMode: String(d.paymentMode || 'FULL').trim(),
      };
    };
    const selectedKey = keyOf(selectedDeclaration);
    for (const row of ranked) {
      if (row.candidateId === selected.candidateId) continue;
      const candidate = frozenCandidates.find(c => c.candidateId === row.candidateId);
      const key = keyOf(candidate && candidate.declaration);
      if (key.actionId !== selectedKey.actionId || key.targetSet !== selectedKey.targetSet || key.paymentMode !== selectedKey.paymentMode) {
        const difference = ['actionId', 'targetSet', 'paymentMode'].filter(field => {
          const a = field === 'targetSet' ? selectedKey.targetSet : selectedKey[field];
          const b = field === 'targetSet' ? key.targetSet : key[field];
          return a !== b;
        });
        return { candidateId: row.candidateId, score: row.score, structuralDifference: difference };
      }
    }
    return { candidateId: null, alternativeReason: 'ALTERNATIVE_NOT_AVAILABLE', structuralDifference: [] };
  }

  function deepFreeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  }

  const readMetrics = () => Object.freeze({ ...metrics });
  const api = Object.freeze({
    providerId: PROVIDER_ID,
    engine: ENGINE,
    schemaVersion: SCHEMA_VERSION,
    modelHash: MODEL_HASH,
    weightsHash: WEIGHTS_HASH,
    featureSchemaHash: FEATURE_SCHEMA_HASH,
    dbpRevision: DBP_REVISION,
    dbpContractHash: DBP_CONTRACT_HASH,
    bifContractHash: BIF_CONTRACT_HASH,
    baseSectionHash: BASE_SECTION_HASH,
    reactionHeadHash: REACTION_HEAD_HASH,
    modelCompositeHash: MODEL_COMPOSITE_HASH,
    intercept: LINEAR.intercept,
    constants: Object.freeze({
      scoreableCodes: SCOREABLE_INVENTORY.slice(),
      baseScoreableCodes: SCOREABLE_CODES.slice(),
      reactionCodes: REACTION_CODES.slice(),
      relationalCodes: RELATIONAL_CODES.slice(),
      exclusionOnly: EXCLUSION_ONLY.slice(),
      catalogOnly: CATALOG_ONLY.slice(),
      hardExclusionCodes: HARD_EXCLUSION_CODES.slice(),
      missingPolicy: SCOREABLE_MISSING_POLICY,
      aggregation: AGGREGATION,
      aggregationClosure: AGGREGATION_CLOSURE,
      reaction: Object.freeze({
        k: REACTION_LINEAR.k,
        intercept: REACTION_LINEAR.intercept,
        normalization: REACTION_NORMALIZATION,
        coefficients: REACTION_LINEAR.coefficients,
        algorithmHash: REACTION_ALGORITHM_HASH,
      }),
    }),
    selectPreparedRequest,
    readMetrics,
  });

  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

// ===== contributionTrace (BehaviorContributionTrace_Module.js) =====

// BehaviorContributionTrace_Module.js
// M3/R4B1 contribution trace builder: turns frozen per-candidate Provider
// feature rows plus the accepted LINEAR_SCORE_V1 model into a
// DecisionContributionTraceV1 revision 10 document (score conservation
// <= 1e-12, selection deltas, top positive/negative, missingMask,
// hardExclusions) plus a separate sourceClosure. Pure function; never reads
// teacher/route/future/hidden fields; never writes files.
(function () {
  'use strict';

  var SCHEMA_VERSION = 'DecisionContributionTraceV1';
  var TOLERANCE = 1e-12;
  var MOUNT_NAME = '__LWCS_BEHAVIOR_CONTRIBUTION_TRACE__';

  // Frozen from DecisionContributionTraceV1 revision 10. Trace admits exactly
  // the 32 numeric Provider factors; RELATION_TARGET_SIDE is evidence-only.
  var TACTICAL_CONCEPT = {
    RELATION_TARGET_COUNT: '目标推进',
    RELATION_TARGET_SIDE: '目标推进',
    SUCCESS_PROBABILITY: '风险',
    PUBLIC_HP_RATIO: '生存',
    PUBLIC_RESOURCE_RATIO: '资源',
    COST_AFFORDABILITY: '代价',
    REVEAL_STRENGTH: '信息',
    OVERKILL_AVAILABILITY: '机会',
    HARD_EXCLUSION: '风险',
    HARD_EXCLUSION_REASON: '风险',
    SETTLEMENT_DAMAGE: '风险',
    ROLL_REALIZATION: '风险',
    OUTSIDE_BATCH1_ROW_COUNT: '机会',
    DAMAGE_POWER: '伤害压力',
    DAMAGE_SEGMENTS: '伤害压力',
    DAMAGE_PENETRATION: '伤害压力',
    DAMAGE_TYPE: '伤害压力',
    RESOURCE_DELTA: '资源',
    SHIELD_DELTA: '防御',
    ATTRIBUTE_DELTA: '防御',
    JUDGMENT_DELTA: '风险',
    STATE_PRESENCE: '控制',
    STATE_DURATION: '控制',
    STATE_DELTA_PERCENT: '控制',
    SETTLEMENT_MODIFIER_PERCENT: '风险',
    SUMMON_COUNT: '机会',
    SUMMON_STRENGTH: '机会',
    SUMMON_DURATION: '机会',
    RESOURCE_DELTA_PERCENT: '资源',
    TEAM_EFFECT_MARGINAL_GAIN: '控制',
    TEAM_EFFECT_REDUNDANCY_RATIO: '控制',
    RESOURCE_DEFICIT_COVERAGE: '资源',
    RESOURCE_CONSUMER_FIT: '资源',
    TEAM_FOLLOWUP_COVERAGE: '机会',
    PUBLIC_RECIPIENT_NEED_MATCH: '资源',
    REACTION_DAMAGE_MULTIPLIER: '伤害压力',
    REACTION_DODGE_PROBABILITY: '生存',
  };

  // Fallback unit families; caller rows usually carry their own unitFamily.
  var UNIT_FAMILY = {
    RELATION_TARGET_COUNT: 'COUNT',
    RELATION_TARGET_SIDE: 'ENUM',
    SUCCESS_PROBABILITY: 'PROBABILITY_0_1',
    PUBLIC_HP_RATIO: 'RATIO_0_1',
    PUBLIC_RESOURCE_RATIO: 'RATIO_0_1',
    COST_AFFORDABILITY: 'RATIO_0_1',
    REVEAL_STRENGTH: 'RATIO_0_1',
    OVERKILL_AVAILABILITY: 'BOOL',
    HARD_EXCLUSION: 'BOOL',
    HARD_EXCLUSION_REASON: 'ENUM',
    SETTLEMENT_DAMAGE: 'ABS',
    ROLL_REALIZATION: 'BOOL',
    OUTSIDE_BATCH1_ROW_COUNT: 'COUNT',
    DAMAGE_POWER: 'POWER',
    DAMAGE_SEGMENTS: 'COUNT',
    DAMAGE_PENETRATION: 'PERCENT',
    DAMAGE_TYPE: 'ENUM',
    RESOURCE_DELTA: 'ABS',
    SHIELD_DELTA: 'ABS',
    ATTRIBUTE_DELTA: 'ABS',
    JUDGMENT_DELTA: 'ABS',
    STATE_PRESENCE: 'BOOL',
    STATE_DURATION: 'TURNS',
    STATE_DELTA_PERCENT: 'PERCENT',
    SETTLEMENT_MODIFIER_PERCENT: 'PERCENT',
    SUMMON_COUNT: 'COUNT',
    SUMMON_STRENGTH: 'POWER',
    SUMMON_DURATION: 'TURNS',
    RESOURCE_DELTA_PERCENT: 'PERCENT',
    TEAM_EFFECT_MARGINAL_GAIN: 'RATIO_0_1',
    TEAM_EFFECT_REDUNDANCY_RATIO: 'RATIO_0_1',
    RESOURCE_DEFICIT_COVERAGE: 'RATIO_0_1',
    RESOURCE_CONSUMER_FIT: 'RATIO_0_1',
    TEAM_FOLLOWUP_COVERAGE: 'RATIO_0_1',
    PUBLIC_RECIPIENT_NEED_MATCH: 'RATIO_0_1',
    REACTION_DAMAGE_MULTIPLIER: 'RATIO_0_1',
    REACTION_DODGE_PROBABILITY: 'PROBABILITY_0_1',
  };

  var NUMERIC_CODES = Object.freeze([
    'RELATION_TARGET_COUNT', 'SUCCESS_PROBABILITY', 'PUBLIC_HP_RATIO',
    'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY', 'REVEAL_STRENGTH',
    'OVERKILL_AVAILABILITY', 'OUTSIDE_BATCH1_ROW_COUNT', 'DAMAGE_POWER',
    'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE', 'RESOURCE_DELTA',
    'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'STATE_PRESENCE',
    'STATE_DURATION', 'STATE_DELTA_PERCENT', 'SETTLEMENT_MODIFIER_PERCENT',
    'SUMMON_COUNT', 'SUMMON_STRENGTH', 'SUMMON_DURATION',
    'RESOURCE_DELTA_PERCENT', 'TEAM_EFFECT_MARGINAL_GAIN',
    'TEAM_EFFECT_REDUNDANCY_RATIO', 'RESOURCE_DEFICIT_COVERAGE',
    'RESOURCE_CONSUMER_FIT', 'TEAM_FOLLOWUP_COVERAGE',
    'PUBLIC_RECIPIENT_NEED_MATCH', 'REACTION_DAMAGE_MULTIPLIER',
    'REACTION_DODGE_PROBABILITY',
  ]);
  var NUMERIC_CODE_SET = new Set(NUMERIC_CODES);
  var ENUM_CODES = new Set(['RELATION_TARGET_SIDE']);
  var REACTION_CODES = new Set(['REACTION_DAMAGE_MULTIPLIER', 'REACTION_DODGE_PROBABILITY']);
  var CATALOG_ONLY = new Set(['SETTLEMENT_DAMAGE', 'ROLL_REALIZATION']);
  var EXCLUSION_ONLY = new Set(['HARD_EXCLUSION', 'HARD_EXCLUSION_REASON']);
  var EXCLUDED_INPUT_CODES = new Set([
    'REACTION_COUNTER_WINDOW_OPEN', 'TARGET_CHARGE_ACTIVE', 'TARGET_CHARGE_CAST_TIME',
  ].concat(Array.from(EXCLUSION_ONLY), Array.from(CATALOG_ONLY)));
  // failClosedV1 SOURCE_MISSING scope: KNOWN EFFECT_ROW contributions must be
  // traceable to row facts; candidate-scope (publicSnapshot-derived) rows are
  // exempt.
  var EFFECT_ROW_CODES = new Set([
    'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE',
    'STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT', 'RESOURCE_DELTA',
    'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'SUMMON_COUNT',
    'SUMMON_STRENGTH', 'SUMMON_DURATION', 'SETTLEMENT_MODIFIER_PERCENT',
    'OUTSIDE_BATCH1_ROW_COUNT',
  ]);
  // absence-proven zero exemption: only count rows whose KNOWN 0 value means
  // "the closed input scope was fully enumerated and the thing really does not
  // exist" may skip the SOURCE_MISSING gate. Never generalize to any empty-
  // source KNOWN row; other codes must carry real source refs even when 0.
  var ABSENCE_PROVEN_ZERO_CODES = new Set(['OUTSIDE_BATCH1_ROW_COUNT']);

  // Frozen from DistilledBehaviorPolicyV1 missingPolicyV1.scoreable (rev13).
  var MISSING_POLICY = {
    RELATION_TARGET_COUNT: { unknown: 'REQUIRE_KNOWN', notApplicable: 'REQUIRE_KNOWN' },
    RELATION_TARGET_SIDE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUCCESS_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'UNKNOWN_TO_TRAIN_MEAN' },
    PUBLIC_HP_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    PUBLIC_RESOURCE_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    COST_AFFORDABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'UNKNOWN_TO_TRAIN_MEAN' },
    REVEAL_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    OVERKILL_AVAILABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    OUTSIDE_BATCH1_ROW_COUNT: { unknown: 'REQUIRE_KNOWN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_POWER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_SEGMENTS: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_PENETRATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    DAMAGE_TYPE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SHIELD_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    ATTRIBUTE_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    JUDGMENT_DELTA: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    STATE_PRESENCE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    STATE_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_DURATION'] },
    STATE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SETTLEMENT_MODIFIER_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUMMON_COUNT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUMMON_STRENGTH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    SUMMON_DURATION: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    RESOURCE_DELTA_PERCENT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    TEAM_EFFECT_MARGINAL_GAIN: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    TEAM_EFFECT_REDUNDANCY_RATIO: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_CANDIDATE_TEAM_EFFECT'] },
    RESOURCE_DEFICIT_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_RESOURCE_DEFICIT', 'NO_RESOURCE_SUPPLY'] },
    RESOURCE_CONSUMER_FIT: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_RESOURCE_CONSUMER'] },
    TEAM_FOLLOWUP_COVERAGE: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'NOT_APPLICABLE_TO_SEMANTIC_ZERO', semanticZeroReasons: ['NO_FOLLOW_UP_GRANT'] },
    PUBLIC_RECIPIENT_NEED_MATCH: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    REACTION_DAMAGE_MULTIPLIER: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
    REACTION_DODGE_PROBABILITY: { unknown: 'UNKNOWN_TO_TRAIN_MEAN', notApplicable: 'REQUIRE_KNOWN' },
  };

  var HARD_EXCLUSION_TEXT = {
    ACTOR_DISABLED: '行动者无法行动',
    ACTOR_TERMINAL: '行动者已退场',
    TARGET_EMPTY: '目标为空',
    INVALID_OPTION_VALUE: '选项值不合法',
    MISSING_REQUIRED_FIELD: '缺少必需字段',
    UNKNOWN_STATE: '状态未知',
    UNKNOWN_RULE: '规则未知',
    AMBIGUOUS_TAUNT_TARGET: '嘲讽目标不明确',
    ILLEGAL_TARGET: '目标不合法',
    RESOURCE_INSUFFICIENT: '资源不足',
  };

  function cmpUtf16(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function unique(values) {
    var seen = new Set();
    (Array.isArray(values) ? values : []).forEach(function (v) { if (v !== undefined && v !== null && v !== '') seen.add(String(v)); });
    return Array.from(seen).sort(cmpUtf16);
  }
  function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
  function text(v) { return v === undefined || v === null ? '' : String(v); }

  function recordFactorAudit(audit, code, status, reasonCode, contribution) {
    if (!audit) return;
    audit.factors.push({
      featureCode: code,
      unitFamily: UNIT_FAMILY[code],
      tacticalConcept: TACTICAL_CONCEPT[code],
      status: status,
      reasonCode: text(reasonCode) || 'UNKNOWN',
      contribution: isFiniteNumber(contribution) ? contribution : 0,
    });
  }

  function recordIgnoredCode(audit, code) {
    if (!audit || !code || audit.ignoredCodes.indexOf(code) >= 0) return;
    audit.ignoredCodes.push(code);
  }

  function maskedRow(base, status, audit, code, reasonCode) {
    recordFactorAudit(audit, code, status, reasonCode, 0);
    return { ...base, status: status, missingMasked: true };
  }

  // A row is "real" only when it is an admitted Provider factor (KNOWN or an
  // exact semantic-zero NA). Raw BIF/catalog/exclusion rows never reach this
  // function's output carriers.
  function contributionOf(feature, model, audit) {
    var code = text(feature && feature.featureCode);
    if (ENUM_CODES.has(code)) return null;
    if (!NUMERIC_CODE_SET.has(code)) {
      recordIgnoredCode(audit, code);
      return null;
    }
    var status = text(feature && feature.status).toUpperCase() || 'UNKNOWN';
    if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(status) < 0) {
      throw new Error('TRACE_STATUS_INVALID:' + code + ':' + status);
    }
    var reasonCode = text(feature && feature.reasonCode);
    if (status === 'NOT_APPLICABLE' && REACTION_CODES.has(code)) {
      throw new Error('TRACE_REACTION_NOT_APPLICABLE:' + code + ':' + reasonCode);
    }
    if (status === 'NOT_APPLICABLE' && code === 'PUBLIC_RECIPIENT_NEED_MATCH') {
      throw new Error('TRACE_PROVIDER_REQUIRED_KNOWN:' + code + ':' + reasonCode);
    }
    var unitFamily = UNIT_FAMILY[code];
    var concept = TACTICAL_CONCEPT[code];
    var base = {
      featureId: 'c::' + code,
      featureCode: code,
      unitFamily: unitFamily,
      tacticalConcept: concept,
      sourceFactIds: unique(feature.sourceFactIds),
      sourceEventIds: unique(feature.sourceEventIds),
    };
    var coefficients = model.linear.coefficients || {};
    var means = model.normalization.means || {};
    var scales = model.normalization.scales || {};
    var weight = coefficients[code];
    var mean = means[code];
    var scale = scales[code];
    if (status === 'KNOWN' || status === 'NOT_APPLICABLE') {
      if (!isFiniteNumber(weight)) throw new Error('TRACE_PROVIDER_COEFFICIENT_MISSING:' + code);
      if (!isFiniteNumber(mean) || !isFiniteNumber(scale) || scale <= 0) {
        throw new Error('TRACE_PROVIDER_NORMALIZATION_MISSING:' + code);
      }
    }

    if (status !== 'KNOWN' && status !== 'NOT_APPLICABLE') {
      // UNKNOWN reaction factors retain their Provider status/reason in the
      // returned audit, while the schema-closed row stays masked and numeric-free.
      return maskedRow(base, status, audit, code, reasonCode);
    }
    if (status === 'KNOWN') {
      var value = feature.value;
      if (!isFiniteNumber(value)) return maskedRow(base, 'UNKNOWN', audit, code, reasonCode || 'NON_FINITE_VALUE');
      var normalized = (value - mean) / scale;
      var contribution = weight * normalized;
      if (!isFiniteNumber(normalized) || !isFiniteNumber(contribution)) {
        throw new Error('TRACE_NON_FINITE_CONTRIBUTION:' + code);
      }
      recordFactorAudit(audit, code, 'KNOWN', reasonCode, contribution);
      return {
        ...base,
        status: 'KNOWN',
        missingMasked: false,
        rawValue: value,
        mean: mean,
        scale: scale,
        normalized: normalized,
        weight: weight,
        contribution: contribution,
      };
    }
    var policy = MISSING_POLICY[code] || { semanticZeroReasons: [] };
    if ((policy.semanticZeroReasons || []).indexOf(reasonCode) !== -1) {
      var z = (0 - mean) / scale;
      var semanticContribution = weight * z;
      if (!isFiniteNumber(z) || !isFiniteNumber(semanticContribution)) {
        throw new Error('TRACE_NON_FINITE_SEMANTIC_ZERO:' + code);
      }
      recordFactorAudit(audit, code, 'NOT_APPLICABLE', reasonCode, semanticContribution);
      return {
        ...base,
        featureId: 'sz::' + code + '::' + reasonCode,
        status: 'NOT_APPLICABLE',
        semanticZero: true,
        missingMasked: false,
        mean: mean,
        scale: scale,
        normalized: z,
        weight: weight,
        contribution: semanticContribution,
      };
    }
    return maskedRow(base, 'NOT_APPLICABLE', audit, code, reasonCode);
  }

  function buildCandidateCore(candidateId, features, model, inputScore) {
    var contributions = [];
    var missingMask = [];
    var seenCodes = new Set();
    var factorAudit = { candidateId: candidateId, factors: [], ignoredCodes: [] };
    (Array.isArray(features) ? features : []).forEach(function (feature) {
      var code = text(feature && feature.featureCode);
      if (NUMERIC_CODE_SET.has(code)) {
        if (seenCodes.has(code)) throw new Error('TRACE_DUPLICATE_PROVIDER_FACTOR:' + candidateId + ':' + code);
        seenCodes.add(code);
      }
      var row = contributionOf(feature, model, factorAudit);
      if (!row) return;
      contributions.push(row);
      if (row.missingMasked === true) missingMask.push(row.featureCode);
    });
    contributions.sort(function (a, b) { return cmpUtf16(a.featureCode, b.featureCode); });
    var score = model.linear.intercept;
    contributions.forEach(function (row) {
      if (row.missingMasked !== true) score += row.contribution;
    });
    var conservationError = 0;
    if (isFiniteNumber(inputScore)) conservationError = Math.abs(inputScore - score);
    var topPositive = contributions
      .filter(function (row) { return row.missingMasked !== true && row.contribution > 0; })
      .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution) || cmpUtf16(a.featureCode, b.featureCode); })
      .map(function (row) { return row.featureId; });
    var topNegative = contributions
      .filter(function (row) { return row.missingMasked !== true && row.contribution < 0; })
      .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution) || cmpUtf16(a.featureCode, b.featureCode); })
      .map(function (row) { return row.featureId; });
    return {
      candidateId: candidateId,
      score: inputScore === undefined ? score : inputScore,
      intercept: model.linear.intercept,
      conservationError: conservationError,
      contributions: contributions,
      missingMask: unique(missingMask),
      topPositive: topPositive,
      topNegative: topNegative,
      _computedScore: score,
      _factorAudit: factorAudit,
    };
  }

  function buildPublicEvidence(features) {
    // ENUM public facts (RELATION_TARGET_SIDE) are carried as non-numeric
    // public evidence only: never a contribution row, never missingMask,
    // never scored, never part of deltas or conservation. UNKNOWN status is
    // carried verbatim so the reason layer can stay honest without guessing.
    var out = [];
    var seen = new Set();
    (Array.isArray(features) ? features : []).forEach(function (feature) {
      if (!ENUM_CODES.has(text(feature.featureCode))) return;
      if (seen.has(text(feature.featureCode))) throw new Error('TRACE_DUPLICATE_PUBLIC_EVIDENCE:' + text(feature.featureCode));
      seen.add(text(feature.featureCode));
      var evidenceStatus = statusOf(feature);
      if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(evidenceStatus) < 0) {
        throw new Error('TRACE_PUBLIC_EVIDENCE_STATUS_INVALID:' + evidenceStatus);
      }
      var entry = {
        featureCode: text(feature.featureCode),
        unitFamily: UNIT_FAMILY[feature.featureCode] || 'ENUM',
        status: evidenceStatus,
      };
      if (entry.status === 'KNOWN' && feature.value !== undefined && feature.value !== null) {
        if (['SELF', 'ALLY', 'ENEMY', 'MIXED'].indexOf(String(feature.value)) < 0) {
          throw new Error('TRACE_PUBLIC_EVIDENCE_VALUE_INVALID:' + String(feature.value));
        }
        entry.rawValue = feature.value;
      }
      out.push(entry);
    });
    out.sort(function (a, b) { return cmpUtf16(a.featureCode, b.featureCode); });
    return out;
  }

  function statusOf(row) {
    if (!row) return 'UNKNOWN';
    return text(row.status).toUpperCase() === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : text(row.status).toUpperCase();
  }
  function realContribution(row) {
    if (!row || row.missingMasked === true) return 0;
    return isFiniteNumber(row.contribution) ? row.contribution : 0;
  }
  function rowByCode(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) { if (row) map[row.featureCode] = row; });
    return map;
  }

  function buildSelection(selectedCore, alternativeCore) {
    if (!alternativeCore) {
      return {
        selectedCandidateId: selectedCore.candidateId,
        reason: 'NO_REAL_ALTERNATIVE',
      };
    }
    var selMap = rowByCode(selectedCore.contributions);
    var altMap = rowByCode(alternativeCore.contributions);
    var union = new Set(Object.keys(selMap).concat(Object.keys(altMap)));
    var deltas = [];
    Array.from(union).sort(cmpUtf16).forEach(function (code) {
      var sel = selMap[code];
      var alt = altMap[code];
      var selContrib = realContribution(sel);
      var altContrib = realContribution(alt);
      var zeroByMask = !sel || !alt || sel.missingMasked === true || alt.missingMasked === true;
      deltas.push({
        featureId: (sel || alt).featureId,
        featureCode: code,
        tacticalConcept: (sel || alt).tacticalConcept,
        deltaContribution: selContrib - altContrib,
        zeroByMask: zeroByMask,
        statusOfSelected: statusOf(sel),
        statusOfAlternative: statusOf(alt),
      });
    });
    var scoreDelta = selectedCore._computedScore - alternativeCore._computedScore;
    var deltaSum = deltas.reduce(function (sum, row) { return sum + row.deltaContribution; }, 0);
    if (Math.abs(scoreDelta - deltaSum) > TOLERANCE) {
      throw new Error('CONSERVATION_FAILED:' + selectedCore.candidateId + ':scoreDelta=' + scoreDelta + ':deltaSum=' + deltaSum);
    }
    return {
      selectedCandidateId: selectedCore.candidateId,
      alternativeCandidateId: alternativeCore.candidateId,
      scoreDelta: scoreDelta,
      deltas: deltas,
      topPositive: deltas.filter(function (row) { return row.deltaContribution > 0; })
        .sort(function (a, b) { return Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution) || cmpUtf16(a.featureCode, b.featureCode); })
        .map(function (row) { return row.featureId; }),
      // failClosed/topByDelta rule: topNegative additionally includes
      // masked-loss zero rows (selected side UNKNOWN, alternative KNOWN).
      topNegative: deltas.filter(function (row) {
        return row.deltaContribution < 0
          || (row.deltaContribution === 0 && row.zeroByMask === true
            && row.statusOfSelected === 'UNKNOWN' && row.statusOfAlternative === 'KNOWN');
      })
        .sort(function (a, b) { return Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution) || cmpUtf16(a.featureCode, b.featureCode); })
        .map(function (row) { return row.featureId; }),
      tieBreak: 'DELTA_ABS_DESC_FEATURECODE_UTF16_ASC',
    };
  }

  function buildHardExclusions(audit) {
    var seen = {};
    var out = [];
    (Array.isArray(audit) ? audit : []).forEach(function (entry) {
      var code = text(entry.code);
      if (!code || seen[code]) return;
      seen[code] = true;
      out.push({
        code: code,
        reasonText: text(entry.reasonText) || HARD_EXCLUSION_TEXT[code] || '不合法',
      });
    });
    return out;
  }

  function buildSourceClosure(selectedCore, alternativeCore) {
    var factIds = [];
    var eventIds = [];
    var realRows = (selectedCore.contributions || []).filter(function (row) { return row.missingMasked !== true; });
    if (alternativeCore) {
      realRows = realRows.concat((alternativeCore.contributions || []).filter(function (row) { return row.missingMasked !== true; }));
    }
    realRows.forEach(function (row) {
      factIds = factIds.concat(row.sourceFactIds || []);
      eventIds = eventIds.concat(row.sourceEventIds || []);
    });
    factIds = unique(factIds);
    eventIds = unique(eventIds);
    var complete = realRows.every(function (row) {
      if (!EFFECT_ROW_CODES.has(row.featureCode)) return true; // candidate-scope rows are exempt
      if (ABSENCE_PROVEN_ZERO_CODES.has(row.featureCode) &&
        row.status === 'KNOWN' && row.rawValue === 0) return true;
      return (row.sourceFactIds && row.sourceFactIds.length > 0) || (row.sourceEventIds && row.sourceEventIds.length > 0);
    });
    return {
      status: complete ? 'COMPLETE' : 'PARTIAL',
      fields: ['status', 'factIds', 'eventIds', 'closureHash'],
      factIds: factIds,
      eventIds: eventIds,
      closureHash: '',
    };
  }

  function canonicalString(value) {
    if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalString).join(',') + ']';
    var keys = Object.keys(value).sort(cmpUtf16);
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalString(value[k]); }).join(',') + '}';
  }
  // Dependency-free synchronous SHA-256 (FIPS 180-4) for sourceClosure hashes.
  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var low = str.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          var cp = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i += 1;
        } else out.push(0xef, 0xbf, 0xbd);
      } else if (code >= 0xd800 && code <= 0xdfff) out.push(0xef, 0xbf, 0xbd);
      else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return out;
  }
  function sha256Hex(input) {
    var cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (cryptoApi && typeof cryptoApi.createHash === 'function') {
      return cryptoApi.createHash('sha256').update(String(input), 'utf8').digest('hex');
    }
    var bytes = utf8Bytes(String(input));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var b = 7; b >= 0; b--) bytes.push((bitLen / Math.pow(2, b * 8)) & 0xff);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64);
      for (var t = 0; t < 16; t++) {
        w[t] = ((bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3]) >>> 0;
      }
      for (var tt = 16; tt < 64; tt++) {
        var s0 = rotr(w[tt - 15], 7) ^ rotr(w[tt - 15], 18) ^ (w[tt - 15] >>> 3);
        var s1 = rotr(w[tt - 2], 17) ^ rotr(w[tt - 2], 19) ^ (w[tt - 2] >>> 10);
        w[tt] = (w[tt - 16] + s0 + w[tt - 7] + s1) >>> 0;
      }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & bb) ^ (a & c) ^ (bb & c);
        var temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = bb; bb = a;
        a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + bb) >>> 0; h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var out = '';
    for (var k = 0; k < 8; k++) out += ('00000000' + h[k].toString(16)).slice(-8);
    return out;
  }

  function hashDocument(document) {
    return sha256Hex(canonicalString(document));
  }

  function buildScoreDecomposition(input) {
    if (!input || !input.model || !input.model.linear || !input.model.normalization) {
      throw new Error('TRACE_MODEL_MISSING');
    }
    var selectedId = text(input.selectedCandidateId);
    if (!selectedId) throw new Error('TRACE_SELECTED_MISSING');
    var featuresByCandidate = input.featuresByCandidate || {};
    var selectedFeatures = featuresByCandidate[selectedId] || [];
    var selectedCore = buildCandidateCore(selectedId, selectedFeatures, input.model, input.score);
    var alternativeId = text(input.alternativeCandidateId);
    var alternativeCore = null;
    if (alternativeId) {
      alternativeCore = buildCandidateCore(alternativeId, featuresByCandidate[alternativeId] || [], input.model, undefined);
    }
    var selection = buildSelection(selectedCore, alternativeCore);
    var topContributions = {
      topPositive: selectedCore.topPositive,
      topNegative: selectedCore.topNegative,
      tieBreak: 'CONTRIBUTION_ABS_DESC_FEATURECODE_UTF16_ASC',
      noneOmitted: true,
    };
    var document = {
      schemaVersion: SCHEMA_VERSION,
      candidateId: selectedId,
      score: selectedCore.score,
      intercept: selectedCore.intercept,
      conservationError: selectedCore.conservationError,
      contributions: selectedCore.contributions,
      missingMask: selectedCore.missingMask,
      selection: selection,
      topContributions: topContributions,
      publicEvidence: buildPublicEvidence(selectedFeatures),
    };
    var hardExclusions = buildHardExclusions(input.hardExclusionAudit);
    if (hardExclusions.length) document.hardExclusions = hardExclusions;
    var sourceClosure = buildSourceClosure(selectedCore, alternativeCore);
    if (sourceClosure.factIds.length || sourceClosure.eventIds.length) {
      sourceClosure.closureHash = sha256Hex(canonicalString({ factIds: sourceClosure.factIds, eventIds: sourceClosure.eventIds }));
    }
    return {
      document: document,
      documentHash: hashDocument(document),
      sourceClosure: sourceClosure,
      factorAudit: {
        selected: selectedCore._factorAudit,
        alternative: alternativeCore ? alternativeCore._factorAudit : null,
      },
      _alternativeCore: alternativeCore,
    };
  }

  function assembleDocument(decomposition, player, review) {
    var doc = JSON.parse(JSON.stringify(decomposition));
    if (player) doc.player = player;
    if (review) doc.review = review;
    return doc;
  }

  function auditConservation(decomposition) {
    var errors = [];
    var computed = decomposition.intercept;
    (decomposition.contributions || []).forEach(function (row) {
      if (row.missingMasked !== true) computed += row.contribution;
    });
    if (Math.abs(decomposition.score - computed) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    if (decomposition.selection && decomposition.selection.deltas) {
      var sum = decomposition.selection.deltas.reduce(function (s, row) { return s + row.deltaContribution; }, 0);
      if (Math.abs(decomposition.selection.scoreDelta - sum) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    }
    return { ok: errors.length === 0, errors: errors, computedScore: computed };
  }

  function validateStructure(decomposition) {
    var errors = [];
    if (!decomposition || typeof decomposition !== 'object' || Array.isArray(decomposition)) return ['DOCUMENT_TYPE'];
    if (decomposition.schemaVersion !== SCHEMA_VERSION) errors.push('SCHEMA_VERSION');
    ['candidateId', 'score', 'intercept', 'conservationError', 'contributions', 'missingMask', 'selection', 'topContributions', 'publicEvidence'].forEach(function (key) {
      if (!(key in decomposition)) errors.push('MISSING_FIELD:' + key);
    });
    var topKeys = new Set(['schemaVersion', 'candidateId', 'score', 'intercept', 'conservationError', 'contributions', 'missingMask', 'hardExclusions', 'selection', 'topContributions', 'player', 'review', 'realizedOutcome', 'publicEvidence']);
    Object.keys(decomposition).forEach(function (key) { if (!topKeys.has(key)) errors.push('TOP_LEVEL_CLOSED:' + key); });
    if (!isFiniteNumber(decomposition.score) || !isFiniteNumber(decomposition.intercept) || !isFiniteNumber(decomposition.conservationError) || decomposition.conservationError < 0 || decomposition.conservationError > TOLERANCE) {
      errors.push('SCORE_SHAPE');
    }
    if (!Array.isArray(decomposition.contributions) || decomposition.contributions.length === 0) errors.push('CONTRIBUTIONS_SHAPE');
    var contributionKeys = new Set(['featureId', 'featureCode', 'unitFamily', 'status', 'tacticalConcept', 'missingMasked', 'sourceFactIds', 'sourceEventIds', 'rawValue', 'mean', 'scale', 'normalized', 'weight', 'contribution', 'semanticZero']);
    var seenCodes = new Set();
    (decomposition.contributions || []).forEach(function (row) {
      if (!row.featureCode || !row.featureId || !row.unitFamily || !row.tacticalConcept) errors.push('CONTRIBUTION_FIELD_MISSING:' + row.featureCode);
      if (!NUMERIC_CODE_SET.has(row.featureCode)) errors.push('CONTRIBUTION_CODE_CLOSED:' + row.featureCode);
      if (seenCodes.has(row.featureCode)) errors.push('CONTRIBUTION_DUPLICATE:' + row.featureCode);
      seenCodes.add(row.featureCode);
      if (row.unitFamily !== UNIT_FAMILY[row.featureCode]) errors.push('CONTRIBUTION_UNIT:' + row.featureCode);
      if (row.tacticalConcept !== TACTICAL_CONCEPT[row.featureCode]) errors.push('CONTRIBUTION_CONCEPT:' + row.featureCode);
      if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(row.status) < 0) errors.push('CONTRIBUTION_STATUS:' + row.featureCode);
      if (row.status === 'NOT_APPLICABLE' && (REACTION_CODES.has(row.featureCode) || row.featureCode === 'PUBLIC_RECIPIENT_NEED_MATCH')) errors.push('PROVIDER_REQUIRED_KNOWN:' + row.featureCode);
      if (typeof row.missingMasked !== 'boolean') errors.push('CONTRIBUTION_MASK:' + row.featureCode);
      Object.keys(row).forEach(function (key) { if (!contributionKeys.has(key)) errors.push('CONTRIBUTION_CLOSED:' + row.featureCode + ':' + key); });
      if (!Array.isArray(row.sourceFactIds) || !Array.isArray(row.sourceEventIds)) errors.push('CONTRIBUTION_SOURCE:' + row.featureCode);
      if (row.status === 'KNOWN') {
        ['rawValue', 'mean', 'scale', 'normalized', 'weight', 'contribution'].forEach(function (key) { if (!isFiniteNumber(row[key])) errors.push('KNOWN_NUMERIC:' + row.featureCode + ':' + key); });
        if (row.missingMasked !== false || row.semanticZero === true) errors.push('KNOWN_MASK:' + row.featureCode);
      } else if (row.status === 'NOT_APPLICABLE' && row.semanticZero === true) {
        if (row.missingMasked !== false || row.featureId.indexOf('sz::' + row.featureCode + '::') !== 0) errors.push('SEMANTIC_ZERO_SHAPE:' + row.featureCode);
        if ('rawValue' in row) errors.push('SEMANTIC_ZERO_RAWVALUE:' + row.featureCode);
        ['mean', 'scale', 'normalized', 'weight', 'contribution'].forEach(function (key) { if (!isFiniteNumber(row[key])) errors.push('SEMANTIC_ZERO_NUMERIC:' + row.featureCode + ':' + key); });
      } else {
        if (row.missingMasked !== true) errors.push('MASKED_STATUS:' + row.featureCode);
        ['rawValue', 'mean', 'scale', 'normalized', 'weight', 'contribution', 'semanticZero'].forEach(function (key) { if (key in row) errors.push('MASKED_NUMERIC:' + row.featureCode + ':' + key); });
      }
    });
    if (!Array.isArray(decomposition.missingMask)) errors.push('MISSING_MASK_SHAPE');
    var maskCodes = new Set();
    (decomposition.missingMask || []).forEach(function (code) {
      if (!NUMERIC_CODE_SET.has(code)) errors.push('MISSING_MASK_CODE:' + code);
      if (maskCodes.has(code)) errors.push('MISSING_MASK_DUPLICATE:' + code);
      maskCodes.add(code);
      var row = (decomposition.contributions || []).find(function (item) { return item.featureCode === code; });
      if (!row || row.missingMasked !== true) errors.push('MISSING_MASK_NOT_MASKED:' + code);
    });
    if (!Array.isArray(decomposition.publicEvidence)) errors.push('PUBLIC_EVIDENCE_SHAPE');
    var publicSeen = new Set();
    (decomposition.publicEvidence || []).forEach(function (entry) {
      if (publicSeen.has(entry.featureCode)) errors.push('PUBLIC_EVIDENCE_DUPLICATE:' + entry.featureCode);
      publicSeen.add(entry.featureCode);
      if (entry.featureCode !== 'RELATION_TARGET_SIDE' || entry.unitFamily !== 'ENUM') errors.push('PUBLIC_EVIDENCE_CODE:' + entry.featureCode);
      if (['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'PARTIAL'].indexOf(entry.status) < 0) errors.push('PUBLIC_EVIDENCE_STATUS:' + entry.featureCode);
      if (entry.status === 'KNOWN' && ['SELF', 'ALLY', 'ENEMY', 'MIXED'].indexOf(entry.rawValue) < 0) errors.push('PUBLIC_EVIDENCE_VALUE:' + entry.featureCode);
      if (entry.status !== 'KNOWN' && 'rawValue' in entry) errors.push('PUBLIC_EVIDENCE_MASKED_RAW:' + entry.featureCode);
    });
    var deltaKeys = new Set(['featureId', 'featureCode', 'tacticalConcept', 'deltaContribution', 'zeroByMask', 'statusOfSelected', 'statusOfAlternative']);
    if (decomposition.selection && Array.isArray(decomposition.selection.deltas)) {
      var deltaCodes = new Set();
      decomposition.selection.deltas.forEach(function (delta) {
        Object.keys(delta).forEach(function (key) { if (!deltaKeys.has(key)) errors.push('DELTA_CLOSED:' + key); });
        if (!NUMERIC_CODE_SET.has(delta.featureCode)) errors.push('DELTA_CODE_CLOSED:' + delta.featureCode);
        if (deltaCodes.has(delta.featureCode)) errors.push('DELTA_DUPLICATE:' + delta.featureCode);
        deltaCodes.add(delta.featureCode);
        if (!isFiniteNumber(delta.deltaContribution) || typeof delta.zeroByMask !== 'boolean') errors.push('DELTA_SHAPE:' + delta.featureCode);
        if (delta.tacticalConcept !== TACTICAL_CONCEPT[delta.featureCode]) errors.push('DELTA_CONCEPT:' + delta.featureCode);
      });
    }
    return errors;
  }

  var api = {
    buildScoreDecomposition: buildScoreDecomposition,
    assembleDocument: assembleDocument,
    auditConservation: auditConservation,
    validateStructure: validateStructure,
    hashDocument: hashDocument,
    numericCodes: NUMERIC_CODES.slice(),
    publicEvidenceCodes: ['RELATION_TARGET_SIDE'],
    excludedInputCodes: Array.from(EXCLUDED_INPUT_CODES).sort(cmpUtf16),
    missingPolicy: JSON.parse(JSON.stringify(MISSING_POLICY)),
    tolerance: TOLERANCE,
  };
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

// ===== chineseReason (BehaviorChineseReason_Module.js) =====

// BehaviorChineseReason_Module.js
// M2/Task6 Chinese reason renderer: turns a DecisionContributionTraceV1
// decomposition into 1..8 player-facing Chinese sentences (SITUATION -> FACTS
// -> SUPPORT -> DIFFERENTIATION -> RISK_COST -> CONCLUSION) with traceRefs,
// spoken numbers with units, and a report mapping (selectionReason,
// tradeoffs, alternatives, narrowing, predictedNumbers; futurePoolTradeoffs
// is always empty). UNKNOWN is never spoken as zero; no hidden information,
// no teacher/route/future fields, no post-hoc rationalization.
(function () {
  'use strict';

  var SCHEMA_VERSION = 'DecisionContributionTraceV1';
  var SKELETON = ['SITUATION', 'FACTS', 'SUPPORT', 'DIFFERENTIATION', 'RISK_COST'];
  var MOUNT_NAME = '__LWCS_BEHAVIOR_CHINESE_REASON__';
  var TOLERANCE = 1e-12;

  var FORBIDDEN_TOKENS = [
    'weight', '权重', 'score', '分数', 'featureCode', 'HEPP', 'Pareto', '帕累托',
    'candidateId', 'sourceEffectId', 'seed', 'actualValue', 'normalized', 'mean',
    'scale', 'intercept', 'contribution', 'tacticalConcept', 'alpha', 'lambda',
    'margin', 'frontier', 'band', '线性', '系数', 'z-score', 'zscore', 'rank',
    'coefficient', '依赖键', 'routeKey', 'dependencyKey', '候选编号', '评分',
    '觉得', '想要', '看穿', '预判', '赌一把', '谨慎', '试探', '破绽', '内心',
  ];
  var EFFECT_ROW_CODES = new Set([
    'DAMAGE_POWER', 'DAMAGE_SEGMENTS', 'DAMAGE_PENETRATION', 'DAMAGE_TYPE',
    'STATE_PRESENCE', 'STATE_DURATION', 'STATE_DELTA_PERCENT', 'RESOURCE_DELTA',
    'SHIELD_DELTA', 'ATTRIBUTE_DELTA', 'JUDGMENT_DELTA', 'SUMMON_COUNT',
    'SUMMON_STRENGTH', 'SUMMON_DURATION', 'SETTLEMENT_MODIFIER_PERCENT',
    'OUTSIDE_BATCH1_ROW_COUNT',
  ]);
  // Mirrors BehaviorContributionTrace_Module: only count rows whose KNOWN 0 is
  // an absence proven by full enumeration of the closed input scope may skip
  // SOURCE_MISSING; empty-source KNOWN rows for other codes stay fail-closed.
  var ABSENCE_PROVEN_ZERO_CODES = new Set(['OUTSIDE_BATCH1_ROW_COUNT']);
  var RISK_COST_ALLOW = new Set(['SUCCESS_PROBABILITY', 'COST_AFFORDABILITY', 'RESOURCE_DELTA',
    'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE']);
  var SUPPORT_DENY = new Set(['SUCCESS_PROBABILITY', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE']);
  // R2/R3: observed ratios describe the current public state (target or
  // declaration), not an effect of this hand; they never ground a
  // benefit/advantage claim and keep a neutral subject without KNOWN side.
  var OBSERVED_RATIO_CODES = new Set(['PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'REVEAL_STRENGTH']);

  var RATIO_WORDS = ['零', '半成', '一成', '一成半', '两成', '两成半', '三成', '三成半', '四成', '四成半',
    '五成', '五成半', '六成', '六成半', '七成', '七成半', '八成', '八成半', '九成', '九成半', '满'];
  var CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  function cmpUtf16(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function text(v) { return v === undefined || v === null ? '' : String(v); }
  function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }

  function stableVariant(key, variants) {
    var hash = 2166136261;
    var source = text(key);
    for (var i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0;
    return variants[hash % variants.length];
  }

  function cnInt(n) {
    n = Math.round(n);
    if (!isFiniteNumber(n)) return String(n);
    if (n < 0) return '负' + cnInt(-n);
    if (n < 10) return CN_DIGITS[n];
    if (n < 100) {
      var tens = Math.floor(n / 10);
      var ones = n % 10;
      return (tens === 1 ? '' : CN_DIGITS[tens]) + '十' + (ones === 0 ? '' : CN_DIGITS[ones]);
    }
    if (n < 1000) {
      var h = Math.floor(n / 100);
      var rest = n % 100;
      return CN_DIGITS[h] + '百' + (rest === 0 ? '' : rest < 10 ? '零' + CN_DIGITS[rest] : cnInt(rest));
    }
    return String(n);
  }

  function cnDecimal(v) {
    var rounded = Math.round(v * 10) / 10;
    var whole = Math.floor(Math.abs(rounded));
    var frac = Math.round((Math.abs(rounded) - whole) * 10);
    var prefix = v < 0 ? '负' : '';
    if (frac === 0) return prefix + cnInt(whole);
    return prefix + cnInt(whole) + '点' + CN_DIGITS[frac];
  }

  function spoken(value, unitFamily) {
    if (!isFiniteNumber(value)) return '';
    if (unitFamily === 'RATIO_0_1' || unitFamily === 'PROBABILITY_0_1') {
      var idx = Math.max(0, Math.min(20, Math.round(value * 20)));
      return RATIO_WORDS[idx];
    }
    if (unitFamily === 'PERCENT') {
      var pct = Math.abs(value) <= 1 ? value : value / 100;
      var neg = pct < 0 ? '负' : '';
      var pidx = Math.max(0, Math.min(20, Math.round(Math.abs(pct) * 20)));
      return neg + RATIO_WORDS[pidx];
    }
    if (unitFamily === 'POWER') {
      var powerIndex = Math.max(0, Math.min(20, Math.round(value / 5)));
      return RATIO_WORDS[powerIndex];
    }
    if (unitFamily === 'COUNT') return cnInt(value) + '段';
    if (unitFamily === 'TURNS') return cnInt(value) + '回合';
    if (unitFamily === 'ABS') return cnInt(value) + '点';
    if (unitFamily === 'BOOL') return value ? '有' : '无';
    return cnDecimal(value);
  }

  function unitWords(unitFamily) {
    if (unitFamily === 'RATIO_0_1' || unitFamily === 'PROBABILITY_0_1' || unitFamily === 'PERCENT') return ['成', '半', '满'];
    if (unitFamily === 'POWER') return ['成', '半', '满'];
    if (unitFamily === 'COUNT') return ['段', '次', '个', '点', '层'];
    if (unitFamily === 'TURNS') return ['回合'];
    if (unitFamily === 'ABS') return ['点', '血', '魂力', '资源', '精力'];
    if (unitFamily === 'BOOL') return ['有', '无', '层'];
    return [];
  }

  var CONCEPT_BY_CODE = {
    RELATION_TARGET_COUNT: '目标推进', RELATION_TARGET_SIDE: '目标推进',
    SUCCESS_PROBABILITY: '风险', PUBLIC_HP_RATIO: '生存', PUBLIC_RESOURCE_RATIO: '资源',
    COST_AFFORDABILITY: '代价', REVEAL_STRENGTH: '信息', OVERKILL_AVAILABILITY: '机会',
    HARD_EXCLUSION: '风险', HARD_EXCLUSION_REASON: '风险', SETTLEMENT_DAMAGE: '风险',
    ROLL_REALIZATION: '风险', OUTSIDE_BATCH1_ROW_COUNT: '机会',
    DAMAGE_POWER: '伤害压力', DAMAGE_SEGMENTS: '伤害压力', DAMAGE_PENETRATION: '伤害压力',
    DAMAGE_TYPE: '伤害压力', RESOURCE_DELTA: '资源', SHIELD_DELTA: '防御',
    ATTRIBUTE_DELTA: '防御', JUDGMENT_DELTA: '风险', STATE_PRESENCE: '控制',
    STATE_DURATION: '控制', STATE_DELTA_PERCENT: '控制', SETTLEMENT_MODIFIER_PERCENT: '风险',
    SUMMON_COUNT: '机会', SUMMON_STRENGTH: '机会', SUMMON_DURATION: '机会',
    RESOURCE_DELTA_PERCENT: '资源', TEAM_EFFECT_MARGINAL_GAIN: '控制',
    TEAM_EFFECT_REDUNDANCY_RATIO: '控制', RESOURCE_DEFICIT_COVERAGE: '资源',
    RESOURCE_CONSUMER_FIT: '资源', TEAM_FOLLOWUP_COVERAGE: '机会',
    PUBLIC_RECIPIENT_NEED_MATCH: '资源',
  };
  var DISPLAY_NAME = {
    SUCCESS_PROBABILITY: '命中把握', DAMAGE_POWER: '威力', DAMAGE_SEGMENTS: '段数',
    DAMAGE_PENETRATION: '穿透', PUBLIC_HP_RATIO: '当前目标血线', PUBLIC_RESOURCE_RATIO: '当前目标资源余量',
    COST_AFFORDABILITY: '消耗承受度', RESOURCE_DELTA: '资源变化', RESOURCE_DELTA_PERCENT: '资源变化比例',
    STATE_DURATION: '控制持续', STATE_PRESENCE: '控制状态', STATE_DELTA_PERCENT: '状态变化',
    JUDGMENT_DELTA: '判定修正', SETTLEMENT_MODIFIER_PERCENT: '结算修正',
    REVEAL_STRENGTH: '暴露强度', OVERKILL_AVAILABILITY: '过量击杀空间',
    SUMMON_COUNT: '召唤数量', SUMMON_STRENGTH: '召唤强度', SUMMON_DURATION: '召唤持续',
    OUTSIDE_BATCH1_ROW_COUNT: '额外行动行数', RELATION_TARGET_COUNT: '可推进目标数',
    RELATION_TARGET_SIDE: '目标方', PUBLIC_RECIPIENT_NEED_MATCH: '恢复匹配度',
    TEAM_EFFECT_MARGINAL_GAIN: '团队边际收益', TEAM_EFFECT_REDUNDANCY_RATIO: '团队效果重叠',
    RESOURCE_DEFICIT_COVERAGE: '资源缺口覆盖', RESOURCE_CONSUMER_FIT: '资源消费匹配',
    TEAM_FOLLOWUP_COVERAGE: '后续跟进覆盖',
    REACTION_DAMAGE_MULTIPLIER: '预计承伤比例', REACTION_DODGE_PROBABILITY: '预计闪避把握',
  };
  var PLAYER_CONCEPT = {
    目标推进: '目标推进', 伤害压力: '伤害', 控制: '控制', 防御: '防御',
    资源: '资源', 代价: '消耗', 风险: '风险', 生存: '生存', 机会: '行动机会', 信息: '公开信息',
  };
  var UNKNOWN_LABEL = {
    SUCCESS_PROBABILITY: '命中把握', COST_AFFORDABILITY: '具体消耗', RESOURCE_DELTA: '资源变化',
    PUBLIC_RESOURCE_RATIO: '目标资源余量', PUBLIC_HP_RATIO: '目标血线',
  };

  function reasonKey(decomposition, context, featureCode, slot) {
    return [context.decisionKey, decomposition.candidateId, context.selectedName,
      context.alternativeName, featureCode, slot].map(text).join('|');
  }

  function conceptReason(concept, key, comparison) {
    if (comparison && !PLAYER_CONCEPT[concept]) return stableVariant(key, [
      '综合现有公开信息，这一手更合适。',
      '相比另一手，当前公开比较更支持这一手。',
      '两者相比，这一步的整体取舍更占优。',
      '这一手在当前公开比较中更占优。',
    ]);
    var label = PLAYER_CONCEPT[concept] || '当前取舍';
    return stableVariant(key, comparison ? [
      '这一手在' + label + '上更合适。',
      '相比另一手，当前公开比较在' + label + '方面更支持这一手。',
      '两者相比，这一步在' + label + '上更占优。',
      '这一手的主要优势体现在' + label + '上。',
    ] : [
      '这一手的主要价值在' + label + '上。',
      '当前公开信息里，这一步的' + label + '收益更突出。',
      '这一手的优势主要体现在' + label + '上。',
      '按当前公开信息，这一步在' + label + '上更合适。',
    ]);
  }

  function unknownReason(featureCode, key, selectedName) {
    var label = UNKNOWN_LABEL[featureCode] || (PLAYER_CONCEPT[CONCEPT_BY_CODE[featureCode]] || '具体情况');
    var action = text(selectedName);
    if (!action || action.length > 36) action = '这一手';
    return stableVariant(key, [
      '当时公开信息不足以判断这一手的' + label + '。',
      action + '的' + label + '，当时还无法确认。',
      '现有公开信息无法确定这一步的' + label + '。',
      '关于' + action + '的' + label + '，当时还没有足够公开信息。',
      '公开信息没有给出足以确定' + label + '的依据。',
      '就当时已知内容而言，这一步的' + label + '仍不确定。',
    ]);
  }

  function rowByCode(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) { if (row && row.featureCode) map[row.featureCode] = row; });
    return map;
  }
  function rowById(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) { if (row && row.featureId) map[row.featureId] = row; });
    return map;
  }

  // R1: a delta row may ground a concrete DIFFERENTIATION only when both
  // sides are KNOWN and the delta is not a mask artifact. UNKNOWN/PARTIAL/
  // NOT_APPLICABLE sides and zeroByMask rows never become a definite
  // selected-vs-alternative advantage claim.
  function isReliableDelta(d) {
    return !!d && d.zeroByMask !== true
      && text(d.statusOfSelected) === "KNOWN"
      && text(d.statusOfAlternative) === "KNOWN"
      && isFiniteNumber(d.deltaContribution);
  }

  // R2/R4b3: RELATION_TARGET_SIDE is carried by the DCT publicEvidence
  // container (non-numeric public evidence), never by contribution rows.
  // SELF/ALLY/ENEMY/MIXED map to honest labels; UNKNOWN/absent stays neutral
  // and is never guessed.
  function sideEvidenceEntry(decomposition) {
    var ev = decomposition && Array.isArray(decomposition.publicEvidence) ? decomposition.publicEvidence : [];
    var row = null;
    ev.forEach(function (e) { if (e && text(e.featureCode) === 'RELATION_TARGET_SIDE') row = e; });
    return row;
  }
  function sidePhrase(row, neutral) {
    if (!row || text(row.status) !== 'KNOWN') return neutral;
    var side = text(row.rawValue).toUpperCase();
    if (side === 'ENEMY') return '对方主力';
    if (side === 'ALLY' || side === 'SELF') return '我方单位';
    if (side === 'MIXED') return '当前目标';
    return neutral;
  }

  function buildPlayerReasons(decomposition, context) {
    if (!decomposition || decomposition.schemaVersion !== SCHEMA_VERSION) throw new Error('REASON_TRACE_VERSION');
    context = context || {};
    var selectedName = text(context.selectedName);
    var alternativeName = text(context.alternativeName);
    var rows = (decomposition.contributions || []).slice();
    var byCode = rowByCode(rows);
    var real = rows.filter(function (row) { return row.missingMasked !== true; });
    var pos = real.filter(function (row) { return row.contribution > 0; })
      .sort(function (a, b) { return b.contribution - a.contribution || cmpUtf16(a.featureCode, b.featureCode); });
    var neg = real.filter(function (row) { return row.contribution < 0; })
      .sort(function (a, b) { return a.contribution - b.contribution || cmpUtf16(a.featureCode, b.featureCode); });
    var masked = rows.filter(function (row) { return row.missingMasked === true; });
    var sentences = [];

    function push(kind, textLine, refs, connective) {
      var s = { kind: kind, text: textLine, traceRefs: refs };
      if (connective) s.connective = connective;
      sentences.push(s);
    }

    // SITUATION: public, observable, decision-time only.
    var sideRow = sideEvidenceEntry(decomposition);
    var hp = byCode.PUBLIC_HP_RATIO;
    if (hp && hp.status === 'KNOWN' && isFiniteNumber(hp.rawValue) && hp.rawValue <= 0.4) {
      var hpPhrase = sidePhrase(sideRow, '当前目标') + '血线只剩';
      push('SITUATION', hpPhrase + spoken(hp.rawValue, 'RATIO_0_1') + '。', ['c::PUBLIC_HP_RATIO']);
    } else if (byCode.PUBLIC_RESOURCE_RATIO && byCode.PUBLIC_RESOURCE_RATIO.status === 'KNOWN'
      && isFiniteNumber(byCode.PUBLIC_RESOURCE_RATIO.rawValue) && byCode.PUBLIC_RESOURCE_RATIO.rawValue <= 0.4) {
      var resourcePhrase = sidePhrase(sideRow, '当前目标') + '资源余量只剩';
      push('SITUATION', resourcePhrase + spoken(byCode.PUBLIC_RESOURCE_RATIO.rawValue, 'RATIO_0_1') + '。', ['c::PUBLIC_RESOURCE_RATIO']);
    }

    // FACTS / SUPPORT: concrete public facts and the main gains of this hand.
    var factsDone = false;
    var supportDone = false;
    for (var i = 0; i < pos.length && !supportDone; i++) {
      var row = pos[i];
      var code = row.featureCode;
      var factLine = '';
      if (code === 'DAMAGE_SEGMENTS' && isFiniteNumber(row.rawValue) && row.rawValue > 1) {
        var pen = byCode.DAMAGE_PENETRATION;
        factLine = '这一手' + spoken(row.rawValue, 'COUNT') + '攻击' + (pen && pen.status === 'KNOWN' && isFiniteNumber(pen.rawValue)
          ? '、每段' + spoken(pen.rawValue, 'PERCENT') + '穿透' : '') + '。';
        push('SUPPORT', factLine, ['c::' + code].concat(pen ? ['c::DAMAGE_PENETRATION'] : []));
        supportDone = true;
      } else if (code === 'DAMAGE_POWER' && isFiniteNumber(row.rawValue)) {
        var power = spoken(row.rawValue, 'POWER');
        var powerLevel = power === '满' ? '满档' : power;
        factLine = stableVariant(reasonKey(decomposition, context, code, 'support'), [
          '这一手的公开威力约为' + powerLevel + '。',
          '按当时公开数据，这一手的威力约为' + powerLevel + '。',
          '这一手的公开威力处在' + powerLevel + '左右。',
          '就当时可见的数据而言，这一手约有' + powerLevel + '的威力。',
        ]);
        push('SUPPORT', factLine, ['c::DAMAGE_POWER']);
        supportDone = true;
      } else if (code === 'STATE_DURATION' && isFiniteNumber(row.rawValue) && row.rawValue > 0) {
        factLine = '这一手能压住对方' + spoken(row.rawValue, 'TURNS') + '。';
        push('SUPPORT', factLine, ['c::STATE_DURATION']);
        supportDone = true;
      } else if (code === 'SUMMON_COUNT' && isFiniteNumber(row.rawValue) && row.rawValue > 0) {
        factLine = '这一手会召出' + cnInt(row.rawValue) + '个召唤物。';
        push('SUPPORT', factLine, ['c::SUMMON_COUNT']);
        supportDone = true;
      } else if (code === 'PUBLIC_RECIPIENT_NEED_MATCH' && isFiniteNumber(row.rawValue) && row.rawValue > 0) {
        factLine = '这一手正好补上目标的恢复缺口。';
        push('SUPPORT', factLine, ['c::PUBLIC_RECIPIENT_NEED_MATCH']);
        supportDone = true;
      }
      if (factLine && !factsDone && i === 0) {
        // First positive fact doubles as the FACTS frame when no situation was emitted.
        factsDone = true;
      }
    }
    if (sentences.length === 0 || sentences.every(function (s) { return s.kind === 'SITUATION'; })) {
      var top = pos.find(function (row) { return !SUPPORT_DENY.has(row.featureCode) && !OBSERVED_RATIO_CODES.has(row.featureCode); }) || null;
      // R3: a KNOWN 0 OUTSIDE_BATCH1_ROW_COUNT is absence evidence, not an
      // opportunity gain; never phrase it as a positive benefit.
      while (top && top.featureCode === 'OUTSIDE_BATCH1_ROW_COUNT'
        && text(top.status) === 'KNOWN' && Number(top.rawValue) === 0) {
        var idx = pos.indexOf(top);
        top = pos.slice(idx + 1).find(function (row) { return !SUPPORT_DENY.has(row.featureCode) && !OBSERVED_RATIO_CODES.has(row.featureCode); }) || null;
      }
      if (top) {
        var concept = CONCEPT_BY_CODE[top.featureCode] || '目标推进';
        push('SUPPORT', conceptReason(concept,
          reasonKey(decomposition, context, top.featureCode, 'support'), false), [top.featureId]);
      }
    }

    // DIFFERENTIATION: concrete selected-vs-alternative advantage only.
    var selection = decomposition.selection || {};
    var deltaRefs = new Set((selection.deltas || []).map(function (d) { return d.featureId; }));
    var scoreDelta = Number(selection.scoreDelta);
    var isTie = !!selection.alternativeCandidateId && isFiniteNumber(scoreDelta)
      && Math.abs(scoreDelta) <= TOLERANCE;
    if (selection.deltas && selection.deltas.length && selection.alternativeCandidateId) {
      // R1: only reliable deltas (both sides KNOWN, not zeroByMask) may ground
      // a definite advantage claim.
      var positiveDelta = (selection.deltas || []).filter(function (d) { return isReliableDelta(d) && d.deltaContribution > 0 && !OBSERVED_RATIO_CODES.has(d.featureCode); })
        .sort(function (a, b) { return b.deltaContribution - a.deltaContribution || cmpUtf16(a.featureCode, b.featureCode); });
      var neutralRef = (selection.deltas || []).length ? 'DELTA:' + selection.deltas[0].featureId : null;
      // R4: a formal tie (scoreDelta ~= 0) is disclosed honestly even when
      // reliable positive deltas exist; a tie never grounds a one-sided
      // "另一手没这么足/这手更划算" edge claim.
      if (isTie) {
        var tieText = stableVariant(reasonKey(decomposition, context, 'FORMAL_TIE', 'comparison'), selectedName ? [
          '公开信息下两手差异不明显，实际选择' + selectedName + '。',
          '按当时公开比较，两手接近，本次选择' + selectedName + '。',
          '两项方案在公开比较中没有拉开差距，实际选择' + selectedName + '。',
          '当时公开信息无法分出明显高下，本次选择' + selectedName + '。',
        ] : [
          '公开信息下两手差异不明显。',
          '按当时公开比较，两手较为接近。',
          '两项方案在公开比较中没有拉开差距。',
          '当时公开信息无法分出明显高下。',
        ]);
        push('DIFFERENTIATION', tieText, neutralRef ? [neutralRef] : []);
      } else if (positiveDelta.length) {
        var dRow = positiveDelta[0];
        var dText = '';
        if (dRow.featureCode === 'DAMAGE_POWER') dText = stableVariant(
          reasonKey(decomposition, context, dRow.featureCode, 'comparison'), [
            '另一手伤害没这么足。',
            '相比另一手，这一步的伤害更占优。',
            '两者相比，这一手的伤害优势更明显。',
            '当前公开的伤害差异更支持这一手。',
          ]);
        else if (dRow.featureCode === 'SUCCESS_PROBABILITY') dText = '另一手要赌命中，这手不用。';
        else if (dRow.featureCode === 'COST_AFFORDABILITY') dText = '另一手消耗更紧。';
        else if (dRow.featureCode === 'STATE_DURATION') dText = '另一手控不了这么久。';
        else if (dRow.featureCode === 'PUBLIC_RECIPIENT_NEED_MATCH') dText = '另一手补不上这个缺口。';
        else dText = conceptReason(CONCEPT_BY_CODE[dRow.featureCode] || '当前取舍',
          reasonKey(decomposition, context, dRow.featureCode, 'comparison'), true);
        push('DIFFERENTIATION', dText, ['DELTA:' + dRow.featureId]);
      } else {
        // R1: no reliable delta and no formal tie; stay neutral, never claim
        // a definite edge from masked/one-sided rows.
        push('DIFFERENTIATION', stableVariant(
          reasonKey(decomposition, context, 'NO_RELIABLE_DELTA', 'comparison'), [
            '公开信息下，两手没有拉开明显差距。',
            '现有公开信息不足以确认两手高下。',
            '就当时已知内容看，两手都没有明确优势。',
            '当前没有足够公开依据判断两手谁更占优。',
          ]), neutralRef ? [neutralRef] : []);
      }
    }

    // RISK_COST: real uncertainty or resource cost; UNKNOWN never becomes zero.
    var riskDone = false;
    var success = byCode.SUCCESS_PROBABILITY;
    if (success && success.status === 'KNOWN' && isFiniteNumber(success.rawValue) && success.rawValue < 0.6) {
      push('RISK_COST', '要赌的是命中，' + spoken(success.rawValue, 'PROBABILITY_0_1') + '把握。', ['c::SUCCESS_PROBABILITY']);
      riskDone = true;
    }
    var resourceDelta = byCode.RESOURCE_DELTA;
    if (!riskDone && resourceDelta && resourceDelta.status === 'KNOWN' && isFiniteNumber(resourceDelta.rawValue) && resourceDelta.rawValue < 0) {
      push('RISK_COST', '代价是' + cnInt(Math.abs(resourceDelta.rawValue)) + '点魂力。', ['c::RESOURCE_DELTA']);
      riskDone = true;
    }
    var affordability = byCode.COST_AFFORDABILITY;
    if (!riskDone && affordability && affordability.status === 'KNOWN' && isFiniteNumber(affordability.rawValue) && affordability.rawValue < 0.5) {
      push('RISK_COST', '这一手消耗不小。', ['c::COST_AFFORDABILITY']);
      riskDone = true;
    }
    var unknownConcept = masked.find(function (row) {
      return row.featureCode !== 'SETTLEMENT_DAMAGE' && row.featureCode !== 'ROLL_REALIZATION'
        && row.featureCode !== 'HARD_EXCLUSION' && row.featureCode !== 'HARD_EXCLUSION_REASON'
        && RISK_COST_ALLOW.has(row.featureCode);
    });
    if (unknownConcept) {
      push('RISK_COST', unknownReason(unknownConcept.featureCode,
        reasonKey(decomposition, context, unknownConcept.featureCode, 'unknown'), selectedName),
        [unknownConcept.featureId], '不过');
    }

    // CONCLUSION: short, concrete, tied to the hand.
    var topConceptRow = pos.find(function (row) { return !OBSERVED_RATIO_CODES.has(row.featureCode); }) || null;
    var topConcept = topConceptRow ? (CONCEPT_BY_CODE[topConceptRow.featureCode] || '') : '';
    var conclusion = '就这手。';
    // R4: a tied decision must not fabricate a tactical edge in the
    // conclusion either; stay with the neutral form.
    if (!isTie && topConcept === '生存') conclusion = '先保他。';
    else if (!isTie && topConcept === '控制') conclusion = '压住这一手。';
    else if (!isTie && topConcept === '资源') conclusion = '把资源喂给这一手。';
    var fallbackRow = pos[0] || real[0] || (decomposition.contributions || [])[0] || null;
    var conclusionRef = fallbackRow ? [fallbackRow.featureId] : [];
    push('CONCLUSION', selectedName ? selectedName + '：' + conclusion : conclusion, conclusionRef);

    if (sentences.length > 8) sentences = sentences.slice(0, 8);
    return { skeleton: SKELETON.slice(), sentences: sentences };
  }

  function auditReason(decomposition, player, review) {
    var errors = [];
    if (!player || !Array.isArray(player.sentences) || player.sentences.length === 0) return { ok: false, errors: ['UNBOUND_SENTENCE'] };
    if (JSON.stringify(player.skeleton) !== JSON.stringify(SKELETON)) errors.push('ORDER_VIOLATION');
    var byId = rowById(decomposition.contributions);
    var deltaIds = new Set((decomposition.selection && decomposition.selection.deltas || []).map(function (d) { return d.featureId; }));
    // R4b3: RELATION_TARGET_SIDE is public evidence only; a contribution row
    // carrying it violates the contract and must fail closed.
    (decomposition.contributions || []).forEach(function (row) {
      if (row && text(row.featureCode) === 'RELATION_TARGET_SIDE') errors.push('ENUM_IN_CONTRIBUTION:' + row.featureCode);
    });
    var orderIndex = { SITUATION: 0, FACTS: 1, SUPPORT: 2, DIFFERENTIATION: 3, RISK_COST: 4, CONCLUSION: 5 };
    var lastIndex = -1;
    player.sentences.forEach(function (s) {
      var refs = Array.isArray(s.traceRefs) ? s.traceRefs : [];
      if (refs.length === 0) errors.push('UNBOUND_SENTENCE');
      refs.forEach(function (ref) {
        var rawRef = text(ref);
        var key = rawRef.replace(/^DELTA:/, '');
        var ok = byId[key] !== undefined || deltaIds.has(key);
        if (!ok && rawRef.indexOf('HARD_EXCLUSION:') === 0) {
          ok = (decomposition.hardExclusions || []).some(function (ex) { return text(ex.code) === rawRef.slice('HARD_EXCLUSION:'.length); });
        }
        if (!ok) errors.push('CAUSAL_CHAIN_BROKEN');
      });
      var joined = text(s.text) + ' ' + text(s.connective);
      FORBIDDEN_TOKENS.forEach(function (token) {
        if (joined.indexOf(token) !== -1) errors.push('FORBIDDEN_TOKEN');
      });
      if (/隐藏|机密|secret/i.test(joined)) errors.push('HIDDEN_INPUT');
      if (/实际结算|结果证明|事后|果然|最后证明/.test(joined)) errors.push('RESULT_BACKWARD_RATIONALIZATION');
      if (/是零|为零|没有影响|没影响|无影响|没有效果|没有变化|没风险/.test(joined)) errors.push('UNKNOWN_AS_ZERO');
      // A number claim is an arabic digit or a Chinese numeral followed by a
      // unit word (成/半/倍/点/段/次/个/层/回合/魂力/血); 这一手/另一手 never counts.
      var numberClaim = /[0-9]/.test(s.text)
        || /[零一二三四五六七八九十两]+(?:成|半|倍|点|段|次|个|层|回合|魂力|血)/.test(s.text);
      if (numberClaim) {
        var hasUnit = false;
        refs.forEach(function (ref) {
          var rawRef = text(ref);
          var row = byId[rawRef.replace(/^DELTA:/, '')];
          if (row && row.unitFamily) {
            var words = unitWords(row.unitFamily);
            if (words.some(function (w) { return s.text.indexOf(w) !== -1; })) hasUnit = true;
          }
        });
        if (!hasUnit) errors.push('NUMBER_WITHOUT_UNIT');
      }
      var kindIndex = orderIndex[s.kind];
      if (kindIndex === undefined) errors.push('ORDER_VIOLATION');
      else if (kindIndex < lastIndex) errors.push('ORDER_VIOLATION');
      else lastIndex = kindIndex;
    });
    var computed = decomposition.intercept;
    (decomposition.contributions || []).forEach(function (row) {
      if (row.missingMasked !== true) computed += row.contribution;
    });
    if (Math.abs(decomposition.score - computed) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    if (decomposition.selection && decomposition.selection.deltas) {
      var sum = decomposition.selection.deltas.reduce(function (s, d) { return s + d.deltaContribution; }, 0);
      if (Math.abs(decomposition.selection.scoreDelta - sum) > TOLERANCE) errors.push('CONSERVATION_FAILED');
    }
    (decomposition.contributions || []).forEach(function (row) {
      if (row.missingMasked !== true && EFFECT_ROW_CODES.has(row.featureCode)
        && !(ABSENCE_PROVEN_ZERO_CODES.has(row.featureCode) &&
          row.status === 'KNOWN' && row.rawValue === 0)
        && !row.sourceFactIds.length && !row.sourceEventIds.length) errors.push('SOURCE_MISSING');
    });
    if (review && review.realizedOutcome) errors.push('RESULT_BACKWARD_RATIONALIZATION');
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)).sort(cmpUtf16) };
  }

  function mapToReport(decomposition, player, context) {
    context = context || {};
    var selectedName = text(context.selectedName);
    var alternativeName = text(context.alternativeName);
    var sentences = player && Array.isArray(player.sentences) ? player.sentences : [];
    var byKind = {};
    sentences.forEach(function (s) { (byKind[s.kind] = byKind[s.kind] || []).push(s.text); });
    var diff = (byKind.DIFFERENTIATION || [])[0] || '';
    var support = (byKind.SUPPORT || [])[0] || '';
    var selectionReason = '选择' + selectedName + (diff ? '；' + diff : support ? '；' + support : '。');
    var objective = [];
    var risk = [];
    var resource = [];
    sentences.forEach(function (s) {
      var refs = Array.isArray(s.traceRefs) ? s.traceRefs : [];
      var concept = '目标推进';
      refs.some(function (ref) {
        var row = (decomposition.contributions || []).find(function (r) { return r.featureId === text(ref).replace(/^DELTA:/, ''); });
        if (row) { concept = row.tacticalConcept; return true; }
        return false;
      });
      if (s.kind === 'DIFFERENTIATION') objective.push(s.text);
      else if (s.kind === 'RISK_COST') {
        if (concept === '资源' || concept === '代价' || concept === '防御') resource.push(s.text);
        else risk.push(s.text);
      } else if (s.kind === 'SUPPORT' || s.kind === 'FACTS') {
        var playerConcept = PLAYER_CONCEPT[concept] || '';
        var genericSupport = /^(?:这一手的主要价值在.+上。|当前公开信息里，这一步的.+收益更突出。|这一手的优势主要体现在.+上。|按当前公开信息，这一步在.+上更合适。)$/.test(s.text);
        if (genericSupport && playerConcept && diff.indexOf(playerConcept) >= 0) return;
        if (concept === '资源' || concept === '代价') resource.push(s.text);
        else objective.push(s.text);
      }
    });
    var predictedNumbers = (decomposition.contributions || [])
      .filter(function (row) { return row.missingMasked !== true && row.status === 'KNOWN' && isFiniteNumber(row.rawValue); })
      .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution) || cmpUtf16(a.featureCode, b.featureCode); })
      .slice(0, 6)
      .map(function (row) {
        // Player-facing tokens expose display names and public values only.
        // Raw sourceFactIds/sourceEventIds stay internal for the DCT source
        // closure audit; no synthetic source id is fabricated here.
        return {
          displayName: DISPLAY_NAME[row.featureCode] || row.featureCode,
          value: row.rawValue,
          unit: row.unitFamily,
          derivationRule: '决策时公开特征',
          tacticalConsequence: row.tacticalConcept,
          operands: [{ name: '公开值', value: row.rawValue, unit: row.unitFamily }],
        };
      });
    var narrowing = [];
    var hardExclusions = Array.isArray(decomposition.hardExclusions) ? decomposition.hardExclusions : [];
    if (hardExclusions.length) {
      narrowing.push({
        stage: '硬排除',
        before: Math.max(0, Number(context.candidateCount || 0)),
        after: Math.max(0, Number(context.candidateCount || 0) - hardExclusions.length),
        droppedReasons: hardExclusions.map(function (ex) { return { reason: ex.reasonText, count: 1 }; }),
      });
    }
    return {
      selectionReason: selectionReason,
      objectiveTradeoffs: Array.from(new Set(objective)),
      riskTradeoffs: Array.from(new Set(risk)),
      resourceTradeoffs: Array.from(new Set(resource)),
      alternatives: alternativeName ? [{ name: alternativeName, status: 'CONSIDERED', reason: diff || '公开信息下取舍相同' }] : [],
      comparisonEvidence: {
        explanation: selectionReason,
        alternativeSummary: diff ? '主要替代项：' + alternativeName : '无主要替代项',
      },
      narrowing: narrowing,
      predictedNumbers: predictedNumbers,
      futurePoolTradeoffs: [],
    };
  }

  var api = {
    buildPlayerReasons: buildPlayerReasons,
    auditReason: auditReason,
    mapToReport: mapToReport,
    skeleton: SKELETON.slice(),
  };
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

// ===== pipeline mount =====
(function (root) {
  'use strict';
  const components = {
    prototypeAdapter: root.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__,
    candidateFeatureBridge: root.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__,
    immediateFeature: root.__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__,
    candidateFeatureSource: root.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__,
    relationalFeature: root.__LWCS_BEHAVIOR_RELATIONAL_FEATURE__,
    candidateImpactEnvelope: root.__LWCS_BEHAVIOR_CANDIDATE_IMPACT_ENVELOPE__,
    linearScoreProvider: root.__LWCS_BEHAVIOR_LINEAR_PROVIDER__,
    contributionTrace: root.__LWCS_BEHAVIOR_CONTRIBUTION_TRACE__,
    chineseReason: root.__LWCS_BEHAVIOR_CHINESE_REASON__,
  };
  for (const [name, component] of Object.entries(components)) {
    if (!component || typeof component !== 'object') throw new Error(`behavior_pipeline_component_missing:${name}`);
    Object.freeze(component);
  }
  const legacyMounts = [
    '__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__',
    '__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__',
    '__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__',
    '__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__',
    '__LWCS_BEHAVIOR_RELATIONAL_FEATURE__',
    '__LWCS_BEHAVIOR_CANDIDATE_IMPACT_ENVELOPE__',
    '__LWCS_BEHAVIOR_LINEAR_PROVIDER__',
    '__LWCS_BEHAVIOR_CONTRIBUTION_TRACE__',
    '__LWCS_BEHAVIOR_CHINESE_REASON__',
  ];
  for (const mount of legacyMounts) {
    if (!Reflect.deleteProperty(root, mount)) throw new Error(`behavior_pipeline_legacy_mount_cleanup_failed:${mount}`);
  }
  root.__LWCS_BEHAVIOR_DECISION_PIPELINE__ = Object.freeze({
    schemaVersion: 'BehaviorDecisionPipelineV1',
    version: '1.0.0',
    ...components,
  });
})(typeof globalThis === 'object' ? globalThis : this);

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
  var FORBIDDEN_CALL_TOKENS = [
    'worldClone(', 'structuredClone(', 'futureRouteEnumeration(', 'futureRouteDerivation(',
    'resultEnumeration(', 'decide(', 'decideNext(', 'runProvider(', 'new Date(',
    'performance.now(', 'Date.now', 'Math.random', 'teacherOutput(', 'factColumns'
  ];

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

  // ---- signed numeric parsing for 数值/带符号数值 ----
  function parseSigned(value) {
    if (typeof value !== 'string') return null;
    var s = value.replace(/\s+/g, '');
    var m = /^[+-]?(\d+(\.\d+)?|\.\d+)(%?)$/.exec(s);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    var sign = 1;
    if (s.charAt(0) === '-') sign = -1;
    return normZero(sign * n);
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
  function isDeferredPrototype(proto) {
    return hasOwn(DEFERRED_PROTOS, proto);
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

  // ---- lift API ----
  function assertDeferredPath(pathId) {
    var parsed = parsePathId(pathId);
    if (!parsed || !deferredSet[pathId]) {
      var err = new Error('PDA_DEFER_OVERRIDE_UNKNOWN_PATH');
      err.code = 'PDA_DEFER_OVERRIDE_UNKNOWN_PATH';
      throw err;
    }
    return parsed;
  }
  function validateLiftProjection(projection) {
    if (!isPlainObject(projection)) return 'LIFT_PROJECTION_INVALID:NOT_OBJECT';
    if (hasOwn(projection, 'factColumns')) return 'LIFT_PROJECTION_INVALID:LEGACY_COLUMN_FIELD_REJECTED';
    var keys = ['directFacts', 'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'unsupportedOutcomeKinds', 'deferCode'];
    for (var i = 0; i < keys.length; i += 1) if (!hasOwn(projection, keys[i])) return 'LIFT_PROJECTION_INVALID:MISSING_' + keys[i].toUpperCase();
    if (!Array.isArray(projection.directFacts) || !Array.isArray(projection.scheduledFacts) || !Array.isArray(projection.unsupportedOutcomeKinds)) return 'LIFT_PROJECTION_INVALID:ARRAY_FIELDS';
    if (!isPlainObject(projection.legalityModifiers) || !isPlainObject(projection.opportunityModifiers)) return 'LIFT_PROJECTION_INVALID:OBJECT_FIELDS';
    if (typeof projection.deferCode !== 'string') return 'LIFT_PROJECTION_INVALID:DEFER_CODE';
    for (var j = 0; j < projection.directFacts.length; j += 1) {
      var verr = validateDirectFactRow(projection.directFacts[j]);
      if (verr) return 'LIFT_PROJECTION_INVALID:ROW_' + verr;
    }
    if (!checkRowUniqueness(projection.directFacts)) return 'LIFT_PROJECTION_INVALID:ROW_UNIQUENESS';
    var nonZero = projection.directFacts.length > 0 ||
      Object.keys(projection.legalityModifiers).length > 0 ||
      Object.keys(projection.opportunityModifiers).length > 0 ||
      projection.scheduledFacts.length > 0;
    if (!nonZero) return 'LIFT_PROJECTION_INVALID:LIFT_PROJECTION_NONZERO_REQUIRED';
    return null;
  }

  function apiSetDeferOverride(pathId, value) {
    assertDeferredPath(pathId);
    if (value === null || value === undefined) {
      if (!PROJECTION_MAP.has(pathId)) {
        var e1 = new Error('PDA_DEFER_LIFT_PROJECTION_REQUIRED');
        e1.code = 'PDA_DEFER_LIFT_PROJECTION_REQUIRED';
        throw e1;
      }
      LIFT_MAP.set(pathId, LIFT_SENTINEL);
      metrics.liftOverrideCount += 1;
      return { ok: true, cleared: false, status: 'SUPPORTED', deferCode: '' };
    }
    if (typeof value !== 'string' || ALLOWED_DEFER_CODES.indexOf(value) < 0) {
      var e2 = new Error('PDA_DEFER_OVERRIDE_INVALID_CODE');
      e2.code = 'PDA_DEFER_OVERRIDE_INVALID_CODE';
      throw e2;
    }
    LIFT_MAP.set(pathId, value);
    metrics.liftOverrideCount += 1;
    return { ok: true, cleared: false, status: 'DEFERRED_EXPLICIT', deferCode: value };
  }
  function apiSetPathProjectionOverride(pathId, projection) {
    assertDeferredPath(pathId);
    if (projection === null || projection === undefined) {
      PROJECTION_MAP.delete(pathId);
      LIFT_MAP.delete(pathId);
      metrics.projectionOverrideCount += 1;
      return { ok: true, cleared: true };
    }
    var verr = validateLiftProjection(projection);
    if (verr) {
      var e = new Error(verr.indexOf('LIFT_PROJECTION_INVALID:') === 0 ? verr : 'PDA_LIFT_PROJECTION_INVALID:' + verr);
      e.code = 'PDA_LIFT_PROJECTION_INVALID';
      throw e;
    }
    PROJECTION_MAP.set(pathId, freezeDeep(cloneDeep(projection)));
    metrics.projectionOverrideCount += 1;
    return { ok: true, cleared: false };
  }
  function apiGetPathProjectionOverride(pathId) {
    assertDeferredPath(pathId);
    return PROJECTION_MAP.has(pathId) ? cloneDeep(PROJECTION_MAP.get(pathId)) : null;
  }
  function apiClearOverride(pathId) {
    assertDeferredPath(pathId);
    LIFT_MAP.delete(pathId);
    PROJECTION_MAP.delete(pathId);
    metrics.clearOverrideCount += 1;
    return { ok: true, restored: true };
  }

  // ---- selfCheck ----
  function codeOnly(src) {
    var out = '';
    var i = 0;
    var n = src.length;
    while (i < n) {
      var ch = src.charAt(i);
      if (ch === '/' && src.charAt(i + 1) === '/') { while (i < n && src.charAt(i) !== '\n') i += 1; continue; }
      if (ch === '/' && src.charAt(i + 1) === '*') { i += 2; while (i < n && !(src.charAt(i) === '*' && src.charAt(i + 1) === '/')) i += 1; i += 2; continue; }
      if (ch === '"' || ch === "'" || ch === '\`') {
        var q = ch;
        i += 1;
        while (i < n) {
          if (src.charAt(i) === '\\') { i += 2; continue; }
          if (src.charAt(i) === q) { i += 1; break; }
          i += 1;
        }
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  }
  function runSelfCheck(sourceText) {
    var sourceSelfCheckable = typeof sourceText === 'string' && sourceText.length > 0;
    var checks = [];
    function add(id, passed, detail) {
      checks.push({ id: id, passed: !!passed, counted: true, detail: detail === undefined ? null : detail });
    }

    // forbiddenCallsAbsent: only counted when real source is provided; never a fake pass.
    var fca = { id: 'forbiddenCallsAbsent', counted: sourceSelfCheckable, passed: false, detail: { sourceScanned: sourceSelfCheckable } };
    if (sourceSelfCheckable) {
      var code = codeOnly(sourceText);
      var hit = null;
      for (var t = 0; t < FORBIDDEN_CALL_TOKENS.length; t += 1) {
        if (code.indexOf(FORBIDDEN_CALL_TOKENS[t]) >= 0) { hit = FORBIDDEN_CALL_TOKENS[t]; break; }
      }
      fca.passed = hit === null;
      fca.detail = { sourceScanned: true, forbiddenTokens: FORBIDDEN_CALL_TOKENS.slice(), hit: hit };
    }
    checks.push(fca);

    var inBattle = 0;
    for (var pi = 0; pi < PROTO_NAMES.length; pi += 1) {
      var pn = PROTO_NAMES[pi];
      if (CONTRACT_ENTRY[pn].status === 'OUT_OF_BATTLE_SCOPE') continue;
      inBattle += inBattlePathCount(pn);
    }
    var oob = 0;
    for (var oi = 0; oi < PROTO_NAMES.length; oi += 1) {
      var on = PROTO_NAMES[oi];
      if (CONTRACT_ENTRY[on].status === 'OUT_OF_BATTLE_SCOPE') oob += inBattlePathCount(on);
    }
    var supported = inBattle - 40;
    add('embeddedPathEnumeration', inBattle === 621 && supported === 581 && oob === 91, { inBattle: inBattle, supported: supported, deferred: 40, outOfBattle: oob, rejected: 0 });

    var reg = buildRegistry();
    add('registryShape', reg.enrollment.contractSupportedPathCount === 581 && reg.implementation.implementationDirectProjection === 243 && reg.implementation.implementationPending === 338 && reg.counts.totalInBattlePathCount === 621 && reg.counts.silentOmissionCount === 0, { counts: reg.counts, implementation: reg.implementation });
    add('deferredPathCatalog', DEFERRED_PATHS.length === 40 && new Set(deferredPathIds).size === 40 && DEFERRED_PATHS.every(function (d) { return d.deferCode === 'DEFER_MECHANICS_PROJECTION' && !!d.pathId && !!d.prototype && !!d.field; }), { count: DEFERRED_PATHS.length });
    add('classifyAllDeferred', deferredPathIds.every(function (pid) { var v = classifyParsed(parsePathId(pid), LIFT_MAP, PROJECTION_MAP); return v.contractStatus === 'DEFERRED_EXPLICIT' && v.deferCode === 'DEFER_MECHANICS_PROJECTION'; }), { count: 40 });
    add('t0t1EveryPathSupported', ['状态转移', '状态交换', '资源锁定', '规则改写', '机制抹消', '机制授予', '资源转移', '炸环', '规则防御'].every(function (p) { return CONTRACT_ENTRY[p].status === 'SUPPORTED' && deferredPathIds.every(function (pid) { return pid.indexOf(':' + p + ':') < 0; }); }), { t0: 166, t1: 41 });
    add('pathExistenceValidation', classifyParsed(parsePathId('PPU1:IN_BATTLE:伤害结算:不存在的字段:0'), LIFT_MAP, PROJECTION_MAP).reasonCode === 'UNKNOWN_PATH_ID' && classifyParsed(parsePathId('PPU1:IN_BATTLE:伤害结算:目标:7'), LIFT_MAP, PROJECTION_MAP).reasonCode === 'UNKNOWN_PATH_ID', { negatives: 2 });

    // Lift probes on a scratch state, then restore live state.
    var liftSnapshot = new Map(LIFT_MAP);
    var projSnapshot = new Map(PROJECTION_MAP);
    LIFT_MAP.clear();
    PROJECTION_MAP.clear();
    var liftOk = true;
    var liftDetail = {};
    var LIFT_PATH = 'PPU1:IN_BATTLE:复制执行:复制类型:0';
    try {
      var threwNoProj = false;
      try { apiSetDeferOverride(LIFT_PATH, null); } catch (e) { threwNoProj = String(e.message).indexOf('PDA_DEFER_LIFT_PROJECTION_REQUIRED') >= 0; }
      liftDetail.withoutProjectionThrows = threwNoProj;
      var zeroProj = { directFacts: [], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
      var threwZero = false;
      try { apiSetPathProjectionOverride(LIFT_PATH, zeroProj); } catch (e) { threwZero = String(e.message).indexOf('LIFT_PROJECTION_NONZERO_REQUIRED') >= 0; }
      liftDetail.zeroProjectionThrows = threwZero;
      var goldProj = {
        directFacts: [makeRow({ sourceActionId: 'selfcheck', sourceActorId: 'actor-s', sourceEffectId: 'selfcheck-lift', targetIds: ['actor-s'] }, 'STATE_DELTA', '命中', 10, 'PERCENT', 0)],
        legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: ''
      };
      apiSetPathProjectionOverride(LIFT_PATH, goldProj);
      apiSetDeferOverride(LIFT_PATH, null);
      var clsLifted = classifyParsed(parsePathId(LIFT_PATH), LIFT_MAP, PROJECTION_MAP);
      liftDetail.liftedStatus = clsLifted.contractStatus;
      liftOk = threwNoProj && threwZero && clsLifted.contractStatus === 'SUPPORTED' && clsLifted.implementationStatus === 'LIFTED_WITH_PROJECTION';
      apiClearOverride(LIFT_PATH);
      var clsRestored = classifyParsed(parsePathId(LIFT_PATH), LIFT_MAP, PROJECTION_MAP);
      liftDetail.restoredStatus = clsRestored.contractStatus;
      liftOk = liftOk && clsRestored.contractStatus === 'DEFERRED_EXPLICIT';
    } finally {
      LIFT_MAP.clear();
      PROJECTION_MAP.clear();
      liftSnapshot.forEach(function (v, k) { LIFT_MAP.set(k, v); });
      projSnapshot.forEach(function (v, k) { PROJECTION_MAP.set(k, v); });
    }
    add('pathLevelLifting', liftOk, liftDetail);
    add('liftRequiresProjection', liftDetail.withoutProjectionThrows === true, liftDetail);
    add('liftProjectionNonZeroRequired', liftDetail.zeroProjectionThrows === true, liftDetail);
    add('noFakeSupportWithoutPathId', classifyParsed(parsePathId('PPU1:IN_BATTLE:复制执行:目标:1'), LIFT_MAP, PROJECTION_MAP).contractStatus === 'DEFERRED_EXPLICIT', { defaultDefer: 'DEFER_MECHANICS_PROJECTION' });
    add('strictSixFields', Object.keys(emptyProjection()).length === 6 && ['directFacts', 'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'unsupportedOutcomeKinds', 'deferCode'].every(function (k) { return hasOwn(emptyProjection(), k); }), { fields: ['directFacts', 'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'unsupportedOutcomeKinds', 'deferCode'] });

    var baseCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'] };
    var damageEff = { 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' };
    var noTaunt = runProject(damageEff, baseCtx, undefined, LIFT_MAP, PROJECTION_MAP);
    var tauntCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'], publicStates: { taunter: { 嘲讽: true } } };
    var tauntLeg = resolveLegality(tauntCtx, { 目标: '单体' }, 'actor-1', ['enemy-1']);
    var tauntProj = runProject(damageEff, tauntCtx, undefined, LIFT_MAP, PROJECTION_MAP);
    var tauntMod = tauntProj.legalityModifiers.taunt;
    add('tauntLegality', tauntLeg.tauntReason === true && tauntMod && tauntMod.target === 'taunter' && tauntProj.directFacts.length === 1 && tauntProj.directFacts[0].targetIds[0] === 'taunter', { legalSet: tauntLeg.legalTargetIds, modifier: tauntMod });
    var hiddenCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'], hiddenExactHp: 999, hiddenResistance: 7 };
    var hiddenProj = runProject(damageEff, hiddenCtx, undefined, LIFT_MAP, PROJECTION_MAP);
    add('hiddenStateIgnored', JSON.stringify(hiddenProj) === JSON.stringify(noTaunt), { hiddenKeysIgnored: true });
    var lockedCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'], publicStates: { taunter: { 嘲讽: true } }, playerLockedTargetId: 'other-enemy' };
    var lockedLeg = resolveLegality(lockedCtx, { 目标: '单体' }, 'actor-1', ['enemy-1']);
    add('playerLockedSameGate', lockedLeg.reject === 'PLAYER_LOCKED_TAUNT_LEGALITY', { reject: lockedLeg.reject });

    var pendingProj = projectDispatched({ 原型: '决策干扰', 目标: '单体', 干扰: '判断干扰', 数值: '+10%' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var deferProj = projectDispatched({ 原型: '复制执行', 目标: '单体', 复制类型: '复制技能' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var damageProj = projectDispatched({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('noSilentZero', pendingProj.unsupportedOutcomeKinds.indexOf(PENDING_KIND) >= 0 && deferProj.deferCode === 'DEFER_MECHANICS_PROJECTION' && damageProj.directFacts.length === 1, { pending: pendingProj.unsupportedOutcomeKinds, deferCode: deferProj.deferCode, damageRows: damageProj.directFacts.length });
    add('pendingNotSilent', pendingProj.unsupportedOutcomeKinds.indexOf(PENDING_KIND) >= 0 && pendingProj.directFacts.length === 0, { kind: PENDING_KIND });
    add('noClaim581Implemented', reg.implementation.claimsDirectProjectionForAllSupported === false && reg.implementation.implementationDirectProjection === 243, { implemented: 243, pending: 338 });
    add('enrollmentImplementationSeparated', !!reg.enrollment && !!reg.implementation && reg.enrollment.contractSupportedPathCount === 581 && reg.implementation.implementationDirectProjection === 243, { enrollment: reg.enrollment.contractSupportedPathCount, implementation: reg.implementation.implementationDirectProjection });
    add('batch2RegistryCounts', reg.implementation.batch2PathCount === 137 && reg.implementation.batch2PathCounts['状态施加'] === 55 && reg.implementation.batch2PathCounts['召唤生成'] === 19 && reg.implementation.batch2PathCounts['结算修正'] === 63 && reg.implementation.contractTargetOnly === true && reg.implementation.implementationTarget.directProjectionPathCount === 243 && reg.implementation.implementationTarget.pendingPathCount === 338 && reg.implementation.pendingPrototypes.length === 13 && reg.implementation.pendingPrototypes.indexOf('状态施加') < 0 && reg.implementation.pendingPrototypes.indexOf('召唤生成') < 0 && reg.implementation.pendingPrototypes.indexOf('结算修正') < 0, { batch2: reg.implementation.batch2PathCounts, pending: reg.implementation.pendingPrototypes.length });

    // DirectFactRowV1 runtime constraint probes.
    var rowOk = validateDirectFactRow(damageProj.directFacts[0]) === null;
    var fakeRow = cloneDeep(damageProj.directFacts[0]);
    fakeRow.factType = 'FAKE_TYPE';
    var fakeRejected = validateDirectFactRow(fakeRow) === 'INVALID_FACT_TYPE';
    var symRow = cloneDeep(damageProj.directFacts[0]);
    symRow.targetIds = ['单体'];
    var symRejected = validateDirectFactRow(symRow) === 'TARGET_IDS_SYMBOLIC_PLACEHOLDER';
    var nanRow = cloneDeep(damageProj.directFacts[0]);
    nanRow.amount = NaN;
    var nanRejected = validateDirectFactRow(nanRow) === 'AMOUNT_NOT_FINITE';
    add('directFactRowsValidateAgainstDirectFactRowV1', rowOk && fakeRejected && symRejected && nanRejected, { gold: rowOk, fakeType: fakeRejected, symbolic: symRejected, nan: nanRejected });
    add('factTypeEnumClosed', FACT_TYPES.length === 11 && fakeRejected, { count: FACT_TYPES.length });
    add('unitEnumClosed', UNITS.length === 8, { count: UNITS.length });
    add('revision4SupersedeDeclared', reg.semantics.revision4SupersedeDeclared === true && reg.semantics.revision5SupersedeDeclared === true && reg.implementation.directFactToProviderColumnMapping === MAPPING_NOT_FROZEN, { supersede: true, mapping: MAPPING_NOT_FROZEN });
    add('targetIdsNoSymbolicPlaceholder', symRejected, { symbolicRejected: true });
    add('multiRowKeyVocabularyFrozen', Object.keys(MULTI_ROW_KEYS).length === 11 && MULTI_ROW_KEYS['settlement.primary'] === 'STATE_DELTA' && MULTI_ROW_KEYS['summon.count'] === 'SUMMON_WINDOW' && MULTI_ROW_KEYS['summon.inheritRatio'] === 'SUMMON_WINDOW', { keys: Object.keys(MULTI_ROW_KEYS) });
    var mvProj = projectDispatched({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 攻击段数: 2, 防御穿透: 20, 伤害类型: '近身攻击' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('rowUniquenessBySourceEffectIdAndKey', checkRowUniqueness(mvProj.directFacts) && mvProj.directFacts.length === 4, { rows: mvProj.directFacts.length });
    add('negativeZeroNormalized', parseSigned('-0%') === 0 && Object.is(parseSigned('-0%'), -0) === false, { normalized: parseSigned('-0%') });
    add('sourceContextRequired', contextError({}) === 'MISSING_SOURCE_CONTEXT' && contextError({ sourceActionId: 'a', sourceActorId: 'a', sourceEffectId: 'a' }) === 'MISSING_TARGET_CONTEXT', { codes: ['MISSING_SOURCE_CONTEXT', 'MISSING_TARGET_CONTEXT'] });
    var directCls1 = classifyParsed(parsePathId('PPU1:IN_BATTLE:伤害结算:目标:1'), LIFT_MAP, PROJECTION_MAP);
    var directCls2 = classifyParsed(parsePathId('PPU1:IN_BATTLE:判定修正:目标:1'), LIFT_MAP, PROJECTION_MAP);
    add('batch1DirectClassificationReachable', directCls1.contractStatus === 'SUPPORTED' && directCls1.implementationStatus === 'DIRECT_PROJECTION' && directCls2.contractStatus === 'SUPPORTED' && directCls2.implementationStatus === 'DIRECT_PROJECTION', { damage: directCls1.implementationStatus, judgment: directCls2.implementationStatus });
    var cloneBase = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['clone-1'] };
    var cloneAdm = runAdmit({ 原型: '资源变化', 目标: '分身', 资源: '魂力', 数值: '+10%' }, cloneBase);
    var clonePrj = runProject({ 原型: '资源变化', 目标: '分身', 资源: '魂力', 数值: '+10%' }, cloneBase, undefined, LIFT_MAP, PROJECTION_MAP);
    var cloneTargets = clonePrj.directFacts.length === 1 ? JSON.stringify(clonePrj.directFacts[0].targetIds) : null;
    var enumRej = runAdmit({ 原型: '伤害结算', 目标: '分身', 威力倍率: 60, 伤害类型: '近身攻击' }, cloneBase);
    add('cloneTargetResolution', cloneAdm.admitted === true && cloneTargets === JSON.stringify(['clone-1']) && clonePrj.directFacts.length === 1 && enumRej.admitted === false && enumRej.reasons.indexOf('INVALID_OPTION_VALUE') >= 0, { admitted: cloneAdm.admitted, targetIds: cloneTargets, enumReject: enumRej.reasons });
    var cloneSetOk = CLONE_TARGET_ALLOWED.length === 4 &&
      ['资源变化', '属性修正', '判定修正', '结算修正'].every(function (p) { return CLONE_TARGET_ALLOWED.indexOf(p) >= 0; }) &&
      CLONE_TARGET_ALLOWED.every(function (p) { return p === '结算修正' || (BATCH1_SPEC[p] && BATCH1_SPEC[p].enums['目标'].indexOf('分身') >= 0); }) &&
      ['伤害结算', '护盾变化'].every(function (p) { return CLONE_TARGET_ALLOWED.indexOf(p) < 0; });
    add('cloneAllowanceSetClosed', cloneSetOk, { allowed: CLONE_TARGET_ALLOWED.slice() });
    var settleCls = classifyParsed(parsePathId('PPU1:IN_BATTLE:结算修正:目标:5'), LIFT_MAP, PROJECTION_MAP);
    var settleAdm = runAdmit({ 原型: '结算修正', 目标: '分身', 结算: '受到伤害', 数值: '-20%' }, cloneBase);
    var settlePrj = runProject({ 原型: '结算修正', 目标: '分身', 结算: '受到伤害', 数值: '-20%' }, cloneBase, undefined, LIFT_MAP, PROJECTION_MAP);
    add('cloneSettlementDirectReachable', settleCls.contractStatus === 'SUPPORTED' && settleCls.implementationStatus === 'DIRECT_PROJECTION' && settleAdm.admitted === true && settleAdm.reasons.indexOf(PENDING_KIND) < 0 && settlePrj.directFacts.length === 1 && settlePrj.directFacts[0].key === 'settlement.primary' && JSON.stringify(settlePrj.directFacts[0].targetIds) === JSON.stringify(['clone-1']) && settlePrj.deferCode === '', { cls: settleCls.implementationStatus, reasons: settleAdm.reasons, row: settlePrj.directFacts[0] });

    // ---- revision 4 semantic probes (mechanic metadata / pending / dual forms / ids) ----
    var mmProj = projectDispatched({ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 60, 伤害类型: '近身攻击', 结算标签: '标准伤害', 抗性类型: '物理抗性', 对应等级: 89 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var mm = mmProj.opportunityModifiers && mmProj.opportunityModifiers.mechanicMetadataEntries;
    add('mechanicMetadataClosed', Array.isArray(mm) && mm.length === 1 && mm[0].sourceEffectId === 'e' && mm[0]['生效方式'] === '独立生效' && mm[0]['结算标签'] === '标准伤害' && mm[0]['抗性类型'] === '物理抗性' && mm[0]['对应等级'] === 89 && Object.keys(mm[0]).length === 5 && !hasOwn(mm[0], '驱动属性') && !hasOwn(mm[0], '影响方向'), { metadata: mm });
    var mmApiProj = api.project({ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 60, 伤害类型: '近身攻击', 结算标签: '标准伤害' }, baseCtx);
    var mmApiMeta = mmApiProj.opportunityModifiers && mmApiProj.opportunityModifiers.mechanicMetadataEntries;
    add('mechanicMetadataNeverWeighted', Array.isArray(mmApiMeta) && mmApiMeta.length === 1 && Object.isFrozen(mmApiMeta) && Object.isFrozen(mmApiMeta[0]) && !hasOwn(mmApiMeta[0], '__weight') && reg.implementation.mechanicMetadataEntries.valuePolicy.indexOf('never weighted') >= 0 && PER_PROTOTYPE_METADATA['判定修正'].length === 4, { frozen: Object.isFrozen(mmApiMeta), subset: PER_PROTOTYPE_METADATA['判定修正'] });
    var condProj = projectDispatched({ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 120, 伤害类型: '精神攻击', 条件分支: [{ 条件: [{ 类型: '时间', 对象: '自身', 比较: '==', 值: '白天' }], 处理: '生效' }] }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('pendingProjectionExplicit', condProj.unsupportedOutcomeKinds.indexOf('PENDING_CONDITIONAL_PROJECTION') >= 0 && condProj.directFacts.length === 0 && condProj.deferCode === '' && Array.isArray(condProj.opportunityModifiers.mechanicMetadataEntries) && condProj.opportunityModifiers.mechanicMetadataEntries.length === 1, { kinds: condProj.unsupportedOutcomeKinds });
    var unsAdm = runAdmit({ 原型: '属性修正', 目标: '自身', 属性: '力量', 数值: '3%', 持续回合: 1 }, baseCtx);
    add('unsignedPercentPendingDirection', unsAdm.admitted === true && unsAdm.reasons.indexOf('PENDING_DIRECTION_PROJECTION') >= 0 && unsAdm.retainedInCandidateAudit === true, { reasons: unsAdm.reasons });
    var bsProj = projectDispatched({ 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: '生命上限', 数值: '+1%', 持续回合: '变身期间' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('bianShenDurationPending', bsProj.unsupportedOutcomeKinds.indexOf('PENDING_DURATION_PROJECTION') >= 0 && bsProj.directFacts.length === 0, { kinds: bsProj.unsupportedOutcomeKinds });
    var carrierProj = projectDispatched({ 原型: '召唤生成', 目标: '自身' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('bareCarrierUnpackCode', carrierProj.unsupportedOutcomeKinds.indexOf(CARRIER_CODE) >= 0 && carrierProj.directFacts.length === 0, { code: CARRIER_CODE });
    var dualPen = projectDispatched({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 攻击段数: 2, 防御穿透: '20%', 伤害类型: '近身攻击' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var penRow = dualPen.directFacts.filter(function (r) { return r.key === 'damage.penetration'; })[0];
    add('numericDualFormEnforced', !!penRow && penRow.unit === 'PERCENT' && penRow.amount === 20, { penRow: penRow });
    var numAbs = projectDispatched({ 原型: '资源变化', 目标: '自身', 生效方式: '独立生效', 资源: '魂力', 数值: 100, 持续回合: 2 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('numericAbsForm', numAbs.directFacts.length === 1 && numAbs.directFacts[0].unit === 'ABS' && numAbs.directFacts[0].amount === 100 && numAbs.directFacts[0].durationTurns === 2, { row: numAbs.directFacts[0] });
    var arrProj = projectDispatched({ 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: ['力量', '防御'], 数值: '+10%', 持续回合: 2 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('arrayRowsUtf16Sorted', arrProj.directFacts.length === 2 && JSON.stringify(arrProj.directFacts.map(function (r) { return r.key; })) === JSON.stringify(['力量', '防御']), { keys: arrProj.directFacts.map(function (r) { return r.key; }) });
    var cjkRow = cloneDeep(damageProj.directFacts[0]);
    cjkRow.targetIds = ['武魂殿护法'];
    var ctlRow = cloneDeep(damageProj.directFacts[0]);
    ctlRow.targetIds = ['bad\u0000id'];
    add('idCharsetEnforced', validateDirectFactRow(cjkRow) === null && validateDirectFactRow(ctlRow) === 'TARGET_IDS_INVALID' && cjkRow.targetIds[0].length <= ID_MAX_LENGTH, { cjk: cjkRow.targetIds[0] });
    var ctlAdm = runAdmit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: 'a', sourceActorId: 'bad id', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'] });
    add('admitRejectsControlInSourceId', ctlAdm.admitted === false && ctlAdm.reasons[0] === 'INVALID_OPTION_VALUE' && ctlAdm.details && ctlAdm.details.field === 'sourceActorId', { adm: ctlAdm });
    var delAdm = runAdmit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'] });
    add('admitRejectsDelInSourceEffectId', delAdm.admitted === false && delAdm.reasons[0] === 'INVALID_OPTION_VALUE' && delAdm.details && delAdm.details.field === 'sourceEffectId', { adm: delAdm });
    var longAdm = runAdmit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: new Array(514).join('x'), sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'] });
    add('admitRejectsOverlongSourceActionId', longAdm.admitted === false && longAdm.reasons[0] === 'INVALID_OPTION_VALUE' && longAdm.details && longAdm.details.field === 'sourceActionId', { adm: longAdm });
    var tgtAdm = runAdmit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['bad tgt'] });
    add('admitRejectsControlInTargetIds', tgtAdm.admitted === false && tgtAdm.reasons[0] === 'INVALID_OPTION_VALUE' && tgtAdm.details && tgtAdm.details.field === 'candidateTargetIds[0]', { adm: tgtAdm });
    var symAdm = runAdmit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['单体'] });
    add('admitRejectsSymbolicTargetId', symAdm.admitted === false && symAdm.reasons[0] === 'INVALID_OPTION_VALUE' && symAdm.details && symAdm.details.field === 'candidateTargetIds[0]', { adm: symAdm });
    var cjkAdm = runAdmit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: '行动:龙啸九天', sourceActorId: '唐三', sourceEffectId: '效果:龙啸九天:0', candidateTargetIds: ['武魂殿护法'] });
    add('admitAcceptsCjkIds', cjkAdm.admitted === true, { adm: cjkAdm });
    var ctlPrj = runProject({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, { sourceActionId: 'a', sourceActorId: 'bad id', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'] }, undefined, LIFT_MAP, PROJECTION_MAP);
    add('projectReusesAdmitRejection', ctlPrj.unsupportedOutcomeKinds.length === 1 && ctlPrj.unsupportedOutcomeKinds[0] === 'INVALID_OPTION_VALUE' && ctlPrj.unsupportedOutcomeKinds[0].indexOf('INTERNAL_ROW_VALIDATION_FAILED') < 0 && ctlPrj.directFacts.length === 0, { prj: ctlPrj });
    var lingwuAdm = runAdmit({ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 1000, 对应等级: 30 }, baseCtx);
    add('lingwuOobClassification', lingwuAdm.admitted === false && lingwuAdm.reasons[0] === FORMAL_OOB_CODE && reg.formalLibrary.formalOobClassification === FORMAL_OOB_CODE, { reasons: lingwuAdm.reasons });
    add('noFormalSampleDeclared', JSON.stringify(reg.formalLibrary.noFormalSamplePrototypes) === JSON.stringify(['状态转移', '状态交换', '规则改写', '时光回溯']), { list: reg.formalLibrary.noFormalSamplePrototypes });
    add('unregisteredFormalOobCountRecorded', reg.formalLibrary.unregisteredFormalOobCount === 15 && reg.formalLibrary.unionFirstFiveCount === 1916 && reg.formalLibrary.unclassifiedCount === 21, { oob: reg.formalLibrary.unregisteredFormalOobCount, first5: reg.formalLibrary.unionFirstFiveCount, unclassified: reg.formalLibrary.unclassifiedCount });
    add('formalLibraryBasisVerified', reg.formalLibrary.basisSource.indexOf('contract rev4Spec.formalLibraryBasis') === 0 && reg.formalLibrary.firstBatchPathCount === 106, { source: reg.formalLibrary.basisSource });
    add('abUnionSemanticsEnforced', reg.formalLibrary.unionCounts['伤害结算'] === 1008 && reg.formalLibrary.unionCounts['属性修正'] === 517 && Object.keys(reg.formalLibrary.unionCounts).length === 23, { unionRows: Object.keys(reg.formalLibrary.unionCounts).length });
    add('unionIdentityDedupe', 1916 + 21 === reg.formalLibrary.unionFirstFiveCount + reg.formalLibrary.unclassifiedCount, { union: 1916, unclassified: 21 });
    var winMiss = runAdmit({ 原型: '时窗修正', 目标: '单体', 调整方式: '延长' }, baseCtx);
    add('windowAdjustFieldRequired', winMiss.admitted === false && winMiss.reasons[0] === 'MISSING_REQUIRED_FIELD', { reasons: winMiss.reasons });
    var followUpKey = 'follow-up-1';
    var triggerBad = runAdmit({ 原型: '机制授予', 目标: '自身', 触发条件: '死亡时触发', 跟进行动键: followUpKey, 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] }, baseCtx);
    add('triggerKeyRegistryEnumClosed', triggerBad.admitted === false && triggerBad.reasons[0] === 'INVALID_OPTION_VALUE' && TRIGGER_OPTIONS.length === 2, { reasons: triggerBad.reasons });
    var useCountMiss = runAdmit({ 原型: '机制授予', 目标: '自身', 触发条件: '主动触发', 跟进行动键: followUpKey, 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] }, baseCtx);
    add('maxActionsExplicitOnly', useCountMiss.admitted === false && useCountMiss.reasons[0] === 'MISSING_REQUIRED_FIELD', { reasons: useCountMiss.reasons });
    var grantPayloadPrj = projectDispatched({ 原型: '机制授予', 目标: '自身', 触发条件: '主动触发', 跟进行动键: followUpKey, 可用次数: 2, 持续回合: 3, 授予效果: [{ 原型: '复制执行', 目标: '单体', 复制类型: '复制技能', 复制模式: '即时镜像' }] }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('nestedPayloadRecursiveProjection', grantPayloadPrj.deferCode === 'DEFER_MECHANICS_PROJECTION' && grantPayloadPrj.unsupportedOutcomeKinds.indexOf('COPY_EXECUTION') >= 0, { deferCode: grantPayloadPrj.deferCode, kinds: grantPayloadPrj.unsupportedOutcomeKinds });
    var grantOk = runAdmit({ 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 跟进行动键: followUpKey, 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] }, baseCtx);
    add('grantPayloadProjected', grantOk.admitted === true && grantOk.reasons.indexOf(PENDING_KIND) < 0, { reasons: grantOk.reasons });
    var grantIdentity = projectDispatched({ 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 跟进行动键: followUpKey, 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var grantRow = grantIdentity.scheduledFacts[0];
    add('followUpIdentityProjection', !!grantRow && grantRow.ownerId === 'actor-1' && grantRow.followUpKey === followUpKey && grantRow.grantType === 'FOLLOW_UP' && grantRow.triggerKey === '随下次行动触发', { row: grantRow });
    var missingGrantKey = projectDispatched({ 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('followUpKeyMissingRejected', missingGrantKey.scheduledFacts.length === 0 && missingGrantKey.unsupportedOutcomeKinds[0] === 'FOLLOW_UP_KEY_MISSING', { projection: missingGrantKey });
    var invalidGrantKey = projectDispatched({ 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 跟进行动键: new Array(130).join('x'), 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('followUpKeyInvalidRejected', invalidGrantKey.scheduledFacts.length === 0 && invalidGrantKey.unsupportedOutcomeKinds[0] === 'FOLLOW_UP_KEY_INVALID', { projection: invalidGrantKey });
    var multiGrantCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1', 'enemy-2'] };
    var multiGrant = projectDispatched({ 原型: '机制授予', 目标: '群体', 触发条件: '随下次行动触发', 跟进行动键: followUpKey, 授予效果: [{ 原型: '判定修正', 目标: '单体', 判定: '命中', 数值: '+10%' }] }, multiGrantCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('followUpMultipleRecipientsDeferred', multiGrant.scheduledFacts.length === 0 && multiGrant.deferCode === 'DEFER_MECHANICS_PROJECTION' && multiGrant.unsupportedOutcomeKinds[0] === 'FOLLOW_UP_RECIPIENT_COUNT_INVALID', { projection: multiGrant });
    add('windowMultiRowKeysAreScheduledFactKeys', PENDING13_SPEC['时窗修正'].allowed.indexOf('结算倍率') >= 0 && PENDING13_SPEC['时窗修正'].allowed.indexOf('调整字段') >= 0, { windowKeys: PENDING13_SPEC['时窗修正'].allowed });

    // ---- revision 5 batch-2 semantic probes (状态施加/召唤生成/结算修正) ----
    var b2 = {};
    var stMulti = projectDispatched({ 原型: '状态施加', 目标: '单体', 状态: '中毒', 数值: '-5%', 副数值: '+10%', 持续回合: 2 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.stateMultiRows = stMulti.directFacts.length === 2 && stMulti.directFacts[0].key === 'state.primary' && stMulti.directFacts[0].amount === -5 && stMulti.directFacts[0].unit === 'PERCENT' && stMulti.directFacts[0].durationTurns === 2 && stMulti.directFacts[1].key === 'state.secondary' && stMulti.directFacts[1].amount === 10 && JSON.stringify(stMulti.opportunityModifiers.projectionFamilies) === JSON.stringify([{ sourceEffectId: 'e', prototype: '状态施加' }]);
    var stBool = projectDispatched({ 原型: '状态施加', 目标: '单体', 状态: '霸体', 持续回合: 3 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.stateBoolRow = stBool.directFacts.length === 1 && stBool.directFacts[0].key === '霸体' && stBool.directFacts[0].unit === 'BOOL' && stBool.directFacts[0].amount === 1 && stBool.directFacts[0].durationTurns === 3;
    var stZero = projectDispatched({ 原型: '状态施加', 目标: '单体', 状态: '标记', 数值: '0%', 持续回合: 1 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.stateZeroDirect = stZero.directFacts.length === 1 && stZero.directFacts[0].amount === 0 && stZero.directFacts[0].unit === 'PERCENT' && stZero.unsupportedOutcomeKinds.length === 0;
    var stUnsigned = projectDispatched({ 原型: '状态施加', 目标: '单体', 状态: '虚弱', 数值: '10%', 持续回合: 1 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.stateUnsignedPending = stUnsigned.directFacts.length === 0 && stUnsigned.unsupportedOutcomeKinds.indexOf('PENDING_DIRECTION_PROJECTION') >= 0;
    var stTaunt = projectDispatched({ 原型: '状态施加', 目标: '单体', 状态: '嘲讽', 持续回合: 1 }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.stateTauntModifier = stTaunt.legalityModifiers.taunt && stTaunt.legalityModifiers.taunt.state === '嘲讽' && stTaunt.legalityModifiers.taunt.target === 'target' && stTaunt.directFacts.length === 1 && stTaunt.directFacts[0].key === '嘲讽' && stTaunt.directFacts[0].unit === 'BOOL';
    var tauntCtx2 = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'], publicStates: { taunter: { 嘲讽: true } } };
    var stTauntForced = projectDispatched({ 原型: '状态施加', 目标: '单体', 状态: '嘲讽', 持续回合: 1 }, tauntCtx2, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.stateTauntForced = stTauntForced.legalityModifiers.taunt && stTauntForced.legalityModifiers.taunt.target === 'taunter' && JSON.stringify(stTauntForced.directFacts[0].targetIds) === JSON.stringify(['taunter']);
    var stUnknown = runAdmit({ 原型: '状态施加', 目标: '单体', 状态: '永冻', 数值: '-10%' }, baseCtx);
    b2.stateUnknownRejected = stUnknown.admitted === false && stUnknown.reasons[0] === 'UNKNOWN_STATE';
    var stSecondaryOnly = runAdmit({ 原型: '状态施加', 目标: '单体', 状态: '嘲讽', 副数值: '+10%' }, baseCtx);
    b2.stateSecondaryRequiresPrimary = stSecondaryOnly.admitted === false && stSecondaryOnly.reasons[0] === 'INVALID_OPTION_VALUE';
    var sumFull = projectDispatched({ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '审计召唤物', 数量: 2, 强度: 0.8, 继承属性比例: 0.15, 行动模式: '协同攻击', 持续回合: 3, 生效方式: '独立生效' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var sumKeys = sumFull.directFacts.map(function (r) { return r.key; });
    b2.summonFullRows = sumFull.directFacts.length === 4 && JSON.stringify(sumKeys) === JSON.stringify(['summon.count', 'summon.strength', 'summon.inheritRatio', 'summon.duration']) && sumFull.directFacts[0].amount === 2 && sumFull.directFacts[1].amount === 0.8 && sumFull.directFacts[2].amount === 0.15 && sumFull.directFacts[3].amount === 3 && sumFull.scheduledFacts.length === 1 && sumFull.scheduledFacts[0].grantType === 'SUMMON_WINDOW' && sumFull.scheduledFacts[0].durationTurns === 3 && sumFull.scheduledFacts[0]['召唤单位类型'] === '魂兽' && sumFull.scheduledFacts[0].entryId === 'e:schedule:0' && JSON.stringify(sumFull.opportunityModifiers.projectionFamilies) === JSON.stringify([{ sourceEffectId: 'e', prototype: '召唤生成' }]);
    var sumNoDur = projectDispatched({ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '审计召唤物', 数量: 1, 行动模式: '协同攻击' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.summonNoDuration = sumNoDur.directFacts.length === 1 && sumNoDur.directFacts[0].key === 'summon.count' && !sumNoDur.scheduledFacts[0].hasOwnProperty('durationTurns') && sumNoDur.unsupportedOutcomeKinds.indexOf('PENDING_DURATION_PROJECTION') >= 0;
    var sumCarrier = projectDispatched({ 原型: '召唤生成', 目标: '自身' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.summonCarrier = sumCarrier.unsupportedOutcomeKinds.indexOf(CARRIER_CODE) >= 0 && sumCarrier.directFacts.length === 0 && sumCarrier.scheduledFacts.length === 0;
    var sumCountZero = runAdmit({ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '审计召唤物', 数量: 0, 行动模式: '协同攻击', 持续回合: 1 }, baseCtx);
    b2.summonCountInvalid = sumCountZero.admitted === false && sumCountZero.reasons[0] === 'INVALID_OPTION_VALUE';
    var sumOpenEnum = runAdmit({ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '食物阵列', 召唤物名称: '审计阵列', 数量: 1, 行动模式: '协同作战', 持续回合: 1 }, baseCtx);
    b2.summonOpenIdentityStrings = sumOpenEnum.admitted === true;
    var sumTrigMeta = projectDispatched({ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '审计召唤物', 数量: 1, 行动模式: '协同攻击', 持续回合: 1, 生效方式: '独立生效', 触发限制: { 周期: '每日', 次数: 1 } }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.summonTriggerLimitMetadata = sumTrigMeta.directFacts.length === 0 && sumTrigMeta.unsupportedOutcomeKinds.indexOf('PENDING_TRIGGER_PROJECTION') >= 0 && Array.isArray(sumTrigMeta.opportunityModifiers.mechanicMetadataEntries) && sumTrigMeta.opportunityModifiers.mechanicMetadataEntries[0]['触发限制'] && sumTrigMeta.opportunityModifiers.mechanicMetadataEntries[0]['触发限制']['次数'] === 1 && sumTrigMeta.opportunityModifiers.mechanicMetadataEntries[0]['生效方式'] === '独立生效';
    var setMod = projectDispatched({ 原型: '结算修正', 目标: '自身', 结算: '造成伤害', 数值: '+10%', 持续回合: 1, 生效方式: '独立生效' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.settlementSingleRow = setMod.directFacts.length === 1 && setMod.directFacts[0].key === 'settlement.primary' && setMod.directFacts[0].amount === 10 && setMod.directFacts[0].unit === 'PERCENT' && Array.isArray(setMod.opportunityModifiers.mechanicMetadataEntries) && setMod.opportunityModifiers.mechanicMetadataEntries[0]['结算'] === '造成伤害';
    var setAbsorb = projectDispatched({ 原型: '结算修正', 目标: '自身', 结算: '伤害吸收', 数值: '+20%', 持续回合: 2, 生效方式: '独立生效', 限定元素: ['雷', '火'], 吸收资源: '魂力', 吸收来源: '受到伤害' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var setMeta = setAbsorb.opportunityModifiers.mechanicMetadataEntries && setAbsorb.opportunityModifiers.mechanicMetadataEntries[0];
    b2.settlementNoDoubleCount = setAbsorb.directFacts.length === 1 && setAbsorb.directFacts[0].key === 'settlement.primary' && !!setMeta && JSON.stringify(setMeta['限定元素']) === JSON.stringify(['火', '雷']) && setMeta['吸收资源'] === '魂力' && Object.keys(setMeta).length === 6;
    var setElemSingle = projectDispatched({ 原型: '结算修正', 目标: '自身', 结算: '反伤', 数值: '+10%', 持续回合: 1, 限定元素: '火' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.settlementElementSingleNormalized = Array.isArray(setElemSingle.opportunityModifiers.mechanicMetadataEntries) && setElemSingle.opportunityModifiers.mechanicMetadataEntries[0] && JSON.stringify(setElemSingle.opportunityModifiers.mechanicMetadataEntries[0]['限定元素']) === JSON.stringify(['火']);
    var setUnsigned = runAdmit({ 原型: '结算修正', 目标: '自身', 结算: '治疗', 数值: '10%', 持续回合: 1 }, baseCtx);
    b2.settlementUnsignedPending = setUnsigned.admitted === true && setUnsigned.reasons.indexOf('PENDING_DIRECTION_PROJECTION') >= 0 && setUnsigned.retainedInCandidateAudit === true;
    var setCond = projectDispatched({ 原型: '结算修正', 目标: '自身', 结算: '消耗', 数值: '-10%', 条件分支: [{ 条件: [{ 类型: '当前行动', 对象: '自身', 比较: '!=', 值: '常规攻击' }], 处理: '禁用' }] }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    b2.settlementConditionalPending = setCond.directFacts.length === 0 && setCond.unsupportedOutcomeKinds.indexOf('PENDING_CONDITIONAL_PROJECTION') >= 0;
    var b2Cls = classifyParsed(parsePathId('PPU1:IN_BATTLE:状态施加:状态:0'), LIFT_MAP, PROJECTION_MAP);
    var b2Cls2 = classifyParsed(parsePathId('PPU1:IN_BATTLE:召唤生成:目标:0'), LIFT_MAP, PROJECTION_MAP);
    b2.batch2DirectClassification = b2Cls.contractStatus === 'SUPPORTED' && b2Cls.implementationStatus === 'DIRECT_PROJECTION' && b2Cls2.contractStatus === 'SUPPORTED' && b2Cls2.implementationStatus === 'DIRECT_PROJECTION';
    add('batch2SemanticProbes', b2.stateMultiRows && b2.stateBoolRow && b2.stateZeroDirect && b2.stateUnsignedPending && b2.stateTauntModifier && b2.stateTauntForced && b2.stateUnknownRejected && b2.stateSecondaryRequiresPrimary && b2.summonFullRows && b2.summonNoDuration && b2.summonCarrier && b2.summonCountInvalid && b2.summonOpenIdentityStrings && b2.summonTriggerLimitMetadata && b2.settlementSingleRow && b2.settlementNoDoubleCount && b2.settlementElementSingleNormalized && b2.settlementUnsignedPending && b2.settlementConditionalPending && b2.batch2DirectClassification, b2);

    var passedAll = checks.every(function (c) { return c.passed; });
    metrics.lastSelfCheckPassed = passedAll;
    return { passed: passedAll, ok: passedAll, sourceSelfCheckable: sourceSelfCheckable, revision: REVISION, checks: checks };
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
    selfCheck: function (sourceText) {
      return runSelfCheck(sourceText);
    },
    setDeferOverride: apiSetDeferOverride,
    setPathProjectionOverride: apiSetPathProjectionOverride,
    getPathProjectionOverride: apiGetPathProjectionOverride,
    clearOverride: apiClearOverride
  };

  freezeDeep(api.registry());
  if (typeof globalThis !== 'undefined') globalThis[MOUNT_NAME] = api;
  if (typeof self !== 'undefined' && typeof globalThis === 'undefined') self[MOUNT_NAME] = api;
  if (typeof window !== 'undefined' && typeof globalThis === 'undefined') window[MOUNT_NAME] = api;
})();

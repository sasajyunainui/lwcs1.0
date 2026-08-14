// BehaviorPrototypeAdapter_Module.js
// M2 adapter writer F - rev3 production candidate (R9_CANDIDATE_UNREGISTERED).
// Contract authority:
//   tools/rc6/contracts/PrototypeDirectAdapterV1.json       390d5f2efe0409301cfb894c30c4312e16d7d488a386aa943f008718e65fb0bb
//   tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json ca17d0d8c1d526001fd65941768d4e996c2dfb6488d3e7b484c66343b3f85ed3
//   tools/rc6/cases/PrototypeDirectAdapterCasesV1.json      3fd9a6a13fb13226060ddc3afefc2314b4728becc4a1b6161b357b3c1a3108c9
//   tools/rc6/contracts/DirectFactRowV1.json                6a1951015a6bde4f00db502c8ce7805888942251f2c38507fe2769265f589fa1
//   tools/rc6/contracts/DirectFactRowV1.schema.json         1cf2490b90c0ebabcbcd163436dcc963209240d1fec049e7ba8815f1c4d49334
// Boundary: batch-1 prototypes only (伤害结算/资源变化/护盾变化/属性修正/判定修正, 106 paths)
// are strict-admit direct projections. The other 16 contract-SUPPORTED prototypes stay
// PENDING_DIRECT_PROJECTION (zero contribution plus explicit kind; never fake support).
// 40 deferred paths (复制执行 22 + 时光回溯 18) stay path-level DEFERRED_EXPLICIT and are
// liftable per path only together with an explicit caller projection. 4 out-of-battle
// prototypes stay OUT_OF_BATTLE_SCOPE. No Provider/Runtime/loader wiring; no future-route
// enumeration, no world clone, no result enumeration, no hidden-state reads.
// Revision 3: directFacts supersede the rev2 factColumns string placeholder; column-code
// strings are NOT contributions. DirectFact-to-Provider column mapping is NOT frozen and is
// NOT wired here.
(function () {
  'use strict';

  var MOUNT_NAME = '__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__';
  var ROLE = 'R9_CANDIDATE_UNREGISTERED';
  var REVISION = 3;
  var REGISTRY_ID = 'RC6-M2-PROTOTYPE-DIRECT-ADAPTER-2026-08-14';
  var LIFT_SENTINEL = 'LIFT_TO_SUPPORTED';
  var PENDING_KIND = 'PENDING_DIRECT_PROJECTION';
  var MAPPING_NOT_FROZEN = 'NOT_FROZEN_NOT_WIRED';

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
    'damage.type': 'HP_DELTA', 'state.primary': 'STATE_DELTA', 'state.secondary': 'STATE_DELTA'
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
  var PENDING16 = [
    '资源转移', '结算修正', '炸环', '状态施加', '时窗修正', '状态移除', '规则防御',
    '状态转移', '状态交换', '资源锁定', '规则改写', '机制抹消', '机制授予', '位移执行',
    '决策干扰', '召唤生成'
  ];

  // Batch-1 strict admit specs. allowed/required follow the frozen schema effect shapes
  // (closed per-prototype input surface) plus registry required fields. Enum values come
  // from the runtime registry 字段定义. BATCH1_SPEC is a writer-side decision and is
  // reported to the coordinator for ratification.
  var BATCH1_SPEC = {
    '伤害结算': {
      allowed: ['原型', '目标', '威力倍率', '伤害类型', '攻击段数', '防御穿透'],
      required: ['原型', '目标', '威力倍率', '伤害类型'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物'], '伤害类型': ['近身攻击', '远程攻击', '精神攻击', '真实攻击'] },
      numeric: { '威力倍率': 'finite', '攻击段数': 'posint', '防御穿透': 'finite' }
    },
    '资源变化': {
      allowed: ['原型', '目标', '资源', '数值'],
      required: ['原型', '目标', '资源', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'], '资源': ['生命', '体力', '魂力', '精神力'] },
      numeric: {}
    },
    '护盾变化': {
      allowed: ['原型', '目标', '护盾模式', '数值'],
      required: ['原型', '目标', '护盾模式', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物'], '护盾模式': ['正向护盾', '斩盾', '窃盾'] },
      numeric: {}
    },
    '属性修正': {
      allowed: ['原型', '目标', '属性', '数值', '持续回合'],
      required: ['原型', '目标', '属性', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'], '属性': ['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限'] },
      numeric: { '持续回合': 'intnonneg' }
    },
    '判定修正': {
      allowed: ['原型', '目标', '判定', '数值', '持续回合'],
      required: ['原型', '目标', '判定', '数值'],
      enums: { '目标': ['自身', '单体', '群体', '全场', '召唤物', '分身'], '判定': ['命中', '闪避', '反应'] },
      numeric: { '持续回合': 'intnonneg' }
    }
  };

  // 分身 target allowance gate, pinned to the complete runtime set
  // MVU_Skill_Runtime.js::分身目标允许原型集合_V1 (['资源变化','属性修正','判定修正','结算修正']).
  // Cross-checked with the frozen PrototypeDirectAdapterV1.schema.json per-prototype effect
  // surfaces (目标 is a free string there, no contradiction) and with each allowed prototype's
  // runtime 目标 option list which includes 分身. This is the complete set; do not extend by
  // guessing. 结算修正 is allowed at the resolution gate even though its DirectFact projection
  // stays PENDING_DIRECT_PROJECTION.
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
    if (typeof row.sourceActorId !== 'string' || row.sourceActorId.length === 0) return 'SOURCE_ACTOR_EMPTY';
    if (typeof row.sourceEffectId !== 'string' || row.sourceEffectId.length === 0) return 'SOURCE_EFFECT_EMPTY';
    if (!Array.isArray(row.targetIds) || row.targetIds.length === 0) return 'TARGET_IDS_EMPTY';
    if (new Set(row.targetIds).size !== row.targetIds.length) return 'TARGET_IDS_DUPLICATE';
    for (var i = 0; i < row.targetIds.length; i += 1) {
      var t = row.targetIds[i];
      if (typeof t !== 'string' || t.length === 0 || t.length > 64) return 'TARGET_IDS_INVALID';
      if (SYMBOLIC_TARGETS.indexOf(t) >= 0) return 'TARGET_IDS_SYMBOLIC_PLACEHOLDER';
      if (!/^[A-Za-z0-9_\-:/.]{1,64}$/.test(t)) return 'TARGET_IDS_INVALID';
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
    if (tgt === '单体' || tgt === '群体' || tgt === '全场' || tgt === '召唤物' ||
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
    var impl = BATCH1.indexOf(proto) >= 0 ? 'DIRECT_PROJECTION' : 'PENDING_DIRECT_PROJECTION';
    return { status: 'SUPPORTED', contractStatus: 'SUPPORTED', implementationStatus: impl, tier: entry.tier, deferCode: '', reasonCode: '' };
  }
  // ---- batch-1 strict admit ----
  function validateBatch1(effect, spec) {
    if (!isPlainObject(effect)) return 'INVALID_EFFECT';
    if (effect['原型'] !== spec.protoName) return 'PROTOTYPE_MISMATCH';
    for (var i = 0; i < spec.allowed.length; i += 1) {
      if (hasOwn(effect, spec.allowed[i])) continue;
      if (spec.required.indexOf(spec.allowed[i]) >= 0) return 'MISSING_REQUIRED_FIELD';
    }
    for (var f in effect) {
      if (!hasOwn(effect, f)) continue;
      if (spec.allowed.indexOf(f) < 0) return 'INVALID_OPTION_VALUE';
    }
    for (var r = 0; r < spec.required.length; r += 1) {
      if (!hasOwn(effect, spec.required[r])) return 'MISSING_REQUIRED_FIELD';
    }
    for (var en in spec.enums) {
      if (!hasOwn(spec.enums, en)) continue;
      if (hasOwn(effect, en) && spec.enums[en].indexOf(effect[en]) < 0) return 'INVALID_OPTION_VALUE';
    }
    for (var nu in spec.numeric) {
      if (!hasOwn(spec.numeric, nu)) continue;
      if (!hasOwn(effect, nu)) continue;
      var v = effect[nu];
      var kind = spec.numeric[nu];
      if (typeof v !== 'number' || !Number.isFinite(v)) return 'INVALID_OPTION_VALUE';
      if (kind === 'posint' && (!Number.isInteger(v) || v <= 0)) return 'INVALID_OPTION_VALUE';
      if (kind === 'intnonneg' && (!Number.isInteger(v) || v < 0)) return 'INVALID_OPTION_VALUE';
    }
    if (hasOwn(effect, '数值')) {
      if (parseSigned(effect['数值']) === null) return 'INVALID_OPTION_VALUE';
    }
    var tgt = effect['目标'];
    if (['自身', '单体', '群体', '全场', '召唤物', '分身'].indexOf(tgt) < 0) return 'INVALID_OPTION_VALUE';
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
    if (spec.protoName === '伤害结算') {
      var power = effect['威力倍率'];
      var segments = effect['攻击段数'];
      var penetration = effect['防御穿透'];
      var multi = hasOwn(effect, '攻击段数') || hasOwn(effect, '防御穿透');
      if (!multi) {
        rows.push(makeRow(ctx, 'HP_DELTA', '', power, 'POWER', 0));
      } else {
        rows.push(makeRow(ctx, 'HP_DELTA', 'damage.power', power, 'POWER', 0));
        if (hasOwn(effect, '攻击段数')) rows.push(makeRow(ctx, 'HP_DELTA', 'damage.segments', segments, 'COUNT', 0));
        if (hasOwn(effect, '防御穿透')) rows.push(makeRow(ctx, 'HP_DELTA', 'damage.penetration', penetration, 'PERCENT', 0));
        rows.push(makeRow(ctx, 'HP_DELTA', 'damage.type', 1, 'BOOL', 0));
      }
    } else if (spec.protoName === '资源变化') {
      rows.push(makeRow(ctx, 'RESOURCE_OPTION_CHANGED', String(effect['资源']), parseSigned(effect['数值']), 'ABS', 0));
    } else if (spec.protoName === '护盾变化') {
      rows.push(makeRow(ctx, 'SHIELD_DELTA', String(effect['护盾模式']), parseSigned(effect['数值']), 'ABS', 0));
    } else if (spec.protoName === '属性修正') {
      rows.push(makeRow(ctx, 'STATE_DELTA', String(effect['属性']), parseSigned(effect['数值']), 'PERCENT', hasOwn(effect, '持续回合') ? effect['持续回合'] : 0));
    } else if (spec.protoName === '判定修正') {
      rows.push(makeRow(ctx, 'STATE_DELTA', String(effect['判定']), parseSigned(effect['数值']), 'PERCENT', hasOwn(effect, '持续回合') ? effect['持续回合'] : 0));
      legalityModifiers.judgmentRates = [{ 判定: String(effect['判定']), 数值: String(effect['数值']) }];
    }
    for (var i = 0; i < rows.length; i += 1) {
      var verr = validateDirectFactRow(rows[i]);
      if (verr) return { error: 'INTERNAL_ROW_VALIDATION_FAILED:' + verr, rows: rows };
    }
    if (!checkRowUniqueness(rows)) return { error: 'INTERNAL_ROW_UNIQUENESS_FAILED', rows: rows };
    return { error: null, rows: rows, legalityModifiers: legalityModifiers, opportunityModifiers: opportunityModifiers };
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
    if (!effect || !hasOwn(effect, '干扰')) return null;
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
      return projectDispatched(effect, ctx, legMods, oppMods, liftMap, projectionMap);
    }

    var ctxErr = contextError(ctx);
    if (ctxErr) return projectionWithUnsupported(ctxErr, null);
    var sc = sourceContextOf(ctx);
    var legality = resolveLegality(ctx, effect, sc.sourceActorId, sc.candidateTargetIds);
    if (legality.reject === 'AMBIGUOUS_TAUNT_TARGET' || legality.reject === 'PLAYER_LOCKED_TAUNT_LEGALITY') {
      var tmod = tauntLegalityModifier(legality);
      if (tmod) legMods.taunt = tmod;
      return projectionWithUnsupported(legality.reject, { legalityModifiers: legMods });
    }
    if (legality.reject) return projectionWithUnsupported(legality.reject, null);
    if (legality.tauntReason) legMods.taunt = tauntLegalityModifier(legality);
    var interference = interferenceOf(effect, ctx);
    if (interference) {
      if (interference.interferenceRates.length) oppMods.interferenceRates = interference.interferenceRates;
      if (interference.dependencyTokens.length) oppMods.dependencyTokens = interference.dependencyTokens;
    }
    return projectDispatched(effect, ctx, legMods, oppMods, liftMap, projectionMap);
  }

  function projectDispatched(effect, ctx, legMods, oppMods, liftMap, projectionMap) {
    var proto = effect && effect['原型'];
    if (typeof proto !== 'string' || !hasOwn(CONTRACT_ENTRY, proto)) {
      metrics.unknownPrototypeRejectCount += 1;
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
    if (BATCH1.indexOf(proto) < 0) {
      metrics.pendingProjectCount += 1;
      var pOut = emptyProjection();
      pOut.legalityModifiers = legMods;
      pOut.opportunityModifiers = oppMods;
      pOut.unsupportedOutcomeKinds = [PENDING_KIND];
      return pOut;
    }
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
    var proto = effect && effect['原型'];
    if (typeof proto !== 'string' || !hasOwn(CONTRACT_ENTRY, proto)) {
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
    if (BATCH1.indexOf(proto) < 0) {
      reasons.push(PENDING_KIND);
      return { admitted: true, reasons: reasons };
    }
    var spec = BATCH1_SPEC[proto];
    spec.protoName = proto;
    var verr = validateBatch1(effect, spec);
    if (verr) {
      metrics.rejectCount += 1;
      return { admitted: false, reasons: [verr] };
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
        implementationDirectProjection: 106,
        implementationPending: 475,
        implementationDeferred: 40,
        implementationOutOfBattleScope: 91,
        placeholderProjectionCount: 0,
        claimsDirectProjectionForAllSupported: false,
        batch1Prototypes: BATCH1.slice(),
        batch1PathCount: 106,
        pendingPrototypes: PENDING16.slice(),
        directFactToProviderColumnMapping: MAPPING_NOT_FROZEN
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
        revision3SupersedeDeclared: true,
        projectOutput: 'six fields directFacts/legalityModifiers/opportunityModifiers/scheduledFacts/unsupportedOutcomeKinds/deferCode; directFacts supersede the legacy column-code placeholder (revision 3); column-code strings are not contributions',
        directFactToProviderColumnMapping: MAPPING_NOT_FROZEN,
        legalityModifiers: 'effect-declared legality modifiers in project output; computeLegalityContext returns the current-public legality context (taunt legal target set)'
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
    add('registryShape', reg.enrollment.contractSupportedPathCount === 581 && reg.implementation.implementationDirectProjection === 106 && reg.implementation.implementationPending === 475 && reg.counts.totalInBattlePathCount === 621 && reg.counts.silentOmissionCount === 0, { counts: reg.counts, implementation: reg.implementation });
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

    var pendingProj = projectDispatched({ 原型: '位移执行', 目标: '单体', 位移类型: '击退' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var deferProj = projectDispatched({ 原型: '复制执行', 目标: '单体', 复制类型: '复制技能' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    var damageProj = projectDispatched({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('noSilentZero', pendingProj.unsupportedOutcomeKinds.indexOf(PENDING_KIND) >= 0 && deferProj.deferCode === 'DEFER_MECHANICS_PROJECTION' && damageProj.directFacts.length === 1, { pending: pendingProj.unsupportedOutcomeKinds, deferCode: deferProj.deferCode, damageRows: damageProj.directFacts.length });
    add('pendingNotSilent', pendingProj.unsupportedOutcomeKinds.indexOf(PENDING_KIND) >= 0 && pendingProj.directFacts.length === 0, { kind: PENDING_KIND });
    add('noClaim581Implemented', reg.implementation.claimsDirectProjectionForAllSupported === false && reg.implementation.implementationDirectProjection === 106, { implemented: 106, pending: 475 });
    add('enrollmentImplementationSeparated', !!reg.enrollment && !!reg.implementation && reg.enrollment.contractSupportedPathCount === 581 && reg.implementation.implementationDirectProjection === 106, { enrollment: reg.enrollment.contractSupportedPathCount, implementation: reg.implementation.implementationDirectProjection });

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
    add('revision3SupersedeDeclared', reg.semantics.revision3SupersedeDeclared === true && reg.implementation.directFactToProviderColumnMapping === MAPPING_NOT_FROZEN, { supersede: true, mapping: MAPPING_NOT_FROZEN });
    add('targetIdsNoSymbolicPlaceholder', symRejected, { symbolicRejected: true });
    add('multiRowKeyVocabularyFrozen', Object.keys(MULTI_ROW_KEYS).length === 6, { keys: Object.keys(MULTI_ROW_KEYS) });
    var mvProj = projectDispatched({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 攻击段数: 2, 防御穿透: 20, 伤害类型: '近身攻击' }, baseCtx, {}, {}, LIFT_MAP, PROJECTION_MAP);
    add('rowUniquenessBySourceEffectIdAndKey', checkRowUniqueness(mvProj.directFacts) && mvProj.directFacts.length === 4, { rows: mvProj.directFacts.length });
    add('negativeZeroNormalized', parseSigned('-0%') === 0 && Object.is(parseSigned('-0%'), -0) === false, { normalized: parseSigned('-0%') });
    add('sourceContextRequired', contextError({}) === 'MISSING_SOURCE_CONTEXT' && contextError({ sourceActionId: 'a', sourceActorId: 'a', sourceEffectId: 'a' }) === 'MISSING_TARGET_CONTEXT', { codes: ['MISSING_SOURCE_CONTEXT', 'MISSING_TARGET_CONTEXT'] });
    var directCls1 = classifyParsed(parsePathId('PPU1:IN_BATTLE:伤害结算:目标:1'), LIFT_MAP, PROJECTION_MAP);
    var directCls2 = classifyParsed(parsePathId('PPU1:IN_BATTLE:判定修正:目标:1'), LIFT_MAP, PROJECTION_MAP);
    add('batch1DirectClassificationReachable', directCls1.contractStatus === 'SUPPORTED' && directCls1.implementationStatus === 'DIRECT_PROJECTION' && directCls2.contractStatus === 'SUPPORTED' && directCls2.implementationStatus === 'DIRECT_PROJECTION', { damage: directCls1.implementationStatus, judgment: directCls2.implementationStatus });
    var cloneBase = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['clone-1'] };
    var cloneAdm = runAdmit({ 原型: '资源变化', 目标: '分身', 资源: '魂力', 数值: '+10' }, cloneBase);
    var clonePrj = runProject({ 原型: '资源变化', 目标: '分身', 资源: '魂力', 数值: '+10' }, cloneBase, undefined, LIFT_MAP, PROJECTION_MAP);
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
    add('clonePendingSettlementReachable', settleCls.contractStatus === 'SUPPORTED' && settleCls.implementationStatus === 'PENDING_DIRECT_PROJECTION' && settleAdm.admitted === true && settleAdm.reasons.indexOf(PENDING_KIND) >= 0 && settlePrj.unsupportedOutcomeKinds.indexOf(PENDING_KIND) >= 0 && settlePrj.directFacts.length === 0 && settlePrj.deferCode === '', { cls: settleCls.implementationStatus, reasons: settleAdm.reasons, unsupported: settlePrj.unsupportedOutcomeKinds });

    var passedAll = checks.every(function (c) { return c.passed; });
    metrics.lastSelfCheckPassed = passedAll;
    return { passed: passedAll, ok: passedAll, sourceSelfCheckable: sourceSelfCheckable, revision: REVISION, checks: checks };
  }

  var api = {
    providerId: 'behavior-prototype-adapter-v1',
    kind: 'CANDIDATE_ONLY',
    role: ROLE,
    revision: REVISION,
    contractRevision: 3,
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

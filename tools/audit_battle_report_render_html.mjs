import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { readBattleUiTestSource } from './battle_ui_test_source.mjs';

const repoRoot = process.cwd();
const battleFile = path.join(repoRoot, 'lwcs', 'BattleUI_Module.js');
const code = readBattleUiTestSource(repoRoot);
const skillRuntimeCode = fs.readFileSync(path.join(repoRoot, 'lwcs', 'MVU_Skill_Runtime.js'), 'utf8');
const previewRuntimeCode = fs.readFileSync(path.join(repoRoot, 'lwcs', 'BattlePreview_Module.js'), 'utf8');
const decisionRuntimeCode = fs.readFileSync(path.join(repoRoot, 'lwcs', 'BattleDecision_Module.js'), 'utf8');
const battleRuntimeCode = fs.readFileSync(path.join(repoRoot, 'lwcs', 'BattleRuntime_Module.js'), 'utf8');
const bridgeCode = fs.readFileSync(path.join(repoRoot, 'lwcs', 'mvu_logic_bridge.js'), 'utf8');
const styleCode = fs.readFileSync(path.join(repoRoot, 'lwcs', 'mvu_styles.css'), 'utf8');
const publicFailureReportSource = code.match(/function 构建公开战报失败短句\([\s\S]*?(?=\n    function )/)?.[0] || '';
const publicFailureBlockSource = code.match(/function 构建失败动作公开战报Block条目\([\s\S]*?(?=\n    function )/)?.[0] || '';
const publicQuietRoundSource = code.match(/function 构建无伤害回合公开战报Block条目\([\s\S]*?(?=\n    function )/)?.[0] || '';

function makeNode() {
  return {
    style: {},
    isConnected: true,
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    getAttribute() { return ''; },
    appendChild() {},
    remove() {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), {
  querySelector(selector) {
    if (selector === '#ui-battle-record-terminal') return recordNode;
    return null;
  },
});

const container = {
  innerHTML: '',
  querySelector(selector) {
    if (selector === '.battle-module-scope') return scopeNode;
    return null;
  },
};

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Math,
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Symbol,
  parseInt,
  parseFloat,
  isNaN,
  Intl,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  navigator: { userAgent: 'node' },
  location: { href: 'http://localhost/' },
  innerWidth: 1440,
  innerHeight: 900,
  getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
  ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
  localStorage: { getItem() { return null; }, setItem() {} },
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
};

sandbox.document = {
  documentElement: { clientWidth: 1440, clientHeight: 900 },
  createElement: () => makeNode(),
  body: { appendChild() {} },
  head: { appendChild() {} },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);
vm.runInContext(skillRuntimeCode, sandbox, { filename: 'MVU_Skill_Runtime.js' });
vm.runInContext(previewRuntimeCode, sandbox, { filename: 'BattlePreview_Module.js' });
vm.runInContext(decisionRuntimeCode, sandbox, { filename: 'BattleDecision_Module.js' });
vm.runInContext(battleRuntimeCode, sandbox, { filename: 'BattleRuntime_Module.js' });
vm.runInContext(code, sandbox, { filename: 'BattleUI_Module.js' });
new sandbox.BattleUIComponent(container, {}, {});

if (typeof sandbox.__LWCS_RENDER_BATTLE_REPORT_HTML__ !== 'function') {
  throw new Error('未找到 __LWCS_RENDER_BATTLE_REPORT_HTML__ 调试导出');
}

if (typeof sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__ !== 'function') {
  throw new Error('未找到 __LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__ 调试导出');
}

if (typeof sandbox.__LWCS_BUILD_BATTLE_ROUND_DASHBOARD__ !== 'function' || typeof sandbox.__LWCS_RENDER_BATTLE_ROUND_DASHBOARD__ !== 'function') {
  throw new Error('未找到回合速览调试导出');
}

if (typeof sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__ !== 'function') {
  throw new Error('未找到行动链折叠调试导出');
}

if (typeof sandbox.__LWCS_RENDER_BATTLE_DECISION_ROWS_HTML__ !== 'function') {
  throw new Error('未找到判定流程分区调试导出');
}

if (typeof sandbox.__LWCS_EXPORT_BATTLE_RECORD_VISIBLE_TEXT__ !== 'function') {
  throw new Error('未找到战斗记录可见文本调试导出');
}

const context = {
  eventLedger: [
    {
      eventId: 'evt_state_1',
      eventKind: 'state_apply',
      actorName: '夹具玩家',
      actionName: '毒牙牵制',
      targetName: '夹具敌人',
      stateName: '中毒',
      result: 'applied',
      duration: 2,
      effectSummary: '持续损失生命',
      driverAttr: '魂力上限',
    },
  ],
  combatData: {
    参战者: {
      team_player: [
        {
          name: '夹具玩家',
          血脉之力: {
            技能: {
              青影蛇群: {
                name: '第二魂技·青影蛇群',
                魂技名: '第二魂技·青影蛇群',
                __魂技槽位: '第2魂技',
                消耗: '魂力:140',
              },
            },
          },
        },
      ],
      team_enemy: [{ name: '夹具敌人' }],
    },
  },
};
context.units = [...context.combatData.参战者.team_player, ...context.combatData.参战者.team_enemy];

const skillLine = '第1回合：夹具玩家施展【第二魂技·青影蛇群】指向夹具敌人。';
const stateApplyLine = '第1回合：夹具玩家施展【毒牙牵制】指向夹具敌人，夹具玩家对夹具敌人造成了 127 点伤害。这一击令夹具敌人陷入【中毒】（持续2回合）。';
const stateTickLine = '第2回合：夹具敌人随后受【中毒】影响，损失了 48 点生命值（该状态由第1回合夹具玩家施展【毒牙牵制】附加，持续2回合）。';
const publicBlocks = [
  { type: 'text', content: '第1回合：夹具玩家施展【毒牙牵制】指向夹具敌人。', sourceEventId: 'evt_text_1', sourceNodeId: 'node_action_1' },
  { type: 'badge', kind: 'damage', value: -127, unit: 'HP', targetName: '夹具敌人', targetId: 'enemy-1', isSelf: false, sourceEventId: 'evt_hit_1', sourceNodeId: 'node_hit_1' },
  { type: 'badge', kind: 'state', name: '中毒', targetName: '夹具敌人', targetId: 'enemy-1', isSelf: false, sourceEventId: 'evt_state_1', sourceNodeId: 'node_state_1' },
];
const publicHitBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  {
    eventId: 'evt_hit_public_1',
    eventKind: 'hit_result',
    round: 1,
    actorName: '夹具玩家',
    targetName: '夹具敌人',
    targetId: 'enemy-1',
    actionName: '裂地冲拳',
    finalActionName: '裂地冲拳',
    chainNodeId: 'node_damage_public_1',
    result: 'hit',
    damage: 120,
    meta: {
      damage: 120,
      incomingDamage: 160,
      defenseThreshold: 8,
      shieldAbsorb: 0,
      finalDamage: 120,
      settlementTrace: [
        { key: 'sourceAction', value: '裂地冲拳' },
        { key: 'attacker', value: '夹具玩家' },
        { key: 'target', value: '夹具敌人' },
        { key: 'result', value: 'hit' },
        { key: 'incomingDamage', value: 160 },
        { key: 'defenseThreshold', value: 8 },
        { key: 'shieldAbsorb', value: 0 },
        { key: 'finalDamage', value: 120 },
      ],
      formulaTrace: {
        skillPower: 1.6,
        attackValue: 140,
        defenseValue: 42,
        baseDamage: 160,
        formulaText: 'floor(攻势值×威力倍率-防御值)',
      },
    },
  },
], 8, context) || [];
const publicHitSerialized = publicHitBlocks.map(line => line?.text || '').join('\n');
const publicHitBadges = publicHitBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'damage');
const publicHitHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__(publicHitBlocks[0]?.blocks || [], context);
const dashboardResult = {
  eventLedger: [
    { eventKind: 'hit_result', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '第二魂技·青影蛇群', finalActionName: '第二魂技·青影蛇群', damage: 127, result: 'hit' },
    { eventKind: 'state_apply', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '毒牙牵制', finalActionName: '毒牙牵制', stateName: '中毒', result: 'applied' },
    { eventKind: 'counter', round: 1, actorName: '夹具敌人', targetName: '夹具玩家', actionName: '敌方截击', finalActionName: '敌方截击', damage: 42, result: 'success' },
    { eventKind: 'action_cost', round: 1, actorName: '夹具玩家', actionName: '第二魂技·青影蛇群', finalActionName: '第二魂技·青影蛇群', meta: { reqSp: 140, reqVit: 0, reqMen: 30, costText: '魂力:140 | 精神力:30' } },
    { eventKind: 'round_recover', round: 1, actorName: '夹具玩家', result: 'recover', meta: { resource: '魂力', amount: 20 } },
    { eventKind: 'resource_change', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', result: 'loss', meta: { resource: '魂力', amount: 50, delta: -50, transferMode: '吞噬' } },
  ],
  combatData: context.combatData,
};

const skillHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_HTML__(skillLine, context);
const stateApplyHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_HTML__(stateApplyLine, context);
const stateTickHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_HTML__(stateTickLine, context);
const blockHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__(publicBlocks, context);
const dashboardRows = sandbox.__LWCS_BUILD_BATTLE_ROUND_DASHBOARD__(dashboardResult, context);
const dashboardHtml = sandbox.__LWCS_RENDER_BATTLE_ROUND_DASHBOARD__(dashboardRows);
const continuousDashboardRows = sandbox.__LWCS_BUILD_BATTLE_ROUND_DASHBOARD__({
  roundsExecuted: 3,
  combatData: context.combatData,
  eventLedger: [
    { eventId: 'evt_round_1_damage', eventKind: 'hit_result', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '普通攻击', damage: 12, result: 'hit' },
    { eventId: 'evt_round_3_hot', eventKind: 'state_tick', round: 3, actorName: '夹具玩家', targetName: '夹具玩家', actionName: '生命恢复', amount: 25, result: '恢复', meta: { resource: '生命值', amount: 25 } },
    { eventId: 'evt_round_3_floor', eventKind: 'resource_change', round: 3, actorName: '夹具玩家', targetName: '夹具玩家', actionName: '装备护主', result: 'recover', meta: { resource: '生命值', resourceKey: 'hp', amount: 10, delta: 10 } },
  ],
}, context);
const readHighlightText = rows => (Array.isArray(rows) ? rows : [])
  .map(item => typeof item === 'string' ? item : String(item?.text || ''))
  .filter(Boolean)
  .join(' ');
const teamContext = {
  combatData: {
    参战者: {
      team_player: ['唐三', '小舞', '戴沐白', '奥斯卡', '宁荣荣', '朱竹清', '马红俊'].map(name => ({ name })),
      team_enemy: ['风笑天', '火无双', '火舞', '玉天心', '水冰儿', '水月儿', '独孤雁'].map(name => ({ name })),
    },
  },
};
teamContext.units = [...teamContext.combatData.参战者.team_player, ...teamContext.combatData.参战者.team_enemy];
const teamDashboardResult = {
  combatData: teamContext.combatData,
  eventLedger: [
    { eventKind: 'hit_result', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', actionName: '蓝银突刺阵', finalActionName: '蓝银突刺阵', damage: 188, result: 'hit' },
    { eventKind: 'state_apply', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', actionName: '蓝银突刺阵', finalActionName: '蓝银突刺阵', stateName: '位移限制', result: 'applied' },
    { eventKind: 'counter', round: 1, actorName: '火舞', actorSide: 'enemy', targetName: '小舞', targetSide: 'player', actionName: '火影反扑', finalActionName: '火影反扑', damage: 46, result: 'success' },
    { eventKind: 'summon_create', round: 1, actorName: '宁荣荣', actorSide: 'player', summonName: '七宝幻光灵', actionName: '七宝召灵', finalActionName: '七宝召灵', result: 'created' },
    { eventKind: 'hit_result', round: 1, actorName: '玉天心', actorSide: 'enemy', targetName: '戴沐白', targetSide: 'player', actionName: '雷爪试探', finalActionName: '雷爪试探', damage: 18, result: 'hit' },
    { eventKind: 'hit_result', round: 1, actorName: '朱竹清', actorSide: 'player', targetName: '水月儿', targetSide: 'enemy', actionName: '幽影爪', finalActionName: '幽影爪', damage: 22, result: 'hit' },
    { eventKind: 'resource_change', round: 1, actorName: '奥斯卡', actorSide: 'player', targetName: '唐三', targetSide: 'player', result: 'gain', meta: { resource: '魂力', amount: 32, delta: 32 } },
  ],
};
const teamDashboardRows = sandbox.__LWCS_BUILD_BATTLE_ROUND_DASHBOARD__(teamDashboardResult, teamContext);
const teamDashboardHtml = sandbox.__LWCS_RENDER_BATTLE_ROUND_DASHBOARD__(teamDashboardRows);
const lowTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-low', nodeKind: 'action_decision', round: 1, actorName: '路人甲', targetName: '路人乙', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'dmg-low', parentNodeId: 'root-low', sourceNodeId: 'root-low', nodeKind: 'damage_settlement', round: 1, actorName: '路人甲', targetName: '路人乙', finalActionName: '普通攻击', result: 'hit', calculationTrace: [{ key: 'finalDamage', value: 1 }] },
]);
const escalatedTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-high', nodeKind: 'action_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'counter-high', parentNodeId: 'root-high', sourceNodeId: 'root-high', nodeKind: 'counter_action', round: 1, actorName: '夹具敌人', targetName: '夹具玩家', finalActionName: '敌方截击', result: 'success', calculationTrace: [{ key: 'finalDamage', value: 42 }] },
]);
const secondCounterTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-counter2', nodeKind: 'action_decision', round: 1, actorName: '唐凌雪', targetName: '韦小枫', initialActionName: '裂地冲拳', finalActionName: '裂地冲拳', targetScope: 'single' },
  { nodeId: 'counter-window-1', parentNodeId: 'root-counter2', sourceNodeId: 'root-counter2', nodeKind: 'counter_window', round: 1, actorName: '韦小枫', targetName: '唐凌雪', result: 'opened', reasonCode: 'COUNTER_WINDOW_OPENED', counterDepth: 1 },
  { nodeId: 'counter-action-1', parentNodeId: 'counter-window-1', sourceNodeId: 'counter-window-1', nodeKind: 'counter_action', round: 1, actorName: '韦小枫', targetName: '唐凌雪', finalActionName: '敌方截击', result: 'success', counterDepth: 1, calculationTrace: [{ key: 'finalDamage', value: 36 }] },
  { nodeId: 'counter-reaction-window-1', parentNodeId: 'counter-action-1', sourceNodeId: 'counter-action-1', nodeKind: 'reaction_window', round: 1, actorName: '唐凌雪', targetName: '韦小枫', result: 'opened', primaryOutcome: 'reaction_window_opened', counterDepth: 1 },
  { nodeId: 'counter-reaction-1', parentNodeId: 'counter-reaction-window-1', sourceNodeId: 'counter-action-1', nodeKind: 'reaction_decision', round: 1, actorName: '唐凌雪', targetName: '韦小枫', finalActionName: '伺机闪避', result: 'failed', primaryOutcome: 'reaction_failed', counterDepth: 1 },
  { nodeId: 'counter-window-2', parentNodeId: 'counter-action-1', sourceNodeId: 'counter-action-1', nodeKind: 'counter_window', round: 1, actorName: '唐凌雪', targetName: '韦小枫', result: 'opened', reasonCode: 'COUNTER_WINDOW_OPENED', counterDepth: 2 },
  { nodeId: 'counter-action-2', parentNodeId: 'counter-window-2', sourceNodeId: 'counter-window-2', nodeKind: 'counter_action', round: 1, actorName: '唐凌雪', targetName: '韦小枫', finalActionName: '收招反压', result: 'success', counterDepth: 2, calculationTrace: [{ key: 'finalDamage', value: 18 }] },
  { nodeId: 'counter-reaction-window-2', parentNodeId: 'counter-action-2', sourceNodeId: 'counter-action-2', nodeKind: 'reaction_window', round: 1, actorName: '韦小枫', targetName: '唐凌雪', result: 'opened', primaryOutcome: 'reaction_window_opened', counterDepth: 2 },
  { nodeId: 'counter-reaction-2', parentNodeId: 'counter-reaction-window-2', sourceNodeId: 'counter-action-2', nodeKind: 'reaction_decision', round: 1, actorName: '韦小枫', targetName: '唐凌雪', finalActionName: '收招转防', result: 'guarded_hit', primaryOutcome: 'reaction_succeeded', counterDepth: 2 },
]);
const replanTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-replan', nodeKind: 'action_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '毒牙牵制', finalActionName: '收招转防', discardedActionName: '毒牙牵制', replanReasonCode: 'NO_EFFECTIVE_OPENING', targetScope: 'single' },
  { nodeId: 'replan-child', parentNodeId: 'root-replan', nodeKind: 'replan_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '毒牙牵制', finalActionName: '收招转防', discardedActionName: '毒牙牵制', result: 'replanned', reasonCode: 'NO_EFFECTIVE_OPENING' },
]);
const calcTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-calc', nodeKind: 'action_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '裂地冲拳', finalActionName: '裂地冲拳', targetScope: 'single' },
  { nodeId: 'hit-calc', parentNodeId: 'root-calc', sourceNodeId: 'root-calc', nodeKind: 'hit_check', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '裂地冲拳', result: 'hit', primaryOutcome: 'damage' },
  {
    nodeId: 'dmg-calc',
    parentNodeId: 'hit-calc',
    sourceNodeId: 'root-calc',
    nodeKind: 'damage_settlement',
    round: 1,
    actorName: '夹具玩家',
    targetName: '夹具敌人',
    finalActionName: '裂地冲拳',
    result: 'hit',
    calculationTrace: [
      { key: 'baseFormulaText', value: 'floor(攻势值×威力倍率-防御值)' },
      { key: 'skillPower', value: 1.6 },
      { key: 'attackValue', value: 140 },
      { key: 'defenseValue', value: 42 },
      { key: 'baseDamage', value: 160 },
      { key: 'incomingDamage', value: 160 },
      { key: 'reactiveDamage', value: 120 },
      { key: 'defenseThreshold', value: 8 },
      { key: 'actualDefense', value: 42 },
      { key: 'elementDamageMult', value: 1.25 },
      { key: 'finalDamage', value: 120 },
    ],
  },
]);
const dodgeEvidenceTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-dodge-evidence', nodeKind: 'action_decision', round: 1, actorName: '唐凌雪', targetName: '韦小枫', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  {
    nodeId: 'hit-dodge-evidence',
    parentNodeId: 'root-dodge-evidence',
    sourceNodeId: 'root-dodge-evidence',
    nodeKind: 'hit_check',
    round: 1,
    actorName: '唐凌雪',
    targetName: '韦小枫',
    finalActionName: '普通攻击',
    result: 'miss',
    primaryOutcome: 'miss',
    calculationTrace: [
      { key: 'reactionAgility', value: 522 },
      { key: 'sourceAgility', value: 282 },
      { key: 'reactionPressure', value: 343 },
      { key: 'attackPressure', value: 135 },
      { key: 'dodgeRate', value: 0.419695 },
      { key: 'dodgeRoll', value: 0.45865 },
      { key: 'failureReason', value: 'dodged' },
    ],
  },
]);
const dodgeSuccessTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-dodge-success', nodeKind: 'action_decision', round: 1, actorName: '韦小枫', targetName: '唐凌雪', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  {
    nodeId: 'hit-dodge-success',
    parentNodeId: 'root-dodge-success',
    sourceNodeId: 'root-dodge-success',
    nodeKind: 'hit_check',
    round: 1,
    actorName: '韦小枫',
    targetName: '唐凌雪',
    finalActionName: '普通攻击',
    result: 'miss',
    primaryOutcome: 'miss',
    calculationTrace: [
      { key: 'reactionAgility', value: 282 },
      { key: 'sourceAgility', value: 522 },
      { key: 'reactionPressure', value: 125 },
      { key: 'attackPressure', value: 371.02 },
      { key: 'dodgeRate', value: 0.03 },
      { key: 'dodgeRoll', value: 0.001 },
      { key: 'failureReason', value: 'dodged' },
    ],
  },
]);
const defenseReactionTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-defense', nodeKind: 'action_decision', round: 1, actorName: '唐凌雪', targetName: '韦小枫', initialActionName: '裂地冲拳', finalActionName: '裂地冲拳', targetScope: 'single' },
  { nodeId: 'reaction-window-defense', parentNodeId: 'root-defense', sourceNodeId: 'root-defense', nodeKind: 'reaction_window', round: 1, actorName: '韦小枫', targetName: '唐凌雪', result: 'opened', primaryOutcome: 'reaction_window_opened' },
  { nodeId: 'reaction-defense', parentNodeId: 'reaction-window-defense', sourceNodeId: 'root-defense', nodeKind: 'reaction_decision', round: 1, actorName: '韦小枫', targetName: '唐凌雪', initialActionName: '毒牙牵制', finalActionName: '收招转防', discardedActionName: '毒牙牵制', result: 'replanned', primaryOutcome: 'action_committed' },
  { nodeId: 'hit-defense', parentNodeId: 'reaction-window-defense', sourceNodeId: 'root-defense', nodeKind: 'hit_check', round: 1, actorName: '唐凌雪', targetName: '韦小枫', finalActionName: '裂地冲拳', result: 'hit', primaryOutcome: 'damage' },
  {
    nodeId: 'dmg-defense',
    parentNodeId: 'hit-defense',
    sourceNodeId: 'root-defense',
    nodeKind: 'damage_settlement',
    round: 1,
    actorName: '唐凌雪',
    targetName: '韦小枫',
    finalActionName: '裂地冲拳',
    result: 'hit',
    calculationTrace: [
      { key: 'incomingDamage', value: 168 },
      { key: 'actualDefense', value: 64 },
      { key: 'defenseThreshold', value: 9 },
      { key: 'damageReduction', value: 0.25 },
      { key: 'activeReactionShield', value: 18 },
      { key: 'finalDamage', value: 92 },
    ],
  },
]);
const stateTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-state', nodeKind: 'action_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '毒牙牵制', finalActionName: '毒牙牵制', targetScope: 'single' },
  { nodeId: 'state-check', parentNodeId: 'root-state', sourceNodeId: 'root-state', nodeKind: 'state_check', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '毒牙牵制', result: 'applied', primaryOutcome: 'state_applied', calculationTrace: [{ key: 'stateName', value: '中毒' }, { key: 'successRate', value: 72 }, { key: 'roll', value: 31 }, { key: 'successRateBreakdown', value: '附着成功率：72%，控制基础72%，检定31 <= 72，通过' }] },
  { nodeId: 'state-settle', parentNodeId: 'state-check', sourceNodeId: 'root-state', nodeKind: 'state_settlement', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '毒牙牵制', result: 'applied', primaryOutcome: 'state_applied', calculationTrace: [{ key: 'stateName', value: '中毒' }, { key: 'duration', value: 2 }, { key: 'result', value: 'applied' }, { key: 'successRateBreakdown', value: '附着成功率：72%，控制基础72%，检定31 <= 72，通过' }] },
]);
const resistedStateTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-state-resisted', nodeKind: 'action_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '锁魄印', finalActionName: '锁魄印', targetScope: 'single' },
  { nodeId: 'state-check-resisted', parentNodeId: 'root-state-resisted', sourceNodeId: 'root-state-resisted', nodeKind: 'state_check', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '锁魄印', result: 'resisted', primaryOutcome: 'control_resisted', calculationTrace: [{ key: 'stateName', value: '位移限制' }, { key: 'successRate', value: 42 }, { key: 'roll', value: 67 }, { key: 'successRateBreakdown', value: '附着成功率：42%，控制基础78% - 抵抗36%，检定67 > 42，未通过' }] },
  { nodeId: 'state-settle-resisted', parentNodeId: 'state-check-resisted', sourceNodeId: 'root-state-resisted', nodeKind: 'state_settlement', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '锁魄印', result: 'resisted', primaryOutcome: 'control_resisted', calculationTrace: [{ key: 'stateName', value: '位移限制' }, { key: 'result', value: 'resisted' }, { key: 'successRateBreakdown', value: '附着成功率：42%，控制基础78% - 抵抗36%，检定67 > 42，未通过' }] },
]);
const immuneStateTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'root-state-immune', nodeKind: 'action_decision', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', initialActionName: '锁魄印', finalActionName: '锁魄印', targetScope: 'single' },
  { nodeId: 'state-check-immune', parentNodeId: 'root-state-immune', sourceNodeId: 'root-state-immune', nodeKind: 'state_check', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '锁魄印', result: 'immune', primaryOutcome: 'control_immune', calculationTrace: [{ key: 'stateName', value: '位移限制' }, { key: 'successRate', value: 42 }, { key: 'roll', value: 99 }, { key: 'successRateBreakdown', value: '附着成功率：42%，目标免疫，检定99 > 42，未通过' }] },
  { nodeId: 'state-settle-immune', parentNodeId: 'state-check-immune', sourceNodeId: 'root-state-immune', nodeKind: 'state_settlement', round: 1, actorName: '夹具玩家', targetName: '夹具敌人', finalActionName: '锁魄印', result: 'immune', primaryOutcome: 'control_immune', calculationTrace: [{ key: 'stateName', value: '位移限制' }, { key: 'result', value: 'immune' }, { key: 'successRateBreakdown', value: '附着成功率：42%，目标免疫，检定99 > 42，未通过' }] },
]);
const initialIntentTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  {
    nodeId: 'intent-queue-1',
    nodeKind: 'initial_intent',
    nodeLayer: 'intent',
    round: 1,
    actorName: '夹具玩家',
    targetName: '夹具敌人',
    initialActionName: '毒牙牵制',
    finalActionName: '',
    source: 'action_queue',
    result: 'planned',
    primaryOutcome: 'action_planned',
    targetScope: 'single',
    calculationTrace: [{ key: 'timingBucket', value: '10-19' }],
  },
  {
    nodeId: 'root-intent-1',
    nodeKind: 'action_decision',
    nodeLayer: 'intent',
    round: 1,
    actorName: '夹具玩家',
    targetName: '夹具敌人',
    initialActionName: '毒牙牵制',
    finalActionName: '收招转防',
    discardedActionName: '毒牙牵制',
    replanReasonText: '对手抢先压制',
    targetScope: 'single',
  },
]);
const teamTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'team-low-root', nodeKind: 'action_decision', round: 1, actorName: '风笑天', actorSide: 'enemy', targetName: '水月儿', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'team-low-dmg', parentNodeId: 'team-low-root', sourceNodeId: 'team-low-root', nodeKind: 'damage_settlement', round: 1, actorName: '风笑天', actorSide: 'enemy', targetName: '水月儿', targetSide: 'enemy', finalActionName: '普通攻击', result: 'hit', calculationTrace: [{ key: 'finalDamage', value: 1 }] },
  { nodeId: 'team-player-root', nodeKind: 'action_decision', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'team-player-dmg', parentNodeId: 'team-player-root', sourceNodeId: 'team-player-root', nodeKind: 'damage_settlement', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', finalActionName: '普通攻击', result: 'hit', calculationTrace: [{ key: 'finalDamage', value: 1 }] },
  { nodeId: 'team-player-hit-root', nodeKind: 'action_decision', round: 1, actorName: '火舞', actorSide: 'enemy', targetName: '小舞', targetSide: 'player', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'team-player-hit-dmg', parentNodeId: 'team-player-hit-root', sourceNodeId: 'team-player-hit-root', nodeKind: 'damage_settlement', round: 1, actorName: '火舞', actorSide: 'enemy', targetName: '小舞', targetSide: 'player', finalActionName: '普通攻击', result: 'hit', calculationTrace: [{ key: 'finalDamage', value: 1 }] },
  { nodeId: 'team-child-root', nodeKind: 'action_decision', round: 1, actorName: '玉天心', actorSide: 'enemy', targetName: '独孤雁', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'team-child-counter', parentNodeId: 'team-child-root', sourceNodeId: 'team-child-root', nodeKind: 'counter_action', round: 1, actorName: '独孤雁', actorSide: 'enemy', targetName: '玉天心', targetSide: 'enemy', finalActionName: '蛇影反咬', result: 'success', calculationTrace: [{ key: 'finalDamage', value: 35 }] },
]);
const nullWindowTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'null-window-root', nodeKind: 'action_decision', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'null-window-dmg', parentNodeId: 'null-window-root', sourceNodeId: 'null-window-root', nodeKind: 'damage_settlement', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', finalActionName: '普通攻击', result: 'hit', calculationTrace: [{ key: 'finalDamage', value: 12 }] },
  { nodeId: 'null-window-counter', parentNodeId: 'null-window-root', sourceNodeId: 'null-window-root', nodeKind: 'counter_window', round: 1, actorName: '风笑天', actorSide: 'enemy', targetName: '唐三', targetSide: 'player', result: 'skipped', reasonCode: 'NO_EFFECTIVE_OPENING', primaryOutcome: 'no_valid_window', failureReason: '未满足门槛' },
]);
const missedWindowTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__([
  { nodeId: 'missed-window-root', nodeKind: 'action_decision', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' },
  { nodeId: 'missed-window-counter', parentNodeId: 'missed-window-root', sourceNodeId: 'missed-window-root', nodeKind: 'counter_window', round: 1, actorName: '风笑天', actorSide: 'enemy', targetName: '唐三', targetSide: 'player', result: 'missed', reasonCode: 'COUNTER_WINDOW_MISSED', primaryOutcome: 'no_valid_window', failureReason: '速度不及' },
]);
const longTeamTraceNodes = [];
['风笑天', '火无双', '玉天心', '水冰儿'].forEach((actor, actorIndex) => {
  for (let round = 1; round <= 3; round += 1) {
    const rootId = `long-low-${round}-${actorIndex}`;
    longTeamTraceNodes.push({ nodeId: rootId, nodeKind: 'action_decision', round, actorName: actor, actorSide: 'enemy', targetName: '水月儿', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' });
    longTeamTraceNodes.push({ nodeId: `${rootId}-dmg`, parentNodeId: rootId, sourceNodeId: rootId, nodeKind: 'damage_settlement', round, actorName: actor, actorSide: 'enemy', targetName: '水月儿', targetSide: 'enemy', finalActionName: '普通攻击', result: 'hit', calculationTrace: [{ key: 'finalDamage', value: 1 }] });
  }
});
[
  ['long-player-1', 1, '唐三', 'player', '风笑天', 'enemy', '蓝银突刺阵', 188],
  ['long-player-hit-2', 2, '火舞', 'enemy', '小舞', 'player', '火影压制', 64],
  ['long-critical-3', 3, '戴沐白', 'player', '玉天心', 'enemy', '白虎烈光波', 132],
].forEach(([rootId, round, actorName, actorSide, targetName, targetSide, actionName, damage]) => {
  longTeamTraceNodes.push({ nodeId: rootId, nodeKind: 'action_decision', round, actorName, actorSide, targetName, targetSide, initialActionName: actionName, finalActionName: actionName, targetScope: 'single' });
  longTeamTraceNodes.push({ nodeId: `${rootId}-dmg`, parentNodeId: rootId, sourceNodeId: rootId, nodeKind: 'damage_settlement', round, actorName, actorSide, targetName, targetSide, finalActionName: actionName, result: 'hit', calculationTrace: [{ key: 'finalDamage', value: damage }] });
});
longTeamTraceNodes.push({ nodeId: 'long-counter-root', nodeKind: 'action_decision', round: 2, actorName: '独孤雁', actorSide: 'enemy', targetName: '火无双', targetSide: 'enemy', initialActionName: '普通攻击', finalActionName: '普通攻击', targetScope: 'single' });
longTeamTraceNodes.push({ nodeId: 'long-counter-action', parentNodeId: 'long-counter-root', sourceNodeId: 'long-counter-root', nodeKind: 'counter_action', round: 2, actorName: '火无双', actorSide: 'enemy', targetName: '独孤雁', targetSide: 'enemy', finalActionName: '烈火反扑', result: 'success', calculationTrace: [{ key: 'finalDamage', value: 38 }] });
const longTeamTraceHtml = sandbox.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__(longTeamTraceNodes);
const longTeamDashboardRows = sandbox.__LWCS_BUILD_BATTLE_ROUND_DASHBOARD__({
  combatData: teamContext.combatData,
  eventLedger: [
    { eventKind: 'hit_result', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', actionName: '蓝银突刺阵', finalActionName: '蓝银突刺阵', damage: 188, result: 'hit' },
    { eventKind: 'state_apply', round: 1, actorName: '唐三', actorSide: 'player', targetName: '风笑天', targetSide: 'enemy', actionName: '蓝银突刺阵', finalActionName: '蓝银突刺阵', stateName: '位移限制', result: 'applied' },
    { eventKind: 'summon_create', round: 1, actorName: '宁荣荣', actorSide: 'player', summonName: '七宝幻光灵', actionName: '七宝召灵', finalActionName: '七宝召灵', result: 'created' },
    { eventKind: 'hit_result', round: 2, actorName: '火舞', actorSide: 'enemy', targetName: '小舞', targetSide: 'player', actionName: '火影压制', finalActionName: '火影压制', damage: 64, result: 'hit' },
    { eventKind: 'counter', round: 2, actorName: '火无双', actorSide: 'enemy', targetName: '独孤雁', targetSide: 'enemy', actionName: '烈火反扑', finalActionName: '烈火反扑', damage: 38, result: 'success' },
    { eventKind: 'state_apply', round: 2, actorName: '火舞', actorSide: 'enemy', targetName: '小舞', targetSide: 'player', actionName: '火影压制', finalActionName: '火影压制', stateName: '灼伤', result: 'applied' },
    { eventKind: 'hit_result', round: 3, actorName: '戴沐白', actorSide: 'player', targetName: '玉天心', targetSide: 'enemy', actionName: '白虎烈光波', finalActionName: '白虎烈光波', damage: 132, result: 'hit' },
    { eventKind: 'hit_result', round: 3, actorName: '朱竹清', actorSide: 'player', targetName: '水月儿', targetSide: 'enemy', actionName: '幽冥突袭', finalActionName: '幽冥突袭', damage: 74, result: 'hit' },
    { eventKind: 'resource_change', round: 3, actorName: '奥斯卡', actorSide: 'player', targetName: '唐三', targetSide: 'player', result: 'gain', meta: { resource: '魂力', amount: 32, delta: 32 } },
  ],
}, teamContext);
const legacyRowsHtml = sandbox.__LWCS_RENDER_BATTLE_DECISION_ROWS_HTML__([
  { type: 'settlement', round: 1, 回合: 1, roundPhase: 'action_result', kind: 'hit_result', text: '夹具玩家的【裂地冲拳】命中夹具敌人，造成 120 点伤害。' },
]);
const aggregationVisibleText = sandbox.__LWCS_EXPORT_BATTLE_RECORD_VISIBLE_TEXT__({
  modeLabel: '聚合夹具',
  roundsExecuted: 2,
  logs: [],
  publicReportBlocks: [],
  resolutionTrace: [],
  decisionTrace: [],
  eventLedger: [
    { eventId: 'evt_tick_1', eventKind: 'state_tick', round: 2, targetName: '甲', result: 'damage', meta: { stateName: '中毒', amount: 20, resource: '生命值' } },
    { eventId: 'evt_tick_2', eventKind: 'state_tick', round: 2, targetName: '乙', result: 'damage', meta: { stateName: '中毒', amount: 25, resource: '生命值' } },
  ],
}, 'preview');
const publicStateTickBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_tick_public_1', eventKind: 'state_tick', round: 3, targetName: '甲', targetId: 'unit-a', result: 'damage', chainNodeId: 'node_tick_public_1', meta: { stateName: '中毒', amount: 20, resource: '生命值' } },
  { eventId: 'evt_tick_public_2', eventKind: 'state_tick', round: 3, targetName: '乙', targetId: 'unit-b', result: 'damage', chainNodeId: 'node_tick_public_2', meta: { stateName: '中毒', amount: 25, resource: '生命值' } },
], 8, context) || [];
const publicStateTickSerialized = publicStateTickBlocks.map(line => line?.text || '').join('\n');
const publicStateTickBadgeCount = publicStateTickBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'damage' && /甲|乙/.test(String(block.targetName || ''))).length;
const structuredDotLedger = [
  {
    eventId: 'evt_structured_dot_1', eventKind: 'state_tick', round: 3,
    actorName: '夹具玩家', actorId: 'player-1', targetName: '夹具敌人', targetId: 'enemy-1',
    actionName: '毒牙牵制', sourceActionName: '毒牙牵制', sourceActionId: 'action_poison_1',
    actionRole: 'STATE_TICK', actorControl: 'SYSTEM', result: 'damage', chainNodeId: 'node_structured_dot_1',
    appliedDamage: 31, meta: { stateName: '中毒', appliedDamage: 31, amount: 31, resource: '生命值' },
  },
];
const structuredDotBlocks = sandbox.__LWCS_BUILD_STRUCTURED_REPORT_BLOCKS__?.(
  structuredDotLedger,
  [],
  sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.(structuredDotLedger, 8, context) || [],
) || [];
const structuredDotBlock = structuredDotBlocks.find(block => block?.blockType === 'STATE_TICK');
const structuredProjectionLedger = [
  { eventId: 'evt_multi_start', eventKind: 'action_start', round: 8, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '三段连斩', actionId: 'action_multi_1', actionRole: 'ACTIVE', result: 'declared' },
  { eventId: 'evt_multi_hit_1', eventKind: 'hit_result', round: 8, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '三段连斩', actionId: 'action_multi_1', sourceActionId: 'action_multi_1', actionRole: 'ACTIVE', result: 'hit', appliedDamage: 10, meta: { appliedDamage: 10 } },
  { eventId: 'evt_multi_hit_2', eventKind: 'hit_result', round: 8, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '三段连斩', actionId: 'action_multi_1', sourceActionId: 'action_multi_1', actionRole: 'ACTIVE', result: 'hit', appliedDamage: 20, meta: { appliedDamage: 20 } },
  { eventId: 'evt_multi_hit_3', eventKind: 'hit_result', round: 8, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '三段连斩', actionId: 'action_multi_1', sourceActionId: 'action_multi_1', actionRole: 'ACTIVE', result: 'hit', appliedDamage: 30, meta: { appliedDamage: 30 } },
  { eventId: 'evt_summon_start', eventKind: 'action_start', round: 9, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '召灵术', actionId: 'action_summon_1', actionRole: 'ACTIVE', result: 'declared' },
  { eventId: 'evt_summon_create', eventKind: 'summon_create', round: 9, actorName: '夹具玩家', actionName: '召灵术', actionId: 'action_summon_1', sourceActionId: 'action_summon_1', actionRole: 'ACTIVE', result: 'created', meta: { summonName: '霜狼#1', summonMode: '协同攻击' } },
  { eventId: 'evt_internal_state_start', eventKind: 'action_start', round: 10, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '破甲印', actionId: 'action_state_1', actionRole: 'ACTIVE', result: 'declared' },
  { eventId: 'evt_internal_state', eventKind: 'state_apply', round: 10, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '破甲印', actionId: 'action_state_1', sourceActionId: 'action_state_1', actionRole: 'ACTIVE', result: 'applied', duration: 2, meta: { stateName: 'def修正' } },
  { eventId: 'evt_resisted_start', eventKind: 'action_start', round: 11, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '锁魄印', actionId: 'action_resisted_1', actionRole: 'ACTIVE', result: 'declared' },
  { eventId: 'evt_resisted_state', eventKind: 'state_apply', round: 11, actorName: '夹具玩家', targetName: '夹具敌人', actionName: '锁魄印', actionId: 'action_resisted_1', sourceActionId: 'action_resisted_1', actionRole: 'ACTIVE', result: 'resisted', duration: 2, meta: { stateName: '位移限制' } },
  { eventId: 'evt_exchange_a_start', eventKind: 'action_start', round: 12, actorName: '甲', targetName: '乙', targetIds: ['乙'], actionName: '普通攻击', actionId: 'action_exchange_a', actionRole: 'ACTIVE', result: 'declared' },
  { eventId: 'evt_exchange_a_dodge', eventKind: 'dodge', round: 12, actorName: '乙', targetName: '甲', targetIds: ['甲'], actionName: '闪避', actionId: 'action_exchange_a', sourceActionId: 'action_exchange_a', actionRole: 'REACTION', result: 'evaded' },
  { eventId: 'evt_exchange_a_counter_miss', eventKind: 'hit_result', round: 12, actorName: '乙', targetName: '甲', targetIds: ['甲'], actionName: '普通攻击', actionId: 'counter_exchange_a', sourceActionId: 'action_exchange_a', actionRole: 'COUNTER', result: 'miss', appliedDamage: 0, meta: { appliedDamage: 0 } },
  { eventId: 'evt_exchange_b_start', eventKind: 'action_start', round: 12, actorName: '乙', targetName: '甲', targetIds: ['甲'], actionName: '普通攻击', actionId: 'action_exchange_b', actionRole: 'ACTIVE', result: 'declared' },
  { eventId: 'evt_exchange_b_hit', eventKind: 'hit_result', round: 12, actorName: '乙', targetName: '甲', targetIds: ['甲'], actionName: '普通攻击', actionId: 'action_exchange_b', sourceActionId: 'action_exchange_b', actionRole: 'ACTIVE', result: 'hit', appliedDamage: 63, meta: { appliedDamage: 63 } },
];
const structuredProjectionBlocks = sandbox.__LWCS_BUILD_STRUCTURED_REPORT_BLOCKS__?.(structuredProjectionLedger, [], [{
  round: 10,
  blocks: [{ type: 'badge', kind: 'state', name: 'def修正', targetName: '夹具敌人', sourceEventId: 'evt_internal_state' }],
}]) || [];
const structuredMultiBlock = structuredProjectionBlocks.find(block => block?.round === 8 && block?.blockType === 'ACTION_RESOLVED');
const structuredSummonBlock = structuredProjectionBlocks.find(block => block?.round === 9 && block?.blockType === 'SUMMON_ACTION');
const structuredStateBlock = structuredProjectionBlocks.find(block => block?.round === 10 && block?.blockType === 'ACTION_RESOLVED');
const structuredResistedRound = structuredProjectionBlocks.find(block => block?.round === 11 && block?.blockType === 'ROUND_SUMMARY');
const structuredExchangeBlocks = structuredProjectionBlocks.filter(block => block?.round === 12 && block?.blockType !== 'ROUND_SUMMARY');
const structuredExchangeFirst = structuredExchangeBlocks.find(block => block?.actionGroupId === 'action_exchange_a');
const structuredExchangeSecond = structuredExchangeBlocks.find(block => block?.actionGroupId === 'action_exchange_b');
const normalizedFinalSummary = sandbox.__LWCS_BATTLE_RUNTIME__?.buildFinalSummary?.([], [], {
  round: 1,
  team_player: [{ name: '夹具玩家', hp: 100, hp_max: 100, sp: 50, sp_max: 100, vit: 80, vit_max: 100, men: 20, men_max: 20, 状态效果: [{ name: 'agi修正', duration: 1 }] }],
  team_enemy: [{ name: '夹具敌人', hp: 0, hp_max: 100, sp: 0, sp_max: 100, vit: 0, vit_max: 100, men: 0, men_max: 20, actionState: '失去战斗力', 状态效果: [] }],
}, null)?.finalBattleReport;
const publicShieldBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_shield_public_1', eventKind: 'shield_create', round: 4, actorName: '宁荣荣', targetName: '唐三', targetId: 'unit-tangsan', actionName: '七宝护身', chainNodeId: 'node_shield_public_1', result: 'created', meta: { amount: 180, shieldValue: 180 } },
], 8, context) || [];
const publicShieldSerialized = publicShieldBlocks.map(line => line?.text || '').join('\n');
const publicShieldBadges = publicShieldBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'shield');
const publicShieldHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__(publicShieldBlocks[0]?.blocks || [], context);
const publicGroupShieldBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_group_shield_public_1', eventKind: 'shield_create', round: 4, actorName: '宁荣荣', targetName: '唐三', targetId: 'unit-tangsan', actionName: '七宝护阵', chainNodeId: 'node_group_shield_public_1', result: 'created', meta: { amount: 160, shieldValue: 160 } },
  { eventId: 'evt_group_shield_public_2', eventKind: 'shield_create', round: 4, actorName: '宁荣荣', targetName: '小舞', targetId: 'unit-xiaowu', actionName: '七宝护阵', chainNodeId: 'node_group_shield_public_2', result: 'created', meta: { amount: 140, shieldValue: 140 } },
], 8, context) || [];
const publicGroupShieldSerialized = publicGroupShieldBlocks.map(line => line?.text || '').join('\n');
const publicGroupShieldBadges = publicGroupShieldBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'shield');
const publicGroupShieldHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__(publicGroupShieldBlocks[0]?.blocks || [], context);
const publicResourceBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_resource_public_1', eventKind: 'resource_change', round: 5, actorName: '奥斯卡', targetName: '唐三', targetId: 'unit-tangsan', actionName: '恢复香肠', chainNodeId: 'node_resource_public_1', result: 'gain', meta: { resource: '魂力', amount: 35, delta: 35 } },
], 8, context) || [];
const publicResourceBadges = publicResourceBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'resource');
const publicResourceHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__(publicResourceBlocks[0]?.blocks || [], context);
const publicGroupHealBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_group_heal_public_1', eventKind: 'resource_change', round: 5, actorName: '奥斯卡', targetName: '唐三', targetId: 'unit-tangsan', actionName: '恢复香肠阵', chainNodeId: 'node_group_heal_public_1', result: 'gain', meta: { resource: '生命值', amount: 90, delta: 90 } },
  { eventId: 'evt_group_heal_public_2', eventKind: 'resource_change', round: 5, actorName: '奥斯卡', targetName: '小舞', targetId: 'unit-xiaowu', actionName: '恢复香肠阵', chainNodeId: 'node_group_heal_public_2', result: 'gain', meta: { resource: '生命值', amount: 75, delta: 75 } },
], 8, context) || [];
const publicGroupHealSerialized = publicGroupHealBlocks.map(line => line?.text || '').join('\n');
const publicGroupHealBadges = publicGroupHealBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'heal');
const publicGroupHealHtml = sandbox.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__(publicGroupHealBlocks.flatMap(line => Array.isArray(line?.blocks) ? line.blocks : []), context);
const publicStateResistedBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_state_resisted_public_1', eventKind: 'state_apply', round: 6, actorName: '唐凌雪', targetName: '韦小枫', targetId: 'unit-weixiaofeng', actionName: '锁魄印', chainNodeId: 'node_state_resisted_public_1', result: 'resisted', meta: { stateName: '位移限制', successRate: 0.42, roll: 0.67 } },
], 8, context) || [];
const publicStateResistedSerialized = publicStateResistedBlocks.map(line => line?.text || '').join('\n');
const publicStateResistedBadges = publicStateResistedBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'state');
const publicStateImmuneBlocks = sandbox.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__?.([
  { eventId: 'evt_state_immune_public_1', eventKind: 'state_apply', round: 7, actorName: '唐凌雪', targetName: '韦小枫', targetId: 'unit-weixiaofeng', actionName: '锁魄印', chainNodeId: 'node_state_immune_public_1', result: 'immune', meta: { stateName: '位移限制', successRate: 0.42, roll: 0.99 } },
], 8, context) || [];
const publicStateImmuneSerialized = publicStateImmuneBlocks.map(line => line?.text || '').join('\n');
const publicStateImmuneBadges = publicStateImmuneBlocks
  .flatMap(line => Array.isArray(line?.blocks) ? line.blocks : [])
  .filter(block => block?.type === 'badge' && block.kind === 'state');

const summary = {
  skillButtonRendered: /data-battle-report-skill="1"/.test(skillHtml?.html || ''),
  skillActorAttached: /data-actor-name="夹具玩家"/.test(skillHtml?.html || ''),
  secondSkillSlotAttached: /data-skill-slot="第2魂技"/.test(skillHtml?.html || ''),
  stateTagRendered: /class="combat-state-tag"/.test(stateApplyHtml?.html || ''),
  stateSubtextRendered: /class="combat-subtext"/.test(stateApplyHtml?.html || ''),
  stateTickTagRendered: /class="combat-state-tag"/.test(stateTickHtml?.html || ''),
  stateTickSubtextRendered: /class="combat-subtext"/.test(stateTickHtml?.html || ''),
  noEscapedSkillButtonLeak: !/&lt;button|class=&quot;battle-preview-report-skill/.test(stateTickHtml?.html || ''),
  publicBlocksBadgeRendered: /data-report-badge="1"/.test(blockHtml?.html || ''),
  publicBlocksBadgeHasTarget: /data-target-name="夹具敌人"/.test(blockHtml?.html || ''),
  publicBlocksBadgeHasSource: /data-source-(?:event|node)-id="[^"]+"/.test(blockHtml?.html || ''),
  publicBlocksBadgeRailRendered: /battle-preview-report-line/.test(blockHtml?.html || '') && /battle-preview-report-text/.test(blockHtml?.html || '') && /battle-preview-report-badges/.test(blockHtml?.html || ''),
  publicBlocksNotStringOnly: publicBlocks.some(block => block?.type === 'text') && publicBlocks.some(block => block?.type === 'badge'),
  publicHitAstFirstRendered: publicHitBlocks.length === 1 && publicHitBlocks[0]?.projectionSource === 'hit_result_ast' && /夹具玩家/.test(publicHitSerialized || '') && /裂地冲拳/.test(publicHitSerialized || '') && /夹具敌人/.test(publicHitSerialized || '') && /120/.test(publicHitSerialized || ''),
  publicHitDamageBadgeHasSource: publicHitBadges.length === 1 && publicHitBadges[0]?.sourceEventId === 'evt_hit_public_1' && publicHitBadges[0]?.sourceNodeId === 'node_damage_public_1',
  publicHitDamageBadgeRendered: /battle-preview-report-badge--damage/.test(publicHitHtml?.html || '') && /data-target-name="夹具敌人"/.test(publicHitHtml?.html || '') && /data-source-event-id="evt_hit_public_1"/.test(publicHitHtml?.html || '') && /data-source-node-id="node_damage_public_1"/.test(publicHitHtml?.html || ''),
  roundDashboardBuilt: Array.isArray(dashboardRows) && dashboardRows.length === 1,
  roundDashboardHasHpDelta: Number(dashboardRows?.[0]?.enemyHpDelta || 0) === -127 && Number(dashboardRows?.[0]?.playerHpDelta || 0) === -42,
  roundDashboardHasResourceDelta: (dashboardRows?.[0]?.resourceDeltas || []).some(item => item.actorName === '夹具玩家' && item.resourceName === '魂力' && Number(item.value) === -120) && (dashboardRows?.[0]?.resourceDeltas || []).some(item => item.actorName === '夹具玩家' && item.resourceName === '精神力' && Number(item.value) === -30),
  roundDashboardReadsResourceChange: (dashboardRows?.[0]?.resourceDeltas || []).some(item => item.actorName === '夹具敌人' && item.resourceName === '魂力' && Number(item.value) === -50),
  roundDashboardHasHighlight: /防反|重创|中毒/.test(readHighlightText(dashboardRows?.[0]?.highlights)),
  roundDashboardRendered: /class="battle-round-dashboard"/.test(dashboardHtml || ''),
  roundDashboardHpBarsRendered: /battle-round-dashboard-delta-fill/.test(dashboardHtml || '') && /battle-round-dashboard-delta-text/.test(dashboardHtml || '') && /data-delta-ratio="/.test(dashboardHtml || ''),
  roundDashboardResourceRendered: /battle-round-dashboard-resources/.test(dashboardHtml || '') && /夹具玩家 魂力 -120/.test(dashboardHtml || ''),
  roundDashboardSingleKeyFact: (dashboardRows?.[0]?.highlights || []).length === 1,
  roundDashboardNoUnsupportedPressureText: !/pushHighlight\(round, `\$\{actor\}(?:持续施压|暂缓出手)/.test(code),
  roundDashboardKeepsQuietRounds: JSON.stringify(continuousDashboardRows.map(item => item.round)) === JSON.stringify([1, 2, 3]),
  roundDashboardRecoveryIsPositive: Number(continuousDashboardRows.find(item => item.round === 3)?.playerHpDelta || 0) === 35,
  roundDashboardHpResourceChangeNotShownAsResource: !(continuousDashboardRows.find(item => item.round === 3)?.resourceDeltas || []).some(item => /生命|HP|血/i.test(String(item?.resourceName || ''))),
  teamDashboard7v7Built: Array.isArray(teamDashboardRows) && teamDashboardRows.length === 1,
  teamDashboardHpDeltaAggregated: Number(teamDashboardRows?.[0]?.playerHpDelta || 0) === -64 && Number(teamDashboardRows?.[0]?.enemyHpDelta || 0) === -210,
  teamDashboardHighlightCapped: (teamDashboardRows?.[0]?.highlights || []).length === 1,
  teamDashboardKeepsCriticalHighlights: /唐三.*蓝银突刺阵|重创/.test(readHighlightText(teamDashboardRows?.[0]?.highlights)),
  teamDashboardRendered: /battle-round-dashboard/.test(teamDashboardHtml || '') && /我方 -64 HP/.test(teamDashboardHtml || '') && /敌方 -210 HP/.test(teamDashboardHtml || ''),
  teamActionLowNpcCollapsed: /<details class="battle-preview-trace-row[^>]*data-event-weight="low"(?![^>]* open)[^>]*>[\s\S]*?风笑天 执行【普通攻击】 -&gt; 水月儿/.test(teamTraceHtml || ''),
  teamActionPlayerOpen: /<details class="battle-preview-trace-row[^>]*data-event-weight="medium"[^>]* open>[\s\S]*?唐三 执行【普通攻击】 -&gt; 风笑天/.test(teamTraceHtml || ''),
  teamActionPlayerHitOpen: /<details class="battle-preview-trace-row[^>]*data-child-escalated="1"[^>]* open>[\s\S]*?火舞 执行【普通攻击】 -&gt; 小舞/.test(teamTraceHtml || ''),
  teamActionChildEscalationOpen: /<details class="battle-preview-trace-row[^>]*data-child-escalated="1"[^>]* open>[\s\S]*?玉天心 执行【普通攻击】 -&gt; 独孤雁/.test(teamTraceHtml || ''),
  nullCounterWindowSilent: !/防反窗口|未满足门槛|NO_EFFECTIVE_OPENING|no_valid_window/.test(nullWindowTraceHtml || ''),
  missedCounterWindowVisible: /防反窗口/.test(missedWindowTraceHtml || '') && /速度不及|错失|失败/.test(missedWindowTraceHtml || ''),
  longTeamTraceStressBuilt: (longTeamTraceHtml.match(/battle-preview-trace-card--action-chain/g) || []).length >= 16 && /第3回合/.test(longTeamTraceHtml || ''),
  longTeamTraceLowCollapsed: (longTeamTraceHtml.match(/data-event-weight="low"(?![^>]* open)/g) || []).length >= 10,
  longTeamTracePlayerAndCriticalOpen: /<details class="battle-preview-trace-row[^>]* open>[\s\S]*?唐三 执行【蓝银突刺阵】/.test(longTeamTraceHtml || ''),
  longTeamTracePlayerHitOpen: /data-child-escalated="1"[^>]* open>[\s\S]*?火舞 执行【火影压制】 -&gt; 小舞/.test(longTeamTraceHtml || ''),
  longTeamTraceCounterEscalated: /data-child-escalated="1"[^>]* open>[\s\S]*?独孤雁 执行【普通攻击】 -&gt; 火无双/.test(longTeamTraceHtml || ''),
  longTeamDashboardThreeRounds: Array.isArray(longTeamDashboardRows) && longTeamDashboardRows.length === 3,
  longTeamDashboardHighlightsCapped: Array.isArray(longTeamDashboardRows) && longTeamDashboardRows.every(row => (row.highlights || []).length <= 1),
  longTeamDashboardKeepsRoundHighlights: (longTeamDashboardRows || []).some(row => Number(row.round) === 1 && /蓝银突刺阵|位移限制|召出/.test(readHighlightText(row.highlights))) && (longTeamDashboardRows || []).some(row => Number(row.round) === 2 && /防反|灼伤|火影压制/.test(readHighlightText(row.highlights))) && (longTeamDashboardRows || []).some(row => Number(row.round) === 3 && /白虎烈光波|幽冥突袭/.test(readHighlightText(row.highlights))),
  lowActionChainCollapsed: /data-smart-collapse="1"/.test(lowTraceHtml || '') && /data-event-weight="low"/.test(lowTraceHtml || '') && !/data-event-weight="low"[^>]* open/.test(lowTraceHtml || ''),
  actionChainTimelineRendered: /battle-preview-trace-timeline/.test(calcTraceHtml || '') && /battle-preview-trace-node/.test(calcTraceHtml || ''),
  actionChainTimelineNodeKindsRendered: /data-trace-node-kind="check"/.test(calcTraceHtml || '') && /data-trace-node-kind="settlement"/.test(calcTraceHtml || '') && /data-trace-node-kind="reaction"/.test(defenseReactionTraceHtml || '') && /data-trace-node-kind="intent"/.test(initialIntentTraceHtml || '') && /data-trace-node-kind="counter"/.test(secondCounterTraceHtml || ''),
  actionChainTimelineKindNotTextRegexClassified: !/识别时间线行类型|初始意图\|原计划\|临场变招/.test(code),
  childEscalationOpensParent: /data-child-escalated="1"/.test(escalatedTraceHtml || '') && /data-smart-collapse="1"[^>]* open/.test(escalatedTraceHtml || ''),
  secondCounterRendered: /反防反窗口/.test(secondCounterTraceHtml || '') && /反防反分支/.test(secondCounterTraceHtml || '') && /收招反压/.test(secondCounterTraceHtml || ''),
  secondCounterEscalatesParent: /data-child-escalated="1"/.test(secondCounterTraceHtml || '') && /data-smart-collapse="1"[^>]* open/.test(secondCounterTraceHtml || ''),
  counterSecondaryReactionRendered: /反应窗口：唐凌雪捕捉到[\s\S]*?【韦小枫的敌方截击】/.test(secondCounterTraceHtml || '') && /反应：唐凌雪以/.test(secondCounterTraceHtml || '') && /伺机闪避/.test(secondCounterTraceHtml || '') && /反应：韦小枫以/.test(secondCounterTraceHtml || '') && /收招转防/.test(secondCounterTraceHtml || ''),
  replanDecisionRendered: /原计划/.test(replanTraceHtml || '') && /毒牙牵制/.test(replanTraceHtml || '') && /没有合适出手窗口/.test(replanTraceHtml || '') && /改为/.test(replanTraceHtml || '') && /收招转防/.test(replanTraceHtml || '') && !/临场变招|战局变化后调整动作/.test(replanTraceHtml || ''),
  actionChainCalculationRendered: /命中检定/.test(calcTraceHtml || '') && /伤害结算/.test(calcTraceHtml || '') && /计算明细/.test(calcTraceHtml || '') && /入参[\s\S]*?>160</.test(calcTraceHtml || '') && /元素承伤[\s\S]*?>1\.25</.test(calcTraceHtml || ''),
  actionChainRawFormulaHidden: !/基础公式|floor\(攻势值/.test(calcTraceHtml || ''),
  actionChainDamageEvidenceFocusable:
    (calcTraceHtml.match(/class="battle-trace-number-evidence"/g) || []).length >= 8 &&
    /data-source="本次动作完成全部命中、防御、护盾与伤害修正后实际扣除的生命值"/.test(calcTraceHtml || ''),
  dodgeEvidenceNumbersRendered:
    /速度[\s\S]*?>522<[\s\S]*?>282<[\s\S]*?反应压力[\s\S]*?>343<[\s\S]*?>135<[\s\S]*?成功率[\s\S]*?>42%<[\s\S]*?判定[\s\S]*?>46%<[\s\S]*?失败/.test(dodgeEvidenceTraceHtml || ''),
  dodgeEvidenceNodesFocusable:
    (dodgeEvidenceTraceHtml.match(/class="battle-trace-number-evidence"/g) || []).length === 6 &&
    (dodgeEvidenceTraceHtml.match(/tabindex="0"/g) || []).length === 6 &&
    /data-source="522：基础522/.test(dodgeEvidenceTraceHtml || '') &&
    /data-source="42%：18% \+（反应占比/.test(dodgeEvidenceTraceHtml || '') &&
    /aria-label="闪避成功率：42%。来源：/.test(dodgeEvidenceTraceHtml || ''),
  reactionTypeInternalCodeHidden:
    /EVADE: '闪避'/.test(code) &&
    !/类型：EVADE/.test(dodgeEvidenceTraceHtml || ''),
  dodgeEvidenceTerminalUsesSameRoll:
    /成功率[\s\S]*?>3%<[\s\S]*?判定[\s\S]*?>0%<[\s\S]*?成功/.test(dodgeSuccessTraceHtml || '') &&
    !/判定[\s\S]*?>0%<[\s\S]*?失败/.test(dodgeSuccessTraceHtml || ''),
  defenseReactionJudgementRendered: /反应：韦小枫以/.test(defenseReactionTraceHtml || '') && /收招转防/.test(defenseReactionTraceHtml || '') && /防御判定：/.test(defenseReactionTraceHtml || '') && /有效防御[\s\S]*?>64</.test(defenseReactionTraceHtml || '') && /破防阈值[\s\S]*?>9</.test(defenseReactionTraceHtml || '') && /最终承伤[\s\S]*?>92</.test(defenseReactionTraceHtml || ''),
  stateCheckSettlementRendered: /状态检定/.test(stateTraceHtml || '') && /状态结算/.test(stateTraceHtml || '') && /中毒/.test(stateTraceHtml || '') && /持续[\s\S]*?>2<[\s\S]*?回合/.test(stateTraceHtml || '') && /状态判定：附着成功率[\s\S]*?>72%<[\s\S]*?判定[\s\S]*?>31%<[\s\S]*?通过/.test(stateTraceHtml || ''),
  resistedStateCheckSettlementRendered: /状态检定/.test(resistedStateTraceHtml || '') && /状态结算/.test(resistedStateTraceHtml || '') && /位移限制/.test(resistedStateTraceHtml || '') && /抵住/.test(resistedStateTraceHtml || '') && /附着成功率：42%/.test(resistedStateTraceHtml || '') && /检定67 (?:>|&gt;) 42/.test(resistedStateTraceHtml || ''),
  immuneStateCheckSettlementRendered: /状态检定/.test(immuneStateTraceHtml || '') && /状态结算/.test(immuneStateTraceHtml || '') && /位移限制/.test(immuneStateTraceHtml || '') && /免疫/.test(immuneStateTraceHtml || '') && /附着成功率：42%/.test(immuneStateTraceHtml || '') && /检定99 (?:>|&gt;) 42/.test(immuneStateTraceHtml || ''),
  initialIntentRendered: /初始意图/.test(initialIntentTraceHtml || '') && /毒牙牵制/.test(initialIntentTraceHtml || '') && /行动窗口 10-19/.test(initialIntentTraceHtml || '') && /原计划/.test(initialIntentTraceHtml || '') && /收招转防/.test(initialIntentTraceHtml || ''),
  legacySectionsRemoved: !/data-legacy-trace-section|目标与行动|应招与再判定|<summary class="battle-preview-trace-section-title">结算链<\/summary>/.test(legacyRowsHtml || ''),
  statusTickAggregationRendered: /回合收束|状态结算聚合/.test(aggregationVisibleText || ''),
  statusTickAggregationKeepsChildren: /甲损失 20 点生命值/.test(aggregationVisibleText || '') && /乙损失 25 点生命值/.test(aggregationVisibleText || ''),
  publicStateTickAggregationRendered: /回合收束/.test(publicStateTickSerialized || '') && /2 个目标共损失 45 点生命值/.test(publicStateTickSerialized || ''),
  publicStateTickAggregationKeepsTargetBadges: publicStateTickBadgeCount === 2,
  structuredDotKeepsStateTickSource: structuredDotBlock?.facts?.length === 1 && structuredDotBlock.facts[0]?.factType === 'STATE_TICK' && structuredDotBlock.facts[0]?.actionRole === 'STATE_TICK' && structuredDotBlock.facts[0]?.sourceActionId === 'action_poison_1',
  structuredDotNarrationNotDirectHit: /持续影响/.test(String(structuredDotBlock?.outcomeSummary || '')) && /31/.test(String(structuredDotBlock?.outcomeSummary || '')) && !/直接造成|施展.*造成/.test(String(structuredDotBlock?.outcomeSummary || '')),
  structuredMultiHitKeepsAllSegments:
    /共命中 3 段/.test(String(structuredMultiBlock?.outcomeSummary || '')) &&
    /造成 60 点伤害/.test(String(structuredMultiBlock?.outcomeSummary || '')) &&
    /分段 10、20、30/.test(String(structuredMultiBlock?.outcomeSummary || '')) &&
    (structuredMultiBlock?.badges || []).filter(badge => badge?.kind === 'damage').length === 3,
  structuredPrimaryTargetsNotContaminated:
    JSON.stringify(structuredExchangeFirst?.targetIds || []) === JSON.stringify(['乙']) &&
    JSON.stringify(structuredExchangeSecond?.targetIds || []) === JSON.stringify(['甲']),
  structuredCounterMissHasCounterSemantics:
    /乙以【普通攻击】反击甲，但未能命中/.test(String(structuredExchangeFirst?.outcomeSummary || '')),
  structuredLaterActiveHitDistinct:
    /乙以【普通攻击】命中甲，造成 63 点伤害/.test(String(structuredExchangeSecond?.outcomeSummary || '')),
  structuredSummonUsesRealName:
    /霜狼#1/.test(String(structuredSummonBlock?.outcomeSummary || '')) &&
    !/召唤物【目标】/.test(String(structuredSummonBlock?.outcomeSummary || '')),
  structuredStateNameIsPlayerFacing:
    /防御调整/.test(String(structuredStateBlock?.outcomeSummary || '')) &&
    !/def修正/.test(String(structuredStateBlock?.outcomeSummary || '')) &&
    (structuredStateBlock?.badges || []).some(badge => badge?.name === '防御调整'),
  resistedStateCreatesNoRoundWindow: !/位移限制/.test(String(structuredResistedRound?.nextWindow || '')),
  finalSummaryStateNameIsPlayerFacing:
    /敏捷调整/.test(String(normalizedFinalSummary?.text || '')) &&
    !/agi修正/.test(JSON.stringify(normalizedFinalSummary || {})),
  publicShieldAstFirstRendered: publicShieldBlocks.length === 1 && publicShieldBlocks[0]?.projectionSource === 'shield_create_ast' && /宁荣荣施展【七宝护身】，为唐三张开 180 点护盾/.test(publicShieldSerialized || ''),
  publicShieldBadgeHasTarget: publicShieldBadges.length === 1 && publicShieldBadges[0]?.targetName === '唐三' && publicShieldBadges[0]?.targetId === 'unit-tangsan',
  publicShieldBadgeHasSource: publicShieldBadges.length === 1 && publicShieldBadges[0]?.sourceEventId === 'evt_shield_public_1' && publicShieldBadges[0]?.sourceNodeId === 'node_shield_public_1',
  publicShieldBadgeRendered: /battle-preview-report-badge--shield/.test(publicShieldHtml?.html || '') && /data-target-name="唐三"/.test(publicShieldHtml?.html || ''),
  publicGroupShieldAstFirstRendered: publicGroupShieldBlocks.length === 1 && publicGroupShieldBlocks[0]?.projectionSource === 'shield_create_ast' && /宁荣荣施展【七宝护阵】/.test(publicGroupShieldSerialized || '') && /唐三/.test(publicGroupShieldSerialized || '') && /小舞/.test(publicGroupShieldSerialized || ''),
  publicGroupShieldBadgesHaveTargets: publicGroupShieldBadges.length === 2 && publicGroupShieldBadges.some(block => block.targetName === '唐三' && block.targetId === 'unit-tangsan' && block.sourceEventId === 'evt_group_shield_public_1' && block.sourceNodeId === 'node_group_shield_public_1') && publicGroupShieldBadges.some(block => block.targetName === '小舞' && block.targetId === 'unit-xiaowu' && block.sourceEventId === 'evt_group_shield_public_2' && block.sourceNodeId === 'node_group_shield_public_2'),
  publicGroupShieldBadgesRendered: /data-target-name="唐三"/.test(publicGroupShieldHtml?.html || '') && /data-target-name="小舞"/.test(publicGroupShieldHtml?.html || '') && /data-source-event-id="evt_group_shield_public_1"/.test(publicGroupShieldHtml?.html || '') && /data-source-event-id="evt_group_shield_public_2"/.test(publicGroupShieldHtml?.html || ''),
  publicResourceBadgeRendered: /battle-preview-report-badge--resource/.test(publicResourceHtml?.html || '') && /\+35 魂力/.test(publicResourceHtml?.html || ''),
  publicResourceBadgeHasTarget: publicResourceBadges.length === 1 && publicResourceBadges[0]?.targetName === '唐三' && publicResourceBadges[0]?.targetId === 'unit-tangsan',
  publicResourceBadgeHasSource: publicResourceBadges.length === 1 && publicResourceBadges[0]?.sourceEventId === 'evt_resource_public_1' && publicResourceBadges[0]?.sourceNodeId === 'node_resource_public_1',
  publicGroupHealAstFirstRendered: publicGroupHealBlocks.length === 2 && publicGroupHealBlocks.every(line => line?.projectionSource === 'resource_change_ast') && /唐三/.test(publicGroupHealSerialized || '') && /小舞/.test(publicGroupHealSerialized || ''),
  publicGroupHealBadgesHaveTargets: publicGroupHealBadges.length === 2 && publicGroupHealBadges.some(block => block.targetName === '唐三' && block.targetId === 'unit-tangsan' && block.sourceEventId === 'evt_group_heal_public_1' && block.sourceNodeId === 'node_group_heal_public_1' && Number(block.value) === 90) && publicGroupHealBadges.some(block => block.targetName === '小舞' && block.targetId === 'unit-xiaowu' && block.sourceEventId === 'evt_group_heal_public_2' && block.sourceNodeId === 'node_group_heal_public_2' && Number(block.value) === 75),
  publicGroupHealBadgesRendered: /battle-preview-report-badge--heal/.test(publicGroupHealHtml?.html || '') && /data-target-name="唐三"/.test(publicGroupHealHtml?.html || '') && /data-target-name="小舞"/.test(publicGroupHealHtml?.html || '') && /data-source-event-id="evt_group_heal_public_1"/.test(publicGroupHealHtml?.html || '') && /data-source-event-id="evt_group_heal_public_2"/.test(publicGroupHealHtml?.html || ''),
  publicStateResistedAstFirstRendered: publicStateResistedBlocks.length === 1 && publicStateResistedBlocks[0]?.projectionSource === 'state_apply_ast' && /韦小枫/.test(publicStateResistedSerialized || '') && /位移限制/.test(publicStateResistedSerialized || '') && /抵住|未能附着|试图附着/.test(publicStateResistedSerialized || ''),
  publicStateResistedNoStateBadge: publicStateResistedBadges.length === 0,
  publicStateImmuneAstFirstRendered: publicStateImmuneBlocks.length === 1 && publicStateImmuneBlocks[0]?.projectionSource === 'state_apply_ast' && /韦小枫/.test(publicStateImmuneSerialized || '') && /位移限制/.test(publicStateImmuneSerialized || '') && /免疫/.test(publicStateImmuneSerialized || ''),
  publicStateImmuneNoStateBadge: publicStateImmuneBadges.length === 0,
  sourceActionPlaceholderNotRendered: !/【[^】]+的动作】|反应判定：[^。\n]*应对来袭动作|反应窗口：[^。\n]*捕捉到当前攻势|来源未绑定的动作/.test([
    secondCounterTraceHtml,
    defenseReactionTraceHtml,
    longTeamTraceHtml,
  ].join('\n')),
  recordOuterTabsAccessible: /data-battle-record-tab="actual"[^>]*aria-selected="true"[^>]*tabindex="0"/.test(bridgeCode) && /data-battle-record-tab="preview"[^>]*aria-selected="false"[^>]*tabindex="-1"/.test(bridgeCode),
  recordViewTabsImplemented: /activeBattleRecordView/.test(code) && /data-battle-record-view/.test(code) && /\{ round: '回合', report: '战报', decision: '判定', summary: '总结' \}/.test(code),
  recordViewTabsKeyboardAccessible: /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/.test(code) && /setAttribute\('aria-selected'/.test(code) && /setAttribute\('tabindex'/.test(code) && /querySelector\(`\[data-battle-record-view=.*?\]\`\)\?\.focus\(\)/.test(code),
  recordSummaryStructured: /function 渲染战斗总结HTML/.test(code) && /result\?\.finalBattleReport \|\| BATTLE_RUNTIME\.buildFinalSummary/.test(code) && /battle-final-summary-intent/.test(code),
  recordReportUsesStructuredBlocks:
    /function 提取战斗结果结构化战报Blocks/.test(code) &&
    /function 渲染结构化回合战报HTML/.test(code) &&
    /渲染结构化回合战报HTML\(战报Blocks, 战报展示上下文\)/.test(code) &&
    /activeBlocks\.map\(block => 渲染结构化战报BlockHTML/.test(code),
  structuredReportActionReferencesConsistent:
    /const intentHtml = 渲染公开战报HTML/.test(code) &&
    /const actionHeadHtml = 渲染公开战报HTML/.test(code) &&
    /const exchangeHtml = 渲染公开战报HTML/.test(code) &&
    /battle-structured-report-exchange"><b>交锋<\/b><span class="battle-structured-report-copy">/.test(code) &&
    /battle-structured-report-intent"><b>意图<\/b><span class="battle-structured-report-copy">/.test(code) &&
    /battle-structured-report-outcome"><b>结果<\/b><span class="battle-structured-report-copy">/.test(code) &&
    /battle-structured-report-copy[\s\S]{0,160}display: block;[\s\S]{0,120}min-width: 0;/.test(styleCode),
  skillTooltipUsesViewportPortal:
    /globalDocument\.body\.appendChild\(node\)/.test(code) &&
    /position: fixed;[\s\S]{0,120}z-index: 2147483000/.test(styleCode) &&
    /battle-skill-tooltip-floating--portal/.test(styleCode),
  recordReportHasNoTraceTextSupplement: !/构建行动链补缺公开战报Blocks|action_chain_gap_ast/.test(code),
  structuredOutcomeDoesNotBackfillLegacyText: !/outcomeSummary:\s*String\(entry\?\.text|outcomeSummary:\s*String\(entry\?\.text\s*\|\|/.test(code),
  finalSummaryRunsPureNextActionPreview:
    /battle_summary_preview_mutated_state/.test(battleRuntimeCode) &&
    /decisionRuntime\.decide\(\{/.test(battleRuntimeCode) &&
    /worldSnapshot:\s*combatData/.test(battleRuntimeCode),
  structuredReportStylesIntegrated:
    /battle-structured-report-round-head/.test(styleCode) &&
    /battle-structured-report-exchange/.test(styleCode) &&
    /battle-structured-report-passive/.test(styleCode) &&
    /battle-structured-report-head/.test(styleCode) &&
    /battle-structured-report-intent/.test(styleCode) &&
    /battle-structured-report-outcome/.test(styleCode) &&
    /battle-structured-report-window/.test(styleCode),
  publicReportNoUnsupportedWaitText:
    !/暂缓出手，观察战局变化/.test(`${publicFailureBlockSource}\n${publicQuietRoundSource}`) &&
    /if \(!\/观察\|observe\|防御\|收招转防\|守势\|defend\|stance\/i\.test\(actionText\)\) return ''/.test(publicFailureReportSource) &&
    /if \(!failureText\) return/.test(publicFailureBlockSource),
  decisionRoundActionFilterImplemented: /data-battle-decision-round/.test(code) && /data-battle-decision-action/.test(code) && /筛选判定流程条目/.test(code),
  recordViewsAreExclusive: /if \(activeView === 'round'\)[\s\S]*else if \(activeView === 'report'\)[\s\S]*else if \(activeView === 'summary'\)[\s\S]*else \{/.test(code) && /role="tabpanel"/.test(code),
  recordRuntimeStateNotMvuPersisted: /activeBattleRecordView/.test(code) && !/activeBattleRecordView/.test(bridgeCode),
  recordDesktopWidthContract: /--战斗记录外置-width', 'clamp\(480px, 32vw, 640px\)'/.test(code),
  recordDesktopDragContract:
    !/data-battle-record-drag-handle/.test(bridgeCode) &&
    /function 绑定战斗记录终端拖动/.test(code) &&
    /node\.addEventListener\('pointerdown'/.test(code) &&
    /event\.target\?\.closest\?\.\('button, input, select, textarea, a, \[contenteditable="true"\], \.battle-preview-panel'\)/.test(code) &&
    /addEventListener\('pointerdown'/.test(code) &&
    /addEventListener\('pointermove'/.test(code) &&
    /addEventListener\('pointerup'/.test(code) &&
    /Number\(root\.innerWidth \|\| 0\) <= 1180/.test(code),
  recordPanelTopAligned:
    /battle-preview-panel[\s\S]*?align-content:\s*start;[\s\S]*?grid-auto-rows:\s*max-content;/.test(styleCode),
  recordInlineBreakpointContract: /const inline = viewportWidth <= 1180/.test(code) && /@media \(max-width: 1180px\)[\s\S]*battle-record-terminal--inline/.test(styleCode),
  recordMobileLayoutContract:
    /@media \(max-width: 520px\)[\s\S]*battle-record-terminal--inline[\s\S]*width:\s*min\(100%, calc\(100vw - 16px\)\);[\s\S]*height:\s*auto;[\s\S]*max-height:\s*min\(560px, calc\(100svh - 104px\)\);/.test(styleCode) &&
    /@media \(max-width: 520px\)[\s\S]*battle-record-view-tabs[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/.test(styleCode),
};

console.log(JSON.stringify({
  summary,
  samples: {
    skillHtml: skillHtml?.html || '',
    stateApplyHtml: stateApplyHtml?.html || '',
    stateTickHtml: stateTickHtml?.html || '',
    blockHtml: blockHtml?.html || '',
    publicHitBlocks,
    publicHitHtml: publicHitHtml?.html || '',
    dashboardRows,
    continuousDashboardRows,
    dashboardHtml,
    teamDashboardRows,
    teamDashboardHtml,
    teamTraceHtml,
    nullWindowTraceHtml,
    missedWindowTraceHtml,
    longTeamDashboardRows,
    longTeamTraceHtml,
    publicStateTickBlocks,
    publicShieldBlocks,
    publicShieldHtml: publicShieldHtml?.html || '',
    publicGroupShieldBlocks,
    publicGroupShieldHtml: publicGroupShieldHtml?.html || '',
    publicResourceBlocks,
    publicResourceHtml: publicResourceHtml?.html || '',
    publicGroupHealBlocks,
    publicGroupHealHtml: publicGroupHealHtml?.html || '',
    publicStateResistedBlocks,
    publicStateImmuneBlocks,
    lowTraceHtml,
    escalatedTraceHtml,
    secondCounterTraceHtml,
    replanTraceHtml,
    calcTraceHtml,
    dodgeEvidenceTraceHtml,
    dodgeSuccessTraceHtml,
    defenseReactionTraceHtml,
    stateTraceHtml,
    resistedStateTraceHtml,
    immuneStateTraceHtml,
    initialIntentTraceHtml,
    legacyRowsHtml,
  },
}, null, 2));

if (Object.values(summary).some(value => value !== true)) process.exit(1);



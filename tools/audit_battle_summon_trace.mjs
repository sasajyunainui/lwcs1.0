import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function nodeStub() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
  Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
  parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
  navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' }, innerWidth: 1440, innerHeight: 900,
  getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
  ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
};
sandbox.document = {
  documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => nodeStub(),
  body: { appendChild() {} }, head: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const relativePath of ['lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
assert.ok(runtime && typeof runtime.executeStructuredDeclaration === 'function', '正式Runtime缺少结构化结算入口');

const attack = {
  id: 'summon-audit-attack', name: '召唤物攻击', 魂技名: '召唤物攻击', 消耗: '无', 前摇: 1,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 20, 伤害类型: '近身攻击', 命中概率: 1 }],
};
const combatData = {
  回合: 1, 战斗类型: '普通战斗', 战斗意图: '击败', 进行中: true,
  参战者: {
    team_player: [{
      id: 'host', name: 'host', 名称: 'host', side: 'player', type: '强攻系', 系别: '强攻系',
      属性: { 等级: 50, 系别: '强攻系', HP: 1000, HP上限: 1000, 体力: 1000, 体力上限: 1000, 魂力: 500, 魂力上限: 500, 精神力: 200, 精神力上限: 200, 力量: 200, 防御: 120, 敏捷: 180 },
      状态: { 存活: true, 位置: '召唤审计场', 行动: '战斗' }, 状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: [],
    }],
    team_enemy: [{
      id: 'target', name: 'target', 名称: 'target', side: 'enemy', type: '强攻系', 系别: '强攻系',
      属性: { 等级: 50, 系别: '强攻系', HP: 1000, HP上限: 1000, 体力: 1000, 体力上限: 1000, 魂力: 500, 魂力上限: 500, 精神力: 200, 精神力上限: 200, 力量: 180, 防御: 120, 敏捷: 100 },
      状态: { 存活: true, 位置: '召唤审计场', 行动: '战斗' }, 状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: [attack],
    }],
  },
};

const summonSkill = {
  id: 'summon-audit-skill', name: '一回合协同召唤', 魂技名: '一回合协同召唤', 消耗: '无', 前摇: 1,
  _效果数组: [{
    原型: '召唤生成', 目标: '自身', 召唤物名称: '审计协同体', 召唤单位类型: '魂兽',
    行动模式: '协同攻击', 持续回合: 1, 强度: 0.8, 数量: 1,
  }],
};

const result = runtime.executeStructuredDeclaration({
  combatData,
  declaration: { actorId: 'host', actionKind: 'RELEASE_SKILL', targetIds: ['host'], skill: summonSkill },
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  seed: 750001,
});
const ledger = runtime.ensureLedger(combatData);
const creation = ledger.filter(event => event?.eventKind === 'summon_create');
assert.equal(creation.length, 1, `召唤生成事实不唯一:${JSON.stringify(creation)}`);
const summonKey = creation[0]?.meta?.summonKey;
const summon = Object.values(combatData.召唤单位表 || {}).find(unit => unit?.召唤键 === summonKey);
assert.ok(summon, '召唤运行态实体缺失');
assert.equal(summon?.行动模式, '协同攻击', '召唤行动模式错误');
assert.equal(Number(summon?.__来源状态?.duration || 0), 1, '一回合召唤窗口错误');

const summonStarts = ledger.filter(event =>
  event?.eventKind === 'action_start' &&
  event?.actionRole === 'ASSIST' &&
  event?.actorName === '审计协同体'
);
assert.equal(summonStarts.length, 0, '直接结构化生成不应伪造尚未消费的协同攻击');
const window = runtime.ensureSummonWindowRuntime(summon);
assert.ok(window?.windowId, '召唤缺少稳定windowId');
const consumed = runtime.consumeSummonWindow(combatData, summon, '测试消费', `${window.windowId}:audit`);
assert.match(consumed, /召唤消散/, '一回合召唤消费真实窗口后没有到期');
assert.equal(window.consumedWindowGrantIds.size, 1, '召唤窗口没有消费一次');
assert.equal(runtime.consumeSummonWindow(combatData, summon, '重复消费', `${window.windowId}:audit`), '', '重复消费应保持幂等');
assert.equal(window.consumedWindowGrantIds.size, 1, '召唤窗口被重复消费');

const autonomous = structuredClone({
  ...combatData,
  回合: 0,
  参战者: {
    team_player: [combatData.参战者.team_player[0]],
    team_enemy: [combatData.参战者.team_enemy[0]],
  },
});
autonomous.参战者.team_player[0].状态效果 = {
  '召唤:自主审计体': {
    类型: 'buff',
    状态: '召唤:自主审计体',
    duration: 2,
    召唤物: {
      召唤键: 'autonomous-audit-summon',
      召唤单位类型: '魂兽',
      召唤物名称: '自主审计体',
      行动模式: '自主行动',
      生命: 400,
      生命上限: 400,
      继承属性比例: 0.4,
      精神负载: 10,
      生成回合: 0,
      已消散: false,
      技能列表: [structuredClone(attack)],
    },
  },
};
delete autonomous.召唤单位表;
const autonomousResult = runtime.runBattleCase({
  caseId: 'summon-trace-autonomous',
  seed: 750002,
  combatData: autonomous,
  mode: 'team_preview',
  rounds: 2,
  settings: {},
});
assert.equal(autonomousResult.audit?.fatals?.length || 0, 0, `自主召唤案例存在Fatal:${JSON.stringify(autonomousResult.audit?.fatals || [])}`);
assert.ok(Array.isArray(autonomousResult.actionQueueTrace), '自主召唤案例缺少队列Trace');
const autonomousStarts = autonomousResult.ledger.filter(event => event?.eventKind === 'action_start' && event?.actorName === '自主审计体');
assert.ok(autonomousStarts.length > 0, '自主召唤没有从下一行动轴开始行动');
assert.ok(autonomousStarts.every(event => event?.actionName !== '一回合协同召唤'), '召唤物进入了宿主完整技能库');

const payload = {
  eventLedger: structuredClone(autonomousResult.eventLedger || []),
  resolutionTrace: structuredClone(autonomousResult.resolutionTrace || []),
  publicReportBlocks: structuredClone(autonomousResult.publicReportBlocks || []),
  scoringAudit: structuredClone(autonomousResult.scoringAudit || []),
  initialSnapshot: structuredClone(autonomousResult.initialSnapshot || null),
  finalSnapshot: structuredClone(autonomousResult.finalSnapshot || null),
  actionQueueTrace: structuredClone(autonomousResult.actionQueueTrace || []),
};
payload.eventLedger.push({
  eventId: 'summon-injected-duplicate-1', eventKind: 'action_start', actionId: 'summon-duplicate-action',
  sourceActionId: 'summon-parent', parentNodeId: 'summon-parent', actorName: '审计协同体',
  targetName: 'target', actionName: '重复协同攻击', actionType: 'summon_assist', actionRole: 'ASSIST', result: 'declared',
});
payload.eventLedger.push({
  eventId: 'summon-injected-duplicate-2', eventKind: 'action_start', actionId: 'summon-duplicate-action-2',
  sourceActionId: 'summon-parent', parentNodeId: 'summon-parent', actorName: '审计协同体',
  targetName: 'target', actionName: '重复协同攻击', actionType: 'summon_assist', actionRole: 'ASSIST', result: 'declared',
});
const duplicateAudit = runtime.auditFacts(payload);
assert.ok(duplicateAudit.fatals.some(item => item?.code === 'SUMMON_DUPLICATE_ACTION'), '召唤重复行动注入未被捕获');

console.log(JSON.stringify({
  summary: {
    creationFacts: creation.length,
    summonWindowId: window.windowId,
    autonomousRounds: autonomousResult.roundsExecuted,
    queueNodes: autonomousResult.actionQueueTrace.length,
    negativeChecks: 1,
    passed: true,
  },
}, null, 2));

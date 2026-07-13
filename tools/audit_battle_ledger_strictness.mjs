import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { readBattleUiTestSource } from './battle_ui_test_source.mjs';

const sampleCount = Math.max(1, Math.min(100, Number(process.env.BATTLE_LEDGER_STRICTNESS_SAMPLE_COUNT || 5)));
const fixtureNames = [
  '缺事件账本不再回退旧战报解析',
  '缺事件账本时战报面板不回退publicReport字符串',
  '第一魂技正常释放链路',
  '无伤害能力动作阻断污染伤害包',
  '控制第一魂技防反伤害不污染来源',
  '状态反伤必须写入防反账本',
  '死亡保护多资源Ledger守恒',
];

function makeNode() {
  return {
    style: {},
    dataset: {},
    isConnected: true,
    innerHTML: '',
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), {
  querySelector(selector) {
    return selector === '#ui-battle-record-terminal' ? recordNode : null;
  },
});
const container = {
  innerHTML: '',
  querySelector(selector) {
    return selector === '.battle-module-scope' ? scopeNode : null;
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
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
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
  removeEventListener() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve('lwcs/MVU_Skill_Runtime.js'), 'utf8'), sandbox, { filename: 'lwcs/MVU_Skill_Runtime.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattlePreview_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattlePreview_Module.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattleDecision_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattleDecision_Module.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattleRuntime_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattleRuntime_Module.js' });
const battleSource = readBattleUiTestSource();
vm.runInContext(battleSource, sandbox, { filename: 'lwcs/BattleUI_Module.js' });
new sandbox.BattleUIComponent(container, {}, {});

if (typeof sandbox.__LWCS_RUN_BATTLE_REGRESSION_FIXTURE_BATCH__ !== 'function') {
  throw new Error('战斗回归夹具批运行器不可用');
}

const fixtures = fixtureNames.map(name => {
  const batch = sandbox.__LWCS_RUN_BATTLE_REGRESSION_FIXTURE_BATCH__(name) || {};
  const first = Array.isArray(batch?.results) ? batch.results[0] : null;
  return {
    name,
    found: Boolean(first),
    passed: Boolean(first?.ok),
    failedAt: first?.failedAt || '',
    logs: Array.isArray(first?.logs) ? first.logs : [],
  };
});

const structuralFailures = [];
if (typeof sandbox.__LWCS_DEBUG_BATTLE_SAMPLE_RESULT__ === 'function') {
  for (let index = 1; index <= sampleCount; index += 1) {
    const result = sandbox.__LWCS_DEBUG_BATTLE_SAMPLE_RESULT__(index)?.result || {};
    const ledger = Array.isArray(result.eventLedger) ? result.eventLedger : [];
    const actionStartIds = new Set(
      ledger
        .filter(event => String(event?.eventKind || '').trim() === 'action_start')
        .map(event => String(event?.actionId || '').trim())
        .filter(Boolean),
    );
    const actionEventIds = new Set(
      ledger
        .filter(event => ['action_start', 'counter'].includes(String(event?.eventKind || '').trim()))
        .map(event => String(event?.actionId || '').trim())
        .filter(Boolean),
    );
    const seenActionStarts = new Set();
    ledger.forEach((event, eventIndex) => {
      const kind = String(event?.eventKind || '').trim();
      const actionId = String(event?.actionId || '').trim();
      const sourceActionId = String(event?.sourceActionId || '').trim();
      const actionName = String(event?.actionName || '').trim();
      const sourceActionName = String(event?.sourceActionName || '').trim();
      const fail = reason => structuralFailures.push({
        sample: index,
        eventIndex,
        eventKind: kind,
        actorName: event?.actorName || '',
        actionName,
        reason,
      });
      if (kind === 'action_start') {
        if (!actionId) fail('action_start缺actionId');
        if (actionId && seenActionStarts.has(actionId)) fail('action_start重复actionId');
        if (actionId) seenActionStarts.add(actionId);
      }
      if (kind === 'counter') {
        if (!actionId) fail('counter缺独立actionId');
        if (!sourceActionId) fail('counter缺sourceActionId');
        if (actionId && sourceActionId && actionId === sourceActionId) fail('counter复用了来源actionId');
        if (sourceActionId && !actionStartIds.has(sourceActionId)) fail('counter来源actionId找不到action_start');
      }
      if (sourceActionId && !actionEventIds.has(sourceActionId)) fail('sourceActionId找不到来源动作事件');
      if (['hit_result', 'state_apply', 'create', 'summon_create', 'shield_create', 'blocked_action', 'failed_action', 'target_fail'].includes(kind) && !actionId) {
        fail('闭合结果缺actionId');
      }
      if (['dodge', 'defend', 'pass'].includes(kind) && sourceActionName && !sourceActionId) {
        fail('应招事件缺sourceActionId');
      }
      if (kind === 'dodge' && actionName && !/闪避/.test(actionName)) {
        fail('dodge事件动作名不是闪避动作');
      }
    });
  }
}

const summary = {
  fixtureCount: fixtureNames.length,
  fixturePassCount: fixtures.filter(item => item.passed).length,
  sampleCount,
  structuralFailureCount: structuralFailures.length,
};

console.log(JSON.stringify({ summary, fixtures, structuralFailures: structuralFailures.slice(0, 20) }, null, 2));

process.exit(fixtures.some(item => !item.found || !item.passed) || structuralFailures.length > 0 ? 1 : 0);

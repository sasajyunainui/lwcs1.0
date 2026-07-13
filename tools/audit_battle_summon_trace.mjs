import fs from 'node:fs';
import vm from 'node:vm';
import { readBattleUiTestSource } from './battle_ui_test_source.mjs';

const code = readBattleUiTestSource();
const skillRuntimeCode = fs.readFileSync('lwcs/MVU_Skill_Runtime.js', 'utf8');
const previewRuntimeCode = fs.readFileSync('lwcs/BattlePreview_Module.js', 'utf8');
const decisionRuntimeCode = fs.readFileSync('lwcs/BattleDecision_Module.js', 'utf8');
const battleRuntimeCode = fs.readFileSync('lwcs/BattleRuntime_Module.js', 'utf8');

function makeNode() {
  return {
    style: {},
    isConnected: true,
    innerHTML: '',
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
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
  querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; },
});
const container = {
  innerHTML: '',
  querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; },
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

if (typeof sandbox.__LWCS_RUN_SUMMON_FIXTURE_BATCH__ !== 'function') {
  throw new Error('未找到 __LWCS_RUN_SUMMON_FIXTURE_BATCH__ 导出入口');
}

const requestedFixture = String(process.argv[2] || '').trim();
const result = sandbox.__LWCS_RUN_SUMMON_FIXTURE_BATCH__(requestedFixture);
const failed = (result?.results || []).filter(item => item?.ok !== true);
const results = result?.results || [];
console.log(JSON.stringify({
  summary: { fixtureCount: results.length, fixturePassCount: results.filter(item => item?.ok === true).length, fixtureFailureCount: failed.length },
  ok: result?.ok === true,
  results,
}, null, 2));

if (result?.ok !== true || failed.length > 0) process.exit(1);

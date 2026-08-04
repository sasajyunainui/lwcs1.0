import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(toolDir, '..');

export function sha256(value) {
  return crypto.createHash('sha256')
    .update(
      typeof value === 'string' || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value),
    )
    .digest('hex');
}

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeNode() {
  return {
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() {
      return { top: 0, right: 1280, width: 960, height: 720 };
    },
  };
}

export function loadBattleSandbox(options = {}) {
  const sourceOverrides =
    options?.sourceOverrides &&
    typeof options.sourceOverrides === 'object'
      ? options.sourceOverrides
      : {};
  const sandbox = {
    console,
    structuredClone,
    performance,
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
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    process: { env: process.env },
    navigator: { userAgent: 'node' },
    location: { href: 'http://localhost/' },
    innerWidth: 1280,
    innerHeight: 720,
    getComputedStyle: () => ({
      getPropertyValue() { return ''; },
      zIndex: '1',
    }),
    ResizeObserver: function ResizeObserver() {
      this.observe = () => {};
      this.disconnect = () => {};
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    dispatchEvent() {},
    addEventListener() {},
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init?.detail;
    },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1280, clientHeight: 720 },
    createElement: () => makeNode(),
    body: { appendChild() {} },
    head: { appendChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  if (options.includeTargetKernel === true) {
    vm.runInContext(
      fs.readFileSync(
        path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'),
        'utf8',
      ),
      sandbox,
      { filename: 'BattleDecisionR9v2Kernel_Module.js' },
    );
  }
  [
    'LibraryData_Runtime.js',
    'CharacterLibrary.js',
    'MVU_Skill_Runtime.js',
    'BattlePreview_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
    'BattleReport_Module.js',
  ].forEach(fileName => vm.runInContext(
    Object.hasOwn(sourceOverrides, fileName)
      ? String(sourceOverrides[fileName])
      : fs.readFileSync(path.join(repoRoot, fileName), 'utf8'),
    sandbox,
    { filename: fileName },
  ));
  return sandbox;
}

export function manualCasesById(sandbox) {
  const cases = buildManualCases(
    sandbox.__LWCS_内置角色库__,
    sandbox.__LWCS_GET_BASE_STATS__,
  );
  return new Map(cases.map(item => [item.caseId, item]));
}

export function formalInput(caseDefinition, providerId = 'r9v2-shadow') {
  return {
    caseId: caseDefinition.caseId,
    seed: caseDefinition.seed,
    mode: 'team_preview',
    rounds: caseDefinition.rounds,
    settings: {
      providerId,
      collectDecisionReplayIdentity: true,
    },
    combatData: clone(caseDefinition.combatData),
    initialBelief: clone(caseDefinition.initialBelief),
    battleIntent: {
      mode: caseDefinition.intent,
      objectives: clone(caseDefinition.combatData?.胜负条件 || {}),
    },
    selectedAction: clone(caseDefinition.selectedAction),
  };
}

export function executeFormalTransaction(sandbox, input) {
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const draft = runtime.executeBattleDraftR8(structuredClone(input));
  const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
  const reportAudit = report.auditProjection(reportDto);
  const sealedPackage = runtime.sealBattleResult({ draft, reportAudit });
  runtime.verifySealedBattlePackage(sealedPackage);
  return { draft, reportDto, reportAudit, sealedPackage };
}

export function sourceHashes(fileNames = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
]) {
  return Object.fromEntries(fileNames.map(fileName => [
    fileName,
    sha256(fs.readFileSync(path.join(repoRoot, fileName))),
  ]));
}

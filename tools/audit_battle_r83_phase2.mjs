import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const sandbox = {
  console,
  structuredClone,
  Math: Object.create(Math),
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
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const fileName of [
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
]) {
  vm.runInContext(
    fs.readFileSync(path.join(repoRoot, fileName), 'utf8'),
    sandbox,
    { filename: fileName },
  );
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const report = sandbox.__LWCS_BATTLE_REPORT__;
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

function unit(id, side) {
  return {
    id,
    name: id,
    名称: id,
    side,
    系别: '强攻系',
    hp: 500,
    hp_max: 500,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: 150,
    def: 100,
    agi: 100,
    属性: {
      等级: 50,
      HP: 500,
      HP上限: 500,
      魂力: 100,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 150,
      防御: 100,
      敏捷: 100,
      状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: [],
  };
}

const objectiveContract = {
  version: 1,
  explicit: true,
  startRound: 0,
  maxRounds: 1,
  resolutionPriority: 'DEFEAT_FIRST',
  victory: {
    logic: 'ANY',
    conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }],
  },
  defeat: {
    logic: 'ANY',
    conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }],
  },
};
const combatData = {
  进行中: true,
  回合: 0,
  战斗意图: '击败',
  胜负条件: objectiveContract,
  参战者: {
    team_player: [unit('player', 'player')],
    team_enemy: [unit('enemy', 'enemy')],
  },
};
const formalInput = {
  caseId: 'phase2-transaction',
  seed: 832001,
  combatData,
  mode: 'single_round',
  rounds: 1,
  battleIntent: {
    mode: '击败',
    objectives: objectiveContract,
  },
};
const inputHashBefore = runtime.hashBattleValue(formalInput);
const draft = runtime.executeBattleDraft(structuredClone(formalInput));
const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
const reportAudit = report.auditProjection(reportDto);
const sealedPackage = runtime.sealBattleResult({ draft, reportAudit });
const verifiedPackage = runtime.verifySealedBattlePackage(sealedPackage);

addCheck(
  'transaction:full-chain',
  draft.status === 'DRAFT' &&
    reportDto.projectionStatus === 'PENDING' &&
    reportAudit.passed === true &&
    reportAudit.reportDto.projectionStatus === 'PASSED' &&
    sealedPackage.sealStatus === 'SEALED' &&
    verifiedPackage.reportHash === sealedPackage.reportHash &&
    runtime.hashBattleValue(formalInput) === inputHashBefore,
  {
    draftHash: draft.draftHash,
    reportHash: sealedPackage.reportHash,
    ledgerCount: draft.ledger.length,
    decisionCount: draft.decisionAudit.length,
  },
);

assert.deepEqual(
  Object.keys(sealedPackage).sort(),
  [
    'aiSummaryInput',
    'draftHash',
    'finalSnapshot',
    'reportDto',
    'reportHash',
    'schemaVersion',
    'sealStatus',
    'terminalResult',
  ].sort(),
);
addCheck('transaction:sealed-package-shape', true);

let unsealedError = '';
try {
  runtime.verifySealedBattlePackage({
    ...sealedPackage,
    sealStatus: 'DRAFT',
  });
} catch (error) {
  unsealedError = String(error?.message || error);
}
addCheck(
  'transaction:reject-before-seal',
  unsealedError === 'BATTLE_COMMIT_BEFORE_REPORT_SEAL',
  { unsealedError },
);

let reportHashError = '';
try {
  runtime.verifySealedBattlePackage({
    ...sealedPackage,
    reportDto: {
      ...sealedPackage.reportDto,
      actualRoundCount: sealedPackage.reportDto.actualRoundCount + 1,
    },
  });
} catch (error) {
  reportHashError = String(error?.message || error);
}
addCheck(
  'transaction:reject-report-tamper',
  reportHashError === 'BATTLE_COMMIT_HASH_MISMATCH:package',
  { reportHashError },
);

let draftBindingError = '';
try {
  runtime.verifySealedBattlePackage({
    ...sealedPackage,
    draftHash: 'r74-tampered',
  });
} catch (error) {
  draftBindingError = String(error?.message || error);
}
addCheck(
  'transaction:reject-draft-binding-tamper',
  draftBindingError === 'BATTLE_COMMIT_HASH_MISMATCH:package',
  { draftBindingError },
);

const uiSource = fs.readFileSync(path.join(repoRoot, 'BattleUI_Module.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(repoRoot, 'mvu_logic_bridge.js'), 'utf8');
const packageBuilder = uiSource.match(/function buildBattlePackage\(input = \{\}\) \{[\s\S]*?\n    \}/)?.[0] || '';
const draftCallIndex = packageBuilder.indexOf('executeBattleDraft');
const reportBuildIndex = packageBuilder.indexOf('.build({ draft, visibilityMode })');
const projectionAuditIndex = packageBuilder.indexOf('.auditProjection(reportDto)');
const sealIndex = packageBuilder.indexOf('sealBattleResult');
const verifyIndex = packageBuilder.indexOf('verifySealedBattlePackage');
addCheck(
  'source:builder-order',
  draftCallIndex >= 0 &&
    reportBuildIndex > draftCallIndex &&
    projectionAuditIndex > reportBuildIndex &&
    sealIndex > projectionAuditIndex &&
    verifyIndex > sealIndex &&
    !/commitBattlePackage|persistCombatData|applyJsonPatchOpsByEditor/.test(packageBuilder),
);

const commitFunction = bridgeSource.match(/async function 提交战斗包\(sealedPackage = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || '';
addCheck(
  'source:commit-validates-before-write',
  commitFunction.indexOf('verifySealedBattlePackage') >= 0 &&
    commitFunction.indexOf('verifySealedBattlePackage') < commitFunction.indexOf('buildCombatJsonPatch') &&
    commitFunction.indexOf('buildCombatJsonPatch') < commitFunction.indexOf('applyJsonPatchOpsByEditor') &&
    !/reportDto[^]*applyJsonPatchOpsByEditor/.test(commitFunction),
);

const transactionFunction = bridgeSource.match(/async function 执行战斗事务\(combatData = \{\}, options = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || '';
addCheck(
  'source:free-narrative-and-debug-never-commit',
  /executionMode === 'free_narrative'[\s\S]*?FREE_NARRATIVE/.test(transactionFunction) &&
    /options\.dryRun === true \|\| options\.commit === false/.test(transactionFunction) &&
    transactionFunction.indexOf('提交战斗包') > transactionFunction.indexOf('options.dryRun'),
);

const autoFunction = bridgeSource.match(/async function 自动执行战斗模块路由\(snapshot, request = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || '';
addCheck(
  'source:auto-uses-transaction',
  /executeBattleTransaction/.test(autoFunction) &&
    !/确保自动战斗运行器|executeBattleFlow/.test(autoFunction) &&
    !/patchOps/.test(autoFunction),
);
addCheck(
  'source:bridge-exposes-single-commit',
  (bridgeSource.match(/commitBattlePackage\(/g) || []).length === 1 &&
    /commitBattlePackage\(sealedPackage = \{\}\) \{\s*return 提交战斗包\(sealedPackage\);/.test(bridgeSource),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    transactionStatus: failed.length === 0 ? 'TRANSACTION_BOUNDARY_PASSED' : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

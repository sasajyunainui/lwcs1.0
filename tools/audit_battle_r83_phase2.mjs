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
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
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
  settings: {
    providerId: 'r8',
  },
};
const inputHashBefore = runtime.hashBattleValue(formalInput);
const draft = runtime.executeBattleDraftR8(structuredClone(formalInput));
const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
const reportAudit = report.auditProjection(reportDto);
const sealedPackage = runtime.sealBattleResult({ draft, reportAudit });
const verifiedPackage = runtime.verifySealedBattlePackage(sealedPackage);

addCheck(
  'transaction:full-chain',
  draft.schemaVersion === '8.3-draft-1' &&
    draft.status === 'DRAFT' &&
    draft.providerId === 'r8' &&
    draft.inputHash === inputHashBefore &&
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
addCheck(
  'transaction:final-snapshot-is-committable-combat-data',
  sealedPackage.finalSnapshot &&
    typeof sealedPackage.finalSnapshot === 'object' &&
    sealedPackage.finalSnapshot.参战者 &&
    Array.isArray(sealedPackage.finalSnapshot.参战者.team_player) &&
    Array.isArray(sealedPackage.finalSnapshot.参战者.team_enemy) &&
    typeof sealedPackage.finalSnapshot.进行中 === 'boolean' &&
    typeof sealedPackage.finalSnapshot.裁断结果 === 'string' &&
    sealedPackage.finalSnapshot.胜负条件 &&
    runtime.hashBattleValue(formalInput) === inputHashBefore,
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
const packageBuilder = bridgeSource.match(/function 构建战斗提交包\(input = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || '';
const draftCallIndex = packageBuilder.indexOf('executeBattleDraftR8');
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
    !/executeBattleDraft\(|commitBattlePackage|persistCombatData|applyJsonPatchOpsByEditor/.test(packageBuilder),
);

const commitFunction = bridgeSource.match(/async function 提交战斗包\(sealedPackage = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || '';
addCheck(
  'source:commit-validates-before-write',
  commitFunction.indexOf('verifySealedBattlePackage') >= 0 &&
    commitFunction.indexOf('verifySealedBattlePackage') < commitFunction.indexOf('构建正式战斗写回补丁') &&
    commitFunction.indexOf('构建正式战斗写回补丁') < commitFunction.indexOf('applyJsonPatchOpsByEditor') &&
    (commitFunction.match(/verifySealedBattlePackage/g) || []).length >= 2 &&
    !/BattleUIBridge\?\.buildCombatJsonPatch/.test(commitFunction) &&
    !/reportDto[^]*applyJsonPatchOpsByEditor/.test(commitFunction),
);

const transactionFunction = bridgeSource.match(/async function 执行战斗事务\(combatData = \{\}, options = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || '';
addCheck(
  'source:free-narrative-and-debug-never-commit',
  /executionMode === 'free_narrative'[\s\S]*?FREE_NARRATIVE/.test(transactionFunction) &&
    /options\.dryRun !== true && options\.commit !== false/.test(transactionFunction) &&
    transactionFunction.indexOf('提交战斗包') > transactionFunction.indexOf('shouldCommit'),
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
  (bridgeSource.match(/async function 提交战斗包\(/g) || []).length === 1 &&
    (bridgeSource.match(/commitBattlePackage\(/g) || []).length === 0 &&
    /delete 正式战斗桥接接口\.commitBattlePackage;/.test(bridgeSource) &&
    /executeBattleTransaction\(combatData = \{\}, options = \{\}\)/.test(bridgeSource) &&
    /return 执行战斗事务\(combatData, options\);/.test(bridgeSource) &&
    /提交战斗包\(sealedPackage\)/.test(transactionFunction),
);
addCheck(
  'source:ui-does-not-own-formal-transaction',
  !/function buildBattlePackage\(|__buildBattlePackageImpl|executeBattleDraftR8|sealBattleResult|auditProjection/.test(uiSource) &&
    /executeBattleTransaction/.test(uiSource),
);
addCheck(
  'source:r8-final-snapshot-is-formal-combat-data',
  /finalSnapshot:\s*cloneValue\(result\?\.combatData\s*\|\|\s*source\.combatData\s*\|\|\s*null\)/.test(
    fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'), 'utf8'),
  ),
);

const transactionSandbox = {
  structuredClone,
  cloneJsonValue: value => structuredClone(value),
  规范化战斗提交模式: value => String(value || 'auto'),
  读取战斗提交模式: () => 'auto',
  构建战斗事务输入: value => value,
  toText: (value, fallback = '') => String(value ?? fallback),
  正式战斗事务执行中: false,
  buildCount: 0,
  commitCount: 0,
  buildFailure: '',
};
transactionSandbox.构建战斗提交包 = input => {
  transactionSandbox.buildCount += 1;
  if (transactionSandbox.buildFailure) throw new Error(transactionSandbox.buildFailure);
  return {
    terminalResult: { winner: 'unfinished' },
    reportDto: { finalSummary: { text: 'ok' } },
    finalSnapshot: input,
  };
};
transactionSandbox.提交战斗包 = async () => {
  transactionSandbox.commitCount += 1;
  return { committed: true };
};
vm.createContext(transactionSandbox);
vm.runInContext(`${transactionFunction}\nthis.runTransaction = 执行战斗事务;`, transactionSandbox);

const autoResult = await transactionSandbox.runTransaction({ 进行中: true }, { executionMode: 'auto' });
addCheck(
  'dynamic:auto-commits-exactly-once',
  autoResult.committed === true &&
    transactionSandbox.buildCount === 1 &&
    transactionSandbox.commitCount === 1,
);

transactionSandbox.buildCount = 0;
transactionSandbox.commitCount = 0;
const dryRunResult = await transactionSandbox.runTransaction(
  { 进行中: true },
  { executionMode: 'manual', dryRun: true },
);
addCheck(
  'dynamic:manual-preview-never-commits',
  dryRunResult.committed === false &&
    transactionSandbox.buildCount === 1 &&
    transactionSandbox.commitCount === 0,
);

transactionSandbox.buildCount = 0;
transactionSandbox.commitCount = 0;
const freeNarrativeResult = await transactionSandbox.runTransaction(
  { 进行中: true },
  { executionMode: 'free_narrative' },
);
addCheck(
  'dynamic:free-narrative-builds-and-commits-nothing',
  freeNarrativeResult.skipped === true &&
    transactionSandbox.buildCount === 0 &&
    transactionSandbox.commitCount === 0,
);

for (const failureStage of ['DRAFT_FAILED', 'REPORT_FAILED', 'SEAL_FAILED', 'PLAYER_LOCKED_ILLEGAL']) {
  transactionSandbox.buildCount = 0;
  transactionSandbox.commitCount = 0;
  transactionSandbox.buildFailure = failureStage;
  let failureMessage = '';
  try {
    await transactionSandbox.runTransaction(
      { 进行中: true },
      { executionMode: 'manual' },
    );
  } catch (error) {
    failureMessage = String(error?.message || error);
  }
  addCheck(
    `dynamic:${failureStage.toLowerCase()}-commits-nothing`,
    failureMessage === failureStage &&
      transactionSandbox.buildCount === 1 &&
      transactionSandbox.commitCount === 0,
    { failureMessage },
  );
}

const appendPatchFunction = bridgeSource.match(
  /function 追加战斗提交字段补丁\(patchOps, currentRoot, pathSegments, value\) \{[\s\S]*?\n  \}/,
)?.[0] || '';
const buildPatchFunction = bridgeSource.match(
  /function 构建正式战斗写回补丁\(finalSnapshot = \{\}\) \{[\s\S]*?\n  \}/,
)?.[0] || '';
const patchSandbox = {
  structuredClone,
  liveSnapshot: {
    rootData: {
      world: { 战斗: { 进行中: true } },
      char: {
        player: {
          属性: { HP: 500, 魂力: 100 },
          状态: { 存活: true, 行动: '战斗' },
          背包: { 药剂: { 数量: 2 } },
        },
      },
    },
  },
  lastRenderableSnapshot: null,
  战斗提交属性字段: ['HP', 'HP上限', '魂力', '魂力上限', '状态效果'],
  战斗提交状态字段: ['存活', '行动'],
  战斗提交角色字段: ['装备', '背包'],
  战斗状态倍率运行键映射: {
    str: '力量',
    def: '防御',
    agi: '敏捷',
    vit_max: '体力上限',
    sp_max: '魂力上限',
    men_max: '精神力上限',
  },
  toText: (value, fallback = '') => String(value ?? fallback),
  toNumber: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  cloneJsonValue: (value, fallback) => value === undefined ? fallback : structuredClone(value),
  escapeJsonPointerValue: value => String(value).replace(/~/g, '~0').replace(/\//g, '~1'),
  deepGet(source, pathValue, fallback) {
    const segments = Array.isArray(pathValue) ? pathValue : String(pathValue || '').split('.').filter(Boolean);
    let current = source;
    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in current)) return fallback;
      current = current[segment];
    }
    return current;
  },
  compactCombatDataForWorldStorage: (_snapshot, value) => structuredClone(value),
  resolveSnapshotCharKey(snapshot, name) {
    return snapshot?.rootData?.char?.[name] ? name : '';
  },
};
vm.createContext(patchSandbox);
const buildStateFunction = bridgeSource.match(
  /function 构建战斗状态落盘值\(condition = \{\}\) \{[\s\S]*?\n  \}/,
)?.[0] || '';
const buildStateMapFunction = bridgeSource.match(
  /function 构建战斗状态集合落盘值\(conditionMap\) \{[\s\S]*?\n  \}/,
)?.[0] || '';
vm.runInContext(
  `${buildStateFunction}\n${buildStateMapFunction}\n${appendPatchFunction}\n${buildPatchFunction}\nthis.buildCommitPatch = 构建正式战斗写回补丁;`,
  patchSandbox,
);
const persistableFinalSnapshot = {
  进行中: false,
  回合: 1,
  参战者: {
    team_player: [{
      name: 'player',
      属性: {
        HP: 420,
        HP上限: 500,
        魂力: 35,
        魂力上限: 100,
        状态效果: {},
      },
      状态效果: {
        迟缓: {
          duration: 1,
          __previewApplicationProbability: 1,
          面板修改比例: { agi: -0.2 },
          战斗效果: { reaction_penalty: 0.1 },
        },
      },
      状态: { 存活: true, 行动: '战斗' },
      背包: { 药剂: { 数量: 1 } },
    }],
    team_enemy: [],
  },
};
const commitPatches = patchSandbox.buildCommitPatch(persistableFinalSnapshot);
addCheck(
  'dynamic:commit-patch-preserves-battle-continuity',
  commitPatches.some(item => item.path === '/world/战斗' && item.value?.参战者) &&
    commitPatches.some(item => item.path === '/char/player/属性/HP' && item.value === 420) &&
    commitPatches.some(item => item.path === '/char/player/属性/魂力' && item.value === 35) &&
    commitPatches.some(item =>
      item.path === '/char/player/属性/状态效果' &&
      item.value?.迟缓?.持续回合 === 1 &&
      item.value?.迟缓?.面板倍率?.敏捷 === -0.2 &&
      item.value?.迟缓?.duration === undefined &&
      item.value?.迟缓?.__previewApplicationProbability === undefined
    ) &&
    commitPatches.some(item => item.path === '/char/player/状态/行动' && item.value === '战斗') &&
    commitPatches.some(item => item.path === '/char/player/背包' && item.value?.药剂?.数量 === 1),
  { patchCount: commitPatches.length },
);
let nonPersistableError = '';
try {
  patchSandbox.buildCommitPatch({
    team_player: [],
    team_enemy: [],
  });
} catch (error) {
  nonPersistableError = String(error?.message || error);
}
addCheck(
  'dynamic:canonical-analysis-snapshot-cannot-be-committed',
  nonPersistableError === 'battle_commit_final_snapshot_not_persistable',
  { nonPersistableError },
);

let writeCount = 0;
const commitSandbox = {
  window: {},
  构建正式战斗写回补丁: () => [{ op: 'replace', path: '/world/战斗', value: {} }],
  applyJsonPatchOpsByEditor: async () => {
    writeCount += 1;
  },
};
const stablePackage = {
  sealStatus: 'SEALED',
  draftHash: 'draft',
  reportHash: 'report',
  finalSnapshot: persistableFinalSnapshot,
};
commitSandbox.window.__LWCS_BATTLE_RUNTIME__ = {
  verifySealedBattlePackage(value) {
    if (value?.tampered) throw new Error('BATTLE_COMMIT_HASH_MISMATCH:package');
    return structuredClone(value);
  },
  hashBattleValue: value => JSON.stringify(value),
};
vm.createContext(commitSandbox);
vm.runInContext(`${commitFunction}\nthis.commitPackage = 提交战斗包;`, commitSandbox);
const commitReceipt = await commitSandbox.commitPackage(stablePackage);
addCheck(
  'dynamic:verified-package-writes-exactly-once',
  commitReceipt.committed === true && writeCount === 1,
  { writeCount },
);
writeCount = 0;
let tamperedCommitError = '';
try {
  await commitSandbox.commitPackage({ ...stablePackage, tampered: true });
} catch (error) {
  tamperedCommitError = String(error?.message || error);
}
addCheck(
  'dynamic:tampered-package-writes-nothing',
  tamperedCommitError === 'BATTLE_COMMIT_HASH_MISMATCH:package' && writeCount === 0,
  { tamperedCommitError, writeCount },
);

const ownershipSession = decision.createEvaluationSession({
  objectiveHash: `objective:${preview.stableHash(objectiveContract)}`,
  visibleWorldRevision: `visible:${preview.stableHash(combatData)}`,
  beliefRevision: 'belief:phase2',
  opportunityRevision: 'opportunity:phase2',
  resourceTimelineRevision: 'resource:phase2',
  scheduleRevision: 'schedule:phase2',
});
decision.advanceEvaluationSession(ownershipSession, {
  sequence: 1,
  sourceEventIds: ['phase2:hp-change'],
  changedFactKeys: ['unit:enemy:hp'],
  opportunityChanges: [],
  resourceTimelineChanges: [],
  scheduleChanges: [],
  visibleBeliefChanges: [],
  terminalReached: false,
});
const ownershipRequest = decision.prepareDecisionRequest({
  session: ownershipSession,
  worldSnapshot: combatData,
  actorId: 'player',
  objectiveContract,
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  seed: 'phase2-ownership',
});
const ownershipPrepared = decision.preparedRouteCacheSnapshot(ownershipRequest);
const ownershipIndex = ownershipPrepared.routeFactOwnershipIndex;
const ownershipMetrics = decision.readEvaluationSessionMetrics(ownershipSession);
const ownershipRecord = ownershipMetrics.requestRecords.at(-1);
const ownershipUnits = new Set(
  Object.values(ownershipIndex.ownersByFact)
    .flat()
    .map(owner => owner.unitId),
);
addCheck(
  'ownership-index:full-team-layered-v2',
  ownershipIndex.schemaVersion === 'RouteFactOwnershipIndexV2' &&
    ownershipUnits.has('player') &&
    ownershipUnits.has('enemy') &&
    ownershipIndex.ownerCount > 0 &&
    ownershipIndex.summaryByLayer.MECHANICAL > 0 &&
    ownershipIndex.summaryByLayer.BEHAVIOR > 0 &&
    ownershipIndex.summaryByLayer.TERMINAL > 0 &&
    ownershipIndex.summaryByLayer.ATTRIBUTION > 0 &&
    ownershipRecord?.ownershipImpact?.matchedFactKeys?.includes(
      'unit:enemy:hp',
    ) &&
    ownershipRecord.ownershipImpact.dirtyOwnerCount > 0,
  {
    schemaVersion: ownershipIndex.schemaVersion,
    ownerCount: ownershipIndex.ownerCount,
    summaryByLayer: ownershipIndex.summaryByLayer,
    unscopedLayers: ownershipIndex.unscopedLayers,
    ownershipImpact: ownershipRecord?.ownershipImpact || {},
  },
);
addCheck(
  'ownership-index:diagnostic-only',
  ownershipMetrics.storeSizes.routeFactOwnershipIndex === 1 &&
    ownershipMetrics.metrics.ownershipIndexBuilds === 1 &&
    ownershipMetrics.metrics.ownershipDirtyOwnerCount ===
      ownershipRecord?.ownershipImpact?.dirtyOwnerCount &&
    !Object.hasOwn(ownershipRequest, 'session') &&
    !JSON.stringify(ownershipRequest).includes('ownershipImpact'),
  {
    metrics: ownershipMetrics.metrics,
    storeSizes: ownershipMetrics.storeSizes,
  },
);
decision.disposeEvaluationSession(ownershipSession);

const resourceOwnershipWorld = structuredClone(combatData);
resourceOwnershipWorld.参战者.team_player[0].技能列表 = [{
  id: 'phase2-resource-strike',
  name: 'phase2-resource-strike',
  魂技名: 'phase2-resource-strike',
  消耗: { 魂力: 20 },
  _效果数组: [{
    effectId: 'phase2-resource-strike:damage',
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 110,
    伤害类型: '近身攻击',
    命中概率: 100,
  }],
}];
const resourceOwnershipSession = decision.createEvaluationSession({
  objectiveHash: `objective:${preview.stableHash(objectiveContract)}`,
  visibleWorldRevision: `visible:${preview.stableHash(resourceOwnershipWorld)}`,
  beliefRevision: 'belief:phase2-resource',
  opportunityRevision: 'opportunity:phase2-resource',
  resourceTimelineRevision: 'resource:phase2-resource',
  scheduleRevision: 'schedule:phase2-resource',
});
decision.advanceEvaluationSession(resourceOwnershipSession, {
  sequence: 1,
  sourceEventIds: ['phase2:resource-change'],
  changedFactKeys: ['unit:player:resource:魂力'],
  opportunityChanges: [],
  resourceTimelineChanges: [{
    eventId: 'phase2:resource-change',
    actorId: 'player',
    resource: '魂力',
    operation: 'PAY',
  }],
  scheduleChanges: [],
  visibleBeliefChanges: [],
  terminalReached: false,
});
const resourceOwnershipRequest = decision.prepareDecisionRequest({
  session: resourceOwnershipSession,
  worldSnapshot: resourceOwnershipWorld,
  actorId: 'player',
  objectiveContract,
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  seed: 'phase2-resource-ownership',
});
const resourceOwnershipIndex =
  decision.preparedRouteCacheSnapshot(resourceOwnershipRequest)
    .routeFactOwnershipIndex;
const resourceOwnershipRecord =
  decision.readEvaluationSessionMetrics(resourceOwnershipSession)
    .requestRecords.at(-1);
addCheck(
  'ownership-index:resource-payment-layer',
  resourceOwnershipIndex.summaryByLayer.RESOURCE > 0 &&
    resourceOwnershipRecord?.ownershipImpact?.matchedFactKeys?.includes(
      'unit:player:resource:魂力',
    ) &&
    (resourceOwnershipRecord?.ownershipImpact?.dirtyOwnersByLayer?.RESOURCE ||
      []).some(owner =>
      owner.dependencyRole === 'RESOURCE_PAY_BEFORE' ||
      owner.dependencyRole === 'RESOURCE_PAY_AFTER'
    ),
  {
    summaryByLayer: resourceOwnershipIndex.summaryByLayer,
    ownershipImpact: resourceOwnershipRecord?.ownershipImpact || {},
  },
);
decision.disposeEvaluationSession(resourceOwnershipSession);

const phase2RuntimeResult = runtime.runDecisionCase({
  ...formalInput,
  caseId: 'phase2-runtime-ownership',
  settings: { providerId: 'r8' },
});
addCheck(
  'ownership-index:runtime-observation-no-draft-persistence',
  phase2RuntimeResult.evaluationSessionMetrics?.metrics?.ownershipIndexBuilds ===
    phase2RuntimeResult.evaluationSessionMetrics?.metrics?.requestCount &&
    phase2RuntimeResult.decisionPerformanceDiagnostics.every(entry =>
      entry?.evaluationSessionObservation?.request?.ownershipImpact
    ) &&
    !JSON.stringify(draft).includes('ownershipImpact') &&
    !JSON.stringify(draft).includes('RouteFactOwnershipIndexV2'),
  {
    requestCount:
      phase2RuntimeResult.evaluationSessionMetrics?.metrics?.requestCount || 0,
    ownershipIndexBuilds:
      phase2RuntimeResult.evaluationSessionMetrics?.metrics
        ?.ownershipIndexBuilds || 0,
  },
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    transactionStatus: failed.length === 0 ? 'TRANSACTION_BOUNDARY_PASSED' : 'BLOCKED',
    ownershipStatus: failed.length === 0
      ? 'FULL_TEAM_LAYERED_OWNERSHIP_OBSERVED'
      : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

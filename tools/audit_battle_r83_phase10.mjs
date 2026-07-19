import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  vm.runInContext(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'), sandbox, { filename: fileName });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const report = sandbox.__LWCS_BATTLE_REPORT__;
const checks = [];
const add = (checkId, passed, detail = {}) => checks.push({ checkId, passed: passed === true, ...detail });

function unit(id, side, options = {}) {
  const skill = {
    id: `${id}:skill`,
    name: `${id}战技`,
    魂技名: `${id}战技`,
    消耗: { 魂力: 10 },
    _效果数组: [{
      effectId: `${id}:damage`,
      原型: '伤害结算',
      目标: '单体',
      威力倍率: Number(options.power || 80),
      伤害类型: '近身攻击',
      命中概率: '85%',
    }],
  };
  return {
    id,
    name: id,
    名称: id,
    side,
    系别: options.system || '强攻系',
    hp: 500,
    hp_max: 500,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: Number(options.str || 150),
    def: Number(options.def || 100),
    agi: Number(options.agi || 100),
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
      力量: Number(options.str || 150),
      防御: Number(options.def || 100),
      敏捷: Number(options.agi || 100),
      状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: [skill],
  };
}

const objectiveContract = {
  startRound: 1,
  maxRounds: 2,
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
const draftInput = {
  caseId: 'phase10-r8-report',
  seed: 831001,
  combatData: {
    进行中: true,
    回合: 0,
    战斗意图: '击败',
    胜负条件: objectiveContract,
    参战者: {
      team_player: [unit('player', 'player', { system: '控制系' })],
      team_enemy: [unit('enemy', 'enemy', { system: '敏攻系', agi: 150 })],
    },
  },
  mode: 'multi_round',
  rounds: 2,
  battleIntent: { mode: '击败', objectives: objectiveContract },
  settings: { providerId: 'r8-shadow' },
};
const draft = runtime.executeBattleDraft(structuredClone(draftInput));
const repeatedDraft = runtime.executeBattleDraft(structuredClone(draftInput));
const fullRecomputeDraft = runtime.executeBattleDraft({
  ...structuredClone(draftInput),
  settings: {
    ...draftInput.settings,
    disableRouteCatalogCache: true,
  },
});
const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
const reportAudit = report.auditProjection(reportDto);
const developerReportDto = report.build({ draft, visibilityMode: 'DEVELOPER' });
const developerReportAudit = report.auditProjection(developerReportDto);
const adjudications = Array.isArray(reportDto.adjudications) ? reportDto.adjudications : [];
const developerAdjudications = Array.isArray(developerReportDto.adjudications)
  ? developerReportDto.adjudications
  : [];
const r8Decisions = draft.decisionAudit.filter(item => String(item?.decisionEngine || '').toUpperCase() === 'R8');
const comparableDraftHashes = value => ({
  ledgerHash: runtime.hashBattleValue(value.ledger),
  traceHash: runtime.hashBattleValue(value.trace),
  decisionAuditHash: runtime.hashBattleValue(value.decisionAudit),
  terminalHash: runtime.hashBattleValue(value.terminalResult),
  finalSnapshotHash: runtime.hashBattleValue(value.finalSnapshot),
});
const draftHashes = comparableDraftHashes(draft);
const repeatedDraftHashes = comparableDraftHashes(repeatedDraft);
const fullRecomputeHashes = comparableDraftHashes(fullRecomputeDraft);

add(
  'runtime:fixed-seed-is-deterministic',
  JSON.stringify(draftHashes) === JSON.stringify(repeatedDraftHashes),
  { draftHashes, repeatedDraftHashes },
);
add(
  'decision:local-cache-matches-full-recompute',
  JSON.stringify(draftHashes) === JSON.stringify(fullRecomputeHashes),
  { draftHashes, fullRecomputeHashes },
);

add(
  'report:r8-decision-count',
  r8Decisions.length > 0 && adjudications.length === draft.decisionAudit.length,
  { decisionCount: draft.decisionAudit.length, r8DecisionCount: r8Decisions.length, adjudicationCount: adjudications.length },
);
add(
  'report:r8-selected-and-alternatives',
  adjudications.every(item =>
    item?.selected &&
    Array.isArray(item?.alternatives) &&
    item.alternatives.length <= 2 &&
    item?.goalProjection &&
    item?.healthTrajectory &&
    item?.actionRouteDeltas &&
    item?.realizationWindows &&
    item?.resourceTimelineSummary &&
    item?.probabilitySources &&
    item?.uncertaintyBounds
  ),
);
const numericTokens = adjudications.flatMap(item => [
  ...(item?.predicted?.numbers || []),
  ...(item?.actual?.numericTokens || []),
]);
add(
  'report:number-dual-source',
  numericTokens.length > 0 &&
    numericTokens.every(token =>
      String(token?.sourceEventId || '').trim() &&
      String(token?.sourceFactId || '').trim()
    ),
  { numericTokenCount: numericTokens.length },
);
add(
  'report:r8-comparison-evidence-is-semantic',
  adjudications
    .filter(item => item?.selected?.actionKind && item?.selected?.actionKind !== 'LOST_OPPORTUNITY')
    .every(item => {
      const alternatives = Array.isArray(item?.alternatives) ? item.alternatives : [];
      if (!alternatives.length) return true;
      const comparison = item?.comparisonEvidence;
      const hasComponents = Array.isArray(comparison?.changedComponents);
      const hasComparisonId = String(comparison?.comparisonId || '').trim().length > 0;
      const hasExplanation = String(comparison?.explanation || '').trim().length > 0;
      const predictedNumbers = Array.isArray(item?.predicted?.numbers) ? item.predicted.numbers : [];
      const previewNumbersHaveDetail = predictedNumbers.every(token =>
        String(token?.sourceDetail || '').trim().length > 0 &&
        String(token?.comparisonId || '').trim().length > 0
      );
      const alternativeDetails = alternatives.every(candidate =>
        candidate?.comparisonEvidence &&
        String(candidate.comparisonEvidence?.alternativeAction || '').trim().length > 0 &&
        Array.isArray(candidate.comparisonEvidence?.changedComponents)
      );
      return hasComponents && hasComparisonId && hasExplanation && previewNumbersHaveDetail && alternativeDetails;
    }),
  {
    adjudicationCount: adjudications.length,
    comparisonEvidenceCount: adjudications.filter(item => item?.comparisonEvidence).length,
  },
);
const serializedAdjudications = JSON.stringify(adjudications);
add(
  'report:no-v1-score-language',
  !/objectiveProgress|expectedStateGain|resourceContinuity|worstTailCapacityLoss|nextValueAudit/.test(serializedAdjudications),
);
add(
  'report:no-generic-rationale',
  !/当前目标、风险与后续能力的合并比较中更优|因为存在有效伤害、控制或支援窗口|替代方案更弱/.test(serializedAdjudications),
);
add(
  'report:projection-audit',
  reportAudit.passed === true &&
    reportAudit.reportDto?.projectionStatus === 'PASSED' &&
    developerReportAudit.passed === true &&
    developerReportAudit.reportDto?.projectionStatus === 'PASSED',
  { playerFatals: reportAudit.fatals || [], developerFatals: developerReportAudit.fatals || [] },
);
add(
  'report:player-developer-visibility',
  adjudications.every(item =>
    Array.isArray(item?.causalValueFacts) &&
    item.causalValueFacts.length === 0 &&
    !Object.hasOwn(item, 'candidateId')
  ) &&
    developerAdjudications.length === adjudications.length &&
    developerAdjudications.every(item => Array.isArray(item?.causalValueFacts)),
);
const aiSerialized = JSON.stringify(reportDto.aiSummaryInput || {});
add(
  'ai:structured-summary-only',
  !/scoreAudit|candidateId|rawDecision|formulaTrace|normalizedUtility|objectiveUtility|finalBattleReport|reportBlocks/.test(aiSerialized),
);

const supportActor = unit('support', 'player', { system: '辅助系', str: 180 });
supportActor.技能列表.unshift({
  id: 'support-burst',
  name: '高耗爆发',
  魂技名: '高耗爆发',
  消耗: { 魂力: 80 },
  _效果数组: [{
    effectId: 'support-burst-damage',
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 320,
    伤害类型: '远程攻击',
    命中概率: '100%',
  }],
});
supportActor.技能列表.unshift({
  id: 'support-shield',
  name: '净化屏障',
  魂技名: '净化屏障',
  消耗: { 魂力: 80 },
  _效果数组: [
    {
      effectId: 'support-empty-cleanse',
      原型: '状态移除',
      目标: '群体',
      状态: '任意负面',
    },
    {
      effectId: 'support-team-shield',
      原型: '状态施加',
      目标: '群体',
      状态: '护盾',
      数值: '+20%',
      持续回合: 1,
    },
  ],
});
const supportWorld = {
  进行中: true,
  回合: 1,
  战斗意图: '击败',
  胜负条件: objectiveContract,
  参战者: {
    team_player: [supportActor, unit('ally', 'player')],
    team_enemy: [unit('enemy-a', 'enemy', { power: 120 }), unit('enemy-b', 'enemy', { power: 120 })],
  },
};
const supportOpportunity = {
  opportunityId: 'natural:1:player:support:1',
  ownerId: 'support',
  role: 'ACTIVE',
  grantType: 'NATURAL_ACTION',
  sequence: 1,
  battleHorizon: {
    currentRound: 1,
    finalRound: 2,
    remainingRounds: 1,
    naturalActionBudget: 4,
  },
};
const supportRuntimeSnapshot = runtime.buildDecisionRuntimeSnapshot(
  supportWorld,
  'support',
  supportOpportunity,
);
const supportRequest = decision.prepareDecisionRequest({
  worldSnapshot: supportWorld,
  actorId: 'support',
  objectiveContract,
  actionOpportunity: supportOpportunity,
  runtimeSnapshot: supportRuntimeSnapshot,
  seed: 831002,
});
const supportCandidate = supportRequest.frozenCandidates.find(candidate =>
  candidate.declaration?.skill?.id === 'support-shield' ||
  candidate.candidateId === 'support:skill:support-shield:0'
);
const supportProjection = supportCandidate
  ? decision.projectR8GoalUtility(
      supportRequest,
      supportCandidate,
      supportRequest.actorCandidateRoutes[supportCandidate.candidateId],
    )
  : null;
const supportDecision = supportCandidate
  ? decision.runProvider({ providerId: 'r8', request: supportRequest })
  : null;
const supportScore = supportDecision?.decisionAudit?.candidateAudit?.find(
  candidate => candidate.candidateId === supportCandidate?.candidateId,
);
const supportShieldDeltas = supportProjection?.actionPoolDeltas?.filter(
  delta => delta.outcomeKind === 'SHIELD_DELTA',
) || [];
const supportResourceDeltas = supportProjection?.actionPoolDeltas?.filter(
  delta => delta.outcomeKind === 'RESOURCE_OPTION_CHANGED',
) || [];
add(
  'decision:future-natural-descriptors-preserve-resource-continuity',
  !!supportCandidate &&
    supportRuntimeSnapshot.scheduledEvents.filter(event =>
    event.eventType === 'NEXT_ROUND_NATURAL_ACTION' &&
    event.expectedGrantType === 'NATURAL_ACTION'
  ).length === 4 &&
    supportResourceDeltas.some(delta => delta.targetId === 'support' && delta.healthTrajectoryDeltaPP < 0),
  {
    scheduledEvents: supportRuntimeSnapshot.scheduledEvents,
    resourceDeltas: supportResourceDeltas,
  },
);
add(
  'decision:empty-state-cannot-own-shield-envelope',
  !!supportCandidate &&
    !supportProjection.actionPoolDeltas.some(delta =>
    delta.outcomeKind === 'STATE_CHANGED' &&
    Math.abs(Number(delta.healthTrajectoryDeltaPP || 0)) > 1e-9
  ) &&
    !supportScore?.causalValueFacts?.some(fact =>
      fact.effectInstanceId === 'support-empty-cleanse'
    ),
  {
    actionPoolDeltas: supportProjection?.actionPoolDeltas || [],
    causalValueFacts: supportScore?.causalValueFacts || [],
  },
);
add(
  'decision:shield-causal-range-capped-by-expected-absorption',
  !!supportCandidate &&
    supportShieldDeltas.length > 0 &&
    supportShieldDeltas.every(delta =>
      Math.abs(Number(delta.healthTrajectoryDeltaPP || 0)) <=
      Math.abs(Number(delta.threatValue || 0)) + 1e-9
    ),
  { shieldDeltas: supportShieldDeltas },
);
add(
  'decision:paid-resource-reserve-uses-consumed-resource',
  !!supportCandidate &&
    Number(supportScore?.vector?.assetReserve) <= 20 + 1e-9,
  { assetReserve: supportScore?.vector?.assetReserve },
);

const uiSource = fs.readFileSync(path.join(repoRoot, 'BattleUI_Module.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(repoRoot, 'mvu_logic_bridge.js'), 'utf8');
const onPlayerAttack = uiSource.match(/function onPlayerAttack\(playerInput, options = \{\}\) \{[\s\S]*?\n      \}/)?.[0] || '';
add(
  'ui:formal-path-uses-package',
  /buildBattlePackage|executeBattleTransaction/.test(onPlayerAttack) &&
    /commitBattlePackage/.test(onPlayerAttack) &&
    !/runBattleCase|persistCombatData|buildFinalSummary|buildAiNarrativeSummary/.test(onPlayerAttack),
);
add(
  'ui:transaction-clone-guard-and-ai-order',
  /formalBattleTransactionInFlight/.test(onPlayerAttack) &&
    /cloneBattleValue\(sourceCombatData\)/.test(onPlayerAttack) &&
    !/ensureCombatRuntime\(sourceCombatData\)/.test(onPlayerAttack) &&
    onPlayerAttack.indexOf('commitBattlePackage') >= 0 &&
    onPlayerAttack.indexOf('sendToAI') > onPlayerAttack.indexOf('commitBattlePackage'),
);
add(
  'ui:preview-never-commits',
  /dryRun/.test(onPlayerAttack) &&
    /commitBattlePackage/.test(onPlayerAttack),
);
const reportDtoRenderer = uiSource.match(/function 渲染ReportDto记录视图\(reportDto = \{\}, activeView = 'report'\) \{[\s\S]*?\n        \}/)?.[0] || '';
const recordPanel = uiSource.match(/function 渲染战斗记录面板\(\) \{[\s\S]*?\n        \}/)?.[0] || '';
add(
  'ui:report-dto-four-views',
  /roundOverview/.test(reportDtoRenderer) &&
    /exchanges/.test(reportDtoRenderer) &&
    /adjudications/.test(reportDtoRenderer) &&
    /finalSummary/.test(reportDtoRenderer),
);
add(
  'ui:formal-result-prefers-report-dto',
  /result\?\.reportDto/.test(recordPanel) &&
    recordPanel.indexOf('result?.reportDto') < recordPanel.indexOf('BATTLE_RUNTIME.buildRoundOverview'),
);
add(
  'ui:public-render-report-interface',
  /function renderReport\(reportDto = \{\}, options = \{\}\)/.test(uiSource) &&
    /renderReport,\s*\n/.test(uiSource),
);
const renderReport = uiSource.match(/function renderReport\(reportDto = \{\}, options = \{\}\) \{[\s\S]*?\n        \}/)?.[0] || '';
add(
  'ui:render-report-is-dto-only',
  /reportDto/.test(renderReport) &&
    !/BATTLE_RUNTIME|ledger|buildRoundOverview|buildFinalSummary|buildAiNarrativeSummary/.test(renderReport),
);
const submitBattleIntent = uiSource.match(/async function submitBattleIntent\(\) \{[\s\S]*?\n        \}/)?.[0] || '';
const previewBattleIntent = uiSource.match(/async function previewBattleIntent\(\) \{[\s\S]*?\n        \}/)?.[0] || '';
add(
  'ui:async-callers-block-double-submit',
  /battleTransactionPending/.test(submitBattleIntent) &&
    /设置战斗事务等待状态\(true\)/.test(submitBattleIntent) &&
    /设置战斗事务等待状态\(false\)/.test(submitBattleIntent) &&
    /await onPlayerAttack/.test(submitBattleIntent) &&
    /battleTransactionPending/.test(previewBattleIntent) &&
    /设置战斗事务等待状态\(true\)/.test(previewBattleIntent) &&
    /设置战斗事务等待状态\(false\)/.test(previewBattleIntent) &&
    /await onPlayerAttack/.test(previewBattleIntent),
);
const numericRenderer = uiSource.match(/function 渲染ReportDto数字\(token = \{\}\) \{[\s\S]*?\n        \}/)?.[0] || '';
const numericBinding = uiSource.match(/function 绑定ReportDto数字来源\(node\) \{[\s\S]*?\n        \}/)?.[0] || '';
add(
  'ui:number-source-keyboard-portal',
  /<button/.test(numericRenderer) &&
    /data-source-event-id/.test(numericRenderer) &&
    /data-source-fact-id/.test(numericRenderer) &&
    /aria-haspopup/.test(numericRenderer) &&
    /mouseenter/.test(numericBinding) &&
    /focus/.test(numericBinding) &&
    /click/.test(numericBinding) &&
    /Escape/.test(numericBinding) &&
    /显示ReportDto数字来源/.test(numericBinding),
);
const autoSummaryBuilder = bridgeSource.match(/function 构建自动战斗结构化摘要\([\s\S]*?(?=\n  function )/)?.[0] || '';
add(
  'bridge:ai-summary-uses-structured-report-input',
  /执行结果\?\.aiSummaryInput/.test(autoSummaryBuilder) &&
    /JSON\.stringify\(摘要输入\)/.test(autoSummaryBuilder) &&
    !/llmBattleSummary|finalBattleReport|reportDto|publicReport/.test(autoSummaryBuilder),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    reportProjectionStatus: failed.length === 0 ? 'R8_REPORT_UI_PROJECTION_PASSED' : 'BLOCKED',
  },
  checks,
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const battleUiPath = path.resolve(root, 'lwcs/BattleUI_Module.js');
const battleRuntimePath = path.resolve(root, 'lwcs/BattleRuntime_Module.js');
const battleDecisionPath = path.resolve(root, 'lwcs/BattleDecision_Module.js');
const battlePreviewPath = path.resolve(root, 'lwcs/BattlePreview_Module.js');
const mvuPath = path.resolve(root, 'lwcs/MVU.js');
const bridgePath = path.resolve(root, 'lwcs/mvu_logic_bridge.js');
const databaseAdapterPath = path.resolve(root, 'lwcs/LWCS_Database_Adapter.js');
const routePresetPath = path.resolve(root, 'lwcs/缝合怪二改_专用推进预设.plot-preset.json');
const battleUiSource = fs.readFileSync(battleUiPath, 'utf8');
const battleRuntimeSource = fs.readFileSync(battleRuntimePath, 'utf8');
const battleDecisionSource = fs.readFileSync(battleDecisionPath, 'utf8');
const battlePreviewSource = fs.readFileSync(battlePreviewPath, 'utf8');
const mvuSource = fs.readFileSync(mvuPath, 'utf8');
const bridgeSource = fs.readFileSync(bridgePath, 'utf8');
const databaseAdapterSource = fs.readFileSync(databaseAdapterPath, 'utf8');
const routePresetSource = fs.readFileSync(routePresetPath, 'utf8');
const gateSource = fs.readFileSync(path.resolve(root, 'lwcs/tools/run_battle_v23_regression_gate.mjs'), 'utf8');
const settlementBindingSource = battleUiSource.match(/BATTLE_RUNTIME\.bindSettlementPrimitives\(\{[\s\S]*?\n\s*}\);/)?.[0] || '';

const checks = [];
const addCheck = (name, passed, detail = '') => checks.push({ name, passed: Boolean(passed), detail });

const gitStatus = execFileSync('git', ['-C', 'lwcs', 'status', '--porcelain', '--', 'MVU.js'], {
  cwd: root,
  encoding: 'utf8',
});

addCheck('mvuJsNotModified', String(gitStatus || '').trim() === '', String(gitStatus || '').trim());
addCheck('mvuDoesNotPersistResolutionTrace', !/__battleResolutionTrace|__battleEventLedger|publicReportBlocks/.test(mvuSource));
addCheck(
  'resolutionTraceIsRuntimeNonEnumerable',
  /Object\.defineProperty\(rootData,\s*['"]__battleResolutionTrace['"][\s\S]*?enumerable:\s*false[\s\S]*?value:\s*\[\]/.test(battleRuntimeSource) &&
    !/Object\.defineProperty\(rootData,\s*['"]__battleResolutionTrace['"]/.test(battleUiSource),
);
addCheck(
  'eventLedgerIsRuntimeNonEnumerable',
  /Object\.defineProperty\([^)]+,\s*['"]__battleEventLedger['"][\s\S]*?enumerable:\s*false[\s\S]*?value:\s*\[\]/.test(battleRuntimeSource) &&
    !/Object\.defineProperty\([^)]+,\s*['"]__battleEventLedger['"]/.test(battleUiSource),
);
addCheck(
  'homogeneousStopOnlyAppearsAsNoEarlyStopFixture',
  !/同构停推|连续同构攻防提前终止/.test(battleUiSource) &&
    [...battleUiSource.matchAll(/同构/g)].every((match) => {
      const context = battleUiSource.slice(Math.max(0, match.index - 30), match.index + 40);
      return context.includes('不因同构攻防提前终止') || context.includes('同构攻防不应截断') || context.includes('自动续推同构攻防未提前截断');
    }),
);
addCheck(
  'noPublicReportSemanticReplace',
  !/publicReport\s*=\s*publicReport\.replace|publicReport\.replace\(|replace\([^)]*publicReport/.test(battleUiSource),
);
addCheck(
  'sourceKeepsFinalActionGuardrails',
  /finalActionName/.test(battleUiSource) && /discardedActionName/.test(battleUiSource) && /publicActionNotEqualFinalActionCount/.test(fs.readFileSync(path.resolve(root, 'tools/audit_battle_report_samples.mjs'), 'utf8')),
);
addCheck('productionHasNoLocalPrototypeFallback', !/战斗核心原型兜底表|本地原型兜底/.test(battleUiSource));
addCheck('productionHasNoEmbeddedFixtures', !/运行战斗回归夹具|生成战斗判定样本结果|注册\('基础普攻'/.test(battleUiSource));
addCheck('productionHasNoTestImplGlobals', !/root\.__LWCS_[A-Z0-9_]*_IMPL__/.test(battleUiSource));
addCheck(
  'productionHasSingleDebugRoot',
  [...battleUiSource.matchAll(/root\.(__LWCS_DEBUG_[A-Z0-9_]+)\s*=/g)].map(match => match[1]).join(',') === '__LWCS_DEBUG_RUN_BATTLE_CASE__',
);
addCheck(
  'runtimeRequiresSharedPrototypeRegistry',
  /__LWCS_SKILL_MECHANISM_REGISTRY__/.test(battleRuntimeSource) && /battle_runtime_shared_prototype_registry_missing/.test(battleRuntimeSource),
);
addCheck(
  'prototypeRuntimeContractOwnedByRuntime',
  /const prototypeRuntimeContract\s*=\s*Object\.freeze/.test(battleRuntimeSource) &&
    /prototypeRuntimeContract/.test(battleRuntimeSource) &&
    !/const BATTLE_PROTOTYPE_RUNTIME_CONTRACT\s*=\s*Object\.freeze/.test(battleUiSource),
);
addCheck(
  'objectiveScoringOwnedByDecision',
  /const objectiveUtility = clamp\(objectiveRelevantStateGain \+ terminalUtility \+ objectiveProgress \+ informationValue - irreversibleCost - catastrophicRisk, -200, 200\)/.test(battleDecisionSource) &&
    !/calculateObjectiveScore|summarizeScoreContributions|评估技能规划净收益/.test(`${battleRuntimeSource}\n${battleUiSource}`),
);
addCheck(
  'baseDamageMathOwnedByRuntime',
  /function calculateBaseDamage\(/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.calculateBaseDamage\(/.test(battleUiSource) &&
    !/damage\s*=\s*威力倍率\s*\*/.test(battleUiSource),
);
addCheck(
  'subjectiveDecisionMathOwnedByDecision',
  /function normalizeUtilities\(/.test(battleDecisionSource) &&
    /function selectCandidate\(/.test(battleDecisionSource) &&
    /maxNormalizedRegret/.test(battleDecisionSource) &&
    !/buildDecisionProfile|normalizeDecisionScores|BATTLE_RUNTIME\.selectCandidate/.test(`${battleRuntimeSource}\n${battleUiSource}`),
);
addCheck(
  'flatActionQueueCoreOwnedByRuntime',
  /function createActionQueue\(/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.createActionQueue\(/.test(battleUiSource) &&
    !/const compareNodes\s*=/.test(battleUiSource) &&
    !/actionSequence\s*>=\s*64/.test(battleUiSource),
);
addCheck(
  'ledgerTraceStorageOwnedByRuntime',
  /function ensureLedger\(/.test(battleRuntimeSource) &&
    /function ensureTrace\(/.test(battleRuntimeSource) &&
    /function nextRuntimeId\(/.test(battleRuntimeSource) &&
    !/function 确保战斗事件账本\(/.test(battleUiSource) &&
    !/function 确保战斗判定因果链\(/.test(battleUiSource),
);
addCheck(
  'ledgerWriterAndCausalNodesOwnedByRuntime',
  /function writeLedgerEvent\(/.test(battleRuntimeSource) &&
    /function 写入战斗目标分支节点\(/.test(battleRuntimeSource) &&
    /function 写入战斗反应窗口节点\(/.test(battleRuntimeSource) &&
    /function 写入战斗命中检定节点\(/.test(battleRuntimeSource) &&
    /function 写入战斗状态检定节点\(/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.writeLedgerEvent\(/.test(battleUiSource) &&
    !/function 写入战斗事件账本\(/.test(battleUiSource) &&
    !/writeLedgerEvent\s*:/.test(settlementBindingSource),
);
addCheck(
  'ledgerWriterHasNoFallbackResourceMutation',
  !/判定事件是保底资源恢复入口|写入保底资源恢复事实|fallback_resource_recovery/.test(`${battleRuntimeSource}\n${battleUiSource}`),
);
addCheck(
  'runtimeStateAndSnapshotOwnedByRuntime',
  /function ensureCombatRuntime\(combatData = \{\}\)/.test(battleRuntimeSource) &&
    /function getBattleSnapshot\(combatData = \{\}\)/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.ensureCombatRuntime\(/.test(battleUiSource) &&
    /BATTLE_RUNTIME\.getBattleSnapshot\(/.test(battleUiSource) &&
    !/function 确保战斗运行态\(|function ui_getBattleSnapshot\(/.test(battleUiSource),
);
addCheck(
  'factAuditOwnedByRuntime',
  /function auditFacts\(payload = \{\}\)/.test(battleRuntimeSource) &&
    /const audit = auditFacts\(\{/.test(battleRuntimeSource) &&
    !/function 审计战斗运行事实\(/.test(battleUiSource) &&
    !/BATTLE_RUNTIME\.auditFacts\(/.test(battleUiSource) &&
    !/auditFacts:\s*payload\s*=>/.test(battleUiSource) &&
    !/return requireEngine\(\)\.auditFacts/.test(battleRuntimeSource),
);
addCheck(
  'debugCaseOrchestrationOwnedByRuntime',
  /function runBattleCase\(options = \{\}\)/.test(battleRuntimeSource) &&
    /function runStructuredBattle\(input = \{\}\)/.test(battleRuntimeSource) &&
    /return runStructuredBattle\(input\)/.test(battleRuntimeSource) &&
    !/runDecisionTeamBattle|runStructuredShadowBattle|decisionEngine|next-shadow/.test(battleRuntimeSource) &&
    !/bindEngine|requireEngine|caseDomain/.test(battleRuntimeSource) &&
    !/bindEngine|caseDomain/.test(battleUiSource) &&
    !/function 运行战斗调试案例\(/.test(battleUiSource) &&
    !/runBattleCase:\s*options\s*=>/.test(battleUiSource) &&
    !/return requireEngine\(\)\.runBattleCase/.test(battleRuntimeSource),
);
addCheck(
  'caseDomainAdapterRemoved',
  !/bindEngine|requireEngine|caseDomain|executeDecisionTeam/.test(battleRuntimeSource) &&
    !/bindEngine|caseDomain|executeDecisionTeam/.test(battleUiSource),
);
addCheck(
  'settlementAdapterContainsOnlySettlementPrimitives',
  /function listPrimaryCombatUnits\(/.test(battleRuntimeSource) &&
    /function listSummonCombatUnits\(/.test(battleRuntimeSource) &&
    /function buildActionQueue\(/.test(battleRuntimeSource) &&
    /function buildCombatFinalStats\(/.test(battleRuntimeSource) &&
    /function isUnitIdentityMatch\(/.test(battleRuntimeSource) &&
    /function inferUnitSide\(/.test(battleRuntimeSource) &&
    /function isUnitAbleToFight\(/.test(battleRuntimeSource) &&
    /function buildDeclarationAction\(/.test(battleRuntimeSource) &&
    !/function 构建决策声明动作\(/.test(battleUiSource) &&
    /function writeInitialIntent\(/.test(battleRuntimeSource) &&
    !/function 写入行动轴初始意图节点\(/.test(battleUiSource) &&
    /function createCounterAction\(/.test(battleRuntimeSource) &&
    !/function 建立行为防反动作\(/.test(battleUiSource) &&
    /function createSettlementAdapters\(/.test(battleRuntimeSource) &&
    /function fillObjectiveDamageBaselines\(/.test(battleRuntimeSource) &&
    /function validateSoulTowerRoster\(/.test(battleRuntimeSource) &&
    /function evaluateBattleTerminal\(/.test(battleRuntimeSource) &&
    /function decideTeamContinuation\(/.test(battleRuntimeSource) &&
    /function readTeamAlive\(/.test(battleRuntimeSource) &&
    /function validateBattleRuntime\(/.test(battleRuntimeSource) &&
    /function finalizeTeamBattle\(/.test(battleRuntimeSource) &&
    /function buildRewindRoundSnapshot\(/.test(battleRuntimeSource) &&
    /function beginBattleRound\(/.test(battleRuntimeSource) &&
    /function settleBattleRoundEnd\(/.test(battleRuntimeSource) &&
    /function ensureSummonWindowRuntime\(/.test(battleRuntimeSource) &&
    /function removeSummonUnit\(/.test(battleRuntimeSource) &&
    /function consumeSummonWindow\(/.test(battleRuntimeSource) &&
    /function syncRoundEndUnit\(/.test(battleRuntimeSource) &&
    /function refreshSummonMentalLoad\(/.test(battleRuntimeSource) &&
    /function settleGuardSummonWindows\(/.test(battleRuntimeSource) &&
    /function settleRuleRewrite\(/.test(battleRuntimeSource) &&
    /function inferEffectPrototype\(/.test(battleRuntimeSource) &&
    /function inferEventSides\(/.test(battleRuntimeSource) &&
    /function findRecentLedgerAction\(/.test(battleRuntimeSource) &&
    /function findInitialIntentNode\(/.test(battleRuntimeSource) &&
    /normalizeActionDisplayName,[\s\S]*?normalizeActionRole,[\s\S]*?normalizeBattleSide,[\s\S]*?inferActionRole,[\s\S]*?inferFactType,[\s\S]*?inferEffectPrototype,[\s\S]*?normalizeTargetIds,[\s\S]*?normalizeActorControl,/.test(battleRuntimeSource) &&
    !/function 评估并记录战斗目标\(|function 填充战斗受伤条件基准\(/.test(battleUiSource) &&
    !/function validateSoulTowerCombatRoster\(|function 校验团战运行态\(/.test(battleUiSource) &&
    !/function 判定团战续推\(/.test(battleUiSource) &&
    !/function getTeamLivingCount\(|function 读取团战存活单位数\(/.test(battleUiSource) &&
    !/function 完成团战运行\(/.test(battleUiSource) &&
    !/function BattleDirectorRoundStart\(|function 清理本回合多威胁运行态\(|function 记录战斗上下文时光回溯快照\(|function 开始团战回合\(/.test(battleUiSource) &&
    !/function settleTeamRoundEnd\(/.test(battleUiSource) &&
    !/function 确保召唤窗口运行态\(|function 执行召唤回合开始\(|function 移除召唤运行态单位\(|function 消费召唤有效窗口\(/.test(battleUiSource) &&
    !/function 刷新召唤精神负载\(|function 写入召唤精神控制事件\(/.test(battleUiSource) &&
    !/function 结算护卫召唤回合窗口\(/.test(battleUiSource) &&
    !/function 递减战斗规则改写运行态\(/.test(battleUiSource) &&
    !/function 推断战斗事实类型\(|function 推断战斗事实原型\(|function 归一战斗目标ID列表\(|function 标准化战斗行动职责\(|function 推断战斗行动职责\(|function 标准化战斗操控来源\(|function 标准化战斗阵营侧\(/.test(battleUiSource) &&
    !/function 查找最近账本动作事件\(/.test(battleUiSource) &&
    !/function 查找行动轴初始意图节点\(/.test(battleUiSource) &&
    !/function 推断战斗目标阵营侧\(|function 推断战斗单位阵营侧\(|function 推断战斗事件阵营侧\(/.test(battleUiSource) &&
    /function normalizeLatestBattleRuntime\(/.test(battleRuntimeSource) &&
    /function hydrateRuntimeSummons\(/.test(battleRuntimeSource) &&
    /function settleSustainAtRoundEnd\(/.test(battleRuntimeSource) &&
    /const required = \[['"]executeQueue['"]\];/.test(battleRuntimeSource) &&
    /executeQueue:\s*\(queue, combatData, currentRound, logs, extraPatchOps\)\s*=>/.test(settlementBindingSource) &&
    !/prepare:|settleSustain:/.test(settlementBindingSource) &&
    !/function 准备团战运行态\(|function settleSustainEffectsAtRoundEnd\(|function 执行维持释放效果\(/.test(battleUiSource) &&
    /function settleConditionsAtRoundEnd\(/.test(battleRuntimeSource) &&
    !/settleConditions\s*:/.test(settlementBindingSource) &&
    !/function buildCombatFinalStats\(/.test(battleUiSource) &&
    !/buildSummonFinalStats\s*:/.test(settlementBindingSource) &&
    !/syncRoundEndUnit\s*:/.test(settlementBindingSource) &&
    !/function generateActionQueue\(/.test(battleUiSource) &&
    !/function 构建团战运行时适配器\(/.test(battleUiSource) &&
    !/listUnits:|listPrimaryUnits:|isUnitMatch:|normalizeActionName:|isSameReportName:|normalizeActionRole:|inferSide:|getHpMax:|isAbleToFight:/.test(settlementBindingSource),
);
addCheck(
  'formalDeclarationExecutionOwnedByRuntime',
  /function executeDeclaration\(input = \{\}\)/.test(battleRuntimeSource) &&
    /function executeStructuredDeclaration\(input = \{\}\)/.test(battleRuntimeSource) &&
    /executeDeclaration,/.test(battleRuntimeSource) &&
    /executeStructuredDeclaration,/.test(battleRuntimeSource) &&
    /const result = runStructuredBattle\(\{/.test(battleRuntimeSource) &&
    !/runtime\.playerLockedNaturalAction\s*=/.test(battleRuntimeSource) &&
    !/runDecisionTeamBattle/.test(battleRuntimeSource) &&
    !/domain\.executeDeclaration\(|executeDeclaration:\s*\(|executeStructuredDeclaration/.test(battleUiSource),
);
addCheck(
  'formalStructuredRunnerOwnedByRuntime',
  /function runStructuredBattle\(input = \{\}\)/.test(battleRuntimeSource) &&
    /function runBattleCase\(options = \{\}\)/.test(battleRuntimeSource) &&
    /runStructuredBattle\(input\)/.test(battleRuntimeSource) &&
    !/runStructuredShadowBattle|decisionEngine|next-shadow/.test(`${battleRuntimeSource}\n${battleUiSource}`),
);
addCheck(
  'battleModuleVersionsAreExactContracts',
  /battle_decision_preview_version_mismatch/.test(battleDecisionSource) &&
    /battle_runtime_preview_version_mismatch/.test(battleRuntimeSource) &&
    /battle_runtime_decision_version_mismatch/.test(battleRuntimeSource) &&
    /battle_runtime_version_mismatch/.test(battleUiSource) &&
    /battle_preview_version_mismatch/.test(battleUiSource) &&
    /battle_decision_version_mismatch/.test(battleUiSource),
);
addCheck(
  'candidateClassificationAndAlternativeGapOwnedByDecision',
  /function classifyCandidateEvidence\(candidates = \[\]\)/.test(battleDecisionSource) &&
    /classification:\s*candidate\.classification/.test(battleDecisionSource) &&
    /alternativeGap:\s*Number\(candidate\.alternativeGap/.test(battleDecisionSource) &&
    !/alternativeGap\s*[+\-]=|objectiveUtility\s*[+\-]=\s*alternativeGap/.test(battleDecisionSource),
);
addCheck(
  'structuredReportFactsOwnedByRuntime',
  /function buildActionChains\(eventLedger = \[\], resolutionTrace = \[\]\)/.test(battleRuntimeSource) &&
    /function buildReportBlocks\(eventLedger = \[\], decisionTrace = \[\], publicEntries = \[\]\)/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.buildReportBlocks\(/.test(battleUiSource) &&
    !/function 构建战斗行动链摘要\(/.test(battleUiSource) &&
    !/function 构建结构化战报Blocks\(/.test(battleUiSource) &&
    !/buildActionChains:\s*\(/.test(battleUiSource) &&
    !/buildReportBlocks:\s*\(/.test(battleUiSource),
);
addCheck(
  'traceNormalizationOwnedByRuntime',
  /function normalizeCausalNode\(node = \{\}\)/.test(battleRuntimeSource) &&
    /function cloneAuditSnapshot\(value, depth = 0\)/.test(battleRuntimeSource) &&
    /function collectDecisionTrace\(combatData = \{\}\)/.test(battleRuntimeSource) &&
    /function collectResolutionTrace\(combatData = \{\}\)/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.collectResolutionTrace\(/.test(battleUiSource) &&
    !/function 补齐战斗因果节点契约\(/.test(battleUiSource) &&
    !/function cloneBattleRuntimeAuditSnapshot\(/.test(battleUiSource) &&
    !/collectResolutionTrace:\s*/.test(battleUiSource) &&
    !/cloneAuditSnapshot:\s*/.test(battleUiSource),
);
addCheck(
  'roundOverviewFactsOwnedByRuntime',
  /function buildRoundOverview\(result = null, context = \{\}\)/.test(battleRuntimeSource) &&
    /for \(let round = 1; round <= actualRoundCount; round \+= 1\) pushRound\(round\)/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.buildRoundOverview\(/.test(battleUiSource) &&
    !/function 构建回合速览数据\(/.test(battleUiSource) &&
    !/buildRoundOverview:\s*\(/.test(battleUiSource),
);
addCheck(
  'finalSummaryFactsOwnedByRuntime',
  /function buildFinalSummary\(eventLedger = \[\], decisionTrace = \[\], finalSnapshot = \{\}, combatData = null\)/.test(battleRuntimeSource) &&
    /function resolveNextIntents\(input = \{\}\)/.test(battleRuntimeSource) &&
    /const resolvedIntents = battleEnded[\s\S]*?: resolveNextIntents\(/.test(battleRuntimeSource) &&
    /const \{ playerIntent, enemyIntent \} = resolvedIntents/.test(battleRuntimeSource) &&
    !/resolveNextIntents:|构建战斗总结下一行动意图\(/.test(battleUiSource) &&
    /BATTLE_RUNTIME\.buildFinalSummary\(/.test(battleUiSource) &&
    !/function 构建战斗总结数据\(/.test(battleUiSource) &&
    !/buildFinalSummary:\s*\(/.test(battleUiSource),
);
addCheck(
  'reportProjectionHelpersOwnedByRuntime',
  /function normalizePublicEntry\(item = \{\}\)/.test(battleRuntimeSource) &&
    /function projectPublicReportBlocks\(eventLedger = \[\]\)/.test(battleRuntimeSource) &&
    /function resolveReportUnitSide\(context = \{\}, unitName = ''\)/.test(battleRuntimeSource) &&
    !/buildPublicReportBlocks:|normalizePublicEntry:|resolveReportUnitSide:/.test(battleUiSource),
);
addCheck(
  'aiNarrativeSummaryOwnedByRuntime',
  /function buildAiNarrativeSummary\(aiSummaryInput = \{\}, options = \{\}\)/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.buildAiNarrativeSummary\(/.test(battleUiSource) &&
    !/function 构建LLM战斗语义摘要\(/.test(battleUiSource) &&
    !/buildLlmSummary:\s*\(/.test(battleUiSource) &&
    !/eventLedger|decisionTrace|resolutionTrace|publicReport|innerHTML|querySelector/.test(
      battleRuntimeSource.match(/function buildAiNarrativeSummary\([\s\S]*?(?=\n  function )/)?.[0] || ''
    ),
);
addCheck(
  'candidateFinalizationOwnedByDecision',
  /function paretoFilter\(candidates = \[\]\)/.test(battleDecisionSource) &&
    /function dominates\(left, right\)/.test(battleDecisionSource) &&
    !/finalizeCandidates|strictlyDominated/.test(`${battleRuntimeSource}\n${battleUiSource}`),
);
addCheck(
  'subjectiveCandidateSelectionOwnedByDecision',
  /function selectCandidate\(candidates, actor, seed, context = \{\}\)/.test(battleDecisionSource) &&
    /Math\.exp\(\(candidate\.normalizedUtility - eligible\[0\]\.normalizedUtility\)/.test(battleDecisionSource) &&
    !/chooseActorActionByCandidates|选择主观行为候选/.test(battleUiSource),
);
addCheck(
  'prototypeCoverageAuditOwnedByRuntime',
  /function auditPrototypeCoverage\(\)/.test(battleRuntimeSource) &&
    !/function 审计战斗原型运行覆盖\(/.test(battleUiSource) &&
    !/auditPrototypeCoverage:\s*payload\s*=>/.test(battleUiSource),
);
addCheck(
  'previewPipelineOwnedByPreviewModule',
  /function previewAction\(input = \{\}\)/.test(battlePreviewSource) &&
    /PreviewOverlay/.test(battlePreviewSource) &&
    !/function previewSkill\(payload = \{\}\)|previewDomain:\s*\{/.test(`${battleRuntimeSource}\n${battleUiSource}`),
);
addCheck(
  'teamRoundRunnerOwnedByRuntime',
  /function runStructuredBattle\(input = \{\}\)/.test(battleRuntimeSource) &&
    /for \(let roundOffset = 1; roundOffset <= roundLimit; roundOffset \+= 1\)/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.runBattleCase\(\{/.test(battleUiSource) &&
    !/while\s*\(rounds\s*<\s*maxRounds\)/.test(battleUiSource),
);
addCheck(
  'duelContinuationOwnedByRuntime',
  /function decideDuelContinuation\(options = \{\}\)/.test(battleRuntimeSource) &&
    /function decideTeamContinuation\(context = \{\}, adapterOptions = \{\}\)/.test(battleRuntimeSource) &&
    /return decideDuelContinuation\(\{/.test(battleRuntimeSource) &&
    !/BATTLE_RUNTIME\.decideDuelContinuation\(/.test(battleUiSource) &&
    !/continueThresholdReached/.test(battleUiSource),
);
addCheck(
  'duelRoundLoopOwnedByRuntime',
  /function runStructuredBattle\(input = \{\}\)/.test(battleRuntimeSource) &&
    /for \(let roundOffset = 1; roundOffset <= roundLimit; roundOffset \+= 1\)/.test(battleRuntimeSource) &&
    /function 运行正式决策战斗\(/.test(battleUiSource) &&
    /BATTLE_RUNTIME\.runBattleCase\(\{/.test(battleUiSource) &&
    !/function runDecisionTeamBattleSimulation\(/.test(battleUiSource) &&
    !/BATTLE_RUNTIME\.runDuelRounds\(/.test(battleUiSource) &&
    !/while\s*\(\s*roundCount < maxRounds/.test(battleUiSource),
);
addCheck(
  'duelRoundDeclarationHasSinglePath',
  !/构建单挑回合宣告|执行单挑回合交锋|executeDuelRound/.test(battleUiSource) &&
    /function buildActionQueue\(combatData = \{\}\)/.test(battleRuntimeSource) &&
    /createActionQueue\(\{/.test(battleRuntimeSource) &&
    /function beginStructuredDeclaration\(input = \{\}\)/.test(battleRuntimeSource) &&
    /function executeStructuredDeclaration\(input = \{\}\)/.test(battleRuntimeSource) &&
    !/__decisionResolver|generateActionQueue|runDecisionTeamBattle/.test(battleRuntimeSource) &&
    !/buildQueue\s*:|recordQueue\s*:/.test(settlementBindingSource),
);
addCheck(
  'duelNpcPressureHasSingleSettlementPath',
  !/执行NPC主动压制|玩家动作尚未落地|顶住先手压制，继续完成/.test(battleUiSource) &&
    /Array\.isArray\(options\?\.initialEntries\)[\s\S]*?\.forEach\(\(actorEntry, index\)/.test(battleRuntimeSource) &&
    battleRuntimeSource.includes("grantId: `natural:${round}:${actorEntry?.side || ''}:${describeActor(actorEntry) || 'unit'}:${index + 1}`"),
);
addCheck(
  'duelClashAndRoundTerminalAreSeparated',
  !/执行单挑回合交锋|结算单挑回合尾阶段|executeDuelRound/.test(battleUiSource) &&
    /const queueResult = adapters\.executeQueue\([\s\S]*?if \(queueResult\?\.fatal\)[\s\S]*?else \{\s*const terminalAlive = adapters\.readAlive\(combatData\);[\s\S]*?if \(terminalAlive\.playerAlive > 0 && terminalAlive\.enemyAlive > 0\) \{\s*adapters\.settleRoundEnd\?\./.test(battleRuntimeSource),
);
addCheck(
  'duelForcedTerminalCannotBeOverwrittenByContinuation',
  !/forcedStop|蓄力反噬终止本轮/.test(battleUiSource) &&
    /if \(queueResult\?\.fatal \|\| lastAlive\.playerAlive <= 0 \|\| lastAlive\.enemyAlive <= 0\) break;/.test(battleRuntimeSource) &&
    /if \(continuation\?\.continueSimulation === false\) break;/.test(battleRuntimeSource),
);
addCheck(
  'duelRoundTickHasSingleDomainPath',
  !/结算单挑回合尾阶段/.test(battleUiSource) &&
    /function settleBattleRoundEnd\(combatData = \{\}, logs = \[\], settlement, adapterOptions = \{\}\)/.test(battleRuntimeSource) &&
    /const sustainResult = settleSustainAtRoundEnd\(unit,[\s\S]*?const conditionResult = settleConditionsAtRoundEnd\(unit/.test(battleRuntimeSource) &&
    !/function settleTeamRoundEnd\(/.test(battleUiSource),
);
addCheck(
  'castInterruptionBacklashIsLedgeredWithSingleTerminalPath',
  !/结算蓄力打断反噬/.test(battleUiSource) &&
    /function applyCastInterruptBacklash\(targetChar, sourceActor, attackAction, combatData\)/.test(battleUiSource) &&
    /function resolveCastInterruptOnDamage\(/.test(battleUiSource) &&
    /const backlash = applyCastInterruptBacklash\(targetChar, sourceActor, attackAction, combatData/.test(battleUiSource) &&
    /ruleCode:\s*['"]CAST_INTERRUPTION_BACKLASH['"][\s\S]*?appliedDamage:\s*damage/.test(battleUiSource) &&
    /sourceEffectId:\s*['"]CAST_INTERRUPTION_BACKLASH['"]/.test(battleUiSource) &&
    /eventKind:\s*['"]state_apply['"][\s\S]*?sourceEffectId:\s*['"]CAST_INTERRUPTION_BACKLASH_STIFFNESS['"]/.test(battleUiSource) &&
    [...battleUiSource.matchAll(/设置战斗血量值\(targetChar, hpBefore - damage\)/g)].length === 1,
);
addCheck(
  'duelProtectionSettlesActualTargetThroughLedger',
  !/应用单挑系统资源终值|SYSTEM_RESOURCE_SETTLEMENT/.test(battleUiSource) &&
    /function settleDeathSaveOnLethalDamage\(targetChar, sourceActor, sourceAction, combatData\)/.test(battleUiSource) &&
    /ruleCode:\s*['"]DEATH_SAVE_RESOURCE_SETTLEMENT['"][\s\S]*?meta:\s*\{ resource:\s*resourceName, resourceKey, delta, reason \}/.test(battleUiSource) &&
    /settleDeathSaveOnLethalDamage\(sharedTarget, attacker, attackAction/.test(battleUiSource) &&
    /settleDeathSaveOnLethalDamage\(targetChar, attacker, attackAction/.test(battleUiSource),
);
addCheck(
  'duelPrimarySettlementUsesActionQueue',
  /function executeActionNodes\(options = \{\}\)/.test(battleRuntimeSource) &&
    /function 执行单挑队列结算\(/.test(battleUiSource) &&
    [...battleUiSource.matchAll(/executeClash\(/g)].length === 3 &&
    !/const supportResult\s*=\s*executeClash\(|const 玩家延后结算\s*=\s*executeClash\(/.test(battleUiSource),
);
addCheck(
  'duelCounterQueueBindsParent',
  /actionRole:\s*['"]COUNTER['"][\s\S]*?parentActionSequence:\s*Number\(父队列节点\?\.actionSequence/.test(battleUiSource) &&
    /traceCombatData:\s*战斗数据/.test(battleUiSource),
);
addCheck(
  'structuredActionDeclarationOnly',
  /function buildActionDeclaration\(/.test(battleUiSource) &&
    /parsePlayerIntent\(playerInput, combatData, options\.actionDeclaration\)/.test(battleUiSource) &&
    !/\[动作队列\]|parseSerializedPlayerActionQueue|buildSerializedEntryFromAction|旧动作队列/.test(battleUiSource),
);
addCheck(
  'actionDeclarationCrossesBridge',
  /__executePlayerBattleIntentImpl[\s\S]*?actionDeclaration:\s*options\.actionDeclaration/.test(battleUiSource) &&
    /__executeBattleFlowImpl[\s\S]*?buildActionDeclaration\?\.\(actionList\)/.test(battleUiSource),
);
addCheck(
  'noFixedTargetCandidateTruncation',
  !/(?:validTargets|effectiveTargets|机械合法目标|候选目标|敌方列表|友方列表)\s*\.slice\(0\s*,\s*[235]\)/.test(battleUiSource) &&
    !/\btop[_-]?k\b|候选目标截断|威胁排序截断/i.test(battleUiSource),
);
addCheck(
  'productionHasNoFactionReactionCap',
  !/FACTION_REACTION_LIMIT|factionReactionLimit|factionLimit/.test(
    `${battleRuntimeSource}\n${battleDecisionSource}\n${battleUiSource}`,
  ),
);
addCheck(
  'summonsDoNotReuseHostSkillLibrary',
  !/构建继承召唤技能列表|召唤技能允许继承/.test(battleUiSource) &&
    /单位\.技能列表\s*=\s*构建召唤技能列表\(单位\)/.test(battleUiSource),
);
addCheck(
  'runtimeDoesNotPublishTestAuditGlobals',
  !/__战斗真实行为审计样本|__LWCS_LAST_BATTLE_PREVIEW__/.test(battleUiSource),
);
addCheck(
  'decisionAuditKeepsSelectedAndTwoAlternatives',
  /const alternatives = normalized\.filter\([\s\S]*?\.slice\(0, 2\)/.test(battleDecisionSource) &&
    /scoreAudit:\s*Object\.freeze\(\[selected, \.\.\.alternatives\]/.test(battleDecisionSource) &&
    !/换招候选排序结果\s*=\s*collectCombatSkills/.test(battleUiSource),
);
addCheck(
  'publicDecisionAuditDropsFullCandidatesAndPreviews',
  /function buildDecisionAuditRecord\(decision = \{\}\)/.test(battleRuntimeSource) &&
    !/function buildDecisionAuditRecord\(decision = \{\}\)[\s\S]*?candidates:\s*decision\?\.candidates/.test(battleRuntimeSource) &&
    !/selected:\s*\{[\s\S]*?preview:\s*selected\?\.preview/.test(battleRuntimeSource) &&
    /!Object\.hasOwn\(item, 'candidates'\)/.test(fs.readFileSync(path.resolve(root, 'lwcs/tools/audit_battle_v73_formal_cases.mjs'), 'utf8')),
);
addCheck(
  'decisionReleasesFullCandidatePoolAfterInspection',
  !/candidates:\s*Object\.freeze\(normalized\)/.test(battleDecisionSource) &&
    /typeof input\.inspectCandidates === ['"]function['"]/.test(battleDecisionSource) &&
    !/inspectCandidates/.test(`${battleRuntimeSource}\n${battleUiSource}`) &&
    !/preview:\s*selected(?:\?\.)?\.preview/.test(battleDecisionSource),
);
addCheck(
  'authoritativeGateUsesTrackedFormalTools',
  [
    'lwcs/tools/audit_battle_r63_prototype_e2e.mjs',
    'lwcs/tools/audit_battle_r63_scenario_matrix.mjs',
    'lwcs/tools/audit_battle_v73_formal_cases.mjs',
    'lwcs/tools/audit_battle_report_render_html.mjs',
    'lwcs/tools/audit_battle_ledger_strictness.mjs',
    'lwcs/tools/audit_battle_v73_performance.mjs',
  ].every(toolPath => gateSource.includes(toolPath)) &&
    !/['"]tools\/(?:audit_battle_v73_formal_cases|audit_battle_report_render_html|audit_battle_ledger_strictness|audit_battle_v73_performance)\.mjs['"]/.test(gateSource),
);
addCheck(
  'enemyDecisionWorldUsesBeliefProjection',
  /function buildDecisionWorld\(worldSnapshot = \{\}, actorId = '', beliefState = \{\}\)/.test(battleDecisionSource) &&
    /const beliefUnit = beliefState\?\.units\?\.\[id\] \|\| \{\}/.test(battleDecisionSource) &&
    /const perceivedLevel = lower \+ \(upper - lower\)/.test(battleDecisionSource) &&
    /技能列表:\s*\[\]/.test(battleDecisionSource) &&
    !/const projected\s*=\s*\{\s*\.\.\.sourceUnit/.test(battleDecisionSource),
);
addCheck(
  'strategicHistoryUsesObservedChanges',
  /const previousCapacity = Number\(history\.at\(-1\)\?\.capacityTotal\)/.test(battleRuntimeSource) &&
    /history\.push\(\{[\s\S]*?capacityChangePercent:[\s\S]*?beliefRevision:\s*currentBeliefRevision/.test(battleRuntimeSource) &&
    /newInformation:\s*!!previousBeliefRevision && previousBeliefRevision !== currentBeliefRevision/.test(battleRuntimeSource) &&
    /pendingEffect:\s*decisionResult\?\.pendingStrategicEffect === true/.test(battleRuntimeSource) &&
    !/const previousCapacity = Number\(history\.at\(-1\)\?\.capacityTotal\)/.test(battleUiSource) &&
    !/capacityChangePercent:\s*0\b|newInformation:\s*false\b|pendingEffect:\s*false\b/.test(battleUiSource),
);
addCheck(
  'terminalCheckPrecedesRoundTick',
  /const terminalAlive = adapters\.readAlive\(combatData\);[\s\S]*?terminalAlive\.playerAlive > 0 && terminalAlive\.enemyAlive > 0[\s\S]*?adapters\.settleRoundEnd\?\./.test(battleRuntimeSource) &&
    !/else \{\s*adapters\.settleRoundEnd\?\.\(combatData, logs\)/.test(battleRuntimeSource),
);
addCheck(
  'hardControlRevalidatesQueuedOpportunities',
  /\['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞'\]\.includes\(状态\)/.test(battleUiSource) &&
    /if \(isActorHardControlled\(actor\)\)[\s\S]*?CONTROLLED_BEFORE_OPPORTUNITY/.test(battleUiSource) &&
    /eventKind:\s*['"]lost_opportunity['"][\s\S]*?reasonCode/.test(battleUiSource),
);
addCheck(
  'summonAssistCannotBecomeSecondActiveRoot',
  /eventKind:\s*['"]summon_assist['"][\s\S]*?actionRole:\s*['"]ASSIST['"]/.test(battleUiSource) &&
    /const 父动作事件 = options\?\.parentActionEvent[\s\S]*?parentActionEvent:\s*父动作事件/.test(battleUiSource) &&
    !/eventKind:\s*['"]summon_assist['"][\s\S]{0,320}?actionRole:\s*['"]ACTIVE['"]/.test(battleUiSource),
);
addCheck(
  'legacyFixtureExecutorsRetiredFromAuthoritativeGate',
  !/name:\s*['"]auditBattleReportSamples['"]/.test(gateSource) &&
    !/name:\s*['"]runBattleClosureAudit['"]/.test(gateSource) &&
    !/run_battle_closure_audit\.mjs/.test(gateSource) &&
    [
      'auditBattleR63PrototypeMatrix',
      'auditBattleR63DecisionSettlement',
      'auditBattleBehaviorLogicMatrix',
      'auditBattleDeterminism',
      'auditBattleR63ManualReview',
      'auditBattleLedgerStrictness',
    ].every(checkName => gateSource.includes(`name: '${checkName}'`)),
);
addCheck(
  'legacyDecisionPathsRemoved',
  !/runLegacyBattleCase|shadowDecisions|SHADOWED|评估技能规划净收益|评估技能行为库衔接收益|估算效果行为库衔接收益|chooseActorActionByCandidates|buildAutoActionForActor|determineNpcAction/.test(`${battleRuntimeSource}\n${battleDecisionSource}\n${battleUiSource}`),
);
addCheck(
  'productionHasNoRepeatDecayScoringPath',
  !/repeatDecay|repeatMultiplier|scoreBeforeRepeat|scoreAfterRepeat|repeatException|高价复读|完整候选池/.test(battleUiSource),
);
addCheck(
  'sampleAcceptanceIsExplicitOnly',
  /--accept-samples/.test(gateSource) &&
    /if\s*\(acceptSamples\s*&&\s*results\.every\(result\s*=>\s*result\.passed\)\)[\s\S]*?name:\s*['"]regenerateDecisionSamples['"]/.test(gateSource),
);
addCheck(
  'battleObjectiveEvaluatorIsShared',
  /function evaluateBattleObjectives\(/.test(battlePreviewSource) &&
    /function evaluateObjectiveConditionDetail\(/.test(battlePreviewSource) &&
    /function shouldTriggerTraumaUnconscious\(/.test(battlePreviewSource) &&
    /preview\.evaluateBattleObjectives\(/.test(battleDecisionSource) &&
    /previewRuntime\.evaluateBattleObjectives\(/.test(battleRuntimeSource) &&
    /BATTLE_RUNTIME\.evaluateBattleTerminal\(/.test(battleUiSource) &&
    /TRAUMA_UNCONSCIOUS/.test(battleUiSource) &&
    /battle_objective_resolved/.test(`${battleUiSource}\n${battleRuntimeSource}`),
);
addCheck(
  'battleRouteRequiresObjectiveContract',
  /battle_objectives_missing/.test(bridgeSource) &&
    /胜负条件字段完整/.test(bridgeSource) &&
    /胜利条件关系：填写 OR 或 AND/.test(routePresetSource) &&
    /失败条件关系：填写 OR 或 AND/.test(routePresetSource) &&
    /最大回合：填写1-20的正整数/.test(routePresetSource) &&
    /指定单位死亡/.test(routePresetSource) &&
    /全员死亡/.test(routePresetSource) &&
    /目标回合表示坚持到该回合即满足条件/.test(routePresetSource),
);
addCheck(
  'battleAdjudicationUsesStructuredTerminalFacts',
  /终局类型/.test(databaseAdapterSource) &&
    /终局原因/.test(databaseAdapterSource) &&
    /matchedDetails/.test(`${battleRuntimeSource}\n${bridgeSource}`) &&
    /battle_adjudication_death_hp_invalid/.test(bridgeSource) &&
    /battle_adjudication_incapacitated_hp_invalid/.test(bridgeSource) &&
    /battle_adjudication_draw_fields_invalid/.test(bridgeSource),
);
addCheck(
  'formalTeamBattlePersistsAuthoritativeFinalSnapshot',
  /Frontend team battle runtime produced the authoritative final snapshot/.test(battleUiSource) &&
    /syncHpRecoveryOnly:\s*false/.test(battleUiSource) &&
    /最终快照和终局事实已经通过确定性JSONPatch提交/.test(databaseAdapterSource),
);
addCheck(
  'battleObjectivesPersistOnlyInsideBattleState',
  /COMBAT_WORLD_PERSIST_KEYS\s*=\s*\[[\s\S]*?['"]胜负条件['"]/.test(battleUiSource) &&
    !/胜负条件/.test(mvuSource),
);

const failed = checks.filter((check) => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

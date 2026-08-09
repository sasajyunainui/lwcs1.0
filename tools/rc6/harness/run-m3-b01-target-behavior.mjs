import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptPath = fileURLToPath(import.meta.url);
const evidenceFileName = process.env.RC6_B01_EVIDENCE_FILE || 'b01-target-behavior-v3.json';
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm3', evidenceFileName);
const targetRegistryMarker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";
const foregroundCaseIds = [
  'duel_overmatch_lethal',
  'duel_peer_unknown_probe',
  'team_focus_without_overkill',
  'team_protect_critical_ally',
  'team_heal_crisis',
  'team_control_overlap',
];
const sevenVsSevenOpportunityCaseIds = [
  'raid_balanced',
  'raid_level_gap',
  'raid_control_heavy',
  'raid_summon_heavy',
  'raid_response_terminal_information',
];
const requiredSevenVsSevenCaseIds = [
  'raid_balanced',
  'raid_level_gap',
  'raid_control_heavy',
  'raid_summon_heavy',
  'raid_response_terminal_information',
];
const singleRoundCaseIds = [
  'raid_control_heavy',
  'raid_response_terminal_information',
];

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hashJson = value => sha256(JSON.stringify(value));
const stringValue = value => String(value ?? '').trim();
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

function targetDecisionSource() {
  const original = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
  if (original.includes(targetRegistryLine)) return original;
  const patched = original.replace(
    targetRegistryMarker,
    `${targetRegistryMarker}\n${targetRegistryLine}`,
  );
  if (patched === original) throw new Error('B01_TEST_REGISTRY_PATCH_MISSED');
  return patched;
}

function createTargetSandbox() {
  return loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: {
      'BattleDecision_Module.js': targetDecisionSource(),
    },
  });
}

function outputHash(sandbox, value) {
  const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
  return typeof preview?.stableHash === 'function'
    ? preview.stableHash(value)
    : hashJson(value);
}

function reportLayer(reportDto = {}) {
  const candidates = [
    reportDto.PLAYER,
    reportDto.player,
    reportDto.projection?.PLAYER,
    reportDto.projections?.PLAYER,
    reportDto.layers?.PLAYER,
    reportDto.content?.PLAYER,
  ];
  return candidates.find(value => value && typeof value === 'object') ||
    (stringValue(reportDto?.visibilityMode).toUpperCase() === 'PLAYER'
      ? reportDto
      : {});
}

function decisionFacts(draft = {}) {
  const decisions = Array.isArray(draft.decisions)
    ? draft.decisions
    : Array.isArray(draft.decisionJournal)
      ? draft.decisionJournal
      : Array.isArray(draft.decisionAudit)
        ? draft.decisionAudit
      : [];
  return decisions.map((decision, index) => {
    const selected = decision?.selected || {};
    const declaration = selected?.declaration || {};
    return {
      sequence: index + 1,
      actorId: stringValue(decision?.actorId || selected?.actorId),
      candidateId: stringValue(decision?.selectedCandidateId || selected?.candidateId),
      actionKind: stringValue(
        selected?.actionKind || declaration?.actionKind || decision?.actionKind,
      ).toUpperCase(),
      targetIds: Array.isArray(selected?.targetIds || declaration?.targetIds)
        ? [...(selected?.targetIds || declaration?.targetIds)].map(stringValue)
        : [],
      selectionMode: stringValue(
        decision?.decisionProfile?.selectionMode || selected?.selectionMode,
      ),
      candidateCount: finite(decision?.candidateCount),
      alternativeCount: Array.isArray(decision?.alternatives)
        ? decision.alternatives.length
        : null,
    };
  });
}

function anonymizeDecisionFacts(facts) {
  const unitAliases = new Map();
  const aliasFor = value => {
    const id = stringValue(value);
    if (!id) return '';
    if (!unitAliases.has(id)) unitAliases.set(id, `unit-${unitAliases.size + 1}`);
    return unitAliases.get(id);
  };
  return facts.map(fact => ({
    sequence: fact.sequence,
    actor: aliasFor(fact.actorId),
    actionKind: fact.actionKind,
    targetCount: fact.targetIds.length,
    selectionMode: fact.selectionMode,
    candidateCount: fact.candidateCount,
    alternativeCount: fact.alternativeCount,
  }));
}

function playerNumberReading(tokens = []) {
  return (Array.isArray(tokens) ? tokens : []).slice(0, 8).map(token => ({
    label: stringValue(token?.label),
    value: finite(token?.value),
    unit: stringValue(token?.unit),
    sourceName: stringValue(token?.sourceName),
    operation: stringValue(token?.operation),
    derivationRule: stringValue(token?.derivationRule),
    tacticalConsequence: stringValue(token?.tacticalConsequence),
    hasSourceEventId: Boolean(stringValue(token?.sourceEventId)),
    hasSourceFactId: Boolean(stringValue(token?.sourceFactId)),
  }));
}

function playerDecisionReading(explanation = {}) {
  return {
    round: finite(explanation?.round),
    actorName: stringValue(explanation?.actorName),
    decisionKind: stringValue(explanation?.decisionKind),
    selected: {
      name: stringValue(explanation?.selected?.name),
      targetNames: Array.isArray(explanation?.selected?.targetNames)
        ? explanation.selected.targetNames.map(stringValue)
        : [],
      status: stringValue(explanation?.selected?.status),
    },
    alternatives: (Array.isArray(explanation?.alternatives)
      ? explanation.alternatives
      : []).map(alternative => ({
        name: stringValue(alternative?.name),
        targetNames: Array.isArray(alternative?.targetNames)
          ? alternative.targetNames.map(stringValue)
          : [],
        reason: stringValue(alternative?.reason),
      })),
    comparison: stringValue(explanation?.comparisonEvidence?.explanation),
    predictedNumbers: playerNumberReading(explanation?.predicted?.numbers),
    actualNumbers: playerNumberReading(explanation?.actual?.numericTokens),
  };
}

function playerReading(reportDto = {}) {
  const decisions = Array.isArray(reportDto?.decisionExplanations)
    ? reportDto.decisionExplanations
    : [];
  const exchanges = Array.isArray(reportDto?.exchanges)
    ? reportDto.exchanges
    : [];
  const finalSummary = reportDto?.finalSummary || {};
  return {
    headline: stringValue(reportDto?.battleHeadline),
    finalSummaryText: stringValue(finalSummary?.text),
    finalHeadline: stringValue(finalSummary?.headline),
    finalTerminalDetail: stringValue(finalSummary?.terminalDetail),
    finalAdvantage: stringValue(finalSummary?.advantage),
    finalTrend: stringValue(finalSummary?.trend),
    finalRisks: Array.isArray(finalSummary?.risks)
      ? finalSummary.risks.map(stringValue)
      : [],
    exchangeCount: exchanges.length,
    exchangeTextSamples: [
      ...exchanges.slice(0, 2),
      ...(exchanges.length > 2 ? [exchanges.at(-1)] : []),
    ].map(exchange => ({
      text: stringValue(exchange?.text),
      responseSummary: stringValue(exchange?.responseSummary),
      resultSummary: stringValue(exchange?.resultSummary),
      continuationSummary: stringValue(exchange?.continuationSummary),
    })),
    decisionExplanationCount: decisions.length,
    decisionExplanationsWithAlternatives: decisions.filter(decision =>
      Array.isArray(decision?.alternatives) && decision.alternatives.length > 0,
    ).length,
    decisionExplanationsWithPublicPrediction: decisions.filter(decision =>
      decision?.predicted?.publicEvidenceAvailable === true,
    ).length,
    decisionExplanationsWithActualNumbers: decisions.filter(decision =>
      Array.isArray(decision?.actual?.numericTokens) &&
      decision.actual.numericTokens.length > 0,
    ).length,
    decisionSamples: [
      ...decisions.slice(0, 2),
      ...(decisions.length > 2 ? [decisions.at(-1)] : []),
    ].map(playerDecisionReading),
    aiReportSample: stringValue(reportDto?.aiReport).slice(0, 4000),
  };
}

function auditFatalSample(audit = {}) {
  const scoringAudit = Array.isArray(audit?.scoringAudit)
    ? audit.scoringAudit
    : [];
  return (Array.isArray(audit?.fatals) ? audit.fatals : [])
    .slice(0, 12)
    .map(fatal => {
      const decisionEngine = stringValue(
        fatal?.decisionEngine ||
        scoringAudit[fatal?.actionIndex]?.decisionEngine,
      ).toUpperCase();
      return ({
      code: stringValue(fatal?.code),
      actionIndex: finite(fatal?.actionIndex),
      candidateIndex: finite(fatal?.candidateIndex),
      candidateId: stringValue(fatal?.candidateId),
      missing: Array.isArray(fatal?.missing) ? [...fatal.missing] : [],
      kind: stringValue(fatal?.kind),
      candidateCount: finite(fatal?.candidateCount),
      decisionEngine,
      targetAudit: fatal?.targetAudit === true || decisionEngine === 'R9V2_TARGET',
      });
    });
}

function runCase(caseId, { roundsOverride = null } = {}) {
  const sandbox = createTargetSandbox();
  const definition = manualCasesById(sandbox).get(caseId);
  if (!definition) {
    return {
      schemaVersion: 'M3B01TargetBehaviorCaseV1',
      status: 'MISSING_FIXTURE',
      caseId,
      firstObservedLayer: 'EVIDENCE',
      failureCode: 'B01_CASE_MISSING',
    };
  }
  const input = formalInput(definition, 'r9v2');
  if (Number.isInteger(roundsOverride) && roundsOverride > 0) input.rounds = roundsOverride;
  input.settings = {
    ...input.settings,
    r9v2InformationValueOnly: true,
  };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  let stage = 'RUNTIME';
  let draft;
  let reportDto;
  let reportAudit;
  let sealedPackage;
  try {
    draft = runtime.executeBattleDraftR8(clone(input));
    stage = 'REPORT';
    reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
    stage = 'REPORT_AUDIT';
    reportAudit = report.auditProjection(reportDto);
    stage = 'SEAL';
    sealedPackage = runtime.sealBattleResult({ draft, reportAudit });
    stage = 'VERIFY';
    runtime.verifySealedBattlePackage(sealedPackage);
  } catch (error) {
    let diagnosticAudit = null;
    try {
      diagnosticAudit = runtime.runDecisionCase(clone(input))?.audit || null;
    } catch {
      diagnosticAudit = null;
    }
    return {
      schemaVersion: 'M3B01TargetBehaviorCaseV1',
      status: 'FAILED',
      caseId,
      firstObservedLayer: stage,
      failureCode: stringValue(error?.message || error),
      failureDetails: {
        fatalSample: auditFatalSample(diagnosticAudit),
        fatalCount: finite(diagnosticAudit?.fatalCount),
      },
      targetRegistryInjected: true,
      providerIds: sandbox.__LWCS_BATTLE_DECISION__?.providerIds || [],
    };
  }
  const facts = decisionFacts(draft);
    const authenticatedReportDto = reportAudit?.reportDto || reportDto;
    const player = reportLayer(authenticatedReportDto);
  const playerKeys = Object.keys(player).sort();
  const playerPayloadHash = outputHash(sandbox, player);
  const draftHash = outputHash(sandbox, draft);
  const reportHash = outputHash(sandbox, authenticatedReportDto);
  const sealedHash = outputHash(sandbox, sealedPackage);
  return {
    schemaVersion: 'M3B01TargetBehaviorCaseV1',
    status: 'COMPLETED',
    caseId,
    rounds: finite(input.rounds),
    actorCount: (
      (input.combatData?.参战者?.team_player || []).length +
      (input.combatData?.参战者?.team_enemy || []).length
    ),
    decisionCount: facts.length,
    terminalReached: draft?.terminalResult?.terminal === true || draft?.terminal?.terminal === true,
    firstObservedLayer: 'NONE_OBSERVED',
    targetRegistryInjected: true,
    providerIds: sandbox.__LWCS_BATTLE_DECISION__?.providerIds || [],
    player: {
      projectionStatus: stringValue(authenticatedReportDto?.projectionStatus),
      visibilityMode: stringValue(authenticatedReportDto?.visibilityMode),
      topLevelKeys: Object.keys(authenticatedReportDto || {}).sort(),
      playerKeys,
      playerPayloadHash,
      reportHash,
      reading: playerReading(authenticatedReportDto),
    },
    anonymousReview: {
      decisionFacts: anonymizeDecisionFacts(facts),
      decisionFactsHash: hashJson(anonymizeDecisionFacts(facts)),
    },
    developerReveal: {
      provider: 'r9v2',
      engineValues: [...new Set(facts.map(fact => fact.selectionMode).filter(Boolean))].sort(),
      draftHash,
      sealedHash,
      reportAuditStatus: reportAudit?.passed === true ? 'PASSED' : 'FAILED',
    },
    facts,
  };
}

function runOpportunity(caseId) {
  const sandbox = createTargetSandbox();
  const definition = manualCasesById(sandbox).get(caseId);
  if (!definition) {
    return {
      schemaVersion: 'M3B01TargetBehaviorOpportunityV1',
      status: 'MISSING_FIXTURE',
      caseId,
      firstObservedLayer: 'EVIDENCE',
      failureCode: 'B01_CASE_MISSING',
    };
  }
  const input = formalInput(definition, 'r9v2');
  input.settings = {
    ...input.settings,
    r9v2InformationValueOnly: true,
    decisionOnly: true,
  };
  input.analysisDepth = 'CANDIDATES_ONLY';
  const decision = sandbox.__LWCS_BATTLE_DECISION__;
  const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
  try {
    const worldSnapshot = clone(input.combatData);
    const actors = preview.listUnits(worldSnapshot)
      .filter(entry => preview.isAlive(entry.unit));
    const providerResults = actors.map((entry, index) => {
      const actorId = preview.unitId(entry.unit);
      const request = decision.prepareDecisionRequest({
        worldSnapshot,
        actorId,
        providerId: 'r9v2',
        analysisDepth: 'CANDIDATES_ONLY',
        r9v2InformationValueOnly: true,
        objectiveContract: input.battleIntent.objectives,
        battleIntent: input.battleIntent,
        beliefState: input.initialBelief?.[actorId] || input.initialBelief || {},
        actionOpportunity: {},
        strategyMemory: {},
        seed: `${input.seed}:${Number(worldSnapshot?.回合 || 0)}:${index}`,
        runtimeSnapshot: {},
      });
      return decision.runProvider({ providerId: 'r9v2', request });
    });
    const audits = providerResults.map(item => item?.decisionAudit || item?.audit || {});
    const fatalCount = audits.reduce((total, audit) =>
      total + Math.max(0, Number(audit?.fatalCount || 0)), 0);
    if (fatalCount > 0) throw new Error(`B01_OPPORTUNITY_FATAL:${fatalCount}`);
    return {
      schemaVersion: 'M3B01TargetBehaviorOpportunityV1',
      status: 'COMPLETED',
      caseId,
      scope: 'TARGET_PROVIDER_DECISION_ONLY_FROZEN_7V7_OPPORTUNITY',
      actorCount: providerResults.length,
      decisionCount: providerResults.length,
      candidateCounts: audits.map(audit => finite(audit?.candidateCount)),
      decisionEngines: [...new Set(audits.map(audit =>
        stringValue(audit?.decisionEngine).toUpperCase()).filter(Boolean))].sort(),
      fatalCount,
      targetRegistryInjected: true,
    };
  } catch (error) {
    return {
      schemaVersion: 'M3B01TargetBehaviorOpportunityV1',
      status: 'FAILED',
      caseId,
      scope: 'TARGET_PROVIDER_DECISION_ONLY_FROZEN_7V7_OPPORTUNITY',
      firstObservedLayer: 'DECISION',
      failureCode: stringValue(error?.message || error),
      targetRegistryInjected: true,
    };
  }
}

if (process.argv[2] === '--worker') {
  const caseId = stringValue(process.argv[3]);
  const roundsOverride = Number(process.argv[4] || 0);
  process.stdout.write(`${JSON.stringify(runCase(caseId, { roundsOverride }))}\n`);
  process.exit(0);
}

if (process.argv[2] === '--opportunity-worker') {
  const caseId = stringValue(process.argv[3]);
  process.stdout.write(`${JSON.stringify(runOpportunity(caseId))}\n`);
  process.exit(0);
}

const runWorker = ({ caseId, kind = 'transaction', roundsOverride = 0 }) => {
  const workerFlag = kind === 'opportunity' ? '--opportunity-worker' : '--worker';
  const workerArgs = kind === 'opportunity'
    ? [scriptPath, workerFlag, caseId]
    : [scriptPath, workerFlag, caseId, String(roundsOverride || 0)];
  const result = spawnSync(
    process.execPath,
    workerArgs,
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 300000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return {
      schemaVersion: 'M3B01TargetBehaviorCaseV1',
      status: 'TIMEOUT',
      caseId,
      scope: kind === 'opportunity'
        ? 'TARGET_PROVIDER_DECISION_ONLY_FROZEN_7V7_OPPORTUNITY'
        : 'TARGET_PROVIDER_RUNTIME_REPORT_SEAL_VERIFY',
      firstObservedLayer: 'RUNTIME',
      failureCode: 'B01_CASE_TIMEOUT',
    };
  }
  if (result.status !== 0) {
    return {
      schemaVersion: 'M3B01TargetBehaviorCaseV1',
      status: 'FAILED',
      caseId,
      scope: kind === 'opportunity'
        ? 'TARGET_PROVIDER_DECISION_ONLY_FROZEN_7V7_OPPORTUNITY'
        : 'TARGET_PROVIDER_RUNTIME_REPORT_SEAL_VERIFY',
      firstObservedLayer: 'HARNESS',
      failureCode: `B01_WORKER_FAILED:${String(result.stderr || result.stdout || '').slice(-1000)}`,
    };
  }
  try {
    return JSON.parse(String(result.stdout || '{}'));
  } catch (error) {
    return {
      schemaVersion: 'M3B01TargetBehaviorCaseV1',
      status: 'FAILED',
      caseId,
      scope: kind === 'opportunity'
        ? 'TARGET_PROVIDER_DECISION_ONLY_FROZEN_7V7_OPPORTUNITY'
        : 'TARGET_PROVIDER_RUNTIME_REPORT_SEAL_VERIFY',
      firstObservedLayer: 'HARNESS',
      failureCode: `B01_WORKER_JSON_INVALID:${error.message}`,
    };
  }
};

if (process.argv[2] === '--transactions-only') {
  const rows = [
    ...foregroundCaseIds.map(caseId =>
      runWorker({ caseId, kind: 'transaction' })),
    ...singleRoundCaseIds.map(caseId =>
      runWorker({ caseId, kind: 'transaction', roundsOverride: 1 })),
  ];
  const output = {
    schemaVersion: 'M3B01TransactionEvidenceV1',
    status: rows.every(row => row.status === 'COMPLETED') ? 'PASSED' : 'FAILED',
    scope: 'TARGET_PROVIDER_CURRENT_HASH_RUNTIME_REPORT_SEAL_VERIFY',
    formalProvider: 'r8',
    targetProvider: 'r9v2_unregistered_test_registry_only',
    foregroundCaseIds,
    singleRoundCaseIds,
    rows,
    sourceHashes: {
      decision: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
      runtime: sha256(fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'))),
      report: sha256(fs.readFileSync(path.join(repoRoot, 'BattleReport_Module.js'))),
      kernel: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
      harness: sha256(fs.readFileSync(scriptPath)),
      fixtureSource: sha256(fs.readFileSync(path.join(repoRoot, 'tools', 'battle_r63_manual_cases.mjs'))),
    },
  };
  const transactionEvidenceName = process.env.RC6_B01_TRANSACTION_EVIDENCE_FILE ||
    'm3-b01-transactions-20260809.json';
  const transactionEvidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm3', transactionEvidenceName);
  fs.mkdirSync(path.dirname(transactionEvidencePath), { recursive: true });
  fs.writeFileSync(transactionEvidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exit(output.status === 'PASSED' ? 0 : 1);
}

if (process.argv[2] === '--opportunities-only') {
  const rows = sevenVsSevenOpportunityCaseIds.map(caseId =>
    runWorker({ caseId, kind: 'opportunity' }));
  const output = {
    schemaVersion: 'M3B01FrozenOpportunityEvidenceV1',
    status: rows.every(row => row.status === 'COMPLETED') ? 'PASSED' : 'FAILED',
    scope: 'TARGET_PROVIDER_DECISION_ONLY_FROZEN_7V7_OPPORTUNITY',
    formalProvider: 'r8',
    targetProvider: 'r9v2_unregistered_test_registry_only',
    caseIds: sevenVsSevenOpportunityCaseIds,
    rows,
    sourceHashes: {
      decision: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
      runtime: sha256(fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'))),
      kernel: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
      harness: sha256(fs.readFileSync(scriptPath)),
      fixtureSource: sha256(fs.readFileSync(path.join(repoRoot, 'tools', 'battle_r63_manual_cases.mjs'))),
    },
  };
  const opportunityEvidenceName = process.env.RC6_B01_OPPORTUNITY_EVIDENCE_FILE ||
    'm3-b01-frozen-opportunities-20260809.json';
  const opportunityEvidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm3', opportunityEvidenceName);
  fs.mkdirSync(path.dirname(opportunityEvidencePath), { recursive: true });
  fs.writeFileSync(opportunityEvidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exit(output.status === 'PASSED' ? 0 : 1);
}

const foregroundRows = foregroundCaseIds.map(caseId =>
  runWorker({ caseId, kind: 'transaction' }));
const opportunityRows = sevenVsSevenOpportunityCaseIds.map(caseId =>
  runWorker({ caseId, kind: 'opportunity' }));
const singleRoundRows = singleRoundCaseIds.map(caseId =>
  runWorker({ caseId, kind: 'transaction', roundsOverride: 1 }));
const rows = [...foregroundRows, ...opportunityRows, ...singleRoundRows];
const missingSevenVsSevenFixtures = requiredSevenVsSevenCaseIds.filter(caseId =>
  !opportunityRows.some(row => row.caseId === caseId && row.status === 'COMPLETED'),
);
const completedForegroundRows = foregroundRows.filter(row => row.status === 'COMPLETED');
const completedOpportunityRows = opportunityRows.filter(row => row.status === 'COMPLETED');
const completedSingleRoundRows = singleRoundRows.filter(row => row.status === 'COMPLETED');
const output = {
  schemaVersion: 'M3B01TargetBehaviorEvidenceV1',
  status: rows.some(row => ['FAILED', 'TIMEOUT'].includes(row.status))
    ? 'TARGET_FULL_TRANSACTION_PARTIAL_FAILURE'
    : missingSevenVsSevenFixtures.length || completedSingleRoundRows.length < singleRoundCaseIds.length
      ? 'EVIDENCE_GAP_MISSING_REQUIRED_CASE'
      : completedForegroundRows.length === foregroundCaseIds.length &&
          completedOpportunityRows.length === sevenVsSevenOpportunityCaseIds.length
        ? 'COMPLETED_FACT_CAPTURE'
        : 'INSUFFICIENT_OBSERVATIONS',
  scope: 'TARGET_PROVIDER_CURRENT_HASH_BEHAVIOR_FACT_CAPTURE',
  formalProvider: 'r8',
  targetProvider: 'r9v2_unregistered_test_registry_only',
  playerFirstReadingRequired: true,
  anonymousReviewRequired: true,
  developerRevealRestrictedToAmbiguousCases: true,
  foregroundCaseIds,
  sevenVsSevenOpportunityCaseIds,
  singleRoundCaseIds,
  requestedCaseIds: [...new Set([
    ...foregroundCaseIds,
    ...sevenVsSevenOpportunityCaseIds,
  ])],
  requiredSevenVsSevenCaseIds,
  missingSevenVsSevenFixtures,
  observationCount: rows.filter(row => row.status === 'COMPLETED').length,
  completedForegroundCount: completedForegroundRows.length,
  completedOpportunityCount: completedOpportunityRows.length,
  completedSingleRoundCount: completedSingleRoundRows.length,
  rows,
  sourceHashes: {
    decision: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
    preview: sha256(fs.readFileSync(path.join(repoRoot, 'BattlePreview_Module.js'))),
    runtime: sha256(fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'))),
    report: sha256(fs.readFileSync(path.join(repoRoot, 'BattleReport_Module.js'))),
    kernel: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
    harness: sha256(fs.readFileSync(scriptPath)),
    fixtureSource: sha256(fs.readFileSync(path.join(repoRoot, 'tools', 'battle_r63_manual_cases.mjs'))),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
  repoRoot,
  sha256,
  sourceHashes,
} from './r83_rc6_battle_harness.mjs';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0
    ? String(process.argv[index + 1] || '').trim()
    : fallback;
}

function positiveInteger(name, fallback) {
  const value = Number(argValue(name, fallback));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`RC6_PHASE3_PROFILE_ARGUMENT_INVALID:${name}`);
  }
  return value;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil(sorted.length * ratio) - 1,
    ),
  );
  return sorted[index];
}

function round(value) {
  return Number(Number(value || 0).toFixed(3));
}

function addTiming(summary, timing = {}) {
  summary.count += 1;
  for (const key of [
    'totalMs',
    'contextBuildMs',
    'runtimeSnapshotAndInvalidationMs',
    'prepareMs',
    'providerMs',
  ]) {
    summary[key] += Number(timing?.[key] || 0);
  }
}

function emptyTiming() {
  return {
    count: 0,
    totalMs: 0,
    contextBuildMs: 0,
    runtimeSnapshotAndInvalidationMs: 0,
    prepareMs: 0,
    providerMs: 0,
  };
}

function finalizeTiming(summary) {
  const result = {};
  Object.entries(summary).forEach(([key, value]) => {
    result[key] = key === 'count' ? value : round(value);
  });
  result.unattributedDecisionMs = round(
    result.totalMs -
      result.contextBuildMs -
      result.runtimeSnapshotAndInvalidationMs -
      result.prepareMs -
      result.providerMs,
  );
  return result;
}

function summarizeDecisions(draft) {
  const diagnostics =
    draft.runtimeDiagnostics?.decisionPerformanceDiagnostics || [];
  const decisions = Array.isArray(draft.decisionAudit)
    ? draft.decisionAudit
    : [];
  const overall = emptyTiming();
  const byRole = new Map();
  const workload = {
    observerPoolUnitCount: 0,
    observerPoolEntryCount: 0,
    rebuiltUnitCount: 0,
    currentCandidateCount: 0,
    allUnitsRebuiltDecisionCount: 0,
    zeroUnitsRebuiltDecisionCount: 0,
    partialUnitsRebuiltDecisionCount: 0,
    rebuildWidthBuckets: {
      '0': 0,
      '1': 0,
      '2-4': 0,
      '5-13': 0,
      '14+': 0,
    },
  };
  const slowestDecisions = [];
  diagnostics.forEach((record, index) => {
    addTiming(overall, record?.timing);
    const role = String(record?.actionRole || 'UNKNOWN').trim() || 'UNKNOWN';
    if (!byRole.has(role)) {
      byRole.set(role, {
        timing: emptyTiming(),
        candidateCount: 0,
        rebuiltUnitCount: 0,
        observerPoolEntryCount: 0,
      });
    }
    const roleSummary = byRole.get(role);
    addTiming(roleSummary.timing, record?.timing);
    roleSummary.candidateCount += Number(record?.candidateCount || 0);

    const decision = decisions[index] || {};
    const decisionWorkload = decision?.decisionProfile?.workload || {};
    const observerPoolUnitCount = Math.max(
      0,
      Number(decisionWorkload?.observerPoolUnitCount || 0),
    );
    const observerPoolEntryCount = Math.max(
      0,
      Number(decisionWorkload?.observerPoolEntryCount || 0),
    );
    const rebuiltUnitCount = Math.max(
      0,
      Number(decisionWorkload?.rebuiltUnitCount || 0),
    );
    const currentCandidateCount = Math.max(
      0,
      Number(
        decisionWorkload?.currentCandidateCount ??
        record?.candidateCount ??
        0,
      ),
    );
    workload.observerPoolUnitCount += observerPoolUnitCount;
    workload.observerPoolEntryCount += observerPoolEntryCount;
    workload.rebuiltUnitCount += rebuiltUnitCount;
    workload.currentCandidateCount += currentCandidateCount;
    roleSummary.rebuiltUnitCount += rebuiltUnitCount;
    roleSummary.observerPoolEntryCount += observerPoolEntryCount;
    if (rebuiltUnitCount === 0) {
      workload.zeroUnitsRebuiltDecisionCount += 1;
      workload.rebuildWidthBuckets['0'] += 1;
    } else if (
      observerPoolUnitCount > 0 &&
      rebuiltUnitCount >= observerPoolUnitCount
    ) {
      workload.allUnitsRebuiltDecisionCount += 1;
      workload.rebuildWidthBuckets['14+'] += 1;
    } else {
      workload.partialUnitsRebuiltDecisionCount += 1;
      if (rebuiltUnitCount === 1) {
        workload.rebuildWidthBuckets['1'] += 1;
      } else if (rebuiltUnitCount <= 4) {
        workload.rebuildWidthBuckets['2-4'] += 1;
      } else if (rebuiltUnitCount <= 13) {
        workload.rebuildWidthBuckets['5-13'] += 1;
      } else {
        workload.rebuildWidthBuckets['14+'] += 1;
      }
    }
    slowestDecisions.push({
      index,
      round: Number(record?.round || 0),
      actorId: String(record?.actorId || '').trim(),
      actionRole: role,
      candidateCount: Number(record?.candidateCount || 0),
      totalMs: round(record?.timing?.totalMs),
      contextBuildMs: round(record?.timing?.contextBuildMs),
      runtimeSnapshotAndInvalidationMs: round(
        record?.timing?.runtimeSnapshotAndInvalidationMs,
      ),
      prepareMs: round(record?.timing?.prepareMs),
      providerMs: round(record?.timing?.providerMs),
      observerPoolUnitCount,
      observerPoolEntryCount,
      rebuiltUnitCount,
    });
  });
  workload.rebuiltUnitRatio = workload.observerPoolUnitCount > 0
    ? round(workload.rebuiltUnitCount / workload.observerPoolUnitCount)
    : 0;
  return {
    decisionTiming: finalizeTiming(overall),
    decisionTimingByRole: Object.fromEntries(
      [...byRole.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([role, summary]) => [
          role,
          {
            timing: finalizeTiming(summary.timing),
            candidateCount: summary.candidateCount,
            rebuiltUnitCount: summary.rebuiltUnitCount,
            observerPoolEntryCount: summary.observerPoolEntryCount,
          },
        ]),
    ),
    workload,
    slowestDecisions: slowestDecisions
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 20),
  };
}

function maximumReconciliationError(draft) {
  const decisions = Array.isArray(draft.decisionAudit)
    ? draft.decisionAudit
    : [];
  return decisions.reduce((maximum, decision) => {
    const proofs = [
      decision?.selected?.candidateValueProof,
      ...(Array.isArray(decision?.candidateAudit)
        ? decision.candidateAudit.map(row => row?.candidateValueProof)
        : []),
    ].filter(Boolean);
    return proofs.reduce((currentMaximum, proof) => {
      const causalTotal = (proof?.causalValueFacts || [])
        .reduce(
          (sum, fact) => sum + Number(fact?.valueHEPP || 0),
          0,
        );
      return Math.max(
        currentMaximum,
        Math.abs(
          causalTotal -
          Number(proof?.goalUtilityDeltaHEPP || 0),
        ),
        Math.abs(Number(proof?.reconciliationError || 0)),
      );
    }, maximum);
  }, 0);
}

function executeMeasuredTransaction(sandbox, definition) {
  const input = formalInput(definition, 'r9v2-shadow');
  delete input.settings.collectDecisionReplayIdentity;
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const transactionStartedAt = performance.now();
  const draftStartedAt = performance.now();
  const draft = runtime.executeBattleDraftR8(structuredClone(input));
  const draftFinishedAt = performance.now();
  const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
  const reportFinishedAt = performance.now();
  const reportAudit = report.auditProjection(reportDto);
  const auditFinishedAt = performance.now();
  const sealedPackage = runtime.sealBattleResult({ draft, reportAudit });
  const sealFinishedAt = performance.now();
  runtime.verifySealedBattlePackage(sealedPackage);
  const transactionFinishedAt = performance.now();

  assert.equal(
    Number(draft.runtimeAudit?.fatalCount || 0),
    0,
    `${definition.caseId}:Runtime Fatal`,
  );
  assert.equal(
    reportAudit.passed,
    true,
    `${definition.caseId}:Report审计未通过`,
  );
  assert.equal(
    Number(reportAudit.fatalCount || 0),
    0,
    `${definition.caseId}:Report Fatal`,
  );
  assert.equal(
    sealedPackage.sealStatus,
    'SEALED',
    `${definition.caseId}:Seal失败`,
  );

  const decisionSummary = summarizeDecisions(draft);
  const phases = {
    draftMs: round(draftFinishedAt - draftStartedAt),
    reportBuildMs: round(reportFinishedAt - draftFinishedAt),
    reportAuditMs: round(auditFinishedAt - reportFinishedAt),
    sealMs: round(sealFinishedAt - auditFinishedAt),
    verifyMs: round(transactionFinishedAt - sealFinishedAt),
  };
  return {
    elapsedMs: round(transactionFinishedAt - transactionStartedAt),
    transactionPhases: phases,
    transactionHashes: {
      draftHash: String(draft.draftHash || ''),
      reportHash: String(sealedPackage.reportHash || ''),
      ledgerHash: sha256(draft.ledger || []),
      terminalHash: sha256(draft.terminalResult || {}),
      finalSnapshotHash: sha256(draft.finalSnapshot || {}),
    },
    actualRoundCount: Number(draft.actualRoundCount || 0),
    decisionCount: Array.isArray(draft.decisionAudit)
      ? draft.decisionAudit.length
      : 0,
    ledgerEventCount: Array.isArray(draft.ledger)
      ? draft.ledger.length
      : 0,
    actionQueueNodeCount: Array.isArray(draft.actionQueueTrace)
      ? draft.actionQueueTrace.length
      : 0,
    maximumReconciliationError: round(
      maximumReconciliationError(draft),
    ),
    ...decisionSummary,
    evaluationSessionMetrics: clone(
      draft.runtimeDiagnostics?.evaluationSessionMetrics?.metrics || {},
    ),
  };
}

function summarizeMeasurements(runs) {
  const elapsed = runs.map(run => run.elapsedMs);
  const phaseKeys = [
    'draftMs',
    'reportBuildMs',
    'reportAuditMs',
    'sealMs',
    'verifyMs',
  ];
  const phaseMedians = Object.fromEntries(
    phaseKeys.map(key => [
      key,
      round(percentile(
        runs.map(run => run.transactionPhases[key]),
        0.5,
      )),
    ]),
  );
  return {
    elapsedMs: elapsed,
    medianMs: round(percentile(elapsed, 0.5)),
    p95Ms: round(percentile(elapsed, 0.95)),
    transactionPhaseMedians: phaseMedians,
    medianDraftShare: percentile(elapsed, 0.5) > 0
      ? round(phaseMedians.draftMs / percentile(elapsed, 0.5))
      : 0,
  };
}

const caseIds = argValue(
  'cases',
  'raid_control_heavy,raid_summon_heavy,raid_balanced',
).split(',').map(value => value.trim()).filter(Boolean);
const warmupCount = positiveInteger('warmups', 1);
const measurementCount = positiveInteger('measurements', 3);
if (!measurementCount) {
  throw new Error('RC6_PHASE3_PROFILE_MEASUREMENTS_REQUIRED');
}
const outputPath = path.resolve(
  repoRoot,
  argValue(
    'output',
    'tools/evidence/r8/r83_rc6_r9v2_phase3_performance_profile_2026-07-29.json',
  ),
);

const sandbox = loadBattleSandbox();
const casesById = manualCasesById(sandbox);
const missingCases = caseIds.filter(caseId => !casesById.has(caseId));
if (missingCases.length) {
  throw new Error(
    `RC6_PHASE3_PROFILE_CASE_MISSING:${missingCases.join(',')}`,
  );
}

const caseResults = [];
for (const caseId of caseIds) {
  const definition = casesById.get(caseId);
  const warmups = [];
  for (let index = 0; index < warmupCount; index += 1) {
    warmups.push(executeMeasuredTransaction(sandbox, definition));
  }
  const measurements = [];
  for (let index = 0; index < measurementCount; index += 1) {
    measurements.push(executeMeasuredTransaction(sandbox, definition));
  }
  const referenceHashes = measurements[0].transactionHashes;
  measurements.slice(1).forEach((run, index) => {
    assert.deepEqual(
      run.transactionHashes,
      referenceHashes,
      `${caseId}:第${index + 2}次测量Hash不一致`,
    );
  });
  caseResults.push({
    caseId,
    seed: definition.seed,
    roundsRequested: definition.rounds,
    unitCount:
      Object.values(definition.combatData?.参战者 || {})
        .flatMap(side => Array.isArray(side) ? side : [])
        .length,
    warmupElapsedMs: warmups.map(run => run.elapsedMs),
    measurements,
    summary: summarizeMeasurements(measurements),
  });
}

const toolPath = fileURLToPath(import.meta.url);
const evidence = {
  schemaVersion: 'R9v2Phase3PerformanceProfileV1',
  generatedAt: new Date().toISOString(),
  providerId: 'r9v2-shadow',
  sourceHashes: sourceHashes(),
  toolHashes: {
    'tools/profile_r83_rc6_r9v2_phase3_gate.mjs':
      sha256(fs.readFileSync(toolPath)),
    'tools/r83_rc6_battle_harness.mjs':
      sha256(fs.readFileSync(
        path.join(repoRoot, 'tools/r83_rc6_battle_harness.mjs'),
      )),
    'tools/battle_r63_manual_cases.mjs':
      sha256(fs.readFileSync(
        path.join(repoRoot, 'tools/battle_r63_manual_cases.mjs'),
      )),
  },
  runConfig: {
    caseIds,
    warmupCount,
    measurementCount,
    singleProcess: true,
    collectDecisionReplayIdentity: false,
    timerScope:
      'Draft -> Report.build -> auditProjection -> Seal -> verify',
    postTimerDiagnostics: [
      'decisionPerformanceDiagnostics',
      'decisionProfile.workload',
      'evaluationSessionMetrics',
    ],
  },
  thresholdsForReference: {
    internalMedianMs: 4000,
    internalP95Ms: 6000,
    formalMedianMs: 5000,
    formalP95Ms: 7500,
    minimumOptimizationBenefitRatio: 0.03,
  },
  cases: caseResults,
  manualReviews: [],
  factsOnly: true,
  automaticConclusionGenerated: false,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify({
  outputPath,
  evidenceHash: sha256(evidence),
  cases: caseResults.map(item => ({
    caseId: item.caseId,
    medianMs: item.summary.medianMs,
    p95Ms: item.summary.p95Ms,
    medianDraftShare: item.summary.medianDraftShare,
  })),
}, null, 2)}\n`);

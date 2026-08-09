import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const scriptPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(
  repoRoot,
  'tools',
  'rc6',
  'evidence',
  'm2',
  'k13-target-performance.json',
);
const PERFORMANCE_SCOPE =
  'R9V2_TARGET_KERNEL_AND_FULL_TRANSACTION_DRAFT_REPORT_AUDIT_SEAL_VERIFY';
const targetRegistryMarker =
  "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine =
  '    r9v2: request => runR9v2TargetProvider(request),';
const scoutTimeoutMs = 12000;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const text = value => String(value ?? '').trim();
const finite = value =>
  value === null || value === undefined || value === ''
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const percentileNearestRank = (values, percentile) => {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const rank = Math.max(1, Math.ceil(sorted.length * percentile));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
};
const readUtf8 = fileName => fs.readFileSync(path.join(repoRoot, fileName), 'utf8');

function targetDecisionSource() {
  const original = readUtf8('BattleDecision_Module.js');
  if (original.includes(targetRegistryLine)) return original;
  const patched = original.replace(
    targetRegistryMarker,
    `${targetRegistryMarker}\n${targetRegistryLine}`,
  );
  assert(patched !== original, 'K13_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
}

function createTargetSandbox() {
  return loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: { 'BattleDecision_Module.js': targetDecisionSource() },
  });
}

function runKernelWorker(caseId, repeats) {
  const sandbox = loadBattleSandbox({ includeTargetKernel: true });
  const decision = sandbox.__LWCS_BATTLE_DECISION__;
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `K13_CASE_MISSING:${caseId}`);
  const world = clone(definition.combatData);
  const actorId = text(world?.参战者?.team_player?.[0]?.id);
  assert(actorId, `K13_ACTOR_MISSING:${caseId}`);

  const coldStartedAt = performance.now();
  const session = decision.createEvaluationSession({
    objectiveHash: `k13:objective:${caseId}`,
    visibleWorldRevision: `k13:world:${caseId}`,
    beliefRevision: `k13:belief:${caseId}`,
    opportunityRevision: `k13:opportunity:${caseId}`,
    resourceTimelineRevision: `k13:resource:${caseId}`,
    scheduleRevision: `k13:schedule:${caseId}`,
  });
  try {
    const request = decision.prepareDecisionRequest({
      session,
      worldSnapshot: world,
      actorId,
      objectiveContract: world.胜负条件,
      battleIntent: {
        mode: definition.intent,
        objectives: clone(world.胜负条件),
      },
      actionOpportunity: {
        opportunityId: `${caseId}:k13:frozen`,
        ownerId: actorId,
        role: 'ACTIVE',
      },
      providerId: 'r9v2',
      analysisDepth: 'CANDIDATES_ONLY',
      r9v2InformationValueOnly: true,
      seed: `${definition.seed}:k13:frozen`,
    });
    const first = decision.runR9v2TargetProviderForTest(request);
    assert(first?.selected?.candidateId, `K13_COLD_SELECTION_MISSING:${caseId}`);
    const coldSessionAndFirstDecisionMs = performance.now() - coldStartedAt;

    const repeatedStartedAt = performance.now();
    for (let index = 0; index < repeats; index += 1) {
      const result = decision.runR9v2TargetProviderForTest(request);
      assert(
        result?.selected?.candidateId === first.selected.candidateId,
        `K13_FROZEN_SELECTION_DRIFT:${caseId}:${index}`,
      );
    }
    const frozenDecisionTotalMs = performance.now() - repeatedStartedAt;
    return {
      schemaVersion: 'M2K13TargetKernelWorkerV2',
      status: 'COMPLETED',
      caseId,
      repeats,
      coldSessionAndFirstDecisionMs,
      frozenDecisionTotalMs,
      selectedCandidateId: first.selected.candidateId,
      evaluationSessionMetrics: decision.readEvaluationSessionMetrics(session),
    };
  } finally {
    decision.disposeEvaluationSession(session);
  }
}

function runTransactionWorker(caseId, rounds) {
  const sandbox = createTargetSandbox();
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `K13_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.rounds = rounds;
  input.settings = {
    ...input.settings,
    r9v2InformationValueOnly: true,
  };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const totalStartedAt = performance.now();

  const draftStartedAt = performance.now();
  const draft = runtime.executeBattleDraftR8(clone(input));
  const draftMs = performance.now() - draftStartedAt;

  const reportStartedAt = performance.now();
  const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
  const reportMs = performance.now() - reportStartedAt;

  const auditStartedAt = performance.now();
  const reportAudit = report.auditProjection(reportDto);
  const auditMs = performance.now() - auditStartedAt;
  assert(reportAudit?.passed === true, `K13_REPORT_AUDIT_FAILED:${caseId}`);

  const sealStartedAt = performance.now();
  const sealedPackage = runtime.sealBattleResult({ draft, reportAudit });
  const sealMs = performance.now() - sealStartedAt;

  const verifyStartedAt = performance.now();
  runtime.verifySealedBattlePackage(sealedPackage);
  const verifyMs = performance.now() - verifyStartedAt;

  const decisions = Array.isArray(draft?.decisions)
    ? draft.decisions
    : Array.isArray(draft?.decisionJournal)
      ? draft.decisionJournal
      : Array.isArray(draft?.decisionAudit)
        ? draft.decisionAudit
        : [];
  const targetDecisionCount = decisions.filter(decision =>
    decision?.decisionEngine === 'R9V2_TARGET' &&
    decision?.decisionProfile?.slice === 'TARGET_KERNEL_V2'
  ).length;
  assert(targetDecisionCount > 0, `K13_TARGET_DECISION_NOT_EXECUTED:${caseId}`);

  return {
    schemaVersion: 'M2K13TargetTransactionWorkerV2',
    status: 'COMPLETED',
    caseId,
    rounds,
    actorCount:
      (input.combatData?.参战者?.team_player || []).length +
      (input.combatData?.参战者?.team_enemy || []).length,
    decisionCount: decisions.length,
    targetDecisionCount,
    draftMs,
    reportMs,
    auditMs,
    sealMs,
    verifyMs,
    totalMs: performance.now() - totalStartedAt,
    reportProjectionStatus: text(reportAudit?.reportDto?.projectionStatus),
    draftHash: sha256(JSON.stringify(draft)),
    reportHash: sha256(JSON.stringify(reportAudit.reportDto)),
    sealedHash: sha256(JSON.stringify(sealedPackage)),
  };
}

if (process.argv[2] === '--kernel-worker') {
  try {
    process.stdout.write(JSON.stringify(runKernelWorker(
      text(process.argv[3]),
      Math.max(1, Number(process.argv[4] || 24)),
    )));
  } catch (error) {
    process.stderr.write(`${text(error?.stack || error)}\n`);
    process.exitCode = 1;
  }
} else if (process.argv[2] === '--transaction-worker') {
  try {
    process.stdout.write(JSON.stringify(runTransactionWorker(
      text(process.argv[3]),
      Math.max(1, Number(process.argv[4] || 1)),
    )));
  } catch (error) {
    process.stderr.write(`${text(error?.stack || error)}\n`);
    process.exitCode = 1;
  }
} else {
  const runWorker = (args, timeoutMs) => {
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
      return {
        status: 'TIMEOUT',
        caseId: text(args[1]),
        rounds: Number(args[2] || 0),
        timeoutMs,
      };
    }
    if (result.status !== 0) {
      return {
        status: 'FAILED',
        caseId: text(args[1]),
        rounds: Number(args[2] || 0),
        error: text(result.stderr || result.stdout).slice(-4000),
      };
    }
    try {
      return JSON.parse(text(result.stdout));
    } catch (error) {
      return {
        status: 'FAILED',
        caseId: text(args[1]),
        rounds: Number(args[2] || 0),
        error: `K13_WORKER_JSON_INVALID:${text(error?.message || error)}`,
      };
    }
  };

  const kernel = runWorker(
    ['--kernel-worker', 'duel_overmatch_lethal', '24'],
    scoutTimeoutMs,
  );
  const oneRound = runWorker(
    ['--transaction-worker', 'team_focus_without_overkill', '1'],
    scoutTimeoutMs,
  );
  const threeRounds = runWorker(
    ['--transaction-worker', 'team_focus_without_overkill', '3'],
    scoutTimeoutMs,
  );

  const raidCaseIds = [
    'raid_control_heavy',
    'raid_summon_heavy',
    'raid_response_terminal_information',
  ];
  const raids = [];
  for (const caseId of raidCaseIds) {
    const result = runWorker(
      ['--transaction-worker', caseId, '5'],
      scoutTimeoutMs,
    );
    raids.push(result);
    if (result.status !== 'COMPLETED' || Number(result.totalMs) > 10000) break;
  }

  const completedRaids = raids.filter(row => row.status === 'COMPLETED');
  const raidDraftMedianMs = completedRaids.length === raidCaseIds.length
    ? percentileNearestRank(completedRaids.map(row => row.draftMs), 0.5)
    : null;
  const gates = {
    coldSessionAndFirstDecision: {
      targetMs: 800,
      observedMs: finite(kernel.coldSessionAndFirstDecisionMs),
      passed: kernel.status === 'COMPLETED' &&
        Number(kernel.coldSessionAndFirstDecisionMs) <= 800,
    },
    twentyFourFrozenDecisions: {
      targetMs: 1200,
      observedMs: finite(kernel.frozenDecisionTotalMs),
      passed: kernel.status === 'COMPLETED' &&
        Number(kernel.frozenDecisionTotalMs) <= 1200,
    },
    oneRoundFullTransaction: {
      targetMs: 2500,
      observedMs: finite(oneRound.totalMs),
      passed: oneRound.status === 'COMPLETED' && Number(oneRound.totalMs) <= 2500,
    },
    threeRoundFullTransaction: {
      targetMs: 6000,
      observedMs: finite(threeRounds.totalMs),
      passed: threeRounds.status === 'COMPLETED' && Number(threeRounds.totalMs) <= 6000,
    },
    fiveRoundDraftMedian: {
      targetMs: 8000,
      observedMs: finite(raidDraftMedianMs),
      passed: raidDraftMedianMs !== null && raidDraftMedianMs <= 8000,
    },
    fiveRoundFullTransactionMaximum: {
      targetMs: 10000,
      observedMs: completedRaids.length
        ? finite(Math.max(...completedRaids.map(row => row.totalMs)))
        : null,
      passed: completedRaids.length === raidCaseIds.length &&
        completedRaids.every(row => Number(row.totalMs) <= 10000),
    },
  };
  const passed = Object.values(gates).every(gate => gate.passed === true);
  const firstFailedRaid = raids.find(row =>
    row.status !== 'COMPLETED' || Number(row.totalMs) > 10000
  ) || null;
  const output = {
    schemaVersion: 'M2K13TargetKernelPerformanceGateV2',
    status: passed ? 'PASSED' : 'R9V2_TARGET_KERNEL_BLOCKED',
    scope: PERFORMANCE_SCOPE,
    formalProvider: 'r8',
    isolatedTargetProvider: 'r9v2',
    scoutTimeoutMs,
    stopRule:
      'Stop after the first 7v7 timeout, failure, or completed full transaction above 10 seconds.',
    kernel,
    oneRound,
    threeRounds,
    raids,
    unrunRaidCaseIds: raidCaseIds.slice(raids.length),
    firstFailedRaidCaseId: firstFailedRaid?.caseId || '',
    gates,
    sourceHashes: {
      decision: sha256(readUtf8('BattleDecision_Module.js')),
      kernel: sha256(readUtf8('BattleDecisionR9v2Kernel_Module.js')),
      runtime: sha256(readUtf8('BattleRuntime_Module.js')),
      report: sha256(readUtf8('BattleReport_Module.js')),
      harness: sha256(readUtf8('tools/r83_rc6_battle_harness.mjs')),
      tool: sha256(readUtf8('tools/rc6/harness/run-m2-k13-target-performance.mjs')),
    },
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

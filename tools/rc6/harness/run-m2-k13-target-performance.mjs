import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k13-target-performance.json');
const PERFORMANCE_SCOPE = 'SESSION_REUSED_PREPARE_TO_TARGET_KERNEL_SELECTION_ONLY';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const percentileNearestRank = (values, rank) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank - 1))] ?? null;
};
const summarize = values => ({
  count: values.length,
  minMs: finite(Math.min(...values)),
  medianMs: finite(percentileNearestRank(values, Math.ceil(values.length * 0.5))),
  p95Ms: finite(percentileNearestRank(values, Math.ceil(values.length * 0.95))),
  maxMs: finite(Math.max(...values)),
});
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const worker = process.argv[2] === '--worker';
if (worker) {
  const caseId = String(process.argv[3] || '').trim();
  const rounds = Math.max(1, Number(process.argv[4] || 1));
  const maxDecisions = Math.max(0, Number(process.argv[5] || 0));
  const sandbox = loadBattleSandbox({ includeTargetKernel: true });
  const decision = sandbox.__LWCS_BATTLE_DECISION__;
  const cases = manualCasesById(sandbox);
  const definition = cases.get(caseId);
  assert(definition, `K13_CASE_MISSING:${caseId}`);
  const world = clone(definition.combatData);
  const actors = [
    ...(world?.参战者?.team_player || []),
    ...(world?.参战者?.team_enemy || []),
  ];
  assert(actors.length > 0, `K13_ACTORS_MISSING:${caseId}`);
  const session = decision.createEvaluationSession({
    objectiveHash: `k13:objective:${caseId}`,
    visibleWorldRevision: `k13:world:${caseId}`,
    beliefRevision: `k13:belief:${caseId}`,
    opportunityRevision: `k13:opportunity:${caseId}`,
    resourceTimelineRevision: `k13:resource:${caseId}`,
    scheduleRevision: `k13:schedule:${caseId}`,
  });
  const decisionMs = [];
  let decisionCount = 0;
  const startedAt = performance.now();
  try {
    for (let round = 0; round < rounds; round += 1) {
      for (const actor of actors) {
        if (maxDecisions > 0 && decisionCount >= maxDecisions) break;
        const actorId = String(actor?.id || actor?.name || '').trim();
        const decisionStartedAt = performance.now();
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
            opportunityId: `${caseId}:k13:${round}:${decisionCount}`,
            ownerId: actorId,
            role: 'ACTIVE',
          },
          providerId: 'r9v2',
          analysisDepth: 'CANDIDATES_ONLY',
          r9v2InformationValueOnly: true,
          seed: `${definition.seed}:${round}:${decisionCount}`,
        });
        const result = decision.runR9v2TargetProviderForTest(request);
        assert(result?.selected?.candidateId, `K13_SELECTION_MISSING:${caseId}:${round}:${actorId}`);
        decisionMs.push(performance.now() - decisionStartedAt);
        decisionCount += 1;
      }
    }
  } finally {
    decision.disposeEvaluationSession(session);
  }
  const totalMs = performance.now() - startedAt;
  process.stdout.write(JSON.stringify({
    schemaVersion: 'M2K13TargetKernelPerformanceWorkerV1',
    status: 'COMPLETED',
    caseId,
    rounds,
    decisionCount,
    decision: summarize(decisionMs),
    totalMs,
    scope: PERFORMANCE_SCOPE,
  }));
  process.exit(0);
}

const runWorker = ({ caseId, rounds, maxDecisions, timeoutMs = 12000 }) => {
  const result = spawnSync(
    process.execPath,
    [scriptPath, '--worker', caseId, String(rounds), String(maxDecisions)],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return {
      schemaVersion: 'M2K13TargetKernelPerformanceWorkerV1',
      status: 'TIMEOUT',
      caseId,
      rounds,
      maxDecisions,
      timeoutMs,
      scope: PERFORMANCE_SCOPE,
    };
  }
  if (result.status !== 0) {
    throw new Error(`K13_WORKER_FAILED:${caseId}:${String(result.stderr || result.stdout || '').slice(-2000)}`);
  }
  return JSON.parse(String(result.stdout || '{}'));
};

const measurements = [];
measurements.push({
  id: 'cold-single-decision',
  target: '<=800ms',
  result: runWorker({ caseId: 'duel_overmatch_lethal', rounds: 1, maxDecisions: 1 }),
});
measurements.push({
  id: 'twenty-four-decisions',
  target: '<=1200ms-total',
  result: runWorker({ caseId: 'duel_overmatch_lethal', rounds: 24, maxDecisions: 24 }),
});
measurements.push({
  id: 'three-v-three-three-rounds',
  target: '<=6000ms-total',
  result: runWorker({ caseId: 'team_focus_without_overkill', rounds: 3, maxDecisions: 0 }),
});
for (const caseId of ['raid_control_heavy', 'raid_summon_heavy', 'raid_balanced']) {
  measurements.push({
    id: `${caseId}-five-round-scout`,
    target: '<=10000ms-single-sample',
    result: runWorker({ caseId, rounds: 5, maxDecisions: 0, timeoutMs: 12000 }),
  });
}

const gateFor = measurement => {
  const result = measurement.result;
  if (result.status === 'TIMEOUT') {
    return {
      status: 'TIMEOUT',
      observedMs: null,
      targetMs: measurement.id.includes('cold-single')
        ? 800
        : measurement.id.includes('twenty-four')
          ? 1200
          : measurement.id.includes('three-v-three')
            ? 6000
            : 10000,
    };
  }
  const targetMs = measurement.id.includes('cold-single')
    ? 800
    : measurement.id.includes('twenty-four')
      ? 1200
      : measurement.id.includes('three-v-three')
        ? 6000
        : 10000;
  const observedMs = Number(result.totalMs);
  if (!Number.isFinite(observedMs)) {
    return { status: 'INVALID_MEASUREMENT', observedMs: null, targetMs };
  }
  return {
    status: observedMs <= targetMs ? 'PASSED' : 'OVER_TARGET',
    observedMs,
    targetMs,
  };
};
measurements.forEach(measurement => {
  measurement.gate = gateFor(measurement);
});
const timeoutDetected = measurements.some(item => item.gate.status === 'TIMEOUT');
const overTargetDetected = measurements.some(item =>
  ['OVER_TARGET', 'INVALID_MEASUREMENT'].includes(item.gate.status),
);

const output = {
  schemaVersion: 'M2K13TargetKernelPerformanceGateV1',
  status: timeoutDetected
    ? 'R9V2_TARGET_KERNEL_SCOUT_BLOCKED'
    : overTargetDetected
      ? 'R9V2_TARGET_KERNEL_SCOUT_OVER_TARGET'
      : 'PASSED',
  scope: PERFORMANCE_SCOPE,
  formalRuntimeTransaction: 'NOT_MEASURED_BEFORE_M4',
  formalProvider: 'r8',
  targetProvider: 'r9v2_unregistered',
  sevenVsSevenTimeoutPolicyMs: 12000,
  measurements,
  sourceHashes: {
    decision: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
    kernel: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
    harness: sha256(fs.readFileSync(scriptPath)),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

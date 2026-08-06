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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm5', 'm5-p01-target-transaction-profile.json');
const smallCaseIds = ['duel_overmatch_lethal', 'team_control_overlap'];
const raidCaseIds = [
  'raid_balanced',
  'raid_control_heavy',
  'raid_summon_heavy',
  'raid_response_terminal_information',
];
const targetRegistryMarker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";
const timeoutMs = 12000;

const text = value => String(value ?? '').trim();
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readUtf8 = fileName => fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function targetDecisionSource() {
  const original = readUtf8('BattleDecision_Module.js');
  if (original.includes(targetRegistryLine)) return original;
  const patched = original.replace(
    targetRegistryMarker,
    `${targetRegistryMarker}\n${targetRegistryLine}`,
  );
  assert(patched !== original, 'M5_P01_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
}

function runFullTransaction(caseId, sourceOverride) {
  const sandbox = loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: { 'BattleDecision_Module.js': sourceOverride },
  });
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `M5_P01_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.settings = { ...input.settings, r9v2InformationValueOnly: true };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const started = performance.now();
  const draftStarted = performance.now();
  const draft = runtime.executeBattleDraftR8(clone(input));
  const draftMs = performance.now() - draftStarted;
  const reportStarted = performance.now();
  const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
  const reportMs = performance.now() - reportStarted;
  const auditStarted = performance.now();
  const reportAudit = report.auditProjection(reportDto);
  const auditMs = performance.now() - auditStarted;
  assert(reportAudit?.passed === true, `M5_P01_REPORT_AUDIT_FAILED:${caseId}`);
  const sealStarted = performance.now();
  const sealed = runtime.sealBattleResult({ draft, reportAudit });
  const sealMs = performance.now() - sealStarted;
  const verifyStarted = performance.now();
  runtime.verifySealedBattlePackage(sealed);
  const verifyMs = performance.now() - verifyStarted;
  return {
    schemaVersion: 'M5P01TargetTransactionWorkerV1',
    status: 'COMPLETED',
    caseId,
    rounds: Number(input.rounds || 0),
    actorCount: (input.combatData?.参战者?.team_player || []).length +
      (input.combatData?.参战者?.team_enemy || []).length,
    totalMs: Number((performance.now() - started).toFixed(3)),
    stageMs: {
      draft: Number(draftMs.toFixed(3)),
      report: Number(reportMs.toFixed(3)),
      audit: Number(auditMs.toFixed(3)),
      seal: Number(sealMs.toFixed(3)),
      verify: Number(verifyMs.toFixed(3)),
    },
    draftHash: text(draft?.draftHash),
    reportHash: text(reportAudit?.reportHash),
    reportProjectionStatus: text(reportAudit?.reportDto?.projectionStatus),
    targetProvider: 'r9v2',
    formalProviderUsed: 'r8_not_used',
  };
}

function runWorker(caseId) {
  const result = spawnSync(
    process.execPath,
    [scriptPath, '--worker', caseId],
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
      schemaVersion: 'M5P01TargetTransactionWorkerV1',
      status: 'TIMEOUT',
      caseId,
      timeoutMs,
      targetProvider: 'r9v2',
    };
  }
  if (result.status !== 0) {
    return {
      schemaVersion: 'M5P01TargetTransactionWorkerV1',
      status: 'FAILED',
      caseId,
      targetProvider: 'r9v2',
      error: text(result.stderr || result.stdout).slice(-4000),
    };
  }
  try {
    return JSON.parse(text(result.stdout));
  } catch (error) {
    return {
      schemaVersion: 'M5P01TargetTransactionWorkerV1',
      status: 'FAILED',
      caseId,
      targetProvider: 'r9v2',
      error: `M5_P01_WORKER_JSON_INVALID:${text(error?.message || error)}`,
      stdoutTail: text(result.stdout).slice(-2000),
    };
  }
}

if (process.argv[2] === '--worker') {
  const caseId = text(process.argv[3]);
  try {
    process.stdout.write(`${JSON.stringify(runFullTransaction(caseId, targetDecisionSource()))}\n`);
  } catch (error) {
    process.stderr.write(`${text(error?.stack || error)}\n`);
    process.exitCode = 1;
  }
} else {
  const measurements = [];
  for (const caseId of smallCaseIds) measurements.push(runWorker(caseId));
  let raidScoutStopped = false;
  for (const caseId of raidCaseIds) {
    if (raidScoutStopped) break;
    const result = runWorker(caseId);
    measurements.push(result);
    if (result.status !== 'COMPLETED' || Number(result.totalMs) > 10000) raidScoutStopped = true;
  }
  const completed = measurements.filter(row => row.status === 'COMPLETED');
  const overTarget = completed.filter(row => Number(row.totalMs) > 10000).map(row => row.caseId);
  const timeouts = measurements.filter(row => row.status === 'TIMEOUT').map(row => row.caseId);
  const failed = measurements.filter(row => row.status === 'FAILED').map(row => row.caseId);
  const output = {
    schemaVersion: 'M5P01TargetTransactionProfileV1',
    status: failed.length || timeouts.length || overTarget.length ? 'SCOUT_OVER_TARGET' : 'SCOUT_WITHIN_TARGET',
    scope: 'R9V2_TARGET_FULL_TRANSACTION_DRAFT_REPORT_AUDIT_SEAL_VERIFY',
    formalProvider: 'r8_not_measured',
    targetProvider: 'r9v2',
    timeoutMs,
    stopRule: 'Stop raid scout after first timeout, failure, or completed sample above 10 seconds.',
    raidScoutStopped,
    measurements,
    completedCount: completed.length,
    overTargetCaseIds: overTarget,
    timeoutCaseIds: timeouts,
    failedCaseIds: failed,
    sourceHashes: {
      decision: sha256(readUtf8('BattleDecision_Module.js')),
      kernel: sha256(readUtf8('BattleDecisionR9v2Kernel_Module.js')),
      runtime: sha256(readUtf8('BattleRuntime_Module.js')),
      report: sha256(readUtf8('BattleReport_Module.js')),
      harness: sha256(readUtf8('tools/r83_rc6_battle_harness.mjs')),
    },
    toolHash: sha256(readUtf8('tools/rc6/harness/run-m5-p01-target-transaction-profile.mjs')),
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

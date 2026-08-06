import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
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
const evidencePath = path.join(
  repoRoot,
  'tools',
  'rc6',
  'evidence',
  'm2',
  'target-path-audit.json',
);
const readUtf8 = relativePath => fs.readFileSync(
  path.join(repoRoot, relativePath),
  'utf8',
);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function targetDecisionSource() {
  const source = readUtf8('BattleDecision_Module.js');
  const marker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
  const targetLine = "    r9v2: request => runR9v2TargetProvider(request),";
  if (source.includes(targetLine)) return source;
  const patched = source.replace(marker, `${marker}\n${targetLine}`);
  assert(patched !== source, 'M2_TARGET_PATH_REGISTRY_PATCH_MISSED');
  return patched;
}

function runCase(sandbox, caseId) {
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `M2_TARGET_PATH_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.rounds = 1;
  input.settings = {
    ...input.settings,
    r9v2InformationValueOnly: true,
  };
  const startedAt = performance.now();
  const draft = sandbox.__LWCS_BATTLE_RUNTIME__.executeBattleDraftR8(
    structuredClone(input),
  );
  const rows = Array.isArray(draft.decisionAudit)
    ? draft.decisionAudit
    : [];
  const profiles = rows.map(row => ({
    providerId: String(draft.providerId || '').trim(),
    engine: String(
      row?.decisionAudit?.decisionEngine ||
      row?.decisionProfile?.engine ||
      '',
    ).trim(),
    slice: String(
      row?.decisionAudit?.decisionProfile?.slice ||
      row?.decisionProfile?.slice ||
      '',
    ).trim(),
  }));
  const nonTargetProfiles = profiles.filter(profile =>
    profile.providerId !== 'r9v2' ||
    profile.engine !== 'R9V2_TARGET' ||
    profile.slice !== 'TARGET_KERNEL_V2',
  );
  const evaluationMetrics =
    draft.runtimeDiagnostics?.evaluationSessionMetrics || {};
  const targetKernelMetrics = evaluationMetrics.targetKernelMetrics || {};
  assert(
    draft.providerId === 'r9v2',
    `M2_TARGET_PATH_PROVIDER_MISMATCH:${caseId}:${draft.providerId || 'missing'}`,
  );
  assert(
    rows.length > 0,
    `M2_TARGET_PATH_NO_DECISIONS:${caseId}`,
  );
  assert(
    nonTargetProfiles.length === 0,
    `M2_TARGET_PATH_NON_TARGET_DECISION:${caseId}:${JSON.stringify(nonTargetProfiles)}`,
  );
  assert(
    Number(targetKernelMetrics.sessionCount || 0) > 0 &&
      Number(targetKernelMetrics.vectorMaterializations || 0) > 0,
    `M2_TARGET_PATH_KERNEL_METRICS_MISSING:${caseId}:${JSON.stringify(targetKernelMetrics)}`,
  );
  assert(
    Number(draft.runtimeAudit?.fatalCount || 0) === 0,
    `M2_TARGET_PATH_FATAL:${caseId}`,
  );
  return {
    caseId,
    elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
    decisionCount: rows.length,
    targetDecisionCount: profiles.length,
    targetKernelMetrics,
    evaluationMetrics: {
      requestCount: Number(evaluationMetrics.metrics?.requestCount || 0),
      r9v2PoolBuilds: Number(evaluationMetrics.metrics?.r9v2PoolBuilds || 0),
      r9v2ProofComponentBuilds: Number(
        evaluationMetrics.metrics?.r9v2ProofComponentBuilds || 0,
      ),
    },
    profiles,
    fatalCount: Number(draft.runtimeAudit?.fatalCount || 0),
  };
}

const sourceOverrides = {
  'BattleDecision_Module.js': targetDecisionSource(),
};
const sandbox = loadBattleSandbox({
  includeTargetKernel: true,
  sourceOverrides,
});
const cases = [
  runCase(sandbox, 'duel_overmatch_lethal'),
  runCase(sandbox, 'team_focus_without_overkill'),
];
const output = {
  schemaVersion: 'M2TargetKernelPathAuditV1',
  status: 'PASSED',
  milestoneId: 'M2',
  taskId: 'M2-PATH-TARGET-KERNEL-ACTIVATION',
  scope: 'FULL_RUNTIME_DECISION_PATH_NO_REPORT_SEAL',
  formalProvider: 'r8',
  targetProvider: 'r9v2_test_registry_only',
  cases,
  sourceHashes: {
    decision: sha256(readUtf8('BattleDecision_Module.js')),
    kernel: sha256(readUtf8('BattleDecisionR9v2Kernel_Module.js')),
    runtime: sha256(readUtf8('BattleRuntime_Module.js')),
    harness: sha256(readUtf8('tools/rc6/harness/run-m2-target-path-audit.mjs')),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

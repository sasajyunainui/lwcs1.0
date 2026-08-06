import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
const evidencePath = path.join(
  repoRoot,
  'tools',
  'rc6',
  'evidence',
  'm2',
  'm2-target-kernel-route-reuse-diagnostic.json',
);
const caseId = 'team_control_overlap';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readUtf8 = relativePath => fs.readFileSync(
  path.join(repoRoot, relativePath),
  'utf8',
);
const text = value => String(value ?? '').trim();
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function targetDecisionSource() {
  const source = readUtf8('BattleDecision_Module.js');
  const marker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
  const targetLine = "    r9v2: request => runR9v2TargetProvider(request),";
  if (source.includes(targetLine)) return source;
  const patched = source.replace(marker, `${marker}\n${targetLine}`);
  assert(patched !== source, 'M5_P02_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
}

function runDiagnostic() {
  const sandbox = loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: {
      'BattleDecision_Module.js': targetDecisionSource(),
    },
  });
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `M5_P02_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.settings = {
    ...input.settings,
    r9v2InformationValueOnly: true,
  };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const started = performance.now();
  const draft = runtime.executeBattleDraftR8(clone(input));
  const draftMs = performance.now() - started;
  const reportStarted = performance.now();
  const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
  const reportMs = performance.now() - reportStarted;
  const auditStarted = performance.now();
  const reportAudit = report.auditProjection(reportDto);
  const auditMs = performance.now() - auditStarted;
  assert(reportAudit?.passed === true, 'M5_P02_REPORT_AUDIT_FAILED');
  const sealStarted = performance.now();
  const sealed = runtime.sealBattleResult({ draft, reportAudit });
  const sealMs = performance.now() - sealStarted;
  const verifyStarted = performance.now();
  runtime.verifySealedBattlePackage(sealed);
  const verifyMs = performance.now() - verifyStarted;
  const diagnostics = draft.runtimeDiagnostics || {};
  const decisionRows = Array.isArray(diagnostics.decisionPerformanceDiagnostics)
    ? diagnostics.decisionPerformanceDiagnostics
    : [];
  const timingTotals = decisionRows.reduce((totals, row) => {
    Object.entries(row?.timing || {}).forEach(([key, value]) => {
      totals[key] = Number(totals[key] || 0) + Number(value || 0);
    });
    return totals;
  }, {});
  const evaluationSessionMetrics =
    diagnostics.evaluationSessionMetrics || {};
  const metrics = {
    ...(evaluationSessionMetrics.metrics || {}),
    ...(evaluationSessionMetrics.targetKernelMetrics || {}),
  };
  const diagnosticMetricPrefixes = [
    'r9v2ProofComponent',
    'r9v2TargetKernel',
    'r9v2TargetRoute',
    'r9v2InformationBranch',
    'r9v2InformationProof',
    'r9v2TargetInformation',
    'r9v2FuturePool',
    'r9v2MechanicalEntry',
    'r9v2Pool',
  ];
  const diagnosticMetrics = Object.fromEntries(
    Object.entries(metrics).filter(([key]) =>
      diagnosticMetricPrefixes.some(prefix => key.startsWith(prefix)),
    ),
  );
  const metricKeys = [
    'r9v2PoolBuilds',
    'r9v2PoolFullRebuilds',
    'r9v2PoolEntryRebuilds',
    'r9v2PoolEntryReuses',
    'r9v2PoolUnitFallbacks',
    'r9v2ObserverBeliefRebuilds',
    'r9v2MechanicalBasisEvaluations',
    'r9v2MechanicalEntryCacheHits',
    'r9v2MechanicalEntryCacheMisses',
    'r9v2ProjectedBehaviorPoolBuilds',
    'r9v2ProjectedBehaviorPoolEntryRebuilds',
    'r9v2ProjectedBehaviorPoolEntryReuses',
    'r9v2ProjectedBehaviorPoolCatalogFallbacks',
    'r9v2ProofComponentBuilds',
    'r9v2ProofComponentHits',
    'r9v2TargetKernelVectorEvaluations',
    'r9v2TargetKernelCandidateEvaluations',
    'vectorMaterializations',
    'candidateEvaluations',
    'r9v2TargetInformationBranchProjectionCalls',
    'r9v2TargetInformationBranchMechanicalBuildMs',
    'r9v2TargetInformationBranchWorldBuildMs',
    'r9v2InformationBranchRouteBuildMs',
    'r9v2TargetRouteEntryPreparationMs',
    'r9v2TargetRouteRowsBuildMs',
    'r9v2TargetFutureRouteTableBuilds',
    'r9v2TargetFutureRouteTableRows',
    'r9v2TargetRouteIndexedCandidateSkips',
    'r9v2TargetRouteIndexedFallbacks',
    'r9v2TargetRouteEntryCacheHits',
    'r9v2TargetRouteEntryCacheMisses',
    'r9v2TargetRoutePaymentOnlyEntryReuses',
    'r9v2MechanicalEntryBuildMs',
    'r9v2TargetRouteDependencyStateMs',
    'r9v2TargetRouteDependencyChecks',
    'r9v2TargetRouteDependencyCheckMs',
    'r9v2TargetRouteEntryMaterializationMs',
    'r9v2TargetRouteCacheKeyBuilds',
    'r9v2TargetRouteCacheKeyBuildMs',
    'r9v2InformationBranchDependencyScanUnits',
    'r9v2InformationBranchRebuiltCandidateRows',
    'r9v2InformationBranchReusedCandidateRows',
    'r9v2InformationBranchRebuiltRouteRows',
    'r9v2InformationBranchReusedRouteRows',
    'r9v2InformationBranchReusedRouteEntryCatalogs',
    'r9v2InformationBranchReusedRouteValueTables',
    'r9v2InformationBranchReusedRouteValueRows',
    'r9v2InformationBranchRouteValueReuseAttempts',
    'r9v2InformationBranchRouteValueReuseRejectedTopology',
    'r9v2InformationBranchRouteValueReuseRejectedDependencies',
    'r9v2InformationBranchRouteValueReuseRejectedScopes',
    'r9v2InformationBranchRouteValueReuseRejectedActor',
    'r9v2InformationBranchRouteValueReuseRejectedBaseline',
    'r9v2InformationBranchRouteValueReuseRejectedRowIdentity',
    'r9v2InformationBranchRouteValueReuseRejectedProfile',
    'r9v2InformationBranchRouteValueReuseRejectedValue',
    'r9v2InformationBranchRouteValueReuseRejectedForce',
    'r9v2InformationBranchRouteValueReuseRejectedResources',
    'r9v2InformationBranchRouteValueReuseRejectedWorld',
    'r9v2InformationBranchRouteValueReuseRejectedUnit',
    'r9v2InformationBranchRouteValueReuseRejectedEntries',
  ];
  return {
    schemaVersion: 'M2TargetKernelRouteReuseDiagnosticV1',
    status: 'DIAGNOSTIC_CAPTURED',
    milestoneId: 'M2',
    taskId: 'M2-PATH-TARGET-KERNEL-ACTIVATION',
    caseId,
    targetProvider: 'r9v2_unregistered_test_registry_only',
    formalProvider: 'r8_not_measured',
    transaction: {
      draftMs: Number(draftMs.toFixed(3)),
      reportMs: Number(reportMs.toFixed(3)),
      auditMs: Number(auditMs.toFixed(3)),
      sealMs: Number(sealMs.toFixed(3)),
      verifyMs: Number(verifyMs.toFixed(3)),
      totalMs: Number((performance.now() - started).toFixed(3)),
      draftHash: text(draft?.draftHash),
      reportHash: text(reportAudit?.reportHash),
      projectionStatus: text(reportAudit?.reportDto?.projectionStatus),
    },
    decisionCount: decisionRows.length,
    timingTotals,
    targetKernelMetrics: {
      ...(evaluationSessionMetrics.targetKernelMetrics || {}),
    },
    metrics: {
      ...Object.fromEntries(
        metricKeys.map(key => [key, Number(metrics[key] || 0)]),
      ),
      ...Object.fromEntries(
        Object.entries(diagnosticMetrics).map(([key, value]) => [
          key,
          Number(value || 0),
        ]),
      ),
    },
    sourceHashes: {
      decision: sha256(readUtf8('BattleDecision_Module.js')),
      kernel: sha256(readUtf8('BattleDecisionR9v2Kernel_Module.js')),
      runtime: sha256(readUtf8('BattleRuntime_Module.js')),
      report: sha256(readUtf8('BattleReport_Module.js')),
      harness: sha256(readUtf8('tools/r83_rc6_battle_harness.mjs')),
    },
    toolHash: sha256(readUtf8('tools/rc6/harness/run-m5-p02-reuse-diagnostic.mjs')),
  };
}

const output = runDiagnostic();
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

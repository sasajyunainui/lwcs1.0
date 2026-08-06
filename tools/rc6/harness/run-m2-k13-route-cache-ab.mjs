import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  clone,
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
  'k13-route-cache-ab.json',
);
const caseId = 'raid_control_heavy';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readUtf8 = relativePath => fs.readFileSync(
  path.join(repoRoot, relativePath),
  'utf8',
);
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const metricsWithPrefix = (metrics, prefix) => Object.fromEntries(
  Object.entries(metrics || {})
    .filter(([key]) => key.startsWith(prefix))
    .sort(([left], [right]) => left.localeCompare(right)),
);

function disableRouteCaches(source) {
  const disabled = source
    .replace(
      /prepared\.state\.r9v2TargetRouteEntriesByKey/g,
      'null',
    )
    .replace(
      /prepared\.state\.r9v2TargetRouteBestByKey/g,
      'null',
    )
    .replace(
      /prepared\.state\.r9v2TargetRouteTablesByKey/g,
      'null',
    );
  assert(disabled !== source, 'K13_ROUTE_CACHE_AB_SOURCE_NOT_CHANGED');
  return disabled;
}

function runVariant(label, sourceOverride = null) {
  const sandbox = loadBattleSandbox({
    includeTargetKernel: true,
    ...(sourceOverride
      ? { sourceOverrides: { 'BattleDecision_Module.js': sourceOverride } }
      : {}),
  });
  const decision = sandbox.__LWCS_BATTLE_DECISION__;
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `K13_ROUTE_CACHE_AB_CASE_MISSING:${caseId}`);
  const world = clone(definition.combatData);
  const actors = [
    ...(world?.参战者?.team_player || []),
    ...(world?.参战者?.team_enemy || []),
  ];
  const session = decision.createEvaluationSession({
    objectiveHash: `k13-route-cache-ab:${caseId}`,
    visibleWorldRevision: `k13-route-cache-ab:world:${caseId}`,
    beliefRevision: `k13-route-cache-ab:belief:${caseId}`,
    opportunityRevision: `k13-route-cache-ab:opportunity:${caseId}`,
    resourceTimelineRevision: `k13-route-cache-ab:resource:${caseId}`,
    scheduleRevision: `k13-route-cache-ab:schedule:${caseId}`,
  });
  const decisionHashes = [];
  const startedAt = performance.now();
  try {
    actors.forEach((actor, index) => {
      const actorId = String(actor?.id || actor?.name || '').trim();
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
          opportunityId: `${caseId}:route-cache-ab:0:${index}`,
          ownerId: actorId,
          role: 'ACTIVE',
        },
        providerId: 'r9v2',
        analysisDepth: 'CANDIDATES_ONLY',
        r9v2InformationValueOnly: true,
        seed: `${definition.seed}:route-cache-ab:0:${index}`,
      });
      const result = decision.runR9v2TargetProviderForTest(request);
      assert(
        result?.selected?.candidateId,
        `K13_ROUTE_CACHE_AB_SELECTION_MISSING:${actorId}`,
      );
      decisionHashes.push(sha256(JSON.stringify(result)));
    });
    const sessionSnapshot = decision.readEvaluationSessionMetrics(session);
    const metrics = sessionSnapshot.metrics || {};
    return {
      label,
      elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
      decisionHashes,
      metrics: {
        requestCount: Number(metrics.requestCount || 0),
        poolUnitBuilds: Number(metrics.r9v2PoolUnitBuilds || 0),
        poolEntryCount: Number(metrics.r9v2PoolEntryCount || 0),
        poolUnitFallbacks: Number(metrics.r9v2PoolUnitFallbacks || 0),
        mechanicalBasisCompiles: Number(metrics.r9v2MechanicalBasisCompiles || 0),
        mechanicalBasisEvaluations: Number(metrics.r9v2MechanicalBasisEvaluations || 0),
        mechanicalEntryCacheHits: Number(metrics.r9v2MechanicalEntryCacheHits || 0),
        mechanicalEntryCacheMisses: Number(metrics.r9v2MechanicalEntryCacheMisses || 0),
        targetKernelVectorEvaluations: Number(metrics.r9v2TargetKernelVectorEvaluations || 0),
        targetKernelSliceHits: Number(metrics.r9v2TargetKernelSliceCacheHits || 0),
        targetKernelSliceMisses: Number(metrics.r9v2TargetKernelSliceCacheMisses || 0),
        routeHits: Number(metrics.r9v2TargetRouteCacheHits || 0),
        routeMisses: Number(metrics.r9v2TargetRouteCacheMisses || 0),
        routeEntryHits: Number(metrics.r9v2TargetRouteEntryCacheHits || 0),
        routeEntryMisses: Number(metrics.r9v2TargetRouteEntryCacheMisses || 0),
        routeValueReuseGateReasons: metricsWithPrefix(
          metrics,
          'r9v2InformationBranchRouteValueReuseGate:',
        ),
      },
      storeSizes: sessionSnapshot.storeSizes,
    };
  } finally {
    decision.disposeEvaluationSession(session);
  }
}

const currentSource = readUtf8('BattleDecision_Module.js');
const noRouteCacheSource = disableRouteCaches(currentSource);
const current = runVariant('current');
const noRouteCache = runVariant('no-route-cache', noRouteCacheSource);
const output = {
  schemaVersion: 'M2K13TargetRouteCacheABV1',
  status: JSON.stringify(current.decisionHashes) ===
      JSON.stringify(noRouteCache.decisionHashes) &&
    current.elapsedMs < noRouteCache.elapsedMs &&
    (1 - current.elapsedMs / noRouteCache.elapsedMs) >= 0.03
    ? 'PASSED'
    : 'REJECTED',
  scope: 'CURRENT_HASH_SINGLE_ROUND_TARGET_KERNEL_SELECTION_ONLY',
  caseId,
  current,
  noRouteCache,
  comparison: {
    elapsedGainPercent: Number(
      ((1 - current.elapsedMs / noRouteCache.elapsedMs) * 100).toFixed(3),
    ),
    decisionHashEqual: JSON.stringify(current.decisionHashes) ===
      JSON.stringify(noRouteCache.decisionHashes),
    repeatedHotPathCountsEqual: [
      'poolUnitBuilds',
      'poolEntryCount',
      'poolUnitFallbacks',
      'mechanicalBasisCompiles',
      'mechanicalBasisEvaluations',
      'targetKernelVectorEvaluations',
    ].every(key => current.metrics[key] === noRouteCache.metrics[key]),
  },
  sourceHashes: {
    decision: sha256(currentSource),
    noRouteCacheDecision: sha256(noRouteCacheSource),
    harness: sha256(readUtf8('tools/rc6/harness/run-m2-k13-route-cache-ab.mjs')),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

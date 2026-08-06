import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const harnessPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k13-target-cache-regression.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const sandbox = loadBattleSandbox({ includeTargetKernel: true });
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const definition = manualCasesById(sandbox).get('team_control_overlap');
assert(definition, 'K13_CACHE_CASE_MISSING');
const world = clone(definition.combatData);
const session = decision.createEvaluationSession({
  objectiveHash: 'k13-cache:objective',
  visibleWorldRevision: 'k13-cache:world',
  beliefRevision: 'k13-cache:belief',
  opportunityRevision: 'k13-cache:opportunity',
  resourceTimelineRevision: 'k13-cache:resource',
  scheduleRevision: 'k13-cache:schedule',
});

const makeRequest = (
  opportunityId,
  overrides = {},
  worldSnapshot = world,
  runtimeSnapshot = null,
) => decision.prepareDecisionRequest({
  session,
  worldSnapshot,
  actorId: String(worldSnapshot?.参战者?.team_player?.[0]?.id || '').trim(),
  objectiveContract: worldSnapshot.胜负条件,
  battleIntent: {
    mode: definition.intent,
    objectives: clone(worldSnapshot.胜负条件),
  },
  actionOpportunity: {
    opportunityId,
    ownerId: String(worldSnapshot?.参战者?.team_player?.[0]?.id || '').trim(),
    role: 'ACTIVE',
    futureHostileResponseAllowed: true,
    ...overrides,
  },
  providerId: 'r9v2',
  analysisDepth: 'CANDIDATES_ONLY',
  r9v2InformationValueOnly: true,
  ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
  seed: definition.seed,
});

const run = (
  opportunityId,
  overrides = {},
  worldSnapshot = world,
  runtimeSnapshot = null,
) => {
  const request = makeRequest(
    opportunityId,
    overrides,
    worldSnapshot,
    runtimeSnapshot,
  );
  return {
    request,
    result: decision.runR9v2TargetProviderForTest(request),
  };
};

const first = run('k13-cache:one');
const afterFirst = decision.readEvaluationSessionMetrics(session);
const second = run('k13-cache:one');
const afterSecond = decision.readEvaluationSessionMetrics(session);
const changedSemanticRequest = run('k13-cache:three', {
  futureHostileResponseAllowed: false,
});
const afterChanged = decision.readEvaluationSessionMetrics(session);
const changedWorld = clone(world);
const changedActor = changedWorld?.参战者?.team_player?.[0];
const changedHp = Math.max(1, Number(changedActor?.hp || 1) - 100);
if (changedActor) {
  changedActor.hp = changedHp;
  changedActor.HP = changedHp;
  if (changedActor.属性 && typeof changedActor.属性 === 'object') {
    changedActor.属性.HP = changedHp;
  }
}
const changedWorldRequest = run(
  'k13-cache:four',
  {},
  changedWorld,
);
const afterWorldChanged = decision.readEvaluationSessionMetrics(session);

const futureDefinition = manualCasesById(sandbox).get('team_protect_critical_ally');
assert(futureDefinition, 'K13_FUTURE_POOL_CASE_MISSING');
const futureWorld = clone(futureDefinition.combatData);
const futureSession = decision.createEvaluationSession({
  objectiveHash: 'k13-cache:future-objective',
  visibleWorldRevision: 'k13-cache:future-world',
  beliefRevision: 'k13-cache:future-belief',
  opportunityRevision: 'k13-cache:future-opportunity',
  resourceTimelineRevision: 'k13-cache:future-resource',
  scheduleRevision: 'k13-cache:future-schedule',
});
const futureActorId = String(
  futureWorld?.参战者?.team_player?.[0]?.id || '',
).trim();
const semanticRuntimeSnapshot = (opportunityId, ownerId) => ({
  opportunitySnapshot: [{
    opportunityId,
    ownerId,
    role: 'ACTIVE',
    status: 'PENDING',
    round: 1,
    sequence: 2,
    createdAtSequence: 2,
    futureHostileResponseAllowed: true,
    pendingNaturalActorIds: [ownerId],
    pendingHostileActorIds: [],
    naturalActionBudget: 10,
    battleHorizon: { maxRounds: 5 },
  }],
  scheduledEvents: [],
  resourceTimeline: [],
});
const futureRun = (opportunityId, futureOpportunityId) => {
  const request = decision.prepareDecisionRequest({
    session: futureSession,
    worldSnapshot: futureWorld,
    actorId: futureActorId,
    objectiveContract: futureWorld.胜负条件,
    battleIntent: {
      mode: futureDefinition.intent,
      objectives: clone(futureWorld.胜负条件),
    },
    actionOpportunity: {
      opportunityId,
      ownerId: futureActorId,
      role: 'ACTIVE',
      futureHostileResponseAllowed: true,
    },
    runtimeSnapshot: semanticRuntimeSnapshot(
      futureOpportunityId,
      futureActorId,
    ),
    providerId: 'r9v2',
    analysisDepth: 'CANDIDATES_ONLY',
    r9v2InformationValueOnly: true,
    seed: futureDefinition.seed,
  });
  return {
    request,
    result: decision.runR9v2TargetProviderForTest(request),
  };
};
const identityFirst = futureRun(
  'k13-cache:identity-current-a',
  'k13-cache:future-a',
);
const afterIdentityFirst = decision.readEvaluationSessionMetrics(futureSession);
const identitySecond = futureRun(
  'k13-cache:identity-current-b',
  'k13-cache:future-b',
);
const afterIdentitySecond = decision.readEvaluationSessionMetrics(futureSession);

const valueView = result => ({
  selectedCandidateId: result?.selected?.candidateId || '',
  selectedObjective: Number(result?.selected?.objectiveUtilityHEPP || 0),
  selectedInformation: Number(result?.selected?.informationValueHEPP || 0),
  candidates: (result?.candidateAudit || []).map(row => [
    row.candidateId,
    Number(row.objectiveUtilityHEPP || 0),
    row.rejectionCode || '',
    row.pareto === true,
  ]),
});

const sourceView = result => ({
  proofSource: result?.selected?.candidateValueProof?.source || null,
  causalValueFacts: result?.selected?.causalValueFacts || [],
  proofCausalFacts: result?.selected?.candidateValueProof?.causalFacts || [],
});

assert(
  JSON.stringify(valueView(first.result)) ===
    JSON.stringify(valueView(second.result)),
  'K13_CACHE_HIT_VALUE_MISMATCH',
);
assert(
  JSON.stringify(sourceView(first.result).causalValueFacts) ===
    JSON.stringify(sourceView(second.result).causalValueFacts),
  'K13_CACHE_HIT_CAUSAL_SOURCE_MISMATCH',
);
assert(
  String(sourceView(first.result).proofSource?.opportunityRevision || '') ===
    String(first.request.evaluationContext?.opportunityRevision || ''),
  'K13_FIRST_PROOF_SOURCE_REVISION_MISMATCH',
);
assert(
  String(sourceView(second.result).proofSource?.opportunityRevision || '') ===
    String(second.request.evaluationContext?.opportunityRevision || ''),
  'K13_REUSED_PROOF_SOURCE_REVISION_STALE',
);
const firstMetrics = afterFirst.metrics || {};
const secondMetrics = afterSecond.metrics || {};
const changedMetrics = afterChanged.metrics || {};
const worldChangedMetrics = afterWorldChanged.metrics || {};
assert(
  Number(secondMetrics.r9v2TargetKernelSliceCacheHits || 0) >
    Number(firstMetrics.r9v2TargetKernelSliceCacheHits || 0) ||
    Number(secondMetrics.r9v2TargetKernelStableSessionReuses || 0) >
      Number(firstMetrics.r9v2TargetKernelStableSessionReuses || 0),
  `K13_CACHE_HIT_NOT_OBSERVED:${JSON.stringify({ first: firstMetrics, second: secondMetrics })}`,
);
assert(
  Number(changedMetrics.r9v2TargetKernelSliceCacheMisses || 0) >
    Number(secondMetrics.r9v2TargetKernelSliceCacheMisses || 0) ||
    Number(changedMetrics.r9v2TargetKernelContextInvalidations || 0) >
      Number(secondMetrics.r9v2TargetKernelContextInvalidations || 0),
  `K13_CACHE_SEMANTIC_INVALIDATION_NOT_OBSERVED:${JSON.stringify({ second: secondMetrics, changed: changedMetrics })}`,
);
assert(
  Number(changedMetrics.r9v2TargetKernelVectorEvaluations || 0) >
    Number(secondMetrics.r9v2TargetKernelVectorEvaluations || 0),
  'K13_CACHE_INVALIDATION_DID_NOT_REEVALUATE',
);
assert(
  Number(worldChangedMetrics.r9v2TargetKernelSliceCacheMisses || 0) >
    Number(changedMetrics.r9v2TargetKernelSliceCacheMisses || 0) ||
    Number(worldChangedMetrics.r9v2TargetKernelCandidateSnapshotDeltas || 0) >
      Number(changedMetrics.r9v2TargetKernelCandidateSnapshotDeltas || 0) ||
    Number(worldChangedMetrics.r9v2TargetKernelVectorEvaluations || 0) >
      Number(changedMetrics.r9v2TargetKernelVectorEvaluations || 0),
  'K13_CACHE_WORLD_CHANGE_NOT_INVALIDATED',
);
assert(
  Number(worldChangedMetrics.r9v2TargetKernelVectorEvaluations || 0) >
    Number(changedMetrics.r9v2TargetKernelVectorEvaluations || 0),
  'K13_CACHE_WORLD_CHANGE_DID_NOT_REEVALUATE',
);
assert(
  String(
    sourceView(changedWorldRequest.result).proofSource?.worldRevision || '',
  ) === String(
    changedWorldRequest.request.evaluationContext?.worldRevision || '',
  ),
  'K13_WORLD_CHANGE_PROOF_SOURCE_REVISION_MISMATCH',
);
assert(
  JSON.stringify(valueView(identityFirst.result)) ===
    JSON.stringify(valueView(identitySecond.result)),
  'K13_IDENTITY_ONLY_VALUE_MISMATCH',
);
assert(
  Number(afterIdentitySecond.metrics?.r9v2PoolUnitBuilds || 0) ===
    Number(afterIdentityFirst.metrics?.r9v2PoolUnitBuilds || 0),
  'K13_IDENTITY_ONLY_OBSERVER_POOL_REBUILT',
);
assert(
  String(identityFirst.result?.selected?.candidateValueProof?.source?.opportunityRevision || '') ===
    String(identityFirst.request.evaluationContext?.opportunityRevision || ''),
  'K13_IDENTITY_FIRST_SOURCE_REVISION_MISMATCH',
);
assert(
  String(identitySecond.result?.selected?.candidateValueProof?.source?.opportunityRevision || '') ===
    String(identitySecond.request.evaluationContext?.opportunityRevision || ''),
  'K13_IDENTITY_SECOND_SOURCE_REVISION_MISMATCH',
);
assert(
  String(identityFirst.request.evaluationContext?.opportunityRevision || '') !==
    String(identitySecond.request.evaluationContext?.opportunityRevision || ''),
  'K13_IDENTITY_ONLY_REVISION_DID_NOT_CHANGE',
);

const output = {
  schemaVersion: 'M2K13TargetKernelCacheRegressionV1',
  status: 'PASSED',
  caseId: 'team_control_overlap',
  repeatedSemanticRequest: 'complete opportunity snapshot is identical',
  invalidatedRequest: 'futureHostileResponseAllowed differs',
  worldChangedRequest: 'actor HP changed; semantic cache key must invalidate',
  valueEquivalent: true,
  reusedProofSourceCurrent: true,
  cacheHitDelta: Number(
    secondMetrics.r9v2TargetKernelSliceCacheHits || 0,
  ) - Number(firstMetrics.r9v2TargetKernelSliceCacheHits || 0),
  cacheMissDeltaAfterSemanticChange: Number(
    changedMetrics.r9v2TargetKernelSliceCacheMisses || 0,
  ) - Number(secondMetrics.r9v2TargetKernelSliceCacheMisses || 0),
  vectorReevaluationDeltaAfterSemanticChange: Number(
    changedMetrics.r9v2TargetKernelVectorEvaluations || 0,
  ) - Number(secondMetrics.r9v2TargetKernelVectorEvaluations || 0),
  cacheMissDeltaAfterWorldChange: Number(
    worldChangedMetrics.r9v2TargetKernelSliceCacheMisses || 0,
  ) - Number(changedMetrics.r9v2TargetKernelSliceCacheMisses || 0),
  vectorReevaluationDeltaAfterWorldChange: Number(
    worldChangedMetrics.r9v2TargetKernelVectorEvaluations || 0,
  ) - Number(changedMetrics.r9v2TargetKernelVectorEvaluations || 0),
  sourceRevisions: {
    first: sourceView(first.result).proofSource?.opportunityRevision || '',
    reused: sourceView(second.result).proofSource?.opportunityRevision || '',
    changedWorld: sourceView(changedWorldRequest.result).proofSource?.worldRevision || '',
  },
  identityOnlyReuse: {
    valueEquivalent: true,
    observerPoolUnitBuildDelta: Number(
      afterIdentitySecond.metrics?.r9v2PoolUnitBuilds || 0,
    ) - Number(afterIdentityFirst.metrics?.r9v2PoolUnitBuilds || 0),
    futurePoolPathExercised: false,
    sourceRevisionChanged: true,
  },
  sourceHashes: {
    decision: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
    kernel: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
    harness: sha256(fs.readFileSync(harnessPath)),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
decision.disposeEvaluationSession(session);
decision.disposeEvaluationSession(futureSession);

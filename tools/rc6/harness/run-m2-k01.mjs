import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const modulePath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k01-kernel-skeleton.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(modulePath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
assert(kernel?.version === '9v2-kernel-1.3.0', 'K01_VERSION_MISMATCH');
assert(typeof kernel.createSession === 'function', 'K01_CREATE_SESSION_MISSING');
assert(typeof kernel.evaluateAllCandidates === 'function', 'K01_EVALUATE_ALL_MISSING');
assert(typeof kernel.applyFactDelta === 'function', 'K01_APPLY_DELTA_MISSING');
assert(typeof kernel.materializeProof === 'function', 'K01_MATERIALIZE_PROOF_MISSING');

const candidates = [
  {
    candidateId: 'k01-a',
    actorId: 'actor-a',
    actionId: 'attack-a',
    actionKind: 'ATTACK',
    targetSet: ['target-a'],
    paymentMode: 'FULL',
    dependencyTokens: ['world:target-a'],
    stateDeltaTotal: 20,
    actionPoolDeltaTotal: 3,
    terminalDeltaTotal: 0,
    causalFacts: [
      { componentCode: 'target_trajectory', causalOwnerType: 'STATE_DELTA', valueHEPP: 20, sourceEventId: 'e-a-state', sourceFactId: 'f-a-state', targetUnitId: 'target-a', sequence: 1 },
      { componentCode: 'response', causalOwnerType: 'ACTION_POOL_DELTA', valueHEPP: 3, sourceEventId: 'e-a-pool', sourceFactId: 'f-a-pool', targetUnitId: 'target-a', sequence: 2 },
    ],
  },
  {
    candidateId: 'k01-b',
    actorId: 'actor-a',
    actionId: 'defend-a',
    actionKind: 'DEFEND',
    targetSet: ['actor-a'],
    paymentMode: 'FULL',
    dependencyTokens: ['world:actor-a'],
    stateDeltaTotal: 0,
    actionPoolDeltaTotal: 0,
    terminalDeltaTotal: 0,
    causalFacts: [],
  },
];
const session = kernel.createSession({
  worldRevision: 'world:1',
  beliefRevision: 'belief:1',
  opportunityRevision: 'opportunity:1',
  observerId: 'actor-a',
  beliefOverlay: {
    observerId: 'actor-a',
    beliefRevision: 'belief:1',
    visibleHpRatios: { 'target-a': 0.8 },
    visibleStates: { 'target-a': [] },
    revealedAbilityIds: [],
    observableDeclarations: [],
    posteriorParameters: {},
    visibilityTokens: ['public:target-a'],
  },
  candidates,
});
assert(session.candidateIds.length === 2, 'K01_CANDIDATE_COUNT_MISMATCH');
assert(Object.isFrozen(session.mechanicalColumns), 'K01_COLUMNS_NOT_FROZEN');
assert(Object.isFrozen(session.beliefOverlay), 'K03_BELIEF_OVERLAY_NOT_FROZEN');
assert(session.beliefOverlay.visibleHpRatios['target-a'] === 0.8, 'K03_PUBLIC_HP_RATIO_MISSING');
assert(session.mechanicalColumns.candidateIds.join(',') === 'k01-a,k01-b', 'K01_CANDIDATE_ORDER_CHANGED');
const vectors = kernel.evaluateAllCandidates(session, 'actor-a');
assert(vectors.length === 2, 'K01_VECTOR_COUNT_MISMATCH');
assert(vectors[0].goalUtilityDeltaHEPP === 23, 'K01_GOAL_DECOMPOSITION_MISMATCH');
const deltaResult = kernel.applyFactDelta(session, 0, {
  operation: 'SET',
  entityType: 'UNIT',
  entityId: 'target-a',
  fieldCode: 'hpRatio',
  beforeValue: 0.8,
  afterValue: 0.6,
  sourceEventId: 'e-delta',
  sourceFactId: 'f-delta',
  dependencyTokens: ['world:target-a'],
});
assert(deltaResult.fullRebuildRequired === false, 'K01_UNEXPECTED_FULL_REBUILD');
assert(deltaResult.dirtyCandidateIds.length === 1 && deltaResult.dirtyCandidateIds[0] === 'k01-a', 'K01_DIRTY_SCOPE_MISMATCH');
const unknownDeltaResult = kernel.applyFactDelta(session, 1, {
  operation: 'SET',
  entityType: 'WORLD',
  entityId: 'unknown',
  fieldCode: 'topology',
  beforeValue: null,
  afterValue: 'changed',
  sourceEventId: 'e-topology',
  sourceFactId: 'f-topology',
  dependencyTokens: ['world:unknown'],
});
assert(unknownDeltaResult.fullRebuildRequired === true, 'K04_UNKNOWN_DEPENDENCY_NOT_FULL_REBUILD');
const proof = kernel.materializeProof(session, 'k01-a');
assert(proof.objectiveUtilityHEPP === 23, 'K01_PROOF_VALUE_MISMATCH');
let revisionMismatch = false;
try {
  kernel.applyFactDelta(session, 0, { operation: 'SET', entityType: 'UNIT', entityId: 'target-a', fieldCode: 'hpRatio', sourceEventId: 'e2', sourceFactId: 'f2', dependencyTokens: ['world:target-a'] });
} catch (error) {
  revisionMismatch = String(error.message).startsWith('R9V2_KERNEL_REVISION_MISMATCH');
}
assert(revisionMismatch, 'K01_REVISION_MISMATCH_NOT_FATAL');

const output = {
  schemaVersion: 'M2K01K04KernelGateV1',
  status: 'PASSED',
  moduleHash: sha256(fs.readFileSync(modulePath)),
  kernelVersion: kernel.version,
  schemaVersionExposed: kernel.schemaVersion,
  candidateCount: session.candidateIds.length,
  vectorCount: vectors.length,
  dirtyCandidateIds: deltaResult.dirtyCandidateIds,
  unknownDeltaFullRebuild: unknownDeltaResult.fullRebuildRequired,
  publicBeliefOverlayFrozen: Object.isFrozen(session.beliefOverlay),
  proofCandidateId: proof.candidateId,
  revisionMismatchFatal: revisionMismatch,
  formalProviderChanged: false,
  registryChanged: false,
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify(output, null, 2));

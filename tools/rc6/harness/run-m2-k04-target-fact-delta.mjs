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
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k04-target-fact-delta.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const sandbox = loadBattleSandbox({ includeTargetKernel: true });
const targetKernelSink = { slices: [] };
sandbox.__LWCS_R9V2_TARGET_KERNEL_TEST_SINK__ = targetKernelSink;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const definition = manualCasesById(sandbox).get('duel_overmatch_lethal');
assert(definition, 'K04_CASE_MISSING');
const world = clone(definition.combatData);
const actorId = String(world?.参战者?.team_player?.[0]?.id || '').trim();
assert(actorId, 'K04_ACTOR_MISSING');
const request = decision.prepareDecisionRequest({
  worldSnapshot: world,
  actorId,
  objectiveContract: world.胜负条件,
  battleIntent: {
    mode: definition.intent,
    objectives: clone(world.胜负条件),
  },
  actionOpportunity: {
    opportunityId: 'duel_overmatch_lethal:k04',
    role: 'ACTIVE',
  },
  providerId: 'r9v2',
  analysisDepth: 'CANDIDATES_ONLY',
  r9v2InformationValueOnly: true,
  collectDecisionReplayIdentity: true,
  seed: definition.seed,
});
decision.runR9v2TargetProviderForTest(request);
const slice = targetKernelSink.slices.at(-1);
assert(slice?.session && slice?.kernel, 'K04_TARGET_SESSION_MISSING');

const sourceRow = slice.rows.find(row =>
  (row.rawInput?.mechanicalEntry?.contributions || [])
    .some(contribution => contribution?.outcomeKind === 'HP_DELTA'),
);
assert(sourceRow, 'K04_HEALTH_CONTRIBUTION_MISSING');
const contribution = sourceRow.rawInput.mechanicalEntry.contributions.find(
  row => row?.outcomeKind === 'HP_DELTA',
);
const beforeValue = Number(contribution.expectedDelta);
assert(Number.isFinite(beforeValue) && beforeValue !== 0, 'K04_DELTA_SOURCE_INVALID');
const afterValue = beforeValue / 2;
const delta = {
  operation: 'SET',
  entityType: 'MECHANICAL_ENTRY',
  entityId: sourceRow.candidateId,
  fieldCode: `contributions.expectedDelta:${contribution.effectInstanceId}`,
  beforeValue,
  afterValue,
  sourceEventId: 'k04:fact-delta:event',
  sourceFactId: 'k04:fact-delta:fact',
  dependencyTokens: [`candidate:${sourceRow.candidateId}`],
};

const beforeVectors = new Map(
  slice.vectors.map(vector => [vector.candidateId, vector]),
);
const deltaResult = slice.kernel.applyFactDelta(slice.session, 0, delta);
assert(deltaResult.fullRebuildRequired === false, 'K04_UNEXPECTED_FULL_REBUILD');
assert(
  deltaResult.dirtyCandidateIds.length === 1 &&
    deltaResult.dirtyCandidateIds[0] === sourceRow.candidateId,
  'K04_DIRTY_SCOPE_MISMATCH',
);
const afterVectors = slice.kernel.evaluateAllCandidates(
  slice.session,
  actorId,
);
const afterById = new Map(
  afterVectors.map(vector => [vector.candidateId, vector]),
);
const beforeVector = beforeVectors.get(sourceRow.candidateId);
const afterVector = afterById.get(sourceRow.candidateId);
assert(beforeVector && afterVector, 'K04_TARGET_VECTOR_MISSING');
assert(
  beforeVector.stateDeltaTotal !== afterVector.stateDeltaTotal,
  'K04_TARGET_VALUE_DID_NOT_CHANGE',
);
for (const [candidateId, vector] of beforeVectors) {
  if (candidateId === sourceRow.candidateId) continue;
  const after = afterById.get(candidateId);
  assert(after, `K04_UNRELATED_VECTOR_MISSING:${candidateId}`);
  assert(
    JSON.stringify(vector) === JSON.stringify(after),
    `K04_UNRELATED_VECTOR_CHANGED:${candidateId}`,
  );
}
const proof = slice.kernel.materializeProof(slice.session, sourceRow.candidateId);
assert(
  proof.goalUtilityDeltaHEPP === afterVector.goalUtilityDeltaHEPP,
  'K04_PROOF_VECTOR_MISMATCH',
);

const output = {
  schemaVersion: 'M2K04TargetFactDeltaGateV1',
  status: 'PASSED',
  caseId: 'duel_overmatch_lethal',
  candidateId: sourceRow.candidateId,
  fieldCode: delta.fieldCode,
  beforeValue,
  afterValue,
  dirtyCandidateIds: deltaResult.dirtyCandidateIds,
  fullRebuildRequired: deltaResult.fullRebuildRequired,
  targetStateDeltaBefore: beforeVector.stateDeltaTotal,
  targetStateDeltaAfter: afterVector.stateDeltaTotal,
  unrelatedCandidatesStable: true,
  proofMatchesUpdatedVector: true,
  kernelHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
  decisionHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

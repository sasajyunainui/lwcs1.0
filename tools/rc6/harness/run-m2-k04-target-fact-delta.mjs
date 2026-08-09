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
const evidencePath = process.env.RC6_EVIDENCE_PATH
  ? path.resolve(repoRoot, process.env.RC6_EVIDENCE_PATH)
  : path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k04-target-fact-delta.json');
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

const operationExpectations = new Map([
  ['SET', 7],
  ['ADD', 13],
  ['REMOVE', 0],
  ['EXPIRE', 0],
  ['SPAWN', 7],
  ['DESPAWN', 0],
  ['SCHEDULE', 7],
  ['CANCEL', 0],
]);
const applyProbeOperation = (baseValue, factDelta) => {
  const operation = String(factDelta?.operation || '').trim();
  if (operation === 'ADD') return baseValue + Number(factDelta.afterValue);
  if (['REMOVE', 'EXPIRE', 'DESPAWN', 'CANCEL'].includes(operation)) {
    return 0;
  }
  return Number(factDelta.afterValue);
};
const zeroParetoComponents = () => [
  'worstTailUtilityHEPP',
  'survivalUtilityHEPP',
  'assetReserveHEPP',
  'discardedOverkillPP',
].map(dimensionCode => ({ dimensionCode, value: 0 }));
const operationRows = [];
for (const [operation, expectedValue] of operationExpectations) {
  const componentDefinition = {
    componentCode: 'delta_probe',
    semanticDomain: 'S4',
    causalOwnerType: 'STATE_DELTA',
    inputColumnCodes: ['candidateIds'],
    dependencyKinds: ['world'],
    contributesToGoal: true,
    contributesToPareto: true,
    materializerId: 'k04_delta_probe',
    requires: [],
  };
  const registry = {
    schemaVersion: 'KernelComponentRegistryRuntimeV1',
    componentDefinitions: [componentDefinition],
    validateFactDelta: candidateDelta =>
      operationExpectations.has(String(candidateDelta?.operation || '').trim()),
    componentCodesForFactDelta: () => ['delta_probe'],
    evaluateComponents: ({ candidate, factDeltas }) => {
      const ownDeltas = factDeltas.filter(candidateDelta =>
        (candidateDelta.dependencyTokens || [])
          .includes(`unit:${candidate.candidateId}`),
      );
      const value = ownDeltas.reduce(
        (current, candidateDelta) =>
          applyProbeOperation(current, candidateDelta),
        candidate.candidateId === 'target' ? 10 : 20,
      );
      return {
        candidateId: candidate.candidateId,
        components: {
          delta_probe: {
            facts: value === 0
              ? []
              : [{
                  componentCode: 'delta_probe',
                  causalOwnerType: 'STATE_DELTA',
                  valueHEPP: value,
                  sourceEventId: `${candidate.candidateId}:event`,
                  sourceFactId: `${candidate.candidateId}:fact`,
                  targetUnitId: candidate.candidateId,
                  sequence: 0,
                }],
            informationComponents: [],
            paretoComponents: zeroParetoComponents(),
            unsupportedOutcomeKinds: [],
          },
        },
      };
    },
  };
  const candidates = ['target', 'unrelated'].map(candidateId => ({
    candidateId,
    actionId: `${candidateId}:action`,
    actorId: 'actor',
    targetSet: [candidateId],
    paymentMode: 'FULL',
    dependencyTokens: [`unit:${candidateId}`],
    rawInput: { schemaVersion: 'K04DeltaProbeInputV1' },
  }));
  const operationSession = slice.kernel.createSession({
    calculationMode: slice.kernel.rawCalculationMode,
    componentRegistry: registry,
    worldRevision: `k04:${operation}`,
    beliefRevision: '1',
    opportunityRevision: '1',
    observerId: 'actor',
    beliefOverlay: {
      observerId: 'actor',
      beliefRevision: '1',
      visibleHpRatios: {},
      visibleStates: {},
      revealedAbilityIds: [],
      observableDeclarations: [],
      posteriorParameters: {},
      visibilityTokens: [],
    },
    candidates,
  });
  const operationBefore = slice.kernel.evaluateAllCandidates(
    operationSession,
    'actor',
  );
  const unrelatedBefore = operationBefore.find(row =>
    row.candidateId === 'unrelated'
  );
  const operationDelta = {
    operation,
    entityType: 'UNIT',
    entityId: 'target',
    fieldCode: 'probeValue',
    beforeValue: 10,
    afterValue: operation === 'ADD' ? 3 : 7,
    sourceEventId: `k04:${operation}:event`,
    sourceFactId: `k04:${operation}:fact`,
    dependencyTokens: ['unit:target'],
  };
  const operationResult = slice.kernel.applyFactDelta(
    operationSession,
    0,
    operationDelta,
  );
  assert(
    operationResult.fullRebuildRequired === false,
    `K04_OPERATION_FULL_REBUILD:${operation}`,
  );
  assert(
    JSON.stringify(operationResult.dirtyCandidateIds) ===
      JSON.stringify(['target']),
    `K04_OPERATION_DIRTY_SCOPE:${operation}`,
  );
  assert(
    JSON.stringify(operationResult.invalidatedComponentCodes) ===
      JSON.stringify(['delta_probe']),
    `K04_OPERATION_COMPONENT_SCOPE:${operation}`,
  );
  const operationAfter = slice.kernel.evaluateAllCandidates(
    operationSession,
    'actor',
  );
  const targetAfter = operationAfter.find(row => row.candidateId === 'target');
  const unrelatedAfter = operationAfter.find(row =>
    row.candidateId === 'unrelated'
  );
  assert(
    targetAfter?.stateDeltaTotal === expectedValue,
    `K04_OPERATION_VALUE:${operation}:${targetAfter?.stateDeltaTotal}`,
  );
  assert(
    JSON.stringify(unrelatedBefore) === JSON.stringify(unrelatedAfter),
    `K04_OPERATION_UNRELATED_CHANGED:${operation}`,
  );
  operationRows.push({
    operation,
    dirtyCandidateIds: operationResult.dirtyCandidateIds,
    invalidatedComponentCodes: operationResult.invalidatedComponentCodes,
    valueAfter: targetAfter.stateDeltaTotal,
    unrelatedCandidateStable: true,
  });
}

const unknownDependencySession = slice.kernel.createSession({
  calculationMode: slice.kernel.rawCalculationMode,
  componentRegistry: {
    schemaVersion: 'KernelComponentRegistryRuntimeV1',
    componentDefinitions: [{
      componentCode: 'fallback_probe',
      semanticDomain: 'S4',
      causalOwnerType: 'NONE',
      inputColumnCodes: ['candidateIds'],
      dependencyKinds: ['world'],
      contributesToGoal: false,
      contributesToPareto: false,
      materializerId: 'k04_fallback_probe',
      requires: [],
    }],
    validateFactDelta: () => true,
    componentCodesForFactDelta: () => ['fallback_probe'],
    evaluateComponents: ({ candidate }) => ({
      candidateId: candidate.candidateId,
      components: {
        fallback_probe: {
          facts: [],
          informationComponents: [],
          paretoComponents: zeroParetoComponents(),
          unsupportedOutcomeKinds: [],
        },
      },
    }),
  },
  worldRevision: 'k04:fallback',
  beliefRevision: '1',
  opportunityRevision: '1',
  observerId: 'actor',
  beliefOverlay: {
    observerId: 'actor',
    beliefRevision: '1',
    visibleHpRatios: {},
    visibleStates: {},
    revealedAbilityIds: [],
    observableDeclarations: [],
    posteriorParameters: {},
    visibilityTokens: [],
  },
  candidates: [{
    candidateId: 'fallback',
    actionId: 'fallback:action',
    actorId: 'actor',
    targetSet: ['fallback'],
    paymentMode: 'FULL',
    dependencyTokens: ['unit:fallback'],
    rawInput: { schemaVersion: 'K04FallbackProbeInputV1' },
  }],
});
const unknownDependencyResult = slice.kernel.applyFactDelta(
  unknownDependencySession,
  0,
  {
    operation: 'SPAWN',
    entityType: 'UNIT',
    entityId: 'new-unit',
    fieldCode: 'topology',
    beforeValue: null,
    afterValue: { id: 'new-unit' },
    sourceEventId: 'k04:unknown:event',
    sourceFactId: 'k04:unknown:fact',
    dependencyTokens: ['unit:new-unit'],
  },
);
assert(
  unknownDependencyResult.fullRebuildRequired === true,
  'K04_UNKNOWN_OWNER_NOT_FULL_REBUILD',
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
  operationRows,
  allOperationsCovered:
    operationRows.length === operationExpectations.size,
  unknownDependencyFullRebuild:
    unknownDependencyResult.fullRebuildRequired,
  kernelHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
  decisionHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

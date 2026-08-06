import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kernelPath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const registryPath = path.join(repoRoot, 'tools', 'rc6', 'contracts', 'KernelComponentRegistryV1.json');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'kernel-incremental-fixture.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(kernelPath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
assert(kernel?.rawCalculationMode === 'COMPONENT_REGISTRY_V1', 'INCREMENTAL_KERNEL_NOT_LOADED');

const candidate = (candidateId, value) => ({
  candidateId,
  actionId: `action:${candidateId}`,
  actorId: 'actor-1',
  targetSet: ['target-1'],
  paymentMode: 'FULL',
  dependencyTokens: [`unit:${candidateId}`],
  directFacts: [],
  scheduledFacts: [],
  resourceCosts: {},
  successProbability: 1,
  legal: true,
  hardExclusionCodes: [],
  rawInput: {
    schemaVersion: 'KernelCandidateRawInputV1',
    mechanicalEntry: { candidateId, probeValue: value },
  },
});

const candidates = [candidate('A', 10), candidate('B', 20), candidate('C', 30)];
let componentEvaluations = 0;
const componentDefinitions = JSON.parse(
  fs.readFileSync(registryPath, 'utf8'),
).components.map(definition => ({
  ...definition,
  requires: [],
}));
const componentRegistry = {
  schemaVersion: 'KernelComponentRegistryRuntimeV1',
  componentDefinitions,
  validateFactDelta: delta =>
    delta?.operation === 'ADD' &&
    delta?.entityType === 'MECHANICAL_ENTRY' &&
    delta?.fieldCode === 'probeValue',
  componentCodesForFactDelta: delta => {
    if (
      delta?.entityType === 'MECHANICAL_ENTRY' &&
      delta?.fieldCode === 'probeValue'
    ) return componentDefinitions.map(definition => definition.componentCode);
    return null;
  },
  evaluateComponents: ({ candidate: row, factDeltas, componentCodes }) => {
    componentEvaluations += 1;
    const base = Number(row.rawInput.mechanicalEntry.probeValue);
    const delta = factDeltas
      .filter(fact => fact.dependencyTokens.includes(`unit:${row.candidateId}`))
      .reduce((total, fact) => total + Number(fact.afterValue || 0), 0);
    const value = base + delta;
    const components = {};
    componentCodes.forEach(componentCode => {
      components[componentCode] = {
        facts: componentCode === 'basic_hit'
          ? [{
              componentCode,
              causalOwnerType: 'STATE_DELTA',
              valueHEPP: value,
              sourceEventId: 'incremental:event',
              sourceFactId: `incremental:${row.candidateId}:${value}`,
              targetUnitId: 'target-1',
              sequence: 0,
            }]
          : [],
        informationComponents: [],
        paretoComponents: componentCode === 'pareto_selection'
          ? [
              { dimensionCode: 'worstTailUtilityHEPP', value },
              { dimensionCode: 'survivalUtilityHEPP', value: 0 },
              { dimensionCode: 'assetReserveHEPP', value: 0 },
              { dimensionCode: 'discardedOverkillPP', value: 0 },
            ]
          : [],
        unsupportedOutcomeKinds: [],
      };
    });
    return { components };
  },
};

const create = () => kernel.createSession({
  calculationMode: kernel.rawCalculationMode,
  componentRegistry,
  worldRevision: 'fixture-world',
  beliefRevision: 'fixture-belief',
  opportunityRevision: 'fixture-opportunity',
  observerId: 'actor-1',
  beliefOverlay: {
    observerId: 'actor-1',
    beliefRevision: 'fixture-belief',
    visibleHpRatios: {},
    visibleStates: {},
    revealedAbilityIds: [],
    observableDeclarations: [],
    posteriorParameters: {},
    visibilityTokens: [],
  },
  candidates: clone(candidates),
});

const session = create();
const first = kernel.evaluateAllCandidates(session, 'actor-1');
const firstEvaluationCount = componentEvaluations;
const repeated = kernel.evaluateAllCandidates(session, 'actor-1');
const repeatedEvaluationCount = componentEvaluations;
assert(firstEvaluationCount === 3, `INCREMENTAL_INITIAL_EVALUATIONS:${firstEvaluationCount}`);
assert(repeatedEvaluationCount === 3, `INCREMENTAL_REPEAT_REBUILT:${repeatedEvaluationCount}`);
assert(JSON.stringify(first) === JSON.stringify(repeated), 'INCREMENTAL_REPEAT_VALUE_CHANGED');

const beforeById = new Map(first.map(vector => [vector.candidateId, vector]));
const deltaResult = kernel.applyFactDelta(session, 0, {
  operation: 'ADD',
  entityType: 'MECHANICAL_ENTRY',
  entityId: 'A',
  fieldCode: 'probeValue',
  beforeValue: 10,
  afterValue: 1,
  sourceEventId: 'incremental:delta:event',
  sourceFactId: 'incremental:delta:fact',
  dependencyTokens: ['unit:A'],
});
assert(deltaResult.fullRebuildRequired === false, 'INCREMENTAL_UNEXPECTED_FULL_REBUILD');
assert(JSON.stringify(deltaResult.dirtyCandidateIds) === JSON.stringify(['A']), 'INCREMENTAL_DIRTY_SCOPE_WRONG');
const after = kernel.evaluateAllCandidates(session, 'actor-1');
const afterEvaluationCount = componentEvaluations;
assert(afterEvaluationCount === 4, `INCREMENTAL_UNRELATED_REBUILT:${afterEvaluationCount}`);
const afterById = new Map(after.map(vector => [vector.candidateId, vector]));
assert(afterById.get('A').stateDeltaTotal === 11, 'INCREMENTAL_DIRTY_VECTOR_NOT_UPDATED');
for (const candidateId of ['B', 'C']) {
  const beforeVector = beforeById.get(candidateId);
  const afterVector = afterById.get(candidateId);
  assert(beforeVector.stateDeltaTotal === afterVector.stateDeltaTotal, `INCREMENTAL_CLEAN_VECTOR_CHANGED:${candidateId}`);
  assert(JSON.stringify(beforeVector.paretoWitness) === JSON.stringify(afterVector.paretoWitness), `INCREMENTAL_CLEAN_PARETO_CHANGED:${candidateId}`);
}
assert(session.metrics.paretoReassemblies === 2, `INCREMENTAL_PARETO_REASSEMBLY_COUNT:${session.metrics.paretoReassemblies}`);

const fullSession = create();
kernel.applyFactDelta(fullSession, 0, {
  operation: 'ADD',
  entityType: 'MECHANICAL_ENTRY',
  entityId: 'A',
  fieldCode: 'probeValue',
  beforeValue: 10,
  afterValue: 1,
  sourceEventId: 'incremental:delta:event',
  sourceFactId: 'incremental:delta:fact',
  dependencyTokens: ['unit:A'],
});
const full = kernel.evaluateAllCandidates(fullSession, 'actor-1');
assert(JSON.stringify(after) === JSON.stringify(full), 'INCREMENTAL_FULL_RESULT_MISMATCH');
const proof = kernel.materializeProof(session, 'A');
assert(proof.goalUtilityDeltaHEPP === afterById.get('A').goalUtilityDeltaHEPP, 'INCREMENTAL_PROOF_VECTOR_MISMATCH');

const output = {
  schemaVersion: 'M2KernelIncrementalFixtureV1',
  status: 'PASSED',
  candidateCount: candidates.length,
  firstEvaluationCount,
  repeatedEvaluationCount,
  afterEvaluationCount,
  dirtyCandidateIds: deltaResult.dirtyCandidateIds,
  fullRebuildRequired: deltaResult.fullRebuildRequired,
  cleanCandidatesStable: true,
  paretoReassembledAfterDirtyVector: session.metrics.paretoReassemblies === 2,
  incrementalMatchesFullRebuild: true,
  kernelHash: sha256(fs.readFileSync(kernelPath)),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

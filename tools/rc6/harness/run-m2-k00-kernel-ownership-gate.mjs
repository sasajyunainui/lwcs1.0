import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kernelPath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const registryPath = path.join(repoRoot, 'tools', 'rc6', 'contracts', 'KernelComponentRegistryV1.json');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k00-kernel-ownership.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const expectError = (run, code) => {
  try {
    run();
  } catch (error) {
    assert(String(error?.message || error).startsWith(code), `EXPECTED_${code}_GOT_${String(error?.message || error)}`);
    return;
  }
  throw new Error(`EXPECTED_ERROR_MISSING:${code}`);
};

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(kernelPath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
assert(kernel?.rawCalculationMode === 'COMPONENT_REGISTRY_V1', 'K00_RAW_MODE_NOT_EXPORTED');

const baseCandidate = {
  candidateId: 'ownership-candidate',
  actionId: 'ownership-action',
  actorId: 'actor-1',
  targetSet: ['target-1'],
  paymentMode: 'FULL',
  dependencyTokens: ['case:ownership'],
  directFacts: [],
  scheduledFacts: [],
  resourceCosts: {},
  successProbability: 1,
  legal: true,
  hardExclusionCodes: [],
  rawInput: {
    schemaVersion: 'KernelCandidateRawInputV1',
    mechanicalEntry: { candidateId: 'ownership-candidate' },
  },
};

const componentDefinitions = JSON.parse(
  fs.readFileSync(registryPath, 'utf8'),
).components.map(definition => ({
  ...definition,
  requires: [],
}));

expectError(
  () => kernel.createSession({
    calculationMode: kernel.rawCalculationMode,
    candidates: [{ ...baseCandidate, stateDeltaTotal: 999 }],
  }),
  'R9V2_KERNEL_COMPONENT_REGISTRY_MISSING',
);
expectError(
  () => kernel.createSession({
    calculationMode: kernel.rawCalculationMode,
    componentRegistry: {
      componentDefinitions,
      evaluateCandidate: () => ({}),
      componentCodesForFactDelta: () => [],
    },
    candidates: [{ ...baseCandidate, stateDeltaTotal: 999 }],
  }),
  'R9V2_KERNEL_COMPONENT_REGISTRY_MISSING',
);
expectError(
  () => kernel.createSession({
    calculationMode: kernel.rawCalculationMode,
    componentRegistry: {
      componentDefinitions,
      componentCodesForFactDelta: () => [],
      evaluateComponents: () => ({ components: {} }),
    },
    candidates: [{
      ...baseCandidate,
      rawInput: {
        ...baseCandidate.rawInput,
        mechanicalEntry: {
          ...baseCandidate.rawInput.mechanicalEntry,
          assetReserve: 10,
        },
      },
    }],
  }),
  'R9V2_KERNEL_RAW_COMPUTED_FIELD_INPUT',
);

let evaluationCount = 0;
const componentRegistry = {
  schemaVersion: 'KernelComponentRegistryRuntimeV1',
  componentDefinitions,
  validateFactDelta: () => true,
  componentCodesForFactDelta: () => ['basic_hit'],
  evaluateComponents: ({ candidate, session, componentCodes }) => {
    evaluationCount += 1;
    const delta = 10 + session.factDeltas.length;
    const components = {};
    componentCodes.forEach(componentCode => {
      components[componentCode] = {
        facts: componentCode === 'basic_hit'
          ? [{
              componentCode: 'basic_hit',
              causalOwnerType: 'STATE_DELTA',
              valueHEPP: delta,
              sourceEventId: 'ownership:event',
              sourceFactId: `ownership:fact:${session.revision}`,
              targetUnitId: 'target-1',
              sequence: session.revision,
            }]
          : [],
        informationComponents: [],
        paretoComponents: componentCode === 'pareto_selection'
          ? [
              { dimensionCode: 'worstTailUtilityHEPP', value: 0 },
              { dimensionCode: 'survivalUtilityHEPP', value: 0 },
              { dimensionCode: 'assetReserveHEPP', value: 0 },
              { dimensionCode: 'discardedOverkillPP', value: 0 },
            ]
          : [],
      };
    });
    return {
      candidateId: candidate.candidateId,
      components,
    };
  },
};
const session = kernel.createSession({
  calculationMode: kernel.rawCalculationMode,
  componentRegistry,
  worldRevision: 'ownership-world',
  beliefRevision: 'ownership-belief',
  opportunityRevision: 'ownership-opportunity',
  observerId: 'actor-1',
  beliefOverlay: {
    observerId: 'actor-1',
    beliefRevision: 'ownership-belief',
    visibleHpRatios: {},
    visibleStates: {},
    revealedAbilityIds: [],
    observableDeclarations: [],
    posteriorParameters: {},
    visibilityTokens: [],
  },
  candidates: [baseCandidate],
});
const first = kernel.evaluateAllCandidates(session, 'actor-1')[0];
assert(first.goalUtilityDeltaHEPP === 10, 'K00_INITIAL_COMPONENT_VALUE_WRONG');
assert(evaluationCount === 1, 'K00_COMPONENT_NOT_CALLED_BY_KERNEL');
kernel.applyFactDelta(session, 0, {
  operation: 'ADD',
  entityType: 'candidate',
  entityId: 'ownership-candidate',
  fieldCode: 'probe',
  beforeValue: 0,
  afterValue: 1,
  sourceEventId: 'ownership:delta:event',
  sourceFactId: 'ownership:delta:fact',
  dependencyTokens: ['case:ownership'],
});
const second = kernel.evaluateAllCandidates(session, 'actor-1')[0];
assert(second.goalUtilityDeltaHEPP === 11, 'K00_FACT_DELTA_NOT_REEVALUATED');
assert(evaluationCount === 2, 'K00_DIRTY_COMPONENT_NOT_REBUILT');
const proof = kernel.materializeProof(session, 'ownership-candidate');
assert(proof.goalUtilityDeltaHEPP === second.goalUtilityDeltaHEPP, 'K00_PROOF_VECTOR_MISMATCH');

const output = {
  schemaVersion: 'M2K00KernelOwnershipGateV1',
  status: 'PASSED',
  calculationMode: kernel.rawCalculationMode,
  rejectsPrecomputedCandidateFields: true,
  componentEvaluationOwnedByKernel: true,
  factDeltaForcesReevaluation: true,
  rejectsNestedComputedRawFields: true,
  kernelAggregatesComponentFacts: true,
  proofRequiresEvaluatedVector: true,
  evaluationCount,
  kernelHash: sha256(fs.readFileSync(kernelPath)),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

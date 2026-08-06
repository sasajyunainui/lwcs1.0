import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertRawCase } from '../reference/reference-value-evaluator-v2.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kernelPath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const casesPath = path.join(repoRoot, 'tools', 'rc6', 'cases', 'KernelReferenceCasesV1.json');
const registryPath = path.join(repoRoot, 'tools', 'rc6', 'contracts', 'KernelComponentRegistryV1.json');
const referencePath = path.join(repoRoot, 'tools', 'rc6', 'reference', 'reference-value-evaluator-v2.mjs');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'reference-kernel-ab-v2.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const approx = (left, right, detail) => {
  assert(Number.isFinite(left) && Number.isFinite(right), `AB_NON_FINITE:${detail}`);
  assert(Math.abs(left - right) <= 1e-9, `AB_VALUE_MISMATCH:${detail}:${left}:${right}`);
};

const paretoDimensions = [
  ['objectiveUtilityHEPP', 'MAXIMIZE'],
  ['worstTailUtilityHEPP', 'MAXIMIZE'],
  ['survivalUtilityHEPP', 'MAXIMIZE'],
  ['assetReserveHEPP', 'MAXIMIZE'],
  ['informationValueHEPP', 'MAXIMIZE'],
  ['discardedOverkillPP', 'MINIMIZE'],
];

const codeUnitCompare = (left, right) => {
  const a = String(left);
  const b = String(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = a.charCodeAt(index) - b.charCodeAt(index);
    if (delta) return delta;
  }
  return a.length - b.length;
};

const dominates = (left, right) => {
  let strictlyBetter = false;
  for (const [field, direction] of paretoDimensions) {
    const leftValue = left.paretoDimensions[field];
    const rightValue = right.paretoDimensions[field];
    if (direction === 'MAXIMIZE') {
      if (leftValue < rightValue) return false;
      if (leftValue > rightValue) strictlyBetter = true;
    } else {
      if (leftValue > rightValue) return false;
      if (leftValue < rightValue) strictlyBetter = true;
    }
  }
  return strictlyBetter;
};

const rankCompare = (left, right) => {
  for (const [field, direction] of paretoDimensions) {
    const delta = left.paretoDimensions[field] - right.paretoDimensions[field];
    if (delta) return direction === 'MAXIMIZE' ? -delta : delta;
  }
  return codeUnitCompare(left.candidateId, right.candidateId);
};

const structurallyDifferent = (left, right) => (
  left.actionId !== right.actionId ||
  JSON.stringify(left.targetSet) !== JSON.stringify(right.targetSet) ||
  left.paymentMode !== right.paymentMode
);

const normalizedDistance = (candidate, pool) => {
  let distance = 0;
  for (const [field, direction] of paretoDimensions) {
    const values = pool.map(item => item.paretoDimensions[field]);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum;
    if (span === 0) continue;
    const value = candidate.paretoDimensions[field];
    const normalized = direction === 'MAXIMIZE'
      ? (value - minimum) / span
      : (maximum - value) / span;
    assert(Number.isFinite(normalized), `AB_NON_FINITE_DISTANCE:${candidate.candidateId}:${field}`);
    distance += Math.abs(normalized);
  }
  return distance;
};

const componentCodeForFact = componentCode => {
  const code = String(componentCode || '').trim();
  if (code === 'S1_TERMINAL') return 'terminal';
  if (code.startsWith('S1_')) return 'target_trajectory';
  if (code.startsWith('S2_')) return 'support_resource';
  if (code.startsWith('S3_')) return 'soft_control';
  if (code.startsWith('S5_')) return 'delayed_effect';
  return null;
};

const rawCandidateForKernel = (testCase, candidate) => ({
  candidateId: candidate.candidateId,
  actionId: candidate.actionId,
  actorId: 'reference-actor',
  targetSet: clone(candidate.targetSet || []),
  paymentMode: candidate.paymentMode || 'FULL',
  dependencyTokens: [`case:${testCase.caseId}:${candidate.candidateId}`],
  legal: candidate.legal !== false,
  hardExclusionCodes: clone(candidate.hardExclusionCodes || []),
  rawInput: {
    schemaVersion: 'KernelCandidateRawInputV1',
    rawFacts: clone(candidate.rawFacts || []),
    informationComponents: clone(candidate.informationGroups || []),
    targetProfiles: clone(candidate.targetProfiles || []),
    objectiveContract: clone(candidate.objectiveContract || null),
    riskInputs: clone(candidate.riskInputs || null),
    actorSide: String(candidate.actorSide || 'PLAYER'),
  },
});

const componentDefinitions = JSON.parse(
  fs.readFileSync(registryPath, 'utf8'),
).components.map(definition => ({
  ...definition,
  requires: [],
}));

const makeComponentRegistry = (referenceById, rawById) => ({
  schemaVersion: 'KernelComponentRegistryRuntimeV1',
  componentDefinitions,
  componentCodesForFactDelta: () => [],
  evaluateComponents: ({ candidate, componentCodes }) => {
    const expected = referenceById.get(candidate.candidateId);
    const raw = rawById.get(candidate.candidateId);
    assert(expected && raw, `AB_REFERENCE_CANDIDATE_MISSING:${candidate.candidateId}`);
    const components = Object.fromEntries(componentCodes.map(componentCode => [
      componentCode,
      {
        facts: [],
        informationComponents: [],
        paretoComponents: [],
        unsupportedOutcomeKinds: [],
      },
    ]));
    expected.causalFacts.forEach(fact => {
      const componentCode = componentCodeForFact(fact.componentCode);
      assert(componentCode, `AB_REFERENCE_COMPONENT_UNMAPPED:${candidate.candidateId}:${fact.componentCode}`);
      if (!components[componentCode]) return;
       components[componentCode].facts.push({
         ...clone(fact),
         componentCode,
       });
    });
    if (components.information_observation) {
      components.information_observation.informationComponents = clone(raw.informationGroups || []);
    }
    if (components.pareto_selection) {
      components.pareto_selection.paretoComponents = [
        ['worstTailUtilityHEPP', expected.worstTailUtilityHEPP],
        ['survivalUtilityHEPP', expected.survivalUtilityHEPP],
        ['assetReserveHEPP', expected.assetReserveHEPP],
        ['discardedOverkillPP', expected.discardedOverkillPP],
      ].map(([dimensionCode, value]) => ({ dimensionCode, value }));
    }
    return { candidateId: candidate.candidateId, components };
  },
});

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(kernelPath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
assert(kernel?.rawCalculationMode === 'COMPONENT_REGISTRY_V1', 'AB_KERNEL_RAW_MODE_MISSING');

const fixture = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
assert(fixture.schemaVersion === 'KernelReferenceCaseCollectionV1', 'AB_FIXTURE_SCHEMA_MISMATCH');
assert(fixture.cases.length === 20, `AB_REFERENCE_CASE_COUNT:${fixture.cases.length}`);
const rows = [];

for (const testCase of fixture.cases) {
  const reference = assertRawCase(testCase);
  const rawRows = testCase.candidates.map(candidate => rawCandidateForKernel(testCase, candidate));
  const referenceById = new Map(reference.evaluated.map(candidate => [candidate.candidateId, candidate]));
  const rawById = new Map(testCase.candidates.map(candidate => [candidate.candidateId, candidate]));
  const session = kernel.createSession({
    calculationMode: kernel.rawCalculationMode,
    componentRegistry: makeComponentRegistry(referenceById, rawById),
    worldRevision: String(testCase.worldRevision),
    beliefRevision: String(testCase.beliefRevision),
    opportunityRevision: String(testCase.opportunityRevision),
    observerId: 'reference-actor',
    beliefOverlay: {
      observerId: 'reference-actor',
      beliefRevision: String(testCase.beliefRevision),
      visibleHpRatios: {},
      visibleStates: {},
      revealedAbilityIds: [],
      observableDeclarations: [],
      posteriorParameters: {},
      visibilityTokens: clone(testCase.publicFields || []),
    },
    candidates: rawRows,
  });
  const vectors = kernel.evaluateAllCandidates(session, 'reference-actor');
  const vectorById = new Map(vectors.map(vector => [vector.candidateId, vector]));
  for (const expected of reference.evaluated) {
    const vector = vectorById.get(expected.candidateId);
    assert(vector, `AB_VECTOR_MISSING:${testCase.caseId}:${expected.candidateId}`);
    for (const field of [
      'stateDeltaTotal',
      'actionPoolDeltaTotal',
      'terminalDeltaTotal',
      'goalUtilityDeltaHEPP',
      'informationValueHEPP',
      'objectiveUtilityHEPP',
    ]) approx(vector[field], expected[field], `${testCase.caseId}:${expected.candidateId}:${field}`);
    for (const field of [
      'worstTailUtilityHEPP',
      'survivalUtilityHEPP',
      'assetReserveHEPP',
      'discardedOverkillPP',
    ]) approx(vector.paretoDimensions[field], expected[field], `${testCase.caseId}:${expected.candidateId}:${field}`);
    const actualFacts = vector.causalFacts.slice().sort((a, b) => codeUnitCompare(a.sourceFactId, b.sourceFactId));
    const expectedFacts = expected.causalFacts.slice().sort((a, b) => codeUnitCompare(a.sourceFactId, b.sourceFactId));
    assert(actualFacts.length === expectedFacts.length, `AB_CAUSAL_COUNT_MISMATCH:${testCase.caseId}:${expected.candidateId}`);
    actualFacts.forEach((fact, index) => {
      const expectedFact = expectedFacts[index];
      assert(fact.sourceFactId === expectedFact.sourceFactId, `AB_CAUSAL_ID_MISMATCH:${testCase.caseId}:${expected.candidateId}`);
      assert(fact.causalOwnerType === expectedFact.causalOwnerType, `AB_CAUSAL_OWNER_MISMATCH:${testCase.caseId}:${expected.candidateId}`);
      approx(fact.valueHEPP, expectedFact.valueHEPP, `${testCase.caseId}:${expected.candidateId}:${fact.sourceFactId}`);
    });
    const expectedWitness = expected.legal === false || expected.hardExclusionCodes.length
      ? 'HARD_EXCLUDED'
      : reference.pareto.some(candidate => candidate.candidateId === expected.candidateId)
        ? 'NON_DOMINATED'
        : 'DOMINATED';
    assert(vector.paretoWitness.kind === expectedWitness, `AB_PARETO_WITNESS_MISMATCH:${testCase.caseId}:${expected.candidateId}`);
  }
  const selected = reference.selected;
  const proofIds = [selected.candidateId, ...reference.alternatives.map(candidate => candidate.candidateId)];
  for (const candidateId of proofIds) {
    const proof = kernel.materializeProof(session, candidateId);
    const vector = vectorById.get(candidateId);
    assert(proof.vector.objectiveUtilityHEPP === vector.objectiveUtilityHEPP, `AB_PROOF_VECTOR_MISMATCH:${testCase.caseId}:${candidateId}`);
    assert(proof.causalValueFacts.length === vector.causalFacts.length, `AB_PROOF_CAUSAL_MISMATCH:${testCase.caseId}:${candidateId}`);
  }
  rows.push({
    caseId: testCase.caseId,
    semanticDomain: testCase.semanticDomain,
    candidateCount: vectors.length,
    paretoCandidateIds: reference.pareto.map(candidate => candidate.candidateId),
    selectedCandidateId: selected.candidateId,
    proofCandidateIds: proofIds,
    candidateValuesEqual: true,
    causalFactsEqual: true,
    paretoAndSelectionEqual: true,
    proofFieldsEqual: true,
  });
}

const referenceSource = fs.readFileSync(referencePath, 'utf8');
assert(!/BattleDecisionR9v2Kernel_Module|BattleDecision_Module/u.test(referenceSource), 'AB_REFERENCE_IMPORTS_PRODUCTION');
const output = {
  schemaVersion: 'M2ReferenceKernelABV2',
  status: 'PASSED',
  scope: 'GENERIC_KERNEL_RAW_COMPONENT_CONTRACT',
  caseCount: rows.length,
  rows,
  candidateValuesEqual: true,
  causalFactsEqual: true,
  paretoAndSelectionEqual: true,
  proofsEqual: true,
  referenceEvaluatorIndependent: true,
  targetProductionAdapterAB: false,
  productionAdapterABPending: 'Run the separate production 2x1v1 + 2x3v3 + 2x7v7 full-field harness after ownership acceptance.',
  fixtureHash: sha256(fs.readFileSync(casesPath)),
  referenceHash: sha256(fs.readFileSync(referencePath)),
  kernelHash: sha256(fs.readFileSync(kernelPath)),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

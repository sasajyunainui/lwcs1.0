import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertReferenceCase } from '../reference/reference-value-evaluator.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kernelPath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const casesPath = path.join(repoRoot, 'tools', 'rc6', 'cases', 'KernelReferenceCasesV1.json');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'reference-kernel-ab.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const close = (left, right, tolerance = 1e-9) => Math.abs(Number(left) - Number(right)) <= tolerance;

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(kernelPath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
const casesDoc = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const rows = [];
for (const input of casesDoc.cases) {
  const reference = assertReferenceCase(input);
  const adaptedCandidates = input.candidates.map(candidate => ({
    ...candidate,
    actorId: 'reference-actor',
    dependencyTokens: [`case:${input.caseId}:${candidate.candidateId}`],
  }));
  const session = kernel.createSession({
    worldRevision: String(input.worldRevision),
    beliefRevision: String(input.beliefRevision),
    opportunityRevision: String(input.opportunityRevision),
    observerId: 'reference-actor',
    beliefOverlay: {
      observerId: 'reference-actor',
      beliefRevision: String(input.beliefRevision),
      visibleHpRatios: {},
      visibleStates: {},
      revealedAbilityIds: [],
      observableDeclarations: [],
      posteriorParameters: {},
      visibilityTokens: input.publicFields,
    },
    candidates: adaptedCandidates,
  });
  const vectors = kernel.evaluateAllCandidates(session, 'reference-actor');
  const vectorById = new Map(vectors.map(vector => [vector.candidateId, vector]));
  for (const referenceCandidate of reference.evaluated) {
    const vector = vectorById.get(referenceCandidate.candidateId);
    assert(vector, `M2_AB_VECTOR_MISSING:${input.caseId}:${referenceCandidate.candidateId}`);
    for (const field of ['stateDeltaTotal', 'actionPoolDeltaTotal', 'terminalDeltaTotal', 'goalUtilityDeltaHEPP', 'informationValueHEPP', 'objectiveUtilityHEPP']) {
      assert(close(vector[field], referenceCandidate[field]), `M2_AB_VALUE_MISMATCH:${input.caseId}:${referenceCandidate.candidateId}:${field}`);
    }
    assert(vector.causalFacts.length === referenceCandidate.causalFacts.length, `M2_AB_CAUSAL_COUNT_MISMATCH:${input.caseId}:${referenceCandidate.candidateId}`);
    assert(vector.paretoWitness?.kind, `M2_AB_PARETO_WITNESS_MISSING:${input.caseId}:${referenceCandidate.candidateId}`);
    const referenceEligible = reference.eligible.some(candidate => candidate.candidateId === referenceCandidate.candidateId);
    const referencePareto = reference.pareto.some(candidate => candidate.candidateId === referenceCandidate.candidateId);
    const expectedWitnessKind = !referenceEligible ? 'HARD_EXCLUDED' : referencePareto ? 'NON_DOMINATED' : 'DOMINATED';
    assert(vector.paretoWitness.kind === expectedWitnessKind, `M2_AB_PARETO_MISMATCH:${input.caseId}:${referenceCandidate.candidateId}`);
  }
  const proofIds = [reference.selected.candidateId, ...reference.alternatives.map(candidate => candidate.candidateId)];
  for (const proofId of proofIds) {
    const proof = kernel.materializeProof(session, proofId);
    const vector = vectorById.get(proofId);
    assert(proof.vector.objectiveUtilityHEPP === vector.objectiveUtilityHEPP, `M2_AB_PROOF_VECTOR_MISMATCH:${input.caseId}:${proofId}`);
    assert(proof.causalValueFacts.length === vector.causalFacts.length, `M2_AB_PROOF_CAUSAL_MISMATCH:${input.caseId}:${proofId}`);
  }
  rows.push({
    caseId: input.caseId,
    semanticDomain: input.semanticDomain,
    mode: input.mode,
    phase: input.phase,
    candidateCount: vectors.length,
    paretoCount: vectors.filter(vector => vector.paretoWitness.kind === 'NON_DOMINATED').length,
    selectedCandidateId: reference.selected.candidateId,
    proofCandidateIds: proofIds,
  });
}

const output = {
  schemaVersion: 'M2ReferenceKernelABV1',
  status: 'PASSED',
  referenceEvaluator: 'tools/rc6/reference/reference-value-evaluator.mjs',
  referenceEvaluatorHash: sha256(fs.readFileSync(path.join(repoRoot, 'tools', 'rc6', 'reference', 'reference-value-evaluator.mjs'))),
  kernelHash: sha256(fs.readFileSync(kernelPath)),
  caseCount: rows.length,
  rows,
  candidateIdsAndValuesEqual: true,
  paretoWitnessesEqual: true,
  proofsEqual: true,
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({ schemaVersion: output.schemaVersion, status: output.status, caseCount: output.caseCount }, null, 2));

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';
import { evaluateCandidate } from '../reference/reference-value-evaluator.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const harnessPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k12-target-adapter.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const sandbox = loadBattleSandbox({ includeTargetKernel: true });
const targetKernelSink = { slices: [] };
sandbox.__LWCS_R9V2_TARGET_KERNEL_TEST_SINK__ = targetKernelSink;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const decisionSource = fs.readFileSync(
  path.join(repoRoot, 'BattleDecision_Module.js'),
  'utf8',
);
const targetAdapterSource = decisionSource.match(
  /function r9v2TargetKernelPrepareSlice\([\s\S]*?(?=\n  function prepareR9v2ControlResourceSlice)/u,
)?.[0] || '';
assert(targetAdapterSource && !/r9v2CandidateValueProof/u.test(targetAdapterSource), 'K12_TARGET_ADAPTER_READS_OLD_PROOF');
const cases = manualCasesById(sandbox);
const caseIds = [
  'duel_overmatch_lethal',
  'duel_peer_unknown_probe',
  'team_focus_without_overkill',
  'team_control_overlap',
];
const rows = [];

for (const caseId of caseIds) {
  const definition = cases.get(caseId);
  assert(definition, `K12_CASE_MISSING:${caseId}`);
  const world = clone(definition.combatData);
  const actorId = String(world?.参战者?.team_player?.[0]?.id || '').trim();
  assert(actorId, `K12_ACTOR_MISSING:${caseId}`);
  const request = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId,
    objectiveContract: world.胜负条件,
    battleIntent: {
      mode: definition.intent,
      objectives: clone(world.胜负条件),
    },
    actionOpportunity: {
      opportunityId: `${caseId}:k12`,
      role: 'ACTIVE',
    },
    providerId: 'r9v2',
    analysisDepth: 'CANDIDATES_ONLY',
    r9v2InformationValueOnly: true,
    collectDecisionReplayIdentity: true,
    seed: definition.seed,
  });
  const result = decision.runR9v2TargetProviderForTest(request);
  const slice = targetKernelSink.slices.at(-1);
  assert(slice, `K12_KERNEL_SLICE_MISSING:${caseId}`);
  const vectorById = new Map(
    slice.vectors.map(vector => [vector.candidateId, vector]),
  );
  for (const row of slice.rows) {
    const reference = evaluateCandidate(row);
    const vector = vectorById.get(row.candidateId);
    assert(vector, `K12_VECTOR_MISSING:${caseId}:${row.candidateId}`);
    for (const field of [
      'stateDeltaTotal',
      'actionPoolDeltaTotal',
      'terminalDeltaTotal',
      'goalUtilityDeltaHEPP',
      'informationValueHEPP',
      'objectiveUtilityHEPP',
    ]) {
      assert(
        Math.abs(Number(vector[field]) - Number(reference[field])) <= 1e-9,
        `K12_FIELD_AB_MISMATCH:${caseId}:${row.candidateId}:${field}`,
      );
    }
    assert(
      vector.causalFacts.length === reference.causalFacts.length,
      `K12_CAUSAL_AB_MISMATCH:${caseId}:${row.candidateId}`,
    );
    const factIds = row.causalFacts.map(fact => String(fact.sourceFactId || ''));
    assert(
      factIds.length === new Set(factIds).size && factIds.every(Boolean),
      `K12_CAUSAL_FACT_ID_INVALID:${caseId}:${row.candidateId}`,
    );
  }
  const audit = result || {};
  const candidates = Array.isArray(audit?.candidateAudit)
    ? audit.candidateAudit
    : [];
  assert(audit.schemaVersion === 'DecisionAuditV2', `K12_AUDIT_SCHEMA:${caseId}`);
  assert(audit.vectorCoverage?.status === 'CLOSED', `K12_VECTOR_COVERAGE:${caseId}`);
  assert(audit.proofCoverage?.status === 'REQUIRED_SUBSET_CLOSED', `K12_PROOF_COVERAGE:${caseId}`);
  assert(
    audit.frozenCandidateIds.length === audit.preparedEntryCandidateIds.length,
    `K12_ENTRY_COVERAGE:${caseId}`,
  );
  assert(
    audit.requiredProofCandidateIds.length === audit.materializedProofCandidateIds.length,
    `K12_REQUIRED_PROOF_COVERAGE:${caseId}`,
  );
  const required = new Set(audit.requiredProofCandidateIds);
  assert(
    candidates.filter(candidate => candidate.candidateValueProof).every(candidate =>
      required.has(candidate.candidateId)
    ),
    `K12_NON_REQUIRED_PROOF_MATERIALIZED:${caseId}`,
  );
  rows.push({
    caseId,
    candidateCount: candidates.length,
    selectedCandidateId: result.selected?.candidateId || '',
    requiredProofCandidateIds: audit.requiredProofCandidateIds,
    nonRequiredVectorCount: candidates.filter(candidate =>
      !required.has(candidate.candidateId)
    ).length,
    unsupportedCandidateCount: candidates.filter(candidate =>
      String(candidate.rejectionCode || '').startsWith('R9V2_KERNEL_UNSUPPORTED_FACT')
    ).length,
    slice: result.decisionProfile?.slice || '',
  });
}

const output = {
  schemaVersion: 'M2K12TargetKernelAdapterGateV1',
  status: 'PASSED',
  kernelVersion: sandbox.__LWCS_BATTLE_R9V2_KERNEL__?.version || '',
  decisionVersion: decision.version,
  caseCount: rows.length,
  rows,
  targetKernelUsed: rows.every(row => row.slice === 'TARGET_KERNEL_V2'),
  fieldLevelReferenceAB: true,
  targetAdapterSourceGuard: true,
  oldShadowProofPathNotUsedByTargetSlice: true,
  harnessHash: sha256(fs.readFileSync(harnessPath)),
  decisionHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
  kernelHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

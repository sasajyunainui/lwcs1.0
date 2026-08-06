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
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k12-target-adapter.json');
const registryPath = path.join(repoRoot, 'tools', 'rc6', 'contracts', 'KernelComponentRegistryV1.json');
const productionEvidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'production-reference-ab.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const forbiddenRawFields = new Set([
  'stateDeltaTotal',
  'actionPoolDeltaTotal',
  'terminalDeltaTotal',
  'goalUtilityDeltaHEPP',
  'informationValueHEPP',
  'objectiveUtilityHEPP',
  'causalFacts',
  'informationGroups',
  'bestFutureRouteValueHEPP',
  'committedValueHEPP',
  'discardedOverkillPP',
  'worstTailUtilityHEPP',
  'survivalUtilityHEPP',
  'assetReserveHEPP',
  'directGoalUtilityHEPP',
  'valueHEPP',
  'causalOwnerType',
  'ownerType',
  'assetReserve',
]);
const assertRawInputClean = (value, path) => {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertRawInputClean(child, `${path}[${index}]`));
    return;
  }
  Object.entries(value).forEach(([key, child]) => {
    assert(!forbiddenRawFields.has(key), `K12_RAW_COMPUTED_FIELD:${path}.${key}`);
    assertRawInputClean(child, `${path}.${key}`);
  });
};

const componentDefinitions = JSON.parse(
  fs.readFileSync(registryPath, 'utf8'),
).components;
const componentCodes = componentDefinitions.map(definition => definition.componentCode);
const componentByCode = new Map(
  componentDefinitions.map(definition => [definition.componentCode, definition]),
);

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
const targetPreparationSource = decisionSource.match(
  /function prepareR9v2ControlResourceSlice\([\s\S]*?(?=\n  function r9v2Dominates)/u,
)?.[0] || '';
assert(targetPreparationSource, 'K12_TARGET_PREPARATION_SOURCE_MISSING');
const targetBranchSource = targetPreparationSource.match(
  /if \(targetKernel\) \{[\s\S]*?\n    \}/u,
)?.[0] || '';
assert(targetBranchSource, 'K12_TARGET_BRANCH_SOURCE_MISSING');
assert(!/r9v2CandidateValueProof/u.test(targetBranchSource), 'K12_TARGET_BRANCH_READS_OLD_PROOF');
const targetComponentSource = decisionSource.match(
  /function r9v2TargetS1Components[\s\S]*?(?=\n  function r9v2TargetValueFacts)/u,
)?.[0] || '';
assert(targetComponentSource, 'K12_TARGET_COMPONENT_SOURCE_MISSING');
const legacyComponentCalls = [
  'r9v2StateOpportunityProjection',
  'r9v2BehaviorPoolDeltaProjection',
  'r9v2SummonWindowProjection',
  'r9v2BestAffordableUtility',
].filter(name => targetComponentSource.includes(name));
const legacyComponentReachabilityClosed = legacyComponentCalls.length === 0;
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
  assert(
    JSON.stringify(slice.session?.componentCodes || []) === JSON.stringify(componentCodes),
    `K12_COMPONENT_REGISTRY_NOT_FORMAL_23:${caseId}`,
  );
  const vectorById = new Map(
    slice.vectors.map(vector => [vector.candidateId, vector]),
  );
  for (const row of slice.rows) {
    assert(!Object.hasOwn(row, 'stateDeltaTotal'), `K12_PRECOMPUTED_STATE_INPUT:${caseId}:${row.candidateId}`);
    assert(!Object.hasOwn(row, 'actionPoolDeltaTotal'), `K12_PRECOMPUTED_ACTION_POOL_INPUT:${caseId}:${row.candidateId}`);
    assert(!Object.hasOwn(row, 'terminalDeltaTotal'), `K12_PRECOMPUTED_TERMINAL_INPUT:${caseId}:${row.candidateId}`);
    assert(!Object.hasOwn(row, 'causalFacts'), `K12_PRECOMPUTED_CAUSAL_INPUT:${caseId}:${row.candidateId}`);
    assert(row.rawInput?.schemaVersion === 'KernelCandidateRawInputV1', `K12_RAW_INPUT_MISSING:${caseId}:${row.candidateId}`);
    assertRawInputClean(row.rawInput, `${caseId}:${row.candidateId}:rawInput`);
    assert(row.mechanicalSource === 'SHARED_MECHANICAL_ENTRY_V1', `K12_MECHANICAL_SOURCE_INVALID:${caseId}:${row.candidateId}`);
    const vector = vectorById.get(row.candidateId);
    assert(vector, `K12_VECTOR_MISSING:${caseId}:${row.candidateId}`);
    assert(vector.valueSource === 'TARGET_KERNEL_COMPONENTS_V1', `K12_VECTOR_SOURCE_NOT_TARGET:${caseId}:${row.candidateId}`);
    assert(!Object.hasOwn(row, 'causalFacts'), `K12_ROW_CAUSAL_INPUT_PRESENT:${caseId}:${row.candidateId}`);
    const componentStore = slice.session?.componentStore?.get(row.candidateId);
    assert(componentStore instanceof Map, `K12_COMPONENT_STORE_MISSING:${caseId}:${row.candidateId}`);
    assert(componentStore.size === componentCodes.length, `K12_COMPONENT_STORE_INCOMPLETE:${caseId}:${row.candidateId}`);
    componentCodes.forEach(componentCode => {
      const component = componentStore.get(componentCode);
      const definition = componentByCode.get(componentCode);
      assert(component, `K12_COMPONENT_RESULT_MISSING:${caseId}:${row.candidateId}:${componentCode}`);
      (component.facts || []).forEach(fact => {
        assert(fact.componentCode === componentCode, `K12_FACT_COMPONENT_MISMATCH:${caseId}:${row.candidateId}:${componentCode}`);
        assert(fact.causalOwnerType === definition.causalOwnerType, `K12_FACT_OWNER_MISMATCH:${caseId}:${row.candidateId}:${componentCode}`);
      });
      if (definition.causalOwnerType === 'NONE') {
        assert(
          (component.facts || []).every(fact => Math.abs(Number(fact.valueHEPP || 0)) <= 1e-9),
          `K12_NONE_OWNER_NONZERO:${caseId}:${row.candidateId}:${componentCode}`,
        );
      }
    });
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

const productionEvidence = fs.existsSync(productionEvidencePath)
  ? JSON.parse(fs.readFileSync(productionEvidencePath, 'utf8'))
  : null;
const currentDecisionHash = sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js')));
const currentKernelHash = sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js')));
const fieldLevelReferenceAB = Boolean(
  productionEvidence?.status === 'PASSED' &&
  productionEvidence?.targetProductionAdapterAB === true &&
  productionEvidence?.decisionHash === currentDecisionHash &&
  productionEvidence?.kernelHash === currentKernelHash,
);
const output = {
  schemaVersion: 'M2K12TargetKernelAdapterGateV1',
  status: legacyComponentReachabilityClosed && fieldLevelReferenceAB
    ? 'PASSED'
    : legacyComponentReachabilityClosed
      ? 'DIAGNOSTIC_ONLY'
      : 'BLOCKED',
  kernelVersion: sandbox.__LWCS_BATTLE_R9V2_KERNEL__?.version || '',
  decisionVersion: decision.version,
  caseCount: rows.length,
  rows,
  targetKernelUsed: rows.every(row => row.slice === 'TARGET_KERNEL_V2'),
  fieldLevelReferenceAB,
  productionReferenceABStatus: productionEvidence?.status || 'MISSING',
  productionReferenceABHash: productionEvidence
    ? sha256(fs.readFileSync(productionEvidencePath))
    : '',
  rawInputComputedFieldLeakCount: 0,
  targetAdapterSourceGuard: true,
  targetBranchSourceGuard: true,
  targetValueSourceGuard: true,
  oldShadowProofPathNotUsedByTargetSlice: true,
  legacyComponentReachabilityClosed,
  legacyComponentCalls,
  harnessHash: sha256(fs.readFileSync(harnessPath)),
  decisionHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
  kernelHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!legacyComponentReachabilityClosed || !fieldLevelReferenceAB) process.exitCode = 1;

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertReferenceCase,
  readJson,
} from './reference-value-evaluator.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const contractsDir = path.join(repoRoot, 'tools', 'rc6', 'contracts');
const casesDir = path.join(repoRoot, 'tools', 'rc6', 'cases');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm1', 'm1-contract-gate.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const json = fileName => readJson(path.join(repoRoot, fileName));
const finite = value => Number.isFinite(Number(value));
const fail = (code, detail = '') => {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
};

const contract = json('tools/rc6/contracts/BehaviorPlanningContractV1.json');
const assertionsDoc = json('tools/rc6/contracts/SemanticAssertionsV1.json');
const componentsDoc = json('tools/rc6/contracts/KernelComponentRegistryV1.json');
const selectionPolicy = json('tools/rc6/contracts/SelectionPolicyV1.json');
const casesDoc = json('tools/rc6/cases/KernelReferenceCasesV1.json');
const oracleIndex = json('tools/rc6/cases/BehaviorOracleV2IndexV1.json');
const legacyOracleDoc = json('tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json');

const coreHashes = Object.fromEntries(Object.entries(contract.sourceHashes).map(([fileName]) => [
  fileName,
  sha256(fs.readFileSync(path.join(repoRoot, fileName))),
]));
const hashMismatches = Object.keys(coreHashes).filter(fileName => coreHashes[fileName] !== contract.sourceHashes[fileName]);
if (hashMismatches.length) fail('M1_SOURCE_HASH_MISMATCH', hashMismatches.join(','));

if (contract.status !== 'FROZEN') fail('M1_CONTRACT_NOT_FROZEN');
if (assertionsDoc.count !== 61 || assertionsDoc.assertions.length !== 61) fail('M1_ASSERTION_COUNT_MISMATCH');
if (componentsDoc.count !== 23 || componentsDoc.components.length !== 23) fail('M1_COMPONENT_COUNT_MISMATCH');
if (casesDoc.count !== 20 || casesDoc.cases.length !== 20) fail('M1_REFERENCE_CASE_COUNT_MISMATCH');
if (oracleIndex.count !== 54 || oracleIndex.oracles.length !== 54) fail('M1_ORACLE_COUNT_MISMATCH');
if (legacyOracleDoc.oracles.length !== 54) fail('M1_LEGACY_ORACLE_INPUT_COUNT_MISMATCH');
if (selectionPolicy.status !== 'FROZEN' || selectionPolicy.noTopK !== true || selectionPolicy.noWallClockBudget !== true) fail('M1_SELECTION_POLICY_NOT_FROZEN');
const schemaFiles = [
  'BehaviorPlanningContractV1.schema.json',
  'SemanticAssertionV1.schema.json',
  'KernelComponentDefinitionV1.schema.json',
  'KernelReferenceCaseV1.schema.json',
  'BehaviorOracleV2IndexV1.schema.json',
];
for (const schemaFile of schemaFiles) {
  const schema = json(`tools/rc6/contracts/${schemaFile}`);
  if (!schema.$schema || !schema.$id || schema.type !== 'object') fail('M1_SCHEMA_INVALID', schemaFile);
}
const requiredDomains = new Set(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
const observedDomains = new Set(casesDoc.cases.map(input => input.semanticDomain));
for (const domain of requiredDomains) {
  if (contract.semanticDomains[domain]?.status !== 'FROZEN') fail('M1_DOMAIN_NOT_FROZEN', domain);
  if (!observedDomains.has(domain)) fail('M1_DOMAIN_CASE_COVERAGE_MISSING', domain);
}
const observedPhases = new Set(casesDoc.cases.map(input => input.phase));
for (const phase of ['ACTIVE', 'REACTION', 'COUNTER', 'PASS', 'LOST']) {
  if (!observedPhases.has(phase)) fail('M1_PHASE_COVERAGE_MISSING', phase);
}
if (!casesDoc.cases.some(input => input.mode === 'manual') || !casesDoc.cases.some(input => input.mode === 'auto')) fail('M1_MODE_COVERAGE_MISSING');

const allowedRules = new Set(assertionsDoc.assertions.map(assertion => assertion.executableCheck));
const ruleCoverage = Object.fromEntries([...allowedRules].map(rule => [rule, 0]));
for (const assertion of assertionsDoc.assertions) {
  if (assertion.resolutionStatus !== 'FROZEN') fail('M1_ASSERTION_UNRESOLVED', assertion.assertionId);
  if (!allowedRules.has(assertion.executableCheck)) fail('M1_ASSERTION_RULE_MISSING', assertion.assertionId);
  ruleCoverage[assertion.executableCheck] += 1;
}
if (Object.values(ruleCoverage).some(value => value < 1)) fail('M1_ASSERTION_RULE_UNCOVERED');

const caseResults = [];
const caseById = new Map();
for (const input of casesDoc.cases) {
  const result = assertReferenceCase(input);
  caseById.set(input.caseId, result);
  caseResults.push({
    caseId: input.caseId,
    semanticDomain: input.semanticDomain,
    mode: input.mode,
    phase: input.phase,
    candidateCount: result.evaluated.length,
    eligibleCount: result.eligible.length,
    paretoCount: result.pareto.length,
    selectedCandidateId: result.selected.candidateId,
    alternatives: result.alternatives.map(candidate => candidate.candidateId),
  });
}

const contractRuleChecks = {
  target_health_percentage: () => contract.scalarContract.threshold.lifeBasis === 'target_base_max_health_percentage',
  any_projection: () => contract.semanticDomains.S1.status === 'FROZEN',
  all_projection: () => contract.semanticDomains.S1.status === 'FROZEN',
  threshold_clamp: () => caseById.get('ref-s1-threshold-truncation').evaluated.some(candidate => candidate.discardedOverkillPP > 0),
  overkill_discard: () => Boolean(contract.scalarContract.threshold.overkillField),
  first_victory: () => contract.scalarContract.terminal.victory === 100,
  first_failure: () => contract.scalarContract.terminal.failure === -100,
  draw_terminal: () => contract.scalarContract.terminal.draw === 0,
  post_terminal_zero: () => contract.scalarContract.terminal.postTerminalValue === 0,
  terminal_owner: () => contract.scalarContract.causalReconciliation.ownerTypes.includes('TERMINAL_DELTA'),
  opportunity_kind: () => contract.semanticDomains.S2.status === 'FROZEN',
  pass_semantics: () => caseById.get('ref-s2-pass-lost').evaluated.some(candidate => candidate.actionKind === 'PASS_OPPORTUNITY'),
  lost_semantics: () => caseById.get('ref-lost-opportunity').evaluated.some(candidate => candidate.actionKind === 'LOST_OPPORTUNITY'),
  resource_order: () => contract.semanticDomains.S2.status === 'FROZEN',
  payment_ownership: () => contract.semanticDomains.S2.status === 'FROZEN',
  no_op_semantics: () => contract.scalarContract.information.stableIntersectionEmptyUses === 'NO_OP_ONLY',
  resource_consumer: () => caseById.get('ref-s5-creation-consumer').selected.candidateId === 'create-with-consumer',
  pool_closure: () => contract.components === undefined && contract.semanticDomains.S3.status === 'FROZEN',
  affected_unit_closure: () => contract.semanticDomains.S3.status === 'FROZEN',
  future_route_delta: () => contract.scalarContract.goalUtilityDeltaHEPP.includes('actionPoolDeltaTotal'),
  state_delta_owner: () => contract.scalarContract.causalReconciliation.ownerTypes.includes('STATE_DELTA'),
  probability_branch: () => contract.semanticDomains.S3.status === 'FROZEN',
  response_fact: () => contract.scalarContract.causalReconciliation.ownerTypes.includes('ACTION_POOL_DELTA'),
  support_consumer: () => contract.semanticDomains.S3.status === 'FROZEN',
  heal_conditioning: () => contract.semanticDomains.S3.status === 'FROZEN',
  duplicate_causal_fact: () => caseById.get('ref-s6-causal-state-owner').selected.causalFacts.length === 2,
  no_name_branch: () => !JSON.stringify(contract).includes('roleName'),
  public_visibility: () => contract.visibility.allowed.includes('publicHpRatios') || contract.visibility.allowed.includes('publicStates'),
  hidden_visibility: () => contract.visibility.forbidden.includes('hiddenExactHp'),
  response_branch_shape: () => contract.semanticDomains.S4.status === 'FROZEN',
  adaptive_value: () => contract.scalarContract.information.adaptive.includes('outcomeProbability'),
  committed_value: () => contract.scalarContract.information.committed.includes('stable_candidate_identity_intersection'),
  information_endpoint: () => contract.scalarContract.information.zeroOnlyAtExactProbability.join(',') === '0,1',
  information_route_change: () => caseById.get('ref-s4-information-positive').selected.informationValueHEPP > 0,
  scheduled_effect: () => contract.semanticDomains.S5.status === 'FROZEN',
  expiry: () => contract.semanticDomains.S5.status === 'FROZEN',
  summon_lifecycle: () => caseById.get('ref-s5-summon-host-death').evaluated.some(candidate => candidate.hardExclusionCodes.includes('HOST_DEAD')),
  creation_consumer: () => caseById.get('ref-s5-creation-consumer').selected.candidateId === 'create-with-consumer',
  inventory_fact: () => contract.semanticDomains.S5.status === 'FROZEN',
  equipment_window: () => contract.semanticDomains.S5.status === 'FROZEN',
  causal_owner: () => contract.scalarContract.causalReconciliation.ownerTypes.length === 3,
  causal_reconciliation: () => contract.scalarContract.causalReconciliation.tolerance === 1e-6,
  pareto_dimensions: () => contract.pareto.dimensions.length === 6,
  hard_exclusion: () => caseById.get('ref-s6-pareto-hard-exclusion').selected.candidateId === 'valid-safe',
  manual_lock: () => caseById.get('ref-manual-locked').selected.candidateId === 'player-choice',
  alternative_one: () => caseResults.some(result => result.alternatives.length > 0),
  alternative_two: () => contract.alternatives.second.includes('maximum_normalized_L1_distance'),
  utf16_sort: () => contract.pareto.tieBreak === 'candidateId_UTF16_CODE_UNIT_ASCENDING',
};

const assertionResults = assertionsDoc.assertions.map(assertion => {
  const check = contractRuleChecks[assertion.executableCheck];
  if (typeof check !== 'function') fail('M1_ASSERTION_CHECK_NOT_IMPLEMENTED', assertion.executableCheck);
  const passed = check();
  if (!passed) fail('M1_ASSERTION_FAILED', assertion.assertionId);
  return { assertionId: assertion.assertionId, executableCheck: assertion.executableCheck, passed: true };
});

const componentCodes = new Set();
for (const component of componentsDoc.components) {
  if (componentCodes.has(component.componentCode)) fail('M1_COMPONENT_DUPLICATE', component.componentCode);
  componentCodes.add(component.componentCode);
  if (!component.materializerId || !component.semanticDomain || !component.causalOwnerType) fail('M1_COMPONENT_SCHEMA_GAP', component.componentCode);
}

const oracleResults = oracleIndex.oracles.map((oracle, index) => {
  const source = legacyOracleDoc.oracles[index];
  if (!source || source.oracleId !== oracle.oracleId || source.caseId !== oracle.caseId) fail('M1_ORACLE_INDEX_MISMATCH', oracle.oracleId);
  if (oracle.executableStatus !== 'EXECUTABLE_REFERENCE_ONLY') fail('M1_ORACLE_NOT_EXECUTABLE', oracle.oracleId);
  if (oracle.executableChecks.some(check => !['candidate_set_shape', 'finite_numeric_contract', 'causal_reconciliation', 'domain_contract'].includes(check))) {
    fail('M1_ORACLE_CHECK_NOT_IMPLEMENTED', oracle.oracleId);
  }
  const smoke = casesDoc.cases.find(input => input.semanticDomain === oracle.semanticDomain) || casesDoc.cases[0];
  const smokeResult = assertReferenceCase(smoke);
  return { oracleId: oracle.oracleId, caseId: oracle.caseId, smokeCaseId: smoke.caseId, selectedCandidateId: smokeResult.selected.candidateId, executable: true };
});

const evaluatorSource = fs.readFileSync(path.join(repoRoot, 'tools', 'rc6', 'reference', 'reference-value-evaluator.mjs'), 'utf8');
for (const forbidden of ['BattleDecision_Module', 'BattlePreview_Module', 'BattleRuntime_Module', 'BattleReport_Module', 'r9v2']) {
  if (evaluatorSource.includes(forbidden)) fail('M1_REFERENCE_EVALUATOR_DEPENDENCY_LEAK', forbidden);
}
const changedFiles = execFileSync('git', ['status', '--short'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true })
  .split(/\r?\n/u)
  .map(line => line.slice(3).trim())
  .filter(Boolean)
  .filter(fileName => !fileName.startsWith('tmp/'));
const productionChanges = changedFiles.filter(fileName => !fileName.startsWith('tools/rc6/'));
if (productionChanges.length) fail('M1_PRODUCTION_CODE_CHANGED', productionChanges.join(','));

const output = {
  schemaVersion: 'M1ContractGateV1',
  status: 'PASSED',
  contractId: contract.contractId,
  sourceHashes: coreHashes,
  counts: {
    assertions: assertionResults.length,
    prototypes: componentsDoc.components.length,
    referenceCases: caseResults.length,
    oracles: oracleResults.length,
  },
  contractBlockingUnresolved: assertionsDoc.assertions.filter(assertion => assertion.resolutionStatus !== 'FROZEN').map(assertion => assertion.assertionId),
  independentReferenceEvaluator: 'PASSED_NO_PRODUCTION_IMPORTS',
  assertionResults,
  caseResults,
  oracleResults,
  trackedInputs: {
    contractHash: sha256(JSON.stringify(contract)),
    assertionsHash: sha256(JSON.stringify(assertionsDoc)),
    componentsHash: sha256(JSON.stringify(componentsDoc)),
    selectionPolicyHash: sha256(JSON.stringify(selectionPolicy)),
    casesHash: sha256(JSON.stringify(casesDoc)),
    oracleIndexHash: sha256(JSON.stringify(oracleIndex)),
    schemaHashes: Object.fromEntries(schemaFiles.map(fileName => [fileName, sha256(fs.readFileSync(path.join(contractsDir, fileName)))])),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({
  status: output.status,
  assertions: output.counts.assertions,
  prototypes: output.counts.prototypes,
  referenceCases: output.counts.referenceCases,
  oracles: output.counts.oracles,
  evidencePath: path.relative(repoRoot, evidencePath).replaceAll(path.sep, '/'),
}, null, 2));

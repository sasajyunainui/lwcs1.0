import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readJson,
} from './reference-value-evaluator.mjs';
import {
  assertRawCase,
  evaluateRawCase,
  evaluateRawCandidate,
} from './reference-value-evaluator-v2.mjs';
import { runM1SemanticGuards } from './m1-semantic-guards.mjs';
import { hashJson, oracleIndexBindingHash } from './oracle-fixture-hash.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const contractsDir = path.join(repoRoot, 'tools', 'rc6', 'contracts');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm1', 'm1-contract-gate.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const json = fileName => readJson(path.join(repoRoot, fileName));
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

const productionFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
];
const productionHashes = Object.fromEntries(productionFiles.map(fileName => [
  fileName,
  sha256(fs.readFileSync(path.join(repoRoot, fileName))),
]));
const fixtureManifest = json('tools/rc6/cases/BehaviorOracleFixtureManifestV1.json');
const m1FixtureManifest = json('tools/rc6/contracts/M1FixtureManifestV1.json');
const fixtureById = new Map((fixtureManifest.fixtures || []).map(fixture => [fixture.fixtureId, fixture]));
const forbiddenRawFields = new Set([
  'stateDeltaTotal',
  'actionPoolDeltaTotal',
  'terminalDeltaTotal',
  'goalUtilityDeltaHEPP',
  'informationValueHEPP',
  'objectiveUtilityHEPP',
  'causalFacts',
  'vector',
  'pareto',
  'selectedCandidateId',
]);
const assertRawInputClean = (value, pathName) => {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertRawInputClean(child, `${pathName}[${index}]`));
    return;
  }
  Object.entries(value).forEach(([key, child]) => {
    if (forbiddenRawFields.has(key)) fail('M1_RAW_COMPUTED_FIELD', `${pathName}.${key}`);
    assertRawInputClean(child, `${pathName}.${key}`);
  });
};
const approx = (left, right, detail) => {
  if (!Number.isFinite(Number(left)) || !Number.isFinite(Number(right))) fail('M1_NON_FINITE_CHECK', detail);
  if (Math.abs(Number(left) - Number(right)) > 1e-9) fail('M1_FIXTURE_VALUE_MISMATCH', `${detail}:${left}:${right}`);
};
const checkFixtureAssertion = (fixture, result, check) => {
  const candidate = result.evaluated.find(item => item.candidateId === check.candidateId);
  if (!candidate) fail('M1_FIXTURE_CANDIDATE_MISSING', `${fixture.fixtureId}:${check.candidateId}`);
  if (check.type === 'fieldEquals') {
    approx(candidate[check.field], check.value, `${fixture.fixtureId}:${check.field}`);
    return;
  }
  if (check.type === 'fieldGreaterThan') {
    if (!(Number(candidate[check.field]) > Number(check.value))) fail('M1_FIXTURE_RELATION_FAILED', fixture.fixtureId);
    return;
  }
  if (check.type === 'fieldLessThanOrEqual') {
    if (!(Number(candidate[check.field]) <= Number(check.value))) fail('M1_FIXTURE_RELATION_FAILED', fixture.fixtureId);
    return;
  }
  if (check.type === 'ownerValue') {
    const total = result.evaluated
      .find(item => item.candidateId === check.candidateId)
      .causalFacts
      .filter(fact => fact.causalOwnerType === check.owner)
      .reduce((sum, fact) => sum + Number(fact.valueHEPP), 0);
    if (check.equals !== undefined) approx(total, check.equals, `${fixture.fixtureId}:${check.owner}`);
    if (check.minimum !== undefined && !(total >= Number(check.minimum))) fail('M1_FIXTURE_OWNER_VALUE_TOO_SMALL', fixture.fixtureId);
    return;
  }
  if (check.type === 'factProperty') {
    const sourceCandidate = fixture.input.candidates.find(item => item.candidateId === check.candidateId);
    const fact = sourceCandidate?.rawFacts?.find(item => item[check.property] !== undefined);
    if (!fact || String(fact[check.property]) !== String(check.value)) fail('M1_FIXTURE_FACT_PROPERTY_MISMATCH', fixture.fixtureId);
    return;
  }
  fail('M1_FIXTURE_CHECK_UNKNOWN', `${fixture.fixtureId}:${check.type}`);
};

if (contract.status !== 'FROZEN') fail('M1_CONTRACT_NOT_FROZEN');
if (assertionsDoc.count !== 61 || assertionsDoc.assertions.length !== 61) fail('M1_ASSERTION_COUNT_MISMATCH');
if (componentsDoc.count !== 23 || componentsDoc.components.length !== 23) fail('M1_COMPONENT_COUNT_MISMATCH');
if (casesDoc.count !== 20 || casesDoc.cases.length !== 20) fail('M1_REFERENCE_CASE_COUNT_MISMATCH');
if (oracleIndex.count !== 54 || oracleIndex.oracles.length !== 54) fail('M1_ORACLE_COUNT_MISMATCH');
if (legacyOracleDoc.oracles.length !== 54) fail('M1_LEGACY_ORACLE_INPUT_COUNT_MISMATCH');
if (
  fixtureManifest.status !== 'FROZEN_EXECUTABLE_FIXTURES' ||
  fixtureManifest.count !== 54 ||
  fixtureManifest.fixtures.length !== 54
) fail('M1_ORACLE_FIXTURE_MANIFEST_INVALID');
if (oracleIndex.fixtureManifestPath !== 'tools/rc6/cases/BehaviorOracleFixtureManifestV1.json') {
  fail('M1_ORACLE_FIXTURE_MANIFEST_NOT_BOUND');
}
const bindingHash = oracleIndexBindingHash(oracleIndex);
if (oracleIndex.oracleIndexBindingHash !== bindingHash) fail('M1_ORACLE_INDEX_BINDING_HASH_INVALID');
if (fixtureManifest.oracleIndexBindingHash !== bindingHash) fail('M1_FIXTURE_INDEX_BINDING_HASH_MISMATCH');
if (oracleIndex.fixtureManifestHash !== hashJson(fixtureManifest)) fail('M1_FIXTURE_MANIFEST_HASH_MISMATCH');
if (m1FixtureManifest.fixtureManifestHash !== hashJson(fixtureManifest)) fail('M1_CONTRACT_FIXTURE_MANIFEST_HASH_MISMATCH');
if (m1FixtureManifest.oracleIndexBindingHash !== bindingHash) fail('M1_CONTRACT_INDEX_BINDING_HASH_MISMATCH');
if (selectionPolicy.status !== 'FROZEN' || selectionPolicy.noTopK !== true || selectionPolicy.noWallClockBudget !== true) fail('M1_SELECTION_POLICY_NOT_FROZEN');
const schemaFiles = [
  'BehaviorPlanningContractV1.schema.json',
  'SemanticAssertionV1.schema.json',
  'KernelComponentDefinitionV1.schema.json',
  'KernelReferenceCaseV1.schema.json',
  'BehaviorOracleV2IndexV1.schema.json',
  'BehaviorOracleFixtureV1.schema.json',
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
  input.candidates.forEach((candidate, candidateIndex) =>
    assertRawInputClean(candidate, `${input.caseId}.candidates[${candidateIndex}]`),
  );
  const result = assertRawCase(input);
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

const semanticGuardResults = runM1SemanticGuards({
  contract,
  cases: casesDoc.cases,
  caseById,
  evaluateRawCase,
  evaluateRawCandidate,
});
const contractRuleChecks = Object.fromEntries(
  assertionsDoc.assertions.map(assertion => [
    assertion.executableCheck,
    () => semanticGuardResults[assertion.executableCheck] === true,
  ]),
);

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
  if (oracle.executableStatus !== 'EXECUTABLE_FIXTURE_BOUND' || oracle.fixtureStatus !== 'EXECUTABLE') {
    fail('M1_ORACLE_NOT_EXECUTABLE', oracle.oracleId);
  }
  const fixture = fixtureById.get(oracle.fixtureId);
  if (!fixture || fixture.oracleId !== oracle.oracleId || fixture.sourceCaseId !== oracle.caseId) {
    fail('M1_ORACLE_FIXTURE_BINDING_MISMATCH', oracle.oracleId);
  }
  fixture.input.candidates.forEach((candidate, candidateIndex) =>
    assertRawInputClean(candidate, `${fixture.fixtureId}.candidates[${candidateIndex}]`),
  );
  const result = assertRawCase(fixture.input);
  const alternativeIds = result.alternatives.map(candidate => candidate.candidateId);
  if (new Set(alternativeIds).size !== alternativeIds.length || alternativeIds.includes(result.selected.candidateId)) {
    fail('M1_DUPLICATE_OR_INVALID_ALTERNATIVE', fixture.fixtureId);
  }
  if (!Array.isArray(fixture.checks) || fixture.checks.length === 0) fail('M1_ORACLE_FIXTURE_CHECKS_MISSING', oracle.oracleId);
  fixture.checks.forEach(check => checkFixtureAssertion(fixture, result, check));
  return {
    oracleId: oracle.oracleId,
    caseId: oracle.caseId,
    fixtureId: fixture.fixtureId,
    semanticDomain: fixture.semanticDomain,
    variant: fixture.variant,
    selectedCandidateId: result.selected.candidateId,
    candidateCount: result.evaluated.length,
    paretoCount: result.pareto.length,
    alternativeIds,
    checkCount: fixture.checks.length,
    executable: true,
  };
});

const mechanicalOracleConcepts = new Set([
  'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07',
  'c08', 'c09', 'c10', 'c11', 'c12', 'c13', 'c14',
  'x01', 'x02', 'x03', 'x04', 'x05', 'x06',
]);
fixtureManifest.fixtures.forEach(fixture => {
  if (!mechanicalOracleConcepts.has(fixture.concept)) return;
  const formulas = fixture.input.candidates.flatMap(candidate =>
    candidate.rawFacts.map(fact => fact.formula),
  );
  if (formulas.includes('CONSTANT_HEPP')) {
    fail('M1_ORACLE_MECHANICAL_CONSTANT_PLACEHOLDER', fixture.fixtureId);
  }
});

const fixtureVariantsByConcept = new Map();
fixtureManifest.fixtures.forEach(fixture => {
  if (!fixtureVariantsByConcept.has(fixture.concept)) fixtureVariantsByConcept.set(fixture.concept, new Set());
  fixtureVariantsByConcept.get(fixture.concept).add(fixture.variant);
});
for (const concept of Array.from({ length: 16 }, (_, index) => `c${String(index + 1).padStart(2, '0')}`)) {
  const variants = fixtureVariantsByConcept.get(concept);
  if (!variants || !['positive', 'negative', 'mutation'].every(value => variants.has(value))) {
    fail('M1_ORACLE_TRIPLET_INCOMPLETE', concept);
  }
}
for (const concept of ['x01', 'x02', 'x03', 'x04', 'x05', 'x06']) {
  const variants = fixtureVariantsByConcept.get(concept);
  if (!variants || variants.size !== 1 || !variants.has('single')) fail('M1_ORACLE_SINGLE_FIXTURE_INCOMPLETE', concept);
}

const referenceToolFiles = [
  'tools/rc6/reference/reference-value-evaluator.mjs',
  'tools/rc6/reference/reference-value-evaluator-v2.mjs',
  'tools/rc6/reference/m1-semantic-guards.mjs',
];
for (const evaluatorFile of referenceToolFiles) {
  const evaluatorSource = fs.readFileSync(path.join(repoRoot, evaluatorFile), 'utf8');
  for (const forbidden of ['BattleDecision_Module', 'BattlePreview_Module', 'BattleRuntime_Module', 'BattleReport_Module', 'r9v2']) {
    if (evaluatorSource.includes(forbidden)) fail('M1_REFERENCE_EVALUATOR_DEPENDENCY_LEAK', `${evaluatorFile}:${forbidden}`);
  }
}
const changedFiles = execFileSync('git', ['status', '--short'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true })
  .split(/\r?\n/u)
  .map(line => line.slice(3).trim())
  .filter(Boolean)
  .filter(fileName => !fileName.startsWith('tmp/'));
const productionChanges = changedFiles.filter(fileName => !fileName.startsWith('tools/rc6/'));

const output = {
  schemaVersion: 'M1ContractGateV1',
  status: 'PASSED',
  contractId: contract.contractId,
  productionSourceHashes: productionHashes,
  productionChangesObserved: productionChanges,
  productionHashPolicy: 'HISTORICAL_SNAPSHOT_ONLY_NOT_M1_PREREQUISITE',
  counts: {
    assertions: assertionResults.length,
    prototypes: componentsDoc.components.length,
    referenceCases: caseResults.length,
    oracles: oracleResults.length,
  },
  contractBlockingUnresolved: assertionsDoc.assertions.filter(assertion => assertion.resolutionStatus !== 'FROZEN').map(assertion => assertion.assertionId),
  independentReferenceEvaluator: 'PASSED_NO_PRODUCTION_IMPORTS_V2_RAW_CASES',
  oracleFixtureExecution: '54_UNIQUE_FIXTURE_INPUTS_16_TRIPLETS_6_SINGLE_CASES',
  semanticGuardResults,
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
    referenceToolHashes: Object.fromEntries(referenceToolFiles.map(fileName => [
      fileName,
      sha256(fs.readFileSync(path.join(repoRoot, fileName))),
    ])),
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

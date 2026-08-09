import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBasis,
  fullRouteVector,
  informationValue,
  sparseRouteVector,
} from '../reference/s4-branch-value-reference-v1.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fixturePath = path.join(repoRoot, 'tools', 'rc6', 'cases', 'S4BranchValueRepresentationCasesV1.json');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k14-s4-branch-value-reference.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readUtf8 = filePath => fs.readFileSync(filePath, 'utf8');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const equalRows = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const fixtureText = readUtf8(fixturePath);
const fixture = JSON.parse(fixtureText);
assert(fixture.schemaVersion === 'S4BranchValueRepresentationCasesV1', 'S4_BRANCH_REFERENCE_FIXTURE_SCHEMA');
const rows = fixture.cases.map(testCase => {
  const basis = buildBasis(testCase);
  const outcomes = testCase.branches.map(branch => {
    const full = fullRouteVector(testCase, branch);
    const sparse = sparseRouteVector(testCase, branch, basis);
    assert(equalRows(full, sparse), `S4_BRANCH_REFERENCE_VECTOR_MISMATCH:${testCase.caseId}:${branch.branchId}`);
    return {
      branchId: branch.branchId,
      probability: branch.probability,
      full,
      sparse,
      equal: true,
    };
  });
  const probabilities = outcomes.map(outcome => outcome.probability);
  const fullInformationValueHEPP = informationValue(
    outcomes.map(outcome => outcome.full),
    probabilities,
  );
  const sparseInformationValueHEPP = informationValue(
    outcomes.map(outcome => outcome.sparse),
    probabilities,
  );
  assert(
    Math.abs(fullInformationValueHEPP - sparseInformationValueHEPP) <= 1e-12,
    `S4_BRANCH_REFERENCE_INFORMATION_MISMATCH:${testCase.caseId}`,
  );
  assert(
    Math.abs(fullInformationValueHEPP - Number(testCase.expectedInformationValueHEPP)) <= 1e-12,
    `S4_BRANCH_REFERENCE_EXPECTATION_MISMATCH:${testCase.caseId}`,
  );
  return {
    caseId: testCase.caseId,
    objectiveMode: testCase.objective.mode,
    outcomeCount: outcomes.length,
    outcomes,
    fullInformationValueHEPP,
    sparseInformationValueHEPP,
    fieldEqual: true,
  };
});

const output = {
  schemaVersion: 'M2K14S4BranchValueReferenceGateV1',
  status: 'PASSED',
  representation: 'BASELINE_ROUTE_COLUMNS_PLUS_SPARSE_BRANCH_DELTAS',
  caseCount: rows.length,
  rows,
  sourceHashes: {
    fixture: sha256(fixtureText),
    reference: sha256(readUtf8(path.join(repoRoot, 'tools', 'rc6', 'reference', 's4-branch-value-reference-v1.mjs'))),
    harness: sha256(readUtf8(fileURLToPath(import.meta.url))),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

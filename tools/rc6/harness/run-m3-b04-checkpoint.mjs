import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReferenceCase } from '../reference/reference-value-evaluator.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm3', 'm3-b04-checkpoint.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const hashFile = relativePath => sha256(fs.readFileSync(path.join(repoRoot, relativePath)));
const existingPathFixtureCandidates = [
  'tools/rc6/cases/BehaviorPathIndexV1.json',
  'tools/rc6/cases/BehaviorPathManifestV1.json',
  'tools/rc6/cases/KernelPathCasesV1.json',
];

const contract = readJson('tools/rc6/contracts/BehaviorPlanningContractV1.json');
const components = readJson('tools/rc6/contracts/KernelComponentRegistryV1.json');
const cases = readJson('tools/rc6/cases/KernelReferenceCasesV1.json');
const oracleIndex = readJson('tools/rc6/cases/BehaviorOracleV2IndexV1.json');
const b01 = readJson('tools/rc6/evidence/m3/b01-target-behavior-v3.json');

const referenceResults = [];
const referenceFailures = [];
for (const input of cases.cases) {
  try {
    const result = assertReferenceCase(input);
    referenceResults.push({
      caseId: input.caseId,
      semanticDomain: input.semanticDomain,
      phase: input.phase,
      mode: input.mode,
      candidateCount: result.evaluated.length,
      eligibleCount: result.eligible.length,
      paretoCount: result.pareto.length,
      selectedCandidateId: result.selected.candidateId,
    });
  } catch (error) {
    referenceFailures.push({ caseId: input.caseId, error: String(error?.message || error) });
  }
}

const caseByDomain = new Map();
for (const row of cases.cases) {
  if (!caseByDomain.has(row.semanticDomain)) caseByDomain.set(row.semanticDomain, row);
}
const oracleSmokeResults = [];
const oracleFailures = [];
for (const oracle of oracleIndex.oracles) {
  const smokeCase = caseByDomain.get(oracle.semanticDomain);
  if (!smokeCase) {
    oracleFailures.push({ oracleId: oracle.oracleId, error: 'ORACLE_DOMAIN_CASE_MISSING' });
    continue;
  }
  try {
    const result = assertReferenceCase(smokeCase);
    oracleSmokeResults.push({
      oracleId: oracle.oracleId,
      caseId: oracle.caseId,
      smokeCaseId: smokeCase.caseId,
      selectedCandidateId: result.selected.candidateId,
      executableChecks: oracle.executableChecks,
    });
  } catch (error) {
    oracleFailures.push({ oracleId: oracle.oracleId, error: String(error?.message || error) });
  }
}

const pathFixture = existingPathFixtureCandidates.find(relativePath =>
  fs.existsSync(path.join(repoRoot, relativePath)),
);
const pathCoverage = pathFixture
  ? (() => {
      const document = readJson(pathFixture);
      const paths = Array.isArray(document.paths)
        ? document.paths
        : Array.isArray(document.cases)
          ? document.cases
          : [];
      return {
        status: paths.length === 621 ? 'AVAILABLE' : 'COUNT_MISMATCH',
        fixture: pathFixture,
        observedCount: paths.length,
        expectedCount: 621,
      };
    })()
  : {
      status: 'MISSING_FIXTURE',
      fixture: null,
      observedCount: 0,
      expectedCount: 621,
      searched: existingPathFixtureCandidates,
    };

const targetRows = Array.isArray(b01.rows) ? b01.rows : [];
const completedTargetRows = targetRows.filter(row => row.status === 'COMPLETED');
const sevenVsSevenRows = completedTargetRows.filter(row =>
  String(row.caseId || '').startsWith('raid_'),
);
const output = {
  schemaVersion: 'M3B04CheckpointV1',
  status: referenceFailures.length || oracleFailures.length
    ? 'FAILED_REFERENCE_COVERAGE'
    : pathCoverage.status === 'AVAILABLE'
      ? 'PASSED'
      : 'BLOCKED_INPUT_GAP',
  milestoneId: 'M3',
  taskId: 'M3-B04',
  formalProvider: 'r8',
  targetProvider: 'r9v2_unregistered_test_registry_only',
  checks: {
    behaviorOracleCount: oracleIndex.oracles.length,
    behaviorOracleExpected: 54,
    behaviorOracleSmokePassed: oracleSmokeResults.length,
    behaviorOracleFailures: oracleFailures,
    referenceCaseCount: cases.cases.length,
    referenceCaseExpected: 20,
    referenceCasesPassed: referenceResults.length,
    referenceFailures,
    componentCount: components.components.length,
    componentExpected: 23,
    targetFullTransactionCaseCount: completedTargetRows.length,
    targetFullTransactionExpectedMinimum: 10,
    requiredSevenVsSevenCompleted: sevenVsSevenRows.length,
    requiredSevenVsSevenExpected: 5,
    pathCoverage,
  },
  targetSevenVsSevenEvidence: {
    file: 'tools/rc6/evidence/m3/b01-target-behavior-v3.json',
    sourceHash: hashFile('tools/rc6/evidence/m3/b01-target-behavior-v3.json'),
    cases: sevenVsSevenRows.map(row => ({
      caseId: row.caseId,
      rounds: row.rounds,
      decisionCount: row.decisionCount,
      reportProjectionStatus: row.player?.projectionStatus,
      reportAuditStatus: row.developerReveal?.reportAuditStatus,
    })),
  },
  referenceRows: referenceResults,
  oracleSmokeRows: oracleSmokeResults,
  sourceHashes: {
    'tools/rc6/contracts/BehaviorPlanningContractV1.json': hashFile('tools/rc6/contracts/BehaviorPlanningContractV1.json'),
    'tools/rc6/contracts/KernelComponentRegistryV1.json': hashFile('tools/rc6/contracts/KernelComponentRegistryV1.json'),
    'tools/rc6/cases/KernelReferenceCasesV1.json': hashFile('tools/rc6/cases/KernelReferenceCasesV1.json'),
    'tools/rc6/cases/BehaviorOracleV2IndexV1.json': hashFile('tools/rc6/cases/BehaviorOracleV2IndexV1.json'),
    'tools/rc6/harness/run-m3-b04-checkpoint.mjs': hashFile('tools/rc6/harness/run-m3-b04-checkpoint.mjs'),
  },
  blockers: pathCoverage.status === 'MISSING_FIXTURE'
    ? [
        'No current tracked BehaviorPathIndexV1/BehaviorPathManifestV1/KernelPathCasesV1 fixture exists.',
        'Historical R8 artifacts containing the number 621 are not accepted as R9v2 path coverage.',
        'Do not mark M3 complete until a source-owned 621-path fixture or an explicit contract correction exists.',
      ]
    : [],
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({
  status: output.status,
  oracleCount: output.checks.behaviorOracleSmokePassed,
  referenceCaseCount: output.checks.referenceCasesPassed,
  componentCount: output.checks.componentCount,
  sevenVsSevenCount: output.checks.requiredSevenVsSevenCompleted,
  pathCoverage: output.checks.pathCoverage,
}, null, 2));

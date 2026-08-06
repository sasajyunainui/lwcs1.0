import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRawCase } from '../reference/reference-value-evaluator-v2.mjs';

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
const targetPathCoverageEvidencePath = 'tools/rc6/evidence/m3/m3-b04-r9v2-path-coverage.json';

const referenceResults = [];
const referenceFailures = [];
for (const input of cases.cases) {
  try {
    const result = assertRawCase(input);
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
    const result = assertRawCase(smokeCase);
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

const targetPathCoverage = fs.existsSync(
  path.join(repoRoot, targetPathCoverageEvidencePath),
)
  ? readJson(targetPathCoverageEvidencePath)
  : null;
const pathCoverageSourceFiles = [
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleDecisionR9v2Kernel_Module.js',
  'tools/rc6/cases/BattleMechanismPrototypeScopeV1.json',
  'tools/rc6/harness/run-m3-b04-r9v2-path-coverage.mjs',
];
const pathCoverageSourceHashMismatches = targetPathCoverage
  ? pathCoverageSourceFiles
      .filter(relativePath =>
        targetPathCoverage.sourceHashes?.[relativePath] !== hashFile(relativePath),
      )
  : pathCoverageSourceFiles;
const pathCoverageExecution = targetPathCoverage?.executed || {};
const pathCoverageIsCurrent = Boolean(
  targetPathCoverage?.schemaVersion === 'M3B04R9v2PathCoverageV1' &&
  targetPathCoverage?.status === 'PASSED' &&
  targetPathCoverage?.sourceOwned === true &&
  targetPathCoverage?.scope?.includedPrototypeCount === 23 &&
  targetPathCoverage?.scope?.expectedPathCount === 621 &&
  targetPathCoverage?.scope?.observedPathCount === 621 &&
  pathCoverageExecution.pathCount === 621 &&
  pathCoverageExecution.passedCount === 621 &&
  pathCoverageExecution.failedCount === 0 &&
  pathCoverageExecution.fullCoverage === true &&
  pathCoverageSourceHashMismatches.length === 0,
);
const pathCoverage = {
  status: pathCoverageIsCurrent
    ? 'AVAILABLE'
    : targetPathCoverage
      ? targetPathCoverage.status === 'PASSED'
        ? 'STALE_OR_INVALID'
        : 'FAILED_EVIDENCE'
      : 'MISSING_FIXTURE',
  fixture: targetPathCoverage ? targetPathCoverageEvidencePath : null,
  observedCount: Number(targetPathCoverage?.scope?.observedPathCount || 0),
  expectedCount: 621,
  executedCount: Number(pathCoverageExecution.pathCount || 0),
  passedCount: Number(pathCoverageExecution.passedCount || 0),
  failedCount: Number(pathCoverageExecution.failedCount || 0),
  sourceHashMismatches: pathCoverageSourceHashMismatches,
  searched: targetPathCoverage ? undefined : [targetPathCoverageEvidencePath, ...existingPathFixtureCandidates],
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
    [targetPathCoverageEvidencePath]: targetPathCoverage
      ? hashFile(targetPathCoverageEvidencePath)
      : null,
  },
  blockers: pathCoverage.status !== 'AVAILABLE'
    ? [
        'Current R9v2 path coverage evidence is missing, failed, stale, or incomplete.',
        `Observed ${pathCoverage.passedCount}/621 current target-provider paths; do not accept historical R8 path counts.`,
        `Source hash mismatches: ${pathCoverage.sourceHashMismatches.join(', ') || 'none recorded'}.`,
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

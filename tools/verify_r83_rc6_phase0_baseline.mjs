import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const sourceFiles = [
  'BattleDecision_Module.js',
  'BattlePreview_Module.js',
  'BattleReport_Module.js',
  'BattleRuntime_Module.js',
];
const manifestPath = path.join(
  repoRoot,
  'tools/evidence/r8/r83_rc6_phase0_patch_ownership_manifest_2026-07-29.json',
);
const phase3Path = path.join(
  repoRoot,
  'tools/evidence/r8/r83_rc6_phase0_phase3_current_2026-07-29.json',
);
const outputPath = path.join(
  repoRoot,
  process.argv[2] ||
    'tools/evidence/r8/r83_rc6_phase0_baseline_verification_2026-07-29.json',
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sourceRecord(relativePath) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath));
  return {
    sha256: sha256(content),
    bytes: content.length,
  };
}

function runNode(relativeScript, { allowFailure = false, timeout = 300000 } = {}) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, relativeScript)], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 512 * 1024 * 1024,
    timeout,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${relativeScript} failed with ${result.status}\n${result.stderr || result.stdout}`,
    );
  }
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseJsonOutput(run, relativeScript) {
  try {
    return JSON.parse(run.stdout);
  } catch (error) {
    throw new Error(`${relativeScript} did not emit JSON: ${error.message}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const phase3 = JSON.parse(fs.readFileSync(phase3Path, 'utf8'));
const syntax = Object.fromEntries(
  sourceFiles.map(relativePath => {
    const result = spawnSync(process.execPath, ['--check', path.join(repoRoot, relativePath)], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    return [
      relativePath,
      {
        exitCode: result.status,
        passed: result.status === 0,
        stderr: String(result.stderr || '').trim(),
      },
    ];
  }),
);
const phase1 = parseJsonOutput(
  runNode('tools/audit_battle_r83_phase1.mjs'),
  'tools/audit_battle_r83_phase1.mjs',
);
const phase7 = parseJsonOutput(
  runNode('tools/audit_battle_r83_phase7.mjs'),
  'tools/audit_battle_r83_phase7.mjs',
);
const candidateProof = parseJsonOutput(
  runNode('tools/audit_battle_r9v2_full_candidate_value_proof.mjs', {
    timeout: 600000,
  }),
  'tools/audit_battle_r9v2_full_candidate_value_proof.mjs',
);
const tacticalProbe = parseJsonOutput(
  runNode('tools/probe_r83_rc2_r9v2_remaining_tactical_primitives.mjs', {
    timeout: 600000,
  }),
  'tools/probe_r83_rc2_r9v2_remaining_tactical_primitives.mjs',
);
const phase10Run = runNode('tools/audit_battle_r83_phase10.mjs', {
  allowFailure: true,
});
const phase10 = parseJsonOutput(phase10Run, 'tools/audit_battle_r83_phase10.mjs');
const reportDtoRun = runNode('tools/audit_battle_r74_report_dto.mjs', {
  allowFailure: true,
});
const reportDtoFailureText = `${reportDtoRun.stdout}\n${reportDtoRun.stderr}`;
const expectedReportRejectionCodes = [
  'ZERO_PROGRESS',
  'OBJECTIVE_STALL',
  'DOMINATED',
  'UNCOMPENSATED_RISK',
];
const knownPhase10Failures = [
  'report:r8-decision-count',
  'report:number-dual-source',
  'decision:future-natural-descriptors-preserve-resource-continuity',
  'ui:preview-never-commits',
  'ui:report-dto-four-views',
  'ui:prediction-and-settlement-numbers-are-separated',
  'bridge:ai-summary-uses-structured-report-input',
];
const actualPhase10Failures = phase10.checks
  .filter(check => !check.passed)
  .map(check => check.checkId);
const sourceRecords = Object.fromEntries(
  sourceFiles.map(relativePath => [relativePath, sourceRecord(relativePath)]),
);
const failures = [];

function check(condition, code, details = undefined) {
  if (!condition) failures.push({ code, details });
}

check(
  Object.values(syntax).every(result => result.passed),
  'CORE_SYNTAX_FAILED',
  syntax,
);
check(phase1.summary?.failedCount === 0, 'PHASE1_FAILED', phase1.summary);
check(phase3.summary?.failedCount === 0, 'PHASE3_FAILED', phase3.summary);
check(phase7.summary?.failedCount === 0, 'PHASE7_FAILED', phase7.summary);
check(
  phase7.summary?.executableContractCount === 54,
  'EXECUTABLE_CONTRACT_COUNT_MISMATCH',
  phase7.summary,
);
check(
  candidateProof.summary?.proofMissingCount === 0 &&
    candidateProof.summary?.unsupportedProofRowCount === 0 &&
    candidateProof.summary?.objectiveEquationErrorRowCount === 0 &&
    candidateProof.summary?.reconciliationErrorRowCount === 0,
  'R9V2_CANDIDATE_PROOF_FAILED',
  candidateProof.summary,
);
check(
  tacticalProbe.summary?.candidateCount === 0,
  'TACTICAL_PRIMITIVE_REPRODUCED',
  tacticalProbe.summary,
);
check(
  reportDtoRun.exitCode !== 0 &&
    expectedReportRejectionCodes.every(code => reportDtoFailureText.includes(code)),
  'REPORT_DTO_BLOCKER_CHANGED',
);
check(
  phase10Run.exitCode !== 0 &&
    JSON.stringify(actualPhase10Failures) === JSON.stringify(knownPhase10Failures),
  'PHASE10_BLOCKER_SET_CHANGED',
  actualPhase10Failures,
);
check(manifest.hunkSummary?.total === 192, 'PATCH_MANIFEST_INVALID');
check(
  sourceFiles.every(
    relativePath =>
      manifest.sourceFiles?.[relativePath]?.sha256 === sourceRecords[relativePath].sha256,
  ),
  'PATCH_MANIFEST_SOURCE_HASH_MISMATCH',
);

const evidence = {
  schemaVersion: 'RC6Phase0BaselineVerificationV1',
  generatedAt: new Date().toISOString(),
  repository: {
    head: manifest.repository.head,
    branch: manifest.repository.branch,
  },
  sourceFiles: sourceRecords,
  patchOwnershipManifest: {
    path: path.relative(repoRoot, manifestPath).replaceAll('\\', '/'),
    sha256: sha256(fs.readFileSync(manifestPath)),
    hunkCount: manifest.hunkSummary.total,
  },
  gates: {
    syntax,
    phase1: phase1.summary,
    phase3: phase3.summary,
    phase7: phase7.summary,
    r9v2CandidateProof: candidateProof.summary,
    tacticalPrimitiveProbe: tacticalProbe.summary,
    reportDto: {
      status: 'BLOCKED',
      rejectionCodes: expectedReportRejectionCodes,
    },
    phase10: {
      status: phase10.summary?.reportProjectionStatus,
      passedCount: phase10.summary?.passedCount,
      failedCount: phase10.summary?.failedCount,
      failedChecks: actualPhase10Failures,
    },
  },
  acceptance: {
    phase0Status: failures.length ? 'FAILED' : 'PASSED',
    behaviorBaselineStatus: failures.length ? 'BLOCKED' : 'ACCEPTED',
    reportMigrationStatus: 'BLOCKED',
    providerSwitchStatus: 'NOT_READY',
    overallCompletionStatus: 'NOT_COMPLETE',
  },
  failures,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${JSON.stringify({
    outputPath,
    gates: evidence.gates,
    acceptance: evidence.acceptance,
    failures,
  }, null, 2)}\n`,
);
if (failures.length) process.exitCode = 1;

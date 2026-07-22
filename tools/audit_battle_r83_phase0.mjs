import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const evidenceDir = path.join(toolDir, 'evidence', 'r8');
const baselinePath = path.join(evidenceDir, 'r83_rc_current_worktree_baseline.json');

const sha256 = value => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

const readUtf8 = filePath => fs.readFileSync(filePath, 'utf8');
const git = args => execFileSync(
  'git',
  args,
  {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
  },
).trimEnd();

const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

if (!fs.existsSync(baselinePath)) {
  addCheck('baseline:manifest-present', false, { baselinePath });
  const output = {
    summary: {
      checkCount: checks.length,
      passedCount: 0,
      failedCount: 1,
      knownIssueStatus: 'CURRENT_WORKTREE_BASELINE_MISSING',
      sourceDriftStatus: 'UNKNOWN',
      manualEvidenceStatus: 'INVALID',
    },
    checks,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
} else {
  const baseline = JSON.parse(readUtf8(baselinePath));
  const sourceFiles = Object.keys(baseline.sourceFiles || {});
  const historicalEvidence = Object.keys(baseline.historicalEvidence || {});
  const missingSources = sourceFiles.filter(fileName =>
    !fs.existsSync(path.join(repoRoot, fileName))
  );
  const missingHistoricalEvidence = historicalEvidence.filter(fileName =>
    !fs.existsSync(path.join(evidenceDir, fileName))
  );
  const sourceHashChanges = sourceFiles.flatMap(fileName => {
    if (missingSources.includes(fileName)) return [];
    const actual = sha256(readUtf8(path.join(repoRoot, fileName)));
    const expected = String(baseline.sourceFiles?.[fileName]?.sha256 || '');
    return actual === expected ? [] : [{ fileName, expected, actual }];
  });
  const historicalHashChanges = historicalEvidence.flatMap(fileName => {
    if (missingHistoricalEvidence.includes(fileName)) return [];
    const actual = sha256(readUtf8(path.join(evidenceDir, fileName)));
    const expected = String(baseline.historicalEvidence?.[fileName]?.sha256 || '');
    return actual === expected ? [] : [{ fileName, expected, actual }];
  });
  const currentPatchHash = sha256(git(['diff', '--binary', '--no-ext-diff', 'HEAD']));
  const currentStagedPatchHash = sha256(
    git(['diff', '--cached', '--binary', '--no-ext-diff']),
  );
  const sourceDrift = sourceHashChanges.length > 0 ||
    currentPatchHash !== String(baseline.repository?.workingPatchHash || '') ||
    currentStagedPatchHash !== String(baseline.repository?.stagedPatchHash || '');

  addCheck(
    'baseline:schema',
    baseline.schemaVersion === '8.3-rc-current-worktree-baseline-1',
    { schemaVersion: baseline.schemaVersion },
  );
  addCheck(
    'baseline:current-head',
    /^[a-f0-9]{40}$/.test(String(baseline.repository?.head || '')),
    { head: baseline.repository?.head || '' },
  );
  addCheck(
    'baseline:source-list',
    sourceFiles.length >= 12 && missingSources.length === 0,
    { sourceFileCount: sourceFiles.length, missingSources },
  );
  addCheck(
    'baseline:historical-classification-evidence',
    historicalEvidence.length === 5 && missingHistoricalEvidence.length === 0,
    { historicalEvidenceCount: historicalEvidence.length, missingHistoricalEvidence },
  );
  addCheck(
    'baseline:invalidation-policy',
    baseline.invalidationPolicy?.sourceHashChange ===
      'INVALIDATE_MANUAL_REVIEW_AND_BATCH_RESULT' &&
      baseline.invalidationPolicy?.legacyEvidence ===
        'HISTORICAL_CLASSIFICATION_ONLY',
  );
  addCheck(
    'baseline:historical-evidence-unchanged',
    historicalHashChanges.length === 0,
    { historicalHashChanges },
  );
  addCheck(
    'baseline:current-source-drift-is-observable',
    true,
    {
      sourceDriftStatus: sourceDrift
        ? 'DRIFTED_AFTER_BASELINE'
        : 'MATCHES_FROZEN_BASELINE',
      sourceHashChanges,
      patchHashMatches:
        currentPatchHash === String(baseline.repository?.workingPatchHash || ''),
      stagedPatchHashMatches:
        currentStagedPatchHash ===
        String(baseline.repository?.stagedPatchHash || ''),
    },
  );

  const mojibakeTokens = ['\uFFFD', '\u951F', '\u6769', '\u9428'];
  const utf8Findings = [
    baselinePath,
    path.join(toolDir, 'generate_battle_r83_rc_baseline.mjs'),
    path.join(toolDir, 'audit_battle_r83_phase0.mjs'),
  ].filter(filePath => {
    const source = readUtf8(filePath);
    return mojibakeTokens.some(token => source.includes(token));
  });
  addCheck('utf8:no-mojibake', utf8Findings.length === 0, {
    utf8Findings: utf8Findings.map(filePath => path.relative(repoRoot, filePath)),
  });

  const failed = checks.filter(check => !check.passed);
  const output = {
    summary: {
      checkCount: checks.length,
      passedCount: checks.length - failed.length,
      failedCount: failed.length,
      knownIssueStatus: failed.length
        ? 'CURRENT_WORKTREE_BASELINE_INVALID'
        : 'CURRENT_WORKTREE_BASELINE_FROZEN',
      sourceDriftStatus: sourceDrift
        ? 'DRIFTED_AFTER_BASELINE'
        : 'MATCHES_FROZEN_BASELINE',
      manualEvidenceStatus: sourceDrift
        ? 'INVALIDATED_BY_SOURCE_DRIFT'
        : 'NO_CURRENT_HUMAN_REVIEW',
    },
    checks,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

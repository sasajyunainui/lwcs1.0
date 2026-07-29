import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const manifestPath = path.resolve(
  repoRoot,
  process.argv[2] ||
    'tools/evidence/r8/r83_rc6_phase0_patch_ownership_manifest_2026-07-29.json',
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

function check(condition, code, details = undefined) {
  if (!condition) failures.push({ code, details });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

check(manifest.schemaVersion === 'PatchOwnershipManifestV1', 'SCHEMA_VERSION_INVALID');
check(manifest.repository?.head === '546bdfd03a289eec89b6f1aa1e076ebebea6e4b6', 'HEAD_MISMATCH', {
  actual: manifest.repository?.head,
});
check(manifest.repository?.branch === 'master', 'BRANCH_MISMATCH', {
  actual: manifest.repository?.branch,
});
check(manifest.hunkSummary?.expectedTotal === 192, 'EXPECTED_HUNK_TOTAL_INVALID');
check(manifest.hunkSummary?.total === 192, 'HUNK_TOTAL_MISMATCH', {
  actual: manifest.hunkSummary?.total,
});
check(manifest.hunkSummary?.allOwned === true, 'UNOWNED_HUNK');
check(Array.isArray(manifest.hunks) && manifest.hunks.length === 192, 'HUNK_ARRAY_MISMATCH');
check(
  Array.isArray(manifest.repository?.unexpectedDirty) &&
    manifest.repository.unexpectedDirty.length === 0,
  'UNEXPECTED_DIRTY_PATH',
  manifest.repository?.unexpectedDirty,
);
check(
  Array.isArray(manifest.repository?.excludedDirty) &&
    manifest.repository.excludedDirty.length === 4,
  'EXCLUDED_DIRTY_PATH_SET_MISMATCH',
  manifest.repository?.excludedDirty,
);
check(
  manifest.hunks.every(
    hunk =>
      hunk.hunkId &&
      hunk.file &&
      hunk.nearestSymbol &&
      hunk.ownership?.owner &&
      hunk.ownership?.confidence &&
      hunk.ownership?.reason,
  ),
  'HUNK_OWNERSHIP_INCOMPLETE',
);
check(
  manifest.hunks.every(
    hunk =>
      hunk.ownership.confidence !== 'LOW' ||
      hunk.ownership.owner === 'RC6_BASELINE_RECONCILIATION',
  ),
  'LOW_CONFIDENCE_HISTORY_ATTRIBUTION',
);

const missingEvidence = manifest.hunks.flatMap(hunk =>
  hunk.evidence
    .filter(record => record.status !== 'PRESENT')
    .map(record => ({ hunkId: hunk.hunkId, path: record.path })),
);
check(missingEvidence.length === 0, 'OWNERSHIP_EVIDENCE_MISSING', missingEvidence);

const {
  schemaVersion: ignoredSchemaVersion,
  generatedAt: ignoredGeneratedAt,
  manifestSha256,
  ...core
} = manifest;
void ignoredSchemaVersion;
void ignoredGeneratedAt;
check(manifestSha256 === sha256(JSON.stringify(core)), 'MANIFEST_HASH_MISMATCH');
check(
  manifest.completion?.overallCompletionStatus === 'NOT_COMPLETE',
  'OVERALL_STATUS_MUST_REMAIN_NOT_COMPLETE',
);
check(
  manifest.completion?.reportMigrationStatus === 'BLOCKED',
  'REPORT_BLOCKER_NOT_RECORDED',
);
check(
  manifest.completion?.providerSwitchStatus === 'NOT_READY',
  'PROVIDER_SWITCH_STATUS_INVALID',
);

const output = {
  schemaVersion: 'PatchOwnershipManifestAuditV1',
  manifestPath: path.relative(repoRoot, manifestPath).replaceAll('\\', '/'),
  manifestSha256,
  checkedHunks: manifest.hunks.length,
  ownershipCounts: manifest.hunkSummary?.ownershipCounts,
  confidenceCounts: manifest.hunkSummary?.confidenceCounts,
  failures,
  status: failures.length ? 'FAILED' : 'PASSED',
};
const outputPath = path.resolve(
  repoRoot,
  process.argv[3] ||
    'tools/evidence/r8/r83_rc6_phase0_patch_ownership_manifest_audit_2026-07-29.json',
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (failures.length) process.exitCode = 1;

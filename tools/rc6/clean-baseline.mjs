import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const baselinePatchPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'baseline', 'working-tree.patch');
const ownershipPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'patch-ownership-manifest.json');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'baseline', 'clean-baseline-result.json');
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (args, options = {}) => execFileSync('git', args, {
  cwd: repoRoot,
  windowsHide: true,
  maxBuffer: 128 * 1024 * 1024,
  ...options,
});
const ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'));
const sourcePatch = fs.readFileSync(baselinePatchPath);
const currentPatch = git(['-c', 'core.quotePath=false', 'diff', '--binary', '--no-ext-diff', '--unified=0', 'HEAD', '--'], { encoding: null });
const currentPatchText = currentPatch.toString('utf8');
const currentHunks = currentPatchText.split(/(?=^@@ )/mu);
const currentPatchHeader = currentHunks.shift() || '';
if (!ownership.hunks || ownership.hunks.length !== 35) throw new Error('RC6_BASELINE_OWNERSHIP_INVALID');
const keepCount = ownership.hunks.filter(hunk => hunk.classification === 'KEEP').length;
const temporaryPatchPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'baseline', 'removed-nonkeep.patch');
if (currentHunks.length !== ownership.hunks.length && currentHunks.length !== keepCount) {
  throw new Error(`RC6_BASELINE_HUNK_ALIGNMENT_INVALID:${currentHunks.length}`);
}
if (currentHunks.length === keepCount) {
  const afterPatch = currentPatch;
  const afterDiffText = git(['-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--unified=0', 'HEAD', '--'], { encoding: 'utf8' });
  const outputCore = {
    schemaVersion: 'CleanBaselineResultV1',
    planId: 'BattleUI-R8.3-RC6',
    planRevision: 24,
    generatedAt: new Date().toISOString(),
    sourcePatchSha256: sha256(sourcePatch),
    selectiveInputPatchSha256: null,
    resultingPatchSha256: sha256(afterPatch),
    originalHunkCount: ownership.hunks.length,
    resultingHunkCount: (afterDiffText.match(/^@@/gmu) || []).length,
    keptHunks: ownership.hunks.filter(hunk => hunk.classification === 'KEEP').map(hunk => ({ hunkId: hunk.hunkId, classification: hunk.classification, symbol: hunk.symbol })),
    removedHunks: ownership.hunks.filter(hunk => hunk.classification !== 'KEEP').map(hunk => ({ hunkId: hunk.hunkId, classification: hunk.classification, symbol: hunk.symbol })),
    removedPatchArtifact: relative(temporaryPatchPath),
    verification: {
      selectiveReverseApplied: true,
      reusedExistingCleanState: true,
      headReset: false,
      checkoutUsed: false,
      tmpTouched: false,
      formalProvider: 'r8',
      status: 'CLEAN_BASELINE_READY_FOR_KEEP_PROBES',
    },
  };
  const output = { ...outputCore, resultHash: sha256(JSON.stringify(outputCore)) };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ outputPath: relative(outputPath), resultHash: output.resultHash, originalHunkCount: output.originalHunkCount, resultingHunkCount: output.resultingHunkCount, keptHunks: output.keptHunks.map(item => item.hunkId), removedCount: output.removedHunks.length }, null, 2)}\n`);
  process.exit(0);
}
const patchHeader = currentPatchHeader;
const hunks = currentHunks;
if (hunks.length !== ownership.hunks.length) throw new Error(`RC6_BASELINE_HUNK_ALIGNMENT_INVALID:${hunks.length}`);
const keepHunks = ownership.hunks
  .map((hunk, index) => ({ hunk, index, patch: hunks[index] }))
  .filter(item => item.hunk.classification === 'KEEP');
const removeHunks = ownership.hunks
  .map((hunk, index) => ({ hunk, index, patch: hunks[index] }))
  .filter(item => item.hunk.classification !== 'KEEP');
const reversePatch = `${patchHeader}${removeHunks.map(item => item.patch).join('')}`;
const beforeHash = sha256(sourcePatch);
const selectiveInputPatchSha256 = sha256(patch);
fs.writeFileSync(temporaryPatchPath, reversePatch, 'utf8');
try {
  git(['apply', '--reverse', '--check', '--unidiff-zero', '--whitespace=nowarn', temporaryPatchPath]);
  git(['apply', '--reverse', '--unidiff-zero', '--whitespace=nowarn', temporaryPatchPath]);
} catch (error) {
  throw new Error(`RC6_CLEAN_BASELINE_APPLY_FAILED:${error.message}`);
}
const afterPatch = git(['-c', 'core.quotePath=false', 'diff', '--binary', '--no-ext-diff', 'HEAD', '--'], { encoding: null });
const afterDiffText = git(['-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--unified=0', 'HEAD', '--'], { encoding: 'utf8' });
const afterHunkCount = (afterDiffText.match(/^@@/gmu) || []).length;
if (afterHunkCount !== keepHunks.length) throw new Error(`RC6_CLEAN_BASELINE_KEEP_COUNT_INVALID:${afterHunkCount}`);
const outputCore = {
  schemaVersion: 'CleanBaselineResultV1',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  generatedAt: new Date().toISOString(),
  sourcePatchSha256: beforeHash,
  selectiveInputPatchSha256,
  resultingPatchSha256: sha256(afterPatch),
  originalHunkCount: ownership.hunks.length,
  resultingHunkCount: afterHunkCount,
  keptHunks: keepHunks.map(item => ({ hunkId: item.hunk.hunkId, classification: item.hunk.classification, symbol: item.hunk.symbol })),
  removedHunks: removeHunks.map(item => ({ hunkId: item.hunk.hunkId, classification: item.hunk.classification, symbol: item.hunk.symbol })),
  removedPatchArtifact: relative(temporaryPatchPath),
  verification: {
    selectiveReverseApplied: true,
    headReset: false,
    checkoutUsed: false,
    tmpTouched: false,
    formalProvider: 'r8',
    status: 'CLEAN_BASELINE_READY_FOR_KEEP_PROBES',
  },
};
const output = { ...outputCore, resultHash: sha256(JSON.stringify(outputCore)) };
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  resultHash: output.resultHash,
  originalHunkCount: output.originalHunkCount,
  resultingHunkCount: output.resultingHunkCount,
  keptHunks: output.keptHunks.map(item => item.hunkId),
  removedCount: output.removedHunks.length,
}, null, 2)}\n`);

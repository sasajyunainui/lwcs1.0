import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const baselineDir = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'baseline');
const patchPath = path.join(baselineDir, 'working-tree.patch');
const manifestPath = path.join(baselineDir, 'manifest.json');
const coreFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
];

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (args, options = {}) => execFileSync('git', args, {
  cwd: repoRoot,
  windowsHide: true,
  maxBuffer: 128 * 1024 * 1024,
  ...options,
});
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const status = git(['status', '--porcelain=v1', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .map(row => ({
    indexStatus: row.slice(0, 1),
    worktreeStatus: row.slice(1, 2),
    path: row.slice(3).replaceAll('\\', '/'),
  }));
const patch = git(['-c', 'core.quotePath=false', 'diff', '--binary', '--no-ext-diff', 'HEAD', '--', '.'], { encoding: null });
const patchHash = sha256(patch);
fs.mkdirSync(baselineDir, { recursive: true });
if (fs.existsSync(patchPath)) {
  const previous = fs.readFileSync(patchPath);
  if (!previous.equals(patch)) throw new Error('RC6_BASELINE_PATCH_CHANGED');
} else {
  fs.writeFileSync(patchPath, patch);
}

const sourceFiles = Object.fromEntries(coreFiles.map(fileName => {
  const content = fs.readFileSync(path.join(repoRoot, fileName));
  return [fileName, {
    sha256: sha256(content),
    bytes: content.length,
    lineCount: content.toString('utf8').split(/\r?\n/u).length,
  }];
}));
const diffText = git(['-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--unified=0', 'HEAD', '--', '.'], { encoding: 'utf8' });
const hunkCount = (diffText.match(/^@@/gmu) || []).length;
const untracked = status.filter(row => row.indexStatus === '?' && row.worktreeStatus === '?');
const excludedUntracked = untracked.filter(row => row.path === 'tmp' || row.path.startsWith('tmp/'));
const manifestCore = {
  schemaVersion: 'BaselineManifestV1',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  capturedAt: new Date().toISOString(),
  repository: {
    name: 'lwcs',
    branch: git(['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    status,
  },
  scope: {
    coreFiles,
    excludedPaths: ['tmp/', '_backup/', '*.bak*', '*.dsl_halfdone_*', 'tmp_*'],
    excludedUntracked,
  },
  dirtyPatch: {
    relativePath: relative(patchPath),
    sha256: patchHash,
    bytes: patch.length,
    hunkCount,
  },
  sourceFiles,
  completion: {
    baselineFrozen: true,
    hunkOwnershipComplete: false,
    cleanBaselineCreated: false,
    overallStatus: 'NOT_COMPLETE',
  },
};
const manifest = {
  ...manifestCore,
  manifestHash: sha256(JSON.stringify(manifestCore)),
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  manifestPath: relative(manifestPath),
  patchPath: relative(patchPath),
  patchHash,
  hunkCount,
  head: manifest.repository.head,
  branch: manifest.repository.branch,
  dirtyPaths: status.map(row => row.path),
}, null, 2)}\n`);

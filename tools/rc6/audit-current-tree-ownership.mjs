import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const evidenceRoot = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2');
const ownershipPath = path.join(evidenceRoot, 'current-tree-ownership-manifest.json');
const impactPath = path.join(evidenceRoot, 'current-change-impact-manifest.json');
const statusPath = path.join(repoRoot, 'tools', 'rc6', 'generated', 'current-task-status.json');
const eventDir = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'events');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const git = (args, options = {}) => execFileSync('git', args, {
  cwd: repoRoot,
  windowsHide: true,
  maxBuffer: 128 * 1024 * 1024,
  encoding: 'utf8',
  ...options,
});
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJsonAtomic = (filePath, value) => {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
};

const excluded = fileName => {
  const normalized = String(fileName || '').replaceAll('\\', '/');
  return normalized === 'tmp' || normalized.startsWith('tmp/') ||
    normalized === '_backup' || normalized.startsWith('_backup/') ||
    /\.bak[^/]*$/iu.test(normalized) ||
    /\.dsl_halfdone_[^/]*$/iu.test(normalized) ||
    normalized.split('/').some(part => part.startsWith('tmp_'));
};

// These reports are the audit's outputs. Including their previous contents in
// the next input set makes the manifest hash self-referential and unstable.
const reconciliationOutputs = new Set([
  'tools/rc6/evidence/m2/current-tree-ownership-manifest.json',
  'tools/rc6/evidence/m2/current-change-impact-manifest.json',
  'tools/rc6/evidence/m2/current-direction-audit.json',
]);
const isAuditOutput = fileName => {
  const normalized = fileName.replaceAll('\\', '/');
  return reconciliationOutputs.has(normalized) ||
    normalized.startsWith('tools/rc6/evidence/events/');
};

const modifiedTracked = git([
  '-c', 'core.quotePath=false', 'diff', '--name-only', 'HEAD', '--',
]).split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
const untracked = git([
  '-c', 'core.quotePath=false', 'ls-files', '--others', '--exclude-standard',
]).split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
const paths = [...new Set([...modifiedTracked, ...untracked])]
  .filter(fileName => !excluded(fileName) && !isAuditOutput(fileName))
  .sort();
const modifiedSet = new Set(modifiedTracked);
const untrackedSet = new Set(untracked);

const sourceStatus = fs.existsSync(statusPath) ? readJson(statusPath) : {};
const eventFiles = fs.existsSync(eventDir)
  ? fs.readdirSync(eventDir)
    .filter(fileName => /^\d{6}-[a-f0-9]{64}\.json$/u.test(fileName))
    .sort()
  : [];
const events = eventFiles.map(fileName => readJson(path.join(eventDir, fileName)));
const m1Completion = [...events].reverse().find(event =>
  event.milestoneId === 'M1' &&
  event.eventType === 'MILESTONE_COMPLETED' &&
  event.status === 'COMPLETED',
) || null;
const m1Hashes = Object.fromEntries([
  ...Object.entries(m1Completion?.toolHashes || {}),
  ...Object.entries(m1Completion?.fixtureHashes || {}),
]);

const m2AllowedProduction = new Set([
  'BattleDecisionR9v2Kernel_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
]);
const coreProduction = new Set([
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleDecisionR9v2Kernel_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
]);

const currentHash = fileName => {
  const absolutePath = path.join(repoRoot, fileName);
  return fs.existsSync(absolutePath)
    ? sha256(fs.readFileSync(absolutePath))
    : null;
};
const headHash = fileName => {
  if (untrackedSet.has(fileName)) return null;
  try {
    return sha256(execFileSync('git', ['show', `HEAD:${fileName}`], {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 128 * 1024 * 1024,
      encoding: null,
    }));
  } catch {
    return null;
  }
};
const hunkCount = fileName => {
  if (!modifiedSet.has(fileName)) return 0;
  const diff = git([
    '-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--unified=0', 'HEAD', '--', fileName,
  ]);
  return (diff.match(/^@@/gmu) || []).length;
};

const classify = fileName => {
  const normalized = fileName.replaceAll('\\', '/');
  if (normalized.startsWith('tools/rc6/evidence/events/')) {
    return ['EVIDENCE_EVENT_CHAIN', 'NO_RUNTIME_IMPACT'];
  }
  if (normalized === 'tools/rc6/evidence/m2/current-tree-ownership-manifest.json' ||
      normalized === 'tools/rc6/evidence/m2/current-change-impact-manifest.json' ||
      normalized === 'tools/rc6/evidence/m2/current-direction-audit.json') {
    return ['CURRENT_RECONCILIATION_ARTIFACT', 'M2_EVIDENCE_ONLY'];
  }
  if (normalized.startsWith('tools/rc6/evidence/m3/') ||
      normalized.startsWith('tools/rc6/evidence/m4/') ||
      normalized.startsWith('tools/rc6/evidence/m5/') ||
      /tools\/rc6\/harness\/run-m[345]-/iu.test(normalized)) {
    return ['UNACCEPTED_DOWNSTREAM_EVIDENCE', 'QUARANTINE_NO_ACCEPTANCE'];
  }
  if (coreProduction.has(normalized)) {
    return m2AllowedProduction.has(normalized)
      ? ['M2_ALLOWED_PRODUCTION', 'RERUN_AFFECTED_M2']
      : ['OUT_OF_SCOPE_PRODUCTION', 'BLOCK_M2_ACCEPTANCE_UNTIL_CLASSIFIED'];
  }
  if (normalized.startsWith('tools/rc6/harness/')) {
    return /run-m[12]-|kernel-incremental|production-reference|reference-ab/iu.test(normalized)
      ? ['M2_TOOL_OR_FIXTURE', 'RERUN_OR_REVIEW_M2']
      : ['UNACCEPTED_FUTURE_TOOL', 'QUARANTINE_NO_ACCEPTANCE'];
  }
  if (normalized.startsWith('tools/rc6/cases/') || normalized.startsWith('tools/rc6/contracts/') ||
      normalized.startsWith('tools/rc6/reference/')) {
    const hash = currentHash(normalized);
    if (m1Hashes[normalized] && hash === m1Hashes[normalized]) {
      return ['M1_ACCEPTED_CURRENT_HASH', 'NO_M1_INVALIDATION'];
    }
    return ['M2_OR_FUTURE_FIXTURE', 'REVIEW_BEFORE_M2_ACCEPTANCE'];
  }
  if (normalized === 'tools/rc6/record-evidence-event.mjs' ||
      normalized === 'tools/rc6/reduce-status.mjs' ||
      normalized.startsWith('tools/rc6/audit-') ||
      normalized.startsWith('tools/rc6/verify-')) {
    return ['RC6_CONTROL_TOOL', 'STATIC_CONTROL_REVIEW'];
  }
  if (normalized.startsWith('tools/rc6/evidence/')) {
    return ['M2_OR_FUTURE_EVIDENCE', 'REVIEW_BEFORE_ACCEPTANCE'];
  }
  return ['UNASSIGNED', 'FULL_REVIEW_REQUIRED'];
};

const files = paths.map(fileName => {
  const [classification, impact] = classify(fileName);
  return {
    path: fileName,
    status: modifiedSet.has(fileName) && untrackedSet.has(fileName)
      ? 'MODIFIED_AND_UNTRACKED'
      : modifiedSet.has(fileName)
        ? 'MODIFIED_TRACKED'
        : 'UNTRACKED',
    headHash: headHash(fileName),
    currentHash: currentHash(fileName),
    hunkCount: hunkCount(fileName),
    classification,
    impact,
  };
});
const counts = files.reduce((result, file) => {
  result[file.classification] = (result[file.classification] || 0) + 1;
  return result;
}, {});
const unassigned = files.filter(file => file.classification === 'UNASSIGNED');
const outOfScopeProduction = files.filter(file => file.classification === 'OUT_OF_SCOPE_PRODUCTION');

const ownershipCore = {
  schemaVersion: 'PatchOwnershipManifestV2',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  repository: {
    branch: git(['branch', '--show-current']).trim(),
    head: git(['rev-parse', 'HEAD']).trim(),
  },
  task: {
    milestoneId: sourceStatus.currentMilestone || 'M2',
    taskId: sourceStatus.currentTask || 'M2-K12-CURRENT-HASH-ADAPTER-AUDIT',
    formalProvider: sourceStatus.formalProvider || 'r8',
    targetProvider: sourceStatus.targetProvider || 'r9v2',
  },
  currentWorkingTreePatchHash: sha256(execFileSync('git', [
    '-c', 'core.quotePath=false', 'diff', '--binary', '--no-ext-diff', 'HEAD', '--',
  ], { cwd: repoRoot, windowsHide: true, maxBuffer: 128 * 1024 * 1024 })),
  excludedPaths: ['tmp/', '_backup/', '*.bak*', '*.dsl_halfdone_*', 'tmp_*'],
  m1CompletionEvent: m1Completion?.eventHash || null,
  sourceHashes: sourceStatus.sourceHashes || {},
  summary: {
    pathCount: files.length,
    allPathsClassified: unassigned.length === 0,
    unassignedCount: unassigned.length,
    outOfScopeProductionCount: outOfScopeProduction.length,
    classificationCounts: counts,
    m2AcceptanceReady: unassigned.length === 0 && outOfScopeProduction.length === 0,
  },
  files,
};
const ownership = {
  ...ownershipCore,
  manifestHash: sha256(JSON.stringify(ownershipCore)),
};

const impactCore = {
  schemaVersion: 'ChangeImpactManifestV1',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  repository: ownership.repository,
  ownershipManifestHash: ownership.manifestHash,
  rules: {
    m1HashMatch: 'M1 evidence may be inherited only when tool/fixture hash matches the M1 completion event.',
    m2Production: 'M2 evidence is limited to the target kernel, Decision adapter, Runtime audit validation and M2 tools.',
    downstream: 'M3-M5 objects are quarantined until their own milestone event accepts them.',
    outOfScopeProduction: 'Any current production file outside the M2 write set blocks M2 acceptance until classified.',
  },
  impacts: files.map(file => ({
    path: file.path,
    classification: file.classification,
    impact: file.impact,
    rerunScope: file.classification === 'M2_ALLOWED_PRODUCTION'
      ? ['K12_FULL_FIELD_LEVEL_AB', 'AFFECTED_M2_CHECKS']
      : file.classification === 'OUT_OF_SCOPE_PRODUCTION'
        ? ['OWNERSHIP_RECONCILIATION_REQUIRED']
        : file.classification === 'M1_ACCEPTED_CURRENT_HASH'
          ? []
          : file.classification === 'UNACCEPTED_DOWNSTREAM_EVIDENCE'
            ? ['NO_CURRENT_ACCEPTANCE']
            : ['REVIEW_AS_NEEDED'],
  })),
  exit: {
    ownershipReconciliationClosed: unassigned.length === 0,
    m2ProductionWriteSetClosed: outOfScopeProduction.length === 0,
    status: unassigned.length === 0 && outOfScopeProduction.length === 0
      ? 'READY_FOR_K12'
      : 'BLOCKED_PENDING_CURRENT_TREE_CLASSIFICATION',
  },
};
const impact = {
  ...impactCore,
  manifestHash: sha256(JSON.stringify(impactCore)),
};

writeJsonAtomic(ownershipPath, ownership);
writeJsonAtomic(impactPath, impact);
process.stdout.write(`${JSON.stringify({
  ownershipPath: relative(ownershipPath),
  impactPath: relative(impactPath),
  ownershipHash: ownership.manifestHash,
  impactHash: impact.manifestHash,
  pathCount: files.length,
  classificationCounts: counts,
  m2AcceptanceReady: ownership.summary.m2AcceptanceReady,
}, null, 2)}\n`);

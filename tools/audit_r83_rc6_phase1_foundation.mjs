import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  clone,
  executeFormalTransaction,
  loadBattleSandbox,
  repoRoot,
  sha256,
  sourceHashes,
} from './r83_rc6_battle_harness.mjs';
import {
  readArtifact,
  writeArtifact,
  writeArtifactIndex,
} from './r83_rc6_evidence_store.mjs';
import { classifyChangeImpact } from './r83_rc6_change_impact.mjs';

const fixtureRoot = path.resolve(
  repoRoot,
  process.argv[2] ||
    'tools/evidence/r8/r83_rc6_decision_replay',
);
const indexPath = path.join(fixtureRoot, 'index.json');
const outputPath = path.resolve(
  repoRoot,
  process.argv[3] ||
    'tools/evidence/r8/r83_rc6_phase1_foundation_audit_2026-07-29.json',
);
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const sandbox = loadBattleSandbox();
const failures = [];
const replayResults = [];

function check(condition, code, details = undefined) {
  if (!condition) failures.push({ code, details });
}

function currentRows(decisions = []) {
  return decisions.map((decision, decisionIndex) => ({
    decisionIndex,
    round: Number(decision?.round || 0),
    actorId: String(decision?.actorId || '').trim(),
    actionRole: String(decision?.actionRole || '').trim().toUpperCase(),
    opportunityId: String(decision?.opportunityId || '').trim(),
    selectedCandidateId: String(decision?.selected?.candidateId || '').trim(),
    selectedActionKind: String(
      decision?.selected?.declaration?.actionKind || '',
    ).trim().toUpperCase(),
    lostOpportunityCode: String(
      decision?.lostOpportunity?.reasonCode || '',
    ).trim(),
    replayIdentity: clone(decision?.decisionProfile?.replayIdentity || null),
    decisionAuditHash: sha256(decision),
  }));
}

for (const entry of index.entries || []) {
  const fixture = readArtifact(fixtureRoot, entry.fixtureRef);
  const input = readArtifact(fixtureRoot, fixture.inputRef);
  const transaction = executeFormalTransaction(sandbox, input);
  const decisions = clone(transaction.draft.decisionAudit || []);
  const actual = {
    draftHash: String(transaction.draft.draftHash || ''),
    ledgerHash: sha256(transaction.draft.ledger || []),
    terminalHash: sha256(transaction.draft.terminalResult || {}),
    finalSnapshotHash: sha256(transaction.draft.finalSnapshot || {}),
    reportHash: String(transaction.sealedPackage.reportHash || ''),
    reportExplanationHash: sha256(
      transaction.reportDto.narrativeChain || {},
    ),
    decisionAuditHash: sha256(decisions),
    decisionRows: currentRows(decisions),
  };
  const expected = fixture.expected;
  const comparisons = Object.fromEntries(
    [
      'draftHash',
      'ledgerHash',
      'terminalHash',
      'finalSnapshotHash',
      'reportHash',
      'reportExplanationHash',
      'decisionAuditHash',
      'decisionRows',
    ].map(key => [
      key,
      JSON.stringify(actual[key]) === JSON.stringify(expected[key]),
    ]),
  );
  check(
    Object.values(comparisons).every(Boolean),
    'REPLAY_FULL_HASH_MISMATCH',
    { caseId: fixture.caseId, comparisons },
  );
  replayResults.push({
    caseId: fixture.caseId,
    unitCount: fixture.unitCount,
    decisionCount: decisions.length,
    comparisons,
  });
}

const firstFixture = readArtifact(
  fixtureRoot,
  index.entries[0].fixtureRef,
);
const defaultInput = readArtifact(
  fixtureRoot,
  firstFixture.inputRef,
);
delete defaultInput.settings.collectDecisionReplayIdentity;
const defaultTransaction = executeFormalTransaction(
  loadBattleSandbox(),
  defaultInput,
);
check(
  (defaultTransaction.draft.decisionAudit || []).every(decision =>
    decision?.decisionProfile?.replayIdentity == null
  ),
  'REPLAY_IDENTITY_LEAKED_INTO_DEFAULT_PATH',
);
const baselineSandbox = loadBattleSandbox({
  sourceOverrides: Object.fromEntries(
    [
      'BattleDecision_Module.js',
      'BattleRuntime_Module.js',
    ].map(fileName => [
      fileName,
      execFileSync('git', ['show', `HEAD:${fileName}`], {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      }),
    ]),
  ),
});
const baselineTransaction = executeFormalTransaction(
  baselineSandbox,
  defaultInput,
);
const defaultPathEquivalence = {
  draftHash:
    defaultTransaction.draft.draftHash ===
      baselineTransaction.draft.draftHash,
  ledgerHash:
    sha256(defaultTransaction.draft.ledger || []) ===
      sha256(baselineTransaction.draft.ledger || []),
  terminalHash:
    sha256(defaultTransaction.draft.terminalResult || {}) ===
      sha256(baselineTransaction.draft.terminalResult || {}),
  finalSnapshotHash:
    sha256(defaultTransaction.draft.finalSnapshot || {}) ===
      sha256(baselineTransaction.draft.finalSnapshot || {}),
  reportHash:
    defaultTransaction.sealedPackage.reportHash ===
      baselineTransaction.sealedPackage.reportHash,
};
check(
  Object.values(defaultPathEquivalence).every(Boolean),
  'DEFAULT_PATH_BASELINE_HASH_MISMATCH',
  defaultPathEquivalence,
);

const duplicateProbe = { schemaVersion: 'ArtifactDedupProbeV1', value: 1 };
const firstProbeRef = writeArtifact(
  fixtureRoot,
  'ARTIFACT_DEDUP_PROBE',
  duplicateProbe,
);
const secondProbeRef = writeArtifact(
  fixtureRoot,
  'ARTIFACT_DEDUP_PROBE',
  duplicateProbe,
);
check(
  firstProbeRef.contentHash === secondProbeRef.contentHash &&
    firstProbeRef.relativePath === secondProbeRef.relativePath,
  'EVIDENCE_CONTENT_ADDRESS_DEDUP_FAILED',
);

const unitCounts = index.entries.map(entry => Number(entry.unitCount || 0));
check(
  unitCounts.filter(value => value === 2).length === 2 &&
    unitCounts.filter(value => value === 6).length === 2 &&
    unitCounts.filter(value => value === 14).length === 2,
  'REPLAY_SCALE_SET_INVALID',
  unitCounts,
);
const observedRoles = new Set(
  index.entries.flatMap(entry => entry.observedRoles || []),
);
const requiredRoles = ['ACTIVE', 'REACTION', 'COUNTER', 'PASS', 'LOST'];
check(
  requiredRoles.every(role => observedRoles.has(role)),
  'REPLAY_ROLE_COVERAGE_MISSING',
  {
    observed: [...observedRoles].sort(),
    missing: requiredRoles.filter(role => !observedRoles.has(role)),
  },
);

const unknownImpact = classifyChangeImpact(['UnmappedBattleKernel.js']);
check(
  unknownImpact.failClosed === true &&
    unknownImpact.requiredScopes.includes('FULL_REGRESSION') &&
    unknownImpact.fatalCodes.includes('CHANGE_IMPACT_UNSCOPED'),
  'CHANGE_IMPACT_FAIL_CLOSED_INVALID',
  unknownImpact,
);
const reportImpact = classifyChangeImpact(['BattleReport_Module.js']);
check(
  reportImpact.failClosed === false &&
    reportImpact.requiredScopes.includes('REPORT_PROJECTION') &&
    !reportImpact.requiredScopes.includes('FULL_REGRESSION'),
  'CHANGE_IMPACT_REPORT_SCOPE_INVALID',
  reportImpact,
);

const oracleRun = spawnSync(
  process.execPath,
  [path.join(repoRoot, 'tools/audit_battle_r83_phase7.mjs')],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 512 * 1024 * 1024,
    timeout: 300000,
  },
);
let oracleSummary = null;
try {
  oracleSummary = JSON.parse(oracleRun.stdout || '{}').summary || null;
} catch {
  oracleSummary = null;
}
check(
  oracleRun.status === 0 &&
    oracleSummary?.failedCount === 0 &&
    oracleSummary?.executableContractCount === 54,
  'BEHAVIOR_ORACLE_FOUNDATION_FAILED',
  {
    exitCode: oracleRun.status,
    summary: oracleSummary,
    stderr: String(oracleRun.stderr || '').slice(0, 2000),
  },
);

const sourceHashMatches = Object.entries(index.sourceHashes || {}).every(
  ([fileName, expectedHash]) =>
    sourceHashes([fileName])[fileName] === expectedHash,
);
check(sourceHashMatches, 'REPLAY_SOURCE_HASH_MISMATCH');
check(index.fixtureCount === 6, 'REPLAY_FIXTURE_COUNT_INVALID');

const audit = {
  schemaVersion: 'RC6Phase1FoundationAuditV1',
  generatedAt: new Date().toISOString(),
  fixtureIndexHash: sha256(fs.readFileSync(indexPath, 'utf8')),
  sourceHashes: sourceHashes(),
  replayResults,
  observedRoles: [...observedRoles].sort(),
  changeImpactChecks: {
    unknownImpact,
    reportImpact,
  },
  defaultPath: {
    replayIdentityComputed: false,
    baselineEquivalence: defaultPathEquivalence,
  },
  contentAddressing: {
    duplicateProbeHash: firstProbeRef.contentHash,
    duplicateProbePath: firstProbeRef.relativePath,
    deduplicated: true,
  },
  oracleFoundation: {
    schemaVersion: 'BehaviorOracleV2',
    executableContractCount:
      Number(oracleSummary?.executableContractCount || 0),
    checkCount: Number(oracleSummary?.checkCount || 0),
    failedCount: Number(oracleSummary?.failedCount || 0),
    authorityGate: 'tools/audit_battle_r83_phase7.mjs',
  },
  status: failures.length ? 'FAILED' : 'PASSED',
  failures,
};
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
writeArtifactIndex(
  path.join(fixtureRoot, 'audit-index.json'),
  {
    generatedAt: audit.generatedAt,
    sourceHashes: audit.sourceHashes,
    auditPath: path.relative(fixtureRoot, outputPath).replaceAll('\\', '/'),
    auditHash: sha256(fs.readFileSync(outputPath, 'utf8')),
    status: audit.status,
  },
);
process.stdout.write(`${JSON.stringify({
  outputPath,
  status: audit.status,
  fixtureCount: replayResults.length,
  observedRoles: audit.observedRoles,
  failures,
}, null, 2)}\n`);
if (failures.length) process.exitCode = 1;

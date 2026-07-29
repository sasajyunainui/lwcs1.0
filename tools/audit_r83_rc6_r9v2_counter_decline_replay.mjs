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
import { readArtifact } from './r83_rc6_evidence_store.mjs';

const fixtureRoot = path.resolve(
  repoRoot,
  'tools/evidence/r8/r83_rc6_decision_replay',
);
const outputPath = path.resolve(
  repoRoot,
  'tools/evidence/r8/r83_rc6_r9v2_counter_decline_replay_audit_2026-07-29.json',
);
const indexPath = path.join(fixtureRoot, 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const sandbox = loadBattleSandbox();

function decisionRow(decision = {}, decisionIndex = 0) {
  return {
    decisionIndex,
    actionRole: String(decision?.actionRole || '').trim().toUpperCase(),
    selectedCandidateId: String(
      decision?.selected?.candidateId || '',
    ).trim(),
    replayIdentity: clone(
      decision?.decisionProfile?.replayIdentity || null,
    ),
  };
}

function stableIdentityComparison(actual = {}, expected = {}) {
  return {
    selectedCandidateId:
      actual.selectedCandidateId === expected.selectedCandidateId,
    actionRole: actual.actionRole === expected.actionRole,
    candidateHash:
      actual.replayIdentity?.candidateHash ===
        expected.replayIdentity?.candidateHash,
    mechanicalFactsHash:
      actual.replayIdentity?.mechanicalFactsHash ===
        expected.replayIdentity?.mechanicalFactsHash,
    candidateValueProofHash:
      actual.replayIdentity?.candidateValueProofHash ===
        expected.replayIdentity?.candidateValueProofHash,
    paretoHash:
      actual.replayIdentity?.paretoHash ===
        expected.replayIdentity?.paretoHash,
  };
}

const results = [];
for (const entry of index.entries || []) {
  const fixture = readArtifact(fixtureRoot, entry.fixtureRef);
  const input = readArtifact(fixtureRoot, fixture.inputRef);
  const transaction = executeFormalTransaction(sandbox, input);
  const decisions = clone(transaction.draft.decisionAudit || []);
  const actualRows = decisions.map(decisionRow);
  const expectedRows = fixture.expected?.decisionRows || [];
  const comparisons = actualRows.map((row, decisionIndex) => ({
    decisionIndex,
    ...stableIdentityComparison(row, expectedRows[decisionIndex] || {}),
  }));
  const mismatches = comparisons.filter(row =>
    Object.entries(row).some(([key, value]) =>
      key !== 'decisionIndex' && value !== true
    )
  );
  const positiveCounters = decisions.filter(decision =>
    String(decision?.actionRole || '').trim().toUpperCase() === 'COUNTER' &&
    decision?.selected?.counterDeclineFallback !== true &&
    Number(decision?.selected?.objectiveUtilityHEPP || 0) > 0
  );
  results.push({
    caseId: fixture.caseId,
    unitCount: fixture.unitCount,
    decisionCount: decisions.length,
    stableIdentityMismatchCount: mismatches.length,
    firstStableIdentityMismatch: mismatches[0] || null,
    ledgerHashEqual:
      sha256(transaction.draft.ledger || []) ===
        fixture.expected.ledgerHash,
    terminalHashEqual:
      sha256(transaction.draft.terminalResult || {}) ===
        fixture.expected.terminalHash,
    finalSnapshotHashEqual:
      sha256(transaction.draft.finalSnapshot || {}) ===
        fixture.expected.finalSnapshotHash,
    positiveCounterCount: positiveCounters.length,
    selectedCounterDeclineCount: decisions.filter(decision =>
      decision?.selected?.counterDeclineFallback === true
    ).length,
  });
}

const passed = results.every(result =>
  result.stableIdentityMismatchCount === 0 &&
  result.ledgerHashEqual &&
  result.terminalHashEqual &&
  result.finalSnapshotHashEqual &&
  result.selectedCounterDeclineCount === 0
) &&
  results.reduce(
    (sum, result) => sum + result.positiveCounterCount,
    0,
  ) === 48;
const audit = {
  schemaVersion: 'R83RC6R9v2CounterDeclineReplayAuditV1',
  generatedAt: new Date().toISOString(),
  fixtureIndexHash: sha256(fs.readFileSync(indexPath, 'utf8')),
  sourceHashes: sourceHashes(),
  fixtureCount: results.length,
  totalPositiveCounterCount: results.reduce(
    (sum, result) => sum + result.positiveCounterCount,
    0,
  ),
  results,
  status: passed ? 'PASSED' : 'FAILED',
};
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify({
  outputPath,
  status: audit.status,
  fixtureCount: audit.fixtureCount,
  totalPositiveCounterCount: audit.totalPositiveCounterCount,
  failures: results.filter(result =>
    result.stableIdentityMismatchCount > 0 ||
    !result.ledgerHashEqual ||
    !result.terminalHashEqual ||
    !result.finalSnapshotHashEqual ||
    result.selectedCounterDeclineCount > 0
  ),
}, null, 2)}\n`);
if (!passed) process.exitCode = 1;

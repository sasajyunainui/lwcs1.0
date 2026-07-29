import fs from 'node:fs';
import path from 'node:path';
import {
  clone,
  executeFormalTransaction,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
  repoRoot,
  sha256,
  sourceHashes,
} from './r83_rc6_battle_harness.mjs';
import {
  writeArtifact,
  writeArtifactIndex,
} from './r83_rc6_evidence_store.mjs';

const fixtureRoot = path.resolve(
  repoRoot,
  process.argv[2] ||
    'tools/evidence/r8/r83_rc6_decision_replay',
);
const caseIds = Object.freeze([
  'duel_agile_counter_options',
  'duel_charge_defense_safer',
  'team_control_overlap',
  'team_counter_coordination',
  'raid_control_heavy',
  'raid_balanced',
]);

function replayRows(decisions = []) {
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

function observedRoles(rows, ledger = []) {
  const roles = new Set(rows.map(row => row.actionRole).filter(Boolean));
  if (rows.some(row =>
    ['PASS', 'PASS_OPPORTUNITY'].includes(row.selectedActionKind)
  )) roles.add('PASS');
  if (
    rows.some(row => row.lostOpportunityCode) ||
    ledger.some(event =>
      String(event?.eventKind || '').trim() === 'blocked_action' &&
      String(event?.meta?.reasonCode || '').trim() ===
        'CONTROLLED_BEFORE_OPPORTUNITY'
    )
  ) roles.add('LOST');
  return [...roles].sort();
}

const sandbox = loadBattleSandbox();
const cases = manualCasesById(sandbox);
const entries = [];
for (const caseId of caseIds) {
  const caseDefinition = cases.get(caseId);
  if (!caseDefinition) throw new Error(`REPLAY_CASE_MISSING:${caseId}`);
  process.stderr.write(`[rc6-replay-build] ${caseId}\n`);
  const input = formalInput(caseDefinition);
  if (caseId === 'duel_charge_defense_safer') {
    const actor = input.combatData?.参战者?.team_player?.[0];
    actor.状态效果 = {
      ...(actor?.状态效果 || {}),
      rc6_replay_stun: {
        状态: '眩晕',
        状态名称: '眩晕',
        类型: 'debuff',
        duration: 2,
        持续回合: 2,
        战斗效果: {
          skip_turn: true,
          cannot_act: true,
          cannot_react: true,
        },
      },
    };
    input.caseId = 'duel_charge_defense_safer__lost_opportunity';
  }
  const transaction = executeFormalTransaction(sandbox, input);
  const decisions = clone(transaction.draft.decisionAudit || []);
  const rows = replayRows(decisions);
  const fullDraftRef = writeArtifact(
    fixtureRoot,
    'FULL_DRAFT',
    clone(transaction.draft),
  );
  const reportRef = writeArtifact(
    fixtureRoot,
    'FULL_REPORT_DTO',
    clone(transaction.reportDto),
  );
  const inputRef = writeArtifact(fixtureRoot, 'BATTLE_INPUT', input);
  const fixture = {
    schemaVersion: 'DecisionReplayFixtureV1',
    caseId: input.caseId,
    sourceCaseId: caseId,
    providerId: 'r9v2-shadow',
    unitCount: sandbox.__LWCS_BATTLE_PREVIEW__.listUnits(
      caseDefinition.combatData,
    ).length,
    rounds: caseDefinition.rounds,
    inputRef,
    fullDraftRef,
    reportRef,
    expected: {
      draftHash: String(transaction.draft.draftHash || ''),
      ledgerHash: sha256(transaction.draft.ledger || []),
      terminalHash: sha256(transaction.draft.terminalResult || {}),
      finalSnapshotHash: sha256(transaction.draft.finalSnapshot || {}),
      reportHash: String(transaction.sealedPackage.reportHash || ''),
      reportExplanationHash: sha256(
        transaction.reportDto.narrativeChain || {},
      ),
      decisionAuditHash: sha256(decisions),
      decisionRows: rows,
      observedRoles: observedRoles(rows, transaction.draft.ledger || []),
    },
  };
  const fixtureRef = writeArtifact(
    fixtureRoot,
    'DECISION_REPLAY_FIXTURE',
    fixture,
  );
  entries.push({
    caseId: fixture.caseId,
    sourceCaseId: fixture.sourceCaseId,
    unitCount: fixture.unitCount,
    rounds: fixture.rounds,
    fixtureRef,
    inputRef,
    fullDraftRef,
    reportRef,
    observedRoles: fixture.expected.observedRoles,
  });
}

const indexPath = path.join(fixtureRoot, 'index.json');
const index = writeArtifactIndex(indexPath, {
  generatedAt: new Date().toISOString(),
  providerId: 'r9v2-shadow',
  sourceHashes: sourceHashes(),
  fixtureCount: entries.length,
  entries,
});
process.stdout.write(`${JSON.stringify({
  indexPath,
  fixtureCount: index.fixtureCount,
  observedRoles: [...new Set(entries.flatMap(entry => entry.observedRoles))].sort(),
  entries: entries.map(entry => ({
    caseId: entry.caseId,
    unitCount: entry.unitCount,
    fixtureHash: entry.fixtureRef.contentHash,
  })),
}, null, 2)}\n`);

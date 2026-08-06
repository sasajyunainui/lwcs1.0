import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  executeFormalTransaction,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'small-target-transactions.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const stringValue = value => String(value ?? '').trim();
const targetRegistryMarker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";
const targetDecisionSource = () => {
  const source = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
  if (source.includes(targetRegistryLine)) return source;
  const patched = source.replace(
    targetRegistryMarker,
    `${targetRegistryMarker}\n${targetRegistryLine}`,
  );
  if (patched === source) throw new Error('M2_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
};

const caseIds = [
  'duel_overmatch_lethal',
  'duel_peer_unknown_probe',
  'team_focus_without_overkill',
  'team_control_overlap',
];
const rows = [];
for (const caseId of caseIds) {
  const sandbox = loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: { 'BattleDecision_Module.js': targetDecisionSource() },
  });
  const definition = manualCasesById(sandbox).get(caseId);
  if (!definition) throw new Error(`M2_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.settings = {
    ...input.settings,
    r9v2InformationValueOnly: true,
  };
  const start = performance.now();
  try {
    const result = executeFormalTransaction(sandbox, input);
    const draft = result.draft || {};
    const reportDto = result.reportAudit?.reportDto || result.reportDto || {};
    const decisions = Array.isArray(draft.decisions)
      ? draft.decisions
      : Array.isArray(draft.decisionJournal)
        ? draft.decisionJournal
        : Array.isArray(draft.decisionAudit)
          ? draft.decisionAudit
        : [];
    const targetDecisions = decisions.filter(decision =>
      decision?.decisionEngine === 'R9V2_TARGET' &&
      decision?.decisionProfile?.slice === 'TARGET_KERNEL_V2',
    );
    if (!targetDecisions.length) {
      throw new Error('M2_TARGET_DECISION_NOT_EXECUTED');
    }
    rows.push({
      caseId,
      actorCount: (
        (input.combatData?.参战者?.team_player || []).length +
        (input.combatData?.参战者?.team_enemy || []).length
      ),
      decisionCount: decisions.length,
      targetDecisionCount: targetDecisions.length,
      targetKernelDecisionCount: targetDecisions.filter(decision =>
        decision?.decisionProfile?.selectionMode === 'R9V2_TARGET_KERNEL_PARETO',
      ).length,
      reportProjectionStatus: stringValue(reportDto.projectionStatus),
      reportAuditPassed: result.reportAudit?.passed === true,
      sealed: Boolean(result.sealedPackage),
      verified: true,
      elapsedMs: Number((performance.now() - start).toFixed(3)),
      draftHash: sha256(JSON.stringify(draft)),
      reportHash: sha256(JSON.stringify(reportDto)),
      sealedHash: sha256(JSON.stringify(result.sealedPackage)),
    });
  } catch (error) {
    rows.push({
      caseId,
      status: 'FAILED',
      firstError: String(error?.message || error),
      elapsedMs: Number((performance.now() - start).toFixed(3)),
    });
  }
}

const failures = rows.filter(row => row.status === 'FAILED');
const output = {
  schemaVersion: 'M2SmallTargetTransactionsV1',
  status: failures.length ? 'FAILED' : 'PASSED',
  formalProvider: 'r8',
  isolatedTargetProvider: 'r9v2',
  caseCount: rows.length,
  oneVsOneCount: rows.filter(row => row.actorCount === 2).length,
  threeVsThreeCount: rows.filter(row => row.actorCount === 6).length,
  rows,
  failures,
  sourceHashes: {
    'BattleDecision_Module.js': sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
    'BattleDecisionR9v2Kernel_Module.js': sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
  },
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (failures.length) process.exitCode = 1;

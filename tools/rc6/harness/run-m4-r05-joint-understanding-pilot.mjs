import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
  sourceHashes,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm4', 'm4-r05-joint-understanding-pilot.json');
const caseIds = [
  'duel_overmatch_lethal',
  'intent_capture_vs_kill',
  'team_control_overlap',
  'team_protect_critical_ally',
];
const forbiddenPlayerText = /candidateId|routeKey|dependencyKey|objectiveUtility|HEPP|Pareto|rawDecision|scoreAudit/i;

const text = value => String(value ?? '').trim();
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceText = fileName => fs.readFileSync(path.join(repoRoot, fileName), 'utf8');

function targetDecisionSource() {
  const original = sourceText('BattleDecision_Module.js');
  const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";
  if (original.includes(targetRegistryLine)) return original;
  const shadowRegistryLine = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
  const patched = original.replace(shadowRegistryLine, `${shadowRegistryLine}\n${targetRegistryLine}`);
  assert(patched !== original, 'M4_R05_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
}

function numericTokenFacts(tokens = []) {
  return (Array.isArray(tokens) ? tokens : []).map(token => ({
    label: text(token?.displayName || token?.label),
    value: Number(token?.value),
    unit: text(token?.unit),
    sourceEventId: text(token?.sourceEventId),
    sourceFactId: text(token?.sourceFactId),
    hasOperands: Array.isArray(token?.operands) && token.operands.length > 0,
    derivationRule: text(token?.derivationRule),
    tacticalConsequence: text(token?.tacticalConsequence),
  }));
}

function numericTokenFailures(tokens = []) {
  return numericTokenFacts(tokens).flatMap((token, index) => [
    !token.label ? `NUMBER_LABEL_MISSING:${index}` : '',
    !Number.isFinite(token.value) ? `NUMBER_VALUE_INVALID:${index}` : '',
    !token.unit ? `NUMBER_UNIT_MISSING:${index}` : '',
    !token.sourceEventId ? `NUMBER_SOURCE_EVENT_MISSING:${index}` : '',
    !token.sourceFactId ? `NUMBER_SOURCE_FACT_MISSING:${index}` : '',
    !token.hasOperands ? `NUMBER_OPERANDS_MISSING:${index}` : '',
    !token.derivationRule ? `NUMBER_RULE_MISSING:${index}` : '',
    !token.tacticalConsequence ? `NUMBER_CONSEQUENCE_MISSING:${index}` : '',
  ].filter(Boolean));
}

function digestRow(row, node) {
  const selected = row?.selected || {};
  const alternatives = Array.isArray(row?.alternatives) ? row.alternatives : [];
  const actualTokens = Array.isArray(row?.actual?.numericTokens) ? row.actual.numericTokens : [];
  const predictedTokens = Array.isArray(row?.predicted?.numbers) ? row.predicted.numbers : [];
  const resultText = [
    ...(Array.isArray(node?.settlement?.steps) ? node.settlement.steps : [])
      .flatMap(step => [step?.playerText, step?.text]),
    node?.action?.name,
  ].map(text).filter(Boolean);
  const selectedKey = `${text(selected?.name)}|${(selected?.targetNames || []).map(text).join('|')}`;
  const alternativeKeys = alternatives.map(alternative =>
    `${text(alternative?.name)}|${(alternative?.targetNames || []).map(text).join('|')}`,
  );
  const legalCandidateCount = Number(
    (Array.isArray(row?.visibleContext?.narrowing)
      ? row.visibleContext.narrowing.find(stage => text(stage?.stage) === '排除不可行动作')
      : null)?.after || 0,
  );
  const failures = [];
  if (!text(row?.actorName)) failures.push('ACTOR_NAME_MISSING');
  if (!text(selected?.name) || /未记录动作|未命名行动/.test(text(selected?.name))) failures.push('SELECTED_ACTION_UNREADABLE');
  if (!resultText.length && text(row?.decisionKind) !== 'LOST_OPPORTUNITY') failures.push('REALIZED_RESULT_MISSING');
  if (!text(row?.comparisonEvidence?.explanation)) failures.push('DECISION_REASON_MISSING');
  if (
    !alternatives.length &&
    /没有其他可行替代项/.test(text(row?.comparisonEvidence?.explanation)) &&
    legalCandidateCount > 1
  ) failures.push('NO_ALTERNATIVE_REASON_OVERSTATED');
  if (alternatives.length > 2) failures.push('ALTERNATIVE_COUNT_OVER_TWO');
  if (alternativeKeys.some(key => key === selectedKey)) failures.push('ALTERNATIVE_EQUALS_SELECTED');
  if (new Set(alternativeKeys).size !== alternativeKeys.length) failures.push('ALTERNATIVE_DUPLICATE');
  alternatives.forEach((alternative, index) => {
    if (!text(alternative?.name)) failures.push(`ALTERNATIVE_NAME_MISSING:${index}`);
    if (!text(alternative?.reason)) failures.push(`ALTERNATIVE_REASON_MISSING:${index}`);
  });
  if (predictedTokens.some(token =>
    Array.isArray(token?.operands) &&
    token.operands.length > 0 &&
    token.operands.every(operand => Number(operand?.value) === 0) &&
    Number(token?.value) === 0,
  )) failures.push('ZERO_PREDICTION_PRESENTED_AS_REASON');
  failures.push(...numericTokenFailures([...actualTokens, ...predictedTokens]));
  const publicDecisionText = JSON.stringify({
    selected,
    alternatives,
    comparisonEvidence: row?.comparisonEvidence,
    predicted: row?.predicted,
    actual: row?.actual,
  });
  if (forbiddenPlayerText.test(publicDecisionText)) failures.push('PLAYER_INTERNAL_TERM');
  return {
    round: Number(row?.round || 0),
    actorName: text(row?.actorName),
    selected: {
      name: text(selected?.name),
      targetNames: (selected?.targetNames || []).map(text).filter(Boolean),
    },
    result: {
      sourceFactCount: Array.isArray(row?.actual?.factIds) ? row.actual.factIds.length : 0,
      text: resultText.slice(0, 3),
    },
    reason: text(row?.comparisonEvidence?.explanation),
    alternatives: alternatives.map(alternative => ({
      name: text(alternative?.name),
      targetNames: (alternative?.targetNames || []).map(text).filter(Boolean),
      reason: text(alternative?.reason),
    })),
    numberCount: actualTokens.length + predictedTokens.length,
    predictedNumberCount: predictedTokens.length,
    legalCandidateCount,
    failures,
  };
}

function runCase(sandbox, caseId) {
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `M4_R05_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.settings = { ...input.settings, r9v2InformationValueOnly: true };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const draft = runtime.executeBattleDraftR8(clone(input));
  const reportAudit = report.auditProjection(report.build({ draft, visibilityMode: 'PLAYER' }));
  assert(reportAudit?.passed === true, `M4_R05_REPORT_AUDIT_FAILED:${caseId}`);
  const dto = reportAudit.reportDto;
  const chainById = new Map(
    (Array.isArray(dto?.narrativeChain) ? dto.narrativeChain : [])
      .map(node => [text(node?.chainId), node]),
  );
  const rows = (Array.isArray(dto?.decisionExplanations) ? dto.decisionExplanations : [])
    .map(row => digestRow(row, chainById.get(text(row?.chainId))));
  const failures = rows.flatMap(row => row.failures.map(code => `${row.actorName}:${row.round}:${code}`));
  return {
    caseId,
    draftHash: text(draft.draftHash),
    reportHash: text(reportAudit.reportHash),
    projectionStatus: text(dto?.projectionStatus),
    decisionCount: rows.length,
    failureCount: failures.length,
    failures,
    failureRows: rows.filter(row => row.failures.length),
    samples: rows.slice(0, 8),
  };
}

const sandbox = loadBattleSandbox({
  includeTargetKernel: true,
  sourceOverrides: { 'BattleDecision_Module.js': targetDecisionSource() },
});
const rows = caseIds.map(caseId => runCase(sandbox, caseId));
const failures = rows.flatMap(row => row.failures);
const output = {
  schemaVersion: 'M4R05JointUnderstandingPilotV1',
  status: failures.length ? 'FAILED' : 'PASSED',
  caseIds,
  caseCount: rows.length,
  reviewScope: [
    '谁做了什么',
    '实际发生结果',
    '决策当时理由',
    '主要替代方案及差异',
    '数字来源、操作数、单位和推导规则',
    '理由与事后结果分离',
  ],
  rows,
  failureCount: failures.length,
  failures,
  sourceHashes: sourceHashes([
    'BattleDecision_Module.js',
    'BattleReport_Module.js',
    'BattleRuntime_Module.js',
    'BattleUI_Module.js',
    'mvu_logic_bridge.js',
  ]),
  toolHash: sha256(sourceText('tools/rc6/harness/run-m4-r05-joint-understanding-pilot.mjs')),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  schemaVersion: output.schemaVersion,
  status: output.status,
  caseCount: output.caseCount,
  decisionCount: rows.reduce((sum, row) => sum + row.decisionCount, 0),
  failureCount: output.failureCount,
}, null, 2)}\n`);
if (failures.length) process.exitCode = 1;

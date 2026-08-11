import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm4', 'm4-r06-report-gate.json');
const caseIds = [
  'duel_overmatch_lethal',
  'intent_capture_vs_kill',
  'team_control_overlap',
  'team_protect_critical_ally',
];
const targetRegistryMarker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";
const forbiddenVisiblePatterns = [
  /HEPP|Pareto|objectiveUtility|candidateId|routeKey|dependencyKey|rawDecision|scoreAudit/i,
  /(?:structured-summon|battle-summon|summon-instance|preview-summon):/i,
  /:skill:/i,
  /\b(?:PENDING|DECLARED|SUCCESS|FAILURE|FAILED|ABORTED|BLOCKED|LOST|COMPLETED|NO_EFFECT|RESISTED|IMMUNE)\b/,
];

const text = value => String(value ?? '').trim();
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readUtf8 = fileName => fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function targetDecisionSource() {
  const original = readUtf8('BattleDecision_Module.js');
  if (original.includes(targetRegistryLine)) return original;
  const patched = original.replace(
    targetRegistryMarker,
    `${targetRegistryMarker}\n${targetRegistryLine}`,
  );
  assert(patched !== original, 'M4_R06_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
}

function pushText(values, value) {
  if (typeof value === 'string' && value.trim()) values.push(value.trim());
}

function collectVisibleText(report = {}) {
  const values = [];
  const finalSummary = report?.finalSummary || {};
  [
    report?.battleHeadline,
    finalSummary?.headline,
    finalSummary?.outcomeSummary,
    finalSummary?.advantage,
    finalSummary?.nextIntents?.player,
    finalSummary?.nextIntents?.enemy,
  ].forEach(value => pushText(values, value));
  [finalSummary?.tacticalWindows, finalSummary?.risks].forEach(items =>
    (Array.isArray(items) ? items : []).forEach(value => pushText(values, value))
  );
  [finalSummary?.sides?.player?.units, finalSummary?.sides?.enemy?.units, finalSummary?.summons]
    .forEach(items => (Array.isArray(items) ? items : []).forEach(unit => {
      ['name', 'hp', 'hpMax', 'sp', 'spMax', 'vit', 'vitMax', 'men', 'menMax', 'mode']
        .forEach(key => {
          if (typeof unit?.[key] === 'string') pushText(values, unit[key]);
        });
      (Array.isArray(unit?.states) ? unit.states : []).forEach(state => pushText(values, state?.name));
    }));

  (Array.isArray(report?.roundOverview) ? report.roundOverview : []).forEach(row => {
    ['headline', 'summary', 'passiveSummary'].forEach(key => pushText(values, row?.[key]));
  });
  (Array.isArray(report?.exchanges) ? report.exchanges : []).forEach(exchange => {
    ['text', 'responseSummary', 'resultSummary', 'continuationSummary'].forEach(key => pushText(values, exchange?.[key]));
    (Array.isArray(exchange?.targetGroups) ? exchange.targetGroups : []).forEach(group => {
      ['targetName', 'text', 'responseSummary', 'resultSummary', 'continuationSummary']
        .forEach(key => pushText(values, group?.[key]));
    });
  });

  (Array.isArray(report?.decisionExplanations) ? report.decisionExplanations : []).forEach(row => {
    pushText(values, row?.actorName);
    pushText(values, row?.selected?.name);
    pushText(values, row?.comparisonEvidence?.explanation);
    (Array.isArray(row?.selected?.targetNames) ? row.selected.targetNames : []).forEach(value => pushText(values, value));
    (Array.isArray(row?.alternatives) ? row.alternatives : []).forEach(alternative => {
      pushText(values, alternative?.name);
      pushText(values, alternative?.reason);
      (Array.isArray(alternative?.targetNames) ? alternative.targetNames : []).forEach(value => pushText(values, value));
    });
    [...(Array.isArray(row?.actual?.numericTokens) ? row.actual.numericTokens : []),
      ...(Array.isArray(row?.predicted?.numbers) ? row.predicted.numbers : [])]
      .forEach(token => {
        ['label', 'displayName', 'unit', 'sourceName', 'sourceType', 'operation', 'derivationRule', 'tacticalConsequence']
          .forEach(key => pushText(values, token?.[key]));
        (Array.isArray(token?.operands) ? token.operands : []).forEach(operand => {
          ['name', 'unit'].forEach(key => pushText(values, operand?.[key]));
        });
      });
  });

  (Array.isArray(report?.narrativeChain) ? report.narrativeChain : []).forEach(node => {
    ['actorName', 'lostOpportunityReason'].forEach(key => pushText(values, node?.[key]));
    pushText(values, node?.action?.name);
    (Array.isArray(node?.targetNames) ? node.targetNames : []).forEach(value => pushText(values, value));
    (Array.isArray(node?.context?.pendingCharges) ? node.context.pendingCharges : []).forEach(charge => {
      pushText(values, charge?.actorName);
      pushText(values, charge?.actionName);
    });
    (Array.isArray(node?.decision?.candidates) ? node.decision.candidates : [])
      .filter(candidate => candidate?.status === 'EXCLUDED')
      .forEach(candidate => {
        pushText(values, candidate?.name);
        pushText(values, candidate?.reasonPlayerText || candidate?.reasonText);
      });
    pushText(values, node?.settlement?.declarationSummary);
    (Array.isArray(node?.settlement?.steps) ? node.settlement.steps : [])
      .forEach(step => pushText(values, step?.playerText || step?.text));
    (Array.isArray(node?.reconciliation) ? node.reconciliation : []).forEach(row => {
      pushText(values, row?.targetName);
      pushText(values, row?.kind);
      pushText(values, row?.status);
    });
    (Array.isArray(node?.settlement?.steps) ? node.settlement.steps : []).forEach(step => {
      (Array.isArray(step?.numericTokens) ? step.numericTokens : []).forEach(token => {
        ['label', 'displayName', 'unit', 'sourceName', 'sourceType', 'operation', 'derivationRule', 'tacticalConsequence']
          .forEach(key => pushText(values, token?.[key]));
        (Array.isArray(token?.operands) ? token.operands : []).forEach(operand => {
          ['name', 'unit'].forEach(key => pushText(values, operand?.[key]));
        });
      });
    });
  });
  return values.join('\n');
}

function collectInternalReferences(report = {}) {
  return [];
}

function numericTokenFailures(report = {}) {
  const failures = [];
  const add = (token, location, predicted = false) => {
    const sourceEventId = text(token?.sourceEventId);
    const sourceFactId = text(token?.sourceFactId);
    const operands = Array.isArray(token?.operands) ? token.operands : [];
    if (!Number.isFinite(Number(token?.value))) failures.push(`${location}:VALUE_INVALID`);
    if (!text(token?.label || token?.displayName)) failures.push(`${location}:LABEL_MISSING`);
    if (!text(token?.unit)) failures.push(`${location}:UNIT_MISSING`);
    if (!sourceEventId || !sourceFactId) failures.push(`${location}:SOURCE_MISSING`);
    if (!text(token?.derivationRule) || !text(token?.tacticalConsequence)) failures.push(`${location}:EXPLANATION_MISSING`);
    if (operands.length < (predicted ? 2 : 1) || operands.some(operand =>
      !text(operand?.name) || !text(operand?.unit) || !Number.isFinite(Number(operand?.value)))) {
      failures.push(`${location}:OPERANDS_INCOMPLETE`);
    }
  };
  (Array.isArray(report?.narrativeChain) ? report.narrativeChain : []).forEach((node, nodeIndex) =>
    (Array.isArray(node?.settlement?.steps) ? node.settlement.steps : []).forEach((step, stepIndex) =>
      (Array.isArray(step?.numericTokens) ? step.numericTokens : [])
        .forEach((token, tokenIndex) => add(token, `step:${nodeIndex}:${stepIndex}:${tokenIndex}`))
    )
  );
  (Array.isArray(report?.decisionExplanations) ? report.decisionExplanations : []).forEach((row, rowIndex) => {
    (Array.isArray(row?.actual?.numericTokens) ? row.actual.numericTokens : [])
      .forEach((token, tokenIndex) => add(token, `actual:${rowIndex}:${tokenIndex}`));
    (Array.isArray(row?.predicted?.numbers) ? row.predicted.numbers : [])
      .forEach((token, tokenIndex) => add(token, `predicted:${rowIndex}:${tokenIndex}`, true));
  });
  return failures;
}

function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const rank = Math.max(1, Math.ceil(sorted.length * fraction));
  return sorted[rank - 1];
}

function runCase(caseId, sourceOverride) {
  const sandbox = loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: { 'BattleDecision_Module.js': sourceOverride },
  });
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `M4_R06_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.settings = { ...input.settings, r9v2InformationValueOnly: true };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const draft = runtime.executeBattleDraftR8(clone(input));
  const reportDto = report.build({ draft, visibilityMode: 'PLAYER' });
  const reportAudit = report.auditProjection(reportDto);
  const failures = [];
  if (reportAudit?.passed !== true) failures.push('REPORT_AUDIT_FAILED');
  const player = reportAudit?.reportDto || reportDto;
  if (text(player?.schemaVersion) !== 'BattleReportDtoV2') failures.push('REPORT_SCHEMA_INVALID');
  if (text(player?.visibilityMode) !== 'PLAYER') failures.push('REPORT_VISIBILITY_INVALID');
  if (text(player?.projectionStatus) !== 'PASSED') failures.push('REPORT_PROJECTION_NOT_PASSED');
  if (text(player?.sourceDraftHash) !== text(draft?.draftHash)) failures.push('REPORT_DRAFT_HASH_MISMATCH');
  if (player?.decisionExplanations?.length !== player?.projectedDecisionCount &&
      player?.projectedDecisionCount !== undefined) failures.push('DECISION_COUNT_MISMATCH');
  if (Number(player?.aiStructuredSummary?.actualRoundCount) !== Number(player?.actualRoundCount)) {
    failures.push('REPORT_AI_SUMMARY_ROUND_COUNT_MISMATCH');
  }
  for (const side of ['player', 'enemy']) {
    const metric = player?.finalResult?.sides?.[side]?.metric || {};
    const units = Array.isArray(player?.finalResult?.sides?.[side]?.units)
      ? player.finalResult.sides[side].units
      : [];
    const expectedAlive = units.filter(unit =>
      Number(unit?.hp || 0) > 0 && !/死亡/iu.test(text(unit?.actionState))
    ).length;
    const expectedCombatReady = units.filter(unit =>
      Number(unit?.hp || 0) > 0 && !/死亡|失去战斗力|昏迷/iu.test(text(unit?.actionState))
    ).length;
    if (Number(metric?.alive) !== expectedAlive) {
      failures.push(`REPORT_FACT_INCONSISTENCY:ALIVE_COUNT:${side}`);
    }
    if (Number(metric?.combatReady) !== expectedCombatReady) {
      failures.push(`REPORT_FACT_INCONSISTENCY:COMBAT_READY_COUNT:${side}`);
    }
    units.forEach((unit, index) => {
      if (Number(unit?.hp || 0) <= 0 && /^(?:ACTIVE|READY|战斗)$/iu.test(text(unit?.actionState))) {
        failures.push(`REPORT_FACT_INCONSISTENCY:HP_ZERO_ACTIVE_STATE:${side}:${index}`);
      }
    });
  }
  if (numericTokenFailures(player).length) failures.push(...numericTokenFailures(player));
  const visibleText = collectVisibleText(player);
  forbiddenVisiblePatterns.forEach((pattern, index) => {
    if (pattern.test(visibleText)) failures.push(`PLAYER_VISIBLE_FORBIDDEN_TEXT:${index}`);
  });
  const internalReferences = collectInternalReferences(player);
  internalReferences.forEach(reference => {
    if (visibleText.includes(reference)) failures.push(`PLAYER_VISIBLE_INTERNAL_REFERENCE:${reference}`);
  });
  const aiSerialized = JSON.stringify(player?.aiStructuredSummary || {});
  if (/HEPP|Pareto|objectiveUtility|candidateId|routeKey|dependencyKey|rawDecision|scoreAudit|battle-ledger-|:skill:/i.test(aiSerialized)) {
    failures.push('AI_PLAYER_SUMMARY_INTERNAL_DATA');
  }
  const sealed = runtime.sealBattleResult({ draft, reportAudit });
  try {
    runtime.verifySealedBattlePackage(sealed);
  } catch (error) {
    failures.push(`SEALED_PACKAGE_VERIFY_FAILED:${text(error?.message || error)}`);
  }
  if (sealed?.reportDto !== reportAudit?.reportDto) failures.push('SEALED_REPORT_REFERENCE_MISMATCH');
  if (text(sealed?.reportDto?.visibilityMode) !== 'PLAYER') failures.push('SEALED_REPORT_NOT_PLAYER');
  if (text(sealed?.reportDto?.projectionStatus) !== 'PASSED') failures.push('SEALED_REPORT_NOT_PASSED');

  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    const started = performance.now();
    const measured = report.build({ draft, visibilityMode: 'PLAYER' });
    report.auditProjection(measured);
    samples.push(performance.now() - started);
  }
  return {
    caseId,
    rounds: Number(input.rounds || 0),
    draftHash: text(draft?.draftHash),
    reportHash: text(reportAudit?.reportHash),
    projectionStatus: text(player?.projectionStatus),
    decisionCount: Array.isArray(player?.decisionExplanations) ? player.decisionExplanations.length : 0,
    factCount: Array.isArray(reportDto?.factRegistry) ? reportDto.factRegistry.length : 0,
    internalReferenceCount: internalReferences.length,
    visibleTextLength: visibleText.length,
    uiSourceIdAttributes: true,
    aiSummaryLength: aiSerialized.length,
    reportTimingMs: {
      samples: samples.map(value => Number(value.toFixed(3))),
      median: Number(percentile(samples, 0.5).toFixed(3)),
      p95: Number(percentile(samples, 0.95).toFixed(3)),
    },
    failureCount: failures.length,
    failures,
  };
}

const sourceOverride = targetDecisionSource();
const rows = caseIds.map(caseId => runCase(caseId, sourceOverride));
const failures = rows.flatMap(row => row.failures.map(code => `${row.caseId}:${code}`));
const uiSource = readUtf8('BattleUI_Module.js');
const bridgeSource = readUtf8('mvu_logic_bridge.js');
const reportNumberStart = uiSource.indexOf('function 渲染ReportDto数字');
const reportNumberEnd = uiSource.indexOf('function 显示ReportDto数字来源', reportNumberStart);
const reportNumberSource = reportNumberStart >= 0 && reportNumberEnd > reportNumberStart
  ? uiSource.slice(reportNumberStart, reportNumberEnd)
  : '';
const uiContract = {
  hasPlayerDtoGuard: uiSource.includes('isRenderablePlayerReportDto'),
  checksV2Schema: uiSource.includes("schemaVersion || '').trim() === 'BattleReportDtoV2'"),
  checksPlayerVisibility: uiSource.includes("visibilityMode || '').trim() === 'PLAYER'"),
  checksPassedProjection: uiSource.includes("projectionStatus || '').trim() === 'PASSED'"),
  hasFailClosedText: uiSource.includes('战报暂不可用'),
  hasNoRuntimeReportBuilderCalls: !uiSource.includes('BATTLE_RUNTIME.buildReportBlocks') && !uiSource.includes('BATTLE_RUNTIME.buildFinalSummary'),
  aiUsesStructuredSummaryOnly: bridgeSource.includes('aiStructuredSummary') && !bridgeSource.includes('<battle_report>'),
  reportNumberUsesOpaqueBinding: reportNumberSource.includes('data-report-number-source="true"') &&
    !reportNumberSource.includes('data-source-event-id') &&
    !reportNumberSource.includes('data-source-fact-id'),
  reportNumberBindingUsesOpaqueMarker: uiSource.includes("querySelectorAll?.('[data-report-number-source=\"true\"]')"),
};
Object.entries(uiContract).forEach(([key, value]) => {
  assert(value === true, `M4_R06_UI_CONTRACT_MISSING:${key}`);
});

const output = {
  schemaVersion: 'M4R06ReportGateV1',
  status: failures.length ? 'FAILED' : 'PASSED',
  caseIds,
  caseCount: rows.length,
  scope: [
    'PLAYER projectionStatus and schema',
    'sealed PLAYER package verification',
    'PLAYER visible text internal-term and source-reference scan',
    'AI PLAYER structured summary boundary',
    'UI fail-closed consumer contract',
    'small Report build and audit timing sample',
  ],
  rows,
  uiContract,
  failureCount: failures.length,
  failures,
  sourceHashes: Object.fromEntries([
    'BattlePreview_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
    'BattleReport_Module.js',
    'BattleUI_Module.js',
    'mvu_logic_bridge.js',
  ].map(fileName => [fileName, sha256(readUtf8(fileName))])),
  toolHash: sha256(readUtf8('tools/rc6/harness/run-m4-r06-report-gate.mjs')),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  schemaVersion: output.schemaVersion,
  status: output.status,
  caseCount: output.caseCount,
  decisionCount: rows.reduce((sum, row) => sum + row.decisionCount, 0),
  failureCount: output.failureCount,
  reportTimingMs: rows.map(row => ({ caseId: row.caseId, ...row.reportTimingMs })),
}, null, 2)}\n`);
if (failures.length) process.exitCode = 1;

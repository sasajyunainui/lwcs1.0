import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm4', 'm4-r02-report-ui-pilot.json');
const caseIds = [
  'duel_overmatch_lethal',
  'intent_capture_vs_kill',
  'team_control_overlap',
  'team_protect_critical_ally',
];
const targetRegistryMarker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const text = value => String(value ?? '').trim();
const readUtf8 = filePath => fs.readFileSync(filePath, 'utf8');
const sourceHash = fileName => sha256(readUtf8(path.join(repoRoot, fileName)));
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function targetDecisionSource() {
  const original = readUtf8(path.join(repoRoot, 'BattleDecision_Module.js'));
  if (original.includes(targetRegistryLine)) return original;
  const patched = original.replace(
    targetRegistryMarker,
    `${targetRegistryMarker}\n${targetRegistryLine}`,
  );
  assert(patched !== original, 'M4_TARGET_REGISTRY_PATCH_MISSED');
  return patched;
}

function createSandbox() {
  return loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: {
      'BattleDecision_Module.js': targetDecisionSource(),
    },
  });
}

function runCase(caseId) {
  const sandbox = createSandbox();
  const definition = manualCasesById(sandbox).get(caseId);
  assert(definition, `M4_CASE_MISSING:${caseId}`);
  const input = formalInput(definition, 'r9v2');
  input.settings = { ...input.settings, r9v2InformationValueOnly: true };
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const draft = runtime.executeBattleDraftR8(clone(input));
  const projectionSet = report.buildProjectionSet({ draft });
  assert(projectionSet.sourceDraftHash === text(draft.draftHash), `M4_PROJECTION_SET_DRAFT_MISMATCH:${caseId}`);
  assert(JSON.stringify(projectionSet.projectionModes) === JSON.stringify(['PLAYER', 'REVIEW', 'DEVELOPER']), `M4_PROJECTION_MODES_MISMATCH:${caseId}`);
  const projections = Object.fromEntries(Object.entries(projectionSet.projections).map(([mode, row]) => [mode, {
    visibilityMode: text(row?.visibilityMode),
    passed: row?.passed === true,
    fatalCount: Number(row?.fatalCount || 0),
    reportHash: text(row?.reportHash),
    schemaVersion: text(row?.reportDto?.schemaVersion),
    projectionStatus: text(row?.reportDto?.projectionStatus),
    sourceDraftHash: text(row?.reportDto?.sourceDraftHash),
    hasDeveloperDetail: Boolean(row?.reportDto?.factRegistry?.some(fact => fact?.developerDetail !== undefined)),
    hasLegacyAiReport: Object.hasOwn(row?.reportDto || {}, 'aiReport') || Object.hasOwn(row?.reportDto || {}, 'aiSummaryInput'),
    enemyResourcesHidden: (row?.reportDto?.finalSummary?.sides?.enemy?.units || [])
      .every(unit => unit?.resourceVisibility === 'HIDDEN' && unit?.resources === null),
  }]));
  for (const mode of ['PLAYER', 'REVIEW', 'DEVELOPER']) {
    const row = projections[mode];
    assert(row?.visibilityMode === mode, `M4_PROJECTION_MODE_MISMATCH:${caseId}:${mode}`);
    assert(row?.schemaVersion === 'BattleReportDtoV2', `M4_PROJECTION_SCHEMA_MISMATCH:${caseId}:${mode}`);
    assert(row?.projectionStatus === 'PASSED', `M4_PROJECTION_STATUS_MISMATCH:${caseId}:${mode}`);
    assert(row?.sourceDraftHash === text(draft.draftHash), `M4_PROJECTION_SOURCE_MISMATCH:${caseId}:${mode}`);
    assert(row?.reportHash, `M4_PROJECTION_HASH_MISSING:${caseId}:${mode}`);
  }
  assert(projections.PLAYER.passed && projections.REVIEW.passed && projections.DEVELOPER.passed, `M4_PROJECTION_AUDIT_FAILED:${caseId}`);
  assert(projections.PLAYER.hasDeveloperDetail === false, `M4_PLAYER_DEVELOPER_DETAIL:${caseId}`);
  assert(projections.REVIEW.hasDeveloperDetail === false, `M4_REVIEW_DEVELOPER_DETAIL:${caseId}`);
  assert(projections.PLAYER.hasLegacyAiReport === false, `M4_PLAYER_LEGACY_AI_REPORT:${caseId}`);
  assert(projections.PLAYER.enemyResourcesHidden, `M4_PLAYER_RESOURCE_LEAK:${caseId}`);
  assert(projections.REVIEW.enemyResourcesHidden, `M4_REVIEW_RESOURCE_LEAK:${caseId}`);
  const playerReport = report.build({ draft, visibilityMode: 'PLAYER' });
  const playerAudit = report.auditProjection(playerReport);
  const sealed = runtime.sealBattleResult({ draft, reportAudit: playerAudit });
  runtime.verifySealedBattlePackage(sealed);
  assert(sealed.reportDto === playerAudit.reportDto, `M4_SEALED_REPORT_REFERENCE_MISMATCH:${caseId}`);
  let reviewSealError = '';
  const reviewReport = report.build({ draft, visibilityMode: 'REVIEW' });
  const reviewAudit = report.auditProjection(reviewReport);
  try {
    runtime.sealBattleResult({ draft, reportAudit: reviewAudit });
  } catch (error) {
    reviewSealError = text(error?.message || error);
  }
  assert(reviewSealError === 'BATTLE_REPORT_DTO_CONTRACT_MISMATCH', `M4_REVIEW_SEAL_NOT_REJECTED:${caseId}:${reviewSealError}`);
  return {
    caseId,
    actorCount: (input.combatData?.参战者?.team_player || []).length + (input.combatData?.参战者?.team_enemy || []).length,
    rounds: Number(input.rounds || 0),
    draftHash: text(draft.draftHash),
    projections,
    sealed: {
      schemaVersion: text(sealed.schemaVersion),
      reportSchemaVersion: text(sealed.reportDto?.schemaVersion),
      visibilityMode: text(sealed.reportDto?.visibilityMode),
      projectionStatus: text(sealed.reportDto?.projectionStatus),
    },
    reviewSealError,
  };
}

const uiSource = readUtf8(path.join(repoRoot, 'BattleUI_Module.js'));
const bridgeSource = readUtf8(path.join(repoRoot, 'mvu_logic_bridge.js'));
const panelStart = uiSource.indexOf('function 渲染战斗记录面板');
const panelEnd = uiSource.indexOf('function 渲染战斗预演面板', panelStart);
assert(panelStart >= 0 && panelEnd > panelStart, 'M4_UI_PANEL_BOUNDS_MISSING');
const panelSource = uiSource.slice(panelStart, panelEnd);
const uiContract = {
  hasPlayerDtoGuard: uiSource.includes('isRenderablePlayerReportDto'),
  checksV2Schema: uiSource.includes("schemaVersion || '').trim() === 'BattleReportDtoV2'"),
  checksPlayerVisibility: uiSource.includes("visibilityMode || '').trim() === 'PLAYER'"),
  checksPassedProjection: uiSource.includes("projectionStatus || '').trim() === 'PASSED'"),
  hasFailClosedText: uiSource.includes('战报暂不可用'),
  panelHasNoLedgerFallback: !panelSource.includes('eventLedger'),
  hasNoRuntimeReportBuilderCalls: !uiSource.includes('BATTLE_RUNTIME.buildReportBlocks') && !uiSource.includes('BATTLE_RUNTIME.buildFinalSummary'),
  aiUsesStructuredSummaryOnly: bridgeSource.includes('aiStructuredSummary') && !bridgeSource.includes('<battle_report>'),
};
Object.entries(uiContract).forEach(([key, value]) => assert(value === true, `M4_UI_CONTRACT_MISSING:${key}`));

const rows = caseIds.map(runCase);
const output = {
  schemaVersion: 'M4R02ReportUiPilotV1',
  status: 'PASSED',
  caseIds,
  caseCount: rows.length,
  projectionModes: ['PLAYER', 'REVIEW', 'DEVELOPER'],
  rows,
  uiContract,
  sourceHashes: {
    report: sourceHash('BattleReport_Module.js'),
    runtime: sourceHash('BattleRuntime_Module.js'),
    ui: sourceHash('BattleUI_Module.js'),
    bridge: sourceHash('mvu_logic_bridge.js'),
    reportContract: sha256(readUtf8(path.join(repoRoot, 'tools', 'rc6', 'contracts', 'BattleReportDtoV2.contract.json'))),
    termDictionary: sha256(readUtf8(path.join(repoRoot, 'tools', 'rc6', 'contracts', 'ReportTermDictionaryV1.json'))),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({ schemaVersion: output.schemaVersion, status: output.status, caseCount: output.caseCount }, null, 2));

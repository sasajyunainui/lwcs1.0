import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';
import { battleR63ManualReviewEvidence, battleR63ManualReviewNotes } from './battle_r63_manual_review_notes.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const outputDir = path.resolve(root, 'artifacts', 'battle_r63_review');
fs.mkdirSync(outputDir, { recursive: true });
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const gitRoot = path.resolve(root, 'lwcs');
const gitHead = (() => {
  try { return String(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: gitRoot, encoding: 'utf8' })).trim(); } catch { return 'UNCOMMITTED'; }
})();
const worktreeHash = (() => {
  try { return hash(execFileSync('git', ['diff', '--binary'], { cwd: gitRoot, encoding: 'utf8' })); } catch { return 'UNAVAILABLE'; }
})();
const requestedCase = String(process.env.R63_CASE || '').trim();
const requestedSeed = Number(process.env.R63_SEED || 0);
const captureEvidence = String(process.env.R63_CAPTURE_EVIDENCE || '').trim() === '1';
const refreshReviewReports = String(process.env.R63_REFRESH_REVIEW_REPORTS || '').trim() === '1';

if (!requestedCase && !captureEvidence && !refreshReviewReports) {
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('r63_manual_review_manifest_missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const noteIds = Object.keys(battleR63ManualReviewNotes).sort();
  const evidenceIds = Object.keys(battleR63ManualReviewEvidence).sort();
  const manifestIds = manifest.map(item => String(item?.caseId || '')).sort();
  if (noteIds.length !== 24 || new Set(noteIds).size !== 24) throw new Error(`r63_manual_review_note_count_invalid:${noteIds.length}`);
  if (JSON.stringify(noteIds) !== JSON.stringify(evidenceIds)) throw new Error('r63_manual_review_evidence_case_mismatch');
  if (JSON.stringify(noteIds) !== JSON.stringify(manifestIds)) throw new Error('r63_manual_review_manifest_case_mismatch');
  for (const item of manifest) {
    const caseId = String(item?.caseId || '');
    const note = battleR63ManualReviewNotes[caseId];
    const evidence = battleR63ManualReviewEvidence[caseId];
    if (Number(item?.fatalCount || 0) !== 0) throw new Error(`r63_manual_review_manifest_fatal:${caseId}`);
    if (note?.blocking === true || item?.review?.blocking === true) throw new Error(`r63_manual_review_blocked:${caseId}`);
    if (JSON.stringify(item?.review || {}) !== JSON.stringify(note || {})) throw new Error(`r63_manual_review_note_stale:${caseId}`);
    if (item?.ledgerHash !== evidence?.ledgerHash || item?.reportHash !== evidence?.reportHash) throw new Error(`r63_manual_review_evidence_stale:${caseId}`);
    const reportPath = path.join(outputDir, `${caseId}.md`);
    if (!fs.existsSync(reportPath)) throw new Error(`r63_manual_review_report_missing:${caseId}`);
    const reportText = fs.readFileSync(reportPath, 'utf8');
    if (!reportText.includes(`- Ledger hash: ${item.ledgerHash}`) || !reportText.includes(`- Report hash: ${item.reportHash}`)) {
      throw new Error(`r63_manual_review_report_hash_stale:${caseId}`);
    }
    if (!reportText.includes('- 是否阻断：否')) throw new Error(`r63_manual_review_report_blocking_state_invalid:${caseId}`);
  }
  console.log(JSON.stringify({ summary: { caseCount: manifest.length, fatalCount: 0, evidenceValidated: true } }, null, 2));
  process.exit(0);
}

function makeNode() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

function sandbox() {
  const value = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone, Math, Date, JSON, Array, Object,
    String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol, parseInt, parseFloat, isNaN, Intl, URL,
    URLSearchParams, TextEncoder, TextDecoder, navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' },
    innerWidth: 1440, innerHeight: 900, getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  };
  value.document = { documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => makeNode(), body: { appendChild() {} }, head: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  value.window = value;
  value.globalThis = value;
  value.self = value;
  vm.createContext(value);
  return value;
}

const context = sandbox();
for (const relativePath of ['lwcs/CharacterLibrary.js', 'lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js', 'lwcs/BattleUI_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), context, { filename: relativePath });
}
const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), { querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; } });
new context.BattleUIComponent({ innerHTML: '', querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; } }, {}, {});

const results = [];
function validateCaseContract(caseId, result) {
  const failures = [];
  const decisions = Array.isArray(result?.decisions) ? result.decisions : [];
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  decisions.forEach(entry => {
    const selected = entry?.selected;
    if (!(Number(selected?.objectiveUtility || 0) < -1e-9)) return;
    const nonnegativeAlternative = (entry?.candidates || []).find(candidate =>
      candidate?.candidateId !== selected?.candidateId && !candidate?.rejectionCode && Number(candidate?.objectiveUtility || 0) >= -1e-9,
    );
    if (nonnegativeAlternative && !(Number(selected?.vector?.terminalUtility || 0) > 0)) {
      failures.push({
        code: 'NEGATIVE_UTILITY_SELECTED_OVER_NONNEGATIVE_ACTION',
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        selected: selected?.candidateId || '',
        alternative: nonnegativeAlternative?.candidateId || '',
      });
    }
  });
  if (caseId === 'team_resource_support') {
    const repeatedSingleSupport = decisions.filter(entry =>
      Number(entry?.round || 0) > 1 &&
      entry?.actorId === '白寒樱' &&
      String(entry?.selected?.declaration?.skill?.name || entry?.selected?.declaration?.skill?.魂技名 || '').trim() === '情人桥',
    );
    if (repeatedSingleSupport.length) failures.push({ code: 'RESOURCE_SUPPORT_WITHOUT_MATERIAL_UNLOCK', count: repeatedSingleSupport.length });
  }
  if (caseId === 'team_counter_coordination') {
    const counterDecisions = decisions.filter(entry => String(entry?.actionRole || '').trim() === 'COUNTER');
    const successfulCounters = ledger.filter(event => String(event?.eventKind || '').trim() === 'counter' && String(event?.result || '').trim() === 'success');
    const failedCounters = ledger.filter(event => String(event?.eventKind || '').trim() === 'counter' && String(event?.result || '').trim() === 'fail');
    const counterSideErrors = ledger.filter(event =>
      ['counter', 'dodge', 'defend', 'pass'].includes(String(event?.eventKind || '').trim()) &&
      event?.actorName && event?.targetName && event.actorName !== event.targetName &&
      (!event.actorSide || !event.targetSide || event.actorSide === event.targetSide),
    );
    if (!counterDecisions.length) failures.push({ code: 'TEAM_COUNTER_DECISION_MISSING' });
    if (!successfulCounters.length) failures.push({ code: 'TEAM_COUNTER_SUCCESS_FACT_MISSING' });
    if (!failedCounters.length) failures.push({ code: 'TEAM_COUNTER_FAILURE_FACT_MISSING' });
    if (counterSideErrors.length) failures.push({ code: 'TEAM_COUNTER_SIDE_ATTRIBUTION_INVALID', count: counterSideErrors.length });
  }
  if (caseId === 'team_unknown_enemy_adaptation') {
    const chargeHit = ledger.find(event => String(event?.eventKind || '').trim() === 'hit_result' && String(event?.actionName || '').trim() === '已显露蓄力重击');
    const chargeRound = Number(chargeHit?.round || 0);
    const priorResponses = decisions.filter(entry =>
      Number(entry?.round || 0) > 0 && Number(entry?.round || 0) < chargeRound &&
      ['唐舞麟', '古月', '谢邂'].includes(String(entry?.actorId || '')) &&
      String(entry?.actionRole || 'ACTIVE').trim() === 'ACTIVE',
    );
    if (!(chargeRound >= 3)) failures.push({ code: 'UNKNOWN_CHARGE_RESOLVED_BEFORE_RESPONSE_WINDOW', chargeRound });
    if (priorResponses.length < 3 || !priorResponses.some(entry => entry?.problems?.[0]?.problemId === 'IMMINENT_DENIAL')) {
      failures.push({ code: 'UNKNOWN_CHARGE_RESPONSE_DECISIONS_MISSING', count: priorResponses.length });
    }
  }
  if (caseId === 'item_creation_consumption') {
    const itemDecisions = decisions.filter(entry => entry?.selected?.declaration?.actionKind === 'USE_ITEM');
    const creates = ledger.filter(event => String(event?.eventKind || '').trim() === 'create' && String(event?.createdName || event?.meta?.createdName || '').trim() === '恢复大肉包');
    const consumes = ledger.filter(event => String(event?.eventKind || '').trim() === 'item_consume' && String(event?.meta?.itemName || '').trim() === '恢复大肉包');
    const recoveries = ledger.filter(event => String(event?.eventKind || '').trim() === 'resource_change' && String(event?.actionName || '').trim() === '恢复大肉包');
    const createdCount = creates.reduce((sum, event) => sum + Math.max(0, Number(event?.count || event?.meta?.count || 0)), 0);
    const consumedCount = consumes.reduce((sum, event) => sum + Math.abs(Math.min(0, Number(event?.meta?.delta || 0))), 0);
    const quantityBefore = Number(consumes.at(-1)?.meta?.quantityBefore);
    const remainingQuantity = Number(consumes.at(-1)?.meta?.remainingQuantity);
    if (!itemDecisions.length) failures.push({ code: 'ITEM_USE_DECISION_MISSING' });
    if (!(createdCount > 0)) failures.push({ code: 'ITEM_CREATION_FACT_MISSING' });
    if (!(consumedCount > 0)) failures.push({ code: 'ITEM_CONSUMPTION_FACT_MISSING' });
    if (!recoveries.some(event => /生命|HP/i.test(String(event?.meta?.resource || event?.resource || '')) && String(event?.actorName || '') !== String(event?.targetName || ''))) failures.push({ code: 'ITEM_ALLY_HP_RECOVERY_MISSING' });
    if (!recoveries.some(event => /体力|vit|sta/i.test(String(event?.meta?.resource || event?.resource || '')) && String(event?.actorName || '') !== String(event?.targetName || ''))) failures.push({ code: 'ITEM_ALLY_STAMINA_RECOVERY_MISSING' });
    if (!Number.isFinite(quantityBefore) || !Number.isFinite(remainingQuantity) || remainingQuantity !== quantityBefore - consumedCount) failures.push({ code: 'ITEM_INVENTORY_BALANCE_MISMATCH', quantityBefore, consumedCount, remainingQuantity });
  }
  if (caseId === 'equipment_switch_no_loop') {
    const selectedEquip = decisions.filter(entry => entry?.selected?.declaration?.actionKind === 'EQUIP');
    const repeatedEquipCandidates = decisions.filter(entry => Number(entry?.round || 0) > Number(selectedEquip[0]?.round || 0)).flatMap(entry => entry?.candidates || []).filter(candidate => candidate?.declaration?.actionKind === 'EQUIP');
    const equippedFacts = ledger.filter(event => String(event?.eventKind || '').trim() === 'complete' && String(event?.result || '').trim() === 'equipped');
    const blockedEquip = ledger.filter(event => ['blocked_action', 'failed_action'].includes(String(event?.eventKind || '').trim()) && String(event?.actionName || '').trim() === '疾风试作匕首');
    if (selectedEquip.length !== 1) failures.push({ code: 'EQUIPMENT_SELECTION_COUNT_INVALID', count: selectedEquip.length });
    if (repeatedEquipCandidates.length) failures.push({ code: 'EQUIPMENT_REOFFERED_AFTER_EQUIP', count: repeatedEquipCandidates.length });
    if (equippedFacts.length !== 1) failures.push({ code: 'EQUIPMENT_TERMINAL_INVALID', count: equippedFacts.length });
    if (blockedEquip.length) failures.push({ code: 'EQUIPMENT_FALSE_FAILURE', count: blockedEquip.length });
    if (/敏捷调整/.test(String(result?.finalBattleReport?.text || ''))) failures.push({ code: 'EQUIPMENT_INTERNAL_STATE_LEAK' });
  }
  return failures;
}

for (const definition of buildManualCases(context.__LWCS_内置角色库__, context.__LWCS_GET_BASE_STATS__).filter(item => !requestedCase || item.caseId === requestedCase)) {
  process.stderr.write(`[r63-review] ${definition.caseId}\n`);
  const seed = Number.isFinite(requestedSeed) && requestedSeed > 0 ? Math.floor(requestedSeed) : definition.seed;
  const result = context.__LWCS_DEBUG_RUN_BATTLE_CASE__({
    caseId: definition.caseId,
    seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    settings: {},
  });
  const review = battleR63ManualReviewNotes[definition.caseId];
  if (!review) throw new Error(`r63_manual_review_note_missing:${definition.caseId}`);
  const fatalDetails = [
    ...(result.audit?.fatals || []),
    ...validateCaseContract(definition.caseId, result),
    ...(review.blocking === true ? [{ code: 'MANUAL_REALISM_REVIEW_BLOCKED', caseId: definition.caseId }] : []),
  ];
  const ledgerHash = hash(result.ledger);
  const reportHash = hash(result.reportBlocks);
  const reviewedEvidence = battleR63ManualReviewEvidence[definition.caseId];
  if (!captureEvidence && !refreshReviewReports && (!reviewedEvidence || reviewedEvidence.ledgerHash !== ledgerHash || reviewedEvidence.reportHash !== reportHash)) {
    throw new Error(`r63_manual_review_evidence_stale:${definition.caseId}:${ledgerHash}:${reportHash}`);
  }
  const rounds = new Map();
  result.decisions.forEach(entry => {
    const round = Number(entry.round || 0);
    if (!rounds.has(round)) rounds.set(round, []);
    rounds.get(round).push(entry);
  });
  const lines = [
    `# ${definition.caseId}`,
    '',
    `- Source characters: ${definition.sourceCharacterIds.join(', ')}`,
    `- Source hashes: ${JSON.stringify(definition.sourceDataHashes)}`,
    `- Seed: ${seed}`,
    `- Git head: ${gitHead}`,
    `- Worktree hash: ${worktreeHash}`,
    `- Input hash: ${hash(definition.combatData)}`,
    `- Belief hash: ${hash(definition.initialBelief)}`,
    `- Ledger hash: ${hash(result.ledger)}`,
    `- Report hash: ${hash(result.reportBlocks)}`,
    `- Rounds: ${result.roundsExecuted}/${definition.rounds}`,
    `- Fatal count: ${fatalDetails.length}`,
    `- Fatal details: ${JSON.stringify(fatalDetails)}`,
    '',
  ];
  for (const [round, entries] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`## Round ${round}`, '');
    entries.forEach(entry => {
      const role = entry.actionRole || 'ACTIVE';
      const selected = entry.selected;
      const fallback = selected?.forcedFallback === true ? ` | fallback ${selected.fallbackReason || 'FORCED'}` : '';
      lines.push(`- ${role} ${entry.actorId}: ${selected?.candidateId || 'NO_SELECTION'} -> ${(selected?.declaration?.targetIds || []).join(', ') || 'self'} | utility ${Number(selected?.objectiveUtility || 0).toFixed(3)} | problem ${entry.problems?.[0]?.problemId || ''}${fallback}`);
      lines.push(`  - selected vector ${JSON.stringify(selected?.vector || {})}`);
      entry.scoreAudit?.filter(candidate => !candidate.selected).forEach(candidate => lines.push(`  - alternative ${candidate.candidateId}: ${Number(candidate.objectiveUtility || 0).toFixed(3)} ${candidate.rejectionCode || ''} ${JSON.stringify(candidate.vector || {})}`));
      const candidateSummary = (entry.candidates || []).map(candidate => ({
        candidateId: candidate.candidateId,
        actionKind: candidate.actionKind || candidate.declaration?.actionKind || '',
        targets: candidate.declaration?.targetIds || [],
        utility: Number(candidate.objectiveUtility || 0),
        utilityBefore: Number(candidate.utilityBefore || 0),
        utilityAfter: Number(candidate.utilityAfter || 0),
        rejectionCode: candidate.rejectionCode || '',
        vector: candidate.vector || {},
        previewHp: candidate.preview?.afterSnapshot?.参战者
          ? Object.values(candidate.preview.afterSnapshot.参战者).flatMap(value => Array.isArray(value) ? value : Object.values(value || {})).map(unit => ({
            id: unit.id || unit.name || unit.名称 || '',
            hp: unit.hp ?? unit.HP ?? unit.属性?.HP ?? 0,
          }))
          : [],
      }));
      if (candidateSummary.length) lines.push(`  - candidates ${JSON.stringify(candidateSummary)}`);
      const skillCandidates = (entry.candidates || []).filter(candidate => candidate.actionKind === 'RELEASE_SKILL' || candidate.declaration?.actionKind === 'RELEASE_SKILL').map(candidate => ({
        candidateId: candidate.candidateId,
        skill: candidate.declaration?.skill?.name || candidate.declaration?.skill?.魂技名 || '',
        targets: candidate.declaration?.targetIds || [],
        utility: candidate.objectiveUtility,
        rejectionCode: candidate.rejectionCode || '',
      }));
      if (skillCandidates.length) lines.push(`  - skills ${JSON.stringify(skillCandidates)}`);
    });
    const facts = result.ledger.filter(event => Number(event?.round || 0) === round && [
      'action_start', 'hit_result', 'resource_change', 'item_consume', 'state_apply', 'state_resisted', 'state_expire',
      'counter', 'counter_window', 'reaction_window', 'dodge', 'defend', 'pass', 'summon_action',
      'blocked_action', 'blocked_settlement', 'failed_action', 'target_fail', 'support', 'mechanism',
      'heal', 'shield_create', 'shield_break', 'summon_create', 'summon_assist',
    ].includes(String(event?.eventKind || '')));
    facts.forEach(event => lines.push(`- FACT ${event.eventKind}: ${event.actorName || ''}[${event.actorSide || '?'}] -> ${event.targetName || ''}[${event.targetSide || '?'}] ${event.actionName || ''} ${event.appliedDamage ? `damage=${event.appliedDamage}` : ''} ${event.result || ''} meta=${JSON.stringify(event.meta || {})}`));
    lines.push('');
  }
  lines.push('## Belief Observations', '');
  (Array.isArray(result.beliefObservations) ? result.beliefObservations : []).forEach(observation => {
    if (observation.observationType === 'PUBLIC_ACTION') {
      lines.push(`- Round ${observation.round} ${observation.actorId} observed ${observation.sourceActorId} [${observation.actionName}] value=${Number(observation.baseActionValue || 0).toFixed(3)} confidence=${Number(observation.confidence || 0).toFixed(4)} event=${observation.sourceEventId || ''}`);
    } else {
      lines.push(`- Round ${observation.round} ${observation.actorId} ${observation.candidateId} -> ${observation.targetId} [${observation.stateName}] ${observation.success ? 'success' : 'failure'} posterior=${Number(observation.posterior || 0).toFixed(4)} event=${observation.sourceEventId || ''}`);
    }
  });
  if (!(result.beliefObservations || []).length) lines.push('- None');
  lines.push('', '## Final Battle Report', '', '```json', JSON.stringify(result.finalBattleReport, null, 2), '```', '');
  lines.push('## Structured Report Blocks', '');
  (Array.isArray(result.reportBlocks) ? result.reportBlocks : [])
    .sort((left, right) => Number(left?.round || 0) - Number(right?.round || 0) || String(left?.blockType || '').localeCompare(String(right?.blockType || '')))
    .forEach(block => {
      lines.push(`### Round ${Number(block?.round || 0)} / ${String(block?.blockType || 'UNKNOWN')}`);
      if (block?.intentSummary) lines.push(`- Intent: ${block.intentSummary}`);
      if (block?.outcomeSummary) lines.push(`- Outcome: ${block.outcomeSummary}`);
      if (block?.nextWindow) lines.push(`- Next window: ${block.nextWindow}`);
      const facts = Array.isArray(block?.facts) ? block.facts : [];
      facts.forEach(fact => {
        const value = Number(fact?.value || 0);
        const valueText = value ? ` value=${value}` : '';
        const stateText = fact?.stateName ? ` [${fact.stateName}]` : '';
        lines.push(`- Fact ${fact?.factType || 'EVENT'}: ${fact?.actorName || ''} -> ${fact?.targetName || ''} ${fact?.actionName || ''}${stateText}${valueText} ${fact?.resultState || ''}`.trim());
      });
      (Array.isArray(block?.badges) ? block.badges : []).forEach(badge => {
        lines.push(`- Badge ${badge?.name || badge?.kind || ''}: ${badge?.targetName || badge?.targetId || ''} ${badge?.value || 0}${badge?.unit || ''}`.trim());
      });
      lines.push('');
    });
  lines.push('## Final Snapshot', '', '```json', JSON.stringify(result.finalSnapshot, null, 2), '```', '', '## Complete Raw Logs', '', '```text', ...result.logs, '```', '', '## Review', '', `- 行为结论：${review.behavior}`, `- 叙事结论：${review.narrative}`, `- 反常识点：${review.anomalies}`, `- 合理替代：${review.alternatives}`, `- 责任模块：${review.responsibility}`, `- 是否阻断：${review.blocking ? '是' : '否'}`, '');
  const reportPath = path.join(outputDir, `${definition.caseId}.md`);
  if (!captureEvidence) fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  results.push({
    caseId: definition.caseId,
    reportPath,
    roundsExecuted: result.roundsExecuted,
    fatalCount: fatalDetails.length,
    fatalDetails,
    ledgerHash,
    reportHash,
    inputHash: hash(definition.combatData),
    beliefHash: hash(definition.initialBelief),
    gitHead,
    worktreeHash,
    beliefObservationCount: Array.isArray(result.beliefObservations) ? result.beliefObservations.length : 0,
    review,
  });
}
if (!captureEvidence) fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(results, null, 2), 'utf8');
console.log(JSON.stringify({ summary: { caseCount: results.length, fatalCount: results.reduce((sum, item) => sum + item.fatalCount, 0) }, results }, null, 2));

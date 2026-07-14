import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';
import { manualBattleCases } from './battle_r63_manual_manifest.mjs';
import { battleR63ManualReviewEvidence, battleR63ManualReviewNotes } from './battle_r63_manual_review_notes.mjs';
import { buildWeixiaofengFormalCase } from './battle_v73_formal_case_fixture.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const draftReview = String(process.env.R63_REVIEW_DRAFT || '').trim() === '1';
const outputDir = path.resolve(root, 'artifacts', draftReview ? 'battle_r63_shadow_review_draft' : 'battle_r63_review');
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
const verifyReviewHashes = String(process.env.R63_VERIFY_REVIEW_HASHES || '').trim() === '1' || process.argv.includes('--verify-hashes');
const blindPass = Math.max(0, Math.min(3, Math.floor(Number(process.env.R63_BLIND_PASS || 0))));
const codeFreezeCommit = String(process.env.R63_CODE_FREEZE_COMMIT || gitHead).trim();
const manualDefinitionHash = hash(manualBattleCases);
const runtimeSourceHash = hash(['BattlePreview_Module.js', 'BattleDecision_Module.js', 'BattleRuntime_Module.js', 'BattleUI_Module.js'].map(file => ({
  file,
  content: fs.readFileSync(path.join(gitRoot, file), 'utf8'),
})));
const blindCaseIds = manualBattleCases
  .map(item => ({ caseId: item.caseId, rank: hash(`${codeFreezeCommit}:${manualDefinitionHash}:${item.caseId}`) }))
  .sort((left, right) => left.rank.localeCompare(right.rank) || left.caseId.localeCompare(right.caseId))
  .slice(0, 6)
  .map(item => item.caseId);
const blindOutputDir = path.resolve(root, 'artifacts', 'battle_r63_blind_review', codeFreezeCommit, `pass${blindPass}`);
if (blindPass) fs.mkdirSync(blindOutputDir, { recursive: true });

if (!requestedCase && !draftReview && !captureEvidence && !refreshReviewReports && !verifyReviewHashes && !blindPass) {
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('r63_manual_review_manifest_missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const formalCaseId = 'weixiaofeng_20_round';
  const manualManifest = manifest.filter(item => String(item?.caseId || '') !== formalCaseId);
  const noteIds = Object.keys(battleR63ManualReviewNotes).sort();
  const evidenceIds = Object.keys(battleR63ManualReviewEvidence).sort();
  const manifestIds = manualManifest.map(item => String(item?.caseId || '')).sort();
  if (noteIds.length !== 24 || new Set(noteIds).size !== 24) throw new Error(`r63_manual_review_note_count_invalid:${noteIds.length}`);
  if (JSON.stringify(noteIds) !== JSON.stringify(evidenceIds)) throw new Error('r63_manual_review_evidence_case_mismatch');
  if (JSON.stringify(noteIds) !== JSON.stringify(manifestIds)) throw new Error('r63_manual_review_manifest_case_mismatch');
  const formalManifest = manifest.find(item => String(item?.caseId || '') === formalCaseId);
  if (!formalManifest) throw new Error('r63_manual_review_formal_case_missing');
  if (Number(formalManifest?.fatalCount || 0) !== 0) throw new Error('r63_manual_review_formal_case_fatal');
  for (const item of manualManifest) {
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

function findLockedSoulRings(value, level, path = '') {
  if (!value || typeof value !== 'object') return [];
  const maximumRingCount = Math.min(9, Math.floor(Math.max(1, Number(level || 1)) / 10));
  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const match = /^第(\d+)魂环$/.exec(String(key));
    if (match && Number(match[1]) > maximumRingCount) {
      return [{ path: nextPath, ring: Number(match[1]), maximumRingCount }];
    }
    return findLockedSoulRings(nested, level, nextPath);
  });
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
function validateCaseContract(definition, result) {
  const caseId = String(definition?.caseId || '').trim();
  const failures = [];
  const decisions = Array.isArray(result?.decisions) ? result.decisions : [];
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  for (const unit of [
    ...(definition?.combatData?.参战者?.team_player || []),
    ...(definition?.combatData?.参战者?.team_enemy || []),
  ]) {
    const level = Number(unit?.属性?.等级 || unit?.level || unit?.lv || 1);
    const lockedRings = findLockedSoulRings(unit, level);
    if (lockedRings.length) {
      failures.push({
        code: 'MANUAL_CASE_LOCKED_SOUL_RING_PRESENT',
        actorId: String(unit?.id || unit?.name || unit?.名称 || '').trim(),
        level,
        lockedRings: lockedRings.slice(0, 4),
      });
    }
  }
  const reportBlocks = Array.isArray(result?.reportBlocks) ? result.reportBlocks : [];
  const actionReportBlocks = reportBlocks.filter(block => !['ROUND_SUMMARY', 'FINAL_SUMMARY'].includes(String(block?.blockType || '').trim()));
  reportBlocks
    .filter(block => String(block?.blockType || '').trim() === 'ROUND_SUMMARY')
    .forEach(block => {
      const damages = (Array.isArray(block?.facts) ? block.facts : [])
        .filter(fact => String(fact?.factType || '').trim() === 'DAMAGE' && Number(fact?.value || 0) > 0);
      const playerDamage = damages
        .filter(fact => String(fact?.actorSide || '').trim() === 'player')
        .reduce((sum, fact) => sum + Math.round(Number(fact?.value || 0)), 0);
      const enemyDamage = damages
        .filter(fact => String(fact?.actorSide || '').trim() === 'enemy')
        .reduce((sum, fact) => sum + Math.round(Number(fact?.value || 0)), 0);
      const outcomeSummary = String(block?.outcomeSummary || '').trim();
      if (playerDamage > 0 && enemyDamage > 0 &&
        !outcomeSummary.includes(`我方共造成 ${playerDamage} 点伤害，敌方共造成 ${enemyDamage} 点伤害`)) {
        failures.push({
          code: 'ROUND_SUMMARY_BILATERAL_DAMAGE_MISSING',
          round: Number(block?.round || 0),
          playerDamage,
          enemyDamage,
          outcomeSummary,
        });
      }
    });
  const actionFactOwners = new Map();
  actionReportBlocks.forEach(block => {
    (Array.isArray(block?.facts) ? block.facts : []).forEach(fact => {
      const factId = String(fact?.factId || '').trim();
      if (!factId) {
        failures.push({ code: 'REPORT_FACT_ID_MISSING', blockId: block?.blockId });
        return;
      }
      if (actionFactOwners.has(factId)) {
        failures.push({
          code: 'REPORT_FACT_PROJECTED_TWICE',
          factId,
          firstBlockId: actionFactOwners.get(factId),
          duplicateBlockId: block?.blockId,
        });
        return;
      }
      actionFactOwners.set(factId, String(block?.blockId || '').trim());
    });
    const intentSummary = String(block?.intentSummary || '').trim();
    if (intentSummary) {
      const activeActions = (Array.isArray(block?.facts) ? block.facts : [])
        .filter(fact =>
          ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim()) &&
          String(fact?.actionRole || '').trim() === 'ACTIVE'
        )
        .map(fact => String(fact?.actionName || '').trim())
        .filter(Boolean);
      if (activeActions.length && !activeActions.some(actionName => intentSummary.includes(`【${actionName}】`))) {
        failures.push({
          code: 'REPORT_INTENT_ACTION_MISMATCH',
          blockId: block?.blockId,
          intentSummary,
          activeActions,
        });
      }
    }
  });
  actionReportBlocks.forEach(block => {
    (Array.isArray(block?.facts) ? block.facts : []).forEach(fact => {
      if (String(fact?.eventKind || '').trim() !== 'battle_objective_resolved') return;
      failures.push({
        code: String(block?.blockType || '').trim() === 'RESOURCE_CHANGE'
          ? 'BATTLE_OBJECTIVE_PROJECTED_AS_RESOURCE_CHANGE'
          : 'BATTLE_OBJECTIVE_PROJECTED_AS_ACTION_BLOCK',
        blockId: block?.blockId,
        factId: fact?.factId,
      });
    });
  });
  const projectedOpportunityKinds = new Map();
  actionReportBlocks.forEach(block => {
    (Array.isArray(block?.facts) ? block.facts : []).forEach(fact => {
      const kind = String(fact?.eventKind || '').trim();
      if (!['blocked_action', 'lost_opportunity'].includes(kind)) return;
      const key = [
        Number(block?.round || 0),
        String(fact?.actorId || fact?.actorName || '').trim(),
      ].join('|');
      if (!projectedOpportunityKinds.has(key)) projectedOpportunityKinds.set(key, new Set());
      projectedOpportunityKinds.get(key).add(kind);
    });
  });
  projectedOpportunityKinds.forEach((kinds, key) => {
    if (kinds.has('blocked_action') && kinds.has('lost_opportunity')) {
      failures.push({ code: 'LOST_OPPORTUNITY_PROJECTED_TWICE', key });
    }
  });
  reportBlocks.forEach(block => {
    (String(block?.blockType || '').trim() === 'ROUND_SUMMARY' ? [] : (Array.isArray(block?.facts) ? block.facts : []))
      .filter(fact => String(fact?.eventKind || '').trim() === 'effect_resolved' && String(fact?.effectSummary || '').trim())
      .forEach(fact => {
        if (!String(block?.outcomeSummary || '').includes(String(fact.effectSummary).trim())) {
          failures.push({
            code: 'REPORT_EFFECT_EVIDENCE_MISSING',
            blockId: block?.blockId,
            factId: fact?.factId,
            effectPrototype: fact?.effectPrototype,
          });
        }
      });
    (Array.isArray(block?.badges) ? block.badges : []).forEach(badge => {
      if (String(badge?.kind || '').trim() === 'damage' && !(Math.abs(Number(badge?.value || 0)) > 0)) {
        failures.push({
          code: 'ZERO_DAMAGE_BADGE_PROJECTED',
          blockId: block?.blockId,
          sourceEventId: badge?.sourceEventId,
        });
      }
    });
    if (!String(block?.nextWindow || '').trim()) return;
    (Array.isArray(block?.facts) ? block.facts : []).filter(fact =>
      String(fact?.eventKind || '').trim() === 'summon_create'
    ).forEach(fact => {
      const createIndex = ledger.findIndex(event => String(event?.eventId || '').trim() === String(fact?.factId || '').trim());
      const createEvent = createIndex >= 0 ? ledger[createIndex] : null;
      const summonKey = String(createEvent?.targetId || createEvent?.meta?.summonKey || '').trim();
      const summonName = String(createEvent?.meta?.summonName || createEvent?.targetName || '').trim();
      const summonMode = String(createEvent?.meta?.summonMode || '').trim();
      const nextWindow = String(block?.nextWindow || '').trim();
      if (
        !/召唤/.test(nextWindow) &&
        !(summonMode && nextWindow.includes(summonMode)) &&
        !(summonName && nextWindow.includes(summonName))
      ) return;
      const closed = createIndex >= 0 && ledger.slice(createIndex + 1).some(event =>
        String(event?.eventKind || '').trim() === 'summon_end' &&
        (
          (!!summonKey && [event?.actorId, event?.targetId, event?.meta?.summonKey].some(value => String(value || '').trim() === summonKey)) ||
          (!!summonName && [event?.actorName, event?.targetName, event?.meta?.summonName].some(value => String(value || '').trim() === summonName))
        )
      );
      if (closed) failures.push({
        code: 'EXHAUSTED_SUMMON_WINDOW_STILL_REPORTED',
        blockId: block?.blockId,
        factId: fact?.factId,
        summonName,
      });
    });
  });
  decisions.forEach(entry => {
    const audits = Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : [];
    const selected = entry?.selected || audits.find(candidate => candidate?.selected === true);
    const safeTerminal = audits.find(candidate =>
      Number(candidate?.vector?.terminalUtility || 0) >= 100 &&
      Number(candidate?.vector?.catastrophicRisk || 0) <= 1e-9 &&
      Number(candidate?.vector?.irreversibleCost || 0) <= 1e-9 &&
      !String(candidate?.rejectionCode || '').trim()
    );
    if (safeTerminal && Number(selected?.vector?.terminalUtility || 0) < 100) {
      failures.push({
        code: 'SAFE_TERMINAL_OPPORTUNITY_MISSED',
        round: Number(entry?.round || entry?.回合 || 0),
        actorId: String(entry?.actorId || entry?.行动者 || '').trim(),
        selectedCandidateId: selected?.candidateId,
        terminalCandidateId: safeTerminal?.candidateId,
      });
    }
  });
  const damagingHitsMissingFormulaOperands = ledger.filter(event =>
    String(event?.eventKind || '').trim() === 'hit_result' &&
    Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0 &&
    (!(Number(event?.meta?.formulaTrace?.attackValue || 0) > 0) ||
      !(Number(event?.meta?.formulaTrace?.defenseValue || 0) > 0) ||
      event?.meta?.attackDefenseRatioAudit?.missingOperand === true)
  );
  if (damagingHitsMissingFormulaOperands.length) {
    failures.push({ code: 'DAMAGE_FORMULA_OPERAND_MISSING', count: damagingHitsMissingFormulaOperands.length });
  }
  const playerReportText = JSON.stringify({
    reportBlocks,
    finalBattleReport: result?.finalBattleReport || null,
  });
  if (/preview:battle-action-/i.test(playerReportText)) {
    failures.push({ code: 'PLAYER_REPORT_INTERNAL_STATE_ID_LEAK' });
  }
  const terminalCancellationEventIds = new Set(ledger
    .filter(event =>
      String(event?.eventKind || '').trim() === 'blocked_action' &&
      String(event?.ruleCode || event?.meta?.reasonCode || '').trim() === 'BATTLE_TERMINAL'
    )
    .map(event => String(event?.eventId || '').trim())
    .filter(Boolean));
  const projectedTerminalCancellation = reportBlocks.some(block =>
    (Array.isArray(block?.facts) ? block.facts : []).some(fact =>
      terminalCancellationEventIds.has(String(fact?.factId || '').trim())
    )
  );
  if (projectedTerminalCancellation) {
    failures.push({ code: 'PLAYER_REPORT_TERMINAL_CANCELLATION_LEAK' });
  }
  for (const field of ['candidateRelations', 'forbiddenSelections', 'requiredFacts', 'mutationRelations']) {
    if (!Array.isArray(definition?.[field]) || !definition[field].length) failures.push({ code: 'CASE_CONTRACT_FIELD_EMPTY', field });
  }
  if (!decisions.length) failures.push({ code: 'DECISION_AUDIT_EMPTY' });
  const forbidden = new Set((definition?.forbiddenSelections || []).map(String));
  decisions.forEach(entry => {
    const selected = entry?.selected;
    if (!selected?.candidateId) failures.push({ code: 'SELECTED_CANDIDATE_MISSING', round: Number(entry?.round || 0), actorId: entry?.actorId || '' });
    if (selected?.rejectionCode || forbidden.has(String(selected?.classification || '')) || forbidden.has(String(selected?.rejectionCode || ''))) {
      failures.push({ code: 'FORBIDDEN_SELECTION', round: Number(entry?.round || 0), actorId: entry?.actorId || '', candidateId: selected?.candidateId || '', rejectionCode: selected?.rejectionCode || '', classification: selected?.classification || '' });
    }
    const scoreAudit = Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : [];
    if (!scoreAudit.length || scoreAudit.length > 3 || !scoreAudit.some(candidate => candidate?.selected === true)) {
      failures.push({ code: 'SCORE_AUDIT_CONTRACT_INVALID', round: Number(entry?.round || 0), actorId: entry?.actorId || '', count: scoreAudit.length });
    }
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
  (definition?.requiredFacts || []).forEach(requirement => {
    if (requirement?.kind === 'event' && !ledger.some(event => String(event?.eventKind || '').trim() === String(requirement.eventKind || '').trim())) failures.push({ code: 'REQUIRED_LEDGER_FACT_MISSING', eventKind: requirement.eventKind });
    if (requirement?.kind === 'block' && !reportBlocks.some(block => String(block?.blockType || '').trim() === String(requirement.blockType || '').trim())) failures.push({ code: 'REQUIRED_REPORT_BLOCK_MISSING', blockType: requirement.blockType });
  });
  if ((definition?.mutationRelations || []).includes('INPUT_IMMUTABLE') && result?.inputUnchanged !== true) failures.push({ code: 'INPUT_MUTATION_RELATION_FAILED' });
  if (caseId === 'team_resource_support') {
    const repeatedSingleSupport = decisions.filter(entry =>
      Number(entry?.round || 0) > 1 &&
      entry?.actorId === '白寒樱' &&
      String(entry?.selected?.declaration?.skill?.name || entry?.selected?.declaration?.skill?.魂技名 || '').trim() === '情人桥',
    );
    if (repeatedSingleSupport.length) failures.push({ code: 'RESOURCE_SUPPORT_WITHOUT_MATERIAL_UNLOCK', count: repeatedSingleSupport.length });
  }
  if (caseId === 'team_counter_coordination') {
    const counterWindows = ledger.filter(event => String(event?.eventKind || '').trim() === 'counter_window');
    const counterDecisions = decisions.filter(entry => String(entry?.actionRole || '').trim() === 'COUNTER');
    const openedWindows = counterWindows.filter(event => String(event?.result || '').trim() === 'opened');
    const missedWindows = counterWindows.filter(event => String(event?.result || '').trim() === 'missed');
    const settledCounters = ledger.filter(event =>
      String(event?.actionRole || '').trim() === 'COUNTER' &&
      String(event?.eventKind || '').trim() === 'hit_result'
    );
    const counterSideErrors = ledger.filter(event =>
      ['counter', 'dodge', 'defend', 'pass'].includes(String(event?.eventKind || '').trim()) &&
      event?.actorName && event?.targetName && event.actorName !== event.targetName &&
      (!event.actorSide || !event.targetSide || event.actorSide === event.targetSide),
    );
    if (!counterWindows.length) failures.push({ code: 'TEAM_COUNTER_WINDOW_MISSING' });
    if (openedWindows.length && !counterDecisions.length) failures.push({ code: 'TEAM_COUNTER_DECISION_MISSING' });
    if (openedWindows.length && !settledCounters.length) failures.push({ code: 'TEAM_COUNTER_SETTLEMENT_MISSING' });
    if (counterDecisions.length > openedWindows.length) failures.push({ code: 'TEAM_COUNTER_WITHOUT_OPEN_WINDOW', count: counterDecisions.length - openedWindows.length });
    if (missedWindows.some(event => !(Number(event?.meta?.probability) >= 0 && Number(event?.meta?.probability) <= 1 && Number(event?.meta?.roll) >= 0))) {
      failures.push({ code: 'TEAM_COUNTER_FAILURE_AUDIT_MISSING' });
    }
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
    if (!(chargeRound >= 2)) failures.push({ code: 'UNKNOWN_CHARGE_RESOLVED_BEFORE_RESPONSE_WINDOW', chargeRound });
    if (priorResponses.length < 3 || !priorResponses.some(entry => (entry?.problems || []).some(problem => problem?.problemId === 'IMMINENT_DENIAL'))) {
      failures.push({ code: 'UNKNOWN_CHARGE_RESPONSE_DECISIONS_MISSING', count: priorResponses.length });
    }
  }
  if (caseId === 'summon_one_window') {
    const summonCreates = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'summon_create' &&
      String(event?.actorName || '').trim() === '韦小枫'
    );
    const assistStarts = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'action_start' &&
      String(event?.actionRole || '').trim() === 'ASSIST' &&
      String(event?.actorSide || '').trim() === 'player'
    );
    if (summonCreates.length !== 1) failures.push({ code: 'SUMMON_CREATE_COUNT_INVALID', count: summonCreates.length });
    if (assistStarts.length !== 1) failures.push({ code: 'SUMMON_ASSIST_COUNT_INVALID', count: assistStarts.length });
    if (assistStarts.length === 1 && !summonCreates.some(event =>
      String(assistStarts[0]?.sourceActionId || '').trim() === String(event?.actionId || event?.sourceActionId || '').trim()
    )) {
      failures.push({ code: 'SUMMON_ASSIST_PARENT_MISMATCH' });
    }
  }
  if (caseId === 'raid_summon_heavy') {
    const summonCreates = ledger.filter(event => String(event?.eventKind || '').trim() === 'summon_create');
    const summonHosts = new Set(summonCreates.map(event => String(event?.actorName || '').trim()).filter(Boolean));
    const summonWindows = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'action_start' &&
      String(event?.actionRole || '').trim() === 'ASSIST'
    );
    if (summonCreates.length < 2 || summonHosts.size < 2) {
      failures.push({ code: 'SUMMON_HEAVY_DIVERSITY_MISSING', summonCount: summonCreates.length, hostCount: summonHosts.size });
    }
    if (summonWindows.length < 2) failures.push({ code: 'SUMMON_HEAVY_WINDOWS_MISSING', count: summonWindows.length });
  }
  if (caseId === 'raid_balanced') {
    const playerDamage = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'hit_result' &&
      String(event?.actorSide || '').trim() === 'player'
    ).reduce((sum, event) => sum + Math.max(0, Number(event?.meta?.appliedDamage || event?.appliedDamage || 0)), 0);
    const enemyDamage = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'hit_result' &&
      String(event?.actorSide || '').trim() === 'enemy'
    ).reduce((sum, event) => sum + Math.max(0, Number(event?.meta?.appliedDamage || event?.appliedDamage || 0)), 0);
    const damageRatio = playerDamage / Math.max(1, enemyDamage);
    const playerStanding = (result?.finalSnapshot?.team_player || []).filter(unit => Number(unit?.hp || unit?.HP || 0) > 0).length;
    const enemyStanding = (result?.finalSnapshot?.team_enemy || []).filter(unit => Number(unit?.hp || unit?.HP || 0) > 0).length;
    if (Number(result?.roundsExecuted || 0) !== 5 || String(result?.winner || '').trim() !== 'draw') {
      failures.push({ code: 'BALANCED_RAID_DID_NOT_REACH_DRAWN_LIMIT', rounds: result?.roundsExecuted, winner: result?.winner });
    }
    if (damageRatio < 0.6 || damageRatio > 1.67) {
      failures.push({ code: 'BALANCED_RAID_DAMAGE_CAPACITY_SKEWED', playerDamage, enemyDamage, damageRatio });
    }
    if (playerStanding < 2 || enemyStanding < 2) {
      failures.push({ code: 'BALANCED_RAID_SIDE_COLLAPSED', playerStanding, enemyStanding });
    }
  }
  if (caseId === 'item_creation_consumption') {
    const enemyIds = new Set((definition?.combatData?.参战者?.team_enemy || [])
      .map(unit => String(unit?.id || unit?.name || unit?.名称 || '').trim())
      .filter(Boolean));
    const enemyDecisions = decisions.filter(entry =>
      enemyIds.has(String(entry?.actorId || '').trim()) &&
      String(entry?.actionRole || 'ACTIVE').trim() === 'ACTIVE'
    );
    const enemyOffensiveDecisions = enemyDecisions.filter(entry =>
      ['BASIC_ATTACK', 'RELEASE_SKILL'].includes(String(entry?.selected?.declaration?.actionKind || '').trim())
    );
    const enemyDamageFacts = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'hit_result' &&
      String(event?.actorSide || '').trim() === 'enemy' &&
      Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0
    );
    const itemDecisions = decisions.filter(entry => entry?.selected?.declaration?.actionKind === 'USE_ITEM');
    const creates = ledger.filter(event => String(event?.eventKind || '').trim() === 'create' && String(event?.createdName || event?.meta?.createdName || '').trim() === '恢复大肉包');
    const consumes = ledger.filter(event => String(event?.eventKind || '').trim() === 'item_consume' && String(event?.meta?.itemName || '').trim() === '恢复大肉包');
    const recoveries = ledger.filter(event => String(event?.eventKind || '').trim() === 'resource_change' && String(event?.actionName || '').trim() === '恢复大肉包');
    const createdCount = creates.reduce((sum, event) => sum + Math.max(0, Number(event?.count || event?.meta?.count || 0)), 0);
    const consumedCount = consumes.reduce((sum, event) => sum + Math.abs(Math.min(0, Number(event?.meta?.delta || 0))), 0);
    if (!itemDecisions.length) failures.push({ code: 'ITEM_USE_DECISION_MISSING' });
    if (!(createdCount > 0)) failures.push({ code: 'ITEM_CREATION_FACT_MISSING' });
    if (!(consumedCount > 0)) failures.push({ code: 'ITEM_CONSUMPTION_FACT_MISSING' });
    if (!enemyOffensiveDecisions.length) failures.push({ code: 'ITEM_CASE_ENEMY_OFFENSE_MISSING' });
    if (!enemyDamageFacts.length) failures.push({ code: 'ITEM_CASE_ENEMY_DAMAGE_MISSING' });
    enemyIds.forEach(actorId => {
      const actorDecisions = enemyDecisions.filter(entry => String(entry?.actorId || '').trim() === actorId);
      if (
        actorDecisions.length >= 2 &&
        actorDecisions.every(entry => ['DEFEND', 'EVADE'].includes(String(entry?.selected?.declaration?.actionKind || '').trim()))
      ) {
        failures.push({ code: 'ITEM_CASE_ENEMY_PASSIVE_LOOP', actorId, count: actorDecisions.length });
      }
    });
    if (!recoveries.some(event => /生命|HP/i.test(String(event?.meta?.resource || event?.resource || '')) && String(event?.actorName || '') !== String(event?.targetName || ''))) failures.push({ code: 'ITEM_ALLY_HP_RECOVERY_MISSING' });
    if (!recoveries.some(event => /体力|vit|sta/i.test(String(event?.meta?.resource || event?.resource || '')) && String(event?.actorName || '') !== String(event?.targetName || ''))) failures.push({ code: 'ITEM_ALLY_STAMINA_RECOVERY_MISSING' });
    let inventoryBalance = 0;
    let inventoryMismatch = null;
    ledger.filter(event =>
      (String(event?.eventKind || '').trim() === 'create' && String(event?.createdName || event?.meta?.createdName || '').trim() === '恢复大肉包') ||
      (String(event?.eventKind || '').trim() === 'item_consume' && String(event?.meta?.itemName || '').trim() === '恢复大肉包')
    ).forEach(event => {
      if (inventoryMismatch) return;
      if (String(event?.eventKind || '').trim() === 'create') {
        inventoryBalance += Math.max(0, Number(event?.count || event?.meta?.count || 0));
        return;
      }
      const quantityBefore = Number(event?.meta?.quantityBefore);
      const remainingQuantity = Number(event?.meta?.remainingQuantity);
      const consumed = Math.abs(Math.min(0, Number(event?.meta?.delta || 0)));
      if (!Number.isFinite(quantityBefore) || !Number.isFinite(remainingQuantity) || quantityBefore !== inventoryBalance || remainingQuantity !== quantityBefore - consumed) {
        inventoryMismatch = { quantityBefore, inventoryBalance, consumed, remainingQuantity };
        return;
      }
      inventoryBalance = remainingQuantity;
    });
    if (inventoryMismatch || inventoryBalance !== createdCount - consumedCount) {
      failures.push({ code: 'ITEM_INVENTORY_BALANCE_MISMATCH', ...(inventoryMismatch || {}), createdCount, consumedCount, inventoryBalance });
    }
  }
  if (caseId === 'team_heal_crisis') {
    const healingFacts = ledger.filter(event =>
      String(event?.eventKind || '').trim() === 'resource_change' &&
      String(event?.actorName || '').trim() === '雅莉' &&
      String(event?.actorName || '').trim() !== String(event?.targetName || '').trim() &&
      /生命|HP/i.test(String(event?.meta?.resource || event?.resource || '').trim()) &&
      Number(event?.meta?.delta || event?.delta || 0) > 0
    );
    if (!healingFacts.length) failures.push({ code: 'HEAL_CRISIS_EFFECTIVE_ALLY_HEAL_MISSING' });
    if (healingFacts.some(event => Number(event?.meta?.delta || event?.delta || 0) <= 0)) {
      failures.push({ code: 'HEAL_CRISIS_ZERO_VALUE_HEAL_RECORDED' });
    }
  }
  if (caseId === 'team_control_overlap') {
    const guardedBlock = actionReportBlocks.find(block =>
      (Array.isArray(block?.facts) ? block.facts : []).some(fact =>
        String(fact?.eventKind || '').trim() === 'action_start' &&
        String(fact?.actionRole || '').trim() === 'REACTION' &&
        String(fact?.actionName || '').trim() === '白虎护身障'
      )
    );
    if (!guardedBlock || !String(guardedBlock?.outcomeSummary || '').includes('【白虎护身障】')) {
      failures.push({
        code: 'REACTION_SKILL_CAUSAL_NARRATIVE_MISSING',
        blockId: guardedBlock?.blockId || '',
        outcomeSummary: guardedBlock?.outcomeSummary || '',
      });
    }
  }
  if (caseId === 'team_unknown_enemy_adaptation') {
    const lostOpportunityBlock = actionReportBlocks.find(block =>
      (Array.isArray(block?.facts) ? block.facts : []).some(fact =>
        String(fact?.eventKind || '').trim() === 'blocked_action' &&
        /UNCONSCIOUS/i.test(String(fact?.reasonCode || ''))
      )
    );
    if (!lostOpportunityBlock || !/因昏迷失去本回合行动机会/.test(String(lostOpportunityBlock?.outcomeSummary || ''))) {
      failures.push({
        code: 'UNCONSCIOUS_OPPORTUNITY_REASON_MISPROJECTED',
        blockId: lostOpportunityBlock?.blockId || '',
        outcomeSummary: lostOpportunityBlock?.outcomeSummary || '',
      });
    }
  }
  if (caseId === 'equipment_switch_no_loop') {
    const selectedEquip = decisions.filter(entry => entry?.selected?.declaration?.actionKind === 'EQUIP');
    const equippedFacts = ledger.filter(event => String(event?.eventKind || '').trim() === 'complete' && String(event?.result || '').trim() === 'equipped');
    const equippedRound = Math.min(...equippedFacts.map(event => Number(event?.round || 0)));
    const repeatedEquipCandidates = decisions.filter(entry => Number(entry?.round || 0) > equippedRound).flatMap(entry => entry?.candidates || []).filter(candidate => candidate?.declaration?.actionKind === 'EQUIP');
    const blockedEquip = ledger.filter(event => ['blocked_action', 'failed_action'].includes(String(event?.eventKind || '').trim()) && String(event?.actionName || '').trim() === '疾风试作匕首');
    if (selectedEquip.length > 1) failures.push({ code: 'EQUIPMENT_SELECTION_COUNT_INVALID', count: selectedEquip.length });
    if (repeatedEquipCandidates.length) failures.push({ code: 'EQUIPMENT_REOFFERED_AFTER_EQUIP', count: repeatedEquipCandidates.length });
    if (equippedFacts.length !== 1) failures.push({ code: 'EQUIPMENT_TERMINAL_INVALID', count: equippedFacts.length });
    if (blockedEquip.length) failures.push({ code: 'EQUIPMENT_FALSE_FAILURE', count: blockedEquip.length });
    if (!ledger.some(event =>
      String(event?.eventKind || '').trim() === 'effect_resolved' &&
      String(event?.effectPrototype || '').trim() === '属性修正' &&
      String(event?.meta?.effectDetail?.attribute || '').includes('敏捷')
    )) failures.push({ code: 'EQUIPMENT_ATTRIBUTE_EFFECT_MISSING' });
    if (/敏捷调整/.test(String(result?.finalBattleReport?.text || ''))) failures.push({ code: 'EQUIPMENT_INTERNAL_STATE_LEAK' });
  }
  return failures;
}

const formalDefinition = {
  caseId: 'weixiaofeng_20_round',
  seed: 730031,
  rounds: 20,
  intent: '点到为止',
  initialBelief: {},
  sourceCharacterIds: ['唐凌雪', '韦小枫'],
  sourceDataHashes: {},
  candidateRelations: ['SELECTED_IS_LEGAL', 'SCORE_AUDIT_SELECTED_AND_TWO_ALTERNATIVES'],
  forbiddenSelections: ['HARD_INVALID', 'DOMINATED', 'ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'ZERO_PROGRESS'],
  requiredFacts: [{ kind: 'event', eventKind: 'action_start' }, { kind: 'block', blockType: 'ROUND_SUMMARY' }],
  mutationRelations: ['INPUT_IMMUTABLE'],
  combatData: buildWeixiaofengFormalCase(context.__LWCS_内置角色库__),
};
const reviewDefinitions = [...buildManualCases(context.__LWCS_内置角色库__, context.__LWCS_GET_BASE_STATS__), formalDefinition];
for (const definition of reviewDefinitions.filter(item =>
  (!requestedCase || item.caseId === requestedCase) && (!blindPass || blindCaseIds.includes(item.caseId)),
)) {
  process.stderr.write(`[r63-review] ${definition.caseId}\n`);
  const isFormalCase = definition.caseId === 'weixiaofeng_20_round';
  const seed = Number.isFinite(requestedSeed) && requestedSeed > 0 ? Math.floor(requestedSeed) : definition.seed;
  const result = context.__LWCS_DEBUG_RUN_BATTLE_CASE__({
    caseId: definition.caseId,
    seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    selectedAction: definition.selectedAction,
    settings: {},
  });
  const review = battleR63ManualReviewNotes[definition.caseId]
    || (isFormalCase ? {
      behavior: '正式20回合案例由正式门禁验证行为契约、终局条件、Ledger守恒和确定性；不冒充人工真实性结论。',
      narrative: '正式案例的结构化战报由正式案例门禁验证事实来源、回合覆盖和终局投影。',
      anomalies: '人工真实性结论不在正式案例自动记录中，避免把自动契约检查伪装成人工审阅。',
      alternatives: '人工真实性判断由24场独立案例审阅承担。',
      responsibility: '正式案例自动门禁',
      blocking: false,
      reviewType: 'FORMAL_AUTOMATED_CONTRACT',
    } : null)
    || (draftReview ? { behavior: '', narrative: '', anomalies: '', alternatives: '', responsibility: '', blocking: false } : null);
  if (!review) throw new Error(`r63_manual_review_note_missing:${definition.caseId}`);
  const fatalDetails = [
    ...(result.audit?.fatals || []),
    ...validateCaseContract(definition, result),
    ...(review.blocking === true ? [{ code: 'MANUAL_REALISM_REVIEW_BLOCKED', caseId: definition.caseId }] : []),
  ];
  const ledgerHash = hash(result.ledger);
  const reportHash = hash(result.reportBlocks);
  const reviewedEvidence = battleR63ManualReviewEvidence[definition.caseId];
  if (!isFormalCase && !draftReview && !captureEvidence && !refreshReviewReports && !blindPass
    && (!reviewedEvidence || reviewedEvidence.ledgerHash !== ledgerHash || reviewedEvidence.reportHash !== reportHash)) {
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
  (Array.isArray(result.reportBlocks) ? result.reportBlocks : []).forEach(block => {
      lines.push(`### Round ${Number(block?.round || 0)} / ${String(block?.blockType || 'UNKNOWN')}`);
      if (block?.intentSummary) lines.push(`- Intent: ${block.intentSummary}`);
      if (block?.outcomeSummary) lines.push(`- Outcome: ${block.outcomeSummary}`);
      if (block?.nextWindow) lines.push(`- Next window: ${block.nextWindow}`);
      const facts = Array.isArray(block?.facts) ? block.facts : [];
      facts.forEach(fact => {
        const value = Number(fact?.value || 0);
        const valueText = value ? ` value=${value}` : '';
        const stateText = fact?.stateName ? ` [${fact.stateName}]` : '';
        const resultText = String(fact?.eventKind || '').trim() === 'effect_resolved' && String(fact?.effectSummary || '').trim()
          ? fact.effectSummary
          : fact?.resultState || '';
        lines.push(`- Fact ${fact?.factType || 'EVENT'}: ${fact?.actorName || ''} -> ${fact?.targetName || ''} ${fact?.actionName || ''}${stateText}${valueText} ${resultText}`.trim());
      });
      (Array.isArray(block?.badges) ? block.badges : []).forEach(badge => {
        lines.push(`- Badge ${badge?.name || badge?.kind || ''}: ${badge?.targetName || badge?.targetId || ''} ${badge?.value || 0}${badge?.unit || ''}`.trim());
      });
      lines.push('');
    });
  lines.push('## Final Snapshot', '', '```json', JSON.stringify(result.finalSnapshot, null, 2), '```', '', '## Complete Raw Logs', '', '```text', ...result.logs, '```', '', '## Review', '', `- 行为结论：${review.behavior}`, `- 叙事结论：${review.narrative}`, `- 反常识点：${review.anomalies}`, `- 合理替代：${review.alternatives}`, `- 责任模块：${review.responsibility}`, `- 是否阻断：${review.blocking ? '是' : '否'}`, '');
  const reportPath = path.join(outputDir, `${definition.caseId}.md`);
  if (blindPass) {
    const blindLines = [
      `# ${definition.caseId} / Blind pass ${blindPass}`,
      '',
      `- Code freeze: ${codeFreezeCommit}`,
      `- Runtime source hash: ${runtimeSourceHash}`,
      `- Input hash: ${hash(definition.combatData)}`,
      `- Belief hash: ${hash(definition.initialBelief)}`,
      `- Ledger hash: ${ledgerHash}`,
      `- Report hash: ${reportHash}`,
      '',
    ];
    if (blindPass === 1) {
      blindLines.push('## 玩家可见完整战报', '', String(result.finalBattleReport?.text || ''));
      (result.reportBlocks || []).forEach(block => {
        blindLines.push('', `### 第${Number(block?.round || 0)}回合 / ${String(block?.blockType || '')}`);
        if (block?.intentSummary) blindLines.push(`- 意图：${block.intentSummary}`);
        if (block?.outcomeSummary) blindLines.push(`- 结果：${block.outcomeSummary}`);
        if (block?.nextWindow) blindLines.push(`- 后续：${block.nextWindow}`);
        (block?.badges || []).forEach(badge => {
          const value = Number(badge?.value || 0);
          const numeric = value !== 0 || ['damage', 'heal', 'shield', 'resource'].includes(String(badge?.kind || '').trim());
          blindLines.push(`- ${numeric ? '数值' : '状态'}：${badge?.targetName || badge?.targetId || ''} ${badge?.name || badge?.kind || ''}${numeric ? ` ${value}${badge?.unit || ''}` : ''}`.trim());
        });
      });
    } else if (blindPass === 2) {
      blindLines.push('## 认知、候选与事实', '');
      (result.decisions || []).forEach(entry => {
        blindLines.push(`- 第${entry.round}回合 ${entry.actorId}：${entry.selected?.candidateId || 'NO_SELECTION'}；问题=${(entry.problems || []).map(problem => problem.problemId).join(',')}`);
        blindLines.push(`  - 团队意图=${JSON.stringify(entry.teamIntent || {})}`);
        (entry.scoreAudit || []).forEach(candidate => blindLines.push(`  - ${candidate.selected ? '选中' : '替代'} ${candidate.candidateId} utility=${Number(candidate.objectiveUtility || 0).toFixed(3)} ${candidate.rejectionCode || ''}`));
      });
      blindLines.push('', '## Ledger', '', '```json', JSON.stringify(result.ledger, null, 2), '```');
    } else {
      blindLines.push('## 连续策略、学习与双方互动', '');
      const byActor = new Map();
      (result.decisions || []).forEach(entry => {
        if (!byActor.has(entry.actorId)) byActor.set(entry.actorId, []);
        byActor.get(entry.actorId).push({ round: entry.round, role: entry.actionRole, selected: entry.selected?.candidateId || '', problems: (entry.problems || []).map(problem => problem.problemId), teamIntent: entry.teamIntent || {}, strategyMemory: entry.strategyMemory || {} });
      });
      for (const [actorId, decisions] of byActor) blindLines.push(`- ${actorId}: ${JSON.stringify(decisions)}`);
      blindLines.push('', '## 认知更新', '', '```json', JSON.stringify(result.beliefObservations || [], null, 2), '```');
    }
    fs.writeFileSync(path.join(blindOutputDir, `${definition.caseId}.md`), blindLines.join('\n'), 'utf8');
  } else if (!captureEvidence && !verifyReviewHashes) {
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  }
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
    sourceDataHashes: definition.sourceDataHashes,
    codeFreezeCommit,
    runtimeSourceHash,
    manualDefinitionHash,
    candidateRelations: definition.candidateRelations,
    forbiddenSelections: definition.forbiddenSelections,
    requiredFacts: definition.requiredFacts,
    mutationRelations: definition.mutationRelations,
    gitHead,
    worktreeHash,
    beliefObservationCount: Array.isArray(result.beliefObservations) ? result.beliefObservations.length : 0,
    review,
  });
}
if (verifyReviewHashes) {
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('r63_manual_review_manifest_missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const recordedByCase = new Map((Array.isArray(manifest) ? manifest : []).map(item => [String(item?.caseId || '').trim(), item]));
  const mismatches = [];
  const compare = (caseId, field, current, recorded) => {
    if (JSON.stringify(current) !== JSON.stringify(recorded)) mismatches.push({ caseId, field, current, recorded });
  };
  compare('MANIFEST', 'caseIds', results.map(item => item.caseId).sort(), [...recordedByCase.keys()].sort());
  results.forEach(current => {
    const recorded = recordedByCase.get(current.caseId);
    if (!recorded) {
      mismatches.push({ caseId: current.caseId, field: 'manifestEntry', current: 'present', recorded: 'missing' });
      return;
    }
    compare(current.caseId, 'codeFreezeCommit', gitHead, recorded.codeFreezeCommit);
    compare(current.caseId, 'runtimeSourceHash', runtimeSourceHash, recorded.runtimeSourceHash);
    compare(current.caseId, 'manualDefinitionHash', manualDefinitionHash, recorded.manualDefinitionHash);
    compare(current.caseId, 'inputHash', current.inputHash, recorded.inputHash);
    compare(current.caseId, 'beliefHash', current.beliefHash, recorded.beliefHash);
    compare(current.caseId, 'ledgerHash', current.ledgerHash, recorded.ledgerHash);
    compare(current.caseId, 'reportHash', current.reportHash, recorded.reportHash);
    compare(current.caseId, 'sourceDataHashes', current.sourceDataHashes, recorded.sourceDataHashes);
    if (Number(current.fatalCount || 0) !== 0) mismatches.push({ caseId: current.caseId, field: 'fatalCount', current: current.fatalCount, recorded: 0 });
  });
  if (mismatches.length) throw new Error(`r63_manual_review_hash_mismatch:${JSON.stringify(mismatches.slice(0, 12))}`);
  console.log(JSON.stringify({ summary: { caseCount: results.length, fatalCount: 0, evidenceHashesValid: true, codeFreezeCommit: gitHead, runtimeSourceHash } }, null, 2));
  process.exit(0);
}
if (blindPass) {
  fs.writeFileSync(path.join(blindOutputDir, 'manifest.json'), JSON.stringify({ codeFreezeCommit, runtimeSourceHash, manualDefinitionHash, blindCaseIds, pass: blindPass, results }, null, 2), 'utf8');
} else if (!captureEvidence && !verifyReviewHashes) {
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(results, null, 2), 'utf8');
}
console.log(JSON.stringify({ summary: { caseCount: results.length, fatalCount: results.reduce((sum, item) => sum + item.fatalCount, 0), blindPass, blindCaseIds: blindPass ? blindCaseIds : [] }, results }, null, 2));

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
const requestedCase = String(process.env.R63_CASE || '').trim();
const requestedSeed = Number(process.env.R63_SEED || 0);
const captureEvidence = String(process.env.R63_CAPTURE_EVIDENCE || '').trim() === '1';
for (const definition of buildManualCases(context.__LWCS_内置角色库__, context.__LWCS_GET_BASE_STATS__).filter(item => !requestedCase || item.caseId === requestedCase)) {
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
  const ledgerHash = hash(result.ledger);
  const reportHash = hash(result.reportBlocks);
  const reviewedEvidence = battleR63ManualReviewEvidence[definition.caseId];
  if (!captureEvidence && (!reviewedEvidence || reviewedEvidence.ledgerHash !== ledgerHash || reviewedEvidence.reportHash !== reportHash)) {
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
    `- Fatal count: ${result.audit?.fatals?.length || 0}`,
    `- Fatal details: ${JSON.stringify(result.audit?.fatals || [])}`,
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
      'action_start', 'hit_result', 'resource_change', 'state_apply', 'state_resisted', 'state_expire',
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
    fatalCount: result.audit?.fatals?.length || 0,
    fatalDetails: result.audit?.fatals || [],
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

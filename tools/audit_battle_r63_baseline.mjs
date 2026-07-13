import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manualBattleCases, determinismCaseIds } from './battle_r63_manual_manifest.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const read = relativePath => fs.readFileSync(path.resolve(root, relativePath), 'utf8');
const battleUi = read('lwcs/BattleUI_Module.js');
const battleRuntime = read('lwcs/BattleRuntime_Module.js');
const battleDecision = read('lwcs/BattleDecision_Module.js');
const formalAudit = read('tools/audit_battle_v73_formal_cases.mjs');
const reviewTemplate = read('lwcs/tools/battle_r63_manual_review_template.md');

const failures = [];
const warnings = [];
const forbiddenLegacyFunctions = [
  '评估技能规划净收益',
  '评估技能行为库衔接收益',
  '估算效果行为库衔接收益',
  'chooseActorActionByCandidates',
];
const requiredFatalTokens = [
  'DUPLICATE_DAMAGE_FACT',
  'NON_DAMAGE_SKILL_DAMAGE',
  'ZERO_PROBABILITY_SUCCESS',
  'ACTION_TERMINAL_CONFLICT',
  'DOT_SOURCE_MISPROJECTED',
  'SUMMON_WINDOW_MISSING',
  'ACTION_GRANT_CONSUMED_TWICE',
  'NATURAL_ACTION_OPPORTUNITY_MISSING',
];

if (!/__LWCS_DEBUG_RUN_BATTLE_CASE__/.test(battleUi)) failures.push('DEBUG_ENTRY_MISSING');
if (!/function decide\(input = \{\}\)/.test(battleDecision) || !/function paretoFilter\(/.test(battleDecision) || !/function selectCandidate\(/.test(battleDecision)) failures.push('R63_DECISION_BOUNDARY_MISSING');
forbiddenLegacyFunctions.forEach(name => {
  if (battleUi.includes(name) || battleRuntime.includes(name)) failures.push(`LEGACY_SCORER_REMAINS:${name}`);
});
requiredFatalTokens.forEach(token => {
  if (!formalAudit.includes(token)) failures.push(`BASELINE_FATAL_INJECTION_MISSING:${token}`);
});

if (manualBattleCases.length !== 24) failures.push(`MANUAL_MANIFEST_SIZE:${manualBattleCases.length}`);
if (new Set(manualBattleCases.map(item => item.caseId)).size !== manualBattleCases.length) failures.push('MANUAL_MANIFEST_DUPLICATE_CASE_ID');
const groupCounts = Object.fromEntries(['duel', 'team', 'raid', 'special'].map(group => [group, manualBattleCases.filter(item => item.group === group).length]));
if (JSON.stringify(groupCounts) !== JSON.stringify({ duel: 8, team: 8, raid: 4, special: 4 })) failures.push(`MANUAL_MANIFEST_GROUPS:${JSON.stringify(groupCounts)}`);
determinismCaseIds.forEach(caseId => {
  if (!manualBattleCases.some(item => item.caseId === caseId)) failures.push(`DETERMINISM_CASE_UNKNOWN:${caseId}`);
});
['玩家视角盲读', '因果复核', '连续战术复核', '行为结论', '叙事结论', '是否阻断'].forEach(section => {
  if (!reviewTemplate.includes(section)) failures.push(`REVIEW_TEMPLATE_SECTION_MISSING:${section}`);
});

const cloneCount = (battleUi.match(/deepClonePlain\(|deepClone\(/g) || []).length;
const stringifyCount = (battleUi.match(/JSON\.stringify\(/g) || []).length;
if (cloneCount > 100) warnings.push(`LEGACY_DEEP_CLONE_CALLS:${cloneCount}`);
if (stringifyCount > 100) warnings.push(`LEGACY_STRINGIFY_CALLS:${stringifyCount}`);

const output = {
  summary: {
    failureCount: failures.length,
    warningCount: warnings.length,
    manualCaseCount: manualBattleCases.length,
    determinismCaseCount: determinismCaseIds.length,
    legacyCloneCallCount: cloneCount,
    legacyStringifyCallCount: stringifyCount,
  },
  failures,
  warnings,
  groupCounts,
};

console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;

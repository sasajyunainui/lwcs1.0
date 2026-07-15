import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');

function createSandbox() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    Intl,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const sandbox = createSandbox();
for (const relativePath of [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleReport_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const reportRuntime = sandbox.__LWCS_BATTLE_REPORT__;
assert.ok(runtime && reportRuntime, 'BattleRuntime/BattleReport 未加载');

const cases = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__);
const requiredCaseIds = [
  'duel_agile_counter_options',
  'team_multi_target_response',
  'raid_summon_heavy',
  'item_creation_consumption',
];
const caseMap = new Map(cases.map(item => [item.caseId, item]));
requiredCaseIds.forEach(caseId => assert.ok(caseMap.has(caseId), `Phase 7 案例缺失:${caseId}`));

function clone(value) {
  return runtime.cloneValue(value);
}

function findInternalPaths(value, currentPath = '$', results = []) {
  if (typeof value === 'string') {
    if (/(?:structured-summon|battle-summon|summon-instance):/i.test(value)) {
      results.push({ path: currentPath, value });
    }
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findInternalPaths(item, `${currentPath}[${index}]`, results));
    return results;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => findInternalPaths(item, `${currentPath}.${key}`, results));
  }
  return results;
}

function runCase(definition) {
  const sourceInput = {
    caseId: definition.caseId,
    seed: definition.seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    selectedAction: definition.selectedAction,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    settings: {},
  };
  const before = JSON.stringify(sourceInput);
  const draft = runtime.executeBattleDraft(sourceInput);
  assert.equal(JSON.stringify(sourceInput), before, `${definition.caseId} 修改了调用方输入`);
  assert.equal(draft.status, 'DRAFT', `${definition.caseId} 草案状态错误`);
  assert.ok(draft.ledger.length > 0, `${definition.caseId} 没有Ledger事实`);
  assert.ok(draft.trace.length > 0, `${definition.caseId} 没有Trace`);
  const playerAudit = reportRuntime.auditProjection(reportRuntime.build({ draft, visibilityMode: 'PLAYER' }));
  const playerAuditLeak = JSON.stringify(playerAudit.reportDto).match(/(?:structured-summon|battle-summon|summon-instance):[^"\\\s,，。；;|]+/gi) || [];
  assert.equal(
    playerAudit.passed,
    true,
    `${definition.caseId} PLAYER Projection失败:${JSON.stringify(playerAudit.fatals)}:${playerAuditLeak.slice(0, 5).join('|')}:${JSON.stringify(findInternalPaths(playerAudit.reportDto).slice(0, 5))}`,
  );
  const developerAudit = reportRuntime.auditProjection(reportRuntime.build({ draft, visibilityMode: 'DEVELOPER' }));
  assert.equal(developerAudit.passed, true, `${definition.caseId} DEVELOPER Projection失败:${JSON.stringify(developerAudit.fatals)}`);
  const player = playerAudit.reportDto;
  const developer = developerAudit.reportDto;

  assert.equal(player.actualRoundCount, draft.actualRoundCount, `${definition.caseId} 实际回合数漂移`);
  assert.deepEqual(
    player.roundOverview.map(row => row.round),
    Array.from({ length: draft.actualRoundCount }, (_, index) => index + 1),
    `${definition.caseId} 回合速览不连续`,
  );
  assert.equal(player.factRegistry.length, draft.ledger.length, `${definition.caseId} 事实数量漂移`);
  assert.ok(player.exchanges.length > 0, `${definition.caseId} 没有动作组交锋`);
  assert.ok(player.adjudications.length > 0, `${definition.caseId} 没有判定明细`);
  assert.ok(player.finalSummary && player.finalSummary.text, `${definition.caseId} 没有总结型战报`);
  assert.match(reportRuntime.serializeFullText(player), /回合速览/);
  assert.match(reportRuntime.serializeFullText(player), /动作组战报/);
  assert.match(reportRuntime.serializeFullText(player), /判定明细/);
  assert.match(reportRuntime.serializeFullText(player), /总结型战报/);
  assert.doesNotMatch(reportRuntime.serializeFullText(player), /ABORTED|RELEASE_SKILL|structured-summon:/i, `${definition.caseId} 完整战报泄漏内部枚举`);
  assert.ok(
    player.exchanges.every(exchange =>
      exchange.factIds.every(factId => !['state_tick', 'round_recover', 'summon_end', 'lost_opportunity', 'action_cancelled', 'blocked_action'].includes(
        player.factRegistry.find(fact => fact.factId === factId)?.eventKind,
      )),
    ),
    `${definition.caseId} 被动事实错误显示为动作组`,
  );
  assert.ok(
    player.factRegistry.every(fact => fact.canonicalFactOwner && fact.projectionRefs?.filter(ref => ref.projection === 'DETAIL').length === 1),
    `${definition.caseId} 存在无唯一详细所有者的事实`,
  );
  assert.ok(
    player.factRegistry.every(fact => fact.numericTokens.every(token =>
      token.sourceEventId === fact.factId && Number.isFinite(Number(token.value)),
    )),
    `${definition.caseId} 存在无来源数字`,
  );
  const playerSerialized = JSON.stringify(player);
  const internalLeakMatches = playerSerialized.match(/(?:structured-summon|battle-summon|summon-instance):[^"\\\s,，。；;|]+/gi) || [];
  assert.doesNotMatch(
    playerSerialized,
    /structured-summon:|battle-summon:|summon-instance:|"ruleCode"|"candidateId"|"rawDecision"|"developerDetail"/i,
    `${definition.caseId} PLAYER 投影泄漏内部字段:${internalLeakMatches.slice(0, 5).join('|')}`,
  );
  assert.doesNotMatch(
    JSON.stringify(player.aiSummaryInput),
    /scoreAudit|candidateId|ruleCode|formulaTrace|normalizedUtility|objectiveUtility|rawDecision/i,
    `${definition.caseId} AI摘要输入泄漏内部字段`,
  );
  assert.ok(
    developer.factRegistry.some(fact => fact.developerDetail),
    `${definition.caseId} DEVELOPER 投影缺少开发细节`,
  );

  return {
    definition,
    draft,
    player,
    developer,
    factKinds: [...new Set(player.factRegistry.map(fact => fact.eventKind))].sort(),
    actionNames: [...new Set(player.factRegistry.map(fact => fact.actionName).filter(Boolean))].sort(),
  };
}

const results = requiredCaseIds.map(caseId => runCase(caseMap.get(caseId)));

const dumpCaseIndex = process.argv.indexOf('--dump-case');
const dumpCaseId = dumpCaseIndex >= 0 ? String(process.argv[dumpCaseIndex + 1] || '').trim() : '';
if (dumpCaseId) {
  const dumpResult = results.find(item => item.definition.caseId === dumpCaseId);
  if (!dumpResult) throw new Error(`phase7_dump_case_missing:${dumpCaseId}`);
  console.log(`\n===== ${dumpCaseId} =====\n`);
  console.log(reportRuntime.serializeFullText(dumpResult.player));
  console.log(`\n===== END ${dumpCaseId} =====\n`);
}

const summonResult = results.find(item => item.definition.caseId === 'raid_summon_heavy');
const summonFacts = summonResult.player.factRegistry.filter(fact => fact.eventKind === 'summon_create');
assert.ok(summonFacts.length > 0, '召唤案例没有召唤生成事实');
assert.ok(
  summonFacts.every(fact =>
    !/召唤物$/.test(fact.summary) &&
    !/structured-summon:|battle-summon:|summon-instance:/i.test(JSON.stringify(fact)),
  ),
  '召唤事实没有投影真实名称或泄漏内部ID',
);

const dotFacts = results.flatMap(item => item.player.factRegistry.filter(fact =>
  fact.eventKind === 'state_tick' || fact.factType === 'STATE_TICK',
));
assert.ok(dotFacts.length > 0, '真实案例没有STATE_TICK事实');
assert.ok(
  dotFacts.every(fact =>
    fact.factType === 'STATE_TICK' &&
    fact.actionRole === 'STATE_TICK' &&
    fact.sourceActionId &&
    !/施展.*造成|直接造成/.test(fact.summary),
  ),
  'DOT被错误投影为源技能直接命中或缺少来源',
);

const multiTargetResult = results.find(item => item.definition.caseId === 'team_multi_target_response');
const multiTargetExchanges = multiTargetResult.player.exchanges.filter(exchange => exchange.targetIds.length > 1);
assert.ok(
  multiTargetExchanges.length > 0 ||
    multiTargetResult.player.factRegistry.some(fact => fact.targetIds.length > 1),
  '群攻案例没有保留多目标事实',
);
const multiTargetFactIds = multiTargetResult.player.factRegistry
  .filter(fact => fact.targetIds.length > 1)
  .map(fact => fact.factId);
assert.ok(
  multiTargetFactIds.every(factId => multiTargetResult.player.factRegistry.filter(fact => fact.factId === factId).length === 1),
  '群攻事实出现重复注册',
);

const resourceFacts = results.flatMap(item => item.player.factRegistry.filter(fact =>
  fact.eventKind === 'resource_change' || fact.eventKind === 'round_recover' || fact.eventKind === 'action_cost',
));
assert.ok(resourceFacts.length > 0, '真实案例没有资源事实');
assert.ok(
  resourceFacts.every(fact => fact.actorName && (fact.numericTokens.length > 0 || fact.eventKind === 'action_cost')),
  '资源事实缺少主体或数值来源',
);

const adjudicationChecks = results.flatMap(item => item.player.adjudications);
assert.ok(
  adjudicationChecks.every(item =>
    item.selected?.actionName &&
    Array.isArray(item.alternatives) &&
    item.alternatives.length <= 2 &&
    item.reasonSummary &&
    item.actual?.factIds?.length,
  ),
  '判定明细缺少选中动作、替代动作、原因或实际事实',
);

const summary = results.map(item => ({
  caseId: item.definition.caseId,
  seed: item.definition.seed,
  actualRoundCount: item.draft.actualRoundCount,
  inputHash: runtime.hashBattleValue(item.definition.combatData),
  beliefHash: runtime.hashBattleValue(item.definition.initialBelief || {}),
  ledgerHash: runtime.hashBattleValue(item.draft.ledger),
  factCount: item.player.factRegistry.length,
  exchangeCount: item.player.exchanges.length,
  adjudicationCount: item.player.adjudications.length,
  factKinds: item.factKinds,
  actionNames: item.actionNames.slice(0, 16),
  evidence: [...new Set([
    1,
    Math.max(1, Math.ceil(item.draft.actualRoundCount / 2)),
    item.draft.actualRoundCount,
  ])].map(round => item.player.exchanges.find(exchange => exchange.round === round))
    .filter(Boolean)
    .map(exchange => ({ round: exchange.round, exchangeId: exchange.exchangeId })),
  reportHash: reportRuntime.auditProjection(item.player).reportHash,
}));

console.log(JSON.stringify({
  summary,
  coverage: {
    cases: requiredCaseIds,
    summonFacts: summonFacts.length,
    dotFacts: dotFacts.length,
    multiTargetFacts: multiTargetFactIds.length,
    resourceFacts: resourceFacts.length,
    adjudications: adjudicationChecks.length,
    lazyFullText: true,
    playerDeveloperIsolation: true,
  },
  passed: true,
}, null, 2));

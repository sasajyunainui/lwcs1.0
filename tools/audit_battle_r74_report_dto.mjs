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
    console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
    Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
    parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const sandbox = createSandbox();
const entrySource = fs.readFileSync(path.resolve(root, 'lwcs/ST_UI_Entry.js'), 'utf8');
assert.ok(
  entrySource.indexOf("BattleRuntime_Module.js") <
    entrySource.indexOf("BattleReport_Module.js") &&
    entrySource.indexOf("BattleReport_Module.js") <
    entrySource.indexOf("BattleUI_Module.js"),
  '正式入口没有按Runtime→Report→UI加载'
);
assert.match(entrySource, /战斗模块:.*依赖: \['战斗战报运行时'\]/, 'BattleUI没有声明依赖BattleReport');
for (const relativePath of [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleReport_Module.js',
]) vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });

const definition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'duel_agile_counter_options');
assert.ok(definition, '真实反击案例缺失');

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const reportRuntime = sandbox.__LWCS_BATTLE_REPORT__;
const sourceInput = {
  caseId: definition.caseId,
  seed: definition.seed,
  combatData: definition.combatData,
  mode: 'team_preview',
  rounds: definition.rounds,
  initialBelief: definition.initialBelief,
  battleIntent: { mode: definition.intent },
  settings: { decisionEngine: 'next-shadow' },
};
const inputBefore = JSON.stringify(sourceInput);
const draft = runtime.executeBattleDraft(sourceInput);
assert.equal(JSON.stringify(sourceInput), inputBefore, 'executeBattleDraft修改了调用方输入');
assert.equal(draft.status, 'DRAFT', '战斗草案状态错误');
assert.ok(draft.draftHash, '战斗草案缺少Hash');
const draftForHash = runtime.cloneValue(draft);
delete draftForHash.draftHash;
assert.equal(runtime.hashBattleValue(draftForHash), draft.draftHash, '战斗草案Hash无法复算');
assert.ok(draft.ledger.length > 0 && draft.trace.length > 0, '战斗草案缺少Ledger或Trace');

const playerBuilt = reportRuntime.build({ draft, visibilityMode: 'PLAYER' });
const playerAudit = reportRuntime.auditProjection(playerBuilt);
assert.equal(playerAudit.passed, true, `PLAYER Projection Audit失败:${JSON.stringify(playerAudit.fatals)}`);
assert.equal(playerAudit.reportDto.projectionStatus, 'PASSED', 'PLAYER战报没有进入已审计状态');
assert.equal(playerAudit.reportDto.factRegistry.length, draft.ledger.length, 'Report遗漏或新增Ledger事实');
assert.equal(playerAudit.reportDto.roundOverview.length, draft.actualRoundCount, 'Report回合覆盖不连续');
assert.ok(playerAudit.reportDto.exchanges.length > 0, 'Report没有形成交锋所有者');
assert.ok(playerAudit.reportDto.factRegistry.every(fact =>
  fact.canonicalFactOwner &&
  Array.isArray(fact.projectionRefs) &&
  fact.projectionRefs.filter(ref => ref?.projection === 'DETAIL').length === 1
), '原子事实没有且仅有一个详细所有者');
assert.ok(playerAudit.reportDto.factRegistry.every(fact =>
  !Object.hasOwn(fact, 'developerDetail') &&
  fact.numericTokens.every(token => token.sourceEventId === fact.factId && Number.isFinite(Number(token.value)))
), 'PLAYER战报泄漏开发字段或数字缺少来源');
assert.doesNotMatch(JSON.stringify(playerAudit.reportDto.aiSummaryInput), /scoreAudit|candidateId|ruleCode|formulaTrace/, 'AI摘要输入泄漏候选或内部判定');

const developerAudit = reportRuntime.auditProjection(reportRuntime.build({ draft, visibilityMode: 'DEVELOPER' }));
assert.equal(developerAudit.passed, true, `DEVELOPER Projection Audit失败:${JSON.stringify(developerAudit.fatals)}`);
assert.ok(developerAudit.reportDto.factRegistry.some(fact => fact.developerDetail), 'DEVELOPER战报缺少可折叠内部事实');

const ownerConflict = runtime.cloneValue(playerBuilt);
ownerConflict.exchanges[0].factIds.push(ownerConflict.exchanges[0].factIds[0]);
assert.ok(
  reportRuntime.auditProjection(ownerConflict).fatals.some(item => item.code === 'REPORT_FACT_OWNER_CONFLICT'),
  'Projection Audit未捕获双详细所有者'
);
const inventedFact = runtime.cloneValue(playerBuilt);
inventedFact.roundOverview[0].factIds.push('invented-fact');
assert.ok(
  reportRuntime.auditProjection(inventedFact).fatals.some(item => item.code === 'REPORT_FACT_INVENTED'),
  'Projection Audit未捕获凭空事实'
);
const missingFact = runtime.cloneValue(playerBuilt);
const firstExchangeFactId = missingFact.exchanges[0].factIds.shift();
assert.ok(firstExchangeFactId, '缺少可注入的交锋事实');
assert.ok(
  reportRuntime.auditProjection(missingFact).fatals.some(item => item.code === 'REPORT_FACT_MISSING'),
  'Projection Audit未捕获漏投影事实'
);

const sealed = runtime.sealBattleResult({ draft, reportAudit: playerAudit });
assert.equal(sealed.sealStatus, 'SEALED', '战斗结果没有成功Seal');
assert.equal(sealed.draftHash, draft.draftHash, 'Seal后draftHash漂移');
assert.equal(sealed.reportHash, playerAudit.reportHash, 'Seal后reportHash漂移');
assert.deepEqual(sealed.finalSnapshot, draft.finalSnapshot, 'Seal后finalSnapshot漂移');
assert.ok(reportRuntime.serializeFullText(sealed.reportDto).includes('回合 1'), '惰性完整文本无法从Report DTO生成');

const tamperedDraft = runtime.cloneValue(draft);
tamperedDraft.actualRoundCount += 1;
assert.throws(
  () => runtime.sealBattleResult({ draft: tamperedDraft, reportAudit: playerAudit }),
  /BATTLE_COMMIT_HASH_MISMATCH:draft/,
  'Seal接受了被篡改的战斗草案'
);
const tamperedReportAudit = runtime.cloneValue(playerAudit);
tamperedReportAudit.reportDto.actualRoundCount += 1;
assert.throws(
  () => runtime.sealBattleResult({ draft, reportAudit: tamperedReportAudit }),
  /BATTLE_COMMIT_HASH_MISMATCH:report/,
  'Seal接受了被篡改的战报DTO'
);

console.log(JSON.stringify({
  summary: {
    caseId: definition.caseId,
    actualRoundCount: draft.actualRoundCount,
    ledgerCount: draft.ledger.length,
    traceCount: draft.trace.length,
    factCount: playerAudit.reportDto.factRegistry.length,
    exchangeCount: playerAudit.reportDto.exchanges.length,
    adjudicationCount: playerAudit.reportDto.adjudications.length,
    playerReportHash: playerAudit.reportHash,
    developerReportHash: developerAudit.reportHash,
    negativeChecks: 5,
    passed: true,
  },
}, null, 2));

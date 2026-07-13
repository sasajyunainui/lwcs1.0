import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');

function makeNode() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

function createSandbox() {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
    Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
    parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
    navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' }, innerWidth: 1440, innerHeight: 900,
    getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => makeNode(),
    body: { appendChild() {} }, head: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const attackSkill = {
  id: 'decision-strike', name: '测试突击', 魂技名: '测试突击', 消耗: { 魂力: 10 }, 前摇: 10,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 65, 伤害类型: '近身攻击', 生效方式: '独立生效' }],
};

function participant(id, side, agility) {
  return {
    id, name: id, 名称: id, type: '强攻系', 系别: '强攻系',
    属性: {
      等级: 50, 系别: '强攻系', HP: 500, HP上限: 500, 体力: 500, 体力上限: 500,
      魂力: 500, 魂力上限: 500, 精神力: 200, 精神力上限: 200,
      力量: 180, 防御: 120, 敏捷: agility, 状态效果: {},
    },
    状态: { 存活: true, 位置: '测试场', 行动: '战斗' },
    状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: [structuredClone(attackSkill)],
    side,
  };
}

function combatData() {
  return {
    回合: 0, 战斗类型: '普通战斗', 战斗意图: '点到为止', 进行中: true,
    参战者: { team_player: [participant('player-a', 'player', 160)], team_enemy: [participant('enemy-a', 'enemy', 140)] },
  };
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function decisionSummary(value) {
  return (Array.isArray(value?.decisions) ? value.decisions : []).map(entry => ({
    round: Number(entry?.round || 0),
    actorId: String(entry?.actorId || '').trim(),
    actionRole: String(entry?.actionRole || 'ACTIVE').trim(),
    selected: entry?.selected ? {
      candidateId: String(entry.selected.candidateId || '').trim(),
      actionKind: String(entry.selected.actionKind || entry.selected.declaration?.actionKind || '').trim(),
      targetIds: Array.isArray(entry.selected.declaration?.targetIds) ? [...entry.selected.declaration.targetIds] : [],
      objectiveUtility: Number(entry.selected.objectiveUtility || 0),
      normalizedUtility: Number(entry.selected.normalizedUtility || 0),
      vector: entry.selected.vector || {},
      rejectionCode: String(entry.selected.rejectionCode || '').trim(),
    } : null,
    scoreAudit: (Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : []).map(item => ({
      candidateId: String(item?.candidateId || '').trim(),
      actionKind: String(item?.actionKind || '').trim(),
      actorId: String(item?.actorId || '').trim(),
      targetIds: Array.isArray(item?.targetIds) ? [...item.targetIds] : [],
      objectiveUtility: Number(item?.objectiveUtility || 0),
      normalizedUtility: Number(item?.normalizedUtility || 0),
      vector: item?.vector || {},
      rejectionCode: String(item?.rejectionCode || '').trim(),
      selected: item?.selected === true,
    })),
  }));
}

const sandbox = createSandbox();
for (const relativePath of [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleUI_Module.js',
]) vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });

const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), { querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; } });
const container = { innerHTML: '', querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; } };
new sandbox.BattleUIComponent(container, {}, {});

const formalInput = combatData();
const formalResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeDeclaration({
  combatData: formalInput,
  declaration: { actionKind: 'BASIC_ATTACK', actorId: 'player-a', targetIds: ['enemy-a'] },
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  seed: 6307,
});
const formalLedger = sandbox.__LWCS_BATTLE_RUNTIME__.ensureLedger(formalInput);
const formalTrace = sandbox.__LWCS_BATTLE_RUNTIME__.ensureTrace(formalInput);
const formalStarts = formalLedger.filter(event => event?.eventKind === 'action_start' && event?.actorControl === 'PLAYER_LOCKED');
assert.equal(formalStarts.length, 1, 'executeDeclaration没有且仅有一个PLAYER_LOCKED主动声明');
assert.equal(formalStarts[0].actorName, 'player-a', 'executeDeclaration行动者与声明不一致');
assert.equal(formalStarts[0].targetName, 'enemy-a', 'executeDeclaration目标与声明不一致');
assert.ok(formalLedger.length > 0 && formalTrace.length > 0 && Number(formalResult?.rounds || 0) === 1, 'executeDeclaration未进入正式Ledger/Trace结算');
const deadTargetInput = combatData();
deadTargetInput.参战者.team_enemy[0].状态.存活 = false;
deadTargetInput.参战者.team_enemy[0].属性.HP = 0;
assert.throws(() => sandbox.__LWCS_BATTLE_RUNTIME__.executeDeclaration({
  combatData: deadTargetInput,
  declaration: { actionKind: 'BASIC_ATTACK', actorId: 'player-a', targetIds: ['enemy-a'] },
  seed: 6307,
}), /battle_declaration_mechanically_illegal/, 'executeDeclaration接受死亡目标');

const matchingRuntime = sandbox.__LWCS_BATTLE_RUNTIME__;
sandbox.__LWCS_BATTLE_RUNTIME__ = { ...matchingRuntime, version: 'wrong-runtime' };
assert.throws(() => new sandbox.BattleUIComponent(container, {}, {}), /battle_runtime_version_mismatch/, 'BattleUI未拒绝错误Runtime版本');
sandbox.__LWCS_BATTLE_RUNTIME__ = matchingRuntime;

const input = combatData();
const before = JSON.stringify(input);
const result = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-decision-settlement-duel', seed: 6308, combatData: input, mode: 'team_preview', rounds: 3,
  settings: {},
});

assert.ok(Array.isArray(result.decisions), '未进入唯一正式决策链');
assert.equal(result.inputUnchanged, true, '唯一正式决策链修改调用方输入');
assert.equal(JSON.stringify(input), before, '唯一正式决策链泄漏状态写入');
assert.ok(result.roundsExecuted >= 1, '正式决策战斗未执行回合');
assert.ok(result.ledger.length > 0 && result.actionQueueTrace.length > 0, '正式Ledger或ActionQueue为空');
assert.ok(result.decisions.length >= 2, '双方没有各自产生正式决策');
assert.ok(result.decisions.every(entry => entry.selected?.declaration), '正式决策缺少结构化声明');
assert.ok(result.decisions.every(entry => ['ACTIVE', 'REACTION', 'COUNTER'].includes(entry.actionRole)), '正式决策缺少显式行动职责');
assert.ok(result.decisions.some(entry => entry.actionRole === 'REACTION'), '即时反应仍未进入新Decision');
const decisionActors = new Set(result.decisions.map(entry => entry.actorId));
assert.ok(decisionActors.has('player-a') && decisionActors.has('enemy-a'), '仍有一方未行动或退回旧选择');
const activeStarts = result.ledger.filter(event => String(event?.eventKind || '') === 'action_start');
const activeActors = new Set(activeStarts.map(event => String(event?.actorName || '')));
assert.ok(activeActors.has('player-a') && activeActors.has('enemy-a'), '正式结算未包含双方主动动作');
const hostileReactionFacts = result.ledger.filter(event =>
  event?.actionRole === 'REACTION' &&
  event?.actorName &&
  event?.targetName &&
  event.actorName !== event.targetName
);
assert.ok(hostileReactionFacts.length > 0, '正式决策结算缺少敌对即时反应事实');
assert.ok(hostileReactionFacts.every(event => event.actorSide && event.targetSide && event.actorSide !== event.targetSide), `即时反应客观阵营错误:${JSON.stringify(hostileReactionFacts)}`);
assert.doesNotMatch(result.logs.join('\n'), /技能分类预览|主观置信度锁定|行为经验|自动行为链再判定/, '正式决策完整战斗仍执行旧评分或旧行为链');
const damagingActors = new Set(result.ledger
  .filter(event => event?.eventKind === 'hit_result' && Number(event?.appliedDamage || 0) > 0)
  .map(event => event?.actorName));
assert.ok(damagingActors.has('player-a') && damagingActors.has('enemy-a'), '双方主动命中没有形成唯一伤害事实');
assert.equal(result.audit?.fatals?.length || 0, 0, `正式决策事实审计失败:${JSON.stringify(result.audit?.fatals || [])}`);

const itemDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'item_creation_consumption');
assert.ok(itemDefinition, '造物消费人工案例缺失');
const itemCombat = structuredClone(itemDefinition.combatData);
const itemActor = itemCombat.参战者.team_player.find(unit => String(unit?.name || unit?.名称 || '') === '徐笠智');
const creationSkill = sandbox.__LWCS_BATTLE_DECISION__.collectSkills(itemActor || {})
  .find(skill => String(skill?.name || skill?.魂技名 || '').includes('恢复大肉包'));
assert.ok(itemActor && creationSkill, '造物者或恢复大肉包技能缺失');
sandbox.__LWCS_BATTLE_RUNTIME__.executeDeclaration({
  combatData: itemCombat,
  declaration: {
    actionKind: 'RELEASE_SKILL',
    actorId: '徐笠智',
    targetIds: ['徐笠智'],
    skill: creationSkill,
  },
  seed: itemDefinition.seed,
});
sandbox.__LWCS_BATTLE_RUNTIME__.executeDeclaration({
  combatData: itemCombat,
  declaration: { actionKind: 'BASIC_ATTACK', actorId: '徐笠智', targetIds: ['苏沐'] },
  seed: itemDefinition.seed + 1,
});
const itemBeliefRun = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'item-belief-replay',
  seed: itemDefinition.seed,
  combatData: structuredClone(itemDefinition.combatData),
  mode: 'team_preview',
  rounds: 2,
  settings: {},
});
const itemBelief = [...itemBeliefRun.decisions].reverse().find(entry => entry.actorId === '徐笠智')?.beliefState || { confidence: 0.55 };
const postCreationDecision = sandbox.__LWCS_BATTLE_DECISION__.decide({
  worldSnapshot: itemCombat,
  actorId: '徐笠智',
  beliefState: itemBelief,
  seed: itemDefinition.seed + 1,
});
const createdItemCandidates = postCreationDecision.candidates.filter(candidate => candidate.declaration?.actionKind === 'USE_ITEM');
assert.ok(createdItemCandidates.length > 0, `造物结算后成品未进入USE_ITEM候选:${JSON.stringify(itemActor?.背包 || {})}`);
assert.ok(createdItemCandidates.some(candidate => !['HARD_INVALID', 'DOMINATED'].includes(candidate.classification)), `造物成品全部被错误禁止:${JSON.stringify(createdItemCandidates.map(candidate => ({ id: candidate.candidateId, targetIds: candidate.declaration.targetIds, utility: candidate.objectiveUtility, rejectionCode: candidate.rejectionCode, classification: candidate.classification, irreversibleCost: candidate.vector?.irreversibleCost })))}`);
assert.equal(postCreationDecision.selected.declaration.actionKind, 'USE_ITEM', `队友进入危机后仍不使用已造恢复物:${JSON.stringify({ selected: { id: postCreationDecision.selected.candidateId, utility: postCreationDecision.selected.objectiveUtility, vector: postCreationDecision.selected.vector }, items: createdItemCandidates.map(candidate => ({ id: candidate.candidateId, targetIds: candidate.declaration.targetIds, utility: candidate.objectiveUtility, vector: candidate.vector, rejectionCode: candidate.rejectionCode, classification: candidate.classification })) })}`);

const deterministicInput = combatData();
const deterministicArgs = {
  caseId: 'r63-decision-determinism', seed: 6317, combatData: deterministicInput, mode: 'team_preview', rounds: 3,
  settings: {},
};
const deterministicFirst = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__(deterministicArgs);
const deterministicSecond = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({ ...deterministicArgs, combatData: combatData() });
const deterministicParts = value => ({
  ledger: digest(value.ledger),
  trace: digest(value.trace),
  decisions: digest(decisionSummary(value)),
  report: digest(value.reportBlocks),
  finalSnapshot: digest(value.finalSnapshot),
});
const firstDecisionSummary = decisionSummary(deterministicFirst);
const secondDecisionSummary = decisionSummary(deterministicSecond);
if (digest(firstDecisionSummary) !== digest(secondDecisionSummary)) {
  const mismatchIndex = firstDecisionSummary.findIndex((entry, index) => JSON.stringify(entry) !== JSON.stringify(secondDecisionSummary[index]));
  console.error(JSON.stringify({ mismatchIndex, first: firstDecisionSummary[mismatchIndex], second: secondDecisionSummary[mismatchIndex] }, null, 2));
}
assert.deepEqual(deterministicParts(deterministicFirst), deterministicParts(deterministicSecond), '同案例同种子正式决策事实不可复现');
const deterministicBaseline = deterministicParts(deterministicFirst);
for (let repeat = 0; repeat < 100; repeat += 1) {
  const repeated = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({ ...deterministicArgs, combatData: combatData() });
  assert.deepEqual(deterministicParts(repeated), deterministicBaseline, `同案例同种子第${repeat + 1}次快照哈希不一致`);
}

const nonlethalInput = combatData();
nonlethalInput.参战者.team_player[0].属性.力量 = 5000;
nonlethalInput.参战者.team_player[0].属性.魂力 = 5000;
nonlethalInput.参战者.team_player[0].属性.魂力上限 = 5000;
nonlethalInput.参战者.team_enemy[0].属性.HP = 80;
const nonlethalResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-decision-settlement-nonlethal', seed: 6311, combatData: nonlethalInput, mode: 'team_preview', rounds: 3,
  battleIntent: { mode: '点到为止' }, settings: {},
});
const nonlethalFinalHp = Number(nonlethalResult.finalSnapshot?.team_enemy?.[0]?.hp || 0);
assert.ok(
  nonlethalFinalHp >= 1 && nonlethalFinalHp < 80,
  `非致命战斗意图没有在保留目标生命的前提下形成有效推进:${JSON.stringify(decisionSummary(nonlethalResult))}`,
);
const nonlethalPrevented = nonlethalResult.ledger.filter(event => event?.eventKind === 'hit_result' && event?.meta?.intentLethalPrevented === true);
assert.equal(nonlethalPrevented.length, 1, '非致命限伤事实数量不唯一');
assert.equal(nonlethalResult.roundsExecuted, Number(nonlethalPrevented[0]?.round || 0), '非致命限伤后仍继续生成自然行动回合');
assert.ok(!nonlethalResult.ledger.some(event =>
  String(event?.eventKind || '').trim() === 'round_recover' &&
  Number(event?.round || 0) === Number(nonlethalPrevented[0]?.round || 0)
), '终态闭合后仍执行自然恢复');
assert.equal(nonlethalResult.audit?.fatals?.length || 0, 0, `非致命结算审计失败:${JSON.stringify(nonlethalResult.audit?.fatals || [])}`);

const controlDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'team_counter_coordination');
assert.ok(controlDefinition, '控制后行动重验案例缺失');
const controlResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-control-cancels-queued-natural-action',
  seed: controlDefinition.seed,
  combatData: structuredClone(controlDefinition.combatData),
  mode: 'team_preview',
  rounds: 6,
  settings: {},
});
const controlLedger = controlResult.ledger || [];
const appliedHardControls = controlLedger
  .map((event, index) => ({ event, index }))
  .filter(({ event }) =>
    String(event?.eventKind || '').trim() === 'state_apply' &&
    !/resist|immune|抵抗|免疫/i.test(String(event?.result || event?.resultState || '')) &&
    /僵直|眩晕|麻痹|失控/.test(String(event?.meta?.stateName || event?.stateName || ''))
  );
assert.ok(appliedHardControls.length > 0, '控制后行动重验案例未形成成功硬控');
appliedHardControls.forEach(({ event, index }) => {
  const actorName = String(event?.targetName || '').trim();
  const round = Number(event?.round || 0);
  const laterActiveAction = controlLedger.slice(index + 1).find(candidate =>
    Number(candidate?.round || 0) === round &&
    String(candidate?.eventKind || '').trim() === 'action_start' &&
    String(candidate?.actionRole || '').trim() === 'ACTIVE' &&
    String(candidate?.actorName || '').trim() === actorName
  );
  assert.ok(!laterActiveAction, `硬控生效后仍执行预排自然动作:${JSON.stringify({ control: event, action: laterActiveAction })}`);
});
assert.ok(controlLedger.some(candidate =>
  String(candidate?.eventKind || '').trim() === 'lost_opportunity' &&
  String(candidate?.ruleCode || '').trim() === 'CONTROLLED_BEFORE_OPPORTUNITY'
), '硬控取消自然行动后缺少结构化原因');
const controlEventIndex = new Map(controlLedger.map((event, index) => [String(event?.eventId || '').trim(), index]));
const controlBlocksByRound = controlResult.reportBlocks
  .filter(block => block?.blockType !== 'ROUND_SUMMARY')
  .reduce((groups, block) => {
    const round = Number(block?.round || 0);
    if (!groups.has(round)) groups.set(round, []);
    groups.get(round).push(block);
    return groups;
  }, new Map());
controlBlocksByRound.forEach((blocks, round) => {
  const firstEventIndexes = blocks.map(block => Math.min(
    ...(block?.facts || []).map(fact => controlEventIndex.get(String(fact?.factId || '').trim())).filter(Number.isFinite),
    Number.MAX_SAFE_INTEGER,
  ));
  assert.deepEqual(
    firstEventIndexes,
    [...firstEventIndexes].sort((left, right) => left - right),
    `第${round}回合动作组没有按Ledger因果顺序投影:${JSON.stringify(blocks.map((block, index) => ({ actionGroupId: block.actionGroupId, firstEventIndex: firstEventIndexes[index], outcomeSummary: block.outcomeSummary })))}`,
  );
});
const firstLostOpportunityBlockIndex = controlResult.reportBlocks.findIndex(block =>
  (block?.facts || []).some(fact => fact?.eventKind === 'lost_opportunity')
);
assert.ok(firstLostOpportunityBlockIndex >= 0, '硬控失去行动事实没有进入结构化战报');
assert.equal(controlResult.reportBlocks[firstLostOpportunityBlockIndex]?.intentSummary, '', '失去行动机会错误借用了本轮其他决策意图');

const adaptationInput = combatData();
adaptationInput.参战者.team_player[0].str = 1;
adaptationInput.参战者.team_player[0].属性.力量 = 1;
adaptationInput.参战者.team_enemy[0].def = 1000;
adaptationInput.参战者.team_enemy[0].属性.防御 = 1000;
adaptationInput.参战者.team_player[0].技能列表 = [{
  id: 'adaptive-slow', name: '适应迟缓', 魂技名: '适应迟缓', 消耗: { 魂力: 1 }, 前摇: 5,
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '迟缓', 持续回合: 1, 成功率: 0.65, 生效方式: '独立生效' }],
}];
const adaptationResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-decision-belief-integration', seed: 6321, combatData: adaptationInput, mode: 'team_preview', rounds: 3,
  settings: {},
});
assert.ok(adaptationResult.beliefObservations.length > 0, '正式正式决策结算没有生成认知观察');
assert.ok(!adaptationResult.beliefObservations.some(observation => observation?.observationType === 'PUBLIC_ACTION' && observation?.actionName === '自然恢复'), '自然恢复被错误用作公开战术学习样本');
const firstObservation = adaptationResult.beliefObservations[0];
const laterDecision = adaptationResult.decisions.find(entry =>
  entry.actorId === firstObservation.actorId && Number(entry.round || 0) > Number(firstObservation.round || 0)
);
assert.ok(laterDecision?.beliefState?.mechanics?.[firstObservation.mechanicKey], '实际结算观察没有进入下一轮belief');

const publicObservation = adaptationResult.beliefObservations.find(entry => entry?.observationType === 'PUBLIC_ACTION');
assert.ok(publicObservation, '正式正式决策结算没有生成公开动作观察');
const decisionBeforePublicObservation = [...adaptationResult.decisions]
  .reverse()
  .find(entry => entry.actorId === publicObservation.actorId && Number(entry.round || 0) <= Number(publicObservation.round || 0));
const decisionAfterPublicObservation = adaptationResult.decisions.find(entry =>
  entry.actorId === publicObservation.actorId && Number(entry.round || 0) > Number(publicObservation.round || 0)
);
const observedResponses = decisionAfterPublicObservation?.beliefState?.publicResponses?.[publicObservation.sourceActorId];
assert.ok(
  Array.isArray(observedResponses) && observedResponses.some(response => response?.actionName === publicObservation.actionName),
  '公开动作观察没有进入观察者的下一轮publicResponses',
);
assert.ok(
  Number(decisionAfterPublicObservation?.beliefState?.confidence || 0) > Number(decisionBeforePublicObservation?.beliefState?.confidence || 0),
  '公开动作观察没有提高观察者后续决策的认知置信度',
);

const supportInput = combatData();
supportInput.参战者.team_player.push(participant('player-b', 'player', 120));
supportInput.参战者.team_player[0].str = 1;
supportInput.参战者.team_player[0].属性.力量 = 1;
supportInput.参战者.team_player[0].技能列表 = [{
  id: 'group-support', name: '群体支援', 魂技名: '群体支援', 消耗: { 魂力: 1 }, 前摇: 1,
  _效果数组: [
    { 原型: '资源变化', 目标: '群体', 资源: '生命', 数值: '+30%', 生效方式: '独立生效' },
    { 原型: '状态移除', 目标: '群体', 状态: '任意负面', 生效方式: '独立生效' },
    { 原型: '状态施加', 目标: '群体', 状态: '护盾', 数值: '+20%', 持续回合: 1, 生效方式: '独立生效' },
  ],
}];
supportInput.参战者.team_player[1].属性.HP = 80;
supportInput.参战者.team_player[1].hp = 80;
supportInput.参战者.team_enemy[0].def = 1000;
supportInput.参战者.team_enemy[0].属性.防御 = 1000;
const supportResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-decision-friendly-group-settlement', seed: 6331, combatData: supportInput, mode: 'team_preview', rounds: 1,
  settings: {},
});
const supportStart = supportResult.ledger.find(event => event?.eventKind === 'action_start' && event?.actorName === 'player-a' && event?.actionName === '群体支援');
assert.ok(supportStart, `友方群体支援没有进入正式结算:${JSON.stringify(supportResult.decisions?.[0]?.scoreAudit || [])}`);
const supportFacts = supportResult.ledger.filter(event =>
  String(event?.sourceActionId || event?.actionId || '') === String(supportStart.actionId || '') && event !== supportStart
);
assert.ok(supportFacts.some(event => event?.targetName === 'player-b'), `友方群体支援没有覆盖队友:${JSON.stringify(supportResult.ledger)}`);
assert.ok(!supportFacts.some(event => event?.targetName === 'enemy-a'), '友方群体支援错误落到敌方');
assert.ok(!supportResult.ledger.some(event => ['counter_window', 'counter'].includes(event?.eventKind) && String(event?.sourceActionId || '') === String(supportStart.actionId || '')), '非攻击支援动作错误触发防反链');
const supportReactionFacts = supportResult.ledger.filter(event => ['pass', 'dodge', 'defend'].includes(event?.eventKind) && String(event?.sourceActionId || '') === String(supportStart.actionId || ''));
assert.equal(supportReactionFacts.length, 0, `非攻击支援动作错误生成应招事实:${JSON.stringify({ supportStart, selected: supportResult.decisions?.find(entry => entry?.actorId === 'player-a')?.selected, supportReactionFacts })}`);
const supportCost = supportResult.ledger.find(event => event?.eventKind === 'action_cost' && event?.actorName === 'player-a' && event?.actionName === '群体支援');
assert.equal(Number(supportCost?.meta?.reqSp || 0), 1, '对象型绝对魂力消耗没有按1点正式结算');
const supportActionBlock = supportResult.reportBlocks.find(block =>
  (block?.facts || []).some(fact => fact?.eventKind === 'action_start' && fact?.actionName === '群体支援')
);
assert.match(String(supportActionBlock?.outcomeSummary || ''), /群体支援/, '纯支援动作的结构化战报遗漏技能名');
assert.ok(String(supportActionBlock?.intentSummary || '').trim(), '正式Decision动作没有生成玩家可读意图');
assert.ok((supportActionBlock?.facts || []).some(fact => fact?.factType === 'RESOURCE_CHANGE'), '主动支援的治疗/资源事实被拆出父动作组');
assert.equal(supportResult.reportBlocks.filter(block => block?.blockType !== 'ROUND_SUMMARY' &&
  (block?.facts || []).some(fact => String(fact?.sourceActionId || '') === String(supportStart.actionId || ''))
).length, 1, '同一主动支援被拆成多个玩家战报块');
const supportShieldFacts = supportResult.ledger.filter(event => event?.eventKind === 'shield_create' && Number(event?.meta?.amount || 0) > 0);
const supportActionShieldBadges = supportResult.reportBlocks
  .filter(block => block?.blockType !== 'ROUND_SUMMARY')
  .flatMap(block => block?.badges || [])
  .filter(badge => badge?.kind === 'shield');
assert.ok(supportShieldFacts.length > 0, '群体支援没有形成真实护盾事实');
assert.ok(supportActionShieldBadges.every(badge => Number(badge?.value || 0) > 0), `结构化战报保留了零值护盾Badge:${JSON.stringify(supportActionShieldBadges)}`);
assert.equal(
  supportActionShieldBadges.length,
  new Set(supportActionShieldBadges.map(badge => String(badge?.sourceEventId || '').trim())).size,
  `同一动作层护盾事实生成了重复Badge:${JSON.stringify(supportActionShieldBadges)}`,
);

const mixedShieldInput = combatData();
const mixedShieldSkill = {
  id: 'mixed-defense-shield', name: '壁垒强化', 魂技名: '壁垒强化', 消耗: '无', 前摇: 1,
  _效果数组: [
    { 原型: '属性修正', 目标: '自身', 属性: '防御', 数值: '+20%', 持续回合: 2, 生效方式: '独立生效' },
    { 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+20%', 持续回合: 2, 生效方式: '独立生效' },
  ],
};
mixedShieldInput.参战者.team_player[0].技能列表 = [structuredClone(mixedShieldSkill)];
const mixedShieldResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'mixed-defense-shield-single-value', seed: 6333, combatData: mixedShieldInput, mode: 'team_preview', rounds: 1,
  selectedAction: { actor_name: 'player-a', target_name: 'player-a', type: 'skill', action_type: '释放魂技', skill: structuredClone(mixedShieldSkill) },
  settings: {},
});
const mixedShieldFacts = mixedShieldResult.ledger.filter(event => event?.eventKind === 'shield_create' && event?.actorName === 'player-a' && event?.actionName === '壁垒强化');
assert.equal(mixedShieldFacts.length, 1, `属性强化与护盾原型重复生成护盾事实:${JSON.stringify(mixedShieldFacts)}`);
assert.equal(Number(mixedShieldFacts[0]?.meta?.amount || 0), 100, '混合防御技能护盾值没有按唯一原型结算');

const summonOrderDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'team_focus_without_overkill');
const summonOrderResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'report-summary-after-summon', seed: summonOrderDefinition.seed,
  combatData: structuredClone(summonOrderDefinition.combatData), mode: 'team_preview', rounds: 1, settings: {},
});
assert.ok(summonOrderResult.reportBlocks.some(block => block?.blockType === 'SUMMON_ACTION'), '召唤顺序回归没有形成召唤动作块');
const roundOneBlocks = summonOrderResult.reportBlocks.filter(block => Number(block?.round || 0) === 1);
assert.equal(roundOneBlocks.at(-1)?.blockType, 'ROUND_SUMMARY', `回合汇总没有位于全部召唤动作之后:${JSON.stringify(roundOneBlocks.map(block => block?.blockType))}`);

const resourceSupportInput = combatData();
resourceSupportInput.参战者.team_player.push(participant('player-b', 'player', 120));
resourceSupportInput.参战者.team_player[1].属性.魂力 = 100;
resourceSupportInput.参战者.team_player[1].sp = 100;
const resourceSupportSkill = {
  id: 'single-resource-support', name: '单体魂力支援', 魂技名: '单体魂力支援', 消耗: { 魂力: 20 }, 前摇: 1,
  _效果数组: [{ 原型: '资源变化', 目标: '单体', 资源: '魂力', 数值: '+10%', 生效方式: '独立生效' }],
};
resourceSupportInput.参战者.team_player[0].技能列表 = [structuredClone(resourceSupportSkill)];
const resourceSupportResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-decision-resource-support-conservation', seed: 6332, combatData: resourceSupportInput, mode: 'team_preview', rounds: 1,
  selectedAction: {
    actor_name: 'player-a', target_name: 'player-b', type: 'skill', action_type: '释放魂技', skill: structuredClone(resourceSupportSkill),
  },
  settings: {},
});
const resourceSupportGain = resourceSupportResult.ledger.find(event => event?.eventKind === 'resource_change' && event?.actorName === 'player-a' && event?.targetName === 'player-b' && event?.actionName === '单体魂力支援' && event?.meta?.resourceKey === 'sp');
assert.ok(Number(resourceSupportGain?.meta?.delta || 0) > 0, '友方魂力支援没有形成资源变化事实');
assert.ok(!resourceSupportResult.ledger.some(event => event?.eventKind === 'resource_change' && event?.actorName === 'player-a' && event?.targetName === 'player-a' && event?.actionName === '单体魂力支援' && event?.meta?.resourceKey === 'sp'), '单体资源变化被旧自回分支重复结算到施术者');
const resourceSupportCaster = resourceSupportResult.finalSnapshot?.team_player?.find(unit => unit?.name === 'player-a');
assert.equal(Number(resourceSupportCaster?.sp || 0), 482, '施术者魂力消耗被资源变化兼容分支错误补满');
assert.equal(resourceSupportResult.audit?.fatals?.filter(item => item?.code === 'LEDGER_CONSERVATION_MISMATCH').length || 0, 0, '魂力支援结算未通过Ledger守恒');

const noUnlockWorld = combatData();
noUnlockWorld.参战者.team_player.push(participant('player-b', 'player', 120));
noUnlockWorld.参战者.team_player[1].技能列表 = [];
noUnlockWorld.参战者.team_player[0].技能列表 = [{
  id: 'resource-without-consumer', name: '无消费者回魂', 魂技名: '无消费者回魂', 消耗: '无', 前摇: 1,
  _效果数组: [{ 原型: '资源变化', 目标: '群体', 资源: '魂力', 数值: '+30%', 生效方式: '独立生效' }],
}];
const noUnlockDecision = sandbox.__LWCS_BATTLE_DECISION__.decide({
  worldSnapshot: noUnlockWorld,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  seed: 'resource-without-consumer',
});
const noUnlockSupport = noUnlockDecision.candidates.find(candidate => candidate?.skill?.id === 'resource-without-consumer');
assert.equal(noUnlockSupport?.rejectionCode, 'ZERO_PROGRESS', `没有可兑现后续动作的回魂仍获得容量收益:${JSON.stringify(noUnlockSupport)}`);
assert.equal(noUnlockDecision.selected?.declaration?.actionKind, 'BASIC_ATTACK', '无消费者回魂压过了有效攻击');

const counterDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'duel_agile_counter_options');
assert.ok(counterDefinition, '成功防反人工案例缺失');
const counterResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: counterDefinition.caseId,
  seed: counterDefinition.seed,
  combatData: counterDefinition.combatData,
  mode: 'team_preview',
  rounds: counterDefinition.rounds,
  initialBelief: counterDefinition.initialBelief,
  battleIntent: { mode: counterDefinition.intent },
  settings: {},
});
const counterDecision = counterResult.decisions.find(entry => entry?.actionRole === 'COUNTER');
const counterWindow = counterResult.ledger.find(event => event?.eventKind === 'counter_window' && event?.result === 'opened');
const counterFact = counterResult.ledger.find(event => event?.eventKind === 'counter' && event?.result === 'success' && Number(event?.meta?.resolvedDamage || 0) > 0);
const failedCounterFacts = counterResult.ledger.filter(event => event?.eventKind === 'counter' && event?.result === 'fail');
const counterReactionFacts = counterResult.ledger.filter(event =>
  ['dodge', 'defend', 'pass'].includes(String(event?.eventKind || '')) &&
  event?.actorName &&
  event?.targetName &&
  event.actorName !== event.targetName &&
  [counterFact?.actorName, counterFact?.targetName].includes(event.actorName) &&
  [counterFact?.actorName, counterFact?.targetName].includes(event.targetName)
);
const counterDamage = counterResult.ledger.find(event =>
  event?.eventKind === 'hit_result' &&
  event?.actionRole === 'COUNTER' &&
  event?.actorName === counterFact?.actorName &&
  event?.targetName === counterFact?.targetName &&
  Number(event?.appliedDamage || 0) > 0
);
assert.ok(counterWindow, '固定种子没有打开防反窗口');
assert.ok(counterDecision?.selected?.declaration, '防反机会没有进入新Decision或缺少评分审计');
const counterDecline = counterDecision?.scoreAudit?.find(candidate => candidate?.counterDeclineFallback === true);
assert.equal(counterDecline?.rejectionCode, 'ZERO_PROGRESS', '放弃防反回退参与了Pareto或主观抽样');
assert.notEqual(counterDecision?.selected?.candidateId, counterDecline?.candidateId, '存在有效反击时仍选择放弃窗口');
assert.ok(counterFact && counterDamage, '固定种子没有形成成功防反及唯一正伤害事实');
assert.equal(counterFact.actorSide, 'enemy', '防反子战斗改写了行动者客观阵营');
assert.equal(counterFact.targetSide, 'player', '防反子战斗改写了目标客观阵营');
assert.ok(failedCounterFacts.every(event => event.actorSide && event.targetSide && event.actorSide !== event.targetSide), `失败防反客观阵营错误:${JSON.stringify(failedCounterFacts)}`);
assert.ok(counterReactionFacts.length > 0, '固定种子没有覆盖防反后二次反应事实');
assert.ok(counterReactionFacts.every(event => event.actorSide && event.targetSide && event.actorSide !== event.targetSide), `防反后二次反应客观阵营错误:${JSON.stringify(counterReactionFacts)}`);
assert.doesNotMatch(counterResult.logs.join('\n'), /技能分类预览|主观置信度锁定|行为经验|自动行为链再判定/, '防反链仍执行旧评分器');
assert.equal(counterResult.audit?.fatals?.length || 0, 0, `成功防反事实审计失败:${JSON.stringify(counterResult.audit?.fatals || [])}`);

const defenseDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'duel_charge_defense_safer');
assert.ok(defenseDefinition, '蓄力防守时序人工案例缺失');
const defenseResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: defenseDefinition.caseId,
  seed: defenseDefinition.seed,
  combatData: defenseDefinition.combatData,
  mode: 'team_preview',
  rounds: defenseDefinition.rounds,
  initialBelief: defenseDefinition.initialBelief,
  battleIntent: { mode: defenseDefinition.intent },
  settings: {},
});
const defenseActions = defenseResult.decisions.filter(entry => (entry?.actionRole || 'ACTIVE') === 'ACTIVE' && entry?.actorId === '韦小枫');
assert.ok(!['DEFEND', 'EVADE'].includes(defenseActions.find(entry => Number(entry?.round || 0) === 1)?.selected?.declaration?.actionKind), '防守窗口会提前过期却在第一回合过早防守');
assert.ok(['DEFEND', 'EVADE'].includes(defenseActions.find(entry => Number(entry?.round || 0) === 2)?.selected?.declaration?.actionKind), `致命蓄力进入下一回应窗口后仍未建立防守姿态:${JSON.stringify(defenseActions.map(entry => ({ round: entry.round, actionKind: entry.selected?.declaration?.actionKind, candidateId: entry.selected?.candidateId })))}`);
const resolvedChargeBlocks = defenseResult.reportBlocks.filter(block =>
  block?.blockType !== 'ROUND_SUMMARY' &&
  (block?.facts || []).some(fact => fact?.actionName === '已显露蓄力重击')
);
assert.ok(resolvedChargeBlocks.length > 0, '蓄力时序案例没有形成已显露蓄力重击战报块');
assert.ok(resolvedChargeBlocks.every(block => !/规避迫近攻击|等待更好的反击窗口/.test(String(block?.intentSummary || ''))), '蓄力结算错误借用了同角色的闪避决策意图');
const preImpactAttackBlock = defenseResult.reportBlocks.find(block => Number(block?.round || 0) === 1 &&
  (block?.facts || []).some(fact => fact?.eventKind === 'action_start' && fact?.actorName === '韦小枫' && fact?.actionRole === 'ACTIVE')
);
assert.match(String(preImpactAttackBlock?.intentSummary || ''), /已评估敌方蓄力风险/, '面对已显露蓄力仍进攻时没有解释威胁交换权衡');
assert.equal(defenseResult.audit?.fatals?.length || 0, 0, `蓄力防守时序事实审计失败:${JSON.stringify(defenseResult.audit?.fatals || [])}`);

const withdrawalDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'duel_agile_single_target_failure');
const withdrawalResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: withdrawalDefinition.caseId,
  seed: withdrawalDefinition.seed,
  combatData: withdrawalDefinition.combatData,
  mode: 'team_preview',
  rounds: withdrawalDefinition.rounds,
  battleIntent: { mode: withdrawalDefinition.intent },
  settings: {},
});
const withdrawalBlock = withdrawalResult.reportBlocks.find(block =>
  block?.blockType !== 'ROUND_SUMMARY' && (block?.facts || []).some(fact => fact?.eventKind === 'failed_action' && fact?.actionName === '撤退')
);
assert.match(String(withdrawalBlock?.intentSummary || ''), /选择【撤退】.*避免在不利交换中继续暴露/, '撤退失败动作组被派生追击夺走父动作意图');

const followUpCombat = combatData();
followUpCombat.参战者.team_player[0].属性.敏捷 = 500;
followUpCombat.参战者.team_enemy[0].属性.敏捷 = 1;
const followUpOpener = {
  id: 'follow-up-opener', name: '缚影连袭', 魂技名: '缚影连袭', 消耗: '无', 前摇: 8, 命中后追击: true,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 20, 伤害类型: '近身攻击', 生效方式: '独立生效' }],
};
const followUpFinisher = {
  id: 'follow-up-finisher', name: '锁定追击', 魂技名: '锁定追击', 消耗: '无', 前摇: 8,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 88, 伤害类型: '近身攻击', 生效方式: '独立生效' }],
};
followUpCombat.参战者.team_player[0].技能列表 = [structuredClone(followUpOpener), structuredClone(followUpFinisher)];
const followUpResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'explicit_follow_up_single_grant', seed: 730177, combatData: followUpCombat, mode: 'team_preview', rounds: 1,
  selectedAction: { actor_name: 'player-a', action_type: '释放魂技', type: '释放魂技', skill: structuredClone(followUpOpener), target_name: 'enemy-a' },
  settings: {},
});
const followUpStarts = followUpResult.ledger.filter(event => event?.eventKind === 'action_start' && event?.meta?.chainType === 'FOLLOW_UP');
assert.equal(followUpStarts.length, 1, `显式追击授权没有恰好消费一次:${JSON.stringify(followUpStarts)}`);
assert.equal(followUpResult.decisions.filter(entry => entry?.continuation === true).length, 1, '显式追击没有通过最新战场Decision重新决策');
assert.equal(followUpResult.audit?.fatals?.length || 0, 0, `显式追击事实审计失败:${JSON.stringify(followUpResult.audit?.fatals || [])}`);

const secondSkillWorld = combatData();
const secondSkillActor = secondSkillWorld.参战者.team_player[0];
secondSkillActor.技能列表 = [
  { id: 'first-skill', name: '第一魂技·蛇影突刺', 魂技名: '第一魂技·蛇影突刺', 消耗: '无', 前摇: 8, _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 24, 伤害类型: '近身攻击' }] },
  { id: 'second-skill', name: '第二魂技·青影蛇群', 魂技名: '第二魂技·青影蛇群', 消耗: '无', 前摇: 10, _效果数组: [
    { 原型: '伤害结算', 目标: '群体', 威力倍率: 180, 伤害类型: '远程攻击' },
    { 原型: '状态施加', 目标: '群体', 状态: '迟缓', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.18, dodge_penalty: 0.08 } },
  ] },
];
const secondSkillDecision = sandbox.__LWCS_BATTLE_DECISION__.decide({
  worldSnapshot: secondSkillWorld,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  seed: 'second-skill-selectable',
});
const secondSkillCandidate = secondSkillDecision.candidates.find(candidate => candidate?.skill?.id === 'second-skill');
assert.ok(secondSkillCandidate && !secondSkillCandidate.rejectionCode, '控制型第二魂技没有进入完整非支配候选池');
assert.equal(secondSkillDecision.selected?.skill?.id, 'second-skill', `第二魂技收益占优时仍不可达:${secondSkillDecision.selected?.candidateId || ''}`);

const controlMarginalWorld = combatData();
controlMarginalWorld.参战者.team_enemy.push(participant('enemy-b', 'enemy', 500));
controlMarginalWorld.参战者.team_enemy[0].状态效果 = {
  existing_stagger: { 状态: '僵直', 状态名称: '僵直', 类型: 'debuff', duration: 2, 战斗效果: { skip_turn: true, cannot_act: true, cannot_react: true } },
};
const marginalControlSkill = {
  id: 'marginal-control', name: '定点僵直', 魂技名: '定点僵直', 消耗: { 魂力: 10 }, 前摇: 1,
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 2, 生效方式: '独立生效' }],
};
controlMarginalWorld.参战者.team_player[0].技能列表 = [structuredClone(marginalControlSkill)];
const controlMarginalDecision = sandbox.__LWCS_BATTLE_DECISION__.decide({
  worldSnapshot: controlMarginalWorld,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  seed: 'control-marginal-target',
});
const redundantControl = controlMarginalDecision.candidates.find(candidate =>
  candidate?.skill?.id === 'marginal-control' && candidate?.declaration?.targetIds?.[0] === 'enemy-a'
);
assert.ok(['ZERO_EFFECT_COSTLY', 'ZERO_PROGRESS', 'DOMINATED'].includes(String(redundantControl?.rejectionCode || redundantControl?.classification || '')), `已有同强度硬控仍被视为完整收益:${JSON.stringify(redundantControl)}`);
assert.equal(controlMarginalDecision.selected?.declaration?.targetIds?.[0], 'enemy-b', `存在未受控目标时仍重复覆盖硬控:${JSON.stringify(controlMarginalDecision.scoreAudit)}`);

const controlledFollowUpWorld = combatData();
controlledFollowUpWorld.参战者.team_enemy[0].状态效果 = {
  existing_freeze: { 状态: '冻结', 状态名称: '冻结', 类型: 'debuff', duration: 2, 战斗效果: { skip_turn: true, cannot_act: true, cannot_react: true } },
};
controlledFollowUpWorld.参战者.team_player[0].技能列表 = [];
const controlledFollowUpDecision = sandbox.__LWCS_BATTLE_DECISION__.decide({
  worldSnapshot: controlledFollowUpWorld,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  seed: 'controlled-target-follow-up',
});
assert.equal(controlledFollowUpDecision.selected?.declaration?.actionKind, 'BASIC_ATTACK', `受控敌人的自然恢复窗口价值被抹零，行动者仍选择无威胁防守:${JSON.stringify(controlledFollowUpDecision.scoreAudit)}`);
assert.ok(Number(controlledFollowUpDecision.selected?.objectiveUtility || 0) > 0, '追击受控敌人没有形成正向容量变化');
assert.ok(!(controlledFollowUpDecision.selected?.preview?.contributions || []).some(entry => entry?.outcomeKind === 'ACTION_GRANTED'), '受控目标追击估值错误授予了额外行动');
const controlledDefenseCandidates = controlledFollowUpDecision.candidates.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate?.declaration?.actionKind));
assert.ok(controlledDefenseCandidates.every(candidate => Number(candidate?.objectiveUtility || 0) <= 1e-9), `已取消下一行动的敌人仍为防御动作制造虚构收益:${JSON.stringify(controlledDefenseCandidates)}`);

const captureDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'intent_capture_vs_kill');
assert.ok(captureDefinition, '非致死控制人工案例缺失');
const captureResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: captureDefinition.caseId,
  seed: captureDefinition.seed,
  combatData: captureDefinition.combatData,
  mode: 'team_preview',
  rounds: captureDefinition.rounds,
  initialBelief: captureDefinition.initialBelief,
  battleIntent: { mode: captureDefinition.intent },
  settings: {},
});
const captureControlledWindowRounds = new Set([2, 4]);
const wastedDefense = captureResult.decisions.filter(entry =>
  entry?.actorId === '舞长空' &&
  (entry?.actionRole || 'ACTIVE') === 'ACTIVE' &&
  captureControlledWindowRounds.has(Number(entry?.round || 0)) &&
  ['DEFEND', 'EVADE'].includes(entry?.selected?.declaration?.actionKind)
);
assert.equal(wastedDefense.length, 0, `敌方下一行动已取消仍浪费机会防御:${JSON.stringify(wastedDefense.map(entry => ({ round: entry.round, actorId: entry.actorId, selected: entry.selected?.candidateId })))}`);

console.log(JSON.stringify({
  summary: {
    roundsExecuted: result.roundsExecuted,
    ledgerCount: result.ledger.length,
    queueNodeCount: result.actionQueueTrace.length,
    decisionCount: result.decisions.length,
    activeActorCount: activeActors.size,
    nonlethalRounds: nonlethalResult.roundsExecuted,
    beliefObservationCount: adaptationResult.beliefObservations.length,
    publicObservationCount: adaptationResult.beliefObservations.filter(entry => entry?.observationType === 'PUBLIC_ACTION').length,
    friendlySupportFactCount: supportFacts.length,
    counterDecisionCount: counterResult.decisions.filter(entry => entry?.actionRole === 'COUNTER').length,
    counterDamage: Number(counterFact?.meta?.resolvedDamage || 0),
    defenseTimingActions: defenseActions.map(entry => entry.selected?.declaration?.actionKind || ''),
    followUpActionCount: followUpStarts.length,
    secondSkillSelected: secondSkillDecision.selected?.skill?.id || '',
    controlledFollowUpAction: controlledFollowUpDecision.selected?.declaration?.actionKind || '',
    captureWastedDefenseCount: wastedDefense.length,
    fatalCount: result.audit?.fatals?.length || 0,
    passed: true,
  },
}, null, 2));

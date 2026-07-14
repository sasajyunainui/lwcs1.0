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

const inspectDecision = input => {
  let candidates = [];
  const result = sandbox.__LWCS_BATTLE_DECISION__.decide({ ...input, inspectCandidates: value => { candidates = value; } });
  return { ...result, candidates };
};

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
const postCreationDecision = inspectDecision({
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
const noUnlockDecision = inspectDecision({
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
const secondSkillDecision = inspectDecision({
  worldSnapshot: secondSkillWorld,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  beliefState: {},
  seed: 'second-skill-selectable',
});
const secondSkillCandidate = secondSkillDecision.candidates.find(candidate => candidate?.skill?.id === 'second-skill');
assert.ok(secondSkillCandidate && !secondSkillCandidate.rejectionCode, '控制型第二魂技没有进入完整非支配候选池');
assert.equal(secondSkillDecision.selected?.declaration?.skill?.id, 'second-skill', `第二魂技收益占优时仍不可达:${secondSkillDecision.selected?.candidateId || ''}`);

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
const controlMarginalDecision = inspectDecision({
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
const controlledFollowUpDecision = inspectDecision({
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
assert.equal(captureResult.finalBattleReport?.objectiveWinner, 'player', `显式生命阈值没有在回合上限内驱动有效收束:${captureResult.finalBattleReport?.text || ''}`);
assert.ok(captureResult.roundsExecuted <= captureDefinition.rounds, '生命阈值目标在回合上限后才成立');

const controlOverlapDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'team_control_overlap');
assert.ok(controlOverlapDefinition, '控制重叠人工案例缺失');
const controlOverlapResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: controlOverlapDefinition.caseId,
  seed: controlOverlapDefinition.seed,
  combatData: controlOverlapDefinition.combatData,
  mode: 'team_preview',
  rounds: controlOverlapDefinition.rounds,
  initialBelief: controlOverlapDefinition.initialBelief,
  battleIntent: { mode: controlOverlapDefinition.intent },
  settings: {},
});
const controlledReactionFallbacks = controlOverlapResult.decisions.filter(entry =>
  entry?.actionRole === 'REACTION' && entry?.selected?.forcedFallback === true
);
assert.equal(controlledReactionFallbacks.length, 0, `无法反应的受控单位仍被强塞防御兜底:${JSON.stringify(controlledReactionFallbacks.map(entry => ({ round: entry.round, actorId: entry.actorId, selected: entry.selected?.candidateId })))}`);
assert.ok(controlOverlapResult.ledger.some(event => event?.eventKind === 'pass' && event?.result === 'reaction_failed'), '受控单位失去反应机会后缺少结构化失败事实');

const hpThresholdInput = combatData();
hpThresholdInput.战斗意图 = '压制测试';
hpThresholdInput.胜负条件 = {
  version: 1, explicit: true, startRound: 0, maxRounds: 3,
  victory: { logic: 'ANY', conditions: [{ type: 'HP_RATIO_AT_OR_BELOW', side: 'ENEMY', targetIds: ['enemy-a'], threshold: 0.99, scope: 'ALL' }] },
  defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
};
const hpThresholdResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'battle-objective-hp-threshold', seed: 6401, combatData: hpThresholdInput, mode: 'team_preview', rounds: 3, settings: {},
});
assert.equal(hpThresholdResult.roundsExecuted, 1, '敌方生命阈值成立后仍继续执行后续回合');
assert.equal(hpThresholdResult.finalBattleReport?.objectiveWinner, 'player', '敌方生命阈值没有形成我方胜利终态');
assert.ok(hpThresholdResult.ledger.some(event => event?.eventKind === 'battle_objective_resolved' && event?.result === 'player'), '生命阈值缺少唯一目标终态事实');
assert.ok(!hpThresholdResult.ledger.some(event => event?.eventKind === 'action_start' && event?.actorName === 'enemy-a' && event?.actionRole === 'ACTIVE'), '生命阈值成立后敌方仍消费自然行动机会');
const thresholdDecision = hpThresholdResult.decisions.find(entry => entry?.actorId === 'player-a' && entry?.actionRole === 'ACTIVE');
assert.equal(Number(thresholdDecision?.selected?.vector?.terminalUtility || 0), 100, '显式生命阈值没有进入行为决策终态效用');
assert.ok(thresholdDecision?.problems?.some(problem => problem?.problemId === 'TERMINAL_OPPORTUNITY'), '接近生命阈值时没有识别终结窗口');
const formalObjectiveInput = structuredClone(hpThresholdInput);
const formalObjectiveResult = sandbox.BattleUIBridge.executeBattleFlow(formalObjectiveInput, { mode: 'multi_round', rounds: 3 });
assert.equal(formalObjectiveResult.winner, 'player', '正式BattleUI执行链没有返回目标胜方');
assert.equal(formalObjectiveInput.进行中, false, '目标终态成立后正式战斗仍标记为进行中');
assert.equal(formalObjectiveInput.裁断结果, '我方胜利', '目标终态没有写入玩家可读裁断结果');
assert.ok(formalObjectiveResult.mvuUpdate?.combatData?.胜负条件, '胜负条件没有随现有战斗对象持久化');

const surviveInput = combatData();
surviveInput.战斗意图 = '坚持测试';
surviveInput.胜负条件 = {
  version: 1, explicit: true, startRound: 0, maxRounds: 2,
  victory: { logic: 'ANY', conditions: [{ type: 'ROUND_REACHED', side: 'PLAYER', round: 2, requireActive: true }] },
  defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
};
const surviveResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'battle-objective-survive-rounds', seed: 6402, combatData: surviveInput, mode: 'team_preview', rounds: 5, settings: {},
});
assert.equal(surviveResult.roundsExecuted, 2, '坚持回合条件没有在完成指定回合后停止');
assert.equal(surviveResult.finalBattleReport?.objectiveWinner, 'player', '坚持指定回合没有形成我方胜利终态');
assert.match(String(surviveResult.finalBattleReport?.headline || ''), /我方获胜/, '坚持回合在上限边界达成时被误写为时限平局');
assert.doesNotMatch(String(surviveResult.finalBattleReport?.text || ''), /双方未分胜负|未能在回合上限前达成/, '坚持回合胜利仍被时限文案覆盖');
assert.ok(surviveResult.decisions.find(entry => entry?.actorId === 'player-a' && entry?.actionRole === 'ACTIVE')?.problems?.some(problem => problem?.problemId === 'SURVIVAL_CRISIS'), '坚持回合目标没有进入保命问题识别');

const timeLimitInput = combatData();
timeLimitInput.胜负条件 = {
  version: 1, explicit: true, startRound: 0, maxRounds: 1,
  victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }] },
  defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
};
const timeLimitResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'battle-objective-time-limit-draw', seed: 6404, combatData: timeLimitInput, mode: 'team_preview', rounds: 3, settings: {},
});
assert.equal(timeLimitResult.finalBattleReport?.objectiveWinner, 'draw', '回合上限没有形成平局终态');
assert.match(String(timeLimitResult.finalBattleReport?.headline || ''), /达到回合上限.*未分胜负/, '时限平局被误写成双方条件同时成立');
assert.doesNotMatch(String(timeLimitResult.finalBattleReport?.text || ''), /胜负条件同时成立|已满足战斗目标/, '时限平局仍虚构双方完成目标');
assert.ok(timeLimitResult.reportBlocks.some(block => block?.facts?.some(fact => fact?.factType === 'BATTLE_OBJECTIVE' && fact?.objectiveReason === 'TIME_LIMIT')), '时限终态没有投影为可区分的结构化原因');

const protectedInput = combatData();
protectedInput.战斗意图 = '无伤保护测试';
protectedInput.胜负条件 = {
  version: 1, explicit: true, startRound: 0, maxRounds: 3,
  victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }] },
  defeat: { logic: 'ANY', conditions: [{ type: 'UNIT_DAMAGED', side: 'PLAYER', targetIds: ['player-a'], baselineHp: { 'player-a': 500 } }] },
};
const protectedDecision = inspectDecision({
  worldSnapshot: structuredClone(protectedInput), actorId: 'player-a', actionOpportunity: { role: 'ACTIVE', sequence: 1 }, beliefState: {}, seed: 'protected-objective',
});
const ordinaryProtectionInput = structuredClone(protectedInput);
delete ordinaryProtectionInput.胜负条件;
const ordinaryDecision = inspectDecision({
  worldSnapshot: ordinaryProtectionInput, actorId: 'player-a', actionOpportunity: { role: 'ACTIVE', sequence: 1 }, beliefState: {}, seed: 'protected-objective',
});
const bestDefenseUtility = decision => Math.max(...decision.candidates.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate?.declaration?.actionKind)).map(candidate => Number(candidate.objectiveUtility || 0)));
assert.ok(bestDefenseUtility(protectedDecision) > bestDefenseUtility(ordinaryDecision), '无伤失败条件没有提高可兑现防守动作的终态保护价值');
const protectedResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'battle-objective-protected-unit-damaged', seed: 6403, combatData: protectedInput, mode: 'team_preview', rounds: 3, settings: {},
});
assert.equal(protectedResult.roundsExecuted, 1, '指定单位受伤后仍继续执行后续回合');
assert.equal(protectedResult.finalBattleReport?.objectiveWinner, 'enemy', '指定单位受伤没有触发我方失败终态');
assert.ok(protectedResult.ledger.some(event => event?.eventKind === 'battle_objective_resolved' && event?.result === 'enemy'), '受伤失败条件缺少唯一目标终态事实');
assert.ok(protectedResult.decisions.find(entry => entry?.actorId === 'player-a' && entry?.actionRole === 'ACTIVE')?.problems?.some(problem => problem?.problemId === 'SURVIVAL_CRISIS'), '指定单位无伤条件没有进入行为问题识别');

const towerUnit = (id, age) => {
  const unit = participant(id, 'player', 120);
  unit.属性.年龄 = age;
  return unit;
};
const towerCombat = ages => ({
  ...combatData(),
  战斗类型: '魂灵塔冲塔',
  参战者: {
    team_player: ages.map((age, index) => towerUnit(`tower-player-${index + 1}`, age)),
    team_enemy: [participant('tower-guardian', 'enemy', 100)],
  },
});
const validTowerRoster = sandbox.__LWCS_BATTLE_RUNTIME__.validateSoulTowerRoster(towerCombat([18, 21]));
assert.equal(validTowerRoster.ok, true, '魂灵塔年龄差边界3岁没有通过');
assert.equal(validTowerRoster.rosterCount, 2, '魂灵塔合法队伍人数统计错误');
assert.equal(validTowerRoster.minAge, 18, '魂灵塔合法队伍最小年龄错误');
assert.equal(validTowerRoster.maxAge, 21, '魂灵塔合法队伍最大年龄错误');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.validateSoulTowerRoster(towerCombat([])).message, /队伍为空/, '魂灵塔空队没有被拒绝');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.validateSoulTowerRoster(towerCombat([18, 18, 18, 18, 18, 18, 18, 18])).message, /最多 7 人/, '魂灵塔8人队伍没有被拒绝');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.validateSoulTowerRoster(towerCombat([31])).message, /超过 30 岁/, '魂灵塔超龄成员没有被拒绝');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.validateSoulTowerRoster(towerCombat([18, 22])).message, /年龄差不能超过 3 岁/, '魂灵塔年龄差4岁没有被拒绝');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.validateSoulTowerRoster(combatData()).skipped, true, '普通战斗错误执行魂灵塔资格校验');
const invalidTowerResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'soul-tower-invalid-roster', seed: 6410, combatData: towerCombat([31]), mode: 'team_preview', rounds: 2, settings: {},
});
assert.equal(invalidTowerResult.roundsExecuted, 0, '魂灵塔资格不合法仍进入正式回合');
assert.match(String(invalidTowerResult.logs?.join(' ') || ''), /魂灵塔资格驳回/, '魂灵塔资格拒绝没有进入正式运行结果');

const reviveUnit = participant('revive-unit', 'player', 100);
reviveUnit.hp = 0;
reviveUnit.hp_max = 500;
reviveUnit.属性.HP = 0;
reviveUnit.属性.HP上限 = 500;
reviveUnit.状态效果 = {
  复生印记: { 战斗效果: { revive_count: 2, revive_heal_ratio: 0.3 } },
};
const reviveResult = sandbox.__LWCS_BATTLE_RUNTIME__.triggerStateRevive(reviveUnit, '复活测试单位');
assert.equal(reviveResult?.revived, true, '状态型复活没有触发');
assert.equal(reviveUnit.hp, 150, '状态型复活恢复量错误');
assert.equal(reviveUnit.状态效果.复生印记.战斗效果.revive_count, 1, '状态型复活次数没有唯一消费');

const blockedReviveUnit = participant('blocked-revive-unit', 'player', 100);
blockedReviveUnit.hp = 0;
blockedReviveUnit.hp_max = 500;
blockedReviveUnit.属性.HP = 0;
blockedReviveUnit.属性.HP上限 = 500;
blockedReviveUnit.状态效果 = {
  复生印记: { 战斗效果: { revive_count: 1, revive_heal_ratio: 0.3 } },
  复生封锁: { 抹消规则: [{ 抹消对象: { 原型: '规则防御', 规则: '复活' }, 抹消方式: '持续封锁' }] },
};
const blockedReviveResult = sandbox.__LWCS_BATTLE_RUNTIME__.triggerStateRevive(blockedReviveUnit, '受阻测试单位');
assert.equal(blockedReviveResult?.revived, false, '机制抹消未阻止状态型复活');
assert.equal(blockedReviveUnit.hp, 0, '复活受阻后仍修改生命值');
assert.equal(blockedReviveUnit.状态效果.复生印记.战斗效果.revive_count, 1, '复活受阻后错误消费复活次数');

const passiveReviveUnit = participant('passive-revive-unit', 'player', 100);
passiveReviveUnit.hp = 0;
passiveReviveUnit.hp_max = 500;
passiveReviveUnit.属性.HP = 0;
passiveReviveUnit.属性.HP上限 = 500;
passiveReviveUnit.血脉之力 = {
  被动复生: {
    name: '血脉复生',
    _效果数组: [{ 原型: '规则改写', 规则: '死亡转存活', 目标: '自身', 数值: '+20%', 触发限制: { 周期: '每战', 次数: 1 } }],
  },
};
const passiveReviveLog = sandbox.__LWCS_BATTLE_RUNTIME__.triggerRevive(passiveReviveUnit, '被动复活测试单位');
assert.match(String(passiveReviveLog || ''), /血脉复生/, '被动死亡转存活没有从正式角色结构触发');
assert.equal(passiveReviveUnit.hp, 100, '被动死亡转存活恢复量错误');
passiveReviveUnit.hp = 0;
passiveReviveUnit.属性.HP = 0;
delete passiveReviveUnit.__本阶段已触发复活;
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.triggerRevive(passiveReviveUnit, '被动复活测试单位'), null, '每战一次的被动复活被重复消费');

const falsePassiveUnit = participant('false-passive-unit', 'player', 100);
falsePassiveUnit.hp = 0;
falsePassiveUnit.hp_max = 500;
falsePassiveUnit.属性.HP = 0;
falsePassiveUnit.属性.HP上限 = 500;
falsePassiveUnit.状态效果 = {
  伪复活状态: { _效果数组: [{ 原型: '规则改写', 规则: '死亡转存活', 目标: '自身', 数值: '+80%' }] },
};
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.triggerRevive(falsePassiveUnit, '伪复活测试单位'), null, '状态中的伪技能被误识别为被动复活');

const sideEffectUnit = participant('side-effect-unit', 'player', 100);
const sideEffectLog = sandbox.__LWCS_BATTLE_RUNTIME__.settleConditionSideEffects(sideEffectUnit, '测试增幅', {
  副作用列表: [{ 副作用类型: '全属性降低', 触发时机: '回合结束时', 生效对象: '技能释放者', 触发概率: 1, 数值: '20%', 持续回合: 2 }],
}, '回合结束时', '副作用测试单位', combatData());
assert.match(sideEffectLog, /全属性降低/, '回合末副作用没有形成结构化结算日志');
assert.equal(sideEffectUnit.状态效果.虚弱?.面板修改比例?.str, 0.8, '全属性降低副作用没有写入正确面板比例');

const immuneSideEffectUnit = participant('immune-side-effect-unit', 'player', 100);
immuneSideEffectUnit.状态效果.异常免疫 = { 类型: 'buff', 战斗效果: { 无视异常: true } };
const immuneSideEffectLog = sandbox.__LWCS_BATTLE_RUNTIME__.settleConditionSideEffects(immuneSideEffectUnit, '测试增幅', {
  副作用列表: [{ 副作用类型: '动作迟缓', 触发时机: '效果结束后', 生效对象: '技能释放者', 触发概率: 1 }],
}, '效果结束后', '免疫测试单位', combatData());
assert.match(immuneSideEffectLog, /无视异常/, '无视异常没有阻止回合末负面副作用');
assert.equal(immuneSideEffectUnit.状态效果.迟缓, undefined, '被免疫的副作用仍写入状态');

const cleansingSideEffectUnit = participant('cleansing-side-effect-unit', 'player', 100);
cleansingSideEffectUnit.状态效果.持续净化 = {
  特殊机制标识: '持续状态移除',
  持续原型效果: { 原型: '状态移除', 状态: '任意负面' },
};
const cleansingSideEffectLog = sandbox.__LWCS_BATTLE_RUNTIME__.settleConditionSideEffects(cleansingSideEffectUnit, '测试增幅', {
  副作用列表: [{ 副作用类型: '精神紊乱', 触发时机: '回合结束时', 生效对象: '技能释放者', 触发概率: 1 }],
}, '回合结束时', '净化测试单位', combatData());
assert.match(cleansingSideEffectLog, /持续状态移除/, '持续状态移除没有拦截回合末副作用');
assert.equal(cleansingSideEffectUnit.状态效果.精神紊乱, undefined, '持续净化拦截后仍写入副作用状态');

const lethalSideEffectUnit = participant('lethal-side-effect-unit', 'player', 100);
lethalSideEffectUnit.hp = 500;
lethalSideEffectUnit.hp_max = 500;
lethalSideEffectUnit.属性.HP = 500;
lethalSideEffectUnit.属性.HP上限 = 500;
lethalSideEffectUnit.状态效果.复生印记 = { 战斗效果: { revive_count: 1, revive_heal_ratio: 0.2 } };
const lethalSideEffectLog = sandbox.__LWCS_BATTLE_RUNTIME__.settleConditionSideEffects(lethalSideEffectUnit, '献祭状态', {
  副作用列表: [{ 副作用类型: '致死献祭', 触发时机: '效果结束后', 生效对象: '技能释放者', 触发概率: 1, 关联状态: '献祭状态' }],
}, '效果结束后', '献祭测试单位', combatData());
assert.match(lethalSideEffectLog, /复活触发/, '致死副作用没有接入统一复活结算');
assert.equal(lethalSideEffectUnit.hp, 100, '致死副作用后的复活恢复量错误');

const delayedUnit = participant('delayed-unit', 'player', 100);
delayedUnit.hp = 500;
delayedUnit.hp_max = 500;
delayedUnit.sp = 200;
delayedUnit.sp_max = 500;
delayedUnit.属性.HP = 500;
delayedUnit.属性.HP上限 = 500;
delayedUnit.属性.魂力 = 200;
delayedUnit.属性.魂力上限 = 500;
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.settleDelayedEffect(delayedUnit, {
  原型: '伤害结算', 伤害类型: '真实攻击', 威力倍率: 100,
}, '延迟测试单位'), /50点真实攻击/, '延迟伤害结算错误');
assert.equal(delayedUnit.hp, 450, '延迟伤害没有落地');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.settleDelayedEffect(delayedUnit, {
  原型: '资源变化', 资源: '魂力', 数值: '+10%',
}, '延迟测试单位'), /恢复50点魂力/, '延迟资源变化结算错误');
assert.equal(delayedUnit.sp, 250, '延迟资源变化没有落地');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.settleDelayedEffect(delayedUnit, {
  原型: '护盾变化', 数值: '+100', 持续回合: 2,
}, '延迟测试单位'), /获得100点护盾/, '延迟护盾结算错误');
assert.equal(delayedUnit.状态效果.延迟护盾?.shield_value, 100, '延迟护盾没有写入状态');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.settleDelayedEffect(delayedUnit, {
  原型: '属性修正', 属性: '力量', 数值: '+20%', 持续回合: 2,
}, '延迟测试单位'), /力量修正/, '延迟属性修正结算错误');
assert.equal(delayedUnit.状态效果['延迟属性:力量']?.面板修改比例?.str, 1.2, '延迟属性修正没有写入运行键');
assert.match(sandbox.__LWCS_BATTLE_RUNTIME__.settleDelayedEffect(delayedUnit, {
  原型: '状态施加', 状态: '延迟眩晕', 目标: '敌方单体', 持续回合: 1, 计算层效果: { skip_turn: true },
}, '延迟测试单位'), /延迟眩晕/, '延迟状态施加结算错误');
assert.equal(delayedUnit.状态效果.延迟眩晕?.战斗效果?.skip_turn, true, '延迟状态没有写入计算层效果');
assert.throws(() => sandbox.__LWCS_BATTLE_RUNTIME__.settleDelayedEffect(delayedUnit, {
  原型: '未知延迟原型', 数值: 1,
}, '延迟测试单位'), /battle_delayed_effect_unsupported/, '未知延迟原型被静默跳过');

const persistentResourceCombat = combatData();
const persistentCaster = persistentResourceCombat.参战者.team_player[0];
const persistentTarget = persistentResourceCombat.参战者.team_enemy[0];
persistentCaster.hp = 300;
persistentCaster.hp_max = 500;
persistentCaster.属性.HP = 300;
persistentCaster.属性.HP上限 = 500;
persistentTarget.hp = 500;
persistentTarget.hp_max = 500;
persistentTarget.属性.HP = 500;
persistentTarget.属性.HP上限 = 500;
const persistentResourceLog = sandbox.__LWCS_BATTLE_RUNTIME__.settlePersistentPrototype(persistentTarget, '生命吞噬', {
  来源角色: 'player-a', 目标角色: 'enemy-a', 持续原型效果: { 原型: '资源转移', 资源: '生命', 资源转移方式: '吞噬', 数值: '10%', 转化比例: 1 },
}, 'enemy-a', persistentResourceCombat);
assert.match(persistentResourceLog, /持续资源转移/, '持续资源转移没有执行');
assert.equal(persistentTarget.hp, 450, '持续吞噬没有扣除目标生命');
assert.equal(persistentCaster.hp, 350, '持续吞噬没有回补来源生命');

const persistentRemovalUnit = participant('persistent-removal-unit', 'enemy', 100);
persistentRemovalUnit.状态效果 = {
  持续净化: { 持续原型效果: { 原型: '状态移除', 状态: '任意负面', 数量: 1 } },
  中毒: { 类型: 'debuff', 状态: '中毒', 战斗效果: { dot_damage: 20 } },
};
const persistentRemovalLog = sandbox.__LWCS_BATTLE_RUNTIME__.settlePersistentPrototype(persistentRemovalUnit, '持续净化', persistentRemovalUnit.状态效果.持续净化, '净化目标', combatData());
assert.match(persistentRemovalLog, /移除了\[中毒\]/, '持续状态移除没有选择负面状态');
assert.equal(persistentRemovalUnit.状态效果.中毒, undefined, '持续状态移除没有删除目标状态');

const persistentTransferCombat = combatData();
const transferCaster = persistentTransferCombat.参战者.team_player[0];
const transferTarget = persistentTransferCombat.参战者.team_enemy[0];
transferCaster.状态效果.中毒 = { 类型: 'debuff', 状态: '中毒', 战斗效果: { dot_damage: 10 } };
const transferLog = sandbox.__LWCS_BATTLE_RUNTIME__.settlePersistentPrototype(transferCaster, '转移媒介', {
  来源角色: 'player-a', 目标角色: 'enemy-a', 来源技能: '状态转移测试',
  持续原型效果: { 原型: '状态转移', 来源: '自身', 去向: '目标', 状态: '任意负面', 数量: 1 },
}, '转移目标', persistentTransferCombat);
assert.match(transferLog, /中毒.*转移/, '持续状态转移没有形成转移事实');
assert.equal(transferCaster.状态效果.中毒, undefined, '持续状态转移没有删除来源状态');
assert.ok(transferTarget.状态效果.中毒, '持续状态转移没有写入接收方');

const persistentExchangeCombat = combatData();
const exchangeCaster = persistentExchangeCombat.参战者.team_player[0];
const exchangeTarget = persistentExchangeCombat.参战者.team_enemy[0];
exchangeCaster.状态效果.迟缓 = { 类型: 'debuff', 状态: '迟缓', 战斗效果: { reaction_penalty: 0.2 } };
exchangeTarget.状态效果.迅捷 = { 类型: 'buff', 状态: '迅捷', 战斗效果: { reaction_bonus: 0.2 } };
const exchangeLog = sandbox.__LWCS_BATTLE_RUNTIME__.settlePersistentPrototype(exchangeCaster, '交换媒介', {
  来源角色: 'player-a', 目标角色: 'enemy-a', 来源技能: '状态交换测试',
  持续原型效果: { 原型: '状态交换', 状态: '任意负面' },
}, '交换目标', persistentExchangeCombat);
assert.match(exchangeLog, /持续状态交换/, '持续状态交换没有执行');
assert.ok(exchangeCaster.状态效果.迅捷, '持续状态交换没有把增益写给来源方');
assert.ok(exchangeTarget.状态效果.迟缓, '持续状态交换没有把负面写给目标方');
assert.throws(() => sandbox.__LWCS_BATTLE_RUNTIME__.settlePersistentPrototype(exchangeCaster, '未知持续', {
  持续原型效果: { 原型: '未知持续原型' },
}, '未知目标', persistentExchangeCombat), /battle_persistent_prototype_unsupported/, '未知持续原型被静默跳过');

const structuredCombat = combatData();
structuredCombat.回合 = 1;
const structuredTarget = structuredCombat.参战者.team_enemy[0];
const structuredHpBefore = structuredTarget.属性.HP;
const structuredDamage = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '结构化双击', _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击', 攻击段数: 2, 命中概率: 1 }] },
  },
});
assert.equal(structuredDamage.facts.filter(event => event?.eventKind === 'hit_result' && event?.result === 'hit').length, 2, '结构化提交器没有逐段写入两次命中');
assert.ok(structuredTarget.属性.HP < structuredHpBefore, '结构化多段伤害没有修改正式影子快照');
assert.equal(structuredDamage.facts.filter(event => event?.eventKind === 'action_start').length, 1, '结构化动作生成了多个主动根');

const zeroHitCombat = combatData();
zeroHitCombat.回合 = 1;
const zeroHitTarget = zeroHitCombat.参战者.team_enemy[0];
const zeroHitBefore = zeroHitTarget.属性.HP;
const zeroHitResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: zeroHitCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '零命中测试', _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 999, 伤害类型: '真实攻击', 命中概率: 0 }] },
  },
});
assert.equal(zeroHitTarget.属性.HP, zeroHitBefore, '0%命中率仍造成伤害');
assert.equal(zeroHitResult.facts.find(event => event?.eventKind === 'hit_result')?.result, 'miss', '0%命中率没有形成失败事实');

const structuredEffectCombat = combatData();
structuredEffectCombat.回合 = 1;
const structuredEffectResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredEffectCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '结构化复合效果', _效果数组: [
      { 原型: '资源变化', 目标: '单体', 资源: '魂力', 数值: '-10%' },
      { 原型: '护盾变化', 目标: '单体', 数值: '+50' },
      { 原型: '状态施加', 目标: '单体', 状态: '结构化眩晕', 持续回合: 1, 成功率: 1, 计算层效果: { skip_turn: true } },
    ] },
  },
});
assert.ok(structuredEffectResult.facts.some(event => event?.factType === 'RESOURCE_CHANGE'), '结构化资源变化缺少事实');
assert.ok(structuredEffectResult.facts.some(event => event?.factType === 'SHIELD_CHANGE'), '结构化护盾变化缺少事实');
assert.equal(structuredEffectCombat.参战者.team_enemy[0].状态效果.结构化眩晕?.战斗效果?.skip_turn, true, '结构化状态没有落入影子快照');

const structuredDefense = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: combatData(),
  declaration: { actorId: 'player-a', actionKind: 'DEFEND', targetIds: ['player-a'], targetKind: '自身' },
});
assert.equal(structuredDefense.terminal, 'SUCCESS', '结构化防御没有形成唯一成功终态');
assert.equal(structuredDefense.facts.filter(event => event?.eventKind === 'defend').length, 1, '结构化防御被拆成多个终态事实');

const successfulEvadeCombat = combatData();
successfulEvadeCombat.回合 = 1;
const successfulEvadeParent = sandbox.__LWCS_BATTLE_RUNTIME__.beginStructuredDeclaration({
  combatData: successfulEvadeCombat,
  declaration: { actorId: 'player-a', actionKind: 'BASIC_ATTACK', targetIds: ['enemy-a'] },
});
const originalSandboxRandom = sandbox.Math.random;
sandbox.Math.random = () => 0;
const successfulEvade = sandbox.__LWCS_BATTLE_RUNTIME__.settleStructuredReaction({
  combatData: successfulEvadeCombat,
  reactor: successfulEvadeCombat.参战者.team_enemy[0],
  sourceActor: successfulEvadeCombat.参战者.team_player[0],
  declaration: { actorId: 'enemy-a', actionKind: 'EVADE', targetIds: ['enemy-a'] },
  parentActionEvent: successfulEvadeParent.actionEvent,
});
sandbox.Math.random = () => 0.999999;
const failedEvade = sandbox.__LWCS_BATTLE_RUNTIME__.settleStructuredReaction({
  combatData: successfulEvadeCombat,
  reactor: successfulEvadeCombat.参战者.team_enemy[0],
  sourceActor: successfulEvadeCombat.参战者.team_player[0],
  declaration: { actorId: 'enemy-a', actionKind: 'EVADE', targetIds: ['enemy-a'] },
  parentActionEvent: successfulEvadeParent.actionEvent,
});
sandbox.Math.random = originalSandboxRandom;
assert.equal(successfulEvade.evaded, true, '结构化闪避在必成功投点下仍失败');
assert.equal(failedEvade.evaded, false, '结构化闪避在必失败投点下仍成功');
assert.equal(successfulEvade.event.sourceActionId, successfulEvadeParent.actionEvent.actionId, '结构化闪避没有绑定父动作');
assert.equal(successfulEvade.event.sourceNodeId, successfulEvadeParent.actionEvent.chainNodeId, '结构化闪避没有保留父动作来源节点');

const undefendedCombat = combatData();
undefendedCombat.回合 = 1;
const undefendedTargetBefore = undefendedCombat.参战者.team_enemy[0].属性.HP;
sandbox.Math.random = () => 0;
const undefendedResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: undefendedCombat,
  declaration: { actorId: 'player-a', actionKind: 'BASIC_ATTACK', targetIds: ['enemy-a'] },
});
const undefendedDamage = undefendedTargetBefore - undefendedCombat.参战者.team_enemy[0].属性.HP;
const defendedCombat = combatData();
defendedCombat.回合 = 1;
const defendedParent = sandbox.__LWCS_BATTLE_RUNTIME__.beginStructuredDeclaration({
  combatData: defendedCombat,
  declaration: { actorId: 'player-a', actionKind: 'BASIC_ATTACK', targetIds: ['enemy-a'] },
});
const defendedReaction = sandbox.__LWCS_BATTLE_RUNTIME__.settleStructuredReaction({
  combatData: defendedCombat,
  reactor: defendedCombat.参战者.team_enemy[0],
  sourceActor: defendedCombat.参战者.team_player[0],
  declaration: { actorId: 'enemy-a', actionKind: 'DEFEND', targetIds: ['enemy-a'] },
  parentActionEvent: defendedParent.actionEvent,
});
const defendedTargetBefore = defendedCombat.参战者.team_enemy[0].属性.HP;
sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: defendedCombat,
  declaration: defendedParent.declaration,
  actionContext: defendedParent,
  reactionByTarget: { 'enemy-a': defendedReaction },
});
sandbox.Math.random = originalSandboxRandom;
const defendedDamage = defendedTargetBefore - defendedCombat.参战者.team_enemy[0].属性.HP;
assert.ok(undefendedDamage > 0, '结构化无防御基准没有造成伤害');
assert.ok(defendedDamage > 0 && defendedDamage < undefendedDamage, `结构化防御没有实际降低伤害:${defendedDamage}/${undefendedDamage}`);

assert.throws(() => sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: combatData(),
  declaration: { actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'], skill: { name: '未知提交', _效果数组: [{ 原型: '未知战斗原型', 目标: '单体' }] } },
}), /battle_structured_prototype_unsupported/, '未迁移原型在结构化提交器中被静默跳过');

const structuredPreviewCombat = combatData();
structuredPreviewCombat.回合 = 1;
const structuredPreviewTarget = structuredPreviewCombat.参战者.team_enemy[0];
const defenseBefore = Number(structuredPreviewTarget.属性.防御 || 0);
const structuredPreviewResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredPreviewCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '结构化属性削弱', _效果数组: [{ 原型: '属性修正', 目标: '单体', 属性: '防御', 数值: '-10%' }] },
  },
});
assert.ok(Number(structuredPreviewTarget.属性.防御 || 0) < defenseBefore, 'Preview复杂原型差量没有原子提交到影子快照');
assert.ok(structuredPreviewResult.facts.some(event => event?.effectPrototype === '属性修正' && event?.eventKind === 'effect_resolved'), 'Preview复杂原型缺少结构化结算事实');
const structuredCoverage = sandbox.__LWCS_BATTLE_RUNTIME__.auditStructuredCommitCoverage();
assert.equal(structuredCoverage.prototypeCount, 23, '结构化提交器没有覆盖全部23个战斗原型的责任归属');
assert.equal(Array.from(structuredCoverage.pending || []).join(','), '', '结构化提交器仍存在未登记原型');

const structuredSummonCombat = combatData();
structuredSummonCombat.回合 = 1;
const structuredSummonResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredSummonCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['player-a'],
    skill: { name: '结构化召唤', _效果数组: [{ 原型: '召唤生成', 目标: '自身', 召唤物名称: '测试协同体', 召唤单位类型: '魂兽', 行动模式: '协同攻击', 持续回合: 1, 继承属性比例: 0.4 }] },
  },
});
const structuredSummons = Object.values(structuredSummonCombat.召唤单位表 || {});
assert.equal(structuredSummons.length, 1, '结构化召唤没有创建唯一运行态实体');
assert.equal(structuredSummons[0].__来源状态?.duration, 1, '持续1回合召唤没有保留一个真实行动窗口');
assert.ok(structuredSummonCombat.参战者.team_player[0].状态效果['召唤:测试协同体'], '结构化召唤没有建立宿主来源状态');
assert.equal(structuredSummonResult.facts.filter(event => event?.eventKind === 'summon_create').length, 1, '结构化召唤缺少唯一生成事实');

const shadowInput = combatData();
const shadowInputHash = digest(shadowInput);
const structuredShadow = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-duel', seed: 88421, combatData: shadowInput, mode: 'team_preview', rounds: 2,
  settings: { decisionEngine: 'next-shadow' },
});
assert.equal(digest(shadowInput), shadowInputHash, '完整结构化影子回合修改了原始输入');
assert.ok(structuredShadow.roundsExecuted >= 1, '完整结构化影子回合没有执行');
const structuredShadowActiveRoots = structuredShadow.ledger.filter(event => event?.eventKind === 'action_start' && event?.actionRole === 'ACTIVE');
assert.ok(new Set(structuredShadowActiveRoots.map(event => event?.actorName)).has('player-a'), '结构化影子1v1缺少我方自然行动');
assert.ok(new Set(structuredShadowActiveRoots.map(event => event?.actorName)).has('enemy-a'), '结构化影子1v1缺少敌方自然行动');
assert.equal(structuredShadow.ledger.filter(event => event?.eventKind === 'round_summary').length, structuredShadow.roundsExecuted, `结构化影子回合总结不连续或重复:${JSON.stringify(structuredShadow.ledger.map(event => [event.eventKind, event.round]))}/${structuredShadow.roundsExecuted}`);
assert.equal(structuredShadow.roundOverview.length, structuredShadow.roundsExecuted, '结构化影子回合速览未连续覆盖实际回合');
assert.ok(structuredShadow.ledger.some(event => ['hit_result', 'defend', 'dodge', 'effect_resolved', 'state_apply'].includes(event?.eventKind)), '结构化影子回合没有产生实际结算事实');
assert.equal(structuredShadow.audit?.fatals?.length || 0, 0, `完整结构化影子事实审计失败:${JSON.stringify(structuredShadow.audit?.fatals || [])}`);
assert.ok(structuredShadow.decisions.some(entry => entry?.actionRole === 'REACTION'), '完整结构化影子回合没有让受击方进行正式反应决策');
assert.ok(structuredShadow.ledger.filter(event => ['dodge', 'defend'].includes(event?.eventKind)).every(event =>
  event?.sourceActionId && event?.parentNodeId
), '结构化反应事实缺少父动作因果绑定');
const structuredShadowRepeat = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-duel', seed: 88421, combatData: shadowInput, mode: 'team_preview', rounds: 2,
  settings: { decisionEngine: 'next-shadow' },
});
assert.equal(digest({ ledger: structuredShadowRepeat.ledger, finalSnapshot: structuredShadowRepeat.finalSnapshot }), digest({ ledger: structuredShadow.ledger, finalSnapshot: structuredShadow.finalSnapshot }), '结构化影子同种子不能复现');

const structuredCounterShadow = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-counter', seed: 1, combatData: combatData(), mode: 'team_preview', rounds: 1,
  settings: { decisionEngine: 'next-shadow' },
});
const structuredCounterDecision = structuredCounterShadow.decisions.find(entry => entry?.actionRole === 'COUNTER');
const structuredCounterStart = structuredCounterShadow.ledger.find(event => event?.eventKind === 'action_start' && event?.actionRole === 'COUNTER');
const structuredCounterWindow = structuredCounterShadow.ledger.find(event => event?.eventKind === 'counter_window' && event?.result === 'opened');
assert.ok(structuredCounterDecision, '固定反击案例没有进入COUNTER决策');
assert.ok(structuredCounterStart && structuredCounterWindow, '固定反击案例缺少窗口或反击动作');
assert.equal(structuredCounterStart.sourceActionId, structuredCounterWindow.sourceActionId, '反击动作没有绑定被反制的主动动作');
assert.equal(structuredCounterStart.parentNodeId, structuredCounterWindow.chainNodeId, '反击动作没有挂在反击窗口节点下');
const structuredCounterOrder = structuredCounterShadow.actionQueueTrace
  .filter(entry => entry?.state === 'EXECUTING')
  .map(entry => entry?.nodeKind);
assert.ok(
  structuredCounterOrder.indexOf('REACTION') < structuredCounterOrder.indexOf('PRIMARY_SETTLEMENT') &&
  structuredCounterOrder.indexOf('PRIMARY_SETTLEMENT') < structuredCounterOrder.indexOf('COUNTER'),
  `反应、主结算、反击顺序错误:${structuredCounterOrder.join('>')}`,
);

const structuredFollowUpSkill = {
  id: 'structured-follow-up',
  name: '结构化命中追击',
  魂技名: '结构化命中追击',
  消耗: '无',
  前摇: 10,
  命中后追击: true,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 65, 伤害类型: '近身攻击', 命中概率: 1 }],
};
const structuredFollowUpShadow = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-follow-up',
  seed: 88421,
  combatData: combatData(),
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: structuredFollowUpSkill,
  },
  settings: { decisionEngine: 'next-shadow' },
});
const structuredFollowUpNodes = structuredFollowUpShadow.actionQueueTrace.filter(entry => entry?.nodeKind === 'CONTINUATION');
assert.ok(structuredFollowUpNodes.some(entry => entry?.state === 'EXECUTING'), '显式命中追击没有生成并消费唯一后继授权');
assert.equal(new Set(structuredFollowUpNodes.filter(entry => entry?.state === 'EXECUTING').map(entry => entry?.grantId)).size, 1, '显式追击授权被重复消费');
assert.ok(structuredFollowUpShadow.decisions.some(entry => entry?.continuation === true), '显式追击没有按最新战场重新决策');

const controlledFollowUpSkill = {
  ...structuredFollowUpSkill,
  id: 'structured-controlled-follow-up',
  name: '结构化僵直追击',
  魂技名: '结构化僵直追击',
  _效果数组: [
    ...structuredFollowUpSkill._效果数组,
    { 原型: '状态施加', 目标: '自身', 状态: '施法僵直', 持续回合: 1, 成功率: 1, 计算层效果: { skip_turn: true } },
  ],
};
const controlledFollowUpShadow = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-controlled-follow-up',
  seed: 88421,
  combatData: combatData(),
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: controlledFollowUpSkill,
  },
  settings: { decisionEngine: 'next-shadow' },
});
const controlledFollowUpTrace = controlledFollowUpShadow.actionQueueTrace.filter(entry => entry?.nodeKind === 'CONTINUATION');
assert.ok(controlledFollowUpTrace.some(entry => entry?.state === 'ENQUEUED'), '受控行动者的显式后继授权没有先形成');
assert.ok(controlledFollowUpTrace.some(entry => entry?.state === 'CANCELLED'), `受控行动者的后继动作没有在执行前取消:${JSON.stringify(controlledFollowUpTrace)}`);
assert.ok(controlledFollowUpShadow.ledger.some(event =>
  event?.eventKind === 'blocked_action' && event?.ruleCode === 'CONTINUATION_ACTOR_UNAVAILABLE'
), '受控后继取消缺少结构化事实');

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
    hpThresholdRounds: hpThresholdResult.roundsExecuted,
    surviveRounds: surviveResult.roundsExecuted,
    protectedObjectiveWinner: protectedResult.finalBattleReport?.objectiveWinner || '',
    soulTowerRosterChecks: 7,
    stateReviveChecks: 2,
    passiveReviveChecks: 3,
    roundEndSideEffectChecks: 4,
    delayedEffectChecks: 6,
    persistentPrototypeChecks: 5,
    structuredCommitChecks: 12,
    structuredShadowChecks: 7,
    fatalCount: result.audit?.fatals?.length || 0,
    passed: true,
  },
}, null, 2));

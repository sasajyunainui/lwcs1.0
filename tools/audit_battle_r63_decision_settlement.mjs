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
assert.equal(nonlethalResult.finalSnapshot?.team_enemy?.[0]?.hp, 1, '非致命战斗意图没有保留目标生命');
const nonlethalPrevented = nonlethalResult.ledger.filter(event => event?.eventKind === 'hit_result' && event?.meta?.intentLethalPrevented === true);
assert.equal(nonlethalPrevented.length, 1, '非致命限伤事实数量不唯一');
assert.equal(nonlethalResult.roundsExecuted, Number(nonlethalPrevented[0]?.round || 0), '非致命限伤后仍继续生成自然行动回合');
assert.equal(nonlethalResult.audit?.fatals?.length || 0, 0, `非致命结算审计失败:${JSON.stringify(nonlethalResult.audit?.fatals || [])}`);

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
const supportCost = supportResult.ledger.find(event => event?.eventKind === 'action_cost' && event?.actorName === 'player-a' && event?.actionName === '群体支援');
assert.equal(Number(supportCost?.meta?.reqSp || 0), 1, '对象型绝对魂力消耗没有按1点正式结算');

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
assert.equal(defenseResult.audit?.fatals?.length || 0, 0, `蓄力防守时序事实审计失败:${JSON.stringify(defenseResult.audit?.fatals || [])}`);

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
    fatalCount: result.audit?.fatals?.length || 0,
    passed: true,
  },
}, null, 2));

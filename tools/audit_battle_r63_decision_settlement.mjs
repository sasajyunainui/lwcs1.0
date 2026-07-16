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

const inspectDecision = (input, engine = 'legacy') => {
  let candidates = [];
  const decide = engine === 'next'
    ? sandbox.__LWCS_BATTLE_DECISION__.decideNext
    : sandbox.__LWCS_BATTLE_DECISION__.decide;
  const result = decide({ ...input, inspectCandidates: value => { candidates = value; } });
  return { ...result, candidates };
};

const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), { querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; } });
const container = { innerHTML: '', querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; } };
new sandbox.BattleUIComponent(container, {}, {});

const uiCandidateInput = combatData();
const uiActions = sandbox.BattleUIBridge.getAvailableActions(uiCandidateInput.参战者.team_player[0], uiCandidateInput);
assert.ok(uiActions.length >= 3, 'BattleUI没有投影正式Decision候选');
assert.ok(uiActions.every(action => Array.isArray(action.declarations) && action.declarations.length > 0), 'BattleUI动作仍由本地旧声明器生成');
assert.ok(uiActions.every(action => action.declarations.every(declaration => declaration?.actorId === 'player-a' && declaration?.actionKind)), 'BattleUI候选缺少正式结构化声明');
const uiBasicAction = uiActions.find(action => action.actionKind === 'BASIC_ATTACK');
const uiSkillAction = uiActions.find(action => action.actionKind === 'RELEASE_SKILL');
assert.ok(uiBasicAction?.declaration?.targetIds?.includes('enemy-a'), 'BattleUI普通攻击目标没有来自Decision候选');
assert.equal(uiSkillAction?.raw_skill?.name, '测试突击', 'BattleUI魂技不是由正式技能候选投影');
const uiLockedPreview = sandbox.BattleUIBridge.executePlayerBattleIntent('测试突击', {
  mode: 'single_round',
  dryRun: true,
  combatData: uiCandidateInput,
  actionDeclaration: uiSkillAction.declaration,
});
assert.ok(uiLockedPreview.ledger.some(event => event?.eventKind === 'action_start' && event?.actorControl === 'PLAYER_LOCKED' && event?.actionName === '测试突击'), 'BattleUI结构化声明没有穿过唯一正式入口');

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
const shieldReactionCombat = combatData();
const shieldReactionAttacker = shieldReactionCombat.参战者.team_player[0];
const shieldReactionDefender = shieldReactionCombat.参战者.team_enemy[0];
const shieldReactionParent = sandbox.__LWCS_BATTLE_RUNTIME__.beginStructuredDeclaration({
  combatData: shieldReactionCombat,
  declaration: { actionKind: 'BASIC_ATTACK', actorId: 'player-a', targetIds: ['enemy-a'] },
  actionRole: 'ACTIVE',
  actorControl: 'AI',
});
const shieldOnlyDeclaration = {
  actorId: 'enemy-a',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['enemy-a'],
  skill: {
    id: 'shield-only-reaction',
    name: '纯护盾反应',
    魂技名: '纯护盾反应',
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: 'shield-only-reaction:shield',
      原型: '护盾变化',
      目标: '自身',
      护盾模式: '正向护盾',
      数值: '+20%',
      持续回合: 1,
    }],
  },
};
const shieldOnlyReaction = sandbox.__LWCS_BATTLE_RUNTIME__.settleStructuredReaction({
  combatData: shieldReactionCombat,
  reactor: shieldReactionDefender,
  sourceActor: shieldReactionAttacker,
  declaration: shieldOnlyDeclaration,
  parentActionEvent: shieldReactionParent.actionEvent,
});
assert.equal(shieldOnlyReaction.opensCounterCheck, false, '纯护盾反应技能被错误授予反击窗口');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.openStructuredCounterWindow({
  combatData: shieldReactionCombat,
  reactor: shieldReactionDefender,
  sourceActor: shieldReactionAttacker,
  parentActionEvent: shieldReactionParent.actionEvent,
  reaction: shieldOnlyReaction,
  settlementFacts: [],
}), null, '没有显式反击授权的反应技能仍打开防反窗口');
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
itemCombat.胜负条件 = {
  version: 1,
  explicit: true,
  startRound: 0,
  maxRounds: 6,
  resolutionPriority: 'DEFEAT_FIRST',
  victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }] },
  defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
};
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
  selectedAction: structuredClone(itemDefinition.selectedAction),
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
assert.ok(
  createdItemCandidates.every(candidate => Number(candidate?.vector?.irreversibleCost || 0) === 0),
  `可再生产的造物被错误收取不可逆资产成本:${JSON.stringify(createdItemCandidates.map(candidate => ({
    id: candidate.candidateId,
    targetIds: candidate.declaration.targetIds,
    irreversibleCost: candidate.vector?.irreversibleCost,
  })))}`,
);
const formalItemUse = itemBeliefRun.decisions.find(entry =>
  entry?.actorId === '徐笠智' &&
  entry?.selected?.declaration?.actionKind === 'USE_ITEM' &&
  entry?.selected?.declaration?.targetIds?.includes('唐舞麟')
);
assert.ok(formalItemUse, `正式危机链没有消费已造恢复物:${JSON.stringify(itemBeliefRun.decisions.filter(entry => entry?.actorId === '徐笠智').map(entry => ({ round: entry.round, selected: entry.selected?.candidateId, actionKind: entry.selected?.declaration?.actionKind, targets: entry.selected?.declaration?.targetIds })))}`);

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

const controlCombat = combatData();
const forcedHardControl = {
  id: 'forced-hard-control',
  name: '固定僵直',
  魂技名: '固定僵直',
  消耗: { 魂力: 10 },
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 1, 成功率: 1 }],
};
controlCombat.参战者.team_player[0].技能列表 = [forcedHardControl];
const controlResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-control-cancels-queued-natural-action',
  seed: 63121,
  combatData: controlCombat,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actor_name: 'player-a',
    target_name: 'enemy-a',
    action_type: '释放魂技',
    type: 'skill',
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: forcedHardControl,
  },
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
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '迟缓', 持续回合: 2, 成功率: 0.65, 生效方式: '独立生效' }],
}];
const adaptationResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-decision-belief-integration', seed: 6321, combatData: adaptationInput, mode: 'team_preview', rounds: 3,
  settings: {},
});
assert.ok(adaptationResult.beliefObservations.length > 0, '正式正式决策结算没有生成认知观察');
assert.ok(!adaptationResult.beliefObservations.some(observation => observation?.observationType === 'PUBLIC_ACTION' && observation?.actionName === '自然恢复'), '自然恢复被错误用作公开战术学习样本');
const firstObservation = adaptationResult.beliefObservations.find(observation => String(observation?.mechanicKey || '').trim());
assert.ok(firstObservation, '正式结算没有生成机制成功率观察');
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
const resourceObservationInput = combatData();
const publicResourceDrain = {
  id: 'public-resource-drain',
  name: '公开资源剥夺',
  魂技名: '公开资源剥夺',
  消耗: { 魂力: 1 },
  _效果数组: [{
    原型: '资源变化',
    目标: '单体',
    资源: '体力',
    数值: '-50%',
    生效方式: '独立生效',
  }],
};
const resourceObservationResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r74-public-resource-observation',
  seed: 740632,
  combatData: resourceObservationInput,
  mode: 'team_preview',
  rounds: 2,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: publicResourceDrain,
  },
  settings: {},
});
const resourceObservation = resourceObservationResult.beliefObservations.find(entry =>
  entry?.observationType === 'PUBLIC_ACTION' &&
  entry?.actionName === '公开资源剥夺'
);
assert.ok(resourceObservation, '公开资源剥夺没有生成认知观察');
assert.ok(
  Number(resourceObservation.baseActionValue || 0) >= 50,
  `公开资源剥夺仍被学习为零威胁:${JSON.stringify(resourceObservation)}`,
);
const publicReactionObservation = adaptationResult.beliefObservations.find(entry => entry?.observationType === 'PUBLIC_REACTION');
assert.ok(publicReactionObservation, '正式即时反应没有生成公开认知观察');
const decisionAfterPublicReaction = adaptationResult.decisions.find(entry =>
  entry.actorId === publicReactionObservation.actorId && Number(entry.round || 0) > Number(publicReactionObservation.round || 0)
);
const observedReactionResponses = decisionAfterPublicReaction?.beliefState?.publicResponses?.[publicReactionObservation.sourceActorId];
assert.ok(
  Array.isArray(observedReactionResponses) &&
    observedReactionResponses.some(response =>
      response?.responseRole === 'REACTION' &&
      response?.declaration?.actionKind
    ),
  '公开即时反应没有进入观察者后续决策的结构化认知',
);

const reactionKnowledgeWorld = combatData();
const reactionKnowledgeActorId = 'player-a';
const reactionKnowledgeTargetId = 'enemy-a';
const reactionDecisionInput = {
  worldSnapshot: reactionKnowledgeWorld,
  actorId: reactionKnowledgeActorId,
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  battleIntent: { mode: '击败' },
  seed: 63215,
};
const unknownReactionDecision = inspectDecision(reactionDecisionInput, 'next');
const knownReactionBelief = sandbox.__LWCS_BATTLE_DECISION__.updatePublicObservation(
  sandbox.__LWCS_BATTLE_DECISION__.buildInitialBelief(reactionKnowledgeWorld, reactionKnowledgeActorId, {}),
  {
    sourceActorId: reactionKnowledgeTargetId,
    incomingSourceActorId: reactionKnowledgeActorId,
    sourceActionId: 'observed-defense',
    responseId: 'REACTION:DEFEND:防御',
    responseRole: 'REACTION',
    actionName: '防御',
    declaration: {
      actorId: reactionKnowledgeTargetId,
      actionKind: 'DEFEND',
      targetIds: [reactionKnowledgeTargetId],
    },
    damageMultiplier: 0.4,
    result: 'guarded',
  },
);
const knownReactionDecision = inspectDecision({
  ...reactionDecisionInput,
  beliefState: knownReactionBelief,
}, 'next');
const unknownReactionAttack = unknownReactionDecision.candidates.find(candidate =>
  candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
  candidate?.declaration?.targetIds?.includes(reactionKnowledgeTargetId)
);
const knownReactionAttack = knownReactionDecision.candidates.find(candidate =>
  candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
  candidate?.declaration?.targetIds?.includes(reactionKnowledgeTargetId)
);
const expectedPreviewDamage = candidate => Number(
  candidate?.preview?.contributions?.find(entry =>
    entry?.outcomeKind === 'HP_DELTA' &&
    entry?.targetId === reactionKnowledgeTargetId
  )?.evidence?.expectedDamage || 0
);
assert.ok(unknownReactionAttack && knownReactionAttack, '公开防御方向测试缺少同一普通攻击候选');
assert.ok(
  expectedPreviewDamage(knownReactionAttack) < expectedPreviewDamage(unknownReactionAttack),
  `已公开防御没有降低同一攻击的预估伤害:${expectedPreviewDamage(knownReactionAttack)}/${expectedPreviewDamage(unknownReactionAttack)}`,
);
assert.ok(
  knownReactionAttack.immediateReactionAudit?.some(entry =>
    entry.targetId === reactionKnowledgeTargetId &&
    entry.actionKind === 'DEFEND' &&
    Number(entry.damageMultiplier) === 0.4
  ),
  `已公开防御没有进入候选即时反应审计:${JSON.stringify(knownReactionAttack.immediateReactionAudit || [])}`,
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
const shadowSupportResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'r63-shadow-friendly-group-settlement',
  seed: 63311,
  combatData: structuredClone(supportInput),
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['player-a', 'player-b'],
    skill: structuredClone(supportInput.参战者.team_player[0].技能列表[0]),
  },
  settings: {},
});
const shadowSupportStart = shadowSupportResult.ledger.find(event =>
  event?.eventKind === 'action_start' && event?.actorName === 'player-a' && event?.actionName === '群体支援'
);
assert.ok(shadowSupportStart, '影子链友方群体支援没有进入正式结算');
const shadowSupportFacts = shadowSupportResult.ledger.filter(event =>
  String(event?.sourceActionId || event?.actionId || '') === String(shadowSupportStart.actionId || '') && event !== shadowSupportStart
);
assert.ok(shadowSupportFacts.some(event =>
  event?.eventKind === 'resource_change' &&
  event?.targetName === 'player-b' &&
  event?.meta?.resourceKey === 'hp' &&
  Number(event?.meta?.delta || 0) > 0
), `影子链友方群体治疗没有兑现到受伤队友:${JSON.stringify(shadowSupportFacts)}`);
assert.ok(!shadowSupportFacts.some(event => event?.targetName === 'enemy-a'), '影子链友方群体效果错误落到敌方');

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

const mixedTargetInput = combatData();
mixedTargetInput.参战者.team_player.push(participant('player-b', 'player', 120));
mixedTargetInput.参战者.team_enemy.push(participant('enemy-b', 'enemy', 120));
const mixedTargetSkill = {
  id: 'mixed-hostile-damage-allied-shield', name: '攻守分流', 魂技名: '攻守分流', 消耗: '无', 前摇: 1,
  _效果数组: [
    { 原型: '伤害结算', 目标: '群体', 威力倍率: 100, 伤害类型: '近身攻击', 生效方式: '独立生效' },
    { 原型: '护盾变化', 目标: '群体', 护盾模式: '正向护盾', 数值: '+20%', 持续回合: 1, 生效方式: '独立生效' },
  ],
};
mixedTargetInput.参战者.team_player[0].技能列表 = [structuredClone(mixedTargetSkill)];
const mixedTargetResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'mixed-effect-target-polarity', seed: 6334, combatData: mixedTargetInput, mode: 'team_preview', rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a', 'enemy-b'],
    skill: structuredClone(mixedTargetSkill),
  },
  settings: {},
});
const mixedTargetAction = mixedTargetResult.ledger.find(event =>
  event?.eventKind === 'action_start' && event?.actorName === 'player-a' && event?.actionName === '攻守分流'
);
const mixedTargetFacts = mixedTargetResult.ledger.filter(event =>
  mixedTargetAction && String(event?.sourceActionId || event?.actionId || '') === String(mixedTargetAction.actionId || '')
);
assert.deepEqual(
  [...new Set(mixedTargetFacts.filter(event => event?.eventKind === 'hit_result').map(event => event?.targetName))].sort(),
  ['enemy-a', 'enemy-b'],
  '混合技能的敌对伤害没有只落到敌方群体'
);
assert.deepEqual(
  [...new Set(mixedTargetFacts.filter(event => event?.eventKind === 'shield_create' && Number(event?.meta?.amount || 0) > 0).map(event => event?.targetName))].sort(),
  ['player-a', 'player-b'],
  '混合技能的正向护盾错误沿用了敌对声明目标'
);

const summonOrderInput = combatData();
const summonOrderSkill = {
  id: 'report-order-summon',
  name: '协同追击召唤',
  魂技名: '协同追击召唤',
  消耗: '无',
  前摇: 1,
  _效果数组: [{
    原型: '召唤生成',
    目标: '自身',
    持续回合: 1,
    召唤单位类型: '其他召唤生物',
    召唤物名称: '追击影',
    数量: 1,
    行动模式: '协同攻击',
    强度: 0.8,
  }],
};
summonOrderInput.参战者.team_player[0].技能列表 = [structuredClone(summonOrderSkill)];
const summonOrderResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'report-summary-after-summon', seed: 6334,
  combatData: summonOrderInput, mode: 'team_preview', rounds: 1,
  selectedAction: {
    actor_name: 'player-a',
    target_name: 'player-a',
    type: 'skill',
    action_type: '释放魂技',
    skill: structuredClone(summonOrderSkill),
  },
  settings: {},
});
assert.ok(summonOrderResult.reportBlocks.some(block => block?.blockType === 'SUMMON_ACTION'), '召唤顺序回归没有形成召唤动作块');
const roundOneBlocks = summonOrderResult.reportBlocks.filter(block => Number(block?.round || 0) === 1);
assert.equal(roundOneBlocks.at(-1)?.blockType, 'ROUND_SUMMARY', `回合汇总没有位于全部召唤动作之后:${JSON.stringify(roundOneBlocks.map(block => block?.blockType))}`);
assert.ok(
  summonOrderResult.ledger.some(event =>
    event?.eventKind === 'action_start' &&
    event?.actionRole === 'ASSIST' &&
    String(event?.actorName || '').startsWith('追击影')
  ),
  '主动动作生成的协同召唤没有消费首个真实行动窗口',
);

const oneSidedMultihitInput = combatData();
oneSidedMultihitInput.战斗意图 = '击败对手';
oneSidedMultihitInput.参战者.team_enemy[0].属性.HP = 120;
oneSidedMultihitInput.参战者.team_enemy[0].属性.HP上限 = 120;
const oneSidedMultihitSkill = {
  id: 'one-sided-multihit',
  name: '三段追击',
  魂技名: '三段追击',
  消耗: '无',
  _效果数组: [{
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 100,
    攻击段数: 3,
    伤害类型: '近身攻击',
    命中概率: 1,
  }],
};
oneSidedMultihitInput.参战者.team_player[0].技能列表 = [structuredClone(oneSidedMultihitSkill)];
const oneSidedMultihitResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'report-one-sided-multihit-total',
  seed: 63341,
  combatData: oneSidedMultihitInput,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actor_name: 'player-a',
    target_name: 'enemy-a',
    type: 'skill',
    action_type: '释放魂技',
    skill: structuredClone(oneSidedMultihitSkill),
  },
  settings: {},
});
const oneSidedDamageFacts = oneSidedMultihitResult.reportBlocks
  .find(block => block?.blockType === 'ROUND_SUMMARY' && Number(block?.round || 0) === 1)
  ?.facts?.filter(fact => fact?.factType === 'DAMAGE' && fact?.actorSide === 'player' && Number(fact?.value || 0) > 0) || [];
const oneSidedDamageTotal = oneSidedDamageFacts.reduce((sum, fact) => sum + Math.round(Number(fact?.value || 0)), 0);
const oneSidedRoundSummary = oneSidedMultihitResult.reportBlocks.find(block =>
  block?.blockType === 'ROUND_SUMMARY' && Number(block?.round || 0) === 1
);
assert.ok(oneSidedDamageFacts.length > 1, `单边多段回归没有形成多个伤害事实:${JSON.stringify(oneSidedMultihitResult.ledger)}`);
assert.match(
  String(oneSidedRoundSummary?.outcomeSummary || ''),
  new RegExp(`我方共造成 ${oneSidedDamageTotal} 点伤害`),
  `单边多段回合汇总没有显示本方总伤害:${JSON.stringify(oneSidedRoundSummary)}`,
);

const reactionSummonInput = combatData();
reactionSummonInput.参战者.team_player[0].属性.敏捷 = 100;
reactionSummonInput.参战者.team_player[0].agi = 100;
reactionSummonInput.参战者.team_enemy[0].属性.敏捷 = 220;
reactionSummonInput.参战者.team_enemy[0].agi = 220;
reactionSummonInput.参战者.team_enemy[0].属性.HP = 5;
reactionSummonInput.参战者.team_enemy[0].hp = 5;
const reactionSummonSkill = {
  id: 'reaction-summon',
  name: '应击协同召唤',
  魂技名: '应击协同召唤',
  消耗: '无',
  前摇: 1,
  _效果数组: [
    {
      原型: '护盾变化',
      目标: '自身',
      护盾模式: '正向护盾',
      数值: '+100%',
      持续回合: 1,
      生效方式: '独立生效',
    },
    {
      原型: '召唤生成',
      目标: '自身',
      持续回合: 1,
      召唤单位类型: '其他召唤生物',
      召唤物名称: '应击影',
      数量: 1,
      行动模式: '协同攻击',
      强度: 1,
      生效方式: '独立生效',
    },
  ],
};
const reactionIncomingSkill = {
  id: 'reaction-summon-incoming',
  name: '逼迫反应',
  魂技名: '逼迫反应',
  消耗: '无',
  前摇: 1,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 30, 伤害类型: '远程攻击' }],
};
reactionSummonInput.参战者.team_player[0].技能列表 = [structuredClone(reactionSummonSkill)];
reactionSummonInput.参战者.team_enemy[0].技能列表 = [structuredClone(reactionIncomingSkill)];
const reactionSummonResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'reaction-summon-first-window',
  seed: 63341,
  combatData: reactionSummonInput,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'enemy-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['player-a'],
    skill: structuredClone(reactionIncomingSkill),
  },
  settings: {},
});
const reactionSummonCreate = reactionSummonResult.ledger.find(event =>
  event?.eventKind === 'summon_create' && event?.meta?.summonName === '应击影'
);
assert.ok(
  reactionSummonCreate,
  `反应动作没有生成预期的协同召唤:${JSON.stringify(reactionSummonResult.ledger)}`,
);
assert.ok(
  reactionSummonResult.ledger.some(event =>
    event?.eventKind === 'action_start' &&
    event?.actionRole === 'ASSIST' &&
    event?.actorName === '应击影'
  ),
  `反应动作生成的协同召唤没有紧跟父动作消费首个窗口:${JSON.stringify(reactionSummonResult.ledger)}`,
);
assert.equal(reactionSummonResult.audit?.fatals?.length || 0, 0, `反应召唤生命周期审计失败:${JSON.stringify(reactionSummonResult.audit?.fatals || [])}`);

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
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['player-b'],
    skill: structuredClone(resourceSupportSkill),
  },
  settings: {},
});
const resourceSupportGain = resourceSupportResult.ledger.find(event => event?.eventKind === 'resource_change' && event?.actorName === 'player-a' && event?.targetName === 'player-b' && event?.actionName === '单体魂力支援' && event?.meta?.resourceKey === 'sp');
assert.ok(Number(resourceSupportGain?.meta?.delta || 0) > 0, '友方魂力支援没有形成资源变化事实');
const resourceSupportCosts = resourceSupportResult.ledger.filter(event =>
  event?.eventKind === 'resource_change' &&
  event?.actorName === 'player-a' &&
  event?.targetName === 'player-a' &&
  event?.actionName === '单体魂力支援' &&
  event?.meta?.resourceKey === 'sp' &&
  Number(event?.meta?.delta || 0) < 0
);
assert.equal(resourceSupportCosts.length, 1, `PLAYER_LOCKED技能没有且仅扣一次成本:${JSON.stringify(resourceSupportCosts)}`);
assert.equal(Number(resourceSupportCosts[0]?.meta?.delta || 0), -20, 'PLAYER_LOCKED技能成本与技能定义不一致');
assert.ok(!resourceSupportResult.ledger.some(event =>
  event?.eventKind === 'resource_change' &&
  event?.actorName === 'player-a' &&
  event?.targetName === 'player-a' &&
  event?.actionName === '单体魂力支援' &&
  event?.meta?.resourceKey === 'sp' &&
  Number(event?.meta?.delta || 0) > 0
), '单体资源变化被旧自回分支重复结算到施术者');
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
  settings: { decisionEngine: 'next-shadow' },
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
const counterSourceAction = counterResult.ledger.find(event =>
  event?.eventKind === 'action_start' &&
  event?.actionId === counterWindow?.sourceActionId
);
const counterActionStart = counterResult.ledger.find(event =>
  event?.eventKind === 'action_start' &&
  event?.actionRole === 'COUNTER' &&
  event?.sourceActionId === counterWindow?.sourceActionId &&
  event?.actorName === counterWindow?.actorName
);
const counterTraceFact = counterResult.trace.find(node =>
  Array.isArray(node?.ledgerEventIds) &&
  node.ledgerEventIds.includes(counterFact?.eventId)
);
const publicCounterObservation = counterResult.beliefObservations.find(observation =>
  observation?.observationType === 'PUBLIC_ACTION' &&
  observation?.actionRole === 'COUNTER'
);
assert.ok(counterWindow, '固定种子没有打开防反窗口');
assert.ok(counterDecision?.selected?.declaration, '防反机会没有进入新Decision或缺少评分审计');
const counterDecline = counterDecision?.scoreAudit?.find(candidate => candidate?.counterDeclineFallback === true);
assert.ok(['', 'DOMINATED'].includes(counterDecline?.rejectionCode), '放弃防反没有保留为合法零成本基线');
assert.equal(Number(counterDecline?.objectiveUtility || 0), 0, '放弃防反被错误附加后续回应风险');
assert.notEqual(counterDecision?.selected?.candidateId, counterDecline?.candidateId, '存在有效反击时仍选择放弃窗口');
assert.ok(counterFact && counterDamage, '固定种子没有形成成功防反及唯一正伤害事实');
assert.ok(counterSourceAction, '反击窗口无法追溯到原攻击声明');
assert.equal(counterSourceAction.actorName, counterWindow.targetName, '反击窗口目标不是原攻击者');
assert.notEqual(counterWindow.actorName, counterSourceAction.actorName, '反击窗口错误授予原攻击者自身');
assert.ok(counterActionStart, '反击窗口没有由窗口拥有者消费');
assert.equal(counterActionStart.targetName, counterSourceAction.actorName, '反击动作没有指向原攻击者');
assert.equal(counterFact.actorName, counterWindow.actorName, '反击结算主体不是窗口拥有者');
assert.equal(counterFact.targetName, counterSourceAction.actorName, '反击结算目标不是原攻击者');
assert.equal(counterFact.sourceActionId, counterSourceAction.actionId, '反击事实没有保留原攻击动作sourceActionId');
assert.equal(counterTraceFact?.actorName, counterFact.actorName, 'Trace反击主体与Ledger不一致');
assert.equal(counterTraceFact?.targetName, counterFact.targetName, 'Trace反击目标与Ledger不一致');
assert.ok(counterFact.actorSide && counterFact.targetSide && counterFact.actorSide !== counterFact.targetSide, '防反事实丢失敌对阵营关系');
assert.ok(failedCounterFacts.every(event => event.actorSide && event.targetSide && event.actorSide !== event.targetSide), `失败防反客观阵营错误:${JSON.stringify(failedCounterFacts)}`);
assert.ok(counterReactionFacts.length > 0, '固定种子没有覆盖防反后二次反应事实');
assert.ok(counterReactionFacts.every(event => event.actorSide && event.targetSide && event.actorSide !== event.targetSide), `防反后二次反应客观阵营错误:${JSON.stringify(counterReactionFacts)}`);
assert.ok(publicCounterObservation, '公开反击没有以COUNTER职责进入认知观察');
const counterObserverDecision = counterResult.decisions.find(entry =>
  entry?.actorId === publicCounterObservation.actorId &&
  Number(entry?.round || 0) > Number(publicCounterObservation.round || 0)
);
const learnedCounterResponses = counterObserverDecision?.beliefState?.publicResponses?.[publicCounterObservation.sourceActorId] || [];
assert.ok(
  learnedCounterResponses.some(response =>
    response?.actionName === publicCounterObservation.actionName &&
    (
      response?.responseRole === 'COUNTER' ||
      response?.responseRoles?.includes('COUNTER')
    )
  ),
  '公开反击没有保留COUNTER职责供后续候选风险学习',
);
assert.doesNotMatch(counterResult.logs.join('\n'), /技能分类预览|主观置信度锁定|行为经验|自动行为链再判定/, '防反链仍执行旧评分器');
assert.equal(counterResult.audit?.fatals?.length || 0, 0, `成功防反事实审计失败:${JSON.stringify(counterResult.audit?.fatals || [])}`);

const teamCounterDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'team_counter_coordination');
assert.ok(teamCounterDefinition, '团战防反归属人工案例缺失');
const teamCounterResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: teamCounterDefinition.caseId,
  seed: teamCounterDefinition.seed,
  combatData: teamCounterDefinition.combatData,
  mode: 'team_preview',
  rounds: teamCounterDefinition.rounds,
  initialBelief: teamCounterDefinition.initialBelief,
  battleIntent: { mode: teamCounterDefinition.intent },
  settings: { decisionEngine: 'next-shadow' },
});
const teamCounterFacts = teamCounterResult.ledger.filter(event => event?.eventKind === 'counter');
assert.ok(
  teamCounterFacts.length > 0,
  `团战防反案例没有形成反击事实:${JSON.stringify(teamCounterResult.ledger.filter(event =>
    ['counter_window', 'counter'].includes(String(event?.eventKind || ''))
  ))}`,
);
assert.ok(teamCounterFacts.every(event =>
  event.actorName &&
  event.targetName &&
  event.targetName !== '未知单位' &&
  event.actorSide &&
  event.targetSide &&
  event.actorSide !== event.targetSide
), `团战反击事实丢失敌对来源:${JSON.stringify(teamCounterFacts)}`);

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
const chargeProgress = defenseResult.ledger.find(event =>
  event?.eventKind === 'charge_progress' &&
  event?.actorName === '舞长空' &&
  Number(event?.round || 0) === 1 &&
  Number(event?.meta?.remainingCastTime || 0) > 0
);
assert.ok(chargeProgress, '影子队列没有推进初始蓄力或缺少剩余前摇事实');
assert.ok(['DEFEND', 'EVADE'].includes(defenseActions.find(entry => Number(entry?.round || 0) === 1)?.selected?.declaration?.actionKind), `致命蓄力进入下一回应窗口后仍未建立准备姿态:${JSON.stringify(defenseActions.map(entry => ({ round: entry.round, actionKind: entry.selected?.declaration?.actionKind, candidateId: entry.selected?.candidateId })))}`);
const preparedDefense = defenseResult.ledger.find(event =>
  ['defend', 'dodge'].includes(String(event?.eventKind || '')) &&
  event?.actorName === '韦小枫' &&
  event?.meta?.preparedDefense === true
);
assert.ok(preparedDefense, '主动防御没有形成可供下一次来袭消费的准备姿态');
assert.equal(
  String(preparedDefense?.reactionNodeId || preparedDefense?.meta?.reactionWindowNodeId || ''),
  '',
  '主动防御错误生成针对自身声明的反应窗口'
);
const preparedDefenseConsumed = defenseResult.ledger.find(event =>
  ['defend', 'dodge'].includes(String(event?.eventKind || '')) &&
  event?.actorName === '韦小枫' &&
  event?.meta?.preparedDefenseConsumed === true
);
assert.ok(preparedDefenseConsumed, '下一次蓄力攻击没有消费已建立的准备姿态');
const resolvedChargeBlocks = defenseResult.reportBlocks.filter(block =>
  block?.blockType !== 'ROUND_SUMMARY' &&
  (block?.facts || []).some(fact => fact?.actionName === '已显露蓄力重击')
);
assert.ok(resolvedChargeBlocks.length > 0, '蓄力时序案例没有形成已显露蓄力重击战报块');
assert.ok(resolvedChargeBlocks.every(block => !/规避迫近攻击|等待更好的反击窗口/.test(String(block?.intentSummary || ''))), '蓄力结算错误借用了同角色的闪避决策意图');
const preImpactAttackBlock = defenseResult.reportBlocks.find(block => Number(block?.round || 0) === 1 &&
  (block?.facts || []).some(fact => ['defend', 'dodge'].includes(String(fact?.eventKind || '')) && fact?.actorName === '韦小枫')
);
assert.match(String(preImpactAttackBlock?.intentSummary || ''), /迫近攻击|蓄力风险|失能风险/, '面对已显露蓄力建立防守时缺少生存目的解释');
const oneHpStillActive = defenseResult.ledger.some((event, index, ledger) => {
  if (event?.eventKind !== 'hit_result' || event?.targetName !== '韦小枫') return false;
  const damage = Number(event?.appliedDamage || event?.meta?.appliedDamage || 0);
  if (!(damage > 0)) return false;
  return ledger.slice(index + 1).some(later =>
    later?.eventKind === 'action_start' &&
    later?.actorName === '韦小枫' &&
    Number(later?.round || 0) > Number(event?.round || 0)
  ) && defenseResult.finalSnapshot?.team_player?.some(unit =>
    unit?.name === '韦小枫' &&
    Number(unit?.hp || 0) <= 1 &&
    !/失去战斗力|昏迷/.test(String(unit?.actionState || ''))
  );
});
assert.equal(oneHpStillActive, false, '非致死生命下限把1HP单位继续保留为可行动者并制造坚持回合伪胜利');
assert.equal(defenseResult.audit?.fatals?.length || 0, 0, `蓄力防守时序事实审计失败:${JSON.stringify(defenseResult.audit?.fatals || [])}`);

const underdogDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'duel_underdog_survival');
assert.ok(underdogDefinition, '弱者坚持回合人工案例缺失');
const underdogResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: underdogDefinition.caseId,
  seed: underdogDefinition.seed,
  combatData: underdogDefinition.combatData,
  mode: 'team_preview',
  rounds: underdogDefinition.rounds,
  initialBelief: underdogDefinition.initialBelief,
  battleIntent: { mode: underdogDefinition.intent },
  settings: { decisionEngine: 'next-shadow' },
});
const underdogFirstAction = underdogResult.decisions.find(entry =>
  entry?.actorId === '韦小枫' && entry?.actionRole === 'ACTIVE'
);
assert.equal(underdogFirstAction?.selected?.declaration?.actionKind, 'DEFEND', `明确坚持回合目标仍被求生语境误导为无效撤退或进攻:${JSON.stringify(underdogFirstAction?.scoreAudit || [])}`);
assert.ok(!underdogFirstAction?.scoreAudit?.some(candidate => candidate?.actionKind === 'WITHDRAW'), '明确坚持回合目标仍生成不计入胜利的撤退候选');
assert.ok(underdogResult.ledger.some(event =>
  event?.eventKind === 'defend' &&
  event?.actorName === '韦小枫' &&
  event?.meta?.preparedDefenseConsumed === true
), '弱者建立的准备防御没有被下一次已显露蓄力消费');

const protectDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'team_protect_critical_ally');
assert.ok(protectDefinition, '危急保核人工案例缺失');
const protectManualResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: protectDefinition.caseId,
  seed: protectDefinition.seed,
  combatData: protectDefinition.combatData,
  mode: 'team_preview',
  rounds: protectDefinition.rounds,
  initialBelief: protectDefinition.initialBelief,
  battleIntent: { mode: protectDefinition.intent },
  settings: {},
});
const healerDecision = protectManualResult.decisions.find(entry => entry?.actorId === '雅莉' && entry?.actionRole === 'ACTIVE');
assert.equal(healerDecision?.selected?.declaration?.actionKind, 'RELEASE_SKILL', `危急保核时治疗者仍选择普通攻击:${JSON.stringify(healerDecision?.scoreAudit || [])}`);
const healerActionId = protectManualResult.ledger.find(event =>
  event?.eventKind === 'action_start' && event?.actorName === '雅莉'
)?.actionId;
const healerFacts = protectManualResult.ledger.filter(event =>
  healerActionId && String(event?.sourceActionId || event?.actionId || '') === String(healerActionId)
);
assert.ok(healerFacts.some(event =>
  event?.eventKind === 'resource_change' &&
  event?.targetName === '舞长空' &&
  event?.meta?.resourceKey === 'hp' &&
  Number(event?.meta?.delta || 0) > 0
), '保核治疗选择没有在正式结算中恢复指定危急单位');
assert.ok(!healerFacts.some(event => event?.actorName === '雅莉' && event?.targetSide === 'enemy' && ['resource_change', 'state_apply', 'shield_create'].includes(event?.eventKind)), '友方群体保核效果错误资助敌方');
const protectResolution = protectManualResult.ledger.find(event => event?.eventKind === 'battle_objective_resolved');
assert.equal(protectResolution?.result, 'player', '保核样本没有形成唯一的我方胜利终态');
assert.equal(protectManualResult.finalBattleReport?.objectiveWinner, 'player', '保核样本没有让危急目标撑到目标回合');
assert.equal(protectManualResult.roundsExecuted, 4, '保核样本没有完整覆盖四回合保护链');
assert.ok(protectManualResult.ledger.some(event =>
  event?.eventKind === 'shield_break' &&
  event?.targetName === '舞长空' &&
  String(event?.meta?.source || '').trim() === 'structured_runtime' &&
  Number(event?.meta?.amount || 0) > 0
), '保核样本没有形成护盾实际吸收伤害的事实');
assert.ok(
  [...(protectManualResult.finalSnapshot?.team_player || []), ...(protectManualResult.finalSnapshot?.team_enemy || [])]
    .every(unit => (unit?.状态效果 || []).every(state => !String(state?.name || '').startsWith('preview:'))),
  '正式终态仍泄漏预估状态标识'
);

const withdrawalDefinition = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__)
  .find(item => item.caseId === 'duel_agile_single_target_failure');
const withdrawalResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: withdrawalDefinition.caseId,
  seed: withdrawalDefinition.seed,
  combatData: withdrawalDefinition.combatData,
  mode: 'team_preview',
  rounds: withdrawalDefinition.rounds,
  battleIntent: { mode: withdrawalDefinition.intent },
  settings: { decisionEngine: 'next-shadow' },
});
const firstWithdrawalActive = withdrawalResult.decisions.find(entry =>
  entry?.actorId === '谢邂' && entry?.actionRole === 'ACTIVE'
);
assert.equal(
  firstWithdrawalActive?.selected?.declaration?.actionKind,
  'WITHDRAW',
  `求生且唯一成功条件为撤离时，Next没有在首个自然机会尝试撤离:${JSON.stringify(firstWithdrawalActive || {})}`,
);
const withdrawalFacts = withdrawalResult.ledger.filter(event =>
  event?.actionType === 'WITHDRAW' && ['withdrawn', 'failed'].includes(String(event?.result || ''))
);
assert.ok(withdrawalFacts.length > 0, '撤离只进入评分，没有在正式结算中形成概率事实');
assert.ok(withdrawalFacts.every(event => Number(event?.meta?.successProbability) >= 0 && Number(event?.meta?.successProbability) <= 1), '撤离结算缺少与预估同源的成功概率');
withdrawalFacts.forEach(event => {
  const block = withdrawalResult.reportBlocks.find(item =>
    item?.blockType !== 'ROUND_SUMMARY' &&
    (item?.facts || []).some(fact => String(fact?.factId || fact?.sourceEventId || fact?.eventId || '').trim() === String(event?.eventId || '').trim())
  );
  assert.ok(block, `撤离终态没有进入动作组战报:${event?.eventId || ''}`);
  assert.match(
    String(block?.outcomeSummary || ''),
    event?.result === 'withdrawn' ? /成功撤离/ : /尝试撤离.*未能成功/,
    `撤离终态玩家文案与结构化结果不一致:${JSON.stringify(block)}`,
  );
});
const withdrawalDecisions = withdrawalResult.decisions.filter(entry => entry?.selected?.declaration?.actionKind === 'WITHDRAW');
assert.ok(withdrawalDecisions[0]?.selected?.mechanicObservations?.some(observation => observation?.effectPrototype === '撤离判定'), '撤离候选没有建立可学习的机制观察');
if (withdrawalDecisions.length > 1 && withdrawalFacts[0]?.result === 'failed') {
  const firstPosterior = withdrawalDecisions[0].selected.mechanicObservations.find(observation => observation?.effectPrototype === '撤离判定')?.posterior;
  const secondPosterior = withdrawalDecisions[1].selected.mechanicObservations.find(observation => observation?.effectPrototype === '撤离判定')?.posterior;
  assert.ok(Number(secondPosterior) < Number(firstPosterior), '首次撤离失败没有降低下一次撤离把握');
}

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
  settings: { decisionEngine: 'next-shadow' },
});
const capturePlayerActions = captureResult.decisions.filter(entry =>
  entry?.actorId === '舞长空' &&
  (entry?.actionRole || 'ACTIVE') === 'ACTIVE'
);
const wastedDefense = capturePlayerActions.filter(entry =>
  ['DEFEND', 'EVADE'].includes(entry?.selected?.declaration?.actionKind)
);
assert.equal(wastedDefense.length, 0, `敌方下一行动已取消仍浪费机会防御:${JSON.stringify(wastedDefense.map(entry => ({ round: entry.round, actorId: entry.actorId, selected: entry.selected?.candidateId })))}`);
assert.ok(capturePlayerActions.every(entry => Math.abs(Number(entry?.selected?.vector?.objectiveProgress || 0)) <= 1e-9), `生命阈值伤害仍被容量与目标进度重复计值:${JSON.stringify(capturePlayerActions.map(entry => ({ round: entry.round, selected: entry.selected?.candidateId, objectiveProgress: entry.selected?.vector?.objectiveProgress })))}`);
assert.ok(capturePlayerActions.every(entry =>
  Number(entry?.selected?.vector?.expectedStateGain || 0) > 0 ||
  Number(entry?.selected?.vector?.terminalUtility || 0) > 0
), `生命阈值没有通过唯一容量差量或终态持续推进:${JSON.stringify(capturePlayerActions.map(entry => ({ round: entry.round, selected: entry.selected?.candidateId, expectedStateGain: entry.selected?.vector?.expectedStateGain, terminalUtility: entry.selected?.vector?.terminalUtility })))}`);
assert.equal(captureResult.finalBattleReport?.objectiveWinner, 'player', `显式生命阈值没有在回合上限内驱动有效收束:${captureResult.finalBattleReport?.text || ''}`);
assert.ok(captureResult.roundsExecuted <= captureDefinition.rounds, '生命阈值目标在回合上限后才成立');
const captureTarget = captureResult.finalSnapshot?.team_enemy?.find(unit => unit?.name === '韦小枫');
const captureHpFloor = Math.floor(Number(captureTarget?.hp_max || 0) * 0.3);
assert.equal(Number(captureTarget?.hp || 0), captureHpFloor, '点到为止没有在显式生命阈值处停止伤害');
assert.notEqual(String(captureTarget?.actionState || ''), '昏迷', '目标已在30%生命阈值收束却仍被追加昏迷');

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
  settings: { decisionEngine: 'next-shadow' },
});
const controlledReactionFallbacks = controlOverlapResult.decisions.filter(entry =>
  entry?.actionRole === 'REACTION' && entry?.selected?.forcedFallback === true
);
assert.equal(controlledReactionFallbacks.length, 0, `无法反应的受控单位仍被强塞防御兜底:${JSON.stringify(controlledReactionFallbacks.map(entry => ({ round: entry.round, actorId: entry.actorId, selected: entry.selected?.candidateId })))}`);
const hardControlStateNames = new Set(['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞']);
const playerControlActorIds = new Set(controlOverlapDefinition.combatData.参战者.team_player.map(unit => unit.id || unit.name || unit.名称));
const enemyControlTargetIds = new Set(controlOverlapDefinition.combatData.参战者.team_enemy.map(unit => unit.id || unit.name || unit.名称));
const playerHardControlFacts = controlOverlapResult.ledger.filter(event =>
  event?.eventKind === 'state_apply' &&
  event?.result === 'applied' &&
  playerControlActorIds.has(event?.actorId) &&
  enemyControlTargetIds.has(event?.targetId) &&
  hardControlStateNames.has(String(event?.meta?.stateName || '').trim())
);
assert.ok(playerHardControlFacts.length > 0, `控制重叠案例没有成功施加硬控:${JSON.stringify(playerHardControlFacts)}`);
const hardControlFactsByRound = Map.groupBy(playerHardControlFacts, event => Number(event?.round || 0));
const blockedControlFactsByRound = Map.groupBy(controlOverlapResult.ledger.filter(event =>
  event?.eventKind === 'blocked_action' &&
  event?.result === 'cancelled' &&
  String(event?.meta?.reasonCode || '').trim() === 'CONTROLLED_BEFORE_OPPORTUNITY'
), event => Number(event?.round || 0));
const alliedWindowControl = controlOverlapResult.decisions.find(entry =>
  playerControlActorIds.has(entry?.actorId) &&
  Object.values(entry?.selected?.repeatedActionAudit?.controlWindowRealizability?.reasonsByTarget || {})
    .flat()
    .some(reason => String(reason || '').startsWith('ALLY_WINDOW:'))
);
assert.ok(alliedWindowControl, `队伍控制没有记录真实后续兑现者:${JSON.stringify(controlOverlapResult.decisions.map(entry => ({
  round: entry.round,
  actorId: entry.actorId,
  selected: entry?.selected?.candidateId,
  controlWindow: entry?.selected?.repeatedActionAudit?.controlWindowRealizability,
})))}`);
hardControlFactsByRound.forEach((facts, round) => {
  const controlledTargetIds = new Set();
  const blockedIds = new Set((blockedControlFactsByRound.get(round) || []).map(event => event.actorId));
  facts.forEach(event => {
    assert.ok(blockedIds.has(event.targetId), `硬控已施加但没有兑现行动取消:${JSON.stringify({ round, actorId: event.actorId, targetId: event.targetId })}`);
    assert.ok(
      !controlledTargetIds.has(event.targetId) || controlledTargetIds.size >= enemyControlTargetIds.size,
      `仍有未控制敌人时重复覆盖同一硬控目标:${JSON.stringify({ round, actorId: event.actorId, targetId: event.targetId, controlledTargetIds: [...controlledTargetIds], enemyControlTargetIds: [...enemyControlTargetIds] })}`
    );
    controlledTargetIds.add(event.targetId);
  });
});
assert.ok([...blockedControlFactsByRound.values()].flat().length > 0, '受控单位失去行动机会后缺少结构化取消事实');

const daytimeControlData = structuredClone(controlOverlapDefinition.combatData);
daytimeControlData.时间段 = '白天';
daytimeControlData.参战者.team_player = daytimeControlData.参战者.team_player.filter(unit => (unit.id || unit.name || unit.名称) === '许小言');
daytimeControlData.参战者.team_enemy = daytimeControlData.参战者.team_enemy.filter(unit => (unit.id || unit.name || unit.名称) === '龙跃');
const daytimeControlDecision = inspectDecision({
  worldSnapshot: daytimeControlData,
  actorId: '许小言',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: true },
  battleIntent: { mode: controlOverlapDefinition.intent },
  beliefState: controlOverlapDefinition.initialBelief,
  seed: controlOverlapDefinition.seed,
}, 'next');
const conditionalControlCandidates = daytimeControlDecision.candidates.filter(candidate =>
  candidate?.declaration?.actionKind === 'RELEASE_SKILL' &&
  sandbox.__LWCS_BATTLE_PREVIEW__.collectEffects(candidate?.skill || candidate?.declaration?.skill || {})
    .some(effect => String(effect?.状态 || '').trim() === '僵直')
);
assert.ok(conditionalControlCandidates.length > 0, '白天负例没有保留带夜间硬控分支的机械候选');
conditionalControlCandidates.forEach(candidate => {
  assert.equal(
    candidate?.preview?.contributions?.some(entry =>
      entry?.outcomeKind === 'ACTION_CANCELLED' || String(entry?.evidence?.state || '').trim() === '僵直'
    ),
    false,
    `白天不可用的僵直进入Preview或评分:${candidate.candidateId}`
  );
  assert.equal(
    candidate?.repeatedActionAudit?.newlyDeniedOpportunityIds?.length || 0,
    0,
    `白天不可用的僵直产生了评分用行动取消:${candidate.candidateId}`
  );
});
const daytimeControlResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'team_control_overlap_daytime_negative',
  seed: controlOverlapDefinition.seed,
  combatData: daytimeControlData,
  mode: 'team_preview',
  rounds: 1,
  initialBelief: controlOverlapDefinition.initialBelief,
  battleIntent: { mode: controlOverlapDefinition.intent },
  settings: { decisionEngine: 'next-shadow' },
});
assert.equal(daytimeControlResult.ledger.some(event =>
  event?.actorId === '许小言' &&
  event?.eventKind === 'state_apply' &&
  String(event?.meta?.stateName || '').trim() === '僵直'
), false, '白天不可用的僵直进入正式结算或Ledger');
assert.equal(daytimeControlResult.ledger.some(event =>
  event?.eventKind === 'blocked_action' &&
  String(event?.meta?.reasonCode || '').trim() === 'CONTROLLED_BEFORE_OPPORTUNITY' &&
  String(event?.meta?.stateName || '').trim() === '僵直'
), false, '白天不可用的僵直取消了敌方行动机会');

const hpThresholdInput = combatData();
hpThresholdInput.战斗意图 = '压制测试';
hpThresholdInput.参战者.team_player[0].属性.敏捷 = 1000;
hpThresholdInput.参战者.team_enemy[0].属性.敏捷 = 1;
hpThresholdInput.参战者.team_enemy[0].状态效果.阈值测试无法反应 = {
  状态: '无法反应',
  duration: 1,
  战斗效果: { cannot_react: true },
};
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
}, 'next');
const ordinaryProtectionInput = structuredClone(protectedInput);
delete ordinaryProtectionInput.胜负条件;
const ordinaryDecision = inspectDecision({
  worldSnapshot: ordinaryProtectionInput, actorId: 'player-a', actionOpportunity: { role: 'ACTIVE', sequence: 1 }, beliefState: {}, seed: 'protected-objective',
}, 'next');
const bestDefenseUtility = decision => Math.max(...decision.candidates.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate?.declaration?.actionKind)).map(candidate => Number(candidate.objectiveUtility || 0)));
assert.ok(bestDefenseUtility(protectedDecision) > bestDefenseUtility(ordinaryDecision), '无伤失败条件没有提高可兑现防守动作的终态保护价值');
const protectedResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'battle-objective-protected-unit-damaged', seed: 6403, combatData: protectedInput, mode: 'team_preview', rounds: 3, settings: {},
});
const protectedResolution = protectedResult.ledger.find(event => event?.eventKind === 'battle_objective_resolved');
const protectedDamage = protectedResult.ledger.find(event =>
  event?.eventKind === 'hit_result' &&
  event?.targetName === 'player-a' &&
  Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0
);
if (protectedDamage) {
  assert.equal(protectedResult.roundsExecuted, Number(protectedResolution?.round || 0), '指定单位受伤后仍继续执行后续回合');
  assert.equal(protectedResult.finalBattleReport?.objectiveWinner, 'enemy', '指定单位受伤没有触发我方失败终态');
  assert.ok(protectedResult.ledger.some(event => event?.eventKind === 'battle_objective_resolved' && event?.result === 'enemy'), '受伤失败条件缺少唯一目标终态事实');
} else {
  assert.notEqual(protectedResult.finalBattleReport?.objectiveWinner, 'enemy', '指定单位未受伤却凭空触发失败终态');
}
const damagedProtectedSnapshot = structuredClone(protectedInput);
damagedProtectedSnapshot.参战者.team_player[0].hp = 499;
damagedProtectedSnapshot.参战者.team_player[0].属性.HP = 499;
const damagedProtectedObjectives = sandbox.__LWCS_BATTLE_PREVIEW__.normalizeBattleObjectives(
  damagedProtectedSnapshot.胜负条件,
  damagedProtectedSnapshot,
);
const damagedProtectedResolution = sandbox.__LWCS_BATTLE_PREVIEW__.evaluateBattleObjectives(
  damagedProtectedSnapshot,
  damagedProtectedObjectives,
  { roundCompleted: false },
);
assert.equal(damagedProtectedResolution.winner, 'enemy', '指定单位受伤条件没有在共享终局真源中触发我方失败');
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
const expiryCombat = combatData();
expiryCombat.回合 = 2;
const expiryLedger = [];
sandbox.__LWCS_BATTLE_RUNTIME__.attachLedger(expiryCombat, expiryLedger);
const expiryUnit = expiryCombat.参战者.team_player[0];
expiryUnit.状态效果.到期护盾 = { 状态: '到期护盾', duration: 0, shield_value: 80, 战斗效果: {} };
sandbox.__LWCS_BATTLE_RUNTIME__.settleExpiredConditionBase(
  expiryUnit,
  '到期护盾',
  expiryUnit.状态效果.到期护盾,
  'player-a',
  expiryCombat,
);
const expiryReport = sandbox.__LWCS_BATTLE_RUNTIME__.buildReportBlocks(expiryLedger, [], []);
assert.ok(
  expiryReport.some(block => /护盾持续时间结束.*80 点护盾消散/.test(String(block?.outcomeSummary || ''))),
  `护盾到期仍被叙述成承受伤害:${JSON.stringify(expiryReport)}`,
);
assert.ok(
  !expiryReport.some(block => /吸收.*80 点伤害/.test(String(block?.outcomeSummary || ''))),
  '护盾自然到期被伪造为伤害吸收',
);
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

const followedEffectCombat = combatData();
followedEffectCombat.回合 = 1;
const followedEffectTarget = followedEffectCombat.参战者.team_enemy[0];
const followedEffectResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: followedEffectCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '主效果落空测试', _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 0, 生效方式: '独立生效' },
      { 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 1, 成功率: 1, 生效方式: '跟随主原型' },
    ] },
  },
});
assert.equal(followedEffectResult.facts.find(event => event?.eventKind === 'hit_result')?.result, 'miss', '跟随效果反例没有让主效果落空');
assert.equal(followedEffectTarget.状态效果?.僵直, undefined, '主效果未命中时仍施加跟随控制');
assert.equal(followedEffectResult.facts.some(event => event?.eventKind === 'state_apply' && event?.meta?.stateName === '僵直'), false, '主效果未命中时仍生成跟随控制事实');

const followedPreview = sandbox.__LWCS_BATTLE_PREVIEW__.previewAction({
  worldSnapshot: followedEffectCombat,
  actorId: 'player-a',
  declaration: {
    actionId: 'followed-preview-zero-hit',
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '主效果落空预估', _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 0, 生效方式: '独立生效' },
      { 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 1, 成功率: 1, 生效方式: '跟随主原型' },
    ] },
  },
  previewBudget: { maxNodes: 12 },
});
const followedPreviewTarget = sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(followedPreview.afterSnapshot, 'enemy-a');
assert.equal(followedPreviewTarget?.状态效果 &&
  Object.values(followedPreviewTarget.状态效果)
    .some(state => state?.状态 === '僵直' && Number(state?.__previewApplicationProbability || 0) > 0), false,
'纯预估仍把0%主效果后的跟随控制计为可生效');

const followedSuccessCombat = combatData();
followedSuccessCombat.回合 = 1;
const followedSuccessResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: followedSuccessCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '主效果命中测试', _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 1, 生效方式: '独立生效' },
      { 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 1, 成功率: 1, 生效方式: '跟随主原型' },
    ] },
  },
});
assert.equal(followedSuccessResult.facts.some(event => event?.eventKind === 'state_apply' && event?.meta?.stateName === '僵直' && event?.result === 'applied'), true,
  '主效果命中后没有结算跟随控制');

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

const partialShieldCombat = combatData();
partialShieldCombat.回合 = 1;
partialShieldCombat.战斗意图 = '击败对手';
const partialShieldTarget = partialShieldCombat.参战者.team_enemy[0];
partialShieldTarget.状态效果.测试护盾 = { 类型: 'buff', duration: 2, shield_value: 10, 战斗效果: {} };
const partialShieldHpBefore = partialShieldTarget.属性.HP;
const partialShieldResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: partialShieldCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '护盾穿透测试', _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 1 },
    ] },
  },
});
const partialShieldHit = partialShieldResult.facts.find(event => event?.eventKind === 'hit_result');
assert.equal(Number(partialShieldHit?.meta?.shieldAbsorb || 0), 10, '部分护盾没有先于生命吸收伤害');
assert.equal(Number(partialShieldHit?.meta?.appliedDamage || 0), partialShieldHpBefore - partialShieldTarget.属性.HP, '护盾后的实际生命伤害与终值不守恒');
assert.equal(partialShieldTarget.状态效果.测试护盾, undefined, '耗尽护盾没有移除');
assert.equal(
  partialShieldResult.facts.filter(event => event?.eventKind === 'shield_break').reduce((sum, event) => sum + Number(event?.meta?.amount || 0), 0),
  10,
  '护盾吸收没有形成唯一护盾变化事实',
);

const fullShieldCombat = combatData();
fullShieldCombat.回合 = 1;
fullShieldCombat.战斗意图 = '击败对手';
const fullShieldTarget = fullShieldCombat.参战者.team_enemy[0];
fullShieldTarget.状态效果.测试护盾 = { 类型: 'buff', duration: 2, shield_value: 10000, 战斗效果: {} };
const fullShieldHpBefore = fullShieldTarget.属性.HP;
const fullShieldResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: fullShieldCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '全额护盾测试', _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 1 },
    ] },
  },
});
const fullShieldHit = fullShieldResult.facts.find(event => event?.eventKind === 'hit_result');
assert.equal(fullShieldTarget.属性.HP, fullShieldHpBefore, '全额护盾仍让生命值下降');
assert.ok(Number(fullShieldHit?.meta?.shieldAbsorb || 0) > 0, '全额护盾没有记录吸收量');
assert.equal(Number(fullShieldHit?.meta?.appliedDamage || 0), 0, '全额护盾仍记录生命伤害');

const shieldPreviewCombat = combatData();
shieldPreviewCombat.战斗意图 = '击败对手';
shieldPreviewCombat.参战者.team_enemy[0].状态效果.测试护盾 = { 类型: 'buff', duration: 2, shield_value: 10000, 战斗效果: {} };
const shieldPreview = sandbox.__LWCS_BATTLE_PREVIEW__.previewAction({
  worldSnapshot: shieldPreviewCombat,
  actorId: 'player-a',
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: { name: '预估护盾测试', _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 1 },
    ] },
  },
  previewBudget: { maxNodes: 12 },
});
assert.equal(
  sandbox.__LWCS_BATTLE_PREVIEW__.readHp(sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(shieldPreview.afterSnapshot, 'enemy-a')),
  shieldPreviewCombat.参战者.team_enemy[0].属性.HP,
  '纯预估没有采用与正式结算一致的护盾吸收语义',
);

const structuredEquipCombat = combatData();
structuredEquipCombat.回合 = 1;
const structuredEquipActor = structuredEquipCombat.参战者.team_player[0];
const agilityBeforeEquip = Number(structuredEquipActor.agi || structuredEquipActor.属性?.敏捷 || 0);
structuredEquipActor.final = { agi: agilityBeforeEquip };
const structuredEquipResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredEquipCombat,
  declaration: {
    actorId: 'player-a',
    actionKind: 'EQUIP',
    targetIds: ['player-a'],
    equipmentSignature: 'raw-equipment-modifier',
    skill: { id: 'raw-agility-dagger', name: '原始敏捷匕首', 类型: '装备', 装备属性: { 敏捷: '+20%' } },
  },
});
assert.ok(Number(structuredEquipActor.agi || structuredEquipActor.属性?.敏捷 || 0) > agilityBeforeEquip, '原始装备声明没有应用装备属性');
assert.ok(
  Number(sandbox.__LWCS_BATTLE_PREVIEW__.readCombatStat(structuredEquipActor, 'agi')) > agilityBeforeEquip,
  '装备只修改了显示属性，正式战斗属性仍被旧final快照覆盖',
);
assert.ok(structuredEquipResult.facts.some(event =>
  event?.eventKind === 'effect_resolved' &&
  event?.effectPrototype === '属性修正' &&
  String(event?.meta?.effectDetail?.attribute || '').includes('敏捷')
), '装备属性变化没有写入结构化事实');
assert.ok(structuredEquipResult.facts.some(event => event?.eventKind === 'complete' && event?.primaryOutcome === 'equipment_changed'), '装备完成终态缺失');
const structuredEquipSnapshot = sandbox.__LWCS_BATTLE_RUNTIME__.getBattleSnapshot(structuredEquipCombat);
assert.ok(
  !(structuredEquipSnapshot.team_player?.[0]?.states || []).some(state => /preview:|特殊效果/.test(String(state?.name || ''))),
  `装备内部修正状态泄漏到玩家快照:${JSON.stringify(structuredEquipSnapshot.team_player?.[0]?.states || [])}`,
);

const structuredDotCombat = combatData();
structuredDotCombat.回合 = 1;
const structuredDotTarget = structuredDotCombat.参战者.team_enemy[0];
const structuredDotResult = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredDotCombat,
  declaration: {
    actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'],
    skill: {
      name: '结构化中毒',
      _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '中毒', 数值: '-5%', 持续回合: 1, 成功率: 1 }],
    },
  },
});
const structuredPoison = structuredDotTarget.状态效果.中毒;
assert.equal(structuredPoison?.战斗效果?.dot_damage_ratio, 0.05, '结构化中毒没有写入共享持续伤害语义');
const structuredDotHpBefore = structuredDotTarget.属性.HP;
const structuredDotTick = sandbox.__LWCS_BATTLE_RUNTIME__.settleConditionResourceTick(
  structuredDotTarget,
  '中毒',
  structuredPoison,
  'enemy-a',
  structuredDotCombat,
);
assert.equal(structuredDotHpBefore - structuredDotTarget.属性.HP, 25, '中毒首个tick没有按目标最大生命5%结算');
assert.equal(structuredDotTick.totalDot, 25, '中毒tick审计值与实际生命变化不一致');
assert.ok(structuredDotResult.facts.some(event => event?.eventKind === 'state_apply'), '结构化中毒缺少状态来源事实');

const structuredCreationCombat = combatData();
structuredCreationCombat.回合 = 1;
const structuredCreation = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredCreationCombat,
  declaration: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['player-a'],
    skill: {
      name: '结构化恢复物',
      魂技名: '结构化恢复物',
      承载方式: '造物承载',
      _效果数组: [{
        物品类型: '食物',
        数量: 1,
        有效期tick: 12,
        使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '生命', 数值: '+10%' }],
      }],
    },
  },
});
const structuredCreationFact = structuredCreation.facts.find(event => event?.eventKind === 'create');
assert.equal(structuredCreationFact?.createdName, '结构化恢复物', '结构化造物没有写入生成物名称');
assert.equal(structuredCreationFact?.count, 1, '结构化造物没有写入生成数量');
assert.equal(structuredCreationCombat.参战者.team_player[0].背包?.结构化恢复物?.数量, 1, '结构化造物没有增加正式影子库存');
assert.equal(structuredCreationCombat.参战者.team_player[0].属性.HP, 500, '造物的使用效果被错误提前结算');
structuredCreationCombat.参战者.team_player[0].属性.HP = 250;
structuredCreationCombat.参战者.team_player[0].hp = 250;
structuredCreationCombat.参战者.team_player[0].HP = 250;
const structuredCreationFollowUp = inspectDecision({
  worldSnapshot: structuredCreationCombat,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 2 },
  beliefState: {},
  seed: 'structured-creation-follow-up',
});
const structuredCreatedItemCandidate = structuredCreationFollowUp.candidates.find(candidate =>
  candidate?.declaration?.actionKind === 'USE_ITEM' &&
  String(candidate?.declaration?.skill?.name || '').trim() === '结构化恢复物'
);
assert.ok(structuredCreatedItemCandidate, `结构化造物没有进入后续USE_ITEM候选:${JSON.stringify(structuredCreationCombat.参战者.team_player[0].背包)}`);
assert.ok(Number(structuredCreatedItemCandidate.objectiveUtility || 0) > 0, '受伤单位使用已造恢复物没有形成正向效用');
const structuredCreatedItemUse = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: structuredCreationCombat,
  declaration: structuredCreatedItemCandidate.declaration,
});
assert.ok(structuredCreatedItemUse.facts.some(event =>
  event?.eventKind === 'item_consume' &&
  event?.meta?.quantityBefore === 1 &&
  event?.meta?.remainingQuantity === 0 &&
  event?.meta?.delta === -1
), '结构化物品使用缺少唯一库存消费事实');
assert.equal(structuredCreationCombat.参战者.team_player[0].背包?.结构化恢复物?.数量, 0, '结构化物品使用后库存没有扣减');
assert.ok(structuredCreationCombat.参战者.team_player[0].属性.HP > 250, '结构化恢复物消费后没有结算使用效果');
const postConsumptionDecision = inspectDecision({
  worldSnapshot: structuredCreationCombat,
  actorId: 'player-a',
  actionOpportunity: { role: 'ACTIVE', sequence: 3 },
  beliefState: {},
  seed: 'structured-creation-consumed',
});
assert.ok(!postConsumptionDecision.candidates.some(candidate =>
  candidate?.declaration?.actionKind === 'USE_ITEM' &&
  String(candidate?.declaration?.skill?.name || '').trim() === '结构化恢复物'
), '库存耗尽后同一物品仍被重复提供为候选');

const hardControlCombat = combatData();
hardControlCombat.参战者.team_player[0].属性.敏捷 = 500;
hardControlCombat.参战者.team_enemy[0].属性.敏捷 = 1;
const hardControlResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-hard-control-opportunity',
  seed: 88431,
  combatData: hardControlCombat,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: {
      id: 'runtime-derived-hard-control',
      name: '行动机会控制测试',
      魂技名: '行动机会控制测试',
      _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 2, 成功率: 1 }],
    },
  },
  settings: {},
});
const hardControlFact = hardControlResult.ledger.find(event =>
  event?.eventKind === 'state_apply' && event?.actorName === 'player-a' && event?.targetName === 'enemy-a'
);
assert.equal(hardControlFact?.duration, 2, '硬控状态事实没有写入真实持续回合');
assert.equal(hardControlFact?.meta?.duration, 2, '硬控状态判定明细没有写入真实持续回合');
assert.ok(hardControlResult.ledger.some(event =>
  event?.eventKind === 'blocked_action' &&
  event?.actorName === 'enemy-a' &&
  event?.actionRole === 'ACTIVE' &&
  event?.ruleCode === 'NATURAL_ACTION_OPPORTUNITY_CANCELLED'
), '先手硬控没有取消目标尚未消费的自然行动机会');
assert.ok(!hardControlResult.ledger.some(event =>
  event?.eventKind === 'action_start' && event?.actorName === 'enemy-a' && event?.actionRole === 'ACTIVE'
), '目标被先手硬控后仍执行了主动动作');

const slowControlCombat = combatData();
slowControlCombat.参战者.team_player[0].属性.敏捷 = 500;
slowControlCombat.参战者.team_enemy[0].属性.敏捷 = 1;
const slowControlResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-soft-control-opportunity',
  seed: 88432,
  combatData: slowControlCombat,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: {
      id: 'runtime-derived-soft-control',
      name: '非硬控行动测试',
      魂技名: '非硬控行动测试',
      _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '迟缓', 持续回合: 2, 成功率: 1 }],
    },
  },
  settings: {},
});
assert.ok(slowControlResult.ledger.some(event =>
  event?.eventKind === 'action_start' && event?.actorName === 'enemy-a' && event?.actionRole === 'ACTIVE'
), '迟缓被错误当成硬控并取消了自然行动');
assert.ok(!slowControlResult.ledger.some(event =>
  event?.eventKind === 'blocked_action' &&
  event?.actorName === 'enemy-a' &&
  event?.ruleCode === 'NATURAL_ACTION_OPPORTUNITY_CANCELLED'
), '非硬控状态产生了错误的自然行动取消事实');

const groupReactionCombat = combatData();
groupReactionCombat.参战者.team_player[0].属性.敏捷 = 500;
groupReactionCombat.参战者.team_enemy.push(participant('enemy-b', 'enemy', 130), participant('enemy-c', 'enemy', 120));
const groupReactionResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-group-reaction-opportunities',
  seed: 88433,
  combatData: groupReactionCombat,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a', 'enemy-b', 'enemy-c'],
    skill: {
      id: 'group-reaction-test',
      name: '群体反应机会测试',
      魂技名: '群体反应机会测试',
      _效果数组: [{ 原型: '伤害结算', 目标: '群体', 威力倍率: 20, 伤害类型: '远程攻击', 命中概率: 1 }],
    },
  },
  settings: {},
});
const groupReactionActors = new Set(groupReactionResult.decisions
  .filter(entry => entry?.actionRole === 'REACTION' && entry?.sourceActorId === 'player-a')
  .map(entry => entry?.actorId));
assert.deepEqual([...groupReactionActors].sort(), ['enemy-a', 'enemy-b', 'enemy-c'], '群攻目标没有分别获得独立反应决策');
assert.ok(!groupReactionResult.ledger.some(event =>
  event?.eventKind === 'reaction_window' && event?.meta?.reason === 'FACTION_REACTION_LIMIT'
), '群攻反应仍被阵营级性能上限截断');

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

const multiWindowSummonCombat = combatData();
multiWindowSummonCombat.参战者.team_player[0].技能列表 = [structuredClone(attackSkill)];
const multiWindowSummonResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-multi-window-summon',
  seed: 88422,
  combatData: multiWindowSummonCombat,
  mode: 'team_preview',
  rounds: 2,
  selectedAction: {
    actorId: 'player-a',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['player-a'],
    skill: {
      name: '双窗协同召唤',
      魂技名: '双窗协同召唤',
      消耗: '无',
      前摇: 1,
      _效果数组: [{
        原型: '召唤生成',
        目标: '自身',
        召唤物名称: '双窗协同体',
        召唤单位类型: '魂兽',
        行动模式: '协同攻击',
        持续回合: 2,
        继承属性比例: 0.4,
      }],
    },
  },
  settings: { decisionEngine: 'next-shadow' },
});
const multiWindowAssistStarts = multiWindowSummonResult.ledger.filter(event =>
  event?.eventKind === 'action_start' &&
  event?.actorName === '双窗协同体' &&
  event?.actionRole === 'ASSIST'
);
assert.equal(
  multiWindowAssistStarts.length,
  2,
  `持续2回合协同召唤没有获得两个唯一行动窗口:${JSON.stringify(multiWindowAssistStarts)}`,
);
assert.deepEqual(
  [...multiWindowAssistStarts].map(event => Number(event.round)),
  [1, 2],
  '协同召唤没有按每回合最多一个窗口兑现',
);
assert.equal(
  multiWindowSummonResult.ledger.filter(event =>
    event?.eventKind === 'summon_end' && event?.actorName === '双窗协同体'
  ).length,
  1,
  '协同召唤耗尽全部真实窗口后没有唯一离场事实',
);
assert.equal(
  multiWindowSummonResult.finalSnapshot?.summons?.filter(unit => unit?.name === '双窗协同体').length || 0,
  0,
  '协同召唤窗口耗尽后仍残留在最终快照',
);
assert.equal(
  multiWindowSummonResult.audit?.fatals?.length || 0,
  0,
  `多窗口协同召唤事务审计失败:${JSON.stringify(multiWindowSummonResult.audit?.fatals || [])}`,
);

const conditionalSkill = {
  name: '昼夜条件伤害',
  魂技名: '昼夜条件伤害',
  _效果数组: [
    { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '远程攻击', 命中概率: 1, 条件分支: [{ 条件: [{ 类型: '时间', 对象: '自身', 比较: '==', 值: '白天' }], 处理: '生效' }] },
    { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '远程攻击', 命中概率: 1, 条件分支: [{ 条件: [{ 类型: '时间', 对象: '自身', 比较: '==', 值: '黑夜' }], 处理: '生效' }] },
  ],
};
const conditionalCombat = combatData();
conditionalCombat.时间段 = '白天';
const conditionalPreview = sandbox.__LWCS_BATTLE_PREVIEW__.previewAction({
  worldSnapshot: conditionalCombat,
  actorId: 'player-a',
  declaration: { actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'], skill: conditionalSkill, resourceCosts: {} },
  actionFingerprint: 'conditional-day-preview',
});
assert.equal(conditionalPreview.contributions.filter(entry => entry?.outcomeKind === 'HP_DELTA').length, 1, '白天预估同时计算了昼夜互斥伤害');
const conditionalSettlement = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: conditionalCombat,
  declaration: { actorId: 'player-a', actionKind: 'RELEASE_SKILL', targetIds: ['enemy-a'], skill: conditionalSkill, resourceCosts: {} },
});
assert.equal(conditionalSettlement.facts.filter(event => event?.eventKind === 'hit_result').length, 1, '白天结算同时执行了昼夜互斥伤害');

const shadowInput = combatData();
const shadowInputHash = digest(shadowInput);
const structuredShadow = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-duel', seed: 88421, combatData: shadowInput, mode: 'team_preview', rounds: 2,
  settings: {},
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
const structuredLearningInput = combatData();
const structuredLearningSkill = {
  id: 'structured-learning-control',
  name: '结构化认知控制',
  魂技名: '结构化认知控制',
  消耗: '无',
  前摇: 1,
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 1, 成功率: '100%', 生效方式: '独立生效' }],
};
structuredLearningInput.参战者.team_player[0].技能列表 = [structuredClone(structuredLearningSkill)];
const structuredLearningResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-mechanic-learning',
  seed: 88422,
  combatData: structuredLearningInput,
  mode: 'team_preview',
  rounds: 1,
  settings: {},
});
const structuredMechanicObservation = structuredLearningResult.beliefObservations.find(observation =>
  observation?.observationType === 'MECHANIC_RESULT' &&
  observation?.actorId === 'player-a' &&
  observation?.targetId === 'enemy-a' &&
  observation?.stateName === '僵直'
);
assert.ok(structuredMechanicObservation?.candidateId, '结构化机制学习缺少来源候选');
assert.equal(structuredMechanicObservation?.effectPrototype, '状态施加', '结构化机制学习缺少效果原型');
assert.ok(Number(structuredMechanicObservation?.posterior || 0) > 0, `结构化机制学习没有写出有效后验:${JSON.stringify(structuredMechanicObservation)}`);
const structuredShadowRepeat = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-duel', seed: 88421, combatData: shadowInput, mode: 'team_preview', rounds: 2,
  settings: {},
});
assert.equal(digest({ ledger: structuredShadowRepeat.ledger, finalSnapshot: structuredShadowRepeat.finalSnapshot }), digest({ ledger: structuredShadow.ledger, finalSnapshot: structuredShadow.finalSnapshot }), '结构化影子同种子不能复现');

const structuredCounterShadow = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-shadow-counter', seed: 1, combatData: combatData(), mode: 'team_preview', rounds: 1,
  settings: {},
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
  settings: {},
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
  settings: {},
});
const controlledFollowUpTrace = controlledFollowUpShadow.actionQueueTrace.filter(entry => entry?.nodeKind === 'CONTINUATION');
assert.ok(controlledFollowUpTrace.some(entry => entry?.state === 'ENQUEUED'), '受控行动者的显式后继授权没有先形成');
assert.ok(controlledFollowUpTrace.some(entry => entry?.state === 'CANCELLED'), `受控行动者的后继动作没有在执行前取消:${JSON.stringify(controlledFollowUpTrace)}`);
assert.ok(controlledFollowUpShadow.ledger.some(event =>
  event?.eventKind === 'blocked_action' && event?.ruleCode === 'CONTINUATION_ACTOR_UNAVAILABLE'
), '受控后继取消缺少结构化事实');

const structuredFusionSkill = {
  id: 'structured-partner-fusion',
  name: '结构化双人合击',
  魂技名: '结构化双人合击',
  消耗: '魂力:50%',
  前摇: 1,
  _效果数组: [{
    原型: '伤害结算',
    目标: '群体',
    威力倍率: 50,
    伤害类型: '近身攻击',
    命中概率: 100,
    生效方式: '独立生效',
  }],
};
const structuredFusionCombat = combatData();
const structuredFusionActor = participant('fusion-actor', 'player', 220);
const structuredFusionPartner = participant('fusion-partner', 'player', 180);
structuredFusionActor.技能列表 = [structuredFusionSkill];
structuredFusionActor.武魂融合技 = {
  结构化双人合击: {
    融合模式: 'partner',
    融合对象: 'fusion-partner',
    用法模式: '一次性释放',
    融合参与者: [
      { 类型: '自身', 角色键: 'fusion-actor', 角色名: 'fusion-actor' },
      { 类型: '搭档', 角色键: 'fusion-partner', 角色名: 'fusion-partner' },
    ],
    技能数据: structuredFusionSkill,
  },
};
structuredFusionPartner.技能列表 = [structuredClone(attackSkill)];
structuredFusionCombat.参战者.team_player = [structuredFusionActor, structuredFusionPartner];
structuredFusionCombat.参战者.team_enemy[0].agi = 100;
structuredFusionCombat.参战者.team_enemy[0].属性.敏捷 = 100;
const structuredFusionResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'structured-partner-fusion',
  seed: 88423,
  combatData: structuredFusionCombat,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'fusion-actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['enemy-a'],
    skill: structuredFusionSkill,
  },
  settings: { decisionEngine: 'next-shadow' },
});
const structuredFusionStarts = structuredFusionResult.ledger.filter(event =>
  event?.eventKind === 'action_start' && event?.actionName === '结构化双人合击'
);
assert.equal(structuredFusionStarts.length, 1, `同一搭档融合技在一回合内重复结算:${JSON.stringify(structuredFusionStarts)}`);
assert.deepEqual(
  [...(structuredFusionStarts[0]?.meta?.fusionParticipantIds || [])].sort(),
  ['fusion-actor', 'fusion-partner'],
  '融合技动作事实没有绑定完整参与者',
);
assert.ok(structuredFusionResult.ledger.some(event =>
  event?.eventKind === 'blocked_action' &&
  event?.actorName === 'fusion-partner' &&
  event?.ruleCode === 'FUSION_PARTICIPATION_CONSUMED' &&
  event?.sourceActionId === structuredFusionStarts[0]?.actionId
), '搭档自然机会没有记录为已参与融合技');
for (const participantId of ['fusion-actor', 'fusion-partner']) {
  assert.ok(structuredFusionResult.ledger.some(event =>
    event?.eventKind === 'resource_change' &&
    event?.actorName === participantId &&
    Number(event?.meta?.delta || 0) === -250 &&
    event?.sourceActionId === structuredFusionStarts[0]?.actionId
  ), `融合技没有原子扣除${participantId}的资源`);
}
assert.equal(
  structuredFusionResult.decisions.filter(entry =>
    entry?.actorId === 'fusion-partner' && entry?.actionRole === 'ACTIVE'
  ).length,
  0,
  '已参与融合技的搭档仍执行了第二个主动决策',
);
assert.equal(structuredFusionResult.audit?.fatals?.length || 0, 0, `融合技事务审计失败:${JSON.stringify(structuredFusionResult.audit?.fatals || [])}`);

const failedEvadeMissCombat = combatData();
failedEvadeMissCombat.回合 = 1;
const failedEvadeMissParent = sandbox.__LWCS_BATTLE_RUNTIME__.beginStructuredDeclaration({
  combatData: failedEvadeMissCombat,
  declaration: { actorId: 'player-a', actionKind: 'BASIC_ATTACK', targetIds: ['enemy-a'] },
});
sandbox.Math.random = () => 0.999999;
const failedEvadeMissReaction = sandbox.__LWCS_BATTLE_RUNTIME__.settleStructuredReaction({
  combatData: failedEvadeMissCombat,
  reactor: failedEvadeMissCombat.参战者.team_enemy[0],
  sourceActor: failedEvadeMissCombat.参战者.team_player[0],
  declaration: { actorId: 'enemy-a', actionKind: 'EVADE', targetIds: ['enemy-a'] },
  parentActionEvent: failedEvadeMissParent.actionEvent,
});
const failedEvadeMissSettlement = sandbox.__LWCS_BATTLE_RUNTIME__.executeStructuredDeclaration({
  combatData: failedEvadeMissCombat,
  declaration: failedEvadeMissParent.declaration,
  actionContext: failedEvadeMissParent,
  reactionByTarget: { 'enemy-a': failedEvadeMissReaction },
});
sandbox.Math.random = originalSandboxRandom;
const independentMiss = failedEvadeMissSettlement.facts.find(event => event?.eventKind === 'hit_result');
assert.equal(failedEvadeMissReaction.evaded, false, '独立命中落空样本的闪避检定没有失败');
assert.equal(independentMiss?.result, 'miss', '闪避失败后的独立命中检定没有形成落空事实');
assert.equal(independentMiss?.primaryOutcome, 'attack_missed', '独立命中落空被错误归因于闪避成功');
assert.equal(independentMiss?.meta?.reactionEventId, failedEvadeMissReaction.event.eventId, '独立命中落空没有保留前置闪避检定来源');

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
    structuredCommitChecks: 13,
    structuredShadowChecks: 17,
    fatalCount: result.audit?.fatals?.length || 0,
    passed: true,
  },
}, null, 2));

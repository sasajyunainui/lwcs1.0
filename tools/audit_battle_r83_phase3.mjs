import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const sandbox = {
  console,
  structuredClone,
  Math: Object.create(Math),
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
for (const fileName of [
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'), sandbox, { filename: fileName });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

function unit(id, side, hp = 500) {
  return {
    id,
    name: id,
    名称: id,
    side,
    hp,
    hp_max: 500,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    属性: {
      等级: 50,
      HP: hp,
      HP上限: 500,
      魂力: 100,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 120,
      防御: 100,
      敏捷: 100,
      状态效果: {},
    },
    状态: { 存活: hp > 0, 行动: hp > 0 ? '战斗' : '失去战斗力' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: [],
  };
}

function objective() {
  return {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 5,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }] },
  };
}

const queueChanges = [];
const queue = runtime.createActionQueue({
  round: 1,
  describeActor: entry => entry.name,
  describeActorId: entry => entry.id,
  onOpportunityChange: record => queueChanges.push(record),
});
assert.equal(queue.enqueue({
  actorEntry: { id: 'actor', name: 'actor' },
  grantId: 'natural:1:actor',
  opportunityId: 'natural:1:actor',
  grantType: 'NATURAL_ACTION',
  nodeKind: 'ACTIVE',
  actionRole: 'ACTIVE',
}), true);
const activeNode = queue.dequeue();
queue.recordTrace('EXECUTING', activeNode);
queue.recordTrace('EXECUTED', activeNode, { actionId: 'action:actor:1' });
const activeOpportunity = queue.opportunitySnapshot()[0];
addCheck(
  'opportunity:natural-lifecycle',
  activeOpportunity?.ownerId === 'actor' &&
    activeOpportunity?.grantType === 'NATURAL_ACTION' &&
    activeOpportunity?.status === 'CONSUMED' &&
    activeOpportunity?.consumedByActionId === 'action:actor:1' &&
    queueChanges.map(item => item.status).join('|') === 'PENDING|EXECUTING|CONSUMED',
  { activeOpportunity, states: queueChanges.map(item => item.status) },
);

const reactionQueue = runtime.createActionQueue({
  round: 1,
  describeActorId: entry => entry.id,
});
assert.equal(reactionQueue.enqueue({
  actorEntry: { id: 'defender', name: 'defender' },
  grantId: 'counter:attack:1',
  opportunityId: 'counter:attack:1',
  nodeKind: 'COUNTER',
  actionRole: 'COUNTER',
  grantType: 'COUNTER_WINDOW',
  sourceActorId: 'attacker',
  sourceActionId: 'attack:1',
  validTargetIds: ['attacker'],
}), true);
const counterOpportunity = reactionQueue.opportunitySnapshot()[0];
addCheck(
  'opportunity:counter-owner-source-target',
  counterOpportunity?.ownerId === 'defender' &&
    counterOpportunity?.sourceActorId === 'attacker' &&
    counterOpportunity?.sourceActionId === 'attack:1' &&
    counterOpportunity?.validTargetIds?.[0] === 'attacker',
  { counterOpportunity },
);

let selfSourceError = '';
try {
  runtime.normalizeOpportunityRecord({
    opportunityId: 'bad:self',
    ownerId: 'same',
    sourceActorId: 'same',
    grantType: 'COUNTER_WINDOW',
  });
} catch (error) {
  selfSourceError = String(error?.message || error);
}
addCheck('opportunity:self-source-rejected', selfSourceError === 'REACTION_SELF_SOURCE_INVALID', { selfSourceError });

const baseSnapshot = {
  schemaVersion: '8.3-runtime-snapshot-1',
  opportunitySnapshot: [{
    opportunityId: 'natural:noop',
    ownerId: 'actor',
    role: 'ACTIVE',
    sourceActorId: '',
    sourceActionId: '',
    grantType: 'NATURAL_ACTION',
    validTargetIds: [],
    createdAtSequence: 1,
    expiresAtSequence: 0,
    status: 'PENDING',
    consumedByActionId: '',
    lostReason: '',
  }],
  resourceTimeline: [{ eventId: 'resource:1', operation: 'RESTORE', delta: 10 }],
  scheduledEvents: [{ descriptorId: 'schedule:1', eventType: 'DOT_TICK' }],
  firstTerminalSequence: null,
};
const noOpSnapshot = runtime.buildNoOpRuntimeSnapshot(baseSnapshot, 'natural:noop');
addCheck(
  'noop:same-world-timeline-schedule',
  noOpSnapshot.opportunitySnapshot[0].status === 'CONSUMED' &&
    noOpSnapshot.opportunitySnapshot[0].consumedByActionId === 'NO_OP:natural:noop' &&
    runtime.hashBattleValue(noOpSnapshot.resourceTimeline) === runtime.hashBattleValue(baseSnapshot.resourceTimeline) &&
    runtime.hashBattleValue(noOpSnapshot.scheduledEvents) === runtime.hashBattleValue(baseSnapshot.scheduledEvents) &&
    noOpSnapshot.noOp.paysResources === false &&
    noOpSnapshot.noOp.establishesStance === false &&
    noOpSnapshot.noOp.triggersActionReaction === false,
);

const timelineCombat = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player')],
    team_enemy: [unit('enemy', 'enemy')],
  },
};
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'action_cost',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '测试支付',
  opportunitySequence: 1,
  meta: { resource: '魂力', amount: 30, actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'resource_change',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '支付前恢复',
  opportunitySequence: 1,
  meta: { resource: '魂力', amount: 20, delta: 20, actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'resource_change',
  actorId: 'enemy',
  actorName: 'enemy',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '资源削减',
  opportunitySequence: 1,
  meta: { resource: '魂力', amount: 10, delta: -10, actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'state_apply',
  actorId: 'enemy',
  actorName: 'enemy',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '资源锁定',
  ruleCode: 'RESOURCE_LOCK',
  opportunitySequence: 1,
  meta: { resource: '魂力', actionSequence: 1 },
});
runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'state_tick',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'actor',
  targetName: 'actor',
  actionName: '资源解锁',
  ruleCode: 'RESOURCE_UNLOCK',
  opportunitySequence: 1,
  meta: { resource: '魂力', actionSequence: 1 },
});
const timeline = runtime.resourceTimelineFromRuntime(timelineCombat);
addCheck(
  'resource:single-ordered-timeline',
  timeline.map(event => event.operation).join('|') === 'RESTORE|UNLOCK|REDUCE|LOCK|PAY' &&
    timeline.every((event, index) => index === 0 || event.phasePriority >= timeline[index - 1].phasePriority),
  { operations: timeline.map(event => event.operation), priorities: timeline.map(event => event.phasePriority) },
);

runtime.writeLedgerEvent(timelineCombat, {
  eventKind: 'state_apply',
  actorId: 'actor',
  actorName: 'actor',
  targetId: 'enemy',
  targetName: 'enemy',
  actionName: '延迟控制',
  result: 'scheduled',
  meta: {
    scheduledIndex: 0,
    scheduled: {
      type: 'DELAYED_STATE',
      targetId: 'enemy',
      delay: 2,
      expectedGrantType: 'NATURAL_ACTION',
    },
  },
});
const schedules = runtime.scheduledEventsFromRuntime(timelineCombat);
addCheck(
  'schedule:descriptor-from-runtime-event',
  schedules.length === 1 &&
    schedules[0].ownerId === 'enemy' &&
    schedules[0].eventType === 'DELAYED_STATE' &&
    schedules[0].expirySequence >= schedules[0].creationSequence,
  { schedules },
);

const terminalCombat = {
  回合: 1,
  胜负条件: objective(),
  参战者: {
    team_player: [unit('actor', 'player')],
    team_enemy: [unit('enemy', 'enemy', 0)],
  },
};
const terminal = runtime.evaluateBattleTerminal({
  combatData: terminalCombat,
  currentRound: 1,
  roundCompleted: false,
});
const terminalSnapshot = runtime.buildRuntimeDecisionSnapshot(terminalCombat);
const terminalEvent = terminalCombat.__battleEventLedger.find(event => event.eventKind === 'battle_objective_resolved');
addCheck(
  'terminal:first-sequence-owned-by-runtime',
  terminal.terminal === true &&
    terminal.winner === 'player' &&
    terminalSnapshot.firstTerminalSequence?.eventId === terminalEvent?.eventId &&
    terminalSnapshot.firstTerminalSequence?.sequence === terminalEvent?.sequence,
  { firstTerminalSequence: terminalSnapshot.firstTerminalSequence },
);

const decisionSnapshot = runtime.buildDecisionRuntimeSnapshot(timelineCombat, 'actor', {
  role: 'ACTIVE',
  opportunityId: 'decision:actor:1',
});
addCheck(
  'decision:runtime-snapshot-complete',
  decisionSnapshot.schemaVersion === '8.3-runtime-snapshot-1' &&
    decisionSnapshot.opportunitySnapshot.some(item => item.opportunityId === 'decision:actor:1') &&
    decisionSnapshot.resourceTimeline.length === timeline.length &&
    decisionSnapshot.scheduledEvents.length === schedules.length,
);

const runtimeSource = fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'), 'utf8');
addCheck(
  'source:single-runtime-contract-owner',
  /function buildRuntimeDecisionSnapshot\(combatData = \{\}\)/.test(runtimeSource) &&
    /function buildNoOpRuntimeSnapshot\(runtimeSnapshot = \{\}, opportunityId = ''\)/.test(runtimeSource) &&
    /appendRuntimeEventContracts\(rootData, event\)/.test(runtimeSource) &&
    /runtime\.firstTerminalSequence = \{/.test(runtimeSource),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    opportunityCheckCount: checks.filter(check => check.checkId.startsWith('opportunity:')).length,
    runtimeEventContractStatus: failed.length === 0 ? 'RUNTIME_EVENT_CONTRACT_PASSED' : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

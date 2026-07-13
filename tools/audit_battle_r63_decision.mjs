import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
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
for (const relativePath of ['lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
assert.ok(decision && runtime, '正式决策或战斗运行时未加载');
assert.equal(decision.parseSkillCosts({ 消耗: { 魂力: 1 } }).魂力, 1, '绝对消耗1被误解为100%');
assert.equal(decision.parseSkillCosts({ 消耗: { 魂力: '50%' } }).魂力, '50%', '比例消耗丢失百分号语义');

const attackSkill = {
  id: 'attack-skill', name: '测试攻击', 消耗: '魂力:10',
  _效果数组: [
    { 原型: '伤害结算', 目标: '单体', 威力倍率: 80, 伤害类型: '近身攻击' },
    { 原型: '属性修正', 目标: '自身', 属性: '防御', 数值: '+10%', 持续回合: 1 },
  ],
};
const healSkill = {
  id: 'heal-skill', name: '测试治疗', 消耗: '魂力:20',
  _效果数组: [{ 原型: '资源变化', 目标: '单体', 资源: '生命', 数值: '+30' }],
};
const expensiveSkill = {
  id: 'expensive-skill', name: '不可支付技能', 消耗: '魂力:9999',
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 999, 伤害类型: '近身攻击' }],
};

function unit(id, side, index) {
  return {
    id,
    name: id,
    level: 50 + index,
    hp: index === 0 && side === 'ally' ? 60 : 100,
    hp_max: 100,
    shield: 0,
    sp: 100,
    sp_max: 100,
    men: 70,
    men_max: 100,
    vit: 80,
    vit_max: 100,
    str: 70 + index,
    def: 50,
    agi: 50 + index,
    状态: { 存活: true },
    技能列表: [attackSkill, healSkill, expensiveSkill],
  };
}

function world(size) {
  return {
    回合: 1,
    参战者: {
      ally: Array.from({ length: size }, (_, index) => unit(`ally-${index + 1}`, 'ally', index)),
      enemy: Array.from({ length: size }, (_, index) => unit(`enemy-${index + 1}`, 'enemy', index)),
    },
  };
}

const shapeResults = [];
for (const size of [1, 3, 7]) {
  const worldSnapshot = world(size);
  const before = JSON.stringify(worldSnapshot);
  const result = decision.decide({ worldSnapshot, actorId: 'ally-1', beliefState: { confidence: 0.5 }, seed: 7300 + size });
  assert.equal(JSON.stringify(worldSnapshot), before, `${size}v${size}正式决策修改输入`);
  assert.ok(result.candidateCount > 0 && result.paretoCount > 0, `${size}v${size}候选或Pareto为空`);
  const basicTargets = result.candidates.filter(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK').flatMap(candidate => candidate.declaration.targetIds);
  assert.equal(new Set(basicTargets).size, size, `${size}v${size}普通攻击目标池被截断`);
  const skillTargets = result.candidates.filter(candidate => candidate.skill?.id === 'attack-skill').flatMap(candidate => candidate.declaration.targetIds);
  assert.equal(new Set(skillTargets).size, size, `${size}v${size}技能目标池被截断`);
  assert.ok(!result.candidates.some(candidate => candidate.skill?.id === 'expensive-skill'), `${size}v${size}资源不足技能进入候选`);
  assert.ok(result.scoreAudit.length <= 3 && result.scoreAudit.some(item => item.selected), `${size}v${size}评分审计不满足选中项加两个替代项`);
  shapeResults.push({ shape: `${size}v${size}`, candidateCount: result.candidateCount, paretoCount: result.paretoCount, selected: result.selected.candidateId });
}

const deterministicWorld = world(3);
const first = decision.decide({ worldSnapshot: deterministicWorld, actorId: 'ally-1', beliefState: { confidence: 0.4 }, seed: 99 });
const second = decision.decide({ worldSnapshot: deterministicWorld, actorId: 'ally-1', beliefState: { confidence: 0.4 }, seed: 99 });
assert.equal(first.selected.candidateId, second.selected.candidateId, '同输入同种子选择不确定');
assert.equal(JSON.stringify(first.scoreAudit), JSON.stringify(second.scoreAudit), '同输入同种子评分审计不确定');

const confused = decision.decide({ worldSnapshot: world(3), actorId: 'ally-1', beliefState: { confidence: 0.4, targetInterferencePossible: true }, seed: 100 });
const confusedAttackTargets = confused.candidates.filter(candidate => candidate.skill?.id === 'attack-skill').flatMap(candidate => candidate.declaration.targetIds);
assert.ok(confusedAttackTargets.includes('ally-2') && confusedAttackTargets.includes('enemy-3'), '潜在索敌干扰未保留友敌完整目标通道');

const fullHealthWorld = world(1);
fullHealthWorld.参战者.ally[0].hp = 100;
const fullHealth = decision.decide({ worldSnapshot: fullHealthWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 101 });
const fullHealthHeal = fullHealth.candidates.find(candidate => candidate.skill?.id === 'heal-skill');
assert.equal(fullHealthHeal?.rejectionCode, 'ZERO_EFFECT_COSTLY', '满血有成本治疗未被识别为零收益');
assert.equal(fullHealthHeal?.preview?.contributions.filter(entry => entry.outcomeKind === 'RESOURCE_OPTION_CHANGED').length, 1, '治疗技能消耗未记录独立资源事实');
assert.equal(fullHealthHeal?.preview?.contributions.filter(entry => entry.outcomeKind === 'HP_DELTA').length, 1, '满血治疗未保留零边际生命事实');

const costlyWorld = world(1);
costlyWorld.参战者.ally[0].技能列表 = [{
  id: 'bankrupt-skill', name: '资源破产技能', 消耗: '魂力:95',
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 45, 伤害类型: '近身攻击' }],
}, attackSkill];
const costly = decision.decide({ worldSnapshot: costlyWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 102 });
const bankrupt = costly.candidates.find(candidate => candidate.skill?.id === 'bankrupt-skill');
assert.equal(sandbox.__LWCS_BATTLE_PREVIEW__.readResource(sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(bankrupt.preview.afterSnapshot, 'ally-1'), '魂力'), 5, '技能成本未进入覆盖层资源终态');

const survivalWorld = world(1);
survivalWorld.参战者.ally[0].hp = 5;
survivalWorld.参战者.ally[0].技能列表 = [attackSkill];
survivalWorld.参战者.enemy[0].hp = 1000;
survivalWorld.参战者.enemy[0].hp_max = 1000;
survivalWorld.参战者.enemy[0].str = 500;
survivalWorld.参战者.enemy[0].def = 500;
const survivalDecision = decision.decide({
  worldSnapshot: survivalWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '求生' },
  beliefState: { confidence: 1 },
  seed: 103,
});
assert.equal(survivalDecision.selected.declaration.actionKind, 'WITHDRAW', '濒死求生场景仍选择主动攻击');
assert.ok(survivalDecision.candidates.find(candidate => candidate.declaration.actionKind === 'WITHDRAW' && candidate.objectiveUtility > 30), '撤退没有获得保命窗口价值');

const chargedThreatWorld = world(1);
chargedThreatWorld.参战者.ally[0].hp = 25;
chargedThreatWorld.参战者.ally[0].sp = 0;
chargedThreatWorld.参战者.ally[0].技能列表 = [];
chargedThreatWorld.参战者.enemy[0].str = 500;
chargedThreatWorld.参战者.enemy[0].蓄力技能 = {
  id: 'visible-lethal-charge',
  cast_time: 20,
  skill: {
    id: 'visible-lethal-charge-skill', name: '已显露致命蓄力',
    _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 500, 伤害类型: '近身攻击' }],
  },
};
const chargedThreatDecision = decision.decide({
  worldSnapshot: chargedThreatWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 106,
});
assert.ok(['DEFEND', 'EVADE'].includes(chargedThreatDecision.selected.declaration.actionKind), '低血量面对公开致命蓄力仍用无效攻击换取1点伤害');
assert.ok(chargedThreatDecision.selected.objectiveUtility >= 18, '避免公开致命终态没有进入防守效用');
chargedThreatWorld.参战者.ally[0].__battleRuntime = {
  activeDefenseStance: { type: chargedThreatDecision.selected.declaration.actionKind, stateName: '已准备防守窗口' },
};
const preparedThreatDecision = decision.decide({
  worldSnapshot: chargedThreatWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 107,
});
assert.ok(!['DEFEND', 'EVADE'].includes(preparedThreatDecision.selected.declaration.actionKind), '未消费的基础防守窗口被重复刷新');
assert.ok(preparedThreatDecision.candidates.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate.declaration.actionKind)).every(candidate => candidate.rejectionCode === 'ZERO_PROGRESS'), '已有防守窗口时重复防守没有归零边际');
delete chargedThreatWorld.参战者.ally[0].__battleRuntime;
chargedThreatWorld.参战者.enemy[0].蓄力技能.cast_time = 50;
const delayedThreatDecision = decision.decide({
  worldSnapshot: chargedThreatWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 108,
});
assert.ok(!['DEFEND', 'EVADE'].includes(delayedThreatDecision.selected.declaration.actionKind), '防守窗口会在蓄力兑现前过期却仍提前防守');
assert.ok(delayedThreatDecision.candidates.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate.declaration.actionKind)).every(candidate => candidate.rejectionCode === 'ZERO_PROGRESS'), '过早防守没有按真实窗口归零');

const terminalPareto = decision.paretoFilter([
  { candidateId: 'withdraw', rejectionCode: '', vector: { expectedStateGain: 0, terminalUtility: 35, informationValue: 0, resourcePreservation: 0, survivalLowerBound: 1, irreversibleCost: 0, catastrophicRisk: 0 } },
  { candidateId: 'attack', rejectionCode: '', vector: { expectedStateGain: 1, terminalUtility: 0, informationValue: 0, resourcePreservation: 0, survivalLowerBound: 1, irreversibleCost: 0, catastrophicRisk: 0 } },
]);
assert.equal(terminalPareto.find(candidate => candidate.candidateId === 'withdraw')?.rejectionCode, '', '战斗意图终态在Pareto支配中被忽略');

const falseReactionWorld = world(1);
falseReactionWorld.参战者.ally[0].技能列表 = [{
  id: 'false-reaction', name: '死角突袭', 前摇: 1, 消耗: '魂力:1',
  _效果数组: [
    { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' },
    { 原型: '判定修正', 目标: '单体', 判定: '闪避', 数值: '-5%' },
  ],
}];
const falseReactionDecision = decision.decide({
  worldSnapshot: falseReactionWorld,
  actorId: 'ally-1',
  actionOpportunity: { role: 'REACTION', sourceActorId: 'enemy-1', immediateBudget: 40 },
  beliefState: { confidence: 1 },
  seed: 105,
});
assert.ok(!falseReactionDecision.candidates.some(candidate => candidate.skill?.id === 'false-reaction'), '敌方闪避减益被误认成即时防御魂技');

let publicBelief = { confidence: 0.2 };
publicBelief = decision.updatePublicObservation(publicBelief, {
  sourceActorId: 'enemy-1', responseId: 'basic', actionName: '普通攻击', baseActionValue: 12, result: 'hit',
});
const firstPublicConfidence = publicBelief.confidence;
for (let index = 0; index < 50; index += 1) {
  publicBelief = decision.updatePublicObservation(publicBelief, {
    sourceActorId: 'enemy-1', responseId: 'basic', actionName: '普通攻击', baseActionValue: 12, result: 'hit',
  });
}
assert.ok(firstPublicConfidence > 0.2, '首次公开动作没有提高认知置信度');
assert.ok(publicBelief.confidence < 0.7, '重复公开动作线性灌满了全局认知置信度');
assert.equal(publicBelief.publicResponses['enemy-1'][0].observations, 51, '重复公开动作没有聚合到同一回应记录');

const negativeActionWorld = world(1);
negativeActionWorld.参战者.ally[0].技能列表 = [{
  id: 'negative-action', name: '低收益高代价动作', 消耗: '魂力:95',
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 1, 伤害类型: '近身攻击' }],
}, attackSkill];
const negativeActionDecision = decision.decide({ worldSnapshot: negativeActionWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 104 });
const negativeAction = negativeActionDecision.candidates.find(candidate => candidate.skill?.id === 'negative-action');
assert.equal(negativeAction?.rejectionCode, 'SELF_DEFEATING', '负效用且有成本动作仍可进入主观候选池');

const decisionWorld = world(3);
const decisionBefore = JSON.stringify(decisionWorld);
const debugDecision = runtime.runBattleCase({ caseId: 'decision-3v3', seed: 123, combatData: decisionWorld, settings: { decisionOnly: true } });
assert.equal(debugDecision.decisions.length, 6, '唯一正式决策入口未覆盖全部存活单位');
assert.equal(JSON.stringify(decisionWorld), decisionBefore, '唯一正式决策入口修改调用方输入');
assert.equal(debugDecision.ledger.length, 0, '仅决策模式制造了正式Ledger事实');

console.log(JSON.stringify({
  summary: {
    shapeCount: shapeResults.length,
    deterministic: true,
    targetInterferenceChannel: true,
    debugDecisionCount: debugDecision.decisions.length,
    passed: true,
  },
  shapes: shapeResults,
}, null, 2));

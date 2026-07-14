import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildWeixiaofengFormalCase } from './battle_v73_formal_case_fixture.mjs';

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
for (const relativePath of ['lwcs/CharacterLibrary.js', 'lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
assert.ok(decision && runtime, '正式决策或战斗运行时未加载');
const inspectDecision = input => {
  let candidates = [];
  const result = decision.decide({ ...input, inspectCandidates: value => { candidates = value; } });
  return { ...result, candidates };
};
assert.throws(() => {
  const mismatch = { __LWCS_BATTLE_PREVIEW__: { version: 'wrong-preview', previewAction() {} } };
  mismatch.window = mismatch;
  mismatch.globalThis = mismatch;
  vm.createContext(mismatch);
  vm.runInContext(fs.readFileSync(path.resolve(root, 'lwcs/BattleDecision_Module.js'), 'utf8'), mismatch);
}, /battle_decision_preview_version_mismatch/, 'Decision未拒绝错误Preview版本');
assert.throws(() => {
  const mismatch = {
    __LWCS_BATTLE_PREVIEW__: { version: 'wrong-preview' },
    __LWCS_BATTLE_DECISION__: { version: '7.3-R6.3-decision-2' },
  };
  mismatch.window = mismatch;
  mismatch.globalThis = mismatch;
  vm.createContext(mismatch);
  vm.runInContext(fs.readFileSync(path.resolve(root, 'lwcs/BattleRuntime_Module.js'), 'utf8'), mismatch);
}, /battle_runtime_preview_version_mismatch/, 'Runtime未拒绝错误Preview版本');
assert.throws(() => {
  const mismatch = {
    __LWCS_BATTLE_PREVIEW__: { version: '7.3-R6.3-preview-2' },
    __LWCS_BATTLE_DECISION__: { version: 'wrong-decision' },
  };
  mismatch.window = mismatch;
  mismatch.globalThis = mismatch;
  vm.createContext(mismatch);
  vm.runInContext(fs.readFileSync(path.resolve(root, 'lwcs/BattleRuntime_Module.js'), 'utf8'), mismatch);
}, /battle_runtime_decision_version_mismatch/, 'Runtime未拒绝错误Decision版本');
assert.equal(decision.parseSkillCosts({ 消耗: { 魂力: 1 } }).魂力, 1, '绝对消耗1被误解为100%');
assert.equal(decision.parseSkillCosts({ 消耗: { 魂力: '50%' } }).魂力, '50%', '比例消耗丢失百分号语义');
assert.equal(
  sandbox.__LWCS_BATTLE_PREVIEW__.deriveStateCombatEffect({ 状态: '中毒', 数值: '-5%' }).dot_damage_ratio,
  0.05,
  '伤害型状态没有归一化为持续生命损失',
);
assert.equal(
  Number(sandbox.__LWCS_BATTLE_PREVIEW__.deriveStateCombatEffect({ 状态: '位移限制', 数值: '-5%' }).dot_damage_ratio || 0),
  0,
  '非伤害控制状态被误算为持续伤害',
);
const resourceInvariantActor = {
  hp: 100, hp_max: 100, sp: 100, sp_max: 100, men: 100, men_max: 100,
  vit: 100, vit_max: 100, str: 70, def: 50, agi: 50, 状态: { 存活: true },
};
const resourceInvariantTarget = {
  hp: 100, hp_max: 100, sp: 100, sp_max: 100, men: 100, men_max: 100,
  vit: 100, vit_max: 100, str: 70, def: 50, agi: 50, 状态: { 存活: true },
};
const resourceInvariantEffect = { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击' };
const fullResourceDamage = sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(resourceInvariantEffect, resourceInvariantActor, resourceInvariantTarget);
resourceInvariantActor.sp = 1;
const depletedResourceDamage = sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(resourceInvariantEffect, resourceInvariantActor, resourceInvariantTarget);
assert.equal(depletedResourceDamage, fullResourceDamage, '当前剩余魂力被重复计入普通攻击伤害');
assert.ok(
  fullResourceDamage >= resourceInvariantTarget.hp_max * 0.07 &&
  fullResourceDamage <= resourceInvariantTarget.hp_max * 0.15,
  `同级50%基础攻击偏离合理生命比例:${fullResourceDamage}`,
);
assert.ok(
  sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(
    resourceInvariantEffect,
    { ...resourceInvariantActor, str: 100 },
    resourceInvariantTarget,
  ) > fullResourceDamage,
  '提高攻击属性没有提高实际伤害',
);
assert.ok(
  sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(
    resourceInvariantEffect,
    resourceInvariantActor,
    { ...resourceInvariantTarget, def: 100 },
  ) < fullResourceDamage,
  '提高目标防御没有降低实际伤害',
);
assert.ok(
  sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(
    resourceInvariantEffect,
    { ...resourceInvariantActor, str: 300, sp_max: 500 },
    resourceInvariantTarget,
  ) > fullResourceDamage,
  '显著实力差没有形成更高伤害',
);
const unrestrictedHit = sandbox.__LWCS_BATTLE_PREVIEW__.estimateHitProbability(resourceInvariantActor, resourceInvariantTarget, resourceInvariantEffect);
resourceInvariantTarget.状态效果 = {
  位移限制: { 状态: '位移限制', 战斗效果: sandbox.__LWCS_BATTLE_PREVIEW__.deriveStateCombatEffect({ 状态: '位移限制', 数值: '-5%' }) },
};
const restrictedHit = sandbox.__LWCS_BATTLE_PREVIEW__.estimateHitProbability(resourceInvariantActor, resourceInvariantTarget, resourceInvariantEffect);
assert.ok(restrictedHit > unrestrictedHit, '位移限制没有进入命中/闪避通道');
assert.equal(
  sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(resourceInvariantEffect, resourceInvariantTarget, resourceInvariantActor),
  sandbox.__LWCS_BATTLE_PREVIEW__.calculateBaseDamage(resourceInvariantEffect, { ...resourceInvariantTarget, 状态效果: {} }, resourceInvariantActor),
  '位移限制错误削弱了目标的主动攻击伤害',
);
assert.equal(
  sandbox.__LWCS_BATTLE_PREVIEW__.readCombatStat({ final: {}, 属性: { 力量: 77 } }, 'str'),
  77,
  '空缺final字段遮蔽了正式属性值',
);

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
  const result = inspectDecision({ worldSnapshot, actorId: 'ally-1', beliefState: { confidence: 0.5 }, seed: 7300 + size });
  assert.equal(JSON.stringify(worldSnapshot), before, `${size}v${size}正式决策修改输入`);
  assert.ok(result.candidateCount > 0 && result.paretoCount > 0, `${size}v${size}候选或Pareto为空`);
  const basicTargets = result.candidates.filter(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK').flatMap(candidate => candidate.declaration.targetIds);
  assert.equal(new Set(basicTargets).size, size, `${size}v${size}普通攻击目标池被截断`);
  const skillTargets = result.candidates.filter(candidate => candidate.skill?.id === 'attack-skill').flatMap(candidate => candidate.declaration.targetIds);
  assert.equal(new Set(skillTargets).size, size, `${size}v${size}技能目标池被截断`);
  assert.ok(!result.candidates.some(candidate => candidate.skill?.id === 'expensive-skill'), `${size}v${size}资源不足技能进入候选`);
  assert.ok(result.scoreAudit.length <= 3 && result.scoreAudit.some(item => item.selected), `${size}v${size}评分审计不满足选中项加两个替代项`);
  assert.ok(result.scoreAudit.every(item => item.classification && Number.isFinite(item.alternativeGap)), `${size}v${size}评分审计缺少分类或静态替代差距`);
  assert.ok(!['HARD_INVALID', 'DOMINATED'].includes(result.selected.classification), `${size}v${size}选中了禁止分类候选`);
  shapeResults.push({ shape: `${size}v${size}`, candidateCount: result.candidateCount, paretoCount: result.paretoCount, selected: result.selected.candidateId });
}

const deterministicWorld = world(3);
const first = inspectDecision({ worldSnapshot: deterministicWorld, actorId: 'ally-1', beliefState: { confidence: 0.4 }, seed: 99 });
const second = inspectDecision({ worldSnapshot: deterministicWorld, actorId: 'ally-1', beliefState: { confidence: 0.4 }, seed: 99 });
assert.equal(first.selected.candidateId, second.selected.candidateId, '同输入同种子选择不确定');
assert.equal(JSON.stringify(first.scoreAudit), JSON.stringify(second.scoreAudit), '同输入同种子评分审计不确定');
const classificationProbe = decision.classifyCandidateEvidence([
  { candidateId: 'best', objectiveUtility: 10, normalizedUtility: 1, vector: {} },
  { candidateId: 'inferior', objectiveUtility: 0, normalizedUtility: 0, vector: {} },
]);
assert.equal(classificationProbe.find(candidate => candidate.candidateId === 'inferior')?.classification, 'TACTICAL_ERROR', '合法次优候选没有归入TACTICAL_ERROR');

const formalSummonWorld = buildWeixiaofengFormalCase(sandbox.__LWCS_内置角色库__);
const formalSummonDecision = inspectDecision({
  worldSnapshot: formalSummonWorld,
  actorId: '韦小枫',
  beliefState: { confidence: 0.5 },
  battleIntent: { mode: '点到为止' },
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  seed: 730031,
});
const formalBasic = formalSummonDecision.candidates.find(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK');
const formalPoison = formalSummonDecision.candidates.find(candidate =>
  candidate.declaration.actionKind === 'RELEASE_SKILL' &&
  (candidate.skill?._效果数组 || []).some(effect => String(effect?.状态 || '').trim() === '中毒')
);
const formalSummon = formalSummonDecision.candidates.find(candidate =>
  candidate.declaration.actionKind === 'RELEASE_SKILL' &&
  (candidate.preview?.scheduledEvents || []).some(event => event.type === 'SUMMON_CREATE')
);
assert.ok(formalBasic && formalPoison && formalSummon, '正式行为对照缺少普攻、中毒或召唤候选');
assert.ok(
  formalPoison.preview?.contributions?.some(entry =>
    entry.outcomeKind === 'STATE_CHANGED' &&
    Number(sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(formalPoison.preview.afterSnapshot, '唐凌雪')?.状态效果?.[Object.keys(sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(formalPoison.preview.afterSnapshot, '唐凌雪')?.状态效果 || {}).find(key => key.includes('中毒'))]?.战斗效果?.dot_damage_ratio || 0) > 0
  ),
  '正式中毒魂技预估没有携带可结算的持续伤害',
);
assert.ok(Number.isFinite(formalSummon.objectiveUtility), '正式召唤候选缺少可比较的客观效用');
assert.ok(
  formalSummon.preview?.contributions?.some(entry => entry.outcomeKind === 'SUMMON_WINDOW') &&
  formalSummon.preview?.scheduledEvents?.some(event =>
    event.type === 'SUMMON_CREATE' &&
    String(event.actionMode || '').trim() &&
    Number(event.duration || 0) > 0
  ),
  '正式召唤候选没有用真实行动窗口支撑其边际收益',
);

const confused = inspectDecision({ worldSnapshot: world(3), actorId: 'ally-1', beliefState: { confidence: 0.4, targetInterferencePossible: true }, seed: 100 });
const confusedAttackTargets = confused.candidates.filter(candidate => candidate.skill?.id === 'attack-skill').flatMap(candidate => candidate.declaration.targetIds);
assert.ok(confusedAttackTargets.includes('ally-2') && confusedAttackTargets.includes('enemy-3'), '潜在索敌干扰未保留友敌完整目标通道');

const fullHealthWorld = world(1);
fullHealthWorld.参战者.ally[0].hp = 100;
const fullHealth = inspectDecision({ worldSnapshot: fullHealthWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 101 });
const fullHealthHeal = fullHealth.candidates.find(candidate => candidate.skill?.id === 'heal-skill');
assert.equal(fullHealthHeal?.rejectionCode, 'ZERO_EFFECT_COSTLY', '满血有成本治疗未被识别为零收益');
assert.equal(fullHealthHeal?.classification, 'HARD_INVALID', '零收益有成本动作未归入HARD_INVALID');
assert.equal(fullHealthHeal?.preview?.contributions.filter(entry => entry.outcomeKind === 'RESOURCE_OPTION_CHANGED').length, 1, '治疗技能消耗未记录独立资源事实');
assert.equal(fullHealthHeal?.preview?.contributions.filter(entry => entry.outcomeKind === 'HP_DELTA').length, 1, '满血治疗未保留零边际生命事实');

const costlyWorld = world(1);
costlyWorld.参战者.ally[0].技能列表 = [{
  id: 'bankrupt-skill', name: '资源破产技能', 消耗: '魂力:95',
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 45, 伤害类型: '近身攻击' }],
}, attackSkill];
const costly = inspectDecision({ worldSnapshot: costlyWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 102 });
const bankrupt = costly.candidates.find(candidate => candidate.skill?.id === 'bankrupt-skill');
assert.equal(sandbox.__LWCS_BATTLE_PREVIEW__.readResource(sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(bankrupt.preview.afterSnapshot, 'ally-1'), '魂力'), 5, '技能成本未进入覆盖层资源终态');

const survivalWorld = world(1);
survivalWorld.参战者.ally[0].hp = 5;
survivalWorld.参战者.ally[0].技能列表 = [attackSkill];
survivalWorld.参战者.enemy[0].hp = 1000;
survivalWorld.参战者.enemy[0].hp_max = 1000;
survivalWorld.参战者.enemy[0].str = 500;
survivalWorld.参战者.enemy[0].def = 500;
survivalWorld.参战者.enemy[0].level = 90;
survivalWorld.参战者.ally[0].agi = 500;
survivalWorld.参战者.enemy[0].agi = 20;
const survivalDecision = inspectDecision({
  worldSnapshot: survivalWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '求生' },
  beliefState: { confidence: 1 },
  seed: 103,
});
assert.equal(survivalDecision.selected.declaration.actionKind, 'WITHDRAW', '高把握撤离的濒死求生场景仍选择主动攻击');
assert.ok(survivalDecision.candidates.find(candidate => candidate.declaration.actionKind === 'WITHDRAW' && candidate.objectiveUtility > 30), '撤退没有获得保命窗口价值');

const asymmetricSurvivalWorld = world(1);
asymmetricSurvivalWorld.战斗意图 = '求生';
asymmetricSurvivalWorld.参战者 = {
  team_player: asymmetricSurvivalWorld.参战者.ally,
  team_enemy: asymmetricSurvivalWorld.参战者.enemy,
};
const pursuingEnemyDecision = inspectDecision({ worldSnapshot: asymmetricSurvivalWorld, actorId: 'enemy-1', beliefState: { confidence: 1 }, seed: 1031 });
assert.ok(!pursuingEnemyDecision.candidates.some(candidate => candidate.declaration.actionKind === 'WITHDRAW'), '玩家求生意图被错误共享给追击方');
const escapingPlayerDecision = inspectDecision({ worldSnapshot: asymmetricSurvivalWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 1032 });
assert.ok(escapingPlayerDecision.candidates.some(candidate => candidate.declaration.actionKind === 'WITHDRAW'), '正式战斗意图没有从worldSnapshot进入玩家决策');

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
const chargedThreatDecision = inspectDecision({
  worldSnapshot: chargedThreatWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 106,
});
assert.ok(['DEFEND', 'EVADE'].includes(chargedThreatDecision.selected.declaration.actionKind), '低血量面对公开致命蓄力仍用无效攻击换取1点伤害');
const chargedThreatAttack = chargedThreatDecision.candidates.find(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK');
assert.ok(
  chargedThreatDecision.selected.objectiveUtility > chargedThreatAttack.objectiveUtility &&
  chargedThreatDecision.selected.vector.expectedStateGain > chargedThreatAttack.vector.expectedStateGain &&
  chargedThreatDecision.selected.vector.catastrophicRisk < chargedThreatAttack.vector.catastrophicRisk,
  '避免公开致命终态没有形成相对进攻更高的防守效用',
);
chargedThreatWorld.参战者.ally[0].__battleRuntime = {
  activeDefenseStance: { type: chargedThreatDecision.selected.declaration.actionKind, stateName: '已准备防守窗口' },
};
const preparedThreatDecision = inspectDecision({
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
const delayedThreatDecision = inspectDecision({
  worldSnapshot: chargedThreatWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 108,
});
assert.ok(!['DEFEND', 'EVADE'].includes(delayedThreatDecision.selected.declaration.actionKind), '防守窗口会在蓄力兑现前过期却仍提前防守');
assert.ok(delayedThreatDecision.candidates.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate.declaration.actionKind)).every(candidate => candidate.rejectionCode === 'ZERO_PROGRESS'), '过早防守没有按真实窗口归零');

const interruptPriorityWorld = world(2);
interruptPriorityWorld.参战者.ally[0].技能列表 = [{
  id: 'generic-interrupt',
  name: '通用打断',
  消耗: { 魂力: 5 },
  _效果数组: [{
    原型: '状态施加',
    目标: '单体',
    状态: '僵直',
    持续回合: 1,
    成功率: '100%',
    计算层效果: { skip_turn: true },
  }],
}];
interruptPriorityWorld.参战者.enemy[0].蓄力技能 = {
  id: 'visible-nonlethal-charge',
  cast_time: 20,
  skill: {
    id: 'visible-nonlethal-charge-skill',
    name: '已显露高伤蓄力',
    _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 220, 伤害类型: '近身攻击' }],
  },
};
const interruptPriorityDecision = inspectDecision({
  worldSnapshot: interruptPriorityWorld,
  actorId: 'ally-1',
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 1081,
});
const interruptChargeSource = interruptPriorityDecision.candidates.find(candidate =>
  candidate.skill?.id === 'generic-interrupt' && candidate.declaration.targetIds.includes('enemy-1')
);
const interruptOtherTarget = interruptPriorityDecision.candidates.find(candidate =>
  candidate.skill?.id === 'generic-interrupt' && candidate.declaration.targetIds.includes('enemy-2')
);
assert.ok(
  interruptChargeSource.objectiveUtility > interruptOtherTarget.objectiveUtility &&
  interruptChargeSource.deepAnalysis.expectedResponseDeltaUtility > interruptOtherTarget.deepAnalysis.expectedResponseDeltaUtility,
  `公开高伤蓄力的打断价值没有高于控制无关目标:${JSON.stringify({
    source: interruptChargeSource,
    other: interruptOtherTarget,
  })}`,
);

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
const falseReactionDecision = inspectDecision({
  worldSnapshot: falseReactionWorld,
  actorId: 'ally-1',
  actionOpportunity: { role: 'REACTION', sourceActorId: 'enemy-1', immediateBudget: 40 },
  beliefState: { confidence: 1 },
  seed: 105,
});
assert.ok(!falseReactionDecision.candidates.some(candidate => candidate.skill?.id === 'false-reaction'), '敌方闪避减益被误认成即时防御魂技');

const falseCounterDecision = inspectDecision({
  worldSnapshot: falseReactionWorld,
  actorId: 'ally-1',
  actionOpportunity: { role: 'COUNTER', sourceActorId: 'enemy-1', immediateBudget: 40 },
  beliefState: { confidence: 1 },
  seed: 1051,
});
assert.ok(!falseCounterDecision.candidates.some(candidate => candidate.skill?.id === 'false-reaction'), '普通主动攻击魂技被零消耗改造成反击技能');
assert.ok(falseCounterDecision.candidates.some(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK'), '反击池缺少基础反击动作');
const safeCounterDecline = falseCounterDecision.candidates.find(candidate => candidate.counterDeclineFallback === true);
assert.ok(['', 'DOMINATED'].includes(safeCounterDecline?.rejectionCode), '放弃额外反击机会没有保留为合法零成本基线');
assert.equal(Number(safeCounterDecline?.objectiveUtility || 0), 0, '放弃额外反击机会被错误附加未来回应风险');

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
const negativeActionDecision = inspectDecision({ worldSnapshot: negativeActionWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 104 });
const negativeAction = negativeActionDecision.candidates.find(candidate => candidate.skill?.id === 'negative-action');
assert.ok(['ZERO_PROGRESS', 'DOMINATED'].includes(negativeAction?.rejectionCode), '低收益高代价动作仍进入主观抽样池');
assert.ok(['HARD_INVALID', 'DOMINATED'].includes(negativeAction?.classification), '低收益高代价动作没有进入禁止分类');
assert.ok(!negativeActionDecision.candidates.some(candidate => candidate.rejectionCode === 'SELF_DEFEATING' && sandbox.__LWCS_BATTLE_PREVIEW__.isAlive(candidate.preview?.afterSnapshot ? sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(candidate.preview.afterSnapshot, 'ally-1') : {})), '未导致行动者失能的负效用动作被误判为自毁');

const ordinaryThreatDecision = inspectDecision({ worldSnapshot: world(1), actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 109 });
const ordinaryDefense = ordinaryThreatDecision.candidates.find(candidate => candidate.declaration.actionKind === 'DEFEND');
assert.ok(ordinaryDefense?.objectiveUtility > 0 && ordinaryDefense.rejectionCode !== 'ZERO_PROGRESS', `确定会到来的非致命回应没有形成基础防御价值:${JSON.stringify(ordinaryDefense)}`);

const lethalResponseWorld = world(1);
lethalResponseWorld.参战者.ally[0].技能列表 = [];
const lethalResponseDecision = inspectDecision({
  worldSnapshot: lethalResponseWorld,
  actorId: 'ally-1',
  beliefState: {
    confidence: 0.8,
    publicResponses: {
      'enemy-1': [{ responseId: 'known-lethal', baseActionValue: 100, weight: 1 }],
    },
  },
  seed: 10901,
});
const exposedAttack = lethalResponseDecision.candidates.find(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK');
const exposedEvade = lethalResponseDecision.candidates.find(candidate => candidate.declaration.actionKind === 'EVADE');
assert.equal(exposedAttack?.deepAnalysis?.required, true, '已知致命回应没有触发深推演');
assert.ok(exposedAttack.deepAnalysis.expectedResponseUtility < 0, '已知致命回应没有形成负回应效用');
assert.ok(exposedAttack.vector.catastrophicRisk > 0, `致命回应没有形成灾难尾部风险:${JSON.stringify(exposedAttack.deepAnalysis)}`);
assert.equal(exposedEvade?.deepAnalysis?.required, true, '防御候选逃避了同一自然回应基线');
assert.equal(exposedEvade.vector.catastrophicRisk, exposedAttack.vector.catastrophicRisk, '同一自然回应只惩罚了攻击候选');
assert.ok(exposedAttack.deepAnalysis.timeline.some(node => node.nodeType === 'ACTOR_NEXT_OPPORTUNITY'), '深推演时间线缺少行动者下一机会');
assert.ok(exposedAttack.deepAnalysis.nodeCount <= 12, '深推演超过12节点预算');

const teamLethalResponseDecision = inspectDecision({
  worldSnapshot: world(7),
  actorId: 'ally-1',
  beliefState: {
    confidence: 0.8,
    publicResponses: {
      'enemy-1': [{ responseId: 'known-lethal', baseActionValue: 100, weight: 1 }],
    },
  },
  seed: 10902,
});
const teamExposedAttack = teamLethalResponseDecision.candidates.find(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK');
assert.ok(
  teamExposedAttack.vector.catastrophicRisk < exposedAttack.vector.catastrophicRisk,
  '未知单体回应在团战中被复制为对每名单位的必然致命威胁',
);

const terminalOpportunityDecision = inspectDecision({
  worldSnapshot: lethalResponseWorld,
  actorId: 'ally-1',
  actionOpportunity: { role: 'ACTIVE', futureHostileResponseAllowed: false },
  beliefState: {
    confidence: 0.8,
    publicResponses: {
      'enemy-1': [{ responseId: 'known-lethal', baseActionValue: 100, weight: 1 }],
    },
  },
  seed: 10903,
});
const terminalOpportunityAttack = terminalOpportunityDecision.candidates.find(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK');
assert.equal(terminalOpportunityAttack?.vector.catastrophicRisk, 0, '回合上限后的最后行动仍承担不存在的未来回应风险');
assert.ok(terminalOpportunityDecision.selected.objectiveUtility >= 0, '终局最后行动被虚构的未来回应压成负效用');

const unfocusedTeamWorld = world(3);
unfocusedTeamWorld.参战者.ally[0].hp = 100;
const unfocusedTeamDecision = inspectDecision({ worldSnapshot: unfocusedTeamWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 1091 });
const unfocusedEvade = unfocusedTeamDecision.candidates.find(candidate => candidate.declaration.actionKind === 'EVADE');
const unfocusedBestAttack = Math.max(...unfocusedTeamDecision.candidates
  .filter(candidate => ['BASIC_ATTACK', 'RELEASE_SKILL'].includes(candidate.declaration.actionKind) && !candidate.rejectionCode)
  .map(candidate => candidate.objectiveUtility));
assert.ok(unfocusedBestAttack > unfocusedEvade.objectiveUtility, '健康团队单位在无人针对时仍让主动闪避支配有效进攻');
assert.ok(!['DEFEND', 'EVADE'].includes(unfocusedTeamDecision.selected.declaration.actionKind), '健康团队单位在无人针对时仍主动空耗防守姿态');
unfocusedTeamWorld.__battleEventLedger = [{
  eventKind: 'action_start', round: 1, actorName: 'enemy-1', actorSide: 'enemy', targetName: 'ally-1', targetSide: 'ally',
}];
const focusedTeamDecision = inspectDecision({ worldSnapshot: unfocusedTeamWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 1092 });
const focusedEvade = focusedTeamDecision.candidates.find(candidate => candidate.declaration.actionKind === 'EVADE');
assert.ok(focusedEvade.objectiveUtility > unfocusedEvade.objectiveUtility, '真实受击焦点没有提高团队单位的防守价值');

const resourceNoUnlockWorld = world(2);
resourceNoUnlockWorld.参战者.ally[0].技能列表 = [{
  id: 'resource-no-unlock', name: '无解锁魂力支援', 消耗: { 魂力: 20 },
  _效果数组: [{ 原型: '资源变化', 目标: '单体', 资源: '魂力', 数值: '+10%' }],
}];
const resourceNoUnlockDecision = inspectDecision({ worldSnapshot: resourceNoUnlockWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 110 });
const resourceNoUnlock = resourceNoUnlockDecision.candidates.find(candidate => candidate.skill?.id === 'resource-no-unlock' && candidate.declaration.targetIds.includes('ally-2'));
assert.equal(resourceNoUnlock?.rejectionCode, 'ZERO_EFFECT_COSTLY', '未改善目标后续行为库的有成本资源支援仍可被抽样');

const refreshWasteWorld = world(1);
refreshWasteWorld.参战者.enemy[0].状态效果 = {
  敏捷修正: { 状态名称: '敏捷修正', duration: 1, 面板修改比例: { agi: 0.8 }, 战斗效果: {} },
};
refreshWasteWorld.参战者.ally[0].技能列表 = [{
  id: 'redundant-agility-refresh', name: '重复迟缓', 消耗: { 魂力: 10 },
  _效果数组: [{ 原型: '属性修正', 目标: '单体', 属性: '敏捷', 数值: '-20%', 持续回合: 1 }],
}];
const refreshWasteDecision = inspectDecision({ worldSnapshot: refreshWasteWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 111 });
const refreshWaste = refreshWasteDecision.candidates.find(candidate => candidate.skill?.id === 'redundant-agility-refresh');
const refreshedTarget = sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(refreshWaste.preview.afterSnapshot, 'enemy-1');
const projectedRefreshTarget = sandbox.__LWCS_BATTLE_PREVIEW__.findUnit(decision.buildDecisionWorld(refreshWasteWorld, 'ally-1', refreshWasteDecision.beliefState), 'enemy-1');
assert.equal(refreshWaste?.rejectionCode, 'ZERO_EFFECT_COSTLY', '未延长窗口的不可叠属性削弱刷新仍可被抽样');
assert.equal(sandbox.__LWCS_BATTLE_PREVIEW__.readCombatStat(refreshedTarget, 'agi'), sandbox.__LWCS_BATTLE_PREVIEW__.readCombatStat(projectedRefreshTarget, 'agi'), '预估把不可叠属性削弱刷新重复计入面板');

const mixedStateShieldWorld = world(1);
mixedStateShieldWorld.参战者.ally[0].状态效果 = {
  防御修正: { 状态名称: '防御修正', duration: 2, 面板修改比例: { def: 1.2 }, 战斗效果: {} },
};
mixedStateShieldWorld.参战者.ally[0].技能列表 = [{
  id: 'redundant-state-valid-shield', name: '重复强化与有效护盾', 消耗: { 魂力: 10 },
  _效果数组: [
    { 原型: '属性修正', 目标: '自身', 属性: '防御', 数值: '+20%', 持续回合: 2 },
    { 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '20%' },
  ],
}];
const mixedStateShieldDecision = inspectDecision({ worldSnapshot: mixedStateShieldWorld, actorId: 'ally-1', beliefState: { confidence: 1 }, seed: 112 });
const mixedStateShield = mixedStateShieldDecision.candidates.find(candidate => candidate.skill?.id === 'redundant-state-valid-shield');
assert.equal(mixedStateShield?.rejectionCode, '', `混合技能的重复状态错误否决了仍有效的护盾效果:${JSON.stringify(mixedStateShield)}`);
assert.ok(
  mixedStateShield.preview.contributions.some(entry =>
    entry.outcomeKind === 'SHIELD_DELTA' &&
    Number(entry?.evidence?.next || 0) > Number(entry?.evidence?.current || 0)
  ),
  '混合技能的有效护盾没有进入边际贡献',
);

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

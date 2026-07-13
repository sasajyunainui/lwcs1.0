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
for (const relativePath of ['lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const decision = sandbox.__LWCS_BATTLE_DECISION__;
assert.ok(decision, '正式决策运行时未加载');
const inspectDecision = input => {
  let candidates = [];
  const result = decision.decide({ ...input, inspectCandidates: value => { candidates = value; } });
  return { ...result, candidates };
};

const damageSkill = {
  id: 'damage', name: '公开攻击', 消耗: '魂力:10',
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 70, 伤害类型: '近身攻击' }],
};
const controlSkill = {
  id: 'control', name: '公开控制', 消耗: '魂力:12',
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: 0.65 }],
};

function unit(id, level, hp = 100) {
  return {
    id, name: id, level, 战斗经验: id === 'actor' ? 0.2 : undefined,
    hp, hp_max: 100, sp: 100, sp_max: 100, men: 70, men_max: 100, vit: 80, vit_max: 100,
    str: 70, def: 50, agi: 50, 状态: { 存活: true }, 技能列表: [damageSkill, controlSkill],
  };
}

function world() {
  return {
    回合: 1,
    参战者: {
      ally: [unit('actor', 50, 100), unit('ally-low', 48, 25)],
      enemy: [unit('enemy-low', 50, 20), unit('enemy-high', 90, 100)],
    },
  };
}

const initial = decision.buildInitialBelief(world(), 'actor', { confidence: 0.4 });
assert.ok(initial.units['enemy-high'].strengthRange[0] > initial.units['enemy-low'].strengthRange[1], '明显等级差未形成可区分实力区间');
assert.equal(initial.units['enemy-high'].resources, undefined, '敌方隐藏资源泄漏到认知');

const hiddenWeak = world();
hiddenWeak.参战者.enemy[0].技能列表 = [{ id: 'hidden-weak', _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 1, 伤害类型: '近身攻击' }] }];
hiddenWeak.参战者.enemy[0].sp = 0;
const hiddenStrong = structuredClone(hiddenWeak);
hiddenStrong.参战者.enemy[0].技能列表 = [{ id: 'hidden-lethal', _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 9999, 伤害类型: '真实攻击' }] }];
hiddenStrong.参战者.enemy[0].sp = 100;
const weakDecision = inspectDecision({ worldSnapshot: hiddenWeak, actorId: 'actor', beliefState: initial, seed: 81 });
const strongDecision = inspectDecision({ worldSnapshot: hiddenStrong, actorId: 'actor', beliefState: initial, seed: 81 });
assert.equal(weakDecision.selected.candidateId, strongDecision.selected.candidateId, '敌方隐藏技能或资源改变了选择');
assert.equal(
  JSON.stringify(weakDecision.candidates.map(candidate => [candidate.candidateId, candidate.objectiveUtility])),
  JSON.stringify(strongDecision.candidates.map(candidate => [candidate.candidateId, candidate.objectiveUtility])),
  '敌方隐藏技能或资源改变了客观效用',
);

const hiddenStats = structuredClone(hiddenWeak);
Object.assign(hiddenStats.参战者.enemy[0], {
  level: 88,
  str: 999,
  def: 777,
  agi: 666,
  抗性: { 控制: 1, 物理: 1 },
  final: { str: 9999, def: 9999, agi: 9999 },
});
hiddenStats.参战者.enemy[0].属性 = { 等级: 88, 力量: 999, 防御: 777, 敏捷: 666, 抗性: { 控制: 1 } };
const hiddenStatsDecision = inspectDecision({ worldSnapshot: hiddenStats, actorId: 'actor', beliefState: initial, seed: 81 });
assert.equal(
  JSON.stringify(weakDecision.candidates.map(candidate => [candidate.candidateId, candidate.objectiveUtility, candidate.rejectionCode])),
  JSON.stringify(hiddenStatsDecision.candidates.map(candidate => [candidate.candidateId, candidate.objectiveUtility, candidate.rejectionCode])),
  '敌方精确等级、属性或抗性绕过实力区间改变了决策',
);
const projectedEnemy = decision.buildDecisionWorld(hiddenStats, 'actor', initial).参战者.enemy[0];
assert.equal(projectedEnemy.抗性, undefined, '敌方隐藏抗性泄漏到决策投影');
assert.notEqual(projectedEnemy.level, hiddenStats.参战者.enemy[0].level, '决策投影直接读取敌方原始等级');

const keyInput = {
  sourceActionId: 'actor:skill:control:0',
  effectPrototype: '状态施加',
  targetId: 'enemy-low',
  relevantStateFingerprint: 'visible-state',
  estimatedProbability: 0.65,
  experience: 0.5,
};
const basePosterior = decision.mechanicPosterior({}, decision.mechanicKey(keyInput), 0.65, 0.5);
const successBelief = decision.updateMechanicBelief({ mechanics: {} }, { ...keyInput, success: true });
const successPosterior = decision.mechanicPosterior(successBelief, decision.mechanicKey(keyInput), 0.65, 0.5);
const failureBelief = decision.updateMechanicBelief({ mechanics: {} }, { ...keyInput, success: false });
const failurePosterior = decision.mechanicPosterior(failureBelief, decision.mechanicKey(keyInput), 0.65, 0.5);
assert.ok(successPosterior > basePosterior && failurePosterior < basePosterior, 'Beta观察未按成功/失败方向更新');
assert.equal(failureBelief.mechanics[decision.mechanicKey({ ...keyInput, targetId: 'enemy-high' })], undefined, 'Beta后验跨目标污染');

assert.equal(decision.unknownResponseMass(0), 0.35, '零置信未知回应质量错误');
assert.equal(decision.unknownResponseMass(1), 0, '满置信仍保留未知回应质量');

const responseBelief = decision.buildInitialBelief(world(), 'actor', {
  confidence: 0.2,
  publicResponses: {
    'enemy-low': Array.from({ length: 8 }, (_, index) => ({ responseId: `response-${index}`, utility: 10 - index, baseActionValue: 20 + index })),
  },
});
const deepDecision = inspectDecision({ worldSnapshot: world(), actorId: 'actor', beliefState: responseBelief, seed: 82 });
const controlCandidate = deepDecision.candidates.find(candidate => candidate.skill?.id === 'control' && candidate.declaration.targetIds.includes('enemy-low'));
assert.equal(controlCandidate?.deepAnalysis?.required, true, '控制行动权变化未触发深推演');
assert.ok(controlCandidate.deepAnalysis.nodeCount <= 12, '深推演超过12节点');
assert.ok(controlCandidate.deepAnalysis.responseBranches[0]?.unknown, '未知威胁包络未优先进入深推演');
assert.ok(controlCandidate.deepAnalysis.responseBranches.length <= 3, '回应分支总数超过3个');
assert.ok(controlCandidate.deepAnalysis.responseBranches.reduce((sum, branch) => sum + branch.probability, 0) >= 0.999, '回应分支概率质量被截断');
assert.ok(controlCandidate.deepAnalysis.timeline.some(node => /^RESULT_/.test(node.nodeType)), '深推演缺少成功/失败主结果分支');
assert.ok(controlCandidate.deepAnalysis.timeline.some(node => /RESPONSE/.test(node.nodeType)), '深推演缺少关键回应者节点');
assert.ok(controlCandidate.deepAnalysis.timeline.some(node => node.nodeType === 'FIRST_ALLY_WINDOW'), '建立控制窗口后未推演首名可利用队友');
assert.equal(controlCandidate.deepAnalysis.timeline.at(-1)?.nodeType, 'ACTOR_NEXT_OPPORTUNITY', '深推演未到行动者下一机会');

let adaptedBelief = deepDecision.beliefState;
const controlKeyInput = {
  sourceActionId: controlCandidate.candidateId,
  effectPrototype: '状态施加',
  targetId: 'enemy-low',
  relevantStateFingerprint: decision.relevantStateFingerprint(adaptedBelief, 'enemy-low'),
  estimatedProbability: 0.65,
  experience: 0.2,
};
for (let index = 0; index < 4; index += 1) adaptedBelief = decision.updateMechanicBelief(adaptedBelief, { ...controlKeyInput, success: false });
const adapted = inspectDecision({ worldSnapshot: world(), actorId: 'actor', beliefState: adaptedBelief, seed: 82 });
const adaptedControl = adapted.candidates.find(candidate => candidate.candidateId === controlCandidate.candidateId);
assert.ok(adaptedControl.deepAnalysis.mechanicProbability < controlCandidate.deepAnalysis.mechanicProbability, '连续控制失败未降低成功后验');
assert.ok(adaptedControl.objectiveUtility < controlCandidate.objectiveUtility, `连续控制失败未降低候选效用:${controlCandidate.objectiveUtility}->${adaptedControl.objectiveUtility}`);

assert.equal(deepDecision.teamIntent.focusTarget, 'enemy-low', '团队集火未选择最低剩余容量敌人');
assert.equal(deepDecision.teamIntent.protectTarget, 'ally-low', '团队保护未识别危急队友');
const publicWorld = world();
publicWorld.__battleEventLedger = [{ eventId: 'public-hit-1', eventKind: 'hit_result', actorName: 'enemy-high', targetName: 'ally-low', actorSide: 'enemy', targetSide: 'ally', round: 1 }];
const publicIntent = decision.buildTeamIntent(publicWorld, 'actor', initial);
assert.ok(publicIntent.evidenceEventIds.includes('public-hit-1'), '团队意图没有绑定公开事实证据');
const withStrategy = inspectDecision({ worldSnapshot: world(), actorId: 'actor', beliefState: responseBelief, strategyMemory: { targetIds: ['enemy-high'] }, seed: 82 });
assert.equal(
  JSON.stringify(deepDecision.candidates.map(candidate => [candidate.candidateId, candidate.objectiveUtility])),
  JSON.stringify(withStrategy.candidates.map(candidate => [candidate.candidateId, candidate.objectiveUtility])),
  '策略记忆修改了客观效用',
);
assert.equal(decision.activeStrategyMemory({ targetIds: ['missing'], expiresAtOpportunity: 9 }, world(), { sequence: 1 }, deepDecision.candidates).targetIds, undefined, '目标失效策略未清除');
assert.equal(decision.activeStrategyMemory({ targetIds: ['enemy-low'], expiresAtOpportunity: 1 }, world(), { sequence: 2 }, deepDecision.candidates).targetIds, undefined, '过期策略未清除');
assert.equal(decision.activeStrategyMemory({ targetIds: ['enemy-low'], expectedOutcomeKinds: ['ACTION_CANCELLED'], expiresAtOpportunity: 9 }, world(), { sequence: 2 }, deepDecision.candidates).targetIds, undefined, '预期控制未兑现的策略仍被保留');

const problemWorld = world();
problemWorld.参战者.ally[0].hp = 20;
problemWorld.参战者.ally[1].hp = 20;
problemWorld.参战者.enemy[0].hp = 10;
problemWorld.参战者.enemy[0].蓄力技能 = { ...damageSkill, cast_time: 30 };
problemWorld.参战者.enemy[1].状态效果 = { stun: { 状态: '眩晕', duration: 1, 战斗效果: { cannot_act: true } } };
const requiredProblemIds = new Set([
  'TERMINAL_OPPORTUNITY', 'SURVIVAL_CRISIS', 'IMMINENT_DENIAL', 'ALLY_CRISIS',
  'CAPABILITY_SHORTAGE', 'ADVANTAGE_WINDOW', 'INFORMATION_DEFICIT',
  'DISENGAGE_PRESSURE', 'NEUTRAL_PROGRESS', 'STALEMATE',
]);
const neutralWorld = world();
neutralWorld.参战者.ally[1].hp = 100;
neutralWorld.参战者.enemy[0].hp = 100;
const neutralBelief = decision.buildInitialBelief(neutralWorld, 'actor', { confidence: 0.9 });
const observedProblemIds = new Set([
  ...decision.identifyProblems(problemWorld, 'actor', { ...initial, confidence: 0.1 }, { battleIntent: { mode: '求生', withdrawAllowed: true }, stalemate: true, forceCapabilityShortage: true }).map(item => item.problemId),
  ...decision.identifyProblems(neutralWorld, 'actor', neutralBelief, {}).map(item => item.problemId),
]);
assert.deepEqual([...requiredProblemIds].filter(id => !observedProblemIds.has(id)), [], '局势问题类型存在不可达缺口');

console.log(JSON.stringify({
  summary: {
    hiddenLeakChecks: 5,
    betaDirectionChecks: 3,
    deepPreviewNodeCount: controlCandidate.deepAnalysis.nodeCount,
    unknownBranchCount: controlCandidate.deepAnalysis.responseBranches.filter(branch => branch.unknown).length,
    teamIntentChecks: 3,
    problemTypeChecks: requiredProblemIds.size,
    passed: true,
  },
}, null, 2));

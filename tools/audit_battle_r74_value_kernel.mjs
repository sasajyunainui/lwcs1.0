import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const sandbox = {
  console, structuredClone, Math: Object.create(Math), Date, JSON, Array, Object, String, Number, Boolean,
  RegExp, Map, Set, WeakMap, WeakSet, Symbol, parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams,
  TextEncoder, TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const relativePath of [
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
]) vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;

function attackSkill(id, cost, power = 100) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: cost },
    _效果数组: [{ effectId: `${id}:damage`, 原型: '伤害结算', 目标: '单体', 威力倍率: power, 伤害类型: '近身攻击', 命中概率: 100 }],
  };
}

function controlSkill(id, duration) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 5 },
    _效果数组: [{ effectId: `${id}:control`, 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: duration, 成功率: 100 }],
  };
}

function supportSkill(id) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 10 },
    _效果数组: [{ effectId: `${id}:resource`, 原型: '资源变化', 目标: '单体', 资源: '魂力', 数值: '+50' }],
  };
}

function unit(id, side, overrides = {}) {
  return {
    id,
    name: id,
    名称: id,
    side,
    type: '强攻系',
    系别: '强攻系',
    hp: 500,
    hp_max: 500,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: 180,
    def: 100,
    agi: 100,
    属性: {
      等级: 50,
      HP: 500,
      HP上限: 500,
      魂力: 100,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 180,
      防御: 100,
      敏捷: 100,
      状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: [],
    ...overrides,
  };
}

function world(actorSkills, allySkills = []) {
  return {
    回合: 1,
    参战者: {
      team_player: [
        unit('actor', 'player', { 技能列表: actorSkills }),
        unit('ally', 'player', {
          sp: 50,
          属性: {
            等级: 50, HP: 500, HP上限: 500, 魂力: 50, 魂力上限: 100,
            精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100,
            力量: 180, 防御: 100, 敏捷: 90, 状态效果: {},
          },
          技能列表: allySkills,
        }),
      ],
      team_enemy: [unit('enemy', 'enemy', { 技能列表: [attackSkill('enemy-strike', 0, 90)] })],
    },
  };
}

const directActor = unit('direct-actor', 'player');
const directTarget = unit('direct-target', 'enemy');
const directDeclaration = { actionKind: 'RELEASE_SKILL', skill: attackSkill('direct', 10, 100) };
const directPotential = preview.calculateDirectPotential(directActor, directTarget, directDeclaration);
assert.ok(directPotential > 0, '直接潜力没有覆盖有效伤害');
assert.equal(preview.calculateSequencePotential({ firstOpportunityPotential: 40, secondOpportunityPotential: 20 }), 50, '两机会序列折扣错误');
assert.equal(preview.calculateTwoOpportunityCapacity({
  unit: directActor,
  survivalProbability: 0.5,
  firstOpportunityAvailability: 1,
  secondOpportunityAvailability: 0.5,
  firstOpportunityPotential: 40,
  secondOpportunityPotential: 20,
}), 22.5, '两机会容量公式错误');
assert.equal(preview.calculateAtomicActionPotential({
  directPotential: 20,
  contributions: [
    { outcomeKind: 'ACTION_CANCELLED', targetId: 'enemy' },
    { outcomeKind: 'ACTION_CANCELLED', targetId: 'enemy' },
  ],
  frozenDirectPotential: { enemy: 30 },
}), 50, '原子动作潜力重复计算同一取消机会');

const costWorld = world([
  attackSkill('cheap-strike', 10, 100),
  attackSkill('expensive-strike', 95, 100),
]);
const costBefore = JSON.stringify(costWorld);
const costScores = decision.scoreCandidatesNext({ worldSnapshot: costWorld, actorId: 'actor', seed: 740401 });
assert.equal(JSON.stringify(costWorld), costBefore, 'Next价值内核修改输入世界');
const cheap = costScores.find(candidate => candidate?.declaration?.skill?.id === 'cheap-strike' && candidate?.declaration?.targetIds?.includes('enemy'));
const expensive = costScores.find(candidate => candidate?.declaration?.skill?.id === 'expensive-strike' && candidate?.declaration?.targetIds?.includes('enemy'));
assert.ok(cheap && expensive, '资源连续性案例缺少高低消耗候选');
assert.ok(cheap.objectiveUtility > expensive.objectiveUtility, `高消耗未因两机会行为库收缩而降分:${cheap.objectiveUtility}/${expensive.objectiveUtility}`);
assert.equal(
  cheap.objectiveUtility,
  100 * (
    cheap.nextValueAudit.expectedAfterResponseUtility -
    cheap.nextValueAudit.expectedNoOpResponseUtility
  ) / Math.max(1, cheap.nextValueAudit.before.total),
  'Next客观分在状态容量差量外重复加值'
);

const controlWorld = world([controlSkill('short-control', 1), controlSkill('long-control', 2)]);
const controlScores = decision.scoreCandidatesNext({ worldSnapshot: controlWorld, actorId: 'actor', seed: 740402 });
const shortControl = controlScores.find(candidate => candidate?.declaration?.skill?.id === 'short-control');
const longControl = controlScores.find(candidate => candidate?.declaration?.skill?.id === 'long-control');
assert.ok(shortControl && longControl, '控制窗口案例缺少候选');
assert.ok(shortControl.objectiveUtility > 0, '覆盖下一真实机会的控制没有容量收益');
assert.ok(longControl.objectiveUtility > shortControl.objectiveUtility, '覆盖两个机会的控制没有高于单机会控制');

const noConsumerScores = decision.scoreCandidatesNext({
  worldSnapshot: world([supportSkill('support-no-consumer')], []),
  actorId: 'actor',
  seed: 740403,
});
const noConsumer = noConsumerScores.find(candidate =>
  candidate?.declaration?.skill?.id === 'support-no-consumer' &&
  candidate?.declaration?.targetIds?.includes('ally')
);
assert.ok(noConsumer, '无消费者资源支援候选缺失');
assert.ok(noConsumer.objectiveUtility <= 0 && noConsumer.rejectionCode === 'ZERO_EFFECT_COSTLY', '无消费者资源回复仍被视为正收益');

const unlockScores = decision.scoreCandidatesNext({
  worldSnapshot: world([supportSkill('support-unlock')], [attackSkill('ally-burst', 80, 180)]),
  actorId: 'actor',
  seed: 740404,
});
const unlock = unlockScores.find(candidate =>
  candidate?.declaration?.skill?.id === 'support-unlock' &&
  candidate?.declaration?.targetIds?.includes('ally')
);
assert.ok(unlock, '资源解锁支援候选缺失');
assert.ok(unlock.objectiveUtility > noConsumer.objectiveUtility, '减少资源消费者没有降低资源回复价值');
assert.ok(unlock.nextValueAudit.after.own > unlock.nextValueAudit.before.own, '资源支援没有通过行为库解锁改变容量');

const context = decision.buildNextValueContext(costWorld, 'player', {});
assert.ok(Object.values(context.catalogs).every(catalog => catalog.length <= 3), '冻结动作目录超过每机会三个非支配动作');
assert.ok(Object.values(context.frozenDirectPotential).every(Number.isFinite), '冻结直接潜力包含非有限值');
const reactionActor = costWorld.参战者.team_player[0];
const reactionSource = costWorld.参战者.team_enemy[0];
const ordinaryDefense = preview.calculateDefenseDamageMultiplier(reactionActor, reactionSource, false);
const preparedDefense = preview.calculateDefenseDamageMultiplier(reactionActor, reactionSource, true);
const ordinaryDodge = preview.calculateDodgeProbability(reactionActor, reactionSource, false);
const preparedDodge = preview.calculateDodgeProbability(reactionActor, reactionSource, true);
assert.ok(preparedDefense < ordinaryDefense, '主动防御没有形成高于临时反应的真实减伤');
assert.ok(preparedDodge > ordinaryDodge, '主动闪避没有形成高于临时反应的真实成功率');
assert.equal(preview.calculateReactionContest(reactionActor, reactionSource).probability, ordinaryDodge, 'Runtime与Preview反应概率真源不一致');

console.log(JSON.stringify({
  summary: {
    directPotential,
    cheapUtility: cheap.objectiveUtility,
    expensiveUtility: expensive.objectiveUtility,
    shortControlUtility: shortControl.objectiveUtility,
    longControlUtility: longControl.objectiveUtility,
    noConsumerUtility: noConsumer.objectiveUtility,
    unlockUtility: unlock.objectiveUtility,
    frozenUnitCount: Object.keys(context.catalogs).length,
    assertions: 20,
    passed: true,
  },
}, null, 2));

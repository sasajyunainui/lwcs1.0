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

function groupAttackSkill(id, cost, power = 100) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: cost },
    _效果数组: [{ effectId: `${id}:damage`, 原型: '伤害结算', 目标: '群体', 威力倍率: power, 伤害类型: '近身攻击', 命中概率: 100 }],
  };
}

function reactiveShieldSkill(id, ratio = 25) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: `${id}:shield`,
      原型: '护盾变化',
      目标: '自身',
      护盾模式: '正向护盾',
      数值: `+${ratio}%`,
      持续回合: 1,
    }],
  };
}

function targetedShieldSkill(id, target, ratio = 25) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 0 },
    _效果数组: [{
      effectId: `${id}:shield`,
      原型: '护盾变化',
      目标: target,
      护盾模式: '正向护盾',
      数值: `+${ratio}%`,
      持续回合: 1,
    }],
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

function creationSkill(id) {
  return {
    id,
    name: id,
    魂技名: id,
    承载方式: '造物承载',
    消耗: { 魂力: 10 },
    前摇: 10,
    _效果数组: [{
      effectId: `${id}:create`,
      物品类型: '食物',
      数量: 1,
      使用效果: [
        { effectId: `${id}:heal`, 原型: '资源变化', 目标: '自身', 资源: '生命', 数值: '+40%' },
        { effectId: `${id}:stamina`, 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+40%' },
      ],
    }],
  };
}

function recoveryItem(id) {
  return {
    id,
    name: id,
    名称: id,
    来源: 'test-creation',
    数量: 1,
    使用效果: [
      { effectId: `${id}:heal`, 原型: '资源变化', 目标: '自身', 资源: '生命', 数值: '+40%' },
      { effectId: `${id}:stamina`, 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+40%' },
    ],
  };
}

function summonSkill(id, strength = 0.6) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: 10 },
    _效果数组: [{
      effectId: `${id}:summon`,
      原型: '召唤生成',
      目标: '自身',
      召唤物名称: `${id}-unit`,
      召唤单位类型: '其他召唤生物',
      行动模式: '协同攻击',
      持续回合: 1,
      强度: strength,
      数量: 1,
    }],
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

function duelWorld(actorSkills, enemyOverrides = {}) {
  return {
    回合: 1,
    参战者: {
      team_player: [unit('actor', 'player', {
        技能列表: actorSkills,
        agi: 120,
        属性: { ...unit('actor-base', 'player').属性, 敏捷: 120 },
      })],
      team_enemy: [unit('enemy', 'enemy', {
        技能列表: [attackSkill('enemy-strike', 0, 90)],
        ...enemyOverrides,
      })],
    },
  };
}

const directActor = unit('direct-actor', 'player');
const directTarget = unit('direct-target', 'enemy');
const directDeclaration = { actionKind: 'RELEASE_SKILL', skill: attackSkill('direct', 10, 100) };
const directPotential = preview.calculateDirectPotential(directActor, directTarget, directDeclaration);
assert.ok(directPotential > 0, '直接潜力没有覆盖有效伤害');
assert.equal(
  preview.calculateDirectPotential(
    directActor,
    directTarget,
    {
      actionKind: 'RELEASE_SKILL',
      skill: reactiveShieldSkill('capped-shield', 50),
      shieldAbsorptionCap: 40,
    },
  ),
  8,
  '护盾直接潜力没有按预计可吸收上限截断',
);
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
assert.equal(preview.calculateAtomicActionPotential({
  directPotential: 0,
  contributions: [{
    outcomeKind: 'RESOURCE_OPTION_CHANGED',
    targetId: 'direct-actor',
    evidence: { resource: '魂力', delta: -10 },
  }],
  frozenDirectPotential: { 'direct-actor': 40 },
}), 0, '支付资源被错误计为行为库解锁');

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

const focusedShieldWorld = {
  ...world([
    targetedShieldSkill('group-shield', '群体', 40),
    targetedShieldSkill('focus-shield', '单体', 40),
  ]),
  胜负条件: {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 4,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ type: 'ROUND_REACHED', side: 'PLAYER', round: 4, requireActive: true }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'UNIT_INCAPACITATED', side: 'PLAYER', targetIds: ['ally'], scope: 'ANY' }] },
  },
};
const focusedShieldScores = decision.scoreCandidatesNext({
  worldSnapshot: focusedShieldWorld,
  actorId: 'actor',
  battleIntent: focusedShieldWorld.胜负条件,
  seed: 7404011,
});
const groupShield = focusedShieldScores.find(candidate =>
  candidate?.declaration?.skill?.id === 'group-shield'
);
const focusedShield = focusedShieldScores.find(candidate =>
  candidate?.declaration?.skill?.id === 'focus-shield' &&
  candidate?.declaration?.targetIds?.includes('ally')
);
assert.ok(groupShield && focusedShield, '护盾目标压力案例缺少群体或单体候选');
assert.ok(
  Number(groupShield?.atomicActionPotential || 0) <= Number(focusedShield?.atomicActionPotential || 0) + 0.001,
  `未被目标锁定的队友护盾仍被完整计值:${groupShield?.atomicActionPotential}/${focusedShield?.atomicActionPotential}`,
);
assert.ok(
  Number(groupShield?.objectiveUtility || 0) <= Number(focusedShield?.objectiveUtility || 0) + 0.5,
  `保护目标之外的群体护盾仍显著抬高总分:${groupShield?.objectiveUtility}/${focusedShield?.objectiveUtility}`,
);

const controlWorld = world([controlSkill('short-control', 1), controlSkill('long-control', 2)]);
const controlScores = decision.scoreCandidatesNext({ worldSnapshot: controlWorld, actorId: 'actor', seed: 740402 });
const shortControl = controlScores.find(candidate => candidate?.declaration?.skill?.id === 'short-control');
const longControl = controlScores.find(candidate => candidate?.declaration?.skill?.id === 'long-control');
assert.ok(shortControl && longControl, '控制窗口案例缺少候选');
assert.ok(shortControl.objectiveUtility > 0, '覆盖下一真实机会的控制没有容量收益');
assert.ok(longControl.objectiveUtility > shortControl.objectiveUtility, '覆盖两个机会的控制没有高于单机会控制');
assert.ok(
  shortControl.repeatedActionAudit.controlWindowRealizability.reasonsByTarget.enemy.some(reason => reason.startsWith('ALLY_WINDOW:')),
  '队友可利用的控制窗口没有记录兑现者',
);

const emptyLockWorld = duelWorld([controlSkill('empty-lock', 1), attackSkill('progress-strike', 0, 100)]);
const emptyLockScores = decision.scoreCandidatesNext({ worldSnapshot: emptyLockWorld, actorId: 'actor', seed: 740406 });
const emptyLock = emptyLockScores.find(candidate => candidate?.declaration?.skill?.id === 'empty-lock');
const progressStrike = emptyLockScores.find(candidate => candidate?.declaration?.skill?.id === 'progress-strike');
assert.ok(emptyLock && progressStrike, '一对一空转锁控案例缺少候选');
assert.equal(emptyLock.repeatedActionAudit.newlyDeniedOpportunityIds.length, 0, '无人兑现的控制仍计入取消机会价值');
assert.ok(
  emptyLock.repeatedActionAudit.unrealizableDeniedOpportunityIds.length > 0,
  '无人兑现的控制没有进入不可兑现审计',
);
assert.ok(
  progressStrike.objectiveUtility > emptyLock.objectiveUtility,
  `一对一空转锁控仍压过推进动作:${progressStrike.objectiveUtility}/${emptyLock.objectiveUtility}`,
);

const chargeSkill = attackSkill('visible-charge', 0, 220);
chargeSkill.cast_time = 10;
chargeSkill.target_id = 'actor';
const interruptWorld = duelWorld(
  [controlSkill('interrupt-control', 1), attackSkill('unsafe-strike', 0, 100)],
  { 蓄力技能: chargeSkill },
);
const interruptScores = decision.scoreCandidatesNext({ worldSnapshot: interruptWorld, actorId: 'actor', seed: 740407 });
const interruptControl = interruptScores.find(candidate => candidate?.declaration?.skill?.id === 'interrupt-control');
assert.ok(interruptControl, '可见蓄力打断案例缺少控制候选');
assert.ok(
  interruptControl.repeatedActionAudit.controlWindowRealizability.reasonsByTarget.enemy.includes('VISIBLE_CHARGE_INTERRUPTED'),
  '可见蓄力打断没有保留控制兑现理由',
);
assert.ok(
  interruptControl.objectiveUtility > 0 && !interruptControl.rejectionCode,
  `可见蓄力打断被错误压死:${interruptControl.objectiveUtility}/${interruptControl.rejectionCode}`,
);

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

const summonWorld = duelWorld([summonSkill('summon-progress')]);
const summonWorldBefore = JSON.stringify(summonWorld);
const summonScores = decision.scoreCandidatesNext({
  worldSnapshot: summonWorld,
  actorId: 'actor',
  seed: 740408,
});
const summonProgress = summonScores.find(candidate => candidate?.declaration?.skill?.id === 'summon-progress');
assert.equal(JSON.stringify(summonWorld), summonWorldBefore, '召唤预估修改输入世界');
assert.ok(summonProgress, '召唤进展案例缺少候选');
const summonWindowContribution = summonProgress.preview.contributions.find(entry => entry?.outcomeKind === 'SUMMON_WINDOW');
const summonAssistDamage = summonProgress.preview.contributions.find(entry =>
  entry?.outcomeKind === 'HP_DELTA' &&
  String(entry?.effectInstanceId || '').includes(':summon-assist:')
);
assert.ok(
  Number(summonAssistDamage?.evidence?.expectedDamage || 0) > 0,
  `协同召唤预估没有在当前动作内兑现首次协同伤害:${JSON.stringify(summonProgress.preview.contributions)}`,
);
assert.ok(
  !preview.listUnits(summonProgress.preview.afterSnapshot).some(entry =>
    String(entry?.unit?.宿主名 || '').trim() === 'actor' &&
    String(entry?.unit?.行动模式 || '').trim() === '协同攻击'
  ),
  '持续1回合协同召唤消费首次窗口后仍残留未来容量',
);
assert.equal(summonWindowContribution?.evidence?.remainingWindows, 0, '持续1回合协同召唤没有在预估中消费首次窗口');
assert.equal(
  summonProgress.preview.contributions.filter(entry =>
    entry?.outcomeKind === 'HP_DELTA' &&
    String(entry?.effectInstanceId || '').includes(':summon-assist:')
  ).length,
  1,
  '协同召唤即时伤害没有形成唯一世界差量',
);
assert.ok(
  summonProgress.nextValueAudit.after.utility > summonProgress.nextValueAudit.before.utility &&
  summonProgress.objectiveUtility > 0 &&
  !summonProgress.rejectionCode,
  `拥有真实行动窗口的召唤没有形成正向局面差量:${summonProgress.objectiveUtility}/${summonProgress.rejectionCode}`,
);
assert.equal(
  summonProgress.nextValueAudit.valueAddedOutsideStateDelta,
  0,
  'SUMMON_WINDOW证据在世界差量之外重复增加了客观效用',
);

const persistentSummonWorld = duelWorld([{
  ...summonSkill('summon-persistent'),
  _效果数组: [{
    ...summonSkill('summon-persistent')._效果数组[0],
    持续回合: 2,
  }],
}]);
const persistentSummon = decision.scoreCandidatesNext({
  worldSnapshot: persistentSummonWorld,
  actorId: 'actor',
  seed: 740409,
}).find(candidate => candidate?.declaration?.skill?.id === 'summon-persistent');
const persistentPreviewUnit = preview.listUnits(persistentSummon?.preview?.afterSnapshot || {})
  .map(entry => entry.unit)
  .find(unit => String(unit?.宿主名 || '').trim() === 'actor' && String(unit?.行动模式 || '').trim() === '协同攻击');
assert.ok(persistentPreviewUnit, '持续2回合协同召唤消费首次窗口后没有保留后续实体');
assert.equal(Number(persistentPreviewUnit?.剩余窗口 || 0), 1, '持续2回合协同召唤没有只保留一个未来窗口');

const directSummonWorld = duelWorld([summonSkill('summon-direct')]);
const directSummonPreview = preview.previewAction({
  worldSnapshot: directSummonWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'summon-direct-action',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['actor'],
    skill: summonSkill('summon-direct'),
    resourceCosts: { 魂力: 10 },
  },
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
const directSummonDamage = directSummonPreview.contributions.find(entry =>
  entry?.outcomeKind === 'HP_DELTA' &&
  String(entry?.effectInstanceId || '').includes(':summon-assist:')
);
assert.ok(directSummonDamage, '协同召唤直接预估缺少即时伤害贡献');
assert.ok(
  Math.abs(
    Number(directSummonDamage.evidence.expectedDamage || 0) -
    Number(directSummonDamage.evidence.rawDamage || 0) *
      Number(directSummonDamage.evidence.hitProbability || 0)
  ) < 1e-9,
  '协同召唤即时伤害没有复用共享伤害与命中期望内核',
);

const noTargetSummonWorld = duelWorld([summonSkill('summon-no-target')]);
noTargetSummonWorld.参战者.team_enemy[0].hp = 0;
noTargetSummonWorld.参战者.team_enemy[0].属性.HP = 0;
noTargetSummonWorld.参战者.team_enemy[0].状态.存活 = false;
const noTargetSummonPreview = preview.previewAction({
  worldSnapshot: noTargetSummonWorld,
  actorId: 'actor',
  declaration: {
    actionId: 'summon-no-target-action',
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['actor'],
    skill: summonSkill('summon-no-target'),
    resourceCosts: { 魂力: 10 },
  },
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
assert.equal(
  noTargetSummonPreview.contributions.filter(entry =>
    entry?.outcomeKind === 'HP_DELTA' &&
    String(entry?.effectInstanceId || '').includes(':summon-assist:')
  ).length,
  0,
  '无合法目标的协同首窗凭空生成伤害',
);
assert.equal(
  noTargetSummonPreview.contributions.find(entry => entry?.outcomeKind === 'SUMMON_WINDOW')?.evidence?.remainingWindows,
  0,
  '无合法目标的协同首窗没有按规则消费',
);
assert.ok(
  !preview.listUnits(noTargetSummonPreview.afterSnapshot).some(entry => entry?.unit?.单位性质 === '召唤物'),
  '无合法目标的一回合协同召唤消费窗口后仍残留',
);

for (const actionMode of ['自主行动', '护卫']) {
  const modeSkill = summonSkill(`summon-mode-${actionMode}`);
  modeSkill._效果数组[0].行动模式 = actionMode;
  const modeWorld = duelWorld([modeSkill]);
  const modePreview = preview.previewAction({
    worldSnapshot: modeWorld,
    actorId: 'actor',
    declaration: {
      actionId: `summon-mode-${actionMode}-action`,
      actorId: 'actor',
      actionKind: 'RELEASE_SKILL',
      targetIds: ['actor'],
      skill: modeSkill,
      resourceCosts: { 魂力: 10 },
    },
    horizon: 'SHALLOW',
    previewBudget: { maxNodes: 12 },
  });
  const modeSummon = preview.listUnits(modePreview.afterSnapshot)
    .map(entry => entry.unit)
    .find(unit => unit?.单位性质 === '召唤物');
  assert.ok(modeSummon, `${actionMode}召唤被错误套用协同首窗消费`);
  assert.equal(Number(modeSummon?.剩余窗口 || 0), 1, `${actionMode}召唤的未来窗口被提前扣除`);
  assert.equal(
    modePreview.contributions.filter(entry =>
      entry?.outcomeKind === 'HP_DELTA' &&
      String(entry?.effectInstanceId || '').includes(':summon-assist:')
    ).length,
    0,
    `${actionMode}召唤被错误预演为即时协同攻击`,
  );
}

const context = decision.buildNextValueContext(costWorld, 'player', {});
assert.ok(Object.values(context.catalogs).every(catalog => catalog.length <= 3), '冻结动作目录超过每机会三个非支配动作');
assert.ok(Object.values(context.frozenDirectPotential).every(Number.isFinite), '冻结直接潜力包含非有限值');

const retargetWorld = world([]);
retargetWorld.参战者.team_enemy = [
  unit('enemy-a', 'enemy', { hp: 20, 属性: { ...unit('enemy-a-base', 'enemy').属性, HP: 20 } }),
  unit('enemy-b', 'enemy'),
];
const retargetScores = decision.scoreCandidatesNext({ worldSnapshot: retargetWorld, actorId: 'actor', seed: 740405 });
const finishingAttack = retargetScores.find(candidate =>
  candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
  candidate?.declaration?.targetIds?.includes('enemy-a')
);
assert.ok(finishingAttack, '目标替换案例缺少终结攻击候选');
assert.ok(
  finishingAttack.nextValueAudit.after.own >= finishingAttack.nextValueAudit.before.own * 0.95,
  `击倒当前目标错误清空了队伍对其他目标的行为库:${finishingAttack.nextValueAudit.before.own}/${finishingAttack.nextValueAudit.after.own}`,
);
assert.ok(finishingAttack.objectiveUtility > 0 && !finishingAttack.rejectionCode, `终结一个目标被错误视为负收益:${finishingAttack.objectiveUtility}/${finishingAttack.rejectionCode}`);

const groupRetargetWorld = world([groupAttackSkill('actor-group', 10, 100)], [groupAttackSkill('ally-group', 10, 100)]);
groupRetargetWorld.参战者.team_enemy.push(unit('enemy-b', 'enemy'));
const groupContext = decision.buildNextValueContext(groupRetargetWorld, 'team_player', {});
const groupCapacityBefore = decision.stateUtilityNext(groupRetargetWorld, 'team_player', {}, groupContext).own;
assert.ok(groupCapacityBefore > 0, `群攻目标替换案例没有形成基础容量:${JSON.stringify(groupContext)}`);
const groupRetargetAfter = structuredClone(groupRetargetWorld);
groupRetargetAfter.参战者.team_enemy[0].hp = 0;
groupRetargetAfter.参战者.team_enemy[0].属性.HP = 0;
groupRetargetAfter.参战者.team_enemy[0].状态.存活 = false;
const groupCapacityAfter = decision.stateUtilityNext(groupRetargetAfter, 'team_player', {}, groupContext).own;
assert.ok(
  groupCapacityAfter >= groupCapacityBefore * 0.95,
  `敌方减员错误反扣了己方冻结群攻容量:${groupCapacityBefore}/${groupCapacityAfter}`,
);

const reactionActor = costWorld.参战者.team_player[0];
const reactionSource = costWorld.参战者.team_enemy[0];
const ordinaryDefense = preview.calculateDefenseDamageMultiplier(reactionActor, reactionSource, false);
const preparedDefense = preview.calculateDefenseDamageMultiplier(reactionActor, reactionSource, true);
const ordinaryDodge = preview.calculateDodgeProbability(reactionActor, reactionSource, false);
const preparedDodge = preview.calculateDodgeProbability(reactionActor, reactionSource, true);
assert.ok(preparedDefense < ordinaryDefense, '主动防御没有形成高于临时反应的真实减伤');
assert.ok(preparedDodge > ordinaryDodge, '主动闪避没有形成高于临时反应的真实成功率');
assert.equal(preview.calculateReactionContest(reactionActor, reactionSource).probability, ordinaryDodge, 'Runtime与Preview反应概率真源不一致');

const counterRiskWorld = {
  回合: 1,
  参战者: {
    team_player: [unit('counter-risk-actor', 'player', {
      技能列表: [groupAttackSkill('counter-risk-group', 5, 35), attackSkill('counter-risk-single', 0, 100)],
    })],
    team_enemy: [
      unit('counter-risk-a', 'enemy'),
      unit('counter-risk-b', 'enemy'),
      unit('counter-risk-c', 'enemy'),
    ],
  },
};
const counterRiskBelief = decision.buildInitialBelief(counterRiskWorld, 'counter-risk-actor', {});
for (const targetId of ['counter-risk-a', 'counter-risk-b', 'counter-risk-c']) {
  counterRiskBelief.publicResponses[targetId] = [{
    responseId: 'REACTION:DEFEND:防御',
    responseRole: 'REACTION',
    responseRoles: ['REACTION'],
    actionName: '防御',
    declaration: { actorId: targetId, actionKind: 'DEFEND', targetIds: [targetId] },
    damageMultiplier: 0.58,
  }, {
    responseId: 'COUNTER:普通攻击',
    responseRole: 'COUNTER',
    responseRoles: ['COUNTER'],
    actionName: '普通攻击',
    baseActionValue: 20,
  }];
}
const counterRiskScores = decision.scoreCandidatesNext({
  worldSnapshot: counterRiskWorld,
  actorId: 'counter-risk-actor',
  beliefState: counterRiskBelief,
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740409,
});
const counterRiskGroup = counterRiskScores.find(candidate => candidate?.declaration?.skill?.id === 'counter-risk-group');
const counterRiskSingle = counterRiskScores.find(candidate => candidate?.declaration?.skill?.id === 'counter-risk-single');
assert.ok(counterRiskGroup && counterRiskSingle, '即时防反风险案例缺少群攻或单体候选');
assert.equal(counterRiskGroup.immediateReactionAudit?.length, 3, '群攻没有逐目标建立即时反应审计');
assert.ok(
  Number(counterRiskGroup.nextValueAudit?.immediateCounterExpectedThreat || 0) >
    Number(counterRiskSingle.nextValueAudit?.immediateCounterExpectedThreat || 0),
  `群攻刺激多个反击窗口却没有更高预期风险:${counterRiskGroup.nextValueAudit?.immediateCounterExpectedThreat}/${counterRiskSingle.nextValueAudit?.immediateCounterExpectedThreat}`,
);
assert.ok(
  Number(counterRiskGroup.nextValueAudit?.immediateCounterWorstTailThreat || 0) >
    Number(counterRiskSingle.nextValueAudit?.immediateCounterWorstTailThreat || 0),
  '群攻刺激多个反击窗口却没有更高最坏分支风险',
);
const counterRiskObservedHigh = structuredClone(counterRiskBelief);
counterRiskObservedHigh.publicResponses['counter-risk-a'][1].baseActionValue = 45;
const highCounterScores = decision.scoreCandidatesNext({
  worldSnapshot: counterRiskWorld,
  actorId: 'counter-risk-actor',
  beliefState: counterRiskObservedHigh,
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740410,
});
const highCounterGroup = highCounterScores.find(candidate => candidate?.declaration?.skill?.id === 'counter-risk-group');
assert.ok(
  Number(highCounterGroup?.nextValueAudit?.immediateCounterExpectedThreat || 0) >
    Number(counterRiskGroup.nextValueAudit?.immediateCounterExpectedThreat || 0),
  '观察到更高反击伤害后没有提高同一行为的即时风险',
);
assert.ok(
  Number(highCounterGroup?.objectiveUtility || 0) < Number(counterRiskGroup.objectiveUtility || 0),
  '观察到更高反击伤害后没有降低同一行为的客观效用',
);

const sharedReactionWorld = {
  回合: 1,
  参战者: {
    team_player: [
      unit('shared-reaction-actor', 'player'),
      unit('shared-reaction-ally-a', 'player', { agi: 90, 属性: { ...unit('shared-a-base', 'player').属性, 敏捷: 90 } }),
      unit('shared-reaction-ally-b', 'player', { agi: 80, 属性: { ...unit('shared-b-base', 'player').属性, 敏捷: 80 } }),
      unit('shared-reaction-ally-c', 'player', { agi: 70, 属性: { ...unit('shared-c-base', 'player').属性, 敏捷: 70 } }),
    ],
    team_enemy: [unit('shared-reaction-enemy', 'enemy', {
      hp: 150,
      agi: 60,
      属性: { ...unit('shared-enemy-base', 'enemy').属性, HP: 150, 敏捷: 60 },
      技能列表: [reactiveShieldSkill('shared-reactive-shield')],
    })],
  },
};
const sharedReactionBelief = decision.buildInitialBelief(sharedReactionWorld, 'shared-reaction-actor', {});
sharedReactionBelief.confidence = 1;
sharedReactionBelief.publicResponses['shared-reaction-enemy'] = [{
  responseId: 'REACTION:RELEASE_SKILL:shared-reactive-shield',
  responseRole: 'REACTION',
  responseRoles: ['REACTION'],
  actionName: 'shared-reactive-shield',
  declaration: {
    actorId: 'shared-reaction-enemy',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['shared-reaction-enemy'],
    skill: reactiveShieldSkill('shared-reactive-shield'),
  },
  damageMultiplier: 0.58,
  shieldRatio: 0.25,
}];
const sharedReactionScores = decision.scoreCandidatesNext({
  worldSnapshot: sharedReactionWorld,
  actorId: 'shared-reaction-actor',
  beliefState: sharedReactionBelief,
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740414,
});
const sharedReactionAttack = sharedReactionScores.find(candidate =>
  candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
  candidate?.declaration?.targetIds?.includes('shared-reaction-enemy')
);
assert.ok(sharedReactionAttack, '共享反应窗口案例缺少基础攻击候选');
assert.equal(
  Number(sharedReactionAttack?.nextValueAudit?.immediateCounterExpectedThreat || 0),
  0,
  '纯护盾反应技能被错误推导为额外反击授权',
);
assert.ok(
  Number(sharedReactionAttack?.nextValueAudit?.teamReactionSequence?.exploitActionCount || 0) >= 2,
  `一次性防御没有进入后续队友连续利用视野:${JSON.stringify(sharedReactionAttack?.nextValueAudit || {})}`,
);
assert.ok(
  Number(sharedReactionAttack.objectiveUtility || 0) > 0 && !sharedReactionAttack.rejectionCode,
  `多名队友可连续破防时首个进攻仍被判为零进展:${JSON.stringify({
    utility: sharedReactionAttack.objectiveUtility,
    rejectionCode: sharedReactionAttack.rejectionCode,
    audit: sharedReactionAttack.nextValueAudit,
  })}`,
);

const consumedReactionWorld = structuredClone(sharedReactionWorld);
Object.defineProperty(consumedReactionWorld, '__battleRuntime', {
  enumerable: false,
  configurable: true,
  writable: true,
  value: { unitReactionCount: { 'shared-reaction-enemy': 1 } },
});
const consumedReactionAttack = decision.scoreCandidatesNext({
  worldSnapshot: consumedReactionWorld,
  actorId: 'shared-reaction-actor',
  beliefState: sharedReactionBelief,
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740415,
}).find(candidate =>
  candidate?.declaration?.actionKind === 'BASIC_ATTACK' &&
  candidate?.declaration?.targetIds?.includes('shared-reaction-enemy')
);
assert.ok(consumedReactionAttack, '已消费反应窗口案例缺少基础攻击候选');
assert.equal(
  consumedReactionAttack.immediateReactionAudit?.length,
  0,
  '已消费反应窗口在有限认知投影后被再次预演',
);
assert.ok(
  Number(consumedReactionAttack.objectiveUtility || 0) > 0 && !consumedReactionAttack.rejectionCode,
  `已公开消费的反应窗口仍压低后续队友进攻:${consumedReactionAttack.objectiveUtility}/${consumedReactionAttack.rejectionCode}`,
);

const resourcePressureWorld = duelWorld([]);
resourcePressureWorld.参战者.team_player[0].hp = 120;
resourcePressureWorld.参战者.team_player[0].属性.HP = 120;
const resourcePressureBelief = decision.buildInitialBelief(resourcePressureWorld, 'actor', {});
const observedBaselineBelief = decision.updatePublicObservation(resourcePressureBelief, {
  sourceActorId: 'enemy',
  responseId: 'ACTIVE:observed-baseline',
  responseRole: 'ACTIVE',
  actionName: 'observed-baseline',
  baseActionValue: 0,
  hpDamageValue: 0,
});
const nonDamagePressureBelief = decision.updatePublicObservation(resourcePressureBelief, {
  sourceActorId: 'enemy',
  responseId: 'ACTIVE:resource-pressure',
  responseRole: 'ACTIVE',
  actionName: 'resource-pressure',
  baseActionValue: 80,
  hpDamageValue: 0,
});
const damagePressureBelief = decision.updatePublicObservation(resourcePressureBelief, {
  sourceActorId: 'enemy',
  responseId: 'ACTIVE:damage-pressure',
  responseRole: 'ACTIVE',
  actionName: 'damage-pressure',
  baseActionValue: 80,
  hpDamageValue: 45,
});
const baselinePressureOwn = decision.stateUtilityNext(
  decision.buildDecisionWorld(resourcePressureWorld, 'actor', observedBaselineBelief),
  'team_player',
  observedBaselineBelief,
).own;
const nonDamagePressureOwn = decision.stateUtilityNext(
  decision.buildDecisionWorld(resourcePressureWorld, 'actor', nonDamagePressureBelief),
  'team_player',
  nonDamagePressureBelief,
).own;
const damagePressureOwn = decision.stateUtilityNext(
  decision.buildDecisionWorld(resourcePressureWorld, 'actor', damagePressureBelief),
  'team_player',
  damagePressureBelief,
).own;
assert.equal(
  nonDamagePressureOwn,
  baselinePressureOwn,
  '资源压制被错误计入下一回应的生命致死威胁',
);
assert.ok(
  damagePressureOwn < nonDamagePressureOwn,
  '已观察到的生命伤害没有降低低生命单位的下一回应存活容量',
);

const nonTemporalDeadlineWorld = structuredClone(counterRiskWorld);
nonTemporalDeadlineWorld.回合 = 6;
nonTemporalDeadlineWorld.胜负条件 = {
  version: 1,
  explicit: true,
  startRound: 0,
  maxRounds: 6,
  resolutionPriority: 'DEFEAT_FIRST',
  victory: {
    logic: 'ANY',
    conditions: [{
      type: 'TEAM_INCAPACITATED',
      side: 'ENEMY',
      targetIds: [],
      scope: 'ALL',
      threshold: 0,
      round: 0,
      requireActive: true,
    }],
  },
  defeat: {
    logic: 'ANY',
    conditions: [{
      type: 'TEAM_INCAPACITATED',
      side: 'PLAYER',
      targetIds: [],
      scope: 'ALL',
      threshold: 0,
      round: 0,
      requireActive: true,
    }],
  },
};
const repeatedCounterBelief = structuredClone(counterRiskBelief);
for (const targetId of ['counter-risk-a', 'counter-risk-b', 'counter-risk-c']) {
  repeatedCounterBelief.publicResponses[targetId][1].baseActionValue = 45;
}
const nonTemporalDeadlineScores = decision.scoreCandidatesNext({
  worldSnapshot: nonTemporalDeadlineWorld,
  actorId: 'counter-risk-actor',
  beliefState: repeatedCounterBelief,
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740413,
});
const nonTemporalDeadlineGroup = nonTemporalDeadlineScores.find(candidate =>
  candidate?.declaration?.skill?.id === 'counter-risk-group');
const nonTemporalDeadlineSingle = nonTemporalDeadlineScores.find(candidate =>
  candidate?.declaration?.skill?.id === 'counter-risk-single');
assert.ok(nonTemporalDeadlineGroup && nonTemporalDeadlineSingle, '非时间型截止案例缺少群攻或单体候选');
assert.equal(Number(nonTemporalDeadlineGroup.vector?.objectiveProgress || 0), 0, '普通失能目标在最终回合重复追加目标进度分');
assert.equal(Number(nonTemporalDeadlineSingle.vector?.objectiveProgress || 0), 0, '普通单体伤害在最终回合重复追加目标进度分');
assert.ok(
  Number(nonTemporalDeadlineGroup.objectiveUtility || 0) < Number(nonTemporalDeadlineSingle.objectiveUtility || 0),
  `最终回合把已知高反击的低收益群攻重新合理化:${nonTemporalDeadlineGroup.objectiveUtility}/${nonTemporalDeadlineSingle.objectiveUtility}`,
);

const deadlineWorld = {
  回合: 6,
  胜负条件: {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{
        type: 'ROUND_REACHED',
        side: 'PLAYER',
        targetIds: [],
        scope: 'ANY',
        threshold: 0,
        round: 6,
        requireActive: true,
      }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{
        type: 'TEAM_INCAPACITATED',
        side: 'PLAYER',
        targetIds: [],
        scope: 'ALL',
        threshold: 0,
        round: 0,
        requireActive: true,
      }],
    },
  },
  参战者: {
    team_player: [unit('deadline-target', 'player', {
      hp: 300,
      hp_max: 500,
      vit: 20,
      vit_max: 100,
      属性: {
        ...unit('deadline-target-base', 'player').属性,
        HP: 300,
        HP上限: 500,
        体力: 20,
        体力上限: 100,
      },
      技能列表: [attackSkill('deadline-response', 0, 200)],
    })],
    team_enemy: [unit('deadline-actor', 'enemy', {
      技能列表: [attackSkill('deadline-strike', 0, 1)],
    })],
  },
};

const fusionStrike = groupAttackSkill('paired-fusion-strike', '50%', 120);
const fusionActor = unit('fusion-actor', 'player', {
  技能列表: [fusionStrike],
  __battleRuntime: {
    naturalOpportunity: { round: 1, status: 'CONSUMED', opportunityId: 'natural:1:player:fusion-actor:1' },
  },
});
fusionActor.武魂融合技 = {
  双人合击: {
    融合模式: 'partner',
    融合对象: 'fusion-partner',
    用法模式: '一次性释放',
    融合参与者: [
      { 类型: '自身', 角色键: 'fusion-actor', 角色名: 'fusion-actor' },
      { 类型: '搭档', 角色键: 'fusion-partner', 角色名: 'fusion-partner' },
    ],
    技能数据: fusionStrike,
  },
};
const fusionPartner = unit('fusion-partner', 'player', {
  技能列表: [],
  __battleRuntime: {
    naturalOpportunity: { round: 1, status: 'PENDING', opportunityId: 'natural:1:player:fusion-partner:2' },
  },
});
const fusionTarget = unit('fusion-target', 'enemy');
const fusionWorld = {
  回合: 1,
  参战者: {
    team_player: [fusionActor, fusionPartner],
    team_enemy: [fusionTarget],
  },
};
const fusionInputBefore = JSON.stringify(fusionWorld);
const fusionCandidate = decision.enumerateCandidates({
  worldSnapshot: fusionWorld,
  actorId: 'fusion-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 1 },
}).find(candidate => candidate?.declaration?.skill?.id === 'paired-fusion-strike');
assert.ok(fusionCandidate, '搭档可战且自然机会待消费时，武魂融合技没有进入候选');
assert.deepEqual(
  [...fusionCandidate.declaration.fusionParticipantIds].sort(),
  ['fusion-actor', 'fusion-partner'],
  '武魂融合技候选没有绑定完整参与者',
);
const fusionPreview = preview.previewAction({
  worldSnapshot: fusionWorld,
  actorId: 'fusion-actor',
  declaration: fusionCandidate.declaration,
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
assert.equal(preview.readResource(preview.findUnit(fusionPreview.afterSnapshot, 'fusion-actor'), '魂力'), 50, '融合技预估没有扣除发起者资源');
assert.equal(preview.readResource(preview.findUnit(fusionPreview.afterSnapshot, 'fusion-partner'), '魂力'), 50, '融合技预估没有扣除搭档资源');
assert.equal(
  preview.findUnit(fusionPreview.afterSnapshot, 'fusion-partner')?.__battleRuntime?.naturalOpportunity?.status,
  'CONSUMED_BY_FUSION',
  '融合技预估没有消费搭档本轮自然机会',
);
assert.equal(JSON.stringify(fusionWorld), fusionInputBefore, '融合技预估修改了正式输入');
const fusionUnavailableWorld = structuredClone(fusionWorld);
fusionUnavailableWorld.参战者.team_player[1].__battleRuntime.naturalOpportunity.status = 'CONSUMED';
assert.ok(
  !decision.enumerateCandidates({
    worldSnapshot: fusionUnavailableWorld,
    actorId: 'fusion-actor',
    actionOpportunity: { role: 'ACTIVE', sequence: 1 },
  }).some(candidate => candidate?.declaration?.skill?.id === 'paired-fusion-strike'),
  '搭档自然机会已消费后，武魂融合技仍进入候选',
);

const deadlineScores = decision.scoreCandidatesNext({
  worldSnapshot: deadlineWorld,
  actorId: 'deadline-actor',
  battleIntent: '阻止坚持',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: true },
  seed: 740411,
});
const deadlineStrike = deadlineScores.find(candidate => candidate?.declaration?.skill?.id === 'deadline-strike');
const deadlineDefend = deadlineScores.find(candidate => candidate?.declaration?.actionKind === 'DEFEND');
assert.ok(deadlineStrike && deadlineDefend, '截止目标案例缺少进攻或防御候选');
const earlyDeadlineWorld = structuredClone(deadlineWorld);
earlyDeadlineWorld.回合 = 1;
const earlyDeadlineStrike = decision.scoreCandidatesNext({
  worldSnapshot: earlyDeadlineWorld,
  actorId: 'deadline-actor',
  battleIntent: '阻止坚持',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: true },
  seed: 740412,
}).find(candidate => candidate?.declaration?.skill?.id === 'deadline-strike');
assert.ok(earlyDeadlineStrike, '截止目标早期案例缺少进攻候选');
assert.ok(
  Number(deadlineStrike.vector?.objectiveProgress || 0) > 0,
  `敌方进攻没有获得阻止玩家坚持到截止回合的目标进度:${JSON.stringify({
    utility: deadlineStrike.objectiveUtility,
    vector: deadlineStrike.vector,
    rejectionCode: deadlineStrike.rejectionCode,
  })}`,
);
assert.ok(
  Number(deadlineStrike.vector?.objectiveProgress || 0) >
    Number(earlyDeadlineStrike.vector?.objectiveProgress || 0) * 2.5,
  `截止回合没有显著提高同一推进动作的目标紧迫度:${deadlineStrike.vector?.objectiveProgress}/${earlyDeadlineStrike.vector?.objectiveProgress}`,
);
assert.ok(
  Number(deadlineStrike.objectiveUtility || 0) > Number(deadlineDefend.objectiveUtility || 0),
  `截止目标下纯防御仍压过有效推进:${deadlineStrike.objectiveUtility}/${deadlineDefend.objectiveUtility}`,
);

const creationActor = unit('creation-actor', 'player', {
  str: 10,
  属性: { ...unit('creation-actor-base', 'player').属性, 力量: 10 },
  技能列表: [creationSkill('future-food')],
  __battleRuntime: {
    naturalOpportunity: {
      round: 3,
      opportunityId: 'natural:3:player:creation-actor:1',
      status: 'PENDING',
    },
  },
});
const creationConsumer = unit('creation-consumer', 'player', {
  hp: 50,
  vit: 20,
  属性: {
    ...unit('creation-consumer-base', 'player').属性,
    HP: 50,
    体力: 20,
  },
  技能列表: [attackSkill('creation-consumer-finisher', 0, 1000)],
});
const creationWorld = {
  回合: 3,
  胜负条件: {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 5,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
  },
  参战者: {
    team_player: [creationActor, creationConsumer],
    team_enemy: [unit('creation-enemy', 'enemy', {
      def: 300,
      属性: { ...unit('creation-enemy-base', 'enemy').属性, 防御: 300 },
    })],
  },
};
const earlyCreation = decision.scoreCandidatesNext({
  worldSnapshot: creationWorld,
  actorId: 'creation-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740416,
}).find(candidate => candidate?.declaration?.skill?.id === 'future-food');
assert.ok(earlyCreation, '有真实消费窗口的造物候选缺失');
assert.equal(
  earlyCreation.nextValueAudit?.creationFutureUse?.realizable,
  true,
  `前置造物没有证明未来成品可成为非支配动作:${JSON.stringify(earlyCreation.nextValueAudit?.creationFutureUse)}`,
);
assert.notEqual(earlyCreation.rejectionCode, 'ZERO_EFFECT_COSTLY', '有真实后继消费窗口的造物被错误归零');

const attackPreferredCreationWorld = structuredClone(creationWorld);
attackPreferredCreationWorld.参战者.team_player[0].技能列表 = [
  creationSkill('future-food'),
  attackSkill('creation-actor-finisher', 0, 1000),
];
attackPreferredCreationWorld.参战者.team_player[1].hp = 480;
attackPreferredCreationWorld.参战者.team_player[1].属性.HP = 480;
attackPreferredCreationWorld.参战者.team_player[1].vit = 480;
attackPreferredCreationWorld.参战者.team_player[1].属性.体力 = 480;
const attackPreferredCreation = decision.scoreCandidatesNext({
  worldSnapshot: attackPreferredCreationWorld,
  actorId: 'creation-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740418,
}).find(candidate => candidate?.declaration?.skill?.id === 'future-food');
assert.ok(attackPreferredCreation, '下一机会进攻更优的造物候选缺失');
assert.equal(
  attackPreferredCreation.nextValueAudit?.creationFutureUse?.realizable,
  false,
  `成品下一机会被有效进攻支配时仍被视为可兑现:${JSON.stringify(attackPreferredCreation.nextValueAudit?.creationFutureUse)}`,
);
assert.equal(
  attackPreferredCreation.nextValueAudit?.creationFutureUse?.reason,
  'FUTURE_USE_DOMINATED',
  '下一机会进攻更优时没有记录造物被支配',
);
assert.equal(attackPreferredCreation.rejectionCode, 'ZERO_EFFECT_COSTLY', '下一机会进攻更优的造物仍可进入主观选择');

const deadlineCreationWorld = structuredClone(creationWorld);
deadlineCreationWorld.回合 = 5;
deadlineCreationWorld.参战者.team_player[0].__battleRuntime.naturalOpportunity = {
  round: 5,
  opportunityId: 'natural:5:player:creation-actor:1',
  status: 'PENDING',
};
const deadlineCreation = decision.scoreCandidatesNext({
  worldSnapshot: deadlineCreationWorld,
  actorId: 'creation-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740417,
}).find(candidate => candidate?.declaration?.skill?.id === 'future-food');
assert.ok(deadlineCreation, '末轮造物候选缺失');
assert.equal(
  deadlineCreation.nextValueAudit?.creationFutureUse?.reason,
  'NO_REMAINING_NATURAL_OPPORTUNITY',
  `末轮造物没有识别无消费窗口:${JSON.stringify(deadlineCreation.nextValueAudit?.creationFutureUse)}`,
);
assert.equal(deadlineCreation.rejectionCode, 'ZERO_EFFECT_COSTLY', '末轮无法消费的造物仍可进入主观选择');

const itemTargetWorld = {
  回合: 3,
  胜负条件: {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 3,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ type: 'ROUND_REACHED', side: 'PLAYER', round: 3, requireActive: true }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
  },
  参战者: {
    team_player: [
      unit('item-user', 'player', {
        hp: 450,
        vit: 450,
        属性: { ...unit('item-user-base', 'player').属性, HP: 450, 体力: 450 },
        背包: { relief: recoveryItem('relief') },
      }),
      unit('item-ally', 'player', {
        hp: 180,
        vit: 80,
        属性: { ...unit('item-ally-base', 'player').属性, HP: 180, 体力: 80 },
        技能列表: [attackSkill('item-ally-finisher', 0, 180)],
      }),
    ],
    team_enemy: [unit('item-threat', 'enemy', { 技能列表: [attackSkill('item-threat-strike', 0, 140)] })],
  },
};
const itemTargetScores = decision.scoreCandidatesNext({
  worldSnapshot: itemTargetWorld,
  actorId: 'item-user',
  actionOpportunity: { role: 'ACTIVE', sequence: 3, futureHostileResponseAllowed: false },
  seed: 740419,
}).filter(candidate => candidate?.declaration?.actionKind === 'USE_ITEM');
const selfRelief = itemTargetScores.find(candidate => candidate?.declaration?.targetIds?.includes('item-user'));
const allyRelief = itemTargetScores.find(candidate => candidate?.declaration?.targetIds?.includes('item-ally'));
assert.ok(selfRelief && allyRelief, '恢复物品没有保留施术者与队友的独立候选');
assert.equal(
  Number(selfRelief.vector?.objectiveProgress || 0),
  0,
  `坚持回合目标仍给恢复物品重复追加生存进度:${selfRelief.vector?.objectiveProgress}`,
);
assert.equal(
  Number(allyRelief.vector?.objectiveProgress || 0),
  0,
  `坚持回合目标仍给队友恢复重复追加生存进度:${allyRelief.vector?.objectiveProgress}`,
);
assert.ok(
  Number(allyRelief.objectiveUtility || 0) > Number(selfRelief.objectiveUtility || 0),
  `队友生命与体力缺口显著更大时，恢复物品仍错误偏向施术者:${allyRelief.objectiveUtility}/${selfRelief.objectiveUtility}`,
);

const selfRescueWorld = structuredClone(itemTargetWorld);
selfRescueWorld.参战者.team_player[0].hp = 80;
selfRescueWorld.参战者.team_player[0].vit = 60;
selfRescueWorld.参战者.team_player[0].属性.HP = 80;
selfRescueWorld.参战者.team_player[0].属性.体力 = 60;
selfRescueWorld.参战者.team_player[0].技能列表 = [attackSkill('item-user-finisher', 0, 180)];
selfRescueWorld.参战者.team_player[1].hp = 420;
selfRescueWorld.参战者.team_player[1].vit = 420;
selfRescueWorld.参战者.team_player[1].属性.HP = 420;
selfRescueWorld.参战者.team_player[1].属性.体力 = 420;
selfRescueWorld.参战者.team_player[1].技能列表 = [];
const selfRescueScores = decision.scoreCandidatesNext({
  worldSnapshot: selfRescueWorld,
  actorId: 'item-user',
  actionOpportunity: { role: 'ACTIVE', sequence: 3, futureHostileResponseAllowed: false },
  seed: 740420,
}).filter(candidate => candidate?.declaration?.actionKind === 'USE_ITEM');
const criticalSelfRelief = selfRescueScores.find(candidate => candidate?.declaration?.targetIds?.includes('item-user'));
const healthyAllyRelief = selfRescueScores.find(candidate => candidate?.declaration?.targetIds?.includes('item-ally'));
assert.ok(
  Number(criticalSelfRelief?.objectiveUtility || 0) > Number(healthyAllyRelief?.objectiveUtility || 0),
  `施术者自身濒危而队友健康时，自救没有成为更高价值目标:${criticalSelfRelief?.objectiveUtility}/${healthyAllyRelief?.objectiveUtility}`,
);

const renewableItemWorld = structuredClone(itemTargetWorld);
renewableItemWorld.回合 = 1;
renewableItemWorld.胜负条件.maxRounds = 4;
renewableItemWorld.胜负条件.victory.conditions[0].round = 4;
renewableItemWorld.参战者.team_player[0].技能列表 = [creationSkill('relief')];
renewableItemWorld.参战者.team_player[1].hp = 50;
renewableItemWorld.参战者.team_player[1].vit = 10;
renewableItemWorld.参战者.team_player[1].属性.HP = 50;
renewableItemWorld.参战者.team_player[1].属性.体力 = 10;
renewableItemWorld.参战者.team_enemy[0].属性.等级 = 100;
const renewableRelief = decision.scoreCandidatesNext({
  worldSnapshot: renewableItemWorld,
  actorId: 'item-user',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740421,
}).find(candidate =>
  candidate?.declaration?.actionKind === 'USE_ITEM' &&
  candidate?.declaration?.targetIds?.includes('item-ally')
);
assert.ok(renewableRelief, '可再制造恢复物品候选缺失');
assert.ok(
  Number(renewableRelief.objectiveUtility || 0) > 0 && !renewableRelief.rejectionCode,
  `当前危机中可再制造物品仍被按永久损失囤积:${JSON.stringify({
    utility: renewableRelief.objectiveUtility,
    rejectionCode: renewableRelief.rejectionCode,
    vector: renewableRelief.vector,
    audit: renewableRelief.nextValueAudit,
  })}`,
);
assert.ok(
  Number(renewableRelief.nextValueAudit?.after?.own || 0) <
    Number(renewableRelief.nextValueAudit?.noOp?.own || 0) +
      Number(renewableRelief.nextValueAudit?.frozenDirectPotential?.['item-user'] || 0),
  '物品使用与后续再制造重复计入了当前库存的完整价值',
);

const healthyRenewableWorld = structuredClone(renewableItemWorld);
healthyRenewableWorld.参战者.team_player[1].hp = 500;
healthyRenewableWorld.参战者.team_player[1].vit = 500;
healthyRenewableWorld.参战者.team_player[1].属性.HP = 500;
healthyRenewableWorld.参战者.team_player[1].属性.体力 = 500;
const healthyRenewableRelief = decision.scoreCandidatesNext({
  worldSnapshot: healthyRenewableWorld,
  actorId: 'item-user',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, futureHostileResponseAllowed: false },
  seed: 740422,
}).find(candidate =>
  candidate?.declaration?.actionKind === 'USE_ITEM' &&
  candidate?.declaration?.targetIds?.includes('item-ally')
);
assert.ok(healthyRenewableRelief, '健康目标的可再制造物品候选缺失');
assert.ok(
  Number(healthyRenewableRelief.objectiveUtility || 0) <= 0 || !!healthyRenewableRelief.rejectionCode,
  `健康目标仍被判定值得消耗恢复物品:${healthyRenewableRelief.objectiveUtility}/${healthyRenewableRelief.rejectionCode}`,
);
assert.ok(
  Number(selfRelief.vector?.irreversibleAssetCost || 0) > 0,
  '没有实际再制造技能的物品未保留不可逆资产成本',
);

const stateWindowSkill = {
  id: 'state-window-skill',
  name: 'state-window-skill',
  魂技名: 'state-window-skill',
  消耗: { 魂力: 10 },
  _效果数组: [
    { effectId: 'state-window-lock', 原型: '状态施加', 目标: '单体', 状态: '位移限制', 数值: '-5%', 持续回合: 1 },
    { effectId: 'state-window-dot', 原型: '状态施加', 目标: '单体', 状态: '中毒', 数值: '-5%', 持续回合: 1 },
  ],
};
const stateWindowWorld = world([stateWindowSkill]);
stateWindowWorld.回合 = 1;
stateWindowWorld.胜负条件 = {
  version: 1,
  explicit: true,
  startRound: 0,
  maxRounds: 3,
  resolutionPriority: 'DEFEAT_FIRST',
  victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }] },
  defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
};
const stateWindowWithoutTargetAction = decision.scoreCandidatesNext({
  worldSnapshot: stateWindowWorld,
  actorId: 'actor',
  actionOpportunity: {
    role: 'ACTIVE',
    sequence: 1,
    futureHostileResponseAllowed: true,
    pendingNaturalActorIds: [],
    pendingHostileActorIds: [],
  },
  seed: 740423,
}).find(candidate => candidate?.declaration?.skill?.id === stateWindowSkill.id);
assert.ok(stateWindowWithoutTargetAction, '状态窗口案例缺少候选');
assert.equal(
  stateWindowWithoutTargetAction.repeatedActionAudit?.extendedWindowIds?.length,
  1,
  `目标本轮已行动时，短位移限制仍被计为可兑现窗口:${JSON.stringify(stateWindowWithoutTargetAction.repeatedActionAudit)}`,
);
assert.deepEqual(
  [...(stateWindowWithoutTargetAction.repeatedActionAudit?.lifecycleWindowReasons || [])],
  ['SAME_ROUND_TICK'],
  `短状态窗口错误泄漏到未来回合:${JSON.stringify(stateWindowWithoutTargetAction.repeatedActionAudit)}`,
);
const stateWindowBeforeTargetAction = decision.scoreCandidatesNext({
  worldSnapshot: stateWindowWorld,
  actorId: 'actor',
  actionOpportunity: {
    role: 'ACTIVE',
    sequence: 1,
    futureHostileResponseAllowed: true,
    pendingNaturalActorIds: ['enemy'],
    pendingHostileActorIds: ['enemy'],
  },
  seed: 740424,
}).find(candidate => candidate?.declaration?.skill?.id === stateWindowSkill.id);
assert.ok(stateWindowBeforeTargetAction, '目标待行动状态窗口案例缺少候选');
assert.equal(
  stateWindowBeforeTargetAction.repeatedActionAudit?.extendedWindowIds?.length,
  2,
  `目标本轮尚未行动时，短位移限制未保留真实窗口:${JSON.stringify(stateWindowBeforeTargetAction.repeatedActionAudit)}`,
);
assert.ok(
  stateWindowBeforeTargetAction.repeatedActionAudit?.lifecycleWindowReasons?.includes('TARGET_CURRENT_ROUND_ACTION'),
  '目标本轮待行动时没有记录当前行动轴窗口',
);

console.log(JSON.stringify({
  summary: {
    directPotential,
    cheapUtility: cheap.objectiveUtility,
    expensiveUtility: expensive.objectiveUtility,
    shortControlUtility: shortControl.objectiveUtility,
    longControlUtility: longControl.objectiveUtility,
    noConsumerUtility: noConsumer.objectiveUtility,
    unlockUtility: unlock.objectiveUtility,
    finishingAttackUtility: finishingAttack.objectiveUtility,
    groupCapacityBefore,
    groupCapacityAfter,
    frozenUnitCount: Object.keys(context.catalogs).length,
    summonUtility: summonProgress.objectiveUtility,
    counterRiskGroupUtility: counterRiskGroup.objectiveUtility,
    counterRiskSingleUtility: counterRiskSingle.objectiveUtility,
    counterRiskExpectedThreat: counterRiskGroup.nextValueAudit.immediateCounterExpectedThreat,
    deadlineStrikeUtility: deadlineStrike.objectiveUtility,
    deadlineDefendUtility: deadlineDefend.objectiveUtility,
    deadlineObjectiveProgress: deadlineStrike.vector.objectiveProgress,
    earlyDeadlineObjectiveProgress: earlyDeadlineStrike.vector.objectiveProgress,
    nonTemporalDeadlineGroupUtility: nonTemporalDeadlineGroup.objectiveUtility,
    nonTemporalDeadlineSingleUtility: nonTemporalDeadlineSingle.objectiveUtility,
    sharedReactionUtility: sharedReactionAttack.objectiveUtility,
    consumedReactionUtility: consumedReactionAttack.objectiveUtility,
    fusionParticipantIds: fusionCandidate.declaration.fusionParticipantIds,
    fusionPartnerSoulAfter: preview.readResource(preview.findUnit(fusionPreview.afterSnapshot, 'fusion-partner'), '魂力'),
    earlyCreationUtility: earlyCreation.objectiveUtility,
    deadlineCreationRejection: deadlineCreation.rejectionCode,
    allyReliefUtility: allyRelief.objectiveUtility,
    selfReliefUtility: selfRelief.objectiveUtility,
    criticalSelfReliefUtility: criticalSelfRelief.objectiveUtility,
    healthyAllyReliefUtility: healthyAllyRelief.objectiveUtility,
    assertions: 86,
    passed: true,
  },
}, null, 2));

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
for (const relativePath of ['lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
assert.ok(preview, '战斗预估运行时未加载');

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach(child => deepFreeze(child, seen));
  return Object.freeze(value);
}

function createWorld() {
  return {
    回合: 1,
    参战者: {
      ally: [{
        id: 'actor',
        name: '测试行动者',
        hp: 60,
        hp_max: 100,
        sp: 40,
        sp_max: 100,
        men: 60,
        men_max: 100,
        vit: 80,
        vit_max: 100,
        str: 80,
        def: 50,
        agi: 60,
        状态: { 存活: true },
      }],
      enemy: [{
        id: 'target',
        name: '测试目标',
        hp: 100,
        hp_max: 100,
        sp: 30,
        sp_max: 100,
        men: 50,
        men_max: 100,
        vit: 100,
        vit_max: 100,
        str: 50,
        def: 40,
        agi: 40,
        shield: 0,
        状态: { 存活: true },
      }],
    },
  };
}

function declaration(actionId, effects, targetIds = ['target']) {
  return {
    actionId,
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds,
    skill: { id: actionId, 名称: actionId, _效果数组: effects },
  };
}

const frozenWorld = deepFreeze(createWorld());
const worldHashBefore = preview.stableHash(frozenWorld);
preview.clearCache();
const metricsBefore = preview.readMetrics();
const damageInput = {
  worldSnapshot: frozenWorld,
  beliefSnapshot: { revision: 1 },
  actorId: 'actor',
  worldRevision: 'world:1',
  beliefRevision: 'belief:1',
  declaration: declaration('damage', [{
    effectId: 'damage:1',
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 50,
    伤害类型: '近身攻击',
    命中概率: 100,
  }]),
};
const damageResult = preview.previewAction(damageInput);
assert.equal(preview.stableHash(frozenWorld), worldHashBefore, '预估修改了冻结输入');
assert.ok(damageResult.contributions.some(entry => entry.outcomeKind === 'HP_DELTA' && entry.threatValue > 0), '伤害未形成有效贡献');
assert.ok(preview.findUnit(damageResult.afterSnapshot, 'target').hp < 100, '伤害未写入覆盖层快照');

const cachedDamage = preview.previewAction(damageInput);
assert.equal(cachedDamage, damageResult, '相同缓存键未复用不可变预估结果');
const metricsAfterCache = preview.readMetrics();
assert.equal(metricsAfterCache.previewCalls - metricsBefore.previewCalls, 1, '相同缓存键重复执行纯预估');
assert.equal(metricsAfterCache.cacheHits - metricsBefore.cacheHits, 1, '相同缓存键未命中缓存');
assert.equal(metricsAfterCache.fullCloneCalls - metricsBefore.fullCloneCalls, 0, '候选预估完整克隆了combatData');

const healingResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:heal',
  declaration: declaration('heal', [{ effectId: 'heal:1', 原型: '资源变化', 目标: '自身', 资源: '生命', 数值: '+30' }], ['actor']),
});
assert.equal(preview.findUnit(healingResult.afterSnapshot, 'actor').hp, 90, '生命恢复预估错误');

const resourceResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:resource',
  declaration: declaration('resource', [{ effectId: 'resource:1', 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+20' }], ['actor']),
});
assert.equal(preview.findUnit(resourceResult.afterSnapshot, 'actor').sp, 60, '资源变化预估错误');

const shieldResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:shield',
  declaration: declaration('shield', [{ effectId: 'shield:1', 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+25' }], ['actor']),
});
assert.equal(preview.findUnit(shieldResult.afterSnapshot, 'actor').shield, 25, '护盾变化预估错误');

const stateShieldResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:state-shield',
  declaration: declaration('state-shield', [{ effectId: 'state-shield:1', 原型: '状态施加', 目标: '自身', 状态: '护盾', 数值: '+25%', 持续回合: 1 }], ['actor']),
});
const previewShieldState = Object.values(preview.findUnit(stateShieldResult.afterSnapshot, 'actor').状态效果 || {})[0];
assert.equal(previewShieldState?.数值, '+25%', '状态护盾预估丢失效果强度');

assert.throws(() => preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:non-battle',
  declaration: declaration('non-battle', [{ effectId: 'training:1', 原型: '修炼增益', 目标: '自身', 收益类型: '修炼速度', 数值: '+10%' }], ['actor']),
}), /battle_preview_non_battle_prototype:修炼增益/, '战斗外原型进入战斗预估');

const overkillResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:overkill',
  declaration: declaration('overkill', [
    { effectId: 'overkill:1', 原型: '伤害结算', 目标: '单体', 威力倍率: 10000, 伤害类型: '真实攻击', 命中概率: 100 },
    { effectId: 'overkill:2', 原型: '伤害结算', 目标: '单体', 威力倍率: 10000, 伤害类型: '真实攻击', 命中概率: 100 },
  ]),
});
const overkillValue = overkillResult.contributions.reduce((sum, entry) => sum + entry.threatValue, 0);
assert.ok(overkillValue <= 100, `多段过量伤害重复计值:${overkillValue}`);

const ledger = new preview.ContributionLedger();
const contribution = {
  rootActionId: 'root',
  effectInstanceId: 'effect',
  targetId: 'target',
  windowId: 'window',
  outcomeKind: 'HP_DELTA',
};
ledger.addOutcome(contribution);
assert.throws(() => ledger.addOutcome(contribution), /battle_preview_duplicate_causal_value/, '重复语义贡献未fatal');
const exclusiveLedger = new preview.ContributionLedger();
exclusiveLedger.addOutcome({ ...contribution, outcomeKind: 'ACTION_CANCELLED' });
assert.throws(
  () => exclusiveLedger.addOutcome({ ...contribution, effectInstanceId: 'effect:quality', outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED' }),
  /battle_preview_mutually_exclusive_causal_value/,
  '行动取消与下一行动质量重复计值未fatal',
);

const tooManyEffects = Array.from({ length: 13 }, (_, index) => ({
  effectId: `budget:${index}`,
  原型: '资源变化',
  目标: '自身',
  资源: '魂力',
  数值: '+1',
}));
assert.throws(() => preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:budget',
  declaration: declaration('budget', tooManyEffects, ['actor']),
}), /DECISION_PREVIEW_BUDGET_EXCEEDED/, '超过12节点未fatal');

const actor = preview.findUnit(frozenWorld, 'actor');
const healthyCapacity = preview.calculateUnitCapacity({ unit: actor, survivalProbability: 1, actionAvailability: 1, bestLegalBaseActionValue: 40 });
const woundedCapacity = preview.calculateUnitCapacity({ unit: actor, survivalProbability: 0.4, actionAvailability: 1, bestLegalBaseActionValue: 40 });
const controlledCapacity = preview.calculateUnitCapacity({ unit: actor, survivalProbability: 1, actionAvailability: 0, bestLegalBaseActionValue: 40 });
assert.ok(healthyCapacity > woundedCapacity, '存活概率下降未降低战力容量');
assert.equal(controlledCapacity, 0, '行动取消后战力容量未归零');

const staggerResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:stagger-control',
  declaration: declaration('stagger-control', [{ effectId: 'stagger:1', 原型: '状态施加', 目标: '单体', 状态: '僵直', 持续回合: 1 }]),
});
assert.ok(!staggerResult.contributions.some(entry => entry.outcomeKind === 'ACTION_CANCELLED'), '僵直被错误预估为取消自然行动');
const stunResult = preview.previewAction({
  worldSnapshot: frozenWorld,
  actorId: 'actor',
  worldRevision: 'world:stun-control',
  declaration: declaration('stun-control', [{ effectId: 'stun:1', 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1 }]),
});
assert.ok(stunResult.contributions.some(entry => entry.outcomeKind === 'ACTION_CANCELLED'), '眩晕没有预估为取消自然行动');

const repeatedStateWorld = createWorld();
repeatedStateWorld.参战者.enemy[0].状态效果 = {
  existingSlow: { 状态: '迟缓', 状态名称: '迟缓', duration: 2, 战斗效果: { dodge_penalty: 0.2 } },
};
const repeatedStateResult = preview.previewAction({
  worldSnapshot: repeatedStateWorld,
  actorId: 'actor',
  worldRevision: 'world:repeated-state',
  declaration: declaration('repeated-state', [{ effectId: 'slow:1', 原型: '状态施加', 目标: '单体', 状态: '迟缓', 持续回合: 1 }]),
});
assert.equal(Object.keys(preview.findUnit(repeatedStateResult.afterSnapshot, 'target').状态效果).length, 1, '不可叠同名状态在预估中重复写入');
assert.equal(repeatedStateResult.contributions[0]?.evidence?.marginal, false, '不可叠同名状态仍被记录为有效边际');

const weakWithdrawal = preview.estimateWithdrawal(
  { ...preview.findUnit(createWorld(), 'actor'), agi: 20, men: 10, men_max: 100 },
  { ...preview.findUnit(createWorld(), 'target'), agi: 200, men: 100, men_max: 100 },
);
const strongWithdrawal = preview.estimateWithdrawal(
  { ...preview.findUnit(createWorld(), 'actor'), agi: 200, men: 100, men_max: 100 },
  { ...preview.findUnit(createWorld(), 'target'), agi: 20, men: 10, men_max: 100 },
);
assert.ok(weakWithdrawal.successProbability < strongWithdrawal.successProbability, '撤离成功率没有随双方追逃能力单调变化');

const output = {
  summary: {
    version: preview.version,
    assertions: 28,
    passed: true,
  },
  cache: {
    previewCalls: metricsAfterCache.previewCalls - metricsBefore.previewCalls,
    cacheHits: metricsAfterCache.cacheHits - metricsBefore.cacheHits,
    fullCloneCalls: metricsAfterCache.fullCloneCalls - metricsBefore.fullCloneCalls,
  },
  coverage: ['damage', 'healing', 'resource', 'shield', 'overkill-cap', 'non-battle-rejection', 'contribution-exclusivity', 'preview-budget', 'unit-capacity', 'control-semantics', 'state-marginal', 'withdrawal-probability'],
};
console.log(JSON.stringify(output, null, 2));

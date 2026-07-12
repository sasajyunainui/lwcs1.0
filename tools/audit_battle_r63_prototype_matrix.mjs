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
const registry = sandbox.__LWCS_SKILL_MECHANISM_REGISTRY__?.原型定义;
assert.ok(preview && registry, '共享注册表或预估运行时未加载');

function createWorld({ targetHasBuff = true } = {}) {
  return {
    回合: 2,
    参战者: {
      ally: [{
        id: 'actor', name: '原型行动者', hp: 70, hp_max: 100, shield: 10,
        sp: 60, sp_max: 100, men: 70, men_max: 100, vit: 80, vit_max: 100,
        str: 80, def: 50, agi: 60, 状态: { 存活: true },
        状态效果: { poison: { 状态: '中毒', 类型: '负面', duration: 2 } },
      }],
      enemy: [{
        id: 'target', name: '原型目标', hp: 100, hp_max: 100, shield: 30,
        sp: 20, sp_max: 100, men: 50, men_max: 100, vit: 100, vit_max: 100,
        str: 50, def: 40, agi: 40, 状态: { 存活: true },
        状态效果: targetHasBuff ? { guard: { 状态: '强化', 类型: '增益', duration: 2 } } : {},
      }],
    },
  };
}

const historicWorld = createWorld();
historicWorld.参战者.enemy[0].hp = 88;
historicWorld.参战者.enemy[0].shield = 5;

const effects = {
  伤害结算: { 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' },
  资源变化: { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' },
  资源转移: { 原型: '资源转移', 目标: '单体', 资源: '魂力', 数值: '10', 资源转移方式: '转移' },
  护盾变化: { 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+20' },
  属性修正: { 原型: '属性修正', 目标: '自身', 属性: '力量', 数值: '+10%' },
  判定修正: { 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' },
  结算修正: { 原型: '结算修正', 目标: '自身', 结算: '造成伤害', 数值: '+10%' },
  炸环: { 原型: '炸环', 目标: '自身', 强化倍率: 1.5 },
  状态施加: { 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1 },
  时窗修正: { 原型: '时窗修正', 目标: '单体', 调整字段: '持续回合', 调整方式: '延长', 调整回合: 1 },
  状态移除: { 原型: '状态移除', 目标: '自身', 状态: '任意负面', 数量: 1 },
  规则防御: { 原型: '规则防御', 目标: '自身', 规则: '免伤', 次数: 1 },
  状态转移: { 原型: '状态转移', 目标: '单体', 状态: '任意负面', 来源: '自身', 去向: '目标', 数量: 1 },
  状态交换: { 原型: '状态交换', 目标: '单体', 状态: '任意负面' },
  资源锁定: { 原型: '资源锁定', 目标: '单体', 资源: '魂力', 锁定类型: '资源池锁定', 数值: '-50%' },
  规则改写: { 原型: '规则改写', 目标: '单体', 规则: '缴械', 数值: '+25%' },
  机制抹消: { 原型: '机制抹消', 目标: '单体', 抹消对象: { 原型: '状态施加', 状态: '眩晕' } },
  机制授予: { 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] },
  复制执行: { 原型: '复制执行', 目标: '单体', 复制类型: '复制技能', 复制模式: '即时镜像', 使用效果: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击' }] },
  时光回溯: { 原型: '时光回溯', 目标: '单体', 发动方式: '主动' },
  位移执行: { 原型: '位移执行', 目标: '单体', 位移类型: '击退', 位移对象: '目标', 距离: 3 },
  决策干扰: { 原型: '决策干扰', 目标: '单体', 干扰: '判断干扰', 数值: '-20%' },
  召唤生成: { 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '测试召唤物', 数量: 1, 行动模式: '协同攻击', 持续回合: 1 },
};

const registryNames = Object.keys(registry);
assert.deepEqual([...preview.battlePrototypes].sort(), Object.keys(effects).sort(), '战斗原型实现集与专项矩阵不一致');
assert.deepEqual(registryNames.filter(name => !preview.battlePrototypes.includes(name)).sort(), [...preview.nonBattlePrototypes].sort(), '共享注册表存在未分类原型');

const matrix = [];
for (const [prototype, effect] of Object.entries(effects)) {
  const worldSnapshot = createWorld();
  const actionId = `prototype:${prototype}`;
  const targetIds = effect.目标 === '自身' ? ['actor'] : ['target'];
  const declaration = {
    actionId,
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds,
    ringId: prototype === '炸环' ? 'ring:test' : undefined,
    historySnapshot: prototype === '时光回溯' ? historicWorld : undefined,
    skill: { id: actionId, 名称: actionId, _效果数组: [{ effectId: `${actionId}:effect`, ...effect }] },
  };
  const result = preview.previewAction({ worldSnapshot, actorId: 'actor', worldRevision: actionId, declaration });
  assert.ok(result.nodeCount >= 1 && result.nodeCount <= 12, `${prototype}节点预算异常`);
  assert.ok(result.contributions.length || result.scheduledEvents.length || Object.keys(result.changedRules).length, `${prototype}未产生可审计结果`);
  matrix.push({ prototype, nodeCount: result.nodeCount, contributions: result.contributions.map(entry => entry.outcomeKind), scheduled: result.scheduledEvents.map(event => event.type) });
}

const grantResult = matrix.find(entry => entry.prototype === '机制授予');
assert.equal(grantResult.nodeCount, 1, '机制授予提前执行了被授予效果');
assert.equal(grantResult.contributions.join(','), 'ACTION_GRANTED', '机制授予产生了授权之外的即时贡献');
const copyResult = matrix.find(entry => entry.prototype === '复制执行');
assert.equal(copyResult.nodeCount, 2, '复制执行未按父节点加一个复制节点结算');
assert.equal(copyResult.contributions.join(','), 'HP_DELTA', '复制执行重复结算被复制伤害');

let enumOptionCount = 0;
for (const [prototype, baseEffect] of Object.entries(effects)) {
  for (const [field, fieldDefinition] of Object.entries(registry[prototype]?.字段定义 || {})) {
    if (field === '原型') continue;
    for (const option of fieldDefinition?.选项 || []) {
      const effect = structuredClone(baseEffect);
      effect[field] = option;
      const actionId = `enum:${prototype}:${field}:${option}`;
      preview.previewAction({
        worldSnapshot: createWorld(),
        actorId: 'actor',
        worldRevision: actionId,
        declaration: {
          actionId,
          actorId: 'actor',
          actionKind: 'RELEASE_SKILL',
          targetIds: effect.目标 === '自身' ? ['actor'] : ['target'],
          ringId: prototype === '炸环' ? 'ring:enum' : undefined,
          historySnapshot: prototype === '时光回溯' ? historicWorld : undefined,
          skill: { _效果数组: [effect] },
        },
      });
      enumOptionCount += 1;
    }
  }
}

const invalidEnum = structuredClone(effects.伤害结算);
invalidEnum.伤害类型 = '不存在的伤害类型';
assert.throws(() => preview.previewAction({
  worldSnapshot: createWorld(),
  actorId: 'actor',
  worldRevision: 'invalid-enum',
  declaration: { actionId: 'invalid-enum', actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['target'], skill: { _效果数组: [invalidEnum] } },
}), /battle_preview_unknown_enum/, '未知枚举未fatal');

assert.throws(() => preview.previewAction({
  worldSnapshot: createWorld(),
  actorId: 'actor',
  worldRevision: 'required-field-missing',
  declaration: { actionId: 'required-field-missing', actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['target'], skill: { _效果数组: [{ 原型: '伤害结算', 目标: '单体', 伤害类型: '近身攻击' }] } },
}), /battle_preview_required_field_missing:伤害结算:威力倍率/, '必填字段缺失未fatal');

for (const prototype of preview.nonBattlePrototypes) {
  assert.throws(() => preview.previewAction({
    worldSnapshot: createWorld(),
    actorId: 'actor',
    worldRevision: `non-battle:${prototype}`,
    declaration: { actionId: `non-battle:${prototype}`, actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['actor'], skill: { _效果数组: [{ 原型: prototype, 目标: '自身' }] } },
  }), new RegExp(`battle_preview_non_battle_prototype:${prototype}`), `${prototype}未被战斗预估拒绝`);
}

const failedExchange = preview.previewAction({
  worldSnapshot: createWorld({ targetHasBuff: false }),
  actorId: 'actor',
  worldRevision: 'exchange-no-partial',
  declaration: { actionId: 'exchange-no-partial', actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['target'], skill: { _效果数组: [effects.状态交换] } },
});
assert.equal(failedExchange.changedUnitIds.length, 0, '状态交换缺一侧时发生部分提交');
assert.equal(failedExchange.contributions.length, 0, '状态交换缺一侧时生成虚假贡献');

function recursiveCopy(depth) {
  if (depth <= 0) return effects.伤害结算;
  return { 原型: '复制执行', 目标: '单体', 复制类型: '复制技能', 复制模式: '即时镜像', 使用效果: [recursiveCopy(depth - 1)] };
}
assert.throws(() => preview.previewAction({
  worldSnapshot: createWorld(),
  actorId: 'actor',
  worldRevision: 'copy-depth',
  declaration: { actionId: 'copy-depth', actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['target'], skill: { _效果数组: [recursiveCopy(5)] } },
}), /battle_preview_recursion_depth_exceeded/, '复制执行递归超限未fatal');

assert.throws(() => preview.previewAction({
  worldSnapshot: createWorld(),
  actorId: 'actor',
  worldRevision: 'rewind-history-missing',
  declaration: { actionId: 'rewind-history-missing', actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['target'], skill: { _效果数组: [effects.时光回溯] } },
}), /battle_preview_rewind_history_missing/, '时光回溯缺少历史仍执行');

console.log(JSON.stringify({
  summary: {
    registryPrototypeCount: registryNames.length,
    battlePrototypeCount: preview.battlePrototypes.length,
    nonBattlePrototypeCount: preview.nonBattlePrototypes.length,
    matrixPassCount: matrix.length,
    enumOptionCount,
    passed: true,
  },
  matrix,
}, null, 2));

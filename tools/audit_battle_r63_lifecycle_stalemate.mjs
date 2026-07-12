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
assert.ok(decision, '影子决策运行时未加载');

const attack = { id: 'attack', name: '推进攻击', 消耗: '魂力:5', _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }] };
const createFood = {
  id: 'create-food', name: '制造补给', 消耗: '魂力:5', 生成物: { id: 'food' }, 生产窗口: 1,
  _效果数组: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '0' }],
};
const summon = {
  id: 'summon-valid', name: '短时协同', 消耗: '魂力:10',
  _效果数组: [{ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '协同体', 数量: 1, 行动模式: '协同攻击', 持续回合: 1 }],
};
const summonNoMode = {
  id: 'summon-no-mode', name: '无窗口召唤', 消耗: '魂力:10',
  _效果数组: [{ 原型: '召唤生成', 目标: '自身', 召唤单位类型: '魂兽', 召唤物名称: '无窗口体', 数量: 1, 持续回合: 1 }],
};
const potion = {
  id: 'potion', name: '恢复药', 类型: '消耗品', 数量: 1,
  _效果数组: [{ 原型: '资源变化', 目标: '单体', 资源: '生命', 数值: '+30' }],
};
const sword = { id: 'sword', name: '测试剑', 类型: '装备', 数量: 1, 装备属性: { 力量: '+20%' } };

function world({ injured = true, stock = 0 } = {}) {
  return {
    回合: 3,
    剩余回合: 10,
    参战者: {
      ally: [{
        id: 'actor', name: 'actor', level: 50, hp: injured ? 60 : 100, hp_max: 100,
        sp: 100, sp_max: 100, men: 80, men_max: 100, vit: 80, vit_max: 100,
        str: 70, def: 50, agi: 50, 状态: { 存活: true },
        技能列表: [attack, createFood, summon, summonNoMode],
        背包: { potion, food: { id: 'food', name: '补给', 类型: '消耗品', 数量: stock }, sword },
      }],
      enemy: [{
        id: 'enemy', name: 'enemy', level: 50, hp: 100, hp_max: 100,
        sp: 100, sp_max: 100, men: 70, men_max: 100, vit: 80, vit_max: 100,
        str: 65, def: 50, agi: 50, 状态: { 存活: true }, 技能列表: [attack],
      }],
    },
  };
}

const active = decision.decide({ worldSnapshot: world(), actorId: 'actor', beliefState: { confidence: 0.7 }, seed: 201 });
const itemCandidate = active.candidates.find(candidate => candidate.item?.id === 'potion');
assert.ok(itemCandidate, '最后一件消耗品被硬禁');
assert.ok(itemCandidate.vector.irreversibleCost > 0, '消耗品没有稀缺成本');
assert.ok(itemCandidate.preview.contributions.some(entry => entry.outcomeKind === 'IRREVERSIBLE_ASSET_LOST'), '消耗品成本未进入贡献账本');

const equipmentCandidate = active.candidates.find(candidate => candidate.equipment?.id === 'sword');
assert.ok(equipmentCandidate && !equipmentCandidate.rejectionCode, '有收益换装未生成有效候选');
const noEquipLoop = decision.decide({
  worldSnapshot: world(),
  actorId: 'actor',
  beliefState: { confidence: 0.7 },
  strategyMemory: { equipmentSignatures: [equipmentCandidate.equipmentSignature] },
  seed: 202,
});
assert.ok(!noEquipLoop.candidates.some(candidate => candidate.equipmentSignature === equipmentCandidate.equipmentSignature), '相同装备签名循环换装');

const usefulCreation = active.candidates.find(candidate => candidate.skill?.id === 'create-food');
assert.equal(usefulCreation?.creation?.useful, true, '有库存缺口和消费者时造物未识别收益');
assert.notEqual(usefulCreation?.rejectionCode, 'ZERO_EFFECT_COSTLY', '有效造物被零收益拒绝');
const uselessCreationDecision = decision.decide({ worldSnapshot: world({ injured: false, stock: 3 }), actorId: 'actor', beliefState: { confidence: 0.7 }, seed: 203 });
const uselessCreation = uselessCreationDecision.candidates.find(candidate => candidate.skill?.id === 'create-food');
assert.equal(uselessCreation?.rejectionCode, 'ZERO_EFFECT_COSTLY', '库存充足且无人消费仍反复造物');

const summonCandidate = active.candidates.find(candidate => candidate.skill?.id === 'summon-valid');
assert.ok(summonCandidate && summonCandidate.vector.expectedStateGain > 0, '持续1回合协同召唤没有一次行动价值');
assert.notEqual(summonCandidate.rejectionCode, 'SUMMON_NO_ACTION_WINDOW', '持续1回合召唤零行动消散');
const invalidSummon = active.candidates.find(candidate => candidate.skill?.id === 'summon-no-mode');
assert.equal(invalidSummon?.rejectionCode, 'SUMMON_NO_ACTION_WINDOW', '无行动模式召唤进入选择池');

const signatureWorld = world();
const signatureA = decision.strategicSignature(signatureWorld, decision.buildInitialBelief(signatureWorld, 'actor', {}));
signatureWorld.参战者.ally[0].hp += 1;
signatureWorld.参战者.ally[0].sp += 1;
const signatureB = decision.strategicSignature(signatureWorld, decision.buildInitialBelief(signatureWorld, 'actor', {}));
assert.equal(signatureA, signatureB, '自然恢复噪声改变战略状态签名');
assert.equal(decision.detectStalemate([{ signature: signatureA, capacityChangePercent: 0 }, { signature: signatureA, capacityChangePercent: 0 }], signatureA), true, '连续两回合同签名未识别僵局');
assert.equal(decision.detectStalemate([{ signature: signatureA, capacityChangePercent: 0, pendingEffect: true }, { signature: signatureA, capacityChangePercent: 0 }], signatureA), false, '即将兑现持续效果被误判僵局');

const stalemateDecision = decision.decide({
  worldSnapshot: world(),
  actorId: 'actor',
  beliefState: { confidence: 0.7 },
  strategicHistory: [{ signature: signatureA, capacityChangePercent: 0 }, { signature: signatureA, capacityChangePercent: 0 }],
  seed: 204,
});
assert.equal(stalemateDecision.stalemate, true, '决策上下文未携带僵局');
assert.equal(stalemateDecision.candidates.find(candidate => candidate.declaration.actionKind === 'DEFEND')?.rejectionCode, 'ZERO_PROGRESS', '无威胁僵局中重复防御仍有推进价值');
assert.notEqual(stalemateDecision.candidates.find(candidate => candidate.skill?.id === 'attack')?.rejectionCode, 'ZERO_PROGRESS', '僵局处理把正向推进动作误判为零进展');

console.log(JSON.stringify({
  summary: {
    itemChecks: 3,
    equipmentChecks: 2,
    creationChecks: 3,
    summonChecks: 3,
    stalemateChecks: 5,
    passed: true,
  },
}, null, 2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const sandbox = {
  console, structuredClone, Math: Object.create(Math), Date, JSON, Array, Object, String, Number, Boolean,
  RegExp, Map, Set, WeakMap, WeakSet, Symbol, parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
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

const factors = {
  levelGap: ['under', 'peer', 'over'],
  system: ['assault', 'agile', 'control', 'support'],
  skillCount: [1, 3],
  teamSize: [1, 3, 7],
  resource: ['low', 'high'],
  information: ['low', 'high'],
  state: ['normal', 'enemy_controlled'],
  intent: ['defeat', 'survival', 'nonlethal'],
};
const factorNames = Object.keys(factors);
const pairKey = (leftName, leftValue, rightName, rightValue) => `${leftName}=${leftValue}|${rightName}=${rightValue}`;
const uncovered = new Set();
for (let left = 0; left < factorNames.length; left += 1) {
  for (let right = left + 1; right < factorNames.length; right += 1) {
    for (const leftValue of factors[factorNames[left]]) for (const rightValue of factors[factorNames[right]]) {
      uncovered.add(pairKey(factorNames[left], leftValue, factorNames[right], rightValue));
    }
  }
}
const allRows = [];
function enumerateRows(index = 0, row = {}) {
  if (index >= factorNames.length) {
    allRows.push({ ...row });
    return;
  }
  const name = factorNames[index];
  factors[name].forEach(value => enumerateRows(index + 1, { ...row, [name]: value }));
}
enumerateRows();
const coveredPairs = row => {
  const pairs = [];
  for (let left = 0; left < factorNames.length; left += 1) for (let right = left + 1; right < factorNames.length; right += 1) {
    pairs.push(pairKey(factorNames[left], row[factorNames[left]], factorNames[right], row[factorNames[right]]));
  }
  return pairs;
};
const rows = [];
while (uncovered.size) {
  const best = allRows.reduce((winner, row) => {
    const gain = coveredPairs(row).filter(pair => uncovered.has(pair)).length;
    if (!winner || gain > winner.gain) return { row, gain };
    return winner;
  }, null);
  if (!best || best.gain <= 0) throw new Error('r63_pairwise_generation_stalled');
  rows.push(best.row);
  coveredPairs(best.row).forEach(pair => uncovered.delete(pair));
}

const damageSkill = power => ({
  id: `damage-${power}`, name: `推进攻击${power}`, 消耗: { 魂力: 10 },
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: power, 伤害类型: '近身攻击' }],
});
const controlSkill = {
  id: 'control', name: '窗口控制', 消耗: { 魂力: 12 },
  _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: '80%' }],
};
const supportSkill = {
  id: 'support', name: '资源支援', 消耗: { 魂力: 8 },
  _效果数组: [{ 原型: '资源变化', 目标: '单体', 资源: '魂力', 数值: '+30' }],
};

function unit(id, level, system, skillCount, resource, index = 0) {
  const systemName = { assault: '强攻系', agile: '敏攻系', control: '控制系', support: '辅助系' }[system] || '强攻系';
  const skills = [damageSkill(55), ...(skillCount > 1 ? [controlSkill, supportSkill] : [])];
  return {
    id, name: id, 名称: id, level, 系别: systemName, type: systemName,
    hp: 100, HP: 100, hp_max: 100, sp: resource === 'low' ? 12 : 100, sp_max: 100,
    men: 80, men_max: 100, vit: 80, vit_max: 100,
    str: 55 + level + index, def: 45 + level, agi: 40 + level + (/敏攻/.test(systemName) ? 30 : 0),
    属性: { 等级: level, 系别: systemName, HP: 100, HP上限: 100, 魂力: resource === 'low' ? 12 : 100, 魂力上限: 100, 精神力: 80, 精神力上限: 100, 体力: 80, 体力上限: 100, 力量: 55 + level + index, 防御: 45 + level, 敏捷: 40 + level },
    状态: { 存活: true, 行动: '战斗' }, 状态效果: {}, 技能列表: skills,
  };
}

function buildWorld(row) {
  const actorLevel = row.levelGap === 'under' ? 45 : row.levelGap === 'over' ? 90 : 60;
  const enemyLevel = row.levelGap === 'under' ? 90 : row.levelGap === 'over' ? 45 : 60;
  const players = Array.from({ length: row.teamSize }, (_, index) => unit(`ally-${index + 1}`, actorLevel, row.system, row.skillCount, row.resource, index));
  const enemies = Array.from({ length: row.teamSize }, (_, index) => unit(`enemy-${index + 1}`, enemyLevel, index % 2 ? 'agile' : 'assault', row.skillCount, 'high', index));
  if (row.state === 'enemy_controlled') enemies[0].状态效果 = { stun: { 状态: '眩晕', 类型: 'debuff', duration: 1, 战斗效果: { cannot_act: true } } };
  if (row.intent === 'survival') players[0].hp = players[0].HP = players[0].属性.HP = 20;
  if (row.intent === 'nonlethal') enemies[0].hp = enemies[0].HP = enemies[0].属性.HP = 20;
  return { 回合: 1, 战斗意图: row.intent === 'survival' ? '求生' : row.intent === 'nonlethal' ? '点到为止' : '击败', 参战者: { ally: players, enemy: enemies } };
}

const forbiddenClassifications = new Set(['HARD_INVALID', 'DOMINATED']);
for (const [index, row] of rows.entries()) {
  const world = buildWorld(row);
  const before = JSON.stringify(world);
  const result = decision.decide({
    worldSnapshot: world,
    actorId: 'ally-1',
    battleIntent: { mode: world.战斗意图, withdrawAllowed: row.intent === 'survival' },
    beliefState: { confidence: row.information === 'low' ? 0.15 : 0.9 },
    seed: 630000 + index,
  });
  assert.equal(JSON.stringify(world), before, `pairwise场景${index}修改输入`);
  assert.ok(result.candidateCount > 0 && result.scoreAudit.length > 0, `pairwise场景${index}候选或审计为空`);
  assert.ok(!forbiddenClassifications.has(result.selected.classification), `pairwise场景${index}选中禁止分类`);
  assert.ok(!result.selected.rejectionCode, `pairwise场景${index}选中被拒候选`);
  assert.ok(result.scoreAudit.length <= 3, `pairwise场景${index}持久化完整候选池`);
  const hostileTargets = result.candidates.filter(candidate => candidate.declaration.actionKind === 'BASIC_ATTACK').map(candidate => candidate.declaration.targetIds[0]);
  assert.equal(new Set(hostileTargets).size, row.teamSize, `pairwise场景${index}目标池被裁剪`);
}

function candidateUtility(world, actorId, skillId) {
  const result = decision.decide({ worldSnapshot: world, actorId, beliefState: { confidence: 0.8 }, seed: 991 });
  const candidate = result.candidates.find(item => item.skill?.id === skillId);
  assert.ok(candidate, `变形案例缺少候选:${skillId}`);
  return candidate.objectiveUtility;
}

const controlBase = buildWorld({ levelGap: 'peer', system: 'control', skillCount: 3, teamSize: 1, resource: 'high', information: 'high', state: 'normal', intent: 'defeat' });
const controlImmune = structuredClone(controlBase);
controlImmune.参战者.enemy[0].状态效果 = { immunity: { 状态: '控制免疫', 类型: 'buff', duration: 2, 战斗效果: { control_immune: true, cannot_control: true } } };
assert.ok(candidateUtility(controlImmune, 'ally-1', 'control') <= candidateUtility(controlBase, 'ally-1', 'control') + 1e-9, '增加控制免疫反而提高控制效用');

const resourceBase = buildWorld({ levelGap: 'peer', system: 'support', skillCount: 3, teamSize: 2, resource: 'high', information: 'high', state: 'normal', intent: 'defeat' });
resourceBase.参战者.ally[1].sp = resourceBase.参战者.ally[1].属性.魂力 = 0;
const noConsumer = structuredClone(resourceBase);
noConsumer.参战者.ally[1].技能列表 = [damageSkill(55)];
noConsumer.参战者.ally[1].技能列表[0].消耗 = { 魂力: 0 };
assert.ok(candidateUtility(noConsumer, 'ally-1', 'support') <= candidateUtility(resourceBase, 'ally-1', 'support') + 1e-9, '删除资源消费者反而提高资源支援效用');

const reflectBase = buildWorld({ levelGap: 'peer', system: 'assault', skillCount: 1, teamSize: 1, resource: 'high', information: 'high', state: 'normal', intent: 'defeat' });
const reflected = structuredClone(reflectBase);
reflected.参战者.enemy[0].状态效果 = { reflect: { 状态: '反伤', 类型: 'buff', duration: 2, 战斗效果: { damage_reflect: 0.8, reflect_ratio: 0.8 } } };
assert.ok(candidateUtility(reflected, 'ally-1', 'damage-55') <= candidateUtility(reflectBase, 'ally-1', 'damage-55') + 1e-9, '提高反伤反而提高无防护攻击效用');

const summonSkill = duration => ({
  id: 'summon', name: '协同召唤', 消耗: { 魂力: 20 },
  _效果数组: [{ 原型: '召唤生成', 目标: '自身', 生效方式: '独立生效', 召唤单位类型: '魂兽', 召唤物名称: '协同体', 数量: 1, 强度: 0.5, 行动模式: duration > 0 ? '协同攻击' : '', 持续回合: Math.max(1, duration) }],
});
const summonBase = buildWorld({ levelGap: 'peer', system: 'control', skillCount: 1, teamSize: 1, resource: 'high', information: 'high', state: 'normal', intent: 'defeat' });
summonBase.参战者.ally[0].技能列表 = [summonSkill(1)];
const summonNoWindow = structuredClone(summonBase);
summonNoWindow.参战者.ally[0].技能列表 = [summonSkill(0)];
assert.ok(candidateUtility(summonNoWindow, 'ally-1', 'summon') <= candidateUtility(summonBase, 'ally-1', 'summon') + 1e-9, '删除召唤行动窗口反而提高召唤效用');

console.log(JSON.stringify({
  summary: {
    pairwiseCaseCount: rows.length,
    factorCount: factorNames.length,
    pairCount: [...new Set(rows.flatMap(coveredPairs))].length,
    mutationCount: 4,
    passed: true,
  },
}, null, 2));

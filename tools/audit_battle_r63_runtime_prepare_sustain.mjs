import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildWeixiaofengFormalCase } from './battle_v73_formal_case_fixture.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');

function makeNode() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

function createSandbox() {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
    Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
    parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
    navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' }, innerWidth: 1440, innerHeight: 900,
    getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => makeNode(),
    body: { appendChild() {} }, head: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const attackSkill = {
  id: 'runtime-sustain-basic',
  name: '测试突击',
  魂技名: '测试突击',
  消耗: '无',
  前摇: 10,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 20, 伤害类型: '近身攻击', 命中概率: 1 }],
};

function participant(id, side, agility = 120) {
  return {
    id, name: id, 名称: id, type: '强攻系', 系别: '强攻系', side,
    属性: {
      等级: 50, 系别: '强攻系', HP: 2000, HP上限: 2000,
      体力: 500, 体力上限: 500, 魂力: 500, 魂力上限: 500,
      精神力: 200, 精神力上限: 200, 力量: 120, 防御: 120, 敏捷: agility,
    },
    状态: { 存活: true, 位置: '测试场', 行动: '战斗' },
    状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: [structuredClone(attackSkill)],
  };
}

function combatData({ teamSize = 1 } = {}) {
  return {
    回合: 0, 战斗类型: '普通战斗', 战斗意图: '点到为止', 进行中: true,
    参战者: {
      team_player: Array.from({ length: teamSize }, (_, index) => participant(`player-${index + 1}`, 'player', 160 - index)),
      team_enemy: Array.from({ length: teamSize }, (_, index) => participant(`enemy-${index + 1}`, 'enemy', 140 - index)),
    },
  };
}

const sandbox = createSandbox();
for (const relativePath of [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleUI_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), {
  querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; },
});
const container = {
  innerHTML: '',
  querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; },
};
new sandbox.BattleUIComponent(container, {}, {});

const runOneRound = (caseId, data, selectedAction = null) => sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId,
  seed: 63801,
  combatData: data,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: selectedAction || {
    actorId: 'player-1',
    actionKind: 'BASIC_ATTACK',
    targetIds: ['enemy-1'],
  },
  settings: { decisionEngine: 'next-shadow' },
});

const formalSummonCombat = buildWeixiaofengFormalCase(sandbox.__LWCS_内置角色库__);
const formalSummonActor = formalSummonCombat.参战者.team_enemy[0];
const formalSummonSkill = structuredClone(formalSummonActor.第1武魂.第1魂灵.第2魂环.第2魂技);
const formalSummonResult = runOneRound('runtime-formal-summon-window', formalSummonCombat, {
  actorId: '韦小枫',
  actionKind: 'RELEASE_SKILL',
  targetIds: ['唐凌雪'],
  skill: formalSummonSkill,
});
assert.ok(formalSummonResult.ledger.some(event =>
  event?.eventKind === 'action_start' &&
  event?.actionRole === 'ASSIST' &&
  event?.actorName === '青影蛇影'
), '正式协同召唤没有获得真实ASSIST行动窗口');
assert.ok(!formalSummonResult.audit?.fatals?.some(item => item?.code === 'SUMMON_WINDOW_MISSING'), 'ASSIST行动已发生却被误报为召唤窗口缺失');

const paidCombat = combatData();
paidCombat.参战者.team_player[0].持续效果.灼烧领域 = {
  name: '灼烧领域',
  effect_type: 'generic',
  sustain_cost: '魂力:10%',
  技能快照: { name: '灼烧领域', 魂技名: '灼烧领域', 消耗: '无' },
  维持释放效果列表: [{ 原型: '伤害结算', 目标: '敌方群体', 威力倍率: 15, 伤害类型: '元素攻击', 命中概率: 1 }],
  维持存在效果列表: [],
};
const paidResult = runOneRound('runtime-sustain-paid', paidCombat);
const paidCosts = paidResult.ledger.filter(event =>
  event?.eventKind === 'resource_change' &&
  event?.meta?.reasonCode === 'SUSTAIN_RESOURCE_COST' &&
  event?.actorName === 'player-1'
);
assert.equal(paidCosts.length, 1, '维持成本没有且仅有一条独立资源事实');
assert.equal(paidCosts[0].meta.delta, -50, '百分比维持成本没有按资源上限整数结算');
const sustainRoots = paidResult.ledger.filter(event =>
  event?.eventKind === 'state_tick' &&
  event?.ruleCode === 'STRUCTURED_SUSTAIN_TICK' &&
  event?.actionName === '灼烧领域'
);
assert.equal(sustainRoots.length, 1, '同一维持效果没有形成唯一STATE_TICK根');
const sustainHits = paidResult.ledger.filter(event =>
  event?.eventKind === 'hit_result' &&
  event?.actionRole === 'STATE_TICK' &&
  event?.actionName === '灼烧领域' &&
  Number(event?.appliedDamage || 0) > 0
);
assert.equal(sustainHits.length, 1, '维持伤害没有通过结构化提交器落地');
assert.equal(sustainHits[0].targetName, 'enemy-1', '敌方群体维持效果投向了错误阵营');

const insufficientCombat = combatData();
insufficientCombat.参战者.team_player[0].属性.魂力 = 20;
insufficientCombat.参战者.team_player[0].持续效果.枯竭领域 = {
  name: '枯竭领域',
  effect_type: 'domain',
  sustain_cost: '魂力:10%',
  技能快照: { name: '枯竭领域', 魂技名: '枯竭领域', 消耗: '无' },
  维持释放效果列表: [{ 原型: '伤害结算', 目标: '敌方群体', 威力倍率: 15, 伤害类型: '元素攻击', 命中概率: 1 }],
  维持存在效果列表: [],
};
insufficientCombat.参战者.team_player[0].当前领域 = '枯竭领域';
const insufficientResult = runOneRound('runtime-sustain-insufficient', insufficientCombat);
assert.equal(insufficientResult.ledger.filter(event => event?.meta?.reasonCode === 'SUSTAIN_RESOURCE_COST').length, 0, '维持不足时仍扣除了部分资源');
assert.equal(insufficientResult.ledger.filter(event => event?.ruleCode === 'SUSTAIN_RESOURCE_INSUFFICIENT').length, 1, '维持不足没有形成唯一中断事实');
assert.equal(insufficientResult.ledger.filter(event => event?.actionName === '枯竭领域' && event?.eventKind === 'hit_result').length, 0, '维持中断后仍释放效果');

const passiveCombat = combatData();
passiveCombat.参战者.team_player[0].持续效果.静态增幅 = {
  name: '静态增幅',
  effect_type: 'generic',
  sustain_cost: '精神力:5%',
  技能快照: { name: '静态增幅', 魂技名: '静态增幅', 消耗: '无' },
  维持释放效果列表: [],
  维持存在效果列表: [{ 原型: '属性修正', 目标: '自身', 属性: '防御', 数值: '+10%' }],
};
const passiveResult = runOneRound('runtime-sustain-passive', passiveCombat);
assert.equal(passiveResult.ledger.filter(event => event?.actionName === '静态增幅' && event?.ruleCode === 'STRUCTURED_SUSTAIN_TICK').length, 0, '仅维持存在效果被重复释放');
assert.equal(passiveResult.ledger.filter(event => event?.meta?.reasonCode === 'SUSTAIN_RESOURCE_COST' && event?.meta?.resource === '精神力').length, 1, '仅维持存在效果没有正常支付维持成本');

const scopeCombat = combatData({ teamSize: 2 });
scopeCombat.参战者.team_player[0].持续效果.范围校验 = {
  name: '范围校验',
  effect_type: 'generic',
  sustain_cost: '无',
  技能快照: { name: '范围校验', 魂技名: '范围校验', 消耗: '无' },
  维持释放效果列表: [
    { 原型: '状态施加', 目标: '自身', 状态: '自身校验', 持续回合: 1, 成功率: 1 },
    { 原型: '状态施加', 目标: '友方', 状态: '友方校验', 持续回合: 1, 成功率: 1 },
    { 原型: '状态施加', 目标: '敌方群体', 状态: '敌群校验', 持续回合: 1, 成功率: 1 },
    { 原型: '状态施加', 目标: '全场', 状态: '全场校验', 持续回合: 1, 成功率: 1 },
  ],
  维持存在效果列表: [],
};
const scopeResult = runOneRound('runtime-sustain-target-scopes', scopeCombat);
const scopeFacts = scopeResult.ledger.filter(event => event?.eventKind === 'state_apply' && event?.actionName === '范围校验');
const targetsFor = stateName => new Set(scopeFacts.filter(event => event?.meta?.stateName === stateName).map(event => event.targetName));
assert.deepEqual([...targetsFor('自身校验')], ['player-1'], '自身维持目标解析错误');
assert.deepEqual([...targetsFor('友方校验')], ['player-2'], '单体友方维持目标解析错误');
assert.deepEqual([...targetsFor('敌群校验')].sort(), ['enemy-1', 'enemy-2'], '敌方群体维持目标解析不完整');
assert.deepEqual([...targetsFor('全场校验')].sort(), ['enemy-1', 'enemy-2', 'player-1', 'player-2'], '全场维持目标解析不完整');

const summonCombat = combatData();
summonCombat.参战者.team_player[0].状态效果['召唤:旧镜像协同体'] = {
  类型: 'buff',
  状态: '召唤:旧镜像协同体',
  duration: 2,
  召唤物: {
    召唤键: 'existing-summon-1',
    召唤单位类型: '魂兽',
    召唤物名称: '旧镜像协同体',
    行动模式: '自主行动',
    生命: 300,
    生命上限: 300,
    继承属性比例: 0.4,
    精神负载: 10,
    生成回合: 0,
    已消散: false,
    技能列表: [structuredClone(attackSkill)],
  },
};
const summonResult = runOneRound('runtime-prepare-hydrates-summon', summonCombat);
const summonStarts = summonResult.ledger.filter(event => event?.eventKind === 'action_start' && event?.actorName === '旧镜像协同体');
assert.equal(summonStarts.length, 1, '已有召唤镜像没有水合为唯一自主行动单位');
assert.ok(summonResult.decisions.some(entry => entry?.actorId === 'existing-summon-1'), '水合召唤没有进入正式决策链');

const malformed = combatData();
delete malformed.参战者.team_player[0].属性;
assert.throws(
  () => runOneRound('runtime-prepare-rejects-legacy-shape', malformed),
  /battle_runtime_latest_unit_structure_invalid/,
  'Runtime prepare接受了旧简化参战者结构',
);

const uiSource = fs.readFileSync(path.resolve(root, 'lwcs/BattleUI_Module.js'), 'utf8');
const binding = uiSource.match(/BATTLE_RUNTIME\.bindSettlementPrimitives\(\{[\s\S]*?\n\s*}\);/)?.[0] || '';
assert.match(binding, /executeQueue:/, 'BattleUI缺少最后一个正式队列绑定');
assert.doesNotMatch(binding, /prepare:|settleSustain:/, 'BattleUI仍绑定prepare或settleSustain');

console.log(JSON.stringify({
  summary: {
    sustainCostFacts: paidCosts.length,
    sustainHitFacts: sustainHits.length,
    sustainBreakFacts: insufficientResult.ledger.filter(event => event?.ruleCode === 'SUSTAIN_RESOURCE_INSUFFICIENT').length,
    targetScopeFacts: scopeFacts.length,
    hydratedSummonActions: summonStarts.length,
    passed: true,
  },
}, null, 2));

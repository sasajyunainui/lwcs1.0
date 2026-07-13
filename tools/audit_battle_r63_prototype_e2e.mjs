import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');

function nodeStub() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

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
  documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => nodeStub(),
  body: { appendChild() {} }, head: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const relativePath of [
  'lwcs/CharacterLibrary.js', 'lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js', 'lwcs/BattleUI_Module.js',
]) vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
const recordNode = Object.assign(nodeStub(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(nodeStub(), { querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; } });
new sandbox.BattleUIComponent({ innerHTML: '', querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; } }, {}, {});

const effects = {
  伤害结算: { 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' },
  资源变化: { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' },
  资源转移: { 原型: '资源转移', 目标: '单体', 资源: '魂力', 数值: '10', 资源转移方式: '转移' },
  护盾变化: { 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+20' },
  属性修正: { 原型: '属性修正', 目标: '自身', 属性: '力量', 数值: '+10%', 持续回合: 1 },
  判定修正: { 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%', 持续回合: 1 },
  结算修正: { 原型: '结算修正', 目标: '自身', 结算: '造成伤害', 数值: '+10%', 持续回合: 1 },
  炸环: { 原型: '炸环', 目标: '自身', 强化倍率: 1.5 },
  状态施加: { 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: '100%' },
  时窗修正: { 原型: '时窗修正', 目标: '单体', 调整字段: '持续回合', 调整方式: '延长', 调整回合: 1 },
  状态移除: { 原型: '状态移除', 目标: '自身', 状态: '任意负面', 数量: 1 },
  规则防御: { 原型: '规则防御', 目标: '自身', 规则: '免伤', 次数: 1 },
  状态转移: { 原型: '状态转移', 目标: '单体', 状态: '任意负面', 来源: '自身', 去向: '目标', 数量: 1 },
  状态交换: { 原型: '状态交换', 目标: '单体', 状态: '任意负面' },
  资源锁定: { 原型: '资源锁定', 目标: '单体', 资源: '魂力', 锁定类型: '资源池锁定', 数值: '-50%' },
  规则改写: { 原型: '规则改写', 目标: '单体', 规则: '缴械', 数值: '+25%' },
  机制抹消: { 原型: '机制抹消', 目标: '单体', 抹消对象: { 原型: '状态施加', 状态: '眩晕' } },
  机制授予: { 原型: '机制授予', 目标: '自身', 触发条件: '随下次行动触发', 授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }] },
  复制执行: { 原型: '复制执行', 目标: '自身', 复制类型: '复制属性', 复制模式: '即时镜像', 削减比例: '20%', 使用效果: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击' }] },
  时光回溯: { 原型: '时光回溯', 目标: '单体', 发动方式: '主动' },
  位移执行: { 原型: '位移执行', 目标: '单体', 位移类型: '击退', 位移对象: '目标', 距离: 3 },
  决策干扰: { 原型: '决策干扰', 目标: '单体', 干扰: '判断干扰', 数值: '-20%', 持续回合: 1 },
  召唤生成: { 原型: '召唤生成', 目标: '自身', 生效方式: '独立生效', 召唤单位类型: '魂兽', 召唤物名称: '测试召唤物', 数量: 1, 强度: 1, 行动模式: '协同攻击', 持续回合: 1 },
};

function participant(id, skill = null) {
  return {
    id, name: id, 名称: id, type: '强攻系', 系别: '强攻系', hp: 500, HP: 500, hp_max: 500,
    sp: 300, sp_max: 500, men: 200, men_max: 200, vit: 500, vit_max: 500, str: 180, def: 120, agi: 150,
    属性: { 等级: 50, 系别: '强攻系', HP: 500, HP上限: 500, 魂力: 300, 魂力上限: 500, 精神力: 200, 精神力上限: 200, 体力: 500, 体力上限: 500, 力量: 180, 防御: 120, 敏捷: 150 },
    状态: { 存活: true, 位置: '原型审计场', 行动: '战斗' },
    状态效果: { poison: { 状态: '中毒', 类型: 'debuff', duration: 2 } },
    持续效果: {}, 背包: {}, 技能列表: skill ? [skill] : [],
    第1武魂: { 武魂名称: '测试武魂', 第1魂环: { id: 'ring:e2e', 年限: 1000, 状态: '可用' } },
  };
}

function worldFor(prototype, effect) {
  const skill = {
    id: `e2e:${prototype}`, name: `端到端${prototype}`, 魂技名: `端到端${prototype}`, 消耗: '无', 前摇: 0,
    ringId: prototype === '炸环' ? 'ring:e2e' : undefined,
    __魂环路径: prototype === '炸环' ? ['第1武魂', '第1魂环'] : undefined,
    historySnapshot: prototype === '时光回溯' ? { hp: 450, HP: 450, sp: 250 } : undefined,
    _效果数组: [
      { effectId: `effect:${prototype}`, ...structuredClone(effect) },
      ...(prototype === '炸环' ? [{ effectId: 'effect:ring-damage', 原型: '伤害结算', 目标: '单体', 威力倍率: 40, 伤害类型: '近身攻击' }] : []),
    ],
  };
  const actor = participant('actor', skill);
  const target = participant('target');
  actor.agi = 500;
  actor.属性.敏捷 = 500;
  target.agi = 1;
  target.属性.敏捷 = 1;
  target.状态效果 = { guard: { 状态: '强化', 类型: 'buff', duration: 2 } };
  return {
    skill,
    combatData: { 回合: 0, 战斗类型: '普通战斗', 战斗意图: '击败', 进行中: true, 参战者: { team_player: [actor], team_enemy: [target] } },
  };
}

const coverage = [];
for (const [prototype, effect] of Object.entries(effects)) {
  const { skill, combatData } = worldFor(prototype, effect);
  const targetIds = effect.目标 === '自身' && prototype !== '炸环' ? ['actor'] : ['target'];
  const previewResult = sandbox.__LWCS_BATTLE_PREVIEW__.previewAction({
    worldSnapshot: combatData,
    actorId: 'actor',
    worldRevision: `e2e-preview:${prototype}`,
    declaration: {
      actionId: `e2e:${prototype}`, actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds, skill,
      ringId: skill.ringId, historySnapshot: skill.historySnapshot ? combatData : undefined,
    },
  });
  assert.ok(previewResult.contributions.length || previewResult.scheduledEvents.length || Object.keys(previewResult.changedRules).length, `${prototype}正例预估无事实`);
  const before = JSON.stringify(combatData);
  const execution = sandbox.__LWCS_BATTLE_RUNTIME__.executeDeclaration({
    combatData,
    declaration: { actionKind: 'RELEASE_SKILL', actorId: 'actor', targetIds, skill },
    actionOpportunity: { role: 'ACTIVE', sequence: 1 },
    seed: 76300 + coverage.length,
  });
  const ledger = sandbox.__LWCS_BATTLE_RUNTIME__.ensureLedger(combatData);
  const trace = sandbox.__LWCS_BATTLE_RUNTIME__.ensureTrace(combatData);
  const reportBlocks = sandbox.__LWCS_BATTLE_RUNTIME__.buildReportBlocks(ledger, [], []);
  assert.ok(Number(execution?.rounds || 0) === 1, `${prototype}未通过正式ActionQueue执行`);
  const actionStart = ledger.find(event => event?.eventKind === 'action_start' && event?.actorControl === 'PLAYER_LOCKED');
  assert.ok(actionStart, `${prototype}缺少正式声明事实`);
  assert.equal(ledger.filter(event => event?.eventKind === 'action_start' && String(event?.actorName || '').trim() === 'actor' && String(event?.actionName || '').trim() === `端到端${prototype}`).length, 1, `${prototype}为同一动作创建了多个ACTIVE根`);
  const actionFacts = ledger.filter(event => event !== actionStart && String(event?.sourceActionId || event?.actionId || '').trim() === String(actionStart.actionId || '').trim());
  assert.ok(actionFacts.length > 0, `${prototype}缺少绑定本动作的正式结算事实`);
  const successfulFacts = actionFacts.filter(event => !['failed_action', 'blocked_action', 'blocked_settlement', 'target_fail', 'dodge', 'defend', 'pass'].includes(String(event?.eventKind || '').trim()) && !/fail|blocked|no_effect|invalid|失败|无效|阻断/i.test(String(event?.result || event?.resultState || event?.meta?.result || '')));
  assert.ok(successfulFacts.length > 0, `${prototype}正例只有失败或阻断事实:${JSON.stringify({ actionFacts, related: ledger.filter(event => String(event?.actionName || '').includes(prototype) || String(event?.eventKind || '') === 'summon_create') })}`);
  assert.ok(!actionFacts.some(event => ['failed_action', 'blocked_action', 'blocked_settlement'].includes(String(event?.eventKind || '').trim())), `${prototype}正例同时产生成功与失败终态:${JSON.stringify(actionFacts)}`);
  assert.ok(trace.length > 0, `${prototype}缺少正式Trace`);
  const factIds = new Set(actionFacts.map(event => String(event?.eventId || '').trim()).filter(Boolean));
  assert.ok(reportBlocks.some(block => (block?.facts || []).some(fact => factIds.has(String(fact?.sourceEventId || fact?.eventId || '').trim()) || String(fact?.sourceActionId || '').trim() === String(actionStart.actionId || '').trim())), `${prototype}缺少本动作事实的结构化战报投影:${JSON.stringify(reportBlocks)}`);
  assert.notEqual(JSON.stringify(combatData), before, `${prototype}正式正例未产生任何战斗态变化`);

  const invalid = worldFor(prototype, effect).combatData;
  invalid.参战者.team_enemy[0].状态.存活 = false;
  invalid.参战者.team_enemy[0].hp = 0;
  invalid.参战者.team_enemy[0].HP = 0;
  invalid.参战者.team_enemy[0].属性.HP = 0;
  if (effect.目标 !== '自身') {
    assert.throws(() => sandbox.__LWCS_BATTLE_RUNTIME__.executeDeclaration({
      combatData: invalid,
      declaration: { actionKind: 'RELEASE_SKILL', actorId: 'actor', targetIds: ['target'], skill },
      seed: 86300 + coverage.length,
    }), /battle_declaration_mechanically_illegal/, `${prototype}反例接受死亡目标`);
  } else {
    const invalidEffect = structuredClone(effect);
    invalidEffect.原型 = '不存在的原型';
    assert.throws(() => sandbox.__LWCS_BATTLE_PREVIEW__.previewAction({
      worldSnapshot: invalid,
      actorId: 'actor',
      worldRevision: `e2e-negative:${prototype}`,
      declaration: { actionId: `e2e-negative:${prototype}`, actorId: 'actor', actionKind: 'RELEASE_SKILL', targetIds: ['actor'], skill: { _效果数组: [invalidEffect] } },
    }), /battle_preview_unknown_prototype/, `${prototype}反例接受未知原型`);
  }
  coverage.push({ prototype, preview: true, settlement: true, ledger: true, report: true, positive: true, negative: true, eventKinds: [...new Set(successfulFacts.map(event => String(event?.eventKind || '').trim()))] });
}

assert.deepEqual(coverage.map(item => item.prototype).sort(), [...sandbox.__LWCS_BATTLE_PREVIEW__.battlePrototypes].sort(), '端到端原型覆盖与共享注册表不一致');
console.log(JSON.stringify({ summary: { prototypeCount: coverage.length, positiveCount: coverage.filter(item => item.positive).length, negativeCount: coverage.filter(item => item.negative).length, passed: true }, coverage }, null, 2));

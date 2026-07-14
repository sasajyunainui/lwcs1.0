import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const lwcsRoot = path.resolve(toolDir, '..');
const bridgeSource = fs.readFileSync(path.join(lwcsRoot, 'mvu_logic_bridge.js'), 'utf8');

function sourceSlice(startMarker, endMarker) {
  const start = bridgeSource.indexOf(startMarker);
  const end = bridgeSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法抽取生产代码:${startMarker}`);
  return bridgeSource.slice(start, end);
}

const parserSandbox = {
  toText(value, fallback = '') { return value === undefined || value === null ? String(fallback) : String(value); },
  toNumber(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : Number(fallback) || 0; },
  cloneJsonValue(value, fallback) { try { return structuredClone(value); } catch { return fallback; } },
  structuredClone,
  战斗条件输入存在(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return String(value || '').trim().length > 0;
  },
};
vm.createContext(parserSandbox);
vm.runInContext(`${sourceSlice('const 战斗目标条件字段模式', 'function 解析模块路由字段值')}\nthis.__buildObjectives = 构建战斗胜负条件;`, parserSandbox);
vm.runInContext(`
  function 设置模块路由字段(payload, field, value) {
    const key = String(field || '').trim();
    payload[key] = /^(最大回合|回合上限)$/.test(key) ? Number(value) : String(value || '').trim();
  }
  ${sourceSlice('function 解析模块路由字段块(文本)', 'function 解析模块路由字段块列表')}
  this.__parseRouteBlock = 解析模块路由字段块;
`, parserSandbox);

const participants = {
  team_player: [{ id: 'player-a', name: '唐凌雪' }, { id: 'player-b', name: '古月' }],
  team_enemy: [{ id: 'enemy-a', name: '韦小枫' }, { id: 'enemy-b', name: '舞丝朵' }],
};

const multiline = parserSandbox.__parseRouteBlock(`
模块：battle
胜利条件关系：aNd
胜利条件：
- 类型：生命阈值
  目标：敌方全体
  阈值：30%
- 类型：坚持回合
  目标回合：10
失败条件关系：oR
失败条件：
- 类型：指定单位受伤
  目标：唐凌雪
最大回合：10
`);
const contract = parserSandbox.__buildObjectives(multiline, participants, 0);
assert.ok(contract, '多行目标块没有生成结构化契约');
assert.equal(contract.victory.logic, 'ALL', '小写AND没有归一为全部成立');
assert.equal(contract.defeat.logic, 'ANY', '混合大小写OR没有归一为任一成立');
assert.equal(contract.victory.conditions[0].side, 'ENEMY', '胜利生命阈值没有默认作用于敌方');
assert.equal(contract.victory.conditions[0].scope, 'ALL', '敌方全体没有解析为ALL');
assert.equal(contract.victory.conditions[1].side, 'PLAYER', '坚持回合没有默认作用于我方');
assert.equal(contract.victory.conditions[1].round, 10, '目标回合解析错误');
assert.deepEqual([...contract.defeat.conditions[0].targetIds], ['唐凌雪'], '指定单位目标丢失');

for (const separator of [' ', '|', '_', ',', '，', ';', '；', '、']) {
  const text = ['类型=生命阈值', '目标=敌方任一', '阈值=25%'].join(separator);
  const parsed = parserSandbox.__buildObjectives({
    胜利条件: text,
    失败条件: '类型=指定单位失能|目标=唐凌雪',
    胜利条件关系: 'OR',
    失败条件关系: 'OR',
    最大回合: 5,
  }, participants, 0);
  assert.ok(parsed, `分隔符未被兼容:${JSON.stringify(separator)}`);
  assert.equal(parsed.victory.conditions[0].scope, 'ANY', `敌方任一解析错误:${JSON.stringify(separator)}`);
}

const namedTargets = parserSandbox.__buildObjectives({
  胜利条件: '类型：指定单位失能 目标：韦小枫、舞丝朵',
  失败条件: '类型：全员死亡',
  胜利条件关系: 'OR',
  失败条件关系: 'OR',
  最大回合: 6,
}, participants, 0);
assert.deepEqual([...namedTargets.victory.conditions[0].targetIds], ['韦小枫', '舞丝朵'], '多个实名目标解析错误');
assert.equal(namedTargets.defeat.conditions[0].type, 'TEAM_DEAD', '死亡与失能类型没有分离');
assert.equal(namedTargets.defeat.conditions[0].side, 'PLAYER', '失败条件没有默认作用于我方');

const invalidCases = [
  { reason: '未知单位', detail: { 胜利条件: '类型：指定单位失能 目标：不存在', 失败条件: '类型：全员失能', 最大回合: 5 } },
  { reason: '跨阵营目标', detail: { 胜利条件: '类型：指定单位失能 作用方：敌方 目标：唐凌雪', 失败条件: '类型：全员失能', 最大回合: 5 } },
  { reason: '目标回合越界', detail: { 胜利条件: '类型：坚持回合 目标回合：6', 失败条件: '类型：全员失能', 最大回合: 5 } },
  { reason: '非法关系', detail: { 胜利条件: '类型：全员失能', 失败条件: '类型：全员失能', 胜利条件关系: 'XOR', 最大回合: 5 } },
];
invalidCases.forEach(({ reason, detail }) => assert.equal(parserSandbox.__buildObjectives(detail, participants, 0), null, `${reason}没有拒绝`));

function makeNode() {
  return {
    style: {}, dataset: {}, innerHTML: '', textContent: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, toggleAttribute() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }; },
  };
}

const battleSandbox = {
  console, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
  parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
  navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' }, innerWidth: 1440, innerHeight: 900,
  getComputedStyle: () => ({ getPropertyValue: () => '', zIndex: '1' }),
  ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
};
battleSandbox.document = {
  documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => makeNode(),
  body: makeNode(), head: makeNode(), querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
};
battleSandbox.window = battleSandbox;
battleSandbox.globalThis = battleSandbox;
battleSandbox.self = battleSandbox;
vm.createContext(battleSandbox);
for (const file of ['CharacterLibrary.js', 'MVU_Skill_Runtime.js', 'BattlePreview_Module.js', 'BattleDecision_Module.js', 'BattleRuntime_Module.js', 'BattleUI_Module.js']) {
  vm.runInContext(fs.readFileSync(path.join(lwcsRoot, file), 'utf8'), battleSandbox, { filename: file });
}
const root = makeNode();
root.querySelector = selector => selector === '.battle-module-scope' ? root : null;
new battleSandbox.BattleUIComponent(root, {}, {});

const preview = battleSandbox.__LWCS_BATTLE_PREVIEW__;
const directStructured = preview.normalizeBattleObjectives({
  maxRounds: 20,
  victory: {
    logic: 'aNd',
    conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }],
  },
  defeat: {
    logic: 'oR',
    conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }],
  },
});
assert.equal(directStructured?.victory?.logic, 'ALL', '直接结构化条件没有兼容AND大小写');
assert.equal(directStructured?.defeat?.logic, 'ANY', '直接结构化条件没有兼容OR大小写');
assert.equal(directStructured?.maxRounds, 20, '结构化回合上限没有限制为20');
assert.equal(preview.shouldTriggerTraumaUnconscious(49.99, 19.99, 100), false, '低于50%的单段伤害错误触发昏迷');
assert.equal(preview.shouldTriggerTraumaUnconscious(50, 20, 100), false, '命中后恰好20%错误触发昏迷');
assert.equal(preview.shouldTriggerTraumaUnconscious(50, 19.99, 100), true, '50%单段且低于20%没有触发昏迷');
assert.equal(preview.shouldTriggerTraumaUnconscious(100, 0, 100), false, '致死伤害错误转为昏迷');
assert.equal(preview.shouldTriggerTraumaUnconscious(30, 19, 100), false, '多段累计伤害被错误当作单段重创');

const unit = (id, side, hp = 100) => ({
  id, name: id, 名称: id, side, type: '强攻系', 系别: '强攻系',
  属性: { 等级: 50, HP: hp, HP上限: 100, 体力: 100, 体力上限: 100, 魂力: 100, 魂力上限: 100, 精神力: 100, 精神力上限: 100, 力量: 200, 防御: 1, 敏捷: side === 'player' ? 500 : 1, 状态效果: {} },
  状态: { 存活: true, 行动: '战斗' }, 状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: [],
});
const finisher = {
  id: 'trauma-test', name: '重创测试', 魂技名: '重创测试', 消耗: '无', 前摇: 1,
  _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 10000, 伤害类型: '近身攻击', 命中率: '100%', 生效方式: '独立生效' }],
};
const combatData = {
  回合: 0, 战斗类型: '切磋', 战斗意图: '点到为止', 进行中: true,
  参战者: { team_player: [unit('player-a', 'player')], team_enemy: [unit('enemy-a', 'enemy')] },
  胜负条件: {
    version: 1, startRound: 0, maxRounds: 2,
    victory: { logic: 'ANY', conditions: [{ type: 'UNIT_INCAPACITATED', side: 'ENEMY', targetIds: ['enemy-a'] }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'UNIT_INCAPACITATED', side: 'PLAYER', targetIds: ['player-a'] }] },
  },
};
combatData.参战者.team_player[0].技能列表 = [structuredClone(finisher)];
const result = battleSandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'route-objective-trauma-unconscious', seed: 7414, combatData, mode: 'team_preview', rounds: 1,
  selectedAction: { actor_name: 'player-a', target_name: 'enemy-a', type: '释放魂技', action_type: '释放魂技', skill: structuredClone(finisher) },
  settings: {},
});
const enemy = result.finalSnapshot.team_enemy[0];
assert.ok(Number(enemy.hp || 0) > 0, '非致死重创错误写成死亡');
assert.match(String(enemy.actionState || enemy.行动 || ''), /昏迷/, `正式伤害结算没有写入昏迷:${JSON.stringify({ enemy, traumaFacts: result.ledger.filter(event => event?.ruleCode === 'TRAUMA_UNCONSCIOUS') })}`);
assert.ok(result.ledger.some(event => event?.ruleCode === 'TRAUMA_UNCONSCIOUS' && event?.eventKind === 'state_apply'), '重创昏迷缺少结构化Ledger事实');
const traumaHitIndex = result.ledger.findIndex(event => event?.eventKind === 'hit_result' && event?.actionName === '重创测试');
const traumaStateIndex = result.ledger.findIndex(event => event?.ruleCode === 'TRAUMA_UNCONSCIOUS' && event?.eventKind === 'state_apply');
const traumaStateFact = result.ledger[traumaStateIndex];
assert.ok(traumaHitIndex >= 0 && traumaStateIndex > traumaHitIndex, '重创昏迷事实没有在命中伤害提交后生成');
assert.equal(Number(traumaStateFact?.appliedDamage || 0), 0, '重创昏迷状态事实重复携带实际伤害');
assert.equal(Object.prototype.hasOwnProperty.call(traumaStateFact?.meta || {}, 'damage'), false, '重创昏迷状态元数据仍使用伤害字段制造重复投影');
assert.equal(traumaStateFact?.actionName, '重创测试', '重创昏迷没有保留真实来源动作');
assert.ok(Number(traumaStateFact?.meta?.triggerDamage || 0) > 0 && Number(traumaStateFact?.meta?.singleHitRatio || 0) >= 0.5, '重创昏迷缺少玩家不可见的阈值审计依据');
assert.equal(result.finalBattleReport?.objectiveWinner, 'player', '失能条件没有与战斗裁断联动');

const dead = unit('dead-unit', 'enemy', 0);
dead.状态.存活 = false;
const exhausted = unit('exhausted-unit', 'enemy', 80);
exhausted.属性.体力 = 0;
assert.equal(preview.isDead(dead), true, '死亡判定失败');
assert.equal(preview.isDead(exhausted), false, '体力耗尽错误归类为死亡');
assert.equal(preview.isBattleCapable(exhausted), false, '体力耗尽没有归类为失能');

const exhaustionCombatData = {
  回合: 0, 战斗类型: '切磋', 战斗意图: '守护', 进行中: true,
  参战者: { team_player: [unit('exhaustion-player', 'player')], team_enemy: [unit('exhaustion-enemy', 'enemy', 0)] },
  胜负条件: {
    version: 1, explicit: true, startRound: 0, maxRounds: 2, resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: [{ type: 'ROUND_REACHED', side: 'PLAYER', round: 2, requireActive: true }] },
    defeat: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }] },
  },
};
exhaustionCombatData.参战者.team_enemy[0].状态.存活 = false;
const exhaustionResult = battleSandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'route-objective-battlefield-exhaustion', seed: 7415, combatData: exhaustionCombatData,
  mode: 'team_preview', rounds: 1, settings: {},
});
const exhaustionEvent = exhaustionResult.ledger.find(event => event?.eventKind === 'battle_objective_resolved');
assert.equal(exhaustionResult.finalBattleReport?.objectiveWinner, 'player', '敌方全员失能没有形成统一胜利裁断');
assert.equal(exhaustionEvent?.meta?.terminalReason, 'BATTLEFIELD_ENEMY_EXHAUSTED', '敌方全员失能缺少终局原因');
assert.equal(exhaustionResult.finalBattleReport?.headline, '我方获胜', '终局事实与最终标题不一致');

const bothExhausted = structuredClone(exhaustionCombatData);
bothExhausted.参战者.team_player[0].属性.体力 = 0;
bothExhausted.胜负条件.resolutionPriority = 'DRAW_ON_CONFLICT';
const conflict = preview.evaluateBattleObjectives(bothExhausted, bothExhausted.胜负条件, {
  round: 0,
  roundCompleted: false,
});
assert.equal(conflict.winner, 'draw', '双方同时失能没有按冲突策略裁断为平局');
assert.equal(conflict.terminalReason, 'BATTLEFIELD_BOTH_EXHAUSTED', '双方同时失能缺少统一终局原因');

console.log(JSON.stringify({
  summary: {
    parserDelimiterCount: 8,
    invalidCaseCount: invalidCases.length,
    traumaLedgerFacts: result.ledger.filter(event => event?.ruleCode === 'TRAUMA_UNCONSCIOUS').length,
    objectiveWinner: result.finalBattleReport?.objectiveWinner || '',
    exhaustionWinner: exhaustionResult.finalBattleReport?.objectiveWinner || '',
    exhaustionTerminalReason: exhaustionEvent?.meta?.terminalReason || '',
    conflictWinner: conflict.winner,
    passed: true,
  },
}, null, 2));

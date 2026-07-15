import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildWeixiaofengFormalCase } from './battle_v73_formal_case_fixture.mjs';

const requestedCaseIndex = process.argv.indexOf('--case');
const requestedCase = String(requestedCaseIndex >= 0 ? process.argv[requestedCaseIndex + 1] : 'weixiaofeng_20_round').trim();

function makeNode() {
  return {
    style: {},
    dataset: {},
    isConnected: true,
    innerHTML: '',
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

function createSandbox() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    Math,
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
    navigator: { userAgent: 'node' },
    location: { href: 'http://localhost/' },
    innerWidth: 1440,
    innerHeight: 900,
    getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1440, clientHeight: 900 },
    createElement: () => makeNode(),
    body: { appendChild() {} },
    head: { appendChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildFixedParticipant(name, type, stats, extra = {}) {
  const extraData = deepClone(extra || {});
  const extraAttributes = extraData.属性 && typeof extraData.属性 === 'object' ? extraData.属性 : {};
  const extraState = extraData.状态 && typeof extraData.状态 === 'object' ? extraData.状态 : {};
  delete extraData.属性;
  delete extraData.状态;
  return {
    ...extraData,
    name,
    名称: name,
    type,
    系别: type,
    属性: {
      ...extraAttributes,
      等级: Number(stats.level || 21),
      系别: type,
      HP: Number(stats.hp || 2000),
      HP上限: Number(stats.hp || 2000),
      体力: Number(stats.vit || 9000),
      体力上限: Number(stats.vit || 9000),
      魂力: Number(stats.sp || 12000),
      魂力上限: Number(stats.sp || 12000),
      精神力: Number(stats.men || 5000),
      精神力上限: Number(stats.men || 5000),
      力量: Number(stats.str || 220),
      防御: Number(stats.def || 150),
      敏捷: Number(stats.agi || 150),
      状态效果: {},
    },
    状态: { ...extraState, 存活: true, 位置: '东海学院切磋场', 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
  };
}

function buildFormalCase(characterLibrary) {
  const record = characterLibrary?.角色?.韦小枫;
  const snapshot = deepClone(record?.快照?.[0]?.角色 || {});
  assert.ok(snapshot?.第1武魂?.第1魂灵?.第1魂环?.第1魂技, '韦小枫正式第一魂技缺失');
  assert.ok(snapshot?.第1武魂?.第1魂灵?.第2魂环?.第2魂技, '韦小枫正式第二魂技缺失');

  const tang = buildFixedParticipant('唐凌雪', '食物系', {
    level: 18,
    hp: 565,
    vit: 565,
    sp: 2166,
    men: 21,
    str: 565,
    def: 565,
    agi: 282,
  }, {
    第1武魂: {
      表象名称: '牛肉干',
      系别: '食物系',
      第1魂灵: {
        表象名称: '百年美味蚕',
        年限: 400,
        第1魂环: {
          年限: 400,
          第1魂技: {
            魂技名: '香喷喷牛肉干',
            画面描述: '魂环闪烁，一块温热的牛肉干在掌心凝聚。',
            效果描述: '消耗魂力542。制造一块香喷喷牛肉干；制作者自用后在2回合内恢复300点魂力。',
            产物描述: '一块蕴含食物系魂力的牛肉干。',
            承载方式: '造物承载',
            消耗: { 魂力: 542 },
            前摇: 20,
            _效果数组: [{
              数量: 1,
              使用效果: [{
                原型: '资源变化',
                目标: '自身',
                持续回合: 2,
                资源: '魂力',
                数值: '+21.13%',
                生效方式: '独立生效',
                条件分支: [{
                  条件: [{ 类型: '使用者', 对象: '使用者', 比较: '==', 值: '制作者' }],
                  处理: '替换效果',
                  替换效果: [{ 原型: '资源变化', 目标: '自身', 持续回合: 2, 资源: '魂力', 数值: 300, 生效方式: '独立生效' }],
                }],
              }],
              有效期tick: 127,
            }],
          },
        },
      },
    },
    第2武魂: { 表象名称: '五行麒麟', 系别: '强攻系', 属性体系: '无', 可调用元素: ['无'] },
  });
  const wei = buildFixedParticipant('韦小枫', '敏攻系', {
    level: 21,
    hp: 538,
    vit: 538,
    sp: 2039,
    men: 33,
    str: 538,
    def: 474,
    agi: 522,
  }, snapshot);

  return {
    回合: 0,
    战斗类型: '普通战斗',
    战斗意图: '点到为止',
    进行中: true,
    参战者: { team_player: [tang], team_enemy: [wei] },
  };
}

function injectAndRequire(auditFacts, baseResult, code, mutator) {
  const payload = {
    eventLedger: deepClone(baseResult.eventLedger || []),
    resolutionTrace: deepClone(baseResult.resolutionTrace || []),
    publicReportBlocks: deepClone(baseResult.publicReportBlocks || []),
    scoringAudit: deepClone(baseResult.scoringAudit || []),
    initialSnapshot: deepClone(baseResult.initialSnapshot || null),
    finalSnapshot: deepClone(baseResult.finalSnapshot || null),
    actionQueueTrace: deepClone(baseResult.actionQueueTrace || []),
  };
  mutator(payload);
  const audit = auditFacts(payload);
  assert.ok(audit.fatals.some(item => item.code === code), `负面注入未捕获: ${code}`);
  return audit.fatals.filter(item => item.code === code).length;
}

const sandbox = createSandbox();
vm.runInContext(fs.readFileSync(path.resolve('lwcs/CharacterLibrary.js'), 'utf8'), sandbox, { filename: 'lwcs/CharacterLibrary.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/MVU_Skill_Runtime.js'), 'utf8'), sandbox, { filename: 'lwcs/MVU_Skill_Runtime.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattlePreview_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattlePreview_Module.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattleDecision_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattleDecision_Module.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattleRuntime_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattleRuntime_Module.js' });
vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattleUI_Module.js'), 'utf8'), sandbox, { filename: 'lwcs/BattleUI_Module.js' });

const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
const scopeNode = Object.assign(makeNode(), {
  querySelector(selector) { return selector === '#ui-battle-record-terminal' ? recordNode : null; },
});
const container = {
  innerHTML: '',
  querySelector(selector) { return selector === '.battle-module-scope' ? scopeNode : null; },
};
new sandbox.BattleUIComponent(container, {}, {});

assert.equal(typeof sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__, 'function', '缺少 V7.3 调试案例入口');
assert.equal(typeof sandbox.__LWCS_BATTLE_RUNTIME__?.auditFacts, 'function', '缺少 V7.3 事实审计接口');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME_REGISTRY_SOURCE__, 'shared', '正式案例没有使用共享技能原型注册表');
assert.ok(['weixiaofeng_20_round', 'all'].includes(requestedCase), `未知正式案例: ${requestedCase}`);

const formalCombatData = buildWeixiaofengFormalCase(sandbox.__LWCS_内置角色库__);
const lockedFoodSkill = deepClone(formalCombatData.参战者.team_player[0].第1武魂.第1魂灵.第1魂环.第1魂技);
const formalResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'weixiaofeng_20_round',
  seed: 730031,
  combatData: formalCombatData,
  mode: 'single_preview',
  rounds: 20,
  selectedAction: {
    actor_name: '唐凌雪',
    action_type: '释放魂技',
    type: '释放魂技',
    skill: lockedFoodSkill,
    __魂环路径: ['第1武魂', '第1魂灵', '第1魂环'],
    __魂技槽位: '第1魂技',
    target_name: '唐凌雪',
    造物处理: '生成到自己背包',
  },
  settings: {
    maxRounds: 20,
    stopDamagePercent: 100,
    continueChancePercent: 100,
    intentMode: '点到为止',
  },
});

assert.equal(formalResult.caseId, 'weixiaofeng_20_round');
assert.equal(formalResult.inputUnchanged, true, '调试入口修改了输入 combatData');
assert.equal(formalResult.scoringMutationDetected, false, '评分预估阶段修改了真实 combatData');
assert.ok(formalResult.initialSnapshot && typeof formalResult.initialSnapshot === 'object', '正式案例缺少初始快照');
assert.ok(formalResult.roundsExecuted >= 1, `正式案例没有推进回合:${JSON.stringify({ logs: formalResult.logs, audit: formalResult.audit, snapshot: formalResult.finalSnapshot })}`);
assert.ok(Array.isArray(formalResult.eventLedger) && formalResult.eventLedger.length > 0, `正式案例没有事件账本:${JSON.stringify({ rounds: formalResult.roundsExecuted, logs: formalResult.logs, snapshot: formalResult.finalSnapshot })}`);
const passiveActionStarts = formalResult.eventLedger.filter(event =>
  String(event?.eventKind || '').trim() === 'action_start' &&
  String(event?.actionRole || '').trim() === 'STATE_TICK'
);
assert.equal(passiveActionStarts.length, 0, `回合末状态或自然恢复被伪造成执行动作:${JSON.stringify(passiveActionStarts)}`);
const naturalRecoveryFacts = formalResult.eventLedger.filter(event =>
  /自然恢复/.test(String(event?.actionName || event?.sourceActionName || event?.meta?.stateName || event?.meta?.reasonText || ''))
);
assert.ok(naturalRecoveryFacts.every(event =>
  String(event?.eventKind || '').trim() === 'resource_change' &&
  String(event?.actionRole || '').trim() === 'STATE_TICK'
), `自然恢复包含非资源变化事实:${JSON.stringify(naturalRecoveryFacts)}`);
assert.ok(Array.isArray(formalResult.resolutionTrace) && formalResult.resolutionTrace.length > 0, '正式案例没有判定 Trace');
assert.ok(Array.isArray(formalResult.scoringAudit) && formalResult.scoringAudit.length > 0, '正式案例没有评分审计');
assert.ok(formalResult.scoringAudit.every(item => Array.isArray(item.candidates) && item.candidates.length > 0 && item.candidates.length <= 3), '评分审计没有限制为选中项和两个替代项');
assert.ok(Array.isArray(formalResult.decisions) && formalResult.decisions.length > 0, '正式案例没有公开决策审计');
assert.ok(formalResult.decisions.every(item => !Object.hasOwn(item, 'candidates')), '公开决策审计泄漏完整候选池');
assert.ok(formalResult.decisions.every(item => !Object.hasOwn(item?.selected || {}, 'preview')), '公开决策审计泄漏选中项预估快照');
assert.ok(formalResult.decisions.every(item => (item.scoreAudit || []).every(candidate => !Object.hasOwn(candidate, 'preview') && !Object.hasOwn(candidate, 'afterSnapshot'))), '评分摘要泄漏候选预估快照');
assert.ok(Array.isArray(formalResult.actionChains) && formalResult.actionChains.length > 0, '正式案例没有结构化行动链');
assert.ok(Array.isArray(formalResult.reportBlocks) && formalResult.reportBlocks.length > 0, '正式案例没有结构化战报块');
assert.ok(formalResult.reportBlocks.every(block => block?.blockId && block?.blockType && Array.isArray(block?.facts) && Array.isArray(block?.badges)), '结构化战报块契约不完整');
const expectedRounds = Array.from({ length: formalResult.roundsExecuted }, (_, index) => index + 1);
assert.equal(JSON.stringify((formalResult.roundOverview || []).map(item => Number(item?.round || 0))), JSON.stringify(expectedRounds), '回合速览没有连续覆盖全部实际回合');
const roundSummaryBlocks = formalResult.reportBlocks.filter(block => block?.blockType === 'ROUND_SUMMARY');
assert.equal(JSON.stringify(roundSummaryBlocks.map(block => Number(block?.round || 0))), JSON.stringify(expectedRounds), '每个实际回合必须恰好生成一个ROUND_SUMMARY');
roundSummaryBlocks.forEach(block => {
  const damages = (Array.isArray(block?.facts) ? block.facts : [])
    .filter(fact => String(fact?.factType || '').trim() === 'DAMAGE' && Number(fact?.value || 0) > 0);
  const playerDamage = damages
    .filter(fact => String(fact?.actorSide || '').trim() === 'player')
    .reduce((sum, fact) => sum + Math.round(Number(fact?.value || 0)), 0);
  const enemyDamage = damages
    .filter(fact => String(fact?.actorSide || '').trim() === 'enemy')
    .reduce((sum, fact) => sum + Math.round(Number(fact?.value || 0)), 0);
  if (!(playerDamage > 0 && enemyDamage > 0)) return;
  assert.match(
    String(block?.outcomeSummary || ''),
    new RegExp(`我方共造成 ${playerDamage} 点伤害，敌方共造成 ${enemyDamage} 点伤害`),
    `双方同回合命中时回合摘要必须保留双边伤害总量:${block?.outcomeSummary || ''}`,
  );
});
const formalActorNames = ['唐凌雪', '韦小枫'];
expectedRounds.forEach(round => {
  const activeStarts = formalResult.eventLedger.filter(event =>
    Number(event?.round || 0) === round &&
    String(event?.eventKind || '').trim() === 'action_start' &&
    String(event?.actionRole || '').trim() === 'ACTIVE'
  );
  const activeActors = new Set(activeStarts.map(event => String(event?.actorName || '').trim()));
  formalActorNames.forEach(actorName => {
    const lostOpportunity = formalResult.eventLedger.find(event =>
      Number(event?.round || 0) === round &&
      String(event?.actorName || '').trim() === actorName &&
      ['blocked_action', 'pass', 'lost_opportunity'].includes(String(event?.eventKind || '').trim()) &&
      !!String(event?.failReason || event?.meta?.reasonCode || event?.meta?.reasonText || '').trim()
    );
    assert.ok(activeActors.has(actorName) || lostOpportunity, `第${round}回合${actorName}既无自然主动行动也无结构化失去行动原因:${JSON.stringify(formalResult.eventLedger.filter(event => Number(event?.round || 0) === round))}`);
  });
  assert.ok(activeStarts.every(event => !/承伤硬抗|肉体兜底|伺机闪避/.test(String(event?.actionName || ''))), `第${round}回合反应专用动作冒充主动动作:${JSON.stringify(activeStarts)}`);
});
const appliedDamageByActor = formalResult.eventLedger.reduce((summary, event) => {
  const damage = Math.max(0, Number(event?.appliedDamage || event?.meta?.appliedDamage || event?.meta?.damage || 0));
  if (!(damage > 0)) return summary;
  const actorName = String(event?.actorName || '').trim();
  summary[actorName] = Number(summary[actorName] || 0) + damage;
  return summary;
}, {});
assert.ok(Number(appliedDamageByActor.唐凌雪 || 0) > 0, `唐凌雪全程没有形成有效伤害:${JSON.stringify(appliedDamageByActor)}`);
assert.ok(Number(appliedDamageByActor.韦小枫 || 0) > 0, `韦小枫全程没有形成有效伤害:${JSON.stringify(appliedDamageByActor)}`);
const stanceFacts = formalResult.eventLedger.filter(event => /防御姿态|闪避姿态/.test(String(event?.actionName || event?.meta?.stateName || '')));
if (stanceFacts.length) {
  assert.ok(stanceFacts.some(event => event?.eventKind === 'state_apply'), '基础防守姿态缺少结构化施加事实');
  assert.ok(stanceFacts.some(event => event?.eventKind === 'state_expire'), '基础防守姿态缺少消费或过期事实');
}
if (formalResult.roundsExecuted < 20) {
  const playerAlive = Number(formalResult.finalSnapshot?.team_player?.[0]?.hp || 0) > 0;
  const enemyAlive = Number(formalResult.finalSnapshot?.team_enemy?.[0]?.hp || 0) > 0;
  const structuredDisable = formalResult.eventLedger.some(event =>
    String(event?.eventKind || '').trim() === 'state_apply' &&
    String(event?.ruleCode || '').trim() === 'NONLETHAL_INTENT_DISABLE' &&
    String(event?.meta?.stateName || event?.actionName || '').trim() === '失去战斗力'
  );
  assert.ok(!playerAlive || !enemyAlive || structuredDisable, `双方仍可战斗却缺少结构化终止原因:${JSON.stringify(formalResult.finalSnapshot)}`);
}
const actionReportBlocks = formalResult.reportBlocks.filter(block => !['ROUND_SUMMARY', 'FINAL_SUMMARY'].includes(String(block?.blockType || '')));
const actionGroupIds = actionReportBlocks.map(block => String(block?.actionGroupId || '').trim()).filter(Boolean);
assert.equal(new Set(actionGroupIds).size, actionGroupIds.length, '同一动作组被拆成多个结构化战报块');
const actionFactOwners = new Map();
actionReportBlocks.forEach(block => {
  (block?.facts || []).forEach(fact => {
    const factId = String(fact?.factId || '').trim();
    assert.ok(factId, `非总结战报事实缺少factId:${JSON.stringify(block)}`);
    assert.ok(!actionFactOwners.has(factId), `同一事实进入多个非总结战报块:${JSON.stringify({ factId, firstBlockId: actionFactOwners.get(factId), duplicateBlockId: block?.blockId })}`);
    actionFactOwners.set(factId, String(block?.blockId || '').trim());
  });
});
const objectiveEventIds = new Set(formalResult.eventLedger
  .filter(event => String(event?.eventKind || '').trim() === 'battle_objective_resolved')
  .map(event => String(event?.eventId || '').trim())
  .filter(Boolean));
assert.ok(!actionReportBlocks.some(block =>
  String(block?.blockType || '').trim() === 'RESOURCE_CHANGE' &&
  (block?.facts || []).some(fact => objectiveEventIds.has(String(fact?.factId || '').trim()))
), '胜负条件事实被错误投影为RESOURCE_CHANGE动作块');
assert.ok(!actionReportBlocks.some(block =>
  (block?.facts || []).some(fact => String(fact?.eventKind || '').trim() === 'battle_objective_resolved')
), '根级胜负条件事实不应生成独立动作块');
formalResult.eventLedger.filter(event =>
  String(event?.eventKind || '').trim() === 'action_start' && String(event?.actionRole || '').trim() === 'ACTIVE'
).forEach(event => {
  const eventId = String(event?.eventId || '').trim();
  const sourceActionId = String(event?.actionId || event?.sourceActionId || '').trim();
  assert.ok(actionReportBlocks.some(block =>
    String(block?.actionGroupId || '').trim() === sourceActionId &&
    (block?.facts || []).some(fact => String(fact?.factId || '').trim() === eventId)
  ), `主动动作没有进入对应动作组战报:${JSON.stringify({ eventId, sourceActionId, round: event?.round, actor: event?.actorName, action: event?.actionName })}`);
});
actionReportBlocks.filter(block => ['RESOURCE_CHANGE', 'STATE_TICK'].includes(String(block?.blockType || ''))).forEach(block => {
  assert.equal(String(block?.intentSummary || '').trim(), '', `被动回合结算生成了主动意图:${JSON.stringify(block)}`);
  assert.ok((block?.facts || []).every(fact => String(fact?.actionRole || '').trim() === 'STATE_TICK'), `被动回合结算混入主动动作事实:${JSON.stringify(block)}`);
});
formalResult.eventLedger.filter(event =>
  String(event?.eventKind || '').trim() === 'state_apply' && /resist|抵抗|抵住/i.test(String(event?.result || event?.resultState || ''))
).forEach(event => {
  const eventId = String(event?.eventId || '').trim();
  const block = actionReportBlocks.find(item => (item?.facts || []).some(fact => String(fact?.factId || '').trim() === eventId));
  const stateName = String(event?.meta?.stateName || event?.stateName || event?.状态名 || '').trim();
  const sameStateApplied = formalResult.eventLedger.some(candidate =>
    candidate !== event &&
    String(candidate?.eventKind || '').trim() === 'state_apply' &&
    String(candidate?.sourceActionId || candidate?.actionId || '').trim() === String(event?.sourceActionId || event?.actionId || '').trim() &&
    String(candidate?.targetName || '').trim() === String(event?.targetName || '').trim() &&
    String(candidate?.meta?.stateName || candidate?.stateName || candidate?.状态名 || '').trim() === stateName &&
    !/resist|抵抗|抵住|immune|免疫/i.test(String(candidate?.result || candidate?.resultState || ''))
  );
  assert.ok(
    sameStateApplied
      ? String(block?.outcomeSummary || '').includes(`受到【${stateName}】影响`) && String(block?.nextWindow || '').includes(`【${stateName}】`)
      : /抵住|抵抗|未能附着/.test(String(block?.outcomeSummary || '')) &&
        !String(block?.outcomeSummary || '').includes(`受到【${stateName}】影响`) &&
        !String(block?.nextWindow || '').includes(`【${stateName}】`),
    `被抵抗状态被写成成功附着或后续窗口:${JSON.stringify(block)}`,
  );
  const roundSummary = roundSummaryBlocks.find(item => Number(item?.round || 0) === Number(event?.round || 0));
  if (!sameStateApplied) assert.ok(!String(roundSummary?.nextWindow || '').includes(`【${stateName}】`), `被抵抗状态进入了回合后续窗口:${JSON.stringify(roundSummary)}`);
});
const projectedFactIds = new Set(actionReportBlocks.flatMap(block => block.facts || []).map(fact => String(fact?.factId || '').trim()).filter(Boolean));
const projectedBadgeEventIds = new Set(actionReportBlocks.flatMap(block => block.badges || []).map(badge => String(badge?.sourceEventId || '').trim()).filter(Boolean));
const numericEventKinds = new Set(['hit_result', 'counter', 'state_tick', 'resource_change', 'round_recover', 'shield_create']);
const numericEvents = formalResult.eventLedger.filter(event => {
  if (!numericEventKinds.has(String(event?.eventKind || '').trim())) return false;
  return Number(event?.appliedDamage || event?.meta?.appliedDamage || event?.meta?.delta || event?.amount || event?.meta?.amount || 0) !== 0;
});
numericEvents.forEach(event => {
  const eventId = String(event?.eventId || '').trim();
  assert.ok(projectedFactIds.has(eventId), `数值事实没有进入动作组战报:${JSON.stringify({ eventId, round: event?.round, eventKind: event?.eventKind })}`);
  assert.ok(projectedBadgeEventIds.has(eventId), `数值事实没有独立Badge:${JSON.stringify({ eventId, round: event?.round, eventKind: event?.eventKind })}`);
});
[1, 2, 10, 11, 12, 19, 20].filter(round => round <= formalResult.roundsExecuted).forEach(round => {
  const summary = roundSummaryBlocks.find(block => Number(block?.round || 0) === round);
  const ledgerIds = formalResult.eventLedger
    .filter(event => Number(event?.round || event?.sourceRound || 0) === round)
    .map(event => String(event?.eventId || '').trim())
    .filter(Boolean)
    .sort();
  const summaryIds = (summary?.facts || []).map(fact => String(fact?.factId || '').trim()).filter(Boolean).sort();
  assert.deepEqual(summaryIds, ledgerIds, `第${round}回合结构化战报与Ledger事实不一致`);
});
const playerFacingReport = JSON.stringify({
  reportBlocks: formalResult.reportBlocks.map(block => ({
    intentSummary: block?.intentSummary,
    outcomeSummary: block?.outcomeSummary,
    nextWindow: block?.nextWindow,
    badges: (block?.badges || []).map(badge => badge?.name),
    facts: (block?.facts || []).map(fact => ({ actionName: fact?.actionName, stateName: fact?.stateName })),
  })),
  finalBattleReport: {
    text: formalResult.finalBattleReport?.text,
    headline: formalResult.finalBattleReport?.headline,
    nextIntents: formalResult.finalBattleReport?.nextIntents,
    playerStates: formalResult.finalBattleReport?.sides?.player?.units?.flatMap(unit => unit?.states || []).map(state => state?.name),
    enemyStates: formalResult.finalBattleReport?.sides?.enemy?.units?.flatMap(unit => unit?.states || []).map(state => state?.name),
  },
});
assert.ok(!/暂缓出手|持续施压|ACTION_COMMITTED|REACTION_SUCCEEDED|NO_STRUCTURED_SETTLEMENT|UNKNOWN_REASON|ruleCode/.test(playerFacingReport), `玩家战报包含无事实套话或内部码:${playerFacingReport}`);
assert.ok(!/BASIC_ATTACK|DEFEND|EVADE|COUNTER|OBSERVE|GUARD|WITHDRAW|RELEASE_SKILL|USE_ITEM|EQUIP/.test(playerFacingReport), `玩家战报泄漏动作枚举:${playerFacingReport}`);
assert.ok(!/召唤物【目标】|\b(?:str|def|agi|vit|sp|men|hp)修正\b|反应判定修正|结算修正/.test(playerFacingReport), `玩家战报包含召唤占位或内部状态名:${playerFacingReport}`);
const formalEnemy = formalCombatData.参战者.team_enemy[0];
const formalPlayer = formalCombatData.参战者.team_player[0];
const formalEnemyFirstSkill = formalEnemy.第1武魂.第1魂灵.第1魂环.第1魂技;
const formalPreviewSnapshot = deepClone(formalCombatData);
const pureStatePreview = sandbox.__LWCS_BATTLE_PREVIEW__.previewAction({
  worldSnapshot: formalPreviewSnapshot,
  beliefSnapshot: {},
  actorId: '韦小枫',
  declaration: {
    actionId: 'formal-pure-state-preview',
    actorId: '韦小枫',
    actionKind: 'RELEASE_SKILL',
    targetIds: ['唐凌雪'],
    skill: formalEnemyFirstSkill,
  },
  horizon: 'SHALLOW',
  previewBudget: { maxNodes: 12 },
});
assert.equal(JSON.stringify(formalPreviewSnapshot), JSON.stringify(formalCombatData), '纯状态技能预估修改了输入快照');
assert.ok(!(pureStatePreview?.contributions || []).some(entry => entry?.outcomeKind === 'HP_DELTA'), `纯状态技能伪造了HP_DELTA:${JSON.stringify(pureStatePreview?.contributions)}`);
assert.ok(
  (pureStatePreview?.contributions || []).some(entry => ['STATE_CHANGED', 'ACTION_CANCELLED', 'NEXT_ACTION_QUALITY_CHANGED', 'SUMMON_WINDOW'].includes(entry?.outcomeKind)) ||
    (pureStatePreview?.scheduledEvents || []).some(entry => entry?.type === 'SUMMON_CREATE'),
  `纯状态技能没有产生状态、行动或召唤窗口事实:${JSON.stringify(pureStatePreview)}`,
);
assert.equal(formalResult.finalBattleReport?.blockType, 'FINAL_SUMMARY', '正式案例缺少总结型战报');
assert.ok(/战至第\d+回合/.test(String(formalResult.finalBattleReport?.text || '')), '总结型战报没有战况回合');
assert.ok(/接下来我方/.test(String(formalResult.finalBattleReport?.text || '')) && /敌方/.test(String(formalResult.finalBattleReport?.text || '')), '总结型战报没有双方后续意图');
const canActAtEnd = unit => Number(unit?.hp || 0) > 0 && !/失去战斗力|昏迷|投降|制服|撤离/.test(String(unit?.actionState || unit?.行动状态 || '').trim());
const roundOneSoulDelta = formalResult.roundOverview
  .find(item => Number(item?.round || 0) === 1)?.resourceDeltas
  ?.find(item => item?.actorName === '唐凌雪' && item?.resourceName === '魂力');
assert.equal(roundOneSoulDelta?.value, -532, `回合速览重复累计审计型action_cost:${JSON.stringify(roundOneSoulDelta)}`);
assert.equal(roundOneSoulDelta?.sourceEventIds?.length, 2, `回合速览资源变化没有只保留真实扣除与自然恢复:${JSON.stringify(roundOneSoulDelta)}`);
const playerAliveAtEnd = canActAtEnd(formalResult.finalSnapshot?.team_player?.[0]);
const enemyAliveAtEnd = canActAtEnd(formalResult.finalSnapshot?.team_enemy?.[0]);
if (playerAliveAtEnd && enemyAliveAtEnd) {
  assert.ok(/唐凌雪.*【.+】/.test(String(formalResult.finalBattleReport?.nextIntents?.player || '')), '我方下一行动意图没有反映最终快照纯评分');
  assert.ok(/韦小枫.*【.+】/.test(String(formalResult.finalBattleReport?.nextIntents?.enemy || '')), '敌方下一行动意图没有反映最终快照纯评分');
} else {
  assert.ok(/结束交锋|失去战斗能力|满足战斗目标|战后处置/.test(String(formalResult.finalBattleReport?.nextIntents?.player || '')), '终局我方意图没有反映胜负终态');
  assert.ok(/结束交锋|失去战斗能力|触发我方胜利条件|阻止条件|战后处置/.test(String(formalResult.finalBattleReport?.nextIntents?.enemy || '')), '终局敌方意图没有反映胜负终态');
  assert.ok(/获胜/.test(String(formalResult.finalBattleReport?.headline || '')), '总结型战报没有明确终局胜负');
}
assert.ok(!/争取下一次有效命中|继续施压/.test(String(formalResult.finalBattleReport?.text || '')), '总结型战报仍使用无评分证据的泛化意图');
assert.ok(formalResult.aiSummaryInput && typeof formalResult.aiSummaryInput === 'object', '正式案例缺少结构化 AI 摘要输入');
assert.ok(!/ruleCode|rawObjectiveScore|scoreParts|candidate/i.test(JSON.stringify(formalResult.aiSummaryInput)), 'AI 摘要输入泄漏评分或开发态字段');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.probabilitySucceeds(0, 0), false, '0%概率在投点0时不得成功');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.probabilitySucceeds(0.01, 0), true, '1%概率在投点0时应成功');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.probabilitySucceeds(0.01, 0.01), false, '概率边界必须使用严格小于');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.probabilitySucceeds(0.99, 0.9899), true, '99%概率在边界内应成功');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.probabilitySucceeds(0.99, 0.99), false, '99%概率在等值投点时不得成功');
assert.equal(sandbox.__LWCS_BATTLE_RUNTIME__.probabilitySucceeds(1, 1), true, '100%概率必须成功');
assert.equal(typeof sandbox.__LWCS_BATTLE_RUNTIME__.runTeamBattle, 'undefined', '旧适配式团战调度器仍暴露在正式运行时');
assert.equal(typeof sandbox.__LWCS_BATTLE_RUNTIME__.runDuelRounds, 'undefined', '旧单挑调度器仍暴露在正式运行时');

const creationFacts = formalResult.eventLedger.filter(event => String(event?.eventKind || '') === 'create');
assert.equal(creationFacts.length, 1, `玩家锁定造物后自动回合仍重复造物:${JSON.stringify(creationFacts)}`);
assert.ok(creationFacts.every(event => event?.actorName === '唐凌雪'), '造物行动者不是唐凌雪');
assert.ok(creationFacts.every(event => event?.targetName === '唐凌雪' && event?.meta?.ownerName === '唐凌雪'), '造物持有者错误');
assert.ok(creationFacts.every(event => Number(event?.count || event?.meta?.count || 0) === 1), '单个产物没有对应唯一数量1事实');
assert.equal(creationFacts[0]?.actorControl, 'PLAYER_LOCKED', '玩家手选造物没有保留PLAYER_LOCKED来源');
const repeatedFoodStarts = formalResult.eventLedger.filter(event =>
  event?.eventKind === 'action_start' && Number(event?.round || 0) > 1 && /香喷喷牛肉干/.test(String(event?.actionName || ''))
);
assert.equal(repeatedFoodStarts.length, 0, `零可兑现收益的食物魂技被自动复读:${JSON.stringify(repeatedFoodStarts)}`);
assert.equal(formalResult.finalSnapshot?.team_player?.[0]?.lv, 18, '最终快照丢失唐凌雪等级');
assert.equal(formalResult.finalSnapshot?.team_player?.[0]?.type, '食物系', '最终快照丢失唐凌雪系别');
assert.equal(formalResult.finalSnapshot?.team_enemy?.[0]?.lv, 21, '最终快照丢失韦小枫等级');
assert.equal(formalResult.finalSnapshot?.team_enemy?.[0]?.type, '敏攻系', '最终快照丢失韦小枫系别');

const teamQueueResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'weixiaofeng_team_queue',
  seed: 730032,
  combatData: buildFormalCase(sandbox.__LWCS_内置角色库__),
  mode: 'team_preview',
  rounds: 2,
  settings: { maxRounds: 2, intentMode: '点到为止' },
});
const teamQueueFatals = (teamQueueResult.audit?.fatals || []).filter(item => /^(ACTION_|LEDGER_CONSERVATION_MISMATCH|DUPLICATE_DAMAGE|NON_DAMAGE_SKILL_DAMAGE|ZERO_PROBABILITY_SUCCESS|ACTION_TERMINAL_CONFLICT)/.test(String(item?.code || '')));
assert.equal(teamQueueFatals.length, 0, `团战队列案例账本或队列审计失败:${JSON.stringify(teamQueueFatals)}`);
const teamQueueExecuted = (teamQueueResult.actionQueueTrace || []).filter(item => item?.state === 'EXECUTED');
assert.ok(teamQueueExecuted.length >= 2, `团战队列没有执行行动节点:${JSON.stringify(teamQueueResult.actionQueueTrace)}`);
assert.equal(new Set(teamQueueExecuted.map(item => `${item.round}|${item.grantId}`)).size, teamQueueExecuted.length, '团战队列重复消费授权');
teamQueueExecuted.forEach((node, index) => {
  if (!(Number(node.parentActionSequence || 0) > 0)) return;
  assert.ok(teamQueueExecuted.slice(0, index).some(parent =>
    Number(parent.round || 0) === Number(node.round || 0) &&
    Number(parent.actionSequence || 0) === Number(node.parentActionSequence || 0)
  ), `团战队列后继节点缺少已执行父节点:${JSON.stringify(node)}`);
});
const teamCounterNodes = teamQueueExecuted.filter(node =>
  String(node?.nodeKind || '').trim() === 'COUNTER' && String(node?.actionRole || '').trim() === 'COUNTER'
);
const teamReactionNodes = teamQueueExecuted.filter(node =>
  String(node?.nodeKind || '').trim() === 'REACTION' && String(node?.actionRole || '').trim() === 'REACTION'
);
assert.ok(teamReactionNodes.length > 0, `团战应招没有进入扁平队列:${JSON.stringify(teamQueueResult.actionQueueTrace)}`);
teamReactionNodes.forEach(reactionNode => {
  assert.ok(Number(reactionNode.parentActionSequence || 0) > 0, `应招队列节点没有父动作:${JSON.stringify(reactionNode)}`);
});
teamCounterNodes.forEach(counterNode => {
  assert.ok(Number(counterNode.parentActionSequence || 0) > 0, `防反队列节点没有父动作:${JSON.stringify(counterNode)}`);
  const parentIndex = teamQueueExecuted.findIndex(node =>
    Number(node?.round || 0) === Number(counterNode?.round || 0) &&
    Number(node?.actionSequence || 0) === Number(counterNode?.parentActionSequence || 0)
  );
  const counterIndex = teamQueueExecuted.indexOf(counterNode);
  assert.ok(parentIndex >= 0 && parentIndex < counterIndex, `防反队列节点没有紧随已执行父动作:${JSON.stringify(teamQueueExecuted)}`);
  const reactionIndex = teamQueueExecuted.findIndex(node =>
    String(node?.nodeKind || '').trim() === 'REACTION' &&
    Number(node?.parentActionSequence || 0) === Number(counterNode?.parentActionSequence || 0)
  );
  assert.ok(reactionIndex >= 0 && reactionIndex < counterIndex, `防反没有等待父动作的应招节点闭合:${JSON.stringify(teamQueueExecuted)}`);
});
const teamCounterFacts = (teamQueueResult.eventLedger || []).filter(event =>
  String(event?.eventKind || '').trim() === 'counter' && String(event?.actionRole || '').trim() === 'COUNTER'
);
assert.equal(teamCounterFacts.length > 0, teamCounterNodes.length > 0, '团战防反队列节点与COUNTER事实不一致');
assert.ok(teamCounterFacts.every(event => String(event?.sourceActionId || '').trim() && String(event?.parentNodeId || '').trim()), `团战防反事实没有挂接父动作:${JSON.stringify(teamCounterFacts)}`);
const activeCounterRoots = (teamQueueResult.eventLedger || []).filter(event =>
  String(event?.eventKind || '').trim() === 'action_start' &&
  String(event?.actionType || '').trim() === 'counter' &&
  String(event?.actionRole || '').trim() === 'ACTIVE'
);
assert.equal(activeCounterRoots.length, 0, `防反被提升成ACTIVE根动作:${JSON.stringify(activeCounterRoots)}`);

const injectionCounts = {
  commitBeforeSeal: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'BATTLE_COMMIT_BEFORE_REPORT_SEAL', payload => {
    payload.transactionAudit = {
      commitAttempted: true,
      sealStatus: 'DRAFT',
      draftHash: 'draft-a',
      reportHash: 'report-a',
      committedDraftHash: 'draft-a',
      committedReportHash: 'report-a',
    };
  }),
  commitHashMismatch: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'BATTLE_COMMIT_HASH_MISMATCH', payload => {
    payload.transactionAudit = {
      commitAttempted: true,
      sealStatus: 'SEALED',
      draftHash: 'draft-a',
      reportHash: 'report-a',
      committedDraftHash: 'draft-b',
      committedReportHash: 'report-a',
    };
  }),
  factOwnerConflict: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'REPORT_FACT_OWNER_CONFLICT', payload => {
    payload.factRegistry = [
      { factId: 'injected-fact', canonicalFactOwner: 'exchange-a' },
      { factId: 'injected-fact', canonicalFactOwner: 'exchange-b' },
    ];
  }),
  playerVisibilityLeak: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'REPORT_VISIBILITY_LEAK', payload => {
    payload.visibilityAudit = {
      mode: 'PLAYER',
      hiddenFactIds: ['injected-hidden-fact'],
      publicFactIds: ['injected-hidden-fact'],
      aiFactIds: [],
    };
  }),
  hiddenBeliefRead: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'BELIEF_HIDDEN_STATE_LEAK', payload => {
    payload.beliefAudit = {
      hiddenStateReads: ['enemy.preciseResource.sp'],
    };
  }),
  duplicateDamage: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'DUPLICATE_DAMAGE_FACT', payload => {
    const common = {
      round: 1,
      actorName: '韦小枫',
      targetName: '唐凌雪',
      actionName: '青影叠',
      actorControl: 'AI',
      actionRole: 'COUNTER',
      sourceActionId: 'injected-action',
      parentNodeId: 'injected-parent',
      reactionNodeId: 'injected-reaction',
      ruleCode: 'COUNTER_WINDOW_OPENED',
    };
    payload.eventLedger.push(
      { ...common, eventId: 'injected-counter', eventKind: 'counter', result: 'success', meta: { damage: 101 } },
      { ...common, eventId: 'injected-hit', eventKind: 'hit_result', result: 'hit', appliedDamage: 101, meta: { appliedDamage: 101 } },
    );
  }),
  nonDamageSkillDamage: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'NON_DAMAGE_SKILL_DAMAGE', payload => {
    payload.eventLedger.push({
      eventId: 'injected-no-damage-skill', eventKind: 'hit_result', round: 1, actorName: '韦小枫', targetName: '唐凌雪',
      actionName: '青影叠', appliedDamage: 101, effectCapability: { hasDamageEffect: false, effectKinds: ['状态施加'] },
      actorControl: 'AI', actionRole: 'COUNTER', sourceActionId: 'injected-no-damage-action', parentNodeId: '', reactionNodeId: '', ruleCode: '',
    });
  }),
  zeroProbabilitySuccess: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'ZERO_PROBABILITY_SUCCESS', payload => {
    payload.eventLedger.push({
      eventId: 'injected-zero-probability', eventKind: 'dodge', round: 1, actorName: '韦小枫', targetName: '唐凌雪',
      actionName: '伺机闪避', result: 'evaded', meta: { dodgeRate: 0, dodgeRoll: 0 },
      actorControl: 'AI', actionRole: 'REACTION', sourceActionId: 'injected-zero-action', parentNodeId: '', reactionNodeId: '', ruleCode: 'REACTION_SUCCEEDED',
    });
  }),
  activeDefenseSelfReaction: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'REACTION_SELF_SOURCE_INVALID', payload => {
    payload.eventLedger.push({
      eventId: 'injected-active-defense', eventKind: 'defend', round: 1, actorName: '韦小枫', targetName: '韦小枫',
      actionName: '防御', result: 'complete', actorControl: 'AI', actionRole: 'ACTIVE', sourceActionId: '',
      parentNodeId: 'injected-active-defense-root', reactionNodeId: 'injected-self-reaction-window', ruleCode: 'REACTION_SUCCEEDED',
      meta: { preparedDefense: true, reactionWindowNodeId: 'injected-self-reaction-window' },
    });
  }),
  counterActorSource: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'COUNTER_ACTOR_SOURCE_INVALID', payload => {
    payload.eventLedger.push(
      {
        eventId: 'injected-counter-source', eventKind: 'action_start', actionId: 'injected-counter-source-action',
        round: 1, actorName: '唐凌雪', targetName: '韦小枫', targetIds: ['韦小枫'], actionName: '裂地冲拳',
        result: 'declared', actorControl: 'AI', actionRole: 'ACTIVE', sourceActionId: '', parentNodeId: '',
        reactionNodeId: '', ruleCode: 'ACTION_COMMITTED',
      },
      {
        eventId: 'injected-invalid-counter-window', eventKind: 'counter_window', round: 1,
        actorName: '唐凌雪', targetName: '唐凌雪', targetIds: ['唐凌雪'], actionName: '反击窗口',
        result: 'opened', actorControl: 'SYSTEM', actionRole: 'REACTION',
        sourceActionId: 'injected-counter-source-action', parentNodeId: 'injected-counter-source',
        reactionNodeId: '', ruleCode: 'COUNTER_WINDOW_OPENED',
      },
    );
  }),
  terminalConflict: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'ACTION_TERMINAL_CONFLICT', payload => {
    const common = { round: 1, sourceActionId: 'injected-conflict-action', parentNodeId: '', reactionNodeId: '', ruleCode: '' };
    payload.eventLedger.push(
      { ...common, eventId: 'injected-conflict-dodge', eventKind: 'dodge', actorName: '韦小枫', targetName: '唐凌雪', actionName: '伺机闪避', result: 'evaded', actorControl: 'AI', actionRole: 'REACTION' },
      { ...common, eventId: 'injected-conflict-hit', eventKind: 'hit_result', actorName: '韦小枫', targetName: '唐凌雪', actionName: '裂地冲拳', result: 'hit', appliedDamage: 60, actorControl: 'PLAYER_LOCKED', actionRole: 'ACTIVE' },
    );
  }),
  dotProjection: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'DOT_SOURCE_MISPROJECTED', payload => {
    payload.eventLedger.push({
      eventId: 'injected-dot', eventKind: 'state_tick', round: 2, actorName: '唐凌雪', targetName: '韦小枫', actionName: '青影叠',
      sourceActionName: '青影叠', result: 'damage', appliedDamage: 59, meta: { appliedDamage: 59, resource: '生命值' },
      actorControl: 'SYSTEM', actionRole: 'STATE_TICK', sourceActionId: 'injected-dot-action', parentNodeId: '', reactionNodeId: '', ruleCode: '',
    });
    payload.publicReportBlocks.push({
      round: 2,
      projectionSource: 'hit_result_ast',
      blocks: [{ type: 'text', content: '青影叠直接造成59点伤害', sourceEventId: 'injected-dot', projectionSource: 'hit_result_ast' }],
    });
  }),
  scoringMissing: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SCORING_COMPONENT_MISSING', payload => {
    delete payload.scoringAudit[0].candidates[0].vector;
  }),
  scoringFormula: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SCORING_FORMULA_MISMATCH', payload => {
    payload.scoringAudit[0].candidates[0].objectiveUtility += 1;
  }),
  scoringDuplicate: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SCORING_COMPONENT_DUPLICATED', payload => {
    const targetId = payload.scoringAudit[0].candidates[0].targetIds[0] || 'duplicate-target';
    payload.scoringAudit[0].candidates[0].targetIds = [targetId, targetId];
  }),
  scoringOversized: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SCORING_AUDIT_OVERSIZED', payload => {
    while (payload.scoringAudit[0].candidates.length <= 3) {
      payload.scoringAudit[0].candidates.push(deepClone(payload.scoringAudit[0].candidates[0]));
    }
  }),
  scoringMutation: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SCORING_PREVIEW_MUTATED_STATE', payload => {
    payload.scoringMutationDetected = true;
  }),
  summonWindowMissing: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SUMMON_WINDOW_MISSING', payload => {
    const common = { actorControl: 'AI', actionRole: 'ASSIST', sourceActionId: 'injected-summon-action', parentNodeId: '', reactionNodeId: '', ruleCode: '' };
    payload.eventLedger.push(
      { ...common, eventId: 'injected-summon-create', eventKind: 'summon_create', round: 1, actorName: '韦小枫', targetName: '', actionName: '青影蛇群', actionType: '召唤生成', result: 'created', meta: { summonName: '注入蛇群', summonMode: '协同攻击', windowCount: 1 } },
      { ...common, eventId: 'injected-summon-end', eventKind: 'summon_end', round: 1, actorName: '注入蛇群', targetName: '韦小枫', actionName: '召唤离场', actionType: 'summon_end', result: 'ended', ruleCode: 'SUMMON_WINDOW_EXHAUSTED', meta: { summonName: '注入蛇群' } },
    );
  }),
  summonDuplicateAction: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'SUMMON_DUPLICATE_ACTION', payload => {
    const common = { round: 2, actorName: '注入蛇群', targetName: '唐凌雪', actionName: '蛇群撕咬', actionType: 'summon_assist', result: 'declared', actorControl: 'AI', actionRole: 'ASSIST', sourceActionId: 'injected-summon-action', parentNodeId: '', reactionNodeId: '', ruleCode: '' };
    payload.eventLedger.push(
      { ...common, eventId: 'injected-summon-action-1', eventKind: 'action_start' },
      { ...common, eventId: 'injected-summon-action-2', eventKind: 'action_start' },
    );
  }),
  ledgerConservation: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'LEDGER_CONSERVATION_MISMATCH', payload => {
    payload.finalSnapshot.team_player[0].sp += 1;
  }),
  ledgerConservationHp: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'LEDGER_CONSERVATION_MISMATCH', payload => {
    payload.finalSnapshot.team_player[0].hp += 1;
  }),
  ledgerConservationVit: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'LEDGER_CONSERVATION_MISMATCH', payload => {
    payload.finalSnapshot.team_player[0].vit += 1;
  }),
  ledgerConservationMen: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'LEDGER_CONSERVATION_MISMATCH', payload => {
    payload.finalSnapshot.team_player[0].men += 1;
  }),
  ledgerConservationShield: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'LEDGER_CONSERVATION_MISMATCH', payload => {
    payload.finalSnapshot.team_player[0].shield += 1;
  }),
  queueGrantDuplicate: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'ACTION_GRANT_CONSUMED_TWICE', payload => {
    payload.actionQueueTrace.push(
      { state: 'EXECUTED', round: 1, actionSequence: 1, parentActionSequence: 0, grantId: 'injected-grant' },
      { state: 'EXECUTED', round: 1, actionSequence: 2, parentActionSequence: 1, grantId: 'injected-grant' },
    );
  }),
  queueParentOrder: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'ACTION_QUEUE_PARENT_ORDER_INVALID', payload => {
    payload.actionQueueTrace.push({ state: 'EXECUTED', round: 1, actionSequence: 1000, parentActionSequence: 999, grantId: 'injected-child' });
  }),
  naturalOpportunityMissing: injectAndRequire(sandbox.__LWCS_BATTLE_RUNTIME__.auditFacts, formalResult, 'NATURAL_ACTION_OPPORTUNITY_MISSING', payload => {
    const naturalEnqueued = payload.actionQueueTrace.find(entry => String(entry?.state || '') === 'ENQUEUED' && String(entry?.grantId || '').startsWith('natural:'));
    assert.ok(naturalEnqueued, '正式案例缺少可注入的自然行动授权');
    const grantId = String(naturalEnqueued.grantId || '');
    const round = Number(naturalEnqueued.round || 0);
    payload.actionQueueTrace = payload.actionQueueTrace.filter(entry =>
      !(String(entry?.grantId || '') === grantId && Number(entry?.round || 0) === round && ['EXECUTED', 'CANCELLED', 'FATAL'].includes(String(entry?.state || '')))
    );
  }),
};

const output = {
  summary: {
    caseId: formalResult.caseId,
    seed: formalResult.seed,
    roundsExecuted: formalResult.roundsExecuted,
    ledgerCount: formalResult.eventLedger.length,
    traceCount: formalResult.resolutionTrace.length,
    scoreAuditCount: formalResult.scoringAudit.length,
    actionChainCount: formalResult.actionChains.length,
    reportBlockCount: formalResult.reportBlocks.length,
    roundSummaryCount: roundSummaryBlocks.length,
    teamQueueNodeCount: teamQueueExecuted.length,
    formalFatalCount: formalResult.audit.fatalCount,
    formalWarningCount: formalResult.audit.warningCount,
    negativeInjectionCount: Object.keys(injectionCounts).length,
  },
  formalAudit: formalResult.audit,
  injectionCounts,
  actionNames: [...new Set(formalResult.eventLedger.map(event => String(event?.actionName || '').trim()).filter(Boolean))],
  roundOneEvidence: {
    ledger: formalResult.eventLedger.filter(event => Number(event?.round || 0) === 1),
    reportBlocks: formalResult.reportBlocks.filter(block => Number(block?.round || 0) === 1),
    roundOverview: formalResult.roundOverview.filter(row => Number(row?.round || 0) === 1),
    actionChains: formalResult.actionChains.filter(chain => Number(chain?.round || 0) === 1),
  },
  finalBattleReport: formalResult.finalBattleReport,
};

console.log(JSON.stringify(output, null, 2));
if (formalResult.audit.fatalCount > 0) process.exitCode = 1;

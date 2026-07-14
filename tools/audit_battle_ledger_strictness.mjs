import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sampleCount = Math.max(1, Math.min(100, Number(process.env.BATTLE_LEDGER_STRICTNESS_SAMPLE_COUNT || 5)));

function nodeStub() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
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
    documentElement: { clientWidth: 1440, clientHeight: 900 }, createElement: () => nodeStub(),
    body: { appendChild() {} }, head: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function participant(id, side, agility, skill = null) {
  return {
    id, name: id, 名称: id, type: '强攻系', 系别: '强攻系', side,
    属性: {
      等级: 50, 系别: '强攻系', HP: 1000, HP上限: 1000, 体力: 1000, 体力上限: 1000,
      魂力: 500, 魂力上限: 500, 精神力: 200, 精神力上限: 200,
      力量: 220, 防御: 120, 敏捷: agility,
    },
    状态: { 存活: true, 位置: '账本审计场', 行动: '战斗' },
    状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: skill ? [structuredClone(skill)] : [],
  };
}

function combatData() {
  const attack = {
    id: 'ledger-basic', name: '审计攻击', 魂技名: '审计攻击', 消耗: '无', 前摇: 1,
    _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 35, 伤害类型: '近身攻击', 命中概率: 1 }],
  };
  return {
    回合: 0, 战斗类型: '普通战斗', 战斗意图: '击败', 进行中: true,
    参战者: {
      team_player: [participant('player-a', 'player', 180, attack)],
      team_enemy: [participant('enemy-a', 'enemy', 160, attack)],
    },
  };
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const sandbox = createSandbox();
for (const relativePath of ['lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
assert.ok(runtime && typeof runtime.runBattleCase === 'function', '正式Runtime缺少runBattleCase');
assert.ok(typeof runtime.auditFacts === 'function', '正式Runtime缺少auditFacts');

const results = [];
for (let index = 0; index < sampleCount; index += 1) {
  const result = runtime.runBattleCase({
    caseId: `ledger-strictness-${index + 1}`,
    seed: 740100 + index,
    combatData: combatData(),
    mode: 'team_preview',
    rounds: 2,
    settings: {},
  });
  const ledger = Array.isArray(result.eventLedger) ? result.eventLedger : [];
  const actionStarts = ledger.filter(event => event?.eventKind === 'action_start');
  const actionIds = new Set(actionStarts.map(event => String(event?.actionId || '').trim()).filter(Boolean));
  assert.ok(actionStarts.length > 0, `样本${index + 1}没有主动动作`);
  assert.equal(actionIds.size, actionStarts.length, `样本${index + 1}主动动作ID重复`);
  ledger.forEach(event => {
    const kind = String(event?.eventKind || '').trim();
    const actionId = String(event?.actionId || '').trim();
    const sourceActionId = String(event?.sourceActionId || '').trim();
    if (['action_start', 'counter', 'hit_result', 'state_apply', 'resource_change', 'shield_create', 'summon_create', 'blocked_action', 'failed_action', 'target_fail'].includes(kind)) {
      assert.ok(actionId || sourceActionId, `结算事实缺少动作来源:${JSON.stringify(event)}`);
    }
    if (kind === 'counter') {
      assert.ok(actionId && sourceActionId && actionId !== sourceActionId, `防反没有独立动作ID:${JSON.stringify(event)}`);
      assert.ok(actionIds.has(sourceActionId), `防反来源动作不存在:${JSON.stringify(event)}`);
    }
    if (sourceActionId) assert.ok(actionIds.has(sourceActionId), `来源动作不存在:${JSON.stringify(event)}`);
    if (kind === 'hit_result' && Number(event?.appliedDamage || 0) > 0) {
      assert.notEqual(event?.effectCapability?.hasDamageEffect, false, `无伤技能产生伤害:${JSON.stringify(event)}`);
    }
  });
  assert.equal(result.audit?.fatals?.length || 0, 0, `正式样本事实审计失败:${JSON.stringify(result.audit?.fatals || [])}`);
  results.push({
    seed: result.seed,
    rounds: result.roundsExecuted,
    ledgerCount: ledger.length,
    traceCount: result.resolutionTrace?.length || 0,
    actionCount: actionStarts.length,
    digest: digest({ ledger, trace: result.resolutionTrace, finalSnapshot: result.finalSnapshot }),
  });
}

function runNegative(code, mutate) {
  const base = runtime.runBattleCase({
    caseId: `ledger-negative-${code}`,
    seed: 741001,
    combatData: combatData(),
    mode: 'team_preview',
    rounds: 2,
    settings: {},
  });
  const payload = {
    eventLedger: structuredClone(base.eventLedger || []),
    resolutionTrace: structuredClone(base.resolutionTrace || []),
    publicReportBlocks: structuredClone(base.publicReportBlocks || []),
    scoringAudit: structuredClone(base.scoringAudit || []),
    initialSnapshot: structuredClone(base.initialSnapshot || null),
    finalSnapshot: structuredClone(base.finalSnapshot || null),
    actionQueueTrace: structuredClone(base.actionQueueTrace || []),
    scoringMutationDetected: base.scoringMutationDetected,
  };
  mutate(payload);
  const audit = runtime.auditFacts(payload);
  assert.ok(audit.fatals.some(item => item?.code === code), `负面注入未捕获:${code}`);
}

runNegative('DUPLICATE_DAMAGE_FACT', payload => {
  const action = payload.eventLedger.find(event => event?.eventKind === 'action_start');
  const sourceActionId = action?.actionId || 'injected-action';
  payload.eventLedger.push(
    { eventId: 'injected-counter', eventKind: 'counter', actionId: 'injected-counter-action', sourceActionId, actorName: 'enemy-a', targetName: 'player-a', actionRole: 'COUNTER', result: 'success', meta: { damage: 101 } },
    { eventId: 'injected-hit', eventKind: 'hit_result', actionId: 'injected-counter-action', sourceActionId, actorName: 'enemy-a', targetName: 'player-a', actionRole: 'COUNTER', result: 'hit', appliedDamage: 101, meta: { appliedDamage: 101 } },
  );
});
runNegative('NON_DAMAGE_SKILL_DAMAGE', payload => {
  payload.eventLedger.push({
    eventId: 'injected-no-damage', eventKind: 'hit_result', actionId: 'injected-no-damage-action',
    actorName: 'enemy-a', targetName: 'player-a', actionRole: 'ACTIVE', appliedDamage: 1,
    effectCapability: { hasDamageEffect: false, effectKinds: ['状态施加'] },
  });
});
runNegative('LEDGER_CONSERVATION_MISMATCH', payload => {
  payload.finalSnapshot.team_player[0].hp += 1;
});
runNegative('ACTION_TERMINAL_CONFLICT', payload => {
  const action = payload.eventLedger.find(event => event?.eventKind === 'action_start');
  const sourceActionId = action?.actionId || 'injected-conflict';
  payload.eventLedger.push(
    { eventId: 'injected-dodge', eventKind: 'dodge', actionId: sourceActionId, sourceActionId, actorName: 'enemy-a', targetName: 'enemy-a', actionRole: 'REACTION', result: 'evaded' },
    { eventId: 'injected-hit', eventKind: 'hit_result', actionId: sourceActionId, sourceActionId, actorName: 'player-a', targetName: 'enemy-a', actionRole: 'ACTIVE', result: 'hit', appliedDamage: 1 },
  );
});
runNegative('ACTION_GRANT_CONSUMED_TWICE', payload => {
  payload.actionQueueTrace.push(
    { state: 'EXECUTED', round: 1, actionSequence: 900, parentActionSequence: 0, grantId: 'injected-grant' },
    { state: 'EXECUTED', round: 1, actionSequence: 901, parentActionSequence: 900, grantId: 'injected-grant' },
  );
});

console.log(JSON.stringify({
  summary: {
    sampleCount,
    negativeCount: 5,
    passed: true,
  },
  samples: results,
}, null, 2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
  Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
  parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
const loadedModules = [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleReport_Module.js',
];
const loadedSources = Object.fromEntries(loadedModules.map(relativePath => [
  relativePath,
  fs.readFileSync(path.resolve(root, relativePath), 'utf8'),
]));
for (const relativePath of loadedModules) {
  vm.runInContext(loadedSources[relativePath], sandbox, { filename: relativePath });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const reportRuntime = sandbox.__LWCS_BATTLE_REPORT__;
const manualCases = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__);

function skill(id, cost, effects) {
  return { id, name: id, 魂技名: id, 消耗: { 魂力: cost }, 前摇: 1, _效果数组: effects };
}

function unit(id, side, skills, overrides = {}) {
  return {
    id,
    name: id,
    名称: id,
    side,
    type: '强攻系',
    系别: '强攻系',
    hp: 600,
    hp_max: 600,
    sp: 100,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: 180,
    def: 110,
    agi: 100,
    属性: {
      等级: 50, HP: 600, HP上限: 600, 魂力: 100, 魂力上限: 100,
      精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100,
      力量: 180, 防御: 110, 敏捷: 100, 状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: skills,
    ...overrides,
  };
}

function syntheticBattle(caseId, actorSkills, enemySkills, overrides = {}) {
  const actor = unit(`${caseId}-actor`, 'player', actorSkills, overrides.actor || {});
  const enemy = unit(`${caseId}-enemy`, 'enemy', enemySkills, overrides.enemy || {});
  return {
    caseId,
    seed: overrides.seed || 745000,
    rounds: overrides.rounds || 4,
    intent: overrides.intent || '切磋',
    initialBelief: {},
    combatData: {
      回合: 0,
      战斗类型: '普通战斗',
      战斗意图: overrides.intent || '切磋',
      进行中: true,
      参战者: { team_player: [actor], team_enemy: [enemy] },
    },
  };
}

const basicEnemySkill = skill('稳定打击', 0, [
  { effectId: 'stable-hit', 原型: '伤害结算', 目标: '单体', 威力倍率: 80, 伤害类型: '近身攻击', 命中概率: 100 },
]);
const resourceBankruptcy = syntheticBattle('repeated_resource_bankruptcy', [
  skill('低耗打击', 10, [{ effectId: 'cheap-hit', 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 100 }]),
  skill('高耗打击', 95, [{ effectId: 'expensive-hit', 原型: '伤害结算', 目标: '单体', 威力倍率: 100, 伤害类型: '近身攻击', 命中概率: 100 }]),
], [basicEnemySkill], { seed: 745003 });
const redundantControl = syntheticBattle('control_without_new_window', [
  skill('重复眩晕', 20, [{ effectId: 'repeat-stun', 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: 100 }]),
], [basicEnemySkill], {
  seed: 745004,
  enemy: {
    状态效果: {
      existingStun: { 状态: '眩晕', 状态名称: '眩晕', duration: 2, 持续回合: 2, 战斗效果: { cannot_act: true, skip_turn: true } },
    },
  },
});
const continuousControl = syntheticBattle('reasonable_continuous_control', [
  skill('短控续接', 10, [{ effectId: 'short-stun', 原型: '状态施加', 目标: '单体', 状态: '眩晕', 持续回合: 1, 成功率: 100 }]),
], [basicEnemySkill], { seed: 745007 });
const dotContinuation = syntheticBattle('reasonable_dot_continuation', [
  skill('蚀血印', 10, [{ effectId: 'dot', 原型: '状态施加', 目标: '单体', 状态: '中毒', 数值: '-10%', 持续回合: 2, 成功率: 100 }]),
], [basicEnemySkill], { seed: 745008 });

function manual(caseId) {
  const found = manualCases.find(item => item.caseId === caseId);
  assert.ok(found, `人工案例缺失:${caseId}`);
  return found;
}

const scenarios = [
  { label: 'self_reaction', definition: manual('duel_charge_defense_safer') },
  { label: 'counter_actor_inversion', definition: manual('duel_agile_counter_options') },
  { label: 'repeated_resource_bankruptcy', definition: resourceBankruptcy },
  { label: 'control_without_new_window', definition: redundantControl },
  { label: 'peer_low_damage_stalemate', definition: manual('duel_peer_unknown_probe') },
  { label: 'underdog_survival', definition: manual('duel_underdog_survival') },
  { label: 'reasonable_continuous_control', definition: continuousControl },
  { label: 'reasonable_dot_continuation', definition: dotContinuation },
];

function firstPlayerId(combatData) {
  const actor = combatData?.参战者?.team_player?.[0];
  return String(actor?.id || actor?.name || actor?.名称 || '').trim();
}

function run(definition, decisionEngine) {
  return runtime.runBattleCase({
    caseId: `${definition.caseId}:${decisionEngine}`,
    seed: definition.seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    settings: decisionEngine === 'next' ? { decisionEngine: 'next-shadow' } : {},
  });
}

function buildReport(result, visibilityMode = 'DEVELOPER') {
  const draftBody = {
    schemaVersion: '7.3-R7.4-draft-1',
    status: 'DRAFT',
    caseId: String(result?.caseId || '').trim(),
    seed: result?.seed ?? 1,
    mode: String(result?.mode || '').trim(),
    roundsRequested: Math.max(0, Number(result?.roundsRequested || 0)),
    actualRoundCount: Math.max(0, Number(result?.roundsExecuted || 0)),
    ledger: runtime.cloneValue(result?.ledger || []),
    trace: runtime.cloneValue(result?.trace || []),
    decisionAudit: runtime.cloneValue(result?.decisions || []),
    actionQueueTrace: runtime.cloneValue(result?.actionQueueTrace || []),
    terminalResult: runtime.cloneValue(result?.terminal || result?.objectiveResolution || null),
    initialSnapshot: runtime.cloneValue(result?.initialSnapshot || null),
    finalSnapshot: runtime.cloneValue(result?.finalSnapshot || null),
  };
  const draft = { ...draftBody, draftHash: runtime.hashBattleValue(draftBody) };
  const audit = reportRuntime.auditProjection(reportRuntime.build({ draft, visibilityMode }));
  assert.equal(audit.passed, true, `A/B证据Report失败:${JSON.stringify(audit.fatals)}`);
  return { reportDto: audit.reportDto, reportHash: audit.reportHash };
}

const results = scenarios.map(({ label, definition }) => {
  const actorId = firstPlayerId(definition.combatData);
  const comparison = decision.compareDecisionKernels({
    worldSnapshot: definition.combatData,
    actorId,
    actionOpportunity: { role: 'ACTIVE', sequence: 1 },
    beliefState: definition.initialBelief || {},
    battleIntent: { mode: definition.intent },
    seed: definition.seed,
  });
  assert.equal(comparison.candidateSetMatches, true, `${label}:Legacy/Next候选集合不一致`);
  assert.equal(comparison.previewMismatches.length, 0, `${label}:Legacy/Next没有消费同一Preview:${comparison.previewMismatches.join(',')}`);
  const legacy = run(definition, 'legacy');
  const next = run(definition, 'next');
  assert.equal(legacy.audit.fatalCount, 0, `${label}:Legacy结构Fatal:${JSON.stringify(legacy.audit.fatals)}`);
  assert.equal(next.audit.fatalCount, 0, `${label}:Next结构Fatal:${JSON.stringify(next.audit.fatals)}`);
  const nextActiveStarts = next.ledger.filter(event => event?.eventKind === 'action_start' && event?.actionRole === 'ACTIVE');
  const nextDamage = next.ledger.filter(event => event?.eventKind === 'hit_result')
    .reduce((sum, event) => sum + Math.max(0, Number(event?.appliedDamage || 0)), 0);
  if (label === 'self_reaction') {
    assert.ok(next.ledger.filter(event => event?.meta?.preparedDefense === true)
      .every(event => !event.reactionNodeId && !event?.meta?.reactionWindowNodeId), 'Next主动防御仍自建反应窗');
    const preparedReaction = next.ledger.find(event =>
      event?.eventKind === 'defend' &&
      event?.actionRole === 'REACTION' &&
      event?.meta?.preparedDefenseConsumed === true
    );
    assert.ok(preparedReaction, '主动防御姿态没有被下一次真实攻击消费');
    const reactor = preview.findUnit(definition.combatData, preparedReaction.actorName);
    const source = preview.findUnit(definition.combatData, preparedReaction.targetName);
    assert.equal(
      preparedReaction.meta.damageMultiplier,
      preview.calculateDefenseDamageMultiplier(reactor, source, true),
      '主动防御预估与正式减伤内核不一致'
    );
    assert.ok(
      preparedReaction.meta.damageMultiplier < preview.calculateDefenseDamageMultiplier(reactor, source, false),
      '主动防御与临时反应防御没有真实边际'
    );
    const preparedHit = next.ledger.find(event =>
      event?.eventKind === 'hit_result' &&
      event?.targetName === preparedReaction.actorName &&
      String(event?.meta?.reactionEventId || '').trim() === String(preparedReaction.eventId || '').trim() &&
      Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0
    );
    assert.ok(
      preparedHit &&
      Number(preparedHit?.meta?.defenseMultiplier || 0) === Number(preparedReaction?.meta?.damageMultiplier || 0),
      '主动防御在完整战斗中没有沿用已消费的减伤结果'
    );
  }
  if (label === 'counter_actor_inversion') {
    assert.equal(
      nextActiveStarts.filter(event => event?.actionType === 'WITHDRAW').length,
      0,
      '没有撤离目标的同级切磋被求生分支错误改成撤离',
    );
    const starts = new Map(next.ledger.filter(event => event?.eventKind === 'action_start').map(event => [event.actionId, event]));
    assert.ok(next.ledger.filter(event => event?.eventKind === 'counter').every(event => {
      const source = starts.get(event.sourceActionId);
      return source && source.actorName === event.targetName && source.actorName !== event.actorName;
    }), 'Next反击主体或来源倒置');
    const counterDamageByVictim = next.ledger
      .filter(event =>
        event?.eventKind === 'hit_result' &&
        event?.actionRole === 'COUNTER' &&
        Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0
      )
      .reduce((totals, event) => {
        const victim = String(event?.targetName || '').trim();
        totals[victim] = Number(totals[victim] || 0) +
          Math.max(0, Number(event?.appliedDamage || event?.meta?.appliedDamage || 0));
        return totals;
      }, {});
    Object.entries(counterDamageByVictim).forEach(([victim, counterDamage]) => {
      const activeDamage = next.ledger
        .filter(event =>
          event?.eventKind === 'hit_result' &&
          event?.actionRole === 'ACTIVE' &&
          event?.actorName === victim
        )
        .reduce((sum, event) => sum + Math.max(0, Number(event?.appliedDamage || event?.meta?.appliedDamage || 0)), 0);
      if (!(counterDamage > Math.max(1, activeDamage) * 5)) return;
      const selectedActions = nextActiveStarts
        .filter(event => event?.actorName === victim)
        .map(event => event?.actionName);
      assert.ok(
        new Set(selectedActions).size > 1,
        `Next在即时反击损失远高于主动战果后仍无条件重复同一动作:${JSON.stringify({
          victim,
          counterDamage,
          activeDamage,
          selectedActions,
        })}`,
      );
    });
  }
  if (label === 'repeated_resource_bankruptcy') {
    assert.equal(nextActiveStarts.filter(event => event.actionName === '高耗打击').length, 0, 'Next仍选择同伤害高耗支配动作');
    assert.equal(next.ledger.filter(event => /RESOURCE_INSUFFICIENT/.test(String(event?.ruleCode || ''))).length, 0, 'Next制造资源破产后失败动作');
  }
  if (label === 'control_without_new_window') {
    assert.equal(nextActiveStarts[0]?.actionName, '普通攻击', `Next没有用终局推进打破已覆盖控制下的零容量盲区:${JSON.stringify(next.decisions[0] || {})}`);
    assert.ok(next.decisions[0]?.scoreAudit?.filter(candidate => ['DEFEND', 'EVADE'].includes(candidate.actionKind))
      .every(candidate => candidate.rejectionCode === 'ZERO_PROGRESS'), '无威胁防御仍进入主观抽样');
  }
  if (label === 'peer_low_damage_stalemate') {
    assert.ok(nextDamage > 0, 'Next同级战斗没有形成任何有效伤害');
    const activeSides = new Set(nextActiveStarts.map(event => event.actorSide));
    assert.ok(activeSides.has('player') && activeSides.has('enemy'), 'Next同级战斗仍有一方只看戏');
    const repeatedStateChoices = next.decisions.filter(decision =>
      decision?.actorId === '韦小枫' &&
      decision?.actionRole === 'ACTIVE' &&
      decision?.selected?.selectedActionName === '青影叠'
    );
    assert.ok(repeatedStateChoices.length > 0, 'Next同级案例没有形成可审阅的状态技能选择');
    assert.ok(repeatedStateChoices.every(decision =>
      Number(decision?.selected?.repeatedActionAudit?.repeatedActionDelta || 0) > 0 &&
      (
        Number(decision?.selected?.repeatedActionAudit?.resourceRunwayAfter || 0) > 0 ||
        decision?.selected?.repeatedActionAudit?.lifecycleWindowRealizable === true
      ) &&
      (decision?.selected?.repeatedActionAudit?.extendedWindowIds || []).length > 0
    ), '高成本状态技能没有证明新增窗口、正边际、剩余资源跑道或末轮真实兑现');
  }
  if (label === 'underdog_survival') {
    assert.ok(['防御', '闪避'].includes(nextActiveStarts[0]?.actionName), `Next弱者面对显露致命蓄力仍未先保命:${nextActiveStarts[0]?.actionName || ''}`);
  }
  if (label === 'reasonable_continuous_control') {
    assert.ok(nextActiveStarts.some(event => event.actionName === '短控续接'), 'Next压死了可兑现的连续控制');
    assert.equal(
      next.ledger.filter(event => event?.eventKind === 'lost_opportunity' && /CONTROLLED/.test(String(event?.meta?.reason || ''))).length,
      definition.rounds,
      '连续控制没有逐回合覆盖真实自然行动机会'
    );
  }
  if (label === 'reasonable_dot_continuation') {
    assert.ok(nextActiveStarts.some(event => event.actionName === '蚀血印'), 'Next压死了可兑现的DOT续接');
    const startsByActionId = new Map(next.ledger.filter(event => event?.eventKind === 'action_start').map(event => [event.actionId, event]));
    const dotTicks = next.ledger.filter(event =>
      event?.eventKind === 'state_tick' &&
      Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) > 0
    );
    assert.equal(dotTicks.length, definition.rounds, 'DOT续接没有兑现每个真实tick窗口');
    assert.ok(dotTicks.every(event => {
      const source = startsByActionId.get(event.sourceActionId);
      return source &&
        source.actorName === event.actorName &&
        source.actionName === event.actionName &&
        Number(event.sourceRound || event?.meta?.sourceRound || 0) <= Number(event.round || 0) &&
        String(event.applicationId || event?.meta?.applicationId || '').trim();
    }), 'DOT tick缺少原始动作、行动者、回合或状态实例来源');
    assert.equal(
      Number(dotTicks[1]?.sourceRound || dotTicks[1]?.meta?.sourceRound || 0),
      1,
      '刷新DOT错误冒领了原状态本回合已经拥有的tick'
    );
  }
  const nextReport = buildReport(next);
  return {
    label,
    sourceCaseId: definition.caseId,
    inputHash: runtime.hashBattleValue({
      combatData: definition.combatData,
      seed: definition.seed,
      rounds: definition.rounds,
      intent: definition.intent,
      initialBelief: definition.initialBelief || {},
    }),
    beliefHash: runtime.hashBattleValue(definition.initialBelief || {}),
    candidateCount: comparison.candidateIds.length,
    legacy: {
      rounds: legacy.roundsExecuted,
      winner: legacy.winner,
      ledgerHash: runtime.hashBattleValue(legacy.ledger),
      selectedActions: legacy.ledger.filter(event => event?.eventKind === 'action_start' && event?.actionRole === 'ACTIVE')
        .map(event => ({ round: event.round, actor: event.actorName, action: event.actionName })),
    },
    next: {
      rounds: next.roundsExecuted,
      winner: next.winner,
      ledgerHash: runtime.hashBattleValue(next.ledger),
      decisionHash: runtime.hashBattleValue(next.decisions),
      finalSnapshotHash: runtime.hashBattleValue(next.finalSnapshot),
      reportHash: nextReport.reportHash,
      selectedActions: nextActiveStarts.map(event => ({ round: event.round, actor: event.actorName, action: event.actionName })),
      damage: nextDamage,
      reportDto: nextReport.reportDto,
      decisionAudit: next.decisions,
    },
  };
});

const withdrawalDefinition = manual('duel_agile_single_target_failure');
const withdrawalNext = run(withdrawalDefinition, 'next');
assert.equal(withdrawalNext.audit.fatalCount, 0, `撤离目标Next结构Fatal:${JSON.stringify(withdrawalNext.audit.fatals)}`);
const withdrawalDecision = withdrawalNext.decisions.find(entry =>
  entry?.actorId === '谢邂' && entry?.actionRole === 'ACTIVE'
);
assert.equal(
  withdrawalDecision?.selected?.declaration?.actionKind,
  'WITHDRAW',
  `唯一成功条件为撤离且自身濒危时，Next仍未尝试撤离:${JSON.stringify(withdrawalDecision || {})}`,
);
assert.ok(
  withdrawalDecision?.selected?.mechanicObservations?.some(observation =>
    observation?.effectPrototype === '撤离判定' &&
    Number(observation?.posterior) >= 0 &&
    Number(observation?.posterior) <= 1
  ),
  '撤离选择没有保留有限认知下的概率观察',
);
const withdrawalFact = withdrawalNext.ledger.find(event =>
  event?.actionType === 'WITHDRAW' && ['withdrawn', 'failed'].includes(String(event?.result || ''))
);
assert.ok(withdrawalFact, '撤离选择没有进入正式Runtime并形成唯一结算事实');
const withdrawalPlayerReport = buildReport(withdrawalNext, 'PLAYER').reportDto;
const withdrawalText = reportRuntime.serializeFullText(withdrawalPlayerReport);
assert.match(withdrawalText, /尝试撤离战场/);
assert.match(withdrawalText, /成功撤离战场|未能摆脱追击/);
assert.doesNotMatch(withdrawalText, /撤退.*指向谢邂|完成【撤退】结算/);
const withdrawalAdjudication = withdrawalPlayerReport.adjudications.find(item =>
  item?.actorName === '谢邂' && item?.selected?.actionKind === 'WITHDRAW'
);
assert.ok(
  withdrawalAdjudication?.predicted?.numbers?.some(token =>
    token?.label === '撤离预计成功率' && token?.sourceType === 'DECISION_PREVIEW'
  ),
  'PLAYER判定没有展示角色当时的撤离预测',
);
const withdrawalPlayerFact = withdrawalPlayerReport.factRegistry.find(fact =>
  fact?.factId === withdrawalFact.eventId
);
assert.ok(
  withdrawalPlayerFact &&
  !withdrawalPlayerFact.numericTokens.some(token => token?.label === '成功率'),
  'PLAYER战报泄漏了撤离结算使用的隐藏真实成功率',
);

const artifactDir = path.resolve(root, 'artifacts', 'battle_r74_phase5_ab');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'kernel_ab.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  commitRequiredForReview: true,
  engineSourceHash: runtime.hashBattleValue(loadedSources),
  results,
  withdrawalRegression: {
    sourceCaseId: withdrawalDefinition.caseId,
    ledgerHash: runtime.hashBattleValue(withdrawalNext.ledger),
    decisionHash: runtime.hashBattleValue(withdrawalNext.decisions),
    reportHash: buildReport(withdrawalNext, 'PLAYER').reportHash,
  },
}, null, 2), 'utf8');

console.log(JSON.stringify({
  summary: {
    caseCount: results.length,
    candidateConsistencyCount: results.length,
    previewConsistencyCount: results.length,
    nextFatalCount: 0,
    legacyFatalCount: 0,
    artifactPath: path.join(artifactDir, 'kernel_ab.json'),
    passed: true,
  },
}, null, 2));

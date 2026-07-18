import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';
import { buildWeixiaofengFormalCase } from './battle_v73_formal_case_fixture.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const partialResultPath = path.resolve(root, 'lwcs', 'artifacts', 'phase8_batch_partial.ndjson');
fs.mkdirSync(path.dirname(partialResultPath), { recursive: true });
fs.writeFileSync(partialResultPath, '', 'utf8');

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

function isSameReportName(left, right) {
  const normalize = value => String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
  const leftKey = normalize(left);
  const rightKey = normalize(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function participant(id, side, options = {}) {
  const hp = Math.max(1, Number(options.hp || 500));
  const sp = Math.max(0, Number(options.sp ?? 500));
  return {
    id,
    name: id,
    名称: id,
    type: '强攻系',
    系别: '强攻系',
    属性: {
      等级: 50,
      系别: '强攻系',
      HP: hp,
      HP上限: 500,
      体力: hp,
      体力上限: 500,
      魂力: sp,
      魂力上限: 500,
      精神力: 200,
      精神力上限: 200,
      力量: Number(options.str || 180),
      防御: Number(options.def || 120),
      敏捷: Number(options.agi || 160),
      状态效果: {},
    },
    状态: { 存活: true, 位置: 'Phase 8 批量矩阵', 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: options.skills || [{
      id: `${id}-attack`,
      name: '测试突击',
      魂技名: '测试突击',
      消耗: { 魂力: 10 },
      前摇: 10,
      _效果数组: [{
        原型: '伤害结算',
        目标: '单体',
        威力倍率: 65,
        伤害类型: '近身攻击',
        生效方式: '独立生效',
      }],
    }],
    side,
  };
}

function combatData(actor, enemy, intent = '切磋') {
  return {
    回合: 0,
    战斗类型: '普通战斗',
    战斗意图: intent,
    进行中: true,
    参战者: { team_player: [actor], team_enemy: [enemy] },
  };
}

function loadRuntime() {
  const sandbox = createSandbox();
  for (const relativePath of [
    'lwcs/CharacterLibrary.js',
    'lwcs/MVU_Skill_Runtime.js',
    'lwcs/BattlePreview_Module.js',
    'lwcs/BattleDecision_Module.js',
    'lwcs/BattleRuntime_Module.js',
    'lwcs/BattleReport_Module.js',
    'lwcs/BattleUI_Module.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
  }
  const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
  const scopeNode = Object.assign(makeNode(), {
    querySelector(selector) {
      return selector === '#ui-battle-record-terminal' ? recordNode : null;
    },
  });
  new sandbox.BattleUIComponent({
    innerHTML: '',
    querySelector(selector) {
      return selector === '.battle-module-scope' ? scopeNode : null;
    },
  }, {}, {});
  return sandbox;
}

function inspectNext(decision, input) {
  let candidates = [];
  const result = decision.decideNext({
    ...input,
    inspectCandidates: value => { candidates = value; },
  });
  return { ...result, candidates };
}

function check(name, passed, detail) {
  const result = { name, passed: passed === true, detail };
  fs.appendFileSync(partialResultPath, `${JSON.stringify(result)}\n`, 'utf8');
  return result;
}

const sandbox = loadRuntime();
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const report = sandbox.__LWCS_BATTLE_REPORT__;
const checks = [];

const semanticRuntimeSources = [
  'lwcs/CharacterLibrary.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleReport_Module.js',
  'lwcs/BattleUI_Module.js',
];
const stalePositionStateReferences = semanticRuntimeSources.flatMap(relativePath => {
  const source = fs.readFileSync(path.resolve(root, relativePath), 'utf8');
  const count = (source.match(/位移限制/g) || []).length;
  return count > 0 ? [{ relativePath, count }] : [];
});
const slowCombatEffect = preview.deriveStateCombatEffect({
  原型: '状态施加',
  状态: '迟缓',
  数值: '-12%',
  持续回合: 1,
});
checks.push(check(
  'semantic.soft_control_uses_slow_state_not_position_lock',
  stalePositionStateReferences.length === 0 &&
    Number(slowCombatEffect?.dodge_penalty || 0) > 0 &&
    Number(slowCombatEffect?.reaction_penalty || 0) > 0 &&
    Number(slowCombatEffect?.lock_level || 0) === 0,
  {
    stalePositionStateReferences,
    slowCombatEffect: {
      dodgePenalty: Number(slowCombatEffect?.dodge_penalty || 0),
      reactionPenalty: Number(slowCombatEffect?.reaction_penalty || 0),
      lockLevel: Number(slowCombatEffect?.lock_level || 0),
    },
  },
));

const multiGroupQueue = runtime.executeActionNodes({
  round: 1,
  nodes: Array.from({ length: 80 }, (_, index) => ({
    actorEntry: { char: { name: `group-actor-${Math.floor(index / 5) + 1}` } },
    actorTurnSequence: Math.floor(index / 5) + 1,
    parentActionSequence: 0,
    grantId: `multi-group:${index + 1}`,
  })),
});
checks.push(check(
  'queue.round_can_exceed_64_nodes_across_independent_action_groups',
  !multiGroupQueue.fatal && multiGroupQueue.results.length === 80,
  {
    resultCount: multiGroupQueue.results.length,
    fatal: multiGroupQueue.fatal,
  },
));

const singleGroupQueue = runtime.executeActionNodes({
  round: 1,
  nodes: Array.from({ length: 65 }, (_, index) => ({
    actorEntry: { char: { name: 'single-group-actor' } },
    actorTurnSequence: 1,
    parentActionSequence: 0,
    grantId: `single-group:${index + 1}`,
  })),
});
checks.push(check(
  'queue.single_action_group_still_fails_on_65th_node',
  singleGroupQueue.fatal?.code === 'ACTION_QUEUE_NODE_LIMIT_EXCEEDED' &&
    Number(singleGroupQueue.fatal?.actionGroupNodeCount || 0) === 64,
  {
    resultCount: singleGroupQueue.results.length,
    fatal: singleGroupQueue.fatal,
  },
));

const defenseActor = participant('defense-actor', 'player', { hp: 25, sp: 0, str: 80 });
const defenseEnemy = participant('defense-enemy', 'enemy', { str: 500, skills: [] });
defenseEnemy.蓄力技能 = {
  id: 'phase8-visible-charge',
  cast_time: 20,
  skill: {
    id: 'phase8-visible-charge-skill',
    name: '显露致命蓄力',
    _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 500, 伤害类型: '近身攻击' }],
  },
};
const defenseWorld = combatData(defenseActor, defenseEnemy);
defenseActor.__battleRuntime = {
  activeDefenseStance: { type: 'DEFEND', stateName: '已准备防守窗口' },
};
const preparedDefense = inspectNext(decision, {
  worldSnapshot: defenseWorld,
  actorId: 'defense-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 2 },
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 8801,
});
const preparedCandidates = preparedDefense.candidates.filter(candidate =>
  ['DEFEND', 'EVADE'].includes(candidate?.declaration?.actionKind),
);
checks.push(check(
  'defense.repeated_stance_is_zero_progress',
  preparedCandidates.length > 0 && preparedCandidates.every(candidate => candidate.rejectionCode === 'ZERO_PROGRESS'),
  preparedCandidates.map(candidate => ({
    actionKind: candidate.declaration?.actionKind,
    rejectionCode: candidate.rejectionCode,
    objectiveUtility: candidate.objectiveUtility,
  })),
));

delete defenseActor.__battleRuntime.activeDefenseStance;
defenseEnemy.蓄力技能.cast_time = 50;
const expiredDefense = inspectNext(decision, {
  worldSnapshot: defenseWorld,
  actorId: 'defense-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 2 },
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 8802,
});
const expiredCandidates = expiredDefense.candidates.filter(candidate =>
  ['DEFEND', 'EVADE'].includes(candidate?.declaration?.actionKind),
);
checks.push(check(
  'defense.window_not_yet_realizable_is_zero_progress',
  expiredCandidates.length > 0 && expiredCandidates.every(candidate => candidate.rejectionCode === 'ZERO_PROGRESS'),
  expiredCandidates.map(candidate => ({
    actionKind: candidate.declaration?.actionKind,
    rejectionCode: candidate.rejectionCode,
    objectiveUtility: candidate.objectiveUtility,
  })),
));

delete defenseEnemy.蓄力技能;
const immediateDefense = inspectNext(decision, {
  worldSnapshot: defenseWorld,
  actorId: 'defense-actor',
  actionOpportunity: { role: 'ACTIVE', sequence: 1, imminentThreat: true },
  battleIntent: { mode: '切磋' },
  beliefState: { confidence: 1 },
  seed: 8803,
});
const immediateCandidates = immediateDefense.candidates.filter(candidate =>
  ['DEFEND', 'EVADE'].includes(candidate?.declaration?.actionKind),
);
checks.push(check(
  'defense.real_threat_keeps_positive_defense',
  immediateCandidates.some(candidate =>
    Number(candidate.objectiveUtility || 0) > 0 && candidate.rejectionCode !== 'ZERO_PROGRESS'
  ),
  immediateCandidates.map(candidate => ({
    actionKind: candidate.declaration?.actionKind,
    rejectionCode: candidate.rejectionCode,
    objectiveUtility: candidate.objectiveUtility,
  })),
));

const expiringDefenseActor = participant('expiring-defense-actor', 'player');
const chargingEnemy = participant('charging-enemy', 'enemy', { skills: [] });
chargingEnemy.蓄力技能 = {
  id: 'phase8-delayed-charge',
  cast_time: 120,
  skill: {
    id: 'phase8-delayed-charge-skill',
    name: '延迟蓄力',
    前摇: 80,
    _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 200, 伤害类型: '近身攻击' }],
  },
};
const expiringDefenseResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'phase8_defense_window_expiry',
  seed: 8804,
  combatData: combatData(expiringDefenseActor, chargingEnemy),
  mode: 'single_preview',
  rounds: 1,
  selectedAction: {
    actorId: 'expiring-defense-actor',
    actionKind: 'DEFEND',
    targetIds: ['expiring-defense-actor'],
  },
  settings: { decisionEngine: 'next-shadow' },
});
const expiringDefenseFinalActor = expiringDefenseResult.combatData?.参战者?.team_player?.[0];
const defenseExpiryFact = expiringDefenseResult.ledger.find(event =>
  String(event?.ruleCode || '').trim() === 'DEFENSE_WINDOW_EXPIRED',
);
checks.push(check(
  'defense.unused_stance_expires_at_round_end',
  !expiringDefenseFinalActor?.__battleRuntime?.activeDefenseStance && Boolean(defenseExpiryFact),
  {
    activeDefenseStance: expiringDefenseFinalActor?.__battleRuntime?.activeDefenseStance || null,
    expiryEventId: defenseExpiryFact?.eventId || '',
  },
));

const manualCases = buildManualCases(
  sandbox.__LWCS_内置角色库__,
  sandbox.__LWCS_GET_BASE_STATS__,
);
const counterDefinition = manualCases.find(item => item.caseId === 'duel_agile_counter_options');
const counterResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: counterDefinition.caseId,
  seed: counterDefinition.seed,
  combatData: counterDefinition.combatData,
  mode: 'team_preview',
  rounds: counterDefinition.rounds,
  initialBelief: counterDefinition.initialBelief,
  battleIntent: { mode: counterDefinition.intent },
  settings: { decisionEngine: 'next-shadow' },
});
const counterDecision = counterResult.decisions.find(entry => entry?.actionRole === 'COUNTER');
const counterWindow = counterResult.ledger.find(event =>
  event?.eventKind === 'counter_window' && event?.result === 'opened',
);
const counterDecline = counterDecision?.scoreAudit?.find(candidate => candidate?.counterDeclineFallback === true);
const counterFact = counterResult.ledger.find(event =>
  event?.eventKind === 'counter' &&
  event?.result === 'success' &&
  Number(event?.meta?.resolvedDamage || 0) > 0,
);
checks.push(check(
  'counter.real_window_is_not_declined',
  Boolean(counterWindow && counterDecision && counterDecline) &&
    counterDecision.selected?.candidateId !== counterDecline.candidateId &&
    Boolean(counterFact),
  {
    selected: counterDecision?.selected?.candidateId || '',
    decline: counterDecline?.candidateId || '',
    window: counterWindow?.eventId || '',
    counterFact: counterFact?.eventId || '',
    candidates: (counterDecision?.scoreAudit || []).map(candidate => ({
      candidateId: candidate?.candidateId || '',
      actionKind: candidate?.declaration?.actionKind || candidate?.actionKind || '',
      objectiveUtility: candidate?.objectiveUtility,
      rejectionCode: candidate?.rejectionCode || '',
      classification: candidate?.classification || '',
      vector: candidate?.vector || {},
    })),
  },
));

const formalCombatData = buildWeixiaofengFormalCase(sandbox.__LWCS_内置角色库__);
const formalResult = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
  caseId: 'weixiaofeng_20_round',
  seed: 730031,
  combatData: formalCombatData,
  mode: 'single_preview',
  rounds: 20,
  settings: {
    decisionEngine: 'next-shadow',
    maxRounds: 20,
    stopDamagePercent: 100,
    continueChancePercent: 100,
    intentMode: '点到为止',
  },
});
const terminal = formalResult.terminal || formalResult.objectiveResolution || {};
const earlyStop = Number(formalResult.roundsExecuted || 0) < Number(formalResult.roundsRequested || 0);
checks.push(check(
  'terminal.early_stop_has_structured_reason',
  !earlyStop || (
    terminal.terminal === true &&
    Boolean(String(terminal.winner || '').trim()) &&
    Boolean(String(terminal.terminalReason || '').trim()) &&
    Array.isArray(terminal.matchedDetails) &&
    terminal.matchedDetails.length > 0
  ),
  {
    roundsRequested: formalResult.roundsRequested,
    roundsExecuted: formalResult.roundsExecuted,
    winner: terminal.winner || '',
    terminalReason: terminal.terminalReason || '',
    matchedDetailCount: Array.isArray(terminal.matchedDetails) ? terminal.matchedDetails.length : 0,
  },
));

const actualRounds = Number(formalResult.roundsExecuted || 0);
const overviewRounds = (formalResult.roundOverview || []).map(item => Number(item?.round || 0));
checks.push(check(
  'terminal.round_overview_matches_actual_rounds',
  JSON.stringify(overviewRounds) === JSON.stringify(Array.from({ length: actualRounds }, (_, index) => index + 1)),
  { actualRounds, overviewRounds },
));

const manualCaseById = new Map(manualCases.map(definition => [definition.caseId, definition]));
const manualCaseResultCache = new Map();
function runManualCase(caseId) {
  const definition = manualCaseById.get(caseId);
  if (!definition) throw new Error(`phase8_batch_case_missing:${caseId}`);
  if (manualCaseResultCache.has(caseId)) {
    process.stderr.write(`[phase8] CACHE ${caseId}\n`);
    return manualCaseResultCache.get(caseId);
  }
  const startedAt = Date.now();
  process.stderr.write(`[phase8] START ${caseId}\n`);
  const result = sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__({
    caseId: definition.caseId,
    seed: definition.seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    selectedAction: definition.selectedAction,
    settings: { decisionEngine: 'next-shadow' },
  });
  manualCaseResultCache.set(caseId, result);
  process.stderr.write(
    `[phase8] DONE ${caseId} ${Date.now() - startedAt}ms rounds=${Number(result?.roundsExecuted || 0)} ledger=${Array.isArray(result?.ledger) ? result.ledger.length : 0}\n`,
  );
  return result;
}

function declarationLabel(declaration = {}) {
  return String(
    declaration?.skill?.name ||
    declaration?.skill?.魂技名 ||
    declaration?.actionKind ||
    '',
  ).trim();
}

function canonicalActionLabel(actionName = '', actionKind = '') {
  const kind = String(actionKind || '').trim().toUpperCase();
  if (kind === 'BASIC_ATTACK' || /普通攻击|基础攻击/.test(String(actionName || '').trim())) {
    return 'BASIC_ATTACK';
  }
  return String(actionName || '').trim();
}

function decisionSignature(entry = {}) {
  const declaration = entry?.selected?.declaration || {};
  return [
    canonicalActionLabel(
      declarationLabel(declaration),
      declaration?.actionKind,
    ),
    [...new Set((declaration?.targetIds || []).map(value => String(value || '').trim()).filter(Boolean))]
      .sort()
      .join(','),
  ].join('|');
}

function activeDecisions(result = {}) {
  return (Array.isArray(result?.decisions) ? result.decisions : []).filter(entry =>
    String(entry?.actionRole || 'ACTIVE').trim().toUpperCase() === 'ACTIVE' &&
    String(entry?.actorId || '').trim(),
  );
}

function failureGroups(result = {}) {
  const groups = new Map();
  (Array.isArray(result?.ledger) ? result.ledger : [])
    .filter(event =>
      String(event?.eventKind || '').trim() === 'hit_result' &&
      Number(event?.appliedDamage || event?.meta?.appliedDamage || 0) <= 0 &&
      /miss|未命中|落点偏离/i.test(`${event?.result || ''} ${event?.summary || ''}`),
    )
    .forEach(event => {
      const actorId = String(event?.actorId || event?.actorName || '').trim();
      const eventActionKind = String(event?.actionKind || event?.actionType || '').trim().toUpperCase();
      const signature = [
        canonicalActionLabel(
          String(event?.actionName || event?.actionType || event?.sourceActionId || '').trim(),
          eventActionKind,
        ),
        [...new Set((event?.targetIds || [event?.targetId]).map(value => String(value || '').trim()).filter(Boolean))]
          .sort()
          .join(','),
      ].join('|');
      const key = `${actorId}|${signature}`;
      const group = groups.get(key) || { actorId, signature, events: [] };
      group.events.push(event);
      groups.set(key, group);
    });
  return [...groups.values()].filter(group => group.events.length >= 2);
}

function hasPostFailureAdaptation(result = {}) {
  return failureAdaptationAudits(result).every(audit =>
    audit.status === 'ADAPTED' ||
    audit.status === 'TACTICAL_WINDOW_JUSTIFIED' ||
    audit.status === 'NO_FUTURE_OPPORTUNITY' ||
    audit.status === 'INSUFFICIENT_DISTINCT_ACTIONS'
  );
}

function decisionOpportunitySequence(entry = {}) {
  return Math.max(
    0,
    Number(
      entry?.opportunitySequence ??
      entry?.actionOpportunity?.opportunitySequence ??
      entry?.selected?.opportunitySequence ??
      0,
    ),
  );
}

function actionStartFor(result = {}, value = {}) {
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  const actionId = String(value?.actionId || value?.sourceActionId || '').trim();
  const opportunityId = String(
    value?.opportunityId ||
    value?.meta?.opportunityId ||
    value?.selected?.opportunityId ||
    '',
  ).trim();
  return ledger.find(event =>
    ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
    (
      (actionId && String(event?.actionId || '').trim() === actionId) ||
      (opportunityId && String(event?.opportunityId || event?.meta?.opportunityId || '').trim() === opportunityId)
    )
  ) || null;
}

function isDecisionAfterFailure(entry = {}, failureEvent = {}, result = {}) {
  const failureStart = actionStartFor(result, failureEvent);
  const decisionStart = actionStartFor(result, entry);
  if (failureStart && decisionStart) {
    const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
    const failureIndex = ledger.indexOf(failureStart);
    const decisionIndex = ledger.indexOf(decisionStart);
    if (failureIndex >= 0 && decisionIndex >= 0) return decisionIndex > failureIndex;
  }
  const entryRound = Number(entry?.round || 0);
  const failureRound = Number(failureEvent?.round || 0);
  if (entryRound > failureRound) return true;
  if (entryRound < failureRound) return false;
  const entrySequence = decisionOpportunitySequence(entry);
  const failureSequence = Math.max(
    0,
    Number(failureEvent?.opportunitySequence ?? failureEvent?.meta?.opportunitySequence ?? 0),
  );
  return entrySequence > 0 && failureSequence > 0 && entrySequence > failureSequence;
}

function failureAdaptationAudits(result = {}) {
  const decisions = activeDecisions(result);
  return failureGroups(result).map(group => {
    const orderedEvents = [...group.events].sort((left, right) =>
      Number(left?.round || 0) - Number(right?.round || 0) ||
      Math.max(0, Number(left?.opportunitySequence ?? left?.meta?.opportunitySequence ?? 0)) -
        Math.max(0, Number(right?.opportunitySequence ?? right?.meta?.opportunitySequence ?? 0))
    );
    const distinctFailureEvents = [...new Map(orderedEvents.map(event => [
      String(event?.actionId || event?.sourceActionId || event?.eventId || '').trim(),
      event,
    ])).values()];
    if (distinctFailureEvents.length < 2) {
      return {
        actorId: group.actorId,
        signature: group.signature,
        failureCount: orderedEvents.length,
        distinctFailureActionCount: distinctFailureEvents.length,
        evidenceRound: Number(distinctFailureEvents.at(-1)?.round || 0),
        evidenceSequence: Math.max(
          0,
          Number(
            distinctFailureEvents.at(-1)?.opportunitySequence ??
            distinctFailureEvents.at(-1)?.meta?.opportunitySequence ??
            0,
          ),
        ),
        status: 'INSUFFICIENT_DISTINCT_ACTIONS',
        futureDecisionCount: 0,
        adaptedRound: 0,
        sameRoundDecisionCount: 0,
      };
    }
    const evidenceEvent = distinctFailureEvents[1] || {};
    const evidenceRound = Number(evidenceEvent?.round || 0);
    const evidenceSequence = Math.max(
      0,
      Number(evidenceEvent?.opportunitySequence ?? evidenceEvent?.meta?.opportunitySequence ?? 0),
    );
    const futureDecisions = decisions.filter(entry =>
      String(entry?.actorId || '').trim() === group.actorId &&
      isDecisionAfterFailure(entry, evidenceEvent) &&
      entry?.continuation !== true
    );
    const failureStart = actionStartFor(result, evidenceEvent);
    const failureOpportunityId = String(
      failureStart?.opportunityId ||
      failureStart?.meta?.opportunityId ||
      evidenceEvent?.opportunityId ||
      evidenceEvent?.meta?.opportunityId ||
      '',
    ).trim();
    const sameRoundDecisionCount = decisions.filter(entry =>
      String(entry?.actorId || '').trim() === group.actorId &&
      Number(entry?.round || 0) === evidenceRound &&
      entry?.continuation !== true,
    ).filter(entry => {
      const entryOpportunityId = String(
        entry?.opportunityId ||
        entry?.actionOpportunity?.opportunityId ||
        '',
      ).trim();
      return (
        (failureOpportunityId && entryOpportunityId && entryOpportunityId !== failureOpportunityId) ||
        isDecisionAfterFailure(entry, evidenceEvent, result)
      );
    }).length;
    if (!futureDecisions.length) {
      return {
        actorId: group.actorId,
        signature: group.signature,
        failureCount: orderedEvents.length,
        distinctFailureActionCount: distinctFailureEvents.length,
        evidenceRound,
        evidenceSequence,
        status: sameRoundDecisionCount > 0 ? 'UNPROVEN_FUTURE_OPPORTUNITY' : 'NO_FUTURE_OPPORTUNITY',
        futureDecisionCount: 0,
        adaptedRound: 0,
        sameRoundDecisionCount,
      };
    }
    const tacticallyJustified = futureDecisions.find(entry => {
      const selected = entry?.selected || {};
      const terminal = selected?.terminalEvidence || {};
      const progress = selected?.nextValueAudit?.objectiveProgressAudit || {};
      const repeated = selected?.repeatedActionAudit || {};
      return (
        terminal?.direct?.achieved === true ||
        terminal?.response?.improvesSuccessProbability === true ||
        progress?.makesDeadlineFeasible === true ||
        (Array.isArray(repeated?.newlyDeniedOpportunityIds) && repeated.newlyDeniedOpportunityIds.length > 0) ||
        repeated?.lifecycleWindowRealizable === true
      );
    });
    if (tacticallyJustified) {
      return {
        actorId: group.actorId,
        signature: group.signature,
        failureCount: orderedEvents.length,
        distinctFailureActionCount: distinctFailureEvents.length,
        evidenceRound,
        evidenceSequence,
        status: 'TACTICAL_WINDOW_JUSTIFIED',
        futureDecisionCount: futureDecisions.length,
        adaptedRound: Number(tacticallyJustified?.round || 0),
        sameRoundDecisionCount,
      };
    }
    const adapted = futureDecisions.find(entry =>
      decisionSignature(entry) !== group.signature
    );
    return {
      actorId: group.actorId,
      signature: group.signature,
      failureCount: orderedEvents.length,
      distinctFailureActionCount: distinctFailureEvents.length,
      evidenceRound,
      evidenceSequence,
      status: adapted ? 'ADAPTED' : 'MISSING_ADAPTATION',
      futureDecisionCount: futureDecisions.length,
      adaptedRound: Number(adapted?.round || 0),
      sameRoundDecisionCount,
    };
  });
}

const playerReportCache = new WeakMap();

function buildPlayerReport(result = {}) {
  if (!report || !runtime) throw new Error('phase8_batch_report_runtime_missing');
  if (result && typeof result === 'object' && playerReportCache.has(result)) {
    return playerReportCache.get(result);
  }
  process.stderr.write(`[phase8] REPORT ${String(result?.caseId || '').trim()}\n`);
  const draftBody = {
    schemaVersion: '7.3-R7.4-phase8-batch-1',
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
  const audit = report.auditProjection(report.build({ draft, visibilityMode: 'PLAYER' }));
  if (result && typeof result === 'object') playerReportCache.set(result, audit);
  return audit;
}

function selectedDecisionEntries(result = {}) {
  return activeDecisions(result).filter(entry => entry?.selected && typeof entry.selected === 'object');
}

function allSelectedDecisionEntries(result = {}) {
  return (Array.isArray(result?.decisions) ? result.decisions : []).filter(entry =>
    entry?.selected && typeof entry.selected === 'object' &&
    String(entry?.actorId || '').trim(),
  );
}

function decisionEntryMatchesActionStart(entry = {}, start = {}) {
  const selected = entry?.selected || {};
  const candidateId = String(start?.meta?.decisionCandidateId || '').trim();
  const selectedCandidateId = String(selected?.candidateId || '').trim();
  if (candidateId && selectedCandidateId !== candidateId) return false;
  const actorId = String(start?.actorId || start?.actorName || '').trim();
  const entryActorId = String(entry?.actorId || '').trim();
  if (actorId && entryActorId && !isSameReportName(actorId, entryActorId)) return false;
  const startRound = Number(start?.round || 0);
  const entryRound = Number(entry?.round || 0);
  if (startRound && entryRound && startRound !== entryRound) return false;
  const startRole = runtime.normalizeActionRole(start?.actionRole || '', '');
  const entryRole = runtime.normalizeActionRole(entry?.actionRole || selected?.actionRole || '', '');
  if (startRole && entryRole && startRole !== entryRole) return false;
  const startOpportunityId = String(
    start?.opportunityId ||
    start?.meta?.opportunityId ||
    '',
  ).trim();
  const entryOpportunityId = String(
    entry?.opportunityId ||
    entry?.actionOpportunity?.opportunityId ||
    selected?.opportunityId ||
    '',
  ).trim();
  if (startOpportunityId && entryOpportunityId && startOpportunityId !== entryOpportunityId) return false;
  const startOpportunitySequence = Math.max(
    0,
    Number(start?.opportunitySequence || start?.meta?.opportunitySequence || 0),
  );
  const entryOpportunitySequence = Math.max(
    0,
    Number(
      entry?.opportunitySequence ??
      entry?.actionOpportunity?.opportunitySequence ??
      selected?.opportunitySequence ??
      0,
    ),
  );
  if (
    startOpportunitySequence > 0 &&
    entryOpportunitySequence > 0 &&
    startOpportunitySequence !== entryOpportunitySequence
  ) return false;
  return true;
}

function selectedHasPaidCost(candidate = {}) {
  const costs = candidate?.declaration?.resourceCosts || candidate?.costs || {};
  return Object.values(costs).some(value => Number.parseFloat(String(value ?? 0)) > 0);
}

function selectedHasCompensation(candidate = {}) {
  const vector = candidate?.vector || {};
  const terminalEvidence = candidate?.terminalEvidence || {};
  const crisis = candidate?.crisisResponseAudit || {};
  const repeated = candidate?.repeatedActionAudit || {};
  const nextValue = candidate?.nextValueAudit || {};
  const resourceBankruptcy = candidate?.resourceBankruptcyCompensationAudit ||
    repeated?.resourceBankruptcyCompensationAudit ||
    nextValue?.resourceBankruptcyCompensationAudit ||
    {};
  return (
    terminalEvidence?.direct?.achieved === true ||
    terminalEvidence?.response?.preventsFailure === true ||
    terminalEvidence?.response?.improvesSuccessProbability === true ||
    Number(vector?.terminalUtility || 0) > 0.0001 ||
    Number(vector?.objectiveProgress || 0) > 0.0001 ||
    Number(vector?.catastrophicRiskReduction || 0) > 0.0001 ||
    Number(vector?.informationValue || 0) > 0.0001 ||
    crisis?.realized === true && (
      Number(crisis?.targetCapacityDelta || 0) > 0.01 ||
      Number(crisis?.threatCapacityDelta || 0) > 0.01 ||
      Number(crisis?.catastrophicRiskReduction || 0) > 0.01 ||
      crisis?.threatSuppressed === true ||
      crisis?.actionGranted === true
    ) ||
    Number(repeated?.repeatedActionDelta || 0) > 0.0001 ||
    (Array.isArray(repeated?.extendedWindowIds) && repeated.extendedWindowIds.length > 0) ||
    (Array.isArray(repeated?.newlyDeniedOpportunityIds) && repeated.newlyDeniedOpportunityIds.length > 0) ||
    Number(nextValue?.valueAddedOutsideStateDelta || 0) > 0.0001 ||
    resourceBankruptcy?.compensated === true
  );
}

function selectedHasMaterialRiskCompensation(candidate = {}) {
  const vector = candidate?.vector || {};
  const terminalEvidence = candidate?.terminalEvidence || {};
  const crisis = candidate?.crisisResponseAudit || {};
  const materialCrisisCompensation =
    Number(crisis?.targetCapacityDelta || 0) > 0.01 ||
    Number(crisis?.threatCapacityDelta || 0) > 0.01 ||
    Number(crisis?.catastrophicRiskReduction || 0) > 0.01 ||
    crisis?.threatSuppressed === true ||
    crisis?.actionGranted === true;
  return (
    terminalEvidence?.direct?.achieved === true ||
    terminalEvidence?.response?.preventsFailure === true ||
    terminalEvidence?.response?.improvesSuccessProbability === true ||
    Number(vector?.terminalUtility || 0) > 0.0001 ||
    Number(vector?.objectiveProgress || 0) > 0.0001 ||
    Number(vector?.catastrophicRiskReduction || 0) > 0.0001 ||
    materialCrisisCompensation
  );
}

function selectedHasRepeatEvidence(candidate = {}) {
  const repeated = candidate?.repeatedActionAudit || {};
  return (
    (Array.isArray(repeated?.addedValueEvidence) && repeated.addedValueEvidence.length > 0) ||
    (Array.isArray(repeated?.extendedWindowIds) && repeated.extendedWindowIds.length > 0) ||
    (Array.isArray(repeated?.newlyDeniedOpportunityIds) && repeated.newlyDeniedOpportunityIds.length > 0) ||
    Number(repeated?.repeatedActionDelta || 0) > 0.0001 ||
    selectedHasCompensation(candidate)
  );
}

function crisisProblemsOf(entry = {}) {
  return (Array.isArray(entry?.problems) ? entry.problems : [])
    .filter(problem => [
      'SURVIVAL_CRISIS',
      'ALLY_CRISIS',
      'IMMINENT_DENIAL',
      'RESOURCE_SURVIVAL_CRISIS',
      'RESOURCE_ACTION_CRISIS',
    ].includes(String(problem?.problemId || '').trim()));
}

const peerProbeResult = runManualCase('duel_peer_unknown_probe');
checks.push(check(
  'adaptation.repeated_failure_changes_action_family_or_target',
  failureGroups(peerProbeResult).length === 0 || hasPostFailureAdaptation(peerProbeResult),
  {
    repeatedFailureGroups: failureGroups(peerProbeResult).map(group => ({
      actorId: group.actorId,
      signature: group.signature,
      count: group.events.length,
    })),
    adapted: hasPostFailureAdaptation(peerProbeResult),
    adaptationAudits: failureAdaptationAudits(peerProbeResult),
  },
));

const chargeInterruptResult = runManualCase('duel_charge_interrupt_safer');
checks.push(check(
  'adaptation.repeated_charge_failure_changes_action_or_resource_route',
  failureGroups(chargeInterruptResult).length === 0 || hasPostFailureAdaptation(chargeInterruptResult),
  {
    repeatedFailureGroups: failureGroups(chargeInterruptResult).map(group => ({
      actorId: group.actorId,
      signature: group.signature,
      count: group.events.length,
    })),
    adapted: hasPostFailureAdaptation(chargeInterruptResult),
    adaptationAudits: failureAdaptationAudits(chargeInterruptResult),
  },
));

const protectResult = runManualCase('team_protect_critical_ally');
const protectCrisisDecisions = activeDecisions(protectResult).filter(entry =>
  (entry?.problems || []).some(problem => String(problem?.problemId || '').trim() === 'ALLY_CRISIS'),
);
const protectRealized = protectCrisisDecisions.filter(entry =>
  entry?.selected?.crisisResponseAudit?.realized === true &&
  Number(entry?.selected?.nextValueAudit?.expectedAfterResponseUtility || 0) >
    Number(entry?.selected?.nextValueAudit?.expectedNoOpResponseUtility || 0) + 0.01,
);
checks.push(check(
  'crisis.protection_has_positive_delta_against_noop',
  protectCrisisDecisions.length === 0 || protectRealized.length > 0,
  {
    crisisDecisionCount: protectCrisisDecisions.length,
    realizedCount: protectRealized.length,
    audits: protectCrisisDecisions.map(entry => ({
      actorId: entry.actorId,
      selected: entry.selected?.candidateId || '',
      realized: entry.selected?.crisisResponseAudit?.realized === true,
      after: entry.selected?.nextValueAudit?.expectedAfterResponseUtility,
      noOp: entry.selected?.nextValueAudit?.expectedNoOpResponseUtility,
    })),
  },
));

const resourceSupportResult = runManualCase('team_resource_support');
const resourceSupportFacts = (resourceSupportResult.ledger || []).filter(event =>
  String(event?.eventKind || '').trim() === 'resource_change' &&
  String(event?.meta?.source || event?.source || '').trim() !== 'natural_recovery' &&
  Number(event?.meta?.delta ?? event?.delta ?? 0) > 0 &&
  String(event?.actorId || event?.actorName || '').trim() !== String(event?.targetId || event?.targetName || '').trim(),
);
const supportedTargets = new Set(resourceSupportFacts.map(event =>
  String(event?.targetId || event?.targetName || '').trim(),
).filter(Boolean));
const resourceLedger = Array.isArray(resourceSupportResult.ledger) ? resourceSupportResult.ledger : [];
const resourceLedgerIndexByEventId = new Map(resourceLedger.map((event, index) => [
  String(event?.eventId || '').trim(),
  index,
]));
const actionLabel = declaration => String(
  declaration?.skill?.name ||
  declaration?.skill?.魂技名 ||
  declaration?.skill?.技能名称 ||
  declaration?.actionKind ||
  '',
).trim();
const candidateLabel = candidateId => String(candidateId || '')
  .match(/:(?:skill|forced-skill):(.+):\d+$/)?.[1] || '';
const laterPaidConsumer = activeDecisions(resourceSupportResult).some(entry => {
  const actorId = String(entry?.actorId || '').trim();
  const declaration = entry?.selected?.declaration || {};
  const paid = Object.values(declaration?.resourceCosts || {}).some(value => Number(value || 0) > 0);
  if (
    !supportedTargets.has(actorId) ||
    !paid ||
    !['RELEASE_SKILL', 'USE_ITEM', 'EQUIP'].includes(String(declaration?.actionKind || '').trim())
  ) return false;
  const label = actionLabel(declaration) === String(declaration?.actionKind || '').trim()
    ? candidateLabel(entry?.selected?.candidateId)
    : actionLabel(declaration);
  const actionStartIndex = resourceLedger.findIndex(event =>
    ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
    String(event?.actorId || event?.actorName || '').trim() === actorId &&
    Number(event?.round || 0) >= Number(
      Math.min(...resourceSupportFacts
        .filter(item => String(item?.targetId || item?.targetName || '').trim() === actorId)
        .map(item => Number(item?.round || 0))),
    ) &&
    (!label ||
      String(event?.actionName || event?.actionType || '').trim() === label ||
      String(event?.actionKind || '').trim() === String(declaration?.actionKind || '').trim()),
  );
  if (actionStartIndex < 0) return false;
  return resourceSupportFacts.some(event =>
    String(event?.targetId || event?.targetName || '').trim() === actorId &&
    Number(resourceLedgerIndexByEventId.get(String(event?.eventId || '').trim())) < actionStartIndex,
  );
});
checks.push(check(
  'resource.support_changes_a_future_consumer_or_is_absent',
  resourceSupportFacts.length === 0 || laterPaidConsumer,
  {
    supportFactCount: resourceSupportFacts.length,
    supportedTargets: [...supportedTargets],
    laterPaidConsumer,
    supportFacts: resourceSupportFacts.map(event => ({
      eventId: event?.eventId || '',
      ledgerIndex: resourceLedgerIndexByEventId.get(String(event?.eventId || '').trim()),
      round: event?.round || 0,
      actorId: event?.actorId || '',
      targetId: event?.targetId || '',
      sourceActionId: event?.sourceActionId || event?.actionId || '',
    })),
    paidConsumers: activeDecisions(resourceSupportResult)
      .filter(entry => Object.values(entry?.selected?.declaration?.resourceCosts || {}).some(value => Number(value || 0) > 0))
      .map(entry => {
        const declaration = entry?.selected?.declaration || {};
        const label = actionLabel(declaration) === String(declaration?.actionKind || '').trim()
          ? candidateLabel(entry?.selected?.candidateId)
          : actionLabel(declaration);
        return {
          actorId: entry?.actorId || '',
          round: entry?.round || 0,
          actionKind: declaration?.actionKind || '',
          actionLabel: label,
          selectedCandidateId: entry?.selected?.candidateId || '',
          actionStartIndex: resourceLedger.findIndex(event =>
            ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
            String(event?.actorId || event?.actorName || '').trim() === String(entry?.actorId || '').trim() &&
            Number(event?.round || 0) >= Number(entry?.round || 0) &&
            (!label ||
              String(event?.actionName || event?.actionType || '').trim() === label ||
              String(event?.actionKind || '').trim() === String(declaration?.actionKind || '').trim()),
          ),
        };
      }),
  },
));

const visibleThreatResult = runManualCase('team_unknown_enemy_adaptation');
const visibleCharge = (visibleThreatResult.ledger || []).find(event =>
  ['charge_start', 'action_start'].includes(String(event?.eventKind || '').trim()) &&
  /蓄力/.test(String(event?.actionName || '').trim()),
);
const chargeActorId = String(visibleCharge?.actorId || visibleCharge?.actorName || '').trim();
const threatResponses = activeDecisions(visibleThreatResult).filter(entry =>
  Number(entry?.round || 0) > 0 &&
  Number(entry?.round || 0) < Number(visibleCharge?.round || Infinity) &&
  (entry?.problems || []).some(problem => String(problem?.problemId || '').trim() === 'IMMINENT_DENIAL'),
);
const threatResponseRealized = threatResponses.some(entry =>
  (entry?.selected?.predictedOutcomeEvidence || []).some(evidence =>
    String(evidence?.outcomeKind || '').trim() === 'ACTION_CANCELLED' &&
    String(evidence?.targetId || '').trim() === chargeActorId,
  ) ||
  (entry?.selected?.repeatedActionAudit?.controlWindowRealizability?.realizableTargetIds || [])
    .map(value => String(value || '').trim())
    .includes(chargeActorId),
);
checks.push(check(
  'threat.visible_charge_has_realizable_denial_or_protection',
  !visibleCharge || threatResponses.length === 0 || threatResponseRealized,
  {
    chargeActorId,
    threatResponseCount: threatResponses.length,
    threatResponseRealized,
  },
));

const counterTeamResult = runManualCase('team_counter_coordination');
const openedCounterWindows = (counterTeamResult.ledger || []).filter(event =>
  String(event?.eventKind || '').trim() === 'counter_window' &&
  String(event?.result || '').trim() === 'opened',
);
const counterDecisions = (counterTeamResult.decisions || []).filter(entry =>
  String(entry?.actionRole || '').trim().toUpperCase() === 'COUNTER',
);
const settledCounterChain = openedCounterWindows.some(window => {
  const windowActorId = String(window?.actorId || window?.actorName || '').trim();
  const windowTargetId = String(window?.targetId || window?.targetName || '').trim();
  const matchingDecision = counterDecisions.find(entry =>
    ((
      String(entry?.actorId || '').trim() === windowActorId &&
      (entry?.selected?.declaration?.targetIds || []).map(String).includes(windowTargetId)
    ) || (
      String(entry?.actorId || '').trim() === windowTargetId &&
      (entry?.selected?.declaration?.targetIds || []).map(String).includes(windowActorId)
    )) &&
    entry?.selected?.counterDeclineFallback !== true,
  );
  const matchingSettlement = (counterTeamResult.ledger || []).find(event =>
    String(event?.eventKind || '').trim() === 'counter' &&
    (
      String(event?.actorId || event?.actorName || '').trim() === windowActorId &&
      String(event?.targetId || event?.targetName || '').trim() === windowTargetId
    ) || (
      String(event?.actorId || event?.actorName || '').trim() === windowTargetId &&
      String(event?.targetId || event?.targetName || '').trim() === windowActorId
    ),
  );
  return Boolean(matchingDecision && matchingSettlement);
});
checks.push(check(
  'team.counter_window_owner_consumes_and_settles',
  openedCounterWindows.length === 0 || settledCounterChain,
  {
    openedWindowCount: openedCounterWindows.length,
    counterDecisionCount: counterDecisions.length,
    settled: settledCounterChain,
    openedWindows: openedCounterWindows.map(window => ({
      eventId: window?.eventId || '',
      round: window?.round || 0,
      actorId: window?.actorId || '',
      targetId: window?.targetId || '',
      sourceActionId: window?.sourceActionId || window?.actionId || '',
    })),
    counterDecisions: counterDecisions.map(entry => ({
      actorId: entry?.actorId || '',
      opportunityId: entry?.opportunityId || '',
      grantId: entry?.grantId || '',
      selectedCandidateId: entry?.selected?.candidateId || '',
      targetIds: entry?.selected?.declaration?.targetIds || [],
      declarationActionId: entry?.selected?.declaration?.actionId || '',
    })),
    counterFacts: (counterTeamResult.ledger || [])
      .filter(event => String(event?.eventKind || '').trim() === 'counter')
      .map(event => ({
        eventId: event?.eventId || '',
        result: event?.result || '',
        round: event?.round || 0,
        actorId: event?.actorId || '',
        targetId: event?.targetId || '',
        sourceActionId: event?.sourceActionId || event?.actionId || '',
      })),
  },
));

const formalRepeatedFailureGroups = failureGroups(formalResult);
checks.push(check(
  'continuity.long_horizon_uses_public_failure_evidence_when_present',
  formalRepeatedFailureGroups.length === 0 || hasPostFailureAdaptation(formalResult),
  {
    repeatedFailureGroups: formalRepeatedFailureGroups.map(group => ({
      actorId: group.actorId,
      signature: group.signature,
      count: group.events.length,
    })),
    adapted: hasPostFailureAdaptation(formalResult),
    adaptationAudits: failureAdaptationAudits(formalResult),
    postFailureDecisions: formalRepeatedFailureGroups.flatMap(group => {
      const evidenceRound = [...group.events]
        .map(event => Number(event?.round || 0))
        .sort((left, right) => left - right)[1];
      return activeDecisions(formalResult)
        .filter(entry =>
          String(entry?.actorId || '').trim() === group.actorId &&
          Number(entry?.round || 0) > evidenceRound,
        )
        .map(entry => ({
          round: entry?.round || 0,
          signature: decisionSignature(entry),
          selectedCandidateId: entry?.selected?.candidateId || '',
          objectiveUtility: entry?.selected?.objectiveUtility,
          failureAdaptation: entry?.selected?.repeatedActionAudit?.failureAdaptation || null,
          strategyContinuity: entry?.selected?.repeatedActionAudit?.strategyContinuityAudit || null,
        }));
    }),
  },
));

for (const caseId of [
  'raid_balanced',
  'raid_control_heavy',
  'raid_summon_heavy',
  'team_multi_target_response',
]) {
  const result = runManualCase(caseId);
  const reportAudit = buildPlayerReport(result);
  const targetGroupFailures = [];
  const targetGroupMismatchFailures = [];
  const factById = new Map((reportAudit.reportDto?.factRegistry || []).map(fact => [fact.factId, fact]));
  (reportAudit.reportDto?.exchanges || []).forEach(exchange => {
    const groups = Array.isArray(exchange?.targetGroups) ? exchange.targetGroups : [];
    if (groups.length <= 1) return;
    const owners = new Map();
    groups.forEach(group => (group?.factIds || []).forEach(factId => {
      const previous = owners.get(String(factId || '').trim());
      if (previous && previous !== String(group?.targetId || group?.targetName || '').trim()) {
        targetGroupFailures.push({
          exchangeId: exchange.exchangeId,
          factId,
          previous,
          current: String(group?.targetId || group?.targetName || '').trim(),
        });
      }
      owners.set(String(factId || '').trim(), String(group?.targetId || group?.targetName || '').trim());
      const fact = factById.get(factId);
      const groupId = String(group?.targetId || '').trim();
      const groupName = String(group?.targetName || '').trim();
      const targetIds = Array.isArray(fact?.targetIds) ? fact.targetIds.map(value => String(value || '').trim()) : [];
      const targetHostNames = Array.isArray(fact?.targetHostNames)
        ? fact.targetHostNames.map(value => String(value || '').trim())
        : [];
      const matchesTarget =
        targetIds.length === 0 ||
        targetIds.length === 1 && (
          targetIds[0] === groupId ||
          String(fact?.targetName || '').trim() === groupName
        ) ||
        targetHostNames.includes(groupId) ||
        targetHostNames.includes(groupName) ||
        String(fact?.actorId || '').trim() === groupId ||
        String(fact?.actorName || '').trim() === groupName ||
        String(fact?.actorHostName || '').trim() === groupId ||
        String(fact?.actorHostName || '').trim() === groupName;
      if (!fact || !matchesTarget) {
        targetGroupMismatchFailures.push({
          exchangeId: exchange.exchangeId,
          factId,
          groupId,
          groupName,
          actorId: fact?.actorId || '',
          actorHostName: fact?.actorHostName || '',
          targetIds,
          targetName: fact?.targetName || '',
        });
      }
    }));
  });
  checks.push(check(
    `report.${caseId}.target_groups_have_unique_fact_ownership`,
    targetGroupFailures.length === 0,
    { targetGroupFailures },
  ));
  checks.push(check(
    `report.${caseId}.target_groups_match_target_or_reactor_host`,
    targetGroupMismatchFailures.length === 0,
    { targetGroupMismatchFailures },
  ));
}

const reasonCaseResults = ['raid_balanced', 'raid_control_heavy', 'team_protect_critical_ally']
  .map(runManualCase)
  .map(result => ({ result, audit: buildPlayerReport(result) }));
const reasonFailures = reasonCaseResults.flatMap(({ result, audit }) =>
  (audit.reportDto?.adjudications || []).flatMap(item => {
    const reason = String(item?.reasonSummary || '').trim();
    const alternatives = Array.isArray(item?.alternatives) ? item.alternatives : [];
    const decisionIndex = Math.max(
      0,
      Number(String(item?.adjudicationId || '').split(':').at(-1) || 0) - 1,
    );
    const decision = result?.decisions?.[decisionIndex] || {};
    const nonChoiceDecision = Boolean(
      decision?.lostOpportunity?.reasonCode ||
      decision?.selected?.playerLocked === true ||
      String(decision?.selected?.selectionMode || '').trim().toUpperCase() === 'PLAYER_LOCKED' ||
      decision?.selected?.forcedAction === true ||
      decision?.selected?.counterDeclineFallback === true,
    );
    const selectedCandidateId = String(decision?.selected?.candidateId || '').trim();
    const availableAlternatives = (decision?.scoreAudit || []).filter(candidate =>
      candidate?.selected !== true &&
      String(candidate?.candidateId || '').trim() !== selectedCandidateId,
    );
    if (nonChoiceDecision) {
      if (!reason || alternatives.length === 0) return [];
      return [{
        caseId: result.caseId,
        adjudicationId: item.adjudicationId,
        alternatives: alternatives.length,
        availableAlternatives: availableAlternatives.length,
        reason: 'NON_CHOICE_ADJUDICATION_EXPOSED_ALTERNATIVES',
      }];
    }
    if (!reason || availableAlternatives.length < 2 || alternatives.length >= 2) return [];
    return [{
      caseId: result.caseId,
      adjudicationId: item.adjudicationId,
      alternatives: alternatives.length,
      availableAlternatives: availableAlternatives.length,
    }];
  }),
);
checks.push(check(
  'report.adjudications_expose_two_structured_alternatives_when_available',
  reasonFailures.length === 0,
  { reasonFailures },
));

const rootCauseCaseIds = [
  'duel_overmatch_lethal',
  'duel_underdog_survival',
  'duel_peer_unknown_probe',
  'duel_agile_counter_options',
  'duel_charge_interrupt_safer',
  'duel_charge_defense_safer',
  'team_focus_without_overkill',
  'team_protect_critical_ally',
  'team_heal_crisis',
  'team_resource_support',
  'team_counter_coordination',
  'team_unknown_enemy_adaptation',
  'raid_balanced',
  'raid_level_gap',
  'raid_control_heavy',
  'raid_summon_heavy',
  'team_multi_target_response',
  'item_creation_consumption',
  'equipment_switch_no_loop',
  'summon_one_window',
];
const rootCauseResults = new Map(rootCauseCaseIds.map(caseId => [caseId, runManualCase(caseId)]));
const rootCauseReports = new Map(
  [...rootCauseResults.entries()].map(([caseId, result]) => [caseId, buildPlayerReport(result)]),
);

function sourceUnitId(unit = {}) {
  return String(unit?.id || unit?.name || unit?.名称 || '').trim();
}

function caseSideIndex(caseId) {
  const definition = manualCaseById.get(caseId);
  const participants = definition?.combatData?.参战者 || {};
  const sideById = new Map();
  for (const unit of participants?.team_player || []) {
    const id = sourceUnitId(unit);
    if (id) sideById.set(id, 'player');
  }
  for (const unit of participants?.team_enemy || []) {
    const id = sourceUnitId(unit);
    if (id) sideById.set(id, 'enemy');
  }
  return sideById;
}

function candidateRows(entry = {}) {
  return Array.isArray(entry?.candidateAudit) && entry.candidateAudit.length
    ? entry.candidateAudit
    : Array.isArray(entry?.scoreAudit)
      ? entry.scoreAudit
      : [];
}

function effectIndexFromEvidence(evidence = {}) {
  const match = String(evidence?.sourceEffectId || '').match(/:effect:(\d+)(?::|$)/);
  return match ? Number(match[1]) : -1;
}

const objectiveProgressOwnershipFailures = [];
const resourceContinuityFlowFailures = [];
const informationRegretAggregationFailures = [];
const crisisMaterialityFailures = [];
const frozenScoreStageFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  selectedDecisionEntries(result).forEach(entry => {
    const candidates = candidateRows(entry);
    const candidateById = new Map(candidates.map(candidate => [
      String(candidate?.candidateId || '').trim(),
      candidate,
    ]));
    const scoreById = new Map(
      (Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : []).map(candidate => [
        String(candidate?.candidateId || '').trim(),
        candidate,
      ]),
    );
    const selectedId = String(entry?.selected?.candidateId || '').trim();
    const selectedCandidate = candidateById.get(selectedId);
    const selectedScore = scoreById.get(selectedId);
    if (
      selectedId &&
      (
        !selectedCandidate ||
        !selectedScore ||
        Math.abs(Number(entry?.selected?.objectiveUtility || 0) - Number(selectedCandidate?.objectiveUtility || 0)) > 0.000001 ||
        Math.abs(Number(entry?.selected?.objectiveUtility || 0) - Number(selectedScore?.objectiveUtility || 0)) > 0.000001 ||
        String(entry?.selected?.rejectionCode || '').trim() !== String(selectedCandidate?.rejectionCode || '').trim() ||
        String(entry?.selected?.rejectionCode || '').trim() !== String(selectedScore?.rejectionCode || '').trim()
      )
    ) {
      frozenScoreStageFailures.push({
        caseId,
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        candidateId: selectedId,
        selectedUtility: Number(entry?.selected?.objectiveUtility || 0),
        candidateUtility: Number(selectedCandidate?.objectiveUtility || 0),
        scoreUtility: Number(selectedScore?.objectiveUtility || 0),
        reason: 'SELECTED_CANDIDATE_STAGE_MISMATCH',
      });
    }
    candidates.forEach(candidate => {
      const vector = candidate?.vector || {};
      const nextValueAudit = candidate?.nextValueAudit || {};
      const objectiveProgress = Number(vector?.objectiveProgress || 0);
      const noOpProgress = Number(nextValueAudit?.noOp?.nonDuplicatedGoalProgress || 0);
      const afterProgress = Number(nextValueAudit?.after?.nonDuplicatedGoalProgress || 0);
      const ownedProgressDelta = afterProgress - noOpProgress;
      if (
        objectiveProgress > 0.000001 &&
        Number(vector?.terminalUtility || 0) <= 0.000001 &&
        ownedProgressDelta <= 0.000001
      ) {
        objectiveProgressOwnershipFailures.push({
          caseId,
          round: Number(entry?.round || 0),
          actorId: entry?.actorId || '',
          candidateId: candidate?.candidateId || '',
          objectiveProgress,
          ownedProgressDelta,
          expectedStateGain: Number(vector?.expectedStateGain || 0),
          reason: 'OBJECTIVE_PROGRESS_HAS_NO_NON_DUPLICATED_STATE_OWNER',
        });
      }

      const continuity = Number(
        candidate?.repeatedActionAudit?.resourceContinuityAudit?.resourceContinuityDelta ??
        nextValueAudit?.resourceContinuityAudit?.resourceContinuityDelta ??
        vector?.resourceContinuity ??
        0,
      );
      if (Math.abs(continuity) > 0.000001) {
        const resourceContinuityCapacityDelta =
          Number(nextValueAudit?.resourceContinuityCapacityDelta);
        const signMismatch =
          Number.isFinite(resourceContinuityCapacityDelta) &&
          Math.abs(resourceContinuityCapacityDelta) > 0.000001 &&
          Math.sign(resourceContinuityCapacityDelta) !== Math.sign(continuity);
        if (
          !Number.isFinite(resourceContinuityCapacityDelta) ||
          Math.abs(resourceContinuityCapacityDelta) <= 0.000001 ||
          signMismatch
        ) {
          resourceContinuityFlowFailures.push({
            caseId,
            round: Number(entry?.round || 0),
            actorId: entry?.actorId || '',
            candidateId: candidate?.candidateId || '',
            continuity,
            resourceContinuityCapacityDelta:
              Number.isFinite(resourceContinuityCapacityDelta)
                ? resourceContinuityCapacityDelta
                : null,
            expectedStateGain: Number(vector?.expectedStateGain || 0),
            reason: signMismatch
              ? 'RESOURCE_CONTINUITY_SIGN_NOT_REFLECTED_IN_CAPACITY'
              : 'RESOURCE_CONTINUITY_ISOLATED_CAPACITY_DELTA_MISSING',
          });
        }
      }

      const informationAudit = nextValueAudit?.informationAudit || {};
      const informationValue = Number(vector?.informationValue || informationAudit?.value || 0);
      if (informationValue > 0.000001) {
        const groups = Array.isArray(informationAudit?.groups) ? informationAudit.groups : [];
        const groupRegretBounds = groups.map(group => Math.max(
          0,
          Number(group?.regretBefore || 0) - Number(group?.expectedRegretAfter || 0),
        ));
        groups.forEach((group, groupIndex) => {
          if (Number(group?.value || 0) > Number(groupRegretBounds[groupIndex] || 0) + 0.000001) {
            informationRegretAggregationFailures.push({
              caseId,
              round: Number(entry?.round || 0),
              actorId: entry?.actorId || '',
              candidateId: candidate?.candidateId || '',
              groupKey: group?.groupKey || '',
              groupValue: Number(group?.value || 0),
              groupRegretBound: Number(groupRegretBounds[groupIndex] || 0),
              reason: 'CORRELATED_TARGETS_SUMMED_INSIDE_INFORMATION_GROUP',
            });
          }
        });
        const jointRegretBound = groupRegretBounds.reduce((sum, value) => sum + value, 0);
        if (!groups.length || informationValue > jointRegretBound + 0.000001) {
          informationRegretAggregationFailures.push({
            caseId,
            round: Number(entry?.round || 0),
            actorId: entry?.actorId || '',
            candidateId: candidate?.candidateId || '',
            informationValue,
            jointRegretBound,
            groupCount: groups.length,
            reason: 'INFORMATION_VALUE_EXCEEDS_JOINT_DECISION_REGRET_REDUCTION',
          });
        }
      }

      const crisisAudit = candidate?.crisisResponseAudit || nextValueAudit?.crisisResponseAudit || {};
      if (crisisAudit?.required === true && crisisAudit?.realized === true) {
        const problem = crisisProblemsOf(entry).find(item =>
          String(item?.problemId || '').trim() === String(crisisAudit?.problemId || '').trim()
        ) || crisisProblemsOf(entry)[0] || {};
        const threshold = Number(crisisAudit?.materialityThreshold);
        const realizedDelta = Number(crisisAudit?.materialRealizedDelta);
        if (
          !Number.isFinite(threshold) ||
          threshold <= 0 ||
          !Number.isFinite(realizedDelta) ||
          realizedDelta + 0.000001 < threshold ||
          threshold + 0.000001 < Math.max(0.05, Number(problem?.severity || 0) * 0.2)
        ) {
          crisisMaterialityFailures.push({
            caseId,
            round: Number(entry?.round || 0),
            actorId: entry?.actorId || '',
            candidateId: candidate?.candidateId || '',
            problemId: crisisAudit?.problemId || '',
            severity: Number(problem?.severity || 0),
            materialityThreshold: Number.isFinite(threshold) ? threshold : null,
            materialRealizedDelta: Number.isFinite(realizedDelta) ? realizedDelta : null,
            threatCapacityDelta: Number(crisisAudit?.threatCapacityDelta || 0),
            targetCapacityDelta: Number(crisisAudit?.targetCapacityDelta || 0),
            responseUtilityDelta: Number(crisisAudit?.responseUtilityDelta || 0),
            reason: 'CRISIS_REALIZED_WITHOUT_MATERIAL_CAUSAL_REDUCTION',
          });
        }
      }

      const failureAdaptation = candidate?.repeatedActionAudit?.failureAdaptation || {};
      if (
        failureAdaptation?.applied === true &&
        (
          String(failureAdaptation?.scoreStage || '').trim() !== 'FINAL_FROZEN' ||
          !Number.isFinite(Number(failureAdaptation?.finalObjectiveUtility)) ||
          Math.abs(
            Number(failureAdaptation?.finalObjectiveUtility || 0) -
            Number(candidate?.objectiveUtility || 0)
          ) > 0.000001
        )
      ) {
        frozenScoreStageFailures.push({
          caseId,
          round: Number(entry?.round || 0),
          actorId: entry?.actorId || '',
          candidateId: candidate?.candidateId || '',
          scoreStage: failureAdaptation?.scoreStage || '',
          finalObjectiveUtility: failureAdaptation?.finalObjectiveUtility,
          candidateObjectiveUtility: Number(candidate?.objectiveUtility || 0),
          reason: 'ADAPTATION_AUDIT_NOT_BOUND_TO_FINAL_FROZEN_SCORE',
        });
      }
    });
  });
}
checks.push(check(
  'value.objective_progress_has_one_nonduplicated_state_owner',
  objectiveProgressOwnershipFailures.length === 0,
  { objectiveProgressOwnershipFailures },
));
checks.push(check(
  'resource.two_opportunity_continuity_flows_into_team_capacity',
  resourceContinuityFlowFailures.length === 0,
  { resourceContinuityFlowFailures },
));
checks.push(check(
  'information.multi_target_observations_use_joint_regret_reduction',
  informationRegretAggregationFailures.length === 0,
  { informationRegretAggregationFailures },
));
checks.push(check(
  'crisis.realized_response_meets_severity_relative_materiality',
  crisisMaterialityFailures.length === 0,
  { crisisMaterialityFailures },
));
checks.push(check(
  'selection.all_consumers_use_the_same_final_frozen_candidate_value',
  frozenScoreStageFailures.length === 0,
  { frozenScoreStageFailures },
));

const adaptationRealismFailures = [
  ['duel_peer_unknown_probe', rootCauseResults.get('duel_peer_unknown_probe')],
  ['weixiaofeng_20_round', formalResult],
].flatMap(([caseId, result]) =>
  failureAdaptationAudits(result)
    .filter(audit => ['MISSING_ADAPTATION', 'UNPROVEN_FUTURE_OPPORTUNITY'].includes(audit?.status))
    .map(audit => ({ caseId, ...audit })),
);
checks.push(check(
  'adaptation.repeated_public_failure_changes_next_legal_strategy_in_time',
  adaptationRealismFailures.length === 0,
  { adaptationRealismFailures },
));

const previewRuntimeTargetFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  const sideById = caseSideIndex(caseId);
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  const startsByActionId = new Map(
    ledger
      .filter(event => ['action_start', 'charge_start', 'state_tick'].includes(String(event?.eventKind || '').trim()))
      .map(event => [String(event?.actionId || '').trim(), event]),
  );
  const summonAliasToId = new Map();
  ledger
    .filter(event => String(event?.eventKind || '').trim() === 'summon_create')
    .forEach(event => {
      const canonicalId = String(
        event?.targetId ||
        event?.summonKey ||
        event?.meta?.summonKey ||
        event?.meta?.summonId ||
        '',
      ).trim();
      if (!canonicalId) return;
      [
        event?.targetId,
        event?.targetName,
        event?.summonKey,
        event?.summonName,
        event?.meta?.summonKey,
        event?.meta?.summonName,
      ]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .forEach(alias => summonAliasToId.set(alias, canonicalId));
    });
  const targetAuditDecisionEntries = allSelectedDecisionEntries(result);
  const decisionByOpportunity = new Map(
    targetAuditDecisionEntries.map(entry => [
      String(
        entry?.opportunityId ||
        entry?.actionOpportunity?.opportunityId ||
        entry?.selected?.opportunityId ||
        '',
      ).trim(),
      entry,
    ]),
  );
  const selectedEntries = targetAuditDecisionEntries;
  const summonActorIds = new Set(
    ledger
      .filter(event => String(event?.eventKind || '').trim() === 'summon_create')
      .flatMap(event => [
        event?.targetId,
        event?.summonKey,
        event?.meta?.summonKey,
        event?.meta?.summonId,
      ])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  );
  const decisionByActionId = new Map(
    selectedEntries
      .map(entry => [
        String(
          entry?.selected?.declaration?.actionId ||
          entry?.selected?.candidateId ||
          '',
        ).trim(),
        entry,
      ])
      .filter(([actionId]) => actionId),
  );
  const decisionByCandidateId = new Map(
    selectedEntries
      .map(entry => [
        String(entry?.selected?.candidateId || '').trim(),
        entry,
      ])
      .filter(([candidateId]) => candidateId),
  );
  const decisionForStart = start => {
    const matchedEntries = selectedEntries.filter(entry =>
      decisionEntryMatchesActionStart(entry, start),
    );
    if (matchedEntries.length === 1) return matchedEntries[0];
    if (matchedEntries.length > 1) {
      const exactOpportunityId = String(
        start?.opportunityId ||
        start?.meta?.opportunityId ||
        '',
      ).trim();
      if (exactOpportunityId) {
        const exactOpportunity = matchedEntries.find(entry =>
          String(
            entry?.opportunityId ||
            entry?.actionOpportunity?.opportunityId ||
            entry?.selected?.opportunityId ||
            '',
          ).trim() === exactOpportunityId,
        );
        if (exactOpportunity) return exactOpportunity;
      }
      const exactSequence = Math.max(
        0,
        Number(start?.opportunitySequence || start?.meta?.opportunitySequence || 0),
      );
      if (exactSequence > 0) {
        const exactSequenceEntry = matchedEntries.find(entry =>
          Math.max(
            0,
            Number(
              entry?.opportunitySequence ??
              entry?.actionOpportunity?.opportunitySequence ??
              entry?.selected?.opportunitySequence ??
              0,
            ),
          ) === exactSequence,
        );
        if (exactSequenceEntry) return exactSequenceEntry;
      }
    }
    const decisionCandidateId = String(start?.meta?.decisionCandidateId || '').trim();
    if (decisionCandidateId && decisionByCandidateId.has(decisionCandidateId) && matchedEntries.length === 0) {
      return decisionByCandidateId.get(decisionCandidateId);
    }
    const opportunityId = String(start?.opportunityId || '').trim();
    if (opportunityId && decisionByOpportunity.has(opportunityId)) {
      return decisionByOpportunity.get(opportunityId);
    }
    const actionId = String(start?.actionId || '').trim();
    if (actionId && decisionByActionId.has(actionId)) {
      return decisionByActionId.get(actionId);
    }
    const actorId = String(start?.actorId || start?.actorName || '').trim();
    const actionName = String(start?.actionName || start?.finalActionName || '').trim();
    const round = Number(start?.round || 0);
    const fallback = selectedEntries.filter(entry =>
      Number(entry?.round || 0) === round &&
      isSameReportName(entry?.actorId || '', actorId) &&
      String(
        entry?.selected?.selectedActionName ||
        entry?.selected?.declaration?.skill?.name ||
        entry?.selected?.declaration?.skill?.魂技名 ||
        entry?.selected?.declaration?.actionKind ||
        '',
      ).trim() === actionName,
    );
    return fallback.length === 1 ? fallback[0] : null;
  };
  const actualTargetsByEffect = new Map();
  ledger.forEach(event => {
    const effectIndex = Number(event?.meta?.effectIndex);
    const directActionId = String(event?.actionId || '').trim();
    const sourceActionId = String(event?.sourceActionId || '').trim();
    const directRootActionId = directActionId.replace(/:effect:\d+(?::.*)?$/, '');
    const actionId = [
      directActionId,
      directRootActionId,
      sourceActionId,
    ].find(candidateId => startsByActionId.has(candidateId)) ||
      directActionId ||
      sourceActionId;
    if (!Number.isInteger(effectIndex) || effectIndex < 0 || !actionId) return;
    const start = startsByActionId.get(actionId);
    if (start) {
      const eventActor = String(event?.actorId || event?.actorName || '').trim();
      const startActor = String(start?.actorId || start?.actorName || '').trim();
      if (eventActor && startActor && !isSameReportName(eventActor, startActor)) return;
      const eventRole = runtime.normalizeActionRole(event?.actionRole || '', '');
      const startRole = runtime.normalizeActionRole(start?.actionRole || '', '');
      if (eventRole && startRole && eventRole !== startRole) return;
    }
    const targets = [
      ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
      event?.targetId,
    ]
      .map(value => String(value || '').trim())
      .map(value => summonAliasToId.get(value) || value)
      .filter(Boolean);
    if (!targets.length) return;
    const key = `${actionId}|${effectIndex}`;
    const set = actualTargetsByEffect.get(key) || new Set();
    targets.forEach(targetId => set.add(targetId));
    actualTargetsByEffect.set(key, set);
  });
  actualTargetsByEffect.forEach((actualTargetSet, key) => {
    const separator = key.lastIndexOf('|');
    const actionId = key.slice(0, separator);
    const effectIndex = Number(key.slice(separator + 1));
    const start = startsByActionId.get(actionId);
    const decision = decisionForStart(start);
    const systemSummonAssist =
      !!start &&
      String(start?.actionRole || '').trim().toUpperCase() === 'ASSIST' &&
      (
        summonActorIds.has(String(start?.actorId || start?.actorName || '').trim()) ||
        /summon|召唤/i.test(String(start?.actionType || start?.meta?.source || ''))
      );
    if (!decision && systemSummonAssist) return;
    const decisionEffectAudit = (decision?.selected?.effectTargetAudit || [])
      .find(entry => Number(entry?.effectIndex) === effectIndex);
    const runtimeEffectAudit = (start?.meta?.effectTargetAudit || [])
      .find(entry => Number(entry?.effectIndex) === effectIndex);
    const effectAudit = decisionEffectAudit || runtimeEffectAudit;
    const effect = decision?.selected?.declaration?.skill?._效果数组?.[effectIndex];
    if (!start || (!decision && !runtimeEffectAudit) || (!effectAudit && !effect)) {
      previewRuntimeTargetFailures.push({
        caseId,
        round: Number(start?.round || 0),
        actorId: start?.actorId || '',
        actionId,
        actionName: start?.actionName || '',
        effectIndex,
        effectPrototype: effectAudit?.prototype || effect?.原型 || '',
        effectTarget: effectAudit?.target || effect?.目标 || '',
        previewTargets: [],
        runtimeTargets: [...actualTargetSet].sort(),
        reason: !start
          ? 'RUNTIME_EFFECT_START_ANCHOR_MISSING'
          : !decision
            ? 'DECISION_FOR_RUNTIME_EFFECT_ANCHOR_MISSING'
            : 'DECISION_EFFECT_TARGET_AUDIT_MISSING',
      });
      return;
    }
    const previewTargetSet = new Set(
      Array.isArray(effectAudit?.previewTargetIds || effectAudit?.targetIds)
        ? (effectAudit.previewTargetIds || effectAudit.targetIds)
            .map(value => String(value || '').trim())
            .filter(Boolean)
        : (decision?.selected?.predictedOutcomeEvidence || [])
            .filter(evidence => effectIndexFromEvidence(evidence) === effectIndex)
            .map(evidence => String(evidence?.targetId || '').trim())
            .filter(Boolean),
    );
    const actualTargets = [...actualTargetSet].sort();
    const previewTargets = [...previewTargetSet].sort();
    const isSummonTargetId = targetId => {
      const normalized = String(targetId || '').trim();
      return summonActorIds.has(normalized) ||
        summonAliasToId.has(normalized) ||
        /^(preview-summon|structured-summon):/.test(normalized);
    };
    const previewSummonTargets = previewTargets.filter(isSummonTargetId);
    const previewConcreteTargets = previewTargets.filter(targetId => !isSummonTargetId(targetId));
    const actualSummonTargets = actualTargets.filter(isSummonTargetId);
    const actualConcreteTargets = actualTargets.filter(targetId => !isSummonTargetId(targetId));
    const prototype = String(effectAudit?.prototype || effect?.原型 || '').trim();
    const declaredEffect = effect ||
      decision?.selected?.declaration?.skill?._效果数组?.[effectIndex] ||
      null;
    const targetRule = String(
      effectAudit?.target ||
      effectAudit?.targetRule ||
      declaredEffect?.目标 ||
      effect?.目标 ||
      effect?.target ||
      '',
    ).trim();
    const previewHasComparableTargets = prototype === '召唤生成' || previewTargets.length > 0;
    if (prototype !== '召唤生成' && previewTargets.length === 0) {
      previewRuntimeTargetFailures.push({
        caseId,
        round: Number(start?.round || 0),
        actorId: start?.actorId || '',
        actionId,
        actionName: start?.actionName || '',
        effectIndex,
        effectPrototype: prototype,
        effectTarget: effectAudit?.target || effect?.目标 || '',
        previewTargets,
        runtimeTargets: actualTargets,
        reason: 'PREVIEW_EFFECT_TARGET_EVIDENCE_MISSING',
      });
    }
    if (
      previewHasComparableTargets &&
      prototype !== '召唤生成' &&
      (
        actualConcreteTargets.some(targetId => !previewConcreteTargets.includes(targetId)) ||
        actualSummonTargets.length > previewSummonTargets.length
      )
    ) {
      previewRuntimeTargetFailures.push({
        caseId,
        round: Number(start?.round || 0),
        actorId: start?.actorId || '',
        actionId,
        actionName: start?.actionName || '',
        effectIndex,
        effectPrototype: effectAudit?.prototype || effect?.原型 || '',
        effectTarget: effectAudit?.target || effect?.目标 || '',
        previewTargets,
        runtimeTargets: actualTargets,
        reason: 'PREVIEW_RUNTIME_EFFECT_TARGET_HASH_MISMATCH',
      });
    }
    const actorId = String(start?.actorId || start?.actorName || '').trim();
    const actorSide = sideById.get(actorId);
    actualTargets.forEach(targetId => {
      const targetSide = sideById.get(targetId);
      const violatesSelf = /自身|自己/.test(targetRule) && targetId !== actorId;
      const violatesAlly = /友方|己方/.test(targetRule) &&
        actorSide && targetSide && actorSide !== targetSide;
      const violatesEnemy = /敌方|对方/.test(targetRule) &&
        actorSide && targetSide && actorSide === targetSide;
      if (violatesSelf || violatesAlly || violatesEnemy) {
        previewRuntimeTargetFailures.push({
          caseId,
          round: Number(start?.round || 0),
          actorId,
          actionId,
          actionName: start?.actionName || '',
          effectIndex,
          effectPrototype: effectAudit?.prototype || effect?.原型 || '',
          effectTarget: targetRule,
          actualTargetId: targetId,
          actorSide,
          targetSide,
          reason: violatesSelf
            ? 'SELF_EFFECT_TARGET_DRIFT'
            : violatesAlly
              ? 'ALLY_EFFECT_RESOLVED_ON_ENEMY'
              : 'ENEMY_EFFECT_RESOLVED_ON_ALLY',
        });
      }
    });
  });
}
checks.push(check(
  'runtime.preview_and_settlement_share_each_effect_target_domain',
  previewRuntimeTargetFailures.length === 0,
  { previewRuntimeTargetFailures },
));

const independentRootMergeFailures = [];
const finalRiskPerspectiveFailures = [];
const playerLockedProjectionFailures = [];
const chargePlayerUnitFailures = [];
for (const [caseId, audit] of rootCauseReports.entries()) {
  const reportDto = audit?.reportDto || {};
  const facts = Array.isArray(reportDto?.factRegistry) ? reportDto.factRegistry : [];
  const factById = new Map(facts.map(fact => [String(fact?.factId || '').trim(), fact]));
  const exchangeById = new Map(
    (Array.isArray(reportDto?.exchanges) ? reportDto.exchanges : [])
      .map(exchange => [String(exchange?.exchangeId || '').trim(), exchange]),
  );
  (Array.isArray(reportDto?.clashGroups) ? reportDto.clashGroups : []).forEach(clash => {
    const activeRoots = (clash?.exchangeIds || []).flatMap(exchangeId => {
      const exchange = exchangeById.get(String(exchangeId || '').trim());
      if (!exchange) return [];
      const rootFacts = (exchange?.factIds || [])
        .map(factId => factById.get(String(factId || '').trim()))
        .filter(fact =>
          ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim()) &&
          String(fact?.actionRole || 'ACTIVE').trim().toUpperCase() === 'ACTIVE'
        );
      return rootFacts.map(fact => ({
        exchangeId: exchange?.exchangeId || '',
        actionId: String(fact?.actionId || '').trim(),
        sourceActionId: String(fact?.sourceActionId || '').trim(),
        parentActionId: String(fact?.parentActionId || '').trim(),
      }));
    });
    const independentPairs = [];
    for (let leftIndex = 0; leftIndex < activeRoots.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < activeRoots.length; rightIndex += 1) {
        const left = activeRoots[leftIndex];
        const right = activeRoots[rightIndex];
        const causallyLinked =
          left.actionId && (
            right.sourceActionId === left.actionId ||
            right.parentActionId === left.actionId
          ) ||
          right.actionId && (
            left.sourceActionId === right.actionId ||
            left.parentActionId === right.actionId
          );
        if (!causallyLinked) independentPairs.push([left, right]);
      }
    }
    if (independentPairs.length > 0) {
      independentRootMergeFailures.push({
        caseId,
        clashId: clash?.clashId || '',
        round: Number(clash?.round || 0),
        activeRoots,
        independentPairs,
      });
    }
  });

  const enemyUnits = reportDto?.finalSummary?.sides?.enemy?.units || [];
  const risks = reportDto?.finalSummary?.risks || [];
  risks.forEach((risk, riskIndex) => {
    const invalidEnemy = enemyUnits.find(unit =>
      String(risk || '').includes(String(unit?.name || '')) &&
      (
        /死亡|失去战斗力|昏迷/.test(String(unit?.actionState || '')) ||
        /生命已低于|魂力接近耗尽/.test(String(risk || ''))
      )
    );
    if (invalidEnemy) {
      finalRiskPerspectiveFailures.push({
        caseId,
        riskIndex,
        risk,
        enemyName: invalidEnemy?.name || '',
        enemyActionState: invalidEnemy?.actionState || '',
      });
    }
  });

  const decisions = Array.isArray(rootCauseResults.get(caseId)?.decisions)
    ? rootCauseResults.get(caseId).decisions
    : [];
  const adjudications = Array.isArray(reportDto?.adjudications) ? reportDto.adjudications : [];
  decisions.forEach((entry, decisionIndex) => {
    const selected = entry?.selected || {};
    const playerLocked =
      selected?.playerLocked === true ||
      String(selected?.selectionMode || entry?.actorControl || '').trim().toUpperCase() === 'PLAYER_LOCKED';
    if (!playerLocked) return;
    const adjudication = adjudications[decisionIndex];
    if (
      !adjudication ||
      String(adjudication?.reasonCategory || '').trim() !== 'PLAYER_LOCKED' ||
      !/^玩家已锁定/.test(String(adjudication?.reasonSummary || '').trim()) ||
      (Array.isArray(adjudication?.alternatives) && adjudication.alternatives.length > 0)
    ) {
      playerLockedProjectionFailures.push({
        caseId,
        decisionIndex,
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        reasonCategory: adjudication?.reasonCategory || '',
        reasonSummary: adjudication?.reasonSummary || '',
        alternativeCount: Array.isArray(adjudication?.alternatives)
          ? adjudication.alternatives.length
          : null,
      });
    }
  });

  const playerText = report.serializeFullText(reportDto);
  if (/剩余前摇\s*\d+(?:\.\d+)?点/.test(playerText)) {
    chargePlayerUnitFailures.push({
      caseId,
      reason: 'INTERNAL_CAST_TIME_POINT_EXPOSED_TO_PLAYER',
      matches: playerText.match(/剩余前摇\s*\d+(?:\.\d+)?点/g) || [],
    });
  }
  facts
    .filter(fact => ['charge_start', 'charge_progress'].includes(String(fact?.eventKind || '').trim()))
    .forEach(fact => {
      const remainingCastTime = Number(
        fact?.remainingCastTime ??
        fact?.meta?.remainingCastTime ??
        fact?.sourceEvent?.remainingCastTime,
      );
      if (
        remainingCastTime > 0 &&
        !Number.isFinite(Number(
          fact?.remainingOpportunityCount ??
          fact?.meta?.remainingOpportunityCount,
        ))
      ) {
        chargePlayerUnitFailures.push({
          caseId,
          factId: fact?.factId || '',
          remainingCastTime,
          reason: 'CHARGE_PROGRESS_MISSING_PLAYER_OPPORTUNITY_UNIT',
        });
      }
    });
}
checks.push(check(
  'report.clash_never_merges_independent_active_roots',
  independentRootMergeFailures.length === 0,
  { independentRootMergeFailures },
));
checks.push(check(
  'report.maximum_risk_uses_player_perspective_and_active_threats',
  finalRiskPerspectiveFailures.length === 0,
  { finalRiskPerspectiveFailures },
));
checks.push(check(
  'report.player_locked_actions_are_not_narrated_as_ai_choices',
  playerLockedProjectionFailures.length === 0,
  { playerLockedProjectionFailures },
));
checks.push(check(
  'report.charge_progress_uses_named_player_opportunity_units',
  chargePlayerUnitFailures.length === 0,
  { chargePlayerUnitFailures },
));

const manualReviewAuthoritySource = fs.readFileSync(
  path.resolve(toolDir, 'audit_battle_r74_manual_review_status.mjs'),
  'utf8',
);
const manualReviewAuthorityFailures = [];
if (
  !/path\.resolve\(toolDir,\s*'battle_r74_manual_reviews'/.test(manualReviewAuthoritySource) ||
  /path\.resolve\(root,\s*'artifacts',\s*'battle_r74_manual_reviews'/.test(manualReviewAuthoritySource)
) {
  manualReviewAuthorityFailures.push({
    reason: 'MANUAL_REVIEW_AUTHORITY_OUTSIDE_LWCS_GIT',
    expectedRoot: path.resolve(toolDir, 'battle_r74_manual_reviews'),
  });
}
checks.push(check(
  'manual_review.authority_is_versioned_inside_lwcs_git',
  manualReviewAuthorityFailures.length === 0,
  { manualReviewAuthorityFailures },
));

const continuousControlResult = rootCauseResults.get('duel_charge_interrupt_safer');
const continuousControlEvidence = selectedDecisionEntries(continuousControlResult)
  .filter(entry =>
    (entry?.selected?.repeatedActionAudit?.newlyDeniedOpportunityIds || []).length > 0 &&
    !String(entry?.selected?.rejectionCode || '').trim()
  );
checks.push(check(
  'protection.continuous_control_that_denies_new_opportunities_remains_legal',
  continuousControlEvidence.length > 0,
  {
    continuousControlEvidence: continuousControlEvidence.map(entry => ({
      round: Number(entry?.round || 0),
      actorId: entry?.actorId || '',
      candidateId: entry?.selected?.candidateId || '',
      deniedOpportunityIds: entry?.selected?.repeatedActionAudit?.newlyDeniedOpportunityIds || [],
    })),
  },
));

const levelGapResult = rootCauseResults.get('raid_level_gap');
checks.push(check(
  'protection.level_gap_lethal_resolution_is_not_misclassified_as_value_error',
  Number(levelGapResult?.roundsExecuted || 0) === 1 &&
    String(levelGapResult?.terminal?.winner || '').trim() === 'player',
  {
    roundsExecuted: Number(levelGapResult?.roundsExecuted || 0),
    terminal: levelGapResult?.terminal || null,
  },
));

const playerLockedProtectionFailures = [];
for (const caseId of ['item_creation_consumption', 'equipment_switch_no_loop', 'summon_one_window']) {
  const lockedEntries = selectedDecisionEntries(rootCauseResults.get(caseId)).filter(entry =>
    entry?.selected?.playerLocked === true ||
    String(entry?.selected?.selectionMode || entry?.actorControl || '').trim().toUpperCase() === 'PLAYER_LOCKED'
  );
  const first = lockedEntries[0];
  if (
    !first ||
    (
      first?.selected?.playerLocked !== true &&
      String(first?.selected?.selectionMode || first?.actorControl || '').trim().toUpperCase() !== 'PLAYER_LOCKED'
    ) ||
    String(first?.decisionProfile?.selectionPath || '').trim() !== 'PLAYER_LOCKED'
  ) {
    playerLockedProtectionFailures.push({
      caseId,
      actorId: first?.actorId || '',
      candidateId: first?.selected?.candidateId || '',
      selectionMode: first?.selected?.selectionMode || first?.actorControl || '',
      selectionPath: first?.decisionProfile?.selectionPath || '',
    });
  }
}
checks.push(check(
  'protection.player_locked_declaration_is_legal_without_ai_override',
  playerLockedProtectionFailures.length === 0,
  { playerLockedProtectionFailures },
));

const summonWindowProtectionFailures = [];
const summonWindowResult = rootCauseResults.get('summon_one_window');
const summonCreateCount = (summonWindowResult?.ledger || []).filter(event =>
  String(event?.eventKind || '').trim() === 'summon_create'
).length;
const summonAssistStarts = (summonWindowResult?.ledger || []).filter(event =>
  ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
  String(event?.actionRole || '').trim().toUpperCase() === 'ASSIST'
);
if (
  summonCreateCount < 1 ||
  summonAssistStarts.length < 1 ||
  summonAssistStarts.length > summonCreateCount
) {
  summonWindowProtectionFailures.push({
    summonCreateCount,
    summonAssistActionCount: summonAssistStarts.length,
    summonAssistActionIds: summonAssistStarts.map(event => event?.actionId || ''),
  });
}
checks.push(check(
  'protection.summon_one_window_is_consumed_once_and_closes_at_terminal',
  summonWindowProtectionFailures.length === 0,
  { summonWindowProtectionFailures },
));

const horizonLifecycleFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  const roundLimit = Math.max(1, Number(manualCaseById.get(caseId)?.rounds || 1));
  (Array.isArray(result?.ledger) ? result.ledger : [])
    .filter(event =>
      String(event?.eventKind || '').trim() === 'charge_start' &&
      String(event?.actionRole || 'ACTIVE').trim().toUpperCase() === 'ACTIVE'
    )
    .forEach(event => {
      const remainingCastTime = Math.max(
        0,
        Number(event?.remainingCastTime ?? event?.meta?.remainingCastTime ?? 0),
      );
      const remainingRounds = Math.max(0, roundLimit - Number(event?.round || 0));
      if (remainingCastTime > 0 && remainingRounds === 0) {
        horizonLifecycleFailures.push({
          caseId,
          eventId: event?.eventId || '',
          round: Number(event?.round || 0),
          roundLimit,
          actorId: event?.actorId || '',
          actionName: event?.actionName || '',
          remainingCastTime,
          reason: 'CHARGE_CANNOT_FINISH_BEFORE_BATTLE_HORIZON',
        });
      }
    });
}
checks.push(check(
  'horizon.unfinishable_charge_is_not_started_on_final_round',
  horizonLifecycleFailures.length === 0,
  { horizonLifecycleFailures },
));

const crisisStatusFailures = [];
const allowedCrisisStatuses = new Set([
  'FEASIBLE_AND_REALIZED',
  'FEASIBLE_BUT_NOT_SELECTED',
  'NO_FEASIBLE_CRISIS_RESPONSE',
]);
for (const [caseId, result] of rootCauseResults.entries()) {
  selectedDecisionEntries(result).forEach(entry => {
    const crisisCandidates = (Array.isArray(entry?.candidateAudit) ? entry.candidateAudit : [])
      .filter(candidate => candidate?.crisisResponseAudit?.required === true);
    if (!crisisCandidates.length) return;
    const selectedStatus = String(
      entry?.selected?.crisisResponseAudit?.selectionStatus || '',
    ).trim();
    if (!allowedCrisisStatuses.has(selectedStatus)) {
      crisisStatusFailures.push({
        caseId,
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        selectedCandidateId: entry?.selected?.candidateId || '',
        selectedStatus,
        realized: entry?.selected?.crisisResponseAudit?.realized === true,
        realizableCandidateIds: crisisCandidates
          .filter(candidate => candidate?.crisisResponseAudit?.realized === true)
          .map(candidate => candidate?.candidateId || ''),
        reason: 'CRISIS_SELECTION_STATUS_MISSING',
      });
    }
  });
  const adjudications = rootCauseReports.get(caseId)?.reportDto?.adjudications || [];
  adjudications.forEach(adjudication => {
    if (adjudication?.reasonEvidence?.crisisRequired !== true) return;
    const status = String(adjudication?.reasonEvidence?.crisisStatus || '').trim();
    if (!allowedCrisisStatuses.has(status)) {
      crisisStatusFailures.push({
        caseId,
        adjudicationId: adjudication?.adjudicationId || '',
        status,
        reason: 'REPORT_CRISIS_SELECTION_STATUS_MISSING',
      });
    }
  });
}
checks.push(check(
  'crisis.selection_and_report_use_explicit_feasibility_status',
  crisisStatusFailures.length === 0,
  { crisisStatusFailures },
));

const informationAggregationFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  selectedDecisionEntries(result).forEach(entry => {
    (Array.isArray(entry?.candidateAudit) ? entry.candidateAudit : []).forEach(candidate => {
      const audit = candidate?.nextValueAudit?.informationAudit || {};
      if (!(Number(audit?.value || 0) > 0)) return;
      const observations = Array.isArray(audit?.observations) ? audit.observations : [];
      const groups = Array.isArray(audit?.groups) ? audit.groups : [];
      const rankingChanged = audit?.rankingChanged === true;
      const regretBoundaryChanged = audit?.regretBoundaryChanged === true;
      if (
        groups.length === 0 ||
        typeof audit?.primaryReasonEligible !== 'boolean' ||
        audit.primaryReasonEligible !== (rankingChanged || regretBoundaryChanged)
      ) {
        informationAggregationFailures.push({
          caseId,
          round: Number(entry?.round || 0),
          actorId: entry?.actorId || '',
          candidateId: candidate?.candidateId || '',
          value: Number(audit?.value || 0),
          observationCount: observations.length,
          groupCount: groups.length,
          rankingChanged,
          regretBoundaryChanged,
          primaryReasonEligible: audit?.primaryReasonEligible,
          reason: 'CORRELATED_INFORMATION_AUDIT_INCOMPLETE',
        });
        return;
      }
      const groupKeys = groups.map(group => String(group?.groupKey || '').trim()).filter(Boolean);
      if (groupKeys.length !== groups.length || new Set(groupKeys).size !== groupKeys.length) {
        informationAggregationFailures.push({
          caseId,
          round: Number(entry?.round || 0),
          actorId: entry?.actorId || '',
          candidateId: candidate?.candidateId || '',
          groupKeys,
          reason: 'INFORMATION_GROUP_KEY_INVALID',
        });
      }
    });
  });
}
checks.push(check(
  'information.correlated_observations_are_grouped_before_player_reasoning',
  informationAggregationFailures.length === 0,
  { informationAggregationFailures },
));

const subjectiveSelectionAuditFailures = [];
const allowedSelectionPaths = new Set([
  'PLAYER_LOCKED',
  'FORCED_ACTION',
  'DIRECT_BEST',
  'SEEDED_SOFTMAX',
  'ALL_OPTIONS_NEGATIVE',
  'FORCED_FALLBACK',
]);
for (const [caseId, result] of rootCauseResults.entries()) {
  selectedDecisionEntries(result).forEach(entry => {
    const selected = entry?.selected || {};
    const playerLocked =
      selected?.playerLocked === true ||
      String(selected?.selectionMode || entry?.actorControl || '').trim().toUpperCase() === 'PLAYER_LOCKED';
    if (playerLocked) return;
    const profile = entry?.decisionProfile || {};
    const selectionPath = String(profile?.selectionPath || '').trim();
    const candidates = (Array.isArray(entry?.candidateAudit) ? entry.candidateAudit : [])
      .filter(candidate => !String(candidate?.rejectionCode || '').trim());
    const best = [...candidates].sort((left, right) =>
      Number(right?.objectiveUtility || 0) - Number(left?.objectiveUtility || 0) ||
      String(left?.candidateId || '').localeCompare(String(right?.candidateId || ''))
    )[0] || null;
    const nonnegative = candidates.find(candidate => Number(candidate?.objectiveUtility || 0) >= -1e-9);
    const selectedUtility = Number(selected?.objectiveUtility || 0);
    const normalizedRegret = Number(profile?.normalizedRegret);
    if (
      !allowedSelectionPaths.has(selectionPath) ||
      String(profile?.bestCandidateId || '').trim() !== String(best?.candidateId || '').trim() ||
      String(profile?.selectedCandidateId || '').trim() !== String(selected?.candidateId || '').trim() ||
      !Number.isFinite(normalizedRegret) ||
      !Object.hasOwn(profile, 'interferenceSource') ||
      !Object.hasOwn(profile, 'seedRoll')
    ) {
      subjectiveSelectionAuditFailures.push({
        caseId,
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        selectedCandidateId: selected?.candidateId || '',
        selectedUtility,
        bestCandidateId: best?.candidateId || '',
        bestUtility: Number(best?.objectiveUtility || 0),
        selectionPath,
        normalizedRegret: profile?.normalizedRegret,
        interferenceSource: profile?.interferenceSource,
        seedRoll: profile?.seedRoll,
        reason: 'SUBJECTIVE_SELECTION_PATH_INCOMPLETE',
      });
    }
    if (selectedUtility < -1e-9 && nonnegative) {
      subjectiveSelectionAuditFailures.push({
        caseId,
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        selectedCandidateId: selected?.candidateId || '',
        selectedUtility,
        nonnegativeCandidateId: nonnegative?.candidateId || '',
        nonnegativeUtility: Number(nonnegative?.objectiveUtility || 0),
        reason: 'NEGATIVE_SELECTED_WITH_NONNEGATIVE_ALTERNATIVE',
      });
    }
    if (
      candidates.length > 0 &&
      candidates.every(candidate => Number(candidate?.objectiveUtility || 0) < 0) &&
      (
        selectionPath !== 'ALL_OPTIONS_NEGATIVE' ||
        String(selected?.candidateId || '').trim() !== String(best?.candidateId || '').trim()
      )
    ) {
      subjectiveSelectionAuditFailures.push({
        caseId,
        round: Number(entry?.round || 0),
        actorId: entry?.actorId || '',
        selectedCandidateId: selected?.candidateId || '',
        bestCandidateId: best?.candidateId || '',
        selectionPath,
        reason: 'ALL_NEGATIVE_POOL_DID_NOT_SELECT_MINIMUM_LOSS',
      });
    }
  });
}
checks.push(check(
  'selection.subjective_choice_freezes_best_regret_path_and_negative_boundary',
  subjectiveSelectionAuditFailures.length === 0,
  { subjectiveSelectionAuditFailures },
));

const causalClashBoundaryFailures = [];
for (const [caseId, audit] of rootCauseReports.entries()) {
  const reportDto = audit?.reportDto || {};
  const facts = Array.isArray(reportDto?.factRegistry) ? reportDto.factRegistry : [];
  const factById = new Map(facts.map(fact => [String(fact?.factId || '').trim(), fact]));
  const exchangeById = new Map(
    (Array.isArray(reportDto?.exchanges) ? reportDto.exchanges : [])
      .map(exchange => [String(exchange?.exchangeId || '').trim(), exchange]),
  );
  (Array.isArray(reportDto?.clashGroups) ? reportDto.clashGroups : []).forEach(clash => {
    const exchanges = (clash?.exchangeIds || [])
      .map(exchangeId => exchangeById.get(String(exchangeId || '').trim()))
      .filter(Boolean);
    if (exchanges.length <= 1) return;
    const rootExchange = exchanges[0];
    const rootActorId = String(rootExchange?.actorId || '').trim();
    const rootTargetIds = new Set(
      (rootExchange?.targetIds || []).map(value => String(value || '').trim()).filter(Boolean),
    );
    const rootActionIds = new Set(
      (rootExchange?.factIds || [])
        .map(factId => factById.get(String(factId || '').trim()))
        .filter(fact => ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim()))
        .flatMap(fact => [fact?.actionId, fact?.sourceActionId])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    let reciprocalCount = 0;
    exchanges.slice(1).forEach(exchange => {
      const exchangeFacts = (exchange?.factIds || [])
        .map(factId => factById.get(String(factId || '').trim()))
        .filter(Boolean);
      const directCausal = exchangeFacts.some(fact =>
        rootActionIds.has(String(fact?.sourceActionId || '').trim()) ||
        rootActionIds.has(String(fact?.parentActionId || '').trim())
      );
      const reciprocal =
        rootTargetIds.has(String(exchange?.actorId || '').trim()) &&
        (exchange?.targetIds || []).map(value => String(value || '').trim()).includes(rootActorId);
      if (reciprocal) reciprocalCount += 1;
      if (!directCausal && !reciprocal) {
        causalClashBoundaryFailures.push({
          caseId,
          clashId: clash?.clashId || '',
          rootExchangeId: rootExchange?.exchangeId || '',
          exchangeId: exchange?.exchangeId || '',
          reason: 'TRANSITIVE_PARTICIPANT_MERGE',
        });
      }
    });
    if (reciprocalCount > 1 || exchanges.length > 3) {
      causalClashBoundaryFailures.push({
        caseId,
        clashId: clash?.clashId || '',
        exchangeIds: exchanges.map(exchange => exchange?.exchangeId || ''),
        exchangeCount: exchanges.length,
        reciprocalCount,
        reason: 'UNBOUNDED_ROUND_CLASH',
      });
    }
  });
}
checks.push(check(
  'report.clash_groups_use_direct_causality_or_one_bounded_reciprocal_exchange',
  causalClashBoundaryFailures.length === 0,
  { causalClashBoundaryFailures },
));

const peerProbeDecisions = activeDecisions(rootCauseResults.get('duel_peer_unknown_probe'))
  .filter(entry =>
    (entry?.problems || []).some(problem =>
      String(problem?.problemId || '').trim() === 'INFORMATION_DEFICIT'
    )
  );
const ordinaryProbeCandidates = peerProbeDecisions.flatMap(entry =>
  (Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : []).filter(candidate =>
    ['BASIC_ATTACK', 'RELEASE_SKILL', 'COUNTER'].includes(
      String(candidate?.actionKind || candidate?.declaration?.actionKind || '').trim().toUpperCase(),
    )
  )
);
checks.push(check(
  'information.ordinary_probe_can_reduce_public_regret',
  peerProbeDecisions.length === 0 ||
    ordinaryProbeCandidates.some(candidate => Number(candidate?.vector?.informationValue || 0) > 0.01),
  {
    informationDeficitDecisionCount: peerProbeDecisions.length,
    ordinaryProbeCandidates: ordinaryProbeCandidates.slice(0, 24).map(candidate => ({
      candidateId: candidate?.candidateId || '',
      actionKind: candidate?.actionKind || candidate?.declaration?.actionKind || '',
      informationValue: Number(candidate?.vector?.informationValue || 0),
    })),
  },
));

const crisisSelectionIsolationFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  activeDecisions(result).forEach(entry => {
    const candidates = Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : [];
    const hasCrisis = crisisProblemsOf(entry).length > 0;
    const selected = entry?.selected;
    const nonnegativeAlternative = candidates.find(candidate =>
      candidate?.selected !== true &&
      !candidate?.rejectionCode &&
      Number(candidate?.objectiveUtility || 0) >= 0
    );
    if (
      hasCrisis &&
      selected &&
      Number(selected?.objectiveUtility || 0) < 0 &&
      nonnegativeAlternative
    ) {
      crisisSelectionIsolationFailures.push({
        caseId,
        round: entry?.round || 0,
        actorId: entry?.actorId || '',
        selectedCandidateId: selected?.candidateId || '',
        selectedUtility: Number(selected?.objectiveUtility || 0),
        alternativeCandidateId: nonnegativeAlternative?.candidateId || '',
        alternativeUtility: Number(nonnegativeAlternative?.objectiveUtility || 0),
      });
    }
  });
}
checks.push(check(
  'crisis.realized_subset_never_hides_nonnegative_alternative',
  crisisSelectionIsolationFailures.length === 0,
  { crisisSelectionIsolationFailures },
));

const adaptationOrDegenerationEvidence = [
  'duel_peer_unknown_probe',
  'duel_agile_counter_options',
  'team_counter_coordination',
  'item_creation_consumption',
].flatMap(caseId => activeDecisions(rootCauseResults.get(caseId)).flatMap(entry => {
  const selected = entry?.selected || {};
  const adaptation = selected?.repeatedActionAudit?.failureAdaptation || {};
  const continuity = selected?.strategyContinuityAudit ||
    selected?.repeatedActionAudit?.strategyContinuityAudit ||
    {};
  return adaptation?.applied === true || continuity?.applied === true
    ? [{
        caseId,
        round: entry?.round || 0,
        actorId: entry?.actorId || '',
        adaptationApplied: adaptation?.applied === true,
        degenerationApplied: continuity?.applied === true,
      }]
    : [];
}));
checks.push(check(
  'adaptation.problem_cases_apply_public_learning_or_strategy_pivot',
  adaptationOrDegenerationEvidence.length > 0,
  { adaptationOrDegenerationEvidence },
));

const summonResultForRole = rootCauseResults.get('raid_summon_heavy');
const summonIdsForRole = new Set(
  (summonResultForRole?.ledger || [])
    .filter(event => String(event?.eventKind || '').trim() === 'summon_create')
    .flatMap(event => [
      event?.targetId,
      event?.summonKey,
      event?.meta?.summonKey,
    ])
    .map(value => String(value || '').trim())
    .filter(Boolean),
);
const summonTerminalProblemFailures = activeDecisions(summonResultForRole).flatMap(entry =>
  (entry?.problems || []).flatMap(problem => {
    if (String(problem?.problemId || '').trim() !== 'TERMINAL_OPPORTUNITY') return [];
    const invalidTargets = (problem?.targetIds || [])
      .map(value => String(value || '').trim())
      .filter(targetId => summonIdsForRole.has(targetId));
    return invalidTargets.length
      ? [{
          round: entry?.round || 0,
          actorId: entry?.actorId || '',
          targetIds: invalidTargets,
        }]
      : [];
  })
);
checks.push(check(
  'summon.auxiliary_unit_is_not_primary_terminal_opportunity',
  summonTerminalProblemFailures.length === 0,
  { summonTerminalProblemFailures, summonIds: [...summonIdsForRole] },
));

const controlOpportunityFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  activeDecisions(result).forEach(entry => {
    const audit = entry?.selected?.repeatedActionAudit?.controlWindowRealizability;
    if (!audit?.hasCancellation) return;
    (audit?.realizableTargetIds || []).forEach(targetId => {
      const opportunityIds = audit?.opportunityIdsByTarget?.[targetId] || [];
      if (!Array.isArray(opportunityIds) || opportunityIds.length === 0) {
        controlOpportunityFailures.push({
          caseId,
          round: entry?.round || 0,
          actorId: entry?.actorId || '',
          targetId,
        });
      }
    });
  });
}
checks.push(check(
  'control.realizable_window_names_exact_denied_opportunity',
  controlOpportunityFailures.length === 0,
  { controlOpportunityFailures },
));

const clashProjectionFailures = [];
for (const [caseId, audit] of rootCauseReports.entries()) {
  const reportDto = audit?.reportDto || {};
  const exchanges = Array.isArray(reportDto?.exchanges) ? reportDto.exchanges : [];
  const clashes = Array.isArray(reportDto?.clashGroups) ? reportDto.clashGroups : [];
  const membership = new Map();
  clashes.forEach(clash => (clash?.exchangeIds || []).forEach(exchangeId => {
    const key = String(exchangeId || '').trim();
    membership.set(key, (membership.get(key) || 0) + 1);
    const exchange = exchanges.find(item => String(item?.exchangeId || '').trim() === key);
    if (!exchange || Number(exchange?.round || 0) !== Number(clash?.round || 0)) {
      clashProjectionFailures.push({
        caseId,
        clashId: clash?.clashId || '',
        exchangeId: key,
        reason: !exchange ? 'EXCHANGE_MISSING' : 'ROUND_MISMATCH',
      });
    }
  }));
  exchanges.forEach(exchange => {
    const exchangeId = String(exchange?.exchangeId || '').trim();
    if (membership.get(exchangeId) !== 1) {
      clashProjectionFailures.push({
        caseId,
        exchangeId,
        count: membership.get(exchangeId) || 0,
        reason: 'MEMBERSHIP_INVALID',
      });
    }
  });
}
checks.push(check(
  'report.atomic_exchanges_have_one_lossless_round_clash',
  clashProjectionFailures.length === 0,
  { clashProjectionFailures },
));

const delayedFactProjectionFailures = [];
const counterDecisionScopeFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  const reportDto = rootCauseReports.get(caseId)?.reportDto || {};
  const facts = Array.isArray(reportDto?.factRegistry) ? reportDto.factRegistry : [];
  const factById = new Map(facts.map(fact => [fact.factId, fact]));
  facts
    .filter(fact => fact.eventKind === 'state_tick' && fact.sourceActionId)
    .forEach(fact => {
      const source = facts.find(candidate =>
        ['action_start', 'charge_start'].includes(candidate?.eventKind) &&
        candidate.actionId === fact.sourceActionId
      );
      const adjudication = (reportDto.adjudications || []).find(item =>
        item.exchangeId === source?.canonicalFactOwner &&
        item.sourceEventId === source?.factId
      );
      if (!source || !adjudication || !adjudication.actual?.factIds?.includes(fact.factId)) {
        delayedFactProjectionFailures.push({
          caseId,
          factId: fact.factId,
          sourceFactId: source?.factId || '',
          sourceOwner: source?.canonicalFactOwner || '',
          adjudicationId: adjudication?.adjudicationId || '',
        });
      }
    });
  (result?.decisions || []).forEach((entry, decisionIndex) => {
    if (entry?.selected?.counterDeclineFallback !== true) return;
    const adjudication = reportDto.adjudications?.[decisionIndex];
    const unrelatedDeclarations = (adjudication?.actual?.factIds || [])
      .map(factId => factById.get(factId))
      .filter(fact =>
        ['action_start', 'charge_start'].includes(fact?.eventKind) &&
        fact.actorId !== adjudication?.actorId &&
        fact.actorHostName !== adjudication?.actorId &&
        fact.actorHostName !== adjudication?.actorName
      );
    if (!adjudication || unrelatedDeclarations.length > 0) {
      counterDecisionScopeFailures.push({
        caseId,
        decisionIndex,
        adjudicationId: adjudication?.adjudicationId || '',
        unrelatedFactIds: unrelatedDeclarations.map(fact => fact.factId),
      });
    }
  });
}
checks.push(check(
  'report.delayed_state_ticks_reference_their_canonical_source_adjudication',
  delayedFactProjectionFailures.length === 0,
  { delayedFactProjectionFailures },
));
checks.push(check(
  'report.counter_decline_adjudications_exclude_unrelated_action_declarations',
  counterDecisionScopeFailures.length === 0,
  { counterDecisionScopeFailures },
));

const crisisAuditFailures = [];
const crisisAlternativeFailures = [];
const crisisNoSolutionFailures = [];
const crisisPerCandidateBlacklistFailures = [];
const nonDuplicatedGoalProgressFailures = [];
const positiveFreeProgressFailures = [];
const resourceAuditFailures = [];
const resourceContinuitySemanticFailures = [];
const failureAdaptationSemanticFailures = [];
const resourceBankruptcyFailures = [];
const informationBankruptcyCompensationFailures = [];
const adaptationSelectionStateFailures = [];
const teamIntentAuditFailures = [];
const negativeRiskFailures = [];
const absoluteRiskDoubleCountFailures = [];
const repeatedPatternFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  selectedDecisionEntries(result).forEach(entry => {
    const selected = entry.selected;
    const crisisProblems = crisisProblemsOf(entry);
    const candidates = Array.isArray(entry.scoreAudit) ? entry.scoreAudit : [];
    const hasRealizableCrisisResponse = candidates.some(candidate =>
      candidate?.crisisResponseAudit?.required === true &&
      candidate?.crisisResponseAudit?.realized === true,
    );
    candidates.forEach(candidate => {
      const actionKind = String(candidate?.declaration?.actionKind || '').trim().toUpperCase();
      const vector = candidate?.vector || {};
      const expectedUnclampedObjectiveUtility =
        Number(vector?.expectedStateGain || 0) +
        Number(vector?.terminalUtility || 0) +
        Number(vector?.objectiveProgress || 0) +
        Number(vector?.informationValue || 0) +
        Number(vector?.irreversibleAssetCost || 0) -
        Number(vector?.resourceThreatResolutionPenalty || 0) -
        Number(vector?.failureAdaptationPenalty || 0);
      const expectedOutsideStateDelta =
        Number(vector?.terminalUtility || 0) +
        Number(vector?.objectiveProgress || 0) +
        Number(vector?.informationValue || 0) +
        Number(vector?.irreversibleAssetCost || 0) -
        Number(vector?.resourceThreatResolutionPenalty || 0);
      if (
        Math.abs(
          Number(vector?.unclampedObjectiveUtility || 0) -
          expectedUnclampedObjectiveUtility
        ) > 0.000001 ||
        Math.abs(
          Number(candidate?.nextValueAudit?.valueAddedOutsideStateDelta || 0) -
          expectedOutsideStateDelta
        ) > 0.000001
      ) {
        absoluteRiskDoubleCountFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          candidateId: candidate?.candidateId || '',
          catastrophicRisk: Number(vector?.catastrophicRisk || 0),
          actualUnclampedObjectiveUtility: Number(vector?.unclampedObjectiveUtility || 0),
          expectedUnclampedObjectiveUtility,
          actualOutsideStateDelta: Number(candidate?.nextValueAudit?.valueAddedOutsideStateDelta || 0),
          expectedOutsideStateDelta,
        });
      }
      const objectiveProgress = Number(vector?.objectiveProgress || 0);
      const objectiveProgressAudit =
        vector?.objectiveProgressAudit ||
        candidate?.objectiveProgressAudit ||
        candidate?.nextValueAudit?.objectiveProgressAudit ||
        {};
      const hasNonDuplicatedGoalProgress =
        objectiveProgressAudit?.makesDeadlineFeasible === true &&
        Number(objectiveProgressAudit?.progressGain || 0) > 0.000001 &&
        Number(objectiveProgressAudit?.requiredProgress || 0) > 0.000001;
      if (
        objectiveProgress > 0.000001 &&
        Number(vector?.terminalUtility || 0) <= 0.000001 &&
        !hasNonDuplicatedGoalProgress
      ) {
        nonDuplicatedGoalProgressFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          candidateId: candidate?.candidateId || '',
          objectiveProgress,
          expectedStateGain: Number(vector?.expectedStateGain || 0),
          objectiveProgressAudit,
          reason: 'ORDINARY_STATE_DELTA_REWARDED_AS_GOAL_PROGRESS',
        });
      }
      const hasDirectProgress = (candidate?.predictedOutcomeEvidence || []).some(evidence => {
        const outcomeKind = String(evidence?.outcomeKind || '').trim().toUpperCase();
        const expectedDelta = Number(evidence?.expectedDelta || 0);
        return (
          outcomeKind === 'HP_DELTA' && expectedDelta < -0.0001 ||
          outcomeKind === 'SHIELD_DELTA' && Math.abs(expectedDelta) > 0.0001 ||
          ['ACTION_CANCELLED', 'ACTION_GRANTED', 'SUMMON_WINDOW'].includes(outcomeKind)
        );
      });
      if (
        !selectedHasPaidCost(candidate) &&
        !['DEFEND', 'EVADE', 'GUARD', 'WITHDRAW'].includes(actionKind) &&
        hasDirectProgress &&
        Number(candidate?.vector?.expectedStateGain || 0) > 0.05 &&
        String(candidate?.rejectionCode || '').trim() === 'ZERO_PROGRESS'
      ) {
        positiveFreeProgressFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          candidateId: candidate?.candidateId || '',
          actionKind,
          expectedStateGain: Number(candidate?.vector?.expectedStateGain || 0),
          objectiveUtility: Number(candidate?.objectiveUtility || 0),
        });
      }
      if (
        crisisProblems.length > 0 &&
        !hasRealizableCrisisResponse &&
        candidate?.crisisResponseAudit?.required === true &&
        Number(candidate?.vector?.expectedStateGain || 0) > 0.05 &&
        String(candidate?.rejectionCode || '').trim() === 'CRISIS_RESPONSE_NOT_REALIZED'
      ) {
        crisisNoSolutionFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          candidateId: candidate?.candidateId || '',
          expectedStateGain: Number(candidate?.vector?.expectedStateGain || 0),
        });
      }
      if (String(candidate?.rejectionCode || '').trim() === 'CRISIS_RESPONSE_NOT_REALIZED') {
        crisisPerCandidateBlacklistFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          candidateId: candidate?.candidateId || '',
          crisisReasonCode: candidate?.crisisResponseAudit?.reasonCode || '',
          expectedStateGain: Number(candidate?.vector?.expectedStateGain || 0),
        });
      }
      const continuity = candidate?.repeatedActionAudit?.resourceContinuityAudit;
      if (continuity && Number.isFinite(Number(continuity.resourceContinuityDelta))) {
        const expectedContinuity = Number(continuity.resourceContinuityDelta);
        const actualContinuity = Number(candidate?.vector?.resourceContinuity || 0);
        const actualPreservation = Number(candidate?.vector?.resourcePreservation || 0);
        if (
          Math.abs(actualContinuity - expectedContinuity) > 0.000001 ||
          Math.abs(actualPreservation - expectedContinuity) > 0.000001
        ) {
          resourceContinuitySemanticFailures.push({
            caseId,
            round: entry.round,
            actorId: entry.actorId,
            candidateId: candidate?.candidateId || '',
            expectedContinuity,
            actualContinuity,
            actualPreservation,
          });
        }
        if (
          candidate?.repeatedActionAudit?.failureAdaptation?.applied === true &&
          (
            Math.abs(actualContinuity - expectedContinuity) > 0.000001 ||
            Math.abs(actualPreservation - expectedContinuity) > 0.000001
          )
        ) {
          failureAdaptationSemanticFailures.push({
            caseId,
            round: entry.round,
            actorId: entry.actorId,
            candidateId: candidate?.candidateId || '',
            adaptationPenalty: Number(
              candidate?.repeatedActionAudit?.failureAdaptation?.penalty || 0,
            ),
            expectedContinuity,
            actualContinuity,
            actualPreservation,
          });
        }
      }
      const bankruptcyCompensation =
        candidate?.resourceBankruptcyCompensationAudit ||
        candidate?.repeatedActionAudit?.resourceBankruptcyCompensationAudit ||
        candidate?.nextValueAudit?.resourceBankruptcyCompensationAudit ||
        {};
      const lostAffordableActionKeys = [
        ...(Array.isArray(continuity?.lostActionKeys) ? continuity.lostActionKeys : []),
        ...(Array.isArray(candidate?.repeatedActionAudit?.lostAffordableActions)
          ? candidate.repeatedActionAudit.lostAffordableActions
          : []),
      ].map(value => String(value || '').trim()).filter(Boolean);
      const bankruptcyReason = String(bankruptcyCompensation?.reason || '').trim().toUpperCase();
      const invalidObjectiveCompensation =
        bankruptcyReason === 'OBJECTIVE_PROGRESS' &&
        objectiveProgressAudit?.makesDeadlineFeasible !== true;
      if (
        bankruptcyCompensation?.compensated === true &&
        (
          lostAffordableActionKeys.length > 0 ||
          Number(vector?.resourceContinuity || 0) < -0.000001
        ) &&
        (
          bankruptcyReason === 'INFORMATION' ||
          invalidObjectiveCompensation
        )
      ) {
        informationBankruptcyCompensationFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          candidateId: candidate?.candidateId || '',
          bankruptcyReason,
          informationValue: Number(vector?.informationValue || 0),
          objectiveProgress,
          resourceContinuity: Number(vector?.resourceContinuity || 0),
          lostAffordableActionKeys,
          objectiveProgressAudit,
        });
      }
    });
    const adaptedCandidates = candidates.filter(candidate =>
      candidate?.repeatedActionAudit?.failureAdaptation?.applied === true
    );
    if (adaptedCandidates.length > 0) {
      const profile = entry?.decisionProfile || {};
      const status = String(profile?.adaptationSelectionStatus || '').trim();
      const selectedCandidateId = String(selected?.candidateId || '').trim();
      const selectedAdapted = adaptedCandidates.find(candidate =>
        String(candidate?.candidateId || '').trim() === selectedCandidateId
      );
      const allowedStatuses = new Set([
        'PIVOTED',
        'ORIGINAL_REMAINS_BEST',
        'LIMITED_MISJUDGMENT',
      ]);
      let invalidStatus = !allowedStatuses.has(status);
      if (status === 'PIVOTED' && selectedAdapted) invalidStatus = true;
      if (status === 'ORIGINAL_REMAINS_BEST') {
        invalidStatus = !selectedAdapted || !selectedHasRepeatEvidence(selected);
      }
      if (status === 'LIMITED_MISJUDGMENT') {
        invalidStatus =
          !selectedAdapted ||
          String(profile?.selectionPath || '').trim() !== 'SEEDED_SOFTMAX' ||
          !Number.isFinite(Number(profile?.normalizedRegret)) ||
          !Number.isFinite(Number(profile?.misjudgmentBudgetBefore)) ||
          !Number.isFinite(Number(profile?.misjudgmentBudgetAfter)) ||
          Number(profile?.misjudgmentBudgetAfter) >= Number(profile?.misjudgmentBudgetBefore);
      }
      if (invalidStatus) {
        adaptationSelectionStateFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          selectedCandidateId,
          adaptedCandidateIds: adaptedCandidates.map(candidate => candidate?.candidateId || ''),
          status,
          selectionPath: profile?.selectionPath || '',
          normalizedRegret: profile?.normalizedRegret,
          misjudgmentBudgetBefore: profile?.misjudgmentBudgetBefore,
          misjudgmentBudgetAfter: profile?.misjudgmentBudgetAfter,
        });
      }
    }
    if (crisisProblems.length > 0) {
      const crisisAudit = selected?.crisisResponseAudit;
      if (
        !crisisAudit ||
        typeof crisisAudit.required !== 'boolean' ||
        !Array.isArray(crisisAudit.targetIds) ||
        !String(crisisAudit.reasonCode || '').trim()
      ) {
        crisisAuditFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          selectedCandidateId: selected?.candidateId || '',
        });
      }
      const hasRealizedAlternative = (Array.isArray(entry.scoreAudit) ? entry.scoreAudit : []).some(candidate =>
        candidate?.selected !== true &&
        !candidate?.rejectionCode &&
        candidate?.crisisResponseAudit?.realized === true,
      );
      if (
        selected?.crisisResponseAudit?.realized !== true &&
        hasRealizedAlternative &&
        selected?.repeatedActionAudit?.failureAdaptation?.applied !== true &&
        !(
          selected?.crisisAlternativeAudit &&
          String(selected.crisisAlternativeAudit.reasonCode || '').trim() &&
          String(selected.crisisAlternativeAudit.reasonCode || '').trim() !== 'NO_STRUCTURED_REASON'
        )
      ) {
        crisisAlternativeFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          selectedCandidateId: selected?.candidateId || '',
        });
      }
    }

    if (selectedHasPaidCost(selected)) {
      const continuity = selected?.repeatedActionAudit?.resourceContinuityAudit;
      if (
        !continuity ||
        !Number.isFinite(Number(continuity?.resourceContinuityDelta)) ||
        !continuity?.before ||
        !continuity?.noOp ||
        !continuity?.after
      ) {
        resourceAuditFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          selectedCandidateId: selected?.candidateId || '',
        });
      }
      const runwayAfter = Number(selected?.repeatedActionAudit?.resourceRunwayAfter);
      const lostAffordableActions = Array.isArray(selected?.repeatedActionAudit?.lostAffordableActions)
        ? selected.repeatedActionAudit.lostAffordableActions
        : [];
      if (
        Number.isFinite(runwayAfter) &&
        runwayAfter === 0 &&
        lostAffordableActions.length > 0 &&
        !selectedHasCompensation(selected)
      ) {
        resourceBankruptcyFailures.push({
          caseId,
          round: entry.round,
          actorId: entry.actorId,
          selectedCandidateId: selected?.candidateId || '',
          lostAffordableActions,
        });
      }
    }

    const teamIntent = entry?.teamIntent || {};
    const teamIntentApplicable = Boolean(
      String(teamIntent?.focusTarget || '').trim() ||
      String(teamIntent?.protectTarget || '').trim() ||
      String(teamIntent?.exploitableWindow || '').trim() ||
      (Array.isArray(teamIntent?.threatSourceIds) && teamIntent.threatSourceIds.length > 0),
    );
    if (teamIntentApplicable && !selected?.teamIntentAudit) {
      teamIntentAuditFailures.push({
        caseId,
        round: entry.round,
        actorId: entry.actorId,
        selectedCandidateId: selected?.candidateId || '',
      });
    }

    const selectedUtility = Number(selected?.objectiveUtility);
    const vector = selected?.vector || {};
    const forcedFallback = selected?.forcedFallback === true &&
      String(selected?.fallbackReason || '').trim() === 'NO_ELIGIBLE_CANDIDATE';
    if (
      Number.isFinite(selectedUtility) &&
      selectedUtility < -0.01 &&
      (
        Number(vector?.catastrophicRisk || 0) > 0.01 ||
        Number(vector?.irreversibleAssetCost || 0) > 0.01 ||
        selectedHasPaidCost(selected)
      ) &&
      !forcedFallback &&
      !selectedHasMaterialRiskCompensation(selected)
    ) {
      negativeRiskFailures.push({
        caseId,
        round: entry.round,
        actorId: entry.actorId,
        selectedCandidateId: selected?.candidateId || '',
        objectiveUtility: selectedUtility,
        rejectionCode: selected?.rejectionCode || '',
        actionKind: selected?.declaration?.actionKind || '',
        resourceCosts: selected?.declaration?.resourceCosts || selected?.costs || {},
        forcedFallback: selected?.forcedFallback === true,
        fallbackReason: selected?.fallbackReason || '',
        riskCompensationAudit: selected?.riskCompensationAudit || null,
        repeatedActionAudit: selected?.repeatedActionAudit || null,
        terminalEvidence: selected?.terminalEvidence || null,
        crisisResponseAudit: selected?.crisisResponseAudit || null,
        vector: selected?.vector || {},
      });
    }
  });

  const decisions = selectedDecisionEntries(result);
  const bySignature = new Map();
  const actorDecisionRows = new Map();
  decisions.forEach(entry => {
    const key = `${String(entry?.actorId || '').trim()}|${decisionSignature(entry)}`;
    const rows = bySignature.get(key) || [];
    rows.push(entry);
    bySignature.set(key, rows);
    const actorRows = actorDecisionRows.get(String(entry?.actorId || '').trim()) || [];
    actorRows.push(entry);
    actorDecisionRows.set(String(entry?.actorId || '').trim(), actorRows);
  });
  actorDecisionRows.forEach(rows => rows.sort((left, right) =>
    Number(left?.round || 0) - Number(right?.round || 0) ||
    decisionOpportunitySequence(left) - decisionOpportunitySequence(right)
  ));
  bySignature.forEach((rows, signature) => {
    if (rows.length < 3) return;
    rows.slice(1).forEach(entry => {
      const actorRows = actorDecisionRows.get(String(entry?.actorId || '').trim()) || [];
      const actorIndex = actorRows.indexOf(entry);
      const previousActorEntry = actorIndex > 0 ? actorRows[actorIndex - 1] : null;
      if (!previousActorEntry || decisionSignature(previousActorEntry) !== signature) return;
      const selectedRepeated = entry?.selected?.repeatedActionAudit || {};
      const selectedIsExplicitlyRejected = String(entry?.selected?.rejectionCode || '').trim() === 'ZERO_PROGRESS';
      if (
        !selectedIsExplicitlyRejected &&
        !selectedHasRepeatEvidence(entry.selected) &&
        selectedRepeated?.zeroProgressReason !== 'NO_REALIZED_MARGINAL_OR_WINDOW'
      ) {
        const repeated = entry?.selected?.repeatedActionAudit || {};
        const vector = entry?.selected?.vector || {};
        const decisionRound = Number(entry?.round || 0);
        const selectedActionKind = String(entry?.selected?.declaration?.actionKind || '').trim().toUpperCase();
        const selectedTargetIds = (entry?.selected?.declaration?.targetIds || [])
          .map(value => String(value || '').trim())
          .filter(Boolean);
        const actualFacts = (result?.ledger || [])
          .filter(event =>
            ['hit_result', 'effect_resolved', 'resource_change', 'state_apply', 'shield_create'].includes(
              String(event?.eventKind || '').trim(),
            ) &&
            Number(event?.round || 0) === decisionRound &&
            String(event?.actorId || event?.actorName || '').trim() === String(entry?.actorId || '').trim() &&
            (
              !selectedTargetIds.length ||
              selectedTargetIds.some(targetId => [
                ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
                event?.targetId,
                event?.targetName,
              ].map(value => String(value || '').trim()).includes(targetId))
            ),
          )
          .map(event => ({
            eventId: event?.eventId || '',
            eventKind: event?.eventKind || '',
            actionKind: event?.actionKind || event?.actionType || '',
            result: event?.result || event?.primaryOutcome || '',
            appliedDamage: Number(event?.appliedDamage || event?.meta?.appliedDamage || 0),
            targetIds: event?.targetIds || event?.targetId || [],
          }));
        repeatedPatternFailures.push({
          caseId,
          signature,
          round: entry.round,
          actorId: entry.actorId,
          selectedCandidateId: entry.selected?.candidateId || '',
          actionKind: selectedActionKind,
          targetIds: selectedTargetIds,
          isRepeatedAction: repeated?.isRepeatedAction === true,
          previousActionId: repeated?.previousActionId || '',
          repeatedActionDelta: Number(repeated?.repeatedActionDelta || 0),
          addedValueEvidenceCount: Array.isArray(repeated?.addedValueEvidence)
            ? repeated.addedValueEvidence.length
            : 0,
          extendedWindowCount: Array.isArray(repeated?.extendedWindowIds)
            ? repeated.extendedWindowIds.length
            : 0,
          deniedOpportunityCount: Array.isArray(repeated?.newlyDeniedOpportunityIds)
            ? repeated.newlyDeniedOpportunityIds.length
            : 0,
          lifecycleWindowRealizable: repeated?.lifecycleWindowRealizable === true,
          resourceRunwayBefore: repeated?.resourceRunwayBefore ?? null,
          resourceRunwayAfter: repeated?.resourceRunwayAfter ?? null,
          lostAffordableActionCount: Array.isArray(repeated?.lostAffordableActions)
            ? repeated.lostAffordableActions.length
            : 0,
          objectiveUtility: Number(entry?.selected?.objectiveUtility || 0),
          expectedStateGain: Number(vector?.expectedStateGain || 0),
          predictedOutcomeEvidenceCount: Array.isArray(entry?.selected?.predictedOutcomeEvidence)
            ? entry.selected.predictedOutcomeEvidence.length
            : 0,
          predictedOutcomeEvidence: Array.isArray(entry?.selected?.predictedOutcomeEvidence)
            ? entry.selected.predictedOutcomeEvidence.slice(0, 4).map(evidence => ({
              outcomeKind: evidence?.outcomeKind || '',
              targetId: evidence?.targetId || '',
              expectedDelta: evidence?.expectedDelta ?? null,
              expectedValuePercent: evidence?.expectedValuePercent ?? null,
              windowId: evidence?.windowId || '',
            }))
            : [],
          actualFacts,
        });
      }
    });
  });
}

checks.push(check(
  'crisis.selected_choices_have_structured_delta_and_targets',
  crisisAuditFailures.length === 0,
  { crisisAuditFailures },
));
checks.push(check(
  'crisis.realizable_alternative_is_not_ignored_without_a_recorded_reason',
  crisisAlternativeFailures.length === 0,
  { crisisAlternativeFailures },
));
checks.push(check(
  'crisis.no_realizable_response_keeps_best_legal_progress',
  crisisNoSolutionFailures.length === 0,
  { crisisNoSolutionFailures },
));
checks.push(check(
  'crisis.response_is_ranked_after_value_freeze_not_hard_rejected_per_candidate',
  crisisPerCandidateBlacklistFailures.length === 0,
  { crisisPerCandidateBlacklistFailures },
));
checks.push(check(
  'objective.nonduplicated_goal_progress_only_rewards_new_terminal_feasibility',
  nonDuplicatedGoalProgressFailures.length === 0,
  { nonDuplicatedGoalProgressFailures },
));
checks.push(check(
  'progress.positive_free_action_is_not_zero_progress',
  positiveFreeProgressFailures.length === 0,
  { positiveFreeProgressFailures },
));
checks.push(check(
  'resource.paid_actions_have_two_opportunity_continuity_audit',
  resourceAuditFailures.length === 0,
  { resourceAuditFailures },
));
checks.push(check(
  'resource.vector_uses_two_opportunity_continuity_only',
  resourceContinuitySemanticFailures.length === 0,
  { resourceContinuitySemanticFailures },
));
checks.push(check(
  'adaptation.failure_penalty_does_not_masquerade_as_resource_continuity',
  failureAdaptationSemanticFailures.length === 0,
  { failureAdaptationSemanticFailures },
));
checks.push(check(
  'resource.bankruptcy_requires_compensation',
  resourceBankruptcyFailures.length === 0,
  { resourceBankruptcyFailures },
));
checks.push(check(
  'resource.information_or_infeasible_partial_progress_cannot_compensate_bankruptcy',
  informationBankruptcyCompensationFailures.length === 0,
  { informationBankruptcyCompensationFailures },
));
checks.push(check(
  'adaptation.public_failure_changes_selection_or_consumes_bounded_misjudgment',
  adaptationSelectionStateFailures.length === 0,
  { adaptationSelectionStateFailures },
));
checks.push(check(
  'risk.negative_costly_selection_has_compensation_evidence',
  negativeRiskFailures.length === 0,
  { negativeRiskFailures },
));
checks.push(check(
  'risk.absolute_catastrophic_risk_is_not_double_subtracted_from_no_op_delta',
  absoluteRiskDoubleCountFailures.length === 0,
  { absoluteRiskDoubleCountFailures },
));
checks.push(check(
  'team.intent_has_selection_audit',
  teamIntentAuditFailures.length === 0,
  { teamIntentAuditFailures },
));
checks.push(check(
  'continuity.repeated_actions_have_window_or_marginal_evidence',
  repeatedPatternFailures.length === 0,
  { repeatedPatternFailures },
));

const summonResult = rootCauseResults.get('summon_one_window');
const summonCreates = (summonResult?.ledger || []).filter(event =>
  String(event?.eventKind || '').trim() === 'summon_create',
);
const summonIds = new Set(summonCreates.flatMap(event => [
  event?.targetId,
  event?.summonKey,
  event?.meta?.summonKey,
].map(value => String(value || '').trim()).filter(Boolean)));
const summonActionFacts = (summonResult?.ledger || []).filter(event =>
  ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()) &&
  (
    summonIds.has(String(event?.actorId || '').trim()) ||
    String(event?.actionRole || '').trim().toUpperCase() === 'ASSIST'
  ),
);
const summonDecisions = (summonResult?.decisions || []).filter(entry =>
  String(entry?.actionRole || '').trim().toUpperCase() === 'ASSIST' ||
  summonIds.has(String(entry?.actorId || '').trim()),
);
checks.push(check(
  'scenario.summon_creation_has_real_action_window_and_execution',
  summonCreates.length > 0 && (
    summonActionFacts.length > 0 &&
    (
      summonDecisions.length > 0 ||
      summonActionFacts.every(event =>
        String(event?.actionRole || '').trim().toUpperCase() === 'ASSIST' &&
        Boolean(String(event?.sourceActionId || event?.parentNodeId || '').trim())
      )
    )
  ),
  {
    summonCreateCount: summonCreates.length,
    summonActionFactCount: summonActionFacts.length,
    summonDecisionCount: summonDecisions.length,
    summonIds: [...summonIds],
  },
));

const summonTerminalClosureFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  const terminal = result?.terminal || result?.objectiveResolution || {};
  if (terminal?.terminal !== true) continue;
  const finalSummons = Array.isArray(result?.finalSnapshot?.summons)
    ? result.finalSnapshot.summons
    : [];
  const summonEndEvents = (Array.isArray(result?.ledger) ? result.ledger : [])
    .filter(event => String(event?.eventKind || '').trim() === 'summon_end');
  finalSummons
    .filter(summon =>
      Number(summon?.hp ?? summon?.HP ?? 0) > 0 &&
      Number(summon?.剩余窗口 ?? summon?.remainingWindows ?? 0) > 0
    )
    .forEach(summon => {
      const summonKey = String(summon?.召唤键 || summon?.summonKey || '').trim();
      const summonName = String(summon?.name || summon?.名称 || '').trim();
      const matchingEnd = summonEndEvents.find(event =>
        [event?.actorId, event?.targetId, event?.summonKey, event?.meta?.summonKey]
          .map(value => String(value || '').trim())
          .includes(summonKey) ||
        [event?.actorName, event?.targetName]
          .map(value => String(value || '').trim())
          .includes(summonName)
      );
      if (!matchingEnd) {
        summonTerminalClosureFailures.push({
          caseId,
          terminalReason: terminal?.terminalReason || '',
          summonKey,
          summonName,
          hp: Number(summon?.hp ?? summon?.HP ?? 0),
          remainingWindows: Number(summon?.剩余窗口 ?? summon?.remainingWindows ?? 0),
          hostName: summon?.宿主名 || summon?.hostName || '',
          reason: 'ACTIVE_SUMMON_SURVIVES_TERMINAL_WITHOUT_END_FACT',
        });
      }
    });
}
checks.push(check(
  'summon.terminal_result_snapshot_and_end_facts_close_the_same_lifecycle',
  summonTerminalClosureFailures.length === 0,
  { summonTerminalClosureFailures },
));

const effectTargetScopeFailures = [];
for (const [caseId, result] of rootCauseResults.entries()) {
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  const startsByActionId = new Map(
    ledger
      .filter(event => ['action_start', 'charge_start'].includes(String(event?.eventKind || '').trim()))
      .map(event => [String(event?.actionId || '').trim(), event]),
  );
  const decisionsByOpportunityId = new Map(
    selectedDecisionEntries(result).map(entry => [
      String(
        entry?.opportunityId ||
        entry?.actionOpportunity?.opportunityId ||
        entry?.selected?.opportunityId ||
        '',
      ).trim(),
      entry,
    ]),
  );
  ledger.forEach(event => {
    const effectIndex = Number(event?.meta?.effectIndex);
    const sourceActionId = String(event?.sourceActionId || event?.actionId || '').trim();
    if (!Number.isInteger(effectIndex) || effectIndex < 0 || !sourceActionId) return;
    const start = startsByActionId.get(sourceActionId);
    if (!start) return;
    const decision = decisionsByOpportunityId.get(String(start?.opportunityId || '').trim());
    const effects = decision?.selected?.declaration?.skill?._效果数组 || [];
    const effect = effects[effectIndex];
    if (!effect) return;
    const effectTarget = String(effect?.目标 || effect?.target || '').trim();
    const allowedTargetIds = new Set(
      (/自身|self/i.test(effectTarget)
        ? [start?.actorId || start?.actorName]
        : start?.targetIds || [start?.targetId])
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const actualTargetIds = [
      ...(Array.isArray(event?.targetIds) ? event.targetIds : []),
      event?.targetId,
    ].map(value => String(value || '').trim()).filter(Boolean);
    actualTargetIds.forEach(targetId => {
      if (allowedTargetIds.size > 0 && !allowedTargetIds.has(targetId)) {
        effectTargetScopeFailures.push({
          caseId,
          eventId: event?.eventId || '',
          actionId: sourceActionId,
          actionName: start?.actionName || '',
          effectIndex,
          effectPrototype: event?.effectPrototype || effect?.原型 || '',
          effectTarget,
          declaredTargetIds: [...allowedTargetIds],
          actualTargetId: targetId,
        });
      }
    });
  });
}
checks.push(check(
  'runtime.each_effect_target_is_within_its_declaration_scope',
  effectTargetScopeFailures.length === 0,
  { effectTargetScopeFailures },
));

const reportStructuralFailures = [];
const hitClassificationFailures = [];
const summonExchangeOwnershipFailures = [];
const summonTargetInflationFailures = [];
const optionalReactionNarrativeFailures = [];
const adaptationExplanationFailures = [];
const chargeProjectionUnitFailures = [];
for (const caseId of [
  'duel_underdog_survival',
  'duel_charge_defense_safer',
  'duel_peer_unknown_probe',
  'duel_agile_counter_options',
  'raid_balanced',
  'raid_control_heavy',
  'raid_summon_heavy',
  'team_multi_target_response',
]) {
  const result = rootCauseResults.get(caseId);
  const audit = rootCauseReports.get(caseId);
  const facts = audit.reportDto?.factRegistry || [];
  const factById = new Map(facts.map(fact => [fact.factId, fact]));
  facts
    .filter(fact => ['charge_start', 'charge_progress'].includes(String(fact?.eventKind || '').trim()))
    .forEach(fact => {
      const owner = (audit.reportDto?.exchanges || []).find(exchange =>
        String(exchange?.exchangeId || '').trim() === String(fact?.canonicalFactOwner || '').trim()
      );
      const ownerText = String(owner?.text || '');
      const remainingCastTime = Number(
        fact?.remainingCastTime ??
        fact?.meta?.remainingCastTime ??
        fact?.sourceEvent?.remainingCastTime ??
        0,
      );
      const remainingOpportunities = Number(
        fact?.remainingOpportunityCount ??
        fact?.meta?.remainingOpportunityCount ??
        Number.NaN,
      );
      const windowMatch = ownerText.match(/还需(\d+)个行动窗口/);
      const rawFrontSwingMatch = ownerText.match(/剩余前摇(\d+)(?!点)/);
      if (
        windowMatch &&
        (
          !Number.isFinite(remainingOpportunities) ||
          Number(windowMatch[1]) !== remainingOpportunities
        ) ||
        rawFrontSwingMatch &&
        Number(rawFrontSwingMatch[1]) === remainingCastTime
      ) {
        chargeProjectionUnitFailures.push({
          caseId,
          factId: fact?.factId || '',
          exchangeId: owner?.exchangeId || '',
          remainingCastTime,
          remainingOpportunities: Number.isFinite(remainingOpportunities)
            ? remainingOpportunities
            : null,
          text: ownerText,
        });
      }
    });
  (audit.reportDto?.exchanges || []).forEach(exchange => {
    const groups = Array.isArray(exchange?.targetGroups) ? exchange.targetGroups : [];
    if (groups.length <= 1) return;
    groups.forEach(group => {
      if (
        !String(group?.targetId || '').trim() ||
        !Array.isArray(group?.factIds) ||
        !String(group?.text || '').trim()
      ) {
        reportStructuralFailures.push({
          caseId,
          exchangeId: exchange?.exchangeId || '',
          targetId: group?.targetId || '',
          factCount: Array.isArray(group?.factIds) ? group.factIds.length : 0,
        });
      }
    });
  });
  (audit.reportDto?.exchanges || []).forEach(exchange => {
    const exchangeFacts = (exchange?.factIds || []).map(factId => factById.get(factId)).filter(Boolean);
    const declaration = exchangeFacts.find(fact =>
      ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim()) &&
      String(fact?.actorId || '').trim() === String(exchange?.actorId || '').trim()
    ) || exchangeFacts.find(fact =>
      ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim())
    );
    const declaredTargetCount = Array.isArray(declaration?.targetIds)
      ? declaration.targetIds.filter(Boolean).length
      : 0;
    if (
      caseId === 'raid_summon_heavy' &&
      declaredTargetCount === 1 &&
      Array.isArray(exchange?.targetNames) &&
      exchange.targetNames.filter(Boolean).length > declaredTargetCount
    ) {
      summonTargetInflationFailures.push({
        caseId,
        exchangeId: exchange?.exchangeId || '',
        actorId: exchange?.actorId || '',
        declaredTargetIds: declaration?.targetIds || [],
        targetNames: exchange?.targetNames || [],
      });
    }
    const optionalReactionFacts = exchangeFacts.filter(fact =>
      ['lost_opportunity', 'action_cancelled', 'blocked_action'].includes(
        String(fact?.eventKind || '').trim(),
      ) &&
      String(fact?.actionRole || '').trim().toUpperCase() === 'REACTION'
    );
    if (
      optionalReactionFacts.length > 0 &&
      /失去本次行动机会|本次反应窗口按失去机会记录/.test(String(exchange?.text || ''))
    ) {
      optionalReactionNarrativeFailures.push({
        caseId,
        exchangeId: exchange?.exchangeId || '',
        optionalReactionFactIds: optionalReactionFacts.map(fact => fact.factId),
        text: exchange?.text || '',
      });
    }
  });
  facts
    .filter(fact =>
      ['action_start', 'charge_start'].includes(String(fact?.eventKind || '').trim()) &&
      String(fact?.actionRole || '').trim().toUpperCase() === 'ASSIST'
    )
    .forEach(fact => {
      const owner = (audit.reportDto?.exchanges || []).find(exchange =>
        String(exchange?.exchangeId || '').trim() === String(fact?.canonicalFactOwner || '').trim()
      );
      if (
        !owner ||
        String(owner?.actorId || '').trim() !== String(fact?.actorId || '').trim() ||
        String(owner?.action?.name || '').trim() !== String(fact?.actionName || '').trim()
      ) {
        summonExchangeOwnershipFailures.push({
          caseId,
          factId: fact?.factId || '',
          canonicalFactOwner: fact?.canonicalFactOwner || '',
          assistActorId: fact?.actorId || '',
          assistActionName: fact?.actionName || '',
          ownerActorId: owner?.actorId || '',
          ownerActionName: owner?.action?.name || '',
        });
      }
    });
  facts
    .filter(fact => String(fact?.eventKind || '').trim() === 'hit_result')
    .forEach(fact => {
      if (!['MISS', 'DAMAGE', 'SHIELD', 'HIT_NO_DAMAGE', 'RESISTED'].includes(
        String(fact?.resultCategory || '').trim().toUpperCase(),
      )) {
        hitClassificationFailures.push({
          caseId,
          factId: fact?.factId || '',
          resultState: fact?.resultState || '',
        });
      }
    });
  (result?.decisions || []).forEach((entry, decisionIndex) => {
    if (!entry?.selected || typeof entry.selected !== 'object') return;
    const candidates = Array.isArray(entry?.scoreAudit) ? entry.scoreAudit : [];
    const adjudication = (audit.reportDto?.adjudications || []).find(item =>
      Number(String(item?.adjudicationId || '').split(':').at(-1) || 0) === decisionIndex + 1
    );
    const visibleCandidateIds = new Set([
      String(entry?.selected?.candidateId || '').trim(),
      ...(adjudication?.alternatives || []).map(alternative =>
        String(alternative?.candidateId || '').trim()
      ),
    ].filter(Boolean));
    const adaptedCandidates = candidates.filter(candidate =>
      candidate?.repeatedActionAudit?.failureAdaptation?.applied === true &&
      visibleCandidateIds.has(String(candidate?.candidateId || '').trim())
    );
    if (!adaptedCandidates.length || !adjudication) return;
    const reason = String(adjudication?.reasonSummary || '');
    const falseResourceExplanation = adaptedCandidates.some(candidate => {
      const continuity = Number(
        candidate?.repeatedActionAudit?.resourceContinuityAudit?.resourceContinuityDelta || 0,
      );
      return Math.abs(continuity) <= 0.000001 &&
        /后续资源连续性更好/.test(reason);
    });
    if (!/此前公开的命中或抵抗结果/.test(reason) || falseResourceExplanation) {
      adaptationExplanationFailures.push({
        caseId,
        round: entry?.round || 0,
        actorId: entry?.actorId || '',
        adaptedCandidateIds: adaptedCandidates.map(candidate => candidate?.candidateId || ''),
        reason,
        missingPublicEvidence: !/此前公开的命中或抵抗结果/.test(reason),
        falseResourceExplanation,
      });
    }
  });
}
checks.push(check(
  'report.multi_target_groups_have_readable_structured_projection',
  reportStructuralFailures.length === 0,
  { reportStructuralFailures },
));
checks.push(check(
  'report.hit_results_have_explicit_outcome_classification',
  hitClassificationFailures.length === 0,
  { hitClassificationFailures },
));
checks.push(check(
  'report.summon_assist_has_independent_exchange_owner',
  summonExchangeOwnershipFailures.length === 0,
  { summonExchangeOwnershipFailures },
));
checks.push(check(
  'report.summon_host_alias_does_not_inflate_declared_targets',
  summonTargetInflationFailures.length === 0,
  { summonTargetInflationFailures },
));
checks.push(check(
  'report.empty_reaction_window_does_not_dominate_main_exchange',
  optionalReactionNarrativeFailures.length === 0,
  { optionalReactionNarrativeFailures },
));
checks.push(check(
  'report.failure_adaptation_uses_public_evidence_not_resource_pretext',
  adaptationExplanationFailures.length === 0,
  { adaptationExplanationFailures },
));
checks.push(check(
  'report.charge_projection_never_labels_cast_time_points_as_action_windows',
  chargeProjectionUnitFailures.length === 0,
  { chargeProjectionUnitFailures },
));

function decisionActionName(entry = {}) {
  const selected = entry?.selected || {};
  const declaration = selected?.declaration || {};
  return String(
    selected?.selectedActionName ||
    selected?.actionName ||
    declaration?.skill?.name ||
    declaration?.skill?.魂技名 ||
    declaration?.actionName ||
    declaration?.actionKind ||
    '',
  ).trim();
}

function causalId(value = {}, key = '') {
  return String(
    value?.[key] ||
    value?.actionOpportunity?.[key] ||
    value?.selected?.[key] ||
    value?.selected?.declaration?.[key] ||
    value?.meta?.[key] ||
    '',
  ).trim();
}

function normalizedIdSet(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map(value => String(value || '').trim())
    .filter(Boolean))].sort();
}

const reportDecisionAnchorFailures = [];
for (const definition of manualCases) {
  const result = runManualCase(definition.caseId);
  const reportDto = buildPlayerReport(result).reportDto || {};
  const facts = Array.isArray(reportDto.factRegistry) ? reportDto.factRegistry : [];
  const exchanges = Array.isArray(reportDto.exchanges) ? reportDto.exchanges : [];
  const adjudications = Array.isArray(reportDto.adjudications) ? reportDto.adjudications : [];
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  const factById = new Map(facts.map(fact => [String(fact?.factId || '').trim(), fact]));
  const exchangeById = new Map(exchanges.map(exchange => [String(exchange?.exchangeId || '').trim(), exchange]));
  const eventById = new Map(ledger.map(event => [String(event?.eventId || '').trim(), event]));
  (result?.decisions || []).forEach((entry, decisionIndex) => {
    const adjudication = adjudications.find(item =>
      Number(String(item?.adjudicationId || '').split(':').at(-1) || 0) === decisionIndex + 1
    );
    if (!adjudication) {
      const expectedActionName = decisionActionName(entry);
      const expectedRole = String(entry?.actionRole || 'ACTIVE').trim().toUpperCase();
      const expectedRound = Number(entry?.round || 0);
      const expectedActorId = String(entry?.actorId || '').trim();
      const expectedOpportunityId = causalId(entry, 'opportunityId');
      const expectedGrantId = causalId(entry, 'grantId');
      const semanticCandidates = ledger
        .filter(event =>
          Number(event?.round || 0) === expectedRound &&
          String(event?.actorId || event?.actorName || '').trim() === expectedActorId &&
          String(event?.actionRole || 'ACTIVE').trim().toUpperCase() === expectedRole &&
          (
            String(event?.actionName || event?.finalActionName || '').trim() === expectedActionName ||
            entry?.selected?.counterDeclineFallback === true &&
              String(event?.eventKind || '').trim() === 'counter_window'
          )
        )
        .map(event => {
          const opportunityId = causalId(event, 'opportunityId');
          const grantId = causalId(event, 'grantId');
          return {
            eventId: event?.eventId || '',
            eventKind: event?.eventKind || '',
            actionName: event?.actionName || event?.finalActionName || '',
            opportunityId,
            grantId,
            opportunityMatches: Boolean(expectedOpportunityId && opportunityId === expectedOpportunityId),
            grantMatches: Boolean(expectedGrantId && grantId === expectedGrantId),
          };
        });
      reportDecisionAnchorFailures.push({
        category: 'ADJUDICATION_MISSING',
        caseId: definition.caseId,
        decisionIndex,
        round: expectedRound,
        actorId: expectedActorId,
        actionRole: expectedRole,
        actionName: expectedActionName,
        opportunityId: expectedOpportunityId,
        grantId: expectedGrantId,
        semanticCandidates,
      });
      return;
    }
    const sourceEventId = String(adjudication?.sourceEventId || '').trim();
    const anchorEvent = eventById.get(sourceEventId);
    const anchorFact = factById.get(sourceEventId);
    const exchange = exchangeById.get(String(adjudication?.exchangeId || '').trim());
    const context = {
      caseId: definition.caseId,
      decisionIndex,
      adjudicationId: adjudication?.adjudicationId || '',
      exchangeId: adjudication?.exchangeId || '',
      sourceEventId,
      decisionRound: Number(entry?.round || 0),
      decisionActorId: String(entry?.actorId || '').trim(),
      decisionRole: String(entry?.actionRole || 'ACTIVE').trim().toUpperCase(),
      decisionActionName: decisionActionName(entry),
      decisionOpportunityId: causalId(entry, 'opportunityId'),
      decisionGrantId: causalId(entry, 'grantId'),
      decisionTargetIds: normalizedIdSet(entry?.selected?.declaration?.targetIds || []),
      anchorRound: Number(anchorEvent?.round || 0),
      anchorActorId: String(anchorEvent?.actorId || anchorEvent?.actorName || '').trim(),
      anchorRole: String(anchorEvent?.actionRole || 'ACTIVE').trim().toUpperCase(),
      anchorActionName: String(anchorEvent?.actionName || anchorEvent?.finalActionName || '').trim(),
      anchorOpportunityId: causalId(anchorEvent, 'opportunityId'),
      anchorGrantId: causalId(anchorEvent, 'grantId'),
      anchorTargetIds: normalizedIdSet(anchorEvent?.targetIds || anchorEvent?.targetId || []),
      anchorEventKind: String(anchorEvent?.eventKind || '').trim(),
    };
    if (!anchorEvent || !anchorFact) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_FACT_MISSING', ...context });
      return;
    }
    if (!exchange || String(anchorFact?.canonicalFactOwner || '').trim() !== String(exchange?.exchangeId || '').trim()) {
      reportDecisionAnchorFailures.push({
        category: 'ANCHOR_EXCHANGE_OWNER_MISMATCH',
        canonicalFactOwner: anchorFact?.canonicalFactOwner || '',
        ...context,
      });
    }
    if (context.decisionRound !== context.anchorRound) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_ROUND_MISMATCH', ...context });
    }
    if (context.decisionActorId !== context.anchorActorId) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_ACTOR_MISMATCH', ...context });
    }
    if (
      context.decisionRole !== context.anchorRole &&
      !(context.decisionRole === 'COUNTER' && context.anchorEventKind === 'counter_window')
    ) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_ROLE_MISMATCH', ...context });
    }
    if (
      context.decisionOpportunityId &&
      context.anchorOpportunityId &&
      context.decisionOpportunityId !== context.anchorOpportunityId
    ) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_OPPORTUNITY_MISMATCH', ...context });
    }
    if (
      context.decisionGrantId &&
      context.anchorGrantId &&
      context.decisionGrantId !== context.anchorGrantId
    ) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_GRANT_MISMATCH', ...context });
    }
    const nonActionDecision = Boolean(
      entry?.lostOpportunity?.reasonCode ||
      entry?.selected?.counterDeclineFallback === true,
    );
    if (
      !nonActionDecision &&
      ['action_start', 'charge_start'].includes(context.anchorEventKind) &&
      context.decisionActionName &&
      context.anchorActionName &&
      context.decisionActionName !== context.anchorActionName
    ) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_ACTION_MISMATCH', ...context });
    }
    if (
      !nonActionDecision &&
      ['action_start', 'charge_start'].includes(context.anchorEventKind) &&
      context.decisionTargetIds.length > 0 &&
      JSON.stringify(context.decisionTargetIds) !== JSON.stringify(context.anchorTargetIds)
    ) {
      reportDecisionAnchorFailures.push({ category: 'ANCHOR_TARGET_MISMATCH', ...context });
    }
  });
}
checks.push(check(
  'report.all_manual_decisions_have_unique_causal_anchors',
  reportDecisionAnchorFailures.length === 0,
  {
    failureCount: reportDecisionAnchorFailures.length,
    categoryCounts: Object.fromEntries(
      [...new Set(reportDecisionAnchorFailures.map(item => item.category))]
        .map(category => [
          category,
          reportDecisionAnchorFailures.filter(item => item.category === category).length,
        ]),
    ),
    failures: reportDecisionAnchorFailures,
  },
));

const semanticFailureGroups = [
  ['R1_OBJECTIVE_PROGRESS', objectiveProgressOwnershipFailures],
  ['R2_RESOURCE_CONTINUITY', resourceContinuityFlowFailures],
  ['R3_INFORMATION_REGRET', informationRegretAggregationFailures],
  ['R4_FAILURE_ADAPTATION', adaptationRealismFailures],
  ['R5_CRISIS_MATERIALITY', crisisMaterialityFailures],
  ['R6_SCORE_STAGE', frozenScoreStageFailures],
  ['R7_R8_EFFECT_TARGET_DOMAIN', previewRuntimeTargetFailures],
  ['R9_INDEPENDENT_ROOT_MERGE', independentRootMergeFailures],
  ['R10_RISK_PERSPECTIVE', finalRiskPerspectiveFailures],
  ['R11_PLAYER_LOCKED_PROJECTION', playerLockedProjectionFailures],
  ['R14_CHARGE_PLAYER_UNIT', chargePlayerUnitFailures],
];
const missingSemanticFatalCoverage = [];
semanticFailureGroups.forEach(([oracleId, failures]) => {
  const caseIds = [...new Set(
    (Array.isArray(failures) ? failures : [])
      .map(failure => String(failure?.caseId || '').trim())
      .filter(Boolean),
  )];
  caseIds.forEach(caseId => {
    const result = caseId === 'weixiaofeng_20_round'
      ? formalResult
      : rootCauseResults.get(caseId);
    const fatalCount = Array.isArray(result?.audit?.fatals)
      ? result.audit.fatals.length
      : Number(result?.audit?.fatalCount || 0);
    if (fatalCount === 0) {
      missingSemanticFatalCoverage.push({
        oracleId,
        caseId,
        reason: 'SEMANTIC_ORACLE_FAILURE_NOT_SURFACED_AS_CASE_FATAL',
      });
    }
  });
});
checks.push(check(
  'gate.semantic_oracle_failures_cannot_remain_fatal_count_zero',
  missingSemanticFatalCoverage.length === 0,
  { missingSemanticFatalCoverage },
));

const failed = checks.filter(item => !item.passed);
console.log(JSON.stringify({
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    status: failed.length ? 'BLOCKED' : 'PASSED',
  },
  checks,
}, null, 2));
process.exitCode = failed.length ? 1 : 0;

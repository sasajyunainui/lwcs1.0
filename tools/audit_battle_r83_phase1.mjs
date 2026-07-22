import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
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
for (const fileName of [
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
]) {
  vm.runInContext(
    fs.readFileSync(path.join(repoRoot, fileName), 'utf8'),
    sandbox,
    { filename: fileName },
  );
}

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const implementationPhase = Math.max(1, Number(process.env.LWCS_BATTLE_PHASE || 7));
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

function skill(id, effects, cost = 0) {
  return {
    id,
    name: id,
    魂技名: id,
    消耗: { 魂力: cost },
    _效果数组: effects,
  };
}

function damageSkill(id, power = 100, hit = 100, cost = 0) {
  return skill(id, [{
    effectId: `${id}:damage`,
    原型: '伤害结算',
    目标: '单体',
    威力倍率: power,
    伤害类型: '近身攻击',
    命中概率: hit,
  }], cost);
}

function healSkill(id, ratio = 25, cost = 10) {
  return skill(id, [{
    effectId: `${id}:heal`,
    原型: '资源变化',
    目标: '单体',
    资源: '生命',
    数值: `+${ratio}%`,
  }], cost);
}

function unit(id, side, overrides = {}) {
  const hp = Number(overrides.hp ?? 500);
  const hpMax = Number(overrides.hpMax ?? 500);
  const sp = Number(overrides.sp ?? 100);
  const spMax = Number(overrides.spMax ?? 100);
  const men = Number(overrides.men ?? 100);
  const menMax = Number(overrides.menMax ?? 100);
  const vit = Number(overrides.vit ?? 100);
  const vitMax = Number(overrides.vitMax ?? 100);
  return {
    id,
    name: id,
    名称: id,
    side,
    系别: overrides.系别 || '强攻系',
    hp,
    hp_max: hpMax,
    sp,
    sp_max: spMax,
    men,
    men_max: menMax,
    vit,
    vit_max: vitMax,
    str: Number(overrides.str ?? 150),
    def: Number(overrides.def ?? 100),
    agi: Number(overrides.agi ?? 100),
    属性: {
      等级: Number(overrides.level ?? 50),
      HP: hp,
      HP上限: hpMax,
      魂力: sp,
      魂力上限: spMax,
      精神力: men,
      精神力上限: menMax,
      体力: vit,
      体力上限: vitMax,
      力量: Number(overrides.str ?? 150),
      防御: Number(overrides.def ?? 100),
      敏捷: Number(overrides.agi ?? 100),
      状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: overrides.skills || [],
  };
}

function objective() {
  return {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }],
    },
  };
}

const scenarios = [
  {
    caseId: 'phase1_duel',
    actorId: 'actor',
    world: {
      回合: 1,
      胜负条件: objective(),
      参战者: {
        team_player: [unit('actor', 'player', {
          skills: [damageSkill('accurate-strike', 120, 90, 15)],
        })],
        team_enemy: [unit('enemy', 'enemy', {
          skills: [damageSkill('enemy-strike', 100, 90, 0)],
        })],
      },
    },
    opportunity: { role: 'ACTIVE', sequence: 1 },
  },
  {
    caseId: 'phase1_support',
    actorId: 'support',
    world: {
      回合: 1,
      胜负条件: objective(),
      参战者: {
        team_player: [
          unit('support', 'player', {
            skills: [healSkill('field-heal', 35, 10), damageSkill('support-strike', 70, 100, 0)],
          }),
          unit('ally', 'player', { hp: 180, skills: [damageSkill('ally-strike', 100)] }),
        ],
        team_enemy: [unit('enemy', 'enemy', { skills: [damageSkill('enemy-strike', 110)] })],
      },
    },
    opportunity: { role: 'ACTIVE', sequence: 2 },
  },
  {
    caseId: 'phase1_counter',
    actorId: 'counter',
    world: {
      回合: 2,
      胜负条件: objective(),
      参战者: {
        team_player: [unit('counter', 'player', {
          skills: [damageSkill('quick-counter', 85, 100, 0)],
        })],
        team_enemy: [unit('source', 'enemy', { skills: [damageSkill('source-strike', 100)] })],
      },
    },
    opportunity: {
      role: 'COUNTER',
      sequence: 3,
      sourceActorId: 'source',
      counterWindow: true,
      counterActionAvailable: true,
      immediateBudget: 40,
    },
  },
  {
    caseId: 'phase1_resource',
    actorId: 'resource-user',
    world: {
      回合: 2,
      胜负条件: objective(),
      参战者: {
        team_player: [unit('resource-user', 'player', {
          sp: 40,
          spMax: 100,
          skills: [
            damageSkill('cheap-route', 80, 100, 10),
            damageSkill('expensive-route', 160, 100, 40),
          ],
        })],
        team_enemy: [unit('enemy', 'enemy', { skills: [damageSkill('enemy-strike', 100)] })],
      },
    },
    opportunity: { role: 'ACTIVE', sequence: 4 },
  },
];

assert.deepEqual(
  [...decision.providerIds],
  ['legacy-baseline', 'r74-next-baseline', 'r8-shadow', 'r8'],
);
addCheck('provider-registry:ids', true, { providerIds: [...decision.providerIds] });

const deepFrozen = value => {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
};

const stripDiagnosticFields = value => {
  if (Array.isArray(value)) return value.map(stripDiagnosticFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => ![
        'timing',
        'routeCacheMetrics',
        'candidateEnvelopeMetrics',
        'evaluationSessionObservation',
      ].includes(key))
      .map(([key, child]) => [key, stripDiagnosticFields(child)]),
  );
};

const equivalence = [];
for (const scenario of scenarios) {
  for (const providerId of ['legacy-baseline', 'r74-next-baseline']) {
    const inputHashBefore = preview.stableHash(scenario.world);
    const request = decision.prepareDecisionRequest({
      worldSnapshot: scenario.world,
      actorId: scenario.actorId,
      objectiveContract: scenario.world.胜负条件,
      actionOpportunity: scenario.opportunity,
      seed: `${scenario.caseId}:${providerId}`,
    });
    assert.equal(preview.stableHash(scenario.world), inputHashBefore);
    assert.equal(deepFrozen(request), true);
    const enumeratedIds = decision.enumerateCandidates({
      worldSnapshot: request.visibleWorld,
      actorId: request.actorId,
      battleIntent: request.battleIntent,
      beliefState: request.beliefState,
      actionOpportunity: request.actionOpportunity,
    }).map(candidate => candidate.candidateId);
    assert.deepEqual(
      enumeratedIds,
      request.frozenCandidates.map(candidate => candidate.candidateId),
    );
    const directInput = {
      worldSnapshot: request.visibleWorld,
      visibleWorldSnapshot: request.visibleWorld,
      actorId: request.actorId,
      battleIntent: request.battleIntent,
      beliefState: request.beliefState,
      actionOpportunity: request.actionOpportunity,
      strategyMemory: request.strategyMemory,
      seed: request.seed,
      __preparedDecisionWorld: true,
      __preparedBeliefState: request.beliefState,
      __frozenCandidates: request.frozenCandidates,
    };
    const direct = providerId === 'legacy-baseline'
      ? decision.decide(directInput)
      : decision.decideNext(directInput);
    const provider = decision.runProvider({ providerId, request });
    assert.equal(provider.selectedCandidateId, direct.selected.candidateId);
    assert.equal(
      preview.stableHash(provider.selectedDeclaration),
      preview.stableHash(direct.selected.declaration),
    );
    assert.equal(
      preview.stableHash(provider.decisionAudit.scoreAudit),
      preview.stableHash(direct.scoreAudit),
    );
    assert.equal(preview.stableHash(scenario.world), inputHashBefore);
    equivalence.push({
      caseId: scenario.caseId,
      providerId,
      candidateCount: request.frozenCandidates.length,
      selectedCandidateId: provider.selectedCandidateId,
      requestHash: request.requestHash,
    });
  }
}
addCheck('provider-baseline-equivalence:8', equivalence.length === 8, { equivalence });

let unknownProviderCode = '';
try {
  const request = decision.prepareDecisionRequest({
    worldSnapshot: scenarios[0].world,
    actorId: scenarios[0].actorId,
    actionOpportunity: scenarios[0].opportunity,
  });
  decision.runProvider({ providerId: 'missing-provider', request });
} catch (error) {
  unknownProviderCode = String(error?.message || error);
}
addCheck(
  'provider-unknown:no-fallback',
  unknownProviderCode === 'battle_decision_provider_unknown:missing-provider',
  { unknownProviderCode },
);

const phase1Request = decision.prepareDecisionRequest({
  worldSnapshot: scenarios[0].world,
  actorId: scenarios[0].actorId,
  actionOpportunity: scenarios[0].opportunity,
});
let r8PhaseCode = '';
let r8PhaseResult = null;
try {
  r8PhaseResult = decision.runProvider({ providerId: 'r8', request: phase1Request });
} catch (error) {
  r8PhaseCode = String(error?.message || error);
}
addCheck(
  'provider-r8:no-legacy-fallback',
  r8PhaseCode === '' &&
    r8PhaseResult?.decisionAudit?.decisionEngine === 'R8' &&
    phase1Request.frozenCandidates.some(candidate =>
      candidate.candidateId === r8PhaseResult?.selectedCandidateId
    ),
  {
    implementationPhase,
    r8PhaseCode,
    selectedCandidateId: r8PhaseResult?.selectedCandidateId || '',
    decisionEngine: r8PhaseResult?.decisionAudit?.decisionEngine || '',
  },
);

const sessionWorldHashBefore = preview.stableHash(scenarios[0].world);
const session = decision.createEvaluationSession({
  objectiveHash: preview.stableHash(scenarios[0].world.胜负条件),
  visibleWorldRevision: `visible:${sessionWorldHashBefore}`,
  beliefRevision: 'belief:phase1',
  opportunityRevision: 'opportunity:phase1',
  resourceTimelineRevision: 'resource:phase1',
  scheduleRevision: 'schedule:phase1',
});
const factDelta = decision.advanceEvaluationSession(session, {
  sequence: 1,
  sourceEventIds: ['phase1:event:1'],
  changedFactKeys: ['unit:actor:hp'],
  opportunityChanges: [],
  resourceTimelineChanges: [],
  scheduleChanges: [],
  visibleBeliefChanges: [],
  terminalReached: false,
});
const previewMetricsBeforeSessionRequest = preview.readMetrics();
const requestWithSession = decision.prepareDecisionRequest({
  session,
  worldSnapshot: scenarios[0].world,
  actorId: scenarios[0].actorId,
  objectiveContract: scenarios[0].world.胜负条件,
  actionOpportunity: scenarios[0].opportunity,
  seed: 'phase1-session-request',
});
const previewMetricsAfterSessionRequest = preview.readMetrics();
const requestWithoutSession = decision.prepareDecisionRequest({
  worldSnapshot: scenarios[0].world,
  actorId: scenarios[0].actorId,
  objectiveContract: scenarios[0].world.胜负条件,
  actionOpportunity: scenarios[0].opportunity,
  seed: 'phase1-session-request',
});
const sessionMetrics = decision.readEvaluationSessionMetrics(session);
const sessionRequestRecord = sessionMetrics.requestRecords.at(-1);
addCheck(
  'evaluation-session:opaque-nonsemantic-request',
  Object.isFrozen(session) &&
    Object.keys(session).sort().join(',') === 'schemaVersion,sessionId' &&
    !Object.hasOwn(requestWithSession, 'session') &&
    requestWithSession.requestHash === requestWithoutSession.requestHash &&
    preview.stableHash(requestWithSession.frozenCandidates) ===
      preview.stableHash(requestWithoutSession.frozenCandidates) &&
    preview.stableHash(scenarios[0].world) === sessionWorldHashBefore,
  {
    sessionId: session.sessionId,
    requestHash: requestWithSession.requestHash,
    candidateCount: requestWithSession.frozenCandidates.length,
  },
);
addCheck(
  'evaluation-session:fact-delta-and-actual-work',
  factDelta.schemaVersion === 'FactDeltaBatchV1' &&
    factDelta.changedFactKeys.includes('unit:actor:hp') &&
    sessionMetrics.metrics.factDeltaCount === 1 &&
    sessionMetrics.metrics.requestCount === 1 &&
    sessionRequestRecord?.actualWork?.previewCalls ===
      (
        Number(previewMetricsAfterSessionRequest.previewCalls || 0) -
        Number(previewMetricsBeforeSessionRequest.previewCalls || 0)
      ) &&
    sessionMetrics.storeSizes.operationGraphStore === 0 &&
    sessionMetrics.storeSizes.fullRoutesByUnit === 0,
  {
    metrics: sessionMetrics.metrics,
    actualWork: sessionRequestRecord?.actualWork || {},
    storeSizes: sessionMetrics.storeSizes,
  },
);
const disposedSession = decision.disposeEvaluationSession(session);
let disposedReadCode = '';
try {
  decision.readEvaluationSessionMetrics(session);
} catch (error) {
  disposedReadCode = String(error?.message || error);
}
addCheck(
  'evaluation-session:dispose',
  disposedSession.status === 'DISPOSED' &&
    disposedReadCode === 'DECISION_EVALUATION_SESSION_INVALID',
  { disposedReadCode },
);

const structuredInput = {
  caseId: 'phase1-structured-equivalence',
  seed: 831002,
  rounds: 1,
  combatData: scenarios[0].world,
  objectiveContract: scenarios[0].world.胜负条件,
  settings: {
    providerId: 'r8',
  },
};
const structuredWithSession = runtime.runDecisionCase(structuredInput);
const structuredWithoutSession = runtime.runDecisionCase({
  ...structuredInput,
  settings: {
    ...structuredInput.settings,
    disableEvaluationSession: true,
  },
});
const structuredHashes = result => ({
  decision: runtime.hashBattleValue(
    stripDiagnosticFields(result.decisions || []),
  ),
  ledger: runtime.hashBattleValue(result.ledger || []),
  terminal: runtime.hashBattleValue(result.terminal || null),
  finalSnapshot: runtime.hashBattleValue(result.finalSnapshot || null),
});
const withSessionHashes = structuredHashes(structuredWithSession);
const withoutSessionHashes = structuredHashes(structuredWithoutSession);
addCheck(
  'evaluation-session:runtime-semantic-equivalence',
  preview.stableHash(withSessionHashes) ===
    preview.stableHash(withoutSessionHashes) &&
    structuredWithSession.evaluationSessionMetrics?.metrics?.requestCount > 0 &&
    structuredWithoutSession.evaluationSessionMetrics === null &&
    structuredWithSession.decisionPerformanceDiagnostics.every(entry =>
      entry?.evaluationSessionObservation?.request?.requestHash
    ),
  {
    withSessionHashes,
    withoutSessionHashes,
    requestCount:
      structuredWithSession.evaluationSessionMetrics?.metrics?.requestCount || 0,
    factDeltaCount:
      structuredWithSession.evaluationSessionMetrics?.metrics?.factDeltaCount || 0,
  },
);

const draftInput = {
  caseId: 'phase1-draft',
  seed: 831001,
  combatData: scenarios[0].world,
  objectiveContract: scenarios[0].world.胜负条件,
  actionOpportunity: scenarios[0].opportunity,
  settings: {
    decisionOnly: true,
    providerId: 'r74-next-baseline',
  },
};
const draftInputHash = runtime.hashBattleValue(draftInput);
const draft = runtime.executeBattleDraftR8(draftInput);
const draftWithoutHash = structuredClone(draft);
delete draftWithoutHash.draftHash;
addCheck(
  'draft-r8:schema-and-hash',
  draft.schemaVersion === '8.3-draft-1' &&
    draft.status === 'DRAFT' &&
    draft.providerId === 'r74-next-baseline' &&
    draft.inputHash === draftInputHash &&
    runtime.hashBattleValue(draftWithoutHash) === draft.draftHash &&
    Array.isArray(draft.decisionAudit) &&
    draft.decisionAudit.length === 2,
  {
    schemaVersion: draft.schemaVersion,
    providerId: draft.providerId,
    decisionCount: draft.decisionAudit?.length || 0,
  },
);
addCheck(
  'draft-r8:input-immutable',
  runtime.hashBattleValue(draftInput) === draftInputHash,
);
addCheck(
  'draft-r8:no-session-persistence',
  !JSON.stringify(draft).includes('evaluationSession') &&
    !JSON.stringify(draft).includes('queue-evaluation:'),
);

const decisionSource = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
addCheck(
  'source:provider-cannot-reenumerate',
  /if \(providerExecutionDepth > 0\) throw new Error\('PROVIDER_REENUMERATED_CANDIDATES'\)/.test(decisionSource) &&
    /Array\.isArray\(input\?\.__frozenCandidates\)[\s\S]*?: enumerateCandidates\(scoringContext\)/.test(decisionSource) &&
    /Array\.isArray\(input\?\.__frozenCandidates\)[\s\S]*?: enumerateCandidates\(\{/.test(decisionSource),
);
addCheck(
  'source:provider-registry-is-internal',
  /const providerRegistry = Object\.freeze\(\{/.test(decisionSource) &&
    !/providerFunction|input\?\.provider\s*\(/.test(decisionSource),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    equivalenceCaseCount: equivalence.length,
    coordinatorStatus: failed.length === 0 ? 'COORDINATOR_BOUNDARY_PASSED' : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

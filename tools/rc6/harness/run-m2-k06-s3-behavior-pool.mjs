import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const harnessPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k06-s3-behavior-pool.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const readDecisionWithProbe = () => {
  const sourcePath = path.join(repoRoot, 'BattleDecision_Module.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const marker = /\n\}\)\(\);\s*$/u;
  const probed = source.replace(marker, `
  root.__LWCS_RC6_K06_TEST__ = Object.freeze({
    objectiveContext: r9v2TargetObjectiveEvaluationContext,
    objectiveValue: r9v2TargetObjectiveValue,
    routeOwnerUnitIds: r9v2TargetS3RouteOwnerUnitIds,
  });
})();
`);
  assert(probed !== source, 'K06_TEST_PROBE_INJECTION_MISSED');
  return { source, probed };
};

const { source, probed } = readDecisionWithProbe();
const sandbox = loadBattleSandbox({
  includeTargetKernel: true,
  sourceOverrides: { 'BattleDecision_Module.js': probed },
});
const probe = sandbox.__LWCS_RC6_K06_TEST__;
assert(probe, 'K06_TEST_PROBE_MISSING');

const definition = manualCasesById(sandbox).get('duel_overmatch_lethal');
assert(definition, 'K06_REFERENCE_CASE_MISSING');
const world = clone(definition.combatData);
const playerId = String(world?.参战者?.team_player?.[0]?.id || '').trim();
const enemyId = String(world?.参战者?.team_enemy?.[0]?.id || '').trim();
assert(playerId && enemyId, 'K06_REFERENCE_UNITS_MISSING');
const player = world.参战者.team_player[0];
player.hp = Math.max(1, Math.floor(Number(player.hp_max || player.属性?.HP上限 || 100) * 0.5));
player.HP = player.hp;
if (player.属性 && typeof player.属性 === 'object') player.属性.HP = player.hp;

const evaluate = (actorSide, targetId, healthDeltaPP) => {
  const actorId = actorSide === 'ENEMY' ? enemyId : playerId;
  const request = {
    visibleWorld: world,
    actorId,
    actorSide,
    objectiveContract: clone(world.胜负条件),
  };
  const context = probe.objectiveContext(request);
  const value = probe.objectiveValue(
    request,
    [{ targetId, healthDeltaPP }],
    context,
  );
  return {
    actorSide,
    targetId,
    healthDeltaPP,
    valueHEPP: value,
    victoryConditionCount: context.groups?.victory?.conditions?.length || 0,
    defeatConditionCount: context.groups?.defeat?.conditions?.length || 0,
  };
};

const rows = [
  evaluate('PLAYER', enemyId, -20),
  evaluate('ENEMY', playerId, -20),
  evaluate('ENEMY', enemyId, -20),
  evaluate('ENEMY', playerId, 20),
];

assert(Math.abs(rows[0].valueHEPP - 20) <= 1e-9, 'K06_PLAYER_ATTACK_ORIENTATION');
assert(Math.abs(rows[1].valueHEPP - 20) <= 1e-9, 'K06_ENEMY_ATTACK_PLAYER_ORIENTATION');
assert(Math.abs(rows[2].valueHEPP + 20) <= 1e-9, 'K06_ENEMY_SELF_HARM_ORIENTATION');
assert(Math.abs(rows[3].valueHEPP + 20) <= 1e-9, 'K06_ENEMY_HEAL_PLAYER_ORIENTATION');

const closurePool = {
  targetSourceUnitIds: new Map([
    ['target-1', new Set(['ally-critical', 'enemy-controller'])],
  ]),
  dependencyOwners: new Map([
    ['target-1', new Set(['coarse-owner'])],
  ]),
  dependencyCandidateOwners: new Map([
    ['target:target-1:defense', new Set(['indexed-owner\u0000candidate'])],
    ['unit:target-1:state:__action', new Set(['state-owner\u0000candidate'])],
  ]),
};
const closure = [...probe.routeOwnerUnitIds(closurePool, 'target-1')].sort();
assert(
  JSON.stringify(closure) === JSON.stringify([
    'ally-critical',
    'coarse-owner',
    'enemy-controller',
    'indexed-owner',
    'state-owner',
    'target-1',
  ]),
  `K06_AFFECTED_UNIT_CLOSURE:${JSON.stringify(closure)}`,
);

const activeDefinition = manualCasesById(sandbox).get('duel_agile_counter_options');
assert(activeDefinition, 'K06_ACTIVE_CASE_MISSING');
const activeWorld = clone(activeDefinition.combatData);
const activeActor = activeWorld?.参战者?.team_player?.[0] || null;
const activeTarget = activeWorld?.参战者?.team_enemy?.[0] || null;
const activeActorId = String(activeActor?.id || '').trim();
const activeTargetId = String(activeTarget?.id || '').trim();
assert(activeActorId && activeTargetId, 'K06_ACTIVE_UNITS_MISSING');
const controlSkillId = 'k06-hit-lock';
activeActor.技能列表 = [{
  id: controlSkillId,
  name: controlSkillId,
  魂技名: controlSkillId,
  消耗: '无',
  _效果数组: [{
    effectId: `${controlSkillId}:effect`,
    原型: '判定修正',
    判定: '命中',
    数值: '-100%',
    成功率: '100%',
    持续回合: 1,
    目标: '单体',
  }],
}];
const activeSink = { slices: [] };
sandbox.__LWCS_R9V2_TARGET_KERNEL_TEST_SINK__ = activeSink;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const buildActiveRequest = ({ hasFutureOpportunity }) =>
  decision.prepareDecisionRequest({
    worldSnapshot: activeWorld,
    actorId: activeActorId,
    objectiveContract: activeWorld.胜负条件,
    battleIntent: {
      mode: activeDefinition.intent,
      objectives: clone(activeWorld.胜负条件),
    },
    actionOpportunity: {
      opportunityId: hasFutureOpportunity
        ? 'k06:s3:active'
        : 'k06:s3:no-future',
      ownerId: activeActorId,
      role: 'ACTIVE',
      pendingNaturalActorIds: hasFutureOpportunity ? [activeTargetId] : [],
      futureHostileResponseAllowed: hasFutureOpportunity,
      noFutureOpportunity: !hasFutureOpportunity,
    },
    runtimeSnapshot: {
      opportunitySnapshot: hasFutureOpportunity
        ? [{
            opportunityId: 'k06:s3:future:target',
            ownerId: activeTargetId,
            role: 'ACTIVE',
            status: 'PENDING',
          }]
        : [],
      scheduledEvents: [],
      resourceTimeline: [],
    },
    providerId: 'r9v2',
    analysisDepth: 'CANDIDATES_ONLY',
    r9v2InformationValueOnly: true,
    collectDecisionReplayIdentity: true,
    seed: activeDefinition.seed,
  });
const activeRequest = buildActiveRequest({ hasFutureOpportunity: true });
const activeResult = decision.runR9v2TargetProviderForTest(activeRequest);
const activeSlice = activeSink.slices.at(-1);
assert(activeSlice?.session, 'K06_ACTIVE_SLICE_MISSING');
const behaviorFacts = [];
const collectBehaviorFacts = slice => {
  const facts = [];
  slice.session.componentStore.forEach((componentStore, candidateId) => {
    if (!(componentStore instanceof Map)) return;
    componentStore.forEach(component => {
      (component?.facts || []).forEach(fact => {
        if (
          fact?.componentCode === 'soft_control' &&
          String(fact?.prototype || '').trim() === '判定修正'
        ) {
          facts.push({
            candidateId,
            valueHEPP: Number(fact.valueHEPP || 0),
            targetUnitId: String(fact.targetUnitId || '').trim(),
            routeOwnerUnitIds: [...(fact.routeOwnerUnitIds || [])],
            beforeBestRouteHEPP: Number(fact.beforeBestRouteHEPP || 0),
            afterBestRouteHEPP: Number(fact.afterBestRouteHEPP || 0),
          });
        }
      });
    });
  });
  return facts;
};
behaviorFacts.push(...collectBehaviorFacts(activeSlice));
const controlFact = behaviorFacts.find(fact =>
  fact.candidateId.includes(controlSkillId)
);
assert(controlFact, 'K06_ACTIVE_S3_FACT_MISSING');
assert(controlFact.valueHEPP > 1e-9, 'K06_ACTIVE_S3_VALUE_NON_POSITIVE');
assert(
  controlFact.targetUnitId === activeTargetId &&
    controlFact.routeOwnerUnitIds.includes(activeTargetId) &&
    controlFact.routeOwnerUnitIds.includes(activeActorId),
  `K06_ACTIVE_S3_ROUTE_OWNERS:${JSON.stringify(controlFact)}`,
);

const noFutureResult = decision.runR9v2TargetProviderForTest(
  buildActiveRequest({ hasFutureOpportunity: false }),
);
const noFutureSlice = activeSink.slices.at(-1);
assert(noFutureSlice?.session, 'K06_NO_FUTURE_SLICE_MISSING');
const noFutureBehaviorFacts = collectBehaviorFacts(noFutureSlice).filter(fact =>
  fact.candidateId.includes(controlSkillId)
);
assert(
  noFutureBehaviorFacts.length === 0,
  `K06_NO_FUTURE_S3_VALUE:${JSON.stringify(noFutureBehaviorFacts)}`,
);

const output = {
  schemaVersion: 'M2K06S3BehaviorPoolGateV1',
  status: 'PASSED',
  scope: 'TARGET_OBJECTIVE_ORIENTATION_AND_S3_POLARITY',
  caseId: definition.caseId,
  playerId,
  enemyId,
  rows,
  protectedRouteRules: {
    s3PerspectiveSignPreserved: true,
    routeEntryGenerationUntouched: true,
    affordabilityFilteringUntouched: true,
  },
  affectedUnitClosure: closure,
  activeCase: {
    caseId: activeDefinition.caseId,
    selectedCandidateId: String(activeResult?.selected?.candidateId || '').trim(),
    controlCandidateId: controlFact.candidateId,
    behaviorFact: controlFact,
    noFutureSelectedCandidateId: String(
      noFutureResult?.selected?.candidateId || '',
    ).trim(),
    noFutureBehaviorFactCount: noFutureBehaviorFacts.length,
  },
  sourceHashes: {
    decision: sha256(source),
    kernel: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
    harness: sha256(fs.readFileSync(harnessPath)),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

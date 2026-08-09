import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
  manualCasesById,
  repoRoot,
} from '../../r83_rc6_battle_harness.mjs';

const fixturePath = path.join(
  repoRoot,
  'tools',
  'rc6',
  'cases',
  'S4RouteValueReuseCasesV1.json',
);
const evidencePath = path.join(
  repoRoot,
  'tools',
  'rc6',
  'evidence',
  'm2',
  'k14-s4-route-value-reuse-ab.json',
);
const decisionPath = path.join(repoRoot, 'BattleDecision_Module.js');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const readUtf8 = filePath => fs.readFileSync(filePath, 'utf8');
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const strings = value => (Array.isArray(value) ? value : [])
  .map(item => String(item || '').trim())
  .filter(Boolean);

const valueView = value => {
  if (Array.isArray(value)) return value.map(valueView);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([key, item]) => [key, valueView(item)]),
    );
  }
  return value ?? null;
};

const compareStrings = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const causalFactsView = facts => (Array.isArray(facts) ? facts : [])
  .map(fact => ({
    componentCode: String(fact?.componentCode || '').trim(),
    causalOwnerType: String(fact?.causalOwnerType || '').trim(),
    valueHEPP: finite(fact?.valueHEPP),
    sourceEventId: String(fact?.sourceEventId || '').trim(),
    sourceFactId: String(fact?.sourceFactId || '').trim(),
    targetUnitId: String(fact?.targetUnitId || '').trim(),
    sequence: Number(fact?.sequence || 0),
  }))
  .sort((left, right) =>
    compareStrings(left.sourceFactId, right.sourceFactId) ||
    compareStrings(left.sourceEventId, right.sourceEventId) ||
    left.sequence - right.sequence,
  );

const vectorView = vector => vector
  ? {
      candidateId: String(vector?.candidateId || '').trim(),
      stateDeltaTotal: finite(vector?.stateDeltaTotal),
      actionPoolDeltaTotal: finite(vector?.actionPoolDeltaTotal),
      terminalDeltaTotal: finite(vector?.terminalDeltaTotal),
      goalUtilityDeltaHEPP: finite(vector?.goalUtilityDeltaHEPP),
      informationValueHEPP: finite(vector?.informationValueHEPP),
      objectiveUtilityHEPP: finite(vector?.objectiveUtilityHEPP),
      componentTotals: Object.fromEntries(
        Object.entries(vector?.componentTotals || {})
          .sort(([left], [right]) => compareStrings(left, right))
          .map(([key, value]) => [key, finite(value)]),
      ),
      paretoDimensions: Object.fromEntries(
        Object.entries(vector?.paretoDimensions || {})
          .sort(([left], [right]) => compareStrings(left, right))
          .map(([key, value]) => [key, finite(value)]),
      ),
      hardExclusionCodes: strings(vector?.hardExclusionCodes),
      legal: vector?.legal === true,
      causalFacts: causalFactsView(vector?.causalFacts),
      paretoWitness: vector?.paretoWitness || null,
    }
  : null;

const semanticView = result => ({
  selectedCandidateId: String(result?.selected?.candidateId || '').trim(),
  selected: {
    candidateId: String(result?.selected?.candidateId || '').trim(),
    objectiveUtilityHEPP: finite(result?.selected?.objectiveUtilityHEPP),
    goalUtilityDeltaHEPP: finite(result?.selected?.goalUtilityDeltaHEPP),
    informationValueHEPP: finite(result?.selected?.informationValueHEPP),
    vector: vectorView(result?.selected?.vector),
    causalValueFacts: causalFactsView(result?.selected?.causalValueFacts),
    proof: result?.selected?.candidateValueProof
      ? {
          goalUtilityDeltaHEPP: finite(
            result.selected.candidateValueProof.goalUtilityDeltaHEPP,
          ),
          informationValueHEPP: finite(
            result.selected.candidateValueProof.informationValueHEPP,
          ),
          objectiveUtilityHEPP: finite(
            result.selected.candidateValueProof.objectiveUtilityHEPP,
          ),
          reconciliationError: finite(
            result.selected.candidateValueProof.reconciliationError,
          ),
          vector: vectorView(result.selected.candidateValueProof.vector),
          causalValueFacts: causalFactsView(
            result.selected.candidateValueProof.causalValueFacts,
          ),
        }
      : null,
  },
  alternatives: (Array.isArray(result?.alternatives)
    ? result.alternatives
    : [])
    .map(item => String(item?.candidateId || '').trim())
    .filter(Boolean),
  candidateAudit: (Array.isArray(result?.candidateAudit)
    ? result.candidateAudit
    : [])
    .map(row => ({
      candidateId: String(row?.candidateId || '').trim(),
      targetIds: strings(row?.targetIds),
      objectiveUtilityHEPP: finite(row?.objectiveUtilityHEPP),
      vector: vectorView(row?.vector),
      rejectionCode: String(row?.rejectionCode || '').trim(),
      classification: String(row?.classification || '').trim(),
      pareto: row?.pareto === true,
      paretoWitness: row?.paretoWitness || null,
      selected: row?.selected === true,
    })),
  candidateCount: Number(result?.candidateCount || 0),
  frozenCandidateIds: strings(result?.frozenCandidateIds),
  preparedEntryCandidateIds: strings(result?.preparedEntryCandidateIds),
  preparedProofCandidateIds: strings(result?.preparedProofCandidateIds),
  requiredProofCandidateIds: strings(result?.requiredProofCandidateIds),
  materializedProofCandidateIds: strings(result?.materializedProofCandidateIds),
  vectorCoverage: valueView(result?.vectorCoverage),
  proofCoverage: valueView(result?.proofCoverage),
  candidateCoverage: valueView(result?.candidateCoverage),
});

const metricView = metrics => ({
  informationBranchProjectionCalls: Number(
    metrics?.r9v2TargetInformationBranchProjectionCalls || 0,
  ),
  futureRouteTables: Number(metrics?.r9v2TargetFutureRouteTableBuilds || 0),
  reusedRouteValueTables: Number(
    metrics?.r9v2InformationBranchReusedRouteValueTables || 0,
  ),
  reusedRouteValueRows: Number(
    metrics?.r9v2InformationBranchReusedRouteValueRows || 0,
  ),
  rebuiltRouteRows: Number(
    metrics?.r9v2InformationBranchRebuiltRouteRows || 0,
  ),
  branchValueVectors: Number(
    metrics?.r9v2InformationBranchValueVectorBuilds || 0,
  ),
  branchValueVectorRows: Number(
    metrics?.r9v2InformationBranchValueVectorRows || 0,
  ),
  branchValueVectorDirtyRows: Number(
    metrics?.r9v2InformationBranchValueVectorDirtyRows || 0,
  ),
  routeEntryPreparationMs: Number(
    metrics?.r9v2TargetRouteEntryPreparationMs || 0,
  ),
  routeValueReuseGateReasons: Object.fromEntries(
    Object.entries(metrics || {})
      .filter(([key]) => key.startsWith(
        'r9v2InformationBranchRouteValueReuseGate:',
      ))
      .sort(([left], [right]) => compareStrings(left, right)),
  ),
});

const disableBranchValueVector = source => {
  const patched = source.replace(
    /root\?\.__LWCS_R9V2_DISABLE_S4_BRANCH_VALUE_VECTOR__ !== true/u,
    'false',
  );
  assert(patched !== source, 'K14_S4_BRANCH_VALUE_GATE_PATCH_MISSED');
  return patched;
};

const findUnit = (world, unitId) => [
  ...(world?.参战者?.team_player || []),
  ...(world?.参战者?.team_enemy || []),
].find(unit => String(unit?.id || '').trim() === String(unitId || '').trim());

const applyScenario = (world, scenario) => {
  const mutation = String(scenario?.mutation || '').trim();
  if (mutation === 'TARGET_HP') {
    const target = findUnit(world, scenario.targetId);
    assert(target, `K14_TARGET_HP_UNIT_MISSING:${scenario.targetId}`);
    const hp = Number(scenario.hp);
    target.hp = hp;
    target.HP = hp;
    target.属性 = { ...(target.属性 || {}), HP: hp };
    return {};
  }
  if (mutation === 'ACTOR_SOUL_POWER') {
    const actor = findUnit(world, world?.__rc6K14ActorId);
    assert(actor, 'K14_ACTOR_RESOURCE_UNIT_MISSING');
    const value = Number(scenario.value);
    actor.sp = value;
    actor.属性 = { ...(actor.属性 || {}), 魂力: value };
    return {};
  }
  if (mutation === 'TARGET_CONTROL_STATE') {
    const target = findUnit(world, scenario.targetId);
    assert(target, `K14_TARGET_STATE_UNIT_MISSING:${scenario.targetId}`);
    target.状态 = { ...(target.状态 || {}), 行动: String(scenario.state || '').trim() };
    target.状态效果 = {
      ...(target.状态效果 || {}),
      'rc6:s4:control': {
        原型: '控制',
        类型: '冻结',
        持续回合: 1,
      },
    };
    return {};
  }
  if (mutation === 'BELIEF_OVERLAY') {
    return {
      mechanics: {
        [String(scenario.mechanicKey || '').trim()]: {
          alpha: Number(scenario.alpha),
          beta: Number(scenario.beta),
          observations: Number(scenario.observations),
        },
      },
    };
  }
  assert(mutation === 'NONE', `K14_UNKNOWN_SCENARIO_MUTATION:${mutation}`);
  return {};
};

const runVariant = ({ source, fixture, scenario, label }) => {
  const sandbox = loadBattleSandbox({
    includeTargetKernel: true,
    sourceOverrides: { 'BattleDecision_Module.js': source },
  });
  const definition = manualCasesById(sandbox).get(fixture.caseId);
  assert(definition, `K14_CASE_MISSING:${fixture.caseId}`);
  const world = clone(definition.combatData);
  world.__rc6K14ActorId = fixture.actorId;
  const beliefState = applyScenario(world, scenario);
  delete world.__rc6K14ActorId;
  const decision = sandbox.__LWCS_BATTLE_DECISION__;
  const session = decision.createEvaluationSession({
    objectiveHash: `k14:${scenario.scenarioId}`,
    visibleWorldRevision: `k14:world:${scenario.scenarioId}`,
    beliefRevision: `k14:belief:${scenario.scenarioId}`,
    opportunityRevision: `k14:opportunity:${scenario.scenarioId}`,
    resourceTimelineRevision: `k14:resource:${scenario.scenarioId}`,
    scheduleRevision: `k14:schedule:${scenario.scenarioId}`,
  });
  try {
    const request = decision.prepareDecisionRequest({
      session,
      worldSnapshot: world,
      actorId: fixture.actorId,
      objectiveContract: world.胜负条件,
      battleIntent: {
        mode: definition.intent,
        objectives: clone(world.胜负条件),
      },
      actionOpportunity: {
        opportunityId: `k14:${scenario.scenarioId}`,
        ownerId: fixture.actorId,
        role: 'ACTIVE',
        futureHostileResponseAllowed: true,
      },
      beliefState,
      providerId: 'r9v2',
      analysisDepth: 'CANDIDATES_ONLY',
      r9v2InformationValueOnly: true,
      seed: `${definition.seed}:k14:${scenario.scenarioId}`,
    });
    const result = decision.runR9v2TargetProviderForTest(request);
    const semantic = semanticView(result);
    const metrics = metricView(
      decision.readEvaluationSessionMetrics(session)?.metrics || {},
    );
    assert(semantic.selectedCandidateId, `K14_SELECTION_MISSING:${scenario.scenarioId}`);
    return {
      label,
      semantic,
      semanticHash: sha256(JSON.stringify(semantic)),
      metrics,
    };
  } finally {
    decision.disposeEvaluationSession(session);
  }
};

const fixtureText = readUtf8(fixturePath);
const fixture = JSON.parse(fixtureText);
assert(fixture.schemaVersion === 'S4RouteValueReuseCasesV1', 'K14_FIXTURE_SCHEMA_MISMATCH');
const currentSource = readUtf8(decisionPath);
const fullRebuildSource = disableBranchValueVector(currentSource);
const rows = fixture.scenarios.map(scenario => {
  const current = runVariant({
    source: currentSource,
    fixture,
    scenario,
    label: 'route-value-reuse-enabled',
  });
  const fullRebuild = runVariant({
    source: fullRebuildSource,
    fixture,
    scenario,
    label: 'route-value-reuse-disabled',
  });
  return {
    scenarioId: scenario.scenarioId,
    semanticEqual: current.semanticHash === fullRebuild.semanticHash,
    current,
    fullRebuild,
  };
});
const vectorObserved = rows.some(row =>
  row.current.metrics.branchValueVectors > 0 &&
  row.current.metrics.branchValueVectorRows > 0 &&
  row.fullRebuild.metrics.branchValueVectors === 0,
);
const allEqual = rows.every(row => row.semanticEqual);
const output = {
  schemaVersion: 'M2K14S4BranchValueABV1',
  status: allEqual && vectorObserved ? 'PASSED' : 'REJECTED',
  scope: 'TARGET_KERNEL_SINGLE_DECISION_S4_BRANCH_VALUE_SEMANTIC_DIFFERENTIAL',
  caseId: fixture.caseId,
  actorId: fixture.actorId,
  scenarioCount: rows.length,
  rows,
  semanticEqual: allEqual,
  vectorObserved,
  sourceHashes: {
    decision: sha256(currentSource),
    fullRebuildDecision: sha256(fullRebuildSource),
    fixture: sha256(fixtureText),
    harness: sha256(readUtf8(fileURLToPath(import.meta.url))),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
assert(output.status === 'PASSED', 'K14_S4_BRANCH_VALUE_SEMANTIC_MISMATCH');

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const runtimePath = path.join(repoRoot, 'BattleRuntime_Module.js');
const harnessPath = fileURLToPath(import.meta.url);
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'k11-decision-audit-v2.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const loadRuntime = () => {
  delete globalThis.__LWCS_BATTLE_RUNTIME__;
  globalThis.__LWCS_BATTLE_PREVIEW__ = { version: '7.3-R6.3-preview-2' };
  globalThis.__LWCS_BATTLE_DECISION__ = { version: '7.3-R6.3-decision-2' };
  globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ = { 原型定义: {} };
  globalThis.__LWCS_BATTLE_EVENT_CONTRACT__ = {
    schemaVersion: '8.3-battle-event-contract-1',
    phasePriority: {
      RESOURCE_RESTORE: 1,
      NATURAL_RECOVERY: 2,
      RESOURCE_REFUND: 3,
      RESOURCE_UNLOCK: 4,
      RESOURCE_REDUCE: 5,
      RESOURCE_LOCK: 6,
      RESOURCE_PAY: 7,
      SUSTAIN_COST: 8,
    },
  };
  vm.runInThisContext(fs.readFileSync(runtimePath, 'utf8'), {
    filename: runtimePath,
  });
  return globalThis.__LWCS_BATTLE_RUNTIME__;
};

const proof = (candidateId, value = 12) => ({
  schemaVersion: 'CandidateValueProofV1',
  candidateId,
  goalUtilityDeltaHEPP: value,
  informationValueHEPP: 0,
  objectiveUtilityHEPP: value,
  causalValueFacts: [{
    factId: `${candidateId}:state`,
    ownerType: 'STATE_DELTA',
    valueHEPP: value,
    sourceOutcomeKind: 'DIRECT_HEALTH_DELTA',
    sourceEventId: `${candidateId}:event`,
    sourceFactId: `${candidateId}:fact`,
    targetUnitId: 'target-1',
  }],
  reconciliationError: 0,
});

const vector = (candidateId, value = 12) => ({
  candidateId,
  objectiveUtilityHEPP: value,
  informationValueHEPP: 0,
  assetReserve: 0,
  survivalLowerBound: 0,
  worstTailLossHEPP: 0,
  discardedOverkillPP: 0,
});

const row = (candidateId, value, proofValue = null, selected = false) => ({
  candidateId,
  actionKind: 'ATTACK',
  actorId: 'actor-1',
  targetIds: ['target-1'],
  objectiveUtilityHEPP: value,
  vector: vector(candidateId, value),
  ...(proofValue === null ? {} : { candidateValueProof: proof(candidateId, proofValue) }),
  selected,
  pareto: candidateId === 'a',
  paretoWitness: candidateId === 'a'
    ? { kind: 'NON_DOMINATED' }
    : { kind: 'DOMINATED', dominatorCandidateId: 'a' },
});

const buildDecision = ({ target = true, missingRequiredProof = false } = {}) => {
  const rows = [
    row('a', 12, 12, true),
    row('b', 8, target ? null : 8, false),
    row('c', 5, missingRequiredProof ? null : 5, false),
  ];
  const requiredProofCandidateIds = ['a', 'c'];
  const materializedProofCandidateIds = missingRequiredProof
    ? ['a']
    : requiredProofCandidateIds;
  const decisionEngine = target ? 'R9V2_TARGET' : 'R9V2_SHADOW';
  const preparedProofCandidateIds = target
    ? materializedProofCandidateIds
    : rows.map(item => item.candidateId);
  return {
    decisionEngine,
    selectedCandidateId: 'a',
    selectedActionName: '攻击',
    actor: 'actor-1',
    candidates: rows,
    selected: rows[0],
    frozenCandidateIds: ['a', 'b', 'c'],
    preparedEntryCandidateIds: ['a', 'b', 'c'],
    preparedProofCandidateIds,
    requiredProofCandidateIds: target ? requiredProofCandidateIds : preparedProofCandidateIds,
    materializedProofCandidateIds,
    vectorCoverage: {
      status: 'CLOSED',
      frozenCount: 3,
      observedCount: 3,
      preparedEntryCount: 3,
    },
    proofCoverage: {
      status: 'REQUIRED_SUBSET_CLOSED',
      requiredCount: requiredProofCandidateIds.length,
      materializedCount: materializedProofCandidateIds.length,
    },
    candidateCoverage: {
      status: 'CLOSED',
      frozenCount: 3,
      preparedEntryCount: 3,
      preparedProofCount: preparedProofCandidateIds.length,
    },
    candidateAudit: rows,
    scoreAudit: rows,
  };
};

const scoring = decision => ({
  round: 1,
  actor: 'actor-1',
  decisionEngine: decision.decisionEngine,
  actorControl: 'AI',
  selectedCandidateId: 'a',
  selectedActionName: '攻击',
  candidates: decision.candidateAudit,
  requiredProofCandidateIds: decision.requiredProofCandidateIds,
  materializedProofCandidateIds: decision.materializedProofCandidateIds,
  vectorCoverage: decision.vectorCoverage,
  proofCoverage: decision.proofCoverage,
  candidateCoverage: decision.candidateCoverage,
});

const auditInput = decision => ({
  eventLedger: [
    {
      eventKind: 'action_start',
      round: 1,
      actionId: 'a-action',
      sourceActionId: 'a-action',
      actorId: 'actor-1',
      actorName: 'actor-1',
      actionName: '攻击',
      targetIds: ['target-1'],
      actorControl: 'AI',
      actionRole: 'ACTIVE',
      parentNodeId: '',
      reactionNodeId: '',
      ruleCode: 'ACTIVE_ACTION',
      result: 'started',
      resultState: 'STARTED',
      factType: 'ACTION',
    },
    {
      eventKind: 'complete',
      round: 1,
      actionId: 'a-action',
      sourceActionId: 'a-action',
      actorId: 'actor-1',
      actorName: 'actor-1',
      actionName: '攻击',
      targetIds: ['target-1'],
      actorControl: 'AI',
      actionRole: 'ACTIVE',
      parentNodeId: '',
      reactionNodeId: '',
      ruleCode: 'ACTIVE_ACTION',
      result: 'success',
      resultState: 'COMPLETED',
      factType: 'ACTION',
    },
  ],
  resolutionTrace: [],
  publicReportBlocks: [],
  reportBlocks: [],
  combatData: {},
  scoringAudit: [scoring(decision)],
  r9v2DecisionAudits: [decision],
  scoringMutationDetected: false,
});

const runtime = loadRuntime();
const targetDecision = buildDecision();
const targetAudit = runtime.auditFacts(auditInput(targetDecision));
assert(targetAudit.fatalCount === 0, `K11_TARGET_SUBSET_REJECTED:${JSON.stringify(targetAudit.fatals)}`);

const missingRequiredAudit = runtime.auditFacts(
  auditInput(buildDecision({ missingRequiredProof: true })),
);
assert(
  missingRequiredAudit.fatals.some(fatal =>
    fatal.code === 'CAUSAL_RANGE_OWNER_CONFLICT' &&
    fatal.kind === 'R9V2_PROOF_MISSING',
  ),
  'K11_REQUIRED_PROOF_MISSING_NOT_FATAL',
);

const shadowDecision = buildDecision({ target: false });
const shadowAudit = runtime.auditFacts(auditInput(shadowDecision));
assert(shadowAudit.fatalCount === 0, `K11_SHADOW_REGRESSION:${JSON.stringify(shadowAudit.fatals)}`);

const output = {
  schemaVersion: 'M2K11DecisionAuditV2GateV1',
  status: 'PASSED',
  runtimeHash: sha256(fs.readFileSync(runtimePath)),
  harnessHash: sha256(fs.readFileSync(harnessPath)),
  targetSubsetWithoutNonRequiredProof: true,
  requiredProofMissingFatal: true,
  shadowAllProofRegression: true,
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

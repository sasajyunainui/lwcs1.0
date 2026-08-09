import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const kernelPath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const casesPath = path.join(
  repoRoot,
  'tools',
  'rc6',
  'cases',
  'KernelReferenceCasesV1.json',
);
const evidencePath = process.env.RC6_EVIDENCE_PATH
  ? path.resolve(repoRoot, process.env.RC6_EVIDENCE_PATH)
  : path.join(
      repoRoot,
      'tools',
      'rc6',
      'evidence',
      'm2',
      'k02-k03-columns-belief.json',
    );
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const clone = value => structuredClone(value);
const scheduledComponents = new Set([
  'S3_COUNTER',
  'S3_HARD_CONTROL',
  'S3_SOFT_CONTROL',
  'S5_CREATION_CONSUMER',
  'S5_DELAYED_EFFECT',
  'S5_DOT',
  'S5_HOT',
  'S5_SUMMON_WINDOW',
]);

const deepFrozen = value => {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
};

const candidateRows = testCase => testCase.candidates.map(candidate => {
  const rawFacts = clone(candidate.rawFacts || []);
  const targetSet = clone(candidate.targetSet || []);
  const dependencyTokens = [
    `candidate:${candidate.candidateId}`,
    'actor:reference-actor',
    ...targetSet.map(targetId => `unit:${targetId}`),
    `belief:${testCase.beliefRevision}`,
    `opportunity:${testCase.opportunityRevision}`,
  ];
  return {
    candidateId: candidate.candidateId,
    actorId: 'reference-actor',
    actionId: candidate.actionId,
    actionKind: candidate.actionKind,
    targetSet,
    paymentMode: candidate.paymentMode || 'FULL',
    dependencyTokens,
    resourceCosts: clone(candidate.resourceCosts || {}),
    successProbability: candidate.successProbability ?? 1,
    directFacts: rawFacts.filter(fact =>
      !scheduledComponents.has(String(fact.componentCode || '').trim()),
    ),
    scheduledFacts: rawFacts.filter(fact =>
      scheduledComponents.has(String(fact.componentCode || '').trim()),
    ),
    stateDeltaTotal: 0,
    actionPoolDeltaTotal: 0,
    terminalDeltaTotal: 0,
    causalFacts: [],
    legal: candidate.legal !== false,
    hardExclusionCodes: clone(candidate.hardExclusionCodes || []),
  };
});

const expectedColumns = (testCase, rows) => {
  let targetOffset = 0;
  let directOffset = 0;
  let scheduledOffset = 0;
  let dependencyOffset = 0;
  const result = {
    schemaVersion: 'MechanicalColumnsV1',
    worldRevision: String(testCase.worldRevision),
    opportunityRevision: String(testCase.opportunityRevision),
    candidateIds: [],
    actorIds: [],
    targetOffsets: [],
    targetUnitIds: [],
    sourceActionIds: [],
    paymentModes: [],
    resourceCosts: [],
    successProbabilities: [],
    directFactRanges: [],
    scheduledFactRanges: [],
    dependencyTokenRanges: [],
  };
  rows.forEach(row => {
    result.candidateIds.push(row.candidateId);
    result.actorIds.push(row.actorId);
    result.targetOffsets.push([
      targetOffset,
      targetOffset + row.targetSet.length,
    ]);
    result.targetUnitIds.push(...row.targetSet);
    result.sourceActionIds.push(row.actionId);
    result.paymentModes.push(row.paymentMode);
    result.resourceCosts.push(clone(row.resourceCosts));
    result.successProbabilities.push(row.successProbability);
    result.directFactRanges.push([
      directOffset,
      directOffset + row.directFacts.length,
    ]);
    result.scheduledFactRanges.push([
      scheduledOffset,
      scheduledOffset + row.scheduledFacts.length,
    ]);
    result.dependencyTokenRanges.push([
      dependencyOffset,
      dependencyOffset + row.dependencyTokens.length,
    ]);
    targetOffset += row.targetSet.length;
    directOffset += row.directFacts.length;
    scheduledOffset += row.scheduledFacts.length;
    dependencyOffset += row.dependencyTokens.length;
  });
  return result;
};

const beliefOverlay = (testCase, observerId = 'reference-actor') => ({
  observerId,
  beliefRevision: String(testCase.beliefRevision),
  visibleHpRatios: Object.fromEntries(
    testCase.candidates.flatMap(candidate =>
      (candidate.targetProfiles || []).map(profile => [
        String(profile.targetId),
        Number(profile.currentHpPP || 0) / 100,
      ]),
    ),
  ),
  visibleStates: {},
  revealedAbilityIds: [],
  observableDeclarations: testCase.candidates.map(candidate => ({
    candidateId: candidate.candidateId,
    actionId: candidate.actionId,
  })),
  posteriorParameters: {
    [`case:${testCase.caseId}`]: { alpha: 2, beta: 3 },
  },
  visibilityTokens: clone(testCase.publicFields || []),
});

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(kernelPath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
assert(kernel?.schemaVersion === 'ValueKernelSessionV1', 'K02_KERNEL_MISSING');

const fixture = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
assert(fixture.cases.length === 20, `K02_CASE_COUNT:${fixture.cases.length}`);
const caseResults = [];

for (const testCase of fixture.cases) {
  const rows = candidateRows(testCase);
  const inputHash = sha256(JSON.stringify(rows));
  const session = kernel.createSession({
    worldRevision: String(testCase.worldRevision),
    beliefRevision: String(testCase.beliefRevision),
    opportunityRevision: String(testCase.opportunityRevision),
    observerId: 'reference-actor',
    beliefOverlay: beliefOverlay(testCase),
    candidates: rows,
  });
  assert(
    sha256(JSON.stringify(rows)) === inputHash,
    `K02_PROVIDER_MUTATED_CANDIDATES:${testCase.caseId}`,
  );
  assert(
    JSON.stringify(session.candidateIds) ===
      JSON.stringify(rows.map(row => row.candidateId)),
    `K02_CANDIDATE_ORDER_CHANGED:${testCase.caseId}`,
  );
  assert(
    JSON.stringify(session.mechanicalColumns) ===
      JSON.stringify(expectedColumns(testCase, rows)),
    `K02_COLUMN_MISMATCH:${testCase.caseId}`,
  );
  assert(
    deepFrozen(session.mechanicalColumns),
    `K02_COLUMNS_NOT_DEEP_FROZEN:${testCase.caseId}`,
  );
  assert(
    deepFrozen(session.beliefOverlay),
    `K03_OVERLAY_NOT_DEEP_FROZEN:${testCase.caseId}`,
  );
  caseResults.push({
    caseId: testCase.caseId,
    candidateCount: rows.length,
    candidateOrderPreserved: true,
    columnsFieldEqual: true,
    columnsDeepFrozen: true,
    beliefOverlayDeepFrozen: true,
  });
}

const probeCase = fixture.cases[0];
const probeRows = candidateRows(probeCase);
const hiddenFields = [
  'hiddenExactHp',
  'hiddenResistance',
  'hiddenInventory',
  'hiddenAbility',
  'unobservedPosterior',
];
hiddenFields.forEach(field => {
  let rejected = false;
  try {
    kernel.createSession({
      worldRevision: 'hidden-probe',
      beliefRevision: 'hidden-probe',
      opportunityRevision: 'hidden-probe',
      observerId: 'reference-actor',
      beliefOverlay: {
        ...beliefOverlay(probeCase),
        [field]: { leaked: true },
      },
      candidates: probeRows,
    });
  } catch (error) {
    rejected = String(error.message).startsWith('BELIEF_HIDDEN_STATE_LEAK');
  }
  assert(rejected, `K03_HIDDEN_FIELD_ACCEPTED:${field}`);
});

const actorSession = kernel.createSession({
  worldRevision: 'observer-probe',
  beliefRevision: '1',
  opportunityRevision: 'observer-probe',
  observerId: 'reference-actor',
  beliefOverlay: beliefOverlay(probeCase),
  candidates: probeRows,
});
let observerMismatchFatal = false;
try {
  kernel.evaluateAllCandidates(actorSession, 'reference-enemy');
} catch (error) {
  observerMismatchFatal = String(error.message).startsWith(
    'R9V2_KERNEL_OBSERVER_MISMATCH',
  );
}
assert(observerMismatchFatal, 'K03_OBSERVER_SWITCH_REUSED_WRONG_OVERLAY');

const enemySession = kernel.createSession({
  worldRevision: 'observer-probe',
  beliefRevision: '1',
  opportunityRevision: 'observer-probe',
  observerId: 'reference-enemy',
  beliefOverlay: beliefOverlay(probeCase, 'reference-enemy'),
  candidates: probeRows,
});
assert(
  kernel.evaluateAllCandidates(enemySession, 'reference-enemy').length ===
    probeRows.length,
  'K03_ENEMY_OBSERVER_SESSION_FAILED',
);

const updatedOverlay = beliefOverlay(probeCase);
updatedOverlay.beliefRevision = '2';
updatedOverlay.posteriorParameters[`case:${probeCase.caseId}`] = {
  alpha: 3,
  beta: 3,
};
const updatedSession = kernel.createSession({
  worldRevision: 'posterior-probe',
  beliefRevision: '2',
  opportunityRevision: 'posterior-probe',
  observerId: 'reference-actor',
  beliefOverlay: updatedOverlay,
  candidates: probeRows,
});
assert(
  actorSession.beliefOverlay.posteriorParameters[
    `case:${probeCase.caseId}`
  ].alpha === 2,
  'K03_POSTERIOR_MUTATED_PRIOR_SESSION',
);
assert(
  updatedSession.beliefOverlay.posteriorParameters[
    `case:${probeCase.caseId}`
  ].alpha === 3,
  'K03_POSTERIOR_UPDATE_MISSING',
);

const output = {
  schemaVersion: 'M2K02K03ColumnsBeliefGateV1',
  status: 'PASSED',
  caseCount: caseResults.length,
  cases: caseResults,
  candidateMutationCount: 0,
  hiddenFieldRejections: hiddenFields,
  observerMismatchFatal,
  enemyObserverSessionPassed: true,
  posteriorRevisionIsolationPassed: true,
  kernelHash: sha256(fs.readFileSync(kernelPath)),
  fixtureHash: sha256(fs.readFileSync(casesPath)),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

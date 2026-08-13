import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PARETO_DIMENSIONS,
  assertRawCase,
  evaluateRawCandidate,
  evaluateRawCase,
  neumaierSum,
} from './reference-value-evaluator-v3.mjs';

const casesPath = new URL('../cases/ReferenceValueEvaluatorV3RawCasesV1.json', import.meta.url);
const schemaPath = new URL('../contracts/ReferenceValueEvaluatorV3RawInputV1.schema.json', import.meta.url);
const evaluatorPath = new URL('./reference-value-evaluator-v3.mjs', import.meta.url);
const casesDoc = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const source = fs.readFileSync(evaluatorPath, 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function resolveRef(node) {
  if (!node.$ref) return node;
  assert(node.$ref.startsWith('#/$defs/'), `unsupported schema ref ${node.$ref}`);
  return schema.$defs[node.$ref.slice('#/$defs/'.length)];
}

function schemaFailure(path, detail) {
  throw new Error(`E_SCHEMA:${path}:${detail}`);
}

function validateSchema(value, rawNode, path = '$') {
  const node = resolveRef(rawNode);
  if (Object.hasOwn(node, 'const') && value !== node.const) schemaFailure(path, 'const');
  if (node.enum && !node.enum.some(item => item === value)) schemaFailure(path, 'enum');
  if (node.type) {
    const accepted = Array.isArray(node.type) ? node.type : [node.type];
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!accepted.includes(actual)) schemaFailure(path, `type ${actual}`);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) schemaFailure(path, 'finite');
    if (node.minimum !== undefined && value < node.minimum) schemaFailure(path, 'minimum');
    if (node.maximum !== undefined && value > node.maximum) schemaFailure(path, 'maximum');
    if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) schemaFailure(path, 'exclusiveMinimum');
  }
  if (typeof value === 'string' && node.minLength !== undefined && value.length < node.minLength) schemaFailure(path, 'minLength');
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) schemaFailure(path, 'minItems');
    if (node.maxItems !== undefined && value.length > node.maxItems) schemaFailure(path, 'maxItems');
    if (node.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) schemaFailure(path, 'uniqueItems');
    if (node.items) value.forEach((item, index) => validateSchema(item, node.items, `${path}[${index}]`));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of node.required || []) if (!Object.hasOwn(value, key)) schemaFailure(path, `missing ${key}`);
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(node.properties || {}, key)) schemaFailure(path, `unknown ${key}`);
    }
    for (const [key, nested] of Object.entries(value)) {
      if (node.properties?.[key]) validateSchema(nested, node.properties[key], `${path}.${key}`);
    }
  }
  for (const clause of node.allOf || []) {
    let conditionMatches = true;
    if (clause.if) {
      try {
        validateSchema(value, clause.if, path);
      } catch {
        conditionMatches = false;
      }
    }
    if (conditionMatches && clause.then) validateSchema(value, clause.then, path);
  }
  return true;
}

function failCode(label, operation, code) {
  assert.throws(operation, error => error instanceof Error && error.message.startsWith(code), label);
}

function assertNear(actual, expected, label) {
  assert(Math.abs(actual - expected) <= 1e-12, `${label}: expected ${expected}, got ${actual}`);
}

assert.equal(validateSchema(casesDoc, schema), true);
assert.equal(casesDoc.count, 6);
assert.deepEqual(casesDoc.cases.map(item => item.semanticDomain), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
assert.equal(schema.$defs.candidate.additionalProperties, false);
assert.deepEqual(PARETO_DIMENSIONS, [
  ['objectiveUtilityHEPP', 'MAXIMIZE'],
  ['worstTailUtilityHEPP', 'MAXIMIZE'],
  ['survivalUtilityHEPP', 'MAXIMIZE'],
  ['assetReserveHEPP', 'MAXIMIZE'],
  ['informationValueHEPP', 'MAXIMIZE'],
  ['discardedOverkillPP', 'MINIMIZE'],
]);
assert(!/\bimport\s/u.test(source), 'evaluator must remain import-free');
assert(!/BattleDecision|Kernel|\bR8\b|\bR9\b|reference-value-evaluator-v2|future-route/iu.test(source), 'production/future implementation dependency');
assert(!/Math\.random|Date\.now|performance\.now|Top-K|topK/u.test(source), 'nondeterministic or Top-K code');

const inputBytes = JSON.stringify(casesDoc);
const firstResults = casesDoc.cases.map(assertRawCase);
const secondResults = casesDoc.cases.map(assertRawCase);
assert.equal(JSON.stringify(firstResults), JSON.stringify(secondResults), 'double-run result bytes differ');
assert.equal(JSON.stringify(casesDoc), inputBytes, 'fixture input mutated');

for (const result of firstResults) {
  for (const candidate of result.evaluatedCandidates) {
    assert.equal(candidate.causalTotalHEPP, neumaierSum(candidate.causalFacts.map(fact => fact.valueHEPP)), `${candidate.candidateId} causal facts`);
    assert.equal(candidate.causalTotalHEPP, neumaierSum([
      candidate.goalSatisfaction.stateDeltaTotalHEPP,
      candidate.goalSatisfaction.actionPoolDeltaTotalHEPP,
      candidate.goalSatisfaction.terminalDeltaTotalHEPP,
    ]), `${candidate.candidateId} owner reconciliation`);
    assert.equal(Object.keys(candidate.valueVector).length, 6, `${candidate.candidateId} vector width`);
    assert(PARETO_DIMENSIONS.every(([dimension]) => Number.isFinite(candidate.valueVector[dimension])), `${candidate.candidateId} finite vector`);
  }
}

const s1 = firstResults[0].selected;
assertNear(s1.goalSatisfaction.stateDeltaTotalHEPP, 30, 'S1 threshold utility');
assert.equal(s1.goalSatisfaction.terminalDeltaTotalHEPP, 100);
assertNear(s1.goalSatisfaction.discardedOverkillPP, 35, 'S1 overkill');
assert.deepEqual(s1.factAudit.map(fact => [fact.factId, fact.reason]), [
  ['s1-health', null], ['s1-terminal', null], ['s1-after-terminal', 'POST_TERMINAL'],
]);

const s2 = firstResults[1].selected;
assertNear(s2.goalSatisfaction.stateDeltaTotalHEPP, 50, 'S2 resource utility');
assertNear(s2.goalSatisfaction.actionPoolDeltaTotalHEPP, 20, 'S2 opportunity utility');
assert.deepEqual(Object.fromEntries(s2.opportunityAudit.map(route => [route.opportunityId, route.reason])), {
  'usable-strike': null,
  'not-started': 'NOT_STARTED',
  expired: 'EXPIRED',
  'resource-gated': 'INSUFFICIENT_RESOURCE',
});

const s3 = firstResults[2].selected;
assert.equal(s3.goalSatisfaction.stateDeltaTotalHEPP, 20);
assertNear(s3.goalSatisfaction.actionPoolDeltaTotalHEPP, 10, 'S3 consumer utility');
assert.deepEqual(s3.affectedUnitIds, ['ally-1', 'enemy-1']);
assert.deepEqual(s3.opportunityAudit.map(route => [route.opportunityId, route.reason]), [
  ['control-followup', null], ['inspiration-followup', 'MISSING_STATE'],
]);

const s4 = firstResults[3].selected;
const informationExpected = [
  ['endpoint', 20, 0, 0],
  ['near-endpoint', 20.8, 10, 10.8],
  ['maximum-group', 60, 10, 50],
];
assert.deepEqual(s4.informationBreakdown.map(group => group.groupId), informationExpected.map(group => group[0]));
s4.informationBreakdown.forEach((group, index) => {
  assertNear(group.adaptiveHEPP, informationExpected[index][1], `${group.groupId} adaptive`);
  assertNear(group.committedHEPP, informationExpected[index][2], `${group.groupId} committed`);
  assertNear(group.valueHEPP, informationExpected[index][3], `${group.groupId} information`);
});
assertNear(s4.goalSatisfaction.informationValueHEPP, 50, 'S4 maximum group');

const s5 = firstResults[4];
const duration = s5.evaluatedCandidates.find(candidate => candidate.candidateId === 'duration-consumers');
const terminal = s5.evaluatedCandidates.find(candidate => candidate.candidateId === 'first-terminal');
assertNear(duration.goalSatisfaction.stateDeltaTotalHEPP, 18, 'S5 DOT/HOT');
assertNear(duration.goalSatisfaction.actionPoolDeltaTotalHEPP, 10, 'S5 consumers');
assert.deepEqual(duration.factAudit.map(fact => [fact.factId, fact.reason]), [
  ['s5-dot', null], ['s5-hot', null], ['s5-expired', 'OUTSIDE_WINDOW'], ['s5-summon', null], ['s5-create', null],
]);
assert(duration.opportunityAudit.every(route => route.usable), 'summon/creation consumers must be usable');
assert.deepEqual(terminal.factAudit.map(fact => [fact.factId, fact.reason]), [
  ['s5-terminal', null], ['s5-after-terminal-dot', 'POST_TERMINAL'], ['s5-after-terminal-create', 'POST_TERMINAL'],
]);
assert.equal(terminal.opportunityAudit[0].reason, 'POST_TERMINAL');

const s6 = firstResults[5];
assert.equal(s6.selected.candidateId, '𐀀');
assert.deepEqual(s6.paretoCandidateIds, ['𐀀', '']);
assert.deepEqual(s6.alternatives, ['']);
assert.deepEqual(s6.excludedCandidateIds, ['hard-excluded']);
assert(!s6.paretoCandidateIds.includes('dominated'));
const manual = evaluateRawCase({
  caseId: 'v3-s6-manual-lock',
  mode: 'manual',
  playerLockedCandidateId: '',
  candidates: clone(casesDoc.cases[5].input.candidates),
});
assert.equal(manual.selected.candidateId, '');
assert.deepEqual(manual.alternatives, ['𐀀']);

assert.equal(neumaierSum([1e16, 1, -1e16]), 1, 'Neumaier cancellation');

const baseCandidate = casesDoc.cases[1].input.candidates[0];
const forbiddenCandidateFields = [
  'eligible', 'exclusionReasons', 'risk', 'causalFacts', 'causalTotalHEPP', 'goalSatisfaction',
  'valueVector', 'factAudit', 'opportunityAudit', 'affectedUnitIds', 'informationBreakdown',
  'paretoRank', 'paretoCandidateIds', 'alternatives', 'excludedCandidateIds', 'selected',
  'selection', 'routeResult', 'beforeRouteHEPP', 'afterRouteHEPP', 'futureCandidateRouteVector',
  'stateDeltaTotalHEPP', 'actionPoolDeltaTotalHEPP', 'terminalDeltaTotalHEPP',
  'informationValueHEPP', 'objectiveUtilityHEPP', 'worstTailUtilityHEPP',
  'survivalUtilityHEPP', 'assetReserveHEPP', 'discardedOverkillPP',
];
for (const field of forbiddenCandidateFields) {
  const probe = clone(baseCandidate);
  probe[field] = field === 'risk' ? {} : 1;
  assert.throws(() => evaluateRawCandidate(probe), `candidate must reject ${field}`);
  assert.throws(() => validateSchema(probe, schema.$defs.candidate), `schema must reject ${field}`);
}

for (const field of ['selected', 'paretoCandidateIds', 'alternatives', 'excludedCandidateIds', 'evaluatedCandidates']) {
  const probe = { caseId: 'derived-case-probe', ...clone(casesDoc.cases[0].input), [field]: [] };
  assert.throws(() => evaluateRawCase(probe), `case must reject ${field}`);
  const schemaProbe = { ...clone(casesDoc.cases[0].input), [field]: [] };
  assert.throws(() => validateSchema(schemaProbe, schema.$defs.caseInput), `case schema must reject ${field}`);
}

for (const literal of ['CONSTANT_HEPP', 'ROUTE_DELTA']) {
  const probe = clone(baseCandidate);
  probe.actionFacts[0].formula = literal;
  failCode(`reject ${literal}`, () => evaluateRawCandidate(probe), 'E_PRECOMPUTED_INPUT');
  assert.throws(() => validateSchema(probe, schema.$defs.candidate), `schema must reject ${literal}`);
}

const nestedDerivedProbes = [
  candidate => { candidate.opportunities[0].score = 20; },
  candidate => { candidate.opportunities[0].effects[0].valueVector = {}; },
  candidate => { candidate.informationGroups = [{ groupId: 'bad', outcomes: [{ outcomeId: 'bad', probability: 1, observations: [], futureActions: [{ candidateId: 'bad', actorUnitId: 'actor-1', startTick: 0, expireTick: 1, resourceId: null, resourceCost: 0, requiredStateUnitId: null, requiredStateId: null, requiredItemUnitId: null, requiredItemId: null, requiredSummonId: null, affectedUnitIds: ['enemy-1'], effects: [{ kind: 'HEALTH_CHANGE', targetUnitId: 'enemy-1', deltaHp: -1 }], routeValue: 1 }] }] }]; },
];
for (const mutate of nestedDerivedProbes) {
  const probe = clone(baseCandidate);
  mutate(probe);
  failCode('reject nested derived input', () => evaluateRawCandidate(probe), 'E_PRECOMPUTED_INPUT');
  assert.throws(() => validateSchema(probe, schema.$defs.candidate), 'schema must reject nested derived input');
}

for (const required of ['world', 'objectiveContract', 'actionFacts', 'opportunities', 'riskInputs', 'informationGroups']) {
  const probe = clone(baseCandidate);
  delete probe[required];
  failCode(`missing raw field ${required}`, () => evaluateRawCandidate(probe), 'E_CANDIDATE');
  assert.throws(() => validateSchema(probe, schema.$defs.candidate), `schema missing ${required}`);
}

console.log('ReferenceValueEvaluatorV3: 6 positive S1-S6 cases, 46 negative probes, schema closure, Neumaier, UTF-16, manual lock, causal reconciliation, and double-run byte determinism passed.');

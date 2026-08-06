import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  evaluateRawCandidate,
} from '../reference/reference-value-evaluator-v2.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const casesPath = path.join(repoRoot, 'tools', 'rc6', 'cases', 'S4TargetSemanticProbesV1.json');
const kernelPath = path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js');
const referencePath = path.join(repoRoot, 'tools', 'rc6', 'reference', 'reference-value-evaluator-v2.mjs');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 's4-target-semantics.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const clone = value => structuredClone(value);
const OWNER_BY_COMPONENT = Object.freeze({
  S1_HEALTH: 'STATE_DELTA',
  S1_TERMINAL: 'TERMINAL_DELTA',
  S2_ROUTE: 'ACTION_POOL_DELTA',
  S2_CONSTANT: 'ACTION_POOL_DELTA',
  S3_ROUTE: 'ACTION_POOL_DELTA',
  S5_CREATION_CONSUMER: 'ACTION_POOL_DELTA',
  S5_SUMMON_WINDOW: 'ACTION_POOL_DELTA',
});

const rawFactValue = fact => {
  if (fact.formula === 'CONSTANT_HEPP') return Number(fact.amountHEPP);
  if (fact.formula === 'ROUTE_DELTA') {
    return (Number(fact.afterRouteHEPP) - Number(fact.beforeRouteHEPP)) *
      Number(fact.applicationProbability ?? 1) * Number(fact.polarity ?? 1);
  }
  throw new Error(`S4_PROBE_UNSUPPORTED_FORMULA:${fact.formula}`);
};

const structuralRow = candidate => ({
  candidateId: candidate.candidateId,
  actionId: candidate.actionId,
  actorId: candidate.actorId,
  targetSet: clone(candidate.targetSet || []),
  paymentMode: candidate.paymentMode || 'FULL',
  dependencyTokens: clone(candidate.dependencyTokens || []),
  legal: candidate.legal !== false,
  hardExclusionCodes: clone(candidate.hardExclusionCodes || []),
  rawInput: {
    schemaVersion: 'KernelCandidateRawInputV1',
    rawFacts: clone(candidate.rawFacts || []),
    informationComponents: clone(candidate.informationGroups || []),
  },
});

delete globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
await import(pathToFileURL(kernelPath).href);
const kernel = globalThis.__LWCS_BATTLE_R9V2_KERNEL__;
assert(kernel?.rawCalculationMode === 'COMPONENT_REGISTRY_V1', 'S4_PROBE_KERNEL_RAW_MODE_MISSING');
const fixtureText = fs.readFileSync(casesPath, 'utf8');
const fixture = JSON.parse(fixtureText);
assert(fixture.schemaVersion === 'S4TargetSemanticProbesV1', 'S4_PROBE_FIXTURE_SCHEMA_MISMATCH');
const rows = [];

for (const probe of fixture.probes) {
  const candidate = probe.candidate;
  const reference = evaluateRawCandidate(candidate);
  assert(
    Math.abs(reference.informationValueHEPP - Number(probe.expectedInformationValueHEPP)) <= 1e-9,
    `S4_PROBE_REFERENCE_EXPECTATION_MISMATCH:${probe.probeId}`,
  );
  const registry = {
    canApplyFactDelta: () => false,
    evaluateCandidate: ({ candidate: rawCandidate }) => ({
      candidateId: rawCandidate.candidateId,
      componentFacts: rawCandidate.rawInput.rawFacts.map((fact, index) => ({
        componentCode: fact.componentCode,
        causalOwnerType: OWNER_BY_COMPONENT[fact.componentCode],
        valueHEPP: rawFactValue(fact),
        sourceEventId: fact.sourceEventId || `${rawCandidate.candidateId}:event:${index}`,
        sourceFactId: fact.sourceFactId || `${rawCandidate.candidateId}:fact:${index}`,
        targetUnitId: fact.targetUnitId || rawCandidate.actorId,
        sequence: fact.sequence ?? index,
      })),
      informationComponents: clone(rawCandidate.rawInput.informationComponents || []),
      paretoComponents: [
        { dimensionCode: 'worstTailUtilityHEPP', value: 0 },
        { dimensionCode: 'survivalUtilityHEPP', value: 0 },
        { dimensionCode: 'assetReserveHEPP', value: 0 },
        { dimensionCode: 'discardedOverkillPP', value: 0 },
      ],
      valueSource: 'S4_TARGET_SEMANTIC_PROBE',
      mechanicalSource: 'S4_TARGET_SEMANTIC_PROBE_RAW',
      legal: rawCandidate.legal !== false,
      hardExclusionCodes: clone(rawCandidate.hardExclusionCodes || []),
    }),
  };
  const session = kernel.createSession({
    calculationMode: kernel.rawCalculationMode,
    componentRegistry: registry,
    worldRevision: `s4-probe:${probe.probeId}:world`,
    beliefRevision: `s4-probe:${probe.probeId}:belief`,
    opportunityRevision: `s4-probe:${probe.probeId}:opportunity`,
    observerId: candidate.actorId,
    beliefOverlay: {
      observerId: candidate.actorId,
      beliefRevision: `s4-probe:${probe.probeId}:belief`,
      visibleHpRatios: {},
      visibleStates: {},
      revealedAbilityIds: [],
      observableDeclarations: [],
      posteriorParameters: {},
      visibilityTokens: [],
    },
    candidates: [structuralRow(candidate)],
  });
  const vector = kernel.evaluateAllCandidates(session, candidate.actorId)[0];
  assert(
    Math.abs(vector.informationValueHEPP - reference.informationValueHEPP) <= 1e-9,
    `S4_PROBE_KERNEL_REFERENCE_MISMATCH:${probe.probeId}:${vector.informationValueHEPP}:${reference.informationValueHEPP}`,
  );
  assert(
    Math.abs(vector.informationValueHEPP - Number(probe.expectedInformationValueHEPP)) <= 1e-9,
    `S4_PROBE_KERNEL_EXPECTATION_MISMATCH:${probe.probeId}`,
  );
  rows.push({
    probeId: probe.probeId,
    referenceInformationValueHEPP: reference.informationValueHEPP,
    kernelInformationValueHEPP: vector.informationValueHEPP,
    expectedInformationValueHEPP: Number(probe.expectedInformationValueHEPP),
    fieldEqual: true,
  });
}

const output = {
  schemaVersion: 'M2K14S4TargetSemanticGateV1',
  status: 'PASSED',
  probeCount: rows.length,
  rows,
  referenceEvaluatorIndependent: !/BattleDecisionR9v2Kernel_Module|BattleDecision_Module/u.test(
    fs.readFileSync(referencePath, 'utf8'),
  ),
  fixtureHash: sha256(fixtureText),
  referenceHash: sha256(fs.readFileSync(referencePath, 'utf8')),
  kernelHash: sha256(fs.readFileSync(kernelPath, 'utf8')),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
assert(output.referenceEvaluatorIndependent, 'S4_PROBE_REFERENCE_IMPORTS_PRODUCTION');
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

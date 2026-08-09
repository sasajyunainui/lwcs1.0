import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashJson, oracleIndexBindingHash } from './oracle-fixture-hash.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const casesDir = path.join(repoRoot, 'tools', 'rc6', 'cases');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = fileName => JSON.parse(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'));
const writeJson = (fileName, value) => {
  const absolutePath = path.join(repoRoot, fileName);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const oracleIndex = readJson('tools/rc6/cases/BehaviorOracleV2IndexV1.json');
const historicalOracleInput = readJson('tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json');

const OWNER_BY_COMPONENT = Object.freeze({
  S1_HEALTH: 'STATE_DELTA',
  S1_TERMINAL: 'TERMINAL_DELTA',
  S2_ROUTE: 'ACTION_POOL_DELTA',
  S2_CONSTANT: 'ACTION_POOL_DELTA',
  S3_BASIC_HIT: 'STATE_DELTA',
  S3_EVASION: 'STATE_DELTA',
  S3_DEFENSE: 'STATE_DELTA',
  S3_COUNTER: 'ACTION_POOL_DELTA',
  S3_HARD_CONTROL: 'ACTION_POOL_DELTA',
  S3_SOFT_CONTROL: 'ACTION_POOL_DELTA',
  S3_HEAL: 'STATE_DELTA',
  S3_SUPPORT_RESOURCE: 'ACTION_POOL_DELTA',
  S5_DOT: 'STATE_DELTA',
  S5_HOT: 'STATE_DELTA',
  S5_DELAYED_EFFECT: 'STATE_DELTA',
  S5_SUMMON_WINDOW: 'ACTION_POOL_DELTA',
  S5_CREATION_CONSUMER: 'ACTION_POOL_DELTA',
  S5_ITEM: 'ACTION_POOL_DELTA',
  S5_EQUIPMENT: 'ACTION_POOL_DELTA',
});

const componentCodeFor = concept => ({
  c01: 'S3_BASIC_HIT',
  c02: 'S3_EVASION',
  c03: 'S3_DEFENSE',
  c04: 'S3_COUNTER',
  c05: 'S3_HARD_CONTROL',
  c06: 'S3_SOFT_CONTROL',
  c07: 'S3_SOFT_CONTROL',
  c08: 'S2_ROUTE',
  c09: 'S2_ROUTE',
  c10: 'S3_SUPPORT_RESOURCE',
  c11: 'S3_SUPPORT_RESOURCE',
  c12: 'S3_DEFENSE',
  c13: 'S5_DOT',
  c14: 'S5_SUMMON_WINDOW',
  c15: 'S2_ROUTE',
  c16: 'S1_HEALTH',
}[concept] || null);

const domainFor = concept => ({
  c01: 'S3', c02: 'S3', c03: 'S3', c04: 'S3', c05: 'S3', c06: 'S3', c07: 'S3',
  c08: 'S2', c09: 'S2', c10: 'S2', c11: 'S2', c12: 'S3', c13: 'S5', c14: 'S5',
  c15: 'S4', c16: 'S1',
  x01: 'S2', x02: 'S3', x03: 'S3', x04: 'S5', x05: 'S5', x06: 'S5',
}[concept] || null);

const variantFor = caseId => {
  const match = /^(c\d+)_.*_(positive|negative|mutation)$/u.exec(caseId);
  return match ? { concept: match[1], variant: match[2] } : null;
};

const conceptFor = caseId => {
  const variant = variantFor(caseId);
  if (variant) return variant.concept;
  const match = /^(x\d+)_/u.exec(caseId);
  return match ? match[1] : null;
};

const amountFact = (componentCode, amountHEPP, id, sequence = 0, extra = {}) => ({
  componentCode,
  formula: 'CONSTANT_HEPP',
  amountHEPP,
  sourceEventId: `${id}:event:${sequence}`,
  sourceFactId: `${id}:fact:${sequence}`,
  targetUnitId: 'target-1',
  sequence,
  ...extra,
});

const healthFact = (deltaHp, maxHp, id, sequence = 0, polarity = 1, componentCode = 'S1_HEALTH', extra = {}) => ({
  componentCode,
  formula: 'HEALTH_PP',
  deltaHp,
  maxHp,
  polarity,
  sourceEventId: `${id}:event:${sequence}`,
  sourceFactId: `${id}:fact:${sequence}`,
  targetUnitId: 'target-1',
  sequence,
  ...extra,
});

const routeFact = (componentCode, amountHEPP, id, sequence = 0, extra = {}) => ({
  componentCode,
  formula: 'ROUTE_DELTA',
  beforeRouteHEPP: 0,
  afterRouteHEPP: amountHEPP,
  applicationProbability: 1,
  polarity: 1,
  sourceEventId: `${id}:event:${sequence}`,
  sourceFactId: `${id}:fact:${sequence}`,
  targetUnitId: 'target-1',
  sequence,
  ...extra,
});

const stateComponents = new Set([
  'S3_BASIC_HIT', 'S3_EVASION', 'S3_DEFENSE', 'S3_HEAL',
  'S5_DOT', 'S5_HOT', 'S5_DELAYED_EFFECT',
]);
const routeComponents = new Set([
  'S2_ROUTE', 'S3_COUNTER', 'S3_HARD_CONTROL', 'S3_SOFT_CONTROL',
  'S3_SUPPORT_RESOURCE', 'S5_SUMMON_WINDOW', 'S5_CREATION_CONSUMER',
  'S5_ITEM', 'S5_EQUIPMENT',
]);
const mechanicalFact = (componentCode, amountHEPP, id, sequence = 0, extra = {}) => {
  if (stateComponents.has(componentCode)) {
    return healthFact(amountHEPP * 10, 1000, id, sequence, 1, componentCode, extra);
  }
  if (routeComponents.has(componentCode)) return routeFact(componentCode, amountHEPP, id, sequence, extra);
  return amountFact(componentCode, amountHEPP, id, sequence, extra);
};

const terminalFact = (winProbability, lossProbability, id, sequence = 0) => ({
  componentCode: 'S1_TERMINAL',
  formula: 'TERMINAL_OUTCOME',
  winProbability,
  lossProbability,
  drawProbability: 1 - winProbability - lossProbability,
  sourceEventId: `${id}:event:${sequence}`,
  sourceFactId: `${id}:fact:${sequence}`,
  targetUnitId: 'target-1',
  sequence,
});

const riskInputs = (negativeTerminal = false) => ({
  actorMaxHp: 1000,
  actorHp: 0,
  actorSide: 'PLAYER',
  actorOutcomeDeltas: [],
  shieldFacts: [],
  negativeTerminal,
});

const routeVector = (before, after, probability = 1, polarity = 1) => ({
  candidateIds: ['future-a', 'future-b'],
  beforeRouteHEPP: [before, before],
  afterRouteHEPP: [after, after],
  applicationProbability: [probability, probability],
  polarity: [polarity, polarity],
});

const informationGroup = (groupId, probabilities, routeValues, committedValues = null) => ({
  groupId,
  outcomes: probabilities.map((probability, index) => ({
    probability,
    futureCandidateRouteVector: {
      candidateIds: ['future-a', 'future-b'],
      beforeRouteHEPP: [0, 0],
      afterRouteHEPP: routeValues[index],
      applicationProbability: [1, 1],
      polarity: [1, 1],
    },
  })),
  ...(committedValues
    ? {
        committedRouteFacts: committedValues.map((amount, index) => amountFact(
          'S2_ROUTE',
          amount,
          `${groupId}:committed`,
          index,
        )),
      }
    : {}),
});

const candidate = ({
  candidateId,
  actionId,
  componentCode,
  amount = 0,
  rawFacts = null,
  informationGroups = [],
  legal = true,
  hardExclusionCodes = [],
  targetProfiles = null,
  objectiveContract = null,
  actorSide = 'PLAYER',
  survival = false,
}) => ({
  candidateId,
  actionId,
  targetSet: ['target-1'],
  paymentMode: 'FULL',
  legal,
  hardExclusionCodes,
  actorSide,
  rawFacts: rawFacts || [mechanicalFact(componentCode, amount, candidateId)],
  informationGroups,
  riskInputs: riskInputs(false),
  ...(targetProfiles ? { targetProfiles } : {}),
  ...(objectiveContract ? { objectiveContract } : {}),
  ...(survival ? { riskInputs: { ...riskInputs(false), actorHp: 800 } } : {}),
});

const genericTriplet = (concept, domain, componentCode, options = {}) => {
  const subject = options.subjectId || `${concept}-effect`;
  const baseline = `${concept}-baseline`;
  const build = (variant, amount, baseAmount, extra = {}) => {
    const subjectCandidate = candidate({
      candidateId: subject,
      actionId: `${concept}-${variant}-effect`,
      componentCode,
      amount,
      rawFacts: extra.subject?.rawFacts || [mechanicalFact(
        componentCode,
        amount,
        subject,
        0,
        extra.subject?.factExtra || {},
      )],
      ...extra.subject,
    });
    const baselineCandidate = candidate({
      candidateId: baseline,
      actionId: `${concept}-${variant}-baseline`,
      componentCode: options.baselineComponentCode || componentCode,
      amount: baseAmount,
      rawFacts: extra.baseline?.rawFacts || [mechanicalFact(
        options.baselineComponentCode || componentCode,
        baseAmount,
        baseline,
        0,
        extra.baseline?.factExtra || {},
      )],
      ...extra.baseline,
    });
    return {
      schemaVersion: 'KernelRawReferenceCaseV1',
      caseId: `oracle-fixture:${concept}:${variant}`,
      semanticDomain: domain,
      mode: 'auto',
      phase: options.phase || 'ACTIVE',
      candidates: [subjectCandidate, baselineCandidate],
      expected: {
        selectedCandidateId: options.expected?.[variant] ||
          (variant === 'negative' ? baseline : subject),
      },
    };
  };
  return {
    positive: build('positive', options.positiveAmount ?? 20, options.positiveBase ?? 5, options.positiveExtra),
    negative: build('negative', options.negativeAmount ?? 0, options.negativeBase ?? 10, options.negativeExtra),
    mutation: build('mutation', options.mutationAmount ?? 30, options.mutationBase ?? 10, options.mutationExtra),
  };
};

const objectiveFixture = variant => {
  const subjectId = 'c16-objective';
  const baselineId = 'c16-baseline';
  const targetProfiles = [{ targetId: 'target-1', side: 'ENEMY', currentHpPP: 80 }];
  const objectiveContract = {
    victory: {
      logic: 'ANY',
      conditions: [{ type: 'HP_RATIO_AT_OR_BELOW', threshold: 0.3, targetIds: ['target-1'], scope: 'ANY' }],
    },
    defeat: { logic: 'ANY', conditions: [] },
  };
  const damage = variant === 'positive' ? -600 : variant === 'negative' ? 0 : -800;
  const subject = candidate({
    candidateId: subjectId,
    actionId: `c16-${variant}-objective`,
    rawFacts: [healthFact(damage, 1000, subjectId)],
    targetProfiles,
    objectiveContract,
  });
  const baseline = candidate({
    candidateId: baselineId,
    actionId: `c16-${variant}-baseline`,
    componentCode: 'S2_CONSTANT',
    amount: variant === 'negative' ? 20 : 5,
    targetProfiles,
    objectiveContract,
    survival: variant === 'negative',
  });
  return {
    schemaVersion: 'KernelRawReferenceCaseV1',
    caseId: `oracle-fixture:c16:${variant}`,
    semanticDomain: 'S1',
    mode: 'auto',
    phase: 'ACTIVE',
    candidates: [subject, baseline],
    expected: { selectedCandidateId: variant === 'negative' ? baselineId : subjectId },
  };
};

const informationFixture = variant => {
  const subjectId = 'c15-information';
  const baselineId = 'c15-baseline';
  const routeValues = variant === 'negative'
    ? [[20, 20], [20, 20]]
    : variant === 'mutation'
      ? [[40, 20], [10, 20]]
      : [[60, 10], [10, 60]];
  const probabilities = variant === 'mutation' ? [0.9, 0.1] : [0.5, 0.5];
  const subject = candidate({
    candidateId: subjectId,
    actionId: `c15-${variant}-observe`,
    componentCode: 'S2_CONSTANT',
    amount: 0,
    informationGroups: [informationGroup(`c15:${variant}`, probabilities, routeValues)],
  });
  const baseline = candidate({
    candidateId: baselineId,
    actionId: `c15-${variant}-commit`,
    componentCode: 'S2_CONSTANT',
    amount: variant === 'negative' ? 1 : 0,
  });
  return {
    schemaVersion: 'KernelRawReferenceCaseV1',
    caseId: `oracle-fixture:c15:${variant}`,
    semanticDomain: 'S4',
    mode: 'auto',
    phase: 'REACTION',
    candidates: [subject, baseline],
    expected: { selectedCandidateId: variant === 'negative' ? baselineId : subjectId },
  };
};

const xFixtures = {
  x01: {
    semanticDomain: 'S2',
    input: {
      schemaVersion: 'KernelRawReferenceCaseV1', caseId: 'oracle-fixture:x01', mode: 'auto', phase: 'COUNTER',
      candidates: [
        candidate({ candidateId: 'x01-timed-consumer', actionId: 'x01-consume', componentCode: 'S2_ROUTE', amount: 22 }),
        candidate({ candidateId: 'x01-no-consumer', actionId: 'x01-wait', componentCode: 'S2_ROUTE', amount: 0 }),
      ], expected: { selectedCandidateId: 'x01-timed-consumer' },
    },
    checks: [{ type: 'ownerValue', candidateId: 'x01-timed-consumer', owner: 'ACTION_POOL_DELTA', minimum: 22 }],
  },
  x02: {
    semanticDomain: 'S3',
    input: {
      schemaVersion: 'KernelRawReferenceCaseV1', caseId: 'oracle-fixture:x02', mode: 'auto', phase: 'REACTION',
      candidates: [
        candidate({ candidateId: 'x02-in-window', actionId: 'x02-slow', componentCode: 'S3_SOFT_CONTROL', amount: 18, rawFacts: [mechanicalFact('S3_SOFT_CONTROL', 18, 'x02-in-window', 0, { expiresBefore: 'ally-action-1' })] }),
        candidate({ candidateId: 'x02-expired', actionId: 'x02-wait', componentCode: 'S3_SOFT_CONTROL', amount: 0 }),
      ], expected: { selectedCandidateId: 'x02-in-window' },
    },
    checks: [{ type: 'factProperty', candidateId: 'x02-in-window', property: 'expiresBefore', value: 'ally-action-1' }],
  },
  x03: {
    semanticDomain: 'S3',
    input: {
      schemaVersion: 'KernelRawReferenceCaseV1', caseId: 'oracle-fixture:x03', mode: 'auto', phase: 'REACTION',
      candidates: [
        candidate({ candidateId: 'x03-multihit', actionId: 'x03-defend-reflect', rawFacts: [
          mechanicalFact('S3_DEFENSE', 8, 'x03-multihit', 0),
          mechanicalFact('S3_DEFENSE', 7, 'x03-multihit', 1),
          mechanicalFact('S3_COUNTER', 5, 'x03-multihit', 2),
        ] }),
        candidate({ candidateId: 'x03-label-only', actionId: 'x03-defend', componentCode: 'S3_DEFENSE', amount: 0 }),
      ], expected: { selectedCandidateId: 'x03-multihit' },
    },
    checks: [
      { type: 'ownerValue', candidateId: 'x03-multihit', owner: 'STATE_DELTA', equals: 15 },
      { type: 'ownerValue', candidateId: 'x03-multihit', owner: 'ACTION_POOL_DELTA', equals: 5 },
    ],
  },
  x04: {
    semanticDomain: 'S5',
    input: {
      schemaVersion: 'KernelRawReferenceCaseV1', caseId: 'oracle-fixture:x04', mode: 'auto', phase: 'ACTIVE',
      candidates: [
        candidate({ candidateId: 'x04-control-dot', actionId: 'x04-control', rawFacts: [
          mechanicalFact('S3_HARD_CONTROL', 10, 'x04-control-dot', 0),
          mechanicalFact('S5_DOT', 6, 'x04-control-dot', 1),
        ] }),
        candidate({ candidateId: 'x04-control-only', actionId: 'x04-control-only', componentCode: 'S3_HARD_CONTROL', amount: 10 }),
      ], expected: { selectedCandidateId: 'x04-control-dot' },
    },
    checks: [
      { type: 'ownerValue', candidateId: 'x04-control-dot', owner: 'STATE_DELTA', equals: 6 },
      { type: 'ownerValue', candidateId: 'x04-control-dot', owner: 'ACTION_POOL_DELTA', equals: 10 },
    ],
  },
  x05: {
    semanticDomain: 'S5',
    input: {
      schemaVersion: 'KernelRawReferenceCaseV1', caseId: 'oracle-fixture:x05', mode: 'auto', phase: 'ACTIVE',
      candidates: [
        candidate({ candidateId: 'x05-live-summon', actionId: 'x05-summon', componentCode: 'S5_SUMMON_WINDOW', amount: 20, rawFacts: [mechanicalFact('S5_SUMMON_WINDOW', 20, 'x05-live-summon', 0, { expiresAt: 'round-2' })] }),
        candidate({ candidateId: 'x05-host-dead', actionId: 'x05-summon-late', componentCode: 'S5_SUMMON_WINDOW', amount: 50, legal: false, hardExclusionCodes: ['HOST_DEAD'] }),
      ], expected: { selectedCandidateId: 'x05-live-summon' },
    },
    checks: [{ type: 'factProperty', candidateId: 'x05-live-summon', property: 'expiresAt', value: 'round-2' }],
  },
  x06: {
    semanticDomain: 'S5',
    input: {
      schemaVersion: 'KernelRawReferenceCaseV1', caseId: 'oracle-fixture:x06', mode: 'auto', phase: 'ACTIVE',
      candidates: [
        candidate({ candidateId: 'x06-block-recovery', actionId: 'x06-antiheal', rawFacts: [
          mechanicalFact('S3_HEAL', 18, 'x06-block-recovery', 0),
          mechanicalFact('S3_SUPPORT_RESOURCE', 7, 'x06-block-recovery', 1),
        ] }),
        candidate({ candidateId: 'x06-no-window', actionId: 'x06-wait', componentCode: 'S3_HEAL', amount: 0 }),
      ], expected: { selectedCandidateId: 'x06-block-recovery' },
    },
    checks: [
      { type: 'ownerValue', candidateId: 'x06-block-recovery', owner: 'STATE_DELTA', equals: 18 },
      { type: 'ownerValue', candidateId: 'x06-block-recovery', owner: 'ACTION_POOL_DELTA', equals: 7 },
    ],
  },
};

const cFixtures = new Map();
for (const concept of [
  'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08',
  'c09', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15', 'c16',
]) {
  if (concept === 'c15') {
    cFixtures.set(concept, {
      positive: informationFixture('positive'),
      negative: informationFixture('negative'),
      mutation: informationFixture('mutation'),
    });
  } else if (concept === 'c16') {
    cFixtures.set(concept, {
      positive: objectiveFixture('positive'),
      negative: objectiveFixture('negative'),
      mutation: objectiveFixture('mutation'),
    });
  } else {
    const componentCode = componentCodeFor(concept);
    const options = concept === 'c09'
      ? {
          positiveAmount: 0,
          positiveBase: 1,
          negativeAmount: 0,
          negativeBase: 1,
          mutationAmount: 0,
          mutationBase: 1,
          expected: { positive: `${concept}-baseline`, negative: `${concept}-baseline`, mutation: `${concept}-baseline` },
        }
      : concept === 'c08' || concept === 'c11' || concept === 'c12'
        ? { negativeAmount: 0, negativeBase: 1, expected: { negative: `${concept}-baseline` } }
      : concept === 'c14'
        ? { negativeAmount: 0, negativeBase: 5, negativeExtra: { subject: { legal: false, hardExclusionCodes: ['HOST_DEAD'] } }, expected: { negative: `${concept}-baseline` } }
        : concept === 'c13'
          ? { negativeAmount: 0, negativeBase: 5, expected: { negative: `${concept}-baseline` } }
          : {};
    cFixtures.set(concept, genericTriplet(concept, domainFor(concept), componentCode, options));
  }
}

const checkFor = (concept, variant) => {
  if (concept === 'c15') return variant === 'negative'
    ? [{ type: 'fieldEquals', candidateId: 'c15-information', field: 'informationValueHEPP', value: 0 }]
    : [{ type: 'fieldGreaterThan', candidateId: 'c15-information', field: 'informationValueHEPP', value: 0 }];
  if (concept === 'c16') return variant === 'positive'
    ? [{ type: 'fieldGreaterThan', candidateId: 'c16-objective', field: 'stateDeltaTotal', value: 0 }]
    : variant === 'negative'
      ? [{ type: 'fieldLessThanOrEqual', candidateId: 'c16-objective', field: 'stateDeltaTotal', value: 0 }]
      : [{ type: 'fieldGreaterThan', candidateId: 'c16-objective', field: 'discardedOverkillPP', value: 0 }];
  const componentCode = componentCodeFor(concept);
  const owner = OWNER_BY_COMPONENT[componentCode];
  const expected = concept === 'c09' || (['c11', 'c12'].includes(concept) && variant === 'negative') || (concept === 'c13' && variant === 'negative')
    ? 0
    : variant === 'negative'
      ? 0
      : variant === 'positive'
        ? 20
        : 30;
  const field = owner === 'STATE_DELTA' ? 'stateDeltaTotal' : 'actionPoolDeltaTotal';
  return [
    { type: 'fieldEquals', candidateId: `${concept}-effect`, field, value: expected },
    { type: 'ownerValue', candidateId: `${concept}-effect`, owner, equals: expected },
  ];
};

const fixtures = oracleIndex.oracles.map(oracle => {
  const concept = conceptFor(oracle.caseId);
  const variant = variantFor(oracle.caseId)?.variant || 'single';
  if (!concept || !domainFor(concept)) throw new Error(`ORACLE_FIXTURE_CONCEPT_UNMAPPED:${oracle.caseId}`);
  const input = variant === 'single' ? xFixtures[concept]?.input : cFixtures.get(concept)?.[variant];
  if (!input) throw new Error(`ORACLE_FIXTURE_INPUT_MISSING:${oracle.caseId}`);
  const checks = variant === 'single' ? xFixtures[concept].checks : checkFor(concept, variant);
  return {
    schemaVersion: 'BehaviorOracleFixtureV1',
    fixtureId: `fixture:${oracle.caseId}`,
    oracleId: oracle.oracleId,
    sourceCaseId: oracle.caseId,
    concept,
    semanticDomain: domainFor(concept),
    variant,
    input,
    checks,
    expectedSource: 'RC6_V24_CONTRACT_AND_EXPLICIT_REFERENCE_FACTS',
    historicalSourceStatus: historicalOracleInput.oracles.find(item => item.caseId === oracle.caseId)?.status || 'NOT_FOUND',
  };
});

const manifest = {
  schemaVersion: 'BehaviorOracleFixtureManifestV1',
  status: 'FROZEN_EXECUTABLE_FIXTURES',
  contractId: 'R83-RC6-M1-FROZEN-2026-08-06',
  count: fixtures.length,
  sourceHashes: {
    'tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json': sha256(fs.readFileSync(path.join(repoRoot, 'tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json'))),
  },
  oracleIndexBindingHash: oracleIndexBindingHash(oracleIndex),
  fixtures,
};

writeJson('tools/rc6/cases/BehaviorOracleFixtureManifestV1.json', manifest);

const updatedIndex = {
  ...oracleIndex,
  status: 'FROZEN_EXECUTABLE_FIXTURE_INDEX',
  fixtureManifestPath: 'tools/rc6/cases/BehaviorOracleFixtureManifestV1.json',
  fixtureManifestHash: hashJson(manifest),
  oracleIndexBindingHash: oracleIndexBindingHash(oracleIndex),
  oracles: oracleIndex.oracles.map(oracle => ({
    ...oracle,
    fixtureId: `fixture:${oracle.caseId}`,
    executableStatus: 'EXECUTABLE_FIXTURE_BOUND',
    fixtureStatus: 'EXECUTABLE',
  })),
};
writeJson('tools/rc6/cases/BehaviorOracleV2IndexV1.json', updatedIndex);

writeJson('tools/rc6/contracts/M1FixtureManifestV1.json', {
  schemaVersion: 'M1FixtureManifestV1',
  contractId: manifest.contractId,
  fixtureManifestPath: 'tools/rc6/cases/BehaviorOracleFixtureManifestV1.json',
  fixtureManifestHash: hashJson(manifest),
  oracleIndexBindingHash: oracleIndexBindingHash(oracleIndex),
  counts: { assertions: 61, prototypes: 23, referenceCases: 20, oracles: fixtures.length },
  historicalInputs: [
    {
      path: 'tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json',
      sha256: manifest.sourceHashes['tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json'],
      role: 'historical_assertion_input_only',
    },
  ],
});

process.stdout.write(JSON.stringify({
  status: manifest.status,
  fixtureCount: fixtures.length,
  tripletGroups: new Set(fixtures.filter(fixture => fixture.variant !== 'single').map(fixture => fixture.concept)).size,
  singleFixtures: fixtures.filter(fixture => fixture.variant === 'single').length,
}, null, 2));

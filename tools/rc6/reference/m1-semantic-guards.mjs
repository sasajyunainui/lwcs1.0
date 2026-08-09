import { PARETO_DIMENSIONS } from './reference-value-evaluator-v2.mjs';

const EPSILON = 1e-9;

const approx = (left, right, tolerance = EPSILON) =>
  Number.isFinite(Number(left)) &&
  Number.isFinite(Number(right)) &&
  Math.abs(Number(left) - Number(right)) <= tolerance;

const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const candidateOf = (caseById, caseId, candidateId) =>
  caseById.get(caseId)?.evaluated.find(item => item.candidateId === candidateId) || null;

const rawCandidate = ({ candidateId, actionId = candidateId, rawFacts = [], informationGroups = [], extra = {} }) => ({
  candidateId,
  actionId,
  targetSet: ['target-1'],
  paymentMode: 'FULL',
  rawFacts,
  informationGroups,
  ...extra,
});

const healthFact = (candidateId, targetUnitId, deltaHp, maxHp, sequence = 0, componentCode = 'S1_HEALTH') => ({
  componentCode,
  formula: 'HEALTH_PP',
  deltaHp,
  maxHp,
  polarity: deltaHp <= 0 ? -1 : 1,
  sourceEventId: `${candidateId}:event:${sequence}`,
  sourceFactId: `${candidateId}:fact:${sequence}`,
  targetUnitId,
  sequence,
});

const terminalFact = (candidateId, outcome, sequence = 0) => ({
  componentCode: 'S1_TERMINAL',
  formula: 'TERMINAL_OUTCOME',
  winProbability: outcome === 'WIN' ? 1 : 0,
  lossProbability: outcome === 'LOSS' ? 1 : 0,
  drawProbability: outcome === 'DRAW' ? 1 : 0,
  sourceEventId: `${candidateId}:terminal:event`,
  sourceFactId: `${candidateId}:terminal:fact`,
  targetUnitId: 'target-1',
  sequence,
});

const constantFact = (candidateId, amountHEPP) => ({
  componentCode: 'S2_CONSTANT',
  formula: 'CONSTANT_HEPP',
  amountHEPP,
  sourceEventId: `${candidateId}:constant:event`,
  sourceFactId: `${candidateId}:constant:fact`,
  targetUnitId: 'target-1',
  sequence: 0,
});

const informationBreakdown = group => {
  const outcomes = group.outcomes;
  const probabilities = outcomes.map(outcome => Number(outcome.probability));
  const tables = outcomes.map(outcome => {
    const vector = outcome.futureCandidateRouteVector;
    return new Map(vector.candidateIds.map((candidateId, index) => [
      String(candidateId),
      (Number(vector.afterRouteHEPP[index]) - Number(vector.beforeRouteHEPP[index])) *
        Number(vector.applicationProbability[index]) * Number(vector.polarity[index]),
    ]));
  });
  const adaptive = outcomes.reduce((sum, outcome, index) =>
    sum + probabilities[index] * Math.max(...tables[index].values()), 0);
  const commonIds = [...tables[0].keys()].filter(candidateId =>
    tables.every(table => table.has(candidateId)),
  );
  const committed = Math.max(0, ...commonIds.map(candidateId =>
    tables.reduce((sum, table, index) => sum + probabilities[index] * table.get(candidateId), 0),
  ));
  return { adaptive, committed, value: Math.max(0, adaptive - committed) };
};

const normalizedDistance = (candidate, selected, pool) => PARETO_DIMENSIONS.reduce((distance, [field, direction]) => {
  const values = pool.map(item => Number(item.vector[field]));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum;
  if (span === 0) return distance;
  const value = Number(candidate.vector[field]);
  const normalized = direction === 'MAXIMIZE'
    ? (value - minimum) / span
    : (maximum - value) / span;
  const selectedValue = Number(selected.vector[field]);
  const selectedNormalized = direction === 'MAXIMIZE'
    ? (selectedValue - minimum) / span
    : (maximum - selectedValue) / span;
  return distance + Math.abs(normalized - selectedNormalized);
}, 0);

const sameVector = (left, right) => PARETO_DIMENSIONS.every(([field]) =>
  approx(left.vector[field], right.vector[field]),
);

const buildInformationGroup = (groupId, probabilities, values) => ({
  groupId,
  outcomes: probabilities.map((probability, index) => ({
    outcomeId: `${groupId}:outcome:${index}`,
    probability,
    futureCandidateRouteVector: {
      candidateIds: ['common', `route-${groupId}-${index}`],
      beforeRouteHEPP: [0, 0],
      afterRouteHEPP: [10, values[index]],
      applicationProbability: [1, 1],
      polarity: [1, 1],
    },
  })),
});

export const runM1SemanticGuards = ({ contract, cases, caseById, evaluateRawCase, evaluateRawCandidate }) => {
  const caseInput = caseId => cases.find(item => item.caseId === caseId);
  const verification = caseId => caseInput(caseId)?.verification || {};
  const evaluated = (caseId, candidateId) => candidateOf(caseById, caseId, candidateId);
  const guard = {};

  const healthScaleProbe = [
    evaluateRawCandidate(rawCandidate({
      candidateId: 'health-small-max',
      rawFacts: [healthFact('health-small-max', 'target-1', -250, 500)],
    })),
    evaluateRawCandidate(rawCandidate({
      candidateId: 'health-large-max',
      rawFacts: [healthFact('health-large-max', 'target-1', -250, 1000)],
    })),
  ];
  guard.target_health_percentage =
    approx(healthScaleProbe[0].stateDeltaTotal, 50) &&
    approx(healthScaleProbe[1].stateDeltaTotal, 25);

  const anyAll = caseById.get('ref-s1-any-all');
  guard.any_projection =
    approx(evaluated('ref-s1-any-all', 'any-highest')?.stateDeltaTotal, 30) &&
    approx(evaluated('ref-s1-any-all', 'all-bottleneck')?.stateDeltaTotal, 10) &&
    anyAll?.selected.candidateId === 'any-highest';
  guard.all_projection =
    anyAll?.evaluated.some(item => item.candidateId === 'all-bottleneck' && approx(item.stateDeltaTotal, 10));

  const threshold = evaluated('ref-s1-threshold-truncation', 'threshold-attack');
  guard.threshold_clamp = approx(threshold?.stateDeltaTotal, 30);
  guard.overkill_discard = approx(threshold?.discardedOverkillPP, 45);

  const terminals = caseById.get('ref-s1-first-terminal')?.evaluated || [];
  guard.first_victory = approx(evaluated('ref-s1-first-terminal', 'lethal-first')?.terminalDeltaTotal, 100);
  guard.first_failure = approx(evaluated('ref-s1-first-terminal', 'terminal-failure')?.terminalDeltaTotal, -100);
  guard.draw_terminal = approx(evaluated('ref-s1-first-terminal', 'terminal-draw')?.terminalDeltaTotal, 0);
  const terminalClosure = evaluateRawCandidate(rawCandidate({
    candidateId: 'terminal-closure',
    rawFacts: [
      terminalFact('terminal-closure', 'WIN', 0),
      healthFact('terminal-closure', 'target-1', -90, 100, 1),
      { ...healthFact('terminal-closure', 'target-1', -10, 100, 2, 'S5_DOT'), sourceFactId: 'terminal-closure:dot:fact' },
      {
        componentCode: 'S2_ROUTE',
        formula: 'ROUTE_DELTA',
        beforeRouteHEPP: 0,
        afterRouteHEPP: 25,
        applicationProbability: 1,
        polarity: 1,
        sourceEventId: 'terminal-closure:late-route:event',
        sourceFactId: 'terminal-closure:late-route:fact',
        targetUnitId: 'target-1',
        sequence: 3,
      },
    ],
  }));
  guard.post_terminal_zero =
    approx(terminalClosure.goalUtilityDeltaHEPP, 100) &&
    terminalClosure.causalFacts.length === 1 &&
    terminalClosure.causalFacts[0].causalOwnerType === 'TERMINAL_DELTA';
  guard.terminal_owner = terminals.some(item =>
    item.causalFacts.filter(fact => fact.causalOwnerType === 'TERMINAL_DELTA').length === 1,
  );

  const opportunityFacts = verification('ref-s2-opportunity-schedule').opportunityFacts || [];
  guard.opportunity_kind =
    opportunityFacts.length === 3 &&
    opportunityFacts.find(fact => fact.kind === 'CONCRETE_OPPORTUNITY')?.formalOpportunity === true &&
    opportunityFacts.find(fact => fact.kind === 'SCHEDULE_DESCRIPTOR')?.formalOpportunity === false &&
    opportunityFacts.find(fact => fact.kind === 'PROJECTED_RESPONSE')?.responseOnly === true &&
    opportunityFacts.find(fact => fact.kind === 'PROJECTED_RESPONSE')?.formalOpportunity === false;
  const passCase = caseById.get('ref-s2-pass-lost');
  guard.pass_semantics =
    passCase?.evaluated.find(item => item.candidateId === 'active-pass')?.actionKind === 'PASS_OPPORTUNITY' &&
    !passCase?.evaluated.find(item => item.candidateId === 'active-pass')?.hardExclusionCodes.length;
  const lostCase = caseById.get('ref-lost-opportunity');
  guard.lost_semantics =
    lostCase?.evaluated.find(item => item.candidateId === 'lost-fact')?.actionKind === 'LOST_OPPORTUNITY' &&
    lostCase?.eligible.every(item => item.actionKind !== 'LOST_OPPORTUNITY');
  const resourceTimeline = verification('ref-s2-resource-order').resourceTimeline;
  const sortedResourceIds = [...resourceTimeline.events]
    .sort((left, right) =>
      left.round - right.round ||
      left.opportunitySequence - right.opportunitySequence ||
      left.actionSequence - right.actionSequence ||
      left.phasePriority - right.phasePriority ||
      left.effectSequence - right.effectSequence ||
      compareCodeUnits(left.eventId, right.eventId),
    )
    .map(event => event.eventId);
  guard.resource_order = JSON.stringify(sortedResourceIds) === JSON.stringify(resourceTimeline.expectedOrder);
  guard.payment_ownership = resourceTimeline.events.every(event =>
    ['PAYMENT', 'REFUND'].includes(event.ownerType) && event.sourceFactId === `fact-${event.eventId}`,
  );
  guard.no_op_semantics =
    verification('ref-s2-pass-lost').noOpCandidateId === 'NO_OP' &&
    !passCase?.evaluated.some(item => item.candidateId === 'NO_OP') &&
    evaluateRawCandidate(rawCandidate({
      candidateId: 'empty-stable-intersection',
      informationGroups: [{
        groupId: 'empty-stable-intersection',
        outcomes: [
          {
            probability: 0.5,
            futureCandidateRouteVector: {
              candidateIds: ['route-a'],
              beforeRouteHEPP: [0],
              afterRouteHEPP: [20],
              applicationProbability: [1],
              polarity: [1],
            },
          },
          {
            probability: 0.5,
            futureCandidateRouteVector: {
              candidateIds: ['route-b'],
              beforeRouteHEPP: [0],
              afterRouteHEPP: [20],
              applicationProbability: [1],
              polarity: [1],
            },
          },
        ],
      }],
    })).informationValueHEPP === 20;
  guard.resource_consumer =
    evaluated('ref-s5-creation-consumer', 'create-with-consumer')?.actionPoolDeltaTotal > 0 &&
    !caseById.get('ref-s5-creation-consumer').eligible.some(item =>
      item.candidateId === 'create-without-consumer',
    );

  const poolCase = caseById.get('ref-s3-control-overlap');
  const poolVerification = verification('ref-s3-control-overlap');
  guard.pool_closure =
    JSON.stringify(caseInput('ref-s3-control-overlap').candidates
      .filter(candidate => candidate.legal !== false && !candidate.hardExclusionCodes.length)
      .map(candidate => candidate.candidateId).sort()) ===
      JSON.stringify(poolVerification.behaviorPoolCandidateIds.slice().sort()) &&
    poolVerification.behaviorPoolCandidateIds.every(candidateId =>
      poolCase.evaluated.some(item => item.candidateId === candidateId),
    );
  guard.affected_unit_closure =
    JSON.stringify(poolVerification.affectedUnitIds.slice().sort()) ===
    JSON.stringify(poolVerification.invalidatedUnitIds.slice().sort());
  guard.future_route_delta =
    evaluated('ref-s3-control-overlap', 'control-route')?.actionPoolDeltaTotal > 0 &&
    evaluated('ref-s3-control-overlap', 'control-route')?.causalFacts.some(fact =>
      fact.componentCode === 'S3_HARD_CONTROL',
    ) && poolVerification.futureRoute.after > poolVerification.futureRoute.before;
  const absorption = verification('ref-s3-protect-critical').actualAbsorption;
  guard.state_delta_owner =
    absorption.preventedDamage === absorption.stateDeltaHEPP &&
    evaluated('ref-s3-protect-critical', 'protect-ally')?.causalFacts.some(fact =>
      fact.componentCode === 'S3_DEFENSE' &&
      fact.causalOwnerType === 'STATE_DELTA' &&
      approx(fact.valueHEPP, absorption.stateDeltaHEPP),
    );
  const probabilityBranch = verification('ref-s3-dodge-counter').probabilityBranch;
  guard.probability_branch =
    approx(probabilityBranch.branches.reduce((sum, value) => sum + value, 0), 1) &&
    probabilityBranch.successProbability > 0 &&
    probabilityBranch.successProbability < 1 &&
    probabilityBranch.routeChanges === true &&
    evaluated('ref-s3-dodge-counter', 'evade-window')?.causalFacts.some(fact =>
      fact.componentCode === 'S3_EVASION',
    );
  const responseFact = verification('ref-s3-dodge-counter').responseFact;
  guard.response_fact =
    responseFact.kind === 'CONCRETE_OPPORTUNITY' &&
    responseFact.responseProbability > 0 &&
    responseFact.responseProbability < 1 &&
    Boolean(responseFact.sourceFactId) &&
    evaluated('ref-s3-dodge-counter', 'evade-window')?.causalFacts.some(fact =>
      fact.componentCode === 'S3_COUNTER' && fact.causalOwnerType === 'ACTION_POOL_DELTA',
    );
  const support = verification('ref-s3-protect-critical').supportConsumer;
  guard.support_consumer = support.observable === true && Boolean(support.affectedUnitId);
  const heal = verification('ref-s3-protect-critical').healConditioning;
  guard.heal_conditioning = heal.currentHpPP < heal.thresholdPP && heal.terminal === false;
  guard.duplicate_causal_fact = (caseById.get('ref-s6-causal-state-owner')?.evaluated || [])
    .every(item => new Set(item.causalFacts.map(fact => fact.sourceFactId)).size === item.causalFacts.length);
  const namedCase = caseInput('ref-s3-control-overlap');
  const namedProbe = JSON.parse(JSON.stringify(namedCase));
  namedProbe.candidates.forEach((candidate, index) => {
    candidate.roleName = index === 0 ? 'alpha-role' : 'omega-role';
    candidate.skillName = index === 0 ? 'alpha-skill' : 'omega-skill';
  });
  const namedResult = evaluateRawCase(namedProbe);
  guard.no_name_branch = namedResult.selected.candidateId === poolCase.selected.candidateId &&
    namedResult.evaluated.every(item => sameVector(item, poolCase.evaluated.find(other => other.candidateId === item.candidateId)));

  const publicVerification = verification('ref-s4-public-belief');
  guard.public_visibility =
    publicVerification.publicEvidence.every(field => contract.visibility.allowed.includes(field)) &&
    publicVerification.publicEvidence.includes('observableDeclarations');
  const hiddenProbe = JSON.parse(JSON.stringify(caseInput('ref-s4-public-belief')));
  hiddenProbe.candidates.forEach(candidate => {
    candidate.hiddenExactHp = 1;
    candidate.hiddenResistance = 999999;
    candidate.hiddenInventory = ['secret-item'];
    candidate.hiddenAbility = 'secret-skill';
  });
  const hiddenResult = evaluateRawCase(hiddenProbe);
  guard.hidden_visibility =
    publicVerification.hiddenEvidence.every(field => contract.visibility.forbidden.includes(field)) &&
    hiddenResult.selected.candidateId === caseById.get('ref-s4-public-belief').selected.candidateId &&
    hiddenResult.evaluated.every(item => sameVector(
      item,
      caseById.get('ref-s4-public-belief').evaluated.find(other => other.candidateId === item.candidateId),
    ));
  const responseBranches = publicVerification.responseBranches;
  guard.response_branch_shape =
    responseBranches.publicEvidenceBranches === 2 &&
    responseBranches.catastrophicTail === 1 &&
    responseBranches.hiddenPlanFields === 0;
  const infoCandidate = caseInput('ref-s4-information-positive').candidates.find(item => item.candidateId === 'observe-then-act');
  const info = informationBreakdown(infoCandidate.informationGroups[0]);
  const expectedInfo = verification('ref-s4-information-positive').expectedInformation;
  guard.adaptive_value = approx(info.adaptive, expectedInfo.adaptive);
  guard.committed_value = approx(info.committed, expectedInfo.committed);
  const multipleGroupCandidate = rawCandidate({
    candidateId: 'multiple-observation-groups',
    informationGroups: [
      buildInformationGroup('high', [0.5, 0.5], [70, 10]),
      buildInformationGroup('low', [0.5, 0.5], [28, 10]),
    ],
  });
  const multipleGroupResult = evaluateRawCandidate(multipleGroupCandidate);
  const endpointResults = [0, 1].map(probability =>
    evaluateRawCandidate(rawCandidate({
      candidateId: `endpoint-${probability}`,
      informationGroups: [buildInformationGroup(`endpoint-${probability}`, [probability, 1 - probability], [70, 10])],
    })).informationValueHEPP,
  );
  const nearEndpointResults = [0.01, 0.99].map(probability =>
    evaluateRawCandidate(rawCandidate({
      candidateId: `near-endpoint-${probability}`,
      informationGroups: [buildInformationGroup(`near-endpoint-${probability}`, [probability, 1 - probability], [70, 10])],
    })).informationValueHEPP,
  );
  guard.information_endpoint = endpointResults.every(value => approx(value, 0)) &&
    nearEndpointResults.every(value => value > 0);
  guard.information_route_change =
    approx(info.value, expectedInfo.value) && info.value > 0 &&
    approx(multipleGroupResult.informationValueHEPP, 30);

  const scheduledEffects = verification('ref-s5-dot-hot-expiry').scheduledEffects;
  guard.scheduled_effect = scheduledEffects.filter(effect => effect.contributes).every(effect =>
    effect.observedAt >= effect.startsAt && effect.observedAt <= effect.expiresAt,
  ) && scheduledEffects.some(effect => effect.componentCode === 'S5_DOT') &&
    scheduledEffects.some(effect => effect.componentCode === 'S5_HOT');
  guard.expiry = scheduledEffects.some(effect => effect.contributes === false && effect.observedAt > effect.expiresAt) &&
    !caseById.get('ref-s5-dot-hot-expiry').eligible.some(item => item.candidateId === 'expired-dot');
  const summon = verification('ref-s5-summon-host-death').summonLifecycle;
  guard.summon_lifecycle =
    summon.birthEvent && summon.hostDeathEvent && summon.routeStopsAt === summon.hostDeathEvent &&
    !caseById.get('ref-s5-summon-host-death').eligible.some(item => item.candidateId === summon.lateCandidateId);
  const creation = verification('ref-s5-creation-consumer').creationConsumer;
  guard.creation_consumer = creation.observable === true && creation.windowOpen === true &&
    evaluated('ref-s5-creation-consumer', creation.producerCandidateId)?.actionPoolDeltaTotal > 0;
  const inventory = verification('ref-s5-creation-consumer').inventoryFact;
  guard.inventory_fact = inventory.created === 1 && inventory.consumed === 1 && inventory.hiddenSourceRead === false;
  const equipment = verification('ref-s5-creation-consumer').equipmentWindow;
  guard.equipment_window = equipment.observedAt >= equipment.startsAt &&
    equipment.observedAt <= equipment.expiresAt && Boolean(equipment.consumerId);

  const allEvaluated = [...caseById.values()].flatMap(result => result.evaluated);
  const owners = new Set(allEvaluated.flatMap(item => item.causalFacts.map(fact => fact.causalOwnerType)));
  guard.causal_owner = ['STATE_DELTA', 'ACTION_POOL_DELTA', 'TERMINAL_DELTA'].every(owner => owners.has(owner));
  guard.causal_reconciliation = allEvaluated.every(item =>
    approx(item.causalFacts.reduce((sum, fact) => sum + Number(fact.valueHEPP), 0), item.goalUtilityDeltaHEPP, 1e-6),
  );
  guard.pareto_dimensions = allEvaluated.every(item =>
    PARETO_DIMENSIONS.every(([field]) => Object.hasOwn(item.vector, field)),
  );
  const hardExclusion = caseById.get('ref-s6-pareto-hard-exclusion');
  guard.hard_exclusion =
    !hardExclusion.eligible.some(item => item.candidateId === 'invalid-high-value') &&
    hardExclusion.selected.candidateId === 'valid-safe';
  const manual = caseById.get('ref-manual-locked');
  guard.manual_lock = manual.selected.candidateId === 'player-choice' &&
    manual.selected.playerLocked === true && manual.selected.legal === true;
  const alternativeCase = evaluateRawCase({
    caseId: 'alternative-l1-probe',
    mode: 'auto',
    candidates: [
      ['a', 40, 10, 30, 0],
      ['b', 35, 10, 0, 0],
      ['c', 30, 80, 10, 0],
      ['d', 25, 10, 10, 80],
    ].map(([candidateId, amountHEPP, actorHp, tailLoss, shield]) => rawCandidate({
      candidateId,
      rawFacts: [constantFact(candidateId, amountHEPP)],
      extra: {
        riskInputs: {
          actorMaxHp: 100,
          actorHp,
          actorOutcomeDeltas: tailLoss ? [{ deltas: [-tailLoss] }] : [],
          shieldFacts: shield ? [{ deltaHp: shield, maxHp: 100, side: 'PLAYER' }] : [],
          actorSide: 'PLAYER',
        },
      },
    })),
  });
  const alternative1 = alternativeCase.alternatives[0];
  const selected = alternativeCase.selected;
  guard.alternative_one = Boolean(alternative1 && selected) &&
    (alternative1.actionId !== selected.actionId ||
      JSON.stringify(alternative1.targetSet) !== JSON.stringify(selected.targetSet) ||
      alternative1.paymentMode !== selected.paymentMode);
  const alternative2 = alternativeCase.alternatives[1];
  const remaining = alternativeCase.pareto.filter(item =>
    item.candidateId !== selected.candidateId && item.candidateId !== alternative1.candidateId,
  );
  const expectedAlternative2 = remaining.slice().sort((left, right) =>
    normalizedDistance(right, selected, alternativeCase.pareto) -
      normalizedDistance(left, selected, alternativeCase.pareto) ||
    compareCodeUnits(left.candidateId, right.candidateId),
  )[0];
  guard.alternative_two =
    alternative2?.candidateId === 'd' &&
    alternative2.candidateId === expectedAlternative2?.candidateId;
  const utf16Result = evaluateRawCase({
    caseId: 'utf16-tie',
    mode: 'auto',
    candidates: [
      rawCandidate({ candidateId: '\u{10000}', actionId: 'astral' }),
      rawCandidate({ candidateId: '\uE000', actionId: 'bmp' }),
    ],
  });
  guard.utf16_sort = utf16Result.selected.candidateId === '\u{10000}';

  return guard;
};

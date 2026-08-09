import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oracleIndexBindingHash } from './oracle-fixture-hash.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const contractsDir = path.join(repoRoot, 'tools', 'rc6', 'contracts');
const casesDir = path.join(repoRoot, 'tools', 'rc6', 'cases');
const coreFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
];

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const writeJson = (fileName, value) => {
  fs.mkdirSync(path.dirname(fileName), { recursive: true });
  fs.writeFileSync(fileName, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const hashFile = fileName => sha256(fs.readFileSync(path.join(repoRoot, fileName)));
const historicalProductionSourceHashes = Object.fromEntries(coreFiles.map(fileName => [fileName, hashFile(fileName)]));

const domainTitles = {
  S1: 'objective-life-terminal',
  S2: 'opportunity-resource-schedule',
  S3: 'team-behavior-pool',
  S4: 'response-belief-information',
  S5: 'long-window-effects',
  S6: 'causal-pareto-selection',
};

const assertionGroups = {
  S1: [
    ['target_health_is_base_max_hp_percentage', 'Target life progress uses a percentage of the target base maximum health.', 'target_health_percentage'],
    ['any_uses_highest_realizable_condition', 'ANY objectives use the highest realizable condition projection.', 'any_projection'],
    ['all_uses_bottleneck_condition', 'ALL objectives use the lowest completion condition as the bottleneck.', 'all_projection'],
    ['threshold_damage_is_clamped', 'Threshold objectives count damage only until the threshold.', 'threshold_clamp'],
    ['overkill_is_explicit_discard', 'Damage beyond a threshold is recorded as discarded overkill, not hidden in goal value.', 'overkill_discard'],
    ['first_victory_is_positive_terminal', 'The first victory crossing contributes exactly the positive terminal value.', 'first_victory'],
    ['first_failure_is_negative_terminal', 'The first failure crossing contributes exactly the negative terminal value.', 'first_failure'],
    ['draw_has_zero_terminal_delta', 'A draw contributes zero terminal delta.', 'draw_terminal'],
    ['post_terminal_value_is_zero', 'After the first terminal outcome, later life, resource, opportunity and DOT value are zero.', 'post_terminal_zero'],
    ['terminal_owner_is_unique', 'The first terminal crossing has one causal owner and cannot be counted twice.', 'terminal_owner'],
  ],
  S2: [
    ['concrete_opportunity_is_real', 'A CONCRETE_OPPORTUNITY is a real executable opportunity.', 'opportunity_kind'],
    ['schedule_descriptor_is_not_response', 'A SCHEDULE_DESCRIPTOR describes future work and is not itself a projected response.', 'opportunity_kind'],
    ['projected_response_is_not_opportunity', 'A PROJECTED_RESPONSE changes response probability only and cannot create a formal opportunity.', 'opportunity_kind'],
    ['pass_is_active_choice', 'PASS_OPPORTUNITY is an active decision to let a real opportunity pass.', 'pass_semantics'],
    ['lost_is_state_fact', 'LOST_OPPORTUNITY records a prohibited or unavailable action and does not create a fake defense.', 'lost_semantics'],
    ['resource_order_is_total', 'Resource facts are ordered by round, opportunity, action, phase, effect and event identity.', 'resource_order'],
    ['payment_is_fact_owned', 'Payment and refund facts belong to the mechanical fact owner that produced them.', 'payment_ownership'],
    ['no_op_is_counterfactual', 'NO_OP is a common scoring counterfactual and is not inserted into the legal candidate set.', 'no_op_semantics'],
    ['control_loss_is_not_pass', 'State-forbidden action is a lost opportunity, not a player-selected pass.', 'lost_semantics'],
    ['consumer_changes_resource_value', 'A resource change matters only when an observable future consumer can use it.', 'resource_consumer'],
  ],
  S3: [
    ['all_legal_routes_enter_pool', 'Every legal route enters the behavior pool before Pareto filtering.', 'pool_closure'],
    ['affected_unit_closure_is_complete', 'Behavior-pool invalidation includes every unit affected by a fact delta.', 'affected_unit_closure'],
    ['control_value_has_future_route_effect', 'Control value includes its effect on future legal routes when a route changes.', 'future_route_delta'],
    ['defense_uses_actual_absorption', 'Defense value uses actual prevented or absorbed damage rather than a label bonus.', 'state_delta_owner'],
    ['evasion_uses_actual_probability', 'Evasion value uses its actual hit probability and resulting route distribution.', 'probability_branch'],
    ['counter_is_real_response', 'Counter value is attached to the response fact that can actually occur.', 'response_fact'],
    ['support_value_has_consumer', 'Support value requires an affected ally or future consumer.', 'support_consumer'],
    ['healing_is_target_conditioned', 'Healing value is conditioned on target life, threshold and terminal state.', 'heal_conditioning'],
    ['repeated_effects_are_not_double_counted', 'Repeated effects cannot count the same causal fact twice.', 'duplicate_causal_fact'],
    ['strategy_is_not_role_name_rule', 'Strategy selection has no role-name or skill-name special case.', 'no_name_branch'],
    ['strategy_is_not_top_k_rule', 'The legal pool is not reduced by an arbitrary Top-K cutoff.', 'pool_closure'],
  ],
  S4: [
    ['belief_reads_public_hp_only', 'Belief state can read public life ratios and public states.', 'public_visibility'],
    ['hidden_hp_is_not_read', 'Hidden exact life, resistance and inventory values are unavailable to the observer.', 'hidden_visibility'],
    ['revealed_ability_is_public', 'An ability is public only after it has been revealed by an accepted observation.', 'public_visibility'],
    ['declaration_is_public_evidence', 'A public declaration is available as an observation at decision time.', 'public_visibility'],
    ['response_branch_cap_is_structural', 'Response branches retain two public evidence branches and one catastrophic tail.', 'response_branch_shape'],
    ['catastrophic_tail_is_not_hidden_plan', 'The catastrophic tail represents public risk and does not disclose a hidden plan.', 'hidden_visibility'],
    ['adaptive_value_uses_best_future_route', 'Adaptive value sums outcome probability times the best legal future route for that outcome.', 'adaptive_value'],
    ['committed_value_uses_identity_intersection', 'Committed value uses the best route whose identity is stable across all outcomes.', 'committed_value'],
    ['information_zero_at_exact_endpoints', 'Information value is zero only when the relevant probability is exactly zero or one.', 'information_endpoint'],
    ['information_requires_route_change', 'Information value is positive only when an observable result changes future route value.', 'information_route_change'],
  ],
  S5: [
    ['dot_has_scheduled_window', 'DOT value is limited to its scheduled effect window.', 'scheduled_effect'],
    ['hot_has_scheduled_window', 'HOT value is limited to its scheduled effect window.', 'scheduled_effect'],
    ['delayed_effect_has_expiry', 'Delayed effects expire at their declared expiry event.', 'expiry'],
    ['summon_has_birth_event', 'A summon enters the future pool only after its spawn event.', 'summon_lifecycle'],
    ['summon_stops_after_host_death', 'A summon route stops when its host death rule is reached.', 'summon_lifecycle'],
    ['expired_effect_has_no_consumer', 'An expired effect cannot be consumed by a later route.', 'expiry'],
    ['creation_needs_consumer', 'Creation value requires an eligible consumer within the remaining window.', 'creation_consumer'],
    ['item_value_is_inventory_fact', 'Item value is based on actual inventory creation and consumption facts.', 'inventory_fact'],
    ['equipment_value_is_windowed', 'Equipment value is conditioned on the active equipment window and consumer.', 'equipment_window'],
    ['long_window_stops_at_terminal', 'Long-window effects after the first terminal do not contribute value.', 'post_terminal_zero'],
  ],
  S6: [
    ['causal_state_owner_is_explicit', 'State deltas have explicit STATE_DELTA ownership.', 'causal_owner'],
    ['causal_action_pool_owner_is_explicit', 'Future route deltas have explicit ACTION_POOL_DELTA ownership.', 'causal_owner'],
    ['causal_terminal_owner_is_explicit', 'First terminal crossings have explicit TERMINAL_DELTA ownership.', 'causal_owner'],
    ['causal_sum_matches_goal', 'The sum of causal facts equals goal utility within 1e-6.', 'causal_reconciliation'],
    ['pareto_has_six_dimensions', 'Pareto uses exactly the six contracted dimensions.', 'pareto_dimensions'],
    ['hard_exclusions_precede_pareto', 'Hard exclusions remove a candidate before Pareto comparison.', 'hard_exclusion'],
    ['manual_lock_is_not_overridden', 'A legal PLAYER_LOCKED action is executed even when AI ranking differs.', 'manual_lock'],
    ['alternative_one_differs_structurally', 'Alternative one differs by action, target set or payment mode.', 'alternative_one'],
    ['alternative_two_maximizes_l1', 'Alternative two maximizes normalized L1 distance among remaining Pareto candidates.', 'alternative_two'],
    ['tie_break_uses_utf16_units', 'Complete ties use candidateId UTF-16 code-unit order.', 'utf16_sort'],
  ],
};

const assertions = Object.entries(assertionGroups).flatMap(([domain, items]) => items.map(([code, statement, rule], index) => ({
  schemaVersion: 'SemanticAssertionV1',
  assertionId: `${domain}-${String(index + 1).padStart(2, '0')}`,
  domain,
  title: code,
  classification: 'CONTRACT_BLOCKING',
  resolutionStatus: 'FROZEN',
  statement,
  executableCheck: rule,
  evidencePolicy: 'REFERENCE_EVALUATOR_ONLY_UNTIL_RUNTIME_IMPLEMENTATION',
})));

const componentDefinitions = [
  ['basic_hit', 'S3', 'STATE_DELTA', ['candidateIds', 'actorIds', 'targetUnitIds'], ['world', 'opportunity'], true, true],
  ['evasion', 'S3', 'STATE_DELTA', ['candidateIds', 'targetUnitIds', 'successProbabilities'], ['world', 'belief'], true, true],
  ['defense', 'S3', 'STATE_DELTA', ['candidateIds', 'targetUnitIds', 'directFactRanges'], ['world', 'opportunity'], true, true],
  ['counter', 'S3', 'ACTION_POOL_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity', 'belief'], true, true],
  ['hard_control', 'S3', 'ACTION_POOL_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['soft_control', 'S3', 'ACTION_POOL_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['heal', 'S3', 'STATE_DELTA', ['candidateIds', 'targetUnitIds', 'successProbabilities'], ['world', 'opportunity'], true, true],
  ['support_resource', 'S2', 'ACTION_POOL_DELTA', ['candidateIds', 'resourceCosts', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['pass', 'S2', 'ACTION_POOL_DELTA', ['candidateIds', 'opportunityRevision'], ['opportunity'], true, true],
  ['lost_opportunity', 'S2', 'NONE', ['candidateIds', 'opportunityRevision'], ['world', 'opportunity'], false, false],
  ['dot', 'S5', 'STATE_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['hot', 'S5', 'STATE_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['delayed_effect', 'S5', 'STATE_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['summon', 'S5', 'ACTION_POOL_DELTA', ['candidateIds', 'scheduledFactRanges', 'targetUnitIds'], ['world', 'opportunity'], true, true],
  ['creation', 'S5', 'ACTION_POOL_DELTA', ['candidateIds', 'scheduledFactRanges', 'targetUnitIds'], ['world', 'opportunity'], true, true],
  ['item', 'S5', 'ACTION_POOL_DELTA', ['candidateIds', 'resourceCosts', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['equipment', 'S5', 'ACTION_POOL_DELTA', ['candidateIds', 'scheduledFactRanges'], ['world', 'opportunity'], true, true],
  ['target_trajectory', 'S1', 'STATE_DELTA', ['candidateIds', 'targetUnitIds', 'directFactRanges'], ['world', 'opportunity'], true, true],
  ['response', 'S4', 'ACTION_POOL_DELTA', ['candidateIds', 'successProbabilities', 'scheduledFactRanges'], ['world', 'opportunity', 'belief'], true, true],
  ['information_observation', 'S4', 'NONE', ['candidateIds', 'successProbabilities'], ['belief', 'opportunity'], true, true],
  ['terminal', 'S1', 'TERMINAL_DELTA', ['candidateIds', 'targetUnitIds', 'directFactRanges'], ['world', 'opportunity'], true, true],
  ['causal_ownership', 'S6', 'NONE', ['candidateIds', 'directFactRanges', 'scheduledFactRanges'], ['world', 'opportunity'], true, false],
  ['pareto_selection', 'S6', 'NONE', ['candidateIds'], ['world', 'belief', 'opportunity'], true, true],
].map(([componentCode, semanticDomain, causalOwnerType, inputColumnCodes, dependencyKinds, contributesToGoal, contributesToPareto], index) => ({
  schemaVersion: 'KernelComponentDefinitionV1',
  componentCode,
  prototypeIndex: index + 1,
  semanticDomain,
  causalOwnerType,
  inputColumnCodes,
  dependencyKinds,
  contributesToGoal,
  contributesToPareto,
  materializerId: `reference_materialize_${componentCode}`,
}));

const candidate = ({
  candidateId,
  actionId,
  actionKind,
  targetSet = ['target-1'],
  paymentMode = 'FULL',
  state = 0,
  pool = 0,
  terminal = 0,
  overkill = 0,
  survival = 0,
  reserve = 0,
  tail = 0,
  hardExclusionCodes = [],
  legal = true,
  playerLocked = false,
  informationGroups = [],
  rawFacts = null,
  targetProfiles = null,
  objectiveContract = null,
}) => ({
  candidateId,
  actionId,
  actionKind,
  targetSet,
  paymentMode,
  legal,
  playerLocked,
  hardExclusionCodes,
  actorSide: 'PLAYER',
  targetProfiles: targetProfiles || (overkill > 0 ? [{ targetId: 'target-1', side: 'ENEMY', currentHpPP: 80 }] : []),
  objectiveContract: objectiveContract || (overkill > 0 ? {
    victory: {
      logic: 'ANY',
      conditions: [{ type: 'HP_RATIO_AT_OR_BELOW', threshold: 0.5, targetIds: ['target-1'], side: 'ENEMY' }],
    },
    defeat: { logic: 'ANY', conditions: [] },
  } : null),
  informationGroups,
  riskInputs: {
    actorMaxHp: 100,
    actorHp: Math.max(0, Math.min(100, Number(survival || 0))),
    actorOutcomeDeltas: tail < 0 ? [{ deltas: [tail] }] : [],
    shieldFacts: reserve > 0 ? [{ deltaHp: reserve, maxHp: 100, side: 'PLAYER' }] : [],
    actorSide: 'PLAYER',
  },
  rawFacts: rawFacts || [
    ...(state ? [{
      componentCode: 'S1_HEALTH',
      formula: 'HEALTH_PP',
      deltaHp: -(state + overkill),
      maxHp: 100,
      polarity: -1,
      sourceEventId: `${candidateId}:S1_HEALTH:event`,
      sourceFactId: `${candidateId}:S1_HEALTH:fact`,
      targetUnitId: 'target-1',
      sequence: 0,
    }] : []),
    ...(pool ? [{
      componentCode: 'S2_ROUTE',
      formula: 'ROUTE_DELTA',
      beforeRouteHEPP: 0,
      afterRouteHEPP: pool,
      applicationProbability: 1,
      polarity: 1,
      sourceEventId: `${candidateId}:S2_ROUTE:event`,
      sourceFactId: `${candidateId}:S2_ROUTE:fact`,
      targetUnitId: 'target-1',
      sequence: 1,
    }] : []),
    ...(terminal ? [{
      componentCode: 'S1_TERMINAL',
      formula: 'TERMINAL_OUTCOME',
      winProbability: terminal > 0 ? 1 : 0,
      lossProbability: terminal < 0 ? 1 : 0,
      drawProbability: terminal === 0 ? 1 : 0,
      sourceEventId: `${candidateId}:S1_TERMINAL:event`,
      sourceFactId: `${candidateId}:S1_TERMINAL:fact`,
      targetUnitId: 'target-1',
      sequence: 2,
    }] : []),
  ],
});

const info = (groupId, adaptiveValue, committedValue, outcomes = 2) => ({
  groupId,
  outcomes: adaptiveValue === committedValue
    ? Array.from({ length: outcomes }, (_, index) => ({
      outcomeId: `${groupId}:o${index + 1}`,
      probability: 1 / outcomes,
      futureCandidateRouteVector: {
        candidateIds: ['common-route'],
        beforeRouteHEPP: [0],
        afterRouteHEPP: [committedValue],
        applicationProbability: [1],
        polarity: [1],
      },
    }))
    : [
      {
        outcomeId: `${groupId}:o1`,
        probability: 0.5,
        futureCandidateRouteVector: {
          candidateIds: ['common-route', 'observed-route'],
          beforeRouteHEPP: [0, 0],
          afterRouteHEPP: [committedValue, Math.max(committedValue, 2 * adaptiveValue - committedValue)],
          applicationProbability: [1, 1],
          polarity: [1, 1],
        },
      },
      {
        outcomeId: `${groupId}:o2`,
        probability: 0.5,
        futureCandidateRouteVector: {
          candidateIds: ['common-route', 'alternate-route'],
          beforeRouteHEPP: [0, 0],
          afterRouteHEPP: [committedValue, 0],
          applicationProbability: [1, 1],
          polarity: [1, 1],
        },
      },
    ],
});

const refCase = ({ caseId, domain, mode = 'auto', phase, candidates, expectedSelectedCandidateId, playerLockedCandidateId = null, verification = {} }) => ({
  schemaVersion: 'KernelReferenceCaseV1',
  caseId,
  semanticDomain: domain,
  mode,
  phase,
  worldRevision: 1,
  beliefRevision: 1,
  opportunityRevision: 1,
  publicFields: ['visibleHpRatios', 'visibleStates', 'revealedAbilityIds', 'observableDeclarations'],
  candidates,
  playerLockedCandidateId,
  verification,
  expected: {
    selectedCandidateId: expectedSelectedCandidateId,
    causalTolerance: 1e-6,
  },
});

const cases = [
  refCase({ caseId: 'ref-s1-threshold-truncation', domain: 'S1', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'threshold-attack', actionId: 'attack', actionKind: 'ATTACK', state: 30, overkill: 45, survival: 5, tail: -5 }),
    candidate({ candidateId: 'threshold-defend', actionId: 'defend', actionKind: 'DEFEND', survival: 12, reserve: 4, tail: 2 }),
  ], expectedSelectedCandidateId: 'threshold-attack' }),
  refCase({ caseId: 'ref-s1-first-terminal', domain: 'S1', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'lethal-first', actionId: 'attack', actionKind: 'ATTACK', state: 60, terminal: 100, survival: 1, tail: -20 }),
    candidate({ candidateId: 'nonlethal-safe', actionId: 'defend', actionKind: 'DEFEND', state: 20, survival: 35, reserve: 8, tail: 15 }),
  ], expectedSelectedCandidateId: 'lethal-first' }),
  refCase({ caseId: 'ref-s1-any-all', domain: 'S1', phase: 'REACTION', candidates: [
    candidate({ candidateId: 'any-highest', actionId: 'heal', actionKind: 'HEAL', state: 40, survival: 28, tail: 18 }),
    candidate({ candidateId: 'all-bottleneck', actionId: 'attack', actionKind: 'ATTACK', state: 32, survival: 16, tail: 10 }),
  ], expectedSelectedCandidateId: 'any-highest' }),
  refCase({ caseId: 'ref-s2-opportunity-schedule', domain: 'S2', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'scheduled-control', actionId: 'control', actionKind: 'CONTROL', pool: 35, state: 8, tail: 9 }),
    candidate({ candidateId: 'direct-hit', actionId: 'attack', actionKind: 'ATTACK', state: 25, tail: 4 }),
  ], expectedSelectedCandidateId: 'scheduled-control' }),
  refCase({ caseId: 'ref-s2-pass-lost', domain: 'S2', phase: 'PASS', candidates: [
    candidate({ candidateId: 'active-pass', actionId: 'pass', actionKind: 'PASS_OPPORTUNITY', pool: 4, reserve: 15, tail: 8 }),
    candidate({ candidateId: 'lost-action', actionId: 'blocked', actionKind: 'LOST_OPPORTUNITY', hardExclusionCodes: ['LOST_OPPORTUNITY'], pool: 20 }),
    candidate({ candidateId: 'legal-attack', actionId: 'attack', actionKind: 'ATTACK', state: 18, tail: 2 }),
  ], expectedSelectedCandidateId: 'legal-attack' }),
  refCase({ caseId: 'ref-s2-resource-order', domain: 'S2', phase: 'COUNTER', candidates: [
    candidate({ candidateId: 'affordable-response', actionId: 'counter', actionKind: 'COUNTER', pool: 28, state: 5, reserve: 3 }),
    candidate({ candidateId: 'unaffordable-response', actionId: 'counter-expensive', actionKind: 'COUNTER', hardExclusionCodes: ['RESOURCE_UNAVAILABLE'], pool: 80 }),
  ], expectedSelectedCandidateId: 'affordable-response' }),
  refCase({ caseId: 'ref-s3-control-overlap', domain: 'S3', phase: 'REACTION', candidates: [
    candidate({ candidateId: 'control-route', actionId: 'control', actionKind: 'CONTROL', pool: 42, survival: 10, tail: 12 }),
    candidate({ candidateId: 'damage-route', actionId: 'attack', actionKind: 'ATTACK', state: 35, tail: 5 }),
  ], expectedSelectedCandidateId: 'control-route' }),
  refCase({ caseId: 'ref-s3-protect-critical', domain: 'S3', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'protect-ally', actionId: 'protect', actionKind: 'SUPPORT', pool: 62, survival: 50, tail: 30 }),
    candidate({ candidateId: 'focus-enemy', actionId: 'attack', actionKind: 'ATTACK', state: 55, tail: -18 }),
  ], expectedSelectedCandidateId: 'protect-ally' }),
  refCase({ caseId: 'ref-s3-dodge-counter', domain: 'S3', phase: 'COUNTER', candidates: [
    candidate({ candidateId: 'evade-window', actionId: 'evade', actionKind: 'EVADE', pool: 40, survival: 33, tail: 22 }),
    candidate({ candidateId: 'counter-shot', actionId: 'counter', actionKind: 'COUNTER', state: 28, pool: 5, tail: 3 }),
  ], expectedSelectedCandidateId: 'evade-window' }),
  refCase({ caseId: 'ref-s4-public-belief', domain: 'S4', phase: 'REACTION', candidates: [
    candidate({ candidateId: 'public-response', actionId: 'respond', actionKind: 'REACTION', pool: 24, survival: 12, tail: 8 }),
    candidate({ candidateId: 'hidden-read', actionId: 'omniscient', actionKind: 'REACTION', hardExclusionCodes: ['HIDDEN_INFORMATION'], pool: 99 }),
  ], expectedSelectedCandidateId: 'public-response' }),
  refCase({ caseId: 'ref-s4-information-positive', domain: 'S4', phase: 'REACTION', candidates: [
    candidate({ candidateId: 'observe-then-act', actionId: 'observe', actionKind: 'OBSERVE', state: 5, informationGroups: [info('target-check', 50, 20)], tail: 6 }),
    candidate({ candidateId: 'commit-now', actionId: 'attack', actionKind: 'ATTACK', state: 25, tail: 2 }),
  ], expectedSelectedCandidateId: 'observe-then-act' }),
  refCase({ caseId: 'ref-s4-information-zero', domain: 'S4', phase: 'REACTION', candidates: [
    candidate({ candidateId: 'redundant-observe', actionId: 'observe', actionKind: 'OBSERVE', state: 5, informationGroups: [info('same-route', 20, 20)], tail: 2 }),
    candidate({ candidateId: 'stable-attack', actionId: 'attack', actionKind: 'ATTACK', state: 22, tail: 5 }),
  ], expectedSelectedCandidateId: 'stable-attack' }),
  refCase({ caseId: 'ref-s5-dot-hot-expiry', domain: 'S5', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'dot-window', actionId: 'dot', actionKind: 'DOT', pool: 31, state: 4, tail: 7 }),
    candidate({ candidateId: 'expired-dot', actionId: 'old-dot', actionKind: 'DOT', hardExclusionCodes: ['EXPIRED'], pool: 50 }),
  ], expectedSelectedCandidateId: 'dot-window' }),
  refCase({ caseId: 'ref-s5-summon-host-death', domain: 'S5', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'summon-window', actionId: 'summon', actionKind: 'SUMMON', pool: 38, survival: 12, tail: 9 }),
    candidate({ candidateId: 'summon-after-host-death', actionId: 'summon-late', actionKind: 'SUMMON', hardExclusionCodes: ['HOST_DEAD'], pool: 70 }),
    candidate({ candidateId: 'direct-safe', actionId: 'attack', actionKind: 'ATTACK', state: 30, tail: 4 }),
  ], expectedSelectedCandidateId: 'summon-window' }),
  refCase({ caseId: 'ref-s5-creation-consumer', domain: 'S5', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'create-with-consumer', actionId: 'create', actionKind: 'CREATION', pool: 44, reserve: 6, tail: 10 }),
    candidate({ candidateId: 'create-without-consumer', actionId: 'create-empty', actionKind: 'CREATION', pool: 44, hardExclusionCodes: ['NO_CONSUMER'] }),
    candidate({ candidateId: 'direct-action', actionId: 'attack', actionKind: 'ATTACK', state: 34, tail: 4 }),
  ], expectedSelectedCandidateId: 'create-with-consumer' }),
  refCase({ caseId: 'ref-s6-causal-state-owner', domain: 'S6', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'state-owned', actionId: 'attack', actionKind: 'ATTACK', state: 25, pool: 4, terminal: 0 }),
    candidate({ candidateId: 'less-state', actionId: 'defend', actionKind: 'DEFEND', state: 10, survival: 8 }),
  ], expectedSelectedCandidateId: 'state-owned' }),
  refCase({ caseId: 'ref-s6-causal-action-owner', domain: 'S6', phase: 'COUNTER', candidates: [
    candidate({ candidateId: 'pool-owned', actionId: 'control', actionKind: 'CONTROL', pool: 36, survival: 5 }),
    candidate({ candidateId: 'state-only', actionId: 'attack', actionKind: 'ATTACK', state: 30, survival: 2 }),
  ], expectedSelectedCandidateId: 'pool-owned' }),
  refCase({ caseId: 'ref-s6-pareto-hard-exclusion', domain: 'S6', phase: 'ACTIVE', candidates: [
    candidate({ candidateId: 'invalid-high-value', actionId: 'attack', actionKind: 'ATTACK', state: 100, hardExclusionCodes: ['MECHANICAL_INVALID'] }),
    candidate({ candidateId: 'valid-safe', actionId: 'defend', actionKind: 'DEFEND', state: 28, survival: 35, reserve: 10, tail: 20 }),
  ], expectedSelectedCandidateId: 'valid-safe' }),
  refCase({ caseId: 'ref-manual-locked', domain: 'S6', mode: 'manual', phase: 'ACTIVE', playerLockedCandidateId: 'player-choice', candidates: [
    candidate({ candidateId: 'player-choice', actionId: 'defend', actionKind: 'DEFEND', state: 5, survival: 8, playerLocked: true }),
    candidate({ candidateId: 'ai-preferred', actionId: 'attack', actionKind: 'ATTACK', state: 80, terminal: 100 }),
  ], expectedSelectedCandidateId: 'player-choice' }),
  refCase({ caseId: 'ref-lost-opportunity', domain: 'S2', phase: 'LOST', candidates: [
    candidate({ candidateId: 'lost-fact', actionId: 'blocked', actionKind: 'LOST_OPPORTUNITY', hardExclusionCodes: ['LOST_OPPORTUNITY'], pool: 20 }),
    candidate({ candidateId: 'pass-real', actionId: 'pass', actionKind: 'PASS_OPPORTUNITY', reserve: 12, tail: 4 }),
    candidate({ candidateId: 'fallback', actionId: 'attack', actionKind: 'ATTACK', state: 15, tail: 3 }),
  ], expectedSelectedCandidateId: 'fallback' }),
];

const healthFact = (candidateId, targetUnitId, deltaHp, maxHp, sequence, componentCode = 'S1_HEALTH') => ({
  componentCode,
  formula: 'HEALTH_PP',
  deltaHp,
  maxHp,
  polarity: deltaHp <= 0 ? -1 : 1,
  sourceEventId: `${candidateId}:health:${sequence}:event`,
  sourceFactId: `${candidateId}:health:${sequence}:fact`,
  targetUnitId,
  sequence,
});

const routeFact = (candidateId, componentCode, amountHEPP, sequence) => ({
  componentCode,
  formula: 'ROUTE_DELTA',
  beforeRouteHEPP: 0,
  afterRouteHEPP: amountHEPP,
  applicationProbability: 1,
  polarity: 1,
  sourceEventId: `${candidateId}:route:${sequence}:event`,
  sourceFactId: `${candidateId}:route:${sequence}:fact`,
  targetUnitId: 'target-1',
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

const s1AnyAll = cases.find(item => item.caseId === 'ref-s1-any-all');
const objectiveForScope = scope => ({
  victory: {
    logic: 'ANY',
    conditions: [{
      type: 'HP_RATIO_AT_OR_BELOW',
      threshold: 0.5,
      targetIds: ['target-1', 'target-2'],
      side: 'ENEMY',
      scope,
    }],
  },
  defeat: { logic: 'ANY', conditions: [] },
});
const twoTargetProfiles = [
  { targetId: 'target-1', side: 'ENEMY', currentHpPP: 80 },
  { targetId: 'target-2', side: 'ENEMY', currentHpPP: 80 },
];
const twoTargetHealthFacts = candidateId => [
  healthFact(candidateId, 'target-1', -200, 2000, 0),
  healthFact(candidateId, 'target-2', -300, 1000, 1),
];
Object.assign(s1AnyAll.candidates[0], {
  targetProfiles: twoTargetProfiles,
  objectiveContract: objectiveForScope('ANY'),
  rawFacts: twoTargetHealthFacts('any-highest'),
  riskInputs: { actorMaxHp: 100, actorHp: 0, actorOutcomeDeltas: [], shieldFacts: [], actorSide: 'PLAYER' },
});
Object.assign(s1AnyAll.candidates[1], {
  targetProfiles: twoTargetProfiles,
  objectiveContract: objectiveForScope('ALL'),
  rawFacts: twoTargetHealthFacts('all-bottleneck'),
  riskInputs: { actorMaxHp: 100, actorHp: 0, actorOutcomeDeltas: [], shieldFacts: [], actorSide: 'PLAYER' },
});

const firstTerminal = cases.find(item => item.caseId === 'ref-s1-first-terminal');
Object.assign(firstTerminal.candidates[0], {
  rawFacts: [
    terminalFact('lethal-first', 'WIN', 0),
    healthFact('lethal-first', 'target-1', -80, 100, 1),
    routeFact('lethal-first', 'S2_ROUTE', 40, 2),
    healthFact('lethal-first', 'target-1', -20, 100, 3, 'S5_DOT'),
  ],
});
firstTerminal.candidates.push(
  candidate({
    candidateId: 'terminal-failure',
    actionId: 'withdraw-failure',
    actionKind: 'WITHDRAW',
    rawFacts: [terminalFact('terminal-failure', 'LOSS')],
    riskInputs: { actorMaxHp: 100, actorHp: 0, actorOutcomeDeltas: [], shieldFacts: [], actorSide: 'PLAYER' },
  }),
  candidate({
    candidateId: 'terminal-draw',
    actionId: 'stalemate',
    actionKind: 'PASS_OPPORTUNITY',
    rawFacts: [terminalFact('terminal-draw', 'DRAW')],
    riskInputs: { actorMaxHp: 100, actorHp: 0, actorOutcomeDeltas: [], shieldFacts: [], actorSide: 'PLAYER' },
  }),
);

const dotWindow = cases.find(item => item.caseId === 'ref-s5-dot-hot-expiry');
Object.assign(dotWindow.candidates[0], {
  rawFacts: [
    healthFact('dot-window', 'target-1', -12, 100, 0, 'S5_DOT'),
    healthFact('dot-window', 'target-1', 6, 100, 1, 'S5_HOT'),
    routeFact('dot-window', 'S5_DELAYED_EFFECT', 15, 2),
  ],
});
const summonWindow = cases.find(item => item.caseId === 'ref-s5-summon-host-death');
Object.assign(summonWindow.candidates[0], {
  rawFacts: [routeFact('summon-window', 'S5_SUMMON_WINDOW', 38, 0)],
});
const creationConsumer = cases.find(item => item.caseId === 'ref-s5-creation-consumer');
Object.assign(creationConsumer.candidates[0], {
  rawFacts: [routeFact('create-with-consumer', 'S5_CREATION_CONSUMER', 44, 0)],
});
const controlOverlap = cases.find(item => item.caseId === 'ref-s3-control-overlap');
Object.assign(controlOverlap.candidates[0], {
  rawFacts: [routeFact('control-route', 'S3_HARD_CONTROL', 42, 0)],
});
const protectCritical = cases.find(item => item.caseId === 'ref-s3-protect-critical');
Object.assign(protectCritical.candidates[0], {
  rawFacts: [
    healthFact('protect-ally', 'ally-critical', 50, 100, 0, 'S3_DEFENSE'),
    routeFact('protect-ally', 'S3_SUPPORT_RESOURCE', 12, 1),
  ],
});
const dodgeCounter = cases.find(item => item.caseId === 'ref-s3-dodge-counter');
Object.assign(dodgeCounter.candidates[0], {
  rawFacts: [
    healthFact('evade-window', 'target-1', 30, 100, 0, 'S3_EVASION'),
    routeFact('evade-window', 'S3_COUNTER', 10, 1),
  ],
});

const verificationByCase = {
  'ref-s2-opportunity-schedule': {
    opportunityFacts: [
      { kind: 'CONCRETE_OPPORTUNITY', formalOpportunity: true, responseOnly: false },
      { kind: 'SCHEDULE_DESCRIPTOR', formalOpportunity: false, responseOnly: false },
      { kind: 'PROJECTED_RESPONSE', formalOpportunity: false, responseOnly: true },
    ],
  },
  'ref-s2-pass-lost': {
    passCandidateId: 'active-pass',
    lostCandidateId: 'lost-action',
    noOpCandidateId: 'NO_OP',
  },
  'ref-s2-resource-order': {
    resourceTimeline: {
      events: [
        { eventId: 'e3', round: 1, opportunitySequence: 2, actionSequence: 1, phasePriority: 0, effectSequence: 0, ownerType: 'PAYMENT', sourceFactId: 'fact-e3' },
        { eventId: 'e1', round: 1, opportunitySequence: 1, actionSequence: 2, phasePriority: 0, effectSequence: 0, ownerType: 'PAYMENT', sourceFactId: 'fact-e1' },
        { eventId: 'e2', round: 1, opportunitySequence: 1, actionSequence: 2, phasePriority: 1, effectSequence: 0, ownerType: 'REFUND', sourceFactId: 'fact-e2' },
      ],
      expectedOrder: ['e1', 'e2', 'e3'],
    },
  },
  'ref-s3-control-overlap': {
    legalRouteIds: ['control-route', 'damage-route'],
    behaviorPoolCandidateIds: ['control-route', 'damage-route'],
    affectedUnitIds: ['ally-critical', 'enemy-controller'],
    invalidatedUnitIds: ['ally-critical', 'enemy-controller'],
    futureRoute: { before: 0, after: 42 },
  },
  'ref-s3-protect-critical': {
    actualAbsorption: { preventedDamage: 50, stateDeltaHEPP: 50 },
    supportConsumer: { affectedUnitId: 'ally-critical', observable: true },
    healConditioning: { currentHpPP: 20, thresholdPP: 50, terminal: false },
  },
  'ref-s3-dodge-counter': {
    probabilityBranch: { successProbability: 0.75, branches: [0.75, 0.25], routeChanges: true },
    responseFact: { kind: 'CONCRETE_OPPORTUNITY', responseProbability: 0.4, sourceFactId: 'counter-response-fact' },
  },
  'ref-s4-public-belief': {
    publicEvidence: ['visibleHpRatios', 'publicStates', 'revealedAbilityIds', 'observableDeclarations'],
    hiddenEvidence: ['hiddenExactHp', 'hiddenResistance', 'hiddenInventory', 'hiddenAbility', 'unobservedPosterior'],
    responseBranches: { publicEvidenceBranches: 2, catastrophicTail: 1, hiddenPlanFields: 0 },
  },
  'ref-s4-information-positive': {
    expectedInformation: { adaptive: 50, committed: 20, value: 30 },
    multipleGroupValues: [30, 8],
    endpointProbes: [0, 1],
  },
  'ref-s4-information-zero': {
    endpointProbes: [0, 1],
  },
  'ref-s5-dot-hot-expiry': {
    scheduledEffects: [
      { componentCode: 'S5_DOT', startsAt: 1, expiresAt: 3, observedAt: 2, contributes: true },
      { componentCode: 'S5_HOT', startsAt: 1, expiresAt: 3, observedAt: 4, contributes: false },
      { componentCode: 'S5_DELAYED_EFFECT', startsAt: 2, expiresAt: 4, observedAt: 3, contributes: true },
    ],
  },
  'ref-s5-summon-host-death': {
    summonLifecycle: { birthEvent: 'spawn-1', hostDeathEvent: 'death-1', routeStopsAt: 'death-1', lateCandidateId: 'summon-after-host-death' },
  },
  'ref-s5-creation-consumer': {
    creationConsumer: { producerCandidateId: 'create-with-consumer', consumerId: 'ally-consumer', observable: true, windowOpen: true },
    inventoryFact: { created: 1, consumed: 1, hiddenSourceRead: false },
    equipmentWindow: { startsAt: 1, expiresAt: 3, consumerId: 'ally-consumer', observedAt: 2 },
  },
  'ref-s6-causal-state-owner': {
    expectedOwners: ['STATE_DELTA', 'ACTION_POOL_DELTA'],
  },
  'ref-s6-causal-action-owner': {
    expectedOwners: ['STATE_DELTA', 'ACTION_POOL_DELTA'],
  },
  'ref-s6-pareto-hard-exclusion': {
    legalBeforePareto: ['valid-safe'],
    excludedBeforePareto: ['invalid-high-value'],
  },
};
Object.entries(verificationByCase).forEach(([caseId, verification]) => {
  Object.assign(cases.find(item => item.caseId === caseId).verification, verification);
});

const planningContract = {
  schemaVersion: 'BehaviorPlanningContractV1',
  contractId: 'R83-RC6-M1-FROZEN-2026-08-04',
  status: 'FROZEN',
  authority: {
    order: [
      'ORIGINAL_R8_3_SPEC',
      'USER_APPROVED_RC6_V24',
      'EXPLICIT_SUPERSEDES_BEHAVIOR_SEMANTIC_DECISION_V2',
      'BEHAVIOR_PLANNING_CONTRACT_V1',
      'BEHAVIOR_ORACLE_V2',
      'IMPLEMENTATION_AND_HISTORICAL_REPORTS_AS_EVIDENCE_ONLY',
    ],
    supersedes: [
      'r83_rc6_behavior_planning_contract_current_2026-08-01.json',
      'r83_rc2_behavior_oracle_v2_draft.json',
    ],
    ambiguousRule: 'SPEC_AMBIGUOUS_WHEN_PUBLIC_COUNTEREXAMPLES_CANNOT_DISTINGUISH_RULES',
  },
  sourceHashes: historicalProductionSourceHashes,
  sourceHashPolicy: {
    productionFilesMutableAfterM1: true,
    productionHashesAreHistoricalSnapshots: true,
    m1GatePrerequisite: 'REFERENCE_INPUTS_AND_TOOLS_ONLY',
  },
  providerRoles: {
    r8: 'production_provider_and_small_mechanical_reference_only',
    r9: 'historical_handwritten_executor_evidence_only',
    'r9v2-shadow': 'historical_experimental_evidence_only',
    r9v2: 'target_provider_not_registered_before_M7',
  },
  modes: {
    auto: 'provider_handles_unlocked_opportunities_only',
    manual: 'legal_player_locked_action_executes_and_ai_cannot_override',
    free_narrative: 'no_action_queue_draft_ledger_report_snapshot_or_provider_call',
  },
  scalarContract: {
    goalUtilityDeltaHEPP: 'neumaier(stateDeltaTotal + actionPoolDeltaTotal + terminalDeltaTotal)',
    objectiveUtilityHEPP: 'goalUtilityDeltaHEPP + informationValueHEPP',
    causalReconciliation: { tolerance: 1e-6, ownerTypes: ['STATE_DELTA', 'ACTION_POOL_DELTA', 'TERMINAL_DELTA'] },
    terminal: { victory: 100, failure: -100, draw: 0, firstOnly: true, postTerminalValue: 0 },
    threshold: { lifeBasis: 'target_base_max_health_percentage', countOnlyToThreshold: true, overkillField: 'discardedOverkillPP' },
    information: {
      adaptive: 'sum(outcomeProbability * bestLegalFutureRouteValue)',
      committed: 'best_expected_value_in_stable_candidate_identity_intersection',
      value: 'max(0, adaptiveValue - committedValue)',
      stableIntersectionEmptyUses: 'NO_OP_ONLY',
      zeroOnlyAtExactProbability: [0, 1],
      multipleObservationGroups: 'maximum_single_group_value_without_combining_correlated_groups',
    },
  },
  pareto: {
    dimensions: [
      { code: 'objectiveUtilityHEPP', direction: 'MAXIMIZE' },
      { code: 'worstTailUtilityHEPP', direction: 'MAXIMIZE' },
      { code: 'survivalUtilityHEPP', direction: 'MAXIMIZE' },
      { code: 'assetReserveHEPP', direction: 'MAXIMIZE' },
      { code: 'informationValueHEPP', direction: 'MAXIMIZE' },
      { code: 'discardedOverkillPP', direction: 'MINIMIZE' },
    ],
    tieBreak: 'candidateId_UTF16_CODE_UNIT_ASCENDING',
    hardExclusionsBeforeComparison: true,
  },
  alternatives: {
    first: 'first_formal_rank_candidate_with_different_action_target_set_or_payment_mode',
    second: 'maximum_normalized_L1_distance_among_remaining_pareto_candidates',
    zeroSpanContribution: 0,
    nonFinite: 'FATAL',
  },
  visibility: {
    allowed: ['visibleHpRatios', 'publicStates', 'observableDeclarations', 'revealedAbilityIds', 'observableResults'],
    forbidden: ['hiddenExactHp', 'hiddenResistance', 'hiddenInventory', 'hiddenAbility', 'unobservedPosterior'],
  },
  semanticDomains: Object.fromEntries(Object.entries(domainTitles).map(([id, title]) => [id, { title, status: 'FROZEN' }])),
  assertionCount: assertions.length,
  prototypeCount: componentDefinitions.length,
  referenceCaseCount: cases.length,
};

const oracleSourcePath = 'tools/evidence/r8/r83_rc2_behavior_oracle_v2_draft.json';
const oracleSource = JSON.parse(fs.readFileSync(path.join(repoRoot, oracleSourcePath), 'utf8'));
const oracleSourceHash = sha256(fs.readFileSync(path.join(repoRoot, oracleSourcePath)));
const fixtureManifestPath = 'tools/rc6/cases/BehaviorOracleFixtureManifestV1.json';
const existingFixtureManifest = fs.existsSync(path.join(repoRoot, fixtureManifestPath))
  ? JSON.parse(fs.readFileSync(path.join(repoRoot, fixtureManifestPath), 'utf8'))
  : null;
const fixtureByOracleId = new Map(
  (existingFixtureManifest?.fixtures || []).map(fixture => [fixture.oracleId, fixture]),
);
const fixtureBindingsReady = existingFixtureManifest?.status === 'FROZEN_EXECUTABLE_FIXTURES' &&
  existingFixtureManifest?.count === oracleSource.oracles.length &&
  fixtureByOracleId.size === oracleSource.oracles.length;
const domainForCategory = category => {
  if (category === 'c15_information') return 'S4';
  if (category === 'c16_objectives') return 'S1';
  if (category === 'x01_resource_recovery_timing') return 'S2';
  if (category === 'x02_slow_axis_duration' || category === 'x03_defense_multihit_reflect') return 'S3';
  if (category === 'x04_control_ally_dot' || category === 'x05_summon_host_deadline' || category === 'x06_antiheal_food_crisis') return 'S5';
  if (category === 'c13_dot' || category === 'c14_summon') return 'S5';
  if (category === 'c08_resource_block' || category === 'c09_resource_no_consumer' || category === 'c10_resource_consumers' || category === 'c11_resource_recovery') return 'S2';
  return 'S3';
};
const oracleIndex = {
  schemaVersion: 'BehaviorOracleV2IndexV1',
  status: 'FROZEN_EXECUTABLE_FIXTURE_INDEX',
  sourcePath: oracleSourcePath,
  sourceHash: oracleSourceHash,
  count: oracleSource.oracles.length,
  oracleIndexBindingHash: null,
  fixtureManifestPath,
  fixtureManifestHash: fixtureBindingsReady ? sha256(JSON.stringify(existingFixtureManifest)) : null,
  oracles: oracleSource.oracles.map(oracle => ({
    schemaVersion: 'BehaviorOracleV2',
    oracleId: oracle.oracleId,
    caseId: oracle.caseId,
    semanticDomain: domainForCategory(oracle.semanticDomain),
    historicalSourceStatus: 'INPUT_ONLY_OLD_DRAFT_NOT_SEMANTIC_AUTHORITY',
    executableStatus: fixtureBindingsReady ? 'EXECUTABLE_FIXTURE_BOUND' : 'EVIDENCE_GAP',
    fixtureStatus: fixtureBindingsReady ? 'EXECUTABLE' : 'UNBOUND',
    fixtureId: fixtureByOracleId.get(oracle.oracleId)?.fixtureId || null,
    executableChecks: ['candidate_set_shape', 'finite_numeric_contract', 'causal_reconciliation', 'domain_contract'],
    sourceAssertionsRetainedAs: 'CASE_EXPECTATION_UNTIL_RUNTIME_BINDING',
  })),
};
oracleIndex.oracleIndexBindingHash = oracleIndexBindingHash(oracleIndex);

writeJson(path.join(contractsDir, 'BehaviorPlanningContractV1.json'), planningContract);
writeJson(path.join(contractsDir, 'SemanticAssertionsV1.json'), {
  schemaVersion: 'SemanticAssertionCollectionV1',
  contractId: planningContract.contractId,
  count: assertions.length,
  assertions,
});
writeJson(path.join(contractsDir, 'KernelComponentRegistryV1.json'), {
  schemaVersion: 'KernelComponentRegistryV1',
  contractId: planningContract.contractId,
  count: componentDefinitions.length,
  components: componentDefinitions,
});
writeJson(path.join(contractsDir, 'SelectionPolicyV1.json'), {
  schemaVersion: 'SelectionPolicyV1',
  policyId: 'R83-RC6-SELECTION-POLICY-2026-08-04',
  status: 'FROZEN',
  hardExclusionOrder: 'BEFORE_PARETO',
  paretoDimensions: planningContract.pareto.dimensions,
  candidateTieBreak: 'candidateId_UTF16_CODE_UNIT_ASCENDING',
  manualRule: 'LEGAL_PLAYER_LOCKED_EXECUTES_WITHOUT_AI_OVERRIDE',
  alternativeRules: planningContract.alternatives,
  noTopK: true,
  noWallClockBudget: true,
});
writeJson(path.join(casesDir, 'KernelReferenceCasesV1.json'), {
  schemaVersion: 'KernelReferenceCaseCollectionV1',
  contractId: planningContract.contractId,
  count: cases.length,
  cases,
});
writeJson(path.join(casesDir, 'BehaviorOracleV2IndexV1.json'), oracleIndex);
writeJson(path.join(contractsDir, 'M1FixtureManifestV1.json'), {
  schemaVersion: 'M1FixtureManifestV1',
  contractId: planningContract.contractId,
  fixtureManifestHash: fixtureBindingsReady ? sha256(JSON.stringify(existingFixtureManifest)) : null,
  historicalProductionSourceHashes,
  sourceHashPolicy: {
    productionFilesMutableAfterM1: true,
    productionHashesAreHistoricalSnapshots: true,
    m1GatePrerequisite: 'REFERENCE_INPUTS_AND_TOOLS_ONLY',
  },
  generatedFiles: [
    'tools/rc6/contracts/BehaviorPlanningContractV1.json',
    'tools/rc6/contracts/SemanticAssertionsV1.json',
    'tools/rc6/contracts/KernelComponentRegistryV1.json',
    'tools/rc6/contracts/SelectionPolicyV1.json',
    'tools/rc6/cases/KernelReferenceCasesV1.json',
    'tools/rc6/cases/BehaviorOracleV2IndexV1.json',
    'tools/rc6/contracts/BehaviorPlanningContractV1.schema.json',
    'tools/rc6/contracts/SemanticAssertionV1.schema.json',
    'tools/rc6/contracts/KernelComponentDefinitionV1.schema.json',
    'tools/rc6/contracts/KernelReferenceCaseV1.schema.json',
    'tools/rc6/contracts/BehaviorOracleV2IndexV1.schema.json',
    'tools/rc6/contracts/BehaviorOracleFixtureV1.schema.json',
    'tools/rc6/cases/BehaviorOracleFixtureManifestV1.json',
  ],
  counts: { assertions: assertions.length, prototypes: componentDefinitions.length, referenceCases: cases.length, oracles: oracleSource.oracles.length },
  oracleIndexBindingHash: oracleIndex.oracleIndexBindingHash,
  historicalInputs: [{ path: oracleSourcePath, sha256: oracleSourceHash }],
});

const schemas = {
  BehaviorPlanningContractV1: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'BehaviorPlanningContractV1.schema.json',
    type: 'object',
    required: ['schemaVersion', 'contractId', 'status', 'authority', 'sourceHashes', 'scalarContract', 'pareto'],
    properties: { schemaVersion: { const: 'BehaviorPlanningContractV1' }, contractId: { type: 'string' }, status: { const: 'FROZEN' }, authority: { type: 'object' }, sourceHashes: { type: 'object' }, scalarContract: { type: 'object' }, pareto: { type: 'object' } },
    additionalProperties: true,
  },
  SemanticAssertionV1: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'SemanticAssertionV1.schema.json',
    type: 'object',
    required: ['schemaVersion', 'assertionId', 'domain', 'statement', 'executableCheck', 'resolutionStatus'],
    properties: { schemaVersion: { const: 'SemanticAssertionV1' }, assertionId: { type: 'string' }, domain: { enum: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] }, statement: { type: 'string' }, executableCheck: { type: 'string' }, resolutionStatus: { const: 'FROZEN' } },
    additionalProperties: true,
  },
  KernelComponentDefinitionV1: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'KernelComponentDefinitionV1.schema.json',
    type: 'object',
    required: ['schemaVersion', 'componentCode', 'semanticDomain', 'causalOwnerType', 'inputColumnCodes', 'dependencyKinds', 'materializerId'],
    properties: { schemaVersion: { const: 'KernelComponentDefinitionV1' }, componentCode: { type: 'string' }, semanticDomain: { enum: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] }, causalOwnerType: { enum: ['STATE_DELTA', 'ACTION_POOL_DELTA', 'TERMINAL_DELTA', 'NONE'] }, inputColumnCodes: { type: 'array' }, dependencyKinds: { type: 'array' }, materializerId: { type: 'string' } },
    additionalProperties: true,
  },
  KernelReferenceCaseV1: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'KernelReferenceCaseV1.schema.json',
    type: 'object',
    required: ['schemaVersion', 'caseId', 'semanticDomain', 'mode', 'phase', 'candidates', 'expected'],
    properties: { schemaVersion: { const: 'KernelReferenceCaseV1' }, caseId: { type: 'string' }, semanticDomain: { enum: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] }, mode: { enum: ['auto', 'manual'] }, phase: { enum: ['ACTIVE', 'REACTION', 'COUNTER', 'PASS', 'LOST'] }, candidates: { type: 'array', minItems: 1 }, expected: { type: 'object' } },
    additionalProperties: true,
  },
  BehaviorOracleV2IndexV1: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'BehaviorOracleV2IndexV1.schema.json',
    type: 'object',
    required: ['schemaVersion', 'status', 'sourcePath', 'sourceHash', 'count', 'oracles'],
  properties: { schemaVersion: { const: 'BehaviorOracleV2IndexV1' }, status: { const: 'FROZEN_EXECUTABLE_FIXTURE_INDEX' }, sourcePath: { type: 'string' }, sourceHash: { type: 'string', minLength: 64, maxLength: 64 }, count: { const: 54 }, oracles: { type: 'array', minItems: 54, maxItems: 54 } },
    additionalProperties: true,
  },
};
for (const [name, schema] of Object.entries(schemas)) writeJson(path.join(contractsDir, `${name}.schema.json`), schema);
process.stdout.write(JSON.stringify({
  contractId: planningContract.contractId,
  assertions: assertions.length,
  prototypes: componentDefinitions.length,
  referenceCases: cases.length,
  oracles: oracleSource.oracles.length,
}, null, 2));

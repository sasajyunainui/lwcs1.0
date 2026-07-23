import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const artifactPath = path.join(repoRoot, 'artifacts', 'r83_phase9_batch.json');
const manifestPath = path.join(toolDir, 'evidence', 'r8', 'r75_real_case_manifest.json');
const providers = Object.freeze(['r74-next-baseline', 'r8-shadow']);
const fullBattleTimeoutMs = 180000;
const workerConcurrency = Math.max(
  1,
  Math.min(
    Number.parseInt(process.env.BATTLE_R8_PHASE9_WORKERS || '2', 10) || 2,
    4,
  ),
);
const mode = process.argv.includes('--first-actions-only')
  ? 'first-actions'
  : process.argv.includes('--full-battles-only')
    ? 'full-battles'
    : 'all';

function makeNode() {
  return {
    style: {},
    dataset: {},
    isConnected: true,
    innerHTML: '',
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

function createSandbox() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    Math,
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
    process: { env: process.env },
    navigator: { userAgent: 'node' },
    location: { href: 'http://localhost/' },
    innerWidth: 1440,
    innerHeight: 900,
    getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() {
      this.observe = () => {};
      this.disconnect = () => {};
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init?.detail;
    },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1440, clientHeight: 900 },
    createElement: () => makeNode(),
    body: { appendChild() {} },
    head: { appendChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function loadRuntime() {
  const sandbox = createSandbox();
  for (const fileName of [
    'CharacterLibrary.js',
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
  return sandbox;
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalJsonValue(value[key])]),
  );
}

function sha256(value) {
  return crypto.createHash('sha256')
    .update(
      typeof value === 'string'
        ? value
        : JSON.stringify(canonicalJsonValue(value)),
    )
    .digest('hex');
}

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function decisionSummary(result = {}) {
  const audit = result?.decisionAudit || {};
  const selected = audit?.selected || {};
  const candidateAudit = Array.isArray(audit?.candidateAudit)
    ? audit.candidateAudit
    : Array.isArray(audit?.scoreAudit)
      ? audit.scoreAudit
      : [];
  const rejectionCounts = candidateAudit.reduce((counts, candidate) => {
    const code = String(candidate?.rejectionCode || '').trim() || 'VIABLE';
    counts[code] = Number(counts[code] || 0) + 1;
    return counts;
  }, {});
  return {
    providerId: result?.providerId || '',
    requestHash: result?.requestHash || '',
    selectedCandidateId: result?.selectedCandidateId || selected?.candidateId || '',
    selectedActionKind: result?.selectedDeclaration?.actionKind || selected?.actionKind || '',
    selectedActionName:
      selected?.actionName ||
      result?.selectedDeclaration?.skill?.name ||
      result?.selectedDeclaration?.skill?.魂技名 ||
      result?.selectedDeclaration?.actionKind ||
      '',
    targetIds: plain(result?.selectedDeclaration?.targetIds || selected?.targetIds || []),
    objectiveUtilityHEPP: Number(
      selected?.objectiveUtilityHEPP ??
      selected?.objectiveUtility ??
      0,
    ),
    normalizedUtility: Number(selected?.normalizedUtility || 0),
    candidateCount: Number(audit?.candidateCount || audit?.candidateAudit?.length || 0),
    paretoCount: Number(audit?.paretoCount || 0),
    selectionMode: String(selected?.selectionMode || audit?.decisionProfile?.selectionMode || ''),
    rejectionCode: String(selected?.rejectionCode || ''),
    primaryRouteKey: String(selected?.primaryRoute?.routeKey || selected?.route?.routeKey || ''),
    backupRouteKey: String(selected?.backupRoute?.routeKey || ''),
    causalFactCount: Array.isArray(selected?.causalValueFacts)
      ? selected.causalValueFacts.length
      : 0,
    candidateAuditHash: sha256(candidateAudit),
    rejectionCounts,
    candidateValueSummary: candidateAudit.map(candidate => ({
      candidateId: String(candidate?.candidateId || ''),
      actionKind: String(candidate?.actionKind || candidate?.declaration?.actionKind || ''),
      objectiveUtilityHEPP: Number(
        candidate?.objectiveUtilityHEPP ??
        candidate?.objectiveUtility ??
        0
      ),
      directTrajectoryHEPP: Number(candidate?.goalProjection?.directTrajectoryHEPP || 0),
      actionPoolHEPP: Number(candidate?.goalProjection?.actionPoolHEPP || 0),
      informationValueHEPP: Number(candidate?.vector?.informationValueHEPP || 0),
      discardedOverkillPP: Number(candidate?.vector?.discardedOverkillPP || 0),
      terminalStatus: String(candidate?.goalProjection?.terminal?.status || ''),
      terminalProbability: Number(
        candidate?.goalProjection?.terminal?.terminalProbability || 0
      ),
      healthTrajectoryCount: Array.isArray(candidate?.goalProjection?.healthTrajectory)
        ? candidate.goalProjection.healthTrajectory.length
        : 0,
      teamMarginalTrajectoryCount: Array.isArray(
        candidate?.goalProjection?.teamMarginalTrajectory
      )
        ? candidate.goalProjection.teamMarginalTrajectory.length
        : 0,
      healthTrajectorySummary: (candidate?.goalProjection?.healthTrajectory || []).map(
        trajectory => ({
          targetId: String(trajectory?.targetId || ''),
          healthDeltaPP: Number(trajectory?.healthDeltaPP || 0),
          actorBenefitPP: Number(trajectory?.actorBenefitPP || 0),
          objectiveMarginalHealthDeltaPP: Number(
            trajectory?.objectiveMarginalHealthDeltaPP ??
            trajectory?.healthDeltaPP ??
            0
          ),
          objectiveMarginalActorBenefitPP: Number(
            trajectory?.objectiveMarginalActorBenefitPP ??
            trajectory?.actorBenefitPP ??
            0
          ),
          teamMarginalConsumedPP: Number(trajectory?.teamMarginalConsumedPP || 0),
        })
      ),
      vector: {
        objectiveUtilityHEPP: Number(
          candidate?.vector?.objectiveUtilityHEPP ??
          candidate?.objectiveUtilityHEPP ??
          candidate?.objectiveUtility ??
          0
        ),
        informationValueHEPP: Number(candidate?.vector?.informationValueHEPP || 0),
        assetReserve: Number(candidate?.vector?.assetReserve || 0),
        survivalLowerBound: Number(candidate?.vector?.survivalLowerBound || 0),
        worstTailLossHEPP: Number(candidate?.vector?.worstTailLossHEPP || 0),
        discardedOverkillPP: Number(candidate?.vector?.discardedOverkillPP || 0),
      },
      classification: String(candidate?.classification || '').trim(),
      dominatedBy: String(candidate?.dominatedBy || '').trim(),
      pareto: candidate?.rejectionCode !== 'DOMINATED',
      rejectionCode: String(candidate?.rejectionCode || ''),
    })),
  };
}

function queueHeadCandidateRecord(
  caseDefinition,
  runtime,
  decision,
  preview,
  options = {},
) {
  const traceStages = process.env.BATTLE_R8_PHASE9_STAGE_TRACE === '1';
  const traceStage = stage => {
    if (traceStages) process.stderr.write(`[phase9:stage] ${stage}\n`);
  };
  traceStage('clone-world');
  const world = structuredClone(caseDefinition.combatData);
  traceStage('build-action-queue');
  const queue = runtime.buildActionQueue(world);
  const firstEntry = queue[0];
  if (!firstEntry?.char) throw new Error('PHASE9_FIRST_ACTOR_MISSING');
  const actorId = String(preview.unitId(firstEntry.char) || '').trim();
  const pendingNaturalUnits = queue.map(entry => entry.char).filter(Boolean);
  const pendingNaturalActorIds = pendingNaturalUnits
    .map(unit => String(preview.unitId(unit) || '').trim())
    .filter(Boolean);
  const pendingHostileActorIds = queue
    .filter(entry => entry.side !== firstEntry.side)
    .map(entry => String(preview.unitId(entry.char) || '').trim())
    .filter(Boolean);
  const opportunityId = `phase9:${caseDefinition.caseId}:natural:${actorId}`;
  const actionOpportunity = {
    role: 'ACTIVE',
    sequence: 1,
    opportunityId,
    grantId: opportunityId,
    grantType: 'NATURAL_ACTION',
    futureHostileResponseAllowed: pendingHostileActorIds.length > 0,
    pendingNaturalActorIds,
    pendingHostileActorIds,
    naturalActionBudget: pendingNaturalActorIds.length,
    battleHorizon: {
      currentRound: Number(world?.回合 || 0),
      finalRound: Number(world?.胜负条件?.maxRounds || caseDefinition.rounds || 1),
      remainingRounds: Number(world?.胜负条件?.maxRounds || caseDefinition.rounds || 1),
      naturalActionBudget: pendingNaturalActorIds.length,
    },
  };
  const sourceHash = preview.stableHash(world);
  traceStage('build-runtime-snapshot');
  const runtimeSnapshot = plain(runtime.buildDecisionRuntimeSnapshot(world, actorId, actionOpportunity));
  const knownOpportunityIds = new Set(
    (runtimeSnapshot.opportunitySnapshot || [])
      .map(entry => String(entry?.opportunityId || '').trim())
      .filter(Boolean),
  );
  pendingNaturalUnits.forEach((unit, index) => {
    const pendingActorId = String(preview.unitId(unit) || '').trim();
    const pendingOpportunityId = `phase9:${caseDefinition.caseId}:pending:${pendingActorId}`;
    if (!pendingActorId || knownOpportunityIds.has(pendingOpportunityId)) return;
    runtimeSnapshot.opportunitySnapshot.push({
      opportunityId: pendingOpportunityId,
      ownerId: pendingActorId,
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: index + 1,
      status: pendingActorId === actorId ? 'EXECUTING' : 'PENDING',
    });
  });
  const prepareStartedAt = performance.now();
  traceStage('prepare-decision-request');
  const request = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId,
    objectiveContract: world?.胜负条件 || {},
    battleIntent: { mode: caseDefinition.intent, objectives: world?.胜负条件 || {} },
    beliefState: caseDefinition.initialBelief?.[actorId] || caseDefinition.initialBelief || {},
    actionOpportunity,
    runtimeSnapshot,
    seed: `${caseDefinition.seed}:phase9:first`,
    collectTargetPressureAudit: options.collectTargetPressureAudit !== false,
  });
  traceStage('prepare-decision-request-complete');
  const prepareDurationMs = Number((performance.now() - prepareStartedAt).toFixed(3));
  const preparedRouteCache = decision.preparedRouteCacheSnapshot(request);
  const cachedFullRouteCount = Object.values(
    preparedRouteCache.fullRoutesByUnit || {},
  ).reduce(
    (sum, routes) => sum + (Array.isArray(routes) ? routes.length : 0),
    0,
  );
  const fullRouteSummariesByUnit = Object.fromEntries(
    Object.entries(preparedRouteCache.fullRoutesByUnit || {})
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(([unitId, routes]) => [
        unitId,
        (Array.isArray(routes) ? routes : []).map(route => ({
          candidateId: String(route?.candidateId || ''),
          routeKey: String(route?.routeKey || ''),
          targetIds: plain(route?.targetIds || []),
          paymentDependencies: plain(route?.paymentDependencies || []),
          opportunityDependencies: plain(route?.opportunityDependencies || []),
          objectiveRouteUtilityHEPP: Number(
            route?.objectiveRouteUtilityHEPP ?? route?.routeBenefitPP ?? 0
          ),
          intrinsicActionPoolHEPP: Number(route?.intrinsicActionPoolHEPP || 0),
          resourceActionPoolHEPP: Number(route?.resourceActionPoolHEPP || 0),
          intrinsicBehaviorUtilityHEPP: Number(
            route?.intrinsicBehaviorUtilityHEPP ??
            route?.objectiveRouteUtilityHEPP ??
            route?.routeBenefitPP ??
            0
          ),
          behaviorRouteUtilityHEPP: Number(
            route?.behaviorRouteUtilityHEPP ??
            route?.intrinsicBehaviorUtilityHEPP ??
            route?.objectiveRouteUtilityHEPP ??
            route?.routeBenefitPP ??
            0
          ),
          behaviorValuationMode: String(route?.behaviorValuationMode || ''),
          resourcePotentialOnly: route?.resourcePotentialOnly === true,
          actionPoolEffects: (route?.actionPoolEffects || []).map(effect => ({
            targetId: String(effect?.targetId || ''),
            outcomeKind: String(effect?.outcomeKind || ''),
            windowId: String(effect?.windowId || ''),
            expectedDelta: Number(effect?.expectedDelta || 0),
            evidence: plain(effect?.evidence || {}),
          })),
        })),
      ]),
  );
  const results = Object.fromEntries(providers.map(providerId => {
    const startedAt = performance.now();
    const providerResult = decision.runProvider({ providerId, request });
    return [providerId, {
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
      ...decisionSummary(providerResult),
    }];
  }));
  const fullCandidateEnvelopeDeltaSummary = Object.fromEntries(
    Object.entries(request.candidateEnvelopeDeltas || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([candidateId, rows]) => [
        candidateId,
        (Array.isArray(rows) ? rows : []).map(row => ({
          targetId: String(row?.targetId || ''),
          beforeRouteKey: String(row?.beforeRouteKey || ''),
          afterRouteKey: String(row?.afterRouteKey || ''),
          beforePP: Number(row?.beforePP || 0),
          afterPP: Number(row?.afterPP || 0),
          healthTrajectoryDeltaPP: Number(row?.healthTrajectoryDeltaPP || 0),
          futureThreatWindowDeltaPP: Number(row?.futureThreatWindowDeltaPP || 0),
          resourceOpportunityDeltaPP: Number(
            row?.resourceOpportunityDeltaPP || 0
          ),
          pressureOnly: row?.pressureOnly === true,
          capabilityOnly: row?.capabilityOnly === true,
          sourceHealthFactKeys: plain(row?.sourceHealthFactKeys || []),
          sourceEffectKeys: plain(row?.sourceEffectKeys || []),
        })),
      ]),
  );
  const resourceWorldSetSummary = Object.values(
    request.candidateEnvelopeDeltas || {},
  )
    .flatMap(rows => (Array.isArray(rows) ? rows : []))
    .filter(row => row?.resourceOpportunityBaseline || row?.resourceOpportunityCandidate)
    .map(row => ({
      targetId: String(row?.targetId || ''),
      resourceOpportunityDeltaPP: Number(row?.resourceOpportunityDeltaPP || 0),
      baseline: plain(row?.resourceOpportunityBaseline || null),
      candidate: plain(row?.resourceOpportunityCandidate || null),
    }))
    .sort((left, right) =>
      left.targetId.localeCompare(right.targetId) ||
      left.resourceOpportunityDeltaPP - right.resourceOpportunityDeltaPP
    );
  const resourcePlanSemanticValue = plan => plan
    ? {
        cumulativeUtilityHEPP: Number(plan?.cumulativeUtilityHEPP || 0),
        rows: (plan?.rows || []).map(row => ({
          opportunityId: String(row?.opportunityId || ''),
          opportunityRound: Number(row?.opportunityRound || 0),
          opportunitySequence: Number(row?.opportunitySequence || 0),
          ownerId: String(row?.ownerId || ''),
          selectedRouteKey: String(row?.selectedRouteKey || ''),
          selectedCandidateId: String(row?.selectedCandidateId || ''),
          routeUtilityHEPP: Number(row?.routeUtilityHEPP || 0),
          conditionedObjectiveUtilityHEPP: Number(
            row?.conditionedObjectiveUtilityHEPP || 0
          ),
          worldStateHashAfter: String(row?.worldStateHashAfter || ''),
          hpAfter: plain(row?.hpAfter || {}),
          terminalStatus: String(row?.terminalStatus || ''),
          terminalProbability: Number(row?.terminalProbability || 0),
          probabilisticStateUnresolved:
            row?.probabilisticStateUnresolved === true,
          consumedBehaviorKeys: plain(row?.consumedBehaviorKeys || []),
          consumedHealthWindowKeys: plain(
            row?.consumedHealthWindowKeys || []
          ),
          projectionMode: String(row?.projectionMode || ''),
          balancesBefore: plain(row?.balancesBefore || {}),
          balancesAfter: plain(row?.balancesAfter || {}),
          lockedResources: plain(row?.lockedResources || []),
          branchProbability: Number(row?.branchProbability || 0),
          branchUtilityHEPP: Number(row?.branchUtilityHEPP || 0),
        })),
        finalResources: plain(plan?.finalResources || {}),
        finalHpByUnit: plain(plan?.finalHpByUnit || {}),
        terminalStatus: String(plan?.terminalStatus || ''),
        terminalResult: plain(plan?.terminalResult || null),
        terminalStep: Number.isFinite(plan?.terminalStep)
          ? plan.terminalStep
          : null,
        terminalProbability: Number(plan?.terminalProbability || 0),
        ongoingProbability: Number(plan?.ongoingProbability || 0),
        probabilisticStateUnresolved:
          plan?.probabilisticStateUnresolved === true,
        probabilityProjectionMode: String(
          plan?.probabilityProjectionMode || ''
        ),
        branchPlanSummary: plain(plan?.branchPlanSummary || []),
        finalWorldStateHash: String(plan?.finalWorldStateHash || ''),
        consumedBehaviorKeys: plain(plan?.consumedBehaviorKeys || []),
        consumedHealthWindowKeys: plain(
          plan?.consumedHealthWindowKeys || []
        ),
      }
    : null;
  const resourceWorldSemanticSummary = resourceWorldSetSummary.map(entry => ({
    targetId: entry.targetId,
    resourceOpportunityDeltaPP: entry.resourceOpportunityDeltaPP,
    baseline: resourcePlanSemanticValue(entry.baseline),
    candidate: resourcePlanSemanticValue(entry.candidate),
  }));
  const targetPressureSummary = plain(
    request.candidateEnvelopeMetrics?.targetPressureAudits || [],
  );
  const semanticDecisionResults = Object.fromEntries(
    Object.entries(results).map(([providerId, value]) => {
      const {
        durationMs: ignoredDurationMs,
        ...semanticValue
      } = value;
      return [providerId, semanticValue];
    }),
  );
  const layerHashes = {
    candidateSetHash: sha256(request.frozenCandidates.map(
      candidate => candidate.candidateId,
    )),
    declarationFingerprintHash: sha256(request.candidateFingerprintMap),
    mechanicalRouteHash: sha256(fullRouteSummariesByUnit),
    resourceWorldSetHash: sha256(resourceWorldSemanticSummary),
    actionEnvelopeDeltaHash: sha256(fullCandidateEnvelopeDeltaSummary),
    targetPressureHash: sha256(targetPressureSummary),
    goalProjectionHash: sha256(Object.fromEntries(
      Object.entries(results).map(([providerId, value]) => [
        providerId,
        value.candidateValueSummary,
      ]),
    )),
    paretoHash: sha256(Object.fromEntries(
      Object.entries(results).map(([providerId, value]) => [
        providerId,
        value.candidateValueSummary.map(candidate => ({
          candidateId: candidate.candidateId,
          classification: candidate.classification,
          dominatedBy: candidate.dominatedBy,
          pareto: candidate.pareto,
          rejectionCode: candidate.rejectionCode,
        })),
      ]),
    )),
    decisionAuditHash: sha256(semanticDecisionResults),
  };
  const decisionMetrics = plain(decision.readMetrics());
  const previewMetrics = plain(preview.readMetrics());
  if (preview.stableHash(world) !== sourceHash) throw new Error('PROVIDER_MUTATED_STATE');
  return {
    evidenceKind: 'QUEUE_HEAD_CANDIDATE_SNAPSHOT',
    provesActualFirstDecision: false,
    caseId: caseDefinition.caseId,
    actorId,
    actorSide: firstEntry.side,
    sourceDataHashes: plain(caseDefinition.sourceDataHashes),
    requestHash: request.requestHash,
    prepareDurationMs,
    routeCacheMetrics: plain(request.routeCacheMetrics || {}),
    fullRouteCacheComplete:
      cachedFullRouteCount === Number(request.routeCacheMetrics?.searchedRouteCount || 0),
    cachedFullRouteCount,
    fullRouteSummariesByUnit,
    candidateEnvelopeMetrics: plain(request.candidateEnvelopeMetrics || {}),
    decisionMetrics,
    previewMetrics,
    candidateEnvelopeDeltaCount: Object.values(request.candidateEnvelopeDeltas || {})
      .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0),
    fullCandidateEnvelopeDeltaSummary,
    resourceWorldSetSummary,
    resourceWorldSemanticSummary,
    targetPressureSummary,
    layerHashes,
    nonZeroCandidateEnvelopeDeltas: Object.fromEntries(
      Object.entries(request.candidateEnvelopeDeltas || {})
        .map(([candidateId, rows]) => [
          candidateId,
          (Array.isArray(rows) ? rows : [])
            .filter(row => Math.abs(Number(row?.healthTrajectoryDeltaPP || 0)) > 1e-9)
            .map(row => ({
              targetId: String(row?.targetId || ''),
              beforeRouteKey: String(row?.beforeRouteKey || ''),
              afterRouteKey: String(row?.afterRouteKey || ''),
              beforePP: Number(row?.beforePP || 0),
              afterPP: Number(row?.afterPP || 0),
              healthTrajectoryDeltaPP: Number(row?.healthTrajectoryDeltaPP || 0),
              futureThreatWindowDeltaPP: Number(row?.futureThreatWindowDeltaPP || 0),
              sourceHealthFactKeys: plain(row?.sourceHealthFactKeys || []),
              sourceEffectKeys: plain(row?.sourceEffectKeys || []),
            })),
        ])
        .filter(([, rows]) => rows.length),
    ),
    actionPoolOutcomeCounts: Object.values(request.actorCandidateRoutes || {})
      .flatMap(route => route?.actionPoolEffects || [])
      .reduce((counts, effect) => {
        const key = String(effect?.outcomeKind || 'UNKNOWN');
        counts[key] = Number(counts[key] || 0) + 1;
        return counts;
      }, {}),
    actionPoolEffectsByCandidate: Object.fromEntries(
      Object.entries(request.actorCandidateRoutes || {})
        .filter(([, route]) => (route?.actionPoolEffects || []).length)
        .map(([candidateId, route]) => [
          candidateId,
          (route.actionPoolEffects || []).map(effect => ({
            targetId: effect.targetId,
            outcomeKind: effect.outcomeKind,
            windowId: effect.windowId,
            evidence: plain(effect.evidence || {}),
          })),
        ]),
    ),
    candidateCount: request.frozenCandidates.length,
    candidateIdsHash: sha256(request.frozenCandidates.map(candidate => candidate.candidateId)),
    declarationFingerprintsHash: sha256(request.candidateFingerprintMap),
    results,
  };
}

function fullBattleRecord(caseDefinition, providerId, runtime, options = {}) {
  const performanceTraceEnabled = process.env.BATTLE_R8_PERF_TRACE === '1';
  const performanceTrace = (stage, fields = {}) => {
    if (!performanceTraceEnabled) return;
    process.stderr.write(`[phase9-full-perf] ${JSON.stringify({
      stage,
      caseId: caseDefinition.caseId,
      providerId,
      ...fields,
    })}\n`);
  };
  const startedAt = performance.now();
  const rounds = Number.isInteger(options.roundLimit) && options.roundLimit > 0
    ? Math.min(Number(caseDefinition.rounds || options.roundLimit), options.roundLimit)
    : caseDefinition.rounds;
  performanceTrace('run-battle-start', {
    rounds,
    combatDataBytes: JSON.stringify(caseDefinition.combatData || {}).length,
  });
  const result = runtime.runBattleCase({
    caseId: caseDefinition.caseId,
    seed: caseDefinition.seed,
    combatData: caseDefinition.combatData,
    mode: 'team_preview',
    rounds,
    initialBelief: caseDefinition.initialBelief,
    battleIntent: { mode: caseDefinition.intent },
    selectedAction: caseDefinition.selectedAction,
    settings: {
      providerId,
      disableRouteCatalogCache: options.disableRouteCatalogCache === true,
      disableObservationRouteReuse:
        options.disableObservationRouteReuse === true,
      disableCompactObjectiveFastPath:
        options.disableCompactObjectiveFastPath === true,
      collectTargetPressureAudit: options.collectTargetPressureAudit === true,
      disableEvaluationSession: options.disableEvaluationSession === true,
      disableSessionMechanicalReuse:
        options.disableSessionMechanicalReuse === true,
      verifySessionMechanicalReuse:
        options.verifySessionMechanicalReuse === true,
      disableSessionBehaviorReuse:
        options.disableSessionBehaviorReuse === true,
      verifySessionBehaviorReuse:
        options.verifySessionBehaviorReuse === true,
      collectBehaviorLayerHashes:
        options.collectBehaviorLayerHashes === true,
      collectBehaviorIdentityObservations:
        options.collectBehaviorIdentityObservations === true,
    },
  });
  performanceTrace('run-battle-end', {
    elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
    roundsExecuted: Number(result?.roundsExecuted || 0),
    decisionCount: Array.isArray(result?.decisions) ? result.decisions.length : 0,
  });
  const decisions = Array.isArray(result?.decisions) ? result.decisions : [];
  const decisionPerformanceDiagnostics = Array.isArray(
    result?.decisionPerformanceDiagnostics,
  )
    ? result.decisionPerformanceDiagnostics
    : [];
  const evaluationSessionMetrics =
    result?.evaluationSessionMetrics &&
    typeof result.evaluationSessionMetrics === 'object'
      ? result.evaluationSessionMetrics
      : null;
  const evaluationSessionSummary = evaluationSessionMetrics
    ? {
        metrics: plain(evaluationSessionMetrics.metrics || {}),
        storeSizes: plain(evaluationSessionMetrics.storeSizes || {}),
        requestCount: Array.isArray(evaluationSessionMetrics.requestRecords)
          ? evaluationSessionMetrics.requestRecords.length
          : 0,
        factDeltaCount: Array.isArray(evaluationSessionMetrics.factDeltaRecords)
          ? evaluationSessionMetrics.factDeltaRecords.length
          : 0,
      }
    : null;
  const terminalMetrics = options.collectTerminalMetrics === true
    ? Object.fromEntries(
        Object.entries(plain(decision.readMetrics()))
          .filter(([key]) => key.startsWith('terminal')),
      )
    : undefined;
  const terminalIdentityObservations =
    options.collectTerminalIdentityObservations === true
      ? plain(decision.readTerminalIdentityObservations())
      : undefined;
  const semanticDecisions = decisions.map(decisionAudit => {
    const copy = plain(decisionAudit);
    delete copy.routeCacheMetrics;
    delete copy.candidateEnvelopeMetrics;
    return copy;
  });
  const behaviorLayerHashSequence = decisionPerformanceDiagnostics.map(
    diagnostic => plain(
      diagnostic?.behaviorLayerSemanticHashes || {},
    ),
  );
  const aggregateBehaviorLayerHash = key => sha256(
    behaviorLayerHashSequence.map(row => String(row?.[key] || '')),
  );
  const behaviorIdentityObservations = decisionPerformanceDiagnostics.flatMap(
    (diagnostic, decisionIndex) =>
      (
        Array.isArray(
          diagnostic?.candidateEnvelopeMetrics
            ?.behaviorIdentityObservations,
        )
          ? diagnostic.candidateEnvelopeMetrics.behaviorIdentityObservations
          : []
      ).map(observation => ({
        decisionIndex,
        round: Number(diagnostic?.round || 0),
        actorId: String(diagnostic?.actorId || ''),
        actionRole: String(diagnostic?.actionRole || ''),
        ...plain(observation),
      })),
  );
  const ledger = Array.isArray(result?.ledger) ? result.ledger : [];
  const fatalCodes = (Array.isArray(result?.audit?.fatals) ? result.audit.fatals : [])
    .map(item => String(item?.code || '').trim())
    .filter(Boolean);
  const debugDecisionIndex = Number.isInteger(options.debugDecisionIndex)
    ? options.debugDecisionIndex
    : -1;
  return {
    caseId: caseDefinition.caseId,
    providerId,
    durationMs: Number((performance.now() - startedAt).toFixed(3)),
    roundsRequested: Number(result?.roundsRequested || caseDefinition.rounds || 0),
    roundsExecuted: Number(result?.roundsExecuted || 0),
    winner: String(result?.winner || ''),
    terminal: plain(result?.terminal || result?.objectiveResolution || null),
    decisionCount: decisions.length,
    routeMetrics: decisionPerformanceDiagnostics.reduce((totals, decisionAudit) => {
      const route = decisionAudit?.routeCacheMetrics || {};
      const envelope = decisionAudit?.candidateEnvelopeMetrics || {};
      totals.basePreviewCalls += Number(route.previewCalls || 0);
      totals.baseRecomputedUnitCount += Number(route.recomputedUnitCount || 0);
      totals.envelopePreviewCalls += Number(envelope.previewCalls || 0);
      totals.envelopeReusedRouteCount += Number(envelope.reusedRouteCount || 0);
      totals.envelopeRebuildCount += Number(envelope.rebuildCount || 0);
      totals.healthOnlyRebuildCount += Number(envelope.healthOnlyRebuildCount || 0);
      totals.effectOnlyRebuildCount += Number(envelope.effectOnlyRebuildCount || 0);
      totals.mixedSourceRebuildCount += Number(envelope.mixedSourceRebuildCount || 0);
      totals.zeroDeltaRebuildCount += Number(envelope.zeroDeltaRebuildCount || 0);
      totals.nonZeroDeltaRebuildCount += Number(envelope.nonZeroDeltaRebuildCount || 0);
      totals.skippedZeroWindowSummonRebuildCount +=
        Number(envelope.skippedZeroWindowSummonRebuildCount || 0);
      totals.skippedHealthEnvelopeRebuildCount +=
        Number(envelope.skippedHealthEnvelopeRebuildCount || 0);
      totals.pressureOnlyHealthEvaluationCount +=
        Number(envelope.pressureOnlyHealthEvaluationCount || 0);
      totals.zeroPressureOnlyHealthEvaluationCount +=
        Number(envelope.zeroPressureOnlyHealthEvaluationCount || 0);
      totals.nonZeroPressureOnlyHealthEvaluationCount +=
        Number(envelope.nonZeroPressureOnlyHealthEvaluationCount || 0);
      totals.informationEnvelopePreviewCalls +=
        Number(envelope.informationEnvelopePreviewCalls || 0);
      totals.informationEnvelopeReusedRouteCount +=
        Number(envelope.informationEnvelopeReusedRouteCount || 0);
      const sessionActualWork =
        decisionAudit?.evaluationSessionObservation?.request?.actualWork || {};
      const sessionOwnershipImpact =
        decisionAudit?.evaluationSessionObservation?.request?.ownershipImpact || {};
      totals.evaluationSessionPreviewCalls +=
        Number(sessionActualWork.previewCalls || 0);
      totals.evaluationSessionOverlayWrites +=
        Number(sessionActualWork.overlayWrites || 0);
      totals.evaluationSessionRouteRebuilds +=
        Number(sessionActualWork.routeRebuilds || 0);
      totals.evaluationSessionTerminalProjectionCalls +=
        Number(sessionActualWork.terminalProjectionCalls || 0);
      totals.evaluationSessionOwnershipDirtyOwnerCount +=
        Number(sessionOwnershipImpact.dirtyOwnerCount || 0);
      totals.evaluationSessionUnscopedLayerCount +=
        Number(sessionOwnershipImpact.unscopedLayerCount || 0);
      Object.entries(envelope.rebuildSourceOutcomeCounts || {}).forEach(([key, value]) => {
        totals.rebuildSourceOutcomeCounts[key] =
          Number(totals.rebuildSourceOutcomeCounts[key] || 0) + Number(value || 0);
      });
      Object.entries(envelope.zeroDeltaSourceOutcomeCounts || {}).forEach(([key, value]) => {
        totals.zeroDeltaSourceOutcomeCounts[key] =
          Number(totals.zeroDeltaSourceOutcomeCounts[key] || 0) + Number(value || 0);
      });
      const invalidation = route.invalidationAudit || {};
      totals.affectedRouteUnitCount +=
        Number(invalidation?.affectedRouteUnitIds?.length || 0);
      totals.changedRouteUnitCount +=
        Number(invalidation?.changedRouteUnitIds?.length || 0);
      totals.changedTargetUnitCount +=
        Number(invalidation?.changedTargetUnitIds?.length || 0);
      totals.changedOpportunityCount +=
        Number(invalidation?.changedOpportunityIds?.length || 0);
      totals.changedResourceDependencyCount +=
        Number(invalidation?.changedResourceKeys?.length || 0);
      totals.changedScheduleCount +=
        Number(invalidation?.changedScheduleIds?.length || 0);
      if (invalidation?.globalInvalidationReason) {
        totals.globalInvalidationCount += 1;
      }
      return totals;
    }, {
      basePreviewCalls: 0,
      baseRecomputedUnitCount: 0,
      envelopePreviewCalls: 0,
      envelopeReusedRouteCount: 0,
      envelopeRebuildCount: 0,
      healthOnlyRebuildCount: 0,
      effectOnlyRebuildCount: 0,
      mixedSourceRebuildCount: 0,
      zeroDeltaRebuildCount: 0,
      nonZeroDeltaRebuildCount: 0,
      skippedZeroWindowSummonRebuildCount: 0,
      skippedHealthEnvelopeRebuildCount: 0,
      pressureOnlyHealthEvaluationCount: 0,
      zeroPressureOnlyHealthEvaluationCount: 0,
      nonZeroPressureOnlyHealthEvaluationCount: 0,
      informationEnvelopePreviewCalls: 0,
      informationEnvelopeReusedRouteCount: 0,
      rebuildSourceOutcomeCounts: {},
      zeroDeltaSourceOutcomeCounts: {},
      affectedRouteUnitCount: 0,
      changedRouteUnitCount: 0,
      changedTargetUnitCount: 0,
      changedOpportunityCount: 0,
      changedResourceDependencyCount: 0,
      changedScheduleCount: 0,
      globalInvalidationCount: 0,
      evaluationSessionPreviewCalls: 0,
      evaluationSessionOverlayWrites: 0,
      evaluationSessionRouteRebuilds: 0,
      evaluationSessionTerminalProjectionCalls: 0,
      evaluationSessionOwnershipDirtyOwnerCount: 0,
      evaluationSessionUnscopedLayerCount: 0,
    }),
    decisionPerformanceSequence: decisionPerformanceDiagnostics.map((decisionAudit, index) => ({
      index,
      round: Number(decisionAudit?.round || 0),
      actorId: String(decisionAudit?.actorId || ''),
      actionRole: String(decisionAudit?.actionRole || ''),
      nodeKind: String(decisionAudit?.nodeKind || ''),
      opportunitySequence: Number(decisionAudit?.opportunitySequence || 0),
      candidateCount: Number(decisionAudit?.candidateCount || 0),
      timing: plain(decisionAudit?.timing || {}),
      routeCacheMetrics: plain(decisionAudit?.routeCacheMetrics || {}),
      routeFactOwnershipSummary: plain(
        decisionAudit?.routeFactOwnershipSummary || {},
      ),
      behaviorLayerSemanticHashes: plain(
        decisionAudit?.behaviorLayerSemanticHashes || {},
      ),
      candidateEnvelopeMetrics: plain(decisionAudit?.candidateEnvelopeMetrics || {}),
      evaluationSession: (() => {
        const observation =
          decisionAudit?.evaluationSessionObservation || {};
        const impact = observation?.request?.ownershipImpact || {};
        return {
          factDeltaSequence: Number(
            observation?.factDelta?.sequence || 0,
          ),
          changedFactCount: Number(
            observation?.factDelta?.changedFactKeys?.length || 0,
          ),
          matchedFactCount: Number(
            impact?.matchedFactKeys?.length || 0,
          ),
          dirtyOwnerCount: Number(impact?.dirtyOwnerCount || 0),
          dirtyOwnerLayerCounts: Object.fromEntries(
            Object.entries(impact?.dirtyOwnersByLayer || {})
              .map(([layer, owners]) => [
                layer,
                Array.isArray(owners) ? owners.length : 0,
              ])
              .sort(([left], [right]) => left.localeCompare(right)),
          ),
          unscopedLayerCount: Number(impact?.unscopedLayerCount || 0),
        };
      })(),
    })),
    evaluationSession: evaluationSessionSummary,
    ledgerCount: ledger.length,
    actionQueueNodeCount: Array.isArray(result?.actionQueueTrace)
      ? result.actionQueueTrace.length
      : 0,
    decisionSequence: decisions.map((entry, index) => ({
      index,
      round: Number(entry?.round || 0),
      actorId: String(entry?.actorId || ''),
      actionRole: String(entry?.actionRole || ''),
      opportunityId: String(entry?.opportunityId || ''),
      selectedCandidateId: String(entry?.selected?.candidateId || ''),
      selectedActionKind: String(entry?.selected?.declaration?.actionKind || ''),
      targetIds: plain(entry?.selected?.declaration?.targetIds || []),
      objectiveUtilityHEPP: Number(
        entry?.selected?.objectiveUtilityHEPP ??
        entry?.selected?.objectiveUtility ??
        0,
      ),
      rejectionCode: String(entry?.selected?.rejectionCode || ''),
      forcedFallback: entry?.selected?.forcedFallback === true,
      fallbackReason: String(entry?.selected?.fallbackReason || ''),
      fallbackSourceRejectionCode: String(
        entry?.selected?.fallbackSourceRejectionCode || '',
      ),
      fallbackCandidateAudit: entry?.selected?.forcedFallback === true
        ? (entry?.candidateAudit || [])
            .filter(candidate =>
              candidate?.candidateId !== entry?.selected?.candidateId
            )
            .sort((left, right) =>
              Number(
                right?.objectiveUtilityHEPP ??
                right?.objectiveUtility ??
                0
              ) -
              Number(
                left?.objectiveUtilityHEPP ??
                left?.objectiveUtility ??
                0
              ) ||
              String(left?.candidateId || '').localeCompare(
                String(right?.candidateId || ''),
              )
            )
            .slice(0, 5)
            .map(candidate => ({
              candidateId: String(candidate?.candidateId || ''),
              actionKind: String(candidate?.declaration?.actionKind || ''),
              targetIds: plain(candidate?.declaration?.targetIds || []),
              objectiveUtilityHEPP: Number(
                candidate?.objectiveUtilityHEPP ??
                candidate?.objectiveUtility ??
                0
              ),
              directTrajectoryHEPP: Number(
                candidate?.goalProjection?.directTrajectoryHEPP || 0
              ),
              actionPoolHEPP: Number(
                candidate?.goalProjection?.actionPoolHEPP || 0
              ),
              expectedCandidateUtility: Number(
                candidate?.goalProjection?.expectedCandidateUtility || 0
              ),
              expectedNoOpUtility: Number(
                candidate?.goalProjection?.expectedNoOpUtility || 0
              ),
              terminal: {
                status: String(candidate?.goalProjection?.terminal?.status || ''),
                terminalProbability: Number(
                  candidate?.goalProjection?.terminal?.terminalProbability || 0
                ),
                ongoingProbability: Number(
                  candidate?.goalProjection?.terminal?.ongoingProbability || 0
                ),
                expectedTerminalUtility: Number(
                  candidate?.goalProjection?.terminal?.expectedTerminalUtility || 0
                ),
                expectedOngoingTrajectoryUtility: Number(
                  candidate?.goalProjection?.terminal?.expectedOngoingTrajectoryUtility || 0
                ),
              },
              responseModel: {
                noResponseProbability: Number(
                  candidate?.goalProjection?.responseModel?.noResponseProbability || 0
                ),
                mainBranches: (
                  candidate?.goalProjection?.responseModel?.mainBranches || []
                ).map(branch => ({
                  projectionId: String(branch?.projectionId || ''),
                  sourceActorId: String(branch?.sourceActorId || ''),
                  probability: Number(branch?.probability || 0),
                  threatEnvelope: plain(branch?.threatEnvelope || {}),
                  appliesToNoOp: branch?.appliesToNoOp === true,
                  actionKind: String(branch?.declaration?.actionKind || ''),
                  targetIds: plain(branch?.declaration?.targetIds || []),
                })),
                disasterTail: candidate?.goalProjection?.responseModel?.disasterTail
                  ? {
                      projectionId: String(
                        candidate.goalProjection.responseModel.disasterTail
                          ?.projectionId || ''
                      ),
                      sourceActorId: String(
                        candidate.goalProjection.responseModel.disasterTail
                          ?.sourceActorId || ''
                      ),
                      probability: Number(
                        candidate.goalProjection.responseModel.disasterTail
                          ?.probability || 0
                      ),
                      threatEnvelope: plain(
                        candidate.goalProjection.responseModel.disasterTail
                          ?.threatEnvelope || {}
                      ),
                      appliesToNoOp:
                        candidate.goalProjection.responseModel.disasterTail
                          ?.appliesToNoOp === true,
                      actionKind: String(
                        candidate.goalProjection.responseModel.disasterTail
                          ?.declaration?.actionKind || ''
                      ),
                      targetIds: plain(
                        candidate.goalProjection.responseModel.disasterTail
                          ?.declaration?.targetIds || []
                      ),
                    }
                  : null,
              },
              rejectionCode: String(candidate?.rejectionCode || ''),
              actionPoolDeltas: (candidate?.goalProjection?.actionPoolDeltas || [])
                .map(delta => ({
                  targetId: String(delta?.targetId || ''),
                  outcomeKind: String(delta?.outcomeKind || ''),
                  healthTrajectoryDeltaPP: Number(
                    delta?.healthTrajectoryDeltaPP || 0
                  ),
                  realizable: delta?.realizable !== false,
                }))
                .filter(delta =>
                  Math.abs(delta.healthTrajectoryDeltaPP) > 1e-9 ||
                  delta.realizable === false
                ),
            }))
        : [],
      lostOpportunityReason: String(entry?.lostOpportunity?.reasonCode || ''),
    })),
    fatalCount: Number(result?.audit?.fatalCount || 0),
    fatalCodes,
    fatals: plain(result?.audit?.fatals || []),
    ledgerHash: sha256(ledger),
    decisionHash: sha256(decisions),
    decisionSemanticHash: sha256(semanticDecisions),
    decisionSemanticHashes: semanticDecisions.map(sha256),
    candidateEnvelopeDeltasHash: aggregateBehaviorLayerHash(
      'candidateEnvelopeDeltasHash',
    ),
    valuedFullRoutesHash: aggregateBehaviorLayerHash(
      'valuedFullRoutesHash',
    ),
    behaviorEnvelopesHash: aggregateBehaviorLayerHash(
      'behaviorEnvelopesHash',
    ),
    primaryBackupRoutesHash: aggregateBehaviorLayerHash(
      'primaryBackupRoutesHash',
    ),
    paretoRelationsHash: aggregateBehaviorLayerHash(
      'paretoRelationsHash',
    ),
    behaviorIdentityObservations,
    terminalMetrics,
    terminalIdentityObservations,
    debugDecision: debugDecisionIndex >= 0
      ? plain(decisions[debugDecisionIndex]) || null
      : undefined,
    debugLedger: options.debugLedger === true
      ? plain(ledger)
      : undefined,
    terminalHash: sha256(result?.terminal || result?.objectiveResolution || null),
    finalSnapshotHash: sha256(result?.finalSnapshot || result?.snapshot || null),
  };
}

function runFullBattleWorker(caseId, providerId, options = {}) {
  const workerArgs = [fileURLToPath(import.meta.url), '--worker-full', caseId, providerId];
  if (options.disableRouteCatalogCache === true) workerArgs.push('--no-route-cache');
  if (options.disableObservationRouteReuse === true) {
    workerArgs.push('--no-observation-route-reuse');
  }
  if (options.disableCompactObjectiveFastPath === true) {
    workerArgs.push('--no-compact-objective-fast-path');
  }
  if (options.disableSessionMechanicalReuse === true) {
    workerArgs.push('--no-session-mechanical-reuse');
  }
  if (options.verifySessionMechanicalReuse === true) {
    workerArgs.push('--verify-session-mechanical-reuse');
  }
  if (options.disableSessionBehaviorReuse === true) {
    workerArgs.push('--no-session-behavior-reuse');
  }
  if (options.verifySessionBehaviorReuse === true) {
    workerArgs.push('--verify-session-behavior-reuse');
  }
  if (options.collectBehaviorLayerHashes === true) {
    workerArgs.push('--collect-behavior-layer-hashes');
  }
  if (options.collectBehaviorIdentityObservations === true) {
    workerArgs.push('--collect-behavior-identity-observations');
  }
  if (options.collectTerminalMetrics === true) {
    workerArgs.push('--collect-terminal-metrics');
  }
  if (options.collectTerminalIdentityObservations === true) {
    workerArgs.push('--collect-terminal-identity-observations');
  }
  if (options.forceNight === true) workerArgs.push('--night');
  if (options.collectTargetPressureAudit === false) {
    workerArgs.push('--no-target-pressure-audit');
  }
  const worker = spawnSync(
    process.execPath,
    workerArgs,
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: fullBattleTimeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (worker.error?.code === 'ETIMEDOUT') {
    return {
      caseId,
      providerId,
      error: `PHASE9_FULL_BATTLE_TIMEOUT:${fullBattleTimeoutMs}`,
      timedOut: true,
    };
  }
  if (worker.status !== 0) {
    return {
      caseId,
      providerId,
      error: String(worker.stderr || worker.stdout || `PHASE9_FULL_BATTLE_WORKER_EXIT:${worker.status}`),
      timedOut: false,
    };
  }
  try {
    return JSON.parse(worker.stdout);
  } catch (error) {
    return {
      caseId,
      providerId,
      error: `PHASE9_FULL_BATTLE_WORKER_OUTPUT_INVALID:${String(error?.message || error)}`,
      timedOut: false,
    };
  }
}

function runFullBattleWorkerAsync(caseId, providerId, options = {}) {
  const workerArgs = [fileURLToPath(import.meta.url), '--worker-full', caseId, providerId];
  if (options.disableRouteCatalogCache === true) workerArgs.push('--no-route-cache');
  if (options.disableObservationRouteReuse === true) {
    workerArgs.push('--no-observation-route-reuse');
  }
  if (options.disableCompactObjectiveFastPath === true) {
    workerArgs.push('--no-compact-objective-fast-path');
  }
  if (options.disableSessionMechanicalReuse === true) {
    workerArgs.push('--no-session-mechanical-reuse');
  }
  if (options.verifySessionMechanicalReuse === true) {
    workerArgs.push('--verify-session-mechanical-reuse');
  }
  if (options.disableSessionBehaviorReuse === true) {
    workerArgs.push('--no-session-behavior-reuse');
  }
  if (options.verifySessionBehaviorReuse === true) {
    workerArgs.push('--verify-session-behavior-reuse');
  }
  if (options.collectBehaviorLayerHashes === true) {
    workerArgs.push('--collect-behavior-layer-hashes');
  }
  if (options.collectBehaviorIdentityObservations === true) {
    workerArgs.push('--collect-behavior-identity-observations');
  }
  if (options.collectTerminalMetrics === true) {
    workerArgs.push('--collect-terminal-metrics');
  }
  if (options.collectTerminalIdentityObservations === true) {
    workerArgs.push('--collect-terminal-identity-observations');
  }
  if (options.forceNight === true) workerArgs.push('--night');
  if (options.collectTargetPressureAudit === false) {
    workerArgs.push('--no-target-pressure-audit');
  }
  return new Promise(resolve => {
    const child = spawn(process.execPath, workerArgs, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({
        caseId,
        providerId,
        error: `PHASE9_FULL_BATTLE_TIMEOUT:${fullBattleTimeoutMs}`,
        timedOut: true,
      });
    }, fullBattleTimeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 64 * 1024 * 1024) {
        settled = true;
        clearTimeout(timeout);
        child.kill();
        resolve({
          caseId,
          providerId,
          error: 'PHASE9_FULL_BATTLE_WORKER_OUTPUT_TOO_LARGE',
          timedOut: false,
        });
      }
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
      if (stderr.length > 8 * 1024 * 1024) stderr = stderr.slice(-8 * 1024 * 1024);
    });
    child.once('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        caseId,
        providerId,
        error: `PHASE9_FULL_BATTLE_WORKER_ERROR:${String(error?.message || error)}`,
        timedOut: false,
      });
    });
    child.once('exit', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({
          caseId,
          providerId,
          error: String(stderr || stdout || `PHASE9_FULL_BATTLE_WORKER_EXIT:${code}`),
          timedOut: false,
        });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        resolve({
          caseId,
          providerId,
          error: `PHASE9_FULL_BATTLE_WORKER_OUTPUT_INVALID:${String(error?.message || error)}`,
          timedOut: false,
        });
      }
    });
  });
}

function runFirstActionWorkerAsync(caseId, options = {}) {
  const workerArgs = [fileURLToPath(import.meta.url), '--worker-first', caseId];
  if (options.collectTargetPressureAudit === false) {
    workerArgs.push('--no-target-pressure-audit');
  }
  return new Promise(resolve => {
    const child = spawn(process.execPath, workerArgs, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({
        caseId,
        error: `PHASE9_FIRST_ACTION_TIMEOUT:${fullBattleTimeoutMs}`,
        timedOut: true,
      });
    }, fullBattleTimeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 64 * 1024 * 1024) {
        settled = true;
        clearTimeout(timeout);
        child.kill();
        resolve({
          caseId,
          error: 'PHASE9_FIRST_ACTION_WORKER_OUTPUT_TOO_LARGE',
          timedOut: false,
        });
      }
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
      if (stderr.length > 8 * 1024 * 1024) stderr = stderr.slice(-8 * 1024 * 1024);
    });
    child.once('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        caseId,
        error: `PHASE9_FIRST_ACTION_WORKER_ERROR:${String(error?.message || error)}`,
        timedOut: false,
      });
    });
    child.once('exit', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({
          caseId,
          error: String(stderr || stdout || `PHASE9_FIRST_ACTION_WORKER_EXIT:${code}`),
          timedOut: false,
        });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        resolve({
          caseId,
          error: `PHASE9_FIRST_ACTION_WORKER_OUTPUT_INVALID:${String(error?.message || error)}`,
          timedOut: false,
        });
      }
    });
  });
}

async function runWorkerPool(tasks, worker) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  async function consume() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;
      results[index] = await worker(tasks[index]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(workerConcurrency, tasks.length) },
      () => consume(),
    ),
  );
  return results;
}

function clusterFailures(firstActions = [], fullBattles = []) {
  const clusters = new Map();
  const add = (clusterId, item) => {
    if (!clusters.has(clusterId)) clusters.set(clusterId, []);
    clusters.get(clusterId).push(item);
  };
  firstActions.forEach(record => {
    if (record.error) add('FIRST_ACTION_EXECUTION_ERROR', {
      caseId: record.caseId,
      error: record.error,
    });
    for (const providerId of providers) {
      const result = record?.results?.[providerId];
      if (!result) continue;
      if (!result.selectedCandidateId) {
        add('PROVIDER_SELECTION_MISSING', { caseId: record.caseId, providerId });
      }
      if (providerId === 'r8-shadow' && !result.primaryRouteKey) {
        add('R8_PRIMARY_ROUTE_MISSING', { caseId: record.caseId, providerId });
      }
      if (
        providerId === 'r8-shadow' &&
        result.causalFactCount === 0 &&
        result.objectiveUtilityHEPP !== 0
      ) {
        add('R8_CAUSAL_FACT_MISSING', {
          caseId: record.caseId,
          providerId,
          objectiveUtilityHEPP: result.objectiveUtilityHEPP,
        });
      }
    }
    if (record.fullRouteCacheComplete !== true) {
      add('R8_FULL_ROUTE_CACHE_INCOMPLETE', {
        caseId: record.caseId,
        cachedFullRouteCount: Number(record.cachedFullRouteCount || 0),
        searchedRouteCount: Number(record?.routeCacheMetrics?.searchedRouteCount || 0),
      });
    }
  });
  fullBattles.forEach(record => {
    if (record.error) {
      add('FULL_BATTLE_EXECUTION_ERROR', {
        caseId: record.caseId,
        providerId: record.providerId,
        error: record.error,
      });
      return;
    }
    record.fatalCodes.forEach(code => add(code, {
      caseId: record.caseId,
      providerId: record.providerId,
      fatalCount: record.fatalCodes.filter(value => value === code).length,
    }));
    if (!record.decisionCount) {
      add('FULL_BATTLE_DECISION_MISSING', {
        caseId: record.caseId,
        providerId: record.providerId,
      });
    }
    record.decisionSequence
      .filter(decision =>
        !decision.selectedCandidateId &&
        !decision.lostOpportunityReason
      )
      .forEach(decision => add('FULL_BATTLE_SELECTION_OR_LOSS_MISSING', {
        caseId: record.caseId,
        providerId: record.providerId,
        round: decision.round,
        actorId: decision.actorId,
        actionRole: decision.actionRole,
        opportunityId: decision.opportunityId,
      }));
    record.decisionSequence
      .filter(decision =>
        decision.actionRole === 'ACTIVE' &&
        Number(decision.objectiveUtilityHEPP || 0) < -1e-9 &&
        decision.forcedFallback !== true
      )
      .forEach(decision => add('NEGATIVE_ACTIVE_ACTION_SELECTED', {
        caseId: record.caseId,
        providerId: record.providerId,
        round: decision.round,
        actorId: decision.actorId,
        selectedCandidateId: decision.selectedCandidateId,
        objectiveUtilityHEPP: decision.objectiveUtilityHEPP,
      }));
    record.decisionSequence
      .filter(decision => Math.abs(Number(decision.objectiveUtilityHEPP || 0)) > 100 + 1e-9)
      .forEach(decision => add('OBJECTIVE_UTILITY_OUT_OF_RANGE', {
        caseId: record.caseId,
        providerId: record.providerId,
        round: decision.round,
        actorId: decision.actorId,
        selectedCandidateId: decision.selectedCandidateId,
        objectiveUtilityHEPP: decision.objectiveUtilityHEPP,
      }));
  });
  return [...clusters.entries()]
    .map(([clusterId, items]) => ({
      clusterId,
      occurrenceCount: items.length,
      affectedCaseIds: [...new Set(items.map(item => item.caseId))].sort(),
      affectedProviders: [...new Set(items.map(item => item.providerId).filter(Boolean))].sort(),
      items,
    }))
    .sort((left, right) =>
      right.occurrenceCount - left.occurrenceCount ||
      left.clusterId.localeCompare(right.clusterId)
    );
}

const sandbox = loadRuntime();
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
if (!preview || !decision || !runtime) throw new Error('PHASE9_RUNTIME_MISSING');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manualCases = buildManualCases(
  sandbox.__LWCS_内置角色库__,
  sandbox.__LWCS_GET_BASE_STATS__,
);
if (process.argv.includes('--night')) {
  const nightCase = manualCases.find(item => item.caseId === 'raid_summon_heavy');
  if (!nightCase) throw new Error('PHASE9_NIGHT_CASE_MISSING');
  nightCase.combatData.时间段 = '黑夜';
}
const caseById = new Map(manualCases.map(item => [item.caseId, item]));
const manifestCaseIds = manifest.snapshots.map(item => item.caseId);
const manualCaseIds = manualCases.map(item => item.caseId);
if (
  manifestCaseIds.length !== 24 ||
  JSON.stringify([...manifestCaseIds].sort()) !== JSON.stringify([...manualCaseIds].sort())
) {
  throw new Error('PHASE9_REAL_CASE_MANIFEST_MISMATCH');
}
const currentInputManifest = manualCases.map(item => ({
  caseId: item.caseId,
  sourceCharacterIds: plain(item.sourceCharacterIds),
  sourceDataHashes: plain(item.sourceDataHashes),
  combatDataHash: sha256(item.combatData),
  objectiveHash: sha256(item.combatData?.胜负条件 || {}),
}));
const classificationSourceHashMismatchCount = manifest.snapshots.reduce(
  (count, snapshot) => {
    const current = caseById.get(snapshot.caseId)?.sourceDataHashes || {};
    return count + Object.entries(snapshot.sourceDataHashes || {}).filter(
      ([characterId, sourceHash]) =>
        String(current?.[characterId] || '') !== String(sourceHash || ''),
    ).length;
  },
  0,
);
const deepReviewCaseIds = [...manifest.deepReviewSelection.selectedCaseIds];
if (deepReviewCaseIds.length !== 8 || deepReviewCaseIds.some(caseId => !caseById.has(caseId))) {
  throw new Error('PHASE9_DEEP_REVIEW_SELECTION_INVALID');
}
  const workerIndex = process.argv.indexOf('--worker-full');
if (workerIndex >= 0) {
  const caseId = String(process.argv[workerIndex + 1] || '').trim();
  const providerId = String(process.argv[workerIndex + 2] || '').trim();
  if (!caseById.has(caseId) || !providers.includes(providerId)) {
    throw new Error(`PHASE9_FULL_BATTLE_WORKER_INPUT_INVALID:${caseId}:${providerId}`);
  }
  const debugDecisionFlagIndex = process.argv.indexOf('--debug-decision-index');
  const debugDecisionIndex = debugDecisionFlagIndex >= 0
    ? Number(process.argv[debugDecisionFlagIndex + 1])
    : -1;
  const roundLimitFlagIndex = process.argv.indexOf('--rounds');
  const roundLimit = roundLimitFlagIndex >= 0
    ? Number(process.argv[roundLimitFlagIndex + 1])
    : 0;
    const record = fullBattleRecord(caseById.get(caseId), providerId, runtime, {
      disableRouteCatalogCache: process.argv.includes('--no-route-cache'),
      disableObservationRouteReuse:
        process.argv.includes('--no-observation-route-reuse'),
      disableCompactObjectiveFastPath:
        process.argv.includes('--no-compact-objective-fast-path'),
      disableEvaluationSession:
        process.argv.includes('--no-evaluation-session'),
      disableSessionMechanicalReuse:
        process.argv.includes('--no-session-mechanical-reuse'),
      verifySessionMechanicalReuse:
        process.argv.includes('--verify-session-mechanical-reuse'),
      disableSessionBehaviorReuse:
        process.argv.includes('--no-session-behavior-reuse'),
      verifySessionBehaviorReuse:
        process.argv.includes('--verify-session-behavior-reuse'),
      collectBehaviorLayerHashes:
        process.argv.includes('--collect-behavior-layer-hashes'),
      collectBehaviorIdentityObservations:
        process.argv.includes('--collect-behavior-identity-observations'),
      collectTerminalMetrics:
        process.argv.includes('--collect-terminal-metrics'),
      collectTerminalIdentityObservations:
        process.argv.includes('--collect-terminal-identity-observations'),
      forceNight: process.argv.includes('--night'),
      collectTargetPressureAudit:
        !process.argv.includes('--no-target-pressure-audit'),
      debugDecisionIndex: Number.isInteger(debugDecisionIndex) && debugDecisionIndex >= 0
        ? debugDecisionIndex
        : undefined,
      debugLedger: process.argv.includes('--debug-ledger'),
      roundLimit: Number.isInteger(roundLimit) && roundLimit > 0
        ? roundLimit
        : undefined,
    });
  process.stdout.write(`${JSON.stringify(record)}\n`);
  process.exit(0);
}
const firstWorkerIndex = process.argv.indexOf('--worker-first');
if (firstWorkerIndex >= 0) {
  const caseId = String(process.argv[firstWorkerIndex + 1] || '').trim();
  if (!caseById.has(caseId)) {
    throw new Error(`PHASE9_FIRST_ACTION_WORKER_INPUT_INVALID:${caseId}`);
  }
  const record = queueHeadCandidateRecord(
    caseById.get(caseId),
    runtime,
    decision,
    preview,
    {
      collectTargetPressureAudit:
        !process.argv.includes('--no-target-pressure-audit'),
    },
  );
  process.stdout.write(`${JSON.stringify(record)}\n`);
  process.exit(0);
}

const firstActions = [];
if (mode !== 'full-battles') {
  const firstActionTasks = manualCases.map(caseDefinition => ({
    caseId: caseDefinition.caseId,
  }));
  firstActions.push(...await runWorkerPool(firstActionTasks, async task => {
    process.stderr.write(`[phase9:first] ${task.caseId}\n`);
    return runFirstActionWorkerAsync(task.caseId);
  }));
}

const fullBattles = [];
if (mode !== 'first-actions') {
  const fullBattleTasks = deepReviewCaseIds.flatMap(caseId =>
    providers.map(providerId => ({ caseId, providerId })),
  );
  fullBattles.push(...await runWorkerPool(fullBattleTasks, async task => {
    process.stderr.write(`[phase9:full] ${task.caseId} ${task.providerId}\n`);
    return runFullBattleWorkerAsync(task.caseId, task.providerId, {
      collectTargetPressureAudit: false,
    });
  }));
}

let cacheEquivalence = null;
if (mode !== 'first-actions') {
  const caseId = 'team_control_overlap';
  const cached = fullBattles.find(record =>
    record.caseId === caseId &&
    record.providerId === 'r8-shadow' &&
    !record.error
  ) || null;
  const fullRecompute = await runFullBattleWorkerAsync(caseId, 'r8-shadow', {
    disableRouteCatalogCache: true,
    collectTargetPressureAudit: false,
  });
  const hashFields = ['ledgerHash', 'decisionSemanticHash', 'terminalHash', 'finalSnapshotHash'];
  const mismatchedHashFields = cached && !fullRecompute.error
    ? hashFields.filter(field => cached[field] !== fullRecompute[field])
    : hashFields;
  cacheEquivalence = {
    caseId,
    providerId: 'r8-shadow',
    cached: cached ? {
      durationMs: cached.durationMs,
      fatalCount: cached.fatalCount,
      instrumentationDecisionHash: cached.decisionHash,
      hashes: Object.fromEntries(hashFields.map(field => [field, cached[field]])),
    } : null,
    fullRecompute: fullRecompute.error ? {
      error: fullRecompute.error,
    } : {
      durationMs: fullRecompute.durationMs,
      fatalCount: fullRecompute.fatalCount,
      instrumentationDecisionHash: fullRecompute.decisionHash,
      hashes: Object.fromEntries(hashFields.map(field => [field, fullRecompute[field]])),
    },
    mismatchedHashFields,
    passed:
      !!cached &&
      !fullRecompute.error &&
      Number(cached.fatalCount || 0) === 0 &&
      Number(fullRecompute.fatalCount || 0) === 0 &&
      mismatchedHashFields.length === 0,
  };
}

const rootCauseClusters = clusterFailures(firstActions, fullBattles);
if (cacheEquivalence && !cacheEquivalence.passed) {
  rootCauseClusters.push({
    clusterId: 'ROUTE_CACHE_LOCAL_FULL_HASH_MISMATCH',
    occurrenceCount: 1,
    affectedCaseIds: [cacheEquivalence.caseId],
    affectedProviders: [cacheEquivalence.providerId],
    items: [{
      caseId: cacheEquivalence.caseId,
      providerId: cacheEquivalence.providerId,
      mismatchedHashFields: cacheEquivalence.mismatchedHashFields,
      fullRecomputeError: cacheEquivalence.fullRecompute?.error || '',
    }],
  });
}
const output = {
  schemaVersion: '8.3-phase9-batch-1',
  generatedAt: new Date().toISOString(),
  mode,
  evidenceNotice:
    'firstActions contains queue-head candidate snapshots only; actual first Decision must be read from fullBattles.decisionSequence[0]. The R7.5 manifest is classification-only; currentInputManifestHash freezes the latest validated CharacterLibrary inputs.',
  providers,
  workerConcurrency,
  manifestHash: sha256(manifest),
  classificationManifestHash: sha256(manifest),
  currentInputManifestHash: sha256(currentInputManifest),
  classificationSourceHashMismatchCount,
  sourceDataHashStatus: 'CURRENT_MANUAL_HASHES_VERIFIED',
  deepReviewCaseIds,
  summary: {
    firstActionCaseCount: firstActions.length,
    firstActionErrorCount: firstActions.filter(item => item.error).length,
    queueHeadSnapshotCount: firstActions.length,
    actualFirstDecisionProofCount: fullBattles.filter(item =>
      !item.error && Array.isArray(item.decisionSequence) && item.decisionSequence.length > 0
    ).length,
    fullBattleRunCount: fullBattles.length,
    workerConcurrency,
    fullBattleErrorCount: fullBattles.filter(item => item.error).length,
    fullBattleFatalCount: fullBattles.reduce(
      (sum, item) => sum + Number(item?.fatalCount || 0),
      0,
    ),
    cacheEquivalenceStatus: !cacheEquivalence
      ? 'NOT_SCHEDULED'
      : cacheEquivalence.passed
        ? 'PASSED'
        : 'FAILED',
    rootCauseClusterCount: rootCauseClusters.length,
    batchCollectionComplete:
      (mode === 'full-battles' || firstActions.length === 24) &&
      (mode === 'first-actions' || fullBattles.length === 16),
  },
  firstActions,
  fullBattles,
  cacheEquivalence,
  rootCauseClusters,
};

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode =
  output.summary.firstActionErrorCount > 0 ||
  output.summary.fullBattleErrorCount > 0 ||
  output.summary.fullBattleFatalCount > 0 ||
  cacheEquivalence?.passed === false
    ? 1
    : 0;

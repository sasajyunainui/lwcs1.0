import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const artifactPath = path.join(repoRoot, 'artifacts', 'r83_phase9_batch.json');
const manifestPath = path.join(toolDir, 'evidence', 'r8', 'r75_real_case_manifest.json');
const providers = Object.freeze(['r74-next-baseline', 'r8-shadow']);
const fullBattleTimeoutMs = 180000;
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

function sha256(value) {
  return crypto.createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
}

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function decisionSummary(result = {}) {
  const audit = result?.decisionAudit || {};
  const selected = audit?.selected || {};
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
    candidateAuditHash: sha256(audit?.candidateAudit || audit?.scoreAudit || []),
  };
}

function firstActionRecord(caseDefinition, runtime, decision, preview) {
  const world = structuredClone(caseDefinition.combatData);
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
  const request = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId,
    objectiveContract: world?.胜负条件 || {},
    battleIntent: { mode: caseDefinition.intent, objectives: world?.胜负条件 || {} },
    beliefState: caseDefinition.initialBelief?.[actorId] || caseDefinition.initialBelief || {},
    actionOpportunity,
    runtimeSnapshot,
    seed: `${caseDefinition.seed}:phase9:first`,
  });
  const prepareDurationMs = Number((performance.now() - prepareStartedAt).toFixed(3));
  const results = Object.fromEntries(providers.map(providerId => {
    const startedAt = performance.now();
    const providerResult = decision.runProvider({ providerId, request });
    return [providerId, {
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
      ...decisionSummary(providerResult),
    }];
  }));
  if (preview.stableHash(world) !== sourceHash) throw new Error('PROVIDER_MUTATED_STATE');
  return {
    caseId: caseDefinition.caseId,
    actorId,
    actorSide: firstEntry.side,
    sourceDataHashes: plain(caseDefinition.sourceDataHashes),
    requestHash: request.requestHash,
    prepareDurationMs,
    routeCacheMetrics: plain(request.routeCacheMetrics || {}),
    candidateEnvelopeMetrics: plain(request.candidateEnvelopeMetrics || {}),
    candidateEnvelopeDeltaCount: Object.values(request.candidateEnvelopeDeltas || {})
      .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0),
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
  const startedAt = performance.now();
  const result = runtime.runBattleCase({
    caseId: caseDefinition.caseId,
    seed: caseDefinition.seed,
    combatData: caseDefinition.combatData,
    mode: 'team_preview',
    rounds: caseDefinition.rounds,
    initialBelief: caseDefinition.initialBelief,
    battleIntent: { mode: caseDefinition.intent },
    selectedAction: caseDefinition.selectedAction,
    settings: {
      providerId,
      disableRouteCatalogCache: options.disableRouteCatalogCache === true,
    },
  });
  const decisions = Array.isArray(result?.decisions) ? result.decisions : [];
  const semanticDecisions = decisions.map(decisionAudit => {
    const copy = plain(decisionAudit);
    delete copy.routeCacheMetrics;
    delete copy.candidateEnvelopeMetrics;
    return copy;
  });
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
    routeMetrics: decisions.reduce((totals, decisionAudit) => {
      const route = decisionAudit?.routeCacheMetrics || {};
      const envelope = decisionAudit?.candidateEnvelopeMetrics || {};
      totals.basePreviewCalls += Number(route.previewCalls || 0);
      totals.baseRecomputedUnitCount += Number(route.recomputedUnitCount || 0);
      totals.envelopePreviewCalls += Number(envelope.previewCalls || 0);
      totals.envelopeReusedRouteCount += Number(envelope.reusedRouteCount || 0);
      totals.envelopeRebuildCount += Number(envelope.rebuildCount || 0);
      return totals;
    }, {
      basePreviewCalls: 0,
      baseRecomputedUnitCount: 0,
      envelopePreviewCalls: 0,
      envelopeReusedRouteCount: 0,
      envelopeRebuildCount: 0,
    }),
    ledgerCount: ledger.length,
    actionQueueNodeCount: Array.isArray(result?.actionQueueTrace)
      ? result.actionQueueTrace.length
      : 0,
    decisionSequence: decisions.map(entry => ({
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
    })),
    fatalCount: Number(result?.audit?.fatalCount || 0),
    fatalCodes,
    fatals: plain(result?.audit?.fatals || []),
    ledgerHash: sha256(ledger),
    decisionHash: sha256(decisions),
    decisionSemanticHash: sha256(semanticDecisions),
    decisionSemanticHashes: semanticDecisions.map(sha256),
    debugDecision: debugDecisionIndex >= 0
      ? semanticDecisions[debugDecisionIndex] || null
      : undefined,
    terminalHash: sha256(result?.terminal || result?.objectiveResolution || null),
    finalSnapshotHash: sha256(result?.finalSnapshot || result?.snapshot || null),
  };
}

function runFullBattleWorker(caseId, providerId, options = {}) {
  const workerArgs = [fileURLToPath(import.meta.url), '--worker-full', caseId, providerId];
  if (options.disableRouteCatalogCache === true) workerArgs.push('--no-route-cache');
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
const caseById = new Map(manualCases.map(item => [item.caseId, item]));
const manifestCaseIds = manifest.snapshots.map(item => item.caseId);
const manualCaseIds = manualCases.map(item => item.caseId);
if (
  manifestCaseIds.length !== 24 ||
  JSON.stringify([...manifestCaseIds].sort()) !== JSON.stringify([...manualCaseIds].sort())
) {
  throw new Error('PHASE9_REAL_CASE_MANIFEST_MISMATCH');
}
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
  const record = fullBattleRecord(caseById.get(caseId), providerId, runtime, {
    disableRouteCatalogCache: process.argv.includes('--no-route-cache'),
    debugDecisionIndex: Number.isInteger(debugDecisionIndex) && debugDecisionIndex >= 0
      ? debugDecisionIndex
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
  const record = firstActionRecord(caseById.get(caseId), runtime, decision, preview);
  process.stdout.write(`${JSON.stringify(record)}\n`);
  process.exit(0);
}

const firstActions = [];
if (mode !== 'full-battles') {
  for (const caseDefinition of manualCases) {
    process.stderr.write(`[phase9:first] ${caseDefinition.caseId}\n`);
    try {
      firstActions.push(firstActionRecord(caseDefinition, runtime, decision, preview));
    } catch (error) {
      firstActions.push({
        caseId: caseDefinition.caseId,
        error: String(error?.stack || error?.message || error),
      });
    }
  }
}

const fullBattles = [];
if (mode !== 'first-actions') {
  for (const caseId of deepReviewCaseIds) {
    for (const providerId of providers) {
      process.stderr.write(`[phase9:full] ${caseId} ${providerId}\n`);
      fullBattles.push(runFullBattleWorker(caseId, providerId));
    }
  }
}

let cacheEquivalence = null;
if (mode !== 'first-actions') {
  const caseId = 'team_control_overlap';
  const cached = fullBattles.find(record =>
    record.caseId === caseId &&
    record.providerId === 'r8-shadow' &&
    !record.error
  ) || null;
  const fullRecompute = runFullBattleWorker(caseId, 'r8-shadow', {
    disableRouteCatalogCache: true,
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
  providers,
  manifestHash: sha256(manifest),
  deepReviewCaseIds,
  summary: {
    firstActionCaseCount: firstActions.length,
    firstActionErrorCount: firstActions.filter(item => item.error).length,
    fullBattleRunCount: fullBattles.length,
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

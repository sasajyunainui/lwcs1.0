import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
  repoRoot,
  sha256,
  sourceHashes,
} from './r83_rc6_battle_harness.mjs';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0
    ? String(process.argv[index + 1] || '').trim()
    : fallback;
}

function positiveInteger(name, fallback) {
  const value = Number(argValue(name, fallback));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`RC6_R9V2_REUSE_ARGUMENT_INVALID:${name}`);
  }
  return value;
}

function round(value) {
  return Number(Number(value || 0).toFixed(3));
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil(sorted.length * ratio) - 1,
    ),
  );
  return sorted[index];
}

function replaceOnce(source, marker, replacement, label) {
  const index = source.indexOf(marker);
  if (index < 0) {
    throw new Error(`RC6_R9V2_REUSE_SOURCE_MARKER_MISSING:${label}`);
  }
  if (source.indexOf(marker, index + marker.length) >= 0) {
    throw new Error(`RC6_R9V2_REUSE_SOURCE_MARKER_DUPLICATE:${label}`);
  }
  return source.slice(0, index) +
    replacement +
    source.slice(index + marker.length);
}

const injectionMarker = '  function r9v2Dominates(left, right) {';

function injectBeforeDominance(source, block) {
  return replaceOnce(
    source,
    injectionMarker,
    `${block}\n\n${injectionMarker}`,
    'before-r9v2-dominance',
  );
}

function stageProfilerBlock({ recordKeys }) {
  return `
  const __r83Rc6StageProbeState = {
    stack: [],
    stages: new Map(),
    keys: new Map(),
  };
  function __r83Rc6ProbeStage(name, fn, keyBuilder = null) {
    return function (...args) {
      if (keyBuilder) {
        const key = keyBuilder(args);
        const keys = __r83Rc6StageProbeState.keys.get(name) || new Map();
        keys.set(key, Number(keys.get(key) || 0) + 1);
        __r83Rc6StageProbeState.keys.set(name, keys);
      }
      const frame = {
        name,
        startedAt: performance.now(),
        childMs: 0,
      };
      __r83Rc6StageProbeState.stack.push(frame);
      try {
        return fn(...args);
      } finally {
        const elapsedMs = performance.now() - frame.startedAt;
        __r83Rc6StageProbeState.stack.pop();
        const current = __r83Rc6StageProbeState.stages.get(name) || {
          callCount: 0,
          inclusiveMs: 0,
          exclusiveMs: 0,
          maxInclusiveMs: 0,
        };
        current.callCount += 1;
        current.inclusiveMs += elapsedMs;
        current.exclusiveMs += Math.max(0, elapsedMs - frame.childMs);
        current.maxInclusiveMs = Math.max(
          current.maxInclusiveMs,
          elapsedMs,
        );
        __r83Rc6StageProbeState.stages.set(name, current);
        const parent = __r83Rc6StageProbeState.stack[
          __r83Rc6StageProbeState.stack.length - 1
        ];
        if (parent) parent.childMs += elapsedMs;
      }
    };
  }
  function __r83Rc6ProjectedPoolKey(args) {
    const input = args[0] || {};
    const request = input.request || {};
    const target = findUnitInWorld(
      input.projectedWorld || {},
      input.targetId,
    );
    return preview.stableHash({
      baseWorldRevision: worldRevisionFor(
        request.visibleWorld || {},
      ),
      targetId: String(input.targetId || '').trim(),
      projectedTarget: target || null,
      mutationIdentity: String(input.identity || '').trim(),
      actorId: String(request.actorId || '').trim(),
      actorSide: String(request.actorSide || '').trim(),
      actionOpportunity: request.actionOpportunity || {},
      battleIntent: request.battleIntent || {},
      beliefRevision: beliefRevisionFor(
        input.beliefState || request.beliefState || {},
      ),
      creationProductId:
        String(request.creationProductId || '').trim(),
    });
  }
  function __r83Rc6CreationProjectionKey(args) {
    const request = args[0] || {};
    const entry = args[1] || {};
    return preview.stableHash({
      worldRevision: worldRevisionFor(request.visibleWorld || {}),
      actorId: String(request.actorId || '').trim(),
      actorSide: String(request.actorSide || '').trim(),
      actionOpportunity: request.actionOpportunity || {},
      evaluationContext: request.evaluationContext || {},
      battleIntent: request.battleIntent || {},
      beliefRevision: beliefRevisionFor(request.beliefState || {}),
      sourceActorId: String(entry.actorId || '').trim(),
      resourceCosts: entry.resourceCosts || {},
      creationCarrier: entry.creationCarrier || null,
    });
  }
  function __r83Rc6CreationRouteKey(args) {
    const input = args[0] || {};
    return preview.stableHash({
      worldRevision: worldRevisionFor(input.worldSnapshot || {}),
      recipientId: String(input.recipientId || '').trim(),
      productId: String(input.productId || '').trim(),
      actionOpportunity: input.actionOpportunity || {},
      battleIntent: input.battleIntent || {},
      beliefRevision: beliefRevisionFor(input.beliefState || {}),
    });
  }
  r9v2BuildMechanicalEntry = __r83Rc6ProbeStage(
    'r9v2BuildMechanicalEntry',
    r9v2BuildMechanicalEntry,
  );
  r9v2PrepareObserverPool = __r83Rc6ProbeStage(
    'r9v2PrepareObserverPool',
    r9v2PrepareObserverPool,
  );
  r9v2PrepareCurrentIncomingProjection = __r83Rc6ProbeStage(
    'r9v2PrepareCurrentIncomingProjection',
    r9v2PrepareCurrentIncomingProjection,
  );
  r9v2ProjectHealthAndTerminal = __r83Rc6ProbeStage(
    'r9v2ProjectHealthAndTerminal',
    r9v2ProjectHealthAndTerminal,
  );
  r9v2CurrentIncomingResponseProjection = __r83Rc6ProbeStage(
    'r9v2CurrentIncomingResponseProjection',
    r9v2CurrentIncomingResponseProjection,
  );
  r9v2ProjectedBehaviorPool = __r83Rc6ProbeStage(
    'r9v2ProjectedBehaviorPool',
    r9v2ProjectedBehaviorPool,
    ${recordKeys ? '__r83Rc6ProjectedPoolKey' : 'null'},
  );
  r9v2BehaviorPoolDeltaProjection = __r83Rc6ProbeStage(
    'r9v2BehaviorPoolDeltaProjection',
    r9v2BehaviorPoolDeltaProjection,
  );
  r9v2BestCreationConsumerRoute = __r83Rc6ProbeStage(
    'r9v2BestCreationConsumerRoute',
    r9v2BestCreationConsumerRoute,
    ${recordKeys ? '__r83Rc6CreationRouteKey' : 'null'},
  );
  r9v2CreationConsumerProjection = __r83Rc6ProbeStage(
    'r9v2CreationConsumerProjection',
    r9v2CreationConsumerProjection,
    ${recordKeys ? '__r83Rc6CreationProjectionKey' : 'null'},
  );
  r9v2SummonWindowProjection = __r83Rc6ProbeStage(
    'r9v2SummonWindowProjection',
    r9v2SummonWindowProjection,
  );
  r9v2CandidateValueProof = __r83Rc6ProbeStage(
    'r9v2CandidateValueProof',
    r9v2CandidateValueProof,
  );
  prepareR9v2ControlResourceSlice = __r83Rc6ProbeStage(
    'prepareR9v2ControlResourceSlice',
    prepareR9v2ControlResourceSlice,
  );
  root.__LWCS_R9V2_PHASE3_STAGE_PROBE__ = Object.freeze({
    reset() {
      __r83Rc6StageProbeState.stack.length = 0;
      __r83Rc6StageProbeState.stages.clear();
      __r83Rc6StageProbeState.keys.clear();
    },
    snapshot() {
      const stages = Object.fromEntries(
        [...__r83Rc6StageProbeState.stages.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, value]) => [name, {
            callCount: value.callCount,
            inclusiveMs: Number(value.inclusiveMs.toFixed(3)),
            exclusiveMs: Number(value.exclusiveMs.toFixed(3)),
            maxInclusiveMs: Number(value.maxInclusiveMs.toFixed(3)),
          }]),
      );
      const keys = Object.fromEntries(
        [...__r83Rc6StageProbeState.keys.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, counts]) => {
            const rows = [...counts.entries()]
              .map(([key, count]) => ({ key, count }))
              .sort((left, right) =>
                right.count - left.count ||
                left.key.localeCompare(right.key)
              );
            const callCount = rows.reduce(
              (sum, row) => sum + row.count,
              0,
            );
            return [name, {
              callCount,
              uniqueKeyCount: rows.length,
              duplicateCallCount: callCount - rows.length,
              reuseCeilingRatio: callCount > 0
                ? (callCount - rows.length) / callCount
                : 0,
              repeatedKeys: rows.filter(row => row.count > 1).slice(0, 20),
            }];
          }),
      );
      return { stages, keys };
    },
  });`;
}

function reuseBlock(mode) {
  const useProjectedPool = [
    'projected-pool',
    'combined',
  ].includes(mode);
  const useCreationProjection = [
    'creation-projection',
    'combined',
  ].includes(mode);
  const useCreationRoute = [
    'creation-route',
    'combined',
  ].includes(mode);
  return `
  const __r83Rc6ReuseState = {
    projectedPool: new Map(),
    creationProjection: new Map(),
    creationRoute: new Map(),
    counters: {
      projectedPoolCalls: 0,
      projectedPoolHits: 0,
      creationProjectionCalls: 0,
      creationProjectionHits: 0,
      creationRouteCalls: 0,
      creationRouteHits: 0,
    },
  };
  function __r83Rc6ProjectedReuseKey(input = {}) {
    const request = input.request || {};
    const target = findUnitInWorld(
      input.projectedWorld || {},
      input.targetId,
    );
    return preview.stableHash({
      baseWorldRevision: worldRevisionFor(
        request.visibleWorld || {},
      ),
      targetId: String(input.targetId || '').trim(),
      projectedTarget: target || null,
      mutationIdentity: String(input.identity || '').trim(),
      actorId: String(request.actorId || '').trim(),
      actorSide: String(request.actorSide || '').trim(),
      actionOpportunity: request.actionOpportunity || {},
      battleIntent: request.battleIntent || {},
      beliefRevision: beliefRevisionFor(
        input.beliefState || request.beliefState || {},
      ),
      creationProductId:
        String(request.creationProductId || '').trim(),
    });
  }
  function __r83Rc6CreationProjectionReuseKey(
    request = {},
    entry = {},
  ) {
    return preview.stableHash({
      worldRevision: worldRevisionFor(request.visibleWorld || {}),
      actorId: String(request.actorId || '').trim(),
      actorSide: String(request.actorSide || '').trim(),
      actionOpportunity: request.actionOpportunity || {},
      evaluationContext: request.evaluationContext || {},
      battleIntent: request.battleIntent || {},
      beliefRevision: beliefRevisionFor(request.beliefState || {}),
      sourceActorId: String(entry.actorId || '').trim(),
      resourceCosts: entry.resourceCosts || {},
      creationCarrier: entry.creationCarrier || null,
    });
  }
  function __r83Rc6CreationRouteReuseKey(input = {}) {
    return preview.stableHash({
      worldRevision: worldRevisionFor(input.worldSnapshot || {}),
      recipientId: String(input.recipientId || '').trim(),
      productId: String(input.productId || '').trim(),
      actionOpportunity: input.actionOpportunity || {},
      battleIntent: input.battleIntent || {},
      beliefRevision: beliefRevisionFor(input.beliefState || {}),
    });
  }
  ${useProjectedPool ? `
  {
    const original = r9v2ProjectedBehaviorPool;
    r9v2ProjectedBehaviorPool = function (input = {}) {
      __r83Rc6ReuseState.counters.projectedPoolCalls += 1;
      const key = __r83Rc6ProjectedReuseKey(input);
      if (__r83Rc6ReuseState.projectedPool.has(key)) {
        __r83Rc6ReuseState.counters.projectedPoolHits += 1;
        return __r83Rc6ReuseState.projectedPool.get(key);
      }
      const result = original(input);
      __r83Rc6ReuseState.projectedPool.set(key, result);
      return result;
    };
  }` : ''}
  ${useCreationProjection ? `
  {
    const original = r9v2CreationConsumerProjection;
    r9v2CreationConsumerProjection = function (request = {}, entry = {}) {
      __r83Rc6ReuseState.counters.creationProjectionCalls += 1;
      const key = __r83Rc6CreationProjectionReuseKey(request, entry);
      if (__r83Rc6ReuseState.creationProjection.has(key)) {
        __r83Rc6ReuseState.counters.creationProjectionHits += 1;
        return __r83Rc6ReuseState.creationProjection.get(key);
      }
      const result = original(request, entry);
      __r83Rc6ReuseState.creationProjection.set(key, result);
      return result;
    };
  }` : ''}
  ${useCreationRoute ? `
  {
    const original = r9v2BestCreationConsumerRoute;
    r9v2BestCreationConsumerRoute = function (input = {}) {
      __r83Rc6ReuseState.counters.creationRouteCalls += 1;
      const key = __r83Rc6CreationRouteReuseKey(input);
      if (__r83Rc6ReuseState.creationRoute.has(key)) {
        __r83Rc6ReuseState.counters.creationRouteHits += 1;
        return __r83Rc6ReuseState.creationRoute.get(key);
      }
      const result = original(input);
      __r83Rc6ReuseState.creationRoute.set(key, result);
      return result;
    };
  }` : ''}
  root.__LWCS_R9V2_PHASE3_REUSE_PROBE__ = Object.freeze({
    reset() {
      __r83Rc6ReuseState.projectedPool.clear();
      __r83Rc6ReuseState.creationProjection.clear();
      __r83Rc6ReuseState.creationRoute.clear();
      Object.keys(__r83Rc6ReuseState.counters).forEach(key => {
        __r83Rc6ReuseState.counters[key] = 0;
      });
    },
    snapshot() {
      return {
        mode: ${JSON.stringify(mode)},
        counters: { ...__r83Rc6ReuseState.counters },
        storeSizes: {
          projectedPool: __r83Rc6ReuseState.projectedPool.size,
          creationProjection:
            __r83Rc6ReuseState.creationProjection.size,
          creationRoute: __r83Rc6ReuseState.creationRoute.size,
        },
      };
    },
  });`;
}

function ceilingBlock(mode) {
  const noBehavior = [
    'no-behavior',
    'no-behavior-or-creation',
  ].includes(mode);
  const noCreation = [
    'no-creation',
    'no-behavior-or-creation',
  ].includes(mode);
  return `
  ${noBehavior ? `
  r9v2BehaviorPoolDeltaProjection = function () {
    return Object.freeze({
      routeDeltaHEPP: 0,
      facts: Object.freeze([]),
      diagnostics: Object.freeze([]),
      targetResolutionProjections: Object.freeze([]),
      projectedContributionIndexes: Object.freeze([]),
    });
  };` : ''}
  ${noCreation ? `
  r9v2CreationConsumerProjection = function () {
    return null;
  };` : ''}`;
}

function decisionSourceWith(block) {
  const source = fs.readFileSync(
    path.join(repoRoot, 'BattleDecision_Module.js'),
    'utf8',
  );
  return injectBeforeDominance(source, block);
}

function decisionSourceForReuseMode(mode) {
  if (mode !== 'creation-route-shared-proof-cache') {
    return decisionSourceWith(reuseBlock(mode));
  }
  const source = fs.readFileSync(
    path.join(repoRoot, 'BattleDecision_Module.js'),
    'utf8',
  );
  const current = `    const proofs = built.entries
      .filter(entry => entry.hardInvalid !== true)
      .map(entry => r9v2CandidateValueProof(
        routeRequest,
        built.pool,
        entry,
        {
          bestHealthByUnit: new Map(),
          behaviorPoolByIdentity: new Map(),
          pendingNaturalActorIds: null,
        },
      ));`;
  const projected = `    const projectionCache = {
      bestHealthByUnit: new Map(),
      behaviorPoolByIdentity: new Map(),
      pendingNaturalActorIds: null,
    };
    const proofs = built.entries
      .filter(entry => entry.hardInvalid !== true)
      .map(entry => r9v2CandidateValueProof(
        routeRequest,
        built.pool,
        entry,
        projectionCache,
      ));`;
  return replaceOnce(
    source,
    current,
    projected,
    'creation-route-shared-proof-cache',
  );
}

function transactionHashes(draft, sealedPackage) {
  return {
    draftHash: String(draft?.draftHash || ''),
    reportHash: String(sealedPackage?.reportHash || ''),
    ledgerHash: sha256(draft?.ledger || []),
    terminalHash: sha256(draft?.terminalResult || {}),
    finalSnapshotHash: sha256(draft?.finalSnapshot || {}),
    selectedDecisionHash: sha256(
      (draft?.decisionAudit || []).map(decision => ({
        actorId: decision?.actorId || '',
        opportunityId: decision?.opportunityId || '',
        candidateId:
          decision?.selected?.candidateId ||
          decision?.decision?.candidateId ||
          decision?.candidateId ||
          '',
      })),
    ),
  };
}

function executeMeasured(sandbox, definition) {
  const input = formalInput(definition, 'r9v2-shadow');
  delete input.settings.collectDecisionReplayIdentity;
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const startedAt = performance.now();
  const draft = runtime.executeBattleDraftR8(structuredClone(input));
  const reportDto = report.build({
    draft,
    visibilityMode: 'PLAYER',
  });
  const reportAudit = report.auditProjection(reportDto);
  const sealedPackage = runtime.sealBattleResult({
    draft,
    reportAudit,
  });
  runtime.verifySealedBattlePackage(sealedPackage);
  const elapsedMs = performance.now() - startedAt;
  assert.equal(
    Number(draft?.runtimeAudit?.fatalCount || 0),
    0,
    `${definition.caseId}:runtime fatal`,
  );
  assert.equal(
    reportAudit?.passed,
    true,
    `${definition.caseId}:report audit`,
  );
  return {
    elapsedMs: round(elapsedMs),
    hashes: transactionHashes(draft, sealedPackage),
    decisionCount: Array.isArray(draft?.decisionAudit)
      ? draft.decisionAudit.length
      : 0,
    ledgerEventCount: Array.isArray(draft?.ledger)
      ? draft.ledger.length
      : 0,
  };
}

function summarizeRuns(runs) {
  const elapsed = runs.map(run => run.elapsedMs);
  return {
    elapsedMs: elapsed,
    medianMs: round(percentile(elapsed, 0.5)),
    p95Ms: round(percentile(elapsed, 0.95)),
  };
}

function resetProbe(sandbox) {
  sandbox.__LWCS_R9V2_PHASE3_STAGE_PROBE__?.reset?.();
  sandbox.__LWCS_R9V2_PHASE3_REUSE_PROBE__?.reset?.();
}

function runVariant({
  label,
  sourceOverride = null,
  caseDefinitions,
  warmupCount,
  measurementCount,
  captureStageProbe = false,
}) {
  const sandbox = loadBattleSandbox({
    sourceOverrides: sourceOverride
      ? { 'BattleDecision_Module.js': sourceOverride }
      : {},
  });
  const cases = [];
  for (const definition of caseDefinitions) {
    for (let index = 0; index < warmupCount; index += 1) {
      resetProbe(sandbox);
      executeMeasured(sandbox, definition);
    }
    const measurements = [];
    let stageProbe = null;
    let reuseProbe = null;
    for (let index = 0; index < measurementCount; index += 1) {
      resetProbe(sandbox);
      measurements.push(executeMeasured(sandbox, definition));
      if (captureStageProbe && index === 0) {
        stageProbe = clone(
          sandbox.__LWCS_R9V2_PHASE3_STAGE_PROBE__?.snapshot?.() ||
          null,
        );
      }
      if (index === 0) {
        reuseProbe = clone(
          sandbox.__LWCS_R9V2_PHASE3_REUSE_PROBE__?.snapshot?.() ||
          null,
        );
      }
    }
    const referenceHashes = measurements[0]?.hashes || {};
    measurements.slice(1).forEach((run, index) => {
      assert.deepEqual(
        run.hashes,
        referenceHashes,
        `${label}:${definition.caseId}:measurement-${index + 2}`,
      );
    });
    cases.push({
      caseId: definition.caseId,
      summary: summarizeRuns(measurements),
      referenceHashes,
      decisionCount: measurements[0]?.decisionCount || 0,
      ledgerEventCount: measurements[0]?.ledgerEventCount || 0,
      stageProbe,
      reuseProbe,
    });
  }
  return { label, cases };
}

function runInterleavedComparison({
  mode,
  caseDefinitions,
  warmupCount,
  measurementCount,
}) {
  const compareCurrentToHead = mode === 'current-vs-head';
  const baselineSandbox = compareCurrentToHead
    ? loadBattleSandbox({
        sourceOverrides: {
          'BattleDecision_Module.js': execFileSync(
            'git',
            ['show', 'HEAD:BattleDecision_Module.js'],
            {
              cwd: repoRoot,
              encoding: 'utf8',
              maxBuffer: 64 * 1024 * 1024,
            },
          ),
        },
      })
    : loadBattleSandbox();
  const variantSandbox = compareCurrentToHead
    ? loadBattleSandbox()
    : loadBattleSandbox({
        sourceOverrides: {
          'BattleDecision_Module.js':
            decisionSourceForReuseMode(mode),
        },
      });
  const cases = [];
  for (const definition of caseDefinitions) {
    for (let index = 0; index < warmupCount; index += 1) {
      resetProbe(baselineSandbox);
      executeMeasured(baselineSandbox, definition);
      resetProbe(variantSandbox);
      executeMeasured(variantSandbox, definition);
    }
    const baselineRuns = [];
    const variantRuns = [];
    for (let index = 0; index < measurementCount; index += 1) {
      const order = index % 2 === 0
        ? [
            ['baseline', baselineSandbox],
            ['variant', variantSandbox],
          ]
        : [
            ['variant', variantSandbox],
            ['baseline', baselineSandbox],
          ];
      order.forEach(([label, sandbox]) => {
        resetProbe(sandbox);
        const run = executeMeasured(sandbox, definition);
        if (label === 'baseline') baselineRuns.push(run);
        else variantRuns.push(run);
      });
    }
    const referenceHashes = baselineRuns[0]?.hashes || {};
    [...baselineRuns, ...variantRuns].forEach((run, index) => {
      assert.deepEqual(
        run.hashes,
        referenceHashes,
        `interleaved:${mode}:${definition.caseId}:${index}`,
      );
    });
    const pairedBenefitRatios = baselineRuns.map((run, index) => {
      const baselineMs = Number(run?.elapsedMs || 0);
      const variantMs = Number(variantRuns[index]?.elapsedMs || 0);
      return baselineMs > 0
        ? round((baselineMs - variantMs) / baselineMs)
        : 0;
    });
    const baselineSummary = summarizeRuns(baselineRuns);
    const variantSummary = summarizeRuns(variantRuns);
    cases.push({
      caseId: definition.caseId,
      baseline: baselineSummary,
      variant: variantSummary,
      pairedBenefitRatios,
      medianPairedBenefitRatio: round(
        percentile(pairedBenefitRatios, 0.5),
      ),
      medianBenefitRatio: baselineSummary.medianMs > 0
        ? round(
            (
              baselineSummary.medianMs -
              variantSummary.medianMs
            ) / baselineSummary.medianMs,
          )
        : 0,
      semanticHashesEqual: true,
      referenceHashes,
    });
  }
  return {
    schemaVersion: 'R9v2InterleavedReuseComparisonV1',
    mode,
    orderPolicy: 'AB,BA alternating by measurement index',
    cases,
  };
}

const caseIds = argValue(
  'cases',
  'raid_summon_heavy',
).split(',').map(value => value.trim()).filter(Boolean);
const sections = new Set(
  argValue(
    'sections',
    'stage,keys,reuse,ceilings',
  ).split(',').map(value => value.trim()).filter(Boolean),
);
const selectedReuseModes = argValue(
  'reuse-modes',
  'projected-pool,creation-projection,creation-route,combined,creation-route-shared-proof-cache',
).split(',').map(value => value.trim()).filter(Boolean);
const selectedCeilingModes = argValue(
  'ceiling-modes',
  'no-behavior,no-creation,no-behavior-or-creation',
).split(',').map(value => value.trim()).filter(Boolean);
const interleavedReuseMode = argValue(
  'interleaved-reuse-mode',
  '',
);
const warmupCount = positiveInteger('warmups', 1);
const measurementCount = positiveInteger('measurements', 3);
if (!measurementCount) {
  throw new Error('RC6_R9V2_REUSE_MEASUREMENTS_REQUIRED');
}
const outputPath = path.resolve(
  repoRoot,
  argValue(
    'output',
    'tools/evidence/r8/r83_rc6_r9v2_projection_reuse_ceiling_2026-07-29.json',
  ),
);
const discoverySandbox = loadBattleSandbox();
const casesById = manualCasesById(discoverySandbox);
const missingCaseIds = caseIds.filter(caseId => !casesById.has(caseId));
if (missingCaseIds.length) {
  throw new Error(
    `RC6_R9V2_REUSE_CASE_MISSING:${missingCaseIds.join(',')}`,
  );
}
const caseDefinitions = caseIds.map(caseId => casesById.get(caseId));

if (interleavedReuseMode) {
  const comparison = runInterleavedComparison({
    mode: interleavedReuseMode,
    caseDefinitions,
    warmupCount,
    measurementCount,
  });
  const evidence = {
    schemaVersion: 'R9v2ProjectionReuseInterleavedEvidenceV1',
    generatedAt: new Date().toISOString(),
    providerId: 'r9v2-shadow',
    sourceHashes: sourceHashes(),
    toolHashes: {
      'tools/probe_r83_rc6_r9v2_projection_reuse_ceiling.mjs':
        sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
      'tools/r83_rc6_battle_harness.mjs':
        sha256(fs.readFileSync(
          path.join(repoRoot, 'tools/r83_rc6_battle_harness.mjs'),
        )),
    },
    runConfig: {
      caseIds,
      interleavedReuseMode,
      warmupCount,
      measurementCount,
      singleProcessPerBattle: true,
      concurrentBattleProcesses: false,
      collectDecisionReplayIdentity: false,
      timerScope:
        'Draft -> Report.build -> auditProjection -> Seal -> verify',
      minimumAcceptedEndToEndBenefitRatio: 0.03,
    },
    comparison,
    factsOnly: true,
    automaticConclusionGenerated: false,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  process.stdout.write(`${JSON.stringify({
    outputPath,
    evidenceHash: sha256(evidence),
    mode: interleavedReuseMode,
    cases: comparison.cases.map(item => ({
      caseId: item.caseId,
      baselineMedianMs: item.baseline.medianMs,
      variantMedianMs: item.variant.medianMs,
      medianBenefitRatio: item.medianBenefitRatio,
      medianPairedBenefitRatio: item.medianPairedBenefitRatio,
      semanticHashesEqual: item.semanticHashesEqual,
    })),
  }, null, 2)}\n`);
  process.exit(0);
}

const baseline = runVariant({
  label: 'baseline',
  caseDefinitions,
  warmupCount,
  measurementCount,
});
const stageTiming = sections.has('stage')
  ? runVariant({
      label: 'stage-timing',
      sourceOverride: decisionSourceWith(
        stageProfilerBlock({ recordKeys: false }),
      ),
      caseDefinitions,
      warmupCount,
      measurementCount: 1,
      captureStageProbe: true,
    })
  : { label: 'stage-timing', cases: [], skipped: true };
const keyRepetition = sections.has('keys')
  ? runVariant({
      label: 'key-repetition',
      sourceOverride: decisionSourceWith(
        stageProfilerBlock({ recordKeys: true }),
      ),
      caseDefinitions,
      warmupCount,
      measurementCount: 1,
      captureStageProbe: true,
    })
  : { label: 'key-repetition', cases: [], skipped: true };

const reuseVariants = sections.has('reuse')
  ? selectedReuseModes.map(mode => runVariant({
  label: `reuse:${mode}`,
  sourceOverride: decisionSourceForReuseMode(mode),
  caseDefinitions,
  warmupCount,
  measurementCount,
    }))
  : [];
const ceilingVariants = sections.has('ceilings')
  ? selectedCeilingModes.map(mode => runVariant({
  label: `ceiling:${mode}`,
  sourceOverride: decisionSourceWith(ceilingBlock(mode)),
  caseDefinitions,
  warmupCount,
  measurementCount,
    }))
  : [];

const baselineByCase = new Map(
  baseline.cases.map(item => [item.caseId, item]),
);
reuseVariants.forEach(variant => {
  variant.cases.forEach(item => {
    assert.deepEqual(
      item.referenceHashes,
      baselineByCase.get(item.caseId)?.referenceHashes,
      `${variant.label}:${item.caseId}:semantic hash mismatch`,
    );
  });
});

function withDelta(variant, semanticEqualityRequired) {
  return {
    ...variant,
    semanticEqualityRequired,
    cases: variant.cases.map(item => {
      const baselineCase = baselineByCase.get(item.caseId);
      const baselineMedian = Number(
        baselineCase?.summary?.medianMs || 0,
      );
      const median = Number(item?.summary?.medianMs || 0);
      return {
        ...item,
        medianDeltaPercent: baselineMedian > 0
          ? round(100 * (median - baselineMedian) / baselineMedian)
          : 0,
        medianBenefitRatio: baselineMedian > 0
          ? round((baselineMedian - median) / baselineMedian)
          : 0,
        semanticHashesEqual:
          JSON.stringify(item.referenceHashes) ===
          JSON.stringify(baselineCase?.referenceHashes || {}),
      };
    }),
  };
}

const evidence = {
  schemaVersion: 'R9v2ProjectionReuseCeilingEvidenceV1',
  generatedAt: new Date().toISOString(),
  providerId: 'r9v2-shadow',
  sourceHashes: sourceHashes(),
  toolHashes: {
    'tools/probe_r83_rc6_r9v2_projection_reuse_ceiling.mjs':
      sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    'tools/r83_rc6_battle_harness.mjs':
      sha256(fs.readFileSync(
        path.join(repoRoot, 'tools/r83_rc6_battle_harness.mjs'),
      )),
  },
  runConfig: {
    caseIds,
    sections: [...sections],
    selectedReuseModes,
    selectedCeilingModes,
    warmupCount,
    measurementCount,
    singleProcess: true,
    collectDecisionReplayIdentity: false,
    timerScope:
      'Draft -> Report.build -> auditProjection -> Seal -> verify',
    reuseScope: 'single battle transaction',
    minimumAcceptedEndToEndBenefitRatio: 0.03,
  },
  baseline,
  stageTiming,
  keyRepetition,
  reuseVariants: reuseVariants.map(variant =>
    withDelta(variant, true)
  ),
  absoluteCeilingVariants: ceilingVariants.map(variant =>
    withDelta(variant, false)
  ),
  interpretationLimits: [
    '绝对上界变体故意移除价值分支，Hash变化是预期结果，只用于证明该分支最多能节省多少时间。',
    '复用变体使用内容寻址键并要求Draft、Report、Ledger、终局、选择和最终快照Hash全部相同。',
    '本产物只输出调用、Hash、时间和重复率，不生成通过、合理或实施建议。',
  ],
  factsOnly: true,
  automaticConclusionGenerated: false,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify({
  outputPath,
  evidenceHash: sha256(evidence),
  baseline: baseline.cases.map(item => ({
    caseId: item.caseId,
    medianMs: item.summary.medianMs,
    p95Ms: item.summary.p95Ms,
  })),
  reuse: evidence.reuseVariants.map(variant => ({
    label: variant.label,
    cases: variant.cases.map(item => ({
      caseId: item.caseId,
      medianMs: item.summary.medianMs,
      medianBenefitRatio: item.medianBenefitRatio,
      semanticHashesEqual: item.semanticHashesEqual,
      reuseProbe: item.reuseProbe,
    })),
  })),
  ceilings: evidence.absoluteCeilingVariants.map(variant => ({
    label: variant.label,
    cases: variant.cases.map(item => ({
      caseId: item.caseId,
      medianMs: item.summary.medianMs,
      medianBenefitRatio: item.medianBenefitRatio,
    })),
  })),
}, null, 2)}\n`);

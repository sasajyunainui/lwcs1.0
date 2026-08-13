(function (root) {
  'use strict';

  // Frozen BehaviorProviderV1 revision 3: provider-neutral R9_CANDIDATE selection.
  // Pure functions only: no provider registration, no runtime/decision coupling,
  // no wall-clock or nondeterministic sources, no candidate reduction.
  // workUnits ledger (exact increments from real loops, never output-shape derived):
  //   stage0 +1/key; mechanical +1/column (12); components +1/S1-S6 (6); exclusion
  //   +1/candidate +1/legality flag; score +1/weighted term (6); pareto +1/pair
  //   +1/dimension check; band +1/score-pass item +1/dimension delta check;
  //   draw +1/min, mass, probability pass and +1/CDF step. Snapshot cloning,
  //   class maps, sorts and record building are not counted.

  const CONTRACT = Object.freeze({
    schemaVersion: 'BehaviorProviderV1',
    contractId: 'RC6-BEHAVIOR-PROVIDER-V1',
    contractRevision: 3,
    providerId: 'behavior-provider-v1',
    kind: 'CANDIDATE_ONLY',
    selectionScope: 'MECHANICAL_NEUTRAL_ONLY',
  });
  const EPSILON = 0.02;
  const DELTA = 0.05;
  const KAPPA = 2;
  const RHO = 0.01;
  const REF_SPREAD = 1;
  const CAP_S4 = 1;
  const BASE_WEIGHTS = Object.freeze([0.3, 0.2, 0.2, 0.1, 0.1, 0.1]);
  const INFLUENCE = Object.freeze({ alpha: 2, beta: 0.6, gamma: 0.4, gammaPrime: 0.3, lambda: 0.6, mu: 0.4 });
  const COMPONENTS = Object.freeze(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  // +1 = MAXIMIZE, -1 = MINIMIZE. Direction feeds Pareto dominance and delta protection only.
  const DIRECTIONS = Object.freeze([1, 1, 1, 1, 1, -1]);
  const CAUSAL_OWNERS = Object.freeze({
    S1: 'ACTION_POOL_DELTA',
    S2: 'STATE_DELTA',
    S3: 'STATE_DELTA',
    S4: 'NONE',
    S5: 'STATE_DELTA',
    S6: 'ACTION_POOL_DELTA',
  });
  const CAUSAL_OWNER_SET = Object.freeze(['STATE_DELTA', 'ACTION_POOL_DELTA', 'TERMINAL_DELTA', 'NONE']);
  const FORBIDDEN_INPUTS = Object.freeze({
    teacherOutput: 'TEACHER_INPUT_REJECTED',
    precomputedHEPP: 'PRECOMPUTED_HEPP_REJECTED',
    route: 'ROUTE_INPUT_REJECTED',
    future: 'ROUTE_INPUT_REJECTED',
    resultWorld: 'ROUTE_INPUT_REJECTED',
    kernelRouteValue: 'ROUTE_INPUT_REJECTED',
    hiddenState: 'HIDDEN_STATE_REJECTED',
    wallClock: 'WALL_CLOCK_REJECTED',
  });
  const ALLOWED_INPUT_KEYS = Object.freeze([
    'frozenCandidates',
    'immediateMechanicalColumns',
    'publicBelief',
    'battleIntentAndObjectives',
    'experience',
    'seededRandomFact',
  ]);

  const metrics = {
    selectCalls: 0,
    evaluateCalls: 0,
    fatalCount: 0,
    factsConsumed: 0,
    factsSkipped: 0,
    lastWorkUnits: 0,
    maxWorkUnits: 0,
    totalWorkUnits: 0,
  };

  const clamp01 = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n < 0 ? 0 : n > 1 ? 1 : n === 0 ? 0 : n;
  };
  const clamp = (value, low, high) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n < low ? low : n > high ? high : n === 0 ? 0 : n;
  };
  const finiteNumber = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  // Defensive input snapshot and recursive output freeze: inputs are never
  // mutated and the returned record shares no object/array reference with them.
  const clone = value => {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = clone(value[key]);
      return out;
    }
    return value;
  };
  const deepFreeze = value => {
    if (!value || typeof value !== 'object') return value;
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
  };

  // Compensated summation; any non-finite member is fatal.
  const neumaierSum = values => {
    let sum = 0;
    let compensation = 0;
    for (const value of values) {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error('NON_FINITE');
      const next = sum + n;
      compensation += Math.abs(sum) >= Math.abs(n) ? (sum - next) + n : (n - next) + sum;
      sum = next;
    }
    const total = sum + compensation;
    if (!Number.isFinite(total)) throw new Error('NON_FINITE');
    return total;
  };
  const mean = values => {
    if (!Array.isArray(values) || values.length === 0) return 0;
    return neumaierSum(values) / values.length;
  };

  // UTF-16 code unit ascending comparison on candidate ids.
  const utf16Compare = (left, right) => {
    const a = String(left);
    const b = String(right);
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      const ca = a.charCodeAt(i);
      const cb = b.charCodeAt(i);
      if (ca !== cb) return ca - cb;
    }
    return a.length - b.length;
  };

  const beliefVector = belief => {
    const source = belief && typeof belief === 'object' ? belief : {};
    const p = clamp01(source.belief_prior_strength === undefined ? 0 : source.belief_prior_strength);
    const q = clamp01(source.confidence === undefined ? 0 : source.confidence);
    const u = clamp01(source.uncertainty_width === undefined ? 1 : source.uncertainty_width);
    if (p === null || q === null || u === null) throw new Error('NON_FINITE');
    return { p, q, u };
  };

  const closedFormWeights = belief => {
    const e = beliefVector(belief);
    const raw = [
      BASE_WEIGHTS[0] * (1 + INFLUENCE.alpha * e.q),
      BASE_WEIGHTS[1] * (1 + INFLUENCE.beta * e.p),
      BASE_WEIGHTS[2] * (1 + INFLUENCE.gamma * e.p + INFLUENCE.gammaPrime * e.q),
      BASE_WEIGHTS[3] * (1 + INFLUENCE.lambda * e.u),
      BASE_WEIGHTS[4] * (1 + INFLUENCE.mu * e.u),
      BASE_WEIGHTS[5],
    ];
    const total = neumaierSum(raw);
    if (total <= 0) throw new Error('NON_FINITE');
    return raw.map(w => w / total);
  };

  const mechanicalOf = (candidate, work) => {
    const m = candidate && typeof candidate === 'object' ? candidate.mechanical || candidate : {};
    const asFiniteArray = value => {
      work.units += 1;
      if (!Array.isArray(value)) return [];
      const out = value.map(finiteNumber);
      if (out.some(n => n === null)) throw new Error('NON_FINITE');
      return out;
    };
    const scalar = value => {
      work.units += 1;
      const n = finiteNumber(value);
      if (n === null) throw new Error('NON_FINITE');
      return n;
    };
    const actorStatus = String(m.actorStatus || '').trim();
    const paymentMode = String(m.paymentMode || '').trim();
    const legalityFlags = Array.isArray(m.legalityFlags) ? m.legalityFlags.map(String) : [];
    work.units += 3;
    return {
      visibleHpRatios: asFiniteArray(m.visibleHpRatios),
      actorStatus,
      objectiveContribution: scalar(m.objectiveContribution === undefined ? 0 : m.objectiveContribution),
      immediateBranchValues: asFiniteArray(m.immediateBranchValues),
      declaredEffectLow: scalar(m.declaredEffectLow === undefined ? 0 : m.declaredEffectLow),
      declaredEffectHigh: scalar(m.declaredEffectHigh === undefined ? 0 : m.declaredEffectHigh),
      revealStrength: scalar(m.revealStrength === undefined ? 0 : m.revealStrength),
      resourceRatios: asFiniteArray(m.resourceRatios),
      declaredOverkill: scalar(m.declaredOverkill === undefined ? 0 : m.declaredOverkill),
      legalityFlags,
      targetCount: scalar(m.targetCount === undefined ? 0 : m.targetCount),
      paymentMode,
    };
  };

  // S1-S6 frozen formulas over the twelve immediate mechanical columns.
  const componentVector = (m, u, work) => {
    const spread = clamp((m.declaredEffectHigh - m.declaredEffectLow) / REF_SPREAD, 0, 1);
    const values = [
      clamp01(m.objectiveContribution),
      clamp01(m.immediateBranchValues.length ? Math.min(...m.immediateBranchValues) : 0),
      clamp01(mean(m.visibleHpRatios)),
      clamp(u * clamp01(m.revealStrength) * spread, 0, CAP_S4),
      clamp01(mean(m.resourceRatios)),
      clamp01(m.declaredOverkill),
    ];
    if (values.some(v => v === null)) throw new Error('NON_FINITE');
    work.units += 6;
    return values;
  };

  const exclusionReasons = (m, work) => {
    const reasons = [];
    for (const code of m.legalityFlags) {
      work.units += 1;
      const text = String(code || '').trim();
      if (text) reasons.push(text);
    }
    const status = m.actorStatus;
    if (status === 'DISABLED') reasons.push('ACTOR_DISABLED');
    if (status === 'TERMINAL') reasons.push('ACTOR_TERMINAL');
    if (Number(m.targetCount) < 1) reasons.push('TARGET_EMPTY');
    return reasons;
  };

  const weightedScore = (vector, weights, work) => {
    work.units += vector.length;
    const terms = vector.map((value, index) => value * weights[index]);
    return neumaierSum(terms);
  };

  const evaluateCandidates = (candidates, belief, work) => {
    const e = beliefVector(belief);
    const weights = closedFormWeights(belief);
    const rows = [];
    for (const candidate of candidates) {
      work.units += 1;
      const m = mechanicalOf(candidate, work);
      const vector = componentVector(m, e.u, work);
      rows.push({
        candidateId: String(candidate.candidateId ?? '').trim(),
        actionKind: String(candidate.actionKind ?? '').trim(),
        targetSet: Array.isArray(candidate.targetSet) ? candidate.targetSet.map(String) : [],
        paymentMode: String(candidate.paymentMode ?? m.paymentMode ?? '').trim(),
        mechanical: m,
        vector,
        score: weightedScore(vector, weights, work),
        excluded: false,
        exclusionReasons: [],
        frontier: false,
        bandMember: false,
        selected: false,
      });
    }
    return { e, weights, rows };
  };

  const stage0Guard = (input, work) => {
    if (!input || typeof input !== 'object') throw new Error('INPUT_MISSING');
    for (const key of Object.keys(input)) {
      work.units += 1;
      if (ALLOWED_INPUT_KEYS.includes(key)) continue;
      if (Object.prototype.hasOwnProperty.call(FORBIDDEN_INPUTS, key)) {
        throw new Error(FORBIDDEN_INPUTS[key]);
      }
      throw new Error('INPUT_FIELD_FORBIDDEN');
    }
  };

  const declaredFacts = input => {
    const fact = input.seededRandomFact;
    return fact && typeof fact === 'object' ? [fact] : [];
  };

  const classSignature = vector => vector.map(value => String(value)).join('|');

  const nondominatedClasses = (classes, work) => {
    const dominates = (a, b) => {
      let strict = false;
      for (let j = 0; j < COMPONENTS.length; j += 1) {
        work.units += 1;
        const dir = DIRECTIONS[j];
        const va = a.vector[j];
        const vb = b.vector[j];
        if (dir > 0) {
          if (va < vb) return false;
          if (va > vb) strict = true;
        } else {
          if (va > vb) return false;
          if (va < vb) strict = true;
        }
      }
      return strict;
    };
    const frontier = [];
    for (let i = 0; i < classes.length; i += 1) {
      let dominated = false;
      for (let j = 0; j < classes.length; j += 1) {
        if (i === j) continue;
        work.units += 1;
        if (dominates(classes[j], classes[i])) {
          dominated = true;
          break;
        }
      }
      if (!dominated) frontier.push(classes[i]);
    }
    return frontier;
  };

  const equivalenceBand = (frontier, weights, best, bestScore, work) => {
    if (frontier.length === 1) return frontier;
    let secondScore = -Infinity;
    for (const item of frontier) {
      work.units += 1;
      if (item.representative !== best.representative && item.score > secondScore) secondScore = item.score;
    }
    const margin = bestScore - secondScore;
    if (margin > EPSILON) return [best];
    const band = [];
    for (const item of frontier) {
      work.units += 1;
      if (item.representative === best.representative) {
        band.push(item);
        continue;
      }
      if (item.score < bestScore - EPSILON) continue;
      let inBand = true;
      for (let j = 0; j < COMPONENTS.length; j += 1) {
        work.units += 1;
        const dir = DIRECTIONS[j];
        const worse = item.vector[j] - best.vector[j];
        if (dir > 0 ? worse < -DELTA : worse > DELTA) {
          inBand = false;
          break;
        }
      }
      if (inBand) band.push(item);
    }
    return band;
  };

  const drawFromBand = (band, weights, facts, work) => {
    const ordered = band.slice().sort((a, b) => utf16Compare(a.representative, b.representative));
    let minScore = Infinity;
    for (const item of ordered) {
      work.units += 1;
      if (item.score < minScore) minScore = item.score;
    }
    const masses = ordered.map(item => {
      work.units += 1;
      return Math.pow(item.score - minScore + RHO, KAPPA);
    });
    if (masses.some(mass => !Number.isFinite(mass) || mass < 0)) throw new Error('NON_FINITE');
    const totalMass = neumaierSum(masses);
    if (totalMass <= 0) throw new Error('NON_FINITE');
    const probabilities = masses.map(mass => {
      work.units += 1;
      return mass / totalMass;
    });
    const fact = facts.length > 0 ? facts[0] : null;
    if (!fact) throw new Error('RANDOM_FACT_REQUIRED');
    const actualValue = Number(fact.actualValue);
    if (!Number.isFinite(actualValue) || actualValue < 0 || actualValue >= 1) {
      throw new Error('RANDOM_FACT_ACTUAL_VALUE_INVALID');
    }
    const distribution = {};
    let cumulative = 0;
    let pickedIndex = ordered.length - 1;
    for (let i = 0; i < ordered.length; i += 1) {
      work.units += 1;
      const id = ordered[i].representative;
      if (i === ordered.length - 1) cumulative = 1;
      else cumulative = cumulative + probabilities[i];
      distribution[id] = probabilities[i];
      if (cumulative > actualValue && pickedIndex === ordered.length - 1) pickedIndex = i;
    }
    return {
      picked: ordered[pickedIndex],
      probabilities,
      distribution,
      actualValue,
      fact,
    };
  };

  const buildDecisionRecord = (rows, weights, frontierIds, bandIds, selected, randomFact) => ({
    schemaVersion: CONTRACT.schemaVersion,
    contractId: CONTRACT.contractId,
    contractRevision: CONTRACT.contractRevision,
    providerId: CONTRACT.providerId,
    selectedCandidateId: selected ? selected.candidateId : '',
    selectedDeclaration: selected
      ? {
          actionKind: selected.actionKind,
          targetSet: selected.targetSet,
          paymentMode: selected.paymentMode,
        }
      : null,
    margin: selected ? selected.margin : null,
    weights,
    frontier: frontierIds,
    band: bandIds,
    explicitAlternatives: bandIds.filter(id => id !== (selected ? selected.candidateId : '')),
    decisionAudit: rows.map(row => ({
      candidateId: row.candidateId,
      actionKind: row.actionKind,
      targetSet: row.targetSet,
      paymentMode: row.paymentMode,
      vector: row.vector,
      score: row.score,
      excluded: row.excluded,
      exclusionReasons: row.exclusionReasons,
      frontier: row.frontier,
      bandMember: row.bandMember,
      selected: row.selected,
    })),
    randomFact,
  });

  const select = input => {
    metrics.selectCalls += 1;
    const work = { units: 0 };
    try {
      const snapshot = clone(input);
      stage0Guard(snapshot, work);
      const candidates = Array.isArray(snapshot.frozenCandidates) ? snapshot.frozenCandidates : [];
      if (!candidates.length) throw new Error('NO_LEGAL_CANDIDATES');
      const evaluated = evaluateCandidates(candidates, snapshot.publicBelief, work);
      const weights = evaluated.weights;
      for (const row of evaluated.rows) {
        work.units += 1;
        const reasons = exclusionReasons(row.mechanical, work);
        if (reasons.length) {
          row.excluded = true;
          row.exclusionReasons = reasons;
        }
      }
      const legal = evaluated.rows.filter(row => !row.excluded);
      if (!legal.length) throw new Error('NO_LEGAL_CANDIDATES');
      const classMap = new Map();
      for (const row of legal) {
        const key = classSignature(row.vector);
        if (!classMap.has(key)) {
          classMap.set(key, { signature: key, vector: row.vector, score: row.score, members: [] });
        }
        classMap.get(key).members.push(row);
      }
      const classes = [...classMap.values()].map(item => ({
        ...item,
        representative: item.members
          .slice()
          .sort((a, b) => utf16Compare(a.candidateId, b.candidateId))[0].candidateId,
      }));
      const frontierClasses = nondominatedClasses(classes, work);
      let best = frontierClasses[0];
      for (let i = 1; i < frontierClasses.length; i += 1) {
        work.units += 1;
        const item = frontierClasses[i];
        if (item.score > best.score || (item.score === best.score && utf16Compare(item.representative, best.representative) < 0)) {
          best = item;
        }
      }
      let margin = Infinity;
      if (frontierClasses.length > 1) {
        let secondScore = -Infinity;
        for (const item of frontierClasses) {
          work.units += 1;
          if (item.representative !== best.representative && item.score > secondScore) secondScore = item.score;
        }
        margin = best.score - secondScore;
      }
      const band = equivalenceBand(frontierClasses, weights, best, best.score, work);
      const facts = declaredFacts(snapshot);
      let selected = null;
      let randomFact = null;
      if (band.length === 1) {
        if (facts.length > 0) metrics.factsSkipped += 1;
        const winnerClass = band[0];
        const winnerRow = winnerClass.members
          .slice()
          .sort((a, b) => utf16Compare(a.candidateId, b.candidateId))[0];
        selected = { ...winnerRow, margin };
      } else {
        const draw = drawFromBand(band, weights, facts, work);
        metrics.factsConsumed += 1;
        const winnerRow = draw.picked.members
          .slice()
          .sort((a, b) => utf16Compare(a.candidateId, b.candidateId))[0];
        selected = { ...winnerRow, margin };
        randomFact = {
          seed: String(draw.fact.seed || ''),
          distribution: draw.distribution,
          actualValue: draw.actualValue,
          outcomeBranch: selected.candidateId,
        };
      }
      const frontierIds = frontierClasses.map(item => item.representative);
      const bandIds = band.map(item => item.representative);
      for (const row of evaluated.rows) {
        row.frontier = frontierIds.includes(row.candidateId);
        row.bandMember = bandIds.includes(row.candidateId);
        row.selected = row.candidateId === selected.candidateId;
      }
      const record = buildDecisionRecord(evaluated.rows, weights, frontierIds, bandIds, selected, randomFact);
      metrics.lastWorkUnits = work.units;
      metrics.totalWorkUnits += work.units;
      metrics.maxWorkUnits = Math.max(metrics.maxWorkUnits, work.units);
      return deepFreeze(record);
    } catch (error) {
      metrics.fatalCount += 1;
      metrics.lastWorkUnits = work.units;
      metrics.totalWorkUnits += work.units;
      metrics.maxWorkUnits = Math.max(metrics.maxWorkUnits, work.units);
      throw error;
    }
  };

  const evaluateVectors = input => {
    metrics.evaluateCalls += 1;
    const work = { units: 0 };
    try {
      const snapshot = clone(input);
      stage0Guard(snapshot, work);
      const candidates = Array.isArray(snapshot.frozenCandidates) ? snapshot.frozenCandidates : [];
      const evaluated = evaluateCandidates(candidates, snapshot.publicBelief, work);
      for (const row of evaluated.rows) {
        work.units += 1;
        const reasons = exclusionReasons(row.mechanical, work);
        if (reasons.length) {
          row.excluded = true;
          row.exclusionReasons = reasons;
        }
      }
      const record = {
        schemaVersion: CONTRACT.schemaVersion,
        contractId: CONTRACT.contractId,
        belief: evaluated.e,
        weights: evaluated.weights,
        candidates: evaluated.rows.map(row => ({
          candidateId: row.candidateId,
          vector: row.vector,
          score: row.score,
          excluded: row.excluded,
          exclusionReasons: row.exclusionReasons,
        })),
      };
      metrics.lastWorkUnits = work.units;
      metrics.totalWorkUnits += work.units;
      metrics.maxWorkUnits = Math.max(metrics.maxWorkUnits, work.units);
      return deepFreeze(record);
    } catch (error) {
      metrics.fatalCount += 1;
      metrics.lastWorkUnits = work.units;
      metrics.totalWorkUnits += work.units;
      metrics.maxWorkUnits = Math.max(metrics.maxWorkUnits, work.units);
      throw error;
    }
  };

  const selfCheck = () => {
    const checks = {};
    checks.contractRevisionFrozen = CONTRACT.contractRevision === 3;
    checks.epsilon = EPSILON > 0 && EPSILON <= 1;
    checks.delta = DELTA > 0 && DELTA <= 1;
    checks.kappa = KAPPA >= 1;
    checks.rho = RHO > 0;
    checks.capS4 = CAP_S4 > 0;
    checks.refSpread = REF_SPREAD > 0;
    checks.baseWeightsSum = Math.abs(neumaierSum(BASE_WEIGHTS) - 1) < 1e-9;
    checks.influenceNonNegative = Object.values(INFLUENCE).every(v => v >= 0);
    checks.sixComponents = COMPONENTS.length === 6 && new Set(COMPONENTS).size === 6;
    checks.causalOwners = COMPONENTS.every(code => CAUSAL_OWNER_SET.includes(CAUSAL_OWNERS[code]));
    checks.directions = DIRECTIONS.length === 6 && DIRECTIONS.every(d => d === 1 || d === -1);
    checks.forbiddenDisjointFromAllowed = !Object.keys(FORBIDDEN_INPUTS).some(key => ALLOWED_INPUT_KEYS.includes(key));
    checks.unknownInputRejected = (() => {
      try {
        stage0Guard({ probeKey: 1 }, { units: 0 });
        return false;
      } catch (error) {
        return error.message === 'INPUT_FIELD_FORBIDDEN';
      }
    })();
    const scannedSources = [
      stage0Guard, clone, deepFreeze, beliefVector, closedFormWeights, mechanicalOf, componentVector,
      exclusionReasons, weightedScore, evaluateCandidates, classSignature, nondominatedClasses,
      equivalenceBand, drawFromBand, buildDecisionRecord, declaredFacts, select, evaluateVectors,
      mean, neumaierSum, utf16Compare, clamp01, clamp, finiteNumber,
    ];
    checks.noRngSource = !scannedSources.some(fn => String(fn).includes('Math.random'));
    checks.noWallClockSource = !scannedSources.some(fn =>
      ['Date.now', 'performance.now', 'process.hrtime', 'new Date'].some(token => String(fn).includes(token)),
    );
    return { ok: Object.values(checks).every(Boolean), checks, contract: CONTRACT };
  };

  const readMetrics = () => Object.freeze({ ...metrics });
  const resetMetrics = () => {
    metrics.selectCalls = 0;
    metrics.evaluateCalls = 0;
    metrics.fatalCount = 0;
    metrics.factsConsumed = 0;
    metrics.factsSkipped = 0;
    metrics.lastWorkUnits = 0;
    metrics.maxWorkUnits = 0;
    metrics.totalWorkUnits = 0;
  };

  const api = Object.freeze({
    version: '1.0.0',
    contractId: CONTRACT.contractId,
    contractRevision: CONTRACT.contractRevision,
    providerId: CONTRACT.providerId,
    kind: CONTRACT.kind,
    selectionScope: CONTRACT.selectionScope,
    select,
    evaluateVectors,
    selfCheck,
    readMetrics,
    resetMetrics,
  });

  root.__LWCS_BEHAVIOR_PROVIDER__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

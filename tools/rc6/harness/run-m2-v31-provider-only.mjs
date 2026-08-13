// run-m2-v31-provider-only.mjs
// M2 provider-only harness (candidate C). Read-only: never writes, stages or commits.
// Real-vm execution of BehaviorProvider_Module.js (baseline hash 064DAD99...) only;
// no Adapter, no Universe, no F7/F9. All 15 F3 contract cases are driven through
// select/evaluateVectors with contract gold; stage0 8+unknown+plural; S1-S6/owner/
// Pareto/experience/margin/band/seeded variety/UTF16; input stable, output
// deepFrozen with no aliasing; poisoned Math/Date/Function/eval/timers must see 0
// calls; real workUnits for C0/C1/C32 with max<=200000; exact metrics; M1 25/7
// regression with --expected-head=current HEAD. Any failed assertion exits 1.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const RC6 = path.join(REPO_ROOT, 'tools', 'rc6');
const BP_SRC = fs.readFileSync(path.join(REPO_ROOT, 'BehaviorProvider_Module.js'), 'utf8');
const BP_HASH_EXPECTED = '8a16e5d6645844b3ffdf7005f2435cebbe981cdd91d11820f68acb7a98008917';
const M1_PATH = path.join(HERE, 'run-m1-v31-acceptance.mjs');

let passed = 0;
let failed = 0;
const failures = [];
const blockStats = {};
function ok(name, cond, detail) {
  if (cond) passed += 1;
  else { failed += 1; failures.push(name + (detail ? ' | ' + detail : '')); }
}
function block(name, fn) {
  const before = passed + failed;
  fn();
  blockStats[name] = (passed + failed) - before;
}
const close = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-5 : tol);
const round4 = x => Math.round(x * 10000) / 10000;
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(path.join(RC6, p), 'utf8'));
const clone = v => JSON.parse(JSON.stringify(v));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  if (typeof v === 'number' && Object.is(v, -0)) return 0;
  return v;
}
const canon = v => JSON.stringify(sortKeys(v));
function expectThrow(tag, fn, code, exact) {
  let msg = null;
  try { fn(); } catch (e) { msg = String((e && e.message) || e); }
  const threw = msg !== null;
  ok(tag, threw && (exact ? msg === code : msg.indexOf(code) >= 0), 'got ' + msg);
  return threw;
}
const delta = (a, b) => Object.fromEntries(Object.keys(b).map(k => [k, b[k] - (a[k] || 0)]));
function deepFrozen(v, seen) {
  if (v === null || typeof v !== 'object' || seen.has(v)) return true;
  seen.add(v);
  if (!Object.isFrozen(v)) return false;
  return Object.keys(v).every(k => deepFrozen(v[k], seen));
}
function objSet(v, s, seen) {
  if (v === null || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v); s.add(v);
  for (const k of Object.keys(v)) objSet(v[k], s, seen);
}
function aliasesInput(out, input) {
  const s = new Set();
  objSet(input, s, new Set());
  const seen = new Set();
  const stack = [out];
  while (stack.length) {
    const v = stack.pop();
    if (v === null || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (s.has(v)) return true;
    for (const k of Object.keys(v)) stack.push(v[k]);
  }
  return false;
}
function hasNegZero(v) {
  if (typeof v === 'number') return Object.is(v, -0);
  if (v === null || typeof v !== 'object') return false;
  return Object.keys(v).some(k => hasNegZero(v[k]));
}
function numericSurface(rec) {
  return { weights: rec.weights, margin: rec.margin, audit: rec.decisionAudit.map(r => ({ vector: r.vector, score: r.score })), rf: rec.randomFact };
}
function evalSurface(ev) {
  return { weights: ev.weights, candidates: ev.candidates.map(c => ({ vector: c.vector, score: c.score })) };
}
function utf16Less(a, b) {
  a = String(a); b = String(b);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const ca = a.charCodeAt(i); const cb = b.charCodeAt(i);
    if (ca !== cb) return ca < cb;
  }
  return a.length < b.length;
}
const F3 = readJson('cases/BehaviorProviderSelectionCasesV1.json');

let callSelect = 0;
let callEvaluate = 0;
let callFatal = 0;
let expectFactsConsumed = 0;
let expectFactsSkipped = 0;
let maxWork = 0;
let lastWorkUnitsPresent = false;
let selIdx = 0;
let evIdx = 0;
let vmPoisonCount = 0;

// ---- vm sandbox with poison proxies: Math.random / Date.now / new Date /
// Function / eval / timer calls throw immediately and increment vmPoisonCount.
// After every case has run the count must still be 0; static scan is only
// corroboration, never the gate itself.
function poison(code) {
  return function () { vmPoisonCount += 1; throw new Error(code); };
}
const poisonMath = Object.create(Math);
poisonMath.random = poison('VM_MATH_RANDOM_FORBIDDEN');
const poisonDate = function () { vmPoisonCount += 1; throw new Error('VM_DATE_NEW_FORBIDDEN'); };
poisonDate.now = poison('VM_DATE_NOW_FORBIDDEN');
const sandbox = {
  console, Buffer, TextDecoder, TextEncoder, JSON, Math: poisonMath, Date: poisonDate,
  Function: poison('VM_FUNCTION_FORBIDDEN'), eval: poison('VM_EVAL_FORBIDDEN'),
  setTimeout: poison('VM_TIMER_FORBIDDEN'), setInterval: poison('VM_TIMER_FORBIDDEN'), clearTimeout: poison('VM_TIMER_FORBIDDEN'), clearInterval: poison('VM_TIMER_FORBIDDEN'),
  Object, Array, String, Number, Boolean, Error, TypeError, Map, Set, WeakMap, WeakSet,
  Symbol, Reflect, Promise, Intl, URL, URLSearchParams, parseInt, parseFloat, isNaN, isFinite,
};
const ctx = vm.createContext(sandbox);
vm.runInContext(BP_SRC, ctx, { filename: 'BehaviorProvider_Module.js' });
const BP = ctx.__LWCS_BEHAVIOR_PROVIDER__;

// ---- wrappers: input stable serialize, output deepFrozen, no aliasing, lastWorkUnits.
function readWork() {
  const wu = BP.readMetrics().lastWorkUnits;
  if (typeof wu === 'number' && Number.isFinite(wu)) { maxWork = Math.max(maxWork, wu); lastWorkUnitsPresent = true; }
}
function runSelect(tag, input) {
  const before = JSON.stringify(input);
  callSelect += 1;
  const out = BP.select(input);
  ok(tag + ' input stable', JSON.stringify(input) === before);
  selIdx += 1;
  ok('select output deepFrozen ' + selIdx, deepFrozen(out, new Set()), tag);
  ok('select output no input alias ' + selIdx, !aliasesInput(out, input), tag);
  ok('select output no -0 ' + selIdx, !hasNegZero(numericSurface(out)), tag);
  readWork();
  return out;
}
function runEvaluate(tag, input) {
  const before = JSON.stringify(input);
  callEvaluate += 1;
  const out = BP.evaluateVectors(input);
  ok(tag + ' input stable', JSON.stringify(input) === before);
  evIdx += 1;
  ok('evaluate output deepFrozen ' + evIdx, deepFrozen(out, new Set()), tag);
  ok('evaluate output no input alias ' + evIdx, !aliasesInput(out, input), tag);
  ok('evaluate output no -0 ' + evIdx, !hasNegZero(evalSurface(out)), tag);
  readWork();
  return out;
}
function probeFatal(tag, input, code) {
  const before = JSON.stringify(input);
  callSelect += 1;
  const threw = expectThrow(tag, () => BP.select(input), code, true);
  if (threw) callFatal += 1;
  ok(tag + ' input stable', JSON.stringify(input) === before);
  readWork();
  return threw;
}

// ---- static closure scan (corroboration only): codeOnly strips comments/strings
// so declaration-only forbidden tokens never count as real calls.
function codeOnly(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i += 1; continue; }
    if (ch === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === String.fromCharCode(96)) {
      const q = ch; i += 1;
      while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === q) { i += 1; break; } i += 1; }
      continue;
    }
    out += ch; i += 1;
  }
  return out;
}
function identifiers(code) {
  const ids = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code.charCodeAt(i);
    const isStart = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c > 127;
    if (isStart) {
      let j = i;
      while (j < n) {
        const d = code.charCodeAt(j);
        const isPart = (d >= 65 && d <= 90) || (d >= 97 && d <= 122) || (d >= 48 && d <= 57) || d === 95 || d === 36 || d > 127;
        if (!isPart) break;
        j += 1;
      }
      ids.push(code.slice(i, j)); i = j;
    } else i += 1;
  }
  return ids;
}
const BP_CODE = codeOnly(BP_SRC);
const CALL_BANS = ['worldClone(', 'structuredClone(', 'futureRouteEnumeration(', 'futureRouteDerivation(', 'resultEnumeration(', 'decide(', 'decideNext(', 'runProvider(', 'new Date(', 'performance.now(', 'Date.now', 'Math.random', 'teacherOutput('];
const LEGACY_IDS = ['BattleDecision', 'BattleRuntime', 'BattlePreview', 'Kernel_Module', 'BattleReport', 'MVU_Skill_Runtime', 'runProvider', 'decideNext', 'decide', 'worldClone', 'structuredClone', 'futureRoute', 'resultEnumeration'];

block('load', () => {
  ok('BP hash matches baseline 064DAD99', sha256(BP_SRC) === BP_HASH_EXPECTED, sha256(BP_SRC));
  ok('vm provider mounted', !!BP && typeof BP.select === 'function' && typeof BP.evaluateVectors === 'function');
  ok('provider identity', BP.providerId === 'behavior-provider-v1' && BP.kind === 'CANDIDATE_ONLY' && BP.selectionScope === 'MECHANICAL_NEUTRAL_ONLY' && BP.contractRevision === 3);
  const sc = BP.selfCheck();
  ok('provider selfCheck ok', sc.ok === true);
  ok('provider owner/direction/component checks', sc.checks.causalOwners === true && sc.checks.directions === true && sc.checks.sixComponents === true && sc.checks.contractRevisionFrozen === true && sc.checks.forbiddenDisjointFromAllowed === true);
});

block('static', () => {
  for (const tok of CALL_BANS) ok('static no call ' + tok, BP_CODE.indexOf(tok) < 0);
  const ids = identifiers(BP_CODE);
  ok('static no legacy/direct/kernel ids', !LEGACY_IDS.some(t => ids.indexOf(t) >= 0));
  ok('static no round/horizon/branch ids', ids.indexOf('round') < 0 && ids.indexOf('horizon') < 0 && ids.indexOf('branch') < 0);
  ok('static declaration tokens are not real calls', BP_CODE.indexOf('Math.random') < 0 && BP_CODE.indexOf('teacherOutput(') < 0);
});

// ---- Behavior: all F3 cases driven through BP.select / BP.evaluateVectors ----
const ALLOWED_KEYS = ['frozenCandidates', 'immediateMechanicalColumns', 'publicBelief', 'battleIntentAndObjectives', 'experience'];
const HARNESS_KEYS = ['seededRandomFacts', 'runs'];
function buildInput(caseInput) {
  const out = {};
  for (const k of ALLOWED_KEYS) if (caseInput[k] !== undefined) out[k] = clone(caseInput[k]);
  for (const k of Object.keys(caseInput)) {
    if (ALLOWED_KEYS.indexOf(k) >= 0 || HARNESS_KEYS.indexOf(k) >= 0) continue;
    out[k] = clone(caseInput[k]);
  }
  return out;
}
function checkRun(tag, re, runFacts, runInput) {
  const picked = new Set();
  const runs = [];
  let dist = null;
  if (runFacts && runFacts.length) {
    for (const f of runFacts) {
      const m1 = BP.readMetrics();
      const rr = runSelect(tag + ' fact ' + f.actualValue, Object.assign({}, runInput, { seededRandomFact: clone(f) }));
      expectFactsConsumed += 1;
      const d = delta(m1, BP.readMetrics());
      ok(tag + ' fact consumed', d.factsConsumed === 1 && d.factsSkipped === 0, JSON.stringify(d));
      ok(tag + ' fact ' + f.actualValue + ' outcome', rr.randomFact !== null && rr.randomFact.actualValue === f.actualValue && rr.randomFact.outcomeBranch === rr.selectedCandidateId, JSON.stringify(rr.randomFact));
      picked.add(rr.selectedCandidateId);
      if (!dist) dist = rr.randomFact;
      runs.push(rr);
    }
  } else {
    const m1 = BP.readMetrics();
    const rr = runSelect(tag + ' run', runInput);
    const d = delta(m1, BP.readMetrics());
    ok(tag + ' no-fact deterministic', d.factsConsumed === 0 && d.factsSkipped === 0 && rr.randomFact === null, JSON.stringify(d));
    picked.add(rr.selectedCandidateId);
    dist = rr.randomFact;
    runs.push(rr);
  }
  const gold = re.gold || {};
  if (re.alwaysSelect) ok(tag + ' alwaysSelect', runs[0].selectedCandidateId === re.alwaysSelect, 'got ' + runs[0].selectedCandidateId);
  if (re.neverSelect) ok(tag + ' neverSelect', re.neverSelect.every(x => !picked.has(x)), 'picked ' + JSON.stringify([...picked]));
  if (re.consumesNoRandomFact === true) ok(tag + ' consumesNoRandomFact', runs.length === 1 && runs[0].randomFact === null);
  if (gold.margin !== undefined) ok(tag + ' margin', close(runs[0].margin, gold.margin), 'got ' + runs[0].margin);
  if (gold.frontier) ok(tag + ' frontier', JSON.stringify(runs[0].frontier.slice().sort()) === JSON.stringify(gold.frontier.slice().sort()), 'got ' + JSON.stringify(runs[0].frontier));
  if (gold.band) ok(tag + ' band', JSON.stringify(runs[0].band.slice().sort()) === JSON.stringify(gold.band.slice().sort()), 'got ' + JSON.stringify(runs[0].band));
  if (gold.distribution) for (const [cid, prob] of Object.entries(gold.distribution)) ok(tag + ' dist ' + cid, dist !== null && close(round4(dist.distribution[cid]), prob, 1e-9), 'got ' + (dist ? round4(dist.distribution[cid]) : 'no-dist'));
  if (gold.weights) ok(tag + ' weights', runs[0].weights.every((w, i) => close(w, gold.weights[i], 1e-5)), 'got ' + runs[0].weights.map(round4).join(','));
  if (gold.scores) for (const [cid, sc] of Object.entries(gold.scores)) { const row = runs[0].decisionAudit.find(x => x.candidateId === cid); ok(tag + ' score ' + cid, row !== undefined && close(row.score, sc, 1e-5), 'got ' + (row ? row.score : 'missing')); }
  if (gold.picks) for (const [av, want] of Object.entries(gold.picks)) ok(tag + ' pick ' + av, runs.some(r => r.randomFact !== null && r.randomFact.actualValue === Number(av) && r.selectedCandidateId === want), 'picked none at ' + av);
  if (gold.boundaryPicks) for (const [av, want] of Object.entries(gold.boundaryPicks)) ok(tag + ' bPick ' + av, runs.some(r => r.randomFact !== null && r.randomFact.actualValue === Number(av) && r.selectedCandidateId === want), 'picked none at ' + av);
  if (re.reachable) ok(tag + ' reachable', re.reachable.every(x => picked.has(x)), 'picked ' + JSON.stringify([...picked]));
  ok(tag + ' utf16 ordering gate', runs[0].band.every((x, i) => i === 0 || !utf16Less(x, runs[0].band[i - 1])));
  return runs;
}

block('behavior', () => {
  ok('F3 closed 15 cases', F3.closed === true && F3.cases.length === 15);
  ok('F3 every case C<=32', F3.cases.every(c => (c.input.frozenCandidates || []).length <= 32));
  for (const cs of F3.cases) {
    const id = cs.caseId;
    const inp = cs.input;
    const exp = cs.expect;
    if (exp.fatal) { probeFatal(id + ' fatal ' + exp.fatal, buildInput(inp), exp.fatal); continue; }
    const forbiddenRuns = Array.isArray(inp.runs) && inp.runs.some(x => x.forbiddenKey);
    if (forbiddenRuns) {
      checkRun(id, exp, [], buildInput(inp));
      for (const r of inp.runs) {
        const merged = buildInput(inp);
        merged[r.forbiddenKey] = { probe: true };
        probeFatal(id + ' run ' + r.label + ' fatal', merged, r.expectedCode);
      }
      continue;
    }
    if (exp.runs) {
      const inRuns = inp.runs || [];
      for (const re of exp.runs) {
        const src = inRuns.find(x => x.label === re.label) || {};
        const merged = buildInput(inp);
        if (src.frozenCandidates) merged.frozenCandidates = clone(src.frozenCandidates);
        if (src.publicBelief) merged.publicBelief = clone(src.publicBelief);
        const runFacts = src.seededRandomFacts !== undefined ? src.seededRandomFacts : (Array.isArray(inp.seededRandomFacts) ? inp.seededRandomFacts : []);
        checkRun(id + ' ' + re.label, re, runFacts, merged);
      }
      continue;
    }
    const facts = Array.isArray(inp.seededRandomFacts) ? inp.seededRandomFacts : [];
    if (facts.length) {
      const runs = checkRun(id, { gold: exp.gold || {}, reachable: exp.reachable }, facts, buildInput(inp));
      if (exp.replay === true) {
        const runs2 = checkRun(id + ' replay-pass2', { gold: {} }, facts, buildInput(inp));
        ok(id + ' replay identical', JSON.stringify(runs.map(r => [r.selectedCandidateId, r.randomFact])) === JSON.stringify(runs2.map(r => [r.selectedCandidateId, r.randomFact])));
      }
      continue;
    }
    const runs = checkRun(id, exp, [], buildInput(inp));
    const rec = runs[0];
    if (exp.goldVector) {
      const row = rec.decisionAudit.find(x => x.candidateId === exp.alwaysSelect);
      ok(id + ' goldVector', row !== undefined && row.vector.every((x, i) => close(x, exp.goldVector[i], 1e-9)), 'got ' + JSON.stringify(row && row.vector));
    }
    if (exp.exclusionRecorded) {
      const row = rec.decisionAudit.find(x => x.candidateId === exp.exclusionRecorded.candidateId);
      ok(id + ' exclusionRecorded', row !== undefined && row.excluded === true && row.exclusionReasons.indexOf(exp.exclusionRecorded.reason) >= 0 && row.vector.every((x, i) => close(x, exp.exclusionRecorded.vector[i], 1e-9)), JSON.stringify(row));
    }
    if (exp.s4Checks) {
      for (const s of exp.s4Checks) {
        const merged = buildInput(inp);
        merged.publicBelief = Object.assign({}, merged.publicBelief, { uncertainty_width: s.u });
        const cand = merged.frozenCandidates[0];
        cand.mechanical.revealStrength = s.revealStrength;
        cand.mechanical.declaredEffectLow = s.declaredEffectLow;
        cand.mechanical.declaredEffectHigh = s.declaredEffectHigh;
        const rr = runSelect(id + ' s4', merged);
        const row = rr.decisionAudit.find(x => x.candidateId === cand.candidateId);
        ok(id + ' s4 u=' + s.u + ' r=' + s.revealStrength, row !== undefined && close(row.vector[3], s.expected, 1e-9), 'got ' + (row ? row.vector[3] : 'missing'));
      }
    }
    if (exp.sameAsIgnoredDim) {
      const base = buildInput(inp);
      const variant = clone(base);
      for (const c of variant.frozenCandidates) c.mechanical.declaredOverkill = 0;
      const rv = runSelect(id + ' sameAs', variant);
      ok(id + ' sameAsIgnoredDim', rv.selectedCandidateId === rec.selectedCandidateId && JSON.stringify(rv.band) === JSON.stringify(rec.band) && close(rv.margin, rec.margin, 1e-9), 'got ' + rv.selectedCandidateId);
    }
    ok(id + ' audit covers all candidates', rec.decisionAudit.length === inp.frozenCandidates.length);
    ok(id + ' explicitAlternatives subset of band', rec.explicitAlternatives.every(x => rec.band.indexOf(x) >= 0) && rec.explicitAlternatives.indexOf(rec.selectedCandidateId) < 0);
  }
});

block('evaluate', () => {
  const c13 = F3.cases.find(c => c.caseId === 'BPV1-C13-COMPONENT-GOLD');
  const c05 = F3.cases.find(c => c.caseId === 'BPV1-C05-EXPERIENCE-SWITCH');
  const goldW = c05.expect.runs[0].gold.weights;
  const m1 = BP.readMetrics();
  const ev1 = runEvaluate('evaluate c13', buildInput(c13.input));
  const d = delta(m1, BP.readMetrics());
  ok('evaluateVectors counted', d.evaluateCalls === 1, JSON.stringify(d));
  ok('evaluateVectors full coverage', ev1.candidates.length === c13.input.frozenCandidates.length, 'got ' + ev1.candidates.length);
  const row = ev1.candidates.find(x => x.candidateId === 'a');
  ok('evaluateVectors goldVector', row !== undefined && row.vector.every((x, i) => close(x, c13.expect.goldVector[i], 1e-9)), JSON.stringify(row && row.vector));
  ok('evaluateVectors belief vector', ev1.belief.p === 0.5 && ev1.belief.q === 0.5 && ev1.belief.u === 0.5, JSON.stringify(ev1.belief));
  ok('evaluateVectors closed-form weights', ev1.weights.every((w, i) => close(w, goldW[i], 1e-5)), ev1.weights.map(round4).join(','));
  const ev2 = runEvaluate('evaluate c13-2', buildInput(c13.input));
  ok('evaluateVectors deterministic', canon(ev1) === canon(ev2));
  const excl = buildInput(c13.input);
  excl.frozenCandidates[0].mechanical.legalityFlags = ['LEGALITY_VIOLATION'];
  const ev3 = runEvaluate('evaluate excl', excl);
  ok('evaluateVectors excluded retained', ev3.candidates.length === 1 && ev3.candidates[0].excluded === true && ev3.candidates[0].exclusionReasons.indexOf('LEGALITY_VIOLATION') >= 0, JSON.stringify(ev3.candidates));
});

block('probes', () => {
  const c01 = F3.cases.find(c => c.caseId === 'BPV1-C01-DOMINANCE-GUARD');
  const c03 = F3.cases.find(c => c.caseId === 'BPV1-C03-BAND-DIVERSITY');
  const base01 = buildInput(c01.input);
  probeFatal('unknown input key rejected', Object.assign({}, base01, { unknownProbe: 1 }), 'INPUT_FIELD_FORBIDDEN');
  probeFatal('plural seededRandomFacts rejected', Object.assign({}, base01, { seededRandomFacts: [] }), 'INPUT_FIELD_FORBIDDEN');
  probeFatal('missing input rejected', undefined, 'INPUT_MISSING');
  const m1 = BP.readMetrics();
  const rec = runSelect('factsSkipped probe', Object.assign({}, base01, { seededRandomFact: { seed: 's0', actualValue: 0.5 } }));
  expectFactsSkipped += 1;
  const d = delta(m1, BP.readMetrics());
  ok('factsSkipped on degenerate band', rec.selectedCandidateId === 'a' && rec.randomFact === null && d.factsSkipped === 1 && d.factsConsumed === 0, JSON.stringify(d));
  probeFatal('band>=2 without fact -> RANDOM_FACT_REQUIRED', buildInput(c03.input), 'RANDOM_FACT_REQUIRED');
  const bad = buildInput(c03.input);
  bad.seededRandomFact = { seed: 's1', actualValue: 1 };
  probeFatal('actualValue=1 -> RANDOM_FACT_ACTUAL_VALUE_INVALID', bad, 'RANDOM_FACT_ACTUAL_VALUE_INVALID');
  const allExcluded = buildInput(c01.input);
  for (const c of allExcluded.frozenCandidates) c.mechanical.legalityFlags = ['LEGALITY_VIOLATION'];
  probeFatal('all excluded -> NO_LEGAL_CANDIDATES', allExcluded, 'NO_LEGAL_CANDIDATES');
  const utf16 = { frozenCandidates: [mk('a', 0.7), mk('A', 0.7)], publicBelief: { belief_prior_strength: 0.5, confidence: 0.5, uncertainty_width: 0.5 }, battleIntentAndObjectives: { mode: 'raid' } };
  const utf16Rec = runSelect('utf16 tie-break', utf16);
  ok('utf16 tie-break representative smallest code unit', utf16Rec.selectedCandidateId === 'A' && utf16Rec.frontier.length === 1, 'got ' + utf16Rec.selectedCandidateId);
  const negZeroCand = { candidateId: 'z0', actionKind: 'strike', targetSet: ['e1'], paymentMode: 'FULL', mechanical: { visibleHpRatios: [-0], actorStatus: 'NORMAL', objectiveContribution: -0, immediateBranchValues: [-0, -0], declaredEffectLow: -0, declaredEffectHigh: -0, revealStrength: 1, resourceRatios: [-0], declaredOverkill: -0, legalityFlags: [], targetCount: 1, paymentMode: 'FULL' } };
  const negRec = runSelect('neg-zero probe', { frozenCandidates: [negZeroCand], publicBelief: { belief_prior_strength: 0.5, confidence: 0.5, uncertainty_width: 0.5 }, battleIntentAndObjectives: { mode: 'raid' } });
  ok('neg-zero vector/score/weights no -0', !hasNegZero(numericSurface(negRec)) && negRec.selectedCandidateId === 'z0', JSON.stringify(numericSurface(negRec)));
});

block('ops', () => {
  const base = { publicBelief: { belief_prior_strength: 0.5, confidence: 0.5, uncertainty_width: 0.5 }, battleIntentAndObjectives: { mode: 'raid' } };
  probeFatal('ops C=0 NO_LEGAL_CANDIDATES', { frozenCandidates: [] }, 'NO_LEGAL_CANDIDATES');
  const one = mk('c1', 0.7);
  const rec1 = runSelect('ops C=1', Object.assign({ frozenCandidates: [one] }, base));
  ok('ops C=1 deterministic', rec1.selectedCandidateId === 'c1' && rec1.band.length === 1 && rec1.margin === Infinity && rec1.randomFact === null, JSON.stringify(rec1));
  const scout = [];
  for (let i = 0; i < 32; i += 1) scout.push({ candidateId: 's' + String(i).padStart(2, '0'), actionKind: 'strike', targetSet: ['e1'], paymentMode: 'FULL', mechanical: { visibleHpRatios: [0.6], actorStatus: 'NORMAL', objectiveContribution: 0.6, immediateBranchValues: [0.6, 0.6], declaredEffectLow: 0, declaredEffectHigh: 1, revealStrength: 1, resourceRatios: [0.6], declaredOverkill: 0, legalityFlags: [], targetCount: 1, paymentMode: 'FULL' } });
  const t0 = Date.now();
  const rec32 = runSelect('ops C=32 scout', Object.assign({ frozenCandidates: scout }, base));
  const ms = Date.now() - t0;
  ok('ops C=32 completes', rec32.decisionAudit.length === 32);
  ok('ops scout wall time < 5000ms', ms < 5000, ms + 'ms');
  const wu = BP.readMetrics().lastWorkUnits;
  ok('ops lastWorkUnits present', typeof wu === 'number' && Number.isFinite(wu), 'got ' + wu);
  ok('ops lastWorkUnits <= 200000', typeof wu === 'number' && wu <= 200000, 'work=' + wu);
  ok('ops real maxWork <= 200000', maxWork <= 200000, 'max=' + maxWork);
});

block('metrics', () => {
  const fm = BP.readMetrics();
  ok('metrics selectCalls exact', fm.selectCalls === callSelect, fm.selectCalls + ' vs ' + callSelect);
  ok('metrics evaluateCalls exact', fm.evaluateCalls === callEvaluate, fm.evaluateCalls + ' vs ' + callEvaluate);
  ok('metrics fatalCount exact', fm.fatalCount === callFatal, fm.fatalCount + ' vs ' + callFatal);
  ok('metrics factsConsumed exact', fm.factsConsumed === expectFactsConsumed, fm.factsConsumed + ' vs ' + expectFactsConsumed);
  ok('metrics factsSkipped exact', fm.factsSkipped === expectFactsSkipped, fm.factsSkipped + ' vs ' + expectFactsSkipped);
  ok('vm poison call count zero', vmPoisonCount === 0, 'poison=' + vmPoisonCount);
  ok('metrics lastWorkUnits observed', lastWorkUnitsPresent, 'maxWork=' + maxWork);
});

block('m1', () => {
  const headRes = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const expectedHead = (headRes.stdout || '').trim();
  ok('M1 expected-head resolved', /^[0-9a-f]{40}$/.test(expectedHead), 'got ' + expectedHead);
  const check = spawnSync(process.execPath, ['--check', M1_PATH], { encoding: 'utf8' });
  ok('M1 syntax check', check.status === 0, (check.stderr || '').slice(0, 200));
  const run = spawnSync(process.execPath, [M1_PATH, '--expected-head', expectedHead], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  ok('M1 harness exit 0', run.status === 0, 'status=' + run.status + ' ' + (run.stderr || '').slice(0, 300));
  let m1 = null;
  try { m1 = JSON.parse(run.stdout); } catch (e) { m1 = null; }
  ok('M1 status PASSED', m1 !== null && m1.status === 'PASSED', 'got ' + (m1 && m1.status));
  ok('M1 checkCount 25', m1 !== null && Array.isArray(m1.checks) && m1.checks.length === 25, 'got ' + (m1 && m1.checks && m1.checks.length));
  ok('M1 protectionGateResults 7', m1 !== null && Array.isArray(m1.protectionGates) && m1.protectionGates.length === 7, 'got ' + (m1 && m1.protectionGates && m1.protectionGates.length));
  ok('M1 sourceHashes exist', m1 !== null && m1.sourceHashes && typeof m1.sourceHashes === 'object' && Object.keys(m1.sourceHashes).length > 0 && Object.values(m1.sourceHashes).every(h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)), 'got ' + (m1 && Object.keys(m1.sourceHashes || {}).length));
  ok('M1 expectedHead matched', m1 !== null && m1.expectedHead === expectedHead && m1.actualHead === expectedHead, 'got ' + (m1 && m1.expectedHead) + ' vs ' + expectedHead);
});

function mk(cid, hp) {
  return { candidateId: cid, actionKind: 'strike', targetSet: ['e1'], paymentMode: 'FULL', mechanical: { visibleHpRatios: [hp], actorStatus: 'NORMAL', objectiveContribution: hp, immediateBranchValues: [hp, hp], declaredEffectLow: 0, declaredEffectHigh: 1, revealStrength: 1, resourceRatios: [hp], declaredOverkill: 0, legalityFlags: [], targetCount: 1, paymentMode: 'FULL' } };
}

const moduleHashes = { BehaviorProvider_Module: sha256(BP_SRC) };
const lineCount = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').length;
const summary = {
  schemaVersion: 'M2ProviderOnlyV1',
  status: failed ? 'FAILED' : 'PASSED',
  moduleHashes,
  hashPinned: sha256(BP_SRC) === BP_HASH_EXPECTED,
  lineCount,
  blockStats,
  maxWork,
  lastWorkUnitsPresent,
  vmPoisonCount,
  assertionCount: passed + failed,
  passed,
  failed,
  failures,
};
console.log('assertionCount=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
for (const f of failures) console.log('FAIL: ' + f);
process.stdout.write('M2PROVIDERONLY ' + JSON.stringify(summary) + '\n');
process.exitCode = failed ? 1 : 0;

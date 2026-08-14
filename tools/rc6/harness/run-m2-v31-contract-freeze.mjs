// run-m2-v31-contract-freeze.mjs
// M2 unified contract-freeze harness: read-only audit of the RC6 contract freeze set (nine originals + DirectFactRowV1 pair).
// Fails (exit 1) on any failed assertion; prints the actual assertion count.
// No contract file is written, staged or committed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototypePathUniverse } from '../reference/build-prototype-path-universe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const rc6 = path.join(repoRoot, 'tools', 'rc6');
const NINE = {
  F1: ['contracts/BehaviorProviderV1.json', 'BehaviorProviderV1'],
  F2: ['contracts/BehaviorProviderV1.schema.json', 'BehaviorProviderV1.schema'],
  F3: ['cases/BehaviorProviderSelectionCasesV1.json', 'BehaviorProviderSelectionCasesV1'],
  F4: ['contracts/BehaviorProviderQualityGateV1.json', 'BehaviorProviderQualityGateV1'],
  F5: ['contracts/BehaviorProviderQualityGateV1.schema.json', 'BehaviorProviderQualityGateV1.schema'],
  F6: ['cases/BehaviorProviderQualitySplitV1.json', 'BehaviorProviderQualitySplitV1'],
  F7: ['contracts/PrototypeDirectAdapterV1.json', 'PrototypeDirectAdapterV1'],
  F8: ['contracts/PrototypeDirectAdapterV1.schema.json', 'PrototypeDirectAdapterV1.schema'],
  F9: ['cases/PrototypeDirectAdapterCasesV1.json', 'PrototypeDirectAdapterCasesV1'],
};

let passed = 0, failed = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else { failed += 1; failures.push(name + (detail ? ' | ' + detail : '')); }
};
const close = (a, b, tol = 1e-5) => Math.abs(a - b) <= tol;
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(path.join(rc6, p), 'utf8'));

// ---- block A: utf8 / mojibake / duplicate keys ----
function utf8Strict(buf) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; }
  catch { return false; }
}
function findDupKeys(text) {
  const dups = [];
  let i = 0; const n = text.length;
  const stack = [];
  const skipStr = () => {
    i += 1;
    while (i < n) { const ch = text[i]; if (ch === '\\') { i += 2; continue; } if (ch === '"') { i += 1; return; } i += 1; }
  };
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      const start = i; skipStr();
      let j = i; while (j < n && /\s/.test(text[j])) j += 1;
      if (text[j] === ':' && stack.length) {
        const key = text.slice(start + 1, i - 1)
          .replace(/\\(["\\\/bfnrt])/g, '$1')
          .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const top = stack[stack.length - 1];
        if (top.has(key)) dups.push(key); else top.set(key, true);
      }
    } else if (ch === '{') stack.push(new Map());
    else if (ch === '}') stack.pop();
    i += 1;
  }
  return dups;
}
const MOJI = ['\uFFFD', '\u9c4f\u65a4\u6253'];
const FREEZE_FILES = [...Object.values(NINE), ['contracts/DirectFactRowV1.json', 'DirectFactRowV1'], ['contracts/DirectFactRowV1.schema.json', 'DirectFactRowV1.schema']];
for (const [p, tag] of FREEZE_FILES) {
  const buf = fs.readFileSync(path.join(rc6, p));
  const text = buf.toString('utf8');
  ok('utf8 ' + tag, utf8Strict(buf));
  ok('json-parse ' + tag, (() => { try { JSON.parse(text); return true; } catch { return false; } })());
  ok('no-bom ' + tag, !buf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
  ok('no-mojibake ' + tag, !MOJI.some(m => text.includes(m)));
  const dk = findDupKeys(text);
  ok('no-dup-keys ' + tag, dk.length === 0, dk.slice(0, 5).join(','));
}

// ---- lightweight draft-07 / 2020-12 schema validator ----
function makeValidator(root) {
  const defs = {};
  (function collect(node) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== 'object') return;
    for (const k of ['$defs', 'definitions']) if (node[k] && typeof node[k] === 'object') Object.assign(defs, node[k]);
    Object.values(node).forEach(collect);
  })(root);
  const resolve = ref => {
    if (ref.startsWith('#/')) {
      let node = root;
      for (const seg of ref.slice(2).split('/')) node = node[seg.replace(/~1/g, '/').replace(/~0/g, '~')];
      return node;
    }
    const name = ref.split('/').pop();
    if (defs[name]) return defs[name];
    throw new Error('unresolved ref ' + ref);
  };
  const typeOk = (v, t) => {
    if (t === 'integer') return Number.isInteger(v);
    if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
    if (t === 'string') return typeof v === 'string';
    if (t === 'boolean') return typeof v === 'boolean';
    if (t === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
    if (t === 'array') return Array.isArray(v);
    if (t === 'null') return v === null;
    return true;
  };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function check(v, node, loc, seen) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
    if (node.$ref) {
      if (seen.has(node.$ref)) return null;
      const e = check(v, resolve(node.$ref), loc, new Set(seen).add(node.$ref));
      if (e) return e;
    }
    if (node.type !== undefined) {
      const ts = Array.isArray(node.type) ? node.type : [node.type];
      if (!ts.some(t => typeOk(v, t))) return 'type ' + JSON.stringify(node.type) + ' at ' + loc;
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (node.required) for (const r of node.required) if (!(r in v)) return 'missing ' + r + ' at ' + loc;
      if (node.properties) for (const [k, sub] of Object.entries(node.properties)) if (k in v) { const e = check(v[k], sub, loc + '.' + k, seen); if (e) return e; }
      if (node.additionalProperties === false) for (const k of Object.keys(v)) if (!node.properties || !(k in node.properties)) return 'extra ' + k + ' at ' + loc;
      if (node.minProperties !== undefined && Object.keys(v).length < node.minProperties) return 'minProperties at ' + loc;
      if (node.propertyNames && node.propertyNames.pattern) { const re = new RegExp(node.propertyNames.pattern); for (const k of Object.keys(v)) if (!re.test(k)) return 'propName ' + k + ' at ' + loc; }
    }
    if (Array.isArray(v)) {
      if (node.items) for (let idx = 0; idx < v.length; idx += 1) { const e = check(v[idx], node.items, loc + '[' + idx + ']', seen); if (e) return e; }
      if (node.minItems !== undefined && v.length < node.minItems) return 'minItems at ' + loc;
      if (node.maxItems !== undefined && v.length > node.maxItems) return 'maxItems at ' + loc;
      if (node.uniqueItems) { const s = new Set(v.map(x => JSON.stringify(x))); if (s.size !== v.length) return 'uniqueItems at ' + loc; }
    }
    if (node.oneOf) {
      const npass = node.oneOf.filter(sub => !check(v, sub, loc, seen)).length;
      if (npass !== 1) return 'oneOf ' + npass + ' at ' + loc;
    }
    if (node.enum !== undefined && !node.enum.some(x => eq(x, v))) return 'enum at ' + loc;
    if (node.const !== undefined && !eq(node.const, v)) return 'const at ' + loc;
    if (typeof v === 'string') {
      if (node.minLength !== undefined && v.length < node.minLength) return 'minLength at ' + loc;
      if (node.pattern && !new RegExp(node.pattern).test(v)) return 'pattern at ' + loc;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (node.minimum !== undefined && v < node.minimum) return 'minimum at ' + loc;
      if (node.maximum !== undefined && v > node.maximum) return 'maximum at ' + loc;
    }
    if (node.if && !check(v, node.if, loc, seen) && node.then) { const e = check(v, node.then, loc, seen); if (e) return e; }
    return null;
  }
  return v => check(v, root, '$', new Set());
}
function openObjectNodes(node, out, loc = '$') {
  if (Array.isArray(node)) return node.forEach((x, i) => openObjectNodes(x, out, loc + '[' + i + ']'));
  if (!node || typeof node !== 'object') return;
  if (node.type === 'object' && node.additionalProperties !== false && !node.propertyNames) out.push(loc);
  for (const k of Object.keys(node)) {
    if (k === 'properties' || k === '$defs' || k === 'definitions') {
      if (node[k] && typeof node[k] === 'object') for (const [kk, vv] of Object.entries(node[k])) openObjectNodes(vv, out, loc + '.' + k + '.' + kk);
    } else if (k === 'items' || k === 'oneOf' || k === 'propertyNames' || k === 'if' || k === 'then') openObjectNodes(node[k], out, loc + '.' + k);
  }
}
for (const [d, s] of [['F1', 'F2'], ['F3', 'F2'], ['F4', 'F5'], ['F7', 'F8'], ['F9', 'F8']]) {
  const data = readJson(NINE[d][0]);
  const schema = readJson(NINE[s][0]);
  const err = makeValidator(schema)(data);
  ok('schema ' + NINE[d][1] + ' vs ' + NINE[s][1], !err, err || '');
}
for (const tag of ['F2', 'F5', 'F8']) {
  const schema = readJson(NINE[tag][0]);
  const open = [];
  openObjectNodes(schema, open);
  const bad = tag === 'F2'
    ? open.filter(x => !x.startsWith('$.definitions.cases'))
    : tag === 'F8'
      ? open.filter(x => x !== '$' && !x.startsWith('$.$defs.case'))
      : open;
  ok('schema-closed ' + tag, bad.length === 0, 'open=' + bad.slice(0, 5).join(','));
}

// ---- block B: BehaviorProvider 15 cases ----
const BP1 = readJson(NINE.F1[0]);
const CASES = readJson(NINE.F3[0]);
const C = BP1.constants;
const W = BP1.weights.constants;
const DIMS = BP1.components.map(c => c.direction);
const clamp01 = x => Math.min(1, Math.max(0, x));
function num(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) return Number(x);
  return NaN;
}
const FORBIDDEN_MAP = Object.fromEntries(BP1.inputSurface.forbidden.map(f => [f.name, f.code]));
function runCase(input, zeroDim = null) {
  const forbidden = Object.keys(input).filter(k => FORBIDDEN_MAP[k]);
  if (forbidden.length) return { fatal: FORBIDDEN_MAP[forbidden[0]], picks: [], consumed: 0, margin: 0, V: [], F: [], best: null, vecs: {}, ws: [], dist: null, exclusion: {} };
  const belief = input.publicBelief;
  const p = clamp01(belief.belief_prior_strength ?? 0);
  const q = clamp01(belief.confidence ?? 0);
  const u = clamp01(belief.uncertainty_width ?? 1);
  const raw = [W.a1 * (1 + W.alpha * q), W.a2 * (1 + W.beta * p), W.a3 * (1 + W.gamma * p + W.gammaPrime * q), W.a4 * (1 + W.lambda * u), W.a5 * (1 + W.mu * u), W.a6];
  if (zeroDim) raw[5] = 0;
  const sum = raw.reduce((a, b) => a + b, 0);
  const ws = raw.map(x => x / sum);
  const vecs = {};
  const exclusion = {};
  for (const cand of input.frozenCandidates) {
    const m = cand.mechanical;
    const v = [
      clamp01(num(m.objectiveContribution)),
      m.immediateBranchValues.length ? clamp01(Math.min(...m.immediateBranchValues.map(num))) : 0,
      m.visibleHpRatios.length ? clamp01(m.visibleHpRatios.map(num).reduce((a, b) => a + b, 0) / m.visibleHpRatios.length) : 0,
      clamp01(u * num(m.revealStrength) * clamp01((num(m.declaredEffectHigh) - num(m.declaredEffectLow)) / C.refSpread)),
      m.resourceRatios.length ? clamp01(m.resourceRatios.map(num).reduce((a, b) => a + b, 0) / m.resourceRatios.length) : 0,
      clamp01(num(m.declaredOverkill)),
    ];
    if (v.some(x => !Number.isFinite(x))) return { fatal: 'NON_FINITE', picks: [], consumed: 0, margin: 0, V: [], F: [], best: null, vecs: {}, ws: [], dist: null, exclusion: {} };
    vecs[cand.candidateId] = { v, score: ws.reduce((a, w, i) => a + w * v[i], 0) };
    const reasons = [];
    if (Array.isArray(m.legalityFlags) && m.legalityFlags.length) reasons.push(...m.legalityFlags);
    if (m.actorStatus === 'DISABLED' || m.actorStatus === 'TERMINAL') reasons.push(m.actorStatus === 'DISABLED' ? 'ACTOR_DISABLED' : 'ACTOR_TERMINAL');
    if (Number(m.targetCount) < 1) reasons.push('TARGET_EMPTY');
    if (reasons.length) exclusion[cand.candidateId] = { reason: reasons.join(','), vector: v };
  }
  const active = input.frozenCandidates.filter(c => !exclusion[c.candidateId]);
  const dominates = (a, b) => {
    let strict = false;
    for (let i = 0; i < 6; i += 1) {
      if (DIMS[i] === 'MAXIMIZE') { if (a[i] < b[i]) return false; if (a[i] > b[i]) strict = true; }
      else { if (a[i] > b[i]) return false; if (a[i] < b[i]) strict = true; }
    }
    return strict;
  };
  const classes = new Map();
  for (const c of active) {
    const key = JSON.stringify(vecs[c.candidateId].v);
    if (!classes.has(key) || c.candidateId < classes.get(key)) classes.set(key, c.candidateId);
  }
  const ids = [...classes.values()];
  const F = ids.filter(a => !ids.some(b => b !== a && dominates(vecs[b].v, vecs[a].v)));
  const best = [...F].sort((a, b) => vecs[b].score - vecs[a].score || (a < b ? -1 : 1))[0];
  const others = F.filter(x => x !== best).map(x => vecs[x].score);
  const margin = others.length ? vecs[best].score - Math.max(...others) : Infinity;
  let V = [];
  if (margin > C.epsilon) V = [best];
  else {
    for (const cid of F) {
      let inBand = vecs[cid].score >= vecs[best].score - C.epsilon;
      for (let i = 0; i < 6 && inBand; i += 1) {
        if (DIMS[i] === 'MAXIMIZE' && vecs[cid].v[i] < vecs[best].v[i] - C.delta) inBand = false;
        if (DIMS[i] === 'MINIMIZE' && vecs[cid].v[i] > vecs[best].v[i] + C.delta) inBand = false;
      }
      if (inBand) V.push(cid);
    }
  }
  V.sort();
  const facts = input.seededRandomFacts || [];
  const picks = [];
  let consumed = 0;
  let dist = null;
  if (V.length >= 2 && facts.length) {
    const minS = Math.min(...V.map(x => vecs[x].score));
    const masses = V.map(x => Math.pow(vecs[x].score - minS + C.rho, C.kappa));
    const total = masses.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(total) || total <= 0) return { fatal: 'NON_FINITE', picks: [], consumed: 0, margin, V, F, best, vecs, ws, dist: null, exclusion };
    dist = Object.fromEntries(V.map((x, i) => [x, masses[i] / total]));
    let acc = 0;
    const cum = V.map((x, i) => { acc += masses[i] / total; return acc; });
    for (const f of facts) {
      consumed += 1;
      let pick = V[V.length - 1];
      for (let i = 0; i < V.length; i += 1) {
        if (cum[i] > f.actualValue) { pick = V[i]; break; }
      }
      picks.push({ seed: f.seed, actualValue: f.actualValue, pick });
    }
  }
  return { fatal: null, picks, consumed, margin, V, F, best, vecs, ws, dist, exclusion };
}
const pickOf = (run, av) => {
  const f = run.picks.find(x => x.actualValue === av || Object.is(x.actualValue, av));
  return f ? f.pick : null;
};
const round4 = x => Math.round(x * 10000) / 10000;
const sorted = a => JSON.stringify([...a].sort());
for (const cs of CASES.cases) {
  const id = cs.caseId;
  const inp = cs.input;
  const exp = cs.expect;
  const base = runCase(inp);
  if (exp.fatal) { ok(id + ' fatal ' + exp.fatal, base.fatal === exp.fatal, 'got ' + base.fatal); continue; }
  if (exp.alwaysSelect) ok(id + ' alwaysSelect', base.best === exp.alwaysSelect, 'got ' + base.best);
  if (exp.neverSelect) ok(id + ' neverSelect', exp.neverSelect.every(x => x !== base.best) && !base.picks.some(x => exp.neverSelect.includes(x.pick)));
  if (exp.gold && exp.gold.margin !== undefined) ok(id + ' margin', close(base.margin, exp.gold.margin), 'got ' + base.margin);
  if (exp.gold && exp.gold.frontier) ok(id + ' frontier', sorted(base.F) === sorted(exp.gold.frontier), 'got ' + sorted(base.F));
  if (exp.gold && exp.gold.band) ok(id + ' band', sorted(base.V) === sorted(exp.gold.band), 'got ' + sorted(base.V));
  if (exp.gold && exp.gold.distribution) for (const [cid, prob] of Object.entries(exp.gold.distribution)) ok(id + ' distribution[' + cid + ']', base.dist && close(round4(base.dist[cid]), prob, 1e-9), 'got ' + (base.dist ? round4(base.dist[cid]) : 'no-dist'));
  if (exp.gold && exp.gold.picks) for (const [av, want] of Object.entries(exp.gold.picks)) ok(id + ' pick ' + av, pickOf(base, Number(av)) === want, 'got ' + pickOf(base, Number(av)));
  if (exp.gold && exp.gold.boundaryPicks) for (const [av, want] of Object.entries(exp.gold.boundaryPicks)) ok(id + ' boundaryPick ' + av, pickOf(base, Number(av)) === want, 'got ' + pickOf(base, Number(av)));
  if (exp.reachable) {
    const picked = new Set(base.picks.map(x => x.pick));
    ok(id + ' reachable', [...exp.reachable].every(x => picked.has(x)), 'picked ' + JSON.stringify([...picked]));
  }
  if (exp.goldVector) ok(id + ' goldVector', base.vecs[exp.alwaysSelect] && base.vecs[exp.alwaysSelect].v.every((x, i) => close(x, exp.goldVector[i], 1e-9)), 'got ' + JSON.stringify(base.vecs[exp.alwaysSelect].v));
  if (exp.s4Checks) for (const s of exp.s4Checks) {
    const got = clamp01(s.u * s.revealStrength * clamp01((s.declaredEffectHigh - s.declaredEffectLow) / C.refSpread));
    ok(id + ' s4 ' + s.revealStrength + '/' + s.declaredEffectLow + '-' + s.declaredEffectHigh, close(got, s.expected, 1e-9), 'got ' + got);
  }
  if (exp.exclusionRecorded) {
    const rec = base.exclusion[exp.exclusionRecorded.candidateId];
    ok(id + ' exclusionRecorded', rec && rec.reason === exp.exclusionRecorded.reason && rec.vector.every((x, i) => close(x, exp.exclusionRecorded.vector[i], 1e-9)), JSON.stringify(rec));
  }
  if (exp.consumesNoRandomFact === true) ok(id + ' consumesNoRandomFact', base.consumed === 0, 'consumed ' + base.consumed);
  if (exp.replay === true) ok(id + ' replay', JSON.stringify(base.picks) === JSON.stringify(runCase(inp).picks));
  if (exp.sameAsIgnoredDim) ok(id + ' sameAsIgnoredDim', runCase(inp, 'S6').best === exp.alwaysSelect, 'got ' + runCase(inp, 'S6').best);
  if (exp.runs) {
    const inRuns = inp.runs || [];
    for (const r of exp.runs) {
      const src = inRuns.find(x => x.label === r.label) || {};
      const merged = JSON.parse(JSON.stringify(inp));
      if (src.publicBelief) merged.publicBelief = src.publicBelief;
      if (src.frozenCandidates) merged.frozenCandidates = src.frozenCandidates;
      if (src.seededRandomFacts) merged.seededRandomFacts = src.seededRandomFacts;
      if (src.forbiddenKey) merged[src.forbiddenKey] = { probe: true };
      const rr = runCase(merged);
      if (r.fatal) ok(id + ' run ' + r.label + ' fatal', rr.fatal === r.fatal, 'got ' + rr.fatal);
      if (r.alwaysSelect) ok(id + ' run ' + r.label + ' alwaysSelect', rr.best === r.alwaysSelect, 'got ' + rr.best);
      if (r.consumesNoRandomFact === true) ok(id + ' run ' + r.label + ' noFact', rr.consumed === 0, 'consumed ' + rr.consumed);
      if (r.reachable) {
        const picked = new Set(rr.picks.map(x => x.pick));
        ok(id + ' run ' + r.label + ' reachable', [...r.reachable].every(x => picked.has(x)), 'picked ' + JSON.stringify([...picked]));
      }
      if (r.gold) {
        if (r.gold.margin !== undefined) ok(id + ' run ' + r.label + ' margin', close(rr.margin, r.gold.margin), 'got ' + rr.margin);
        if (r.gold.weights) ok(id + ' run ' + r.label + ' weights', rr.ws.every((x, i) => close(x, r.gold.weights[i], 1e-5)), 'got ' + rr.ws.map(round4).join(','));
        if (r.gold.scores) for (const [cid, sc] of Object.entries(r.gold.scores)) ok(id + ' run ' + r.label + ' score[' + cid + ']', close(rr.vecs[cid].score, sc, 1e-5), 'got ' + rr.vecs[cid].score);
        if (r.gold.band) ok(id + ' run ' + r.label + ' band', sorted(rr.V) === sorted(r.gold.band), 'got ' + sorted(rr.V));
        if (r.gold.distribution) for (const [cid, prob] of Object.entries(r.gold.distribution)) ok(id + ' run ' + r.label + ' dist[' + cid + ']', rr.dist && close(round4(rr.dist[cid]), prob, 1e-9), 'got ' + (rr.dist ? round4(rr.dist[cid]) : 'no-dist'));
        if (r.gold.picks) for (const [av, want] of Object.entries(r.gold.picks)) ok(id + ' run ' + r.label + ' pick ' + av, pickOf(rr, Number(av)) === want, 'got ' + pickOf(rr, Number(av)));
        if (r.gold.boundaryPicks) for (const [av, want] of Object.entries(r.gold.boundaryPicks)) ok(id + ' run ' + r.label + ' bPick ' + av, pickOf(rr, Number(av)) === want, 'got ' + pickOf(rr, Number(av)));
      }
    }
  }
}

// ---- block C: Prototype dynamic universe + shared contract reads ----
const universe = buildPrototypePathUniverse({ repoRoot });
const F7 = readJson(NINE.F7[0]);
const F9 = readJson(NINE.F9[0]);
const F6 = readJson(NINE.F6[0]);
const F4 = readJson(NINE.F4[0]);
const F4hard = F4.hardGates;
ok('universe 27/23/4', universe.registrySummary.prototypeCount === 27 && universe.registrySummary.inBattlePrototypeCount === 23 && universe.registrySummary.outOfBattlePrototypeCount === 4);
ok('universe 621/91/712', universe.partitions.IN_BATTLE.pathCount === 621 && universe.partitions.OUT_OF_BATTLE.pathCount === 91 && universe.partitions.totalPathCount === 712);
ok('universe paths 712 unique', universe.paths.length === 712 && new Set(universe.paths.map(r => r.pathId)).size === 712);
const uniDef = universe.paths.filter(r => r.scope === 'IN_BATTLE' && (r.prototype === '复制执行' || r.prototype === '时光回溯')).map(r => r.pathId).sort();
ok('universe deferred 40', uniDef.length === 40 && new Set(uniDef).size === 40);
ok('universe supported 581', universe.partitions.IN_BATTLE.pathCount - uniDef.length === 581);
const f7def = F7.deferredPaths.map(d => d.pathId).sort();
const f9def = [...F9.deferredPathIds].sort();
const f6def = [...F6.mechanicPathEnrollment.deferredPathIds].sort();
ok('deferred pathIds F7==F9', JSON.stringify(f7def) === JSON.stringify(f9def));
ok('deferred pathIds F7==F6', JSON.stringify(f7def) === JSON.stringify(f6def));
ok('deferred pathIds F7==universe', JSON.stringify(f7def) === JSON.stringify(uniDef));
ok('deferred deferCode all DEFER_MECHANICS_PROJECTION', F7.deferredPaths.every(d => d.deferCode === 'DEFER_MECHANICS_PROJECTION'));
const bp = F9.counts.byPrototype;
const supSum = Object.values(bp).filter(v => v.status === 'SUPPORTED').reduce((a, v) => a + v.pathCount, 0);
const defSum = Object.values(bp).filter(v => v.status === 'DEFERRED_EXPLICIT').reduce((a, v) => a + v.pathCount, 0);
ok('F9 counts 581/40/621', supSum === 581 && defSum === 40 && F9.counts.inBattlePathCount === 621 && F9.counts.supportedPathCount === 581 && F9.counts.deferredPathCount === 40);
ok('F9 out-of-battle 4/91', F9.counts.outOfBattlePrototypeCount === 4 && F9.counts.outOfBattlePathCount === 91);
ok('F9 rejected/silent 0', F9.counts.rejectedInputPathCount === 0 && F9.counts.silentOmissionCount === 0);
ok('F7 registry 27', Object.keys(F7.registry).length === 27 && Object.keys(F7.registry).every(p => bp[p] || ['修炼增益', '天赋提升', '永久属性提升', '战斗外复活'].includes(p)));

// ---- block C2: DirectFactRowV1 pair + Prototype rev3 cases/probes (static contract reference only; adapter module is never loaded) ----
const PIN = {
  'tools/rc6/contracts/PrototypeDirectAdapterV1.json': '4a523b3a97dec5f596b1111eeaf9dbb12ed8ecb6637f4bd77187072c0743a387',
  'tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json': 'da24635ada44e4bbb0d7a677fc629e02301abb1ddc2a4eed14cbdc23d13e0979',
  'tools/rc6/cases/PrototypeDirectAdapterCasesV1.json': '5d359b44330d06181ea9e65d84c6091fa7112b51fc052adb15e737bc02bca977',
  'tools/rc6/contracts/DirectFactRowV1.json': 'fde8f2efe52653a3ab8692c62ce223459f1f44bb6f2224bce4ff14c61999eeff',
  'tools/rc6/contracts/DirectFactRowV1.schema.json': '1cf2490b90c0ebabcbcd163436dcc963209240d1fec049e7ba8815f1c4d49334',
};
ok('freeze pin rev3 contracts + DirectFact pair', Object.entries(PIN).every(([p, h]) => sha256(fs.readFileSync(path.join(repoRoot, p))) === h));
const DF = readJson('contracts/DirectFactRowV1.json');
const DFS = readJson('contracts/DirectFactRowV1.schema.json');
const F8 = readJson(NINE.F8[0]);
const DF_VAL = makeValidator(DFS);
const DFIELDS = ['schemaVersion', 'factType', 'key', 'sourceActionId', 'sourceActorId', 'sourceEffectId', 'targetIds', 'amount', 'unit', 'durationTurns'];
const dKeys = Object.keys(DF.fields);
ok('directfact fields exactly 10', dKeys.length === 10 && JSON.stringify(dKeys) === JSON.stringify(DFIELDS));
ok('directfact schema required 10', JSON.stringify([...DFS.required].sort()) === JSON.stringify([...DFIELDS].sort()));
ok('directfact schema properties closed', JSON.stringify(Object.keys(DFS.properties).sort()) === JSON.stringify([...DFIELDS].sort()) && DFS.additionalProperties === false);
ok('directfact fields required+closed', DFIELDS.every(k => DF.fields[k] && DF.fields[k].required === true && DF.fields[k].closed === true));
const ftS = [...DFS.properties.factType.enum].sort();
ok('factType enum 11 closed', DF.fields.factType.enum.length === 11 && JSON.stringify(DF.fields.factType.enum) === JSON.stringify(DF.factTypeEnum) && JSON.stringify([...DF.factTypeEnum].sort()) === JSON.stringify(ftS));
const unS = [...DFS.properties.unit.enum].sort();
ok('unit enum 8 closed', DF.fields.unit.enum.length === 8 && JSON.stringify([...DF.fields.unit.enum].sort()) === JSON.stringify(unS) && JSON.stringify(Object.keys(DF.unitEnum).sort()) === JSON.stringify(unS));
const dfOpen = [];
openObjectNodes(DFS, dfOpen);
ok('directfact schema closed no open objects', dfOpen.length === 0, dfOpen.slice(0, 5).join(','));
ok('directfact source required minLength', ['sourceActionId', 'sourceActorId', 'sourceEffectId'].every(k => DFS.required.includes(k) && DFS.properties[k].minLength >= 1));
const tgt = DFS.properties.targetIds;
ok('directfact targetIds rules', tgt.minItems === 1 && tgt.uniqueItems === true && !!tgt.items.pattern && !!tgt.items.not && Array.isArray(tgt.items.not.enum) && tgt.items.not.enum.length === 11);
ok('directfact amount finite + durationTurns', DFS.properties.amount.type === 'number' && DFS.properties.durationTurns.type === 'integer' && DFS.properties.durationTurns.minimum === 0);
ok('directfact finite runtime rules declared', JSON.stringify(DF.invariants).includes('finite') && JSON.stringify(DF.validation.selfChecks).includes('finite') && F7.interface.sourceAndTargetContext.amountFinite === 'RUNTIME_VALIDATOR_REQUIRED');
ok('directfact claim CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED', DF.authority.claim === 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED' && /581\/40/.test(DF.authority.claimDetail) && DF.authority.claimDetail.includes('contract target'));
ok('directfact declared magnitudes only', DF.authority.declaredMagnitudeOnly === true && DF.authority.finalSettlement === 'DEFERRED_TO_DOWNSTREAM_KERNEL' && DF.authority.futureRouteDerivation === false && DF.authority.worldClone === false);
ok('directfact supersedes adapter revision 3', typeof DF.authority.supersedes === 'string' && DF.authority.supersedes.includes('revision 3'));
ok('rev3 contract/schema/cases', DF.revision === 3 && F7.revision === 3 && F8.revision === 3 && F9.revision === 3);
ok('directfact sourceHashes 3 match disk', Object.keys(DF.sourceHashes).length === 3 && Object.entries(DF.sourceHashes).every(([p, h]) => sha256(fs.readFileSync(path.join(repoRoot, p))) === h));
ok('prototype rev3 43 cases unique', F9.cases.length === 43 && new Set(F9.cases.map(c => c.caseId)).size === 43);
ok('prototype red probes 14 unique', F9.redProbes.length === 14 && new Set(F9.redProbes.map(p => p.probeId)).size === 14);
const KINDS = ['POSITIVE', 'LEGALITY', 'DEFER', 'NEGATIVE', 'ANTI_PATTERN'];
ok('prototype kinds closed', F9.cases.every(c => KINDS.includes(c.kind)));
const kindCounts = {};
for (const c of F9.cases) kindCounts[c.kind] = (kindCounts[c.kind] || 0) + 1;
ok('prototype kind counts 26/3/4/1/9', kindCounts.POSITIVE === 26 && kindCounts.LEGALITY === 3 && kindCounts.DEFER === 4 && kindCounts.NEGATIVE === 1 && kindCounts.ANTI_PATTERN === 9, JSON.stringify(kindCounts));
const ALL_ITEMS = [...F9.cases.map(c => ({ id: c.caseId, ctx: c.context, eff: c.effect, ex: c.expect })), ...F9.redProbes.map(p => ({ id: p.probeId, ctx: p.context, eff: p.effect, ex: p.expect }))];
ok('all 57 context 4 keys explicit', ALL_ITEMS.every(x => ['sourceActionId', 'sourceActorId', 'sourceEffectId'].every(k => typeof x.ctx[k] === 'string' && x.ctx[k].length > 0) && Array.isArray(x.ctx.candidateTargetIds) && x.ctx.candidateTargetIds.length > 0));
const bpSet = new Set(Object.keys(F9.counts.byPrototype));
const resTarget = (eff, ctx) => {
  const t = eff && eff['目标'];
  if (t === '自身') return [ctx.sourceActorId];
  if (['单体', '群体', '全场', '召唤物', '目标'].includes(t)) return ctx.candidateTargetIds;
  return null;
};
const sortedIds = a => JSON.stringify([...a].sort());
const allRows = [];
for (const c of F9.cases) {
  const ex = c.expect, ctx = c.context || {};
  ok(c.caseId + ' admitted bool', typeof ex.admitted === 'boolean');
  ok(c.caseId + ' context source', ['sourceActionId', 'sourceActorId', 'sourceEffectId'].every(k => typeof ctx[k] === 'string' && ctx[k].length > 0));
  ok(c.caseId + ' context candidateTargetIds', Array.isArray(ctx.candidateTargetIds) && ctx.candidateTargetIds.length > 0);
  ok(c.caseId + ' prototype registered', bpSet.has(c.prototype) || c.prototype === '未知原型');
  if (ex.deferCode !== undefined) ok(c.caseId + ' deferCode allowed', ex.deferCode === '' || F7.interface.allowedDeferCodes.includes(ex.deferCode));
  if (ex.unsupportedOutcomeKinds !== undefined) ok(c.caseId + ' unsupported kinds array', Array.isArray(ex.unsupportedOutcomeKinds));
  if (c.kind === 'DEFER') ok(c.caseId + ' defer semantics', ex.admitted === true && ex.deferCode === 'DEFER_MECHANICS_PROJECTION' && Array.isArray(ex.unsupportedOutcomeKinds) && ex.unsupportedOutcomeKinds.length > 0 && ex.retainedInCandidateAudit === true);
  if (ex.admitted === false && ex.reasonCode !== undefined) ok(c.caseId + ' reasonCode', typeof ex.reasonCode === 'string' && ex.reasonCode.length > 0);
  if (ex.legalityModifiers !== undefined) ok(c.caseId + ' legalityModifiers nonempty', JSON.stringify(ex.legalityModifiers) !== '{}');
  if (ex.opportunityModifiers !== undefined) ok(c.caseId + ' opportunityModifiers nonempty', JSON.stringify(ex.opportunityModifiers) !== '{}');
  if (ex.scheduledFacts !== undefined) ok(c.caseId + ' scheduledFacts array', Array.isArray(ex.scheduledFacts) && ex.scheduledFacts.every(s => s && typeof s === 'object'));
  const hasOut = (ex.directFacts && ex.directFacts.length) || ex.legalityModifiers !== undefined || ex.opportunityModifiers !== undefined || (ex.scheduledFacts && ex.scheduledFacts.length);
  if (ex.admitted === true && !ex.deferCode && !hasOut) ok(c.caseId + ' retainedInCandidateAudit', ex.retainedInCandidateAudit === true);
  for (const r of ex.directFacts || []) {
    allRows.push(r);
    ok(c.caseId + ' row DF schema', !DF_VAL(r));
    ok(c.caseId + ' row source matches ctx', r.sourceActionId === ctx.sourceActionId && r.sourceActorId === ctx.sourceActorId && r.sourceEffectId === ctx.sourceEffectId);
    const want = resTarget(c.effect, ctx);
    ok(c.caseId + ' row targetIds resolve', want !== null && sortedIds(r.targetIds) === sortedIds(want), JSON.stringify(r.targetIds) + ' vs ' + JSON.stringify(want));
  }
}
for (const p of F9.redProbes) {
  const ex = p.expect;
  ok(p.probeId + ' admitted bool', typeof ex.admitted === 'boolean');
  ok(p.probeId + ' context', ['sourceActionId', 'sourceActorId', 'sourceEffectId'].every(k => typeof p.context[k] === 'string' && p.context[k].length > 0) && Array.isArray(p.context.candidateTargetIds) && p.context.candidateTargetIds.length > 0);
  if (ex.admitted === false) ok(p.probeId + ' reject evidence', (typeof ex.reasonCode === 'string' && ex.reasonCode.length > 0) || (ex.schemaRejected === true && typeof ex.invalidFactType === 'string' && ex.invalidFactType.length > 0), JSON.stringify(ex));
  if (ex.admitted === true) ok(p.probeId + ' contract gold present', (ex.directFacts && ex.directFacts.length > 0) || (ex.scheduledFacts && ex.scheduledFacts.length > 0) || ex.noInputAliasing === true || (ex.deferCode && ex.unsupportedOutcomeKinds && ex.unsupportedOutcomeKinds.length > 0 && ex.reasonCode), JSON.stringify(ex));
  if (ex.directFacts) for (const r of ex.directFacts) {
    allRows.push(r);
    ok(p.probeId + ' row DF schema', !DF_VAL(r));
    const want = resTarget(p.effect, p.context);
    ok(p.probeId + ' row targetIds resolve', want !== null && sortedIds(r.targetIds) === sortedIds(want));
  }
  if (ex.ambiguousTaunt !== undefined) ok(p.probeId + ' ambiguousTaunt', ex.ambiguousTaunt === true);
}
ok('PA selfChecks rev3 flags', F7.validation.selfChecks.multiRowKeyVocabularyFrozen === true && F7.validation.selfChecks.rowUniquenessBySourceEffectIdAndKey === true && F7.validation.selfChecks.maxActionsExplicitOnly === true && F7.validation.selfChecks.triggerKeyRegistryEnumClosed === true && F7.validation.selfChecks.nestedPayloadRecursiveProjection === true);
ok('PA grant triggerKey enum declared', /主动触发\/随下次行动触发 only/.test(F7.interface.project.output.scheduledFacts) && /随下次行动触发 projects no maxActions/.test(F7.interface.project.output.scheduledFacts) && /死亡时触发 is INVALID_OPTION_VALUE/.test(F7.constraints.join('\n')));
ok('PA multiRow/window/damage declared', /damage\.power\/damage\.segments\/damage\.penetration\/damage\.type, state\.primary\/state\.secondary, window\.adjustTurns\/window\.settlementRatio/.test(F7.constraints.join('\n')) && /row uniqueness is \(sourceEffectId, key\)/.test(F7.constraints.join('\n')) && /攻击段数 must be a positive integer/.test(F7.constraints.join('\n')) && /结算倍率 is allowed only with 调整字段=持续回合 and 调整方式=压缩/.test(F7.constraints.join('\n')));
ok('DF selfChecks rev3 rules', JSON.stringify(DF.validation.selfChecks).includes('(sourceEffectId, key)') && JSON.stringify(DF.validation.selfChecks).includes('maxActions explicit only') && JSON.stringify(DF.validation.selfChecks).includes('triggerKey registry enum only'));
const stripMeta = o => { const c = JSON.parse(JSON.stringify(o)); for (const k of ['$schema', '$id', 'title', 'description']) delete c[k]; return c; };
ok('directFactRow embedded == authoritative schema', JSON.stringify(stripMeta(DFS)) === JSON.stringify(F8.$defs.directFactRow));
ok('PA dup-compare + window-key selfChecks', F7.validation.selfChecks.directFactRowSchemaDuplicateFrozenHarnessCompared === true && F7.validation.selfChecks.windowMultiRowKeysAreScheduledFactKeys === true);
ok('PAS no .* no-op', !/patternProperties/.test(fs.readFileSync(path.join(rc6, 'contracts/PrototypeDirectAdapterV1.schema.json'), 'utf8')) && !/"\.\*"/.test(fs.readFileSync(path.join(rc6, 'contracts/PrototypeDirectAdapterV1.schema.json'), 'utf8')));
ok('PAS object defs all closed', Object.entries(F8.$defs || {}).filter(([, v]) => v && typeof v === 'object' && v.type === 'object').every(([, v]) => v.additionalProperties === false || !!v.propertyNames));
const VOCAB = ['damage.power', 'damage.segments', 'damage.penetration', 'damage.type', 'state.primary', 'state.secondary', 'window.adjustTurns', 'window.settlementRatio'];
const mkeys = [];
for (const id of ['pos-damage-multivalue', 'pos-state-multivalue']) {
  const c = F9.cases.find(x => x.caseId === id);
  for (const r of c.expect.directFacts || []) {
    mkeys.push({ id, key: r.key, row: r });
  }
  ok(id + ' multiRow keys nonempty + same sourceEffectId', (c.expect.directFacts || []).every(r => typeof r.key === 'string' && r.key.length > 0 && r.sourceEffectId === c.context.sourceEffectId));
}
const wmC = F9.cases.find(x => x.caseId === 'pos-window-multivalue');
for (const sf of wmC.expect.scheduledFacts || []) mkeys.push({ id: 'pos-window-multivalue', key: sf.key, row: sf });
ok('multiRow vocabulary exactly 8', mkeys.length === 8 && JSON.stringify(mkeys.map(m => m.key).sort()) === JSON.stringify([...VOCAB].sort()), mkeys.map(m => m.key).join(','));
ok('multiRow (sourceEffectId,key) unique', new Set(mkeys.map(m => (m.row.sourceEffectId || 'sf') + '::' + m.key)).size === mkeys.length);
const numPct = s => Number(String(s).replace(/[+%]/g, ''));
const dmC = F9.cases.find(x => x.caseId === 'pos-damage-multivalue');
const dmExp = { 'damage.power': [Number(dmC.effect['威力倍率']), 'POWER'], 'damage.segments': [Number(dmC.effect['攻击段数']), 'COUNT'], 'damage.penetration': [Number(dmC.effect['防御穿透']), 'PERCENT'], 'damage.type': [1, 'BOOL'] };
for (const [k, [amt, unit]] of Object.entries(dmExp)) {
  const r = (dmC.expect.directFacts || []).find(x => x.key === k);
  ok('multiRow damage.' + k, r && r.amount === amt && r.unit === unit, JSON.stringify(r));
}
const smC = F9.cases.find(x => x.caseId === 'pos-state-multivalue');
const smExp = { 'state.primary': [numPct(smC.effect['数值']), 'PERCENT', Number(smC.effect['持续回合'])], 'state.secondary': [numPct(smC.effect['副数值']), 'PERCENT', Number(smC.effect['持续回合'])] };
for (const [k, [amt, unit, dur]] of Object.entries(smExp)) {
  const r = (smC.expect.directFacts || []).find(x => x.key === k);
  ok('multiRow state.' + k, r && r.amount === amt && r.unit === unit && r.durationTurns === dur, JSON.stringify(r));
}
ok('multiRow window facts', wmC.expect.scheduledFacts.some(x => x.key === 'window.adjustTurns' && x.operation === 'WINDOW_ADJUST' && x.调整回合 === 2 && x.方式 === '压缩') && wmC.expect.scheduledFacts.some(x => x.key === 'window.settlementRatio' && x.operation === 'SETTLEMENT_RATIO_ADJUST' && x.结算倍率 === 0.8));
const TRIGGERS = ['主动触发', '随下次行动触发'];
const followups = ALL_ITEMS.flatMap(x => (x.ex.scheduledFacts || []).filter(s => s && s.grantType === 'FOLLOW_UP').map(s => ({ fact: s, item: x })));
ok('FOLLOW_UP triggerKey enum', followups.every(({ fact }) => TRIGGERS.includes(fact.triggerKey)), followups.map(({ fact }) => fact.triggerKey).join(','));
ok('FOLLOW_UP maxActions explicit only', followups.every(({ fact, item }) => fact.triggerKey === '主动触发' ? fact.maxActions === Number(item.eff['可用次数']) : !('maxActions' in fact)));
ok('FOLLOW_UP payload rows DF schema', followups.every(({ fact }) => !(fact.payloadDirectFacts && fact.payloadDirectFacts.some(r => DF_VAL(r)))));
ok('随下次行动触发 no 可用次数', ALL_ITEMS.filter(x => x.eff && x.eff['触发条件'] === '随下次行动触发').every(x => x.eff['可用次数'] === undefined));
const pgf = F9.cases.find(c => c.caseId === 'pos-grant-followup');
ok('grant explicit count 2', pgf.expect.scheduledFacts[0].maxActions === 2 && pgf.expect.scheduledFacts[0].triggerKey === pgf.effect['触发条件'] && Number(pgf.effect['可用次数']) === 2);
const pgm = F9.redProbes.find(p => p.probeId === 'probe-grant-missing-usecount');
ok('grant missing count rejects', pgm.expect.admitted === false && pgm.expect.reasonCode === 'MISSING_REQUIRED_FIELD' && pgm.effect['可用次数'] === undefined && pgm.effect['触发条件'] === '主动触发');
const ptv = F9.redProbes.find(p => p.probeId === 'probe-trigger-variant');
ok('death trigger illegal', ptv.expect.admitted === false && ptv.expect.reasonCode === 'INVALID_OPTION_VALUE' && !TRIGGERS.includes(ptv.effect['触发条件']));
const pnp = F9.redProbes.find(p => p.probeId === 'probe-nested-payload-unprojectable');
ok('nested payload explicit defer', pnp.expect.admitted === true && pnp.expect.deferCode === 'DEFER_MECHANICS_PROJECTION' && pnp.expect.unsupportedOutcomeKinds.includes('COPY_EXECUTION') && pnp.expect.reasonCode === 'PAYLOAD_UNPROJECTABLE_DEFERRED');
const pgn = F9.cases.find(c => c.caseId === 'pos-grant-followup-next-action');
ok('next-action positive no maxActions', pgn.expect.admitted === true && pgn.effect['触发条件'] === '随下次行动触发' && pgn.effect['可用次数'] === undefined && pgn.expect.scheduledFacts.length === 1 && pgn.expect.scheduledFacts[0].triggerKey === '随下次行动触发' && !('maxActions' in pgn.expect.scheduledFacts[0]) && pgn.expect.scheduledFacts[0].payloadDirectFacts.length === 1);
const pwm = F9.redProbes.find(p => p.probeId === 'probe-window-missing-field');
ok('window missing 调整字段 rejects', pwm.expect.reasonCode === 'MISSING_REQUIRED_FIELD' && pwm.effect['调整字段'] === undefined);
const pwr = F9.redProbes.find(p => p.probeId === 'probe-window-settlement-ratio-with-extend');
ok('window ratio only with 压缩', pwr.expect.reasonCode === 'INVALID_OPTION_VALUE' && pwr.effect['调整方式'] === '延长' && pwr.effect['结算倍率'] !== undefined && wmC.effect['调整方式'] === '压缩' && wmC.expect.admitted === true);
const pds = F9.redProbes.find(p => p.probeId === 'probe-damage-invalid-segments');
ok('segments positive integer', pds.expect.reasonCode === 'INVALID_OPTION_VALUE' && Number(pds.effect['攻击段数']) === 0);
const pss = F9.redProbes.find(p => p.probeId === 'probe-state-secondary-invalid');
ok('state secondary golden reject', pss.expect.reasonCode === 'INVALID_OPTION_VALUE' && pss.effect['状态'] === '嘲讽' && pss.effect['副数值'] !== undefined);
ok('all directFact rows finite + typed', allRows.length > 0 && allRows.every(r => r.schemaVersion === 'DirectFactRowV1' && Number.isFinite(r.amount) && Number.isInteger(r.durationTurns) && r.durationTurns >= 0 && Array.isArray(r.targetIds) && r.targetIds.length > 0), String(allRows.length));
ok('581 not claimed implemented', F9.counts.supportedPathCount === 581 && Object.values(F9.counts.byPrototype).every(v => v.status === 'SUPPORTED' || v.status === 'DEFERRED_EXPLICIT'));
ok('no IMPLEMENTED claim in rev3 texts', ['contracts/PrototypeDirectAdapterV1.json', 'contracts/PrototypeDirectAdapterV1.schema.json', 'cases/PrototypeDirectAdapterCasesV1.json'].every(p => !/implement/i.test(fs.readFileSync(path.join(rc6, p), 'utf8'))));
ok('red probes contract-target-only', F9.redProbes.every(p => p.kind === 'RED_PROBE') && DF.authority.claim === 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED');
// ---- block D: Quality split / canonical sourceHash / mechanic hashes ----
const mech = F6.mechanicPathEnrollment;
const units = F6.behaviorQualityCorpus.units;
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  if (typeof v === 'number' && Object.is(v, -0)) return 0;
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('NON_FINITE_IN_CANONICAL');
  return v;
}
const canonical = o => sha256(JSON.stringify(sortKeys(o)));
const srcs = {};
for (const corpus of ['tools/rc6/cases/BehaviorOracleFixtureManifestV1.json', 'tools/rc6/cases/KernelReferenceCasesV1.json', 'tools/rc6/cases/ReferenceValueEvaluatorV3RawCasesV1.json']) {
  const d = readJson(corpus.replace('tools/rc6/', ''));
  const arr = d.fixtures || d.cases;
  srcs[corpus] = Object.fromEntries(arr.map(o => [o.sourceCaseId || o.caseId, o]));
}
let canonMatch = 0;
const canonMiss = [];
for (const u of units) {
  const o = srcs[u.corpus] && srcs[u.corpus][u.sourceCaseId];
  if (o && canonical(o) === u.sourceHash.toLowerCase()) canonMatch += 1;
  else canonMiss.push(u.unitId + ' want=' + u.sourceHash.slice(0, 12) + ' got=' + (o ? canonical(o).slice(0, 12) : 'NOOBJ'));
}
ok('quality canonical sourceHash 80', canonMatch === units.length, canonMatch + '/80; ' + canonMiss.slice(0, 6).join(' | '));
ok('quality units 80 unique', units.length === 80 && new Set(units.map(u => u.unitId)).size === 80);
const roles = {};
for (const u of units) roles[u.splitRole] = (roles[u.splitRole] || 0) + 1;
ok('quality roles 24/30/26', roles.train === 24 && roles.validation === 30 && roles.acceptance === 26, JSON.stringify(roles));
ok('quality sourceCaseId disjoint across roles', new Set(units.map(u => u.corpus + '::' + u.sourceCaseId)).size === 80);
ok('quality no NOWHERE', !JSON.stringify(F6).toUpperCase().includes('NOWHERE'));
ok('quality seed collisions 0', new Set(units.map(u => parseInt(sha256(u.unitId).slice(0, 8), 16))).size === 80);
const spEntries = Object.entries(bp).filter(([, v]) => v.status === 'SUPPORTED').map(([k, v]) => k + ':' + v.pathCount).sort();
ok('quality supportedPathHash', sha256(spEntries.join('\n')) === mech.supportedPathHash && mech.supportedPathHash === F4hard.enrollments.mechanicPathEnrollment.supportedPathHash, sha256(spEntries.join('\n')).slice(0, 16));
ok('quality deferredPathIdsHash', sha256([...mech.deferredPathIds].sort().join('\n')) === mech.deferredPathIdsHash && mech.deferredPathIdsHash === F4hard.enrollments.mechanicPathEnrollment.deferredPathIdsHash, sha256([...mech.deferredPathIds].sort().join('\n')).slice(0, 16));
ok('quality mechanic totals 581/40/621', mech.counts.supported === 581 && mech.counts.deferred === 40 && mech.counts.total === 621);
ok('quality deferred not behavior role', mech.deferredIsNotBehaviorRole === true && F6.behaviorQualityCorpus.deferredIsNotBehaviorRole === true);
ok('quality F6 sourceHashes all match', Object.entries(F6.sourceHashes || {}).every(([p, h]) => sha256(fs.readFileSync(path.join(repoRoot, p))) === h), String(Object.keys(F6.sourceHashes || {}).length));
ok('quality F6 sourceHashes 12 + DirectFact pair', Object.keys(F6.sourceHashes || {}).length === 12 && Object.keys(F6.sourceHashes).includes('tools/rc6/contracts/DirectFactRowV1.json') && Object.keys(F6.sourceHashes).includes('tools/rc6/contracts/DirectFactRowV1.schema.json'));

// ---- block E: cross-contract ----
ok('cross F4 sourceHashes all match disk', Object.entries(F4.sourceHashes).every(([p, h]) => sha256(fs.readFileSync(path.join(repoRoot, p))) === h), String(Object.keys(F4.sourceHashes).length));
ok('cross F4 sourceHashes 17 + DirectFact pair', Object.keys(F4.sourceHashes).length === 17 && Object.keys(F4.sourceHashes).includes('tools/rc6/contracts/DirectFactRowV1.json') && Object.keys(F4.sourceHashes).includes('tools/rc6/contracts/DirectFactRowV1.schema.json'));
const govNames = { ExecutionContractV31: 'tools/rc6/contracts/ExecutionContractV31.json', BehaviorProviderV1: 'tools/rc6/contracts/BehaviorProviderV1.json', PrototypeDirectAdapterV1: 'tools/rc6/contracts/PrototypeDirectAdapterV1.json', SelectionPolicyV1: 'tools/rc6/contracts/SelectionPolicyV1.json', DirectFactRowV1: 'tools/rc6/contracts/DirectFactRowV1.json' };
ok('cross governedBy exist+hashed', F4.authority.governedBy.every(g => govNames[g] && fs.existsSync(path.join(repoRoot, govNames[g])) && F4.sourceHashes[govNames[g]]));
ok('cross status FROZEN', BP1.status === 'FROZEN' && F4.status === 'FROZEN' && F6.status === 'FROZEN' && F7.status === 'FROZEN', JSON.stringify({ F1: BP1.status, F4: F4.status, F6: F6.status, F7: F7.status }));
ok('cross providerState R9_CANDIDATE', F4.authority.providerState === 'R9_CANDIDATE' && BP1.stateBoundary.R9_CANDIDATE.selection === 'MECHANICAL_NEUTRAL_ONLY' && BP1.stateBoundary.R9_CANDIDATE.registration === false);
ok('cross no-route F1', ['route', 'future', 'resultWorld', 'kernelRouteValue'].every(k => FORBIDDEN_MAP[k] === 'ROUTE_INPUT_REJECTED'));
ok('cross no-route F4', F4hard.noFutureRouteDerivation.forbidden.length === 7 && F4hard.noFutureRouteDerivation.forbidden.every(x => typeof x === 'string' && x.length > 0));
ok('cross no-route F7', JSON.stringify(F7.constraints).includes('future-route') && JSON.stringify(F7.validation).includes('deferredPathIdsMatchUniverse'));
ok('cross teacher locality', FORBIDDEN_MAP.teacherOutput === 'TEACHER_INPUT_REJECTED' && F4.teacherLocality.gateTimeOnly === true && F4.teacherLocality.productionTeacherVector === 'FORBIDDEN' && F4.teacherLocality.productionTeacherImport === 'FORBIDDEN' && F4.teacherLocality.productionTeacherCall === 'FORBIDDEN');
ok('cross no 5-round 7v7 gate', F4.performance.fiveRoundSevenVsSevenFormalGate === 'FORBIDDEN' && F4.authority.supersedes.includes('M2_FIVE_ROUND_SEVEN_VS_SEVEN_FORMAL_GATE') && F4.performance.boundedScout.multiRoundTraversal === 'FORBIDDEN');
ok('cross selection identity', JSON.stringify(BP1.candidateIdentity.fields) === JSON.stringify(F4.metrics.heldOutTop1StructuralEquivalence.identity));
ok('cross pareto dimensions 6/6', (() => {
  const pol = readJson('contracts/SelectionPolicyV1.json');
  const dims = Object.fromEntries(pol.paretoDimensions.map(d => [d.code, d.direction]));
  return BP1.components.every(c => dims[c.policyDimension] === c.direction);
})());
ok('cross F3 forbidden matrix vs F1', (() => {
  const c14 = CASES.cases.find(c => c.caseId === 'BPV1-C14-FORBIDDEN-MATRIX');
  return c14.input.runs.every(r => FORBIDDEN_MAP[r.forbiddenKey] === r.expectedCode) && c14.expect.runs.every(r => FORBIDDEN_MAP[c14.input.runs.find(x => x.label === r.label).forbiddenKey] === r.fatal);
})());

console.log('assertionCount=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
for (const f of failures) console.log('FAIL: ' + f);
process.exit(failed ? 1 : 0);

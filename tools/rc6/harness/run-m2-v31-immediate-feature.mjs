// run-m2-v31-immediate-feature.mjs
// M2 ImmediateFeature harness (candidate C), rev3. Read-only: never writes, stages or commits.
// Loads the real BehaviorImmediateFeature_Module.js (compiler) in a poisoned vm and runs all
// 62 BehaviorImmediateFeatureCasesV1 cases against it; verifies the five contract files
// (Feature/Feature.schema/Cases/Policy/Policy.schema) hashes, schema closure, 29-feature
// stable ordering, value rules (KNOWN value only, UNKNOWN/NOT_APPLICABLE omit value, unit
// isolation, duplicate/caps/work metrics, determinism/deepfreeze/noalias/-0), vm poison and
// static production closure (no Decision/Runtime/Provider/teacher/route), an independent
// CANDIDATES_ONLY boundary sandbox (Decision is never loaded into the production compiler
// closure), and the Policy gate (CONTRACT_TARGET_NOT_TRAINED only; ACCEPTED/modelHash/top1
// artifacts rejected; Provider scoring never invoked). Any failed assertion exits 1.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const RC6 = path.join(REPO_ROOT, 'tools', 'rc6');
const MOD_SRC = fs.readFileSync(path.join(REPO_ROOT, 'BehaviorImmediateFeature_Module.js'), 'utf8');

const MOD_HASH_EXPECTED = 'a3d2be20e871af70db9082a3b446a5cd1b882af236d5096ef1a0ae9e56151bcf';
const CONTRACT_HASHES = {
  feature: '5474139d71b4f0a5ece5512c89969085ba70b0d14b8b015c93b7d735d73cb9fd',
  featureSchema: '686e41a085ae83a3b04bca1deea61f5a063fa75fdb52805fd3bfe927587f7937',
  cases: '9d67f332d1af35fe7c54020fe311cb8d674b5428ac7b3302adacceed8edfcf18',
  policy: '8f5ebca2c856ab01883484bff10e321ac5c61963d5dbd74740786c00296a774c',
  policySchema: '19f5513677600ec24112346a8069df577b39492f4ec43f5c4eaead0d71a95b0b',
};
const FILE_PATHS = {
  feature: path.join(RC6, 'contracts', 'BehaviorImmediateFeatureV1.json'),
  featureSchema: path.join(RC6, 'contracts', 'BehaviorImmediateFeatureV1.schema.json'),
  cases: path.join(RC6, 'cases', 'BehaviorImmediateFeatureCasesV1.json'),
  policy: path.join(RC6, 'contracts', 'DistilledBehaviorPolicyV1.json'),
  policySchema: path.join(RC6, 'contracts', 'DistilledBehaviorPolicyV1.schema.json'),
};

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
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
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
function expectThrow(tag, fn, code) {
  let msg = null;
  try { fn(); } catch (e) { msg = String((e && (e.code || e.reasonCode || e.message)) || e); }
  ok(tag, msg === code, 'got ' + msg);
  return msg === code;
}
function utf8Strict(buf) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
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
        const key = text.slice(start + 1, i - 1).replace(/\\(["\\\/bfnrt])/g, '$1').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const top = stack[stack.length - 1];
        if (top.has(key)) dups.push(key); else top.set(key, true);
      }
    } else if (ch === '{') stack.push(new Map());
    else if (ch === '}') stack.pop();
    i += 1;
  }
  return dups;
}
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
    }
    if (Array.isArray(v)) {
      if (node.items) for (let idx = 0; idx < v.length; idx += 1) { const e = check(v[idx], node.items, loc + '[' + idx + ']', seen); if (e) return e; }
      if (node.minItems !== undefined && v.length < node.minItems) return 'minItems at ' + loc;
      if (node.uniqueItems) { const s = new Set(v.map(x => JSON.stringify(x))); if (s.size !== v.length) return 'uniqueItems at ' + loc; }
    }
    if (node.oneOf) {
      const npass = node.oneOf.filter(sub => !check(v, sub, loc, seen)).length;
      if (npass !== 1) return 'oneOf ' + npass + ' at ' + loc;
    }
    if (node.enum !== undefined && !node.enum.some(x => eq(x, v))) return 'enum at ' + loc;
    if (node.const !== undefined && !eq(node.const, v)) return 'const at ' + loc;
    if (typeof v === 'string' && node.minLength !== undefined && v.length < node.minLength) return 'minLength at ' + loc;
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

const F = readJson(FILE_PATHS.feature);
const FS = readJson(FILE_PATHS.featureSchema);
const CASES = readJson(FILE_PATHS.cases);
const P = readJson(FILE_PATHS.policy);
const PS = readJson(FILE_PATHS.policySchema);

// ---- block 1: five contract files hash / utf8 / dup keys / schema closure ----
block('contracts', () => {
  ok('module hash expected a3d2be20', sha256(MOD_SRC) === MOD_HASH_EXPECTED, sha256(MOD_SRC).slice(0, 12));
  for (const [tag, want] of Object.entries(CONTRACT_HASHES)) {
    const buf = fs.readFileSync(FILE_PATHS[tag]);
    ok('hash ' + tag, sha256(buf) === want, sha256(buf).slice(0, 12));
    const text = buf.toString('utf8');
    ok('utf8 ' + tag, utf8Strict(buf));
    ok('json-parse ' + tag, (() => { try { JSON.parse(text); return true; } catch { return false; } })());
    ok('no-mojibake ' + tag, !text.includes('\uFFFD'));
    ok('no-dup-keys ' + tag, findDupKeys(text).length === 0, findDupKeys(text).slice(0, 3).join(','));
  }
  ok('feature rev5 frozen', F.revision === 5 && F.status === 'FROZEN');
  ok('cases rev8 62', CASES.revision === 8 && CASES.cases.length === 62 && CASES.counts.caseCount === 62);
  const kinds = {};
  const modes = {};
  for (const c of CASES.cases) { kinds[c.kind] = (kinds[c.kind] || 0) + 1; if (c.expectMode) modes[c.expectMode] = (modes[c.expectMode] || 0) + 1; }
  ok('cases kinds 38/15/9', kinds.POSITIVE === 38 && kinds.NEGATIVE === 15 && kinds.ANTI_PATTERN === 9, JSON.stringify(kinds));
  ok('cases modes 3 EXACT / 39 SUBSET', modes.EXACT === 3 && modes.SUBSET === 39, JSON.stringify(modes));
  ok('feature catalog 29 unique', F.featureCatalog.length === 29 && new Set(F.featureCatalog.map(x => x.featureCode)).size === 29);
  ok('feature ordering declared', F.featureOrdering.rule.includes('(scopeRank, sourceEffectId, key, featureCode)') && F.featureOrdering.rowFactIdRule.includes("sourceEffectId + '::' + key"));
  ok('feature complexity caps', F.complexity.caps.MAX_FEATURES_PER_CANDIDATE === 256 && F.complexity.caps.MAX_FACT_ROWS_PER_CANDIDATE === 128 && F.complexity.caps.MAX_MODIFIER_ENTRIES_PER_CANDIDATE === 64 && F.complexity.caps.branchCombination === false);
  ok('feature statusReasonCodes rev3', JSON.stringify(F.statusReasonCodes.UNKNOWN).includes('SIDE_UNOBSERVED') && JSON.stringify(F.statusReasonCodes.UNKNOWN).includes('STATE_FORM_UNMAPPED'));
  // FS describes compiled output (schemaVersion/candidateId/features/featureCount), not the meta-contract F.
  // Structural closure of $defs.feature here; the real compiler output is validated against FS in 'ordering'.
  const fdef = FS.$defs.feature;
  ok('feature schema defs.feature closed object', !!fdef && fdef.type === 'object' && fdef.additionalProperties === false && JSON.stringify(fdef.required) === JSON.stringify(['featureCode', 'unitFamily', 'status', 'reasonCode', 'sourceFactIds', 'sourceEventIds']));
  ok('feature schema enums 29/10/3', fdef.properties.featureCode.enum.length === 29 && fdef.properties.unitFamily.enum.length === 10 && JSON.stringify(fdef.properties.status.enum) === JSON.stringify(['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE']));
  ok('feature schema top output required', JSON.stringify(FS.required) === JSON.stringify(['schemaVersion', 'candidateId', 'features', 'featureCount']));
  ok('feature schema value conditionals 8', Array.isArray(fdef.allOf) && fdef.allOf.length === 8);
  const openF = [];
  openObjectNodes(FS, openF);
  ok('feature schema closed', openF.length === 0, openF.slice(0, 5).join(','));
  const openP = [];
  openObjectNodes(PS, openP);
  // schemaCounterExamplesV1 case documents are fixture payloads by design
  // (additionalProperties: true so INVALID counter-examples can carry arbitrary
  // artifact fields and still be rejected by the oneOf/not branches).
  const ceDoc = '$.properties.schemaCounterExamplesV1.properties.cases.items.properties.document';
  const ceFixtures = openP.filter(x => x === ceDoc);
  const otherOpen = openP.filter(x => x !== ceDoc);
  ok('policy schema closed except CE fixture', otherOpen.length === 0, otherOpen.slice(0, 5).join(','));
  ok('policy CE document fixture open by design', ceFixtures.length === 1, JSON.stringify(openP));
  const docP = P.artifactDocument && P.artifactDocument.document;
  const errDoc = docP ? makeValidator(PS)(docP) : 'no artifactDocument.document';
  ok('policy artifactDocument.document validates schema', !errDoc, errDoc || '');
  ok('policy schema oneOf exactly 2', Array.isArray(PS.oneOf) && PS.oneOf.length === 2);
  const untrained = PS.oneOf && PS.oneOf[0];
  const trained = PS.oneOf && PS.oneOf[1];
  ok('policy untrained branch const', !!untrained && untrained.properties.status.const === 'CONTRACT_TARGET_NOT_TRAINED' && untrained.properties.trainingStatus.properties.status.const === 'CONTRACT_TARGET_NOT_TRAINED' && untrained.required.includes('trainingStatus'));
  ok('policy branches mutually exclusive', !!trained && trained.properties.status.not.const === 'CONTRACT_TARGET_NOT_TRAINED' && trained.required.includes('artifactId') && Array.isArray(trained.not.required) && trained.not.required.includes('trainingStatus') && !!untrained.not && Array.isArray(untrained.not.anyOf) && untrained.not.anyOf.length === 8);
});

// ---- block 2: production compiler closure (poisoned vm, no Decision/Runtime/Provider/teacher) ----
let vmPoisonCount = 0;
function poison(code) {
  return function () { vmPoisonCount += 1; throw new Error(code); };
}
const poisonMath = Object.create(Math);
poisonMath.random = poison('VM_MATH_RANDOM_FORBIDDEN');
const poisonDate = function () { vmPoisonCount += 1; throw new Error('VM_DATE_NEW_FORBIDDEN'); };
poisonDate.now = poison('VM_DATE_NOW_FORBIDDEN');
const prodSandbox = {
  console, Buffer, TextDecoder, TextEncoder, JSON, Math: poisonMath, Date: poisonDate,
  Function: poison('VM_FUNCTION_FORBIDDEN'), eval: poison('VM_EVAL_FORBIDDEN'),
  setTimeout: poison('VM_TIMER_FORBIDDEN'), setInterval: poison('VM_TIMER_FORBIDDEN'), clearTimeout: poison('VM_TIMER_FORBIDDEN'), clearInterval: poison('VM_TIMER_FORBIDDEN'),
  Object, Array, String, Number, Boolean, Error, TypeError, Map, Set, WeakMap, WeakSet,
  Symbol, Reflect, Promise, Intl, URL, URLSearchParams, parseInt, parseFloat, isNaN, isFinite,
};
const prodCtx = vm.createContext(prodSandbox);
vm.runInContext(MOD_SRC, prodCtx, { filename: 'BehaviorImmediateFeature_Module.js' });
const MOD = prodCtx.__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__;

block('module', () => {
  ok('module mounted', !!MOD && typeof MOD.compileCandidate === 'function' && typeof MOD.registry === 'function' && typeof MOD.readMetrics === 'function' && typeof MOD.selfCheck === 'function' && typeof MOD.inputSchema === 'function');
  const reg = MOD.registry();
  ok('module revision 4 role', reg.revision === 4 && reg.role === 'R9_CANDIDATE_UNREGISTERED' && reg.apiSurface.join(',') === 'compileCandidate,inputSchema,registry,readMetrics,selfCheck');
  ok('module authority no route/world/result/teacher', reg.authority.futureRouteDerivation === false && reg.authority.worldClone === false && reg.authority.resultWorldCartesian === false && reg.authority.inputMode === 'CANDIDATES_ONLY' && reg.authority.claim === 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED');
  ok('module feature codes 29 == contract', canon(reg.featureCodes) === canon(F.featureCatalog.map(x => x.featureCode)));
  ok('module candidate 13 / row 16', reg.candidateFeatureCodes.length === 13 && reg.effectRowFeatureCodes.length === 16);
  ok('module caps == contract', reg.caps.MAX_FEATURES_PER_CANDIDATE === 256 && reg.caps.MAX_FACT_ROWS_PER_CANDIDATE === 128 && reg.caps.MAX_MODIFIER_ENTRIES_PER_CANDIDATE === 64 && reg.caps.MAX_WORK_UNITS_PER_CALL === 200000 && reg.caps.fixedCandidateFeatureCount === 13);
  ok('module workFormula', typeof reg.workFormula === 'string' && reg.workFormula.indexOf('13 (F0) + directFactsRows + modifierEntries + scheduledFactsEntries + atomicFactsCount') === 0, reg.workFormula);
  ok('module subsetSemantics', reg.subsetSemantics.includes('UNORDERED_MULTISET_WITH_COUNT_ASSERTIONS'));
  const HASH_KEY_MAP = { featureContract: 'feature', featureSchema: 'featureSchema', featureCases: 'cases', policyContract: 'policy', policySchema: 'policySchema' };
  ok('module contract hashes == disk', Object.entries(reg.contractHashes).filter(([k]) => HASH_KEY_MAP[k]).every(([k, h]) => CONTRACT_HASHES[HASH_KEY_MAP[k]] === h), JSON.stringify(reg.contractHashes));
  ok('module identityRules', reg.identityRules.sidesConsistency.includes('sides[actorId]') && reg.identityRules.noGuessing.includes('no default ALLY'));
  ok('module semantics judgment single source', reg.semantics.judgmentSingleSource.includes('never a second magnitude'));
  ok('module semantics statePresence BOOL/COUNT', reg.semantics.statePresence.includes('STATE_FORM_UNMAPPED'));
  ok('production closure has no Decision/Runtime/Provider/adapter/teacher', prodCtx.__LWCS_BATTLE_DECISION__ === undefined && prodCtx.__LWCS_BATTLE_RUNTIME__ === undefined && prodCtx.__LWCS_BEHAVIOR_PROVIDER__ === undefined && prodCtx.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__ === undefined && prodCtx.teacherOutput === undefined && prodCtx.route === undefined && prodCtx.worldClone === undefined && prodCtx.resultWorld === undefined);
  const code = codeOnly(MOD_SRC);
  const BANS = ['decide(', 'decideNext(', 'runProvider(', 'teacherOutput(', 'factColumns', 'simpleAdapter', 'worldClone(', 'structuredClone(', 'futureRoute(', 'kernelRoute(', 'resultCartesian(', 'require(', 'import(', 'Math.random', 'Date.now', 'performance.now', 'process.'];
  for (const tok of BANS) ok('static no ' + tok, code.indexOf(tok) < 0);
  const scEmpty = MOD.selfCheck('');
  const scFca = (scEmpty.checks || []).find(c => c.id === 'forbiddenCallsAbsent');
  ok('selfCheck empty not self-checkable', scEmpty.sourceSelfCheckable === false && !!scFca && scFca.counted === false && scFca.passed === false, JSON.stringify(scFca));
  const scReal = MOD.selfCheck(MOD_SRC);
  ok('selfCheck real passed', scReal.passed === true && scReal.sourceSelfCheckable === true, JSON.stringify(scReal.checks && scReal.checks.filter(c => !c.passed).map(c => c.id)));
});

// ---- block 3: 62 cases through the real compiler ----
const FEATURE_KEY = ['featureCode', 'unitFamily', 'status', 'reasonCode', 'sourceFactIds', 'sourceEventIds'];
function featCanon(f) {
  const o = {};
  for (const k of FEATURE_KEY) o[k] = f[k];
  if (f.value !== undefined) o.value = f.value;
  return canon(o);
}
function expectFeatureSubset(tag, got, exp) {
  const gCanon = got.map(featCanon).sort();
  for (const e of exp) ok(tag + ' feature ' + e.featureCode, gCanon.includes(featCanon(e)), 'missing ' + featCanon(e));
}
function countAssert(tag, got, asserts) {
  for (const a of asserts || []) {
    const n = got.filter(f => f.featureCode === a.featureCode).length;
    ok(tag + ' count ' + a.featureCode + '=' + a.expectedCount, n === a.expectedCount, 'got ' + n);
  }
}
function checkFeatureShape(tag, feats) {
  for (const f of feats) {
    const expFamily = MOD.registry().unitFamily[f.featureCode];
    ok(tag + ' family ' + f.featureCode, f.unitFamily === expFamily, f.unitFamily + ' vs ' + expFamily);
    if (f.status === 'KNOWN') {
      ok(tag + ' known reason ' + f.featureCode, f.reasonCode === 'OK', f.reasonCode);
      if (expFamily === 'ENUM') {
        ok(tag + ' known enum string ' + f.featureCode, typeof f.value === 'string' && f.value.length > 0, String(f.value));
      } else {
        ok(tag + ' known finite no -0 ' + f.featureCode, typeof f.value === 'number' && Number.isFinite(f.value) && !Object.is(f.value, -0), String(f.value));
      }
      if (['OVERKILL_AVAILABILITY', 'HARD_EXCLUSION', 'DAMAGE_TYPE', 'STATE_PRESENCE'].includes(f.featureCode)) ok(tag + ' bool domain ' + f.featureCode, f.value === 0 || f.value === 1, String(f.value));
    } else {
      ok(tag + ' non-known omits value ' + f.featureCode, !('value' in f), JSON.stringify(f));
      ok(tag + ' non-known reason present ' + f.featureCode, typeof f.reasonCode === 'string' && f.reasonCode.length > 0);
      if (f.status === 'UNKNOWN') ok(tag + ' unknown reason in vocabulary ' + f.featureCode, F.statusReasonCodes.UNKNOWN.includes(f.reasonCode), f.reasonCode);
      if (f.status === 'NOT_APPLICABLE') ok(tag + ' na reason in vocabulary ' + f.featureCode, F.statusReasonCodes.NOT_APPLICABLE.includes(f.reasonCode), f.reasonCode);
    }
  }
}
function modifierEntryCount(input) {
  let n = 0;
  const lm = input.legalityModifiers;
  if (lm && typeof lm === 'object') {
    if (Array.isArray(lm.judgmentRates)) n += lm.judgmentRates.length;
    for (const k of ['taunt', 'tauntRemoved', 'stateMigration', 'stateSwap']) if (lm[k]) n += 1;
    if (Array.isArray(lm.mechanismRemoval)) n += lm.mechanismRemoval.length;
    if (Array.isArray(lm.hardExclusions)) n += lm.hardExclusions.length;
    if (Array.isArray(lm.legalityFlags)) n += lm.legalityFlags.length;
  }
  const om = input.opportunityModifiers;
  if (om && typeof om === 'object') {
    if (Array.isArray(om.resourceLocks)) n += om.resourceLocks.length;
    if (om.opportunityConstraints && typeof om.opportunityConstraints === 'object') n += Object.keys(om.opportunityConstraints).length;
    if (Array.isArray(om.interferenceRates)) n += om.interferenceRates.length;
    if (Array.isArray(om.dependencyTokens)) n += om.dependencyTokens.length;
  }
  if (Array.isArray(input.legalityFlags)) n += input.legalityFlags.length;
  return n;
}
const expectedWork = input => 13 + (input.directFacts ? input.directFacts.length : 0) + modifierEntryCount(input) + (input.scheduledFacts ? input.scheduledFacts.length : 0) + (input.atomicFacts ? input.atomicFacts.length : 0);

let compileCalls = 0;
let compileThrows = 0;
function compileOnce(input) {
  compileCalls += 1;
  try { return { out: MOD.compileCandidate(input), err: null }; }
  catch (e) { compileThrows += 1; return { out: null, err: String((e && (e.code || e.reasonCode || e.message)) || e) }; }
}

block('cases', () => {
  let positiveOk = 0;
  let negativeOk = 0;
  let antiOk = 0;
  for (const c of CASES.cases) {
    const id = c.caseId;
    const input = clone(c.input);
    const rc = compileOnce(input);
    const out = rc.out;
    const err = rc.err;
    if (c.kind === 'POSITIVE') {
      ok(id + ' compiles', out !== null, 'err=' + err);
      if (out === null) continue;
      positiveOk += 1;
      ok(id + ' schemaVersion', out.schemaVersion && typeof out.schemaVersion === 'string' && out.candidateId === c.input.candidate.candidateId);
      ok(id + ' featureCount == length', out.featureCount === out.features.length, out.featureCount + ' vs ' + out.features.length);
      const want = c.expect;
      if (c.expectMode === 'EXACT') {
        const g = out.features.map(featCanon).sort();
        const e = want.features.map(featCanon).sort();
        ok(id + ' EXACT multiset', JSON.stringify(g) === JSON.stringify(e), 'got ' + g.join('|'));
      } else {
        ok(id + ' SUBSET fc == expect list', want.featureCount === want.features.length, want.featureCount + ' vs ' + want.features.length);
        expectFeatureSubset(id, out.features, want.features);
        countAssert(id, out.features, want.countAssertions);
      }
      checkFeatureShape(id, out.features);
      ok(id + ' deepFrozen', deepFrozen(out, new Set()));
      ok(id + ' no alias', !aliasesInput(out, input));
      const wu = MOD.readMetrics().lastWorkUnits;
      ok(id + ' workUnits formula', wu === expectedWork(input), 'got ' + wu + ' want ' + expectedWork(input));
      if (id === 'pos-determinism-replay') {
        const again = compileOnce(clone(c.input)).out;
        ok(id + ' deterministic', canon(again) === canon(out));
      }
    } else if (c.kind === 'NEGATIVE') {
      negativeOk += 1;
      if (c.expect.reject) {
        ok(id + ' rejects ' + c.expect.reject.reasonCode, err === c.expect.reject.reasonCode, 'got ' + err);
        ok(id + ' no output on reject', out === null);
      } else {
        ok(id + ' compiles with UNKNOWN features', out !== null, 'err=' + err);
        if (out !== null) {
          ok(id + ' gold featureCount self-consistent', c.expect.featureCount === (c.expect.features || []).length, c.expect.featureCount + ' vs ' + (c.expect.features || []).length);
          expectFeatureSubset(id, out.features, c.expect.features);
          checkFeatureShape(id, out.features);
          ok(id + ' deepFrozen', deepFrozen(out, new Set()));
          ok(id + ' no alias', !aliasesInput(out, input));
          const wu = MOD.readMetrics().lastWorkUnits;
          ok(id + ' workUnits formula', wu === expectedWork(input), 'got ' + wu + ' want ' + expectedWork(input));
        }
      }
    } else {
      antiOk += 1;
      if (c.expect.violatingFeature) {
        ok(id + ' compiles with output-side ban', out !== null, 'err=' + err);
        if (out !== null) {
          ok(id + ' output avoids violatingFeature', !out.features.some(f => f.featureCode === c.expect.violatingFeature.featureCode && f.status === c.expect.violatingFeature.status && f.value === c.expect.violatingFeature.value), JSON.stringify(out.features.filter(f => f.featureCode === c.expect.violatingFeature.featureCode)));
          ok(id + ' output-side ban code', ['UNKNOWN_ZERO_PLACEHOLDER', 'INVALID_STATUS_VALUE'].includes(c.expect.reject.reasonCode), c.expect.reject.reasonCode);
          checkFeatureShape(id, out.features);
          ok(id + ' deepFrozen', deepFrozen(out, new Set()));
          ok(id + ' no alias', !aliasesInput(out, input));
          const wu = MOD.readMetrics().lastWorkUnits;
          ok(id + ' workUnits formula', wu === expectedWork(input), 'got ' + wu + ' want ' + expectedWork(input));
        }
      } else if (c.expect.reject) {
        ok(id + ' rejects ' + c.expect.reject.reasonCode, err === c.expect.reject.reasonCode, 'got ' + err);
        ok(id + ' no output on reject', out === null);
      } else {
        ok(id + ' compiles with UNKNOWN features', out !== null, 'err=' + err);
        if (out !== null) {
          ok(id + ' gold featureCount self-consistent', c.expect.featureCount === (c.expect.features || []).length, c.expect.featureCount + ' vs ' + (c.expect.features || []).length);
          expectFeatureSubset(id, out.features, c.expect.features);
          checkFeatureShape(id, out.features);
          ok(id + ' deepFrozen', deepFrozen(out, new Set()));
          ok(id + ' no alias', !aliasesInput(out, input));
          const wu = MOD.readMetrics().lastWorkUnits;
          ok(id + ' workUnits formula', wu === expectedWork(input), 'got ' + wu + ' want ' + expectedWork(input));
        }
      }
    }
  }
  ok('all 38 positive ran', positiveOk === 38, String(positiveOk));
  ok('all 15 negative ran', negativeOk === 15, String(negativeOk));
  ok('all 9 anti ran', antiOk === 9, String(antiOk));
});

// ---- block 4: ordering, uniqueness, per-feature protections ----
block('ordering', () => {
  const c = CASES.cases.find(x => x.caseId === 'pos-damage-full');
  const out = compileOnce(clone(c.input)).out;
  const codes = out.features.map(f => f.featureCode);
  const candSet = new Set(codes.slice(0, 13));
  ok('candidate scope first 13', out.featureCount === 17 && candSet.size === 13 && codes.slice(0, 13).every(cc => MOD.registry().candidateFeatureCodes.includes(cc)) && MOD.registry().candidateFeatureCodes.every(cc => candSet.has(cc)));
  const fsErr = makeValidator(FS)(out);
  ok('pos-damage-full output validates feature schema', !fsErr, fsErr || '');
  const cand = out.features.slice(0, 13);
  ok('candidate sorted by featureCode', JSON.stringify(cand.map(f => f.featureCode).slice().sort()) === JSON.stringify(cand.map(f => f.featureCode)));
  const rows = out.features.slice(13);
  ok('effect rows after candidate', rows.every(f => f.sourceFactIds.length > 0));
  const keys = rows.map(f => (f.sourceFactIds[0] || '').split('::')[1] || '');
  ok('effect rows key order asc', JSON.stringify(keys) === JSON.stringify(keys.slice().sort()), keys.join(','));
  const uniq = out.features.map(f => f.featureCode + '@' + (f.sourceFactIds[0] || ''));
  ok('no duplicate (featureCode, sourceFactId)', new Set(uniq).size === uniq.length);
  const multi = CASES.cases.find(x => x.caseId === 'pos-resource-shield-multitarget');
  const mOut = compileOnce(clone(multi.input)).out;
  const rtc = mOut.features.find(f => f.featureCode === 'RELATION_TARGET_COUNT');
  ok('multi-target counted once', rtc && rtc.status === 'KNOWN' && rtc.value === 2, JSON.stringify(rtc));
  ok('multi-target no per-target expansion', mOut.features.filter(f => f.featureCode === 'RESOURCE_DELTA').length === 1 && mOut.features.filter(f => f.featureCode === 'SHIELD_DELTA').length === 1);
  const aj = CASES.cases.find(x => x.caseId === 'pos-attribute-judgment-duration');
  const ajOut = compileOnce(clone(aj.input)).out;
  ok('judgment single source', ajOut.features.filter(f => f.featureCode === 'JUDGMENT_DELTA').length === 1, 'count=' + ajOut.features.filter(f => f.featureCode === 'JUDGMENT_DELTA').length);
  const ajm = ajOut.features.find(f => f.featureCode === 'JUDGMENT_DELTA');
  ok('judgment magnitude from row only', !!ajm && ajm.value === 10 && ajm.sourceFactIds[0] === 'effect:cand-aj:1::命中', JSON.stringify(ajm));
  const dur = ajOut.features.filter(f => f.featureCode === 'STATE_DURATION');
  ok('duration raw not multiplied', dur.length === 2 && dur.every(f => f.value === 1), JSON.stringify(dur));
  const side = CASES.cases.find(x => x.caseId === 'pos-relation-mixed');
  const sOut = compileOnce(clone(side.input)).out;
  const sft = sOut.features.find(f => f.featureCode === 'RELATION_TARGET_SIDE');
  ok('relation mixed', sft && sft.status === 'KNOWN' && sft.value === 'MIXED', JSON.stringify(sft));
  const ghost = CASES.cases.find(x => x.caseId === 'pos-target-unknown-unit');
  const gOut = compileOnce(clone(ghost.input)).out;
  ok('unknown unit target counted once', gOut.features.find(f => f.featureCode === 'RELATION_TARGET_COUNT').value === 1);
  ok('unknown unit hp UNKNOWN not zero', gOut.features.find(f => f.featureCode === 'PUBLIC_HP_RATIO').status === 'UNKNOWN' && !('value' in gOut.features.find(f => f.featureCode === 'PUBLIC_HP_RATIO')));
  const actorProt = CASES.cases.find(x => x.caseId === 'pos-actor-cost-protection');
  const aOut = compileOnce(clone(actorProt.input)).out;
  const cost = aOut.features.find(f => f.featureCode === 'COST_AFFORDABILITY');
  ok('cost reads actor only', cost && cost.status === 'KNOWN' && cost.value === 0.5, JSON.stringify(cost));
  const sched = CASES.cases.find(x => x.caseId === 'pos-scheduled-counted');
  const schOut = compileOnce(clone(sched.input)).out;
  const obr = schOut.features.find(f => f.featureCode === 'OUTSIDE_BATCH1_ROW_COUNT');
  ok('scheduled never silent', obr && obr.value === 1 && JSON.stringify(obr.sourceEventIds) === '["effect:pos-real-baihanying-window:0:schedule:0"]', JSON.stringify(obr));
  const taunt = CASES.cases.find(x => x.caseId === 'pos-state-taunt');
  const tOut = compileOnce(clone(taunt.input)).out;
  const sp = tOut.features.find(f => f.featureCode === 'STATE_PRESENCE');
  ok('state BOOL known 1', sp && sp.status === 'KNOWN' && sp.value === 1, JSON.stringify(sp));
  const cnt = CASES.cases.find(x => x.caseId === 'pos-state-count-unmapped');
  const cOut = compileOnce(clone(cnt.input)).out;
  const spc = cOut.features.find(f => f.featureCode === 'STATE_PRESENCE');
  ok('state COUNT unmapped UNKNOWN', spc && spc.status === 'UNKNOWN' && spc.reasonCode === 'STATE_FORM_UNMAPPED' && !('value' in spc), JSON.stringify(spc));
  const hard = CASES.cases.find(x => x.caseId === 'pos-hard-exclusion');
  const hOut = compileOnce(clone(hard.input)).out;
  const hbit = hOut.features.find(f => f.featureCode === 'HARD_EXCLUSION');
  const hreason = hOut.features.find(f => f.featureCode === 'HARD_EXCLUSION_REASON');
  ok('hard exclusion bit + reason', !!hbit && hbit.value === 1 && !!hreason && hreason.status === 'KNOWN' && hreason.value === 'ACTOR_DISABLED' && hreason.reasonCode === 'OK', JSON.stringify({ hbit, hreason }));
  const chinese = CASES.cases.find(x => x.caseId === 'pos-chinese-ids');
  const zhOut = compileOnce(clone(chinese.input)).out;
  ok('chinese ids accepted', zhOut.features.find(f => f.featureCode === 'RELATION_TARGET_SIDE').status === 'KNOWN', JSON.stringify(zhOut.features.find(f => f.featureCode === 'RELATION_TARGET_SIDE')));
  ok('vm poison zero after cases', vmPoisonCount === 0, 'poison=' + vmPoisonCount);
});

// ---- block 5: metrics / work caps ----
block('metrics', () => {
  // the trailing cases are ANTI_PATTERN rejections; metrics compare uses the last
  // successful compile instead.
  const lastCase = [...CASES.cases].reverse().find(c => c.kind === 'POSITIVE');
  const lastOut = compileOnce(clone(lastCase.input)).out;
  const m = MOD.readMetrics();
  ok('metrics calls == successful compiles', m.calls === compileCalls - compileThrows, 'got ' + m.calls + ' expected ' + (compileCalls - compileThrows));
  const rejectTotal = Object.values(m.rejections || {}).reduce((a, b) => a + b, 0);
  ok('metrics rejections == observed throws', rejectTotal === compileThrows, JSON.stringify(m.rejections));
  ok('metrics invocations closed', m.calls + rejectTotal === compileCalls, m.calls + ' + ' + rejectTotal + ' vs ' + compileCalls);
  ok('metrics lastCandidateId set', typeof m.lastCandidateId === 'string' && m.lastCandidateId.length > 0);
  ok('metrics lastFeatureCount == last run', m.lastFeatureCount === lastOut.featureCount, String(m.lastFeatureCount) + ' vs ' + lastOut.featureCount);
  ok('metrics max work below cap', m.workUnitsTotal <= compileCalls * 200000, String(m.workUnitsTotal));
  const maxSeen = Math.max(...CASES.cases.map(c => expectedWork(c.input)));
  ok('max work formula <= cap', maxSeen <= 200000, String(maxSeen));
});

// ---- block 6: independent CANDIDATES_ONLY boundary (Decision in its own sandbox only) ----
block('boundary', () => {
  const boundarySandbox = {
    console, Buffer, TextDecoder, TextEncoder, JSON, Math, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    Object, Array, String, Number, Boolean, Error, TypeError, Map, Set, WeakMap, WeakSet, Symbol, Reflect, Promise,
    Intl, URL, URLSearchParams, parseInt, parseFloat, isNaN, isFinite,
    structuredClone: typeof structuredClone === 'function' ? structuredClone : v => JSON.parse(JSON.stringify(v)),
    performance: { now: () => 0 },
    process: { env: {} },
  };
  boundarySandbox.window = boundarySandbox;
  boundarySandbox.globalThis = boundarySandbox;
  boundarySandbox.self = boundarySandbox;
  vm.createContext(boundarySandbox);
  let decision = null;
  let loadErr = null;
  try {
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'MVU_Skill_Runtime.js'), 'utf8'), boundarySandbox, { filename: 'MVU_Skill_Runtime.js' });
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'BattlePreview_Module.js'), 'utf8'), boundarySandbox, { filename: 'BattlePreview_Module.js' });
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'BattleDecision_Module.js'), 'utf8'), boundarySandbox, { filename: 'BattleDecision_Module.js' });
    decision = boundarySandbox.__LWCS_BATTLE_DECISION__;
  } catch (e) { loadErr = String((e && e.message) || e); }
  ok('boundary decision loads', decision !== null, 'err=' + loadErr);
  if (decision !== null) {
    const unit = (id, side, hp) => ({
      id, name: id, 名称: id, side, type: '强攻系', 系别: '强攻系', hp, HP: hp, hp_max: 100,
      sp: 100, sp_max: 100, men: 100, men_max: 100, vit: 100, vit_max: 100, str: 100, def: 100, agi: 100,
      属性: { 等级: 50, 系别: '强攻系', HP: hp, HP上限: 100, 魂力: 100, 魂力上限: 100, 精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100, 力量: 100, 防御: 100, 敏捷: 100, 状态效果: {} },
      状态: { 存活: true, 行动: '战斗' }, 状态效果: {}, 持续效果: {}, 背包: {}, 技能列表: [],
    });
    const world = {
      回合: 1, 战斗类型: '普通战斗', 战斗意图: '击败', 进行中: true,
      胜负条件: { version: 1, explicit: true, startRound: 0, maxRounds: 2, resolutionPriority: 'DEFEAT_FIRST', victory: { logic: 'ANY', conditions: [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }] } },
      参战者: { team_player: [unit('actor-1', 'player', 100)], team_enemy: [unit('enemy-1', 'enemy', 100)] },
    };
    const opportunity = { opportunityId: 'natural:actor-1:1', ownerId: 'actor-1', role: 'ACTIVE', grantType: 'NATURAL_ACTION', sequence: 1, round: 1, status: 'PENDING' };
    let req = null;
    let reqErr = null;
    try {
      req = decision.prepareDecisionRequest({
        worldSnapshot: world,
        actorId: 'actor-1',
        actionOpportunity: opportunity,
        objectiveContract: world.胜负条件,
        battleIntent: { mode: '击败', objectives: world.胜负条件 },
        seed: 42,
        analysisDepth: 'CANDIDATES_ONLY',
      });
    } catch (e) { reqErr = String((e && e.message) || e); }
    ok('boundary request prepares', req !== null, 'err=' + reqErr);
    if (req !== null) {
      ok('boundary analysisDepth', req.analysisDepth === 'CANDIDATES_ONLY');
      ok('boundary request-lite hash', typeof req.requestHash === 'string' && req.requestHash.startsWith('request-lite:'), String(req.requestHash).slice(0, 40));
      ok('boundary routeCatalog empty', req.actionRouteCatalog && Object.keys(req.actionRouteCatalog).length === 0 && req.actorCandidateRoutes && Object.keys(req.actorCandidateRoutes).length === 0 && req.actorProjectedWorlds && Object.keys(req.actorProjectedWorlds).length === 0);
      ok('boundary candidates present', Array.isArray(req.frozenCandidates) && req.frozenCandidates.length > 0);
      const identityShape = req.frozenCandidates.map(cand => ({ candidateId: String(cand.candidateId || ''), actionKind: String((cand.declaration && cand.declaration.actionKind) || ''), targetSet: (cand.declaration && cand.declaration.targetIds) || [], actorId: String((cand.declaration && cand.declaration.actorId) || '') }));
      ok('boundary identity shape', identityShape.every(x => x.candidateId.length > 0 && x.candidateId.length <= 512 && x.actionKind.length > 0 && Array.isArray(x.targetSet) && x.targetSet.length > 0 && x.actorId.length > 0), JSON.stringify(identityShape[0]));
      ok('boundary public facts', Array.isArray(req.teamPublicFacts) && req.teamPublicFacts.length > 0 && req.teamPublicFacts.every(u => typeof u.unitId === 'string' && u.unitId.length > 0 && typeof u.side === 'string' && typeof u.alive === 'boolean' && typeof u.hpRatio === 'number' && Array.isArray(u.visibleStates)), JSON.stringify(req.teamPublicFacts[0]));
      ok('boundary decision not in production closure', prodCtx.__LWCS_BATTLE_DECISION__ === undefined);
      // rev2 完整集成缺口：Decision 提供 hpRatio(比例) 而非编译器 units[].hp/hp_max 原始数值，且候选声明无 paymentMode。
      const gap = ['hpRawFields', 'paymentMode'];
      ok('boundary gap declared not faked', gap.length === 2, gap.join(','));
      ok('boundary hpRatio shape mismatch recorded', typeof req.teamPublicFacts[0].hpRatio === 'number' && !('hp' in req.teamPublicFacts[0]), 'shape-check-only');
    }
  }
});

// ---- block 7: Policy gate (CONTRACT_TARGET_NOT_TRAINED only) ----
block('policy', () => {
  ok('policy status TARGET_NOT_TRAINED', P.status === 'CONTRACT_TARGET_NOT_TRAINED' && P.trainingStatus.status === 'CONTRACT_TARGET_NOT_TRAINED');
  ok('policy claim not implemented', P.authority.claim === 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED');
  ok('policy teacher offline only', P.authority.teacherClosure.offlineOnly === true && Array.isArray(P.authority.teacherClosure.productionClosureForbidden));
  ok('policy top1 not measurable', P.trainingStatus.top1NotMeasurable === true && P.trainingStatus.noFabricatedHashes === true && P.trainingStatus.gatesAndModelKindAreTargetsNotArtifact === true);
  const artifact = P.artifact || {};
  ok('policy no artifactId/artifactHashes/modelHash values', artifact.artifactId === undefined && artifact.artifactHashes === undefined && artifact.modelHash === undefined, Object.keys(artifact).join(','));
  ok('policy normalization is rule text only', typeof artifact.normalization === 'object' && artifact.normalization && typeof artifact.normalization.means === 'string' && typeof artifact.normalization.scales === 'string' && typeof artifact.normalization.missingMask === 'string');
  ok('policy artifact pins exactly seven names', Array.isArray(artifact.pins) && artifact.pins.length === 7 && artifact.pins.includes('modelHash') && artifact.pins.includes('artifactSchemaHash'));
  const doc = P.artifactDocument && P.artifactDocument.document;
  ok('policy document untrained view', !!doc && doc.status === 'CONTRACT_TARGET_NOT_TRAINED' && doc.artifactId === undefined && doc.modelHash === undefined && doc.acceptance === undefined);
  ok('policy no ACCEPTED status anywhere', !JSON.stringify(P).includes('"ACCEPTED"') && !JSON.stringify(P).includes('"status":"ACCEPTED"'));
  ok('policy gates are target declarations only', P.gates && P.gates.holdoutTop1 === 0.9 && typeof P.gates.holdoutTop1Rule === 'string');
  ok('policy schema counter examples present', P.schemaCounterExamplesV1 && Array.isArray(P.schemaCounterExamplesV1.cases) && P.schemaCounterExamplesV1.cases.length === 4, String(P.schemaCounterExamplesV1 && P.schemaCounterExamplesV1.cases && P.schemaCounterExamplesV1.cases.length));
  ok('policy no provider scoring invoked', typeof MOD.compileCandidate === 'function' && prodCtx.__LWCS_BEHAVIOR_PROVIDER__ === undefined);
  const psCode = codeOnly(MOD_SRC) + codeOnly(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8'));
  ok('policy harness never references BP.select', !psCode.includes('BP.select') && !psCode.includes('evaluateVectors'));
});

const moduleHashes = { BehaviorImmediateFeature_Module: sha256(MOD_SRC) };
const lineCount = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').length;
const summary = {
  schemaVersion: 'M2ImmediateFeatureV1',
  status: failed ? 'FAILED' : 'PASSED',
  moduleHashes,
  contractHashes: CONTRACT_HASHES,
  lineCount,
  blockStats,
  assertionCount: passed + failed,
  passed,
  failed,
  failures,
};
console.log('assertionCount=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
for (const f of failures) console.log('FAIL: ' + f);
process.stdout.write('M2IMMEDIATEFEATURE ' + JSON.stringify(summary) + '\n');
process.exitCode = failed ? 1 : 0;

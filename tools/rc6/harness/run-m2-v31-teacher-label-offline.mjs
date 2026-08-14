// run-m2-v31-teacher-label-offline.mjs
// Offline teacher label batch for the unified 80-unit corpus (OfflineTeacherLabelingV1).
// Each unit is enumerated exactly once: RVE2 for 54 oracle fixtures and 20 kernel cases,
// RVE3 for 6 raw cases. Derives the 15 contract fields, cross-checks expected selections
// (0 diff), validates the label artifact against OfflineTeacherLabelingV1.schema.json and
// writes tools/rc6/cases/OfflineTeacherLabelsV1.json only when every check passes.
// Exit 1 on any failure; no stage/commit; no R8/v1/production kernel/BattleDecision load.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRawCase as evaluateV2 } from '../reference/reference-value-evaluator-v2.mjs';
import { evaluateRawCase as evaluateV3 } from '../reference/reference-value-evaluator-v3.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rel = p => path.join(ROOT, p);
const readJson = p => JSON.parse(fs.readFileSync(rel(p), 'utf8'));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const fileHash = p => sha256(fs.readFileSync(rel(p)));

const F = {
  contract: 'tools/rc6/contracts/OfflineTeacherLabelingV1.json',
  schema: 'tools/rc6/contracts/OfflineTeacherLabelingV1.schema.json',
  split: 'tools/rc6/cases/BehaviorProviderQualitySplitV1.json',
  oracle: 'tools/rc6/cases/BehaviorOracleFixtureManifestV1.json',
  kernel: 'tools/rc6/cases/KernelReferenceCasesV1.json',
  v3raw: 'tools/rc6/cases/ReferenceValueEvaluatorV3RawCasesV1.json',
  v2: 'tools/rc6/reference/reference-value-evaluator-v2.mjs',
  v3: 'tools/rc6/reference/reference-value-evaluator-v3.mjs',
  policy: 'tools/rc6/contracts/DistilledBehaviorPolicyV1.json',
  artifact: 'tools/rc6/cases/OfflineTeacherLabelsV1.json',
};
const PIN = {
  contract: 'e3776ea58df5d33f956d3b7d20d0e0ad79543416c09acd9150bc91bdf069a899',
  schema: 'd8ddfddded15ca0a8b98fcf532f01b2ffc58068081358aa0f497d33342bf1bf6',
  split: '1ea7faee92a61008505cb6b4ccf6e03cf8a7d586b140230897513e0e662512a9',
  oracle: 'e1bd31f21dd1f8078730b56b402190854adefca1d46ae9b0ce62643fa3d58f1b',
  kernel: 'aac9591365c0cec540173f634f2d6dad1671f2a36ee1aea3966e6fdbbb602ca1',
  v3raw: '57580308fc7f89ecc390a50c70d997721102ca65e5d2f1dcaee8fb77cfb458dc',
  v2: 'b558bf25977463a41724ac4b83588672b0157ca9bf0267d59d4b4522a1cd80d9',
  v3: '3597fcf62eec2ea0059eea21b86ae573dff2afcd2de74e4233c4db0f6604a124',
  policy: '8f5ebca2c856ab01883484bff10e321ac5c61963d5dbd74740786c00296a774c',
};

let checks = 0;
let failures = 0;
function ok(name, cond, detail = '') {
  checks += 1;
  if (cond) console.log('PASS ' + name);
  else {
    failures += 1;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}
const utf16 = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUtf16 = arr => arr.slice().sort(utf16);
const infoPresent = candidates => (candidates || []).some(c => Array.isArray(c.informationGroups) && c.informationGroups.length > 0);

// canonical serialization: contract sortAndHashRules.canonicalSerializationV1
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

// lightweight schema validator: feature set of OfflineTeacherLabelingV1.schema.json
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
      if (node.properties) for (const [k, sub] of Object.entries(node.properties)) if (k in v) {
        const e = check(v[k], sub, loc + '.' + k, seen);
        if (e) return e;
      }
      if (node.patternProperties) for (const [pat, sub] of Object.entries(node.patternProperties)) {
        const re = new RegExp(pat);
        for (const k of Object.keys(v)) if (re.test(k)) {
          const e = check(v[k], sub, loc + '.' + k, seen);
          if (e) return e;
        }
      }
      if (node.additionalProperties === false) for (const k of Object.keys(v)) {
        const inProps = node.properties && k in node.properties;
        const inPat = node.patternProperties && Object.keys(node.patternProperties).some(p => new RegExp(p).test(k));
        if (!inProps && !inPat) return 'extra ' + k + ' at ' + loc;
      }
      if (node.minProperties !== undefined && Object.keys(v).length < node.minProperties) return 'minProperties at ' + loc;
      if (node.maxProperties !== undefined && Object.keys(v).length > node.maxProperties) return 'maxProperties at ' + loc;
      if (node.propertyNames && node.propertyNames.pattern) {
        const re = new RegExp(node.propertyNames.pattern);
        for (const k of Object.keys(v)) if (!re.test(k)) return 'propName ' + k + ' at ' + loc;
      }
    }
    if (Array.isArray(v)) {
      if (node.items) for (let idx = 0; idx < v.length; idx += 1) {
        const e = check(v[idx], node.items, loc + '[' + idx + ']', seen);
        if (e) return e;
      }
      if (node.minItems !== undefined && v.length < node.minItems) return 'minItems at ' + loc;
      if (node.maxItems !== undefined && v.length > node.maxItems) return 'maxItems at ' + loc;
      if (node.uniqueItems) {
        const s = new Set(v.map(x => JSON.stringify(x)));
        if (s.size !== v.length) return 'uniqueItems at ' + loc;
      }
      if (node.contains && !v.some(x => !check(x, node.contains, loc, seen))) return 'contains at ' + loc;
    }
    if (node.allOf) for (const sub of node.allOf) {
      const e = check(v, sub, loc, seen);
      if (e) return e;
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
    if (node.if && !check(v, node.if, loc, seen) && node.then) {
      const e = check(v, node.then, loc, seen);
      if (e) return e;
    }
    return null;
  }
  return v => check(v, root, '$', new Set());
}
// schema closure scan: any object node without additionalProperties:false and without a key pattern is open
function openObjectNodes(node, out, loc = '$') {
  if (Array.isArray(node)) return node.forEach((x, i) => openObjectNodes(x, out, loc + '[' + i + ']'));
  if (!node || typeof node !== 'object') return;
  if (node.type === 'object' && node.additionalProperties !== false && !node.propertyNames && !node.patternProperties) out.push(loc);
  for (const k of Object.keys(node)) {
    if (k === 'properties' || k === '$defs' || k === 'definitions' || k === 'patternProperties') {
      if (node[k] && typeof node[k] === 'object') for (const [kk, vv] of Object.entries(node[k])) openObjectNodes(vv, out, loc + '.' + k + '.' + kk);
    } else if (k === 'items' || k === 'oneOf' || k === 'propertyNames' || k === 'if' || k === 'then' || k === 'contains') {
      openObjectNodes(node[k], out, loc + '.' + k);
    } else if (k === 'allOf') {
      node[k].forEach((x, i) => openObjectNodes(x, out, loc + '.allOf[' + i + ']'));
    }
  }
}

// static closure scan: no v1/R8/production kernel/BattleDecision/teacher loads
const ownSource = fs.readFileSync(new URL(import.meta.url), 'utf8');
const importSpecs = [...ownSource.matchAll(/^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]);
const forbiddenBase = /(^|[._/-])(r8|kernel|provider|adapter|battle|runtime|decision|shadow)([._/-]|$)/i;
const exactForbidden = new Set(['reference-value-evaluator.mjs', 'reference-value-evaluator-v1.mjs']);
ok('no dynamic module loading in harness', !/import\s*\(|require\s*\(|createReq[u]ire|vm\s*\./m.test(ownSource));
for (const spec of importSpecs) {
  const baseName = spec.split('/').pop();
  ok('import allowed: ' + baseName, !exactForbidden.has(baseName) && !forbiddenBase.test(baseName), spec);
}
for (const p of [F.v2, F.v3]) {
  const src = fs.readFileSync(rel(p), 'utf8');
  ok(p.split('/').pop() + ' self-contained', !/^\s*import\b|^\s*require\s*\(/m.test(src));
}

// pins, contract and policy posture
const contract = readJson(F.contract);
const schema = readJson(F.schema);
const split = readJson(F.split);
const oracle = readJson(F.oracle);
const kernel = readJson(F.kernel);
const v3raw = readJson(F.v3raw);
const policy = readJson(F.policy);
for (const k of Object.keys(PIN)) ok('hash ' + k, fileHash(F[k]) === PIN[k], 'want=' + PIN[k].slice(0, 16));
ok('contract revision 1 frozen', contract.revision === 1 && contract.status === 'FROZEN' && contract.schemaVersion === 'OfflineTeacherLabelingV1');
ok('policy NOT_TRAINED / dataset NOT_GENERATED', policy.status === 'CONTRACT_TARGET_NOT_TRAINED' && policy.pairedDistillationDataset && policy.pairedDistillationDataset.status === 'NOT_GENERATED');

const open = [];
openObjectNodes(schema, open);
ok('schema closed (no open object nodes)', open.length === 0, open.join(' | '));
const unitSchema = { ...schema.$defs.unit, $defs: schema.$defs };
const validateUnitData = makeValidator(unitSchema);
let posOk = 0;
for (const ex of contract.selfCheck.positive) {
  const err = validateUnitData(ex);
  if (!err) posOk += 1;
  else console.log('FAIL selfCheck positive ' + ex.unitId + ' :: ' + err);
  checks += 1;
}
ok('selfCheck positive ' + contract.selfCheck.positive.length + '/' + contract.selfCheck.positive.length, posOk === contract.selfCheck.positive.length);
let negOk = 0;
for (const ex of contract.selfCheck.negative) {
  const err = validateUnitData(ex.unit);
  if (err) negOk += 1;
  else console.log('FAIL selfCheck negative ' + ex.reason);
  checks += 1;
}
ok('selfCheck negative ' + contract.selfCheck.negative.length + '/' + contract.selfCheck.negative.length, negOk === contract.selfCheck.negative.length);

// corpus indexes and canonical sourceHash verification
const units = split.behaviorQualityCorpus.units;
ok('split unitCount 80', units.length === 80 && split.totals && split.totals.behaviorCorpusUnits === 80);
ok('split unitId unique', new Set(units.map(u => u.unitId)).size === 80);
const byCorpus = {};
for (const u of units) byCorpus[u.corpus] = (byCorpus[u.corpus] || 0) + 1;
ok('partition 54/20/6', byCorpus[F.oracle] === 54 && byCorpus[F.kernel] === 20 && byCorpus[F.v3raw] === 6, JSON.stringify(byCorpus));
const oracleByCase = new Map(oracle.fixtures.map(f => [f.sourceCaseId, f]));
const kernelByCase = new Map(kernel.cases.map(c => [c.caseId, c]));
const v3ByCase = new Map(v3raw.cases.map(c => [c.caseId, c]));
let srcMatch = 0;
const srcMiss = [];
for (const u of units) {
  const src = u.corpus === F.oracle ? oracleByCase.get(u.sourceCaseId) : u.corpus === F.kernel ? kernelByCase.get(u.sourceCaseId) : v3ByCase.get(u.sourceCaseId);
  if (!src) {
    srcMiss.push(u.unitId + ':NO_SOURCE');
    continue;
  }
  const h = canonical(src);
  if (h === u.sourceHash.toLowerCase()) srcMatch += 1;
  else srcMiss.push(u.unitId + ':want=' + u.sourceHash.slice(0, 12) + ':got=' + h.slice(0, 12));
}
ok('canonical sourceHash 80/80', srcMatch === 80, srcMiss.join(' | '));
// label derivation: one evaluateRawCase call per unit (contract enumerationRules)
const FIELD_ORDER = ['unitId', 'caseId', 'sourceHash', 'teacherVersion', 'mode', 'selected', 'pareto', 'alternatives', 'excluded', 'eligible', 'rankByCandidateId', 'hardExclusionByCandidateId', 'informationValuePresent', 'labelStatus', 'notPairableReasons'];
const FORBIDDEN_UNIT_KEYS = ['valueVector', 'causalFacts', 'informationBreakdown', 'score', 'candidateValue'];

function deriveLabel(unit, src, kind) {
  let res = null;
  let error = null;
  const candidates = src.input ? src.input.candidates : src.candidates;
  try {
    if (kind === 'oracle') {
      if (!src.input.expected || !src.input.expected.selectedCandidateId) throw new Error('fixture missing input.expected.selectedCandidateId');
      res = evaluateV2(src.input);
    } else if (kind === 'kernel') {
      res = evaluateV2({ caseId: src.caseId, mode: src.mode, playerLockedCandidateId: src.playerLockedCandidateId || null, candidates: src.candidates });
    } else {
      res = evaluateV3({ caseId: src.caseId, ...src.input });
    }
  } catch (e) {
    error = String((e && e.message) || e);
  }
  const infoValue = infoPresent(candidates);
  const head = {
    unitId: unit.unitId,
    caseId: kind === 'oracle' ? src.input.caseId : src.caseId,
    sourceHash: unit.sourceHash.toLowerCase(),
    teacherVersion: kind === 'oracle' ? 'RVE2_ORACLE_EXPECTATION' : kind === 'kernel' ? 'RVE2_KERNEL' : 'RVE3_RAW',
    mode: kind === 'oracle' || kind === 'v3' ? src.input.mode : src.mode,
  };
  const meta = { error, expectedSelected: null, expectedObjective: null, objectiveGot: null };
  if (kind === 'oracle') meta.expectedSelected = src.input.expected.selectedCandidateId;
  else if (src.expected) {
    meta.expectedSelected = src.expected.selectedCandidateId || null;
    if (kind === 'v3') meta.expectedObjective = src.expected.objectiveUtilityHEPP || null;
  }
  if (error || !res) {
    const label = {
      ...head,
      selected: null, pareto: [], alternatives: [], excluded: [], eligible: [],
      rankByCandidateId: {}, hardExclusionByCandidateId: {},
      informationValuePresent: infoValue, labelStatus: 'GENERATION_ERROR', notPairableReasons: [],
    };
    return { label, meta };
  }
  const isV3 = kind === 'v3';
  const evaluated = res.evaluated || res.evaluatedCandidates;
  const eligibleIds = evaluated
    .filter(e => (isV3 ? e.eligible === true : e.legal !== false && e.hardExclusionCodes.length === 0))
    .map(e => e.candidateId);
  const eligibleSet = new Set(eligibleIds);
  const excludedIds = sortedUtf16(evaluated.map(e => e.candidateId).filter(id => !eligibleSet.has(id)));
  const paretoIds = sortedUtf16(isV3 ? res.paretoCandidateIds : res.pareto.map(e => e.candidateId));
  const paretoSet = new Set(paretoIds);
  const selectedId = res.selected.candidateId;
  const alternatives = paretoIds.filter(id => id !== selectedId);
  const rankByCandidateId = {};
  for (const id of sortedUtf16(eligibleIds)) rankByCandidateId[id] = id === selectedId ? 0 : paretoSet.has(id) ? 1 : 2;
  const hardExclusionByCandidateId = {};
  for (const e of evaluated) {
    hardExclusionByCandidateId[e.candidateId] = isV3
      ? e.exclusionReasons.some(r => r !== 'ILLEGAL')
      : e.hardExclusionCodes.length > 0;
  }
  let labelStatus = 'TEACHER_LABELED';
  if (head.mode === 'manual') labelStatus = 'MANUAL_LOCKED_AUDIT_ONLY';
  else if (kind === 'oracle' && selectedId !== meta.expectedSelected) labelStatus = 'EXPECTATION_MISMATCH_FAILED';
  let label = {
    ...head,
    selected: selectedId, pareto: paretoIds, alternatives, excluded: excludedIds, eligible: sortedUtf16(eligibleIds),
    rankByCandidateId, hardExclusionByCandidateId,
    informationValuePresent: infoValue, labelStatus,
    notPairableReasons: infoValue ? ['INFORMATION_FEATURE_MISSING'] : [],
  };
  if (labelStatus === 'MANUAL_LOCKED_AUDIT_ONLY') {
    label.rankByCandidateId = {};
  } else if (labelStatus !== 'TEACHER_LABELED') {
    label.selected = null;
    label.pareto = [];
    label.alternatives = [];
    label.excluded = [];
    label.eligible = [];
    label.rankByCandidateId = {};
    label.hardExclusionByCandidateId = {};
    label.notPairableReasons = [];
  }
  if (isV3 && res.selected.valueVector) meta.objectiveGot = res.selected.valueVector.objectiveUtilityHEPP;
  return { label, meta };
}

const labels = [];
const srcByUnit = new Map();
const mismatches = [];
const objMismatches = [];
const modeCheck = { oracle: true, v3: true };
for (const u of units) {
  const kind = u.corpus === F.oracle ? 'oracle' : u.corpus === F.kernel ? 'kernel' : 'v3';
  const src = kind === 'oracle' ? oracleByCase.get(u.sourceCaseId) : kind === 'kernel' ? kernelByCase.get(u.sourceCaseId) : v3ByCase.get(u.sourceCaseId);
  const { label, meta } = deriveLabel(u, src, kind);
  srcByUnit.set(u.unitId, src);
  labels.push(label);
  if (kind !== 'kernel' && label.mode !== 'auto') modeCheck[kind] = false;
  if (meta.error) {
    mismatches.push(u.unitId + ':GENERATION_ERROR:' + meta.error);
  } else if (label.labelStatus === 'EXPECTATION_MISMATCH_FAILED') {
    mismatches.push(u.unitId + ':EXPECTATION_MISMATCH want=' + meta.expectedSelected + ' got=' + label.selected);
  } else if (meta.expectedSelected !== null && label.selected !== meta.expectedSelected) {
    mismatches.push(u.unitId + ':SELECTED_MISMATCH want=' + meta.expectedSelected + ' got=' + label.selected);
  }
  if (kind === 'v3' && !meta.error && meta.expectedObjective !== null && meta.objectiveGot !== meta.expectedObjective) {
    objMismatches.push(u.unitId + ':OBJECTIVE want=' + meta.expectedObjective + ' got=' + meta.objectiveGot);
  }
}
ok('oracle fixtures all auto (54)', modeCheck.oracle);
ok('v3 raw cases all auto (6)', modeCheck.v3);
ok('expected cross 0 diff (54 oracle + 20 kernel + 6 v3)', mismatches.length === 0, mismatches.join(' | '));
ok('v3 objectiveUtilityHEPP cross 0 diff (6)', objMismatches.length === 0, objMismatches.join(' | '));

// contract semanticChecks
const labelIds = new Set(labels.map(l => l.unitId));
ok('UNIT_ID_SET_EQUALS_SPLIT', labelIds.size === 80 && units.every(u => labelIds.has(u.unitId)));
ok('SOURCE_HASH_EQUALS_SPLIT', labels.every(l => {
  const u = units.find(x => x.unitId === l.unitId);
  return u && l.sourceHash === u.sourceHash.toLowerCase();
}));
const autoLabels = labels.filter(l => l.mode === 'auto' && l.labelStatus === 'TEACHER_LABELED');
let setConservationOk = true;
const setIssues = [];
for (const l of autoLabels) {
  const src = srcByUnit.get(l.unitId);
  const srcIds = sortedUtf16((src.input ? src.input.candidates : src.candidates).map(c => c.candidateId));
  const el = sortedUtf16(l.eligible);
  const ex = sortedUtf16(l.excluded);
  const partitionOk = el.every(id => !ex.includes(id)) && JSON.stringify(sortedUtf16([...el, ...ex])) === JSON.stringify(srcIds);
  const paretoOk = l.pareto.every(id => el.includes(id)) && el.includes(l.selected) && l.pareto.includes(l.selected);
  const altOk = JSON.stringify(l.alternatives) === JSON.stringify(l.pareto.filter(id => id !== l.selected));
  const rankKeysOk = JSON.stringify(Object.keys(l.rankByCandidateId).sort(utf16)) === JSON.stringify(el);
  const rankOk = l.rankByCandidateId[l.selected] === 0
    && l.pareto.filter(id => id !== l.selected).every(id => l.rankByCandidateId[id] === 1)
    && el.filter(id => !l.pareto.includes(id)).every(id => l.rankByCandidateId[id] === 2)
    && Object.values(l.rankByCandidateId).every(r => r === 0 || r === 1 || r === 2);
  if (!(partitionOk && paretoOk && altOk && rankKeysOk && rankOk)) {
    setConservationOk = false;
    setIssues.push(l.unitId);
  }
}
ok('SET_CONSERVATION (auto units)', setConservationOk, setIssues.join(' | '));
const sortedArraysOk = labels.every(l => [l.pareto, l.alternatives, l.excluded, l.eligible].every(a => a.every((x, i) => i === 0 || a[i - 1] < x)));
ok('UTF16_SORTED_ARRAYS (strictly ascending, duplicate-free)', sortedArraysOk);
ok('ORACLE_EXPECTATION_CONSISTENCY', labels.filter(l => l.teacherVersion === 'RVE2_ORACLE_EXPECTATION').every(l => l.labelStatus === 'TEACHER_LABELED' || (l.labelStatus === 'EXPECTATION_MISMATCH_FAILED' && l.selected === null)));
const infoUnits = labels.filter(l => l.informationValuePresent);
const infoOk = infoUnits.every(l => JSON.stringify(l.notPairableReasons) === JSON.stringify(['INFORMATION_FEATURE_MISSING']))
  && labels.filter(l => !l.informationValuePresent).every(l => l.notPairableReasons.length === 0);
ok('INFORMATION_PRESENCE (6 info units forced not-pairable)', infoUnits.length === 6 && infoOk, infoUnits.map(l => l.unitId).join(' | '));
const manualUnits = labels.filter(l => l.mode === 'manual');
ok('MANUAL_AUDIT_ONLY (exactly 1, rank empty, selected locked)', manualUnits.length === 1
  && manualUnits[0].labelStatus === 'MANUAL_LOCKED_AUDIT_ONLY'
  && manualUnits[0].selected === 'player-choice'
  && Object.keys(manualUnits[0].rankByCandidateId).length === 0);
ok('NO_VALUE_VECTOR_FIELDS', labels.every(l => Object.keys(l).length === 15 && FORBIDDEN_UNIT_KEYS.every(k => !(k in l))));
ok('hardExclusion subset of excluded', labels.every(l => Object.entries(l.hardExclusionByCandidateId).filter(([, v]) => v).every(([id]) => l.excluded.includes(id))));

// artifact, schema, hash
const sortedUnits = labels.slice().sort((a, b) => utf16(a.unitId, b.unitId));
const doc = { schemaVersion: 'OfflineTeacherLabelingV1', revision: 1, status: 'FROZEN', encoding: 'UTF-8', unitCount: 80, units: sortedUnits };
const artifactErr = makeValidator(schema)(doc);
ok('artifact passes OfflineTeacherLabelingV1.schema.json', !artifactErr, artifactErr || '');
const labelsHash = canonical({ schemaVersion: 'OfflineTeacherLabelingV1', units: sortedUnits });

if (failures === 0) {
  const bytes = JSON.stringify(doc, null, 2) + '\n';
  fs.writeFileSync(rel(F.artifact), bytes, 'utf8');
  const reread = JSON.parse(fs.readFileSync(rel(F.artifact), 'utf8'));
  ok('LABELS_HASH_REPRODUCIBLE from written artifact', labelsHash === canonical({ schemaVersion: 'OfflineTeacherLabelingV1', units: reread.units }));
  ok('artifact bytes stable on write', fs.readFileSync(rel(F.artifact), 'utf8') === bytes);
  console.log('WROTE ' + F.artifact);
} else {
  console.log('NOT_WRITTEN (failures present)');
}

const statusCounts = {};
for (const l of labels) statusCounts[l.labelStatus] = (statusCounts[l.labelStatus] || 0) + 1;
const excludedTotal = labels.reduce((n, l) => n + l.excluded.length, 0);
const hardExcludedTotal = labels.reduce((n, l) => n + Object.values(l.hardExclusionByCandidateId).filter(Boolean).length, 0);
console.log(JSON.stringify({
  checks,
  failures,
  statusCounts,
  infoUnits: infoUnits.map(l => l.unitId),
  manualUnits: manualUnits.map(l => l.unitId),
  excludedTotal,
  hardExcludedTotal,
  labelsHash,
  artifactHash: failures === 0 ? fileHash(F.artifact) : null,
}));
process.exit(failures ? 1 : 0);
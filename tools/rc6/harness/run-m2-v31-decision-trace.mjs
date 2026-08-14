// run-m2-v31-decision-trace.mjs
// Read-only harness for DecisionContributionTraceV1 (contract/schema/cases): schema closure,
// 12 gold full-trace validation, score/delta union conservation (1e-12), hardExclusions
// independence, UNKNOWN mask, three-layer visibility, forbidden tokens, number units,
// skeleton order, source refs, 5 failClosed fragment probes. Never generates reasons,
// never loads models/Report, never writes/stages/commits anything.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const rc6 = path.join(repoRoot, 'tools', 'rc6');
const P = {
  contract: ['contracts/DecisionContributionTraceV1.json', 'DecisionContributionTraceV1'],
  schema: ['contracts/DecisionContributionTraceV1.schema.json', 'DecisionContributionTraceV1.schema'],
  cases: ['cases/DecisionContributionTraceCasesV1.json', 'DecisionContributionTraceCasesV1'],
};
const PIN = {
  contract: 'efd196824263d85c7c17ebec4761b17ea70d04178429cb94f66b3d0f55ef9a99',
  schema: '983671b824cb65f9197a92383d6ee94e583a9a3e642415d18b88571534db3a7e',
  cases: '0c39a1ed81031c994be7d6640f36d0ee90356591bf1eb2e9c9f25bad0d6972e0',
};
const GOLD_IDS = ['gold-attack-finisher', 'gold-heal-sustain', 'gold-defense-shield', 'gold-control-taunt',
  'gold-resource-preserve', 'gold-information-probe', 'gold-summon-pending', 'gold-cost-too-high',
  'gold-near-equivalent-random', 'gold-alternative-diff', 'gold-risk-gamble', 'gold-exclusion-forced', 'gold-state-magnitude', 'gold-resource-percent-recover'];
const PROBE_IDS = ['fc-causal-chain-broken', 'fc-number-without-unit', 'fc-result-backward', 'fc-hidden-input', 'fc-conservation-failed',
  'fc-source-missing', 'fc-forbidden-token', 'fc-unknown-as-zero', 'fc-unbound-sentence', 'fc-order-violation'];
const PROBE_CODES = {
  'fc-causal-chain-broken': 'CAUSAL_CHAIN_BROKEN',
  'fc-number-without-unit': 'NUMBER_WITHOUT_UNIT',
  'fc-result-backward': 'RESULT_BACKWARD_RATIONALIZATION',
  'fc-hidden-input': 'HIDDEN_INPUT',
  'fc-conservation-failed': 'CONSERVATION_FAILED',
  'fc-source-missing': 'SOURCE_MISSING',
  'fc-forbidden-token': 'FORBIDDEN_TOKEN',
  'fc-unknown-as-zero': 'UNKNOWN_AS_ZERO',
  'fc-unbound-sentence': 'UNBOUND_SENTENCE',
  'fc-order-violation': 'ORDER_VIOLATION',
};
const CONCEPTS = ['目标推进', '伤害压力', '生存', '控制', '防御', '资源', '信息', '代价', '风险', '机会'];
const FT25 = ['weight', '权重', 'score', '分数', 'featureCode', 'HEPP', 'Pareto', '帕累托', 'candidateId', 'sourceEffectId',
  'seed', 'actualValue', 'normalized', 'mean', 'scale', 'intercept', 'contribution', 'tacticalConcept', 'alpha', 'lambda',
  'margin', 'frontier', 'band', '线性', '系数'];
const CODES10 = ['CAUSAL_CHAIN_BROKEN', 'SOURCE_MISSING', 'NUMBER_WITHOUT_UNIT', 'HIDDEN_INPUT',
  'RESULT_BACKWARD_RATIONALIZATION', 'CONSERVATION_FAILED', 'FORBIDDEN_TOKEN', 'UNKNOWN_AS_ZERO', 'UNBOUND_SENTENCE', 'ORDER_VIOLATION'];
const TOP_REQ = ['schemaVersion', 'candidateId', 'score', 'intercept', 'conservationError', 'contributions',
  'missingMask', 'selection', 'topContributions', 'player'];
const BACK_WORDS = ['死了', '打死', '杀光', '果然', '赢了', '输了', '爆了', '战后', '结果'];
const FUTURE_WORDS = ['下一回合', '下回合', '未来', 'route', 'future'];
const MOJI = ['�', '鱏斤打'];

let passed = 0, failed = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else { failed += 1; failures.push(name + (detail ? ' | ' + detail : '')); }
};
const close = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(path.join(rc6, p), 'utf8'));
const contract = readJson(P.contract[0]);
const schema = readJson(P.schema[0]);
const cases = readJson(P.cases[0]);

// ---- utf8 / duplicate keys ----
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

// ---- lightweight draft-2020-12 validator (allOf/exclusiveMinimum added) ----
function makeValidator(root, sub) {
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
      if (node.properties) for (const [k, subn] of Object.entries(node.properties)) if (k in v) { const e = check(v[k], subn, loc + '.' + k, seen); if (e) return e; }
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
    if (node.allOf) for (const subn of node.allOf) { const e = check(v, subn, loc, seen); if (e) return e; }
    if (node.oneOf) {
      const npass = node.oneOf.filter(subn => !check(v, subn, loc, seen)).length;
      if (npass !== 1) return 'oneOf ' + npass + ' at ' + loc;
    }
    if (node.enum !== undefined && !node.enum.some(x => eq(x, v))) return 'enum at ' + loc;
    if (node.const !== undefined && !eq(node.const, v)) return 'const at ' + loc;
    if (node.not) { const e = check(v, node.not, loc, seen); if (!e) return 'not at ' + loc; }
    if (typeof v === 'string') {
      if (node.minLength !== undefined && v.length < node.minLength) return 'minLength at ' + loc;
      if (node.pattern && !new RegExp(node.pattern).test(v)) return 'pattern at ' + loc;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (node.minimum !== undefined && v < node.minimum) return 'minimum at ' + loc;
      if (node.maximum !== undefined && v > node.maximum) return 'maximum at ' + loc;
      if (node.exclusiveMinimum !== undefined && v <= node.exclusiveMinimum) return 'exclusiveMinimum at ' + loc;
    }
    if (node.if && !check(v, node.if, loc, seen) && node.then) { const e = check(v, node.then, loc, seen); if (e) return e; }
    return null;
  }
  return v => check(v, sub || root, '$', new Set());
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

// ---- block A: pins / utf8 / json / duplicate keys ----
for (const [key, [p, tag]] of Object.entries(P)) {
  const buf = fs.readFileSync(path.join(rc6, p));
  ok('pin ' + tag, sha256(buf) === PIN[key], sha256(buf).slice(0, 16));
  const text = buf.toString('utf8');
  ok('utf8 ' + tag, utf8Strict(buf));
  ok('json-parse ' + tag, (() => { try { JSON.parse(text); return true; } catch { return false; } })());
  ok('no-mojibake ' + tag, !MOJI.some(m => text.includes(m)));
  const dk = findDupKeys(text);
  ok('no-dup-keys ' + tag, dk.length === 0, dk.slice(0, 5).join(','));
}

// ---- block B: contract self-consistency ----
ok('contract revision/frozen', contract.revision === 6 && contract.status === 'FROZEN' && contract.schemaVersion === 'DecisionContributionTraceV1');
ok('contract authority', contract.authority.claim === 'CONTRACT_TARGET_ONLY_NOT_IMPLEMENTED'
  && contract.authority.decisionTimeOnly === true && contract.authority.realizedOutcomeIndependent === true
  && contract.authority.teacherAndRouteFree === true
  && JSON.stringify(contract.authority.governedBy) === JSON.stringify(['DistilledBehaviorPolicyV1', 'DistilledBehaviorPolicyV1.schema',
    'BehaviorImmediateFeatureV1', 'BehaviorImmediateFeatureV1.schema', 'BehaviorProviderV1']));
ok('concepts 10', JSON.stringify(contract.tacticalConceptV1.concepts) === JSON.stringify(CONCEPTS));
const FC_ENUM = schema.$defs.contribution.properties.featureCode.enum;
ok('mapping covers featureCode enum', JSON.stringify(Object.keys(contract.tacticalConceptV1.mapping).sort()) === JSON.stringify([...FC_ENUM].sort()));
ok('mapping values in concepts', Object.values(contract.tacticalConceptV1.mapping).every(v => CONCEPTS.includes(v)));
const kov = contract.tacticalConceptV1.keyOverride.ATTRIBUTE_DELTA;
ok('keyOverride 6', Object.keys(kov).length === 6 && kov['力量'] === '伤害压力' && kov['敏捷'] === '生存' && kov['防御'] === '防御'
  && kov['魂力上限'] === '资源' && kov['精神力上限'] === '资源' && kov['体力上限'] === '资源');
ok('forbiddenTokens 25', JSON.stringify(contract.playerV1.forbiddenTokens) === JSON.stringify(FT25));
ok('failClosed codes 10', JSON.stringify(contract.failClosedV1.codes) === JSON.stringify(CODES10));
ok('probeShape shape', String(contract.failClosedV1.probeShape).includes('FAIL_CLOSED_PROBE')
  && String(contract.failClosedV1.probeShape).includes('FRAGMENT')
  && String(contract.failClosedV1.probeShape).includes('probe:{target, fragment}')
  && String(contract.failClosedV1.validationPhase).includes('fragmentProbe schema'));
ok('validationOrder', JSON.stringify(contract.validationOrderV1.order) === '["SCHEMA_SHAPE","SEMANTIC_CHECKS"]' && contract.validationOrderV1.frozen === true);
ok('complexity', contract.complexity.expression === 'O(C * F)' && contract.complexity.noRoundHorizonBranchExponential === true);
ok('conservation 1e-12', String(contract.scoreDecompositionV1.conservation).includes('1e-12')
  && String(contract.scoreDecompositionV1.missingMask).includes('NOT part of the model missingMask'));
ok('selection UTF-16 tie-break', String(contract.selectionDeltaV1.topPositive).includes('UTF-16')
  && String(contract.selectionDeltaV1.topNegative).includes('UTF-16'));
ok('skeleton const', JSON.stringify(contract.playerV1.skeleton) === JSON.stringify(['SITUATION', 'FACTS', 'SUPPORT', 'DIFFERENTIATION', 'RISK_COST']));
ok('realizedOutcome const', contract.realizedOutcomeV1.schemaVersionConst === 'RealizedOutcomeV1' && contract.realizedOutcomeV1.independent === true);
ok('hardExclusions canonical', String(contract.hardExclusions.schema).includes('each {code, reasonText}'));
ok('sourceHashes 6 on disk', (() => {
  const sh = contract.sourceHashes;
  if (Object.keys(sh).length !== 6) return false;
  return Object.entries(sh).every(([p, h]) => {
    const fp = path.join(repoRoot, p);
    return fs.existsSync(fp) && sha256(fs.readFileSync(fp)) === h;
  });
})());
ok('cases revision 7', cases.revision === 7 && cases.counts.goldCount === 14 && cases.counts.probeCount === 10 && cases.counts.total === 24);
ok('cases gold ids', JSON.stringify(cases.cases.map(c => c.caseId)) === JSON.stringify(GOLD_IDS));
ok('cases gold kinds', cases.cases.every(c => c.kind === 'GOLD_PLAYER'));
ok('cases probe ids', JSON.stringify((cases.probes || []).map(p => p.caseId)) === JSON.stringify(PROBE_IDS));
ok('cases probe shape', (cases.probes || []).every(p => p.kind === 'FAIL_CLOSED_PROBE' && p.validationPhase === 'FRAGMENT' && p.expect.schemaPhase === 'PASS'));
ok('cases conservationRule', String(cases.conservationRule).includes('1e-12'));

// ---- block C: schema closure / shape ----
ok('schema-closed', (() => { const open = []; openObjectNodes(schema, open); return open.length === 0; })());
ok('schema top required', JSON.stringify(schema.required) === JSON.stringify(TOP_REQ));
ok('schema top closed', schema.additionalProperties === false
  && (() => { try { return new RegExp(schema.properties.candidateId.pattern).test('cand-x'); } catch { return false; } })());
ok('schema defs 10', JSON.stringify(Object.keys(schema.$defs).sort()) === JSON.stringify(
  ['contribution', 'delta', 'exclusion', 'fragmentProbe', 'player', 'realizedOutcome', 'review', 'selection', 'sentence', 'topContributions']));
ok('schema conservationError cap', schema.properties.conservationError.minimum === 0 && schema.properties.conservationError.maximum === 1e-12);
ok('schema tieBreaks', schema.$defs.selection.oneOf[0].properties.tieBreak.const === 'DELTA_ABS_DESC_FEATURECODE_UTF16_ASC'
  && schema.$defs.topContributions.properties.tieBreak.const === 'CONTRIBUTION_ABS_DESC_FEATURECODE_UTF16_ASC'
  && schema.$defs.topContributions.properties.noneOmitted.const === true);
ok('schema probe target enum', JSON.stringify(schema.$defs.fragmentProbe.properties.probe.properties.target.enum) === '["player","traceRefs","realizedOutcome","conservation"]');
ok('schema exclusion codes 10', schema.$defs.exclusion.properties.code.enum.length === 10);
ok('schema realizedOutcome const', schema.$defs.realizedOutcome.properties.schemaVersion.const === 'RealizedOutcomeV1');

// ---- shared gold helpers ----
const DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  let total = 0, cur = 0, last = 1;
  for (const ch of s) {
    if (ch in DIGITS) cur = DIGITS[ch];
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; last = 10; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; last = 100; }
    else if (ch === '千') { total += (cur || 1) * 1000; cur = 0; last = 1000; }
    else return null;
  }
  if (cur > 0 && last > 10 && total > 0 && cur < 10) return total + cur * (last / 10);
  return total + cur;
}
const NUM_RE = /([零一二两三四五六七八九十百千\d]+)(成半|成|回合|段|次|倍|点|半)/g;
function extractNumbers(text) {
  const out = [];
  let m;
  while ((m = NUM_RE.exec(text))) {
    const n = cnNum(m[1]);
    // "一次" is a generic measure word (一次爆发), not a provable count.
    if (n !== null && !(m[2] === '次' && n === 1)) out.push({ num: m[2] === '半' ? n * 0.5 : n, unit: m[2] });
  }
  return out;
}
function unitCat(unit) {
  if (unit === 'RATIO_0_1' || unit === 'PROBABILITY_0_1' || unit === 'PERCENT') return 'ratio';
  if (unit === 'ABS' || unit === 'COUNT') return 'abs';
  if (unit === 'TURNS') return 'turns';
  if (unit === 'POWER') return 'power';
  return 'other';
}
function unitCatOfWord(w) {
  if (w === '成' || w === '成半' || w === '半') return 'ratio';
  if (w === '点' || w === '段' || w === '次') return 'abs';
  if (w === '回合') return 'turns';
  if (w === '倍') return 'power';
  return 'other';
}
function numPool(dec, rev) {
  const pool = [];
  for (const c of dec.contributions) if (typeof c.rawValue === 'number') pool.push({ unit: c.unitFamily, value: c.rawValue });
  for (const o of rev || []) pool.push({ unit: o.unit, value: o.value });
  return pool;
}
function explainNum(num, word, pool) {
  if (word === '成' || word === '成半') {
    const v = word === '成半' ? num * 0.1 + 0.05 : num * 0.1;
    return pool.some(o => (o.unit === 'RATIO_0_1' || o.unit === 'PROBABILITY_0_1') && close(o.value, v))
      || pool.some(o => o.unit === 'PERCENT' && close(Math.abs(o.value) / 100, v));
  }
  if (word === '点') return pool.some(o => (o.unit === 'ABS' || o.unit === 'COUNT') && close(Math.abs(o.value), num));
  if (word === '回合') return pool.some(o => o.unit === 'TURNS' && close(o.value, num));
  if (word === '段' || word === '次') return pool.some(o => o.unit === 'COUNT' && close(o.value, num));
  if (word === '倍') {
    if (pool.some(o => o.unit === 'POWER' && close(o.value, num))) return true;
    if (num === 2 || num === 0.5) {
      for (let i = 0; i < pool.length; i += 1) for (let j = 0; j < pool.length; j += 1) {
        if (i !== j && pool[i].unit === pool[j].unit && pool[i].value > 0 && pool[j].value > 0 && close(pool[i].value / pool[j].value, num)) return true;
      }
    }
    return false;
  }
  if (word === '半') return pool.some(o => (o.unit === 'RATIO_0_1' || o.unit === 'PROBABILITY_0_1') && close(o.value, num));
  return false;
}
function sentenceExplains(value, sentences) {
  for (const s of sentences) {
    for (const n of extractNumbers(s.text)) {
      if (n.unit === '成') { if (close(n.num * 0.1, value)) return true; }
      else if (n.unit === '成半') { if (close(n.num * 0.1 + 0.05, value)) return true; }
      else if (n.unit === '半') { if (close(n.num * 0.5, value)) return true; }
      else if (close(n.num, Math.abs(value))) return true;
    }
  }
  return false;
}
function topByContribution(rows) {
  const cmp = (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || (a.featureCode < b.featureCode ? -1 : 1);
  return {
    pos: rows.filter(r => typeof r.contribution === 'number' && r.contribution > 0).sort(cmp).map(r => r.featureId),
    neg: rows.filter(r => typeof r.contribution === 'number' && r.contribution < 0).sort(cmp).map(r => r.featureId),
  };
}
function topByDelta(deltas) {
  const cmp = (a, b) => Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution) || (a.featureCode < b.featureCode ? -1 : 1);
  // B freezes an asymmetric masked-loss rule: topPositive is strictly delta > 0;
  // topNegative additionally includes zero-delta rows whose selected side is
  // UNKNOWN while the alternative is KNOWN (masked-loss rows, e.g.
  // gold-resource-percent-recover DAMAGE_POWER delta 0); zero-delta rows with the
  // selected side KNOWN never enter topPositive (e.g. gold-information-probe
  // SUCCESS_PROBABILITY / OUTSIDE_BATCH1_ROW_COUNT).
  const negSide = d => d.deltaContribution < 0 || (d.deltaContribution === 0 && d.zeroByMask === true && d.statusOfSelected === 'UNKNOWN' && d.statusOfAlternative === 'KNOWN');
  const posSide = d => d.deltaContribution > 0;
  return {
    pos: deltas.filter(posSide).sort(cmp).map(d => d.featureId),
    neg: deltas.filter(negSide).sort(cmp).map(d => d.featureId),
  };
}

// ---- block D: 14 gold cases ----
const MAPPING = contract.tacticalConceptV1.mapping;
const SKELETON = contract.playerV1.skeleton;
const OP_ENUM = ['rawValue', 'mean', 'scale', 'normalized', 'deltaContribution'];
// Five-stage Chinese causal chain: every sentence kind must bind facts of its role.
// SITUATION binds public situation/plan facts; SUPPORT binds substantive support and
// never risk/uncertainty axes; DIFFERENTIATION must reference DELTA rows or name the
// alternative; RISK_COST binds only public risk/resource/hit facts; CONCLUSION closes.
const KIND_RULES = {
  SITUATION: { allow: ['PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'COST_AFFORDABILITY', 'STATE_DURATION', 'STATE_DELTA_PERCENT'], hard: true, label: '局势/计划' },
  FACTS: { allow: null, hard: true, label: '公开事实' },
  SUPPORT: { deny: ['SUCCESS_PROBABILITY', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE'], hard: true, label: '实质支持' },
  DIFFERENTIATION: { diff: true, hard: false, label: '差异比较' },
  RISK_COST: { allow: ['SUCCESS_PROBABILITY', 'COST_AFFORDABILITY', 'RESOURCE_DELTA', 'PUBLIC_HP_RATIO', 'PUBLIC_RESOURCE_RATIO', 'ROLL_REALIZATION', 'SETTLEMENT_DAMAGE'], hard: false, label: '公开风险/资源/命中' },
  CONCLUSION: { allow: null, hard: true, label: '结论' },
};
const DIFF_WORDS = ['另一手', '更', '比', '多', '少', '差', '没'];
function chainIssuesFor(s, dec) {
  const out = [];
  const rule = KIND_RULES[s.kind];
  if (!rule) { out.push(s.kind + ':unknown-kind'); return out; }
  if (rule.diff) {
    const hasDelta = s.traceRefs.some(r => r.startsWith('DELTA:'));
    const hasWord = DIFF_WORDS.some(w => s.text.includes(w));
    if (!hasDelta && !hasWord) out.push('DIFFERENTIATION without DELTA/另一手/比较词: ' + s.text);
    return out;
  }
  for (const r of s.traceRefs) {
    if (r.startsWith('DELTA:')) { out.push(r + ': DELTA only in DIFFERENTIATION'); continue; }
    if (r.startsWith('HARD_EXCLUSION:')) { if (!rule.hard) out.push(r + ': HARD not allowed in ' + s.kind); continue; }
    const row = dec.contributions.find(c => c.featureId === r);
    if (!row) continue;
    const code = row.featureCode;
    if (rule.allow && !rule.allow.includes(code)) out.push(r + ':' + code + ': not in ' + s.kind + ' allow (' + rule.label + ')');
    if (rule.deny && rule.deny.includes(code)) out.push(r + ':' + code + ': denied in ' + s.kind);
  }
  return out;
}
for (const cs of cases.cases) {
  const id = cs.caseId;
  const dec = cs.input.decomposition;
  const exp = cs.expect;
  const doc = Object.assign({}, dec, { player: exp.player });
  const err = makeValidator(schema)(doc);
  ok(id + ' trace-schema', !err, err || '');
  const knownSum = dec.contributions.filter(c => c.status === 'KNOWN' && c.missingMasked === false)
    .reduce((a, c) => a + c.contribution, 0);
  const errCalc = Math.abs(dec.score - (dec.intercept + knownSum));
  ok(id + ' score-conservation', errCalc <= 1e-12, 'err=' + errCalc);
  ok(id + ' conservationError-record', close(dec.conservationError, errCalc), 'rec=' + dec.conservationError + ' calc=' + errCalc);
  const knownCodes = new Set(dec.contributions.filter(c => c.status === 'KNOWN').map(c => c.featureCode));
  const nonKnown = dec.contributions.filter(c => c.status !== 'KNOWN');
  ok(id + ' missingMask-excludes-hard', !dec.missingMask.includes('HARD_EXCLUSION') && !dec.missingMask.includes('HARD_EXCLUSION_REASON'));
  ok(id + ' missingMask-covers-unknown', nonKnown.every(c => dec.missingMask.includes(c.featureCode)));
  ok(id + ' missingMask-no-known', dec.missingMask.every(code => !knownCodes.has(code)));
  ok(id + ' unknown-rows-empty', nonKnown.every(c => c.missingMasked === true
    && !('rawValue' in c) && !('mean' in c) && !('scale' in c) && !('normalized' in c) && !('weight' in c) && !('contribution' in c)));
  ok(id + ' known-concept', dec.contributions.filter(c => c.status === 'KNOWN').every(c => c.tacticalConcept === MAPPING[c.featureCode]));
  const tp = topByContribution(dec.contributions);
  ok(id + ' topContributions-positive', JSON.stringify(tp.pos) === JSON.stringify(dec.topContributions.topPositive),
    'gold=' + JSON.stringify(dec.topContributions.topPositive) + ' calc=' + JSON.stringify(tp.pos));
  ok(id + ' topContributions-negative', JSON.stringify(tp.neg) === JSON.stringify(dec.topContributions.topNegative),
    'gold=' + JSON.stringify(dec.topContributions.topNegative) + ' calc=' + JSON.stringify(tp.neg));
  const hx = dec.hardExclusions || [];
  ok(id + ' hardExclusions-schema', hx.every(h => !makeValidator(schema, schema.$defs.exclusion)(h)));
  ok(id + ' hard-no-model-rows', !dec.contributions.some(c => c.featureCode === 'HARD_EXCLUSION' || c.featureCode === 'HARD_EXCLUSION_REASON'));
  if (dec.selection.reason === 'NO_ELIGIBLE_ALTERNATIVE') {
    ok(id + ' selection-not-available', !('scoreDelta' in dec.selection) && !('deltas' in dec.selection)
      && !('topPositive' in dec.selection) && !('topNegative' in dec.selection));
  } else {
    const dsum = dec.selection.deltas.reduce((a, d) => a + d.deltaContribution, 0);
    ok(id + ' delta-union-conservation', close(dec.selection.scoreDelta, dsum), 'sd=' + dec.selection.scoreDelta + ' sum=' + dsum);
    ok(id + ' delta-zeroByMask', dec.selection.deltas.every(d => (d.zeroByMask === true) === (d.statusOfSelected !== 'KNOWN' || d.statusOfAlternative !== 'KNOWN')));
    const td = topByDelta(dec.selection.deltas);
    ok(id + ' selection-topPositive', JSON.stringify(td.pos) === JSON.stringify(dec.selection.topPositive),
      'gold=' + JSON.stringify(dec.selection.topPositive) + ' calc=' + JSON.stringify(td.pos));
    ok(id + ' selection-topNegative', JSON.stringify(td.neg) === JSON.stringify(dec.selection.topNegative),
      'gold=' + JSON.stringify(dec.selection.topNegative) + ' calc=' + JSON.stringify(td.neg));
    ok(id + ' selection-tieBreak', dec.selection.tieBreak === 'DELTA_ABS_DESC_FEATURECODE_UTF16_ASC');
  }
  const ids = new Set(dec.contributions.map(c => c.featureId));
  const dIds = new Set((dec.selection.deltas || []).map(d => d.featureId));
  const hc = new Set(hx.map(h => h.code));
  ok(id + ' traceRefs-bound', exp.player.sentences.every(s => s.traceRefs.every(r =>
    ids.has(r) || (r.startsWith('HARD_EXCLUSION:') && hc.has(r.slice(15))) || (r.startsWith('DELTA:') && dIds.has(r.slice(6))))));
  ok(id + ' sentences-bound', exp.player.sentences.every(s => Array.isArray(s.traceRefs) && s.traceRefs.length >= 1));
  const allText = exp.player.sentences.map(s => s.text + (s.connective || '')).join('');
  const hits = FT25.filter(t => allText.includes(t));
  ok(id + ' forbiddenTokens', hits.length === 0, hits.join(','));
  const caseFT = exp.forbiddenTokens || [];
  ok(id + ' case-forbidden-list', caseFT.length === FT25.length - 2
    && FT25.filter(t => !caseFT.includes(t)).sort().join(',') === 'alpha,lambda',
    'diff=' + FT25.filter(t => !caseFT.includes(t)).join(','));
  const pool = numPool(dec, exp.reviewAssertions);
  const numIssues = [];
  for (const s of exp.player.sentences) {
    const isAlt = s.text.includes('另一手');
    for (const n of extractNumbers(s.text)) {
      const cat = unitCatOfWord(n.unit);
      const catExists = pool.some(o => unitCat(o.unit) === cat);
      if (isAlt) { if (!catExists) numIssues.push(s.text + ':' + n.num + n.unit + ':no-unit-cat'); }
      else if (!explainNum(n.num, n.unit, pool)) numIssues.push(s.text + ':' + n.num + n.unit + ':unexplained');
    }
  }
  ok(id + ' numbers-with-unit', numIssues.length === 0, numIssues.join(' | '));
  const kinds = exp.player.sentences.map(s => s.kind);
  const ci = kinds.indexOf('CONCLUSION');
  ok(id + ' conclusion-tail', ci === -1 || ci === kinds.length - 1);
  let last = -1; let mono = true;
  for (const k of kinds.filter(k => k !== 'CONCLUSION')) {
    const i = SKELETON.indexOf(k);
    if (i < 0 || i <= last) mono = false;
    last = Math.max(last, i);
  }
  ok(id + ' skeleton-order', mono && kinds.length >= 1 && kinds.length <= 8, kinds.join('>'));
  ok(id + ' cjk-text', exp.player.sentences.every(s => /[\u4e00-\u9fff]/.test(s.text)));
  const chainIssues = [];
  for (const s of exp.player.sentences) chainIssues.push(...chainIssuesFor(s, dec));
  if (dec.selection.reason === 'NO_ELIGIBLE_ALTERNATIVE'
    && exp.player.sentences.some(s => s.kind === 'DIFFERENTIATION')) {
    chainIssues.push('DIFFERENTIATION forged with NO_ELIGIBLE_ALTERNATIVE');
  }
  ok(id + ' five-stage-causal-chain', chainIssues.length === 0, chainIssues.join(' | '));
  const revIssues = [];
  for (const o of exp.reviewAssertions || []) {
    const row = dec.contributions.find(c => c.featureId === o.featureId);
    if (!row) { if (!(dec.selection.deltas || []).some(d => d.featureId === o.featureId)) revIssues.push(o.featureId + ':no-row'); }
    else if (row.unitFamily !== o.unit) revIssues.push(o.featureId + ':unit ' + row.unitFamily + '!=' + o.unit);
    if (!OP_ENUM.includes(o.operand)) revIssues.push(o.featureId + ':operand ' + o.operand);
    if (!Number.isFinite(o.value) || typeof o.unit !== 'string' || o.unit.length === 0) revIssues.push(o.featureId + ':badvalue');
    if (row && o.operand === 'rawValue' && !close(row.rawValue, o.value) && !sentenceExplains(o.value, exp.player.sentences)) {
      revIssues.push(o.featureId + ':value ' + o.value + ' vs ' + row.rawValue);
    }
  }
  ok(id + ' review-operands', revIssues.length === 0, revIssues.join(' | '));
  ok(id + ' no-result-backward', !BACK_WORDS.some(w => allText.includes(w)));
  ok(id + ' no-future', !FUTURE_WORDS.some(w => allText.includes(w)));
  ok(id + ' realizedOutcome-independent', !('realizedOutcome' in dec));
  ok(id + ' expect-conservation', exp.conservation && exp.conservation.holds === true && exp.conservation.tolerance === 1e-12);
  ok(id + ' expect-failClosed-null', exp.failClosed === null);
}

// ---- block E: 10 fragment probes ----
function probeTriggers(code, frag) {
  const sentences = frag.player ? frag.player.sentences : [];
  const texts = sentences.map(s => s.text);
  if (code === 'CAUSAL_CHAIN_BROKEN') {
    const ids = new Set((frag.contributions || []).map(c => c.featureId));
    const dIds = new Set(((frag.selection && frag.selection.deltas) || []).map(d => d.featureId));
    const hc = new Set((frag.hardExclusions || []).map(h => h.code));
    return sentences.some(s => s.traceRefs.some(r => !ids.has(r)
      && !(r.startsWith('HARD_EXCLUSION:') && hc.has(r.slice(15))) && !(r.startsWith('DELTA:') && dIds.has(r.slice(6)))));
  }
  if (code === 'NUMBER_WITHOUT_UNIT') {
    const pool = frag.review ? frag.review.operands.map(o => ({ unit: o.unit, value: o.value })) : [];
    return sentences.some(s => extractNumbers(s.text).some(n => !pool.some(o => unitCat(o.unit) === unitCatOfWord(n.unit))));
  }
  if (code === 'RESULT_BACKWARD_RATIONALIZATION') {
    return !!frag.realizedOutcome && texts.some(t => BACK_WORDS.some(w => t.includes(w)));
  }
  if (code === 'HIDDEN_INPUT') return texts.some(t => t.includes('隐藏'));
  if (code === 'CONSERVATION_FAILED') {
    const sum = (frag.contributions || []).filter(c => c.status === 'KNOWN' && c.missingMasked === false)
      .reduce((a, c) => a + c.contribution, 0);
    return Math.abs(frag.score - (frag.intercept + sum)) > 1e-12;
  }
  if (code === 'SOURCE_MISSING') {
    return sentences.some(s => extractNumbers(s.text).length > 0
      && !(frag.review && Array.isArray(frag.review.sources) && frag.review.sources.length > 0));
  }
  if (code === 'FORBIDDEN_TOKEN') {
    return sentences.some(s => FT25.some(t => s.text.includes(t) || (s.connective || '').includes(t)));
  }
  if (code === 'UNKNOWN_AS_ZERO') {
    return sentences.some(s => (/零/.test(s.text) || /(?:^|[^0-9])0(?:[^0-9]|$)/.test(s.text))
      && s.traceRefs.some(r => {
        const row = (frag.contributions || []).find(c => c.featureId === r);
        return row && row.status !== 'KNOWN';
      }));
  }
  if (code === 'UNBOUND_SENTENCE') {
    return sentences.some(s => Array.isArray(s.traceRefs) && s.traceRefs.length === 0);
  }
  if (code === 'ORDER_VIOLATION') {
    const kinds = sentences.map(s => s.kind);
    const ci = kinds.indexOf('CONCLUSION');
    if (ci !== -1 && ci !== kinds.length - 1) return true;
    let last = -1;
    for (const k of kinds.filter(k => k !== 'CONCLUSION')) {
      const i = SKELETON.indexOf(k);
      if (i < 0 || i <= last) return true;
      last = i;
    }
    return false;
  }
  return false;
}
for (const pr of cases.probes || []) {
  const id = pr.caseId;
  const err = makeValidator(schema, schema.$defs.fragmentProbe)(pr);
  ok(id + ' fragmentProbe-schema', !err, err || '');
  ok(id + ' schemaPhase', pr.expect.schemaPhase === 'PASS');
  ok(id + ' semanticCheck-declared', pr.expect.semanticCheck === PROBE_CODES[id], pr.expect.semanticCheck);
  const frag = pr.probe.fragment;
  ok(id + ' fragment-subset', Object.keys(frag).every(k => k in schema.properties));
  ok(id + ' no-impersonation', schema.required.some(k => !(k in frag)));
  ok(id + ' top-schema-rejects-fragment', !!makeValidator(schema)(frag));
  ok(id + ' triggers-' + pr.expect.semanticCheck, probeTriggers(pr.expect.semanticCheck, frag));
}

console.log('assertionCount=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
for (const f of failures) console.log('FAIL: ' + f);
process.exit(failed ? 1 : 0);

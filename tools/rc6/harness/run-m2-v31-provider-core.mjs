// run-m2-v31-provider-core.mjs
// M2 provider-core harness (candidate C), rev5. Read-only: never writes, stages or commits.
// Real-vm load of BehaviorProvider_Module.js and BehaviorPrototypeAdapter_Module.js (rev5).
// Provider gates: 15 F3 cases through select/evaluateVectors with contract gold, input
// stability, deep-frozen outputs, no aliasing, real lastWorkUnits, poisoned vm (Math.random /
// Date.now / Function / eval / timers must be 0 calls after all cases).
// Adapter gates: layered rev5 registry (enrollment 581 vs implementation 243/338/40/91/0
// + batch-2 137), batch-1 five prototypes strict direct projections, 13 pending explicit
// zero contribution plus PENDING_*, 40 deferred path-level, 91 out-of-battle, lift/selfCheck/
// universe classification. DirectFact-to-Provider column mapping is NOT frozen: no invented
// integration, no end-to-end semantics claim. No Kernel/Decision/Runtime/loader, no 7v7/5v5
// or perf bench. Any failed assertion exits 1.
// plus PENDING_DIRECT_PROJECTION, 40 deferred path-level, 91 out-of-battle, lift/selfCheck/
// universe classification. DirectFact-to-Provider column mapping is NOT frozen: no invented
// integration, no end-to-end semantics claim. No Kernel/Decision/Runtime/loader, no 7v7/5v5
// or perf bench. Any failed assertion exits 1.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPrototypePathUniverse } from '../reference/build-prototype-path-universe.mjs';
import { buildManualCases } from '../../battle_r63_manual_cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const RC6 = path.join(REPO_ROOT, 'tools', 'rc6');
const BP_SRC = fs.readFileSync(path.join(REPO_ROOT, 'BehaviorProvider_Module.js'), 'utf8');
const PDA_SRC = fs.readFileSync(path.join(REPO_ROOT, 'BehaviorPrototypeAdapter_Module.js'), 'utf8');
const M1_PATH = path.join(HERE, 'run-m1-v31-acceptance.mjs');

const BATCH1_PROTOS = ['伤害结算', '资源变化', '护盾变化', '属性修正', '判定修正'];
const BATCH2_PROTOS = ['状态施加', '召唤生成', '结算修正'];
const PENDING13 = ['资源转移', '炸环', '时窗修正', '状态移除', '规则防御', '状态转移', '状态交换', '资源锁定', '规则改写', '机制抹消', '机制授予', '位移执行', '决策干扰'];
const PROJECT_FIELDS = ['directFacts', 'legalityModifiers', 'opportunityModifiers', 'scheduledFacts', 'unsupportedOutcomeKinds', 'deferCode'];
const FACT_ROW_KEYS = ['schemaVersion', 'factType', 'key', 'sourceActionId', 'sourceActorId', 'sourceEffectId', 'targetIds', 'amount', 'unit', 'durationTurns'];
const PDA_HASH_EXPECTED = '76915ef0fac57ea4fe141319540177b5024ce86ffc7919202b4463a337143147';

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
const noNegZero = v => !(typeof v === 'number' && Object.is(v, -0));
const ctxOf = c => Object.assign({}, (c && c.context) || {});
const sixField = prj => Object.keys(prj).length === 6 && PROJECT_FIELDS.every(k => k in prj);
const F3 = readJson('cases/BehaviorProviderSelectionCasesV1.json');
const F9 = readJson('cases/PrototypeDirectAdapterCasesV1.json');
const F7 = readJson('contracts/PrototypeDirectAdapterV1.json');
const F6 = readJson('cases/BehaviorProviderQualitySplitV1.json');

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
vm.runInContext(PDA_SRC, ctx, { filename: 'BehaviorPrototypeAdapter_Module.js' });
const BP = ctx.__LWCS_BEHAVIOR_PROVIDER__;
const PDA = ctx.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__;

// ---- wrappers: input stable serialize, output deepFrozen, no aliasing, lastWorkUnits.
function runSelect(tag, input) {
  const before = JSON.stringify(input);
  callSelect += 1;
  const out = BP.select(input);
  ok(tag + ' input stable', JSON.stringify(input) === before);
  selIdx += 1;
  ok('select output deepFrozen ' + selIdx, deepFrozen(out, new Set()), tag);
  ok('select output no input alias ' + selIdx, !aliasesInput(out, input), tag);
  const wu = BP.readMetrics().lastWorkUnits;
  if (typeof wu === 'number' && Number.isFinite(wu)) { maxWork = Math.max(maxWork, wu); lastWorkUnitsPresent = true; }
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
  return out;
}
function probeFatal(tag, input, code) {
  const before = JSON.stringify(input);
  callSelect += 1;
  const threw = expectThrow(tag, () => BP.select(input), code, true);
  if (threw) callFatal += 1;
  ok(tag + ' input stable', JSON.stringify(input) === before);
  return threw;
}

// ---- static closure scan: codeOnly strips comments/strings so declaration-only
// forbidden tokens (e.g. concatenated 'world'+'Clone(' never count as real calls).
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
const PDA_CODE = codeOnly(PDA_SRC);
const CALL_BANS = ['worldClone(', 'structuredClone(', 'futureRouteEnumeration(', 'futureRouteDerivation(', 'resultEnumeration(', 'decide(', 'decideNext(', 'runProvider(', 'new Date(', 'performance.now(', 'Date.now', 'Math.random', 'teacherOutput(', 'factColumns('];
// teacherOutput etc. are stage0 gate KEYS (declarations); real calls are in CALL_BANS.
const LEGACY_IDS = ['BattleDecision', 'BattleRuntime', 'BattlePreview', 'Kernel_Module', 'BattleReport', 'MVU_Skill_Runtime', 'runProvider', 'decideNext', 'decide', 'worldClone', 'structuredClone', 'futureRoute', 'resultEnumeration'];
const ROLE_IDS = ['技能', '角色', '武魂', '魂技'];

block('load', () => {
  ok('vm provider mounted', !!BP && typeof BP.select === 'function' && typeof BP.evaluateVectors === 'function');
  ok('vm adapter mounted', !!PDA && typeof PDA.admit === 'function' && typeof PDA.project === 'function' && typeof PDA.classifyPath === 'function' && typeof PDA.registry === 'function' && typeof PDA.readMetrics === 'function' && typeof PDA.selfCheck === 'function' && typeof PDA.setDeferOverride === 'function' && typeof PDA.setPathProjectionOverride === 'function' && typeof PDA.clearOverride === 'function' && typeof PDA.computeLegalityContext === 'function');
  ok('adapter hash expected 76915ef0', sha256(PDA_SRC) === PDA_HASH_EXPECTED, sha256(PDA_SRC).slice(0, 16));
  ok('provider identity', BP.providerId === 'behavior-provider-v1' && BP.kind === 'CANDIDATE_ONLY' && BP.selectionScope === 'MECHANICAL_NEUTRAL_ONLY' && BP.contractRevision === 3);
  ok('provider selfCheck ok', BP.selfCheck().ok === true && BP.selfCheck().checks.contractRevisionFrozen === true);
  const reg = PDA.registry();
  ok('adapter role R9 only', reg.role === 'R9_CANDIDATE_UNREGISTERED' && reg.revision === 5 && PDA.contractRevision === 5);
  ok('adapter enrollment 581/40/91/621', reg.enrollment.contractSupportedPathCount === 581 && reg.enrollment.contractDeferredPathCount === 40 && reg.enrollment.contractOutOfBattlePathCount === 91 && reg.enrollment.contractTotalInBattlePathCount === 621);
  ok('adapter implementation layered 243/338/40/91/0', reg.implementation.implementationDirectProjection === 243 && reg.implementation.implementationPending === 338 && reg.implementation.implementationDeferred === 40 && reg.implementation.implementationOutOfBattleScope === 91 && reg.implementation.placeholderProjectionCount === 0 && reg.implementation.batch1PathCount === 106);
  ok('adapter no 581 implementation claim', reg.implementation.claimsDirectProjectionForAllSupported === false);
  ok('adapter mapping NOT_FROZEN_NOT_WIRED', reg.implementation.directFactToProviderColumnMapping === 'NOT_FROZEN_NOT_WIRED' && reg.semantics.directFactToProviderColumnMapping === 'NOT_FROZEN_NOT_WIRED' && reg.semantics.revision4SupersedeDeclared === true);
  ok('adapter counts closed', reg.counts.totalInBattlePathCount === 621 && reg.counts.supportedPathCount === 581 && reg.counts.deferredPathCount === 40 && reg.counts.deferredPathIdsCount === 40 && reg.counts.rejectedInputPathCount === 0 && reg.counts.outOfBattleScopePathCount === 91 && reg.counts.silentOmissionCount === 0);
  ok('adapter tiers 374/166/41', reg.supportedByTier.existingAdmitted === 374 && reg.supportedByTier.t0 === 166 && reg.supportedByTier.t1 === 41);
  ok('adapter deferred 40 unique', reg.deferredPathIds.length === 40 && new Set(reg.deferredPathIds).size === 40);
  ok('adapter statuses closed 27', Object.keys(reg.statusByPrototype).length === 27 && Object.values(reg.statusByPrototype).every(s => ['SUPPORTED', 'DEFERRED_EXPLICIT', 'OUT_OF_BATTLE_SCOPE'].indexOf(s) >= 0) && Object.values(reg.statusByPrototype).filter(s => s === 'SUPPORTED').length === 21);
  ok('adapter tierByPrototype closed', Object.keys(reg.tierByPrototype).length === 27 && Object.values(reg.tierByPrototype).every(t => ['EXISTING_ADMITTED', 'T0', 'T1', 'T2', 'NONE'].indexOf(t) >= 0) && reg.tierByPrototype['复制执行'] === 'T2' && reg.tierByPrototype['修炼增益'] === 'NONE');
  ok('adapter pendingCodes 4 + carrier', JSON.stringify(reg.implementation.pendingCodes) === JSON.stringify(['PENDING_CONDITIONAL_PROJECTION', 'PENDING_TRIGGER_PROJECTION', 'PENDING_DURATION_PROJECTION', 'PENDING_DIRECTION_PROJECTION']) && reg.implementation.carrierCode === 'UNSUPPORTED_CARRIER_REQUIRES_UNPACK');
  ok('adapter mechanicMetadataEntries declared', reg.implementation.mechanicMetadataEntries && reg.implementation.mechanicMetadataEntries.location === 'opportunityModifiers.mechanicMetadataEntries' && reg.implementation.mechanicMetadataEntries.sourceEffectId === true && reg.implementation.mechanicMetadataEntries.keys.length === 6 && Object.keys(reg.implementation.mechanicMetadataEntries.perPrototypeSubsets).length === 8);
  ok('adapter numericForms declared', typeof reg.implementation.numericForms['数值'] === 'string' && reg.implementation.numericForms['数值'].indexOf('PENDING_DIRECTION_PROJECTION') >= 0 && reg.implementation.numericForms['持续回合'].indexOf('PENDING_DURATION_PROJECTION') >= 0);
  ok('adapter batch1 5 / batch2 3 / pending 13', canon(reg.implementation.batch1Prototypes) === canon(BATCH1_PROTOS) && canon(reg.implementation.batch2Prototypes) === canon(BATCH2_PROTOS) && canon(reg.implementation.pendingPrototypes) === canon(PENDING13));
  ok('adapter batch2 path counts 137', reg.implementation.batch2PathCount === 137 && canon(reg.implementation.batch2PathCounts) === canon({ 状态施加: 55, 召唤生成: 19, 结算修正: 63 }), JSON.stringify(reg.implementation.batch2PathCounts));
  ok('adapter legality gate same', reg.legalityContext.timing === 'BEFORE_CANDIDATE_FREEZE' && reg.legalityContext.playerLocked === 'SAME_GATE' && reg.legalityContext.source === 'CURRENT_PUBLIC_STATE_ONLY');
});

block('static', () => {
  for (const entry of [['provider', BP_CODE], ['adapter', PDA_CODE]]) {
    for (const tok of CALL_BANS) ok('static no call ' + tok + ' in ' + entry[0], entry[1].indexOf(tok) < 0);
    const ids = identifiers(entry[1]);
    ok('static no legacy/direct/kernel ids in ' + entry[0], !LEGACY_IDS.some(t => ids.indexOf(t) >= 0));
    ok('static no skill-role ids in ' + entry[0], !ROLE_IDS.some(t => ids.indexOf(t) >= 0));
    ok('static no round/horizon/branch ids in ' + entry[0], ids.indexOf('round') < 0 && ids.indexOf('horizon') < 0 && ids.indexOf('branch') < 0);
  }
  ok('static declaration tokens are not real calls', BP_CODE.indexOf('Math.random') < 0 && PDA_CODE.indexOf('worldClone(') < 0 && PDA_CODE.indexOf('structuredClone(') < 0 && PDA_CODE.indexOf('futureRouteEnumeration(') < 0 && PDA_CODE.indexOf('futureRouteDerivation(') < 0 && PDA_CODE.indexOf('resultEnumeration(') < 0 && PDA_CODE.indexOf('factColumns(') < 0);
  ok('static provider input surface is keyed, not read-by-name', BP_CODE.indexOf('teacherOutput(') < 0 && BP_CODE.indexOf('precomputedHEPP(') < 0 && BP_CODE.indexOf('hiddenState(') < 0 && BP_CODE.indexOf('wallClock(') < 0);
});

block('selfcheck', () => {
  const scEmpty = PDA.selfCheck('');
  const fcaEmpty = scEmpty.checks.find(c => c.id === 'forbiddenCallsAbsent');
  ok('selfCheck empty is not self-checkable', scEmpty.sourceSelfCheckable === false);
  ok('selfCheck empty forbiddenCallsAbsent counted:false', !!fcaEmpty && fcaEmpty.counted === false && fcaEmpty.detail && fcaEmpty.detail.sourceScanned === false);
  ok('selfCheck empty must not be treated as a source pass', !(scEmpty.sourceSelfCheckable === true && fcaEmpty && fcaEmpty.counted === true));
  const scReal = PDA.selfCheck(PDA_SRC);
  ok('selfCheck real source is self-checkable', scReal.sourceSelfCheckable === true);
  ok('selfCheck real passed', scReal.passed === true, JSON.stringify(scReal.checks.filter(c => !c.passed).map(c => c.id)));
  const fcaReal = scReal.checks.find(c => c.id === 'forbiddenCallsAbsent');
  ok('selfCheck real forbiddenCallsAbsent counted:true passed', !!fcaReal && fcaReal.counted === true && fcaReal.passed === true);
  const en = scReal.checks.find(c => c.id === 'embeddedPathEnumeration');
  ok('selfCheck real enumeration 621/581/40/91/0', !!en && en.passed && en.detail.inBattle === 621 && en.detail.supported === 581 && en.detail.deferred === 40 && en.detail.outOfBattle === 91 && en.detail.rejected === 0, JSON.stringify(en && en.detail));
  for (const idc of ['registryShape', 'deferredPathCatalog', 'classifyAllDeferred', 'pathLevelLifting', 'liftRequiresProjection', 'liftProjectionNonZeroRequired', 'noFakeSupportWithoutPathId', 't0t1EveryPathSupported', 'pathExistenceValidation', 'tauntLegality', 'hiddenStateIgnored', 'playerLockedSameGate', 'noSilentZero', 'pendingNotSilent', 'noClaim581Implemented', 'enrollmentImplementationSeparated', 'strictSixFields', 'directFactRowsValidateAgainstDirectFactRowV1', 'factTypeEnumClosed', 'unitEnumClosed', 'revision4SupersedeDeclared', 'targetIdsNoSymbolicPlaceholder', 'multiRowKeyVocabularyFrozen', 'rowUniquenessBySourceEffectIdAndKey', 'negativeZeroNormalized', 'sourceContextRequired', 'mechanicMetadataClosed', 'pendingProjectionExplicit', 'bareCarrierUnpackCode', 'numericDualFormEnforced', 'idCharsetEnforced', 'lingwuOobClassification', 'formalLibraryBasisVerified', 'abUnionSemanticsEnforced', 'windowAdjustFieldRequired', 'grantPayloadProjected']) {
    const c = scReal.checks.find(x => x.id === idc);
    ok('selfCheck real ' + idc, !!c && c.passed === true && c.counted === true, JSON.stringify(c && c.detail));
  }
});

block('lift', () => {
  const LIFT_PATH = 'PPU1:IN_BATTLE:复制执行:复制类型:0';
  const rowFor = (factType, key, amount, unit) => ({ schemaVersion: 'DirectFactRowV1', factType, key, sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e:0', targetIds: ['enemy-1'], amount, unit, durationTurns: 0 });
  const liftProj = { directFacts: [rowFor('STATE_DELTA', '命中', 10, 'PERCENT')], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
  const zeroProj = { directFacts: [], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
  const legacyProj = { factColumns: ['HP_DELTA'], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
  const projCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['enemy-1'] };
  const def = PDA.classifyPath(LIFT_PATH);
  ok('lift default defer', def.status === 'DEFERRED_EXPLICIT' && def.contractStatus === 'DEFERRED_EXPLICIT' && def.implementationStatus === 'DEFERRED_EXPLICIT' && def.deferCode === 'DEFER_MECHANICS_PROJECTION' && def.tier === 'T2', JSON.stringify(def));
  expectThrow('lift without projection rejected', () => PDA.setDeferOverride(LIFT_PATH, null), 'PDA_DEFER_LIFT_PROJECTION_REQUIRED', true);
  expectThrow('legacy factColumns projection rejected', () => PDA.setPathProjectionOverride(LIFT_PATH, legacyProj), 'LIFT_PROJECTION_INVALID:LEGACY_COLUMN_FIELD_REJECTED', true);
  expectThrow('zero projection rejected', () => PDA.setPathProjectionOverride(LIFT_PATH, zeroProj), 'LIFT_PROJECTION_INVALID:LIFT_PROJECTION_NONZERO_REQUIRED', true);
  expectThrow('unknown path override rejected', () => PDA.setDeferOverride('PPU1:IN_BATTLE:伤害结算:目标:0', null), 'PDA_DEFER_OVERRIDE_UNKNOWN_PATH', true);
  expectThrow('invalid defer code rejected', () => PDA.setDeferOverride(LIFT_PATH, 'NOT_A_CODE'), 'PDA_DEFER_OVERRIDE_INVALID_CODE', true);
  const stored = PDA.setPathProjectionOverride(LIFT_PATH, liftProj);
  ok('lift projection stored', stored.ok === true && stored.cleared === false && canon(PDA.getPathProjectionOverride(LIFT_PATH)) === canon(liftProj), JSON.stringify(stored));
  const lifted = PDA.setDeferOverride(LIFT_PATH, null);
  ok('lift sentinel stored', lifted.ok === true && lifted.status === 'SUPPORTED' && lifted.deferCode === '', JSON.stringify(lifted));
  const cls = PDA.classifyPath(LIFT_PATH);
  ok('lifted path classifies SUPPORTED', cls.status === 'SUPPORTED' && cls.contractStatus === 'SUPPORTED' && cls.implementationStatus === 'LIFTED_WITH_PROJECTION' && cls.deferCode === '', JSON.stringify(cls));
  const proj = PDA.project({ 原型: '复制执行', 目标: '单体' }, projCtx, LIFT_PATH);
  ok('lifted path projects stored six fields', sixField(proj) && canon(proj) === canon(liftProj), JSON.stringify(proj));
  ok('lifted projection frozen no alias', deepFrozen(proj, new Set()) && !aliasesInput(proj, projCtx));
  const eff = PDA.project({ 原型: '复制执行', 目标: '单体' }, projCtx);
  ok('effect-level project still defers when not all lifted', eff.deferCode === 'DEFER_MECHANICS_PROJECTION' && canon(eff.unsupportedOutcomeKinds) === '["COPY_EXECUTION"]', JSON.stringify(eff));
  PDA.setPathProjectionOverride(LIFT_PATH, null);
  ok('projection deletion reverts lift', PDA.classifyPath(LIFT_PATH).status === 'DEFERRED_EXPLICIT');
  const copyPaths = PDA.registry().deferredPathIds.filter(x => x.indexOf('PPU1:IN_BATTLE:复制执行:') === 0);
  ok('copy execution deferred paths 22', copyPaths.length === 22);
  for (const p of copyPaths) { PDA.setPathProjectionOverride(p, liftProj); PDA.setDeferOverride(p, null); }
  const allLifted = PDA.project({ 原型: '复制执行', 目标: '单体' }, projCtx);
  ok('all-lifted effect-level refuses projection', canon(allLifted.unsupportedOutcomeKinds) === '["DEFER_LIFT_PROJECTION_REQUIRED"]', JSON.stringify(allLifted));
  for (const p of copyPaths) PDA.clearOverride(p);
  ok('all cleared back to default defer', copyPaths.every(p => { const c2 = PDA.classifyPath(p); return c2.status === 'DEFERRED_EXPLICIT' && c2.deferCode === 'DEFER_MECHANICS_PROJECTION'; }));
  const cleared = PDA.clearOverride(LIFT_PATH);
  ok('clearOverride restores default defer', cleared.ok === true && cleared.restored === true && PDA.getPathProjectionOverride(LIFT_PATH) === null, JSON.stringify(cleared));
});

// ---- adapter rev5 case/probe gates (implementation boundary, not contract gold) ----
function checkDirectFacts(tag, rows, gold, ctx, tgt) {
  ok(tag + ' rows gold canonical', canon(rows) === canon(gold), JSON.stringify(rows));
  ok(tag + ' rows ten keys', rows.every(r => canon(Object.keys(r).sort()) === canon(FACT_ROW_KEYS.slice().sort())));
  const uniq = rows.map(r => r.sourceEffectId + '\u0000' + r.key);
  ok(tag + ' rows (sourceEffectId,key) unique', new Set(uniq).size === rows.length);
  ok(tag + ' rows finite amounts', rows.every(r => Number.isFinite(r.amount)));
  ok(tag + ' rows no -0 amounts', rows.every(r => noNegZero(r.amount)));
  ok(tag + ' rows source ids from ctx', rows.every(r => r.sourceActionId === ctx.sourceActionId && r.sourceActorId === ctx.sourceActorId && r.sourceEffectId === ctx.sourceEffectId));
  ok(tag + ' rows target resolution', rows.every(r => canon(r.targetIds) === canon(tgt)), JSON.stringify(rows.map(r => r.targetIds)));
}
function targetOf(effect, ctx) {
  return effect['目标'] === '自身' ? [ctx.sourceActorId] : ctx.candidateTargetIds.slice();
}
function strictGold(c, adm, prj) {
  const id = c.caseId;
  const ctx = ctxOf(c);
  ok(id + ' admitted', adm.admitted === true, JSON.stringify(adm));
  ok(id + ' gold directFacts canonical', canon(prj.directFacts) === canon(c.expect.directFacts || []), JSON.stringify(prj.directFacts));
  if (c.expect.scheduledFacts !== undefined) {
    ok(id + ' gold scheduledFacts canonical', canon(prj.scheduledFacts) === canon(c.expect.scheduledFacts), JSON.stringify(prj.scheduledFacts));
  } else {
    // B leaves scheduledFacts undeclared on pos-t0-path-supported (minimal assertion
    // case); the module output must still be a well-formed grant/summon window row.
    ok(id + ' scheduledFacts well-formed', prj.scheduledFacts.every(s => s && typeof s === 'object' && typeof s.grantType === 'string' && ['SUMMON_WINDOW', 'FOLLOW_UP', 'WINDOW_ADJUST', 'SETTLEMENT_RATIO_ADJUST'].indexOf(s.grantType) >= 0), JSON.stringify(prj.scheduledFacts));
  }
  ok(id + ' gold legalityModifiers canonical', canon(prj.legalityModifiers) === canon(c.expect.legalityModifiers || {}), JSON.stringify(prj.legalityModifiers));
  ok(id + ' gold opportunityModifiers canonical', canon(prj.opportunityModifiers) === canon(c.expect.opportunityModifiers || {}), JSON.stringify(prj.opportunityModifiers));
  ok(id + ' gold unsupported + no defer', canon(prj.unsupportedOutcomeKinds) === canon(c.expect.unsupportedOutcomeKinds || []) && prj.deferCode === (c.expect.deferCode || ''), JSON.stringify(prj.unsupportedOutcomeKinds));
  checkDirectFacts(id, prj.directFacts, c.expect.directFacts || [], ctx, targetOf(c.effect, ctx));
  ok(id + ' six fields frozen no alias', sixField(prj) && deepFrozen(prj, new Set()) && !aliasesInput(prj, c.effect) && !aliasesInput(prj, ctx));
}
function gatePendingOrCarrier(c, adm, prj) {
  const id = c.caseId;
  const ctx = ctxOf(c);
  const expCodes = c.expect.unsupportedOutcomeKinds || [];
  const code = expCodes.length ? expCodes[0] : 'PENDING_DIRECT_PROJECTION';
  ok(id + ' admitted per contract', adm.admitted === true, JSON.stringify(adm));
  ok(id + ' explicit ' + code, adm.reasons.indexOf(code) >= 0, JSON.stringify(adm.reasons));
  ok(id + ' retained explicit', adm.retainedInCandidateAudit === true, JSON.stringify(adm));
  ok(id + ' zero contribution', prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
  ok(id + ' kind explicit', canon(prj.unsupportedOutcomeKinds) === canon(expCodes.length ? expCodes : ['PENDING_DIRECT_PROJECTION']) && prj.deferCode === (c.expect.deferCode || ''), JSON.stringify(prj.unsupportedOutcomeKinds));
  ok(id + ' not deferred', prj.deferCode === '', JSON.stringify(prj));
  if (c.expect.opportunityModifiers && Object.keys(c.expect.opportunityModifiers).length) {
    const goldOk = canon(prj.opportunityModifiers) === canon(c.expect.opportunityModifiers);
    const pendingOk = prj.unsupportedOutcomeKinds.length > 0 && canon(prj.opportunityModifiers) === '{}';
    ok(id + ' opportunityModifiers gold-or-pending', goldOk || pendingOk, JSON.stringify(prj.opportunityModifiers) + ' vs ' + JSON.stringify(c.expect.opportunityModifiers));
  } else {
    ok(id + ' no metadata when absent', canon(prj.opportunityModifiers) === '{}', JSON.stringify(prj.opportunityModifiers));
  }
  ok(id + ' six fields frozen no alias', sixField(prj) && deepFrozen(prj, new Set()) && !aliasesInput(prj, c.effect) && !aliasesInput(prj, ctx));
  if (c.pathId) {
    const cls = PDA.classifyPath(c.pathId);
    ok(id + ' path contract SUPPORTED pending impl', cls.status === 'SUPPORTED' && cls.contractStatus === 'SUPPORTED' && cls.implementationStatus === 'PENDING_DIRECT_PROJECTION', JSON.stringify(cls));
  }
}
function deferGate(c) {
  const id = c.caseId;
  const ctx = ctxOf(c);
  const adm = PDA.admit(c.effect, ctx);
  const prj = PDA.project(c.effect, ctx, c.pathId || undefined);
  ok(id + ' admitted retained', adm.admitted === true && adm.retainedInCandidateAudit === true, JSON.stringify(adm));
  ok(id + ' retain reasons', adm.reasons.indexOf('DEFERRED_CANDIDATE_RETAINED_WITH_REASON') >= 0 && adm.reasons.indexOf('PATH_DEFAULT_DEFER_LIFTABLE') >= 0, JSON.stringify(adm.reasons));
  ok(id + ' gold deferCode', prj.deferCode === c.expect.deferCode, JSON.stringify(prj));
  ok(id + ' gold unsupported kind', canon(prj.unsupportedOutcomeKinds) === canon(c.expect.unsupportedOutcomeKinds), JSON.stringify(prj.unsupportedOutcomeKinds));
  ok(id + ' zero contribution', prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
  if (c.expect.reasonCode) ok(id + ' contract reasonCode', adm.reasons.indexOf(c.expect.reasonCode) >= 0, JSON.stringify(adm.reasons));
  if (c.pathId) {
    const cls = PDA.classifyPath(c.pathId);
    ok(id + ' path classifies deferred liftable', cls.status === 'DEFERRED_EXPLICIT' && cls.implementationStatus === 'DEFERRED_EXPLICIT' && cls.deferCode === 'DEFER_MECHANICS_PROJECTION', JSON.stringify(cls));
  }
}
function negGate(c) {
  const id = c.caseId;
  const ctx = ctxOf(c);
  const adm = PDA.admit(c.effect, ctx);
  const prj = PDA.project(c.effect, ctx);
  if (c.expect.admitted === true) {
    const code = (c.expect.unsupportedOutcomeKinds || [])[0];
    ok(id + ' admitted retained', adm.admitted === true && adm.retainedInCandidateAudit === true, JSON.stringify(adm));
    ok(id + ' explicit ' + code, adm.reasons.indexOf(code) >= 0, JSON.stringify(adm.reasons));
    ok(id + ' zero contribution', prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
    ok(id + ' kind explicit', canon(prj.unsupportedOutcomeKinds) === canon(c.expect.unsupportedOutcomeKinds) && prj.deferCode === (c.expect.deferCode || ''), JSON.stringify(prj.unsupportedOutcomeKinds));
    ok(id + ' six fields frozen no alias', sixField(prj) && deepFrozen(prj, new Set()) && !aliasesInput(prj, c.effect) && !aliasesInput(prj, ctx));
    return;
  }
  ok(id + ' admitted false reason', adm.admitted === false && adm.reasons[0] === c.expect.reasonCode, JSON.stringify(adm));
  ok(id + ' project explicit reject', canon(prj.unsupportedOutcomeKinds) === canon([c.expect.reasonCode]) && prj.directFacts.length === 0 && prj.deferCode === '', JSON.stringify(prj));
}
function legalityGate(c) {
  const id = c.caseId;
  if (id === 'leg-taunt-before-freeze') {
    const ctx = Object.assign({}, c.context, { publicStates: { taunter: { 嘲讽: true } } });
    const adm = PDA.admit(c.effect, ctx);
    const prj = PDA.project(c.effect, ctx);
    ok(id + ' admitted with taunt reason', adm.admitted === true && adm.reasons.indexOf('TAUNT_CONSTRAINS_LEGAL_SET') >= 0, JSON.stringify(adm));
    const tm = prj.legalityModifiers && prj.legalityModifiers.taunt;
    ok(id + ' gold taunt modifier', !!tm && tm.state === '嘲讽' && tm.target === 'taunter', JSON.stringify(prj.legalityModifiers));
    ok(id + ' legal set not silently dropped', prj.directFacts.length === 1 && prj.directFacts[0].key === '嘲讽' && prj.directFacts[0].targetIds[0] === 'taunter' && canon(prj.unsupportedOutcomeKinds) === '[]', JSON.stringify(prj));
  } else if (id === 'leg-player-locked-same-gate') {
    const ctx = Object.assign({}, c.context, { publicStates: { taunter: { 嘲讽: true } }, playerLockedTargetId: 'other-enemy' });
    const adm = PDA.admit(c.effect, ctx);
    const prj = PDA.project(c.effect, ctx);
    ok(id + ' admitted false same gate', adm.admitted === false && adm.reasons[0] === 'PLAYER_LOCKED_TAUNT_LEGALITY', JSON.stringify(adm));
    ok(id + ' project rejects same gate', canon(prj.unsupportedOutcomeKinds) === '["PLAYER_LOCKED_TAUNT_LEGALITY"]' && prj.directFacts.length === 0, JSON.stringify(prj));
    const tm = prj.legalityModifiers && prj.legalityModifiers.taunt;
    ok(id + ' taunt modifier carried', !!tm && tm.target === 'taunter', JSON.stringify(prj.legalityModifiers));
  } else if (id === 'leg-interference-dependency') {
    const ctx = Object.assign({}, c.context, { interferenceRevision: 'rev-1' });
    const adm = PDA.admit(c.effect, ctx);
    const prj = PDA.project(c.effect, ctx);
    ok(id + ' admitted with dependency reason', adm.admitted === true && adm.reasons.indexOf('INTERFERENCE_ENTER_DEPENDENCY') >= 0, JSON.stringify(adm));
    ok(id + ' gold dependencyTokens', !!(prj.opportunityModifiers && prj.opportunityModifiers.dependencyTokens) && canon(prj.opportunityModifiers.dependencyTokens) === canon(c.expect.opportunityModifiers.dependencyTokens), JSON.stringify(prj.opportunityModifiers));
    ok(id + ' interferenceRates present', !!(prj.opportunityModifiers && prj.opportunityModifiers.interferenceRates) && prj.opportunityModifiers.interferenceRates.length === 1, JSON.stringify(prj.opportunityModifiers));
  }
}
const ANTI_POLICY = {
  'anti-whole-prototype-exclusion': { code: 'WHOLE_PROTOTYPE_EXCLUSION_FORBIDDEN', proto: '机制授予', token: null },
  'anti-silent-zero': { code: 'SILENT_ZERO_FORBIDDEN', proto: '复制执行', token: null },
  'anti-world-clone': { code: 'WORLD_CLONE_FORBIDDEN', proto: '伤害结算', token: 'worldClone(' },
  'anti-future-route': { code: 'FUTURE_ROUTE_DERIVATION_FORBIDDEN', proto: '决策干扰', token: 'futureRouteDerivation(' },
  'anti-hidden-state-read': { code: 'HIDDEN_STATE_READ_FORBIDDEN', proto: '判定修正', token: null },
  'anti-t0-unsupported': { code: 'T0_PATH_UNSUPPORTED_FORBIDDEN', proto: '机制授予', token: null },
  'anti-prototype-level-defer': { code: 'PROTOTYPE_LEVEL_DEFER_FORBIDDEN', proto: '时光回溯', token: null },
  'anti-result-enumeration': { code: 'RESULT_ENUMERATION_FORBIDDEN', proto: '决策干扰', token: 'resultEnumeration(' },
  'anti-silent-defer': { code: 'SILENT_DEFER_FORBIDDEN', proto: '复制执行', token: null },
};
function antiGate(c) {
  const id = c.caseId;
  const spec = ANTI_POLICY[id];
  const ctx = ctxOf(c);
  const adm = PDA.admit(c.effect, ctx);
  const prj = PDA.project(c.effect, ctx);
  ok(id + ' policy declared in F9', c.probe === 'CONTRACT_POLICY' && !!spec && c.expect.admitted === false && c.expect.reasonCode === spec.code, JSON.stringify(c.expect));
  ok(id + ' admit boolean documented', typeof adm.admitted === 'boolean', JSON.stringify(adm));
  if (spec.token) ok(id + ' forbidden call absent', PDA_CODE.indexOf(spec.token) < 0, spec.token);
  if (spec.proto === '复制执行') {
    ok(id + ' defer explicit not silent', prj.deferCode === 'DEFER_MECHANICS_PROJECTION' && canon(prj.unsupportedOutcomeKinds) === '["COPY_EXECUTION"]' && prj.directFacts.length === 0, JSON.stringify(prj));
  }
  if (spec.proto === '机制授予') {
    const cls = PDA.classifyPath('PPU1:IN_BATTLE:机制授予:目标:0');
    ok(id + ' prototype not excluded', PDA.registry().statusByPrototype['机制授予'] === 'SUPPORTED' && PDA.registry().tierByPrototype['机制授予'] === 'T0' && cls.implementationStatus === 'DIRECT_PROJECTION', JSON.stringify(cls));
  }
  if (id === 'anti-hidden-state-read') {
    const hidden = PDA.project(c.effect, Object.assign({}, ctx, { hiddenExactHp: 999, hiddenResistance: 7 }));
    ok(id + ' hidden keys ignored', canon(hidden) === canon(prj), JSON.stringify(hidden));
  }
  if (id === 'anti-prototype-level-defer') {
    const tw = PDA.registry().deferredPathIds.filter(p => p.indexOf(':时光回溯:') >= 0);
    ok(id + ' per-path defer not prototype-level', tw.length === 18 && tw.every(p => PDA.classifyPath(p).status === 'DEFERRED_EXPLICIT'), 'count=' + tw.length);
  }
}
function redProbe(p) {
  const id = p.probeId;
  const ctx = Object.assign({}, p.context, p.legalityContext || {});
  const adm = PDA.admit(p.effect, ctx);
  const prj = PDA.project(p.effect, ctx);
  if (id === 'probe-damage-amount') {
    ok(id + ' admitted', adm.admitted === true, JSON.stringify(adm));
    checkDirectFacts(id, prj.directFacts, p.expect.directFacts, ctx, targetOf(p.effect, ctx));
    ok(id + ' clean projection', canon(prj.unsupportedOutcomeKinds) === '[]' && prj.deferCode === '', JSON.stringify(prj));
  } else if (id === 'probe-illegal-option' || id === 'probe-damage-invalid-segments' || id === 'probe-state-secondary-invalid' || id === 'probe-window-settlement-ratio-with-extend' || id === 'probe-trigger-variant') {
    ok(id + ' rejected reason', adm.admitted === false && adm.reasons[0] === p.expect.reasonCode && p.expect.reasonCode === 'INVALID_OPTION_VALUE', JSON.stringify(adm));
    ok(id + ' project explicit reject', canon(prj.unsupportedOutcomeKinds) === '["INVALID_OPTION_VALUE"]' && prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
  } else if (id === 'probe-unknown-state' || id === 'probe-unknown-rule') {
    ok(id + ' rejected reason', adm.admitted === false && adm.reasons[0] === p.expect.reasonCode, JSON.stringify(adm));
    ok(id + ' project explicit reject', canon(prj.unsupportedOutcomeKinds) === canon([p.expect.reasonCode]) && prj.directFacts.length === 0, JSON.stringify(prj));
  } else if (id === 'probe-window-missing-field' || id === 'probe-grant-missing-usecount') {
    ok(id + ' rejected reason', adm.admitted === false && adm.reasons[0] === p.expect.reasonCode, JSON.stringify(adm));
    ok(id + ' project explicit reject', canon(prj.unsupportedOutcomeKinds) === canon([p.expect.reasonCode]) && prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
  } else if (id === 'probe-multi-taunt') {
    ok(id + ' ambiguous rejected', adm.admitted === false && adm.ambiguousTaunt === true && adm.reasons[0] === 'AMBIGUOUS_TAUNT_TARGET', JSON.stringify(adm));
    ok(id + ' project explicit reject', canon(prj.unsupportedOutcomeKinds) === '["AMBIGUOUS_TAUNT_TARGET"]' && prj.directFacts.length === 0, JSON.stringify(prj));
    const tm = prj.legalityModifiers && prj.legalityModifiers.taunt;
    ok(id + ' taunt modifier unpinned', !!tm && canon(tm.targetIds) === '["t1","t2"]', JSON.stringify(tm));
  } else if (id === 'probe-immutability') {
    ok(id + ' admitted', adm.admitted === true, JSON.stringify(adm));
    ok(id + ' frozen no alias gold', deepFrozen(prj, new Set()) && !aliasesInput(prj, p.effect) && !aliasesInput(prj, ctx) && canon(prj.unsupportedOutcomeKinds) === canon(p.expect.unsupportedOutcomeKinds || []) && prj.deferCode === (p.expect.deferCode || '') && canon(prj.directFacts) === canon(p.expect.directFacts || []), JSON.stringify(prj));
  } else if (id === 'probe-illegal-facttype') {
    const schema = JSON.parse(fs.readFileSync(path.join(RC6, 'contracts', 'DirectFactRowV1.schema.json'), 'utf8'));
    const vals = schema.properties && schema.properties.factType && (schema.properties.factType.enum || []);
    ok(id + ' schema rejects FAKE_TYPE', Array.isArray(vals) && vals.indexOf('FAKE_TYPE') < 0 && vals.indexOf('HP_DELTA') >= 0, JSON.stringify(vals));
    const fakeRow = { directFacts: [{ schemaVersion: 'DirectFactRowV1', factType: 'FAKE_TYPE', key: '', sourceActionId: 'a', sourceActorId: 'b', sourceEffectId: 'c', targetIds: ['e1'], amount: 1, unit: 'POWER', durationTurns: 0 }], legalityModifiers: {}, opportunityModifiers: {}, scheduledFacts: [], unsupportedOutcomeKinds: [], deferCode: '' };
    expectThrow(id + ' row validator rejects FAKE_TYPE', () => PDA.setPathProjectionOverride('PPU1:IN_BATTLE:复制执行:复制类型:0', fakeRow), 'LIFT_PROJECTION_INVALID:ROW_INVALID_FACT_TYPE');
    PDA.clearOverride('PPU1:IN_BATTLE:复制执行:复制类型:0');
  } else if (id === 'probe-numeric-string-rejected' || id === 'probe-delay-turn-rejected' || id === 'probe-interrupt-rejected' || id === 'probe-level-non-number') {
    const inject = {
      'probe-numeric-string-rejected': { 数值: '10' },
      'probe-delay-turn-rejected': { 延迟回合: 1 },
      'probe-interrupt-rejected': { 打断效果: true },
      'probe-level-non-number': { 对应等级: 'abc' },
    }[id];
    ok(id + ' contract rejectedField declared', typeof p.expect.rejectedField === 'string' && p.expect.rejectedField.length > 0 && p.expect.schemaRejected === true, JSON.stringify(p.expect));
    const badAdm = PDA.admit(Object.assign({}, p.effect, inject), ctx);
    ok(id + ' injected form rejected', badAdm.admitted === false && badAdm.reasons[0] === 'INVALID_OPTION_VALUE', JSON.stringify(badAdm));
    const badPrj = PDA.project(Object.assign({}, p.effect, inject), ctx);
    ok(id + ' injected project rejects', canon(badPrj.unsupportedOutcomeKinds) === '["INVALID_OPTION_VALUE"]' && badPrj.directFacts.length === 0, JSON.stringify(badPrj));
  } else if (id === 'probe-nested-payload-unprojectable') {
    ok(id + ' admitted retained', adm.admitted === true && adm.retainedInCandidateAudit === true && adm.reasons.indexOf(p.expect.reasonCode) >= 0, JSON.stringify(adm));
    ok(id + ' defer gold', prj.deferCode === p.expect.deferCode && canon(prj.unsupportedOutcomeKinds) === canon(p.expect.unsupportedOutcomeKinds) && prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
  } else if (id === 'probe-summon-nonpositive-count') {
    ok(id + ' rejected reason', adm.admitted === false && adm.reasons[0] === 'INVALID_OPTION_VALUE' && p.expect.reasonCode === 'INVALID_OPTION_VALUE', JSON.stringify(adm));
    ok(id + ' project explicit reject', canon(prj.unsupportedOutcomeKinds) === '["INVALID_OPTION_VALUE"]' && prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
  } else if (id === 'probe-settlement-double-count') {
    ok(id + ' admitted', adm.admitted === true, JSON.stringify(adm));
    checkDirectFacts(id, prj.directFacts, p.expect.directFacts, ctx, targetOf(p.effect, ctx));
    ok(id + ' no double count + clean', prj.directFacts.length === 1 && canon(prj.unsupportedOutcomeKinds) === '[]' && prj.deferCode === '', JSON.stringify(prj));
  } else if (id === 'probe-summon-missing-duration') {
    ok(id + ' admitted retained', adm.admitted === true && adm.retainedInCandidateAudit === true && adm.reasons.indexOf('PENDING_DURATION_PROJECTION') >= 0, JSON.stringify(adm));
    checkDirectFacts(id, prj.directFacts, p.expect.directFacts, ctx, targetOf(p.effect, ctx));
    ok(id + ' scheduled window kept', prj.scheduledFacts.length === 1 && prj.scheduledFacts[0].grantType === 'SUMMON_WINDOW', JSON.stringify(prj.scheduledFacts));
    ok(id + ' kind explicit', canon(prj.unsupportedOutcomeKinds) === canon(p.expect.unsupportedOutcomeKinds) && prj.deferCode === (p.expect.deferCode || ''), JSON.stringify(prj.unsupportedOutcomeKinds));
  } else {
    const code = (p.expect.unsupportedOutcomeKinds || [])[0];
    ok(id + ' contract gold declared', typeof code === 'string' && code.length > 0 && typeof p.expect.reasonCode === 'string' && p.expect.reasonCode.length > 0, JSON.stringify(p.expect));
    ok(id + ' admitted retained', adm.admitted === true && adm.retainedInCandidateAudit === true && adm.reasons.indexOf(code) >= 0, JSON.stringify(adm));
    ok(id + ' zero contribution', prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
    ok(id + ' kind explicit', canon(prj.unsupportedOutcomeKinds) === canon([code]) && prj.deferCode === (p.expect.deferCode || ''), JSON.stringify(prj.unsupportedOutcomeKinds));
  }
}

block('adapter-cases', () => {
ok('F9 rev5 85 cases', F9.revision === 5 && F9.cases.length === 85);
  ok('F9 24 redProbes', F9.redProbes.length === 24);
  const allCtx = F9.cases.concat(F9.redProbes);
  ok('all case.context explicit four keys', allCtx.every(x => { const c = x.context || {}; return typeof c.sourceActionId === 'string' && c.sourceActionId.length > 0 && typeof c.sourceActorId === 'string' && c.sourceActorId.length > 0 && typeof c.sourceEffectId === 'string' && c.sourceEffectId.length > 0 && Array.isArray(c.candidateTargetIds) && c.candidateTargetIds.length > 0; }));
  ok('partition matches registry', canon(BATCH1_PROTOS) === canon(PDA.registry().implementation.batch1Prototypes) && canon(PENDING13) === canon(PDA.registry().implementation.pendingPrototypes) && canon(BATCH2_PROTOS) === canon(PDA.registry().implementation.batch2Prototypes));
  ok('位移执行 pending not batch1', PENDING13.indexOf('位移执行') >= 0 && BATCH1_PROTOS.indexOf('位移执行') < 0 && BATCH2_PROTOS.indexOf('位移执行') < 0);
  const fsCtx = { sourceActionId: 'a:fs', sourceActorId: 'actor-1', sourceEffectId: 'e:fs', candidateTargetIds: ['fen-1'] };
  const fsCls = PDA.classifyPath('PPU1:IN_BATTLE:属性修正:目标:5');
  ok('fenshen attribute path classify DIRECT', fsCls.status === 'SUPPORTED' && fsCls.contractStatus === 'SUPPORTED' && fsCls.implementationStatus === 'DIRECT_PROJECTION' && fsCls.tier === 'EXISTING_ADMITTED', JSON.stringify(fsCls));
  const fsAdm = PDA.admit({ 原型: '属性修正', 目标: '分身', 属性: '力量', 数值: '+10%', 持续回合: 1 }, fsCtx);
  ok('fenshen attribute admit true', fsAdm.admitted === true, JSON.stringify(fsAdm));
  const fsPrj = PDA.project({ 原型: '属性修正', 目标: '分身', 属性: '力量', 数值: '+10%', 持续回合: 1 }, fsCtx);
  ok('fenshen attribute targetIds == candidateTargetIds', fsPrj.directFacts.length === 1 && canon(fsPrj.directFacts[0].targetIds) === canon(fsCtx.candidateTargetIds) && fsPrj.directFacts[0].key === '力量' && fsPrj.directFacts[0].amount === 10 && fsPrj.unsupportedOutcomeKinds.length === 0 && fsPrj.deferCode === '', JSON.stringify(fsPrj));
  const dmgFsAdm = PDA.admit({ 原型: '伤害结算', 目标: '分身', 威力倍率: 60, 伤害类型: '近身攻击' }, fsCtx);
  ok('fenshen damage still illegal admit', dmgFsAdm.admitted === false && dmgFsAdm.reasons[0] === 'INVALID_OPTION_VALUE', JSON.stringify(dmgFsAdm));
  ok('fenshen damage still illegal project', canon(PDA.project({ 原型: '伤害结算', 目标: '分身', 威力倍率: 60, 伤害类型: '近身攻击' }, fsCtx).unsupportedOutcomeKinds) === '["INVALID_OPTION_VALUE"]');
  const dmgFsCls = PDA.classifyPath('PPU1:IN_BATTLE:伤害结算:目标:5');
  ok('fenshen damage path unknown', dmgFsCls.status === 'REJECTED_INPUT' && dmgFsCls.reasonCode === 'UNKNOWN_PATH_ID', JSON.stringify(dmgFsCls));
  // 同根保护：完整分身允许集合恰为 资源变化/属性修正/判定修正/结算修正。
  const fsScan = { accepted: [], fieldGated: [], targetRejected: [], oob: [] };
  for (const p of Object.keys(PDA.registry().statusByPrototype)) {
    const a = PDA.admit({ 原型: p, 目标: '分身' }, fsCtx);
    if (a.admitted) fsScan.accepted.push(p);
    else if (a.reasons[0] === 'OUT_OF_BATTLE_SCOPE') fsScan.oob.push(p);
    else if (a.reasons[0] === 'INVALID_OPTION_VALUE') fsScan.targetRejected.push(p);
    else fsScan.fieldGated.push(p + ':' + a.reasons[0]);
  }
  const fsAllowed = [...fsScan.accepted, ...fsScan.fieldGated.map(x => x.split(':')[0])].sort();
  ok('fenshen allowed set exactly 4', canon(fsAllowed) === canon(['资源变化', '属性修正', '判定修正', '结算修正'].sort()), fsAllowed.join(','));
  ok('fenshen target-rejected closed 19', fsScan.targetRejected.length === 19 && fsScan.targetRejected.every(p => p !== '资源变化' && p !== '属性修正' && p !== '判定修正' && p !== '结算修正'), fsScan.targetRejected.join(','));
  ok('fenshen field-gated batch1 three + settlement', canon(fsScan.fieldGated) === canon(['资源变化:MISSING_REQUIRED_FIELD', '属性修正:MISSING_REQUIRED_FIELD', '判定修正:MISSING_REQUIRED_FIELD', '结算修正:MISSING_REQUIRED_FIELD']), fsScan.fieldGated.join(','));
  ok('fenshen OOB 4 untouched', fsScan.oob.length === 4 && canon(fsScan.oob) === canon(['修炼增益', '天赋提升', '永久属性提升', '战斗外复活']), fsScan.oob.join(','));
  const fsAdmRc = PDA.admit({ 原型: '资源变化', 目标: '分身', 资源: '魂力', 数值: '+10%' }, fsCtx);
  const fsAdmJm = PDA.admit({ 原型: '判定修正', 目标: '分身', 判定: '命中', 数值: '+10%', 持续回合: 1 }, fsCtx);
  ok('fenshen resource/judgment admit true', fsAdmRc.admitted === true && fsAdmJm.admitted === true, JSON.stringify([fsAdmRc, fsAdmJm]));
  const settleCls = PDA.classifyPath('PPU1:IN_BATTLE:结算修正:目标:5');
  ok('fenshen settlement classify DIRECT', settleCls.status === 'SUPPORTED' && settleCls.contractStatus === 'SUPPORTED' && settleCls.implementationStatus === 'DIRECT_PROJECTION', JSON.stringify(settleCls));
  const settleEmptyAdm = PDA.admit({ 原型: '结算修正', 目标: '分身' }, fsCtx);
  ok('fenshen settlement empty effect field-gated', settleEmptyAdm.admitted === false && settleEmptyAdm.reasons[0] === 'MISSING_REQUIRED_FIELD', JSON.stringify(settleEmptyAdm));
  const settleEmptyPrj = PDA.project({ 原型: '结算修正', 目标: '分身' }, fsCtx);
  ok('fenshen settlement empty effect zero contribution', settleEmptyPrj.directFacts.length === 0 && settleEmptyPrj.scheduledFacts.length === 0 && canon(settleEmptyPrj.unsupportedOutcomeKinds) === '["MISSING_REQUIRED_FIELD"]' && settleEmptyPrj.deferCode === '', JSON.stringify(settleEmptyPrj));
  const settleFullAdm = PDA.admit({ 原型: '结算修正', 目标: '分身', 结算: '造成伤害', 数值: '+10%', 持续回合: 1 }, fsCtx);
  ok('fenshen settlement full admit true', settleFullAdm.admitted === true, JSON.stringify(settleFullAdm));
  const settleFullPrj = PDA.project({ 原型: '结算修正', 目标: '分身', 结算: '造成伤害', 数值: '+10%', 持续回合: 1 }, fsCtx);
  ok('fenshen settlement full targetIds == candidateTargetIds', settleFullPrj.directFacts.length === 1 && canon(settleFullPrj.directFacts[0].targetIds) === canon(fsCtx.candidateTargetIds) && settleFullPrj.directFacts[0].key === 'settlement.primary' && settleFullPrj.directFacts[0].amount === 10 && settleFullPrj.directFacts[0].unit === 'PERCENT' && canon(settleFullPrj.unsupportedOutcomeKinds) === '[]' && settleFullPrj.deferCode === '', JSON.stringify(settleFullPrj));
  const shieldFsAdm = PDA.admit({ 原型: '护盾变化', 目标: '分身', 护盾模式: '正向护盾', 数值: '+20' }, fsCtx);
  ok('fenshen shield still illegal admit', shieldFsAdm.admitted === false && shieldFsAdm.reasons[0] === 'INVALID_OPTION_VALUE', JSON.stringify(shieldFsAdm));
  ok('fenshen shield still illegal project', canon(PDA.project({ 原型: '护盾变化', 目标: '分身' }, fsCtx).unsupportedOutcomeKinds) === '["INVALID_OPTION_VALUE"]');
  ok('fenshen shield/damage path unknown', PDA.classifyPath('PPU1:IN_BATTLE:护盾变化:目标:5').reasonCode === 'UNKNOWN_PATH_ID' && PDA.classifyPath('PPU1:IN_BATTLE:伤害结算:目标:5').reasonCode === 'UNKNOWN_PATH_ID');
  for (const c of F9.cases) {
    if (c.kind === 'POSITIVE') {
      const ctx = ctxOf(c);
      const adm = PDA.admit(c.effect, ctx);
      const prj = PDA.project(c.effect, ctx);
      if (prj.directFacts.length || prj.scheduledFacts.length || c.expect.legalityModifiers || c.expect.opportunityModifiers) strictGold(c, adm, prj);
      else gatePendingOrCarrier(c, adm, prj);
    }
    else if (c.kind === 'LEGALITY') legalityGate(c);
    else if (c.kind === 'DEFER') deferGate(c);
    else if (c.kind === 'NEGATIVE') negGate(c);
    else if (c.kind === 'BOUNDARY') {
      const ctx = ctxOf(c);
      const adm = PDA.admit(c.effect, ctx);
      const prj = PDA.project(c.effect, ctx);
      if (prj.directFacts.length || prj.scheduledFacts.length || c.expect.legalityModifiers || c.expect.opportunityModifiers) strictGold(c, adm, prj);
      else gatePendingOrCarrier(c, adm, prj);
    }
    else antiGate(c);
  }
  for (const p of F9.redProbes) redProbe(p);
});

block('universe', () => {
  // Registry/policy metadata gates only; never a claim of 581 business semantics.
  const universe = buildPrototypePathUniverse({ repoRoot: REPO_ROOT });
  ok('universe 27/23/4', universe.registrySummary.prototypeCount === 27 && universe.registrySummary.inBattlePrototypeCount === 23 && universe.registrySummary.outOfBattlePrototypeCount === 4);
  ok('universe 621/91/712', universe.partitions.IN_BATTLE.pathCount === 621 && universe.partitions.OUT_OF_BATTLE.pathCount === 91 && universe.partitions.totalPathCount === 712);
  ok('universe paths 712 unique', universe.paths.length === 712 && new Set(universe.paths.map(x => x.pathId)).size === 712);
  const uniByProto = {};
  for (const p of universe.paths) uniByProto[p.prototype] = (uniByProto[p.prototype] || 0) + 1;
  ok('universe per-proto counts 27', Object.keys(uniByProto).length === 27);
  const reg = PDA.registry();
  ok('universe in-battle counts == registry', Object.entries(reg.pathCountByPrototype).every(([proto, n]) => uniByProto[proto] === n), JSON.stringify(Object.entries(reg.pathCountByPrototype).filter(([p, n]) => uniByProto[p] !== n).slice(0, 3)));
  ok('universe out-of-battle 20/13/14/44', uniByProto['修炼增益'] === 20 && uniByProto['天赋提升'] === 13 && uniByProto['永久属性提升'] === 14 && uniByProto['战斗外复活'] === 44);
  const uniDef = universe.paths.filter(x => x.scope === 'IN_BATTLE' && (x.prototype === '复制执行' || x.prototype === '时光回溯')).map(x => x.pathId).sort();
  ok('universe deferred 40', uniDef.length === 40 && new Set(uniDef).size === 40);
  const sorted = a => JSON.stringify(a.slice().sort());
  ok('deferred registry == universe', sorted(reg.deferredPathIds) === sorted(uniDef));
  ok('deferred F9 == universe', sorted([...F9.deferredPathIds]) === sorted(uniDef));
  ok('deferred F7 == universe', sorted(F7.deferredPaths.map(d => d.pathId)) === sorted(uniDef));
  ok('deferred F6 == universe', sorted([...F6.mechanicPathEnrollment.deferredPathIds]) === sorted(uniDef));
  ok('deferred codes all default', F7.deferredPaths.every(d => d.deferCode === 'DEFER_MECHANICS_PROJECTION'));
  const m0 = PDA.readMetrics();
  const counts = { supported: 0, deferred: 0, outOfBattle: 0, rejected: 0, unknownPath: 0, unknownProto: 0 };
  for (const p of universe.paths) {
    const v = PDA.classifyPath(p.pathId);
    if (v.status === 'SUPPORTED') counts.supported += 1;
    else if (v.status === 'DEFERRED_EXPLICIT') counts.deferred += 1;
    else if (v.status === 'OUT_OF_BATTLE_SCOPE') counts.outOfBattle += 1;
    else { counts.rejected += 1; if (v.reasonCode === 'UNKNOWN_PATH_ID') counts.unknownPath += 1; if (v.reasonCode === 'UNKNOWN_PROTOTYPE_REJECTED') counts.unknownProto += 1; }
  }
  ok('classify enumeration 581/40/91/0', counts.supported === 581 && counts.deferred === 40 && counts.outOfBattle === 91 && counts.rejected === 0, JSON.stringify(counts));
  ok('no UNKNOWN_PATH_ID on any universe path', counts.unknownPath === 0 && counts.unknownProto === 0);
  const dm = delta(m0, PDA.readMetrics());
  ok('classifyPathCalls delta 712', dm.classifyPathCalls === 712, JSON.stringify(dm));
  for (const [pid, code] of [['PPU1:IN_BATTLE:伤害结算:不存在的字段:0', 'UNKNOWN_PATH_ID'], ['PPU1:IN_BATTLE:伤害结算:目标:7', 'UNKNOWN_PATH_ID'], ['PPU1:IN_BATTLE:未知原型:目标:0', 'UNKNOWN_PROTOTYPE_REJECTED'], ['PPU1:IN_BATTLE:修炼增益:目标:0', 'UNKNOWN_PATH_ID'], ['bogus-path-id', 'MALFORMED_PATH_ID']]) {
    const v = PDA.classifyPath(pid);
    ok('classify negative ' + code, v.status === 'REJECTED_INPUT' && v.reasonCode === code, JSON.stringify(v));
  }
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
});

block('ops', () => {
  const base = { publicBelief: { belief_prior_strength: 0.5, confidence: 0.5, uncertainty_width: 0.5 }, battleIntentAndObjectives: { mode: 'raid' } };
  probeFatal('ops C=0 NO_LEGAL_CANDIDATES', { frozenCandidates: [] }, 'NO_LEGAL_CANDIDATES');
  const one = { candidateId: 'c1', actionKind: 'strike', targetSet: ['e1'], paymentMode: 'FULL', mechanical: { visibleHpRatios: [0.7], actorStatus: 'NORMAL', objectiveContribution: 0.7, immediateBranchValues: [0.7, 0.7], declaredEffectLow: 0, declaredEffectHigh: 1, revealStrength: 1, resourceRatios: [0.7], declaredOverkill: 0, legalityFlags: [], targetCount: 1, paymentMode: 'FULL' } };
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

block('adapter-metrics', () => {
  const m0 = PDA.readMetrics();
  let nAdmit = 0;
  let nProject = 0;
  let nClassify = 0;
  const baseCtx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e', candidateTargetIds: ['e1'] };
  for (let i = 0; i < 3; i += 1) { PDA.admit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, baseCtx); nAdmit += 1; }
  for (let i = 0; i < 2; i += 1) { PDA.project({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, baseCtx); nProject += 1; }
  PDA.classifyPath('PPU1:IN_BATTLE:伤害结算:目标:0'); nClassify += 1;
  PDA.admit({ 原型: '未知原型' }, baseCtx); nAdmit += 1;
  PDA.project({ 原型: '复制执行', 目标: '单体' }, baseCtx); nProject += 1;
  PDA.admit({ 原型: '修炼增益' }, baseCtx); nAdmit += 1;
  const d = delta(m0, PDA.readMetrics());
  ok('adapter admitCalls exact', d.admitCalls === nAdmit, JSON.stringify(d));
  ok('adapter projectCalls exact', d.projectCalls === nProject, JSON.stringify(d));
  ok('adapter classifyPathCalls exact', d.classifyPathCalls === nClassify, JSON.stringify(d));
  ok('adapter directProjectionCount exact', d.directProjectionCount === 2, JSON.stringify(d));
  ok('adapter reject counters exact', d.unknownPrototypeRejectCount === 1 && d.outOfBattleRejectCount === 1 && d.deferProjectCount === 1, JSON.stringify(d));
  ok('adapter vm poison zero', vmPoisonCount === 0);
});

// ---- entry ID gates: C0/DEL/513/symbolic targets reject INVALID_OPTION_VALUE at the
// admit/project entry, CJK ids pass, and public output never leaks the internal
// row-validation failure code (INTERNAL_ROW_VALIDATION_FAILED is designed unreachable
// from public input; verified on every public output below).
block('id-gates', () => {
  const eff = { 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' };
  const C0 = String.fromCharCode(0);
  const DEL = String.fromCharCode(127);
  const long513 = 'x'.repeat(513);
  const leakFree = v => JSON.stringify(v).indexOf('INTERNAL_ROW_VALIDATION_FAILED') < 0;
  const idBad = [
    ['C0 action', { sourceActionId: 'a' + C0 + 'b' }],
    ['DEL action', { sourceActionId: 'a' + DEL + 'b' }],
    ['513 action', { sourceActionId: long513 }],
    ['C0 effect', { sourceEffectId: 'e' + C0 }],
    ['DEL actor', { sourceActorId: 'x' + DEL }],
    ['513 target', { candidateTargetIds: [long513] }],
  ];
  for (const [tag, mut] of idBad) {
    const ctx = Object.assign({ sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e:0', candidateTargetIds: ['enemy-1'] }, mut);
    const adm = PDA.admit(eff, ctx);
    const prj = PDA.project(eff, ctx);
    ok('id-gate ' + tag + ' reject', adm.admitted === false && adm.reasons[0] === 'INVALID_OPTION_VALUE', JSON.stringify(adm));
    ok('id-gate ' + tag + ' project reject', canon(prj.unsupportedOutcomeKinds) === '["INVALID_OPTION_VALUE"]' && prj.directFacts.length === 0 && prj.scheduledFacts.length === 0, JSON.stringify(prj));
    ok('id-gate ' + tag + ' no internal leak', leakFree(adm) && leakFree(prj), JSON.stringify(adm));
  }
  for (const sym of ['自身', '单体', '群体', '全场', '召唤物', '目标', 'target', 'actor', 'self', 'all', 'any']) {
    const ctx = { sourceActionId: 'a', sourceActorId: 'actor-1', sourceEffectId: 'e:0', candidateTargetIds: [sym] };
    const adm = PDA.admit(eff, ctx);
    ok('id-gate symbol target ' + sym, adm.admitted === false && adm.reasons[0] === 'INVALID_OPTION_VALUE', JSON.stringify(adm));
    ok('id-gate symbol ' + sym + ' no internal leak', leakFree(adm));
  }
  const cjkCtx = { sourceActionId: '行动:龙啸九天', sourceActorId: '唐三', sourceEffectId: '效果:龙啸九天:0', candidateTargetIds: ['武魂殿护法'] };
  const cjkAdm = PDA.admit(eff, cjkCtx);
  const cjkPrj = PDA.project(eff, cjkCtx);
  ok('id-gate CJK admit passes', cjkAdm.admitted === true && cjkAdm.reasons.length === 0, JSON.stringify(cjkAdm));
  ok('id-gate CJK direct rows verbatim', cjkPrj.directFacts.length === 1 && cjkPrj.directFacts[0].sourceActionId === cjkCtx.sourceActionId && cjkPrj.directFacts[0].sourceActorId === cjkCtx.sourceActorId && cjkPrj.directFacts[0].sourceEffectId === cjkCtx.sourceEffectId && canon(cjkPrj.directFacts[0].targetIds) === canon(cjkCtx.candidateTargetIds), JSON.stringify(cjkPrj.directFacts));
  ok('id-gate CJK output no internal leak', leakFree(cjkAdm) && leakFree(cjkPrj));
});

// ---- lightweight real-candidate guard: manual duel first opportunity, CANDIDATES_ONLY only.
// Decision shared API (prepareDecisionRequest/enumerateCandidates) is mounted in an isolated
// sandbox; no Runtime/Report/Kernel/teacher/route and no full battle is ever invoked.
block('candidate-guard', () => {
  const guardSandbox = {
    console, Buffer, TextDecoder, TextEncoder, JSON, Math, Date,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Object, Array, String, Number, Boolean, Error, TypeError, Map, Set, WeakMap, WeakSet,
    Symbol, Reflect, Promise, Intl, URL, URLSearchParams, parseInt, parseFloat, isNaN, isFinite,
    Function, eval,
    structuredClone: typeof structuredClone === 'function' ? structuredClone : v => JSON.parse(JSON.stringify(v)),
    performance: { now: () => 0 },
    process: { env: {} },
  };
  guardSandbox.window = guardSandbox;
  guardSandbox.globalThis = guardSandbox;
  guardSandbox.self = guardSandbox;
  vm.createContext(guardSandbox);
  let guardErr = null;
  try {
    for (const f of ['LibraryData_Runtime.js', 'CharacterLibrary.js', 'MVU_Skill_Runtime.js', 'BattlePreview_Module.js', 'BattleDecision_Module.js']) {
      vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), guardSandbox, { filename: f });
    }
  } catch (e) { guardErr = String((e && e.message) || e); }
  ok('guard battle modules load', guardErr === null, 'err=' + guardErr);
  if (guardErr === null) {
    ok('guard no Runtime/Report/Provider loaded', guardSandbox.__LWCS_BATTLE_RUNTIME__ === undefined && guardSandbox.__LWCS_BATTLE_REPORT__ === undefined && guardSandbox.__LWCS_BEHAVIOR_PROVIDER__ === undefined);
    const decision = guardSandbox.__LWCS_BATTLE_DECISION__;
    ok('guard decision shared API mounted', !!decision && typeof decision.prepareDecisionRequest === 'function' && typeof decision.enumerateCandidates === 'function');
    let def = null;
    try {
      def = buildManualCases(guardSandbox.__LWCS_内置角色库__, guardSandbox.__LWCS_GET_BASE_STATS__).find(c => c.caseId === 'duel_overmatch_lethal');
    } catch (e) { def = null; }
    ok('guard manual duel present', !!def);
    if (def) {
      const world = def.combatData;
      const actorId = String((world && world.参战者 && world.参战者.team_player && world.参战者.team_player[0] && world.参战者.team_player[0].id) || '').trim();
      ok('guard duel actor CJK', actorId.length > 0 && /[一-鿿]/.test(actorId), actorId);
      const req = decision.prepareDecisionRequest({
        worldSnapshot: world,
        actorId,
        objectiveContract: world.胜负条件,
        battleIntent: { mode: def.intent, objectives: world.胜负条件 },
        actionOpportunity: { opportunityId: 'guard:duel:1', ownerId: actorId, role: 'ACTIVE', grantType: 'NATURAL_ACTION', sequence: 1, round: 1, status: 'PENDING' },
        seed: def.seed,
        analysisDepth: 'CANDIDATES_ONLY',
      });
      ok('guard frozenCandidates nonempty', Array.isArray(req.frozenCandidates) && req.frozenCandidates.length > 0, String(req.frozenCandidates && req.frozenCandidates.length));
      ok('guard candidateIds CJK', (req.frozenCandidates || []).length > 0 && (req.frozenCandidates || []).every(fc => /[一-鿿]/.test(String((fc && fc.candidateId) || ''))), JSON.stringify((req.frozenCandidates || []).slice(0, 2).map(fc => fc.candidateId)));
      const fc = req.frozenCandidates[0];
      const tgt = (fc.declaration && fc.declaration.targetIds) || [];
      const ctx = {
        sourceActionId: (fc.declaration && fc.declaration.actionId) || fc.candidateId,
        sourceActorId: (fc.declaration && fc.declaration.actorId) || actorId,
        sourceEffectId: ((fc.declaration && fc.declaration.actionId) || fc.candidateId) + ':0',
        candidateTargetIds: tgt,
      };
      ok('guard targetSet from declaration', Array.isArray(tgt) && tgt.length > 0, JSON.stringify(tgt));
      const dmgAdm = PDA.admit({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, ctx);
      ok('guard damage admitted not all-rejected', dmgAdm.admitted === true && dmgAdm.reasons.length === 0, JSON.stringify(dmgAdm));
      const dmgPrj = PDA.project({ 原型: '伤害结算', 目标: '单体', 威力倍率: 60, 伤害类型: '近身攻击' }, ctx);
      ok('guard damage DIRECT > 0', dmgPrj.directFacts.length > 0 && dmgPrj.directFacts.every(r => r.sourceActorId === ctx.sourceActorId && r.sourceEffectId === ctx.sourceEffectId), JSON.stringify(dmgPrj.directFacts));
      const jdgAdm = PDA.admit({ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%', 持续回合: 1 }, ctx);
      ok('guard judgment admitted', jdgAdm.admitted === true, JSON.stringify(jdgAdm));
      const jdgPrj = PDA.project({ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%', 持续回合: 1 }, ctx);
      ok('guard judgment DIRECT > 0', jdgPrj.directFacts.length > 0 && jdgPrj.directFacts[0].key === '命中' && jdgPrj.directFacts[0].amount === 10, JSON.stringify(jdgPrj.directFacts));
      const metaPrj = PDA.project({ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 120, 伤害类型: '精神攻击', 攻击段数: 1, 防御穿透: 20, 结算标签: '标准伤害', 抗性类型: '精神抗性', 对应等级: 89 }, ctx);
      const metaEntries = metaPrj.opportunityModifiers && metaPrj.opportunityModifiers.mechanicMetadataEntries;
      const meta = Array.isArray(metaEntries) && metaEntries.length === 1 ? metaEntries[0] : null;
      ok('guard formal metadata projected', !!meta && meta.sourceEffectId === ctx.sourceEffectId && meta['结算标签'] === '标准伤害' && meta['抗性类型'] === '精神抗性' && meta['对应等级'] === 89, JSON.stringify(metaEntries));
      ok('guard metadata CJK verbatim', !!meta && meta['生效方式'] === '独立生效', JSON.stringify(metaEntries));
    }
  }
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

const moduleHashes = {
  BehaviorProvider_Module: sha256(BP_SRC),
  BehaviorPrototypeAdapter_Module: sha256(PDA_SRC),
};
const lineCount = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').length;
const summary = {
  schemaVersion: 'M2ProviderCoreV2',
  status: failed ? 'FAILED' : 'PASSED',
  moduleHashes,
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
process.stdout.write('M2PROVIDERCORE ' + JSON.stringify(summary) + '\n');
process.exitCode = failed ? 1 : 0;

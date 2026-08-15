// run-m2-v31-pairability.mjs
// M2 pairability audit (candidate C). Read-only: never writes, stages or commits.
// Pins: PDA rev5, BIF input rev6/output rev4, Bridge rev2. One file only.
//
// Item definition (current real totals; no forced 56):
//   opportunity = first NATURAL_ACTION of the first team player, round 1 sequence 1,
//                 one per fixed case (7 cases).
//   PDA item    = one official effect from a RELEASE_SKILL candidate declaration
//                 skill._效果数组 (the only place CANDIDATES_ONLY prep exposes real
//                 effect objects). BASIC_ATTACK/DEFEND/EVADE/PASS candidates carry no
//                 official effect object -> counted as NO_OFFICIAL_EFFECT with the
//                 upstream materialization responsibility named.
//   BIF item    = one candidate compiled with the official facts bridge below.
//
// Official bridge flow (the frozen BehaviorCandidateFeatureBridgeV1 module is the only
// repacker; this harness never rebuilds BIF input by hand):
//   frozenCandidate/visibleWorld/contributions/pdaProjections/declaration are composed
//   from prepareDecisionRequest CANDIDATES_ONLY + previewAction + PDA admit/project;
//   bridgeCandidates() produces bifInput (production subset) per candidate; the harness
//   only passes that bifInput to BIF.compileCandidate. No harness-made paymentMode, no
//   scheduledFacts repack, no mechanicMetadata merge, no private verbatim/documented
//   attempts: PDA mechanically-legal pending/deferred effects are never counted as
//   REJECT (Bridge keeps pdaPending/pdaDeferred separate), resource PERCENT rows must
//   compile, Bridge totals must conserve, no-official-effect is recorded explicitly.
//
// Forbidden: R8 selection, old shadow, future-route, raid sources, performance timing.
// Metadata / projectionFamilies are never stripped. Deterministic; two runs must agree.
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildManualCases } from "../../battle_r63_manual_cases.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const BASE_HEAD = 'ef584bbc5a9f0a57f95f861066a413e182e966af';
const HASH_ALGORITHM = 'SHA256_UTF8_LF';
const BASE_FILES = {
  'LibraryData_Runtime.js': 'ab7e6dae9fbbe6cbe6c6df39a3b6fc3866511ccbc6b65aaa61de59f961f75c85',
  'CharacterLibrary.js': 'dffa678f8984cbbdad8e24ceb3adefc2178c5c49b2f6299f91f3af509ab66cce',
  'MVU_Skill_Runtime.js': '91b7700abeab5d017fdc5767a0ed72de568ea7abc0f495a6f7771b60783577de',
  'BattlePreview_Module.js': '77e549c459f0397672433cdde429cf5115b3eaba4e6c8b5e6a21c9fec97c2b87',
  'BattleDecision_Module.js': 'f999e398d3fde5b0dc47205859e23e1dea48fa22f41c7d2efb023661ebae31f6',
};

const PDA_HASH_EXPECTED = '6924daa535b98e369da67b924bcd0a4e957ed6bf4ca2a9bc9aaa2184c6886c70';
const BIF_HASH_EXPECTED = '8add454b2197c8bf5be825c5584ade4369343c6eb62cac391f51cdd1bfd2cb6c';
const BRIDGE_HASH_EXPECTED = 'f8a1d66201d7cd60d7c82a8a0440bc61d0de3d150bc61c57e94641e7be092c00';
const CONTRACT_PINS = {
  'tools/rc6/contracts/PrototypeDirectAdapterV1.json': '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
  'tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json': '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
  'tools/rc6/cases/PrototypeDirectAdapterCasesV1.json': 'f8a4c4e002d63718a112987f1cb8c9b1c6baa7a3438a81ea348d7f8e39e43c2d',
  'tools/rc6/contracts/BehaviorImmediateFeatureV1.json': '6c781ddbd2a970b25193743f9d5a26a527b4b041824485abf2e8958880c641f5',
  'tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json': '686e41a085ae83a3b04bca1deea61f5a063fa75fdb52805fd3bfe927587f7937',
  'tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json': '7b98b599214824632181dca252f58700603876d4425f8fa7c7cb3cb351a9bea0',
  'tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.json': 'a84f43bd6179f1de529700175a75ba5bdf755d51c86e899b96f81c66b5ee125c',
  'tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.schema.json': '11e9a0656ae589dcaa1a49a425f3d934082af2bd4c6d300d901cc1300a74dc0a',
};
const CONTRACT_REVISION_EXPECTED = {
  'tools/rc6/contracts/PrototypeDirectAdapterV1.json': 5,
  'tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json': 5,
  'tools/rc6/cases/PrototypeDirectAdapterCasesV1.json': 5,
  'tools/rc6/contracts/BehaviorImmediateFeatureV1.json': 6,
  'tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json': 4,
  'tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json': 9,
  'tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.json': 2,
  'tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.schema.json': 2,
};

// 7 fixed non-raid sources. Coverage: 属性修正 only exists in team_resource_support;
// 召唤生成 in summon_one_window; 结算修正 in team_control_overlap / charge_interrupt /
// protect_critical_ally; damage/judgment/state spread over the rest. First opportunity
// of each case is the audit unit.
const CASE_IDS = [
  'team_resource_support',
  'summon_one_window',
  'team_control_overlap',
  'duel_charge_interrupt_safer',
  'duel_peer_unknown_probe',
  'team_heal_crisis',
  'team_protect_critical_ally',
];
const CASE_RATIONALE = {
  team_resource_support: 'only non-raid source with 属性修正 (also 判定修正/时窗修正/资源变化)',
  summon_one_window: 'named summon-window case: 召唤生成 + 状态施加',
  team_control_overlap: 'control-overlap case: 结算修正 x4 + 判定修正',
  duel_charge_interrupt_safer: 'charge/interrupt duel: 伤害结算 + 状态施加 + 判定修正 + 结算修正',
  duel_peer_unknown_probe: 'unknown-enemy probe: 伤害结算 + 判定修正 + 召唤生成 + 状态施加',
  team_heal_crisis: 'heal crisis: 资源变化 + 状态施加 + 状态移除',
  team_protect_critical_ally: 'widest team case (18 candidates): damage/state/judgment/settlement breadth',
};
// sha256(JSON.stringify({caseId, seed, combatData})) of the built fixture (asserted below).
const FIXTURE_HASHES = {
  team_resource_support: '629bc3d681fbaeecf9d91e1cba5cf0775be18e0b3a05d7e7e55604de11e5aae1',
  summon_one_window: 'c0e596a5d291dda480520348d788fe2fa039aeba9729fd3434d5673cd8ff6b08',
  team_control_overlap: '5e740a8f8805f24073a33210544c6928b81594376fed854210bfc8526648a51a',
  duel_charge_interrupt_safer: 'c8084485e4e2c0d3821171f346036c7e635cee84b469316bffb0be9d7eea5371',
  duel_peer_unknown_probe: '3ff07d3be7c6f02e17bde9ba0b5565867aa05c09eb2dcf284dec15b1e76e2de2',
  team_heal_crisis: '3f6839d07d4d926f60bce1e2ea5e9557d11987e82d59f2d42651429a26fb1c10',
  team_protect_critical_ally: '4c1c187926d2bb13b3c4c24f11b6c361bb9ed8764d2ef22b60e0d427998f5909',
};

let passed = 0;
let failed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) passed += 1;
  else { failed += 1; failures.push(name + (detail ? " | " + detail : "")); }
}
const sha256 = v => crypto.createHash("sha256").update(v).digest("hex");
const normalizeLf = v => String(v).replace(/\r\n?/g, "\n");
const sha256Utf8Lf = v => crypto.createHash("sha256").update(Buffer.from(normalizeLf(v), "utf8")).digest("hex");
const baseTexts = Object.create(null);
const baseWorktreeHashes = Object.create(null);
const baseReadErrors = [];
for (const [file, expected] of Object.entries(BASE_FILES)) {
  try {
    const text = execFileSync('git', ['show', `${BASE_HEAD}:${file}`], {
      cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    baseTexts[file] = text;
    ok('base blob ' + file, sha256Utf8Lf(text) === expected, sha256Utf8Lf(text));
  } catch (e) {
    baseReadErrors.push(file + ': ' + String((e && e.message) || e));
  }
  try {
    baseWorktreeHashes[file] = sha256Utf8Lf(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
  } catch (e) {
    baseWorktreeHashes[file] = 'MISSING';
  }
}
ok('fixed base blobs readable', baseReadErrors.length === 0, baseReadErrors.join('; '));
function readMechanicalSource(file) {
  if (Object.prototype.hasOwnProperty.call(BASE_FILES, file)) {
    if (typeof baseTexts[file] !== 'string') throw new Error('BASE_BLOB_MISSING:' + file);
    return baseTexts[file];
  }
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}
const pinnedDocs = Object.create(null);
for (const [file, expected] of Object.entries(CONTRACT_PINS)) {
  let text = null;
  try { text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'); } catch (e) { /* asserted below */ }
  ok('pin exists ' + file, text !== null);
  if (text === null) continue;
  ok('pin hash ' + file, sha256Utf8Lf(text) === expected, sha256Utf8Lf(text));
  try { pinnedDocs[file] = JSON.parse(text); } catch (e) { ok('pin JSON ' + file, false, String(e.message || e)); }
}
for (const [file, expected] of Object.entries(CONTRACT_REVISION_EXPECTED)) {
  const doc = pinnedDocs[file];
  let actual;
  if (doc && file.endsWith('.schema.json')) {
    actual = file.indexOf('BehaviorCandidateFeatureBridgeV1.schema.json') >= 0
      ? doc.properties && doc.properties.revision && doc.properties.revision.const
      : doc.revision && doc.revision.const !== undefined ? doc.revision.const : doc.revision;
  } else if (doc) actual = doc.revision;
  ok('revision ' + file, actual === expected, 'got ' + actual + ' want ' + expected);
}
const MECHANICAL_FILES = [
  'LibraryData_Runtime.js', 'CharacterLibrary.js', 'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js', 'BattleDecision_Module.js', 'BehaviorPrototypeAdapter_Module.js',
  'BehaviorImmediateFeature_Module.js', 'BehaviorCandidateFeatureBridge_Module.js',
];
const FORBIDDEN_LOAD_FILES = [
  'BattleDecisionR9v2Kernel_Module.js', 'BattleRuntime_Module.js', 'BattleReport_Module.js',
  'BattleUI_Module.js', 'BehaviorRelationalFeatureSource_Module.js',
];
ok('load list excludes forbidden modules', FORBIDDEN_LOAD_FILES.every(f => MECHANICAL_FILES.indexOf(f) < 0));
const canon = v => JSON.stringify(sortKeys(v));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  if (typeof v === "number" && Object.is(v, -0)) return 0;
  return v;
}
function expectThrow(tag, fn, code) {
  let msg = null;
  try { fn(); } catch (e) { msg = String((e && (e.code || e.reasonCode || e.message)) || e); }
  ok(tag, msg !== null && msg.indexOf(code) >= 0, "got " + msg);
  return msg;
}
// ---- shared sandbox: official battle modules + the two frozen M2 modules ----
const sandbox = {
  console, Buffer, TextDecoder, TextEncoder, JSON, Math, Date,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Object, Array, String, Number, Boolean, Error, TypeError, Map, Set, WeakMap, WeakSet,
  Symbol, Reflect, Promise, Intl, URL, URLSearchParams, parseInt, parseFloat, isNaN, isFinite,
  Function, eval,
  performance: { now: () => 0 },
  process: { env: {} },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
let loadErr = null;
try {
  for (const f of MECHANICAL_FILES) {
    vm.runInContext(readMechanicalSource(f), sandbox, { filename: f });
  }
} catch (e) { loadErr = String((e && e.message) || e); }
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const PDA = sandbox.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__;
const BIF = sandbox.__LWCS_BEHAVIOR_IMMEDIATE_FEATURE__;
const BRIDGE = sandbox.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_BRIDGE__;
ok("battle modules mounted", loadErr === null && !!decision && !!preview && !!PDA && !!BIF && !!BRIDGE, "err=" + loadErr);
ok("PDA hash pinned", sha256Utf8Lf(fs.readFileSync(path.join(REPO_ROOT, "BehaviorPrototypeAdapter_Module.js"), "utf8")) === PDA_HASH_EXPECTED);
ok("BIF hash pinned", sha256Utf8Lf(fs.readFileSync(path.join(REPO_ROOT, "BehaviorImmediateFeature_Module.js"), "utf8")) === BIF_HASH_EXPECTED);
ok("Bridge hash pinned", sha256Utf8Lf(fs.readFileSync(path.join(REPO_ROOT, "BehaviorCandidateFeatureBridge_Module.js"), "utf8")) === BRIDGE_HASH_EXPECTED);
const pdaRegistry = PDA && PDA.registry ? PDA.registry() : {};
const bifRegistry = BIF && BIF.registry ? BIF.registry() : {};
const bridgeRegistry = BRIDGE && BRIDGE.registry ? BRIDGE.registry() : {};
ok('PDA registry revision 5', pdaRegistry.revision === 5);
ok('BIF registry revision 4 / input contract rev6', bifRegistry.revision === 4 && pinnedDocs['tools/rc6/contracts/BehaviorImmediateFeatureV1.json'] && pinnedDocs['tools/rc6/contracts/BehaviorImmediateFeatureV1.json'].revision === 6);
ok('BIF output schema revision 4', pinnedDocs['tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json'] && pinnedDocs['tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json'].revision && pinnedDocs['tools/rc6/contracts/BehaviorImmediateFeatureV1.schema.json'].revision.const === 4);
ok('Bridge registry revision 2', bridgeRegistry.revision === 2);
ok('BIF governed PDA pins', bifRegistry.contractHashes && bifRegistry.contractHashes.governed && bifRegistry.contractHashes.governed.adapterContract === CONTRACT_PINS['tools/rc6/contracts/PrototypeDirectAdapterV1.json'] && bifRegistry.contractHashes.governed.adapterSchema === CONTRACT_PINS['tools/rc6/contracts/PrototypeDirectAdapterV1.schema.json'] && bifRegistry.contractHashes.governed.adapterCases === CONTRACT_PINS['tools/rc6/cases/PrototypeDirectAdapterCasesV1.json']);
ok('Bridge contract pins', bridgeRegistry.contractHashes && bridgeRegistry.contractHashes.bridgeContract === CONTRACT_PINS['tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.json'] && bridgeRegistry.contractHashes.bridgeSchema === CONTRACT_PINS['tools/rc6/contracts/BehaviorCandidateFeatureBridgeV1.schema.json'] && bridgeRegistry.contractHashes.featureModule === BIF_HASH_EXPECTED && bridgeRegistry.contractHashes.adapterModule === PDA_HASH_EXPECTED);

// ---- official fact builders (transcription only) ----
function buildPublicSnapshot(visibleWorld, actorId) {
  const units = {};
  const sides = {};
  for (const [side, list] of Object.entries((visibleWorld && visibleWorld.参战者) || {})) {
    for (const u of list || []) {
      const id = String(u.id || u.name || "");
      if (!id) continue;
      units[id] = {
        hp: Number(u.hp), hp_max: Number(u.hp_max), sp: Number(u.sp), sp_max: Number(u.sp_max),
        men: Number(u.men), men_max: Number(u.men_max), vit: Number(u.vit), vit_max: Number(u.vit_max),
        def: Number(u.def), agi: Number(u.agi), shield: Number(u.shield || 0),
        状态效果: (u.状态效果 || {}),
      };
      sides[id] = side;
    }
  }
  const all = []
    .concat((visibleWorld && visibleWorld.参战者 && visibleWorld.参战者.team_player) || [])
    .concat((visibleWorld && visibleWorld.参战者 && visibleWorld.参战者.team_enemy) || []);
  const actor = all.find(x => String(x.id || x.name) === actorId);
  const actorStatus = actor && actor.状态 && actor.状态.存活 === false ? 'TERMINAL' : 'NORMAL';
  return { units, sides, actorStatus };
}
function atomicFactsFromPreview(pv) {
  const facts = [];
  let untranscribed = 0;
  for (const c of (pv && pv.contributions) || []) {
    const hp = c.evidence && c.evidence.hitProbability;
    if (typeof c.expectedDelta === "number" && Number.isFinite(c.expectedDelta)
      && typeof hp === "number" && Number.isFinite(hp)) {
      facts.push({
        eventId: String(c.effectInstanceId || c.sourceActionId || ""),
        hitCheckApplicability: 'APPLICABLE',
        evidence: { hitProbability: hp },
        sourceActionId: String(c.sourceActionId || ""),
        outcomeKind: String(c.outcomeKind || ""),
        expectedDelta: c.expectedDelta,
      });
    } else {
      untranscribed += 1;
    }
  }
  return { facts, untranscribed };
}
function publicCostFromDeclaration(declaration) {
  const out = [];
  for (const [resource, amount] of Object.entries(declaration.resourceCosts || {})) {
    if (['魂力', '精神力', '体力', '生命'].indexOf(resource) >= 0 && Number.isFinite(Number(amount))) {
      out.push({ resource, amount: Number(amount) });
    }
  }
  return out;
}
function publicProbabilityFromPreview(pv) {
  for (const c of (pv && pv.contributions) || []) {
    const hp = c.evidence && c.evidence.hitProbability;
    if (typeof hp === "number" && Number.isFinite(hp)) return { hitProbability: hp, source: String(c.effectInstanceId || c.sourceActionId || "") };
  }
  return null;
}

const cases = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__);
ok("fixture 25 cases built", cases.length === 25, String(cases.length));

// ---- real PDA FOLLOW_UP -> Bridge -> BIF integration ----
const pdaCases = pinnedDocs['tools/rc6/cases/PrototypeDirectAdapterCasesV1.json'];
const bifCases = pinnedDocs['tools/rc6/cases/BehaviorImmediateFeatureCasesV1.json'];
const pdaFollowCase = pdaCases && Array.isArray(pdaCases.cases)
  ? pdaCases.cases.find(c => c.caseId === 'pos-grant-followup') : null;
const bifFollowCase = bifCases && Array.isArray(bifCases.cases)
  ? bifCases.cases.find(c => c.caseId === 'pos-followup-next-action') : null;
ok('PDA FOLLOW_UP integration fixture present', !!pdaFollowCase);
ok('BIF FOLLOW_UP positive fixture present', !!bifFollowCase);
if (pdaFollowCase && bifFollowCase && PDA && BRIDGE && BIF) {
  let pdaFollow = null;
  let pdaFollowErr = null;
  try { pdaFollow = PDA.project(pdaFollowCase.effect, pdaFollowCase.context); }
  catch (e) { pdaFollowErr = String((e && (e.code || e.reasonCode || e.message)) || e); }
  ok('PDA FOLLOW_UP projects scheduled row', pdaFollowErr === null && pdaFollow && pdaFollow.scheduledFacts && pdaFollow.scheduledFacts.length === 1, pdaFollowErr || 'missing row');
  if (pdaFollow && pdaFollow.scheduledFacts && pdaFollow.scheduledFacts.length === 1) {
    const bifFixtureInput = bifFollowCase.input;
    const bridgeInput = {
      frozenCandidate: JSON.parse(JSON.stringify(bifFixtureInput.candidate)),
      visibleWorld: JSON.parse(JSON.stringify(bifFixtureInput.publicSnapshot)),
      contributions: [],
      pdaProjections: [{ sourceEffectId: pdaFollowCase.context.sourceEffectId, projection: pdaFollow }],
      declaration: {},
    };
    let bridged = null;
    let bridgeFollowErr = null;
    try { bridged = BRIDGE.bridgeCandidates([bridgeInput]); }
    catch (e) { bridgeFollowErr = String((e && (e.code || e.reasonCode || e.message)) || e); }
    ok('Bridge receives real PDA FOLLOW_UP', bridgeFollowErr === null && bridged && bridged.perCandidate.length === 1, bridgeFollowErr || 'missing bridge output');
    const pdaRow = pdaFollow.scheduledFacts[0];
    const bridgeRow = bridged && bridged.perCandidate[0] && bridged.perCandidate[0].bifInput && bridged.perCandidate[0].bifInput.scheduledFacts && bridged.perCandidate[0].bifInput.scheduledFacts[0];
    const followUpFields = ['entryId', 'ownerId', 'followUpKey', 'triggerKey', 'maxActions', 'payloadDirectFacts'];
    for (const field of followUpFields) {
      ok('FOLLOW_UP ' + field + ' PDA->Bridge deep equal', !!bridgeRow && canon(bridgeRow[field]) === canon(pdaRow[field]), JSON.stringify({ pda: pdaRow && pdaRow[field], bridge: bridgeRow && bridgeRow[field] }));
    }
    let bifFollow = null;
    let bifFollowErr = null;
    try { bifFollow = BIF.compileCandidate(JSON.parse(JSON.stringify(bridged.perCandidate[0].bifInput))); }
    catch (e) { bifFollowErr = String((e && (e.code || e.reasonCode || e.message)) || e); }
    ok('BIF accepts bridged PDA FOLLOW_UP positive', bifFollowErr === null && !!bifFollow, bifFollowErr || 'no output');
  }
}
const followUpParameterized = bifCases && Array.isArray(bifCases.parameterizedCases)
  ? bifCases.parameterizedCases.filter(p => ['neg-followup-missing-owner-id', 'neg-followup-missing-followup-key', 'neg-followup-max-actions-zero', 'EMPTY_PAYLOAD_DIRECT_FACTS', 'STRING_MAX_ACTIONS'].indexOf(p.caseId) >= 0) : [];
ok('BIF FOLLOW_UP parameterized gates present', followUpParameterized.length === 5, String(followUpParameterized.length));
if (bifCases && Array.isArray(bifCases.cases)) {
  const bifCaseById = new Map(bifCases.cases.map(c => [c.caseId, c]));
  for (const p of followUpParameterized) {
    const base = bifCaseById.get(p.baseCaseId);
    let input = base && base.input ? JSON.parse(JSON.stringify(base.input)) : null;
    if (input && Array.isArray(input.scheduledFacts) && input.scheduledFacts[p.scheduledIndex]) {
      const row = input.scheduledFacts[p.scheduledIndex];
      for (const key of p.removeKeys || []) delete row[key];
      Object.assign(row, p.set || {});
    }
    expectThrow('BIF ' + p.caseId, () => BIF.compileCandidate(input), p.expect.reject.reasonCode);
  }
}

// ---- per-case first-opportunity audit ----
const perCase = [];
const pdaByPrototype = {};
const pdaTotals = { DIRECT: 0, PENDING: 0, REJECT: 0, CARRIER: 0, ZERO: 0 };
const carriers = [];
const upstreamResponsibilities = [];
const noOfficialEffectKinds = {};
const bifTotals = { compiled: 0, atomicFacts: 0, untranscribedPreviewFacts: 0, outsideRows: 0 };
const bifFeatureStatuses = { KNOWN: 0, UNKNOWN: 0, NOT_APPLICABLE: 0, OUTSIDE_FEATURE_COUNT: 0 };
const pdaRejects = [];

function bump(cls, prototype) {
  pdaTotals[cls] = (pdaTotals[cls] || 0) + 1;
  const key = String(prototype || "?");
  pdaByPrototype[key] = pdaByPrototype[key] || { DIRECT: 0, PENDING: 0, REJECT: 0, CARRIER: 0, ZERO: 0 };
  pdaByPrototype[key][cls] += 1;
}
function classifyEffect(eff, ctx) {
  const adm = PDA.admit(eff, ctx);
  const prj = PDA.project(eff, ctx);
  const prototype = String(eff['原型'] || '?');
  let cls = 'ZERO';
  let reason = "";
  if (!adm.admitted) { cls = 'REJECT'; reason = String((adm.reasons && adm.reasons[0]) || 'REJECTED'); }
  else if (Array.isArray(adm.reasons) && adm.reasons.indexOf('UNSUPPORTED_CARRIER_REQUIRES_UNPACK') >= 0) { cls = 'CARRIER'; reason = 'UNSUPPORTED_CARRIER_REQUIRES_UNPACK'; }
  else if (typeof prj.deferCode === 'string' && prj.deferCode.length > 0) { cls = 'DEFER'; reason = prj.deferCode; }
  else if (Array.isArray(prj.unsupportedOutcomeKinds) && prj.unsupportedOutcomeKinds.length) {
    // Only PENDING_* kinds are mechanically-legal pending; internal row-validation
    // failures (INTERNAL_ROW_VALIDATION_FAILED:...) and other codes are rejects.
    const pendOnly = prj.unsupportedOutcomeKinds.every(k => String(k).indexOf('PENDING_') === 0);
    if (pendOnly) { cls = 'PENDING'; reason = prj.unsupportedOutcomeKinds.join(','); }
    else { cls = 'REJECT'; reason = String(prj.unsupportedOutcomeKinds.find(k => String(k).indexOf('PENDING_') !== 0)); }
  }
  else if ((Array.isArray(prj.directFacts) && prj.directFacts.length) || (Array.isArray(prj.scheduledFacts) && prj.scheduledFacts.length)) cls = "DIRECT";
  bump(cls, prototype);
  return { adm, prj, cls, reason, prototype };
}

for (const caseId of CASE_IDS) {
  const def = cases.find(c => c.caseId === caseId);
  ok("case present " + caseId, !!def);
  if (!def) continue;
  const fixtureHash = sha256(JSON.stringify({ caseId, seed: def.seed, combatData: def.combatData }));
  ok("fixture hash " + caseId, fixtureHash === FIXTURE_HASHES[caseId], fixtureHash);
  const world = def.combatData;
  const actorId = String((world.参战者 && world.参战者.team_player && world.参战者.team_player[0] && world.参战者.team_player[0].id) || "");
  const opp = { opportunityId: "pairability:" + caseId + ":1", ownerId: actorId, role: "ACTIVE", grantType: "NATURAL_ACTION", sequence: 1, round: 1, status: "PENDING" };
  ok("first opportunity " + caseId, actorId.length > 0 && opp.sequence === 1 && opp.round === 1 && opp.grantType === "NATURAL_ACTION", actorId);
  let req = null;
  let reqErr = null;
  try {
    req = decision.prepareDecisionRequest({
      worldSnapshot: world,
      actorId,
      objectiveContract: world.胜负条件,
      battleIntent: { mode: def.intent, objectives: world.胜负条件 },
      actionOpportunity: opp,
      seed: def.seed,
      analysisDepth: 'CANDIDATES_ONLY',
    });
  } catch (e) { reqErr = String((e && e.message) || e); }
  ok("CANDIDATES_ONLY prep " + caseId, reqErr === null && req && Array.isArray(req.frozenCandidates) && req.frozenCandidates.length > 0, "err=" + reqErr);
  if (!req || !Array.isArray(req.frozenCandidates) || !req.frozenCandidates.length) continue;
  const visibleWorld = req.visibleWorld || world;
  const publicSnapshot = buildPublicSnapshot(visibleWorld, actorId);
  const entry = {
    caseId,
    candidateCount: req.frozenCandidates.length,
    skillCandidateCount: req.frozenCandidates.filter(fc => fc.declaration && fc.declaration.actionKind === "RELEASE_SKILL").length,
    pdaItems: 0,
    bifCompiled: 0,
  };
  for (const fc of req.frozenCandidates) {
    const declaration = fc.declaration || {};
    const kind = String(declaration.actionKind || "");
    const targetIds = Array.isArray(declaration.targetIds) ? declaration.targetIds.slice() : [];
    const effects = kind === "RELEASE_SKILL" && declaration.skill && Array.isArray(declaration.skill._效果数组)
      ? declaration.skill._效果数组
      : [];
    if (!effects.length) noOfficialEffectKinds[kind] = (noOfficialEffectKinds[kind] || 0) + 1;
    // paymentMode intentionally omitted: the Bridge derives it (paymentModeDerivationV1)
    // so the harness never fabricates a payment mode.
    const frozenCandidate = {
      candidateId: fc.candidateId,
      actorId,
      actorSide: publicSnapshot.sides[actorId] || 'team_player',
      actionKind: kind,
      targetSet: targetIds,
    };
    let pv = null;
    let pvErr = null;
    try {
      pv = preview.previewAction({ worldSnapshot: world, declaration, actorId, basisView: "DECISION_VISIBLE" });
    } catch (e) { pvErr = String((e && e.message) || e); }
    ok("preview " + fc.candidateId, pvErr === null && !!pv, "err=" + pvErr);
    const atomic = atomicFactsFromPreview(pv || {});
    bifTotals.atomicFacts += atomic.facts.length;
    const pdaItems = [];
    const pdaProjections = [];
    effects.forEach((eff, i) => {
      const ctx = {
        sourceActionId: declaration.actionId || fc.candidateId,
        sourceActorId: actorId,
        sourceEffectId: (declaration.actionId || fc.candidateId) + ":effect:" + i,
        candidateTargetIds: targetIds,
      };
      const r = classifyEffect(eff, ctx);
      pdaItems.push(r);
      pdaProjections.push({ sourceEffectId: ctx.sourceEffectId, projection: r.prj });
      if (r.cls === "CARRIER") carriers.push({ candidateId: fc.candidateId, prototype: r.prototype, reason: r.reason });
      if (r.cls === "PENDING" || r.cls === "DEFER") {
        upstreamResponsibilities.push({ candidateId: fc.candidateId, prototype: r.prototype, kind: r.reason });
      }
      if (r.cls === "REJECT") {
        pdaRejects.push({ candidateId: fc.candidateId, prototype: r.prototype, reason: r.reason });
        upstreamResponsibilities.push({ candidateId: fc.candidateId, prototype: r.prototype, kind: r.reason });
      }
      ok(fc.candidateId + " effect " + i + " classified", ["DIRECT", "PENDING", "DEFER", "REJECT", "CARRIER", "ZERO"].indexOf(r.cls) >= 0, r.cls + ":" + r.reason);
    });
    entry.pdaItems += pdaItems.length;
    // The frozen Bridge module is the only BIF-input constructor. The harness composes
    // the contract input (frozenCandidate without paymentMode, visible snapshot,
    // preview contributions, PDA per-effect projections, declaration) and consumes
    // only bridgeOutput.perCandidate[].bifInput; no private repack of any kind.
    const bridgeInput = {
      frozenCandidate,
      visibleWorld: publicSnapshot,
      contributions: (pv && pv.contributions) || [],
      pdaProjections,
      declaration: {
        publicCost: publicCostFromDeclaration(declaration),
        publicProbability: publicProbabilityFromPreview(pv || {}),
      },
    };
    let bridgeOut = null;
    let bridgeErr = null;
    try { bridgeOut = BRIDGE.bridgeCandidates([bridgeInput]); }
    catch (e) { bridgeErr = String((e && (e.code || e.reasonCode || e.message)) || e); }
    ok("bridge " + fc.candidateId, bridgeErr === null && !!bridgeOut && bridgeOut.perCandidate.length === 1, "err=" + bridgeErr);
    if (!bridgeOut) continue;
    const pc = bridgeOut.perCandidate[0];
    const bi = pc.bifInput;
    bifTotals.untranscribedPreviewFacts += pc.untranscribedPreviewFacts.count;
    ok(fc.candidateId + " bridge paymentMode derived not harness-made", typeof bi.candidate.paymentMode === "string" && bi.candidate.paymentMode.length > 0, bi.candidate.paymentMode);
    ok(fc.candidateId + " bifInput no testOnly keys", ["forbiddenFacts", "branchCombination", "preMultiplied"].every(k => !Object.prototype.hasOwnProperty.call(bi, k)), Object.keys(bi).join(","));
    ok(fc.candidateId + " no harness scheduled repack", canon(bi.scheduledFacts) === canon(pdaProjections.reduce((a, x) => a.concat(x.projection.scheduledFacts), [])), JSON.stringify(bi.scheduledFacts));
    ok(fc.candidateId + " no harness metadata merge", canon(bi.mechanicMetadataEntries) === canon(pdaProjections.reduce((a, x) => a.concat((x.projection.opportunityModifiers && x.projection.opportunityModifiers.mechanicMetadataEntries) || []), [])), JSON.stringify(bi.mechanicMetadataEntries));
    ok(fc.candidateId + " projectionFamilies aggregated verbatim", canon(bi.projectionFamilies) === canon(pdaProjections.reduce((a, x) => a.concat((x.projection.opportunityModifiers && x.projection.opportunityModifiers.projectionFamilies) || []), [])), JSON.stringify(bi.projectionFamilies));
    ok(fc.candidateId + " opportunityModifiers lifted keys removed", !Object.prototype.hasOwnProperty.call(bi.opportunityModifiers, "mechanicMetadataEntries") && !Object.prototype.hasOwnProperty.call(bi.opportunityModifiers, "projectionFamilies"), JSON.stringify(bi.opportunityModifiers));
    const pendingCount = pdaItems.filter(x => x.cls === "PENDING").length;
    const deferCount = pdaItems.filter(x => x.cls === "DEFER").length;
    const rejectCount = pdaItems.filter(x => x.cls === "REJECT").length;
    const carrierCount = pdaItems.filter(x => x.cls === "CARRIER").length;
    const zeroCount = pdaItems.filter(x => x.cls === "ZERO").length;
    ok(fc.candidateId + " pending never REJECT", pc.rejections.length === rejectCount + carrierCount && pc.pdaPending.length === pendingCount, JSON.stringify({ rej: pc.rejections.length, pend: pc.pdaPending.length, wantRej: rejectCount + carrierCount, wantPend: pendingCount }));
    ok(fc.candidateId + " deferred never REJECT", pc.pdaDeferred.length === deferCount, JSON.stringify({ def: pc.pdaDeferred.length, wantDef: deferCount }));
    ok(fc.candidateId + " zero supported fatal explicit", pc.fatalViolations.length === zeroCount, JSON.stringify(pc.fatalViolations));
    ok(fc.candidateId + " bridge totals conserve", bridgeOut.totals.candidateCount === 1 && bridgeOut.totals.pdaItems === pdaProjections.length && bridgeOut.totals.compiledCount === 1 && bridgeOut.totals.rejectionSum === pc.rejections.length && bridgeOut.totals.pendingSum === pc.pdaPending.length && bridgeOut.totals.deferSum === pc.pdaDeferred.length && bridgeOut.totals.fatalSum === pc.fatalViolations.length && bridgeOut.totals.untranscribedSum === pc.untranscribedPreviewFacts.count, JSON.stringify(bridgeOut.totals));
    if (kind === "RELEASE_SKILL" && !effects.length) {
      ok(fc.candidateId + " noOfficialEffect explicit", pc.noOfficialEffectMaterialization.length === 1 && ["BASIC_ATTACK", "DEFEND", "EVADE", "PASS"].indexOf(pc.noOfficialEffectMaterialization[0].kind) >= 0, JSON.stringify(pc.noOfficialEffectMaterialization));
    }
    let bifDoc = null;
    let bifErr = null;
    try { bifDoc = BIF.compileCandidate(JSON.parse(JSON.stringify(bi))); }
    catch (e) { bifErr = String((e && (e.code || e.reasonCode || e.message)) || e); }
    ok(fc.candidateId + " bif compiled from bridge-only input", bifErr === null && !!bifDoc, "err=" + bifErr);
    if (bifDoc) {
      entry.bifCompiled += 1;
      bifTotals.compiled += 1;
      for (const f of bifDoc.features) {
        const st = String(f.status || "");
        if (bifFeatureStatuses[st] === undefined) bifFeatureStatuses[st] = 0;
        bifFeatureStatuses[st] += 1;
        if (f.featureCode === "OUTSIDE_BATCH1_ROW_COUNT") {
          bifFeatureStatuses.OUTSIDE_FEATURE_COUNT += 1;
          if (typeof f.value === "number") bifTotals.outsideRows += f.value;
        }
      }
      const pctRows = pdaProjections.reduce((a, x) => a.concat(x.projection.directFacts || []), []).filter(r => r.factType === "RESOURCE_OPTION_CHANGED" && r.unit === "PERCENT");
      if (pctRows.length) {
        const pctFeat = bifDoc.features.filter(f => f.featureCode === "RESOURCE_DELTA_PERCENT" && f.status === "KNOWN");
        ok(fc.candidateId + " resource PERCENT compiled KNOWN", pctFeat.length === pctRows.length, JSON.stringify(pctFeat));
      }
    }
  }
  perCase.push(entry);
}
if (Object.keys(noOfficialEffectKinds).length) {
  upstreamResponsibilities.push({
    candidateId: null,
    prototype: null,
    kind: "noOfficialEffectMaterialization",
    note: "BASIC_ATTACK/DEFEND/EVADE/PASS candidates carry no official effect object in CANDIDATES_ONLY prep; the implicit basic-attack damage effect must be materialized upstream from preview damageBasis publicOperands before PDA can rate it",
    counts: noOfficialEffectKinds,
  });
}

// ---- static closure self-scan ----
const ownSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
const scanTokens = ['decide(', 'decideNext(', 'runProvider(', 'futureRoute(', 'resultEnumeration(', 'worldClone(', 'raid_', 'performance.now', 'Date.now', 'Math.random'];
const scanSource = ownSource.split(String.fromCharCode(10)).filter(l => l.indexOf("const scanTokens") < 0 && l.indexOf("for (const tok of scanTokens") < 0).join(String.fromCharCode(10));
for (const tok of scanTokens) {
  ok("self no " + tok, scanSource.indexOf(tok) < 0);
}
ok("self no raid caseIds", CASE_IDS.every(c => c.indexOf("raid") < 0));

const summary = {
  schemaVersion: "M2PairabilityV1",
  status: failed ? "FAILED" : "PASSED",
  hashAlgorithm: HASH_ALGORITHM,
  baseHead: BASE_HEAD,
  cleanMode: {
    loader: 'git show BASE_HEAD:path -> VM memory',
    workingTreeMechanicalSourcesIgnored: true,
    baseFiles: BASE_FILES,
    baseReadErrors,
    observedWorkingTreeHashes: baseWorktreeHashes,
  },
  moduleHashes: { BehaviorPrototypeAdapter_Module: PDA_HASH_EXPECTED, BehaviorImmediateFeature_Module: BIF_HASH_EXPECTED, BehaviorCandidateFeatureBridge_Module: BRIDGE_HASH_EXPECTED },
  contractPins: CONTRACT_PINS,
  contractRevisions: CONTRACT_REVISION_EXPECTED,
  scope: {
    cases: CASE_IDS.length,
    opportunitiesPerCase: 1,
    candidateTotal: perCase.reduce((a, c) => a + c.candidateCount, 0),
    pdaEffectItems: perCase.reduce((a, c) => a + c.pdaItems, 0),
    bifCompiledTotal: perCase.reduce((a, c) => a + c.bifCompiled, 0),
  },
  perCase,
  pda: {
    byPrototype: pdaByPrototype,
    totals: pdaTotals,
    direct: pdaTotals.DIRECT,
    pending: pdaTotals.PENDING,
    defer: pdaTotals.DEFER,
    reject: pdaTotals.REJECT + pdaTotals.CARRIER,
    fatal: pdaTotals.ZERO,
    carrierCount: carriers.length,
    carriers,
    noOfficialEffectKinds,
    rejects: pdaRejects,
    upstreamResponsibilities,
  },
  bif: {
    totals: { ...bifTotals, compiledFromBridgeOnly: bifTotals.compiled },
    featureStatuses: bifFeatureStatuses,
    bridgeFlow: "bridgeCandidates() -> bifInput -> BIF.compileCandidate; no harness repack, no harness paymentMode, no scheduled repack, no metadata merge",
  },
  oldEvidenceNote: "legacy 32/56 counts came from pre-freeze measurement bases (earlier PDA/BIF revisions, different fixture scope and item definition); no in-repo artifact reproduces them. This harness counts current real totals from the frozen modules and 7 fixed fixture cases, so 32/56 are not directly reproducible by construction.",
  assertionCount: passed + failed,
  passed,
  failed,
  failures,
};
summary.determinismHash = sha256(canon(summary));
console.log("assertionCount=" + (passed + failed) + " passed=" + passed + " failed=" + failed);
for (const f of failures) console.log("FAIL: " + f);
process.stdout.write("M2PAIRABILITY " + JSON.stringify(summary) + String.fromCharCode(10));
process.exitCode = failed ? 1 : 0;

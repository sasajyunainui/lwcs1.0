import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const CONTRACT_DIR = path.join(ROOT, 'tools', 'rc6', 'contracts');
const BASE_HEAD = '82622c89dda3d121f203fcf92d77260152078821';
const HASH_ALGORITHM = 'SHA256_UTF8_LF';
const BASE_HEAD_FILES = Object.freeze([
  'LibraryData_Runtime.js',
  'CharacterLibrary.js',
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
]);
const GIT_EXECUTABLE = process.env.GIT_EXECUTABLE || (process.platform === 'win32'
  ? path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git', 'cmd', 'git.exe')
  : 'git');
const HASHES = Object.freeze({
  decision: 'f999e398d3fde5b0dc47205859e23e1dea48fa22f41c7d2efb023661ebae31f6',
  preview: '77e549c459f0397672433cdde429cf5115b3eaba4e6c8b5e6a21c9fec97c2b87',
  pda: '6924daa535b98e369da67b924bcd0a4e957ed6bf4ca2a9bc9aaa2184c6886c70',
  source: 'f4dc02bab3c07985d46117e46919c27dcd5f5142a3329c31c168a5a636cb5d69',
  compiler: 'fdb172915410b308ffaa29c2173ab4ba1bfeae47179276238c4793e707e44776',
  contract: '768b39d2ac3b75e1eda064625a78240cccd75748203d18df52b545b710bda298',
  schema: '1f2d8698cc986ff2c98f88bf761cc5b182b42367204aa1c244945acc5ef75778',
  registry: '85016b9198590c5deb6ac4675c4f95dd7fbae164692720a087af6188e4ff6586',
  pdaContract: '4d47e3ccfaee921b35bbbd916924841d632e1ee238de04be3c25bab924a6f20e',
  pdaSchema: '7772969d5685778712be4b1868e4e92f75dd31e147d7601078c3f64822671e22',
  pdaCases: 'f8a4c4e002d63718a112987f1cb8c9b1c6baa7a3438a81ea348d7f8e39e43c2d',
  cases: '883c231d890365295aebe15d6a1b7e38b292c698800059cb862d3fc25c16eb2a',
});
const FILES = Object.freeze({
  decision: path.join(ROOT, 'BattleDecision_Module.js'),
  preview: path.join(ROOT, 'BattlePreview_Module.js'),
  pda: path.join(ROOT, 'BehaviorPrototypeAdapter_Module.js'),
  source: path.join(ROOT, 'BehaviorCandidateFeatureSource_Module.js'),
  compiler: path.join(ROOT, 'BehaviorRelationalFeature_Module.js'),
  contract: path.join(CONTRACT_DIR, 'BehaviorRelationalFeatureV1.json'),
  schema: path.join(CONTRACT_DIR, 'BehaviorRelationalFeatureV1.schema.json'),
  registry: path.join(CONTRACT_DIR, 'BehaviorRelationalProjectorRegistryV1.json'),
  pdaContract: path.join(CONTRACT_DIR, 'PrototypeDirectAdapterV1.json'),
  pdaSchema: path.join(CONTRACT_DIR, 'PrototypeDirectAdapterV1.schema.json'),
  pdaCases: path.join(ROOT, 'tools', 'rc6', 'cases', 'PrototypeDirectAdapterCasesV1.json'),
  cases: path.join(ROOT, 'tools', 'rc6', 'cases', 'BehaviorRelationalFeatureCasesV1.json'),
});
const MECHANICAL_MODULES = Object.freeze([
  'LibraryData_Runtime.js',
  'CharacterLibrary.js',
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BehaviorPrototypeAdapter_Module.js',
  'BehaviorCandidateFeatureSource_Module.js',
  'BehaviorRelationalFeature_Module.js',
]);
const PRODUCTION_JS_HASHES = Object.freeze({
  'LibraryData_Runtime.js': 'ab7e6dae9fbbe6cbe6c6df39a3b6fc3866511ccbc6b65aaa61de59f961f75c85',
  'CharacterLibrary.js': 'dffa678f8984cbbdad8e24ceb3adefc2178c5c49b2f6299f91f3af509ab66cce',
  'MVU_Skill_Runtime.js': '91b7700abeab5d017fdc5767a0ed72de568ea7abc0f495a6f7771b60783577de',
  'BattlePreview_Module.js': '77e549c459f0397672433cdde429cf5115b3eaba4e6c8b5e6a21c9fec97c2b87',
  'BattleDecision_Module.js': 'f999e398d3fde5b0dc47205859e23e1dea48fa22f41c7d2efb023661ebae31f6',
  'BehaviorPrototypeAdapter_Module.js': '6924daa535b98e369da67b924bcd0a4e957ed6bf4ca2a9bc9aaa2184c6886c70',
  'BehaviorCandidateFeatureSource_Module.js': 'f4dc02bab3c07985d46117e46919c27dcd5f5142a3329c31c168a5a636cb5d69',
  'BehaviorRelationalFeature_Module.js': 'fdb172915410b308ffaa29c2173ab4ba1bfeae47179276238c4793e707e44776',
});
const FORBIDDEN_MODULES = Object.freeze([
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'BehaviorCandidateFeatureBridge_Module.js',
  'BattleDecisionR9v2Kernel_Module.js',
]);
const OWN = Object.prototype.hasOwnProperty;
const FEATURE_ORDER = Object.freeze([
  'TEAM_EFFECT_MARGINAL_GAIN',
  'TEAM_EFFECT_REDUNDANCY_RATIO',
  'RESOURCE_DEFICIT_COVERAGE',
  'RESOURCE_CONSUMER_FIT',
  'TEAM_FOLLOWUP_COVERAGE',
]);
const REGISTRY_PROJECTOR_IDS = Object.freeze([
  'BRF_EXPLICIT_FOLLOW_UP_V1',
  'BRF_NOT_RELATIONAL_V1',
  'BRF_RESOURCE_SUPPLY_V1',
  'BRF_TEAM_EFFECT_V1',
]);

const baseHeadTextCache = new Map();

function readBaseHeadText(file) {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  if (!BASE_HEAD_FILES.includes(relative)) return null;
  if (!baseHeadTextCache.has(relative)) {
    baseHeadTextCache.set(relative, execFileSync(GIT_EXECUTABLE, ['show', `${BASE_HEAD}:${relative}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      windowsHide: true,
    }));
  }
  return baseHeadTextCache.get(relative);
}

function readText(file) {
  return readBaseHeadText(file) ?? fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text.replace(/\r\n?/g, '\n'), 'utf8').digest('hex');
}

function sha256(file) {
  return sha256Text(readText(file));
}

function worktreeSha256(file) {
  return sha256Text(fs.readFileSync(file, 'utf8'));
}

function assertBaseHeadMechanicalLoad() {
  const loadedFromBaseHead = Object.fromEntries(BASE_HEAD_FILES.map(file => {
    const baseText = readBaseHeadText(path.join(ROOT, file));
    assert(baseText !== null, `baseHead git blob unavailable:${file}`);
    return [file, sha256Text(baseText)];
  }));
  const loaded = Object.fromEntries(BASE_HEAD_FILES.map(file => [file, sha256(path.join(ROOT, file))]));
  assertEqual(loaded, loadedFromBaseHead, 'baseHead loaded source');
  for (const file of BASE_HEAD_FILES) assert(loaded[file] === PRODUCTION_JS_HASHES[file], `baseHead loaded hash:${file}`);

  const observeMode = (mode, worktree) => {
    const dirty = BASE_HEAD_FILES.filter(file => loaded[file] !== worktree[file]);
    const isolatedFiles = dirty.filter(file => loaded[file] !== worktree[file]);
    if (mode === 'synthetic_clean') assert(dirty.length === 0, 'synthetic clean mode dirty observation');
    for (const file of isolatedFiles) assert(loaded[file] !== worktree[file], `baseHead/worktree isolation:${file}`);
    return { mode, loaded, worktree, dirty, isolatedFiles, loadingSource: `git show ${BASE_HEAD}:<path>` };
  };
  const currentWorktree = Object.fromEntries(BASE_HEAD_FILES.map(file => [file, worktreeSha256(path.join(ROOT, file))]));
  const currentDirty = observeMode('current_dirty', currentWorktree);
  const syntheticClean = observeMode('synthetic_clean', loadedFromBaseHead);
  assertEqual(currentDirty.loaded, syntheticClean.loaded, 'dirty observation cannot change loading source');
  return {
    baseHead: BASE_HEAD,
    algorithm: HASH_ALGORITHM,
    loadingSource: `git show ${BASE_HEAD}:<path>`,
    loaded,
    worktree: currentWorktree,
    dirty: currentDirty.dirty,
    modes: { currentDirty, syntheticClean },
  };
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function stableStringify(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? 'null').join(',')}]`;
  }
  const parts = [];
  for (const key of Object.keys(value).sort()) {
    const encoded = stableStringify(value[key]);
    if (encoded !== undefined) parts.push(`${JSON.stringify(key)}:${encoded}`);
  }
  return `{${parts.join(',')}}`;
}

function equal(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function assertEqual(left, right, message) {
  assert(equal(left, right), `${message}: expected ${stableStringify(right)}, got ${stableStringify(left)}`);
}

function assertExactKeys(value, fields, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  assertEqual(Object.keys(value).sort(), fields.slice().sort(), `${label}: exact fields`);
}

function assertKeySubset(value, fields, label) {
  const allowed = new Set(fields);
  for (const key of Object.keys(value)) assert(allowed.has(key), `${label}: unexpected field ${key}`);
}

function assertUniqueIds(value, label) {
  assert(Array.isArray(value), `${label}: array required`);
  assert(value.every((item) => typeof item === 'string' && item.length > 0), `${label}: invalid id`);
  assert(new Set(value).size === value.length, `${label}: duplicate id`);
}

function assertSortedIds(value, label) {
  assertUniqueIds(value, label);
  assertEqual(value, value.slice().sort(), `${label}: not deterministic UTF-16 order`);
}

const CASE_LEAKY_KEY = /score|value|vector|route|teacher|selection|pareto|label/i;

function assertCaseNoLeak(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCaseNoLeak(item, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!CASE_LEAKY_KEY.test(key), `${label}: forbidden case key ${key}`);
    assertCaseNoLeak(child, `${label}.${key}`);
  }
}

function validateCaseArtifact(artifact) {
  assertExactKeys(artifact, ['schemaVersion', 'revision', 'encoding', 'hashAlgorithm', 'baseHead', 'sourceHashes', 'cases'], 'case artifact');
  assert(artifact.schemaVersion === 'BehaviorRelationalFeatureCasesV1' && artifact.revision === 1, 'case artifact identity');
  assert(artifact.encoding === 'UTF-8' && artifact.hashAlgorithm === HASH_ALGORITHM, 'case artifact encoding/hash algorithm');
  assert(artifact.baseHead === BASE_HEAD, 'case artifact baseHead');
  assertEqual(Object.keys(artifact.sourceHashes).sort(), BASE_HEAD_FILES.slice().sort(), 'case artifact sourceHashes');
  for (const file of BASE_HEAD_FILES) {
    assert(/^[0-9a-f]{64}$/.test(artifact.sourceHashes[file]), `case artifact source hash:${file}`);
    assert(artifact.sourceHashes[file] === PRODUCTION_JS_HASHES[file], `case artifact source pin:${file}`);
  }
  assert(Array.isArray(artifact.cases) && artifact.cases.length === 3, 'case artifact count');
  assertEqual(
    artifact.cases.map(item => `${item.caseId}:${item.variant}`),
    ['team_control_overlap:base', 'team_resource_support:base', 'team_resource_support:fixed_public_sp_zero'],
    'case artifact order',
  );
  for (const [index, record] of artifact.cases.entries()) {
    const label = `case artifact.cases[${index}]`;
    assertExactKeys(record, ['caseId', 'variant', 'sourceCharacterIds', 'sourceDataHashes', 'input'], label);
    assert(typeof record.caseId === 'string' && typeof record.variant === 'string', `${label}: identity`);
    assertUniqueIds(record.sourceCharacterIds, `${label}.sourceCharacterIds`);
    assertExactKeys(record.sourceDataHashes, record.sourceCharacterIds, `${label}.sourceDataHashes`);
    for (const sourceId of record.sourceCharacterIds) assert(/^[0-9a-f]{64}$/.test(record.sourceDataHashes[sourceId]), `${label}.sourceDataHashes.${sourceId}`);
    const input = record.input;
    assertExactKeys(input, ['worldSnapshot', 'actorId', 'objectiveContract', 'battleIntent', 'actionOpportunity', 'seed', 'analysisDepth'], `${label}.input`);
    assert(input.analysisDepth === 'CANDIDATES_ONLY', `${label}.input.analysisDepth`);
    assertExactKeys(input.battleIntent, ['mode', 'objectives'], `${label}.input.battleIntent`);
    assertExactKeys(input.actionOpportunity, ['opportunityId', 'ownerId', 'role', 'grantType', 'sequence', 'round', 'status'], `${label}.input.actionOpportunity`);
    assert(input.actionOpportunity.opportunityId === `relational:${record.caseId}`, `${label}.input.actionOpportunity.opportunityId`);
    assert(input.actionOpportunity.ownerId === input.actorId && input.actionOpportunity.role === 'ACTIVE', `${label}.input.actionOpportunity owner/role`);
    assert(input.actionOpportunity.grantType === 'NATURAL_ACTION' && input.actionOpportunity.sequence === 1 && input.actionOpportunity.round === 1 && input.actionOpportunity.status === 'PENDING', `${label}.input.actionOpportunity state`);
    assert(input.actorId === input.worldSnapshot?.参战者?.team_player?.[0]?.id, `${label}.input.actorId`);
    assertEqual(input.objectiveContract, input.worldSnapshot?.胜负条件, `${label}.objectiveContract closure`);
    assertEqual(input.battleIntent.objectives, input.objectiveContract, `${label}.battleIntent objective closure`);
    const worldIds = unitsOfWorld(input.worldSnapshot).map(unit => unit.name);
    assertEqual(record.sourceCharacterIds, worldIds, `${label}.sourceCharacterIds closure`);
    if (record.variant === 'fixed_public_sp_zero') {
      const tang = input.worldSnapshot.参战者.team_player.find(unit => unit.name === '唐舞麟');
      assert(tang && tang.sp === 0, `${label}: fixed deficit`);
    }
    assertCaseNoLeak(record, label);
  }
  return artifact.cases;
}

function schemaAt(root, reference) {
  assert(reference.startsWith('#/'), `schema reference unsupported: ${reference}`);
  return reference.slice(2).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~')).reduce((node, key) => node[key], root);
}

function typeMatches(value, type) {
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'null') return value === null;
  return true;
}

function matchesSchema(value, schema, root) {
  try {
    validateSchema(value, schema, root, 'condition');
    return true;
  } catch {
    return false;
  }
}

function validateSchema(value, schema, root, label) {
  if (schema.$ref) return validateSchema(value, schemaAt(root, schema.$ref), root, label);
  if (schema.const !== undefined) assertEqual(value, schema.const, `${label}: const`);
  if (schema.enum) assert(schema.enum.some((item) => equal(item, value)), `${label}: enum`);
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((item) => matchesSchema(value, item, root)).length;
    assert(matches === 1, `${label}: oneOf matched ${matches}`);
  }
  if (schema.anyOf) assert(schema.anyOf.some((item) => matchesSchema(value, item, root)), `${label}: anyOf`);
  if (schema.not && matchesSchema(value, schema.not, root)) fail(`${label}: not`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert(types.some((type) => typeMatches(value, type)), `${label}: type`);
  }
  if (schema.required) {
    assert(value !== null && typeof value === 'object', `${label}: required on non-object`);
    for (const field of schema.required) assert(OWN.call(value, field), `${label}: missing ${field}`);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined) assert(keys.length >= schema.minProperties, `${label}: minProperties`);
    if (schema.maxProperties !== undefined) assert(keys.length <= schema.maxProperties, `${label}: maxProperties`);
    const properties = schema.properties || {};
    const patterns = Object.entries(schema.patternProperties || {}).map(([pattern, item]) => [new RegExp(pattern), item]);
    for (const key of keys) {
      if (OWN.call(properties, key)) {
        validateSchema(value[key], properties[key], root, `${label}.${key}`);
        continue;
      }
      const matched = patterns.filter(([pattern]) => pattern.test(key));
      if (matched.length) {
        for (const [, item] of matched) validateSchema(value[key], item, root, `${label}.${key}`);
      } else if (schema.additionalProperties === false) {
        fail(`${label}: additional field ${key}`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateSchema(value[key], schema.additionalProperties, root, `${label}.${key}`);
      }
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) assert(value.length >= schema.minItems, `${label}: minItems`);
    if (schema.maxItems !== undefined) assert(value.length <= schema.maxItems, `${label}: maxItems`);
    if (schema.uniqueItems) assert(new Set(value.map(stableStringify)).size === value.length, `${label}: uniqueItems`);
    if (schema.prefixItems) {
      for (let index = 0; index < Math.min(value.length, schema.prefixItems.length); index += 1) {
        validateSchema(value[index], schema.prefixItems[index], root, `${label}[${index}]`);
      }
      if (schema.items === false) assert(value.length <= schema.prefixItems.length, `${label}: items`);
      else if (schema.items && typeof schema.items === 'object') {
        for (let index = schema.prefixItems.length; index < value.length; index += 1) validateSchema(value[index], schema.items, root, `${label}[${index}]`);
      }
    } else if (schema.items === false) {
      assert(value.length === 0, `${label}: items`);
    } else if (schema.items && typeof schema.items === 'object') {
      for (let index = 0; index < value.length; index += 1) validateSchema(value[index], schema.items, root, `${label}[${index}]`);
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined) assert(value.length >= schema.minLength, `${label}: minLength`);
    if (schema.maxLength !== undefined) assert(value.length <= schema.maxLength, `${label}: maxLength`);
    if (schema.pattern) assert(new RegExp(schema.pattern).test(value), `${label}: pattern`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined) assert(value >= schema.minimum, `${label}: minimum`);
    if (schema.maximum !== undefined) assert(value <= schema.maximum, `${label}: maximum`);
    if (typeof schema.exclusiveMinimum === 'number') assert(value > schema.exclusiveMinimum, `${label}: exclusiveMinimum`);
    if (schema.exclusiveMinimum === true && schema.minimum !== undefined) assert(value > schema.minimum, `${label}: exclusiveMinimum`);
    if (typeof schema.exclusiveMaximum === 'number') assert(value < schema.exclusiveMaximum, `${label}: exclusiveMaximum`);
    if (schema.exclusiveMaximum === true && schema.maximum !== undefined) assert(value < schema.maximum, `${label}: exclusiveMaximum`);
  }
  for (const item of schema.allOf || []) validateSchema(value, item, root, label);
  if (schema.if && matchesSchema(value, schema.if, root) && schema.then) validateSchema(value, schema.then, root, label);
  if (schema.if && !matchesSchema(value, schema.if, root) && schema.else) validateSchema(value, schema.else, root, label);
}

function assertDeepFrozen(value, label, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert(Object.isFrozen(value), `${label}: not deeply frozen`);
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], `${label}.${key}`, seen);
}

function assertNoLeakyKeys(value, label, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const forbidden = new Set(['score', 'scores', 'valuevector', 'vector', 'route', 'futureroute', 'selection', 'teacher', 'targetkernel', 'r8', 'runtime', 'report', 'ui', 'bridge', 'bif']);
  for (const key of Object.keys(value)) {
    assert(!forbidden.has(key.toLowerCase()), `${label}: forbidden data field ${key}`);
    assertNoLeakyKeys(value[key], `${label}.${key}`, seen);
  }
}

function refsOf(record) {
  return [
    ...(record.sourceFactIds || []).map((id) => `f:${id}`),
    ...(record.sourceEventIds || []).map((id) => `e:${id}`),
    ...(record.grantProofIds || []).map((id) => `p:${id}`),
  ];
}

function assertClosedRefs(record, closure, label) {
  assertUniqueIds(record.sourceFactIds, `${label}.sourceFactIds`);
  assertUniqueIds(record.sourceEventIds, `${label}.sourceEventIds`);
  assert(record.sourceFactIds.length > 0 || record.sourceEventIds.length > 0, `${label}: empty source refs`);
  for (const id of record.sourceFactIds) assert(closure.facts.has(id), `${label}: fact outside closure ${id}`);
  for (const id of record.sourceEventIds) assert(closure.events.has(id), `${label}: event outside closure ${id}`);
  if (record.grantProofIds) {
    assertUniqueIds(record.grantProofIds, `${label}.grantProofIds`);
    assert(record.grantProofIds.length > 0, `${label}: empty grant proof`);
    for (const id of record.grantProofIds) {
      assert(record.sourceFactIds.includes(id) || record.sourceEventIds.includes(id), `${label}: proof not in own refs ${id}`);
      assert(closure.facts.has(id) || closure.events.has(id), `${label}: proof outside closure ${id}`);
    }
  }
}

function sourceIdentity(entry) {
  if (entry.capabilityKind === 'TEAM_EFFECT') return stableStringify([entry.targetId, entry.effectAxis, entry.effectKey, entry.timeBand]);
  if (entry.capabilityKind === 'RESOURCE_SUPPLY') return stableStringify([entry.targetId, entry.resourceKey, entry.timeBand, entry.sourceFactIds, entry.sourceEventIds]);
  return stableStringify([entry.ownerId, entry.followUpKey]);
}

function assertSourceRefsDisjoint(baseRecords, candidateRecords, closure) {
  const base = new Set();
  for (const record of baseRecords) for (const ref of refsOf(record)) base.add(ref);
  for (const record of candidateRecords) {
    for (const ref of refsOf(record)) {
      assert(!base.has(ref), `candidate source overlaps baseline/catalog: ${ref}`);
      if (ref.startsWith('p:')) {
        const proof = ref.slice(2);
        assert(closure.facts.has(proof) || closure.events.has(proof), `proof outside closure: ${proof}`);
      }
    }
  }
}

function validateSourceInput(input, schema, contract, expectedIds = input.frozenCandidateIds) {
  validateSchema(input, schema.$defs.input, schema, 'sourceInput');
  const top = contract.authority.inputTopLevelExactFields;
  assertExactKeys(input, top, 'sourceInput');
  assertSortedIds(input.frozenCandidateIds, 'sourceInput.frozenCandidateIds');
  assertEqual(input.frozenCandidateIds, expectedIds.slice().sort(), 'sourceInput/request candidate closure');
  const candidateKeys = Object.keys(input.candidateEntriesById).sort();
  assertEqual(candidateKeys, input.frozenCandidateIds, 'sourceInput.candidateEntriesById closure');
  assertExactKeys(input.candidateCompletenessByAxis, input.frozenCandidateIds, 'sourceInput.candidateCompletenessByAxis');
  assertExactKeys(input.baselineCompletenessByAxis, contract.inputShape.baselineCompletenessFields, 'sourceInput.baselineCompletenessByAxis');
  const closure = { facts: new Set(input.sourceClosure.factIds), events: new Set(input.sourceClosure.eventIds) };
  assertUniqueIds(input.sourceClosure.factIds, 'sourceInput.sourceClosure.factIds');
  assertUniqueIds(input.sourceClosure.eventIds, 'sourceInput.sourceClosure.eventIds');
  assert(input.sourceClosure.factIds.length > 0 || input.sourceClosure.eventIds.length > 0, 'sourceInput.sourceClosure: empty');
  assertEqual(input.registryAttestation.projectorIds, REGISTRY_PROJECTOR_IDS, 'sourceInput.registryAttestation.projectorIds');
  assertEqual(input.baselineEntries.map((entry) => entry.capabilityKind), input.baselineEntries.map(() => 'TEAM_EFFECT'), 'baseline kinds');
  const baseRecords = [...input.baselineEntries, ...input.publicConsumers];
  const baseIdentity = new Set();
  for (const [index, entry] of input.baselineEntries.entries()) {
    assertExactKeys(entry, contract.entryRules.TEAM_EFFECT.fields, `baselineEntries[${index}]`);
    assert(entry.capabilityKind === 'TEAM_EFFECT', `baselineEntries[${index}]: kind`);
    assertClosedRefs(entry, closure, `baselineEntries[${index}]`);
    const identity = sourceIdentity(entry);
    assert(!baseIdentity.has(identity), `baseline duplicate identity ${identity}`);
    baseIdentity.add(identity);
  }
  for (const [index, consumer] of input.publicConsumers.entries()) {
    assertExactKeys(consumer, contract.inputShape.publicConsumerExactFields, `publicConsumers[${index}]`);
    assertClosedRefs(consumer, closure, `publicConsumers[${index}]`);
  }
  for (const candidateId of input.frozenCandidateIds) {
    const rows = input.candidateEntriesById[candidateId];
    const seen = new Set();
    for (const [index, entry] of rows.entries()) {
      const rule = contract.entryRules[entry.capabilityKind];
      assert(rule && rule.fields, `${candidateId}[${index}]: unsupported capability`);
      assertExactKeys(entry, rule.fields, `${candidateId}[${index}]`);
      assertClosedRefs(entry, closure, `${candidateId}[${index}]`);
      const identity = sourceIdentity(entry);
      assert(!seen.has(identity), `${candidateId}: duplicate identity ${identity}`);
      seen.add(identity);
    }
    assertSourceRefsDisjoint(baseRecords, rows, closure);
    const completeness = input.candidateCompletenessByAxis[candidateId];
    assertExactKeys(completeness, contract.inputShape.candidateCompletenessFields, `${candidateId}.completeness`);
  }
  assert(input.actionCatalogCompleteness === 'COMPLETE' || input.actionCatalogCompleteness === 'PARTIAL', 'sourceInput.actionCatalogCompleteness');
  assertNoLeakyKeys(input, 'sourceInput');
  return closure;
}

function validateCompilerOutput(output, schema, contract, sourceInput) {
  validateSchema(output, schema.$defs.output, schema, 'compilerOutput');
  assertExactKeys(output, contract.outputShape.topLevelExactFields, 'compilerOutput');
  const ids = sourceInput.frozenCandidateIds;
  assertEqual(output.perCandidate.map((item) => item.candidateId), ids, 'compilerOutput candidate closure');
  const closure = { facts: new Set(sourceInput.sourceClosure.factIds), events: new Set(sourceInput.sourceClosure.eventIds) };
  const operandShapes = contract.canonicalOutputExample.perCandidate[0].features.map((feature) => feature.operands.map((operand) => [operand.name, operand.unit]));
  for (const [candidateIndex, candidate] of output.perCandidate.entries()) {
    assertExactKeys(candidate, ['candidateId', 'features'], `compilerOutput.perCandidate[${candidateIndex}]`);
    assertEqual(candidate.features.map((feature) => feature.featureCode), FEATURE_ORDER, `${candidate.candidateId}: feature order`);
    for (const [featureIndex, feature] of candidate.features.entries()) {
      const label = `${candidate.candidateId}.features[${featureIndex}]`;
      const allowed = contract.outputShape.featureExactFields;
      const required = allowed.filter((field) => field !== 'value');
      assertKeySubset(feature, allowed, label);
      for (const field of required) assert(OWN.call(feature, field), `${label}: missing ${field}`);
      if (feature.status === 'KNOWN') assert(OWN.call(feature, 'value'), `${label}: KNOWN value missing`);
      else assert(!OWN.call(feature, 'value'), `${label}: non-KNOWN value leakage`);
      assertEqual(feature.operands.map((operand) => [operand.name, operand.unit]), operandShapes[featureIndex], `${label}: operand order/units`);
      for (const [operandIndex, operand] of feature.operands.entries()) {
        assertExactKeys(operand, contract.outputShape.operandExactFields, `${label}.operands[${operandIndex}]`);
        assertClosedRefs(operand, closure, `${label}.operands[${operandIndex}]`);
      }
      assertClosedRefs(feature, closure, label);
    }
  }
  assertNoLeakyKeys(output, 'compilerOutput');
}

function parseEmbeddedRegistry(sourceText, registry) {
  const match = sourceText.match(/var REGISTRY_ROWS = \[\s*([\s\S]*?)\s*\];\s*var REGISTRY =/);
  assert(match, 'Source embedded REGISTRY_ROWS not found');
  const rows = [...match[1].matchAll(/\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/g)].map((item) => item.slice(1));
  assert(rows.length === 27, `Source embedded registry row count ${rows.length}`);
  assert(registry.entries.length === rows.length, 'registry row count mismatch');
  assertEqual(Object.keys(registry.projectorIds).sort(), ['FOLLOW_UP', 'NOT_RELATIONAL', 'RESOURCE_SUPPLY', 'TEAM_EFFECT'].sort(), 'registry projector kinds');
  let battleScopeCount = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const [prototypeKind, scope, capabilityKind, effectAxis] = rows[index];
    if (scope === 'BATTLE') battleScopeCount += 1;
    const expected = { prototypeKind, projectorId: registry.projectorIds[capabilityKind], capabilityKind };
    if (effectAxis) expected.effectAxisCode = effectAxis;
    if (scope === 'OUT_OF_BATTLE_SCOPE') expected.reasonCode = 'OUT_OF_BATTLE_SCOPE';
    assertEqual(registry.entries[index], expected, `registry mapping ${index}:${prototypeKind}`);
  }
  assert(battleScopeCount === 23, `registry battle scope ${battleScopeCount}`);
  assert(registry.coverage.total.expected === 27 && registry.coverage.total.mapped === 27, 'registry total coverage');
  assert(registry.coverage.battleScope.expected === 23 && registry.coverage.battleScope.mapped === 23, 'registry battle coverage');
  return { rowCount: rows.length, battleScopeCount };
}

function verifyPinnedArtifacts(contract, schema, registry, pdaContract, pdaSchema, pdaCases, sourceText, compilerText, casesArtifact) {
  for (const [name, file] of Object.entries(FILES)) assert(sha256(file) === HASHES[name], `${name} hash mismatch`);
  assertEqual(Object.keys(PRODUCTION_JS_HASHES).sort(), [...MECHANICAL_MODULES].sort(), 'production JS pin list');
  for (const [file, hash] of Object.entries(PRODUCTION_JS_HASHES)) {
    assert(sha256(path.join(ROOT, file)) === hash, `production JS hash mismatch:${file}`);
  }
  assert(contract.schemaVersion === 'BehaviorRelationalFeatureV1' && contract.revision === 4 && contract.status === 'FROZEN', 'contract revision/status');
  assert(contract.encoding === 'UTF-8', 'contract encoding');
  assert(schema.$defs?.input && schema.$defs?.output, 'schema input/output definitions');
  assertEqual(Object.keys(contract.canonicalInputExample), contract.authority.inputTopLevelExactFields, 'contract canonical input');
  assertEqual(Object.keys(contract.canonicalOutputExample), contract.outputShape.topLevelExactFields, 'contract canonical output');
  assert(contract.authority.publicOnly === true && contract.authority.selection === false && contract.authority.scoring === false, 'contract public boundary');
  assert(contract.authority.probabilityWeighting === false && contract.authority.candidateVsCandidate === false, 'contract formula boundary');
  assert(contract.authority.futureTraversal === false && contract.authority.teacherReasoning === false, 'contract traversal boundary');
  assert(pdaContract.schemaVersion === 'PrototypeDirectAdapterV1' && pdaContract.revision === 5, 'PDA contract revision');
  assert(pdaSchema.$id === 'PrototypeDirectAdapterV1.schema.json', 'PDA schema identity');
  assert(pdaCases.schemaVersion === 'PrototypeDirectAdapterCasesV1' && pdaCases.revision === 5, 'PDA cases identity');
  assert(pdaContract.validation?.schema === 'PrototypeDirectAdapterV1.schema.json', 'PDA contract schema reference');
  assert(pdaContract.validation?.casesContract === 'PrototypeDirectAdapterCasesV1', 'PDA contract cases reference');
  validateSchema(contract.canonicalInputExample, schema.$defs.input, schema, 'contract.canonicalInputExample');
  validateSchema(contract.canonicalOutputExample, schema.$defs.output, schema, 'contract.canonicalOutputExample');
  assert(sourceText.includes(`var REGISTRY_HASH = '${HASHES.registry}'`), 'Source registry hash literal');
  assert(compilerText.includes("var SCHEMA = 'BehaviorRelationalFeatureV1'"), 'Compiler schema literal');
  assert(!sourceText.includes('prepareDecisionRequest(') && !sourceText.includes('enumerateCandidates('), 'Source re-preparation/re-enumeration path');
  assert(!compilerText.includes('scoreCandidates') && !compilerText.includes('valueVector'), 'Compiler forbidden value path');
  assert(MECHANICAL_MODULES.every((file) => !FORBIDDEN_MODULES.includes(file)), 'forbidden module in load list');
  assert(!MECHANICAL_MODULES.some((file) => file.includes('Adapter_Module.js') && file !== 'BehaviorPrototypeAdapter_Module.js'), 'unaccepted adapter in load list');
  validateCaseArtifact(casesArtifact);
  parseEmbeddedRegistry(sourceText, registry);
}

function isFormalApiSurface(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (
    typeof value.prepareDecisionRequest === 'function' ||
    typeof value.previewAction === 'function' && typeof value.stableHash === 'function' ||
    typeof value.compilePreparedRequest === 'function' ||
    typeof value.compileDecision === 'function'
  );
}

function loadContext(files, instrumentFormalApis = false) {
  const context = { console, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate, queueMicrotask, performance, structuredClone, TextEncoder, TextDecoder };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  const nativeObject = instrumentFormalApis ? vm.runInContext('Object', context) : null;
  if (instrumentFormalApis) {
    context.Object = new Proxy(nativeObject, {
      get(target, key, receiver) {
        if (key === 'freeze') {
          return value => isFormalApiSurface(value)
            ? value
            : Reflect.apply(target.freeze, target, [value]);
        }
        return Reflect.get(target, key, receiver);
      },
    });
  }
  try {
    for (const file of files) vm.runInContext(readText(path.join(ROOT, file)), context, { filename: file });
  } finally {
    if (instrumentFormalApis) context.Object = nativeObject;
  }
  return context;
}

function loadRuntime() {
  const context = loadContext(MECHANICAL_MODULES, true);
  const decision = context.__LWCS_BATTLE_DECISION__;
  const preview = context.__LWCS_BATTLE_PREVIEW__;
  const pda = context.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__;
  const source = context.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__;
  const compiler = context.__LWCS_BEHAVIOR_RELATIONAL_FEATURE__;
  assert(context.__LWCS_BATTLE_DECISION__ === decision, 'Decision formal global identity');
  assert(context.__LWCS_BATTLE_PREVIEW__ === preview, 'Preview formal global identity');
  assert(context.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__ === pda, 'PDA formal global identity');
  assert(context.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__ === source, 'Source formal global identity');
  assert(context.__LWCS_BEHAVIOR_RELATIONAL_FEATURE__ === compiler, 'Compiler formal global identity');
  assert(typeof decision?.prepareDecisionRequest === 'function', 'prepareDecisionRequest unavailable');
  assert(typeof preview?.previewAction === 'function' && typeof preview?.stableHash === 'function', 'Preview API unavailable');
  assert(typeof pda?.admit === 'function' && typeof pda?.project === 'function' && typeof pda?.registry === 'function', 'PDA API unavailable');
  assert(typeof source?.compilePreparedRequest === 'function', 'Source API unavailable');
  assert(typeof compiler?.compileDecision === 'function', 'Compiler API unavailable');
  return { context, decision, preview, pda, source, compiler };
}

function unitsOfWorld(world) {
  return Object.values(world?.参战者 || {}).flatMap(value =>
    Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []
  );
}

function buildDecisionInput(definition, mutate = () => {}) {
  const input = structuredClone(definition.input);
  const world = structuredClone(input.worldSnapshot);
  const actorId = input.actorId;
  mutate(world, actorId);
  input.worldSnapshot = world;
  input.objectiveContract = structuredClone(world.胜负条件);
  input.battleIntent = { ...input.battleIntent, objectives: structuredClone(world.胜负条件) };
  return { world, actorId, input };
}

function assertCandidatesOnlyRouteSurface(request, label) {
  const fields = [
    'actionRouteCatalog',
    'actorCandidateRoutes',
    'actorProjectedWorlds',
    'actorProjectedWorldRevisions',
    'predictedOutcomeEvidenceByCandidate',
    'candidateEnvelopeDeltas',
    'teamMarginalPlan',
    'responseModelByCandidate',
    'preActionResponseProjectionByCandidate',
    'informationValueByCandidate',
  ];
  const sizes = {};
  for (const field of fields) {
    const value = request[field];
    const present = value !== undefined;
    const size = !present ? 0 : Array.isArray(value) ? value.length : Object.keys(value || {}).length;
    if (present) assert(size === 0, `${label}: CANDIDATES_ONLY surface not empty ${field}`);
    sizes[field] = { present, size };
  }
  return sizes;
}

function prepareCase(runtime, caseRecords, caseId, deficit) {
  const variant = deficit ? 'fixed_public_sp_zero' : 'base';
  const definition = caseRecords.find(item => item.caseId === caseId && item.variant === variant);
  assert(definition, `fixture missing ${caseId}`);
  const preparedInput = buildDecisionInput(definition);
  const { world, input } = preparedInput;
  const inputWorldJson = JSON.stringify(world);
  const request = runtime.decision.prepareDecisionRequest(input);
  assert(JSON.stringify(world) === inputWorldJson, `${caseId}: input world mutated`);
  assert(request.analysisDepth === 'CANDIDATES_ONLY', `${caseId}: analysis depth`);
  assert(Array.isArray(request.frozenCandidates) && request.frozenCandidates.length > 0, `${caseId}: frozen candidates`);
  const ids = request.frozenCandidates.map((candidate) => candidate.candidateId);
  assertUniqueIds(ids, `${caseId}: request candidate ids`);
  return {
    definition,
    request,
    actorId: preparedInput.actorId,
    normalizedUnitCount: assertVisibleWorldContainers(request, caseId),
    candidateOnlyRouteSurface: assertCandidatesOnlyRouteSurface(request, caseId),
  };
}

function prepareFollowUpCase(runtime, caseRecords, variant) {
  const definition = caseRecords.find(item => item.caseId === 'team_control_overlap' && item.variant === 'base');
  assert(definition, 'FOLLOW_UP fixture missing team_control_overlap');
  const expectedKey = 'follow-up-real';
  const consumerKey = variant === 'no_matching_consumer' ? 'follow-up-other' : expectedKey;
  const carrierId = ['matching_consumer', 'no_matching_consumer'].includes(variant)
    ? 'real-follow-grant'
    : `real-follow-${variant}`;
  let recipientId = '';
  let secondRecipientId = '';
  const consumerSkill = {
    id: 'public-follow-consumer',
    actionId: 'public-follow-consumer-action',
    name: 'public-follow-consumer',
    承载方式: '直接生效',
    消耗: { 魂力: 1 },
    followUpKeys: [consumerKey],
    _效果数组: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }],
  };
  if (variant === 'missing_consumer_followUpKeys') delete consumerSkill.followUpKeys;
  if (variant === 'null_consumer_followUpKeys') consumerSkill.followUpKeys = null;
  if (variant === 'invalid_consumer_followUpKeys') consumerSkill.followUpKeys = [''];
  const effect = {
    原型: '机制授予',
    目标: variant === 'multi_recipient' ? '群体' : '单体',
    触发条件: '随下次行动触发',
    授予效果: [{ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' }],
  };
  if (variant !== 'missing_key') effect['跟进行动键'] = expectedKey;
  const forcedSkill = {
    id: carrierId,
    actionId: `${carrierId}-action`,
    name: carrierId,
    承载方式: '直接生效',
    消耗: { 魂力: 1 },
    _效果数组: [effect],
  };
  const preparedInput = buildDecisionInput(definition, world => {
    const playerUnits = world.参战者.team_player;
    recipientId = playerUnits[1].id;
    secondRecipientId = playerUnits[2].id;
    playerUnits[1].技能列表 = [structuredClone(consumerSkill)];
  });
  preparedInput.input.actionOpportunity = {
    ...preparedInput.input.actionOpportunity,
    opportunityId: `relational:follow-up:${variant}`,
    forcedSkill,
    forcedTargetIds: variant === 'multi_recipient'
      ? [recipientId, secondRecipientId]
      : [recipientId],
  };
  const inputWorldJson = JSON.stringify(preparedInput.world);
  const request = runtime.decision.prepareDecisionRequest(preparedInput.input);
  assert(JSON.stringify(preparedInput.world) === inputWorldJson, `FOLLOW_UP/${variant}: input world mutated`);
  assert(request.analysisDepth === 'CANDIDATES_ONLY', `FOLLOW_UP/${variant}: analysis depth`);
  assert(Array.isArray(request.frozenCandidates) && request.frozenCandidates.length === 1, `FOLLOW_UP/${variant}: expected one frozen candidate`);
  const ids = request.frozenCandidates.map(candidate => candidate.candidateId);
  assertUniqueIds(ids, `FOLLOW_UP/${variant}: candidate ids`);
  assertVisibleWorldContainers(request, `FOLLOW_UP/${variant}`);
  const candidateOnlyRouteSurface = assertCandidatesOnlyRouteSurface(request, `FOLLOW_UP/${variant}`);
  return {
    definition,
    variant,
    request,
    expectedKey,
    recipientId,
    candidateOnlyRouteSurface,
  };
}

function assertVisibleWorldContainers(request, label) {
  const participants = request.visibleWorld?.参战者;
  assert(participants !== null && typeof participants === 'object' && !Array.isArray(participants), `${label}: visible participants`);
  let count = 0;
  for (const [side, value] of Object.entries(participants)) {
    const units = Array.isArray(value)
      ? value
      : value && typeof value === 'object'
        ? Object.values(value)
        : null;
    assert(units, `${label}: invalid participant side ${side}`);
    for (const unit of units) {
      assert(unit !== null && typeof unit === 'object' && !Array.isArray(unit), `${label}: invalid unit`);
      for (const field of ['状态效果', '持续效果']) {
        assert(OWN.call(unit, field), `${label}: ${unit.id}.${field} is not own`);
        const container = unit[field];
        const prototype = container && typeof container === 'object' ? Object.getPrototypeOf(container) : null;
        const plainObject = container !== null && typeof container === 'object' && !Array.isArray(container)
          && Object.prototype.toString.call(container) === '[object Object]'
          && (prototype === null || (OWN.call(prototype, 'constructor') && prototype.constructor?.name === 'Object' && prototype.constructor.prototype === prototype));
        assert(plainObject, `${label}: ${unit.id}.${field} is not plain object`);
      }
      count += 1;
    }
  }
  assert(count > 0, `${label}: no visible units`);
  return count;
}

function expectPrepareFatal(decision, input, label) {
  let error = null;
  try {
    decision.prepareDecisionRequest(input);
  } catch (caught) {
    error = caught;
  }
  assert(error, `${label}: expected Fatal`);
  return String(error?.message || error);
}

function assertDecisionNormalization(runtime, caseRecords) {
  const definition = caseRecords.find(item => item.caseId === 'team_control_overlap' && item.variant === 'base');
  assert(definition, 'normalization fixture missing');
  const missing = buildDecisionInput(definition, world => {
    for (const unit of unitsOfWorld(world)) {
      delete unit['状态效果'];
      delete unit['持续效果'];
    }
  });
  const missingWorldHash = runtime.preview.stableHash(missing.world);
  const missingRequest = runtime.decision.prepareDecisionRequest(missing.input);
  assert(runtime.preview.stableHash(missing.world) === missingWorldHash, 'normalization mutated input world');
  assertVisibleWorldContainers(missingRequest, 'normalization missing fields');
  assert(Array.isArray(missingRequest.evaluationContext.scheduledEvents), 'missing scheduledEvents not defaulted');
  assert(missingRequest.evaluationContext.scheduledEvents.length === 0, 'missing scheduledEvents not empty');

  const stateFatal = {};
  for (const field of ['状态效果', '持续效果']) {
    for (const [kind, value] of [['null', null], ['map', new Map([['invalid', true]])], ['array', []]]) {
      const probe = buildDecisionInput(definition, world => {
        world.参战者.team_player[0][field] = value;
      });
      const worldHash = runtime.preview.stableHash(probe.world);
      const message = expectPrepareFatal(runtime.decision, probe.input, `normalization ${field}/${kind}`);
      assert(message.startsWith('battle_decision_visible_unit_container_invalid:'), `normalization ${field}/${kind}: wrong Fatal`);
      assert(runtime.preview.stableHash(probe.world) === worldHash, `normalization ${field}/${kind}: input world mutated`);
      stateFatal[`${field}:${kind}`] = true;
    }
  }

  const scheduledFatal = {};
  for (const [kind, value] of [['null', null], ['object', {}]]) {
    const probe = buildDecisionInput(definition);
    const worldHash = runtime.preview.stableHash(probe.world);
    probe.input.runtimeSnapshot = { scheduledEvents: value };
    const message = expectPrepareFatal(runtime.decision, probe.input, `normalization scheduled/${kind}`);
    assert(message === 'battle_decision_scheduled_events_invalid', `normalization scheduled/${kind}: wrong Fatal`);
    assert(runtime.preview.stableHash(probe.world) === worldHash, `normalization scheduled/${kind}: input world mutated`);
    scheduledFatal[kind] = true;
  }

  const explicit = buildDecisionInput(definition);
  explicit.input.runtimeSnapshot = { scheduledEvents: [] };
  const explicitWorldHash = runtime.preview.stableHash(explicit.world);
  const explicitRequest = runtime.decision.prepareDecisionRequest(explicit.input);
  assert(runtime.preview.stableHash(explicit.world) === explicitWorldHash, 'explicit scheduledEvents mutated input world');
  assert(Array.isArray(explicitRequest.evaluationContext.scheduledEvents), 'explicit scheduledEvents not retained');
  assert(explicitRequest.evaluationContext.scheduledEvents.length === 0, 'explicit scheduledEvents not empty');
  return {
    missingFields: true,
    missingScheduledEvents: true,
    stateFatal,
    scheduledFatal,
    explicitScheduledEvents: true,
  };
}

function featureByCode(candidate, code) {
  const feature = candidate.features.find((item) => item.featureCode === code);
  assert(feature, `${candidate.candidateId}: missing feature ${code}`);
  return feature;
}

function operandValues(feature) {
  return Object.fromEntries(feature.operands.map((operand) => [operand.name, operand.value]));
}

function candidateByPart(output, part) {
  const candidates = output.perCandidate.filter((item) => item.candidateId.includes(part));
  assert(candidates.length === 1, `expected one candidate containing ${part}, got ${candidates.length}`);
  return candidates[0];
}

function sourceKindCounts(sourceInput) {
  const counts = { TEAM_EFFECT: 0, RESOURCE_SUPPLY: 0, FOLLOW_UP: 0 };
  for (const rows of Object.values(sourceInput.candidateEntriesById)) {
    for (const row of rows) if (OWN.call(counts, row.capabilityKind)) counts[row.capabilityKind] += 1;
  }
  return counts;
}

function assertScenario(caseId, deficit, sourceInput, output) {
  const counts = sourceKindCounts(sourceInput);
  assert(sourceInput.baselineCompletenessByAxis.TEAM_EFFECT === 'COMPLETE', `${caseId}: baseline TEAM_EFFECT not complete`);
  assert(sourceInput.baselineEntries.length === 0, `${caseId}: baseline must be empty for this fixture`);
  assert(['COMPLETE', 'PARTIAL'].includes(sourceInput.actionCatalogCompleteness), `${caseId}: invalid action catalog completeness`);
  output.perCandidate.forEach((candidate) => {
    candidate.features.slice(0, 4).forEach((feature) => {
      assert(feature.reasonCode !== 'ACTION_CATALOG_PARTIAL', `${candidate.candidateId}: FOLLOW_UP catalog blocked ${feature.featureCode}`);
    });
  });
  assert(counts.TEAM_EFFECT > 0, `${caseId}: no real TEAM_EFFECT entries`);
  if (caseId === 'team_resource_support') {
    assert(counts.RESOURCE_SUPPLY === 9, `${caseId}: expected 9 RESOURCE_SUPPLY entries, got ${counts.RESOURCE_SUPPLY}`);
    assert(sourceInput.publicConsumers.length > 0, `${caseId}: public consumer catalog empty`);
  }
  if (caseId === 'team_control_overlap') {
    const skillCandidates = output.perCandidate.filter((item) => item.candidateId.includes(':skill:'));
    assert(skillCandidates.length === 2, `${caseId}: expected two skill candidates`);
    for (const candidate of skillCandidates) {
      const marginal = featureByCode(candidate, 'TEAM_EFFECT_MARGINAL_GAIN');
      const redundancy = featureByCode(candidate, 'TEAM_EFFECT_REDUNDANCY_RATIO');
      assert(marginal.status === 'KNOWN' && marginal.value === 1, `${candidate.candidateId}: marginal baseline-empty assertion`);
      assert(redundancy.status === 'KNOWN' && redundancy.value === 0, `${candidate.candidateId}: redundancy baseline-empty assertion`);
    }
    output.perCandidate.filter((item) => !item.candidateId.includes(':skill:')).forEach((candidate) => {
      const marginal = featureByCode(candidate, 'TEAM_EFFECT_MARGINAL_GAIN');
      const redundancy = featureByCode(candidate, 'TEAM_EFFECT_REDUNDANCY_RATIO');
      assert(marginal.status === 'NOT_APPLICABLE' && marginal.reasonCode === 'NO_CANDIDATE_TEAM_EFFECT', `${candidate.candidateId}: basic marginal must be N/A`);
      assert(redundancy.status === 'NOT_APPLICABLE' && redundancy.reasonCode === 'NO_CANDIDATE_TEAM_EFFECT', `${candidate.candidateId}: basic redundancy must be N/A`);
    });
  }
  if (caseId === 'team_resource_support' && deficit) {
    const single = candidateByPart(output, ':skill:情人桥:1');
    const group = candidateByPart(output, ':skill:樱花情人桥:0');
    const singleCoverage = featureByCode(single, 'RESOURCE_DEFICIT_COVERAGE');
    const singleFit = featureByCode(single, 'RESOURCE_CONSUMER_FIT');
    const groupCoverage = featureByCode(group, 'RESOURCE_DEFICIT_COVERAGE');
    const groupFit = featureByCode(group, 'RESOURCE_CONSUMER_FIT');
    for (const [feature, value, label] of [
      [singleCoverage, 1, 'single coverage'],
      [singleFit, 1, 'single fit'],
      [groupCoverage, 1, 'group coverage'],
      [groupFit, 0.25, 'group fit'],
    ]) assert(feature.status === 'KNOWN' && feature.value === value, `${label}: expected ${value}`);
    assertEqual(operandValues(singleCoverage), { deficitCount: 1, deficitTotal: 925, suppliedTotal: 2400, coveredTotal: 925 }, 'single coverage operands');
    assertEqual(operandValues(singleFit), { consumerCount: 2, initiallyUnpayableCount: 2, newlyPayableCount: 2 }, 'single fit operands');
    assertEqual(operandValues(groupCoverage), { deficitCount: 1, deficitTotal: 925, suppliedTotal: 3108, coveredTotal: 925 }, 'group coverage operands');
    assertEqual(operandValues(groupFit), { consumerCount: 8, initiallyUnpayableCount: 2, newlyPayableCount: 2 }, 'group fit operands');
  }
  return {
    baseline: { entryCount: sourceInput.baselineEntries.length, relation: 'empty baseline; marginal/redundancy do not prove potential skill overlap' },
    sourceKindCounts: counts,
    actionCatalogCompleteness: sourceInput.actionCatalogCompleteness,
    followUp: counts.FOLLOW_UP === 0
      ? { status: 'N/A', reasonCode: 'SOURCE_FORMAL_API_NO_GRANT' }
      : { status: 'OBSERVED', grantCount: counts.FOLLOW_UP },
    formalConsumerCatalogSupported: false,
  };
}

function compactOutput(output) {
  return output.perCandidate.map((candidate) => ({
    candidateId: candidate.candidateId,
    features: candidate.features.map((feature) => ({
      featureCode: feature.featureCode,
      status: feature.status,
      ...(OWN.call(feature, 'value') ? { value: feature.value } : {}),
      reasonCode: feature.reasonCode,
    })),
  }));
}

function assertFollowUpProof(canonicalCompiler, contract, schema) {
  const legalInput = structuredClone(contract.canonicalInputExample);
  const legalCandidate = legalInput.candidateEntriesById['candidate-1'];
  const legalGrant = legalCandidate.find((entry) => entry.capabilityKind === 'FOLLOW_UP');
  const consumer = legalInput.publicConsumers.find((entry) => entry.ownerId === legalGrant.ownerId && entry.followUpKeys.includes(legalGrant.followUpKey));
  assert(consumer, 'FOLLOW_UP legal proof consumer missing');
  const legalOutput = canonicalCompiler.compileDecision(legalInput);
  validateSchema(legalOutput, schema.$defs.output, schema, 'followUp.legalOutput');
  const legalFeature = featureByCode(legalOutput.perCandidate[0], 'TEAM_FOLLOWUP_COVERAGE');
  assert(legalFeature.status === 'KNOWN' && legalFeature.value === 1, 'FOLLOW_UP own proof must be KNOWN 1');

  const noConsumerInput = structuredClone(legalInput);
  noConsumerInput.publicConsumers.forEach((entry) => { entry.followUpKeys = []; });
  const noConsumerOutput = canonicalCompiler.compileDecision(noConsumerInput);
  const noConsumerFeature = featureByCode(noConsumerOutput.perCandidate[0], 'TEAM_FOLLOWUP_COVERAGE');
  assert(noConsumerFeature.status === 'KNOWN' && noConsumerFeature.value === 0 && noConsumerFeature.reasonCode === 'OK', 'FOLLOW_UP no matching consumer must be KNOWN 0');

  const wrongOwnerInput = structuredClone(legalInput);
  const wrongOwnerGrant = wrongOwnerInput.candidateEntriesById['candidate-1'].find((entry) => entry.capabilityKind === 'FOLLOW_UP');
  wrongOwnerGrant.ownerId = 'wrong-owner';
  const wrongOwnerOutput = canonicalCompiler.compileDecision(wrongOwnerInput);
  const wrongOwnerFeature = featureByCode(wrongOwnerOutput.perCandidate[0], 'TEAM_FOLLOWUP_COVERAGE');
  assert(wrongOwnerFeature.status === 'KNOWN' && wrongOwnerFeature.value === 0 && wrongOwnerFeature.reasonCode === 'OK', 'FOLLOW_UP owner mismatch must be KNOWN 0');

  const wrongKeyInput = structuredClone(legalInput);
  const wrongKeyGrant = wrongKeyInput.candidateEntriesById['candidate-1'].find((entry) => entry.capabilityKind === 'FOLLOW_UP');
  wrongKeyGrant.followUpKey = 'wrong-follow-up';
  const wrongKeyOutput = canonicalCompiler.compileDecision(wrongKeyInput);
  const wrongKeyFeature = featureByCode(wrongKeyOutput.perCandidate[0], 'TEAM_FOLLOWUP_COVERAGE');
  assert(wrongKeyFeature.status === 'KNOWN' && wrongKeyFeature.value === 0 && wrongKeyFeature.reasonCode === 'OK', 'FOLLOW_UP key mismatch must be KNOWN 0');

  const proofOutsideOwnRefsInput = structuredClone(legalInput);
  const proofOutsideOwnRefsGrant = proofOutsideOwnRefsInput.candidateEntriesById['candidate-1'].find((entry) => entry.capabilityKind === 'FOLLOW_UP');
  proofOutsideOwnRefsGrant.grantProofIds = ['event:action:unit-1:1'];
  const proofOutsideOwnRefsFatal = expectCompilerFatal(canonicalCompiler, proofOutsideOwnRefsInput, 'followUp.proofOutsideOwnRefs');

  const proofOutsideClosureInput = structuredClone(legalInput);
  const proofOutsideClosureGrant = proofOutsideClosureInput.candidateEntriesById['candidate-1'].find((entry) => entry.capabilityKind === 'FOLLOW_UP');
  proofOutsideClosureGrant.grantProofIds = ['event:missing-proof'];
  const proofOutsideClosureFatal = expectCompilerFatal(canonicalCompiler, proofOutsideClosureInput, 'followUp.proofOutsideClosure');

  const consumerOverlapInput = structuredClone(legalInput);
  consumerOverlapInput.publicConsumers[0].sourceEventIds = ['event:candidate-followup'];
  const consumerOverlapFatal = expectCompilerFatal(canonicalCompiler, consumerOverlapInput, 'followUp.consumerOrdinaryOverlap', 'SOURCE_DISJOINT_FATAL');
  return {
    mode: 'CONTRACT_CONFORMANCE',
    formalConsumerCatalogSupported: false,
    ownProof: { status: legalFeature.status, value: legalFeature.value, reasonCode: legalFeature.reasonCode },
    noMatchingConsumer: { status: noConsumerFeature.status, value: noConsumerFeature.value, reasonCode: noConsumerFeature.reasonCode },
    ownerMismatch: { status: wrongOwnerFeature.status, value: wrongOwnerFeature.value, reasonCode: wrongOwnerFeature.reasonCode },
    keyMismatch: { status: wrongKeyFeature.status, value: wrongKeyFeature.value, reasonCode: wrongKeyFeature.reasonCode },
    proofOutsideOwnRefs: { status: 'FATAL', code: proofOutsideOwnRefsFatal },
    proofOutsideClosure: { status: 'FATAL', code: proofOutsideClosureFatal },
    consumerOrdinaryOverlap: { status: 'FATAL', code: consumerOverlapFatal },
  };
}

function expectCompilerFatal(compiler, input, label, expectedCode = 'PROOF_FATAL') {
  let error = null;
  try {
    compiler.compileDecision(input);
  } catch (caught) {
    error = caught;
  }
  assert(error, `${label}: expected Fatal`);
  assert(error.code === expectedCode, `${label}: expected ${expectedCode}, got ${error.code || error.message}`);
  return error.code;
}

function assertAdapterReferencesZero() {
  const adapterName = ['BehaviorRelationalFeature', 'Adapter_Module.js'].join('');
  const files = [FILES.source, FILES.compiler, path.join(ROOT, 'BattleDecision_Module.js'), path.join(HERE, 'run-m2-v31-relational-feature-slice.mjs')];
  let references = 0;
  assert(!fs.existsSync(path.join(ROOT, adapterName)), 'unaccepted relational adapter still exists');
  for (const file of files) references += readText(file).split(adapterName).length - 1;
  assert(references === 0, `adapter references ${references}`);
  return references;
}

const LEGACY_PREVIEW_METHODS = new Set([
  'calculateSettledSegmentDamage',
  'calculateBaseDamage',
  'buildDamageBasis',
  'assertDamageBasis',
  'damageBasisMetadata',
  'calculateBaseActionValue',
  'calculateDirectPotential',
  'calculateAtomicActionPotential',
  'calculateSequencePotential',
  'calculateUnitCapacity',
  'calculateTwoOpportunityCapacity',
  'calculateWithdrawalPressure',
  'calculateWithdrawalPressureDetails',
  'estimateWithdrawal',
  'buildWithdrawalContest',
  'calculateReactionContest',
  'calculateDefenseDamageMultiplier',
  'calculateDodgeProbability',
  'compileMechanicalBasis',
  'compileMechanicalProjectionContext',
  'deriveMechanicalProjectionContext',
  'evaluateMechanicalBasis',
  'evaluateMechanicalBasisRouteScalarColumns',
  'buildActionOperationGraph',
  'evaluateOperationGraph',
  'expandOperationGraphBranches',
  'buildLifecycleEventSet',
]);

function legacyDecisionMethodNames(surface) {
  return Object.keys(surface).filter(name =>
    typeof surface[name] === 'function' && (
      /^r8/i.test(name) ||
      /^(select|score|decide|pareto)/i.test(name) ||
      /^(actionRoute|preparedRoute|targetProfile|auditR8|buildR8)/i.test(name) ||
      ['buildTeamMarginalPlan', 'buildDependencyDeltaSet', 'buildOpportunityImpactSet'].includes(name)
    )
  ).sort();
}

function patchMethod(surface, name, replacement, patches) {
  const descriptor = Object.getOwnPropertyDescriptor(surface, name);
  assert(descriptor && descriptor.writable !== false, `formal API method not instrumentable:${name}`);
  const original = surface[name];
  surface[name] = replacement(original);
  patches.push(() => { surface[name] = original; });
}

function installRuntimeGuards(runtime, chainCalls, forbiddenCalls, patches) {
  patchMethod(runtime.decision, 'prepareDecisionRequest', original => function (...args) {
    chainCalls.prepareDecisionRequests += 1;
    return Reflect.apply(original, this, args);
  }, patches);
  patchMethod(runtime.decision, 'collectSkills', original => function (...args) {
    chainCalls.collectSkillsCalls += 1;
    return Reflect.apply(original, this, args);
  }, patches);
  patchMethod(runtime.decision, 'parseSkillCosts', original => function (...args) {
    chainCalls.parseSkillCostsCalls += 1;
    return Reflect.apply(original, this, args);
  }, patches);
  patchMethod(runtime.source, 'compilePreparedRequest', original => function (...args) {
    chainCalls.sourceCompileCalls += 1;
    return Reflect.apply(original, this, args);
  }, patches);
  patchMethod(runtime.compiler, 'compileDecision', original => function (...args) {
    chainCalls.compilerCompileCalls += 1;
    return Reflect.apply(original, this, args);
  }, patches);

  const guarded = {
    decision: legacyDecisionMethodNames(runtime.decision),
    preview: [...LEGACY_PREVIEW_METHODS]
      .filter(name => typeof runtime.preview[name] === 'function')
      .sort(),
  };
  for (const [surfaceName, names] of Object.entries(guarded)) {
    const surface = runtime[surfaceName];
    for (const name of names) {
      patchMethod(surface, name, () => function () {
        const call = `${surfaceName}.${name}`;
        forbiddenCalls.push(call);
        throw new Error(`FORBIDDEN_RELATIONAL_CHAIN_CALL:${call}`);
      }, patches);
    }
  }
  return guarded;
}

function restorePatches(patches) {
  patches.slice().reverse().forEach(restore => restore());
}

function assertFormalApiBoundary(runtime) {
  const cases = [
    ['decision-spread', Object.assign({}, runtime.decision), 'decisionApi'],
    ['decision-proxy', new Proxy(runtime.decision, {}), 'decisionApi'],
    ['preview-spread', Object.assign({}, runtime.preview), 'previewApi'],
    ['preview-proxy', new Proxy(runtime.preview, {}), 'previewApi'],
    ['pda-spread', Object.assign({}, runtime.pda), 'pdaApi'],
    ['pda-proxy', new Proxy(runtime.pda, {}), 'pdaApi'],
  ];
  const results = {};
  for (const [label, fake, expectedName] of cases) {
    const args = {
      request: {},
      previewApi: runtime.preview,
      pdaApi: runtime.pda,
      decisionApi: runtime.decision,
    };
    args[expectedName] = fake;
    let error = null;
    try {
      runtime.source.compilePreparedRequest(args);
    } catch (caught) {
      error = caught;
    }
    assert(error && String(error.message || error) === `SOURCE_FORMAL_API_REQUIRED:${expectedName}`, `${label}: formal identity gate`);
    results[label] = 'FATAL';
  }
  return results;
}

function inspectFollowUpPda(runtime, prepared) {
  const candidate = prepared.request.frozenCandidates[0];
  const effect = candidate.declaration.skill?._效果数组?.[0];
  assert(effect && effect['原型'] === '机制授予', `FOLLOW_UP/${prepared.variant}: mechanism grant effect missing`);
  const context = {
    sourceActionId: candidate.declaration.actionId,
    sourceActorId: prepared.request.actorId,
    sourceEffectId: `${candidate.declaration.actionId}:effect:0`,
    candidateTargetIds: [...candidate.declaration.targetIds],
  };
  const admission = runtime.pda.admit(effect, context);
  const projection = runtime.pda.project(effect, context);
  const scheduledFacts = Array.isArray(projection.scheduledFacts) ? projection.scheduledFacts : [];
  const scheduled = scheduledFacts.find(row => row?.grantType === 'FOLLOW_UP') || null;
  if (['matching_consumer', 'no_matching_consumer', 'missing_consumer_followUpKeys', 'null_consumer_followUpKeys', 'invalid_consumer_followUpKeys'].includes(prepared.variant)) {
    assert(admission?.admitted === true, `FOLLOW_UP/${prepared.variant}: PDA admission`);
    assert(scheduledFacts.length === 1 && scheduled, `FOLLOW_UP/${prepared.variant}: PDA scheduled grant`);
    assert(scheduled.ownerId === prepared.recipientId, `FOLLOW_UP/${prepared.variant}: PDA owner`);
    assert(scheduled.followUpKey === prepared.expectedKey, `FOLLOW_UP/${prepared.variant}: PDA followUpKey`);
  } else {
    assert(scheduledFacts.length === 0 && !scheduled, `FOLLOW_UP/${prepared.variant}: PDA must not schedule a grant`);
    const expectedReason = prepared.variant === 'missing_key'
      ? 'FOLLOW_UP_KEY_MISSING'
      : 'FOLLOW_UP_RECIPIENT_COUNT_INVALID';
    assert(projection.unsupportedOutcomeKinds?.includes(expectedReason), `FOLLOW_UP/${prepared.variant}: PDA reason`);
    if (prepared.variant === 'multi_recipient') assert(projection.deferCode === 'DEFER_MECHANICS_PROJECTION', `FOLLOW_UP/${prepared.variant}: PDA defer code`);
  }
  return {
    admitted: admission?.admitted === true,
    admissionReasons: admission?.reasons || [],
    scheduled: scheduled
      ? { entryId: scheduled.entryId, ownerId: scheduled.ownerId, followUpKey: scheduled.followUpKey, triggerKey: scheduled.triggerKey }
      : null,
    deferCode: projection.deferCode || '',
    unsupportedOutcomeKinds: projection.unsupportedOutcomeKinds || [],
  };
}

function assertFollowUpScenario(prepared, pdaTrace, sourceInput, output, closure) {
  const candidateId = prepared.request.frozenCandidates[0].candidateId;
  const rows = sourceInput.candidateEntriesById[candidateId];
  const grants = rows.filter(entry => entry.capabilityKind === 'FOLLOW_UP');
  const feature = featureByCode(output.perCandidate[0], 'TEAM_FOLLOWUP_COVERAGE');
  const malformedConsumer = ['missing_consumer_followUpKeys', 'null_consumer_followUpKeys', 'invalid_consumer_followUpKeys'].includes(prepared.variant);
  if (malformedConsumer) {
    assert(sourceInput.actionCatalogCompleteness === 'PARTIAL', `FOLLOW_UP/${prepared.variant}: catalog must be partial`);
    assert(sourceInput.candidateCompletenessByAxis[candidateId].FOLLOW_UP === 'PARTIAL', `FOLLOW_UP/${prepared.variant}: candidate must be partial`);
    assert(sourceInput.candidateCompletenessByAxis[candidateId].TEAM_EFFECT === 'COMPLETE', `FOLLOW_UP/${prepared.variant}: TEAM_EFFECT blocked`);
    assert(sourceInput.candidateCompletenessByAxis[candidateId].RESOURCE_SUPPLY === 'COMPLETE', `FOLLOW_UP/${prepared.variant}: RESOURCE_SUPPLY blocked`);
    assert(grants.length === 1, `FOLLOW_UP/${prepared.variant}: valid grant was dropped`);
    const grant = grants[0];
    assert(grant.ownerId === prepared.recipientId && grant.followUpKey === prepared.expectedKey, `FOLLOW_UP/${prepared.variant}: grant identity`);
    assertEqual(grant.grantProofIds, [pdaTrace.scheduled.entryId], `FOLLOW_UP/${prepared.variant}: grant proof identity`);
    assert(grant.sourceFactIds.includes(pdaTrace.scheduled.entryId) || grant.sourceEventIds.includes(pdaTrace.scheduled.entryId), `FOLLOW_UP/${prepared.variant}: proof own refs`);
    assert(closure.facts.has(pdaTrace.scheduled.entryId) || closure.events.has(pdaTrace.scheduled.entryId), `FOLLOW_UP/${prepared.variant}: proof closure`);
    assert(feature.status === 'UNKNOWN' && feature.reasonCode === 'ACTION_CATALOG_PARTIAL', `FOLLOW_UP/${prepared.variant}: incomplete coverage`);
    return {
      mode: 'CONTRACT_CONFORMANCE',
      formalConsumerCatalogSupported: false,
      pda: pdaTrace,
      source: { candidateId, grantEntryId: grant.grantProofIds[0], grantProofIds: grant.grantProofIds, proofInOwnRefs: true, proofInClosure: true },
      coverage: { status: feature.status, reasonCode: feature.reasonCode },
    };
  }
  const complete = ['matching_consumer', 'no_matching_consumer'].includes(prepared.variant);
  if (complete) {
    assert(grants.length === 1, `FOLLOW_UP/${prepared.variant}: expected one Source grant`);
    const grant = grants[0];
    assert(grant.ownerId === prepared.recipientId, `FOLLOW_UP/${prepared.variant}: Source owner`);
    assert(grant.followUpKey === prepared.expectedKey, `FOLLOW_UP/${prepared.variant}: Source followUpKey`);
    assertEqual(grant.grantProofIds, [pdaTrace.scheduled.entryId], `FOLLOW_UP/${prepared.variant}: grant proof identity`);
    assert(grant.sourceFactIds.includes(pdaTrace.scheduled.entryId) || grant.sourceEventIds.includes(pdaTrace.scheduled.entryId), `FOLLOW_UP/${prepared.variant}: proof own refs`);
    assert(closure.facts.has(pdaTrace.scheduled.entryId) || closure.events.has(pdaTrace.scheduled.entryId), `FOLLOW_UP/${prepared.variant}: proof closure`);
    if (sourceInput.actionCatalogCompleteness === 'PARTIAL') {
      assert(sourceInput.candidateCompletenessByAxis[candidateId].FOLLOW_UP === 'PARTIAL', `FOLLOW_UP/${prepared.variant}: partial candidate completeness`);
      assert(feature.status === 'UNKNOWN' && feature.reasonCode === 'ACTION_CATALOG_PARTIAL', `FOLLOW_UP/${prepared.variant}: partial catalog coverage`);
      return {
        mode: 'CONTRACT_CONFORMANCE',
        formalConsumerCatalogSupported: false,
        pda: pdaTrace,
        source: {
          candidateId,
          grantEntryId: grant.grantProofIds[0],
          grantProofIds: grant.grantProofIds,
          proofInOwnRefs: true,
          proofInClosure: true,
          ownerId: grant.ownerId,
          followUpKey: grant.followUpKey,
        },
        coverage: { status: feature.status, reasonCode: feature.reasonCode },
      };
    }
    assert(sourceInput.actionCatalogCompleteness === 'COMPLETE', `FOLLOW_UP/${prepared.variant}: catalog completeness`);
    assert(sourceInput.candidateCompletenessByAxis[candidateId].FOLLOW_UP === 'COMPLETE', `FOLLOW_UP/${prepared.variant}: candidate completeness`);
    const expectedValue = prepared.variant === 'matching_consumer' ? 1 : 0;
    assert(feature.status === 'KNOWN' && feature.value === expectedValue && feature.reasonCode === 'OK', `FOLLOW_UP/${prepared.variant}: coverage`);
    return {
      mode: 'CONTRACT_CONFORMANCE',
      formalConsumerCatalogSupported: false,
      pda: pdaTrace,
      source: {
        candidateId,
        grantEntryId: grant.grantProofIds[0],
        grantProofIds: grant.grantProofIds,
        proofInOwnRefs: true,
        proofInClosure: true,
        ownerId: grant.ownerId,
        followUpKey: grant.followUpKey,
      },
      coverage: { status: feature.status, value: feature.value, reasonCode: feature.reasonCode },
    };
  }
  assert(sourceInput.actionCatalogCompleteness === 'PARTIAL', `FOLLOW_UP/${prepared.variant}: catalog must be partial`);
  assert(sourceInput.candidateCompletenessByAxis[candidateId].FOLLOW_UP === 'PARTIAL', `FOLLOW_UP/${prepared.variant}: candidate must be partial`);
  assert(grants.length === 0, `FOLLOW_UP/${prepared.variant}: Source emitted a pseudo grant`);
  assert(feature.status === 'UNKNOWN' && feature.reasonCode === 'ACTION_CATALOG_PARTIAL', `FOLLOW_UP/${prepared.variant}: incomplete coverage`);
  return {
    mode: 'CONTRACT_CONFORMANCE',
    formalConsumerCatalogSupported: false,
    pda: pdaTrace,
    source: { candidateId, grantEntryId: null, grantProofIds: [], pseudoGrant: false },
    coverage: { status: feature.status, reasonCode: feature.reasonCode },
  };
}

function runGhostTargetOnce(caseRecords, contract, schema) {
  const runtime = loadRuntime();
  const chainCalls = { prepareDecisionRequests: 0, sourceCompileCalls: 0, compilerCompileCalls: 0, collectSkillsCalls: 0, parseSkillCostsCalls: 0 };
  const forbiddenCalls = [];
  const patches = [];
  const guardedMethods = installRuntimeGuards(runtime, chainCalls, forbiddenCalls, patches);
  try {
    const prepared = prepareCase(runtime, caseRecords, 'team_resource_support', false);
    const candidate = prepared.request.frozenCandidates.find(item => item.candidateId.includes(':skill:樱花情人桥:0'));
    assert(candidate, 'ghost target fixture candidate missing');
    const originalTargetIds = candidate.declaration.targetIds.slice();
    const ghostTargetId = 'ghost-target';
    const ghostRequest = {
      ...prepared.request,
      frozenCandidates: prepared.request.frozenCandidates.map(item => item === candidate
        ? { ...item, declaration: { ...item.declaration, targetIds: [ghostTargetId] } }
        : item),
    };
    const sourceStart = process.hrtime.bigint();
    const sourceInput = runtime.source.compilePreparedRequest({
      request: ghostRequest,
      previewApi: runtime.preview,
      pdaApi: runtime.pda,
      decisionApi: runtime.decision,
    });
    const sourceMs = Number(process.hrtime.bigint() - sourceStart) / 1e6;
    const requestIds = ghostRequest.frozenCandidates.map(item => item.candidateId).sort();
    const closure = validateSourceInput(sourceInput, schema, contract, requestIds);
    assertDeepFrozen(sourceInput, 'ghost target Source output');
    const ghostRows = sourceInput.candidateEntriesById[candidate.candidateId];
    assert(ghostRows.length === 0, 'ghost target emitted a Source entry');
    assertEqual(sourceInput.candidateCompletenessByAxis[candidate.candidateId], {
      TEAM_EFFECT: 'PARTIAL', RESOURCE_SUPPLY: 'PARTIAL', FOLLOW_UP: 'PARTIAL',
    }, 'ghost target completeness');
    assert(!closure.facts.has(ghostTargetId) && !closure.events.has(ghostTargetId), 'ghost target entered source closure');
    const compilerStart = process.hrtime.bigint();
    const output = runtime.compiler.compileDecision(sourceInput);
    const compilerMs = Number(process.hrtime.bigint() - compilerStart) / 1e6;
    validateCompilerOutput(output, schema, contract, sourceInput);
    assertDeepFrozen(output, 'ghost target Compiler output');
    const ghostOutput = output.perCandidate.find(item => item.candidateId === candidate.candidateId);
    assert(ghostOutput, 'ghost target Compiler candidate missing');
    for (const code of ['TEAM_EFFECT_MARGINAL_GAIN', 'RESOURCE_DEFICIT_COVERAGE']) {
      const feature = featureByCode(ghostOutput, code);
      assert(feature.status === 'UNKNOWN' && feature.reasonCode === 'AXIS_PARTIAL', `ghost target ${code}`);
    }
    assert(chainCalls.prepareDecisionRequests === 1 && chainCalls.sourceCompileCalls === 1 && chainCalls.compilerCompileCalls === 1, 'ghost target chain call count');
    assert(forbiddenCalls.length === 0, 'ghost target forbidden chain call');
    const payload = { requestHash: ghostRequest.requestHash, frozenCandidateIds: sourceInput.frozenCandidateIds, sourceInput, output };
    const determinismHash = crypto.createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex');
    return {
      variant: 'ghost_target_partial',
      candidateId: candidate.candidateId,
      originalTargetIds,
      ghostTargetId,
      source: { rows: 0, completeness: sourceInput.candidateCompletenessByAxis[candidate.candidateId], actionCatalogCompleteness: sourceInput.actionCatalogCompleteness },
      compiler: ghostOutput.features.filter(feature => ['TEAM_EFFECT_MARGINAL_GAIN', 'RESOURCE_DEFICIT_COVERAGE'].includes(feature.featureCode)).map(feature => ({ featureCode: feature.featureCode, status: feature.status, reasonCode: feature.reasonCode })),
      stageMs: { source: sourceMs, compiler: compilerMs },
      determinismHash,
      chainGuard: { ...chainCalls, forbiddenCalls: forbiddenCalls.length, forbiddenMethodCalls: forbiddenCalls, guardedMethods, reprepareOrReenumerate: 0, formalApiIdentity: true, candidatesOnlyRouteSurface: prepared.candidateOnlyRouteSurface },
    };
  } finally {
    restorePatches(patches);
  }
}

function runOnce(caseId, deficit, caseRecords, contract, schema, followUpVariant = null) {
  const runtime = loadRuntime();
  const chainCalls = {
    prepareDecisionRequests: 0,
    sourceCompileCalls: 0,
    compilerCompileCalls: 0,
    collectSkillsCalls: 0,
    parseSkillCostsCalls: 0,
  };
  const forbiddenCalls = [];
  const patches = [];
  const guardedMethods = installRuntimeGuards(runtime, chainCalls, forbiddenCalls, patches);
  try {
  const prepared = followUpVariant
    ? prepareFollowUpCase(runtime, caseRecords, followUpVariant)
    : prepareCase(runtime, caseRecords, caseId, deficit);
  const requestIds = prepared.request.frozenCandidates.map((candidate) => candidate.candidateId).sort();
  const pdaTrace = followUpVariant ? inspectFollowUpPda(runtime, prepared) : null;
  const sourceStart = process.hrtime.bigint();
  const sourceInput = runtime.source.compilePreparedRequest({
    request: prepared.request,
    previewApi: runtime.preview,
    pdaApi: runtime.pda,
    decisionApi: runtime.decision,
  });
  const sourceMs = Number(process.hrtime.bigint() - sourceStart) / 1e6;
  assert(sourceInput !== null && typeof sourceInput === 'object', `${caseId}: Source output`);
  const closure = validateSourceInput(sourceInput, schema, contract, requestIds);
  assertDeepFrozen(sourceInput, `${caseId}: Source output`);
  const compilerStart = process.hrtime.bigint();
  const output = runtime.compiler.compileDecision(sourceInput);
  const compilerMs = Number(process.hrtime.bigint() - compilerStart) / 1e6;
  validateCompilerOutput(output, schema, contract, sourceInput);
  assertDeepFrozen(output, `${caseId}: Compiler output`);
  const acceptance = followUpVariant
    ? assertFollowUpScenario(prepared, pdaTrace, sourceInput, output, closure)
    : assertScenario(caseId, deficit, sourceInput, output);
  assert(chainCalls.prepareDecisionRequests === 1, `${caseId}: prepare call count`);
  assert(chainCalls.sourceCompileCalls === 1, `${caseId}: Source call count`);
  assert(chainCalls.compilerCompileCalls === 1, `${caseId}: Compiler call count`);
  const payload = { requestHash: prepared.request.requestHash, frozenCandidateIds: sourceInput.frozenCandidateIds, sourceInput, output };
  const determinismHash = crypto.createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex');
  return {
    caseId,
    variant: followUpVariant || (deficit ? 'fixed_public_sp_zero' : 'base'),
    requestHash: prepared.request.requestHash,
    normalizedUnitCount: prepared.normalizedUnitCount,
    frozenCandidateIds: sourceInput.frozenCandidateIds,
    source: {
      baselineEntryCount: sourceInput.baselineEntries.length,
      baselineCompletenessByAxis: sourceInput.baselineCompletenessByAxis,
      candidateEntryCounts: Object.fromEntries(Object.entries(sourceInput.candidateEntriesById).map(([id, rows]) => [id, rows.length])),
      kindCounts: sourceKindCounts(sourceInput),
      publicConsumerCount: sourceInput.publicConsumers.length,
      actionCatalogCompleteness: sourceInput.actionCatalogCompleteness,
      closure: { factCount: closure.facts.size, eventCount: closure.events.size, closureHash: sourceInput.sourceClosure.closureHash },
      registryAttestation: sourceInput.registryAttestation,
    },
    compiler: compactOutput(output),
    stageMs: { source: sourceMs, compiler: compilerMs },
    determinismHash,
    acceptance,
    chainGuard: {
      ...chainCalls,
      reprepareOrReenumerate: 0,
      forbiddenCalls: forbiddenCalls.length,
      forbiddenMethodCalls: forbiddenCalls,
      guardedMethods,
      formalApiIdentity: true,
      prepareInternalInstrumented: false,
      candidatesOnlyRouteSurface: prepared.candidateOnlyRouteSurface,
    },
  };
  } finally {
    restorePatches(patches);
  }
}

async function main() {
  const contract = readJson(FILES.contract);
  const schema = readJson(FILES.schema);
  const registry = readJson(FILES.registry);
  const pdaContract = readJson(FILES.pdaContract);
  const pdaSchema = readJson(FILES.pdaSchema);
  const pdaCases = readJson(FILES.pdaCases);
  const sourceText = readText(FILES.source);
  const compilerText = readText(FILES.compiler);
  const casesArtifact = readJson(FILES.cases);
  verifyPinnedArtifacts(contract, schema, registry, pdaContract, pdaSchema, pdaCases, sourceText, compilerText, casesArtifact);
  const caseRecords = casesArtifact.cases;
  const baseHeadProbe = assertBaseHeadMechanicalLoad();
  const canonicalRuntime = loadContext(['BehaviorRelationalFeature_Module.js']);
  const canonicalCompiler = canonicalRuntime.__LWCS_BEHAVIOR_RELATIONAL_FEATURE__;
  const canonicalOutput = canonicalCompiler.compileDecision(contract.canonicalInputExample);
  assertEqual(canonicalOutput, contract.canonicalOutputExample, 'contract canonical Compiler output');
  const canonicalClosure = validateSourceInput(contract.canonicalInputExample, schema, contract);
  validateCompilerOutput(canonicalOutput, schema, contract, contract.canonicalInputExample);
  assertDeepFrozen(canonicalOutput, 'contract canonical output');
  assert(canonicalClosure.facts.size + canonicalClosure.events.size > 0, 'contract canonical closure');
  const followUp = assertFollowUpProof(canonicalCompiler, contract, schema);
  const adapterReferences = assertAdapterReferencesZero();
  const boundaryRuntime = loadRuntime();
  const formalApiBoundary = assertFormalApiBoundary(boundaryRuntime);
  const normalization = assertDecisionNormalization(boundaryRuntime, caseRecords);
  const cases = [
    ['team_control_overlap', false],
    ['team_resource_support', false],
    ['team_resource_support', true],
  ];
  const reports = [];
  for (const [caseId, deficit] of cases) {
    const first = runOnce(caseId, deficit, caseRecords, contract, schema);
    const second = runOnce(caseId, deficit, caseRecords, contract, schema);
    assert(first.determinismHash === second.determinismHash, `${caseId}/${deficit ? 'deficit' : 'base'}: nondeterministic output`);
    assert(first.chainGuard.forbiddenCalls === 0, `${caseId}: forbidden relational chain call`);
    assert(second.chainGuard.forbiddenCalls === 0, `${caseId}: forbidden relational chain call on repeat`);
    reports.push({
      caseId,
      variant: first.variant,
      deterministic: true,
      runs: 2,
      determinismHash: first.determinismHash,
      frozenCandidateCount: first.frozenCandidateIds.length,
      normalizedUnitCount: first.normalizedUnitCount,
      source: first.source,
      compiler: first.compiler,
      stageMs: { first: first.stageMs, second: second.stageMs },
      acceptance: first.acceptance,
      formalConsumerCatalogSupported: false,
      chainGuard: first.chainGuard,
    });
  }
  const followUpReports = [];
  for (const variant of ['matching_consumer', 'no_matching_consumer', 'missing_consumer_followUpKeys', 'null_consumer_followUpKeys', 'invalid_consumer_followUpKeys', 'missing_key', 'multi_recipient']) {
    const first = runOnce('team_control_overlap', false, caseRecords, contract, schema, variant);
    const second = runOnce('team_control_overlap', false, caseRecords, contract, schema, variant);
    assert(first.determinismHash === second.determinismHash, `FOLLOW_UP/${variant}: nondeterministic output`);
    assert(first.chainGuard.forbiddenCalls === 0, `FOLLOW_UP/${variant}: forbidden relational chain call`);
    assert(second.chainGuard.forbiddenCalls === 0, `FOLLOW_UP/${variant}: forbidden relational chain call on repeat`);
    followUpReports.push({
      variant,
      deterministic: true,
      runs: 2,
      determinismHash: first.determinismHash,
      frozenCandidateIds: first.frozenCandidateIds,
      source: first.source,
      compiler: first.compiler,
      stageMs: { first: first.stageMs, second: second.stageMs },
      acceptance: first.acceptance,
      formalConsumerCatalogSupported: false,
      chainGuard: first.chainGuard,
    });
  }
  const ghostFirst = runGhostTargetOnce(caseRecords, contract, schema);
  const ghostSecond = runGhostTargetOnce(caseRecords, contract, schema);
  assert(ghostFirst.determinismHash === ghostSecond.determinismHash, 'ghost target: nondeterministic output');
  assert(ghostFirst.chainGuard.forbiddenCalls === 0 && ghostSecond.chainGuard.forbiddenCalls === 0, 'ghost target: forbidden relational chain call');
  console.log(JSON.stringify({
    status: 'PASS',
    pinned: HASHES,
    hashAlgorithm: HASH_ALGORITHM,
    baseHead: baseHeadProbe,
    cases: { file: path.relative(ROOT, FILES.cases).split(path.sep).join('/'), count: caseRecords.length, bytes: fs.statSync(FILES.cases).size, sha256Utf8Lf: HASHES.cases },
    contract: { revision: contract.revision, schemaVersion: contract.schemaVersion, canonicalInput: true, canonicalOutput: true },
    registry: { rowCount: 27, battleScopeCount: 23, sourceEmbeddedMappingExact: true },
    productionJs: Object.fromEntries(MECHANICAL_MODULES.map(file => [file, PRODUCTION_JS_HASHES[file]])),
    loadedMechanicalModules: MECHANICAL_MODULES,
    forbiddenModulesLoaded: 0,
    adapterReferences,
    formalConsumerCatalogSupported: false,
    formalApiBoundary,
    normalization,
    followUp,
    followUpReports,
    ghostTarget: { ...ghostFirst, deterministic: true, runs: 2, repeatStageMs: ghostSecond.stageMs },
    reports,
    checks: {
      sourceInputSchema: true,
      compilerOutputSchema: true,
      candidateClosure: true,
      sourceClosure: true,
      featureOrderOperandsRefs: true,
      deepFreeze: true,
      determinism: true,
      forbiddenChainCalls: 0,
      candidatesOnlyRouteSurfaceEmpty: true,
      formalApiIdentity: true,
      adapterReferences,
    },
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error?.stack || error) }, null, 2));
  process.exitCode = 1;
}

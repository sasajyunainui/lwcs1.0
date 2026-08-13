import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(THIS_DIR, '..', '..', '..');
const RUNTIME_RELATIVE_PATH = 'MVU_Skill_Runtime.js';
const PREVIEW_RELATIVE_PATH = 'BattlePreview_Module.js';
const SCOPE_RELATIVE_PATH = 'tools/rc6/cases/BattleMechanismPrototypeScopeV1.json';
const SCHEMA_VERSION = 'PrototypePathUniverseV1';
const NUMERIC_TYPES = new Set(['数字', '整数', '带符号数值']);

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function createRuntimeSandbox() {
  const sandbox = {
    console,
    structuredClone,
    Math: Object.create(Math),
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    Reflect,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Intl,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    performance: { now: () => 0 },
    crypto: globalThis.crypto,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.parent = sandbox;
  sandbox.top = sandbox;
  return sandbox;
}

function loadCurrentSources(repoRoot) {
  const runtimePath = path.join(repoRoot, RUNTIME_RELATIVE_PATH);
  const previewPath = path.join(repoRoot, PREVIEW_RELATIVE_PATH);
  const scopePath = path.join(repoRoot, SCOPE_RELATIVE_PATH);
  const runtimeSource = readUtf8(runtimePath);
  const previewSource = readUtf8(previewPath);
  const scope = JSON.parse(readUtf8(scopePath));
  const sandbox = createRuntimeSandbox();
  vm.createContext(sandbox);
  vm.runInContext(runtimeSource, sandbox, { filename: RUNTIME_RELATIVE_PATH });
  sandbox.__LWCS_BATTLE_EVENT_CONTRACT__ = { schemaVersion: '8.3-battle-event-contract-1' };
  vm.runInContext(previewSource, sandbox, { filename: PREVIEW_RELATIVE_PATH });
  const registry = sandbox.__LWCS_SKILL_MECHANISM_REGISTRY__?.原型定义;
  const skillRegistry = sandbox.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
  if (!registry || typeof registry !== 'object') throw new Error('PROTOTYPE_UNIVERSE_REGISTRY_MISSING');
  if (!preview || typeof preview.compileMechanicalBasis !== 'function') {
    throw new Error('PROTOTYPE_UNIVERSE_PREVIEW_ADMISSION_MISSING');
  }
  return {
    registry,
    skillRegistry,
    preview,
    scope,
    sourceHashes: {
      [RUNTIME_RELATIVE_PATH]: sha256(runtimeSource),
      [PREVIEW_RELATIVE_PATH]: sha256(previewSource),
      [SCOPE_RELATIVE_PATH]: sha256(readUtf8(scopePath)),
    },
  };
}

function classifyPrototype(prototype, definition) {
  const category = String(definition?.类别 || '').trim();
  if (!category) throw new Error(`PROTOTYPE_UNIVERSE_CATEGORY_MISSING:${prototype}`);
  return category === '战斗外' ? 'OUT_OF_BATTLE' : 'IN_BATTLE';
}

function scopeEntriesByPrototype(scope, key) {
  return new Map((Array.isArray(scope?.[key]) ? scope[key] : []).map((entry, index) => [
    String(entry?.prototype || '').trim(),
    { entry, index },
  ]));
}

function assertScopeMatchesRegistry(registry, scope) {
  const included = scopeEntriesByPrototype(scope, 'includedPrototypes');
  const excluded = scopeEntriesByPrototype(scope, 'excludedPrototypes');
  const registryNames = Object.keys(registry);
  if (registryNames.length !== 27) throw new Error(`PROTOTYPE_UNIVERSE_REGISTRY_COUNT:${registryNames.length}`);
  for (const [prototype, definition] of Object.entries(registry)) {
    const partition = classifyPrototype(prototype, definition);
    const map = partition === 'IN_BATTLE' ? included : excluded;
    const row = map.get(prototype);
    if (!row) throw new Error(`PROTOTYPE_UNIVERSE_SCOPE_MISSING:${prototype}`);
    if (partition === 'OUT_OF_BATTLE' && row.entry.reason !== 'OUT_OF_BATTLE_SCOPE') {
      throw new Error(`PROTOTYPE_UNIVERSE_SCOPE_REASON:${prototype}`);
    }
  }
  if (included.size !== 23 || excluded.size !== 4) {
    throw new Error(`PROTOTYPE_UNIVERSE_SCOPE_PARTITION:${included.size}:${excluded.size}`);
  }
  for (const prototype of [...included.keys(), ...excluded.keys()]) {
    if (!Object.prototype.hasOwnProperty.call(registry, prototype)) {
      throw new Error(`PROTOTYPE_UNIVERSE_SCOPE_UNKNOWN:${prototype}`);
    }
  }
  return { included, excluded };
}

function previewAdmission(preview, baseEffect) {
  const basis = preview.compileMechanicalBasis({
    actorId: 'prototype-path-universe',
    declaration: {
      actionKind: 'RELEASE_SKILL',
      skill: { _效果数组: [clone(baseEffect)] },
    },
  });
  const reasons = Array.isArray(basis?.unsupportedReasons)
    ? basis.unsupportedReasons.map(item => String(item))
    : [];
  return {
    evaluated: true,
    admitted: reasons.length === 0,
    reasons,
  };
}

function addFormCounter(counters, partition, type, finiteOptionCount = 0) {
  const target = counters.byPartition[partition];
  target.fieldCount += 1;
  if (finiteOptionCount > 0) {
    target.finiteOptionFieldCount += 1;
    target.finiteOptionPathCount += finiteOptionCount;
  }
  counters.totalFieldCount += 1;
  counters.byType[type] = (counters.byType[type] || 0) + 1;
}

function buildFormCounters(registry, prototypePartition, skillRegistry = {}) {
  const counters = {
    finiteOption: {
      fieldCount: 0,
      pathCount: 0,
      byDeclaredType: {},
      byPartition: {
        IN_BATTLE: { fieldCount: 0, pathCount: 0 },
        OUT_OF_BATTLE: { fieldCount: 0, pathCount: 0 },
      },
    },
    numeric: { fieldCount: 0, byType: {} },
    text: { fieldCount: 0, finiteOptionFieldCount: 0 },
    object: { fieldCount: 0 },
    condition: { fieldCount: 0 },
    boolean: { fieldCount: 0 },
    prototypeList: { fieldCount: 0 },
    nestedEffect: {
      registryNestedEffectFields: [],
      registryConditionBranchEffectFields: [],
      registryEffectSlotFields: [],
    },
    structural: { fieldCount: 0 },
    totalFieldCount: 0,
    byType: {},
    byPartition: {
      IN_BATTLE: { fieldCount: 0, finiteOptionFieldCount: 0, finiteOptionPathCount: 0 },
      OUT_OF_BATTLE: { fieldCount: 0, finiteOptionFieldCount: 0, finiteOptionPathCount: 0 },
    },
  };
  for (const [prototype, definition] of Object.entries(registry)) {
    const partition = prototypePartition.get(prototype);
    for (const [field, fieldDefinition] of Object.entries(definition?.字段定义 || {})) {
      const type = String(fieldDefinition?.类型 || '未知').trim() || '未知';
      const options = Array.isArray(fieldDefinition?.选项) ? fieldDefinition.选项 : [];
      if (field === '原型') {
        addFormCounter(counters, partition, type);
        counters.structural.fieldCount += 1;
        continue;
      }
      addFormCounter(counters, partition, type, options.length);
      if (options.length) {
        counters.finiteOption.fieldCount += 1;
        counters.finiteOption.pathCount += options.length;
        counters.finiteOption.byDeclaredType[type] = (counters.finiteOption.byDeclaredType[type] || 0) + options.length;
        counters.finiteOption.byPartition[partition].fieldCount += 1;
        counters.finiteOption.byPartition[partition].pathCount += options.length;
      }
      if (NUMERIC_TYPES.has(type)) {
        counters.numeric.fieldCount += 1;
        counters.numeric.byType[type] = (counters.numeric.byType[type] || 0) + 1;
      } else if (type === '文本') {
        counters.text.fieldCount += 1;
        if (options.length) counters.text.finiteOptionFieldCount += 1;
      } else if (type === '对象') counters.object.fieldCount += 1;
      else if (type === '条件分支') counters.condition.fieldCount += 1;
      else if (type === '布尔') counters.boolean.fieldCount += 1;
      else if (type === '原型列表') counters.prototypeList.fieldCount += 1;
      else if (!options.length) counters.structural.fieldCount += 1;
    }
  }
  counters.nestedEffect.registryNestedEffectFields = [...(skillRegistry.嵌套效果数组字段 || [])];
  counters.nestedEffect.registryConditionBranchEffectFields = [...(skillRegistry.条件分支效果数组字段 || [])];
  counters.nestedEffect.registryEffectSlotFields = [...(skillRegistry.技能效果槽位字段 || [])];
  return counters;
}

function buildSupportStatus(admitted) {
  if (admitted) {
    return {
      mechanics: 'CURRENT_SUPPORTED',
      policy: 'CURRENT_SUPPORTED',
      runtime: 'CURRENT_SUPPORTED',
      report: 'CURRENT_SUPPORTED',
    };
  }
  return {
    mechanics: 'CURRENT_UNSUPPORTED',
    policy: 'PENDING_M3',
    runtime: 'CURRENT_UNSUPPORTED',
    report: 'PENDING_M3',
  };
}

function buildPrototypePathUniverse(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const { registry, skillRegistry, preview, scope, sourceHashes } = loadCurrentSources(repoRoot);
  if (scope?.schemaVersion !== 'BattleMechanismPrototypeScopeV1') {
    throw new Error('PROTOTYPE_UNIVERSE_SCOPE_SCHEMA');
  }
  const scopeMaps = assertScopeMatchesRegistry(registry, scope);
  const prototypePartition = new Map(Object.entries(registry).map(([prototype, definition]) => [
    prototype,
    classifyPrototype(prototype, definition),
  ]));
  const admissions = new Map();
  const paths = [];
  for (const [prototype, definition] of Object.entries(registry)) {
    const partition = prototypePartition.get(prototype);
    const scopeRow = (partition === 'IN_BATTLE' ? scopeMaps.included : scopeMaps.excluded).get(prototype);
    const admission = partition === 'IN_BATTLE'
      ? previewAdmission(preview, scopeRow.entry.baseEffect)
      : { evaluated: false, admitted: false, reasons: ['OUT_OF_BATTLE_SCOPE'] };
    admissions.set(prototype, {
      prototype,
      category: definition.类别,
      partition,
      ...admission,
    });
    for (const [field, fieldDefinition] of Object.entries(definition?.字段定义 || {})) {
      if (field === '原型') continue;
      const optionsForField = Array.isArray(fieldDefinition?.选项) ? fieldDefinition.选项 : [];
      if (!optionsForField.length) continue;
      optionsForField.forEach((option, optionIndex) => {
        const admitted = partition === 'IN_BATTLE' && admission.admitted;
        const reason = partition === 'OUT_OF_BATTLE'
          ? 'OUT_OF_BATTLE_SCOPE'
          : admitted
            ? 'CURRENT_BATTLE_PREVIEW_ADMISSION'
            : `CURRENT_BATTLE_PREVIEW_ADMISSION_UNSUPPORTED:${admission.reasons.join(',')}`;
        const row = {
          pathId: `PPU1:${partition}:${prototype}:${field}:${optionIndex}`,
          scope: partition,
          category: String(definition.类别 || ''),
          prototype,
          field,
          fieldType: String(fieldDefinition?.类型 || '未知'),
          optionIndex,
          option: clone(option),
          finiteOption: true,
          sourcePointer: `MVU_Skill_Runtime.js::__LWCS_SKILL_MECHANISM_REGISTRY__.原型定义[${JSON.stringify(prototype)}].字段定义[${JSON.stringify(field)}].选项[${optionIndex}]`,
          scopePointer: `${SCOPE_RELATIVE_PATH}#/${partition === 'IN_BATTLE' ? 'includedPrototypes' : 'excludedPrototypes'}/${scopeRow.index}`,
          previewAdmission: {
            evaluated: admission.evaluated,
            admitted: admission.admitted,
          },
          supportStatus: buildSupportStatus(admitted),
          reason,
          reasonByDimension: admitted
            ? {
                mechanics: reason,
                policy: reason,
                runtime: reason,
                report: reason,
              }
            : {
                mechanics: reason,
                policy: 'PENDING_M3_MAPPING',
                runtime: reason,
                report: 'PENDING_M3_MAPPING',
              },
        };
        paths.push(row);
      });
    }
  }
  const expected = scope.expected || {};
  const inBattlePaths = paths.filter(row => row.scope === 'IN_BATTLE');
  const outOfBattlePaths = paths.filter(row => row.scope === 'OUT_OF_BATTLE');
  if (inBattlePaths.length !== expected.includedOptionPathCount || outOfBattlePaths.length !== expected.excludedOptionPathCount) {
    throw new Error(`PROTOTYPE_UNIVERSE_PATH_COUNT:${inBattlePaths.length}:${outOfBattlePaths.length}`);
  }
  const unsupportedDecisionPaths = inBattlePaths.filter(row => row.supportStatus.mechanics === 'CURRENT_UNSUPPORTED');
  if (unsupportedDecisionPaths.length !== 247) throw new Error(`PROTOTYPE_UNIVERSE_UNSUPPORTED_COUNT:${unsupportedDecisionPaths.length}`);
  const categoryCounts = {};
  for (const [prototype, definition] of Object.entries(registry)) {
    const category = String(definition.类别 || '');
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }
  const output = {
    schemaVersion: SCHEMA_VERSION,
    universeId: 'RC6-M1-PROTOTYPE-PATH-UNIVERSE-2026-08-13',
    authority: {
      currentRegistryAndScopeOnly: true,
      currentBattlePreviewAdmissionOnly: true,
      historicalEvidenceUsed: false,
      productionDecisionOrKernelImported: false,
    },
    sourceFiles: {
      runtime: RUNTIME_RELATIVE_PATH,
      previewAdmission: PREVIEW_RELATIVE_PATH,
      scope: SCOPE_RELATIVE_PATH,
    },
    sourceHashes,
    registrySummary: {
      prototypeCount: Object.keys(registry).length,
      inBattlePrototypeCount: new Set(inBattlePaths.map(row => row.prototype)).size,
      outOfBattlePrototypeCount: new Set(outOfBattlePaths.map(row => row.prototype)).size,
      categoryCounts,
      expected: {
        prototypeCount: expected.registryPrototypeCount,
        inBattlePrototypeCount: expected.includedPrototypeCount,
        outOfBattlePrototypeCount: expected.excludedPrototypeCount,
      },
    },
    partitions: {
      IN_BATTLE: { prototypeCount: scopeMaps.included.size, pathCount: inBattlePaths.length },
      OUT_OF_BATTLE: { prototypeCount: scopeMaps.excluded.size, pathCount: outOfBattlePaths.length },
      totalPathCount: paths.length,
    },
    previewAdmission: [...admissions.values()],
    formCounters: buildFormCounters(registry, prototypePartition, skillRegistry),
    paths,
    unsupportedDecisionPaths,
    unsupportedDecisionPathCount: unsupportedDecisionPaths.length,
  };
  return output;
}

function serializeUniverse(universe) {
  return `${JSON.stringify(universe, null, 2)}\n`;
}

function writeOutputUnderGenerated(repoRoot, outputPath, contents) {
  const generatedRoot = path.resolve(repoRoot, 'tools/rc6/generated');
  const resolved = path.resolve(repoRoot, outputPath);
  const relative = path.relative(generatedRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('PROTOTYPE_UNIVERSE_OUTPUT_OUTSIDE_GENERATED');
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, contents, 'utf8');
}

function isMainModule() {
  return process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const repoRoot = DEFAULT_REPO_ROOT;
    const universe = buildPrototypePathUniverse({ repoRoot });
    const serialized = serializeUniverse(universe);
    const outputIndex = process.argv.indexOf('--output');
    if (outputIndex >= 0) {
      const outputPath = process.argv[outputIndex + 1];
      if (!outputPath) throw new Error('PROTOTYPE_UNIVERSE_OUTPUT_MISSING');
      writeOutputUnderGenerated(repoRoot, outputPath, serialized);
    } else {
      process.stdout.write(serialized);
    }
  } catch (error) {
    process.stderr.write(`${String(error?.stack || error)}\n`);
    process.exitCode = 1;
  }
}

export { buildPrototypePathUniverse, previewAdmission, serializeUniverse };

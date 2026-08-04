import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm3', 'm3-b04-path-source-audit.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

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
  Map,
  Set,
  WeakMap,
  WeakSet,
  Symbol,
  parseInt,
  parseFloat,
  isNaN,
  Intl,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('MVU_Skill_Runtime.js'), sandbox, { filename: 'MVU_Skill_Runtime.js' });

const registry = sandbox.__LWCS_SKILL_MECHANISM_REGISTRY__?.原型定义;
if (!registry || typeof registry !== 'object') throw new Error('M3_B04_MECHANISM_REGISTRY_MISSING');

const rows = Object.entries(registry).map(([prototype, definition]) => {
  let optionCount = 0;
  const fields = [];
  for (const [field, fieldDefinition] of Object.entries(definition?.字段定义 || {})) {
    if (field === '原型') continue;
    const options = Array.isArray(fieldDefinition?.选项) ? fieldDefinition.选项 : [];
    optionCount += options.length;
    fields.push({ field, optionCount: options.length });
  }
  return { prototype, optionCount, fields };
});
const currentPrototypeCount = rows.length;
const currentOptionCount = rows.reduce((total, row) => total + row.optionCount, 0);
const expectedPrototypeCount = 23;
const expectedPathCount = 621;
const output = {
  schemaVersion: 'M3B04PathSourceAuditV1',
  milestoneId: 'M3',
  taskId: 'M3-B04',
  status: currentPrototypeCount === expectedPrototypeCount && currentOptionCount === expectedPathCount
    ? 'LEGACY_SHAPE_MATCH_REQUIRES_R9V2_PATH_PROOF'
    : 'CURRENT_SOURCE_DOES_NOT_DEFINE_621',
  sourceKind: 'CURRENT_MECHANISM_REGISTRY_ONLY',
  targetProvider: 'r9v2_unregistered_test_registry_only',
  expectedFromOpenGate: {
    prototypeCount: expectedPrototypeCount,
    pathCount: expectedPathCount,
  },
  observedCurrentSource: {
    prototypeCount: currentPrototypeCount,
    optionPathCount: currentOptionCount,
    rows,
  },
  interpretation: {
    currentSourceDefines621: currentPrototypeCount === expectedPrototypeCount && currentOptionCount === expectedPathCount,
    r9v2PathSchemaPresent: false,
    r9v2PathFixturePresent: false,
    oldR8EnumCountAccepted: false,
    sourceAuditIsPathCoverage: false,
  },
  historicalComparison: {
    source: 'tools/audit_battle_r83_phase8.mjs',
    operation: 'Enumerate the old R8 mechanism registry field options and call R8 Preview for each option.',
    provider: 'r8',
    acceptedAsR9v2Coverage: false,
  },
  sourceHashes: {
    'MVU_Skill_Runtime.js': sha256(read('MVU_Skill_Runtime.js')),
    'tools/audit_battle_r83_phase8.mjs': sha256(read('tools/audit_battle_r83_phase8.mjs')),
    'tools/rc6/contracts/BehaviorPlanningContractV1.json': sha256(read('tools/rc6/contracts/BehaviorPlanningContractV1.json')),
    'tools/rc6/contracts/M1FixtureManifestV1.json': sha256(read('tools/rc6/contracts/M1FixtureManifestV1.json')),
    'tools/rc6/harness/audit-m3-b04-path-source.mjs': sha256(read('tools/rc6/harness/audit-m3-b04-path-source.mjs')),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  status: output.status,
  currentPrototypeCount,
  currentOptionCount,
  expectedPathCount,
}, null, 2)}\n`);

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'runtime-boundary-manifest.json');
const coreFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
];
const candidateHarnesses = [
  'tools/r83_rc6_battle_harness.mjs',
  'tools/r83_rc6_target_kernel_k1_ab.mjs',
  'tools/r83_rc6_target_kernel_k4_audit.mjs',
];
const candidateTargetFiles = [
  'BattleDecisionR9v2Kernel_Module.js',
  'tools/rc6/ReferenceValueEvaluator.mjs',
  'tools/rc6/reference-value-evaluator.mjs',
];
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (args, options = {}) => execFileSync('git', args, {
  cwd: repoRoot,
  windowsHide: true,
  maxBuffer: 128 * 1024 * 1024,
  ...options,
});
const read = fileName => fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
const rawHash = fileName => sha256(fs.readFileSync(path.join(repoRoot, fileName)));
const gitHeadHash = fileName => {
  try { return git(['rev-parse', `HEAD:${fileName}`], { encoding: 'utf8' }).trim(); }
  catch { return null; }
};
const fileManifest = fileName => ({
  path: fileName,
  exists: fs.existsSync(path.join(repoRoot, fileName)),
  worktreeSha256: fs.existsSync(path.join(repoRoot, fileName)) ? rawHash(fileName) : null,
  headBlobSha256: gitHeadHash(fileName),
});
const decisionSource = read('BattleDecision_Module.js');
const runtimeSource = read('BattleRuntime_Module.js');
const bridgeSource = read('mvu_logic_bridge.js');
const entrySource = read('ST_UI_Entry.js');
const providerBlock = decisionSource.match(/const providerRegistry = Object\.freeze\(\{([\s\S]*?)\n\s*\}\);/u)?.[1] || '';
const providerIds = [...providerBlock.matchAll(/(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:/gu)]
  .map(match => match[1] || match[2] || match[3])
  .filter(Boolean);
const runtimeProviderWindow = runtimeSource.match(/function executeBattleDraftR8[\s\S]{0,9000}/u)?.[0] || '';
const runtimeProviderIds = [...runtimeProviderWindow.matchAll(/['"](legacy-baseline|r74-next-baseline|r8-shadow|r8|r9|r9v2-shadow|r9v2)['"]/gu)]
  .map(match => match[1]);
const moduleRegistryText = entrySource.match(/const 模块注册表 = \{([\s\S]*?)\n\s*\};/u)?.[0] || '';
const orderNames = ['核心模块顺序', '启动预取模块顺序', '正常启动追踪模块顺序', '热更新追踪模块顺序'];
const staticLoader = {
  defaultResourceBaseUrl: entrySource.match(/默认资源基础地址\s*=\s*['"]([^'"]+)['"]/u)?.[1] || null,
  resourceBaseOverrideExpression: entrySource.match(/const 资源基础地址 = \(\(\) => \{([\s\S]*?)\n\s*\}\)\(\);/u)?.[1]?.trim() || null,
  resourceCandidateOverrideKey: '__LWCS_资源基础地址候选列表__',
  resourceVersionSuffix: entrySource.match(/资源版本后缀\s*=\s*['"]([^'"]*)['"]/u)?.[1] ?? null,
  vueRemoteUrl: entrySource.match(/Vue远程地址\s*=\s*['"]([^'"]+)['"]/u)?.[1] || null,
  moduleRegistrySha256: sha256(moduleRegistryText),
  moduleRegistryBytes: Buffer.byteLength(moduleRegistryText, 'utf8'),
  battleModuleRegistryLines: moduleRegistryText.split(/\r?\n/u)
    .filter(line => /战斗预估运行时|战斗决策运行时|战斗运行时|战斗战报运行时|战斗模块/u.test(line)),
  loadOrderSnippets: Object.fromEntries(orderNames.map(name => [
    name,
    entrySource.match(new RegExp(`const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`, 'u'))?.[1]?.trim() || null,
  ])),
  runtimeFetch: 'NOT_RUN_BY_POLICY',
  runtimeOverrideValue: 'UNKNOWN_UNTIL_HOST_EXECUTION',
};
const boundaryEvidence = {
  bridgeDefaultProvider: bridgeSource.match(/providerId:\s*['"]([^'"]+)['"]/u)?.[1] || null,
  providerRegistryIds: [...new Set(providerIds)],
  runtimeAcceptedProviderIds: [...new Set(runtimeProviderIds)],
  r9v2ReachableBeforeSwitch: providerIds.includes('r9v2') && runtimeProviderIds.includes('r9v2'),
  r9v2StrictlyIsolatedBeforeSwitch: false,
  publicRuntimeEntrypoint: /executeBattleDraftR8/.test(runtimeSource),
  independentTargetKernel: candidateTargetFiles.some(fileName => fs.existsSync(path.join(repoRoot, fileName))),
  independentReferenceEvaluator: candidateTargetFiles.slice(1).some(fileName => fs.existsSync(path.join(repoRoot, fileName))),
};
const sourceFiles = [...coreFiles, ...candidateHarnesses, ...candidateTargetFiles]
  .filter((fileName, index, list) => list.indexOf(fileName) === index)
  .map(fileManifest);
const outputCore = {
  schemaVersion: 'RuntimeBoundaryManifestV1',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  generatedAt: new Date().toISOString(),
  repository: {
    name: 'lwcs',
    branch: git(['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    parent: git(['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim(),
    coreAutocrlf: git(['config', '--get', 'core.autocrlf'], { encoding: 'utf8' }).trim() || null,
    dirtyPatchSha256: sha256(git(['-c', 'core.quotePath=false', 'diff', '--binary', '--no-ext-diff', 'HEAD', '--', '.'], { encoding: null })),
  },
  sourceFiles,
  providerBoundary: boundaryEvidence,
  staticLoader,
  runtimeVerification: {
    mode: 'STATIC_SOURCE_ONLY',
    externalResourceHashes: 'NOT_CAPTURED_WITHOUT_HOST_RUNTIME',
    webpageValidation: 'NOT_RUN_BY_POLICY',
    status: 'STATIC_BOUNDARY_CAPTURED_RUNTIME_SOURCE_PENDING',
  },
  nextRequiredAction: 'Build the isolated target kernel and harness before M2; do not register r9v2 formally before M7.',
};
const output = { ...outputCore, manifestHash: sha256(JSON.stringify(outputCore)) };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  manifestHash: output.manifestHash,
  head: output.repository.head,
  dirtyPatchSha256: output.repository.dirtyPatchSha256,
  bridgeDefaultProvider: boundaryEvidence.bridgeDefaultProvider,
  providerRegistryIds: boundaryEvidence.providerRegistryIds,
  runtimeAcceptedProviderIds: boundaryEvidence.runtimeAcceptedProviderIds,
  r9v2ReachableBeforeSwitch: boundaryEvidence.r9v2ReachableBeforeSwitch,
  independentTargetKernel: boundaryEvidence.independentTargetKernel,
  runtimeVerification: output.runtimeVerification.status,
}, null, 2)}\n`);

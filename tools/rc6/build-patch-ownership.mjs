import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const diagnosticPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'legacy-patch-ownership-diagnostic.json');
const baselinePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'baseline', 'manifest.json');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'patch-ownership-manifest.json');
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const classificationByNumber = {
  1: 'KEEP',
  2: 'MIGRATE',
  3: 'KEEP',
  4: 'KEEP',
  5: 'KEEP',
  6: 'KEEP',
  7: 'REMOVE',
  8: 'COUNTEREXAMPLE_REQUIRED',
  9: 'COUNTEREXAMPLE_REQUIRED',
  10: 'COUNTEREXAMPLE_REQUIRED',
  11: 'COUNTEREXAMPLE_REQUIRED',
  12: 'REMOVE',
  13: 'REMOVE',
  14: 'REMOVE',
  15: 'MIGRATE',
  16: 'MIGRATE',
  17: 'REMOVE',
  18: 'MIGRATE',
  19: 'MIGRATE',
  20: 'MIGRATE',
  21: 'COUNTEREXAMPLE_REQUIRED',
  22: 'MIGRATE',
  23: 'MIGRATE',
  24: 'MIGRATE',
  25: 'MIGRATE',
  26: 'MIGRATE',
  27: 'COUNTEREXAMPLE_REQUIRED',
  28: 'MIGRATE',
  29: 'MIGRATE',
  30: 'MIGRATE',
  31: 'MIGRATE',
  32: 'MIGRATE',
  33: 'REMOVE',
  34: 'REMOVE',
  35: 'REMOVE',
};
const responsibilityByClass = {
  KEEP: 'M2-K02/M2-K04',
  MIGRATE: 'M2-K04/M2-K07',
  REMOVE: 'M0-E05',
  COUNTEREXAMPLE_REQUIRED: 'M2-K04/M2-K07',
};
const protectionByNumber = {
  1: '缺失机械值与null的键一致；缺失值与已定义值必须产生不同键。',
  2: '单个单位重建后的增量索引必须与完整重建逐项一致。',
  3: '仅一个依赖键变化必须判脏；全部相等必须复用。',
  4: 'undefined与null归一一致，缺失值变为实际值必须判脏。',
  5: 'baseline defined/branch undefined与反向情况都必须被检测。',
  6: '依赖键变化即使没有scope也必须重建。',
  7: '删除实验值缓存后候选、Proof、Ledger和Report仍保持基线结果。',
  8: '单位值修订、无关单位变化、同值不同pool对象分别验证命中与失效边界。',
  9: '相同结构不同对象与相同revision不同内容分别验证复用边界。',
  10: '同一pool重复查询可命中；单位值、分支和干扰率变化必须失效。',
  11: '顺序交换、反向访问和相邻分支交替访问必须等于完整重建。',
  12: '删除配套初始化移动后普通缓存miss仍必须正确初始化。',
  13: '值缓存重建前必须先证明全字段、选择、Ledger和Report等价。',
  14: '缓存淘汰不得改变对象、候选顺序、Proof来源或内存上界。',
  15: '单个依赖Entry变化必须使对应组件失效，无关组件仍可复用。',
  16: '成功与失败观察分支不得共享错误组件；同分支重复读取可命中。',
  17: '纯格式变化删除不得改变运行结果。',
  18: 'pool依赖内容变化时上下文Hash变化，无关世界字段变化时可复用。',
  19: '分支交换、交替访问和重复访问保持隔离与确定性。',
  20: '相同entry但pool内容不同不得命中。',
  21: '状态、召唤、资源、延迟效果和位移等输入均不得被错误标为无依赖。',
  22: '六个组件的pool签名变化必须与实际脏组件一致。',
  23: '依赖Entry变化必须重建；无关Entry变化必须保留复用。',
  24: '分支更新dependencyOwners不得修改基准pool。',
  25: '分支更新targetSourceUnitIds不得修改基准pool。',
  26: '单位死亡、退场和删除后不残留sourceUnitId。',
  27: '只改变非actor单位或targetSource关系时，结果必须等于完整重建。',
  28: 'overlay只描述本分支变化；可变Set不得跨分支共享。',
  29: 'changedUnitIds、beliefKeys和scopes组合必须覆盖所有脏单位。',
  30: 'full fallback必须覆盖该单位全部候选，不能读取旧Entry。',
  31: '任意重建顺序和单位删除/新增组合后索引必须等于全量reindex。',
  32: '懒物化、重复物化、删除和交错访问必须保持索引和Proof等价。',
  33: '删除实验值缓存接线后信息分支仍使用已验证路径。',
  34: '删除共享实验缓存后候选、机械事实和Proof保持一致。',
  35: '删除当前候选实验缓存接线后机械事实和Proof保持一致。',
};
if (!Array.isArray(diagnostic.hunks) || diagnostic.hunks.length !== 35) {
  throw new Error('RC6_PATCH_HUNK_COUNT_INVALID');
}
const hunks = diagnostic.hunks.map((hunk, index) => {
  const number = index + 1;
  const classification = classificationByNumber[number];
  if (!classification) throw new Error(`RC6_PATCH_HUNK_CLASSIFICATION_MISSING:${number}`);
  return {
    hunkId: hunk.hunkId,
    file: hunk.file,
    oldRange: hunk.oldRange,
    newRange: hunk.newRange,
    symbol: hunk.nearestSymbol,
    classification,
    responsibilityTask: responsibilityByClass[classification],
    protectionExample: protectionByNumber[number],
    inheritedOwnership: {
      owner: hunk.ownership?.owner || null,
      confidence: hunk.ownership?.confidence || null,
    },
    acceptance: classification === 'KEEP' ? 'CURRENT_BASELINE_CANDIDATE' : 'NOT_ACCEPTED_IN_CLEAN_BASELINE',
  };
});
const counts = hunks.reduce((result, hunk) => {
  result[hunk.classification] = (result[hunk.classification] || 0) + 1;
  return result;
}, {});
const outputCore = {
  schemaVersion: 'PatchOwnershipManifestV1',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  generatedAt: new Date().toISOString(),
  repository: baseline.repository,
  sourceHashes: Object.fromEntries(Object.entries(baseline.sourceFiles).map(([fileName, value]) => [fileName, value.sha256])),
  dirtyPatch: baseline.dirtyPatch,
  hunkSummary: {
    total: hunks.length,
    unowned: hunks.filter(hunk => !hunk.classification).length,
    allOwned: hunks.every(hunk => Boolean(hunk.classification)),
    classificationCounts: counts,
  },
  inheritance: {
    acceptedOnlyFromCurrentHash: true,
    oldDiagnosticIsHistoricalInput: true,
    excludedPaths: baseline.scope.excludedPaths,
  },
  hunks,
};
const output = { ...outputCore, manifestHash: sha256(JSON.stringify(outputCore)) };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  manifestHash: output.manifestHash,
  total: hunks.length,
  unowned: output.hunkSummary.unowned,
  classificationCounts: counts,
}, null, 2)}\n`);

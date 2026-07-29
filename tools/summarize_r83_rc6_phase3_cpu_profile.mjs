import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './r83_rc6_battle_harness.mjs';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0
    ? String(process.argv[index + 1] || '').trim()
    : fallback;
}

function round(value) {
  return Number(Number(value || 0).toFixed(3));
}

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const inputPath = path.resolve(
  repoRoot,
  argValue(
    'input',
    'tools/evidence/r8/r83_rc6_phase3_cpu_profile_current/CPU.20260729.183819.46332.0.001.cpuprofile',
  ),
);
const outputPath = path.resolve(
  repoRoot,
  argValue(
    'output',
    'tools/evidence/r8/r83_rc6_phase3_cpu_profile_summary_2026-07-29.json',
  ),
);
const profile = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const nodesById = new Map(
  (profile.nodes || []).map(node => [node.id, node]),
);
const parentById = new Map();
(profile.nodes || []).forEach(node => {
  (node.children || []).forEach(childId => {
    parentById.set(childId, node.id);
  });
});

const selfMicrosById = new Map();
(profile.samples || []).forEach((nodeId, index) => {
  const delta = Number(profile.timeDeltas?.[index] || 0);
  selfMicrosById.set(
    nodeId,
    Number(selfMicrosById.get(nodeId) || 0) + delta,
  );
});

function inclusiveMicros(nodeId) {
  let total = 0;
  selfMicrosById.forEach((micros, sampledNodeId) => {
    let currentId = sampledNodeId;
    while (currentId) {
      if (currentId === nodeId) {
        total += micros;
        break;
      }
      currentId = parentById.get(currentId);
    }
  });
  return total;
}

function callPath(nodeId) {
  const frames = [];
  let currentId = nodeId;
  while (currentId) {
    const node = nodesById.get(currentId);
    const name = String(node?.callFrame?.functionName || '').trim();
    if (name && name !== '(root)') frames.push(name);
    currentId = parentById.get(currentId);
  }
  return frames.reverse();
}

const selectedNames = new Set([
  'prepareR9v2ControlResourceSlice',
  'r9v2CandidateValueProof',
  'r9v2PrepareObserverPool',
  'r9v2BuildMechanicalEntry',
  'r9v2BehaviorPoolDeltaProjection',
  'r9v2ProjectedBehaviorPool',
  'r9v2CreationConsumerProjection',
  'r9v2BestCreationConsumerRoute',
  'r9v2ProjectHealthAndTerminal',
  'r9v2PrepareCurrentIncomingProjection',
  'r9v2CurrentIncomingResponseProjection',
  'hashBattleValue',
  'attestBattleDraft',
]);
const selectedNodes = (profile.nodes || [])
  .filter(node =>
    selectedNames.has(
      String(node?.callFrame?.functionName || '').trim(),
    )
  )
  .map(node => ({
    nodeId: node.id,
    functionName: String(
      node?.callFrame?.functionName || '',
    ).trim(),
    source: String(node?.callFrame?.url || '').trim(),
    line: Number(node?.callFrame?.lineNumber || 0) + 1,
    sampleHitCount: Number(node?.hitCount || 0),
    selfMs: round(Number(selfMicrosById.get(node.id) || 0) / 1000),
    inclusiveMs: round(inclusiveMicros(node.id) / 1000),
    callPath: callPath(node.id),
  }))
  .sort((left, right) =>
    right.inclusiveMs - left.inclusiveMs ||
    right.selfMs - left.selfMs ||
    left.nodeId - right.nodeId
  );

const topSelfNodes = (profile.nodes || [])
  .map(node => ({
    nodeId: node.id,
    functionName:
      String(node?.callFrame?.functionName || '').trim() ||
      '(anonymous)',
    source: String(node?.callFrame?.url || '').trim(),
    line: Number(node?.callFrame?.lineNumber || 0) + 1,
    selfMs: round(Number(selfMicrosById.get(node.id) || 0) / 1000),
    callPath: callPath(node.id),
  }))
  .filter(row => row.selfMs > 0)
  .sort((left, right) =>
    right.selfMs - left.selfMs ||
    left.nodeId - right.nodeId
  )
  .slice(0, 40);

const evidence = {
  schemaVersion: 'R9v2Phase3CpuProfileSummaryV1',
  generatedAt: new Date().toISOString(),
  sourceProfile: {
    path: path.relative(repoRoot, inputPath).replaceAll('\\', '/'),
    sha256: sha256(fs.readFileSync(inputPath)),
    startTime: Number(profile.startTime || 0),
    endTime: Number(profile.endTime || 0),
    sampledMs: round(
      (profile.timeDeltas || [])
        .reduce((sum, value) => sum + Number(value || 0), 0) /
        1000,
    ),
    nodeCount: (profile.nodes || []).length,
    sampleCount: (profile.samples || []).length,
  },
  interpretationLimits: [
    'CPU采样会增加墙钟开销；本产物只用于调用归属和相对热点定位。',
    'inclusiveMs包含子调用，同一函数的递归或不同调用路径不能直接相加作为端到端时间。',
    'sampleHitCount是采样命中数，不是正式调用次数。',
  ],
  selectedNodes,
  topSelfNodes,
  factsOnly: true,
  automaticConclusionGenerated: false,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify({
  outputPath,
  evidenceHash: sha256(evidence),
  sampledMs: evidence.sourceProfile.sampledMs,
  selectedNodeCount: selectedNodes.length,
}, null, 2)}\n`);

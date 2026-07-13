import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
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
for (const relativePath of ['lwcs/MVU_Skill_Runtime.js', 'lwcs/BattlePreview_Module.js', 'lwcs/BattleDecision_Module.js', 'lwcs/BattleRuntime_Module.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
assert.ok(runtime, '战斗运行时未加载');
assert.equal(runtime.probabilitySucceeds(0, 0), false, '0%在投点0时成功');
assert.equal(runtime.probabilitySucceeds(0, 1), false, '0%在投点1时成功');
assert.equal(runtime.probabilitySucceeds(1, 0), true, '100%在投点0时失败');
assert.equal(runtime.probabilitySucceeds(1, 1), true, '100%在投点1时失败');

function distribution(probability, sampleCount = 10000) {
  let successes = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const roll = (Math.imul(index + 1, 0x9e3779b1) >>> 0) / 4294967296;
    if (runtime.probabilitySucceeds(probability, roll)) successes += 1;
  }
  const expected = probability * sampleCount;
  const sigma = Math.sqrt(sampleCount * probability * (1 - probability));
  const lower = Math.floor(expected - 4 * sigma);
  const upper = Math.ceil(expected + 4 * sigma);
  assert.ok(successes >= lower && successes <= upper, `${probability * 100}%分布越界:${successes}/${lower}-${upper}`);
  return { probability, sampleCount, successes, expected, lower, upper };
}

const distributions = [distribution(0.01), distribution(0.99)];
const traces = [];
const fatals = [];
const queue = runtime.createActionQueue({
  round: 1,
  describeActor: entry => String(entry?.name || ''),
  onTrace: trace => traces.push(trace),
  onFatal: fatal => fatals.push(fatal),
});
for (let index = 1; index <= 64; index += 1) {
  assert.equal(queue.enqueue({ actorEntry: { name: `单位${index}` }, grantId: `grant:${index}` }), true, `第${index}个节点未能入队`);
}
assert.equal(queue.enqueue({ actorEntry: { name: '超限单位' }, grantId: 'grant:65' }), false, '第65个节点未触发上限');
assert.equal(queue.fatal?.code, 'ACTION_QUEUE_NODE_LIMIT_EXCEEDED', '节点超限fatal错误');

const duplicateQueue = runtime.createActionQueue({ round: 1 });
assert.equal(duplicateQueue.enqueue({ actorEntry: { name: '甲' }, grantId: 'same-grant' }), true);
assert.equal(duplicateQueue.enqueue({ actorEntry: { name: '乙' }, grantId: 'same-grant' }), false);
assert.equal(duplicateQueue.fatal?.code, 'ACTION_GRANT_DUPLICATE', '重复授权fatal错误');

const output = {
  summary: {
    boundaryCount: 4,
    distributionCount: distributions.length,
    queueNodeLimit: 64,
    passed: true,
  },
  distributions,
  nodeLimitFatal: fatals[0] || null,
  traceCount: traces.length,
};
console.log(JSON.stringify(output, null, 2));

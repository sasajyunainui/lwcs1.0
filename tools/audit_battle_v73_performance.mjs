import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const baselineCommit = 'da9720b';
const warmupIterations = Math.max(0, Number.parseInt(process.env.BATTLE_PERF_WARMUPS || '5', 10) || 0);
const measuredIterations = Math.max(1, Number.parseInt(process.env.BATTLE_PERF_ITERATIONS || '15', 10) || 15);
const battleRounds = Math.max(1, Number.parseInt(process.env.BATTLE_PERF_ROUNDS || '5', 10) || 5);
const teamSize = Math.max(1, Math.min(7, Number.parseInt(process.env.BATTLE_PERF_TEAM_SIZE || '7', 10) || 7));
const explicitShape = Object.hasOwn(process.env, 'BATTLE_PERF_TEAM_SIZE') || Object.hasOwn(process.env, 'BATTLE_PERF_ROUNDS');
const compareBaseline = process.env.BATTLE_PERF_COMPARE_BASELINE === '1';
const enforceThreshold = process.env.BATTLE_PERF_ENFORCE !== '0';
const progressEnabled = process.env.BATTLE_PERF_PROGRESS === '1';
const diagnosticsEnabled = process.env.BATTLE_PERF_DIAGNOSTICS === '1';
const progressPath = path.resolve('artifacts/battle_v73_performance_progress.log');
function writeProgress(message) {
  if (!progressEnabled) return;
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  fs.appendFileSync(progressPath, `[${new Date().toISOString()}] ${String(message || '').trim()}\n`, 'utf8');
}
if (progressEnabled) {
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  fs.writeFileSync(progressPath, '', 'utf8');
}

function makeNode() {
  return {
    style: {}, dataset: {}, isConnected: true, innerHTML: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 10, right: 800, width: 600, height: 500 }; },
  };
}

function instrumentLegacyTeamBattleSource(source) {
  const replaceOnce = (text, search, replacement, label) => {
    const index = text.indexOf(search);
    if (index < 0) throw new Error(`performance_instrument_anchor_missing:${label}`);
    if (text.indexOf(search, index + search.length) >= 0) throw new Error(`performance_instrument_anchor_duplicated:${label}`);
    return `${text.slice(0, index)}${replacement}${text.slice(index + search.length)}`;
  };
  let instrumented = replaceOnce(
    source,
    `          const startingRound = Number(combatData.回合 || 0);\n\n          while (rounds < maxRounds) {\n            rounds++;`,
    `          const startingRound = Number(combatData.回合 || 0);\n          root.__LWCS_PERF_ROUND_TIMINGS__ = [];\n\n          while (rounds < maxRounds) {\n            const __performanceRoundStarted = performance.now();\n            rounds++;`,
    'round_start',
  );
  instrumented = replaceOnce(
    instrumented,
    `            logs.push(\`[团战回合总结] 我方存活:\${teamPlayerAlive} 敌方存活:\${teamEnemyAlive}\`);\n\n            if (teamPlayerAlive <= 0 || teamEnemyAlive <= 0) {`,
    `            logs.push(\`[团战回合总结] 我方存活:\${teamPlayerAlive} 敌方存活:\${teamEnemyAlive}\`);\n            root.__LWCS_PERF_ROUND_TIMINGS__.push(performance.now() - __performanceRoundStarted);\n\n            if (teamPlayerAlive <= 0 || teamEnemyAlive <= 0) {`,
    'round_end',
  );
  return replaceOnce(
    instrumented,
    `        }\n\n        function runTeamBattleRound(combatData) {`,
    `        }\n\n        root.__LWCS_PERF_RUN_TEAM_BATTLE__ = runTeamBattleSimulation;\n\n        function runTeamBattleRound(combatData) {`,
    'runner_export',
  );
}

function instrumentCurrentTeamBattleSources(uiSource, runtimeSource) {
  const replaceOnce = (text, search, replacement, label) => {
    const index = text.indexOf(search);
    if (index < 0) throw new Error(`performance_instrument_anchor_missing:${label}`);
    if (text.indexOf(search, index + search.length) >= 0) throw new Error(`performance_instrument_anchor_duplicated:${label}`);
    return `${text.slice(0, index)}${replacement}${text.slice(index + search.length)}`;
  };
  let instrumentedRuntime = replaceOnce(
    runtimeSource,
    `    let lastAlive = adapters.readAlive(combatData);\n    let objectiveResolution = adapters.evaluateTerminal?.({ combatData, currentRound: startingRound, rounds, roundCompleted: false }) || null;\n    while (rounds < roundLimit && objectiveResolution?.terminal !== true) {\n      rounds += 1;`,
    `    let lastAlive = adapters.readAlive(combatData);\n    let objectiveResolution = adapters.evaluateTerminal?.({ combatData, currentRound: startingRound, rounds, roundCompleted: false }) || null;\n    root.__LWCS_PERF_ROUND_TIMINGS__ = [];\n    while (rounds < roundLimit && objectiveResolution?.terminal !== true) {\n      const __performanceRoundStarted = performance.now();\n      rounds += 1;`,
    'runtime_round_start',
  );
  instrumentedRuntime = replaceOnce(
    instrumentedRuntime,
    `      if (queueResult?.fatal || lastAlive.playerAlive <= 0 || lastAlive.enemyAlive <= 0) break;`,
    `      root.__LWCS_PERF_ROUND_TIMINGS__.push(performance.now() - __performanceRoundStarted);\n      if (queueResult?.fatal || lastAlive.playerAlive <= 0 || lastAlive.enemyAlive <= 0) break;`,
    'runtime_round_end',
  );
  const instrumentedUi = replaceOnce(
    uiSource,
    `        function runTeamBattleRound(combatData) {`,
    `        root.__LWCS_PERF_RUN_TEAM_BATTLE__ = runTeamBattleSimulation;\n\n        function runTeamBattleRound(combatData) {`,
    'current_runner_export',
  );
  return { instrumentedUi, instrumentedRuntime };
}

function createSandbox(source, runtimeSource = '') {
  let randomState = 0x63a5f17d;
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
    Math: deterministicMath, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol,
    parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder, performance,
    navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' },
    innerWidth: 1440, innerHeight: 900,
    getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1440, clientHeight: 900 },
    createElement: () => makeNode(), body: { appendChild() {} }, head: { appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.__LWCS_PERF_RESET_RANDOM__ = () => { randomState = 0x63a5f17d; };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.resolve('lwcs/MVU_Skill_Runtime.js'), 'utf8'), sandbox, { filename: 'MVU_Skill_Runtime.js' });
  if (runtimeSource) {
    vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattlePreview_Module.js'), 'utf8'), sandbox, { filename: 'BattlePreview_Module.js' });
    vm.runInContext(fs.readFileSync(path.resolve('lwcs/BattleDecision_Module.js'), 'utf8'), sandbox, { filename: 'BattleDecision_Module.js' });
  }
  const currentSources = runtimeSource ? instrumentCurrentTeamBattleSources(source, runtimeSource) : null;
  vm.runInContext(currentSources?.instrumentedRuntime || fs.readFileSync(path.resolve('lwcs/BattleRuntime_Module.js'), 'utf8'), sandbox, { filename: 'BattleRuntime_Module.js' });
  vm.runInContext(currentSources?.instrumentedUi || instrumentLegacyTeamBattleSource(source), sandbox, { filename: 'BattleUI_Module.js' });
  const recordNode = Object.assign(makeNode(), { id: 'ui-battle-record-terminal' });
  const scopeNode = Object.assign(makeNode(), { querySelector: selector => selector === '#ui-battle-record-terminal' ? recordNode : null });
  new sandbox.BattleUIComponent({ innerHTML: '', querySelector: selector => selector === '.battle-module-scope' ? scopeNode : null }, {}, {});
  assert.equal(typeof sandbox.__LWCS_DEBUG_RUN_BATTLE_CASE__, 'function', '性能基线缺少正式调试入口');
  assert.equal(typeof sandbox.__LWCS_PERF_RUN_TEAM_BATTLE__, 'function', '性能基线缺少团战性能入口');
  return sandbox;
}

function buildUnit(name, side, index) {
  const type = index % 3 === 0 ? '强攻系' : index % 3 === 1 ? '敏攻系' : '控制系';
  return {
    name, 名称: name, type, 系别: type,
    属性: {
      等级: 45, 系别: type,
      HP: 500000, HP上限: 500000,
      体力: 90000, 体力上限: 90000,
      魂力: 120000, 魂力上限: 120000,
      精神力: 60000, 精神力上限: 60000,
      力量: 220 + index * 4, 防御: 180 + index * 3, 敏捷: 160 + index * 5,
      状态效果: {},
    },
    状态: { 存活: true, 位置: side === 'player' ? '演武场西侧' : '演武场东侧', 行动: '战斗' },
    状态效果: {}, 持续效果: {}, 背包: {},
    第1武魂: {
      表象名称: `${name}武魂`, 系别: type,
      第1魂环: {
        第1魂技: {
          魂技名: `${name}冲击`, 技能分类: '输出', 目标: '敌方单体', 消耗: '魂力:120', 前摇: 8,
          _效果数组: [{ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 55, 伤害类型: '远程攻击' }],
        },
      },
    },
  };
}

function buildCase() {
  return {
    回合: 0, 战斗类型: `${teamSize}v${teamSize}性能回归`, 战斗意图: '点到为止', 进行中: true,
    参战者: {
      team_player: Array.from({ length: teamSize }, (_, index) => buildUnit(`我方${index + 1}`, 'player', index)),
      team_enemy: Array.from({ length: teamSize }, (_, index) => buildUnit(`敌方${index + 1}`, 'enemy', index + teamSize)),
    },
  };
}

function canonicalize(value) {
  const idMap = new Map();
  const visit = (item, key = '') => {
    if (Array.isArray(item)) return item.map(entry => visit(entry, key));
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().filter(name => !/^(generatedAt|timestamp|时间戳)$/i.test(name)).map(name => [name, visit(item[name], name)]));
    }
    if (typeof item === 'string' && /(?:Id|Ids|ID|IDs|id|ids)$/.test(key) && item) {
      if (!idMap.has(item)) idMap.set(item, `id_${String(idMap.size + 1).padStart(4, '0')}`);
      return idMap.get(item);
    }
    return item;
  };
  return visit(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function metricDelta(before = {}, after = {}) {
  return Object.fromEntries(Object.keys(after).filter(key => key !== 'cacheSize').map(key => [
    key,
    key === 'maxNodesObserved' ? Number(after[key] || 0) : Number(after[key] || 0) - Number(before[key] || 0),
  ]));
}

function runOnce(sandbox, sequence) {
  writeProgress(`run:${sequence}:start`);
  sandbox.__LWCS_PERF_RESET_RANDOM__?.();
  sandbox.__LWCS_BATTLE_PREVIEW__?.clearCache?.();
  const metricsBefore = sandbox.__LWCS_BATTLE_PREVIEW__?.readMetrics?.() || {};
  const combatData = buildCase();
  const started = performance.now();
  const result = sandbox.__LWCS_PERF_RUN_TEAM_BATTLE__(combatData, battleRounds);
  const elapsed = performance.now() - started;
  const metricsAfter = sandbox.__LWCS_BATTLE_PREVIEW__?.readMetrics?.() || {};
  assert.equal(result.rounds, battleRounds, `${teamSize}v${teamSize} 性能案例没有连续推进${battleRounds}回合:${result.rounds}`);
  const roundTimings = Array.isArray(sandbox.__LWCS_PERF_ROUND_TIMINGS__)
    ? sandbox.__LWCS_PERF_ROUND_TIMINGS__.map(Number)
    : [];
  assert.equal(roundTimings.length, battleRounds, `${teamSize}v${teamSize} 性能案例缺少逐回合采样:${roundTimings.length}/${battleRounds}`);
  writeProgress(`run:${sequence}:done ${elapsed.toFixed(3)}ms`);
  const selectedActions = (result.decisions || []).map(entry => ({
    round: Number(entry?.round || 0),
    actorId: String(entry?.actorId || ''),
    actionRole: String(entry?.actionRole || ''),
    candidateId: String(entry?.selected?.candidateId || ''),
    objectiveUtility: Number(entry?.selected?.objectiveUtility || 0),
  }));
  return {
    elapsed,
    roundTimings,
    metrics: metricDelta(metricsBefore, metricsAfter),
    selectedActions,
    finalUnits: Object.fromEntries(Object.entries(combatData?.参战者 || {}).map(([side, units]) => [side, (Array.isArray(units) ? units : Object.values(units || {})).map(unit => ({
      id: String(unit?.id || unit?.name || unit?.名称 || ''),
      hp: Number(unit?.hp ?? unit?.HP ?? unit?.属性?.HP ?? 0),
      sp: Number(unit?.sp ?? unit?.魂力 ?? unit?.属性?.魂力 ?? 0),
    }))])),
    hashes: {
      decision: digest(selectedActions),
      belief: digest(result.beliefObservations || []),
      ledger: digest(result.eventLedger || result.ledger || combatData.__battleEventLedger || []),
      trace: digest(result.resolutionTrace || result.trace || combatData.__battleResolutionTrace || []),
      snapshot: digest(result.snapshot || combatData),
      report: digest(result.reportBlocks || []),
    },
  };
}

const median = values => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const workerMode = String(process.env.BATTLE_PERF_WORKER || '').trim();
if (workerMode) {
  const source = workerMode === 'baseline'
    ? execFileSync('git', ['-C', 'lwcs', 'show', `${baselineCommit}:BattleUI_Module.js`], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
    : fs.readFileSync(path.resolve('lwcs/BattleUI_Module.js'), 'utf8');
  const runtimeSource = workerMode === 'current' ? fs.readFileSync(path.resolve('lwcs/BattleRuntime_Module.js'), 'utf8') : '';
  const sandbox = createSandbox(source, runtimeSource);
  const elapsedMs = [];
  const roundTimingSamples = [];
  const metricSamples = [];
  const hashSamples = [];
  const selectedActionSamples = [];
  const finalUnitSamples = [];
  for (let index = 0; index < warmupIterations + measuredIterations; index += 1) {
    const run = runOnce(sandbox, `${workerMode}:${index + 1}`);
    elapsedMs.push(run.elapsed);
    roundTimingSamples.push(run.roundTimings);
    metricSamples.push(run.metrics);
    hashSamples.push(run.hashes);
    selectedActionSamples.push(run.selectedActions);
    finalUnitSamples.push(run.finalUnits);
  }
  console.log(JSON.stringify({
    elapsedMs,
    roundTimingSamples,
    metricSamples,
    hashSamples,
    ...(diagnosticsEnabled ? { selectedActionSamples, finalUnitSamples } : {}),
  }));
} else {
  const launchWorker = (mode, timeoutMs, shape, allowTimeout = false) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BATTLE_PERF_WORKER: mode,
        BATTLE_PERF_PROGRESS: '0',
        BATTLE_PERF_TEAM_SIZE: String(shape.teamSize),
        BATTLE_PERF_ROUNDS: String(shape.rounds),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut && allowTimeout) {
        resolve({ timedOut: true, elapsedLowerBound: timeoutMs, roundTimings: [] });
        return;
      }
      if (timedOut) {
        reject(new Error(`performance_worker_timeout:${mode}:${timeoutMs}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`performance_worker_failed:${mode}:${code}:${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`performance_worker_output_invalid:${mode}:${error?.message || error}:${stdout.slice(-1000)}`));
      }
    });
  });
  writeProgress('workers:start');
  const baselineTimeoutMs = Math.max(30000, Number.parseInt(process.env.BATTLE_PERF_BASELINE_TIMEOUT_MS || '120000', 10) || 120000);
  const currentTimeoutMs = Math.max(30000, Number.parseInt(process.env.BATTLE_PERF_CURRENT_TIMEOUT_MS || '180000', 10) || 180000);
  const shapes = explicitShape
    ? [{ teamSize, rounds: battleRounds, absoluteTargetMs: teamSize === 1 && battleRounds === 20 ? 1500 : 5000 }]
    : [
        { teamSize: 1, rounds: 20, absoluteTargetMs: 1500 },
        { teamSize: 7, rounds: 5, absoluteTargetMs: 5000 },
      ];
  const summaries = [];
  for (const shape of shapes) {
    const currentRun = await launchWorker('current', currentTimeoutMs, shape);
    const baselineRun = compareBaseline
      ? await launchWorker('baseline', baselineTimeoutMs, shape, true)
      : { skipped: true, elapsedMs: [] };
    const currentMs = currentRun.elapsedMs.slice(warmupIterations, warmupIterations + measuredIterations);
    assert.equal(currentMs.length, measuredIterations, `当前性能样本不足:${currentMs.length}/${measuredIterations}`);
    const currentMedianMs = median(currentMs);
    const baselineSkipped = baselineRun.skipped === true;
    const baselineTimedOut = baselineRun.timedOut === true;
    const baselineMs = baselineSkipped || baselineTimedOut ? [] : baselineRun.elapsedMs.slice(warmupIterations, warmupIterations + measuredIterations);
    if (!baselineSkipped && !baselineTimedOut) assert.equal(baselineMs.length, measuredIterations, `基线性能样本不足:${baselineMs.length}/${measuredIterations}`);
    const baselineMedianMs = baselineSkipped || baselineTimedOut ? null : median(baselineMs);
    const ratio = baselineSkipped || baselineTimedOut ? null : currentMedianMs / Math.max(0.001, baselineMedianMs);
    const targetMet = currentMedianMs <= shape.absoluteTargetMs;
    const ratioMet = ratio == null || ratio <= 1.25;
    const measuredHashes = currentRun.hashSamples.slice(warmupIterations, warmupIterations + measuredIterations);
    const hashKeys = Object.keys(measuredHashes[0] || {});
    const unstableHashKeys = hashKeys.filter(key => new Set(measuredHashes.map(sample => sample?.[key])).size !== 1);
    const hashesStable = measuredHashes.length === measuredIterations && unstableHashKeys.length === 0;
    const measuredMetrics = currentRun.metricSamples.slice(warmupIterations, warmupIterations + measuredIterations);
    const medianMetrics = Object.fromEntries(Object.keys(measuredMetrics[0] || {}).map(key => [key, median(measuredMetrics.map(sample => Number(sample?.[key] || 0))) ]));
    const warnings = [];
    if (!targetMet) warnings.push(`PERFORMANCE_TARGET_NOT_MET:${currentMedianMs.toFixed(3)}>${shape.absoluteTargetMs}`);
    if (!hashesStable) warnings.push(`PERFORMANCE_HASH_UNSTABLE:${unstableHashKeys.join(',')}`);
    summaries.push({
      baselineCommit,
      battleShape: `${shape.teamSize}v${shape.teamSize}x${shape.rounds}`,
      warmupIterations,
      measuredIterations,
      baselineSkipped,
      baselineTimedOut,
      baselineTimeoutMs,
      baselineMs: baselineMs.map(value => Number(value.toFixed(3))),
      currentMs: currentMs.map(value => Number(value.toFixed(3))),
      baselineMedianMs: baselineMedianMs == null ? null : Number(baselineMedianMs.toFixed(3)),
      currentMedianMs: Number(currentMedianMs.toFixed(3)),
      baselineTotalMs: baselineSkipped || baselineTimedOut ? null : Number(baselineRun.elapsedMs.reduce((sum, value) => sum + value, 0).toFixed(3)),
      baselineTotalLowerBoundMs: baselineTimedOut ? Number(baselineRun.elapsedLowerBound || baselineTimeoutMs) : null,
      currentTotalMs: Number(currentRun.elapsedMs.reduce((sum, value) => sum + value, 0).toFixed(3)),
      medianMetrics,
      representativeHashes: measuredHashes[0] || {},
      hashesStable,
      unstableHashKeys,
      ratio: ratio == null ? null : Number(ratio.toFixed(4)),
      ratioBasis: baselineSkipped ? 'phase_12_absolute_targets' : baselineTimedOut ? 'absolute_target_only' : 'measured_battle_median',
      threshold: 1.25,
      absoluteTargetMs: shape.absoluteTargetMs,
      targetMet,
      ratioMet,
      enforceThreshold,
      warningCount: warnings.length,
      warnings,
      passed: hashesStable && (!enforceThreshold || (targetMet && ratioMet)),
    });
  }
  writeProgress('workers:done');
  const summary = {
    shapeCount: summaries.length,
    passedCount: summaries.filter(item => item.passed).length,
    failedCount: summaries.filter(item => !item.passed).length,
    warningCount: summaries.reduce((sum, item) => sum + item.warningCount, 0),
    passed: summaries.every(item => item.passed),
  };
  const output = { summary, shapes: summaries };
  const evidencePath = path.resolve('artifacts/battle_v73_performance.json');
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify(output, null, 2));
  if (!summary.passed) process.exitCode = 1;
}

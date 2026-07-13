import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const args = process.argv.slice(2);
const acceptSamples = args.includes('--accept-samples');
const full = args.includes('--full');
const requestedCaseIndex = args.indexOf('--case');
const requestedCase = requestedCaseIndex >= 0 ? String(args[requestedCaseIndex + 1] || '').trim() : '';
const mode = requestedCase ? 'case' : full ? 'full' : 'quick';
if (acceptSamples && mode !== 'full') {
  console.error('[battle-gate] --accept-samples 只能与 --full 同时使用');
  process.exit(2);
}
const artifactsDir = path.resolve(root, 'artifacts');
const outputPath = path.join(artifactsDir, 'battle_ui_v23_regression_gate.json');
fs.mkdirSync(artifactsDir, { recursive: true });
const maxOutputBytes = 1024 * 1024 * 128;

const utf8ScanTargets = [
  'lwcs/BattleUI_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/LWCS_Database_Adapter.js',
  'lwcs/mvu_logic_bridge.js',
  'lwcs/mvu_styles.css',
  'lwcs/battle_report_decision_samples_100.txt',
  'lwcs/tools/audit_battle_r63_baseline.mjs',
  'lwcs/tools/audit_battle_r63_queue_probability.mjs',
  'lwcs/tools/audit_battle_r63_preview_foundation.mjs',
  'lwcs/tools/audit_battle_r63_prototype_matrix.mjs',
  'lwcs/tools/audit_battle_r63_prototype_e2e.mjs',
  'lwcs/tools/audit_battle_r63_decision.mjs',
  'lwcs/tools/audit_battle_r63_belief_deep_preview.mjs',
  'lwcs/tools/audit_battle_r63_scenario_matrix.mjs',
  'lwcs/tools/audit_battle_r63_lifecycle_stalemate.mjs',
  'lwcs/tools/audit_battle_r63_decision_settlement.mjs',
  'lwcs/tools/audit_battle_route_objectives.mjs',
  'lwcs/tools/audit_battle_v23_source_closure.mjs',
  'lwcs/tools/audit_battle_v73_formal_cases.mjs',
  'lwcs/tools/audit_battle_report_render_html.mjs',
  'lwcs/tools/audit_battle_local_ui_playwright.mjs',
  'lwcs/tools/audit_battle_ledger_strictness.mjs',
  'lwcs/tools/audit_battle_summon_trace.mjs',
  'lwcs/tools/audit_battle_v73_performance.mjs',
  'lwcs/tools/battle_ui_test_source.mjs',
  'lwcs/tools/battle_r63_manual_manifest.mjs',
  'lwcs/tools/battle_r63_manual_review_notes.mjs',
  'lwcs/tools/battle_r63_manual_review_template.md',
  'lwcs/tools/run_battle_r63_manual_review.mjs',
  'tools/audit_battle_behavior_logic_matrix.mjs',
  'tools/audit_battle_v73_determinism.mjs',
  'tools/audit_battle_report_samples.mjs',
  'tools/audit_battle_ui_evidence_matrix.mjs',
  'tools/generate_battle_ui_evidence_bundle.mjs',
  'artifacts/battle_ui_manual_spot_checks.md',
  'artifacts/battle_ui_requirement_matrix.md',
  'artifacts/battle_ui_evidence_bundle.md',
].filter(file => fs.existsSync(path.resolve(root, file)));

const commandDefinitions = [
  { name: 'auditBattleR63Baseline', command: [process.execPath, ['lwcs/tools/audit_battle_r63_baseline.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63QueueProbability', command: [process.execPath, ['lwcs/tools/audit_battle_r63_queue_probability.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63PreviewFoundation', command: [process.execPath, ['lwcs/tools/audit_battle_r63_preview_foundation.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63PrototypeMatrix', command: [process.execPath, ['lwcs/tools/audit_battle_r63_prototype_matrix.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63PrototypeE2E', command: [process.execPath, ['lwcs/tools/audit_battle_r63_prototype_e2e.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63Decision', command: [process.execPath, ['lwcs/tools/audit_battle_r63_decision.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63BeliefDeepPreview', command: [process.execPath, ['lwcs/tools/audit_battle_r63_belief_deep_preview.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63ScenarioMatrix', command: [process.execPath, ['lwcs/tools/audit_battle_r63_scenario_matrix.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63LifecycleStalemate', command: [process.execPath, ['lwcs/tools/audit_battle_r63_lifecycle_stalemate.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63DecisionSettlement', command: [process.execPath, ['lwcs/tools/audit_battle_r63_decision_settlement.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleRouteObjectives', command: [process.execPath, ['lwcs/tools/audit_battle_route_objectives.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattlePreview', command: [process.execPath, ['--check', 'lwcs/BattlePreview_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattleDecision', command: [process.execPath, ['--check', 'lwcs/BattleDecision_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattleRuntime', command: [process.execPath, ['--check', 'lwcs/BattleRuntime_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattleUi', command: [process.execPath, ['--check', 'lwcs/BattleUI_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxDatabaseAdapter', command: [process.execPath, ['--check', 'lwcs/LWCS_Database_Adapter.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxMvuLogicBridge', command: [process.execPath, ['--check', 'lwcs/mvu_logic_bridge.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  {
    name: 'auditBattleV73FormalCases',
    command: [process.execPath, ['lwcs/tools/audit_battle_v73_formal_cases.mjs', ...(requestedCase ? ['--case', requestedCase] : [])]],
    parseJson: true,
    timeoutMs: 60000,
    groups: ['quick', 'full', 'case'],
  },
  { name: 'auditBattleReportRenderHtml', command: [process.execPath, ['lwcs/tools/audit_battle_report_render_html.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'] },
  { name: 'auditBattleLocalUiPlaywright', command: [process.execPath, ['lwcs/tools/audit_battle_local_ui_playwright.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'] },
  { name: 'auditBattleLedgerStrictness', command: [process.execPath, ['lwcs/tools/audit_battle_ledger_strictness.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'] },
  { name: 'auditBattleSummonTrace', command: [process.execPath, ['lwcs/tools/audit_battle_summon_trace.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'] },
  { name: 'auditBattleBehaviorLogicMatrix', command: [process.execPath, ['tools/audit_battle_behavior_logic_matrix.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleDeterminism', command: [process.execPath, ['tools/audit_battle_v73_determinism.mjs', '--runs', full ? '100' : '10']], parseJson: true, timeoutMs: full ? 300000 : 60000, groups: ['quick', 'full'] },
  {
    name: 'diffCheckBattleUiStylesAndSamples',
    command: ['git', ['-C', 'lwcs', 'diff', '--check', '--', 'BattleUI_Module.js', 'LWCS_Database_Adapter.js', 'mvu_logic_bridge.js', 'mvu_styles.css', 'battle_report_decision_samples_100.txt']],
    timeoutMs: 30000,
    groups: ['quick', 'full'],
  },
  { name: 'auditBattleMultiroundTrace', command: [process.execPath, ['tools/audit_battle_multiround_trace.mjs']], parseJson: true, timeoutMs: 120000, groups: ['full'] },
  { name: 'auditBattleR63ManualReview', command: [process.execPath, ['lwcs/tools/run_battle_r63_manual_review.mjs', '--verify-hashes']], parseJson: true, timeoutMs: 600000, groups: ['full'] },
  { name: 'auditBattleV23SourceClosure', command: [process.execPath, ['lwcs/tools/audit_battle_v23_source_closure.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV23PlanCoverage', command: [process.execPath, ['tools/audit_battle_v23_plan_coverage.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV23OldExitCoverage', command: [process.execPath, ['tools/audit_battle_v23_old_exit_coverage.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV23ImplementationOrder', command: [process.execPath, ['tools/audit_battle_v23_implementation_order.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV73Performance', command: [process.execPath, ['lwcs/tools/audit_battle_v73_performance.mjs']], parseJson: true, timeoutMs: 300000, groups: ['full'] },
];

const commands = commandDefinitions.filter(item => item.groups.includes(mode));

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

const runCommand = ({ name, command, parseJson, timeoutMs = 120000 }) => new Promise(resolve => {
  const [file, commandArgs] = command;
  const startedAt = new Date().toISOString();
  console.error(`[battle-gate] START ${name} (${Math.round(timeoutMs / 1000)}s)`);
  const child = spawn(file, commandArgs, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let stdout = '';
  let stderr = '';
  let spawnError = null;
  let timedOut = false;
  let outputOverflow = false;
  let settled = false;
  const appendOutput = (current, chunk) => {
    const next = current + chunk.toString('utf8');
    if (Buffer.byteLength(next, 'utf8') <= maxOutputBytes) return next;
    outputOverflow = true;
    terminateProcessTree(child);
    return next.slice(-maxOutputBytes);
  };
  child.stdout.on('data', chunk => { stdout = appendOutput(stdout, chunk); });
  child.stderr.on('data', chunk => { stderr = appendOutput(stderr, chunk); });
  child.on('error', error => { spawnError = error; });
  const timer = setTimeout(() => {
    timedOut = true;
    terminateProcessTree(child);
  }, timeoutMs);
  child.on('close', (code, signal) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    let parsedSummary;
    let parseError = '';
    if (parseJson && stdout.trim()) {
      try {
        parsedSummary = JSON.parse(stdout).summary;
      } catch (error) {
        parseError = String(error?.message || error);
      }
    }
    const passed = code === 0 && !spawnError && !timedOut && !outputOverflow && !parseError;
    const result = {
      name,
      passed,
      startedAt,
      finishedAt: new Date().toISOString(),
      timeoutMs,
      exitCode: code ?? (timedOut ? 124 : 1),
      signal: signal || undefined,
      timedOut,
      outputOverflow,
      parseError: parseError || undefined,
      spawnError: spawnError ? String(spawnError.message || spawnError) : undefined,
      summary: parsedSummary,
      stdoutTail: stdout.slice(-1200),
      stderrTail: stderr.slice(-1200),
    };
    console.error(`[battle-gate] ${passed ? 'PASS' : 'FAIL'} ${name}${timedOut ? ' (timeout)' : ''}`);
    resolve(result);
  });
});

const runUtf8Scan = () => {
  const pattern = '�|锟|杩|鐨';
  try {
    const result = spawnSync('rg', ['-n', pattern, ...utf8ScanTargets], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 16,
    });
    const stdout = String(result.stdout || '');
    if (result.status === 1) return { name: 'utf8MojibakeScan', passed: true, exitCode: 1 };
    return {
      name: 'utf8MojibakeScan',
      passed: false,
      matchCount: String(stdout || '').trim().split(/\r?\n/).filter(Boolean).length,
      stdoutTail: String(stdout || '').slice(-1200),
    };
  } catch (error) {
    return {
      name: 'utf8MojibakeScan',
      passed: error.status === 1,
      exitCode: error.status,
      stderrTail: String(error.stderr || '').slice(-1200),
    };
  }
};

const runBattleAiSummaryContract = () => {
  const battleUi = fs.readFileSync(path.resolve(root, 'lwcs/BattleUI_Module.js'), 'utf8');
  const battleRuntime = fs.readFileSync(path.resolve(root, 'lwcs/BattleRuntime_Module.js'), 'utf8');
  const adapter = fs.readFileSync(path.resolve(root, 'lwcs/LWCS_Database_Adapter.js'), 'utf8');
  const bridge = fs.readFileSync(path.resolve(root, 'lwcs/mvu_logic_bridge.js'), 'utf8');
  const failures = [];
  const requestBlock = battleUi.match(/const userBattleMessage = \[[\s\S]*?sendToAI\(userBattleMessage[\s\S]*?\);/)?.[0] || '';
  const summaryBuilder = battleRuntime.match(/function buildAiNarrativeSummary\([\s\S]*?(?=\n  function )/)?.[0] || '';
  if (!/<battle_structured_summary>[\s\S]*?<\/battle_structured_summary>/.test(requestBlock)) failures.push('BATTLE_REQUEST_MISSING_STRUCTURED_SUMMARY');
  if (/battle_public_report|<战斗公开战报>/.test(requestBlock)) failures.push('BATTLE_REQUEST_USES_PUBLIC_REPORT');
  if (!/本轮输入包含战斗结构化摘要/.test(adapter) || !/<battle_structured_summary>/.test(adapter)) failures.push('ADAPTER_MISSING_STRUCTURED_SUMMARY_CONTRACT');
  if (/battle_public_report|本轮输入包含战斗公开战报/.test(adapter)) failures.push('ADAPTER_RETAINS_PUBLIC_REPORT_CONTRACT');
  if (!/function 构建自动战斗结构化摘要/.test(bridge) || !/执行结果\.llmBattleSummary \|\| 执行结果\.finalBattleReport\?\.text/.test(bridge)) failures.push('BRIDGE_MISSING_STRUCTURED_SUMMARY_SOURCE');
  if (/function 构建自动战斗公开战报|<battle_public_report>/.test(bridge)) failures.push('BRIDGE_RETAINS_PUBLIC_REPORT_BUILDER');
  if (!summaryBuilder) failures.push('LLM_SUMMARY_BUILDER_MISSING');
  if (/ruleCode|rawObjectiveScore|scoreParts|candidate/i.test(summaryBuilder)) failures.push('LLM_SUMMARY_BUILDER_READS_INTERNAL_SCORING');
  if (/eventLedger|decisionTrace|resolutionTrace|publicReport|innerHTML|querySelector/.test(summaryBuilder)) failures.push('LLM_SUMMARY_BUILDER_READS_NON_STRUCTURED_SOURCE');
  return {
    name: 'battleAiSummaryContract',
    passed: failures.length === 0,
    failureCount: failures.length,
    failures,
  };
};

const results = [];
const writeOutput = () => {
  const failed = results.filter(result => !result.passed);
  const output = {
    generatedAt: new Date().toISOString(),
    mode,
    requestedCase: requestedCase || null,
    acceptSamples,
    summary: {
      commandCount: results.length,
      passedCount: results.length - failed.length,
      failedCount: failed.length,
    },
    results,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  return output;
};

for (const command of commands) {
  results.push(await runCommand(command));
  writeOutput();
}
results.push(runBattleAiSummaryContract());
results.push(runUtf8Scan());
writeOutput();

if (acceptSamples && results.every(result => result.passed)) {
  results.push(await runCommand({
    name: 'regenerateDecisionSamples',
    command: [process.execPath, ['tools/regenerate_battle_report_decision_samples.mjs']],
    timeoutMs: 120000,
  }));
  writeOutput();
  if (results.at(-1).passed) {
    results.push(await runCommand({
      name: 'verifyRegeneratedDecisionSamples',
      command: [process.execPath, ['tools/audit_battle_report_samples.mjs']],
      parseJson: true,
      timeoutMs: 120000,
    }));
    writeOutput();
  }
}

const output = writeOutput();
console.log(JSON.stringify(output, null, 2));
if (output.summary.failedCount) process.exitCode = 1;

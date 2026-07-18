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
const requestedPhaseIndex = args.indexOf('--phase');
const requestedPhase = requestedPhaseIndex >= 0 ? Number(args[requestedPhaseIndex + 1]) : 0;
const mode = requestedCase ? 'case' : full ? 'full' : 'quick';
if (!Number.isInteger(requestedPhase) || requestedPhase < 0 || requestedPhase > 12) {
  console.error('[battle-gate] --phase 必须是0至12的整数');
  process.exit(2);
}
if (acceptSamples && mode !== 'full') {
  console.error('[battle-gate] --accept-samples 只能与 --full 同时使用');
  process.exit(2);
}
const artifactsDir = path.resolve(root, 'artifacts');
const outputPath = path.join(artifactsDir, 'battle_ui_v23_regression_gate.json');
const progressPath = path.join(artifactsDir, 'battle_ui_v23_regression_progress.log');
fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(progressPath, '', 'utf8');
const maxOutputBytes = 1024 * 1024 * 128;
const appendProgressLine = line => {
  try {
    fs.appendFileSync(progressPath, `${line}\n`, 'utf8');
  } catch {
    // Progress logging must not change the gate result.
  }
};

const utf8ScanTargets = [
  'lwcs/BattleUI_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleReport_Module.js',
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
  'lwcs/tools/audit_battle_r63_runtime_prepare_sustain.mjs',
  'lwcs/tools/audit_battle_r83_phase4.mjs',
  'lwcs/tools/audit_battle_r83_phase5.mjs',
  'lwcs/tools/audit_battle_r83_phase6.mjs',
  'lwcs/tools/audit_battle_r74_report_dto.mjs',
  'lwcs/tools/audit_battle_r74_value_kernel.mjs',
  'lwcs/tools/audit_battle_r74_kernel_ab.mjs',
  'lwcs/tools/audit_battle_r74_phase6_matrix.mjs',
  'lwcs/tools/audit_battle_r74_phase7_report.mjs',
  'lwcs/tools/audit_battle_phase8_batch_matrix.mjs',
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
  'lwcs/tools/battle_r63_manual_review_template.md',
  'lwcs/tools/run_battle_r63_manual_review.mjs',
  'lwcs/tools/audit_battle_r74_manual_review_status.mjs',
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
  {
    name: 'auditBattleR83Phase0',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase0.mjs']],
    parseJson: true,
    timeoutMs: 30000,
    groups: ['quick', 'full', 'case'],
    maxPhase: 0,
  },
  {
    name: 'auditBattleR83Phase1',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase1.mjs']],
    parseJson: true,
    timeoutMs: 120000,
    groups: ['quick', 'full', 'case'],
    minPhase: 1,
    maxPhase: 10,
  },
  {
    name: 'auditBattleR83Phase2',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase2.mjs']],
    parseJson: true,
    timeoutMs: 120000,
    groups: ['quick', 'full', 'case'],
    minPhase: 2,
  },
  {
    name: 'auditBattleR83Phase3',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase3.mjs']],
    parseJson: true,
    timeoutMs: 120000,
    groups: ['quick', 'full', 'case'],
    minPhase: 3,
  },
  {
    name: 'auditBattleR83Phase4',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase4.mjs']],
    parseJson: true,
    timeoutMs: 120000,
    groups: ['quick', 'full', 'case'],
    minPhase: 4,
  },
  {
    name: 'auditBattleR83Phase5',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase5.mjs']],
    parseJson: true,
    timeoutMs: 120000,
    groups: ['quick', 'full', 'case'],
    minPhase: 5,
  },
  {
    name: 'auditBattleR83Phase6',
    command: [process.execPath, ['lwcs/tools/audit_battle_r83_phase6.mjs']],
    parseJson: true,
    timeoutMs: 120000,
    groups: ['quick', 'full', 'case'],
    minPhase: 6,
  },
  { name: 'auditBattleR63Baseline', command: [process.execPath, ['lwcs/tools/audit_battle_r63_baseline.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'auditBattleR63QueueProbability', command: [process.execPath, ['lwcs/tools/audit_battle_r63_queue_probability.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63PreviewFoundation', command: [process.execPath, ['lwcs/tools/audit_battle_r63_preview_foundation.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63PrototypeMatrix', command: [process.execPath, ['lwcs/tools/audit_battle_r63_prototype_matrix.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63PrototypeE2E', command: [process.execPath, ['lwcs/tools/audit_battle_r63_prototype_e2e.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63Decision', command: [process.execPath, ['lwcs/tools/audit_battle_r63_decision.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63BeliefDeepPreview', command: [process.execPath, ['lwcs/tools/audit_battle_r63_belief_deep_preview.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63ScenarioMatrix', command: [process.execPath, ['lwcs/tools/audit_battle_r63_scenario_matrix.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63LifecycleStalemate', command: [process.execPath, ['lwcs/tools/audit_battle_r63_lifecycle_stalemate.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63DecisionSettlement', command: [process.execPath, ['lwcs/tools/audit_battle_r63_decision_settlement.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full'] },
  { name: 'auditBattleR63RuntimePrepareSustain', command: [process.execPath, ['lwcs/tools/audit_battle_r63_runtime_prepare_sustain.mjs']], parseJson: true, timeoutMs: 60000, groups: ['quick', 'full'] },
  { name: 'auditBattleRouteObjectives', command: [process.execPath, ['lwcs/tools/audit_battle_route_objectives.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattlePreview', command: [process.execPath, ['--check', 'lwcs/BattlePreview_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattleDecision', command: [process.execPath, ['--check', 'lwcs/BattleDecision_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattleRuntime', command: [process.execPath, ['--check', 'lwcs/BattleRuntime_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'] },
  { name: 'syntaxBattleReport', command: [process.execPath, ['--check', 'lwcs/BattleReport_Module.js']], timeoutMs: 30000, groups: ['quick', 'full', 'case'], minPhase: 3 },
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
  { name: 'auditBattleR74ReportDto', command: [process.execPath, ['lwcs/tools/audit_battle_r74_report_dto.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'], minPhase: 3 },
  { name: 'auditBattleR74ValueKernel', command: [process.execPath, ['lwcs/tools/audit_battle_r74_value_kernel.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'], minPhase: 4 },
  { name: 'auditBattleR74KernelAb', command: [process.execPath, ['lwcs/tools/audit_battle_r74_kernel_ab.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'], minPhase: 5 },
  { name: 'auditBattleR74Phase6Matrix', command: [process.execPath, ['lwcs/tools/audit_battle_r74_phase6_matrix.mjs']], parseJson: true, timeoutMs: 180000, groups: ['quick', 'full'], minPhase: 6 },
  { name: 'auditBattleR74Phase7Report', command: [process.execPath, ['lwcs/tools/audit_battle_r74_phase7_report.mjs']], parseJson: true, timeoutMs: 300000, groups: ['quick', 'full'], minPhase: 7 },
  { name: 'auditBattleReportRenderHtml', command: [process.execPath, ['lwcs/tools/audit_battle_report_render_html.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'], minPhase: 7 },
  { name: 'auditBattleLocalUiPlaywright', command: [process.execPath, ['lwcs/tools/audit_battle_local_ui_playwright.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'], minPhase: 10 },
  { name: 'auditBattleLedgerStrictness', command: [process.execPath, ['lwcs/tools/audit_battle_ledger_strictness.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'] },
  { name: 'auditBattleSummonTrace', command: [process.execPath, ['lwcs/tools/audit_battle_summon_trace.mjs']], parseJson: true, timeoutMs: 120000, groups: ['quick', 'full'] },
  { name: 'auditBattleBehaviorLogicMatrix', command: [process.execPath, ['tools/audit_battle_behavior_logic_matrix.mjs']], parseJson: true, timeoutMs: 30000, groups: ['quick', 'full'] },
  { name: 'auditBattlePhase8BatchMatrix', command: [process.execPath, ['lwcs/tools/audit_battle_phase8_batch_matrix.mjs']], parseJson: true, timeoutMs: 300000, groups: ['quick', 'full'], minPhase: 8 },
  { name: 'auditBattleDeterminism', command: [process.execPath, ['tools/audit_battle_v73_determinism.mjs', '--runs', full ? '100' : '10']], parseJson: true, timeoutMs: full ? 300000 : 60000, groups: ['quick', 'full'] },
  {
    name: 'diffCheckBattleUiStylesAndSamples',
    command: ['git', ['-C', 'lwcs', 'diff', '--check', '--', 'BattleUI_Module.js', 'LWCS_Database_Adapter.js', 'mvu_logic_bridge.js', 'mvu_styles.css', 'battle_report_decision_samples_100.txt']],
    timeoutMs: 30000,
    groups: ['quick', 'full'],
  },
  { name: 'auditBattleMultiroundTrace', command: [process.execPath, ['tools/audit_battle_multiround_trace.mjs']], parseJson: true, timeoutMs: 120000, groups: ['full'], minPhase: 7 },
  {
    name: 'auditBattleR74ManualReviewStatus',
    command: [process.execPath, ['lwcs/tools/audit_battle_r74_manual_review_status.mjs', '--phase', String(requestedPhase)]],
    parseJson: true,
    timeoutMs: 30000,
    groups: ['full'],
  },
  { name: 'auditBattleV23SourceClosure', command: [process.execPath, ['lwcs/tools/audit_battle_v23_source_closure.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'], minPhase: 9 },
  { name: 'auditBattleV23PlanCoverage', command: [process.execPath, ['tools/audit_battle_v23_plan_coverage.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV23OldExitCoverage', command: [process.execPath, ['tools/audit_battle_v23_old_exit_coverage.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV23ImplementationOrder', command: [process.execPath, ['tools/audit_battle_v23_implementation_order.mjs']], parseJson: true, timeoutMs: 60000, groups: ['full'] },
  { name: 'auditBattleV73Performance', command: [process.execPath, ['lwcs/tools/audit_battle_v73_performance.mjs']], parseJson: true, timeoutMs: 300000, groups: ['full'], minPhase: 10 },
];

const modeCommands = commandDefinitions.filter(item => item.groups.includes(mode));
const commands = modeCommands.filter(item =>
  requestedPhase >= Number(item.minPhase || 0) &&
  requestedPhase <= Number(item.maxPhase ?? 12)
);
const deferredCommands = modeCommands
  .filter(item =>
    requestedPhase < Number(item.minPhase || 0) ||
    requestedPhase > Number(item.maxPhase ?? 12)
  )
  .map(item => ({
    name: item.name,
    minPhase: Number(item.minPhase || 0),
    maxPhase: Number(item.maxPhase ?? 12),
  }));

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
  const startedAtMs = Date.now();
  console.error(`[battle-gate] START ${name} (${Math.round(timeoutMs / 1000)}s)`);
  appendProgressLine(`[battle-gate] START ${name} (${Math.round(timeoutMs / 1000)}s)`);
  const child = spawn(file, commandArgs, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      LWCS_BATTLE_PHASE: String(requestedPhase),
    },
  });
  let stdout = '';
  let stderr = '';
  let spawnError = null;
  let timedOut = false;
  let outputOverflow = false;
  let settled = false;
  const appendOutput = (current, chunk) => {
    const next = current + chunk.toString('utf8');
    try {
      fs.appendFileSync(progressPath, chunk.toString('utf8'), 'utf8');
    } catch {
      // Progress logging must not change the gate result.
    }
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
      durationMs: Math.max(0, Date.now() - startedAtMs),
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
    appendProgressLine(
      `[battle-gate] ${passed ? 'PASS' : 'FAIL'} ${name} ${result.durationMs}ms${timedOut ? ' timeout' : ''}`,
    );
    resolve(result);
  });
});

const runUtf8Scan = () => {
  const pattern = ['\uFFFD', '\u951F', '\u6769', '\u9428'].join('|');
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
  const requestBlock = battleUi.match(/sendToAI\(`<battle_structured_summary>[\s\S]*?requestKind:\s*['"]battle_settlement_plot['"][\s\S]*?\}\);/)?.[0] || '';
  const summaryBuilder = battleRuntime.match(/function buildAiNarrativeSummary\([\s\S]*?(?=\n  function )/)?.[0] || '';
  if (!/<battle_structured_summary>[\s\S]*?<\/battle_structured_summary>/.test(requestBlock)) failures.push('BATTLE_REQUEST_MISSING_STRUCTURED_SUMMARY');
  if (!/JSON\.stringify\(result\.aiSummaryInput\)/.test(requestBlock)) failures.push('BATTLE_REQUEST_MISSING_AI_SUMMARY_INPUT');
  if (/battle_public_report|<战斗公开战报>/.test(requestBlock)) failures.push('BATTLE_REQUEST_USES_PUBLIC_REPORT');
  if (/eventLedger|decisionTrace|resolutionTrace|scoreAudit|ruleCode|rawObjectiveScore|publicReport|innerHTML|querySelector/.test(requestBlock)) failures.push('BATTLE_REQUEST_LEAKS_INTERNAL_RUNTIME_DATA');
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
  const manualReviewResult = results.find(result => result.name === 'auditBattleR74ManualReviewStatus');
  const phase0Result = results.find(result => result.name === 'auditBattleR83Phase0');
  const phase1Result = results.find(result => result.name === 'auditBattleR83Phase1');
  const phase2Result = results.find(result => result.name === 'auditBattleR83Phase2');
  const phase3Result = results.find(result => result.name === 'auditBattleR83Phase3');
  const phase4Result = results.find(result => result.name === 'auditBattleR83Phase4');
  const phase5Result = results.find(result => result.name === 'auditBattleR83Phase5');
  const phase6Result = results.find(result => result.name === 'auditBattleR83Phase6');
  const manualReviewStatus = String(manualReviewResult?.summary?.manualReviewStatus || 'NOT_SCHEDULED');
  const manualReviewRequired = new Set([9, 10, 12]).has(requestedPhase);
  const automaticFailures = failed.filter(result => result.name !== 'auditBattleR74ManualReviewStatus');
  const manualAuditSummaryMissing = !!manualReviewResult && !manualReviewResult.summary;
  const phaseExitStatus = automaticFailures.length > 0 || manualAuditSummaryMissing
    ? 'BLOCKED'
    : manualReviewRequired && manualReviewStatus !== 'PASSED'
      ? manualReviewStatus === 'BLOCKED' ? 'BLOCKED' : 'PENDING'
      : 'PASSED';
  const output = {
    generatedAt: new Date().toISOString(),
    mode,
    phase: requestedPhase,
    requestedCase: requestedCase || null,
    acceptSamples,
    summary: {
      commandCount: results.length,
      passedCount: results.length - failed.length,
      failedCount: failed.length,
      deferredCount: deferredCommands.length,
      automaticStatus: automaticFailures.length > 0 ? 'BLOCKED' : 'PASSED',
      automaticFactStatus: automaticFailures.length > 0 ? 'BLOCKED' : 'PASSED',
      causalChainStatus: requestedPhase === 0
        ? String(phase0Result?.summary?.knownIssueStatus || 'BLOCKED')
        : requestedPhase >= 6
          ? String(phase6Result?.summary?.beliefResponseStatus || 'PENDING')
        : requestedPhase >= 5
          ? String(phase5Result?.summary?.routeCacheStatus || 'PENDING')
        : requestedPhase >= 3
          ? String(phase3Result?.summary?.runtimeEventContractStatus || 'PENDING')
          : requestedPhase >= 2
            ? String(phase2Result?.summary?.transactionStatus || 'PENDING')
          : requestedPhase >= 1
            ? String(phase1Result?.summary?.coordinatorStatus || 'PENDING')
          : 'PENDING',
      runtimeCalibrationStatus: requestedPhase >= 4
        ? String(phase4Result?.summary?.runtimeCalibrationStatus || 'PENDING')
        : 'NOT_SCHEDULED',
      reportProjectionStatus: requestedPhase >= 10 ? 'PENDING' : 'NOT_SCHEDULED',
      manualReviewRequired,
      manualReviewStatus,
      phaseExitStatus,
    },
    results,
    deferredCommands,
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

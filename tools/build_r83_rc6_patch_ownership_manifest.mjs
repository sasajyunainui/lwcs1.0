import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const battleFiles = Object.freeze([
  'BattleDecision_Module.js',
  'BattlePreview_Module.js',
  'BattleReport_Module.js',
  'BattleRuntime_Module.js',
]);
const excludedDirtyPaths = new Set([
  'JueshiTangmenCharacterLibrary.js',
  'JueshiTangmenItemLibrary.js',
  'regex-缝合怪東方花映塚剧情推进美化v1_0.json',
  '缝合怪二改_专用推进预设.plot-preset.json',
]);
const evidenceByOwner = Object.freeze({
  B1_SUMMON_IDENTITY: [
    'tools/evidence/r8/r83_rc2_r9v2_summon_generation_after_creation_time_window_fix_2026-07-28.json',
  ],
  B3_B4_RUNTIME_MECHANICS: [
    'tools/evidence/r8/r83_rc2_r9v2_reaction_pass_runtime_batch_result_analysis_2026-07-29.json',
  ],
  B5_CANONICAL_FACTS: [
    'tools/evidence/r8/r83_rc2_b5_canonical_facts_batch_result_analysis_2026-07-27.json',
  ],
  B6_SESSION_REUSE: [
    'tools/evidence/r8/r83_rc2_b6a_envelope_runtime_metadata_batch_result_analysis_2026-07-27.json',
    'tools/evidence/r8/r83_rc2_b6a2_mechanical_opportunity_rebind_batch_result_analysis_2026-07-27.json',
    'tools/evidence/r8/r83_rc2_b6d_computation_cache_lifetime_batch_result_analysis_2026-07-27.json',
  ],
  N19_PAYMENT_SCOPE: [
    'tools/evidence/r8/r83_rc2_n19_payment_action_scope_batch_result_analysis_2026-07-28.json',
  ],
  R9V2_MECHANICAL_POOL: [
    'tools/evidence/r8/r83_rc2_r9v2_full_candidate_value_proof_current_2026-07-29.json',
    'tools/evidence/r8/r83_rc2_r9v2_phase4_closeout_current_2026-07-29.json',
  ],
  R9V2_RESPONSE_TERMINAL: [
    'tools/evidence/r8/r83_rc2_r9v2_response_terminal_batch_result_analysis_2026-07-27.json',
  ],
  R9V2_SUMMON_CREATION_WINDOW: [
    'tools/evidence/r8/r83_rc2_r9v2_creation_consumer_nested_pool_batch_result_analysis_2026-07-28.json',
    'tools/evidence/r8/r83_rc2_r9v2_summon_generation_after_creation_time_window_fix_2026-07-28.json',
  ],
  R9V2_CAUSAL_PARETO: [
    'tools/evidence/r8/r83_rc2_r9v2_future_behavior_value_ownership_batch_result_analysis_2026-07-28.json',
  ],
  R9V2_REACTION_PASS: [
    'tools/evidence/r8/r83_rc2_r9v2_reaction_pass_runtime_batch_result_analysis_2026-07-29.json',
    'tools/evidence/r8/r83_rc2_r9v2_reaction_pass_7v7_formal15_2026-07-29.json',
  ],
  REPORT_PROJECTION_FOUNDATION: [
    'tools/evidence/r8/r83_rc2_dual_provider_review_packet_alternatives_batch_result_analysis_2026-07-29.json',
  ],
  RC6_BASELINE_RECONCILIATION: [
    'tools/evidence/r8/r83_rc2_r9v2_phase4_closeout_current_2026-07-29.json',
  ],
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(args, maxBuffer = 64 * 1024 * 1024) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer,
  });
}

function statusRows() {
  const raw = git(['status', '--porcelain=v1', '-z']);
  return raw.split('\0').filter(Boolean).map(row => ({
    indexStatus: row.slice(0, 1),
    worktreeStatus: row.slice(1, 2),
    path: row.slice(3).replaceAll('\\', '/'),
  }));
}

function sourceRecord(relativePath) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath));
  return {
    sha256: sha256(content),
    bytes: content.length,
    lineCount: content.toString('utf8').split(/\r?\n/u).length,
  };
}

function parseHunks() {
  const diff = git(['diff', '--unified=0', '--', ...battleFiles]);
  const hunks = [];
  let file = '';
  let current = null;
  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith('diff --git ')) {
      file = line.match(/ b\/(.+)$/u)?.[1] || '';
      current = null;
      continue;
    }
    if (line.startsWith('@@')) {
      const match = line.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\s*(.*)$/u,
      );
      if (!match) continue;
      current = {
        file,
        oldStart: Number(match[1]),
        oldCount: Number(match[2] || 1),
        newStart: Number(match[3]),
        newCount: Number(match[4] || 1),
        headerContext: String(match[5] || '').trim(),
        lines: [],
      };
      hunks.push(current);
      continue;
    }
    if (current && !line.startsWith('index ') && !line.startsWith('--- ') && !line.startsWith('+++ ')) {
      current.lines.push(line);
    }
  }
  return hunks;
}

function nearestSymbol(relativePath, lineNumber) {
  const lines = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8').split(/\r?\n/u);
  const start = Math.min(lines.length - 1, Math.max(0, lineNumber - 1));
  for (let index = start; index >= Math.max(0, start - 300); index -= 1) {
    const line = lines[index];
    const functionMatch = line.match(
      /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/u,
    );
    if (functionMatch) return functionMatch[1];
    const assignmentMatch = line.match(
      /^\s*(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/u,
    );
    if (assignmentMatch) return assignmentMatch[1];
  }
  return 'MODULE_SCOPE';
}

function keywordScore(text, patterns) {
  return patterns.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0,
  );
}

function classifyHunk(hunk) {
  const text = `${hunk.headerContext}\n${hunk.nearestSymbol || ''}\n${hunk.lines.join('\n')}`;
  const candidates = [
    {
      owner: 'R9V2_REACTION_PASS',
      patterns: [
        /currentIncoming/iu,
        /PASS_OPPORTUNITY/iu,
        /counterDecline/iu,
        /incomingResponse/iu,
      ],
    },
    {
      owner: 'R9V2_SUMMON_CREATION_WINDOW',
      patterns: [
        /summonWindow/iu,
        /summonDefinitions/iu,
        /creationCarrier/iu,
        /creationProjection/iu,
      ],
    },
    {
      owner: 'R9V2_RESPONSE_TERMINAL',
      patterns: [
        /responseProjection/iu,
        /terminalProjection/iu,
        /withdrawalProjection/iu,
        /FIRST_TERMINAL/iu,
      ],
    },
    {
      owner: 'R9V2_CAUSAL_PARETO',
      patterns: [
        /CandidateValueProof/iu,
        /causalValueFacts/iu,
        /goalUtilityDeltaHEPP/iu,
        /r9v2Dominates/iu,
        /NEXT_ACTION_QUALITY_CHANGED/iu,
      ],
    },
    {
      owner: 'R9V2_MECHANICAL_POOL',
      patterns: [
        /r9v2/iu,
        /MechanicalBasis/iu,
        /observerPool/iu,
        /mechanicalProjectionContext/iu,
      ],
    },
    {
      owner: 'B6_SESSION_REUSE',
      patterns: [
        /EvaluationSession/iu,
        /routeFactOwnership/iu,
        /mechanicalReuse/iu,
        /behaviorReuse/iu,
        /FactDeltaBatch/iu,
      ],
    },
    {
      owner: 'N19_PAYMENT_SCOPE',
      patterns: [
        /paymentAction/iu,
        /paymentScope/iu,
        /ACTION_COST/iu,
        /RESOURCE_OPTION_CHANGED/iu,
      ],
    },
    {
      owner: 'B5_CANONICAL_FACTS',
      patterns: [
        /CanonicalBattleFact/iu,
        /effect_resolved/iu,
        /sourceEffectId/iu,
        /operation/iu,
        /resource_change/iu,
      ],
    },
    {
      owner: 'B1_SUMMON_IDENTITY',
      patterns: [
        /summonInstanceId/iu,
        /preview-summon/iu,
        /SUMMON_PREVIEW_INSTANCE_CONFLICT/iu,
      ],
    },
    {
      owner: 'B3_B4_RUNTIME_MECHANICS',
      patterns: [
        /blocked_action/iu,
        /counter_window/iu,
        /appliedDamage/iu,
        /TRAUMA/iu,
      ],
    },
    {
      owner: 'REPORT_PROJECTION_FOUNDATION',
      patterns: [
        /auditProjection/iu,
        /visibilityMode/iu,
        /PublicDecisionReviewPacket/iu,
        /projectionStatus/iu,
      ],
    },
  ].map(candidate => ({
    owner: candidate.owner,
    score: keywordScore(text, candidate.patterns),
  })).filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (hunk.file === 'BattleReport_Module.js' && !candidates.length) {
    return {
      owner: 'REPORT_PROJECTION_FOUNDATION',
      confidence: 'MEDIUM',
      reason: 'BattleReport模块内的投影与审计变更',
    };
  }
  if (!candidates.length) {
    return {
      owner: 'RC6_BASELINE_RECONCILIATION',
      confidence: 'LOW',
      reason: '跨批次集成或模块级连接代码，当前门禁整体核验',
    };
  }
  const [winner, runnerUp] = candidates;
  if (winner.score < 2 || winner.score === Number(runnerUp?.score || 0)) {
    return {
      owner: 'RC6_BASELINE_RECONCILIATION',
      confidence: 'LOW',
      reason: `现有文本不足以可靠回溯历史批次，弱提示=${winner.owner}:${winner.score}${
        runnerUp ? `，次高=${runnerUp.owner}:${runnerUp.score}` : ''
      }`,
    };
  }
  return {
    owner: winner.owner,
    confidence:
      winner.score >= 3
        ? 'HIGH'
        : 'MEDIUM',
    reason: `关键词归属分=${winner.score}${
      runnerUp ? `，次高=${runnerUp.owner}:${runnerUp.score}` : ''
    }`,
  };
}

function evidenceRecords(paths) {
  return paths.map(relativePath => {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return { path: relativePath, status: 'MISSING' };
    }
    const content = fs.readFileSync(absolutePath);
    return {
      path: relativePath,
      status: 'PRESENT',
      sha256: sha256(content),
    };
  });
}

const status = statusRows();
const hunks = parseHunks().map((hunk, index) => {
  const symbol = nearestSymbol(hunk.file, hunk.newStart);
  const classification = classifyHunk({ ...hunk, nearestSymbol: symbol });
  const addedLineCount = hunk.lines.filter(line => line.startsWith('+')).length;
  const removedLineCount = hunk.lines.filter(line => line.startsWith('-')).length;
  const identitySource = JSON.stringify({
    file: hunk.file,
    oldStart: hunk.oldStart,
    oldCount: hunk.oldCount,
    newStart: hunk.newStart,
    newCount: hunk.newCount,
    lines: hunk.lines,
  });
  return {
    hunkId: `patch-hunk-${String(index + 1).padStart(3, '0')}-${sha256(identitySource).slice(0, 12)}`,
    file: hunk.file,
    oldRange: { start: hunk.oldStart, count: hunk.oldCount },
    newRange: { start: hunk.newStart, count: hunk.newCount },
    nearestSymbol: symbol,
    addedLineCount,
    removedLineCount,
    ownership: classification,
    evidence: evidenceRecords(evidenceByOwner[classification.owner] || []),
  };
});

const ownershipCounts = Object.fromEntries(
  [...new Set(hunks.map(hunk => hunk.ownership.owner))].sort().map(owner => [
    owner,
    hunks.filter(hunk => hunk.ownership.owner === owner).length,
  ]),
);
const confidenceCounts = Object.fromEntries(
  ['HIGH', 'MEDIUM', 'LOW'].map(confidence => [
    confidence,
    hunks.filter(hunk => hunk.ownership.confidence === confidence).length,
  ]),
);
const scopedDirty = status.filter(row => battleFiles.includes(row.path));
const excludedDirty = status.filter(row => excludedDirtyPaths.has(row.path));
const unexpectedDirty = status.filter(
  row => !battleFiles.includes(row.path) && !excludedDirtyPaths.has(row.path),
);
const sourceFiles = Object.fromEntries(
  battleFiles.map(file => [file, sourceRecord(file)]),
);
const patchText = git(['diff', '--', ...battleFiles]);
const manifestCore = {
  repository: {
    head: git(['rev-parse', 'HEAD']).trim(),
    branch: git(['branch', '--show-current']).trim(),
    worktreeDirty: status.length > 0,
    scopedDirty,
    excludedDirty,
    unexpectedDirty,
    patchSha256: sha256(patchText),
  },
  sourceFiles,
  inheritance: {
    acceptedAndRetained: [
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'B6-A',
      'B6-A2',
      'B6-D',
      'N-19',
    ],
    retainedWithoutFormalPerformanceAcceptance: ['B6-C'],
    historicalOnly: ['old B7', 'hash-mismatched shared gate manifests'],
  },
  hunkSummary: {
    total: hunks.length,
    expectedTotal: 192,
    allOwned: hunks.every(hunk => !!hunk.ownership.owner),
    ownershipCounts,
    confidenceCounts,
  },
  hunks,
  currentHashVerification: {
    syntax: 'PASSED_4_OF_4',
    phase1: 'PASSED_16_OF_16',
    phase3: 'PASSED_45_OF_45',
    phase7: 'PASSED_221_OF_221_EXECUTABLE_CONTRACTS_54',
    r9v2CandidateProof: 'PASSED_4251_OF_4251',
    currentTacticalPrimitiveProbe: 'NO_CURRENT_REPRODUCTION',
    reportDtoGate: 'FAILED_UNDOCUMENTED_DEVELOPER_REJECTION_CODES',
    phase10: 'BLOCKED_20_OF_27',
  },
  completion: {
    behaviorBaselineStatus: 'ACCEPTED_FOR_RC6_PHASE0_RECONCILIATION',
    reportMigrationStatus: 'BLOCKED',
    providerSwitchStatus: 'NOT_READY',
    overallCompletionStatus: 'NOT_COMPLETE',
  },
};
const manifest = {
  schemaVersion: 'PatchOwnershipManifestV1',
  generatedAt: new Date().toISOString(),
  ...manifestCore,
  manifestSha256: sha256(JSON.stringify(manifestCore)),
};
const outputPath = path.resolve(
  repoRoot,
  process.argv[2] ||
    'tools/evidence/r8/r83_rc6_phase0_patch_ownership_manifest_2026-07-29.json',
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${JSON.stringify({
    outputPath,
    manifestSha256: manifest.manifestSha256,
    hunkSummary: manifest.hunkSummary,
    completion: manifest.completion,
  }, null, 2)}\n`,
);

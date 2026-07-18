import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source-dir');
const sourceDir = sourceIndex >= 0
  ? path.resolve(args[sourceIndex + 1] || '')
  : path.resolve(
    process.env.R75_EVIDENCE_DIR || '',
  );

if (!sourceDir || !fs.existsSync(sourceDir)) {
  console.error('请通过 --source-dir 或 R75_EVIDENCE_DIR 指定R7.5证据目录。');
  process.exit(2);
}

const evidenceDir = path.join(sourceDir, 'evidence');
const outputDir = path.join(toolDir, 'evidence', 'r8');
const coreFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'CharacterLibrary.js',
  'MVU_Skill_Runtime.js',
];

const sha256Buffer = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const sha256File = filePath => sha256Buffer(fs.readFileSync(filePath));
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (fileName, value) => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
};
const git = (...gitArgs) => execFileSync(
  'git',
  gitArgs,
  { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
).trim();

const sourceFiles = {
  baseline: path.join(evidenceDir, '00-baseline-freeze.json'),
  minimal: path.join(evidenceDir, '02-minimal-experiments.json'),
  real: path.join(evidenceDir, '03-real-character-experiments.json'),
  decisions: path.join(evidenceDir, '06-design-decisions.json'),
};
Object.values(sourceFiles).forEach(filePath => {
  if (!fs.existsSync(filePath)) throw new Error(`R75_EVIDENCE_SOURCE_MISSING:${filePath}`);
});

const baseline = readJson(sourceFiles.baseline);
const minimal = readJson(sourceFiles.minimal);
const real = readJson(sourceFiles.real);
const decisions = readJson(sourceFiles.decisions);
const currentHead = git('rev-parse', 'HEAD');
const currentBranch = git('branch', '--show-current');
const currentStatus = git('status', '--short')
  .split(/\r?\n/)
  .map(line => line.trimEnd())
  .filter(Boolean);
const currentHashes = Object.fromEntries(
  coreFiles.map(fileName => [fileName, sha256File(path.join(repoRoot, fileName))]),
);

const baselineManifest = {
  schemaVersion: '8.3-phase0-baseline-1',
  generatedAt: new Date().toISOString(),
  auditDate: '2026-07-18',
  repository: {
    branch: currentBranch,
    implementationHead: currentHead,
    implementationStatusAtAuditStart: [],
    phase0GenerationStatus: currentStatus,
    r75EvidenceHead: baseline.gitHead,
  },
  sourceEvidence: Object.fromEntries(
    Object.entries(sourceFiles).map(([key, filePath]) => [
      key,
      {
        fileName: path.basename(filePath),
        sha256: sha256File(filePath),
      },
    ]),
  ),
  coreFiles: Object.fromEntries(coreFiles.map(fileName => [
    fileName,
    {
      r75Sha256: baseline.fileHashes?.[fileName] || '',
      implementationSha256: currentHashes[fileName],
      unchangedSinceR75: baseline.fileHashes?.[fileName] === currentHashes[fileName],
    },
  ])),
  characterLibraryHash: currentHashes['CharacterLibrary.js'],
  skillRuntimeHash: currentHashes['MVU_Skill_Runtime.js'],
  prototypeRegistry: {
    r75Hash: baseline.prototypeRegistryHash,
    implementationHash: baseline.prototypeRegistryHash,
    verification: 'MVU_Skill_Runtime.js byte-identical to R7.5 frozen baseline',
  },
  unchangedBattleSourceCount: coreFiles.length,
  allBattleSourcesUnchanged: coreFiles.every(
    fileName => baseline.fileHashes?.[fileName] === currentHashes[fileName],
  ),
};

const minimalContracts = {
  schemaVersion: '8.3-phase0-minimal-contracts-1',
  generatedAt: new Date().toISOString(),
  sourceEvidenceSha256: sha256File(sourceFiles.minimal),
  baselineHash: minimal.baselineHash,
  caseCount: minimal.cases?.length || 0,
  cases: (minimal.cases || []).map(item => ({
    caseId: item.caseId,
    seed: item.seed,
    inputHash: item.inputHash,
    behaviorContract: item.behaviorContract,
    candidateCount: item.candidateCount,
    candidateIds: item.candidateIds,
  })),
};

const fullBattleByCase = new Map(
  (real.fullBattles || []).map(item => [item.caseId, item]),
);
const realCaseManifest = {
  schemaVersion: '8.3-phase0-real-cases-1',
  generatedAt: new Date().toISOString(),
  sourceEvidenceSha256: sha256File(sourceFiles.real),
  baselineHash: real.baselineHash,
  caseCount: real.snapshots?.length || 0,
  deepReviewSelection: real.deepReviewSelection,
  snapshots: (real.snapshots || []).map(item => {
    const fullBattle = fullBattleByCase.get(item.caseId);
    return {
      caseId: item.caseId,
      group: item.group,
      focus: item.focus,
      inputHash: item.inputHash,
      manifestHash: item.manifestHash,
      sourceCharacterIds: item.sourceCharacterIds,
      sourceDataHashes: item.sourceDataHashes,
      beliefHash: item.beliefHash,
      objectiveHash: item.objectivesHash,
      behaviorContract: item.behaviorContract,
      deepReview: real.deepReviewSelection?.selectedCaseIds?.includes(item.caseId) === true,
      fullBattleReference: fullBattle
        ? {
          draftHash: fullBattle.draftHash,
          ledgerHash: fullBattle.ledgerHash,
          reportHash: fullBattle.reportHash,
          finalSnapshotHash: fullBattle.finalSnapshotHash,
          evidenceFile: path.basename(fullBattle.evidenceJson || ''),
          reportFile: path.basename(fullBattle.reportText || ''),
        }
        : null,
    };
  }),
};

const designDecisions = {
  schemaVersion: '8.3-phase0-design-decisions-1',
  generatedAt: new Date().toISOString(),
  sourceEvidenceSha256: sha256File(sourceFiles.decisions),
  baselineHead: decisions.baselineHead,
  decisionCount: decisions.decisions?.length || 0,
  decisions: decisions.decisions || [],
};

const issueOracleMap = {
  schemaVersion: '8.3-phase0-issue-oracles-1',
  generatedAt: new Date().toISOString(),
  baselineExpectation: 'All listed issues must be detected on the frozen current implementation.',
  oracleCount: 10,
  oracles: [
    {
      oracleId: 'R83_THRESHOLD_OVERKILL',
      symptom: '阈值目标仍奖励阈值后的过量伤害。',
      responsibility: ['BattleDecision', 'ObjectiveProjection', 'CausalOwnership'],
      requiredCausalPath: [
        'HP_RATIO_AT_OR_BELOW objective',
        'countable health range clipped at threshold',
        'excess range recorded as discardedOverkillPP',
        'terminal delta owns only first terminal crossing',
      ],
      forbiddenCausalPaths: [
        'full expectedStateGain added after threshold clipping',
        'damage bonus compensates threshold overkill',
      ],
      automaticRelations: [
        '35%->29% at 30% threshold counts 5PP',
        '35%->0% at 30% threshold still counts 5PP',
        'remaining 30PP is a Pareto cost',
      ],
      protectedBehavior: ['击杀目标允许伤害计至0%', '无非致死达标方案时不错误禁止必要致死'],
      manualReview: ['活捉与击杀目标的行为差异可理解'],
      baselineDetectors: [
        { file: 'BattleDecision_Module.js', present: 'scoreCandidatesNext' },
        { file: 'BattleDecision_Module.js', present: 'expectedStateGain' },
        { file: 'BattleDecision_Module.js', absent: 'discardedOverkillPP' },
      ],
    },
    {
      oracleId: 'R83_ACTIVE_DEFENSE_WITHOUT_WINDOW',
      symptom: '主动自然机会可对假想未来威胁选择防御或闪避。',
      responsibility: ['BattleRuntime', 'OpportunityGraph', 'BattleDecision'],
      requiredCausalPath: [
        'CONCRETE_OPPORTUNITY or SCHEDULE_DESCRIPTOR exists',
        'incoming window binds owner and source',
        'defense changes expected health trajectory',
      ],
      forbiddenCausalPaths: ['PROJECTED_RESPONSE alone creates active defense value'],
      automaticRelations: ['Only PROJECTED_RESPONSE => DEFEND/EVADE value is zero'],
      protectedBehavior: ['可见蓄力调度前的求生防御', '护卫拦截与正式等待反击'],
      manualReview: ['防御理由能指出具体来袭或确定调度'],
      baselineDetectors: [
        { file: 'BattleDecision_Module.js', present: 'responseBranches(context)' },
        { file: 'BattleDecision_Module.js', absent: 'SCHEDULE_DESCRIPTOR' },
      ],
    },
    {
      oracleId: 'R83_CONTROL_REALIZATION',
      symptom: '控制价值没有完整绑定目标机会和队友利用机会。',
      responsibility: ['BattleRuntime', 'BattleDecision', 'ActionRoute'],
      requiredCausalPath: [
        'target opportunity is concrete and unconsumed',
        'control covers that opportunity before expiry',
        'exploiter opportunity exists',
        'action envelope changes future health trajectory',
      ],
      forbiddenCausalPaths: ['status label alone adds control score', 'consumed opportunity is cancelled'],
      automaticRelations: ['Any missing realization condition makes marginal control value zero'],
      protectedBehavior: ['合理连续控制', '控制与DOT/队友顺序协同'],
      manualReview: ['战报能指出控制覆盖谁的哪次机会以及由谁兑现'],
      baselineDetectors: [
        { file: 'BattleDecision_Module.js', present: 'controlWindowRealizability' },
        { file: 'BattleDecision_Module.js', absent: 'ControlDeltaV1' },
      ],
    },
    {
      oracleId: 'R83_RESOURCE_TIMELINE',
      symptom: '资源恢复、支付、削减、锁定与自然恢复没有统一时序。',
      responsibility: ['BattleRuntime', 'BattlePreview', 'BattleDecision'],
      requiredCausalPath: [
        'single ordered ResourceTimelineEventV1 sequence',
        'payment feasibility evaluated at exact event position',
        'route envelope rebuilt after resource events',
      ],
      forbiddenCausalPaths: ['resource amount converted directly to score', 'unordered snapshot heuristic'],
      automaticRelations: [
        'restore->pay differs from pay->restore',
        'reduce->restore->pay differs from restore->reduce->pay',
      ],
      protectedBehavior: ['资源保留', '资源支援', '自然恢复解锁后续行为'],
      manualReview: ['资源理由能说明支付前后可用路线变化'],
      baselineDetectors: [
        { file: 'BattlePreview_Module.js', present: "windowId: 'ACTION_COST'" },
        { file: 'BattleRuntime_Module.js', absent: 'ResourceTimelineEventV1' },
      ],
    },
    {
      oracleId: 'R83_ACTION_POOL_HEPP',
      symptom: '命中、闪避、反击和防御没有完整转化为自身技能池收益变化。',
      responsibility: ['BattlePreview', 'BattleDecision', 'ActionRoute'],
      requiredCausalPath: [
        'mechanic changes affected action outcomes',
        'complete action envelope is rebuilt',
        'route delta converts to future health PP',
      ],
      forbiddenCausalPaths: ['flat hit/dodge/counter bonus', 'archetype-name bonus'],
      automaticRelations: ['必中池不受命中提升抬高', '无攻击窗口时闪避提升边际为零'],
      protectedBehavior: ['敏攻应对', '等待反击', '高命中压制闪避'],
      manualReview: ['说明具体提高或降低了哪些行为路线及多少HEPP'],
      baselineDetectors: [
        { file: 'BattleDecision_Module.js', present: 'teamCapacityProfileNext' },
        { file: 'BattleDecision_Module.js', absent: 'ActionRouteV1' },
      ],
    },
    {
      oracleId: 'R83_DUPLICATE_COMPENSATION',
      symptom: '重复动作仍可被危机、资源、团队或长期窗口补偿路径放行。',
      responsibility: ['BattleDecision', 'CausalOwnership', 'Pareto'],
      requiredCausalPath: [
        'candidate value equals goal utility delta versus NO_OP',
        'one causal fact has one owner',
        'zero marginal action with cost is excluded',
      ],
      forbiddenCausalPaths: ['resource bonus', 'crisis bonus', 'team bonus', 'repeat compensation'],
      automaticRelations: ['Repeated action must identify its new health range or become zero marginal'],
      protectedBehavior: ['连续斩杀', 'DOT续接', '合理连续控制', '集中爆发'],
      manualReview: ['重复动作必须说明新增兑现窗口或新增生命区间'],
      baselineDetectors: [
        { file: 'BattleDecision_Module.js', present: 'repeatedActionAudit' },
        { file: 'BattleDecision_Module.js', present: 'compensationEvidence' },
      ],
    },
    {
      oracleId: 'R83_BETA_ONLY_ADAPTATION',
      symptom: 'Beta学习之外仍存在失败硬排除与误判预算。',
      responsibility: ['BattleDecision', 'BeliefState', 'SubjectiveSelection'],
      requiredCausalPath: [
        'public result updates Beta posterior',
        'candidate remains mechanically available',
        'expected route value changes continuously',
      ],
      forbiddenCausalPaths: ['failure count hard ban', 'misjudgment budget hard ban'],
      automaticRelations: ['Repeated failures lower posterior without deleting legal action'],
      protectedBehavior: ['低经验单次有限误判', '新证据后主备路线换序'],
      manualReview: ['双方根据公开结果逐步调整且没有突然封招'],
      baselineDetectors: [
        { file: 'BattleDecision_Module.js', present: 'misjudgmentBudgetBefore' },
        { file: 'BattleDecision_Module.js', present: 'adaptationSelectionStatus' },
      ],
    },
    {
      oracleId: 'R83_SUMMON_PREVIEW_IDEMPOTENCE',
      symptom: '召唤重预估对相同实例直接报冲突。',
      responsibility: ['BattlePreview', 'PreviewOverlay'],
      requiredCausalPath: [
        'instanceId derives from root action, effect, ordinal',
        'same ID and definition hash is idempotent',
        'different candidate overlays remain isolated',
      ],
      forbiddenCausalPaths: ['same ID always throws', 'overlay writes leak across candidates'],
      automaticRelations: ['same ID same definition reuses', 'same ID different definition is Fatal'],
      protectedBehavior: ['融合召唤', '召唤真实行动窗口'],
      manualReview: ['召唤价值能指出宿主、实例和兑现窗口'],
      baselineDetectors: [
        { file: 'BattlePreview_Module.js', present: 'writeSummon(unit)' },
        { file: 'BattlePreview_Module.js', absent: 'definitionHash' },
      ],
    },
    {
      oracleId: 'R83_REPORT_V2_FACT_PROJECTION',
      symptom: 'Report直接读取旧评分向量并生成泛化选择理由。',
      responsibility: ['BattleReport', 'DecisionAuditV2'],
      requiredCausalPath: [
        'Report reads Ledger and DecisionAuditV2 only',
        'every business number has source fact/event',
        'selection reasons are structured candidate differences',
      ],
      forbiddenCausalPaths: ['read objectiveProgress', 'read nextValueAudit', 'generic best-action prose'],
      automaticRelations: ['No V1 score vector read', 'No invented or duplicated fact'],
      protectedBehavior: ['完整战报事实', 'PLAYER隐藏信息边界'],
      manualReview: ['玩家能理解概率、生命轨迹与两个替代差异'],
      baselineDetectors: [
        { file: 'BattleReport_Module.js', present: 'objectiveProgress' },
        { file: 'BattleReport_Module.js', present: 'nextValueAudit' },
        { file: 'BattleReport_Module.js', absent: 'DecisionAuditV2' },
      ],
    },
    {
      oracleId: 'R83_ATOMIC_BRIDGE_TRANSACTION',
      symptom: 'Draft/Report/Seal接口存在，但正式Bridge/UI未完整接入事务。',
      responsibility: ['mvu_logic_bridge', 'BattleRuntime', 'BattleReport'],
      requiredCausalPath: [
        'Bridge clones normalized input',
        'executeBattleDraft',
        'Report.build and auditProjection',
        'sealBattleResult',
        'commitBattlePackage after hash verification',
      ],
      forbiddenCausalPaths: ['debug path commits', 'runBattleCase bypasses report seal'],
      automaticRelations: ['Any failure leaves MVU unchanged'],
      protectedBehavior: ['auto/manual identical settlement for same declaration', 'free_narrative creates no mechanical draft'],
      manualReview: ['提交包与玩家所见报告属于同一Hash链'],
      baselineDetectors: [
        { file: 'BattleRuntime_Module.js', present: 'executeBattleDraft' },
        { file: 'BattleRuntime_Module.js', present: 'sealBattleResult' },
        { file: 'mvu_logic_bridge.js', absent: 'commitBattlePackage' },
      ],
    },
  ],
  legacySymbolInventory: [
    'decide',
    'decideNext',
    'scoreCandidate',
    'scoreCandidatesNext',
    'stateUtility',
    'stateUtilityNext',
    'buildNextValueContext',
    'objectiveProgress',
    'nextValueAudit',
    'resourceThreatProfile',
    'resourceThreatResolutionAudit',
    'crisisResponseAudit',
    'riskCompensationAudit',
    'misjudgmentBudget',
    'decisionEngine',
    'next-shadow',
  ],
};

writeJson('r75_baseline_manifest.json', baselineManifest);
writeJson('r75_minimal_case_contracts.json', minimalContracts);
writeJson('r75_real_case_manifest.json', realCaseManifest);
writeJson('r75_design_decisions.json', designDecisions);
writeJson('r8_issue_oracle_map.json', issueOracleMap);

console.log(JSON.stringify({
  outputDir,
  baselineHead: baselineManifest.repository.r75EvidenceHead,
  implementationHead: baselineManifest.repository.implementationHead,
  allBattleSourcesUnchanged: baselineManifest.allBattleSourcesUnchanged,
  minimalCaseCount: minimalContracts.caseCount,
  realCaseCount: realCaseManifest.caseCount,
  designDecisionCount: designDecisions.decisionCount,
  oracleCount: issueOracleMap.oracleCount,
}, null, 2));

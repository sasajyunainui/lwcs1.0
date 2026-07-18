import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const evidenceDir = path.join(toolDir, 'evidence', 'r8');
const readJson = fileName => JSON.parse(
  fs.readFileSync(path.join(evidenceDir, fileName), 'utf8'),
);
const sha256File = filePath => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

const requiredEvidenceFiles = [
  'r75_baseline_manifest.json',
  'r75_minimal_case_contracts.json',
  'r75_real_case_manifest.json',
  'r75_design_decisions.json',
  'r8_issue_oracle_map.json',
];
for (const fileName of requiredEvidenceFiles) {
  addCheck(
    `evidence:${fileName}`,
    fs.existsSync(path.join(evidenceDir, fileName)),
  );
}
if (checks.some(check => !check.passed)) {
  const output = {
    summary: {
      checkCount: checks.length,
      passedCount: checks.filter(check => check.passed).length,
      failedCount: checks.filter(check => !check.passed).length,
      knownIssueStatus: 'EVIDENCE_MISSING',
    },
    checks,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(1);
}

const baseline = readJson('r75_baseline_manifest.json');
const minimal = readJson('r75_minimal_case_contracts.json');
const real = readJson('r75_real_case_manifest.json');
const decisions = readJson('r75_design_decisions.json');
const oracleMap = readJson('r8_issue_oracle_map.json');
const sourceCache = new Map();
const sourceOf = fileName => {
  if (!sourceCache.has(fileName)) {
    sourceCache.set(fileName, fs.readFileSync(path.join(repoRoot, fileName), 'utf8'));
  }
  return sourceCache.get(fileName);
};

addCheck('baseline:schema', baseline.schemaVersion === '8.3-phase0-baseline-1');
addCheck('baseline:r75-head', baseline.repository?.r75EvidenceHead === '9f7151a405bf9d8ea1b14453551c3b6915999bad');
addCheck('baseline:implementation-head', baseline.repository?.implementationHead === '6dd2191c3d787230877e1af65f41dcb7c479ba50');
addCheck('baseline:all-sources-unchanged', baseline.allBattleSourcesUnchanged === true);
addCheck('baseline:source-count', baseline.unchangedBattleSourceCount === 7);

for (const [fileName, hashes] of Object.entries(baseline.coreFiles || {})) {
  const currentHash = sha256File(path.join(repoRoot, fileName));
  addCheck(
    `source-hash:${fileName}`,
    currentHash === hashes.implementationSha256 &&
      hashes.implementationSha256 === hashes.r75Sha256 &&
      hashes.unchangedSinceR75 === true,
    {
      expected: hashes.implementationSha256,
      actual: currentHash,
    },
  );
}

const requiredContractKeys = [
  'mechanicalLegalSet',
  'reasonableTacticalSet',
  'conditionallyReasonableSet',
  'clearlyCounterintuitiveSet',
  'allowedFiniteErrors',
  'unknowableFromPublicInformation',
  'directionalRelations',
];
const contractIsComplete = contract =>
  contract &&
  requiredContractKeys.every(key =>
    key === 'mechanicalLegalSet'
      ? Array.isArray(contract[key]) || String(contract[key] || '').trim().length > 0
      : Array.isArray(contract[key])
  ) &&
  (
    Array.isArray(contract.mechanicalLegalSet)
      ? contract.mechanicalLegalSet.length > 0
      : String(contract.mechanicalLegalSet || '').trim().length > 0
  ) &&
  [
    ...contract.reasonableTacticalSet,
    ...contract.clearlyCounterintuitiveSet,
    ...contract.directionalRelations,
  ].length > 0;
const forbiddenModelKeys = new Set([
  'models',
  'modelId',
  'modelHash',
  'score',
  'objectiveUtility',
  'expectedStateGain',
  'selectedCandidateId',
  'selectedAction',
  'selectionPath',
]);
const findForbiddenKeys = (value, currentPath = '$', findings = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, `${currentPath}[${index}]`, findings));
    return findings;
  }
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenModelKeys.has(key)) findings.push(`${currentPath}.${key}`);
    findForbiddenKeys(child, `${currentPath}.${key}`, findings);
  }
  return findings;
};

addCheck('minimal:case-count', minimal.caseCount === 54 && minimal.cases?.length === 54);
addCheck(
  'minimal:unique-case-ids',
  new Set((minimal.cases || []).map(item => item.caseId)).size === 54,
);
addCheck(
  'minimal:complete-contracts',
  (minimal.cases || []).every(item =>
    String(item.caseId || '').trim() &&
    Number.isInteger(item.seed) &&
    /^[a-f0-9]{64}$/.test(item.inputHash || '') &&
    contractIsComplete(item.behaviorContract) &&
    item.candidateCount === item.candidateIds?.length
  ),
);
const minimalForbidden = findForbiddenKeys(minimal);
addCheck('minimal:no-model-answers', minimalForbidden.length === 0, { findings: minimalForbidden });

addCheck('real:case-count', real.caseCount === 24 && real.snapshots?.length === 24);
addCheck(
  'real:unique-case-ids',
  new Set((real.snapshots || []).map(item => item.caseId)).size === 24,
);
addCheck(
  'real:complete-contracts',
  (real.snapshots || []).every(item =>
    String(item.caseId || '').trim() &&
    /^[a-f0-9]{64}$/.test(item.inputHash || '') &&
    /^[a-f0-9]{64}$/.test(item.manifestHash || '') &&
    Array.isArray(item.sourceCharacterIds) &&
    item.sourceCharacterIds.length > 0 &&
    item.sourceCharacterIds.every(id => /^[a-f0-9]{64}$/.test(item.sourceDataHashes?.[id] || '')) &&
    /^[a-f0-9]{64}$/.test(item.beliefHash || '') &&
    /^[a-f0-9]{64}$/.test(item.objectiveHash || '') &&
    contractIsComplete(item.behaviorContract)
  ),
);
addCheck(
  'real:deep-review-count',
  real.deepReviewSelection?.selectedCaseIds?.length === 8 &&
    (real.snapshots || []).filter(item => item.deepReview).length === 8,
);
addCheck(
  'real:full-battle-reference-count',
  (real.snapshots || []).filter(item => item.fullBattleReference).length === 8,
);
const realForbidden = findForbiddenKeys(real);
addCheck('real:no-model-answers', realForbidden.length === 0, { findings: realForbidden });

addCheck('decisions:count', decisions.decisionCount === 10 && decisions.decisions?.length === 10);
addCheck(
  'decisions:no-tbd',
  (decisions.decisions || []).every(item =>
    String(item.decisionId || '').trim() &&
    Array.isArray(item.alternatives) &&
    item.alternatives.length >= 2 &&
    Array.isArray(item.discriminatingCases) &&
    item.discriminatingCases.length > 0 &&
    String(item.selectedDesign || '').trim() &&
    !/TBD|后续决定|视情况调整/i.test(JSON.stringify(item))
  ),
);

addCheck('oracles:count', oracleMap.oracleCount === 10 && oracleMap.oracles?.length === 10);
const detectedIssues = [];
for (const oracle of oracleMap.oracles || []) {
  const detectorResults = (oracle.baselineDetectors || []).map(detector => {
    const source = sourceOf(detector.file);
    const passed = detector.present
      ? source.includes(detector.present)
      : !source.includes(detector.absent);
    return {
      file: detector.file,
      expectation: detector.present
        ? `present:${detector.present}`
        : `absent:${detector.absent}`,
      passed,
    };
  });
  const complete = [
    oracle.oracleId,
    oracle.symptom,
    oracle.responsibility,
    oracle.requiredCausalPath,
    oracle.forbiddenCausalPaths,
    oracle.automaticRelations,
    oracle.protectedBehavior,
    oracle.manualReview,
  ].every(value => Array.isArray(value) ? value.length > 0 : String(value || '').trim());
  const detected = complete && detectorResults.every(item => item.passed);
  if (detected) detectedIssues.push(oracle.oracleId);
  addCheck(`oracle:${oracle.oracleId}`, detected, { detectorResults });
}
addCheck(
  'oracles:all-current-blockers-detected',
  detectedIssues.length === 10,
  { detectedIssues },
);

const inventory = oracleMap.legacySymbolInventory || [];
const combinedSources = [
  'BattleDecision_Module.js',
  'BattlePreview_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
].map(sourceOf).join('\n');
const legacySymbolSnapshot = inventory.map(symbol => ({
  symbol,
  occurrenceCount: combinedSources.split(symbol).length - 1,
}));
addCheck(
  'legacy-symbols:snapshot-nonempty',
  legacySymbolSnapshot.some(item => item.occurrenceCount > 0),
  { legacySymbolSnapshot },
);

const utf8Targets = [
  ...requiredEvidenceFiles.map(fileName => path.join(evidenceDir, fileName)),
  path.join(toolDir, 'generate_battle_r83_phase0_evidence.mjs'),
  path.join(toolDir, 'audit_battle_r83_phase0.mjs'),
];
const mojibakeTokens = [
  '\uFFFD',
  '\u951F',
  '\u9428\u7684\u6ac8',
  '\u9286\u3006',
];
const mojibakeFindings = utf8Targets
  .filter(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');
    return mojibakeTokens.some(token => source.includes(token));
  })
  .map(filePath => path.relative(repoRoot, filePath));
addCheck('utf8:no-mojibake', mojibakeFindings.length === 0, { mojibakeFindings });

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    minimalCaseCount: minimal.caseCount,
    realCaseCount: real.caseCount,
    designDecisionCount: decisions.decisionCount,
    knownIssueCount: oracleMap.oracleCount,
    detectedKnownIssueCount: detectedIssues.length,
    knownIssueStatus: failed.length === 0
      ? 'BASELINE_FAILURES_FROZEN'
      : 'BASELINE_EVIDENCE_INVALID',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

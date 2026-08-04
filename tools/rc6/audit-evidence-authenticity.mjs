import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const baselinePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'baseline', 'manifest.json');
const historicalStatusPath = path.join(repoRoot, 'tools', 'evidence', 'r8', 'r83_rc6_current_task_status.json');
const evidenceRoot = path.join(repoRoot, 'tools', 'evidence', 'r8');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'invalidated-evidence-manifest.json');
const acceptedStatuses = new Set(['PASS', 'PASSED', 'ACCEPTED', 'COMPLETED']);
const hashMapKeys = new Set(['sourceHashes', 'sourceFileHashes', 'sourceCodeHashes', 'coreFileHashes']);

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const walkJsonFiles = directory => {
  const result = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith('.json')) result.push(absolutePath);
    }
  };
  visit(directory);
  return result.sort();
};

const hashValue = value => {
  if (typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)) return value;
  if (!value || typeof value !== 'object') return null;
  for (const key of ['sha256', 'hash', 'codeHash']) {
    if (typeof value[key] === 'string' && /^[a-f0-9]{64}$/u.test(value[key])) return value[key];
  }
  return null;
};

const collectSourceHashMaps = value => {
  const maps = [];
  const visit = (node, location) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const childLocation = location ? `${location}.${key}` : key;
      if (hashMapKeys.has(key) && child && typeof child === 'object' && !Array.isArray(child)) {
        const entries = {};
        for (const [fileName, rawHash] of Object.entries(child)) {
          const hash = hashValue(rawHash);
          if (hash) entries[fileName.replaceAll('\\', '/')] = hash;
        }
        maps.push({ location: childLocation, entries });
      }
      visit(child, childLocation);
    }
  };
  visit(value, '');
  return maps;
};

const baseline = readJson(baselinePath);
const expectedHashes = Object.fromEntries(
  Object.entries(baseline.sourceFiles).map(([fileName, value]) => [fileName, value.sha256]),
);
const historicalStatus = fs.existsSync(historicalStatusPath) ? readJson(historicalStatusPath) : {};
const explicitAccepted = new Map(
  (historicalStatus.acceptedEvidence || [])
    .filter(item => item && typeof item.artifact === 'string')
    .map(item => [item.artifact.replaceAll('\\', '/'), item]),
);

const parseFailures = [];
const parsed = new Map();
for (const filePath of walkJsonFiles(evidenceRoot)) {
  try {
    parsed.set(relative(filePath), readJson(filePath));
  } catch (error) {
    parseFailures.push({
      artifact: relative(filePath),
      contentSha256: sha256(fs.readFileSync(filePath)),
      error: error.message,
    });
  }
}

const discoveredAccepted = new Map(explicitAccepted);
for (const [artifact, document] of parsed) {
  if (acceptedStatuses.has(String(document?.status || '').toUpperCase())) {
    discoveredAccepted.set(artifact, { artifact, status: document.status, discovered: true });
  }
}

const inspectArtifact = (artifact, reference) => {
  const document = parsed.get(artifact);
  const row = {
    artifact,
    artifactContentSha256: null,
    artifactGeneratedAt: document?.generatedAt || null,
    referenceStatus: reference?.status || null,
    referenceArtifactContentSha256: reference?.artifactContentSha256 || reference?.artifactHash || null,
    referenceGeneratedAt: reference?.generatedAt || null,
    referenceCases: Array.isArray(reference?.cases) ? reference.cases : [],
    artifactCaseId: document?.caseId || null,
    artifactStatus: document?.status || null,
    sourceHashLocations: [],
    declaredSourceHashes: {},
    classification: 'EVIDENCE_GAP',
    reasons: [],
  };
  if (!document) {
    row.classification = 'INVALID_MISSING_ARTIFACT';
    row.reasons.push('ARTIFACT_NOT_FOUND');
    return row;
  }
  row.artifactContentSha256 = sha256(fs.readFileSync(path.join(repoRoot, artifact)));
  const maps = collectSourceHashMaps(document);
  row.sourceHashLocations = maps.map(map => map.location);
  const declared = Object.assign({}, ...maps.map(map => map.entries));
  row.declaredSourceHashes = declared;
  const coreEntries = Object.entries(expectedHashes).filter(([fileName]) => fileName in declared);
  const mismatches = coreEntries.filter(([fileName, expected]) => declared[fileName] !== expected);
  const missing = coreEntries.length === 0;
  const successful = acceptedStatuses.has(String(document.status || reference?.status || '').toUpperCase());
  if (!successful) row.reasons.push('ARTIFACT_STATUS_NOT_ACCEPTED');
  if (reference && !row.referenceArtifactContentSha256) row.reasons.push('ACCEPTANCE_CONTENT_HASH_MISSING');
  if (reference?.artifactContentSha256 && reference.artifactContentSha256 !== row.artifactContentSha256) {
    row.reasons.push('ACCEPTANCE_CONTENT_HASH_MISMATCH');
  }
  if (row.referenceCases.length && row.artifactCaseId && !row.referenceCases.includes(row.artifactCaseId)) {
    row.reasons.push('ACCEPTANCE_CASE_REFERENCE_MISMATCH');
  }
  if (missing) row.reasons.push('SOURCE_HASH_NOT_BOUND_TO_CORE_FILE');
  if (mismatches.length) row.reasons.push('SOURCE_HASH_MISMATCH');
  const acceptanceBound = !reference || (
    Boolean(row.referenceArtifactContentSha256)
    && row.referenceArtifactContentSha256 === row.artifactContentSha256
    && !row.reasons.includes('ACCEPTANCE_CASE_REFERENCE_MISMATCH')
  );
  if (successful && !missing && !mismatches.length && acceptanceBound) {
    row.classification = 'AUTHENTIC_CURRENT_HASH';
  } else if (!acceptanceBound) {
    row.classification = 'EVIDENCE_GAP_ACCEPTANCE_UNBOUND';
  } else if (mismatches.length) {
    row.classification = 'INVALID_SOURCE_HASH';
  } else if (missing) {
    row.classification = 'EVIDENCE_GAP_NO_SOURCE_HASH';
  } else {
    row.classification = 'NOT_ACCEPTED';
  }
  return row;
};

const reviewed = [...discoveredAccepted.keys()].sort().map(artifact => inspectArtifact(artifact, discoveredAccepted.get(artifact)));
const summary = reviewed.reduce((counts, row) => {
  counts[row.classification] = (counts[row.classification] || 0) + 1;
  return counts;
}, {});
const outputCore = {
  schemaVersion: 'InvalidatedEvidenceManifestV1',
  planId: 'BattleUI-R8.3-RC6',
  planRevision: 24,
  generatedAt: new Date().toISOString(),
  baselineManifest: relative(baselinePath),
  baselineManifestHash: baseline.manifestHash,
  repository: baseline.repository,
  scan: {
    evidenceRoot: relative(evidenceRoot),
    jsonArtifactCount: parsed.size,
    parseFailureCount: parseFailures.length,
    parseFailures,
    acceptedCandidateCount: reviewed.length,
    summary,
    status: 'PASS_WITH_EXPLICIT_HISTORICAL_INVALIDATIONS',
    invalidationClosed: true,
  },
  currentSourceHashes: expectedHashes,
  reviewedArtifacts: reviewed,
  inheritance: {
    policy: 'Only AUTHENTIC_CURRENT_HASH artifacts may be inherited; all other evidence is historical or requires re-generation.',
    inherited: reviewed.filter(row => row.classification === 'AUTHENTIC_CURRENT_HASH').map(row => row.artifact),
    invalidated: [
      ...reviewed.filter(row => row.classification !== 'AUTHENTIC_CURRENT_HASH').map(row => row.artifact),
      ...parseFailures.map(row => row.artifact),
    ],
    malformedArtifacts: parseFailures,
  },
};
const output = {
  ...outputCore,
  manifestHash: sha256(JSON.stringify(outputCore)),
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  manifestHash: output.manifestHash,
  acceptedCandidateCount: reviewed.length,
  summary,
  parseFailureCount: parseFailures.length,
}, null, 2)}\n`);

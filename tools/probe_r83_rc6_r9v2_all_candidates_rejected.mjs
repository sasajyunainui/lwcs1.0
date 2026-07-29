import fs from 'node:fs';
import path from 'node:path';
import {
  executeFormalTransaction,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
  repoRoot,
  sha256,
  sourceHashes,
} from './r83_rc6_battle_harness.mjs';

const caseId = process.argv[2] || 'raid_summon_heavy';
const outputPath = path.resolve(
  repoRoot,
  process.argv[3] ||
    'tools/evidence/r8/r83_rc6_r9v2_all_candidates_rejected_probe_2026-07-29.json',
);
const decisionPath = path.join(repoRoot, 'BattleDecision_Module.js');
const source = fs.readFileSync(decisionPath, 'utf8');
const anchor = `    if (!rows.length) {
      throw new Error('R9V2_ALL_CANDIDATES_REJECTED');
    }`;
if (source.split(anchor).length !== 2) {
  throw new Error('R9V2_REJECTED_PROBE_ANCHOR_MISMATCH');
}
const replacement = `    if (!rows.length) {
      const diagnostic = {
        actorId: String(request?.actorId || ''),
        opportunity: {
          opportunityId: String(request?.actionOpportunity?.opportunityId || ''),
          role: String(request?.actionOpportunity?.role || ''),
          grantType: String(request?.actionOpportunity?.grantType || ''),
          sourceActorId: String(request?.actionOpportunity?.sourceActorId || ''),
        },
        frozenCandidateCount: candidates.length,
        preparedEntryCount: prepared.entries.length,
        preparedProofCount: prepared.proofs.length,
        candidates: candidates.map(candidate => {
          const entry = entryByCandidate.get(candidate.candidateId);
          const proof = proofByCandidate.get(candidate.candidateId);
          const row = { candidate, entry, proof };
          return {
            candidateId: String(candidate?.candidateId || ''),
            actionKind: String(entry?.actionKind || candidate?.declaration?.actionKind || ''),
            targetIds: Array.isArray(entry?.targetIds) ? [...entry.targetIds] : [],
            entryPresent: Boolean(entry),
            proofPresent: Boolean(proof),
            hardInvalid: entry?.hardInvalid === true,
            proofRejectionCode: String(proof?.rejectionCode || ''),
            providerRejectionCode: entry && proof
              ? r9v2ProviderRejectionCode(request, row)
              : '',
            goalUtilityDeltaHEPP: Number(proof?.goalUtilityDeltaHEPP || 0),
            informationValueHEPP: Number(proof?.informationValueHEPP || 0),
            objectiveUtilityHEPP: Number(proof?.objectiveUtilityHEPP || 0),
          };
        }),
      };
      throw new Error(
        'R9V2_ALL_CANDIDATES_REJECTED_DIAGNOSTIC:' +
        JSON.stringify(diagnostic)
      );
    }`;
const instrumentedSource = source.replace(anchor, replacement);
const sandbox = loadBattleSandbox({
  sourceOverrides: {
    'BattleDecision_Module.js': instrumentedSource,
  },
});
const definition = manualCasesById(sandbox).get(caseId);
if (!definition) throw new Error(`R9V2_REJECTED_PROBE_CASE_MISSING:${caseId}`);
const input = formalInput(definition, 'r9v2-shadow');
delete input.settings.collectDecisionReplayIdentity;
let caught = null;
const startedAt = performance.now();
try {
  executeFormalTransaction(sandbox, input);
} catch (error) {
  caught = error;
}
const elapsedMs = Number((performance.now() - startedAt).toFixed(3));
const prefix =
  'STRUCTURED_SHADOW_NODE_FAILED:' +
  'R9V2_ALL_CANDIDATES_REJECTED_DIAGNOSTIC:';
const message = String(caught?.message || caught || '');
if (!message.startsWith(prefix)) {
  throw new Error(`R9V2_REJECTED_PROBE_UNEXPECTED_RESULT:${message || 'success'}`);
}
const diagnostic = JSON.parse(message.slice(prefix.length));
const evidence = {
  schemaVersion: 'R9v2AllCandidatesRejectedProbeV1',
  generatedAt: new Date().toISOString(),
  caseId,
  providerId: 'r9v2-shadow',
  inputHash: sha256(input),
  sourceHashes: sourceHashes([
    'BattlePreview_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
    'BattleReport_Module.js',
  ]),
  probeHashes: {
    originalDecisionSource: sha256(source),
    instrumentedDecisionSource: sha256(instrumentedSource),
  },
  elapsedMs,
  diagnostic,
  formalSourceModified: false,
  manualReviews: [],
  automaticConclusionGenerated: false,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath,
  evidenceHash: sha256(evidence),
  elapsedMs,
  actorId: diagnostic.actorId,
  opportunity: diagnostic.opportunity,
  candidates: diagnostic.candidates,
}, null, 2)}\n`);

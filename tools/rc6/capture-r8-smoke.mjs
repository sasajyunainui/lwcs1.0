import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'r8-formal-smoke.json');
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const stdout = execFileSync(process.execPath, ['tools/audit_battle_r83_r8_formal_entry.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 128 * 1024 * 1024,
});
const evidence = JSON.parse(stdout);
const checks = (evidence.checks || []).map(check => ({
  checkId: check.checkId,
  passed: check.passed,
  actual: check.actual,
  ledgerCount: check.ledgerCount,
  traceCount: check.traceCount,
  sealedSchemaVersion: check.sealedSchemaVersion,
  sealStatus: check.sealStatus,
  sealError: check.sealError || '',
  verifyError: check.verifyError || '',
}));
const outputCore = {
  schemaVersion: 'R8FormalSmokeEvidenceV1',
  generatedAt: new Date().toISOString(),
  providerId: 'r8',
  sourceHashes: Object.fromEntries([
    'BattlePreview_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
    'BattleReport_Module.js',
  ].map(fileName => [fileName, sha256(fs.readFileSync(path.join(repoRoot, fileName)))])),
  toolHash: sha256(fs.readFileSync(path.join(repoRoot, 'tools/audit_battle_r83_r8_formal_entry.mjs'))),
  evidence: {
    schemaVersion: evidence.schemaVersion,
    summary: evidence.summary,
    checks,
    hashes: evidence.hashes,
  },
  status: evidence.summary?.formalEntryStatus === 'R8_FORMAL_ENTRY_PASSED' ? 'PASS' : 'FAIL',
};
const output = { ...outputCore, evidenceHash: sha256(JSON.stringify(outputCore)) };
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  status: output.status,
  passedCount: evidence.summary?.passedCount || 0,
  failedCount: evidence.summary?.failedCount || 0,
  evidenceHash: output.evidenceHash,
}, null, 2)}\n`);
if (output.status !== 'PASS') process.exitCode = 1;

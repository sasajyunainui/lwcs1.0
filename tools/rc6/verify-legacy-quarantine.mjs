import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const auditPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'control-writer-audit.json');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'legacy-writer-quarantine.json');
const productionFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
  'tools/rc6/record-evidence-event.mjs',
  'tools/rc6/reduce-status.mjs',
];
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = fileName => fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const legacyWriters = Array.isArray(audit.legacyWriters) ? audit.legacyWriters : [];
const writerRecords = legacyWriters.map(item => {
  const filePath = path.join(repoRoot, item.file);
  return {
    file: item.file,
    exists: fs.existsSync(filePath),
    sha256: fs.existsSync(filePath) ? sha256(fs.readFileSync(filePath)) : null,
  };
});
const productionText = productionFiles.map(fileName => ({
  file: fileName,
  text: read(fileName),
}));
const legacyPathReferences = productionText.flatMap(item => {
  const matches = item.text.match(/r83_rc6_current_task_status|reconcile_r83_rc6_current_task_status|record_r83_rc6_s[3456]/gu) || [];
  return matches.map(match => ({ file: item.file, match }));
});
const newAuthorityReferencesLegacy = productionText
  .filter(item => item.file.endsWith('record-evidence-event.mjs') || item.file.endsWith('reduce-status.mjs'))
  .flatMap(item => {
    const matches = item.text.match(/tools[\\/]evidence[\\/]r8|r83_rc6_current_task_status/gu) || [];
    return matches.map(match => ({ file: item.file, match }));
  });
const missingLegacyFiles = writerRecords.filter(record => !record.exists);
const outputCore = {
  schemaVersion: 'LegacyWriterQuarantineV1',
  generatedAt: new Date().toISOString(),
  legacyStatusPath: 'tools/evidence/r8/r83_rc6_current_task_status.json',
  authorityPath: 'tools/rc6/generated/current-task-status.json',
  legacyWriters: writerRecords,
  checks: {
    legacyWriterCount: writerRecords.length,
    allWriterFilesPresent: missingLegacyFiles.length === 0,
    productionReferencesLegacyStatus: legacyPathReferences,
    newAuthorityReferencesLegacyStatus: newAuthorityReferencesLegacy,
    newAuthorityEventWriter: 'tools/rc6/record-evidence-event.mjs',
    newAuthorityStateWriter: 'tools/rc6/reduce-status.mjs',
  },
  policy: 'Legacy status writers are historical-only and are not accepted as v24 state inputs. v24 state is read only from EvidenceEventV1 and reduced output.',
  status: missingLegacyFiles.length === 0 && legacyPathReferences.length === 0 && newAuthorityReferencesLegacy.length === 0
    ? 'PASS_QUARANTINED'
    : 'FAIL',
};
const output = { ...outputCore, quarantineHash: sha256(JSON.stringify(outputCore)) };
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  status: output.status,
  legacyWriterCount: writerRecords.length,
  productionReferenceCount: legacyPathReferences.length,
  newAuthorityReferenceCount: newAuthorityReferencesLegacy.length,
  quarantineHash: output.quarantineHash,
}, null, 2)}\n`);
if (output.status !== 'PASS_QUARANTINED') process.exitCode = 1;

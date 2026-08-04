import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rc6Root = path.join(repoRoot, 'tools', 'rc6');
const toolsRoot = path.join(repoRoot, 'tools');
const outputPath = path.join(rc6Root, 'evidence', 'control-writer-audit.json');
const allowedEventWriter = 'tools/rc6/record-evidence-event.mjs';
const allowedStateWriter = 'tools/rc6/reduce-status.mjs';
const relative = absolutePath => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const walkSourceFiles = directory => {
  const files = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['evidence', 'artifacts', 'generated', 'node_modules'].includes(entry.name)) continue;
        visit(absolutePath);
      } else if (entry.isFile() && /\.(?:mjs|js)$/u.test(entry.name)) {
        files.push(absolutePath);
      }
    }
  };
  visit(directory);
  return files.filter(filePath => !filePath.endsWith('audit-control-writers.mjs')).sort();
};
const sourceFiles = walkSourceFiles(toolsRoot);
const violations = [];
const legacyWriters = [];
const scanned = sourceFiles.map(filePath => {
  const relativePath = relative(filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const writesEvents = relativePath !== allowedStateWriter
    && /eventDir|evidence[\\/]events|append\.lock/u.test(text)
    && /writeFileSync|renameSync|rmSync/u.test(text);
  const writesState = ![allowedEventWriter, 'tools/rc6/verify-legacy-quarantine.mjs'].includes(relativePath)
    && /current-task-status|generated[\\/]current-task-status/u.test(text)
    && /writeFileSync|renameSync/u.test(text);
  const writesLegacyStatus = ![allowedEventWriter, allowedStateWriter, 'tools/rc6/audit-evidence-authenticity.mjs', 'tools/rc6/verify-legacy-quarantine.mjs'].includes(relativePath)
    && /r83_rc6_current_task_status\.json|current_task_status/u.test(text)
    && /writeFileSync|writeFile|renameSync/u.test(text);
  if (writesEvents && relativePath !== allowedEventWriter) {
    violations.push({ file: relativePath, code: 'UNAUTHORIZED_EVENT_WRITER' });
  }
  if (writesState && relativePath !== allowedStateWriter) {
    violations.push({ file: relativePath, code: 'UNAUTHORIZED_STATE_WRITER' });
  }
  if (writesLegacyStatus) legacyWriters.push({ file: relativePath, code: 'LEGACY_STATUS_WRITER' });
  return { file: relativePath, sha256: sha256(text), writesEvents, writesState, writesLegacyStatus };
});
const outputCore = {
  schemaVersion: 'RC6ControlWriterAuditV1',
  generatedAt: new Date().toISOString(),
  allowedEventWriter,
  allowedStateWriter,
  scannedRoot: relative(toolsRoot),
  scanned,
  violations,
  legacyStatusPath: 'tools/evidence/r8/r83_rc6_current_task_status.json',
  legacyWriters,
  legacyPolicy: 'Historical writers are quarantined inputs; they cannot write tools/rc6/evidence/events or tools/rc6/generated/current-task-status.json and are excluded from the v24 authority graph.',
  status: violations.length === 0
    ? legacyWriters.length === 0 ? 'PASS' : 'PASS_WITH_LEGACY_WRITERS_QUARANTINED'
    : 'FAIL',
};
const output = { ...outputCore, auditHash: sha256(JSON.stringify(outputCore)) };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  outputPath: relative(outputPath),
  status: output.status,
  scannedCount: scanned.length,
  violations,
  legacyWriterCount: legacyWriters.length,
  legacyWriters: legacyWriters.map(item => item.file),
  auditHash: output.auditHash,
}, null, 2)}\n`);
if (violations.length) process.exitCode = 1;

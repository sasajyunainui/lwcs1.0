import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write([
    'Usage: node tools/rc6/record-evidence-event.mjs [options]',
    'Options: --milestone --task --event-type --status --tool --fixture',
    '         --accepted --invalidated --details --reason',
  ].join('\n') + '\n');
  process.exit(0);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const eventDir = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'events');
const coreFiles = [
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
];

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const HASH_PATTERN = /^[a-f0-9]{64}$/iu;
const git = args => execFileSync('git', args, {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true,
}).trim();
const argument = name => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
};
const listArgument = name => process.argv.flatMap((value, index) => {
  if (value === `--${name}`) return [String(process.argv[index + 1] || '').trim()];
  if (value.startsWith(`--${name}=`)) return [value.slice(name.length + 3).trim()];
  return [];
}).filter(Boolean);
const hashListArgument = name => {
  const values = listArgument(name);
  const invalid = values.find(value => !HASH_PATTERN.test(value));
  if (invalid) throw new Error(`RC6_EVENT_OBJECT_HASH_INVALID:${name}:${invalid}`);
  return values.map(value => value.toLowerCase());
};
const readJsonArgument = name => {
  const value = argument(name);
  if (!value) return {};
  try { return JSON.parse(value); } catch (error) {
    throw new Error(`RC6_EVENT_JSON_INVALID:${name}:${error.message}`);
  }
};
const hashFiles = files => Object.fromEntries(files.map(fileName => {
  const absolutePath = path.join(repoRoot, fileName);
  return [fileName, fs.existsSync(absolutePath) ? sha256(fs.readFileSync(absolutePath)) : null];
}));
const eventFiles = () => fs.existsSync(eventDir)
  ? fs.readdirSync(eventDir).filter(fileName => /^\d{6}-[a-f0-9]{64}\.json$/u.test(fileName)).sort()
  : [];
const verifyEventChain = files => {
  let previousHash = null;
  files.forEach((fileName, index) => {
    const event = JSON.parse(fs.readFileSync(path.join(eventDir, fileName), 'utf8'));
    if (event.sequence !== index + 1 || event.previousEventHash !== previousHash) {
      throw new Error(`RC6_EVENT_CHAIN_INVALID:${event.sequence}`);
    }
    const { eventHash, ...eventCore } = event;
    if (eventHash !== sha256(JSON.stringify(eventCore))) {
      throw new Error(`RC6_EVENT_HASH_INVALID:${event.sequence}`);
    }
    previousHash = eventHash;
  });
  return previousHash;
};
const existingEventFiles = eventFiles();
const previousFile = existingEventFiles.at(-1) || null;
let previousEventHash = null;
let sequence = 1;
if (previousFile) {
  previousEventHash = verifyEventChain(existingEventFiles);
  const previous = JSON.parse(fs.readFileSync(path.join(eventDir, previousFile), 'utf8'));
  sequence = Number(previous.sequence) + 1;
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('RC6_EVENT_SEQUENCE_INVALID');
}
const eventCore = {
  schemaVersion: 'EvidenceEventV1',
  sequence,
  previousEventHash,
  milestoneId: argument('milestone') || 'M0',
  taskId: argument('task') || 'M0-E01',
  eventType: argument('event-type') || 'EVIDENCE_RECORDED',
  status: argument('status') || 'IN_PROGRESS',
  sourceHashes: hashFiles(coreFiles),
  toolHashes: Object.fromEntries(listArgument('tool').map(fileName => [fileName, sha256(fs.readFileSync(path.join(repoRoot, fileName)))])),
  fixtureHashes: Object.fromEntries(listArgument('fixture').map(fileName => [fileName, sha256(fs.readFileSync(path.join(repoRoot, fileName)))])),
  acceptedObjectHashes: hashListArgument('accepted'),
  invalidatedObjectHashes: hashListArgument('invalidated'),
  details: readJsonArgument('details'),
  reason: argument('reason'),
  recordedAt: new Date().toISOString(),
  repository: {
    branch: git(['branch', '--show-current']),
    head: git(['rev-parse', 'HEAD']),
  },
};
const eventHash = sha256(JSON.stringify(eventCore));
const event = { ...eventCore, eventHash };
fs.mkdirSync(eventDir, { recursive: true });
const lockPath = path.join(eventDir, '.append.lock');
let lockHandle;
try {
  lockHandle = fs.openSync(lockPath, 'wx');
} catch {
  throw new Error('RC6_EVENT_WRITER_BUSY');
}
const outputPath = path.join(eventDir, `${String(sequence).padStart(6, '0')}-${eventHash}.json`);
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
try {
  fs.writeFileSync(temporaryPath, `${JSON.stringify(event, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, outputPath);
} finally {
  if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  fs.closeSync(lockHandle);
  fs.rmSync(lockPath, { force: true });
}
process.stdout.write(`${JSON.stringify({
  eventPath: path.relative(repoRoot, outputPath).replaceAll(path.sep, '/'),
  sequence,
  eventHash,
  eventType: event.eventType,
  milestoneId: event.milestoneId,
  taskId: event.taskId,
}, null, 2)}\n`);

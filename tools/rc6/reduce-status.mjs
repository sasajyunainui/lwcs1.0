import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const eventDir = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'events');
const outputPath = path.join(repoRoot, 'tools', 'rc6', 'generated', 'current-task-status.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const eventFiles = fs.existsSync(eventDir)
  ? fs.readdirSync(eventDir).filter(fileName => /^\d{6}-[a-f0-9]{64}\.json$/u.test(fileName)).sort()
  : [];
const events = eventFiles.map(fileName => JSON.parse(fs.readFileSync(path.join(eventDir, fileName), 'utf8')));
let previousHash = null;
events.forEach((event, index) => {
  if (event.sequence !== index + 1 || event.previousEventHash !== previousHash) {
    throw new Error(`RC6_EVENT_CHAIN_INVALID:${event.sequence}`);
  }
  const { eventHash, ...eventCore } = event;
  if (eventHash !== sha256(JSON.stringify(eventCore))) throw new Error(`RC6_EVENT_HASH_INVALID:${event.sequence}`);
  previousHash = eventHash;
});
const latest = events.at(-1) || null;
const milestoneIds = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
const completedMilestones = new Set(events
  .filter(event => event.eventType === 'MILESTONE_COMPLETED' && event.status === 'COMPLETED')
  .map(event => event.milestoneId));
const latestMilestoneStatus = latest
  ? latest.eventType === 'MILESTONE_COMPLETED' && latest.status === 'COMPLETED'
    ? 'COMPLETED'
    : latest.status === 'BLOCKED'
      ? 'BLOCKED'
      : 'IN_PROGRESS'
  : 'PENDING';
const status = {
  schemaVersion: 'RC6TaskStatusV1',
  statusSource: 'EvidenceEventV1_REDUCED',
  generatedAt: new Date().toISOString(),
  eventCount: events.length,
  latestEventHash: latest?.eventHash || null,
  currentMilestone: latest?.milestoneId || 'M0',
  currentTask: latest?.taskId || 'M0-E01',
  milestoneStatus: latestMilestoneStatus,
  overallStatus: 'NOT_COMPLETE',
  formalProvider: 'r8',
  targetProvider: 'r9v2',
  activeAgents: Array.isArray(latest?.details?.activeAgents)
    ? latest.details.activeAgents
    : [],
  activeProcesses: Array.isArray(latest?.details?.activeProcesses)
    ? latest.details.activeProcesses
    : [],
  milestones: milestoneIds.map(id => ({
    id,
    status: completedMilestones.has(id)
      ? 'COMPLETED'
      : id === (latest?.milestoneId || 'M0')
        ? latestMilestoneStatus
        : 'PENDING',
  })),
  nextExitCondition: latest?.details?.nextExitCondition || 'M0-E01 baseline event recorded',
  lastMeaningfulChange: latest?.reason || null,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, outputPath);
process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);

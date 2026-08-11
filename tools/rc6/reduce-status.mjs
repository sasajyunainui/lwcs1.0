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
const milestoneIndex = new Map(milestoneIds.map((id, index) => [id, index]));
const milestoneStatuses = Object.fromEntries(milestoneIds.map(id => [id, 'PENDING']));
const completedMilestones = new Set();
const deferredNonBlockingMilestones = new Set();
const invalidatedObjectHashes = new Set();
const acceptedObjectHashes = new Set();
const malformedEvidenceReferences = new Set();
const evidenceOwners = new Map();
const invalidatedMilestones = new Set();
let nextExitCondition = 'M0-E01 baseline event recorded';
let strictMilestoneOrder = false;
const hashPattern = /^[a-f0-9]{64}$/iu;
const requirePriorMilestones = milestoneId => {
  const index = milestoneIndex.get(milestoneId);
  if (index === undefined) throw new Error(`RC6_UNKNOWN_MILESTONE:${milestoneId}`);
  return milestoneIds.slice(0, index);
};
const clearMilestoneAndDownstream = (milestoneId, includeSelf = true) => {
  const index = milestoneIndex.get(milestoneId);
  if (index === undefined) throw new Error(`RC6_UNKNOWN_MILESTONE:${milestoneId}`);
  const first = includeSelf ? index : index + 1;
  milestoneIds.slice(first).forEach(id => {
    completedMilestones.delete(id);
    deferredNonBlockingMilestones.delete(id);
    milestoneStatuses[id] = 'PENDING';
  });
};
events.forEach(event => {
  if (event?.details?.strictMilestoneOrder === true) strictMilestoneOrder = true;
  const eventNextExitCondition = String(event?.details?.nextExitCondition || '').trim();
  if (eventNextExitCondition) nextExitCondition = eventNextExitCondition;
  const accepted = Array.isArray(event.acceptedObjectHashes) ? event.acceptedObjectHashes : [];
  const invalidated = Array.isArray(event.invalidatedObjectHashes) ? event.invalidatedObjectHashes : [];
  const deferredMilestones = Array.isArray(event?.details?.deferredMilestones)
    ? event.details.deferredMilestones.map(value => String(value))
    : [];
  deferredMilestones.forEach(id => {
    if (!milestoneIndex.has(id)) throw new Error(`RC6_UNKNOWN_MILESTONE:${id}`);
    if (!completedMilestones.has(id)) {
      deferredNonBlockingMilestones.add(id);
      milestoneStatuses[id] = 'DEFERRED_NON_BLOCKING';
    }
  });
  accepted.forEach(hash => {
    if (!hashPattern.test(String(hash))) {
      malformedEvidenceReferences.add(String(hash));
      return;
    }
    const normalizedHash = String(hash).toLowerCase();
    evidenceOwners.set(normalizedHash, event.milestoneId);
    acceptedObjectHashes.add(normalizedHash);
    // A later accepted event is a new attestation of the same content hash.
    invalidatedObjectHashes.delete(normalizedHash);
  });
  invalidated.forEach(hash => {
    if (!hashPattern.test(String(hash))) {
      malformedEvidenceReferences.add(String(hash));
      return;
    }
    const normalizedHash = String(hash).toLowerCase();
    invalidatedObjectHashes.add(normalizedHash);
    acceptedObjectHashes.delete(normalizedHash);
  });

  if (event.eventType === 'MILESTONE_REOPENED' || event.eventType === 'MILESTONE_BLOCKED') {
    clearMilestoneAndDownstream(event.milestoneId, true);
    deferredNonBlockingMilestones.delete(event.milestoneId);
    invalidatedMilestones.add(event.milestoneId);
    milestoneStatuses[event.milestoneId] = event.eventType === 'MILESTONE_BLOCKED' || event.status === 'BLOCKED'
      ? 'BLOCKED'
      : 'IN_PROGRESS';
  }

  if (event.eventType === 'EVIDENCE_INVALIDATED' || event.eventType === 'EVIDENCE_SUPERSEDED') {
    invalidated.forEach(hash => {
      const owner = evidenceOwners.get(hash);
      if (owner) {
        invalidatedMilestones.add(owner);
        clearMilestoneAndDownstream(owner, true);
      }
    });
  }

  if (event.eventType === 'MILESTONE_COMPLETED' && event.status === 'COMPLETED') {
    const milestoneEvidenceInvalid = accepted.some(hash => invalidatedObjectHashes.has(hash));
    if (milestoneEvidenceInvalid) {
      invalidatedMilestones.add(event.milestoneId);
      clearMilestoneAndDownstream(event.milestoneId, true);
    } else {
      const missingDependency = requirePriorMilestones(event.milestoneId)
        .find(id => !completedMilestones.has(id));
      if (missingDependency) {
        throw new Error(`RC6_MILESTONE_DEPENDENCY_INVALID:${event.milestoneId}:${missingDependency}`);
      }
      completedMilestones.add(event.milestoneId);
      milestoneStatuses[event.milestoneId] = 'COMPLETED';
      deferredNonBlockingMilestones.delete(event.milestoneId);
      invalidatedMilestones.delete(event.milestoneId);
    }
  }

  if (event.eventType === 'MILESTONE_STARTED') {
    if (strictMilestoneOrder) {
      const missingDependency = requirePriorMilestones(event.milestoneId)
        .find(id => !completedMilestones.has(id));
      if (missingDependency) {
        throw new Error(`RC6_MILESTONE_START_DEPENDENCY_INVALID:${event.milestoneId}:${missingDependency}`);
      }
    }
    clearMilestoneAndDownstream(event.milestoneId, false);
    deferredNonBlockingMilestones.delete(event.milestoneId);
    milestoneStatuses[event.milestoneId] = 'IN_PROGRESS';
  }
});

const latestMilestoneStatus = latest
  ? latest.eventType === 'MILESTONE_COMPLETED' && latest.status === 'COMPLETED'
    ? milestoneStatuses[latest.milestoneId] || 'COMPLETED'
    : latest.eventType === 'MILESTONE_BLOCKED' || latest.status === 'BLOCKED'
      ? 'BLOCKED'
      : milestoneStatuses[latest.milestoneId] === 'COMPLETED'
        ? 'COMPLETED'
        : 'IN_PROGRESS'
  : 'PENDING';
const status = {
  schemaVersion: 'RC6TaskStatusV1',
  statusSource: 'EvidenceEventV1_REDUCED',
  generatedAt: new Date().toISOString(),
  eventCount: events.length,
  latestEventHash: latest?.eventHash || null,
  milestoneId: latest?.milestoneId || 'M0',
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
  sourceHashes: latest?.sourceHashes || {},
  currentBlocker: latest?.details?.currentBlocker ||
    (latest?.status === 'BLOCKED' ? latest.reason || null : null),
  milestones: milestoneIds.map(id => ({
    id,
    status: milestoneStatuses[id] === 'COMPLETED'
      ? 'COMPLETED'
      : id === (latest?.milestoneId || 'M0')
        ? latestMilestoneStatus
        : milestoneStatuses[id] || 'PENDING',
  })),
  deferredNonBlockingMilestones: [...deferredNonBlockingMilestones],
  strictMilestoneOrder,
  acceptedEvidence: [...acceptedObjectHashes],
  invalidatedEvidence: [...invalidatedObjectHashes],
  invalidatedObjectHashes: [...invalidatedObjectHashes],
  malformedEvidenceReferences: [...malformedEvidenceReferences],
  invalidatedMilestones: [...invalidatedMilestones],
  nextExitCondition,
  lastMeaningfulChange: latest?.reason || null,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
try {
  fs.renameSync(temporaryPath, outputPath);
} catch (error) {
  if (error?.code !== 'EPERM' && error?.code !== 'EEXIST') throw error;
  // Windows cannot replace an existing file with renameSync. Keep the
  // event chain authoritative and use the prepared file as the fallback.
  fs.copyFileSync(temporaryPath, outputPath);
  fs.unlinkSync(temporaryPath);
}
process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);

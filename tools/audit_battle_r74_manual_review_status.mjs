import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const args = process.argv.slice(2);
const phaseIndex = args.indexOf('--phase');
const phase = phaseIndex >= 0 ? Number(args[phaseIndex + 1]) : 0;
if (!Number.isInteger(phase) || phase < 0 || phase > 10) {
  console.error('battle_r74_manual_review_phase_invalid');
  process.exit(2);
}

const requiredPhases = new Set([5, 7, 8, 10]);
const required = requiredPhases.has(phase);
const manifestPath = path.resolve(root, 'artifacts', 'battle_r74_manual_reviews', `phase_${phase}.json`);
let manualReviewStatus = required ? 'PENDING' : 'NOT_SCHEDULED';
let reviewCount = 0;
let invalidReviewCount = 0;

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const reviews = Array.isArray(manifest?.reviews) ? manifest.reviews : [];
  reviewCount = reviews.length;
  invalidReviewCount = reviews.filter(review => {
    const verdicts = review?.verdicts || {};
    const evidence = Array.isArray(review?.evidence) ? review.evidence : [];
    return !String(review?.caseId || '').trim() ||
      !['PASSED', 'BLOCKED'].includes(String(review?.status || '').trim()) ||
      !String(verdicts?.behavior || '').trim() ||
      !String(verdicts?.readability || '').trim() ||
      !String(verdicts?.adjudication || '').trim() ||
      evidence.length < 3 ||
      evidence.some(item => !Number.isInteger(Number(item?.round)) || !String(item?.exchangeId || item?.eventId || '').trim());
  }).length;
  const blocked = reviews.some(review => String(review?.status || '').trim() === 'BLOCKED');
  const declaredStatus = String(manifest?.status || '').trim();
  if (blocked || declaredStatus === 'BLOCKED') manualReviewStatus = 'BLOCKED';
  else if (declaredStatus === 'PASSED' && reviews.length > 0 && invalidReviewCount === 0) manualReviewStatus = 'PASSED';
  else manualReviewStatus = 'PENDING';
}

const summary = {
  phase,
  manualReviewRequired: required,
  manualReviewStatus,
  reviewCount,
  invalidReviewCount,
  manifestPath,
  prewrittenReviewNotesAccepted: false,
};

console.log(JSON.stringify({ summary }, null, 2));
if (required && manualReviewStatus !== 'PASSED') process.exitCode = 1;

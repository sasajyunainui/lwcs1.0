import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  executeFormalTransaction,
  formalInput,
  loadBattleSandbox,
  manualCasesById,
  repoRoot,
  sha256,
  sourceHashes,
} from './r83_rc6_battle_harness.mjs';

const toolPath = fileURLToPath(import.meta.url);
const outputPath = path.resolve(
  repoRoot,
  process.argv.find(value => value.startsWith('--output='))?.slice(9) ||
    'tools/evidence/r8/r83_rc6_r8_item_inventory_divergence_probe_2026-07-29.json',
);
const previewPath = path.join(repoRoot, 'BattlePreview_Module.js');
const previewSource = fs.readFileSync(previewPath, 'utf8');
const originalFailure = [
  '        if (!inventoryItem || quantityBefore < 1) {',
  "          throw new Error(`battle_preview_item_unavailable:${String(declaration?.irreversibleAsset?.assetId || declaration?.skill?.name || '').trim()}`);",
  '        }',
].join('\n');
const instrumentedFailure = [
  '        if (!inventoryItem || quantityBefore < 1) {',
  '          root.__LWCS_RC6_ITEM_INVENTORY_DIAGNOSTIC__ = {',
  '            actorId: unitId(actor),',
  '            overlayUnitId: unitId(unit),',
  '            actionFingerprint: String(input?.actionFingerprint || "").trim(),',
  '            opportunityId: String(input?.opportunityId || "").trim(),',
  '            worldRevision: String(input?.worldRevision || "").trim(),',
  '            declaration: cloneValue({',
  '              actionId: declaration?.actionId,',
  '              actorId: declaration?.actorId,',
  '              actionKind: declaration?.actionKind,',
  '              targetIds: declaration?.targetIds,',
  '              irreversibleAsset: declaration?.irreversibleAsset,',
  '              skillIds: {',
  '                id: declaration?.skill?.id,',
  '                itemId: declaration?.skill?.物品ID,',
  '                internalItemName: declaration?.skill?.__物品名,',
  '                itemName: declaration?.skill?.物品名,',
  '                displayName: declaration?.skill?.名称,',
  '                name: declaration?.skill?.name,',
  '              },',
  '            }),',
  '            sourceActorInventoryRoots: cloneValue({',
  '              背包: actor?.背包,',
  '              库存: actor?.库存,',
  '              物品: actor?.物品,',
  '              战斗物品: actor?.战斗物品,',
  '            }),',
  '            overlayActorInventoryRoots: cloneValue({',
  '              背包: unit?.背包,',
  '              库存: unit?.库存,',
  '              物品: unit?.物品,',
  '              战斗物品: unit?.战斗物品,',
  '            }),',
  '          };',
  "          throw new Error(`battle_preview_item_unavailable:${String(declaration?.irreversibleAsset?.assetId || declaration?.skill?.name || '').trim()}`);",
  '        }',
].join('\n');

if (!previewSource.includes(originalFailure)) {
  throw new Error('RC6_ITEM_PROBE_INSTRUMENTATION_ANCHOR_MISSING');
}

const sandbox = loadBattleSandbox({
  sourceOverrides: {
    'BattlePreview_Module.js': previewSource.replace(
      originalFailure,
      instrumentedFailure,
    ),
  },
});
const definition = manualCasesById(sandbox).get('item_creation_consumption');
if (!definition) throw new Error('RC6_ITEM_PROBE_CASE_MISSING');
const input = formalInput(definition, 'r8');
delete input.settings.collectDecisionReplayIdentity;

const startedAt = performance.now();
let caught = null;
try {
  executeFormalTransaction(sandbox, input);
} catch (error) {
  caught = error;
}
const elapsedMs = Number((performance.now() - startedAt).toFixed(3));
if (!caught) throw new Error('RC6_ITEM_PROBE_EXPECTED_FAILURE_NOT_OBSERVED');

const diagnostic =
  sandbox.__LWCS_RC6_ITEM_INVENTORY_DIAGNOSTIC__ || null;
if (!diagnostic) throw new Error('RC6_ITEM_PROBE_DIAGNOSTIC_MISSING');

const evidence = {
  schemaVersion: 'R83RC6ItemInventoryDivergenceProbeV1',
  generatedAt: new Date().toISOString(),
  caseId: 'item_creation_consumption',
  providerId: 'r8',
  inputHash: sha256(input),
  sourceHashes: sourceHashes(),
  toolHashes: {
    'tools/probe_r83_rc6_item_inventory_divergence.mjs': sha256(
      fs.readFileSync(toolPath),
    ),
    'tools/r83_rc6_battle_harness.mjs': sha256(
      fs.readFileSync(
        path.join(repoRoot, 'tools/r83_rc6_battle_harness.mjs'),
      ),
    ),
    'tools/battle_r63_manual_cases.mjs': sha256(
      fs.readFileSync(
        path.join(repoRoot, 'tools/battle_r63_manual_cases.mjs'),
      ),
    ),
  },
  elapsedMs,
  error: {
    name: String(caught?.name || 'Error'),
    message: String(caught?.message || caught),
    stackFrames: String(caught?.stack || '').split(/\r?\n/).slice(0, 12),
  },
  diagnostic,
  sourceModified: false,
  sandboxSourceOverrideOnly: true,
  manualReviews: [],
  automaticConclusionGenerated: false,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify({
  outputPath,
  evidenceHash: sha256(evidence),
  elapsedMs,
  error: evidence.error.message,
  diagnostic,
}, null, 2)}\n`);

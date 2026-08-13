import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPrototypePathUniverse, previewAdmission, serializeUniverse } from './build-prototype-path-universe.mjs';

const referenceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(referenceDir, '..', '..', '..');
const schemaPath = path.join(repoRoot, 'tools/rc6/contracts/PrototypePathUniverseV1.schema.json');

test('builds a deterministic registry-derived universe with frozen partitions', () => {
  const first = buildPrototypePathUniverse({ repoRoot });
  const second = buildPrototypePathUniverse({ repoRoot });
  assert.equal(serializeUniverse(first), serializeUniverse(second));
  assert.equal(first.registrySummary.prototypeCount, 27);
  assert.equal(first.registrySummary.inBattlePrototypeCount, 23);
  assert.equal(first.registrySummary.outOfBattlePrototypeCount, 4);
  assert.deepEqual(first.partitions, {
    IN_BATTLE: { prototypeCount: 23, pathCount: 621 },
    OUT_OF_BATTLE: { prototypeCount: 4, pathCount: 91 },
    totalPathCount: 712,
  });
  assert.equal(first.paths.length, 712);
  assert.equal(new Set(first.paths.map(row => row.pathId)).size, 712);
  assert.equal(new Set(first.paths.map(row => row.sourcePointer)).size, 712);
});

test('derives the category partition and all four out-of-battle exclusions', () => {
  const universe = buildPrototypePathUniverse({ repoRoot });
  assert.deepEqual(universe.registrySummary.categoryCounts, {
    战斗结算: 21,
    行为推导: 2,
    战斗外: 4,
  });
  assert.deepEqual(
    [...new Set(universe.paths.filter(row => row.scope === 'OUT_OF_BATTLE').map(row => row.prototype))],
    ['修炼增益', '天赋提升', '永久属性提升', '战斗外复活'],
  );
  assert(universe.paths.filter(row => row.scope === 'OUT_OF_BATTLE').every(row => row.reason === 'OUT_OF_BATTLE_SCOPE'));
});

test('keeps non-option forms in counters and out of path enumeration', () => {
  const universe = buildPrototypePathUniverse({ repoRoot });
  const counters = universe.formCounters;
  assert.equal(counters.finiteOption.pathCount, 712);
  assert.deepEqual(counters.finiteOption.byPartition, {
    IN_BATTLE: { fieldCount: 120, pathCount: 621 },
    OUT_OF_BATTLE: { fieldCount: 16, pathCount: 91 },
  });
  assert.equal(counters.condition.fieldCount, 27);
  assert.equal(counters.numeric.fieldCount, 71);
  assert.equal(counters.text.fieldCount, 7);
  assert.equal(counters.object.fieldCount, 6);
  assert.equal(counters.boolean.fieldCount, 2);
  assert.equal(counters.prototypeList.fieldCount, 1);
  assert.equal(counters.structural.fieldCount, 27);
  assert.equal(counters.totalFieldCount, 276);
  assert.deepEqual(counters.byPartition, {
    IN_BATTLE: { fieldCount: 240, finiteOptionFieldCount: 120, finiteOptionPathCount: 621 },
    OUT_OF_BATTLE: { fieldCount: 36, finiteOptionFieldCount: 16, finiteOptionPathCount: 91 },
  });
  assert.deepEqual(counters.nestedEffect.registryNestedEffectFields, ['使用效果', '授予效果', '结算效果']);
  assert.deepEqual(counters.nestedEffect.registryConditionBranchEffectFields, ['替换效果', '追加效果']);
  assert.deepEqual(counters.nestedEffect.registryEffectSlotFields, ['_效果数组', '使用效果', '授予效果', '结算效果', '替换效果', '追加效果']);
  assert(universe.paths.every(row => row.finiteOption === true));
  assert(!universe.paths.some(row => row.field === '原型'));
  assert(!universe.paths.some(row => ['数字', '整数', '带符号数值', '对象', '条件分支', '原型列表'].includes(row.fieldType)));
});

test('marks the exact unsupported decision subset without fallback claims', () => {
  const universe = buildPrototypePathUniverse({ repoRoot });
  assert.equal(universe.previewAdmission.filter(row => row.admitted).length, 12);
  assert.equal(universe.unsupportedDecisionPaths.length, 247);
  const unsupportedIds = new Set(universe.unsupportedDecisionPaths.map(row => row.pathId));
  const inBattleIds = new Set(universe.paths.filter(row => row.scope === 'IN_BATTLE').map(row => row.pathId));
  assert([...unsupportedIds].every(pathId => inBattleIds.has(pathId)));
  assert(universe.unsupportedDecisionPaths.every(row => {
    assert.equal(row.supportStatus.mechanics, 'CURRENT_UNSUPPORTED');
    assert.equal(row.supportStatus.policy, 'PENDING_M3');
    assert.equal(row.supportStatus.runtime, 'CURRENT_UNSUPPORTED');
    assert.equal(row.supportStatus.report, 'PENDING_M3');
    assert.equal(row.previewAdmission.admitted, false);
    return row.reason === `CURRENT_BATTLE_PREVIEW_ADMISSION_UNSUPPORTED:PROTOTYPE:${row.prototype}:0`;
  }));
  assert.deepEqual(
    universe.unsupportedDecisionPaths.reduce((counts, row) => {
      counts[row.prototype] = (counts[row.prototype] || 0) + 1;
      return counts;
    }, {}),
    {
      资源转移: 25,
      炸环: 7,
      规则防御: 9,
      状态转移: 51,
      状态交换: 33,
      资源锁定: 25,
      规则改写: 19,
      机制抹消: 17,
      机制授予: 21,
      复制执行: 22,
      时光回溯: 18,
    },
  );
  const statusValues = new Set(universe.paths.flatMap(row => Object.values(row.supportStatus)));
  assert.deepEqual(statusValues, new Set(['CURRENT_SUPPORTED', 'CURRENT_UNSUPPORTED', 'PENDING_M3']));
  assert(universe.previewAdmission.every(row => row.admitted === (row.reasons.length === 0)));
});

test('rejects any current BattlePreview unsupported reason', () => {
  const admission = previewAdmission({
    compileMechanicalBasis: () => ({ unsupportedReasons: ['DELAYED_EFFECT:0'] }),
  }, {});
  assert.deepEqual(admission, {
    evaluated: true,
    admitted: false,
    reasons: ['DELAYED_EFFECT:0'],
  });
});

test('schema closes and pins the current partition and form-counter contract', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const visit = (node, location = '$') => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false, `${location} must reject unknown properties`);
    }
    Object.entries(node).forEach(([key, value]) => visit(value, `${location}.${key}`));
  };
  visit(schema);
  assert.equal(schema.properties.paths.minItems, 712);
  assert.equal(schema.properties.paths.maxItems, 712);
  assert.equal(schema.properties.unsupportedDecisionPaths.minItems, 247);
  assert.equal(schema.properties.unsupportedDecisionPaths.maxItems, 247);
  assert.deepEqual(schema.properties.partitions.properties.IN_BATTLE.properties, {
    prototypeCount: { const: 23 },
    pathCount: { const: 621 },
  });
  assert.deepEqual(schema.properties.partitions.properties.OUT_OF_BATTLE.properties, {
    prototypeCount: { const: 4 },
    pathCount: { const: 91 },
  });
  assert.equal(schema.$defs.formCounters.properties.structural.$ref, '#/$defs/structuralCounter');
  assert.equal(schema.$defs.structuralCounter.properties.fieldCount.const, 27);
  assert.equal(schema.$defs.formCounters.properties.totalFieldCount.const, 276);
});

test('does not claim historical or forbidden authority', () => {
  const universe = buildPrototypePathUniverse({ repoRoot });
  assert.deepEqual(universe.authority, {
    currentRegistryAndScopeOnly: true,
    currentBattlePreviewAdmissionOnly: true,
    historicalEvidenceUsed: false,
    productionDecisionOrKernelImported: false,
  });
  const serialized = serializeUniverse(universe).toLowerCase();
  assert(!serialized.includes('r8'));
  assert.equal(universe.authority.historicalEvidenceUsed, false);
  const source = fs.readFileSync(path.join(referenceDir, 'build-prototype-path-universe.mjs'), 'utf8');
  assert(!source.includes('BattleDecision'));
  assert(!/(?:BattleDecision|Kernel_Module|from\s+['\"].*Kernel)/.test(source));
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const sandbox = {
  console,
  structuredClone,
  Math: Object.create(Math),
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Symbol,
  parseInt,
  parseFloat,
  isNaN,
  Intl,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const fileName of [
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'), sandbox, { filename: fileName });
}

const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const checks = [];
const addCheck = (checkId, passed, detail = {}) => {
  checks.push({ checkId, passed: passed === true, ...detail });
};

function unit(id, side, overrides = {}) {
  const hp = Number(overrides.hp ?? 500);
  const sp = Number(overrides.sp ?? 100);
  return {
    id,
    name: id,
    名称: id,
    side,
    hp,
    hp_max: 500,
    HP: hp,
    sp,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: Number(overrides.str ?? 180),
    def: Number(overrides.def ?? 120),
    agi: Number(overrides.agi ?? 150),
    属性: {
      等级: 50,
      HP: hp,
      HP上限: 500,
      魂力: sp,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: Number(overrides.str ?? 180),
      防御: Number(overrides.def ?? 120),
      敏捷: Number(overrides.agi ?? 150),
      状态效果: {},
    },
    状态: { 存活: true, 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
    技能列表: [],
  };
}

function world(overrides = {}) {
  return {
    回合: 1,
    战斗意图: '击败',
    进行中: true,
    参战者: {
      team_player: [unit('actor', 'player', overrides.actor)],
      team_enemy: [unit('target', 'enemy', overrides.target)],
    },
  };
}

function declarationFor(id, effect, targetId = 'target', cost = 0) {
  return {
    actionId: `atomic:${id}`,
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: [targetId],
    resourceCosts: cost > 0 ? { 魂力: cost } : {},
    skill: {
      id: `skill:${id}`,
      name: `原子${id}`,
      魂技名: `原子${id}`,
      消耗: '无',
      前摇: 0,
      _效果数组: [{ effectId: `effect:${id}`, ...effect }],
    },
  };
}

function runAtomic(id, effect, options = {}) {
  const source = world(options.world || {});
  const declaration = declarationFor(id, effect, options.targetId || 'target', options.cost || 0);
  const sourceHash = preview.stableHash(source);
  const previewResult = preview.previewAction({
    worldSnapshot: source,
    worldRevision: `phase4:${id}`,
    beliefRevision: 'phase4',
    actorId: 'actor',
    declaration,
    actionFingerprint: `phase4:${id}`,
  });
  assert.equal(preview.stableHash(source), sourceHash, `${id}:Preview修改了输入`);
  const actual = structuredClone(source);
  const actionContext = runtime.beginStructuredDeclaration({
    combatData: actual,
    declaration,
    actionId: declaration.actionId,
    actionRole: 'ACTIVE',
    actorControl: 'AI',
  });
  runtime.executeStructuredDeclaration({
    combatData: actual,
    declaration,
    actionContext,
  });
  return { source, declaration, previewResult, actual };
}

const overlayBase = world();
const overlay = new preview.PreviewOverlay(overlayBase, 'overlay:phase4');
const summonId = preview.summonInstanceId('root', 'effect', 1);
const summon = { id: summonId, name: '召唤体', hp: 10, hp_max: 10 };
const definitionHash = preview.stableHash({ name: '召唤体', hp: 10 });
const firstSummon = overlay.writeSummon(summon, definitionHash);
const repeatedSummon = overlay.writeSummon({ ...summon }, definitionHash);
let summonConflict = '';
try {
  overlay.writeSummon({ ...summon, hp: 20 }, preview.stableHash({ name: '召唤体', hp: 20 }));
} catch (error) {
  summonConflict = String(error?.message || error);
}
addCheck(
  'overlay:summon-idempotency',
  firstSummon === repeatedSummon &&
    overlay.createdSummons.size === 1 &&
    summonConflict === `SUMMON_PREVIEW_INSTANCE_CONFLICT:${summonId}`,
  { summonId, summonConflict },
);

const fork = overlay.fork();
fork.changeSummon(summonId, entry => { entry.hp = 5; });
addCheck(
  'overlay:fork-isolation',
  overlay.createdSummons.get(summonId).hp === 10 &&
    fork.createdSummons.get(summonId).hp === 5 &&
    overlay.snapshot() !== fork.snapshot(),
);

const damage = runAtomic('damage', {
  原型: '伤害结算',
  目标: '单体',
  威力倍率: 60,
  伤害类型: '近身攻击',
  命中概率: '100%',
});
const previewDamageTarget = preview.findUnit(damage.previewResult.afterSnapshot, 'target');
const runtimeDamageTarget = preview.findUnit(damage.actual, 'target');
const previewDamageContribution = damage.previewResult.contributions.find(entry => entry.outcomeKind === 'HP_DELTA');
const runtimeDamageFact = runtime.ensureLedger(damage.actual).find(event => event.eventKind === 'hit_result');
addCheck(
  'calibration:damage-hit',
  preview.readHp(previewDamageTarget) === preview.readHp(runtimeDamageTarget) &&
    Number(previewDamageContribution?.evidence?.hitProbability) === Number(runtimeDamageFact?.meta?.hitProbability) &&
    runtimeDamageFact?.result === 'hit',
  {
    previewHp: preview.readHp(previewDamageTarget),
    runtimeHp: preview.readHp(runtimeDamageTarget),
    hitProbability: runtimeDamageFact?.meta?.hitProbability,
  },
);

const healing = runAtomic('healing', {
  原型: '资源变化',
  目标: '自身',
  资源: '生命',
  数值: '+20%',
}, { targetId: 'actor', world: { actor: { hp: 250 } } });
addCheck(
  'calibration:healing',
  preview.readHp(preview.findUnit(healing.previewResult.afterSnapshot, 'actor')) ===
    preview.readHp(preview.findUnit(healing.actual, 'actor')),
);

const resource = runAtomic('resource', {
  原型: '资源变化',
  目标: '自身',
  资源: '魂力',
  数值: '+25',
}, { targetId: 'actor', world: { actor: { sp: 40 } }, cost: 10 });
addCheck(
  'calibration:resource-payment-and-restore',
  preview.readResource(preview.findUnit(resource.previewResult.afterSnapshot, 'actor'), '魂力') ===
    preview.readResource(preview.findUnit(resource.actual, 'actor'), '魂力') &&
    runtime.resourceTimelineFromRuntime(resource.actual).map(event => event.operation).includes('PAY') &&
    runtime.resourceTimelineFromRuntime(resource.actual).map(event => event.operation).includes('RESTORE'),
  {
    timeline: runtime.resourceTimelineFromRuntime(resource.actual).map(event => event.operation),
  },
);

const shield = runAtomic('shield', {
  原型: '护盾变化',
  目标: '自身',
  护盾模式: '正向护盾',
  数值: '+30',
}, { targetId: 'actor' });
addCheck(
  'calibration:shield',
  preview.readShield(preview.findUnit(shield.previewResult.afterSnapshot, 'actor')) ===
    preview.readShield(preview.findUnit(shield.actual, 'actor')),
);

const state = runAtomic('state', {
  原型: '状态施加',
  目标: '单体',
  状态: '眩晕',
  持续回合: 1,
  成功率: '100%',
});
const previewStateTarget = preview.findUnit(state.previewResult.afterSnapshot, 'target');
const runtimeStateTarget = preview.findUnit(state.actual, 'target');
const runtimeStateFact = runtime.ensureLedger(state.actual).find(event => event.eventKind === 'state_apply');
addCheck(
  'calibration:state-application',
  Object.values(previewStateTarget?.状态效果 || {}).some(item => String(item?.状态 || item?.状态名称 || '').includes('眩晕')) &&
    Object.values(runtimeStateTarget?.状态效果 || {}).some(item => String(item?.状态 || item?.状态名称 || '').includes('眩晕')) &&
    Number(runtimeStateFact?.meta?.successRate) === 1 &&
    runtimeStateFact?.result === 'applied',
);

const summonEffect = {
  原型: '召唤生成',
  目标: '自身',
  生效方式: '独立生效',
  召唤单位类型: '魂兽',
  召唤物名称: '校准召唤物',
  数量: 1,
  强度: 0.5,
  行动模式: '自主行动',
  持续回合: 2,
};
const summoned = runAtomic('summon', summonEffect, { targetId: 'actor' });
const previewSummonIds = Object.keys(summoned.previewResult.afterSnapshot?.召唤单位表 || {});
const runtimeSummonIds = Object.keys(summoned.actual?.召唤单位表 || {});
addCheck(
  'calibration:summon-identity',
  previewSummonIds.length === 1 &&
    runtimeSummonIds.length === 1 &&
    previewSummonIds[0] === runtimeSummonIds[0] &&
    previewSummonIds[0] === preview.summonInstanceId('atomic:summon', 'effect:summon', 1),
  { previewSummonIds, runtimeSummonIds },
);

const dodgeWorld = world({ actor: { agi: 220 }, target: { agi: 140 } });
const dodgeExpected = preview.calculateDodgeProbability(
  preview.findUnit(dodgeWorld, 'actor'),
  preview.findUnit(dodgeWorld, 'target'),
  false,
);
const dodgeContext = runtime.beginStructuredDeclaration({
  combatData: dodgeWorld,
  declaration: declarationFor('incoming', {
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 50,
    伤害类型: '近身攻击',
    命中概率: '100%',
  }, 'actor'),
  actionId: 'atomic:incoming',
});
const savedRandom = sandbox.Math.random;
sandbox.Math.random = () => 0;
const dodgeResult = runtime.settleStructuredReaction({
  combatData: dodgeWorld,
  reactor: preview.findUnit(dodgeWorld, 'actor'),
  sourceActor: preview.findUnit(dodgeWorld, 'target'),
  declaration: { actorId: 'actor', actionKind: 'EVADE', targetIds: ['actor'] },
  parentActionEvent: dodgeContext.actionEvent,
});
sandbox.Math.random = savedRandom;
addCheck(
  'calibration:dodge-probability-operand',
  Number(dodgeResult?.event?.meta?.probability) === dodgeExpected &&
    dodgeResult?.evaded === true,
  { expected: dodgeExpected, actual: dodgeResult?.event?.meta?.probability },
);

const boundaryProbabilities = [0, 1].map(probability => ({
  probability,
  results: Array.from({ length: 100 }, (_, index) =>
    runtime.probabilitySucceeds(probability, index / 100)
  ),
}));
addCheck(
  'calibration:probability-boundaries',
  boundaryProbabilities[0].results.every(result => result === false) &&
    boundaryProbabilities[1].results.every(result => result === true),
);

const metrics = preview.readMetrics();
addCheck(
  'preview:copy-on-write-budget',
  metrics.fullCloneCalls === 0 &&
    damage.previewResult.metrics.fullCloneCalls === 0 &&
    resource.previewResult.metrics.fullCloneCalls === 0,
  { metrics },
);

const previewSource = fs.readFileSync(path.join(repoRoot, 'BattlePreview_Module.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'BattleRuntime_Module.js'), 'utf8');
addCheck(
  'source:shared-summon-identity',
  /function summonInstanceId\(rootActionFingerprint = '', effectInstanceId = '', summonOrdinal = 1\)/.test(previewSource) &&
    /previewRuntime\.summonInstanceId\(/.test(runtimeSource) &&
    /SUMMON_PREVIEW_INSTANCE_CONFLICT/.test(previewSource) &&
    /SUMMON_PREVIEW_INSTANCE_CONFLICT/.test(runtimeSource),
);

const failed = checks.filter(check => !check.passed);
const output = {
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    calibrationCaseCount: checks.filter(check => check.checkId.startsWith('calibration:')).length,
    runtimeCalibrationStatus: failed.length === 0 ? 'PREVIEW_RUNTIME_ATOMIC_CALIBRATION_PASSED' : 'BLOCKED',
  },
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exitCode = 1;

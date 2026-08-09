import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
} from '../../r83_rc6_battle_harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const harnessPath = fileURLToPath(import.meta.url);
const scopePath = path.join(repoRoot, 'tools', 'rc6', 'cases', 'BattleMechanismPrototypeScopeV1.json');
const evidencePath = process.env.RC6_EVIDENCE_PATH
  ? path.resolve(repoRoot, process.env.RC6_EVIDENCE_PATH)
  : path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm3', 'm3-b04-r9v2-path-coverage.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hashJson = value => sha256(JSON.stringify(value));
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const text = value => String(value ?? '').trim();
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const targetRegistryMarker = "    'r9v2-shadow': request => runR9v2ShadowProvider(request),";
const targetRegistryLine = "    r9v2: request => runR9v2TargetProvider(request),";
const decisionSource = read('BattleDecision_Module.js');
const targetDecisionSource = decisionSource.includes(targetRegistryLine)
  ? decisionSource
  : decisionSource.replace(targetRegistryMarker, `${targetRegistryMarker}\n${targetRegistryLine}`);
assert(targetDecisionSource !== decisionSource || decisionSource.includes(targetRegistryLine), 'M3_B04_TARGET_REGISTRY_PATCH_MISSED');

const sandbox = loadBattleSandbox({
  includeTargetKernel: true,
  sourceOverrides: { 'BattleDecision_Module.js': targetDecisionSource },
});
const sink = { slices: [] };
sandbox.__LWCS_R9V2_TARGET_KERNEL_TEST_SINK__ = sink;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const registry = sandbox.__LWCS_SKILL_MECHANISM_REGISTRY__?.原型定义;
assert(registry && typeof registry === 'object', 'M3_B04_MECHANISM_REGISTRY_MISSING');

function unit(id, side, options = {}) {
  const hp = Number(options.hp ?? 100);
  const hpMax = Number(options.hpMax ?? 100);
  const sp = Number(options.sp ?? 100);
  const skills = Array.isArray(options.skills) ? skillsCopy(options.skills) : [];
  return {
    id,
    name: id,
    名称: id,
    side,
    hp,
    hp_max: hpMax,
    sp,
    sp_max: 100,
    men: 100,
    men_max: 100,
    vit: 100,
    vit_max: 100,
    str: 150,
    def: 100,
    agi: 100,
    属性: {
      等级: 60,
      HP: hp,
      HP上限: hpMax,
      魂力: sp,
      魂力上限: 100,
      精神力: 100,
      精神力上限: 100,
      体力: 100,
      体力上限: 100,
      力量: 150,
      防御: 100,
      敏捷: 100,
    },
    状态: { 存活: hp > 0, 行动: hp > 0 ? '战斗' : '死亡' },
    状态效果: clone(options.states || {}),
    持续效果: {},
    背包: {},
    装备: {},
    技能列表: skills,
  };
}

function skillsCopy(skills) {
  return skills.map(skill => clone(skill));
}

function damageSkill() {
  return {
    id: 'm3-b04-baseline-attack',
    name: '基础攻击',
    魂技名: '基础攻击',
    消耗: '无',
    _效果数组: [{
      effectId: 'm3-b04-baseline-damage',
      原型: '伤害结算',
      目标: '单体',
      威力倍率: 50,
      伤害类型: '近身攻击',
      命中概率: '100%',
    }],
  };
}

function objective() {
  return {
    startRound: 1,
    maxRounds: 6,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: {
      logic: 'ANY',
      conditions: [{ conditionId: 'victory', type: 'TEAM_INCAPACITATED', side: 'ENEMY' }],
    },
    defeat: {
      logic: 'ANY',
      conditions: [{ conditionId: 'defeat', type: 'TEAM_INCAPACITATED', side: 'PLAYER' }],
    },
  };
}

function buildWorld(skill, prototype) {
  const actor = unit('actor', 'player', {
    hp: 80,
    sp: 100,
    skills: [damageSkill(), skill],
    states: {
      中毒: { 状态: '中毒', 类型: '负面', duration: 1, 战斗效果: { dot_damage_ratio: 0.05 } },
      自身负面: { 状态: '迟缓', 类型: '负面', duration: 1, 战斗效果: { dodge_penalty: 0.2 } },
    },
  });
  actor.第1武魂 = { 第1魂环: { 年限: 1000 } };
  const target = unit('target', 'enemy', {
    hp: 80,
    sp: 80,
    skills: [damageSkill()],
  });
  const world = {
    回合: 1,
    战斗类型: '普通战斗',
    战斗意图: '击败',
    进行中: true,
    胜负条件: objective(),
    参战者: { team_player: [actor], team_enemy: [target] },
  };
  world.回合开始快照 = clone(world);
  if (prototype === '时光回溯') {
    world.回合开始快照.参战者.team_player[0].hp = 70;
    world.回合开始快照.参战者.team_player[0].属性.HP = 70;
  }
  return world;
}

function enumeratePaths() {
  const paths = [];
  for (const entry of scope.includedPrototypes) {
    const definition = registry[entry.prototype];
    assert(definition, `M3_B04_SCOPE_PROTOTYPE_MISSING:${entry.prototype}`);
    for (const [field, fieldDefinition] of Object.entries(definition.字段定义 || {})) {
      if (field === '原型') continue;
      const options = Array.isArray(fieldDefinition?.选项) ? fieldDefinition.选项 : [];
      options.forEach((option, optionIndex) => {
        const pathId = `m3-b04:${entry.prototype}:${field}:${optionIndex}`;
        paths.push({
          pathId,
          prototype: entry.prototype,
          field,
          optionIndex,
          option: clone(option),
          target: entry.target,
          baseEffect: clone(entry.baseEffect),
        });
      });
    }
  }
  return paths;
}

function runPath(pathRow) {
  const skillId = `m3-b04-skill-${pathRow.optionIndex}-${sha256(pathRow.pathId).slice(0, 12)}`;
  const effect = { ...clone(pathRow.baseEffect), [pathRow.field]: clone(pathRow.option) };
  const skill = {
    id: skillId,
    name: pathRow.pathId,
    魂技名: pathRow.pathId,
    消耗: '无',
    _效果数组: [{ ...effect, effectId: `${pathRow.pathId}:effect` }],
  };
  const world = buildWorld(skill, pathRow.prototype);
  const declaration = {
    actionId: pathRow.pathId,
    actorId: 'actor',
    actionKind: 'RELEASE_SKILL',
    targetIds: pathRow.target === '自身' ? ['actor'] : ['target'],
    skill,
    ...(pathRow.prototype === '炸环'
      ? { ringId: '第1武魂/第1魂环', ringPath: ['第1武魂', '第1魂环'] }
      : {}),
    ...(pathRow.prototype === '时光回溯'
      ? { historySnapshot: clone(world.回合开始快照) }
      : {}),
  };
  const request = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId: 'actor',
    objectiveContract: world.胜负条件,
    battleIntent: { mode: '击败', objectives: clone(world.胜负条件) },
    actionOpportunity: {
      opportunityId: `${pathRow.pathId}:opportunity`,
      ownerId: 'actor',
      role: 'ACTIVE',
      grantType: 'NATURAL_ACTION',
      sequence: 1,
    },
    providerId: 'r9v2',
    analysisDepth: 'CANDIDATES_ONLY',
    r9v2InformationValueOnly: true,
    collectDecisionReplayIdentity: true,
    seed: 930000 + pathRow.optionIndex,
  });
  const candidate = request.frozenCandidates.find(row =>
    String(row?.declaration?.skill?.id || '').trim() === skillId,
  );
  assert(candidate, `M3_B04_PATH_CANDIDATE_MISSING:${pathRow.pathId}`);
  const result = decision.runR9v2TargetProviderForTest(request);
  const slice = sink.slices.at(-1);
  assert(slice, `M3_B04_TARGET_SLICE_MISSING:${pathRow.pathId}`);
  const row = slice.rows.find(item => item.candidateId === candidate.candidateId);
  const vector = slice.vectors.find(item => item.candidateId === candidate.candidateId);
  assert(row, `M3_B04_TARGET_ROW_MISSING:${pathRow.pathId}`);
  assert(vector, `M3_B04_TARGET_VECTOR_MISSING:${pathRow.pathId}`);
  assert(result?.decisionEngine === 'R9V2_TARGET', `M3_B04_TARGET_ENGINE_MISSING:${pathRow.pathId}`);
  return {
    pathId: pathRow.pathId,
    prototype: pathRow.prototype,
    field: pathRow.field,
    optionIndex: pathRow.optionIndex,
    optionHash: hashJson(pathRow.option),
    candidateId: candidate.candidateId,
    targetEngine: result.decisionEngine,
    targetKernelSlice: slice.schemaVersion || 'TARGET_KERNEL_SLICE',
    rowHash: hashJson(row),
    vectorHash: hashJson(vector),
    selectedCandidateId: text(result.selected?.candidateId),
    unsupportedOutcomeKinds: Array.isArray(result.decisionProfile?.unsupportedOutcomeKinds)
      ? [...result.decisionProfile.unsupportedOutcomeKinds]
      : [],
  };
}

const paths = enumeratePaths();
assert(paths.length === scope.expected.includedOptionPathCount, `M3_B04_PATH_COUNT_MISMATCH:${paths.length}`);
const indexArgument = process.argv.indexOf('--index');
const limitArgument = process.argv.indexOf('--limit');
const pathArgument = process.argv.indexOf('--path-id');
const requestedIndex = indexArgument >= 0 ? Number(process.argv[indexArgument + 1]) : null;
const requestedLimit = limitArgument >= 0 ? Number(process.argv[limitArgument + 1]) : null;
const requestedPathId = pathArgument >= 0 ? String(process.argv[pathArgument + 1] || '') : '';
const selectedPaths = requestedPathId
  ? paths.filter(pathRow => pathRow.pathId === requestedPathId)
  : Number.isInteger(requestedIndex)
  ? paths.slice(requestedIndex, requestedIndex + 1)
  : Number.isInteger(requestedLimit)
    ? paths.slice(0, requestedLimit)
    : paths;
assert(!requestedPathId || selectedPaths.length === 1, `M3_B04_PATH_ID_NOT_FOUND:${requestedPathId}`);
const rows = [];
const failures = [];
for (const pathRow of selectedPaths) {
  try {
    rows.push(runPath(pathRow));
  } catch (error) {
    failures.push({
      pathId: pathRow.pathId,
      error: String(error?.message || error),
      stack: String(error?.stack || ''),
    });
  }
}
const output = {
  schemaVersion: 'M3B04R9v2PathCoverageV1',
  milestoneId: 'M3',
  taskId: 'M3-B04',
  status: failures.length
    ? 'FAILED'
    : selectedPaths.length === paths.length
      ? 'PASSED'
      : 'PASSED_SUBSET',
  sourceOwned: true,
  targetProvider: 'r9v2_unregistered_test_registry_only',
  r8SelectionOracleUsed: false,
  scope: {
    file: 'tools/rc6/cases/BattleMechanismPrototypeScopeV1.json',
    includedPrototypeCount: scope.includedPrototypes.length,
    expectedPathCount: scope.expected.includedOptionPathCount,
    observedPathCount: paths.length,
  },
  executed: {
    pathCount: selectedPaths.length,
    passedCount: rows.length,
    failedCount: failures.length,
    fullCoverage: selectedPaths.length === paths.length,
  },
  failures,
  rows,
  sourceHashes: {
    'MVU_Skill_Runtime.js': sha256(read('MVU_Skill_Runtime.js')),
    'BattlePreview_Module.js': sha256(read('BattlePreview_Module.js')),
    'BattleDecision_Module.js': sha256(read('BattleDecision_Module.js')),
    'BattleRuntime_Module.js': sha256(read('BattleRuntime_Module.js')),
    'BattleDecisionR9v2Kernel_Module.js': sha256(read('BattleDecisionR9v2Kernel_Module.js')),
    'tools/rc6/cases/BattleMechanismPrototypeScopeV1.json': sha256(fs.readFileSync(scopePath)),
    'tools/rc6/harness/run-m3-b04-r9v2-path-coverage.mjs': sha256(fs.readFileSync(harnessPath)),
  },
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  status: output.status,
  expectedPathCount: output.scope.expectedPathCount,
  observedPathCount: output.scope.observedPathCount,
  executedPathCount: output.executed.pathCount,
  passedCount: output.executed.passedCount,
  failedCount: output.executed.failedCount,
  firstFailure: failures[0] || null,
}, null, 2)}\n`);
if (output.status === 'FAILED') process.exitCode = 1;

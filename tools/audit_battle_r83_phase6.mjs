import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, structuredClone, Math: Object.create(Math), Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet, Symbol, parseInt, parseFloat, isNaN, Intl, URL, URLSearchParams, TextEncoder, TextDecoder };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const fileName of ['MVU_Skill_Runtime.js', 'BattlePreview_Module.js', 'BattleDecision_Module.js']) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, fileName), 'utf8'), sandbox, { filename: fileName });
}
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const checks = [];
const add = (id, passed, detail = {}) => checks.push({ checkId: id, passed: passed === true, ...detail });

const actor = {
  id: 'actor', name: 'actor', side: 'player', hp: 500, hp_max: 500, sp: 100, sp_max: 100,
  men: 100, men_max: 100, vit: 100, vit_max: 100, str: 150, def: 100, agi: 100,
  属性: { 等级: 60, HP: 500, HP上限: 500, 魂力: 100, 魂力上限: 100, 精神力: 100, 精神力上限: 100, 体力: 100, 体力上限: 100, 力量: 150, 防御: 100, 敏捷: 100 },
  状态: { 存活: true, 行动: '战斗' }, 状态效果: {}, 技能列表: [],
};
const enemy = structuredClone(actor);
enemy.id = 'enemy';
enemy.name = 'enemy';
enemy.side = 'enemy';
enemy.sp = 7;
enemy.属性.魂力 = 7;
const world = { 回合: 1, 参战者: { team_player: [actor], team_enemy: [enemy] } };
const publicResponses = {
  enemy: [
    { responseId: 'a', baseActionValue: 10, evidenceEventIds: ['e1'] },
    { responseId: 'b', baseActionValue: 20, evidenceEventIds: ['e2'] },
    { responseId: 'c', baseActionValue: 40, lethal: true, evidenceEventIds: ['e3'] },
  ],
};
const belief = decision.buildInitialBelief(world, 'actor', { confidence: 0.6, publicResponses });
add('belief:deterministic-level-experience', belief.confidence === 0.6);
const visible = decision.buildDecisionWorld(world, 'actor', belief);
const visibleEnemy = visible.参战者.team_enemy[0];
add('belief:hidden-resource-not-exact', visibleEnemy.sp !== 7 && belief.units.enemy.resources === undefined);

const response = decision.buildR8ResponseModel({
  actorSide: 'team_player',
  beliefState: belief,
  actionOpportunity: { futureHostileResponseAllowed: true },
}, 'candidate');
add(
  'response:max-two-plus-disaster-and-mass',
    response.mainBranches.length === 2 &&
    response.disasterTail?.sourceActorId === 'enemy' &&
    Math.abs(response.unknownMass - 0.14) < 1e-9 &&
    response.noResponseProbability >= 0,
  { response },
);

let adapted = belief;
for (let index = 0; index < 20; index += 1) {
  adapted = decision.updateMechanicBelief(adapted, {
    sourceActionId: 'family',
    effectPrototype: '状态施加',
    targetId: 'enemy',
    relevantStateFingerprint: 'state',
    estimatedProbability: 0.8,
    experience: 0.6,
    success: false,
  });
}
const key = decision.mechanicKey({
  sourceActionId: 'family',
  effectPrototype: '状态施加',
  targetId: 'enemy',
  relevantStateFingerprint: 'state',
});
const posterior = decision.mechanicPosterior(adapted, key, 0.8, 0.6);
add('belief:beta-failure-degrades-without-hard-zero', posterior > 0 && posterior < 0.8, { posterior });

const fakeRequest = {
  actorId: 'actor',
  beliefState: { confidence: 0.5 },
  actionOpportunity: {},
  frozenCandidates: [{ candidateId: 'observe', declaration: { actionKind: 'OBSERVE', skill: { _效果数组: [] } } }],
  actionRouteCatalog: { actor: { primaryRoute: { routeKey: 'p', routeBenefitPP: 10 }, backupRoute: { routeKey: 'b', routeBenefitPP: 4 } } },
};
add('information:value-only-when-route-can-change', decision.r8InformationValue(fakeRequest, 'observe') === 3);
fakeRequest.actionOpportunity.noFutureOpportunity = true;
add('information:zero-without-future-opportunity', decision.r8InformationValue(fakeRequest, 'observe') === 0);

const source = fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'), 'utf8');
const experienceBody = source.match(/function experienceOf\([\s\S]*?\n  \}/)?.[0] || '';
add(
  'source:no-random-experience-or-r8-hard-ban',
  !/stableRoll/.test(experienceBody) &&
    !/misjudgmentBudget|失败次数硬禁|adaptationBudget/.test(
      source.match(/function buildR8ResponseModel\([\s\S]*?(?=\n  function r8InformationValue)/)?.[0] || '',
    ),
);

const failed = checks.filter(check => !check.passed);
console.log(JSON.stringify({
  summary: {
    checkCount: checks.length,
    passedCount: checks.length - failed.length,
    failedCount: failed.length,
    beliefResponseStatus: failed.length ? 'BLOCKED' : 'R8_BELIEF_RESPONSE_CONTRACT_PASSED',
  },
  checks,
}, null, 2));
if (failed.length) process.exitCode = 1;

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManualCases } from './battle_r63_manual_cases.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');

function createSandbox() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    Math,
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
  return sandbox;
}

const sandbox = createSandbox();
for (const relativePath of [
  'lwcs/CharacterLibrary.js',
  'lwcs/MVU_Skill_Runtime.js',
  'lwcs/BattlePreview_Module.js',
  'lwcs/BattleDecision_Module.js',
  'lwcs/BattleRuntime_Module.js',
  'lwcs/BattleReport_Module.js',
]) {
  vm.runInContext(fs.readFileSync(path.resolve(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
const reportRuntime = sandbox.__LWCS_BATTLE_REPORT__;
const decisionRuntime = sandbox.__LWCS_BATTLE_DECISION__;
assert.ok(runtime && reportRuntime && decisionRuntime, 'BattleDecision/BattleRuntime/BattleReport 未加载');

const cases = buildManualCases(sandbox.__LWCS_内置角色库__, sandbox.__LWCS_GET_BASE_STATS__);
const requiredCaseIds = [
  'duel_agile_counter_options',
  'duel_charge_interrupt_safer',
  'team_protect_critical_ally',
  'team_resource_support',
  'team_multi_target_response',
  'raid_control_heavy',
  'raid_summon_heavy',
  'summon_one_window',
  'item_creation_consumption',
  'equipment_switch_no_loop',
];
const caseMap = new Map(cases.map(item => [item.caseId, item]));
requiredCaseIds.forEach(caseId => assert.ok(caseMap.has(caseId), `Phase 7 案例缺失:${caseId}`));

function clone(value) {
  return runtime.cloneValue(value);
}

function findInternalPaths(value, currentPath = '$', results = []) {
  if (typeof value === 'string') {
    if (/(?:structured-summon|battle-summon|summon-instance):/i.test(value)) {
      results.push({ path: currentPath, value });
    }
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findInternalPaths(item, `${currentPath}[${index}]`, results));
    return results;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => findInternalPaths(item, `${currentPath}.${key}`, results));
  }
  return results;
}

function runCase(definition) {
  const sourceInput = {
    caseId: definition.caseId,
    seed: definition.seed,
    combatData: definition.combatData,
    mode: 'team_preview',
    rounds: definition.rounds,
    selectedAction: definition.selectedAction,
    initialBelief: definition.initialBelief,
    battleIntent: { mode: definition.intent },
    settings: { decisionEngine: 'next-shadow' },
  };
  const before = JSON.stringify(sourceInput);
  const draft = runtime.executeBattleDraft(sourceInput);
  assert.equal(JSON.stringify(sourceInput), before, `${definition.caseId} 修改了调用方输入`);
  assert.equal(draft.status, 'DRAFT', `${definition.caseId} 草案状态错误`);
  assert.ok(draft.ledger.length > 0, `${definition.caseId} 没有Ledger事实`);
  assert.ok(draft.trace.length > 0, `${definition.caseId} 没有Trace`);
  const playerAudit = reportRuntime.auditProjection(reportRuntime.build({ draft, visibilityMode: 'PLAYER' }));
  const playerAuditLeak = JSON.stringify(playerAudit.reportDto).match(/(?:structured-summon|battle-summon|summon-instance):[^"\\\s,，。；;|]+/gi) || [];
  assert.equal(
    playerAudit.passed,
    true,
    `${definition.caseId} PLAYER Projection失败:${JSON.stringify(playerAudit.fatals)}:${playerAuditLeak.slice(0, 5).join('|')}:${JSON.stringify(findInternalPaths(playerAudit.reportDto).slice(0, 5))}`,
  );
  const developerAudit = reportRuntime.auditProjection(reportRuntime.build({ draft, visibilityMode: 'DEVELOPER' }));
  assert.equal(developerAudit.passed, true, `${definition.caseId} DEVELOPER Projection失败:${JSON.stringify(developerAudit.fatals)}`);
  const player = playerAudit.reportDto;
  const developer = developerAudit.reportDto;

  assert.equal(player.actualRoundCount, draft.actualRoundCount, `${definition.caseId} 实际回合数漂移`);
  assert.deepEqual(
    player.roundOverview.map(row => row.round),
    Array.from({ length: draft.actualRoundCount }, (_, index) => index + 1),
    `${definition.caseId} 回合速览不连续`,
  );
  assert.equal(player.factRegistry.length, draft.ledger.length, `${definition.caseId} 事实数量漂移`);
  assert.ok(player.exchanges.length > 0, `${definition.caseId} 没有动作组交锋`);
  assert.ok(player.adjudications.length > 0, `${definition.caseId} 没有判定明细`);
  assert.ok(player.finalSummary && player.finalSummary.text, `${definition.caseId} 没有总结型战报`);
  const inactiveFinalUnits = [
    ...(player.finalSummary?.sides?.player?.units || []),
    ...(player.finalSummary?.sides?.enemy?.units || []),
  ].filter(unit => unit?.actionState && unit.actionState !== '战斗');
  inactiveFinalUnits.forEach(unit => {
    assert.ok(
      player.finalSummary.text.includes(`${unit.name} HP ${unit.hp}/${unit.hpMax}`) &&
      player.finalSummary.text.includes(`行动状态：${unit.actionState}`),
      `${definition.caseId} 总结遗漏${unit.name}的行动状态:${unit.actionState}`,
    );
  });
  const fullText = reportRuntime.serializeFullText(player);
  assert.match(fullText, /回合速览/);
  assert.match(fullText, /动作组战报/);
  assert.match(fullText, /判定明细/);
  assert.match(fullText, /总结型战报/);
  assert.doesNotMatch(fullText, /PENDING|DECLARED|SUCCESS|FAILURE|FAILED|ABORTED|BLOCKED|LOST|COMPLETED|NO_EFFECT|RESISTED|IMMUNE|RELEASE_SKILL|structured-summon:/i, `${definition.caseId} 完整战报泄漏内部枚举`);
  assert.doesNotMatch(fullText, /结果为成功。结果：|结果：未产生额外数值结果/, `${definition.caseId} 交锋结果层级重复`);
  assert.doesNotMatch(fullText, /完成【[^】]+】结算，结果为失去/, `${definition.caseId} 护盾损耗落入不可读默认模板`);
  player.roundOverview.forEach(round => {
    const roundFacts = (round.factIds || []).map(factId => player.factRegistry.find(fact => fact.factId === factId)).filter(Boolean);
    const lostActors = [...new Set(roundFacts
      .filter(fact => ['blocked_action', 'lost_opportunity'].includes(fact.eventKind))
      .map(fact => fact.actorName)
      .filter(Boolean))];
    lostActors.forEach(actorName => {
      const projectedLosses = String(round.passiveSummary || '').split('；').filter(segment =>
        segment.includes(actorName) && /失去.*行动机会|【失去行动】未能执行/.test(segment)
      );
      assert.ok(projectedLosses.length <= 1, `${definition.caseId} 第${round.round}回合${actorName}的失去行动事实被重复叙述:${projectedLosses.join('|')}`);
    });
  });
  assert.doesNotMatch(fullText, /即时反应窗口不可用；[^。\n]*即时反应窗口不可用/, `${definition.caseId} 同类反应窗口没有聚合`);
  assert.doesNotMatch(fullText, /将本次伤害压至(\d+(?:\.\d+)?)%；[^。\n]*将本次伤害压至\1%/, `${definition.caseId} 相同防御结果仍逐目标平铺`);
  assert.doesNotMatch(fullText, /\bCONTROLLED:/i, `${definition.caseId} 玩家战报泄漏受控内部原因`);
  assert.doesNotMatch(fullText, /自然行动取消|反击取消|协同行动取消/, `${definition.caseId} 终局队列清理泄漏到玩家战报`);
  player.factRegistry.filter(fact => fact.eventKind === 'charge_start').forEach(fact => {
    assert.ok(fullText.includes(fact.summary), `${definition.caseId} 蓄力声明没有形成玩家可读动作:${fact.factId}`);
  });
  if (definition.caseId === 'duel_charge_interrupt_safer') {
    assert.doesNotMatch(fullText, /2次行动机会未能执行/, '单次控制机会被按两个原子事实重复计数');
    assert.match(fullText, /霜语冰轮[^\n]*后续：[^\n]*已显露蓄力重击[^\n]*被中止/, '控制技能与被中止的蓄力仍被拆成两个无因果动作组');
    assert.equal(
      player.exchanges.filter(exchange =>
        exchange.factIds.some(factId =>
          player.factRegistry.find(fact => fact.factId === factId)?.eventKind === 'charge_interrupt'
        )
      ).length,
      1,
      '蓄力中止事实没有且仅归入一个控制交锋',
    );
    const controlReasons = player.adjudications
      .filter(item => item.selected?.actionName === '霜语冰轮')
      .map(item => item.reasonSummary);
    assert.ok(controlReasons.length > 0, '控制案例缺少霜语冰轮判定');
    assert.ok(controlReasons.every(reason => /行动机会/.test(reason)), `控制判定没有说明真实取消窗口:${controlReasons.join('|')}`);
    assert.ok(controlReasons.every(reason => /同等消耗/.test(reason)), `连续高耗控制没有说明资源跑道:${controlReasons.join('|')}`);
  }
  if (definition.caseId === 'team_protect_critical_ally') {
    assert.match(fullText, /戴月炎的护盾累计吸收\d+点伤害，剩余\d+点/, '多段技能的护盾吸收没有聚合为累计结果');
    assert.doesNotMatch(fullText, /戴月炎的护盾吸收5点伤害[^。\n]*；戴月炎的护盾吸收5点伤害/, '同一护盾的多段吸收仍逐段铺开');
  }
  if (definition.caseId === 'team_resource_support') {
    const exchangeById = new Map(player.exchanges.map(exchange => [exchange.exchangeId, exchange]));
    const targetMismatches = player.adjudications.flatMap(adjudication => {
      const exchange = exchangeById.get(adjudication.exchangeId);
      const declaredTargets = new Set(exchange?.targetNames || []);
      const selectedTargets = adjudication?.selected?.targetNames || [];
      return selectedTargets.filter(targetName => !declaredTargets.has(targetName)).map(targetName => ({
        adjudicationId: adjudication.adjudicationId,
        exchangeId: adjudication.exchangeId,
        actorName: adjudication.actorName,
        selectedTarget: targetName,
        declaredTargets: [...declaredTargets],
      }));
    });
    assert.deepEqual(targetMismatches, [], `同回合反应与主动行动的判定目标发生错配:${JSON.stringify(targetMismatches)}`);
  }
  if (definition.caseId === 'raid_control_heavy') {
    assert.ok(
      player.factRegistry.some(fact =>
        fact.eventKind === 'resource_change' &&
        fact.actorName === '雅莉' &&
        fact.targetName !== '雅莉' &&
        fact.numericTokens.some(token =>
          token.label === '资源变化' &&
          token.unit === '生命' &&
          Number(token.value) > 0
        )
      ),
      '控制团战中可支付治疗没有形成有效友方治疗事实',
    );
  }
  assert.ok(
    player.exchanges.every(exchange =>
      exchange.factIds.every(factId => !['state_tick', 'round_recover', 'summon_end', 'lost_opportunity', 'action_cancelled', 'blocked_action'].includes(
        player.factRegistry.find(fact => fact.factId === factId)?.eventKind,
      )),
    ),
    `${definition.caseId} 被动事实错误显示为动作组`,
  );
  assert.ok(
    player.factRegistry.every(fact => fact.canonicalFactOwner && fact.projectionRefs?.filter(ref => ref.projection === 'DETAIL').length === 1),
    `${definition.caseId} 存在无唯一详细所有者的事实`,
  );
  assert.ok(
    player.factRegistry.every(fact => fact.numericTokens.every(token =>
      token.sourceEventId === fact.factId && Number.isFinite(Number(token.value)),
    )),
    `${definition.caseId} 存在无来源数字`,
  );
  const playerSerialized = JSON.stringify(player);
  const internalLeakMatches = playerSerialized.match(/(?:structured-summon|battle-summon|summon-instance):[^"\\\s,，。；;|]+/gi) || [];
  assert.doesNotMatch(
    playerSerialized,
    /structured-summon:|battle-summon:|summon-instance:|"ruleCode"|"candidateId"|"rawDecision"|"developerDetail"/i,
    `${definition.caseId} PLAYER 投影泄漏内部字段:${internalLeakMatches.slice(0, 5).join('|')}`,
  );
  assert.doesNotMatch(
    JSON.stringify(player.aiSummaryInput),
    /scoreAudit|candidateId|ruleCode|formulaTrace|normalizedUtility|objectiveUtility|rawDecision/i,
    `${definition.caseId} AI摘要输入泄漏内部字段`,
  );
  assert.ok(
    developer.factRegistry.some(fact => fact.developerDetail),
    `${definition.caseId} DEVELOPER 投影缺少开发细节`,
  );
  developer.factRegistry.filter(fact =>
    fact.eventKind === 'defend' &&
    Number(fact?.developerDetail?.meta?.damageMultiplier) > 0 &&
    Number(fact?.developerDetail?.meta?.damageMultiplier) < 1
  ).forEach(fact => {
    const exchange = player.exchanges.find(item => item.factIds.includes(fact.factId));
    assert.match(
      String(exchange?.responseSummary || ''),
      /伤害.+%/,
      `${definition.caseId} 防御成功但没有说明实际减伤:${fact.factId}`,
    );
  });

  return {
    definition,
    draft,
    player,
    developer,
    factKinds: [...new Set(player.factRegistry.map(fact => fact.eventKind))].sort(),
    actionNames: [...new Set(player.factRegistry.map(fact => fact.actionName).filter(Boolean))].sort(),
  };
}

const results = requiredCaseIds.map(caseId => runCase(caseMap.get(caseId)));
const chargeDefinition = caseMap.get('duel_agile_counter_options');
const chargeCombatData = clone(chargeDefinition.combatData);
const chargeActor = chargeCombatData.参战者.team_player[0];
const chargeTarget = chargeCombatData.参战者.team_enemy[0];
const chargeActorId = chargeActor.id || chargeActor.name || chargeActor.名称;
const chargeTargetId = chargeTarget.id || chargeTarget.name || chargeTarget.名称;
const chargeDraft = runtime.executeBattleDraft({
  caseId: 'phase7_charge_projection',
  seed: 74101,
  combatData: chargeCombatData,
  mode: 'team_preview',
  rounds: 1,
  selectedAction: {
    actorId: chargeActorId,
    actionKind: 'RELEASE_SKILL',
    targetIds: [chargeTargetId],
    skill: {
      id: 'phase7-charge-projection',
      name: '蓄力投影测试',
      魂技名: '蓄力投影测试',
      前摇: 80,
      消耗: '魂力:1',
      _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 20, 伤害类型: '远程攻击' }],
    },
  },
  settings: { decisionEngine: 'next-shadow' },
});
const chargeReportAudit = reportRuntime.auditProjection(reportRuntime.build({ draft: chargeDraft, visibilityMode: 'PLAYER' }));
assert.equal(chargeReportAudit.passed, true, `蓄力声明专项Projection失败:${JSON.stringify(chargeReportAudit.fatals)}`);
const chargeFacts = chargeReportAudit.reportDto.factRegistry.filter(fact => fact.eventKind === 'charge_start');
assert.equal(chargeFacts.length, 1, `蓄力声明专项没有唯一charge_start事实:${JSON.stringify(chargeFacts)}`);
const chargeFullText = reportRuntime.serializeFullText(chargeReportAudit.reportDto);
assert.ok(chargeFullText.includes(chargeFacts[0].summary), '蓄力声明专项没有形成玩家可读动作');
assert.doesNotMatch(chargeFullText, /\bPENDING\b/, '蓄力声明专项泄漏PENDING内部终态');

const dumpCaseIndex = process.argv.indexOf('--dump-case');
const dumpCaseId = dumpCaseIndex >= 0 ? String(process.argv[dumpCaseIndex + 1] || '').trim() : '';
if (dumpCaseId) {
  const dumpResult = results.find(item => item.definition.caseId === dumpCaseId);
  if (!dumpResult) throw new Error(`phase7_dump_case_missing:${dumpCaseId}`);
  console.log(`\n===== ${dumpCaseId} =====\n`);
  console.log(reportRuntime.serializeFullText(dumpResult.player));
  console.log(`\n===== END ${dumpCaseId} =====\n`);
}

const summonResult = results.find(item => item.definition.caseId === 'raid_summon_heavy');
const summonFacts = summonResult.player.factRegistry.filter(fact => fact.eventKind === 'summon_create');
assert.ok(summonFacts.length > 0, '召唤案例没有召唤生成事实');
const summonShieldRound = summonResult.player.roundOverview.find(round =>
  (round.factIds || []).some(factId => summonResult.player.factRegistry
    .find(fact => fact.factId === factId)?.numericTokens
    .some(token => ['护盾增加', '护盾吸收', '护盾损耗'].includes(token.label)))
);
assert.ok(summonShieldRound, '召唤重场没有护盾数值回合');
assert.match(summonShieldRound.summary, /护盾/, '只有护盾变化的回合速览没有投影护盾数值');
assert.doesNotMatch(summonShieldRound.summary, /未产生生命、护盾、资源或物品变化/, '护盾变化回合被错误宣称没有数值变化');
const fusionParticipationDeveloperFacts = summonResult.developer.factRegistry.filter(fact =>
  fact.eventKind === 'blocked_action' &&
  fact.developerDetail?.ruleCode === 'FUSION_PARTICIPATION_CONSUMED'
);
const fusionParticipationFactIds = new Set(fusionParticipationDeveloperFacts.map(fact => fact.factId));
const fusionParticipationFacts = summonResult.player.factRegistry.filter(fact =>
  fusionParticipationFactIds.has(fact.factId)
);
assert.ok(fusionParticipationFacts.length > 0, '搭档参与融合没有形成结构化机会事实');
assert.ok(
  fusionParticipationFacts.every(fact => /参与【.+】完成融合/.test(fact.summary)),
  `搭档参与融合仍被投影为行动失败:${fusionParticipationFacts.map(fact => fact.summary).join('|')}`,
);
assert.doesNotMatch(
  reportRuntime.serializeFullText(summonResult.player),
  /【融合协同】未能执行/,
  '搭档参与融合仍套用阻断动作模板',
);
assert.ok(
  summonFacts.every(fact =>
    !/召唤物$/.test(fact.summary) &&
    !/structured-summon:|battle-summon:|summon-instance:/i.test(JSON.stringify(fact)),
  ),
  '召唤事实没有投影真实名称或泄漏内部ID',
);

const itemResult = results.find(item => item.definition.caseId === 'item_creation_consumption');
const creationFact = itemResult.player.factRegistry.find(fact => fact.eventKind === 'create');
assert.ok(creationFact, '造物案例没有create事实');
const creationExchange = itemResult.player.exchanges.find(exchange => exchange.factIds.includes(creationFact.factId));
assert.match(creationExchange?.text || '', /制作【恢复大肉包】/, '造物动作仍被写成使用成品');
assert.match(creationFact.summary || '', /制作1份【恢复大肉包】并收入库存/, '造物事实没有表达制作数量和入库');
const creationRound = itemResult.player.roundOverview.find(round => (round.factIds || []).includes(creationFact.factId));
assert.match(creationRound?.summary || '', /制作\d+件物品/, '只有造物变化的回合速览没有投影库存变化');
assert.doesNotMatch(creationRound?.summary || '', /未产生生命、护盾、资源或物品变化/, '造物回合被错误宣称没有数值变化');

const equipmentResult = results.find(item => item.definition.caseId === 'equipment_switch_no_loop');
const equipmentFact = equipmentResult.player.factRegistry.find(fact =>
  fact.eventKind === 'effect_resolved' &&
  fact.actionName === '疾风试作匕首' &&
  fact.stateName === '敏捷'
);
assert.ok(equipmentFact, '装备案例没有属性修正事实');
assert.match(equipmentFact.summary || '', /敏捷由\d+变为\d+/, '装备属性变化仍是无数值占位文案');
assert.ok(
  equipmentFact.numericTokens.some(token => token.label === '敏捷原值') &&
  equipmentFact.numericTokens.some(token => token.label === '敏捷变化') &&
  equipmentFact.numericTokens.some(token => token.label === '敏捷结果'),
  '装备属性变化缺少可追溯数字Token',
);

const singleSummonResult = results.find(item => item.definition.caseId === 'summon_one_window');
assert.ok(
  singleSummonResult.player.adjudications.every(item =>
    !/情报不足/.test(item.reasonSummary || '') &&
    item.predicted?.problem !== '情报不足'
  ),
  '无信息收益动作仍用“情报不足”解释选招',
);
const sourceSummonActor = singleSummonResult.definition.combatData.参战者.team_enemy[0];
const selfTargetSummonSkill = decisionRuntime.collectSkills(sourceSummonActor)
  .find(skill => String(skill?.name || skill?.魂技名 || '').trim() === '光龙分身');
assert.ok(selfTargetSummonSkill, '召唤专项缺少光龙分身技能');
const summonSkill = {
  ...clone(selfTargetSummonSkill),
  前摇: 1,
  消耗: { 魂力: 1 },
};
const syntheticUnit = (id, side, skills, overrides = {}) => ({
  id,
  name: id,
  名称: id,
  side,
  hp: 5000,
  hp_max: 5000,
  sp: 100,
  sp_max: 100,
  men: 100,
  men_max: 100,
  vit: 100,
  vit_max: 100,
  str: 1000,
  def: 100,
  agi: 100,
  属性: {
    等级: 50,
    HP: 5000,
    HP上限: 5000,
    魂力: 100,
    魂力上限: 100,
    精神力: 100,
    精神力上限: 100,
    体力: 100,
    体力上限: 100,
    力量: 1000,
    防御: 100,
    敏捷: 100,
    状态效果: {},
  },
  状态: { 存活: true, 行动: '战斗' },
  状态效果: {},
  持续效果: {},
  背包: {},
  技能列表: skills,
  ...overrides,
});
const selfTargetSummonActorId = 'phase7-summoner';
const selfTargetSummonActor = syntheticUnit(selfTargetSummonActorId, 'player', [summonSkill], {
  状态效果: {
    disarmed: {
      状态: '缴械',
      状态名称: '缴械',
      duration: 2,
      持续回合: 2,
      战斗效果: { disarm: true },
    },
  },
});
const selfTargetSummonCombatData = {
  回合: 0,
  战斗类型: '普通战斗',
  战斗意图: '切磋',
  进行中: true,
  参战者: {
    team_player: [selfTargetSummonActor],
    team_enemy: [syntheticUnit('phase7-summon-target', 'enemy', [])],
  },
};
const selfTargetSummonDraft = runtime.executeBattleDraft({
  caseId: 'phase7_self_target_summon_projection',
  seed: 74102,
  combatData: selfTargetSummonCombatData,
  mode: 'team_preview',
  rounds: 1,
  settings: { decisionEngine: 'next-shadow' },
});
const selfTargetSummonReportAudit = reportRuntime.auditProjection(
  reportRuntime.build({ draft: selfTargetSummonDraft, visibilityMode: 'PLAYER' }),
);
assert.equal(
  selfTargetSummonReportAudit.passed,
  true,
  `自目标召唤Projection失败:${JSON.stringify(selfTargetSummonReportAudit.fatals)}`,
);
const selfTargetSummonDecisions = selfTargetSummonDraft.decisionAudit.filter(decision =>
  decision?.selected?.selectedActionName === '光龙分身',
);
assert.equal(selfTargetSummonDecisions.length, 1, '自目标召唤没有且仅形成一个玩家锁定决策');
selfTargetSummonDecisions.forEach(decision => {
  assert.ok(
    decision.selected.predictedOutcomeEvidence.some(evidence =>
      evidence.outcomeKind === 'HP_DELTA' &&
      evidence.targetId !== decision.actorId &&
      Number(evidence.expectedDelta) < 0
    ),
    '自目标召唤没有保留召唤攻击的敌方目标归属',
  );
  const adjudication = selfTargetSummonReportAudit.reportDto.adjudications.find(item =>
    item.round === decision.round &&
    item.actorId === decision.actorId &&
    item.selected?.actionName === '光龙分身'
  );
  assert.doesNotMatch(
    String(adjudication?.reasonSummary || ''),
    /队伍续航|恢复当前受损成员|建立可兑现的护盾/,
    '自目标召唤攻击被错误投影为治疗或护盾行为',
  );
});

const dotFacts = results.flatMap(item => item.player.factRegistry.filter(fact =>
  fact.eventKind === 'state_tick' || fact.factType === 'STATE_TICK',
));
assert.ok(dotFacts.length > 0, '真实案例没有STATE_TICK事实');
assert.ok(
  dotFacts.every(fact =>
    fact.factType === 'STATE_TICK' &&
    fact.actionRole === 'STATE_TICK' &&
    fact.sourceActionId &&
    !/施展.*造成|直接造成/.test(fact.summary),
  ),
  'DOT被错误投影为源技能直接命中或缺少来源',
);
results.forEach(item => {
  const actionStarts = item.player.factRegistry.filter(fact =>
    ['action_start', 'charge_start'].includes(fact.eventKind)
  );
  item.player.factRegistry.filter(fact => fact.eventKind === 'state_tick' && fact.sourceActionId).forEach(fact => {
    const source = actionStarts.find(start => start.actionId === fact.sourceActionId);
    assert.ok(source, `${item.definition.caseId} DOT找不到来源动作:${fact.factId}/${fact.sourceActionId}`);
    const adjudication = item.player.adjudications.find(entry =>
      entry.actual?.factIds?.includes(source.factId)
    );
    assert.ok(adjudication, `${item.definition.caseId} DOT来源动作缺少判定:${source.factId}`);
    assert.ok(
      adjudication.actual.factIds.includes(fact.factId) &&
      String(adjudication.actual.resultSummary || '').includes(fact.summary),
      `${item.definition.caseId} 判定实际结果没有串回DOT兑现:${fact.factId}`,
    );
  });
});

const multiTargetResult = results.find(item => item.definition.caseId === 'team_multi_target_response');
const multiTargetExchanges = multiTargetResult.player.exchanges.filter(exchange => exchange.targetIds.length > 1);
assert.ok(
  multiTargetExchanges.length > 0 ||
    multiTargetResult.player.factRegistry.some(fact => fact.targetIds.length > 1),
  '群攻案例没有保留多目标事实',
);
const multiTargetFactIds = multiTargetResult.player.factRegistry
  .filter(fact => fact.targetIds.length > 1)
  .map(fact => fact.factId);
assert.ok(
  multiTargetFactIds.every(factId => multiTargetResult.player.factRegistry.filter(fact => fact.factId === factId).length === 1),
  '群攻事实出现重复注册',
);

const resourceFacts = results.flatMap(item => item.player.factRegistry.filter(fact =>
  fact.eventKind === 'resource_change' || fact.eventKind === 'round_recover' || fact.eventKind === 'action_cost',
));
assert.ok(resourceFacts.length > 0, '真实案例没有资源事实');
assert.ok(
  resourceFacts.every(fact => fact.actorName && (fact.numericTokens.length > 0 || fact.eventKind === 'action_cost')),
  '资源事实缺少主体或数值来源',
);
results.forEach(item => {
  item.player.roundOverview.forEach(round => {
    const hasResourceValue = (round.factIds || []).some(factId => item.player.factRegistry
      .find(fact => fact.factId === factId)?.numericTokens
      .some(token => token.label === '资源变化'));
    if (!hasResourceValue) return;
    assert.match(round.summary, /资源/, `${item.definition.caseId} 第${round.round}回合资源数值没有进入速览`);
    assert.doesNotMatch(round.summary, /未产生生命、护盾、资源或物品变化/, `${item.definition.caseId} 第${round.round}回合资源变化被错误判空`);
  });
});

const adjudicationChecks = results.flatMap(item => item.player.adjudications);
assert.ok(
  adjudicationChecks.every(item =>
    item.selected?.actionName &&
    Array.isArray(item.alternatives) &&
    item.alternatives.length <= 2 &&
    item.reasonSummary &&
    item.actual?.factIds?.length,
  ),
  '判定明细缺少选中动作、替代动作、原因或实际事实',
);

const summary = results.map(item => ({
  caseId: item.definition.caseId,
  seed: item.definition.seed,
  actualRoundCount: item.draft.actualRoundCount,
  inputHash: runtime.hashBattleValue(item.definition.combatData),
  beliefHash: runtime.hashBattleValue(item.definition.initialBelief || {}),
  ledgerHash: runtime.hashBattleValue(item.draft.ledger),
  factCount: item.player.factRegistry.length,
  exchangeCount: item.player.exchanges.length,
  adjudicationCount: item.player.adjudications.length,
  factKinds: item.factKinds,
  actionNames: item.actionNames.slice(0, 16),
  evidence: [...new Set([
    1,
    Math.max(1, Math.ceil(item.draft.actualRoundCount / 2)),
    item.draft.actualRoundCount,
  ])].map(round => item.player.exchanges.find(exchange => exchange.round === round))
    .filter(Boolean)
    .map(exchange => ({ round: exchange.round, exchangeId: exchange.exchangeId })),
  reportHash: reportRuntime.auditProjection(item.player).reportHash,
}));

console.log(JSON.stringify({
  summary,
  coverage: {
    cases: requiredCaseIds,
    summonFacts: summonFacts.length,
    dotFacts: dotFacts.length,
    multiTargetFacts: multiTargetFactIds.length,
    resourceFacts: resourceFacts.length,
    chargeFacts: chargeFacts.length,
    adjudications: adjudicationChecks.length,
    lazyFullText: true,
    playerDeveloperIsolation: true,
  },
  passed: true,
}, null, 2));

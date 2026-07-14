import crypto from 'node:crypto';
import { manualBattleCases, manualSourceDataHashes } from './battle_r63_manual_manifest.mjs';

const clone = value => structuredClone(value);
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function sourceSnapshot(library, name) {
  const snapshots = library?.角色?.[name]?.快照;
  const snapshot = Array.isArray(snapshots) ? snapshots.at(-1)?.角色 : null;
  if (!snapshot) throw new Error(`r63_manual_character_missing:${name}`);
  return clone(snapshot);
}

function readSystem(snapshot = {}) {
  return String(snapshot?.第1武魂?.系别 || snapshot?.第1武魂?.类型 || snapshot?.属性?.系别 || '强攻系').trim() || '强攻系';
}

function removeLockedSoulRings(value, maximumRingCount) {
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach(key => {
    const match = /^第(\d+)魂环$/.exec(String(key));
    if (match && Number(match[1]) > maximumRingCount) {
      delete value[key];
      return;
    }
    removeLockedSoulRings(value[key], maximumRingCount);
  });
}

function participant(library, getBaseStats, name, options = {}) {
  const snapshot = sourceSnapshot(library, name);
  const sourceHash = hash(snapshot);
  const expectedSourceHash = manualSourceDataHashes[name];
  if (!expectedSourceHash || sourceHash !== expectedSourceHash) {
    throw new Error(`r63_manual_character_hash_changed:${name}:expected=${expectedSourceHash || 'missing'}:actual=${sourceHash}`);
  }
  const level = Math.max(1, Number(options.level || snapshot?.属性?.等级 || 1));
  removeLockedSoulRings(snapshot, Math.min(9, Math.floor(level / 10)));
  const system = readSystem(snapshot);
  if (typeof getBaseStats !== 'function') throw new Error('r63_manual_base_stats_missing');
  const stats = getBaseStats(level);
  const hpMax = Math.max(1, Math.floor(Number(stats?.vit_max || 1)));
  const soulMax = Math.max(1, Math.floor(Number(stats?.sp_max || 1)));
  const spiritMax = Math.max(1, Math.floor(Number(stats?.men_max || 1)));
  const staminaMax = hpMax;
  const strength = Math.max(1, Math.floor(Number(stats?.str || 1)));
  const defense = Math.max(1, Math.floor(Number(stats?.def || 1)));
  const agility = Math.max(1, Math.floor(Number(stats?.agi || 1)));
  const hp = Math.max(1, Math.round(hpMax * Number(options.hpRatio ?? 1)));
  const stamina = Math.max(1, Math.round(staminaMax * Number(options.staminaRatio ?? 1)));
  const soul = Math.max(0, Math.round(soulMax * Number(options.soulRatio ?? 1)));
  const spirit = Math.max(0, Math.round(spiritMax * Number(options.spiritRatio ?? 1)));
  snapshot.id = name;
  snapshot.name = name;
  snapshot.名称 = name;
  snapshot.type = system;
  snapshot.系别 = system;
  delete snapshot.final;
  Object.assign(snapshot, {
    hp,
    HP: hp,
    hp_max: hpMax,
    sp: soul,
    men: spirit,
    vit: stamina,
    sta: stamina,
    sp_max: soulMax,
    men_max: spiritMax,
    vit_max: hpMax,
    str: strength,
    def: defense,
    agi: agility,
  });
  snapshot.属性 = {
    ...(snapshot.属性 || {}),
    等级: level,
    系别: system,
    HP: hp,
    HP上限: hpMax,
    体力: stamina,
    体力上限: staminaMax,
    魂力: soul,
    魂力上限: soulMax,
    精神力: spirit,
    精神力上限: spiritMax,
    力量: strength,
    防御: defense,
    敏捷: agility,
    状态效果: {},
  };
  snapshot.状态 = { ...(snapshot.状态 || {}), 存活: true, 位置: 'R6.3本地审阅场', 行动: '战斗' };
  snapshot.状态效果 = {};
  snapshot.持续效果 = {};
  snapshot.背包 = snapshot.背包 && typeof snapshot.背包 === 'object' ? snapshot.背包 : {};
  if (options.charging) snapshot.蓄力技能 = clone(options.charging);
  return { unit: snapshot, sourceHash };
}

function battle(caseId, rounds, intent, players, enemies, initialBelief = {}) {
  const contract = manualBattleCases.find(item => item.caseId === caseId);
  if (!contract) throw new Error(`r63_manual_case_contract_missing:${caseId}`);
  return {
    caseId,
    seed: 630000 + [...caseId].reduce((sum, char) => sum + char.charCodeAt(0), 0),
    rounds,
    intent,
    initialBelief,
    sourceCharacterIds: [...players, ...enemies].map(entry => entry.unit.name),
    sourceDataHashes: Object.fromEntries([...players, ...enemies].map(entry => [entry.unit.name, entry.sourceHash])),
    candidateRelations: [...contract.candidateRelations],
    forbiddenSelections: [...contract.forbiddenSelections],
    requiredFacts: contract.requiredFacts.map(item => ({ ...item })),
    mutationRelations: [...contract.mutationRelations],
    combatData: {
      回合: 0,
      战斗类型: '普通战斗',
      战斗意图: intent,
      时间段: '白天',
      进行中: true,
      参战者: { team_player: players.map(entry => entry.unit), team_enemy: enemies.map(entry => entry.unit) },
    },
  };
}

function objectiveContract(maxRounds, victoryConditions, defeatConditions = [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' }]) {
  return {
    version: 1,
    explicit: true,
    startRound: 0,
    maxRounds,
    resolutionPriority: 'DEFEAT_FIRST',
    victory: { logic: 'ANY', conditions: victoryConditions },
    defeat: { logic: 'ANY', conditions: defeatConditions },
  };
}

export function buildManualCases(library, getBaseStats) {
  const make = (name, options) => participant(library, getBaseStats, name, options);
  const charge = {
    id: 'visible-charge', type: 'skill', action_type: '释放魂技', cast_time: 30,
    skill: {
      id: 'visible-charge-skill', name: '已显露蓄力重击', 魂技名: '已显露蓄力重击', 前摇: 30, 消耗: { 魂力: 100 },
      _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 500, 伤害类型: '近身攻击', 生效方式: '独立生效' }],
    },
  };
  const longCharge = {
    ...clone(charge),
    cast_time: 80,
    skill: { ...clone(charge.skill), 前摇: 80 },
  };
  const equipmentTester = make('谢邂', { level: 50 });
  equipmentTester.unit.背包.疾风试作匕首 = {
    id: 'r63-review-agility-dagger',
    name: '疾风试作匕首',
    名称: '疾风试作匕首',
    类型: '装备',
    数量: 1,
    装备属性: { 敏捷: '+20%' },
  };
  const cases = [
    battle('duel_overmatch_lethal', 4, '死斗', [make('云冥')], [make('韦小枫')]),
    battle('duel_overmatch_nonlethal', 4, '点到为止', [make('舞长空')], [make('韦小枫')]),
    battle('duel_underdog_survival', 5, '求生', [make('韦小枫')], [make('舞长空', { charging: longCharge })]),
    battle('duel_peer_unknown_probe', 5, '点到为止', [make('谢邂')], [make('韦小枫')], { confidence: 0.2 }),
    battle('duel_agile_single_target_failure', 5, '求生', [make('谢邂', { level: 45, hpRatio: 0.05 })], [make('王金玺', { level: 50 })]),
    battle('duel_agile_counter_options', 5, '切磋', [make('谢邂', { level: 50 })], [make('王金玺', { level: 50 })]),
    battle('duel_charge_interrupt_safer', 4, '切磋', [make('舞长空', { level: 60 })], [make('古月', { level: 60, charging: charge })]),
    battle('duel_charge_defense_safer', 4, '切磋', [make('韦小枫', { hpRatio: 0.25, soulRatio: 0 })], [make('舞长空', { charging: longCharge })]),
    battle('team_focus_without_overkill', 4, '击败', [make('唐舞麟'), make('古月'), make('谢邂')], [make('张扬子', { hpRatio: 0.25 }), make('王金玺'), make('韦小枫')]),
    battle('team_protect_critical_ally', 4, '守护', [make('舞长空', { level: 70, hpRatio: 0.05 }), make('雅莉'), make('唐舞麟', { level: 70 })], [make('龙跃', { level: 70 }), make('戴月炎', { level: 70 }), make('苏沐', { level: 70 })]),
    battle('team_heal_crisis', 4, '守护', [make('雅莉', { level: 98, hpRatio: 0.8 }), make('舞长空', { level: 90, hpRatio: 0.25 }), make('古月', { level: 90, hpRatio: 0.3 })], [make('龙跃', { level: 90 }), make('戴月炎', { level: 90 }), make('苏沐', { level: 90 })]),
    battle('team_control_overlap', 4, '击败', [make('古月', { level: 60 }), make('许小言', { level: 60 }), make('舞长空', { level: 60 })], [make('龙跃', { level: 55, charging: charge }), make('戴月炎', { level: 55 }), make('苏沐', { level: 55 })]),
    battle('team_resource_support', 6, '击败', [make('白寒樱', { level: 50 }), make('唐舞麟', { level: 50, soulRatio: 0.08 }), make('古月', { level: 50, soulRatio: 0.12 })], [make('龙跃', { level: 50 }), make('戴月炎', { level: 50 }), make('苏沐', { level: 50 })]),
    battle('team_multi_target_response', 6, '击败', [make('唐舞麟', { level: 60 }), make('谢邂', { level: 60 }), make('古月', { level: 60 })], [make('张扬子', { level: 52, hpRatio: 0.55 }), make('王金玺', { level: 52, hpRatio: 0.55 }), make('韦小枫', { level: 52, hpRatio: 0.55 })]),
    battle('team_counter_coordination', 6, '切磋', [make('谢邂', { level: 55 }), make('唐舞麟', { level: 55 }), make('古月', { level: 55 })], [make('王金玺', { level: 55 }), make('张扬子', { level: 55 }), make('许小言', { level: 55 })]),
    battle('team_unknown_enemy_adaptation', 6, '切磋', [make('唐舞麟', { level: 55 }), make('古月', { level: 55 }), make('谢邂', { level: 55 })], [make('龙跃', { level: 58, charging: longCharge }), make('戴月炎', { level: 55 }), make('苏沐', { level: 55 })], { confidence: 0.12 }),
    battle('raid_balanced', 5, '击败', [make('唐舞麟', { level: 55 }), make('古月', { level: 55 }), make('谢邂', { level: 55 }), make('许小言', { level: 55 }), make('叶星澜', { level: 55 }), make('徐笠智', { level: 55 }), make('原恩夜辉', { level: 55 })], [make('龙跃', { level: 55 }), make('戴月炎', { level: 55 }), make('苏沐', { level: 55 }), make('王金玺', { level: 55 }), make('张扬子', { level: 55 }), make('韦小枫', { level: 55 }), make('乐正宇', { level: 55 })]),
    battle('raid_level_gap', 5, '击败', [make('唐舞麟', { level: 90 }), make('古月', { level: 90 }), make('谢邂', { level: 90 }), make('许小言', { level: 90 }), make('叶星澜', { level: 90 }), make('徐笠智', { level: 90 }), make('原恩夜辉', { level: 90 })], [make('龙跃', { level: 50 }), make('戴月炎', { level: 50 }), make('苏沐', { level: 50 }), make('王金玺', { level: 50 }), make('张扬子', { level: 50 }), make('韦小枫', { level: 50 }), make('乐正宇', { level: 50 })]),
    battle('raid_control_heavy', 5, '击败', [make('许小言', { level: 75 }), make('舞长空', { level: 75 }), make('古月', { level: 75 }), make('唐舞麟', { level: 75 }), make('谢邂', { level: 75 }), make('叶星澜', { level: 75 }), make('雅莉', { level: 75 })], [make('龙跃', { level: 70, charging: charge }), make('戴月炎', { level: 70 }), make('苏沐', { level: 70 }), make('王金玺', { level: 70 }), make('张扬子', { level: 70 }), make('韦小枫', { level: 70 }), make('原恩夜辉', { level: 70 })]),
    battle('raid_summon_heavy', 5, '击败', [make('韦小枫', { level: 65 }), make('张扬子', { level: 65 }), make('徐笠智', { level: 65 }), make('古月', { level: 65 }), make('谢邂', { level: 65 }), make('唐舞麟', { level: 65 }), make('许小言', { level: 65 })], [make('龙跃', { level: 65 }), make('戴月炎', { level: 65 }), make('苏沐', { level: 65 }), make('王金玺', { level: 65 }), make('叶星澜', { level: 65 }), make('原恩夜辉', { level: 65 }), make('乐正宇', { level: 65 })]),
    battle('summon_one_window', 4, '切磋', [make('韦小枫', { level: 50 })], [make('谢邂', { level: 50 })]),
    battle('item_creation_consumption', 6, '守护', [make('徐笠智', { level: 50 }), make('唐舞麟', { level: 50, hpRatio: 0.6, staminaRatio: 0.3 }), make('古月', { level: 50, staminaRatio: 0.5 })], [make('龙跃', { level: 45 }), make('戴月炎', { level: 45 }), make('苏沐', { level: 45 })]),
    battle('equipment_switch_no_loop', 6, '切磋', [equipmentTester], [make('王金玺', { level: 50 })]),
    battle('intent_capture_vs_kill', 6, '点到为止', [make('舞长空', { level: 70 })], [make('韦小枫', { level: 45 })]),
  ];
  const defaultVictory = [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY', scope: 'ALL' }];
  cases.forEach(item => {
    item.combatData.胜负条件 = objectiveContract(item.rounds, defaultVictory);
  });
  cases.find(item => item.caseId === 'duel_overmatch_nonlethal').combatData.胜负条件 = objectiveContract(4, [
    { type: 'HP_RATIO_AT_OR_BELOW', side: 'ENEMY', targetIds: ['韦小枫'], threshold: 0.01, scope: 'ALL' },
  ]);
  ['duel_underdog_survival', 'duel_charge_defense_safer'].forEach(caseId => {
    const item = cases.find(entry => entry.caseId === caseId);
    item.combatData.胜负条件 = objectiveContract(item.rounds, [
      { type: 'ROUND_REACHED', side: 'PLAYER', round: item.rounds, requireActive: true },
    ]);
  });
  cases.find(item => item.caseId === 'duel_agile_single_target_failure').combatData.胜负条件 = objectiveContract(5, [
    { type: 'WITHDRAW_SUCCESS', side: 'PLAYER' },
  ]);
  ['summon_one_window'].forEach(caseId => {
    const item = cases.find(entry => entry.caseId === caseId);
    const actor = item.combatData.参战者.team_player.find(unit => unit?.name === '韦小枫');
    const summonSkill = actor?.第1武魂?.第1魂灵?.第2魂环?.第2魂技;
    const target = item.combatData.参战者.team_enemy[0];
    item.selectedAction = {
      actorId: actor?.id || actor?.name || '韦小枫',
      actionKind: 'RELEASE_SKILL',
      targetIds: [target?.id || target?.name].filter(Boolean),
      skill: clone(summonSkill),
    };
  });
  const equipmentCase = cases.find(item => item.caseId === 'equipment_switch_no_loop');
  const equipmentActor = equipmentCase.combatData.参战者.team_player[0];
  const equipmentItem = equipmentActor?.背包?.疾风试作匕首;
  equipmentCase.selectedAction = {
    actorId: equipmentActor?.id || equipmentActor?.name || '谢邂',
    actionKind: 'EQUIP',
    targetIds: [equipmentActor?.id || equipmentActor?.name || '谢邂'],
    skill: clone(equipmentItem),
    irreversibleAsset: { assetId: equipmentItem?.id || 'r63-review-agility-dagger', cost: 0 },
  };
  const itemCase = cases.find(item => item.caseId === 'item_creation_consumption');
  const itemProducer = itemCase.combatData.参战者.team_player.find(unit => unit?.name === '徐笠智');
  const recoverySkill = itemProducer?.第1武魂?.第1魂灵?.第1魂环?.第1魂技;
  itemCase.combatData.参战者.team_enemy.forEach(unit => {
    unit.hp = 20000;
    unit.HP = 20000;
    unit.hp_max = 20000;
    unit.属性.HP = 20000;
    unit.属性.HP上限 = 20000;
    unit.str = 1000;
    unit.def = 5000;
    unit.agi = 10;
    unit.属性.力量 = 1000;
    unit.属性.防御 = 5000;
    unit.属性.敏捷 = 10;
  });
  itemCase.selectedAction = {
    actorId: itemProducer?.id || itemProducer?.name || '徐笠智',
    actionKind: 'RELEASE_SKILL',
    targetIds: [itemProducer?.id || itemProducer?.name || '徐笠智'],
    skill: clone(recoverySkill),
  };
  cases.find(item => item.caseId === 'team_protect_critical_ally').combatData.胜负条件 = objectiveContract(4, [
    { type: 'ROUND_REACHED', side: 'PLAYER', round: 4, requireActive: true },
  ], [
    { type: 'UNIT_INCAPACITATED', side: 'PLAYER', targetIds: ['舞长空'], scope: 'ANY' },
  ]);
  cases.find(item => item.caseId === 'team_heal_crisis').combatData.胜负条件 = objectiveContract(4, [
    { type: 'ROUND_REACHED', side: 'PLAYER', round: 4, requireActive: true },
  ], [
    { type: 'UNIT_INCAPACITATED', side: 'PLAYER', targetIds: ['舞长空', '古月'], scope: 'ANY' },
  ]);
  cases.find(item => item.caseId === 'item_creation_consumption').combatData.胜负条件 = objectiveContract(6, [
    { type: 'ROUND_REACHED', side: 'PLAYER', round: 6, requireActive: true },
  ], [
    { type: 'TEAM_INCAPACITATED', side: 'PLAYER', scope: 'ALL' },
  ]);
  cases.find(item => item.caseId === 'intent_capture_vs_kill').combatData.胜负条件 = objectiveContract(6, [
    { type: 'HP_RATIO_AT_OR_BELOW', side: 'ENEMY', targetIds: ['韦小枫'], threshold: 0.3, scope: 'ALL' },
  ]);
  cases.find(item => item.caseId === 'duel_agile_counter_options').seed = 630071;
  cases.find(item => item.caseId === 'team_counter_coordination').seed = 630071;
  return cases;
}

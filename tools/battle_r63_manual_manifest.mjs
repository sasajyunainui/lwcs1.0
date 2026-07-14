export const manualSourceDataHashes = Object.freeze({
  谢邂: '9058d01b9bb7c2dea42cd8787831646a9648eb46db22691bcf3e1c63a1713ee5',
  王金玺: '2d2412e037aba25325c5b8c994434cff5d49d7c260439f9c0609088c50254041',
  韦小枫: '1790a1a539684385f2c235788343bc402efd33bbbd29ab220d05b011997d9df6',
  舞长空: 'c0edcfa6fdb46e834b430a70f80865fcc4373f8124ed3c24edebd4f6c7af45d6',
  古月: '140cd73eea00962d7ff9a538e32addbef95da581428891bd9bf7bf65941fabab',
  云冥: '6d8067721ceb94b4e8e36510102447fd3e2581a3eec4eca606f1ab2910bf5ede',
  徐笠智: 'dec170d4978d4010285ab22b9c9bf5ae8b174ef7a842d4f3afa68afb47022525',
  唐舞麟: 'b79459343dd2995cfd584610e4610c0547a8e654ae2122d203e81ed29b5fe05c',
  龙跃: '46e85a81619c8573601aa0c020ef5c2ef8553e04b9308047d931eb7f645ea7fb',
  戴月炎: '4723ef3d2d8ccc727b870ee26ded1dcef9376b4eb8f71dc221abdd4aa6d6a6b3',
  苏沐: 'a4c691d60c6673aa148025b44179642300ec54416df0490a6ae4570b1fef4d4c',
  许小言: '73c78621a9be349fcfabd3600984f05188884f022d1c054c10c76aa3954a6738',
  叶星澜: '7f7d8534714ed5c219bcefe131f6417f4f949e76c0e0778543323324dc8c5f5b',
  原恩夜辉: 'd504d84583d2ffc3f80b783539b43b9562f5e0fdfd35c371587480696d920eb8',
  张扬子: 'c0c49966d7d27571c49db5f85cd71c3b8bbc92ca986f575efdb15e9830e818fa',
  乐正宇: 'ec1c59bbcd6b273e637b9f98db38dfdf878e14eee3c2198f6a5bd74a099b6555',
  雅莉: '9301193597960f2ca4a24102bce6ec927d056ce87f51c5b48b2fb987ace2b30c',
  白寒樱: '2f14c772c2e48c40c4656236e278f7f5cc677aa05bf58094999c10dfddaaa406',
});

const manualBattleCaseDefinitions = [
  { caseId: 'duel_overmatch_lethal', group: 'duel', rounds: 20, focus: ['level_gap', 'lethal_intent'] },
  { caseId: 'duel_overmatch_nonlethal', group: 'duel', rounds: 20, focus: ['level_gap', 'nonlethal_intent'] },
  { caseId: 'duel_underdog_survival', group: 'duel', rounds: 20, focus: ['underdog', 'survival'] },
  { caseId: 'duel_peer_unknown_probe', group: 'duel', rounds: 20, focus: ['peer', 'limited_information'] },
  { caseId: 'duel_agile_single_target_failure', group: 'duel', rounds: 20, focus: ['agile', 'adaptation'] },
  { caseId: 'duel_agile_counter_options', group: 'duel', rounds: 20, focus: ['agile', 'counterplay'] },
  { caseId: 'duel_charge_interrupt_safer', group: 'duel', rounds: 20, focus: ['charging', 'interrupt'] },
  { caseId: 'duel_charge_defense_safer', group: 'duel', rounds: 20, focus: ['charging', 'defense'] },
  { caseId: 'team_focus_without_overkill', group: 'team', rounds: 10, focus: ['focus', 'overkill'] },
  { caseId: 'team_protect_critical_ally', group: 'team', rounds: 10, focus: ['protect', 'ally_crisis'] },
  { caseId: 'team_heal_crisis', group: 'team', rounds: 10, focus: ['healing', 'ally_crisis'] },
  { caseId: 'team_control_overlap', group: 'team', rounds: 10, focus: ['control', 'marginal_value'] },
  { caseId: 'team_resource_support', group: 'team', rounds: 10, focus: ['resource', 'consumer'] },
  { caseId: 'team_multi_target_response', group: 'team', rounds: 10, focus: ['aoe', 'targeting'] },
  { caseId: 'team_counter_coordination', group: 'team', rounds: 10, focus: ['counter', 'coordination'] },
  { caseId: 'team_unknown_enemy_adaptation', group: 'team', rounds: 10, focus: ['limited_information', 'adaptation'] },
  { caseId: 'raid_balanced', group: 'raid', rounds: 5, focus: ['balanced', 'seven_vs_seven'] },
  { caseId: 'raid_level_gap', group: 'raid', rounds: 5, focus: ['level_gap', 'seven_vs_seven'] },
  { caseId: 'raid_control_heavy', group: 'raid', rounds: 5, focus: ['control', 'seven_vs_seven'] },
  { caseId: 'raid_summon_heavy', group: 'raid', rounds: 5, focus: ['summon', 'seven_vs_seven'] },
  { caseId: 'summon_one_window', group: 'special', rounds: 6, focus: ['summon', 'lifecycle'] },
  { caseId: 'item_creation_consumption', group: 'special', rounds: 8, focus: ['creation', 'inventory', 'consumer'] },
  { caseId: 'equipment_switch_no_loop', group: 'special', rounds: 8, focus: ['equipment', 'loop_prevention'] },
  { caseId: 'intent_capture_vs_kill', group: 'special', rounds: 8, focus: ['battle_intent', 'terminal'] },
];

const requiredEventKinds = Object.freeze({
  team_control_overlap: ['state_apply'],
  team_counter_coordination: ['counter_window'],
  raid_control_heavy: ['state_apply'],
  raid_summon_heavy: ['summon_create'],
  summon_one_window: ['summon_create'],
  item_creation_consumption: ['create', 'item_consume', 'resource_change'],
  equipment_switch_no_loop: ['complete'],
});
const candidateRelations = Object.freeze(['SELECTED_IS_LEGAL', 'SCORE_AUDIT_SELECTED_AND_TWO_ALTERNATIVES']);
const forbiddenSelections = Object.freeze(['HARD_INVALID', 'DOMINATED', 'ZERO_EFFECT_COSTLY', 'SELF_DEFEATING', 'SUMMON_NO_ACTION_WINDOW', 'ZERO_PROGRESS']);
const mutationRelations = Object.freeze(['INPUT_IMMUTABLE']);

export const manualBattleCases = Object.freeze(manualBattleCaseDefinitions.map(item => Object.freeze({
  ...item,
  candidateRelations,
  forbiddenSelections,
  requiredFacts: Object.freeze([
    Object.freeze({ kind: 'event', eventKind: 'action_start' }),
    Object.freeze({ kind: 'block', blockType: 'ROUND_SUMMARY' }),
    ...(requiredEventKinds[item.caseId] || []).map(eventKind => Object.freeze({ kind: 'event', eventKind })),
  ]),
  mutationRelations,
})));

export const determinismCaseIds = Object.freeze([
  'duel_overmatch_lethal',
  'team_control_overlap',
  'raid_balanced',
  'summon_one_window',
  'item_creation_consumption',
]);

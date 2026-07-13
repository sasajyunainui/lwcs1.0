export const manualSourceDataHashes = Object.freeze({
  谢邂: 'd0cb5162e4989c9c459848ee99b1ffe90c015a032130d2dfa8a4955983466284',
  王金玺: '2d2412e037aba25325c5b8c994434cff5d49d7c260439f9c0609088c50254041',
  韦小枫: '1790a1a539684385f2c235788343bc402efd33bbbd29ab220d05b011997d9df6',
  舞长空: '0a268620023e9dcb26835fdb5652454ecc0ea2c45187f29f9b355e1b6d9e347c',
  古月: '384c2eae7fff97e66f1e0ea68a0e13113025b1de1d6ad5fcb11bef32ed1c8cd0',
  云冥: '6d8067721ceb94b4e8e36510102447fd3e2581a3eec4eca606f1ab2910bf5ede',
  徐笠智: 'aa38b0bdecad9f2fda9a6ec724aa904cce5a640967299c12c08a6bf5ab37001e',
  唐舞麟: 'ff5d9daf6e7c11cdbeaf03b93815990bb965edd1b476d4f7639cb11a04e4524a',
  龙跃: '46e85a81619c8573601aa0c020ef5c2ef8553e04b9308047d931eb7f645ea7fb',
  戴月炎: '4723ef3d2d8ccc727b870ee26ded1dcef9376b4eb8f71dc221abdd4aa6d6a6b3',
  苏沐: 'a4c691d60c6673aa148025b44179642300ec54416df0490a6ae4570b1fef4d4c',
  许小言: 'db04b86c21994e32bf0f5b299d351d891df99f1b7d73a7676ecea696a49edaf7',
  叶星澜: '385a7edef361f449e8e6e43c8a3fc6cb6643ba6d797cfd6eae9fb4878519dca5',
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
  team_counter_coordination: ['counter'],
  raid_control_heavy: ['state_apply'],
  raid_summon_heavy: ['summon_create'],
  summon_one_window: ['summon_create', 'summon_assist'],
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

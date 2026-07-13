import fs from 'node:fs';
import path from 'node:path';

const injectionMarker = '    BATTLE_RUNTIME.bindSettlementPrimitives({';

const fixtureExports = `
    root.__LWCS_EXPORT_BATTLE_RECORD_VISIBLE_TEXT__ = (result = null, activeTab = 'preview') => 导出战斗记录可见文本(result, activeTab);
    root.__LWCS_RENDER_BATTLE_REPORT_HTML__ = (line = '', context = {}) => 渲染公开战报HTML(line, context);
    root.__LWCS_RENDER_BATTLE_REPORT_BLOCKS_HTML__ = (blocks = [], context = {}) => 渲染公开战报BlocksHTML(blocks, context);
    root.__LWCS_BUILD_PUBLIC_REPORT_BLOCKS__ = (eventLedger = [], limit = 8, context = {}) => 构建事件账本公开战报Blocks(eventLedger, limit, context);
    root.__LWCS_BUILD_STRUCTURED_REPORT_BLOCKS__ = (eventLedger = [], decisionTrace = [], publicEntries = []) => BATTLE_RUNTIME.buildReportBlocks(eventLedger, decisionTrace, publicEntries);
    root.__LWCS_BUILD_BATTLE_LLM_SUMMARY__ = (eventLedger = [], finalSnapshot = {}, options = {}) => {
      const combatData = { 回合: Number(finalSnapshot?.round || 0), 参战者: { team_player: finalSnapshot?.team_player || [], team_enemy: finalSnapshot?.team_enemy || [] } };
      const aiSummaryInput = BATTLE_RUNTIME.buildFinalSummary(eventLedger, [], finalSnapshot, combatData).aiSummaryInput;
      return BATTLE_RUNTIME.buildAiNarrativeSummary(aiSummaryInput, options);
    };
    root.__LWCS_BUILD_BATTLE_ROUND_DASHBOARD__ = (result = null, context = {}) => BATTLE_RUNTIME.buildRoundOverview(result, context);
    root.__LWCS_RENDER_BATTLE_ROUND_DASHBOARD__ = (rows = []) => 渲染回合速览HTML(rows);
    root.__LWCS_RENDER_BATTLE_RESOLUTION_TRACE_HTML__ = (trace = [], decisionTrace = []) =>
      渲染分回合判定流程([
        ...构建因果链行动区块条目(trace, Array.isArray(decisionTrace) ? decisionTrace : []),
        ...构建判定流程展示数据(Array.isArray(decisionTrace) ? decisionTrace : [], [], { resolutionTrace: Array.isArray(trace) ? trace : [] }),
        ...构建因果链回合末聚合条目(trace),
      ]) + 渲染NarrativeDecision开发态摘要(decisionTrace, trace);
    root.__LWCS_RENDER_BATTLE_DECISION_ROWS_HTML__ = (rows = []) => 渲染分回合判定流程(Array.isArray(rows) ? rows : []);
    root.__LWCS_LIST_BATTLE_REGRESSION_FIXTURES__ = () => [...运行战斗回归夹具.toString().matchAll(/注册\\('([^']+)'/g)].map(match => match[1]);
    root.__LWCS_RUN_BATTLE_REGRESSION_FIXTURE_BATCH__ = (名称 = '') => 运行战斗回归夹具(名称);
    root.__LWCS_GENERATE_BATTLE_DECISION_SAMPLES__ = (数量 = 100) => 生成战斗判定样本文本(数量);
    root.__LWCS_DEBUG_BATTLE_SAMPLE_RESULT__ = (索引 = 1) => 生成战斗判定样本结果(索引);
    root.__LWCS_DEBUG_BATTLE_TRUSTED_TACTICAL_NARRATION_RESULT__ = () => 生成可信战术侧写调试结果();
    root.__LWCS_DEBUG_BATTLE_DIRECT_PRESSURE_TACTICAL_NARRATION_RESULT__ = () => 生成直攻压制战术侧写调试结果();
    root.__LWCS_DEBUG_BATTLE_LETHAL_TACTICAL_NARRATION_RESULT__ = () => 生成斩杀战术侧写调试结果();
    root.__LWCS_DEBUG_BATTLE_RESOURCE_PRESSURE_TACTICAL_NARRATION_RESULT__ = () => 生成资源压力战术侧写调试结果();
    root.__LWCS_DEBUG_BATTLE_PROTECT_ALLY_TACTICAL_NARRATION_RESULT__ = () => 生成保护协同战术侧写调试结果();
    root.__LWCS_DEBUG_BATTLE_TIE_BREAK_TACTICAL_NARRATION_RESULT__ = () => 生成同分破平战术侧写调试结果();
    root.__LWCS_DEBUG_BATTLE_AOE_TRACE_RESULT__ = () => 生成战斗AOE链路调试结果();
    root.__LWCS_DEBUG_BATTLE_NON_DAMAGE_AOE_TRACE_RESULT__ = () => 生成非伤害AOE链路调试结果();
    root.__LWCS_DEBUG_BATTLE_REPLAN_TRACE_RESULT__ = () => 生成战斗变招链路调试结果();
    root.__LWCS_DEBUG_BATTLE_SUMMON_NATURAL_RESULT__ = () => 生成自然召唤闭环调试结果();
    root.__LWCS_DEBUG_BATTLE_BOUND_SUMMON_NATURAL_RESULT__ = () => 生成自然召唤闭环调试结果({
      技能名: '本命兽契', 召唤单位类型: '本命召唤兽', 召唤物名称: '玄契灵兽', 消耗: '魂力:110 | 精神力:70',
      属性继承比例: { 力量: 0.78, 防御: 0.5, 敏捷: 0.72, 体力上限: 0.52, 魂力上限: 0.44, 精神力上限: 0.46 },
      敌人敏捷: 80, intentText: '使用【本命兽契】后观察本命召唤兽下一回合行动。', battleMode: 'bound_summon_closure', modeLabel: '本命召唤兽闭环',
    });
    root.__LWCS_DEBUG_BATTLE_SUMMON_DEFAULT_MODES_RESULT__ = () => 生成召唤默认模式调试结果();
    root.__LWCS_DEBUG_BATTLE_SECOND_COUNTER_RESULT__ = () => 生成二层防反闭环调试结果();
    root.__LWCS_DEBUG_BATTLE_STATE_TICK_AGGREGATION_RESULT__ = () => 生成回合末状态聚合调试结果();
    root.__LWCS_DEBUG_BATTLE_HOT_RESOURCE_TICK_AGGREGATION_RESULT__ = () => 生成回合末恢复资源聚合调试结果();
    root.__LWCS_DEBUG_BATTLE_STATE_RESISTED_RESULT__ = () => 生成状态抵抗闭环调试结果();
    root.__LWCS_DEBUG_BATTLE_STATE_IMMUNE_RESULT__ = () => 生成状态免疫闭环调试结果();
    root.__LWCS_DEBUG_BATTLE_SUMMON_ASSIST_RESULT__ = () => 生成普通召唤协同攻击调试结果();
    root.__LWCS_DEBUG_BATTLE_MULTI_SUMMON_ASSIST_RESULT__ = () => 生成多召唤协同攻击调试结果();
    root.__LWCS_DEBUG_BATTLE_TEAM_SUMMON_ACTION_RESULT__ = () => 生成团战召唤行动轴调试结果();
    root.__LWCS_DEBUG_BATTLE_AUTO_ACTOR_ACTION_RESULT__ = () => 生成自动行动起手闭环调试结果();
    root.__LWCS_DEBUG_BATTLE_FALLBACK_RESOURCE_RESULT__ = () => 生成保底资源回稳调试结果();
    root.__LWCS_DEBUG_BATTLE_NON_HOSTILE_REACTION_FILTER_RESULT__ = () => 生成非敌对动作不触发反应调试结果();
    root.__LWCS_DEBUG_BATTLE_TARGET_POOL_HARD_RULES_RESULT__ = () => 生成目标池硬规则调试结果();
    root.__LWCS_DEBUG_BATTLE_CAP_REACHED_RESULT__ = () => 生成上限拦截调试结果();
    root.__LWCS_DEBUG_BATTLE_STATE_LIFECYCLE_RESULT__ = () => 生成状态生命周期规则调试结果();
    root.__LWCS_DEBUG_BATTLE_DECLARED_TARGET_LOST_RESULT__ = () => 生成预声明目标丢失调试结果();
    root.__LWCS_DEBUG_BATTLE_MULTI_HOST_SUMMON_ASSIST_RESULT__ = () => 生成多宿主召唤协同调试结果();
    root.__LWCS_DEBUG_BATTLE_OPPOSING_SIDE_SUMMON_ASSIST_RESULT__ = () => 生成敌我双方召唤协同调试结果();
    root.__LWCS_DEBUG_BATTLE_OPPOSING_SIDE_SUMMON_ACTION_RESULT__ = () => 生成敌我双方自主召唤行动轴调试结果();
    root.__LWCS_DEBUG_BATTLE_SUMMON_CONTROL_PUBLIC_RESULT__ = () => 生成召唤精神控制公开战报调试结果();
    root.__LWCS_DEBUG_BATTLE_MULTI_SUMMON_CONTROL_RESULT__ = () => 生成多召唤精神负载调试结果();
`;

export function readBattleUiTestSource(root = process.cwd()) {
  const source = fs.readFileSync(path.resolve(root, 'lwcs/BattleUI_Module.js'), 'utf8');
  const fixtures = fs.readFileSync(path.resolve(root, 'lwcs/tools/battle_ui_test_fixture_bundle.js'), 'utf8');
  if (!source.includes(injectionMarker)) throw new Error('battle_ui_test_injection_marker_missing');
  return source.replace(injectionMarker, `${fixtures}\n${fixtureExports}\n${injectionMarker}`);
}

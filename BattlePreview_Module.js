/* BattlePreview_Module.js - Pure battle preview and capacity model. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_preview_shared_prototype_registry_missing');
  }
  const battleEventContract = root.__LWCS_BATTLE_EVENT_CONTRACT__;
  if (
    !battleEventContract ||
    battleEventContract.schemaVersion !== '8.3-battle-event-contract-1'
  ) {
    throw new Error('battle_preview_event_contract_missing');
  }

  const VERSION = '7.3-R6.3-preview-2';
  // A preview includes the declared skill plus any cooperative summon attacks
  // that settle in the same action. Twelve nodes is smaller than a valid
  // generated 3v3 action once several summons are active, so keep the safety
  // guard while allowing the complete bounded effect graph to resolve.
  const MAX_PREVIEW_NODES = 64;
  const MAX_RECURSION_DEPTH = 4;
  const effectHashCache = new WeakMap();
  const effectArrayHashCache = new WeakMap();
  const sharedEffectArrayHashCache = new Map();
  const MAX_SHARED_EFFECT_ARRAY_HASH_ENTRIES = 4096;
  const fusionMetadataCache = new WeakMap();
  const overlayUnitOriginCache = new WeakMap();
  const skillCostStagesCache = new WeakMap();
  const sharedSkillCostStagesCache = new Map();
  const MAX_SHARED_SKILL_COST_STAGE_ENTRIES = 4096;
  const stableHashImmutableCache = new WeakMap();
  let collectedEffectsCache = new WeakMap();
  let passiveSkillCollectionCache = new WeakMap();
  let normalizedObjectivesCache = new WeakMap();
  let withdrawalPressureUnitProfileCache = new WeakMap();
  const SKILL_COST_RESOURCE_KEYS = Object.freeze(['魂力', '精神力', '体力']);
  const SKILL_COST_RESOURCE_SET = new Set(SKILL_COST_RESOURCE_KEYS);
  const SKILL_COST_STAGE_META_KEYS = new Set([
    '形式', 'form', '单位', 'unit', '百分比', 'percentage', 'isPercentage',
    '资源', 'resource', '数值', '值', 'value', 'amount', '消耗', '非法项', 'errors',
  ]);
  const WORLD_ACTION_ASSESSMENT_SCHEMA = 'WorldActionAssessmentV1';
  const MAX_ENVIRONMENT_TICKS = 240;

  function skillCostResourceKey(resource = '') {
    const label = String(resource || '').trim();
    if (label === '魂力') return 'sp';
    if (label === '精神力') return 'men';
    if (label === '体力') return 'vit';
    return '';
  }

  function normalizeSkillCostForm(value = '') {
    const text = String(value || '').trim().toLowerCase();
    if (/百分|percent|percentage|ratio|比例/.test(text)) return 'percentage';
    if (/混合|mixed/.test(text)) return 'mixed';
    return 'absolute';
  }

  function formatSkillCostDiagnostic(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      const code = value.code || value.代码 || value.reason || value.原因 || '';
      const message = value.message || value.消息 || value.detail || value.详情 || '';
      if (code || message) return [code, message].filter(Boolean).join(':');
      try { return JSON.stringify(value); } catch (error) { return 'COST_DIAGNOSTIC_OBJECT'; }
    }
    return String(value);
  }

  function normalizeSkillCostIllegalItems(value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.map(formatSkillCostDiagnostic).filter(Boolean);
  }

  function skillCostCacheSignature(rawCost, context = {}, skill = {}) {
    return JSON.stringify([
      rawCost,
      context?.sourceCategory,
      context?.来源类别,
      context?.来源,
      context?.category,
      context?.source_category,
      context?.sourceType,
      context?.来源类型,
      context?.来源明细,
      context?.sourceDetail,
      context?.source_detail,
      context?.path,
      context?.写入路径,
      context?.writePath,
      context?.路径,
      context?.写入类型,
      context?.技能类型,
      context?.技能分类,
      context?.技能名,
      context?.魂技名,
      context?.name,
      context?.名称,
      context?.类型,
      context?.效果模式,
      context?.effectMode,
      context?.技能效果模式,
      context?.释放形态,
      context?.画面描述,
      context?.效果描述,
      context?.技能描述,
      context?.描述,
      context?.触发关键词,
      context?.关键词,
      context?.标签,
      context?.附带属性,
      context?.动作,
      context?.动作类型,
      context?.action,
      context?.actionKind,
      context?.actionType,
      context?.action_kind,
      context?.来源模块,
      context?.sourceModule,
      context?.外部动作,
      context?.actionContext,
      context?.forceTrueBody,
      context?.强制真身,
      context?.ringIndex,
      context?.魂环位,
      context?.ringSlot,
      context?.需求魂环数,
      context?.需求魂环槽位,
      context?.魂技槽位,
      context?.融合参与者,
      context?.fusionParticipantIds,
      context?.fusionPartnerIds,
      context?.融合模式,
      context?.fusionMode,
      context?.fusionUsageMode,
      !!(context?.融合技 && typeof context.融合技 === 'object' && Object.keys(context.融合技).length),
      skill?.来源类别,
      skill?.来源类型,
      skill?.内容类型,
      skill?.__战斗来源类别,
      skill?.来源明细,
      skill?.__战斗来源明细,
      skill?.写入路径,
      skill?.写入类型,
      skill?.path,
      skill?.路径,
      skill?.技能类型,
      skill?.技能分类,
      skill?.类型,
      skill?.魂技名,
      skill?.name,
      skill?.技能名,
      skill?.名称,
      skill?.效果模式,
      skill?.effectMode,
      skill?.技能效果模式,
      skill?.释放形态,
      skill?.画面描述,
      skill?.效果描述,
      skill?.技能描述,
      skill?.描述,
      skill?.触发关键词,
      skill?.关键词,
      skill?.标签,
      skill?.keywords,
      skill?.附带属性,
      skill?.forceTrueBody,
      skill?.强制真身,
      skill?.ringIndex,
      skill?.魂环位,
      skill?.ringSlot,
      skill?.需求魂环数,
      skill?.__魂技槽位,
      skill?.融合参与者,
      skill?.fusionParticipantIds,
      skill?.fusionPartnerIds,
      skill?.融合模式,
      skill?.fusionMode,
    ]);
  }

  function normalizeSkillCostPhase(phase, form = 'absolute', phaseName = '启动') {
    const values = {};
    const forms = {};
    const illegal = [];
    const phaseForm = normalizeSkillCostForm(form);
    const add = (resource, rawValue, metadata = {}) => {
      const resourceName = String(resource || '').trim();
      if (!SKILL_COST_RESOURCE_SET.has(resourceName)) {
        illegal.push(`COST_UNKNOWN_RESOURCE:${resourceName || 'missing'}:${phaseName}`);
        return;
      }
      let value = rawValue;
      let entryForm = phaseForm;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const entry = value;
        value = entry.值 ?? entry.数值 ?? entry.value ?? entry.amount ?? entry.消耗;
        metadata = { ...metadata, ...entry };
      }
      const text = String(value ?? '').trim();
      if (!text || text === '无') {
        illegal.push(`COST_VALUE_MISSING:${resourceName}:${phaseName}`);
        return;
      }
      const metadataForm = metadata.形式 ?? metadata.form ?? metadata.单位 ?? metadata.unit;
      if (metadata.百分比 === true || metadata.percentage === true || metadata.isPercentage === true || /百分|percent|percentage|ratio|比例/.test(String(metadataForm || '').toLowerCase())) {
        entryForm = 'percentage';
      }
      const hasPercentSign = /%$/.test(text);
      if (hasPercentSign) entryForm = 'percentage';
      const numericText = hasPercentSign ? text.slice(0, -1).trim() : text;
      const numeric = Number(numericText);
      if (!Number.isFinite(numeric) || numeric < 0) {
        illegal.push(`COST_VALUE_INVALID:${resourceName}:${text}:${phaseName}`);
        return;
      }
      if (entryForm === 'percentage' && numeric > 100 + 1e-9) {
        illegal.push(`COST_PERCENT_OUT_OF_RANGE:${resourceName}:${numeric}:${phaseName}`);
        return;
      }
      const previousForm = forms[resourceName];
      if (previousForm && previousForm !== entryForm) {
        illegal.push(`COST_MIXED_UNIT:${resourceName}:${phaseName}`);
        return;
      }
      forms[resourceName] = entryForm;
      const previous = values[resourceName];
      const previousNumber = previous === undefined
        ? 0
        : Number(String(previous).replace(/%$/, ''));
      const next = previousNumber + numeric;
      values[resourceName] = entryForm === 'percentage' ? `${next}%` : next;
    };
    const visit = input => {
      if (input === null || input === undefined || input === '' || input === '无') return;
      if (Array.isArray(input)) {
        input.forEach(entry => {
          if (!entry || typeof entry !== 'object') {
            illegal.push(`COST_PHASE_ENTRY_INVALID:${phaseName}`);
            return;
          }
          const resource = entry.资源 ?? entry.resource;
          const value = entry.值 ?? entry.数值 ?? entry.value ?? entry.amount ?? entry.消耗;
          add(resource, value, entry);
        });
        return;
      }
      if (typeof input !== 'object') {
        illegal.push(`COST_PHASE_SHAPE_INVALID:${phaseName}`);
        return;
      }
      if (input.资源 !== undefined || input.resource !== undefined) {
        add(input.资源 ?? input.resource, input.值 ?? input.数值 ?? input.value ?? input.amount ?? input.消耗, input);
        return;
      }
      const directEntries = Object.entries(input).filter(([key]) => !SKILL_COST_STAGE_META_KEYS.has(key));
      if (!directEntries.length && Object.keys(input).some(key => ['值', '数值', 'value', 'amount', '消耗'].includes(key))) {
        illegal.push(`COST_RESOURCE_MISSING:${phaseName}`);
        return;
      }
      directEntries.forEach(([resource, value]) => add(resource, value));
    };
    visit(phase);
    const usedForms = [...new Set(Object.values(forms))];
    const resolvedForm = usedForms.length > 1 ? 'mixed' : usedForms[0] || phaseForm;
    if (usedForms.length > 1) illegal.push(`COST_MIXED_UNIT:${phaseName}`);
    return {
      values: Object.freeze(values),
      form: resolvedForm,
      illegal: Object.freeze([...new Set(illegal)]),
    };
  }

  function readSkillCostStages(skillOrCost = {}, context = {}) {
    const isSkill = skillOrCost && typeof skillOrCost === 'object' && !Array.isArray(skillOrCost) && (
      Object.prototype.hasOwnProperty.call(skillOrCost, '消耗') ||
      Array.isArray(skillOrCost?._效果数组) ||
      Array.isArray(skillOrCost?.使用效果) ||
      Object.prototype.hasOwnProperty.call(skillOrCost, '承载方式') ||
      Object.prototype.hasOwnProperty.call(skillOrCost, '魂技名')
    );
    const skill = isSkill ? skillOrCost : {};
    const contextSkill = Object.keys(skill).length
      ? skill
      : context?.技能 || context?.skill || context?.技能数据 || {};
    const rawCost = isSkill
      ? skill.消耗
      : skillOrCost;
    const helper = root.__LWCS_SKILL_COST_HELPERS_V1__;
    const parser = helper?.解析技能阶段消耗_V1;
    const isEmptyCost = rawCost === undefined || rawCost === null || rawCost === '' || rawCost === '无';
    if (typeof parser !== 'function') {
      return Object.freeze({
        启动: Object.freeze({}),
        维持: Object.freeze({}),
        形式: 'absolute',
        非法项: Object.freeze(isEmptyCost ? [] : ['COST_PARSER_UNAVAILABLE']),
      });
    }
    const parserContext = {
        ...context,
        技能: contextSkill,
        技能类型: context?.技能类型 ?? context?.skillType ?? context?.技能类型名称 ?? contextSkill?.技能类型 ?? contextSkill?.技能分类 ?? contextSkill?.类型 ?? '',
        技能分类: context?.技能分类 ?? context?.semantic_role ?? contextSkill?.技能分类 ?? contextSkill?.技能类型 ?? '',
        承载方式: context?.承载方式 ?? context?.deliveryMode ?? contextSkill?.承载方式 ?? '',
        来源类别: context?.来源类别 ?? context?.sourceCategory ?? context?.category ?? context?.source_category ?? contextSkill?.来源类别 ?? contextSkill?.来源类型 ?? contextSkill?.内容类型 ?? contextSkill?.__战斗来源类别,
        sourceCategory: context?.sourceCategory ?? context?.来源类别 ?? context?.category ?? context?.source_category ?? contextSkill?.来源类别 ?? contextSkill?.来源类型 ?? contextSkill?.内容类型 ?? contextSkill?.__战斗来源类别,
        来源明细: context?.来源明细 ?? context?.sourceDetail ?? context?.source_detail ?? contextSkill?.来源明细 ?? contextSkill?.__战斗来源明细,
        sourceDetail: context?.sourceDetail ?? context?.来源明细 ?? context?.source_detail ?? contextSkill?.来源明细 ?? contextSkill?.__战斗来源明细,
        forceTrueBody: context?.forceTrueBody ?? contextSkill?.forceTrueBody,
        强制真身: context?.强制真身 ?? contextSkill?.强制真身,
        魂环位: context?.魂环位 ?? context?.ringIndex ?? context?.ringSlot ?? context?.魂技槽位 ?? context?.需求魂环数 ?? contextSkill?.魂环位 ?? contextSkill?.ringIndex ?? contextSkill?.ringSlot ?? contextSkill?.__魂技槽位,
        ringIndex: context?.ringIndex ?? context?.魂环位 ?? contextSkill?.ringIndex ?? contextSkill?.魂环位,
        ringSlot: context?.ringSlot ?? context?.魂环位 ?? contextSkill?.ringSlot ?? contextSkill?.魂环位,
        魂技槽位: context?.魂技槽位 ?? context?.ringSlot ?? context?.魂环位 ?? contextSkill?.魂技槽位 ?? contextSkill?.__魂技槽位,
        融合参与者: context?.融合参与者 ?? context?.fusionParticipantIds ?? context?.fusionPartnerIds ?? contextSkill?.融合参与者 ?? contextSkill?.fusionParticipantIds ?? contextSkill?.fusionPartnerIds,
        fusionParticipantIds: context?.fusionParticipantIds ?? context?.融合参与者 ?? context?.fusionPartnerIds ?? contextSkill?.fusionParticipantIds ?? contextSkill?.融合参与者 ?? contextSkill?.fusionPartnerIds,
        融合模式: context?.融合模式 ?? context?.fusionMode ?? context?.fusionUsageMode ?? contextSkill?.融合模式 ?? contextSkill?.fusionMode,
        fusionMode: context?.fusionMode ?? context?.融合模式 ?? context?.fusionUsageMode ?? contextSkill?.fusionMode ?? contextSkill?.融合模式,
    };
    if (!contextSkill || typeof contextSkill !== 'object' || !Object.keys(contextSkill).length) {
      delete parserContext.技能;
    }
    const cacheSignature = isSkill
      ? skillCostCacheSignature(rawCost, parserContext, contextSkill)
      : '';
    if (isSkill) {
      const cached = skillCostStagesCache.get(contextSkill)?.get(cacheSignature);
      if (cached) {
        metrics.skillCostStageCacheHits += 1;
        return cached;
      }
      const sharedCached = sharedSkillCostStagesCache.get(cacheSignature);
      if (sharedCached) {
        metrics.skillCostStageCacheHits += 1;
        metrics.skillCostStageSharedCacheHits += 1;
        const cachedByContext = skillCostStagesCache.get(contextSkill) || new Map();
        cachedByContext.set(cacheSignature, sharedCached);
        skillCostStagesCache.set(contextSkill, cachedByContext);
        return sharedCached;
      }
      metrics.skillCostStageCacheMisses += 1;
    }
    let parsed;
    try {
      parsed = parser(rawCost, parserContext);
    } catch (error) {
      return Object.freeze({
        启动: Object.freeze({}),
        维持: Object.freeze({}),
        形式: 'invalid',
        非法项: Object.freeze([`COST_PARSER_THROW:${error?.message || error}`]),
      });
    }
    if (!parsed || typeof parsed !== 'object') {
      return Object.freeze({
        启动: Object.freeze({}),
        维持: Object.freeze({}),
        形式: 'invalid',
        非法项: Object.freeze(['COST_PARSER_RESULT_INVALID']),
      });
    }
    const parsedForm = normalizeSkillCostForm(parsed.形式 || parsed.form || 'absolute');
    const startup = normalizeSkillCostPhase(parsed.启动 ?? parsed.startup ?? {}, parsedForm, '启动');
    const sustain = normalizeSkillCostPhase(parsed.维持 ?? parsed.sustain ?? {}, parsedForm, '维持');
    const illegal = [
      ...normalizeSkillCostIllegalItems(parsed.非法项 ?? parsed.errors),
      ...startup.illegal,
      ...sustain.illegal,
    ];
    const normalizedResult = Object.freeze({
      启动: startup.values,
      维持: sustain.values,
      形式: illegal.length ? 'invalid' : parsedForm,
      非法项: Object.freeze([...new Set(illegal)]),
    });
    if (isSkill) {
      const cachedByContext = skillCostStagesCache.get(contextSkill) || new Map();
      cachedByContext.set(cacheSignature, normalizedResult);
      skillCostStagesCache.set(contextSkill, cachedByContext);
      sharedSkillCostStagesCache.set(cacheSignature, normalizedResult);
      while (sharedSkillCostStagesCache.size > MAX_SHARED_SKILL_COST_STAGE_ENTRIES) {
        sharedSkillCostStagesCache.delete(sharedSkillCostStagesCache.keys().next().value);
        metrics.skillCostStageSharedCacheEvictions += 1;
      }
    }
    return normalizedResult;
  }

  function normalizeSkillCostMap(costs = {}, form = 'absolute', phaseName = '启动') {
    const normalized = normalizeSkillCostPhase(costs, form, phaseName);
    return Object.freeze({
      values: normalized.values,
      形式: normalized.form,
      非法项: normalized.illegal,
    });
  }

  function readSkillStartupCosts(skill = {}, context = {}) {
    const stages = readSkillCostStages(skill, context);
    return Object.freeze({ costs: stages.启动, stages, 非法项: stages.非法项 });
  }

  function readSkillSustainCosts(value = {}, context = {}) {
    const stages = readSkillCostStages(value, { ...context, 阶段: '维持消耗字段' });
    return Object.freeze({ costs: stages.维持, stages, 非法项: stages.非法项 });
  }

  function assessResourcePayment(payers = [], costs = {}, options = {}) {
    const normalized = normalizeSkillCostMap(costs, options?.形式 || 'absolute', options?.阶段 || '启动');
    const illegal = [...normalized.非法项];
    const uniquePayers = [];
    const seenPayers = new Set();
    (Array.isArray(payers) ? payers : [payers]).forEach((payer, index) => {
      if (!payer || typeof payer !== 'object') {
        illegal.push(`COST_PAYER_INVALID:${index}`);
        return;
      }
      const identity = unitId(payer) || `@${index}`;
      if (seenPayers.has(identity)) return;
      seenPayers.add(identity);
      uniquePayers.push(payer);
    });
    if (!uniquePayers.length && Object.keys(normalized.values).length) illegal.push('COST_PAYER_MISSING');
    if (illegal.length) {
      return Object.freeze({
        valid: false,
        ok: false,
        reason: `COST_INVALID:${[...new Set(illegal)].join('|')}`,
        非法项: Object.freeze([...new Set(illegal)]),
        payments: Object.freeze([]),
        costs: normalized.values,
      });
    }
    const payments = [];
    const resourceOverrides = options?.resourceOverrides && typeof options.resourceOverrides === 'object'
      ? options.resourceOverrides
      : {};
    for (const payer of uniquePayers) {
      for (const [resource, rawCost] of Object.entries(normalized.values)) {
        const key = skillCostResourceKey(resource);
        const maximum = readResourceMax(payer, resource);
        const text = String(rawCost ?? '').trim();
        const numeric = Number(text.replace(/%$/, ''));
        const amount = text.endsWith('%') ? maximum * numeric / 100 : numeric;
        const identity = unitId(payer) || unitName(payer) || 'unknown';
        if (!key || !Number.isFinite(amount) || amount < 0) {
          illegal.push(`COST_VALUE_INVALID:${resource}:${identity}`);
          continue;
        }
        const available = Object.prototype.hasOwnProperty.call(resourceOverrides, resource)
          ? Number(resourceOverrides[resource])
          : readResource(payer, resource);
        if (!Number.isFinite(available)) {
          illegal.push(`COST_RESOURCE_VALUE_INVALID:${resource}:${identity}`);
          continue;
        }
        payments.push(Object.freeze({ payer, payerId: identity, resource, key, rawCost, amount, maximum, before: available, after: available - amount }));
      }
    }
    if (illegal.length) {
      return Object.freeze({ valid: false, ok: false, reason: `COST_INVALID:${[...new Set(illegal)].join('|')}`, 非法项: Object.freeze([...new Set(illegal)]), payments: Object.freeze([]), costs: normalized.values });
    }
    const insufficient = payments.find(payment => payment.before + 1e-9 < payment.amount);
    if (insufficient) {
      return Object.freeze({
        valid: true,
        ok: false,
        reason: `RESOURCE_INSUFFICIENT:${insufficient.resource}:${insufficient.payerId}`,
        非法项: Object.freeze([]),
        payments: Object.freeze(payments),
        costs: normalized.values,
      });
    }
    return Object.freeze({ valid: true, ok: true, reason: '', 非法项: Object.freeze([]), payments: Object.freeze(payments), costs: normalized.values });
  }

  function formatSkillCostPhase(costs = {}) {
    return Object.entries(costs || {})
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '0')
      .map(([resource, value]) => `${resource}:${typeof value === 'number' ? Math.round(value * 100) / 100 : String(value).trim()}`)
      .join('；');
  }

  function formatSkillCostStages(value = {}, context = {}) {
    const rawStages = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '启动')
      ? value
      : readSkillCostStages(value, context);
    const parsedForm = normalizeSkillCostForm(rawStages?.形式 || rawStages?.form || 'absolute');
    const startup = normalizeSkillCostPhase(rawStages?.启动 || rawStages?.startup || {}, parsedForm, '启动');
    const sustain = normalizeSkillCostPhase(rawStages?.维持 || rawStages?.sustain || {}, parsedForm, '维持');
    const stages = {
      启动: startup.values,
      维持: sustain.values,
      非法项: [
        ...normalizeSkillCostIllegalItems(rawStages?.非法项 ?? rawStages?.errors),
        ...startup.illegal,
        ...sustain.illegal,
      ],
    };
    if (stages?.非法项?.length) return `不可用：消耗非法（${stages.非法项.join('；')}）`;
    const startupText = formatSkillCostPhase(stages.启动);
    const sustainText = formatSkillCostPhase(stages.维持);
    const parts = [`启动：${startupText || '无'}`];
    if (sustainText) parts.push(`维持：每回合${sustainText}`);
    return parts.join('；');
  }
  const battlePrototypes = new Set([
    '伤害结算', '资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '结算修正',
    '炸环', '状态施加', '时窗修正', '状态移除', '规则防御', '状态转移', '状态交换',
    '资源锁定', '规则改写', '机制抹消', '机制授予', '复制执行', '时光回溯', '位移执行',
    '决策干扰', '召唤生成',
  ]);
  const nonBattlePrototypes = new Set(['修炼增益', '战斗外复活']);
  const BASIC_ATTACK_EFFECT = Object.freeze({
    原型: '伤害结算',
    目标: '单体',
    威力倍率: 50,
    伤害类型: '近身攻击',
    生效方式: '独立生效',
  });
  const outcomeComponents = Object.freeze({
    HP_DELTA: 'IMMEDIATE_STATE',
    SHIELD_DELTA: 'IMMEDIATE_STATE',
    SCHEDULED_HP_DELTA: 'SCHEDULED_STATE',
    ACTION_GRANTED: 'ACTION_ECONOMY',
    ACTION_CANCELLED: 'ACTION_ECONOMY',
    NEXT_ACTION_QUALITY_CHANGED: 'FUTURE_OPTION',
    RESOURCE_OPTION_CHANGED: 'RESOURCE_OPTION',
    INFORMATION_REVEALED: 'INFORMATION',
    BELIEF_CHANGED: 'BELIEF_STATE',
    IRREVERSIBLE_ASSET_LOST: 'IRREVERSIBLE_COST',
    TAIL_FAILURE: 'TAIL_RISK',
    CHAIN_CONFLICT: 'CHAIN_CONFLICT',
    STATE_CHANGED: 'STATE_DELTA',
    STATE_SCHEDULED: 'SCHEDULED_STATE',
    RULE_CHANGED: 'RULE_DELTA',
    SUMMON_WINDOW: 'SCHEDULED_STATE',
    WITHDRAWAL_CONTEST: 'OBJECTIVE_TERMINAL',
  });
  const effectArrayFields = Object.freeze([
    '_效果数组',
    ...(Array.isArray(sharedRegistry?.嵌套效果数组字段) ? sharedRegistry.嵌套效果数组字段 : []),
    ...(Array.isArray(sharedRegistry?.条件分支效果数组字段) ? sharedRegistry.条件分支效果数组字段 : []),
  ]);

  const metrics = {
    previewCalls: 0,
    cacheHits: 0,
    routeScalarBatchBuilds: 0,
    routeScalarEvaluations: 0,
    routeScalarFallbacks: 0,
    routeScalarOutcomeRows: 0,
    overlayWrites: 0,
    fullCloneCalls: 0,
    maxNodesObserved: 0,
    stableHashCalls: 0,
    stableHashChars: 0,
    stableHashSortedKeyBypasses: 0,
    stableHashCacheHits: 0,
    stableHashImmutableCacheHits: 0,
    effectArrayHashIdentityHits: 0,
    effectArrayHashSharedHits: 0,
    effectArrayHashMisses: 0,
    effectArrayHashSharedEvictions: 0,
    operationGraphBuilds: 0,
    resourceOutcomeBranchReplays: 0,
    resourceOutcomeBranchStates: 0,
    resourceOutcomeBranchMaxStates: 0,
    resourceOutcomeUnrepresentedDamagePrefixes: 0,
    resourceOutcomeDamagePrefixReplays: 0,
    resourceOutcomeDamagePrefixStates: 0,
    operationGraphEvaluations: 0,
    operationGraphEventApplications: 0,
    operationGraphStateExpansions: 0,
    operationGraphStateMerges: 0,
    cacheClears: 0,
    cacheEvictions: 0,
    skillCostStageCacheHits: 0,
    skillCostStageCacheMisses: 0,
    skillCostStageSharedCacheHits: 0,
    skillCostStageSharedCacheEvictions: 0,
    mechanicalProjectionProfileIdentityReuses: 0,
    mechanicalProjectionProfileBuilds: 0,
    passiveSkillCollectionCacheHits: 0,
    passiveSkillCollectionBuilds: 0,
    collectEffectsCacheHits: 0,
    collectEffectsBuilds: 0,
  };
  const MAX_PREVIEW_CACHE_ENTRIES = 1024;
  const previewCache = new Map();
  let builtDamageBasisCache = new WeakSet();
  let validatedDamageBasisCache = new WeakSet();
  const worldActionContextBindings = new WeakMap();
  let activeWorldActionContextBinding = null;
  const unitIdCache = new WeakMap();
  const unitNameCache = new WeakMap();
  const dependencyCaptureStack = [];
  let activePreviewDependencyCapture = null;
  // 预演自造召唤物的依赖键：这些实体随路线重放重新生成，不构成对外部世界的依赖
  const PREVIEW_SUMMON_DEPENDENCY_KEY = /^(?:unit|target):preview-summon:/;
  const PAYMENT_ROLE_DEPENDENCY_KEY =
    /^unit:[^:]+:resource(?:Max)?:[^:]+$/u;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function cloneValue(value) {
    if (value === null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor?.name === 'Object');
  }

  function validIdentityString(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 512 &&
      !/[\u0000-\u001F\u007F]/.test(value);
  }

  function canonicalActionId(declaration, fallback = '') {
    if (declaration === undefined) return fallback;
    if (!isPlainRecord(declaration)) throw new TypeError('battle_preview_declaration_invalid');
    if (!Object.prototype.hasOwnProperty.call(declaration, 'actionId') || declaration.actionId === undefined) {
      return fallback;
    }
    if (!validIdentityString(declaration.actionId)) {
      throw new TypeError('battle_preview_action_id_invalid');
    }
    return declaration.actionId;
  }

  function canonicalEffectId(effect, rootActionId, index) {
    if (effect === undefined) return rootActionId + ':effect:' + index;
    if (!isPlainRecord(effect)) throw new TypeError('battle_preview_effect_invalid');
    const hasEffectId = Object.prototype.hasOwnProperty.call(effect, 'effectId') && effect.effectId !== undefined;
    const hasChineseId = Object.prototype.hasOwnProperty.call(effect, '效果ID') && effect['效果ID'] !== undefined;
    const effectId = hasEffectId ? effect.effectId : null;
    const chineseId = hasChineseId ? effect['效果ID'] : null;
    if ((hasEffectId && !validIdentityString(effectId)) ||
      (hasChineseId && !validIdentityString(chineseId))) {
      throw new TypeError('battle_preview_effect_id_invalid');
    }
    if (hasEffectId && hasChineseId && effectId !== chineseId) {
      throw new TypeError('battle_preview_effect_id_conflict');
    }
    return hasEffectId ? effectId : hasChineseId ? chineseId : rootActionId + ':effect:' + index;
  }

  function recordPreviewDependency(
    key = '',
    value = null,
    dependencyRole = 'MECHANICAL',
  ) {
    const capture = activePreviewDependencyCapture;
    if (!capture) return;
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    // 预演召唤物的读取不记依赖：其 id 只存在于候选自身的 overlay 里；一旦记入
    // dependencyKeys，会话复用重定基会拿它对真实世界求哈希，unit() 解析直接抛
    // battle_decision_dependency_unit_missing（B1-P0，raid 决策33 实测复现）。
    if (PREVIEW_SUMMON_DEPENDENCY_KEY.test(normalizedKey)) return;
    if (!capture.reads.has(normalizedKey)) {
      capture.reads.set(normalizedKey, cloneValue(value));
    }
    if (PAYMENT_ROLE_DEPENDENCY_KEY.test(normalizedKey)) {
      const role = String(
        capture?.roleStack?.[capture.roleStack.length - 1] || dependencyRole,
      ).trim().toUpperCase() || 'MECHANICAL';
      if (!(capture.dependencyRoles instanceof Map)) {
        capture.dependencyRoles = new Map();
      }
      const roles = capture.dependencyRoles.get(normalizedKey) || new Set();
      roles.add(role);
      capture.dependencyRoles.set(normalizedKey, roles);
    }
    if (typeof capture.recorder === 'function') {
      capture.recorder(normalizedKey, value);
    }
  }

  function withPreviewDependencyRole(role, callback) {
    const capture = activePreviewDependencyCapture;
    if (!capture || typeof callback !== 'function') return callback();
    if (!Array.isArray(capture.roleStack)) capture.roleStack = [];
    capture.roleStack.push(String(role || 'MECHANICAL').trim().toUpperCase());
    try {
      return callback();
    } finally {
      capture.roleStack.pop();
    }
  }

  function cloneUnitForOverlay(unit = {}, copyInventory = true) {
    const cloneStates = states => {
      if (Array.isArray(states)) return states.map(state => state && typeof state === 'object' ? cloneValue(state) : state);
      if (states && typeof states === 'object') return Object.fromEntries(Object.entries(states).map(([key, state]) => [key, cloneValue(state)]));
      return states;
    };
    const attribute = unit?.属性 && typeof unit.属性 === 'object' ? cloneValue(unit.属性) : unit?.属性;
    const directStates = unit?.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : attribute?.状态效果;
    const clone = {
      ...unit,
      属性: attribute,
      状态: unit?.状态 && typeof unit.状态 === 'object' ? { ...unit.状态 } : unit?.状态,
      final: unit?.final && typeof unit.final === 'object' ? { ...unit.final } : unit?.final,
      __battleRuntime: unit?.__battleRuntime && typeof unit.__battleRuntime === 'object'
        ? cloneValue(unit.__battleRuntime)
        : unit?.__battleRuntime,
      状态效果: cloneStates(directStates),
      持续效果: unit?.持续效果 && typeof unit.持续效果 === 'object' ? cloneValue(unit.持续效果) : unit?.持续效果,
      背包: copyInventory && unit?.背包 && typeof unit.背包 === 'object' ? cloneValue(unit.背包) : unit?.背包,
      库存: copyInventory && unit?.库存 && typeof unit.库存 === 'object' ? cloneValue(unit.库存) : unit?.库存,
      物品: copyInventory && unit?.物品 && typeof unit.物品 === 'object' ? cloneValue(unit.物品) : unit?.物品,
      战斗物品: copyInventory && unit?.战斗物品 && typeof unit.战斗物品 === 'object' ? cloneValue(unit.战斗物品) : unit?.战斗物品,
    };
    overlayUnitOriginCache.set(clone, overlayUnitOriginCache.get(unit) || unit);
    return clone;
  }

  function overlayOriginUnit(unit = {}) {
    return overlayUnitOriginCache.get(unit) || null;
  }

  function inheritOverlayOrigin(unit = {}, source = {}) {
    if (!unit || typeof unit !== 'object' || !source || typeof source !== 'object') return unit;
    overlayUnitOriginCache.set(unit, overlayUnitOriginCache.get(source) || source);
    return unit;
  }

  function stableHash(value) {
    if (value && typeof value === 'object') {
      const immutableCached = stableHashImmutableCache.get(value);
      if (immutableCached) {
        if (Array.isArray(value)) metrics.stableHashCacheHits += 1;
        else metrics.stableHashImmutableCacheHits += 1;
        return immutableCached;
      }
    }
    metrics.stableHashCalls += 1;
    let hash = 2166136261;
    let characterCount = 0;
    let fullyFrozen = true;
    const update = text => {
      characterCount += text.length;
      let currentHash = hash;
      let index = 0;
      const unrolledEnd = text.length - text.length % 4;
      for (; index < unrolledEnd; index += 4) {
        currentHash ^= text.charCodeAt(index);
        currentHash = Math.imul(currentHash, 16777619);
        currentHash ^= text.charCodeAt(index + 1);
        currentHash = Math.imul(currentHash, 16777619);
        currentHash ^= text.charCodeAt(index + 2);
        currentHash = Math.imul(currentHash, 16777619);
        currentHash ^= text.charCodeAt(index + 3);
        currentHash = Math.imul(currentHash, 16777619);
      }
      for (; index < text.length; index += 1) {
        currentHash ^= text.charCodeAt(index);
        currentHash = Math.imul(currentHash, 16777619);
      }
      hash = currentHash;
    };
    const visit = (item, undefinedText) => {
      if (Array.isArray(item)) {
        if (!Object.isFrozen(item)) fullyFrozen = false;
        update('[');
        for (let index = 0; index < item.length; index += 1) {
          if (index > 0) update(',');
          if (Object.hasOwn(item, index)) {
            if (fullyFrozen && !Object.hasOwn(Object.getOwnPropertyDescriptor(item, index), 'value')) fullyFrozen = false;
            visit(item[index], '');
          }
        }
        update(']');
        return;
      }
      if (item && typeof item === 'object') {
        if (!Object.isFrozen(item)) fullyFrozen = false;
        update('{');
        const keys = Object.keys(item);
        let alreadySorted = true;
        for (let index = 1; index < keys.length; index += 1) {
          if (keys[index - 1] > keys[index]) {
            alreadySorted = false;
            break;
          }
        }
        if (alreadySorted) metrics.stableHashSortedKeyBypasses += 1;
        else keys.sort();
        keys.forEach((key, index) => {
          if (fullyFrozen && !Object.hasOwn(Object.getOwnPropertyDescriptor(item, key), 'value')) fullyFrozen = false;
          if (index > 0) update(',');
          update(JSON.stringify(key));
          update(':');
          visit(item[key], 'undefined');
        });
        update('}');
        return;
      }
      const serialized = JSON.stringify(item);
      if (serialized === undefined && undefinedText === null) {
        throw new TypeError('battle_preview_stable_hash_value_not_serializable');
      }
      update(serialized === undefined ? undefinedText : serialized);
    };
    if (typeof value === 'string') update(value);
    else visit(value, null);
    metrics.stableHashChars += characterCount;
    const result = (hash >>> 0).toString(36);
    if (fullyFrozen && value && typeof value === 'object') {
      stableHashImmutableCache.set(value, result);
    }
    return result;
  }

  function effectArrayHash(effects) {
    if (!Array.isArray(effects)) return '';
    const cached = effectArrayHashCache.get(effects);
    if (cached) {
      metrics.effectArrayHashIdentityHits += 1;
      return cached;
    }
    let contentKey = '';
    let jsonSafe = true;
    let rootHolder = null;
    try {
      contentKey = JSON.stringify(effects, function detectNonJsonValue(key, value) {
        if (rootHolder === null) rootHolder = this;
        const original = this === rootHolder && key === '' ? effects : this?.[key];
        const type = typeof original;
        if (
          original === undefined || type === 'function' || type === 'symbol' || type === 'bigint' ||
          (original && type === 'object' && !Array.isArray(original) && !isPlainRecord(original))
        ) {
          jsonSafe = false;
        }
        return value;
      });
    } catch (_error) {
      jsonSafe = false;
    }
    if (!jsonSafe || typeof contentKey !== 'string') contentKey = '';
    if (contentKey) {
      const shared = sharedEffectArrayHashCache.get(contentKey);
      if (shared) {
        metrics.effectArrayHashSharedHits += 1;
        return shared;
      }
    }
    metrics.effectArrayHashMisses += 1;
    const result = stableHash(effects);
    if (stableHashImmutableCache.has(effects)) effectArrayHashCache.set(effects, result);
    if (contentKey) {
      sharedEffectArrayHashCache.set(contentKey, result);
      while (sharedEffectArrayHashCache.size > MAX_SHARED_EFFECT_ARRAY_HASH_ENTRIES) {
        sharedEffectArrayHashCache.delete(sharedEffectArrayHashCache.keys().next().value);
        metrics.effectArrayHashSharedEvictions += 1;
      }
    }
    return result;
  }

  function unitId(unit = {}) {
    if (unit && typeof unit === 'object') {
      const cached = unitIdCache.get(unit);
      if (cached) return cached;
      const result = String(unit?.召唤键 || unit?.id || unit?.角色ID || unit?.uid || unit?.name || unit?.名称 || '').trim();
      if (result) unitIdCache.set(unit, result);
      return result;
    }
    return '';
  }

  function unitName(unit = {}) {
    if (unit && typeof unit === 'object') {
      const cached = unitNameCache.get(unit);
      if (cached) return cached;
      const result = String(unit?.name || unit?.名称 || unitId(unit) || '未知单位').trim();
      if (result) unitNameCache.set(unit, result);
      return result;
    }
    return '未知单位';
  }

  function readNumber(unit = {}, keys = [], fallback = 0) {
    const finalStats = unit?.final && typeof unit.final === 'object' ? unit.final : {};
    const sourceStats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {};
    for (const key of keys) {
      const direct = Number(unit?.[key]);
      if (Number.isFinite(direct)) return direct;
      const fromFinal = Number(finalStats?.[key]);
      if (Number.isFinite(fromFinal)) return fromFinal;
      const fromSource = Number(sourceStats?.[key]);
      if (Number.isFinite(fromSource)) return fromSource;
    }
    return Number(fallback) || 0;
  }

  function defenseDependencyValue(unit = {}) {
    const states = unit?.状态效果;
    const stateValues = Array.isArray(states)
      ? states
      : states && typeof states === 'object'
        ? Object.values(states)
        : [];
    return {
      defense: Math.max(1, readNumber(unit, ['def', '防御'], 1)),
      mental: Math.max(1, readNumber(unit, ['men_max', '精神力上限', '精神力'], 1)),
      agility: Math.max(1, readNumber(unit, ['agi', '敏捷'], 1)),
      shield: stateValues.reduce(
        (sum, state) => sum + Math.max(0, Number(state?.shield_value || 0)),
        Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0)),
      ),
    };
  }

  function readHpMax(unit = {}) {
    const direct = Number(unit?.hp_max);
    const value = Number.isFinite(direct)
      ? Math.max(1, direct)
      : Math.max(1, readNumber(unit, ['hp_max', 'HP上限', '生命上限', 'vit_max', '体力上限'], 1));
    if (activePreviewDependencyCapture) {
      recordPreviewDependency(`unit:${unitId(unit)}:baseMaxHp`, value);
    }
    return value;
  }

  function readHp(unit = {}) {
    const maximum = readHpMax(unit);
    const direct = Number(unit?.hp);
    const value = Number.isFinite(direct)
      ? clamp(direct, 0, maximum)
      : clamp(readNumber(unit, ['hp', 'HP', '生命', 'vit', '体力'], maximum), 0, maximum);
    if (activePreviewDependencyCapture) {
      recordPreviewDependency(`unit:${unitId(unit)}:hp`, value);
    }
    return value;
  }

  function readShield(unit = {}) {
    const direct = Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0));
    const stateTotal = Object.values(unit?.状态效果 || {}).reduce(
      (total, condition) => total + Math.max(0, Number(condition?.shield_value || 0)),
      0,
    );
    // Runtime stores active shields as state entries; direct fields are only the
    // fallback for snapshots that have not been materialized into states yet.
    const value = stateTotal > 0 ? stateTotal : direct;
    if (activePreviewDependencyCapture) {
      recordPreviewDependency(
        `target:${unitId(unit)}:defense`,
        defenseDependencyValue(unit),
      );
    }
    return value;
  }

  function applyProjectedShieldDelta(unit, delta, effectId, duration = 1) {
    if (Math.abs(delta) <= 1e-12) return;
    const current = readShield(unit);
    const entries = Object.entries(unit.状态效果 || {}).filter(([, state]) => Number(state?.shield_value || 0) > 0);
    if (entries.length) {
      if (delta > 0) {
        const key = `preview:${effectId}:护盾`;
        unit.状态效果[key] = {
          ...(unit.状态效果[key] || {}),
          状态: '护盾', 原型: '护盾变化', duration,
          shield_value: Number(unit.状态效果[key]?.shield_value || 0) + delta,
        };
      } else {
        let remaining = Math.min(current, -delta);
        entries.sort((left, right) => right[1].shield_value - left[1].shield_value);
        for (const [key, state] of entries) {
          const removed = Math.min(remaining, state.shield_value);
          state.shield_value -= removed;
          remaining -= removed;
          if (state.shield_value <= 0) delete unit.状态效果[key];
          if (remaining <= 0) break;
        }
      }
    }
    unit.shield = Math.max(0, current + delta);
    unit.护盾 = unit.shield;
  }

  function calculateShieldGain(unit = {}, shieldAmount = 0) {
    const requested = Math.max(0, Math.floor(Number(shieldAmount || 0)));
    if (!(requested > 0)) return 0;
    const current = readShield(unit);
    const softCap = Math.max(300, Math.floor(readHpMax(unit) * 1.2 + readResourceMax(unit, '魂力') * 0.35));
    const normal = Math.min(requested, Math.max(0, softCap - current));
    return Math.max(0, Math.floor(normal + Math.max(0, requested - normal) * 0.35));
  }

  function applyPreviewShield(unit = {}, shieldAmount = 0, duration = 1, effectId = '', stateName = '护盾', rawValue = '') {
    const amount = calculateShieldGain(unit, shieldAmount);
    if (!(amount > 0)) return 0;
    unit.状态效果 = unit.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : {};
    const key = `preview:${effectId}:${stateName || '护盾'}`;
    unit.状态效果[key] = {
      类型: 'buff',
      状态: stateName || '护盾',
      状态名称: stateName || '护盾',
      duration: Math.max(1, Number(duration || 1)),
      数值: rawValue,
      shield_value: amount,
      战斗效果: {},
    };
    return amount;
  }

  function absorbPreviewShield(unit = {}, incomingDamage = 0) {
    let remaining = Math.max(0, Number(incomingDamage || 0));
    if (!(remaining > 0)) return 0;
    const entries = Object.entries(unit?.状态效果 || {})
      .map(([key, condition]) => ({
        key,
        condition,
        duration: Math.max(0, Number(condition?.duration ?? condition?.持续回合 ?? 0)),
        value: Math.max(0, Number(condition?.shield_value || 0)),
      }))
      .filter(entry => entry.value > 0)
      .sort((left, right) => left.duration - right.duration || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    let absorbed = 0;
    entries.forEach(entry => {
      if (!(remaining > 0)) return;
      const amount = Math.min(entry.value, remaining);
      entry.condition.shield_value = Math.max(0, entry.value - amount);
      remaining -= amount;
      absorbed += amount;
      if (entry.condition.shield_value <= 0) delete unit.状态效果[entry.key];
    });
    if (!entries.length) {
      const direct = Math.max(0, readNumber(unit, ['shield', '护盾', '护盾值'], 0));
      const amount = Math.min(direct, remaining);
      absorbed += amount;
      const next = Math.max(0, direct - amount);
      unit.shield = next;
      unit.护盾 = next;
    } else {
      const next = Object.values(unit?.状态效果 || {}).reduce(
        (total, condition) => total + Math.max(0, Number(condition?.shield_value || 0)),
        0,
      );
      if ('shield' in unit) unit.shield = next;
      if ('护盾' in unit) unit.护盾 = next;
    }
    return absorbed;
  }

  function resourceStorageKey(resource) {
    if (resource === '魂力') return 'sp';
    if (resource === '精神力') return 'men';
    if (resource === '体力') return 'vit';
    if (/精神/.test(resource)) return 'men';
    if (/体力/.test(resource)) return 'vit';
    return /生命|HP/i.test(resource) ? 'hp' : 'sp';
  }

  function readResourceMax(unit = {}, resource = '') {
    const key = resourceStorageKey(resource);
    let value;
    if (key === 'men') {
      const direct = Number(unit?.men_max);
      value = Math.max(1, Number.isFinite(direct) ? direct : readNumber(unit, ['men_max', '精神力上限'], 1));
    } else if (key === 'vit') {
      const direct = Number(unit?.vit_max);
      value = Math.max(1, Number.isFinite(direct) ? direct : readNumber(unit, ['vit_max', 'sta_max', '体力上限'], 1));
    } else if (key === 'hp') {
      value = readHpMax(unit);
    } else {
      const direct = Number(unit?.sp_max);
      value = Math.max(1, Number.isFinite(direct) ? direct : readNumber(unit, ['sp_max', '魂力上限'], 1));
    }
    // Resource capacity includes active panel modifiers, but not the stamina
    // penalty used for combat capability. Base fields remain unchanged on expiry.
    const panelKey = key === 'hp' ? null : key + '_max';
    if (panelKey) {
      let panelChanged = false;
      for (const stateKey in unit.状态效果) {
        const state = unit.状态效果[stateKey];
        if (state?.面板修改比例?.[panelKey] === undefined && state?.面板固定修正?.[panelKey] === undefined) continue;
        panelChanged = true;
        value = value * Number(state?.面板修改比例?.[panelKey] ?? 1) + Number(state?.面板固定修正?.[panelKey] || 0);
      }
      if (panelChanged) value = Math.max(1, Math.round(value));
    }
    if (activePreviewDependencyCapture) {
      recordPreviewDependency(`unit:${unitId(unit)}:resourceMax:${resource}`, value);
    }
    return value;
  }

  function readResource(unit = {}, resource = '') {
    const key = resourceStorageKey(resource);
    let value;
    if (key === 'men') {
      const maximum = readResourceMax(unit, resource);
      const direct = Number(unit?.men);
      value = Number.isFinite(direct)
        ? clamp(direct, 0, maximum)
        : clamp(readNumber(unit, ['men', '精神力'], 0), 0, maximum);
    } else if (key === 'vit') {
      const maximum = readResourceMax(unit, resource);
      const direct = Number(unit?.vit);
      value = Number.isFinite(direct)
        ? clamp(direct, 0, maximum)
        : clamp(readNumber(unit, ['vit', 'sta', '体力'], 0), 0, maximum);
    } else if (key === 'hp') {
      value = readHp(unit);
    } else {
      const maximum = readResourceMax(unit, resource);
      const direct = Number(unit?.sp);
      value = Number.isFinite(direct)
        ? clamp(direct, 0, maximum)
        : clamp(readNumber(unit, ['sp', '魂力'], 0), 0, maximum);
    }
    if (activePreviewDependencyCapture) {
      recordPreviewDependency(`unit:${unitId(unit)}:resource:${resource}`, value);
    }
    return value;
  }

  function normalizedResourceKeys(resource = '') {
    const values = (Array.isArray(resource) ? resource : String(resource || '').split(/[、,，/|｜；;+\s]+/g))
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const text = values.join('、');
    const keys = [];
    values.forEach(value => {
      if (/生命|HP|hp/i.test(value)) keys.push('hp');
      else if (/体力|vit|sta/i.test(value)) keys.push('vit');
      else if (/精神|men/i.test(value)) keys.push('men');
      else if (/魂力|sp/i.test(value)) keys.push('sp');
    });
    if (/双|混合|全部/.test(text)) keys.push('sp', 'men');
    return keys.length ? [...new Set(keys)] : ['sp'];
  }

  function resourceLabel(resourceKey = '') {
    return { hp: '生命', vit: '体力', sp: '魂力', men: '精神力' }[resourceKey] || '魂力';
  }

  function staminaScaleForUnit(unit = {}) {
    const sources = [
      unit,
      unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {},
      unit?.final && typeof unit.final === 'object' ? unit.final : {},
    ];
    const hasStaminaField = sources.some(source =>
      ['vit', 'sta', '体力', 'vit_max', 'sta_max', '体力上限'].some(key =>
        Number.isFinite(Number(source?.[key]))
      )
    );
    if (!hasStaminaField) return 1;
    const ratio = clamp(readResource(unit, '体力') / Math.max(1, readResourceMax(unit, '体力')), 0, 1);
    if (ratio >= 0.5) return 1;
    if (ratio >= 0.3) return 0.9 + (ratio - 0.3) * 0.5;
    if (ratio >= 0.15) return 0.75 + (ratio - 0.15);
    return 0.5 + ratio * (5 / 3);
  }

  function refreshStaminaAdjustedFinal(unit = {}) {
    if (!unit || typeof unit !== 'object') return unit;
    const finalStats = unit.final && typeof unit.final === 'object' ? unit.final : null;
    if (!finalStats) return unit;
    const previousScale = clamp(Number(finalStats.__体力衰减系数 ?? 1), 0.01, 1);
    const nextScale = staminaScaleForUnit(unit);
    ['str', 'def', 'agi', 'sp_max', 'vit_max', 'men_max'].forEach(key => {
      const current = Number(finalStats[key]);
      if (!Number.isFinite(current)) return;
      finalStats[key] = Math.max(1, Math.round(current / previousScale * nextScale));
    });
    if (nextScale < 1) finalStats.__体力衰减系数 = nextScale;
    else delete finalStats.__体力衰减系数;
    return unit;
  }

  function buildNumericCombatStats(unit = {}, currentTick = 0) {
    const attributes = unit?.属性 && typeof unit.属性 === 'object'
      ? unit.属性
      : {};
    const readFinite = (directKeys, attributeKeys = directKeys) => {
      for (const key of directKeys) {
        const value = Number(unit?.[key]);
        if (Number.isFinite(value)) return value;
      }
      for (const key of attributeKeys) {
        const value = Number(attributes?.[key]);
        if (Number.isFinite(value)) return value;
      }
      return undefined;
    };
    const final = {};
    [
      ['level', ['level', '等级', '修为等级'], ['等级']],
      ['等级', ['等级', 'level', '修为等级'], ['等级']],
      ['hp', ['hp', 'HP', '生命'], ['HP', '生命']],
      ['hp_max', ['hp_max', 'HP上限', '生命上限'], ['HP上限', '生命上限', '体力上限']],
      ['sp', ['sp', '魂力'], ['魂力']],
      ['sp_max', ['sp_max', '魂力上限'], ['魂力上限']],
      ['men', ['men', '精神力'], ['精神力']],
      ['men_max', ['men_max', '精神力上限'], ['精神力上限']],
      ['vit', ['vit', 'sta', '体力'], ['体力']],
      ['vit_max', ['vit_max', 'sta_max', '体力上限'], ['体力上限']],
      ['sta', ['sta', 'vit', '体力'], ['体力']],
      ['sta_max', ['sta_max', 'vit_max', '体力上限'], ['体力上限']],
      ['str', ['str', '力量', '攻击'], ['力量', '攻击']],
      ['def', ['def', '防御'], ['防御']],
      ['agi', ['agi', '敏捷'], ['敏捷']],
      ['shield', ['shield', '护盾', '护盾值'], ['护盾', '护盾值']],
    ].forEach(([targetKey, directKeys, attributeKeys]) => {
      const value = readFinite(directKeys, attributeKeys);
      if (value !== undefined) final[targetKey] = value;
    });
    const stateEffects = unit?.状态效果 || {};
    const normalizedTick = Math.max(0, Number(currentTick || 0));
    const applyCopiedStats = snapshot => {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return;
      [['力量', 'str'], ['防御', 'def'], ['敏捷', 'agi'], ['体力上限', 'vit_max'], ['魂力上限', 'sp_max'], ['精神力上限', 'men_max']]
        .forEach(([sourceKey, runtimeKey]) => {
          const value = Number(snapshot[sourceKey] ?? snapshot[runtimeKey]);
          if (Number.isFinite(value) && value > 0) final[runtimeKey] = value;
        });
    };
    const copiedSnapshots = [];
    Object.values(stateEffects).forEach(condition => {
      const ratios = condition?.面板修改比例 || {};
      const deltas = condition?.面板固定修正 || {};
      ['str', 'def', 'agi'].forEach(key => { final[key] = Number(final[key] || 0) * Number(ratios[key] ?? 1) + Number(deltas[key] || 0); });
      ['sp_max', 'vit_max', 'men_max'].forEach(key => {
        if (final[key] !== undefined) final[key] = Number(final[key] || 0) * Number(ratios[key] ?? 1) + Number(deltas[key] || 0);
      });
      if (condition?.属性快照) copiedSnapshots.push(condition.属性快照);
    });
    copiedSnapshots.forEach(applyCopiedStats);
    Object.values(unit?.复制效果 || {}).forEach(record => {
      if (!record || typeof record !== 'object') return;
      const expiresAt = Math.max(0, Number(record.到期tick || 0));
      if (!(expiresAt > 0 && normalizedTick >= expiresAt)) applyCopiedStats(record.属性快照);
    });
    if (final.sp_max !== undefined && final.sp !== undefined) final.sp = Math.min(final.sp, final.sp_max);
    if (final.vit_max !== undefined && final.vit !== undefined) final.vit = Math.min(final.vit, final.vit_max);
    if (final.men_max !== undefined && final.men !== undefined) final.men = Math.min(final.men, final.men_max);
    const staminaScale = staminaScaleForUnit(unit);
    if (staminaScale < 1) {
      ['str', 'def', 'agi', 'sp_max', 'vit_max', 'men_max'].forEach(key => {
        if (final[key] !== undefined) final[key] = Number(final[key] || 0) * staminaScale;
      });
      final.__体力衰减系数 = staminaScale;
    }
    ['str', 'def', 'agi', 'sp_max', 'vit_max', 'men_max'].forEach(key => {
      if (final[key] !== undefined) final[key] = Math.round(Number(final[key] || 0));
    });
    return final;
  }

  function readCombatStat(unit = {}, key = '') {
    const aliases = {
      str: ['str', '力量', '攻击'],
      def: ['def', '防御'],
      agi: ['agi', '敏捷'],
      men: ['men_max', '精神力上限', '精神力'],
    };
    const keys = aliases[key] || [key];
    const finalStats = unit?.final && typeof unit.final === 'object' ? unit.final : null;
    if (finalStats) {
      for (const alias of keys) {
        const value = Number(finalStats[alias]);
        if (Number.isFinite(value)) {
          const result = Math.max(1, value);
          if (activePreviewDependencyCapture) {
            recordPreviewDependency(`unit:${unitId(unit)}:stat:${key}`, result);
            if (key === 'def' || key === 'men' || key === 'agi') {
              recordPreviewDependency(
                `target:${unitId(unit)}:defense`,
                defenseDependencyValue(unit),
              );
            }
          }
          return result;
        }
      }
    }
    const direct = Number(unit?.[keys[0]]);
    const result = Number.isFinite(direct)
      ? Math.max(1, direct)
      : readCombatStatBreakdown(unit, key).value;
    if (activePreviewDependencyCapture) {
      recordPreviewDependency(`unit:${unitId(unit)}:stat:${key}`, result);
      if (key === 'def' || key === 'men' || key === 'agi') {
        recordPreviewDependency(
          `target:${unitId(unit)}:defense`,
          defenseDependencyValue(unit),
        );
      }
    }
    return result;
  }

  function stateModifierSource(unit = {}, stateKey = '', state = {}, ownerRole = '', axes = []) {
    const sourceWindow = Array.isArray(state?.__状态来源窗口)
      ? state.__状态来源窗口.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    const applicationId = String(sourceWindow[0] || state?.__状态来源键 || '').trim();
    const sourceActionId = String(state?.sourceActionId || '').trim();
    const sourceEffectId = String(state?.sourceEffectId || '').trim();
    const ownerId = unitId(unit);
    const normalizedStateKey = String(stateKey || '').trim();
    const stateLabel = stateName(state) || normalizedStateKey || '未声明状态';
    return Object.freeze({
      sourceKey: applicationId
        ? `application:${applicationId}`
        : sourceActionId || sourceEffectId
          ? `source:${ownerId}:${sourceActionId}:${sourceEffectId}:${stateLabel}`
          : `state:${ownerId}:${normalizedStateKey || stateLabel}`,
      applicationId,
      sourceActionId,
      sourceEffectId,
      ownerId,
      ownerRole: String(ownerRole || '').trim().toUpperCase(),
      stateName: stateLabel,
      axes: Object.freeze([...new Set((axes || []).map(value => String(value || '').trim()).filter(Boolean))]),
    });
  }

  function readCombatStatBreakdown(unit = {}, key = '') {
    const aliases = {
      str: ['str', '力量', '攻击'],
      def: ['def', '防御'],
      agi: ['agi', '敏捷'],
      men: ['men_max', '精神力上限', '精神力'],
    };
    const keys = aliases[key] || [key];
    const sourceStats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {};
    const finalStats = unit?.final && typeof unit.final === 'object' ? unit.final : {};
    const directValue = Number(unit?.[keys[0]]);
    const readFirstFinite = sources => {
      for (const source of sources) {
        for (const alias of keys) {
          const value = Number(source?.[alias]);
          if (Number.isFinite(value)) return value;
        }
      }
      return NaN;
    };
    const base = Math.max(
      1,
      (Number.isFinite(directValue) ? directValue : readFirstFinite([unit, sourceStats])) || 1,
    );
    const modifiers = [];
    let calculated = base;
    stateEntries(unit, `STAT:${key}`).forEach(([stateKey, state]) => {
      const source = stateName(state) || String(stateKey || '状态修正').trim();
      const ratio = Number(state?.面板修改比例?.[key] ?? 1);
      const fixed = Number(state?.面板固定修正?.[key] ?? 0);
      if (Number.isFinite(ratio) && Math.abs(ratio - 1) > 1e-9) {
        modifiers.push({ kind: 'multiply', value: ratio, source });
        calculated *= ratio;
      }
      if (Number.isFinite(fixed) && Math.abs(fixed) > 1e-9) {
        modifiers.push({ kind: 'add', value: fixed, source });
        calculated += fixed;
      }
    });
    const staminaScale = Number(
      Object.prototype.hasOwnProperty.call(finalStats, '__体力衰减系数')
        ? finalStats.__体力衰减系数
        : staminaScaleForUnit(unit)
    );
    if (Number.isFinite(staminaScale) && Math.abs(staminaScale - 1) > 1e-9) {
      modifiers.push({ kind: 'multiply', value: staminaScale, source: '低体力衰减' });
      calculated *= staminaScale;
    }
    const finalValue = readFirstFinite([finalStats]);
    const value = Math.max(1, Number.isFinite(finalValue) ? finalValue : calculated);
    if (Math.abs(value - calculated) > 0.51) {
      modifiers.push({ kind: 'override', value, source: '属性快照或运行时规则' });
    }
    return Object.freeze({
      key,
      base,
      value,
      modifiers: Object.freeze(modifiers.map(item => Object.freeze({ ...item }))),
    });
  }

  function listUnits(worldSnapshot = {}) {
    const participants = worldSnapshot?.参战者 && typeof worldSnapshot.参战者 === 'object' ? worldSnapshot.参战者 : {};
    const result = [];
    const seen = new Set();
    const add = (unit, side) => {
      if (!unit) return;
      const key = unitId(unit) || unitName(unit);
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({ unit, side });
    };
    Object.entries(participants).forEach(([side, value]) => {
      const units = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
      units.forEach(unit => add(unit, side));
    });
    if (worldSnapshot?.召唤单位表 && typeof worldSnapshot.召唤单位表 === 'object') {
      Object.values(worldSnapshot.召唤单位表).forEach(unit => {
        if (!unit || unit.已消散 === true) return;
        add(
          unit,
          /^(enemy|敌方|对方)$/i.test(String(unit?.阵营 || '').trim())
            ? 'team_enemy'
            : 'team_player',
        );
      });
    }
    return result;
  }

  function findUnit(worldSnapshot = {}, id = '') {
    const wanted = String(id || '').trim();
    if (!wanted) return null;
    return listUnits(worldSnapshot).find(entry => unitId(entry.unit) === wanted || unitName(entry.unit) === wanted)?.unit || null;
  }

  function sideOf(worldSnapshot = {}, unit = {}) {
    const id = unitId(unit);
    return listUnits(worldSnapshot).find(entry => unitId(entry.unit) === id)?.side || '';
  }

  function buildMechanicalProjectionProfile(unit = {}, side = '') {
    metrics.mechanicalProjectionProfileBuilds += 1;
    const states = collectStateEntries(unit);
    const outgoingDamageMultiplier = states.reduce((multiplier, [, state]) => {
      const combatEffect = state?.战斗效果 || {};
      return multiplier *
        Math.max(0, Number(combatEffect?.final_damage_mult ?? 1)) *
        Math.max(
          0,
          1 + Number(
            combatEffect?.damage_bonus ||
            combatEffect?.final_damage_bonus ||
            0,
          ),
        );
    }, 1);
    const incomingDamageMultiplier = states.reduce((multiplier, [, state]) => {
      const combatEffect = state?.战斗效果 || {};
      return multiplier *
        Math.max(0, Number(combatEffect?.received_damage_mult ?? 1)) *
        Math.max(
          0,
          1 - clamp(Number(combatEffect?.damage_reduction || 0), 0, 1),
        );
    }, 1);
    const outgoingHitAdjustment = states.reduce((sum, [, state]) => {
      const combatEffect = state?.战斗效果 || {};
      return sum +
        Number(combatEffect?.hit_bonus || 0) -
        Number(combatEffect?.hit_penalty || 0);
    }, 0);
    const outgoingArmorPenRatio = clamp(
      states.reduce((sum, [, state]) =>
        sum + Math.max(0, Number(state?.战斗效果?.armor_pen || 0)),
      0),
      0,
      1,
    );
    const incomingAvoidanceAdjustment = states.reduce((sum, [, state]) => {
      const combatEffect = state?.战斗效果 || {};
      return sum +
        Number(combatEffect?.dodge_bonus || 0) -
        Math.max(
          Number(combatEffect?.dodge_penalty || 0),
          Number(combatEffect?.lock_level || 0),
        );
    }, 0);
    const outgoingDamageLimited = states.flatMap(([, state]) =>
      Array.isArray(state?.战斗效果?.damage_bonus_limited)
        ? state.战斗效果.damage_bonus_limited.map(entry => ({ ...entry }))
        : [],
    );
    const incomingDamageLimited = states.flatMap(([, state]) =>
      Array.isArray(state?.战斗效果?.damage_reduction_limited)
        ? state.战斗效果.damage_reduction_limited.map(entry => ({ ...entry }))
        : [],
    );
    return Object.freeze({
      unit,
      id: unitId(unit),
      side,
      physicallyAlive: isPhysicallyAlive(unit),
      battleCapable: isBattleCapable(unit),
      hasPendingGrantedEffects: states.some(([, state]) =>
        String(state?.授予触发条件 || state?.触发条件 || '').trim() === '随下次行动触发' &&
        Math.max(0, Math.floor(Number(state?.可用次数 ?? 1) || 0)) > 0 &&
        Array.isArray(state?.授予效果) &&
        state.授予效果.length > 0
      ),
      hasPendingSkillGrantedEffects: states.some(([, state]) =>
        String(state?.授予触发条件 || state?.触发条件 || '').trim() === '下次魂技成功释放' &&
        Math.max(0, Math.floor(Number(state?.可用次数 ?? 1) || 0)) > 0 &&
        Array.isArray(state?.授予效果) &&
        state.授予效果.length > 0
      ),
      stats: Object.freeze({
        str: readCombatStat(unit, 'str'),
        def: readCombatStat(unit, 'def'),
        agi: readCombatStat(unit, 'agi'),
        men: readCombatStat(unit, 'men'),
      }),
      resourceMax: Object.freeze({
        魂力: readResourceMax(unit, '魂力'),
        精神力: readResourceMax(unit, '精神力'),
      }),
      hpMax: readHpMax(unit),
      outgoingDamageMultiplier,
      incomingDamageMultiplier,
      outgoingDamageLimited: Object.freeze(outgoingDamageLimited),
      incomingDamageLimited: Object.freeze(incomingDamageLimited),
      outgoingHitAdjustment,
      outgoingArmorPenRatio,
      incomingAvoidanceAdjustment,
    });
  }

  function mechanicalProjectionProfilesEquivalent(left = null, right = null) {
    if (!left || !right) return false;
    const leftOutgoingDamageLimited = left.outgoingDamageLimited;
    const rightOutgoingDamageLimited = right.outgoingDamageLimited;
    const leftIncomingDamageLimited = left.incomingDamageLimited;
    const rightIncomingDamageLimited = right.incomingDamageLimited;
    const outgoingDamageLimitedEqual = Array.isArray(leftOutgoingDamageLimited) &&
      Array.isArray(rightOutgoingDamageLimited) &&
      (leftOutgoingDamageLimited === rightOutgoingDamageLimited ||
        (leftOutgoingDamageLimited.length === 0 && rightOutgoingDamageLimited.length === 0));
    const incomingDamageLimitedEqual = Array.isArray(leftIncomingDamageLimited) &&
      Array.isArray(rightIncomingDamageLimited) &&
      (leftIncomingDamageLimited === rightIncomingDamageLimited ||
        (leftIncomingDamageLimited.length === 0 && rightIncomingDamageLimited.length === 0));
    return Object.is(left.id, right.id) &&
      Object.is(left.side, right.side) &&
      Object.is(left.physicallyAlive, right.physicallyAlive) &&
      Object.is(left.battleCapable, right.battleCapable) &&
      Object.is(left.hasPendingGrantedEffects, right.hasPendingGrantedEffects) &&
      Object.is(left.hasPendingSkillGrantedEffects, right.hasPendingSkillGrantedEffects) &&
      Object.is(left.stats?.str, right.stats?.str) &&
      Object.is(left.stats?.def, right.stats?.def) &&
      Object.is(left.stats?.agi, right.stats?.agi) &&
      Object.is(left.stats?.men, right.stats?.men) &&
      Object.is(left.resourceMax?.魂力, right.resourceMax?.魂力) &&
      Object.is(left.resourceMax?.精神力, right.resourceMax?.精神力) &&
      Object.is(left.hpMax, right.hpMax) &&
      Object.is(left.outgoingDamageMultiplier, right.outgoingDamageMultiplier) &&
      Object.is(left.incomingDamageMultiplier, right.incomingDamageMultiplier) &&
      Object.is(left.outgoingHitAdjustment, right.outgoingHitAdjustment) &&
      Object.is(left.outgoingArmorPenRatio, right.outgoingArmorPenRatio) &&
      Object.is(left.incomingAvoidanceAdjustment, right.incomingAvoidanceAdjustment) &&
      outgoingDamageLimitedEqual &&
      incomingDamageLimitedEqual;
  }

  function buildMechanicalProjectionContextEntries(
    worldSnapshot = {},
    baseContext = null,
    changedUnitIds = new Set(),
  ) {
    const entries = listUnits(worldSnapshot);
    const baseEntryById = new Map(
      (baseContext?.entries || []).map(entry => [unitId(entry?.unit), entry]),
    );
    const changed = new Set(
      [...(changedUnitIds || [])]
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    return entries.map(entry => {
      const unit = entry.unit;
      const id = unitId(unit);
      const baseEntry = baseEntryById.get(id);
      if (
        baseEntry &&
        !changed.has(id) &&
        baseEntry.side === entry.side
      ) {
        return baseEntry;
      }
      const profile = buildMechanicalProjectionProfile(unit, entry.side);
      if (
        baseEntry &&
        baseEntry.side === entry.side &&
        mechanicalProjectionProfilesEquivalent(profile, baseEntry.profile)
      ) {
        metrics.mechanicalProjectionProfileIdentityReuses += 1;
        return Object.freeze({
          unit,
          side: entry.side,
          profile: baseEntry.profile,
        });
      }
      return Object.freeze({
        unit,
        side: entry.side,
        profile,
      });
    });
  }

  function buildMechanicalProjectionContext(
    worldSnapshot = {},
    baseContext = null,
    changedUnitIds = new Set(),
  ) {
    const projectedEntries = buildMechanicalProjectionContextEntries(
      worldSnapshot,
      baseContext,
      changedUnitIds,
    );
    const unitById = new Map();
    const profileById = new Map();
    projectedEntries.forEach(entry => {
      const unit = entry.unit;
      const id = unitId(unit);
      unitById.set(id, unit);
      const name = unitName(unit);
      if (name && !unitById.has(name)) unitById.set(name, unit);
      profileById.set(id, entry.profile);
    });
    return Object.freeze({
      schemaVersion: 'MechanicalProjectionContextV1',
      worldSnapshot,
      entries: Object.freeze(projectedEntries),
      unitById,
      profileById,
    });
  }

  function compileMechanicalProjectionContext(worldSnapshot = {}) {
    return buildMechanicalProjectionContext(worldSnapshot);
  }

  function deriveMechanicalProjectionContext(
    baseContext = null,
    worldSnapshot = {},
    changedUnitIds = [],
  ) {
    if (
      !baseContext ||
      baseContext.schemaVersion !== 'MechanicalProjectionContextV1' ||
      !baseContext.worldSnapshot ||
      !worldSnapshot ||
      typeof worldSnapshot !== 'object'
    ) {
      return compileMechanicalProjectionContext(worldSnapshot);
    }
    return buildMechanicalProjectionContext(
      worldSnapshot,
      baseContext,
      changedUnitIds,
    );
  }

  function mechanicalProjectionProfile(context, unit = {}) {
    if (
      !context ||
      context.schemaVersion !== 'MechanicalProjectionContextV1'
    ) {
      return null;
    }
    return context.profileById.get(unitId(unit)) || null;
  }

  function isDead(unit = {}) {
    const directHp = Number(unit?.hp);
    return unit?.状态?.存活 === false || (Number.isFinite(directHp) ? directHp <= 0 : readHp(unit) <= 0);
  }

  function isPhysicallyAlive(unit = {}) {
    return !isDead(unit);
  }

  function isBattleCapable(unit = {}) {
    const captureActive = !!activePreviewDependencyCapture;
    let stamina;
    if (captureActive) {
      const directStamina = Number(unit?.vit);
      stamina = Number.isFinite(directStamina) ? directStamina : readResource(unit, '体力');
    }
    const incapacityReason = readIncapacityReason(unit);
    const capable = !incapacityReason;
    if (captureActive) {
      recordPreviewDependency(`unit:${unitId(unit)}:state:__action`, {
        alive: !isDead(unit),
        stamina,
        incapacityReason,
        capable,
      });
    }
    return capable;
  }

  function isSummonUnit(unit = {}) {
    return String(unit?.单位性质 || unit?.类型 || '').trim() === '召唤物' ||
      Boolean(unit?.召唤键 || unit?.__battleRuntime?.summonWindow);
  }

  function isAlive(unit = {}) {
    return isBattleCapable(unit);
  }

  function fusionSkillMetadata(unit = {}, skill = {}) {
    if (!unit || typeof unit !== 'object' || !skill || typeof skill !== 'object') return null;
    const metadataUnit = overlayUnitOriginCache.get(unit) || unit;
    let index = fusionMetadataCache.get(metadataUnit);
    if (!index) {
      const bySkill = new WeakMap();
      const entries = [];
      const seen = new Set();
      const visit = value => {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const skillData = value?.技能数据;
        if (
          skillData && typeof skillData === 'object' &&
          (value?.融合模式 !== undefined || value?.融合对象 !== undefined || Array.isArray(value?.融合参与者))
        ) {
          const metadata = Object.freeze({
            name: String(skillData?.name || skillData?.魂技名 || skillData?.技能名称 || skillData?.名称 || '').trim(),
            mode: String(value?.融合模式 || 'partner').trim().toLowerCase(),
            usageMode: String(value?.用法模式 || value?.融合用法 || '').trim(),
            partnerName: String(value?.融合对象 || '').trim(),
            participants: cloneValue(Array.isArray(value?.融合参与者) ? value.融合参与者 : []),
          });
          bySkill.set(skillData, metadata);
          entries.push(Object.freeze({
            skill: skillData,
            name: metadata.name,
            effects: effectArrayHash(skillData?._效果数组),
            metadata,
          }));
        }
        Object.entries(value).forEach(([key, child]) => {
          if (/状态效果|战斗历史|历史快照|参战者|复制效果|__battleRuntime|__行动闭环诊断/.test(key)) return;
          visit(child);
        });
      };
      visit(metadataUnit);
      index = Object.freeze({ bySkill, entries: Object.freeze(entries) });
      fusionMetadataCache.set(metadataUnit, index);
    }
    if (index.bySkill.has(skill)) return index.bySkill.get(skill);
    const wantedName = String(skill?.name || skill?.魂技名 || skill?.技能名称 || skill?.名称 || '').trim();
    const wantedEffects = effectArrayHash(skill?._效果数组);
    return index.entries.find(entry =>
      wantedName && entry.name === wantedName &&
      (!wantedEffects || !entry.effects || wantedEffects === entry.effects)
    )?.metadata || null;
  }

  function fusionParticipantIdentifiers(participant = {}) {
    if (typeof participant === 'string') return [participant.trim()].filter(Boolean);
    return [
      participant?.角色键,
      participant?.角色名,
      participant?.id,
      participant?.name,
      participant?.名称,
    ].map(value => String(value || '').trim()).filter(Boolean);
  }

  function resolveFusionAction(worldSnapshot = {}, actor = {}, skill = {}, options = {}) {
    const metadata = fusionSkillMetadata(actor, skill);
    if (!metadata) {
      return Object.freeze({
        required: false,
        valid: true,
        reason: '',
        fusionKey: '',
        participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
        partnerIds: Object.freeze([]),
        participants: Object.freeze([actor].filter(Boolean)),
        partners: Object.freeze([]),
        usageMode: '',
      });
    }
    const actorSide = sideOf(worldSnapshot, actor);
    const actorIdentity = new Set([unitId(actor), unitName(actor)].filter(Boolean));
    const participantRefs = metadata.participants.length
      ? metadata.participants
      : (metadata.partnerName ? [{ 类型: '搭档', 角色名: metadata.partnerName }] : []);
    const partnerRefs = participantRefs.filter(participant => {
      const role = String(participant?.类型 || '').trim();
      const identifiers = fusionParticipantIdentifiers(participant);
      return !/自身|self/i.test(role) && !identifiers.some(identifier => actorIdentity.has(identifier));
    });
    if (!partnerRefs.length && metadata.mode !== 'self') {
      return Object.freeze({
        required: true,
        valid: false,
        reason: 'FUSION_PARTNER_UNDECLARED',
        fusionKey: '',
        participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
        partnerIds: Object.freeze([]),
        participants: Object.freeze([actor].filter(Boolean)),
        partners: Object.freeze([]),
        usageMode: metadata.usageMode,
      });
    }
    const partners = [];
    for (const participant of partnerRefs) {
      const identifiers = fusionParticipantIdentifiers(participant);
      const partner = listUnits(worldSnapshot).find(entry => {
        const ids = [unitId(entry.unit), unitName(entry.unit)].filter(Boolean);
        return identifiers.some(identifier => ids.includes(identifier));
      })?.unit || null;
      if (!partner) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_MISSING',
          fusionKey: '',
          participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
          partnerIds: Object.freeze([]),
          participants: Object.freeze([actor].filter(Boolean)),
          partners: Object.freeze([]),
          usageMode: metadata.usageMode,
        });
      }
      if (sideOf(worldSnapshot, partner) !== actorSide) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_HOSTILE',
          fusionKey: '',
          participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
          partnerIds: Object.freeze([]),
          participants: Object.freeze([actor].filter(Boolean)),
          partners: Object.freeze([]),
          usageMode: metadata.usageMode,
        });
      }
      if (!isBattleCapable(partner)) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_UNAVAILABLE',
          fusionKey: '',
          participantIds: Object.freeze([unitId(actor)].filter(Boolean)),
          partnerIds: Object.freeze([]),
          participants: Object.freeze([actor].filter(Boolean)),
          partners: Object.freeze([]),
          usageMode: metadata.usageMode,
        });
      }
      if (!partners.some(existing => unitId(existing) === unitId(partner))) partners.push(partner);
    }
    const participantIds = [...new Set([unitId(actor), ...partners.map(unitId)].filter(Boolean))];
    const fusionKey = `${metadata.name || 'fusion'}:${[...participantIds].sort().join('+')}`;
    const oneUse = /一次|single|once/i.test(metadata.usageMode);
    if (oneUse && [actor, ...partners].some(participant =>
      (Array.isArray(participant?.__battleRuntime?.fusionUsageKeys)
        ? participant.__battleRuntime.fusionUsageKeys
        : []
      ).map(String).includes(fusionKey)
    )) {
      return Object.freeze({
        required: true,
        valid: false,
        reason: 'FUSION_ALREADY_USED',
        fusionKey,
        participantIds: Object.freeze(participantIds),
        partnerIds: Object.freeze(partners.map(unitId)),
        participants: Object.freeze([actor, ...partners]),
        partners: Object.freeze(partners),
        usageMode: metadata.usageMode,
      });
    }
    if (options?.requirePendingOpportunity !== false) {
      const round = Math.max(0, Number(worldSnapshot?.回合 || 0));
      const unavailable = partners.find(partner => {
        const opportunity = partner?.__battleRuntime?.naturalOpportunity;
        return !opportunity ||
          Number(opportunity?.round || 0) !== round ||
          String(opportunity?.status || '').trim() !== 'PENDING';
      });
      if (unavailable) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_OPPORTUNITY_UNAVAILABLE',
          fusionKey,
          participantIds: Object.freeze(participantIds),
          partnerIds: Object.freeze(partners.map(unitId)),
          participants: Object.freeze([actor, ...partners]),
          partners: Object.freeze(partners),
          usageMode: metadata.usageMode,
        });
      }
    }
    {
      const resourceCosts = options?.resourceCosts && typeof options.resourceCosts === 'object'
        ? options.resourceCosts
        : {};
      const payment = assessResourcePayment([actor, ...partners], resourceCosts);
      if (!payment.valid) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_COST_INVALID',
          costReason: payment.reason,
          costDiagnostics: payment.非法项,
          fusionKey,
          participantIds: Object.freeze(participantIds),
          partnerIds: Object.freeze(partners.map(unitId)),
          participants: Object.freeze([actor, ...partners]),
          partners: Object.freeze(partners),
          usageMode: metadata.usageMode,
        });
      }
      if (!payment.ok && options?.ignoreResourceAvailability !== true) {
        return Object.freeze({
          required: true,
          valid: false,
          reason: 'FUSION_PARTNER_RESOURCE_INSUFFICIENT',
          costReason: payment.reason,
          fusionKey,
          participantIds: Object.freeze(participantIds),
          partnerIds: Object.freeze(partners.map(unitId)),
          participants: Object.freeze([actor, ...partners]),
          partners: Object.freeze(partners),
          usageMode: metadata.usageMode,
        });
      }
    }
    return Object.freeze({
      required: true,
      valid: true,
      reason: '',
      fusionKey,
      participantIds: Object.freeze(participantIds),
      partnerIds: Object.freeze(partners.map(unitId)),
      participants: Object.freeze([actor, ...partners]),
      partners: Object.freeze(partners),
      usageMode: metadata.usageMode,
    });
  }

  function shouldTriggerTraumaUnconscious(damage = 0, hpAfter = 0, hpMax = 1) {
    const safeMax = Math.max(1, Number(hpMax || 1));
    return Number(hpAfter || 0) > 0 && Number(damage || 0) / safeMax >= 0.5 - 1e-9 && Number(hpAfter || 0) / safeMax < 0.2 - 1e-9;
  }

  function naturalActionOrderProfile(unit = {}) {
    const typePriority = { 辅助系: 1, 控制系: 2, 敏攻系: 2, 强攻系: 2, 精神系: 2, 元素系: 2, 防御系: 3, 治疗系: 3, 食物系: 3 };
    const type = String(unit?.type || unit?.系别 || unit?.属性?.系别 || '').trim();
    const baseAgility = Math.max(0, readCombatStat(unit, 'agi'));
    const speedModifier = stateEntries(unit, 'ACTION_ORDER').reduce((total, [, state]) => {
      const effects = state?.战斗效果 || state?.计算层效果 || {};
      const probability = clamp(Number(state?.__previewApplicationProbability ?? 1), 0, 1);
      return total +
        Number(effects?.cast_speed_bonus || 0) * probability -
        Number(effects?.cast_speed_penalty || 0) * probability;
    }, 0);
    return Object.freeze({
      type,
      typePriority: Number(typePriority[type] || 4),
      baseAgility,
      speedModifier,
      effectiveAgility: baseAgility * clamp(1 + speedModifier, 0.1, 2),
    });
  }

  function compareNaturalActionOrder(left = {}, right = {}) {
    const leftProfile = naturalActionOrderProfile(left);
    const rightProfile = naturalActionOrderProfile(right);
    const priorityDelta = leftProfile.typePriority - rightProfile.typePriority;
    if (priorityDelta) return priorityDelta;
    const agilityDelta = rightProfile.effectiveAgility - leftProfile.effectiveAgility;
    if (agilityDelta) return agilityDelta;
    return 0;
  }

  function normalizeObjectiveSide(value = '') {
    const text = String(value || '').trim().toUpperCase();
    if (/^(PLAYER|ALLY|OWN|我方|己方|友方)$/.test(text)) return 'PLAYER';
    if (/^(ENEMY|HOSTILE|敌方|对方)$/.test(text)) return 'ENEMY';
    return '';
  }

  function objectiveSideOfEntry(entry = {}) {
    return /player|玩家|我方|己方|友方/i.test(String(entry?.side || '')) ? 'PLAYER' : 'ENEMY';
  }

  function normalizeObjectiveCondition(condition = {}) {
    if (!condition || typeof condition !== 'object') return null;
    const typeAliases = {
      敌方全员失能: 'TEAM_INCAPACITATED',
      我方全员失能: 'TEAM_INCAPACITATED',
      全员失能: 'TEAM_INCAPACITATED',
      生命阈值: 'HP_RATIO_AT_OR_BELOW',
      坚持回合: 'ROUND_REACHED',
      指定单位受伤: 'UNIT_DAMAGED',
      指定单位失能: 'UNIT_INCAPACITATED',
      指定单位死亡: 'UNIT_DEAD',
      全员死亡: 'TEAM_DEAD',
      敌方全员死亡: 'TEAM_DEAD',
      我方全员死亡: 'TEAM_DEAD',
      成功撤离: 'WITHDRAW_SUCCESS',
    };
    const rawType = String(condition.type || condition.类型 || '').trim();
    const type = String(typeAliases[rawType] || rawType).trim().toUpperCase();
    if (!['TEAM_INCAPACITATED', 'TEAM_DEAD', 'HP_RATIO_AT_OR_BELOW', 'ROUND_REACHED', 'UNIT_DAMAGED', 'UNIT_INCAPACITATED', 'UNIT_DEAD', 'WITHDRAW_SUCCESS'].includes(type)) return null;
    const inferredSide = rawType.startsWith('我方') ? 'PLAYER' : rawType.startsWith('敌方') ? 'ENEMY' : '';
    const side = normalizeObjectiveSide(condition.side || condition.阵营 || inferredSide);
    const targetSource = condition.targetIds || condition.目标 || condition.targets || [];
    const targetIds = (Array.isArray(targetSource) ? targetSource : String(targetSource || '').split(/[、,，]/u))
      .map(item => String(item || '').trim())
      .filter(item => item && !/^(全体|全员|ALL)$/i.test(item));
    const thresholdRaw = condition.threshold ?? condition.thresholdRatio ?? condition.阈值 ?? 0;
    const thresholdNumber = Number.parseFloat(String(thresholdRaw).replace('%', ''));
    const threshold = Number.isFinite(thresholdNumber)
      ? clamp(String(thresholdRaw).includes('%') || thresholdNumber > 1 ? thresholdNumber / 100 : thresholdNumber, 0, 1)
      : 0;
    const round = Math.max(0, Math.floor(Number(condition.round ?? condition.rounds ?? condition.回合 ?? condition.回合数 ?? 0)));
    const baselineHp = condition.baselineHp && typeof condition.baselineHp === 'object'
      ? Object.fromEntries(Object.entries(condition.baselineHp).map(([key, value]) => [String(key), Math.max(0, Number(value) || 0)]))
      : {};
    return Object.freeze({
      type,
      side,
      targetIds: Object.freeze(targetIds),
      scope: /^(ALL|全部|全体)$/i.test(String(condition.scope || condition.判定 || (['TEAM_INCAPACITATED', 'TEAM_DEAD'].includes(type) ? 'ALL' : 'ANY')).trim()) ? 'ALL' : 'ANY',
      threshold,
      round,
      requireActive: condition.requireActive !== false && condition.存活要求 !== false,
      baselineHp: Object.freeze(baselineHp),
    });
  }

  function normalizeObjectiveGroup(group = {}, fallbackConditions = []) {
    const source = Array.isArray(group) ? group : Array.isArray(group?.conditions) ? group.conditions : Array.isArray(group?.条件) ? group.条件 : fallbackConditions;
    const conditions = source.map(normalizeObjectiveCondition).filter(Boolean);
    return Object.freeze({
      logic: /^(AND|ALL|全部|同时)$/i.test(String(group?.logic || group?.逻辑 || 'ANY').trim()) ? 'ALL' : 'ANY',
      conditions: Object.freeze(conditions),
    });
  }

  function freezeObjectiveTargetIds(group = {}, worldSnapshot = {}) {
    return Object.freeze({
      ...group,
      conditions: Object.freeze((group.conditions || []).map(condition => {
        if (
          (condition.targetIds || []).length ||
          condition.type === 'WITHDRAW_SUCCESS'
        ) {
          return condition;
        }
        const targetIds = listUnits(worldSnapshot)
          .filter(entry =>
            !condition.side ||
            objectiveSideOfEntry(entry) === condition.side
          )
          .map(entry => entry.unit)
          .filter(unit => !isSummonUnit(unit))
          .map(unit => unitId(unit))
          .filter(Boolean);
        return Object.freeze({
          ...condition,
          targetIds: Object.freeze(targetIds),
        });
      })),
    });
  }

  function normalizeBattleObjectives(raw = {}, worldSnapshot = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const currentRound = Math.max(0, Math.floor(Number(worldSnapshot?.回合 || 0)));
    let byRound = normalizedObjectivesCache.get(source);
    if (byRound?.has(currentRound)) return byRound.get(currentRound);
    if (!byRound) {
      byRound = new Map();
      normalizedObjectivesCache.set(source, byRound);
    }
    const explicit = source.explicit === true || source.explicit !== false && Object.keys(source).some(key => !['version', 'explicit'].includes(key));
    const victorySource = source.victory || source.胜利 || {};
    const defeatSource = source.defeat || source.失败 || {};
    const victory = freezeObjectiveTargetIds(
      normalizeObjectiveGroup(victorySource, [{ type: 'TEAM_INCAPACITATED', side: 'ENEMY' }]),
      worldSnapshot,
    );
    const defeat = freezeObjectiveTargetIds(
      normalizeObjectiveGroup(defeatSource, [{ type: 'TEAM_INCAPACITATED', side: 'PLAYER' }]),
      worldSnapshot,
    );
    const result = Object.freeze({
      version: 1,
      explicit,
      startRound: Math.max(0, Math.floor(Number(source.startRound ?? source.起始回合 ?? currentRound))),
      maxRounds: Math.max(1, Math.min(20, Math.floor(Number(source.maxRounds ?? source.回合上限 ?? 20) || 20))),
      resolutionPriority: /^(DRAW_ON_CONFLICT|平局)$/i.test(String(source.resolutionPriority || source.冲突处理 || 'DEFEAT_FIRST').trim()) ? 'DRAW_ON_CONFLICT' : 'DEFEAT_FIRST',
      victory,
      defeat,
    });
    byRound.set(currentRound, result);
    return result;
  }

  function buildObjectiveUnitIndex(worldSnapshot = {}) {
    const entries = listUnits(worldSnapshot);
    const byId = new Map();
    const byName = new Map();
    entries.forEach(entry => {
      const id = unitId(entry.unit);
      const name = unitName(entry.unit);
      if (id) byId.set(id, entry);
      if (name) byName.set(name, entry);
    });
    return {
      entries,
      byId,
      byName,
      playerUnits: entries
        .filter(entry =>
          objectiveSideOfEntry(entry) === 'PLAYER' &&
          !isSummonUnit(entry.unit)
        )
        .map(entry => entry.unit),
      enemyUnits: entries
        .filter(entry =>
          objectiveSideOfEntry(entry) === 'ENEMY' &&
          !isSummonUnit(entry.unit)
        )
        .map(entry => entry.unit),
      conditionUnits: new WeakMap(),
    };
  }

  function objectiveUnits(worldSnapshot = {}, condition = {}, unitIndex = null) {
    const targetIds = new Set(condition.targetIds || []);
    const index = unitIndex || buildObjectiveUnitIndex(worldSnapshot);
    const cached = index.conditionUnits?.get(condition);
    if (cached) return cached;
    const entries = targetIds.size
      ? [...new Set([...targetIds].map(targetId =>
          index.byId.get(targetId) || index.byName.get(targetId)
        ).filter(Boolean))]
      : index.entries;
    const units = entries
      .filter(entry =>
        !condition.side ||
        objectiveSideOfEntry(entry) === condition.side
      )
      .map(entry => entry.unit);
    index.conditionUnits?.set(condition, units);
    return units;
  }

  function objectiveUnitState(unit = {}, options = {}) {
    const unitIdValue = unitId(unit);
    const overrides = options?.objectiveStateByUnitId;
    const override = overrides instanceof Map
      ? overrides.get(unitIdValue)
      : overrides && typeof overrides === 'object'
        ? overrides[unitIdValue]
        : null;
    const initialStates = options?.initialObjectiveStateByUnitId;
    const initial = initialStates instanceof Map
      ? initialStates.get(unitIdValue)
      : initialStates && typeof initialStates === 'object'
        ? initialStates[unitIdValue]
        : null;
    const hp = Number.isFinite(Number(override?.hp))
      ? Number(override.hp)
      : Number.isFinite(Number(initial?.hp))
        ? Number(initial.hp)
        : readHp(unit);
    const alive = override?.alive === true
      ? true
      : override?.alive === false
        ? false
        : initial?.alive === true
          ? true
          : initial?.alive === false
            ? false
            : !isDead(unit);
    const capable = override?.capable === true
      ? true
      : override?.capable === false
        ? false
        : initial?.capable === true
          ? true
          : initial?.capable === false
            ? false
            : isBattleCapable(unit);
    return { hp, alive, capable };
  }

  function calculateNonlethalHpFloor(worldSnapshot = {}, target = {}, battleIntent = {}) {
    const mode = String(
      battleIntent?.mode ||
      battleIntent?.intent ||
      (typeof battleIntent === 'string' ? battleIntent : '') ||
      worldSnapshot?.战斗意图 ||
      '',
    ).trim();
    if (!/点到为止|切磋|训练|非致命/.test(mode)) return 0;
    const objectives = normalizeBattleObjectives(
      battleIntent?.objectives ||
      battleIntent?.胜负条件 ||
      worldSnapshot?.胜负条件 ||
      {},
      worldSnapshot,
    );
    const thresholds = [
      ...objectives.victory.conditions,
      ...objectives.defeat.conditions,
    ].filter(condition =>
      condition.type === 'HP_RATIO_AT_OR_BELOW' &&
      condition.threshold > 0 &&
      objectiveUnits(worldSnapshot, condition).some(unit => unitId(unit) === unitId(target)),
    ).map(condition => condition.threshold);
    const threshold = thresholds.length ? Math.max(...thresholds) : 0;
    return Math.max(1, Math.floor(readHpMax(target) * threshold));
  }

  function readIncapacityReason(unit = {}) {
    if (isDead(unit)) return 'DEAD';
    const runtimeReason = String(unit?.__战斗失能原因 || '').trim();
    if (runtimeReason) return runtimeReason;
    const actionState = String(
      unit?.状态?.行动 || unit?.actionState || unit?.行动状态 || '',
    ).trim();
    if (/昏迷|UNCONSCIOUS/i.test(actionState)) return 'UNCONSCIOUS';
    if (/失去战斗力|投降|制服|INCAPACITATED/i.test(actionState)) {
      return 'INCAPACITATED';
    }
    if (readResource(unit, '体力') <= 0) return 'STAMINA_EXHAUSTED';
    return '';
  }

  function evaluateObjectiveConditionCore(
    worldSnapshot = {},
    condition = {},
    options = {},
    includeDetails = false,
  ) {
    if (condition.type === 'WITHDRAW_SUCCESS') {
      const successfulSides = new Set(
        Array.isArray(worldSnapshot?.__battleRuntime?.withdrawalSuccessSides)
          ? worldSnapshot.__battleRuntime.withdrawalSuccessSides.map(value => String(value || '').trim().toUpperCase()).filter(Boolean)
          : [],
      );
      const conditionSide = String(condition.side || '').trim().toUpperCase();
      const matched = conditionSide
        ? successfulSides.has(conditionSide)
        : worldSnapshot?.__battleRuntime?.withdrawalSuccess === true;
      return includeDetails
        ? Object.freeze({
            condition,
            matched,
            unitResults: Object.freeze([]),
            reason: matched ? 'WITHDRAW_SUCCESS' : '',
          })
        : matched;
    }
    if (condition.type === 'ROUND_REACHED') {
      if (options.roundCompleted !== true) {
        return includeDetails
          ? Object.freeze({
              condition,
              matched: false,
              unitResults: Object.freeze([]),
              reason: '',
            })
          : false;
      }
      const elapsedRounds = Math.max(0, Number(options.round ?? worldSnapshot?.回合 ?? 0) - Number(options.startRound || 0));
      if (elapsedRounds < condition.round) {
        return includeDetails
          ? Object.freeze({
              condition,
              matched: false,
              unitResults: Object.freeze([]),
              reason: '',
            })
          : false;
      }
      if (!condition.requireActive) {
        return includeDetails
          ? Object.freeze({
              condition,
              matched: true,
              unitResults: Object.freeze([]),
              reason: 'ROUND_REACHED',
            })
          : true;
      }
      const units = objectiveUnits(
        worldSnapshot,
        condition,
        options.unitIndex,
      );
      if (!includeDetails) {
        return units.length > 0 &&
          units.some(unit => objectiveUnitState(unit, options).capable);
      }
      const unitResults = units.map(unit => {
        const state = objectiveUnitState(unit, options);
        return Object.freeze({
          unitId: unitId(unit),
          unitName: unitName(unit),
          matched: state.capable,
          reason: state.capable ? 'ACTIVE' : readIncapacityReason(unit),
        });
      });
      const matched = unitResults.length > 0 && unitResults.some(result => result.matched);
      return Object.freeze({ condition, matched, unitResults: Object.freeze(unitResults), reason: matched ? 'ROUND_REACHED' : '' });
    }
    const units = objectiveUnits(
      worldSnapshot,
      condition,
      options.unitIndex,
    );
    if (!units.length) {
      return includeDetails
        ? Object.freeze({
            condition,
            matched: false,
            unitResults: Object.freeze([]),
            reason: 'NO_TARGET',
          })
        : false;
    }
    const matchReason = unit => {
      const state = objectiveUnitState(unit, options);
      if (condition.type === 'TEAM_INCAPACITATED' || condition.type === 'UNIT_INCAPACITATED') {
        return !state.capable
          ? !state.alive || state.hp <= 0
            ? 'DEAD'
            : readIncapacityReason(unit) || 'INCAPACITATED'
          : '';
      }
      if (condition.type === 'TEAM_DEAD' || condition.type === 'UNIT_DEAD') {
        return !state.alive || state.hp <= 0 ? 'DEAD' : '';
      }
      if (condition.type === 'HP_RATIO_AT_OR_BELOW') {
        return state.hp / Math.max(1, readHpMax(unit)) <=
          condition.threshold + 1e-9
          ? 'HP_THRESHOLD_REACHED'
          : '';
      }
      if (condition.type === 'UNIT_DAMAGED') {
        const baseline = Number(condition.baselineHp?.[unitId(unit)] ?? condition.baselineHp?.[unitName(unit)] ?? readHpMax(unit));
        return state.hp < Math.max(0, baseline) - 1e-9
          ? 'UNIT_DAMAGED'
          : '';
      }
      return '';
    };
    if (!includeDetails) {
      return condition.scope === 'ALL'
        ? units.every(unit => !!matchReason(unit))
        : units.some(unit => !!matchReason(unit));
    }
    const unitResults = units.map(unit => {
      const reason = matchReason(unit);
      return Object.freeze({
        unitId: unitId(unit),
        unitName: unitName(unit),
        matched: !!reason,
        reason,
      });
    });
    const matched = condition.scope === 'ALL' ? unitResults.every(result => result.matched) : unitResults.some(result => result.matched);
    const reason = matched ? unitResults.find(result => result.matched)?.reason || condition.type : '';
    return Object.freeze({ condition, matched, unitResults: Object.freeze(unitResults), reason });
  }

  function evaluateObjectiveConditionDetail(worldSnapshot = {}, condition = {}, options = {}) {
    return evaluateObjectiveConditionCore(
      worldSnapshot,
      condition,
      options,
      true,
    );
  }

  function evaluateObjectiveCondition(worldSnapshot = {}, condition = {}, options = {}) {
    return evaluateObjectiveConditionCore(
      worldSnapshot,
      condition,
      options,
      false,
    );
  }

  function evaluateBattleObjectivesCore(
    worldSnapshot = {},
    rawObjectives = {},
    options = {},
    includeDetails = true,
  ) {
    const objectives = options?.objectivesAlreadyNormalized === true
      ? rawObjectives
      : normalizeBattleObjectives(rawObjectives, worldSnapshot);
    const unitIndex = options?.unitIndex || buildObjectiveUnitIndex(worldSnapshot);
    const evaluateGroup = group => {
      const conditionOptions = {
        ...options,
        startRound: objectives.startRound,
        unitIndex,
      };
      const details = includeDetails
        ? group.conditions.map(condition =>
            evaluateObjectiveConditionDetail(
              worldSnapshot,
              condition,
              conditionOptions,
            )
          )
        : [];
      const matches = includeDetails
        ? details.map(detail => detail.matched)
        : group.conditions.map(condition =>
            evaluateObjectiveCondition(
              worldSnapshot,
              condition,
              conditionOptions,
            )
          );
      return {
        matched: matches.length > 0 && (group.logic === 'ALL' ? matches.every(Boolean) : matches.some(Boolean)),
        matches,
        details,
      };
    };
    const victory = evaluateGroup(objectives.victory);
    const defeat = evaluateGroup(objectives.defeat);
    const playerExhausted = includeDetails &&
      unitIndex.playerUnits.length > 0 &&
      unitIndex.playerUnits.every(unit => !objectiveUnitState(unit, options).capable);
    const enemyExhausted = includeDetails &&
      unitIndex.enemyUnits.length > 0 &&
      unitIndex.enemyUnits.every(unit => !objectiveUnitState(unit, options).capable);
    const exhaustionDetail = (side, matched) => Object.freeze({
      condition: Object.freeze({
        type: 'TEAM_INCAPACITATED',
        side,
        targetIds: Object.freeze([]),
        scope: 'ALL',
        implicit: true,
      }),
      matched,
      unitResults: Object.freeze([]),
      reason: matched ? 'BATTLEFIELD_EXHAUSTION' : '',
    });
    const elapsedRounds = Math.max(0, Number(options.round ?? worldSnapshot?.回合 ?? 0) - objectives.startRound);
    const timeLimitReached = options.roundCompleted === true && options.enforceRoundLimit === true && elapsedRounds >= objectives.maxRounds;
    const implicitVictory = includeDetails
      ? exhaustionDetail('ENEMY', enemyExhausted)
      : null;
    const implicitDefeat = includeDetails
      ? exhaustionDetail('PLAYER', playerExhausted)
      : null;
    const effectiveVictoryMatched = victory.matched;
    const effectiveDefeatMatched = defeat.matched;
    const victoryObjectiveMatched = victory.matched;
    const defeatObjectiveMatched = defeat.matched;
    let status = 'ONGOING';
    if (effectiveVictoryMatched && effectiveDefeatMatched) status = objectives.resolutionPriority === 'DRAW_ON_CONFLICT' ? 'DRAW' : 'ENEMY_WIN';
    else if (effectiveVictoryMatched) status = 'PLAYER_WIN';
    else if (effectiveDefeatMatched) status = 'ENEMY_WIN';
    else if (timeLimitReached) status = 'DRAW';
    const exhaustionResolution = includeDetails && (enemyExhausted || playerExhausted)
      ? Object.freeze({
          playerExhausted,
          enemyExhausted,
          victory: implicitVictory,
          defeat: implicitDefeat,
        })
      : null;
    const resolvedVictoryDetails = victory.details;
    const resolvedDefeatDetails = defeat.details;
    const result = {
      status,
      winner: status === 'PLAYER_WIN' ? 'player' : status === 'ENEMY_WIN' ? 'enemy' : status === 'DRAW' ? 'draw' : 'unfinished',
      terminal: status !== 'ONGOING',
      victoryMatches: Object.freeze(victory.matches),
      defeatMatches: Object.freeze(defeat.matches),
      victoryDetails: Object.freeze(resolvedVictoryDetails),
      defeatDetails: Object.freeze(resolvedDefeatDetails),
      matchedDetails: Object.freeze((status === 'PLAYER_WIN' ? resolvedVictoryDetails : status === 'ENEMY_WIN' ? resolvedDefeatDetails : [...resolvedVictoryDetails, ...resolvedDefeatDetails]).filter(detail => detail.matched)),
      timeLimitReached,
      terminalReason: victoryObjectiveMatched && defeatObjectiveMatched
        ? 'OBJECTIVE_CONFLICT'
        : victoryObjectiveMatched
          ? 'OBJECTIVE_VICTORY'
          : defeatObjectiveMatched
            ? 'OBJECTIVE_DEFEAT'
            : timeLimitReached ? 'ROUND_LIMIT_REACHED' : '',
      exhaustionResolution,
      objectives,
    };
    return Object.freeze(includeDetails
      ? result
      : {
          status: result.status,
          winner: result.winner,
          terminal: result.terminal,
          timeLimitReached: result.timeLimitReached,
          terminalReason: result.terminalReason,
          objectives,
        });
  }

  function evaluateBattleObjectives(worldSnapshot = {}, rawObjectives = {}, options = {}) {
    return evaluateBattleObjectivesCore(
      worldSnapshot,
      rawObjectives,
      options,
      true,
    );
  }

  function evaluateBattleObjectivesCompact(worldSnapshot = {}, rawObjectives = {}, options = {}) {
    return evaluateBattleObjectivesCore(
      worldSnapshot,
      rawObjectives,
      options,
      false,
    );
  }

  function parseSignedRange(value) {
    if (typeof value === 'number') return null;
    const text = String(value ?? '').trim();
    const match = text.match(
      /^([+-]?\d+(?:\.\d+)?)(%?)\s*[~～]\s*([+-]?\d+(?:\.\d+)?)(%?)$/,
    );
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[3]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return null;
    }
    return {
      lower: Math.min(first, second),
      upper: Math.max(first, second),
      isPercent: match[2] === '%' || match[4] === '%',
    };
  }

  function signedRangeValue(range, base, ratio) {
    const scalar =
      range.lower +
      clamp(Number(ratio || 0), 0, 1) *
        (range.upper - range.lower);
    return range.isPercent
      ? Number(base || 0) * scalar / 100
      : scalar;
  }

  function parseSignedValue(value, base = 0) {
    if (typeof value === 'number') return Number(value) || 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const range = parseSignedRange(text);
    if (range) return signedRangeValue(range, base, 0.5);
    const numeric = Number.parseFloat(text.replace('%', ''));
    if (!Number.isFinite(numeric)) return 0;
    return text.includes('%') ? Number(base || 0) * numeric / 100 : numeric;
  }

  const sideEffectTriggerSet = new Set(['效果生效后', '命中后', '回合结束时', '效果结束后']);
  const sideEffectTargetSet = new Set(['技能释放者', '效果承受者', '双方']);
  const sideEffectStatusMap = Object.freeze({
    全属性降低: '虚弱', 自损反噬: '反噬', 精神紊乱: '精神紊乱', 魂力反噬: '魂力枯竭',
    命中下降: '精神紊乱', 动作迟缓: '迟缓', 目标错乱: '混乱', 施法僵直: '僵直',
  });
  const sideEffectTypeSet = new Set([
    '全属性降低', '自损反噬', '致死献祭', '精神紊乱', '魂力反噬',
    '命中下降', '动作迟缓', '目标错乱', '施法僵直',
  ]);

  function readSignedBattleValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (/%$/.test(text)) {
      const percent = Number(text.replace('%', ''));
      return Number.isFinite(percent) ? percent / 100 : 0;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeSideEffectEntry(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const type = String(value.副作用类型 || '').trim();
    if (!sideEffectTypeSet.has(type)) return null;
    const rawTrigger = String(value.触发时机 || '效果生效后').trim();
    const trigger = sideEffectTriggerSet.has(rawTrigger) ? rawTrigger : '效果生效后';
    const rawTarget = String(value.生效对象 || '技能释放者').trim();
    const target = sideEffectTargetSet.has(rawTarget) ? rawTarget : '技能释放者';
    const duration = Math.max(0, Math.round(Number(value.持续回合 || 0)));
    const rawChance = Number(value.触发概率 ?? 1);
    const chance = Number.isFinite(rawChance) ? Math.max(0, Math.min(1, Number(rawChance.toFixed(4)))) : 1;
    const normalized = { 副作用类型: type, 触发时机: trigger, 生效对象: target, 触发概率: chance };
    if (type !== '致死献祭') {
      normalized.持续回合 = duration || 1;
      normalized.副作用状态 = String(value.副作用状态 || sideEffectStatusMap[type] || type).trim();
      if (String(value.数值 ?? '').trim()) normalized.数值 = String(value.数值 ?? '').trim();
      if (String(value.副数值 ?? '').trim()) normalized.副数值 = String(value.副数值 ?? '').trim();
    }
    if (trigger === '效果结束后') {
      const boundState = String(value.关联状态 || '').trim();
      if (boundState) normalized.关联状态 = boundState;
    }
    return normalized;
  }

  function normalizeSideEffectList(value = []) {
    return (Array.isArray(value) ? value : []).map(normalizeSideEffectEntry).filter(Boolean);
  }

  function findRuleSuppression(unit = {}, prototype = '', field = '', value = '') {
    const allValues = new Set(['全部', '抹消全部', '全部状态', '全部规则', '全部资源', '全部结算', '全部属性', '全部原型']);
    for (const condition of Object.values(unit?.状态效果 || {})) {
      const rules = Array.isArray(condition?.抹消规则) ? condition.抹消规则 : [];
      for (let index = 0; index < rules.length; index += 1) {
        const object = rules[index]?.抹消对象;
        const matcher = object && typeof object === 'object' && !Array.isArray(object) ? object : { 原型: String(object || '').trim() };
        if (String(matcher?.原型 || '机制授予').trim() !== prototype) continue;
        const values = (Array.isArray(matcher?.[field]) ? matcher[field] : String(matcher?.[field] ?? '').split(/[、,，|/]/))
          .map(entry => String(entry || '').trim())
          .filter(Boolean);
        if (values.length && !values.some(entry => allValues.has(entry) || entry === value)) continue;
        const hit = { 状态: condition, 规则索引: index, 抹消对象: matcher };
        if (String(rules[index]?.抹消方式 || '').trim() === '阻断本次') rules.splice(index, 1);
        return hit;
      }
    }
    return null;
  }

  function deathSaveCount(unit = {}) {
    let count = 0;
    for (const state of Object.values(unit.状态效果 || {})) count += Math.max(0, Number(state?.战斗效果?.death_save_count || 0));
    return count > 0 && findRuleSuppression(unit, '规则防御', '规则', '免死') ? 0 : count;
  }

  function ruleBlockCount(unit = {}) {
    if (findRuleSuppression(unit, '规则防御', '规则', '免伤')) return 0;
    return Object.values(unit.状态效果 || {}).reduce((sum, state) => sum +
      (String(state?.规则 || state?.防御对象 || '').trim() === '免伤' ? Math.max(0, Number(state.战斗效果?.block_count || 0)) : 0), 0);
  }

  function consumeRuleBlockCharges(unit, requested = 1) {
    let remaining = Math.max(0, Number(requested || 0));
    if (!remaining || !ruleBlockCount(unit)) return [];
    const consumed = [];
    for (const [stateKey, state] of Object.entries(unit.状态效果 || {})) {
      if (String(state?.规则 || state?.防御对象 || '').trim() !== '免伤') continue;
      const count = Math.max(0, Number(state.战斗效果?.block_count || 0)), amount = Math.min(count, remaining);
      if (!amount) continue;
      state.战斗效果.block_count = count - amount;
      consumed.push({ stateKey, state, amount, remainingCount: count - amount });
      remaining -= amount;
      if (remaining <= 1e-12) break;
    }
    return consumed;
  }

  function consumeDeathSaveCharges(unit, requested = 1) {
    let remaining = Math.max(0, Number(requested || 0));
    if (!remaining || !deathSaveCount(unit)) return [];
    const consumed = [];
    for (const [stateKey, state] of Object.entries(unit.状态效果 || {})) {
      const count = Math.max(0, Number(state?.战斗效果?.death_save_count || 0));
      const amount = Math.min(count, remaining);
      if (!amount) continue;
      state.战斗效果.death_save_count = count - amount;
      consumed.push({ stateKey, state, amount, remainingCount: count - amount });
      remaining -= amount;
      if (remaining <= 1e-12) break;
    }
    return consumed;
  }

  function triggerStateRevive(unit = {}, label = '目标', writeResource = setResourceValue) {
    if (!unit || typeof unit !== 'object' || unit.__本阶段已触发复活) return null;
    if (!unit.状态效果 || typeof unit.状态效果 !== 'object') unit.状态效果 = {};
    const candidate = Object.entries(unit.状态效果)
      .map(([key, condition]) => ({ key, condition, effects: condition?.战斗效果 || {} }))
      .filter(entry => Number(entry.effects.revive_count || 0) > 0)
      .sort((left, right) => Number(right.effects.revive_count || 0) - Number(left.effects.revive_count || 0))[0];
    if (!candidate) return null;
    if (findRuleSuppression(unit, '规则防御', '规则', '复活')) {
      return { handled: true, revived: false, log: `[复活受阻] ${label}的复活机制已被机制抹消封锁，无法触发！` };
    }
    const nextCount = Math.max(0, Number(candidate.effects.revive_count || 0) - 1);
    candidate.effects.revive_count = nextCount;
    const healRatio = Math.max(0.05, Number(candidate.effects.revive_heal_ratio || 0.25));
    const maxHp = readHpMax(unit);
    const restoreAmount = Math.max(1, Math.floor(maxHp * healRatio));
    writeResource(unit, 'hp', Math.min(maxHp, Math.max(restoreAmount, readHp(unit) + restoreAmount)));
    unit.__本阶段已触发复活 = true;
    return {
      handled: true,
      revived: true,
      stateKey: candidate.key,
      state: candidate.condition,
      restoreAmount,
      remainingCount: nextCount,
      log: `[复活触发] ${label}借[${candidate.key}]重燃战意，恢复 ${restoreAmount} 点HP！剩余复活次数:${nextCount}`,
    };
  }

  function findPassiveReviveCandidate(unit = {}) {
    const roots = Object.entries(unit || {})
      .filter(([key, value]) => /^(?:第\d+)?武魂|血脉之力|魂骨|装备|自创魂技|技能/.test(key) && value && typeof value === 'object')
      .map(([, value]) => value);
    if (Array.isArray(unit?.技能列表) && unit.技能列表.length) roots.unshift(unit.技能列表);
    const seen = new Set();
    let found = null;
    const visit = value => {
      if (found || !value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const effect = (isPassiveSkill(value) && Array.isArray(value?._效果数组) ? value._效果数组 : []).find(entry =>
        String(entry?.原型 || '').trim() === '规则改写' &&
        String(entry?.规则 || '').trim() === '死亡转存活' &&
        String(entry?.目标 || '自身').trim() === '自身'
      );
      if (effect) {
        found = { skill: value, effect };
        return;
      }
      Object.entries(value).forEach(([key, child]) => {
        if (/状态效果|战斗历史|历史快照|参战者|复制效果|__battleRuntime|__行动闭环诊断/.test(key)) return;
        visit(child);
      });
    };
    roots.forEach(visit);
    return found;
  }

  function passiveRevivalBudget(unit = {}) {
    const candidate = findPassiveReviveCandidate(unit);
    if (!candidate) return null;
    const limit = candidate.effect?.触发限制;
    const period = String(limit?.周期 || '').trim(), allowedCount = Math.max(0, Math.floor(Number(limit?.次数 || 0)));
    const name = String(candidate.skill?.name || candidate.skill?.魂技名 || '被动技能').trim() || '被动技能';
    const key = `被动:${name}:死亡转存活`, usedCount = Math.max(0, Number(unit.__技能限制运行态?.[key]?.已用次数 || 0));
    const limited = allowedCount > 0 && ['每日', '每战', '每回合', '每次满足'].includes(period);
    return { candidate, key, period, allowedCount, usedCount, limited, remainingCount: limited ? Math.max(0, allowedCount - usedCount) : Infinity };
  }

  function triggerRevive(unit = {}, label = '目标', writeResource = setResourceValue, onRevive = null) {
    const stateResult = triggerStateRevive(unit, label, writeResource);
    if (stateResult?.handled === true) {
      if (stateResult.revived && onRevive) onRevive(stateResult);
      return stateResult.log || null;
    }
    if (!unit || typeof unit !== 'object' || unit.__本阶段已触发复活) return null;
    const budget = passiveRevivalBudget(unit);
    if (!budget) return null;
    const { candidate, allowedCount } = budget;
    const limitState = unit.__技能限制运行态 ||= {};
    const skillLimit = limitState[budget.key] ||= { 已用次数: 0 };
    if (budget.remainingCount <= 0) return null;
    if (findRuleSuppression(unit, '规则改写', '规则', '死亡转存活')) {
      return `[复活受阻] ${label}的死亡转存活规则已被机制抹消封锁，无法触发！`;
    }
    if (allowedCount > 0) skillLimit.已用次数 = Math.max(0, Number(skillLimit.已用次数 || 0)) + 1;
    const healRatio = Math.max(0.05, Math.abs(Number(readSignedBattleValue(candidate.effect?.数值 ?? candidate.effect?.强度 ?? '+25%')) || 0.25));
    const maxHp = readHpMax(unit);
    const restoreAmount = Math.max(1, Math.floor(maxHp * Math.min(1, healRatio)));
    writeResource(unit, 'hp', Math.min(maxHp, Math.max(restoreAmount, readHp(unit) + restoreAmount)));
    unit.__本阶段已触发复活 = true;
    const sourceName = candidate.skill?.name || candidate.skill?.魂技名 || '死亡转存活';
    if (onRevive) onRevive({ revived: true, restoreAmount, skill: candidate.skill, effect: candidate.effect,
      remainingCount: budget.limited ? Math.max(0, budget.remainingCount - 1) : undefined });
    return `[复活触发] ${label}触发[${sourceName}]，按死亡转存活规则恢复 ${restoreAmount} 点HP！`;
  }

  function buildSideEffectPayload(effect = {}) {
    const type = String(effect?.副作用类型 || '').trim();
    const [value, secondaryValue] = ['数值', '副数值'].map(field =>
      Math.abs(readSignedBattleValue(effect?.[field] || '0')),
    );
    const statRatios = {};
    const combatEffects = {};
    if (type === '致死献祭') combatEffects.致死 = true;
    if (type === '全属性降低') {
      const ratio = Math.max(0.01, 1 - (value || 0.1));
      ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => { statRatios[key] = ratio; });
    }
    if (type === '自损反噬') {
      combatEffects.misfortune_backlash_ratio = value || 0.03;
      combatEffects.hit_penalty = Math.max(0.03, (value || 0.03) * 0.5);
    }
    if (type === '精神紊乱') {
      combatEffects.random_target_rate = value || 0.25;
      combatEffects.reaction_penalty = secondaryValue || 0.08;
    }
    if (type === '命中下降') combatEffects.hit_penalty = value || 0.1;
    if (type === '魂力反噬') {
      combatEffects.sp_gain_ratio = -(value || 0.05);
      combatEffects.cost_delta_ratio = secondaryValue || Math.max(0.05, value || 0.05);
    }
    if (type === '动作迟缓') {
      combatEffects.reaction_penalty = value || 0.15;
      combatEffects.dodge_penalty = secondaryValue || 0.1;
      combatEffects.cast_speed_penalty = value || 0.15;
    }
    if (type === '施法僵直') combatEffects.cast_speed_penalty = value || 0.2;
    if (type === '目标错乱') combatEffects.random_target_rate = value || 0.3;
    return { statRatios, combatEffects };
  }

  function sampleSignedValue(
    value,
    base = 0,
    randomSource = Math.random,
  ) {
    const range = parseSignedRange(value);
    if (!range) return parseSignedValue(value, base);
    const sampled = Number(
      typeof randomSource === 'function'
        ? randomSource()
        : 0.5,
    );
    return signedRangeValue(
      range,
      base,
      Number.isFinite(sampled) ? sampled : 0.5,
    );
  }

  function sampleSignedValueExpression(
    value,
    randomSource = Math.random,
  ) {
    const range = parseSignedRange(value);
    if (!range) return value;
    const sampled = Number(
      typeof randomSource === 'function'
        ? randomSource()
        : 0.5,
    );
    const scalar =
      range.lower +
      clamp(
        Number.isFinite(sampled) ? sampled : 0.5,
        0,
        1,
      ) * (range.upper - range.lower);
    return range.isPercent ? `${scalar}%` : scalar;
  }

  function classifyDamageType(value = '') {
    const text = String(value || '').trim();
    if (/真实/.test(text)) return 'TRUE';
    if (/精神/.test(text)) return 'MENTAL';
    if (/远程/.test(text)) return 'RANGED';
    return 'MELEE';
  }

  function resourceDriveScale(
    actor = {},
    target = {},
    resource = '魂力',
    projectionContext = null,
  ) {
    const actorProfile = mechanicalProjectionProfile(
      projectionContext,
      actor,
    );
    const targetProfile = mechanicalProjectionProfile(
      projectionContext,
      target,
    );
    const actorMax = Number.isFinite(
      Number(actorProfile?.resourceMax?.[resource]),
    )
      ? Number(actorProfile.resourceMax[resource])
      : readResourceMax(actor, resource);
    const targetMax = Number.isFinite(
      Number(targetProfile?.resourceMax?.[resource]),
    )
      ? Number(targetProfile.resourceMax[resource])
      : readResourceMax(target, resource);
    return clamp(Math.pow(Math.max(0.01, actorMax / Math.max(1, targetMax)), 0.45), 0.35, 1.85);
  }

  function calculateDamageTargetCoverage(effect = {}, targetCount = 1) {
    const count = Math.max(1, Math.floor(Number(targetCount || 1)));
    const targetScope = String(effect?.目标 || '单体').trim() || '单体';
    const multiTarget = /全场|群体/.test(targetScope);
    const coverageBudget = /全场/.test(targetScope)
      ? 2.6
      : /群体/.test(targetScope)
        ? 1.8
        : 1;
    return Object.freeze({
      targetScope,
      targetCount: count,
      coverageBudget,
      multiplier: multiTarget ? Math.min(1, coverageBudget / count) : 1,
    });
  }

  function statValueWithoutStateSource(unit = {}, key = '', excludedSourceKey = '', actualValue = 1) {
    const breakdown = readCombatStatBreakdown(unit, key);
    let fullValue = breakdown.base;
    let excludedValue = breakdown.base;
    collectStateEntries(unit).forEach(([stateKey, state]) => {
      const ratio = Number(state?.面板修改比例?.[key] ?? 1);
      const fixed = Number(state?.面板固定修正?.[key] ?? 0);
      const sourceKey = stateModifierSource(unit, stateKey, state).sourceKey;
      const apply = value => {
        let next = value;
        if (Number.isFinite(ratio)) next *= ratio;
        if (Number.isFinite(fixed)) next += fixed;
        return next;
      };
      fullValue = apply(fullValue);
      if (sourceKey !== excludedSourceKey) excludedValue = apply(excludedValue);
    });
    const staminaScale = Number(staminaScaleForUnit(unit));
    if (Number.isFinite(staminaScale)) {
      fullValue *= staminaScale;
      excludedValue *= staminaScale;
    }
    const normalizedFull = Math.max(1, fullValue);
    const snapshotScale = Math.max(1, Number(actualValue || 1)) / normalizedFull;
    return Math.max(1, excludedValue * snapshotScale);
  }

  function collectDamageStateModifierSources(actor = {}, target = {}, effect = {}, attackKey = 'str', defenseKey = 'def') {
    const groups = new Map();
    const register = (unit, stateKey, state, ownerRole, axes) => {
      const normalizedAxes = [...new Set(axes.map(value => String(value || '').trim()).filter(Boolean))];
      if (!normalizedAxes.length) return;
      const source = stateModifierSource(unit, stateKey, state, ownerRole, normalizedAxes);
      const existing = groups.get(source.sourceKey);
      if (existing) {
        normalizedAxes.forEach(axis => existing.axes.add(axis));
        return;
      }
      groups.set(source.sourceKey, {
        ...source,
        axes: new Set(normalizedAxes),
      });
    };
    collectStateEntries(actor).forEach(([stateKey, state]) => {
      const axes = [];
      const ratio = Number(state?.面板修改比例?.[attackKey] ?? 1);
      const fixed = Number(state?.面板固定修正?.[attackKey] ?? 0);
      const combatEffect = state?.战斗效果 || {};
      const damageMultiplier =
        Math.max(0, Number(combatEffect?.final_damage_mult ?? 1)) *
        Math.max(0, 1 + Number(combatEffect?.damage_bonus || combatEffect?.final_damage_bonus || 0));
      if (Number.isFinite(ratio) && Math.abs(ratio - 1) > 1e-9 || Number.isFinite(fixed) && Math.abs(fixed) > 1e-9) {
        axes.push(`ATTACK_STAT:${attackKey}`);
      }
      if (Math.abs(damageMultiplier - 1) > 1e-9) axes.push('OUTGOING_DAMAGE');
      if (Math.max(0, Number(combatEffect?.armor_pen || 0)) > 1e-9) axes.push('ARMOR_PENETRATION');
      if ((Array.isArray(combatEffect?.damage_bonus_limited) ? combatEffect.damage_bonus_limited : []).some(entry =>
        skillMatchesLimitedElements(effect, entry?.限定元素) && Math.abs(Number(entry?.数值 || 0)) > 1e-9
      )) axes.push('OUTGOING_DAMAGE_LIMITED');
      register(actor, stateKey, state, 'ACTOR', axes);
    });
    collectStateEntries(target).forEach(([stateKey, state]) => {
      const axes = [];
      const ratio = Number(state?.面板修改比例?.[defenseKey] ?? 1);
      const fixed = Number(state?.面板固定修正?.[defenseKey] ?? 0);
      const combatEffect = state?.战斗效果 || {};
      const damageMultiplier =
        Math.max(0, Number(combatEffect?.received_damage_mult ?? 1)) *
        Math.max(0, 1 - clamp(Number(combatEffect?.damage_reduction || 0), 0, 1));
      if (Number.isFinite(ratio) && Math.abs(ratio - 1) > 1e-9 || Number.isFinite(fixed) && Math.abs(fixed) > 1e-9) {
        axes.push(`DEFENSE_STAT:${defenseKey}`);
      }
      if (Math.abs(damageMultiplier - 1) > 1e-9) axes.push('INCOMING_DAMAGE');
      if ((Array.isArray(combatEffect?.damage_reduction_limited) ? combatEffect.damage_reduction_limited : []).some(entry =>
        skillMatchesLimitedElements(effect, entry?.限定元素) && Math.abs(Number(entry?.数值 || 0)) > 1e-9
      )) axes.push('INCOMING_DAMAGE_LIMITED');
      register(target, stateKey, state, 'TARGET', axes);
    });
    return [...groups.values()];
  }

  function buildDamageModifierAttribution(input = {}) {
    const {
      actor, target, effect, damageClass, attackKey, defenseKey, attack, rawDefense,
      penetration, powerRatio, resourceDrive, actorMultiplier, targetMultiplier,
      limitedOutgoingMultiplier, limitedIncomingMultiplier, actionDamageMultiplier,
      rawDamage,
    } = input;
    const actorStates = collectStateEntries(actor);
    const targetStates = collectStateEntries(target);
    const sourceKeyFor = (unit, stateKey, state) => stateModifierSource(unit, stateKey, state).sourceKey;
    const productWithout = (entries, unit, excludedSourceKey, factorForState) => entries.reduce(
      (product, [stateKey, state]) => sourceKeyFor(unit, stateKey, state) === excludedSourceKey
        ? product
        : product * factorForState(state),
      1,
    );
    return Object.freeze(
      collectDamageStateModifierSources(actor, target, effect, attackKey, defenseKey).map(source => {
        const attackWithout = statValueWithoutStateSource(actor, attackKey, source.sourceKey, attack);
        const rawDefenseWithout = statValueWithoutStateSource(target, defenseKey, source.sourceKey, rawDefense);
        const actorMultiplierWithout = productWithout(actorStates, actor, source.sourceKey, state => {
          const combatEffect = state?.战斗效果 || {};
          return Math.max(0, Number(combatEffect?.final_damage_mult ?? 1)) *
            Math.max(0, 1 + Number(combatEffect?.damage_bonus || combatEffect?.final_damage_bonus || 0));
        });
        const targetMultiplierWithout = productWithout(targetStates, target, source.sourceKey, state => {
          const combatEffect = state?.战斗效果 || {};
          return Math.max(0, Number(combatEffect?.received_damage_mult ?? 1)) *
            Math.max(0, 1 - clamp(Number(combatEffect?.damage_reduction || 0), 0, 1));
        });
        const limitedOutgoingWithout = productWithout(actorStates, actor, source.sourceKey, state =>
          (Array.isArray(state?.战斗效果?.damage_bonus_limited) ? state.战斗效果.damage_bonus_limited : []).reduce((multiplier, entry) =>
            skillMatchesLimitedElements(effect, entry?.限定元素)
              ? multiplier * Math.max(0, 1 + Number(entry?.数值 || 0))
              : multiplier,
          1),
        );
        const limitedIncomingWithout = productWithout(targetStates, target, source.sourceKey, state =>
          (Array.isArray(state?.战斗效果?.damage_reduction_limited) ? state.战斗效果.damage_reduction_limited : []).reduce((multiplier, entry) =>
            skillMatchesLimitedElements(effect, entry?.限定元素)
              ? multiplier * Math.max(0, 1 - clamp(Number(entry?.数值 || 0), 0, 1))
              : multiplier,
          1),
        );
        const armorPenRatioWithout = clamp(actorStates.reduce((sum, [stateKey, state]) =>
          sourceKeyFor(actor, stateKey, state) === source.sourceKey
            ? sum
            : sum + Math.max(0, Number(state?.战斗效果?.armor_pen || 0)),
        0), 0, 1);
        const defenseWithout = Math.max(
          1,
          rawDefenseWithout -
            Number(penetration?.flatPenetrationValue || 0) -
            rawDefenseWithout * armorPenRatioWithout,
        );
        const baseWithout = damageClass === 'TRUE'
          ? attackWithout * powerRatio * 0.4
          : attackWithout * powerRatio *
            (attackWithout / Math.max(1, attackWithout + defenseWithout)) *
            0.4 * resourceDrive;
        const rawDamageWithout = Math.max(
          0,
          baseWithout * actorMultiplierWithout * limitedOutgoingWithout *
            targetMultiplierWithout * limitedIncomingWithout * actionDamageMultiplier,
        );
        return Object.freeze({
          applicationId: source.applicationId,
          sourceActionId: source.sourceActionId,
          sourceEffectId: source.sourceEffectId,
          ownerId: source.ownerId,
          ownerRole: source.ownerRole,
          stateName: source.stateName,
          axes: Object.freeze([...source.axes].sort()),
          rawDamageWithout,
          rawDamageDelta: rawDamage - rawDamageWithout,
          linked: !!source.applicationId,
          observedMultipliers: Object.freeze({
            actor: actorMultiplier,
            actorWithout: actorMultiplierWithout,
            target: targetMultiplier,
            targetWithout: targetMultiplierWithout,
            limitedOutgoing: limitedOutgoingMultiplier,
            limitedOutgoingWithout,
            limitedIncoming: limitedIncomingMultiplier,
            limitedIncomingWithout,
          }),
        });
      }),
    );
  }

  function calculateDamageFormula(
    effect = {},
    actor = {},
    target = {},
    projectionContext = null,
    actionDamageMultiplier = 1,
    resourceDriveEnabled = true,
    modifierAttributionEnabled = false,
  ) {
    const damageClass = classifyDamageType(effect?.伤害类型);
    const power = Math.max(0, Number(effect?.威力倍率 ?? effect?.数值 ?? 0));
    const actorProfile = mechanicalProjectionProfile(
      projectionContext,
      actor,
    );
    const targetProfile = mechanicalProjectionProfile(
      projectionContext,
      target,
    );
    const attackKey = damageClass === 'MENTAL' ? 'men' : 'str';
    const defenseKey = damageClass === 'MENTAL' ? 'men' : 'def';
    const attack = Number.isFinite(Number(actorProfile?.stats?.[attackKey]))
      ? Number(actorProfile.stats[attackKey])
      : readCombatStat(actor, attackKey);
    const rawDefense = Math.max(
      1,
      Number.isFinite(Number(targetProfile?.stats?.[defenseKey]))
        ? Number(targetProfile.stats[defenseKey])
        : readCombatStat(target, defenseKey),
    );
    const penetration = calculateDefensePenetration(
      effect,
      actor,
      rawDefense,
      projectionContext,
    );
    const defense = Math.max(
      1,
      rawDefense - penetration.penetrationValue,
    );
    const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 ?? effect?.段数 ?? 1)));
    const powerRatio = power <= 100 ? power / 100 : Math.pow(power / 100, 0.25);
    const resourceName = damageClass === 'MENTAL' ? '精神力' : '魂力';
    const actorResourceMax = Number.isFinite(Number(actorProfile?.resourceMax?.[resourceName]))
      ? Number(actorProfile.resourceMax[resourceName])
      : readResourceMax(actor, resourceName);
    const targetResourceMax = Number.isFinite(Number(targetProfile?.resourceMax?.[resourceName]))
      ? Number(targetProfile.resourceMax[resourceName])
      : readResourceMax(target, resourceName);
    const resourceRatio = Math.max(0.01, actorResourceMax / Math.max(1, targetResourceMax));
    // 基础攻击的等级差已经由力量/防御面板承载；再按魂力上限比放大会对同一等级差重复计权。
    // 魂技仍保留资源驱动，只让无消耗的基础攻击回到纯攻防公式。
    const resourceDriveApplied = resourceDriveEnabled !== false;
    const resourceDrive = resourceDriveApplied
      ? clamp(Math.pow(resourceRatio, 0.45), 0.35, 1.85)
      : 1;
    let total = 0;
    if (damageClass === 'TRUE') {
      total = attack * powerRatio * 0.4;
    } else {
      const mitigation = attack / Math.max(1, attack + defense);
      total = attack * powerRatio * mitigation * 0.4 * resourceDrive;
    }
    const actorMultiplier = actorProfile
      ? actorProfile.outgoingDamageMultiplier
      : stateEntries(actor, 'OUTGOING_DAMAGE').reduce((multiplier, [, state]) => {
          const combatEffect = state?.战斗效果 || {};
          return multiplier *
            Math.max(0, Number(combatEffect?.final_damage_mult ?? 1)) *
          Math.max(0, 1 + Number(combatEffect?.damage_bonus || combatEffect?.final_damage_bonus || 0));
        }, 1);
    const targetMultiplier = targetProfile
      ? targetProfile.incomingDamageMultiplier
      : stateEntries(target, 'INCOMING_DAMAGE').reduce((multiplier, [, state]) => {
          const combatEffect = state?.战斗效果 || {};
          return multiplier *
            Math.max(0, Number(combatEffect?.received_damage_mult ?? 1)) *
          Math.max(0, 1 - clamp(Number(combatEffect?.damage_reduction || 0), 0, 1));
        }, 1);
    const limitedOutgoing = actorProfile?.outgoingDamageLimited || stateEntries(actor, 'OUTGOING_DAMAGE')
      .flatMap(([, state]) => state?.战斗效果?.damage_bonus_limited || []);
    const limitedIncoming = targetProfile?.incomingDamageLimited || stateEntries(target, 'INCOMING_DAMAGE')
      .flatMap(([, state]) => state?.战斗效果?.damage_reduction_limited || []);
    const limitedOutgoingMultiplier = limitedOutgoing.reduce((multiplier, entry) =>
      skillMatchesLimitedElements(effect, entry?.限定元素)
        ? multiplier * Math.max(0, 1 + Number(entry?.数值 || 0))
        : multiplier,
      1,
    );
    const limitedIncomingMultiplier = limitedIncoming.reduce((multiplier, entry) =>
      skillMatchesLimitedElements(effect, entry?.限定元素)
        ? multiplier * Math.max(0, 1 - clamp(Number(entry?.数值 || 0), 0, 1))
        : multiplier,
      1,
    );
    const perSegment = total * actorMultiplier * limitedOutgoingMultiplier * targetMultiplier * limitedIncomingMultiplier / segments;
    const baseRawDamage = Math.max(0, perSegment * segments);
    const normalizedActionMultiplier = Math.max(0, Number(actionDamageMultiplier ?? 1));
    const rawDamage = Math.max(0, baseRawDamage * normalizedActionMultiplier);
    const modifierAttribution = modifierAttributionEnabled
      ? buildDamageModifierAttribution({
          actor,
          target,
          effect,
          damageClass,
          attackKey,
          defenseKey,
          attack,
          rawDefense,
          penetration,
          powerRatio,
          resourceDrive,
          actorMultiplier,
          targetMultiplier,
          limitedOutgoingMultiplier,
          limitedIncomingMultiplier,
          actionDamageMultiplier: normalizedActionMultiplier,
          rawDamage,
        })
      : Object.freeze([]);
    return Object.freeze({
      damageClass,
      damageType: String(effect?.伤害类型 || '').trim(),
      power,
      powerRatio,
      attack,
      rawDefense,
      penetration: Object.freeze({ ...penetration }),
      defense,
      segments,
      actorMultiplier,
      targetMultiplier,
      limitedOutgoingMultiplier,
      limitedIncomingMultiplier,
      resourceName,
      actorResourceMax,
      targetResourceMax,
      resourceRatio,
      resourceDrive,
      resourceDriveApplied,
      baseRawDamage,
      actionDamageMultiplier: normalizedActionMultiplier,
      rawDamage,
      modifierAttribution,
    });
  }

  function buildDamageBasis(
    effect = {},
    actor = {},
    target = {},
    projectionContext = null,
    options = {},
  ) {
    const basisView = String(options?.basisView || '').trim().toUpperCase();
    if (!['DECISION_VISIBLE', 'BELIEF', 'RUNTIME_ACTUAL'].includes(basisView)) {
      throw new Error(`DAMAGE_BASIS_VIEW_INVALID:${basisView || 'missing'}`);
    }
    const formulaVersion = 'R9_DAMAGE_FORMULA_V5';
    const targetCoverage = calculateDamageTargetCoverage(effect, options?.targetCount);
    const actionEffectMultiplier = Math.max(0, Number(options?.actionDamageMultiplier ?? 1));
    const formula = calculateDamageFormula(
      effect,
      actor,
      target,
      projectionContext,
      actionEffectMultiplier * targetCoverage.multiplier,
      options?.resourceDriveEnabled !== false,
      options?.captureModifierAttribution === true,
    );
    const reactionDamageMultiplier = clamp(
      Number(options?.reactionDamageMultiplier ?? 1),
      0,
      1,
    );
    const identity = Object.freeze({
      effectInstanceId: String(options?.effectInstanceId || '').trim(),
      sourceEffectId: String(options?.sourceEffectId || options?.effectInstanceId || '').trim(),
      sourceActionId: String(options?.sourceActionId || '').trim(),
      actorId: unitId(actor),
      targetId: unitId(target),
      snapshotRevision: String(options?.snapshotRevision || '').trim(),
    });
    const operands = Object.freeze({
      damageClass: formula.damageClass,
      damageType: formula.damageType,
      power: formula.power,
      powerRatio: formula.powerRatio,
      attack: formula.attack,
      rawDefense: formula.rawDefense,
      penetration: formula.penetration,
      defense: formula.defense,
      segments: formula.segments,
      targetScope: targetCoverage.targetScope,
      targetCount: targetCoverage.targetCount,
      targetCoverageBudget: targetCoverage.coverageBudget,
      targetCoverageMultiplier: targetCoverage.multiplier,
      actionEffectMultiplier,
      actorMultiplier: formula.actorMultiplier,
      targetMultiplier: formula.targetMultiplier,
      resourceName: formula.resourceName,
      actorResourceMax: formula.actorResourceMax,
      targetResourceMax: formula.targetResourceMax,
      resourceRatio: formula.resourceRatio,
      resourceDrive: formula.resourceDrive,
      resourceDriveApplied: formula.resourceDriveApplied,
      actionDamageMultiplier: formula.actionDamageMultiplier,
      reactionDamageMultiplier,
      baseRawDamage: formula.baseRawDamage,
      rawDamage: formula.rawDamage,
    });
    const publicOperands = Object.freeze({
      damageClass: formula.damageClass,
      damageType: formula.damageType,
      power: formula.power,
      powerRatio: formula.powerRatio,
      segments: formula.segments,
      targetScope: targetCoverage.targetScope,
      targetCount: targetCoverage.targetCount,
      targetCoverageBudget: targetCoverage.coverageBudget,
      targetCoverageMultiplier: targetCoverage.multiplier,
      actionDamageMultiplier: formula.actionDamageMultiplier,
    });
    const basisHash = stableHash({
      schemaVersion: 'DamageBasisV1',
      formulaVersion,
      basisView,
      identity,
      operands,
    });
    const basis = Object.freeze({
      schemaVersion: 'DamageBasisV1',
      basisView,
      formulaVersion,
      basisHash,
      identity,
      operands,
      publicOperands,
      formulaTrace: Object.freeze({
        formulaVersion,
        rawDamage: formula.rawDamage,
        baseRawDamage: formula.baseRawDamage,
        reactionDamageMultiplier,
        damageClass: formula.damageClass,
        damageType: formula.damageType,
        attackValue: formula.attack,
        defenseValue: formula.defense,
        rawDefenseValue: formula.rawDefense,
        flatPenetrationValue: formula.penetration.flatPenetrationValue,
        stateArmorPenRatio: formula.penetration.stateArmorPenRatio,
        stateArmorPenetrationValue: formula.penetration.stateArmorPenetrationValue,
        penetrationValue: formula.penetration.penetrationValue,
        perSegmentDamage: calculateSettledSegmentDamage(
          formula.rawDamage,
          formula.segments,
          reactionDamageMultiplier,
        ),
        modifierAttribution: formula.modifierAttribution,
        ...operands,
      }),
    });
    builtDamageBasisCache.add(basis);
    return basis;
  }

  function assertDamageBasis(basis = {}, expected = {}) {
    if (!basis || typeof basis !== 'object' || Array.isArray(basis)) {
      throw new TypeError('DAMAGE_BASIS_INVALID');
    }
    const identity = basis.identity;
    if (!validatedDamageBasisCache.has(basis)) {
      if (basis.schemaVersion !== 'DamageBasisV1') {
        throw new Error(`DAMAGE_BASIS_SCHEMA_INVALID:${String(basis.schemaVersion || '')}`);
      }
      if (!['DECISION_VISIBLE', 'BELIEF', 'RUNTIME_ACTUAL'].includes(String(basis.basisView || '').trim())) {
        throw new Error(`DAMAGE_BASIS_VIEW_INVALID:${String(basis.basisView || '')}`);
      }
      if (basis.formulaVersion !== 'R9_DAMAGE_FORMULA_V5') {
        throw new Error(`DAMAGE_BASIS_FORMULA_VERSION_INVALID:${String(basis.formulaVersion || '')}`);
      }
      const operands = basis.operands;
      if (!identity || typeof identity !== 'object' || !operands || typeof operands !== 'object') {
        throw new Error('DAMAGE_BASIS_PAYLOAD_MISSING');
      }
      ['actorId', 'targetId', 'effectInstanceId', 'sourceEffectId', 'sourceActionId', 'snapshotRevision']
        .forEach(key => {
          if (typeof identity[key] !== 'string') {
            throw new Error(`DAMAGE_BASIS_IDENTITY_INVALID:${key}`);
          }
        });
      if (!identity.actorId || !identity.targetId || !identity.effectInstanceId || !identity.sourceActionId || !identity.snapshotRevision) {
        throw new Error('DAMAGE_BASIS_IDENTITY_INCOMPLETE');
      }
      if (typeof basis.basisHash !== 'string' || !basis.basisHash) {
        throw new Error('DAMAGE_BASIS_HASH_MISSING');
      }
      if (builtDamageBasisCache.has(basis)) {
        // The constructor froze the complete hash payload and computed this hash.
        validatedDamageBasisCache.add(basis);
      } else {
        const expectedHash = stableHash({
          schemaVersion: 'DamageBasisV1',
          formulaVersion: basis.formulaVersion,
          basisView: basis.basisView,
          identity,
          operands,
        });
        if (basis.basisHash !== expectedHash) {
          throw new Error('DAMAGE_BASIS_HASH_MISMATCH');
        }
      }
    }
    const expectedView = String(expected?.basisView || '').trim().toUpperCase();
    if (expectedView && basis.basisView !== expectedView) {
      throw new Error(`DAMAGE_BASIS_SCOPE_MISMATCH:${expectedView}:${basis.basisView}`);
    }
    ['actorId', 'targetId', 'effectInstanceId', 'sourceEffectId', 'sourceActionId', 'snapshotRevision']
      .forEach(key => {
        const expectedValue = expected?.[key];
        if (expectedValue !== undefined && String(expectedValue || '').trim() !== identity[key]) {
          throw new Error(`DAMAGE_BASIS_IDENTITY_MISMATCH:${key}`);
        }
      });
    return true;
  }

  function damageBasisMetadata(basis = {}, options = {}) {
    assertDamageBasis(basis);
    const identity = Object.freeze({
      effectInstanceId: basis.identity.effectInstanceId,
      sourceEffectId: basis.identity.sourceEffectId,
      sourceActionId: basis.identity.sourceActionId,
      actorId: basis.identity.actorId,
      targetId: basis.identity.targetId,
      snapshotRevision: basis.identity.snapshotRevision,
    });
    const metadata = {
      schemaVersion: basis.schemaVersion,
      basisView: basis.basisView,
      formulaVersion: basis.formulaVersion,
      basisHash: basis.basisHash,
      identity,
      publicOperands: Object.freeze({ ...basis.publicOperands }),
    };
    const includeHiddenTrace = options?.includeFormulaTrace === true && (
      basis.basisView === 'RUNTIME_ACTUAL' ||
      options?.diagnostic === true
    );
    if (includeHiddenTrace) {
      metadata.operands = basis.operands;
      metadata.formulaTrace = basis.formulaTrace;
    }
    return Object.freeze(metadata);
  }

  function calculateBaseDamage(
    effect = {},
    actor = {},
    target = {},
    projectionContext = null,
    options = {},
  ) {
    const targetCoverage = calculateDamageTargetCoverage(effect, options?.targetCount);
    return calculateDamageFormula(
      effect,
      actor,
      target,
      projectionContext,
      Math.max(0, Number(options?.actionDamageMultiplier ?? 1)) * targetCoverage.multiplier,
      options?.resourceDriveEnabled !== false,
    ).rawDamage;
  }

  function calculateDefensePenetration(
    effect = {},
    actor = {},
    rawDefense = 0,
    projectionContext = null,
  ) {
    const actorProfile = mechanicalProjectionProfile(
      projectionContext,
      actor,
    );
    const flatPenetrationValue = Math.max(
      0,
      Number(
        effect?.防穿 ??
        effect?.穿透 ??
        effect?.防御穿透 ??
        0,
      ),
    );
    const stateArmorPenRatio = clamp(
      Number.isFinite(Number(actorProfile?.outgoingArmorPenRatio))
        ? Number(actorProfile.outgoingArmorPenRatio)
        : stateEntries(actor, 'OUTGOING_DAMAGE').reduce(
            (sum, [, state]) =>
              sum +
              Math.max(
                0,
                Number(state?.战斗效果?.armor_pen || 0),
              ),
            0,
          ),
      0,
      1,
    );
    const stateArmorPenetrationValue =
      Math.max(0, Number(rawDefense || 0)) * stateArmorPenRatio;
    return Object.freeze({
      flatPenetrationValue,
      stateArmorPenRatio,
      stateArmorPenetrationValue,
      penetrationValue:
        flatPenetrationValue + stateArmorPenetrationValue,
    });
  }

  function calculateSettledSegmentDamage(totalDamage = 0, segments = 1, damageMultiplier = 1) {
    const segmentCount = Math.max(1, Math.floor(Number(segments || 1)));
    const multiplier = clamp(Number(damageMultiplier ?? 1), 0, 1);
    const positiveDamage = Math.max(0, Number(totalDamage || 0));
    if (!(positiveDamage > 0) || !(multiplier > 0)) return 0;
    return Math.max(1, Math.round(positiveDamage / segmentCount * multiplier));
  }

  function hasDamageRevival(unit = {}, newAction = false) {
    return (newAction || unit.__本阶段已触发复活 !== true) && (Object.values(unit.状态效果 || {}).some(state => Number(state?.战斗效果?.revive_count || 0) > 0) ||
      Boolean(findPassiveReviveCandidate(unit)));
  }

  function counterDamageRatio(unit = {}) {
    return Object.values(unit.状态效果 || {}).reduce((total, state) => {
      const effects = state?.战斗效果 || {};
      const explicit = Math.max(0, Number(effects.counter_attack_ratio || effects.damage_reflect_ratio || 0));
      const sourceText = [state?.__equipmentSkillName, state?.来源技能, state?.状态, state?.状态名称]
        .map(value => String(value || '').trim()).filter(Boolean).join('|');
      const semantic = String(state?.结算 || '').trim() === '受到伤害' && /反弹|反射/.test(sourceText)
        ? Math.abs(Number(parseSignedValue(state?.数值, 1) || 0)) : 0;
      return total + Math.max(explicit, semantic);
    }, 0);
  }

  function damageRevivalState(unit) {
    return { counts: Object.fromEntries(Object.entries(unit.状态效果 || {}).filter(([, state]) => state.战斗效果?.revive_count !== undefined)
      .map(([key, state]) => [key, state.战斗效果.revive_count])), skillLimits: cloneValue(unit.__技能限制运行态 || {}) };
  }

  function applyDamageRevivalOutcomes(unit, outcomes) {
    if (!outcomes.some(row => row.revival)) return;
    for (const [key, state] of Object.entries(unit.状态效果 || {})) {
      if (!(Number(state.战斗效果?.revive_count || 0) > 0)) continue;
      state.战斗效果.revive_count = outcomes.reduce((sum, row) => sum + row.probability * (row.revival?.counts[key] ?? state.战斗效果.revive_count), 0);
    }
    const limitKeys = new Set(outcomes.flatMap(row => Object.keys(row.revival?.skillLimits || {})));
    for (const key of limitKeys) {
      const previous = unit.__技能限制运行态?.[key] || {};
      (unit.__技能限制运行态 ||= {})[key] = { ...previous, 已用次数: outcomes.reduce((sum, row) =>
        sum + row.probability * Number(row.revival?.skillLimits[key]?.已用次数 ?? previous.已用次数 ?? 0), 0) };
    }
    if (outcomes.reduce((sum, row) => sum + (row.revival ? row.probability : 0), 0) >= 1 - 1e-12) {
      clearC2FoodMaintenanceRuntime(unit);
      unit.__本阶段已触发复活 = true;
    }
  }

  function expectedSegmentedDamageOutcome(input = {}) {
    if (input.hpDamageLimits?.length) {
      const values = input.hpDamageLimits.map(limit => ({
        limit, result: expectedSegmentedDamageOutcome({ ...input, hpDamageLimits: null, hpDamageLimit: limit.hpDamageLimit,
          deathSaveCount: limit.deathSaveCount ?? input.deathSaveCount,
          ruleBlockCount: limit.ruleBlockCount ?? input.ruleBlockCount,
          reviveTarget: Object.hasOwn(limit, 'reviveTarget') ? limit.reviveTarget : input.reviveTarget,
          reflection: Object.hasOwn(limit, 'reflection') ? limit.reflection : input.reflection,
          shieldBefore: limit.shieldBefore ?? input.shieldBefore,
          perSegmentDamage: limit.perSegmentDamage ?? input.perSegmentDamage,
          hitProbability: limit.hitProbability ?? input.hitProbability }),
      }));
      const result = {};
      for (const key of ['expectedIncoming', 'expectedShieldAbsorb', 'expectedHpDamage', 'fullHitIncoming', 'fullHitShieldAbsorb', 'fullHitHpDamage']) {
        result[key] = values.reduce((sum, row) => sum + row.limit.probability * row.result[key], 0);
      }
      if (values.some(row => row.result.expectedDeathSaveConsumed !== undefined)) {
        result.expectedDeathSaveConsumed = values.reduce((sum, row) => sum + row.limit.probability * (row.result.expectedDeathSaveConsumed || 0), 0);
      }
      if (values.some(row => row.result.expectedRuleBlockConsumed !== undefined)) result.expectedRuleBlockConsumed = values.reduce((sum, row) =>
        sum + row.limit.probability * (row.result.expectedRuleBlockConsumed || 0), 0);
      if (values.some(row => row.result.expectedReviveHealing !== undefined)) result.expectedReviveHealing = values.reduce((sum, row) =>
        sum + row.limit.probability * (row.result.expectedReviveHealing || 0), 0);
      result.outcomeDistribution = Object.freeze(values.flatMap(({ limit, result }, index) => result.outcomeDistribution.map(outcome => Object.freeze({
        ...outcome, branchKey: 'resource-prefix:' + index + ':' + outcome.branchKey,
        probability: limit.probability * outcome.probability,
        hpBefore: limit.hpBefore, hpDamageLimit: limit.hpDamageLimit,
        perSegmentDamage: limit.perSegmentDamage ?? input.perSegmentDamage,
        hitProbability: limit.hitProbability ?? input.hitProbability,
        priorResourceAssignments: limit.assignments,
      }))));
      return Object.freeze(result);
    }
    const segmentCount = Math.max(1, Math.floor(Number(input.segments || 1)));
    const hitProbability = clamp(Number(input.hitProbability ?? 1), 0, 1);
    const applicationProbability = clamp(Number(input.applicationProbability ?? 1), 0, 1);
    const perSegmentDamage = Math.max(0, Number(input.perSegmentDamage || 0));
    const shieldBefore = Math.max(0, Number(input.shieldBefore || 0));
    const hpDamageLimit = Math.max(0, Number(input.hpDamageLimit || 0));
    const incomingLimit = shieldBefore + hpDamageLimit;
    const saveCount = Math.max(0, Math.floor(Number(input.deathSaveCount || 0)));
    const blockCount = Math.max(0, Math.floor(Number(input.ruleBlockCount || 0)));
    const outcomeForHits = hitCount => {
      if (input.reviveTarget || input.reflection) {
        const unit = cloneValue(input.reviveTarget || input.reflection.target);
        const reflectedActor = input.reflection ? cloneValue(input.reflection.actor) : null;
        const hpFloor = Math.max(0, readHp(unit) - hpDamageLimit);
        setHp(unit, hpDamageLimit + hpFloor);
        let shield = shieldBefore, incoming = 0, damage = 0, consumed = 0, healing = 0, blocked = 0;
        let reflectedDamage = 0, reflectedHealing = 0;
        for (let hit = 0; hit < hitCount && readHp(unit) > hpFloor; hit++) {
          if (blocked < blockCount && consumeRuleBlockCharges(unit, 1).length) { blocked++; continue; }
          const hp = readHp(unit), amount = Math.min(shield + hp - hpFloor, perSegmentDamage), absorbed = Math.min(shield, amount);
          shield -= absorbed; incoming += amount;
          let loss = Math.min(hp - hpFloor, Math.max(0, amount - absorbed));
          if (loss >= hp && consumeDeathSaveCharges(unit, 1).length) { loss = Math.max(0, hp - 1); consumed++; }
          damage += loss; setHp(unit, hp - loss);
          if (readHp(unit) <= 0) triggerRevive(unit, '', setResourceValue, () => { healing += readHp(unit); });
          if (reflectedActor && loss > 0) {
            const reflected = Math.max(0, Math.min(readHp(reflectedActor), Math.floor(loss * input.reflection.ratio)));
            if (reflected > 0) {
              reflectedDamage += reflected; setHp(reflectedActor, readHp(reflectedActor) - reflected);
              if (readHp(reflectedActor) <= 0) triggerRevive(reflectedActor, '', setResourceValue, () => { reflectedHealing += readHp(reflectedActor); });
            }
          }
        }
        return { incoming, shieldAbsorb: shieldBefore - shield, hpDamage: damage, deathSaveConsumed: consumed,
          ruleBlockConsumed: blocked,
          ...(healing > 0 ? { reviveHealing: healing, revival: damageRevivalState(unit) } : {}),
          ...(reflectedDamage > 0 ? { reflection: { actorId: unitId(reflectedActor), hpDamage: reflectedDamage, reviveHealing: reflectedHealing,
            ...(reflectedHealing > 0 ? { revival: damageRevivalState(reflectedActor) } : {}) } } : {}) };
      }
      if (saveCount > 0) {
        let hp = hpDamageLimit, shield = shieldBefore, incoming = 0, consumed = 0, blocked = 0;
        for (let hit = 0; hit < hitCount && hp > 0; hit++) {
          if (blocked < blockCount) { blocked++; continue; }
          const amount = Math.min(shield + hp, perSegmentDamage), absorbed = Math.min(shield, amount);
          incoming += amount; shield -= absorbed;
          let damage = Math.min(hp, Math.max(0, amount - absorbed));
          if (damage >= hp && consumed < saveCount) { damage = Math.max(0, hp - 1); consumed++; }
          hp -= damage;
        }
        return { incoming, shieldAbsorb: shieldBefore - shield, hpDamage: hpDamageLimit - hp, deathSaveConsumed: consumed, ruleBlockConsumed: blocked };
      }
      const blocked = Math.min(blockCount, hitCount);
      const incoming = Math.min(incomingLimit, perSegmentDamage * (hitCount - blocked));
      const shieldAbsorb = Math.min(shieldBefore, incoming);
      return {
        incoming,
        shieldAbsorb,
        hpDamage: Math.min(hpDamageLimit, Math.max(0, incoming - shieldAbsorb)),
        ruleBlockConsumed: blocked,
      };
    };
    const branchByOutcome = new Map();
    const addBranch = (probability, hitCount, outcome) => {
      if (!(probability > 1e-15)) return;
      const key = [
        Number(outcome.incoming.toFixed(10)),
        Number(outcome.shieldAbsorb.toFixed(10)),
        Number(outcome.hpDamage.toFixed(10)),
        ...(input.reviveTarget ? [Number(outcome.reviveHealing || 0), JSON.stringify(outcome.revival || null)] : []),
        ...(input.reflection ? [JSON.stringify(outcome.reflection || null)] : []),
        ...(saveCount > 0 ? [outcome.deathSaveConsumed] : []),
        ...(blockCount > 0 ? [outcome.ruleBlockConsumed] : []),
        ...(input.preserveHitOutcome ? [hitCount > 0] : []),
      ].join('|');
      const current = branchByOutcome.get(key);
      if (current) {
        current.probability += probability;
        current.hitCounts.push(hitCount);
        return;
      }
      branchByOutcome.set(key, {
        probability,
        hitCounts: [hitCount],
        incoming: outcome.incoming,
        shieldAbsorb: outcome.shieldAbsorb,
        hpDamage: outcome.hpDamage,
        ...(outcome.revival ? { reviveHealing: outcome.reviveHealing, revival: outcome.revival } : {}),
        ...(outcome.reflection ? { reflection: outcome.reflection } : {}),
        ...(saveCount > 0 ? { deathSaveConsumed: outcome.deathSaveConsumed } : {}),
        ...(blockCount > 0 ? { ruleBlockConsumed: outcome.ruleBlockConsumed } : {}),
      });
    };
    if (applicationProbability < 1 - 1e-12) {
      addBranch(1 - applicationProbability, 0, outcomeForHits(0));
    }
    if (applicationProbability > 1e-12) {
      if (hitProbability >= 1 - 1e-12) {
        addBranch(applicationProbability, segmentCount, outcomeForHits(segmentCount));
      } else if (hitProbability <= 1e-12) {
        addBranch(applicationProbability, 0, outcomeForHits(0));
      } else {
        let probability = Math.pow(1 - hitProbability, segmentCount);
        for (let hitCount = 0; hitCount <= segmentCount; hitCount += 1) {
          if (hitCount > 0) {
            probability *=
              (segmentCount - hitCount + 1) / hitCount *
              hitProbability / (1 - hitProbability);
          }
          addBranch(applicationProbability * probability, hitCount, outcomeForHits(hitCount));
        }
      }
    }
    const outcomeDistribution = [...branchByOutcome.values()]
      .sort((left, right) =>
        left.hpDamage - right.hpDamage ||
        left.shieldAbsorb - right.shieldAbsorb ||
        left.incoming - right.incoming
      )
      .map((branch, index) => Object.freeze({
        branchKey: `damage:${index}:${branch.hitCounts.join(',')}`,
        probability: branch.probability,
        hitCounts: Object.freeze([...branch.hitCounts]),
        incoming: branch.incoming,
        shieldAbsorb: branch.shieldAbsorb,
        hpDamage: branch.hpDamage,
        ...(branch.revival ? { reviveHealing: branch.reviveHealing, revival: branch.revival } : {}),
        ...(branch.reflection ? { reflection: branch.reflection } : {}),
        ...(saveCount > 0 ? { deathSaveConsumed: branch.deathSaveConsumed } : {}),
        ...(blockCount > 0 ? { ruleBlockConsumed: branch.ruleBlockConsumed } : {}),
        delta: -branch.hpDamage + Number(branch.reviveHealing || 0),
      }));
    const probabilityTotal = outcomeDistribution.reduce(
      (sum, branch) => sum + Number(branch.probability || 0),
      0,
    );
    if (Math.abs(probabilityTotal - 1) > 1e-9) {
      throw new Error(`battle_preview_damage_distribution_invalid:${probabilityTotal}`);
    }
    const expectedIncoming = outcomeDistribution.reduce(
      (sum, branch) => sum + branch.probability * branch.incoming,
      0,
    );
    const expectedShieldAbsorb = outcomeDistribution.reduce(
      (sum, branch) => sum + branch.probability * branch.shieldAbsorb,
      0,
    );
    const expectedHpDamage = outcomeDistribution.reduce(
      (sum, branch) => sum + branch.probability * branch.hpDamage,
      0,
    );
    const fullHit = outcomeForHits(segmentCount);
    return Object.freeze({
      expectedIncoming,
      expectedShieldAbsorb,
      expectedHpDamage,
      fullHitIncoming: fullHit.incoming,
      fullHitShieldAbsorb: fullHit.shieldAbsorb,
      fullHitHpDamage: fullHit.hpDamage,
      ...(input.reviveTarget || input.reflection ? { expectedReviveHealing: outcomeDistribution.reduce((sum, branch) => sum + branch.probability * Number(branch.reviveHealing || 0), 0) } : {}),
      ...(saveCount > 0 ? { expectedDeathSaveConsumed: outcomeDistribution.reduce((sum, branch) => sum + branch.probability * branch.deathSaveConsumed, 0) } : {}),
      ...(blockCount > 0 ? { expectedRuleBlockConsumed: outcomeDistribution.reduce((sum, branch) => sum + branch.probability * branch.ruleBlockConsumed, 0) } : {}),
      outcomeDistribution: Object.freeze(outcomeDistribution),
    });
  }

  function normalizeEffectProbability(value, fallback = 1) {
    const text = String(value ?? '').trim();
    if (!text) return clamp(Number(fallback || 0), 0, 1);
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return clamp(Number(fallback || 0), 0, 1);
    return clamp(text.includes('%') || Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
  }

  function settleHitProbability(
    explicitValue,
    attackAgility,
    targetAgility,
    hitAdjustment,
    targetAvoidanceAdjustment,
    environmentContext = null,
  ) {
    const hasExplicitProbability = String(explicitValue ?? '').trim() !== '';
    const baseProbability = hasExplicitProbability
      ? normalizeEffectProbability(explicitValue, 1)
      : clamp(
          0.78 +
          (attackAgility - targetAgility) / Math.max(100, attackAgility + targetAgility) * 0.35,
          0.05,
          0.99,
        );
    if (hasExplicitProbability && (baseProbability <= 0 || baseProbability >= 1)) return baseProbability;
    return clamp(
      baseProbability +
      hitAdjustment -
      targetAvoidanceAdjustment +
      Number(environmentContext?.vision?.hitAdjustment || 0),
      hasExplicitProbability ? 0 : 0.05,
      hasExplicitProbability ? 1 : 0.99,
    );
  }

  function estimateHitProbability(
    actor = {},
    target = {},
    effect = {},
    projectionContext = null,
    environmentContext = null,
  ) {
    const explicitValue = effect?.命中概率 ?? effect?.触发概率;
    const actorProfile = mechanicalProjectionProfile(
      projectionContext,
      actor,
    );
    const targetProfile = mechanicalProjectionProfile(
      projectionContext,
      target,
    );
    const attackAgility = Number.isFinite(Number(actorProfile?.stats?.agi))
      ? Number(actorProfile.stats.agi)
      : readCombatStat(actor, 'agi');
    const targetAgility = Number.isFinite(Number(targetProfile?.stats?.agi))
      ? Number(targetProfile.stats.agi)
      : readCombatStat(target, 'agi');
    const hitAdjustment = actorProfile
      ? actorProfile.outgoingHitAdjustment
      : stateEntries(actor, 'OUTGOING_HIT')
          .map(([, state]) => state?.战斗效果 || {})
          .reduce((sum, stateEffect) =>
            sum +
            Number(stateEffect?.hit_bonus || 0) -
            Number(stateEffect?.hit_penalty || 0), 0);
    const targetAvoidanceAdjustment = targetProfile
      ? targetProfile.incomingAvoidanceAdjustment
      : stateEntries(target, 'INCOMING_HIT')
          .map(([, state]) => state?.战斗效果 || {})
          .reduce((sum, stateEffect) =>
            sum +
            Number(stateEffect?.dodge_bonus || 0) -
            Math.max(
              Number(stateEffect?.dodge_penalty || 0),
              Number(stateEffect?.lock_level || 0),
            ), 0);
    return settleHitProbability(
      explicitValue,
      attackAgility,
      targetAgility,
      hitAdjustment,
      targetAvoidanceAdjustment,
      environmentContext,
    );
  }

  function estimateHitProbabilityAttribution(
    actor = {},
    target = {},
    effect = {},
    projectionContext = null,
    environmentContext = null,
  ) {
    const actorProfile = mechanicalProjectionProfile(projectionContext, actor);
    const targetProfile = mechanicalProjectionProfile(projectionContext, target);
    const attackAgility = Number.isFinite(Number(actorProfile?.stats?.agi))
      ? Number(actorProfile.stats.agi)
      : readCombatStat(actor, 'agi');
    const targetAgility = Number.isFinite(Number(targetProfile?.stats?.agi))
      ? Number(targetProfile.stats.agi)
      : readCombatStat(target, 'agi');
    const actorStates = collectStateEntries(actor);
    const targetStates = collectStateEntries(target);
    const groups = new Map();
    const register = (unit, stateKey, state, ownerRole, axes) => {
      const normalizedAxes = [...new Set(axes.map(value => String(value || '').trim()).filter(Boolean))];
      if (!normalizedAxes.length) return;
      const source = stateModifierSource(unit, stateKey, state, ownerRole, normalizedAxes);
      const existing = groups.get(source.sourceKey);
      if (existing) normalizedAxes.forEach(axis => existing.axes.add(axis));
      else groups.set(source.sourceKey, { ...source, axes: new Set(normalizedAxes) });
    };
    actorStates.forEach(([stateKey, state]) => {
      const axes = [];
      const ratio = Number(state?.面板修改比例?.agi ?? 1);
      const fixed = Number(state?.面板固定修正?.agi ?? 0);
      const combatEffect = state?.战斗效果 || {};
      if ((Number.isFinite(ratio) && Math.abs(ratio - 1) > 1e-9) ||
          (Number.isFinite(fixed) && Math.abs(fixed) > 1e-9)) axes.push('ATTACK_AGILITY');
      if (Math.abs(Number(combatEffect?.hit_bonus || 0) - Number(combatEffect?.hit_penalty || 0)) > 1e-9) {
        axes.push('OUTGOING_HIT');
      }
      register(actor, stateKey, state, 'ACTOR', axes);
    });
    targetStates.forEach(([stateKey, state]) => {
      const axes = [];
      const ratio = Number(state?.面板修改比例?.agi ?? 1);
      const fixed = Number(state?.面板固定修正?.agi ?? 0);
      const combatEffect = state?.战斗效果 || {};
      if ((Number.isFinite(ratio) && Math.abs(ratio - 1) > 1e-9) ||
          (Number.isFinite(fixed) && Math.abs(fixed) > 1e-9)) axes.push('TARGET_AGILITY');
      if (Math.abs(
        Number(combatEffect?.dodge_bonus || 0) -
        Math.max(Number(combatEffect?.dodge_penalty || 0), Number(combatEffect?.lock_level || 0))
      ) > 1e-9) axes.push('INCOMING_AVOIDANCE');
      register(target, stateKey, state, 'TARGET', axes);
    });
    const sourceKeyFor = (unit, stateKey, state) => stateModifierSource(unit, stateKey, state).sourceKey;
    const actualProbability = estimateHitProbability(actor, target, effect, projectionContext, environmentContext);
    return Object.freeze([...groups.values()].map(source => {
      const attackAgilityWithout = statValueWithoutStateSource(actor, 'agi', source.sourceKey, attackAgility);
      const targetAgilityWithout = statValueWithoutStateSource(target, 'agi', source.sourceKey, targetAgility);
      const hitAdjustmentWithout = actorStates.reduce((sum, [stateKey, state]) => {
        if (sourceKeyFor(actor, stateKey, state) === source.sourceKey) return sum;
        const combatEffect = state?.战斗效果 || {};
        return sum + Number(combatEffect?.hit_bonus || 0) - Number(combatEffect?.hit_penalty || 0);
      }, 0);
      const avoidanceWithout = targetStates.reduce((sum, [stateKey, state]) => {
        if (sourceKeyFor(target, stateKey, state) === source.sourceKey) return sum;
        const combatEffect = state?.战斗效果 || {};
        return sum + Number(combatEffect?.dodge_bonus || 0) - Math.max(
          Number(combatEffect?.dodge_penalty || 0),
          Number(combatEffect?.lock_level || 0),
        );
      }, 0);
      const probabilityWithout = settleHitProbability(
        effect?.命中概率 ?? effect?.触发概率,
        attackAgilityWithout,
        targetAgilityWithout,
        hitAdjustmentWithout,
        avoidanceWithout,
        environmentContext,
      );
      return Object.freeze({
        applicationId: source.applicationId,
        sourceActionId: source.sourceActionId,
        sourceEffectId: source.sourceEffectId,
        ownerId: source.ownerId,
        ownerRole: source.ownerRole,
        stateName: source.stateName,
        axes: Object.freeze([...source.axes].sort()),
        probabilityWithout,
        probabilityDelta: actualProbability - probabilityWithout,
        linked: !!source.applicationId,
      });
    }));
  }

  function collectEffects(skill = {}) {
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : null;
    if (!effects) return [];
    const cached = collectedEffectsCache.get(effects);
    if (cached) {
      metrics.collectEffectsCacheHits += 1;
      return cached;
    }
    metrics.collectEffectsBuilds += 1;
    const output = [];
    const seen = new Set();
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);
      if (String(value?.原型 || '').trim()) output.push(value);
      effectArrayFields.forEach(field => {
        const nested = value?.[field];
        if (Array.isArray(nested)) nested.forEach(visit);
      });
    };
    effects.forEach(visit);
    const result = Object.freeze(output);
    collectedEffectsCache.set(effects, result);
    return result;
  }

  function passiveSkillId(skill = {}, fallback = '') {
    return String(
      skill?.id ||
      skill?.技能ID ||
      skill?.魂技ID ||
      skill?.name ||
      skill?.魂技名 ||
      skill?.技能名称 ||
      skill?.名称 ||
      fallback ||
      '',
    ).trim();
  }

  function isPassiveSkill(skill = {}) {
    return /被动/.test(String(
      skill?.承载方式 || skill?.类型 || skill?.技能类型 || '',
    ));
  }

  function itemPassiveConsumer() {
    const candidates = [root];
    try { if (root.parent && root.parent !== root) candidates.push(root.parent); } catch (_error) {}
    try { if (root.top && root.top !== root) candidates.push(root.top); } catch (_error) {}
    return candidates
      .map(candidate => candidate && candidate.__LWCS_ITEM_PASSIVE_CONSUMER_V1__)
      .find(consumer => consumer && typeof consumer.编译角色装备被动消费者_V1 === 'function') || null;
  }

  function collectPassiveSkills(unit = {}) {
    const equipmentPackage = itemPassiveConsumer()?.编译角色装备被动消费者_V1(unit);
    const runtimeSkills = Array.isArray(unit?.__battleRuntime?.itemPassiveTriggeredSkills)
      ? unit.__battleRuntime.itemPassiveTriggeredSkills
      : [];
    const equipmentSkills = Array.isArray(equipmentPackage?.技能条目)
      ? equipmentPackage.技能条目.map(entry => entry?.技能).filter(skill => skill && typeof skill === 'object')
      : [];
    const roots = [
      ...(Array.isArray(unit?.技能列表) ? [unit.技能列表] : []),
      ...(runtimeSkills.length ? [runtimeSkills] : []),
      ...(equipmentSkills.length ? [equipmentSkills] : []),
      ...Object.entries(unit || {})
        .filter(([key, value]) =>
          /^(?:第\d+)?武魂|血脉之力|自创魂技|技能/.test(key) &&
          value && typeof value === 'object'
        )
        .map(([, value]) => value),
    ];
    const cacheKey = !runtimeSkills.length && !equipmentSkills.length
      ? overlayOriginUnit(unit) || unit
      : null;
    const rootSignature = cacheKey
      ? roots.map(root => [root, Array.isArray(root) ? root.length : -1])
      : null;
    const cached = cacheKey ? passiveSkillCollectionCache.get(cacheKey) : null;
    if (
      cached &&
      cached.rootSignature.length === rootSignature.length &&
      cached.rootSignature.every(([root, length], index) =>
        root === rootSignature[index][0] && length === rootSignature[index][1]
      )
    ) {
      metrics.passiveSkillCollectionCacheHits += 1;
      return cached.output;
    }
    const output = [];
    const seenObjects = new Set();
    const seenSkills = new Set();
    const visit = (value, path = '') => {
      if (!value || typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}:${index}`));
        return;
      }
      if (Array.isArray(value?._效果数组) && value._效果数组.length && isPassiveSkill(value)) {
        const effectFingerprint = effectArrayHash(value._效果数组);
        const skillId = passiveSkillId(value, path);
        const key = `${skillId}|${effectFingerprint}`;
        if (!seenSkills.has(key)) {
          seenSkills.add(key);
          output.push(Object.freeze({
            skill: value,
            skillId,
            effectFingerprint,
            sourcePath: path,
          }));
        }
        return;
      }
      Object.entries(value).forEach(([key, child]) => {
        if (/状态效果|战斗历史|历史快照|参战者|复制效果/.test(key)) return;
        visit(child, path ? `${path}.${key}` : key);
      });
    };
    roots.forEach((root, index) => visit(root, `技能根${index}`));
    const frozen = Object.freeze(output);
    if (cacheKey) {
      passiveSkillCollectionCache.set(cacheKey, Object.freeze({
        rootSignature: Object.freeze(rootSignature.map(entry => Object.freeze(entry))),
        output: frozen,
      }));
    }
    metrics.passiveSkillCollectionBuilds += 1;
    return frozen;
  }

  function passiveEffectEntries(skill = {}) {
    const output = [];
    const seen = new Set();
    const visit = (value, path = '') => {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (String(value?.原型 || '').trim()) {
        output.push(Object.freeze({
          effect: value,
          effectIndex: path || String(output.length),
        }));
      }
      effectArrayFields.forEach(field => {
        const nested = value?.[field];
        if (Array.isArray(nested)) nested.forEach((item, index) => visit(item, `${path || '0'}.${field}.${index}`));
      });
    };
    (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).forEach((effect, index) => visit(effect, String(index)));
    return output;
  }

  const passiveTriggerEnums = Object.freeze([
    '战斗开始',
    '回合开始',
    '受击前',
    '受击后',
    '濒死时',
    '被控制时',
    '命中后',
  ]);
  const passiveTriggerEnumSet = new Set(passiveTriggerEnums);
  const passiveLimitCycles = new Set(['每战', '每回合']);

  function readPassiveStructuredField(skill = {}, effect = {}, field = '') {
    const values = [
      Object.prototype.hasOwnProperty.call(skill, field) ? skill[field] : undefined,
      Object.prototype.hasOwnProperty.call(effect, field) ? effect[field] : undefined,
    ].filter(value => value !== undefined);
    if (!values.length) return { value: undefined, conflict: false };
    const fingerprints = new Set(values.map(value => stableHash(value)));
    return {
      value: values[values.length - 1],
      conflict: fingerprints.size > 1,
    };
  }

  function readPassiveTriggerLimit(skill = {}, effect = {}) {
    const field = readPassiveStructuredField(skill, effect, '触发限制');
    if (field.conflict) return { supported: false, reason: 'TRIGGER_LIMIT_CONFLICT' };
    const value = field.value;
    if (value === undefined || value === null || value === '') {
      return skill?.__equipmentPassiveTriggered === true
        ? { supported: true, cycle: '', count: 0 }
        : { supported: false, reason: 'TRIGGER_LIMIT_MISSING' };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { supported: false, reason: 'TRIGGER_LIMIT_UNSUPPORTED' };
    const cycle = String(value?.周期 || '').trim();
    const count = Number(value?.次数);
    if (!passiveLimitCycles.has(cycle) || !Number.isInteger(count) || count < 1) {
      return { supported: false, reason: 'TRIGGER_LIMIT_UNSUPPORTED' };
    }
    return Object.freeze({ supported: true, cycle, count });
  }

  function parsePassiveRatio(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const numeric = Number(text.replace(/%$/, ''));
    if (!Number.isFinite(numeric)) return null;
    return text.endsWith('%') ? numeric / 100 : numeric;
  }

  function passiveConditionMatches(condition = {}, actor = {}) {
    const type = String(condition?.类型 || '').trim();
    if (type !== '生命比例') return false;
    if (String(condition?.对象 || '').trim() !== '自身') return false;
    const expected = parsePassiveRatio(condition?.值);
    if (expected === null) return false;
    const actual = readHp(actor) / Math.max(1, readHpMax(actor));
    const comparison = String(condition?.比较 || '').trim();
    if (comparison === '<=') return actual <= expected + 1e-12;
    if (comparison === '<') return actual < expected;
    if (comparison === '>=') return actual + 1e-12 >= expected;
    if (comparison === '>') return actual > expected;
    if (comparison === '=' || comparison === '==') return Math.abs(actual - expected) <= 1e-12;
    return false;
  }

  function passiveConditionsSatisfied(skill = {}, effect = {}, actor = {}) {
    const field = readPassiveStructuredField(skill, effect, '条件分支');
    if (field.conflict) return false;
    if (field.value === undefined) return true;
    if (!Array.isArray(field.value) || !field.value.length) return false;
    return field.value.some(branch =>
      String(branch?.处理 || '').trim() === '生效' &&
      Array.isArray(branch?.条件) &&
      branch.条件.length > 0 &&
      branch.条件.every(condition => passiveConditionMatches(condition, actor))
    );
  }

  function passiveTriggerProfile(skill = {}, effect = {}) {
    const triggerField = readPassiveStructuredField(skill, effect, '触发方式');
    const trigger = typeof triggerField.value === 'string'
      ? triggerField.value.trim()
      : '';
    let unsupportedReason = triggerField.conflict
      ? 'TRIGGER_CONFLICT'
      : !trigger
        ? 'TRIGGER_MISSING'
        : !passiveTriggerEnumSet.has(trigger)
          ? 'TRIGGER_UNSUPPORTED'
          : '';
    const limit = readPassiveTriggerLimit(skill, effect);
    if (!limit.supported && !unsupportedReason) unsupportedReason = limit.reason;
    return Object.freeze({
      triggerPhase: trigger,
      triggerText: '',
      supported: !unsupportedReason,
      unsupportedReason,
      limit: limit.supported && limit.cycle ? limit : null,
    });
  }

  function passiveImplicitTriggerPhase(skill = {}, effect = {}) {
    const trigger = String(
      effect?.触发方式 ?? skill?.触发方式 ?? '',
    ).trim();
    if (trigger) return '';
    if (
      String(effect?.原型 || '').trim() === '结算修正' &&
      String(effect?.结算 || '').trim() === '受到伤害' &&
      String(effect?.目标 || '自身').trim() === '自身'
    ) return '受击前';
    return '';
  }

  function passiveApplicationKey(unit, skill, effect, effectIndex, triggerPhase, currentRound = 0, limit = null, triggerEventId = '') {
    const phase = String(triggerPhase || '').trim().toUpperCase();
    const round = limit?.cycle === '每回合' || (!limit && phase === '回合开始')
      ? Math.max(0, Number(currentRound || 0))
      : 0;
    const eventScoped = !limit || ['每次满足', '每次行动', '每次施放', '主动使用'].includes(String(limit?.cycle || '').trim());
    return `passive:${stableHash({
      unitId: unitId(unit),
      skillId: passiveSkillId(skill),
      effectId: String(effect?.effectId || effect?.效果ID || '').trim(),
      effectIndex: String(effectIndex || '').trim(),
      effectHash: stableHash(effect),
      phase,
      cycle: String(limit?.cycle || '').trim(),
      round,
      triggerEventId: eventScoped && ['受击前', '受击后', '濒死时', '被控制时', '命中后'].includes(phase)
        ? String(triggerEventId || '').trim()
        : '',
    })}`;
  }

  function passiveApplicationMap(unit = {}) {
    const map = unit?.__battleRuntime?.passiveApplications;
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  }

  function copyTransientWorldProperties(nextWorld, previousWorld) {
    if (Array.isArray(previousWorld?.__battleEventLedger)) {
      Object.defineProperty(nextWorld, '__battleEventLedger', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: [...previousWorld.__battleEventLedger],
      });
    }
    return nextWorld;
  }

  function replaceWorldUnit(worldSnapshot = {}, targetId = '', mutator = unit => unit) {
    const wanted = String(targetId || '').trim();
    const current = findUnit(worldSnapshot, wanted);
    if (!wanted || !current) return worldSnapshot;
    const replacement = cloneUnitForOverlay(current);
    mutator(replacement);
    const participants = worldSnapshot?.参战者 || {};
    const nextParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
      const replace = unit => unitId(unit) === wanted ? replacement : unit;
      if (Array.isArray(value)) return [side, value.map(replace)];
      if (value && typeof value === 'object') return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, replace(unit)]))];
      return [side, value];
    }));
    const nextWorld = copyTransientWorldProperties({ ...worldSnapshot, 参战者: nextParticipants }, worldSnapshot);
    const summons = worldSnapshot?.召唤单位表;
    if (summons && typeof summons === 'object') {
      Object.defineProperty(nextWorld, '召唤单位表', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Object.fromEntries(Object.entries(summons).map(([key, unit]) => [key, unitId(unit) === wanted ? replacement : unit])),
      });
    }
    return nextWorld;
  }

  function buildPassiveConsumerEvidence(worldSnapshot = {}, unit = {}, options = {}) {
    const requestedPhase = String(options?.phase || '回合开始').trim();
    const currentRound = Math.max(0, Number(options?.currentRound ?? worldSnapshot?.回合 ?? 0));
    const actorId = unitId(unit);
    const rows = [];
    collectPassiveSkills(unit).forEach(({ skill, skillId, effectFingerprint }) => {
      passiveEffectEntries(skill).forEach(({ effect, effectIndex }) => {
        const profile = passiveTriggerProfile(skill, effect);
        const implicitTriggerPhase = passiveImplicitTriggerPhase(skill, effect);
        const triggerPhase = profile.triggerPhase || implicitTriggerPhase;
        const hpRatio = readHp(unit) / Math.max(1, readHpMax(unit));
        const triggeredUnitIds = new Set((Array.isArray(options?.triggeredUnitIds) ? options.triggeredUnitIds : [])
          .map(value => String(value || '').trim()).filter(Boolean));
        const phaseReady = triggerPhase === requestedPhase;
        const eventReady = !['受击前', '受击后', '濒死时', '被控制时', '命中后'].includes(triggerPhase) ||
          triggeredUnitIds.has(actorId);
        const conditionContext = {
          ...(options?.conditionContext && typeof options.conditionContext === 'object' ? options.conditionContext : {}),
          ...(options?.declaration && typeof options.declaration === 'object' ? { declaration: options.declaration } : {}),
          ...(options?.action && typeof options.action === 'object' ? { action: options.action } : {}),
          ...(options?.primaryTarget ? { primaryTarget: options.primaryTarget } : {}),
          ...(options?.conditionTarget ? { conditionTarget: options.conditionTarget } : {}),
          effect,
        };
        const conditionTarget = options?.conditionTarget || options?.triggerTarget || unit;
        const conditionReady = resolveConditionalEffectPlan(
          effect,
          worldSnapshot,
          unit,
          conditionTarget,
          conditionContext,
        ).length > 0;
        const sourceReady = effectSourceRestrictionAllows(effect, options?.environmentContext);
        const applicationKey = passiveApplicationKey(
          unit,
          skill,
          effect,
          effectIndex,
          triggerPhase,
          currentRound,
          profile.limit,
          options?.triggerEventId,
        );
        const marker = passiveApplicationMap(unit)[applicationKey];
        const markerCount = Math.max(0, Number(marker?.count || 0));
        const limitReady = profile.limit
          ? markerCount < Number(profile.limit.count || 0)
          : markerCount < 1;
        const contextualTargetId = unitId(
          options?.conditionTarget || options?.primaryTarget || options?.triggerTarget,
        );
        const targetIds = resolveTargets(
          worldSnapshot,
          unit,
          { targetIds: contextualTargetId ? [contextualTargetId] : [] },
          effect,
        ).map(unitId).filter(Boolean);
        rows.push(Object.freeze({
          consumer: 'BattlePreview.buildPassiveConsumerEvidence',
          source: '_效果数组',
          actorId,
          skillId,
          skillName: String(skill?.name || skill?.魂技名 || skill?.技能名称 || skill?.名称 || skillId).trim(),
          effectIndex: String(effectIndex),
          effectPrototype: String(effect?.原型 || '').trim(),
          effectFingerprint,
          triggerPhase,
          triggerText: profile.triggerText,
          supported: profile.supported || Boolean(implicitTriggerPhase && profile.unsupportedReason === 'TRIGGER_MISSING'),
          unsupportedReason: implicitTriggerPhase && profile.unsupportedReason === 'TRIGGER_MISSING' ? '' : profile.unsupportedReason,
          triggerLimit: profile.limit,
          hpRatio,
          currentRound,
          applicationKey,
          targetIds: Object.freeze(targetIds),
          ready: sourceReady && (profile.supported || Boolean(implicitTriggerPhase && profile.unsupportedReason === 'TRIGGER_MISSING')) && phaseReady && eventReady && conditionReady && limitReady && targetIds.length > 0,
          sourceReady,
          sourceRestrictions: Object.freeze(Array.isArray(effect?.限定来源) ? [...effect.限定来源] : effect?.限定来源 ? [String(effect.限定来源).trim()] : []),
          blockedByMarker: markerCount >= Number(profile.limit?.count || 1),
          markerCount,
          marker: marker ? Object.freeze({ ...marker }) : null,
          skill,
          effect,
        }));
      });
    });
    return Object.freeze(rows);
  }

  function markPassiveApplication(worldSnapshot = {}, evidence = {}, result = {}) {
    const key = String(evidence?.applicationKey || '').trim();
    if (!key) return worldSnapshot;
    return replaceWorldUnit(worldSnapshot, evidence.actorId, unit => {
      unit.__battleRuntime = unit.__battleRuntime && typeof unit.__battleRuntime === 'object' ? unit.__battleRuntime : {};
      const previous = passiveApplicationMap(unit)[key];
      unit.__battleRuntime.passiveApplications = {
        ...passiveApplicationMap(unit),
        [key]: {
          phase: String(evidence?.triggerPhase || '').trim().toUpperCase(),
          round: Math.max(0, Number(evidence?.currentRound || 0)),
          effectPrototype: String(evidence?.effectPrototype || '').trim(),
          effectIndex: String(evidence?.effectIndex || '').trim(),
          targetIds: [...(evidence?.targetIds || [])],
          count: Math.max(0, Number(previous?.count || 0)) + 1,
          result: String(result?.result || 'APPLIED').trim().toUpperCase(),
        },
      };
    });
  }

  function normalizedContributionMagnitude(entry = {}, target = {}, actor = {}) {
    const evidence = entry?.evidence || {};
    const raw = Number(evidence?.delta ?? entry?.expectedDelta ?? entry?.threatValue ?? 0);
    if (!Number.isFinite(raw)) return 0;
    const kind = String(entry?.outcomeKind || '').trim().toUpperCase();
    const resource = String(evidence?.resource || entry?.resourceKey || '').trim();
    const maximum = kind === 'HP_DELTA' || kind === 'SCHEDULED_HP_DELTA'
      ? readHpMax(target)
      : kind === 'SHIELD_DELTA'
        ? Math.max(readHpMax(target), readShield(target), 1)
        : resource
          ? readResourceMax(target, resource)
          : Math.max(readHpMax(actor), 1);
    return clamp(Math.abs(raw) / Math.max(1, maximum) * 100, 0, 100);
  }

  function buildEffectPlanningEvidence(input = {}) {
    const actor = input?.actor || findUnit(input?.worldSnapshot || {}, input?.actorId || '') || {};
    const worldSnapshot = input?.worldSnapshot || {};
    const result = input?.result || {};
    const effects = Array.isArray(input?.effects)
      ? input.effects
      : collectEffects(input?.skill || {});
    const rootActionId = String(result?.actionId || input?.actionId || '').trim();
    const contributions = Array.isArray(result?.contributions) ? result.contributions : [];
    const rows = effects.map((effect, index) => {
      const effectId = String(effect?.effectId || effect?.效果ID || `${rootActionId}:effect:${index}`).trim();
      const effectRows = contributions.filter(entry => {
        const source = String(entry?.effectInstanceId || '').trim();
        return source === effectId || source.startsWith(`${effectId}:`);
      });
      const benefit = effectRows.reduce((sum, entry) => {
        const target = findUnit(result?.afterSnapshot || worldSnapshot, entry?.targetId) || findUnit(worldSnapshot, entry?.targetId) || actor;
        const targetSide = sideOf(worldSnapshot, target);
        const actorSide = sideOf(worldSnapshot, actor);
        const delta = Number(entry?.evidence?.delta ?? entry?.expectedDelta ?? 0);
        const kind = String(entry?.outcomeKind || '').trim().toUpperCase();
        const hostile = !!targetSide && !!actorSide && targetSide !== actorSide;
        if (['TAIL_FAILURE', 'IRREVERSIBLE_ASSET_LOST'].includes(kind)) return sum;
        if (['HP_DELTA', 'SCHEDULED_HP_DELTA', 'SHIELD_DELTA', 'RESOURCE_OPTION_CHANGED', 'NEXT_ACTION_QUALITY_CHANGED'].includes(kind)) {
          const favorable = hostile ? delta < 0 : delta > 0;
          if (kind === 'RESOURCE_OPTION_CHANGED' && String(entry?.windowId || '').trim() === 'ACTION_COST') return sum;
          return sum + (favorable ? normalizedContributionMagnitude(entry, target, actor) : 0);
        }
        if (['ACTION_CANCELLED', 'ACTION_GRANTED', 'BELIEF_CHANGED', 'RULE_CHANGED', 'SUMMON_WINDOW'].includes(kind)) return sum + Math.max(1, Math.abs(Number(entry?.threatValue || 0)));
        if (kind === 'STATE_CHANGED' && entry?.evidence?.marginal !== false) return sum + Math.max(1, Math.abs(Number(entry?.threatValue || 0)));
        return sum;
      }, 0);
      const risk = effectRows.reduce((sum, entry) => {
        const target = findUnit(worldSnapshot, entry?.targetId) || actor;
        const targetSide = sideOf(worldSnapshot, target);
        const actorSide = sideOf(worldSnapshot, actor);
        const delta = Number(entry?.evidence?.delta ?? entry?.expectedDelta ?? 0);
        const kind = String(entry?.outcomeKind || '').trim().toUpperCase();
        const hostile = !!targetSide && !!actorSide && targetSide !== actorSide;
        if (['TAIL_FAILURE', 'IRREVERSIBLE_ASSET_LOST'].includes(kind)) return sum + Math.max(1, Math.abs(Number(entry?.threatValue || 0)), Math.abs(delta));
        if (['HP_DELTA', 'SCHEDULED_HP_DELTA', 'SHIELD_DELTA', 'RESOURCE_OPTION_CHANGED', 'NEXT_ACTION_QUALITY_CHANGED'].includes(kind)) {
          const unfavorable = hostile ? delta > 0 : delta < 0;
          return sum + (unfavorable ? normalizedContributionMagnitude(entry, target, actor) : 0);
        }
        return sum;
      }, 0);
      return Object.freeze({
        effectIndex: index,
        effectId,
        prototype: String(effect?.原型 || '').trim(),
        contributionCount: effectRows.length,
        benefit: Math.min(100, benefit),
        risk: Math.min(100, risk),
        releaseWeight: clamp(benefit - risk, -100, 100),
        consumer: 'BattlePreview.buildEffectPlanningEvidence',
      });
    });
    const benefit = rows.reduce((sum, row) => sum + row.benefit, 0);
    const risk = rows.reduce((sum, row) => sum + row.risk, 0);
    return Object.freeze({
      source: '_效果数组',
      consumer: String(input?.consumer || 'BattlePreview.previewAction').trim(),
      effectCount: effects.length,
      coveredEffectCount: rows.filter(row => row.contributionCount > 0).length,
      benefit: Math.min(100, benefit),
      risk: Math.min(100, risk),
      releaseWeight: clamp(benefit - risk, -100, 100),
      usedInScore: input?.usedInScore === true,
      score: input?.score && typeof input.score === 'object' ? Object.freeze({ ...input.score }) : null,
      effects: Object.freeze(rows),
    });
  }

  function materializePassiveEffects(worldSnapshot = {}, options = {}) {
    let currentWorld = worldSnapshot;
    const phases = String(options?.phase || '回合开始').trim().toUpperCase() === 'ALL'
      ? ['战斗开始', '回合开始']
      : [String(options?.phase || '回合开始').trim()];
    const currentRound = Math.max(0, Number(options?.currentRound ?? worldSnapshot?.回合 ?? 0));
    const applications = [];
    phases.forEach(phase => {
      listUnits(currentWorld).forEach(entry => {
        const actor = findUnit(currentWorld, unitId(entry.unit));
        if (!actor || !isPhysicallyAlive(actor)) return;
        buildPassiveConsumerEvidence(currentWorld, actor, {
          phase,
          currentRound,
          triggeredUnitIds: options?.triggeredUnitIds,
          environmentContext: options?.environmentContext,
        })
          .filter(row => row.ready)
          .forEach(evidence => {
            const actionId = String(options?.rootActionId || `passive-consumer:${currentRound}`).trim() + `:${evidence.applicationKey}`;
            const declaration = {
              actionId,
              actorId: evidence.actorId,
              actionKind: 'RELEASE_SKILL',
              targetIds: [...evidence.targetIds],
              skill: {
                ...cloneValue(evidence.skill),
                消耗: '无',
                前摇: 0,
                _效果数组: [cloneValue(evidence.effect)],
              },
              resourceCosts: {},
              __includeGrantedEffects: false,
              __skipInventoryConsume: true,
            };
            const previewResult = previewAction({
              worldSnapshot: currentWorld,
              worldRevision: `${stableHash(currentWorld)}:${actionId}`,
              actorId: evidence.actorId,
              declaration,
              environmentContext: options?.environmentContext,
              actionFingerprint: actionId,
              horizon: 'SHALLOW',
              previewBudget: { maxNodes: 8 },
            });
            currentWorld = markPassiveApplication(previewResult.afterSnapshot, evidence, { result: 'APPLIED' });
            applications.push(Object.freeze({
              ...evidence,
              ready: true,
              applied: true,
              actionId,
              planningEvidence: previewResult.planningEvidence || null,
              contributions: Object.freeze([...(previewResult.contributions || [])]),
            }));
          });
      });
    });
    return Object.freeze({
      source: 'BattlePreview.materializePassiveEffects',
      phase: phases.length === 1 ? phases[0] : 'ALL',
      currentRound,
      applications: Object.freeze(applications),
      afterSnapshot: currentWorld,
    });
  }

  function declarationCounterGrantProfile(declaration = {}) {
    const skill = declaration?.skill && typeof declaration.skill === 'object'
      ? declaration.skill
      : declaration && typeof declaration === 'object'
        ? declaration
        : {};
    const explicitGrant = [
      skill?.反击授权,
      skill?.授予反击,
      skill?.受击反击,
      skill?.counterGrant,
      skill?.grantsCounter,
    ].some(value => value === true || Number(value) > 0);
    const counterEffects = collectEffects(skill).filter(effect =>
      String(effect?.原型 || '').trim() === '结算修正' &&
      String(effect?.结算 || effect?.结算类型 || '').trim() === '反击'
    );
    const strengthBonus = counterEffects.length
      ? clamp(Math.max(...counterEffects.map(effect => parseSignedValue(effect?.数值, 1))), -0.95, 3)
      : 0;
    return Object.freeze({
      granted: explicitGrant || counterEffects.length > 0,
      strengthBonus,
      strengthMultiplier: clamp(1 + strengthBonus, 0.05, 4),
    });
  }

  function declarationGrantsCounter(declaration = {}) {
    return declarationCounterGrantProfile(declaration).granted;
  }

  function normalizeConditionToken(value = '') {
    const text = String(value ?? '').trim();
    const aliases = {
      玩家: 'PLAYER',
      我方: 'ALLY',
      己方: 'ALLY',
      友方: 'ALLY',
      友军: 'ALLY',
      敌方: 'ENEMY',
      敌对: 'ENEMY',
      敌军: 'ENEMY',
      自身: 'SELF',
      自己: 'SELF',
      常规攻击: 'BASIC_ATTACK',
      普通攻击: 'BASIC_ATTACK',
      基础攻击: 'BASIC_ATTACK',
      魂技: 'RELEASE_SKILL',
      技能: 'RELEASE_SKILL',
      使用物品: 'USE_ITEM',
      物品: 'USE_ITEM',
      防御: 'DEFEND',
      闪避: 'EVADE',
      撤离: 'WITHDRAW',
      换装: 'EQUIP',
      观察: 'OBSERVE',
    };
    return aliases[text] || text.toUpperCase();
  }

  function parseConditionNumber(value, ratio = false) {
    const text = String(value ?? '').trim();
    if (!text) return Number.NaN;
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return Number.NaN;
    if (ratio && text.includes('%')) return numeric / 100;
    return numeric;
  }

  function compareCondition(actual, expected, comparison = '==', options = {}) {
    const operator = String(comparison || '==').trim();
    const numericActual = Number(actual);
    const numericExpected = Number(expected);
    if (options.numeric === true &&
      Number.isFinite(numericActual) &&
      Number.isFinite(numericExpected)) {
      if (operator === '>') return numericActual > numericExpected;
      if (operator === '>=') return numericActual >= numericExpected;
      if (operator === '<') return numericActual < numericExpected;
      if (operator === '<=') return numericActual <= numericExpected;
      if (operator === '!=') return Math.abs(numericActual - numericExpected) > 1e-9;
      return Math.abs(numericActual - numericExpected) <= 1e-9;
    }
    const left = normalizeConditionToken(actual);
    const right = normalizeConditionToken(expected);
    if (operator === '有') return right ? left.includes(right) : options.present === true;
    if (operator === '无') return right ? !left.includes(right) : options.present === false;
    if (operator === '包含') return left.includes(right);
    if (operator === '不包含') return !left.includes(right);
    if (operator === '!=') return left !== right;
    return left === right;
  }

function conditionSubject(condition = {}, actor = {}, target = {}, context = {}) {
  const subject = String(condition?.对象 || '目标').trim();
  if (['自身', '施术者', '使用者'].includes(subject)) return actor;
  if (subject === '本次行动') return context?.conditionTarget || context?.primaryTarget || target || actor;
    if (subject === '制作者') {
      const creatorId = String(
        context?.declaration?.creatorId ||
        context?.declaration?.producerId ||
        context?.declaration?.skill?.制作者ID ||
        context?.declaration?.skill?.制作者 ||
        ''
      ).trim();
      return creatorId ? findUnit(context?.worldSnapshot || {}, creatorId) : null;
    }
    if (subject === '召唤物') {
      if (isSummonUnit(target)) return target;
      if (isSummonUnit(actor)) return actor;
      return null;
    }
  return context?.conditionTarget || target;
  }

  function unitConditionText(unit = {}) {
    return [
      unitId(unit),
      unitName(unit),
      unit?.类型,
      unit?.单位类型,
      unit?.种族,
      unit?.阵营,
      unit?.系别,
      unit?.武魂类型,
      unit?.描述,
      unit?.摘要,
    ].map(value => String(value || '').trim()).filter(Boolean).join('|');
  }

  function conditionBooleanValue(value, fallback = false) {
    if (value === true) return true;
    if (value === false) return false;
    const token = normalizeConditionToken(value);
    if (['真', '是', '有', '存在', '生命体', 'TRUE', 'YES', '1'].includes(token)) return true;
    if (['假', '否', '无', '不存在', '非生命体', 'FALSE', 'NO', '0'].includes(token)) return false;
    return fallback;
  }

  function unitIsLiving(unit = {}) {
    if (!unit || typeof unit !== 'object') return false;
    if (typeof unit.生命体 === 'boolean') return unit.生命体;
    if (typeof unit.isLiving === 'boolean') return unit.isLiving;
    const text = unitConditionText(unit);
    if (/机甲|战舰|魂导器|器物|物品|机械体|非生命/.test(text)) return false;
    return true;
  }

  function unitBloodlineText(unit = {}) {
    return [
      unit?.血脉之力?.血脉,
      unit?.血脉?.血脉,
      unit?.血脉,
      unit?.属性?.血脉,
    ].map(value => String(value || '').trim()).filter(Boolean).join('|');
  }

  function unitEquipmentQuality(unit = {}, slot = '') {
    const equipment = unit?.装备 && typeof unit.装备 === 'object' ? unit.装备 : {};
    const wantedSlot = String(slot || '').trim();
    const entries = wantedSlot && equipment[wantedSlot]
      ? [[wantedSlot, equipment[wantedSlot]]]
      : Object.entries(equipment).filter(([key]) => ['武器', '防具', '斗铠', '机甲'].includes(key));
    const qualityRank = { 普通: 0, 优秀: 1, 稀有: 2, 史诗: 3, 传说: 4, 神器: 5, 超神器: 6 };
    return entries
      .map(([, item]) => String(item?.品质 || item?.品阶 || '').trim())
      .filter(Boolean)
      .sort((left, right) => (qualityRank[right] ?? -1) - (qualityRank[left] ?? -1))[0] || '';
  }

  function currentSkillForCondition(context = {}) {
    return context?.declaration?.skill && typeof context.declaration.skill === 'object'
      ? context.declaration.skill
      : context?.skill && typeof context.skill === 'object'
        ? context.skill
        : {};
  }

  function currentSkillAttributeText(context = {}) {
    const skill = currentSkillForCondition(context);
    const effect = context?.effect && typeof context.effect === 'object' ? context.effect : {};
    const values = [
      ...(Array.isArray(skill?.附带属性) ? skill.附带属性 : [skill?.附带属性]),
      ...(Array.isArray(skill?.属性) ? skill.属性 : [skill?.属性]),
      ...(Array.isArray(skill?.元素) ? skill.元素 : [skill?.元素]),
      ...(Array.isArray(effect?.附带属性) ? effect.附带属性 : [effect?.附带属性]),
      ...(Array.isArray(effect?.限定元素) ? effect.限定元素 : [effect?.限定元素]),
      effect?.伤害类型,
    ];
    const visit = entry => {
      if (!entry || typeof entry !== 'object') return;
      values.push(
        ...(Array.isArray(entry?.附带属性) ? entry.附带属性 : [entry?.附带属性]),
        ...(Array.isArray(entry?.属性) ? entry.属性 : [entry?.属性]),
        ...(Array.isArray(entry?.元素) ? entry.元素 : [entry?.元素]),
        ...(Array.isArray(entry?.限定元素) ? entry.限定元素 : [entry?.限定元素]),
        entry?.伤害类型,
      );
      (Array.isArray(entry?._效果数组) ? entry._效果数组 : []).forEach(visit);
      ['追加效果', '替换效果', '授予效果'].forEach(key => (Array.isArray(entry?.[key]) ? entry[key] : []).forEach(visit));
      (Array.isArray(entry?.条件分支) ? entry.条件分支 : []).forEach(branch => {
        ['追加效果', '替换效果', '授予效果'].forEach(key => (Array.isArray(branch?.[key]) ? branch[key] : []).forEach(visit));
      });
    };
    visit(skill);
    return values.map(value => String(value || '').trim()).filter(Boolean).join('|');
  }

  function currentAttackSegments(context = {}) {
    const skill = currentSkillForCondition(context);
    const effect = context?.effect && typeof context.effect === 'object' ? context.effect : {};
    const direct = Number(effect?.攻击段数 ?? effect?.段数 ?? skill?.攻击段数 ?? skill?.段数);
    if (Number.isFinite(direct) && direct > 0) return Math.max(1, Math.floor(direct));
    const segments = (Array.isArray(skill?._效果数组) ? skill._效果数组 : [])
      .map(entry => Number(entry?.攻击段数 ?? entry?.段数 ?? 0))
      .filter(value => Number.isFinite(value) && value > 0);
    return Math.max(1, Math.floor(Math.max(1, ...segments)));
  }

  function unitHasStealth(unit = {}) {
    return stateEntries(unit, 'CONDITION').some(([, state]) =>
      /隐匿|隐身|潜行/.test(stateName(state)) ||
      Number(state?.战斗效果?.stealth_level || 0) > 0 ||
      state?.战斗效果?.探查屏蔽 === true
    );
  }

  function unitCanCounterStealth(unit = {}, effect = {}, declaration = {}) {
    const text = [
      unit?.探查能力,
      unit?.感知能力,
      ...(Array.isArray(unit?.探查反制) ? unit.探查反制 : [unit?.探查反制]),
      unit?.探查反制,
      unit?.破隐能力,
      effect?.探查反制,
      declaration?.探查反制,
      declaration?.skill?.探查反制,
    ].map(value => String(value || '').trim()).filter(Boolean).join('|');
    return /探查|破隐|看破|神识锁定|感知反制/.test(text) ||
      stateEntries(unit, 'CONDITION').some(([, state]) =>
        state?.战斗效果?.探查反制 === true || state?.战斗效果?.sense_pierce === true
      );
  }

  function stealthBlocksSingleTarget(actor = {}, target = {}, effect = {}, declaration = {}) {
    if (!unitHasStealth(target) || unitCanCounterStealth(actor, effect, declaration)) return false;
    const stealthState = stateEntries(target, 'CONDITION').find(([, state]) =>
      /隐匿|隐身|潜行/.test(stateName(state)) ||
      Number(state?.战斗效果?.stealth_level || 0) > 0 ||
      state?.战斗效果?.探查屏蔽 === true
    )?.[1];
    const limiter = String(stealthState?.限定探查者 || '').trim();
    return !limiter || unitConditionText(actor).includes(limiter);
  }

  function equipmentConditionText(unit = {}) {
    const equipment = [
      unit?.装备,
      unit?.已装备,
      unit?.装备栏,
      unit?.__battleRuntime?.equippedDecisionItem,
    ];
    return JSON.stringify(equipment);
  }

  function conditionMatches(
    condition = {},
    worldSnapshot = {},
    actor = {},
    target = {},
    context = {},
  ) {
    const type = String(condition?.类型 || '').trim();
    const comparison = String(condition?.比较 || '==').trim();
    const expected = condition?.值 ?? condition?.状态 ?? '';
    const subject = conditionSubject(
      condition,
      actor,
      target,
      { ...context, worldSnapshot },
    );
    if (type === '时间') {
      const actual = String(
        worldSnapshot?.时间段 ||
        worldSnapshot?.时间 ||
        worldSnapshot?.环境?.时间段 ||
        actor?.时间段 ||
        actor?.时间 ||
        '白天'
      ).trim();
      return compareCondition(actual, expected, comparison);
    }
    if (type === '目标') {
      if (!subject) return comparison === '无' || comparison === '!=';
      const actorId = unitId(actor);
      const subjectId = unitId(subject);
      const relation = actorId && subjectId && actorId === subjectId
        ? 'SELF|ALLY'
        : sideOf(worldSnapshot, subject) === sideOf(worldSnapshot, actor)
          ? 'ALLY'
          : 'ENEMY';
      return compareCondition(relation, expected, comparison, { present: true });
    }
    if (type === '当前行动') {
      const declaration = context?.declaration && typeof context.declaration === 'object'
        ? context.declaration
        : {};
      const actionKind = String(
        declaration.actionKind ||
        context?.actionKind ||
        context?.action?.actionKind ||
        '',
      ).trim();
      const actionName = String(
        declaration?.skill?.魂技名 ||
        declaration?.skill?.name ||
        declaration?.actionName ||
        context?.actionName ||
        context?.action?.actionName ||
        ''
      ).trim();
      return compareCondition(
        `${normalizeConditionToken(actionKind)}|${normalizeConditionToken(actionName)}`,
        expected,
        comparison === '==' ? '包含' : comparison === '!=' ? '不包含' : comparison,
      );
    }
    if (type === '命中' || type === '被闪避') {
      const outcome = String(context?.primaryOutcome || '').trim().toUpperCase();
      const probability = Number(
        type === '命中'
          ? context?.primarySuccessProbability
          : context?.primaryEvadeProbability
      );
      if (
        !outcome &&
        Number.isFinite(probability) &&
        probability > 1e-9 &&
        probability < 1 - 1e-9
      ) {
        throw new Error(`battle_preview_conditional_probability_unresolved:${type}`);
      }
      const present = type === '命中'
        ? outcome === 'HIT' ||
          context?.primarySucceeded === true ||
          probability >= 1 - 1e-9
        : outcome === 'EVADED' ||
          context?.primaryEvaded === true ||
          probability >= 1 - 1e-9;
      return compareCondition(present ? type : '', type, comparison, { present });
    }
    if (!subject) return comparison === '无' || comparison === '!=';
    if (type === '状态存在') {
      const state = String(condition?.状态 || expected || '').trim();
      const entries = stateEntries(subject, 'CONDITION');
      const present = state === '任意状态'
        ? entries.length > 0
        : state === '任意负面'
          ? entries.some(([, entry]) => statePolarity(entry) < 0)
          : state === '任意正面'
            ? entries.some(([, entry]) => statePolarity(entry) > 0)
            : state === '任意持续伤害'
              ? entries.some(([, entry]) => stateIsDamageOverTime(entry))
              : entries.some(([key, entry]) =>
                  [key, stateName(entry)].some(value =>
                    normalizeConditionToken(value) === normalizeConditionToken(state)
                  )
                );
      return compareCondition(present ? state : '', state, comparison, { present });
    }
    if (type === '护盾') {
      const present = readShield(subject) > 1e-9;
      return compareCondition(present ? '护盾' : '', '护盾', comparison, { present });
    }
    const resourceMatch = /^(生命|体力|魂力|精神力)(比例|数值)$/.exec(type);
    if (resourceMatch) {
      const resource = resourceMatch[1];
      const ratio = resourceMatch[2] === '比例';
      const current = resource === '生命'
        ? readHp(subject)
        : readResource(subject, resource);
      const maximum = resource === '生命'
        ? readHpMax(subject)
        : readResourceMax(subject, resource);
      const actual = ratio ? current / Math.max(1, maximum) : current;
      return compareCondition(
        actual,
        parseConditionNumber(expected, ratio),
        comparison,
        { numeric: true },
      );
    }
    if (type === '等级') {
      const actual = Number(subject?.属性?.等级 ?? subject?.等级 ?? subject?.level ?? 0);
      const expectedLevel = normalizeConditionToken(expected) === 'SELF'
        ? Number(actor?.属性?.等级 ?? actor?.等级 ?? actor?.level ?? 0)
        : Number(expected);
      return compareCondition(actual, expectedLevel, comparison, { numeric: true });
    }
    if (type === '技能属性') {
      return compareCondition(
        currentSkillAttributeText({ ...context, effect: context?.effect || {} }),
        expected,
        comparison === '==' ? '包含' : comparison,
      );
    }
    if (type === '攻击段数') {
      return compareCondition(currentAttackSegments(context), Number(expected), comparison, { numeric: true });
    }
    if (type === '终结') {
      const terminated = context?.primaryTerminated === true ||
        String(context?.primaryOutcome || '').trim().toUpperCase() === 'TERMINATED';
      return compareCondition(terminated, conditionBooleanValue(expected, true), comparison, { numeric: true });
    }
    if (type === '生命体') {
      const living = unitIsLiving(subject);
      return compareCondition(living, conditionBooleanValue(expected, true), comparison, { numeric: true });
    }
    if (type === '装备品质') {
      const qualityRank = { 普通: 0, 优秀: 1, 稀有: 2, 史诗: 3, 传说: 4, 神器: 5, 超神器: 6 };
      const slot = String(condition?.装备槽位 || condition?.装备 || '').trim();
      const actual = unitEquipmentQuality(subject, slot);
      const expectedRank = qualityRank[String(expected || '').trim()];
      if (Number.isFinite(expectedRank) && Number.isFinite(qualityRank[actual])) {
        return compareCondition(qualityRank[actual], expectedRank, comparison, { numeric: true });
      }
      return compareCondition(actual, expected, comparison);
    }
    if (type === '反抗状态') {
      const stateText = stateEntries(subject, 'CONDITION')
        .map(([, state]) => stateName(state))
        .join('|');
      const reactionKind = String(
        context?.reaction?.event?.actionKind ||
        context?.reaction?.actionKind ||
        context?.reactionKind ||
        subject?.当前姿态 ||
        subject?.反抗状态 ||
        '',
      ).trim();
      const actual = [stateText, reactionKind].filter(Boolean).join('|');
      const wanted = String(condition?.状态 || expected || '反抗').trim();
      const present = /反抗|防御|抵抗|反击|闪避|护卫/.test(actual) ||
        Number(subject?.__battleRuntime?.反抗值 || 0) > 0;
      if (
        typeof expected === 'boolean' ||
        ['TRUE', 'FALSE', 'YES', 'NO', '真', '假', '是', '否', '有', '无'].includes(normalizeConditionToken(expected))
      ) {
        const wantedPresence = conditionBooleanValue(expected, false);
        if (comparison === '!=' || comparison === '不等于') return present !== wantedPresence;
        return present === wantedPresence;
      }
      return compareCondition(present ? (actual || wanted) : '', wanted, comparison === '==' ? '包含' : comparison, { present });
    }
    if (type === '血脉') {
      return compareCondition(unitBloodlineText(subject), expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '天赋梯队') {
      const 天赋梯队序号 = {
        天赋极差: 0,
        劣等: 1,
        正常: 2,
        优秀: 3,
        天才: 4,
        顶级天才: 5,
        绝世妖孽: 6,
      };
      const 当前梯队 = String(
        subject?.属性?.天赋梯队 ||
        subject?.天赋梯队 ||
        '正常'
      ).trim();
      const actualRank = 天赋梯队序号[当前梯队];
      const expectedRank = 天赋梯队序号[String(expected || '').trim()];
      if (!Number.isFinite(actualRank) || !Number.isFinite(expectedRank)) {
        return compareCondition(当前梯队, String(expected || '').trim(), comparison);
      }
      return compareCondition(actualRank, expectedRank, comparison, { numeric: true });
    }
    if (type === '环境满足') {
      const environment = JSON.stringify(
        worldSnapshot?.环境 ||
        worldSnapshot?.战斗环境 ||
        worldSnapshot?.场地 ||
        ''
      );
      return compareCondition(environment, expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '装备状态') {
      const equipment = equipmentConditionText(subject);
      return compareCondition(equipment, expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '自身状态') {
      const incapacityReason = String(subject?.__战斗失能原因 || '').trim();
      const present = normalizeConditionToken(incapacityReason).includes(normalizeConditionToken(expected)) ||
        stateEntries(subject, 'CONDITION').some(([key, entry]) =>
          [key, stateName(entry)].some(value =>
            normalizeConditionToken(value).includes(normalizeConditionToken(expected))
          )
        );
      return compareCondition(present ? expected : '', expected, comparison, { present });
    }
    if (type === '使用者') {
      const creatorId = String(
        context?.declaration?.creatorId ||
        context?.declaration?.producerId ||
        context?.declaration?.skill?.制作者ID ||
        context?.declaration?.skill?.制作者 ||
        ''
      ).trim();
      const expectedToken = normalizeConditionToken(expected);
      const actual = expectedToken === '制作者'.toUpperCase()
        ? unitId(actor) === creatorId || unitName(actor) === creatorId
          ? '制作者'
          : '其他使用者'
        : unitConditionText(subject);
      return compareCondition(actual, expected, comparison);
    }
    if (type === '连携前提') {
      const fusion = [
        context?.declaration?.fusionKey,
        ...(context?.declaration?.fusionParticipantIds || []),
        context?.declaration?.skill?.连携前提,
      ].map(value => String(value || '').trim()).filter(Boolean).join('|');
      return compareCondition(fusion, expected, comparison === '==' ? '包含' : comparison);
    }
    if (type === '单位文本') {
      return compareCondition(
        unitConditionText(subject),
        expected,
        comparison === '==' ? '包含' : comparison,
      );
    }
    return compareCondition(
      unitConditionText(subject),
      type || expected,
      comparison,
      {
        present: normalizeConditionToken(unitConditionText(subject))
          .includes(normalizeConditionToken(type || expected)),
      },
    );
  }

  function effectConditionEnabled(
    effect = {},
    worldSnapshot = {},
    actor = {},
    target = {},
    context = {},
  ) {
    if (!Array.isArray(effect?.条件分支) || effect.条件分支.length === 0) return true;
    return resolveConditionalEffectPlan(
      effect,
      worldSnapshot,
      actor,
      target,
      context,
    ).length > 0;
  }

  function resolveConditionalEffectPlan(
    effect = {},
    worldSnapshot = {},
    actor = {},
    target = {},
    context = {},
  ) {
    const branches = Array.isArray(effect?.条件分支) ? effect.条件分支 : [];
    if (!branches.length) {
      return Object.freeze([Object.freeze({
        effect,
        mode: 'ORIGINAL',
        branchIndex: -1,
        nestedIndex: 0,
      })]);
    }
    const branchMatches = branch => {
      const conditions = Array.isArray(branch?.条件) ? branch.条件 : [];
      return conditions.length > 0 && conditions.every(condition =>
        conditionMatches(condition, worldSnapshot, actor, target, { ...context, effect })
      );
    };
    const matched = branches
      .map((branch, branchIndex) => ({ branch, branchIndex }))
      .filter(({ branch }) => branchMatches(branch));
    if (matched.some(({ branch }) => String(branch?.处理 || '').trim() === '禁用')) {
      return Object.freeze([]);
    }
    const enablingBranches = branches.filter(branch =>
      String(branch?.处理 || '').trim() === '生效'
    );
    if (
      enablingBranches.length &&
      !matched.some(({ branch }) => String(branch?.处理 || '').trim() === '生效')
    ) {
      return Object.freeze([]);
    }
    const replacement = matched.find(({ branch }) =>
      String(branch?.处理 || '').trim() === '替换效果'
    );
    const parentEffect = { ...effect };
    delete parentEffect.条件分支;
    const plan = replacement
      ? (Array.isArray(replacement.branch?.替换效果)
          ? replacement.branch.替换效果
          : [])
          .map((nested, nestedIndex) => ({
            effect: nested,
            mode: 'REPLACE',
            branchIndex: replacement.branchIndex,
            nestedIndex,
          }))
      : [{
          effect: parentEffect,
          mode: 'ORIGINAL',
          branchIndex: -1,
          nestedIndex: 0,
        }];
    matched
      .filter(({ branch }) => String(branch?.处理 || '').trim() === '追加效果')
      .forEach(({ branch, branchIndex }) => {
        (Array.isArray(branch?.追加效果) ? branch.追加效果 : []).forEach(
          (nested, nestedIndex) => {
            plan.push({
              effect: nested,
              mode: 'APPEND',
              branchIndex,
              nestedIndex,
            });
          },
        );
      });
    return Object.freeze(plan.map(entry => Object.freeze(entry)));
  }

  function validateEffect(effect = {}) {
    const prototype = String(effect?.原型 || '').trim();
    const definition = prototypeRegistry[prototype];
    if (!definition) throw new Error(`battle_preview_unknown_prototype:${prototype}`);
    if (nonBattlePrototypes.has(prototype)) throw new Error(`battle_preview_non_battle_prototype:${prototype}`);
    if (!battlePrototypes.has(prototype)) throw new Error(`battle_preview_prototype_not_implemented:${prototype}`);
    (definition?.必填字段 || []).forEach(field => {
      const value = effect[field];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
        throw new Error(`battle_preview_required_field_missing:${prototype}:${field}`);
      }
    });
    Object.entries(definition?.字段定义 || {}).forEach(([field, fieldDefinition]) => {
      if (effect[field] === undefined || !Array.isArray(fieldDefinition?.选项) || !fieldDefinition.选项.length) return;
      const values = Array.isArray(effect[field]) ? effect[field] : [effect[field]];
      values.forEach(value => {
        const normalized = String(value ?? '').trim();
        const accepted = field === '触发方式'
          ? new Set([...fieldDefinition.选项, ...passiveTriggerEnums])
          : null;
        if (normalized && !(accepted ? accepted.has(normalized) : fieldDefinition.选项.includes(normalized))) {
          throw new Error(`battle_preview_unknown_enum:${prototype}:${field}:${normalized}`);
        }
      });
    });
    return definition;
  }

  class PreviewOverlay {
    constructor(baseWorld = {}, baseRevision = '', parent = null) {
      if (
        parent &&
        (
          !(parent instanceof PreviewOverlay) ||
          parent.baseWorld !== baseWorld
        )
      ) {
        throw new Error('battle_preview_overlay_parent_mismatch');
      }
      this.baseWorld = baseWorld;
      this.baseRevision = String(baseRevision || stableHash(baseWorld));
      this.parent = parent;
      this.changedUnits = new Map();
      this.changedStates = new Map();
      this.changedResources = new Map();
      this.changedRules = new Map();
      this.createdSummons = new Map();
      this.summonDefinitionHashes = new Map();
      this.removedSummons = new Set();
      this.scheduledEvents = [];
    }

    readMapEntry(mapName, key) {
      const normalizedKey = String(key || '').trim();
      for (let overlay = this; overlay; overlay = overlay.parent) {
        if (
          (mapName === 'createdSummons' ||
            mapName === 'summonDefinitionHashes') &&
          overlay.removedSummons.has(normalizedKey)
        ) {
          return undefined;
        }
        if (overlay[mapName].has(normalizedKey)) {
          return overlay[mapName].get(normalizedKey);
        }
      }
      return undefined;
    }

    mergedMap(mapName) {
      const chain = [];
      for (let overlay = this; overlay; overlay = overlay.parent) {
        chain.push(overlay);
      }
      const merged = new Map();
      for (let index = chain.length - 1; index >= 0; index -= 1) {
        const overlay = chain[index];
        if (
          mapName === 'createdSummons' ||
          mapName === 'summonDefinitionHashes'
        ) {
          overlay.removedSummons.forEach(id => merged.delete(id));
        }
        overlay[mapName].forEach((value, key) => merged.set(key, value));
      }
      return merged;
    }

    mergedScheduledEvents() {
      const chain = [];
      for (let overlay = this; overlay; overlay = overlay.parent) {
        chain.push(overlay);
      }
      return chain
        .reverse()
        .flatMap(overlay => overlay.scheduledEvents);
    }

    readUnit(id) {
      const key = String(id || '').trim();
      return this.readMapEntry('changedUnits', key) ||
        this.readMapEntry('createdSummons', key) ||
        findUnit(this.baseWorld, key);
    }

    writeUnit(unit) {
      const id = unitId(unit);
      if (!id) throw new Error('battle_preview_overlay_unit_id_missing');
      this.changedUnits.set(id, unit);
      metrics.overlayWrites += 1;
      return unit;
    }

    writeSummon(unit, definitionHash = '') {
      const id = unitId(unit);
      if (!id) throw new Error('battle_preview_overlay_summon_id_missing');
      const normalizedDefinitionHash = String(definitionHash || stableHash(unit)).trim();
      const existingCreated = this.readMapEntry('createdSummons', id);
      if (existingCreated) {
        if (
          this.readMapEntry('summonDefinitionHashes', id) !==
          normalizedDefinitionHash
        ) {
          throw new Error(`SUMMON_PREVIEW_INSTANCE_CONFLICT:${id}`);
        }
        return existingCreated;
      }
      const existing = findUnit(this.baseWorld, id);
      if (existing) {
        if (String(existing?.__definitionHash || '').trim() !== normalizedDefinitionHash) {
          throw new Error(`SUMMON_PREVIEW_INSTANCE_CONFLICT:${id}`);
        }
        return existing;
      }
      this.removedSummons.delete(id);
      this.createdSummons.set(id, unit);
      this.summonDefinitionHashes.set(id, normalizedDefinitionHash);
      metrics.overlayWrites += 1;
      return unit;
    }

    changeSummon(id, mutator) {
      const key = String(id || '').trim();
      const current = this.readMapEntry('createdSummons', key);
      if (!current) throw new Error(`battle_preview_overlay_created_summon_missing:${key}`);
      const next = cloneUnitForOverlay(current);
      mutator(next);
      this.removedSummons.delete(key);
      this.createdSummons.set(key, next);
      metrics.overlayWrites += 1;
      return next;
    }

    removeSummon(id) {
      const key = String(id || '').trim();
      if (!this.readMapEntry('createdSummons', key)) {
        throw new Error(`battle_preview_overlay_created_summon_missing:${key}`);
      }
      this.createdSummons.delete(key);
      this.summonDefinitionHashes.delete(key);
      this.removedSummons.add(key);
      metrics.overlayWrites += 1;
    }

    changeUnit(id, mutator) {
      const current = this.readUnit(id);
      if (!current) throw new Error(`battle_preview_overlay_unit_missing:${id}`);
      const next = cloneUnitForOverlay(current);
      mutator(next);
      return this.writeUnit(next);
    }

    setResource(id, resource, value) {
      const current = this.readUnit(id);
      if (!current) throw new Error(`battle_preview_overlay_unit_missing:${id}`);
      // Resource settlement can change survival and sustain state, but never inventory.
      const next = cloneUnitForOverlay(current, false);
      setResourceValue(next, resource, value);
      return this.writeUnit(next);
    }

    schedule(event) {
      this.scheduledEvents.push(Object.freeze({ ...event }));
      metrics.overlayWrites += 1;
    }

    writeRule(key, value) {
      const normalized = String(key || '').trim();
      if (!normalized) throw new Error('battle_preview_overlay_rule_key_missing');
      this.changedRules.set(normalized, cloneValue(value));
      metrics.overlayWrites += 1;
    }

    fork() {
      return new PreviewOverlay(this.baseWorld, this.baseRevision, this);
    }

    commitFrom(child) {
      if (
        !(child instanceof PreviewOverlay) ||
        child.baseWorld !== this.baseWorld ||
        child.parent !== this
      ) {
        throw new Error('battle_preview_overlay_transaction_mismatch');
      }
      this.changedUnits = child.mergedMap('changedUnits');
      this.changedStates = child.mergedMap('changedStates');
      this.changedResources = child.mergedMap('changedResources');
      this.changedRules = child.mergedMap('changedRules');
      this.createdSummons = child.mergedMap('createdSummons');
      this.summonDefinitionHashes = child.mergedMap('summonDefinitionHashes');
      this.removedSummons = new Set();
      this.scheduledEvents = child.mergedScheduledEvents();
      this.parent = null;
    }

    snapshot() {
      const changedUnits = this.mergedMap('changedUnits');
      const changedRules = this.mergedMap('changedRules');
      const createdSummons = this.mergedMap('createdSummons');
      const scheduledEvents = this.mergedScheduledEvents();
      const participants = this.baseWorld?.参战者 || {};
      const nextParticipants = Object.fromEntries(Object.entries(participants).map(([side, value]) => {
        if (Array.isArray(value)) {
          return [side, value.map(unit => changedUnits.get(unitId(unit)) || unit)];
        }
        if (value && typeof value === 'object') {
          return [side, Object.fromEntries(Object.entries(value).map(([key, unit]) => [key, changedUnits.get(unitId(unit)) || unit]))];
        }
        return [side, value];
      }));
      const snapshot = { ...this.baseWorld, 参战者: nextParticipants };
      const summons = this.baseWorld?.召唤单位表;
      if ((summons && typeof summons === 'object' && Object.keys(summons).length) || createdSummons.size) {
        Object.defineProperty(snapshot, '召唤单位表', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: {
            ...Object.fromEntries(Object.entries(summons || {}).map(([key, unit]) => [
              key,
              changedUnits.get(unitId(unit)) || unit,
            ])),
            ...Object.fromEntries(createdSummons),
          },
        });
      }
      if (changedRules.size) {
        Object.defineProperty(snapshot, '__battlePreviewRuleOverlay', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: Object.fromEntries(changedRules),
        });
      }
      if (scheduledEvents.length) {
        Object.defineProperty(snapshot, '__battlePreviewScheduledEvents', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: [...scheduledEvents],
        });
      }
      return snapshot;
    }
  }

  function summonInstanceId(rootActionFingerprint = '', effectInstanceId = '', summonOrdinal = 1) {
    const rootFingerprint = String(rootActionFingerprint || '').trim();
    const effectId = String(effectInstanceId || '').trim();
    const ordinal = Math.max(1, Math.floor(Number(summonOrdinal || 1)));
    if (!rootFingerprint || !effectId) throw new Error('battle_preview_summon_identity_missing');
    return `${rootFingerprint}:${effectId}:${ordinal}`;
  }

  class ContributionLedger {
    constructor() {
      this.entries = [];
      this.semanticKeys = new Set();
      this.actionCancelledWindows = new Set();
    }

    addOutcome(input = {}) {
      const outcomeKind = String(input?.outcomeKind || '').trim();
      if (!outcomeComponents[outcomeKind]) throw new Error(`battle_preview_outcome_kind_unsupported:${outcomeKind}`);
      const resourceKey = String(input?.resourceKey || '').trim();
      const semanticKeyParts = [input.rootActionId, input.effectInstanceId, input.targetId, outcomeKind];
      if (resourceKey) semanticKeyParts.push(resourceKey);
      semanticKeyParts.push(input.windowId || 'NOW');
      const semanticKey = semanticKeyParts
        .map(value => String(value || '').trim() || 'NONE').join('|');
      if (this.semanticKeys.has(semanticKey)) throw new Error(`battle_preview_duplicate_causal_value:${semanticKey}`);
      const windowKey = `${String(input.rootActionId || '')}|${String(input.targetId || '')}|${String(input.windowId || 'NOW')}`;
      if (outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED' && this.actionCancelledWindows.has(windowKey)) {
        throw new Error(`battle_preview_mutually_exclusive_causal_value:${windowKey}`);
      }
      if (outcomeKind === 'ACTION_CANCELLED') {
        if (this.entries.some(entry => entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED' && entry.windowKey === windowKey)) {
          throw new Error(`battle_preview_mutually_exclusive_causal_value:${windowKey}`);
        }
        this.actionCancelledWindows.add(windowKey);
      }
      this.semanticKeys.add(semanticKey);
      const evidence = input.evidence && typeof input.evidence === 'object'
        ? Object.freeze({ ...input.evidence })
        : Object.freeze({});
      const explicitDelta = Number(evidence?.delta);
      const expectedDamage = Number(evidence?.expectedDamage);
      const expectedDelta = Number.isFinite(explicitDelta)
        ? explicitDelta
        : ['HP_DELTA', 'SCHEDULED_HP_DELTA'].includes(outcomeKind) &&
            Number.isFinite(expectedDamage)
          ? -Math.abs(expectedDamage)
          : null;
      const entry = Object.freeze({
        semanticKey,
        eventId: semanticKey,
        rootCauseId: String(input.rootActionId || '').trim(),
        sourceActionId: String(
          input.sourceActionId ||
          input.declaration?.actionId ||
          input.rootActionId ||
          '',
        ).trim(),
        actorId: input.actor ? unitId(input.actor) : String(input.actorId || '').trim(),
        actionRole: String(
          input.actionRole ||
          input.declaration?.actionRole ||
          '',
        ).trim().toUpperCase(),
        effectInstanceId: String(input.effectInstanceId || '').trim(),
        ...(resourceKey ? { resourceKey } : {}),
        targetId: String(input.targetId || '').trim(),
        windowId: String(input.windowId || 'NOW').trim(),
        windowKey,
        outcomeKind,
        component: outcomeComponents[outcomeKind],
        threatValue: Number(input.threatValue || 0),
        ...(expectedDelta === null ? {} : { expectedDelta }),
        evidence,
      });
      this.entries.push(entry);
      return entry;
    }

    fork() {
      const child = new ContributionLedger();
      child.entries = [...this.entries];
      child.semanticKeys = new Set(this.semanticKeys);
      child.actionCancelledWindows = new Set(this.actionCancelledWindows);
      return child;
    }

    commitFrom(child) {
      if (!(child instanceof ContributionLedger)) throw new Error('battle_preview_contribution_transaction_mismatch');
      this.entries = child.entries;
      this.semanticKeys = child.semanticKeys;
      this.actionCancelledWindows = child.actionCancelledWindows;
    }
  }

  function effectTargetsAllies(effect = {}) {
    const prototype = String(effect?.原型 || '').trim();
    if (prototype === '资源转移') {
      const mode = String(effect?.资源转移方式 || '').trim();
      if (mode === '吞噬') return false;
      if (['共享', '均分', '转移'].includes(mode)) return true;
    }
    const targetText = String(effect?.目标 || '').trim();
    if (/自身|友方|己方/.test(targetText)) return true;
    if (/敌方|对方/.test(targetText)) return false;
    if (prototype === '伤害结算' || prototype === '机制抹消') return false;
    if (prototype === '召唤生成' || prototype === '机制授予' || prototype === '规则防御') return true;
    if (prototype === '护盾变化') {
      return !/负向|削减|移除|破盾/.test(String(effect?.护盾模式 || '')) &&
        parseSignedValue(effect?.数值, 1) >= 0;
    }
    if (prototype === '资源变化') return parseSignedValue(effect?.数值, 1) >= 0;
    if (prototype === '判定修正' || prototype === '结算修正') {
      const helpers = root.__LWCS_SKILL_COST_HELPERS_V1__;
      const semanticJudge = prototype === '判定修正'
        ? helpers?.判定修正是否增益语义_V1
        : helpers?.结算修正是否增益语义_V1;
      if (typeof semanticJudge !== 'function') {
        throw new Error('battle_preview_skill_semantic_helpers_missing');
      }
      return semanticJudge(effect);
    }
    if (prototype === '时窗修正') {
      const selectors = timeWindowStateSelectors(effect);
      if (selectors.some(selector => /任意持续伤害|中毒|流血|灼烧|冻伤|持续创伤/.test(selector))) return false;
      const compression = /压缩|减少|缩短/.test(String(effect?.调整方式 || '').trim());
      if (selectors.includes('任意负面')) return compression;
      if (selectors.includes('任意正面')) return !compression;
      return parseSignedValue(effect?.数值 ?? effect?.副数值, 1) >= 0;
    }
    if (prototype === '属性修正') {
      return parseSignedValue(effect?.数值 ?? effect?.副数值, 1) >= 0;
    }
    if (prototype === '状态移除') return /负面|减益|控制|异常/.test(String(effect?.状态 || effect?.状态名称 || ''));
    if (prototype === '状态施加') {
      const type = String(effect?.类型 || '').trim().toLowerCase();
      if (type === 'buff') return true;
      if (type === 'debuff') return false;
      const state = String(effect?.状态 || effect?.状态名称 || '').trim();
      if (/迟缓|僵直|眩晕|昏迷|中毒|灼烧|虚弱|禁锢|束缚|沉默|缴械|致盲|标记|减速|索敌干扰|禁疗|治疗反转/.test(state)) return false;
      if (/护盾|恢复|治疗|增幅|强化|免疫|无视异常|霸体|加速/.test(state)) return true;
      const combatEffect = deriveStateCombatEffect(effect);
      if (combatEffect.skip_turn === true || combatEffect.cannot_act === true ||
        Number(combatEffect.dodge_penalty || 0) > 0 || Number(combatEffect.reaction_penalty || 0) > 0 ||
        Number(combatEffect.lock_level || 0) > 0 || Number(combatEffect.dot_damage || 0) > 0 ||
        Number(combatEffect.heal_reduction || 0) > 0) return false;
      const rawValue = effect?.数值 ?? effect?.副数值;
      return String(rawValue ?? '').trim() ? parseSignedValue(rawValue, 1) >= 0 : false;
    }
    return false;
  }

  function resolveTargets(
    worldSnapshot = {},
    actor = {},
    declaration = {},
    effect = {},
    projectionContext = null,
  ) {
    const all = projectionContext?.schemaVersion ===
      'MechanicalProjectionContextV1'
      ? projectionContext.entries
      : listUnits(worldSnapshot);
    const actorProfile = mechanicalProjectionProfile(
      projectionContext,
      actor,
    );
    const actorSide = actorProfile?.side || sideOf(worldSnapshot, actor);
    const targetText = String(effect?.目标 || declaration?.targetKind || '').trim();
    const effectPrototype = String(effect?.原型 || '').trim();
    const positionObject = effectPrototype === '位移执行'
      ? String(effect?.位移对象 || '').trim()
      : '';
    if (positionObject === '自身') return [actor];
    if (positionObject === '自身与目标') {
      const targetRecipients = resolveTargets(
        worldSnapshot,
        actor,
        declaration,
        { ...effect, 位移对象: '目标' },
        projectionContext,
      );
      return [actor, ...targetRecipients].filter((unit, index, recipients) =>
        recipients.findIndex(candidate => unitId(candidate) === unitId(unit)) === index
      );
    }
    const excludesActorEndpoint = effectPrototype === '资源转移';
    const declaredIds = Array.isArray(declaration?.targetIds) ? declaration.targetIds.map(String) : [];
    const groupTarget = /友方.*群体|己方.*群体|全场|群体/.test(targetText);
    const targetIsEligible = (target, respectStealth = true) => {
      const profile = mechanicalProjectionProfile(
        projectionContext,
        target,
      );
      const eligible = effectTargetsAllies(effect)
        ? profile
          ? profile.physicallyAlive
          : isPhysicallyAlive(target)
        : profile
          ? profile.battleCapable
          : isBattleCapable(target);
      if (!eligible || !respectStealth || groupTarget || effectTargetsAllies(effect)) return eligible;
      return !stealthBlocksSingleTarget(actor, target, effect, declaration);
    };
    if (/召唤物/.test(targetText)) {
      const summonEntries = all.filter(entry =>
        isSummonUnit(entry.unit) && targetIsEligible(entry.unit, false),
      );
      if (/全场/.test(targetText)) return summonEntries.map(entry => entry.unit);
      const targetSide = /敌方|对方/.test(targetText)
        ? entry => entry.side !== actorSide
        : entry => entry.side === actorSide;
      const eligibleSummons = summonEntries.filter(targetSide).map(entry => entry.unit);
      const declaredSummons = declaredIds.length
        ? eligibleSummons.filter(unit => declaredIds.includes(unitId(unit)))
        : [];
      return declaredSummons.length ? declaredSummons : eligibleSummons;
    }
    if (/自身/.test(targetText)) return excludesActorEndpoint ? [] : [actor];
    if (/融合伙伴/.test(targetText)) {
      const participantRefs = [
        ...(Array.isArray(declaration?.fusionParticipantIds) ? declaration.fusionParticipantIds : []),
        ...(Array.isArray(declaration?.融合参与者) ? declaration.融合参与者 : []),
      ];
      const participantIds = participantRefs.flatMap(value => {
        if (value && typeof value === 'object') return [value?.id, value?.角色键, value?.角色名, value?.name, value?.名称];
        return [value];
      }).map(value => String(value || '').trim()).filter(Boolean);
      const markerRefs = [
        ...(Array.isArray(actor?.融合伙伴) ? actor.融合伙伴 : [actor?.融合伙伴]),
        ...(Array.isArray(actor?.武魂融合伙伴) ? actor.武魂融合伙伴 : [actor?.武魂融合伙伴]),
        ...(Array.isArray(actor?.__battleRuntime?.fusionPartnerIds) ? actor.__battleRuntime.fusionPartnerIds : []),
      ];
      const markerIds = markerRefs.flatMap(value => {
        if (value && typeof value === 'object') return [value?.id, value?.角色键, value?.角色名, value?.name, value?.名称];
        return [value];
      }).map(value => String(value || '').trim()).filter(Boolean);
      const wanted = new Set([...participantIds, ...markerIds]);
      if (!wanted.size) return [];
      return all
        .map(entry => entry.unit)
        .filter(unit => unitId(unit) !== unitId(actor))
        .filter(unit => sideOf(worldSnapshot, unit) === actorSide)
        .filter(unit => wanted.has(unitId(unit)) || wanted.has(unitName(unit)))
        .filter(unit => targetIsEligible(unit, false));
    }
    if (/友方.*群体|己方.*群体|全场|群体/.test(targetText)) {
      const friendly = all.filter(entry =>
        entry.side === actorSide && targetIsEligible(entry.unit, false) &&
        (!excludesActorEndpoint || unitId(entry.unit) !== unitId(actor))
      ).map(entry => entry.unit);
      const hostile = all.filter(entry =>
        entry.side !== actorSide && isBattleCapable(entry.unit)
      ).map(entry => entry.unit);
      if (/友方.*群体|己方.*群体/.test(targetText)) return friendly;
      if (/全场/.test(targetText)) return [...friendly, ...hostile];
      return effectTargetsAllies(effect) ? friendly : hostile;
    }
    if (declaredIds.length) {
      const declaredTargets = declaredIds
        .map(id =>
          projectionContext?.unitById?.get(id) ||
          findUnit(worldSnapshot, id)
        )
        .filter(target => target && targetIsEligible(target));
      const explicitFriendly = /友方|己方/.test(targetText);
      const explicitHostile = /敌方|对方/.test(targetText);
      const targetsAllies = effectTargetsAllies(effect);
      const requiresFriendly = explicitFriendly || (!explicitHostile && targetsAllies);
      const requiresHostile = explicitHostile || (!explicitFriendly && !targetsAllies);
      const sideMatched = declaredTargets.filter(target => {
        if (excludesActorEndpoint && unitId(target) === unitId(actor)) return false;
        const targetSide = mechanicalProjectionProfile(
          projectionContext,
          target,
        )?.side || sideOf(worldSnapshot, target);
        if (requiresFriendly) return targetSide === actorSide;
        if (requiresHostile) return targetSide !== actorSide;
        return true;
      });
      // A declaration may carry the whole hostile/friendly group because a
      // sibling effect is group-scoped.  A non-group effect still has exactly
      // one primary target: the first compatible id in declaration order.
      // Returning the whole declaration here made every "single + group"
      // skill silently promote its single-target effects to group effects.
      if (sideMatched.length) return sideMatched.slice(0, 1);
    }
    const friendly = all.filter(entry =>
      entry.side === actorSide && targetIsEligible(entry.unit) &&
      (!excludesActorEndpoint || unitId(entry.unit) !== unitId(actor))
    ).map(entry => entry.unit);
    const hostile = all.filter(entry => entry.side !== actorSide && isBattleCapable(entry.unit)).map(entry => entry.unit);
    if (/友方|己方/.test(targetText) ||
      (!/敌方|对方/.test(targetText) && effectTargetsAllies(effect))) {
      return friendly.slice(0, 1);
    }
    return hostile.slice(0, 1);
  }

  function refreshSustainRuntimeLoad(unit = {}) {
    const totalLoad = Math.max(0, Math.min(0.75,
      Object.values(unit?.持续效果 || {}).filter(Boolean)
        .reduce((total, effect) => total + Number(effect?.维持负荷 || 0), 0),
    ));
    if (totalLoad > 0) {
      unit.__维持负荷 = totalLoad;
      unit.__维持反应惩罚 = Math.min(0.25, totalLoad * 0.5);
      unit.__维持前摇系数 = 1 + totalLoad * 0.35;
    } else {
      delete unit.__维持负荷;
      delete unit.__维持反应惩罚;
      delete unit.__维持前摇系数;
    }
    return totalLoad;
  }

  function clearC2FoodMaintenanceRuntime(unit = {}) {
    if (!unit || typeof unit !== 'object') return false;
    const effectKey = 'c2:坚挺金苍蝇:武魂真身维持';
    const effects = unit.持续效果 && typeof unit.持续效果 === 'object' && !Array.isArray(unit.持续效果)
      ? unit.持续效果
      : {};
    const effectEntries = Object.entries(effects).filter(([key, effect]) =>
      key === effectKey || effect?.effect_type === 'c2_food_maintain',
    );
    effectEntries.forEach(([key]) => { delete unit.持续效果[key]; });
    if (unit.状态效果 && typeof unit.状态效果 === 'object') delete unit.状态效果['坚挺金苍蝇·武魂真身维持'];
    if (unit.属性?.状态效果 && typeof unit.属性.状态效果 === 'object') delete unit.属性.状态效果['坚挺金苍蝇·武魂真身维持'];
    refreshSustainRuntimeLoad(unit);
    return effectEntries.length > 0;
  }

  function setHp(unit, hp) {
    const next = clamp(hp, 0, readHpMax(unit));
    if ('hp' in unit || !('HP' in unit)) unit.hp = next;
    if ('HP' in unit) unit.HP = next;
    if (unit.属性 && typeof unit.属性 === 'object') {
      if ('HP' in unit.属性) unit.属性.HP = next;
      else if ('生命' in unit.属性) unit.属性.生命 = next;
      else if ('体力' in unit.属性 && !('hp' in unit)) unit.属性.体力 = next;
    }
    if (next <= 0 && unit.状态 && typeof unit.状态 === 'object') unit.状态.存活 = false;
    if (next <= 0) clearC2FoodMaintenanceRuntime(unit);
  }

  function setResource(unit, resource, value) {
    const next = clamp(value, 0, readResourceMax(unit, resource));
    const mapping = /精神/.test(resource) ? ['men', '精神力'] : /体力/.test(resource) ? ['vit', '体力'] : ['sp', '魂力'];
    if (mapping[0] in unit || !(mapping[1] in unit)) unit[mapping[0]] = next;
    if (/体力/.test(resource) && 'sta' in unit) unit.sta = next;
    if (unit.属性 && typeof unit.属性 === 'object') unit.属性[mapping[1]] = next;
    if (/体力/.test(resource)) refreshStaminaAdjustedFinal(unit);
  }

  function setResourceValue(unit, resource, value) {
    if (/生命|HP/i.test(resource)) setHp(unit, value);
    else setResource(unit, resource, value);
  }

  function resourceLockRules(effect = {}) {
    if (String(effect?.原型 || '').trim() !== '资源锁定') return [];
    const lockType = String(effect?.锁定类型 || '').trim();
    if (!['资源池锁定', '回复锁定', '转化锁定'].includes(lockType)) return [];
    return [{
      资源: normalizedResourceKeys(effect?.资源 || '魂力').map(resourceLabel),
      锁定类型: lockType,
      比例: clamp(Math.abs(parseSignedValue(effect?.数值, 1)), 0, 1),
    }];
  }

  function deriveStateCombatEffect(effect = {}) {
    const state = String(effect?.状态 || effect?.状态名称 || '').trim();
    const prototype = String(effect?.原型 || '').trim();
    const combatEffect = cloneValue(effect?.计算层效果 || effect?.战斗效果 || {});
    const parsedValue = parseSignedValue(effect?.数值, 1);
    const signedValue = clamp(parsedValue, -1, 1);
    const magnitude = Math.abs(signedValue);
    const secondaryMagnitude = Math.abs(parseSignedValue(effect?.副数值, 0));
    const limitedElements = normalizedElementTokens(effect?.限定元素);
    const limitedResource = String(effect?.限定资源 || effect?.资源 || '').trim();
    if (prototype === '判定修正' && magnitude > 0) {
      const check = String(effect?.判定 || '').trim();
      const mapping = check === '命中'
        ? ['hit_bonus', 'hit_penalty']
        : check === '闪避'
          ? ['dodge_bonus', 'dodge_penalty']
          : check === '反应'
            ? ['reaction_bonus', 'reaction_penalty']
            : null;
      if (mapping) {
        const key = signedValue >= 0 ? mapping[0] : mapping[1];
        combatEffect[key] = Math.max(Number(combatEffect[key] || 0), magnitude);
      }
    }
    if (prototype === '结算修正' && magnitude > 0) {
      const settlement = String(effect?.结算 || '').trim();
      if (settlement === '造成伤害') {
        if (limitedElements.length) {
          combatEffect.damage_bonus_limited = [
            ...(Array.isArray(combatEffect.damage_bonus_limited) ? combatEffect.damage_bonus_limited : []),
            { 限定元素: cloneValue(limitedElements), 数值: signedValue },
          ];
        } else if (signedValue >= 0) {
          combatEffect.damage_bonus = Math.max(Number(combatEffect.damage_bonus || 0), magnitude);
        } else {
          combatEffect.final_damage_mult = Math.max(0, Number(combatEffect.final_damage_mult || 1) * (1 - magnitude));
        }
      } else if (settlement === '受到伤害') {
        if (limitedElements.length) {
          combatEffect.damage_reduction_limited = [
            ...(Array.isArray(combatEffect.damage_reduction_limited) ? combatEffect.damage_reduction_limited : []),
            { 限定元素: cloneValue(limitedElements), 数值: -signedValue },
          ];
        } else {
          combatEffect.received_damage_mult = Math.max(0, Number(combatEffect.received_damage_mult || 1) * (1 + signedValue));
        }
      } else if (settlement === '防御剥夺' || settlement === '防御穿透') {
        if (signedValue >= 0) combatEffect.armor_pen = Math.max(Number(combatEffect.armor_pen || 0), magnitude);
      } else if (settlement === '治疗') {
        if (signedValue >= 0) combatEffect.final_heal_mult = Math.max(Number(combatEffect.final_heal_mult || 1), 1 + magnitude);
        else combatEffect.final_heal_mult = Math.min(Number(combatEffect.final_heal_mult || 1), Math.max(0, 1 - magnitude));
      } else if (['资源恢复', '恢复资源', '资源回复'].includes(settlement)) {
        if (parsedValue >= 0) {
          combatEffect.final_heal_limited = [
            ...(Array.isArray(combatEffect.final_heal_limited) ? combatEffect.final_heal_limited : []),
            { 资源: limitedResource || '生命', 数值: parsedValue },
          ];
        }
      } else if (settlement === '技能效果') {
        combatEffect.skill_effect_mult = clamp(1 + signedValue, 0, 4);
      } else if (settlement === '消耗') {
        combatEffect.cost_ratio = clamp(1 + signedValue, 0, 4);
      } else if (settlement === '前摇' || settlement === '蓄力') {
        combatEffect.windup_ratio = clamp(1 + signedValue, 0, 4);
        const correctedKey = signedValue <= 0
          ? 'cast_speed_bonus'
          : 'cast_speed_penalty';
        combatEffect[correctedKey] = Math.max(
          Number(combatEffect[correctedKey] || 0),
          magnitude,
        );
      } else if (settlement === '反伤') {
        combatEffect.counter_attack_ratio = Math.max(Number(combatEffect.counter_attack_ratio || 0), magnitude);
      }
    }
    if (prototype === '资源锁定') {
      combatEffect.resource_lock = true;
      combatEffect.locked_resource = String(effect?.资源 || '魂力').trim() || '魂力';
      combatEffect.locked_ratio = magnitude;
      combatEffect.locked_type = String(effect?.锁定类型 || '').trim();
    }
    if (prototype === '位移执行') {
      const positionType = String(effect?.位移类型 || '').trim();
      const distanceFactor = clamp(Math.max(0, Number(effect?.距离 || 0)) / 100, 0.05, 0.25);
      combatEffect.position_type = positionType;
      combatEffect.position_object = String(effect?.位移对象 || '').trim();
      combatEffect.position_distance = Math.max(0, Number(effect?.距离 || 0));
      combatEffect.position_projection = '命中、闪避、索敌、反应和姿态窗口';
      if (/拉近|突进|追击/.test(positionType)) {
        combatEffect.hit_bonus = Math.max(Number(combatEffect.hit_bonus || 0), distanceFactor);
        combatEffect.reaction_bonus = Math.max(Number(combatEffect.reaction_bonus || 0), distanceFactor * 0.5);
      } else if (/击退|击飞/.test(positionType)) {
        combatEffect.hit_penalty = Math.max(Number(combatEffect.hit_penalty || 0), distanceFactor);
        combatEffect.reaction_penalty = Math.max(Number(combatEffect.reaction_penalty || 0), distanceFactor * 0.5);
      } else if (/脱离|瞬移|换位/.test(positionType)) {
        combatEffect.dodge_bonus = Math.max(Number(combatEffect.dodge_bonus || 0), distanceFactor);
        combatEffect.reaction_bonus = Math.max(Number(combatEffect.reaction_bonus || 0), distanceFactor * 0.5);
      }
    }
    if (prototype === '决策干扰') {
      const interference = String(effect?.干扰 || '').trim();
      const interferenceMagnitude = Math.abs(parseSignedValue(effect?.数值 || '-15%', 1)) || 0.15;
      combatEffect.hit_penalty = Math.max(
        Number(combatEffect.hit_penalty || 0),
        interferenceMagnitude * (/索敌/.test(interference) ? 1 : 0.5),
      );
      combatEffect.reaction_penalty = Math.max(
        Number(combatEffect.reaction_penalty || 0),
        interferenceMagnitude * (/判断/.test(interference) ? 1 : 0.5),
      );
      combatEffect.random_target_rate = Math.max(
        Number(combatEffect.random_target_rate || 0),
        /索敌/.test(interference) ? interferenceMagnitude : 0,
      );
    }
    if (/中毒|流血|灼烧|冻伤|持续创伤/.test(state)) {
      combatEffect.dot_damage_ratio = Math.max(Number(combatEffect.dot_damage_ratio || 0), magnitude);
    }
    if (/暗冰侵蚀/.test(state)) {
      const resource = Array.isArray(effect?.资源) ? effect.资源[0] : effect?.资源;
      const resourceText = String(resource || '').trim();
      const resourceKey = { 体力: 'vit', 魂力: 'sp', 精神力: 'men' }[resourceText];
      if (resourceKey) {
        combatEffect.resource_tick_resource = resourceText;
        if (/%$/.test(String(effect?.数值 ?? '').trim()) || magnitude <= 1) combatEffect.resource_tick_ratio = signedValue;
        else combatEffect.resource_tick_amount = parseSignedValue(effect?.数值, 0);
      }
    }
    if (/持续恢复|再生|愈合|生命恢复/.test(state)) {
      combatEffect.hot_heal_ratio = Math.max(Number(combatEffect.hot_heal_ratio || 0), magnitude);
    }
    if (state === '护卫') {
      combatEffect.damage_reduction = Math.max(
        Number(combatEffect.damage_reduction || 0),
        magnitude || 0.1,
      );
    }
    if (/禁疗/.test(state)) {
      combatEffect.heal_reduction = Math.max(Number(combatEffect.heal_reduction || 0), magnitude);
    }
    if (/异常抗性/.test(state) || effect?.异常抗性 !== undefined) {
      combatEffect.abnormal_resistance = Math.max(
        Number(combatEffect.abnormal_resistance || 0),
        Math.min(1, Math.max(0, Number(effect?.异常抗性 ?? magnitude))),
      );
    }
    if (/无视异常|免疫异常/.test(state)) combatEffect.无视异常 = true;
    if (/隐匿|隐身|潜行/.test(state)) combatEffect.stealth_level = Math.max(Number(combatEffect.stealth_level || 0), magnitude || 1);
    if (/探查屏蔽/.test(state)) combatEffect.探查屏蔽 = true;
    if (/探查反制|破隐|看破/.test(state)) {
      combatEffect.探查反制 = true;
      combatEffect.sense_pierce = true;
    }
    if (prototype === '规则防御' && String(effect?.规则 || effect?.防御对象 || '').trim() === '免伤') {
      combatEffect.block_count = Math.max(1, Number(effect?.次数 || 1));
    }
    if (['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞'].includes(state)) {
      combatEffect.skip_turn = true;
      combatEffect.cannot_act = true;
      combatEffect.cannot_react = true;
    }
    if (/僵直/.test(state)) {
      combatEffect.cannot_react = true;
      combatEffect.reaction_penalty = Math.max(Number(combatEffect.reaction_penalty || 0), magnitude || 0.25);
      combatEffect.cast_speed_penalty = Math.max(Number(combatEffect.cast_speed_penalty || 0), 0.35);
    }
    if (/迟缓|减速/.test(state)) {
      delete combatEffect.skip_turn;
      delete combatEffect.cannot_act;
      delete combatEffect.cannot_react;
      delete combatEffect.lock_level;
      combatEffect.cast_speed_penalty = Math.max(
        Number(combatEffect.cast_speed_penalty || 0),
        magnitude || secondaryMagnitude || 0.15,
      );
      combatEffect.reaction_penalty = Math.max(
        Number(combatEffect.reaction_penalty || 0),
        secondaryMagnitude || magnitude || 0.15,
      );
      combatEffect.dodge_penalty = Math.max(
        Number(combatEffect.dodge_penalty || 0),
        magnitude || secondaryMagnitude || 0.15,
      );
    }
    if (/定身|束缚|禁锢/.test(state)) {
      combatEffect.dodge_penalty = Math.max(Number(combatEffect.dodge_penalty || 0), magnitude || 0.2);
    }
    if (/沉默|封技/.test(state)) combatEffect.silence = true;
    if (/缴械/.test(state)) combatEffect.disarm = true;
    if (/致盲/.test(state)) {
      combatEffect.blind = true;
      // 致盲是无可填强度的固定状态；设计台正式说明为攻击命中下降35%。
      combatEffect.hit_penalty = Math.max(Number(combatEffect.hit_penalty || 0), 0.35);
    }
    return combatEffect;
  }

  function stateApplicationProbabilityMultiplier(unit = {}, effect = {}) {
    if (String(effect?.原型 || '').trim() !== '状态施加') return 1;
    if (statePolarity(effect) >= 0) return 1;
    const resistance = stateEntries(unit, 'CONDITION').reduce((maximum, [, entry]) => Math.max(
      maximum,
      Math.min(1, Math.max(0, Number(entry?.战斗效果?.abnormal_resistance || 0))),
    ), 0);
    return Math.max(0, 1 - resistance);
  }

  function effectStateName(effect = {}) {
    const explicit = String(effect?.状态 || effect?.状态名称 || '').trim();
    if (explicit) return explicit;
    const prototype = String(effect?.原型 || '').trim();
    if (prototype === '属性修正') {
      const attributes = (Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性]).map(value => String(value || '').trim()).filter(Boolean);
      return `${attributes.join('、') || '属性'}修正`;
    }
    const element = (Array.isArray(effect?.限定元素)
      ? effect.限定元素
      : [effect?.限定元素]
    ).map(value => String(value || '').trim()).filter(Boolean).join('、');
    const elementSuffix = element ? `(${element})` : '';
    if (prototype === '判定修正') {
      return `${String(effect?.判定 || '判定').trim() || '判定'}${elementSuffix}判定修正`;
    }
    if (prototype === '结算修正') {
      return `${String(effect?.结算 || '结算').trim() || '结算'}${elementSuffix}结算修正`;
    }
    return String(effect?.判定 || prototype).trim();
  }

  function normalizedElementTokens(value) {
    const source = Array.isArray(value) ? value : [value];
    return [...new Set(source.flatMap(entry =>
      String(entry || '')
        .split(/[、,，/|+\s]+/)
        .map(token => token.trim())
        .filter(Boolean)
      ))];
  }

  function readActionDurationTicks(input = {}, declaration = {}) {
    const value = Number(input?.durationTicks ?? declaration?.durationTicks ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : 0;
  }

  function isMaintenanceAction(input = {}, declaration = {}) {
    return input?.maintenance === true ||
      declaration?.维持 === true ||
      declaration?.阶段 === '维持' ||
      declaration?.actionKind === 'MAINTAIN_SKILL';
  }

  function hasPositiveEnvironmentCost(costs = {}, resource = '') {
    const value = costs?.[resource];
    if (value === undefined || value === null || value === '') return false;
    const numeric = Number(String(value).replace(/%$/, ''));
    return Number.isFinite(numeric) && numeric > 1e-9;
  }

  function normalizeEnvironmentHazard(entry = {}, index = 0) {
    if (!isPlainRecord(entry)) return null;
    const effectiveLevel = Number(entry.对应等级);
    const power = Number(entry.威力);
    const damageType = String(entry.伤害类型 || '').trim();
    const sourceTag = String(entry.来源标签 || '').trim();
    const intervalTicks = Number(entry.间隔tick);
    const penetration = Number(entry.穿透 ?? 0);
    const segments = Number(entry.攻击段数 ?? 1);
    if (!(effectiveLevel > 0) || !(power > 0) || !damageType || !sourceTag || !(intervalTicks > 0) ||
      !Number.isFinite(penetration) || penetration < 0 || !Number.isFinite(segments) || segments < 1) return null;
    const targetIds = Array.isArray(entry.目标ID)
      ? entry.目标ID.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    return Object.freeze({
      id: `${sourceTag}:${index}`,
      effectiveLevel,
      power,
      damageType,
      element: Object.freeze(normalizedElementTokens(entry.元素)),
      sourceTag,
      intervalTicks,
      penetration,
      segments: Math.floor(segments),
      targetScope: String(entry.目标范围 || '').trim().toUpperCase(),
      targetIds: Object.freeze(targetIds),
      ...(entry.命中概率 === undefined ? {} : { hitProbability: normalizeEffectProbability(entry.命中概率, 1) }),
      displayName: String(entry.名称 || '').trim(),
    });
  }

  function isWorldActionContext(value) {
    return isPlainRecord(value) &&
      ['era', 'time', 'location', 'terrain', 'hazards', 'facilities', 'nearbyFacilities', 'resources', 'market', 'permissions', 'modifiers', 'blockers', 'warnings']
        .every(key => Object.prototype.hasOwnProperty.call(value, key)) &&
      Array.isArray(value.hazards) &&
      isPlainRecord(value.modifiers) &&
      Array.isArray(value.blockers) &&
      Array.isArray(value.warnings);
  }

  function normalizeWorldRuleIds(value) {
    return [...new Set((Array.isArray(value) ? value : [])
      .map(item => String(item || '').trim())
      .filter(Boolean))].sort();
  }

  function worldActionContextLocationValues(context = {}) {
    const location = isPlainRecord(context?.location) ? context.location : {};
    return [...new Set(['current', 'target', 'active'].flatMap(key => {
      const view = isPlainRecord(location[key]) ? location[key] : {};
      return [view.name, Array.isArray(view.path) ? view.path.join('-') : '']
        .map(value => String(value || '').trim())
        .filter(Boolean);
    }))];
  }

  function worldActionContextMatchesSnapshot(worldSnapshot = {}, context = {}) {
    if (!isWorldActionContext(context) || !worldSnapshot || typeof worldSnapshot !== 'object') return false;
    const battleLocation = String(worldSnapshot?.环境?.地点 || '').trim();
    if (!battleLocation || !worldActionContextLocationValues(context).includes(battleLocation)) return false;
    const battleRuleIds = normalizeWorldRuleIds(worldSnapshot?.环境?.临时规则ID);
    const contextRuleIds = normalizeWorldRuleIds(context?.modifiers?.战斗?.临时规则ID);
    return JSON.stringify(battleRuleIds) === JSON.stringify(contextRuleIds);
  }

  function bindWorldActionContext(worldSnapshot, context) {
    if (!worldSnapshot || typeof worldSnapshot !== 'object' || !worldActionContextMatchesSnapshot(worldSnapshot, context)) {
      throw new Error('battle_world_action_context_mismatch');
    }
    worldActionContextBindings.set(worldSnapshot, context);
    activeWorldActionContextBinding = { worldSnapshot, context };
    return context;
  }

  function clearWorldActionContext(worldSnapshot) {
    if (worldSnapshot && typeof worldSnapshot === 'object') worldActionContextBindings.delete(worldSnapshot);
    if (!worldSnapshot || activeWorldActionContextBinding?.worldSnapshot === worldSnapshot) {
      activeWorldActionContextBinding = null;
    }
  }

  function resolveEnvironmentContext(input = {}) {
    const explicitContext = input?.worldActionContext;
    if (explicitContext !== undefined) {
      return worldActionContextMatchesSnapshot(input?.worldSnapshot, explicitContext)
        ? explicitContext
        : null;
    }
    const boundContext = input?.worldSnapshot && typeof input.worldSnapshot === 'object'
      ? worldActionContextBindings.get(input.worldSnapshot)
      : null;
    if (boundContext && worldActionContextMatchesSnapshot(input.worldSnapshot, boundContext)) return boundContext;
    if (activeWorldActionContextBinding?.context && worldActionContextMatchesSnapshot(input?.worldSnapshot, activeWorldActionContextBinding.context)) {
      return activeWorldActionContextBinding.context;
    }
    const resolver = root.__LWCS_LIBRARY_DATA_RUNTIME_V1__?.resolveWorldActionContext;
    const dataRoot = isPlainRecord(input?.dataRoot) ? input.dataRoot : null;
    const actor = input?.actor || findUnit(input?.worldSnapshot || {}, input?.actorId || input?.declaration?.actorId) || {};
    const characterKey = String(input?.characterKey || input?.activeName || actor?.name || actor?.名称 || '').trim();
    const actionType = String(input?.actionType || input?.declaration?.actionKind || '').trim();
    const snapshotLocation = String(input?.worldSnapshot?.环境?.地点 || '').trim();
    const targetLocation = String(input?.targetLocation ?? (snapshotLocation && snapshotLocation !== '正常' ? snapshotLocation : actor?.状态?.位置 ?? '') ?? '').trim();
    const durationTicks = Number(input?.durationTicks ?? 0);
    const temporaryRuleIds = Array.isArray(input?.temporaryRuleIds) ? input.temporaryRuleIds : (Array.isArray(input?.worldSnapshot?.环境?.临时规则ID) ? input.worldSnapshot.环境.临时规则ID : []);
    if (typeof resolver !== 'function' || !dataRoot || !characterKey || !Number.isFinite(durationTicks)) return null;
    let resolved;
    try {
      resolved = resolver({
        dataRoot,
        characterKey,
        actionType,
        targetLocation,
        durationTicks: Math.max(0, Math.round(durationTicks * 10) / 10),
        temporaryRuleIds,
      });
    } catch (error) {
      return null;
    }
    return isWorldActionContext(resolved) && worldActionContextMatchesSnapshot(input?.worldSnapshot, resolved) ? resolved : null;
  }

  function readCallableElements(unit = {}) {
    return normalizedElementTokens([
      ...(Array.isArray(unit?.第1武魂?.可调用元素) ? unit.第1武魂.可调用元素 : []),
      ...(Array.isArray(unit?.第2武魂?.可调用元素) ? unit.第2武魂.可调用元素 : []),
    ]);
  }

  function readEffectiveUnitLevel(unit = {}) {
    const level = Number(unit?.属性?.等级 ?? unit?.等级 ?? unit?.final?.等级 ?? 0);
    return Number.isFinite(level) && level > 0 ? level : 1;
  }

  function sameElementAdaptation(hazard = {}, defender = {}) {
    const hazardElements = normalizedElementTokens(hazard?.element);
    const callableElements = new Set(readCallableElements(defender));
    const sameElement = hazardElements.length > 0 && hazardElements.some(element => callableElements.has(element));
    if (!sameElement) return Object.freeze({ sameElement: false, reduction: 0, multiplier: 1 });
    const ratio = clamp(readEffectiveUnitLevel(defender) / Math.max(1, Number(hazard?.effectiveLevel || 1)), 0, 1);
    const reduction = clamp(0.2 * ratio * ratio, 0, 0.2);
    return Object.freeze({ sameElement: true, reduction, multiplier: 1 - reduction });
  }

  function environmentTargetUnits(worldSnapshot = {}, actor = {}, hazard = {}) {
    const explicitIds = Array.isArray(hazard?.targetIds) ? hazard.targetIds : [];
    if (explicitIds.length) return explicitIds.map(id => findUnit(worldSnapshot, id)).filter(Boolean);
    const units = listUnits(worldSnapshot).map(entry => entry.unit);
    const actorSide = sideOf(worldSnapshot, actor);
    const scope = String(hazard?.targetScope || 'ACTOR').trim().toUpperCase();
    if (scope === 'ALL') return units;
    if (scope === 'ALLY') return units.filter(unit => sideOf(worldSnapshot, unit) === actorSide);
    if (scope === 'ENEMY') return units.filter(unit => sideOf(worldSnapshot, unit) !== actorSide);
    return actor ? [actor] : [];
  }

  function actionRequiresMovement(declaration = {}) {
    return ['MOVE', 'TRAVEL', 'WITHDRAW', '移动', '旅行', '撤离'].includes(String(declaration?.actionKind || '').trim().toUpperCase());
  }

  function actionRequiresDeployment(declaration = {}, type = '') {
    const actionKind = String(declaration?.actionKind || '').trim().toUpperCase();
    const field = type === 'vehicle'
      ? ['requiresVehicleDeployment', 'vehicleDeployment', '需要载具展开']
      : type === 'summon'
        ? ['requiresSummonDeployment', 'summonDeployment', '需要召唤物展开']
        : ['requiresDeployment', 'deployment', '需要展开'];
    if (field.some(key => declaration?.[key] === true || declaration?.skill?.[key] === true)) return true;
    if (type === 'vehicle') return ['DEPLOY_VEHICLE', 'USE_VEHICLE', '载具展开'].includes(actionKind);
    if (type === 'summon') return ['SUMMON', '召唤'].includes(actionKind) ||
      (Array.isArray(declaration?.skill?._效果数组) && declaration.skill._效果数组.some(effect => String(effect?.原型 || '').trim() === '召唤生成'));
    if (Array.isArray(declaration?.skill?._效果数组) && declaration.skill._效果数组.some(effect => ['召唤生成', '位移执行'].includes(String(effect?.原型 || '').trim()))) return true;
    return ['DEPLOY', '展开'].includes(actionKind);
  }

  function createEnvironmentBlockError(environment = {}) {
    const error = new Error(environment?.blockReasons?.[0] || '环境限制：当前行动无法进行');
    error.code = 'BATTLE_ENVIRONMENT_BLOCKED';
    error.environment = environment;
    return error;
  }

  function assessWorldAction(input = {}) {
    const declaration = input?.declaration && typeof input.declaration === 'object' ? input.declaration : {};
    const actor = input?.actor || findUnit(input?.worldSnapshot || {}, input?.actorId || declaration?.actorId) || {};
    const actionKind = String(declaration?.actionKind || input?.actionKind || '').trim();
    const durationTicks = readActionDurationTicks(input, declaration);
    const resolved = resolveEnvironmentContext({
      ...input,
      declaration,
      actorId: unitId(actor) || input?.actorId,
      durationTicks,
    });
    const costStages = input?.costStages && typeof input.costStages === 'object'
      ? input.costStages
      : declaration?.skill && typeof declaration.skill === 'object'
        ? readSkillCostStages(declaration.skill, declaration)
        : { 启动: {}, 维持: {}, 形式: 'absolute' };
    const startupCosts = normalizeSkillCostMap(
      input?.startupCosts ?? declaration?.resourceCosts ?? costStages.启动 ?? {},
      costStages.形式 === 'percentage' ? 'percentage' : 'absolute',
    ).values;
    const sustainCosts = normalizeSkillCostMap(
      input?.sustainCosts ?? costStages.维持 ?? {},
      costStages.形式 === 'percentage' ? 'percentage' : 'absolute',
    ).values;
    const maintenance = isMaintenanceAction(input, declaration);
    const blockReasons = [];
    const displayEffects = [];
    const addUnique = (list, value) => {
      const text = String(value || '').trim();
      if (text && !list.includes(text)) list.push(text);
    };
    const movement = { blocked: false, multiplier: 1 };
    const vision = { hitAdjustment: 0 };
    const deployment = { spaceBlocked: false, vehicleBlocked: false, summonBlocked: false };
    let actionAvailability = 1;
    const relevantMovement = actionRequiresMovement(declaration);
    const relevantSpace = actionRequiresDeployment(declaration);
    const relevantVehicle = actionRequiresDeployment(declaration, 'vehicle');
    const relevantSummon = actionRequiresDeployment(declaration, 'summon');
    const battleModifiers = isPlainRecord(resolved?.modifiers?.战斗) ? resolved.modifiers.战斗 : {};
    const environmentRules = isPlainRecord(battleModifiers.环境规则) ? battleModifiers.环境规则 : {};
    const environmentRuleEntries = [
      environmentRules,
      ...Object.values(environmentRules).filter(isPlainRecord),
    ];
    environmentRuleEntries.forEach(rule => {
      const actionAvailabilityValue = Number(rule.行动可行性);
      const movementMultiplier = Number(rule.移动倍率);
      const visionAdjustment = Number(rule.视野修正);
      if (Number.isFinite(actionAvailabilityValue)) actionAvailability *= clamp(actionAvailabilityValue, 0, 1);
      if (Number.isFinite(movementMultiplier)) {
        movement.multiplier *= clamp(movementMultiplier, 0, 1);
        if (movementMultiplier < 1) addUnique(displayEffects, '移动受到环境影响');
      }
      if (Number.isFinite(visionAdjustment)) {
        vision.hitAdjustment += visionAdjustment;
        if (visionAdjustment < 0) addUnique(displayEffects, '视野受到环境影响');
      }
      if (rule.展开空间可用 === false && relevantSpace) {
        deployment.spaceBlocked = true;
        addUnique(displayEffects, '当前空间不足以展开');
      }
      if (rule.载具可展开 === false && relevantVehicle) {
        deployment.vehicleBlocked = true;
        addUnique(displayEffects, '当前环境无法展开载具');
      }
      if (rule.召唤物可展开 === false && relevantSummon) {
        deployment.summonBlocked = true;
        addUnique(displayEffects, '当前环境无法展开召唤物');
      }
    });
    const activeCosts = maintenance ? sustainCosts : startupCosts;
    const rawSoulPowerDisabled = environmentRules.魂力可用 === false ||
      environmentRules.魂力动作 === '禁止';
    const actorEnvironmentProtection = environmentProtectionForTarget(
      input?.worldSnapshot || {},
      actor,
      resolved,
      environmentRules.防护来源标签,
    );
    const soulPowerDisabled = rawSoulPowerDisabled && !actorEnvironmentProtection.sourceMatched;
    if (soulPowerDisabled && hasPositiveEnvironmentCost(activeCosts, '魂力')) {
      addUnique(blockReasons, maintenance
        ? '环境限制：当前环境无法维持含魂力消耗的技能'
        : '环境限制：当前环境无法使用含魂力消耗的技能');
    }
    (resolved?.blockers || []).forEach(reason => {
      const text = String(reason || '').trim();
      if (!text) return;
      if (text === '当前环境禁止调用魂力') {
        if (soulPowerDisabled && hasPositiveEnvironmentCost(activeCosts, '魂力')) {
          addUnique(blockReasons, maintenance
            ? '环境限制：当前环境无法维持含魂力消耗的技能'
            : '环境限制：当前环境无法使用含魂力消耗的技能');
        }
        return;
      }
      addUnique(blockReasons, text);
    });
    if (movement.blocked) addUnique(blockReasons, '环境限制：当前环境无法移动');
    if (deployment.spaceBlocked) addUnique(blockReasons, '环境限制：当前空间不足以展开');
    if (deployment.vehicleBlocked) addUnique(blockReasons, '环境限制：当前环境无法展开载具');
    if (deployment.summonBlocked) addUnique(blockReasons, '环境限制：当前环境无法展开召唤物');
    actionAvailability = clamp(actionAvailability, 0, 1);
    if (actionAvailability <= 1e-9) addUnique(blockReasons, '环境限制：当前行动无法进行');
    if (actionAvailability < 1 - 1e-9 && !displayEffects.length) addUnique(displayEffects, '行动效率受到环境影响');
    const cacheKey = stableHash({
      status: resolved ? 'resolved' : 'unavailable',
      hazards: Object.freeze(Array.isArray(resolved?.hazards) ? resolved.hazards : []),
      modifiers: isPlainRecord(resolved?.modifiers) ? resolved.modifiers : Object.freeze({}),
      blockers: Object.freeze(Array.isArray(resolved?.blockers) ? resolved.blockers : []),
      actionKind,
      actorId: unitId(actor),
      durationTicks,
      maintenance,
      startupCosts,
      sustainCosts,
    });
    return Object.freeze({
      schemaVersion: WORLD_ACTION_ASSESSMENT_SCHEMA,
      status: resolved ? 'resolved' : 'unavailable',
      hazards: Object.freeze(Array.isArray(resolved?.hazards) ? resolved.hazards : []),
      modifiers: isPlainRecord(resolved?.modifiers) ? resolved.modifiers : Object.freeze({}),
      blockers: Object.freeze(Array.isArray(resolved?.blockers) ? resolved.blockers : []),
      blocked: blockReasons.length > 0,
      blockReasons: Object.freeze(blockReasons),
      displayEffects: Object.freeze(displayEffects),
      vision: Object.freeze({ hitAdjustment: clamp(vision.hitAdjustment, -0.95, 0.95) }),
      movement: Object.freeze({ blocked: movement.blocked, multiplier: clamp(movement.multiplier, 0, 1) }),
      deployment: Object.freeze(deployment),
      actionAvailability,
      maintenanceStopped: maintenance && blockReasons.some(reason => reason.includes('无法维持')),
      durationTicks,
      cacheKey,
    });
  }

  function skillMatchesLimitedElements(skill = {}, limitation = '') {
    const required = normalizedElementTokens(limitation);
    if (!required.length) return true;
    const attachedValues = [];
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      attachedValues.push(
        value?.附带属性,
        value?.属性,
        value?.元素,
        value?.伤害类型,
        value?.类型,
        value?.限定元素,
      );
      [value?._效果数组, value?.效果数组, value?.效果, value?.技能, value?.__技能]
        .forEach(child => {
          if (Array.isArray(child)) child.forEach(visit);
          else visit(child);
        });
    };
    visit(skill);
    const attached = new Set(normalizedElementTokens(attachedValues));
    if (!attached.size) return false;
    const expanded = new Set();
    required.forEach(token => {
      if (token === '元素类') {
        ['水', '火', '风', '土', '光', '暗']
          .forEach(element => expanded.add(element));
      } else if (token === '五行类') {
        ['金', '木', '水', '火', '土']
          .forEach(element => expanded.add(element));
      } else {
        expanded.add(token);
      }
    });
    return [...expanded].some(element => attached.has(element) ||
      [...attached].some(token => token.includes(element) || element.includes(token)));
  }

  function scaledSkillNumber(value, multiplier) {
    const text = String(value ?? '').trim();
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return value;
    const scaled = Number((numeric * multiplier).toFixed(6));
    if (typeof value === 'number') return scaled;
    const sign = text.startsWith('+') && scaled >= 0 ? '+' : '';
    return `${sign}${scaled}${text.includes('%') ? '%' : ''}`;
  }

  function scaleSkillEffectTree(value, multiplier) {
    if (Array.isArray(value)) {
      return value.map(entry => scaleSkillEffectTree(entry, multiplier));
    }
    if (!value || typeof value !== 'object') return value;
    const next = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        scaleSkillEffectTree(child, multiplier),
      ]),
    );
    if (!String(value?.原型 || '').trim()) return next;
    [
      '威力倍率',
      '每回合伤害',
      '持续伤害',
      '护盾值',
      '恢复量',
      '治疗量',
      '伤害量',
      '引爆倍率',
      '数值',
      '副数值',
    ].forEach(key => {
      if (value[key] !== undefined) {
        next[key] = scaledSkillNumber(value[key], multiplier);
      }
    });
    return next;
  }

  function scaleSkillCosts(value, multiplier) {
    if (typeof value === 'string') {
      return value.replace(
        /(魂力|精神力|体力)\s*([:：])\s*([+-]?\d+(?:\.\d+)?)(%?)/g,
        (match, resource, separator, numeric, percent) =>
          `${resource}${separator}${Math.max(
            0,
            Number((Number(numeric) * multiplier).toFixed(6)),
          )}${percent}`,
      );
    }
    if (Array.isArray(value)) {
      return value.map(entry => scaleSkillCosts(entry, multiplier));
    }
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        ['魂力', '精神力', '体力', 'sp', 'men', 'vit'].includes(key) &&
          Number.isFinite(Number(child))
          ? Math.max(
              0,
              Number((Number(child) * multiplier).toFixed(6)),
            )
          : scaleSkillCosts(child, multiplier),
      ]),
    );
  }

  function applySkillSettlementModifiers(unit = {}, skill = {}, options = {}) {
    const modifiers = stateEntries(unit)
      .filter(([, state]) =>
        state &&
        typeof state === 'object' &&
        Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 1)) > 0 &&
        (String(state?.原型 || '').trim() === '结算修正' || Number(state?.战斗效果?.cost_delta_ratio || 0) > 0) &&
        skillMatchesLimitedElements(skill, state?.限定元素)
      );
    let skillEffectMultiplier = 1;
    let costMultiplier = 1;
    let costSurcharge = 0;
    let surchargeSource = null;
    let surchargeTied = false;
    let windupMultiplier = 1;
    const modifierAttribution = [];
    modifiers.forEach(([stateKey, state]) => {
      const surcharge = Number(state?.战斗效果?.cost_delta_ratio || 0);
      if (surcharge > costSurcharge) {
        costSurcharge = surcharge;
        surchargeSource = [stateKey,state];
        surchargeTied = false;
      } else if (surcharge > 0 && surcharge === costSurcharge) surchargeTied = true;
      const settlement = String(state?.结算 || '').trim();
      const effectKey = settlement === '技能效果'
        ? 'skill_effect_mult'
        : settlement === '消耗'
          ? 'cost_ratio'
          : 'windup_ratio';
      const storedMultiplier = Number(state?.战斗效果?.[effectKey]);
      const multiplier = clamp(
        Number.isFinite(storedMultiplier)
          ? storedMultiplier
          : 1 + parseSignedValue(state?.数值, 1),
        0,
        4,
      );
      if (settlement === '技能效果') {
        skillEffectMultiplier *= multiplier;
      } else if (settlement === '消耗') {
        costMultiplier *= multiplier;
      } else if (settlement === '前摇' || settlement === '蓄力') {
        windupMultiplier *= multiplier;
      }
      if (Math.abs(multiplier - 1) > 1e-12 && ['技能效果', '消耗', '前摇', '蓄力'].includes(settlement)) {
        const source = stateModifierSource(unit, stateKey, state, 'ACTOR', [
          settlement === '技能效果'
            ? 'SKILL_EFFECT_SETTLEMENT'
            : settlement === '消耗'
              ? 'SKILL_COST_SETTLEMENT'
              : 'SKILL_WINDUP_SETTLEMENT',
        ]);
        modifierAttribution.push(Object.freeze({
          applicationId: source.applicationId,
          sourceActionId: source.sourceActionId,
          sourceEffectId: source.sourceEffectId,
          ownerId: source.ownerId,
          ownerRole: source.ownerRole,
          stateName: source.stateName,
          axes: source.axes,
          settlement,
          multiplier,
          linked: !!source.applicationId,
        }));
      }
    });
    if (costSurcharge > 0) {
      costMultiplier *= 1 + costSurcharge;
      const source = surchargeTied
        ? { applicationId:'',sourceActionId:'',sourceEffectId:'',ownerId:unitId(unit),ownerRole:'ACTOR',stateName:'',axes:['SKILL_COST_SETTLEMENT'] }
        : stateModifierSource(unit,surchargeSource[0],surchargeSource[1],'ACTOR',['SKILL_COST_SETTLEMENT']);
      modifierAttribution.push(Object.freeze({...source,settlement:'消耗',multiplier:1+costSurcharge,linked:!surchargeTied&&!!source.applicationId}));
    }
    if (
      Math.abs(skillEffectMultiplier - 1) <= 1e-12 &&
      Math.abs(costMultiplier - 1) <= 1e-12 &&
      Math.abs(windupMultiplier - 1) <= 1e-12
    ) {
      return Object.freeze({
        skill,
        skillEffectMultiplier: 1,
        costMultiplier: 1,
        windupMultiplier: 1,
        sourceCount: 0,
        modifierAttribution: Object.freeze([]),
      });
    }
    if (options?.attributionOnly === true) {
      return Object.freeze({
        skill,
        skillEffectMultiplier,
        costMultiplier,
        windupMultiplier,
        sourceCount: modifiers.length,
        modifierAttribution: Object.freeze(modifierAttribution),
      });
    }
    const effectiveSkill = cloneValue(skill);
    if (
      Math.abs(skillEffectMultiplier - 1) > 1e-12 &&
      Array.isArray(effectiveSkill?._效果数组)
    ) {
      effectiveSkill._效果数组 = scaleSkillEffectTree(
        effectiveSkill._效果数组,
        skillEffectMultiplier,
      );
    }
    if (
      Math.abs(costMultiplier - 1) > 1e-12 &&
      effectiveSkill?.消耗 !== undefined
    ) {
      effectiveSkill.消耗 = scaleSkillCosts(
        effectiveSkill.消耗,
        costMultiplier,
      );
    }
    [
      ['魂力消耗', costMultiplier],
      ['精神力消耗', costMultiplier],
      ['体力消耗', costMultiplier],
      ['前摇', windupMultiplier],
      ['cast_time', windupMultiplier],
    ].forEach(([key, multiplier]) => {
      if (
        effectiveSkill[key] !== undefined &&
        Number.isFinite(Number(effectiveSkill[key]))
      ) {
        effectiveSkill[key] = Math.max(
          0,
          Number(
            (Number(effectiveSkill[key]) * multiplier).toFixed(6),
          ),
        );
      }
    });
    return Object.freeze({
      skill: effectiveSkill,
      skillEffectMultiplier,
      costMultiplier,
      windupMultiplier,
      sourceCount: modifiers.length,
      modifierAttribution: Object.freeze(modifierAttribution),
    });
  }

  function healingStateMultiplier(state = {}, resource = '生命') {
    if (Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 1)) <= 0) return 1;
    const settlement = String(state?.结算 || '').trim();
    const effects = state?.战斗效果 || {};
    const receivedHealingMultiplier = Math.max(
      0,
      1 - clamp(Number(effects.heal_reduction || 0), 0, 1),
    );
    if (settlement === '治疗') {
      return receivedHealingMultiplier * Math.max(0, Number(effects.final_heal_mult ?? 1));
    }
    if (['资源恢复', '恢复资源', '资源回复'].includes(settlement)) {
      const limited = Array.isArray(effects.final_heal_limited) ? effects.final_heal_limited : [];
      return receivedHealingMultiplier * limited
        .filter(entry => !entry?.资源 || String(entry.资源).trim() === String(resource || '').trim())
        .reduce((value, entry) => value * Math.max(0, 1 + Number(entry?.数值 || 0)), 1);
    }
    return receivedHealingMultiplier;
  }

  function healingMultiplierForUnit(unit = {}, resource = '生命') {
    return stateEntries(unit, 'COLLECTION').reduce(
      (multiplier, [, state]) => multiplier * healingStateMultiplier(state, resource),
      1,
    );
  }

  function healingMultiplierDetails(unit = {}, resource = '生命') {
    const entries = collectStateEntries(unit);
    const multiplier = entries.reduce(
      (value, [, state]) => value * healingStateMultiplier(state, resource),
      1,
    );
    const groups = new Map();
    entries.forEach(([stateKey, state]) => {
      const stateMultiplier = healingStateMultiplier(state, resource);
      if (Math.abs(stateMultiplier - 1) <= 1e-9) return;
      const source = stateModifierSource(
        unit,
        stateKey,
        state,
        'TARGET',
        [String(resource || '').trim() === '生命' ? 'HEALING_RECEIVED' : `RESOURCE_RECOVERY:${resource}`],
      );
      const existing = groups.get(source.sourceKey);
      if (existing) existing.stateKeys.add(String(stateKey || '').trim());
      else groups.set(source.sourceKey, { ...source, stateKeys: new Set([String(stateKey || '').trim()]) });
    });
    const modifierAttribution = Object.freeze([...groups.values()].map(source => {
      const multiplierWithout = entries.reduce((value, [stateKey, state]) => {
        const stateSourceKey = stateModifierSource(unit, stateKey, state).sourceKey;
        return stateSourceKey === source.sourceKey
          ? value
          : value * healingStateMultiplier(state, resource);
      }, 1);
      return Object.freeze({
        applicationId: source.applicationId,
        sourceActionId: source.sourceActionId,
        sourceEffectId: source.sourceEffectId,
        ownerId: source.ownerId,
        ownerRole: source.ownerRole,
        stateName: source.stateName,
        axes: source.axes,
        multiplierWithout,
        multiplierDelta: multiplier - multiplierWithout,
        linked: !!source.applicationId,
      });
    }));
    return Object.freeze({ multiplier, modifierAttribution });
  }

  function findStateEntry(unit = {}, effect = {}) {
    const wanted = effectStateName(effect);
    return stateEntries(unit).find(([, state]) => stateName(state) === wanted) || null;
  }

  function addState(unit, effect, effectId, onReplace = null) {
    const stateName = effectStateName(effect);
    const polarity = statePolarity(effect);
    if (!stateName) return false;
    if (
      Number(effect?.__previewApplicationProbability ?? 1) <= 1e-12
    ) return false;
    unit.状态效果 = unit.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : {};
    const existingEntry = findStateEntry(unit, effect);
    const stackable = effect?.可叠加 === true || /叠加|层数/.test(String(effect?.叠加规则 || effect?.层数规则 || ''));
    const requestedDuration = Math.max(1, Number(effect?.持续回合 || 1));
    const lockRules = resourceLockRules(effect);
    if (existingEntry && !stackable && String(effect?.原型 || '').trim() !== '状态施加') {
      const [key, existing] = existingEntry;
      const existingDuration = Math.max(0, Number(existing?.duration ?? existing?.持续回合 ?? 0));
      const refreshable = effect?.刷新 === true || effect?.可刷新 === true || requestedDuration > existingDuration;
      if (!refreshable) return false;
      if (String(effect?.原型 || '').trim() === '属性修正') {
        unit.状态效果[key] = { ...existing, duration: Math.max(existingDuration, requestedDuration) };
        return true;
      }
      unit.状态效果[key] = {
        ...existing,
        duration: Math.max(existingDuration, requestedDuration),
        来源角色: String(effect?.来源角色 || existing?.来源角色 || '').trim(),
        数值: effect?.数值 ?? existing?.数值,
        强度: effect?.强度 ?? existing?.强度,
        ...(effect?.对应等级 !== undefined ? { 对应等级: Number(effect.对应等级) } : {}),
        ...(effect?.吸收来源 !== undefined ? { 吸收来源: String(effect.吸收来源 || '').trim() } : {}),
        ...(effect?.吸收资源 !== undefined ? { 吸收资源: String(effect.吸收资源 || '').trim() } : {}),
        ...(effect?.转化效果 !== undefined ? { 转化效果: String(effect.转化效果 || '').trim() } : {}),
        ...(effect?.增幅上限 !== undefined ? { 增幅上限: String(effect.增幅上限 || '').trim() } : {}),
        ...(effect?.限定探查者 !== undefined ? { 限定探查者: String(effect.限定探查者 || '').trim() } : {}),
        ...(effect?.限定来源 !== undefined ? { 限定来源: cloneValue(effect.限定来源) } : {}),
        ...(effect?.资源 !== undefined ? { 资源: cloneValue(effect.资源) } : {}),
        ...(lockRules.length ? { 锁定类型: lockRules[0].锁定类型, 资源锁定规则: lockRules } : {}),
        ...(effect?.触发消耗 !== undefined ? { 触发消耗: cloneValue(effect.触发消耗) } : {}),
        战斗效果: { ...(existing?.战斗效果 || {}), ...deriveStateCombatEffect(effect) },
      };
      return true;
    }
    const nextState = {
      状态: stateName,
      状态名称: stateName,
      类型: polarity < 0 ? 'debuff' : polarity > 0 ? 'buff' : '',
      原型: String(effect?.原型 || '').trim(),
      ...(String(effect?.原型 || '').trim() === '状态施加' ? { 层数: 1 } : {}),
      来源角色: String(effect?.来源角色 || '').trim(),
      判定: String(effect?.判定 || '').trim(),
      结算: String(effect?.结算 || '').trim(),
      限定元素: cloneValue(effect?.限定元素 ?? ''),
      duration: requestedDuration,
      持续回合: requestedDuration,
      数值: effect?.数值 ?? '',
      强度: effect?.强度 ?? '',
      ...(effect?.对应等级 !== undefined ? { 对应等级: Number(effect.对应等级) } : {}),
      ...(effect?.吸收来源 !== undefined ? { 吸收来源: String(effect.吸收来源 || '').trim() } : {}),
      ...(effect?.吸收资源 !== undefined ? { 吸收资源: String(effect.吸收资源 || '').trim() } : {}),
      ...(effect?.转化效果 !== undefined ? { 转化效果: String(effect.转化效果 || '').trim() } : {}),
      ...(effect?.增幅上限 !== undefined ? { 增幅上限: String(effect.增幅上限 || '').trim() } : {}),
      ...(effect?.限定探查者 !== undefined ? { 限定探查者: String(effect.限定探查者 || '').trim() } : {}),
      ...(effect?.限定来源 !== undefined ? { 限定来源: cloneValue(effect.限定来源) } : {}),
      ...(effect?.资源 !== undefined ? { 资源: cloneValue(effect.资源) } : {}),
      ...(lockRules.length ? { 锁定类型: lockRules[0].锁定类型, 资源锁定规则: lockRules } : {}),
      ...(effect?.触发消耗 !== undefined ? { 触发消耗: cloneValue(effect.触发消耗) } : {}),
      __previewApplicationProbability: clamp(Number(effect?.__previewApplicationProbability ?? 1), 0, 1),
      战斗效果: deriveStateCombatEffect(effect),
      面板修改比例: cloneValue(effect?.面板修改比例 || {}),
      面板固定修正: cloneValue(effect?.面板固定修正 || {}),
    };
    if (existingEntry && String(effect?.原型 || '').trim() === '状态施加') {
      const merged = root.__LWCS_BATTLE_RUNTIME__.mergeRuntimeCondition(existingEntry[1], nextState, effect);
      if (!merged.applied) return false;
      unit.状态效果[existingEntry[0]] = merged.state;
      if (merged.mergeKind === 'REPLACE') onReplace?.(existingEntry[0], existingEntry[1]);
    } else unit.状态效果[`preview:${effectId}:${stateName}`] = nextState;
    return true;
  }

  function collectStateEntries(unit = {}) {
    const states = unit?.状态效果 && typeof unit.状态效果 === 'object'
      ? unit.状态效果
      : unit?.属性?.状态效果;
    return Array.isArray(states)
      ? states.map((state, index) => [String(index), state]).filter(([, state]) => state && typeof state === 'object')
      : states && typeof states === 'object'
        ? Object.entries(states).filter(([, state]) => state && typeof state === 'object')
        : [];
  }

  function stateDependencyProjection(entries = [], scope = 'COLLECTION') {
    const normalizedScope = String(scope || 'COLLECTION').trim().toUpperCase();
    if (normalizedScope === 'COLLECTION' || normalizedScope === 'FULL') {
      return entries;
    }
    const hasMechanicalValue = value => {
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'number') return Math.abs(value) > 1e-12;
      if (typeof value === 'boolean') return value;
      return true;
    };
    const pick = (key, state, fields) => {
      const effects = state?.战斗效果 ||
        state?.计算层效果 ||
        state?.battleEffects ||
        {};
      return [
        key,
        String(state?.状态 || state?.状态名称 || '').trim(),
        Number(state?.__previewApplicationProbability ?? 1),
        ...fields.map(field => [field, effects?.[field] ?? null]),
      ];
    };
    if (normalizedScope.startsWith('STAT:')) {
      const statKey = normalizedScope.slice('STAT:'.length);
      return entries
        .filter(([, state]) =>
          hasMechanicalValue(state?.面板修改比例?.[statKey]) &&
          Number(state?.面板修改比例?.[statKey] ?? 1) !== 1 ||
          hasMechanicalValue(state?.面板固定修正?.[statKey]) &&
          Number(state?.面板固定修正?.[statKey] ?? 0) !== 0
        )
        .map(([key, state]) => [
        key,
        String(state?.状态 || state?.状态名称 || '').trim(),
        Number(state?.__previewApplicationProbability ?? 1),
        state?.面板修改比例?.[statKey] ?? null,
        state?.面板固定修正?.[statKey] ?? null,
        ]);
    }
    const fieldsByScope = {
      ACTION_ORDER: [
        'cast_speed_bonus',
        'cast_speed_penalty',
        'skip_turn',
        'cannot_act',
      ],
      OUTGOING_DAMAGE: [
        'damage_bonus',
        'final_damage_bonus',
        'final_damage_mult',
        'armor_pen',
      ],
      INCOMING_DAMAGE: [
        'received_damage_mult',
        'damage_taken_mult',
        'damage_reduction',
        'death_save_count',
        'revive_count',
        'revive_heal_ratio',
      ],
      OUTGOING_HIT: [
        'hit_bonus',
        'hit_penalty',
      ],
      INCOMING_HIT: [
        'dodge_bonus',
        'dodge_penalty',
        'lock_level',
      ],
      WITHDRAWAL: [
        'dodge_bonus',
        'dodge_penalty',
        'reaction_bonus',
        'reaction_penalty',
        'cannot_react',
        'skip_turn',
      ],
      SCHEDULE: [
        'dot_damage',
        'dot_damage_ratio',
        'hot_heal_ratio',
      ],
    };
    const fields = fieldsByScope[normalizedScope];
    if (fields) {
      return entries
        .filter(([, state]) => {
          const effects = state?.战斗效果 ||
            state?.计算层效果 ||
            state?.battleEffects ||
            {};
          return fields.some(field => hasMechanicalValue(effects?.[field]));
        })
        .map(([key, state]) => pick(key, state, fields));
    }
    if (normalizedScope === 'CONDITION') {
      return entries.map(([key, state]) => [
        key,
        String(state?.状态 || state?.状态名称 || '').trim(),
        String(state?.类型 || state?.正负面 || state?.性质 || '').trim(),
      ]);
    }
    if (normalizedScope === 'SUPPRESSION') {
      return entries
        .filter(([, state]) =>
          Array.isArray(state?.抹消规则) &&
          state.抹消规则.length > 0
        )
        .map(([key, state]) => [
          key,
          String(state?.状态 || state?.状态名称 || '').trim(),
          cloneValue(state.抹消规则),
        ]);
    }
    if (normalizedScope === 'GRANTED_EFFECTS') {
      return entries
        .filter(([, state]) =>
          /下次行动|下次魂技成功释放/.test(String(state?.授予触发条件 || state?.触发条件 || '').trim()) &&
          Array.isArray(state?.授予效果) &&
          state.授予效果.length > 0 &&
          Math.max(0, Math.floor(Number(state?.可用次数 ?? 1) || 0)) > 0
        )
        .map(([key, state]) => [
          key,
          String(state?.授予触发条件 || '').trim(),
          Math.max(0, Math.floor(Number(state?.可用次数 ?? 1) || 0)),
          cloneValue(state.授予效果),
        ]);
    }
    return entries;
  }

  function stateEntries(unit = {}, scope = 'COLLECTION') {
    const entries = collectStateEntries(unit);
    const normalizedScope = String(scope || 'COLLECTION').trim().toUpperCase();
    if (activePreviewDependencyCapture) {
      const dependencyScope =
        normalizedScope === 'COLLECTION' ? 'collection' : normalizedScope;
      recordPreviewDependency(
        `unit:${unitId(unit)}:state:__${dependencyScope}`,
        stateDependencyProjection(entries, normalizedScope),
      );
      if (normalizedScope === 'COLLECTION' || normalizedScope === 'FULL') {
        entries.forEach(([key, state]) => {
          const dependencyKey = String(
            state?.状态 || state?.状态名称 || key
          ).trim() || String(key);
          recordPreviewDependency(
            `unit:${unitId(unit)}:state:${dependencyKey}`,
            state,
          );
        });
      }
    }
    return entries;
  }

  function dependencyValueForKey(worldSnapshot = {}, key = '') {
    const dependencyKey = String(key || '').trim();
    const unitMatch = dependencyKey.match(
      /^unit:(.+):(hp|baseMaxHp|resource:[^:]+|resourceMax:[^:]+|stat:[^:]+|state:.+)$/,
    );
    if (unitMatch) {
      const unit = findUnit(worldSnapshot, unitMatch[1]);
      if (!unit) return null;
      const kind = unitMatch[2];
      if (kind === 'hp') return readHp(unit);
      if (kind === 'baseMaxHp') return readHpMax(unit);
      if (kind.startsWith('resource:')) {
        return readResource(unit, kind.slice('resource:'.length));
      }
      if (kind.startsWith('resourceMax:')) {
        return readResourceMax(unit, kind.slice('resourceMax:'.length));
      }
      if (kind.startsWith('stat:')) {
        return readCombatStat(unit, kind.slice('stat:'.length));
      }
      const stateKey = kind.slice('state:'.length);
      if (stateKey === '__action') {
        const directStamina = Number(unit?.vit);
        const stamina = Number.isFinite(directStamina)
          ? directStamina
          : readResource(unit, '体力');
        return {
          alive: !isDead(unit),
          stamina,
          incapacityReason: readIncapacityReason(unit),
          capable: isBattleCapable(unit),
        };
      }
      if (stateKey.startsWith('__')) {
        const scope = stateKey.slice('__'.length) || 'COLLECTION';
        return stateDependencyProjection(
          collectStateEntries(unit),
          scope,
        );
      }
      return collectStateEntries(unit).find(([entryKey, state]) =>
        String(state?.状态 || state?.状态名称 || entryKey).trim() === stateKey
      )?.[1] || null;
    }
    const defenseMatch = dependencyKey.match(/^target:(.+):defense$/);
    if (defenseMatch) {
      const unit = findUnit(worldSnapshot, defenseMatch[1]);
      return unit ? defenseDependencyValue(unit) : null;
    }
    const ruleMatch = dependencyKey.match(/^rule:(.+)$/);
    if (ruleMatch) {
      return cloneValue(
        worldSnapshot?.规则?.[ruleMatch[1]] ??
        worldSnapshot?.battleRules?.[ruleMatch[1]] ??
        null,
      );
    }
    return undefined;
  }

  function stateName(state = {}) {
    return String(state?.状态 || state?.状态名称 || state?.名称 || '').trim();
  }

  function stateIsDamageOverTime(state = {}) {
    const combatEffect = state?.战斗效果 || state?.计算层效果 || {};
    return /中毒|流血|灼烧|冻伤|持续创伤/.test(stateName(state)) ||
      Number(combatEffect?.dot_damage || state?.dot_damage || 0) > 0 ||
      Number(combatEffect?.dot_damage_ratio || state?.dot_damage_ratio || 0) > 0;
  }

  function timeWindowStateSelectors(effect = {}) {
    return [...new Set(
      (Array.isArray(effect?.条件分支) ? effect.条件分支 : [])
        .flatMap(branch => Array.isArray(branch?.条件) ? branch.条件 : [])
        .filter(condition => String(condition?.类型 || '').trim() === '状态存在')
        .map(condition => String(condition?.状态 || condition?.值 || '').trim())
        .filter(Boolean),
    )];
  }

  function timeWindowStateMatches(effect = {}, stateKey = '', state = {}) {
    const selectors = timeWindowStateSelectors(effect);
    if (!selectors.length) return true;
    return selectors.some(selector => {
      if (selector === '任意状态') return true;
      if (selector === '任意持续伤害') return stateIsDamageOverTime(state);
      if (selector === '任意负面') return statePolarity(state) < 0;
      if (selector === '任意正面') return statePolarity(state) > 0;
      return [stateKey, stateName(state)].some(value =>
        normalizeConditionToken(value) === normalizeConditionToken(selector)
      );
    });
  }

  function periodicStateMarginal(unit, existing, effect, combatEffect) {
    const periodic = effects => Number(effects?.dot_damage) > 0 || Number(effects?.dot_damage_ratio) > 0 || Number(effects?.hot_heal_ratio) > 0;
    if (!periodic(existing?.战斗效果) && !periodic(combatEffect)) return null;
    const runtime = root.__LWCS_BATTLE_RUNTIME__;
    const next = { 状态: String(effect?.状态 || '').trim(), 层数: 1,
      duration: Math.max(1, Number(effect?.持续回合 || 1)), __本回合新附加: true,
      战斗效果: combatEffect, 面板修改比例: effect?.面板修改比例 || {}, 面板固定修正: effect?.面板固定修正 || {} };
    const merged = runtime.mergeRuntimeCondition(existing, next, effect);
    if (!merged.applied) return null;
    const states = [existing, merged.state].map(state => state ? cloneValue(state) : null);
    const units = [cloneValue(unit), cloneValue(unit)];
    const horizon = Math.max(...states.map(state => state
      ? Math.max(0, Number(state.duration ?? state.持续回合 ?? 0)) + Number(state.__本回合新附加 === true) : 0));
    const tickDeltas = [];
    let realizedDamage = 0, realizedHealing = 0;
    for (let offset = 0; offset < horizon; offset += 1) {
      const totals = states.map((state, index) => {
        const total = { damage: 0, healing: 0 };
        if (!state || !(Number(state.duration ?? state.持续回合) > 0)) return total;
        if (state.__本回合新附加 === true) { delete state.__本回合新附加; return total; }
        runtime.settlePeriodicHpValues(units[index], state, next.状态, ({ kind, actual, blocked }) => {
          if (blocked) return;
          if (kind === 'hot') total.healing += Number(actual || 0);
          else total.damage += Number(actual || 0);
        });
        state.duration = Number(state.duration ?? state.持续回合) - 1;
        return total;
      });
      const damage = totals[1].damage - totals[0].damage;
      const healing = totals[1].healing - totals[0].healing;
      realizedDamage += damage;
      realizedHealing += healing;
      tickDeltas.push(healing - damage);
    }
    return { realizedDamage, realizedHealing, tickDeltas, tickCount: horizon,
      damagePerTick: realizedDamage / Math.max(1, horizon), healingPerTick: realizedHealing / Math.max(1, horizon),
      mergeKind: merged.mergeKind };
  }

  function stateScheduledHpDelta(unit = {}, state = {}, durationOverride = null) {
    const combatEffect = state?.战斗效果 || state?.计算层效果 || {};
    const duration = durationOverride === null
      ? Math.max(0, Number(state?.duration ?? state?.持续回合 ?? 0))
      : Math.max(0, Number(durationOverride || 0));
    const damagePerTick = Math.max(
      0,
      Number(combatEffect?.dot_damage || state?.dot_damage || 0) +
      readHpMax(unit) * Math.max(
        0,
        Number(combatEffect?.dot_damage_ratio || state?.dot_damage_ratio || 0),
      ),
    );
    const healingPerTick = readHpMax(unit) *
      Math.max(0, Number(combatEffect?.hot_heal_ratio || state?.hot_heal_ratio || 0));
    // 两侧必须各自按生命上限裁剪，口径与状态施加主路径（见本文件 4142-4151）一致。
    // 未裁剪时 duration * damagePerTick 可以任意倍于剩余生命——damagePerTick 本身含
    // readHpMax(unit) * dot_damage_ratio，再乘持续回合即可远超目标剩余生命，
    // 而本函数的结果直通 SCHEDULED_HP_DELTA 与 healthTrajectoryByTarget 主路径，
    // 是预演伤害相对运行时严重高估的来源。
    const currentHp = readHp(unit);
    const totalDamage = Math.min(currentHp, damagePerTick * duration);
    const totalHealing = Math.min(
      Math.max(0, readHpMax(unit) - currentHp),
      healingPerTick * duration,
    );
    return totalHealing - totalDamage;
  }

  function statePolarity(state = {}) {
    const type = String(state?.类型 || state?.正负面 || state?.性质 || '').trim().toLowerCase();
    if (type === 'debuff' || /负|减益|异常|控制/.test(type) || state?.debuff === true) return -1;
    if (type === 'buff' || /正|增益|强化/.test(type) || state?.buff === true) return 1;
    const prototype = String(state?.原型 || '').trim();
    const value = parseSignedValue(state?.数值, 1);
    if (prototype === '属性修正') return Math.sign(value);
    if (prototype === '判定修正' || prototype === '结算修正') {
      const judge = prototype === '判定修正' ? root.__LWCS_SKILL_COST_HELPERS_V1__?.判定修正是否增益语义_V1 : root.__LWCS_SKILL_COST_HELPERS_V1__?.结算修正是否增益语义_V1;
      if (typeof judge !== 'function') throw new Error('battle_preview_skill_semantic_helpers_missing');
      return value ? (judge(state) ? 1 : -1) : 0;
    }
    const name = stateName(state);
    const semantics = root.__LWCS_SKILL_COST_HELPERS_V1__;
    if (semantics.读取状态施加分类_V1(name)) return semantics.状态施加是否负面语义_V1(name) ? -1 : 1;
    if (/中毒|流血|灼烧|冻伤|暗冰侵蚀|眩晕|麻痹|僵直|定身|冻结|星光停滞|沉默|封技|禁疗|迟缓|减速|致盲|混乱|嘲讽|精神紊乱|标记|束缚|禁锢|缴械|虚弱/.test(name)) return -1;
    if (/护盾|恢复|治疗|增幅|强化|免疫|无视异常|霸体|加速|隐匿|隐身/.test(name)) return 1;
    return 0;
  }

  function isNegativeState(state = {}) {
    return statePolarity(state) < 0;
  }

  function replaceStates(unit, entries) {
    const hadShield = Object.values(unit.状态效果 || {}).some(state => Number(state?.shield_value || 0) > 0);
    let shield = 0;
    unit.状态效果 = Object.fromEntries(entries.map(([key, state]) => {
      shield += Math.max(0, Number(state?.shield_value || 0));
      return [key, cloneValue(state)];
    }));
    if (hadShield || shield > 0) for (const key of ['shield', '护盾', '护盾值']) if (key in unit) unit[key] = shield;
  }

  function matchingStates(unit, selector = '任意状态') {
    const wanted = String(selector || '任意状态').trim();
    return stateEntries(unit).filter(([, state]) => {
      if (!wanted || wanted === '任意状态') return true;
      if (wanted === '任意负面') return statePolarity(state) < 0;
      if (wanted === '任意增益') return statePolarity(state) > 0;
      return stateName(state) === wanted;
    });
  }

  function conditionMatchesFilter(key = '', condition = {}, effect = {}) {
    if (String(key).startsWith('__auto__:')) return false;
    const selector = String(effect.状态 ?? effect.selector ?? '').trim();
    if (selector === '任意负面' && statePolarity(condition) >= 0 || selector === '任意增益' && statePolarity(condition) <= 0) return false;
    if (selector && !['任意状态', '任意负面', '任意增益'].includes(selector) && key !== selector && stateName(condition) !== selector) return false;
    const prototype = String(effect.匹配原型 || '').trim(), effects = condition.战斗效果 || {};
    if (!prototype || prototype === '无') return true;
    if (prototype === '护盾变化') return Number(condition.shield_value || 0) > 0 || Number(effects.shield_gain_bonus || 0) > 0;
    if (prototype !== '资源变化' || effect.资源 !== '生命') return false;
    const explicit = condition.原型 === '资源变化' && (Array.isArray(condition.资源) ? condition.资源.includes('生命') : condition.资源 === '生命')
      ? parseSignedValue(condition.数值, 1) : 0;
    const periodic = effects.resource_tick_resource === '生命'
      ? Number(effects.resource_tick_ratio || 0) < 0 || Number(effects.resource_tick_amount || 0) < 0 ? -1
        : Number(effects.resource_tick_ratio || 0) > 0 || Number(effects.resource_tick_amount || 0) > 0 ? 1 : 0 : 0;
    const damage = Number(effects.dot_damage || condition.dot_damage || 0) > 0 || Number(effects.dot_damage_ratio || condition.dot_damage_ratio || condition.计算层效果?.dot_damage_ratio || 0) > 0 || explicit < 0 || periodic < 0;
    const healing = Number(effects.hot_heal_ratio || 0) > 0 || explicit > 0 || periodic > 0;
    return effect.数值方向 === '负向' ? damage : effect.数值方向 === '正向' ? healing : damage || healing;
  }

  function removeProjectedStates(unit, removal, worldTick = 0) {
    const matches = stateEntries(unit).filter(([key, state]) => key !== removal.excludeKey && conditionMatchesFilter(key, state, removal));
    const limit = Math.max(0, Number(removal.limit || matches.length));
    const removed = matches.slice(0, limit || matches.length);
    if (!removed.length) return removed;
    const keys = new Set(removed.map(([key]) => key));
    replaceStates(unit, stateEntries(unit).filter(([key]) => !keys.has(key)));
    unit.final = { ...unit.final, ...buildNumericCombatStats(unit, worldTick) };
    return removed;
  }

  function stateEndRisks(state, key) {
    return normalizeSideEffectList(state?.副作用列表 || []).filter(effect =>
      effect.触发时机 === '效果结束后' && (!effect.关联状态 || effect.关联状态 === key));
  }

  function projectStateEndRisks(target, removed, potential, overlay, ledger, context, applicationProbability) {
    if (context.settleStateEndRisks === false) return;
    const profiles = new Map();
    for (const [key, state] of [...potential, ...removed]) for (const [riskIndex, risk] of stateEndRisks(state, key).entries()) {
      const signature = `${riskIndex}|${stableHash(risk)}`, identity = `${key}|${signature}`;
      if (!profiles.has(identity)) profiles.set(identity, { stateKey: key, signature, risk, probability: Number(risk.触发概率),
        rootId: `${context.effectInstanceId}:state-end:${unitId(target)}:${profiles.size}` });
    }
    if (!profiles.size) return;
    const parentIndex = ledger.entries.length - 1, parent = ledger.entries[parentIndex];
    ledger.entries[parentIndex] = Object.freeze({ ...parent, evidence: Object.freeze({ ...parent.evidence, endRiskProfiles: [...profiles.values()] }) });
    for (const [key, state] of removed) for (const [riskIndex, risk] of stateEndRisks(state, key).entries()) {
      const profile = profiles.get(`${key}|${riskIndex}|${stableHash(risk)}`), start = ledger.entries.length;
      applyImmediateSideEffects({ actionKind: 'RELEASE_SKILL', targetIds: [unitId(target)], skill: {
        魂技名: state.来源技能 || state.状态 || key,
        副作用列表: [{ ...risk, 关联状态: undefined, 触发时机: '效果生效后', 生效对象: '技能释放者' }],
      } }, [], overlay.readUnit(unitId(target)), overlay, ledger, profile.rootId, {
        ...context,
        applicationProbabilityResolver: args => {
          if (args.effectInstanceId !== `${profile.rootId}:side-effect:0`) return context.applicationProbabilityResolver?.(args) ?? args.baseApplicationProbability;
          const resolved = context.applicationProbabilityResolver?.(args);
          profile.probability = forcedApplicationProbability(context, args.effectInstanceId, args.targetId) ??
            (Number.isFinite(Number(resolved)) ? clamp(Number(resolved), 0, 1) : args.baseApplicationProbability);
          return profile.probability * applicationProbability;
        },
      });
      for (let index = start; index < ledger.entries.length; index++) {
        const entry = ledger.entries[index];
        for (const nested of entry.evidence?.endRiskProfiles || []) profiles.set(`${nested.stateKey}|${nested.signature}`, nested);
        ledger.entries[index] = Object.freeze({ ...entry, rootCauseId: context.rootActionId, sourceActionId: context.rootActionId,
          evidence: Object.freeze({ ...entry.evidence, stateEndRisk: true }) });
      }
    }
    const settledParent = ledger.entries[parentIndex];
    ledger.entries[parentIndex] = Object.freeze({ ...settledParent, evidence: Object.freeze({ ...settledParent.evidence, endRiskProfiles: [...profiles.values()] }) });
  }

  function applyProjectedEndRiskOutcomes(unit, removed, profiles, assignments) {
    if (!profiles?.length) return;
    for (const [key, state] of removed) for (const [riskIndex, risk] of stateEndRisks(state, key).entries()) {
      const signature = `${riskIndex}|${stableHash(risk)}`, profile = profiles.find(row => row.stateKey === key && row.signature === signature);
      if (profile && (profile.groupKey ? assignments[profile.groupKey] === 'SUCCESS' : profile.probability >= 1 - 1e-12)) {
        root.__LWCS_BATTLE_RUNTIME__.applyRoundEndSideEffect(unit, risk, key, {},
          (endedKey, ended) => applyProjectedEndRiskOutcomes(unit, [[endedKey, ended]], profiles, assignments));
      }
    }
  }

  function effectMatchesMechanismMatcher(effect = {}, matcher = {}) {
    const normalizedMatcher = matcher && typeof matcher === 'object' && !Array.isArray(matcher)
      ? matcher
      : { 原型: String(matcher || '').trim() };
    const expectedPrototype = String(normalizedMatcher?.原型 || '').trim();
    const statePrototype = String(effect?.状态 || effect?.状态名称 || '').trim().split(':')[0];
    const actualPrototype = String(
      effect?.来源原型摘要 ||
      effect?.原型 ||
      statePrototype ||
      '',
    ).trim();
    const expectedStateNames = (Array.isArray(normalizedMatcher?.状态)
      ? normalizedMatcher.状态
      : String(normalizedMatcher?.状态 ?? '').split(/[、,，|/]/))
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const publicStateMatch = expectedPrototype === '状态施加' &&
      expectedStateNames.length > 0 &&
      expectedStateNames.includes(String(effect?.状态 || effect?.状态名称 || '').trim());
    if (expectedPrototype && !['全部', '抹消全部', '全部原型'].includes(expectedPrototype) &&
      expectedPrototype !== actualPrototype && !publicStateMatch) return false;
    return Object.entries(normalizedMatcher).every(([field, rawExpected]) => {
      if (field === '原型') return true;
      const expected = (Array.isArray(rawExpected) ? rawExpected : String(rawExpected ?? '').split(/[、,，|/]/))
        .map(value => String(value || '').trim())
        .filter(Boolean);
      if (!expected.length || expected.some(value => /^全部/.test(value) || value === '抹消全部')) return true;
      const actual = Array.isArray(effect?.[field])
        ? effect[field].map(value => String(value || '').trim())
        : [String(effect?.[field] ?? '').trim()];
      return expected.some(value => actual.includes(value));
    });
  }

  function applyMechanismSuppression(unit = {}, matcher = {}, duration = 1, stateKey = '机制抹消') {
    const normalizedMatcher = matcher && typeof matcher === 'object' && !Array.isArray(matcher)
      ? cloneValue(matcher)
      : { 原型: String(matcher || '').trim() };
    const removedKeys = stateEntries(unit)
      .filter(([, state]) => effectMatchesMechanismMatcher(state, normalizedMatcher))
      .map(([key]) => key);
    if (removedKeys.length) {
      replaceStates(unit, stateEntries(unit).filter(([key]) => !removedKeys.includes(key)));
    }
    unit.状态效果 ||= {};
    const suppressionRule = { 抹消对象: normalizedMatcher, 抹消方式: '持续阻断' };
    const nextDuration = Math.max(1, Number(duration || 1));
    const existingEntry = stateEntries(unit).find(([, existing]) =>
      stateName(existing) === '机制抹消'
    );
    const nextState = {
      状态: '机制抹消',
      状态名称: '机制抹消',
      类型: 'debuff',
      duration: nextDuration,
      来源原型摘要: '机制抹消',
      抹消规则: [suppressionRule],
      战斗效果: {},
      面板修改比例: {},
      面板固定修正: {},
    };
    let suppressionAdded = true;
    if (existingEntry) {
      const [existingKey, existing] = existingEntry;
      const existingRules = Array.isArray(existing?.抹消规则) ? existing.抹消规则 : [];
      const suppressionRuleKey = JSON.stringify(suppressionRule);
      const duplicateRule = existingRules.some(rule => JSON.stringify(rule) === suppressionRuleKey);
      const existingDuration = Math.max(0, Number(existing?.duration ?? existing?.持续回合 ?? 0));
      suppressionAdded = !duplicateRule || nextDuration > existingDuration;
      unit.状态效果[existingKey] = {
        ...existing,
        ...nextState,
        duration: Math.max(existingDuration, nextDuration),
        抹消规则: duplicateRule ? existingRules : [...existingRules, suppressionRule],
      };
    } else {
      unit.状态效果[String(stateKey || '机制抹消').trim() || '机制抹消'] = nextState;
    }
    return Object.freeze({
      removedKeys: Object.freeze([...removedKeys]),
      suppressionAdded,
      matcher: normalizedMatcher,
      duration: nextDuration,
    });
  }

  function actorSuppressesEffect(actor = {}, effect = {}) {
    return stateEntries(actor, 'SUPPRESSION').some(([, state]) =>
      (Array.isArray(state?.抹消规则) ? state.抹消规则 : []).some(rule =>
        effectMatchesMechanismMatcher(effect, rule?.抹消对象)
      )
    );
  }

  function effectSourceRestrictions(effect = {}) {
    const raw = effect?.限定来源;
    const values = Array.isArray(raw) ? raw : [raw];
    return [...new Set(values
      .map(value => String(value ?? '').trim())
      .filter(Boolean))];
  }

  function isFormalEnvironmentProtectionEffect(effect = {}) {
    const prototype = String(effect?.原型 || effect?.来源原型摘要 || '').trim();
    if (prototype === '状态施加') {
      return ['无视异常', '环境免疫'].includes(String(effect?.状态 || effect?.状态名称 || '').trim());
    }
    if (prototype === '规则防御') {
      return String(effect?.规则 || effect?.防御对象 || '').trim() === '免伤';
    }
    if (prototype === '结算修正' && String(effect?.结算 || '').trim() === '受到伤害') {
      const value = typeof effect?.数值 === 'number'
        ? effect.数值
        : Number.parseFloat(String(effect?.数值 ?? '').replace(/,/g, ''));
      return Number.isFinite(value) && value < 0;
    }
    return false;
  }

  function environmentProtectionForTarget(worldSnapshot = {}, target = {}, environmentContext = null, sourceTag = '') {
    const environmentRules = environmentContext?.modifiers?.战斗?.环境规则;
    const protectionSourceTags = effectSourceRestrictions({ 限定来源: environmentRules?.防护来源标签 });
    const hazardSourceTag = String(sourceTag || '').trim();
    if (protectionSourceTags.length && hazardSourceTag && !protectionSourceTags.includes(hazardSourceTag)) {
      return Object.freeze({ immune: false, multiplier: 1, sourceMatched: false });
    }
    const candidates = [];
    const append = effect => {
      if (!effect || typeof effect !== 'object' || !isFormalEnvironmentProtectionEffect(effect)) return;
      const restrictions = effectSourceRestrictions(effect);
      const expectedSourceTags = hazardSourceTag ? [hazardSourceTag] : protectionSourceTags;
      if (!expectedSourceTags.length || !restrictions.some(sourceTagValue => expectedSourceTags.includes(sourceTagValue))) return;
      if (resolveConditionalEffectPlan(effect, worldSnapshot, target, target, { environmentContext }).length === 0) return;
      candidates.push(effect);
    };
    collectPassiveSkills(target).forEach(({ skill }) => {
      passiveEffectEntries(skill).forEach(({ effect }) => append(effect));
    });
    collectStateEntries(target).forEach(([, state]) => append(state));
    const seen = new Set();
    let multiplier = 1;
    let immune = false;
    let sourceMatched = false;
    candidates.forEach(effect => {
      const fingerprint = stableHash(effect);
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      const restrictions = effectSourceRestrictions(effect);
      if (restrictions.length) sourceMatched = true;
      const prototype = String(effect?.原型 || effect?.来源原型摘要 || '').trim();
      const state = String(effect?.状态 || effect?.状态名称 || '').trim();
      const rule = String(effect?.规则 || effect?.防御对象 || '').trim();
      if ((prototype === '状态施加' && ['无视异常', '环境免疫'].includes(state)) ||
        (prototype === '规则防御' && rule === '免伤')) {
        immune = true;
        return;
      }
      if (prototype === '结算修正' && String(effect?.结算 || '').trim() === '受到伤害') {
        multiplier *= clamp(1 + parseSignedValue(effect?.数值, 1), 0, 1);
      }
    });
    return Object.freeze({
      immune: immune || multiplier <= 1e-9,
      multiplier: immune ? 0 : clamp(multiplier, 0, 1),
      sourceMatched,
    });
  }

  function effectSourceRestrictionAllows(effect = {}, environmentContext = null) {
    const restrictions = effectSourceRestrictions(effect);
    if (!restrictions.length) return true;
    const environmentRules = environmentContext?.modifiers?.战斗?.环境规则;
    const protectionSourceTags = effectSourceRestrictions({ 限定来源: environmentRules?.防护来源标签 });
    const hazardSourceTags = Array.isArray(environmentContext?.hazards)
      ? environmentContext.hazards
        .map(hazard => String(hazard?.来源标签 || '').trim())
        .filter(Boolean)
      : [];
    return [...protectionSourceTags, ...hazardSourceTags]
      .filter(Boolean)
      .some(sourceTag => restrictions.includes(sourceTag));
  }

  function pendingGrantedEffects(unit = {}, actionKind = '') {
    const normalizedActionKind = String(actionKind || '').trim().toUpperCase();
    return stateEntries(unit, 'GRANTED_EFFECTS').flatMap(([key, state]) => {
      const trigger = String(state?.授予触发条件 || state?.触发条件 || '').trim();
      const isNextSkill = trigger === '下次魂技成功释放';
      const isNextAction = trigger === '随下次行动触发';
      const uses = Math.max(0, Math.floor(Number(state?.可用次数 ?? 1) || 0));
      if (uses <= 0 || (!isNextAction && !(isNextSkill && normalizedActionKind === 'RELEASE_SKILL')) || !Array.isArray(state?.授予效果)) return [];
      return state.授予效果.map((effect, index) => ({
        stateKey: key,
        trigger,
        uses,
        effect: cloneValue(effect),
        effectId: String(effect?.effectId || effect?.效果ID || `${key}:grant:${index}`).trim(),
      }));
    });
  }

  function consumeGrantedStateUses(unit = {}, stateKeys = []) {
    const states = unit.状态效果;
    if (!states || typeof states !== 'object' || Array.isArray(states)) return [];
    return [...new Set(stateKeys)].flatMap(stateKey => {
      const state = states[stateKey];
      if (!state || typeof state !== 'object') return [];
      const beforeUses = Math.max(0, Math.floor(Number(state.可用次数 ?? 1) || 0));
      if (beforeUses <= 0) return [];
      const before = cloneValue(state), afterUses = beforeUses - 1;
      if (afterUses > 0) state.可用次数 = afterUses;
      else delete states[stateKey];
      return [{ stateKey, state, before, beforeUses, afterUses }];
    });
  }

  function rulePrototypeState(effect = {}, prototype = '', context = {}) {
    const duration = Math.max(1, Number(effect?.持续回合 || 1));
    const rule = String(effect?.规则 || effect?.防御对象 || '').trim();
    const rawValue = effect?.数值 ?? effect?.强度;
    const magnitude = Math.abs(parseSignedValue(
      rawValue === undefined || rawValue === '' ? (prototype === '规则防御' ? '50%' : '25%') : rawValue,
      1,
    ));
    const combatEffect = {};
    if (prototype === '规则防御') {
      if (rule === '免死') combatEffect.death_save_count = Math.max(1, Number(effect?.次数 || 1));
      else if (rule === '免伤') combatEffect.block_count = Math.max(1, Number(effect?.次数 || 1));
      else combatEffect.damage_reduction = clamp(magnitude || 0.5, 0, 0.95);
    } else if (prototype === '规则改写') {
      if (rule === '缴械') combatEffect.disarm = true;
      if (rule === '死亡转存活') {
        combatEffect.revive_count = 1;
        combatEffect.revive_heal_ratio = clamp(magnitude || 0.25, 0.05, 1);
      }
    }
    return {
      状态: `${prototype}:${rule || '规则'}`,
      状态名称: `${prototype}:${rule || '规则'}`,
      类型: prototype === '规则防御' || rule === '死亡转存活' ? 'buff' : 'debuff',
      duration,
      来源原型摘要: prototype,
      来源动作ID: String(context?.rootActionId || '').trim(),
      规则: rule,
      防御对象: String(effect?.防御对象 || '').trim(),
      战斗效果: combatEffect,
      面板修改比例: {},
      面板固定修正: {},
    };
  }

  function nestedEffects(effect = {}) {
    return effectArrayFields.flatMap(field => Array.isArray(effect?.[field]) ? effect[field] : []);
  }

  function applyProjectedRuleState(unit, effect, prototype, context) {
    const state = rulePrototypeState(effect, prototype, context);
    unit.状态效果 ||= {};
    const existingEntry = stateEntries(unit).find(([, existing]) => stateName(existing) === stateName(state));
    if (!existingEntry) {
      unit.状态效果[`preview:${context.effectInstanceId}:${prototype}`] = state;
      return;
    }
    const [stateKey, existing] = existingEntry;
    const previousEffects = existing.战斗效果 || {}, nextEffects = state.战斗效果 || {};
    unit.状态效果[stateKey] = {
      ...existing, ...state,
      duration: Math.max(Number(existing.duration ?? existing.持续回合 ?? 0), Number(state.duration ?? state.持续回合 ?? 1)),
      战斗效果: {
        ...previousEffects, ...nextEffects,
        ...(nextEffects.block_count !== undefined ? { block_count: Math.max(0, Number(previousEffects.block_count || 0)) + Math.max(0, Number(nextEffects.block_count || 0)) } : {}),
        ...(nextEffects.death_save_count !== undefined ? { death_save_count: Math.max(0, Number(previousEffects.death_save_count || 0)) + Math.max(0, Number(nextEffects.death_save_count || 0)) } : {}),
      },
    };
  }

  function transferProjectedStates(overlay, actor, targets, eligibleTargets, effect, context) {
    const target = eligibleTargets[0];
    if (!target) return 0;
    const transaction = overlay.fork(), moves = [];
    if (effect.原型 === '状态转移') {
      const selectedIds = eligibleTargets.map(unitId);
      const failedIds = new Set(targets.map(unitId).filter(id => !selectedIds.includes(id)));
      const endpointIds = endpoint => {
        if (endpoint === '自身') return [unitId(actor)];
        if (endpoint === '目标') return selectedIds;
        if (!['友方', '敌方'].includes(endpoint)) throw new Error(`battle_preview_state_transfer_endpoint_invalid:${endpoint}`);
        const actorSide = sideOf(context.worldSnapshot, actor);
        const ids = listUnits(context.worldSnapshot).filter(entry => !failedIds.has(unitId(entry.unit)) && (endpoint === '友方' ? entry.side === actorSide : entry.side !== actorSide)).map(entry => unitId(entry.unit));
        return [...new Set([...selectedIds.filter(id => ids.includes(id)), ...ids])];
      };
      const sources = endpointIds(String(effect.来源 || '自身').trim()), destinations = endpointIds(String(effect.去向 || '目标').trim());
      const limit = String(effect.数量 || '').trim() === '全部' ? Infinity : Math.max(1, Math.floor(Number(effect.数量 || 1)));
      for (const sourceId of sources) {
        const destinationId = destinations.find(id => id !== sourceId);
        if (!destinationId) continue;
        for (const [key, state] of matchingStates(overlay.readUnit(sourceId), effect.状态 || '任意状态').filter(([key]) => key !== context.persistentStateKey).slice(0, Math.max(0, limit - moves.length))) {
          moves.push({ sourceId, destinationId, key, state });
        }
        if (moves.length >= limit) break;
      }
    } else {
      if (unitId(actor) === unitId(target)) return 0;
      const negative = matchingStates(overlay.readUnit(unitId(actor)), effect.状态 || '任意负面').filter(([, state]) => statePolarity(state) < 0);
      const positive = matchingStates(overlay.readUnit(unitId(target)), '任意增益');
      if (negative.length && positive.length) moves.push({ sourceId: unitId(actor), destinationId: unitId(target), key: negative[0][0], state: negative[0][1] },
        { sourceId: unitId(target), destinationId: unitId(actor), key: positive[0][0], state: positive[0][1] });
    }
    const persistent = persistentStateOperation(actor, eligibleTargets.map(unitId), effect, context);
    if (!moves.length && !persistent) return 0;
    const removedByUnit = new Map(), addedByUnit = new Map();
    for (const move of moves) {
      if (!removedByUnit.has(move.sourceId)) removedByUnit.set(move.sourceId, new Set());
      removedByUnit.get(move.sourceId).add(move.key);
      if (!addedByUnit.has(move.destinationId)) addedByUnit.set(move.destinationId, []);
      const key = `transferred:${context.effectInstanceId}:${move.sourceId}:${move.key}`;
      move.destinationKey = key;
      const state = Array.isArray(move.state.副作用列表) ? { ...move.state, 副作用列表: move.state.副作用列表.map(risk =>
        risk.关联状态 === move.key ? { ...risk, 关联状态: key } : risk) } : move.state;
      addedByUnit.get(move.destinationId).push([key, state]);
    }
    for (const id of new Set([...removedByUnit.keys(), ...addedByUnit.keys()])) transaction.changeUnit(id, unit => {
      replaceStates(unit, [...stateEntries(unit).filter(([key]) => !removedByUnit.get(id)?.has(key)), ...(addedByUnit.get(id) || [])]);
      unit.final = { ...unit.final, ...buildNumericCombatStats(unit, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0)) };
    });
    if (persistent) transaction.changeUnit(unitId(actor), unit => {
      unit.状态效果 = { ...(unit.状态效果 || {}), [persistent.key]: persistent.state };
    });
    overlay.commitFrom(transaction);
    return { movedStateCount: moves.length, moves, persistent, changedUnitIds: [...new Set([
      ...removedByUnit.keys(), ...addedByUnit.keys(), ...(persistent ? [unitId(actor)] : []),
    ])] };
  }

  function persistentStateOperation(actor, targetIds, effect, context) {
    const duration = Number(effect.持续回合 || 0);
    if (!(duration > 0)) return null;
    const sourceActionId = String(context.declaration?.__structuredSourceActionId || context.rootActionId || '');
    const sourceEffectId = String(context.declaration?.__structuredSourceEffectId || context.effectInstanceId || '');
    const name = `持续${effect.原型}`, stateId = `${name}:${stableHash([sourceActionId, sourceEffectId, targetIds]).slice(0, 20)}`;
    return { key: `preview:${context.effectInstanceId}:${stateId}`, state: {
      状态ID: stateId, 状态: name, 状态名称: name, 原型: effect.原型, 类型: effect.原型 === '状态移除' ? 'buff' : 'neutral',
      duration, __本回合新附加: true, 来源角色: unitId(actor), 目标角色: targetIds[0], 持续目标列表: targetIds,
      来源动作ID: sourceActionId, 来源效果ID: sourceEffectId,
      来源技能: String(context.declaration?.skill?.魂技名 || context.declaration?.skill?.name || name),
      ...(effect.原型 === '状态移除' ? { 特殊机制标识: '持续状态移除' } : {}),
      持续原型效果: Object.fromEntries(['原型', '状态', '来源', '去向', '数量', '匹配原型', '资源', '数值方向']
        .filter(key => effect[key] !== undefined).map(key => [key, effect[key]])), 战斗效果: {},
    } };
  }

  function consumePreviewNode(context, effect) {
    context.nodeBudget.count += 1;
    if (context.nodeBudget.count > context.nodeBudget.limit) throw new Error('DECISION_PREVIEW_BUDGET_EXCEEDED');
    let effectHash = effectHashCache.get(effect);
    if (!effectHash) {
      effectHash = stableHash(effect);
      effectHashCache.set(effect, effectHash);
    }
    const fingerprint = `${context.depth}|${effectHash}|${context.effectPath.join('>')}`;
    if (context.nodeBudget.activeFingerprints.has(fingerprint)) throw new Error('battle_preview_recursive_effect_cycle');
    context.nodeBudget.activeFingerprints.add(fingerprint);
    return fingerprint;
  }

  function applyStatModifier(unit, effect) {
    const aliases = {
      力量: ['str', '力量'],
      防御: ['def', '防御'],
      敏捷: ['agi', '敏捷'],
      魂力上限: ['sp_max', '魂力上限'],
      精神力上限: ['men_max', '精神力上限'],
      体力上限: ['vit_max', '体力上限'],
    };
    const attributes = (Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性])
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const changes = attributes.map(attribute => {
      const keys = aliases[attribute] || [attribute];
      if (['sp_max', 'men_max', 'vit_max'].includes(keys[0])) {
        const resource = { sp_max: '魂力', men_max: '精神力', vit_max: '体力' }[keys[0]];
        const current = readResourceMax(unit, resource);
        const state = findStateEntry(unit, effect)?.[1];
        if (!state) throw new Error('battle_attribute_modifier_state_missing');
        const raw = String(effect?.数值 ?? '').trim();
        const numeric = Number(raw.replace('%', ''));
        if (/%$/.test(raw)) {
          state.面板修改比例 ||= {};
          state.面板修改比例[keys[0]] = 1 + numeric / 100;
        } else {
          state.面板固定修正 ||= {};
          state.面板固定修正[keys[0]] = numeric;
        }
        const next = readResourceMax(unit, resource);
        unit.final = { ...unit.final, ...buildNumericCombatStats(unit) };
        return { attribute, current, next, delta: next - current };
      }
      const current = readNumber(unit, keys, 0);
      const delta = parseSignedValue(effect?.数值, current);
      const next = Math.max(0, current + delta);
      if (keys[0]) unit[keys[0]] = next;
      if (unit.属性 && typeof unit.属性 === 'object' && keys[1]) unit.属性[keys[1]] = next;
      if (unit.final && typeof unit.final === 'object') {
        keys.forEach((key, index) => {
          if (index === 0 || Object.prototype.hasOwnProperty.call(unit.final, key)) unit.final[key] = next;
        });
      }
      return { attribute, current, next, delta: next - current };
    });
    const first = changes[0] || { attribute: '', current: 0, next: 0, delta: 0 };
    return {
      attribute: attributes.length === 1 ? first.attribute : attributes.join('、'),
      current: attributes.length === 1 ? first.current : undefined,
      next: attributes.length === 1 ? first.next : undefined,
      delta: attributes.length === 1 ? first.delta : undefined,
      changes,
    };
  }

  function buildPositionEvidence(effect = {}, combatEffect = {}) {
    const positionType = String(effect?.位移类型 || '').trim();
    const positionObject = String(effect?.位移对象 || '').trim();
    const distance = Math.max(0, Number(effect?.距离 || 0));
    return {
      prototype: '位移执行',
      positionType,
      positionObject,
      distance,
      projection: String(combatEffect?.position_projection || '命中、闪避、索敌、反应和姿态窗口'),
      modelApplied: true,
      combatEffect: cloneValue(combatEffect),
      modelReason: '位移幅度已转换为命中、闪避与反应行为池差量',
    };
  }

  function buildEffectEvidence(effect = {}, prototype = '', combatEffect = {}, extra = {}) {
    return {
      prototype,
      ...(effect?.类型 ? { stateType: String(effect.类型).trim() } : {}),
      state: String(effect?.状态 || '').trim(),
      check: String(effect?.判定 || '').trim(),
      settlement: String(effect?.结算 || '').trim(),
      attribute: Array.isArray(effect?.属性) ? effect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、') : String(effect?.属性 || '').trim(),
      value: String(effect?.数值 ?? '').trim(),
      element: String(effect?.限定元素 || '').trim(),
      duration: Math.max(1, Number(effect?.持续回合 || 1)),
      combatEffect: cloneValue(combatEffect),
      ...extra,
    };
  }

  function resourcePrefixBranches(overlay, ledger, context) {
    const damageEntries = ledger.entries.filter(entry =>
      entry.outcomeKind === 'HP_DELTA' && !entry.evidence?.resourceChange &&
      !entry.evidence?.lethalSettlement && !entry.evidence?.transferRole);
    const unrepresentedDamage = damageEntries.some(entry => {
      const outcomes = entry.evidence?.outcomeDistribution;
      return !outcomes?.length || outcomes.some(outcome => Object.keys(outcome.conditionalOn || {}).some(key =>
          !damageEntries.some(source => source.evidence?.distributionGroupKey === key || source.evidence?.probabilityGroupKey === key)) ||
        !Number.isFinite(outcome.hpDamage) || !Number.isFinite(outcome.shieldAbsorb)) ||
        !(outcomes.every(outcome => outcome.priorResourceAssignments && Number.isFinite(outcome.hpBefore))) &&
        ledger.entries.slice(0, ledger.entries.indexOf(entry)).some(prior => prior.targetId === entry.targetId &&
          !(prior.outcomeKind === 'SHIELD_DELTA' && prior.effectInstanceId === entry.effectInstanceId && prior.evidence?.absorbedDamage !== undefined) &&
          prior.windowId !== 'ACTION_COST');
    });
    if (unrepresentedDamage) {
      metrics.resourceOutcomeUnrepresentedDamagePrefixes += 1;
      return null;
    }
    const graph = buildActionOperationGraph({ worldSnapshot: overlay.baseWorld, damageOutcomeEntries: damageEntries,
      previewResult: { actionId: context.rootActionId, actorId: unitId(context.actor), contributions: ledger.entries } });
    const branches = evaluateOperationGraph({ graph, baseWorld: overlay.baseWorld }).finalStates;
    metrics.resourceOutcomeBranchReplays += 1;
    metrics.resourceOutcomeBranchStates += branches.length;
    metrics.resourceOutcomeBranchMaxStates = Math.max(metrics.resourceOutcomeBranchMaxStates, branches.length);
    return branches;
  }

  function resourceOutcome(effect, target, overlay, ledger, context) {
    const currentTarget = overlay.readUnit(unitId(target));
    const resourceKeys = normalizedResourceKeys(effect?.资源 || '魂力');
    const multiResource = resourceKeys.length > 1;
    const probabilityProfile = effectProbabilityProfile(
      context,
      unitId(target),
      effect,
    );
    const applicationProbability =
      probabilityProfile.applicationProbability;
    resourceKeys.forEach(resourceKey => {
      const resource = resourceLabel(resourceKey);
      const isHp = resourceKey === 'hp';
      const uncertainResourceHistory = ledger.entries.some(entry => entry.targetId === unitId(target) &&
        (entry.evidence?.resource === resource || (isHp && entry.outcomeKind === 'HP_DELTA') ||
          entry.evidence?.prototype === '属性修正') && (
          (Number(entry.evidence.applicationProbability) > 0 && Number(entry.evidence.applicationProbability) < 1) ||
          entry.evidence.outcomeDistribution?.some(outcome => Number(outcome.probability) > 0 && Number(outcome.probability) < 1)
        ));
      const current = isHp ? readHp(currentTarget) : readResource(currentTarget, resource);
      const maximum = isHp ? readHpMax(currentTarget) : readResourceMax(currentTarget, resource);
      const requestedDelta = parseSignedValue(effect?.数值, maximum);
      const healingMultiplier = requestedDelta > 0
        ? Math.max(0, Number(healingMultiplierForUnit(currentTarget, resource) ?? 1))
        : 1;
      const realizedNext = clamp(current + requestedDelta * healingMultiplier, 0, maximum);
      const realizedDelta = realizedNext - current;
      const delta = realizedDelta * applicationProbability;
      const next = clamp(current + delta, 0, maximum);
      overlay.changeUnit(unitId(target), unit => {
        setResourceValue(unit, resource, next);
      });
      const outcomeDistribution = conditionalDeterministicOutcomeDistribution(
        context,
        unitId(target),
        realizedDelta,
        applicationProbability,
      );
      const resourceEntry = ledger.addOutcome({
        ...context,
        ...(multiResource ? { resourceKey } : {}),
        targetId: unitId(target),
        outcomeKind: isHp ? 'HP_DELTA' : 'RESOURCE_OPTION_CHANGED',
        threatValue: isHp ? (next - current) / readHpMax(currentTarget) * 100 : 0,
        evidence: {
          resource,
          resourceChange: { value: effect?.数值,
            targetEligibility: /自身/.test(String(effect?.目标 || context?.declaration?.targetKind || '')) ? 'SELF'
              : effectTargetsAllies(effect) ? 'PHYSICALLY_ALIVE' : 'BATTLE_CAPABLE' },
          ...(multiResource ? { resourceKey } : {}),
          current,
          next,
          delta: next - current,
          realizedDelta,
          applicationProbability,
          ownApplicationProbability:
            probabilityProfile.ownApplicationProbability,
          ...outcomeDependencyEvidence(context, unitId(target)),
          probabilityGroupKey: [
            context.rootActionId,
            context.effectInstanceId,
            context.windowId,
            unitId(target),
          ].join('|'),
          ...(outcomeDistribution.length
            ? {
                outcomeDistribution,
                distributionGroupKey: String(
                  context?.outcomeAssignmentKeyByTarget?.get?.(unitId(target)) ||
                  [
                    context.rootActionId,
                    context.effectInstanceId,
                    context.windowId,
                    unitId(target),
                  ].join('|')
                ).trim(),
              }
            : {}),
        },
      });
      const branches = uncertainResourceHistory ? resourcePrefixBranches(overlay, ledger, context) : null;
      if (branches) {
        // Reconcile before the next effect reads the overlay, using the same ordered
        // conditional operations as the exact graph consumer rather than clamping a mean.
        const branchMean = branches.reduce((sum, branch) =>
          sum + branch.probability * readResource(findUnit(branch.world, unitId(target)), resource), 0);
        const branchDelta = branchMean - current;
        overlay.setResource(unitId(target), resource, branchMean);
        ledger.entries[ledger.entries.length - 1] = Object.freeze({
          ...resourceEntry, expectedDelta: branchDelta,
          threatValue: isHp ? branchDelta / readHpMax(currentTarget) * 100 : 0,
          evidence: Object.freeze({ ...resourceEntry.evidence, next: branchMean, delta: branchDelta,
            realizedDelta: applicationProbability > 0 ? branchDelta / applicationProbability : 0 }),
        });
      }
    });
  }

  const observablePrimaryStatePrototypes = new Set(['规则防御', '规则改写', '机制抹消', '机制授予', '状态移除', '时光回溯']);

  function primaryResolutionProbabilityFromOutcomes(entries = [], targetId = '', prototype = '') {
    if (prototype === '时窗修正') return entries.reduce((maximum, entry) =>
      entry.targetId === targetId && entry.evidence.durationChanges?.some(change => Number(change.tickDelta) !== 0 || Number(change.settlementDelta) !== 0)
        ? Math.max(maximum, clamp(Number(entry.evidence.applicationProbability ?? 0), 0, 1)) : maximum, 0);
    if (prototype === '召唤生成') return entries.reduce((maximum, entry) =>
      entry.actorId === targetId && entry.outcomeKind === 'SUMMON_WINDOW'
        ? Math.max(maximum, clamp(Number(entry.evidence.applicationProbability ?? 0), 0, 1)) : maximum, 0);
    if (prototype === '属性修正') return entries.reduce((maximum, entry) =>
      entry.targetId === targetId && entry.outcomeKind === 'NEXT_ACTION_QUALITY_CHANGED' && entry.evidence.marginal !== false
        ? Math.max(maximum, clamp(Number(entry.evidence.applicationProbability ?? 0), 0, 1)) : maximum, 0);
    if (prototype === '状态转移' || prototype === '状态交换') {
      const entry = entries.find(row => row.evidence.stateTransfer);
      if (!entry) return 0;
      if (entry.evidence.stateTransfer.targets.length > 1) return null;
      return entry.evidence.persistentStateOperation || entry.evidence.stateTransfer.changedUnitIds.includes(targetId) ? Number(entry.evidence.applicationProbability || 0) : 0;
    }
    if (observablePrimaryStatePrototypes.has(prototype)) return entries.reduce((maximum, entry) => {
      if (entry.targetId !== targetId || !['STATE_CHANGED', 'RULE_CHANGED'].includes(entry.outcomeKind) || entry.evidence.marginal === false) return maximum;
      if (entry.evidence.stateRemoval && !entry.evidence.removedKeys?.length && !entry.evidence.persistentStateOperation) return maximum;
      return Math.max(maximum, clamp(Number(entry.evidence.applicationProbability ?? 1), 0, 1));
    }, 0);
    const outcomeKinds = prototype === '资源变化' || prototype === '资源转移'
      ? new Set(['HP_DELTA', 'RESOURCE_OPTION_CHANGED'])
      : prototype === '护盾变化'
        ? new Set(['SHIELD_DELTA'])
        : null;
    if (!outcomeKinds) return null;
    return entries.reduce((maximum, entry) => {
      if (prototype === '资源转移' && entry.evidence?.persistentTransfer &&
        entry.evidence.probabilityTargetId === targetId) return Math.max(maximum, clamp(Number(entry.evidence.applicationProbability), 0, 1));
      if (
        String(entry?.targetId || '').trim() !== String(targetId || '').trim() ||
        !outcomeKinds.has(String(entry?.outcomeKind || '').trim())
      ) return maximum;
      const realizedDelta = Number(entry?.evidence?.realizedDelta ?? entry?.evidence?.delta ?? 0);
      if (!(Math.abs(realizedDelta) > 1e-9)) return maximum;
      return Math.max(maximum, clamp(Number(entry?.evidence?.applicationProbability ?? 1), 0, 1));
    }, 0);
  }

  function requiredOutcomeProfile(context = {}, targetId = '') {
    const key = String(
      context?.requiredOutcomeKeyByTarget?.get?.(targetId) || ''
    ).trim();
    const values = [...new Set(
      context?.requiredOutcomeValuesByTarget?.get?.(targetId) || []
    )].map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
    const universe = [...new Set(
      context?.requiredOutcomeUniverseByTarget?.get?.(targetId) || values
    )].map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
    return { key, values, universe };
  }

  function outcomeDependencyEvidence(context = {}, targetId = '') {
    const required = requiredOutcomeProfile(context, targetId);
    return {
      ...(required.key ? {
          requiredOutcomeKey: required.key,
          requiredOutcomeValues: Object.freeze([...required.values]),
          requiredOutcomeUniverse: Object.freeze([...required.universe]),
        } : {}),
      ...(context?.requiredOutcomeAssignmentsByTarget?.has(targetId)
        ? { requiredOutcomeAssignments: context.requiredOutcomeAssignmentsByTarget.get(targetId) }
        : {}),
    };
  }

  function effectProbabilityProfile(context = {}, targetId = '', effect = null) {
    const required = requiredOutcomeProfile(context, targetId);
    if (effect && context.conditionalPlanResolved) {
      const inheritedProbability = context.applicationProbabilityByTarget === context.ownApplicationProbabilityByTarget
        ? 1 : clamp(Number(context.applicationProbabilityByTarget?.get(targetId) ?? context.applicationProbability ?? 1), 0, 1);
      const baseApplicationProbability = normalizeEffectProbability(effect.成功率 ?? effect.触发概率, 1);
      const resolved = typeof context.applicationProbabilityResolver === 'function'
        ? context.applicationProbabilityResolver({ targetId, actor: context.actor, effect,
            effectInstanceId: context.effectInstanceId, baseApplicationProbability, recordDependency: recordPreviewDependency })
        : baseApplicationProbability;
      const ownApplicationProbability = forcedApplicationProbability(context, context.effectInstanceId, targetId) ?? clamp(
        Number.isFinite(Number(resolved)) ? Number(resolved) : baseApplicationProbability, 0, 1,
      );
      return { required, inheritedProbability, ownApplicationProbability,
        applicationProbability: inheritedProbability * ownApplicationProbability };
    }
    const inheritedProbability = clamp(Number(
      context?.applicationProbabilityByTarget?.get?.(targetId) ??
      context?.applicationProbability ??
      1
    ), 0, 1);
    const ownApplicationProbability = clamp(Number(
      context?.ownApplicationProbabilityByTarget?.get?.(targetId) ??
      (required.key ? 1 : inheritedProbability)
    ), 0, 1);
    return {
      required,
      inheritedProbability,
      ownApplicationProbability,
      applicationProbability: required.key
        ? inheritedProbability * ownApplicationProbability
        : inheritedProbability,
    };
  }

  function conditionalDeterministicOutcomeDistribution(
    context = {},
    targetId = '',
    realizedDelta = 0,
    applicationProbability = 1,
    applicationGroupKey = '',
  ) {
    const primaryOutcomeKey = context.outcomeAssignmentKeyByTarget?.get(targetId);
    const applicationKey = applicationGroupKey || [context.rootActionId, context.effectInstanceId, context.windowId, targetId].join('|');
    if (primaryOutcomeKey) return Object.freeze([
      ...(applicationProbability > 1e-12 ? [Object.freeze({ branchKey: 'primary:HIT', probability: applicationProbability,
        assignments: { [primaryOutcomeKey]: 'HIT', [applicationKey]: 'SUCCESS' }, delta: realizedDelta })] : []),
      ...(applicationProbability < 1 - 1e-12 ? [Object.freeze({ branchKey: 'primary:MISS', probability: 1 - applicationProbability,
        assignments: { [primaryOutcomeKey]: 'MISS', [applicationKey]: 'FAILURE' }, delta: 0 })] : []),
    ]);
    const required = requiredOutcomeProfile(context, targetId);
    if (!required.key || !required.values.length || !required.universe.length) {
      return Object.freeze([]);
    }
    return Object.freeze([
      ...required.universe
        .filter(value => !required.values.includes(value))
        .map(value => Object.freeze({
          branchKey: `required:${value.toLowerCase()}:inactive`,
          probability: 1,
          conditionalOn: { [required.key]: value },
          delta: 0,
        })),
      ...required.values.map(value => Object.freeze({
        branchKey: `required:${value.toLowerCase()}:active`,
        probability: 1,
        conditionalOn: { [required.key]: value },
        delta: realizedDelta,
      })),
    ]);
  }

  function applyEffect(effect, targets, overlay, ledger, context, depth) {
    if (
      context?.conditionalPlanResolved !== true &&
      Array.isArray(effect?.条件分支) &&
      effect.条件分支.length
    ) {
      const actor = overlay.readUnit(unitId(context.actor)) || context.actor;
      const worldSnapshot = overlay.snapshot();
      const groups = new Map();
      const conditionedRecipients = new Map();
      targets.forEach(target => {
        const targetId = unitId(target);
        const primaryOutcomes = context?.primaryOutcomeDistributionByTarget?.get?.(targetId) || [];
        const hasOutcomeCondition = effect.条件分支.some(branch =>
          (Array.isArray(branch?.条件) ? branch.条件 : []).some(condition =>
            ['命中', '被闪避'].includes(String(condition?.类型 || '').trim())
          )
        );
        if (hasOutcomeCondition && primaryOutcomes.length) {
          const outcomeKey = String(
            context?.primaryOutcomeKeyByTarget?.get?.(targetId) || ''
          ).trim();
          const universe = [...new Set(
            primaryOutcomes
              .map(row => String(row?.outcome || '').trim().toUpperCase())
              .filter(Boolean)
          )];
          const aggregated = new Map();
          const inheritedOutcome = requiredOutcomeProfile(context, targetId);
          primaryOutcomes.forEach(row => {
            const outcome = String(row?.outcome || '').trim().toUpperCase();
            const probability = clamp(Number(row?.probability || 0), 0, 1);
            if (!outcome || !(probability > 1e-12)) return;
            if (inheritedOutcome.key && inheritedOutcome.key === outcomeKey && !inheritedOutcome.values.includes(outcome)) return;
            const plan = resolveConditionalEffectPlan(
              effect,
              worldSnapshot,
              actor,
              target,
              {
                ...context,
                primaryOutcome: outcome,
                primarySucceeded: outcome === 'HIT',
                primaryEvaded: outcome === 'EVADED',
              },
            );
            plan.forEach(entry => {
              const key = stableHash({
                mode: entry.mode,
                branchIndex: entry.branchIndex,
                nestedIndex: entry.nestedIndex,
                effect: entry.effect,
              });
              const current = aggregated.get(key) || {
                entry,
                outcomes: new Set(),
                probability: 0,
              };
              current.outcomes.add(outcome);
              current.probability += probability;
              aggregated.set(key, current);
            });
          });
          aggregated.forEach(({ entry, outcomes, probability }) => {
            const recipients = entry.mode === 'ORIGINAL' ? [target] : resolveTargets(
              worldSnapshot, actor, { ...context.declaration, targetIds: [targetId] }, entry.effect,
            );
            const inheritedProbability = inheritedOutcome.key && inheritedOutcome.key === outcomeKey ? 1 : clamp(Number(
              context?.applicationProbabilityByTarget?.get?.(targetId) ??
              context?.applicationProbability ??
              1
            ), 0, 1);
            const requiredValues = [...outcomes].sort();
            const appliesToAllOutcomes =
              requiredValues.length === universe.length &&
              universe.every(value => outcomes.has(value));
            const suffix = entry.mode === 'ORIGINAL'
              ? ''
              : `:conditional:${entry.mode.toLowerCase()}:${entry.branchIndex}:${entry.nestedIndex}`;
            const recipientContext = {
              ...context,
              conditionalPlanResolved: true,
              outcomeAssignmentKeyByTarget: entry.mode === 'ORIGINAL' || (entry.mode === 'REPLACE' && entry.nestedIndex === 0)
                ? context.outcomeAssignmentKeyByTarget
                : undefined,
              conditionalSourceEffect: effect,
              effectInstanceId: `${context.effectInstanceId}${suffix}`,
              applicationProbabilityByTarget: new Map(recipients.map(recipient => [
                unitId(recipient),
                inheritedProbability * clamp(probability, 0, 1),
              ])),
              ...(appliesToAllOutcomes || !outcomeKey
                ? {}
                : {
                    requiredOutcomeKeyByTarget: new Map(recipients.map(recipient => [unitId(recipient), outcomeKey])),
                    requiredOutcomeValuesByTarget: new Map(recipients.map(recipient => [unitId(recipient), requiredValues])),
                    requiredOutcomeUniverseByTarget: new Map(recipients.map(recipient => [unitId(recipient), universe])),
                  }),
            };
            recipients.forEach(recipient => {
              const id = unitId(recipient);
              const key = `${recipientContext.effectInstanceId}|${id}`;
              const group = conditionedRecipients.get(key) || { effect: entry.effect, recipient, context: { ...recipientContext }, sources: [] };
              group.sources.push({ outcomeKey, requiredValues, primaryOutcomes, inheritedProbability });
              conditionedRecipients.set(key, group);
            });
          });
          return;
        }
        const conditionalContext = {
          ...context,
          primarySucceeded:
            context?.primarySucceededByTarget?.get?.(targetId) ??
            context?.primarySucceeded,
          primarySuccessProbability:
            context?.primarySuccessProbabilityByTarget?.get?.(targetId) ??
            context?.primarySuccessProbability,
          primaryEvaded:
            context?.primaryEvadedByTarget?.get?.(targetId) ??
            context?.primaryEvaded,
          primaryEvadeProbability:
            context?.primaryEvadeProbabilityByTarget?.get?.(targetId) ??
            context?.primaryEvadeProbability,
          primaryOutcome:
            context?.primaryOutcomeByTarget?.get?.(targetId) ??
            context?.primaryOutcome,
        };
        const plan = resolveConditionalEffectPlan(
          effect,
          worldSnapshot,
          actor,
          target,
          conditionalContext,
        );
        if (!plan.length) return;
        const key = stableHash(plan.map(entry => ({
          mode: entry.mode,
          branchIndex: entry.branchIndex,
          nestedIndex: entry.nestedIndex,
          effect: entry.effect,
        })));
        const group = groups.get(key) || { plan, targets: [] };
        group.targets.push(target);
        groups.set(key, group);
      });
      const conditionedTransfers = new Map();
      conditionedRecipients.forEach(group => {
        if (group.sources.length > 1) {
          const distributions = new Map(group.sources.filter(source => source.outcomeKey).map(source => [source.outcomeKey, source.primaryOutcomes]));
          let assignments = [{ conditionalOn: {}, probability: 1, enabled: group.sources.some(source => !source.outcomeKey) }];
          distributions.forEach((outcomes, key) => {
            assignments = assignments.flatMap(row => row.enabled ? [row] : outcomes.map(outcome => ({
              conditionalOn: { ...row.conditionalOn, [key]: String(outcome.outcome).toUpperCase() },
              probability: row.probability * Number(outcome.probability),
              enabled: group.sources.some(source => source.outcomeKey === key && source.requiredValues.includes(String(outcome.outcome).toUpperCase())),
            })));
          });
          const alternatives = assignments.map((row, index) => ({
            ...row,
            suffix: `source-set:${index}`,
          }));
          const id = unitId(group.recipient);
          group.context.requiredOutcomeAssignmentsByTarget = new Map([[id, alternatives]]);
          group.context.requiredOutcomeKeyByTarget = undefined;
          group.context.requiredOutcomeValuesByTarget = undefined;
          group.context.requiredOutcomeUniverseByTarget = undefined;
          group.context.applicationProbabilityByTarget = new Map([[id,
            alternatives.reduce((sum, row) => sum + (row.enabled ? row.probability : 0), 0) * group.sources[0].inheritedProbability,
          ]]);
        }
        if (group.effect.原型 === '资源转移') {
          const key = `${group.context.effectInstanceId}|${stableHash(group.sources)}`;
          const transfer = conditionedTransfers.get(key) || { ...group, recipients: [] };
          transfer.recipients.push(group.recipient);
          for (const field of ['applicationProbabilityByTarget', 'requiredOutcomeKeyByTarget', 'requiredOutcomeValuesByTarget', 'requiredOutcomeUniverseByTarget', 'requiredOutcomeAssignmentsByTarget']) {
            const id = unitId(group.recipient);
            if (group.context[field]?.has(id)) transfer.context[field] = new Map([
              ...(transfer.context[field] || []), [id, group.context[field].get(id)],
            ]);
          }
          conditionedTransfers.set(key, transfer);
        } else applyEffect(group.effect, [group.recipient], overlay, ledger, group.context, depth);
      });
      conditionedTransfers.forEach(transfer => applyEffect(transfer.effect, transfer.recipients, overlay, ledger, transfer.context, depth));
      groups.forEach(group => {
        group.plan.forEach(entry => {
          const recipients = entry.mode === 'ORIGINAL' ? group.targets : resolveTargets(
            worldSnapshot, actor, { ...context.declaration, targetIds: group.targets.map(unitId) }, entry.effect,
          );
          const suffix = entry.mode === 'ORIGINAL'
            ? ''
            : `:conditional:${entry.mode.toLowerCase()}:${entry.branchIndex}:${entry.nestedIndex}`;
          applyEffect(
            entry.effect,
            recipients,
            overlay,
            ledger,
            {
              ...context,
              conditionalPlanResolved: true,
              outcomeAssignmentKeyByTarget: entry.mode === 'ORIGINAL' || (entry.mode === 'REPLACE' && entry.nestedIndex === 0)
                ? context.outcomeAssignmentKeyByTarget
                : undefined,
              conditionalSourceEffect: effect,
              effectInstanceId: `${context.effectInstanceId}${suffix}`,
            },
            depth,
          );
        });
      });
      return;
    }
    const prototype = String(effect?.原型 || '').trim();
    validateEffect(effect);
    if (!effectSourceRestrictionAllows(effect, context?.environmentContext)) return;
    if (depth > MAX_RECURSION_DEPTH) throw new Error('battle_preview_recursion_depth_exceeded');
    const effectContext = { ...context, depth, effectPath: [...context.effectPath, context.effectInstanceId] };
    const activeFingerprint = consumePreviewNode(effectContext, effect);
    try {
      const actor = overlay.readUnit(unitId(context.actor)) || context.actor;
      if (prototype !== '机制抹消' && actorSuppressesEffect(actor, effect)) {
        ledger.addOutcome({
          ...context,
          targetId: unitId(actor),
          outcomeKind: 'RULE_CHANGED',
          threatValue: 0,
          evidence: { prototype, suppressed: true, marginal: false },
        });
        return;
      }
      if (context.primaryResolvedEffectByTarget) targets.forEach(target => {
        const targetId = unitId(target);
        if (!context.primaryResolvedEffectByTarget.has(targetId)) {
          context.primaryResolvedEffectByTarget.set(targetId, {
            effect,
            effectInstanceId: context.effectInstanceId,
          });
        }
      });
      if (prototype === '伤害结算') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const baseHitProbability = estimateHitProbability(
            actor,
            currentTarget,
            effect,
            context?.projectionContext || null,
            context?.environmentContext || null,
          );
          const resolvedHitProbability = typeof context?.hitProbabilityResolver === 'function'
            ? context.hitProbabilityResolver({
                targetId: unitId(target),
                actor,
                effect,
                effectInstanceId: context.effectInstanceId,
                baseHitProbability,
                recordDependency: recordPreviewDependency,
              })
            : null;
          const hitProbability = clamp(
            resolvedHitProbability !== null &&
              resolvedHitProbability !== undefined &&
              Number.isFinite(Number(resolvedHitProbability))
              ? Number(resolvedHitProbability)
              : baseHitProbability,
            0,
            1,
          );
          const applicationProbability = clamp(Number(
            context?.applicationProbabilityByTarget?.get(unitId(target)) ??
            context?.applicationProbability ??
            1
          ), 0, 1);
          const evadeProbability = clamp(Number(
            context?.evadeProbabilityByTarget?.get?.(unitId(target)) ??
            context?.evadeProbabilityByTarget?.[unitId(target)] ??
            context?.evadeProbability ??
            0
          ), 0, 1);
          const resolvedDamageMultiplier = typeof context?.damageMultiplierResolver === 'function'
            ? context.damageMultiplierResolver({
                targetId: unitId(target),
                actor,
                effect,
                effectInstanceId: context.effectInstanceId,
              })
            : null;
          const reactionDamageMultiplier = clamp(Number(
            resolvedDamageMultiplier ??
            context?.damageMultiplierByTarget?.[unitId(target)] ??
            context?.damageMultiplierByTarget?.get?.(unitId(target)) ??
            1
          ), 0, 1);
          const environmentDamageMultiplier = clamp(Number(
            context?.environmentDamageMultiplierByTarget?.get?.(unitId(target)) ??
            context?.environmentDamageMultiplierByTarget?.[unitId(target)] ??
            1
          ), 0, 1);
          const damageBasis = buildDamageBasis(
            effect,
            actor,
            currentTarget,
            context?.projectionContext || null,
            {
              basisView: context?.basisView || 'DECISION_VISIBLE',
              effectInstanceId: context.effectInstanceId,
              sourceEffectId: context.effectInstanceId,
              sourceActionId: context.rootActionId,
              snapshotRevision: context.snapshotRevision,
              actionDamageMultiplier: context?.actionDamageMultiplier,
              targetCount: targets.length,
              reactionDamageMultiplier,
              resourceDriveEnabled: String(context?.declaration?.actionKind || '').trim().toUpperCase() !== 'BASIC_ATTACK',
            },
          );
          assertDamageBasis(damageBasis, {
            basisView: context?.basisView || 'DECISION_VISIBLE',
            actorId: unitId(actor),
            targetId: unitId(currentTarget),
            effectInstanceId: context.effectInstanceId,
            sourceActionId: context.rootActionId,
            snapshotRevision: context.snapshotRevision,
          });
          const rawDamage = damageBasis.operands.rawDamage;
          const damageBasisEvidence = damageBasisMetadata(damageBasis, {
            includeFormulaTrace: context?.captureDamageBasisTrace === true,
            diagnostic: context?.captureDamageBasisTrace === true,
          });
          const nonlethalIntent = /点到为止|切磋|训练|非致命/.test(String(context?.battleIntent?.mode || context?.battleIntent || '').trim());
          const nonlethalHpFloor = nonlethalIntent
            ? calculateNonlethalHpFloor(overlay.snapshot(), currentTarget, context?.battleIntent || {})
            : 0;
          const hpDamageLimit = nonlethalIntent ? Math.max(0, readHp(currentTarget) - nonlethalHpFloor) : readHp(currentTarget);
          const availableDeathSaves = nonlethalHpFloor > 0 ? 0 : deathSaveCount(currentTarget);
          const availableRuleBlocks = ruleBlockCount(currentTarget);
          const shieldBefore = readShield(currentTarget);
          const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 ?? effect?.段数 ?? 1)) || 1);
          const perSegmentDamage = calculateSettledSegmentDamage(
            rawDamage,
            segments,
            reactionDamageMultiplier * environmentDamageMultiplier,
          );
          const reviveTarget = !nonlethalHpFloor && segments * perSegmentDamage >= shieldBefore + hpDamageLimit && hasDamageRevival(currentTarget) ? currentTarget : null;
          const reflectRatio = unitId(actor) !== unitId(target) ? counterDamageRatio(currentTarget) : 0;
          const reflection = reflectRatio > 0 ? { actor: overlay.readUnit(unitId(actor)), target: currentTarget, ratio: reflectRatio } : null;
          const requiredOutcomeKey = String(
            context?.requiredOutcomeKeyByTarget?.get(unitId(target)) || ''
          ).trim();
          const required = requiredOutcomeProfile(context, unitId(target));
          const outcomeAssignmentKey = String(
            context?.outcomeAssignmentKeyByTarget?.get(unitId(target)) || ''
          ).trim();
          const preserveHitOutcome = typeof context.damageOutcomeResolver === 'function' ||
            context.declaration?.skill?.副作用列表?.some?.(entry => String(entry?.触发时机 || '').trim() === '命中后') ||
            effect?.副作用列表?.some?.(entry => String(entry?.触发时机 || '').trim() === '命中后');
          let hpDamageLimits = null;
          if (!required.key && typeof context.damageOutcomeResolver !== 'function' &&
            ledger.entries.some(entry => (entry.targetId === unitId(target) || entry.targetId === unitId(actor)) && (
              (entry.evidence?.resourceChange && /生命|HP/i.test(entry.evidence.resource || '') &&
                Number(entry.evidence.applicationProbability) > 0 && Number(entry.evidence.applicationProbability) < 1) ||
              (entry.outcomeKind === 'HP_DELTA' && entry.evidence?.outcomeDistribution?.some(outcome =>
                Number(outcome.probability) > 0 && Number(outcome.probability) < 1)) ||
              (['属性修正', '判定修正', '结算修正', '状态施加'].includes(entry.evidence?.prototype) && Number(entry.evidence.applicationProbability) > 0 &&
                Number(entry.evidence.applicationProbability) < 1))) &&
            ledger.entries.every(entry => entry.windowId === 'ACTION_COST' ||
              (entry.evidence?.resourceChange && /生命|HP/i.test(entry.evidence.resource || '')) ||
              (entry.outcomeKind === 'HP_DELTA' && entry.evidence?.expectedDamage !== undefined) ||
              (entry.outcomeKind === 'SHIELD_DELTA' && entry.evidence?.absorbedDamage !== undefined) ||
              ['属性修正', '判定修正', '结算修正', '状态施加'].includes(entry.evidence?.prototype))) {
            const branches = resourcePrefixBranches(overlay, ledger, context);
            hpDamageLimits = branches?.map(branch => {
              const branchTarget = findUnit(branch.world, unitId(target));
              const branchActor = findUnit(branch.world, unitId(actor));
              const hpBefore = readHp(branchTarget);
              const branchResolvedMultiplier = typeof context?.damageMultiplierResolver === 'function'
                ? context.damageMultiplierResolver({ targetId: unitId(target), actor: branchActor, effect, effectInstanceId: context.effectInstanceId })
                : null;
              const branchReactionMultiplier = clamp(Number(branchResolvedMultiplier ??
                context?.damageMultiplierByTarget?.[unitId(target)] ?? context?.damageMultiplierByTarget?.get?.(unitId(target)) ?? 1), 0, 1);
              const branchBasis = buildDamageBasis(effect, branchActor, branchTarget, null, {
                basisView: context?.basisView || 'DECISION_VISIBLE',
                effectInstanceId: context.effectInstanceId, sourceEffectId: context.effectInstanceId,
                sourceActionId: context.rootActionId, snapshotRevision: context.snapshotRevision,
                actionDamageMultiplier: context?.actionDamageMultiplier, targetCount: targets.length,
                reactionDamageMultiplier: branchReactionMultiplier,
                resourceDriveEnabled: String(context?.declaration?.actionKind || '').trim().toUpperCase() !== 'BASIC_ATTACK',
              });
              const branchBaseHit = estimateHitProbability(branchActor, branchTarget, effect, null, context?.environmentContext || null);
              const branchResolvedHit = typeof context?.hitProbabilityResolver === 'function'
                ? context.hitProbabilityResolver({ targetId: unitId(target), actor: branchActor, effect,
                    effectInstanceId: context.effectInstanceId, baseHitProbability: branchBaseHit, recordDependency: recordPreviewDependency })
                : null;
              return { probability: branch.probability, hpBefore, shieldBefore: readShield(branchTarget),
                perSegmentDamage: calculateSettledSegmentDamage(branchBasis.operands.rawDamage, segments,
                  branchReactionMultiplier * environmentDamageMultiplier),
                hitProbability: clamp(branchResolvedHit !== null && branchResolvedHit !== undefined && Number.isFinite(Number(branchResolvedHit))
                  ? Number(branchResolvedHit) : branchBaseHit, 0, 1),
                hpDamageLimit: Math.max(0, hpBefore - nonlethalHpFloor), deathSaveCount: nonlethalHpFloor > 0 ? 0 : deathSaveCount(branchTarget), ruleBlockCount: ruleBlockCount(branchTarget),
                reviveTarget: !nonlethalHpFloor && hasDamageRevival(branchTarget) ? branchTarget : null,
                reflection: unitId(branchActor) !== unitId(branchTarget) && counterDamageRatio(branchTarget) > 0
                  ? { actor: branchActor, target: branchTarget, ratio: counterDamageRatio(branchTarget) } : null,
                assignments: Object.freeze({ ...branch.assignments }) };
            }) || null;
            if (hpDamageLimits) {
              metrics.resourceOutcomeDamagePrefixReplays += 1;
              metrics.resourceOutcomeDamagePrefixStates += hpDamageLimits.length;
            }
          }
          const damageExpectation = expectedSegmentedDamageOutcome({
            hpDamageLimits,
            reviveTarget,
            reflection,
            deathSaveCount: availableDeathSaves,
            ruleBlockCount: availableRuleBlocks,
            preserveHitOutcome,
            segments,
            perSegmentDamage,
            hitProbability,
            applicationProbability: applicationProbability * (1 - evadeProbability),
            shieldBefore,
            hpDamageLimit,
          });
          const conditionalDamageExpectation = expectedSegmentedDamageOutcome({
            hpDamageLimits,
            reviveTarget,
            reflection,
            deathSaveCount: availableDeathSaves,
            ruleBlockCount: availableRuleBlocks,
            preserveHitOutcome,
            segments,
            perSegmentDamage,
            hitProbability,
            applicationProbability: 1,
            shieldBefore,
            hpDamageLimit,
          });
          let incomingDamage = damageExpectation.expectedIncoming;
          const fullHitIncoming = damageExpectation.fullHitIncoming;
          let shieldAbsorb = 0;
          let expectedDamage = damageExpectation.expectedHpDamage;
          let expectedReviveHealing = Number(damageExpectation.expectedReviveHealing || 0);
          let expectedShieldAbsorb = damageExpectation.expectedShieldAbsorb;
          const fullHitDamage = damageExpectation.fullHitHpDamage;
          const activeRequiredValues = required.key && required.values.length
            ? required.values
            : [''];
          const activeProbabilityScale = required.key ? 1 : applicationProbability;
          let outcomeDistribution = [
            ...(required.key ? required.universe
              .filter(value => !required.values.includes(value))
              .map(value => ({
                branchKey: `required:${value.toLowerCase()}:inactive`,
                probability: 1,
                conditionalOn: { [required.key]: value },
                incoming: 0,
                shieldAbsorb: 0,
                hpDamage: 0,
                delta: 0,
                actionState: '',
              })) : []),
            ...(!required.key && applicationProbability < 1 - 1e-12 ? [{
              branchKey: 'application:inactive',
              probability: 1 - applicationProbability,
              incoming: 0,
              shieldAbsorb: 0,
              hpDamage: 0,
              delta: 0,
              ...(outcomeAssignmentKey
                ? { assignments: { [outcomeAssignmentKey]: 'MISS' } }
                : {}),
              actionState: '',
            }] : []),
            ...activeRequiredValues.flatMap(requiredValue => [
              ...(evadeProbability > 1e-12 ? [{
                branchKey: `damage:evaded${requiredValue ? `:${requiredValue}` : ''}`,
                probability: activeProbabilityScale * evadeProbability,
                ...(required.key
                  ? { conditionalOn: { [required.key]: requiredValue } }
                  : {}),
                incoming: 0,
                shieldAbsorb: 0,
                hpDamage: 0,
                delta: 0,
                ...(outcomeAssignmentKey
                  ? { assignments: { [outcomeAssignmentKey]: 'EVADED' } }
                  : {}),
                actionState: '',
              }] : []),
              ...conditionalDamageExpectation.outcomeDistribution.map(branch => {
              const branchNonlethalIncapacitated =
                nonlethalIntent &&
                nonlethalHpFloor <= 1 &&
                Number(branch.hpDamageLimit ?? hpDamageLimit) > 0 &&
                Number(branch.hpDamage || 0) >= Number(branch.hpDamageLimit ?? hpDamageLimit) - 1e-9;
              const branchTraumaUnconscious = shouldTriggerTraumaUnconscious(
                Number(branch.hpDamage || 0),
                Number(branch.hpBefore ?? readHp(currentTarget)) - Number(branch.hpDamage || 0),
                readHpMax(currentTarget),
              );
              const branchSucceeded = (branch.hitCounts || []).some(hitCount => Number(hitCount) > 0);
              return {
                ...branch,
                probability:
                  activeProbabilityScale *
                  Number(branch.probability || 0) *
                  (1 - evadeProbability),
                ...(required.key
                  ? { conditionalOn: { [required.key]: requiredValue } }
                  : {}),
                ...(outcomeAssignmentKey
                  ? {
                      assignments: {
                        [outcomeAssignmentKey]: branchSucceeded ? 'HIT' : 'MISS',
                      },
                    }
                  : {}),
                actionState: branchNonlethalIncapacitated
                  ? '失去战斗力'
                  : branchTraumaUnconscious
                    ? '昏迷'
                    : '',
              };
              }),
            ]),
          ];
          if (hpDamageLimits) {
            outcomeDistribution = outcomeDistribution.flatMap(outcome => Number.isFinite(outcome.hpBefore)
              ? [outcome]
              : hpDamageLimits.map((limit, index) => ({
                  ...outcome, branchKey: 'resource-prefix:' + index + ':' + outcome.branchKey,
                  probability: limit.probability * outcome.probability,
                  hpBefore: limit.hpBefore, hpDamageLimit: limit.hpDamageLimit,
                  priorResourceAssignments: limit.assignments,
                })));
          }
          if (typeof context.damageOutcomeResolver === 'function') {
            const primaryOutcome = context.primaryOutcomeByTarget?.get(unitId(target));
            const choices = outcomeDistribution.filter(branch => !required.key || !branch.conditionalOn || branch.conditionalOn[required.key] === primaryOutcome);
            const index = context.damageOutcomeResolver({ effectInstanceId: context.effectInstanceId, targetId: unitId(target), outcomes: choices });
            if (!Number.isInteger(index) || !choices[index]) throw Error('BATTLE_PREVIEW_DAMAGE_OUTCOME_INVALID');
            const selected = choices[index];
            incomingDamage = selected.incoming;
            expectedDamage = selected.hpDamage;
            expectedReviveHealing = Number(selected.reviveHealing || 0);
            expectedShieldAbsorb = selected.shieldAbsorb;
            outcomeDistribution = [{ ...selected, probability: 1 }];
          }
          overlay.changeUnit(unitId(target), unit => {
            shieldAbsorb = absorbPreviewShield(unit, expectedShieldAbsorb);
            const consumed = typeof context.damageOutcomeResolver === 'function' ? Number(outcomeDistribution[0]?.deathSaveConsumed || 0) : Number(damageExpectation.expectedDeathSaveConsumed || 0);
            if (consumed > 0) consumeDeathSaveCharges(unit, consumed);
            const blocked = typeof context.damageOutcomeResolver === 'function' ? Number(outcomeDistribution[0]?.ruleBlockConsumed || 0) : Number(damageExpectation.expectedRuleBlockConsumed || 0);
            if (blocked > 0) consumeRuleBlockCharges(unit, blocked);
            applyDamageRevivalOutcomes(unit, typeof context.damageOutcomeResolver === 'function' ? outcomeDistribution : damageExpectation.outcomeDistribution);
            setHp(unit, readHp(unit) - expectedDamage + expectedReviveHealing);
          });
          const resolvedDamageOutcomes = typeof context.damageOutcomeResolver === 'function' ? outcomeDistribution : damageExpectation.outcomeDistribution;
          if (resolvedDamageOutcomes.some(row => row.reflection)) {
            const sourceBefore = overlay.readUnit(unitId(actor));
            const reflectedDamage = resolvedDamageOutcomes.reduce((sum, row) => sum + row.probability * Number(row.reflection?.hpDamage || 0), 0);
            const reflectedHealing = resolvedDamageOutcomes.reduce((sum, row) => sum + row.probability * Number(row.reflection?.reviveHealing || 0), 0);
            overlay.changeUnit(unitId(actor), unit => {
              applyDamageRevivalOutcomes(unit, resolvedDamageOutcomes.map(row => ({ probability: row.probability, revival: row.reflection?.revival })));
              setHp(unit, readHp(unit) - reflectedDamage + reflectedHealing);
            });
            ledger.addOutcome({ ...context, actor: overlay.readUnit(unitId(target)), targetId: unitId(actor), effectInstanceId: `${context.effectInstanceId}:reflection`,
              outcomeKind: 'HP_DELTA', threatValue: reflectedDamage / readHpMax(sourceBefore) * 100,
              evidence: { prototype: '结算修正', reflectedFrom: unitId(target), sourceDamageEffectId: context.effectInstanceId,
                expectedDamage: reflectedDamage, reviveHealing: reflectedHealing, applicationProbability,
                current: readHp(sourceBefore), next: readHp(sourceBefore) - reflectedDamage + reflectedHealing,
                delta: -reflectedDamage + reflectedHealing, marginal: false } });
          }
          const traumaBranches = (typeof context.damageOutcomeResolver === 'function'
            ? outcomeDistribution
            : damageExpectation.outcomeDistribution).filter(
              branch => shouldTriggerTraumaUnconscious(
                Number(branch.hpDamage || 0),
                Number(branch.hpBefore ?? readHp(currentTarget)) - Number(branch.hpDamage || 0),
                readHpMax(currentTarget),
              ),
            );
          const traumaProbability = traumaBranches.reduce(
            (sum, branch) => sum + Number(branch.probability || 0),
            0,
          );
          const traumaUnconscious = traumaProbability > 1e-9;
          const deterministicTrauma = traumaProbability >= 1 - 1e-9;
          const expectedHitProbability = hpDamageLimits
            ? hpDamageLimits.reduce((sum, branch) => sum + branch.probability * branch.hitProbability, 0)
            : hitProbability;
          const nonlethalIncapacitated = nonlethalIntent && nonlethalHpFloor <= 1 && hpDamageLimit > 0 && expectedDamage >= hpDamageLimit - 1e-9;
          if (nonlethalIncapacitated || deterministicTrauma) {
            overlay.changeUnit(unitId(target), unit => {
              if (nonlethalIncapacitated) unit.__战斗失能原因 = 'INCAPACITATED';
              if (deterministicTrauma) unit.__战斗失能原因 = 'UNCONSCIOUS';
            });
          }
          if (shieldAbsorb > 0) {
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'SHIELD_DELTA',
            threatValue: shieldAbsorb / readHpMax(currentTarget) * 100,
            evidence: {
              current: shieldBefore,
              next: Math.max(0, shieldBefore - shieldAbsorb),
              delta: -shieldAbsorb,
              absorbedDamage: shieldAbsorb,
            },
          });
          }
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'HP_DELTA',
            threatValue: expectedDamage / readHpMax(currentTarget) * 100,
            evidence: {
              rawDamage,
              hitProbability: expectedHitProbability,
              applicationProbability,
              evadeProbability,
              reactionDamageMultiplier,
              ...(environmentDamageMultiplier < 1 - 1e-9
                ? {
                    environmentAdaptationReduction: 1 - environmentDamageMultiplier,
                  }
                : {}),
              perSegmentDamage,
              incomingDamage,
              shieldAbsorb,
              expectedDamage,
              ...(expectedReviveHealing > 0 ? { reviveHealing: expectedReviveHealing } : {}),
              fullHitIncoming: damageExpectation.fullHitIncoming,
              fullHitShieldAbsorb: damageExpectation.fullHitShieldAbsorb,
              fullHitDamage,
              damageBasis: damageBasisEvidence,
              outcomeDistribution: Object.freeze(outcomeDistribution.map(Object.freeze)),
              distributionGroupKey: String(
                outcomeAssignmentKey ||
                [
                  context.rootActionId,
                  context.effectInstanceId,
                  context.windowId,
                  unitId(target),
                ].join('|')
              ).trim(),
              delta: -expectedDamage + expectedReviveHealing,
              current: readHp(currentTarget),
              next: Math.max(0, readHp(currentTarget) - expectedDamage + expectedReviveHealing),
              damageType: effect?.伤害类型 || '',
            },
          });
          // N-07：证据必须带 hitProbability——预测行的 hitProbability 取自
          // evidence?.hitProbability ?? 1，缺失时按确定性(=1)发射，而运行时的
          // 昏迷/失能只在实际命中才发生，对账被结构性打成 UNCONFIRMED。
          if (nonlethalIncapacitated) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'NONLETHAL_INCAPACITATION',
              threatValue: 0,
              evidence: { reason: 'NONLETHAL_INCAPACITATION', hpFloor: nonlethalHpFloor, hitProbability },
            });
          }
          if (traumaUnconscious) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'TRAUMA_UNCONSCIOUS',
              threatValue: traumaProbability * 100,
              evidence: {
                reason: 'TRAUMA_UNCONSCIOUS',
                probability: traumaProbability,
                traumaProbability,
                hitProbability,
                fullHitDamage,
                hpAfter: readHp(currentTarget) - fullHitDamage,
                hpMax: readHpMax(currentTarget),
                distributionGroupKey: String(
                  outcomeAssignmentKey ||
                  [
                    context.rootActionId,
                    context.effectInstanceId,
                    context.windowId,
                    unitId(target),
                  ].join('|')
                ).trim(),
                traumaBranchKeys: Object.freeze(
                  traumaBranches.map(branch => String(branch.branchKey || '').trim()),
                ),
              },
            });
          }
        });
        return;
      }
      if (prototype === '资源变化') {
        targets.forEach(target => resourceOutcome(effect, target, overlay, ledger, context));
        return;
      }
      if (prototype === '资源转移') {
        const resource = String(effect?.资源 || '魂力').trim();
        const mode = String(effect?.资源转移方式 || '转移').trim();
        const parsedConversionRatio = Number(effect?.转化比例 ?? 1);
        const conversionRatio = clamp(Number.isFinite(parsedConversionRatio) ? parsedConversionRatio : 1, 0, 2);
        const actorId = unitId(actor);
        const registerFlow = (hostId, probabilityTargetId, probabilityProfile, transferGroupKey, participantIds = null) => {
          const duration = Number(effect.持续回合 || 0);
          if (!(duration > 0) || !(probabilityProfile.applicationProbability > 0)) return;
          const sourceActionId = String(context.declaration?.__structuredSourceActionId || context.rootActionId || '');
          const sourceEffectId = String(context.declaration?.__structuredSourceEffectId || context.effectInstanceId || '');
          const stateId = `资源流转:${stableHash([sourceActionId, sourceEffectId, hostId]).slice(0, 20)}`;
          const stateKey = `preview:${context.effectInstanceId}:${stateId}`;
          const record = { 状态ID: stateId, 状态: `${resource}${mode}`, 状态名称: `${resource}${mode}`, 原型: '资源转移',
            类型: mode === '吞噬' ? 'debuff' : mode === '均分' ? 'neutral' : 'buff', duration, __本回合新附加: true,
            来源角色: actorId, 目标角色: probabilityTargetId, 来源动作ID: sourceActionId, 来源效果ID: sourceEffectId,
            来源技能: String(context.declaration?.skill?.魂技名 || context.declaration?.skill?.name || '资源流转'),
            持续原型效果: { 原型: '资源转移', 资源: resource, 资源转移方式: mode, 数值: effect.数值,
              ...(mode === '均分' ? {} : { 转化比例: conversionRatio }) }, 战斗效果: {},
            ...(participantIds ? { 持续目标列表: participantIds } : {}),
            ...(probabilityProfile.applicationProbability < 1 ? { __previewApplicationProbability: probabilityProfile.applicationProbability } : {}),
          };
          overlay.changeUnit(hostId, unit => { unit.状态效果 = { ...(unit.状态效果 || {}), [stateKey]: record }; });
          const probabilityGroupKey = [context.rootActionId, context.effectInstanceId, context.windowId, transferGroupKey].join('|');
          ledger.addOutcome({ ...context, targetId: hostId, effectInstanceId: `${context.effectInstanceId}:flow:${hostId}`,
            outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: { prototype: '资源转移', persistentTransfer: true, probabilityTargetId,
              state: record.状态, stateEntries: { [stateKey]: cloneValue(record) }, duration,
              applicationProbability: probabilityProfile.applicationProbability, ownApplicationProbability: probabilityProfile.ownApplicationProbability,
              ...outcomeDependencyEvidence(context, probabilityTargetId), probabilityGroupKey,
              distributionGroupKey: context.outcomeAssignmentKeyByTarget?.get(probabilityTargetId) || probabilityGroupKey,
              ...(context.outcomeAssignmentKeyByTarget?.has(probabilityTargetId) ? {
                outcomeDistribution: conditionalDeterministicOutcomeDistribution(context, probabilityTargetId, 0, probabilityProfile.applicationProbability, probabilityGroupKey),
              } : {}),
            },
          });
        };
        const addOutcome = ({
          target, targetIndex, role, before, next, realizedDelta,
          probabilityProfile, transferSourceId = '', transferReceiverId = '',
          transferGroupKey = '', probabilityTargetId = unitId(target),
          requestedAmount = 0, sourcePaid = 0, convertedAmount = 0,
          receiverGain = 0, overflowLoss = 0, poolTotalBefore = null,
          poolTotalAfter = null,
        }) => {
          const targetId = unitId(target);
          const probabilityGroupKey = [
            context.rootActionId,
            context.effectInstanceId,
            context.windowId,
            transferGroupKey,
          ].join('|');
          ledger.addOutcome({
            ...context,
            targetId,
            effectInstanceId: `${context.effectInstanceId}:${targetIndex}:${role}`,
            outcomeKind: 'RESOURCE_OPTION_CHANGED',
            threatValue: 0,
            evidence: {
              resource,
              mode,
              transferRole: role,
              transferSourceId,
              transferReceiverId,
              transferGroupKey,
              ...(context.outcomeAssignmentKeyByTarget?.has(probabilityTargetId) ? {
                outcomeDistribution: conditionalDeterministicOutcomeDistribution(context, probabilityTargetId, realizedDelta, probabilityProfile.applicationProbability, probabilityGroupKey),
              } : {}),
              requestedAmount,
              sourcePaid,
              conversionRatio: mode === '均分' ? null : conversionRatio,
              convertedAmount,
              receiverGain,
              overflowLoss,
              ...(poolTotalBefore === null ? {} : { poolTotalBefore }),
              ...(poolTotalAfter === null ? {} : { poolTotalAfter }),
              before,
              after: next,
              delta: next - before,
              realizedDelta,
              applicationProbability: probabilityProfile.applicationProbability,
              ownApplicationProbability: probabilityProfile.ownApplicationProbability,
              ...outcomeDependencyEvidence(context, probabilityTargetId),
              probabilityGroupKey,
              distributionGroupKey: String(
                context?.outcomeAssignmentKeyByTarget?.get?.(probabilityTargetId) ||
                probabilityGroupKey
              ).trim(),
            },
          });
        };
        if (mode === '均分') {
          const participants = [...new Map([actor, ...targets]
            .map(target => [unitId(target), overlay.readUnit(unitId(target))])
            .filter(([id, target]) => id && target)).values()];
          if (participants.length < 2) return;
          const strength = clamp(
            Math.abs(parseSignedValue(effect?.数值 ?? '100%', 1)),
            0,
            1,
          );
          const poolTotalBefore = participants.reduce(
            (sum, target) => sum + readResource(target, resource),
            0,
          );
          const average = poolTotalBefore / participants.length;
          const probabilityTargetId = unitId(targets[0]);
          const probabilityProfile = effectProbabilityProfile(context, probabilityTargetId, effect);
          const settlements = participants.map((target, targetIndex) => {
            const before = readResource(target, resource);
            const desiredNumerator = before * participants.length * (1 - strength) + poolTotalBefore * strength;
            const desiredNext = strength === 1 ? average : desiredNumerator / participants.length;
            const rawNext = clamp(
              desiredNext,
              0,
              readResourceMax(target, resource),
            );
            const realizedNext = Math.floor(rawNext);
            return { target, targetIndex, before, rawNext, realizedNext, clipped: desiredNext > rawNext,
              fraction: desiredNext > rawNext ? rawNext - realizedNext : (desiredNumerator % participants.length) / participants.length, probabilityProfile };
          });
          const retainedTotal = settlements.some(row => row.clipped)
            ? settlements.reduce((sum, row) => sum + row.rawNext, 0) : poolTotalBefore;
          let remainder = Math.max(0, Math.floor(retainedTotal) - settlements.reduce((sum, row) => sum + row.realizedNext, 0));
          settlements.filter(row => row.realizedNext < readResourceMax(row.target, resource))
            .sort((left, right) => right.fraction - left.fraction || left.targetIndex - right.targetIndex)
            .forEach(row => {
              if (remainder <= 0) return;
              row.realizedNext += 1;
              remainder -= 1;
            });
          settlements.forEach(row => {
            row.realizedDelta = row.realizedNext - row.before;
            row.next = row.before + row.realizedDelta * probabilityProfile.applicationProbability;
          });
          const poolTotalAfter = settlements.reduce((sum, row) => sum + row.next, 0);
          settlements.forEach(row => {
            overlay.setResource(unitId(row.target), resource, row.next);
            addOutcome({
              ...row,
              role: 'POOL_MEMBER',
              probabilityTargetId,
              transferGroupKey: `${context.effectInstanceId}:POOL`,
              poolTotalBefore,
              poolTotalAfter,
              overflowLoss: Math.max(0, poolTotalBefore - poolTotalAfter),
            });
          });
          registerFlow(actorId, probabilityTargetId, probabilityProfile, `${context.effectInstanceId}:POOL`, participants.map(unitId));
          return;
        }
        const transferTargets = targets.filter(target => unitId(target) && unitId(target) !== actorId).map(target => {
          const targetId = unitId(target);
          const probabilityProfile = effectProbabilityProfile(context, targetId, effect);
          return { target, probabilityProfile,
            inheritedProbability: context.conditionalPlanResolved || probabilityProfile.required.key ? probabilityProfile.inheritedProbability : 1,
            conditionKey: JSON.stringify(outcomeDependencyEvidence(context, targetId)),
          };
        });
        let actorBalances = transferTargets.length > 1 && transferTargets.some(row => row.probabilityProfile.applicationProbability > 0 && row.probabilityProfile.applicationProbability < 1) &&
          transferTargets.every(row => row.conditionKey === transferTargets[0].conditionKey && row.inheritedProbability === transferTargets[0].inheritedProbability)
          ? new Map([[readResource(overlay.readUnit(actorId), resource), 1]]) : null;
        transferTargets.forEach(({ target: amountTarget, probabilityProfile }, targetIndex) => {
          const targetId = unitId(amountTarget);
          if (!targetId || targetId === actorId) return;
          const currentActor = overlay.readUnit(actorId);
          const currentTarget = overlay.readUnit(targetId);
          if (!currentActor || !currentTarget) return;
          const applicationProbability = probabilityProfile.applicationProbability;
          const requestedAmount = Math.abs(parseSignedValue(
            effect?.数值,
            readResourceMax(currentTarget, resource),
          ));
          const source = mode === '吞噬' ? currentTarget : currentActor;
          const receiver = mode === '吞噬' ? currentActor : currentTarget;
          const sourceBefore = readResource(source, resource);
          const receiverBefore = readResource(receiver, resource);
          let sourcePaid = Math.min(requestedAmount, sourceBefore);
          let receiverGain = Math.min(
            sourcePaid * conversionRatio,
            Math.max(0, readResourceMax(receiver, resource) - receiverBefore),
          );
          if (actorBalances) {
            const nextBalances = new Map();
            sourcePaid = 0;
            receiverGain = 0;
            actorBalances.forEach((probability, balance) => {
              const paid = Math.min(requestedAmount, mode === '吞噬' ? sourceBefore : balance);
              const gain = Math.min(paid * conversionRatio, Math.max(0, readResourceMax(receiver, resource) - (mode === '吞噬' ? balance : receiverBefore)));
              sourcePaid += paid * probability;
              receiverGain += gain * probability;
              const next = mode === '吞噬' ? balance + gain : balance - paid;
              const success = probability * probabilityProfile.ownApplicationProbability;
              const failure = probability - success;
              if (failure > 0) nextBalances.set(balance, (nextBalances.get(balance) || 0) + failure);
              if (success > 0) nextBalances.set(next, (nextBalances.get(next) || 0) + success);
            });
            actorBalances = nextBalances;
          }
          const convertedAmount = sourcePaid * conversionRatio;
          const sourceRealizedDelta = -sourcePaid;
          const receiverRealizedDelta = receiverGain;
          const sourceNext = sourceBefore + sourceRealizedDelta * applicationProbability;
          const receiverNext = receiverBefore + receiverRealizedDelta * applicationProbability;
          overlay.setResource(unitId(source), resource, sourceNext);
          overlay.setResource(unitId(receiver), resource, receiverNext);
          const common = {
            targetIndex,
            probabilityProfile,
            probabilityTargetId: targetId,
            transferSourceId: unitId(source),
            transferReceiverId: unitId(receiver),
            transferGroupKey: `${context.effectInstanceId}:${targetIndex}`,
            requestedAmount,
            sourcePaid,
            convertedAmount,
            receiverGain,
            overflowLoss: Math.max(0, convertedAmount - receiverGain),
          };
          addOutcome({
            ...common,
            target: source,
            role: 'SOURCE',
            before: sourceBefore,
            next: sourceNext,
            realizedDelta: sourceRealizedDelta,
          });
          addOutcome({
            ...common,
            target: receiver,
            role: 'RECEIVER',
            before: receiverBefore,
            next: receiverNext,
            realizedDelta: receiverRealizedDelta,
          });
          registerFlow(targetId, targetId, probabilityProfile, common.transferGroupKey);
        });
        return;
      }
      if (prototype === '护盾变化') {
        targets.forEach(target => {
          const currentTarget = overlay.readUnit(unitId(target));
          const current = readShield(currentTarget);
          const mode = String(effect?.护盾模式 || '正向护盾').trim();
          const probabilityProfile = effectProbabilityProfile(
            context,
            unitId(target),
            effect,
          );
          const applicationProbability =
            probabilityProfile.applicationProbability;
          const realizedRequested = Math.abs(
            parseSignedValue(effect?.数值, mode === '正向护盾' ? readHpMax(currentTarget) : current)
          );
          const realizedDelta = mode === '正向护盾'
            ? calculateShieldGain(currentTarget, realizedRequested)
            : -Math.min(current, Math.floor(realizedRequested));
          const delta = realizedDelta * applicationProbability;
          const next = Math.max(0, current + delta);
          overlay.changeUnit(unitId(target), unit => {
            applyProjectedShieldDelta(unit, delta, context.effectInstanceId, Math.max(1, Number(effect?.持续回合 || 1)));
          });
          if (
            mode === '窃盾' &&
            unitId(currentTarget) !== unitId(actor) &&
            realizedDelta < -1e-12
          ) {
            const currentActor = overlay.readUnit(unitId(actor));
            const actorShieldBefore = readShield(currentActor);
            const realizedStolen = calculateShieldGain(currentActor, -realizedDelta);
            const stolen = realizedStolen * applicationProbability;
            overlay.changeUnit(unitId(actor), unit => {
              applyProjectedShieldDelta(unit, stolen, `${context.effectInstanceId}:stolen:${unitId(target)}`, Math.max(1, Number(effect?.持续回合 || 1)));
            });
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:stolen:${unitId(target)}`,
              targetId: unitId(actor),
              outcomeKind: 'SHIELD_DELTA',
              threatValue: stolen / readHpMax(actor) * 100,
              evidence: {
                mode,
                current: actorShieldBefore,
                next: actorShieldBefore + stolen,
                delta: stolen,
                realizedDelta: realizedStolen,
                stolenFrom: unitId(currentTarget),
                ...(context.outcomeAssignmentKeyByTarget?.has(unitId(target)) ? {
                  distributionGroupKey: context.outcomeAssignmentKeyByTarget.get(unitId(target)),
                  outcomeDistribution: conditionalDeterministicOutcomeDistribution(context, unitId(target), realizedStolen, applicationProbability),
                } : {}),
                applicationProbability,
                ownApplicationProbability:
                  probabilityProfile.ownApplicationProbability,
                ...outcomeDependencyEvidence(context, unitId(target)),
                probabilityGroupKey: [
                  context.rootActionId,
                  context.effectInstanceId,
                  context.windowId,
                  unitId(target),
                ].join('|'),
              },
            });
          }
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind: 'SHIELD_DELTA',
            threatValue: delta / readHpMax(currentTarget) * 100,
            evidence: {
              mode,
              current,
              next,
              delta,
              realizedDelta,
              shieldSettlement: { rawValue: effect?.数值, mode, receiverId: mode === '窃盾' && unitId(target) !== unitId(actor) ? unitId(actor) : '' },
              ...(context.outcomeAssignmentKeyByTarget?.has(unitId(target)) ? {
                distributionGroupKey: context.outcomeAssignmentKeyByTarget.get(unitId(target)),
                outcomeDistribution: conditionalDeterministicOutcomeDistribution(context, unitId(target), realizedDelta, applicationProbability),
              } : {}),
              duration: Math.max(1, Number(effect?.持续回合 || 1)),
              applicationProbability,
              ownApplicationProbability:
                probabilityProfile.ownApplicationProbability,
              ...outcomeDependencyEvidence(context, unitId(target)),
              probabilityGroupKey: [
                context.rootActionId,
                context.effectInstanceId,
                context.windowId,
                unitId(target),
              ].join('|'),
            },
          });
        });
        return;
      }
      if (prototype === '属性修正') {
        targets.forEach(target => {
          const probabilityProfile = effectProbabilityProfile(
            context,
            unitId(target),
            effect,
          );
          const applicationProbability =
            probabilityProfile.applicationProbability;
          if (applicationProbability <= 1e-12) return;
          const scaledEffect = applicationProbability >= 1 - 1e-12
            ? effect
            : {
                ...effect,
                数值: typeof effect?.数值 === 'string' && effect.数值.includes('%')
                  ? `${(Number.parseFloat(effect.数值) || 0) * applicationProbability}%`
                  : (Number(effect?.数值 || 0) * applicationProbability),
                __previewApplicationProbability: applicationProbability,
              };
          let evidence;
          overlay.changeUnit(unitId(target), unit => {
            const existing = findStateEntry(unit, scaledEffect);
            const previousDuration = existing
              ? Math.max(0, Number(existing[1]?.duration ?? existing[1]?.持续回合 ?? 0))
              : 0;
            const requestedDuration = Math.max(1, Number(scaledEffect?.持续回合 || 1));
            const marginal = addState(unit, scaledEffect, context.effectInstanceId);
            evidence = existing
              ? {
                  ...buildEffectEvidence(scaledEffect, prototype, deriveStateCombatEffect(scaledEffect), {
                    attribute: Array.isArray(scaledEffect?.属性)
                      ? scaledEffect.属性.map(value => String(value || '').trim()).filter(Boolean).join('、')
                      : String(scaledEffect?.属性 || '').trim(),
                    applicationProbability,
                    ownApplicationProbability:
                      probabilityProfile.ownApplicationProbability,
                    ...outcomeDependencyEvidence(context, unitId(target)),
                    projectedEffect: cloneValue(effect),
                    marginal,
                    refreshed: marginal,
                    previousDuration,
                    durationGain: marginal
                      ? Math.max(0, requestedDuration - previousDuration)
                      : 0,
                    changes: [],
                  }),
                }
              : {
                  ...buildEffectEvidence(
                    scaledEffect,
                    prototype,
                    deriveStateCombatEffect(scaledEffect),
                  ),
                  ...applyStatModifier(unit, scaledEffect),
                  applicationProbability,
                  ownApplicationProbability:
                    probabilityProfile.ownApplicationProbability,
                  ...outcomeDependencyEvidence(context, unitId(target)),
                  projectedEffect: cloneValue(effect),
                  marginal,
                };
          });
          const primaryOutcomeKey = context.outcomeAssignmentKeyByTarget?.get(unitId(target));
          if (primaryOutcomeKey) {
            const probability = evidence.marginal === false ? 0 : applicationProbability;
            evidence.distributionGroupKey = primaryOutcomeKey;
            evidence.outcomeDistribution = [
              ...(probability > 1e-12 ? [{ probability, branchKey: 'primary:HIT', assignments: { [primaryOutcomeKey]: 'HIT' } }] : []),
              ...(probability < 1 - 1e-12 ? [{ probability: 1 - probability, branchKey: 'primary:MISS', assignments: { [primaryOutcomeKey]: 'MISS' } }] : []),
            ];
          }
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED', threatValue: 0, evidence });
          const capacityResources = (evidence?.changes || []).map(change =>
            ({ 魂力上限: '魂力', 精神力上限: '精神力', 体力上限: '体力' })[change.attribute]).filter(Boolean);
          if (capacityResources.length && ledger.entries.some(entry => entry.targetId === unitId(target) &&
            Number(entry.evidence?.applicationProbability) > 0 && Number(entry.evidence?.applicationProbability) < 1)) {
            const branches = resourcePrefixBranches(overlay, ledger, context);
            if (branches) {
              overlay.changeUnit(unitId(target), unit => {
                for (const resource of capacityResources) {
                  const mean = branches.reduce((sum, branch) => sum + branch.probability *
                    readResource(findUnit(branch.world, unitId(target)), resource), 0);
                  setResourceValue(unit, resource, mean);
                }
              });
            }
          }
        });
        return;
      }
      if (['判定修正', '结算修正', '状态施加', '资源锁定', '位移执行', '决策干扰'].includes(prototype)) {
        targets.forEach(target => {
          const delay = Math.max(0, Number(effect?.延迟回合 || 0));
          if (prototype === '状态施加' && delay > 0) {
            const scheduledRound = Math.max(0, Number(context?.worldSnapshot?.回合 || 0)) + delay;
            overlay.schedule({
              type: 'DELAYED_STATE',
              actorId: unitId(actor),
              targetId: unitId(target),
              sourceActionId: String(context?.rootActionId || '').trim(),
              effectInstanceId: String(context?.effectInstanceId || '').trim(),
              effect: cloneValue(effect),
              delay,
              scheduledRound,
            });
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'STATE_SCHEDULED',
              threatValue: 0,
              evidence: {
                state: effect?.状态 || '',
                delay,
                scheduledRound,
              },
            });
            return;
          }
          const inheritedApplicationProbability = Number(
            context?.applicationProbabilityByTarget?.get(unitId(target)) ??
            context?.applicationProbability ??
            1
          );
          const currentStateTarget = overlay.readUnit(unitId(target));
          const stateImmune = prototype === '状态施加' &&
            statePolarity(effect) < 0 &&
            stateEntries(currentStateTarget, 'CONDITION').some(([, state]) => state?.战斗效果?.无视异常 === true);
          const hasOwnApplicationProbability =
            effect?.成功率 !== undefined ||
            effect?.触发概率 !== undefined;
          const baseApplicationProbability = (hasOwnApplicationProbability
            ? normalizeEffectProbability(
                effect?.成功率 ?? effect?.触发概率,
                1,
              )
            : 1) * stateApplicationProbabilityMultiplier(currentStateTarget, effect);
          const resolvedApplicationProbability =
            typeof context?.applicationProbabilityResolver === 'function'
            ? context.applicationProbabilityResolver({
                targetId: unitId(target),
                actor,
                effect,
                effectInstanceId: context.effectInstanceId,
                baseApplicationProbability,
                recordDependency: recordPreviewDependency,
              })
            : baseApplicationProbability;
          const applicationProbability = clamp(
            inheritedApplicationProbability * (
              Number.isFinite(Number(resolvedApplicationProbability))
                ? Number(resolvedApplicationProbability)
                : baseApplicationProbability
            ),
            0,
            1,
          );
          const ownApplicationProbability = clamp(
            Number.isFinite(Number(resolvedApplicationProbability))
              ? Number(resolvedApplicationProbability)
              : baseApplicationProbability,
            0,
            1,
          );
          const forcedProbability = forcedApplicationProbability(
            context,
            context.effectInstanceId,
            unitId(target),
          );
          const effectiveApplicationProbability =
            stateImmune ? 0 : forcedProbability === null
              ? applicationProbability
              : forcedProbability;
          const effectiveOwnApplicationProbability =
            stateImmune ? 0 : forcedProbability === null
              ? ownApplicationProbability
              : forcedProbability;
          const required = requiredOutcomeProfile(context, unitId(target));
          const stateApplicationOutcomeKey = String(
            context?.outcomeAssignmentKeyByTarget?.get(unitId(target)) ||
            [
              context.rootActionId,
              context.effectInstanceId,
              unitId(target),
              'state-application',
            ].join('|')
          ).trim();
          const requiredAssignments = context?.requiredOutcomeAssignmentsByTarget?.get(unitId(target)) || (
            required.key ? required.universe.map(value => ({
              conditionalOn: { [required.key]: value },
              enabled: required.values.includes(value),
              suffix: value,
            })) : []
          );
          const stateOutcomeDistribution = Object.freeze([
            ...requiredAssignments
              .filter(row => !row.enabled)
              .map(row => Object.freeze({
                branchKey: `required:${row.suffix.toLowerCase()}:inactive`,
                probability: 1,
                conditionalOn: row.conditionalOn,
                assignments: { [stateApplicationOutcomeKey]: 'RESISTED' },
              })),
            ...(requiredAssignments.length ? requiredAssignments.filter(row => row.enabled) : [{ suffix: '' }])
              .flatMap(row => [
                ...(effectiveOwnApplicationProbability < 1 - 1e-12 ? [Object.freeze({
                  branchKey: `state:resisted${row.suffix ? `:${row.suffix}` : ''}`,
                  probability: 1 - effectiveOwnApplicationProbability,
                  ...(row.conditionalOn
                    ? { conditionalOn: row.conditionalOn }
                    : {}),
                  assignments: { [stateApplicationOutcomeKey]: 'RESISTED' },
                })] : []),
                ...(effectiveOwnApplicationProbability > 1e-12 ? [Object.freeze({
                  branchKey: `state:hit${row.suffix ? `:${row.suffix}` : ''}`,
                  probability: effectiveOwnApplicationProbability,
                  ...(row.conditionalOn
                    ? { conditionalOn: row.conditionalOn }
                    : {}),
                  assignments: { [stateApplicationOutcomeKey]: 'HIT' },
                })] : []),
              ]),
          ]);
          const state = String(effect?.状态 || '').trim();
          if (prototype === '状态施加' && /护盾|屏障|结界/.test(state)) {
            const currentTarget = overlay.readUnit(unitId(target));
            const current = readShield(currentTarget);
            let delta = 0;
            overlay.changeUnit(unitId(target), unit => {
              delta = applyPreviewShield(
                unit,
                Math.max(0, parseSignedValue(effect?.数值, readHpMax(unit))) * effectiveApplicationProbability,
                Math.max(1, Number(effect?.持续回合 || 1)),
                context.effectInstanceId,
                state,
                effect?.数值 ?? '',
              );
            });
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'SHIELD_DELTA',
              threatValue: delta / readHpMax(currentTarget) * 100,
              evidence: {
                prototype,
                state,
                current,
                next: current + delta,
                delta,
                duration: Math.max(1, Number(effect?.持续回合 || 1)),
                applicationProbability: effectiveApplicationProbability,
              },
            });
            return;
          }
          const currentTarget = overlay.readUnit(unitId(target));
          const existingStateEntry = findStateEntry(currentTarget, effect);
          const existingState = existingStateEntry?.[1] || null;
          let marginal = false;
          const replacedStates = [];
          overlay.changeUnit(unitId(target), unit => {
            marginal = addState(unit, {
              ...effect,
              来源角色: unitName(context?.actor || {}),
              __previewApplicationProbability: effectiveApplicationProbability,
            }, context.effectInstanceId, (key, state) => replacedStates.push([key, state]));
          });
          const combatEffect = deriveStateCombatEffect(effect);
          const cancelsAction = marginal && (combatEffect?.skip_turn === true || combatEffect?.cannot_act === true);
          const outcomeKind = cancelsAction ? 'ACTION_CANCELLED' : prototype === '状态施加' ? 'STATE_CHANGED' : 'NEXT_ACTION_QUALITY_CHANGED';
          const effectEvidence = {
            ...(prototype === '位移执行'
              ? buildPositionEvidence(effect, combatEffect)
              : buildEffectEvidence(effect, prototype, combatEffect)),
            ...(prototype === '资源锁定' ? {
              lockType: String(effect?.锁定类型 || '').trim(),
              lockedRatio: clamp(Math.abs(parseSignedValue(effect?.数值, 1)), 0, 1),
            } : {}),
            ...(['位移执行', '判定修正', '结算修正', '状态施加', '决策干扰'].includes(prototype) ? { projectedEffect: cloneValue(effect) } : {}),
            ...(prototype === '决策干扰' ? { interference: effect?.干扰 || '' } : {}),
            applicationProbability: effectiveApplicationProbability,
            ownApplicationProbability: effectiveOwnApplicationProbability,
            ...outcomeDependencyEvidence(context, unitId(target)),
            cancelsAction,
            marginal,
            outcomeDistribution: marginal ? stateOutcomeDistribution : Object.freeze(stateOutcomeDistribution.map(branch =>
              branch.assignments?.[stateApplicationOutcomeKey] === 'HIT'
                ? Object.freeze({ ...branch, assignments: { ...branch.assignments, [stateApplicationOutcomeKey]: 'MISS' } })
                : branch)),
            distributionGroupKey: stateApplicationOutcomeKey,
          };
          ledger.addOutcome({
            ...context,
            targetId: unitId(target),
            outcomeKind,
            threatValue: 0,
            evidence: effectEvidence,
          });
          if (prototype === '状态施加') {
            const possible = findStateEntry(target, effect);
            projectStateEndRisks(target, replacedStates, possible ? [possible] : [], overlay, ledger, context, effectiveApplicationProbability);
          }
          if (prototype === '决策干扰' && marginal && effectiveApplicationProbability > 0) overlay.schedule({
            type: 'BELIEF_INTERFERENCE', targetId: unitId(target), interference: effect?.干扰 || '',
            value: effect?.数值 || '', duration: Math.max(1, Number(effect?.持续回合 || 1)),
            applicationProbability: effectiveApplicationProbability,
          });
          const periodic = prototype === '状态施加' && marginal && effectiveApplicationProbability > 0
            ? periodicStateMarginal(currentTarget, existingState, effect, combatEffect) : null;
          if (periodic && periodic.tickDeltas.some(delta => Math.abs(delta) > 1e-12)) {
            const { damagePerTick, healingPerTick, tickCount, tickDeltas, realizedDamage, realizedHealing } = periodic;
            const expectedDamage = realizedDamage * effectiveApplicationProbability;
            const expectedHealing = realizedHealing * effectiveApplicationProbability;
            const expectedDelta = expectedHealing - expectedDamage;
            const realizedDelta = realizedHealing - realizedDamage;
            const outcomeDistribution = Object.freeze([
              Object.freeze({
                branchKey: 'state:resisted',
                probability: 1,
                conditionalOn: { [stateApplicationOutcomeKey]: 'RESISTED' },
                delta: 0,
              }),
              Object.freeze({
                branchKey: 'state:hit',
                probability: 1,
                conditionalOn: { [stateApplicationOutcomeKey]: 'HIT' },
                delta: realizedDelta,
              }),
            ]);
            const dotEffectInstanceId = `${context.effectInstanceId}:scheduled-dot`;
            const dotWindowId = `${dotEffectInstanceId}:${unitId(target)}:${tickCount}`;
            overlay.schedule({
              type: 'SCHEDULED_HP_DELTA',
              actorId: unitId(actor),
              targetId: unitId(target),
              sourceActionId: String(context?.rootActionId || '').trim(),
              effectInstanceId: dotEffectInstanceId,
              windowId: dotWindowId,
              damagePerTick,
              healingPerTick,
              tickCount,
              tickDeltas,
              applicationProbability: effectiveApplicationProbability,
              expectedDamage,
              expectedHealing,
              expectedDelta,
            });
            ledger.addOutcome({
              ...context,
              effectInstanceId: dotEffectInstanceId,
              targetId: unitId(target),
              windowId: dotWindowId,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(expectedDelta) / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                prototype,
                state,
                delta: expectedDelta,
                expectedDamage,
                expectedHealing,
                damagePerTick,
                healingPerTick,
                tickCount,
                tickDeltas,
                realizedDelta,
                periodicScope: 'ISOLATED_STATE_MERGE',
                mergeKind: periodic.mergeKind,
                duration: tickCount,
                applicationProbability: effectiveApplicationProbability,
                ownApplicationProbability: effectiveOwnApplicationProbability,
                ...outcomeDependencyEvidence(context, unitId(target)),
                outcomeDistribution,
                distributionGroupKey: stateApplicationOutcomeKey,
              },
            });
          }
        });
        return;
      }
      if (prototype === '炸环') {
        const ringId = String(context.declaration?.ringId || effect?.魂环ID || '').trim();
        if (!ringId) throw new Error('battle_preview_ring_selection_missing');
        overlay.schedule({ type: 'RING_DESTROY', actorId: unitId(actor), ringId, multiplier: Number(effect?.强化倍率 || 1) });
        const cost = Math.max(0, Number(context.declaration?.ringCost || 20));
        ledger.addOutcome({ ...context, targetId: unitId(actor), outcomeKind: 'IRREVERSIBLE_ASSET_LOST', threatValue: cost, evidence: { ringId, cost } });
        ledger.addOutcome({ ...context, effectInstanceId: `${context.effectInstanceId}:boost`, targetId: unitId(actor), outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED', threatValue: 0, evidence: { multiplier: Number(effect?.强化倍率 || 1) } });
        return;
      }
      if (prototype === '时窗修正') {
        targets.forEach(target => {
          const adjustment = Number(effect?.调整回合 ?? effect?.调整次数 ?? 0);
          const targetId = unitId(target);
          const probabilityProfile = effectProbabilityProfile(context, targetId, effect);
          const applicationProbability = probabilityProfile.applicationProbability;
          if (applicationProbability <= 1e-12) return;
          const probabilityEvidence = {
            applicationProbability,
            ownApplicationProbability: probabilityProfile.ownApplicationProbability,
            ...outcomeDependencyEvidence(context, targetId),
            probabilityGroupKey: [context.rootActionId, context.effectInstanceId, targetId, 'time-window'].join('|'),
          };
          const primaryOutcomeKey = context.outcomeAssignmentKeyByTarget?.get(targetId);
          if (primaryOutcomeKey) {
            probabilityEvidence.distributionGroupKey = primaryOutcomeKey;
            probabilityEvidence.outcomeDistribution = conditionalDeterministicOutcomeDistribution(context, targetId, 0, applicationProbability, probabilityEvidence.probabilityGroupKey);
          }
          const currentTarget = overlay.readUnit(targetId);
          const durationChanges = [];
          const scheduledRows = [];
          const compression = /压缩|减少|缩短/.test(String(effect?.调整方式 || '').trim());
          const settlementRatio = compression
            ? Math.max(0, parseSignedValue(effect?.结算倍率, 1))
            : 0;
          const hpBeforeSettlement = readHp(currentTarget);
          let requestedSettlementDelta = 0;
          let appliedSettlementDelta = 0;
          overlay.changeUnit(targetId, unit => {
            const entries = stateEntries(unit).map(([key, state]) => {
              if (!timeWindowStateMatches(timeWindowStateSelectors(effect).length ? effect : context?.conditionalSourceEffect || effect, key, state)) {
                return [key, cloneValue(state)];
              }
              const next = cloneValue(state);
              const current = Math.max(0, Number(next?.duration ?? next?.持续回合 ?? 0));
              const duration = compression ? Math.max(0, current - Math.abs(adjustment)) : current + Math.abs(adjustment);
              const tickDelta = duration - current;
              const stateKey = String(key || '').trim() || `index:${durationChanges.length}`;
              const tickWindowId = [
                context.effectInstanceId,
                'window',
                targetId,
                stateKey,
              ].join(':');
              const beforeScheduledHealthDelta = stateScheduledHpDelta(currentTarget, state, current);
              const afterScheduledHealthDelta = stateScheduledHpDelta(currentTarget, state, duration);
              const scheduledHealthDelta = afterScheduledHealthDelta - beforeScheduledHealthDelta;
              const settlementDelta = settlementRatio > 0 && beforeScheduledHealthDelta < -1e-9 && scheduledHealthDelta > 1e-9
                ? (beforeScheduledHealthDelta - afterScheduledHealthDelta) * settlementRatio
                : 0;
              requestedSettlementDelta += settlementDelta;
              durationChanges.push(Object.freeze({
                stateKey,
                windowId: tickWindowId,
                beforeDuration: current,
                afterDuration: duration,
                tickDelta,
                settlementDelta,
              }));
              if (Math.abs(scheduledHealthDelta) > 1e-9) {
                scheduledRows.push(Object.freeze({
                  stateKey,
                  tickWindowId,
                  scheduledHealthDelta,
                  tickDelta,
                  beforeDuration: current,
                  afterDuration: duration,
                }));
              }
              next.duration = current + tickDelta * applicationProbability;
              return [key, next];
            });
            replaceStates(unit, entries);
            if (Math.abs(requestedSettlementDelta) > 1e-9) {
              const before = readHp(unit);
              appliedSettlementDelta = clamp(before + requestedSettlementDelta, 0, readHpMax(unit)) - before;
              setHp(unit, before + appliedSettlementDelta * applicationProbability);
            }
          });
          ledger.addOutcome({
            ...context,
            targetId,
            outcomeKind: 'STATE_CHANGED',
            threatValue: 0,
            evidence: {
              prototype,
              adjustment,
              ...probabilityEvidence,
              sourceStateKeys: durationChanges
                .map(change => change.stateKey)
                .filter(Boolean),
              durationChanges,
            },
          });
          if (Math.abs(appliedSettlementDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:window-settlement`,
              targetId,
              outcomeKind: 'HP_DELTA',
              threatValue: Math.abs(appliedSettlementDelta) * applicationProbability / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                ...probabilityEvidence,
                delta: appliedSettlementDelta * applicationProbability,
                realizedDelta: appliedSettlementDelta,
                current: hpBeforeSettlement,
                next: hpBeforeSettlement + appliedSettlementDelta * applicationProbability,
                requestedDelta: requestedSettlementDelta,
                settlementRatio,
                sourceStateKeys: durationChanges
                  .filter(change => Math.abs(change.settlementDelta) > 1e-9)
                  .map(change => change.stateKey),
              },
            });
          }
          scheduledRows.forEach(row => {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:window-health:${row.stateKey}`,
              targetId,
              windowId: row.tickWindowId,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(row.scheduledHealthDelta) * applicationProbability / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                ...probabilityEvidence,
                delta: row.scheduledHealthDelta * applicationProbability,
                realizedDelta: row.scheduledHealthDelta,
                tickDelta: row.tickDelta,
                adjustment,
                tickCount: Math.max(1, Math.abs(row.tickDelta)),
                sourceStateKey: row.stateKey,
                tickWindowId: row.tickWindowId,
                beforeDuration: row.beforeDuration,
                afterDuration: row.afterDuration,
              },
            });
          });
        });
        return;
      }
      if (prototype === '状态移除') {
        targets.forEach(target => {
          const probabilityProfile = effectProbabilityProfile(context, unitId(target), effect);
          const applicationProbability = probabilityProfile.applicationProbability;
          if (applicationProbability <= 1e-12) return;
          const currentTarget = overlay.readUnit(unitId(target));
          const stateRemoval = { selector: String(effect?.状态 || '任意状态').trim(), limit: Math.max(0, Number(effect?.数量 || 0)),
            ...(effect.匹配原型 ? { 匹配原型: effect.匹配原型, 资源: effect.资源, 数值方向: effect.数值方向 } : {}) };
          const persistent = persistentStateOperation(actor, [unitId(target)], effect, context);
          if (persistent) stateRemoval.persistent = persistent;
          let removed;
          overlay.changeUnit(unitId(target), unit => {
            removed = removeProjectedStates(unit, stateRemoval, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0));
            if (persistent) unit.状态效果 = { ...(unit.状态效果 || {}), [persistent.key]: persistent.state };
          });
          const removedKeys = removed.map(([key]) => key);
          const removedScheduledDelta = removed
            .reduce((sum, [, state]) => sum + stateScheduledHpDelta(currentTarget, state), 0);
          const probabilityEvidence = { applicationProbability, ownApplicationProbability: probabilityProfile.ownApplicationProbability,
            ...outcomeDependencyEvidence(context, unitId(target)) };
          ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: {
            removedKeys, stateRemoval, ...probabilityEvidence, ...(persistent ? { persistentStateOperation: true } : {}),
          } });
          projectStateEndRisks(target, removed, Object.entries(target.状态效果 || {}).filter(([key, state]) => conditionMatchesFilter(key, state, stateRemoval)),
            overlay, ledger, context, applicationProbability);
          if (Math.abs(removedScheduledDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:removed-health`,
              targetId: unitId(target),
              windowId: `${context.effectInstanceId}:removed-state-window`,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(removedScheduledDelta) * applicationProbability / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                ...probabilityEvidence,
                delta: -removedScheduledDelta * applicationProbability,
                realizedDelta: -removedScheduledDelta,
                removedScheduledDelta,
                removedKeys,
                tickCount: Math.max(
                  1,
                  ...removed
                    .map(([, state]) =>
                      Math.max(
                        0,
                        Number(
                          state?.duration ??
                          state?.持续回合 ??
                          state?.剩余回合 ??
                          0,
                        ),
                      ),
                    ),
                ),
              },
            });
          }
        });
        return;
      }
      if (['规则防御', '规则改写', '机制抹消'].includes(prototype)) {
        targets.forEach(target => {
          const targetId = unitId(target);
          const probabilityProfile = effectProbabilityProfile(context, targetId, effect);
          if (probabilityProfile.applicationProbability <= 1e-12) return;
          const matcher = effect?.抹消对象 && typeof effect.抹消对象 === 'object'
            ? cloneValue(effect.抹消对象)
            : { 原型: String(effect?.抹消对象 || '').trim() };
          let removedKeys = [];
          let removedStates = [];
          let removedScheduledDelta = 0;
          let removedTickCount = 0;
          let suppressionAdded = false;
          const currentTarget = overlay.readUnit(targetId);
          overlay.changeUnit(targetId, unit => {
            if (prototype === '机制抹消') {
              removedStates = stateEntries(unit).filter(([, state]) => effectMatchesMechanismMatcher(state, matcher));
              removedKeys = removedStates.map(([key]) => key);
              removedScheduledDelta = removedStates
                .reduce((sum, [, state]) => sum + stateScheduledHpDelta(currentTarget, state), 0);
              removedTickCount = Math.max(
                0,
                ...stateEntries(unit)
                  .filter(([key]) => removedKeys.includes(key))
                  .map(([, state]) => Math.max(
                    0,
                    Number(
                      state?.duration ??
                      state?.持续回合 ??
                      state?.剩余回合 ??
                      0,
                    ),
                  )),
              );
              const suppression = applyMechanismSuppression(
                unit,
                matcher,
                effect?.持续回合,
                `preview:${context.effectInstanceId}:机制抹消`,
              );
              suppressionAdded = suppression.suppressionAdded;
              if (removedKeys.length) unit.final = { ...unit.final, ...buildNumericCombatStats(unit, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0)) };
            } else {
              applyProjectedRuleState(unit, effect, prototype, context);
            }
          });
          const rule = prototype === '机制抹消'
            ? JSON.stringify(matcher)
            : String(effect?.规则 || effect?.防御对象 || prototype).trim();
          overlay.writeRule(`${targetId}:${prototype}:${rule}`, {
            ...cloneValue(effect),
            targetId,
            removedKeys,
          });
          ledger.addOutcome({
            ...context,
            targetId,
            outcomeKind: 'RULE_CHANGED',
            threatValue: 0,
            evidence: {
              prototype,
              rule,
              removedKeys,
              projectedEffect: cloneValue(effect),
              applicationProbability: probabilityProfile.applicationProbability,
              ownApplicationProbability: probabilityProfile.ownApplicationProbability,
              ...outcomeDependencyEvidence(context, targetId),
              ...(prototype === '机制抹消'
                ? {
                    matcher,
                    suppressionAdded,
                    suppressionDuration: Math.max(1, Number(effect?.持续回合 || 1)),
                  }
                : {}),
              marginal: prototype !== '机制抹消' || removedKeys.length > 0 || suppressionAdded,
            },
          });
          if (prototype === '机制抹消') projectStateEndRisks(target, removedStates,
            Object.entries(target.状态效果 || {}).filter(([, state]) => effectMatchesMechanismMatcher(state, matcher)),
            overlay, ledger, context, probabilityProfile.applicationProbability);
          if (prototype === '机制抹消' && Math.abs(removedScheduledDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:removed-health`,
              targetId,
              windowId: `${context.effectInstanceId}:removed-state-window`,
              outcomeKind: 'SCHEDULED_HP_DELTA',
              threatValue: Math.abs(removedScheduledDelta) * probabilityProfile.applicationProbability / Math.max(1, readHpMax(currentTarget)) * 100,
              evidence: {
                delta: -removedScheduledDelta * probabilityProfile.applicationProbability,
                realizedDelta: -removedScheduledDelta,
                applicationProbability: probabilityProfile.applicationProbability,
                ownApplicationProbability: probabilityProfile.ownApplicationProbability,
                ...outcomeDependencyEvidence(context, targetId),
                removedScheduledDelta,
                removedKeys,
                tickCount: Math.max(1, removedTickCount),
                sourcePrototype: prototype,
                matcher,
              },
            });
          }
        });
        return;
      }
      if (prototype === '状态转移' || prototype === '状态交换') {
        const eligibleTargets = prototype === '状态转移'
          ? targets.filter(target => effectProbabilityProfile(context, unitId(target), effect).applicationProbability > 1e-12)
          : targets;
        const target = eligibleTargets[0];
        if (!target) return;
        const probabilityProfile = effectProbabilityProfile(context, unitId(target), effect);
        if (probabilityProfile.applicationProbability <= 1e-12) return;
        const transferResult = transferProjectedStates(overlay, actor, targets, eligibleTargets, effect, context);
        if (!transferResult) return;
        const { movedStateCount, changedUnitIds, persistent } = transferResult;
        ledger.addOutcome({ ...context, targetId: unitId(target), outcomeKind: 'STATE_CHANGED', threatValue: 0, evidence: {
          prototype, atomic: true, movedStateCount, applicationProbability: probabilityProfile.applicationProbability,
          ...(persistent ? { persistentStateOperation: true } : {}),
          stateTransfer: { effect: cloneValue(effect), actorId: unitId(actor), changedUnitIds,
            sourceActionId: String(context.declaration?.__structuredSourceActionId || context.rootActionId || ''),
            sourceEffectId: String(context.declaration?.__structuredSourceEffectId || context.effectInstanceId || ''),
            skillName: String(context.declaration?.skill?.魂技名 || context.declaration?.skill?.name || ''),
            targets: (prototype === '状态交换' ? targets.slice(0, 1) : targets).map(recipient => ({
            targetId: unitId(recipient), ...effectProbabilityProfile(context, unitId(recipient), effect),
            distributionGroupKey: context.outcomeAssignmentKeyByTarget?.get(unitId(recipient)),
            ...outcomeDependencyEvidence(context, unitId(recipient)),
          })) },
          ownApplicationProbability: probabilityProfile.ownApplicationProbability, ...outcomeDependencyEvidence(context, unitId(target)),
        } });
        return;
      }
      if (prototype === '机制授予') {
        const granted = nestedEffects(effect);
        if (!granted.length) throw new Error('battle_preview_granted_effect_missing');
        const trigger = String(effect?.触发条件 || '主动触发').trim();
        const grantedTargetIds = [];
        targets.forEach(target => {
          const targetId = unitId(target);
          const probabilityProfile = effectProbabilityProfile(context, targetId, effect);
          if (probabilityProfile.applicationProbability <= 1e-12) return;
          grantedTargetIds.push(targetId);
          let grantedStateEntries;
          overlay.changeUnit(targetId, unit => {
            unit.状态效果 ||= {};
            const sourceActionId = String(
              context?.declaration?.__structuredSourceActionId || context?.rootActionId || ''
            ).trim();
            const sourceEffectId = String(
              context?.declaration?.__structuredSourceEffectId || context?.effectInstanceId || ''
            ).trim();
            const stateId = `机制授予:${stableHash({
              sourceActionId,
              sourceEffectId,
              targetId,
            }).slice(0, 20)}`;
            const sourceSkillName = String(
              context?.declaration?.skill?.魂技名 ||
              context?.declaration?.skill?.技能名 ||
              context?.declaration?.skill?.name ||
              '机制授予'
            ).trim();
            const record = {
              状态ID: stateId,
              状态: '机制授予',
              状态名称: '机制授予',
              类型: 'buff',
              原型: prototype,
              来源原型摘要: prototype,
              来源技能: sourceSkillName,
              来源动作ID: sourceActionId,
              来源效果ID: sourceEffectId,
              授予技能名: `${sourceSkillName}·授予技`,
              授予触发条件: trigger,
              触发条件: trigger,
              授予效果: cloneValue(granted),
              可用次数: trigger === '随下次行动触发'
                ? 1
                : Math.max(1, Math.floor(Number(effect?.可用次数 || 1))),
              战斗效果: {},
              面板修改比例: {},
              面板固定修正: {},
            };
            if (probabilityProfile.applicationProbability < 1) record.__previewApplicationProbability = probabilityProfile.applicationProbability;
            if (trigger === '主动触发' || effect?.持续回合 !== undefined) {
              record.duration = Math.max(1, Math.floor(Number(effect?.持续回合 || 1)));
              record.持续回合 = record.duration;
            }
            unit.状态效果[`preview:${context.effectInstanceId}:${stateId}`] = record;
            grantedStateEntries = { [`preview:${context.effectInstanceId}:${stateId}`]: cloneValue(record) };
          });
          ledger.addOutcome({
            ...context,
            targetId,
            outcomeKind: 'STATE_CHANGED',
            threatValue: 0,
            evidence: { prototype, trigger, grantTrigger: trigger, count: granted.length, marginal: true,
              stateEntries: grantedStateEntries,
              applicationProbability: probabilityProfile.applicationProbability,
              ownApplicationProbability: probabilityProfile.ownApplicationProbability,
              ...outcomeDependencyEvidence(context, targetId) },
          });
        });
        if (grantedTargetIds.length) overlay.schedule({
          type: 'MECHANISM_GRANT',
          actorId: unitId(actor),
          targetIds: grantedTargetIds,
          effects: cloneValue(granted),
          trigger,
        });
        return;
      }
      if (prototype === '复制执行') {
        const copied = nestedEffects(effect);
        if (!copied.length) throw new Error('battle_preview_copy_source_missing');
        copied.forEach((nested, index) => {
          const nestedContext = {
            ...context,
            effectInstanceId: `${context.effectInstanceId}:copy:${index}`,
            depth: depth + 1,
            effectPath: effectContext.effectPath,
          };
          applyEffect(nested, resolveTargets(overlay.snapshot(), actor, context.declaration, nested), overlay, ledger, nestedContext, depth + 1);
        });
        return;
      }
      if (prototype === '时光回溯') {
        const history = context.declaration?.historySnapshot || context.worldSnapshot?.回合开始快照;
        targets.forEach(target => {
          const targetId = unitId(target);
          const probabilityProfile = effectProbabilityProfile(context, targetId, effect);
          const applicationProbability = probabilityProfile.applicationProbability;
          if (applicationProbability <= 1e-12) return;
          if (!history || typeof history !== 'object') throw new Error('battle_preview_rewind_history_missing');
          const probabilityEvidence = { applicationProbability, ownApplicationProbability: probabilityProfile.ownApplicationProbability,
            ...outcomeDependencyEvidence(context, targetId) };
          const currentUnit = overlay.readUnit(unitId(target));
          const historicUnit = findUnit(history, unitId(target));
          if (!historicUnit) throw new Error(`battle_preview_rewind_target_missing:${unitId(target)}`);
          overlay.writeUnit(cloneValue(historicUnit));
          const hpDelta = readHp(historicUnit) - readHp(currentUnit);
          if (Math.abs(hpDelta) > 1e-9) {
            ledger.addOutcome({
              ...context,
              targetId: unitId(target),
              outcomeKind: 'HP_DELTA',
              threatValue: Math.abs(hpDelta) * applicationProbability / Math.max(1, readHpMax(currentUnit)) * 100,
              evidence: {
                rewind: true,
                ...probabilityEvidence,
                current: readHp(currentUnit),
                next: readHp(currentUnit) + hpDelta * applicationProbability,
                delta: hpDelta * applicationProbability,
                realizedDelta: hpDelta,
              },
            });
          }
          ['魂力', '精神力', '体力'].forEach((resource, index) => {
            const current = readResource(currentUnit, resource);
            const next = readResource(historicUnit, resource);
            if (Math.abs(next - current) <= 1e-9) return;
            ledger.addOutcome({
              ...context,
              effectInstanceId: `${context.effectInstanceId}:resource:${index}`,
              targetId: unitId(target),
              outcomeKind: 'RESOURCE_OPTION_CHANGED',
              threatValue: 0,
              evidence: { rewind: true, resource, current, next: current + (next - current) * applicationProbability,
                delta: (next - current) * applicationProbability, realizedDelta: next - current, ...probabilityEvidence },
            });
          });
          ledger.addOutcome({
            ...context,
            effectInstanceId: `${context.effectInstanceId}:state`,
            targetId: unitId(target),
            outcomeKind: 'STATE_CHANGED',
            threatValue: 0,
            evidence: { rewind: true, rewindSnapshot: cloneValue(historicUnit), ...probabilityEvidence },
          });
        });
        return;
      }
      if (prototype === '召唤生成') {
        if (context?.environmentContext?.deployment?.summonBlocked) {
          ledger.addOutcome({
            ...context,
            targetId: unitId(actor),
            effectInstanceId: `${context.effectInstanceId}:environment-deployment`,
            outcomeKind: 'ACTION_CANCELLED',
            threatValue: 0,
            evidence: { reason: 'ENVIRONMENT_SUMMON_DEPLOYMENT_BLOCKED', marginal: false },
          });
          return;
        }
        const summonName = String(effect?.召唤物名称 || '').trim();
        if (!summonName) throw new Error('battle_preview_summon_name_missing');
        const count = Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
        const duration = Math.max(1, Math.floor(Number(effect?.持续回合 || 1)) || 1);
        const actionMode = String(effect?.行动模式 || '协同攻击').trim() || '协同攻击';
        const summonType = String(effect?.召唤单位类型 || effect?.召唤类型 || '魂兽').trim() || '魂兽';
        const inheritRatio = clamp(Number(
          effect?.继承属性比例 || effect?.强度 || effect?.召唤强度 || 0.35,
        ), 0.05, 2);
        const summonLevel = Math.max(1, Number(
          actor?.level ?? actor?.等级 ?? actor?.修为等级 ?? actor?.属性?.等级 ?? actor?.final?.level ?? 1,
        ) || 1);
        const actorSide = sideOf(context.worldSnapshot, actor);
        const summonIds = [];
        const summonProbabilityProfile = effectProbabilityProfile(
          context,
          unitId(targets[0]),
          effect,
        );
        const applicationProbability =
          summonProbabilityProfile.applicationProbability;
        const summonOutcomeDependency = outcomeDependencyEvidence(
          context,
          unitId(targets[0]),
        );
        const summonPrimaryKey = context.outcomeAssignmentKeyByTarget?.get(unitId(targets[0]));
        if (summonPrimaryKey) {
          summonOutcomeDependency.distributionGroupKey = summonPrimaryKey;
          summonOutcomeDependency.outcomeDistribution = conditionalDeterministicOutcomeDistribution(context, unitId(targets[0]), 0, applicationProbability);
        }
        const probabilityGroupKey = [
          context.rootActionId,
          context.effectInstanceId,
          context.windowId,
          unitId(actor),
        ].join('|');
        const summonDefinitions = [];
        for (let index = 0; index < count; index += 1) {
          const displayName = count > 1 ? `${summonName}#${index + 1}` : summonName;
          // B1-P0：预演侧召唤 id 统一带 preview-summon: 前缀——战报脱敏
          // （internalSummonIdPattern）与依赖过滤立即覆盖，且不可能与真实单位撞名。
          // 运行时车道（commitStructuredSummon）的主键不变，另计 previewSummonKey 别名。
          const summonId = `preview-summon:${summonInstanceId(
            context.rootActionId,
            context.effectInstanceId,
            index + 1,
          )}`;
          summonIds.push(summonId);
          const hpMax = Math.max(1, Math.floor(readHpMax(actor) * inheritRatio));
          const staminaMax = Math.max(1, Math.floor(readResourceMax(actor, '体力') * inheritRatio));
          const soulMax = Math.max(1, Math.floor(readResourceMax(actor, '魂力') * inheritRatio));
          const mentalMax = Math.max(1, Math.floor(readResourceMax(actor, '精神力') * inheritRatio));
          const summonUnit = {
            id: summonId,
            name: displayName,
            名称: displayName,
            召唤键: summonId,
            类型: summonType,
            召唤单位类型: summonType,
            单位性质: '召唤物',
            level: summonLevel,
            等级: summonLevel,
            行动模式: actionMode,
            宿主名: unitName(actor),
            阵营: /enemy|敌方|对方/i.test(actorSide) ? '敌方' : '玩家',
            已消散: false,
            剩余窗口: duration,
            __battleRuntime: {
              summonWindow: {
                windowId: `${summonId}:window`,
                remainingWindows: duration,
              },
            },
            hp: hpMax,
            hp_max: hpMax,
            HP: hpMax,
            HP上限: hpMax,
            vit: staminaMax,
            vit_max: staminaMax,
            sta: staminaMax,
            sta_max: staminaMax,
            体力: staminaMax,
            体力上限: staminaMax,
            sp: soulMax,
            sp_max: soulMax,
            魂力: soulMax,
            魂力上限: soulMax,
            men: mentalMax,
            men_max: mentalMax,
            精神力: mentalMax,
            精神力上限: mentalMax,
            str: Math.max(1, Math.floor(readCombatStat(actor, 'str') * inheritRatio)),
            def: Math.max(1, Math.floor(readCombatStat(actor, 'def') * inheritRatio)),
            agi: Math.max(1, Math.floor(readCombatStat(actor, 'agi') * inheritRatio)),
            状态: { 存活: true },
            状态效果: {},
            持续效果: {},
            技能列表: Array.isArray(effect?.技能列表) && effect.技能列表.length
              ? cloneValue(effect.技能列表)
              : [{
                  name: '普通攻击',
                  魂技名: '普通攻击',
                  消耗: '无',
                  前摇: 10,
                  _效果数组: [{
                    原型: '伤害结算',
                    目标: '单体',
                    威力倍率: Math.max(25, Math.round(50 * inheritRatio)),
                    伤害类型: '近身攻击',
                  }],
                }],
          };
          const summonDefinitionHash = stableHash({
            summonName: displayName,
            summonType,
            mode: actionMode,
            duration,
            inheritRatio,
            skills: Array.isArray(effect?.技能列表) ? effect.技能列表 : [],
          });
          summonUnit.__definitionHash = summonDefinitionHash;
          summonDefinitions.push(cloneValue(summonUnit));
          overlay.writeSummon(summonUnit, summonDefinitionHash);
          const summonWorld = overlay.snapshot();
          const summonSkill = summonUnit.技能列表[0] || null;
          const summonEffects = Array.isArray(summonSkill?._效果数组)
            ? summonSkill._效果数组.filter(item => item && typeof item === 'object')
            : [];
          const primarySummonEffect = summonEffects[0] || {};
          const summonTargets = summonSkill
            ? resolveTargets(
                summonWorld,
                overlay.readUnit(summonId) || summonUnit,
                {
                  actorId: summonId,
                  actionKind: 'RELEASE_SKILL',
                  skill: summonSkill,
                },
                primarySummonEffect,
              )
            : [];
          const summonTargetPotentials = summonTargets.map(target =>
            calculateDirectPotential(
              overlay.readUnit(summonId) || summonUnit,
              target,
              {
                actionKind: 'RELEASE_SKILL',
                skill: summonSkill,
                worldSnapshot: summonWorld,
              },
            )
          );
          const summonActionPotential = /群体|全场/.test(String(primarySummonEffect?.目标 || '').trim())
            ? summonTargetPotentials.reduce((sum, value) => sum + value, 0)
            : Math.max(0, ...summonTargetPotentials);
          ledger.addOutcome({
            ...context,
            effectInstanceId: `${context.effectInstanceId}:summon:${index + 1}`,
            targetId: summonId,
            windowId: `${summonId}:window`,
            outcomeKind: 'SUMMON_WINDOW',
            threatValue: 0,
            evidence: {
              summonName: displayName,
              actionMode,
              duration,
              immediateWindowConsumed: actionMode === '协同攻击',
              remainingWindows: actionMode === '协同攻击' ? Math.max(0, duration - 1) : duration,
              actionPotential: summonActionPotential,
              applicationProbability,
              ownApplicationProbability:
                summonProbabilityProfile.ownApplicationProbability,
              ...summonOutcomeDependency,
              probabilityGroupKey,
              instanceId: summonId,
              definitionHash: summonDefinitionHash,
            },
          });
        }
        overlay.schedule({
          type: 'SUMMON_CREATE',
          actorId: unitId(actor),
          effectInstanceId: context.effectInstanceId,
          summonIds,
          summonName,
          summonType,
          count,
          actionMode,
          duration,
          strength: Math.max(0.01, Number(effect?.强度 || effect?.召唤强度 || 1)),
          inheritRatio: Math.max(0, Number(effect?.继承属性比例 || 0)),
          applicationProbability,
          ownApplicationProbability:
            summonProbabilityProfile.ownApplicationProbability,
          ...summonOutcomeDependency,
          probabilityGroupKey,
          summonDefinitions,
        });
      }
    } finally {
      context.nodeBudget.activeFingerprints.delete(activeFingerprint);
    }
  }

  function createEnvironmentSource(hazard = {}, index = 0) {
    const level = Math.max(1, Number(hazard?.effectiveLevel || 1));
    if (typeof root.__LWCS_GET_BASE_STATS__ !== 'function') return null;
    let baseStats;
    try {
      baseStats = root.__LWCS_GET_BASE_STATS__(level);
    } catch (error) {
      return null;
    }
    if (!baseStats || typeof baseStats !== 'object') return null;
    const stats = Object.fromEntries(['sp_max', 'men_max', 'str', 'def', 'agi', 'vit_max'].map(key => [
      key,
      Math.max(1, Number(baseStats[key] || 0)),
    ]));
    if (Object.values(stats).some(value => !Number.isFinite(value) || value <= 0)) return null;
    const id = `environment:${String(hazard?.sourceTag || 'hazard').trim()}:${index}`;
    return {
      id,
      name: hazard?.displayName || '环境威胁',
      名称: hazard?.displayName || '环境威胁',
      等级: level,
      属性: { 等级: level },
      final: { ...stats, 等级: level, level },
      hp_max: stats.vit_max,
      hp: stats.vit_max,
      sp_max: stats.sp_max,
      sp: stats.sp_max,
      men_max: stats.men_max,
      men: stats.men_max,
      vit_max: stats.vit_max,
      vit: stats.vit_max,
      状态: { 存活: true },
      状态效果: {},
    };
  }

  function applyEnvironmentalHazards({
    environmentContext,
    overlay,
    ledger,
    actor,
    rootActionId,
    battleIntent = {},
    basisView = 'DECISION_VISIBLE',
    snapshotRevision = '',
  } = {}) {
    if (!environmentContext || environmentContext.blocked || !Array.isArray(environmentContext.hazards)) return Object.freeze([]);
    const durationTicks = Math.max(0, Number(environmentContext.durationTicks || 0));
    if (!(durationTicks > 0)) return Object.freeze([]);
    const applications = [];
    const nodeBudget = {
      count: 0,
      limit: Math.max(1, MAX_ENVIRONMENT_TICKS * Math.max(1, environmentContext.hazards.length) + 8),
      activeFingerprints: new Set(),
    };
    environmentContext.hazards.forEach((hazard, hazardIndex) => {
      const normalizedHazard = normalizeEnvironmentHazard(hazard, hazardIndex);
      if (!normalizedHazard) return;
      const tickCount = Math.min(
        MAX_ENVIRONMENT_TICKS,
        Math.max(1, Math.floor(durationTicks / Math.max(0.000001, normalizedHazard.intervalTicks) + 1e-9)),
      );
      for (let tick = 0; tick < tickCount; tick += 1) {
        const worldSnapshot = overlay.snapshot();
        const currentActor = overlay.readUnit(unitId(actor)) || actor;
        const targets = environmentTargetUnits(worldSnapshot, currentActor, normalizedHazard)
          .map(target => overlay.readUnit(unitId(target)) || target)
          .filter(target => isAlive(target));
        if (!targets.length) continue;
        const targetProtection = new Map(targets.map(target => [
          unitId(target),
          environmentProtectionForTarget(
            worldSnapshot,
            target,
            environmentContext,
            normalizedHazard.sourceTag,
          ),
        ]));
        const applicableTargets = targets.filter(target => !targetProtection.get(unitId(target))?.immune);
        if (!applicableTargets.length) continue;
        const source = createEnvironmentSource(normalizedHazard, hazardIndex);
        if (!source) continue;
        const effect = {
          原型: '伤害结算',
          目标: '单体',
          生效方式: '独立生效',
          威力倍率: normalizedHazard.power,
          伤害类型: normalizedHazard.damageType,
          攻击段数: normalizedHazard.segments,
          防御穿透: normalizedHazard.penetration,
          ...(normalizedHazard.element.length ? { 限定元素: normalizedHazard.element } : {}),
          ...(normalizedHazard.hitProbability === undefined ? {} : { 命中概率: normalizedHazard.hitProbability }),
        };
        const environmentDamageMultiplierByTarget = new Map(
          applicableTargets.map(target => [
            unitId(target),
            sameElementAdaptation(normalizedHazard, target).multiplier *
              targetProtection.get(unitId(target)).multiplier,
          ]),
        );
        const effectInstanceId = `${rootActionId}:environment:${hazardIndex + 1}:tick:${tick + 1}`;
        const before = ledger.entries.length;
        applyEffect(effect, applicableTargets, overlay, ledger, {
          actor: source,
          declaration: {
            actionId: effectInstanceId,
            actorId: source.id,
            actionKind: 'ENVIRONMENT_HAZARD',
            targetIds: applicableTargets.map(unitId),
            skill: { 消耗: '无', _效果数组: [effect] },
          },
          worldSnapshot,
          nodeBudget,
          depth: 0,
          effectPath: [],
          rootActionId,
          sourceActionId: rootActionId,
          effectInstanceId,
          windowId: `environment:${hazardIndex + 1}:tick:${tick + 1}`,
          battleIntent,
          basisView,
          snapshotRevision,
          environmentContext,
          environmentDamageMultiplierByTarget,
        }, 0);
        applications.push(Object.freeze({
          hazardId: normalizedHazard.id,
          tick: tick + 1,
          targetIds: Object.freeze(applicableTargets.map(unitId)),
          contributionCount: ledger.entries.length - before,
        }));
      }
    });
    return Object.freeze(applications);
  }

  function settleImmediateCooperativeSummons({
    overlay,
    ledger,
    rootActionId,
    declaration,
    worldSnapshot,
    nodeBudget,
    battleIntent,
    basisView = 'DECISION_VISIBLE',
    snapshotRevision,
    projectionContext = null,
    captureDamageBasisTrace = false,
    damageMultiplierByTarget,
    evadeProbabilityByTarget,
    damageMultiplierResolver,
    applicationProbabilityResolver,
    hitProbabilityResolver,
    damageOutcomeResolver,
    forcedApplicationProbabilityByEffect = {},
    environmentContext = null,
  }) {
    const summonEvents = overlay.mergedScheduledEvents().filter(event =>
      event?.type === 'SUMMON_CREATE' &&
      String(event?.actionMode || '').trim() === '协同攻击'
    );
    if (!summonEvents.length) return;
    const hostHitTargetIds = [...new Set(ledger.entries
      .filter(entry =>
        entry?.rootCauseId === rootActionId &&
        entry?.outcomeKind === 'HP_DELTA' &&
        !String(entry?.effectInstanceId || '').includes(':summon-assist:') &&
        Number(entry?.evidence?.expectedDamage || 0) > 0
      )
      .map(entry => String(entry?.targetId || '').trim())
      .filter(Boolean))];
    summonEvents.forEach(event => {
      (event.summonIds || []).forEach((summonId, summonIndex) => {
        const summon = overlay.readMapEntry('createdSummons', summonId);
        if (!summon) throw new Error(`battle_preview_cooperative_summon_missing:${summonId}`);
        const snapshot = overlay.snapshot();
        const summonSide = sideOf(snapshot, summon);
        const hostileUnits = listUnits(snapshot)
          .filter(entry => entry.side !== summonSide && isBattleCapable(entry.unit))
          .map(entry => entry.unit);
        const preferredTarget = hostHitTargetIds
          .map(targetId => hostileUnits.find(unit => unitId(unit) === targetId))
          .find(Boolean);
        const target = preferredTarget || hostileUnits[0] || null;
        const targetId = target ? unitId(target) : '';
        const summonApplicationProbability = clamp(
          Number(event?.applicationProbability ?? 1),
          0,
          1,
        );
        const skill = Array.isArray(summon?.技能列表) ? summon.技能列表[0] : null;
        const damageEffects = Array.isArray(skill?._效果数组)
          ? skill._效果数组.filter(effect => String(effect?.原型 || '').trim() === '伤害结算')
          : [];
        if (target && damageEffects.length) {
          const assistDeclaration = {
            actionId: `${rootActionId}:summon-assist:${summonIndex + 1}`,
            actorId: summonId,
            actionKind: 'RELEASE_SKILL',
            targetIds: [unitId(target)],
            skill,
          };
          damageEffects.forEach((damageEffect, effectIndex) => {
            const assistSnapshot = overlay.snapshot();
            const assistActor = overlay.readUnit(summonId);
            const assistProjectionContext =
              compileMechanicalProjectionContext(assistSnapshot);
            const targets = resolveTargets(
              assistSnapshot,
              assistActor,
              assistDeclaration,
              damageEffect,
              assistProjectionContext,
            );
            if (!targets.length) return;
            applyEffect(damageEffect, targets, overlay, ledger, {
              actor: assistActor,
              declaration: assistDeclaration,
              worldSnapshot,
              nodeBudget,
              depth: 1,
              effectPath: [],
              rootActionId,
              sourceActionId: rootActionId,
              effectInstanceId: `${rootActionId}:summon-assist:${summonIndex + 1}:effect:${effectIndex}`,
              windowId: `${summonId}:window:1`,
              battleIntent,
              basisView,
              snapshotRevision,
              projectionContext: assistProjectionContext,
              captureDamageBasisTrace,
              environmentContext,
              applicationProbability: summonApplicationProbability,
              applicationProbabilityByTarget: new Map([
                [targetId, summonApplicationProbability],
              ]),
              damageMultiplierByTarget,
              evadeProbabilityByTarget,
              damageMultiplierResolver,
              applicationProbabilityResolver,
              hitProbabilityResolver,
              damageOutcomeResolver,
              forcedApplicationProbabilityByEffect,
            }, 1);
          });
        }
        const remainingWindows = Math.max(0, Number(summon?.剩余窗口 || event?.duration || 1) - 1);
        if (remainingWindows <= 0) {
          overlay.removeSummon(summonId);
          return;
        }
        overlay.changeSummon(summonId, unit => {
          unit.剩余窗口 = remainingWindows;
          unit.__battleRuntime = {
            ...(unit.__battleRuntime || {}),
            summonWindow: {
              ...(unit.__battleRuntime?.summonWindow || {}),
              remainingWindows,
            },
          };
        });
      });
    });
  }

  function basicAttackEffect() {
    return BASIC_ATTACK_EFFECT;
  }

  function compileMechanicalBasis(input = {}) {
    const declaration = input?.declaration;
    if (!isPlainRecord(declaration)) {
      throw new TypeError('R9V2_MECHANICAL_BASIS_DECLARATION_MISSING');
    }
    const actionKind = String(declaration?.actionKind || '')
      .trim()
      .toUpperCase();
    const paymentMode = String(input?.paymentMode || 'FORMAL')
      .trim()
      .toUpperCase();
    if (!['FORMAL', 'EXTERNAL_TIMELINE'].includes(paymentMode)) {
      throw new Error(
        `R9V2_MECHANICAL_BASIS_PAYMENT_MODE_INVALID:${paymentMode}`,
      );
    }
    const declaredEffects = declaration?.skill?._效果数组;
    if (declaredEffects !== undefined && !Array.isArray(declaredEffects)) {
      throw new TypeError('R9V2_MECHANICAL_BASIS_EFFECT_ARRAY_INVALID');
    }
    if (Array.isArray(declaredEffects)) {
      declaredEffects.forEach(effect => {
        if (effect !== undefined && !isPlainRecord(effect)) {
          throw new TypeError('R9V2_MECHANICAL_BASIS_EFFECT_INVALID');
        }
      });
    }
    const effects = actionKind === 'BASIC_ATTACK'
      ? [BASIC_ATTACK_EFFECT]
      : Array.isArray(declaredEffects)
        ? declaredEffects.filter(
            effect => effect && typeof effect === 'object',
          )
        : [];
    const supportedNoEffectActions = new Set([
      'DEFEND',
      'EVADE',
      'OBSERVE',
      'PASS_OPPORTUNITY',
    ]);
    const supportedPrototypes = new Set([
      '伤害结算',
      '资源变化',
      '护盾变化',
      '状态施加',
          '状态移除',
          '属性修正',
          '判定修正',
          '结算修正',
          '时窗修正',
          '位移执行',
          '决策干扰',
          '召唤生成',
    ]);
    const unsupportedReasons = [];
    const creationCarriers = [];
    const actorId = String(
      input?.actorId || declaration?.actorId || '',
    ).trim();
    const actionId = canonicalActionId(
      declaration,
      input?.actionFingerprint || '',
    );
    let requiresSequentialProjection = Boolean(declaration?.skill?.副作用列表?.length) ||
      effects.some(effect => effect?.副作用列表?.length);
    if (
      !effects.length &&
      actionKind &&
      !supportedNoEffectActions.has(actionKind) &&
      actionKind !== 'WITHDRAW'
    ) {
      unsupportedReasons.push(`ACTION_KIND:${actionKind}`);
    }
    const inspectNestedEffect = (effect, path) => {
      const prototype = String(effect?.原型 || '').trim();
      const nestedEffects = Array.isArray(effect?.使用效果)
        ? effect.使用效果.filter(
            nested => nested && typeof nested === 'object',
          )
        : [];
      if (!prototype && nestedEffects.length) {
        nestedEffects.forEach((nested, nestedIndex) =>
          inspectNestedEffect(
            nested,
            `${path}:carrier:${nestedIndex}`,
          )
        );
        return;
      }
      if (!supportedPrototypes.has(prototype)) {
        unsupportedReasons.push(
          `CREATION_EFFECT:PROTOTYPE:${prototype || 'MISSING'}:${path}`,
        );
      }
      if (Math.max(0, Number(effect?.延迟回合 || 0)) > 0) {
        unsupportedReasons.push(`CREATION_EFFECT:DELAYED_EFFECT:${path}`);
      }
      (Array.isArray(effect?.条件分支) ? effect.条件分支 : [])
        .forEach((branch, branchIndex) => {
          [
            ['replace', branch?.替换效果],
            ['append', branch?.追加效果],
          ].forEach(([mode, nestedEffects]) => {
            (Array.isArray(nestedEffects) ? nestedEffects : [])
              .filter(nested => nested && typeof nested === 'object')
              .forEach((nested, nestedIndex) => {
                inspectNestedEffect(
                  nested,
                  `${path}:${branchIndex}:${mode}:${nestedIndex}`,
                );
              });
          });
        });
    };
    const inspectEffect = (effect, path) => {
      const prototype = String(effect?.原型 || '').trim();
      const useEffects = Array.isArray(effect?.使用效果)
        ? effect.使用效果.filter(
            nested => nested && typeof nested === 'object',
          )
        : [];
      if (!prototype && useEffects.length) {
        const skill = declaration?.skill || {};
        const productId = creationProductIdentity(skill, actorId).id;
        if (!productId) {
          unsupportedReasons.push(
            `CREATION_EFFECT:PRODUCT_ID_MISSING:${path}`,
          );
        }
        creationCarriers.push({
          effectIndex: Number.parseInt(path, 10) || 0,
          productId,
          quantity: Math.max(
            1,
            Math.floor(Number(effect?.数量 || 1)) || 1,
          ),
          recipientId: String(
            declaration?.creationRecipientId || actorId,
          ).trim(),
          useEffects: useEffects.map(nested => cloneValue(nested)),
        });
        useEffects.forEach((nested, nestedIndex) =>
          inspectNestedEffect(
            nested,
            `${path}:use:${nestedIndex}`,
          )
        );
        return;
      }
      if (
        [
          '护盾变化',
          '状态移除',
          '属性修正',
          '判定修正',
          '结算修正',
          '时窗修正',
          '位移执行',
          '决策干扰',
          '召唤生成',
        ].includes(prototype) ||
        (
          prototype === '资源变化' &&
          effects.length > 1
        ) ||
        (
          Array.isArray(effect?.条件分支) &&
          effect.条件分支.length > 0
        ) ||
        String(effect?.生效方式 || '').trim() === '跟随主原型'
      ) {
        requiresSequentialProjection = true;
      }
      if (!supportedPrototypes.has(prototype)) {
        unsupportedReasons.push(
          `PROTOTYPE:${prototype || 'MISSING'}:${path}`,
        );
      }
      if (Math.max(0, Number(effect?.延迟回合 || 0)) > 0) {
        unsupportedReasons.push(`DELAYED_EFFECT:${path}`);
      }
      (Array.isArray(effect?.条件分支) ? effect.条件分支 : [])
        .forEach((branch, branchIndex) => {
          [
            ['replace', branch?.替换效果],
            ['append', branch?.追加效果],
          ].forEach(([mode, nestedEffects]) => {
            (Array.isArray(nestedEffects) ? nestedEffects : [])
              .filter(nested => nested && typeof nested === 'object')
              .forEach((nested, nestedIndex) => {
                inspectEffect(
                  nested,
                  `${path}:${branchIndex}:${mode}:${nestedIndex}`,
                );
              });
          });
        });
    };
    effects.forEach((effect, index) => {
      inspectEffect(effect, String(index));
    });
    const declarationCosts = normalizeSkillCostMap(
      declaration?.resourceCosts && typeof declaration.resourceCosts === 'object' ? declaration.resourceCosts : {},
    );
    if (declarationCosts.非法项.length) unsupportedReasons.push(`COST_INVALID:${declarationCosts.非法项.join('|')}`);
    if (paymentMode === 'FORMAL' && Object.values(declarationCosts.values).some(rawCost => Number(String(rawCost).replace(/%$/, '')) > 1e-9)) {
      requiresSequentialProjection = true;
    }
    if (
      declaration?.irreversibleAsset &&
      typeof declaration.irreversibleAsset === 'object'
    ) {
      // Inventory consumption changes the projected unit and must be evaluated
      // through the sequential overlay, just like a formal resource payment.
      requiresSequentialProjection = true;
    }
    const targetIds = Object.freeze(
      (Array.isArray(declaration?.targetIds)
        ? declaration.targetIds
        : []
      )
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const fusionParticipantIds = Object.freeze(
      (Array.isArray(declaration?.fusionParticipantIds)
        ? declaration.fusionParticipantIds
        : []
      )
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const fusionPartnerIds = Object.freeze(
      (Array.isArray(declaration?.fusionPartnerIds)
        ? declaration.fusionPartnerIds
        : []
      )
        .map(value => String(value || '').trim())
        .filter(Boolean),
    );
    const frozenEffects = Object.freeze(
      effects.map(effect => Object.freeze(cloneValue(effect))),
    );
    const declarationView = Object.freeze({
      actorId,
      actionKind,
      targetIds,
      resourceCosts: Object.freeze({
        ...(
          declaration?.resourceCosts &&
          typeof declaration.resourceCosts === 'object'
            ? declaration.resourceCosts
          : {}
        ),
      }),
      fusionKey: String(declaration?.fusionKey || '').trim(),
      fusionParticipantIds,
      fusionPartnerIds,
      irreversibleAsset:
        declaration?.irreversibleAsset &&
        typeof declaration.irreversibleAsset === 'object'
          ? Object.freeze(cloneValue(declaration.irreversibleAsset))
          : null,
      __skipInventoryConsume: declaration?.__skipInventoryConsume === true,
      skill: Object.freeze({
        ...(
          declaration?.skill &&
          typeof declaration.skill === 'object'
            ? declaration.skill
            : {}
        ),
        _效果数组: frozenEffects,
      }),
      actionId,
      ...(declaration.__structuredSourceEffectId ? { __structuredSourceEffectId: declaration.__structuredSourceEffectId } : {}),
      __includeGrantedEffects:
        declaration?.__includeGrantedEffects !== false && String(input?.actionRole || declaration?.actionRole || '').trim().toUpperCase() !== 'STATE_TICK',
    });
    return Object.freeze({
      schemaVersion: 'MechanicalBasisV2',
      identity: String(
        input?.identity ||
        `mechanical-basis:${stableHash({
          actorId,
          actionKind,
          targetIds,
          paymentMode,
          resourceCosts: declarationView.resourceCosts,
          fusionKey: declarationView.fusionKey,
          fusionParticipantIds: declarationView.fusionParticipantIds,
          fusionPartnerIds: declarationView.fusionPartnerIds,
          effects: frozenEffects,
          sideEffects: declarationView.skill.副作用列表,
          ...(actionKind === 'USE_ITEM' ? { itemConsumption: declarationView.skill.使用后消耗,
            irreversibleAsset: declarationView.irreversibleAsset, skipInventoryConsume: declarationView.__skipInventoryConsume } : {}),
          structuredSourceEffectId: declarationView.__structuredSourceEffectId,
          ...(declarationView.__includeGrantedEffects === false ? { includeGrantedEffects: false } : {}),
        })}`,
      ).trim(),
      actorId,
      actionKind,
      targetIds,
      paymentMode,
      declaration: declarationView,
      effects: frozenEffects,
      creationCarriers: Object.freeze(
        creationCarriers.map(carrier => Object.freeze({
          ...carrier,
          useEffects: Object.freeze(
            carrier.useEffects.map(effect => Object.freeze(effect)),
          ),
        })),
      ),
      requiresSequentialProjection,
      unsupportedReasons: Object.freeze([
        ...new Set(unsupportedReasons),
      ].sort()),
    });
  }

  function mechanicalBasisStateMarginal(target = {}, effect = {}) {
    if (
      Number(effect?.__previewApplicationProbability ?? 1) <= 1e-12
    ) {
      return false;
    }
    const existingEntry = findStateEntry(target, effect);
    if (!existingEntry) return true;
    const existing = existingEntry[1] || {};
    if (String(effect?.原型 || '').trim() === '状态施加') {
      return root.__LWCS_BATTLE_RUNTIME__.mergeRuntimeCondition(existing, { duration: Math.max(1, Number(effect?.持续回合 || 1)) }, effect).applied;
    }
    const stackable =
      effect?.可叠加 === true ||
      /叠加|层数/.test(
        String(effect?.叠加规则 || effect?.层数规则 || ''),
      );
    if (stackable) return true;
    const requestedDuration = Math.max(
      1,
      Number(effect?.持续回合 || 1),
    );
    const existingDuration = Math.max(
      0,
      Number(
        existing?.duration ??
        existing?.持续回合 ??
        existing?.剩余回合 ??
        0,
      ),
    );
    return (
      effect?.刷新 === true ||
      effect?.可刷新 === true ||
      requestedDuration > existingDuration
    );
  }

  function evaluateDirectMechanicalBasis({
    basis,
    worldSnapshot,
    projectionContext,
    actor,
    actorProfile,
    battleIntent,
    basisView = 'DECISION_VISIBLE',
    snapshotRevision = '',
    captureDamageBasisTrace = false,
    environmentContext = null,
  }) {
    const contributions = [];
    const changedUnitIds = new Set();
    const rootActionId = canonicalActionId(
      basis.declaration,
      basis.identity || 'mechanical',
    );
    const sourceActionId = rootActionId;
    const addContribution = (effectInstanceId, contribution) => {
      const resolvedEffectInstanceId = String(effectInstanceId || '').trim();
      if (!resolvedEffectInstanceId) {
        throw new Error('R9V2_PREVIEW_EFFECT_IDENTITY_MISSING');
      }
      contributions.push(Object.freeze({
        ...contribution,
        rootActionId,
        sourceActionId,
        actorId: unitId(actor),
        effectInstanceId: resolvedEffectInstanceId,
      }));
    };
    const resourceOverrides = new Map();
    const readProjectedResource = (unit, resource) => {
      const key = `${unitId(unit)}\u0000${resource}`;
      return resourceOverrides.has(key)
        ? resourceOverrides.get(key)
        : readResource(unit, resource);
    };
    const writeProjectedResource = (unit, resource, value) => {
      resourceOverrides.set(
        `${unitId(unit)}\u0000${resource}`,
        value,
      );
    };
    const irreversibleAssetOutcome =
      buildMechanicalIrreversibleAssetOutcome(
        actor,
        basis.declaration,
        rootActionId,
      );
    if (irreversibleAssetOutcome) {
      addContribution(
        irreversibleAssetOutcome.effectInstanceId,
        irreversibleAssetOutcome,
      );
      changedUnitIds.add(unitId(actor));
    }
    if (basis.paymentMode === 'FORMAL') {
      const normalizedCosts = normalizeSkillCostMap(basis.declaration.resourceCosts || {});
      if (normalizedCosts.非法项.length) throw new Error(`battle_preview_cost_invalid:${normalizedCosts.非法项.join('|')}`);
      Object.entries(normalizedCosts.values).forEach(([resource, rawCost]) => {
        const before = withPreviewDependencyRole(
          'PAYMENT_AFFORDABILITY',
          () => readProjectedResource(actor, resource),
        );
        const payment = assessResourcePayment([actor], { [resource]: rawCost }, {
          resourceOverrides: { [resource]: before },
        });
        if (!payment.valid) throw new Error(`battle_preview_cost_invalid:${payment.reason}`);
        if (!payment.ok) throw new Error(`battle_preview_resource_insufficient:${resource}`);
        const cost = Number(payment.payments[0]?.amount || 0);
        if (!(cost > 1e-9)) return;
        const next = before - cost;
        writeProjectedResource(actor, resource, next);
        changedUnitIds.add(unitId(actor));
        addContribution(`${rootActionId}:cost:${resource}`, {
          targetId: unitId(actor),
          outcomeKind: 'RESOURCE_OPTION_CHANGED',
          windowId: 'ACTION_COST',
          expectedDelta: -cost,
          evidence: Object.freeze({ resource, before, next, delta: -cost }),
        });
      });
    }
    if (basis.actionKind === 'WITHDRAW') {
      const contest = buildWithdrawalContest(worldSnapshot, actor);
      contributions.push(Object.freeze({
        rootActionId: String(
          basis.declaration?.actionId ||
          basis.identity ||
          '',
        ).trim(),
        sourceActionId: String(
          basis.declaration?.actionId ||
          basis.identity ||
          '',
        ).trim(),
        actorId: unitId(actor),
        effectInstanceId: `${String(
          basis.declaration?.actionId ||
          basis.identity ||
          'withdrawal',
        ).trim()}:withdrawal-contest`,
        targetId: unitId(actor),
        windowId: 'CURRENT_OPPORTUNITY',
        outcomeKind: 'WITHDRAWAL_CONTEST',
        expectedDelta: -contest.expectedPursuitDamage,
        evidence: Object.freeze({
          ...contest,
          delta: -contest.expectedPursuitDamage,
        }),
      }));
      if (contest.expectedPursuitDamage > 1e-9) {
        changedUnitIds.add(unitId(actor));
      }
    }
    basis.effects.forEach((effect, effectIndex) => {
      const prototype = String(effect?.原型 || '').trim();
      if (
        !prototype &&
        Array.isArray(effect?.使用效果) &&
        effect.使用效果.length
      ) {
        return;
      }
      const effectInstanceId = canonicalEffectId(
        effect,
        rootActionId,
        effectIndex,
      );
      const targets = resolveTargets(
        worldSnapshot,
        actor,
        basis.declaration,
        effect,
        projectionContext,
      );
      targets.forEach(target => {
        if (!effectSourceRestrictionAllows(effect, environmentContext)) return;
        if (
          !effectConditionEnabled(
            effect,
            worldSnapshot,
            actor,
            target,
          )
        ) {
          return;
        }
        const targetId = unitId(target);
        const windowId =
          `round:${Number(worldSnapshot?.回合 || 0)}:effect:${effectIndex}`;
        if (prototype === '伤害结算') {
          const damageBasis = buildDamageBasis(
            effect,
            actor,
            target,
            projectionContext,
            {
              basisView,
              effectInstanceId,
              sourceEffectId: effectInstanceId,
              sourceActionId,
              snapshotRevision: String(snapshotRevision || basis.identity || '').trim(),
              actionDamageMultiplier: 1,
              targetCount: targets.length,
              reactionDamageMultiplier: 1,
              resourceDriveEnabled: String(basis.actionKind || '').trim().toUpperCase() !== 'BASIC_ATTACK',
            },
          );
          assertDamageBasis(damageBasis, { basisView });
          const rawDamage = damageBasis.operands.rawDamage;
          const damageBasisEvidence = damageBasisMetadata(damageBasis, {
            includeFormulaTrace: captureDamageBasisTrace === true,
            diagnostic: captureDamageBasisTrace === true,
          });
          const hitProbability = estimateHitProbability(
            actor,
            target,
            effect,
            projectionContext,
            environmentContext,
          );
          const segments = Math.max(
            1,
            Math.floor(
              Number(effect?.攻击段数 ?? effect?.段数 ?? 1),
            ) || 1,
          );
          const perSegmentDamage = calculateSettledSegmentDamage(
            rawDamage,
            segments,
            1,
          );
          const nonlethalIntent =
            /点到为止|切磋|训练|非致命/.test(
              String(
                battleIntent?.mode ||
                battleIntent ||
                '',
              ).trim(),
            );
          const nonlethalHpFloor = nonlethalIntent
            ? calculateNonlethalHpFloor(
                worldSnapshot,
                target,
                battleIntent || {},
              )
            : 0;
          const hpDamageLimit = nonlethalIntent
            ? Math.max(0, readHp(target) - nonlethalHpFloor)
            : readHp(target);
          const shieldBefore = readShield(target);
          const damageExpectation = expectedSegmentedDamageOutcome({
            segments,
            perSegmentDamage,
            hitProbability,
            applicationProbability: 1,
            shieldBefore,
            hpDamageLimit,
          });
          const shieldAbsorb =
            damageExpectation.expectedShieldAbsorb;
          const expectedDamage = damageExpectation.expectedHpDamage;
          if (shieldAbsorb > 0) {
            addContribution(effectInstanceId, {
              targetId,
              outcomeKind: 'SHIELD_DELTA',
              windowId,
              expectedDelta: -shieldAbsorb,
              evidence: Object.freeze({
                current: shieldBefore,
                next: Math.max(0, shieldBefore - shieldAbsorb),
                delta: -shieldAbsorb,
                absorbedDamage: shieldAbsorb,
              }),
            });
          }
          addContribution(effectInstanceId, {
            targetId,
            outcomeKind: 'HP_DELTA',
            windowId,
            expectedDelta: -expectedDamage,
            evidence: Object.freeze({
              rawDamage,
              hitProbability,
              applicationProbability: 1,
              evadeProbability: 0,
              reactionDamageMultiplier: 1,
              perSegmentDamage,
              incomingDamage: damageExpectation.expectedIncoming,
              shieldAbsorb,
              expectedDamage,
              fullHitIncoming:
                damageExpectation.fullHitIncoming,
              fullHitShieldAbsorb:
                damageExpectation.fullHitShieldAbsorb,
              fullHitDamage: damageExpectation.fullHitHpDamage,
              damageBasis: damageBasisEvidence,
              outcomeDistribution:
                damageExpectation.outcomeDistribution,
              delta: -expectedDamage,
              current: readHp(target),
              next: Math.max(0, readHp(target) - expectedDamage),
            }),
          });
          const traumaBranches =
            damageExpectation.outcomeDistribution.filter(branch =>
              shouldTriggerTraumaUnconscious(
                Number(branch.hpDamage || 0),
                readHp(target) - Number(branch.hpDamage || 0),
                readHpMax(target),
              ),
            );
          const traumaProbability = traumaBranches.reduce(
            (sum, branch) =>
              sum + Number(branch.probability || 0),
            0,
          );
          const nonlethalIncapacitated =
            nonlethalIntent &&
            nonlethalHpFloor <= 1 &&
            hpDamageLimit > 0 &&
            expectedDamage >= hpDamageLimit - 1e-9;
          if (nonlethalIncapacitated) {
            addContribution(effectInstanceId, {
              targetId,
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'NONLETHAL_INCAPACITATION',
              evidence: Object.freeze({
                reason: 'NONLETHAL_INCAPACITATION',
                hpFloor: nonlethalHpFloor,
                hitProbability,
              }),
            });
          }
          if (traumaProbability > 1e-9) {
            addContribution(effectInstanceId, {
              targetId,
              outcomeKind: 'ACTION_CANCELLED',
              windowId: 'TRAUMA_UNCONSCIOUS',
              evidence: Object.freeze({
                reason: 'TRAUMA_UNCONSCIOUS',
                probability: traumaProbability,
                traumaProbability,
                hitProbability,
                fullHitDamage:
                  damageExpectation.fullHitHpDamage,
                hpAfter:
                  readHp(target) -
                  damageExpectation.fullHitHpDamage,
                hpMax: readHpMax(target),
              }),
            });
          }
          if (
            expectedDamage > 1e-9 ||
            shieldAbsorb > 1e-9
          ) {
            changedUnitIds.add(targetId);
          }
          return;
        }
        if (prototype === '资源变化') {
          const resourceKeys = normalizedResourceKeys(effect?.资源 || '魂力');
          const multiResource = resourceKeys.length > 1;
          resourceKeys.forEach(resourceKey => {
            const resource = resourceLabel(resourceKey);
            const isHp = resourceKey === 'hp';
            const current = isHp
              ? readHp(target)
              : readProjectedResource(target, resource);
            const maximum = isHp ? readHpMax(target) : readResourceMax(target, resource);
            const realizedNext = clamp(
              current + parseSignedValue(effect?.数值, maximum),
              0,
              maximum,
            );
            const delta = realizedNext - current;
            if (!isHp) writeProjectedResource(target, resource, realizedNext);
            addContribution(effectInstanceId, {
              targetId,
              outcomeKind: isHp ? 'HP_DELTA' : 'RESOURCE_OPTION_CHANGED',
              windowId,
              expectedDelta: delta,
              evidence: Object.freeze({
                resource,
                ...(multiResource ? { resourceKey } : {}),
                current,
                next: realizedNext,
                delta,
                realizedDelta: delta,
                applicationProbability: 1,
                ownApplicationProbability: 1,
              }),
            });
            if (Math.abs(delta) > 1e-9) changedUnitIds.add(targetId);
          });
          return;
        }
        if (prototype === '状态施加') {
          const applicationProbability =
            normalizeEffectProbability(
              effect?.成功率 ?? effect?.触发概率,
              1,
            );
          const projectedEffect = {
            ...effect,
            __previewApplicationProbability:
              applicationProbability,
          };
          const marginal = mechanicalBasisStateMarginal(
            target,
            projectedEffect,
          );
          const combatEffect = deriveStateCombatEffect(effect);
          const cancelsAction =
            marginal &&
            (
              combatEffect?.skip_turn === true ||
              combatEffect?.cannot_act === true
            );
          const requestedDuration = Math.max(
            1,
            Number(effect?.持续回合 || 1),
          );
          const existingStateEntry = findStateEntry(target, effect);
          const existingState = existingStateEntry?.[1] || null;
          const applicationGroupKey = [
            basis.identity,
            effectInstanceId,
            targetId,
            'state-application',
          ].join('|');
          addContribution(effectInstanceId, {
            targetId,
            outcomeKind: cancelsAction
              ? 'ACTION_CANCELLED'
              : 'STATE_CHANGED',
            windowId,
            evidence: Object.freeze({
              prototype,
              state: String(effect?.状态 || '').trim(),
              duration: requestedDuration,
              applicationProbability,
              ownApplicationProbability:
                applicationProbability,
              cancelsAction,
              marginal,
              projectedEffect: Object.freeze(cloneValue(effect)),
              distributionGroupKey: applicationGroupKey,
              combatEffect: Object.freeze({
                ...combatEffect,
              }),
            }),
          });
          const periodic = marginal && applicationProbability > 1e-12
            ? periodicStateMarginal(target, existingState, effect, combatEffect) : null;
          if (periodic) {
            const { damagePerTick, healingPerTick, tickCount, tickDeltas, realizedDamage, realizedHealing } = periodic;
            if (tickDeltas.some(delta => Math.abs(delta) > 1e-12)) {
              const realizedDelta =
                realizedHealing - realizedDamage;
              const expectedDamage =
                realizedDamage * applicationProbability;
              const expectedHealing =
                realizedHealing * applicationProbability;
              const expectedDelta =
                expectedHealing - expectedDamage;
              const scheduledEffectInstanceId =
                `${effectInstanceId}:scheduled-dot`;
              addContribution(`${effectInstanceId}:scheduled-dot`, {
                targetId,
                outcomeKind: 'SCHEDULED_HP_DELTA',
                windowId: [
                  scheduledEffectInstanceId,
                  targetId,
                  tickCount,
                ].join(':'),
                expectedDelta,
                evidence: Object.freeze({
                  prototype,
                  state: String(effect?.状态 || '').trim(),
                  delta: expectedDelta,
                  expectedDamage,
                  expectedHealing,
                  damagePerTick,
                  healingPerTick,
                  tickCount,
                  tickDeltas,
                  realizedDelta,
                  periodicScope: 'ISOLATED_STATE_MERGE',
                  mergeKind: periodic.mergeKind,
                  duration: tickCount,
                  applicationProbability,
                  ownApplicationProbability:
                    applicationProbability,
                  outcomeDistribution: Object.freeze([
                    Object.freeze({
                      branchKey: 'state:resisted',
                      probability: 1,
                      conditionalOn: {
                        [applicationGroupKey]: 'RESISTED',
                      },
                      delta: 0,
                    }),
                    Object.freeze({
                      branchKey: 'state:hit',
                      probability: 1,
                      conditionalOn: {
                        [applicationGroupKey]: 'HIT',
                      },
                      delta: realizedDelta,
                    }),
                  ]),
                  distributionGroupKey: applicationGroupKey,
                }),
              });
            }
          }
          if (marginal) changedUnitIds.add(targetId);
        }
      });
    });
    basis.creationCarriers.forEach(carrier => {
      const recipientId = String(carrier?.recipientId || '').trim();
      if (!recipientId) return;
      addContribution(
        `${rootActionId}:effect:${Math.max(
          0,
          Number(carrier?.effectIndex || 0),
        )}:creation`,
        {
        targetId: recipientId,
        outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED',
        windowId:
          `round:${Number(worldSnapshot?.回合 || 0)}:effect:${Number(
            carrier?.effectIndex || 0,
          )}`,
        expectedDelta: 1,
        evidence: Object.freeze({
          delta: 1,
          productId: String(carrier?.productId || '').trim(),
          quantity: Math.max(1, Number(carrier?.quantity || 1)),
          recipientId,
          useEffectCount: Array.isArray(carrier?.useEffects)
            ? carrier.useEffects.length
            : 0,
          useEffects: cloneValue(carrier?.useEffects || []),
        }),
        },
      );
      changedUnitIds.add(recipientId);
    });
    return Object.freeze({
      schemaVersion: 'MechanicalBasisEvaluationV1',
      basisIdentity: basis.identity,
      actorId: basis.actorId,
      contributions: Object.freeze(contributions),
      changedUnitIds: Object.freeze([...changedUnitIds].sort()),
      summonDefinitions: Object.freeze([]),
    });
  }

  function evaluateMechanicalBasisImpl(input = {}) {
    const basis = input?.basis;
    const worldSnapshot = input?.worldSnapshot;
    const projectionContext =
      input?.mechanicalProjectionContext || null;
    if (
      !basis ||
      basis?.schemaVersion !== 'MechanicalBasisV2'
    ) {
      throw new TypeError('R9V2_MECHANICAL_BASIS_INVALID');
    }
    if (!worldSnapshot || typeof worldSnapshot !== 'object') {
      throw new TypeError('R9V2_MECHANICAL_BASIS_WORLD_MISSING');
    }
    const resolvedSnapshotRevision = String(
      input?.snapshotRevision ||
      [
        input?.revision ||
        basis.identity ||
        `world:${stableHash(worldSnapshot)}`,
        input?.beliefRevision || '',
      ]
        .filter(Boolean)
        .join('|'),
    ).trim();
    const basisView = String(
      input?.basisView || (input?.beliefSnapshot ? 'BELIEF' : 'DECISION_VISIBLE'),
    ).trim().toUpperCase();
    const snapshotRevision = resolvedSnapshotRevision;
    const captureDamageBasisTrace = input?.captureDamageBasisTrace === true;
    if (
      projectionContext &&
      (
        projectionContext.schemaVersion !==
          'MechanicalProjectionContextV1' ||
        projectionContext.worldSnapshot !== worldSnapshot
      )
    ) {
      throw new Error(
        'R9V2_MECHANICAL_PROJECTION_CONTEXT_WORLD_MISMATCH',
      );
    }
    if (basis.unsupportedReasons.length) {
      throw new Error(
        `R9V2_MECHANICAL_BASIS_UNSUPPORTED:${basis.unsupportedReasons.join(',')}`,
      );
    }
    const actorId = input?.actorId || basis.actorId;
    const actor =
      projectionContext?.unitById?.get(actorId) ||
      findUnit(worldSnapshot, actorId);
    const actorProfile = mechanicalProjectionProfile(
      projectionContext,
      actor,
    );
    if (
      !actor ||
      !(actorProfile ? actorProfile.battleCapable : isAlive(actor))
    ) {
      throw new Error('R9V2_MECHANICAL_BASIS_ACTOR_UNAVAILABLE');
    }
    if (
      basis.declaration.skill?.__mechanismGrantTemporarySkill === true ||
      basis.effects.some(effect => effect.原型 === '伤害结算' && resolveTargets(worldSnapshot, actor, basis.declaration, effect).some(target => hasDamageRevival(target, true) || counterDamageRatio(target) > 0 || ruleBlockCount(target) > 0)) ||
      (basis.declaration.__includeGrantedEffects !== false &&
      (
        actorProfile
          ? actorProfile.hasPendingGrantedEffects || (String(basis.declaration.actionKind || '').trim().toUpperCase() === 'RELEASE_SKILL' && actorProfile.hasPendingSkillGrantedEffects)
          : pendingGrantedEffects(actor, basis.declaration.actionKind).length > 0
      ))
    ) {
      const projected = previewAction({ ...input, worldSnapshot, actorId, declaration: basis.declaration,
        paymentMode: basis.paymentMode, cacheResult: false, buildOperationGraph: false });
      return Object.freeze({
        schemaVersion: 'MechanicalBasisEvaluationV1', basisIdentity: basis.identity, actorId,
        contributions: projected.contributions, changedUnitIds: projected.changedUnitIds,
        summonDefinitions: Object.freeze(listUnits(projected.afterSnapshot)
          .filter(({ unit }) => isSummonUnit(unit) && !findUnit(worldSnapshot, unitId(unit))).map(({ unit }) => Object.freeze(cloneValue(unit)))),
        ...(input.captureProjectedUnits ? { projectedUnitSnapshots: Object.freeze(projected.changedUnitIds.map(id => ({
          unitId: id, unit: findUnit(projected.afterSnapshot, id),
        })).filter(row => row.unit).map(row => Object.freeze({ unitId: row.unitId, unit: Object.freeze(cloneValue(row.unit)) }))) } : {}),
      });
    }
    const environmentContext = assessWorldAction({
      ...input,
      worldSnapshot,
      actor,
      actorId,
      declaration: basis.declaration,
      startupCosts: basis.declaration?.resourceCosts,
      sustainCosts: basis.declaration?.sustainCosts,
      durationTicks: readActionDurationTicks(input, basis.declaration),
    });
    if (input?.worldActionContext !== undefined && environmentContext.status !== 'resolved') {
      throw new Error('battle_world_action_context_unavailable');
    }
    if (environmentContext.blocked) throw createEnvironmentBlockError(environmentContext);
    if (
      basis.paymentMode === 'FORMAL' &&
      Array.isArray(basis.declaration?.fusionPartnerIds) &&
      basis.declaration.fusionPartnerIds.length
    ) {
      const currentRound = Math.max(
        0,
        Number(worldSnapshot?.回合 || 0),
      );
      for (const partnerId of basis.declaration.fusionPartnerIds) {
        const partner = findUnit(worldSnapshot, partnerId);
        if (!partner) {
          throw new Error('battle_preview_fusion_partner_missing');
        }
        if (sideOf(worldSnapshot, partner) !== sideOf(worldSnapshot, actor)) {
          throw new Error('battle_preview_fusion_partner_hostile');
        }
        if (!isBattleCapable(partner)) {
          throw new Error('battle_preview_fusion_partner_unavailable');
        }
        const opportunity = partner?.__battleRuntime?.naturalOpportunity;
        if (
          !opportunity ||
          Number(opportunity?.round || 0) !== currentRound ||
          String(opportunity?.status || '').trim() !== 'PENDING'
        ) {
          throw new Error(
            'battle_preview_fusion_partner_opportunity_unavailable',
          );
        }
      }
    }
    const damageMultiplierOverrides =
      input?.damageMultiplierByTarget instanceof Map
        ? input.damageMultiplierByTarget.size
        : Object.keys(input?.damageMultiplierByTarget || {}).length;
    const evadeProbabilityOverrides =
      input?.evadeProbabilityByTarget instanceof Map
        ? input.evadeProbabilityByTarget.size
        : Object.keys(input?.evadeProbabilityByTarget || {}).length;
    const requiresSequentialProjection =
      basis.requiresSequentialProjection === true ||
      input?.captureProjectedUnits === true ||
      damageMultiplierOverrides > 0 ||
      evadeProbabilityOverrides > 0 ||
      typeof input?.damageMultiplierResolver === 'function' ||
      typeof input?.hitProbabilityResolver === 'function';
    if (!requiresSequentialProjection) {
      return evaluateDirectMechanicalBasis({
        basis,
        worldSnapshot,
        projectionContext,
        actor,
        actorProfile,
        battleIntent: input?.battleIntent || {},
        basisView: input?.basisView || (input?.beliefSnapshot ? 'BELIEF' : 'DECISION_VISIBLE'),
        snapshotRevision: resolvedSnapshotRevision,
        captureDamageBasisTrace: input?.captureDamageBasisTrace === true,
        environmentContext,
      });
    }
    const rootActionId = String(
      basis.declaration?.actionId ||
      basis.declaration?.candidateId ||
      `preview:${buildCacheKey({
        worldSnapshot,
        actorId,
        declaration: basis.declaration,
        paymentMode: basis.paymentMode,
        worldRevision: basis.identity,
        actionFingerprint: basis.identity,
        collectProbabilityBranches: true,
        horizon: 'SHALLOW',
      })}`,
    ).trim();
    const overlay = new PreviewOverlay(
      worldSnapshot,
      String(input?.revision || basis.identity || '').trim(),
    );
    if (!(basis.declaration.__structuredSourceActionId && basis.declaration.__includeGrantedEffects === false && basis.declaration.__skipInventoryConsume === true)) {
      for (const { unit } of listUnits(worldSnapshot)) if (unit.__本阶段已触发复活) overlay.changeUnit(unitId(unit), target => { delete target.__本阶段已触发复活; });
    }
    const ledger = new ContributionLedger();
    const changedUnitIds = new Set();
    const irreversibleAssetOutcome =
      buildMechanicalIrreversibleAssetOutcome(
        actor,
        basis.declaration,
        rootActionId,
      );
    if (irreversibleAssetOutcome) {
      ledger.addOutcome({
        rootActionId,
        sourceActionId: rootActionId,
        actor,
        declaration: basis.declaration,
        ...irreversibleAssetOutcome,
      });
      if (
        String(basis.declaration?.actionKind || '').trim().toUpperCase() ===
          'USE_ITEM' &&
        basis.declaration?.__skipInventoryConsume !== true
      ) {
        overlay.changeUnit(actorId, unit => {
          const inventoryItem = findInventoryEntry(
            unit,
            basis.declaration,
          );
          const quantityBefore = Math.max(
            0,
            Number(inventoryItem?.数量 ?? inventoryItem?.quantity ?? 0),
          );
          if (!inventoryItem || quantityBefore < 1) {
            throw new Error(
              `battle_preview_item_unavailable:${String(
                basis.declaration?.irreversibleAsset?.assetId ||
                  basis.declaration?.skill?.name ||
                  '',
              ).trim()}`,
            );
          }
          const remainingQuantity = quantityBefore - 1;
          if (
            inventoryItem.数量 !== undefined ||
            inventoryItem.quantity === undefined
          ) {
            inventoryItem.数量 = remainingQuantity;
          }
          if (inventoryItem.quantity !== undefined) {
            inventoryItem.quantity = remainingQuantity;
          }
        });
      }
      changedUnitIds.add(actorId);
    }
    if (basis.paymentMode === 'FORMAL') {
      const paymentPayerIds = (
        Array.isArray(basis.declaration?.fusionParticipantIds) &&
        basis.declaration.fusionParticipantIds.length
          ? basis.declaration.fusionParticipantIds
          : [actorId]
      ).map(value => String(value || '').trim()).filter(Boolean);
      const normalizedCosts = normalizeSkillCostMap(basis.declaration.resourceCosts || {});
      if (normalizedCosts.非法项.length) throw new Error(`R9V2_MECHANICAL_BASIS_COST_INVALID:${normalizedCosts.非法项.join('|')}`);
      const paymentRows = [];
      paymentPayerIds.forEach((payerId, payerIndex) => {
        const payer = projectionContext?.unitById?.get(payerId) || findUnit(worldSnapshot, payerId);
        if (!payer) throw new Error(`R9V2_MECHANICAL_BASIS_FUSION_PARTICIPANT_UNAVAILABLE:${payerId}`);
        const currentPayer = overlay.readUnit(payerId) || payer;
        Object.entries(normalizedCosts.values).forEach(([resource, rawCost], resourceIndex) => {
          const before = withPreviewDependencyRole('PAYMENT_AFFORDABILITY', () => readResource(currentPayer, resource));
          const payment = assessResourcePayment([currentPayer], { [resource]: rawCost }, { resourceOverrides: { [resource]: before } });
          if (!payment.valid) throw new Error(`R9V2_MECHANICAL_BASIS_COST_INVALID:${payment.reason}`);
          if (!payment.ok) throw new Error(`battle_preview_resource_insufficient:${resource}`);
          const cost = Number(payment.payments[0]?.amount || 0);
          if (cost > 1e-9) paymentRows.push({ payerId, payer, payerIndex, resourceIndex, resource, before, cost });
        });
      });
      paymentRows.forEach(({ payerId, payer, payerIndex, resourceIndex, resource, before, cost }) => {
        const next = before - cost;
        overlay.setResource(payerId, resource, next);
        changedUnitIds.add(payerId);
        ledger.addOutcome({
          rootActionId,
          sourceActionId: rootActionId,
          actor: payer,
          declaration: basis.declaration,
          effectInstanceId: `${rootActionId}:cost:${payerIndex}:${resourceIndex}`,
          targetId: payerId,
          outcomeKind: 'RESOURCE_OPTION_CHANGED',
          windowId: 'ACTION_COST',
          threatValue: 0,
          evidence: { resource, before, next, delta: -cost, payerIndex, fusionKey: basis.declaration?.fusionKey || '' },
        });
      });
    }
    const primarySuccessProbability = new Map();
    const primaryOutcomeKeyByTarget = new Map();
    const primaryOutcomeDistributionByTarget = new Map();
    const nodeBudget = {
      count: 0,
      limit: MAX_PREVIEW_NODES,
      activeFingerprints: new Set(),
    };
    basis.effects.forEach((effect, effectIndex) => {
      if (
        !String(effect?.原型 || '').trim() &&
        Array.isArray(effect?.使用效果) &&
        effect.使用效果.length
      ) {
        return;
      }
      const effectWorldSnapshot = overlay.snapshot();
      const effectActor = overlay.readUnit(actorId) || actor;
      const effectProjectionContext =
        compileMechanicalProjectionContext(effectWorldSnapshot);
      const targets = resolveTargets(
        effectWorldSnapshot,
        effectActor,
        basis.declaration,
        effect,
        effectProjectionContext,
      );
      if (!targets.length) return;
      const followsPrimary =
        effectIndex > 0 &&
        String(effect?.生效方式 || '').trim() === '跟随主原型';
      const positionObject = String(effect?.原型 || '').trim() === '位移执行'
        ? String(effect?.位移对象 || '').trim()
        : '';
      const primaryReferenceTargetId = target => {
        const targetId = unitId(target);
        if (!['自身', '自身与目标'].includes(positionObject) || targetId !== actorId) return targetId;
        return (Array.isArray(basis.declaration?.targetIds) ? basis.declaration.targetIds : [])
          .map(value => String(value || '').trim())
          .find(value => value && value !== actorId && primarySuccessProbability.has(value)) || targetId;
      };
      const effectInstanceId = canonicalEffectId(
        effect,
        rootActionId,
        effectIndex,
      );
      const context = {
        actor: effectActor,
        declaration: basis.declaration,
        worldSnapshot: effectWorldSnapshot,
        nodeBudget,
        depth: 0,
        effectPath: [],
        rootActionId,
        effectInstanceId,
        windowId:
          `round:${Number(worldSnapshot?.回合 || 0)}:effect:${effectIndex}`,
        battleIntent: input?.battleIntent || {},
        actionDamageMultiplier: 1,
        damageMultiplierByTarget:
          input?.damageMultiplierByTarget || {},
        evadeProbabilityByTarget:
          input?.evadeProbabilityByTarget || {},
        damageMultiplierResolver:
          input?.damageMultiplierResolver,
        applicationProbabilityResolver:
          input?.applicationProbabilityResolver,
        settleStateEndRisks: input?.settleStateEndRisks,
        hitProbabilityResolver:
          input?.hitProbabilityResolver,
        forcedApplicationProbabilityByEffect:
          input?.forcedApplicationProbabilityByEffect || {},
        basisView: input?.basisView || (input?.beliefSnapshot ? 'BELIEF' : 'DECISION_VISIBLE'),
        snapshotRevision: resolvedSnapshotRevision,
        projectionContext: effectProjectionContext,
        environmentContext,
        captureDamageBasisTrace: input?.captureDamageBasisTrace === true,
        primaryResolvedEffectByTarget: effectIndex === 0 ? new Map() : undefined,
        primarySucceeded: false,
        primaryOutcomeKeyByTarget,
        primaryOutcomeDistributionByTarget,
      };
      context.primarySucceededByTarget = new Map(
        targets.map(target => [
          unitId(target),
          primarySuccessProbability.get(primaryReferenceTargetId(target)) >= 1 - 1e-9,
        ]),
      );
      context.primarySuccessProbabilityByTarget = new Map(
        targets.map(target => [
          unitId(target),
          primarySuccessProbability.get(primaryReferenceTargetId(target)),
        ]),
      );
      context.primaryOutcomeByTarget = new Map(
        targets.map(target => {
          const distribution =
            primaryOutcomeDistributionByTarget.get(primaryReferenceTargetId(target)) || [];
          return [
            unitId(target),
            distribution.length === 1
              ? String(distribution[0]?.outcome || '').trim().toUpperCase()
              : '',
          ];
        }),
      );
      const hasOwnApplicationProbability =
        effect?.成功率 !== undefined ||
        effect?.触发概率 !== undefined;
      const ownApplicationProbabilityByTarget = new Map(
        targets.map(target => [
          unitId(target),
          hasOwnApplicationProbability
            ? normalizeEffectProbability(
                effect?.成功率 ?? effect?.触发概率,
                1,
              )
            : 1,
        ]),
      );
      context.ownApplicationProbabilityByTarget =
        ownApplicationProbabilityByTarget;
      if (followsPrimary) {
        context.applicationProbabilityByTarget = new Map(
          targets.map(target => [
            unitId(target),
            clamp(
              Number(
                primarySuccessProbability.get(primaryReferenceTargetId(target)) ?? 0,
              ),
              0,
              1,
            ),
          ]),
        );
        context.requiredOutcomeKeyByTarget = new Map(
          targets.map(target => [
            unitId(target),
            primaryOutcomeKeyByTarget.get(primaryReferenceTargetId(target)) || '',
          ]),
        );
        context.requiredOutcomeValuesByTarget = new Map(
          targets.map(target => [unitId(target), ['HIT']]),
        );
        context.requiredOutcomeUniverseByTarget = new Map(
          targets.map(target => [
            unitId(target),
            (
              primaryOutcomeDistributionByTarget.get(primaryReferenceTargetId(target)) || []
            )
              .map(row =>
                String(row?.outcome || '').trim().toUpperCase()
              )
              .filter(Boolean),
          ]),
        );
      } else if (effectIndex === 0) {
        context.outcomeAssignmentKeyByTarget = new Map(
          targets.map(target => {
            const targetId = unitId(target);
            const key = [
              rootActionId,
              effectInstanceId,
              context.windowId,
              targetId,
              'primary-resolution',
            ].join('|');
            primaryOutcomeKeyByTarget.set(targetId, key);
            return [targetId, key];
          }),
        );
      }
      if (
        !followsPrimary &&
        !['伤害结算', '状态施加', '判定修正', '结算修正', '资源锁定', '位移执行', '决策干扰'].includes(
          String(effect?.原型 || '').trim(),
        )
      ) {
        context.applicationProbabilityByTarget =
          ownApplicationProbabilityByTarget;
      }
      const effectOutcomeStart = ledger.entries.length;
      applyEffect(effect, targets, overlay, ledger, context, 0);
      targets.forEach(target => changedUnitIds.add(unitId(target)));
      if (effectIndex !== 0) return;
      [...new Set([...targets.map(unitId), ...context.primaryResolvedEffectByTarget.keys()])].forEach(targetId => {
        const target = findUnit(effectWorldSnapshot, targetId);
        const primary = context.primaryResolvedEffectByTarget.get(targetId);
        if (!primary) {
          primarySuccessProbability.set(targetId, 0);
          primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([Object.freeze({ outcome: 'MISS', probability: 1 })]));
          return;
        }
        const effect = primary.effect;
        const effectInstanceId = primary.effectInstanceId;
        const prototype = String(effect?.原型 || '').trim();
        const primaryEntries = ledger.entries.slice(effectOutcomeStart).filter(entry =>
          entry.targetId === targetId && entry.effectInstanceId === primary.effectInstanceId ||
          prototype === '召唤生成' && entry.actorId === targetId && entry.outcomeKind === 'SUMMON_WINDOW' && entry.effectInstanceId.startsWith(`${primary.effectInstanceId}:summon:`));
        const resolvedGroupKey = primaryEntries.find(entry => entry.evidence?.distributionGroupKey)?.evidence?.distributionGroupKey;
        if (resolvedGroupKey) primaryOutcomeKeyByTarget.set(targetId, resolvedGroupKey);
        if (prototype === '伤害结算') {
          const currentActor = overlay.readUnit(actorId) || effectActor;
          const currentTarget = overlay.readUnit(targetId) || target;
          const basePerSegment = estimateHitProbability(
            currentActor,
            currentTarget,
            effect,
            effectProjectionContext,
            environmentContext,
          );
          const resolvedPerSegment =
            typeof input?.hitProbabilityResolver === 'function'
              ? input.hitProbabilityResolver({
                  targetId,
                  actor: currentActor,
                  effect,
                  effectInstanceId,
                  baseHitProbability: basePerSegment,
                  recordDependency: recordPreviewDependency,
                })
              : null;
          const perSegment = clamp(
            resolvedPerSegment !== null &&
              resolvedPerSegment !== undefined &&
              Number.isFinite(Number(resolvedPerSegment))
              ? Number(resolvedPerSegment)
              : basePerSegment,
            0,
            1,
          );
          const segments = Math.max(
            1,
            Math.floor(
              Number(effect?.攻击段数 || effect?.段数 || 1),
            ) || 1,
          );
          const evadeProbability = clamp(
            Number(
              input?.evadeProbabilityByTarget?.get?.(targetId) ??
              input?.evadeProbabilityByTarget?.[targetId] ??
              0
            ),
            0,
            1,
          );
          const hitProbability =
            1 - Math.pow(1 - perSegment, segments);
          const distribution = [
            ...(evadeProbability > 1e-12
              ? [{
                  outcome: 'EVADED',
                  probability: evadeProbability,
                }]
              : []),
            ...(
              (1 - evadeProbability) * (1 - hitProbability) >
                1e-12
              ? [{
                  outcome: 'MISS',
                  probability:
                    (1 - evadeProbability) *
                    (1 - hitProbability),
                }]
              : []
            ),
            ...(
              (1 - evadeProbability) * hitProbability > 1e-12
              ? [{
                  outcome: 'HIT',
                  probability:
                    (1 - evadeProbability) * hitProbability,
                }]
              : []),
          ];
          primaryOutcomeDistributionByTarget.set(
            targetId,
            Object.freeze(
              distribution.map(row => Object.freeze(row)),
            ),
          );
          primarySuccessProbability.set(
            targetId,
            distribution
              .filter(row => row.outcome === 'HIT')
              .reduce(
                (sum, row) => sum + Number(row.probability || 0),
                0,
              ),
          );
        } else if (['状态施加', '判定修正', '结算修正', '资源锁定', '位移执行', '决策干扰'].includes(prototype)) {
          const applicationProbability =
            clamp(Number(primaryEntries.find(entry => entry.evidence?.applicationProbability !== undefined)?.evidence.applicationProbability ?? 0), 0, 1);
          primarySuccessProbability.set(
            targetId,
            applicationProbability,
          );
          primaryOutcomeDistributionByTarget.set(
            targetId,
            Object.freeze([
              ...(applicationProbability > 1e-12
                ? [Object.freeze({
                    outcome: 'HIT',
                    probability: applicationProbability,
                  })]
                : []),
              ...(applicationProbability < 1 - 1e-12
                ? [Object.freeze({
                    outcome: 'RESISTED',
                    probability: 1 - applicationProbability,
                  })]
                : []),
            ]),
          );
        } else {
          const realizedProbability = primaryResolutionProbabilityFromOutcomes(
            primaryEntries,
            targetId,
            prototype,
          );
          const primaryProbability = realizedProbability === null ? 1 : realizedProbability;
          primarySuccessProbability.set(targetId, primaryProbability);
          primaryOutcomeDistributionByTarget.set(
            targetId,
            Object.freeze([
              ...(primaryProbability > 1e-12
                ? [Object.freeze({ outcome: 'HIT', probability: primaryProbability })]
                : []),
              ...(primaryProbability < 1 - 1e-12
                ? [Object.freeze({ outcome: 'MISS', probability: 1 - primaryProbability })]
                : []),
            ]),
          );
        }
      });
    });
    basis.creationCarriers.forEach(carrier => {
      const recipientId = String(carrier?.recipientId || '').trim();
      if (!recipientId) return;
      const effectIndex = Math.max(
        0,
        Number.parseInt(String(carrier?.effectIndex ?? 0), 10) || 0,
      );
      const effectInstanceId = `${rootActionId}:effect:${effectIndex}`;
      ledger.addOutcome({
        rootActionId,
        sourceActionId: rootActionId,
        actor,
        declaration: basis.declaration,
        effectInstanceId,
        targetId: recipientId,
        outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED',
        windowId:
          `round:${Number(worldSnapshot?.回合 || 0)}:effect:${effectIndex}`,
        threatValue: 0,
        evidence: {
          delta: 1,
          productId: String(carrier?.productId || '').trim(),
          quantity: Math.max(1, Number(carrier?.quantity || 1)),
          recipientId,
          useEffectCount: Array.isArray(carrier?.useEffects)
            ? carrier.useEffects.length
            : 0,
          useEffects: cloneValue(carrier?.useEffects || []),
        },
      });
      changedUnitIds.add(recipientId);
    });
    applyImmediateSideEffects(basis.declaration, basis.effects, actor, overlay, ledger, rootActionId, input);
    settleImmediateCooperativeSummons({
      overlay,
      ledger,
      rootActionId,
      declaration: basis.declaration,
      worldSnapshot,
      nodeBudget,
      battleIntent: input?.battleIntent || {},
      basisView,
      snapshotRevision,
      projectionContext,
      captureDamageBasisTrace,
      damageMultiplierByTarget: input?.damageMultiplierByTarget || {},
      evadeProbabilityByTarget:
        input?.evadeProbabilityByTarget || {},
      damageMultiplierResolver: input?.damageMultiplierResolver,
      applicationProbabilityResolver: input?.applicationProbabilityResolver,
      hitProbabilityResolver: input?.hitProbabilityResolver,
      forcedApplicationProbabilityByEffect:
        input?.forcedApplicationProbabilityByEffect || {},
    });
    ledger.entries.forEach(entry => {
      const targetId = String(entry?.targetId || '').trim();
      if (targetId) changedUnitIds.add(targetId);
    });
    const summonDefinitions = Object.freeze(
      overlay
        .mergedScheduledEvents()
        .filter(event => event?.type === 'SUMMON_CREATE')
        .flatMap(event =>
          Array.isArray(event?.summonDefinitions)
            ? event.summonDefinitions
            : [],
        )
        .map(summon => Object.freeze(cloneValue(summon))),
    );
    const projectedUnitSnapshots =
      input?.captureProjectedUnits === true
        ? Object.freeze(
            [...overlay.mergedMap('changedUnits').entries()]
              .sort(([left], [right]) =>
                String(left).localeCompare(String(right))
              )
              .map(([projectedUnitId, unit]) =>
                Object.freeze({
                  unitId: String(projectedUnitId || '').trim(),
                  unit: Object.freeze(cloneValue(unit)),
                })
              ),
          )
        : null;
    return Object.freeze({
      schemaVersion: 'MechanicalBasisEvaluationV1',
      basisIdentity: basis.identity,
      actorId: basis.actorId,
      contributions: Object.freeze([...ledger.entries]),
      changedUnitIds: Object.freeze([...changedUnitIds].sort()),
      summonDefinitions,
      ...(projectedUnitSnapshots
        ? { projectedUnitSnapshots }
        : {}),
    });
  }

  function calculateBaseActionValue(actor = {}, target = {}, declaration = {}) {
    const projectionContext = declaration?.projectionContext ?? null;
    const effects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : Array.isArray(declaration?.skill?._效果数组) ? declaration.skill._效果数组.filter(effect => effect && typeof effect === 'object') : [];
    let remainingShieldAbsorptionCap = Number.isFinite(Number(declaration?.shieldAbsorptionCap))
      ? Math.max(0, Number(declaration.shieldAbsorptionCap))
      : Number.POSITIVE_INFINITY;
    return effects.filter(effect => effectConditionEnabled(effect, declaration?.worldSnapshot || {}, actor, target)).reduce((sum, effect) => {
      if (String(effect?.原型 || '').trim() === '伤害结算' && target) {
        const expectedDamage = calculateBaseDamage(effect, actor, target, projectionContext, {
          targetCount: declaration?.targetCount ?? declaration?.targetIds?.length,
          resourceDriveEnabled: String(declaration?.actionKind || '').trim().toUpperCase() !== 'BASIC_ATTACK',
        }) * estimateHitProbability(
          actor,
          target,
          effect,
          projectionContext,
          declaration?.environmentContext || null,
        );
        const availableHp = declaration?.capacityMode === true ? readHpMax(target) : readHp(target);
        return sum + Math.min(availableHp, expectedDamage) / readHpMax(target) * 100;
      }
      if (String(effect?.原型 || '').trim() === '资源变化' && /生命|HP/i.test(String(effect?.资源 || ''))) {
        const base = readHpMax(target || actor);
        const missing = base - readHp(target || actor);
        const recoverable = declaration?.capacityMode === true
          ? Math.min(base, missing + Math.max(0, Number(declaration?.healingOpportunityCap || 0)))
          : missing;
        const healing = Math.max(0, parseSignedValue(effect?.数值, base)) *
          healingMultiplierForUnit(target || actor, '生命');
        return sum + Math.min(recoverable, healing) / base * 100;
      }
      if (String(effect?.原型 || '').trim() === '护盾变化') {
        const base = readHpMax(target || actor);
        const realizedShield = Math.min(
          calculateShieldGain(target || actor, parseSignedValue(effect?.数值, base)),
          remainingShieldAbsorptionCap,
        );
        remainingShieldAbsorptionCap = Math.max(0, remainingShieldAbsorptionCap - realizedShield);
        return sum + realizedShield / base * 100;
      }
      if (
        String(effect?.原型 || '').trim() === '状态施加' &&
        /护盾|屏障|结界/.test(String(effect?.状态 || '').trim())
      ) {
        const base = readHpMax(target || actor);
        const realizedShield = Math.min(
          calculateShieldGain(target || actor, parseSignedValue(effect?.数值, base)),
          remainingShieldAbsorptionCap,
        );
        remainingShieldAbsorptionCap = Math.max(0, remainingShieldAbsorptionCap - realizedShield);
        return sum + realizedShield / base * 100;
      }
      return sum;
    }, 0);
  }

  function calculateUnitCapacity(input = {}) {
    const unit = input?.unit || {};
    if (!isAlive(unit)) return 0;
    const survivalFactor = clamp(input?.survivalProbability ?? readHp(unit) / readHpMax(unit), 0, 1);
    const actionAvailability = clamp(
      Number(input?.actionAvailability ?? 1) * Number(input?.environmentContext?.actionAvailability ?? 1),
      0,
      1,
    );
    if (input?.environmentContext?.blocked === true) return 0;
    const bestLegalBaseActionValue = Math.max(0, Number(input?.bestLegalBaseActionValue || 0));
    return survivalFactor * actionAvailability * bestLegalBaseActionValue;
  }

  function calculateDirectPotential(actor = {}, target = {}, declaration = {}) {
    return Math.max(0, calculateBaseActionValue(actor, target, { ...declaration, capacityMode: true }));
  }

  function calculateAtomicActionPotential(input = {}) {
    const frozenDirectPotential = input?.frozenDirectPotential && typeof input.frozenDirectPotential === 'object'
      ? input.frozenDirectPotential
      : {};
    const readFrozen = targetId => Math.max(0, Number(frozenDirectPotential[String(targetId || '').trim()] || 0));
    const contributions = Array.isArray(input?.contributions) ? input.contributions : [];
    const directPotential = Math.max(0, Number(input?.directPotential || 0));
    const denied = new Set();
    const granted = new Set();
    contributions.forEach(entry => {
      const outcomeKind = String(entry?.outcomeKind || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      if (!targetId) return;
      if (outcomeKind === 'ACTION_CANCELLED') denied.add(targetId);
      if (
        outcomeKind === 'ACTION_GRANTED' ||
        outcomeKind === 'SUMMON_WINDOW' ||
        (
          outcomeKind === 'RESOURCE_OPTION_CHANGED' &&
          Number(entry?.evidence?.delta || 0) > 0
        )
      ) granted.add(targetId);
    });
    const grantedPotential = [...granted].reduce((sum, targetId) => {
      const contribution = contributions.find(entry =>
        String(entry?.targetId || '').trim() === targetId &&
        String(entry?.outcomeKind || '').trim() === 'SUMMON_WINDOW'
      );
      return sum + (
        contribution
          ? Math.max(0, Number(contribution?.evidence?.actionPotential || 0))
          : readFrozen(targetId)
      );
    }, 0);
    return directPotential +
      [...denied].reduce((sum, targetId) => sum + readFrozen(targetId), 0) +
      grantedPotential;
  }

  function calculateSequencePotential(input = {}) {
    return Math.max(0, Number(input?.firstOpportunityPotential || 0)) +
      0.5 * Math.max(0, Number(input?.secondOpportunityPotential || 0));
  }

  function calculateTwoOpportunityCapacity(input = {}) {
    const unit = input?.unit || {};
    if (!isAlive(unit)) return 0;
    const survivalProbability = clamp(input?.survivalProbability ?? readHp(unit) / readHpMax(unit), 0, 1);
    const firstAvailability = clamp(input?.firstOpportunityAvailability ?? 1, 0, 1);
    const secondAvailability = clamp(input?.secondOpportunityAvailability ?? 1, 0, 1);
    return survivalProbability * (
      firstAvailability * Math.max(0, Number(input?.firstOpportunityPotential || 0)) +
      0.5 * secondAvailability * Math.max(0, Number(input?.secondOpportunityPotential || 0))
    );
  }

  function creationProductIdentity(skill = {}, creatorId = '', fallbackName = '') {
    const product = skill?.生成物 || skill?.产物 || skill?.制作产物 || null;
    const name = String(product?.名称 || product?.name ||
      (typeof product === 'string' || typeof product === 'number' ? product : '') ||
      skill?.产物名称 || skill?.魂技名 || skill?.name || fallbackName || product?.id || product?.物品ID || '').trim();
    const explicitId = String(product?.id || product?.物品ID || '').trim();
    const id = explicitId || (name ? `battle-created:${stableHash({ creatorId: String(creatorId || '').trim(), name,
      skillId: String(skill?.id || skill?.技能ID || '').trim(),
      products: (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).filter(effect => !String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果))
        .map(effect => ({ useEffects: effect.使用效果, sideEffects: effect.副作用列表 || [], type: effect.物品类型 || '物品', expiry: Number(effect.有效期tick || 0) })),
    })}` : '');
    return { id, name };
  }

  function findInventoryEntry(unit = {}, declaration = {}) {
    const assetId = String(declaration?.irreversibleAsset?.assetId || declaration?.skill?.id || declaration?.skill?.物品ID || '').trim();
    const wanted = new Set([
      declaration?.irreversibleAsset?.assetId,
      declaration?.skill?.id,
      declaration?.skill?.物品ID,
      declaration?.skill?.__物品名,
      declaration?.skill?.物品名,
      declaration?.skill?.名称,
      declaration?.skill?.name,
    ].map(value => String(value || '').trim()).filter(Boolean));
    const visited = new Set();
    const matches = [];
    const visit = (value, key = '') => {
      if (!value || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value);
      if (!Array.isArray(value)) {
        const identifiers = [
          key,
          value?.id,
          value?.物品ID,
          value?.__物品名,
          value?.物品名,
          value?.名称,
          value?.name,
        ].map(item => String(item || '').trim()).filter(Boolean);
        const identity = String(value?.id || value?.物品ID || value?.名称 || value?.name || key).trim();
        const matched = assetId ? assetId === identity || assetId === key : identifiers.some(identifier => wanted.has(identifier));
        if (matched && (value?.数量 !== undefined || value?.quantity !== undefined)) {
          matches.push(value);
          return;
        }
      }
      if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${key}:${index}`));
      else Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    ['背包', '库存', '物品', '战斗物品'].forEach(key => visit(unit?.[key], key));
    return matches.length === 1 ? matches[0] : null;
  }

  function itemConsumesOnUse(skill = {}) {
    const readRule = root.__LWCS_C2_CONSUMER_RULES_V1__?.读取正式物品消费规则_V1;
    return typeof readRule === 'function' ? readRule(skill).consume !== false : true;
  }

  function buildMechanicalIrreversibleAssetOutcome(
    actor = {},
    declaration = {},
    rootActionId = '',
  ) {
    let asset = declaration?.irreversibleAsset;
    if (
      String(declaration?.actionKind || '').trim().toUpperCase() ===
        'USE_ITEM' &&
      declaration?.__skipInventoryConsume !== true
    ) {
      const inventoryItem = findInventoryEntry(actor, declaration);
      const quantityBefore = Math.max(
        0,
        Number(inventoryItem?.数量 ?? inventoryItem?.quantity ?? 0),
      );
      if (!inventoryItem || quantityBefore < 1) {
        throw new Error(
          `battle_preview_item_unavailable:${String(
            asset?.assetId || declaration?.skill?.name || '',
          ).trim()}`,
        );
      }
      if (!itemConsumesOnUse(declaration?.skill)) return null;
      if (!asset || typeof asset !== 'object') asset = {
        assetId: String(inventoryItem.id || inventoryItem.物品ID || declaration?.skill?.__物品名 || declaration?.skill?.name || '').trim(),
        quantityBefore,
      };
    } else if (String(declaration?.actionKind || '').trim().toUpperCase() === 'USE_ITEM') {
      return null;
    }
    if (!asset || typeof asset !== 'object') return null;
    return Object.freeze({
      effectInstanceId: `${String(rootActionId || '').trim()}:asset`,
      targetId: unitId(actor),
      windowId: 'ACTION_COST',
      outcomeKind: 'IRREVERSIBLE_ASSET_LOST',
      threatValue: Math.max(0, Number(asset.cost || 0)),
      evidence: cloneValue(asset),
    });
  }

  function previewCreationCarrier(effect, overlay, ledger, context) {
    const useEffects = Array.isArray(effect?.使用效果) ? effect.使用效果 : [];
    if (!useEffects.length) throw new Error('battle_preview_creation_effects_missing');
    collectEffects(effect).forEach(validateEffect);
    const activeFingerprint = consumePreviewNode(context, effect);
    try {
      const skill = context.declaration?.skill || {};
      const actorId = unitId(context.actor);
      const product = creationProductIdentity(skill, actorId, '未命名造物');
      const productId = product.id;
      const quantity = Math.max(1, Math.floor(Number(effect?.数量 || 1)) || 1);
      const recipientId = String(
        context?.declaration?.creationRecipientId ||
        actorId,
      ).trim();
      const recipient = overlay.readUnit(recipientId);
      const primaryRecipientIds = new Set(
        ['team_player', 'team_enemy'].flatMap(side => {
          const value = context.worldSnapshot?.参战者?.[side];
          return (
          (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [])
            .map(unitId)
            .filter(Boolean)
          );
        }),
      );
      if (
        !recipient ||
        !primaryRecipientIds.has(unitId(recipient)) ||
        sideOf(context.worldSnapshot, recipient) !==
          sideOf(context.worldSnapshot, context.actor) ||
        !isPhysicallyAlive(recipient)
      ) {
        throw new Error(`battle_preview_creation_recipient_invalid:${recipientId || 'missing'}`);
      }
      overlay.changeUnit(recipientId, unit => {
        if (!unit.背包 || typeof unit.背包 !== 'object' || Array.isArray(unit.背包)) unit.背包 = {};
        const existing = unit.背包[productId] && typeof unit.背包[productId] === 'object'
          ? unit.背包[productId]
          : {};
        unit.背包[productId] = {
          ...existing,
          id: String(existing.id || productId).trim() || productId,
          name: String(existing.name || product.name).trim() || product.name,
          名称: String(existing.名称 || product.name).trim() || product.name,
          物品名: String(existing.物品名 || product.name).trim() || product.name,
          制作者ID: actorId,
          类型: String(existing.类型 || effect?.物品类型 || '物品').trim() || '物品',
          数量: Math.max(0, Number(existing.数量 || 0)) + quantity,
          有效期tick: Math.max(Number(existing.有效期tick || 0), Math.max(0, Number(effect?.有效期tick || 0))),
          来源: String(existing.来源 || skill?.魂技名 || skill?.name || context.rootActionId || '').trim(),
          使用效果: cloneValue(useEffects),
          副作用列表: cloneValue(effect?.副作用列表 || []),
        };
      });
      overlay.schedule({
        eventKind: 'item_created',
        rootActionId: context.rootActionId,
        effectInstanceId: context.effectInstanceId,
        actorId,
        recipientId,
        productId,
        quantity,
      });
      ledger.addOutcome({
        ...context,
        targetId: recipientId,
        outcomeKind: 'NEXT_ACTION_QUALITY_CHANGED',
        threatValue: 0,
        evidence: {
          delta: 1,
            productId,
            quantity,
            recipientId,
            useEffectCount: useEffects.length,
            useEffects: cloneValue(useEffects),
          },
        });
    } finally {
      context.nodeBudget.activeFingerprints.delete(activeFingerprint);
    }
  }

  function evaluateMechanicalBasis(input = {}) {
    if (input?.captureDependencyKeys !== true) {
      return evaluateMechanicalBasisImpl(input);
    }
    const dependencyCapture = {
      reads: new Map(),
      recorder: null,
      dependencyRoles: new Map(),
      roleStack: [],
    };
    dependencyCaptureStack.push(dependencyCapture);
    activePreviewDependencyCapture = dependencyCapture || null;
    try {
      const result = evaluateMechanicalBasisImpl(input);
      if (!result || typeof result !== 'object') return result;
      const withDependencies = { ...result };
      Object.defineProperty(withDependencies, 'dependencyReads', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze(
          [...dependencyCapture.reads.entries()].map(([key, value]) =>
            Object.freeze([key, cloneValue(value)])
          ),
        ),
      });
      Object.defineProperty(withDependencies, 'dependencyRoles', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze(
          [...dependencyCapture.dependencyRoles.entries()]
            .map(([key, roles]) => Object.freeze([
              key,
              Object.freeze([...roles].sort()),
            ])),
        ),
      });
      return Object.freeze(withDependencies);
    } finally {
      const popped = dependencyCaptureStack.pop();
      if (popped !== dependencyCapture) {
        dependencyCaptureStack.length = 0;
        activePreviewDependencyCapture = null;
        throw new Error('R9V2_MECHANICAL_DEPENDENCY_CAPTURE_STACK_INVALID');
      }
      activePreviewDependencyCapture = dependencyCaptureStack[dependencyCaptureStack.length - 1] || null;
    }
  }

  function routeScalarFailure(reason = '', detail = '') {
    const normalizedReason = String(reason || 'UNSUPPORTED').trim() || 'UNSUPPORTED';
    metrics.routeScalarFallbacks += 1;
    return Object.freeze({
      complete: false,
      fallbackReason: normalizedReason,
      fallbackDetail: String(detail || '').trim(),
      rows: Object.freeze([]),
    });
  }

  function routeScalarKey(effect = {}, rootActionId = '', effectIndex = 0) {
    return canonicalEffectId(effect, rootActionId, effectIndex);
  }

  function routeScalarConditionalIsDirect(effect = {}) {
    return !Array.isArray(effect?.条件分支) || effect.条件分支.every(branch =>
      ['生效', '禁用'].includes(String(branch?.处理 || '').trim()) &&
      !branch?.效果 &&
      !branch?.使用效果
    );
  }

  function routeScalarEffectAffectsHealth(effect = {}) {
    const prototype = String(effect?.原型 || '').trim();
    if (['伤害结算', '护盾变化'].includes(prototype)) return true;
    if (prototype === '资源变化') {
      return normalizedResourceKeys(effect?.资源 || '魂力').includes('hp');
    }
    if (prototype !== '状态施加') return false;
    const combatEffect = deriveStateCombatEffect(effect);
    return Number(combatEffect?.dot_damage || 0) !== 0 ||
      Number(combatEffect?.dot_damage_ratio || 0) !== 0 ||
      Number(combatEffect?.hot_heal_ratio || 0) !== 0;
  }

  function routeScalarEffectSupported(effect = {}) {
    const prototype = String(effect?.原型 || '').trim();
    return ['伤害结算', '护盾变化', '资源变化'].includes(prototype) &&
      routeScalarConditionalIsDirect(effect) &&
      String(effect?.生效方式 || '').trim() !== '跟随主原型';
  }

  function routeScalarSequenceSupported(effects = []) {
    const healthIndexes = effects
      .map((effect, index) => routeScalarEffectAffectsHealth(effect) ? index : -1)
      .filter(index => index >= 0);
    if (!healthIndexes.length) return true;
    const lastHealthIndex = healthIndexes[healthIndexes.length - 1];
    for (let index = 0; index <= lastHealthIndex; index += 1) {
      if (!routeScalarEffectAffectsHealth(effects[index])) return false;
      if (!routeScalarEffectSupported(effects[index])) return false;
    }
    return true;
  }

  function routeScalarFallbackRow(candidateId, reason) {
    metrics.routeScalarFallbacks += 1;
    return Object.freeze({
      candidateId: String(candidateId || '').trim(),
      fallbackReason: String(reason || 'UNSUPPORTED').trim() || 'UNSUPPORTED',
      hardInvalid: false,
      contributions: Object.freeze([]),
    });
  }

  // This projection is deliberately narrower than evaluateMechanicalBasis:
  // future-route scoring only needs immediate HP/shield/resource columns.
  // Structural mechanics and sequences whose pre-health effects can change the
  // projection return an explicit fallback instead of being approximated.
  function evaluateMechanicalBasisRouteScalarColumns(input = {}) {
    const rowsInput = Array.isArray(input?.rows) ? input.rows : [];
    const baselineWorld = input?.baselineWorld;
    const branchWorld = input?.branchWorld;
    if (!baselineWorld || !branchWorld || !rowsInput.length) {
      return routeScalarFailure('INPUT_INVALID');
    }
    const baselineContext = input?.baselineProjectionContext ||
      compileMechanicalProjectionContext(baselineWorld);
    const branchContext = input?.branchProjectionContext ||
      compileMechanicalProjectionContext(branchWorld);
    if (
      baselineContext?.worldSnapshot !== baselineWorld ||
      branchContext?.worldSnapshot !== branchWorld
    ) {
      return routeScalarFailure('PROJECTION_CONTEXT_MISMATCH');
    }
    const forcedObservation = input?.forcedMechanicObservation;
    const forcedSuccess = input?.forcedMechanicSuccess;
    const observationPrototype = String(
      forcedObservation?.effectPrototype || '',
    ).trim();
    const forcedPrototype = observationPrototype === '命中判定'
      ? '伤害结算'
      : observationPrototype;
    const forcedTargetId = String(forcedObservation?.targetId || '').trim();
    const forcedStateName = String(forcedObservation?.stateName || '').trim();
    const forcedEffectIndex = Number.isInteger(Number(forcedObservation?.effectIndex))
      ? Number(forcedObservation.effectIndex)
      : null;
    const forcedOutcomeRequested =
      forcedObservation &&
      (forcedSuccess === true || forcedSuccess === false);
    const output = [];
    metrics.routeScalarBatchBuilds += 1;
    for (const row of rowsInput) {
      const basis = row?.basis;
      const candidateId = String(row?.candidateId || '').trim();
      const actorId = String(row?.actorId || basis?.actorId || '').trim();
      if (
        !basis || basis.schemaVersion !== 'MechanicalBasisV2' ||
        !candidateId || !actorId
      ) {
        output.push(routeScalarFallbackRow(candidateId, 'BASIS_INVALID'));
        continue;
      }
      if (
        basis.unsupportedReasons?.length ||
        basis.actionKind === 'WITHDRAW' ||
        basis.creationCarriers?.length ||
        basis.declaration?.irreversibleAsset ||
        basis.declaration?.fusionPartnerIds?.length ||
        basis.declaration?.fusionParticipantIds?.length
      ) {
        output.push(routeScalarFallbackRow(candidateId, 'STRUCTURAL_MECHANIC'));
        continue;
      }
      const effects = Array.isArray(basis.effects) ? basis.effects : [];
      if (!routeScalarSequenceSupported(effects)) {
        output.push(routeScalarFallbackRow(candidateId, 'UNSUPPORTED_EFFECT'));
        continue;
      }
      if (/点到为止|切磋|训练|非致命/.test(String(input?.battleIntent?.mode || input?.battleIntent || '').trim())) {
        output.push(routeScalarFallbackRow(candidateId, 'NONLETHAL_INTENT'));
        continue;
      }
      const baselineActor = baselineContext.unitById?.get(actorId) ||
        findUnit(baselineWorld, actorId);
      const branchActor = branchContext.unitById?.get(actorId) ||
        findUnit(branchWorld, actorId);
      if (!baselineActor || !branchActor || !isBattleCapable(branchActor)) {
        output.push(routeScalarFallbackRow(candidateId, 'ACTOR_UNAVAILABLE'));
        continue;
      }
      const baselineProfile = mechanicalProjectionProfile(baselineContext, baselineActor);
      const branchProfile = mechanicalProjectionProfile(branchContext, branchActor);
      if (basis.declaration?.skill?.__mechanismGrantTemporarySkill === true ||
          (basis.declaration?.__includeGrantedEffects !== false && (
            baselineProfile?.hasPendingGrantedEffects || branchProfile?.hasPendingGrantedEffects ||
            basis.actionKind === 'RELEASE_SKILL' && (baselineProfile?.hasPendingSkillGrantedEffects || branchProfile?.hasPendingSkillGrantedEffects)))) {
        output.push(routeScalarFallbackRow(candidateId, 'GRANTED_EFFECTS'));
        continue;
      }
      const paymentMode = String(basis.paymentMode || 'FORMAL').trim().toUpperCase();
      const resourceCosts = basis.declaration?.resourceCosts || {};
      const availableResources = new Map();
      let resourceInvalid = false;
      if (paymentMode === 'FORMAL') {
        const normalizedCosts = normalizeSkillCostMap(resourceCosts);
        if (normalizedCosts.非法项.length) resourceInvalid = true;
        for (const [resource, rawCost] of Object.entries(normalizedCosts.values)) {
          if (resourceInvalid) break;
          const before = readResource(branchActor, resource);
          const payment = assessResourcePayment([branchActor], { [resource]: rawCost }, {
            resourceOverrides: { [resource]: before },
          });
          if (!payment.valid || !payment.ok) {
            resourceInvalid = true;
            break;
          }
          availableResources.set(resource, before - Number(payment.payments[0]?.amount || 0));
        }
      }
      if (resourceInvalid) {
        output.push(Object.freeze({
          candidateId,
          hardInvalid: true,
          contributions: Object.freeze([]),
        }));
        continue;
      }
      const rootActionId = canonicalActionId(
        basis.declaration,
        basis.identity,
      );
      const sourceActionId = rootActionId;
      const contributions = [];
      const add = (effectInstanceId, contribution) => contributions.push(Object.freeze({
        ...contribution,
        rootActionId,
        sourceActionId,
        actorId,
        effectInstanceId: String(effectInstanceId || '').trim(),
      }));
      let hardInvalid = false;
      let statefulFallback = '';
      if (paymentMode === 'FORMAL') {
        for (const [resource, next] of availableResources) {
          const before = readResource(branchActor, resource);
          add(`${rootActionId}:cost:${resource}`, {
            targetId: actorId,
            outcomeKind: 'RESOURCE_OPTION_CHANGED',
            windowId: 'ACTION_COST',
            expectedDelta: next - before,
            evidence: Object.freeze({ resource, before, next, delta: next - before }),
          });
        }
      }
      const hpByTarget = new Map();
      const shieldByTarget = new Map();
      const routeTarget = target => {
        const targetId = unitId(target);
        if (!hpByTarget.has(targetId) && !shieldByTarget.has(targetId)) return target;
        const projected = cloneUnitForOverlay(target);
        if (hpByTarget.has(targetId)) setHp(projected, hpByTarget.get(targetId));
        if (shieldByTarget.has(targetId)) {
          applyProjectedShieldDelta(projected, shieldByTarget.get(targetId) - readShield(projected), `${rootActionId}:scalar`);
        }
        return projected;
      };
      effects.forEach((effect, effectIndex) => {
        if (hardInvalid) return;
        if (!routeScalarEffectAffectsHealth(effect)) return;
        const prototype = String(effect?.原型 || '').trim();
        const effectInstanceId = routeScalarKey(effect, rootActionId, effectIndex);
        const baselineTargets = resolveTargets(
          baselineWorld,
          baselineActor,
          basis.declaration,
          effect,
          baselineContext,
        );
        const branchTargets = resolveTargets(
          branchWorld,
          branchActor,
          basis.declaration,
          effect,
          branchContext,
        );
        if (baselineTargets.length !== branchTargets.length) {
          hardInvalid = true;
          return;
        }
        const branchTargetsById = new Map(
          branchTargets.map(target => [unitId(target), routeTarget(target)]),
        );
        for (const baselineTarget of baselineTargets) {
          const targetId = unitId(baselineTarget);
          const target = branchTargetsById.get(targetId);
          if (!target) {
            hardInvalid = true;
            break;
          }
          if (!effectConditionEnabled(effect, branchWorld, branchActor, target)) continue;
          const windowId = `round:${Number(branchWorld?.回合 || 0)}:effect:${effectIndex}`;
          if (prototype === '伤害结算') {
            if (deathSaveCount(target) > 0) { hardInvalid = true; statefulFallback = 'DEATH_SAVE_STATE'; break; }
            if (ruleBlockCount(target) > 0 || ruleBlockCount(baselineTarget) > 0) { hardInvalid = true; statefulFallback = 'RULE_BLOCK_STATE'; break; }
            if (hasDamageRevival(target, true) || hasDamageRevival(baselineTarget, true)) { hardInvalid = true; statefulFallback = 'REVIVAL_STATE'; break; }
            if (counterDamageRatio(target) > 0 || counterDamageRatio(baselineTarget) > 0) { hardInvalid = true; statefulFallback = 'REFLECTION_STATE'; break; }
            const damageBasis = buildDamageBasis(effect, branchActor, target, branchContext, {
              basisView: input?.basisView || 'DECISION_VISIBLE',
              effectInstanceId,
              sourceEffectId: effectInstanceId,
              sourceActionId,
              snapshotRevision: String(input?.revision || basis.identity || '').trim(),
              actionDamageMultiplier: 1,
              targetCount: branchTargets.length,
              reactionDamageMultiplier: 1,
              resourceDriveEnabled: String(basis.actionKind || '').trim().toUpperCase() !== 'BASIC_ATTACK',
            });
            assertDamageBasis(damageBasis, { basisView: input?.basisView || 'DECISION_VISIBLE' });
            const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 ?? effect?.段数 ?? 1)) || 1);
            const perSegmentDamage = calculateSettledSegmentDamage(
              damageBasis.operands.rawDamage,
              segments,
              1,
            );
            const hitProbabilityResolver = row?.hitProbabilityResolver ||
              input?.hitProbabilityResolver;
            const hitProbability = typeof hitProbabilityResolver === 'function'
              ? hitProbabilityResolver({
                  targetId,
                  actor: branchActor,
                  effect,
                  effectInstanceId,
                  baseHitProbability: estimateHitProbability(branchActor, target, effect, branchContext),
                  recordDependency: recordPreviewDependency,
                })
              : estimateHitProbability(branchActor, target, effect, branchContext);
            const matchesForcedObservation = forcedOutcomeRequested &&
              forcedPrototype === prototype &&
              forcedTargetId === targetId &&
              (forcedEffectIndex === null || forcedEffectIndex === effectIndex) &&
              (!forcedStateName || forcedStateName === String(
                effect?.状态 || effect?.状态名称 || '',
              ).trim());
            const forcedProbability = matchesForcedObservation
              ? (forcedSuccess ? 1 : 0)
              : forcedApplicationProbability(row, effectInstanceId, targetId);
            const damageExpectation = expectedSegmentedDamageOutcome({
              segments,
              perSegmentDamage,
              hitProbability: forcedProbability === null ? hitProbability : forcedProbability,
              applicationProbability: 1,
              shieldBefore: readShield(target),
              hpDamageLimit: readHp(target),
            });
            if (damageExpectation.expectedShieldAbsorb > 0) {
              add(effectInstanceId, {
                targetId,
                outcomeKind: 'SHIELD_DELTA',
                windowId,
                expectedDelta: -damageExpectation.expectedShieldAbsorb,
                evidence: Object.freeze({
                  current: readShield(target),
                  next: Math.max(0, readShield(target) - damageExpectation.expectedShieldAbsorb),
                  delta: -damageExpectation.expectedShieldAbsorb,
                }),
              });
            }
            add(effectInstanceId, {
              targetId,
              outcomeKind: 'HP_DELTA',
              windowId,
              expectedDelta: -damageExpectation.expectedHpDamage,
              evidence: Object.freeze({
                delta: -damageExpectation.expectedHpDamage,
                current: readHp(target),
                next: Math.max(0, readHp(target) - damageExpectation.expectedHpDamage),
              }),
            });
            shieldByTarget.set(
              targetId,
              Math.max(0, readShield(target) - damageExpectation.expectedShieldAbsorb),
            );
            hpByTarget.set(
              targetId,
              Math.max(0, readHp(target) - damageExpectation.expectedHpDamage),
            );
            continue;
          }
          if (prototype === '护盾变化') {
            const current = readShield(target);
            const mode = String(effect?.护盾模式 || '正向护盾').trim();
            const baseApplicationProbability = normalizeEffectProbability(
              effect?.成功率 ?? effect?.触发概率,
              1,
            );
            const applicationProbabilityResolver =
              row?.applicationProbabilityResolver ||
              input?.applicationProbabilityResolver;
            const resolvedApplicationProbability =
              typeof applicationProbabilityResolver === 'function'
                ? applicationProbabilityResolver({
                    targetId,
                    actor: branchActor,
                    effect,
                    effectInstanceId,
                    baseApplicationProbability,
                    recordDependency: recordPreviewDependency,
                  })
                : baseApplicationProbability;
            const forcedProbability = forcedApplicationProbability(
              row,
              effectInstanceId,
              targetId,
            );
            const applicationProbability = forcedProbability === null
              ? clamp(resolvedApplicationProbability, 0, 1)
              : forcedProbability;
            const requested = Math.abs(
              parseSignedValue(effect?.数值, mode === '正向护盾' ? readHpMax(target) : current),
            );
            const realizedDelta = mode === '正向护盾'
              ? calculateShieldGain(target, requested)
              : -Math.min(current, Math.floor(requested));
            const delta = realizedDelta * applicationProbability;
            const next = Math.max(0, current + delta);
            add(effectInstanceId, {
              targetId,
              outcomeKind: 'SHIELD_DELTA',
              windowId,
              expectedDelta: delta,
              evidence: Object.freeze({
                mode,
                current,
                next,
                delta,
                realizedDelta,
                applicationProbability,
              }),
            });
            shieldByTarget.set(targetId, next);
            if (mode === '窃盾' && targetId !== actorId && realizedDelta < 0) {
              const receiver = routeTarget(branchActor);
              const before = readShield(receiver);
              const realizedGain = calculateShieldGain(receiver, -realizedDelta);
              const gain = realizedGain * applicationProbability;
              add(`${effectInstanceId}:stolen:${targetId}`, {
                targetId: actorId,
                outcomeKind: 'SHIELD_DELTA',
                windowId,
                expectedDelta: gain,
                evidence: Object.freeze({ mode, current: before, next: before + gain, delta: gain,
                  realizedDelta: realizedGain, applicationProbability }),
              });
              shieldByTarget.set(actorId, before + gain);
            }
            continue;
          }
          const resourceKeys = normalizedResourceKeys(effect?.资源 || '魂力');
          for (const resourceKey of resourceKeys) {
            const resource = resourceLabel(resourceKey);
            const isHp = resourceKey === 'hp';
            const current = isHp ? readHp(target) : readResource(target, resource);
            const maximum = isHp ? readHpMax(target) : readResourceMax(target, resource);
            const next = clamp(current + parseSignedValue(effect?.数值, maximum), 0, maximum);
            add(effectInstanceId, {
              targetId,
              outcomeKind: isHp ? 'HP_DELTA' : 'RESOURCE_OPTION_CHANGED',
              windowId,
              expectedDelta: next - current,
              evidence: Object.freeze({
                resource,
                current,
                next,
                delta: next - current,
                applicationProbability: 1,
                ownApplicationProbability: 1,
              }),
            });
            if (isHp) hpByTarget.set(targetId, next);
          }
        }
      });
      if (hardInvalid) {
        output.push(routeScalarFallbackRow(candidateId, statefulFallback || 'TARGET_TOPOLOGY_OR_CONDITION'));
        continue;
      }
      output.push(Object.freeze({
        candidateId,
        hardInvalid: false,
        changedUnitIds: Object.freeze([...new Set(
          contributions.map(contribution => String(contribution?.targetId || '').trim()).filter(Boolean),
        )].sort()),
        contributions: Object.freeze(contributions),
      }));
    }
    metrics.routeScalarEvaluations += output.length;
    metrics.routeScalarOutcomeRows += output.length;
    return Object.freeze({
      schemaVersion: 'MechanicalRouteScalarColumnsV1',
      complete: true,
      fallbackReason: '',
      rows: Object.freeze(output),
    });
  }

  function buildCacheKey(input = {}) {
    const cacheBasisView = String(
      input?.basisView || (input?.beliefSnapshot ? 'BELIEF' : 'DECISION_VISIBLE'),
    ).trim().toUpperCase();
    const cacheSnapshotRevision = String(
      input?.snapshotRevision ||
      [input?.worldRevision || stableHash(input?.worldSnapshot || {}), input?.beliefRevision || '']
        .filter(Boolean)
        .join('|'),
    ).trim();
    const damageMultiplierKey = Object.entries(input.damageMultiplierByTarget || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([targetId, multiplier]) => `${JSON.stringify(targetId)}:${JSON.stringify(Number(multiplier) || 0)}`)
      .join(',');
    const evadeProbabilityKey = Object.entries(input.evadeProbabilityByTarget || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([targetId, probability]) =>
        `${JSON.stringify(targetId)}:${JSON.stringify(Number(probability) || 0)}`
      )
      .join(',');
    return [
      input.worldRevision || stableHash(input.worldSnapshot || {}),
      input.beliefRevision || stableHash(input.beliefSnapshot || {}),
      input.actorId || '',
      input.actionFingerprint || stableHash(input.declaration || {}),
      (input.declaration?.targetIds || []).join(','),
      damageMultiplierKey,
      evadeProbabilityKey,
      stableHash(input.forcedApplicationProbabilityByEffect || {}),
      input.collectProbabilityBranches === true ? 'collect-probability-branches' : '',
      String(input.paymentMode || 'FORMAL').trim().toUpperCase(),
      input.horizon || 'SHALLOW',
      cacheBasisView,
      cacheSnapshotRevision,
      input.environmentCacheKey || '',
      input.captureDamageBasisTrace === true ? 'capture-damage-basis-trace' : '',
      input.buildOperationGraph === false ? 'no-operation-graph' : '',
      input.settleStateEndRisks === false ? 'external-state-end-risks' : '',
      input.captureDependencies === false ? 'no-dependencies' : '',
      ...(String(input.actionRole || input.declaration?.actionRole || '').trim().toUpperCase() === 'STATE_TICK' ? ['state-tick'] : []),
    ].join('|');
  }

  function forcedApplicationProbability(input = {}, effectInstanceId = '', targetId = '') {
    const overrides = input?.forcedApplicationProbabilityByEffect;
    if (!overrides || typeof overrides !== 'object') return null;
    const effectKey = [
      String(effectInstanceId || '').trim(),
      String(targetId || '').trim(),
    ].join('|');
    if (!Object.prototype.hasOwnProperty.call(overrides, effectKey)) return null;
    const value = Number(overrides[effectKey]);
    return Number.isFinite(value) ? clamp(value, 0, 1) : null;
  }

  function replaceProjectedSideEffectState(unit, name, state, tick = 0, onReplace = null) {
    const entries = [];
    let endedStates;
    let replaced = false;
    let panelChanged = ['面板修改比例', '面板固定修正', '属性快照'].some(field => Object.keys(state?.[field] || {}).length);
    Object.entries(unit.状态效果 || {}).forEach(([key, previous]) => {
      if (key !== name && !(/^(visible:|preview:|transferred:)/.test(key) && (previous.状态 || previous.状态名称) === name)) {
        entries.push([key, previous]);
        return;
      }
      panelChanged ||= ['面板修改比例', '面板固定修正', '属性快照'].some(field => Object.keys(previous?.[field] || {}).length);
      if (onReplace) (endedStates ||= []).push([key, previous]);
      if (!replaced) entries.push([name, cloneValue(state)]);
      replaced = true;
    });
    if (!replaced) entries.push([name, cloneValue(state)]);
    unit.状态效果 = Object.fromEntries(entries);
    if (panelChanged) unit.final = { ...unit.final, ...buildNumericCombatStats(unit, tick) };
    if (endedStates) for (const [key, previous] of endedStates) onReplace(key, previous);
  }

  function sideEffectProtectionApplies(unit, stateName, certainOnly = false) {
    return Object.values(unit?.状态效果 || {}).some(condition => {
      if (certainOnly && Number(condition?.__previewApplicationProbability ?? 1) < 1 - 1e-12) return false;
      if (condition?.战斗效果?.无视异常 === true) return true;
      if (String(condition?.特殊机制标识 || '').trim() !== '持续状态移除') return false;
      const removal = condition?.持续原型效果;
      if (!removal || String(removal?.原型 || '').trim() !== '状态移除') return false;
      const filter = String(removal?.状态 || '').trim();
      return !filter || filter === '任意状态' || filter === '任意负面' || filter === stateName;
    });
  }

  function settlePreviewLethalSideEffect(unit) {
    const alive = unit.状态?.存活;
    setHp(unit, 0);
    triggerRevive(unit, unitName(unit));
    if (readHp(unit) > 0 && unit.状态 && typeof unit.状态 === 'object') {
      if (alive === undefined) delete unit.状态.存活;
      else unit.状态.存活 = alive;
    }
  }

  function conditionalRiskRecipientProfiles(declaration, baseEffects, actor, world, entries, rootActionId) {
    const primary = resolveTargets(world, actor, declaration, baseEffects[0] || {})[0] || findUnit(world, declaration?.targetIds?.[0]) || actor;
    const damageEntries = entries.filter(entry => entry.actorId === unitId(actor) && entry.outcomeKind === 'HP_DELTA' && Number.isFinite(entry.evidence?.rawDamage) &&
      entry.evidence.distributionGroupKey && !entry.evidence.requiredOutcomeKey && !entry.evidence.requiredOutcomeAssignments?.length &&
      entry.evidence.outcomeDistribution?.length && entry.evidence.outcomeDistribution.every(outcome => !Object.keys(outcome.conditionalOn || {}).length));
    const damageKeys = new Set(damageEntries.map(entry => `${entry.effectInstanceId}|${entry.targetId}`));
    const damageSources = damageEntries.filter(entry => Number(entry.evidence.fullHitIncoming || 0) > 0);
    // Before its first effective resource change, a recipient is still at its post-payment balance.
    const resourceStart = baseEffects.length > 0 && baseEffects.every(effect => effect.原型 === '资源变化' && !effect.条件分支?.length) &&
      entries.filter(entry => entry.windowId !== 'ACTION_COST').every(entry => entry.evidence?.resourceChange)
      ? new PreviewOverlay(world, `${rootActionId}:recipient-start`) : null;
    if (resourceStart) entries.filter(entry => entry.windowId === 'ACTION_COST').forEach(entry => {
      resourceStart.setResource(entry.targetId, entry.evidence.resource,
        readResource(resourceStart.readUnit(entry.targetId), entry.evidence.resource) + Number(entry.evidence.delta || 0));
    });
    const eligibleEffects = new Set(entries.filter(entry => {
      if (entry.windowId === 'ACTION_COST' || entry.actorId !== unitId(actor)) return false;
      const evidence = entry.evidence || {};
      if (resourceStart && evidence.resourceChange) {
        const target = resourceStart.readUnit(entry.targetId), resource = evidence.resource;
        if (!target) return false;
        const before = readResource(target, resource), maximum = readResourceMax(target, resource);
        let delta = parseSignedValue(evidence.resourceChange.value, maximum);
        if (delta > 0) delta *= Math.max(0, Number(healingMultiplierForUnit(target, resource) ?? 1));
        return Number(evidence.applicationProbability ?? 1) > 1e-12 && Math.abs(clamp(before + delta, 0, maximum) - before) > 1e-12;
      }
      if (['RESOURCE_OPTION_CHANGED', 'SHIELD_DELTA', 'HP_DELTA'].includes(entry.outcomeKind)) return Math.abs(Number(evidence.delta || 0)) > 1e-12;
      if (!['STATE_CHANGED', 'RULE_CHANGED', 'NEXT_ACTION_QUALITY_CHANGED'].includes(entry.outcomeKind) || evidence.marginal === false) return false;
      if (evidence.stateRemoval) return !!evidence.removedKeys?.length;
      if (evidence.durationChanges) return evidence.durationChanges.some(change => Number(change.tickDelta || 0) !== 0);
      return Number(evidence.applicationProbability ?? 1) > 1e-12;
    }).map(entry => `${entry.effectInstanceId}|${entry.targetId}`));
    const graph = buildActionOperationGraph({ worldSnapshot: world, requiredOutcomeGroupKeys: damageSources.map(entry => entry.evidence.distributionGroupKey),
      previewResult: { actionId: rootActionId, actorId: unitId(actor), contributions: entries } });
    const sourcesByTarget = new Map([[unitId(primary), []]]);
    for (const event of [...graph.deterministicEvents, ...graph.conditionalEvents]) {
      if (damageKeys.has(`${event.effectInstanceId}|${event.targetId}`)) continue;
      if (!eligibleEffects.has(`${event.effectInstanceId}|${event.targetId}`)) continue;
      if (!sourcesByTarget.has(event.targetId)) sourcesByTarget.set(event.targetId, []);
      sourcesByTarget.get(event.targetId).push(event.conditionalOn || {});
    }
    damageSources.forEach(entry => {
      if (!sourcesByTarget.has(entry.targetId)) sourcesByTarget.set(entry.targetId, []);
      sourcesByTarget.get(entry.targetId).push({ [entry.evidence.distributionGroupKey]: 'HIT' });
    });
    const allSources = [...sourcesByTarget.values()].flat();
    const profiles = new Map();
    const matches = (sources, assignments) => {
      let pending = false;
      for (const source of sources) {
        if (Object.entries(source).some(([key, value]) => Object.hasOwn(assignments, key) && assignments[key] !== value)) continue;
        if (Object.keys(source).every(key => Object.hasOwn(assignments, key))) return true;
        pending = true;
      }
      return pending ? null : false;
    };
    sourcesByTarget.forEach((targetSources, targetId) => {
      const fallback = targetId === unitId(primary), alternatives = [];
      const visit = (assignments, probability, conditionalOn) => {
        const own = matches(targetSources, assignments), any = fallback ? matches(allSources, assignments) : true;
        if (own === true || fallback && any === false) {
          alternatives.push({ enabled: true, conditionalOn, probability });
          return;
        }
        if (own === false && any === true) return;
        const pending = (fallback ? allSources : targetSources).filter(source => !Object.entries(source).some(([key, value]) =>
          Object.hasOwn(assignments, key) && assignments[key] !== value));
        const key = pending.flatMap(source => Object.keys(source)).find(key => !Object.hasOwn(assignments, key));
        const group = graph.outcomeGroups.find(group => group.outcomes.some(outcome => Object.hasOwn(outcome.assignments, key)));
        if (!group) throw new Error(`BATTLE_RISK_OUTCOME_GROUP_MISSING:${key || 'unknown'}`);
        group.outcomes.forEach(outcome => {
          const branchProbability = probability * Number(outcome.probability || 0);
          if (branchProbability > 1e-15) visit({ ...assignments, ...outcome.assignments }, branchProbability,
            { ...conditionalOn, [group.groupKey]: outcome.assignments[group.groupKey] });
        });
      };
      visit({}, 1, {});
      const target = findUnit(world, targetId);
      if (target) profiles.set(targetId, { target, alternatives, probability: alternatives.reduce((sum, row) => sum + row.probability, 0) });
    });
    return profiles;
  }

  function applyImmediateSideEffects(declaration, baseEffects, actor, overlay, ledger, rootActionId, input) {
    const sideEffectCandidates = !declaration?.__structuredSourceEffectId && ['RELEASE_SKILL', 'USE_ITEM'].includes(
      String(declaration?.actionKind || '').trim().toUpperCase(),
    )
      ? [
          ...normalizeSideEffectList(declaration?.skill?.副作用列表 || []),
          ...baseEffects
            .filter(effect => String(effect?.原型 || '').trim())
            .flatMap(effect => normalizeSideEffectList(effect?.副作用列表 || [])),
        ]
      : [];
    const sideEffectHashes = new Set();
    const normalizedSideEffects = sideEffectCandidates.filter(effect => {
      const hash = stableHash(effect);
      if (sideEffectHashes.has(hash)) return false;
      sideEffectHashes.add(hash);
      return true;
    });
    if (!normalizedSideEffects.some(effect => Number(effect?.触发概率 ?? 1) > 1e-12)) return;
    const onlySelfRecipient = declaration?.targetIds?.length === 1 && declaration.targetIds[0] === unitId(actor) &&
      baseEffects.length > 0 && baseEffects.every(effect => String(effect?.目标 || '').trim() === '自身' && !effect?.条件分支?.length);
    let recipient = onlySelfRecipient ? actor : null;
    if (!recipient && declaration?.targetIds?.length === 1 && baseEffects.length > 0 && baseEffects.every(effect =>
      ['资源变化', '属性修正', '判定修正'].includes(String(effect?.原型 || '').trim()) && !effect?.条件分支?.length)) {
      const resolved = baseEffects.map(effect => resolveTargets(overlay.baseWorld, actor, declaration, effect));
      if (resolved.every(targets => targets.length === 1 && unitId(targets[0]) === declaration.targetIds[0])) recipient = resolved[0][0];
    }
    const recipientProfiles = new Map();
    if (!recipient && baseEffects.length === 1 && ['资源变化', '护盾变化'].includes(baseEffects[0].原型) && !baseEffects[0]?.条件分支?.length &&
      normalizedSideEffects.some(effect => effect.生效对象 !== '技能释放者' && ['效果生效后', '回合结束时', '效果结束后'].includes(effect.触发时机))) {
      const resolved = resolveTargets(overlay.baseWorld, actor, declaration, baseEffects[0]);
      const sourcesByTarget = new Map(resolved.map(target => [unitId(target), new Map()])), sources = new Map();
      ledger.entries.filter(entry => entry.actorId === unitId(actor) && entry.windowId !== 'ACTION_COST' &&
        ['HP_DELTA', 'RESOURCE_OPTION_CHANGED', 'SHIELD_DELTA'].includes(entry.outcomeKind) && Math.abs(Number(entry.evidence?.delta || 0)) > 1e-12).forEach(entry => {
        const probability = clamp(Number(entry.evidence?.applicationProbability || 0), 0, 1);
        const groupKey = String(entry.evidence?.probabilityGroupKey || `${entry.effectInstanceId}|${entry.targetId}`).trim();
        if (!sourcesByTarget.has(entry.targetId)) sourcesByTarget.set(entry.targetId, new Map());
        sourcesByTarget.get(entry.targetId).set(groupKey, probability);
        sources.set(groupKey, probability);
      });
      const noneProbability = [...sources.values()].reduce((p, probability) => p * (1 - probability), 1);
      const noneConditions = Object.fromEntries([...sources].filter(([, probability]) => probability > 0 && probability < 1)
        .map(([groupKey]) => [groupKey, 'FAILURE']));
      sourcesByTarget.forEach((targetSources, targetId) => {
        const alternatives = [], previousFailures = {};
        let missed = 1;
        targetSources.forEach((probability, groupKey) => {
          if (missed * probability > 1e-15) alternatives.push({ enabled: true,
            conditionalOn: { ...previousFailures, ...(probability < 1 ? { [groupKey]: 'SUCCESS' } : {}) } });
          if (probability < 1) previousFailures[groupKey] = 'FAILURE';
          missed *= 1 - probability;
        });
        const fallback = targetId === unitId(resolved[0]);
        if (fallback && noneProbability > 0) alternatives.push({ enabled: true, conditionalOn: noneConditions });
        const target = findUnit(overlay.baseWorld, targetId);
        if (target) recipientProfiles.set(targetId, { target, alternatives, probability: 1 - missed + (fallback ? noneProbability : 0) });
      });
    } else if (!recipient && normalizedSideEffects.some(effect => effect.生效对象 !== '技能释放者' && ['效果生效后', '回合结束时', '效果结束后'].includes(effect.触发时机))) {
      conditionalRiskRecipientProfiles(declaration, baseEffects, actor, overlay.baseWorld, ledger.entries, rootActionId)
        .forEach((profile, targetId) => recipientProfiles.set(targetId, profile));
    }
    const ownDamageOutcomes = normalizedSideEffects.some(effect => effect.触发时机 === '命中后' && effect.生效对象 === '技能释放者') &&
      baseEffects.length > 0 && baseEffects.every(effect => String(effect?.原型 || '').trim() === '伤害结算' && !effect?.条件分支?.length)
      ? ledger.entries.filter(entry => entry.actorId === unitId(actor) && entry.outcomeKind === 'HP_DELTA' && Number.isFinite(entry.evidence?.rawDamage)) : [];
    const hitSource = ownDamageOutcomes.length === 1 && ownDamageOutcomes[0].evidence?.distributionGroupKey &&
      ownDamageOutcomes[0].evidence.outcomeDistribution?.every(outcome => !Object.keys(outcome.conditionalOn || {}).length) ? ownDamageOutcomes[0].evidence : null;
    const hitSources = ownDamageOutcomes.length > 1 && ownDamageOutcomes.every(entry => entry.evidence?.distributionGroupKey &&
      !entry.evidence.requiredOutcomeKey && !entry.evidence.requiredOutcomeAssignments?.length &&
      entry.evidence.outcomeDistribution?.length && entry.evidence.outcomeDistribution.every(outcome =>
        !Object.keys(outcome.conditionalOn || {}).length && (['HIT', 'MISS'].includes(outcome.assignments?.[entry.evidence.distributionGroupKey]) || Array.isArray(outcome.hitCounts))))
      ? [...new Map(ownDamageOutcomes.map(entry => [entry.evidence.distributionGroupKey, entry.evidence])).values()] : [];
    let missedProbability = 1;
    const previousMisses = {};
    const hitAlternatives = hitSources.map(source => {
      const hitProbability = source.outcomeDistribution.reduce((sum, outcome) => sum +
        ((outcome.assignments?.[source.distributionGroupKey] || (outcome.hitCounts?.some(count => count > 0) ? 'HIT' : 'MISS')) === 'HIT' ? Number(outcome.probability || 0) : 0), 0);
      const alternative = { enabled: missedProbability * hitProbability > 1e-15,
        conditionalOn: { ...previousMisses, [source.distributionGroupKey]: 'HIT' } };
      previousMisses[source.distributionGroupKey] = 'MISS';
      missedProbability *= 1 - hitProbability;
      return alternative;
    });
    normalizedSideEffects.flatMap((sideEffect, sideEffectIndex) => {
      const mode = String(sideEffect?.生效对象 || '').trim();
      const recipients = recipientProfiles.size ? [...recipientProfiles.values()].map(profile => profile.target) : recipient ? [recipient] : [];
      const targets = mode === '技能释放者' ? [actor] : mode === '双方' ? [actor, ...recipients] : recipients;
      return [...new Map(targets.map(target => [unitId(target), target])).values()].map(target => ({ sideEffect, sideEffectIndex, target }));
    }).forEach(({ sideEffect, sideEffectIndex, target }) => {
      const type = String(sideEffect?.副作用类型 || '').trim();
      const hitTiming = String(sideEffect?.触发时机 || '').trim() === '命中后';
      const deferredRisk = sideEffect.触发时机 === '效果结束后' || sideEffect.触发时机 === '回合结束时' && !sideEffect.关联状态;
      let applicationProbability = Number(sideEffect?.触发概率 ?? 1);
      if (
        !['致死献祭', '全属性降低', '自损反噬', '精神紊乱', '魂力反噬', '命中下降', '动作迟缓', '目标错乱', '施法僵直'].includes(type) ||
        (String(sideEffect?.触发时机 || '').trim() !== '效果生效后' && !deferredRisk && !(hitTiming && (hitSource || hitSources.length) && String(sideEffect?.生效对象 || '').trim() === '技能释放者')) ||
        applicationProbability <= 1e-12
      ) return;
      const payload = buildSideEffectPayload(sideEffect);
      const lethal = payload?.combatEffects?.致死 === true;
      const stateName = String(sideEffect?.副作用状态 || sideEffectStatusMap[type] || type).trim();
      const combatEffects = payload?.combatEffects || {};
      if (!stateName || (!Object.keys(combatEffects).length && !Object.keys(payload.statRatios).length)) return;
      const effectInstanceId = `${rootActionId}:side-effect:${sideEffectIndex}`;
      const resolvedProbability = typeof input?.applicationProbabilityResolver === 'function'
        ? input.applicationProbabilityResolver({ targetId: unitId(target), actor, effect: sideEffect,
            effectInstanceId, baseApplicationProbability: applicationProbability, recordDependency: recordPreviewDependency })
        : applicationProbability;
      applicationProbability = forcedApplicationProbability(input, effectInstanceId, unitId(target)) ?? clamp(
        Number.isFinite(Number(resolvedProbability)) ? Number(resolvedProbability) : applicationProbability, 0, 1,
      );
      const currentTarget = overlay.readUnit(unitId(target)) || target;
      let deferredStartRoundOffset = 1;
      let deferredTriggerProbability = 1;
      let deferredControlStateKey = '';
      if (deferredRisk && sideEffect.触发时机 === '效果结束后') {
        const linkedState = String(sideEffect.关联状态 || '').trim();
        const matched = linkedState ? Object.entries(currentTarget.状态效果 || {}).find(([key, state]) =>
          key === linkedState || String(state?.状态 || state?.状态名称 || '').trim() === linkedState) : null;
        if (linkedState && !matched) return;
        if (matched) {
          const [key, state] = matched;
          if (Array.isArray(state.授予效果) || state.持续原型效果) {
            const risk = { ...sideEffect, 关联状态: key, 触发概率: applicationProbability,
              sourceActionId: rootActionId, sourceEffectId: effectInstanceId };
            overlay.changeUnit(unitId(target), unit => {
              const grant = unit.状态效果[key];
              grant.副作用列表 = [...(grant.副作用列表 || []), risk];
            });
            ledger.addOutcome({ rootActionId, sourceActionId: rootActionId, actor,
              effectInstanceId: `${effectInstanceId}:grant-risk-binding`, targetId: unitId(target),
              windowId: `${rootActionId}:grant-risk-binding:${sideEffectIndex}`, outcomeKind: 'STATE_CHANGED', threatValue: 0,
              evidence: { persistentRiskBinding: { stateKey: key, risk }, sideEffectIndex, marginal: false, applicationProbability: 1 },
            });
          }
          if (typeof state.duration !== 'number' || !Number.isFinite(state.duration)) return;
          const newThisRound = state.__本回合新附加 === true || !Object.hasOwn(target.状态效果 || {}, key);
          deferredTriggerProbability = Object.hasOwn(target.状态效果 || {}, key) ? 1 : clamp(Number(state.__previewApplicationProbability ?? 1), 0, 1);
          if (root.__LWCS_BATTLE_RUNTIME__.structuredControlConsumesActiveOpportunity(state)) {
            deferredControlStateKey = key;
            const opportunity = currentTarget.__battleRuntime?.naturalOpportunity;
            const pending = opportunity?.status === 'PENDING' && Number(opportunity.round) === Number(overlay.baseWorld.回合 || 0);
            deferredStartRoundOffset = Math.max(1, Math.ceil(state.duration)) + Number(!pending);
          } else deferredStartRoundOffset = Math.max(1, Math.ceil(state.duration)) + Number(newThisRound);
        } else deferredStartRoundOffset = Math.max(1, ...baseEffects.map(effect => Number(effect?.持续回合 || 1)));
      }
      const protectionTarget = deferredRisk && sideEffect.触发时机 === '效果结束后'
        ? { ...currentTarget, 状态效果: Object.fromEntries(Object.entries(currentTarget.状态效果 || {}).filter(([key, state]) => {
            if (typeof state.duration !== 'number' || !Number.isFinite(state.duration) || state.召唤物) return true;
            if (root.__LWCS_BATTLE_RUNTIME__.structuredControlConsumesActiveOpportunity(state)) {
              const opportunity = currentTarget.__battleRuntime?.naturalOpportunity;
              const pending = opportunity?.status === 'PENDING' && Number(opportunity.round) === Number(overlay.baseWorld.回合 || 0);
              return Math.max(1, Math.ceil(state.duration)) + Number(!pending) > deferredStartRoundOffset;
            }
            const newThisRound = state.__本回合新附加 === true || !Object.hasOwn(target.状态效果 || {}, key);
            const expiry = Math.max(1, Math.ceil(state.duration)) + Number(newThisRound);
            return deferredControlStateKey ? expiry >= deferredStartRoundOffset : expiry > deferredStartRoundOffset;
          })) }
        : currentTarget;
      if (!lethal && sideEffectProtectionApplies(protectionTarget, stateName, true)) return;
      if (deferredRisk) applicationProbability *= deferredTriggerProbability;
      const riskDependency = hitTiming ? {
        ...(hitSource ? { requiredOutcomeKey: hitSource.distributionGroupKey, requiredOutcomeValues: ['HIT'] }
          : { requiredOutcomeAssignments: hitAlternatives }), ownApplicationProbability: applicationProbability,
      } : {};
      if (hitTiming) applicationProbability *= hitSource ? hitSource.outcomeDistribution.reduce((sum, outcome) => sum +
        (outcome.assignments?.[hitSource.distributionGroupKey] === 'HIT' ? Number(outcome.probability || 0) : 0), 0) : 1 - missedProbability;
      const recipientProfile = !hitTiming && sideEffect.生效对象 !== '技能释放者' &&
        !(sideEffect.生效对象 === '双方' && unitId(target) === unitId(actor)) ? recipientProfiles.get(unitId(target)) : null;
      if (recipientProfile) {
        Object.assign(riskDependency, { requiredOutcomeAssignments: recipientProfile.alternatives, ownApplicationProbability: applicationProbability });
        applicationProbability *= recipientProfile.probability;
      }
      if (applicationProbability <= 1e-12) return;
      if (lethal && deferredRisk) {
        ledger.addOutcome({rootActionId, sourceActionId:rootActionId, declaration, actor, effectInstanceId,
          targetId:unitId(target), windowId:`${rootActionId}:side-effect-window:${sideEffectIndex}`,
          outcomeKind:'STATE_SCHEDULED', threatValue:0,
          evidence:{sideEffectIndex, deferredStartRoundOffset, deferredTiming:sideEffect.触发时机, ...(deferredControlStateKey ? { deferredControlStateKey } : {}), applicationProbability, ...riskDependency,
            lethalSettlement:true, marginal:true,
            stateEntry:{类型:'debuff',状态:stateName,状态名称:stateName,duration:1,战斗效果:cloneValue(combatEffects)}},
        });
        return;
      }
      if (lethal) {
        const current = readHp(currentTarget), settled = cloneValue(currentTarget);
        settlePreviewLethalSideEffect(settled);
        const realizedDelta = readHp(settled) - current;
        const delta = realizedDelta * applicationProbability;
        overlay.changeUnit(unitId(target), unit => {
          if (applicationProbability >= 1 - 1e-12) Object.assign(unit, settled);
          else setHp(unit, current + delta);
        });
        ledger.addOutcome({ rootActionId, sourceActionId: rootActionId, declaration, actor,
          effectInstanceId, targetId: unitId(target), windowId: `${rootActionId}:side-effect-window:${sideEffectIndex}`,
          outcomeKind: 'HP_DELTA', threatValue: Math.max(0, -delta) / readHpMax(currentTarget) * 100,
          evidence: { resource: '生命', current, next: current + delta, delta, realizedDelta, applicationProbability,
            sideEffectIndex,
            ...riskDependency,
            lethalSettlement: true, sacrificeLoss: current, reviveHealing: readHp(settled),
            reviveTriggered: !currentTarget.__本阶段已触发复活 && settled.__本阶段已触发复活 === true },
        });
        return;
      }
      const stateEntry = {
        类型: 'debuff', 状态: stateName, 状态名称: stateName, __本回合新附加: true,
        层数: 1, 描述: `由[${declaration?.skill?.name || declaration?.skill?.魂技名 || '技能'}]触发`,
        duration: Math.max(1, Number(sideEffect?.持续回合 || 1)),
        面板修改比例: cloneValue(payload.statRatios), 面板固定修正: {}, 战斗效果: cloneValue(combatEffects),
        ...(applicationProbability < 1 ? { __previewApplicationProbability: applicationProbability } : {}),
      };
      const replacedStates = [];
      if (!deferredRisk) overlay.changeUnit(unitId(target), unit => {
        replaceProjectedSideEffectState(unit, stateName, stateEntry, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0),
          (key, previous) => replacedStates.push([key, previous]));
      });
      ledger.addOutcome({
        rootActionId,
        sourceActionId: rootActionId,
        declaration,
        actor,
        effectInstanceId,
        targetId: unitId(target),
        windowId: `${rootActionId}:side-effect-window:${sideEffectIndex}`,
        outcomeKind: deferredRisk ? 'STATE_SCHEDULED' : 'STATE_CHANGED',
        threatValue: 0,
        evidence: {
          state: stateName,
          duration: stateEntry.duration,
          sideEffectIndex,
          ...(deferredRisk ? { deferredStartRoundOffset, deferredTiming:sideEffect.触发时机, ...(deferredControlStateKey ? { deferredControlStateKey } : {}) } : {}),
          combatEffect: cloneValue(combatEffects),
          applicationProbability,
          ...riskDependency,
          marginal: true,
          stackMode: 'REPLACE',
          stateEntry: cloneValue(stateEntry),
        },
      });
      if (!deferredRisk) projectStateEndRisks(target, replacedStates, Object.entries(target.状态效果 || {}).filter(([key, state]) =>
        key === stateName || /^(visible:|preview:|transferred:)/.test(key) && (state.状态 || state.状态名称) === stateName),
        overlay, ledger, { ...input, rootActionId, effectInstanceId }, applicationProbability);
    });
  }

  function previewAction(input = {}) {
    const worldSnapshot = input?.worldSnapshot;
    const rawDeclaration = input?.declaration;
    const declaration = rawDeclaration === undefined ? {} : rawDeclaration;
    if (!worldSnapshot || typeof worldSnapshot !== 'object') throw new TypeError('battle_preview_world_missing');
    if (!isPlainRecord(declaration)) throw new TypeError('battle_preview_declaration_invalid');
    const declaredEffects = declaration?.skill?._效果数组;
    if (declaredEffects !== undefined && !Array.isArray(declaredEffects)) {
      throw new TypeError('battle_preview_effect_array_invalid');
    }
    if (Array.isArray(declaredEffects)) {
      declaredEffects.forEach(effect => {
        if (effect !== undefined && !isPlainRecord(effect)) throw new TypeError('battle_preview_effect_invalid');
      });
    }
    const dependencyCapture = input?.captureDependencies === false
      ? null
      : {
          recorder: input?.dependencyRecorder,
          reads: new Map(),
          dependencyRoles: new Map(),
          roleStack: [],
        };
    dependencyCaptureStack.push(dependencyCapture);
    activePreviewDependencyCapture = dependencyCapture || null;
    try {
    const actor = findUnit(worldSnapshot, input?.actorId || declaration?.actorId);
    if (!actor) throw new Error('battle_preview_actor_missing');
    if (declaration.skill?.__mechanismGrantTemporarySkill === true) {
      const key = String(declaration.skill.__mechanismGrantStateKey || '').trim(), state = actor.状态效果?.[key];
      if (!state || String(state.授予触发条件 || state.触发条件 || '').trim() !== '主动触发' ||
          !Array.isArray(state.授予效果) || !(Number(state.可用次数 ?? 0) > 0)) {
        throw new Error(`battle_mechanism_grant_state_unavailable:${key || 'missing'}`);
      }
    }
    const continuedSettlement = Boolean(String(declaration?.__structuredSourceActionId || '').trim() &&
      declaration?.__includeGrantedEffects === false &&
      declaration?.__skipInventoryConsume === true);
    const continueStartedAction = input?.allowStartedActionSourceUnavailable === true && continuedSettlement;
    if (!isAlive(actor) && !continueStartedAction) throw new Error('battle_preview_actor_unavailable');
    const declaredCostStages = declaration?.skill && typeof declaration.skill === 'object'
      ? readSkillCostStages(declaration.skill, { 来源模块: 'BattlePreview_Module', ...declaration })
      : Object.freeze({ 启动: Object.freeze({}), 维持: Object.freeze({}), 形式: 'absolute', 非法项: Object.freeze([]) });
    if (declaredCostStages.非法项?.length) throw new Error(`battle_preview_cost_invalid:${declaredCostStages.非法项.join('|')}`);
    const declaredStartupCosts = normalizeSkillCostMap(
      Object.prototype.hasOwnProperty.call(declaration, 'resourceCosts')
        ? declaration.resourceCosts || {}
        : declaredCostStages.启动,
      declaredCostStages.形式 === 'percentage' ? 'percentage' : 'absolute',
    );
    if (declaredStartupCosts.非法项.length) throw new Error(`battle_preview_cost_invalid:${declaredStartupCosts.非法项.join('|')}`);
    const environmentContext = assessWorldAction({
      ...input,
      worldSnapshot,
      actor,
      declaration,
      costStages: declaredCostStages,
      startupCosts: declaredStartupCosts.values,
      sustainCosts: declaredCostStages.维持,
      durationTicks: readActionDurationTicks(input, declaration),
    });
    if (input?.worldActionContext !== undefined && environmentContext.status !== 'resolved') {
      throw new Error('battle_world_action_context_unavailable');
    }
    if (environmentContext.blocked) throw createEnvironmentBlockError(environmentContext);
    const basisView = String(
      input?.basisView || (input?.beliefSnapshot ? 'BELIEF' : 'DECISION_VISIBLE'),
    ).trim().toUpperCase();
    if (!['DECISION_VISIBLE', 'BELIEF', 'RUNTIME_ACTUAL'].includes(basisView)) {
      throw new Error(`DAMAGE_BASIS_VIEW_INVALID:${basisView || 'missing'}`);
    }
    const snapshotRevision = String(
      input?.snapshotRevision ||
      [input?.worldRevision || stableHash(worldSnapshot), input?.beliefRevision || ''].filter(Boolean).join('|'),
    ).trim();
    const projectionContext = input?.projectionContext || input?.mechanicalProjectionContext || null;
    const captureDamageBasisTrace = input?.captureDamageBasisTrace === true;
    const paymentMode = String(input?.paymentMode || 'FORMAL').trim().toUpperCase();
    if (!['FORMAL', 'EXTERNAL_TIMELINE'].includes(paymentMode)) {
      throw new Error(`BATTLE_PREVIEW_PAYMENT_MODE_INVALID:${paymentMode || 'missing'}`);
    }
    const budgetLimit = Math.max(1, Math.min(MAX_PREVIEW_NODES, Number(input?.previewBudget?.maxNodes || MAX_PREVIEW_NODES)));
    const cacheKey = buildCacheKey({
      ...input,
      environmentCacheKey: environmentContext.cacheKey,
    });
    const rootActionId = canonicalActionId(
      declaration,
      declaration?.candidateId === undefined
        ? 'preview:' + cacheKey
        : declaration.candidateId,
    );
    if (input.cacheResult !== false && previewCache.has(cacheKey)) {
      metrics.cacheHits += 1;
      const cached = previewCache.get(cacheKey);
      // B2：命中刷新插入序（配合写入侧上限构成 LRU）。缓存键含 worldRevision，
      // 随决策换代后旧键不可再命中；session 路径不清缓存（__preparedDecisionWorld
      // 跳过 resetDecisionCaches），无上限时整场累积（raid 实测 +~2600 条/决策、
      // 决策18 达 4.6 万条，值含 afterSnapshot 整世界 ≈ 40MB/决策滞留）。
      previewCache.delete(cacheKey);
      previewCache.set(cacheKey, cached);
      const cachedRoles = new Map(
        Array.isArray(cached?.dependencyRoles)
          ? cached.dependencyRoles
          : [],
      );
      (cached?.dependencyReads || []).forEach(([key, value]) => {
        const roles = cachedRoles.get(key);
        if (Array.isArray(roles) && roles.length) {
          roles.forEach(role =>
            recordPreviewDependency(key, value, role)
          );
          return;
        }
        recordPreviewDependency(key, value);
      });
      return cached;
    }
    metrics.previewCalls += 1;
    const overlay = new PreviewOverlay(worldSnapshot, input?.worldRevision);
    if (!continuedSettlement) for (const { unit } of listUnits(worldSnapshot)) if (unit.__本阶段已触发复活) overlay.changeUnit(unitId(unit), target => { delete target.__本阶段已触发复活; });
    const ledger = new ContributionLedger();
    if (declaration?.counterConsumesNaturalOpportunity === true) {
      overlay.changeUnit(unitId(actor), unit => {
        const opportunity = unit?.__battleRuntime?.naturalOpportunity;
        if (
          !opportunity ||
          Number(opportunity?.round || 0) !== Number(worldSnapshot?.回合 || 0) ||
          String(opportunity?.status || '').trim() !== 'PENDING'
        ) {
          throw new Error('battle_preview_counter_natural_opportunity_unavailable');
        }
        opportunity.status = 'CONSUMED_BY_COUNTER';
        opportunity.consumedByActionId = rootActionId;
        opportunity.actionName = String(
          declaration?.skill?.name || declaration?.skill?.魂技名 || declaration?.actionKind || '反击',
        ).trim();
      });
    }
    const fusion = resolveFusionAction(worldSnapshot, actor, declaration?.skill || {}, {
      resourceCosts: declaredStartupCosts.values,
      requirePendingOpportunity: input?.allowProjectedFusion !== true,
      ignoreResourceAvailability: input?.allowProjectedFusion === true,
    });
    if (fusion.required && !fusion.valid) throw new Error(`battle_preview_${fusion.reason.toLowerCase()}`);
    const costPayers = fusion.required ? fusion.participants : [actor];
    const formalPayment = paymentMode === 'FORMAL'
      ? assessResourcePayment(costPayers, declaredStartupCosts.values, { 形式: declaredStartupCosts.形式 })
      : Object.freeze({ valid: true, ok: true, reason: '', 非法项: Object.freeze([]), payments: Object.freeze([]), costs: Object.freeze({}) });
    if (!formalPayment.valid) throw new Error(`battle_preview_cost_invalid:${formalPayment.reason}`);
    if (!formalPayment.ok) throw new Error(`battle_preview_resource_insufficient:${formalPayment.reason}`);
    if (fusion.required && paymentMode === 'FORMAL') {
      costPayers.forEach(participant => {
        overlay.changeUnit(unitId(participant), unit => {
          unit.__battleRuntime = unit?.__battleRuntime && typeof unit.__battleRuntime === 'object'
            ? unit.__battleRuntime
            : {};
          unit.__battleRuntime.fusionUsageKeys = [...new Set([
            ...(Array.isArray(unit.__battleRuntime.fusionUsageKeys) ? unit.__battleRuntime.fusionUsageKeys : []),
            fusion.fusionKey,
          ].filter(Boolean))];
          if (fusion.partnerIds.includes(unitId(unit))) {
            const opportunity = unit.__battleRuntime.naturalOpportunity && typeof unit.__battleRuntime.naturalOpportunity === 'object'
              ? unit.__battleRuntime.naturalOpportunity
              : {};
            unit.__battleRuntime.naturalOpportunity = {
              ...opportunity,
              status: 'CONSUMED_BY_FUSION',
              consumedByActionId: rootActionId,
              fusionKey: fusion.fusionKey,
            };
          }
        });
      });
    }
    const irreversibleAssetOutcome = buildMechanicalIrreversibleAssetOutcome(actor, declaration, rootActionId);
    if (irreversibleAssetOutcome) {
      ledger.addOutcome({
        rootActionId,
        ...irreversibleAssetOutcome,
      });
    }
    if (paymentMode === 'FORMAL') {
      formalPayment.payments.forEach((payment, index) => {
        const payerId = String(payment.payerId || unitId(payment.payer)).trim();
        const currentPayer = overlay.readUnit(payerId) || payment.payer;
        const before = withPreviewDependencyRole(
          'PAYMENT_AFFORDABILITY',
          () => readResource(currentPayer, payment.resource),
        );
        const cost = Number(payment.amount || 0);
        if (!(cost > 1e-9)) return;
        overlay.setResource(payerId, payment.resource, before - cost);
        ledger.addOutcome({
          rootActionId,
          effectInstanceId: `${rootActionId}:cost:${index}`,
          targetId: payerId,
          windowId: 'ACTION_COST',
          outcomeKind: 'RESOURCE_OPTION_CHANGED',
          threatValue: 0,
          evidence: { resource: payment.resource, before, next: before - cost, delta: -cost, fusionKey: fusion.fusionKey || '' },
        });
      });
    }
    if (String(declaration?.actionKind || '').trim() === 'USE_ITEM' && irreversibleAssetOutcome) {
      overlay.changeUnit(unitId(actor), unit => {
        const inventoryItem = findInventoryEntry(unit, declaration);
        const quantityBefore = Math.max(0, Number(inventoryItem?.数量 ?? inventoryItem?.quantity ?? 0));
        if (!inventoryItem || quantityBefore < 1) {
          throw new Error(`battle_preview_item_unavailable:${String(declaration?.irreversibleAsset?.assetId || declaration?.skill?.name || '').trim()}`);
        }
        const remainingQuantity = quantityBefore - 1;
        if (inventoryItem.数量 !== undefined || inventoryItem.quantity === undefined) inventoryItem.数量 = remainingQuantity;
        if (inventoryItem.quantity !== undefined) inventoryItem.quantity = remainingQuantity;
      });
    }
    let baseEffects = declaration?.actionKind === 'BASIC_ATTACK'
      ? [basicAttackEffect()]
      : Array.isArray(declaredEffects)
        ? declaredEffects.filter(effect => effect && typeof effect === 'object')
        : [];
    const c2Rules = root.__LWCS_C2_CONSUMER_RULES_V1__;
    const previewFoodSkill = String(declaration?.skill?.魂技名 || declaration?.skill?.name || '').trim() !== '坚挺金苍蝇' && /食物属性|香肠/.test([
      ...(Array.isArray(declaration?.skill?.附带属性) ? declaration.skill.附带属性 : []),
      declaration?.skill?.效果描述,
      declaration?.skill?.画面描述,
    ].map(value => String(value || '')).join('|'));
    if (previewFoodSkill && typeof c2Rules?.读取坚挺金苍蝇自用倍率_V1 === 'function' && typeof c2Rules?.缩放技能效果数组_V1 === 'function') {
      const food倍率 = c2Rules.读取坚挺金苍蝇自用倍率_V1(actor);
      if (food倍率.产物效果倍率 > 1) baseEffects = c2Rules.缩放技能效果数组_V1(baseEffects, food倍率.产物效果倍率);
    }
    const grants = declaration?.__includeGrantedEffects === false || String(input?.actionRole || declaration?.actionRole || '').trim().toUpperCase() === 'STATE_TICK'
      ? [] : pendingGrantedEffects(actor, declaration?.actionKind);
    const effects = [
      ...grants.map(entry => ({ ...entry.effect, effectId: entry.effectId })),
      ...baseEffects,
    ];
    if (!effects.length && !['PASS_OPPORTUNITY', 'DEFEND', 'EVADE', 'WITHDRAW', 'EQUIP', 'OBSERVE'].includes(String(declaration?.actionKind || '').trim())) {
      throw new Error('battle_preview_action_effects_missing');
    }
    const nodeBudget = { count: 0, limit: budgetLimit, activeFingerprints: new Set() };
    const primarySuccessProbability = new Map();
    const primaryOutcomeKeyByTarget = new Map();
    const primaryOutcomeDistributionByTarget = new Map();
    let actionDamageMultiplier = 1;
    if (String(declaration?.actionKind || '').trim().toUpperCase() === 'WITHDRAW') {
      const contest = buildWithdrawalContest(worldSnapshot, actor);
      ledger.addOutcome({
        rootActionId,
        sourceActionId: rootActionId,
        actor: actor,
        effectInstanceId: `${rootActionId}:withdrawal-contest`,
        targetId: unitId(actor),
        windowId: 'CURRENT_OPPORTUNITY',
        outcomeKind: 'WITHDRAWAL_CONTEST',
        threatValue: 0,
        evidence: {
          ...contest,
          delta: -contest.expectedPursuitDamage,
        },
      });
    }
    effects.forEach((effect, index) => {
      const effectWorldSnapshot = overlay.snapshot();
      const effectActor = overlay.readUnit(unitId(actor)) || actor;
      const targets = index === 0 && effect.原型 === '时窗修正' && input.resolvedTimeWindow
        ? input.resolvedTimeWindow.targetIds.map(id => findUnit(effectWorldSnapshot, id)).filter(Boolean)
        : resolveTargets(effectWorldSnapshot, effectActor, declaration, effect);
      if (!targets.length) return;
      const followsPrimary = index > 0 && String(effect?.生效方式 || '').trim() === '跟随主原型';
      const positionObject = String(effect?.原型 || '').trim() === '位移执行'
        ? String(effect?.位移对象 || '').trim()
        : '';
      const primaryReferenceTargetId = target => {
        const targetId = unitId(target);
        if (!['自身', '自身与目标'].includes(positionObject) || targetId !== unitId(actor)) return targetId;
        return (Array.isArray(declaration?.targetIds) ? declaration.targetIds : [])
          .map(value => String(value || '').trim())
          .find(value => value && value !== unitId(actor) && primarySuccessProbability.has(value)) || targetId;
      };
      const context = {
        actor: effectActor,
        declaration,
        worldSnapshot: effectWorldSnapshot,
        conditionalSourceEffect: index === 0 && effect.原型 === '时窗修正' ? input.resolvedTimeWindow?.sourceEffect : undefined,
        nodeBudget,
        depth: 0,
        effectPath: [],
        rootActionId,
        effectInstanceId: index < grants.length
          ? canonicalEffectId(effect, rootActionId, index)
          : canonicalEffectId(effect, rootActionId, index - grants.length),
        windowId: `round:${Number(worldSnapshot?.回合 || 0)}:effect:${index}`,
        battleIntent: input?.battleIntent || {},
        damageMultiplierByTarget: input?.damageMultiplierByTarget || {},
        evadeProbabilityByTarget: input?.evadeProbabilityByTarget || {},
        damageMultiplierResolver: input?.damageMultiplierResolver,
        hitProbabilityResolver: input?.hitProbabilityResolver,
        applicationProbabilityResolver: input?.applicationProbabilityResolver,
        settleStateEndRisks: input?.settleStateEndRisks,
        basisView,
        snapshotRevision,
        projectionContext,
        captureDamageBasisTrace,
        environmentContext,
        forcedApplicationProbabilityByEffect:
          input?.forcedApplicationProbabilityByEffect || {},
        actionDamageMultiplier,
        primaryResolvedEffectByTarget: index === 0 ? new Map() : undefined,
        damageOutcomeResolver: input?.damageOutcomeResolver,
        primarySucceeded: false,
        primaryOutcomeKeyByTarget,
        primaryOutcomeDistributionByTarget,
      };
      context.primarySucceededByTarget = new Map(
        targets.map(target => [
          unitId(target),
          primarySuccessProbability.get(primaryReferenceTargetId(target)) >= 1 - 1e-9,
        ]),
      );
      context.primarySuccessProbabilityByTarget = new Map(
        targets.map(target => [
          unitId(target),
          primarySuccessProbability.get(primaryReferenceTargetId(target)),
        ]),
      );
      context.primaryOutcomeByTarget = new Map(
        targets.map(target => {
          const distribution = primaryOutcomeDistributionByTarget.get(primaryReferenceTargetId(target)) || [];
          return [
            unitId(target),
            distribution.length === 1
              ? String(distribution[0]?.outcome || '').trim().toUpperCase()
              : '',
          ];
        }),
      );
      const prototype = String(effect?.原型 || '').trim();
      const hasOwnApplicationProbability =
        effect?.成功率 !== undefined ||
        effect?.触发概率 !== undefined;
      const ownApplicationProbabilityByTarget = new Map(
        targets.map(target => {
          const targetId = unitId(target);
          const baseApplicationProbability = (hasOwnApplicationProbability
            ? normalizeEffectProbability(
                effect?.成功率 ?? effect?.触发概率,
                1,
              )
            : 1) * stateApplicationProbabilityMultiplier(overlay.readUnit(targetId), effect);
          const resolvedApplicationProbability =
            typeof input?.applicationProbabilityResolver === 'function'
              ? input.applicationProbabilityResolver({
                  targetId,
                  actor: effectActor,
                  effect,
                  effectInstanceId: context.effectInstanceId,
                  baseApplicationProbability,
                  recordDependency: recordPreviewDependency,
                })
              : baseApplicationProbability;
          const forcedProbability = forcedApplicationProbability(
            input,
            context.effectInstanceId,
            targetId,
          );
          return [
            targetId,
            forcedProbability === null
              ? clamp(
                  Number.isFinite(Number(resolvedApplicationProbability))
                    ? Number(resolvedApplicationProbability)
                    : baseApplicationProbability,
                  0,
                  1,
                )
              : forcedProbability,
          ];
        }),
      );
      if (!String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果)) {
        previewCreationCarrier(effect, overlay, ledger, context);
        return;
      }
      context.ownApplicationProbabilityByTarget =
        ownApplicationProbabilityByTarget;
      if (followsPrimary) {
        context.applicationProbabilityByTarget = new Map(
          targets.map(target => {
            const targetId = unitId(target);
            return [
              targetId,
              clamp(
                Number(primarySuccessProbability.get(primaryReferenceTargetId(target)) ?? 0),
                0,
                1,
              ),
            ];
          })
        );
        context.requiredOutcomeKeyByTarget = new Map(
          targets.map(target => [unitId(target), primaryOutcomeKeyByTarget.get(primaryReferenceTargetId(target)) || ''])
        );
        context.requiredOutcomeValuesByTarget = new Map(
          targets.map(target => [unitId(target), ['HIT']])
        );
        context.requiredOutcomeUniverseByTarget = new Map(
          targets.map(target => [
            unitId(target),
            (primaryOutcomeDistributionByTarget.get(primaryReferenceTargetId(target)) || [])
              .map(row => String(row?.outcome || '').trim().toUpperCase())
              .filter(Boolean),
          ])
        );
      } else if (index === 0) {
        context.outcomeAssignmentKeyByTarget = new Map(
          targets.map(target => {
            const key = [
              rootActionId,
              context.effectInstanceId,
              context.windowId,
              unitId(target),
              'primary-resolution',
            ].join('|');
            primaryOutcomeKeyByTarget.set(unitId(target), key);
            return [unitId(target), key];
          })
        );
      }
      if (
        !followsPrimary &&
        !['伤害结算', '状态施加', '判定修正', '结算修正', '资源锁定', '位移执行', '决策干扰'].includes(prototype)
      ) {
        context.applicationProbabilityByTarget =
          ownApplicationProbabilityByTarget;
      }
      const effectOutcomeStart = ledger.entries.length;
      applyEffect(effect, targets, overlay, ledger, context, 0);
      if (String(effect?.原型 || '').trim() === '炸环') {
        actionDamageMultiplier *= Math.max(0, Number(effect?.强化倍率 || 1));
      }
      if (index === 0) {
        [...new Set([...targets.map(unitId), ...context.primaryResolvedEffectByTarget.keys()])].forEach(targetId => {
          const target = findUnit(effectWorldSnapshot, targetId);
          const primary = context.primaryResolvedEffectByTarget.get(targetId);
          if (!primary) {
            primarySuccessProbability.set(targetId, 0);
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([Object.freeze({ outcome: 'MISS', probability: 1 })]));
            return;
          }
          const effect = primary.effect;
          const prototype = String(effect?.原型 || '').trim();
          const primaryEntries = ledger.entries.slice(effectOutcomeStart).filter(entry => entry.targetId === targetId &&
            (entry.effectInstanceId === primary.effectInstanceId || prototype === '时光回溯' && entry.effectInstanceId === `${primary.effectInstanceId}:state` ||
              prototype === '资源转移' && entry.effectInstanceId.startsWith(`${primary.effectInstanceId}:`)) ||
            prototype === '召唤生成' && entry.actorId === targetId && entry.outcomeKind === 'SUMMON_WINDOW' && entry.effectInstanceId.startsWith(`${primary.effectInstanceId}:summon:`));
          const resolvedGroupKey = primaryEntries.find(entry => entry.evidence?.distributionGroupKey)?.evidence?.distributionGroupKey;
          if (resolvedGroupKey) primaryOutcomeKeyByTarget.set(targetId, resolvedGroupKey);
          if (prototype === '伤害结算') {
            if (typeof input.damageOutcomeResolver === 'function') {
              const branch = primaryEntries.find(entry => entry.outcomeKind === 'HP_DELTA')?.evidence?.outcomeDistribution?.[0];
              if (!branch || branch.probability !== 1) throw Error('BATTLE_PREVIEW_PRIMARY_OUTCOME_UNRESOLVED');
              const outcome = branch.assignments?.[primaryOutcomeKeyByTarget.get(targetId)] || (String(branch.branchKey).startsWith('damage:evaded') ? 'EVADED' : (branch.hitCounts || []).some(count => count > 0) ? 'HIT' : 'MISS');
              primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([Object.freeze({ outcome, probability: 1 })]));
              primarySuccessProbability.set(targetId, outcome === 'HIT' ? 1 : 0);
              return;
            }
            const baseHitProbability = estimateHitProbability(effectActor, target, effect);
            const resolvedHitProbability = typeof input?.hitProbabilityResolver === 'function'
              ? input.hitProbabilityResolver({
                  targetId: unitId(target),
                  actor: effectActor,
                  effect,
                  effectInstanceId: primary.effectInstanceId,
                  baseHitProbability,
                  recordDependency: recordPreviewDependency,
                })
              : null;
            const perSegment = clamp(
              resolvedHitProbability !== null &&
              resolvedHitProbability !== undefined &&
              Number.isFinite(Number(resolvedHitProbability))
                ? Number(resolvedHitProbability)
                : baseHitProbability,
              0,
              1,
            );
            const segments = Math.max(1, Math.floor(Number(effect?.攻击段数 || effect?.段数 || 1)) || 1);
            const hitProbability = 1 - Math.pow(1 - perSegment, segments);
            const evadeProbability = clamp(Number(
              input?.evadeProbabilityByTarget?.[targetId] ??
              input?.evadeProbabilityByTarget?.get?.(targetId) ??
              0
            ), 0, 1);
            const distribution = [
              ...(evadeProbability > 1e-12
                ? [{ outcome: 'EVADED', probability: evadeProbability }]
                : []),
              ...((1 - evadeProbability) * (1 - hitProbability) > 1e-12
                ? [{
                    outcome: 'MISS',
                    probability: (1 - evadeProbability) * (1 - hitProbability),
                  }]
                : []),
              ...((1 - evadeProbability) * hitProbability > 1e-12
                ? [{
                    outcome: 'HIT',
                    probability: (1 - evadeProbability) * hitProbability,
                  }]
                : []),
            ];
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze(
              distribution.map(row => Object.freeze(row))
            ));
            primarySuccessProbability.set(
              targetId,
              distribution
                .filter(row => row.outcome === 'HIT')
                .reduce((sum, row) => sum + row.probability, 0),
            );
          } else if (['状态施加', '判定修正', '结算修正', '资源锁定', '位移执行', '决策干扰'].includes(prototype)) {
            const primaryEvidence = primaryEntries.find(entry => entry.evidence?.applicationProbability !== undefined)?.evidence;
            const primaryProbability = clamp(Number(
              primaryEvidence?.applicationProbability ?? 0
            ), 0, 1);
            const materialOutcome = primaryEvidence?.marginal === false ? 'MISS' : 'HIT';
            primarySuccessProbability.set(targetId, materialOutcome === 'HIT' ? primaryProbability : 0);
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([
              ...(primaryProbability > 1e-12
                ? [Object.freeze({ outcome: materialOutcome, probability: primaryProbability })]
                : []),
              ...(primaryProbability < 1 - 1e-12
                ? [Object.freeze({
                    outcome: 'RESISTED',
                    probability: 1 - primaryProbability,
                  })]
                : []),
            ]));
          } else {
            const realizedProbability = primaryResolutionProbabilityFromOutcomes(
              primaryEntries,
              targetId,
              prototype,
            );
            const primaryProbability = realizedProbability === null ? 1 : realizedProbability;
            primarySuccessProbability.set(targetId, primaryProbability);
            primaryOutcomeDistributionByTarget.set(targetId, Object.freeze([
              ...(primaryProbability > 1e-12
                ? [Object.freeze({ outcome: 'HIT', probability: primaryProbability })]
                : []),
              ...(primaryProbability < 1 - 1e-12
                ? [Object.freeze({ outcome: 'MISS', probability: 1 - primaryProbability })]
                : []),
            ]));
          }
          if (observablePrimaryStatePrototypes.has(prototype) || ['状态转移', '状态交换'].includes(prototype) &&
              !primaryEntries.some(entry => entry.evidence.stateTransfer?.targets.length > 1)) {
            const key = primaryOutcomeKeyByTarget.get(targetId);
            const distribution = primaryOutcomeDistributionByTarget.get(targetId) || [];
            for (const entry of primaryEntries) {
              const position = ledger.entries.indexOf(entry);
              ledger.entries[position] = Object.freeze({ ...entry, evidence: Object.freeze({ ...entry.evidence,
                distributionGroupKey: key,
                outcomeDistribution: distribution.map(row => ({ probability: row.probability, branchKey: `primary:${row.outcome}`, assignments: { [key]: row.outcome }, delta: 0 })),
              }) });
            }
          }
        });
      }
    });
    const consumedGrantKeys = grants.map(entry => entry.stateKey);
    if (declaration.skill?.__mechanismGrantTemporarySkill === true && declaration.skill.__mechanismGrantStateKey) {
      consumedGrantKeys.push(String(declaration.skill.__mechanismGrantStateKey));
    }
    if (consumedGrantKeys.length) {
      let consumed = [];
      overlay.changeUnit(unitId(actor), unit => { consumed = consumeGrantedStateUses(unit, consumedGrantKeys); });
      consumed.forEach(({ stateKey, state, before, beforeUses, afterUses }, index) => ledger.addOutcome({
        rootActionId, actorId: unitId(actor), targetId: unitId(actor),
        effectInstanceId: `${rootActionId}:grant-consume:${index}`, windowId: `round:${Number(worldSnapshot.回合 || 0)}:grant-consume`,
        outcomeKind: 'STATE_CHANGED', threatValue: 0,
        evidence: { prototype: '机制授予', state: String(before.状态 || before.状态名称 || '机制授予'),
          grantConsumption: true, grantStateKey: stateKey, beforeUses, afterUses, marginal: false, applicationProbability: 1,
          stateEntries: afterUses > 0 ? { [stateKey]: cloneValue(state) } : {}, removedKeys: afterUses > 0 ? [] : [stateKey] },
      }));
      const grantEndRiskStart = ledger.entries.length;
      consumed.forEach(({ stateKey, state, afterUses }, index) => {
        if (afterUses !== 0 || !state.副作用列表?.length) return;
        const risks = normalizeSideEffectList(state.副作用列表).filter(effect =>
          effect.触发时机 === '效果结束后' && (!effect.关联状态 || effect.关联状态 === stateKey));
        if (!risks.length) return;
        applyImmediateSideEffects({ actionKind: 'RELEASE_SKILL', targetIds: [unitId(actor)], skill: {
          魂技名: state.来源技能 || '授予效果',
          副作用列表: risks.map(effect => ({ ...effect, 触发时机: '效果生效后', 生效对象: '技能释放者' })),
        } }, [], actor, overlay, ledger, `${rootActionId}:grant-end:${index}`, input);
      });
      for (let index = grantEndRiskStart; index < ledger.entries.length; index += 1) {
        const entry = ledger.entries[index];
        ledger.entries[index] = Object.freeze({ ...entry, evidence: Object.freeze({ ...entry.evidence,
          sideEffectSequence: index - ledger.entries.length,
        }) });
      }
    }
    applyImmediateSideEffects(declaration, baseEffects, actor, overlay, ledger, rootActionId, input);
    const environmentApplications = applyEnvironmentalHazards({
      environmentContext,
      overlay,
      ledger,
      actor,
      rootActionId,
      battleIntent: input?.battleIntent || {},
      basisView,
      snapshotRevision,
    });
    settleImmediateCooperativeSummons({
      overlay,
      ledger,
      rootActionId,
      declaration,
      worldSnapshot,
      nodeBudget,
      battleIntent: input?.battleIntent || {},
      basisView,
      snapshotRevision,
      projectionContext,
      captureDamageBasisTrace,
      environmentContext,
      damageMultiplierByTarget: input?.damageMultiplierByTarget || {},
      evadeProbabilityByTarget:
        input?.evadeProbabilityByTarget || {},
      damageMultiplierResolver: input?.damageMultiplierResolver,
      applicationProbabilityResolver: input?.applicationProbabilityResolver,
      hitProbabilityResolver: input?.hitProbabilityResolver,
      damageOutcomeResolver: input?.damageOutcomeResolver,
      forcedApplicationProbabilityByEffect:
        input?.forcedApplicationProbabilityByEffect || {},
    });
    metrics.maxNodesObserved = Math.max(metrics.maxNodesObserved, nodeBudget.count);
    const resultValue = {
      version: VERSION,
      cacheKey,
      actorId: unitId(actor),
      actionId: rootActionId,
      actionKind: String(declaration?.actionKind || '').trim(),
      ...(continuedSettlement ? { continuedSettlement: true } : {}),
      nodeCount: nodeBudget.count,
      contributions: Object.freeze([...ledger.entries]),
      scheduledEvents: Object.freeze(overlay.mergedScheduledEvents()),
      changedRules: Object.freeze(
        Object.fromEntries(overlay.mergedMap('changedRules')),
      ),
      changedUnitIds: Object.freeze([
        ...overlay.mergedMap('changedUnits').keys(),
      ]),
      afterSnapshot: overlay.snapshot(),
      environment: environmentContext,
      environmentApplications,
      metrics: Object.freeze({ overlayWrites: metrics.overlayWrites, fullCloneCalls: 0 }),
    };
    resultValue.planningEvidence = buildEffectPlanningEvidence({
      worldSnapshot,
      actor,
      result: resultValue,
      effects,
      consumer: 'BattlePreview.previewAction',
    });
    const operationGraph = input?.buildOperationGraph === false
      ? null
      : buildActionOperationGraph({
          previewResult: resultValue,
          worldSnapshot,
          actionFingerprint: input.actionFingerprint || cacheKey,
          rootActionId,
          round: Number(worldSnapshot?.回合 || 0),
          opportunitySequence: Number(
            input?.actionOpportunity?.sequence ||
            input?.actionOpportunity?.createdAtSequence ||
            0
          ),
          actionSequence: Number(input?.actionSequence || 0),
        });
    Object.defineProperty(resultValue, 'dependencyReads', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze([...(dependencyCapture?.reads || [])].map(([key, value]) =>
        Object.freeze([key, cloneValue(value)])
      )),
    });
    Object.defineProperty(resultValue, 'dependencyRoles', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze(
        [...(dependencyCapture?.dependencyRoles || [])]
          .map(([key, roles]) => Object.freeze([
            key,
            Object.freeze([...roles].sort()),
          ])),
      ),
    });
    Object.defineProperty(resultValue, 'operationGraph', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: operationGraph,
    });
    const result = Object.freeze(resultValue);
    if (input.cacheResult !== false) previewCache.set(cacheKey, result);
    // 高基数 7v7 一回合可产生近千条唯一预演；缓存仅影响重算次数，不影响语义。
    while (previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
      previewCache.delete(previewCache.keys().next().value);
      metrics.cacheEvictions += 1;
    }
    return result;
    } finally {
      const popped = dependencyCaptureStack.pop();
      if (popped !== dependencyCapture) {
        dependencyCaptureStack.length = 0;
        activePreviewDependencyCapture = null;
        throw new Error('battle_preview_dependency_capture_stack_corrupted');
      }
      activePreviewDependencyCapture = dependencyCaptureStack[dependencyCaptureStack.length - 1] || null;
    }
  }

  function buildActionOperationGraph(input = {}) {
    const previewResult = input?.previewResult || input;
    if (!previewResult || typeof previewResult !== 'object') {
      throw new TypeError('BATTLE_PREVIEW_OPERATION_GRAPH_RESULT_MISSING');
    }
    metrics.operationGraphBuilds += 1;
    const rootActionId = String(
      input?.rootActionId ||
      previewResult?.actionId ||
      previewResult?.cacheKey ||
      ''
    ).trim();
    const round = Math.max(
      0,
      Number(input?.round ?? input?.worldSnapshot?.回合 ?? 0),
    );
    const opportunitySequence = Math.max(
      0,
      Number(input?.opportunitySequence || 0),
    );
    const actionSequence = Math.max(0, Number(input?.actionSequence || 0));
    const outcomeGroups = new Map();
    const deterministicEvents = [];
    const conditionalEvents = [];
    const sideEffectPhasePriority = Math.max(...Object.values(battleEventContract.phasePriority)) + 1;
    let effectSequence = 0;
    const registerGroup = ({
      groupKey,
      rootActionId: sourceRootActionId = rootActionId,
      effectInstanceIds = [],
      probability,
      probabilitySources = [],
      successAssignments = {},
      failureAssignments = {},
      outcomes = null,
      retainDeterministicOutcome = false,
    }) => {
      const normalizedGroupKey = String(groupKey || '').trim();
      const successProbability = clamp(Number(probability), 0, 1);
      const explicitOutcomes = Array.isArray(outcomes)
        ? outcomes
            .map((outcome, index) => Object.freeze({
              outcomeId: String(
                outcome?.outcomeId ||
                outcome?.branchKey ||
                `OUTCOME_${index + 1}`
              ).trim().toUpperCase(),
              probability: clamp(Number(outcome?.probability || 0), 0, 1),
              assignments: Object.freeze({
                [normalizedGroupKey]: String(
                  outcome?.outcomeId ||
                  outcome?.branchKey ||
                  `OUTCOME_${index + 1}`
                ).trim().toUpperCase(),
                ...cloneValue(outcome?.assignments || {}),
              }),
            }))
            .filter(outcome => outcome.probability > 1e-15)
        : [];
      if (
        !normalizedGroupKey ||
        (
          explicitOutcomes.length
            ? explicitOutcomes.length <= 1 && !retainDeterministicOutcome
            : successProbability <= 1e-12 ||
              successProbability >= 1 - 1e-12
        )
      ) {
        return '';
      }
      const normalizedOutcomes = explicitOutcomes.length
        ? explicitOutcomes
        : [
            Object.freeze({
              outcomeId: 'SUCCESS',
              probability: successProbability,
              assignments: Object.freeze({
                [normalizedGroupKey]: 'SUCCESS',
                ...cloneValue(successAssignments),
              }),
            }),
            Object.freeze({
              outcomeId: 'FAILURE',
              probability: 1 - successProbability,
              assignments: Object.freeze({
                [normalizedGroupKey]: 'FAILURE',
                ...cloneValue(failureAssignments),
              }),
            }),
          ];
      const group = Object.freeze({
        schemaVersion: '8.3-outcome-group-1',
        groupKey: normalizedGroupKey,
        rootActionId: String(sourceRootActionId || rootActionId).trim(),
        effectInstanceIds: Object.freeze([
          ...new Set(effectInstanceIds.map(value => String(value || '').trim()).filter(Boolean)),
        ].sort()),
        probabilitySources: Object.freeze(cloneValue(probabilitySources)),
        outcomes: Object.freeze(normalizedOutcomes),
      });
      battleEventContract.validateOutcomeGroup(group);
      const existing = outcomeGroups.get(normalizedGroupKey);
      if (existing) {
        const comparable = value => ({
          schemaVersion: value.schemaVersion,
          groupKey: value.groupKey,
          rootActionId: value.rootActionId,
          probabilitySources: value.probabilitySources,
          outcomes: value.outcomes,
        });
        if (
          stableHash(comparable(existing)) !== stableHash(comparable(group))
        ) {
          throw new Error(
            `BATTLE_OUTCOME_GROUP_CONFLICT:${normalizedGroupKey}`,
          );
        }
        const mergedGroup = Object.freeze({
          ...existing,
          effectInstanceIds: Object.freeze([
            ...new Set([
              ...(existing.effectInstanceIds || []),
              ...(group.effectInstanceIds || []),
            ]),
          ].sort()),
        });
        outcomeGroups.set(normalizedGroupKey, mergedGroup);
        return normalizedGroupKey;
      }
      outcomeGroups.set(normalizedGroupKey, group);
      return normalizedGroupKey;
    };
    const attachEffectToGroup = (groupKey, effectInstanceId) => {
      const normalizedGroupKey = String(groupKey || '').trim();
      const normalizedEffectInstanceId = String(
        effectInstanceId || ''
      ).trim();
      if (!normalizedGroupKey || !normalizedEffectInstanceId) return;
      const existing = outcomeGroups.get(normalizedGroupKey);
      if (!existing) return;
      outcomeGroups.set(normalizedGroupKey, Object.freeze({
        ...existing,
        effectInstanceIds: Object.freeze([
          ...new Set([
            ...(existing.effectInstanceIds || []),
            normalizedEffectInstanceId,
          ]),
        ].sort()),
      }));
    };
    const resolveApplicationGroup = ({
      source = {},
      effectInstanceId,
      probability,
      fallbackKey,
      successAssignments,
      failureAssignments,
    }) => {
      if (!(probability > 1e-12 && probability < 1 - 1e-12)) {
        return { groupKey: '', successValue: '' };
      }
      const explicitKeys = [
        source?.distributionGroupKey,
        source?.probabilityGroupKey,
      ].map(value => String(value || '').trim()).filter(Boolean);
      const existingKey = explicitKeys.find(key => outcomeGroups.has(key));
      if (existingKey) {
        const existing = outcomeGroups.get(existingKey);
        const successValue = (existing?.outcomes || []).map(outcome => String(
          outcome?.assignments?.[existingKey] || outcome?.outcomeId || '',
        ).trim().toUpperCase()).find(value => ['HIT', 'SUCCESS'].includes(value));
        if (!successValue) {
          throw new Error(`BATTLE_OUTCOME_GROUP_SUCCESS_MISSING:${existingKey}`);
        }
        attachEffectToGroup(existingKey, effectInstanceId);
        return { groupKey: existingKey, successValue };
      }
      return {
        groupKey: registerGroup({
          groupKey: explicitKeys[0] || fallbackKey,
          effectInstanceIds: [effectInstanceId],
          probability,
          probabilitySources: [{
            sourceType: 'EFFECT_APPLICATION',
            baseProbability: probability,
            finalProbability: probability,
            dependencyKeys: [],
          }],
          successAssignments: { ...successAssignments, ...Object.fromEntries(explicitKeys.slice(1).map(key => [key, 'SUCCESS'])) },
          failureAssignments: { ...failureAssignments, ...Object.fromEntries(explicitKeys.slice(1).map(key => [key, 'FAILURE'])) },
        }),
        successValue: 'SUCCESS',
      };
    };
    const registerEvent = inputEvent => {
      if (inputEvent.requiredOutcomeAssignments) {
        inputEvent.requiredOutcomeAssignments.filter(row => row.enabled).forEach((alternative, index) => registerEvent({
          ...inputEvent,
          requiredOutcomeAssignments: undefined,
          eventId: `${inputEvent.eventId}:source-set:${index}`,
          conditionalOn: { ...inputEvent.conditionalOn, ...alternative.conditionalOn },
        }));
        return;
      }
      const {
      eventId,
      effectInstanceId = '',
      sourceActorId = previewResult?.actorId || '',
      targetId = '',
      operation,
      conditionalOn = null,
      payload = {},
      dependencyKeys = [],
      scheduledRound = round,
      scheduledOpportunitySequence = opportunitySequence,
      scheduledActionSequence = actionSequence,
      phasePriority,
      scheduledEffectSequence,
      } = inputEvent;
      const normalizedOperation = String(operation || '').trim().toUpperCase();
      const event = Object.freeze({
        schemaVersion: '8.3-projected-event-1',
        eventId: String(eventId || '').trim(),
        rootActionId,
        effectInstanceId: String(effectInstanceId || '').trim(),
        sourceActorId: String(sourceActorId || '').trim(),
        targetId: String(targetId || '').trim(),
        operation: normalizedOperation,
        round: Math.max(0, Number(scheduledRound || 0)),
        opportunitySequence: Math.max(
          0,
          Number(scheduledOpportunitySequence || 0),
        ),
        actionSequence: Math.max(0, Number(scheduledActionSequence || 0)),
        phasePriority: Math.max(
          0,
          Number(
            phasePriority ??
            battleEventContract.phasePriority[normalizedOperation] ??
            50
          ),
        ),
        effectSequence: Math.max(
          0,
          Number(scheduledEffectSequence ?? ++effectSequence),
        ),
        conditionalOn:
          conditionalOn && Object.keys(conditionalOn).length
            ? Object.freeze(cloneValue(conditionalOn))
            : null,
        payload: Object.freeze(cloneValue(payload)),
        dependencyKeys: Object.freeze([
          ...new Set(
            dependencyKeys
              .map(value => String(value || '').trim())
              .filter(Boolean),
          ),
        ].sort()),
      });
      battleEventContract.validateProjectedEvent(event);
      (event.conditionalOn ? conditionalEvents : deterministicEvents).push(event);
      return event;
    };
    const resourceLockProfiles = new Map(
      (previewResult?.contributions || [])
        .filter(entry =>
          String(entry?.evidence?.prototype || '').trim() === '资源锁定'
        )
        .map(entry => {
          const effectInstanceId = String(entry?.effectInstanceId || '').trim();
          const targetId = String(entry?.targetId || '').trim();
          const evidence = entry?.evidence || {};
          return [[effectInstanceId, targetId].join('|'), Object.freeze({
            effectInstanceId,
            targetId,
            resource: String(
              evidence?.combatEffect?.locked_resource ||
              evidence?.resource ||
              '魂力'
            ).trim() || '魂力',
            lockType: String(evidence?.lockType || evidence?.combatEffect?.locked_type || '').trim(),
            requiredOutcomeAssignments: evidence?.requiredOutcomeAssignments,
            ratio: clamp(Number(evidence?.lockedRatio ?? evidence?.combatEffect?.locked_ratio ?? 0), 0, 1),
            duration: Math.max(1, Number(evidence?.duration || 1)),
            applicationProbability: clamp(
              Number(evidence?.applicationProbability ?? 1),
              0,
              1,
            ),
          })];
        }),
    );
    const applicationGroupByEffectTarget = new Map();
    const applicationConditionsByEffectTarget = new Map();
    const requiredOutcomeGroupKeys = new Set([
      ...(input.requiredOutcomeGroupKeys || []),
      ...(previewResult?.contributions || [])
        .flatMap(entry => [String(entry?.evidence?.requiredOutcomeKey || '').trim(),
          ...(entry?.evidence?.requiredOutcomeAssignments || []).flatMap(row => Object.keys(row.conditionalOn || {})),
          ...(entry?.evidence?.stateTransfer?.targets || []).flatMap(target => [String(target.requiredOutcomeKey || '').trim(),
            ...(target.requiredOutcomeAssignments || []).flatMap(row => Object.keys(row.conditionalOn || {}))]),
        ])
        .filter(Boolean),
    ]);
    const replayedDamageKeys = new Set();
    const replayedDamageEffects = new Set();
    for (const entry of input.damageOutcomeEntries || []) {
      const evidence = entry.evidence;
      const groupKey = evidence.distributionGroupKey || evidence.probabilityGroupKey;
      const conditionalGroups = new Map();
      evidence.outcomeDistribution.forEach((outcome, index) => {
        const conditionalOn = { ...outcome.priorResourceAssignments, ...outcome.conditionalOn };
        const conditionKey = JSON.stringify(Object.entries(conditionalOn).sort(([left], [right]) => left.localeCompare(right)));
        if (!conditionalGroups.has(conditionKey)) conditionalGroups.set(conditionKey, []);
        conditionalGroups.get(conditionKey).push({ ...outcome, conditionalOn, outcomeId: 'DAMAGE_' + index });
      });
      replayedDamageKeys.add(groupKey);
      replayedDamageEffects.add(entry.effectInstanceId + '|' + entry.targetId);
      let conditionalIndex = 0;
      for (const rows of conditionalGroups.values()) {
        const choiceKey = groupKey + ':damage-choice:' + conditionalIndex++;
        const prefixMass = rows[0].priorResourceAssignments ? rows.reduce((sum, row) => sum + row.probability, 0) : 1;
        const outcomes = rows.map(outcome => ({ ...outcome,
          probability: outcome.probability / prefixMass,
          assignments: { ...outcome.assignments, [choiceKey]: outcome.outcomeId } }));
        registerGroup({ groupKey: choiceKey, effectInstanceIds: [entry.effectInstanceId], outcomes, retainDeterministicOutcome: true });
        outcomes.forEach(outcome => registerEvent({
          eventId: entry.eventId + ':' + outcome.outcomeId,
          effectInstanceId: entry.effectInstanceId, targetId: entry.targetId,
          operation: 'RESOURCE_REDUCE', phasePriority: battleEventContract.phasePriority.RESOURCE_REDUCE,
          scheduledEffectSequence: (previewResult.contributions || []).indexOf(entry),
          conditionalOn: { ...outcome.conditionalOn, [choiceKey]: outcome.outcomeId },
          payload: { resource: '生命', damageOutcome: { hpDamage: outcome.hpDamage, shieldAbsorb: outcome.shieldAbsorb,
            ...(outcome.revival ? { reviveHealing: outcome.reviveHealing, revival: cloneValue(outcome.revival) } : {}),
            ...(outcome.reflection ? { reflection: cloneValue(outcome.reflection) } : {}),
            ...(outcome.ruleBlockConsumed > 0 ? { ruleBlockConsumed: outcome.ruleBlockConsumed } : {}),
            ...(outcome.deathSaveConsumed > 0 ? { deathSaveConsumed: outcome.deathSaveConsumed } : {}) } },
        }));
      }
    }
    (previewResult?.contributions || []).forEach(entry => {
      const evidence = entry?.evidence || {};
      const groupKey = String(
        evidence?.distributionGroupKey ||
        evidence?.probabilityGroupKey ||
        ''
      ).trim();
      if (!groupKey || replayedDamageKeys.has(groupKey) || !requiredOutcomeGroupKeys.has(groupKey)) return;
      const groupedOutcomes = new Map();
      (evidence?.outcomeDistribution || []).forEach((outcome, index) => {
        if (Object.keys(outcome?.conditionalOn || {}).length) return;
        const assignmentValue = String(
          outcome?.assignments?.[groupKey] ||
          (Array.isArray(outcome?.hitCounts) ? outcome.hitCounts.some(count => count > 0) ? 'HIT' : 'MISS' : '') ||
          outcome?.outcomeId ||
          outcome?.outcome ||
          ''
        ).trim().toUpperCase();
        if (!assignmentValue) return;
        const probability = clamp(Number(outcome?.probability || 0), 0, 1);
        if (!(probability > 1e-15)) return;
        const current = groupedOutcomes.get(assignmentValue) || {
          outcomeId: assignmentValue,
          probability: 0,
          assignments: {
            [groupKey]: assignmentValue,
          },
        };
        current.probability += probability;
        Object.assign(current.assignments, cloneValue(outcome?.assignments || {}));
        groupedOutcomes.set(assignmentValue, current);
      });
      registerGroup({
        groupKey,
        effectInstanceIds: [String(entry?.effectInstanceId || '').trim()],
        probabilitySources: [{
          sourceType: 'PRIMARY_RESOLUTION',
          baseProbability: Number(
            evidence?.hitProbability ??
            evidence?.applicationProbability ??
            1
          ),
          finalProbability: Number(
            evidence?.hitProbability ??
            evidence?.applicationProbability ??
            1
          ),
          dependencyKeys: [],
        }],
        outcomes: [...groupedOutcomes.values()],
        retainDeterministicOutcome: true,
      });
    });
    (previewResult?.contributions || []).forEach((entry, index) => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      if (
        ![
          'STATE_CHANGED',
          'STATE_SCHEDULED',
          'ACTION_CANCELLED',
          'NEXT_ACTION_QUALITY_CHANGED',
          'RULE_CHANGED',
        ].includes(outcomeKind)
      ) {
        return;
      }
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const evidence = entry?.evidence || {};
      if (evidence.stateEndRisk || Number(evidence.deferredStartRoundOffset || 0) > 0) return;
      if (!effectInstanceId || !targetId || (evidence?.marginal === false && evidence.grantConsumption !== true && !evidence.persistentRiskBinding)) return;
      if (evidence.stateTransfer) {
        const transfer = evidence.stateTransfer;
        const recipients = transfer.targets.map(source => {
          if (!(source.applicationProbability > 1e-12)) return { targetId: source.targetId, conditions: [] };
          const group = resolveApplicationGroup({ source, effectInstanceId, probability: source.ownApplicationProbability,
            fallbackKey: `${rootActionId}|${effectInstanceId}|${source.targetId}|state`,
            successAssignments: { [`${effectInstanceId}|${source.targetId}`]: 'HIT' },
            failureAssignments: { [`${effectInstanceId}|${source.targetId}`]: 'RESISTED' } });
          const alternatives = source.requiredOutcomeAssignments?.length
            ? source.requiredOutcomeAssignments.filter(row => row.enabled !== false).map(row => row.conditionalOn || {})
            : source.requiredOutcomeKey ? (source.requiredOutcomeValues || ['HIT']).map(value => ({ [source.requiredOutcomeKey]: value })) : [{}];
          return { targetId: source.targetId, conditions: alternatives.map(condition => ({ ...condition, ...(group.groupKey ? { [group.groupKey]: group.successValue } : {}) })) };
        });
        registerEvent({ eventId: entry.eventId || entry.semanticKey || `${rootActionId}:${effectInstanceId}:state-transfer`, effectInstanceId,
          targetId, sourceActorId: transfer.actorId, operation: 'STATE_REPLACE',
          phasePriority: battleEventContract.phasePriority.RESOURCE_REDUCE, scheduledEffectSequence: index,
          payload: { stateTransfer: { effect: transfer.effect, actorId: transfer.actorId, targets: recipients,
            sourceActionId: transfer.sourceActionId, sourceEffectId: transfer.sourceEffectId, skillName: transfer.skillName } },
          dependencyKeys: [...new Set([transfer.actorId, ...recipients.map(row => row.targetId)])].map(id => `unit:${id}:state`),
        });
        return;
      }
      const applicationProbability = clamp(
        Number(evidence?.applicationProbability ?? 1),
        0,
        1,
      );
      if (applicationProbability <= 1e-12) return;
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const assignmentKey = `${effectInstanceId}|${targetId}`;
      const applicationGroup = resolveApplicationGroup({
        source: evidence,
        effectInstanceId,
        probability: ownApplicationProbability,
        fallbackKey: `${rootActionId}|${effectInstanceId}|${targetId}|state`,
        successAssignments: { [assignmentKey]: 'HIT' },
        failureAssignments: { [assignmentKey]: 'RESISTED' },
      });
      const groupKey = applicationGroup.groupKey;
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: applicationGroup.successValue } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      if (groupKey) {
        applicationGroupByEffectTarget.set(
          `${effectInstanceId}|${targetId}`,
          groupKey,
        );
      }
      applicationConditionsByEffectTarget.set(
        `${effectInstanceId}|${targetId}`,
        Object.freeze(applicationConditions),
      );
      const stateEffect =
        evidence?.projectedEffect &&
        typeof evidence.projectedEffect === 'object'
          ? cloneValue(evidence.projectedEffect)
          : {
              原型:
                String(evidence?.prototype || '状态施加').trim() ||
                '状态施加',
              状态: String(evidence?.state || '').trim(),
              判定: String(evidence?.check || '').trim(),
              结算: String(evidence?.settlement || '').trim(),
              ...(evidence?.prototype === '资源锁定' ? {
                资源: evidence?.combatEffect?.locked_resource,
                锁定类型: evidence?.lockType,
              } : {}),
              属性: String(evidence?.attribute || '').trim(),
              ...(evidence?.stateType ? { 类型: evidence.stateType } : {}),
              数值: evidence?.value ?? '',
              持续回合: Math.max(1, Number(evidence?.duration || 1)),
              战斗效果: cloneValue(
                evidence?.combatEffect ||
                evidence?.计算层效果 ||
                {},
              ),
            };
      const sideEffectStateEntry =
        evidence?.stateEntry &&
        typeof evidence.stateEntry === 'object' &&
        evidence?.stackMode === 'REPLACE'
          ? cloneValue(evidence.stateEntry)
          : null;
      if (sideEffectStateEntry && Object.hasOwn(sideEffectStateEntry, '__previewApplicationProbability')) {
        sideEffectStateEntry.__previewApplicationProbability = 1;
      }
      const stateName = String(
        evidence?.state ||
        sideEffectStateEntry?.状态 ||
        sideEffectStateEntry?.状态名称 ||
        '',
      ).trim();
      const stateKey = stateName || effectInstanceId;
      const stateRemoval = evidence.stateRemoval ? cloneValue(evidence.stateRemoval) : null;
      const endRiskProfiles = evidence.endRiskProfiles ? cloneValue(evidence.endRiskProfiles) : null;
      if (endRiskProfiles) for (const profile of endRiskProfiles) {
        profile.groupKey = registerGroup({ groupKey: `${profile.rootId}:trial`, effectInstanceIds: [effectInstanceId], probability: profile.probability });
      }
        registerEvent({
          eventId: String(
            entry?.eventId ||
            entry?.semanticKey ||
            `${rootActionId}:${effectInstanceId}:${targetId}:state:${index}`
          ).trim(),
          requiredOutcomeAssignments: evidence.requiredOutcomeAssignments,
          effectInstanceId,
          targetId,
          operation:
            evidence.stateRemoval ? 'STATE_REMOVE' : sideEffectStateEntry || outcomeKind === 'RULE_CHANGED'
              ? 'STATE_REPLACE'
              : 'STATE_APPLY',
          ...(evidence.grantConsumption ? { phasePriority: sideEffectPhasePriority - 1, scheduledEffectSequence: index }
            : evidence.persistentRiskBinding ? { phasePriority: sideEffectPhasePriority, scheduledEffectSequence: evidence.sideEffectIndex }
            : sideEffectStateEntry ? { phasePriority: sideEffectPhasePriority, scheduledEffectSequence: evidence.sideEffectSequence ?? evidence.sideEffectIndex }
            : evidence.stateRemoval ? { phasePriority: battleEventContract.phasePriority.RESOURCE_REDUCE, scheduledEffectSequence: index }
              : ['属性修正', '判定修正', '结算修正', '状态施加'].includes(stateEffect.原型) ? { phasePriority: battleEventContract.phasePriority.RESOURCE_REDUCE, scheduledEffectSequence: index } : {}),
          conditionalOn: Object.keys(applicationConditions).length
            ? applicationConditions
            : null,
          payload: { ...(endRiskProfiles ? { endRiskProfiles } : {}), ...(evidence.persistentRiskBinding ? { persistentRiskBinding: cloneValue(evidence.persistentRiskBinding) }
            : evidence.rewindSnapshot ? { rewindSnapshot: cloneValue(evidence.rewindSnapshot) } : evidence.stateEntries ? {
            stateEntries: cloneValue(evidence.stateEntries), ...(evidence.removedKeys?.length ? { removedStateKeys: [...evidence.removedKeys] } : {}),
          } : stateRemoval ? { stateRemoval } : evidence.durationChanges
            ? { durationChanges: evidence.durationChanges }
            : sideEffectStateEntry
            ? { stateEntries: { [stateKey]: sideEffectStateEntry }, sideEffectStateName: stateKey }
            : { effect: stateEffect }) },
          dependencyKeys: [`unit:${targetId}:state:${evidence.persistentRiskBinding?.stateKey || (sideEffectStateEntry ? stateKey : (stateEffect.状态 || effectInstanceId))}`],
        });
    });
    (previewResult?.contributions || []).forEach((entry, index) => {
      if (
        String(entry?.outcomeKind || '').trim().toUpperCase() !==
        'SHIELD_DELTA'
      ) {
        return;
      }
      const evidence = entry?.evidence || {};
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      if (evidence.stolenFrom) return;
      if (evidence.absorbedDamage !== undefined && replayedDamageEffects.has(effectInstanceId + '|' + targetId)) return;
      const shieldSettlement = evidence.shieldSettlement || null;
      const realizedDelta = Number(
        evidence?.realizedDelta ?? evidence?.delta ?? 0
      );
      if (
        !effectInstanceId ||
        !targetId ||
        !Number.isFinite(realizedDelta) ||
        (!shieldSettlement && Math.abs(realizedDelta) <= 1e-12)
      ) {
        return;
      }
      const applicationProbability = clamp(
        Number(evidence?.applicationProbability ?? 1),
        0,
        1,
      );
      if (applicationProbability <= 1e-12) return;
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const applicationGroup = resolveApplicationGroup({
        source: evidence,
        effectInstanceId,
        probability: ownApplicationProbability,
        fallbackKey: `${rootActionId}|${effectInstanceId}|${targetId}|shield`,
        successAssignments: { [`${effectInstanceId}|${targetId}`]: 'HIT' },
        failureAssignments: { [`${effectInstanceId}|${targetId}`]: 'MISS' },
      });
      const groupKey = applicationGroup.groupKey;
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: applicationGroup.successValue } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      registerEvent({
        eventId: String(
          entry?.eventId ||
          entry?.semanticKey ||
          `${rootActionId}:${effectInstanceId}:${targetId}:shield:${index}`
        ).trim(),
        effectInstanceId,
        targetId,
        operation: 'SHIELD_DELTA',
        phasePriority: battleEventContract.phasePriority.RESOURCE_REDUCE,
        scheduledEffectSequence: index,
        requiredOutcomeAssignments: evidence.requiredOutcomeAssignments,
        conditionalOn: Object.keys(applicationConditions).length
          ? applicationConditions
          : null,
        payload: {
          delta: realizedDelta,
          shieldSettlement,
          mode: String(evidence?.mode || '').trim(),
          stolenFrom: String(evidence?.stolenFrom || '').trim(),
          duration: Math.max(1, Number(evidence?.duration || 1)),
        },
        dependencyKeys: [`unit:${targetId}:shield`, ...(shieldSettlement?.receiverId ? [`unit:${shieldSettlement.receiverId}:shield`] : [])],
      });
    });
    (previewResult?.contributions || []).forEach((entry, index) => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const evidence = entry?.evidence || {};
      if (evidence.stateEndRisk) return;
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const eventId = String(
        entry?.eventId ||
        entry?.semanticKey ||
        `${rootActionId}:${effectInstanceId || index}:operation`
      ).trim();
      if (outcomeKind !== 'RESOURCE_OPTION_CHANGED' && !(outcomeKind === 'HP_DELTA' && (evidence.lethalSettlement || evidence.resourceChange))) return;
      if (evidence.rewind) return;
      if (evidence.transferRole === 'RECEIVER') return;
      const transfer = evidence.transferRole === 'SOURCE' ? {
        sourceId: String(evidence.transferSourceId || ''),
        receiverId: String(evidence.transferReceiverId || ''),
        requestedAmount: Number(evidence.requestedAmount || 0),
        conversionRatio: Number(evidence.conversionRatio ?? 1),
      } : null;
      const resource = String(evidence?.resource || '').trim();
      if (!resource || (/生命|HP/i.test(resource) && !evidence.transferRole && !evidence.lethalSettlement && !evidence.resourceChange)) return;
      const applicationProbability = clamp(
        Number(evidence?.applicationProbability ?? 1),
        0,
        1,
      );
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const realizedDelta = Number(
        evidence?.realizedDelta ??
        (
          applicationProbability > 1e-12
            ? Number(evidence?.delta || 0) / applicationProbability
            : 0
        ),
      );
      if (!Number.isFinite(realizedDelta) || (!transfer && !evidence.lethalSettlement && !evidence.resourceChange && Math.abs(realizedDelta) <= 1e-12)) {
        return;
      }
      const applicationGroup = resolveApplicationGroup({
        source: evidence,
        effectInstanceId,
        probability: ownApplicationProbability,
        fallbackKey: `${rootActionId}|${effectInstanceId}|${targetId}|resource`,
        successAssignments: { [`${effectInstanceId}|${targetId}`]: 'HIT' },
        failureAssignments: { [`${effectInstanceId}|${targetId}`]: 'MISS' },
      });
      const groupKey = applicationGroup.groupKey;
      if (applicationProbability <= 1e-12) return;
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: applicationGroup.successValue } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      registerEvent({
        eventId,
        effectInstanceId,
        targetId,
        operation:
          !transfer && realizedDelta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE',
        ...(evidence.lethalSettlement ? { phasePriority: sideEffectPhasePriority, scheduledEffectSequence: evidence.sideEffectSequence ?? evidence.sideEffectIndex }
          : evidence.resourceChange ? { phasePriority: battleEventContract.phasePriority.RESOURCE_REDUCE, scheduledEffectSequence: index } : {}),
        requiredOutcomeAssignments: evidence.requiredOutcomeAssignments,
        conditionalOn: Object.keys(applicationConditions).length
          ? applicationConditions
          : null,
        payload: {
          resource,
          delta: realizedDelta,
          current: Number(evidence?.current || 0),
          maximum: Number(evidence?.maximum || 0),
          mode: String(evidence?.mode || '').trim(),
          ...(transfer ? { transfer } : {}),
          ...(evidence.lethalSettlement ? { lethalSettlement: true } : {}),
          ...(evidence.resourceChange ? { resourceChange: evidence.resourceChange } : {}),
        },
        dependencyKeys: (transfer ? [transfer.sourceId, transfer.receiverId] : [targetId])
          .map(id => `unit:${id}:resource:${resource}`),
      });
    });
    resourceLockProfiles.forEach(profile => {
      if (profile.applicationProbability <= 1e-12) return;
      if (profile.lockType !== '资源池锁定' || profile.ratio < 1 - 1e-12) return;
      const effectTargetKey = [
        profile.effectInstanceId,
        profile.targetId,
      ].join('|');
      const groupKey =
        applicationGroupByEffectTarget.get(effectTargetKey) ||
        registerGroup({
          groupKey: [
            rootActionId,
            profile.effectInstanceId,
            profile.targetId,
            'resource-lock',
          ].join('|'),
          effectInstanceIds: [profile.effectInstanceId],
          probability: profile.applicationProbability,
          probabilitySources: [{
            sourceType: 'EFFECT_APPLICATION',
            baseProbability: profile.applicationProbability,
            finalProbability: profile.applicationProbability,
            dependencyKeys: [],
          }],
          successAssignments: {
            [effectTargetKey]: 'HIT',
          },
          failureAssignments: {
            [effectTargetKey]: 'RESISTED',
          },
          });
      const applicationConditions =
        applicationConditionsByEffectTarget.get(effectTargetKey) ||
        (groupKey ? { [groupKey]: 'SUCCESS' } : {});
        registerEvent({
          eventId: `${rootActionId}:${profile.effectInstanceId}:${profile.targetId}:resource-lock`,
          requiredOutcomeAssignments: profile.requiredOutcomeAssignments,
          effectInstanceId: profile.effectInstanceId,
          targetId: profile.targetId,
          operation: 'RESOURCE_LOCK',
          conditionalOn: Object.keys(applicationConditions).length
            ? applicationConditions
            : null,
          payload: {
            resource: profile.resource,
            duration: profile.duration,
            lockType: profile.lockType,
            ratio: profile.ratio,
          },
          dependencyKeys: [
            `unit:${profile.targetId}:resource:${profile.resource}`,
          ],
        });
    });
    (previewResult?.scheduledEvents || []).forEach((scheduled, index) => {
      if (String(scheduled?.type || '').trim().toUpperCase() !== 'SUMMON_CREATE') {
        return;
      }
      const effectInstanceId = String(scheduled?.effectInstanceId || '').trim();
      const applicationProbability = clamp(
        Number(scheduled?.applicationProbability ?? 1),
        0,
        1,
      );
      if (applicationProbability <= 1e-12) return;
      const requiredOutcomeKey = String(
        scheduled?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        scheduled?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          scheduled?.ownApplicationProbability ??
          (requiredOutcomeKey ? 1 : applicationProbability)
        ),
        0,
        1,
      );
      const applicationGroup = resolveApplicationGroup({
        source: scheduled,
        effectInstanceId,
        probability: ownApplicationProbability,
        fallbackKey: `${rootActionId}|${effectInstanceId}|summon`,
        successAssignments: Object.fromEntries(
          (scheduled?.summonDefinitions || []).map(summon => [
            `${effectInstanceId}|${unitId(summon)}`,
            'HIT',
          ]),
        ),
        failureAssignments: Object.fromEntries(
          (scheduled?.summonDefinitions || []).map(summon => [
            `${effectInstanceId}|${unitId(summon)}`,
            'MISS',
          ]),
        ),
      });
      const groupKey = applicationGroup.groupKey;
      const applicationConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(groupKey ? { [groupKey]: applicationGroup.successValue } : {}),
      };
      attachEffectToGroup(requiredOutcomeKey, effectInstanceId);
      (scheduled?.summonDefinitions || []).forEach((summon, summonIndex) => {
        const summonId = unitId(summon);
        const hostId = String(
          scheduled?.actorId || previewResult?.actorId || ''
        ).trim();
        const duration = Math.max(1, Number(scheduled?.duration || 1));
        const createRound = Math.max(0, Number(round || 0));
        registerEvent({
          eventId: `${rootActionId}:${effectInstanceId}:summon:${summonIndex + 1}`,
          effectInstanceId,
          sourceActorId: scheduled?.actorId || previewResult?.actorId,
          targetId: summonId,
          operation: 'SUMMON_CREATE',
          conditionalOn: Object.keys(applicationConditions).length
            ? applicationConditions
            : null,
          payload: {
            summon: cloneValue(summon),
            definitionHash: String(summon?.__definitionHash || '').trim(),
            hostId,
            duration,
            actionMode: String(scheduled?.actionMode || '').trim(),
          },
          dependencyKeys: [
            `unit:${hostId}:hp`,
          ],
        });
        registerEvent({
          eventId: `${rootActionId}:${effectInstanceId}:summon-window:${summonIndex + 1}`,
          effectInstanceId,
          sourceActorId: hostId,
          targetId: summonId,
          operation: 'SUMMON_WINDOW',
          conditionalOn: Object.keys(applicationConditions).length
            ? applicationConditions
            : null,
          payload: {
            instanceId: summonId,
            hostId,
            duration,
            actionMode: String(scheduled?.actionMode || '').trim(),
            deadlineRound: createRound + duration,
          },
          scheduledRound:
            createRound +
            (String(scheduled?.actionMode || '').trim() === '协同攻击' ? 0 : 1),
          scheduledOpportunitySequence: opportunitySequence + 1,
          dependencyKeys: [
            `unit:${hostId}:hp`,
            `schedule:${rootActionId}:${effectInstanceId}:summon-window:${summonIndex + 1}`,
          ],
        });
      });
    });
    deterministicEvents.sort(battleEventContract.compareBattleEventPosition);
    conditionalEvents.sort(battleEventContract.compareBattleEventPosition);
    const graphValue = {
      schemaVersion: '8.3-preview-operation-graph-1',
      ...(previewResult.continuedSettlement ? { continuedSettlement: true } : {}),
      actionFingerprint: String(
        input?.actionFingerprint ||
        previewResult?.cacheKey ||
        rootActionId
      ).trim(),
      deterministicEvents: Object.freeze(deterministicEvents),
      outcomeGroups: Object.freeze([...outcomeGroups.values()]),
      conditionalEvents: Object.freeze(conditionalEvents),
      dependencyReads: Object.freeze(
        cloneValue(previewResult?.dependencyReads || input?.dependencyReads || []),
      ),
    };
    return Object.freeze({
      ...graphValue,
      graphHash: stableHash(graphValue),
    });
  }

  function operationGraphMatches(conditionalOn, branchAssignments) {
    return !conditionalOn ||
      Object.entries(conditionalOn).every(([key, value]) =>
        String(branchAssignments?.[key] || '') === String(value || '')
      );
  }

  function operationGraphRequiredKeys(event) {
    const keys = Object.keys(event?.conditionalOn || {});
    if (!event?.payload?.stateTransfer && !event?.payload?.endRiskProfiles?.length) return keys;
    if (event?.payload?.stateTransfer) keys.push(...event.payload.stateTransfer.targets.flatMap(row => row.conditions.flatMap(condition => Object.keys(condition))));
    if (event?.payload?.endRiskProfiles) keys.push(...event.payload.endRiskProfiles.map(row => row.groupKey).filter(Boolean));
    return [...new Set(keys)];
  }

  function applyOperationGraphEvent(overlay, locks, opportunityState, event, assignments = {}) {
    const targetId = String(event?.targetId || '').trim();
    const payload = event?.payload || {};
    if (
      [
        'RESOURCE_RESTORE',
        'RESOURCE_REDUCE',
        'RESOURCE_REFUND',
        'NATURAL_RECOVERY',
        'SUSTAIN_COST',
        'RESOURCE_PAY',
      ].includes(event.operation)
    ) {
      const target = overlay.readUnit(targetId);
      if (!target) return false;
      const resource = String(payload?.resource || '').trim();
      if (payload.resourceChange?.targetEligibility === 'PHYSICALLY_ALIVE' && !isPhysicallyAlive(target) ||
          payload.resourceChange?.targetEligibility === 'BATTLE_CAPABLE' && !isBattleCapable(target)) return true;
      if (payload.damageOutcome) {
        overlay.changeUnit(targetId, unit => {
          applyProjectedShieldDelta(unit, -Math.max(0, payload.damageOutcome.shieldAbsorb), event.effectInstanceId);
          if (payload.damageOutcome.deathSaveConsumed > 0) consumeDeathSaveCharges(unit, payload.damageOutcome.deathSaveConsumed);
          if (payload.damageOutcome.ruleBlockConsumed > 0) consumeRuleBlockCharges(unit, payload.damageOutcome.ruleBlockConsumed);
          if (payload.damageOutcome.revival) applyDamageRevivalOutcomes(unit, [{ probability: 1, revival: payload.damageOutcome.revival }]);
          setResourceValue(unit, '生命', Math.max(0, readHp(unit) - Math.max(0, payload.damageOutcome.hpDamage) + Number(payload.damageOutcome.reviveHealing || 0)));
        });
        const reflection = payload.damageOutcome.reflection;
        if (reflection && overlay.readUnit(reflection.actorId)) overlay.changeUnit(reflection.actorId, unit => {
          if (reflection.revival) applyDamageRevivalOutcomes(unit, [{ probability: 1, revival: reflection.revival }]);
          setHp(unit, readHp(unit) - reflection.hpDamage + Number(reflection.reviveHealing || 0));
        });
        return true;
      }
      if (payload.lethalSettlement) {
        overlay.changeUnit(targetId, settlePreviewLethalSideEffect);
        return true;
      }
      if (payload.transfer) {
        const { sourceId, receiverId, requestedAmount, conversionRatio } = payload.transfer;
        const source = overlay.readUnit(sourceId), receiver = overlay.readUnit(receiverId);
        if (!source || !receiver || sourceId === receiverId) return false;
        const paid = Math.min(Math.max(0, requestedAmount), readResource(source, resource));
        const gain = Math.min(paid * conversionRatio, Math.max(0, readResourceMax(receiver, resource) - readResource(receiver, resource)));
        overlay.setResource(sourceId, resource, readResource(source, resource) - paid);
        overlay.setResource(receiverId, resource, readResource(receiver, resource) + gain);
        return true;
      }
      overlay.changeUnit(targetId, unit => {
        const current = readResource(unit, resource);
        const maximum = readResourceMax(unit, resource);
        let delta = payload.resourceChange
          ? parseSignedValue(payload.resourceChange.value, maximum)
          : Number(payload?.delta || 0);
        if (payload.resourceChange && delta > 0) delta *= Math.max(0, Number(healingMultiplierForUnit(unit, resource) ?? 1));
        setResourceValue(unit, resource, clamp(current + delta, 0, maximum));
      });
      return true;
    }
    if (event.operation === 'SHIELD_DELTA') {
      const target = overlay.readUnit(targetId);
      if (!target) return false;
      const settlement = payload.shieldSettlement;
      const current = readShield(target);
      const requested = settlement ? Math.abs(parseSignedValue(settlement.rawValue, settlement.mode === '正向护盾' ? readHpMax(target) : current)) : 0;
      const delta = settlement
        ? settlement.mode === '正向护盾' ? calculateShieldGain(target, requested) : -Math.min(current, Math.floor(requested))
        : Number(payload?.delta || 0);
      overlay.changeUnit(targetId, unit => {
        applyProjectedShieldDelta(unit, delta, event.effectInstanceId, Math.max(1, Number(payload?.duration || 1)));
      });
      if (settlement?.receiverId && delta < 0) {
        const receiver = overlay.readUnit(settlement.receiverId);
        if (receiver) overlay.changeUnit(settlement.receiverId, unit => {
          applyProjectedShieldDelta(unit, calculateShieldGain(receiver, -delta), `${event.effectInstanceId}:stolen:${targetId}`, Math.max(1, Number(payload?.duration || 1)));
        });
      }
      return true;
    }
    if (event.operation === 'RESOURCE_LOCK') {
      locks.add(`${targetId}\u0000${String(payload?.resource || '').trim()}`);
      return true;
    }
    if (event.operation === 'RESOURCE_UNLOCK') {
      locks.delete(`${targetId}\u0000${String(payload?.resource || '').trim()}`);
      return true;
    }
    if (
      ['STATE_APPLY', 'STATE_REFRESH', 'STATE_REPLACE', 'STATE_REMOVE'].includes(
        event.operation,
      )
    ) {
      const target = overlay.readUnit(targetId);
      if (!target) return false;
      if (payload.persistentRiskBinding) {
        const { stateKey, risk } = payload.persistentRiskBinding;
        const state = target.状态效果?.[stateKey];
        if (!state || (!Array.isArray(state.授予效果) && !state.持续原型效果)) return false;
        overlay.changeUnit(targetId, unit => {
          const grant = unit.状态效果[stateKey];
          grant.副作用列表 = [...(grant.副作用列表 || []), cloneValue(risk)];
        });
        return true;
      }
      if (payload.stateTransfer) {
        const transfer = payload.stateTransfer, actor = overlay.readUnit(transfer.actorId);
        if (!actor) return false;
        const targets = transfer.targets.map(row => overlay.readUnit(row.targetId)).filter(Boolean);
        const eligible = transfer.targets.filter(row => row.conditions.some(condition => operationGraphMatches(condition, assignments)))
          .map(row => overlay.readUnit(row.targetId)).filter(Boolean);
        return Boolean(transferProjectedStates(overlay, actor, targets, eligible, transfer.effect, {
          effectInstanceId: event.effectInstanceId, rootActionId: transfer.sourceActionId, worldSnapshot: overlay.snapshot(),
          declaration: { __structuredSourceActionId: transfer.sourceActionId, __structuredSourceEffectId: transfer.sourceEffectId, skill: { name: transfer.skillName } },
        }));
      }
      if (payload.rewindSnapshot) {
        overlay.writeUnit(cloneValue(payload.rewindSnapshot));
        return true;
      }
      if (payload.sideEffectStateName && sideEffectProtectionApplies(target, payload.sideEffectStateName)) return false;
      overlay.changeUnit(targetId, unit => {
        if (payload.sideEffectStateName) {
          replaceProjectedSideEffectState(unit, payload.sideEffectStateName, payload.stateEntries[payload.sideEffectStateName], Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0),
            (key, state) => applyProjectedEndRiskOutcomes(unit, [[key, state]], payload.endRiskProfiles, assignments));
          return;
        }
        if (payload.stateRemoval) {
          const removed = removeProjectedStates(unit, payload.stateRemoval, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0));
          const persistent = payload.stateRemoval.persistent;
          if (persistent) unit.状态效果 = { ...(unit.状态效果 || {}), [persistent.key]: cloneValue(persistent.state) };
          applyProjectedEndRiskOutcomes(unit, removed, payload.endRiskProfiles, assignments);
          return;
        }
        if (payload.durationChanges) {
          const changes = new Map(payload.durationChanges.map(change => [change.stateKey, change]));
          replaceStates(unit, stateEntries(unit).map(([key, state]) => [key, changes.has(key) ? {
            ...state,
            duration: Math.max(0, Number(state.duration ?? state.持续回合 ?? 0) + Number(changes.get(key).tickDelta || 0)),
          } : state]));
          return;
        }
        if (payload?.effect && typeof payload.effect === 'object') {
          const prototype = String(payload.effect.原型 || '').trim();
          if (prototype === '机制抹消') {
            const priorStates = stateEntries(unit);
            const suppression = applyMechanismSuppression(unit, payload.effect.抹消对象, payload.effect.持续回合, `preview:${event.effectInstanceId}:机制抹消`);
            if (suppression.removedKeys.length) unit.final = { ...unit.final, ...buildNumericCombatStats(unit, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0)) };
            applyProjectedEndRiskOutcomes(unit, priorStates.filter(([key]) => suppression.removedKeys.includes(key)), payload.endRiskProfiles, assignments);
            return;
          }
          if (prototype === '规则防御' || prototype === '规则改写') {
            applyProjectedRuleState(unit, payload.effect, prototype, { rootActionId: event.rootActionId, effectInstanceId: event.effectInstanceId });
            return;
          }
          if (
            String(payload.effect?.原型 || '').trim() === '属性修正'
          ) {
            const existing = findStateEntry(unit, payload.effect);
            addState(unit, payload.effect, String(event.effectInstanceId || event.eventId || ''));
            if (!existing) applyStatModifier(unit, payload.effect);
            return;
          }
          const replacedStates = [];
          addState(
            unit,
            {
              ...cloneValue(payload.effect),
              来源角色: unitName(
                overlay.readUnit(String(event?.sourceActorId || '').trim()) || {},
              ) || String(payload.effect?.来源角色 || '').trim(),
              __previewApplicationProbability: 1,
            },
            String(event?.effectInstanceId || event?.eventId || '').trim(),
            (key, state) => replacedStates.push([key, state]),
          );
          applyProjectedEndRiskOutcomes(unit, replacedStates, payload.endRiskProfiles, assignments);
          return;
        }
        const nextStates = { ...(unit?.状态效果 || {}) };
        const panelChanged = Object.entries(payload?.stateEntries || {}).some(([key, state]) =>
          ['面板修改比例', '面板固定修正'].some(field => Object.keys(state?.[field] || {}).length || Object.keys(nextStates[key]?.[field] || {}).length));
        (payload?.removedStateKeys || []).forEach(key => {
          delete nextStates[String(key || '').trim()];
        });
        Object.assign(nextStates, cloneValue(payload?.stateEntries || {}));
        unit.状态效果 = nextStates;
        if (panelChanged) unit.final = { ...unit.final, ...buildNumericCombatStats(unit, Number(overlay.baseWorld?.当前世界tick || overlay.baseWorld?.当前tick || 0)) };
      });
      return true;
    }
    if (event.operation === 'SUMMON_CREATE') {
      const hostId = String(
        payload?.hostId || event?.sourceActorId || ''
      ).trim();
      const host = overlay.readUnit(hostId);
      const hostControlled = host && stateEntries(host).some(([, state]) => {
        const effects = state?.战斗效果 || state?.计算层效果 || {};
        const name = stateName(state);
        return effects?.skip_turn === true ||
          effects?.cannot_act === true ||
          [
            '眩晕', '麻痹', '僵直', '束缚', '禁锢',
            '定身', '冻结', '冻结束缚', '星光停滞',
          ].includes(name);
      });
      if (!host || !isBattleCapable(host) || hostControlled) return false;
      const summon = cloneValue(payload?.summon || {});
      if (!unitId(summon)) return false;
      overlay.writeSummon(
        summon,
        String(payload?.definitionHash || summon?.__definitionHash || '').trim(),
      );
      return true;
    }
    if (event.operation === 'SUMMON_WINDOW') {
      const instanceId = String(payload?.instanceId || targetId).trim();
      const summon = overlay.readMapEntry('createdSummons', instanceId);
      const hostId = String(
        payload?.hostId || event?.sourceActorId || ''
      ).trim();
      const host = overlay.readUnit(hostId);
      const deadlineRound = Math.max(
        0,
        Number(payload?.deadlineRound ?? Number.MAX_SAFE_INTEGER),
      );
      if (
        !summon ||
        !host ||
        !isBattleCapable(host) ||
        Number(event?.round || 0) > deadlineRound
      ) {
        return false;
      }
      const snapshot = overlay.snapshot();
      const hostSide = sideOf(snapshot, host);
      const validTargetIds = listUnits(snapshot)
        .filter(entry =>
          entry.side !== hostSide &&
          isBattleCapable(entry.unit)
        )
        .map(entry => unitId(entry.unit))
        .filter(Boolean);
      if (!validTargetIds.length) return false;
      opportunityState.set(event.eventId, Object.freeze({
        opportunityId: event.eventId,
        ownerId: instanceId,
        role: 'ACTIVE',
        grantType: 'NATURAL_ACTION',
        validTargetIds: Object.freeze(validTargetIds),
        status: 'PENDING',
        createdAtSequence: Number(event?.opportunitySequence || 0),
        expiresAtSequence:
          Number(event?.opportunitySequence || 0) +
          Math.max(1, Number(payload?.duration || 1)),
      }));
      return true;
    }
    return false;
  }

  function operationGraphResourceRows(world, dependencyKeys = []) {
    const explicit = dependencyKeys
      .map(key => {
        const match = String(key || '').match(
          /^unit:([^:]+):resource:(.+)$/,
        );
        return match
          ? { unitId: match[1], resource: match[2] }
          : null;
      })
      .filter(Boolean);
    const rows = explicit.length
      ? explicit
      : listUnits(world).flatMap(entry =>
          ['魂力', '精神力', '体力'].map(resource => ({
            unitId: unitId(entry.unit),
            resource,
          }))
        );
    return rows
      .map(row => {
        const target = findUnit(world, row.unitId);
        return [
          row.unitId,
          row.resource,
          target ? readResource(target, row.resource) : null,
        ];
      })
      .sort(([leftUnit, leftResource], [rightUnit, rightResource]) =>
        String(leftUnit).localeCompare(String(rightUnit)) ||
        String(leftResource).localeCompare(String(rightResource))
      );
  }

  function operationGraphSufficientStateKey(
    state,
    projectionContract = {},
    pendingEvents = [],
    worldContentId,
  ) {
    const mergeKey = String(
      projectionContract?.mergeKey || 'FULL',
    ).trim().toUpperCase();
    const resources = operationGraphResourceRows(
      state.world,
      projectionContract?.dependencyKeys || [],
    );
    const resourceState = mergeKey === 'RESOURCE_ZERO_OR_NONZERO'
      ? resources.map(([unitIdValue, resource, value]) => [
          unitIdValue,
          resource,
          Number(value || 0) > 1e-12 ? 'NONZERO' : 'ZERO',
        ])
      : resources;
    const pendingAssignments = Object.fromEntries(
      pendingEvents.flatMap(event =>
        operationGraphRequiredKeys(event)
          .filter(key => Object.hasOwn(state.assignments, key))
          .map(key => [key, state.assignments[key]])
      ),
    );
    const retainedAssignments = Object.fromEntries(
      (projectionContract?.assignmentKeys || [])
        .map(value => String(value || '').trim())
        .filter(key => key && Object.hasOwn(state.assignments, key))
        .map(key => [key, state.assignments[key]]),
    );
    if (
      mergeKey === 'RESOURCE_ZERO_OR_NONZERO' ||
      mergeKey === 'EXACT_RESOURCE_BALANCE'
    ) {
      return stableHash({
        resourceState,
        locks: [...state.locks].sort(),
        pendingAssignments,
        retainedAssignments,
      });
    }
    return stableHash({
      world: worldContentId(state.world),
      locks: [...state.locks].sort(),
      opportunityState: [...state.opportunityState.entries()]
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
      pendingAssignments,
      retainedAssignments,
    });
  }

  function evaluateOperationGraph(input = {}) {
    const graph = input?.graph;
    const baseWorld = input?.baseState?.world || input?.baseWorld;
    if (
      !graph ||
      graph.schemaVersion !== '8.3-preview-operation-graph-1'
    ) {
      throw new Error('BATTLE_PREVIEW_OPERATION_GRAPH_INVALID');
    }
    if (!baseWorld || typeof baseWorld !== 'object') {
      throw new TypeError('BATTLE_PREVIEW_BRANCH_BASE_WORLD_MISSING');
    }
    metrics.operationGraphEvaluations += 1;
    const projectionContract = input?.projectionContract || {};
    const operationFilter = new Set(
      (projectionContract?.operations || [])
        .map(value => String(value || '').trim().toUpperCase())
        .filter(Boolean),
    );
    const includesEvent = event =>
      !operationFilter.size ||
      operationFilter.has(String(event?.operation || '').trim().toUpperCase()) ||
      (event?.payload?.transfer && operationFilter.has('RESOURCE_RESTORE'));
    const orderedEvents = [
      ...(graph.deterministicEvents || []),
      ...(graph.conditionalEvents || []),
    ]
      .filter(includesEvent)
      .sort(battleEventContract.compareBattleEventPosition);
    const referencedGroupKeys = new Set(
      orderedEvents.flatMap(operationGraphRequiredKeys),
    );
    const groups = (graph.outcomeGroups || [])
      .filter(group => referencedGroupKeys.has(String(group?.groupKey || '')))
      .sort((left, right) => {
        const firstEvent = group => orderedEvents.find(event =>
          Object.hasOwn(event?.conditionalOn || {}, String(group?.groupKey || '')) ||
          (event?.payload?.stateTransfer || event?.payload?.endRiskProfiles?.length) &&
            operationGraphRequiredKeys(event).includes(String(group?.groupKey || ''))
        );
        const position = battleEventContract.compareBattleEventPosition(
          firstEvent(left) || {},
          firstEvent(right) || {},
        );
        return position ||
          String(left?.groupKey || '').localeCompare(String(right?.groupKey || ''));
      });
    const maxActiveStates = Math.max(
      1,
      Math.floor(Number(input?.maxActiveStates || 64)),
    );
    const rawCartesianUpperBound = groups.reduce(
      (product, group) =>
        product * Math.max(1, group?.outcomes?.length || 1),
      1,
    );
    const contentIds = new Map();
    const objectContentIds = new WeakMap();
    const worldContentId = value => {
      const object = value && typeof value === 'object';
      if (objectContentIds.has(value)) return objectContentIds.get(value);
      let descriptor;
      if (Array.isArray(value)) {
        descriptor = 'array:' + JSON.stringify(Array.from({ length: value.length }, (_, index) =>
          value[index] === undefined ? null : worldContentId(value[index])));
      } else if (object) {
        descriptor = 'object:' + JSON.stringify(Object.keys(value).sort().map(key => [key, worldContentId(value[key])]));
      } else {
        descriptor = 'primitive:' + String(JSON.stringify(value));
      }
      let id = contentIds.get(descriptor);
      if (id === undefined) {
        id = contentIds.size;
        contentIds.set(descriptor, id);
      }
      if (object) objectContentIds.set(value, id);
      return id;
    };
    const initialOverlay = new PreviewOverlay(
      baseWorld,
      `${graph.graphHash}:factorized:initial`,
    );
    if (!graph.continuedSettlement) for (const { unit } of listUnits(baseWorld)) if (unit.__本阶段已触发复活) initialOverlay.changeUnit(unitId(unit), target => { delete target.__本阶段已触发复活; });
    const initialLocks = new Set(input?.baseState?.locks || []);
    const initialOpportunityState = new Map(
      input?.baseState?.opportunityState || [],
    );
    const initialAppliedEventIds = [];
    const initialSkippedEventIds = [];
    const initialConsumedEventIds = new Set();
    for (const event of orderedEvents) {
      if (event?.conditionalOn || (event?.payload?.stateTransfer || event?.payload?.endRiskProfiles?.length) && operationGraphRequiredKeys(event).length) break;
      initialConsumedEventIds.add(event.eventId);
      metrics.operationGraphEventApplications += 1;
      if (
        applyOperationGraphEvent(
          initialOverlay,
          initialLocks,
          initialOpportunityState,
          event,
        )
      ) {
        initialAppliedEventIds.push(event.eventId);
      } else {
        initialSkippedEventIds.push(event.eventId);
      }
    }
    let states = [{
      probability: 1,
      assignments: {},
      outcomeIds: {},
      world: initialOverlay.snapshot(),
      locks: initialLocks,
      opportunityState: initialOpportunityState,
      consumedEventIds: initialConsumedEventIds,
      appliedEventIds: initialAppliedEventIds,
      skippedEventIds: initialSkippedEventIds,
      mergedPathCount: 1,
    }];
    let peakActiveSufficientStates = states.length;
    let mergedEquivalentStateCount = 0;
    for (const group of groups) {
      battleEventContract.validateOutcomeGroup(group);
      const expanded = [];
      states.forEach((state, stateIndex) => {
        group.outcomes.forEach((outcome, outcomeIndex) => {
          const probability =
            Number(state.probability || 0) *
            Number(outcome.probability || 0);
          if (!(probability > 1e-15)) return;
          const assignments = {
            ...state.assignments,
            ...(outcome.assignments || {}),
          };
          const outcomeIds = {
            ...state.outcomeIds,
            [group.groupKey]: outcome.outcomeId,
          };
          const overlay = new PreviewOverlay(
            state.world,
            `${graph.graphHash}:factorized:${group.groupKey}:${stateIndex}:${outcomeIndex}`,
          );
          const locks = new Set(state.locks);
          const opportunityState = new Map(state.opportunityState);
          const consumedEventIds = new Set(state.consumedEventIds);
          const appliedEventIds = [...state.appliedEventIds];
          const skippedEventIds = [...state.skippedEventIds];
          for (const event of orderedEvents) {
            if (consumedEventIds.has(event.eventId)) continue;
            const requiredKeys = operationGraphRequiredKeys(event);
            if (!requiredKeys.every(key => Object.hasOwn(assignments, key))) {
              break;
            }
            consumedEventIds.add(event.eventId);
            if (!operationGraphMatches(event.conditionalOn, assignments)) {
              skippedEventIds.push(event.eventId);
              continue;
            }
            metrics.operationGraphEventApplications += 1;
            if (
              applyOperationGraphEvent(
                overlay,
                locks,
                opportunityState,
                event,
                assignments,
              )
            ) {
              appliedEventIds.push(event.eventId);
            } else {
              skippedEventIds.push(event.eventId);
            }
          }
          expanded.push({
            probability,
            assignments,
            outcomeIds,
            world: overlay.snapshot(),
            locks,
            opportunityState,
            consumedEventIds,
            appliedEventIds,
            skippedEventIds,
            mergedPathCount: state.mergedPathCount,
          });
          metrics.operationGraphStateExpansions += 1;
        });
      });
      const merged = new Map();
      expanded.forEach(state => {
        const pendingEvents = orderedEvents.filter(
          event => !state.consumedEventIds.has(event.eventId),
        );
        const key = operationGraphSufficientStateKey(
          state,
          projectionContract,
          pendingEvents,
          worldContentId,
        );
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, state);
          return;
        }
        existing.probability += state.probability;
        existing.mergedPathCount += state.mergedPathCount;
        existing.appliedEventIds = [
          ...new Set([...existing.appliedEventIds, ...state.appliedEventIds]),
        ].sort();
        existing.skippedEventIds = [
          ...new Set([...existing.skippedEventIds, ...state.skippedEventIds]),
        ].sort();
        mergedEquivalentStateCount += 1;
        metrics.operationGraphStateMerges += 1;
      });
      states = [...merged.values()];
      peakActiveSufficientStates = Math.max(
        peakActiveSufficientStates,
        states.length,
      );
      if (states.length > maxActiveStates) {
        throw new Error(
          `BATTLE_PREVIEW_PROBABILITY_BRANCH_BUDGET_EXCEEDED:${states.length}:${maxActiveStates}`,
        );
      }
    }
    const finalStates = states.map(state => Object.freeze({
      schemaVersion: '8.3-branch-state-1',
      probability: state.probability,
      assignments: Object.freeze({ ...state.assignments }),
      outcomeIds: Object.freeze({ ...state.outcomeIds }),
      world: state.world,
      balances: Object.freeze(Object.fromEntries(
        operationGraphResourceRows(state.world).map(
          ([unitIdValue, resource, value]) => [
            `${unitIdValue}\u0000${resource}`,
            value,
          ],
        ),
      )),
      locks: Object.freeze([...state.locks].sort()),
      opportunityState: Object.freeze(
        [...state.opportunityState.values()].map(Object.freeze),
      ),
      appliedEventIds: Object.freeze([...state.appliedEventIds]),
      skippedEventIds: Object.freeze([...state.skippedEventIds]),
      mergedPathCount: state.mergedPathCount,
    }));
    return Object.freeze({
      schemaVersion: '8.3-factorized-branch-result-1',
      rawCartesianUpperBound,
      primitiveOutcomeGroupCount: groups.length,
      peakActiveSufficientStates,
      mergedEquivalentStateCount,
      operationEventCount: orderedEvents.length,
      finalStates: Object.freeze(finalStates),
    });
  }

  function expandOperationGraphBranches(input = {}) {
    const graph = input?.graph;
    const baseWorld = input?.baseWorld;
    if (
      !graph ||
      graph.schemaVersion !== '8.3-preview-operation-graph-1'
    ) {
      throw new Error('BATTLE_PREVIEW_OPERATION_GRAPH_INVALID');
    }
    if (!baseWorld || typeof baseWorld !== 'object') {
      throw new TypeError('BATTLE_PREVIEW_BRANCH_BASE_WORLD_MISSING');
    }
    const maxBranches = Math.max(1, Number(input?.maxBranches || 64));
    let assignments = [{
      probability: 1,
      assignments: {},
      outcomeIds: {},
    }];
    (graph.outcomeGroups || []).forEach(group => {
      battleEventContract.validateOutcomeGroup(group);
      assignments = assignments.flatMap(branch =>
        group.outcomes.map(outcome => ({
          probability:
            Number(branch.probability || 0) *
            Number(outcome.probability || 0),
          assignments: {
            ...branch.assignments,
            ...(outcome.assignments || {}),
          },
          outcomeIds: {
            ...branch.outcomeIds,
            [group.groupKey]: outcome.outcomeId,
          },
        }))
      ).filter(branch => branch.probability > 1e-15);
      if (assignments.length > maxBranches) {
        throw new Error(
          `BATTLE_PREVIEW_PROBABILITY_BRANCH_BUDGET_EXCEEDED:${assignments.length}:${maxBranches}`,
        );
      }
    });
    const orderedEvents = [
      ...(graph.deterministicEvents || []),
      ...(graph.conditionalEvents || []),
    ].sort(battleEventContract.compareBattleEventPosition);
    return Object.freeze(assignments.map((branch, branchIndex) => {
      const overlay = new PreviewOverlay(
        baseWorld,
        `${graph.graphHash}:branch:${branchIndex}`,
      );
      if (!graph.continuedSettlement) for (const { unit } of listUnits(baseWorld)) if (unit.__本阶段已触发复活) overlay.changeUnit(unitId(unit), target => { delete target.__本阶段已触发复活; });
      const locks = new Set();
      const opportunityState = new Map();
      const appliedEventIds = [];
      const skippedEventIds = [];
      orderedEvents.forEach(event => {
        if (!operationGraphMatches(event.conditionalOn, branch.assignments)) {
          skippedEventIds.push(event.eventId);
          return;
        }
        if (
          applyOperationGraphEvent(
            overlay,
            locks,
            opportunityState,
            event,
            branch.assignments,
          )
        ) {
          appliedEventIds.push(event.eventId);
        } else {
          skippedEventIds.push(event.eventId);
        }
      });
      const world = overlay.snapshot();
      const balances = Object.fromEntries(
        listUnits(world).flatMap(entry => {
          const id = unitId(entry.unit);
          return ['魂力', '精神力', '体力'].map(resource => [
            `${id}\u0000${resource}`,
            readResource(entry.unit, resource),
          ]);
        }),
      );
      return Object.freeze({
        schemaVersion: '8.3-branch-state-1',
        probability: Number(branch.probability || 0),
        assignments: Object.freeze(cloneValue(branch.assignments)),
        outcomeIds: Object.freeze(cloneValue(branch.outcomeIds)),
        world,
        balances: Object.freeze(balances),
        locks: Object.freeze([...locks].sort()),
        opportunityState: Object.freeze(
          Object.fromEntries(opportunityState),
        ),
        summonState: Object.freeze(
          Object.fromEntries(
            [...overlay.mergedMap('createdSummons')].map(([id, summon]) => [
              id,
              cloneValue(summon),
            ]),
          ),
        ),
        consumedEventIds: Object.freeze(appliedEventIds),
        skippedEventIds: Object.freeze(skippedEventIds),
        consumedBehaviorKeys: Object.freeze([]),
        terminalResult: null,
        firstTerminalEventId: '',
      });
    }));
  }

  function buildLifecycleEventSet(previewResult = {}, input = {}) {
    const rootActionId = String(
      input?.rootActionId ||
      previewResult?.actionId ||
      previewResult?.cacheKey ||
      ''
    ).trim();
    const worldSnapshot =
      input?.worldSnapshot ||
      previewResult?.afterSnapshot ||
      {};
    const eventsById = new Map();
    const applicationGroups = new Map((previewResult.operationGraph?.outcomeGroups || []).map(group => [group.groupKey, group]));
    const register = (event, alternatives = null) => {
      if (alternatives) {
        alternatives.forEach((alternative, index) => {
          if (!alternative.enabled) return;
          register({ ...event, eventId: `${event.eventId}:condition:${index}`,
            conditionalOn: { ...(event.conditionalOn || {}), ...alternative.conditionalOn } });
        });
        return;
      }
      const eventId = String(event?.eventId || '').trim();
      if (!eventId) throw new Error('BATTLE_LIFECYCLE_EVENT_ID_MISSING');
      const normalized = Object.freeze({
        eventId,
        rootActionId: String(event?.rootActionId || rootActionId).trim(),
        effectInstanceId: String(event?.effectInstanceId || '').trim(),
        sourceActionId: String(event?.sourceActionId || rootActionId).trim(),
        targetId: String(event?.targetId || '').trim(),
        kind: String(event?.kind || '').trim().toUpperCase(),
        scheduledRound: Math.max(0, Number(event?.scheduledRound || 0)),
        opportunitySequence: Math.max(
          0,
          Number(event?.opportunitySequence || 0),
        ),
        actionSequence: Math.max(0, Number(event?.actionSequence || 0)),
        phasePriority: Math.max(
          0,
          Number(
            event?.phasePriority ??
            battleEventContract.phasePriority[
              String(event?.kind || '').trim().toUpperCase()
            ] ??
            50
          ),
        ),
        effectSequence: Math.max(0, Number(event?.effectSequence || 0)),
        probabilityGroupKey: String(
          event?.probabilityGroupKey || ''
        ).trim(),
        conditionalOn:
          event?.conditionalOn && typeof event.conditionalOn === 'object'
            ? Object.freeze(cloneValue(event.conditionalOn))
            : null,
        healthDeltaPP: Number(event?.healthDeltaPP || 0),
        resourceDelta:
          event?.resourceDelta && typeof event.resourceDelta === 'object'
            ? Object.freeze(cloneValue(event.resourceDelta))
            : null,
        stateDelta: event?.stateDelta && typeof event.stateDelta === 'object'
          ? Object.freeze(cloneValue(event.stateDelta))
          : null,
        consumed: event?.consumed === true,
      });
      const existing = eventsById.get(eventId);
      if (
        existing &&
        stableHash(existing) !== stableHash(normalized)
      ) {
        throw new Error(`BATTLE_LIFECYCLE_EVENT_CONFLICT:${eventId}`);
      }
      if (!existing) eventsById.set(eventId, normalized);
    };
    const targetBaseMaxHp = targetId => {
      const target = findUnit(worldSnapshot, targetId);
      return Math.max(1, target ? readHpMax(target) : 1);
    };
    (previewResult?.contributions || []).forEach((entry, index) => {
      const outcomeKind = String(entry?.outcomeKind || '').trim().toUpperCase();
      const evidence = entry?.evidence || {};
      const effectInstanceId = String(entry?.effectInstanceId || '').trim();
      const targetId = String(entry?.targetId || '').trim();
      const baseEventId = String(
        entry?.eventId ||
        entry?.semanticKey ||
        `${rootActionId}:${effectInstanceId || index}`
      ).trim();
      if (Number(evidence.applicationProbability ?? 1) <= 1e-12) return;
      const probabilityGroupKey = String(
        evidence?.distributionGroupKey ||
        evidence?.probabilityGroupKey ||
        ''
      ).trim();
      const requiredOutcomeKey = String(
        evidence?.requiredOutcomeKey || ''
      ).trim();
      const requiredOutcomeValue = String(
        evidence?.requiredOutcomeValues?.[0] || 'HIT'
      ).trim().toUpperCase();
      const ownApplicationProbability = clamp(
        Number(
          evidence?.ownApplicationProbability ??
          (requiredOutcomeKey
            ? 1
            : evidence?.applicationProbability ?? 1)
        ),
        0,
        1,
      );
      const explicitGroupKeys = [probabilityGroupKey, evidence.probabilityGroupKey].map(key => String(key || '').trim()).filter(Boolean);
      const ownProbabilityGroupKey = explicitGroupKeys.find(key => applicationGroups.has(key)) || explicitGroupKeys[0] ||
        `${previewResult.actionId || rootActionId}|${effectInstanceId}|${targetId}|${outcomeKind === 'RESOURCE_OPTION_CHANGED' ? 'resource' : 'state'}`;
      const ownOutcomeGroup = applicationGroups.get(ownProbabilityGroupKey);
      const successValue = ownOutcomeGroup?.outcomes?.map(outcome => outcome.assignments?.[ownProbabilityGroupKey])
        .find(value => value === 'HIT' || value === 'SUCCESS') || 'SUCCESS';
      const lifecycleConditions = {
        ...(requiredOutcomeKey
          ? { [requiredOutcomeKey]: requiredOutcomeValue }
          : {}),
        ...(
          ownApplicationProbability > 1e-12 &&
          ownApplicationProbability < 1 - 1e-12
            ? { [ownProbabilityGroupKey]: successValue }
            : {}
        ),
      };
      if (outcomeKind === 'RESOURCE_OPTION_CHANGED') {
        const resource = String(evidence?.resource || '').trim();
        const delta = Number(
          evidence?.realizedDelta ?? evidence?.delta ?? 0
        );
        if (resource && Number.isFinite(delta) && Math.abs(delta) > 1e-12) {
          register({
            eventId: baseEventId,
            effectInstanceId,
            sourceActionId: entry?.sourceActionId,
            targetId,
            kind: delta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE',
            scheduledRound: evidence?.scheduledRound || evidence?.round,
            opportunitySequence: evidence?.opportunitySequence,
            actionSequence: evidence?.actionSequence,
            phasePriority:
              battleEventContract.phasePriority[
                delta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE'
              ],
            effectSequence: evidence?.effectSequence || index,
            probabilityGroupKey:
              requiredOutcomeKey ||
              evidence?.probabilityGroupKey ||
              probabilityGroupKey,
            conditionalOn: Object.keys(lifecycleConditions).length
              ? lifecycleConditions
              : null,
            resourceDelta: {
              resource,
              delta,
              operation:
                delta >= 0 ? 'RESOURCE_RESTORE' : 'RESOURCE_REDUCE',
            },
          }, evidence.requiredOutcomeAssignments);
        }
        return;
      }
      if (outcomeKind === 'SCHEDULED_HP_DELTA') {
        const tickCount = Math.max(
          1,
          Math.floor(Number(evidence?.tickCount || evidence?.duration || 1)),
        );
        const delta = Number(evidence?.delta ?? entry?.expectedDelta ?? 0);
        for (let tickIndex = 0; tickIndex < tickCount; tickIndex += 1) {
          const perTickDelta = Array.isArray(evidence?.tickDeltas)
            ? Number(evidence.tickDeltas[tickIndex] || 0) : delta / tickCount;
          if (Math.abs(perTickDelta) <= 1e-12) continue;
          register({
            eventId: `${baseEventId}:tick:${tickIndex + 1}`,
            effectInstanceId,
            sourceActionId: entry?.sourceActionId,
            targetId,
            kind: perTickDelta < 0 ? 'DOT_TICK' : 'HOT_TICK',
            scheduledRound: Number(
              evidence?.scheduledRound ||
              evidence?.round ||
              (Array.isArray(evidence?.tickDeltas) ? worldSnapshot?.回合 : 0)
            ) + tickIndex,
            opportunitySequence: evidence?.opportunitySequence,
            actionSequence: evidence?.actionSequence,
            phasePriority:
              battleEventContract.phasePriority[
                perTickDelta < 0 ? 'DOT_TICK' : 'HOT_TICK'
              ],
            effectSequence: tickIndex,
            probabilityGroupKey,
            conditionalOn: Object.keys(lifecycleConditions).length ? lifecycleConditions : null,
            healthDeltaPP:
              100 * perTickDelta / targetBaseMaxHp(targetId),
          }, evidence.requiredOutcomeAssignments);
        }
        return;
      }
      if (['STATE_CHANGED', 'STATE_SCHEDULED'].includes(outcomeKind)) {
        const stackMode = String(
          evidence?.stackMode ||
          evidence?.overlapMode ||
          ''
        ).trim().toUpperCase();
        const removedKeys = Array.isArray(evidence?.removedKeys)
          ? evidence.removedKeys
          : [];
        const kind = removedKeys.length
          ? 'STATE_REMOVE'
          : stackMode === 'REFRESH'
            ? 'STATE_REFRESH'
            : stackMode === 'REPLACE'
              ? 'STATE_REPLACE'
              : 'STATE_APPLY';
        register({
          eventId: baseEventId,
          effectInstanceId,
          sourceActionId: entry?.sourceActionId,
          targetId,
          kind,
          scheduledRound: evidence?.scheduledRound || evidence?.round,
          opportunitySequence: evidence?.opportunitySequence,
          actionSequence: evidence?.actionSequence,
          phasePriority: battleEventContract.phasePriority[kind],
          effectSequence: index,
          probabilityGroupKey:
            requiredOutcomeKey || probabilityGroupKey,
          conditionalOn: Object.keys(lifecycleConditions).length
            ? lifecycleConditions
            : null,
          stateDelta: {
            stateKey: String(
              evidence?.stateKey ||
              evidence?.stateName ||
              ''
            ).trim(),
            removedKeys: [...removedKeys],
            stackMode,
          },
        }, evidence.requiredOutcomeAssignments);
        return;
      }
      if (outcomeKind === 'SUMMON_WINDOW') {
        register({
          eventId: baseEventId,
          effectInstanceId,
          sourceActionId: entry?.sourceActionId,
          targetId,
          kind: 'SUMMON_WINDOW',
          scheduledRound: evidence?.scheduledRound || evidence?.round,
          opportunitySequence: evidence?.opportunitySequence,
          actionSequence: evidence?.actionSequence,
          phasePriority: battleEventContract.phasePriority.SUMMON_WINDOW,
          effectSequence: index,
          probabilityGroupKey,
          conditionalOn: Object.keys(lifecycleConditions).length ? lifecycleConditions : null,
        }, evidence.requiredOutcomeAssignments);
      }
    });
    (previewResult?.scheduledEvents || []).forEach((event, index) => {
      const effectInstanceId = String(event?.effectInstanceId || '').trim();
      const eventType = String(
        event?.eventType ||
        event?.kind ||
        event?.outcomeKind ||
        ''
      ).trim().toUpperCase();
      let kind = '';
      if (/DOT|DAMAGE_TICK/.test(eventType)) kind = 'DOT_TICK';
      else if (/HOT|HEAL_TICK/.test(eventType)) kind = 'HOT_TICK';
      else if (/SUMMON.*EXPIRE/.test(eventType)) kind = 'SUMMON_EXPIRE';
      else if (/HOST.*INVALID/.test(eventType)) kind = 'HOST_INVALID';
      else if (/SUMMON/.test(eventType)) kind = 'SUMMON_WINDOW';
      else if (/REMOVE|DISPEL|EXPIRE/.test(eventType)) kind = 'STATE_REMOVE';
      else if (/REFRESH/.test(eventType)) kind = 'STATE_REFRESH';
      else if (/REPLACE/.test(eventType)) kind = 'STATE_REPLACE';
      else if (/STATE|STATUS/.test(eventType)) kind = 'STATE_APPLY';
      if (!kind) return;
      register({
        eventId: String(
          event?.eventId ||
          event?.descriptorId ||
          `${rootActionId}:${effectInstanceId || 'scheduled'}:${index}`
        ).trim(),
        effectInstanceId,
        sourceActionId: event?.sourceActionId || event?.sourceEventId,
        targetId: event?.targetId || event?.ownerId,
        kind,
        scheduledRound:
          event?.scheduledRound ||
          event?.round ||
          event?.createdAtRound,
        opportunitySequence:
          event?.opportunitySequence ||
          event?.creationSequence,
        actionSequence: event?.actionSequence,
        phasePriority:
          event?.phasePriority ||
          battleEventContract.phasePriority[kind],
        effectSequence: event?.effectSequence || index,
        probabilityGroupKey:
          event?.probabilityGroupKey ||
          event?.distributionGroupKey,
        healthDeltaPP: Number(event?.healthDeltaPP || 0),
        stateDelta: event?.stateDelta || null,
      });
    });
    const events = Object.freeze(
      [...eventsById.values()].sort((left, right) =>
        battleEventContract.compareBattleEventPosition(
          {
            ...left,
            round: left.scheduledRound,
          },
          {
            ...right,
            round: right.scheduledRound,
          },
        )
      ),
    );
    return Object.freeze({
      schemaVersion: '8.3-lifecycle-event-set-1',
      events,
      lifecycleHash: `lifecycle:${stableHash(events)}`,
    });
  }

  function calculateWithdrawalPressureDetails(unit = {}, opponent = {}, stance = 'WITHDRAW') {
    const captureActive = !!activePreviewDependencyCapture;
    let unitProfile = captureActive
      ? null
      : withdrawalPressureUnitProfileCache.get(unit);
    if (!unitProfile) {
      const agilityBreakdown = readCombatStatBreakdown(unit, 'agi');
      const agility = agilityBreakdown.value;
      const spirit = readResource(unit, '精神力');
      const spiritMax = readResourceMax(unit, '精神力');
      const stamina = readResource(unit, '体力');
      const staminaMax = readResourceMax(unit, '体力');
      const spiritRatio = clamp(spirit / Math.max(1, spiritMax), 0, 1);
      const staminaRatio = clamp(stamina / Math.max(1, staminaMax), 0, 1);
      const stateEffects = stateEntries(unit, 'WITHDRAWAL').map(([stateKey, state]) => ({
        source: stateName(state) || String(stateKey || '状态效果').trim(),
        effect: state?.战斗效果 || {},
      }));
      const effectContributions = [];
      const dodgeModifier = stateEffects.reduce((sum, entry) => {
        const value = Number(entry.effect?.dodge_bonus || 0) * 100 - Number(entry.effect?.dodge_penalty || 0) * 100;
        if (value) effectContributions.push({ kind: 'add', value, source: `${entry.source}·闪避修正` });
        return sum + value;
      }, 0);
      const reactionModifier = stateEffects.reduce((sum, entry) => {
        const value = Number(entry.effect?.reaction_bonus || 0) * 80 - Number(entry.effect?.reaction_penalty || 0) * 80;
        if (value) effectContributions.push({ kind: 'add', value, source: `${entry.source}·反应修正` });
        return sum + value;
      }, 0);
      const hardControlSource = stateEffects.find(entry => entry.effect?.skip_turn === true || entry.effect?.cannot_react === true);
      const hardControlPenalty = hardControlSource ? 999999 : 0;
      if (hardControlSource) effectContributions.push({ kind: 'subtract', value: hardControlPenalty, source: `${hardControlSource.source}·无法反应` });
      const base = agility * 0.72 + spirit * 0.012 + spiritMax * 0.025;
      const conditionFactor = 0.35 + spiritRatio * 0.4 + staminaRatio * 0.25;
      unitProfile = {
        agilityBreakdown,
        agility,
        spirit,
        spiritMax,
        stamina,
        staminaMax,
        spiritRatio,
        staminaRatio,
        dodgeModifier,
        reactionModifier,
        hardControlPenalty,
        effectContributions,
        base,
        conditionFactor,
      };
      if (!captureActive) withdrawalPressureUnitProfileCache.set(unit, unitProfile);
    }
    const {
      agilityBreakdown,
      agility,
      spirit,
      spiritMax,
      stamina,
      staminaMax,
      spiritRatio,
      staminaRatio,
      dodgeModifier,
      reactionModifier,
      hardControlPenalty,
      effectContributions,
      base,
      conditionFactor,
    } = unitProfile;
    const opposingSpirit = readResource(opponent, '精神力');
    const resourcePressure = clamp(
      Math.pow(Math.max(0.01, spirit / Math.max(1, opposingSpirit)), 0.35) * (0.45 + 0.55 * spiritRatio),
      0.35,
      1.65,
    );
    const stanceMultiplier = stance === 'PURSUIT' ? 1.08 : 1;
    const value = Math.max(0, base * conditionFactor * resourcePressure * stanceMultiplier + dodgeModifier + reactionModifier - hardControlPenalty);
    return Object.freeze({
      value,
      stance,
      agility: agilityBreakdown,
      spirit,
      spiritMax,
      stamina,
      staminaMax,
      opposingSpirit,
      spiritRatio,
      staminaRatio,
      base,
      conditionFactor,
      resourcePressure,
      stanceMultiplier,
      effectContributions: Object.freeze(effectContributions.map(item => Object.freeze({ ...item }))),
    });
  }

  function calculateWithdrawalPressure(unit = {}, opponent = {}, stance = 'WITHDRAW') {
    return calculateWithdrawalPressureDetails(unit, opponent, stance).value;
  }

  function estimateWithdrawal(actor = {}, pursuer = {}) {
    const withdrawalScore = calculateWithdrawalPressure(actor, pursuer, 'WITHDRAW');
    const pursuitScore = calculateWithdrawalPressure(pursuer, actor, 'PURSUIT');
    const ratio = withdrawalScore / Math.max(1, pursuitScore);
    const successProbability = ratio >= 1.18 ? 1 : clamp((ratio - 0.72) * 0.55, 0.03, 0.92);
    const partialThreshold = ratio >= 0.9 ? 1 : Math.max(successProbability, Math.min(0.96, successProbability + 0.24));
    const partialProbability = Math.max(0, partialThreshold - successProbability);
    const failureProbability = Math.max(0, 1 - successProbability - partialProbability);
    const hpMax = readHpMax(actor);
    const currentHp = readHp(actor);
    const partialPursuitDamage = Math.min(
      currentHp,
      Math.round(hpMax * 0.04),
    );
    const failurePursuitDamage = Math.min(
      currentHp,
      Math.round(hpMax * 0.08),
    );
    return Object.freeze({
      withdrawalScore,
      pursuitScore,
      ratio,
      successProbability,
      partialProbability,
      failureProbability,
      partialPursuitDamage,
      failurePursuitDamage,
      expectedPursuitDamage:
        partialProbability * partialPursuitDamage +
        failureProbability * failurePursuitDamage,
    });
  }

  function buildWithdrawalContest(worldSnapshot = {}, actor = {}) {
    const actorId = unitId(actor);
    const actorSide = sideOf(worldSnapshot, actor);
    const visiblePursuers = listUnits(worldSnapshot)
      .filter(entry =>
        entry?.unit &&
        isBattleCapable(entry.unit) &&
        unitId(entry.unit) !== actorId &&
        entry.side !== actorSide
      )
      .sort((left, right) => {
        const pressureDelta =
          calculateWithdrawalPressure(
            right.unit,
            actor,
            'PURSUIT',
          ) -
          calculateWithdrawalPressure(
            left.unit,
            actor,
            'PURSUIT',
          );
        return Math.abs(pressureDelta) > 1e-9
          ? pressureDelta
          : unitId(left.unit).localeCompare(unitId(right.unit));
      });
    const visiblePursuerIds = Object.freeze(
      visiblePursuers
        .map(entry => unitId(entry.unit))
        .filter(Boolean),
    );
    visiblePursuerIds.forEach(pursuerId =>
      recordPreviewDependency(
        `opportunity:${actorId}:withdrawal:pursuer:${pursuerId}`,
        true,
      )
    );
    recordPreviewDependency(
      `opportunity:${actorId}:withdrawal:visible-pursuers`,
      visiblePursuerIds,
    );
    const pursuer = visiblePursuers[0]?.unit || null;
    if (!pursuer) {
      const probabilityGroupKey = `withdrawal:${stableHash({
        actorId,
        visiblePursuerIds,
        outcome: 'SUCCESS',
      })}`;
      return Object.freeze({
        pursuerId: '',
        visiblePursuerIds,
        probabilityGroupKey,
        withdrawalScore: 0,
        pursuitScore: 0,
        ratio: Number.POSITIVE_INFINITY,
        successProbability: 1,
        partialProbability: 0,
        failureProbability: 0,
        partialPursuitDamage: 0,
        failurePursuitDamage: 0,
        expectedPursuitDamage: 0,
        outcomeDistribution: Object.freeze([
          Object.freeze({
            branchKey: 'SUCCESS',
            outcome: 'SUCCESS',
            probability: 1,
            withdrawalSuccess: true,
            pursuitDamage: 0,
            delta: 0,
            hpDamage: 0,
            conditionalOn: Object.freeze({
              [probabilityGroupKey]: 'SUCCESS',
            }),
            assignments: Object.freeze({
              [probabilityGroupKey]: 'SUCCESS',
            }),
          }),
        ]),
      });
    }
    const estimate = estimateWithdrawal(actor, pursuer);
    const probabilityGroupKey = `withdrawal:${stableHash({
      actorId,
      pursuerId: unitId(pursuer),
      visiblePursuerIds,
      successProbability: estimate.successProbability,
      partialProbability: estimate.partialProbability,
      failureProbability: estimate.failureProbability,
      partialPursuitDamage: estimate.partialPursuitDamage,
      failurePursuitDamage: estimate.failurePursuitDamage,
    })}`;
    const branch = (branchKey, probability, withdrawalSuccess, pursuitDamage) =>
      Object.freeze({
        branchKey,
        outcome: branchKey,
        probability,
        withdrawalSuccess,
        pursuitDamage,
        delta: -pursuitDamage,
        hpDamage: pursuitDamage,
        conditionalOn: Object.freeze({
          [probabilityGroupKey]: branchKey,
        }),
        assignments: Object.freeze({
          [probabilityGroupKey]: branchKey,
        }),
      });
    return Object.freeze({
      pursuerId: unitId(pursuer),
      visiblePursuerIds,
      probabilityGroupKey,
      ...estimate,
      outcomeDistribution: Object.freeze([
        ...(estimate.successProbability > 1e-12
          ? [branch(
              'SUCCESS',
              estimate.successProbability,
              true,
              0,
            )]
          : []),
        ...(estimate.partialProbability > 1e-12
          ? [branch(
              'PARTIAL',
              estimate.partialProbability,
              false,
              estimate.partialPursuitDamage,
            )]
          : []),
        ...(estimate.failureProbability > 1e-12
          ? [branch(
              'FAILURE',
              estimate.failureProbability,
              false,
              estimate.failurePursuitDamage,
            )]
          : []),
      ]),
    });
  }

  function calculateReactionContest(reactor = {}, sourceActor = {}) {
    const reactionDetails = calculateWithdrawalPressureDetails(reactor, sourceActor, 'WITHDRAW');
    const attackDetails = calculateWithdrawalPressureDetails(sourceActor, reactor, 'PURSUIT');
    const reactionPressure = reactionDetails.value;
    const attackPressure = attackDetails.value;
    const share = reactionPressure / Math.max(1, reactionPressure + attackPressure);
    return Object.freeze({
      probability: clamp(0.18 + (share - 0.5) * 1.1, 0.03, 0.78),
      reactionPressure,
      attackPressure,
      share,
      reactionAgility: reactionDetails.agility.value,
      sourceAgility: attackDetails.agility.value,
      reactionPressureBreakdown: reactionDetails,
      attackPressureBreakdown: attackDetails,
      reactionAgilityBreakdown: reactionDetails.agility,
      sourceAgilityBreakdown: attackDetails.agility,
    });
  }

  function calculateDefenseDamageMultiplier(reactor = {}, sourceActor = {}, prepared = false) {
    const defense = Math.max(1, readCombatStat(reactor, 'def'));
    const attack = Math.max(1, readCombatStat(sourceActor, 'str'));
    const staminaRatio = readResource(reactor, '体力') / Math.max(1, readResourceMax(reactor, '体力'));
    const ordinary = clamp(
      0.78 -
      Math.min(0.2, defense / (defense + attack) * 0.24) -
      Math.min(0.08, staminaRatio * 0.08),
      0.45,
      0.82,
    );
    return prepared ? Math.max(0.35, ordinary * 0.8) : ordinary;
  }

  function calculateDodgeProbability(reactor = {}, sourceActor = {}, prepared = false) {
    const ordinary = calculateReactionContest(reactor, sourceActor).probability;
    return prepared ? clamp(ordinary + (1 - ordinary) * 0.25, 0.03, 0.92) : ordinary;
  }

  function clearCache() {
    previewCache.clear();
    builtDamageBasisCache = new WeakSet();
    validatedDamageBasisCache = new WeakSet();
    normalizedObjectivesCache = new WeakMap();
    withdrawalPressureUnitProfileCache = new WeakMap();
    passiveSkillCollectionCache = new WeakMap();
    collectedEffectsCache = new WeakMap();
    metrics.cacheClears += 1;
  }

  function readMetrics(options = {}) {
    if (options.resetPeaks === true) {
      metrics.maxNodesObserved = 0;
      metrics.resourceOutcomeBranchMaxStates = 0;
    }
    return Object.freeze({ ...metrics, cacheSize: previewCache.size });
  }

  const api = Object.freeze({
    version: VERSION,
    outcomeComponents,
    battlePrototypes: Object.freeze([...battlePrototypes]),
    nonBattlePrototypes: Object.freeze([...nonBattlePrototypes]),
    PreviewOverlay,
    transferProjectedStates,
    replaceProjectedSideEffectState,
    settlePreviewLethalSideEffect,
    stateEndRisks,
    operationGraphRequiredKeys,
    ContributionLedger,
    stableHash,
    summonInstanceId,
    unitId,
    unitName,
    listUnits,
    findUnit,
    findInventoryEntry,
    creationProductIdentity,
    itemConsumesOnUse,
    overlayOriginUnit,
    inheritOverlayOrigin,
    sideOf,
    isAlive,
    isDead,
    isPhysicallyAlive,
    isBattleCapable,
    isSummonUnit,
    shouldTriggerTraumaUnconscious,
    naturalActionOrderProfile,
    compareNaturalActionOrder,
    readIncapacityReason,
    evaluateObjectiveConditionDetail,
    readHp,
    readHpMax,
    readShield,
    calculateShieldGain,
    absorbPreviewShield,
    readResource,
    readResourceMax,
    setResourceValue,
    skillCostResourceKey,
    normalizeSkillCostPhase,
    normalizeSkillCostMap,
    readSkillCostStages,
    readSkillStartupCosts,
    readSkillSustainCosts,
    assessResourcePayment,
    formatSkillCostPhase,
    formatSkillCostStages,
    staminaScaleForUnit,
    refreshStaminaAdjustedFinal,
    readCombatStat,
    readCombatStatBreakdown,
    dependencyValueForKey,
    parseSignedValue,
    sideEffectStatusMap,
    normalizeSideEffectList,
    buildSideEffectPayload,
    calculateDefensePenetration,
    calculateDamageTargetCoverage,
    calculateSettledSegmentDamage,
    normalizeEffectProbability,
    estimateHitProbabilityAttribution,
    effectTargetsAllies,
    resolveTargets,
    conditionMatches,
    collectEffects,
    effectArrayHash,
    declarationCounterGrantProfile,
    declarationGrantsCounter,
    fusionSkillMetadata,
    resolveFusionAction,
    effectConditionEnabled,
    resolveConditionalEffectPlan,
    calculateDamageFormula,
    buildDamageBasis,
    assertDamageBasis,
    damageBasisMetadata,
    calculateBaseDamage,
    estimateHitProbability,
    expectedSegmentedDamageOutcome,
    calculateBaseActionValue,
    calculateDirectPotential,
    calculateAtomicActionPotential,
    calculateSequencePotential,
    calculateUnitCapacity,
    calculateTwoOpportunityCapacity,
    calculateWithdrawalPressure,
    calculateWithdrawalPressureDetails,
    estimateWithdrawal,
    buildWithdrawalContest,
    calculateReactionContest,
    calculateDefenseDamageMultiplier,
    calculateDodgeProbability,
    compileMechanicalBasis,
    compileMechanicalProjectionContext,
    deriveMechanicalProjectionContext,
    mechanicalProjectionProfile,
    evaluateMechanicalBasis,
    evaluateMechanicalBasisRouteScalarColumns,
    deriveStateCombatEffect,
    statePolarity,
    conditionMatchesFilter,
    stateApplicationProbabilityMultiplier,
    buildNumericCombatStats,
    findRuleSuppression,
    triggerStateRevive,
    deathSaveCount,
    consumeDeathSaveCharges,
    ruleBlockCount,
    consumeRuleBlockCharges,
    triggerRevive,
    passiveRevivalBudget,
    counterDamageRatio,
    hasDamageRevival,
    applyDamageRevivalOutcomes,
    refreshSustainRuntimeLoad,
    clearC2FoodMaintenanceRuntime,
    isPassiveSkill,
    collectPassiveSkills,
    passiveTriggerProfile,
    passiveApplicationKey,
    buildPassiveConsumerEvidence,
    markPassiveApplication,
    buildEffectPlanningEvidence,
    materializePassiveEffects,
    skillMatchesLimitedElements,
    applySkillSettlementModifiers,
    healingMultiplierForUnit,
    healingMultiplierDetails,
    unitIsLiving,
    effectMatchesMechanismMatcher,
    applyMechanismSuppression,
    actorSuppressesEffect,
    pendingGrantedEffects,
    consumeGrantedStateUses,
    normalizeBattleObjectives,
    buildObjectiveUnitIndex,
    evaluateBattleObjectives,
    evaluateBattleObjectivesCompact,
    calculateNonlethalHpFloor,
    sampleSignedValue,
    sampleSignedValueExpression,
    assessWorldAction,
    bindWorldActionContext,
    clearWorldActionContext,
    previewAction,
    buildActionOperationGraph,
    evaluateOperationGraph,
    expandOperationGraphBranches,
    buildLifecycleEventSet,
    clearCache,
    readMetrics,
  });

  root.__LWCS_BATTLE_PREVIEW__ = api;
})();

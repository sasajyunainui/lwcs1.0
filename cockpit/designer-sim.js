/*
 * 技能设计台「对抗试算」独立移植版（UI 原型用）
 * 来源：lwcs/mvu_logic_bridge.js 23516-24157（试算核心）及其调用链；
 *       基础属性曲线来自 lwcs/MVU_Skill_Runtime.js 191-248 / 2166-2214；
 *       原型注册表摘要来自 MVU_Skill_Runtime.js SKILL_PROTOTYPE_REGISTRY_V1。
 * 用法：window.LWCS_DESIGNER_SIM.simulate(draft, character[, options])
 *   draft     MVU 技能对象（魂技名/承载方式/消耗/_效果数组…），或设计台表单草稿（含 prototypeEffects）
 *   character MVU 角色对象（含 属性:{等级,力量,防御,…}）
 *   options   { name?: 角色名 }
 * 返回结构化数据，不生成 HTML。
 */
(function () {
  'use strict';

  // ===== 基础工具（bridge 2037-2075 / 2526 / 2902-2915 / 4702 / 17301-17311 / 18390-18405）=====
  function hasUiPlaceholderToken(value) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    return !!text && /待补全|待生成|未知|未详|不详/i.test(text);
  }

  function toText(value, fallback = '无') {
    if (value === undefined || value === null || value === '') return fallback;
    const text = String(value);
    return hasUiPlaceholderToken(text) ? fallback : text;
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('zh-CN').format(toNumber(value, 0));
  }

  function deepGet(source, path, fallback) {
    if (!source || !path) return fallback;
    const keys = Array.isArray(path) ? path : String(path).split('.');
    let current = source;
    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) return fallback;
      current = current[key];
    }
    return current === undefined ? fallback : current;
  }

  function safeEntries(obj) {
    return obj && typeof obj === 'object' ? Object.entries(obj) : [];
  }

  function cloneJsonValue(value, fallback = {}) {
    try {
      return structuredClone(value);
    } catch (error) {}
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {}
    return fallback;
  }

  function normalizeSkillUiText(value, fallback = '未知') {
    const text = toText(value, '')
      .replace(/\[续台推演\]\s*/g, '')
      .trim();
    if (!text || text === '无' || text === '未生成' || hasUiPlaceholderToken(text)) return fallback;
    return text;
  }

  function normalizeSkillDesignerArray(value) {
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map(item => toText(item, '').trim()).filter(Boolean)));
    }
    if (typeof value === 'string') {
      return Array.from(
        new Set(
          value
            .split(/[、,，/｜|]+/)
            .map(item => toText(item, '').trim())
            .filter(Boolean),
        ),
      );
    }
    return [];
  }

  // ===== 目标规范化（bridge 17604-17605 / 18619-18633 / 26625-26662）=====
  const SKILL_DESIGNER_TARGET_OPTIONS = Object.freeze(['自身', '单体', '群体', '全场', '召唤物']);
  const SKILL_DESIGNER_CLONE_TARGET_OPTIONS = Object.freeze([...SKILL_DESIGNER_TARGET_OPTIONS, '分身']);

  function normalizeSkillDesignerEffectTargetValue(value = '', fallback = '单体') {
    const text = normalizeSkillUiText(value, '');
    if (SKILL_DESIGNER_CLONE_TARGET_OPTIONS.includes(text)) return text;
    if (['友方单体', '友方群体', '敌方单体', '敌方群体', '己方/单体', '己方/群体', '敌方/单体', '敌方/群体'].includes(text))
      return SKILL_DESIGNER_CLONE_TARGET_OPTIONS.includes(fallback) ? fallback : '单体';
    if (/全场敌方|敌方全场|全体敌|所有敌|全部敌/.test(text)) return '群体';
    if (/分身/.test(text)) return '分身';
    if (/召唤物|召唤/.test(text)) return '召唤物';
    if (/自身|施术者/.test(text)) return '自身';
    if (/全场/.test(text)) return '全场';
    if (/群体|全员|范围/.test(text)) return '群体';
    if (/单体|目标/.test(text)) return '单体';
    return SKILL_DESIGNER_CLONE_TARGET_OPTIONS.includes(fallback) ? fallback : '单体';
  }

  const 技能设计台分身目标允许原型集合 = new Set(['资源变化', '属性修正', '判定修正', '结算修正']);

  function 约束技能设计台分身目标(原型 = '', 目标 = '') {
    const 当前目标 = normalizeSkillDesignerEffectTargetValue(目标, '单体');
    return 当前目标 === '分身' && !技能设计台分身目标允许原型集合.has(normalizeSkillUiText(原型, '')) ? '单体' : 当前目标;
  }

  function 技能设计台效果是正向辅助(原型 = '', effect = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 数值 = 解析技能设计台正负数值(effect && effect['数值']);
    if (['属性修正', '资源变化', '资源转移', '判定修正', '资源锁定', '决策干扰'].includes(原型名)) return 数值 > 0;
    if (原型名 === '护盾变化') return normalizeSkillUiText(effect && effect['护盾模式'], '') === '正向护盾' || 数值 > 0;
    if (原型名 === '结算修正') {
      const 结算 = normalizeSkillUiText(effect && effect['结算'], '');
      if (['治疗', '技能效果', '伤害转治疗'].includes(结算)) return 数值 > 0;
      if (结算 === '受到伤害') return 数值 < 0;
      return ['伤害分摊', '消耗分摊', '伤害吸收'].includes(结算);
    }
    if (原型名 === '状态施加') return ['持续恢复', '护盾', '隐匿', '共享视野', '无视异常', '霸体', '护卫'].includes(normalizeSkillUiText(effect && effect['状态'], ''));
    return false;
  }

  // 时光回溯/分摊结算的专用目标规范化未移植（与试算无关），直接沿用通用目标
  function 约束技能设计台原型正式目标(原型 = '', 目标 = '', fallbackTarget = '单体', 效果 = null) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 默认目标 = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    const 当前目标 = 约束技能设计台分身目标(原型名, normalizeSkillDesignerEffectTargetValue(目标, 默认目标));
    const 状态名 = 原型名 === '状态施加' ? normalizeSkillUiText(效果 && 效果['状态'], '') : '';
    if (原型名 === '状态施加' && 状态名 === '护卫') return ['单体', '群体', '全场'].includes(当前目标) ? 当前目标 : '单体';
    if (原型名 === '战斗外复活') return ['单体', '群体', '全场'].includes(当前目标) ? 当前目标 : '单体';
    if (['状态转移', '状态交换'].includes(原型名)) return '单体';
    if (原型名 === '状态移除') return ['自身', '单体', '群体'].includes(当前目标) ? 当前目标 : '单体';
    if (原型名 === '规则防御') return ['自身', '单体', '群体'].includes(当前目标) ? 当前目标 : '自身';
    if (['召唤生成', '炸环'].includes(原型名)) return '自身';
    if (['伤害结算', '资源转移'].includes(原型名) && !['单体', '群体', '全场'].includes(当前目标)) return '单体';
    if (原型名 === '修炼增益' && 当前目标 === '召唤物') return 默认目标 === '自身' ? '自身' : '单体';
    if (当前目标 === '全场' && 技能设计台效果是正向辅助(原型名, 效果 || {})) return '群体';
    return 当前目标;
  }

  // ===== 数值解析（bridge 18644-18661 / 20128-20135 / 28366-28417）=====
  function formatSkillDesignerSignedValue(value, asPercent = true) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return asPercent ? '+0%' : '+0';
    const digits = Math.abs((asPercent ? num * 100 : num) % 1) < 0.0001 ? 0 : 2;
    const text = String(Number((asPercent ? num * 100 : num).toFixed(digits)));
    return `${num >= 0 ? '+' : ''}${text}${asPercent ? '%' : ''}`;
  }

  function parseSkillDesignerSignedValue(value) {
    const text = normalizeSkillUiText(value, '');
    if (!text) return 0;
    if (/%$/.test(text)) {
      const parsed = Number(text.replace('%', ''));
      return Number.isFinite(parsed) ? parsed / 100 : 0;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function 解析技能设计台正负数值(数值) {
    if (typeof 数值 === 'number') return Number.isFinite(数值) ? 数值 : 0;
    const 文本 = normalizeSkillUiText(数值, '');
    const 匹配 = 文本.match(/^([+-]?)(\d+(?:\.\d+)?)(%)?$/);
    if (!匹配) return 0;
    const 符号 = 匹配[1] === '-' ? -1 : 1;
    return 符号 * (Number(匹配[2]) || 0);
  }

  function parseSkillDesignerNumericInputValue(value, fallback = 0, digits = 4) {
    const rawText = toText(value, '').trim();
    if (!rawText) return Number(Number(fallback || 0).toFixed(digits));
    const match = rawText.match(/-?\d+(?:\.\d+)?/);
    const parsed = Number(match ? match[0] : rawText);
    if (!Number.isFinite(parsed)) return Number(Number(fallback || 0).toFixed(digits));
    return Number(parsed.toFixed(digits));
  }

  function parseSkillDesignerIntegerInputValue(value, fallback = 0, minimum = 0) {
    const parsed = Math.round(parseSkillDesignerNumericInputValue(value, fallback, 0));
    if (!Number.isFinite(parsed)) return Math.max(minimum, Math.round(Number(fallback || 0)));
    return Math.max(minimum, parsed);
  }

  function parseSkillDesignerPercentRatio(value, fallback = 0) {
    const rawText = toText(value, '').trim();
    if (!rawText) return Number(Number(fallback || 0).toFixed(4));
    const parsed = parseSkillDesignerNumericInputValue(rawText, fallback, 4);
    if (!Number.isFinite(parsed)) return Number(Number(fallback || 0).toFixed(4));
    if (/%/.test(rawText) || parsed > 1) return Number((parsed / 100).toFixed(4));
    return Number(parsed.toFixed(4));
  }

  function parseSkillDesignerFactorInputValue(value, fallback = 1, options = {}) {
    const rawText = toText(value, '').trim();
    const plusBase = !!(options && options.plusBase);
    if (!rawText) return Number(Number(fallback || 0).toFixed(4));
    const parsed = parseSkillDesignerNumericInputValue(rawText, fallback, 4);
    if (!Number.isFinite(parsed)) return Number(Number(fallback || 0).toFixed(4));
    if (/%/.test(rawText)) {
      const ratio = parsed / 100;
      return Number((plusBase ? 1 + ratio : ratio).toFixed(4));
    }
    if (plusBase && parsed >= 0 && parsed <= 1) return Number((1 + parsed).toFixed(4));
    return Number(parsed.toFixed(4));
  }

  function 规范化技能设计台伤害威力倍率(value, fallback = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(1, Number(fallback || 100));
    return Math.max(1, Math.round(parsed));
  }

  // ===== 伤害类型（bridge 19233-19253）=====
  const 技能设计台伤害类型选项 = Object.freeze(['近身攻击', '远程攻击', '精神攻击', '真实攻击']);

  function 规范化技能设计台伤害类型(value = '', draft = {}) {
    const text = normalizeSkillUiText(value, '');
    if (技能设计台伤害类型选项.includes(text)) return text;
    const merged = `${text} ${normalizeSkillUiText(draft?.type, '')} ${normalizeSkillUiText(draft?.deliveryForm, '')} ${normalizeSkillUiText(draft?.name || draft?.魂技名 || draft?.技能名称, '')} ${normalizeSkillUiText(draft?.description || draft?.效果描述, '')}`;
    if (/真实|规则|法则|无视|穿透本源|毁灭|时光/.test(merged)) return '真实攻击';
    if (/精神|识海|幻境|灵魂|眩晕|混乱|封技|恐惧/.test(merged)) return '精神攻击';
    if (/远程|射线|光束|飞刃|投掷|炮|波|箭|弹|雷|电|冰|火|光|暗|星|空间|元素|爆炸/.test(merged)) return '远程攻击';
    return '近身攻击';
  }

  function 读取技能设计台伤害绑定(伤害类型 = '', draft = {}) {
    const type = 规范化技能设计台伤害类型(伤害类型, draft);
    return {
      伤害类型: type,
      结算标签: type === '真实攻击' ? '真实伤害' : '标准伤害',
      抗性类型: type === '真实攻击' ? '真实无视' : type === '精神攻击' ? '精神抗性' : type === '远程攻击' ? '元素抗性' : '物理抗性',
    };
  }

  // ===== 属性标签映射（bridge 28319-28335 / 28556-28559）=====
  const SKILL_DESIGNER_RUNTIME_PROPERTY_KEY_BY_LABEL = Object.freeze({
    力量: 'str',
    防御: 'def',
    敏捷: 'agi',
    体力上限: 'vit_max',
    魂力上限: 'sp_max',
    精神力上限: 'men_max',
    体力: 'vit',
    魂力: 'sp',
    精神力: 'men',
    掌控: '掌控',
    威力: '威力',
    消耗: '消耗',
    前摇: '前摇',
    控制: '控制',
    速度: '速度',
  });

  function resolveSkillDesignerPropertyKeyByLabel(label = '') {
    const normalized = normalizeSkillUiText(label, '');
    return SKILL_DESIGNER_RUNTIME_PROPERTY_KEY_BY_LABEL[normalized] || normalized;
  }

  // ===== 基础属性曲线（MVU_Skill_Runtime.js 191-248 / 2166-2214）=====
  const 魂力上限曲线锚点_V1 = Object.freeze([
    { 等级: 1, 魂力上限: 100 },
    { 等级: 10, 魂力上限: 800 },
    { 等级: 20, 魂力上限: 2000 },
    { 等级: 30, 魂力上限: 4500 },
    { 等级: 40, 魂力上限: 8500 },
    { 等级: 50, 魂力上限: 15000 },
    { 等级: 60, 魂力上限: 26000 },
    { 等级: 70, 魂力上限: 55000 },
    { 等级: 80, 魂力上限: 95000 },
    { 等级: 90, 魂力上限: 180000 },
    { 等级: 95, 魂力上限: 360000 },
  ]);

  function 平滑插值比例_V1(比例 = 0) {
    const 安全比例 = Math.max(0, Math.min(1, Number(比例) || 0));
    return 安全比例 * 安全比例 * (3 - 2 * 安全比例);
  }

  function 计算魂力曲线值_V1(等级值 = 1) {
    const 等级 = Math.max(1, Math.min(180, Number(等级值) || 1));
    const 最后锚点 = 魂力上限曲线锚点_V1[魂力上限曲线锚点_V1.length - 1];
    if (等级 >= 最后锚点.等级 && 等级 <= 99) {
      return 最后锚点.魂力上限 * Math.pow(2, 等级 - 最后锚点.等级);
    }
    if (等级 > 99 && 等级 <= 99.5) {
      return 最后锚点.魂力上限 * 16 * Math.pow(2, (等级 - 99) / 0.5);
    }
    if (等级 > 99.5 && 等级 <= 100) {
      return 最后锚点.魂力上限 * 32 * Math.pow(2, (等级 - 99.5) / 0.5);
    }
    if (等级 > 100) {
      return 最后锚点.魂力上限 * 64 * Math.pow(10, (等级 - 100) / 10);
    }
    for (let 序号 = 0; 序号 < 魂力上限曲线锚点_V1.length - 1; 序号 += 1) {
      const 起点 = 魂力上限曲线锚点_V1[序号];
      const 终点 = 魂力上限曲线锚点_V1[序号 + 1];
      if (等级 >= 起点.等级 && 等级 <= 终点.等级) {
        const 比例 = 平滑插值比例_V1((等级 - 起点.等级) / (终点.等级 - 起点.等级));
        return 起点.魂力上限 + (终点.魂力上限 - 起点.魂力上限) * 比例;
      }
    }
    return 魂力上限曲线锚点_V1[0].魂力上限;
  }

  function getBaseStats(lv) {
    const 等级值 = Math.max(1, Math.min(180, Number(lv) || 1));
    const 百级后 = 百级基值 => 百级基值 * Math.pow(10, (等级值 - 100) / 10);
    const 魂力上限 = 计算魂力曲线值_V1(等级值);
    let 力量 = 10;
    if (等级值 <= 29) 力量 = 10 + ((900 - 10) / 28) * (等级值 - 1);
    else if (等级值 === 30) 力量 = 1200;
    else if (等级值 <= 69) 力量 = 1300 + ((4200 - 1300) / 38) * (等级值 - 31);
    else if (等级值 === 70) 力量 = 7000;
    else if (等级值 <= 89) 力量 = 7200 + ((8600 - 7200) / 18) * (等级值 - 71);
    else if (等级值 === 90) 力量 = 9000;
    else if (等级值 <= 94) 力量 = 9250 + ((10000 - 9250) / 3) * (等级值 - 91);
    else if (等级值 <= 99.5) 力量 = 10000 * Math.pow(1.5, 等级值 - 94);
    else if (等级值 <= 100) 力量 = 10000 * Math.pow(1.5, 99.5 - 94) * 2;
    else 力量 = 百级后(10000 * Math.pow(1.5, 99.5 - 94) * 2);

    let 精神力上限 = 等级值;
    if (等级值 <= 10) 精神力上限 = 8 + ((27 - 8) / 9) * (等级值 - 1);
    else if (等级值 <= 20) 精神力上限 = 27 + ((30 - 27) / 10) * (等级值 - 10);
    else if (等级值 <= 21) 精神力上限 = 32;
    else if (等级值 <= 30) 精神力上限 = 32 + ((160 - 32) / 9) * (等级值 - 21);
    else if (等级值 <= 40) 精神力上限 = 160 + ((800 - 160) / 10) * (等级值 - 30);
    else if (等级值 <= 50) 精神力上限 = 800 + ((850 - 800) / 10) * (等级值 - 40);
    else if (等级值 <= 60) 精神力上限 = 850 + ((900 - 850) / 10) * (等级值 - 50);
    else if (等级值 <= 70) 精神力上限 = 900 + ((950 - 900) / 10) * (等级值 - 60);
    else if (等级值 <= 80) 精神力上限 = 950 + ((1050 - 950) / 10) * (等级值 - 70);
    else if (等级值 <= 90) 精神力上限 = 1050 + ((2300 - 1050) / 10) * (等级值 - 80);
    else if (等级值 < 98) 精神力上限 = 2300 + ((3750 - 2300) / 8) * (等级值 - 90);
    else if (等级值 === 98) 精神力上限 = 3750;
    else if (等级值 === 99) 精神力上限 = 4200;
    else if (等级值 === 99.5) 精神力上限 = 6500;
    else if (等级值 <= 100) 精神力上限 = 15000;
    else 精神力上限 = 百级后(15000);

    return {
      sp_max: Math.floor(魂力上限),
      men_max: Math.floor(精神力上限),
      str: Math.floor(力量),
      def: Math.floor(力量),
      agi: Math.floor(力量 / 2),
      vit_max: Math.floor(力量),
    };
  }

  // 原版从宿主窗口读取 MVU 基础属性函数；宿主已加载时优先使用，否则用内联副本
  function 读取窗口函数(键名) {
    const root = typeof window !== 'undefined' ? window : globalThis;
    const 函数值 = root && root[键名];
    if (typeof 函数值 === 'function') return 函数值.bind(root);
    if (键名 === '__LWCS_GET_BASE_STATS__') return getBaseStats;
    return null;
  }

  // ===== 消耗解析（bridge 17872-17873 / 24929-25029 / 25097-25124）=====
  const SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS = Object.freeze(['无', '魂力', '精神力', '体力', '混合']);
  const SKILL_DESIGNER_COST_RESOURCE_KEYS = Object.freeze(['魂力', '精神力', '体力']);

  function parseSkillDesignerCostAmount(value = '') {
    const text = normalizeSkillUiText(value, '');
    if (!text || text === '无') return '';
    if (!/^\d+(?:\.\d+)?%?$/.test(text)) return null;
    return /%$/.test(text) ? text : Number(text);
  }

  function normalizeSkillDesignerCostValues(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = {};
    SKILL_DESIGNER_COST_RESOURCE_KEYS.forEach(key => {
      const amount = parseSkillDesignerCostAmount(source[key]);
      if (amount !== null && amount !== '') result[key] = amount;
    });
    return result;
  }

  function 格式化技能设计台消耗片段(消耗值 = {}) {
    const 数值表 = normalizeSkillDesignerCostValues(消耗值);
    return SKILL_DESIGNER_COST_RESOURCE_KEYS.filter(key => 数值表[key] !== undefined)
      .map(key => `${key}:${数值表[key]}`)
      .join(' | ');
  }

  function 解析技能设计台消耗文本配置(rawCost = '') {
    const 结果 = { resourceType: '无', resourceValues: {}, resourceValue: '', sustainText: '' };
    if (rawCost === undefined || rawCost === null) return 结果;
    if (rawCost && typeof rawCost === 'object' && !Array.isArray(rawCost)) {
      if (rawCost['启动'] || rawCost['维持']) {
        const 启动数值 = normalizeSkillDesignerCostValues(rawCost['启动']);
        const 启动条目 = safeEntries(启动数值);
        结果.sustainText = 格式化技能设计台消耗片段(rawCost['维持']);
        if (!启动条目.length) return 结果;
        if (启动条目.length === 1) {
          结果.resourceType = 启动条目[0][0];
          结果.resourceValues = 启动数值;
          结果.resourceValue = 启动条目[0][1];
          return 结果;
        }
        结果.resourceType = '混合';
        结果.resourceValues = 启动数值;
        return 结果;
      }
      const 数值表 = normalizeSkillDesignerCostValues(rawCost);
      const 条目 = safeEntries(数值表);
      if (!条目.length) return 结果;
      if (条目.length === 1) {
        结果.resourceType = 条目[0][0];
        结果.resourceValues = 数值表;
        结果.resourceValue = 条目[0][1];
        return 结果;
      }
      结果.resourceType = '混合';
      结果.resourceValues = 数值表;
      return 结果;
    }
    const 原始文本 = normalizeSkillUiText(rawCost, '');
    if (!原始文本 || 原始文本 === '无') return 结果;
    const 文本分段 = 原始文本.split(/维持[:：]?/);
    const 启动文本 = normalizeSkillUiText(文本分段[0], '');
    结果.sustainText = normalizeSkillUiText(文本分段.slice(1).join('维持:'), '');
    const 匹配结果 = 启动文本.matchAll(
      /(魂力|体力|精神力)\s*[:：]\s*([^|+＋]+?)(?=\s*(?:魂力|体力|精神力)\s*[:：]|[|+＋]|$)/g,
    );
    const 数值表 = {};
    Array.from(匹配结果).forEach(匹配 => {
      const 资源名 = normalizeSkillUiText(匹配[1], '');
      const 数值 = parseSkillDesignerCostAmount(normalizeSkillUiText(匹配[2], ''));
      if (!资源名 || 数值 === null || 数值 === '') return;
      数值表[资源名] = 数值;
    });
    const 条目 = safeEntries(数值表);
    if (!条目.length) return 结果;
    if (条目.length === 1) {
      结果.resourceType = 条目[0][0];
      结果.resourceValues = 数值表;
      结果.resourceValue = 条目[0][1];
      return 结果;
    }
    结果.resourceType = '混合';
    结果.resourceValues = 数值表;
    return 结果;
  }

  function parseSkillDesignerCostConfig(rawCost = '', explicitType = '', explicitValues = {}) {
    const explicitResourceType = normalizeSkillUiText(explicitType, '');
    if (explicitResourceType) {
      const values = normalizeSkillDesignerCostValues(explicitValues);
      const 文本配置 = 解析技能设计台消耗文本配置(rawCost);
      return {
        resourceType: SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS.includes(explicitResourceType) ? explicitResourceType : '混合',
        resourceValues: values,
        resourceValue: values[explicitResourceType] !== undefined ? values[explicitResourceType] : '',
        sustainText: 文本配置.sustainText || '',
      };
    }
    return 解析技能设计台消耗文本配置(rawCost);
  }

  function buildSkillDesignerCostObject(resourceType = '', resourceValues = {}) {
    const safeType = normalizeSkillUiText(resourceType, '无') || '无';
    if (safeType === '无') return {};
    const source =
      resourceValues && typeof resourceValues === 'object' && !Array.isArray(resourceValues) ? resourceValues : {};
    const values = normalizeSkillDesignerCostValues(source);
    if (safeType === '混合') return values;
    if (!['魂力', '精神力', '体力'].includes(safeType)) return {};
    const amount = parseSkillDesignerCostAmount(values[safeType]);
    if (amount === null || amount === '') return {};
    return { [safeType]: amount };
  }

  // ===== 原型注册表摘要（MVU_Skill_Runtime.js SKILL_PROTOTYPE_REGISTRY_V1，仅保留试算所需）=====
  const 原型类别表 = Object.freeze({
    伤害结算: '战斗结算', 资源变化: '战斗结算', 资源转移: '战斗结算', 护盾变化: '战斗结算', 属性修正: '战斗结算',
    判定修正: '战斗结算', 结算修正: '战斗结算', 炸环: '战斗结算', 状态施加: '战斗结算', 时窗修正: '战斗结算',
    状态移除: '战斗结算', 规则防御: '战斗结算', 状态转移: '战斗结算', 状态交换: '战斗结算', 资源锁定: '战斗结算',
    规则改写: '战斗结算', 机制抹消: '战斗结算', 机制授予: '战斗结算', 复制执行: '战斗结算', 时光回溯: '战斗结算',
    位移执行: '行为推导', 决策干扰: '行为推导', 修炼增益: '战斗外', 天赋提升: '战斗外', 永久属性提升: '战斗外',
    魂骨年限提升: '战斗外', 战斗外复活: '战斗外', 等级提升: '战斗外', 群体撤离: '战斗外', 召唤生成: '战斗结算',
  });

  // 试算相关原型：必填字段默认值 + 筛选后保留的字段（允许字段 ∩ 设计台显示字段，见 bridge 25919-25998）
  const 试算原型定义表 = Object.freeze({
    伤害结算: { 默认值: { 威力倍率: 100, 伤害类型: '近身攻击' }, 字段: ['威力倍率', '伤害类型', '攻击段数', '防御穿透', '生效方式', '条件分支'] },
    结算修正: { 默认值: { 结算: '造成伤害', 数值: '+10%' }, 字段: ['结算', '数值', '持续回合', '生效方式', '条件分支'] },
    护盾变化: { 默认值: { 护盾模式: '正向护盾', 数值: '+10%' }, 字段: ['护盾模式', '数值', '持续回合', '生效方式', '条件分支'] },
    规则防御: { 默认值: { 规则: '免伤', 次数: 1 }, 字段: ['规则', '次数', '持续回合', '生效方式', '条件分支'] },
    状态施加: { 默认值: { 状态: '眩晕' }, 字段: ['状态', '持续回合', '生效方式', '条件分支'] },
    属性修正: { 默认值: { 属性: '力量', 数值: '+10%' }, 字段: ['属性', '数值', '持续回合', '生效方式', '条件分支'] },
    炸环: { 默认值: { 强化倍率: '+100%' }, 字段: ['强化倍率', '生效方式', '条件分支'] },
  });

  function 限制技能设计台护盾变化数值(字段 = {}) {
    if (!字段 || typeof 字段 !== 'object' || 字段['数值'] === undefined) return;
    const 模式 = normalizeSkillUiText(字段['护盾模式'], '正向护盾');
    const 文本 = normalizeSkillUiText(字段['数值'], '');
    const 匹配 = 文本.match(/^[+-]?(\d+(?:\.\d+)?)(%)?$/);
    if (匹配) {
      const 符号 = 模式 === '正向护盾' ? '+' : '-';
      const 数值 = Math.abs(Number(匹配[1]) || 0);
      const 精度 = Math.abs(数值 % 1) < 0.0001 ? 0 : 2;
      字段['数值'] = `${符号}${Number(数值.toFixed(精度))}${匹配[2] ? '%' : ''}`;
      return;
    }
    const 数值 = Math.abs(解析技能设计台正负数值(字段['数值']));
    if (数值 > 0) 字段['数值'] = `${模式 === '正向护盾' ? '+' : '-'}${数值}`;
  }

  // 合并 筛选技能设计台显式原型效果列表(26881) + 技能设计台原型需要落盘(26937)
  // + 技能设计台清理并水合原型效果(26686) + 清理技能设计台行为闭环字段(20427) 中与试算有关的部分
  function 规范化试算原型效果(entry = {}, fallbackTarget = '单体', warnings = []) {
    const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
    const prototype = normalizeSkillUiText(source['原型'], '');
    if (!prototype) return null;
    if (!原型类别表[prototype]) {
      warnings.push(`「${prototype}」不是可识别的效果原型，这条效果不计入试算`);
      return null;
    }
    if (原型类别表[prototype] === '战斗外' && !['修炼增益', '战斗外复活', '召唤生成'].includes(prototype)) return null;
    const 定义 = 试算原型定义表[prototype];
    const next = { 原型: prototype };
    if (定义) {
      Object.assign(next, cloneJsonValue(定义.默认值));
      定义.字段.forEach(key => {
        const raw = source[key];
        if (raw === undefined || raw === null) return;
        if (typeof raw === 'string' && !raw.trim()) return;
        next[key] = cloneJsonValue(raw);
      });
    } else {
      // 与试算数值无关的原型：保留原字段，仅供技能分类推断
      safeEntries(source).forEach(([key, raw]) => {
        if (key === '原型' || raw === undefined || raw === null) return;
        if (typeof raw === 'string' && !raw.trim()) return;
        next[key] = cloneJsonValue(raw);
      });
    }
    next['目标'] = 约束技能设计台原型正式目标(
      prototype,
      normalizeSkillDesignerEffectTargetValue(source['目标'], fallbackTarget),
      fallbackTarget,
      next,
    );
    if (prototype === '伤害结算') {
      next['攻击段数'] = Math.max(1, parseSkillDesignerIntegerInputValue(next['攻击段数'], 1, 1));
      next['威力倍率'] = 规范化技能设计台伤害威力倍率(next['威力倍率'], 100);
      // 运行态水合不带 draft 上下文，伤害类型只按自身文本归一
      const 伤害绑定 = 读取技能设计台伤害绑定(next['伤害类型'], {});
      next['伤害类型'] = 伤害绑定.伤害类型;
      next['结算标签'] = 伤害绑定.结算标签;
      next['抗性类型'] = 伤害绑定.抗性类型;
      delete next['持续回合'];
    }
    if (prototype === '护盾变化') {
      if (!['正向护盾', '斩盾', '窃盾'].includes(normalizeSkillUiText(next['护盾模式'], '')))
        next['护盾模式'] = 解析技能设计台正负数值(next['数值']) < 0 ? '斩盾' : '正向护盾';
      限制技能设计台护盾变化数值(next);
    }
    if (prototype === '状态施加') next['状态'] = normalizeSkillUiText(next['状态'], '眩晕');
    if (prototype === '属性修正') {
      const 合法属性 = ['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限'];
      if (Array.isArray(next['属性'])) {
        const 属性列表 = next['属性'].map(item => normalizeSkillUiText(item, '')).filter(item => 合法属性.includes(item));
        next['属性'] = 属性列表.length > 1 ? Array.from(new Set(属性列表)) : 属性列表[0] || '力量';
      } else {
        const 属性 = normalizeSkillUiText(next['属性'], '');
        next['属性'] = 合法属性.includes(属性) ? 属性 : '力量';
      }
    }
    if (prototype === '资源变化' && normalizeSkillUiText(next['资源'], '') === '生命' && 解析技能设计台正负数值(next['数值']) < 0) {
      throw new Error('技能执行结构错误:资源变化生命不允许负数，请使用伤害结算');
    }
    return next;
  }

  // ===== 技能分类推断（bridge 22661-22738）=====
  const SKILL_DESIGNER_SKILL_TYPES = Object.freeze(['输出', '控制', '辅助', '防御', '回复', '位移', '领域', '被动', '真身', '召唤', '造物']);

  function 推断技能设计台技能分类(原型效果列表 = [], fallbackType = '') {
    const fallback = SKILL_DESIGNER_SKILL_TYPES.includes(normalizeSkillUiText(fallbackType, ''))
      ? normalizeSkillUiText(fallbackType, '')
      : '输出';
    const effects = Array.isArray(原型效果列表) ? 原型效果列表.filter(effect => effect && typeof effect === 'object') : [];
    if (!effects.length) return fallback;
    const 有原型 = name => effects.some(effect => normalizeSkillUiText(effect['原型'], '') === name);
    if (有原型('召唤生成')) return '召唤';
    if (有原型('位移执行')) return '位移';
    if (有原型('伤害结算')) return '输出';
    const 状态类型 = new Set(
      effects
        .filter(effect => normalizeSkillUiText(effect['原型'], '') === '状态施加')
        .map(effect => normalizeSkillUiText(effect['状态'], '')),
    );
    const 防御状态 = ['护盾', '无视异常', '霸体'];
    const 负面状态 = ['中毒', '流血', '灼烧', '冻伤', '眩晕', '沉默', '致盲', '禁疗', '治疗反转', '标记', '封技', '迟缓'];
    if (防御状态.some(state => 状态类型.has(state))) return '防御';
    if (负面状态.some(state => 状态类型.has(state))) return '控制';
    if (有原型('护盾变化') || 有原型('规则防御')) return '防御';
    if (有原型('状态移除') || 有原型('修炼增益')) return '辅助';
    const 读取数值方向 = effect => {
      const text = normalizeSkillUiText(effect && effect['数值'], '');
      if (/^-/.test(text)) return -1;
      if (/^\+/.test(text)) return 1;
      const num = Number(text.replace('%', ''));
      return Number.isFinite(num) ? Math.sign(num) : 0;
    };
    if (effects.some(effect => normalizeSkillUiText(effect['原型'], '') === '资源变化' && normalizeSkillUiText(effect['资源'], '') === '生命' && 读取数值方向(effect) > 0))
      return '回复';
    if (effects.some(effect => ['属性修正', '判定修正', '结算修正', '资源变化'].includes(normalizeSkillUiText(effect['原型'], '')) && 读取数值方向(effect) < 0))
      return '控制';
    if (effects.some(effect => ['属性修正', '判定修正', '结算修正', '资源变化'].includes(normalizeSkillUiText(effect['原型'], '')) && 读取数值方向(effect) > 0))
      return '辅助';
    if (有原型('决策干扰') || 有原型('规则改写') || 有原型('机制抹消')) return '控制';
    if (有原型('机制授予') || 有原型('复制执行') || 有原型('时光回溯') || 有原型('状态转移') || 有原型('状态交换'))
      return '辅助';
    return fallback;
  }

  // ===== 技能掌控度（bridge 22829-22857 / 23516-23537）=====
  function normalizeSkillDesignerLevelControl(数值 = {}) {
    const 来源 = 数值 && typeof 数值 === 'object' && !Array.isArray(数值) ? 数值 : {};
    const 中心等级 = Number(来源.中心等级);
    const 圆满等级 = Number(来源.圆满等级);
    if (!Number.isFinite(中心等级) || !Number.isFinite(圆满等级) || 圆满等级 <= 中心等级) return null;
    return { 中心等级: Number(中心等级.toFixed(2)), 圆满等级: Number(圆满等级.toFixed(2)) };
  }

  function buildSkillDesignerLevelControlFromDraft(草稿 = {}) {
    return (
      normalizeSkillDesignerLevelControl(草稿 && 草稿.技能掌控度) ||
      normalizeSkillDesignerLevelControl({
        中心等级: 草稿 && 草稿.技能掌控度中心等级,
        圆满等级: 草稿 && 草稿.技能掌控度圆满等级,
      })
    );
  }

  function 技能设计台启用技能掌控度(previewMeta = {}, 草稿 = {}) {
    if (草稿 && 草稿.技能掌控度 && typeof 草稿.技能掌控度 === 'object' && !Array.isArray(草稿.技能掌控度)) return true;
    const 显式值 = normalizeSkillUiText(草稿 && 草稿.启用技能掌控度, '');
    if (/启用|有|true|yes|1/.test(显式值)) return true;
    if (/无|禁用|关闭|false|no|0/.test(显式值)) return false;
    void previewMeta;
    return false;
  }

  function 计算技能设计台技能掌控度完整度(施术等级 = 1, 技能掌控度 = null) {
    const 掌控配置 = normalizeSkillDesignerLevelControl(技能掌控度);
    if (!掌控配置) return 1;
    const 等级 = Math.max(1, Number(施术等级 || 1));
    if (等级 >= 掌控配置.圆满等级) return 1;
    const 标准差 = (掌控配置.圆满等级 - 掌控配置.中心等级) / 1.8807936081512509;
    const 偏移 = (等级 - 掌控配置.中心等级) / Math.max(0.0001, 标准差);
    const 完整度 = 1 / (1 + Math.exp(-1.702 * 偏移));
    return Math.max(0, Math.min(1, Number(完整度.toFixed(4))));
  }

  function 按技能设计台掌控缩放倍率(数值, 完整度 = 1) {
    const 原值 = Number(数值);
    if (!Number.isFinite(原值)) return 数值;
    return Number((1 + (原值 - 1) * 完整度).toFixed(4));
  }

  function 按技能设计台掌控缩放数值(数值, 完整度 = 1) {
    const 原值 = Number(数值);
    if (!Number.isFinite(原值)) return 数值;
    return Number((原值 * 完整度).toFixed(4));
  }

  // ===== 草稿规范化：等价于 readSkillDesignerDraft(22951) → buildSkillDesignerFormStateFromDraft(27964)
  //       → buildSkillDesignerRuntimeEffects(30698) 中试算会读到的字段 =====
  function 构建技能设计台试算草稿(draft = {}, warnings = []) {
    const safe = draft && typeof draft === 'object' ? draft : {};
    const 是表单草稿 = Array.isArray(safe.prototypeEffects);
    let 原始效果 = [];
    let deliveryForm = '';
    let cost = {};
    let levelControl = null;
    let 启用掌控 = false;
    if (是表单草稿) {
      原始效果 = safe.prototypeEffects;
      deliveryForm = normalizeSkillUiText(safe.deliveryForm, '');
      const costConfig = parseSkillDesignerCostConfig(
        safe.cost || safe['消耗'],
        safe.resourceType || safe.costType,
        safe.resourceValues || safe.costValues,
      );
      cost = buildSkillDesignerCostObject(costConfig.resourceType, costConfig.resourceValues);
      启用掌控 = 技能设计台启用技能掌控度({}, safe);
      levelControl = 启用掌控 ? buildSkillDesignerLevelControlFromDraft(safe) : null;
    } else {
      // MVU 技能：造物承载取模板的使用效果，否则直接取 _效果数组
      const effectArray = Array.isArray(safe['_效果数组']) ? safe['_效果数组'] : [];
      const constructTemplate =
        effectArray.find(
          effect => effect && typeof effect === 'object' && !normalizeSkillUiText(effect['原型'], '') && Array.isArray(effect['使用效果']),
        ) || null;
      原始效果 = constructTemplate ? constructTemplate['使用效果'] : effectArray;
      deliveryForm = normalizeSkillUiText(safe['承载方式'] || safe['释放形式'], '');
      const costConfig = 解析技能设计台消耗文本配置(safe['消耗']);
      cost = buildSkillDesignerCostObject(costConfig.resourceType, costConfig.resourceValues);
      levelControl = normalizeSkillDesignerLevelControl(safe['技能掌控度']);
      启用掌控 = !!levelControl;
    }
    const 有效原始效果 = (Array.isArray(原始效果) ? 原始效果 : []).filter(
      effect => effect && typeof effect === 'object' && normalizeSkillUiText(effect['原型'], ''),
    );
    const 主目标 = normalizeSkillDesignerEffectTargetValue(有效原始效果[0] && 有效原始效果[0]['目标'], '单体');
    const prototypeEffects = 有效原始效果.map(effect => 规范化试算原型效果(effect, 主目标, warnings)).filter(Boolean);
    // 原版 formState 无可用原型时回落到「首个注册原型的默认效果」（bridge 28103-28108 / 26903-26909）
    if (!prototypeEffects.length) {
      prototypeEffects.push(规范化试算原型效果({ 原型: '伤害结算', 目标: 主目标 }, 主目标, warnings));
      warnings.push('没有可识别的效果，试算按一次威力倍率 100 的普通伤害估算');
    }
    if (有效原始效果.some(effect => Array.isArray(effect['条件分支']) && effect['条件分支'].length))
      warnings.push('条件分支不计入试算，结果按未触发分支计算');
    const fallbackType = SKILL_DESIGNER_SKILL_TYPES.includes(normalizeSkillUiText(safe.type, '')) ? normalizeSkillUiText(safe.type, '') : '输出';
    return {
      name: normalizeSkillUiText(safe.name || safe['魂技名'], ''),
      type: 推断技能设计台技能分类(prototypeEffects, fallbackType),
      deliveryForm,
      target: 主目标,
      cost,
      启用技能掌控度: 启用掌控 ? '启用' : '无',
      技能掌控度: levelControl,
      技能掌控度中心等级: levelControl ? String(levelControl.中心等级) : '',
      技能掌控度圆满等级: levelControl ? String(levelControl.圆满等级) : '',
      prototypeEffects,
    };
  }

  // ===== 试算核心（bridge 23539-24157）=====
  function 读取技能设计台天赋训练系数(天赋梯队 = '正常') {
    return ({ 绝世妖孽: 1.6, 顶级天才: 1.2, 天才: 1, 优秀: 0.8, 正常: 0.5, 劣等: 0.2, 天赋极差: 0 }[String(天赋梯队 || '').trim()] ?? 0.5);
  }

  function 读取技能设计台精神训练系数(天赋梯队 = '正常') {
    const 梯队 = String(天赋梯队 || '').trim();
    return 梯队 === '绝世妖孽' ? 2.0 : 读取技能设计台天赋训练系数(梯队);
  }

  function 构建技能设计台标准战斗属性(等级 = 1, 系别 = '强攻系', 选项 = {}) {
    const 等级值 = Math.max(1, Number(等级 || 1));
    const 基础属性函数 = 读取窗口函数('__LWCS_GET_BASE_STATS__');
    if (typeof 基础属性函数 !== 'function') throw new Error('MVU基础属性函数未加载');
    const 基础 = 基础属性函数(等级值) || {};
    const 系数表 = {
      强攻系: { sp_max: 1, men_max: 1, str: 1, def: 1, agi: 1, vit_max: 1 },
      防御系: { sp_max: 1, men_max: 1, str: 0.9, def: 1.5, agi: 0.7, vit_max: 1 },
      敏攻系: { sp_max: 1, men_max: 1, str: 0.8, def: 0.7, agi: 1.6, vit_max: 0.8 },
      控制系: { sp_max: 1, men_max: 1.2, str: 0.9, def: 0.8, agi: 1.1, vit_max: 0.9 },
      辅助系: { sp_max: 1, men_max: 1.2, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
      治疗系: { sp_max: 1, men_max: 1.2, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
      食物系: { sp_max: 1, men_max: 1.2, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
      精神系: { sp_max: 1, men_max: 1.7, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
      元素系: { sp_max: 1, men_max: 1.5, str: 0.8, def: 0.6, agi: 0.8, vit_max: 0.7 },
      召唤系: { sp_max: 1, men_max: 1.35, str: 0.8, def: 0.8, agi: 0.8, vit_max: 0.8 },
    };
    const 系数 = 系数表[String(系别 || '').trim()] || 系数表.强攻系;
    const 天赋训练系数 = 读取技能设计台天赋训练系数(选项?.天赋梯队 || '正常');
    const 精神训练系数 = 读取技能设计台精神训练系数(选项?.天赋梯队 || '正常');
    const 常规训练倍率 = 等级值 > 10 ? 1 + 0.005 * (等级值 - 10) * 天赋训练系数 : 1;
    const 精神训练倍率 = 等级值 > 10 ? 1 + 0.005 * (等级值 - 10) * 精神训练系数 : 1;
    const 属性 = {
      name: `标准${Math.round(等级值)}级`,
      type: 系别 || '强攻系',
      lv: 等级值,
      等级: 等级值,
      str: Math.max(1, Math.round(Number(基础.str || 1) * 系数.str * 常规训练倍率)),
      def: Math.max(1, Math.round(Number(基础.def || 1) * 系数.def * 常规训练倍率)),
      agi: Math.max(1, Math.round(Number(基础.agi || 1) * 系数.agi * 常规训练倍率)),
      men_max: Math.max(1, Math.round(Number(基础.men_max || 1) * 系数.men_max * 精神训练倍率)),
      sp_max: Math.max(1, Math.round(Number(基础.sp_max || 1) * 系数.sp_max)),
      vit_max: Math.max(1, Math.round(Number(基础.vit_max || 1) * 系数.vit_max * 常规训练倍率)),
      属性: { 天赋梯队: String(选项?.天赋梯队 || '正常').trim() || '正常' },
    };
    属性.sp = 属性.sp_max;
    属性.men = 属性.men_max;
    属性.hp_max = 属性.vit_max;
    属性.HP上限 = 属性.vit_max;
    属性.HP = 属性.vit_max;
    属性.属性 = {
      ...属性.属性,
      等级: 属性.等级,
      系别: 属性.type,
      力量: 属性.str,
      防御: 属性.def,
      敏捷: 属性.agi,
      HP上限: 属性.HP上限,
      生命上限: 属性.HP上限,
      体力上限: 属性.vit_max,
      魂力上限: 属性.sp_max,
      精神力上限: 属性.men_max,
      hp_max: 属性.hp_max,
      vit_max: 属性.vit_max,
      sp_max: 属性.sp_max,
      men_max: 属性.men_max,
    };
    属性.final = { ...属性 };
    return 属性;
  }

  function 读取技能设计台当前等级(snapshot = {}) {
    return Math.max(
      1,
      Number(
        deepGet(snapshot, 'activeChar.属性.等级', 0) || deepGet(snapshot, 'activeChar.lv', 0) || deepGet(snapshot, 'activeChar.等级', 0) || 1,
      ) || 1,
    );
  }

  // MVU 角色 属性 → 试算战斗属性（str/def/agi/vit_max/sp_max/men_max …）
  function 构建技能设计台当前战斗属性(snapshot = {}) {
    const 来源 = deepGet(snapshot, 'activeChar.属性', {}) || {};
    const 属性 = {
      name: toText(deepGet(snapshot, 'activeName', ''), '当前角色'),
      type: normalizeSkillUiText(来源.系别, '强攻系'),
      lv: Math.max(1, Number(来源.等级 || 1)),
      等级: Math.max(1, Number(来源.等级 || 1)),
      str: Math.max(1, Number(来源.力量 || 1)),
      def: Math.max(1, Number(来源.防御 || 1)),
      agi: Math.max(1, Number(来源.敏捷 || 1)),
      vit_max: Math.max(1, Number(来源.体力上限 || 来源.HP上限 || 1)),
      sp_max: Math.max(1, Number(来源.魂力上限 || 1)),
      men_max: Math.max(1, Number(来源.精神力上限 || 1)),
    };
    属性.sp = Math.max(0, Math.min(属性.sp_max, Number(来源.魂力 ?? 属性.sp_max)));
    属性.men = Math.max(0, Math.min(属性.men_max, Number(来源.精神力 ?? 属性.men_max)));
    属性.hp_max = 属性.vit_max;
    属性.HP上限 = 属性.vit_max;
    属性.HP = Math.max(0, Math.min(属性.vit_max, Number(来源.HP ?? 来源.体力 ?? 属性.vit_max)));
    属性.final = { ...属性 };
    return 属性;
  }

  function 读取技能设计台伤害效果列表(effectArray = []) {
    return (Array.isArray(effectArray) ? effectArray : []).filter(
      effect =>
        effect &&
        typeof effect === 'object' &&
        toText(effect['原型'], '').trim() === '伤害结算' &&
        (Number(effect['威力倍率'] || 0) > 0 || normalizeSkillUiText(effect['数值'], '')),
    );
  }

  function 读取技能设计台防御效果列表(effectArray = []) {
    return (Array.isArray(effectArray) ? effectArray : []).filter(effect => {
      if (!effect || typeof effect !== 'object') return false;
      const prototype = toText(effect['原型'], '').trim();
      return (
        ['护盾变化', '规则防御'].includes(prototype) ||
        (prototype === '状态施加' && ['霸体', '无视异常'].includes(normalizeSkillUiText(effect['状态'], ''))) ||
        (prototype === '结算修正' &&
          (['伤害分摊', '反伤'].includes(normalizeSkillUiText(effect['结算'], '')) ||
            (normalizeSkillUiText(effect['结算'], '') === '受到伤害' && 解析技能设计台正负数值(effect['数值']) < 0)))
      );
    });
  }

  function 构建技能设计台试算效果列表(draft = {}, 施术等级 = 1) {
    const levelControl = normalizeSkillDesignerLevelControl(draft['技能掌控度']);
    const 完整度 = 计算技能设计台技能掌控度完整度(施术等级, levelControl);
    const effectArray = cloneJsonValue(draft.prototypeEffects || [], []);
    if (!levelControl || 完整度 >= 0.9999) return effectArray;
    return effectArray.map(effect => {
      if (!effect || typeof effect !== 'object') return effect;
      if (effect['数值'] !== undefined) {
        const action = toText(effect['动作'], '');
        effect['数值'] = ['倍率提升', '倍率压制'].includes(action)
          ? 按技能设计台掌控缩放倍率(effect['数值'], 完整度)
          : 按技能设计台掌控缩放数值(effect['数值'], 完整度);
      }
      ['护盾值', '每回合伤害'].forEach(key => {
        if (effect[key] !== undefined) effect[key] = 按技能设计台掌控缩放数值(effect[key], 完整度);
      });
      if (effect['威力倍率'] !== undefined) effect['威力倍率'] = 按技能设计台掌控缩放数值(effect['威力倍率'], 完整度);
      const statMods = effect['面板修改比例'] && typeof effect['面板修改比例'] === 'object' ? effect['面板修改比例'] : null;
      if (statMods) {
        ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => {
          if (statMods[key] !== undefined) statMods[key] = 按技能设计台掌控缩放倍率(statMods[key], 完整度);
        });
      }
      return effect;
    });
  }

  function 读取技能设计台试算类型(draft = {}) {
    const effectArray = 构建技能设计台试算效果列表(draft, 读取技能设计台当前等级({}));
    if (effectArray.some(effect => normalizeSkillUiText(effect && effect['原型'], '') === '炸环')) return '炸环';
    if (读取技能设计台伤害效果列表(effectArray).length > 0) return '攻击';
    if (读取技能设计台防御效果列表(effectArray).length > 0) return '防御';
    return '';
  }

  function 估算技能设计台属性等效等级(属性键 = 'str', 属性值 = 0) {
    const 基础属性函数 = 读取窗口函数('__LWCS_GET_BASE_STATS__');
    const 数值 = Number(属性值 || 0);
    if (typeof 基础属性函数 !== 'function' || !(数值 > 0)) return '';
    let 最接近等级 = 1;
    let 最小差值 = Infinity;
    for (let 等级 = 1; 等级 <= 100; 等级 += 0.5) {
      const 基准 = Number((基础属性函数(等级) || {})[属性键] || 0);
      const 差值 = Math.abs(基准 - 数值);
      if (差值 < 最小差值) {
        最小差值 = 差值;
        最接近等级 = 等级;
      }
    }
    return Number.isInteger(最接近等级) ? String(最接近等级) : 最接近等级.toFixed(1);
  }

  function 获取技能设计台炸环百级校准倍率(属性键 = 'str') {
    const 基础属性函数 = 读取窗口函数('__LWCS_GET_BASE_STATS__');
    const 九十七级 = typeof 基础属性函数 === 'function' ? 基础属性函数(97) : null;
    const 百级 = typeof 基础属性函数 === 'function' ? 基础属性函数(100) : null;
    const 基准 = Number((九十七级 && 九十七级[属性键]) || 0);
    const 目标 = Number((百级 && 百级[属性键]) || 0);
    if (基准 > 0 && 目标 > 基准) return 目标 / 基准;
    return (
      {
        str: 5.511348148148148,
        def: 5.511348148148148,
        agi: 5.511348148148148,
        vit_max: 5.511348148148148,
        men_max: 4.166666666666667,
        sp_max: 16,
      }[属性键] || 5.511348148148148
    );
  }

  function 计算技能设计台炸环属性倍率(属性键 = 'str', 总年限 = 100000, 强化倍率 = 1) {
    const 年限比例 = Math.max(0, Number(总年限 || 0)) / 400000;
    const 基础倍率 = Math.max(0.01, Number(强化倍率 || 1));
    return Math.max(1.005, Number((1 + 基础倍率 * 年限比例 * (获取技能设计台炸环百级校准倍率(属性键) - 1)).toFixed(4)));
  }

  function 构建技能设计台炸环十万年试算行(战斗属性 = {}, 强化倍率 = 1) {
    const 项目 = [
      ['力量', 'str'],
      ['防御', 'def'],
      ['敏捷', 'agi'],
      ['魂力', 'sp_max'],
      ['精神', 'men_max'],
      ['体力', 'vit_max'],
    ];
    return 项目.map(([标签, 属性]) => {
      const 倍率 = 计算技能设计台炸环属性倍率(属性, 100000, 强化倍率);
      const 数值 = Number(战斗属性[属性] || 0) * 倍率;
      const 等效等级 = 估算技能设计台属性等效等级(属性, 数值);
      return { 标签, 属性键: 属性, 倍率, 数值, 等效等级 };
    });
  }

  function 应用于技能设计台试算属性(属性 = {}, 修改比例 = {}) {
    const next = { ...属性 };
    ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => {
      const ratio = Number(修改比例 && 修改比例[key]);
      if (Number.isFinite(ratio) && ratio > 0) next[key] = Number((Number(next[key] || 0) * ratio).toFixed(2));
    });
    next.hp_max = next.vit_max || next.hp_max;
    next.HP上限 = next.hp_max;
    next.HP = next.hp_max;
    next.sp = Math.min(Number(next.sp || next.sp_max || 1), Number(next.sp_max || 1));
    next.men = Math.min(Number(next.men || next.men_max || 1), Number(next.men_max || 1));
    next.final = { ...next };
    return next;
  }

  function 计算技能设计台资源压制倍率(attacker = {}, defender = {}, resourceKey = 'sp') {
    const attackerCurrent = Math.max(1, Number(attacker[resourceKey] || attacker[`${resourceKey}_max`] || 1));
    const defenderCurrent = Math.max(1, Number(defender[resourceKey] || defender[`${resourceKey}_max`] || 1));
    const attackerMax = Math.max(1, Number(attacker[`${resourceKey}_max`] || attackerCurrent));
    const remainRatio = Math.max(0, Math.min(1, attackerCurrent / attackerMax));
    const pressure = Math.pow(Math.max(0.01, attackerCurrent / defenderCurrent), 0.45);
    return Math.max(0.35, Math.min(1.85, pressure * (0.45 + 0.55 * remainRatio)));
  }

  // 原版 formState 不携带 ringIndex，因此此处恒按 1 环取 3%
  function 计算技能设计台固定结算消耗比例(draft = {}) {
    const effects = Array.isArray(draft.prototypeEffects) ? draft.prototypeEffects : [];
    if (!effects.some(effect => normalizeSkillUiText(effect && effect['原型'], '') === '伤害结算')) return 0;
    const ringIndex = Math.max(1, Math.min(9, Math.floor(Number(draft.ringIndex || draft.ring || 1) || 1)));
    if (ringIndex === 7) return 0;
    return Math.max(0, Math.min(0.27, ringIndex * 0.03));
  }

  function 计算技能设计台消耗加成系数(draft = {}, attacker = {}) {
    const cost =
      draft && draft.cost && typeof draft.cost === 'object' && !Array.isArray(draft.cost)
        ? draft.cost
        : buildSkillDesignerCostObject(draft.costType || draft.resourceType, draft.costValues || draft.resourceValues);
    const 承载比例 = safeEntries(cost).reduce((sum, [resource, raw]) => {
      const text = normalizeSkillUiText(raw, '');
      const 上限 = Math.max(1, Number(attacker[resource === '精神力' ? 'men_max' : resource === '体力' ? 'vit_max' : 'sp_max'] || 1));
      const 比例 = /%$/.test(text) ? Math.max(0, parseSkillDesignerNumericInputValue(text, 0)) / 100 : Math.max(0, Number(raw || 0)) / 上限;
      return sum + 比例;
    }, 0);
    if (!(承载比例 > 0)) return 1;
    const 固定比例 = 计算技能设计台固定结算消耗比例(draft);
    return Math.max(0, (承载比例 + 固定比例) / 承载比例);
  }

  function 计算技能设计台单段伤害(effect = {}, attacker = {}, defender = {}, finalDamageMult = 1, finalDamageBonus = 0, draft = {}) {
    const rawPower = Math.max(0, Number(effect['威力倍率'] || 0) || parseSkillDesignerFactorInputValue(effect['数值'], 0));
    const power = rawPower;
    const penetration = Math.max(0, Number(effect['防御穿透'] || 0));
    const effectivePenetration = penetration >= 100 ? 100 : Math.min(92, penetration);
    const defense = Math.max(1, Number(defender.def || 1) * (1 - effectivePenetration / 100));
    const damageType = 规范化技能设计台伤害类型(effect['伤害类型'], draft);
    const mentalDamage = damageType === '精神攻击';
    const rangedDamage = damageType === '远程攻击';
    const trueDamage = damageType === '真实攻击';
    const driveScale = mentalDamage
      ? 计算技能设计台资源压制倍率(attacker, defender, 'men')
      : 计算技能设计台资源压制倍率(attacker, defender, 'sp');
    const attackValue = trueDamage
      ? Math.max(Number(attacker.men_max || 1), Number(attacker.sp_max || 1))
      : mentalDamage
        ? Math.max(Number(attacker.men_max || 1), Number(attacker.sp_max || 1) * 0.7)
        : rangedDamage
          ? Math.max(Number(attacker.sp_max || 1), Number(attacker.str || 1) * 0.75)
          : Number(attacker.str || 1);
    const costScale = 计算技能设计台消耗加成系数(draft, attacker);
    const defenseScale = trueDamage ? Math.max(1, Math.sqrt(attackValue)) * 0.12 : attackValue / defense;
    return Math.max(0, power * defenseScale * driveScale * costScale * finalDamageMult + finalDamageBonus);
  }

  function 获取技能设计台标准攻击威力倍率(等级 = 1) {
    const ringIndex = Math.max(1, Math.min(9, Math.ceil(Math.max(1, Number(等级 || 1)) / 10)));
    if (ringIndex === 7) return 770;
    return [70, 104, 155, 232, 346, 516, 770, 1149, 2100][ringIndex - 1] || 70;
  }

  function 计算技能设计台伤害次数系数(effect = {}) {
    return Math.max(1, parseSkillDesignerIntegerInputValue(effect['攻击段数'], 1, 1));
  }

  function 计算技能设计台附加伤害(effectArray = [], baseDamage = 0) {
    void effectArray;
    void baseDamage;
    return 0;
  }

  // 返回值在原版基础上附带 明细/incomingRaw/hp 等字段，数值计算不变
  function 估算技能设计台防御续承伤(draft = {}, 施术等级 = 1, 攻击等级 = 1, 防御者属性 = null) {
    const effectArray = 构建技能设计台试算效果列表(draft, 施术等级);
    const defenseEffects = 读取技能设计台防御效果列表(effectArray);
    if (!defenseEffects.length) return { ok: false, reason: '非防御技能', damage: 0 };
    const defender = 防御者属性 || 构建技能设计台标准战斗属性(施术等级, normalizeSkillUiText(draft.type, '防御系'));
    const attacker = 构建技能设计台标准战斗属性(攻击等级, '强攻系');
    const 无防御伤害 = 计算技能设计台单段伤害(
      { 原型: '伤害结算', 威力倍率: 获取技能设计台标准攻击威力倍率(攻击等级), 伤害类型: '近身攻击' },
      attacker,
      defender,
      1,
      0,
    );
    let incoming = 无防御伤害;
    let shield = 0;
    let reduction = 0;
    let blockCount = 0;
    let deathSave = 0;
    defenseEffects.forEach(effect => {
      const prototype = toText(effect['原型'], '').trim();
      if (prototype === '护盾变化') shield += Math.max(0, parseSkillDesignerNumericInputValue(effect['数值'], 0));
      if (prototype === '结算修正' && normalizeSkillUiText(effect['结算'], '') === '受到伤害' && 解析技能设计台正负数值(effect['数值']) < 0)
        reduction = Math.max(reduction, Math.abs(parseSkillDesignerPercentRatio(effect['数值'], 0)));
      if (prototype === '规则防御') {
        const 次数 = Math.max(0, parseSkillDesignerIntegerInputValue(effect['次数'], 0, 0));
        if (normalizeSkillUiText(effect['规则'], '') === '免死') deathSave += 次数;
        else blockCount += 次数;
      }
      if (prototype === '状态施加' && ['霸体', '无视异常'].includes(normalizeSkillUiText(effect['状态'], ''))) blockCount += 1;
    });
    if (blockCount > 0) incoming = 0;
    incoming = Math.max(0, incoming * (1 - Math.min(0.95, reduction)) - shield);
    const hp = Math.max(1, Number(defender.hp_max || defender.vit_max || 1));
    const 防御收益 = Math.max(0, 无防御伤害 - incoming);
    const 有有效防御 = deathSave > 0 || blockCount > 0 || 防御收益 >= Math.max(1, hp * 0.1);
    return {
      ok: true,
      damage: incoming,
      survivable: 有有效防御 && (incoming < hp || deathSave > 0),
      明细: { 攻击等级, 攻击威力倍率: 获取技能设计台标准攻击威力倍率(攻击等级), 无防御伤害, shield, reduction, blockCount, deathSave, hp, 防御收益, 有有效防御, attacker, defender },
    };
  }

  function 计算技能设计台可承受最高等级(draft = {}, 施术等级 = 1, 防御者属性 = null) {
    const first = 估算技能设计台防御续承伤(draft, 施术等级, 1, 防御者属性);
    if (!first.ok) return { ok: false, reason: first.reason };
    let 最高等级 = 0;
    for (let 攻击等级值 = 1; 攻击等级值 <= 120; 攻击等级值 += 1) {
      const result = 估算技能设计台防御续承伤(draft, 施术等级, 攻击等级值, 防御者属性);
      if (result.ok && result.survivable) 最高等级 = 攻击等级值;
    }
    if (最高等级 <= 0) return { ok: true, text: '不足 Lv.1', 最高等级 };
    return { ok: true, text: 最高等级 >= 120 ? '可承受 Lv.120+' : `可承受 Lv.${最高等级}`, 最高等级 };
  }

  function 估算技能设计台伤害占比(draft = {}, 施术等级 = 1, 目标等级 = 1, 施术者属性 = null) {
    const effectArray = 构建技能设计台试算效果列表(draft, 施术等级);
    const damageEffects = 读取技能设计台伤害效果列表(effectArray);
    if (!damageEffects.length) return { ok: false, reason: '非伤害技能', ratio: 0 };
    let attacker = 施术者属性 || 构建技能设计台标准战斗属性(施术等级, normalizeSkillUiText(draft.type, '强攻系'));
    let defender = 构建技能设计台标准战斗属性(目标等级, '强攻系');
    let finalDamageMult = 1;
    const finalDamageBonus = 0;
    effectArray.forEach(effect => {
      if (!effect || typeof effect !== 'object') return;
      const prototype = normalizeSkillUiText(effect['原型'], '');
      if (prototype === '属性修正') {
        const 修正值 = parseSkillDesignerSignedValue(effect['数值']);
        const 面板修改比例 = {};
        normalizeSkillDesignerArray(effect['属性']).forEach(属性 => {
          const key = SKILL_DESIGNER_RUNTIME_PROPERTY_KEY_BY_LABEL[属性] || resolveSkillDesignerPropertyKeyByLabel(属性);
          if (['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].includes(key)) 面板修改比例[key] = Math.max(0.01, 1 + 修正值);
        });
        const targetText = normalizeSkillUiText(effect['目标'], '自身');
        if (safeEntries(面板修改比例).length && !damageEffects.includes(effect)) {
          if (['单体', '群体', '全场'].includes(targetText) && 修正值 < 0) defender = 应用于技能设计台试算属性(defender, 面板修改比例);
          else attacker = 应用于技能设计台试算属性(attacker, 面板修改比例);
        }
      }
      if (prototype === '结算修正' && normalizeSkillUiText(effect['结算'], '') === '造成伤害' && 解析技能设计台正负数值(effect['数值']) > 0) {
        const rawText = normalizeSkillUiText(effect['数值'], '');
        if (/^x/i.test(rawText)) finalDamageMult *= Math.max(0, parseSkillDesignerNumericInputValue(rawText, 1));
        else finalDamageMult *= Math.max(0, 1 + parseSkillDesignerSignedValue(rawText));
      }
    });
    const 段明细 = damageEffects.map(effect => {
      const 单段 = 计算技能设计台单段伤害(effect, attacker, defender, finalDamageMult, finalDamageBonus, draft);
      const 段数 = 计算技能设计台伤害次数系数(effect);
      return {
        威力倍率: Number(effect['威力倍率'] || 0),
        伤害类型: 规范化技能设计台伤害类型(effect['伤害类型'], draft),
        防御穿透: Math.max(0, Number(effect['防御穿透'] || 0)),
        攻击段数: 段数,
        perHit: 单段,
        subtotal: 单段 * 段数,
      };
    });
    const baseDamage = 段明细.reduce((total, item) => total + item.subtotal, 0);
    const damage = baseDamage + 计算技能设计台附加伤害(effectArray, baseDamage);
    const targetHp = Math.max(1, Number(defender.hp_max || defender.vit_max || 1));
    return {
      ok: true,
      ratio: damage / targetHp,
      damage,
      明细: { 段明细, finalDamageMult, costScale: 计算技能设计台消耗加成系数(draft, attacker), targetHp, attacker, defender },
    };
  }

  function 计算技能设计台可重创最高等级(draft = {}, 施术等级 = 1, 施术者属性 = null) {
    const first = 估算技能设计台伤害占比(draft, 施术等级, 1, 施术者属性);
    if (!first.ok) return { ok: false, reason: first.reason };
    let 最高等级 = 0;
    for (let 目标等级值 = 1; 目标等级值 <= 120; 目标等级值 += 1) {
      const result = 估算技能设计台伤害占比(draft, 施术等级, 目标等级值, 施术者属性);
      if (result.ok && result.ratio >= 0.5) 最高等级 = 目标等级值;
    }
    if (最高等级 <= 0) return { ok: true, text: '不足50%', 最高等级 };
    return { ok: true, text: 最高等级 >= 120 ? '可重创 Lv.120+' : `可重创 Lv.${最高等级}`, 最高等级 };
  }

  // ===== 对外接口：buildSkillDesignerSimulationHtml(24096) 的数据版 =====
  function 精简战斗属性(属性 = {}) {
    const 键表 = ['name', 'type', 'lv', 'str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max', 'sp', 'men', 'hp_max', 'HP'];
    return Object.fromEntries(键表.filter(key => 属性[key] !== undefined).map(key => [key, 属性[key]]));
  }

  function 取两位(数值) {
    return Number(Number(数值 || 0).toFixed(2));
  }

  function simulate(draft = {}, character = {}, options = {}) {
    const warnings = [];
    const snapshot = {
      activeChar: character && typeof character === 'object' ? character : {},
      activeName: (options && options.name) || (character && (character.name || character.姓名)) || '',
    };
    let 草稿;
    try {
      草稿 = 构建技能设计台试算草稿(draft, warnings);
    } catch (error) {
      return { kind: '', skillType: '', hidden: true, rows: [], summary: '', error: String(error && error.message || error), warnings };
    }
    const 当前等级 = 读取技能设计台当前等级(snapshot);
    const 当前战斗属性 = 构建技能设计台当前战斗属性(snapshot);
    const base = {
      skillType: 草稿.type,
      level: 当前等级,
      attacker: 精简战斗属性(当前战斗属性),
      effects: 草稿.prototypeEffects,
      warnings,
    };
    const 试算类型 = 读取技能设计台试算类型(草稿);
    // 原版无试算类型时返回空 HTML，试算行整体隐藏，无兜底文案
    if (!试算类型) return { kind: '', hidden: true, rows: [], summary: '', ...base };
    const 当前天赋梯队 = normalizeSkillUiText(deepGet(snapshot, 'activeChar.属性.天赋梯队', ''), '正常');

    if (试算类型 === '炸环') {
      const effect = 构建技能设计台试算效果列表(草稿, 当前等级).find(item => normalizeSkillUiText(item && item['原型'], '') === '炸环') || {};
      const 强化倍率 = parseSkillDesignerPercentRatio(effect['强化倍率'], 1);
      const 属性行 = 构建技能设计台炸环十万年试算行(当前战斗属性, 强化倍率);
      const rows = [
        { label: '公式', value: `倍率${formatSkillDesignerSignedValue(强化倍率, true)} × 年限/40万`, note: '炸环强化按十万年魂环折算' },
        ...属性行.map(item => ({
          label: item.标签,
          value: `10万年倍率 x${item.倍率.toFixed(2)} ｜ ${formatNumber(Math.round(item.数值))}${item.等效等级 ? ` ｜ 约Lv.${item.等效等级}` : ''}`,
          note: `原值 ${formatNumber(Number(当前战斗属性[item.属性键] || 0))}`,
          data: { key: item.属性键, ratio: item.倍率, value: item.数值, equivalentLevel: item.等效等级 },
        })),
      ];
      return {
        kind: '炸环',
        hidden: false,
        rows,
        summary: rows.map(row => `${row.label} ${row.value}`).join('；'),
        burst: { 强化倍率, rows: 属性行 },
        ...base,
      };
    }

    const rows = [];
    const 添加试算行 = (标签, 等级值, 战斗属性 = null, note = '') => {
      const 结果 = 试算类型 === '防御'
        ? 计算技能设计台可承受最高等级(草稿, 等级值, 战斗属性)
        : 计算技能设计台可重创最高等级(草稿, 等级值, 战斗属性);
      rows.push({
        label: 标签,
        value: 结果.ok ? 结果.text : 结果.reason,
        note,
        data: { level: 等级值, maxLevel: 结果.ok ? 结果.最高等级 : null },
      });
    };
    添加试算行(`当前 Lv.${Number(当前等级.toFixed(1)).toString()}`, 当前等级, 当前战斗属性, '当前角色面板');
    if (技能设计台启用技能掌控度({}, 草稿)) {
      const 掌控等级 = buildSkillDesignerLevelControlFromDraft(草稿);
      if (掌控等级) {
        const 系别 = normalizeSkillUiText(草稿.type, 试算类型 === '防御' ? '防御系' : '强攻系');
        const 标准说明 = `标准属性（${当前天赋梯队}）`;
        添加试算行(`中心 Lv.${掌控等级.中心等级}`, 掌控等级.中心等级, 构建技能设计台标准战斗属性(掌控等级.中心等级, 系别, { 天赋梯队: 当前天赋梯队 }), 标准说明);
        添加试算行(`圆满 Lv.${掌控等级.圆满等级}`, 掌控等级.圆满等级, 构建技能设计台标准战斗属性(掌控等级.圆满等级, 系别, { 天赋梯队: 当前天赋梯队 }), 标准说明);
      } else {
        rows.push({ label: '技能掌控度', value: '缺少释放等级', note: '', muted: true });
      }
    }
    const result = {
      kind: 试算类型,
      hidden: false,
      rows,
      summary: rows.map(row => `${row.label}：${row.value}`).join('；'),
      ...base,
    };

    // 以下为补充明细（原版 HTML 不展示）：同等级标准强攻系对手的单次对抗数值
    if (试算类型 === '攻击') {
      const 对抗 = 估算技能设计台伤害占比(草稿, 当前等级, 当前等级, 当前战斗属性);
      if (对抗.ok) {
        const 段 = 对抗.明细.段明细;
        result.damage = {
          perHit: 取两位(段[0] ? 段[0].perHit : 0),
          hits: 段.reduce((sum, item) => sum + item.攻击段数, 0),
          total: 取两位(对抗.damage),
          segments: 段.map(item => ({ ...item, perHit: 取两位(item.perHit), subtotal: 取两位(item.subtotal) })),
          finalDamageMult: 对抗.明细.finalDamageMult,
          costScale: 取两位(对抗.明细.costScale),
          vsDefender: {
            label: `标准强攻系 Lv.${Number(当前等级.toFixed(1))}`,
            level: 当前等级,
            hp: 对抗.明细.targetHp,
            def: 对抗.明细.defender.def,
            ratio: 取两位(对抗.ratio),
            重创: 对抗.ratio >= 0.5,
            defender: 精简战斗属性(对抗.明细.defender),
          },
          maxLevel: rows[0] && rows[0].data ? rows[0].data.maxLevel : null,
        };
      }
    } else if (试算类型 === '防御') {
      const 对抗 = 估算技能设计台防御续承伤(草稿, 当前等级, 当前等级, 当前战斗属性);
      if (对抗.ok) {
        const 明细 = 对抗.明细;
        result.defense = {
          vsAttacker: {
            label: `标准强攻系 Lv.${Number(当前等级.toFixed(1))}`,
            level: 当前等级,
            威力倍率: 明细.攻击威力倍率,
            rawDamage: 取两位(明细.无防御伤害),
            incoming: 取两位(对抗.damage),
            hp: 明细.hp,
            survivable: 对抗.survivable,
            attacker: 精简战斗属性(明细.attacker),
          },
          shield: 明细.shield,
          reduction: 明细.reduction,
          blockCount: 明细.blockCount,
          deathSave: 明细.deathSave,
          maxLevel: rows[0] && rows[0].data ? rows[0].data.maxLevel : null,
        };
      }
    }
    return result;
  }

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.LWCS_DESIGNER_SIM = {
    simulate,
    // 调试用内部函数
    _internal: {
      getBaseStats,
      构建技能设计台试算草稿,
      构建技能设计台当前战斗属性,
      构建技能设计台标准战斗属性,
      计算技能设计台单段伤害,
      估算技能设计台伤害占比,
      估算技能设计台防御续承伤,
    },
  };
})();
